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

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { randomBytes } = require('crypto');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const ghlApiKey = defineSecret('GHL_API_KEY');
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
// Matches REACT_APP_GHL_LOCATION_ID (see .github/workflows/deploy-pages.yml)
// — not a secret, just pinned here too so a caller can't point this proxy
// at a different sub-account by passing a different locationId.
const GHL_LOCATION_ID = 'MJIYE0wyUSwdoXjflQns';
// The real production domain — where a patient invite link points.
const APP_BASE_URL = 'https://praxismd.health';

const MAX_PAYMENT_LINK_AMOUNT = 50000; // dollars — sanity cap, not a real business limit
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // patient invite links expire after 7 days

// Stripe subscription price IDs, one per plan tier (see Landing.js's
// PRICING_PLANS for the matching tier names/prices). These are placeholders
// — swap them for the real price_... ids once the plans are created in the
// Stripe dashboard; nothing else here needs to change when that happens.
const STRIPE_STARTER_PRICE_ID = 'price_placeholder_starter';
const STRIPE_GROWTH_PRICE_ID = 'price_placeholder_growth';
const STRIPE_PRO_PRICE_ID = 'price_placeholder_pro';
// A server-side allowlist, same reasoning as ALLOWED_GHL_ROUTES below —
// never trust a client-supplied Stripe price id blindly, and this doubles
// as the lookup for the plan name/amount to store alongside a subscription.
const STRIPE_PRICE_ID_TO_PLAN = {
  [STRIPE_STARTER_PRICE_ID]: { name: 'Starter', amount: 299 },
  [STRIPE_GROWTH_PRICE_ID]: { name: 'Growth', amount: 499 },
  [STRIPE_PRO_PRICE_ID]: { name: 'Pro', amount: 999 },
};

// A route either matches an exact `pathname`, or a `test(pathname)` regexp
// for routes with a path parameter (e.g. a calendar id) that can't be
// allowlisted as a fixed string. `version` overrides GHL_API_VERSION for
// that specific call — GHL's Calendars endpoints (confirmed against GHL's
// own OpenAPI spec) require the older 2021-04-15 version header, not the
// 2021-07-28 the rest of this app already uses successfully.
const ALLOWED_GHL_ROUTES = [
  { method: 'GET', pathname: '/contacts/' },
  { method: 'POST', pathname: '/contacts/' },
  { method: 'GET', pathname: '/conversations/search' },
  { method: 'GET', pathname: '/calendars/' },
  { method: 'GET', pathname: '/calendars/events' },
  { method: 'GET', test: /^\/calendars\/[^/]+\/free-slots$/, version: '2021-04-15' },
  { method: 'POST', pathname: '/calendars/events/appointments', version: '2021-04-15' },
  { method: 'GET', pathname: '/campaigns/' },
  { method: 'POST', pathname: '/conversations/messages' },
];

// Stripe does not sign a HIPAA Business Associate Agreement on any plan —
// its position is that it isn't a business associate because payment data
// alone isn't PHI. That's only true as long as nothing identifying rides
// along with it, so this deliberately never sends a patient's name, or
// anything else that could identify them or their treatment, to Stripe —
// not in the product name, not in metadata, not anywhere. The link amount
// and a generic billing category (e.g. "Co-pay collection") are the only
// details Stripe ever sees; the practice's own systems (GHL/Firestore) are
// what map a sent link back to a specific patient. ghlContactId travels only
// as far as our own Firestore record below — never to Stripe — so the
// patient's portal can find it again once it's paid.
exports.createPaymentLink = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to send a payment link.');
  }

  const { amount, type, ghlContactId } = request.data || {};
  const parsedAmount = Number(String(amount).replace(/[^0-9.]/g, ''));
  if (!parsedAmount || parsedAmount <= 0) {
    throw new HttpsError('invalid-argument', 'A positive amount is required.');
  }
  if (parsedAmount > MAX_PAYMENT_LINK_AMOUNT) {
    throw new HttpsError('invalid-argument', `Amount can't exceed $${MAX_PAYMENT_LINK_AMOUNT.toLocaleString()}.`);
  }
  if (!ghlContactId || typeof ghlContactId !== 'string') {
    throw new HttpsError('invalid-argument', 'A patient is required.');
  }
  const billingCategory = typeof type === 'string' && type.trim() ? type.trim() : 'Payment';

  const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2024-06-20' });

  try {
    // Payment Links require a Price object — create a one-off price for this
    // exact charge, then a link that sells it.
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(parsedAmount * 100),
      product_data: { name: billingCategory },
    });

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        createdBy: request.auth.uid,
      },
    });

    // A lightweight record the practice's own systems use to track this
    // charge — this is what lets the patient portal show it live and flip
    // to "paid" once stripeWebhook hears back from Stripe.
    await db.collection('billingCharges').add({
      practiceId: request.auth.uid,
      ghlContactId,
      amount: parsedAmount,
      type: billingCategory,
      status: 'pending',
      stripePaymentLinkId: link.id,
      url: link.url,
      createdBy: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { url: link.url };
  } catch (err) {
    throw new HttpsError('internal', err.message || 'Stripe request failed.');
  }
});

