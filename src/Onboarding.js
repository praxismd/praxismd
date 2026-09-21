import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { light, withAlpha } from './theme';
import {
  Building2, Plug, Phone, PartyPopper, Check, ArrowLeft, ArrowRight,
  Loader2, AlertTriangle, CheckCircle2,
} from './icons';

const t = light;

const STEPS = [
  { key: 'practice', label: 'Practice', Icon: Building2 },
  { key: 'software', label: 'Software', Icon: Plug },
  { key: 'phone', label: 'Phone', Icon: Phone },
  { key: 'done', label: 'Done', Icon: PartyPopper },
];

const PM_INSTRUCTIONS = {
  Dentrix: [
    'Open Dentrix and go to the Office Manager.',
    'Navigate to Maintenance → Practice Setup → Data Exchange.',
    'Enable "Allow third-party integration" and generate an API key.',
    "Paste that key into PraxisMD's integration settings below.",
    'Confirm the connection status shows "Connected."',
  ],
  Eaglesoft: [
    'Open Eaglesoft and go to File → Practice Setup.',
    'Under Electronic Services, enable the Eaglesoft API bridge.',
    'Copy your Practice ID and Access Token.',
    'Paste them into PraxisMD under the integration settings below.',
    'Run a test sync to confirm data is flowing.',
  ],
  'Open Dental': [
    'In Open Dental, go to Setup → Program Links → API.',
    'Enable the REST API and generate a new API key.',
    "Whitelist PraxisMD's IP range under Setup → Advanced → Security.",
    'Enter your API key into PraxisMD under the integration settings below.',
    'Click "Test Connection" to verify.',
  ],
};

const PM_OPTIONS = Object.keys(PM_INSTRUCTIONS);

const inputStyle = {
  width: '100%', padding: '10px 12px', border: `1px solid ${t.border}`, borderRadius: '10px',
  fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2,
  boxSizing: 'border-box',
};

function Field({ label, htmlFor, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label htmlFor={htmlFor} style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>{label}</label>
      {children}
    </div>
  );
}

