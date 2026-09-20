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
// Matches the HashRouter's public URL (see .github/workflows/deploy-pages.yml
// / GitHub Pages) — where a patient invite link points.
const APP_BASE_URL = 'https://praxismd.github.io/praxismd';

const MAX_PAYMENT_LINK_AMOUNT = 50000; // dollars — sanity cap, not a real business limit
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // patient invite links expire after 7 days

const ALLOWED_GHL_ROUTES = [
  { method: 'GET', pathname: '/contacts/' },
  { method: 'POST', pathname: '/contacts/' },
  { method: 'GET', pathname: '/conversations/search' },
  { method: 'GET', pathname: '/calendars/' },
  { method: 'GET', pathname: '/calendars/events' },
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

  const allowed = ALLOWED_GHL_ROUTES.some(r => r.method === reqMethod && r.pathname === url.pathname);
  if (!allowed) {
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
