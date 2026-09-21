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
  if (!calendarId) return null;
  const now = Date.now();
  const start = startTime || now;
  const end = endTime || now + 30 * 24 * 60 * 60 * 1000; // default: next 30 days
  const data = await ghlRequest(`/calendars/events?locationId=${LOCATION_ID}&calendarId=${calendarId}&startTime=${start}&endTime=${end}`);
  return data.events || [];
}

// Returns open booking slots for one calendar, keyed by date (YYYY-MM-DD) ->
// { slots: [isoString, ...] }. GHL caps the range at 31 days per request.
// No locationId param here — GHL's free-slots endpoint doesn't take one
// (the API key itself is already scoped to a single location).
export async function getFreeSlots(calendarId, { startDate, endDate, timezone } = {}) {
  if (!calendarId) return {};
  const now = Date.now();
  const start = startDate || now;
  const end = endDate || start + 13 * 24 * 60 * 60 * 1000; // default: next 14 days
  const tz = timezone ? `&timezone=${encodeURIComponent(timezone)}` : '';
  const data = await ghlRequest(`/calendars/${calendarId}/free-slots?startDate=${start}&endDate=${end}${tz}`);
  return data || {};
}

// Books a real appointment on a GHL calendar. endTime is left to GHL's own
// calendar-configured duration when omitted — matches how the free-slots
// endpoint only ever returns start times, not a start/end pair to choose
// from.
export async function createAppointment({ calendarId, contactId, startTime, title }) {
  if (!calendarId || !contactId || !startTime) throw new Error('createAppointment requires calendarId, contactId, and startTime.');
  return ghlRequest('/calendars/events/appointments', {
    method: 'POST',
    body: {
      calendarId,
      locationId: LOCATION_ID,
      contactId,
      startTime,
      title: title || 'Appointment',
      appointmentStatus: 'confirmed',
    },
  });
}

export async function getCampaigns() {
  const data = await ghlRequest(`/campaigns/?locationId=${LOCATION_ID}`);
  return data.campaigns || [];
}

// Splits a single "Full Name" input into GHL's separate firstName/lastName
// fields — a single trailing token becomes lastName, everything before it
// firstName, matching how most contact forms behave.
function splitName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export async function createContact({ name, email, phone }) {
  if (!name || !name.trim()) throw new Error('A name is required.');
  const { firstName, lastName } = splitName(name);
  const data = await ghlRequest('/contacts/', {
    method: 'POST',
    body: {
      locationId: LOCATION_ID,
      firstName,
      lastName,
      email: email && email !== '—' ? email : undefined,
      phone: phone && phone !== '—' ? phone : undefined,
    },
  });
  return data.contact;
}

export async function sendMessage(contactId, message) {
  if (!contactId) throw new Error('sendMessage requires a contactId.');
  if (!message || !message.trim()) throw new Error('Message cannot be empty.');
  return ghlRequest('/conversations/messages', {
    method: 'POST',
    body: { type: 'SMS', contactId, message },
  });
}
