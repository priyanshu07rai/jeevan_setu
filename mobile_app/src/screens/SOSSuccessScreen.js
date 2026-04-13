import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function SOSSuccessScreen({ navigation, route }) {
  const { disasterType = 'Emergency', lat = 0, lng = 0 } = route?.params || {};

  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const slideAnim   = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();

    // Pulsing ring
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Auto-navigate to Home after 5 seconds
    const timer = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }, 5000);

    return () => {
      pulse.stop();
      clearTimeout(timer);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020507" />

      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

        {/* ── PULSING SUCCESS ICON ─────────────────────────── */}
        <Animated.View style={[styles.outerRing, { transform: [{ scale: pulseAnim }] }]}>
          <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.checkIcon}>✓</Text>
          </Animated.View>
        </Animated.View>

        {/* ── TITLE ───────────────────────────────────────── */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}>
          <Text style={styles.title}>SIGNAL TRANSMITTED</Text>
          <Text style={styles.subtitle}>Emergency dispatch received by Command HQ</Text>
        </Animated.View>

        {/* ── DETAIL CARDS ────────────────────────────────── */}
        <Animated.View style={[styles.detailBox, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>TYPE</Text>
            <Text style={styles.detailValue}>{disasterType.toUpperCase()}</Text>
          </View>
          <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: '#1f2937' }]}>
            <Text style={styles.detailLabel}>COORDINATES</Text>
            <Text style={styles.detailValue}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>
          </View>
          <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: '#1f2937' }]}>
            <Text style={styles.detailLabel}>STATUS</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>PENDING RESPONSE</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── INSTRUCTION ─────────────────────────────────── */}
        <Animated.View style={[styles.infoBox, { opacity: fadeAnim }]}>
          <Text style={styles.infoText}>
            🛰 Rescue teams are being dispatched to your GPS coordinate.{'\n'}
            Stay at your location. Help is on the way.
          </Text>
        </Animated.View>

        {/* ── AUTO-RETURN NOTE ────────────────────────────── */}
        <Text style={styles.autoMsg}>Returning to home in 5 seconds...</Text>

        {/* ── MANUAL RETURN BUTTON ────────────────────────── */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
        >
          <Text style={styles.homeBtnText}>↩ Return to Base</Text>
        </TouchableOpacity>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#020507' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  outerRing: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(16,185,129,0.07)',
    borderWidth: 2, borderColor: 'rgba(16,185,129,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 36,
  },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 2, borderColor: '#10b981',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#10b981', shadowRadius: 30, shadowOpacity: 0.5, elevation: 15,
  },
  checkIcon: { fontSize: 52, color: '#10b981', fontWeight: '900' },

  title:    { color: '#10b981', fontSize: 26, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 10 },
  subtitle: { color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 36 },

  detailBox: {
    width: '100%', backgroundColor: '#0d1117',
    borderRadius: 20, borderWidth: 1, borderColor: '#1f2937',
    overflow: 'hidden', marginBottom: 24,
  },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  detailLabel: { color: '#334155', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  detailValue: { color: 'white', fontSize: 12, fontWeight: '800', fontFamily: 'monospace' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b' },
  statusText:  { color: '#f59e0b', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  infoBox: {
    backgroundColor: 'rgba(16,185,129,0.05)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    padding: 18, marginBottom: 32, width: '100%',
  },
  infoText: { color: '#94a3b8', fontSize: 13, lineHeight: 22, textAlign: 'center' },

  autoMsg:  { color: '#1e293b', fontSize: 11, marginBottom: 24, fontFamily: 'monospace' },

  homeBtn: {
    backgroundColor: '#111827', borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 40, borderWidth: 1, borderColor: '#1f2937',
  },
  homeBtnText: { color: '#64748b', fontWeight: '800', fontSize: 14 },
});
