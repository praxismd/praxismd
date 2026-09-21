// Patient-portal identity linking.
//
// A patient's login (Firebase Auth) has no inherent connection to any
// practice or GHL contact record — that link is established through a
// one-time invite token, generated and verified server-side (see
// functions/index.js's createPatientInvite / redeemPatientInvite) so a
// client can never claim "I belong to this practice" on its own say-so.

import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase';

// Staff-side: text a specific GHL contact a link to set up their portal
// account. Requires the contact to have a phone number on file.
export async function createPatientInvite(contactId, contactName, contactPhone) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'createPatientInvite');
  const res = await call({ contactId, contactName, contactPhone });
  return res.data; // { sent: true }
}

// Patient-side: call right after creating the Firebase Auth account for an
// invite-based signup, so the new account gets linked to the practice +
// GHL contact the token was issued for.
export async function redeemPatientInvite(token) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'redeemPatientInvite');
  const res = await call({ token });
  return res.data; // { practiceId, ghlContactId, contactName }
}

// Patient-side: signs one of their own standard consent documents (seeded
// automatically when their account first links to a practice). Routed
// through a function rather than a direct client write so the signature
// timestamp and signer are always set server-side.
export async function signPatientDocument(docId) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'signPatientDocument');
  const res = await call({ docId });
  return res.data; // { signed: true }
}

// Patient-side: requests a refill on one of their own prescriptions.
export async function requestPrescriptionRefill(prescriptionId) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'requestPrescriptionRefill');
  const res = await call({ prescriptionId });
  return res.data; // { requested: true }
}

// Patient-side: accepts or declines one procedure on one of their own
// treatment plans.
export async function respondToTreatmentPlan(planId, procedureIndex, response) {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase isn\'t connected yet — add REACT_APP_FIREBASE_* to your .env.local.');
  }
  const call = httpsCallable(functions, 'respondToTreatmentPlan');
  const res = await call({ planId, procedureIndex, response });
  return res.data; // { status }
}
