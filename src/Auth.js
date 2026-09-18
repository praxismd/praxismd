import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from './firebase';
import { light, withAlpha } from './theme';
import { ArrowLeft, Eye, EyeOff, Loader2, AlertTriangle, ShieldCheck } from './icons';

const t = light;

const PM_SOFTWARE_OPTIONS = ['Dentrix', 'Eaglesoft', 'Open Dental', 'Other'];

function friendlyError(code) {
  const map = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account already exists with that email.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/network-request-failed': 'Network error — check your connection and try again.',
  };
  return map[code] || `Something went wrong${code ? ` (${code})` : ''}. Please try again.`;
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24 c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571 c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24 C44,22.659,43.862,21.35,43.611,20.083z" />
    </svg>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '12px', fontWeight: '500', color: t.mid, marginBottom: '5px', display: 'block' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', border: `1px solid ${t.border}`, borderRadius: '10px',
  fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', background: t.bgRow, color: t.ink2,
  boxSizing: 'border-box',
};

function Auth() {
  const navigate = useNavigate();
  const [role, setRole] = useState('staff'); // 'staff' | 'patient'
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pmSoftware, setPmSoftware] = useState(PM_SOFTWARE_OPTIONS[0]);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientDob, setPatientDob] = useState('');

  const [needs2FA, setNeeds2FA] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCodeValue, setBackupCodeValue] = useState('');
  const [twoFAError, setTwoFAError] = useState('');

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
              Sign-in needs a Firebase project. Copy <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>.env.example</code> to{' '}
              <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>.env.local</code>, fill in your project's keys from the Firebase console, then restart <code style={{ background: t.bgRow, padding: '1px 5px', borderRadius: '4px' }}>npm start</code>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setInfo('');
  }

  function switchRole(next) {
    setRole(next);
    setMode('login');
    setError('');
    setInfo('');
  }

  // Returns true when a new practice doc was created (i.e. this is the
  // person's first login), so the caller can route them to onboarding.
  async function ensurePracticeDoc(user, extra = {}) {
    const ref = doc(db, 'practices', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerEmail: user.email,
        ownerName: extra.ownerName || '',
        practiceName: extra.practiceName || '',
        phone: extra.phone || '',
        address: extra.address || '',
        pmSoftware: extra.pmSoftware || '',
        onboardingComplete: false,
        createdAt: serverTimestamp(),
      });
      return true;
    }
    return false;
  }

  async function ensurePatientDoc(user, extra = {}) {
    const ref = doc(db, 'patients', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: user.email,
        name: extra.name || '',
        phone: extra.phone || '',
        dob: extra.dob || '',
        createdAt: serverTimestamp(),
      });
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (role === 'patient') {
        navigate('/patient');
        return;
      }
      const snap = await getDoc(doc(db, 'practices', cred.user.uid));
      const onboardingComplete = snap.exists() && snap.data().onboardingComplete;
      const target = onboardingComplete ? '/dashboard' : '/onboarding';
      if (window.localStorage.getItem('praxismd-2fa-enabled') === 'on') {
        setPendingNavTarget(target);
        setNeeds2FA(true);
        return;
      }
      navigate(target);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  function verify2FA(e) {
    e.preventDefault();
    setTwoFAError('');
    if (useBackupCode) {
      if (!backupCodeValue.trim()) { setTwoFAError('Enter one of your backup codes.'); return; }
    } else if (twoFACode.trim().length !== 6) {
      setTwoFAError('Enter the 6-digit code.');
      return;
    }
    navigate(pendingNavTarget || '/dashboard');
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (role === 'patient') {
      if (!patientName.trim()) {
        setError('Full name is required.');
        return;
      }
    } else if (!ownerName.trim()) {
      setError('Your name is required.');
      return;
    } else if (!practiceName.trim()) {
      setError('Practice name is required.');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (role === 'patient') {
        await ensurePatientDoc(cred.user, { name: patientName, phone: patientPhone, dob: patientDob });
        navigate('/patient');
      } else {
        await ensurePracticeDoc(cred.user, { ownerName, practiceName, phone, address, pmSoftware });
        navigate('/onboarding');
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isNew = await ensurePracticeDoc(cred.user, { ownerName: cred.user.displayName || '' });
      navigate(isNew ? '/onboarding' : '/dashboard');
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo('Check your email for a link to reset your password.');
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  const cardWidth = mode === 'signup' ? '480px' : '400px';

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: t.bgPage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <style>{`
        .px-btn { transition: transform .08s ease, box-shadow .15s ease; }
        .px-btn:active { transform: scale(0.97); }
        .px-authlink { color: ${t.brand}; text-decoration: none; font-weight: 500; }
        .px-authlink:hover { text-decoration: underline; }
        input:focus, select:focus { outline: 2px solid ${withAlpha(t.teal, .35)}; }
        @keyframes pxSpin { to { transform: rotate(360deg); } }
        .px-spin { animation: pxSpin .6s linear infinite; }
      `}</style>

      <div style={{ width: '100%', maxWidth: cardWidth, transition: 'max-width .15s ease' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', textDecoration: 'none', marginBottom: '26px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: t.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px' }}>Px</div>
          <span style={{ fontSize: '19px', fontWeight: '700', color: t.ink }}>PraxisMD</span>
        </Link>

        {needs2FA ? (
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '30px 30px 26px', boxShadow: '0 10px 30px rgba(0,0,0,.06)', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: t.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ShieldCheck size={22} color={t.brand} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: t.ink, marginBottom: '6px' }}>Two-factor verification</div>
            <div style={{ fontSize: '13px', color: t.muted, marginBottom: '22px', textAlign: 'center' }}>
              {useBackupCode ? 'Enter one of your 8-character backup codes.' : 'Enter the 6-digit code from your authenticator app or text message.'}
            </div>

            {twoFAError && (
              <div style={{ background: t.redL, color: t.red, border: `1px solid ${withAlpha(t.accentRed, .2)}`, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '16px', textAlign: 'left' }}>{twoFAError}</div>
            )}

            <form onSubmit={verify2FA}>
              {useBackupCode ? (
                <input
                  value={backupCodeValue}
                  onChange={e => setBackupCodeValue(e.target.value)}
                  placeholder="XXXX-XXXX"
                  style={{ ...inputStyle, textAlign: 'center', fontSize: '16px', fontFamily: 'monospace', marginBottom: '18px' }}
                />
              ) : (
                <input
                  value={twoFACode}
                  onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  style={{ ...inputStyle, textAlign: 'center', fontSize: '22px', letterSpacing: '8px', fontFamily: 'monospace', marginBottom: '18px' }}
                />
              )}
              <button type="submit" className="px-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', marginBottom: '14px' }}>
                Verify
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setUseBackupCode(v => !v); setTwoFAError(''); setTwoFACode(''); setBackupCodeValue(''); }}
              className="px-authlink"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px' }}
            >
              {useBackupCode ? 'Use verification code instead' : 'Use backup code'}
            </button>
          </div>
        ) : (
        <>
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '30px 30px 26px', boxShadow: '0 10px 30px rgba(0,0,0,.06)' }}>
          {mode === 'forgot' && (
            <button onClick={() => switchMode('login')} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: t.mid, fontSize: '12.5px', cursor: 'pointer', padding: 0, marginBottom: '14px' }}>
              <ArrowLeft size={13} /> Back to sign in
            </button>
          )}

          {mode !== 'forgot' && (
            <div style={{ display: 'flex', background: t.bgRow, borderRadius: '12px', padding: '4px', marginBottom: '20px', border: `1px solid ${t.border2}` }}>
              {[['staff', 'Employee / Doctor'], ['patient', 'Patient']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchRole(key)}
                  className="px-btn"
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: '9px', border: 'none',
                    background: role === key ? t.bgCard : 'transparent',
                    color: role === key ? t.ink2 : t.muted,
                    fontWeight: role === key ? '600' : '500', fontSize: '12.5px', cursor: 'pointer',
                    boxShadow: role === key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                  }}
                >{label}</button>
              ))}
            </div>
          )}

          <div style={{ fontSize: '20px', fontWeight: '700', color: t.ink, marginBottom: '4px' }}>
            {mode === 'login' && 'Welcome back'}
            {mode === 'signup' && role === 'staff' && 'Set up your practice'}
            {mode === 'signup' && role === 'patient' && 'Create your patient account'}
            {mode === 'forgot' && 'Reset your password'}
          </div>
          <div style={{ fontSize: '13px', color: t.muted, marginBottom: '22px' }}>
            {mode === 'login' && role === 'staff' && 'Sign in to your PraxisMD dashboard'}
            {mode === 'login' && role === 'patient' && 'Sign in to your patient account'}
            {mode === 'signup' && role === 'staff' && 'Create your account to get started'}
            {mode === 'signup' && role === 'patient' && 'Manage appointments and messages with your practice'}
            {mode === 'forgot' && "We'll email you a link to reset it"}
          </div>

          {error && (
            <div style={{ background: t.redL, color: t.red, border: `1px solid ${withAlpha(t.accentRed, .2)}`, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>
          )}
          {info && (
            <div style={{ background: t.greenL, color: t.green, border: `1px solid ${withAlpha(t.accentGreen, .2)}`, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '16px' }}>{info}</div>
          )}

          {mode === 'forgot' ? (
            <form onSubmit={handleForgotPassword}>
              <Field label="Email">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@practice.com" style={inputStyle} />
              </Field>
              <button type="submit" disabled={loading} className="px-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13.5px', fontWeight: '600', cursor: loading ? 'default' : 'pointer', opacity: loading ? .7 : 1, marginTop: '4px' }}>
                {loading && <Loader2 size={14} className="px-spin" />} Send reset link
              </button>
            </form>
          ) : (
            <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
              {mode === 'signup' && role === 'staff' && (
                <Field label="Your name">
                  <input required value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Dr. Rivera" style={inputStyle} />
                </Field>
              )}

              {mode === 'signup' && role === 'staff' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Field label="Practice name">
                    <input required value={practiceName} onChange={e => setPracticeName(e.target.value)} placeholder="Bright Smiles Dental" style={inputStyle} />
                  </Field>
                  <Field label="Phone number">
                    <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="(813) 555-0142" style={inputStyle} />
                  </Field>
                </div>
              )}

              {mode === 'signup' && role === 'staff' && (
                <Field label="Practice address">
                  <input required value={address} onChange={e => setAddress(e.target.value)} placeholder="4210 W Bay Ave, Tampa FL 33616" style={inputStyle} />
                </Field>
              )}

              {mode === 'signup' && role === 'staff' && (
                <Field label="Practice management software">
                  <select value={pmSoftware} onChange={e => setPmSoftware(e.target.value)} style={inputStyle}>
                    {PM_SOFTWARE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </Field>
              )}

              {mode === 'signup' && role === 'patient' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Field label="Full name">
                    <input required value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Jordan Ellis" style={inputStyle} />
                  </Field>
                  <Field label="Phone number">
                    <input required value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="(813) 555-0142" style={inputStyle} />
                  </Field>
                </div>
              )}

              {mode === 'signup' && role === 'patient' && (
                <Field label="Date of birth">
                  <input type="date" required value={patientDob} onChange={e => setPatientDob(e.target.value)} style={inputStyle} />
                </Field>
              )}

              <Field label="Email">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@practice.com" style={inputStyle} />
              </Field>

              <div style={{ display: mode === 'signup' ? 'grid' : 'block', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Password">
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, paddingRight: '38px' }} />
                    <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.muted, cursor: 'pointer', display: 'flex' }}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
                {mode === 'signup' && (
                  <Field label="Confirm password">
                    <input type={showPassword ? 'text' : 'password'} required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
                  </Field>
                )}
              </div>

              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginBottom: '18px', marginTop: '-6px' }}>
                  <button type="button" onClick={() => switchMode('forgot')} className="px-authlink" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', padding: 0 }}>Forgot password?</button>
                </div>
              )}

              <button type="submit" disabled={loading} className="px-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', border: 'none', background: t.brand, color: 'white', fontSize: '13.5px', fontWeight: '600', cursor: loading ? 'default' : 'pointer', opacity: loading ? .7 : 1, marginTop: mode === 'signup' ? '4px' : '0' }}>
                {loading && <Loader2 size={14} className="px-spin" />} {mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          )}

          {mode !== 'forgot' && role === 'staff' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0' }}>
                <div style={{ flex: 1, height: '1px', background: t.border }} />
                <span style={{ fontSize: '11.5px', color: t.muted }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: t.border }} />
              </div>
              <button onClick={handleGoogleSignIn} disabled={loading} className="px-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.bgCard, color: t.ink2, fontSize: '13.5px', fontWeight: '500', cursor: loading ? 'default' : 'pointer', opacity: loading ? .7 : 1 }}>
                <GoogleIcon /> Continue with Google
              </button>
            </>
          )}
        </div>

        {mode !== 'forgot' && (
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: t.mid }}>
            {mode === 'login' ? (
              <>Don't have an account? <button onClick={() => switchMode('signup')} className="px-authlink" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => switchMode('login')} className="px-authlink" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Sign in</button></>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}

export default Auth;