// Starts (or re-subscribes to) a practice's PraxisMD plan subscription.
// Creates a Stripe customer for the practice the first time this is called
// (never a patient's), then a subscription for the chosen plan. Uses
// payment_behavior: 'default_incomplete' so the subscription is created
// immediately but stays "incomplete" until the returned clientSecret is
// confirmed client-side — this function only sets up the subscription, it
// doesn't collect a payment method itself.
exports.createSubscription = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to start a subscription.');
  }

  const { practiceId, priceId, email } = request.data || {};
  if (!practiceId || typeof practiceId !== 'string') {
    throw new HttpsError('invalid-argument', 'A practiceId is required.');
  }
  if (practiceId !== request.auth.uid) {
    throw new HttpsError('permission-denied', "You can only manage your own practice's subscription.");
  }
  const plan = STRIPE_PRICE_ID_TO_PLAN[priceId];
  if (!plan) {
    throw new HttpsError('invalid-argument', 'Unknown plan.');
  }

  const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2024-06-20' });
  const practiceRef = db.collection('practices').doc(practiceId);

  try {
    const practiceSnap = await practiceRef.get();
    let stripeCustomerId = practiceSnap.data()?.stripeCustomerId;

    if (!stripeCustomerId) {
      // Same rule as createPaymentLink — nothing about a patient ever
      // reaches Stripe. This customer represents the practice itself, so
      // its own billing email is fine to include.
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { practiceId },
      });
      stripeCustomerId = customer.id;
    }

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { practiceId },
    });

    await practiceRef.set({
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan: plan.name,
      subscriptionPriceId: priceId,
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
    };
  } catch (err) {
    throw new HttpsError('internal', err.message || 'Stripe request failed.');
  }
});

// Cancels a practice's subscription at the end of the current billing
// period rather than immediately — they keep access (and get billed once
// more, for the period already in progress) until then.
exports.cancelSubscription = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to cancel a subscription.');
  }
  const { practiceId } = request.data || {};
  if (!practiceId || practiceId !== request.auth.uid) {
    throw new HttpsError('permission-denied', "You can only manage your own practice's subscription.");
  }

  const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2024-06-20' });
  const practiceRef = db.collection('practices').doc(practiceId);

  try {
    const practiceSnap = await practiceRef.get();
    const subscriptionId = practiceSnap.data()?.stripeSubscriptionId;
    if (!subscriptionId) {
      throw new HttpsError('failed-precondition', 'No active subscription to cancel.');
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

    await practiceRef.set({
      subscriptionStatus: 'canceling',
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { status: 'canceling', currentPeriodEnd: subscription.current_period_end };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message || 'Stripe request failed.');
  }
});

