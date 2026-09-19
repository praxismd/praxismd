// Cloud Functions entry point.
//
// This is the ONLY place the Stripe and GoHighLevel secret keys are ever
// loaded. They live in Firebase Secret Manager (set via
// `firebase functions:secrets:set STRIPE_SECRET_KEY` / `GHL_API_KEY`, or the
// Firebase Console) and are injected into this function's environment at
// runtime — never in the repo, never in the React bundle, never visible to
// anyone inspecting the deployed site.
//
// The client (src/api/stripe.js, src/api/ghl.js) calls these through the
// Firebase SDK's httpsCallable(), which automatically attaches the caller's
// Firebase Auth ID token — that's what request.auth is checked against below.
//
// Note: request.auth only proves "some signed-in PraxisMD user called this,"
// not which role they have — role/tab permissions in src/App.js are UI-only,
// not enforced server-side yet. So ghlProxy is restricted below to the exact
// GHL endpoints the app actually calls (see ALLOWED_GHL_ROUTES), rather than
// accepting an arbitrary path/method, so a compromised or malicious
// authenticated session can't use it as an open proxy to the clinic's full
// GHL account.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const ghlApiKey = defineSecret('GHL_API_KEY');
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
// Matches REACT_APP_GHL_LOCATION_ID (see .github/workflows/deploy-pages.yml)
// — not a secret, just pinned here too so a caller can't point this proxy
// at a different sub-account by passing a different locationId.
const GHL_LOCATION_ID = 'MJIYE0wyUSwdoXjflQns';

const MAX_PAYMENT_LINK_AMOUNT = 50000; // dollars — sanity cap, not a real business limit

const ALLOWED_GHL_ROUTES = [
  { method: 'GET', pathname: '/contacts/' },
  { method: 'GET', pathname: '/conversations/search' },
  { method: 'GET', pathname: '/calendars/' },
  { method: 'GET', pathname: '/calendars/events' },
  { method: 'GET', pathname: '/campaigns/' },
  { method: 'POST', pathname: '/conversations/messages' },
];

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
  if (parsedAmount > MAX_PAYMENT_LINK_AMOUNT) {
    throw new HttpsError('invalid-argument', `Amount can't exceed $${MAX_PAYMENT_LINK_AMOUNT.toLocaleString()}.`);
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

// Generic proxy for GoHighLevel (LeadConnector v2) API calls. Holds the GHL
// API key in Secret Manager — the client (src/api/ghl.js) sends a relative
// path + method + body, this attaches the auth header and forwards it, but
// only for paths/methods in ALLOWED_GHL_ROUTES and only for our own location.
exports.ghlProxy = onCall({ secrets: [ghlApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to use GoHighLevel.');
  }

  const { path, method, body } = request.data || {};
  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    throw new HttpsError('invalid-argument', 'A valid GoHighLevel API path is required.');
  }

  const reqMethod = method || 'GET';
  let url;
  try {
    url = new URL(path, GHL_BASE_URL);
  } catch {
    throw new HttpsError('invalid-argument', 'Malformed path.');
  }

  const allowed = ALLOWED_GHL_ROUTES.some(r => r.method === reqMethod && r.pathname === url.pathname);
  if (!allowed) {
    throw new HttpsError('permission-denied', 'That GoHighLevel endpoint is not permitted from this app.');
  }

  const locationId = url.searchParams.get('locationId');
  if (locationId && locationId !== GHL_LOCATION_ID) {
    throw new HttpsError('permission-denied', 'That location is not permitted from this app.');
  }

  let res;
  try {
    res = await fetch(`${GHL_BASE_URL}${path}`, {
      method: reqMethod,
      headers: {
        Authorization: `Bearer ${ghlApiKey.value()}`,
        Version: GHL_API_VERSION,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new HttpsError('unavailable', 'Could not reach GoHighLevel — try again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpsError('internal', data?.message || data?.error || `GoHighLevel request failed (${res.status}).`);
  }
  return data;
});
