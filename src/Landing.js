import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, X, RotateCcw, Bot, ClipboardList, Receipt, Shield,
  Smile, CreditCard, Contact, Sparkles, Star, Menu, TrendingDown, TrendingUp,
  PhoneOff, FileWarning, Megaphone, Activity, Stethoscope, ShieldCheck,
  LayoutDashboard, InboxIcon, Users,
} from './icons';

// Self-contained palette — the landing page is always light mode and never
// imports the dashboard's theme (the dashboard's brand color is orange;
// the marketing site's brand color is blue, by design).
export const C = {
  bg: '#FFFFFF',
  bgAlt: '#F8FAFC',
  ink: '#0F172A',
  ink2: '#1E293B',
  mid: '#475569',
  muted: '#64748B', // WCAG AA (4.5:1+) against bg/bgAlt — the original #94A3B8 only cleared 2.6:1
  border: '#E2E8F0',
  brand: '#2563EB',
  brandDark: '#1D4ED8',
  brandL: '#EFF6FF',
  green: '#16A34A',
  greenL: '#F0FDF4',
  red: '#DC2626',
  redL: '#FEF2F2',
  amber: '#D97706',
  amberL: '#FFFBEB',
  purple: '#7C3AED',
  purpleL: '#F5F3FF',
  teal: '#0D9488',
  tealL: '#F0FDFA',
  rose: '#E11D48',
  roseL: '#FFF1F2',
  trim: '#0B1220',
};

function withAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Plain `href="#id"` anchors would normally let the browser scroll to the
// element natively, but HashRouter reads everything after `#` as a route to
// navigate to, so on this app it would try (and fail) to navigate instead of
// scrolling. Scroll manually and skip the hash entirely.
function scrollToId(id) {
  return () => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };
}

const inputStyle = {
  width: '100%', padding: '11px 13px', borderRadius: '10px', border: `1px solid ${C.border}`,
  fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: C.ink2, boxSizing: 'border-box',
};

// ─── DATA ──────────────────────────────────────────────────
const PROBLEM_CARDS = [
  { Icon: TrendingDown, title: 'Dead leads', cost: '$2,400/mo', desc: 'New patient inquiries go cold because no one follows up fast enough — or at all.' },
  { Icon: PhoneOff, title: 'Missed calls', cost: '$1,800/mo', desc: 'Every ring your front desk can’t answer is a patient who books somewhere else.' },
  { Icon: FileWarning, title: 'Billing errors', cost: '$3,200/mo', desc: 'Denied claims and eligibility mistakes quietly eat into revenue you’ve already earned.' },
];

const SOLUTION_LAYERS = [
  { n: '01', Icon: RotateCcw, title: 'Patient reactivation', desc: 'Automated multi-touch sequences win back lapsed patients without your team lifting a finger. Every dead lead gets worked, every time.', label: 'Included in all plans' },
  { n: '02', Icon: Bot, title: 'AI front desk', desc: 'An AI receptionist answers every call, triages urgency, and books directly into your calendar — 24/7, with zero missed calls.', label: 'Included in all plans' },
  { n: '03', Icon: Receipt, title: 'Billing automation', desc: 'ERA auto-posting and denial management work your claims automatically, so errors get caught and fixed before they cost you.', label: 'Pro plan' },
];

const FEATURES_9 = [
  { Icon: ClipboardList, title: 'Smart Waitlist', desc: 'Cancelled slots automatically text the next patient in line and fill themselves in minutes.', c: 'brand' },
  { Icon: Shield, title: 'Insurance Eligibility', desc: 'Every appointment is auto-checked against insurance before the patient walks in the door.', c: 'purple' },
  { Icon: Contact, title: 'Patient Portal', desc: 'Patients complete forms, sign documents, and message your team from their phone.', c: 'teal' },
  { Icon: Star, title: 'Review Automation', desc: 'Automated review requests turn happy visits into 5-star ratings, on autopilot.', c: 'amber' },
  { Icon: Smile, title: 'NPS Surveys', desc: 'Catch unhappy patients early with automated satisfaction surveys and recovery workflows.', c: 'rose' },
  { Icon: RotateCcw, title: 'Recall System', desc: 'Multi-touch recall sequences bring overdue patients back without manual follow-up.', c: 'brand' },
  { Icon: Megaphone, title: 'Custom Campaigns', desc: 'Build targeted email and SMS campaigns for any segment of your patient list.', c: 'rose' },
  { Icon: CreditCard, title: 'Payment Plans', desc: 'Stripe-powered payment plans with automatic retry on failed charges.', c: 'teal' },
  { Icon: Activity, title: 'Activity Log', desc: 'A full audit trail of every action taken across your practice, for compliance and accountability.', c: 'purple' },
];