// Live subscription status, read straight from Stripe (not just whatever
// was last written to Firestore) so it reflects e.g. a payment that failed
// or succeeded moments ago, before any webhook has landed.
exports.getSubscriptionStatus = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to view subscription status.');
  }
  const { practiceId } = request.data || {};
  if (!practiceId || practiceId !== request.auth.uid) {
    throw new HttpsError('permission-denied', "You can only view your own practice's subscription.");
  }

  const practiceSnap = await db.collection('practices').doc(practiceId).get();
  const subscriptionId = practiceSnap.data()?.stripeSubscriptionId;
  if (!subscriptionId) {
    return { status: 'none', planName: null, amount: null, currentPeriodEnd: null };
  }

  const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2024-06-20' });
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const price = subscription.items.data[0]?.price;
    return {
      status: subscription.status,
      planName: STRIPE_PRICE_ID_TO_PLAN[price?.id]?.name || practiceSnap.data()?.subscriptionPlan || null,
      amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
      currentPeriodEnd: subscription.current_period_end,
    };
  } catch (err) {
    throw new HttpsError('internal', err.message || 'Stripe request failed.');
  }
});

// A patient-specific installment plan — a fixed number of monthly charges
// that total a treatment cost, rather than an open-ended subscription. Like
// createPaymentLink, this never sends a patient's name or any identifying
// detail to Stripe; the Stripe customer/product carry only the opaque
// patientId, and Firestore (not Stripe) is what maps that back to a real
// person on the practice's own side.
exports.createPaymentPlan = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to create a payment plan.');
  }
  const { patientId, practiceId, totalAmount, months } = request.data || {};
  if (!patientId || typeof patientId !== 'string') {
    throw new HttpsError('invalid-argument', 'A patientId is required.');
  }
  if (!practiceId || practiceId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'You can only create payment plans for your own practice.');
  }
  const parsedTotal = Number(totalAmount);
  const parsedMonths = Number(months);
  if (!parsedTotal || parsedTotal <= 0) {
    throw new HttpsError('invalid-argument', 'A positive totalAmount is required.');
  }
  if (parsedTotal > MAX_PAYMENT_LINK_AMOUNT) {
    throw new HttpsError('invalid-argument', `Amount can't exceed $${MAX_PAYMENT_LINK_AMOUNT.toLocaleString()}.`);
  }
  if (!Number.isInteger(parsedMonths) || parsedMonths < 2 || parsedMonths > 24) {
    throw new HttpsError('invalid-argument', 'months must be a whole number between 2 and 24.');
  }

  const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2024-06-20' });
  const amountPerCycle = Math.round((parsedTotal / parsedMonths) * 100) / 100;

  try {
    const customer = await stripe.customers.create({
      metadata: { practiceId, patientId },
    });

    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(amountPerCycle * 100),
      recurring: { interval: 'month' },
      product_data: { name: `Payment plan — ${parsedMonths} months` },
    });

    // A subscription with a fixed end date, rather than open-ended — it
    // bills monthly and then stops itself once the total is paid off.
    const cancelAt = new Date();
    cancelAt.setMonth(cancelAt.getMonth() + parsedMonths);

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      cancel_at: Math.floor(cancelAt.getTime() / 1000),
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: { practiceId, patientId },
    });

    await db.collection('practices').doc(practiceId).collection('paymentPlans').doc(patientId).set({
      patientId,
      practiceId,
      totalAmount: parsedTotal,
      months: parsedMonths,
      amountPerCycle,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      createdBy: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
    };
  } catch (err) {
    throw new HttpsError('internal', err.message || 'Stripe request failed.');
  }
});

