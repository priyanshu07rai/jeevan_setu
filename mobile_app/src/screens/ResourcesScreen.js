import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GUIDES = [
  {
    icon: '🩸',
    title: 'First Aid: Bleeding',
    severity: 'CRITICAL',
    color: '#ef4444',
    content: 'Apply firm, direct pressure with a clean cloth. Do not remove cloth if blood soaks through — add another on top. Keep pressure for at least 10–15 minutes.',
  },
  {
    icon: '🔥',
    title: 'First Aid: Burns',
    severity: 'HIGH',
    color: '#f59e0b',
    content: 'Cool under cool (not cold) running water for at least 10 minutes. Do NOT pop blisters or apply ice, butter, or toothpaste. Cover loosely with a sterile bandage.',
  },
  {
    icon: '🌍',
    title: 'Earthquake Survival',
    severity: 'HIGH',
    color: '#f59e0b',
    content: 'DROP, COVER, and HOLD ON. Get under a sturdy desk or table. Stay away from windows, doors, and walls. Do not run outside during shaking.',
  },
  {
    icon: '🌊',
    title: 'Flood Evacuation',
    severity: 'CRITICAL',
    color: '#3b82f6',
    content: 'Move to higher ground immediately. Never walk, swim, or drive through flood water. Six inches of moving water can knock you off your feet.',
  },
  {
    icon: '💨',
    title: 'Smoke & Fire Escape',
    severity: 'HIGH',
    color: '#f97316',
    content: 'Stay low — smoke rises. Crawl to the nearest exit. Test doors before opening. If clothes catch fire: STOP, DROP, and ROLL. Never use elevators.',
  },
  {
    icon: '🏥',
    title: 'CPR Basics',
    severity: 'CRITICAL',
    color: '#10b981',
    content: 'Call for help first. Place hands on center of chest. Push hard and fast — 100–120 compressions/min at 2 inches depth. If trained, give 2 rescue breaths every 30 compressions.',
  },
  {
    icon: '🥤',
    title: 'Water Purification',
    severity: 'MEDIUM',
    color: '#8b5cf6',
    content: 'Boil water for at least 1 minute (3 minutes at altitude). If no fuel: use 2 drops of unscented household bleach per litre, wait 30 minutes before drinking.',
  },
  {
    icon: '🧭',
    title: 'Signal for Rescue',
    severity: 'MEDIUM',
    color: '#64748b',
    content: 'Use a mirror to reflect sunlight. Blow a whistle in 3 blasts. Create a large X on the ground with rocks or logs. Stay in an open area visible from above.',
  },
];

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };

// ─── GUIDE CARD ───────────────────────────────────────────────────────────────
const GuideCard = ({ guide, index, expanded, onToggle }) => {
  const anim    = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.timing(heightAnim, { toValue: expanded ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  }, [expanded]);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      <TouchableOpacity
        style={[styles.guideCard, expanded && { borderColor: guide.color + '55' }]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <View style={styles.guideTop}>
          <View style={[styles.guideIconBox, { backgroundColor: guide.color + '15' }]}>
            <Text style={styles.guideIcon}>{guide.icon}</Text>
          </View>
          <View style={styles.guideInfo}>
            <Text style={styles.guideTitle}>{guide.title}</Text>
            <View style={[styles.severityBadge, { backgroundColor: guide.color + '20', borderColor: guide.color + '40' }]}>
              <Text style={[styles.severityText, { color: guide.color }]}>{guide.severity}</Text>
            </View>
          </View>
          <Text style={[styles.chevron, expanded && { transform: [{ rotate: '90deg' }] }]}>›</Text>
        </View>

        {expanded && (
          <View style={[styles.guideBody, { borderTopColor: guide.color + '30' }]}>
            <Text style={styles.guideContent}>{guide.content}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── RESOURCES SCREEN ────────────────────────────────────────────────────────
export default function ResourcesScreen({ navigation }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [filter, setFilter]           = useState('ALL');

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const filters = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'];
  const filtered = GUIDES
    .filter(g => filter === 'ALL' || g.severity === filter)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* ─── HEADER ─── */}
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Survival Manuals</Text>
          <Text style={styles.headerSub}>OFFLINE CACHED · NO INTERNET REQUIRED</Text>
        </View>
        <View style={styles.offlineBadge}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineBadgeText}>LOCAL</Text>
        </View>
      </Animated.View>

      {/* ─── FILTER BAR ─── */}
      <View style={styles.filterBar}>
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── COUNT BADGE ─── */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} protocols cached locally</Text>
      </View>

      {/* ─── GUIDES ─── */}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {filtered.map((g, i) => (
          <GuideCard
            key={g.title}
            guide={g}
            index={i}
            expanded={expandedIdx === i}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
          />
        ))}

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            🛡️ These protocols are saved locally on device and do not require any network connection.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const SEVERITY_COLOR = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#8b5cf6' };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080b10' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f2937', gap: 14 },
  backBtn: { backgroundColor: '#111827', padding: 8, borderRadius: 10 },
  backText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: 'white' },
  headerSub: { color: '#334155', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  offlineBadgeText: { color: '#10b981', fontSize: 9, fontWeight: '900', letterSpacing: 2 },

  filterBar: { flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#1f2937' },
  filterBtnActive: { backgroundColor: 'rgba(232,99,10,0.12)', borderColor: 'rgba(232,99,10,0.4)' },
  filterText: { color: '#334155', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  filterTextActive: { color: '#e8630a' },

  countRow: { paddingHorizontal: 20, marginBottom: 4 },
  countText: { color: '#1f2937', fontSize: 11, fontWeight: '700' },

  scroll: { padding: 18, paddingBottom: 60 },

  guideCard: {
    backgroundColor: '#0d1117', borderRadius: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#1f2937', overflow: 'hidden',
  },
  guideTop: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  guideIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  guideIcon: { fontSize: 24 },
  guideInfo: { flex: 1, gap: 7 },
  guideTitle: { color: 'white', fontSize: 15, fontWeight: '900' },
  severityBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  severityText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  chevron: { color: '#334155', fontSize: 22, fontWeight: '900' },

  guideBody: { padding: 20, paddingTop: 16, borderTopWidth: 1 },
  guideContent: { color: '#94a3b8', fontSize: 14, lineHeight: 24 },

  footerNote: { backgroundColor: 'rgba(16,185,129,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)', padding: 18, marginTop: 6 },
  footerNoteText: { color: '#475569', fontSize: 12, lineHeight: 20, textAlign: 'center' },
});
