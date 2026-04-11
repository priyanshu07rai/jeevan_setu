/**
 * CitizenLoginScreen.js — Unified Citizen Identity (Mobile)
 * Supports: Login | Register → OTP → Account Created
 * Uses JWT auth via /api/v2/auth/* endpoints.
 * Falls back to legacy /api/v2/citizen/* for existing SHA-256 accounts.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Animated, Dimensions,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthService from '../services/authService';
import { API_BASE } from '../constants';

const { width } = Dimensions.get('window');

// Modes: 'login' | 'register' | 'otp'
export default function CitizenLoginScreen({ navigation }) {
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [otp,      setOtp]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [otpEmail, setOtpEmail] = useState(''); // email used for OTP

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleIn  = useRef(new Animated.Value(0.95)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleIn,   { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const switchMode = (m) => { setMode(m); setError(''); setOtp(''); };

  // ─── Login Handler ──────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      shake(); return;
    }
    setLoading(true); setError('');
    try {
      const data = await AuthService.login(email.trim(), password);
      Alert.alert('Welcome back!', `Hello, ${data.name || 'Citizen'} 👋`);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
      shake();
    } finally { setLoading(false); }
  };

  // ─── Register Handler (Step 1: Sends OTP) ─────────────────────────────────
  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Full name, email and password are required.');
      shake(); return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      shake(); return;
    }
    setLoading(true); setError('');
    try {
      await AuthService.startRegistration(name.trim(), email.trim(), password, phone.trim());
      setOtpEmail(email.trim().toLowerCase());
      switchMode('otp');
      Alert.alert(
        '📧 OTP Sent!',
        `A 6-digit code has been sent to ${email.trim()}. Check your inbox.`
      );
    } catch (err) {
      setError(err.message || 'Registration failed. Try again.');
      shake();
    } finally { setLoading(false); }
  };

  // ─── OTP Verify Handler (Step 2: Commits Account) ─────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit OTP.');
      shake(); return;
    }
    setLoading(true); setError('');
    try {
      const data = await AuthService.verifyOtp(otpEmail || email.trim(), otp.trim());
      Alert.alert('🎉 Account Created!', `Welcome to Jeevan Setu, ${data.name}!\n\nYour identity is now linked across desktop and mobile.`);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
      shake();
    } finally { setLoading(false); }
  };

  // ─── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    setLoading(true); setError('');
    try {
      await AuthService.resendOtp(otpEmail || email.trim());
      Alert.alert('Resent!', 'A new OTP has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not resend OTP.');
    } finally { setLoading(false); }
  };

  const handleSubmit = () => {
    if (mode === 'login')    handleLogin();
    else if (mode === 'register') handleRegister();
    else if (mode === 'otp') handleVerifyOtp();
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.container, {
            opacity: fadeAnim,
            transform: [{ scale: scaleIn }, { translateX: shakeAnim }]
          }]}>

            {/* Back button */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>
                  {mode === 'otp' ? '📧' : '👤'}
                </Text>
              </View>
              <Text style={styles.title}>
                {mode === 'login'    ? 'Citizen Access'    :
                 mode === 'register' ? 'Join Jeevan Setu'  :
                                      'Verify Your Email'}
              </Text>
              <Text style={styles.sub}>
                {mode === 'login'    ? 'Login with your email to sync your rescue identity with HQ.' :
                 mode === 'register' ? 'Register once — access from desktop and mobile anywhere.'     :
                                      `Enter the 6-digit code sent to\n${otpEmail || email}`}
              </Text>
            </View>

            {/* Mode Toggle (login/register only) */}
            {mode !== 'otp' && (
              <View style={styles.modeToggle}>
                {[['login','Login'],['register','Register']].map(([m, label]) => (
                  <TouchableOpacity key={m} style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                    onPress={() => switchMode(m)}>
                    <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.form}>

              {/* REGISTER fields */}
              {mode === 'register' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>FULL NAME</Text>
                  <TextInput style={styles.input} placeholder="John Doe"
                    placeholderTextColor="#334155" value={name} onChangeText={setName} />
                </View>
              )}

              {/* LOGIN + REGISTER: Email */}
              {(mode === 'login' || mode === 'register') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>EMAIL ADDRESS</Text>
                  <TextInput style={styles.input} placeholder="citizen@example.com"
                    placeholderTextColor="#334155" value={email} onChangeText={setEmail}
                    autoCapitalize="none" keyboardType="email-address" />
                </View>
              )}

              {/* REGISTER: Phone */}
              {mode === 'register' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PHONE (OPTIONAL)</Text>
                  <TextInput style={styles.input} placeholder="+91 98765 43210"
                    placeholderTextColor="#334155" value={phone} onChangeText={setPhone}
                    keyboardType="phone-pad" />
                </View>
              )}

              {/* LOGIN + REGISTER: Password */}
              {(mode === 'login' || mode === 'register') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PASSWORD</Text>
                  <TextInput style={styles.input} placeholder="••••••••"
                    placeholderTextColor="#334155" value={password} onChangeText={setPassword}
                    secureTextEntry />
                </View>
              )}

              {/* OTP: 6-digit code */}
              {mode === 'otp' && (
                <>
                  <View style={styles.otpInfoBox}>
                    <Text style={styles.otpInfoText}>
                      📬 OTP sent to <Text style={styles.otpEmail}>{otpEmail || email}</Text>
                    </Text>
                    <Text style={styles.otpExpiry}>Expires in 10 minutes</Text>
                  </View>
                  <View style={[styles.inputGroup, { marginTop: 8 }]}>
                    <Text style={styles.label}>ENTER OTP CODE</Text>
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder="000000" placeholderTextColor="#334155"
                      value={otp} onChangeText={t => setOtp(t.replace(/\D/g,'').slice(0,6))}
                      keyboardType="number-pad" maxLength={6}
                    />
                  </View>
                  <TouchableOpacity style={styles.resendBtn} onPress={handleResendOtp} disabled={loading}>
                    <Text style={styles.resendText}>Didn't get the code? Resend OTP</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Error display */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠ {error}</Text>
                </View>
              )}

              {/* Submit button */}
              <TouchableOpacity style={[styles.actionBtn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.actionBtnText}>
                      {mode === 'login'    ? 'LOGIN TO PLATFORM'     :
                       mode === 'register' ? 'SEND VERIFICATION OTP' :
                                            'VERIFY & CREATE ACCOUNT'}
                    </Text>}
              </TouchableOpacity>

              {/* OTP back button */}
              {mode === 'otp' && (
                <TouchableOpacity style={styles.switchBtn} onPress={() => switchMode('register')}>
                  <Text style={styles.switchText}>← Back to registration</Text>
                </TouchableOpacity>
              )}

            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                🔐 Unified Identity Protocol v2.1 · bcrypt · JWT
              </Text>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#080b10' },
  container:  { flex: 1, padding: 24, paddingBottom: 40 },

  backBtn:  { backgroundColor: '#111827', padding: 10, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 20 },
  backText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },

  header:     { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(232,99,10,0.1)',
    borderWidth: 1, borderColor: 'rgba(232,99,10,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 32 },
  title:    { fontSize: 26, fontWeight: '900', color: 'white', marginBottom: 8 },
  sub:      { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },

  modeToggle: {
    flexDirection: 'row', backgroundColor: '#111827',
    borderRadius: 12, padding: 4, marginBottom: 20,
  },
  modeBtn:         { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  modeBtnActive:   { backgroundColor: '#e8630a' },
  modeBtnText:     { color: '#64748b', fontWeight: '800', fontSize: 13 },
  modeBtnTextActive: { color: 'white' },

  form:       { flex: 1 },
  inputGroup: { marginBottom: 18 },
  label: {
    color: '#475569', fontSize: 10, fontWeight: '900',
    letterSpacing: 1.5, marginBottom: 8,
  },
  input: {
    backgroundColor: '#0d1117', color: 'white',
    padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#1f2937',
    fontSize: 15,
  },
  otpInput: {
    fontSize: 28, fontWeight: '900', letterSpacing: 12,
    textAlign: 'center',
  },

  otpInfoBox: {
    backgroundColor: 'rgba(232,99,10,0.08)',
    borderWidth: 1, borderColor: 'rgba(232,99,10,0.2)',
    borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8,
  },
  otpInfoText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  otpEmail:    { color: '#e8630a', fontWeight: '700' },
  otpExpiry:   { color: '#475569', fontSize: 11, marginTop: 4 },

  resendBtn: { alignItems: 'center', marginTop: 8, marginBottom: 16, padding: 8 },
  resendText: { color: '#e8630a', fontWeight: '700', fontSize: 13 },

  errorBox: {
    backgroundColor: 'rgba(244,63,94,0.08)',
    borderWidth: 1, borderColor: 'rgba(244,63,94,0.2)',
    borderRadius: 10, padding: 12, marginBottom: 12,
  },
  errorText: { color: '#f43f5e', fontSize: 13, fontWeight: '600' },

  actionBtn: {
    backgroundColor: '#e8630a', padding: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#e8630a', shadowRadius: 15, shadowOpacity: 0.3, elevation: 6,
  },
  actionBtnText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  switchBtn: { marginTop: 20, alignItems: 'center', padding: 8 },
  switchText: { color: '#64748b', fontWeight: '700', fontSize: 13 },

  footer:     { marginTop: 'auto', paddingTop: 20 },
  footerText: { color: '#1e293b', fontSize: 10, textAlign: 'center', fontWeight: '800', letterSpacing: 0.5 },
});
