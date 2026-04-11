import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { AlertTriangle, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────
const isMobileBrowser = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (typeof window !== 'undefined' && window.innerWidth < 768);

// ── Access Restricted Overlay (Component) ───────────────────────────────────
function AccessRestrictedOverlay() {
  return (
    <div style={R.overlay}>
      <div style={R.card}>
        <div style={R.topBar} />
        <div style={R.iconRing}><Smartphone size={42} color="#f43f5e" /></div>
        
        <h2 style={R.title}>Emergency SOS: Mobile Only</h2>
        <p style={R.sub}>
          Mission-critical GPS accuracy is required for rescue operations. Desktop SOS reporting is now disabled to prevent inaccurate dispatch.
        </p>

        <div style={R.instructionBox}>
          <div style={{ fontWeight: 800, color: 'white', marginBottom: 8, fontSize: 13 }}>SWITCH TO MOBILE</div>
          <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            Open **Jeevan Setu** on your smartphone to send an SOS signal. Your identity is already synchronized via your account.
          </p>
        </div>

        <div style={R.footer}>
          <AlertTriangle size={14} color="#f59e0b" style={{ marginRight: 8 }} />
          STRICT SATELLITE VERIFICATION ACTIVE
        </div>
      </div>
    </div>
  );
}

const R = {
  overlay: {
    minHeight: '75vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    background: '#111827', borderRadius: 32, border: '1px solid rgba(244,63,94,0.3)',
    padding: '56px 44px', maxWidth: 440, width: '100%', textAlign: 'center',
    position: 'relative', boxShadow: '0 0 100px rgba(244,63,94,0.15)',
  },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: '#f43f5e', borderRadius: '30px 30px 0 0' },
  iconRing: {
    width: 90, height: 90, borderRadius: 45, background: 'rgba(244,63,94,0.1)', border: '2px solid rgba(244,63,94,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px',
  },
  title: { color: 'white', fontSize: 26, fontWeight: 900, marginBottom: 14, marginTop: 0 },
  sub: { color: '#64748b', fontSize: 14, lineHeight: 1.7, marginBottom: 32, marginTop: 0 },
  instructionBox: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', borderRadius: 18, 
    padding: '24px', textAlign: 'left', marginBottom: 28
  },
  footer: { 
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    color: '#f59e0b', fontSize: 11, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase'
  }
};

export default function SOSPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login?role=Citizen');
    }
  }, [user, loading, navigate]);

  // ── Desktop View (Message Only) ──────────────────────────────────────────
  if (!isMobileBrowser()) {
    return (
      <AppShell title="SOS SIGNAL" sub="STRICT GPS VERIFICATION · ANTI-FRAUD LAYER">
        <AccessRestrictedOverlay />
        <div style={{ height: '70vh', background: '#080b10' }} />
      </AppShell>
    );
  }

  // ── Mobile View (Future Expansion) ───────────────────────────────────────
  // Note: Per user request, the web version is now a "Mobile App Only" gateway.
  // This section would only render on actual mobile browsers if desired.
  return (
    <AppShell title="SOS SIGNAL" sub="STRICT GPS VERIFICATION · ANTI-FRAUD LAYER">
      <AccessRestrictedOverlay />
      <div style={{ height: '70vh', background: '#080b10' }}>
         <Text style={{ color: 'white', textAlign: 'center', marginTop: 100 }}>
           Please use the mobile app for SOS.
         </Text>
      </div>
    </AppShell>
  );
}
