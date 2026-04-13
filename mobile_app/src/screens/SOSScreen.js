import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, TextInput, Animated, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import { API_BASE } from '../constants';

const { width } = Dimensions.get('window');
const DISASTER_TYPES = ['Flood', 'Fire', 'Earthquake', 'Medical', 'Conflict', 'Other'];

// --- LEAFLET HTML TEMPLATE ---
const getLeafletHTML = (lat, lng, color) => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { margin: 0; padding: 0; background-color: #080b10; }
        #map { height: 100vh; width: 100vw; }
        .leaflet-container { background: #080b10 !important; }
        .emergency-marker {
            width: 14px; height: 14px; border-radius: 50%;
            background: ${color}; border: 3px solid white;
            box-shadow: 0 0 15px ${color}; position: relative;
        }
        .pulse {
            position: absolute; width: 100%; height: 100%; border-radius: 50%;
            background: ${color}; opacity: 0.6;
            animation: pulse-animation 2s infinite;
        }
        @keyframes pulse-animation {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(3.5); opacity: 0; }
        }
        .leaflet-control-attribution { display: none !important; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 16);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
        var icon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="emergency-marker"><div class="pulse"></div></div>',
            iconSize: [14, 14], iconAnchor: [7, 7]
        });
        L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
    </script>
