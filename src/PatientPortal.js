import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { light, withAlpha } from './theme';
import {
  CalendarClock, MessageSquare, User, LogOut, Loader2, AlertTriangle,
  Stethoscope, Receipt, CreditCard, Download, Info, Home,
} from 'lucide-react';

const t = light;

const cardStyle = {
  background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '22px',
  boxShadow: '0 2px 12px rgba(0,0,0,.04)',
};

// Demo clinical data for the patient-facing chart/billing views. Keyed by
// tooth number (universal numbering, 1-32) so the chart grid and the
// treatment log below it reference the same records. All fabricated —
// there's no PM-software sync wired up yet, so a real account starts empty.
const TOOTH_STATUS = {
  1: 'watch', 3: 'crown', 8: 'filling', 14: 'filling', 16: 'watch', 19: 'rootcanal', 30: 'crown',
};

const STATUS_META = {
  healthy: { label: 'Healthy', colorKey: 'border' },
  watch: { label: 'Watching', colorKey: 'teal' },
  filling: { label: 'Filling', colorKey: 'amber' },
  crown: { label: 'Crown', colorKey: 'purple' },
  rootcanal: { label: 'Root canal', colorKey: 'red' },
};

const TREATMENT_HISTORY = [
  { date: 'Mar 15, 2024', teeth: [3], procedure: 'Crown placed', provider: 'Dr. Rivera', notes: 'Porcelain crown, no complications. Follow-up in 6 months.' },
  { date: 'Nov 2, 2023', teeth: [19], procedure: 'Root canal', provider: 'Dr. Rivera', notes: '3-canal RCT completed. Crown recommended within 3 months.' },
  { date: 'Jun 20, 2023', teeth: [8, 14], procedure: 'Composite fillings', provider: 'Dr. Alvarez', notes: 'Two-surface fillings placed. Cavities caught at routine exam.' },
  { date: 'Jan 10, 2023', teeth: [1, 16], procedure: 'Cleaning + exam', provider: 'Dr. Rivera', notes: 'Routine cleaning, X-rays taken. Teeth #1 and #16 flagged for monitoring.' },
  { date: 'Jul 22, 2022', teeth: [30], procedure: 'Crown placed', provider: 'Dr. Rivera', notes: 'Crown placed after prior filling failed.' },
];

const BILLING = {
  balance: 140,
  items: [
    { date: 'Mar 15, 2024', desc: 'Crown — tooth #3', amount: 420, status: 'Paid' },
    { date: 'Mar 15, 2024', desc: 'Insurance adjustment', amount: -280, status: 'Applied' },
    { date: 'Nov 2, 2023', desc: 'Root canal — tooth #19', amount: 640, status: 'Paid' },
    { date: 'Jun 20, 2023', desc: 'Composite fillings (x2)', amount: 140, status: 'Balance due' },
    { date: 'Jan 10, 2023', desc: 'Cleaning + exam', amount: 0, status: 'Covered by insurance' },
  ],
};

const TABS = [
  { key: 'overview', label: 'Overview', Icon: Home },
  { key: 'chart', label: 'My Chart', Icon: Stethoscope },
  { key: 'billing', label: 'Billing', Icon: CreditCard },
];

