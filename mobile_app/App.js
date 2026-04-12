/**
 * App.js — JeevanSetu Disaster Platform
 * 
 * Global Broadcast Notification System:
 *   - Requests phone notification permissions on launch
 *   - Polls /broadcast/latest every 15 s (foreground)
 *   - Registers a Background Fetch task that runs every ~15 min (background / killed)
 *   - Fires a real Android / iOS system notification + shows in-app modal
 */

import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
// import * as TaskManager from 'expo-task-manager';
// import * as BackgroundFetch from 'expo-background-fetch';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  StatusBar, Modal, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen         from './src/screens/HomeScreen';
import SOSScreen          from './src/screens/SOSScreen';
import ResourcesScreen    from './src/screens/ResourcesScreen';
import DonorScreen        from './src/screens/DonorScreen';
import MapDashboardScreen from './src/screens/MapDashboardScreen';
import LoginScreen        from './src/screens/LoginScreen';

import { initDB, syncOfflineData } from './src/db';
import { API_BASE } from './src/constants';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BROADCAST_TASK   = 'JEEVANSETU_BROADCAST_FETCH';
const Stack            = createStackNavigator();

// ─── NOTIFICATION HANDLER CONFIG ─────────────────────────────────────────────
// Show alert/sound/badge even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── SEEN BROADCAST TRACKER (module scope — survives re-renders) ─────────────
// We track created_at (guaranteed unique per INSERT) to avoid id type-coercion bugs.
let _lastSeenKey = null; // format: "<id>|<created_at>"

// ─── BROADCAST FETCH HELPER ──────────────────────────────────────────────────
async function checkAndNotify() {
  try {
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected) return null;

    const res = await fetch(`${API_BASE}/api/v2/broadcast/latest`);
    if (!res.ok) return null;
    const data = await res.json();

    if (!data?.id) return null;

    // Use id + created_at as composite key to handle both:
    //   • same-id updates (UPSERT backends)
    //   • id type-coercion bugs (number vs string)
    const seenKey = `${data.id}|${data.created_at || ''}`;
    
    const diskLastSeen = await AsyncStorage.getItem("last_broadcast_id");
    console.log(`[Broadcast] poll → seenKey=${seenKey} | diskLastSeen=${diskLastSeen}`);

    if (seenKey !== diskLastSeen && seenKey !== _lastSeenKey) {
      _lastSeenKey = seenKey;
      await AsyncStorage.setItem("last_broadcast_id", seenKey);
      console.log('[Broadcast] NEW broadcast detected! Firing notification...');

      // Fire the real system notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 PRIORITY BROADCAST — Command HQ',
          body:  data.message,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          color:  '#e8630a',
        },
        trigger: null, // fire immediately
      });

      return data; // tell UI to show the in-app modal
    }

    console.log('[Broadcast] Already seen, skipping.');
  } catch (err) {
    console.log('[Broadcast] Poll error:', err.message);
  }
  return null;
}

// ─── BACKGROUND FETCH TASK (TEMPORARILY DISABLED) ──────────────────────────────
// Runs even when the app is terminated / in background
// TaskManager.defineTask(BROADCAST_TASK, async () => {
//   try {
//     await checkAndNotify();
//     return BackgroundFetch.BackgroundFetchResult.NewData;
//   } catch {
//     return BackgroundFetch.BackgroundFetchResult.Failed;
//   }
// });

async function registerBackgroundFetch() {
  // try {
  //   await BackgroundFetch.registerTaskAsync(BROADCAST_TASK, {
  //     minimumInterval: 15 * 60, // 15 minutes (OS enforced minimum)
  //     stopOnTerminate: false,   // keep running after app close (Android)
  //     startOnBoot:    true,     // restart after device reboot (Android)
  //   });
  // } catch (_) {}
}