const WHY_PILLARS = [
  {
    Icon: Stethoscope, title: 'Built for healthcare, not bolted onto it',
    desc: 'The general-purpose communications platforms in this space sell the same AI receptionist to plumbers, salons, and auto shops, then relabel it for healthcare. Every workflow here — patient portal, eligibility, billing — is designed around how a practice actually runs, not retrofitted from a horizontal answering service.',
  },
  {
    Icon: ShieldCheck, title: 'A full audit trail, not just an inbox',
    desc: "Every action taken on a patient's record — who viewed it, what changed, when — is logged automatically. That's the kind of accountability a compliance-minded practice needs, and it's not something a generalist messaging platform is built to prioritize.",
  },
];

const PRICING_PLANS = [
  {
    name: 'Starter', price: '$299', popular: false,
    blurb: 'For solo practices getting started with automation.',
    features: [
      'Up to 500 active patients',
      'Two-way texting & email',
      'Online booking & reminders',
      'Patient reactivation sequences',
      'Smart waitlist',
      'Basic reporting',
    ],
  },
  {
    name: 'Growth', price: '$499', popular: false,
    blurb: 'For growing practices that want more automation.',
    features: [
      'Everything in Starter',
      'Insurance eligibility verification',
      'NPS surveys & detractor recovery',
      'Custom campaigns',
      'Review automation',
      'Priority support',
    ],
  },
  {
    name: 'Pro', price: '$999', popular: true,
    blurb: 'For multi-provider practices that want it fully automated.',
    features: [
      'Everything in Growth',
      'AI front desk — answers & books calls',
      'Billing automation + ERA auto-posting',
      'Payment plans via Stripe with auto-retry',
      'Patient portal & e-signatures',
      'Activity log & audit trail',
      'Dedicated success manager',
    ],
  },
];

const FOOTER_COLUMNS = [
  { title: 'Product', links: ['Features', 'Pricing', 'Why us'] },
  { title: 'Company', links: ['About', 'Careers', 'Blog'] },
  { title: 'Resources', links: ['Help center', 'API docs', 'System status', 'Case studies'] },
  { title: 'Legal', links: [{ label: 'Privacy policy', to: '/privacy' }, { label: 'Terms of service', to: '/terms' }, 'BAA', 'Security'] },
];

// ─── SCROLL-REVEAL WRAPPER ─────────────────────────────────
function Reveal({ children, style }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: 'opacity .7s ease, transform .7s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── DEMO MODAL ────────────────────────────────────────────
function useDialogA11y(onClose, open) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const container = ref.current;
    const focusable = container?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    (focusable?.[0] || container)?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return ref;
}

