import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, StatusBar, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { API_BASE } from '../constants';

const { width } = Dimensions.get('window');

// ─── STAT BLOCK ──────────────────────────────────────────────────────────────
const StatBlock = ({ value, label, color, delay = 0 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.statBox, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <View style={[styles.statAccent, { backgroundColor: color }]} />
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
};

// ─── NAV CARD ────────────────────────────────────────────────────────────────
const NavCard = ({ icon, title, sub, onPress, accent = '#1e293b', delay = 0 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start();
  }, []);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, tension: 200, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }], flex: 1 }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.navCard, { borderTopColor: accent, borderTopWidth: 3 }]}
        activeOpacity={1}
      >
        <Text style={styles.navIcon}>{icon}</Text>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navSub}>{sub}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [stats, setStats] = useState({ disasters: 0, volunteers: '—', shelters: '—', aid: '₹0L' });
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();
  const heroAnim = useRef(new Animated.Value(0)).current;

  const loadUser = async () => {
    const stored = await AsyncStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    else navigation.replace('Login');
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  const fetchStats = async () => {
    try {
      const net = await Network.getNetworkStateAsync();
      setIsOffline(!net.isConnected);
      if (!net.isConnected) { setLoading(false); return; }

      const [dRes, vRes, sRes, dnRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/api/v2/disasters`),
        axios.get(`${API_BASE}/api/v2/volunteers`),
        axios.get(`${API_BASE}/api/v2/shelters`),
        axios.get(`${API_BASE}/api/v2/donations/top`),
      ]);

      let totalAid = 0;
      if (dnRes.status === 'fulfilled') {
        totalAid = dnRes.value.data.reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
      }

      setStats({
        disasters: dRes.status === 'fulfilled' ? dRes.value.data.filter(x => x.status !== 'RESOLVED').length : 0,
        volunteers: vRes.status === 'fulfilled' ? vRes.value.data.length : '—',
        shelters: sRes.status === 'fulfilled' ? sRes.value.data.length : '—',
        aid: `₹${(totalAid / 100000).toFixed(1)}L`,
      });
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (isFocused) {
      loadUser();
      fetchStats();
      Animated.timing(heroAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    }
  }, [isFocused]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── HEADER ─── */}
        <Animated.View style={[styles.header, { opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.welcomeText}>WELCOME TO THE GRID,</Text>
              <Text style={styles.pillText}>{user?.name?.toUpperCase() || 'AGENT'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                style={[styles.pillOrange, { backgroundColor: user?.role === 'admin' ? '#f43f5e' : (user?.role === 'volunteer' ? '#22c55e' : '#e8630a') }]}
              >
                <Text style={styles.pillOrangeText}>
                  {user?.role?.toUpperCase() || 'UNKNOWN'} ACTIVE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.logoutBtn}>LOGOUT ⏻</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.heroTitle}>When{'\n'}
            <Text style={styles.heroAccent}>Humanity</Text> Calls.
          </Text>
          <Text style={styles.heroSub}>Connecting survivors and responders in a unified field network.</Text>
        </Animated.View>

        {/* ─── OFFLINE BANNER ─── */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineIcon}>⚠️</Text>
            <View>
              <Text style={styles.offlineTitle}>OFFLINE MODE ACTIVE</Text>
              <Text style={styles.offlineSub}>SOS routed via SMS fallback protocol.</Text>
            </View>
          </View>
        )}

        {/* ─── SOS BUTTON ─── */}
        <TouchableOpacity
          style={styles.sosBtn}
          onPress={() => navigation.navigate('SOS')}
          activeOpacity={0.85}
        >
          <View style={styles.sosBtnInner}>
            <Text style={styles.sosBtnIcon}>🆘</Text>
            <View>
              <Text style={styles.sosBtnText}>SOS SIGNAL</Text>
              <Text style={styles.sosBtnSub}>Send verifiable emergency dispatch</Text>
            </View>
          </View>
          <Text style={styles.sosBtnArrow}>→</Text>
        </TouchableOpacity>

        {/* ─── STATS ─── */}
        <Text style={styles.sectionLabel}>⚡ GLOBAL SYNC MESH</Text>
        {loading ? (
          <ActivityIndicator color="#e8630a" style={{ marginVertical: 30 }} />
        ) : (
          <View style={styles.statsGrid}>
            <StatBlock value={stats.disasters} label="Active Alerts" color="#ef4444" delay={0} />
            <StatBlock value={stats.volunteers} label="Responders" color="#10b981" delay={80} />
            <StatBlock value={stats.shelters} label="Safe Shelters" color="#3b82f6" delay={160} />
            <StatBlock value={stats.aid} label="Total Aid" color="#a78bfa" delay={240} />
          </View>
        )}

        {/* ─── ACTION CARDS ─── */}
        <Text style={styles.sectionLabel}>🗺 FIELD OPERATIONS</Text>
        <View style={styles.navRow}>
          <NavCard icon="📡" title="Live Map" sub="Intel Dashboard" accent="#3b82f6" delay={0} onPress={() => navigation.navigate('MapDashboard')} />
          <View style={{ width: 14 }} />
          <NavCard icon="💎" title="Relief Fund" sub="Send direct aid" accent="#a78bfa" delay={80} onPress={() => navigation.navigate('Donor')} />
        </View>

        {/* ─── FOOTER NOTE ─── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>JEEVAN SETU · Disaster Response Mesh · v2.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080b10' },
  scroll: { paddingHorizontal: 22, paddingBottom: 50 },

  header: { paddingTop: 20, marginBottom: 28 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(232,99,10,0.12)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(232,99,10,0.2)' },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e8630a', marginRight: 8 },
  pillText: { color: '#e8630a', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  pillGreen: { backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  pillGreenText: { color: '#10b981', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pillOrange: { backgroundColor: 'rgba(232,99,10,0.1)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(232,99,10,0.25)' },
  pillOrangeText: { color: '#e8630a', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  identityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d1117', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#1f2937', gap: 10 },
  identityIcon: { fontSize: 14 },
  identityText: { color: '#94a3b8', fontSize: 11, fontWeight: '900', flex: 1, letterSpacing: 0.5 },
  logoutBtn: { color: '#ef4444', fontSize: 10, fontWeight: '800' },

  heroTitle: { fontSize: 42, fontWeight: '900', color: 'white', lineHeight: 52, marginBottom: 14 },
  heroAccent: { color: '#e8630a' },
  heroSub: { color: '#64748b', fontSize: 15, lineHeight: 24, maxWidth: '90%' },

  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 16, padding: 18, marginBottom: 20 },
  offlineIcon: { fontSize: 24 },
  offlineTitle: { color: '#fca5a5', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  offlineSub: { color: '#f87171', fontSize: 11, marginTop: 3 },

  sosBtn: { backgroundColor: '#1a0000', borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 22, padding: 24, marginBottom: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#ef4444', shadowRadius: 20, shadowOpacity: 0.12, elevation: 8 },
  sosBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  sosBtnIcon: { fontSize: 32 },
  sosBtnText: { color: '#ef4444', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  sosBtnSub: { color: 'rgba(239,68,68,0.6)', fontSize: 12, marginTop: 4 },
  sosBtnArrow: { color: 'rgba(239,68,68,0.5)', fontSize: 24, fontWeight: '900' },

  sectionLabel: { color: '#475569', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 36 },
  statBox: { width: (width - 44 - 12) / 2, backgroundColor: '#0d1117', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: '#1f2937', overflow: 'hidden' },
  statAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  statVal: { fontSize: 34, fontWeight: '900', marginBottom: 6 },
  statLabel: { color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  navRow: { flexDirection: 'row', marginBottom: 36 },
  navCard: { backgroundColor: '#0d1117', borderRadius: 18, padding: 22, borderWidth: 1, borderColor: '#1f2937', alignItems: 'flex-start' },
  navIcon: { fontSize: 28, marginBottom: 14 },
  navTitle: { color: 'white', fontSize: 16, fontWeight: '900', marginBottom: 5 },
  navSub: { color: '#475569', fontSize: 12 },

  footer: { alignItems: 'center', paddingTop: 10 },
  footerText: { color: '#1f2937', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
});
