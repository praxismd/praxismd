import { Link } from 'react-router-dom';
import { light, withAlpha } from './theme';
import {
  Check, X, ArrowRight, RotateCcw, Bot, ClipboardList, Receipt, Shield,
  Smile, CreditCard, Contact, Sparkles, Star,
} from 'lucide-react';

const t = light;

const PRICING = [
  {
    name: 'Starter', popular: false,
    blurb: 'For solo practices getting started with automation.',
    features: [
      'Up to 500 active patients',
      'Two-way texting & email',
      'Online booking & reminders',
      'Automated review requests',
      'Basic reporting',
    ],
  },
  {
    name: 'Growth', popular: true,
    blurb: 'The most popular plan — built to grow your patient base.',
    features: [
      'Everything in Starter',
      'Patient reactivation sequences',
      'Smart waitlist auto-fill',
      'Insurance eligibility verification',
      'NPS surveys & detractor recovery',
      'Priority support',
    ],
  },
  {
    name: 'Pro', popular: false,
    blurb: 'For multi-provider practices that want it fully automated.',
    features: [
      'Everything in Growth',
      'AI front desk — answers & books calls',
      'Billing automation + ERA auto-posting',
      'Payment plans via Stripe with auto-retry',
      'Patient portal & e-signatures',
      'Dedicated success manager',
    ],
  },
];

const COMPETITORS = ['PraxisMD', 'Weave', 'RevenueWell', 'NexHealth', 'Podium'];

const COMPARISON = [
  { feature: 'Patient reactivation sequences', wins: [true, false, false, false, false] },
  { feature: 'Billing automation & denial management', wins: [true, false, false, false, false] },
  { feature: 'AI front desk (answers & books calls)', wins: [true, false, false, false, false] },
  { feature: 'Smart waitlist auto-fill', wins: [true, false, false, false, false] },
  { feature: 'Insurance eligibility verification', wins: [true, true, false, false, false] },
  { feature: 'Two-way texting', wins: [true, true, true, true, true] },
  { feature: 'Online booking & reminders', wins: [true, true, true, true, false] },
];

const FEATURES = [
  { Icon: RotateCcw, title: 'Patient reactivation', desc: '6-month automated multi-touch sequences bring lapsed patients back — no manual follow-up.' },
  { Icon: Bot, title: 'AI front desk', desc: 'An AI receptionist that actually answers calls, triages urgency, and books appointments.' },
  { Icon: ClipboardList, title: 'Smart waitlist', desc: 'Cancelled slots auto-text the next patient in line and fill themselves in minutes.' },
  { Icon: Receipt, title: 'Billing automation', desc: 'ERA auto-posting and denial management, so claims get worked without the busywork.' },
  { Icon: Shield, title: 'Eligibility verification', desc: 'Every appointment is auto-checked against insurance before the patient walks in.' },
  { Icon: Smile, title: 'NPS & detractor recovery', desc: 'Catch unhappy patients early with automated surveys and recovery workflows.' },
  { Icon: CreditCard, title: 'Payment plans', desc: 'Stripe-powered plans with automatic retry on failed payments — no chasing balances.' },
  { Icon: Contact, title: 'Patient portal', desc: 'E-forms and document signing patients can complete from their phone, before they arrive.' },
];

function NavBar() {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: withAlpha(t.bgSidebar, .92), backdropFilter: 'blur(8px)', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '14px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px' }}>Px</div>
          <span style={{ fontSize: '18px', fontWeight: '700', color: t.ink }}>PraxisMD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', fontSize: '13.5px', fontWeight: '500', color: t.mid }}>
          <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Pricing</a>
          <a href="#compare" style={{ color: 'inherit', textDecoration: 'none' }}>Compare</a>
          <Link to="/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>View dashboard demo</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/login" style={{ color: t.mid, textDecoration: 'none', fontSize: '13.5px', fontWeight: '500', whiteSpace: 'nowrap' }}>Sign in</Link>
          <a href="#demo" className="px-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', background: t.brand, color: 'white', fontSize: '13.5px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Book a Demo
          </a>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: '11px', fontWeight: '700', color: t.brand, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', textAlign: 'center' }}>{children}</div>;
}

