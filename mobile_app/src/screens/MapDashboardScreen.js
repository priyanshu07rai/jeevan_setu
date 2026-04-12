import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapplsGL from 'mappls-map-react-native';
import axios from 'axios';
import { API_BASE } from '../constants';

const STATUS_CONFIG = {
  RESOLVED:   { color: '#10b981', label: 'Resolved', dot: '#10b981' },
  ACTIVE:     { color: '#3b82f6', label: 'Active',   dot: '#3b82f6' },
  DISPATCHED: { color: '#f59e0b', label: 'Dispatched', dot: '#f59e0b' },
  NEW:        { color: '#f43f5e', label: 'New',      dot: '#f43f5e' },
  REPORTED:   { color: '#ef4444', label: 'Reported', dot: '#ef4444' },
};

const getStatus = (s) => STATUS_CONFIG[s] || STATUS_CONFIG.NEW;

// ─── FEED ITEM ────────────────────────────────────────────────────────────────
const FeedItem = ({ d, index }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }).start();
  }, []);

  const st = getStatus(d.status);

  return (
    <Animated.View style={[styles.feedRow, { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <View style={[styles.feedDot, { backgroundColor: st.dot }]} />
      <View style={styles.feedInfo}>
        <View style={styles.feedTopRow}>
          <Text style={[styles.feedType, { color: st.color }]}>{d.type || d.disaster_type}</Text>
          <View style={[styles.feedBadge, { backgroundColor: st.color + '22', borderColor: st.color + '44' }]}>
            <Text style={[styles.feedBadgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.feedDesc} numberOfLines={1}>
          {d.description ? d.description.replace(/\n/g, ' ') : '—'}
        </Text>
      </View>
      <Text style={styles.feedTime}>
        {d.created_at ? d.created_at.split('T')[1]?.substring(0, 5) : '--:--'}
      </Text>
    </Animated.View>
  );
};

// ─── MAP DASHBOARD SCREEN ────────────────────────────────────────────────────
export default function MapDashboardScreen({ navigation }) {
  const [disasters, setDisasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('map');

  const active   = disasters.filter(d => d.status !== 'RESOLVED');
  const resolved = disasters.filter(d => d.status === 'RESOLVED');

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v2/disasters`);
      setDisasters(res.data || []);
    } catch (e) {
      console.log('Failed to load dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, []);

  const region = {
    latitude:      active.length > 0 ? active[0].lat : 26.7606,
    longitude:     active.length > 0 ? active[0].lon : 83.3732,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ─── HEADER ─── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack?.()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Operational Dashboard</Text>
          <Text style={styles.headerSub}>REAL-TIME MESH INTELLIGENCE · SECURE FEED</Text>
        </View>
        {loading && <ActivityIndicator color="#e8630a" size="small" />}
      </View>

      {/* ─── STAT ROW ─── */}
      <View style={styles.statRow}>
        <View style={[styles.statChip, { borderColor: '#f43f5e44', backgroundColor: 'rgba(244,63,94,0.05)' }]}>
          <Text style={[styles.statChipNum, { color: '#f43f5e' }]}>{active.length}</Text>
          <Text style={styles.statChipLabel}>PENDING</Text>
        </View>
        <View style={[styles.statChip, { borderColor: '#10b98144', backgroundColor: 'rgba(16,185,129,0.05)' }]}>
          <Text style={[styles.statChipNum, { color: '#10b981' }]}>{resolved.length}</Text>
          <Text style={styles.statChipLabel}>RESOLVED</Text>
        </View>
        <View style={[styles.statChip, { borderColor: '#3b82f644', backgroundColor: 'rgba(59,130,246,0.05)' }]}>
          <Text style={[styles.statChipNum, { color: '#3b82f6' }]}>{disasters.length}</Text>
          <Text style={styles.statChipLabel}>TOTAL</Text>
        </View>
      </View>

      {/* ─── TAB BAR ─── */}
      <View style={styles.tabBar}>
        {['map', 'feed'].map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'map' ? '🗺 Live Map' : '⚡ Intel Feed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── MAP TAB ─── */}
      {activeTab === 'map' && (
        <View style={styles.mapContainer}>
          {disasters.length === 0 && loading ? (
            <View style={styles.mapLoader}><ActivityIndicator color="#10b981" size="large" /></View>
          ) : (
            <MapplsGL.MapView
              style={styles.map}
              mapplsStyle="mappls_dark"
            >
              <MapplsGL.Camera
                zoomLevel={12}
                centerCoordinate={[region.longitude, region.latitude]}
              />
              {disasters.map(d => (
                <MapplsGL.PointAnnotation
                  key={d.id}
                  id={`marker-${d.id}`}
                  coordinate={[d.lon, d.lat]}
                  title={d.type || d.disaster_type}
                  snippet={d.status}
                >
                  <View style={{
                      width: 16, height: 16, borderRadius: 8, 
                      backgroundColor: getStatus(d.status).dot,
                      borderWidth: 2, borderColor: 'white',
                  }} />
                </MapplsGL.PointAnnotation>
              ))}
            </MapplsGL.MapView>
          )}
          {/* Legend */}
          <View style={styles.mapLegend}>
            {Object.entries(STATUS_CONFIG).slice(0, 3).map(([key, cfg]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cfg.dot }]} />
                <Text style={styles.legendText}>{cfg.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ─── FEED TAB ─── */}
      {activeTab === 'feed' && (
        <ScrollView contentContainerStyle={styles.feedScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.feedHeader}>⏱ INTELLIGENCE FEED</Text>
          {disasters.length === 0 && !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No active signals detected.</Text>
            </View>
          ) : (
            disasters.slice(0, 25).map((d, i) => <FeedItem key={d.id} d={d} index={i} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080b10' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f2937', gap: 14 },
  backBtn: { backgroundColor: '#111827', padding: 8, borderRadius: 10 },
  backText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: 'white' },
  headerSub: { color: '#334155', fontSize: 9, letterSpacing: 1, marginTop: 2 },

  statRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statChip: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center' },
  statChipNum: { fontSize: 28, fontWeight: '900' },
  statChipLabel: { color: '#475569', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 4 },

  tabBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#1f2937', alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(232,99,10,0.12)', borderColor: 'rgba(232,99,10,0.3)' },
  tabText: { color: '#475569', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: '#e8630a' },

  mapContainer: { flex: 1, margin: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1f2937', position: 'relative' },
  map: { flex: 1 },
  mapLoader: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  mapLegend: { position: 'absolute', bottom: 16, left: 16, backgroundColor: 'rgba(8,11,16,0.9)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1f2937', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },

  feedScroll: { padding: 16, paddingBottom: 50 },
  feedHeader: { color: '#334155', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 16 },
  feedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#0d1117', gap: 14 },
  feedDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  feedInfo: { flex: 1 },
  feedTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
  feedType: { fontSize: 14, fontWeight: '900' },
  feedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  feedBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  feedDesc: { color: '#475569', fontSize: 12 },
  feedTime: { color: '#334155', fontSize: 11, fontFamily: 'monospace' },

  emptyBox: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: '#334155', fontSize: 14 },
});

const mapDarkStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1f2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252c3b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
];
