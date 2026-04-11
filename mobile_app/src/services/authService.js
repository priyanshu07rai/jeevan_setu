/**
 * authService.js — Unified Citizen Auth Service (Mobile)
 * Handles JWT-based auth for both register+OTP flow and direct login.
 * Stores tokens in AsyncStorage (secure enough for React Native).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY  = 'jeevan_access_token';
const REFRESH_TOKEN_KEY = 'jeevan_refresh_token';
const CITIZEN_PROFILE   = 'citizen_user';

// ─── Token Helpers ─────────────────────────────────────────────────────────────
export async function getStoredToken() {
  try { return await AsyncStorage.getItem(ACCESS_TOKEN_KEY); }
  catch { return null; }
}

export async function getStoredRefresh() {
  try { return await AsyncStorage.getItem(REFRESH_TOKEN_KEY); }
  catch { return null; }
}

export async function storeTokens(accessToken, refreshToken) {
  try {
    if (accessToken)  await AsyncStorage.setItem(ACCESS_TOKEN_KEY,  accessToken);
    if (refreshToken) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {}
}

export async function clearTokens() {
  try {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, CITIZEN_PROFILE, 'citizen_name']);
  } catch {}
}

export async function getStoredProfile() {
  try {
    const raw = await AsyncStorage.getItem(CITIZEN_PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── API Fetch with Bearer token ──────────────────────────────────────────────
async function authFetch(path, options = {}) {
  const token = await getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return response;
}

// ─── Auth Service ─────────────────────────────────────────────────────────────
const AuthService = {

  /**
   * Start registration — sends OTP email.
   * Returns { status: 'otp_sent', message }
   */
  async startRegistration(fullName, email, password, phone = '') {
    const res = await authFetch('/api/v2/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName,
        email: email.trim().toLowerCase(),
        password,
        phone,
        device_type: 'mobile',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  /**
   * Verify OTP and commit citizen account.
   * Returns full profile + JWT tokens.
   * Stores tokens automatically.
   */
  async verifyOtp(email, otpCode) {
    const res = await authFetch('/api/v2/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        otp_code: otpCode.trim(),
        device_type: 'mobile',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'OTP verification failed');

    await storeTokens(data.access_token, data.refresh_token);
    await AsyncStorage.setItem(CITIZEN_PROFILE, JSON.stringify(data));
    await AsyncStorage.setItem('citizen_name', data.name || '');
    return data;
  },

  /**
   * Login with email + password.
   * Supports both new JWT endpoint and legacy endpoint as fallback.
   * Returns full profile + JWT tokens.
   */
  async login(email, password) {
    // Try new JWT endpoint first
    const res = await authFetch('/api/v2/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        device_type: 'mobile',
      }),
    });
    const data = await res.json();

    if (res.ok) {
      await storeTokens(data.access_token, data.refresh_token);
      await AsyncStorage.setItem(CITIZEN_PROFILE, JSON.stringify(data));
      await AsyncStorage.setItem('citizen_name', data.name || '');
      return data;
    }

    // Fallback to legacy endpoint (for users registered before bcrypt upgrade)
    if (res.status === 401 || res.status === 404) {
      const legacyRes = await authFetch('/api/v2/citizen/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const legacyData = await legacyRes.json();
      if (legacyRes.ok) {
        await AsyncStorage.setItem(CITIZEN_PROFILE, JSON.stringify(legacyData));
        await AsyncStorage.setItem('citizen_name', legacyData.name || '');
        return legacyData;
      }
      throw new Error(legacyData.error || 'Invalid email or password');
    }

    throw new Error(data.error || 'Login failed');
  },

  /**
   * Refresh access token using stored refresh token.
   * Returns true on success.
   */
  async refreshToken() {
    const rt = await getStoredRefresh();
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
        await storeTokens(data.access_token, null);
        return true;
      }
    } catch {}
    return false;
  },

  /**
   * Fetch citizen profile from backend (requires valid token).
   */
  async getProfile() {
    const res = await authFetch('/api/v2/auth/profile');
    if (!res.ok) return null;
    const data = await res.json();
    await AsyncStorage.setItem(CITIZEN_PROFILE, JSON.stringify(data));
    return data;
  },

  /**
   * Logout — clear all stored tokens and profile.
   */
  async logout() {
    try {
      await authFetch('/api/v2/auth/logout', { method: 'POST' });
    } catch {}
    await clearTokens();
  },

  /**
   * Resend OTP for pending registration.
   */
  async resendOtp(email) {
    const res = await authFetch('/api/v2/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not resend OTP');
    return data;
  },
};

export default AuthService;