</body>
</html>
`;

const TYPE_CONFIG = {
  Flood:      { icon: '🌊', color: '#3b82f6' },
  Fire:       { icon: '🔥', color: '#ef4444' },
  Earthquake: { icon: '🌍', color: '#f59e0b' },
  Medical:    { icon: '🏥', color: '#10b981' },
  Conflict:   { icon: '⚠️', color: '#f43f5e' },
  Other:      { icon: '📍', color: '#8b5cf6' },
};

// --- OFFLINE QUEUE ---
const saveOfflineSOS = async (payload) => {
  try {
    const existing = JSON.parse((await AsyncStorage.getItem('offline_sos_queue')) || '[]');
    existing.push({ ...payload, createdAt: Date.now(), synced: false });
    await AsyncStorage.setItem('offline_sos_queue', JSON.stringify(existing));
  } catch (e) { console.error('SOS offline save failed:', e); }
};

const retryPendingSOS = async () => {
  try {
    const queue = JSON.parse((await AsyncStorage.getItem('offline_sos_queue')) || '[]');
    for (const item of queue) {
      if (item.synced) continue;
      try {
        await axios.post(`${API_BASE}/api/v2/citizen/sos`, item);
        item.synced = true;
      } catch (_) {}
    }
    const remaining = queue.filter(x => !x.synced);
    await AsyncStorage.setItem('offline_sos_queue', JSON.stringify(remaining));
  } catch (e) { console.error('Retry SOS failed', e); }
};


export default function SOSScreen({ navigation }) {
  const [location, setLocation]           = useState(null);
  const [loadingGPS, setLoadingGPS]       = useState(true);
  const [status, setStatus]               = useState('Locking GPS Coordinate...');
  const [disasterType, setDisasterType]   = useState('Flood');
  const [description, setDescription]     = useState('');
  const [peopleTrapped, setPeopleTrapped] = useState('0');
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [citizenName, setCitizenName]     = useState('Anonymous Citizen');

  // Evidence states
  const [evidenceUri, setEvidenceUri]         = useState(null);   // local file URI
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceStatus, setEvidenceStatus]   = useState('');     // '' | 'attached' | 'error'

  const headerAnim = useRef(new Animated.Value(0)).current;
  const gpsAnim    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    retryPendingSOS();
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    let isMounted = true;
    let locationSub = null;

    const startLocation = async () => {
      try {
        const stored = await AsyncStorage.getItem('citizen_user');
        if (stored) {
          try {
            const citizen = JSON.parse(stored);
            if (citizen?.name && isMounted) setCitizenName(citizen.name);
          } catch (_) {}
        }
      } catch (_) {}

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) { setStatus('GPS Permission Denied'); setLoadingGPS(false); }
          return;
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (isMounted) {
          setLocation(current.coords);
          setStatus(`GPS Locked · ${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)}`);
        }
        locationSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 20 },
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
            Animated.timing(gpsAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
          ])
        ).start();
      } catch (locError) {
        console.log('LOCATION CRASH SAFE:', locError);
        if (isMounted) setStatus('Tower fallback active');
      } finally {
        if (isMounted) setLoadingGPS(false);
      }
    };

    startLocation();

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && isMounted) retryPendingSOS();
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (locationSub) locationSub.remove();
    };
  }, []);

  // ─── REAL EVIDENCE PICKER ──────────────────────────────────────────────────
  const pickEvidence = async () => {
    try {
      // Ask permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow photo library access to attach evidence.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Try Camera Instead',
              onPress: pickFromCamera,
            },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setEvidenceUri(result.assets[0].uri);
        setEvidenceStatus('attached');
      }
    } catch (e) {
      console.log('Gallery picker error:', e);
      setEvidenceStatus('error');
      Alert.alert('Upload Failed', 'Could not open gallery. Try camera instead.');
    }
  };

  const pickFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to capture evidence.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setEvidenceUri(result.assets[0].uri);
        setEvidenceStatus('attached');
      }
    } catch (e) {
      console.log('Camera error:', e);
      Alert.alert('Camera Failed', 'Could not open camera.');
    }
  };

  const handleEvidencePress = () => {
    Alert.alert(
      '📸 Attach Evidence',
      'Choose evidence source',
      [
        { text: '📷 Camera', onPress: pickFromCamera },
        { text: '🖼 Gallery', onPress: pickEvidence },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const removeEvidence = () => {
    setEvidenceUri(null);
    setEvidenceStatus('');
  };

  // ─── SOS SUBMISSION ────────────────────────────────────────────────────────
  const sendSOS = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Describe the emergency situation.');
      return;
    }
    setIsSubmitting(true);
    setStatus('Transmitting SOS Protocol...');

    const lat = location ? location.latitude  : 0;
    const lng = location ? location.longitude : 0;

    try {
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        // --- OFFLINE: JSON queue (no file upload offline) ---
        const packet = {
          disaster_type: disasterType, lat, lng,
          description, people_count: Number(peopleTrapped) || 0,
          name: citizenName, phone: 'Citizen Device',
          evidence: evidenceUri ? 'photo_pending_sync' : 'No photo',
          timestamp: new Date().toISOString(),
        };
        await saveOfflineSOS(packet);
        Alert.alert('Offline Mode Active', 'SOS saved locally. Will auto-sync when signal returns.');

        try {
          const avail = await SMS.isAvailableAsync();
          if (avail) {
            const msg = `SOS#${disasterType}#LAT:${lat.toFixed(4)}#LON:${lng.toFixed(4)}#PPL:${peopleTrapped}#DESC:${description.substring(0, 20)}`;
            await SMS.sendSMSAsync([], msg);
          }
        } catch (_) {}

      } else {
        // --- ONLINE: multipart FormData if image, else JSON ---
        try {
          if (evidenceUri) {
            // Multipart upload — backend /api/v2/report handles evidence_file field
            const formData = new FormData();
            formData.append('disaster_type', disasterType);
            formData.append('lat',           String(lat));
            formData.append('lng',           String(lng));
            formData.append('description',   description);
            formData.append('people_count',  String(Number(peopleTrapped) || 0));
            formData.append('name',          citizenName);
            formData.append('phone',         'Citizen Device');
            formData.append('evidence_file', {
              uri:  evidenceUri,
              name: `evidence_${Date.now()}.jpg`,
              type: 'image/jpeg',
            });

            await axios.post(`${API_BASE}/api/v2/report`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 20000,
            });
          } else {
            // JSON fallback — no image
            await axios.post(`${API_BASE}/api/v2/report`, {
              disaster_type: disasterType, lat, lng,
              description,
              people_count: Number(peopleTrapped) || 0,
              name: citizenName,
              phone: 'Citizen Device',
              evidence: 'No photo attached',
            }, { timeout: 15000 });
          }

          Alert.alert('✅ Signal Transmitted', 'HQ has received your emergency dispatch.');
        } catch (reqFail) {
          console.log('SOS API fail, queuing offline:', reqFail?.message);
          const packet = {
            disaster_type: disasterType, lat, lng,
            description, people_count: Number(peopleTrapped) || 0,
            name: citizenName, phone: 'Citizen Device',
            evidence: 'No photo', timestamp: new Date().toISOString(),
          };
          await saveOfflineSOS(packet);
          Alert.alert('Offline Fallback', 'SOS saved locally, will retry when signal returns.');
        }
      }
    } catch (e) {
      Alert.alert('Critical Error', 'Failed to dispatch SOS signal.');
    } finally {
      setIsSubmitting(false);
      // Navigate to success screen instead of going back
      navigation.replace('SOSSuccess', {
        disasterType,
        lat,
        lng,
      });
    }
  };

  const gpsLocked = !!location;
  const typeInfo  = TYPE_CONFIG[disasterType] || TYPE_CONFIG.Other;

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
              const cfg    = TYPE_CONFIG[type];
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

        {/* ─── MAP ─── */}
        <View style={styles.mapCard}>
          {gpsLocked ? (
            <WebView
              style={{ flex: 1, borderRadius: 20 }}
              originWhitelist={['*']}
              source={{ html: getLeafletHTML(location.latitude, location.longitude, typeInfo.color) }}
              scrollEnabled={false}
              pointerEvents="none"
            />
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

        {/* ─── SPLIT ROW: People + Evidence ─── */}
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

          {/* Evidence Upload Card */}
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>Evidence</Text>

            {evidenceUri ? (
              // ── THUMBNAIL PREVIEW ──────────────────────────────
              <View style={styles.thumbContainer}>
                <Image source={{ uri: evidenceUri }} style={styles.thumb} resizeMode="cover" />
                <TouchableOpacity style={styles.thumbRemove} onPress={removeEvidence}>
                  <Text style={styles.thumbRemoveText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.thumbBadge}>
                  <Text style={styles.thumbBadgeText}>✓ ATTACHED</Text>
                </View>
              </View>
            ) : (
              // ── UPLOAD BUTTON ──────────────────────────────────
              <TouchableOpacity
                style={[styles.photoBtn, evidenceUploading && { opacity: 0.5 }]}
                onPress={handleEvidencePress}
                disabled={evidenceUploading}
              >
                {evidenceUploading ? (
                  <ActivityIndicator color="#e8630a" size="small" />
                ) : (
                  <Text style={styles.photoText}>📷 UPLOAD</Text>
                )}
              </TouchableOpacity>
            )}

            {evidenceStatus === 'error' && (
              <Text style={styles.uploadErrText}>Upload failed. Try again.</Text>
            )}
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
  safe:   { flex: 1, backgroundColor: '#080b10' },
  header: {
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18,
    backgroundColor: '#080b10', borderBottomWidth: 1, borderBottomColor: '#1f2937',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  backBtn:      { padding: 8, backgroundColor: '#111827', borderRadius: 10 },
  backText:     { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  headerTitle:  { fontSize: 18, fontWeight: '900', color: '#ef4444', letterSpacing: 1 },
  headerSub:    { color: '#334155', fontSize: 9, letterSpacing: 1, marginTop: 3 },
  gpsChip:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  gpsDot:       { width: 8, height: 8, borderRadius: 4 },
  gpsDotSmall:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 8 },
  gpsChipText:  { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  scroll:    { padding: 18, paddingBottom: 50 },
  card:      { backgroundColor: '#0d1117', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#1f2937' },
  cardLabel: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937' },
  typeIcon: { fontSize: 16 },
  typeText: { color: '#64748b', fontSize: 13, fontWeight: '800' },

  mapCard:        { height: 210, borderRadius: 18, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#1f2937', position: 'relative' },
  mapScan:        { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center', gap: 16 },
  mapScanText:    { color: '#475569', fontSize: 12, fontWeight: '700' },
  mapCoordPanel:  { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(8,11,16,0.9)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  mapCoordText:   { color: 'white', fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },

  textarea: { backgroundColor: '#080b10', color: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', fontSize: 14, minHeight: 90, lineHeight: 22 },
  input:    { backgroundColor: '#080b10', color: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', fontSize: 18, fontWeight: '900', textAlign: 'center' },

  splitRow: { flexDirection: 'row' },

  // Evidence upload
  photoBtn:    { height: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937', borderStyle: 'dashed' },
  photoText:   { color: '#e8630a', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  uploadErrText: { color: '#f43f5e', fontSize: 9, marginTop: 6, textAlign: 'center' },

  // Thumbnail preview
  thumbContainer: { height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  thumb:          { width: '100%', height: '100%' },
  thumbRemove:    { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  thumbRemoveText:{ color: 'white', fontSize: 10, fontWeight: '900' },
  thumbBadge:     { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(16,185,129,0.9)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  thumbBadgeText: { color: 'white', fontSize: 8, fontWeight: '900' },

  submitBtn:  { backgroundColor: '#ef4444', borderRadius: 18, padding: 20, alignItems: 'center', marginTop: 8, marginBottom: 16, shadowColor: '#ef4444', shadowRadius: 20, shadowOpacity: 0.25, elevation: 10 },
  submitText: { color: 'white', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  warningBox:  { backgroundColor: 'rgba(239,68,68,0.05)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 14, padding: 16, marginBottom: 12 },
  warningText: { color: '#fca5a5', fontSize: 12, lineHeight: 18, textAlign: 'center' },

  cancelBtn:  { padding: 16, alignItems: 'center' },
  cancelText: { color: '#334155', fontSize: 14, fontWeight: '600' },
});