function DemoModal({ open, onClose }) {
  const [form, setForm] = useState({ name: '', practice: '', email: '', phone: '', smsConsent: false });
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useDialogA11y(onClose, open);
  const titleId = useId();

  if (!open) return null;

  function handleChange(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setSubmitted(false);
      setForm({ name: '', practice: '', email: '', phone: '', smsConsent: false });
    }, 250);
  }

  return (
    <div
      onClick={handleClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{ background: C.bg, borderRadius: '18px', padding: '32px', maxWidth: '440px', width: '100%', boxShadow: '0 30px 70px rgba(15,23,42,.3)', position: 'relative' }}
      >
        <button type="button" onClick={handleClose} aria-label="Close" style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', display: 'flex' }}>
          <X size={18} color={C.muted} />
        </button>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: C.greenL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} color={C.green} />
            </div>
            <div id={titleId} style={{ fontSize: '18px', fontWeight: '700', color: C.ink, marginBottom: '8px' }}>Thanks — we’ll be in touch!</div>
            <div style={{ fontSize: '13.5px', color: C.mid, lineHeight: 1.6 }}>
              Someone from our team will reach out within one business day to schedule your walkthrough.
            </div>
          </div>
        ) : (
          <>
            <div id={titleId} style={{ fontSize: '20px', fontWeight: '700', color: C.ink, marginBottom: '6px' }}>Book a demo</div>
            <div style={{ fontSize: '13.5px', color: C.mid, marginBottom: '22px' }}>See PraxisMD on a 20-minute walkthrough with our team.</div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input required aria-label="Your name" value={form.name} onChange={handleChange('name')} placeholder="Your name" style={inputStyle} />
              <input required aria-label="Practice name" value={form.practice} onChange={handleChange('practice')} placeholder="Practice name" style={inputStyle} />
              <input required aria-label="Email address" type="email" value={form.email} onChange={handleChange('email')} placeholder="Email address" style={inputStyle} />
              <input required aria-label="Phone number" type="tel" value={form.phone} onChange={handleChange('phone')} placeholder="Phone number" style={inputStyle} />
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', lineHeight: 1.5, color: C.mid, cursor: 'pointer' }}>
                <input
                  required
                  type="checkbox"
                  checked={form.smsConsent}
                  onChange={handleChange('smsConsent')}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <span>
                  I agree to receive calls and text messages from PraxisMD about my demo request, including by automated means, at the phone number provided. Message and data rates may apply, message frequency varies. Reply STOP to opt out at any time. See our{' '}
                  <a href="#/terms" style={{ color: C.brand }}>Terms</a> and{' '}
                  <a href="#/privacy" style={{ color: C.brand }}>Privacy Policy</a>.
                </span>
              </label>
              <button type="submit" className="px-btn" style={{ marginTop: '6px', padding: '13px', borderRadius: '10px', border: 'none', background: C.brand, color: 'white', fontSize: '14.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                Request my demo
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── NAVBAR ────────────────────────────────────────────────
function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    ['Features', 'features'],
    ['Pricing', 'pricing'],
    ['Why us', 'why'],
  ];

  function go(id) {
    return () => { scrollToId(id)(); setMobileOpen(false); };
  }

  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
      <div style={{ height: '3px', background: C.trim }} />
      <div style={{ background: withAlpha('#FFFFFF', .92), backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.trim}` }}>
      <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '14px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px' }}>Px</div>
          <span style={{ fontSize: '18px', fontWeight: '700', color: C.ink }}>PraxisMD</span>
        </div>

        <nav aria-label="Main" className="px-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '28px', fontSize: '13.5px', fontWeight: '500', color: C.mid }}>
          {links.map(([label, id]) => (
            <button key={id} type="button" onClick={go(id)} style={{ color: 'inherit', background: 'transparent', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', cursor: 'pointer' }}>{label}</button>
          ))}
        </nav>

        <div className="px-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/login" style={{ color: C.mid, textDecoration: 'none', fontSize: '13.5px', fontWeight: '500', whiteSpace: 'nowrap' }}>Sign in</Link>
        </div>

        <button
          type="button"
          className="px-nav-hamburger"
          onClick={() => setMobileOpen(o => !o)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          style={{ display: 'none', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px' }}
        >
          {mobileOpen ? <X size={22} color={C.ink} /> : <Menu size={22} color={C.ink} />}
        </button>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile" className="px-nav-hamburger" style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 26px 18px', borderTop: `1px solid ${C.border}` }}>
          {links.map(([label, id]) => (
            <button key={id} type="button" onClick={go(id)} style={{ textAlign: 'left', padding: '11px 4px', border: 'none', background: 'transparent', fontSize: '14.5px', fontWeight: '500', color: C.ink2, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
          ))}
          <Link to="/login" onClick={() => setMobileOpen(false)} style={{ padding: '11px 4px', color: C.mid, textDecoration: 'none', fontSize: '14.5px', fontWeight: '500' }}>Sign in</Link>
        </nav>
      )}
      </div>
    </header>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: '11px', fontWeight: '700', color: C.brand, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', textAlign: 'center' }}>{children}</div>;
}

// ─── HERO DASHBOARD MOCKUP ─────────────────────────────────
function HeroMockup() {
  const stats = [
    ['Revenue', '$8,400', C.green, '+18%'],
    ['Appts today', '4', C.brand, null],
    ['Open messages', '4', C.rose, null],
    ['Unread alerts', '3', C.amber, null],
  ];
  const navItems = [
    ['Overview', LayoutDashboard, true],
    ['Inbox', InboxIcon, false],
    ['Campaigns', Megaphone, false],
    ['Recall', RotateCcw, false],
    ['Patients', Users, false],
  ];
  const chartBars = [38, 52, 44, 61, 58, 72, 90];
  const inbox = [
    { initials: 'MC', bg: '#E5ECFD', color: '#2563EB', name: 'Maria Chen', msg: "Yes I'd like to book the cleaning…" },
    { initials: 'DW', bg: '#DCFCE7', color: '#16A34A', name: 'David Wong', msg: 'Can I reschedule my 3pm appointment?' },
  ];

  return (
    <div aria-hidden="true" style={{ marginTop: '56px', maxWidth: '920px', marginLeft: 'auto', marginRight: 'auto' }}>
      <div style={{ background: '#1E293B', borderRadius: '14px 14px 0 0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22C55E' }} />
        </div>
        <div style={{ flex: 1, maxWidth: '280px', margin: '0 auto', background: 'rgba(255,255,255,.08)', borderRadius: '6px', padding: '4px 12px', fontSize: '11.5px', color: 'rgba(255,255,255,.6)', textAlign: 'center' }}>
          praxismd.health
        </div>
      </div>
      <div className="px-hero-mockup" style={{ background: '#fff', borderRadius: '0 0 14px 14px', border: `1px solid ${C.border}`, borderTop: 'none', padding: '22px', boxShadow: '0 40px 80px -20px rgba(15,23,42,.35)', transform: 'perspective(1400px) rotateX(4deg) scale(0.99)', transformOrigin: 'top center' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="px-hero-mockup-sidebar" style={{ width: '128px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map(([label, Icon, active], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderRadius: '7px', fontSize: '10.5px', fontWeight: '600', color: active ? '#F2734A' : '#94A3B8', background: active ? '#FFE8DA' : 'transparent' }}>
                <Icon size={12} color={active ? '#F2734A' : '#94A3B8'} />{label}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
              {stats.map(([label, val, color, trend], i) => (
                <div key={i} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '9px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '800', color }}>{val}</div>
                    {trend && <span style={{ display: 'flex', alignItems: 'center', gap: '1px', fontSize: '9px', fontWeight: '700', color: C.green }}><TrendingUp size={9} />{trend}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
              <div style={{ fontSize: '9.5px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>Revenue, last 7 days</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '54px' }}>
                {chartBars.map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', background: i === chartBars.length - 1 ? C.brand : withAlpha(C.brand, .28) }} />
                ))}
              </div>
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <div style={{ fontSize: '9.5px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>Priority inbox</div>
              {inbox.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700', flexShrink: 0 }}>{m.initials}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#1E293B' }}>{m.name}</span>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}> — {m.msg}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────
function Landing() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => {
    // Prefer the GHL chat widget so demo leads land straight in the CRM
    // with its own compliant consent flow, instead of the local form
    // below duplicating that data collection. Falls back to the local
    // modal if the widget script hasn't loaded (or its API changes).
    const widget = window.leadConnector?.chatWidget;
    if (widget && typeof widget.openWidget === 'function') {
      widget.openWidget();
      return;
    }
    setDemoOpen(true);
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: C.bg, color: C.ink2, minHeight: '100vh' }}>
      <style>{`
        html { scroll-behavior: smooth; }
        .px-btn { transition: transform .08s ease, box-shadow .15s ease; }
        .px-btn:active { transform: scale(0.97); }
        .px-pcard { transition: transform .15s ease, box-shadow .15s ease; }
        .px-pcard:hover { transform: translateY(-3px); box-shadow: 0 14px 32px rgba(0,0,0,.10); }
        .px-fcard { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .px-fcard:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,.07); border-color: ${withAlpha(C.brand, .3)}; }
        .px-problem-card { transition: transform .15s ease, box-shadow .15s ease; }
        .px-problem-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,.06); }
        .px-hero-mockup { transition: transform .4s ease; }
        .px-hero-mockup:hover { transform: perspective(1400px) rotateX(0deg) scale(1); }
        .px-footer-link { transition: color .12s ease; }
        .px-footer-link:hover { color: ${C.ink} !important; }
        .px-nav-hamburger { display: none; }
        @media (max-width: 760px) {
          .px-nav-links { display: none !important; }
          .px-nav-hamburger { display: flex !important; }
        }
        @media (max-width: 900px) {
          .px-pricing-grid { grid-template-columns: 1fr !important; }
          .px-features-grid { grid-template-columns: 1fr 1fr !important; }
          .px-problem-grid { grid-template-columns: 1fr !important; }
          .px-solution-grid { grid-template-columns: 1fr !important; }
          .px-solution-connector { display: none !important; }
          .px-why-grid { grid-template-columns: 1fr !important; }
          .px-footer-grid { grid-template-columns: 1fr 1fr !important; }
          .px-hero-headline { font-size: 34px !important; }
          .px-hero-mockup-sidebar { display: none !important; }
          .px-social-proof { flex-direction: column !important; }
        }
        @media (max-width: 560px) {
          .px-features-grid { grid-template-columns: 1fr !important; }
          .px-footer-grid { grid-template-columns: 1fr !important; }
        }
        a:focus-visible, button:focus-visible, [tabindex]:focus-visible,
        input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid ${C.brand};
          outline-offset: 2px;
        }
        .px-skip-link {
          position: absolute; top: -999px; left: 12px; z-index: 1000;
          background: ${C.brand}; color: white; padding: 10px 16px; border-radius: 6px;
          font-size: 13px; font-weight: 600; text-decoration: none;
        }
        .px-skip-link:focus { top: 12px; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
          html { scroll-behavior: auto; }
        }
      `}</style>

      <a href="#main-content" className="px-skip-link">Skip to main content</a>

      <NavBar />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />

      <main id="main-content">
      {/* HERO */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-260px', left: '50%', transform: 'translateX(-50%)',
          width: '1100px', height: '640px', borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${withAlpha(C.brand, .16)} 0%, ${withAlpha(C.brand, .05)} 45%, transparent 72%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto', padding: '150px 26px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: C.brandL, color: C.brand, fontSize: '12px', fontWeight: '600', marginBottom: '22px' }}>
          <Sparkles size={13} /> Built for dental &amp; medical practices
        </div>
        <h1 className="px-hero-headline" style={{ fontSize: '44px', fontWeight: '800', letterSpacing: '-1.2px', lineHeight: '1.15', color: C.ink, margin: '0 0 20px' }}>
          The only platform that reactivates your patients, runs your front desk, and handles your billing. All for less than what you pay for Weave.
        </h1>
        <p style={{ fontSize: '17px', color: C.mid, lineHeight: '1.6', margin: '0 auto 32px', maxWidth: '640px' }}>
          PraxisMD combines patient reactivation, an AI front desk, and billing automation into one platform —
          so your team spends less time chasing patients and paperwork, and more time in the chair.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={scrollToId('solution')} className="px-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 24px', borderRadius: '12px', border: `1px solid ${C.border}`, background: C.bg, color: C.ink2, fontSize: '15px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer' }}>
            See how it works
          </button>
        </div>

        <div className="px-social-proof" style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '44px', flexWrap: 'wrap' }}>
          {[
            '5-15 patients reactivated in first 30 days',
            'Zero missed calls with AI front desk',
            '15-30% more claims collected',
          ].map((stat, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: C.ink2 }}>
              <Check size={15} color={C.green} style={{ flexShrink: 0 }} />
              {stat}
            </div>
          ))}
        </div>

        <HeroMockup />
        </div>
      </div>

      {/* PROBLEM */}
      <div id="problem" style={{ background: `linear-gradient(180deg, ${C.bgAlt} 0%, ${withAlpha(C.red, .04)} 100%)`, padding: '80px 26px' }}>
        <Reveal style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '30px', fontWeight: '700', color: C.ink, textAlign: 'center', margin: '0 0 44px', letterSpacing: '-.5px', lineHeight: 1.3 }}>
            Your practice is leaving money on the table. Every. Single. Month.
          </h2>
          <div className="px-problem-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {PROBLEM_CARDS.map(({ Icon, title, cost, desc }, i) => (
              <div key={i} className="px-problem-card" style={{ background: C.bg, borderRadius: '16px', padding: '26px 22px', border: `1px solid ${C.border}`, borderTop: `4px solid ${C.red}` }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: C.redL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Icon size={19} color={C.red} />
                </div>
                <div style={{ fontSize: '15.5px', fontWeight: '700', color: C.ink, marginBottom: '4px' }}>{title}</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: C.red, marginBottom: '10px' }}>{cost}</div>
                <div style={{ fontSize: '13px', color: C.mid, lineHeight: '1.6' }}>{desc}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* SOLUTION */}
      <div id="solution" style={{ padding: '80px 26px' }}>
        <Reveal style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <SectionLabel>The fix</SectionLabel>
          <h2 style={{ fontSize: '30px', fontWeight: '700', color: C.ink, textAlign: 'center', margin: '0 0 44px', letterSpacing: '-.5px' }}>
            PraxisMD fixes all three. Automatically.
          </h2>
          <div style={{ position: 'relative' }}>
            <div className="px-solution-connector" style={{ position: 'absolute', top: '23px', left: '16.6%', right: '16.6%', height: '2px', background: C.border, zIndex: 0 }} />
            <div className="px-solution-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', position: 'relative', zIndex: 1 }}>
              {SOLUTION_LAYERS.map(({ n, Icon, title, desc, label }, i) => (
                <div key={i}>
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%', background: C.brand, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800',
                    margin: '0 auto 18px', boxShadow: `0 0 0 6px ${C.bg}`,
                  }}>
                    {n}
                  </div>
                  <div style={{ background: C.bgAlt, borderRadius: '16px', padding: '24px 22px', border: `1px solid ${C.border}`, height: '100%' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: C.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                      <Icon size={18} color={C.brand} />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: C.ink, marginBottom: '8px' }}>{title}</div>
                    <div style={{ fontSize: '13px', color: C.mid, lineHeight: '1.6', marginBottom: '16px' }}>{desc}</div>
                    <div style={{ display: 'inline-flex', padding: '4px 11px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: label === 'Pro plan' ? C.amberL : C.greenL, color: label === 'Pro plan' ? C.amber : C.green }}>
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ background: C.bgAlt, padding: '80px 26px' }}>
        <Reveal style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <SectionLabel>Everything included</SectionLabel>
          <h2 style={{ fontSize: '30px', fontWeight: '700', color: C.ink, textAlign: 'center', margin: '0 0 12px', letterSpacing: '-.5px' }}>
            Everything your practice needs. Nothing it doesn’t.
          </h2>
          <p style={{ fontSize: '14.5px', color: C.mid, textAlign: 'center', maxWidth: '560px', margin: '0 auto 44px' }}>
            One platform instead of five different tools that don’t talk to each other.
          </p>
          <div className="px-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {FEATURES_9.map(({ Icon, title, desc, c }, i) => (
              <div key={i} className="px-fcard" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '22px 20px 20px', borderTop: `3px solid ${C[c]}` }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: C[`${c}L`], display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <Icon size={20} color={C[c]} />
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: '600', color: C.ink2, marginBottom: '6px' }}>{title}</div>
                <div style={{ fontSize: '12.5px', color: C.mid, lineHeight: '1.55' }}>{desc}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* WHY */}
      <div id="why" style={{ padding: '80px 26px' }}>
        <Reveal style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <SectionLabel>Why PraxisMD</SectionLabel>
          <h2 style={{ fontSize: '30px', fontWeight: '700', color: C.ink, textAlign: 'center', margin: '0 0 44px', letterSpacing: '-.5px' }}>
            Two things a general-purpose platform can't fake
          </h2>
          <div className="px-why-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {WHY_PILLARS.map(({ Icon, title, desc }, i) => (
              <div key={i} style={{ background: C.bgAlt, borderRadius: '16px', padding: '30px 26px', border: `1px solid ${C.border}` }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '11px', background: C.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                  <Icon size={21} color={C.brand} />
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: C.ink, marginBottom: '10px' }}>{title}</div>
                <div style={{ fontSize: '13.5px', color: C.mid, lineHeight: '1.65' }}>{desc}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* PRICING */}
      <div id="pricing" style={{ background: C.bgAlt, padding: '80px 26px' }}>
        <Reveal style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <SectionLabel>Pricing</SectionLabel>
          <h2 style={{ fontSize: '30px', fontWeight: '700', color: C.ink, textAlign: 'center', margin: '0 0 12px', letterSpacing: '-.5px' }}>
            Simple pricing. No hidden fees. No long term contracts.
          </h2>
          <p style={{ fontSize: '14.5px', color: C.mid, textAlign: 'center', maxWidth: '520px', margin: '0 auto 44px' }}>
            Most practices recover their subscription cost in reactivated appointments within the first month.
          </p>
          <div className="px-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', alignItems: 'start' }}>
            {PRICING_PLANS.map((plan, i) => (
              <div
                key={i}
                className="px-pcard"
                style={{
                  background: C.bg, borderRadius: '16px', padding: '28px 24px',
                  border: plan.popular ? `2px solid ${C.brand}` : `1px solid ${C.border}`,
                  position: 'relative', boxShadow: plan.popular ? `0 12px 30px ${withAlpha(C.brand, .12)}` : 'none',
                }}
              >
                {plan.popular && (
                  <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '20px', background: C.brand, color: 'white', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                    <Star size={11} fill="white" /> MOST POPULAR
                  </div>
                )}
                <div style={{ fontSize: '15px', fontWeight: '700', color: C.ink, marginBottom: '4px' }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '30px', fontWeight: '800', color: C.ink }}>{plan.price}</span>
                  <span style={{ fontSize: '13px', color: C.muted }}>/mo</span>
                </div>
                <div style={{ fontSize: '12.5px', color: C.mid, marginBottom: '22px', minHeight: '36px' }}>{plan.blurb}</div>
                <button
                  type="button"
                  onClick={openDemo}
                  className="px-btn"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%',
                    padding: '11px', borderRadius: '10px', marginBottom: '22px',
                    fontSize: '13.5px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer',
                    background: plan.popular ? C.brand : C.bgAlt,
                    color: plan.popular ? 'white' : C.ink2,
                    border: plan.popular ? 'none' : `1px solid ${C.border}`,
                  }}
                >
                  Get started
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '13px', color: C.mid }}>
                      <Check size={15} color={C.green} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: '12.5px', color: C.muted, marginTop: '36px' }}>
            All plans include a signed BAA, HIPAA-compliant infrastructure, and free data migration onboarding — no setup fees, cancel anytime.
          </div>
        </Reveal>
      </div>

      </main>

      {/* FOOTER */}
      <footer id="contact" style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}`, padding: '60px 26px 44px' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div className="px-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '12px' }}>Px</div>
                <span style={{ fontSize: '16px', fontWeight: '700', color: C.ink }}>PraxisMD</span>
              </div>
              <div style={{ fontSize: '13px', color: C.mid, lineHeight: '1.6', maxWidth: '240px' }}>
                Patient reactivation, an AI front desk, and billing automation — all in one platform.
              </div>
            </div>
            {FOOTER_COLUMNS.map((col, i) => (
              <div key={i}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: C.ink, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '14px' }}>{col.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.links.map((link, j) => (
                    typeof link === 'object'
                      ? <Link key={j} to={link.to} className="px-footer-link" style={{ fontSize: '13px', color: C.mid, textDecoration: 'none' }}>{link.label}</Link>
                      : <span key={j} className="px-footer-link" style={{ fontSize: '13px', color: C.mid, cursor: 'pointer' }}>{link}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: C.trim, margin: '44px -26px -44px', padding: '16px 26px' }}>
          <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: withAlpha('#FFFFFF', .6) }}>© 2026 PraxisMD. All content on this page is for demonstration purposes.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: withAlpha('#FFFFFF', .75), fontWeight: '600' }}>
              <Shield size={13} color="#4ADE80" /> HIPAA Compliant · SOC 2 Type II
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
