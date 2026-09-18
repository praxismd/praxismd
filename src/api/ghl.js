// GoHighLevel (LeadConnector v2) API client.
//
// This never talks to GHL directly — the API key required for that lives
// in Firebase Secret Manager and is only ever loaded inside the `ghlProxy`
// Cloud Function (see functions/index.js). This file just sends a relative
// path + method + body through Firebase's httpsCallable, which attaches the
// signed-in user's ID token automatically so the function can require auth.
//
// Location ID isn't a secret (it's just an account identifier, not a
// credential), so it's fine to keep it in REACT_APP_GHL_LOCATION_ID.
//
// Endpoint paths below target GHL's v2 API (services.leadconnectorhq.com)
// as of this writing. GHL's API surface changes across versions/plans —
// verify each path and payload shape against your account's API docs
// before relying on it.

import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../firebase';

const LOCATION_ID = process.env.REACT_APP_GHL_LOCATION_ID;

export const isGhlConfigured = Boolean(isFirebaseConfigured && LOCATION_ID);

async function ghlRequest(path, { method, body } = {}) {
  if (!isGhlConfigured) {
    throw new Error('GoHighLevel is not connected yet — add REACT_APP_GHL_LOCATION_ID to your .env.local and set the GHL_API_KEY secret (see .env.example).');
  }
  const call = httpsCallable(functions, 'ghlProxy');
  const res = await call({ path, method, body });
  return res.data;
}

export async function getContacts({ limit = 100 } = {}) {
  const data = await ghlRequest(`/contacts/?locationId=${LOCATION_ID}&limit=${limit}`);
  return data.contacts || [];
}

export async function getConversations({ limit = 50 } = {}) {
  const data = await ghlRequest(`/conversations/search?locationId=${LOCATION_ID}&limit=${limit}`);
  return data.conversations || [];
}

export async function getCalendars() {
  const data = await ghlRequest(`/calendars/?locationId=${LOCATION_ID}`);
  return data.calendars || [];
}

// GHL's events endpoint requires one of userId/calendarId/groupId in
// addition to a date range — it won't just return "everything for this
// location." Callers must pass a calendarId (see getCalendars()).
export async function getAppointments({ startTime, endTime, calendarId } = {}) {
  if (!calendarId) return [];
  const now = Date.now();
  const start = startTime || now;
  const end = endTime || now + 30 * 24 * 60 * 60 * 1000; // default: next 30 days
  const data = await ghlRequest(`/calendars/events?locationId=${LOCATION_ID}&calendarId=${calendarId}&startTime=${start}&endTime=${end}`);
  return data.events || [];
}

export async function getCampaigns() {
  const data = await ghlRequest(`/campaigns/?locationId=${LOCATION_ID}`);
  return data.campaigns || [];
}

export async function sendMessage(contactId, message) {
  if (!contactId) throw new Error('sendMessage requires a contactId.');
  if (!message || !message.trim()) throw new Error('Message cannot be empty.');
  return ghlRequest('/conversations/messages', {
    method: 'POST',
    body: { type: 'SMS', contactId, message },
  });
}
