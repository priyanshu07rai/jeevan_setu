import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle2, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register, verifyOtp, otpPending, loginAdmin, loginVolunteer } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('Citizen'); // 'Citizen' | 'Admin' | 'Volunteer'
  const [mode, setMode] = useState('login');   // 'login' | 'register'
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (otpPending) {
        // Step 3: Verify OTP
        await verifyOtp(otpPending.email || email, otpCode);
        navigate('/home');
      } else if (role === 'Admin') {
        await loginAdmin(password);
        navigate('/admin');
      } else if (role === 'Volunteer') {
        await loginVolunteer(email, password); // name in email, code in password
        navigate('/field');
      } else {
        if (mode === 'login') {
          await login(email.trim().toLowerCase(), password, 'User');
          navigate('/home');
        } else {
          // Send OTP
          await register(fullName, email.trim().toLowerCase(), password, phone);
          setSuccess('OTP securely dispatched. Please check your inbox.');
          // Don't clear password, it's already sent to server for hashing.
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={S.container}>
      <div style={S.mesh} />
      
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={S.card}>
        <div style={S.header}>
          <div style={S.iconBox}><Shield color="var(--accent)" size={32} /></div>
          <h1 style={S.title}>Jeevan Setu</h1>
          <p style={S.subtitle}>Unified Disaster Intelligence Portal</p>
        </div>

        {/* Role Toggle */}
        {!otpPending && (
          <div style={S.toggleContainer}>
            {['Citizen', 'Volunteer', 'Admin'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setMode('login'); setError(''); setSuccess(''); }}
                style={{
                  ...S.toggleBtn,
                  color: role === r ? 'var(--accent)' : 'var(--text3)',
                  background: role === r ? 'rgba(232,99,10,0.1)' : 'transparent',
                  border: role === r ? '1px solid var(--accent)' : '1px solid transparent'
                }}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Citizen Mode Toggle (Login/Register) */}
        {role === 'Citizen' && !otpPending && (
          <div style={{display:'flex', gap:20, marginBottom:20, justifyContent:'center'}}>
             <span onClick={() => {setMode('login'); setError(''); setSuccess('');}} style={{ fontSize:13, fontWeight:700, cursor:'pointer', color: mode==='login'?'white':'var(--text3)', borderBottom:mode==='login'?'2px solid var(--accent)':'none', paddingBottom:4, transition: 'all 0.2s' }}>Sign In</span>
             <span onClick={() => {setMode('register'); setError(''); setSuccess('');}} style={{ fontSize:13, fontWeight:700, cursor:'pointer', color: mode==='register'?'white':'var(--text3)', borderBottom:mode==='register'?'2px solid var(--accent)':'none', paddingBottom:4, transition: 'all 0.2s' }}>Create Account</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={S.form}>
          {otpPending ? (
            <div style={S.inputGroup}>
              <div style={{ fontSize: 13, color: '#10b981', textAlign: 'center', marginBottom: 16, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '12px', borderRadius: 12 }}>
                 <CheckCircle2 size={16} style={{display:'inline', marginBottom:-3, marginRight:6}}/>
                 OTP Sent to <b>{otpPending.email || email}</b>
              </div>
              <label style={S.label}>Enter 6-Digit Verification Code</label>
              <div style={S.inputWrapper}>
                <Lock size={18} style={S.inputIcon} />
                <input type="text" placeholder="123456" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value)} style={{...S.input, letterSpacing:6, textAlign:'center', fontSize: 18, fontWeight: 900}} required />
              </div>
            </div>
          ) : (
            <>
              {mode === 'register' && role === 'Citizen' && (
                <>
                  <div style={S.inputGroup}>
                    <label style={S.label}>Full Name</label>
                    <div style={S.inputWrapper}>
                      <User size={18} style={S.inputIcon} />
                      <input type="text" placeholder="Ramesh Kumar" value={fullName} onChange={e => setFullName(e.target.value)} style={S.input} required />
                    </div>
                  </div>
                  <div style={S.inputGroup}>
                    <label style={S.label}>Phone Number (Optional)</label>
                    <div style={S.inputWrapper}>
                      <Phone size={18} style={S.inputIcon} />
                      <input type="text" placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} style={S.input} />
                    </div>
                  </div>
                </>
              )}

              {role !== 'Admin' && (
                <div style={S.inputGroup}>
                  <label style={S.label}>
                    {role === 'Volunteer' ? 'Volunteer Name' : 'Email Address'}
                  </label>
                  <div style={S.inputWrapper}>
                    {role === 'Volunteer' ? <User size={18} style={S.inputIcon} /> : <Mail size={18} style={S.inputIcon} />}
                    <input
                      type={role === 'Volunteer' ? 'text' : 'email'}
                      placeholder={role === 'Volunteer' ? 'Govt Responder Team 1' : 'user@example.com'}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={S.input}
                      required
                    />
                  </div>
                </div>
              )}

              <div style={S.inputGroup}>
                <label style={S.label}>{role === 'Admin' ? 'Verify Secret' : role === 'Volunteer' ? 'Access Code / Secret' : 'Security Key'}</label>
                <div style={S.inputWrapper}>
                  <Lock size={18} style={S.inputIcon} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={S.input}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} style={S.error}>
              <AlertCircle size={14} /> <span>{error}</span>
            </motion.div>
          )}
          
          {success && mode === 'register' && !otpPending && (
             <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} style={{...S.error, background: 'rgba(16,185,129,0.1)', color: '#10b981'}}>
               <CheckCircle2 size={14} /> <span>{success}</span>
             </motion.div>
          )}

          <button type="submit" style={S.button} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                <span>{otpPending ? 'Verify SECURE-OTP' : mode === 'register' ? 'Generate Identity & Send OTP' : 'Sign In to Resilience Grid'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={S.footer}>
          <p style={S.footerText}>Secure Identity Hub • Stored securely in database</p>
          <div style={S.statusDot} />
          <span style={S.footerText}>Backend v2.6 Online</span>
        </div>
      </motion.div>
    </div>
  );
}