function ProgressBar({ step }) {
  const pct = (step / STEPS.length) * 100;
  return (
    <nav aria-label={`Onboarding progress: step ${step} of ${STEPS.length}, ${STEPS[step - 1].label}`} style={{ marginBottom: '24px' }}>
      <div style={{ height: '5px', borderRadius: '3px', background: t.border, overflow: 'hidden', marginBottom: '18px' }}>
        <div style={{ height: '100%', borderRadius: '3px', background: t.brand, width: `${pct}%`, transition: 'width .25s ease' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }} aria-hidden="true">
        {STEPS.map((s, i) => {
          const idx = i + 1;
          const complete = idx < step;
          const current = idx === step;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: complete ? t.brand : current ? t.brandL : t.bgRow,
                  border: current ? `2px solid ${t.brand}` : `1px solid ${t.border}`,
                  color: complete ? 'white' : current ? t.brand : t.muted, flexShrink: 0,
                }}>
                  {complete ? <Check size={14} /> : <s.Icon size={13} />}
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: current ? '600' : '500', color: current || complete ? t.ink2 : t.muted, whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: '2px', background: complete ? t.brand : t.border, margin: '0 8px', marginBottom: '18px' }} />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function StepShell({ title, subtitle, children }) {
  return (
    <div>
      <div style={{ fontSize: '19px', fontWeight: '700', color: t.ink, marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: t.muted, marginBottom: '22px' }}>{subtitle}</div>
      {children}
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [practiceName, setPracticeName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [npi, setNpi] = useState('');

  const [pmSoftware, setPmSoftware] = useState(PM_OPTIONS[0]);
  const [pmConnected, setPmConnected] = useState(false);

  const [openPhoneNumber, setOpenPhoneNumber] = useState('');
  const [phoneConnected, setPhoneConnected] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) { setAuthChecked(true); return; }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      setUid(user.uid);
      try {
        const snap = await getDoc(doc(db, 'practices', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setPracticeName(data.practiceName || '');
          setAddress(data.address || '');
          setPhone(data.phone || '');
          setNpi(data.npi || '');
          if (data.pmSoftware && PM_OPTIONS.includes(data.pmSoftware)) setPmSoftware(data.pmSoftware);
          setPmConnected(Boolean(data.pmConnected));
          setOpenPhoneNumber(data.openPhoneNumber || '');
          setPhoneConnected(Boolean(data.phoneConnected));
          if (data.onboardingComplete) {
            navigate('/dashboard');
            return;
          }
        }
      } finally {
        setLoadingDoc(false);
        setAuthChecked(true);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveStep(fields) {
    setError('');
    setSaving(true);
    try {
      await setDoc(doc(db, 'practices', uid), fields, { merge: true });
      return true;
    } catch (err) {
      setError('Could not save — check your connection and try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleStep1Next() {
    if (!practiceName.trim() || !address.trim() || !phone.trim()) {
      setError('Practice name, address, and phone are required.');
      return;
    }
    const ok = await saveStep({ practiceName, address, phone, npi });
    if (ok) setStep(2);
  }

  async function handleStep2Next() {
    const ok = await saveStep({ pmSoftware, pmConnected: true });
    if (ok) { setPmConnected(true); setStep(3); }
  }

  async function handleStep3Next() {
    if (!openPhoneNumber.trim()) {
      setError('Enter your OpenPhone number to continue.');
      return;
    }
    const ok = await saveStep({ openPhoneNumber, phoneConnected: true });
    if (ok) { setPhoneConnected(true); setStep(4); }
  }

  async function handleFinish() {
    const ok = await saveStep({ onboardingComplete: true, completedAt: serverTimestamp() });
    if (ok) navigate('/dashboard');
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
              Onboarding needs a signed-in user. Set up your Firebase project (see <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>.env.example</code>) and sign in first.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!authChecked || loadingDoc) {
    return (
      <div role="status" aria-label="Loading" style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: t.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={22} color={t.brand} className="px-spin" />
        <style>{`@keyframes pxSpin { to { transform: rotate(360deg); } } .px-spin { animation: pxSpin .7s linear infinite; }`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: t.bgPage, padding: '48px 20px' }}>
      <style>{`
        .px-btn { transition: transform .08s ease, box-shadow .15s ease; }
        .px-btn:active { transform: scale(0.97); }
        input:focus, select:focus { outline: 2px solid ${withAlpha(t.teal, .35)}; }
        a:focus-visible, button:focus-visible, [tabindex]:focus-visible,
        input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid ${t.brand};
          outline-offset: 2px;
        }
        @keyframes pxSpin { to { transform: rotate(360deg); } }
        .px-spin { animation: pxSpin .6s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <main style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', marginBottom: '28px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px' }}>Px</div>
          <span style={{ fontSize: '19px', fontWeight: '700', color: t.ink }}>PraxisMD</span>
        </div>

        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,.06)' }}>
          <ProgressBar step={step} />

          {error && (
            <div role="alert" style={{ background: t.redL, color: t.red, border: `1px solid ${withAlpha(t.accentRed, .2)}`, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '18px' }}>{error}</div>
          )}

          {step === 1 && (
            <StepShell title="Tell us about your practice" subtitle="We'll use this on patient-facing messages, forms, and claims.">
              <Field label="Practice name" htmlFor="ob-practice-name">
                <input id="ob-practice-name" required value={practiceName} onChange={e => setPracticeName(e.target.value)} placeholder="Bright Smiles Dental" style={inputStyle} />
              </Field>
              <Field label="Address" htmlFor="ob-address">
                <input id="ob-address" required value={address} onChange={e => setAddress(e.target.value)} placeholder="4210 W Bay Ave, Tampa FL 33616" style={inputStyle} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Phone number" htmlFor="ob-phone">
                  <input id="ob-phone" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="(813) 555-0142" style={inputStyle} />
                </Field>
                <Field label="NPI number" htmlFor="ob-npi">
                  <input id="ob-npi" value={npi} onChange={e => setNpi(e.target.value)} placeholder="1234567890" style={inputStyle} />
                </Field>
              </div>
              <button type="button" onClick={handleStep1Next} disabled={saving} className="px-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13.5px', fontWeight: '600', cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1, marginTop: '6px' }}>
                {saving ? <Loader2 size={14} className="px-spin" /> : <>Continue <ArrowRight size={14} /></>}
              </button>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Connect your practice management software" subtitle="Select what you use, then follow the steps to connect it.">
              <Field label="Practice management software" htmlFor="ob-pm-software">
                <select id="ob-pm-software" value={pmSoftware} onChange={e => setPmSoftware(e.target.value)} style={inputStyle}>
                  {PM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </Field>
              <div style={{ background: t.bgRow, border: `1px solid ${t.border2}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: t.ink2, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>How to connect {pmSoftware}</div>
                <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {PM_INSTRUCTIONS[pmSoftware].map((line, i) => (
                    <li key={i} style={{ fontSize: '12.5px', color: t.mid, lineHeight: '1.5' }}>{line}</li>
                  ))}
                </ol>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setStep(1)} className="px-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 16px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.ink2, fontSize: '13.5px', fontWeight: '500', cursor: 'pointer' }}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button type="button" onClick={handleStep2Next} disabled={saving} className="px-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13.5px', fontWeight: '600', cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1 }}>
                  {saving ? <Loader2 size={14} className="px-spin" /> : <>I've connected {pmSoftware} <ArrowRight size={14} /></>}
                </button>
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="Set up your phone number" subtitle="PraxisMD routes calls and texts through your OpenPhone number.">
              <Field label="OpenPhone number" htmlFor="ob-openphone">
                <input id="ob-openphone" required value={openPhoneNumber} onChange={e => setOpenPhoneNumber(e.target.value)} placeholder="(813) 555-0199" style={inputStyle} />
              </Field>
              <div style={{ fontSize: '12.5px', color: t.muted, marginBottom: '20px', lineHeight: '1.5' }}>
                Don't have an OpenPhone number yet? Create one at openphone.com, then paste it here — PraxisMD will use it for AI front desk calls, reminders, and two-way texting.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setStep(2)} className="px-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 16px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.ink2, fontSize: '13.5px', fontWeight: '500', cursor: 'pointer' }}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button type="button" onClick={handleStep3Next} disabled={saving} className="px-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13.5px', fontWeight: '600', cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1 }}>
                  {saving ? <Loader2 size={14} className="px-spin" /> : <>Continue <ArrowRight size={14} /></>}
                </button>
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="You're all set!" subtitle="Here's what we've configured for your practice.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '12px 14px', background: t.greenL, border: `1px solid ${withAlpha(t.accentGreen, .15)}`, borderRadius: '10px' }}>
                  <CheckCircle2 size={17} color={t.green} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Practice details saved</div>
                    <div style={{ fontSize: '11.5px', color: t.muted }}>{practiceName} · {phone}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '12px 14px', background: t.greenL, border: `1px solid ${withAlpha(t.accentGreen, .15)}`, borderRadius: '10px' }}>
                  <CheckCircle2 size={17} color={t.green} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{pmSoftware} connected</div>
                    <div style={{ fontSize: '11.5px', color: t.muted }}>{pmConnected ? 'Practice management sync is active' : 'Pending'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '12px 14px', background: t.greenL, border: `1px solid ${withAlpha(t.accentGreen, .15)}`, borderRadius: '10px' }}>
                  <CheckCircle2 size={17} color={t.green} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>Phone number connected</div>
                    <div style={{ fontSize: '11.5px', color: t.muted }}>{phoneConnected ? openPhoneNumber : 'Pending'}</div>
                  </div>
                </div>
              </div>
              <button type="button" onClick={handleFinish} disabled={saving} className="px-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '12px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '14px', fontWeight: '600', cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1 }}>
                {saving ? <Loader2 size={14} className="px-spin" /> : <>Go to dashboard <ArrowRight size={14} /></>}
              </button>
            </StepShell>
          )}
        </div>
      </main>
    </div>
  );
}

export default Onboarding;