// Called from stripeWebhook (below) on payment_intent.payment_failed. Marks
// whichever Firestore record the failing subscription belongs to — the
// practice's own plan, or one patient's payment plan — as past_due, logs it
// for the activity log, and best-effort emails the practice owner. Never
// throws: a failed notification is not worth Stripe retrying the whole
// webhook delivery over.
async function handleFailedPayment(event, stripe) {
  const paymentIntent = event.data.object;
  const invoiceId = paymentIntent.invoice;
  if (!invoiceId) return; // not a subscription payment — nothing to update

  const invoice = await stripe.invoices.retrieve(invoiceId);
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  let practiceRef = null;
  let logContext = {};

  const ownSnap = await db.collection('practices').where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();
  if (!ownSnap.empty) {
    practiceRef = ownSnap.docs[0].ref;
    await practiceRef.set({ subscriptionStatus: 'past_due' }, { merge: true });
    logContext = { kind: 'subscription', practiceId: practiceRef.id };
  } else {
    const planSnap = await db.collectionGroup('paymentPlans').where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();
    if (!planSnap.empty) {
      const planDoc = planSnap.docs[0];
      await planDoc.ref.set({ status: 'past_due' }, { merge: true });
      practiceRef = planDoc.ref.parent.parent;
      logContext = { kind: 'paymentPlan', practiceId: practiceRef?.id, patientId: planDoc.id };
    }
  }

  if (!practiceRef) return; // subscription not tied to anything we track

  await db.collection('activityLog').add({
    type: 'payment_failed',
    ...logContext,
    stripeSubscriptionId: subscriptionId,
    amount: paymentIntent.amount != null ? paymentIntent.amount / 100 : null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    // Deliberately a plain env var, not a defineSecret() bound into this
    // function — this keeps the email step truly optional. `firebase
    // deploy --non-interactive` (see .github/workflows/deploy-functions.yml)
    // hard-fails the whole deploy if a bound secret doesn't exist yet in
    // Secret Manager, so requiring one here would risk breaking every
    // other function's auto-deploy over a nice-to-have notification. To
    // actually enable this, set SENDGRID_API_KEY via Secret Manager or a
    // functions/.env.praxismd file and read it the same way.
    const key = process.env.SENDGRID_API_KEY;
    if (!key) return; // not configured — logging above still happened
    const authUser = await admin.auth().getUser(practiceRef.id);
    if (!authUser.email) return;
    sgMail.setApiKey(key);
    await sgMail.send({
      to: authUser.email,
      from: 'billing@praxismd.health',
      subject: 'A payment on your PraxisMD account failed',
      text: 'A recent payment on your PraxisMD account did not go through. Please update your payment method to avoid any interruption to your service.',
    });
  } catch (err) {
    console.error('Failed to send payment-failure email:', err.message);
  }
}

// Stripe calls this directly (not through the Firebase SDK, so no
// request.auth) whenever a payment link is paid. Verifies the request is
// genuinely from Stripe via the webhook signing secret, then flips the
// matching billingCharges record(s) to "paid" so the patient portal's
// onSnapshot listener picks it up immediately.
exports.stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2024-06-20' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], stripeWebhookSecret.value());
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const paymentLinkId = session.payment_link;
    if (paymentLinkId) {
      const snap = await db.collection('billingCharges')
        .where('stripePaymentLinkId', '==', paymentLinkId)
        .where('status', '==', 'pending')
        .get();
      const batch = db.batch();
      snap.forEach(doc => {
        batch.update(doc.ref, { status: 'paid', paidAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      if (!snap.empty) await batch.commit();
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    try {
      await handleFailedPayment(event, stripe);
    } catch (err) {
      // Never fail the webhook over this — Stripe would just retry
      // delivery of an event we already looked at.
      console.error('handleFailedPayment failed:', err.message);
    }
  }

  res.status(200).send('ok');
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

  const matchedRoute = ALLOWED_GHL_ROUTES.find(r => {
    if (r.method !== reqMethod) return false;
    return r.pathname ? r.pathname === url.pathname : r.test.test(url.pathname);
  });
  if (!matchedRoute) {
    throw new HttpsError('permission-denied', 'That GoHighLevel endpoint is not permitted from this app.');
  }

  const locationId = url.searchParams.get('locationId');
  if (locationId && locationId !== GHL_LOCATION_ID) {
    throw new HttpsError('permission-denied', 'That location is not permitted from this app.');
  }
  // POST bodies (e.g. contact creation) carry locationId in the JSON body
  // instead of the query string — same check, same reason.
  if (body && typeof body === 'object' && body.locationId && body.locationId !== GHL_LOCATION_ID) {
    throw new HttpsError('permission-denied', 'That location is not permitted from this app.');
  }

  let res;
  try {
    res = await fetch(`${GHL_BASE_URL}${path}`, {
      method: reqMethod,
      headers: {
        Authorization: `Bearer ${ghlApiKey.value()}`,
        Version: matchedRoute.version || GHL_API_VERSION,
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

// Staff-side: creates a one-time signup link for a specific GHL contact and
// texts it to them. A `patients/{uid}` doc has no inherent link to a
// practice or a GHL contact — the invite token is what carries that link,
// so it can be established server-side (never trusting a client-supplied
// practiceId) the moment the patient actually signs up. See
// redeemPatientInvite below for the other half of this flow.
exports.createPatientInvite = onCall({ secrets: [ghlApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to invite a patient.');
  }

  const { contactId, contactName, contactPhone } = request.data || {};
  if (!contactId || typeof contactId !== 'string') {
    throw new HttpsError('invalid-argument', 'A contact is required.');
  }
  if (!contactPhone || typeof contactPhone !== 'string' || contactPhone === '—') {
    throw new HttpsError('invalid-argument', 'This contact needs a phone number on file to be invited.');
  }

  const token = randomBytes(24).toString('base64url');
  await db.collection('patientInvites').doc(token).set({
    practiceId: request.auth.uid,
    ghlContactId: contactId,
    contactName: typeof contactName === 'string' ? contactName : '',
    createdBy: request.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
    used: false,
  });

  const signupUrl = `${APP_BASE_URL}/#/login?invite=${token}`;
  const message = `You're invited to set up your PraxisMD patient portal — book appointments, message your practice, and view your account online: ${signupUrl}`;

  let res;
  try {
    res = await fetch(`${GHL_BASE_URL}/conversations/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ghlApiKey.value()}`,
        Version: GHL_API_VERSION,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'SMS', contactId, message }),
    });
  } catch (err) {
    throw new HttpsError('unavailable', 'Could not reach GoHighLevel to send the invite — try again.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new HttpsError('internal', data?.message || data?.error || `Could not text the invite (${res.status}).`);
  }

  return { sent: true };
});

// Patient-side: called right after createUserWithEmailAndPassword when
// signing up via an invite link (see src/Auth.js), so the new account gets
// linked to the inviting practice + GHL contact from a token only the
// practice's own SMS delivered — never from anything the client claims
// about itself.
exports.redeemPatientInvite = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to redeem an invite.');
  }

  const { token } = request.data || {};
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid invite token is required.');
  }

  const ref = db.collection('patientInvites').doc(token);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'This invite link is invalid.');
  }
  const invite = snap.data();
  if (invite.used) {
    throw new HttpsError('failed-precondition', 'This invite link has already been used.');
  }
  if (invite.expiresAt && invite.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('failed-precondition', 'This invite link has expired — ask your practice to send a new one.');
  }

  await db.collection('patients').doc(request.auth.uid).set({
    practiceId: invite.practiceId,
    ghlContactId: invite.ghlContactId,
  }, { merge: true });

  await ref.update({
    used: true,
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
    usedByUid: request.auth.uid,
  });

  await seedStandardConsentDocuments(invite.practiceId, invite.ghlContactId);

  return { practiceId: invite.practiceId, ghlContactId: invite.ghlContactId, contactName: invite.contactName || '' };
});

const STANDARD_CONSENT_DOCUMENTS = [
  'New patient health history',
  'HIPAA consent form',
  'Financial responsibility agreement',
];

// Every new patient needs to sign the same handful of standard intake
// forms — seed them unsigned the first time a patient links to a practice,
// so there's something real for the portal's Documents tab to show instead
// of nothing. Skips patients who already have documents (e.g. a re-sent
// invite) so this never creates duplicates.
async function seedStandardConsentDocuments(practiceId, ghlContactId) {
  const existing = await db.collection('patientDocuments').where('ghlContactId', '==', ghlContactId).limit(1).get();
  if (!existing.empty) return;
  const batch = db.batch();
  STANDARD_CONSENT_DOCUMENTS.forEach(name => {
    const ref = db.collection('patientDocuments').doc();
    batch.set(ref, {
      practiceId,
      ghlContactId,
      name,
      signed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

// Patient-side: signs one of their own standard consent documents. Routed
// through a function (rather than a direct client write) so the signature
// timestamp and signer are always set server-side — never something the
// client could backdate or attribute to someone else.
exports.signPatientDocument = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to sign a document.');
  }

  const { docId } = request.data || {};
  if (!docId || typeof docId !== 'string') {
    throw new HttpsError('invalid-argument', 'A document is required.');
  }

  const patientSnap = await db.collection('patients').doc(request.auth.uid).get();
  const ghlContactId = patientSnap.exists ? patientSnap.data().ghlContactId : null;
  if (!ghlContactId) {
    throw new HttpsError('failed-precondition', 'Your account isn\'t linked to a practice yet.');
  }

  const docRef = db.collection('patientDocuments').doc(docId);
  const docSnap = await docRef.get();
  if (!docSnap.exists || docSnap.data().ghlContactId !== ghlContactId) {
    throw new HttpsError('not-found', 'That document could not be found.');
  }
  if (docSnap.data().signed) {
    return { signed: true };
  }

  await docRef.update({
    signed: true,
    signedAt: admin.firestore.FieldValue.serverTimestamp(),
    signedByUid: request.auth.uid,
  });

  return { signed: true };
});

// Patient-side: requests a refill on one of their own prescriptions. Routed
// through a function (not a direct client write) so a patient can only ever
// flip this one narrow signal — never edit the drug, dosage, or refill
// count themselves — and the request timestamp is always set server-side.
exports.requestPrescriptionRefill = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to request a refill.');
  }

  const { prescriptionId } = request.data || {};
  if (!prescriptionId || typeof prescriptionId !== 'string') {
    throw new HttpsError('invalid-argument', 'A prescription is required.');
  }

  const patientSnap = await db.collection('patients').doc(request.auth.uid).get();
  const ghlContactId = patientSnap.exists ? patientSnap.data().ghlContactId : null;
  if (!ghlContactId) {
    throw new HttpsError('failed-precondition', 'Your account isn\'t linked to a practice yet.');
  }

  const rxRef = db.collection('patientPrescriptions').doc(prescriptionId);
  const rxSnap = await rxRef.get();
  if (!rxSnap.exists || rxSnap.data().ghlContactId !== ghlContactId) {
    throw new HttpsError('not-found', 'That prescription could not be found.');
  }
  const rx = rxSnap.data();
  if ((rx.refillsRemaining || 0) <= 0) {
    throw new HttpsError('failed-precondition', 'No refills remaining — your practice will need to prescribe a new one.');
  }
  if (rx.refillRequested) {
    return { requested: true };
  }

  await rxRef.update({
    refillRequested: true,
    refillRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { requested: true };
});

// Patient-side: accepts or declines one procedure on one of their own
// treatment plans. Procedures are stored as a map keyed by index (not an
// array) so this can update a single procedure's status with a dotted
// field path — updateDoc's `procedures.${i}.status` — without a
// read-modify-write race against a staff member editing the same plan.
// Routed through a function so a patient can only ever flip this one
// status field, never the procedure's code/name/cost.
exports.respondToTreatmentPlan = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to respond to a treatment plan.');
  }

  const { planId, procedureIndex, response } = request.data || {};
  if (!planId || typeof planId !== 'string') {
    throw new HttpsError('invalid-argument', 'A treatment plan is required.');
  }
  if (procedureIndex === undefined || procedureIndex === null || isNaN(Number(procedureIndex))) {
    throw new HttpsError('invalid-argument', 'A procedure is required.');
  }
  if (response !== 'accepted' && response !== 'declined') {
    throw new HttpsError('invalid-argument', 'Response must be "accepted" or "declined".');
  }

  const patientSnap = await db.collection('patients').doc(request.auth.uid).get();
  const ghlContactId = patientSnap.exists ? patientSnap.data().ghlContactId : null;
  if (!ghlContactId) {
    throw new HttpsError('failed-precondition', 'Your account isn\'t linked to a practice yet.');
  }

  const planRef = db.collection('patientTreatmentPlans').doc(planId);
  const planSnap = await planRef.get();
  if (!planSnap.exists || planSnap.data().ghlContactId !== ghlContactId) {
    throw new HttpsError('not-found', 'That treatment plan could not be found.');
  }
  const idx = String(Number(procedureIndex));
  if (!planSnap.data().procedures || !(idx in planSnap.data().procedures)) {
    throw new HttpsError('not-found', 'That procedure could not be found.');
  }

  await planRef.update({
    [`procedures.${idx}.status`]: response,
    [`procedures.${idx}.respondedAt`]: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { status: response };
});
