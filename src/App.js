import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { light, withAlpha, getTheme, BRAND_PRESETS, DEFAULT_BRAND } from './theme';
import { auth, db, isFirebaseConfigured } from './firebase';
import { getContacts, getConversations, getAppointments, getCampaigns, sendMessage, isGhlConfigured } from './api/ghl';
import { createPaymentLink, isStripeConfigured } from './api/stripe';
import {
  LayoutDashboard, InboxIcon, Megaphone, RotateCcw, CalendarIcon,
  ClipboardList, Users, Contact, Shield, Star, Smile, Bot, Receipt, CreditCard,
  TrendingUp, SettingsIcon, Bell, Sun, Moon, Search, Menu, ChevronLeft,
  ChevronRight, ChevronDown, Zap, Sparkles, LogOut,
  Download, Upload, Clock, Send, RotateCw, AlertTriangle, Plus, MessageSquare, Loader2,
  X, ArrowUp, ArrowDown, Check, Activity, UserPlus, Trash2, Lock, Pencil,
  Paperclip, ImageIcon, ArrowLeft, Eye, Palette, ArrowRight, FileArchive, FileText,
  CalendarPlus, BadgeCheck, Award, Flag, MessageCircle, Camera, EyeOff, Monitor, Smartphone,
  QrCode, Copy, ShieldCheck, KeyRound,
} from './icons';

export const ThemeContext = createContext(light);
export const useTheme = () => useContext(ThemeContext);

const PrivacyContext = createContext(false);
const usePrivacy = () => useContext(PrivacyContext);

function PII({ children, style }) {
  const privacyOn = usePrivacy();
  return (
    <span style={{ filter: privacyOn ? 'blur(6px)' : 'none', transition: 'filter .15s ease', ...style }}>
      {children}
    </span>
  );
}

function getInitialPrivacyMode() {
  return typeof window !== 'undefined' && window.localStorage.getItem('praxismd-privacy') === 'on';
}

function getInitialMode() {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('praxismd-theme') : null;
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

// Count-up animation for stat card values like "$8,400", "72%", "4.2h", "4.8"
function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(value);
  const frameRef = useRef(null);

  useEffect(() => {
    const str = String(value);
    const match = str.match(/-?[\d,]+\.?\d*/);
    if (!match) { setDisplay(value); return; }
    const target = parseFloat(match[0].replace(/,/g, ''));
    if (Number.isNaN(target)) { setDisplay(value); return; }
    const prefix = str.slice(0, match.index);
    const suffix = str.slice(match.index + match[0].length);
    const decimals = (match[0].split('.')[1] || '').length;
    let start = null;

    function step(ts) {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      const formatted = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();
      setDisplay(prefix + formatted + suffix);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    }
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return display;
}

function initialsOf(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// Cycles a fixed theme palette for avatars, since real GHL records don't
// carry a color the way the old demo data did.
function avatarStyle(t, i) {
  const palette = [
    [t.brand, t.brandL], [t.green, t.greenL], [t.amber, t.amberL],
    [t.purple, t.purpleL], [t.teal, t.tealL], [t.pink, t.pinkL],
  ];
  return palette[i % palette.length];
}

function mapContact(c) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.contactName || c.name || 'Unknown';
  return {
    id: c.id,
    name,
    email: c.email || '—',
    phone: c.phone || '—',
    tag: Array.isArray(c.tags) && c.tags.length ? c.tags[0] : null,
    dateAdded: c.dateAdded ? new Date(c.dateAdded).toLocaleDateString() : '—',
  };
}

// GHL's legacy Campaigns API returns basic metadata only (id, name,
// status) — nowhere near the per-touch sequence timelines, open/reply
// rates, or revenue attribution CAMPAIGNS_DATA fabricates below for the
// demo. Real campaigns render with an empty stats/sequence section rather
// than pretending to have engagement data GHL doesn't provide.
function mapCampaign(c) {
  const status = (c.status || '').toLowerCase();
  let pill = 'Live', pillColor = 'green';
  if (status.includes('pause')) { pill = 'Paused'; pillColor = 'muted'; }
  else if (status.includes('draft')) { pill = 'Draft'; pillColor = 'amber'; }
  return {
    id: c.id,
    name: c.name || 'Untitled campaign',
    sub: 'Synced from GoHighLevel',
    stats: [], statColors: [], pill, pillColor, prog: null, sequence: [],
  };
}

function mapConversation(c) {
  const name = c.contactName || c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
  const lastMessage = c.lastMessageBody || '(no message preview)';
  const time = c.dateUpdated ? new Date(c.dateUpdated).toLocaleString() : '';
  return {
    id: c.id,
    source: 'crm',
    contactId: c.contactId,
    name,
    channel: c.lastMessageType === 'Email' ? 'Email' : c.lastMessageType === 'Call' ? 'Calls' : 'SMS',
    unread: Boolean(c.unreadCount),
    messages: [{ sender: 'patient', text: lastMessage, time }],
  };
}

// Seeded demo data shown when GoHighLevel isn't connected, so Patients and
// Inbox feel alive out of the box instead of showing a blocking "not
// connected" wall. Same shape mapContact/mapConversation produce from real
// GHL data, so swapping in a real account changes nothing else.
const DEMO_CONTACTS = [
  { id: 'p1', name: 'Maria Chen', email: 'maria.chen@gmail.com', phone: '(813) 555-0142', tag: 'VIP', dateAdded: '8/2/2026' },
  { id: 'p2', name: 'David Wong', email: 'dwong82@gmail.com', phone: '(813) 555-0198', tag: 'New patient', dateAdded: '9/1/2026' },
  { id: 'p3', name: 'Sam Kim', email: 'samkim.k@yahoo.com', phone: '(813) 555-0221', tag: null, dateAdded: '7/14/2026' },
  { id: 'p4', name: 'Priya Patel', email: 'priya.patel@outlook.com', phone: '(813) 555-0345', tag: 'Inactive 6mo', dateAdded: '3/2/2025' },
  { id: 'p5', name: 'Sarah Martinez', email: 'sarahm22@gmail.com', phone: '(813) 555-0410', tag: 'VIP', dateAdded: '1/9/2024' },
  { id: 'p6', name: 'James Lee', email: 'jlee.dental@gmail.com', phone: '(813) 555-0555', tag: null, dateAdded: '5/30/2025' },
  { id: 'p7', name: 'Patricia Green', email: 'pgreen77@gmail.com', phone: '(813) 555-0678', tag: 'New patient', dateAdded: '9/10/2026' },
  { id: 'p8', name: 'Mike Brown', email: 'mbrown.fl@gmail.com', phone: '(813) 555-0791', tag: 'Payment plan', dateAdded: '6/18/2025' },
  { id: 'p9', name: 'Robert Park', email: 'rpark.dds@gmail.com', phone: '(813) 555-0823', tag: null, dateAdded: '2/2/2026' },
  { id: 'p10', name: 'Jordan Ellis', email: 'jellis99@gmail.com', phone: '(813) 555-0934', tag: 'Inactive 6mo', dateAdded: '11/5/2024' },
];

const DEMO_CONVERSATIONS = [
  {
    id: 'c1', source: 'crm', contactId: 'p1', name: 'Maria Chen', channel: 'SMS', unread: true,
    messages: [
      { sender: 'patient', text: 'Hi, do you have anything open this week for a cleaning?', time: 'Yesterday, 2:00 PM' },
      { sender: 'staff', text: 'Yes! We have Thursday at 2:30pm open — want that?', time: 'Yesterday, 2:22 PM' },
      { sender: 'patient', text: 'Yes, 2:30pm on Thursday works great for me — thank you!', time: 'Today, 9:14 AM' },
    ],
  },
  {
    id: 'c2', source: 'crm', contactId: 'p2', name: 'David Wong', channel: 'SMS', unread: true,
    messages: [
      { sender: 'patient', text: 'Can I get an appointment reminder text instead of email?', time: 'Today, 8:02 AM' },
    ],
  },
  {
    id: 'c3', source: 'crm', contactId: 'p8', name: 'Mike Brown', channel: 'Email', unread: false,
    messages: [
      { sender: 'patient', text: 'My card on file was declined — can you resend the payment link?', time: 'Yesterday, 4:47 PM' },
      { sender: 'staff', text: 'Just resent it to your email on file — let us know if it still fails!', time: 'Yesterday, 5:10 PM' },
    ],
  },
  {
    id: 'c4', source: 'crm', contactId: 'p7', name: 'Patricia Green', channel: 'SMS', unread: false,
    messages: [
      { sender: 'staff', text: 'Reminder: your cleaning is tomorrow at 1:30pm.', time: 'Yesterday, 9:00 AM' },
      { sender: 'patient', text: 'Thanks for the reminder, see you at 1:30!', time: 'Yesterday, 11:20 AM' },
    ],
  },
  {
    id: 'c5', source: 'crm', contactId: 'p10', name: 'Jordan Ellis', channel: 'Email', unread: false,
    messages: [
      { sender: 'staff', text: 'We have a few openings next week if you would like to come back in.', time: 'Sep 12, 1:00 PM' },
      { sender: 'patient', text: 'Still interested but need to check my schedule for next week.', time: 'Sep 12, 3:10 PM' },
    ],
  },
  {
    id: 'c6', source: 'crm', contactId: null, name: 'Unknown Caller', channel: 'Calls', unread: true,
    messages: [
      { sender: 'patient', text: 'Voicemail: "Hi, I saw your ad and wanted to ask about new patient specials."', time: 'Sep 11, 6:45 PM' },
    ],
  },
];

// Small deterministic pool of canned replies to simulate an AI-drafted
// response — same pattern as the AI-draft buttons elsewhere in the app.
const AI_REPLY_SUGGESTIONS = [
  "Thanks for reaching out! I've got that taken care of on our end — let us know if anything changes.",
  "Happy to help with that. I'll follow up shortly once it's set.",
  "Great question — let me check on that and get back to you within the hour.",
  "We'd love to have you back in — I can hold a spot for you this week if you'd like.",
];
function suggestReplyFor(convoId) {
  let hash = 0;
  for (let i = 0; i < convoId.length; i++) hash = (hash * 31 + convoId.charCodeAt(i)) >>> 0;
  return AI_REPLY_SUGGESTIONS[hash % AI_REPLY_SUGGESTIONS.length];
}

// ─── NOTIFICATIONS ─────────────────────────────────────────
const NOTIF_TYPE_META = {
  message: { color: 'brand' },
  recall: { color: 'amber' },
  claim: { color: 'red' },
  review: { color: 'gold' },
  security: { color: 'purple' },
};
const NOTIF_SEED = [
  { id: 'n1', type: 'message', Icon: MessageSquare, textBefore: 'New message from ', patient: 'Maria Chen', time: '18m ago', tab: 'inbox' },
  { id: 'n2', type: 'recall', Icon: RotateCcw, textBefore: '3 patients are overdue for recall', time: '32m ago', tab: 'recall' },
  { id: 'n3', type: 'claim', Icon: AlertTriangle, textBefore: 'Denied claim needs attention — ', patient: 'Robert Park', time: '1h ago', tab: 'billing' },
  { id: 'n4', type: 'review', Icon: Star, textBefore: 'New 5-star review from Sarah M.', time: '2h ago', tab: 'reviews' },
  { id: 'n5', type: 'security', Icon: Lock, textBefore: 'Suspicious login attempt flagged on an unknown device', time: '3h ago', tab: 'activitylog' },
];

// ─── GLOBAL SEARCH MODAL ───────────────────────────────────
function GlobalSearchModal({ open, onClose, contacts, campaigns, query, setQuery, setActiveTab }) {
  const t = useTheme();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const patientResults = q ? (contacts || []).filter(p => p.name.toLowerCase().includes(q)).slice(0, 5) : [];
  const campaignResults = q ? (campaigns || []).filter(c => c.name.toLowerCase().includes(q)).slice(0, 5) : [];
  const quickActions = q ? ALL_TABS.filter(tab => TAB_LABELS[tab].toLowerCase().includes(q)).slice(0, 6) : [];
  const noResults = q && patientResults.length === 0 && campaignResults.length === 0 && quickActions.length === 0;

  function go(tab) { setActiveTab(tab); onClose(); }

  const sectionLabelStyle = { fontSize: '10.5px', fontWeight: '700', color: t.muted, textTransform: 'uppercase', letterSpacing: '.5px', padding: '10px 4px 6px' };
  const rowStyle = { display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 8px', borderRadius: '9px', cursor: 'pointer' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,20,.5)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={e => e.stopPropagation()} className="px-glass" style={{ width: '560px', maxWidth: '92vw', maxHeight: '66vh', borderRadius: '10px', boxShadow: '0 24px 60px rgba(0,0,0,.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 16px', borderBottom: `1px solid ${t.border2}`, flexShrink: 0 }}>
          <Search size={16} color={t.muted} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search patients, campaigns..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', fontFamily: 'inherit', background: 'transparent', color: t.ink2 }}
          />
          <span style={{ fontSize: '10.5px', fontWeight: '600', color: t.muted, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '2px 6px', flexShrink: 0 }}>Esc</span>
        </div>
        <div style={{ overflowY: 'auto', padding: '6px 12px 14px' }}>
          {!q && <div style={{ padding: '30px 10px', textAlign: 'center', color: t.muted, fontSize: '13px' }}>Start typing to search patients, campaigns, or jump to a tab.</div>}
          {noResults && <div style={{ padding: '30px 10px', textAlign: 'center', color: t.muted, fontSize: '13px' }}>No results for "{query}"</div>}

          {patientResults.length > 0 && (
            <div>
              <div style={sectionLabelStyle}>Patients</div>
              {patientResults.map(p => (
                <div key={p.id} className="px-row" onClick={() => go('patients')} style={rowStyle}>
                  <Ava initials={initialsOf(p.name)} bg={t.brandL} color={t.brand} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{p.name}</PII></div>
                    <div style={{ fontSize: '11px', color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><PII>{p.email}</PII></div>
                  </div>
                  <Pill label={p.tag || 'Active'} color={t.brand} bg={t.brandL} />
                </div>
              ))}
            </div>
          )}

          {campaignResults.length > 0 && (
            <div>
              <div style={sectionLabelStyle}>Campaigns</div>
              {campaignResults.map((c, i) => (
                <div key={i} className="px-row" onClick={() => go('campaigns')} style={rowStyle}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Megaphone size={14} color={t.brand} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sub}</div>
                  </div>
                  <Pill label={c.pill} color={t[c.pillColor] || t.brand} bg={t[`${c.pillColor}L`] || t.brandL} />
                </div>
              ))}
            </div>
          )}

          {quickActions.length > 0 && (
            <div>
              <div style={sectionLabelStyle}>Quick actions</div>
              {quickActions.map(tab => (
                <div key={tab} className="px-row" onClick={() => go(tab)} style={rowStyle}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.bgRow, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowRight size={14} color={t.mid} />
                  </div>
                  <div style={{ fontSize: '13px', color: t.ink2 }}>Go to {TAB_LABELS[tab]}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Fetches once on mount (and whenever refetch() is called). Skips the call
// entirely — no spinner, no error — when GHL isn't configured, since that's
// an expected, common state here, not a failure.
function useGhlFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(isGhlConfigured);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isGhlConfigured) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchFn()
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err.message || 'Something went wrong.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  return { data, loading, error, refetch: () => setReloadKey(k => k + 1) };
}

// ─── ROLES & PERMISSIONS ───────────────────────────────────
const ROLES = ['Owner', 'Office Manager', 'Front Desk', 'Biller'];
const EDITABLE_ROLES = ROLES.filter(r => r !== 'Owner');

const ALL_TABS = ['overview', 'inbox', 'campaigns', 'recall', 'calendar', 'appointmentrequests', 'waitlist', 'patients', 'portal', 'eligibility', 'reviews', 'surveys', 'aifrontdesk', 'documents', 'treatmentplans', 'billing', 'membershipplans', 'payments', 'reports', 'activitylog', 'settings'];

const TAB_LABELS = {
  overview: 'Overview', inbox: 'Inbox', campaigns: 'Campaigns', recall: 'Recall', calendar: 'Calendar',
  appointmentrequests: 'Appointment Requests',
  waitlist: 'Waitlist', patients: 'Patients', portal: 'Patient Portal', eligibility: 'Eligibility',
  reviews: 'Reputation Center', surveys: 'Surveys', aifrontdesk: 'AI Front Desk', documents: 'Documents',
  treatmentplans: 'Treatment Plans',
  billing: 'Billing', membershipplans: 'Membership Plans', payments: 'Payments', reports: 'Reports', activitylog: 'Activity Log', settings: 'Settings',
};

function buildPermissions(onTabs) {
  return Object.fromEntries(ALL_TABS.map(tab => [tab, onTabs.includes(tab)]));
}

// Editable by the Owner at runtime via Settings → Team & Permissions. This is only the
// first-load default — the source of truth once the app is running is the rolePermissions
// state in App().
const DEFAULT_ROLE_PERMISSIONS = {
  'Office Manager': buildPermissions(ALL_TABS.filter(tab => tab !== 'billing' && tab !== 'payments')),
  'Front Desk': buildPermissions(['inbox', 'calendar', 'patients', 'eligibility']),
  'Biller': buildPermissions(['billing', 'payments', 'reports']),
};

function isTabVisible(tab, role, rolePermissions) {
  if (role === 'Owner') return true;
  const perms = rolePermissions[role];
  return !!(perms && perms[tab]);
}

function firstVisibleTab(role, rolePermissions) {
  if (role === 'Owner') return 'overview';
  const perms = rolePermissions[role] || {};
  return ALL_TABS.find(tab => perms[tab]) || 'overview';
}

function roleColor(role, t) {
  switch (role) {
    case 'Owner': return { color: t.purple, bg: t.purpleL };
    case 'Office Manager': return { color: t.brand, bg: t.brandL };
    case 'Front Desk': return { color: t.green, bg: t.greenL };
    case 'Biller': return { color: t.amber, bg: t.amberL };
    default: return { color: t.red, bg: t.redL };
  }
}

const MAIN_TABS = ['overview', 'inbox', 'campaigns', 'recall', 'calendar', 'appointmentrequests', 'waitlist'];
const PRACTICE_TABS = ['patients', 'portal', 'eligibility', 'reviews', 'surveys', 'aifrontdesk', 'documents', 'treatmentplans'];
const BILLINGSEC_TABS = ['billing', 'membershipplans', 'payments'];
const ANALYTICS_TABS = ['reports', 'settings', 'activitylog'];

const STAFF_MEMBERS = [
  { id: 'u1', name: 'Dr. Rivera', email: 'drrivera@brightsmiles.com', role: 'Owner', lastLogin: 'Just now', status: 'Active' },
  { id: 'u2', name: 'Nina Torres', email: 'nina@brightsmiles.com', role: 'Office Manager', lastLogin: '2h ago', status: 'Active' },
  { id: 'u3', name: 'Sarah Byrd', email: 'sarah@brightsmiles.com', role: 'Front Desk', lastLogin: 'Yesterday', status: 'Active' },
  { id: 'u4', name: 'James Coleman', email: 'james@brightsmiles.com', role: 'Biller', lastLogin: '3 days ago', status: 'Active' },
];

const ACTION_TYPES = [
  { key: 'All', label: 'All' },
  { key: 'message', label: 'Messages' },
  { key: 'appointment', label: 'Appointments' },
  { key: 'claim', label: 'Billing' },
  { key: 'payment', label: 'Payments' },
  { key: 'login', label: 'Security' },
  { key: 'campaign', label: 'Campaigns' },
  { key: 'record', label: 'Patient records' },
  { key: 'recall', label: 'Recalls' },
];

const ACTIVITY_LOG = [
  { id: 1, ts: '2026-09-15T09:14:00', user: 'Sarah Byrd', role: 'Front Desk', type: 'message', action: 'Sent message to patient', patient: 'Maria Chen', suspicious: false },
  { id: 2, ts: '2026-09-15T09:30:00', user: 'Dr. Rivera', role: 'Owner', type: 'claim', action: 'Submitted claim D2740', patient: 'James Lee', suspicious: false },
  { id: 3, ts: '2026-09-15T10:02:00', user: 'James Coleman', role: 'Biller', type: 'claim', action: 'Resubmitted denied claim', patient: 'Robert Park', suspicious: false },
  { id: 4, ts: '2026-09-15T10:05:00', user: 'Sarah Byrd', role: 'Front Desk', type: 'appointment', action: 'Booked appointment', patient: 'Sarah Malone', suspicious: false },
  { id: 5, ts: '2026-09-15T10:41:00', user: 'Nina Torres', role: 'Office Manager', type: 'record', action: 'Viewed patient record', patient: 'Tom Alvarez', suspicious: false },
  { id: 6, ts: '2026-09-15T11:45:00', user: 'Unknown device', role: 'Unknown', type: 'login', action: 'Login attempt flagged', patient: null, suspicious: true },
  { id: 7, ts: '2026-09-15T12:10:00', user: 'Nina Torres', role: 'Office Manager', type: 'campaign', action: 'Launched "6-month reactivation" campaign', patient: null, suspicious: false },
  { id: 8, ts: '2026-09-15T13:20:00', user: 'James Coleman', role: 'Biller', type: 'payment', action: 'Collected payment of $340', patient: 'Mike Brown', suspicious: false },
  { id: 9, ts: '2026-09-15T14:05:00', user: 'Sarah Byrd', role: 'Front Desk', type: 'recall', action: 'Sent recall reminder', patient: 'Priya Patel', suspicious: false },
  { id: 10, ts: '2026-09-15T14:48:00', user: 'Nina Torres', role: 'Office Manager', type: 'appointment', action: 'Rescheduled appointment', patient: 'David Wong', suspicious: false },
  { id: 11, ts: '2026-09-14T16:12:00', user: 'Dr. Rivera', role: 'Owner', type: 'login', action: 'Logged in', patient: null, suspicious: false },
  { id: 12, ts: '2026-09-14T15:03:00', user: 'James Coleman', role: 'Biller', type: 'claim', action: 'Submitted claim', patient: 'Angela Ruiz', suspicious: false },
  { id: 13, ts: '2026-09-14T11:30:00', user: 'Sarah Byrd', role: 'Front Desk', type: 'record', action: 'Viewed patient record', patient: 'Jordan Ellis', suspicious: false },
  { id: 14, ts: '2026-09-14T09:55:00', user: 'Nina Torres', role: 'Office Manager', type: 'payment', action: 'Collected payment of $1,200', patient: 'James Lee', suspicious: false },
  { id: 15, ts: '2026-09-13T14:22:00', user: 'Sarah Byrd', role: 'Front Desk', type: 'message', action: 'Sent message to patient', patient: 'Maria Chen', suspicious: false },
  { id: 16, ts: '2026-09-13T10:15:00', user: 'Dr. Rivera', role: 'Owner', type: 'campaign', action: 'Launched "Post-visit review request" campaign', patient: null, suspicious: false },
  { id: 17, ts: '2026-09-13T08:00:00', user: 'Dr. Rivera', role: 'Owner', type: 'login', action: 'Logged in', patient: null, suspicious: false },
];

function App() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [mode, setMode] = useState(getInitialMode);
  const [brandColor, setBrandColor] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem('praxismd-brand-color')) || DEFAULT_BRAND);
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('praxismd-sidebar-collapsed') === '1');
  const [sidebarHover, setSidebarHover] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifReadIds, setNotifReadIds] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [userRole, setUserRole] = useState('Owner');
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(getInitialPrivacyMode);
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [appBannerDismissed, setAppBannerDismissed] = useState(() => typeof window !== 'undefined' && window.sessionStorage.getItem('praxismd-app-banner-dismissed') === '1');
  const [idleWarningOpen, setIdleWarningOpen] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);
  const lastActivityRef = useRef(Date.now());
  const idleWarningOpenRef = useRef(false);
  const ownerDisplayName = profile?.ownerName || (profile?.email ? profile.email.split('@')[0] : 'Owner');
  const practiceDisplayName = profile?.practiceName || 'Your Practice';
  const currentUser = { name: ownerDisplayName, role: userRole };

  function updateRolePermissions(role, perms) {
    setRolePermissions(rp => ({ ...rp, [role]: perms }));
  }
  const t = getTheme(mode, brandColor);
  const showFull = isMobileView ? true : (!collapsed || sidebarHover);
  const suppressHoverRef = useRef(false);

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c;
      window.localStorage.setItem('praxismd-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
    setSidebarHover(false);
    suppressHoverRef.current = true;
    window.setTimeout(() => { suppressHoverRef.current = false; }, 400);
  }

  function navigateTo(tab) {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
  }

  function dismissAppBanner() {
    setAppBannerDismissed(true);
    window.sessionStorage.setItem('praxismd-app-banner-dismissed', '1');
  }

  async function handleLogout() {
    if (isFirebaseConfigured) {
      try { await signOut(auth); } catch { /* fall through to redirect regardless */ }
    }
    navigate('/login');
  }

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem('praxismd-theme', mode);
    document.body.style.background = t.bgPage;
    document.body.style.colorScheme = mode;
  }, [mode, t.bgPage]);

  useEffect(() => {
    window.localStorage.setItem('praxismd-brand-color', brandColor);
  }, [brandColor]);

  useEffect(() => {
    window.localStorage.setItem('praxismd-privacy', privacyMode ? 'on' : 'off');
  }, [privacyMode]);

  function staySignedIn() {
    lastActivityRef.current = Date.now();
    idleWarningOpenRef.current = false;
    setIdleWarningOpen(false);
    setIdleCountdown(60);
  }

  useEffect(() => {
    const IDLE_WARNING_MS = 14 * 60 * 1000;
    const IDLE_LOGOUT_MS = 15 * 60 * 1000;

    function resetActivity() {
      if (idleWarningOpenRef.current) return;
      lastActivityRef.current = Date.now();
    }
    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);

    const tick = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_LOGOUT_MS) {
        idleWarningOpenRef.current = false;
        setIdleWarningOpen(false);
        handleLogout();
      } else if (elapsed >= IDLE_WARNING_MS) {
        idleWarningOpenRef.current = true;
        setIdleWarningOpen(true);
        setIdleCountdown(Math.max(0, Math.ceil((IDLE_LOGOUT_MS - elapsed) / 1000)));
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
      window.clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) { setUserMenuOpen(false); setSwitchOpen(false); }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function onResize() { setIsMobileView(window.innerWidth < 768); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isTabVisible(activeTab, userRole, rolePermissions)) setActiveTab(firstVisibleTab(userRole, rolePermissions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, rolePermissions]);

  useEffect(() => {
    if (!isFirebaseConfigured) { setAuthChecked(true); return; }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate('/login'); return; }
      try {
        const snap = await getDoc(doc(db, 'practices', user.uid));
        setProfile(snap.exists() ? { email: user.email, ...snap.data() } : { email: user.email });
      } finally {
        setAuthChecked(true);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: contactsData, loading: contactsLoading, error: contactsError, refetch: refetchContacts } = useGhlFetch(getContacts);
  const [demoContacts, setDemoContacts] = useState(DEMO_CONTACTS);
  const contacts = isGhlConfigured ? (contactsData || []).map(mapContact) : demoContacts;

  const { data: campaignsData, loading: campaignsLoading, error: campaignsError, refetch: refetchCampaigns } = useGhlFetch(getCampaigns);
  const ghlCampaigns = isGhlConfigured ? (campaignsData || []).map(mapCampaign) : null;

  function addDemoPatient(patient) {
    setDemoContacts(cs => [{ id: `p-new-${Date.now()}`, tag: null, dateAdded: new Date().toLocaleDateString(), ...patient }, ...cs]);
  }

  const notifColorMap = { brand: t.brand, amber: t.amber, red: t.red, orange: t.orange, gold: t.gold, purple: t.purple };
  const notifBgMap = { brand: t.brandL, amber: t.amberL, red: t.redL, orange: t.orangeL, gold: t.goldL, purple: t.purpleL };
  const notifications = NOTIF_SEED.map(n => ({
    ...n,
    color: notifColorMap[NOTIF_TYPE_META[n.type].color],
    bg: notifBgMap[NOTIF_TYPE_META[n.type].color],
    read: notifReadIds.includes(n.id),
  }));
  const unreadNotifCount = notifications.filter(n => !n.read).length;

  function markAllNotifsRead() {
    setNotifReadIds(NOTIF_SEED.map(n => n.id));
  }

  function openNotif(n) {
    setNotifReadIds(ids => ids.includes(n.id) ? ids : [...ids, n.id]);
    setActiveTab(n.tab);
    setNotifOpen(false);
  }

  function gate(tab, element) {
    if (activeTab !== tab) return null;
    return isTabVisible(tab, userRole, rolePermissions) ? element : <AccessRestricted tab={tab} />;
  }

  if (!isFirebaseConfigured) {
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: t.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', textDecoration: 'none', marginBottom: '26px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px' }}>Px</div>
            <span style={{ fontSize: '19px', fontWeight: '700', color: t.ink }}>PraxisMD</span>
          </Link>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,.06)', textAlign: 'center' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: t.amberL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={20} color={t.amber} />
            </div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: t.ink, marginBottom: '8px' }}>Firebase isn't configured yet</div>
            <div style={{ fontSize: '13px', color: t.mid, lineHeight: '1.6' }}>
              The staff dashboard needs a signed-in user. Set up your Firebase project (see <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>.env.example</code>) and sign in first.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: t.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={22} color={t.brand} className="px-spin" />
        <style>{`@keyframes pxSpin { to { transform: rotate(360deg); } } .px-spin { animation: pxSpin .7s linear infinite; }`}</style>
      </div>
    );
  }

  return (
    <PrivacyContext.Provider value={privacyMode}>
    <ThemeContext.Provider value={t}>
    <style>{`
      @keyframes pxFadeSlide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .px-page-transition { animation: pxFadeSlide .18s ease; will-change: opacity, transform; }
      .px-navitem { transition: background .12s ease, border-color .12s ease, color .12s ease; }
      .px-navitem:hover { background: ${t.navHover}; }
      .px-row { transition: background .12s ease; }
      .px-row:hover { background: ${t.rowHover}; }
      .px-card { transition: border-color .15s ease; }
      .px-glass {
        background: ${t.glassBg};
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        border: 1px solid ${t.glassBorder};
        box-shadow: ${t.glassShadow};
      }
      .px-sidebar-glass { background: ${t.sidebarGlassBg}; }
      .px-topbar-glass { background: ${t.topbarGlassBg}; }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        .px-glass { background: ${t.bgCard}; }
        .px-sidebar-glass { background: ${t.bgSidebar}; }
        .px-topbar-glass { background: ${t.bgSidebar}; }
      }
      .px-btn-ghost:hover { text-decoration: underline; }
      button { transition: transform .08s ease; }
      button:active { transform: scale(0.97); }
      .px-tooltip-wrap { position: relative; }
      .px-tooltip-bubble {
        position: absolute; left: 100%; top: 50%; transform: translateY(-50%);
        margin-left: 12px; background: ${t.ink}; color: ${t.bgCard}; font-size: 11px;
        font-weight: 500; padding: 6px 10px; border-radius: 5px; white-space: nowrap;
        opacity: 0; pointer-events: none; transition: opacity .12s ease; z-index: 200;
      }
      .px-tooltip-wrap:hover .px-tooltip-bubble { opacity: 1; }
      input:focus, select:focus { outline: 2px solid ${withAlpha(t.teal, .35)}; }
      body { line-height: 1.6; }
      @keyframes pxSpin { to { transform: rotate(360deg); } }
      .px-spin { animation: pxSpin .7s linear infinite; }
      @keyframes pxSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes pxFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .px-panel-backdrop { animation: pxFadeIn .15s ease; }
      .px-panel { animation: pxSlideIn .2s ease; }
      @keyframes pxExpand { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      .px-expand { animation: pxExpand .15s ease; }
      @media (max-width: 767px) {
        [style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
        table { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
      }
    `}</style>
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* SIDEBAR */}
      {isMobileView && mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="px-panel-backdrop"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 90 }}
        />
      )}
      <div
        onMouseEnter={() => { if (!isMobileView && !suppressHoverRef.current) setSidebarHover(true); }}
        onMouseLeave={() => setSidebarHover(false)}
        className="px-sidebar-glass"
        style={{
          width: isMobileView ? '232px' : (showFull ? '232px' : '64px'),
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRight: `1px solid ${t.sidebarGlassBorder}`,
          display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', overflow: 'hidden',
          zIndex: isMobileView ? 100 : (collapsed && sidebarHover ? 60 : 40),
          boxShadow: isMobileView ? (mobileDrawerOpen ? '4px 0 24px rgba(0,0,0,.25)' : 'none') : (collapsed && sidebarHover ? '4px 0 24px rgba(0,0,0,.18)' : 'none'),
          transform: isMobileView ? (mobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'width .18s ease, box-shadow .18s ease, transform .2s ease',
        }}
      >
        <div style={{ padding: showFull ? '20px 20px 16px' : '18px 0 14px', borderBottom: `1px solid ${t.border2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: showFull ? 'space-between' : 'center', padding: showFull ? 0 : '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>Px</div>
              {showFull && <span style={{ fontSize: '19px', fontWeight: '700', color: t.ink, whiteSpace: 'nowrap' }}>PraxisMD</span>}
            </div>
            {showFull && (
              <button onClick={toggleCollapsed} title="Collapse sidebar" style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: '8px' }}>
                <Menu size={17} />
              </button>
            )}
          </div>
          {showFull && <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '6px' }}>{practiceDisplayName}</div>}
          {!showFull && (
            <button onClick={toggleCollapsed} title="Expand sidebar" style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '12px', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', padding: '4px 0' }}>
              <Menu size={16} />
            </button>
          )}
        </div>

        <nav style={{ padding: showFull ? '8px 12px' : '8px 8px', flex: 1, overflowY: 'auto' }}>
          {MAIN_TABS.some(tb => isTabVisible(tb, userRole, rolePermissions)) && <NavSection label="Main" collapsed={!showFull} />}
          {isTabVisible('overview', userRole, rolePermissions) && <NavItem label="Overview" Icon={LayoutDashboard} tab="overview" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('inbox', userRole, rolePermissions) && <NavItem label="Inbox" Icon={InboxIcon} tab="inbox" active={activeTab} onClick={navigateTo} badge="4" badgeColor={t.red} collapsed={!showFull} />}
          {isTabVisible('campaigns', userRole, rolePermissions) && <NavItem label="Campaigns" Icon={Megaphone} tab="campaigns" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('recall', userRole, rolePermissions) && <NavItem label="Recall" Icon={RotateCcw} tab="recall" active={activeTab} onClick={navigateTo} badge="89" badgeColor={t.amber} collapsed={!showFull} />}
          {isTabVisible('calendar', userRole, rolePermissions) && <NavItem label="Calendar" Icon={CalendarIcon} tab="calendar" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('appointmentrequests', userRole, rolePermissions) && <NavItem label="Appointment Requests" Icon={CalendarPlus} tab="appointmentrequests" active={activeTab} onClick={navigateTo} badge={String(APPOINTMENT_REQUESTS_SEED.filter(r => r.status === 'pending').length)} badgeColor={t.amber} collapsed={!showFull} />}
          {isTabVisible('waitlist', userRole, rolePermissions) && <NavItem label="Waitlist" Icon={ClipboardList} tab="waitlist" active={activeTab} onClick={navigateTo} badge="12" badgeColor={t.teal} collapsed={!showFull} />}
          {PRACTICE_TABS.some(tb => isTabVisible(tb, userRole, rolePermissions)) && <NavSection label="Practice" collapsed={!showFull} />}
          {isTabVisible('patients', userRole, rolePermissions) && <NavItem label="Patients" Icon={Users} tab="patients" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('portal', userRole, rolePermissions) && <NavItem label="Patient Portal" Icon={Contact} tab="portal" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('eligibility', userRole, rolePermissions) && <NavItem label="Eligibility" Icon={Shield} tab="eligibility" active={activeTab} onClick={navigateTo} badge="3" badgeColor={t.amber} collapsed={!showFull} />}
          {isTabVisible('reviews', userRole, rolePermissions) && <NavItem label="Reputation Center" Icon={Award} tab="reviews" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('surveys', userRole, rolePermissions) && <NavItem label="Surveys" Icon={Smile} tab="surveys" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('aifrontdesk', userRole, rolePermissions) && <NavItem label="AI Front Desk" Icon={Bot} tab="aifrontdesk" active={activeTab} onClick={navigateTo} badge="Live" badgeColor={t.purple} collapsed={!showFull} />}
          {isTabVisible('documents', userRole, rolePermissions) && <NavItem label="Documents" Icon={FileArchive} tab="documents" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('treatmentplans', userRole, rolePermissions) && <NavItem label="Treatment Plans" Icon={ClipboardList} tab="treatmentplans" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {BILLINGSEC_TABS.some(tb => isTabVisible(tb, userRole, rolePermissions)) && <NavSection label="Billing" collapsed={!showFull} />}
          {isTabVisible('billing', userRole, rolePermissions) && <NavItem label="Billing" Icon={Receipt} tab="billing" active={activeTab} onClick={navigateTo} badge="Pro" badgeColor={t.purple} collapsed={!showFull} />}
          {isTabVisible('membershipplans', userRole, rolePermissions) && <NavItem label="Membership Plans" Icon={BadgeCheck} tab="membershipplans" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('payments', userRole, rolePermissions) && <NavItem label="Payments" Icon={CreditCard} tab="payments" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {ANALYTICS_TABS.some(tb => isTabVisible(tb, userRole, rolePermissions)) && <NavSection label="Analytics" collapsed={!showFull} />}
          {isTabVisible('reports', userRole, rolePermissions) && <NavItem label="Reports" Icon={TrendingUp} tab="reports" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('activitylog', userRole, rolePermissions) && <NavItem label="Activity Log" Icon={Activity} tab="activitylog" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
          {isTabVisible('settings', userRole, rolePermissions) && <NavItem label="Settings" Icon={SettingsIcon} tab="settings" active={activeTab} onClick={navigateTo} collapsed={!showFull} />}
        </nav>

        <div style={{ padding: showFull ? '12px 16px' : '12px 0', borderTop: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', justifyContent: showFull ? 'space-between' : 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '6px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: t.brand, flexShrink: 0 }}>{initialsOf(ownerDisplayName)}</div>
            {showFull && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{ownerDisplayName}</div>
                <div style={{ fontSize: '11px', color: t.muted }}>{userRole}</div>
              </div>
            )}
          </div>
          {showFull && (
            <button onClick={handleLogout} title="Log out" style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: '8px', flexShrink: 0 }}>
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginLeft: isMobileView ? 0 : (collapsed ? '64px' : '232px'), flex: 1, display: 'flex', flexDirection: 'column', background: t.pageGradient, minHeight: '100vh', transition: 'margin-left .2s ease' }}>

        {!appBannerDismissed && isMobileView && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: t.brand, color: 'white' }}>
            <Smartphone size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12.5px', fontWeight: '500' }}>PraxisMD works best on desktop. Mobile app coming soon.</span>
            <button
              type="button"
              onClick={dismissAppBanner}
              aria-label="Dismiss"
              style={{ border: 'none', background: 'rgba(255,255,255,.2)', color: 'white', width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* TOPBAR */}
        <div className="px-topbar-glass" style={{ height: '64px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${t.topbarGlassBorder}`, display: 'flex', alignItems: 'center', gap: '24px', padding: '0 26px', position: 'sticky', top: 0, zIndex: 50 }}>
          {isMobileView && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open menu"
              style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgCard, cursor: 'pointer', color: t.mid, flexShrink: 0 }}
            >
              <Menu size={17} />
            </button>
          )}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: t.ink }}>{getPageTitle(activeTab, ownerDisplayName)}</div>
            <div style={{ fontSize: '12px', color: t.muted, marginTop: '2px' }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {practiceDisplayName}</div>
          </div>

          {!isMobileView && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '240px', padding: '8px 10px 8px 12px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgCard, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Search size={15} color={t.muted} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Search patients, campaigns...</span>
              <span style={{ fontSize: '10.5px', fontWeight: '600', color: t.muted, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '1px 5px', flexShrink: 0 }}>Ctrl K</span>
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexShrink: 0, overflowX: isMobileView ? 'auto' : 'visible', maxWidth: isMobileView ? '52vw' : 'none' }}>
            <button
              onClick={() => setPrivacyMode(p => !p)}
              aria-label="Toggle privacy mode"
              title={privacyMode ? 'Privacy mode on — click to show patient info' : 'Blur patient names, emails, and phone numbers'}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 13px', borderRadius: '6px', border: `1px solid ${privacyMode ? t.red : t.border}`, background: privacyMode ? t.redL : t.bgCard, cursor: 'pointer', color: privacyMode ? t.red : t.mid, fontSize: '12.5px', fontWeight: '500', fontFamily: 'inherit' }}
            >
              <EyeOff size={15} /> {privacyMode && 'Privacy on'}
            </button>
            <button
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle dark mode"
              title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgCard, cursor: 'pointer', color: t.mid }}
            >
              {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => setNotifOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 15px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgCard, fontSize: '13px', cursor: 'pointer', color: t.mid, position: 'relative' }}>
                <Bell size={15} />
                Notifications
                {unreadNotifCount > 0 && (
                  <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '17px', height: '17px', padding: '0 4px', borderRadius: '9px', background: t.red, color: 'white', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadNotifCount}</span>
                )}
              </button>
              {notifOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '320px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,.18)', overflow: 'hidden', zIndex: 100 }}>
                  <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: t.ink }}>Notifications</span>
                    {unreadNotifCount > 0 && (
                      <button onClick={markAllNotifsRead} style={{ border: 'none', background: 'transparent', color: t.brand, fontSize: '11.5px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>Mark all read</button>
                    )}
                  </div>
                  {notifications.map((n, i) => (
                    <div key={n.id} className="px-row" onClick={() => openNotif(n)} style={{ display: 'flex', gap: '10px', padding: '11px 14px', borderBottom: `1px solid ${t.border2}`, cursor: 'pointer', background: n.read ? 'transparent' : t.bgRow }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: n.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <n.Icon size={14} color={n.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', color: t.ink2, fontWeight: n.read ? '400' : '600' }}>{n.textBefore}{n.patient && <PII>{n.patient}</PII>}</div>
                        <div style={{ fontSize: '11px', color: t.muted, marginTop: '2px' }}>{n.time}</div>
                      </div>
                      {!n.read && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: t.brand, flexShrink: 0, marginTop: '4px' }} />}
                    </div>
                  ))}
                  <button onClick={() => { setActiveTab('activitylog'); setNotifOpen(false); }} style={{ display: 'block', width: '100%', padding: '11px 14px', border: 'none', background: 'transparent', color: t.brand, fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>View all notifications</button>
                </div>
              )}
            </div>

            <button onClick={() => setActiveTab('campaigns')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 15px', borderRadius: '6px', border: 'none', background: t.brand, color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              <Plus size={14} /> New campaign
            </button>

            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setUserMenuOpen(o => !o); setSwitchOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px 5px 5px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgCard, cursor: 'pointer' }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: t.brand, flexShrink: 0 }}>{initialsOf(currentUser.name)}</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: '600', color: t.ink2, lineHeight: 1.25 }}>{currentUser.name}</div>
                  <span style={{ fontSize: '9.5px', fontWeight: '600', padding: '1px 7px', borderRadius: '4px', display: 'inline-block', marginTop: '2px', background: roleColor(currentUser.role, t).bg, color: roleColor(currentUser.role, t).color }}>{currentUser.role}</span>
                </div>
                <ChevronDown size={14} color={t.muted} />
              </button>
              {userMenuOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,.18)', overflow: 'hidden', zIndex: 100 }}>
                  {!switchOpen ? (
                    <>
                      <button onClick={() => setSwitchOpen(true)} className="px-row" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: `1px solid ${t.border2}`, background: 'transparent', fontSize: '13px', color: t.ink2, cursor: 'pointer', fontFamily: 'inherit' }}>Switch account</button>
                      <button onClick={() => { setActiveTab('settings'); setUserMenuOpen(false); }} className="px-row" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: `1px solid ${t.border2}`, background: 'transparent', fontSize: '13px', color: t.ink2, cursor: 'pointer', fontFamily: 'inherit' }}>My profile</button>
                      <button onClick={handleLogout} className="px-row" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: '13px', color: t.red, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
                    </>
                  ) : (
                    ROLES.map((r, i) => (
                      <button
                        key={r}
                        onClick={() => { setUserRole(r); setSwitchOpen(false); setUserMenuOpen(false); }}
                        className="px-row"
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: i < ROLES.length - 1 ? `1px solid ${t.border2}` : 'none', background: 'transparent', fontSize: '13px', fontWeight: r === userRole ? '600' : '400', color: r === userRole ? t.teal : t.ink2, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {r}{r === userRole ? ' ✓' : ''}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div key={activeTab} className="px-page-transition" style={{ padding: '22px 26px', flex: 1 }}>
          {gate('overview', <Overview setActiveTab={setActiveTab} userRole={userRole} />)}
          {gate('inbox', <Inbox contacts={contacts} userRole={userRole} />)}
          {gate('campaigns', <Campaigns userRole={userRole} ghlCampaigns={ghlCampaigns} loading={campaignsLoading} error={campaignsError} onRetry={refetchCampaigns} />)}
          {gate('recall', <Recall userRole={userRole} />)}
          {gate('patients', <Patients query={patientQuery} onQueryChange={setPatientQuery} contacts={contacts} loading={contactsLoading} error={contactsError} onRetry={refetchContacts} onAddPatient={isGhlConfigured ? null : addDemoPatient} userRole={userRole} />)}
          {gate('billing', <Billing userRole={userRole} />)}
          {gate('membershipplans', <MembershipPlans userRole={userRole} />)}
          {gate('payments', <Payments userRole={userRole} contacts={contacts} />)}
          {gate('reports', <Reports userRole={userRole} />)}
          {gate('settings', <Settings userRole={userRole} rolePermissions={rolePermissions} onUpdatePermissions={updateRolePermissions} onRoleChange={setUserRole} brandColor={brandColor} onBrandColorChange={setBrandColor} />)}
          {gate('activitylog', <ActivityLog userRole={userRole} />)}
          {gate('aifrontdesk', <AIFrontDesk userRole={userRole} />)}
          {gate('reviews', <ReputationCenter userRole={userRole} />)}
          {gate('surveys', <Surveys userRole={userRole} />)}
          {gate('eligibility', <Eligibility userRole={userRole} />)}
          {gate('portal', <Portal userRole={userRole} />)}
          {gate('documents', <Documents contacts={contacts} userRole={userRole} />)}
          {gate('treatmentplans', <TreatmentPlans contacts={contacts} userRole={userRole} />)}
          {gate('waitlist', <Waitlist userRole={userRole} />)}
          {gate('calendar', <Calendar userRole={userRole} />)}
          {gate('appointmentrequests', <AppointmentRequests userRole={userRole} />)}
        </div>
      </div>

      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        contacts={contacts}
        campaigns={isGhlConfigured ? (ghlCampaigns || []) : CAMPAIGNS_DATA}
        query={patientQuery}
        setQuery={setPatientQuery}
        setActiveTab={setActiveTab}
      />
      {idleWarningOpen && (
        <Modal title="Still there?" onClose={staySignedIn}>
          <div style={{ fontSize: '13px', color: t.mid, lineHeight: '1.6', marginBottom: '16px' }}>
            For your security, you'll be signed out in <strong style={{ color: t.red }}>{idleCountdown}s</strong> due to inactivity.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Btn primary onClick={staySignedIn}>Stay signed in</Btn>
            <Btn onClick={handleLogout}>Sign out now</Btn>
          </div>
        </Modal>
      )}
    </div>
    </ThemeContext.Provider>
    </PrivacyContext.Provider>
  );
}

// ─── HELPERS ───────────────────────────────────────────────
function getPageTitle(tab, ownerName) {
  const titles = {
    overview: `Good morning, ${ownerName || 'there'}`,
    inbox: 'Inbox',
    campaigns: 'Campaigns',
    recall: 'Recall & Scheduling',
    calendar: 'Calendar',
    appointmentrequests: 'Appointment Requests',
    treatmentplans: 'Treatment Plans',
    waitlist: 'Smart Waitlist',
    patients: 'Patients',
    portal: 'Patient Portal',
    eligibility: 'Insurance Eligibility',
    reviews: 'Reputation Center',
    surveys: 'Patient Satisfaction',
    aifrontdesk: 'AI Front Desk',
    documents: 'Documents',
    billing: 'Billing Automation',
    payments: 'Payments & Plans',
    membershipplans: 'Membership Plans',
    reports: 'Reports',
    settings: 'Settings',
    activitylog: 'Activity Log',
  };
  return titles[tab] || tab;
}

// ─── NAV COMPONENTS ────────────────────────────────────────
function NavSection({ label, collapsed }) {
  const t = useTheme();
  if (collapsed) return <div style={{ height: '1px', background: t.border2, margin: '10px 10px' }} />;
  return <div style={{ fontSize: '10px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '14px 10px 6px' }}>{label}</div>;
}

function NavItem({ label, Icon, tab, active, onClick, badge, badgeColor, collapsed }) {
  const t = useTheme();
  const isActive = active === tab;
  return (
    <div
      className="px-navitem px-tooltip-wrap"
      onClick={() => onClick(tab)}
      style={{
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : '10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '8px 11px',
        borderRadius: '4px', marginBottom: '1px',
        borderLeft: `2px solid ${isActive ? t.brand : 'transparent'}`,
        background: 'transparent',
        color: isActive ? t.brand : t.muted,
        cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? '600' : '400',
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
      {!collapsed && badge && <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '4px', background: badgeColor + '22', color: badgeColor }}>{badge}</span>}
      {collapsed && <span className="px-tooltip-bubble">{label}{badge ? ` · ${badge}` : ''}</span>}
    </div>
  );
}

function StatCard({ label, value, color, accent, sub, icon: ValueIcon, decorIcon: DecorIcon }) {
  const t = useTheme();
  const display = useCountUp(value);
  return (
    <div className="px-card px-glass" style={{ borderRadius: '8px', padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      {DecorIcon && <DecorIcon size={20} color={accent || color} style={{ position: 'absolute', top: '12px', right: '12px', opacity: 0.15 }} />}
      <div style={{ fontSize: '10px', color: t.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: '700', color, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {display}{ValueIcon && <ValueIcon size={18} color={color} fill={color} />}
      </div>
      <div style={{ fontSize: '11px', color: t.muted, marginTop: '6px', lineHeight: 1.6 }}>{sub}</div>
    </div>
  );
}

function Card({ children, style, onClick, className }) {
  return <div className={className ? `px-card px-glass ${className}` : 'px-card px-glass'} onClick={onClick} style={{ borderRadius: '8px', padding: '16px', ...style }}>{children}</div>;
}

function CardTitle({ children }) {
  const t = useTheme();
  return <div style={{ fontSize: '13px', fontWeight: '600', color: t.ink2, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{children}</div>;
}

function Pill({ label, color, bg }) {
  return <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '4px', background: bg, color, whiteSpace: 'nowrap' }}>{label}</span>;
}

function RowItem({ children, style, onClick }) {
  const t = useTheme();
  return <div className="px-row" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', borderRadius: 0, background: 'transparent', borderBottom: `1px solid ${t.rowBorder}`, ...style }}>{children}</div>;
}

function Ava({ initials, bg, color }) {
  return <div style={{ width: '34px', height: '34px', minWidth: '34px', borderRadius: '6px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>{initials}</div>;
}

function Btn({ children, onClick, primary, small, ghost, danger, style, disabled }) {
  const t = useTheme();
  let variant;
  if (ghost) variant = { border: 'none', background: 'transparent', color: t.brand, padding: 0 };
  else if (danger) variant = { border: `1px solid ${t.red}`, background: 'transparent', color: t.red };
  else if (primary) variant = { border: 'none', background: t.brand, color: 'white' };
  else variant = { border: `1px solid ${t.secondaryBorder}`, background: 'transparent', color: t.mid };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={ghost ? 'px-btn-ghost' : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: ghost ? 0 : (small ? '5px 10px' : '7px 14px'),
        borderRadius: '6px', fontSize: small ? '12px' : '13px', fontWeight: '500',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .65 : 1,
        ...variant, ...style,
      }}
    >{children}</button>
  );
}

function StarRating({ rating, size = 14 }) {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} color={i <= rating ? t.accentAmber : t.border} fill={i <= rating ? t.accentAmber : 'none'} />
      ))}
    </div>
  );
}

// ─── GHL DATA STATES ───────────────────────────────────────
function LoadingState({ label }) {
  const t = useTheme();
  return (
    <Card style={{ textAlign: 'center', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <Loader2 size={20} color={t.brand} className="px-spin" />
      <div style={{ fontSize: '13px', color: t.mid }}>{label}</div>
    </Card>
  );
}

function ErrorState({ message, onRetry }) {
  const t = useTheme();
  return (
    <Card style={{ textAlign: 'center', padding: '32px 24px' }}>
      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: t.redL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <AlertTriangle size={20} color={t.red} />
      </div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink, marginBottom: '6px' }}>Couldn't load data</div>
      <div style={{ fontSize: '12.5px', color: t.mid, marginBottom: '16px' }}>{message}</div>
      {onRetry && <Btn small onClick={onRetry}>Try again</Btn>}
    </Card>
  );
}

function SlidePanel({ title, subtitle, onClose, children }) {
  const t = useTheme();
  return (
    <>
      <div onClick={onClose} className="px-panel-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200 }} />
      <div className="px-panel px-glass" style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: '420px', maxWidth: '92vw', borderLeft: `1px solid ${t.glassBorder}`, boxShadow: '-8px 0 30px rgba(0,0,0,.18)', zIndex: 201, overflowY: 'auto' }}>
        <div className="px-glass" style={{ padding: '16px 20px', borderBottom: `1px solid ${t.rowBorder}`, borderLeft: 'none', borderRight: 'none', borderTop: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink }}>{title}</div>
            {subtitle && <div style={{ fontSize: '12px', color: t.muted, marginTop: '2px' }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: '6px', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '16px 20px' }}>{children}</div>
      </div>
    </>
  );
}

