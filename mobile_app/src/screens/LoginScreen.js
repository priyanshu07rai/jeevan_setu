import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Animated, Dimensions, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE } from '../constants';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  
  // Citizen Forms
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      // Citizen Flow: Unified JWT Auth
      try {
        const payload = {
          email: email.trim().toLowerCase(),
          password: password.trim()
        };
        
        console.log("LOGIN PAYLOAD", payload);

        const res = await axios.post(`${API_BASE}/api/v2/auth/login`, payload);
        
        const token = res.data.access_token || res.data.token;
        if (token) {
          const citizenUser = { ...res.data, role: 'citizen' };
          
          await AsyncStorage.setItem('access_token', token);
          await AsyncStorage.setItem('user', JSON.stringify(citizenUser));
          await AsyncStorage.setItem('citizen_name', res.data.name || email.split('@')[0]);
          
          // Route immediately to Admin Broadcast -> SOS flow
          navigation.replace('SOS');
        } else {
           throw new Error('Authentication gateway did not return valid credentials.');
        }
      } catch (err) {
        throw err;
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Authentication failed';
      Alert.alert('Secure Access Denied', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            
            {/* Logo Section */}
            <View style={styles.logoRow}>
              <View style={styles.logoBox}><Text style={{ fontSize: 24 }}>🛰</Text></View>
              <View>
                <Text style={styles.logoText}>JEEVAN SETU</Text>
                <Text style={styles.logoSub}>CITIZEN RESPONDER v2.1</Text>
              </View>
            </View>

            <Text style={styles.title}>Citizen Access</Text>
            <Text style={styles.subtitle}>Sign in to synchronize your rescue identity</Text>

            {/* Form Fields */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  placeholder="citizen@example.com"
                  placeholderTextColor="#334155"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>SECURITY KEY</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#334155"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitText}>🚀 SIGN IN AS CITIZEN</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <View style={styles.footerItem}><Text style={styles.footerText}>🔒 256-bit AES</Text></View>
              <View style={styles.footerItem}><Text style={styles.footerText}>🌐 Real-time sync</Text></View>
              <View style={styles.footerItem}><Text style={styles.footerText}>📡 Mesh enabled</Text></View>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080b10' },
  scroll: { flexGrow: 1, padding: 24 },
  container: { flex: 1 },
  
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, marginTop: 20 },
  logoBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(232,99,10,0.15)', borderWidth: 1, borderColor: 'rgba(232,99,10,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  logoText: { color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  logoSub: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 2 },

  title: { color: 'white', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: '#64748b', fontSize: 14, marginBottom: 32 },

  roleGrid: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  roleBtn: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: '#0d1117', borderWidth: 1.5, borderColor: '#1f2937', alignItems: 'center' },
  roleBtnActive: { borderColor: '#e8630a', backgroundColor: 'rgba(232,99,10,0.08)' },
  roleLabel: { color: '#64748b', fontWeight: '900', fontSize: 13, marginBottom: 4 },
  roleSubLabel: { color: '#334155', fontSize: 8, fontWeight: '800' },

  form: { flex: 1 },
  inputGroup: { marginBottom: 20 },
  label: { color: '#334155', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
  input: { backgroundColor: '#0d1117', color: 'white', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1f2937', fontSize: 15 },
  
  submitBtn: { backgroundColor: '#e8630a', padding: 20, borderRadius: 18, alignItems: 'center', marginTop: 10, shadowColor: '#e8630a', shadowRadius: 20, shadowOpacity: 0.3, elevation: 8 },
  submitText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  footer: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: 40, paddingBottom: 20 },
  footerItem: { flexDirection: 'row', alignItems: 'center' },
  footerText: { color: '#1e293b', fontSize: 10, fontWeight: '800' },
});
