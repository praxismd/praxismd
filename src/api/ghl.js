// GoHighLevel (LeadConnector v2) API client.
//
// ⚠️ PROTOTYPE ONLY — NOT SAFE FOR A REAL API KEY.
// This calls GHL directly from the browser using REACT_APP_GHL_API_KEY,
// which Create React App bakes into the public JS bundle at build time.
// Anyone who opens devtools on the deployed site can read that key and get
// full read/write access to the connected GHL account (contacts, messages,
// appointments — real patient data once this is live). That's acceptable
// only while there's no real key configured, for wiring up the UI shape.
// Before connecting a real GHL account, move these calls behind a server
// you control — e.g. a Firebase Cloud Function that holds the key and
// exposes safe endpoints to the client — and delete the key from
// REACT_APP_* entirely.
//
// Endpoint paths below target GHL's v2 API (services.leadconnectorhq.com)
// as of this writing. GHL's API surface changes across versions/plans —
// verify each path and payload shape against your account's API docs
// before relying on it.

const API_KEY = process.env.REACT_APP_GHL_API_KEY;
const LOCATION_ID = process.env.REACT_APP_GHL_LOCATION_ID;
const BASE_URL = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

export const isGhlConfigured = Boolean(API_KEY && LOCATION_ID);

async function ghlRequest(path, options = {}) {
  if (!isGhlConfigured) {
    throw new Error('GoHighLevel is not connected yet — add REACT_APP_GHL_API_KEY and REACT_APP_GHL_LOCATION_ID to your .env.local.');
  }

  const url = `${BASE_URL}${path}`;
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Version: API_VERSION,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (err) {
    throw new Error('Could not reach GoHighLevel — check your connection and try again.');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.message || body?.error || '';
    } catch {
      // response wasn't JSON — ignore, we'll fall back to the status text below
    }
    throw new Error(detail || `GoHighLevel request failed (${res.status} ${res.statusText}).`);
  }

  return res.json();
}

export async function getContacts({ limit = 100 } = {}) {
  const data = await ghlRequest(`/contacts/?locationId=${LOCATION_ID}&limit=${limit}`);
  return data.contacts || [];
}

export async function getConversations({ limit = 50 } = {}) {
  const data = await ghlRequest(`/conversations/search?locationId=${LOCATION_ID}&limit=${limit}`);
  return data.conversations || [];
}

export async function getAppointments({ startTime, endTime } = {}) {
  const now = Date.now();
  const start = startTime || now;
  const end = endTime || now + 30 * 24 * 60 * 60 * 1000; // default: next 30 days
  const data = await ghlRequest(`/calendars/events?locationId=${LOCATION_ID}&startTime=${start}&endTime=${end}`);
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
    body: JSON.stringify({ type: 'SMS', contactId, message }),
  });
}