function DetailRow({ label, value }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '13.5px', color: t.ink2 }}>{value || '—'}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  const t = useTheme();
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{ width: '38px', height: '22px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: checked ? t.brand : t.border, position: 'relative', flexShrink: 0, padding: 0 }}
    >
      <span style={{ position: 'absolute', top: '2px', left: checked ? '18px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left .15s ease', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </button>
  );
}

function Modal({ title, onClose, children }) {
  const t = useTheme();
  return (
    <>
      <div onClick={onClose} className="px-panel-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 300 }} />
      <div className="px-expand px-glass" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '420px', maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto', borderRadius: '10px', border: `1px solid ${t.glassBorder}`, boxShadow: '0 20px 60px rgba(0,0,0,.25)', zIndex: 301 }}>
        <div className="px-glass" style={{ padding: '16px 20px', borderBottom: `1px solid ${t.rowBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink }}>{title}</div>
          <button onClick={onClose} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: '6px' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '16px 20px' }}>{children}</div>
      </div>
    </>
  );
}

function AccessRestricted({ tab }) {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '90px 24px', textAlign: 'center' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: t.redL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
        <Lock size={24} color={t.red} />
      </div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: t.ink, marginBottom: '6px' }}>Access restricted</div>
      <div style={{ fontSize: '13px', color: t.muted, maxWidth: '360px' }}>Your role doesn't have permission to view {TAB_LABELS[tab] || 'this page'}. Ask an Owner to update your permissions in Settings.</div>
    </div>
  );
}

// ─── OVERVIEW ──────────────────────────────────────────────
function BigStatCard({ label, value, color, accent, sub, icon: ValueIcon, decorIcon: DecorIcon }) {
  const t = useTheme();
  const display = useCountUp(value);
  return (
    <div className="px-card px-glass" style={{ borderRadius: '8px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      {DecorIcon && <DecorIcon size={20} color={accent || color} style={{ position: 'absolute', top: '18px', right: '18px', opacity: 0.15 }} />}
      <div style={{ fontSize: '10px', color: t.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>{label}</div>
      <div style={{ fontSize: '30px', fontWeight: '700', color, letterSpacing: '-0.8px', display: 'flex', alignItems: 'center', gap: '9px' }}>
        {display}{ValueIcon && <ValueIcon size={22} color={color} fill={color} />}
      </div>
      <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '9px', lineHeight: 1.6 }}>{sub}</div>
    </div>
  );
}

const GLANCE_CHIPS = [
  { text: '3 patients overdue for recall', tab: 'recall', color: 'amber' },
  { text: '1 denied claim needs attention', tab: 'billing', color: 'red' },
  { text: '4 appointments confirmed today', tab: 'calendar', color: 'green' },
];

const QUICK_ACTIONS = [
  { label: 'New campaign', Icon: Megaphone, tab: 'campaigns', color: 'brand' },
  { label: 'Send recall', Icon: RotateCcw, tab: 'recall', color: 'teal' },
  { label: 'Request payment', Icon: CreditCard, tab: 'payments', color: 'green' },
  { label: 'View reports', Icon: TrendingUp, tab: 'reports', color: 'purple' },
];

const TODAY_SCHEDULE = [
  { time: '9:00 AM', name: 'Sarah Martinez', procedure: 'Cleaning · 60 min', status: 'Confirmed', color: 'green' },
  { time: '10:30 AM', name: 'James Lee', procedure: 'Crown fitting · 90 min', status: 'Pending', color: 'amber' },
  { time: '2:00 PM', name: 'Amy Kim', procedure: 'Whitening · 45 min', status: 'Confirmed', color: 'green' },
  { time: '4:00 PM', name: 'Robert Park', procedure: 'Emergency · tooth pain', status: 'Urgent', color: 'red' },
];

const OVERVIEW_MESSAGES = [
  { name: 'Maria Chen', msg: "Yes I'd like to book the cleaning for next week", time: '2m ago' },
  { name: 'David Wong', msg: 'Can I reschedule my 3pm appointment?', time: '18m ago' },
  { name: 'Unknown Caller', msg: 'Hi, I saw your ad and wanted to ask about new patient specials.', time: '2h ago' },
];

function Overview({ setActiveTab }) {
  const t = useTheme();
  const colorMap = { brand: t.brand, teal: t.teal, green: t.green, purple: t.purple, amber: t.amber, red: t.red };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '18px' }}>
        <BigStatCard label="Revenue recovered" value="$8,400" color={t.green} accent={t.accentGreen} sub="↑ 14 patients reactivated" decorIcon={TrendingUp} />
        <BigStatCard label="Appointments today" value="4" color={t.brand} accent={t.accentBlue} sub="1 needs confirmation" decorIcon={CalendarIcon} />
        <BigStatCard label="Open messages" value="4" color={t.red} accent={t.accentRed} sub="Needs reply today" decorIcon={InboxIcon} />
        <BigStatCard label="Unread alerts" value="3" color={t.amber} accent={t.accentAmber} sub="Across billing & recall" decorIcon={Bell} />
      </div>

      <div className="px-glass" style={{ background: `linear-gradient(120deg, ${withAlpha(t.brand, .08)}, ${withAlpha(t.teal, .05)}), ${t.glassBg}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Sparkles size={13} color={t.teal} /> Today at a glance</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {GLANCE_CHIPS.map((chip, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(chip.tab)}
              className="px-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 15px', borderRadius: '4px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.ink2, fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colorMap[chip.color], flexShrink: 0 }} />
              {chip.text}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 0.9fr', gap: '12px', marginBottom: '18px', alignItems: 'start' }}>
        <Card>
          <CardTitle>Today's schedule</CardTitle>
          {TODAY_SCHEDULE.map((a, i) => (
            <div key={i} className="px-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0 10px 10px', borderBottom: `1px solid ${t.rowBorder}`, borderLeft: `2px solid ${colorMap[a.color]}` }}>
              <div style={{ fontSize: '11.5px', color: t.muted, width: '58px', flexShrink: 0, fontWeight: '500' }}>{a.time}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{a.name}</PII></div>
                <div style={{ fontSize: '11.5px', color: t.muted }}>{a.procedure}</div>
              </div>
              <Pill label={a.status} color={colorMap[a.color]} bg={withAlpha(colorMap[a.color], .12)} />
            </div>
          ))}
        </Card>

        <Card>
          <CardTitle>Priority inbox</CardTitle>
          {OVERVIEW_MESSAGES.map((m, i) => (
            <div key={i} className="px-row" style={{ display: 'flex', gap: '10px', padding: '10px 0 10px 10px', borderBottom: `1px solid ${t.rowBorder}`, borderLeft: `2px solid ${t.brand}` }}>
              <Ava initials={initialsOf(m.name)} bg={t.brand} color="white" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{m.name}</PII></span><span style={{ fontSize: '11px', color: t.muted, flexShrink: 0 }}>{m.time}</span></div>
                <div style={{ fontSize: '12px', color: t.muted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.msg}</div>
              </div>
            </div>
          ))}
          <Btn small onClick={() => setActiveTab('inbox')} style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>View all messages</Btn>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {QUICK_ACTIONS.map((qa, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(qa.tab)}
              className="px-btn px-card px-glass"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: withAlpha(colorMap[qa.color], .12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <qa.Icon size={17} color={colorMap[qa.color]} />
              </div>
              <span style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2 }}>{qa.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: t.greenL, borderRadius: '6px', fontSize: '12.5px', color: t.green, fontWeight: '500', border: `1px solid ${withAlpha(t.accentGreen, .15)}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={14} /> AI handled 47 interactions today · saved 4.2 hours
      </div>
    </div>
  );
}

// ─── INBOX ─────────────────────────────────────────────────
// Two-panel, email-client-style layout. Conversations are a merge of two
// sources: live patient-portal threads from Firestore (`patientMessages`,
// grouped by patientUid) and CRM conversations (real GHL data when
// connected, otherwise DEMO_CONVERSATIONS) — both normalized to the same
// { id, source, name, channel, unread, messages[] } shape so the list and
// thread view don't need to branch on where a conversation came from.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Inbox({ contacts }) {
  const t = useTheme();
  const { data, loading, error, refetch } = useGhlFetch(getConversations);
  const [demoConversations, setDemoConversations] = useState(DEMO_CONVERSATIONS);
  const [portalThreads, setPortalThreads] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [attachError, setAttachError] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachmentOverlay, setAttachmentOverlay] = useState({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' && window.innerWidth < 860);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const contactList = contacts || [];

  useEffect(() => {
    function onResize() { setIsMobileView(window.innerWidth < 860); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const q = query(collection(db, 'patientMessages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const byUid = {};
      all.forEach(m => { (byUid[m.patientUid] = byUid[m.patientUid] || []).push(m); });
      const threads = Object.entries(byUid).map(([uid, msgs]) => {
        const last = msgs[msgs.length - 1];
        return {
          id: `portal-${uid}`,
          source: 'portal',
          uid,
          name: last.patientName || 'Patient',
          channel: 'Portal',
          unread: msgs.some(m => m.sender === 'patient' && !m.read),
          sortKey: last.createdAt?.toMillis ? last.createdAt.toMillis() : Date.now(),
          messages: msgs.map(m => ({
            sender: m.sender, text: m.text, docId: m.id, read: m.read,
            time: m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : '',
          })),
        };
      }).sort((a, b) => b.sortKey - a.sortKey);
      setPortalThreads(threads);
    });
    return unsub;
  }, []);

  if (isGhlConfigured && loading) return <LoadingState label="Loading conversations…" />;
  if (isGhlConfigured && error) return <ErrorState message={error} onRetry={refetch} />;

  const crmConversations = isGhlConfigured ? (data || []).map(mapConversation) : demoConversations;
  const allConversations = [...portalThreads, ...crmConversations];

  const filtered = allConversations.filter(c => {
    if (filter === 'Unread' && !c.unread) return false;
    if (filter === 'SMS' && c.channel !== 'SMS') return false;
    if (filter === 'Email' && c.channel !== 'Email') return false;
    if (filter === 'Calls' && c.channel !== 'Calls') return false;
    if (filter === 'WhatsApp' || filter === 'Instagram') return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const last = c.messages[c.messages.length - 1];
      if (!c.name.toLowerCase().includes(q) && !(last?.text || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selected = allConversations.find(c => c.id === selectedId) || null;
  const matchedContact = selected && selected.contactId ? contactList.find(c => c.id === selected.contactId) : null;
  const unconnectedChannel = (filter === 'WhatsApp' || filter === 'Instagram') ? filter : null;

  function selectConversation(c) {
    setSelectedId(c.id);
    setDraft('');
    setSendError('');
    setPendingAttachment(null);
    setAttachError('');
    if (c.source === 'portal') {
      c.messages.filter(m => m.sender === 'patient' && !m.read).forEach(m => {
        updateDoc(doc(db, 'patientMessages', m.docId), { read: true });
      });
    } else if (!isGhlConfigured) {
      setDemoConversations(cs => cs.map(cc => cc.id === c.id ? { ...cc, unread: false } : cc));
    }
  }

  async function handleSend() {
    if (!selected || (!draft.trim() && !pendingAttachment)) return;
    const text = draft.trim();
    const attachment = pendingAttachment;

    if (attachment) {
      setAttachmentOverlay(o => ({ ...o, [selected.id]: [...(o[selected.id] || []), { sender: 'staff', attachment, time: 'Just now' }] }));
      setPendingAttachment(null);
    }
    if (!text) return;

    if (selected.source === 'portal') {
      setSending(true);
      try {
        await addDoc(collection(db, 'patientMessages'), {
          patientUid: selected.uid,
          patientName: selected.name,
          sender: 'staff',
          text,
          createdAt: serverTimestamp(),
          read: true,
        });
        setDraft('');
      } finally {
        setSending(false);
      }
      return;
    }
    if (!isGhlConfigured) {
      setDemoConversations(cs => cs.map(c => c.id === selected.id
        ? { ...c, unread: false, messages: [...c.messages, { sender: 'staff', text, time: 'Just now' }] }
        : c));
      setDraft('');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      await sendMessage(selected.contactId, text);
      setDraft('');
    } catch (err) {
      setSendError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  async function handleFilePicked(file, kind) {
    if (!file) return;
    setAttachError('');
    if (file.size > 8 * 1024 * 1024) {
      setAttachError('That file is too large for this demo (max 8MB).');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPendingAttachment({ name: file.name, size: file.size, mime: file.type, kind, dataUrl });
    } catch {
      setAttachError('Could not read that file — try another one.');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (!selected) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleFilePicked(file, file.type.startsWith('image/') ? 'image' : 'file');
  }

  function handleAiSuggest() {
    if (!selected) return;
    setAiLoadingId(selected.id);
    setTimeout(() => {
      const suggestion = suggestReplyFor(selected.id);
      setAiSuggestions(s => ({ ...s, [selected.id]: suggestion }));
      setDraft(suggestion);
      setAiLoadingId(null);
    }, 600);
  }

  const showList = !isMobileView || !selected;
  const showDetail = !isMobileView || !!selected;
  const suggestion = selected ? aiSuggestions[selected.id] : null;
  const displayMessages = selected ? [...selected.messages, ...(attachmentOverlay[selected.id] || [])] : [];

  return (
    <div className="px-glass" style={{ display: 'flex', height: 'calc(100vh - 108px)', minHeight: '520px', borderRadius: '8px', overflow: 'hidden' }}>
      {showList && (
        <div style={{ width: isMobileView ? '100%' : '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: isMobileView ? 'none' : `1px solid ${t.rowBorder}` }}>
          <div style={{ padding: '14px', borderBottom: `1px solid ${t.border2}` }}>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} color={t.muted} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                style={{ width: '100%', padding: '9px 12px 9px 32px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['All', 'Unread', 'SMS', 'Email', 'Calls', 'WhatsApp', 'Instagram'].map(label => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFilter(label)}
                  style={{ padding: '5px 12px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '500', cursor: 'pointer', border: filter === label ? 'none' : `1px solid ${t.border}`, background: filter === label ? t.brand : 'transparent', color: filter === label ? 'white' : t.mid, fontFamily: 'inherit' }}
                >{label}</button>
              ))}
            </div>
          </div>

          {!isGhlConfigured && (
            <div style={{ padding: '9px 14px', background: t.tealL, fontSize: '11px', color: t.teal, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={12} /> Demo conversations shown — connect GoHighLevel for real data.
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {unconnectedChannel ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: t.muted }}>
                {unconnectedChannel === 'WhatsApp'
                  ? <MessageCircle size={30} color={t.border} style={{ marginBottom: '8px' }} />
                  : <Camera size={30} color={t.border} style={{ marginBottom: '8px' }} />}
                <div style={{ fontSize: '13px', fontWeight: '600', color: t.ink2, marginBottom: '4px' }}>{unconnectedChannel} isn't connected</div>
                <div style={{ fontSize: '12px', lineHeight: '1.5' }}>Connect {unconnectedChannel === 'WhatsApp' ? 'WhatsApp Business' : 'Instagram'} in Settings → Integrations to see conversations here.</div>
              </div>
            ) : (
              <>
                {filtered.length === 0 && (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: t.muted, fontSize: '12.5px' }}>No conversations match.</div>
                )}
                {filtered.map((c, i) => {
              const [color, bg] = avatarStyle(t, i);
              const last = c.messages[c.messages.length - 1];
              const isSelected = selectedId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c)}
                  className="px-row"
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', cursor: 'pointer', borderBottom: `1px solid ${t.rowBorder}`, background: isSelected ? t.rowHover : 'transparent' }}
                >
                  <Ava initials={initialsOf(c.name)} bg={bg} color={color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: c.unread ? '700' : '500', color: t.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><PII>{c.name}</PII></div>
                      <div style={{ fontSize: '10.5px', color: t.muted, flexShrink: 0 }}>{last?.time || ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ fontSize: '11.5px', color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {last?.sender === 'staff' ? 'You: ' : ''}{last?.text}
                      </div>
                      {c.unread && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.brand, flexShrink: 0 }} />}
                    </div>
                  </div>
                </div>
              );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {showDetail && (
        <div
          onDragOver={e => { e.preventDefault(); if (selected) setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', border: isDragOver ? `2px dashed ${t.brand}` : '2px dashed transparent', borderRadius: isDragOver ? '10px' : 0, transition: 'border-color .12s ease' }}
        >
          {isDragOver && (
            <div style={{ position: 'absolute', inset: 0, background: withAlpha(t.brand, .06), zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ padding: '10px 18px', borderRadius: '6px', background: t.brand, color: 'white', fontSize: '13px', fontWeight: '600' }}>Drop to attach</div>
            </div>
          )}
          {unconnectedChannel ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: t.muted, padding: '20px', textAlign: 'center' }}>
              {unconnectedChannel === 'WhatsApp' ? <MessageCircle size={40} color={t.border} /> : <Camera size={40} color={t.border} />}
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2, marginBottom: '4px' }}>{unconnectedChannel} isn't connected yet</div>
                <div style={{ fontSize: '12.5px', maxWidth: '320px' }}>Head to Settings → Integrations to connect {unconnectedChannel === 'WhatsApp' ? 'WhatsApp Business' : 'Instagram'} and start receiving messages here.</div>
              </div>
            </div>
          ) : !selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: t.muted }}>
              <MessageSquare size={36} color={t.border} />
              <div style={{ fontSize: '13px' }}>Select a conversation to view</div>
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isMobileView && (
                  <button type="button" onClick={() => setSelectedId(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    <ArrowLeft size={18} color={t.ink2} />
                  </button>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}><PII>{selected.name}</PII></div>
                  <div style={{ fontSize: '11px', color: t.muted }}>{matchedContact?.phone ? <><PII>{matchedContact.phone}</PII>{' · '}</> : ''}{selected.channel}</div>
                </div>
                <Pill label={selected.channel} color={t.brand} bg={t.brandL} />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', background: t.bgPage }}>
                {displayMessages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.sender === 'staff' ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                    {m.attachment ? (
                      m.attachment.kind === 'image' ? (
                        <img
                          src={m.attachment.dataUrl}
                          alt={m.attachment.name}
                          onClick={() => setLightboxSrc(m.attachment.dataUrl)}
                          style={{ maxWidth: '220px', maxHeight: '220px', borderRadius: '12px', cursor: 'pointer', display: 'block', border: `1px solid ${t.border}` }}
                        />
                      ) : (
                        <a
                          href={m.attachment.dataUrl}
                          download={m.attachment.name}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 13px', borderRadius: '12px', background: m.sender === 'staff' ? t.brandL : t.bgCard, border: `1px solid ${t.border}`, textDecoration: 'none', minWidth: '200px' }}
                        >
                          <Paperclip size={16} color={t.brand} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: '500', color: t.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.attachment.name}</div>
                            <div style={{ fontSize: '10.5px', color: t.muted }}>{formatFileSize(m.attachment.size)}</div>
                          </div>
                          <Download size={14} color={t.brand} style={{ flexShrink: 0 }} />
                        </a>
                      )
                    ) : (
                      <div style={{ padding: '10px 13px', borderRadius: '14px', fontSize: '13px', lineHeight: 1.45, background: m.sender === 'staff' ? t.brand : t.bgCard, color: m.sender === 'staff' ? 'white' : t.ink2, border: m.sender === 'staff' ? 'none' : `1px solid ${t.border}` }}>{m.text}</div>
                    )}
                    {m.time && <div style={{ fontSize: '10px', color: t.muted, marginTop: '3px', textAlign: m.sender === 'staff' ? 'right' : 'left' }}>{m.time}</div>}
                  </div>
                ))}
              </div>

              {sendError && (
                <div style={{ margin: '0 18px', background: t.redL, color: t.red, border: `1px solid ${withAlpha(t.accentRed, .2)}`, borderRadius: '6px', padding: '9px 12px', fontSize: '12px' }}>{sendError}</div>
              )}
              {attachError && (
                <div style={{ margin: '10px 18px 0', background: t.redL, color: t.red, borderRadius: '6px', padding: '8px 12px', fontSize: '11.5px' }}>{attachError}</div>
              )}

              <div style={{ padding: '14px 18px', borderTop: `1px solid ${t.border2}` }}>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { handleFilePicked(e.target.files?.[0], 'file'); e.target.value = ''; }} />
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { handleFilePicked(e.target.files?.[0], 'image'); e.target.value = ''; }} />

                {pendingAttachment && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '9px', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgRow, maxWidth: '320px' }}>
                    {pendingAttachment.kind === 'image' ? (
                      <img src={pendingAttachment.dataUrl} alt="" style={{ width: '30px', height: '30px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Paperclip size={14} color={t.brand} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: t.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pendingAttachment.name}</div>
                      <div style={{ fontSize: '10.5px', color: t.muted }}>{formatFileSize(pendingAttachment.size)}</div>
                    </div>
                    <button type="button" onClick={() => setPendingAttachment(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', color: t.muted, flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {suggestion && (
                  <button
                    type="button"
                    onClick={() => setDraft(suggestion)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '9px', padding: '6px 12px', borderRadius: '4px', border: `1px solid ${withAlpha(t.brand, .25)}`, background: t.brandL, color: t.brand, fontSize: '11.5px', cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%' }}
                  >
                    <Bot size={12} style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AI: {suggestion}</span>
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '7px', display: 'flex', color: t.muted, flexShrink: 0 }}>
                    <Paperclip size={16} />
                  </button>
                  <button type="button" onClick={() => imageInputRef.current?.click()} title="Attach image" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '7px', display: 'flex', color: t.muted, flexShrink: 0 }}>
                    <ImageIcon size={16} />
                  </button>
                  <button type="button" onClick={handleAiSuggest} disabled={aiLoadingId === selected.id} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '7px', display: 'flex', color: t.brand, flexShrink: 0 }} title="AI suggest reply">
                    {aiLoadingId === selected.id ? <Loader2 size={16} className="px-spin" /> : <Sparkles size={16} />}
                  </button>
                  <input
                    value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Type a reply…"
                    style={{ flex: 1, padding: '10px 13px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, minWidth: 0 }}
                  />
                  <Btn small primary onClick={handleSend} disabled={sending || (!draft.trim() && !pendingAttachment)}>
                    {sending ? <Loader2 size={13} className="px-spin" /> : <Send size={13} />} Send
                  </Btn>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', cursor: 'zoom-out' }}>
          <img src={lightboxSrc} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '6px', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} />
          <button type="button" onClick={() => setLightboxSrc(null)} style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', background: 'rgba(255,255,255,.15)', borderRadius: '6px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} color="white" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CAMPAIGNS ─────────────────────────────────────────────
const CAMPAIGNS_DATA = [
  {
    name: '6-month reactivation sequence', sub: '142 patients · 7-touch email + SMS · Touch 3 of 7',
    stats: [['Open rate', '34%'], ['Reply rate', '18%'], ['Booked', '9'], ['Revenue', '$5,400'], ['Cost/booking', '$35']],
    statColors: ['brand', 'brand', 'green', 'green', 'purple'],
    pill: 'Live', pillColor: 'green', prog: 43,
    sequence: [
      { day: 'Day 0', channel: 'Email', label: 'Welcome back — we miss you!', status: 'sent', metric: '38% opened' },
      { day: 'Day 3', channel: 'SMS', label: '"Still thinking about your next cleaning?"', status: 'sent', metric: '61% replied' },
      { day: 'Day 14', channel: 'Email', label: 'Special offer: $25 off your next visit', status: 'sent', metric: '29% opened' },
      { day: 'Day 30', channel: 'SMS', label: '"We have openings this week — want one?"', status: 'upcoming' },
      { day: 'Day 60', channel: 'Email', label: 'Your smile called, it wants a checkup', status: 'upcoming' },
      { day: 'Day 90', channel: 'SMS', label: '"Last chance — book before fall is booked up"', status: 'upcoming' },
      { day: 'Day 180', channel: 'Email', label: 'Final reactivation offer', status: 'upcoming' },
    ],
  },
  {
    name: 'Post-visit review request', sub: 'Auto-sends 24hrs after every completed appointment',
    stats: [['Sent this month', '28'], ['Clicked', '19'], ['Reviews left', '6'], ['Avg rating', '4.8']],
    statColors: ['brand', 'brand', 'green', 'amber'],
    pill: 'Auto', pillColor: 'brand', prog: null,
    sequence: [
      { day: '+24 hrs', channel: 'SMS', label: '"How was your visit today? Leave us a review!"', status: 'sent', metric: '68% clicked' },
      { day: '+5 days', channel: 'Email', label: 'Reminder — a review means a lot to us', status: 'sent', metric: '22% opened', condition: 'only if no review left' },
    ],
  },
  {
    name: 'Annual checkup reminder', sub: '89 patients · 3-touch SMS · Scheduled September 20',
    stats: [], statColors: [],
    pill: 'Queued', pillColor: 'amber', prog: null,
    sequence: [
      { day: 'Day 0', channel: 'SMS', label: '"It\'s been a year — time for your checkup!"', status: 'upcoming' },
      { day: 'Day 7', channel: 'SMS', label: '"Still able to book you in this month"', status: 'upcoming' },
      { day: 'Day 14', channel: 'Email', label: 'Last reminder — book your annual visit', status: 'upcoming' },
    ],
  },
];

const CAMPAIGN_TYPES = ['Reactivation', 'Recall', 'Review request', 'Custom'];
const CAMPAIGN_AUDIENCES = ['Inactive 3mo', 'Inactive 6mo', 'All patients', 'Custom tag'];
const CAMPAIGN_TOUCHES = [3, 5, 7];
const CAMPAIGN_CHANNELS = ['SMS', 'Email', 'Both'];

function Campaigns({ ghlCampaigns, loading: campaignsLoading, error: campaignsError, onRetry: refetchCampaigns }) {
  const t = useTheme();
  const [localCampaigns, setLocalCampaigns] = useState(CAMPAIGNS_DATA);
  const campaigns = isGhlConfigured ? (ghlCampaigns || []) : localCampaigns;
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [exported, setExported] = useState(false);
  const [form, setForm] = useState({ name: '', type: CAMPAIGN_TYPES[0], audience: CAMPAIGN_AUDIENCES[0], touches: CAMPAIGN_TOUCHES[1], channel: CAMPAIGN_CHANNELS[0], message: '' });
  const colorMap = { brand: t.brand, green: t.green, amber: t.amber, purple: t.purple, muted: t.muted };

  function toggleStatus(name) {
    setLocalCampaigns(cs => cs.map(c => c.name === name
      ? (c.pill === 'Live' ? { ...c, pill: 'Paused', pillColor: 'muted' } : { ...c, pill: 'Live', pillColor: 'green' })
      : c));
  }

  function launchNow(name) {
    setLocalCampaigns(cs => cs.map(c => c.name === name ? { ...c, pill: 'Live', pillColor: 'green', prog: 0 } : c));
  }

  function createCampaign() {
    if (!form.name.trim()) return;
    setLocalCampaigns(cs => [{
      name: form.name.trim(), sub: `${form.audience} · ${form.touches}-touch ${form.channel.toLowerCase()} · ${form.type}`,
      stats: [], statColors: [], pill: 'Live', pillColor: 'green', prog: 0,
      sequence: [{ day: 'Day 0', channel: form.channel === 'Both' ? 'SMS' : form.channel, label: form.message.trim() || 'First touch message', status: 'upcoming' }],
    }, ...cs]);
    setForm({ name: '', type: CAMPAIGN_TYPES[0], audience: CAMPAIGN_AUDIENCES[0], touches: CAMPAIGN_TOUCHES[1], channel: CAMPAIGN_CHANNELS[0], message: '' });
    setShowForm(false);
  }

  if (isGhlConfigured && campaignsLoading) return <LoadingState label="Loading campaigns…" />;
  if (isGhlConfigured && campaignsError) return <ErrorState message={campaignsError} onRetry={refetchCampaigns} />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Patients in sequences" value="231" color={t.brand} accent={t.accentBlue} sub="" />
        <StatCard label="Replies this month" value="47" color={t.amber} accent={t.accentAmber} sub="↑ 20% from last month" />
        <StatCard label="Booked from campaigns" value="14" color={t.green} accent={t.accentGreen} sub="$8,400 revenue recovered" />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        {!isGhlConfigured && <Btn primary onClick={() => setShowForm(s => !s)}><Plus size={14} /> New campaign</Btn>}
        <Btn onClick={() => { setExported(true); setTimeout(() => setExported(false), 2200); }}>{exported ? <Check size={14} /> : <Download size={14} />} {exported ? 'Exported' : 'Export'}</Btn>
      </div>

      {isGhlConfigured && (
        <div style={{ marginBottom: '16px', padding: '10px 12px', background: t.bgRow, borderRadius: '6px', fontSize: '12px', color: t.muted, textAlign: 'center' }}>
          Manage campaigns in GoHighLevel — create, pause, or resume them there. This list mirrors your real campaigns.
        </div>
      )}

      {!isGhlConfigured && showForm && (
        <Card className="px-expand" style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2, marginBottom: '12px' }}>New campaign</div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Campaign name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring cleaning push" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%', padding: '9px 8px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
                {CAMPAIGN_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Audience</label>
              <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} style={{ width: '100%', padding: '9px 8px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
                {CAMPAIGN_AUDIENCES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Touches</label>
              <select value={form.touches} onChange={e => setForm(f => ({ ...f, touches: Number(e.target.value) }))} style={{ width: '100%', padding: '9px 8px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
                {CAMPAIGN_TOUCHES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Channel</label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={{ width: '100%', padding: '9px 8px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
                {CAMPAIGN_CHANNELS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>First message ({form.message.length}/160)</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value.slice(0, 160) }))} rows={3} placeholder="Hi {'{'}first_name{'}'}, ..." style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn primary onClick={createCampaign}>Create campaign</Btn>
            <Btn onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {campaigns.map((c, i) => (
        <Card key={i} className="px-card" style={{ marginBottom: '12px', cursor: 'pointer' }} onClick={() => setSelected(c)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div><div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>{c.name}</div><div style={{ fontSize: '12px', color: t.muted, marginTop: '2px' }}>{c.sub}</div></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Pill label={c.pill} color={colorMap[c.pillColor] || t.muted} bg={c.pillColor ? withAlpha(colorMap[c.pillColor], .12) : t.bgRow} />
              {!isGhlConfigured && c.pill === 'Live' && <Btn small onClick={e => { e.stopPropagation(); toggleStatus(c.name); }}>Pause</Btn>}
              {!isGhlConfigured && c.pill === 'Paused' && <Btn small onClick={e => { e.stopPropagation(); toggleStatus(c.name); }}>Resume</Btn>}
              {!isGhlConfigured && c.pill === 'Queued' && <Btn small onClick={e => { e.stopPropagation(); launchNow(c.name); }}>Launch now</Btn>}
            </div>
          </div>
          {c.stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${c.stats.length},1fr)`, gap: '10px', marginBottom: c.prog ? '10px' : '0' }}>
              {c.stats.map(([label, val], j) => (
                <div key={j} className="px-row" style={{ textAlign: 'center', padding: '10px', background: t.bgRow, borderRadius: '6px', border: `1px solid ${t.border2}` }}>
                  <div style={{ fontSize: '11px', color: t.muted }}>{label}</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: colorMap[c.statColors[j]] }}>{val}</div>
                </div>
              ))}
            </div>
          )}
          {c.prog && <div><div style={{ height: '3px', borderRadius: '3px', background: t.border, overflow: 'hidden', marginTop: '8px' }}><div style={{ height: '100%', borderRadius: '3px', background: t.accentGreen, width: `${c.prog}%` }} /></div><div style={{ fontSize: '11px', color: t.muted, marginTop: '5px' }}>Touch 3 of 7 · {c.prog}% through sequence</div></div>}
          {c.pill === 'Queued' && <div style={{ padding: '10px 12px', background: t.amberL, borderRadius: '6px', fontSize: '12px', color: t.amber, border: `1px solid ${withAlpha(t.accentAmber, .15)}`, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '7px' }}><Clock size={13} /> Scheduled in 7 days · 89 patients receive first touch September 20</div>}
        </Card>
      ))}

      {selected && (
        <SlidePanel title={selected.name} subtitle={selected.sub} onClose={() => setSelected(null)}>
          {selected.stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selected.stats.length, 3)},1fr)`, gap: '8px', marginBottom: '20px' }}>
              {selected.stats.map(([label, val], j) => (
                <div key={j} style={{ textAlign: 'center', padding: '10px', background: t.bgRow, borderRadius: '6px', border: `1px solid ${t.border2}` }}>
                  <div style={{ fontSize: '10px', color: t.muted }}>{label}</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: colorMap[selected.statColors[j]] }}>{val}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '12px' }}>TOUCH-BY-TOUCH SEQUENCE</div>
          {selected.sequence.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: t.muted, fontSize: '12.5px' }}>No sequence detail available from GoHighLevel for this campaign.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {selected.sequence.map((touch, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: touch.status === 'sent' ? t.green : t.bgRow, color: touch.status === 'sent' ? 'white' : t.muted,
                    border: touch.status === 'sent' ? 'none' : `1px solid ${t.border}`, fontSize: '11px', fontWeight: '700', flexShrink: 0,
                  }}>{i + 1}</div>
                  {i < selected.sequence.length - 1 && <div style={{ width: '2px', flex: 1, minHeight: '18px', background: touch.status === 'sent' ? t.green : t.border }} />}
                </div>
                <div style={{ paddingBottom: '16px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: t.ink2 }}>{touch.day}</span>
                    <span style={{ fontSize: '10.5px', color: t.muted }}>· {touch.channel}</span>
                    {touch.status === 'sent' ? <Pill label="Sent" color={t.green} bg={t.greenL} /> : <Pill label="Upcoming" color={t.muted} bg={t.bgRow} />}
                  </div>
                  <div style={{ fontSize: '12.5px', color: t.mid }}>{touch.label}</div>
                  {touch.metric && <div style={{ fontSize: '11px', color: t.green, marginTop: '3px', fontWeight: '500' }}>{touch.metric}</div>}
                </div>
              </div>
            ))}
          </div>
        </SlidePanel>
      )}
    </div>
  );
}

// ─── RECALL ────────────────────────────────────────────────
function PatientRequests() {
  const t = useTheme();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const q = query(collection(db, 'appointmentRequests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  async function respond(id, status) {
    await updateDoc(doc(db, 'appointmentRequests', id), { status });
  }

  if (!isFirebaseConfigured) {
    return (
      <Card style={{ marginBottom: '14px' }}>
        <CardTitle>Patient appointment requests</CardTitle>
        <div style={{ fontSize: '12.5px', color: t.muted, textAlign: 'center', padding: '10px' }}>
          Requests patients send from their portal will show up here live once Firebase is connected.
        </div>
      </Card>
    );
  }

  if (loading) return <LoadingState label="Loading patient requests…" />;

  const pending = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending').slice(0, 3);

  return (
    <Card style={{ marginBottom: '14px' }}>
      <CardTitle>Patient appointment requests {pending.length > 0 && <Pill label={`${pending.length} pending`} color={t.brand} bg={t.brandL} />}</CardTitle>
      {pending.length === 0 && resolved.length === 0 && (
        <div style={{ fontSize: '12.5px', color: t.muted, textAlign: 'center', padding: '10px' }}>No requests yet — they'll appear here as soon as a patient asks for one from their portal.</div>
      )}
      {pending.map(r => (
        <RowItem key={r.id} style={{ borderLeft: `2px solid ${t.brand}`, paddingLeft: '10px' }}>
          <Ava initials={initialsOf(r.patientName || 'Patient')} bg={t.brandL} color={t.brand} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{r.patientName}</PII></div>
            <div style={{ fontSize: '11.5px', color: t.muted }}>Wants: {r.preferredWhen}{r.reason ? ` · ${r.reason}` : ''}</div>
          </div>
          <Btn small onClick={() => respond(r.id, 'confirmed')}><Check size={12} /> Confirm</Btn>
          <Btn small onClick={() => respond(r.id, 'declined')}>Decline</Btn>
        </RowItem>
      ))}
      {resolved.map(r => (
        <RowItem key={r.id}>
          <Ava initials={initialsOf(r.patientName || 'Patient')} bg={t.bgRow} color={t.muted} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{r.patientName}</PII></div>
            <div style={{ fontSize: '11.5px', color: t.muted }}>Wanted: {r.preferredWhen}</div>
          </div>
          <Pill label={r.status === 'confirmed' ? 'Confirmed' : 'Declined'} color={r.status === 'confirmed' ? t.green : t.muted} bg={r.status === 'confirmed' ? t.greenL : t.bgRow} />
        </RowItem>
      ))}
    </Card>
  );
}

const OVERDUE_PATIENTS = [
  { id: 'op1', ini: 'RP', bg: 'redL', c: 'red', name: 'Robert Park', sub: 'Last visit Jan 12 · 8 months overdue' },
  { id: 'op2', ini: 'JL', bg: 'amberL', c: 'amber', name: 'James Lee', sub: 'Last visit Aug 20 · 1 month overdue' },
  { id: 'op3', ini: 'MC', bg: 'redL', c: 'red', name: 'Maria Chen', sub: 'Last visit Mar 5 · 6 months overdue' },
];

function Recall() {
  const t = useTheme();
  const bgMap = { redL: t.redL, amberL: t.amberL };
  const colorMap = { red: t.red, amber: t.amber };
  const [sent, setSent] = useState({});
  const [bulkSent, setBulkSent] = useState(false);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Recall due this month" value="89" color={t.teal} accent={t.accentTeal} sub="Overdue for 6-month cleaning" />
        <StatCard label="Recalled this month" value="34" color={t.green} accent={t.accentGreen} sub="↑ 38% conversion rate" />
        <StatCard label="Recall revenue" value="$6,120" color={t.brand} accent={t.accentBlue} sub="From recalled patients" />
      </div>
      <PatientRequests />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <CardTitle>Recall sequence — auto-touch</CardTitle>
          {[['3 months post-visit', 'Friendly reminder email — "Time for your checkup"', 'Active'],
            ['5 months post-visit', 'SMS — "Your cleaning is due next month"', 'Active'],
            ['6 months post-visit', 'SMS + email — "Book your cleaning today"', 'Active'],
            ['7 months — overdue', 'Urgent SMS — "Don\'t forget your dental health"', 'Overdue'],
          ].map(([title, sub, status], i) => (
            <RowItem key={i} style={{ borderLeft: `2px solid ${status === 'Overdue' ? t.red : t.green}`, paddingLeft: '10px' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{title}</div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{sub}</div></div>
              <Pill label={status} color={status === 'Overdue' ? t.red : t.green} bg={status === 'Overdue' ? t.redL : t.greenL} />
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Overdue patients — action needed</CardTitle>
          {OVERDUE_PATIENTS.map(p => (
            <RowItem key={p.id} style={{ borderLeft: `2px solid ${t.red}`, paddingLeft: '10px' }}>
              <Ava initials={p.ini} bg={bgMap[p.bg]} color={colorMap[p.c]} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{p.name}</PII></div><div style={{ fontSize: '11.5px', color: t.muted }}>{p.sub}</div></div>
              {sent[p.id] ? <Pill label="Sent" color={t.green} bg={t.greenL} /> : <Btn small onClick={() => setSent(s => ({ ...s, [p.id]: true }))}>Send recall</Btn>}
            </RowItem>
          ))}
          <Btn primary style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} onClick={() => setBulkSent(true)} disabled={bulkSent}>
            {bulkSent ? <Check size={14} /> : <Send size={14} />} {bulkSent ? 'Bulk recall sent to all 89 patients' : 'Send bulk recall to all 89 patients'}
          </Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── PATIENTS ──────────────────────────────────────────────
function patientLtv(id) {
  // FNV-1a style hash so sequential ids (p1, p2, p3…) don't collapse to
  // near-identical values — plain polynomial hashing barely perturbs the
  // output when only the last character changes.
  let hash = 0x811c9dc5;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return 200 + (hash % 7800);
}

function ltvColor(value, t) {
  if (value > 3000) return t.green;
  if (value >= 1000) return t.amber;
  return t.red;
}

function Patients({ query, onQueryChange, contacts, loading, error, onRetry, onAddPatient }) {
  const t = useTheme();
  const q = query.trim().toLowerCase();
  const list = (contacts || []).map(p => ({ ...p, ltv: patientLtv(p.id) }));
  const filtered = q ? list.filter(p => p.name.toLowerCase().includes(q)) : list;
  const [selected, setSelected] = useState(null);
  const [sortKey, setSortKey] = useState(null); // 'name' | 'tag' | 'dateAdded'
  const [sortDir, setSortDir] = useState('asc');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [notice, setNotice] = useState('');

  function handleAddClick() {
    if (!onAddPatient) {
      setNotice("Adding patients writes to GoHighLevel — that's not wired up in this scaffold yet.");
      return;
    }
    setShowAddForm(s => !s);
  }

  function submitNewPatient() {
    if (!newName.trim()) return;
    onAddPatient({ name: newName.trim(), email: newEmail.trim() || '—', phone: newPhone.trim() || '—' });
    setNewName(''); setNewEmail(''); setNewPhone(''); setShowAddForm(false);
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = !sortKey ? filtered : filtered.slice().sort((a, b) => {
    let av, bv;
    if (sortKey === 'dateAdded') {
      const ad = new Date(a.dateAdded).getTime();
      const bd = new Date(b.dateAdded).getTime();
      av = Number.isNaN(ad) ? -Infinity : ad;
      bv = Number.isNaN(bd) ? -Infinity : bd;
    } else if (sortKey === 'tag') {
      av = (a.tag || '').toLowerCase();
      bv = (b.tag || '').toLowerCase();
    } else if (sortKey === 'ltv') {
      av = a.ltv; bv = b.ltv;
    } else {
      av = (a.name || '').toLowerCase();
      bv = (b.name || '').toLowerCase();
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const avgLtv = list.length ? Math.round(list.reduce((s, p) => s + p.ltv, 0) / list.length) : 0;
  const highestLtv = list.reduce((max, p) => p.ltv > (max?.ltv || 0) ? p : max, null);
  const totalLtv = list.reduce((s, p) => s + p.ltv, 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Average patient LTV" value={`$${avgLtv.toLocaleString()}`} color={t.brand} accent={t.accentBlue} sub="Across all patients" decorIcon={Users} />
        <StatCard label="Highest value patient" value={highestLtv ? `$${highestLtv.ltv.toLocaleString()}` : '—'} color={t.green} accent={t.accentGreen} sub={highestLtv ? <PII>{highestLtv.name}</PII> : ''} decorIcon={Award} />
        <StatCard label="Total practice patient value" value={`$${totalLtv.toLocaleString()}`} color={t.purple} accent={t.accentPurple} sub={`${list.length} patients`} decorIcon={CreditCard} />
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color={t.muted} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            placeholder="Search patients by name, email, or phone..."
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            style={{ width: '100%', padding: '9px 14px 9px 36px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }}
          />
        </div>
        <Btn primary onClick={handleAddClick}><Plus size={14} /> Add patient</Btn>
        <Btn onClick={() => setNotice("Bulk import isn't wired up in this scaffold yet.")}><Upload size={14} /> Import</Btn>
      </div>

      {notice && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.tealL, borderRadius: '6px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}` }}>{notice}</div>
      )}

      {showAddForm && (
        <Card className="px-expand" style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2, marginBottom: '12px' }}>Add a patient</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" style={{ padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" style={{ padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
            <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone" style={{ padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn primary onClick={submitNewPatient}>Add patient</Btn>
            <Btn onClick={() => setShowAddForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingState label="Loading patients…" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <>
          {!isGhlConfigured && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.tealL, borderRadius: '6px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}`, display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Sparkles size={13} /> Showing demo data — connect GoHighLevel to load your real patients.
            </div>
          )}
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {[
                    { label: 'Patient', key: 'name' },
                    { label: 'Phone', key: null },
                    { label: 'Tag', key: 'tag' },
                    { label: 'LTV', key: 'ltv' },
                    { label: 'Added', key: 'dateAdded' },
                    { label: '', key: null },
                  ].map((h, i) => (
                    <th
                      key={i}
                      onClick={h.key ? () => toggleSort(h.key) : undefined}
                      style={{ textAlign: 'left', padding: '9px 13px', color: t.muted, fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${t.rowBorder}`, cursor: h.key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {h.label}
                        {h.key && sortKey === h.key && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.id || i} onClick={() => setSelected(p)} className="px-row" style={{ borderBottom: `1px solid ${t.rowBorder}`, cursor: 'pointer' }}>
                    <td style={{ padding: '11px 13px' }}><div style={{ fontWeight: '500', color: t.ink2 }}><PII>{p.name}</PII></div><div style={{ fontSize: '11px', color: t.muted }}><PII>{p.email}</PII></div></td>
                    <td style={{ padding: '11px 13px', color: t.mid }}><PII>{p.phone}</PII></td>
                    <td style={{ padding: '11px 13px' }}>{p.tag ? <Pill label={p.tag} color={t.brand} bg={t.brandL} /> : <span style={{ color: t.muted }}>—</span>}</td>
                    <td style={{ padding: '11px 13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '600', color: ltvColor(p.ltv, t) }}>${p.ltv.toLocaleString()}</span>
                        {p.ltv > 5000 && <Pill label="VIP" color={t.purple} bg={t.purpleL} />}
                      </div>
                    </td>
                    <td style={{ padding: '11px 13px', color: t.mid }}>{p.dateAdded}</td>
                    <td style={{ padding: '11px 13px', textAlign: 'right' }}><Btn small onClick={e => { e.stopPropagation(); setSelected(p); }}>View</Btn></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: t.muted }}>{list.length === 0 ? 'No patients yet.' : `No patients match "${query}"`}</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {selected && (
        <SlidePanel title={selected.name} subtitle={selected.tag || 'Patient'} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '8px', background: t.brandL, color: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '700' }}>{initialsOf(selected.name)}</div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: t.ink }}><PII>{selected.name}</PII></div>
              {selected.tag && <div style={{ marginTop: '4px' }}><Pill label={selected.tag} color={t.brand} bg={t.brandL} /></div>}
            </div>
          </div>
          <DetailRow label="Email" value={<PII>{selected.email}</PII>} />
          <DetailRow label="Phone" value={<PII>{selected.phone}</PII>} />
          <DetailRow label="Patient since" value={selected.dateAdded} />
          <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${t.border2}` }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '10px' }}>APPOINTMENT HISTORY</div>
            <div style={{ padding: '16px', background: t.bgRow, borderRadius: '6px', fontSize: '12.5px', color: t.muted, textAlign: 'center' }}>
              Connect the calendar sync to see this patient's visit history here.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '22px' }}>
            <Btn primary style={{ flex: 1, justifyContent: 'center' }}>Message</Btn>
            <Btn style={{ flex: 1, justifyContent: 'center' }}>Schedule</Btn>
          </div>
        </SlidePanel>
      )}
    </div>
  );
}

