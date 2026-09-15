import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { light, dark, withAlpha } from './theme';
import { auth, db, isFirebaseConfigured } from './firebase';
import { getContacts, getConversations, sendMessage, isGhlConfigured } from './api/ghl';
import { createPaymentLink, isStripeConfigured } from './api/stripe';
import {
  LayoutDashboard, Inbox as InboxIcon, Megaphone, RotateCcw, Calendar as CalendarIcon,
  ClipboardList, Users, Contact, Shield, Star, Smile, Bot, Receipt, CreditCard,
  TrendingUp, Settings as SettingsIcon, Bell, Sun, Moon, Search, Menu, ChevronLeft,
  ChevronRight, ChevronDown, Phone, Hand, Zap, CalendarPlus, Sparkles, LogOut,
  Download, Upload, Clock, Send, RotateCw, AlertTriangle, Plus, MessageSquare, Loader2,
  X, ArrowUp, ArrowDown, Check, Activity, UserPlus, Trash2, Lock, Pencil,
} from 'lucide-react';

export const ThemeContext = createContext(light);
export const useTheme = () => useContext(ThemeContext);

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

function mapConversation(c) {
  const name = c.contactName || c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
  return {
    id: c.id,
    contactId: c.contactId,
    name,
    lastMessage: c.lastMessageBody || '(no message preview)',
    time: c.dateUpdated ? new Date(c.dateUpdated).toLocaleString() : '',
    unread: Boolean(c.unreadCount),
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
  { id: 'c1', contactId: 'p1', name: 'Maria Chen', lastMessage: 'Yes, 2:30pm on Thursday works great for me — thank you!', time: 'Today, 9:14 AM', unread: true },
  { id: 'c2', contactId: 'p2', name: 'David Wong', lastMessage: 'Can I get an appointment reminder text instead of email?', time: 'Today, 8:02 AM', unread: true },
  { id: 'c3', contactId: 'p8', name: 'Mike Brown', lastMessage: 'My card on file was declined — can you resend the payment link?', time: 'Yesterday, 4:47 PM', unread: false },
  { id: 'c4', contactId: 'p7', name: 'Patricia Green', lastMessage: 'Thanks for the reminder, see you at 1:30!', time: 'Yesterday, 11:20 AM', unread: false },
  { id: 'c5', contactId: 'p10', name: 'Jordan Ellis', lastMessage: 'Still interested but need to check my schedule for next week.', time: 'Sep 12, 3:10 PM', unread: false },
  { id: 'c6', contactId: null, name: 'Unknown Caller', lastMessage: 'Hi, I saw your ad and wanted to ask about new patient specials.', time: 'Sep 11, 6:45 PM', unread: true },
];

// Fetches once on mount (and whenever refetch() is called). Skips the call
// entirely — no spinner, no error — when GHL isn't configured, since that's
// an expected, common state here, not a failure.
function useGhlFetch(fetchFn) {
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
  }, [reloadKey]);

  return { data, loading, error, refetch: () => setReloadKey(k => k + 1) };
}

// ─── ROLES & PERMISSIONS ───────────────────────────────────
const ROLES = ['Owner', 'Office Manager', 'Front Desk', 'Biller'];
const EDITABLE_ROLES = ROLES.filter(r => r !== 'Owner');

const ALL_TABS = ['overview', 'inbox', 'campaigns', 'recall', 'calendar', 'waitlist', 'patients', 'portal', 'eligibility', 'reviews', 'surveys', 'aifrontdesk', 'billing', 'payments', 'reports', 'activitylog', 'settings'];

