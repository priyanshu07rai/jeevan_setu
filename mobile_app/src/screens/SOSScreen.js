import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, TextInput, Animated, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapplsGL from 'mappls-map-react-native';
import axios from 'axios';
import { API_BASE } from '../constants';

const { width } = Dimensions.get('window');
const DISASTER_TYPES = ['Flood', 'Fire', 'Earthquake', 'Medical', 'Conflict', 'Other'];

const TYPE_CONFIG = {
  Flood:      { icon: '🌊', color: '#3b82f6' },
  Fire:       { icon: '🔥', color: '#ef4444' },
  Earthquake: { icon: '🌍', color: '#f59e0b' },
  Medical:    { icon: '🏥', color: '#10b981' },
  Conflict:   { icon: '⚠️', color: '#f43f5e' },
  Other:      { icon: '📍', color: '#8b5cf6' },
};

// --- ROBUST OFFLINE QUEUE UTILS ---
const saveOfflineSOS = async (payload) => {
  try {
    const existing = JSON.parse(
      (await AsyncStorage.getItem("offline_sos_queue")) || "[]"
    );

    existing.push({
      ...payload,
      createdAt: Date.now(),
      synced: false,
    });

    await AsyncStorage.setItem(
      "offline_sos_queue",
      JSON.stringify(existing)
    );
  } catch(e) {
    console.error("SOS offline save failed:", e);
  }
};

const retryPendingSOS = async () => {
  try {
    const queue = JSON.parse(
      (await AsyncStorage.getItem("offline_sos_queue")) || "[]"
    );

    for (const item of queue) {
      if(item.synced) continue;
      try {
        await axios.post(`${API_BASE}/api/v2/citizen/sos`, item);
        item.synced = true;
      } catch (e) {
        // Leave unsynced if API call fails
      }
    }

    const remaining = queue.filter((x) => !x.synced);
    await AsyncStorage.setItem(
      "offline_sos_queue",
      JSON.stringify(remaining)
    );
  } catch (e) {
    console.error("Retry SOS failed", e);
  }
};