const S = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b10', position: 'relative', overflow: 'hidden', padding: 20 },
  mesh: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(232,99,10,0.05) 0%, transparent 50%), radial-gradient(circle at 100% 0%, rgba(59,130,246,0.03) 0%, transparent 40%)', zIndex: 0 },
  card: { width: '100%', maxWidth: 440, background: '#111827', borderRadius: 32, border: '1px solid #1f2937', padding: '48px 40px', position: 'relative', zIndex: 1, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
  header: { textAlign: 'center', marginBottom: 32 },
  iconBox: { width: 64, height: 64, borderRadius: 20, background: 'rgba(232,99,10,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  title: { fontSize: 24, fontWeight: 900, color: 'white', margin: '0 0 4px 0' },
  subtitle: { fontSize: 13, color: 'var(--text3)', margin: 0 },
  toggleContainer: { display: 'flex', gap: 8, marginBottom: 24, padding: 4, background: '#080b10', borderRadius: 16 },
  toggleBtn: { flex: 1, padding: '10px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', outline: 'none' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginLeft: 4 },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 16, color: '#4b5563' },
  input: { width: '100%', background: '#080b10', border: '1px solid #1f2937', height: 50, borderRadius: 14, padding: '0 16px 0 48px', color: 'white', fontSize: 14, transition: 'all 0.2s', outline: 'none' },
  button: { marginTop: 12, height: 54, background: 'var(--accent)', color: 'white', borderRadius: 16, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.2s', boxShadow: '0 10px 15px -3px rgba(232,99,10,0.3)' },
  error: { display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: 12 },
  footer: { marginTop: 32, borderTop: '1px solid #1f2937', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText: { fontSize: 11, color: '#4b5563', margin: 0 },
  statusDot: { width: 6, height: 6, background: '#10b981', borderRadius: '50%' }
};