const TAB_LABELS = {
  overview: 'Overview', inbox: 'Inbox', campaigns: 'Campaigns', recall: 'Recall', calendar: 'Calendar',
  waitlist: 'Waitlist', patients: 'Patients', portal: 'Patient Portal', eligibility: 'Eligibility',
  reviews: 'Reviews', surveys: 'Surveys', aifrontdesk: 'AI Front Desk', billing: 'Billing',
  payments: 'Payments', reports: 'Reports', activitylog: 'Activity Log', settings: 'Settings',
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

const MAIN_TABS = ['overview', 'inbox', 'campaigns', 'recall', 'calendar', 'waitlist'];
const PRACTICE_TABS = ['patients', 'portal', 'eligibility', 'reviews', 'surveys', 'aifrontdesk'];
const BILLINGSEC_TABS = ['billing', 'payments'];
const ANALYTICS_TABS = ['reports', 'settings', 'activitylog'];

const STAFF_MEMBERS = [
  { id: 'u1', name: 'Dr. Rivera', email: 'drrivera@brightsmiles.com', role: 'Owner', lastLogin: 'Just now', status: 'Active' },
  { id: 'u2', name: 'Nina Torres', email: 'nina@brightsmiles.com', role: 'Office Manager', lastLogin: '2h ago', status: 'Active' },
  { id: 'u3', name: 'Sarah Byrd', email: 'sarah@brightsmiles.com', role: 'Front Desk', lastLogin: 'Yesterday', status: 'Active' },
  { id: 'u4', name: 'James Coleman', email: 'james@brightsmiles.com', role: 'Biller', lastLogin: '3 days ago', status: 'Active' },
];

const ACTION_TYPES = [
  { key: 'All', label: 'All actions' },
  { key: 'message', label: 'Messages' },
  { key: 'appointment', label: 'Appointments' },
  { key: 'claim', label: 'Claims' },
  { key: 'record', label: 'Patient records' },
  { key: 'login', label: 'Logins' },
];

const ACTIVITY_LOG = [
  { id: 1, ts: '2026-09-15T09:14:00', user: 'Sarah Byrd', role: 'Front Desk', type: 'message', action: 'Sent message to Maria Chen', patient: 'Maria Chen', suspicious: false },
  { id: 2, ts: '2026-09-15T09:30:00', user: 'Dr. Rivera', role: 'Owner', type: 'claim', action: 'Submitted claim D2740 for James Lee', patient: 'James Lee', suspicious: false },
  { id: 3, ts: '2026-09-15T10:02:00', user: 'James Coleman', role: 'Biller', type: 'claim', action: 'Resubmitted denied claim for Robert Park', patient: 'Robert Park', suspicious: false },
  { id: 4, ts: '2026-09-15T10:05:00', user: 'Sarah Byrd', role: 'Front Desk', type: 'appointment', action: 'Booked appointment for Sarah Malone', patient: 'Sarah Malone', suspicious: false },
  { id: 5, ts: '2026-09-15T10:41:00', user: 'Nina Torres', role: 'Office Manager', type: 'record', action: 'Viewed patient record', patient: 'Tom Alvarez', suspicious: false },
  { id: 6, ts: '2026-09-15T11:45:00', user: 'Unknown device', role: 'Unknown', type: 'login', action: 'Login attempt flagged', patient: null, suspicious: true },
  { id: 7, ts: '2026-09-14T16:12:00', user: 'Dr. Rivera', role: 'Owner', type: 'login', action: 'Logged in', patient: null, suspicious: false },
  { id: 8, ts: '2026-09-14T15:03:00', user: 'James Coleman', role: 'Biller', type: 'claim', action: 'Submitted claim for Angela Ruiz', patient: 'Angela Ruiz', suspicious: false },
  { id: 9, ts: '2026-09-13T14:22:00', user: 'Sarah Byrd', role: 'Front Desk', type: 'message', action: 'Sent message to Maria Chen', patient: 'Maria Chen', suspicious: false },
  { id: 10, ts: '2026-09-13T08:00:00', user: 'Dr. Rivera', role: 'Owner', type: 'login', action: 'Logged in', patient: null, suspicious: false },
];

function App() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [mode, setMode] = useState(getInitialMode);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [userRole, setUserRole] = useState('Owner');
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const currentUser = { name: 'Dr. Rivera', role: userRole };

  function updateRolePermissions(role, perms) {
    setRolePermissions(rp => ({ ...rp, [role]: perms }));
  }
  const t = mode === 'dark' ? dark : light;
  const showFull = !collapsed || sidebarHover;
  const suppressHoverRef = useRef(false);

  function toggleCollapsed() {
    setCollapsed(c => !c);
    setSidebarHover(false);
    suppressHoverRef.current = true;
    window.setTimeout(() => { suppressHoverRef.current = false; }, 400);
  }

  async function handleLogout() {
    if (isFirebaseConfigured) {
      try { await signOut(auth); } catch { /* fall through to redirect regardless */ }
    }
    navigate('/login');
  }

  const notifRef = useRef(null);
  const searchRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem('praxismd-theme', mode);
    document.body.style.background = t.bgPage;
    document.body.style.colorScheme = mode;
  }, [mode, t.bgPage]);

  useEffect(() => {
    function onDocClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) { setUserMenuOpen(false); setSwitchOpen(false); }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!isTabVisible(activeTab, userRole, rolePermissions)) setActiveTab(firstVisibleTab(userRole, rolePermissions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, rolePermissions]);

  const { data: contactsData, loading: contactsLoading, error: contactsError, refetch: refetchContacts } = useGhlFetch(getContacts);
  const [demoContacts, setDemoContacts] = useState(DEMO_CONTACTS);
  const contacts = isGhlConfigured ? (contactsData || []).map(mapContact) : demoContacts;

  function addDemoPatient(patient) {
    setDemoContacts(cs => [{ id: `p-new-${Date.now()}`, tag: null, dateAdded: new Date().toLocaleDateString(), ...patient }, ...cs]);
  }

  const searchMatches = patientQuery.trim()
    ? contacts.filter(p => p.name.toLowerCase().includes(patientQuery.trim().toLowerCase()))
    : [];

  const notifications = [
    { Icon: AlertTriangle, text: 'Insurance eligibility issue for James Lee', time: '12m ago', color: t.amber },
    { Icon: MessageSquare, text: 'New message from Maria Chen', time: '18m ago', color: t.brand },
    { Icon: Star, text: 'New 5-star review from Sarah M.', time: '1h ago', color: t.accentAmber },
  ];

  function gate(tab, element) {
    if (activeTab !== tab) return null;
    return isTabVisible(tab, userRole, rolePermissions) ? element : <AccessRestricted tab={tab} />;
  }

  return (
    <ThemeContext.Provider value={t}>
    <style>{`
      @keyframes pxFadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .px-page-transition { animation: pxFadeSlide .32s ease; }
      .px-navitem { transition: background .12s ease, border-color .12s ease, color .12s ease; }
      .px-navitem:hover { background: ${t.bgHover}; }
      .px-row { transition: background .12s ease; }
      .px-row:hover { background: ${t.bgHover}; }
      .px-card { transition: transform .15s ease, box-shadow .15s ease; }
      .px-card:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,${mode === 'dark' ? '0.4' : '0.09'}); }
      button { transition: transform .08s ease; }
      button:active { transform: scale(0.96); }
      .px-tooltip-wrap { position: relative; }
      .px-tooltip-bubble {
        position: absolute; left: 100%; top: 50%; transform: translateY(-50%);
        margin-left: 12px; background: ${t.ink}; color: ${t.bgCard}; font-size: 11px;
        font-weight: 500; padding: 6px 10px; border-radius: 6px; white-space: nowrap;
        opacity: 0; pointer-events: none; transition: opacity .12s ease; z-index: 200;
      }
      .px-tooltip-wrap:hover .px-tooltip-bubble { opacity: 1; }
      input:focus, select:focus { outline: 2px solid ${withAlpha(t.teal, .35)}; }
      @keyframes pxSpin { to { transform: rotate(360deg); } }
      .px-spin { animation: pxSpin .7s linear infinite; }
      @keyframes pxSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes pxFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .px-panel-backdrop { animation: pxFadeIn .15s ease; }
      .px-panel { animation: pxSlideIn .2s ease; }
      @keyframes pxExpand { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      .px-expand { animation: pxExpand .15s ease; }
    `}</style>
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>

      {/* SIDEBAR */}
      <div
        onMouseEnter={() => { if (!suppressHoverRef.current) setSidebarHover(true); }}
        onMouseLeave={() => setSidebarHover(false)}
        style={{
          width: showFull ? '240px' : '72px', background: t.bgSidebar, borderRight: `1px solid ${t.border}`,
          display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', overflow: 'hidden',
          zIndex: collapsed && sidebarHover ? 60 : 40,
          boxShadow: collapsed && sidebarHover ? '4px 0 24px rgba(0,0,0,.18)' : 'none',
          transition: 'width .18s ease, box-shadow .18s ease',
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
          {showFull && <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '6px' }}>Bright Smiles Dental</div>}
          {!showFull && (
            <button onClick={toggleCollapsed} title="Expand sidebar" style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '12px', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', padding: '4px 0' }}>
              <Menu size={16} />
            </button>
          )}
        </div>

        <nav style={{ padding: showFull ? '8px 12px' : '8px 8px', flex: 1, overflowY: 'auto' }}>
          {MAIN_TABS.some(tb => isTabVisible(tb, userRole, rolePermissions)) && <NavSection label="Main" collapsed={!showFull} />}
          {isTabVisible('overview', userRole, rolePermissions) && <NavItem label="Overview" Icon={LayoutDashboard} tab="overview" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('inbox', userRole, rolePermissions) && <NavItem label="Inbox" Icon={InboxIcon} tab="inbox" active={activeTab} onClick={setActiveTab} badge="4" badgeColor={t.red} collapsed={!showFull} />}
          {isTabVisible('campaigns', userRole, rolePermissions) && <NavItem label="Campaigns" Icon={Megaphone} tab="campaigns" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('recall', userRole, rolePermissions) && <NavItem label="Recall" Icon={RotateCcw} tab="recall" active={activeTab} onClick={setActiveTab} badge="89" badgeColor={t.amber} collapsed={!showFull} />}
          {isTabVisible('calendar', userRole, rolePermissions) && <NavItem label="Calendar" Icon={CalendarIcon} tab="calendar" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('waitlist', userRole, rolePermissions) && <NavItem label="Waitlist" Icon={ClipboardList} tab="waitlist" active={activeTab} onClick={setActiveTab} badge="12" badgeColor={t.teal} collapsed={!showFull} />}
          {PRACTICE_TABS.some(tb => isTabVisible(tb, userRole, rolePermissions)) && <NavSection label="Practice" collapsed={!showFull} />}
          {isTabVisible('patients', userRole, rolePermissions) && <NavItem label="Patients" Icon={Users} tab="patients" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('portal', userRole, rolePermissions) && <NavItem label="Patient Portal" Icon={Contact} tab="portal" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('eligibility', userRole, rolePermissions) && <NavItem label="Eligibility" Icon={Shield} tab="eligibility" active={activeTab} onClick={setActiveTab} badge="3" badgeColor={t.amber} collapsed={!showFull} />}
          {isTabVisible('reviews', userRole, rolePermissions) && <NavItem label="Reviews" Icon={Star} tab="reviews" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('surveys', userRole, rolePermissions) && <NavItem label="Surveys" Icon={Smile} tab="surveys" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('aifrontdesk', userRole, rolePermissions) && <NavItem label="AI Front Desk" Icon={Bot} tab="aifrontdesk" active={activeTab} onClick={setActiveTab} badge="Live" badgeColor={t.purple} collapsed={!showFull} />}
          {BILLINGSEC_TABS.some(tb => isTabVisible(tb, userRole, rolePermissions)) && <NavSection label="Billing" collapsed={!showFull} />}
          {isTabVisible('billing', userRole, rolePermissions) && <NavItem label="Billing" Icon={Receipt} tab="billing" active={activeTab} onClick={setActiveTab} badge="Pro" badgeColor={t.purple} collapsed={!showFull} />}
          {isTabVisible('payments', userRole, rolePermissions) && <NavItem label="Payments" Icon={CreditCard} tab="payments" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {ANALYTICS_TABS.some(tb => isTabVisible(tb, userRole, rolePermissions)) && <NavSection label="Analytics" collapsed={!showFull} />}
          {isTabVisible('reports', userRole, rolePermissions) && <NavItem label="Reports" Icon={TrendingUp} tab="reports" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('activitylog', userRole, rolePermissions) && <NavItem label="Activity Log" Icon={Activity} tab="activitylog" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
          {isTabVisible('settings', userRole, rolePermissions) && <NavItem label="Settings" Icon={SettingsIcon} tab="settings" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />}
        </nav>

        <div style={{ padding: showFull ? '12px 16px' : '12px 0', borderTop: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', justifyContent: showFull ? 'space-between' : 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: t.brand, flexShrink: 0 }}>DR</div>
            {showFull && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Dr. Rivera</div>
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
      <div style={{ marginLeft: collapsed ? '72px' : '240px', flex: 1, display: 'flex', flexDirection: 'column', background: t.bgPage, minHeight: '100vh', transition: 'margin-left .18s ease' }}>

        {/* TOPBAR */}
        <div style={{ height: '64px', background: t.bgSidebar, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '24px', padding: '0 26px', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: t.ink }}>{getPageTitle(activeTab)}</div>
            <div style={{ fontSize: '12px', color: t.muted, marginTop: '2px' }}>Sunday, September 13 · Bright Smiles Dental</div>
          </div>

          <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search size={15} color={t.muted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={patientQuery}
              onChange={e => { setPatientQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search patients by name..."
              style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, fontSize: '13px', color: t.ink2, outline: 'none', fontFamily: 'inherit' }}
            />
            {searchOpen && patientQuery.trim() && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,.18)', overflow: 'hidden', zIndex: 100 }}>
                {searchMatches.length > 0 ? searchMatches.map((p, i) => (
                  <div
                    key={i}
                    className="px-row"
                    onClick={() => { setActiveTab('patients'); setSearchOpen(false); }}
                    style={{ padding: '10px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: i < searchMatches.length - 1 ? `1px solid ${t.border2}` : 'none' }}
                  >
                    <Ava initials={initialsOf(p.name)} bg={t.brandL} color={t.brand} />
                    <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{p.name}</div><div style={{ fontSize: '11px', color: t.muted }}>{p.phone}{p.tag ? ` · ${p.tag}` : ''}</div></div>
                  </div>
                )) : <div style={{ padding: '14px', fontSize: '13px', color: t.muted, textAlign: 'center' }}>{isGhlConfigured ? 'No patients found' : 'Connect GoHighLevel to search patients'}</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexShrink: 0 }}>
            <button
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle dark mode"
              title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, cursor: 'pointer', color: t.mid }}
            >
              {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => setNotifOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 15px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, fontSize: '13px', cursor: 'pointer', color: t.mid, position: 'relative' }}>
                <Bell size={15} />
                Notifications
                <span style={{ position: 'absolute', top: '7px', right: '10px', width: '7px', height: '7px', borderRadius: '50%', background: t.red }} />
              </button>
              {notifOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '300px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,.18)', overflow: 'hidden', zIndex: 100 }}>
                  <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.border2}`, fontSize: '13px', fontWeight: '600', color: t.ink }}>Notifications</div>
                  {notifications.map((n, i) => (
                    <div key={i} className="px-row" style={{ display: 'flex', gap: '10px', padding: '11px 14px', borderBottom: i < notifications.length - 1 ? `1px solid ${t.border2}` : 'none' }}>
                      <n.Icon size={16} color={n.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div><div style={{ fontSize: '12.5px', color: t.ink2 }}>{n.text}</div><div style={{ fontSize: '11px', color: t.muted, marginTop: '2px' }}>{n.time}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setActiveTab('campaigns')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 15px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              <Plus size={14} /> New campaign
            </button>

            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setUserMenuOpen(o => !o); setSwitchOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px 5px 5px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, cursor: 'pointer' }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: t.brand, flexShrink: 0 }}>{initialsOf(currentUser.name)}</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: '600', color: t.ink2, lineHeight: 1.25 }}>{currentUser.name}</div>
                  <span style={{ fontSize: '9.5px', fontWeight: '600', padding: '1px 7px', borderRadius: '20px', display: 'inline-block', marginTop: '2px', background: roleColor(currentUser.role, t).bg, color: roleColor(currentUser.role, t).color }}>{currentUser.role}</span>
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
          {gate('campaigns', <Campaigns userRole={userRole} />)}
          {gate('recall', <Recall userRole={userRole} />)}
          {gate('patients', <Patients query={patientQuery} onQueryChange={setPatientQuery} contacts={contacts} loading={contactsLoading} error={contactsError} onRetry={refetchContacts} onAddPatient={isGhlConfigured ? null : addDemoPatient} userRole={userRole} />)}
          {gate('billing', <Billing userRole={userRole} />)}
          {gate('payments', <Payments userRole={userRole} />)}
          {gate('reports', <Reports userRole={userRole} />)}
          {gate('settings', <Settings userRole={userRole} rolePermissions={rolePermissions} onUpdatePermissions={updateRolePermissions} onRoleChange={setUserRole} />)}
          {gate('activitylog', <ActivityLog userRole={userRole} />)}
          {gate('aifrontdesk', <AIFrontDesk userRole={userRole} />)}
          {gate('reviews', <Reviews userRole={userRole} />)}
          {gate('surveys', <Surveys userRole={userRole} />)}
          {gate('eligibility', <Eligibility userRole={userRole} />)}
          {gate('portal', <Portal userRole={userRole} />)}
          {gate('waitlist', <Waitlist userRole={userRole} />)}
          {gate('calendar', <Calendar userRole={userRole} />)}
        </div>
      </div>
    </div>
    </ThemeContext.Provider>
  );
}

// ─── HELPERS ───────────────────────────────────────────────
function getPageTitle(tab) {
  const titles = {
    overview: 'Good morning, Dr. Rivera',
    inbox: 'Inbox',
    campaigns: 'Campaigns',
    recall: 'Recall & Scheduling',
    calendar: 'Calendar',
    waitlist: 'Smart Waitlist',
    patients: 'Patients',
    portal: 'Patient Portal',
    eligibility: 'Insurance Eligibility',
    reviews: 'Reviews',
    surveys: 'Patient Satisfaction',
    aifrontdesk: 'AI Front Desk',
    billing: 'Billing Automation',
    payments: 'Payments & Plans',
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
  return <div style={{ fontSize: '10px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '1px', padding: '14px 10px 6px' }}>{label}</div>;
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
        borderRadius: '10px', marginBottom: '1px',
        borderLeft: `3px solid ${isActive ? t.teal : 'transparent'}`,
        color: isActive ? t.teal : t.mid,
        cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? '600' : '400',
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
      {!collapsed && badge && <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '20px', background: badgeColor + '22', color: badgeColor }}>{badge}</span>}
      {collapsed && <span className="px-tooltip-bubble">{label}{badge ? ` · ${badge}` : ''}</span>}
    </div>
  );
}

function StatCard({ label, value, color, accent, sub, icon: ValueIcon }) {
  const t = useTheme();
  const display = useCountUp(value);
  return (
    <div className="px-card" style={{ background: t.bgCard, borderRadius: '14px', padding: '16px 18px', border: `1px solid ${t.border}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${accent}, ${color})` }} />
      <div style={{ fontSize: '11px', color: t.muted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: '700', color, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {display}{ValueIcon && <ValueIcon size={18} color={color} fill={color} />}
      </div>
      <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '7px' }}>{sub}</div>
    </div>
  );
}

function Card({ children, style, onClick, className }) {
  const t = useTheme();
  return <div className={className ? `px-card ${className}` : 'px-card'} onClick={onClick} style={{ background: t.bgCard, borderRadius: '14px', padding: '18px 20px', border: `1px solid ${t.border}`, ...style }}>{children}</div>;
}

function CardTitle({ children }) {
  const t = useTheme();
  return <div style={{ fontSize: '13px', fontWeight: '600', color: t.ink2, marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{children}</div>;
}

function Pill({ label, color, bg }) {
  return <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px', background: bg, color, whiteSpace: 'nowrap' }}>{label}</span>;
}

function RowItem({ children, style, onClick }) {
  const t = useTheme();
  return <div className="px-row" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 13px', borderRadius: '10px', background: t.bgRow, marginBottom: '7px', borderWidth: '1px', borderStyle: 'solid', borderColor: t.border2, ...style }}>{children}</div>;
}

function Ava({ initials, bg, color }) {
  return <div style={{ width: '34px', height: '34px', minWidth: '34px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>{initials}</div>;
}

function Btn({ children, onClick, primary, small, style, disabled }) {
  const t = useTheme();
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: small ? '5px 11px' : '8px 14px', borderRadius: '10px', borderWidth: '1px', borderStyle: 'solid', borderColor: primary ? 'transparent' : t.border, background: primary ? t.brand : t.bgCard, color: primary ? 'white' : t.mid, fontSize: small ? '12px' : '13px', fontWeight: '500', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .65 : 1, ...style }}>{children}</button>
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
      <div className="px-panel" style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: '420px', maxWidth: '92vw', background: t.bgCard, borderLeft: `1px solid ${t.border}`, boxShadow: '-8px 0 30px rgba(0,0,0,.18)', zIndex: 201, overflowY: 'auto' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${t.border2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: t.bgCard }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink }}>{title}</div>
            {subtitle && <div style={{ fontSize: '12px', color: t.muted, marginTop: '2px' }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: '8px', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
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
      <div className="px-expand" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '420px', maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto', background: t.bgCard, borderRadius: '16px', border: `1px solid ${t.border}`, boxShadow: '0 20px 60px rgba(0,0,0,.25)', zIndex: 301 }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: t.bgCard }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink }}>{title}</div>
          <button onClick={onClose} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', borderRadius: '8px' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
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
function Overview({ setActiveTab }) {
  const t = useTheme();
  return (
    <div>
      <div style={{ background: `linear-gradient(120deg, ${withAlpha(t.brand, .12)}, ${withAlpha(t.teal, .08)})`, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '4px' }}>Today at a glance</div>
          <div style={{ fontSize: '13px', color: t.ink2, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '600' }}>Sunday, September 13, 2026</span>
            <span>☀️ 72°F</span>
            <span style={{ color: t.muted }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sparkles size={14} color={t.teal} /> 3 patients are due for recall today — send bulk recall?</span>
          </div>
        </div>
        <Btn primary onClick={() => setActiveTab('recall')}><Send size={13} /> Send bulk recall</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '20px' }}>
        <StatCard label="Revenue recovered" value="$8,400" color={t.green} accent={t.accentGreen} sub="↑ 14 patients reactivated" />
        <StatCard label="Appointments booked" value="31" color={t.brand} accent={t.accentBlue} sub="↑ 8 from campaigns" />
        <StatCard label="Google rating" value="4.8" icon={Star} color={t.amber} accent={t.accentAmber} sub="↑ 6 new reviews" />
        <StatCard label="Open messages" value="4" color={t.red} accent={t.accentRed} sub="Needs reply today" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '13px', marginBottom: '20px' }}>
        <StatCard label="Claims pending" value="7" color={t.purple} accent={t.accentPurple} sub="$4,200 in queue" />
        <StatCard label="Recall due" value="89" color={t.teal} accent={t.accentTeal} sub="Overdue 6-month" />
        <StatCard label="AI calls handled" value="47" color={t.green} accent={t.accentGreen} sub="Today · 0 missed" />
        <StatCard label="NPS score" value="72" color={t.pink} accent={t.accentPink} sub="↑ 4 pts this month" />
        <StatCard label="Waitlist filled" value="3" color={t.orange} accent={t.accentOrange} sub="Auto-filled today" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <Card>
          <CardTitle>Active campaigns <span onClick={() => setActiveTab('campaigns')} style={{ fontSize: '12px', color: t.brand, cursor: 'pointer', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>View all <ChevronRight size={12} /></span></CardTitle>
          <RowItem style={{ background: t.greenL, borderColor: withAlpha(t.accentGreen, .15) }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>6-month reactivation</div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>142 patients · Touch 3 of 7</div></div>
            <Pill label="Live" color={t.green} bg={t.greenL} />
          </RowItem>
          <RowItem style={{ background: t.greenL, borderColor: withAlpha(t.accentGreen, .15) }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Post-visit review request</div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>Auto-sends after every visit</div></div>
            <Pill label="Auto" color={t.brand} bg={t.brandL} />
          </RowItem>
          <RowItem style={{ background: t.amberL, borderColor: withAlpha(t.accentAmber, .15) }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Annual checkup reminder</div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>89 patients · Scheduled Sep 20</div></div>
            <Pill label="Queued" color={t.amber} bg={t.amberL} />
          </RowItem>
        </Card>

        <Card>
          <CardTitle>Today's appointments</CardTitle>
          <RowItem><div style={{ fontSize: '11.5px', color: t.muted, width: '50px', flexShrink: 0, fontWeight: '500' }}>9:00 AM</div><Ava initials="SM" bg={t.brandL} color={t.brand} /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Sarah Martinez</div><div style={{ fontSize: '11.5px', color: t.muted }}>Cleaning · 60 min</div></div><Pill label="Confirmed" color={t.green} bg={t.greenL} /></RowItem>
          <RowItem><div style={{ fontSize: '11.5px', color: t.muted, width: '50px', flexShrink: 0, fontWeight: '500' }}>10:30 AM</div><Ava initials="JL" bg={t.amberL} color={t.amber} /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>James Lee</div><div style={{ fontSize: '11.5px', color: t.muted }}>Crown fitting · 90 min</div></div><Pill label="Pending" color={t.amber} bg={t.amberL} /></RowItem>
          <RowItem><div style={{ fontSize: '11.5px', color: t.muted, width: '50px', flexShrink: 0, fontWeight: '500' }}>2:00 PM</div><Ava initials="AK" bg={t.greenL} color={t.green} /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Amy Kim</div><div style={{ fontSize: '11.5px', color: t.muted }}>Whitening · 45 min</div></div><Pill label="Confirmed" color={t.green} bg={t.greenL} /></RowItem>
          <RowItem style={{ background: t.redL, borderColor: withAlpha(t.accentRed, .15) }}><div style={{ fontSize: '11.5px', color: t.muted, width: '50px', flexShrink: 0, fontWeight: '500' }}>4:00 PM</div><Ava initials="RP" bg={t.redL} color={t.red} /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Robert Park</div><div style={{ fontSize: '11.5px', color: t.muted }}>Emergency · tooth pain</div></div><Pill label="Urgent" color={t.red} bg={t.redL} /></RowItem>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Recent messages <span onClick={() => setActiveTab('inbox')} style={{ fontSize: '12px', color: t.brand, cursor: 'pointer', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>View all <ChevronRight size={12} /></span></CardTitle>
          {[{ ini: 'MC', bg: t.brandL, c: t.brand, name: 'Maria Chen', msg: "Yes I'd like to book the cleaning for next week", time: '2m ago', unread: true },
            { ini: 'DW', bg: t.amberL, c: t.amber, name: 'David Wong', msg: 'Can I reschedule my 3pm appointment?', time: '18m ago', unread: true },
            { ini: 'TN', bg: t.greenL, c: t.green, name: 'Tina Nguyen', msg: 'Thank you! I left you a Google review ⭐', time: '1h ago', unread: false }
          ].map((m, i) => (
            <div key={i} className="px-row" style={{ display: 'flex', gap: '11px', padding: '11px 13px', borderRadius: '10px', marginBottom: '6px', background: m.unread ? t.brandL : t.bgRow, border: `1px solid ${m.unread ? withAlpha(t.accentBlue, .15) : t.border2}` }}>
              <Ava initials={m.ini} bg={m.unread ? m.c : m.bg} color={m.unread ? 'white' : m.c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{m.name}</span><span style={{ fontSize: '11px', color: t.muted }}>{m.time}</span></div>
                <div style={{ fontSize: '12px', color: t.muted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.msg}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <CardTitle>AI front desk — today</CardTitle>
          {[[Phone, 'Calls answered', '47', t.brand], [CalendarPlus, 'Appointments booked', '6', t.green], [Bot, 'Messages handled', '23', t.brand], [Hand, 'Escalated to team', '2', t.amber]].map(([Icon, label, val, color], i) => (
            <div key={i} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: t.bgRow, borderRadius: '10px', marginBottom: '6px', border: `1px solid ${t.border2}` }}>
              <div style={{ fontSize: '12.5px', color: t.mid, display: 'flex', alignItems: 'center', gap: '8px' }}><Icon size={14} color={t.mid} />{label}</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color }}>{val}</div>
            </div>
          ))}
          <div style={{ marginTop: '8px', padding: '10px 12px', background: t.greenL, borderRadius: '10px', fontSize: '12px', color: t.green, fontWeight: '500', border: `1px solid ${withAlpha(t.accentGreen, .15)}`, display: 'flex', alignItems: 'center', gap: '7px' }}><Zap size={13} /> AI saved your team ~4.2 hours today</div>
        </Card>
      </div>
    </div>
  );
}

function PatientMessages() {
  const t = useTheme();
  const [allMessages, setAllMessages] = useState([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [expandedUid, setExpandedUid] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const q = query(collection(db, 'patientMessages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setAllMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const threadsByUid = {};
  allMessages.forEach(m => {
    if (!threadsByUid[m.patientUid]) threadsByUid[m.patientUid] = [];
    threadsByUid[m.patientUid].push(m);
  });
  const threadList = Object.entries(threadsByUid).map(([uid, msgs]) => {
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter(m => m.sender === 'patient' && !m.read).length;
    return { uid, patientName: last.patientName, msgs, last, unread };
  }).sort((a, b) => (b.last.createdAt?.toMillis?.() || 0) - (a.last.createdAt?.toMillis?.() || 0));

  async function openThread(thread) {
    const isExpanding = expandedUid !== thread.uid;
    setExpandedUid(isExpanding ? thread.uid : null);
    setReply('');
    if (isExpanding && thread.unread > 0) {
      const unreadDocs = thread.msgs.filter(m => m.sender === 'patient' && !m.read);
      await Promise.all(unreadDocs.map(m => updateDoc(doc(db, 'patientMessages', m.id), { read: true })));
    }
  }

  async function sendReply(thread) {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'patientMessages'), {
        patientUid: thread.uid,
        patientName: thread.patientName,
        sender: 'staff',
        text: reply.trim(),
        createdAt: serverTimestamp(),
        read: true,
      });
      setReply('');
    } finally {
      setSending(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <Card style={{ marginBottom: '14px' }}>
        <CardTitle>Patient portal messages</CardTitle>
        <div style={{ fontSize: '12.5px', color: t.muted, textAlign: 'center', padding: '10px' }}>
          Messages patients send from their portal will show up here live once Firebase is connected.
        </div>
      </Card>
    );
  }

  if (loading) return <LoadingState label="Loading patient messages…" />;

  const totalUnread = threadList.reduce((n, th) => n + th.unread, 0);

  return (
    <Card style={{ marginBottom: '14px' }}>
      <CardTitle>Patient portal messages {totalUnread > 0 && <Pill label={`${totalUnread} unread`} color={t.brand} bg={t.brandL} />}</CardTitle>
      {threadList.length === 0 && (
        <div style={{ fontSize: '12.5px', color: t.muted, textAlign: 'center', padding: '10px' }}>No patient messages yet — they'll appear here as soon as a patient sends one from their portal.</div>
      )}
      {threadList.map(thread => {
        const isExpanded = expandedUid === thread.uid;
        return (
          <div key={thread.uid} style={{ borderBottom: `1px solid ${t.border2}` }}>
            <div onClick={() => openThread(thread)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 0', cursor: 'pointer' }}>
              <Ava initials={initialsOf(thread.patientName || 'Patient')} bg={t.tealL} color={t.teal} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{thread.patientName}</div>
                <div style={{ fontSize: '11.5px', color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{thread.last.sender === 'staff' ? 'You: ' : ''}{thread.last.text}</div>
              </div>
              {thread.unread > 0 && <Pill label="Unread" color={t.brand} bg={t.brandL} />}
              <ChevronDown size={14} color={t.muted} style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </div>
            {isExpanded && (
              <div className="px-expand" style={{ padding: '0 0 14px' }}>
                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', background: t.bgRow, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                  {thread.msgs.map(m => (
                    <div key={m.id} style={{ alignSelf: m.sender === 'staff' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      <div style={{ padding: '8px 11px', borderRadius: '12px', fontSize: '12.5px', background: m.sender === 'staff' ? t.brand : t.bgCard, color: m.sender === 'staff' ? 'white' : t.ink2, border: m.sender === 'staff' ? 'none' : `1px solid ${t.border}` }}>{m.text}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendReply(thread); }}
                    placeholder="Reply…"
                    style={{ flex: 1, padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2 }}
                  />
                  <Btn small primary onClick={() => sendReply(thread)} disabled={sending}>
                    {sending ? <Loader2 size={13} className="px-spin" /> : <Send size={13} />} Send
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

// ─── INBOX ─────────────────────────────────────────────────
function Inbox({ contacts }) {
  const t = useTheme();
  const { data, loading, error, refetch } = useGhlFetch(getConversations);
  const [demoConversations, setDemoConversations] = useState(DEMO_CONVERSATIONS);
  const [drafts, setDrafts] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [sendError, setSendError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  if (isGhlConfigured && loading) return <LoadingState label="Loading conversations…" />;
  if (isGhlConfigured && error) return <ErrorState message={error} onRetry={refetch} />;

  const conversations = isGhlConfigured ? (data || []).map(mapConversation) : demoConversations;
  const contactList = contacts || [];

  async function handleSend(convo) {
    const text = (drafts[convo.id] || '').trim();
    if (!text) return;
    if (!isGhlConfigured) {
      setDemoConversations(cs => cs.map(c => c.id === convo.id ? { ...c, lastMessage: text, time: 'Just now', unread: false } : c));
      setDrafts(d => ({ ...d, [convo.id]: '' }));
      return;
    }
    setSendingId(convo.id);
    setSendError('');
    try {
      await sendMessage(convo.contactId, text);
      setDrafts(d => ({ ...d, [convo.id]: '' }));
    } catch (err) {
      setSendError(err.message || 'Could not send message.');
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[`All (${conversations.length})`, 'SMS', 'Email', 'Missed calls', 'Voicemail'].map((label, i) => (
          <span key={i} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: i === 0 ? 'none' : `1px solid ${t.border}`, background: i === 0 ? t.brand : t.bgCard, color: i === 0 ? 'white' : t.mid }}>{label}</span>
        ))}
      </div>

      <PatientMessages />

      {!isGhlConfigured && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.tealL, borderRadius: '10px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}`, display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Sparkles size={13} /> Showing demo conversations — connect GoHighLevel to load real messages.
        </div>
      )}

      {sendError && (
        <div style={{ background: t.redL, color: t.red, border: `1px solid ${withAlpha(t.accentRed, .2)}`, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '14px' }}>{sendError}</div>
      )}

      {conversations.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '32px', color: t.muted }}>No conversations yet.</Card>
      )}

      {conversations.map((m, i) => {
        const [color, bg] = avatarStyle(t, i);
        const isExpanded = expandedId === m.id;
        const matchedContact = contactList.find(c => c.id === m.contactId);
        return (
          <div key={m.id} className="px-card" style={{ background: t.bgCard, borderRadius: '14px', padding: '16px 18px', border: `1px solid ${t.border}`, marginBottom: '10px', borderLeft: `4px solid ${m.unread ? t.accentBlue : t.border}` }}>
            <div onClick={() => setExpandedId(isExpanded ? null : m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
                <Ava initials={initialsOf(m.name)} bg={bg} color={color} />
                <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{m.name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{m.time}</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {m.unread && <Pill label="Unread" color={t.brand} bg={t.brandL} />}
                <ChevronDown size={16} color={t.muted} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }} />
              </div>
            </div>
            <div style={{ fontSize: '13px', color: t.ink2, padding: '10px 12px', background: t.bgRow, borderRadius: '10px', marginBottom: isExpanded ? '10px' : 0, whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.lastMessage}</div>

            {isExpanded && (
              <div className="px-expand">
                {matchedContact ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ padding: '9px 11px', background: t.bgRow, borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: t.muted, textTransform: 'uppercase' }}>Phone</div>
                      <div style={{ fontSize: '12.5px', color: t.ink2, marginTop: '2px' }}>{matchedContact.phone}</div>
                    </div>
                    <div style={{ padding: '9px 11px', background: t.bgRow, borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: t.muted, textTransform: 'uppercase' }}>Tag</div>
                      <div style={{ fontSize: '12.5px', color: t.ink2, marginTop: '2px' }}>{matchedContact.tag || '—'}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '11.5px', color: t.muted, marginBottom: '12px' }}>No matching contact record found.</div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={drafts[m.id] || ''}
                    onChange={e => setDrafts(d => ({ ...d, [m.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleSend(m); }}
                    placeholder="Type a reply…"
                    style={{ flex: 1, padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}
                  />
                  <Btn small primary onClick={() => handleSend(m)} disabled={sendingId === m.id}>
                    {sendingId === m.id ? <Loader2 size={13} className="px-spin" /> : <Send size={13} />} Send
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}
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

function Campaigns() {
  const t = useTheme();
  const [campaigns, setCampaigns] = useState(CAMPAIGNS_DATA);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [exported, setExported] = useState(false);
  const [form, setForm] = useState({ name: '', type: CAMPAIGN_TYPES[0], audience: CAMPAIGN_AUDIENCES[0], touches: CAMPAIGN_TOUCHES[1], channel: CAMPAIGN_CHANNELS[0], message: '' });
  const colorMap = { brand: t.brand, green: t.green, amber: t.amber, purple: t.purple, muted: t.muted };

  function toggleStatus(name) {
    setCampaigns(cs => cs.map(c => c.name === name
      ? (c.pill === 'Live' ? { ...c, pill: 'Paused', pillColor: 'muted' } : { ...c, pill: 'Live', pillColor: 'green' })
      : c));
  }

  function launchNow(name) {
    setCampaigns(cs => cs.map(c => c.name === name ? { ...c, pill: 'Live', pillColor: 'green', prog: 0 } : c));
  }

  function createCampaign() {
    if (!form.name.trim()) return;
    setCampaigns(cs => [{
      name: form.name.trim(), sub: `${form.audience} · ${form.touches}-touch ${form.channel.toLowerCase()} · ${form.type}`,
      stats: [], statColors: [], pill: 'Live', pillColor: 'green', prog: 0,
      sequence: [{ day: 'Day 0', channel: form.channel === 'Both' ? 'SMS' : form.channel, label: form.message.trim() || 'First touch message', status: 'upcoming' }],
    }, ...cs]);
    setForm({ name: '', type: CAMPAIGN_TYPES[0], audience: CAMPAIGN_AUDIENCES[0], touches: CAMPAIGN_TOUCHES[1], channel: CAMPAIGN_CHANNELS[0], message: '' });
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Patients in sequences" value="231" color={t.brand} accent={t.accentBlue} sub="" />
        <StatCard label="Replies this month" value="47" color={t.amber} accent={t.accentAmber} sub="↑ 20% from last month" />
        <StatCard label="Booked from campaigns" value="14" color={t.green} accent={t.accentGreen} sub="$8,400 revenue recovered" />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <Btn primary onClick={() => setShowForm(s => !s)}><Plus size={14} /> New campaign</Btn>
        <Btn onClick={() => { setExported(true); setTimeout(() => setExported(false), 2200); }}>{exported ? <Check size={14} /> : <Download size={14} />} {exported ? 'Exported' : 'Export'}</Btn>
      </div>

      {showForm && (
        <Card className="px-expand" style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2, marginBottom: '12px' }}>New campaign</div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Campaign name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring cleaning push" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%', padding: '9px 8px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
                {CAMPAIGN_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Audience</label>
              <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} style={{ width: '100%', padding: '9px 8px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
                {CAMPAIGN_AUDIENCES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Touches</label>
              <select value={form.touches} onChange={e => setForm(f => ({ ...f, touches: Number(e.target.value) }))} style={{ width: '100%', padding: '9px 8px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
                {CAMPAIGN_TOUCHES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Channel</label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={{ width: '100%', padding: '9px 8px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
                {CAMPAIGN_CHANNELS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>First message ({form.message.length}/160)</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value.slice(0, 160) }))} rows={3} placeholder="Hi {'{'}first_name{'}'}, ..." style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, resize: 'vertical', boxSizing: 'border-box' }} />
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
              {c.pill === 'Live' && <Btn small onClick={e => { e.stopPropagation(); toggleStatus(c.name); }}>Pause</Btn>}
              {c.pill === 'Paused' && <Btn small onClick={e => { e.stopPropagation(); toggleStatus(c.name); }}>Resume</Btn>}
              {c.pill === 'Queued' && <Btn small onClick={e => { e.stopPropagation(); launchNow(c.name); }}>Launch now</Btn>}
            </div>
          </div>
          {c.stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${c.stats.length},1fr)`, gap: '10px', marginBottom: c.prog ? '10px' : '0' }}>
              {c.stats.map(([label, val], j) => (
                <div key={j} className="px-row" style={{ textAlign: 'center', padding: '10px', background: t.bgRow, borderRadius: '10px', border: `1px solid ${t.border2}` }}>
                  <div style={{ fontSize: '11px', color: t.muted }}>{label}</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: colorMap[c.statColors[j]] }}>{val}</div>
                </div>
              ))}
            </div>
          )}
          {c.prog && <div><div style={{ height: '4px', borderRadius: '3px', background: t.border, overflow: 'hidden', marginTop: '8px' }}><div style={{ height: '100%', borderRadius: '3px', background: t.accentGreen, width: `${c.prog}%` }} /></div><div style={{ fontSize: '11px', color: t.muted, marginTop: '5px' }}>Touch 3 of 7 · {c.prog}% through sequence</div></div>}
          {c.pill === 'Queued' && <div style={{ padding: '10px 12px', background: t.amberL, borderRadius: '10px', fontSize: '12px', color: t.amber, border: `1px solid ${withAlpha(t.accentAmber, .15)}`, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '7px' }}><Clock size={13} /> Scheduled in 7 days · 89 patients receive first touch September 20</div>}
        </Card>
      ))}

      {selected && (
        <SlidePanel title={selected.name} subtitle={selected.sub} onClose={() => setSelected(null)}>
          {selected.stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selected.stats.length, 3)},1fr)`, gap: '8px', marginBottom: '20px' }}>
              {selected.stats.map(([label, val], j) => (
                <div key={j} style={{ textAlign: 'center', padding: '10px', background: t.bgRow, borderRadius: '10px', border: `1px solid ${t.border2}` }}>
                  <div style={{ fontSize: '10px', color: t.muted }}>{label}</div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: colorMap[selected.statColors[j]] }}>{val}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '12px' }}>TOUCH-BY-TOUCH SEQUENCE</div>
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
        <RowItem key={r.id} style={{ background: t.brandL, borderColor: withAlpha(t.brand, .2) }}>
          <Ava initials={initialsOf(r.patientName || 'Patient')} bg={t.brandL} color={t.brand} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{r.patientName}</div>
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
            <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{r.patientName}</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Recall due this month" value="89" color={t.teal} accent={t.accentTeal} sub="Overdue for 6-month cleaning" />
        <StatCard label="Recalled this month" value="34" color={t.green} accent={t.accentGreen} sub="↑ 38% conversion rate" />
        <StatCard label="Recall revenue" value="$6,120" color={t.brand} accent={t.accentBlue} sub="From recalled patients" />
      </div>
      <PatientRequests />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Recall sequence — auto-touch</CardTitle>
          {[['3 months post-visit', 'Friendly reminder email — "Time for your checkup"', 'Active'],
            ['5 months post-visit', 'SMS — "Your cleaning is due next month"', 'Active'],
            ['6 months post-visit', 'SMS + email — "Book your cleaning today"', 'Active'],
            ['7 months — overdue', 'Urgent SMS — "Don\'t forget your dental health"', 'Overdue'],
          ].map(([title, sub, status], i) => (
            <RowItem key={i} style={status === 'Overdue' ? { background: t.redL, borderColor: withAlpha(t.accentRed, .15) } : { background: t.greenL, borderColor: withAlpha(t.accentGreen, .15) }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{title}</div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{sub}</div></div>
              <Pill label={status} color={status === 'Overdue' ? t.red : t.green} bg={status === 'Overdue' ? t.redL : t.greenL} />
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Overdue patients — action needed</CardTitle>
          {OVERDUE_PATIENTS.map(p => (
            <RowItem key={p.id} style={{ background: bgMap[p.bg], borderColor: withAlpha(t.accentRed, .15) }}>
              <Ava initials={p.ini} bg={bgMap[p.bg]} color={colorMap[p.c]} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{p.name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{p.sub}</div></div>
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
function Patients({ query, onQueryChange, contacts, loading, error, onRetry, onAddPatient }) {
  const t = useTheme();
  const q = query.trim().toLowerCase();
  const list = contacts || [];
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
    } else {
      av = (a.name || '').toLowerCase();
      bv = (b.name || '').toLowerCase();
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color={t.muted} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            placeholder="Search patients by name, email, or phone..."
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            style={{ width: '100%', padding: '9px 14px 9px 36px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }}
          />
        </div>
        <Btn primary onClick={handleAddClick}><Plus size={14} /> Add patient</Btn>
        <Btn onClick={() => setNotice("Bulk import isn't wired up in this scaffold yet.")}><Upload size={14} /> Import</Btn>
      </div>

      {notice && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.tealL, borderRadius: '10px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}` }}>{notice}</div>
      )}

      {showAddForm && (
        <Card className="px-expand" style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2, marginBottom: '12px' }}>Add a patient</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" style={{ padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" style={{ padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
            <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone" style={{ padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
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
            <div style={{ marginBottom: '14px', padding: '10px 14px', background: t.tealL, borderRadius: '10px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}`, display: 'flex', alignItems: 'center', gap: '7px' }}>
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
                    { label: 'Added', key: 'dateAdded' },
                    { label: '', key: null },
                  ].map((h, i) => (
                    <th
                      key={i}
                      onClick={h.key ? () => toggleSort(h.key) : undefined}
                      style={{ textAlign: 'left', padding: '9px 13px', color: t.muted, fontWeight: '500', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${t.border}`, cursor: h.key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
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
                  <tr key={p.id || i} onClick={() => setSelected(p)} className="px-row" style={{ borderBottom: `1px solid ${t.border2}`, cursor: 'pointer' }}>
                    <td style={{ padding: '11px 13px' }}><div style={{ fontWeight: '500', color: t.ink2 }}>{p.name}</div><div style={{ fontSize: '11px', color: t.muted }}>{p.email}</div></td>
                    <td style={{ padding: '11px 13px', color: t.mid }}>{p.phone}</td>
                    <td style={{ padding: '11px 13px' }}>{p.tag ? <Pill label={p.tag} color={t.brand} bg={t.brandL} /> : <span style={{ color: t.muted }}>—</span>}</td>
                    <td style={{ padding: '11px 13px', color: t.mid }}>{p.dateAdded}</td>
                    <td style={{ padding: '11px 13px', textAlign: 'right' }}><Btn small onClick={e => { e.stopPropagation(); setSelected(p); }}>View</Btn></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: t.muted }}>{list.length === 0 ? 'No patients yet.' : `No patients match "${query}"`}</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {selected && (
        <SlidePanel title={selected.name} subtitle={selected.tag || 'Patient'} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: t.brandL, color: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '700' }}>{initialsOf(selected.name)}</div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: t.ink }}>{selected.name}</div>
              {selected.tag && <div style={{ marginTop: '4px' }}><Pill label={selected.tag} color={t.brand} bg={t.brandL} /></div>}
            </div>
          </div>
          <DetailRow label="Email" value={selected.email} />
          <DetailRow label="Phone" value={selected.phone} />
          <DetailRow label="Patient since" value={selected.dateAdded} />
          <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${t.border2}` }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '10px' }}>APPOINTMENT HISTORY</div>
            <div style={{ padding: '16px', background: t.bgRow, borderRadius: '10px', fontSize: '12.5px', color: t.muted, textAlign: 'center' }}>
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
      <div style={{ padding: '11px 15px', background: t.purpleL, borderRadius: '10px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', border: `1px solid ${withAlpha(t.purple, .15)}` }}>
        <Zap size={14} color={t.purple} /><span style={{ fontSize: '13px', color: t.purple, fontWeight: '500' }}>Pro — Billing automation active · Connected to Office Ally clearinghouse</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '18px' }}>
        <StatCard label="Claims submitted" value="48" color={t.brand} accent={t.accentBlue} sub="This month" />
        <StatCard label="Claims paid" value="39" color={t.green} accent={t.accentGreen} sub="$28,400 collected" />
        <StatCard label="Pending" value="7" color={t.amber} accent={t.accentAmber} sub="$4,200 in queue" />
        <StatCard label="Denials" value="2" color={t.red} accent={t.accentRed} sub="Action needed" />
      </div>
      <Card>
        <CardTitle>Recent claims</CardTitle>
        {claims.map(c => (
          <div key={c.id} className="px-row" style={{ padding: '10px 13px', borderRadius: '10px', marginBottom: '6px', background: bgMap[c.bg], border: `1px solid ${colorMap[c.color]}22`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{c.name}</div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{c.code}</div></div>
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
function Payments() {
  const t = useTheme();
  const [patientName, setPatientName] = useState('');
  const [amount, setAmount] = useState('');
  const [reqType, setReqType] = useState('Co-pay collection');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setError('');
    setSent(false);
    setSending(true);
    try {
      await createPaymentLink(patientName, amount, reqType);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Collected this month" value="$12,840" color={t.green} accent={t.accentGreen} sub="↑ 18% from last month" />
        <StatCard label="Active payment plans" value="8" color={t.brand} accent={t.accentBlue} sub="$4,200 total outstanding" />
        <StatCard label="Co-pays collected online" value="$3,240" color={t.amber} accent={t.accentAmber} sub="Before patients arrived" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Active payment plans</CardTitle>
          {[
            ['JL', t.brandL, t.brand, 'James Lee · Crown $1,200', '$300/mo · 3 payments remaining', 'On track', t.green, t.greenL],
            ['PG', t.purpleL, t.purple, 'Patricia Green · Implant $3,200', '$200/mo · 14 payments remaining', 'On track', t.green, t.greenL],
            ['MB', t.redL, t.red, 'Mike Brown · Veneers $2,400', 'Payment failed Sep 10 — card declined', 'Failed', t.red, t.redL],
          ].map(([ini, bg, c, name, sub, status, sc, sbg], i) => (
            <RowItem key={i} style={status === 'Failed' ? { background: t.redL, borderColor: withAlpha(t.accentRed, .15) } : {}}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div></div>
              {status === 'Failed' ? <Btn small style={{ color: sc, borderColor: sc }}>Retry</Btn> : <Pill label={status} color={sc} bg={sbg} />}
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Send payment request</CardTitle>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Patient name</label>
            <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Search patient..." style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Amount</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="$0.00" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Type</label>
            <select value={reqType} onChange={e => setReqType(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
              <option>Co-pay collection</option><option>Balance due</option><option>Deposit for procedure</option><option>Payment plan setup</option>
            </select>
          </div>
          <Btn primary onClick={handleSend} disabled={sending} style={{ width: '100%', justifyContent: 'center' }}>
            {sending ? <Loader2 size={14} className="px-spin" /> : <Send size={14} />} Send payment link via SMS
          </Btn>
          {!isStripeConfigured && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: t.amberL, borderRadius: '10px', fontSize: '11.5px', color: t.amber, border: `1px solid ${withAlpha(t.accentAmber, .15)}`, display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
              <AlertTriangle size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
              <span>Stripe isn't connected yet. Add <code style={{ background: withAlpha(t.amber, .12), padding: '1px 5px', borderRadius: '4px' }}>REACT_APP_STRIPE_PUBLISHABLE_KEY</code> to your <code style={{ background: withAlpha(t.amber, .12), padding: '1px 5px', borderRadius: '4px' }}>.env.local</code> — this is a bare-bones scaffold for now.</span>
            </div>
          )}
          {error && isStripeConfigured && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: t.redL, borderRadius: '10px', fontSize: '11.5px', color: t.red, border: `1px solid ${withAlpha(t.accentRed, .15)}` }}>{error}</div>
          )}
          {sent && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: t.greenL, borderRadius: '10px', fontSize: '11.5px', color: t.green, border: `1px solid ${withAlpha(t.accentGreen, .15)}` }}>Payment link sent.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── AI FRONT DESK ─────────────────────────────────────────
function AIFrontDesk() {
  const t = useTheme();
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Calls answered today" value="47" color={t.green} accent={t.accentGreen} sub="0 missed · 100% rate" />
        <StatCard label="Appts booked by AI" value="6" color={t.brand} accent={t.accentBlue} sub="No human involvement" />
        <StatCard label="Escalated to staff" value="2" color={t.amber} accent={t.accentAmber} sub="Complex cases only" />
        <StatCard label="Hours saved today" value="4.2h" color={t.purple} accent={t.accentPurple} sub="Front desk time reclaimed" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Recent call log</CardTitle>
          {[
            { dot: t.accentGreen, title: 'Robert Park · 3 min · Emergency', sub: 'AI triaged tooth pain. Booked 4pm emergency slot. Sent intake form via SMS.', pill: 'Booked', c: t.green, bg: t.greenL },
            { dot: t.accentGreen, title: 'Unknown · 2 min · Hours inquiry', sub: 'Asked about office hours and parking. AI answered. Offered to book a cleaning.', pill: 'Resolved', c: t.brand, bg: t.brandL },
            { dot: t.accentAmber, title: 'Maria Chen · 4 min · Insurance Q', sub: 'Asked about Delta Dental coverage. AI escalated to staff — required plan lookup.', pill: 'Escalated', c: t.amber, bg: t.amberL },
            { dot: t.accentGreen, title: 'David Wong · 2 min · Reschedule', sub: 'Wanted to move Thursday appt. AI checked calendar, offered two alternatives. Done.', pill: 'Rescheduled', c: t.green, bg: t.greenL },
          ].map((c, i) => (
            <div key={i} className="px-row" style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: t.bgRow, borderRadius: '10px', marginBottom: '7px', border: `1px solid ${t.border2}` }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.dot, marginTop: '5px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{c.title}</div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{c.sub}</div></div>
              <Pill label={c.pill} color={c.c} bg={c.bg} />
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle>AI voice settings</CardTitle>
          {[['AI voice name', 'What callers hear when AI picks up', 'Alex'],
            ['Auto-book appointments', 'AI can book without staff approval', 'On'],
            ['Emergency escalation', 'Keywords that trigger urgent alert to staff', 'On'],
            ['After-hours SMS fallback', 'Texts caller if they call when closed', 'On'],
            ['Call recording', 'Stored 90 days · HIPAA compliant', 'On'],
          ].map(([title, sub, val], i) => (
            <RowItem key={i} style={{ justifyContent: 'space-between' }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{title}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div></div>
              <span style={{ fontSize: i === 0 ? '13px' : '11px', color: i === 0 ? t.brand : t.green, fontWeight: '500', background: i === 0 ? 'transparent' : t.greenL, padding: i === 0 ? '0' : '3px 9px', borderRadius: '20px' }}>{val}</span>
            </RowItem>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── REVIEWS ───────────────────────────────────────────────
const REVIEWS_DATA = [
  { id: 'rv1', rating: 5, text: '"Dr. Rivera and the team are absolutely wonderful. The automated reminder texts are so convenient!"', author: '— Sarah M. · 2 days ago · Google', negative: false },
  { id: 'rv2', rating: 3, text: '"Good dentist but the wait time was a bit long. Would appreciate better scheduling."', author: '— Anonymous · 1 week ago · Google', negative: true },
];

function Reviews() {
  const t = useTheme();
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [replied, setReplied] = useState({});
  const [aiDrafting, setAiDrafting] = useState(null);

  function draftWithAi(r) {
    setAiDrafting(r.id);
    setTimeout(() => {
      setDrafts(d => ({ ...d, [r.id]: "Thank you for the feedback — we're sorry your wait ran long and are working on tightening up scheduling. We'd love the chance to give you a smoother visit next time." }));
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Google rating" value="4.8" icon={Star} color={t.amber} accent={t.accentAmber} sub="From 142 total reviews" />
        <StatCard label="New this month" value="6" color={t.green} accent={t.accentGreen} sub="↑ 3 from last month" />
        <StatCard label="Response rate" value="92%" color={t.brand} accent={t.accentBlue} sub="Industry avg is 54%" />
      </div>
      <Card>
        <CardTitle>Recent reviews</CardTitle>
        {REVIEWS_DATA.map(r => (
          <div key={r.id} className="px-row" style={{ padding: '14px', borderRadius: '10px', background: t.bgRow, marginBottom: '10px', border: `1px solid ${t.border2}`, borderLeft: `3px solid ${r.negative ? t.accentRed : t.accentAmber}` }}>
            <div style={{ marginBottom: '5px' }}><StarRating rating={r.rating} /></div>
            <div style={{ fontSize: '12.5px', color: t.mid, lineHeight: '1.6' }}>{r.text}</div>
            <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '7px' }}>{r.author}</div>
            {replied[r.id] ? (
              <div style={{ marginTop: '8px' }}><Pill label="Replied" color={t.green} bg={t.greenL} /></div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {r.negative && (
                    <Btn small primary onClick={() => { setOpenId(r.id); draftWithAi(r); }} disabled={aiDrafting === r.id}>
                      {aiDrafting === r.id ? <Loader2 size={13} className="px-spin" /> : <Bot size={13} />} AI draft response
                    </Btn>
                  )}
                  <Btn small onClick={() => setOpenId(id => (id === r.id ? null : r.id))}>Reply</Btn>
                </div>
                {openId === r.id && (
                  <div className="px-expand" style={{ marginTop: '10px' }}>
                    <textarea
                      value={drafts[r.id] || ''} onChange={e => setDrafts(d => ({ ...d, [r.id]: e.target.value }))}
                      placeholder="Write a reply…" rows={3}
                      style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="NPS score" value="72" color={t.pink} accent={t.accentPink} sub="↑ 4 pts from last month" />
        <StatCard label="Promoters (9-10)" value="68%" color={t.green} accent={t.accentGreen} sub="Would recommend us" />
        <StatCard label="Detractors (0-6)" value="12%" color={t.red} accent={t.accentRed} sub="Needs follow-up" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Recent responses</CardTitle>
          {SURVEY_RESPONSES.map((s, i) => (
            <RowItem
              key={i} onClick={() => openSurvey(s)}
              style={{ cursor: 'pointer', ...(s.status === 'Detractor' ? { background: t.redL, borderColor: withAlpha(t.accentRed, .15) } : {}) }}
            >
              <Ava initials={s.ini} bg={bgMap[s.bg]} color={colorMap[s.c]} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{s.name} · Score: {s.score}</div><div style={{ fontSize: '11.5px', color: t.muted }}>"{s.quote}"</div></div>
              <Pill label={s.status} color={colorMap[s.sc]} bg={bgMap[s.sbg]} />
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>NPS breakdown</CardTitle>
          {[['Promoters (9-10)', '68%', t.accentGreen], ['Passives (7-8)', '20%', t.accentAmber], ['Detractors (0-6)', '12%', t.accentRed]].map(([label, pct, color], i) => (
            <div key={i} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.muted, marginBottom: '5px' }}><span>{label}</span><span style={{ color, fontWeight: '600' }}>{pct}</span></div>
              <div style={{ height: '4px', borderRadius: '3px', background: t.border, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', background: color, width: pct }} /></div>
            </div>
          ))}
        </Card>
      </div>

      {selected && (
        <SlidePanel title={selected.name} subtitle={`${selected.date} · Score ${selected.score}/10`} onClose={() => setSelected(null)}>
          {selected.answers.map(([q, a], i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '600', color: t.muted, marginBottom: '4px' }}>{q}</div>
              <div style={{ fontSize: '13px', color: t.ink2, lineHeight: '1.5' }}>{a}</div>
            </div>
          ))}
          <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: `1px solid ${t.border2}` }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '10px' }}>REPLY TO PATIENT</div>
            {sentReply ? (
              <div style={{ padding: '12px 14px', background: t.greenL, color: t.green, borderRadius: '10px', fontSize: '12.5px' }}>Reply sent.</div>
            ) : (
              <>
                {selected.status === 'Detractor' && (
                  <Btn small onClick={draftWithAi} style={{ marginBottom: '10px' }} disabled={aiDrafting}>
                    {aiDrafting ? <Loader2 size={13} className="px-spin" /> : <Bot size={13} />} AI draft response
                  </Btn>
                )}
                <textarea
                  value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply…" rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Verified today" value="4" color={t.green} accent={t.accentGreen} sub="Auto-checked before appt" />
        <StatCard label="Issues found" value="3" color={t.amber} accent={t.accentAmber} sub="Requires action before visit" />
        <StatCard label="Denials prevented" value="$2,840" color={t.brand} accent={t.accentBlue} sub="This month in saved claims" />
      </div>
      <Card>
        <CardTitle>Today's verification results</CardTitle>
        {ELIGIBILITY_DATA.map((e, i) => (
          <div
            key={i} onClick={() => setSelected(e)} className="px-row"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', background: bgMap[e.rowBg], borderRadius: '10px', marginBottom: '6px', border: `1px solid ${t.border2}`, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <Ava initials={e.ini} bg={bgMap[e.bg]} color={colorMap[e.c]} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{e.name} · {e.payer}</div>
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
        <SlidePanel title={selected.name} subtitle={`${selected.payer} · Member ID ${selected.memberId}`} onClose={() => setSelected(null)}>
          <DetailRow label="Group number" value={selected.group} />
          <DetailRow label="Deductible" value={selected.deductible} />
          <DetailRow label="Next appointment" value={selected.nextAppt} />
          {selected.coverage.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '10px' }}>COVERAGE BREAKDOWN</div>
              {selected.coverage.map(([label, pct], i) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.mid, marginBottom: '5px' }}><span>{label}</span><span style={{ fontWeight: '600', color: t.ink2 }}>{pct}</span></div>
                  <div style={{ height: '4px', borderRadius: '3px', background: t.border, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', background: t.brand, width: pct }} /></div>
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
function Portal() {
  const t = useTheme();
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Forms pending" value="7" color={t.purple} accent={t.accentPurple} sub="Awaiting patient completion" />
        <StatCard label="Completed this week" value="18" color={t.green} accent={t.accentGreen} sub="↑ 94% completion rate" />
        <StatCard label="Docs e-signed" value="31" color={t.brand} accent={t.accentBlue} sub="No paper needed" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Pending intake forms</CardTitle>
          {[['RP', t.redL, t.red, 'Robert Park', 'Emergency intake — due before 4pm today', true],
            ['JL', t.amberL, t.amber, 'James Lee', 'Crown consent form — sent Sep 10', false],
            ['MC', t.brandL, t.brand, 'Maria Chen', 'New patient health history — sent Sep 12', false],
          ].map(([ini, bg, c, name, sub, urgent], i) => (
            <RowItem key={i} style={urgent ? { background: t.redL, borderColor: withAlpha(t.accentRed, .15) } : {}}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div></div>
              <Btn small primary={urgent}>Remind</Btn>
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Available forms</CardTitle>
          {['New patient health history', 'HIPAA consent form', 'Treatment plan consent', 'Insurance update form', 'Financial responsibility agreement'].map((form, i) => (
            <RowItem key={i} style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: t.ink2 }}>{form}</span>
              <Btn small>Send</Btn>
            </RowItem>
          ))}
        </Card>
      </div>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="On waitlist" value={String(list.length)} color={t.teal} accent={t.accentTeal} sub="Waiting for open slots" />
        <StatCard label="Slots filled this week" value="5" color={t.green} accent={t.accentGreen} sub="Auto-filled · no manual work" />
        <StatCard label="Avg fill time" value="8 min" color={t.brand} accent={t.accentBlue} sub="From cancellation to fill" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
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
                    <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{p.name}</div>
                    <div style={{ fontSize: '11.5px', color: t.muted }}>{p.service} · {p.pref}</div>
                  </div>
                  <Pill label={pillLabel} color={pillColor} bg={pillBg} />
                  <ChevronDown size={14} color={t.muted} style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </div>
                {isExpanded && (
                  <div className="px-expand" style={{ padding: '0 0 14px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <DetailRow label="Phone" value={p.phone} />
                    <DetailRow label="Waiting since" value={p.waitingSince} />
                    <div style={{ gridColumn: '1 / -1' }}><DetailRow label="Notes" value={p.notes} /></div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: '10px', padding: '10px 12px', background: t.tealL, borderRadius: '10px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}`, display: 'flex', alignItems: 'center', gap: '7px' }}><Zap size={13} /> When a slot opens PraxisMD auto-texts the next patient. First to reply gets the spot.</div>
        </Card>
        <Card>
          <CardTitle>Recent auto-fills</CardTitle>
          {[['Today 2:30pm — filled in 4 min', 'Maria Chen accepted · David Wong declined'],
            ['Yesterday 10am — filled in 11 min', 'Sam Kim accepted the slot'],
            ['Sep 11 4pm — filled in 6 min', 'Priya Patel accepted the slot'],
          ].map(([title, sub], i) => (
            <RowItem key={i} style={{ justifyContent: 'space-between' }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{title}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div></div>
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
  const [appointments, setAppointments] = useState(seedSeptemberAppointments);
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
    setAppointments(a => ({ ...a, [selectedKey]: [...(a[selectedKey] || []), entry] }));
    setNewPatient('');
    setShowAddForm(false);
  }

  function removeAppointment(id) {
    setAppointments(a => ({ ...a, [selectedKey]: (a[selectedKey] || []).filter(e => e.id !== id) }));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', alignItems: 'start' }}>
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
                  borderRadius: '10px', padding: '8px 6px', textAlign: 'center', cursor: 'pointer', minHeight: '54px',
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
        <div style={{ display: 'flex', gap: '14px', marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${t.border2}` }}>
          {[[t.brand, 'Today'], [t.brandL, 'Has appointments'], [t.bgRow, 'Available']].map(([bg, label], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: t.muted }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: bg, border: `1px solid ${t.border}` }} />{label}
            </div>
          ))}
        </div>
      </Card>

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
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{appt.patient}</div>
                <div style={{ fontSize: '11.5px', color: t.muted }}>{appt.type} · {appt.duration} min</div>
              </div>
              <button onClick={() => removeAppointment(appt.id)} title="Remove" style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', padding: '4px', display: 'flex' }}>
                <X size={14} />
              </button>
            </RowItem>
          );
        })}

        {showAddForm ? (
          <div style={{ background: t.bgRow, border: `1px solid ${t.border2}`, borderRadius: '10px', padding: '12px', marginTop: '8px' }}>
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

function Reports() {
  const t = useTheme();
  const colorMap = { brand: t.brand, green: t.green, teal: t.teal, amber: t.amber, pink: t.pink, orange: t.orange, purple: t.purple };
  const accentMap = { brand: t.accentBlue, green: t.accentGreen, teal: t.accentTeal, amber: t.accentAmber, pink: t.accentPink, orange: t.accentOrange, purple: t.accentPurple };
  const [period, setPeriod] = useState(REPORTS_PERIODS[0]);
  const [notice, setNotice] = useState('');
  const data = REPORTS_DATA[period];

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {REPORTS_PERIODS.map((label, i) => (
          <span key={i} onClick={() => setPeriod(label)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: period === label ? 'none' : `1px solid ${t.border}`, background: period === label ? t.brand : t.bgCard, color: period === label ? 'white' : t.mid }}>{label}</span>
        ))}
        <Btn small onClick={() => setNotice(`Exported ${period} report as PDF.`)}><Download size={13} /> Export PDF</Btn>
        {notice && <span style={{ fontSize: '12px', color: t.green, marginLeft: '4px' }}>{notice}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        {data.stats.map(([label, value, color, sub], i) => (
          <StatCard key={i} label={label} value={value} color={colorMap[color]} accent={accentMap[color]} sub={sub} />
        ))}
      </div>
      <Card>
        <CardTitle>Monthly performance breakdown</CardTitle>
        {data.metrics.map(([label, val, color], i) => (
          <div key={i} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', background: t.bgRow, borderRadius: '10px', marginBottom: '6px', border: `1px solid ${t.border2}` }}>
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
  { id: 'dentrix', name: 'Dentrix', sub: 'Practice management sync', connected: false },
  { id: 'eaglesoft', name: 'Eaglesoft', sub: 'Practice management sync', connected: false },
  { id: 'availity', name: 'Availity', sub: 'Eligibility verification', connected: false },
];

function Settings({ userRole, rolePermissions, onUpdatePermissions, onRoleChange }) {
  const t = useTheme();
  const [saved, setSaved] = useState(false);
  const [connectNotice, setConnectNotice] = useState('');
  const [staff, setStaff] = useState(STAFF_MEMBERS);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Front Desk' });
  const [inviteNotice, setInviteNotice] = useState('');
  const [editRoleStaff, setEditRoleStaff] = useState(null);
  const [editRoleValue, setEditRoleValue] = useState('');
  const [permEditorRole, setPermEditorRole] = useState(null);
  const [draftPerms, setDraftPerms] = useState({});

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2 };
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
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
            <div key={item.id} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: '10px', marginBottom: '8px', borderWidth: '1px', borderStyle: 'solid', background: item.connected ? t.greenL : t.bgRow, borderColor: item.connected ? withAlpha(t.accentGreen, .15) : t.border2 }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{item.name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{item.sub}</div></div>
              {item.connected ? <Pill label="Connected" color={t.green} bg={t.greenL} /> : <Btn small onClick={() => connect(item)}>Connect</Btn>}
            </div>
          ))}
          {connectNotice && (
            <div style={{ marginTop: '8px', padding: '10px 12px', background: t.tealL, borderRadius: '10px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}` }}>{connectNotice}</div>
          )}
        </Card>
      </div>

      <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink, marginBottom: '10px' }}>Team &amp; Permissions</div>

      <Card style={{ marginBottom: '14px' }}>
        <CardTitle>
          Team members
          <Btn small primary onClick={() => setShowInviteModal(true)}><UserPlus size={13} /> Invite staff member</Btn>
        </CardTitle>
        {inviteNotice && (
          <div style={{ marginBottom: '10px', padding: '10px 12px', background: t.tealL, borderRadius: '10px', fontSize: '12px', color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}` }}>{inviteNotice}</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.9fr 1.1fr 0.9fr 0.9fr 1.4fr', gap: '8px', padding: '0 13px 8px', fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px' }}>
          <div>Name</div><div>Email</div><div>Role</div><div>Last login</div><div>Status</div><div>Actions</div>
        </div>
        {staff.map(s => {
          const rc = roleColor(s.role, t);
          const isOwner = s.role === 'Owner';
          return (
            <div key={s.id} className="px-row" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.9fr 1.1fr 0.9fr 0.9fr 1.4fr', gap: '8px', alignItems: 'center', padding: '10px 13px', borderRadius: '10px', marginBottom: '6px', background: t.bgRow }}>
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
            <div key={role} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: '10px', marginBottom: '8px', background: t.bgRow }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Pill label={role} color={rc.color} bg={rc.bg} />
                <span style={{ fontSize: '12px', color: t.muted }}>{onCount} of {ALL_TABS.length} tabs visible</span>
              </div>
              <Btn small onClick={() => openPermEditor(role)}>Edit permissions</Btn>
            </div>
          );
        })}
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
            style={{ padding: '6px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', borderWidth: '1px', borderStyle: 'solid', borderColor: active ? 'transparent' : t.border, background: active ? t.brand : t.bgCard, color: active ? 'white' : t.mid }}
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

  const roleOptions = ['All', ...ROLES, 'Unknown'];
  const suspiciousCount = ACTIVITY_LOG.filter(a => a.suspicious).length;

  const filtered = ACTIVITY_LOG
    .filter(a => (roleFilter === 'All' || a.role === roleFilter))
    .filter(a => (typeFilter === 'All' || a.type === typeFilter))
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
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '6px' }}>Filter by role</div>
              <FilterPillGroup options={roleOptions} value={roleFilter} onChange={setRoleFilter} />
            </div>
            <Btn small onClick={exportCsv}><Download size={13} /> Export CSV</Btn>
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
            <RowItem key={a.id} style={a.suspicious ? { background: t.redL, borderColor: withAlpha(t.red, .2) } : undefined}>
              <div style={{ width: '128px', flexShrink: 0, fontSize: '12px', color: t.muted }}>{formatTs(a.ts)}</div>
              <Ava initials={initialsOf(a.user)} bg={a.suspicious ? t.redL : t.brandL} color={a.suspicious ? t.red : t.brand} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{a.action}{a.patient ? ` · ${a.patient}` : ''}</div>
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