function Landing() {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: t.bgPage, color: t.ink2, minHeight: '100vh' }}>
      <style>{`
        .px-btn { transition: transform .08s ease, box-shadow .15s ease; }
        .px-btn:active { transform: scale(0.97); }
        .px-pcard { transition: transform .15s ease, box-shadow .15s ease; }
        .px-pcard:hover { transform: translateY(-3px); box-shadow: 0 14px 32px rgba(0,0,0,.10); }
        .px-fcard { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .px-fcard:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,.07); border-color: ${withAlpha(t.brand, .3)}; }
        @media (max-width: 900px) {
          .px-pricing-grid { grid-template-columns: 1fr !important; }
          .px-features-grid { grid-template-columns: 1fr 1fr !important; }
          .px-hero-headline { font-size: 34px !important; }
        }
        @media (max-width: 560px) {
          .px-features-grid { grid-template-columns: 1fr !important; }
          .px-compare-table { font-size: 11.5px !important; }
        }
      `}</style>

      <NavBar />

      {/* HERO */}
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '84px 26px 64px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: t.brandL, color: t.brand, fontSize: '12px', fontWeight: '600', marginBottom: '22px' }}>
          <Sparkles size={13} /> Built for dental &amp; medical practices
        </div>
        <h1 className="px-hero-headline" style={{ fontSize: '46px', fontWeight: '800', letterSpacing: '-1.2px', lineHeight: '1.12', color: t.ink, margin: '0 0 18px' }}>
          The only practice platform that brings patients <span style={{ color: t.brand }}>back</span> — and gets you <span style={{ color: t.green }}>paid</span>.
        </h1>
        <p style={{ fontSize: '17px', color: t.mid, lineHeight: '1.6', margin: '0 auto 32px', maxWidth: '620px' }}>
          PraxisMD combines patient reactivation, an AI front desk, and billing automation in one dashboard —
          so your team spends less time chasing patients and paperwork, and more time in the chair.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#demo" className="px-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 24px', borderRadius: '12px', background: t.brand, color: 'white', fontSize: '15px', fontWeight: '600', textDecoration: 'none' }}>
            Book a Demo <ArrowRight size={16} />
          </a>
          <a href="#pricing" className="px-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 24px', borderRadius: '12px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.ink2, fontSize: '15px', fontWeight: '600', textDecoration: 'none' }}>
            See pricing
          </a>
        </div>
        <div style={{ marginTop: '18px', fontSize: '12.5px', color: t.muted }}>No credit card required · Cancel anytime</div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ maxWidth: '1160px', margin: '0 auto', padding: '20px 26px 80px' }}>
        <SectionLabel>What makes PraxisMD different</SectionLabel>
        <h2 style={{ fontSize: '30px', fontWeight: '700', color: t.ink, textAlign: 'center', margin: '0 0 12px', letterSpacing: '-.5px' }}>
          Everything competitors are missing
        </h2>
        <p style={{ fontSize: '14.5px', color: t.mid, textAlign: 'center', maxWidth: '560px', margin: '0 auto 44px' }}>
          Weave, RevenueWell, and NexHealth handle messaging and scheduling. None of them bring patients back
          or automate your billing. PraxisMD does both.
        </p>
        <div className="px-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {FEATURES.map(({ Icon, title, desc }, i) => (
            <div key={i} className="px-fcard" style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '22px 20px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <Icon size={18} color={t.brand} />
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: '600', color: t.ink2, marginBottom: '6px' }}>{title}</div>
              <div style={{ fontSize: '12.5px', color: t.mid, lineHeight: '1.55' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" style={{ background: t.bgSidebar, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: '80px 26px' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <SectionLabel>Pricing</SectionLabel>
          <h2 style={{ fontSize: '30px', fontWeight: '700', color: t.ink, textAlign: 'center', margin: '0 0 12px', letterSpacing: '-.5px' }}>
            Simple plans that pay for themselves
          </h2>
          <p style={{ fontSize: '14.5px', color: t.mid, textAlign: 'center', maxWidth: '520px', margin: '0 auto 44px' }}>
            Most practices recover their subscription cost in reactivated appointments within the first month.
          </p>
          <div className="px-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', alignItems: 'start' }}>
            {PRICING.map((plan, i) => (
              <div
                key={i}
                className="px-pcard"
                style={{
                  background: t.bgCard, borderRadius: '16px', padding: '28px 24px',
                  border: plan.popular ? `2px solid ${t.brand}` : `1px solid ${t.border}`,
                  position: 'relative', boxShadow: plan.popular ? `0 12px 30px ${withAlpha(t.brand, .12)}` : 'none',
                }}
              >
                {plan.popular && (
                  <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '20px', background: t.brand, color: 'white', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                    <Star size={11} fill="white" /> MOST POPULAR
                  </div>
                )}
                <div style={{ fontSize: '15px', fontWeight: '700', color: t.ink, marginBottom: '4px' }}>{plan.name}</div>
                <div style={{ fontSize: '12.5px', color: t.mid, marginBottom: '22px', minHeight: '36px' }}>{plan.blurb}</div>
                <a
                  href={`mailto:sales@praxismd.com?subject=${encodeURIComponent(`Pricing inquiry — ${plan.name} plan`)}`}
                  className="px-btn"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%',
                    padding: '11px', borderRadius: '10px', marginBottom: '22px', textDecoration: 'none',
                    fontSize: '13.5px', fontWeight: '600',
                    background: plan.popular ? t.brand : t.bgRow,
                    color: plan.popular ? 'white' : t.ink2,
                    border: plan.popular ? 'none' : `1px solid ${t.border}`,
                  }}
                >
                  Inquire about pricing
                </a>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '13px', color: t.mid }}>
                      <Check size={15} color={t.green} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COMPARISON */}
      <div id="compare" style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 26px' }}>
        <SectionLabel>How we compare</SectionLabel>
        <h2 style={{ fontSize: '30px', fontWeight: '700', color: t.ink, textAlign: 'center', margin: '0 0 12px', letterSpacing: '-.5px' }}>
          See what the competition leaves out
        </h2>
        <p style={{ fontSize: '14.5px', color: t.mid, textAlign: 'center', maxWidth: '560px', margin: '0 auto 40px' }}>
          PraxisMD is the only platform built around getting patients back in the chair and getting claims paid —
          not just messaging.
        </p>
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '16px', overflow: 'hidden', overflowX: 'auto' }}>
          <table className="px-compare-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '560px' }}>
            <thead>
              <tr style={{ background: t.bgRow }}>
                <th style={{ textAlign: 'left', padding: '14px 18px', fontSize: '11.5px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `1px solid ${t.border}` }}>Feature</th>
                {COMPETITORS.map((c, i) => (
                  <th key={i} style={{
                    textAlign: 'center', padding: '14px 12px', fontSize: '12.5px', fontWeight: '700',
                    color: i === 0 ? t.brand : t.mid, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap',
                  }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < COMPARISON.length - 1 ? `1px solid ${t.border2}` : 'none' }}>
                  <td style={{ padding: '13px 18px', color: t.ink2, fontWeight: '500' }}>{row.feature}</td>
                  {row.wins.map((win, j) => (
                    <td key={j} style={{ textAlign: 'center', padding: '13px 12px', background: j === 0 && win ? withAlpha(t.accentGreen, .08) : 'transparent' }}>
                      {win
                        ? <Check size={16} color={t.green} style={{ display: 'inline-block' }} />
                        : <X size={16} color={t.muted} style={{ display: 'inline-block', opacity: .5 }} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div id="demo" style={{ background: `linear-gradient(120deg, ${t.brand}, ${t.teal})`, padding: '70px 26px' }}>
        <div style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: 'white', margin: '0 0 12px', letterSpacing: '-.5px' }}>
            See PraxisMD on your own schedule
          </h2>
          <p style={{ fontSize: '14.5px', color: withAlpha('#FFFFFF', .85), margin: '0 0 28px', lineHeight: '1.6' }}>
            Book a 20-minute walkthrough with our team — we'll show you exactly how much revenue reactivation
            could recover for your practice.
          </p>
          <a
            href="mailto:demo@praxismd.com?subject=Book%20a%20PraxisMD%20demo"
            className="px-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', borderRadius: '12px', background: 'white', color: t.brand, fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}
          >
            Book a Demo <ArrowRight size={16} />
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ padding: '32px 26px', textAlign: 'center', fontSize: '12px', color: t.muted }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '10px' }}>Px</div>
          <span style={{ fontWeight: '600', color: t.mid }}>PraxisMD</span>
        </div>
        © 2026 PraxisMD. All content on this page is for demonstration purposes.
      </div>
    </div>
  );
}

export default Landing;
