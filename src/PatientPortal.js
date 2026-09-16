import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { light, withAlpha } from './theme';
import {
  CalendarClock, MessageSquare, User, LogOut, Loader2, AlertTriangle,
  Stethoscope, Receipt, CreditCard, Download, Info, Home, Shield, FileText, CheckCircle2, PenLine,
  Pill as PillIcon, Users, Plus, RotateCcw,
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

const INSURANCE = {
  payer: 'Delta Dental', plan: 'PPO Plus Premier', memberId: 'DD-2284910', group: 'GRP-4471', effective: 'Jan 1, 2026',
  coverage: [['Preventive (cleanings, exams)', '100%'], ['Basic (fillings)', '80%'], ['Major (crowns, root canals)', '50%']],
  deductible: { used: 0, total: 50 },
  annualMax: { used: 640, total: 1500 },
};

const DOCUMENTS_SEED = [
  { id: 'doc1', name: 'New patient health history', signed: true, date: 'Aug 2, 2026' },
  { id: 'doc2', name: 'HIPAA consent form', signed: true, date: 'Aug 2, 2026' },
  { id: 'doc3', name: 'Financial responsibility agreement', signed: false, date: null },
  { id: 'doc4', name: 'Treatment plan consent — Crown #3', signed: false, date: null },
];

const PRESCRIPTIONS_SEED = [
  { id: 'rx1', name: 'Chlorhexidine Rinse 0.12%', dosage: 'Rinse 15mL twice daily', prescriber: 'Dr. Rivera', prescribedDate: 'Nov 2, 2023', refillsRemaining: 2, status: 'active' },
  { id: 'rx2', name: 'Ibuprofen 600mg', dosage: '1 tablet every 6 hours as needed for pain', prescriber: 'Dr. Alvarez', prescribedDate: 'Jun 20, 2023', refillsRemaining: 1, status: 'active' },
  { id: 'rx3', name: 'Amoxicillin 500mg', dosage: '1 capsule 3x daily for 7 days', prescriber: 'Dr. Rivera', prescribedDate: 'Mar 15, 2024', refillsRemaining: 0, status: 'expired' },
];

const FAMILY_SEED = [
  { id: 'f1', name: 'Alex Thompson', relation: 'Spouse', dob: 'Apr 12, 1988', lastVisit: 'Feb 3, 2026' },
  { id: 'f2', name: 'Maya Thompson', relation: 'Child', dob: 'Sep 30, 2015', lastVisit: 'Jan 20, 2026' },
];

const TABS = [
  { key: 'overview', label: 'Overview', Icon: Home },
  { key: 'chart', label: 'My Chart', Icon: Stethoscope },
  { key: 'prescriptions', label: 'Prescriptions', Icon: PillIcon },
  { key: 'insurance', label: 'Insurance', Icon: Shield },
  { key: 'documents', label: 'Documents', Icon: FileText },
  { key: 'billing', label: 'Billing', Icon: CreditCard },
  { key: 'family', label: 'Family', Icon: Users },
  { key: 'messages', label: 'Messages', Icon: MessageSquare },
];

function PortalBtn({ children, onClick, primary }) {
  return (
    <button
      onClick={onClick} className="px-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px',
        border: primary ? 'none' : `1px solid ${t.border}`, background: primary ? t.brand : t.bgCard,
        color: primary ? 'white' : t.mid, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >{children}</button>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '10.5px', fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '13px', color: t.ink2 }}>{value || '—'}</div>
    </div>
  );
}

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