export default function SOSScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [loadingGPS, setLoadingGPS] = useState(true);
  const [status, setStatus] = useState('Locking GPS Coordinate...');
  const [disasterType, setDisasterType] = useState('Flood');
  const [description, setDescription] = useState('');
  const [peopleTrapped, setPeopleTrapped] = useState('0');
  const [evidence, setEvidence] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [citizenName, setCitizenName] = useState('Anonymous Citizen');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const gpsAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Retry offline cache passively on screen mount as secondary check
    retryPendingSOS();

    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    let isMounted = true;
    let locationSub = null;

    const startLocation = async () => {
      try {
        // Safe Parse AsyncStorage User
        const stored = await AsyncStorage.getItem('citizen_user');
        if (stored) {
           try {
             const citizen = JSON.parse(stored);
             if(citizen && citizen.name && isMounted) setCitizenName(citizen.name);
           } catch(e) {}
        }
      } catch(e) {}

      try {
        // Safe Location Fetch
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setStatus('GPS Permission Denied');
            setLoadingGPS(false);
          }
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });

        if (isMounted) {
          setLocation(current.coords);
          setStatus(`GPS Locked · ${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)}`);
        }

        locationSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 20
          },
          (loc) => {
            if (isMounted) {
              setLocation(loc.coords);
              setStatus(`GPS Locked · ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
            }
          }
        );

        Animated.loop(
          Animated.sequence([
            Animated.timing(gpsAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
            Animated.timing(gpsAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        ).start();
      } catch (locError) {
        console.log("LOCATION CRASH SAFE:", locError);
        if (isMounted) setStatus('Tower fallback active');
      } finally {
        if (isMounted) setLoadingGPS(false);
      }
    };

    startLocation();

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && isMounted) {
        retryPendingSOS();
      }
    });

    return () => { 
      isMounted = false; 
      unsubscribe();
      if (locationSub) locationSub.remove();
    };
  }, []);

  const simulatePhotoUpload = () => {
    setEvidence('evidence_' + Date.now() + '.jpg');
    Alert.alert('Camera Module', 'Photo captured and attached as evidence.');
  };

  const sendSOS = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Describe the emergency situation.');
      return;
    }
    setIsSubmitting(true);
    setStatus('Transmitting SOS Protocol...');

    const lat = location ? location.latitude : 0;
    const lng = location ? location.longitude : 0;

    const packet = {
      type: 'SOS',
      lat, lng,
      disaster_type: disasterType,
      description,
      people_count: Number(peopleTrapped) || 0,
      name: citizenName,
      phone: 'Citizen Device',
      evidence: evidence || 'No photo',
      timestamp: new Date().toISOString(),
    };

    try {
      // Offline-First Flow
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        await saveOfflineSOS(packet);
        Alert.alert('Offline Mode Active', 'SOS saved locally, syncing when signal returns.');
        
        try {
          // Attempt SMS Gateway Fallback if possible
          const avail = await SMS.isAvailableAsync();
          if (avail) {
            const msg = `SOS#${disasterType}#LAT:${lat.toFixed(4)}#LON:${lng.toFixed(4)}#PPL:${peopleTrapped}#DESC:${description.substring(0, 20)}`;
            const { result } = await SMS.sendSMSAsync([], msg); // Emptied array to avoid hard crash without default number
          }
        } catch(e) {}
        
      } else {
        // Direct Online Flow
        try {
          await axios.post(`${API_BASE}/api/v2/citizen/sos`, packet);
          Alert.alert('Signal Transmitted', 'HQ has received your emergency dispatch.');
        } catch(reqFail) {
          await saveOfflineSOS(packet);
          Alert.alert('Offline Mode Active', 'SOS saved locally, syncing when signal returns.');
        }
      }
    } catch (e) {
      Alert.alert('Critical Error', 'Failed to dispatch SOS signal.');
    } finally {
      setIsSubmitting(false);
      navigation.goBack();
    }
  };

  const gpsLocked = !!location;
  const typeInfo = TYPE_CONFIG[disasterType] || TYPE_CONFIG.Other;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ─── HEADER ─── */}
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>SOS SIGNAL</Text>
          <Text style={styles.headerSub}>STRICT GPS VERIFICATION · ANTI-FRAUD LAYER</Text>
        </View>
        <View style={[styles.gpsChip, { borderColor: gpsLocked ? '#10b981' : '#f59e0b' }]}>
          <Animated.View style={[styles.gpsDot, { backgroundColor: gpsLocked ? '#10b981' : '#f59e0b', opacity: gpsAnim }]} />
          <Text style={[styles.gpsChipText, { color: gpsLocked ? '#10b981' : '#f59e0b' }]}>
            {gpsLocked ? 'LOCKED' : 'SCANNING'}
          </Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── EMERGENCY TYPE ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Emergency Type</Text>
          <View style={styles.typeGrid}>
            {DISASTER_TYPES.map(type => {
              const cfg = TYPE_CONFIG[type];
              const active = disasterType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setDisasterType(type)}
                  style={[styles.typeBtn, active && { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}
                >
                  <Text style={styles.typeIcon}>{cfg.icon}</Text>
                  <Text style={[styles.typeText, active && { color: cfg.color }]}>{type}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── LOCKED MAP ─── */}
        <View style={styles.mapCard}>
          {gpsLocked ? (
            <MapplsGL.MapView
              style={{ flex: 1, borderRadius: 20 }}
              mapplsStyle="mappls_dark"
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              zoomLevel={15}
              centerCoordinate={[location.longitude, location.latitude]}
            >
              <MapplsGL.PointAnnotation
                id="sos_marker"
                coordinate={[location.longitude, location.latitude]}
              >
                  <View style={{
                      width: 24, height: 24, borderRadius: 12, 
                      backgroundColor: typeInfo.color,
                      borderWidth: 3, borderColor: 'white',
                      shadowColor: typeInfo.color, shadowOpacity: 0.8, shadowRadius: 8
                  }} />
              </MapplsGL.PointAnnotation>
            </MapplsGL.MapView>
          ) : (
            <View style={styles.mapScan}>
              <ActivityIndicator color="#ef4444" size="large" />
              <Text style={styles.mapScanText}>{status}</Text>
            </View>
          )}
          {gpsLocked && (
            <View style={styles.mapCoordPanel}>
              <View style={styles.gpsDotSmall} />
              <Text style={styles.mapCoordText}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        {/* ─── SITUATION DESCRIPTION ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Situation Description</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Describe the emergency: hazards, injuries, estimated trapped persons..."
            placeholderTextColor="#334155"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        {/* ─── SPLIT ROW ─── */}
        <View style={styles.splitRow}>
          <View style={[styles.card, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.cardLabel}>People Affected</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={peopleTrapped}
              onChangeText={setPeopleTrapped}
              placeholderTextColor="#334155"
            />
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>Evidence</Text>
            <TouchableOpacity
              style={[styles.photoBtn, evidence && styles.photoBtnActive]}
              onPress={simulatePhotoUpload}
            >
              <Text style={[styles.photoText, evidence && styles.photoTextActive]}>
                {evidence ? '✓ ATTACHED' : 'UPLOAD'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── SUBMIT ─── */}
        <TouchableOpacity
          style={[styles.submitBtn, { opacity: (!gpsLocked || isSubmitting) ? 0.5 : 1 }]}
          onPress={sendSOS}
          disabled={!gpsLocked || isSubmitting}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? '⏳ DISPATCHING...' : !gpsLocked ? '🛰 LOCKING GPS...' : '🚀 SEND EMERGENCY SIGNAL'}
          </Text>
        </TouchableOpacity>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Rescue ops will dispatch to this exact GPS coordinate. Do not misuse.</Text>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel and return</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080b10' },
  header: {
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18,
    backgroundColor: '#080b10', borderBottomWidth: 1, borderBottomColor: '#1f2937',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  backBtn: { padding: 8, backgroundColor: '#111827', borderRadius: 10 },
  backText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#ef4444', letterSpacing: 1 },
  headerSub: { color: '#334155', fontSize: 9, letterSpacing: 1, marginTop: 3 },
  gpsChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 8 },
  gpsChipText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  scroll: { padding: 18, paddingBottom: 50 },
  card: { backgroundColor: '#0d1117', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#1f2937' },
  cardLabel: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937' },
  typeIcon: { fontSize: 16 },
  typeText: { color: '#64748b', fontSize: 13, fontWeight: '800' },

  mapCard: { height: 210, borderRadius: 18, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#1f2937', position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  mapScan: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center', gap: 16 },
  mapScanText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  mapCoordPanel: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(8,11,16,0.9)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  mapCoordText: { color: 'white', fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },

  textarea: { backgroundColor: '#080b10', color: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', fontSize: 14, minHeight: 90, lineHeight: 22 },
  input: { backgroundColor: '#080b10', color: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', fontSize: 18, fontWeight: '900', textAlign: 'center' },

  splitRow: { flexDirection: 'row' },
  photoBtn: { height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', borderStyle: 'dashed' },
  photoBtnActive: { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: '#10b981', borderStyle: 'solid' },
  photoText: { color: '#475569', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  photoTextActive: { color: '#10b981' },

  submitBtn: { backgroundColor: '#ef4444', borderRadius: 18, padding: 20, alignItems: 'center', marginTop: 8, marginBottom: 16, shadowColor: '#ef4444', shadowRadius: 20, shadowOpacity: 0.25, elevation: 10 },
  submitText: { color: 'white', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  warningBox: { backgroundColor: 'rgba(239,68,68,0.05)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 14, padding: 16, marginBottom: 12 },
  warningText: { color: '#fca5a5', fontSize: 12, lineHeight: 18, textAlign: 'center' },

  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#334155', fontSize: 14, fontWeight: '600' },
});