function StatTile({ label, value, sub, color, icon: Icon }) {
  const accent = color || t.brand;
  return (
    <div style={{ ...cardStyle, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, .35)})` }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '10.5px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
        {Icon && <Icon size={14} color={accent} />}
      </div>
      <div style={{ fontSize: '19px', fontWeight: '700', color: color || t.ink }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: t.muted, marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

function OverviewTab({ setNotice, profile }) {
  const lastVisit = TREATMENT_HISTORY[0];
  const [showForm, setShowForm] = useState(false);
  const [reqWhen, setReqWhen] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justRequested, setJustRequested] = useState(false);

  async function submitRequest() {
    if (!reqWhen.trim()) {
      setNotice("Let us know when you'd like to come in.");
      return;
    }
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'appointmentRequests'), {
        patientUid: user.uid,
        patientName: profile?.name || user.email,
        patientPhone: profile?.phone || '',
        preferredWhen: reqWhen.trim(),
        reason: reqReason.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setNotice('Request sent! Your practice will confirm a time with you.');
      setJustRequested(true);
      setShowForm(false);
      setReqWhen('');
      setReqReason('');
    } catch (err) {
      setNotice(`Could not send request (${err.code || err.message || 'unknown error'}).`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '16px' }}>
        <StatTile label="Next appointment" value={justRequested ? 'Request pending' : 'None scheduled'} sub={justRequested ? 'Awaiting confirmation' : 'Request one below'} icon={CalendarClock} />
        <StatTile label="Balance due" value={`$${BILLING.balance}`} color={BILLING.balance > 0 ? t.amber : t.green} sub="See Billing tab" icon={Receipt} />
        <StatTile label="Last visit" value={lastVisit.date} sub={lastVisit.procedure} icon={Stethoscope} />
      </div>

      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <CalendarClock size={17} color={t.brand} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Upcoming appointment</div>
        </div>
        <div style={{ fontSize: '12.5px', color: t.muted, lineHeight: '1.6' }}>
          {justRequested
            ? "Your request has been sent — your practice will reach out to confirm a time."
            : "No upcoming appointments on file yet. Once your practice connects their calendar, you'll see your next visit here."}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: showForm ? '14px' : 0 }}>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-btn px-action"
          style={{ textAlign: 'left', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '18px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <CalendarClock size={18} color={t.brand} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2, marginBottom: '3px' }}>Request an appointment</div>
          <div style={{ fontSize: '11.5px', color: t.muted }}>Ask your practice to schedule a visit</div>
        </button>
        <button
          onClick={() => setNotice('Secure messaging with your practice is coming soon.')}
          className="px-btn px-action"
          style={{ textAlign: 'left', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '18px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <MessageSquare size={18} color={t.teal} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2, marginBottom: '3px' }}>Message your practice</div>
          <div style={{ fontSize: '11.5px', color: t.muted }}>Ask a question or share an update</div>
        </button>
      </div>

      {showForm && (
        <div className="px-expand" style={cardStyle}>
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2, marginBottom: '12px' }}>Request an appointment</div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>When works for you?</label>
            <input
              value={reqWhen} onChange={e => setReqWhen(e.target.value)} placeholder="e.g. Next Tuesday afternoon"
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>Reason for visit</label>
            <input
              value={reqReason} onChange={e => setReqReason(e.target.value)} placeholder="e.g. Routine cleaning, tooth pain..."
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={submitRequest} disabled={submitting} className="px-btn"
              style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13px', fontWeight: '600', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? .7 : 1, fontFamily: 'inherit' }}
            >{submitting ? 'Sending…' : 'Send request'}</button>
            <button
              onClick={() => setShowForm(false)} className="px-btn"
              style={{ padding: '9px 16px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.mid, fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
            >Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

function ChartTab() {
  const [selectedTooth, setSelectedTooth] = useState(null);
  const colorFor = (key) => (key === 'border' ? t.border : t[key]);
  const upper = Array.from({ length: 16 }, (_, i) => i + 1);
  const lower = Array.from({ length: 16 }, (_, i) => i + 17);

  function renderRow(nums) {
    return (
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {nums.map(n => {
          const status = TOOTH_STATUS[n] || 'healthy';
          const meta = STATUS_META[status];
          const color = colorFor(meta.colorKey);
          const isSelected = selectedTooth === n;
          return (
            <button
              key={n}
              onClick={() => setSelectedTooth(isSelected ? null : n)}
              className="px-btn px-tooth"
              title={`Tooth #${n} — ${meta.label}`}
              style={{
                width: '28px', height: '30px', borderRadius: '10px 10px 6px 6px', fontSize: '10px', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit',
                background: status === 'healthy' ? t.bgCard : withAlpha(color, .16),
                borderWidth: isSelected ? '2px' : '1.5px', borderStyle: 'solid',
                borderColor: isSelected ? color : (status === 'healthy' ? t.border : withAlpha(color, .5)),
                color: status === 'healthy' ? t.muted : color,
                boxShadow: isSelected ? `0 3px 10px ${withAlpha(color, .35)}` : 'none',
                transform: isSelected ? 'translateY(-2px)' : 'none',
              }}
            >{n}</button>
          );
        })}
      </div>
    );
  }

  const toothEntries = TREATMENT_HISTORY.filter(e => e.teeth.includes(selectedTooth));

  return (
    <>
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Stethoscope size={17} color={t.purple} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Your dental chart</div>
        </div>
        <div style={{ fontSize: '11.5px', color: t.muted, marginBottom: '18px' }}>Tap a tooth to see its treatment history.</div>

        <div style={{ background: `linear-gradient(180deg, ${t.bgRow}, transparent)`, borderRadius: '20px', padding: '18px 14px 6px', marginBottom: '14px' }}>
          <div style={{ marginBottom: '10px' }}>{renderRow(upper)}</div>
          <div style={{ height: '1px', background: t.border2, margin: '10px auto', maxWidth: '480px' }} />
          <div>{renderRow(lower)}</div>
        </div>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', paddingTop: '4px', borderTop: `1px solid ${t.border2}` }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: t.muted, marginTop: '12px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: key === 'healthy' ? t.bgCard : withAlpha(colorFor(meta.colorKey), .16), border: `1.5px solid ${key === 'healthy' ? t.border : withAlpha(colorFor(meta.colorKey), .5)}` }} />
              {meta.label}
            </div>
          ))}
        </div>

        {selectedTooth && (
          <div className="px-expand" style={{ marginTop: '16px', padding: '12px 14px', background: t.bgRow, borderRadius: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: t.ink2, marginBottom: '6px' }}>Tooth #{selectedTooth}</div>
            {toothEntries.length === 0 ? (
              <div style={{ fontSize: '12px', color: t.muted }}>No treatment on file for this tooth.</div>
            ) : toothEntries.map((e, i) => (
              <div key={i} style={{ fontSize: '12px', color: t.mid, marginBottom: i < toothEntries.length - 1 ? '6px' : 0 }}>
                <strong style={{ color: t.ink2 }}>{e.date}</strong> — {e.procedure} · {e.provider}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Info size={17} color={t.brand} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Treatment history</div>
        </div>
        {TREATMENT_HISTORY.map((e, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: i < TREATMENT_HISTORY.length - 1 ? `1px solid ${t.border2}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: t.ink2 }}>{e.procedure}</div>
              <div style={{ fontSize: '11.5px', color: t.muted, whiteSpace: 'nowrap' }}>{e.date}</div>
            </div>
            <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>
              Tooth {e.teeth.map(n => `#${n}`).join(', ')} · {e.provider}
            </div>
            <div style={{ fontSize: '12px', color: t.mid, marginTop: '5px', lineHeight: '1.5' }}>{e.notes}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function BillingTab({ setNotice }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px', marginBottom: '16px' }}>
        <StatTile label="Balance due" value={`$${BILLING.balance}`} color={BILLING.balance > 0 ? t.amber : t.green} icon={CreditCard} />
        <StatTile label="On payment plan" value="No" sub="Ask your practice to set one up" icon={Receipt} />
      </div>

      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={17} color={t.brand} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Pay your balance</div>
          </div>
        </div>
        <div style={{ fontSize: '12.5px', color: t.muted, lineHeight: '1.6', marginBottom: '14px' }}>
          Pay online with a card, or set up a payment plan with your practice.
        </div>
        <button
          onClick={() => setNotice("Online payments aren't set up yet — your practice will need to enable this.")}
          className="px-btn"
          style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Pay ${BILLING.balance} online
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Receipt size={17} color={t.purple} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Billing history</div>
        </div>
        {BILLING.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < BILLING.items.length - 1 ? `1px solid ${t.border2}` : 'none' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{it.desc}</div>
              <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{it.date} · {it.status}</div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: it.amount > 0 ? t.ink2 : t.green }}>
              {it.amount === 0 ? '$0' : it.amount > 0 ? `$${it.amount}` : `-$${Math.abs(it.amount)}`}
            </div>
          </div>
        ))}
        <button
          onClick={() => setNotice('Downloadable statements are coming soon.')}
          className="px-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', padding: '8px 14px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.mid, fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Download size={13} /> Download statement
        </button>
      </div>
    </>
  );
}

function PatientPortal() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!isFirebaseConfigured) { setAuthChecked(true); return; }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'patients', user.uid));
        setProfile(snap.exists() ? snap.data() : { email: user.email });
      } finally {
        setAuthChecked(true);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setNotice('');
  }, [tab]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/login');
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
              The patient portal needs a signed-in user. Set up your Firebase project (see <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>.env.example</code>) and sign in first.
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

  const firstName = (profile?.name || '').split(' ')[0] || 'there';
  const initials = (profile?.name || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'P';

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: t.bgPage }}>
      <style>{`
        .px-btn { transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
        .px-btn:active { transform: scale(0.97); }
        .px-action:hover { border-color: ${t.brand} !important; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,.06); }
        .px-tooth:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,.08); }
        .px-tab:hover { color: ${t.ink} !important; }
        @keyframes pxFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .px-expand { animation: pxFadeIn .15s ease; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px', borderBottom: `1px solid ${t.border}`, background: t.bgCard }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px' }}>Px</div>
          <span style={{ fontSize: '16px', fontWeight: '700', color: t.ink }}>PraxisMD <span style={{ fontWeight: '500', color: t.muted, fontSize: '12px' }}>Patient</span></span>
        </Link>
        <button onClick={handleLogout} className="px-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.mid, fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
          <LogOut size={14} /> Log out
        </button>
      </div>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{
          background: `linear-gradient(120deg, ${t.brandL}, ${t.tealL})`, border: `1px solid ${t.border2}`,
          borderRadius: '18px', padding: '20px 24px', marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '14px', background: t.brand, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '700',
            flexShrink: 0, boxShadow: `0 4px 14px ${withAlpha(t.brand, .35)}`,
          }}>{initials}</div>
          <div>
            <div style={{ fontSize: '21px', fontWeight: '700', color: t.ink, marginBottom: '2px' }}>Hi, {firstName}</div>
            <div style={{ fontSize: '13px', color: t.mid }}>Here's what's going on with your care.</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${t.border}`, marginBottom: '20px' }}>
          {TABS.map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className="px-tab"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 4px', marginRight: '24px', background: 'transparent', border: 'none',
                borderBottom: tab === tb.key ? `2px solid ${t.brand}` : '2px solid transparent',
                color: tab === tb.key ? t.ink : t.muted, fontWeight: tab === tb.key ? '600' : '500',
                fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            ><tb.Icon size={14} />{tb.label}</button>
          ))}
        </div>

        {notice && (
          <div style={{ background: t.tealL, color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}`, borderRadius: '10px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '18px' }}>{notice}</div>
        )}

        {tab === 'overview' && <OverviewTab setNotice={setNotice} profile={profile} />}
        {tab === 'chart' && <ChartTab />}
        {tab === 'billing' && <BillingTab setNotice={setNotice} />}

        {tab === 'overview' && (
          <div style={{ ...cardStyle, marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <User size={17} color={t.purple} />
              <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Your info</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[['Name', profile?.name], ['Phone', profile?.phone], ['Date of birth', profile?.dob], ['Email', profile?.email]].map(([label, val], i) => (
                <div key={i}>
                  <div style={{ fontSize: '10.5px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: t.ink2 }}>{val || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientPortal;