function OverviewTab({ setNotice, profile, onOpenMessages }) {
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
          onClick={onOpenMessages}
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

function InsuranceTab({ setNotice }) {
  const [showForm, setShowForm] = useState(false);
  const [payer, setPayer] = useState('');
  const [memberId, setMemberId] = useState('');

  function submitUpdate() {
    if (!payer.trim()) { setNotice('Add your insurance payer to continue.'); return; }
    setNotice('Sent to your practice — they\'ll verify your new coverage before your next visit.');
    setShowForm(false);
    setPayer('');
    setMemberId('');
  }

  return (
    <>
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Shield size={17} color={t.brand} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Your plan</div>
        </div>
        <div style={{ fontSize: '11.5px', color: t.muted, marginBottom: '16px' }}>{INSURANCE.payer} · {INSURANCE.plan}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
          <DetailRow label="Member ID" value={INSURANCE.memberId} />
          <DetailRow label="Group number" value={INSURANCE.group} />
          <DetailRow label="Effective date" value={INSURANCE.effective} />
        </div>

        <div style={{ fontSize: '12px', fontWeight: '600', color: t.muted, marginBottom: '10px' }}>COVERAGE BREAKDOWN</div>
        {INSURANCE.coverage.map(([label, pct], i) => (
          <div key={i} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.mid, marginBottom: '5px' }}><span>{label}</span><span style={{ fontWeight: '600', color: t.ink2 }}>{pct}</span></div>
            <div style={{ height: '4px', borderRadius: '3px', background: t.border, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', background: t.brand, width: pct }} /></div>
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '20px', paddingTop: '18px', borderTop: `1px solid ${t.border2}` }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.mid, marginBottom: '5px' }}><span>Deductible</span><span style={{ fontWeight: '600', color: t.ink2 }}>${INSURANCE.deductible.used} of ${INSURANCE.deductible.total}</span></div>
            <div style={{ height: '4px', borderRadius: '3px', background: t.border, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', background: t.teal, width: `${(INSURANCE.deductible.used / INSURANCE.deductible.total) * 100}%` }} /></div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.mid, marginBottom: '5px' }}><span>Annual max used</span><span style={{ fontWeight: '600', color: t.ink2 }}>${INSURANCE.annualMax.used} of ${INSURANCE.annualMax.total}</span></div>
            <div style={{ height: '4px', borderRadius: '3px', background: t.border, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', background: t.purple, width: `${(INSURANCE.annualMax.used / INSURANCE.annualMax.total) * 100}%` }} /></div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: t.ink2 }}>Insurance changed?</div>
          <PortalBtn onClick={() => setShowForm(s => !s)}>Update insurance</PortalBtn>
        </div>
        {showForm && (
          <div className="px-expand" style={{ marginTop: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <input value={payer} onChange={e => setPayer(e.target.value)} placeholder="New insurance payer" style={{ padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
              <input value={memberId} onChange={e => setMemberId(e.target.value)} placeholder="Member ID" style={{ padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2, boxSizing: 'border-box' }} />
            </div>
            <PortalBtn primary onClick={submitUpdate}>Send to practice</PortalBtn>
          </div>
        )}
      </div>
    </>
  );
}

function DocumentsTab({ setNotice }) {
  const [docs, setDocs] = useState(DOCUMENTS_SEED);
  const [signing, setSigning] = useState(null);

  function sign(id) {
    setDocs(ds => ds.map(d => d.id === id ? { ...d, signed: true, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } : d));
    setSigning(null);
  }

  const pending = docs.filter(d => !d.signed);
  const signed = docs.filter(d => d.signed);

  return (
    <>
      {pending.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <AlertTriangle size={17} color={t.amber} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Needs your signature</div>
          </div>
          <div style={{ fontSize: '11.5px', color: t.muted, marginBottom: '14px' }}>Please review and sign before your next visit.</div>
          {pending.map(d => (
            <div key={d.id} style={{ padding: '12px 14px', background: t.amberL, borderRadius: '10px', marginBottom: '8px', border: `1px solid ${withAlpha(t.accentAmber, .2)}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{d.name}</div>
                <PortalBtn primary onClick={() => setSigning(signing === d.id ? null : d.id)}><PenLine size={13} /> {signing === d.id ? 'Cancel' : 'Sign now'}</PortalBtn>
              </div>
              {signing === d.id && (
                <div className="px-expand" style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${withAlpha(t.accentAmber, .2)}` }}>
                  <div style={{ fontSize: '12px', color: t.mid, marginBottom: '10px', lineHeight: '1.6' }}>
                    By signing below, you confirm you've read and agree to this form.
                  </div>
                  <PortalBtn primary onClick={() => sign(d.id)}><CheckCircle2 size={13} /> I agree — sign document</PortalBtn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <FileText size={17} color={t.purple} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Your documents</div>
        </div>
        {signed.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${t.border2}` }}>
            <div style={{ fontSize: '13px', color: t.ink2 }}>{d.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: t.green }}><CheckCircle2 size={13} /> Signed {d.date}</div>
          </div>
        ))}
        {signed.length === 0 && <div style={{ fontSize: '12.5px', color: t.muted, textAlign: 'center', padding: '10px' }}>No signed documents yet.</div>}
        <button
          onClick={() => setNotice('Downloadable copies of your records are coming soon.')}
          className="px-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', padding: '8px 14px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.mid, fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Download size={13} /> Download my records
        </button>
      </div>
    </>
  );
}

function PrescriptionsTab() {
  const [prescriptions, setPrescriptions] = useState(PRESCRIPTIONS_SEED);
  const [requested, setRequested] = useState({});

  function requestRefill(id) {
    setRequested(r => ({ ...r, [id]: true }));
    setPrescriptions(ps => ps.map(p => p.id === id ? { ...p, refillsRemaining: Math.max(0, p.refillsRemaining - 1) } : p));
  }

  const active = prescriptions.filter(p => p.status === 'active');
  const expired = prescriptions.filter(p => p.status === 'expired');

  return (
    <>
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <PillIcon size={17} color={t.teal} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Active prescriptions</div>
        </div>
        <div style={{ fontSize: '11.5px', color: t.muted, marginBottom: '14px' }}>Request a refill and your practice will review it before it's sent to your pharmacy.</div>
        {active.map(rx => (
          <div key={rx.id} style={{ padding: '13px 14px', background: t.bgRow, borderRadius: '10px', marginBottom: '8px', border: `1px solid ${t.border2}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: t.ink2 }}>{rx.name}</div>
                <div style={{ fontSize: '11.5px', color: t.muted, marginTop: '2px' }}>{rx.dosage}</div>
                <div style={{ fontSize: '11px', color: t.muted, marginTop: '4px' }}>Prescribed by {rx.prescriber} · {rx.prescribedDate}</div>
              </div>
              {requested[rx.id] ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: t.teal, whiteSpace: 'nowrap', flexShrink: 0 }}><CheckCircle2 size={13} /> Requested</div>
              ) : rx.refillsRemaining > 0 ? (
                <PortalBtn onClick={() => requestRefill(rx.id)}><RotateCcw size={13} /> Request refill</PortalBtn>
              ) : (
                <div style={{ fontSize: '11.5px', color: t.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>No refills left</div>
              )}
            </div>
            <div style={{ fontSize: '11px', color: t.muted, marginTop: '8px' }}>{rx.refillsRemaining} refill{rx.refillsRemaining === 1 ? '' : 's'} remaining</div>
          </div>
        ))}
        {active.length === 0 && <div style={{ fontSize: '12.5px', color: t.muted, textAlign: 'center', padding: '10px' }}>No active prescriptions on file.</div>}
      </div>

      {expired.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <FileText size={17} color={t.muted} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Past prescriptions</div>
          </div>
          {expired.map(rx => (
            <div key={rx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${t.border2}` }}>
              <div>
                <div style={{ fontSize: '13px', color: t.ink2 }}>{rx.name}</div>
                <div style={{ fontSize: '11px', color: t.muted, marginTop: '2px' }}>{rx.dosage}</div>
              </div>
              <div style={{ fontSize: '11.5px', color: t.muted }}>{rx.prescribedDate}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FamilyTab({ setNotice }) {
  const [family, setFamily] = useState(FAMILY_SEED);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', relation: 'Child', dob: '' });

  function addMember() {
    if (!form.name.trim() || !form.dob.trim()) {
      setNotice('Add a name and date of birth to continue.');
      return;
    }
    setFamily(f => [...f, { id: `f-new-${Date.now()}`, name: form.name.trim(), relation: form.relation, dob: form.dob.trim(), lastVisit: null }]);
    setForm({ name: '', relation: 'Child', dob: '' });
    setShowForm(false);
  }

  const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, boxSizing: 'border-box' };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={17} color={t.brand} />
          <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Family on this account</div>
        </div>
        <PortalBtn onClick={() => setShowForm(s => !s)}><Plus size={13} /> {showForm ? 'Cancel' : 'Add family member'}</PortalBtn>
      </div>
      <div style={{ fontSize: '11.5px', color: t.muted, marginBottom: '14px' }}>Manage appointments and records for dependents linked to your account.</div>

      {showForm && (
        <div className="px-expand" style={{ padding: '14px', background: t.bgRow, borderRadius: '10px', marginBottom: '14px', border: `1px solid ${t.border2}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" style={inputStyle} />
            <select value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} style={inputStyle}>
              {['Spouse', 'Child', 'Parent', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} placeholder="Date of birth" style={inputStyle} />
          </div>
          <PortalBtn primary onClick={addMember}>Add to account</PortalBtn>
        </div>
      )}

      {family.map(m => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${t.border2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: t.brandL, color: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>
              {m.name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: t.ink2 }}>{m.name}</div>
              <div style={{ fontSize: '11.5px', color: t.muted }}>{m.relation} · Born {m.dob}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11.5px', color: t.muted }}>{m.lastVisit ? `Last visit ${m.lastVisit}` : 'No visits yet'}</div>
            <button
              onClick={() => setNotice('Viewing a dependent\'s chart from your account is coming soon.')}
              className="px-btn"
              style={{ marginTop: '4px', padding: '4px 10px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.mid, fontSize: '11.5px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
            >View chart</button>
          </div>
        </div>
      ))}
      {family.length === 0 && <div style={{ fontSize: '12.5px', color: t.muted, textAlign: 'center', padding: '10px' }}>No family members added yet.</div>}
    </div>
  );
}

function formatMsgTime(ts) {
  if (!ts?.toDate) return 'Sending…';
  return ts.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function MessagesTab({ profile }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    const q = query(collection(db, 'patientMessages'), where('patientUid', '==', user.uid), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { setError(err.message); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'patientMessages'), {
        patientUid: user.uid,
        patientName: profile?.name || user.email,
        sender: 'patient',
        text: draft.trim(),
        createdAt: serverTimestamp(),
        read: false,
      });
      setDraft('');
    } catch (err) {
      setError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <MessageSquare size={17} color={t.teal} />
        <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Messages with your practice</div>
      </div>

      {error && (
        <div style={{ background: t.redL, color: t.red, border: `1px solid ${withAlpha(t.red, .2)}`, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '12px' }}>{error}</div>
      )}

      <div style={{ height: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: t.bgRow, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
        {loading ? (
          <div style={{ margin: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: t.muted, fontSize: '12.5px' }}><Loader2 size={16} className="px-spin" /> Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ margin: 'auto', color: t.muted, fontSize: '12.5px', textAlign: 'center', maxWidth: '240px' }}>No messages yet — send one below to start the conversation with your practice.</div>
        ) : messages.map(m => (
          <div key={m.id} style={{ alignSelf: m.sender === 'patient' ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
            <div style={{
              padding: '9px 13px', borderRadius: '14px', fontSize: '13px', lineHeight: '1.5',
              background: m.sender === 'patient' ? t.brand : t.bgCard, color: m.sender === 'patient' ? 'white' : t.ink2,
              border: m.sender === 'patient' ? 'none' : `1px solid ${t.border}`,
            }}>{m.text}</div>
            <div style={{ fontSize: '10px', color: t.muted, marginTop: '3px', textAlign: m.sender === 'patient' ? 'right' : 'left' }}>
              {m.sender === 'patient' ? 'You' : 'Your practice'} · {formatMsgTime(m.createdAt)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="Type a message…"
          style={{ flex: 1, padding: '10px 14px', border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: t.bgCard, color: t.ink2, boxSizing: 'border-box' }}
        />
        <button
          onClick={send} disabled={sending} className="px-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13px', fontWeight: '600', cursor: sending ? 'default' : 'pointer', opacity: sending ? .7 : 1, fontFamily: 'inherit' }}
        >{sending ? <Loader2 size={14} className="px-spin" /> : <MessageSquare size={14} />} Send</button>
      </div>
    </div>
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

        {tab === 'overview' && <OverviewTab setNotice={setNotice} profile={profile} onOpenMessages={() => setTab('messages')} />}
        {tab === 'chart' && <ChartTab />}
        {tab === 'prescriptions' && <PrescriptionsTab />}
        {tab === 'insurance' && <InsuranceTab setNotice={setNotice} />}
        {tab === 'documents' && <DocumentsTab setNotice={setNotice} />}
        {tab === 'billing' && <BillingTab setNotice={setNotice} />}
        {tab === 'family' && <FamilyTab setNotice={setNotice} />}
        {tab === 'messages' && <MessagesTab profile={profile} />}

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
