import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { light, withAlpha } from './theme';
import { CalendarClock, MessageSquare, User, LogOut, Loader2, AlertTriangle } from 'lucide-react';

const t = light;

const cardStyle = {
  background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '22px',
};

function PatientPortal() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState('');

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

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: t.bgPage }}>
      <style>{`
        .px-btn { transition: transform .08s ease, box-shadow .15s ease; }
        .px-btn:active { transform: scale(0.97); }
        .px-action:hover { border-color: ${t.brand} !important; }
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

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ fontSize: '22px', fontWeight: '700', color: t.ink, marginBottom: '4px' }}>Hi, {firstName}</div>
        <div style={{ fontSize: '13.5px', color: t.muted, marginBottom: '26px' }}>Here's what's going on with your care.</div>

        {notice && (
          <div style={{ background: t.tealL, color: t.teal, border: `1px solid ${withAlpha(t.teal, .15)}`, borderRadius: '10px', padding: '10px 14px', fontSize: '12.5px', marginBottom: '18px' }}>{notice}</div>
        )}

        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <CalendarClock size={17} color={t.brand} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: t.ink2 }}>Upcoming appointment</div>
          </div>
          <div style={{ fontSize: '12.5px', color: t.muted, lineHeight: '1.6' }}>
            No upcoming appointments on file yet. Once your practice connects their calendar, you'll see your next visit here.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
          <button
            onClick={() => setNotice('Appointment requests will go straight to your practice once messaging is connected.')}
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

        <div style={cardStyle}>
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
      </div>
    </div>
  );
}

export default PatientPortal;
