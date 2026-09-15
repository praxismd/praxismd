import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { light, dark, withAlpha } from './theme';
import { auth, isFirebaseConfigured } from './firebase';
import { getContacts, getConversations, sendMessage, isGhlConfigured } from './api/ghl';
import {
  LayoutDashboard, Inbox as InboxIcon, Megaphone, RotateCcw, Calendar as CalendarIcon,
  ClipboardList, Users, Contact, Shield, Star, Smile, Bot, Receipt, CreditCard,
  TrendingUp, Settings as SettingsIcon, Bell, Sun, Moon, Search, Menu, ChevronLeft,
  ChevronRight, ChevronDown, Phone, Hand, Zap, CalendarPlus, Sparkles, LogOut,
  Download, Upload, Clock, Send, RotateCw, AlertTriangle, Plus, MessageSquare, Loader2,
  X, ArrowUp, ArrowDown,
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

function App() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [mode, setMode] = useState(getInitialMode);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
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

  useEffect(() => {
    window.localStorage.setItem('praxismd-theme', mode);
    document.body.style.background = t.bgPage;
    document.body.style.colorScheme = mode;
  }, [mode, t.bgPage]);

  useEffect(() => {
    function onDocClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const { data: contactsData, loading: contactsLoading, error: contactsError, refetch: refetchContacts } = useGhlFetch(getContacts);
  const contacts = (contactsData || []).map(mapContact);

  const searchMatches = patientQuery.trim()
    ? contacts.filter(p => p.name.toLowerCase().includes(patientQuery.trim().toLowerCase()))
    : [];

  const notifications = [
    { Icon: AlertTriangle, text: 'Insurance eligibility issue for James Lee', time: '12m ago', color: t.amber },
    { Icon: MessageSquare, text: 'New message from Maria Chen', time: '18m ago', color: t.brand },
    { Icon: Star, text: 'New 5-star review from Sarah M.', time: '1h ago', color: t.accentAmber },
  ];

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
          <NavSection label="Main" collapsed={!showFull} />
          <NavItem label="Overview" Icon={LayoutDashboard} tab="overview" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavItem label="Inbox" Icon={InboxIcon} tab="inbox" active={activeTab} onClick={setActiveTab} badge="4" badgeColor={t.red} collapsed={!showFull} />
          <NavItem label="Campaigns" Icon={Megaphone} tab="campaigns" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavItem label="Recall" Icon={RotateCcw} tab="recall" active={activeTab} onClick={setActiveTab} badge="89" badgeColor={t.amber} collapsed={!showFull} />
          <NavItem label="Calendar" Icon={CalendarIcon} tab="calendar" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavItem label="Waitlist" Icon={ClipboardList} tab="waitlist" active={activeTab} onClick={setActiveTab} badge="12" badgeColor={t.teal} collapsed={!showFull} />
          <NavSection label="Practice" collapsed={!showFull} />
          <NavItem label="Patients" Icon={Users} tab="patients" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavItem label="Patient Portal" Icon={Contact} tab="portal" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavItem label="Eligibility" Icon={Shield} tab="eligibility" active={activeTab} onClick={setActiveTab} badge="3" badgeColor={t.amber} collapsed={!showFull} />
          <NavItem label="Reviews" Icon={Star} tab="reviews" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavItem label="Surveys" Icon={Smile} tab="surveys" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavItem label="AI Front Desk" Icon={Bot} tab="aifrontdesk" active={activeTab} onClick={setActiveTab} badge="Live" badgeColor={t.purple} collapsed={!showFull} />
          <NavSection label="Billing" collapsed={!showFull} />
          <NavItem label="Billing" Icon={Receipt} tab="billing" active={activeTab} onClick={setActiveTab} badge="Pro" badgeColor={t.purple} collapsed={!showFull} />
          <NavItem label="Payments" Icon={CreditCard} tab="payments" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavSection label="Analytics" collapsed={!showFull} />
          <NavItem label="Reports" Icon={TrendingUp} tab="reports" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
          <NavItem label="Settings" Icon={SettingsIcon} tab="settings" active={activeTab} onClick={setActiveTab} collapsed={!showFull} />
        </nav>

        <div style={{ padding: showFull ? '12px 16px' : '12px 0', borderTop: `1px solid ${t.border2}`, display: 'flex', alignItems: 'center', justifyContent: showFull ? 'space-between' : 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: t.brand, flexShrink: 0 }}>DR</div>
            {showFull && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Dr. Rivera</div>
                <div style={{ fontSize: '11px', color: t.muted }}>Practice owner</div>
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

            <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 15px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              <Plus size={14} /> New campaign
            </button>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div key={activeTab} className="px-page-transition" style={{ padding: '22px 26px', flex: 1 }}>
          {activeTab === 'overview' && <Overview setActiveTab={setActiveTab} />}
          {activeTab === 'inbox' && <Inbox contacts={contacts} />}
          {activeTab === 'campaigns' && <Campaigns />}
          {activeTab === 'recall' && <Recall />}
          {activeTab === 'patients' && <Patients query={patientQuery} onQueryChange={setPatientQuery} contacts={contacts} loading={contactsLoading} error={contactsError} onRetry={refetchContacts} />}
          {activeTab === 'billing' && <Billing />}
          {activeTab === 'payments' && <Payments />}
          {activeTab === 'reports' && <Reports />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'aifrontdesk' && <AIFrontDesk />}
          {activeTab === 'reviews' && <Reviews />}
          {activeTab === 'surveys' && <Surveys />}
          {activeTab === 'eligibility' && <Eligibility />}
          {activeTab === 'portal' && <Portal />}
          {activeTab === 'waitlist' && <Waitlist />}
          {activeTab === 'calendar' && <Calendar />}
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

function RowItem({ children, style }) {
  const t = useTheme();
  return <div className="px-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 13px', borderRadius: '10px', background: t.bgRow, marginBottom: '7px', border: `1px solid ${t.border2}`, ...style }}>{children}</div>;
}

function Ava({ initials, bg, color }) {
  return <div style={{ width: '34px', height: '34px', minWidth: '34px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>{initials}</div>;
}

function Btn({ children, onClick, primary, small, style }) {
  const t = useTheme();
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: small ? '5px 11px' : '8px 14px', borderRadius: '10px', border: primary ? 'none' : `1px solid ${t.border}`, background: primary ? t.brand : t.bgCard, color: primary ? 'white' : t.mid, fontSize: small ? '12px' : '13px', fontWeight: '500', cursor: 'pointer', ...style }}>{children}</button>
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
function GhlNotConnected({ what }) {
  const t = useTheme();
  return (
    <Card style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: t.amberL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <AlertTriangle size={20} color={t.amber} />
      </div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink, marginBottom: '6px' }}>GoHighLevel isn't connected</div>
      <div style={{ fontSize: '12.5px', color: t.mid, maxWidth: '380px', margin: '0 auto', lineHeight: '1.5' }}>
        Add <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>REACT_APP_GHL_API_KEY</code> and <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>REACT_APP_GHL_LOCATION_ID</code> to your <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>.env.local</code> to load real {what} here.
      </div>
    </Card>
  );
}

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

// ─── INBOX ─────────────────────────────────────────────────
function Inbox({ contacts }) {
  const t = useTheme();
  const { data, loading, error, refetch } = useGhlFetch(getConversations);
  const [drafts, setDrafts] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [sendError, setSendError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  if (!isGhlConfigured) return <GhlNotConnected what="conversations" />;
  if (loading) return <LoadingState label="Loading conversations…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const conversations = (data || []).map(mapConversation);
  const contactList = contacts || [];

  async function handleSend(convo) {
    const text = (drafts[convo.id] || '').trim();
    if (!text) return;
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

function Campaigns() {
  const t = useTheme();
  const [selected, setSelected] = useState(null);
  const colorMap = { brand: t.brand, green: t.green, amber: t.amber, purple: t.purple };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Patients in sequences" value="231" color={t.brand} accent={t.accentBlue} sub="" />
        <StatCard label="Replies this month" value="47" color={t.amber} accent={t.accentAmber} sub="↑ 20% from last month" />
        <StatCard label="Booked from campaigns" value="14" color={t.green} accent={t.accentGreen} sub="$8,400 revenue recovered" />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <Btn primary><Plus size={14} /> New campaign</Btn>
        <Btn><Download size={14} /> Export</Btn>
      </div>
      {CAMPAIGNS_DATA.map((c, i) => (
        <Card key={i} className="px-card" style={{ marginBottom: '12px', cursor: 'pointer' }} onClick={() => setSelected(c)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div><div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>{c.name}</div><div style={{ fontSize: '12px', color: t.muted, marginTop: '2px' }}>{c.sub}</div></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Pill label={c.pill} color={colorMap[c.pillColor]} bg={withAlpha(colorMap[c.pillColor], .12)} />
              {c.pill === 'Live' && <Btn small onClick={e => e.stopPropagation()}>Pause</Btn>}
              {c.pill === 'Queued' && <Btn small onClick={e => e.stopPropagation()}>Launch now</Btn>}
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
function Recall() {
  const t = useTheme();
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Recall due this month" value="89" color={t.teal} accent={t.accentTeal} sub="Overdue for 6-month cleaning" />
        <StatCard label="Recalled this month" value="34" color={t.green} accent={t.accentGreen} sub="↑ 38% conversion rate" />
        <StatCard label="Recall revenue" value="$6,120" color={t.brand} accent={t.accentBlue} sub="From recalled patients" />
      </div>
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
          {[['RP', t.redL, t.red, 'Robert Park', 'Last visit Jan 12 · 8 months overdue'],
            ['JL', t.amberL, t.amber, 'James Lee', 'Last visit Aug 20 · 1 month overdue'],
            ['MC', t.redL, t.red, 'Maria Chen', 'Last visit Mar 5 · 6 months overdue'],
          ].map(([ini, bg, c, name, sub], i) => (
            <RowItem key={i} style={{ background: bg, borderColor: withAlpha(t.accentRed, .15) }}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div></div>
              <Btn small>Send recall</Btn>
            </RowItem>
          ))}
          <Btn primary style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}><Send size={14} /> Send bulk recall to all 89 patients</Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── PATIENTS ──────────────────────────────────────────────
function Patients({ query, onQueryChange, contacts, loading, error, onRetry }) {
  const t = useTheme();
  const q = query.trim().toLowerCase();
  const list = contacts || [];
  const filtered = q ? list.filter(p => p.name.toLowerCase().includes(q)) : list;
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color={t.muted} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            placeholder="Search patients by name, email, or phone..."
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            style={{ width: '100%', padding: '9px 14px 9px 36px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}
          />
        </div>
        <Btn primary><Plus size={14} /> Add patient</Btn>
        <Btn><Upload size={14} /> Import</Btn>
      </div>

      {!isGhlConfigured ? (
        <GhlNotConnected what="patients" />
      ) : loading ? (
        <LoadingState label="Loading patients…" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <Card>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr>{['Patient', 'Phone', 'Tag', 'Added', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '9px 13px', color: t.muted, fontWeight: '500', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${t.border}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((p, i) => (
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
function Billing() {
  const t = useTheme();
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
        {[
          { name: 'Sarah Martinez', code: 'D1110 · Prophylaxis · Delta Dental · ERA auto-posted', amount: '$180', status: 'Paid', color: t.green, bg: t.greenL },
          { name: 'James Lee', code: 'D2740 · Crown · Aetna · Submitted 3 days ago', amount: '$1,200', status: 'Pending', color: t.amber, bg: t.amberL },
          { name: 'Robert Park', code: 'D7210 · Extraction · UnitedHealth · Denied: Missing info', amount: '$320', status: 'Denied', color: t.red, bg: t.redL },
        ].map((c, i) => (
          <div key={i} className="px-row" style={{ padding: '10px 13px', borderRadius: '10px', marginBottom: '6px', background: c.bg, border: `1px solid ${c.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{c.name}</div><div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{c.code}</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: c.color }}>{c.amount}</span>
              {c.status === 'Denied' ? <Btn small style={{ color: c.color, borderColor: c.color }}><RotateCw size={12} /> Resubmit</Btn> : <Pill label={c.status} color={c.color} bg={c.bg} />}
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
          {[['Patient name', 'text', 'Search patient...'], ['Amount', 'text', '$0.00']].map(([label, type, placeholder], i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>{label}</label>
              <input type={type} placeholder={placeholder} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }} />
            </div>
          ))}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Type</label>
            <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }}>
              <option>Co-pay collection</option><option>Balance due</option><option>Deposit for procedure</option><option>Payment plan setup</option>
            </select>
          </div>
          <Btn primary style={{ width: '100%', justifyContent: 'center' }}><Send size={14} /> Send payment link via SMS</Btn>
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
function Reviews() {
  const t = useTheme();
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Google rating" value="4.8" icon={Star} color={t.amber} accent={t.accentAmber} sub="From 142 total reviews" />
        <StatCard label="New this month" value="6" color={t.green} accent={t.accentGreen} sub="↑ 3 from last month" />
        <StatCard label="Response rate" value="92%" color={t.brand} accent={t.accentBlue} sub="Industry avg is 54%" />
      </div>
      <Card>
        <CardTitle>Recent reviews</CardTitle>
        {[
          { rating: 5, text: '"Dr. Rivera and the team are absolutely wonderful. The automated reminder texts are so convenient!"', author: '— Sarah M. · 2 days ago · Google', negative: false },
          { rating: 3, text: '"Good dentist but the wait time was a bit long. Would appreciate better scheduling."', author: '— Anonymous · 1 week ago · Google', negative: true },
        ].map((r, i) => (
          <div key={i} className="px-row" style={{ padding: '14px', borderRadius: '10px', background: t.bgRow, marginBottom: '10px', border: `1px solid ${t.border2}`, borderLeft: `3px solid ${r.negative ? t.accentRed : t.accentAmber}` }}>
            <div style={{ marginBottom: '5px' }}><StarRating rating={r.rating} /></div>
            <div style={{ fontSize: '12.5px', color: t.mid, lineHeight: '1.6' }}>{r.text}</div>
            <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '7px' }}>{r.author}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              {r.negative && <Btn small primary><Bot size={13} /> AI draft response</Btn>}
              <Btn small>Reply</Btn>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── SURVEYS ───────────────────────────────────────────────
function Surveys() {
  const t = useTheme();
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
          {[['TN', t.greenL, t.green, 'Tina Nguyen · Score: 10', '"Amazing experience — staff was so kind!"', 'Promoter', t.green, t.greenL],
            ['SM', t.brandL, t.brand, 'Sarah Martinez · Score: 9', '"Great service, would definitely return"', 'Promoter', t.green, t.greenL],
            ['AN', t.redL, t.red, 'Anonymous · Score: 4', '"Wait time too long, felt rushed"', 'Detractor', t.red, t.redL],
          ].map(([ini, bg, c, name, text, status, sc, sbg], i) => (
            <RowItem key={i} style={status === 'Detractor' ? { background: t.redL, borderColor: withAlpha(t.accentRed, .15) } : {}}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{text}</div></div>
              <Pill label={status} color={sc} bg={sbg} />
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
    </div>
  );
}

// ─── ELIGIBILITY ───────────────────────────────────────────
function Eligibility() {
  const t = useTheme();
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Verified today" value="4" color={t.green} accent={t.accentGreen} sub="Auto-checked before appt" />
        <StatCard label="Issues found" value="3" color={t.amber} accent={t.accentAmber} sub="Requires action before visit" />
        <StatCard label="Denials prevented" value="$2,840" color={t.brand} accent={t.accentBlue} sub="This month in saved claims" />
      </div>
      <Card>
        <CardTitle>Today's verification results</CardTitle>
        {[
          { ini: 'SM', bg: t.brandL, c: t.brand, name: 'Sarah Martinez · Delta Dental', sub: '$1,200 remaining benefits · $0 deductible · D1110 covered 100%', warn: false, status: 'Verified', sc: t.green, sbg: t.greenL, rowBg: t.bgRow },
          { ini: 'JL', bg: t.amberL, c: t.amber, name: 'James Lee · Aetna', sub: 'Deductible not met · Patient owes $450 before insurance kicks in', warn: true, status: 'Action needed', sc: t.amber, sbg: t.amberL, rowBg: t.amberL },
          { ini: 'AK', bg: t.greenL, c: t.green, name: 'Amy Kim · Cigna', sub: 'D9972 whitening not covered · Patient responsible for full $280', warn: false, status: 'Verified', sc: t.teal, sbg: t.tealL, rowBg: t.bgRow },
          { ini: 'RP', bg: t.redL, c: t.red, name: 'Robert Park · UnitedHealth', sub: 'Policy terminated Sep 1 · No active coverage — collect full payment', warn: true, status: 'No coverage', sc: t.red, sbg: t.redL, rowBg: t.redL },
        ].map((e, i) => (
          <div key={i} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', background: e.rowBg, borderRadius: '10px', marginBottom: '6px', border: `1px solid ${t.border2}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <Ava initials={e.ini} bg={e.bg} color={e.c} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{e.name}</div>
                <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {e.warn && <AlertTriangle size={12} color={t.amber} />}{e.sub}
                </div>
              </div>
            </div>
            <Pill label={e.status} color={e.sc} bg={e.sbg} />
          </div>
        ))}
      </Card>
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
function Reports() {
  const t = useTheme();
  const metrics = [
    ['Reactivation emails sent', '847', t.brand], ['SMS messages sent', '312', t.brand],
    ['Email open rate', '34%', t.brand], ['Reply rate', '18%', t.brand],
    ['Cost per booked appointment', '$35', t.green], ['Recall conversion rate', '38%', t.teal],
    ['Reviews collected', '6', t.amber], ['Average Google rating', '4.8', t.amber],
    ['NPS score', '72', t.pink], ['Waitlist slots filled', '14', t.orange],
    ['Insurance denials prevented', '$2,840', t.green], ['AI front desk calls', '847', t.purple],
    ['Claims submitted', '48', t.purple], ['Claims paid · revenue', '39 · $28,400', t.green],
    ['AI hours saved total', '~68 hrs', t.green],
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['September 2026', 'August', 'July', 'Q3 2026'].map((label, i) => (
          <span key={i} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: i === 0 ? 'none' : `1px solid ${t.border}`, background: i === 0 ? t.brand : t.bgCard, color: i === 0 ? 'white' : t.mid }}>{label}</span>
        ))}
        <Btn small><Download size={13} /> Export PDF</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Revenue recovered" value="$8,400" color={t.green} accent={t.accentGreen} sub="↑ 24% vs last month" />
        <StatCard label="New appointments" value="31" color={t.brand} accent={t.accentBlue} sub="↑ 8 from campaigns" />
        <StatCard label="Patient retention" value="87%" color={t.teal} accent={t.accentTeal} sub="↑ 4% improvement" />
      </div>
      <Card>
        <CardTitle>Monthly performance breakdown</CardTitle>
        {metrics.map(([label, val, color], i) => (
          <div key={i} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', background: t.bgRow, borderRadius: '10px', marginBottom: '6px', border: `1px solid ${t.border2}` }}>
            <span style={{ fontSize: '12.5px', color: t.mid }}>{label}</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color }}>{val}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────
function Settings() {
  const t = useTheme();
  const integrations = [
    ['GoHighLevel', 'CRM and automation', true],
    ['Office Ally', 'Clearinghouse · billing', true],
    ['Stripe', 'Payment processing', true],
    ['Google Business', 'Reviews and reputation', false],
    ['Dentrix', 'Practice management sync', false],
    ['Eaglesoft', 'Practice management sync', false],
    ['Availity', 'Eligibility verification', false],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      <Card>
        <CardTitle>Practice details</CardTitle>
        {[['Practice name', 'Bright Smiles Dental'], ['Phone number', '(813) 555-0142'], ['Email', 'hello@brightsmiles.com'], ['Address', '4210 W Bay Ave, Tampa FL 33616'], ['NPI number', '1234567890']].map(([label, val], i) => (
          <div key={i} style={{ marginBottom: '13px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>{label}</label>
            <input defaultValue={val} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2 }} />
          </div>
        ))}
        <Btn primary>Save changes</Btn>
      </Card>
      <Card>
        <CardTitle>Integrations</CardTitle>
        {integrations.map(([name, sub, connected], i) => (
          <div key={i} className="px-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: '10px', marginBottom: '8px', border: `1px solid ${t.border2}`, background: connected ? t.greenL : t.bgRow, borderColor: connected ? withAlpha(t.accentGreen, .15) : t.border2 }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{name}</div><div style={{ fontSize: '11.5px', color: t.muted }}>{sub}</div></div>
            {connected ? <Pill label="Connected" color={t.green} bg={t.greenL} /> : <Btn small>Connect</Btn>}
          </div>
        ))}
      </Card>
    </div>
  );
}

export default App;
