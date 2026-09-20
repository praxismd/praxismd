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

export async function createPaymentPlan(patientName, amount, months) {
  throw new Error('Recurring payment plans aren\'t wired up yet — only one-time payment links are live so far.');
}
