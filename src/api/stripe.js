// Stripe API client.
//
// This never talks to Stripe directly — the secret key required to create
// a real payment link can't live in browser JS (Create React App bakes
// REACT_APP_* values straight into the public bundle). Instead this calls
// the `createPaymentLink` Firebase Cloud Function (see functions/index.js),
// which holds the Stripe secret key in Secret Manager and does the actual
// Stripe API call server-side. The Firebase SDK attaches the signed-in
// user's ID token automatically, so the function can require auth.

import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase';

export const isStripeConfigured = isFirebaseConfigured;

// Deliberately does not take a patient name or any other identifying detail
// — Stripe won't sign a HIPAA BAA, so nothing that could identify a patient
// or their treatment is sent to it. See the matching note in
// functions/index.js's createPaymentLink for the full rationale.
//
// ghlContactId never reaches Stripe either — it's only used server-side to
// write a billingCharges record the patient portal can find again (matched
// by the same ghlContactId their invite-linked account carries), and that a
// Stripe webhook flips to "paid" once the link is actually paid.
export async function createPaymentLink(ghlContactId, amount, type) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'createPaymentLink');
  const res = await call({ ghlContactId, amount, type });
  return res.data; // { url }
}

// Prices are placeholders (see STRIPE_STARTER_PRICE_ID etc. in
// functions/index.js) until real ones exist in the Stripe dashboard — swap
// both sides together when that happens.
export const STRIPE_PLAN_PRICE_IDS = {
  starter: 'price_placeholder_starter',
  growth: 'price_placeholder_growth',
  pro: 'price_placeholder_pro',
};

// Starts (or re-subscribes to) a practice's own PraxisMD plan subscription.
export async function createSubscription(practiceId, priceId, email) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'createSubscription');
  const res = await call({ practiceId, priceId, email });
  return res.data; // { subscriptionId, status, clientSecret }
}

// Cancels at the end of the current billing period — access continues
// until then, this doesn't cut a practice off immediately.
export async function cancelSubscription(practiceId) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'cancelSubscription');
  const res = await call({ practiceId });
  return res.data; // { status, currentPeriodEnd }
}

// Live status read straight from Stripe, not just whatever was last
// written to Firestore.
export async function getSubscriptionStatus(practiceId) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'getSubscriptionStatus');
  const res = await call({ practiceId });
  return res.data; // { status, planName, amount, currentPeriodEnd }
}

// A patient-specific installment plan — a fixed number of monthly charges
// that total a treatment cost. Like createPaymentLink, no patient name or
// other identifying detail is ever sent to Stripe — only the opaque
// patientId, which the practice's own Firestore record maps back to a
// real person.
export async function createPaymentPlan(patientId, practiceId, totalAmount, months) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'createPaymentPlan');
  const res = await call({ patientId, practiceId, totalAmount, months });
  return res.data; // { subscriptionId, status, clientSecret }
}
