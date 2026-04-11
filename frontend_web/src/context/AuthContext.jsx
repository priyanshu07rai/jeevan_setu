import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const AuthContext = createContext();

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://jeevansetu-api.onrender.com';

// ─── Token helpers ────────────────────────────────────────────────────────────
const TOKEN_KEY   = 'jeevan_access_token';
const REFRESH_KEY = 'jeevan_refresh_token';
const USER_KEY    = 'user';

function getStoredToken()   { return localStorage.getItem(TOKEN_KEY); }
function getStoredRefresh() { return localStorage.getItem(REFRESH_KEY); }

function storeTokens(accessToken, refreshToken) {
  if (accessToken)  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  // Directly fetch against the definitive API Server (which handles Production & Local correctly now)
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}


// ─── Socket.IO citizen room helper ───────────────────────────────────────────
let _socket = null;

function getCitizenSocket() {
  if (_socket) return _socket;
  try {
    // Dynamically import socket.io-client if available
    const io = window._io || (window.io);
    if (io) {
      _socket = io(API_BASE, { transports: ['websocket', 'polling'] });
    }
  } catch (e) { /* Socket.IO client not loaded — sync features disabled */ }
  return _socket;
}

function joinCitizenRoom(email) {
  const sock = getCitizenSocket();
  if (sock && email) sock.emit('citizen_join', { email });
}

function leaveCitizenRoom(email) {
  const sock = getCitizenSocket();
  if (sock && email) sock.emit('citizen_leave', { email });
}


// ─── AuthProvider ─────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  // OTP flow state (citizen registration)
  const [otpPending, setOtpPending] = useState(null); // { email, name }

  // Persist + load user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        // Re-join citizen Socket.IO room on page reload
        if (u?.role === 'citizen' && u?.email) {
          setTimeout(() => joinCitizenRoom(u.email), 1000);
        }
      } catch {}
    }
    setLoading(false);
  }, []);

  // Listen for cross-device sync events
  useEffect(() => {
    if (!user || user.role !== 'citizen') return;
    const sock = getCitizenSocket();
    if (!sock) return;

    const handleSync = (data) => {
      if (data.type === 'profile_update' || data.type === 'initial_state') {
        const profile = data.profile || data;
        setUser(prev => {
          const updated = { ...prev, ...profile };
          localStorage.setItem(USER_KEY, JSON.stringify(updated));
          return updated;
        });
      }
      if (data.type === 'emergency_update') {
        setUser(prev => {
          const updated = { ...prev, emergency_mode: data.emergency_mode };
          localStorage.setItem(USER_KEY, JSON.stringify(updated));
          return updated;
        });
      }
    };

    sock.on('citizen_sync', handleSync);
    return () => sock.off('citizen_sync', handleSync);
  }, [user]);

  // ─── Citizen Registration (Step 1: sends OTP) ──────────────────────────────
  const register = async (fullName, email, password, phone = '') => {
    const res = await apiFetch('/api/v2/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        phone,
        device_type: 'desktop',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setOtpPending({ email, name: fullName });
    return data; // { status: 'otp_sent', message }
  };

  // ─── OTP Verification (Step 2: commits citizen, returns JWT) ───────────────
  const verifyOtp = async (email, otpCode) => {
    const res = await apiFetch('/api/v2/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp_code: otpCode, device_type: 'desktop' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'OTP verification failed');

    const citizenUser = { ...data, role: 'citizen' };
    storeTokens(data.access_token, data.refresh_token);
    localStorage.removeItem('lastRoute');
    setUser(citizenUser);
    setOtpPending(null);
    localStorage.setItem(USER_KEY, JSON.stringify(citizenUser));
    joinCitizenRoom(data.email);
    return citizenUser;
  };

  // ─── Citizen Login ─────────────────────────────────────────────────────────
  const login = async (email, password, name, role) => {
    // ── Try new JWT auth endpoint first ──
    try {
      const res = await apiFetch('/api/v2/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, device_type: 'desktop' }),
      });
      const data = await res.json();

      if (res.ok) {
        const citizenUser = { ...data, role: 'citizen' };
        storeTokens(data.access_token, data.refresh_token);
        localStorage.removeItem('lastRoute');
        setUser(citizenUser);
        localStorage.setItem(USER_KEY, JSON.stringify(citizenUser));
        joinCitizenRoom(data.email);
        return citizenUser;
      }

      throw new Error(data.error || 'Login failed');
    } catch (err) {
      throw err;
    }
  };

  // ─── Admin Login ───────────────────────────────────────────────────────────
  const loginAdmin = async (token) => {
    // Try backend admin auth first
    try {
      const res = await apiFetch('/api/v2/auth/admin', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: token }),
      });
      if (res.ok) {
        const d = await res.json();
        const adminUser = { id: 'u-admin', email: 'admin@command.local', name: d.name || 'COMMAND ADMIN', role: 'admin' };
        localStorage.removeItem('lastRoute');
        setUser(adminUser);
        localStorage.setItem(USER_KEY, JSON.stringify(adminUser));
        return adminUser;
      }
    } catch {}
    // Fallback: local pin check
    if (token !== '123') throw new Error('Invalid token');
    const adminUser = { id: 'u-admin', email: 'admin@command.local', name: 'COMMAND ADMIN', role: 'admin' };
    localStorage.removeItem('lastRoute');
    setUser(adminUser);
    localStorage.setItem(USER_KEY, JSON.stringify(adminUser));
    return adminUser;
  };

  // ─── Volunteer Login ───────────────────────────────────────────────────────
  const loginVolunteer = async (name, accessCode) => {
    const r = await apiFetch('/api/v2/volunteers/auth', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), access_code: accessCode.trim() }),
    });
    if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Auth failed'); }
    const vol = await r.json();
    const volUser = {
      id: `vol-${vol.id}`,
      volunteerId: vol.id,
      name: vol.name,
      email: '',
      role: 'volunteer',
      skills: vol.skills,
      status: vol.status,
    };
    localStorage.removeItem('lastRoute');
    setUser(volUser);
    localStorage.setItem(USER_KEY, JSON.stringify(volUser));
    return volUser;
  };

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    if (user?.email) leaveCitizenRoom(user.email);
    try {
      await apiFetch('/api/v2/auth/logout', { method: 'POST' });
    } catch {}
    clearTokens();
    setUser(null);
    setOtpPending(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('lastRoute');
  };

  // ─── Token refresh helper ──────────────────────────────────────────────────
  const refreshAccessToken = async () => {
    const rt = getStoredRefresh();
    if (!rt) return false;
    try {
      const res = await fetch(`${API_BASE}/api/v2/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.access_token) {
        storeTokens(data.access_token, null);
        return true;
      }
    } catch {}
    return false;
  };

  // ─── Password Recovery ──────────────────────────────────────────────────────
  const forgotPassword = async (email) => {
    const res = await apiFetch('/api/v2/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start recovery');
    return data;
  };

  const resetPassword = async (email, otpCode, newPassword) => {
    const res = await apiFetch('/api/v2/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset password');
    return data;
  };

  const resendOtp = async (email) => {
    const res = await apiFetch('/api/v2/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend OTP');
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user, loading, otpPending,
      login, register, verifyOtp,
      loginAdmin, loginVolunteer,
      logout, refreshAccessToken,
      apiFetch,
      forgotPassword, resetPassword, resendOtp
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
