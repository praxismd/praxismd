// Cloud Functions entry point.
//
// This is the ONLY place the Stripe secret key is ever loaded. It lives in
// Firebase Secret Manager (set via `firebase functions:secrets:set
// STRIPE_SECRET_KEY`, or the Firebase Console) and is injected into this
// function's environment at runtime — it is never in the repo, never in the
// React bundle, and never visible to anyone inspecting the deployed site.
//
// The client (src/api/stripe.js) calls this through the Firebase SDK's
// httpsCallable(), which automatically attaches the caller's Firebase Auth
// ID token — that's what request.auth is checked against below.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

exports.createPaymentLink = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to send a payment link.');
  }

  const { patientName, amount, type } = request.data || {};
  const parsedAmount = Number(String(amount).replace(/[^0-9.]/g, ''));
  if (!patientName || typeof patientName !== 'string') {
    throw new HttpsError('invalid-argument', 'A patient name is required.');
  }
  if (!parsedAmount || parsedAmount <= 0) {
    throw new HttpsError('invalid-argument', 'A positive amount is required.');
  }

  const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2024-06-20' });

  try {
    // Payment Links require a Price object — create a one-off price for this
    // exact charge, then a link that sells it.
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(parsedAmount * 100),
      product_data: { name: `${type || 'Payment'} — ${patientName}` },
    });

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        patientName,
        type: type || '',
        createdBy: request.auth.uid,
      },
    });

    return { url: link.url };
  } catch (err) {
    throw new HttpsError('internal', err.message || 'Stripe request failed.');
  }
});