// ─── BILLING ───────────────────────────────────────────────
const CLAIMS_DATA = [
  { id: 'cl1', name: 'Sarah Martinez', code: 'D1110 · Prophylaxis · Delta Dental · ERA auto-posted', amount: '$180', status: 'Paid', color: 'green', bg: 'greenL' },
  { id: 'cl2', name: 'James Lee', code: 'D2740 · Crown · Aetna · Submitted 3 days ago', amount: '$1,200', status: 'Pending', color: 'amber', bg: 'amberL' },
  { id: 'cl3', name: 'Robert Park', code: 'D7210 · Extraction · UnitedHealth · Denied: Missing info', amount: '$320', status: 'Denied', color: 'red', bg: 'redL' },
];

function Billing() {
  const t = useTheme();
  const colorMap = { green: t.green, amber: t.amber, red: t.red };
  const bgMap = { greenL: t.greenL, amberL: t.amberL, redL: t.redL };
  const [claims, setClaims] = useState(CLAIMS_DATA);

  function resubmit(id) {
    setClaims(cs => cs.map(c => c.id === id ? { ...c, status: 'Pending', color: 'amber', bg: 'amberL' } : c));
  }

  return (
    <div>
      <div style={{ padding: '11px 15px', background: t.purpleL, borderRadius: '6px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', border: `1px solid ${withAlpha(t.purple, .15)}` }}>
        <Zap size={14} color={t.purple} /><span style={{ fontSize: '13px', color: t.purple, fontWeight: '500' }}>Pro — Billing automation active · Connected to Office Ally clearinghouse</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '18px' }}>
        <StatCard label="Claims submitted" value="48" color={t.brand} accent={t.accentBlue} sub="This month" />
        <StatCard label="Claims paid" value="39" color={t.green} accent={t.accentGreen} sub="$28,400 collected" />
        <StatCard label="Pending" value="7" color={t.amber} accent={t.accentAmber} sub="$4,200 in queue" />
        <StatCard label="Denials" value="2" color={t.red} accent={t.accentRed} sub="Action needed" />
      </div>
      <Card>
        <CardTitle>Recent claims</CardTitle>
        {claims.map(c => (
          <div key={c.id} className="px-row" style={{ padding: '10px 0 10px 10px', borderBottom: `1px solid ${t.rowBorder}`, borderLeft: `2px solid ${colorMap[c.color]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{c.name}</PII></div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{c.code}</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: colorMap[c.color] }}>{c.amount}</span>
              {c.status === 'Denied' ? <Btn small style={{ color: colorMap[c.color], borderColor: colorMap[c.color] }} onClick={() => resubmit(c.id)}><RotateCw size={12} /> Resubmit</Btn> : <Pill label={c.status} color={colorMap[c.color]} bg={bgMap[c.bg]} />}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── PAYMENTS ──────────────────────────────────────────────
function Payments({ contacts }) {
  const t = useTheme();
  const contactList = contacts || [];
  const [selectedContactId, setSelectedContactId] = useState('');
  const [amount, setAmount] = useState('');
  const [reqType, setReqType] = useState('Co-pay collection');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsError, setSmsError] = useState('');

  const selectedContact = contactList.find(c => c.id === selectedContactId) || null;

  async function handleSend() {
    if (!selectedContact) { setError('Select a patient first.'); return; }
    setError('');
    setLinkUrl('');
    setCopied(false);
    setSmsSent(false);
    setSmsError('');
    setSending(true);
    try {
      const res = await createPaymentLink(selectedContact.name, amount, reqType);
      setLinkUrl(res?.url || '');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
    } catch {
      // clipboard API unavailable — link is still shown for manual copy
    }
  }

  async function handleSendSms() {
    if (!selectedContact) return;
    setSmsError('');
    setSmsSending(true);
    try {
      await sendMessage(selectedContact.id, `Here's your secure payment link: ${linkUrl}`);
      setSmsSent(true);
    } catch (err) {
      setSmsError(err.message || 'Could not send the text.');
    } finally {
      setSmsSending(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Collected this month" value="$12,840" color={t.green} accent={t.accentGreen} sub="↑ 18% from last month" />
        <StatCard label="Active payment plans" value="8" color={t.brand} accent={t.accentBlue} sub="$4,200 total outstanding" />
        <StatCard label="Co-pays collected online" value="$3,240" color={t.amber} accent={t.accentAmber} sub="Before patients arrived" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <CardTitle>Active payment plans</CardTitle>
          {[
            ['JL', t.brandL, t.brand, 'James Lee · Crown $1,200', '$300/mo · 3 payments remaining', 'On track', t.green, t.greenL],
            ['PG', t.purpleL, t.purple, 'Patricia Green · Implant $3,200', '$200/mo · 14 payments remaining', 'On track', t.green, t.greenL],
            ['MB', t.redL, t.red, 'Mike Brown · Veneers $2,400', 'Payment failed Sep 10 — card declined', 'Failed', t.red, t.redL],
          ].map(([ini, bg, c, name, sub, status, sc, sbg], i) => (
            <RowItem key={i} style={status === 'Failed' ? { borderLeft: `2px solid ${t.red}`, paddingLeft: '10px' } : {}}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{name}</PII></div><div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div></div>
              {status === 'Failed' ? <Btn small style={{ color: sc, borderColor: sc }}>Retry</Btn> : <Pill label={status} color={sc} bg={sbg} />}
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Send payment request</CardTitle>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Patient</label>
            <select value={selectedContactId} onChange={e => setSelectedContactId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
              <option value="">Select a patient…</option>
              {contactList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Amount</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="$0.00" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Type</label>
            <select value={reqType} onChange={e => setReqType(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
              <option>Co-pay collection</option><option>Balance due</option><option>Deposit for procedure</option><option>Payment plan setup</option>
            </select>
          </div>
          <Btn primary onClick={handleSend} disabled={sending} style={{ width: '100%', justifyContent: 'center' }}>
            {sending ? <Loader2 size={14} className="px-spin" /> : <Send size={14} />} Create payment link
          </Btn>
          {!isStripeConfigured && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: t.amberL, borderRadius: '6px', fontSize: '11.5px', color: t.amber, border: `1px solid ${withAlpha(t.accentAmber, .15)}`, display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
              <AlertTriangle size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
              <span>Firebase isn't connected yet — add <code style={{ background: withAlpha(t.amber, .12), padding: '1px 5px', borderRadius: '4px' }}>REACT_APP_FIREBASE_*</code> to your <code style={{ background: withAlpha(t.amber, .12), padding: '1px 5px', borderRadius: '4px' }}>.env.local</code>.</span>
            </div>
          )}
          {error && isStripeConfigured && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: t.redL, borderRadius: '6px', fontSize: '11.5px', color: t.red, border: `1px solid ${withAlpha(t.accentRed, .15)}` }}>{error}</div>
          )}
          {linkUrl && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: t.greenL, borderRadius: '6px', border: `1px solid ${withAlpha(t.accentGreen, .15)}` }}>
              <div style={{ fontSize: '11.5px', color: t.green, fontWeight: '600', marginBottom: '6px' }}>Payment link created.</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input readOnly value={linkUrl} onFocus={e => e.target.select()} style={{ flex: 1, padding: '7px 10px', border: `1px solid ${t.border}`, borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', background: t.bgCard, color: t.ink2, minWidth: 0 }} />
                <Btn small onClick={handleCopy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}</Btn>
              </div>
              {isGhlConfigured && (
                <div style={{ marginTop: '8px' }}>
                  <Btn small primary onClick={handleSendSms} disabled={smsSending || smsSent} style={{ width: '100%', justifyContent: 'center' }}>
                    {smsSending ? <Loader2 size={13} className="px-spin" /> : <Send size={13} />} {smsSent ? 'Sent via SMS' : 'Send via SMS'}
                  </Btn>
                  {smsError && <div style={{ marginTop: '6px', fontSize: '11px', color: t.red }}>{smsError}</div>}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── AI FRONT DESK ─────────────────────────────────────────
const CALL_LOG = [
  {
    id: 'call1', caller: 'Robert Park', phone: '(813) 555-0118', duration: '3 min', time: 'Today, 4:02 PM',
    topic: 'Emergency — tooth pain', pill: 'Booked', color: 'green',
    transcript: [
      { speaker: 'AI', text: "Thanks for calling Bright Smiles Dental, this is Alex. How can I help you today?" },
      { speaker: 'Caller', text: "Hi, I have really bad tooth pain on my lower right side, it's been getting worse since last night." },
      { speaker: 'AI', text: "I'm sorry to hear that — that sounds urgent. Can I get your name and date of birth to pull up your file?" },
      { speaker: 'Caller', text: 'Robert Park, 04/12/1985.' },
      { speaker: 'AI', text: "Thanks Robert. I see you're an existing patient. Given the pain level, I'd like to get you in today — I have a 4:00 PM emergency slot open. Does that work?" },
      { speaker: 'Caller', text: 'Yes, that works, thank you.' },
      { speaker: 'AI', text: "Great, you're booked for 4:00 PM today with Dr. Rivera. I'm texting you an intake form now — please fill it out before you arrive. See you soon!" },
    ],
    actions: ['Verified existing patient record', 'Booked 4:00 PM emergency slot with Dr. Rivera', 'Sent digital intake form via SMS'],
  },
  {
    id: 'call2', caller: 'Unknown', phone: '(813) 555-0199', duration: '2 min', time: 'Today, 2:47 PM',
    topic: 'Hours inquiry', pill: 'Resolved', color: 'brand',
    transcript: [
      { speaker: 'AI', text: "Thanks for calling Bright Smiles Dental, this is Alex. How can I help you today?" },
      { speaker: 'Caller', text: 'Hey, what are your hours on Saturdays? And do you have parking?' },
      { speaker: 'AI', text: "We're open Saturdays from 9 AM to 2 PM, and yes — there's free parking right behind the building. Would you like to book a cleaning while I have you?" },
      { speaker: 'Caller', text: 'Not right now, just checking. Thanks!' },
      { speaker: 'AI', text: 'No problem, have a great day!' },
    ],
    actions: ['Answered hours and parking questions', 'Offered to book a cleaning — declined'],
  },
  {
    id: 'call3', caller: 'Maria Chen', phone: '(813) 555-0142', duration: '4 min', time: 'Today, 1:15 PM',
    topic: 'Insurance question', pill: 'Escalated', color: 'amber',
    transcript: [
      { speaker: 'AI', text: "Thanks for calling Bright Smiles Dental, this is Alex. How can I help you today?" },
      { speaker: 'Caller', text: "Hi, I wanted to ask if my Delta Dental plan covers a crown, and how much I'd owe out of pocket." },
      { speaker: 'AI', text: 'I can look up your file, but a detailed benefits breakdown needs a member-specific plan lookup — let me connect you with our front desk team so they can pull your exact coverage.' },
      { speaker: 'Caller', text: 'Okay, sure.' },
      { speaker: 'AI', text: "I've flagged this for our staff — someone will call you back within the hour with your exact coverage numbers." },
    ],
    actions: ['Identified benefits question requiring plan lookup', 'Escalated to front desk with callback flag'],
  },
  {
    id: 'call4', caller: 'David Wong', phone: '(813) 555-0177', duration: '2 min', time: 'Today, 11:32 AM',
    topic: 'Reschedule request', pill: 'Rescheduled', color: 'green',
    transcript: [
      { speaker: 'AI', text: "Thanks for calling Bright Smiles Dental, this is Alex. How can I help you today?" },
      { speaker: 'Caller', text: 'I need to move my appointment on Thursday, something came up.' },
      { speaker: 'AI', text: 'No problem — I see your 10 AM cleaning on Thursday. I have openings Friday at 9 AM or next Monday at 3 PM. Which works better?' },
      { speaker: 'Caller', text: 'Friday at 9 works.' },
      { speaker: 'AI', text: "You're all set for Friday at 9 AM. I'll send a confirmation text shortly." },
    ],
    actions: ['Found existing Thursday appointment', 'Offered two alternative times', 'Rebooked to Friday 9:00 AM and sent confirmation'],
  },
];

const VOICE_SETTINGS_META = [
  { key: 'autoBook', title: 'Auto-book appointments', sub: 'AI can book without staff approval' },
  { key: 'emergencyEscalation', title: 'Emergency escalation', sub: 'Keywords that trigger urgent alert to staff' },
  { key: 'afterHoursSms', title: 'After-hours SMS fallback', sub: 'Texts caller if they call when closed' },
  { key: 'callRecording', title: 'Call recording', sub: 'Stored 90 days · HIPAA compliant' },
];

function AIFrontDesk() {
  const t = useTheme();
  const [selectedCall, setSelectedCall] = useState(null);
  const [voiceName, setVoiceName] = useState('Alex');
  const [settings, setSettings] = useState({ autoBook: true, emergencyEscalation: true, afterHoursSms: true, callRecording: true });
  const [saved, setSaved] = useState(false);
  const colorMap = { green: t.green, brand: t.brand, amber: t.amber };
  const bgMap = { green: t.greenL, brand: t.brandL, amber: t.amberL };

  function toggleSetting(key) {
    setSettings(s => ({ ...s, [key]: !s[key] }));
  }

  function saveSettings() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Calls answered today" value="47" color={t.green} accent={t.accentGreen} sub="0 missed · 100% rate" />
        <StatCard label="Appts booked by AI" value="6" color={t.brand} accent={t.accentBlue} sub="No human involvement" />
        <StatCard label="Escalated to staff" value="2" color={t.amber} accent={t.accentAmber} sub="Complex cases only" />
        <StatCard label="Hours saved today" value="4.2h" color={t.purple} accent={t.accentPurple} sub="Front desk time reclaimed" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <CardTitle>Recent call log</CardTitle>
          {CALL_LOG.map(c => (
            <div key={c.id} className="px-row" onClick={() => setSelectedCall(c)} style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: t.bgRow, borderRadius: '6px', marginBottom: '7px', border: `1px solid ${t.border2}`, cursor: 'pointer' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorMap[c.color], marginTop: '5px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{c.caller}</PII> · {c.duration} · {c.topic}</div>
                <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{c.actions[0]}</div>
              </div>
              <Pill label={c.pill} color={colorMap[c.color]} bg={bgMap[c.color]} />
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle>
            AI voice settings
            <Btn small primary onClick={saveSettings}>{saved ? <Check size={13} /> : null}{saved ? 'Saved' : 'Save'}</Btn>
          </CardTitle>
          <RowItem style={{ justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>AI voice name</div><div style={{ fontSize: '11.5px', color: t.muted }}>What callers hear when AI picks up</div></div>
            <input value={voiceName} onChange={e => setVoiceName(e.target.value)} style={{ width: '90px', padding: '6px 9px', border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, textAlign: 'right' }} />
          </RowItem>
          {VOICE_SETTINGS_META.map(item => (
            <RowItem key={item.key} style={{ justifyContent: 'space-between' }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{item.title}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{item.sub}</div></div>
              <ToggleSwitch checked={settings[item.key]} onChange={() => toggleSetting(item.key)} />
            </RowItem>
          ))}
        </Card>
      </div>

      {selectedCall && (
        <SlidePanel title={<PII>{selectedCall.caller}</PII>} subtitle={`${selectedCall.topic} · ${selectedCall.time}`} onClose={() => setSelectedCall(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <Pill label={selectedCall.pill} color={colorMap[selectedCall.color]} bg={bgMap[selectedCall.color]} />
            <span style={{ fontSize: '12px', color: t.muted }}><PII>{selectedCall.phone}</PII> · {selectedCall.duration}</span>
          </div>

          <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '8px' }}>AI actions taken</div>
          <div style={{ marginBottom: '22px' }}>
            {selectedCall.actions.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: t.ink2, marginBottom: '6px' }}>
                <Check size={13} color={t.green} style={{ marginTop: '2px', flexShrink: 0 }} /> {a}
              </div>
            ))}
          </div>

          <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '10px' }}>Call transcript</div>
          {selectedCall.transcript.map((line, i) => (
            <div key={i} style={{ marginBottom: '10px', textAlign: line.speaker === 'AI' ? 'left' : 'right' }}>
              <div style={{ fontSize: '10.5px', fontWeight: '600', color: t.muted, marginBottom: '3px' }}>{line.speaker === 'AI' ? `AI (${voiceName})` : <PII>{selectedCall.caller}</PII>}</div>
              <div style={{ display: 'inline-block', maxWidth: '85%', padding: '9px 12px', borderRadius: '12px', fontSize: '12.5px', lineHeight: '1.5', background: line.speaker === 'AI' ? t.brandL : t.bgRow, color: t.ink2, textAlign: 'left' }}>{line.text}</div>
            </div>
          ))}
        </SlidePanel>
      )}
    </div>
  );
}

// ─── REPUTATION CENTER ─────────────────────────────────────
const REPUTATION_PLATFORMS_SEED = [
  { id: 'Google', rating: 4.8, count: 142, lastReview: '2 days ago' },
  { id: 'Yelp', rating: 4.2, count: 38, lastReview: '5 days ago' },
  { id: 'Healthgrades', rating: 3.6, count: 21, lastReview: '1 week ago' },
  { id: 'Facebook', rating: 4.9, count: 64, lastReview: '3 days ago' },
  { id: 'Zocdoc', rating: 4.5, count: 29, lastReview: '4 days ago' },
];

const REVIEW_AUTOMATION_SEED = [
  { platform: 'Google', sent: 64, converted: 22 },
  { platform: 'Yelp', sent: 38, converted: 9 },
  { platform: 'Healthgrades', sent: 21, converted: 4 },
];

const REVIEWS_DATA = [
  { id: 'rv1', platform: 'Google', rating: 5, text: '"Dr. Rivera and the team are absolutely wonderful. The automated reminder texts are so convenient!"', author: 'Sarah M.', date: '2 days ago' },
  { id: 'rv2', platform: 'Google', rating: 3, text: '"Good dentist but the wait time was a bit long. Would appreciate better scheduling."', author: 'Anonymous', date: '1 week ago' },
  { id: 'rv3', platform: 'Yelp', rating: 5, text: '"Best cleaning I’ve ever had. Staff is so friendly!"', author: 'Tom R.', date: '4 days ago' },
  { id: 'rv4', platform: 'Yelp', rating: 2, text: '"Billing was confusing and I was charged more than quoted."', author: 'Jamie K.', date: '5 days ago' },
  { id: 'rv5', platform: 'Healthgrades', rating: 4, text: '"Professional office, good with kids."', author: 'Alicia P.', date: '6 days ago' },
  { id: 'rv6', platform: 'Healthgrades', rating: 3, text: '"Appointment got moved twice without much notice."', author: 'Marcus D.', date: '1 week ago' },
  { id: 'rv7', platform: 'Google', rating: 5, text: '"Painless root canal, highly recommend Dr. Alvarez."', author: 'Dana W.', date: '3 days ago' },
  { id: 'rv8', platform: 'Yelp', rating: 4, text: '"Clean office, easy to book online."', author: 'Chris B.', date: '1 week ago' },
];

function ReputationCenter() {
  const t = useTheme();
  const [reviews] = useState(REVIEWS_DATA);
  const [platformFilter, setPlatformFilter] = useState('All');
  const [starFilter, setStarFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [replied, setReplied] = useState({});
  const [flagged, setFlagged] = useState({});
  const [aiDrafting, setAiDrafting] = useState(null);

  const overallScore = Math.round((REPUTATION_PLATFORMS_SEED.reduce((s, p) => s + p.rating, 0) / REPUTATION_PLATFORMS_SEED.length) * 2 * 10) / 10;
  const scoreColor = overallScore >= 8 ? t.green : overallScore >= 6 ? t.amber : t.red;
  const lowPlatforms = REPUTATION_PLATFORMS_SEED.filter(p => p.rating < 4.0);

  const filtered = reviews.filter(r => {
    if (platformFilter !== 'All' && r.platform !== platformFilter) return false;
    if (starFilter !== 'All' && r.rating !== Number(starFilter)) return false;
    if (statusFilter === 'Replied' && !replied[r.id]) return false;
    if (statusFilter === 'Needs reply' && replied[r.id]) return false;
    return true;
  });

  function draftWithAi(r) {
    setAiDrafting(r.id);
    setTimeout(() => {
      setDrafts(d => ({ ...d, [r.id]: "Thank you for sharing this — we're sorry the experience fell short and we're already working on it. We'd love the chance to make it right on your next visit." }));
      setAiDrafting(null);
    }, 600);
  }

  function send(r) {
    if (!(drafts[r.id] || '').trim()) return;
    setReplied(rp => ({ ...rp, [r.id]: true }));
    setOpenId(null);
  }

  return (
    <div>
      <Card style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '50%', border: `6px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '26px', fontWeight: '800', color: scoreColor }}>{overallScore}</span>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '4px' }}>Overall reputation score</div>
          <div style={{ fontSize: '13px', color: t.mid }}>Weighted across Google, Yelp, Healthgrades, Facebook, and Zocdoc.</div>
        </div>
      </Card>

      {lowPlatforms.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: t.redL, border: `1px solid ${withAlpha(t.red, .25)}`, borderRadius: '12px', marginBottom: '16px' }}>
          <AlertTriangle size={18} color={t.red} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '13px', color: t.red, fontWeight: '500' }}>
            {lowPlatforms.map(p => p.id).join(', ')} {lowPlatforms.length === 1 ? 'has' : 'have'} dropped below 4.0 stars — review recent feedback below.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {REPUTATION_PLATFORMS_SEED.map(p => (
          <Card key={p.id} style={{ padding: '16px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '600', color: t.ink2, marginBottom: '8px' }}>{p.id}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '20px', fontWeight: '800', color: p.rating < 4 ? t.red : t.ink }}>{p.rating}</span>
              <Star size={13} color={t.amber} fill={t.amber} />
            </div>
            <div style={{ fontSize: '11px', color: t.muted }}>{p.count} reviews</div>
            <div style={{ fontSize: '10.5px', color: t.muted, marginTop: '2px' }}>Last: {p.lastReview}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: '16px' }}>
        <CardTitle>Review request automation</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {REVIEW_AUTOMATION_SEED.map(r => (
            <div key={r.platform} style={{ padding: '12px', background: t.bgRow, borderRadius: '6px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: t.ink2, marginBottom: '6px' }}>{r.platform}</div>
              <div style={{ fontSize: '11.5px', color: t.mid }}>{r.sent} sent this month</div>
              <div style={{ fontSize: '11.5px', color: t.green, fontWeight: '600' }}>{Math.round((r.converted / r.sent) * 100)}% conversion</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>All reviews</CardTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          <FilterPillGroup options={['All', ...REPUTATION_PLATFORMS_SEED.map(p => p.id)]} value={platformFilter} onChange={setPlatformFilter} />
          <FilterPillGroup options={['All', '5', '4', '3', '2', '1']} value={starFilter} onChange={setStarFilter} />
          <FilterPillGroup options={['All', 'Replied', 'Needs reply']} value={statusFilter} onChange={setStatusFilter} />
        </div>
        {filtered.length === 0 && <div style={{ fontSize: '13px', color: t.muted, textAlign: 'center', padding: '20px 0' }}>No reviews match these filters.</div>}
        {filtered.map(r => (
          <div key={r.id} className="px-row" style={{ padding: '14px', borderRadius: '6px', background: t.bgRow, marginBottom: '10px', border: `1px solid ${t.border2}`, borderLeft: `3px solid ${r.rating < 4 ? t.accentRed : t.accentAmber}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <StarRating rating={r.rating} />
              <Pill label={r.platform} color={t.brand} bg={t.brandL} />
              {flagged[r.id] && <Pill label="Flagged" color={t.red} bg={t.redL} />}
            </div>
            <div style={{ fontSize: '12.5px', color: t.mid, lineHeight: '1.6' }}>{r.text}</div>
            <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '7px' }}>— {r.author} · {r.date}</div>
            {replied[r.id] ? (
              <div style={{ marginTop: '8px' }}><Pill label="Replied" color={t.green} bg={t.greenL} /></div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {r.rating < 4 && (
                    <Btn small primary onClick={() => { setOpenId(r.id); draftWithAi(r); }} disabled={aiDrafting === r.id}>
                      {aiDrafting === r.id ? <Loader2 size={13} className="px-spin" /> : <Bot size={13} />} AI draft response
                    </Btn>
                  )}
                  <Btn small onClick={() => setOpenId(id => (id === r.id ? null : r.id))}>Reply</Btn>
                  <Btn small onClick={() => setFlagged(f => ({ ...f, [r.id]: !f[r.id] }))}><Flag size={12} /> {flagged[r.id] ? 'Unflag' : 'Flag'}</Btn>
                </div>
                {openId === r.id && (
                  <div className="px-expand" style={{ marginTop: '10px' }}>
                    <textarea
                      value={drafts[r.id] || ''} onChange={e => setDrafts(d => ({ ...d, [r.id]: e.target.value }))}
                      placeholder="Write a reply…" rows={3}
                      style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }}
                    />
                    <Btn small primary onClick={() => send(r)}><Send size={12} /> Send reply</Btn>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── SURVEYS ───────────────────────────────────────────────
const SURVEY_RESPONSES = [
  {
    ini: 'TN', bg: 'greenL', c: 'green', name: 'Tina Nguyen', score: 10, status: 'Promoter', sc: 'green', sbg: 'greenL',
    quote: 'Amazing experience — staff was so kind!', date: 'Sep 11',
    answers: [
      ['How likely are you to recommend us?', '10/10'],
      ['How was your wait time?', 'Seen right on time'],
      ['Was the staff friendly and helpful?', 'Extremely — best dental visit I\'ve had'],
    ],
  },
  {
    ini: 'SM', bg: 'brandL', c: 'brand', name: 'Sarah Martinez', score: 9, status: 'Promoter', sc: 'green', sbg: 'greenL',
    quote: 'Great service, would definitely return', date: 'Sep 9',
    answers: [
      ['How likely are you to recommend us?', '9/10'],
      ['How was your wait time?', 'A few minutes, no big deal'],
      ['Was the staff friendly and helpful?', 'Yes, very professional'],
    ],
  },
  {
    ini: 'AN', bg: 'redL', c: 'red', name: 'Anonymous', score: 4, status: 'Detractor', sc: 'red', sbg: 'redL',
    quote: 'Wait time too long, felt rushed', date: 'Sep 6',
    answers: [
      ['How likely are you to recommend us?', '4/10'],
      ['How was your wait time?', 'Waited almost 40 minutes past my appointment time'],
      ['Was the staff friendly and helpful?', 'Felt rushed through the actual appointment'],
    ],
  },
];

function Surveys() {
  const t = useTheme();
  const colorMap = { brand: t.brand, green: t.green, red: t.red };
  const bgMap = { brandL: t.brandL, greenL: t.greenL, redL: t.redL };
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [sentReply, setSentReply] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);

  function openSurvey(s) {
    setSelected(s);
    setReply('');
    setSentReply(false);
  }

  function draftWithAi() {
    setAiDrafting(true);
    setTimeout(() => {
      setReply(`Hi ${selected.name === 'Anonymous' ? 'there' : selected.name.split(' ')[0]}, thank you for the honest feedback — I'm sorry your visit felt rushed and the wait ran long. We're addressing scheduling so this doesn't happen again. We'd love the chance to make it right on your next visit.`);
      setAiDrafting(false);
    }, 600);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="NPS score" value="72" color={t.pink} accent={t.accentPink} sub="↑ 4 pts from last month" />
        <StatCard label="Promoters (9-10)" value="68%" color={t.green} accent={t.accentGreen} sub="Would recommend us" />
        <StatCard label="Detractors (0-6)" value="12%" color={t.red} accent={t.accentRed} sub="Needs follow-up" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <CardTitle>Recent responses</CardTitle>
          {SURVEY_RESPONSES.map((s, i) => (
            <RowItem
              key={i} onClick={() => openSurvey(s)}
              style={{ cursor: 'pointer', ...(s.status === 'Detractor' ? { borderLeft: `2px solid ${t.red}`, paddingLeft: '10px' } : {}) }}
            >
              <Ava initials={s.ini} bg={bgMap[s.bg]} color={colorMap[s.c]} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{s.name}</PII> · Score: {s.score}</div><div style={{ fontSize: '11.5px', color: t.muted }}>"{s.quote}"</div></div>
              <Pill label={s.status} color={colorMap[s.sc]} bg={bgMap[s.sbg]} />
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>NPS breakdown</CardTitle>
          {[['Promoters (9-10)', '68%', t.accentGreen], ['Passives (7-8)', '20%', t.accentAmber], ['Detractors (0-6)', '12%', t.accentRed]].map(([label, pct, color], i) => (
            <div key={i} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.muted, marginBottom: '5px' }}><span>{label}</span><span style={{ color, fontWeight: '600' }}>{pct}</span></div>
              <div style={{ height: '3px', borderRadius: '3px', background: t.border, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', background: color, width: pct }} /></div>
            </div>
          ))}
        </Card>
      </div>

      {selected && (
        <SlidePanel title={<PII>{selected.name}</PII>} subtitle={`${selected.date} · Score ${selected.score}/10`} onClose={() => setSelected(null)}>
          {selected.answers.map(([q, a], i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '600', color: t.muted, marginBottom: '4px' }}>{q}</div>
              <div style={{ fontSize: '13px', color: t.ink2, lineHeight: '1.5' }}>{a}</div>
            </div>
          ))}
          <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: `1px solid ${t.border2}` }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '10px' }}>REPLY TO PATIENT</div>
            {sentReply ? (
              <div style={{ padding: '12px 14px', background: t.greenL, color: t.green, borderRadius: '6px', fontSize: '12.5px' }}>Reply sent.</div>
            ) : (
              <>
                {selected.status === 'Detractor' && (
                  <Btn small onClick={draftWithAi} style={{ marginBottom: '10px' }} disabled={aiDrafting}>
                    {aiDrafting ? <Loader2 size={13} className="px-spin" /> : <Bot size={13} />} AI draft response
                  </Btn>
                )}
                <textarea
                  value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply…" rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }}
                />
                <Btn primary style={{ width: '100%', justifyContent: 'center' }} onClick={() => reply.trim() && setSentReply(true)}>
                  <Send size={13} /> Send reply
                </Btn>
              </>
            )}
          </div>
        </SlidePanel>
      )}
    </div>
  );
}

// ─── ELIGIBILITY ───────────────────────────────────────────
const ELIGIBILITY_DATA = [
  {
    ini: 'SM', bg: 'brandL', c: 'brand', name: 'Sarah Martinez', payer: 'Delta Dental', memberId: 'DD-2284910', group: 'GRP-4471',
    sub: '$1,200 remaining benefits · $0 deductible · D1110 covered 100%', warn: false, status: 'Verified', sc: 'green', sbg: 'greenL', rowBg: 'bgRow',
    coverage: [['Preventive (cleanings, exams)', '100%'], ['Basic (fillings)', '80%'], ['Major (crowns, root canals)', '50%']],
    deductible: '$0 of $50 used', nextAppt: 'Sep 20 · Cleaning',
  },
  {
    ini: 'JL', bg: 'amberL', c: 'amber', name: 'James Lee', payer: 'Aetna', memberId: 'AET-9938201', group: 'GRP-1120',
    sub: 'Deductible not met · Patient owes $450 before insurance kicks in', warn: true, status: 'Action needed', sc: 'amber', sbg: 'amberL', rowBg: 'amberL',
    coverage: [['Preventive (cleanings, exams)', '100%'], ['Basic (fillings)', '80%'], ['Major (crowns, root canals)', '50%']],
    deductible: '$450 of $50 used — collect at check-in', nextAppt: 'Sep 22 · Crown fitting',
  },
  {
    ini: 'AK', bg: 'greenL', c: 'green', name: 'Amy Kim', payer: 'Cigna', memberId: 'CIG-5512038', group: 'GRP-7734',
    sub: 'D9972 whitening not covered · Patient responsible for full $280', warn: false, status: 'Verified', sc: 'teal', sbg: 'tealL', rowBg: 'bgRow',
    coverage: [['Preventive (cleanings, exams)', '100%'], ['Basic (fillings)', '80%'], ['Cosmetic (whitening)', '0%']],
    deductible: '$0 of $75 used', nextAppt: 'Sep 24 · Whitening',
  },
  {
    ini: 'RP', bg: 'redL', c: 'red', name: 'Robert Park', payer: 'UnitedHealth', memberId: 'UHC-1029384', group: 'GRP-3301',
    sub: 'Policy terminated Sep 1 · No active coverage — collect full payment', warn: true, status: 'No coverage', sc: 'red', sbg: 'redL', rowBg: 'redL',
    coverage: [], deductible: 'N/A — policy inactive', nextAppt: 'Sep 25 · Extraction',
  },
];

function Eligibility() {
  const t = useTheme();
  const colorMap = { brand: t.brand, amber: t.amber, green: t.green, red: t.red, teal: t.teal };
  const bgMap = { brandL: t.brandL, amberL: t.amberL, greenL: t.greenL, redL: t.redL, tealL: t.tealL, bgRow: t.bgRow };
  const [selected, setSelected] = useState(null);
  const [reverified, setReverified] = useState({});

  function reverify(name) {
    setReverified(r => ({ ...r, [name]: true }));
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Verified today" value="4" color={t.green} accent={t.accentGreen} sub="Auto-checked before appt" />
        <StatCard label="Issues found" value="3" color={t.amber} accent={t.accentAmber} sub="Requires action before visit" />
        <StatCard label="Denials prevented" value="$2,840" color={t.brand} accent={t.accentBlue} sub="This month in saved claims" />
      </div>
      <Card>
        <CardTitle>Today's verification results</CardTitle>
        {ELIGIBILITY_DATA.map((e, i) => (
          <div
            key={i} onClick={() => setSelected(e)} className="px-row"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 10px 10px', borderBottom: `1px solid ${t.rowBorder}`, borderLeft: `2px solid ${colorMap[e.sc]}`, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <Ava initials={e.ini} bg={bgMap[e.bg]} color={colorMap[e.c]} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{e.name}</PII> · {e.payer}</div>
                <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {e.warn && <AlertTriangle size={12} color={t.amber} />}{e.sub}
                </div>
              </div>
            </div>
            {reverified[e.name] ? <Pill label="Re-verified" color={t.green} bg={t.greenL} /> : <Pill label={e.status} color={colorMap[e.sc]} bg={bgMap[e.sbg]} />}
          </div>
        ))}
      </Card>

      {selected && (
        <SlidePanel title={<PII>{selected.name}</PII>} subtitle={<>{selected.payer} · Member ID <PII>{selected.memberId}</PII></>} onClose={() => setSelected(null)}>
          <DetailRow label="Group number" value={selected.group} />
          <DetailRow label="Deductible" value={selected.deductible} />
          <DetailRow label="Next appointment" value={selected.nextAppt} />
          {selected.coverage.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '10px' }}>COVERAGE BREAKDOWN</div>
              {selected.coverage.map(([label, pct], i) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.mid, marginBottom: '5px' }}><span>{label}</span><span style={{ fontWeight: '600', color: t.ink2 }}>{pct}</span></div>
                  <div style={{ height: '3px', borderRadius: '3px', background: t.border, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', background: t.brand, width: pct }} /></div>
                </div>
              ))}
            </div>
          )}
          <Btn primary style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} onClick={() => reverify(selected.name)}>
            <RotateCw size={14} /> Re-verify eligibility
          </Btn>
        </SlidePanel>
      )}
    </div>
  );
}

// ─── PORTAL ────────────────────────────────────────────────
const PORTAL_AVAILABLE_FORMS = [
  { name: 'New patient health history', Icon: FileText },
  { name: 'HIPAA consent form', Icon: FileText },
  { name: 'Treatment plan consent', Icon: FileText },
  { name: 'Insurance update form', Icon: FileText },
  { name: 'Financial responsibility agreement', Icon: FileText },
];

function Portal() {
  const t = useTheme();
  const formsCompletedThisWeek = 12;
  const formsThisWeekTotal = 15;
  const weekPct = Math.round((formsCompletedThisWeek / formsThisWeekTotal) * 100);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Forms pending" value="7" color={t.purple} accent={t.accentPurple} sub="Awaiting patient completion" decorIcon={ClipboardList} />
        <StatCard label="Completed this week" value="18" color={t.green} accent={t.accentGreen} sub="↑ 94% completion rate" decorIcon={Check} />
        <StatCard label="Docs e-signed" value="31" color={t.brand} accent={t.accentBlue} sub="No paper needed" decorIcon={FileText} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <CardTitle>Pending intake forms</CardTitle>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: t.muted, marginBottom: '5px' }}>
              <span>Completed this week</span><span>{formsCompletedThisWeek} of {formsThisWeekTotal}</span>
            </div>
            <div style={{ height: '3px', borderRadius: '2px', background: t.rowBorder, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${weekPct}%`, background: t.brand }} />
            </div>
          </div>
          {[['RP', t.redL, t.red, 'Robert Park', 'Emergency intake — due before 4pm today', true],
            ['JL', t.amberL, t.amber, 'James Lee', 'Crown consent form — sent Sep 10', false],
            ['MC', t.brandL, t.brand, 'Maria Chen', 'New patient health history — sent Sep 12', false],
          ].map(([ini, bg, c, name, sub, urgent], i) => (
            <RowItem key={i}>
              {urgent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.red, flexShrink: 0 }} />}
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{name}</PII></div><div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div></div>
              <Btn small primary={urgent}>Remind</Btn>
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Available forms</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {PORTAL_AVAILABLE_FORMS.map((form, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 6px' }}>
                <form.Icon size={16} color={t.muted} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '500', color: t.ink2, flex: 1, minWidth: 0 }}>{form.name}</span>
                <Btn ghost small>Send →</Btn>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── DOCUMENTS ─────────────────────────────────────────────
const DOCUMENT_CATEGORIES = ['All', 'Referrals', 'Lab Results', 'X-rays', 'Insurance', 'Consent Forms', 'Other'];

const DOCUMENTS_SEED = [
  { id: 'd1', name: 'Referral Letter — Endodontics Consult', category: 'Referrals', direction: 'received', who: 'Dr. Marcus Alvarez, Bayview Endodontics', date: 'Sep 12, 2026', size: '184 KB' },
  { id: 'd2', name: 'Referral Letter — Oral Surgery Consult', category: 'Referrals', direction: 'received', who: 'Dr. Elena Cho, Tampa Oral & Maxillofacial', date: 'Aug 28, 2026', size: '210 KB' },
  { id: 'd3', name: 'Lab Results — Crown Shade Match', category: 'Lab Results', direction: 'received', who: 'Precision Dental Lab', date: 'Sep 10, 2026', size: '96 KB' },
  { id: 'd4', name: 'Lab Results — Implant Fit Report', category: 'Lab Results', direction: 'received', who: 'Precision Dental Lab', date: 'Sep 3, 2026', size: '142 KB' },
  { id: 'd5', name: 'Panoramic X-ray', category: 'X-rays', direction: 'sent', who: 'James Lee', date: 'Sep 8, 2026', size: '3.2 MB' },
  { id: 'd6', name: 'Bitewing X-ray Set', category: 'X-rays', direction: 'sent', who: 'Maria Chen', date: 'Sep 5, 2026', size: '2.8 MB' },
  { id: 'd7', name: 'Insurance Pre-Authorization', category: 'Insurance', direction: 'sent', who: 'Aetna Dental', date: 'Sep 1, 2026', size: '78 KB' },
  { id: 'd8', name: 'Insurance EOB', category: 'Insurance', direction: 'received', who: 'Delta Dental', date: 'Aug 30, 2026', size: '64 KB' },
  { id: 'd9', name: 'Consent Form — Root Canal Treatment', category: 'Consent Forms', direction: 'received', who: 'Sarah Martinez', date: 'Sep 9, 2026', size: '42 KB' },
  { id: 'd10', name: 'HIPAA Acknowledgment Form', category: 'Consent Forms', direction: 'received', who: 'David Wong', date: 'Aug 25, 2026', size: '38 KB' },
  { id: 'd11', name: 'Practice Newsletter — September', category: 'Other', direction: 'sent', who: 'All active patients', date: 'Sep 1, 2026', size: '512 KB' },
];

function Documents({ contacts }) {
  const t = useTheme();
  const [documents, setDocuments] = useState(DOCUMENTS_SEED);
  const [tab, setTab] = useState('received');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', category: 'Referrals', recipient: '' });
  const [uploadProgress, setUploadProgress] = useState(null);
  const [shareNotice, setShareNotice] = useState('');
  const contactList = contacts || [];

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' };

  const filtered = documents
    .filter(d => d.direction === tab)
    .filter(d => category === 'All' || d.category === category)
    .filter(d => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return d.name.toLowerCase().includes(q) || d.who.toLowerCase().includes(q);
    });

  function handleShare(doc) {
    setShareNotice(`Share link for "${doc.name}" copied to clipboard (demo).`);
    setTimeout(() => setShareNotice(''), 3000);
  }

  function handleUpload() {
    if (!uploadForm.name.trim()) return;
    let progress = 0;
    setUploadProgress(0);
    const interval = setInterval(() => {
      progress += 20;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setDocuments(docs => [{
          id: `d-new-${Date.now()}`, name: uploadForm.name.trim(), category: uploadForm.category,
          direction: 'sent', who: uploadForm.recipient.trim() || 'Unassigned', date: 'Just now', size: '—',
        }, ...docs]);
        setTimeout(() => { setShowUpload(false); setUploadProgress(null); setUploadForm({ name: '', category: 'Referrals', recipient: '' }); }, 400);
      }
    }, 150);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['received', 'Received'], ['sent', 'Sent']].map(([key, label]) => (
            <button
              key={key} type="button" onClick={() => setTab(key)}
              style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: tab === key ? 'none' : `1px solid ${t.border}`, background: tab === key ? t.brand : t.bgCard, color: tab === key ? 'white' : t.mid, fontFamily: 'inherit' }}
            >{label}</button>
          ))}
        </div>
        <Btn primary onClick={() => setShowUpload(true)}><Upload size={14} /> Upload document</Btn>
      </div>

      <div style={{ position: 'relative', marginBottom: '12px', maxWidth: '360px' }}>
        <Search size={14} color={t.muted} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or sender…" style={{ ...inputStyle, padding: '9px 12px 9px 32px' }} />
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {DOCUMENT_CATEGORIES.map(cat => (
          <button
            key={cat} type="button" onClick={() => setCategory(cat)}
            style={{ padding: '6px 13px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: category === cat ? 'none' : `1px solid ${t.border}`, background: category === cat ? t.brand : t.bgCard, color: category === cat ? 'white' : t.mid, fontFamily: 'inherit' }}
          >{cat}</button>
        ))}
      </div>

      {shareNotice && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', background: t.tealL, borderRadius: '6px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}` }}>{shareNotice}</div>
      )}

      <Card>
        {filtered.length === 0 && <div style={{ fontSize: '13px', color: t.muted, textAlign: 'center', padding: '28px 0' }}>No documents match these filters.</div>}
        {filtered.map(doc => (
          <RowItem key={doc.id}>
            <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={17} color={t.brand} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
              <div style={{ fontSize: '11.5px', color: t.muted }}>{tab === 'received' ? 'From' : 'To'} <PII>{doc.who}</PII> · {doc.date} · {doc.size}</div>
            </div>
            <Pill label={doc.category} color={t.brand} bg={t.brandL} />
            <Btn small onClick={() => handleShare(doc)}><Send size={12} /> Share</Btn>
            <Btn small primary><Download size={12} /> Download</Btn>
          </RowItem>
        ))}
      </Card>

      {showUpload && (
        <Modal title="Upload document" onClose={() => !uploadProgress && setShowUpload(false)}>
          {uploadProgress === null ? (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Document name</label>
                <input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lab Results — Bridge Fit" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Category</label>
                <select value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  {DOCUMENT_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Recipient patient</label>
                <input
                  value={uploadForm.recipient}
                  onChange={e => setUploadForm(f => ({ ...f, recipient: e.target.value }))}
                  placeholder="Search patients…"
                  list="documents-patient-list"
                  style={inputStyle}
                />
                <datalist id="documents-patient-list">
                  {contactList.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>File</label>
                <input type="file" style={inputStyle} />
              </div>
              <Btn primary onClick={handleUpload}>Upload</Btn>
            </>
          ) : (
            <div style={{ padding: '10px 0' }}>
              <div style={{ fontSize: '13px', color: t.ink2, marginBottom: '10px' }}>Uploading "{uploadForm.name}"…</div>
              <div style={{ height: '8px', borderRadius: '6px', background: t.bgRow, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uploadProgress}%`, background: t.brand, transition: 'width .15s ease' }} />
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── WAITLIST ──────────────────────────────────────────────
const WAITLIST_SEED = [
  { id: 'w1', ini: 'MC', bg: 'brandL', c: 'brand', name: 'Maria Chen', service: 'Cleaning', pref: 'Any time this week', phone: '(555) 201-4482', waitingSince: 'Sep 9', notes: 'Prefers Dr. Alvarez. Flexible on days.' },
  { id: 'w2', ini: 'DW', bg: 'amberL', c: 'amber', name: 'David Wong', service: 'Cleaning', pref: 'Mornings preferred', phone: '(555) 774-1190', waitingSince: 'Sep 10', notes: 'Cannot do Fridays. Works near the office.' },
  { id: 'w3', ini: 'SK', bg: 'greenL', c: 'green', name: 'Sam Kim', service: 'Exam', pref: 'Afternoons only', phone: '(555) 330-8827', waitingSince: 'Sep 11', notes: 'New patient intake still needs to be finished.' },
  { id: 'w4', ini: 'PP', bg: 'purpleL', c: 'purple', name: 'Priya Patel', service: 'Whitening', pref: 'Weekends preferred', phone: '(555) 662-0093', waitingSince: 'Sep 12', notes: 'Asked to be notified by text only.' },
];

function Waitlist() {
  const t = useTheme();
  const [list, setList] = useState(WAITLIST_SEED);
  const [expandedId, setExpandedId] = useState(null);
  const colorMap = { brand: t.brand, amber: t.amber, green: t.green, purple: t.purple };
  const bgMap = { brandL: t.brandL, amberL: t.amberL, greenL: t.greenL, purpleL: t.purpleL };

  function move(index, dir) {
    setList(l => {
      const next = l.slice();
      const target = index + dir;
      if (target < 0 || target >= next.length) return l;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="On waitlist" value={String(list.length)} color={t.teal} accent={t.accentTeal} sub="Waiting for open slots" />
        <StatCard label="Slots filled this week" value="5" color={t.green} accent={t.accentGreen} sub="Auto-filled · no manual work" />
        <StatCard label="Avg fill time" value="8 min" color={t.brand} accent={t.accentBlue} sub="From cancellation to fill" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
        <Card>
          <CardTitle>Current waitlist</CardTitle>
          {list.map((p, i) => {
            const isExpanded = expandedId === p.id;
            const pillLabel = i === 0 ? 'Next up' : `#${i + 1}`;
            const pillColor = i === 0 ? t.brand : t.muted;
            const pillBg = i === 0 ? t.brandL : t.bgRow;
            return (
              <div key={p.id} style={{ borderBottom: `1px solid ${t.border2}` }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 0', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); move(i, -1); }}
                      disabled={i === 0}
                      style={{ width: '18px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: i === 0 ? t.border : t.muted, cursor: i === 0 ? 'default' : 'pointer', padding: 0 }}
                    ><ArrowUp size={12} /></button>
                    <button
                      onClick={e => { e.stopPropagation(); move(i, 1); }}
                      disabled={i === list.length - 1}
                      style={{ width: '18px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: i === list.length - 1 ? t.border : t.muted, cursor: i === list.length - 1 ? 'default' : 'pointer', padding: 0 }}
                    ><ArrowDown size={12} /></button>
                  </div>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.brandL, color: t.brand, fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <Ava initials={p.ini} bg={bgMap[p.bg]} color={colorMap[p.c]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{p.name}</PII></div>
                    <div style={{ fontSize: '11.5px', color: t.muted }}>{p.service} · {p.pref}</div>
                  </div>
                  <Pill label={pillLabel} color={pillColor} bg={pillBg} />
                  <ChevronDown size={14} color={t.muted} style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </div>
                {isExpanded && (
                  <div className="px-expand" style={{ padding: '0 0 14px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <DetailRow label="Phone" value={<PII>{p.phone}</PII>} />
                    <DetailRow label="Waiting since" value={p.waitingSince} />
                    <div style={{ gridColumn: '1 / -1' }}><DetailRow label="Notes" value={p.notes} /></div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: '10px', padding: '10px 12px', background: t.tealL, borderRadius: '6px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}`, display: 'flex', alignItems: 'center', gap: '7px' }}><Zap size={13} /> When a slot opens PraxisMD auto-texts the next patient. First to reply gets the spot.</div>
        </Card>
        <Card>
          <CardTitle>Recent auto-fills</CardTitle>
          {[['Today 2:30pm — filled in 4 min', 'Maria Chen accepted · David Wong declined'],
            ['Yesterday 10am — filled in 11 min', 'Sam Kim accepted the slot'],
            ['Sep 11 4pm — filled in 6 min', 'Priya Patel accepted the slot'],
          ].map(([title, sub], i) => (
            <RowItem key={i} style={{ justifyContent: 'space-between' }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{title}</div><div style={{ fontSize: '11.5px', color: t.muted }}><PII>{sub}</PII></div></div>
              <Pill label="Filled" color={t.green} bg={t.greenL} />
            </RowItem>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── CALENDAR ──────────────────────────────────────────────
const CAL_BASE_YEAR = 2026;
const CAL_BASE_MONTH = 8; // September (0-indexed)
const CAL_TODAY = { year: 2026, month: 8, day: 13 };

const CAL_NAME_POOL = ['Sarah Martinez', 'James Lee', 'Amy Kim', 'Robert Park', 'Maria Chen', 'David Wong', 'Tina Nguyen', 'Priya Patel', 'Sam Kim', 'Patricia Green', 'Mike Brown', 'Jordan Ellis'];
const CAL_TYPE_POOL = [['Cleaning', 60], ['Crown fitting', 90], ['Whitening', 45], ['Exam', 30], ['Filling', 45], ['Consultation', 30], ['Emergency', 30], ['Root canal', 90]];
const CAL_TIME_POOL = ['8:00 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM'];

function timeToMinutes(time) {
  const [, h, m, ap] = time.match(/(\d+):(\d+) (AM|PM)/) || [];
  let hours = parseInt(h, 10) % 12;
  if (ap === 'PM') hours += 12;
  return hours * 60 + parseInt(m, 10);
}

function formatApptTime12h(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

// Buckets GHL calendar events by local day, matching the same
// `${year}-${month}-${day}` key shape seedSeptemberAppointments() produces
// so the rest of Calendar() doesn't need to know which source it's reading.
function mapAppointmentsByDate(events) {
  const seed = {};
  (events || []).forEach(e => {
    if (!e.startTime) return;
    const start = new Date(e.startTime);
    if (Number.isNaN(start.getTime())) return;
    const end = e.endTime ? new Date(e.endTime) : null;
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    const duration = end && !Number.isNaN(end.getTime()) ? Math.round((end - start) / 60000) : null;
    const entry = {
      id: e.id,
      time: formatApptTime12h(start),
      patient: e.title || 'Appointment',
      type: e.appointmentStatus ? e.appointmentStatus.charAt(0).toUpperCase() + e.appointmentStatus.slice(1) : 'Appointment',
      duration,
    };
    (seed[key] || (seed[key] = [])).push(entry);
  });
  return seed;
}

function seedSeptemberAppointments() {
  const counts = { 13: 4, 15: 2, 16: 3, 17: 5, 18: 2, 20: 1, 22: 3, 23: 4, 24: 2, 27: 3, 29: 2, 30: 3 };
  const seed = {};
  Object.entries(counts).forEach(([day, n], di) => {
    seed[`${CAL_BASE_YEAR}-${CAL_BASE_MONTH}-${day}`] = Array.from({ length: n }).map((_, i) => {
      const idx = di * 7 + i;
      const [type, duration] = CAL_TYPE_POOL[idx % CAL_TYPE_POOL.length];
      return { id: `${day}-${i}`, time: CAL_TIME_POOL[(idx * 3) % CAL_TIME_POOL.length], patient: CAL_NAME_POOL[idx % CAL_NAME_POOL.length], type, duration };
    });
  });
  return seed;
}

function Calendar() {
  const t = useTheme();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState(`${CAL_BASE_YEAR}-${CAL_BASE_MONTH}-${CAL_TODAY.day}`);
  const [localAppointments, setLocalAppointments] = useState(seedSeptemberAppointments);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPatient, setNewPatient] = useState('');
  const [newTime, setNewTime] = useState(CAL_TIME_POOL[0]);
  const [newType, setNewType] = useState(CAL_TYPE_POOL[0][0]);

  const viewDate = new Date(CAL_BASE_YEAR, CAL_BASE_MONTH + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();

  const { data: apptData, loading: apptLoading, error: apptError, refetch: refetchAppts } =
    useGhlFetch(() => getAppointments({ startTime: monthStart, endTime: monthEnd }), [year, month]);
  const appointments = isGhlConfigured ? mapAppointmentsByDate(apptData) : localAppointments;

  const days = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  function keyFor(d) { return `${year}-${month}-${d}`; }
  const selectedList = (appointments[selectedKey] || []).slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const [, , selectedDay] = selectedKey.split('-');
  const selectedLabel = new Date(year, month, parseInt(selectedDay, 10)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  function addAppointment() {
    if (!newPatient.trim()) return;
    const entry = { id: `new-${Date.now()}`, time: newTime, patient: newPatient.trim(), type: newType, duration: (CAL_TYPE_POOL.find(([ty]) => ty === newType) || [null, 30])[1] };
    setLocalAppointments(a => ({ ...a, [selectedKey]: [...(a[selectedKey] || []), entry] }));
    setNewPatient('');
    setShowAddForm(false);
  }

  function removeAppointment(id) {
    setLocalAppointments(a => ({ ...a, [selectedKey]: (a[selectedKey] || []).filter(e => e.id !== id) }));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', alignItems: 'start' }}>
      <Card>
        <CardTitle>{monthLabel} <div style={{ display: 'flex', gap: '8px' }}><Btn small onClick={() => setMonthOffset(o => o - 1)}><ChevronLeft size={14} /> Prev</Btn><Btn small onClick={() => setMonthOffset(o => o + 1)}>Next <ChevronRight size={14} /></Btn></div></CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '6px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{ fontSize: '11px', color: t.muted, fontWeight: '600', textAlign: 'center', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '.5px' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const isToday = year === CAL_TODAY.year && month === CAL_TODAY.month && d === CAL_TODAY.day;
            const dayKey = keyFor(d);
            const has = (appointments[dayKey] || []).length;
            const isSelected = dayKey === selectedKey;
            return (
              <div
                key={i}
                onClick={() => { setSelectedKey(dayKey); setShowAddForm(false); }}
                className="px-btn"
                style={{
                  borderRadius: '6px', padding: '8px 6px', textAlign: 'center', cursor: 'pointer', minHeight: '54px',
                  border: `${isSelected ? '2px' : '1px'} solid ${isToday ? t.brand : isSelected ? t.teal : has ? withAlpha(t.accentBlue, .2) : t.border2}`,
                  background: isToday ? t.brand : has ? t.brandL : t.bgRow, transition: 'all .12s',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: isToday ? '700' : has ? '500' : '400', color: isToday ? 'white' : has ? t.ink2 : t.muted }}>{d}</div>
                {has > 0 && <div style={{ fontSize: '10px', marginTop: '3px', color: isToday ? 'rgba(255,255,255,.85)' : t.brand, fontWeight: '600' }}>{has} apt{has > 1 ? 's' : ''}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${t.border2}` }}>
          {[[t.brand, 'Today'], [t.brandL, 'Has appointments'], [t.bgRow, 'Available']].map(([bg, label], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: t.muted }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: bg, border: `1px solid ${t.border}` }} />{label}
            </div>
          ))}
        </div>
      </Card>

      {isGhlConfigured && apptLoading ? (
        <LoadingState label="Loading appointments…" />
      ) : isGhlConfigured && apptError ? (
        <ErrorState message={apptError} onRetry={refetchAppts} />
      ) : (
        <Card>
          <CardTitle>{selectedLabel}</CardTitle>
          {selectedList.length === 0 && !showAddForm && (
            <div style={{ padding: '20px', textAlign: 'center', color: t.muted, fontSize: '13px' }}>No appointments this day.</div>
          )}
          {selectedList.map((appt, i) => {
            const [color, bg] = avatarStyle(t, i);
            return (
              <RowItem key={appt.id}>
                <div style={{ fontSize: '11.5px', color: t.muted, width: '60px', flexShrink: 0, fontWeight: '500' }}>{appt.time}</div>
                <Ava initials={initialsOf(appt.patient)} bg={bg} color={color} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{appt.patient}</PII></div>
                  <div style={{ fontSize: '11.5px', color: t.muted }}>{appt.type}{appt.duration ? ` · ${appt.duration} min` : ''}</div>
                </div>
                {!isGhlConfigured && (
                  <button onClick={() => removeAppointment(appt.id)} title="Remove" style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', padding: '4px', display: 'flex' }}>
                    <X size={14} />
                  </button>
                )}
              </RowItem>
            );
          })}

          {isGhlConfigured ? (
            <div style={{ marginTop: selectedList.length ? '8px' : '0', padding: '10px 12px', background: t.bgRow, borderRadius: '6px', fontSize: '12px', color: t.muted, textAlign: 'center' }}>
              Appointments sync from GoHighLevel — book or edit them there.
            </div>
          ) : showAddForm ? (
            <div style={{ background: t.bgRow, border: `1px solid ${t.border2}`, borderRadius: '6px', padding: '12px', marginTop: '8px' }}>
              <input value={newPatient} onChange={e => setNewPatient(e.target.value)} placeholder="Patient name" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, marginBottom: '8px', boxSizing: 'border-box' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <select value={newTime} onChange={e => setNewTime(e.target.value)} style={{ padding: '8px 10px', border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2 }}>
                  {CAL_TIME_POOL.map(time => <option key={time} value={time}>{time}</option>)}
                </select>
                <select value={newType} onChange={e => setNewType(e.target.value)} style={{ padding: '8px 10px', border: `1px solid ${t.border}`, borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2 }}>
                  {CAL_TYPE_POOL.map(([type]) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn small onClick={() => setShowAddForm(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                <Btn small primary onClick={addAppointment} style={{ flex: 1, justifyContent: 'center' }}>Add</Btn>
              </div>
            </div>
          ) : (
            <Btn primary style={{ width: '100%', justifyContent: 'center', marginTop: selectedList.length ? '8px' : '0' }} onClick={() => setShowAddForm(true)}>
              <Plus size={14} /> Add appointment
            </Btn>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── APPOINTMENT REQUESTS ──────────────────────────────────
const DOCTORS_SEED = ['Dr. Rivera', 'Dr. Alvarez', 'Dr. Cho', 'Any available doctor'];
const REQUEST_APPT_TYPES_SEED = ['Cleaning', 'Filling', 'Crown', 'Root Canal', 'Implant', 'Veneer', 'Emergency Exam', 'Consultation'];
const DEPOSIT_TYPES = ['Crown', 'Implant', 'Veneer'];

const BRIEFING_ITEM_META = [
  { key: 'appointments', label: "Today's appointments count", value: 4, format: n => `${n} appointments today` },
  { key: 'messages', label: 'Unread messages', value: 4, format: n => `${n} unread messages` },
  { key: 'recall', label: 'Patients due for recall today', value: 3, format: n => `${n} patients due for recall` },
  { key: 'claims', label: 'Pending claims', value: 5, format: n => `${n} pending claims` },
  { key: 'revenue', label: 'Revenue recovered yesterday', value: 1200, format: n => `$${n.toLocaleString()} recovered yesterday` },
  { key: 'security', label: 'Security events', value: 1, format: n => `${n} security event${n === 1 ? '' : 's'} flagged` },
];

const ACTIVE_SESSIONS_SEED = [
  { id: 's1', device: 'desktop', browser: 'Chrome on macOS', location: 'Tampa, FL', lastActive: 'Active now', current: true },
  { id: 's2', device: 'mobile', browser: 'Safari on iPhone', location: 'Tampa, FL', lastActive: '2 hours ago', current: false },
  { id: 's3', device: 'desktop', browser: 'Chrome on Windows', location: 'Orlando, FL', lastActive: 'Yesterday at 4:12 PM', current: false },
];

function formatTime12h(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const APPOINTMENT_REQUESTS_SEED = [
  { id: 'ar1', patientName: 'Sarah Malone', requestedDate: 'Sep 22, 2026', preferredTime: 'Morning (9–11am)', apptType: 'Cleaning', requestedDoctor: 'Dr. Rivera', insurance: 'Delta Dental — Active', notes: 'Prefers an early appointment, works nights.', status: 'pending', emergency: false, conflict: false },
  { id: 'ar2', patientName: 'Tom Alvarez', requestedDate: 'Sep 20, 2026', preferredTime: 'ASAP', apptType: 'Emergency Exam', requestedDoctor: 'Any available doctor', insurance: 'Cigna Dental — Active', notes: 'Severe tooth pain since last night, possible abscess.', status: 'pending', emergency: true, conflict: false },
  { id: 'ar3', patientName: 'Priya Patel', requestedDate: 'Sep 25, 2026', preferredTime: 'Afternoon (1–3pm)', apptType: 'Crown', requestedDoctor: 'Dr. Alvarez', insurance: 'Aetna — Active', notes: 'Follow-up on the temporary crown from last visit.', status: 'pending', emergency: false, conflict: false },
  { id: 'ar4', patientName: 'James Coleman Jr.', requestedDate: 'Sep 19, 2026', preferredTime: 'Morning (9–11am)', apptType: 'Implant Consultation', requestedDoctor: 'Dr. Cho', insurance: 'No insurance on file', notes: 'Requested slot conflicts with Dr. Cho’s existing 9:30am booking — needs rescheduling.', status: 'pending', emergency: false, conflict: true },
  { id: 'ar5', patientName: 'Angela Ruiz', requestedDate: 'Sep 15, 2026', preferredTime: 'Afternoon (1–3pm)', apptType: 'Cleaning', requestedDoctor: 'Any available doctor', insurance: 'MetLife — Active', notes: 'Regular 6-month cleaning.', status: 'confirmed', emergency: false, conflict: false },
];

function AppointmentRequests() {
  const t = useTheme();
  const [requests, setRequests] = useState(APPOINTMENT_REQUESTS_SEED);
  const [filter, setFilter] = useState('All');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [suggestTarget, setSuggestTarget] = useState(null);
  const [confirmForm, setConfirmForm] = useState({ date: '', time: '', doctor: '', notes: '' });
  const [declineMessage, setDeclineMessage] = useState('');
  const [suggestTime, setSuggestTime] = useState('');
  const [notice, setNotice] = useState('');

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' };

  const confirmedCount = requests.filter(r => r.status === 'confirmed').length;
  const declinedCount = requests.filter(r => r.status === 'declined').length;
  const resolvedCount = confirmedCount + declinedCount;
  const confirmationRate = resolvedCount > 0 ? Math.round((confirmedCount / resolvedCount) * 100) : 100;

  const filtered = requests.filter(r => {
    if (filter === 'Pending') return r.status === 'pending';
    if (filter === 'Confirmed') return r.status === 'confirmed';
    if (filter === 'Declined') return r.status === 'declined';
    return true;
  });

  function openConfirm(r) {
    setConfirmForm({ date: r.requestedDate, time: r.preferredTime, doctor: r.requestedDoctor, notes: '' });
    setConfirmTarget(r);
  }

  function submitConfirm() {
    setRequests(rs => rs.map(r => r.id === confirmTarget.id ? { ...r, status: 'confirmed', assignedDoctor: confirmForm.doctor } : r));
    setNotice(`Confirmation sent to ${confirmTarget.patientName} for ${confirmForm.date}, ${confirmForm.time} with ${confirmForm.doctor}.`);
    setConfirmTarget(null);
    setTimeout(() => setNotice(''), 4000);
  }

  function submitDecline() {
    setRequests(rs => rs.map(r => r.id === declineTarget.id ? { ...r, status: 'declined' } : r));
    setNotice(`Decline sent to ${declineTarget.patientName}${declineMessage.trim() ? ' with your message.' : '.'}`);
    setDeclineTarget(null);
    setDeclineMessage('');
    setTimeout(() => setNotice(''), 4000);
  }

  function submitSuggestion() {
    setNotice(`Alternate time "${suggestTime}" suggested to ${suggestTarget.patientName}.`);
    setSuggestTarget(null);
    setSuggestTime('');
    setTimeout(() => setNotice(''), 4000);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Total requests this week" value={String(requests.length)} color={t.brand} accent={t.accentBlue} sub="Across all channels" />
        <StatCard label="Average response time" value="38 min" color={t.teal} accent={t.accentTeal} sub="From request to reply" />
        <StatCard label="Confirmation rate" value={`${confirmationRate}%`} color={t.green} accent={t.accentGreen} sub="Of resolved requests" />
      </div>

      {notice && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.greenL, borderRadius: '6px', fontSize: '12.5px', color: t.green, border: `1px solid ${withAlpha(t.accentGreen, .15)}` }}>{notice}</div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        <FilterPillGroup options={['All', 'Pending', 'Confirmed', 'Declined']} value={filter} onChange={setFilter} />
      </div>

      {filtered.length === 0 && <Card style={{ textAlign: 'center', padding: '32px', color: t.muted }}>No requests match this filter.</Card>}

      {filtered.map(r => (
        <Card key={r.id} className="px-card" style={{ marginBottom: '12px', borderColor: r.emergency ? withAlpha(t.accentRed, .3) : undefined }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Ava initials={initialsOf(r.patientName)} bg={r.emergency ? t.redL : t.brandL} color={r.emergency ? t.red : t.brand} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}><PII>{r.patientName}</PII></span>
                {r.emergency && <Pill label="Emergency" color={t.red} bg={t.redL} />}
                {r.conflict && <Pill label="Scheduling conflict" color={t.amber} bg={t.amberL} />}
                {r.status !== 'pending' && <Pill label={r.status === 'confirmed' ? 'Confirmed' : 'Declined'} color={r.status === 'confirmed' ? t.green : t.muted} bg={r.status === 'confirmed' ? t.greenL : t.bgRow} />}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 18px', fontSize: '12.5px', color: t.mid, marginBottom: '8px' }}>
                <div><span style={{ color: t.muted }}>Requested:</span> {r.requestedDate} · {r.preferredTime}</div>
                <div><span style={{ color: t.muted }}>Type:</span> {r.apptType}</div>
                <div><span style={{ color: t.muted }}>Doctor requested:</span> {r.requestedDoctor}</div>
                <div><span style={{ color: t.muted }}>Insurance:</span> {r.insurance}</div>
              </div>
              {r.notes && <div style={{ fontSize: '12.5px', color: t.ink2, background: t.bgRow, borderRadius: '8px', padding: '8px 11px', marginBottom: r.status === 'pending' ? '10px' : 0 }}>{r.notes}</div>}
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Btn small primary onClick={() => openConfirm(r)}><Check size={12} /> Confirm</Btn>
                  <Btn small onClick={() => setDeclineTarget(r)}>Decline</Btn>
                  <Btn small onClick={() => setSuggestTarget(r)}><Clock size={12} /> Suggest different time</Btn>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}

      {confirmTarget && (
        <Modal title={`Confirm — ${confirmTarget.patientName}`} onClose={() => setConfirmTarget(null)}>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Date</label>
            <input value={confirmForm.date} onChange={e => setConfirmForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Time</label>
            <input value={confirmForm.time} onChange={e => setConfirmForm(f => ({ ...f, time: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Assign to doctor</label>
            <select value={confirmForm.doctor} onChange={e => setConfirmForm(f => ({ ...f, doctor: e.target.value }))} style={inputStyle}>
              {DOCTORS_SEED.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Internal notes (optional)</label>
            <textarea value={confirmForm.notes} onChange={e => setConfirmForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <Btn primary onClick={submitConfirm}><Send size={13} /> Send confirmation</Btn>
        </Modal>
      )}

      {declineTarget && (
        <Modal title={`Decline — ${declineTarget.patientName}`} onClose={() => setDeclineTarget(null)}>
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Message to patient (optional)</label>
            <textarea
              value={declineMessage} onChange={e => setDeclineMessage(e.target.value)} rows={4}
              placeholder="Explain why, and suggest they call the office to reschedule…"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <Btn primary onClick={submitDecline}><Send size={13} /> Send decline</Btn>
        </Modal>
      )}

      {suggestTarget && (
        <Modal title={`Suggest a different time — ${suggestTarget.patientName}`} onClose={() => setSuggestTarget(null)}>
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Suggested date & time</label>
            <input value={suggestTime} onChange={e => setSuggestTime(e.target.value)} placeholder="e.g. Sep 23, 2:00pm" style={inputStyle} />
          </div>
          <Btn primary onClick={submitSuggestion} disabled={!suggestTime.trim()}><Send size={13} /> Send suggestion</Btn>
        </Modal>
      )}
    </div>
  );
}

// ─── TREATMENT PLANS ───────────────────────────────────────
const TREATMENT_PLANS_SEED = [
  {
    id: 'tp1', patientName: 'James Lee', planName: 'Full Mouth Restoration', createdDate: 'Aug 20, 2026',
    procedures: [
      { code: 'D2740', name: 'Crown', cost: 1200, status: 'Accepted' },
      { code: 'D2740', name: 'Crown', cost: 1200, status: 'Accepted' },
      { code: 'D4341', name: 'Periodontal Scaling', cost: 280, status: 'Pending' },
    ],
  },
  {
    id: 'tp2', patientName: 'Robert Park', planName: 'Implant Replacement', createdDate: 'Sep 5, 2026',
    procedures: [
      { code: 'D6010', name: 'Implant Placement', cost: 3200, status: 'Pending' },
      { code: 'D1110', name: 'Cleaning', cost: 150, status: 'Accepted' },
    ],
  },
  {
    id: 'tp3', patientName: 'Sarah Martinez', planName: 'Preventive Care Plan', createdDate: 'Jul 12, 2026',
    procedures: [
      { code: 'D1110', name: 'Cleaning', cost: 150, status: 'Accepted' },
      { code: 'D1110', name: 'Cleaning', cost: 150, status: 'Accepted' },
    ],
  },
  {
    id: 'tp4', patientName: 'David Wong', planName: 'Crown & Scaling', createdDate: 'Sep 1, 2026',
    procedures: [
      { code: 'D2740', name: 'Crown', cost: 1200, status: 'Declined' },
      { code: 'D4341', name: 'Scaling', cost: 280, status: 'Accepted' },
    ],
  },
];

const PROC_STATUS_COLOR = { Accepted: 'green', Pending: 'amber', Declined: 'red' };

function TreatmentPlans({ contacts }) {
  const t = useTheme();
  const [plans, setPlans] = useState(TREATMENT_PLANS_SEED);
  const [view, setView] = useState('active');
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ patient: '', planName: '', procedures: [{ code: '', cost: '' }] });
  const [sentNotice, setSentNotice] = useState('');
  const contactList = contacts || [];

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' };

  const enriched = plans.map(p => {
    const totalValue = p.procedures.reduce((sum, pr) => sum + pr.cost, 0);
    const accepted = p.procedures.filter(pr => pr.status === 'Accepted').length;
    const pending = p.procedures.filter(pr => pr.status === 'Pending').length;
    const declined = p.procedures.filter(pr => pr.status === 'Declined').length;
    const isActive = pending > 0;
    const statusLabel = isActive ? 'In progress' : (declined > 0 && accepted === 0 ? 'Declined' : 'Completed');
    return { ...p, totalValue, accepted, pending, declined, isActive, statusLabel };
  });

  const visible = enriched.filter(p => view === 'active' ? p.isActive : !p.isActive);

  const allProcedures = enriched.flatMap(p => p.procedures);
  const resolvedProcedures = allProcedures.filter(pr => pr.status === 'Accepted' || pr.status === 'Declined');
  const acceptanceRate = resolvedProcedures.length > 0
    ? Math.round((resolvedProcedures.filter(pr => pr.status === 'Accepted').length / resolvedProcedures.length) * 100)
    : 0;

  function addProcedureRow() {
    setCreateForm(f => ({ ...f, procedures: [...f.procedures, { code: '', cost: '' }] }));
  }

  function updateProcedureRow(i, field, value) {
    setCreateForm(f => ({ ...f, procedures: f.procedures.map((p, j) => j === i ? { ...p, [field]: value } : p) }));
  }

  function createPlan() {
    if (!createForm.patient.trim() || !createForm.planName.trim()) return;
    const procedures = createForm.procedures
      .filter(p => p.code.trim() && p.cost)
      .map(p => ({ code: p.code.trim(), name: p.code.trim(), cost: Number(p.cost) || 0, status: 'Pending' }));
    setPlans(list => [{
      id: `tp-new-${Date.now()}`, patientName: createForm.patient.trim(), planName: createForm.planName.trim(),
      createdDate: 'Just now', procedures: procedures.length ? procedures : [{ code: '—', name: '—', cost: 0, status: 'Pending' }],
    }, ...list]);
    setShowCreate(false);
    setCreateForm({ patient: '', planName: '', procedures: [{ code: '', cost: '' }] });
  }

  function sendToPatient(plan) {
    setSentNotice(`Payment and approval link sent to ${plan.patientName} via SMS.`);
    setTimeout(() => setSentNotice(''), 4000);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Treatment acceptance rate" value={`${acceptanceRate}%`} color={acceptanceRate >= 70 ? t.green : t.amber} accent={acceptanceRate >= 70 ? t.accentGreen : t.accentAmber} sub={`Industry average: 70%`} />
        <StatCard label="Active plan value" value={`$${enriched.filter(p => p.isActive).reduce((s, p) => s + p.totalValue, 0).toLocaleString()}`} color={t.brand} accent={t.accentBlue} sub="Across in-progress plans" />
        <StatCard label="Plans this month" value={String(plans.length)} color={t.purple} accent={t.accentPurple} sub="Created across all patients" />
      </div>

      {sentNotice && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.greenL, borderRadius: '6px', fontSize: '12.5px', color: t.green, border: `1px solid ${withAlpha(t.accentGreen, .15)}` }}>{sentNotice}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['active', 'Active Plans'], ['history', 'History']].map(([key, label]) => (
            <button
              key={key} type="button" onClick={() => setView(key)}
              style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: view === key ? 'none' : `1px solid ${t.border}`, background: view === key ? t.brand : t.bgCard, color: view === key ? 'white' : t.mid, fontFamily: 'inherit' }}
            >{label}</button>
          ))}
        </div>
        <Btn primary onClick={() => setShowCreate(true)}><Plus size={14} /> Create treatment plan</Btn>
      </div>

      {visible.length === 0 && <Card style={{ textAlign: 'center', padding: '32px', color: t.muted }}>No {view === 'active' ? 'active' : 'completed'} plans.</Card>}

      {visible.map(p => {
        const isExpanded = expandedId === p.id;
        const total = p.procedures.length;
        return (
          <Card key={p.id} className="px-card" style={{ marginBottom: '12px' }}>
            <div onClick={() => setExpandedId(isExpanded ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <Ava initials={initialsOf(p.patientName)} bg={t.brandL} color={t.brand} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}><PII>{p.patientName}</PII></span>
                  <span style={{ fontSize: '12.5px', color: t.muted }}>· {p.planName}</span>
                </div>
                <div style={{ fontSize: '11.5px', color: t.muted }}>${p.totalValue.toLocaleString()} · {total} procedure{total === 1 ? '' : 's'} · Created {p.createdDate}</div>
                <div style={{ display: 'flex', height: '3px', borderRadius: '3px', overflow: 'hidden', marginTop: '8px', background: t.bgRow }}>
                  {p.accepted > 0 && <div style={{ width: `${(p.accepted / total) * 100}%`, background: t.green }} />}
                  {p.pending > 0 && <div style={{ width: `${(p.pending / total) * 100}%`, background: t.amber }} />}
                  {p.declined > 0 && <div style={{ width: `${(p.declined / total) * 100}%`, background: t.red }} />}
                </div>
              </div>
              <Pill label={p.statusLabel} color={p.isActive ? t.amber : (p.statusLabel === 'Declined' ? t.red : t.green)} bg={p.isActive ? t.amberL : (p.statusLabel === 'Declined' ? t.redL : t.greenL)} />
              <ChevronDown size={16} color={t.muted} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease', flexShrink: 0 }} />
            </div>
            {isExpanded && (
              <div className="px-expand" style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${t.border2}` }}>
                {p.procedures.map((pr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: i < p.procedures.length - 1 ? `1px solid ${t.border2}` : 'none' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '600', color: t.muted, width: '54px', flexShrink: 0 }}>{pr.code}</span>
                    <span style={{ flex: 1, fontSize: '13px', color: t.ink2 }}>{pr.name}</span>
                    <span style={{ fontSize: '13px', color: t.mid, width: '70px', textAlign: 'right' }}>${pr.cost.toLocaleString()}</span>
                    <Pill label={pr.status} color={t[PROC_STATUS_COLOR[pr.status]]} bg={t[`${PROC_STATUS_COLOR[pr.status]}L`]} />
                  </div>
                ))}
                {p.isActive && (
                  <Btn small primary style={{ marginTop: '10px' }} onClick={() => sendToPatient(p)}><Send size={12} /> Send to patient</Btn>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {showCreate && (
        <Modal title="Create treatment plan" onClose={() => setShowCreate(false)}>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Patient</label>
            <input value={createForm.patient} onChange={e => setCreateForm(f => ({ ...f, patient: e.target.value }))} placeholder="Search patients…" list="tp-patient-list" style={inputStyle} />
            <datalist id="tp-patient-list">
              {contactList.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Plan name</label>
            <input value={createForm.planName} onChange={e => setCreateForm(f => ({ ...f, planName: e.target.value }))} placeholder="e.g. Crown & Root Canal" style={inputStyle} />
          </div>
          <label style={labelStyle}>Procedures</label>
          {createForm.procedures.map((pr, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input value={pr.code} onChange={e => updateProcedureRow(i, 'code', e.target.value)} placeholder="Code / name (e.g. D2740 Crown)" style={{ ...inputStyle, flex: 2 }} />
              <input value={pr.cost} onChange={e => updateProcedureRow(i, 'cost', e.target.value)} placeholder="Cost" type="number" style={{ ...inputStyle, flex: 1 }} />
            </div>
          ))}
          <Btn small onClick={addProcedureRow} style={{ marginBottom: '18px' }}><Plus size={12} /> Add procedure</Btn>
          <Btn primary onClick={createPlan}>Create plan</Btn>
        </Modal>
      )}
    </div>
  );
}

// ─── MEMBERSHIP PLANS ──────────────────────────────────────
const MEMBERSHIP_PLANS_SEED = [
  { id: 'mp1', name: 'Basic', monthlyPrice: 29, annualPrice: 299, benefits: ['2 cleanings per year', '1 X-ray set per year', '10% off all other procedures'] },
  { id: 'mp2', name: 'Premium', monthlyPrice: 49, annualPrice: 499, benefits: ['Everything in Basic', 'Free teeth whitening once a year', 'Priority scheduling'] },
];

const MEMBERSHIP_MEMBERS_SEED = [
  { id: 'mm1', patientName: 'Maria Chen', planId: 'mp2', joinDate: 'Jan 15, 2026', nextBilling: 'Oct 15, 2026', status: 'Active' },
  { id: 'mm2', patientName: 'David Wong', planId: 'mp1', joinDate: 'Mar 3, 2026', nextBilling: 'Oct 3, 2026', status: 'Active' },
  { id: 'mm3', patientName: 'Sarah Martinez', planId: 'mp2', joinDate: 'May 20, 2026', nextBilling: 'Oct 20, 2026', status: 'Active' },
  { id: 'mm4', patientName: 'James Lee', planId: 'mp1', joinDate: 'Jul 8, 2026', nextBilling: 'Sep 8, 2026', status: 'Failed' },
  { id: 'mm5', patientName: 'Priya Patel', planId: 'mp1', joinDate: 'Aug 1, 2026', nextBilling: 'Oct 1, 2026', status: 'Active' },
];

function MembershipPlans() {
  const t = useTheme();
  const [plans, setPlans] = useState(MEMBERSHIP_PLANS_SEED);
  const [members] = useState(MEMBERSHIP_MEMBERS_SEED);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', monthlyPrice: '', annualPrice: '', benefits: [''] });
  const [linkNotice, setLinkNotice] = useState('');

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' };

  const planById = Object.fromEntries(plans.map(p => [p.id, p]));
  const activeMembers = members.filter(m => m.status === 'Active');
  const mrr = activeMembers.reduce((sum, m) => sum + (planById[m.planId]?.monthlyPrice || 0), 0);

  function planStats(plan) {
    const planMembers = activeMembers.filter(m => m.planId === plan.id);
    return { count: planMembers.length, revenue: planMembers.length * plan.monthlyPrice };
  }

  function updateBenefit(i, value) {
    setCreateForm(f => ({ ...f, benefits: f.benefits.map((b, j) => j === i ? value : b) }));
  }

  function addBenefitRow() {
    setCreateForm(f => ({ ...f, benefits: [...f.benefits, ''] }));
  }

  function createPlan() {
    if (!createForm.name.trim() || !createForm.monthlyPrice) return;
    setPlans(list => [...list, {
      id: `mp-new-${Date.now()}`, name: createForm.name.trim(),
      monthlyPrice: Number(createForm.monthlyPrice) || 0, annualPrice: Number(createForm.annualPrice) || 0,
      benefits: createForm.benefits.filter(b => b.trim()),
    }]);
    setShowCreate(false);
    setCreateForm({ name: '', monthlyPrice: '', annualPrice: '', benefits: [''] });
  }

  function generateLink() {
    setLinkNotice('Stripe payment link generated: pay.stripe.com/praxismd-' + (createForm.name.trim().toLowerCase().replace(/\s+/g, '-') || 'plan') + ' (demo)');
    setTimeout(() => setLinkNotice(''), 5000);
  }

  const monthlyNum = Number(createForm.monthlyPrice) || 0;
  const annualNum = Number(createForm.annualPrice) || 0;
  const annualSavings = monthlyNum > 0 && annualNum > 0 ? Math.max(0, monthlyNum * 12 - annualNum) : 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="Total members" value={String(members.length)} color={t.brand} accent={t.accentBlue} sub={`${activeMembers.length} active`} />
        <StatCard label="Monthly recurring revenue" value={`$${mrr.toLocaleString()}`} color={t.green} accent={t.accentGreen} sub="From active memberships" />
        <StatCard label="Members added this month" value="3" color={t.purple} accent={t.accentPurple} sub="↑ growing steadily" />
      </div>

      <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink, marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Plans
        <Btn primary onClick={() => setShowCreate(true)}><Plus size={14} /> Create membership plan</Btn>
      </div>

      {linkNotice && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.tealL, borderRadius: '6px', fontSize: '12.5px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}`, wordBreak: 'break-all' }}>{linkNotice}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        {plans.map(plan => {
          const stats = planStats(plan);
          return (
            <Card key={plan.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: t.ink }}>{plan.name}</span>
                <Pill label={`${stats.count} members`} color={t.brand} bg={t.brandL} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '24px', fontWeight: '800', color: t.ink }}>${plan.monthlyPrice}</span>
                <span style={{ fontSize: '12px', color: t.muted }}>/mo · ${plan.annualPrice}/yr</span>
              </div>
              <div style={{ fontSize: '12px', color: t.green, fontWeight: '600', marginBottom: '12px' }}>${stats.revenue.toLocaleString()}/mo revenue</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {plan.benefits.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: t.mid }}>
                    <Check size={13} color={t.green} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>Active members</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 0.9fr 1fr 1fr 0.8fr', gap: '8px', padding: '0 4px 8px', fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px' }}>
          <div>Patient</div><div>Plan</div><div>Monthly</div><div>Join date</div><div>Next billing</div><div>Status</div>
        </div>
        {members.map(m => {
          const plan = planById[m.planId];
          return (
            <div key={m.id} className="px-row" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 0.9fr 1fr 1fr 0.8fr', gap: '8px', alignItems: 'center', padding: '10px 4px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Ava initials={initialsOf(m.patientName)} bg={t.brandL} color={t.brand} />
                <span style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}><PII>{m.patientName}</PII></span>
              </div>
              <div style={{ fontSize: '12.5px', color: t.mid }}>{plan?.name}</div>
              <div style={{ fontSize: '12.5px', color: t.ink2 }}>${plan?.monthlyPrice}</div>
              <div style={{ fontSize: '12.5px', color: t.muted }}>{m.joinDate}</div>
              <div style={{ fontSize: '12.5px', color: t.muted }}>{m.nextBilling}</div>
              <Pill label={m.status} color={m.status === 'Active' ? t.green : t.red} bg={m.status === 'Active' ? t.greenL : t.redL} />
            </div>
          );
        })}
      </Card>

      {showCreate && (
        <Modal title="Create membership plan" onClose={() => setShowCreate(false)}>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Plan name</label>
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Family Plan" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '6px' }}>
            <div>
              <label style={labelStyle}>Monthly price</label>
              <input value={createForm.monthlyPrice} onChange={e => setCreateForm(f => ({ ...f, monthlyPrice: e.target.value }))} type="number" placeholder="39" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Annual price</label>
              <input value={createForm.annualPrice} onChange={e => setCreateForm(f => ({ ...f, annualPrice: e.target.value }))} type="number" placeholder="399" style={inputStyle} />
            </div>
          </div>
          {annualSavings > 0 && <div style={{ fontSize: '11.5px', color: t.green, marginBottom: '12px' }}>Patients save ${annualSavings}/year paying annually.</div>}
          <label style={labelStyle}>Benefits</label>
          {createForm.benefits.map((b, i) => (
            <input key={i} value={b} onChange={e => updateBenefit(i, e.target.value)} placeholder="e.g. 2 cleanings per year" style={{ ...inputStyle, marginBottom: '8px' }} />
          ))}
          <Btn small onClick={addBenefitRow} style={{ marginBottom: '14px' }}><Plus size={12} /> Add benefit</Btn>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn onClick={generateLink}><CreditCard size={13} /> Generate Stripe payment link</Btn>
            <Btn primary onClick={createPlan}>Create plan</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── REPORTS ───────────────────────────────────────────────
const REPORTS_PERIODS = ['September 2026', 'August', 'July', 'Q3 2026'];

const REPORTS_DATA = {
  'September 2026': {
    stats: [['Revenue recovered', '$8,400', 'green', '↑ 24% vs last month'], ['New appointments', '31', 'brand', '↑ 8 from campaigns'], ['Patient retention', '87%', 'teal', '↑ 4% improvement']],
    metrics: [
      ['Reactivation emails sent', '847', 'brand'], ['SMS messages sent', '312', 'brand'],
      ['Email open rate', '34%', 'brand'], ['Reply rate', '18%', 'brand'],
      ['Cost per booked appointment', '$35', 'green'], ['Recall conversion rate', '38%', 'teal'],
      ['Reviews collected', '6', 'amber'], ['Average Google rating', '4.8', 'amber'],
      ['NPS score', '72', 'pink'], ['Waitlist slots filled', '14', 'orange'],
      ['Insurance denials prevented', '$2,840', 'green'], ['AI front desk calls', '847', 'purple'],
      ['Claims submitted', '48', 'purple'], ['Claims paid · revenue', '39 · $28,400', 'green'],
      ['AI hours saved total', '~68 hrs', 'green'],
    ],
  },
  'August': {
    stats: [['Revenue recovered', '$6,780', 'green', '↑ 11% vs July'], ['New appointments', '27', 'brand', '↑ 3 from campaigns'], ['Patient retention', '84%', 'teal', '↑ 1% improvement']],
    metrics: [
      ['Reactivation emails sent', '792', 'brand'], ['SMS messages sent', '288', 'brand'],
      ['Email open rate', '31%', 'brand'], ['Reply rate', '16%', 'brand'],
      ['Cost per booked appointment', '$38', 'green'], ['Recall conversion rate', '35%', 'teal'],
      ['Reviews collected', '5', 'amber'], ['Average Google rating', '4.7', 'amber'],
      ['NPS score', '69', 'pink'], ['Waitlist slots filled', '11', 'orange'],
      ['Insurance denials prevented', '$2,100', 'green'], ['AI front desk calls', '760', 'purple'],
      ['Claims submitted', '44', 'purple'], ['Claims paid · revenue', '36 · $24,900', 'green'],
      ['AI hours saved total', '~61 hrs', 'green'],
    ],
  },
  'July': {
    stats: [['Revenue recovered', '$5,920', 'green', '↑ 6% vs June'], ['New appointments', '24', 'brand', '↑ 2 from campaigns'], ['Patient retention', '83%', 'teal', 'Flat vs June']],
    metrics: [
      ['Reactivation emails sent', '710', 'brand'], ['SMS messages sent', '254', 'brand'],
      ['Email open rate', '29%', 'brand'], ['Reply rate', '15%', 'brand'],
      ['Cost per booked appointment', '$41', 'green'], ['Recall conversion rate', '33%', 'teal'],
      ['Reviews collected', '4', 'amber'], ['Average Google rating', '4.7', 'amber'],
      ['NPS score', '67', 'pink'], ['Waitlist slots filled', '9', 'orange'],
      ['Insurance denials prevented', '$1,780', 'green'], ['AI front desk calls', '690', 'purple'],
      ['Claims submitted', '40', 'purple'], ['Claims paid · revenue', '33 · $21,300', 'green'],
      ['AI hours saved total', '~55 hrs', 'green'],
    ],
  },
  'Q3 2026': {
    stats: [['Revenue recovered', '$21,100', 'green', '↑ 18% vs Q2'], ['New appointments', '82', 'brand', '↑ 13 from campaigns'], ['Patient retention', '85%', 'teal', '↑ 2% improvement']],
    metrics: [
      ['Reactivation emails sent', '2,349', 'brand'], ['SMS messages sent', '854', 'brand'],
      ['Email open rate', '31%', 'brand'], ['Reply rate', '16%', 'brand'],
      ['Cost per booked appointment', '$38', 'green'], ['Recall conversion rate', '35%', 'teal'],
      ['Reviews collected', '15', 'amber'], ['Average Google rating', '4.8', 'amber'],
      ['NPS score', '69', 'pink'], ['Waitlist slots filled', '34', 'orange'],
      ['Insurance denials prevented', '$6,720', 'green'], ['AI front desk calls', '2,297', 'purple'],
      ['Claims submitted', '132', 'purple'], ['Claims paid · revenue', '108 · $74,600', 'green'],
      ['AI hours saved total', '~184 hrs', 'green'],
    ],
  },
};

const AD_PLATFORMS = ['Google Ads', 'Facebook Ads'];
const AD_PERFORMANCE_DATA = {
  'Google Ads': {
    weeks: [
      { label: 'Wk 1', spend: 410, revenue: 1620 },
      { label: 'Wk 2', spend: 455, revenue: 1980 },
      { label: 'Wk 3', spend: 480, revenue: 1740 },
      { label: 'Wk 4', spend: 495, revenue: 2260 },
      { label: 'Wk 5', spend: 520, revenue: 2510 },
      { label: 'Wk 6', spend: 505, revenue: 2830 },
    ],
    leads: 68,
    confirmedPatients: 22,
    insight: 'Cost-per-patient dropped to $134 this month, your best return yet on Google Ads — consider shifting more budget here.',
  },
  'Facebook Ads': {
    weeks: [
      { label: 'Wk 1', spend: 280, revenue: 780 },
      { label: 'Wk 2', spend: 310, revenue: 840 },
      { label: 'Wk 3', spend: 340, revenue: 690 },
      { label: 'Wk 4', spend: 360, revenue: 910 },
      { label: 'Wk 5', spend: 355, revenue: 1020 },
      { label: 'Wk 6', spend: 375, revenue: 960 },
    ],
    leads: 41,
    confirmedPatients: 9,
    insight: "Facebook Ads' cost-per-patient is running well above Google — try narrowing the audience to your top ZIP codes.",
  },
};

function AdSpendChart({ weeks }) {
  const t = useTheme();
  const maxVal = Math.max(...weeks.flatMap(w => [w.spend, w.revenue]), 1);
  const chartH = 120;
  const barW = 20;
  const gapInGroup = 5;
  const groupW = barW * 2 + gapInGroup + 24;
  const width = weeks.length * groupW;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={chartH + 30} viewBox={`0 0 ${width} ${chartH + 30}`} style={{ display: 'block', minWidth: `${width}px` }}>
        <line x1="0" y1={chartH} x2={width} y2={chartH} stroke={t.border} strokeWidth="1" />
        {weeks.map((w, i) => {
          const x = i * groupW + 12;
          const spendH = (w.spend / maxVal) * chartH;
          const revH = (w.revenue / maxVal) * chartH;
          return (
            <g key={i}>
              <rect x={x} y={chartH - spendH} width={barW} height={spendH} rx="3" fill={t.brand} />
              <rect x={x + barW + gapInGroup} y={chartH - revH} width={barW} height={revH} rx="3" fill={t.green} />
              <text x={x + barW + gapInGroup / 2} y={chartH + 16} textAnchor="middle" fontSize="10" fill={t.muted}>{w.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AdPerformance() {
  const t = useTheme();
  const [platform, setPlatform] = useState(AD_PLATFORMS[0]);
  const [comingSoon, setComingSoon] = useState(null);
  const data = AD_PERFORMANCE_DATA[platform];
  const totalSpend = data.weeks.reduce((s, w) => s + w.spend, 0);
  const totalRevenue = data.weeks.reduce((s, w) => s + w.revenue, 0);
  const costPerPatient = Math.round(totalSpend / data.confirmedPatients);
  const netROI = Math.round(((totalRevenue - totalSpend) / totalSpend) * 100);

  const stats = [
    ['Ad spend', `$${totalSpend.toLocaleString()}`, t.red, t.accentRed],
    ['Leads generated', data.leads, t.brand, t.accentBlue],
    ['Confirmed patients', data.confirmedPatients, t.teal, t.accentTeal],
    ['Cost per patient', `$${costPerPatient}`, t.amber, t.accentAmber],
    ['Revenue attributed', `$${totalRevenue.toLocaleString()}`, t.green, t.accentGreen],
    ['Net ROI', `${netROI >= 0 ? '+' : ''}${netROI}%`, netROI >= 0 ? t.green : t.red, netROI >= 0 ? t.accentGreen : t.accentRed],
  ];

  return (
    <Card style={{ marginBottom: '16px' }}>
      <CardTitle>
        Ad performance
        <div style={{ display: 'flex', gap: '6px' }}>
          {AD_PLATFORMS.map(p => (
            <span
              key={p}
              onClick={() => setPlatform(p)}
              style={{ padding: '5px 12px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '500', cursor: 'pointer', border: platform === p ? 'none' : `1px solid ${t.border}`, background: platform === p ? t.brand : 'transparent', color: platform === p ? 'white' : t.mid }}
            >{p}</span>
          ))}
        </div>
      </CardTitle>
      <div style={{ padding: '9px 12px', background: t.tealL, borderRadius: '6px', fontSize: '11.5px', color: t.teal, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
        <Sparkles size={12} /> Demo campaign data shown — connect {platform} for real numbers.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
        {stats.map(([label, value, color, accent], i) => (
          <StatCard key={i} label={label} value={value} color={color} accent={accent} />
        ))}
      </div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: t.ink2, marginBottom: '10px' }}>Weekly spend vs. revenue</div>
      <AdSpendChart weeks={data.weeks} />
      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: t.mid }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: t.brand, display: 'inline-block' }} /> Spend</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: t.green, display: 'inline-block' }} /> Revenue</div>
      </div>
      <div style={{ marginTop: '16px', padding: '10px 14px', background: t.brandL, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12.5px', color: t.brand, display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Sparkles size={13} /> {data.insight}
        </div>
        <Btn small onClick={() => setComingSoon(platform)}>Connect {platform}</Btn>
      </div>
      {comingSoon && (
        <Modal title={`Connect ${comingSoon}`} onClose={() => setComingSoon(null)}>
          <div style={{ fontSize: '13px', color: t.mid, lineHeight: '1.6' }}>
            Direct {comingSoon} integration is coming soon. Once connected, this dashboard will pull live spend, leads, and attributed revenue automatically — no more manual exports.
          </div>
          <Btn primary style={{ marginTop: '16px' }} onClick={() => setComingSoon(null)}>Got it</Btn>
        </Modal>
      )}
    </Card>
  );
}

function Reports() {
  const t = useTheme();
  const colorMap = { brand: t.brand, green: t.green, teal: t.teal, amber: t.amber, pink: t.pink, orange: t.orange, purple: t.purple };
  const accentMap = { brand: t.accentBlue, green: t.accentGreen, teal: t.accentTeal, amber: t.accentAmber, pink: t.accentPink, orange: t.accentOrange, purple: t.accentPurple };
  const [period, setPeriod] = useState(REPORTS_PERIODS[0]);
  const [notice, setNotice] = useState('');
  const data = REPORTS_DATA[period];

  return (
    <div>
      <AdPerformance />
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {REPORTS_PERIODS.map((label, i) => (
          <span key={i} onClick={() => setPeriod(label)} style={{ padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: period === label ? 'none' : `1px solid ${t.border}`, background: period === label ? t.brand : t.bgCard, color: period === label ? 'white' : t.mid }}>{label}</span>
        ))}
        <Btn small onClick={() => setNotice(`Exported ${period} report as PDF.`)}><Download size={13} /> Export PDF</Btn>
        {notice && <span style={{ fontSize: '12px', color: t.green, marginLeft: '4px' }}>{notice}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
        {data.stats.map(([label, value, color, sub], i) => (
          <StatCard key={i} label={label} value={value} color={colorMap[color]} accent={accentMap[color]} sub={sub} />
        ))}
      </div>
      <Card>
        <CardTitle>Monthly performance breakdown</CardTitle>
        {data.metrics.map(([label, val, color], i) => (
          <div key={i} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', background: t.bgRow, borderRadius: '6px', marginBottom: '6px', border: `1px solid ${t.border2}` }}>
            <span style={{ fontSize: '12.5px', color: t.mid }}>{label}</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: colorMap[color] }}>{val}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────
const INTEGRATIONS = [
  { id: 'ghl', name: 'GoHighLevel', sub: 'CRM and automation', connected: true, envVars: ['REACT_APP_GHL_API_KEY', 'REACT_APP_GHL_LOCATION_ID'] },
  { id: 'oa', name: 'Office Ally', sub: 'Clearinghouse · billing', connected: true },
  { id: 'stripe', name: 'Stripe', sub: 'Payment processing', connected: true, envVars: ['REACT_APP_STRIPE_PUBLISHABLE_KEY'] },
  { id: 'gb', name: 'Google Business', sub: 'Reviews and reputation', connected: false },
  { id: 'whatsapp', name: 'WhatsApp Business', sub: 'Chat with patients over WhatsApp, right in your Inbox', connected: false },
  { id: 'instagram', name: 'Instagram', sub: 'Reply to DMs and comments without leaving your Inbox', connected: false },
  { id: 'dentrix', name: 'Dentrix', sub: 'Practice management sync', connected: false },
  { id: 'eaglesoft', name: 'Eaglesoft', sub: 'Practice management sync', connected: false },
  { id: 'availity', name: 'Availity', sub: 'Eligibility verification', connected: false },
];

function Settings({ userRole, rolePermissions, onUpdatePermissions, onRoleChange, brandColor, onBrandColorChange }) {
  const t = useTheme();
  const [saved, setSaved] = useState(false);
  const [connectNotice, setConnectNotice] = useState('');
  const [customHex, setCustomHex] = useState(brandColor || DEFAULT_BRAND);
  const [staff, setStaff] = useState(STAFF_MEMBERS);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Front Desk' });
  const [inviteNotice, setInviteNotice] = useState('');
  const [editRoleStaff, setEditRoleStaff] = useState(null);
  const [editRoleValue, setEditRoleValue] = useState('');
  const [permEditorRole, setPermEditorRole] = useState(null);
  const [draftPerms, setDraftPerms] = useState({});
  const [requestDoctors, setRequestDoctors] = useState(DOCTORS_SEED.filter(d => d !== 'Any available doctor'));
  const [newDoctor, setNewDoctor] = useState('');
  const [requestApptTypes, setRequestApptTypes] = useState(REQUEST_APPT_TYPES_SEED);
  const [newApptType, setNewApptType] = useState('');
  const [businessHours, setBusinessHours] = useState({
    Mon: { open: true, from: '08:00', to: '17:00' }, Tue: { open: true, from: '08:00', to: '17:00' },
    Wed: { open: true, from: '08:00', to: '17:00' }, Thu: { open: true, from: '08:00', to: '17:00' },
    Fri: { open: true, from: '08:00', to: '15:00' }, Sat: { open: false, from: '09:00', to: '13:00' },
    Sun: { open: false, from: '09:00', to: '13:00' },
  });
  const [depositRequired, setDepositRequired] = useState(true);
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [briefingTime, setBriefingTime] = useState('07:00');
  const [briefingDelivery, setBriefingDelivery] = useState('Both');
  const [briefingIncludes, setBriefingIncludes] = useState({
    appointments: true, messages: true, recall: true, claims: true, revenue: true, security: true,
  });
  const [briefingTestSent, setBriefingTestSent] = useState(false);
  const [sessions, setSessions] = useState(ACTIVE_SESSIONS_SEED);
  const [sessionNotice, setSessionNotice] = useState('');
  const [twoFAEnabled, setTwoFAEnabled] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('praxismd-2fa-enabled') === 'on');
  const [twoFAMethod, setTwoFAMethod] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem('praxismd-2fa-method')) || 'app');
  const [show2FAWizard, setShow2FAWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardMethod, setWizardMethod] = useState('app');
  const [wizardPhone, setWizardPhone] = useState('');
  const [wizardCode, setWizardCode] = useState('');
  const [wizardCodeError, setWizardCodeError] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [backupCopied, setBackupCopied] = useState(false);
  const [twoFANotice, setTwoFANotice] = useState('');

  function generateBackupCodes() {
    const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    return Array.from({ length: 8 }, () => `${seg()}-${seg()}`);
  }

  function openWizard() {
    setWizardStep(1);
    setWizardMethod('app');
    setWizardPhone('');
    setWizardCode('');
    setWizardCodeError('');
    setShow2FAWizard(true);
  }

  function wizardNext() {
    if (wizardStep === 2 && wizardMethod === 'sms' && !wizardPhone.trim()) return;
    if (wizardStep === 3) {
      if (wizardCode.trim().length !== 6) { setWizardCodeError('Enter the 6-digit code from your app or text message.'); return; }
      setBackupCodes(generateBackupCodes());
    }
    setWizardStep(s => s + 1);
  }

  function finishWizard() {
    window.localStorage.setItem('praxismd-2fa-enabled', 'on');
    window.localStorage.setItem('praxismd-2fa-method', wizardMethod);
    setTwoFAEnabled(true);
    setTwoFAMethod(wizardMethod);
    setShow2FAWizard(false);
    setTwoFANotice('Two-factor authentication is now on.');
    setTimeout(() => setTwoFANotice(''), 3000);
  }

  function disable2FA() {
    window.localStorage.setItem('praxismd-2fa-enabled', 'off');
    setTwoFAEnabled(false);
    setTwoFANotice('Two-factor authentication turned off.');
    setTimeout(() => setTwoFANotice(''), 3000);
  }

  function copyBackupCodes() {
    if (navigator.clipboard) navigator.clipboard.writeText(backupCodes.join('\n')).catch(() => {});
    setBackupCopied(true);
    setTimeout(() => setBackupCopied(false), 2000);
  }

  function downloadBackupCodes() {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'praxismd-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  function revokeSession(id) {
    setSessions(list => list.filter(s => s.id !== id));
  }

  function signOutAllOthers() {
    setSessions(list => list.filter(s => s.current));
    setSessionNotice('Signed out of all other devices.');
    setTimeout(() => setSessionNotice(''), 3000);
  }

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2 };
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' };

  function saveChanges() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  function connect(item) {
    setConnectNotice(item.envVars
      ? `Add ${item.envVars.join(' and ')} to your .env.local to connect ${item.name}.`
      : `${item.name} isn't wired up yet — this is a bare-bones scaffold for now.`);
  }

  function removeStaff(id) {
    setStaff(list => list.filter(s => s.id !== id));
  }

  function sendInvite() {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return;
    setStaff(list => [...list, { id: `u-new-${Date.now()}`, name: inviteForm.name.trim(), email: inviteForm.email.trim(), role: inviteForm.role, lastLogin: 'Never', status: 'Invited' }]);
    setInviteNotice(`Invite sent to ${inviteForm.email.trim()} — they'll show up as "Invited" until they accept.`);
    setInviteForm({ name: '', email: '', role: 'Front Desk' });
    setShowInviteModal(false);
  }

  function openEditRole(s) {
    setEditRoleStaff(s);
    setEditRoleValue(s.role);
  }

  function saveEditRole() {
    setStaff(list => list.map(s => s.id === editRoleStaff.id ? { ...s, role: editRoleValue } : s));
    setEditRoleStaff(null);
  }

  function openPermEditor(role) {
    setPermEditorRole(role);
    setDraftPerms({ ...(rolePermissions[role] || {}) });
  }

  function togglePerm(tab) {
    setDraftPerms(d => ({ ...d, [tab]: !d[tab] }));
  }

  function savePerms() {
    onUpdatePermissions(permEditorRole, draftPerms);
    setPermEditorRole(null);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <Card>
          <CardTitle>Practice details</CardTitle>
          {[['Practice name', 'Bright Smiles Dental'], ['Phone number', '(813) 555-0142'], ['Email', 'hello@brightsmiles.com'], ['Address', '4210 W Bay Ave, Tampa FL 33616'], ['NPI number', '1234567890']].map(([label, val], i) => (
            <div key={i} style={{ marginBottom: '13px' }}>
              <label style={labelStyle}>{label}</label>
              <input defaultValue={val} style={{ ...inputStyle, background: t.bgRow }} />
            </div>
          ))}
          <Btn primary onClick={saveChanges}>{saved ? <Check size={14} /> : null}{saved ? 'Saved' : 'Save changes'}</Btn>
        </Card>
        <Card>
          <CardTitle>Integrations</CardTitle>
          {INTEGRATIONS.map(item => (
            <div key={item.id} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: '6px', marginBottom: '8px', borderWidth: '1px', borderStyle: 'solid', background: item.connected ? t.greenL : t.bgRow, borderColor: item.connected ? withAlpha(t.accentGreen, .15) : t.border2 }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{item.name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{item.sub}</div></div>
              {item.connected ? <Pill label="Connected" color={t.green} bg={t.greenL} /> : <Btn small onClick={() => connect(item)}>Connect</Btn>}
            </div>
          ))}
          {connectNotice && (
            <div style={{ marginTop: '8px', padding: '10px 12px', background: t.tealL, borderRadius: '6px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}` }}>{connectNotice}</div>
          )}
        </Card>
      </div>

      <Card style={{ marginBottom: '14px' }}>
        <CardTitle>Appearance</CardTitle>
        <div style={{ fontSize: '12.5px', color: t.muted, marginBottom: '14px' }}>Pick a brand color — it applies across the sidebar, buttons, accents, and badges, in both light and dark mode.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {BRAND_PRESETS.map(preset => {
            const active = brandColor?.toUpperCase() === preset.hex.toUpperCase();
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => onBrandColorChange && onBrandColorChange(preset.hex)}
                className="px-row"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 13px', borderRadius: '6px', border: active ? `2px solid ${preset.hex}` : `1px solid ${t.border}`, background: t.bgRow, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              >
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: preset.hex, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {active && <Check size={13} color="white" />}
                </span>
                <span style={{ fontSize: '12.5px', fontWeight: '500', color: t.ink2 }}>{preset.name}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Palette size={15} color={t.muted} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '12.5px', color: t.mid, flexShrink: 0 }}>Custom color</span>
          <input
            value={customHex}
            onChange={e => setCustomHex(e.target.value)}
            placeholder="#2563EB"
            style={{ ...inputStyle, maxWidth: '120px' }}
          />
          <input
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(customHex) ? customHex : '#2563EB'}
            onChange={e => setCustomHex(e.target.value)}
            style={{ width: '36px', height: '36px', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '2px', background: t.bgCard, cursor: 'pointer' }}
          />
          <Btn small primary onClick={() => /^#[0-9A-Fa-f]{6}$/.test(customHex) && onBrandColorChange && onBrandColorChange(customHex)}>Apply</Btn>
        </div>
      </Card>

      <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink, marginBottom: '10px' }}>Team &amp; Permissions</div>

      <Card style={{ marginBottom: '14px' }}>
        <CardTitle>
          Team members
          <Btn small primary onClick={() => setShowInviteModal(true)}><UserPlus size={13} /> Invite staff member</Btn>
        </CardTitle>
        {inviteNotice && (
          <div style={{ marginBottom: '10px', padding: '10px 12px', background: t.tealL, borderRadius: '6px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}` }}>{inviteNotice}</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.9fr 1.1fr 0.9fr 0.9fr 1.4fr', gap: '8px', padding: '0 13px 8px', fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px' }}>
          <div>Name</div><div>Email</div><div>Role</div><div>Last login</div><div>Status</div><div>Actions</div>
        </div>
        {staff.map(s => {
          const rc = roleColor(s.role, t);
          const isOwner = s.role === 'Owner';
          return (
            <div key={s.id} className="px-row" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.9fr 1.1fr 0.9fr 0.9fr 1.4fr', gap: '8px', alignItems: 'center', padding: '10px 13px', borderRadius: '6px', marginBottom: '6px', background: t.bgRow }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Ava initials={initialsOf(s.name)} bg={t.brandL} color={t.brand} />
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
              </div>
              <div style={{ fontSize: '12.5px', color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</div>
              <div><Pill label={s.role} color={rc.color} bg={rc.bg} /></div>
              <div style={{ fontSize: '12.5px', color: t.muted }}>{s.lastLogin}</div>
              <div><Pill label={s.status} color={s.status === 'Active' ? t.green : t.amber} bg={s.status === 'Active' ? t.greenL : t.amberL} /></div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => !isOwner && openEditRole(s)} disabled={isOwner} title={isOwner ? "Owner role can't be edited" : 'Edit role'} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: isOwner ? t.border : t.muted, cursor: isOwner ? 'default' : 'pointer', borderRadius: '8px' }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => !isOwner && removeStaff(s.id)} disabled={isOwner} title={isOwner ? "Owner can't be removed" : 'Remove'} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: isOwner ? t.border : t.muted, cursor: isOwner ? 'default' : 'pointer', borderRadius: '8px' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </Card>

      <Card style={{ marginBottom: '14px' }}>
        <CardTitle>Role permissions</CardTitle>
        <div style={{ fontSize: '12.5px', color: t.muted, marginBottom: '12px' }}>The Owner role always has full access and can't be edited. Customize exactly which tabs each other role can see.</div>
        {EDITABLE_ROLES.map(role => {
          const perms = rolePermissions[role] || {};
          const onCount = ALL_TABS.filter(tab => perms[tab]).length;
          const rc = roleColor(role, t);
          return (
            <div key={role} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: '6px', marginBottom: '8px', background: t.bgRow }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Pill label={role} color={rc.color} bg={rc.bg} />
                <span style={{ fontSize: '12px', color: t.muted }}>{onCount} of {ALL_TABS.length} tabs visible</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => onRoleChange && onRoleChange(role)} title={`Preview as ${role}`} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, background: t.bgCard, color: t.mid, cursor: 'pointer', borderRadius: '8px' }}>
                  <Eye size={14} />
                </button>
                <Btn small onClick={() => openPermEditor(role)}>Edit permissions</Btn>
              </div>
            </div>
          );
        })}
      </Card>

      <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink, margin: '18px 0 10px' }}>Appointment Request Settings</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <Card>
          <CardTitle>Doctors available for requests</CardTitle>
          {requestDoctors.map(d => (
            <RowItem key={d} style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: t.ink2 }}>{d}</span>
              <button onClick={() => setRequestDoctors(list => list.filter(x => x !== d))} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: '8px' }}>
                <X size={14} />
              </button>
            </RowItem>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input value={newDoctor} onChange={e => setNewDoctor(e.target.value)} placeholder="Add a doctor…" style={{ ...inputStyle, flex: 1 }} />
            <Btn small onClick={() => { if (newDoctor.trim()) { setRequestDoctors(list => [...list, newDoctor.trim()]); setNewDoctor(''); } }}><Plus size={13} /> Add</Btn>
          </div>
        </Card>

        <Card>
          <CardTitle>Appointment types available</CardTitle>
          {requestApptTypes.map(a => (
            <RowItem key={a} style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: t.ink2 }}>{a}</span>
              <button onClick={() => setRequestApptTypes(list => list.filter(x => x !== a))} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: '8px' }}>
                <X size={14} />
              </button>
            </RowItem>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input value={newApptType} onChange={e => setNewApptType(e.target.value)} placeholder="Add an appointment type…" style={{ ...inputStyle, flex: 1 }} />
            <Btn small onClick={() => { if (newApptType.trim()) { setRequestApptTypes(list => [...list, newApptType.trim()]); setNewApptType(''); } }}><Plus size={13} /> Add</Btn>
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: '14px' }}>
        <CardTitle>Business hours for requests</CardTitle>
        {Object.entries(businessHours).map(([day, hrs]) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 2px', borderBottom: `1px solid ${t.border2}` }}>
            <div style={{ width: '42px', fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{day}</div>
            <ToggleSwitch checked={hrs.open} onChange={() => setBusinessHours(bh => ({ ...bh, [day]: { ...bh[day], open: !bh[day].open } }))} />
            {hrs.open ? (
              <>
                <input type="time" value={hrs.from} onChange={e => setBusinessHours(bh => ({ ...bh, [day]: { ...bh[day], from: e.target.value } }))} style={{ ...inputStyle, width: '120px' }} />
                <span style={{ fontSize: '12px', color: t.muted }}>to</span>
                <input type="time" value={hrs.to} onChange={e => setBusinessHours(bh => ({ ...bh, [day]: { ...bh[day], to: e.target.value } }))} style={{ ...inputStyle, width: '120px' }} />
              </>
            ) : (
              <span style={{ fontSize: '12.5px', color: t.muted }}>Closed</span>
            )}
          </div>
        ))}
      </Card>

      <Card style={{ marginBottom: '18px' }}>
        <CardTitle>Deposits</CardTitle>
        <RowItem style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Require deposit for high-value appointments</div>
            <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>Applies to: {DEPOSIT_TYPES.join(', ')}</div>
          </div>
          <ToggleSwitch checked={depositRequired} onChange={() => setDepositRequired(v => !v)} />
        </RowItem>
      </Card>

      <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink, margin: '18px 0 10px' }}>Morning Briefing</div>

      <Card style={{ marginBottom: '18px' }}>
        <RowItem style={{ justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Send a daily morning briefing</div>
            <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>A quick summary of yesterday and today, delivered before the day starts.</div>
          </div>
          <ToggleSwitch checked={briefingEnabled} onChange={() => setBriefingEnabled(v => !v)} />
        </RowItem>

        {briefingEnabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Send time</label>
                <input type="time" value={briefingTime} onChange={e => setBriefingTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Delivery method</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['SMS', 'Email', 'Both'].map(method => (
                    <button
                      key={method} type="button" onClick={() => setBriefingDelivery(method)}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', border: briefingDelivery === method ? 'none' : `1px solid ${t.border}`, background: briefingDelivery === method ? t.brand : t.bgCard, color: briefingDelivery === method ? 'white' : t.mid, fontFamily: 'inherit' }}
                    >{method}</button>
                  ))}
                </div>
              </div>
            </div>

            <label style={labelStyle}>Include in briefing</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
              {BRIEFING_ITEM_META.map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color: t.ink2, cursor: 'pointer', padding: '8px 10px', background: t.bgRow, borderRadius: '9px' }}>
                  <input
                    type="checkbox"
                    checked={!!briefingIncludes[item.key]}
                    onChange={() => setBriefingIncludes(inc => ({ ...inc, [item.key]: !inc[item.key] }))}
                    style={{ width: '15px', height: '15px', flexShrink: 0, accentColor: t.brand }}
                  />
                  {item.label}
                </label>
              ))}
            </div>

            <label style={labelStyle}>Live preview</label>
            {briefingDelivery !== 'SMS' && (
              <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px', marginBottom: briefingDelivery === 'Both' ? '10px' : '18px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '8px' }}>Email · {formatTime12h(briefingTime)}</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: t.ink, marginBottom: '10px' }}>Your morning briefing for {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {BRIEFING_ITEM_META.filter(item => briefingIncludes[item.key]).map(item => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: t.mid }}>
                      <Check size={13} color={t.green} style={{ flexShrink: 0, marginTop: '2px' }} />
                      {item.format(item.value)}
                    </div>
                  ))}
                  {Object.values(briefingIncludes).every(v => !v) && <div style={{ fontSize: '12.5px', color: t.muted }}>Nothing selected — pick at least one item above.</div>}
                </div>
              </div>
            )}
            {briefingDelivery !== 'Email' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
                <div style={{ maxWidth: '80%', background: t.brand, color: 'white', borderRadius: '14px', padding: '10px 13px', fontSize: '12.5px', lineHeight: 1.5 }}>
                  Good morning! {BRIEFING_ITEM_META.filter(item => briefingIncludes[item.key]).map(item => item.format(item.value)).join(' · ') || 'No items selected.'}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Btn primary onClick={() => { setBriefingTestSent(true); setTimeout(() => setBriefingTestSent(false), 3000); }}>
                <Send size={13} /> Send test briefing
              </Btn>
              {briefingTestSent && <span style={{ fontSize: '12.5px', color: t.green, display: 'flex', alignItems: 'center', gap: '5px' }}><Check size={13} /> Test briefing sent!</span>}
            </div>
          </>
        )}
      </Card>

      <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink, margin: '18px 0 10px' }}>Security</div>

      {twoFANotice && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.greenL, borderRadius: '6px', fontSize: '12.5px', color: t.green, border: `1px solid ${withAlpha(t.accentGreen, .15)}` }}>{twoFANotice}</div>
      )}

      <Card style={{ marginBottom: '18px' }}>
        <CardTitle>Two-factor authentication</CardTitle>
        <RowItem style={{ justifyContent: 'space-between', borderLeft: twoFAEnabled ? `2px solid ${t.green}` : 'none', paddingLeft: twoFAEnabled ? '10px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: twoFAEnabled ? t.greenL : t.bgCard, border: twoFAEnabled ? 'none' : `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {twoFAEnabled ? <ShieldCheck size={17} color={t.green} /> : <Shield size={17} color={t.muted} />}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>
                {twoFAEnabled ? `Enabled via ${twoFAMethod === 'app' ? 'authenticator app' : 'text message'}` : 'Not enabled'}
              </div>
              <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>
                {twoFAEnabled ? 'Your account requires a code at sign-in.' : 'Add a second step to protect your account.'}
              </div>
            </div>
          </div>
          {twoFAEnabled ? <Btn small onClick={disable2FA}>Disable</Btn> : <Btn small primary onClick={openWizard}><ShieldCheck size={13} /> Enable 2FA</Btn>}
        </RowItem>
      </Card>

      <Card style={{ marginBottom: '18px' }}>
        <CardTitle>Active sessions</CardTitle>
        {sessionNotice && (
          <div style={{ marginBottom: '12px', padding: '10px 12px', background: t.greenL, borderRadius: '6px', fontSize: '12px', color: t.green, border: `1px solid ${withAlpha(t.accentGreen, .15)}` }}>{sessionNotice}</div>
        )}
        {sessions.map(s => (
          <RowItem key={s.id} style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.device === 'mobile' ? <Smartphone size={16} color={t.brand} /> : <Monitor size={16} color={t.brand} />}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2, display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {s.browser}
                  {s.current && <Pill label="This device" color={t.green} bg={t.greenL} />}
                </div>
                <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{s.location} · {s.lastActive}</div>
              </div>
            </div>
            {!s.current && <Btn small onClick={() => revokeSession(s.id)}><X size={12} /> Revoke</Btn>}
          </RowItem>
        ))}
        {sessions.length > 1 && (
          <Btn style={{ marginTop: '8px' }} onClick={signOutAllOthers}><LogOut size={13} /> Sign out all other devices</Btn>
        )}
      </Card>

      <Card>
        <CardTitle>Demo: role switcher</CardTitle>
        <div style={{ fontSize: '12.5px', color: t.muted, marginBottom: '12px' }}>No real auth yet — flip roles here to preview exactly what each role is currently permitted to see.</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ROLES.map(r => (
            <Btn key={r} small primary={r === userRole} onClick={() => onRoleChange && onRoleChange(r)}>{r}</Btn>
          ))}
        </div>
      </Card>

      {showInviteModal && (
        <Modal title="Invite staff member" onClose={() => setShowInviteModal(false)}>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Full name</label>
            <input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} placeholder="Jordan Blake" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Email address</label>
            <input value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="jordan@brightsmiles.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Role</label>
            <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
              {EDITABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn primary onClick={sendInvite}>Send invite</Btn>
            <Btn onClick={() => setShowInviteModal(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {editRoleStaff && (
        <Modal title={`Edit role — ${editRoleStaff.name}`} onClose={() => setEditRoleStaff(null)}>
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Role</label>
            <select value={editRoleValue} onChange={e => setEditRoleValue(e.target.value)} style={inputStyle}>
              {EDITABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn primary onClick={saveEditRole}>Save</Btn>
            <Btn onClick={() => setEditRoleStaff(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {permEditorRole && (
        <SlidePanel title={`Edit permissions — ${permEditorRole}`} subtitle="Toggle which tabs this role can see in the sidebar" onClose={() => setPermEditorRole(null)}>
          {ALL_TABS.map(tab => (
            <div key={tab} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px', borderBottom: `1px solid ${t.border2}` }}>
              <span style={{ fontSize: '13px', color: t.ink2 }}>{TAB_LABELS[tab]}</span>
              <ToggleSwitch checked={!!draftPerms[tab]} onChange={() => togglePerm(tab)} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
            <Btn primary onClick={savePerms}>Save permissions</Btn>
            <Btn onClick={() => setPermEditorRole(null)}>Cancel</Btn>
          </div>
        </SlidePanel>
      )}

      {show2FAWizard && (
        <Modal title="Enable two-factor authentication" onClose={() => setShow2FAWizard(false)}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '18px' }}>
            {[1, 2, 3, 4].map(step => (
              <div key={step} style={{ flex: 1, height: '4px', borderRadius: '2px', background: step <= wizardStep ? t.brand : t.border2 }} />
            ))}
          </div>

          {wizardStep === 1 && (
            <>
              <div style={{ fontSize: '12.5px', color: t.muted, marginBottom: '14px' }}>Choose how you'd like to receive your verification codes.</div>
              {[['app', 'Authenticator app', 'Use Google Authenticator, Authy, or a similar app', QrCode], ['sms', 'Text message (SMS)', "We'll text a code to your phone", Smartphone]].map(([key, label, sub, Icon]) => (
                <div
                  key={key}
                  onClick={() => setWizardMethod(key)}
                  className="px-row"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', borderRadius: '6px', marginBottom: '10px', cursor: 'pointer', border: `2px solid ${wizardMethod === key ? t.brand : t.border2}`, background: wizardMethod === key ? t.brandL : t.bgRow }}
                >
                  <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: t.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color={wizardMethod === key ? t.brand : t.muted} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: t.ink2 }}>{label}</div>
                    <div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div>
                  </div>
                </div>
              ))}
              <Btn primary onClick={wizardNext} style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}>Continue</Btn>
            </>
          )}

          {wizardStep === 2 && wizardMethod === 'app' && (
            <>
              <div style={{ fontSize: '12.5px', color: t.muted, marginBottom: '14px' }}>Scan this QR code with your authenticator app, or enter the key manually.</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <div style={{ width: '160px', height: '160px', borderRadius: '12px', border: `1px solid ${t.border}`, background: t.bgRow, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(7, 1fr)', gap: '2px', padding: '10px' }}>
                  {Array.from({ length: 49 }).map((_, i) => (
                    <div key={i} style={{ background: (i * 37 + 11) % 5 < 2 ? t.ink : 'transparent', borderRadius: '1px' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: t.bgRow, borderRadius: '6px', marginBottom: '18px' }}>
                <span style={{ fontSize: '12.5px', color: t.ink2, fontFamily: 'monospace', letterSpacing: '.5px' }}>JBSW Y3DP EHPK 3PXP</span>
                <KeyRound size={14} color={t.muted} />
              </div>
              <Btn primary onClick={wizardNext} style={{ width: '100%', justifyContent: 'center' }}>Continue</Btn>
            </>
          )}

          {wizardStep === 2 && wizardMethod === 'sms' && (
            <>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Phone number</label>
                <input value={wizardPhone} onChange={e => setWizardPhone(e.target.value)} placeholder="(813) 555-0142" style={inputStyle} />
              </div>
              <Btn primary onClick={wizardNext} disabled={!wizardPhone.trim()} style={{ width: '100%', justifyContent: 'center' }}>Send code</Btn>
            </>
          )}

          {wizardStep === 3 && (
            <>
              <div style={{ fontSize: '12.5px', color: t.muted, marginBottom: '14px' }}>
                Enter the 6-digit code {wizardMethod === 'app' ? 'from your authenticator app' : `we texted to ${wizardPhone || 'your phone'}`}.
              </div>
              <div style={{ marginBottom: '10px' }}>
                <input
                  value={wizardCode}
                  onChange={e => { setWizardCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setWizardCodeError(''); }}
                  placeholder="000000"
                  inputMode="numeric"
                  style={{ ...inputStyle, textAlign: 'center', fontSize: '22px', letterSpacing: '8px', fontFamily: 'monospace' }}
                />
              </div>
              {wizardCodeError && <div style={{ fontSize: '12px', color: t.red, marginBottom: '10px' }}>{wizardCodeError}</div>}
              <Btn primary onClick={wizardNext} style={{ width: '100%', justifyContent: 'center' }}>Verify</Btn>
            </>
          )}

          {wizardStep === 4 && (
            <>
              <div style={{ fontSize: '12.5px', color: t.muted, marginBottom: '14px' }}>
                Save these backup codes somewhere safe. Each one can be used once if you lose access to your {wizardMethod === 'app' ? 'authenticator app' : 'phone'}.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {backupCodes.map((code, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: t.bgRow, borderRadius: '8px', fontSize: '12.5px', fontFamily: 'monospace', color: t.ink2, textAlign: 'center' }}>{code}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                <Btn small onClick={copyBackupCodes}>{backupCopied ? <Check size={12} /> : <Copy size={12} />} {backupCopied ? 'Copied' : 'Copy all'}</Btn>
                <Btn small onClick={downloadBackupCodes}><Download size={12} /> Download</Btn>
              </div>
              <Btn primary onClick={finishWizard} style={{ width: '100%', justifyContent: 'center' }}>Done</Btn>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── ACTIVITY LOG ──────────────────────────────────────────
function FilterPillGroup({ options, value, onChange }) {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const key = typeof opt === 'string' ? opt : opt.key;
        const label = typeof opt === 'string' ? opt : opt.label;
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{ padding: '6px 13px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', borderWidth: '1px', borderStyle: 'solid', borderColor: active ? 'transparent' : t.border, background: active ? t.brand : t.bgCard, color: active ? 'white' : t.mid }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ActivityLog() {
  const t = useTheme();
  const [roleFilter, setRoleFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const roleOptions = ['All', ...ROLES, 'Unknown'];
  const suspiciousCount = ACTIVITY_LOG.filter(a => a.suspicious).length;

  const filtered = ACTIVITY_LOG
    .filter(a => (roleFilter === 'All' || a.role === roleFilter))
    .filter(a => (typeFilter === 'All' || a.type === typeFilter))
    .filter(a => !dateFrom || a.ts.slice(0, 10) >= dateFrom)
    .filter(a => !dateTo || a.ts.slice(0, 10) <= dateTo)
    .filter(a => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return a.user.toLowerCase().includes(q) || a.action.toLowerCase().includes(q) || (a.patient || '').toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));

  function formatTs(ts) {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function exportCsv() {
    const header = ['Timestamp', 'User', 'Role', 'Action', 'Patient'];
    const rows = filtered.map(a => [a.ts, a.user, a.role, a.action, a.patient || '']);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'activity-log.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {suspiciousCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: t.redL, border: `1px solid ${withAlpha(t.red, .25)}`, borderRadius: '12px', marginBottom: '14px' }}>
          <AlertTriangle size={18} color={t.red} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '13px', color: t.red, fontWeight: '500' }}>
            {suspiciousCount} suspicious login attempt{suspiciousCount === 1 ? '' : 's'} flagged below — review before dismissing.
          </div>
        </div>
      )}
      <Card style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '320px' }}>
              <Search size={14} color={t.muted} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by user or action…"
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgRow, fontSize: '12.5px', color: t.ink2, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '7px 9px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgRow, fontSize: '12px', color: t.ink2, outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: '12px', color: t.muted }}>to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '7px 9px', borderRadius: '6px', border: `1px solid ${t.border}`, background: t.bgRow, fontSize: '12px', color: t.ink2, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <Btn small onClick={exportCsv}><Download size={13} /> Export CSV</Btn>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '6px' }}>Filter by role</div>
            <FilterPillGroup options={roleOptions} value={roleFilter} onChange={setRoleFilter} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '6px' }}>Filter by action type</div>
            <FilterPillGroup options={ACTION_TYPES} value={typeFilter} onChange={setTypeFilter} />
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle>
          Activity feed
          <span style={{ fontSize: '12px', color: t.muted, fontWeight: '500' }}>{filtered.length} event{filtered.length === 1 ? '' : 's'}</span>
        </CardTitle>
        {filtered.length === 0 && <div style={{ fontSize: '13px', color: t.muted, textAlign: 'center', padding: '28px 0' }}>No activity matches these filters.</div>}
        {filtered.map(a => {
          const rc = roleColor(a.role, t);
          return (
            <RowItem key={a.id} style={a.suspicious ? { borderLeft: `2px solid ${t.red}`, paddingLeft: '10px' } : undefined}>
              <div style={{ width: '128px', flexShrink: 0, fontSize: '12px', color: t.muted }}>{formatTs(a.ts)}</div>
              <Ava initials={initialsOf(a.user)} bg={a.suspicious ? t.redL : t.brandL} color={a.suspicious ? t.red : t.brand} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{a.action}{a.patient ? <> · <PII>{a.patient}</PII></> : ''}</div>
                <div style={{ fontSize: '11.5px', color: t.muted, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  {a.user} <Pill label={a.role} color={rc.color} bg={rc.bg} />
                </div>
              </div>
              {a.suspicious && <AlertTriangle size={16} color={t.red} style={{ flexShrink: 0 }} />}
            </RowItem>
          );
        })}
      </Card>
    </div>
  );
}

export default App;
