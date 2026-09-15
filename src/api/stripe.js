// Stripe API client — BARE-BONES SCAFFOLD. No key wired up yet.
//
// This mirrors the shape of src/api/ghl.js so the rest of the app has
// something to call, but there's nothing live behind it: every function
// below just throws a friendly "not connected" error for now.
//
// Important: even once you're ready to connect a real Stripe account, this
// file should NOT call the Stripe API directly from the browser the way
// ghl.js does. Creating a payment link or charge requires your Stripe
// SECRET key, which must never ship in client-side JS. The real version of
// this file should call your own backend (e.g. a Firebase Cloud Function)
// that holds the secret key and exposes safe endpoints — this client would
// then just fetch() those endpoints.

export const isStripeConfigured = Boolean(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

async function stripeRequest(action) {
  if (!isStripeConfigured) {
    throw new Error("Stripe isn't connected yet — add REACT_APP_STRIPE_PUBLISHABLE_KEY to your .env.local.");
  }
  throw new Error(`${action} isn't wired up yet — this is a bare-bones scaffold. Build a backend endpoint that calls Stripe with your secret key, then call it from src/api/stripe.js.`);
}

export async function createPaymentLink(patientName, amount, type) {
  return stripeRequest('createPaymentLink');
}

export async function createPaymentPlan(patientName, amount, months) {
  return stripeRequest('createPaymentPlan');
}

export async function listPayments() {
  return stripeRequest('listPayments');
}
