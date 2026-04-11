import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Animated, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from '../constants';

const { width } = Dimensions.get('window');

export default function ResponderLoginScreen({ navigation }) {
  const [name, setName]                     = useState('');
  const [code, setCode]                     = useState('');
  const [loading, setLoading]               = useState(false);
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [locationError, setLocationError]   = useState('');
  const [lastPing, setLastPing]             = useState(null);

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleIn   = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleIn, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  // Pulse when tracking
  useEffect(() => {
    if (trackingActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [trackingActive]);

  // GPS broadcasting interval
  useEffect(() => {
    let interval;
    if (activeVolunteer && trackingActive) {
      interval = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await axios.post(`${API_BASE}/api/v2/volunteer/location`, {
            volunteer_id: activeVolunteer.id,
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
          setLastPing(new Date().toLocaleTimeString());
        } catch (e) {
          console.log('Location Ping Failure:', e.message);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [activeVolunteer, trackingActive]);

  const handleLogin = async () => {
    if (!name.trim() || !code.trim()) {
      Alert.alert('Input Required', 'Please enter your name and access code.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v2/volunteers/auth`, { name, access_code: code });
      setActiveVolunteer(res.data);
      await startTracking();
    } catch {
      Alert.alert('Authentication Failed', 'Invalid name or access code. Contact your command unit.');
    } finally {
      setLoading(false);
    }
  };

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Location permission required for GPS broadcasting.');
      return;
    }
    setTrackingActive(true);
  };

  // ─────────────────────────────────────────────────────────
  // LOGIN VIEW
  // ─────────────────────────────────────────────────────────
  if (!activeVolunteer) {
    return (
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.loginContainer, { opacity: fadeAnim, transform: [{ scale: scaleIn }] }]}>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.loginHeader}>
            <Text style={styles.loginIcon}>📡</Text>
            <Text style={styles.loginTitle}>Responder Login</Text>
            <Text style={styles.loginSub}>
              Authenticate to begin secure GPS broadcasting to Command HQ.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your registered name"
              placeholderTextColor="#334155"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ACCESS TOKEN</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. FORCE-2024"
              placeholderTextColor="#334155"
              value={code}
              onChangeText={setCode}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.loginBtnText}>LOGIN &amp; COMMENCE GPS SYNC</Text>
            }
          </TouchableOpacity>

          <View style={styles.securityNote}>
            <Text style={styles.securityNoteText}>
              🔐 Access tokens are issued by your command center. All logins are logged.
            </Text>
          </View>

        </Animated.View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // TRACKING VIEW
  // ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.trackingContainer, { opacity: fadeAnim }]}>

        {/* Status Ring */}
        <View style={styles.ringWrapper}>
          <Animated.View style={[
            styles.ringOuter,
            { transform: [{ scale: pulseAnim }], borderColor: trackingActive ? '#10b981' : '#f43f5e' }
          ]} />
          <View style={[styles.ringInner, { borderColor: trackingActive ? '#10b981' : '#f43f5e' }]}>
            <Text style={styles.ringIcon}>📡</Text>
          </View>
        </View>

        <Text style={[styles.trackStatus, { color: trackingActive ? '#10b981' : '#f43f5e' }]}>
          {trackingActive ? 'BROADCASTING LIVE' : 'TRACKING OFFLINE'}
        </Text>

        {/* Volunteer Info Card */}
        <View style={styles.volunteerCard}>
          <View style={styles.volunteerRow}>
            <Text style={styles.volunteerLabel}>FORCE ID</Text>
            <Text style={styles.volunteerValue}>V-{activeVolunteer.id}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.volunteerRow}>
            <Text style={styles.volunteerLabel}>OPERATOR</Text>
            <Text style={styles.volunteerValue}>{activeVolunteer.name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.volunteerRow}>
            <Text style={styles.volunteerLabel}>TELEMETRY</Text>
            <Text style={[styles.volunteerValue, { color: '#10b981' }]}>PING EVERY 5s</Text>
          </View>
          {lastPing && (
            <>
              <View style={styles.divider} />
              <View style={styles.volunteerRow}>
                <Text style={styles.volunteerLabel}>LAST PING</Text>
                <Text style={styles.volunteerValue}>{lastPing}</Text>
              </View>
            </>
          )}
        </View>

        {locationError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {locationError}</Text>
          </View>
        ) : null}

        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Transmitting coordinates to Command HQ</Text>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080b10' },

  // ── Login ──
  loginContainer: { flex: 1, padding: 26, paddingTop: 16 },
  backBtn: { backgroundColor: '#111827', padding: 10, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 32 },
  backText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },

  loginHeader: { alignItems: 'center', marginBottom: 40 },
  loginIcon: { fontSize: 52, marginBottom: 16 },
  loginTitle: { fontSize: 30, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 12 },
  loginSub: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: { color: '#334155', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  input: {
    backgroundColor: '#0d1117', color: 'white', padding: 18,
    borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', fontSize: 16,
  },

  loginBtn: {
    backgroundColor: '#10b981', padding: 20, borderRadius: 18,
    alignItems: 'center', marginTop: 10,
    shadowColor: '#10b981', shadowRadius: 20, shadowOpacity: 0.3, elevation: 8,
  },
  loginBtnText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  securityNote: {
    marginTop: 28, backgroundColor: 'rgba(16,185,129,0.05)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)', padding: 16,
  },
  securityNoteText: { color: '#475569', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // ── Tracking ──
  trackingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  ringWrapper: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  ringOuter: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2, opacity: 0.3 },
  ringInner: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,185,129,0.05)' },
  ringIcon: { fontSize: 38 },
  trackStatus: { fontSize: 22, fontWeight: '900', letterSpacing: 2, marginBottom: 32 },

  volunteerCard: {
    width: '100%', backgroundColor: '#0d1117', borderRadius: 22,
    borderWidth: 1, borderColor: '#1f2937', overflow: 'hidden', marginBottom: 24,
  },
  volunteerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  volunteerLabel: { color: '#334155', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  volunteerValue: { color: 'white', fontSize: 14, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#1f2937' },

  errorBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 20 },
  errorText: { color: '#fca5a5', fontSize: 13 },

  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', shadowColor: '#10b981', shadowRadius: 6, shadowOpacity: 1 },
  liveText: { color: '#475569', fontSize: 12 },
});