// ─── BROADCAST MODAL COMPONENT ────────────────────────────────────────────────
function BroadcastModal({ broadcast, onDismiss }) {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!broadcast) return;
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [broadcast]);

  return (
    <Modal visible={!!broadcast} transparent animationType="none" statusBarTranslucent>
      <View style={s.overlay}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          {/* Top accent bar */}
          <View style={s.topBar} />

          {/* Pulsing icon */}
          <View style={s.iconRing}>
            <Animated.View style={[s.iconDot, { opacity: pulseAnim }]} />
            <Text style={s.iconEmoji}>🚨</Text>
          </View>

          <Text style={s.modalTitle}>PRIORITY BROADCAST</Text>
          <Text style={s.modalFrom}>FROM: DISASTER INTEL COMMAND CENTER</Text>

          <View style={s.divider} />
          <Text style={s.modalMessage}>{broadcast?.message}</Text>
          <View style={s.divider} />

          <Text style={s.modalTime}>Received: {new Date().toLocaleTimeString()}</Text>

          <TouchableOpacity style={s.ackBtn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={s.ackText}>✓  ACKNOWLEDGE SIGNAL</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeBroadcast, setActiveBroadcast] = useState(null);

  // ── Setup on mount ──
  useEffect(() => {
    (async () => {
      // 1. Init offline DB
      initDB();

      // 2. Request notification permissions
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      // Android channel (required)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('broadcast', {
          name:         'Priority Broadcasts',
          importance:   Notifications.AndroidImportance.MAX,
          sound:        'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor:   '#e8630a',
        });
      }

      // 3. Register background fetch (Disabled due to apk crash)
      // await registerBackgroundFetch();

      // 4. Immediate check on launch
      const data = await checkAndNotify();
      if (data) setActiveBroadcast(data);
    })();

    // 5. Foreground polling every 15 s
    const iv = setInterval(async () => {
      const net = await Network.getNetworkStateAsync();
      if (!net.isConnected) return;
      syncOfflineData(API_BASE);
      const data = await checkAndNotify();
      if (data) setActiveBroadcast(data);
    }, 15_000);

    // 6. Listen for taps on notification (user taps the system notification tray item)
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const title = response.notification.request.content.title || '';
      const body  = response.notification.request.content.body  || '';
      if (title.includes('BROADCAST')) {
        setActiveBroadcast({ message: body });
      }
    });

    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#080b10" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#080b10' },
            cardStyleInterpolator: ({ current, layouts }) => ({
              cardStyle: {
                opacity: current.progress,
                transform: [{
                  translateX: current.progress.interpolate({
                    inputRange:  [0, 1],
                    outputRange: [layouts.screen.width * 0.06, 0],
                  }),
                }],
              },
            }),
          }}
        >
          <Stack.Screen name="Login"          component={LoginScreen}         />
          <Stack.Screen name="Home"           component={HomeScreen}          />
          <Stack.Screen name="SOS"            component={SOSScreen}           />
          <Stack.Screen name="Resources"      component={ResourcesScreen}     />
          <Stack.Screen name="Donor"          component={DonorScreen}         />
          <Stack.Screen name="MapDashboard"   component={MapDashboardScreen}  />
        </Stack.Navigator>
      </NavigationContainer>

      {/* In-app full-screen modal (foreground) */}
      <BroadcastModal
        broadcast={activeBroadcast}
        onDismiss={() => setActiveBroadcast(null)}
      />
    </>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 28,
    borderWidth:  2,
    borderColor:  '#e8630a',
    padding: 36,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#e8630a',
    shadowRadius: 40,
    shadowOpacity: 0.35,
    elevation: 20,
  },
  topBar: {
    position:           'absolute',
    top: 0, left: 0, right: 0,
    height:             5,
    backgroundColor:    '#e8630a',
    borderTopLeftRadius:  26,
    borderTopRightRadius: 26,
  },
  iconRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2, borderColor: 'rgba(232,99,10,0.3)',
    backgroundColor: 'rgba(232,99,10,0.07)',
    justifyContent:  'center',
    alignItems:      'center',
    marginTop: 14, marginBottom: 22,
  },
  iconDot: {
    position: 'absolute',
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(232,99,10,0.15)',
  },
  iconEmoji: { fontSize: 42 },

  modalTitle: {
    color: '#e8630a', fontSize: 22, fontWeight: '900',
    letterSpacing: 2, textAlign: 'center',
  },
  modalFrom: {
    color: '#475569', fontSize: 10, fontWeight: '800',
    letterSpacing: 1, marginTop: 8, textAlign: 'center',
  },
  divider: { width: '100%', height: 1, backgroundColor: '#1f2937', marginVertical: 22 },
  modalMessage: {
    color: 'white', fontSize: 19, fontWeight: '600',
    textAlign: 'center', lineHeight: 30,
  },
  modalTime: { color: '#334155', fontSize: 11, fontFamily: 'monospace' },

  ackBtn: {
    marginTop: 28,
    backgroundColor: '#e8630a',
    paddingVertical: 18, paddingHorizontal: 40,
    borderRadius: 16, width: '100%', alignItems: 'center',
    shadowColor: '#e8630a', shadowRadius: 20, shadowOpacity: 0.45, elevation: 10,
  },
  ackText: { color: 'white', fontWeight: '900', fontSize: 15, letterSpacing: 2 },
});
