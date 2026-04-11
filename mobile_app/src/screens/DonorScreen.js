import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Image, Linking,
  Clipboard, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { API_BASE } from '../constants';

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────
const StepBar = ({ step }) => (
  <View style={styles.stepBar}>
    {[1, 2, 3].map(n => (
      <View key={n} style={styles.stepItem}>
        <View style={[styles.stepCircle, n <= step && styles.stepCircleActive]}>
          <Text style={[styles.stepNum, n <= step && styles.stepNumActive]}>
            {n < step ? '✓' : n}
          </Text>
        </View>
        {n < 3 && <View style={[styles.stepLine, n < step && styles.stepLineActive]} />}
      </View>
    ))}
  </View>
);

// ─── LEDGER ROW ───────────────────────────────────────────────────────────────
const LedgerRow = ({ item, index }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay: index * 70, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.ledgerRow, { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.name || 'A')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.ledgerMid}>
        <Text style={styles.ledgerName}>{item.name || 'Anonymous'}</Text>
        <Text style={styles.ledgerSub}>Medical Support Allocation</Text>
      </View>
      <View style={styles.ledgerRight}>
        <Text style={styles.ledgerAmt}>₹{parseFloat(item.amount).toFixed(0)}</Text>
        <View style={styles.ledgerBadge}>
          <Text style={styles.ledgerBadgeText}>LOGGED</Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ─── DONOR SCREEN ─────────────────────────────────────────────────────────────
export default function DonorScreen({ navigation }) {
  const [name, setName]                     = useState('');
  const [amount, setAmount]                 = useState('');
  const [loading, setLoading]               = useState(false);
  const [ledgers, setLedgers]               = useState([]);
  const [fetchingLedger, setFetchingLedger] = useState(true);
  const [payConfig, setPayConfig]           = useState(null);
  const [fetchingConfig, setFetchingConfig] = useState(true);
  const [step, setStep]                     = useState(1);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const QUICK_AMOUNTS = ['100', '250', '500', '1000', '2500', '5000'];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchPaymentConfig();
    fetchLedgers();
  }, []);

  const fetchPaymentConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/payment/config`);
      if (res.data?.upi_id || res.data?.account_number || res.data?.qr_image_url_full) {
        setPayConfig(res.data);
      }
    } catch {} finally { setFetchingConfig(false); }
  };

  const fetchLedgers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v2/donations/top`);
      setLedgers(res.data || []);
    } catch {} finally { setFetchingLedger(false); }
  };

  const handleProceed = async () => {
    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0) { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/v2/donations`, {
        donor_name: name.trim() || 'Anonymous',
        amount: amtNum,
        category: 'Medical Support',
      });
      setStep(2);
      fetchLedgers();
    } catch {
      Alert.alert('Network Error', 'Could not reach server. Try again.');
    } finally { setLoading(false); }
  };

  const openUPI = () => {
    if (!payConfig?.upi_id) return;
    const url = `upi://pay?pa=${payConfig.upi_id}&pn=${encodeURIComponent(payConfig.account_name || 'Relief Fund')}&am=${amount}&cu=INR`;
    Linking.openURL(url).catch(() => Alert.alert('UPI Not Found', 'Send to: ' + payConfig.upi_id));
  };

  const copyUPI = () => {
    if (payConfig?.upi_id) { Clipboard.setString(payConfig.upi_id); Alert.alert('Copied!', 'UPI ID copied.'); }
  };

  const qrUrl = payConfig?.qr_image_url_full
    ? (payConfig.qr_image_url_full.startsWith('http') ? payConfig.qr_image_url_full : `${API_BASE}${payConfig.qr_image_url_full}`)
    : null;

  const totalAid = ledgers.reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Relief Fund</Text>
          <Text style={styles.headerSub}>SECURE · TRANSPARENT · IMPACT-DRIVEN</Text>
        </View>
        <View style={styles.totalChip}>
          <Text style={styles.totalChipLabel}>RAISED</Text>
          <Text style={styles.totalChipVal}>₹{(totalAid / 1000).toFixed(1)}K</Text>
        </View>
      </View>

      <StepBar step={step} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ─── STEP 1: FORM ─── */}
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💎 Make a Contribution</Text>
              <Text style={styles.cardDesc}>
                Your funds go directly to field teams for medical kits and rations.
              </Text>

              <Text style={styles.fieldLabel}>DONOR NAME (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="Anonymous"
                placeholderTextColor="#334155"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>AMOUNT (₹)</Text>
              <View style={styles.quickAmounts}>
                {QUICK_AMOUNTS.map(q => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.quickBtn, amount === q && styles.quickBtnActive]}
                    onPress={() => setAmount(q)}
                  >
                    <Text style={[styles.quickText, amount === q && styles.quickTextActive]}>₹{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Or enter custom amount"
                placeholderTextColor="#334155"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={handleProceed}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.primaryBtnText}>Continue to Payment →</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ─── STEP 2: PAYMENT ─── */}
          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏦 Complete Payment</Text>

              {/* Amount banner */}
              <View style={styles.amountBanner}>
                <Text style={styles.amountLabel}>Transfer Amount</Text>
                <Text style={styles.amountValue}>₹{amount}</Text>
                <Text style={styles.amountSub}>Medical Support Allocation</Text>
              </View>

              {fetchingConfig ? (
                <ActivityIndicator color="#e8630a" style={{ marginVertical: 24 }} />
              ) : payConfig ? (
                <>
                  {qrUrl && (
                    <View style={styles.qrBox}>
                      <Text style={styles.fieldLabel}>📷 SCAN QR CODE</Text>
                      <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                      <Text style={styles.qrHint}>Open any UPI app and scan above</Text>
                    </View>
                  )}

                  {payConfig.upi_id && (
                    <View style={styles.upiBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>UPI ID</Text>
                        <Text style={styles.upiId}>{payConfig.upi_id}</Text>
                      </View>
                      <View style={{ gap: 8 }}>
                        <TouchableOpacity style={styles.smallBtn} onPress={copyUPI}>
                          <Text style={styles.smallBtnText}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#1d4ed8' }]} onPress={openUPI}>
                          <Text style={styles.smallBtnText}>Pay</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {(payConfig.account_number || payConfig.bank_name) && (
                    <View style={styles.bankBox}>
                      <Text style={styles.fieldLabel}>🏦 BANK TRANSFER</Text>
                      {[
                        { l: 'Account Name',   v: payConfig.account_name },
                        { l: 'Account Number', v: payConfig.account_number },
                        { l: 'IFSC Code',      v: payConfig.ifsc },
                        { l: 'Bank Name',      v: payConfig.bank_name },
                      ].filter(r => r.v).map((r, i) => (
                        <View key={i} style={styles.bankRow}>
                          <Text style={styles.bankLabel}>{r.l}</Text>
                          <Text style={styles.bankValue}>{r.v}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.noConfig}>
                  <Text style={styles.noConfigText}>💳 Payment details being configured by admin.</Text>
                </View>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(3)} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>✓ I've Completed the Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep(1)}>
                <Text style={styles.ghostBtnText}>← Change Amount</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── STEP 3: CONFIRMED ─── */}
          {step === 3 && (
            <View style={[styles.card, styles.confirmCard]}>
              <Text style={styles.confirmEmoji}>🎉</Text>
              <Text style={styles.confirmTitle}>CONTRIBUTION RECORDED!</Text>
              <Text style={styles.confirmSub}>
                Thank you, {name || 'Anonymous'}!{'\n'}
                Your ₹{amount} contribution is logged.{'\n'}
                Command HQ will verify shortly.
              </Text>
              <TouchableOpacity style={[styles.primaryBtn, { width: '100%' }]} onPress={() => { setStep(1); setName(''); setAmount(''); }}>
                <Text style={styles.primaryBtnText}>Donate Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── IMPACT LEDGER ─── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📜 Impact Ledger</Text>
            {fetchingLedger ? (
              <ActivityIndicator color="#e8630a" style={{ marginVertical: 24 }} />
            ) : ledgers.length === 0 ? (
              <Text style={styles.emptyText}>No contributions yet. Be the first!</Text>
            ) : (
              ledgers.slice(0, 6).map((l, i) => <LedgerRow key={i} item={l} index={i} />)
            )}
          </View>

          {/* ─── TRUST BADGE ─── */}
          <View style={styles.trustCard}>
            <Text style={styles.trustIcon}>🛡️</Text>
            <Text style={styles.trustTitle}>Anti-Fraud Guarantee</Text>
            <Text style={styles.trustDesc}>
              Every contribution is tracked and verified by Command HQ. Payment details are admin-controlled and updated in real-time.
            </Text>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080b10' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f2937', gap: 14 },
  backBtn: { backgroundColor: '#111827', padding: 8, borderRadius: 10 },
  backText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: 'white' },
  headerSub: { color: '#334155', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  totalChip: { alignItems: 'center', backgroundColor: 'rgba(232,99,10,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(232,99,10,0.2)', paddingHorizontal: 12, paddingVertical: 8 },
  totalChipLabel: { color: '#e8630a', fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  totalChipVal: { color: '#e8630a', fontSize: 16, fontWeight: '900' },

  // Step bar
  stepBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, paddingHorizontal: 40 },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#111827', borderWidth: 2, borderColor: '#1f2937', justifyContent: 'center', alignItems: 'center' },
  stepCircleActive: { borderColor: '#e8630a', backgroundColor: 'rgba(232,99,10,0.15)' },
  stepNum: { color: '#334155', fontSize: 13, fontWeight: '900' },
  stepNumActive: { color: '#e8630a' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#1f2937', marginHorizontal: 6 },
  stepLineActive: { backgroundColor: '#e8630a' },

  scroll: { padding: 18, paddingBottom: 60 },

  card: { backgroundColor: '#0d1117', borderRadius: 22, padding: 22, marginBottom: 20, borderWidth: 1, borderColor: '#1f2937' },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  cardDesc: { color: '#475569', fontSize: 13, lineHeight: 20, marginBottom: 22 },

  fieldLabel: { color: '#334155', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  input: { backgroundColor: '#080b10', color: 'white', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1f2937', marginBottom: 18, fontSize: 16 },

  quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  quickBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937' },
  quickBtnActive: { backgroundColor: 'rgba(232,99,10,0.15)', borderColor: '#e8630a' },
  quickText: { color: '#475569', fontSize: 13, fontWeight: '800' },
  quickTextActive: { color: '#e8630a' },

  primaryBtn: { backgroundColor: '#e8630a', padding: 19, borderRadius: 16, alignItems: 'center', marginTop: 6, shadowColor: '#e8630a', shadowRadius: 16, shadowOpacity: 0.25, elevation: 8 },
  primaryBtnText: { color: 'white', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  ghostBtn: { padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#1f2937', borderRadius: 14, marginTop: 10 },
  ghostBtnText: { color: '#475569', fontWeight: '700', fontSize: 14 },

  amountBanner: { backgroundColor: 'rgba(232,99,10,0.07)', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 22, borderWidth: 1, borderColor: 'rgba(232,99,10,0.2)' },
  amountLabel: { color: '#64748b', fontSize: 11, marginBottom: 6 },
  amountValue: { color: '#e8630a', fontSize: 42, fontWeight: '900' },
  amountSub: { color: '#475569', fontSize: 11, marginTop: 6 },

  qrBox: { alignItems: 'center', marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  qrImage: { width: 200, height: 200, backgroundColor: 'white', borderRadius: 16, marginVertical: 14 },
  qrHint: { color: '#475569', fontSize: 12 },

  upiBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(232,99,10,0.06)', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(232,99,10,0.2)', gap: 12 },
  upiId: { color: '#e8630a', fontSize: 15, fontWeight: '800', fontFamily: 'monospace', marginTop: 5 },
  smallBtn: { backgroundColor: '#e8630a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  smallBtnText: { color: 'white', fontWeight: '900', fontSize: 12 },

  bankBox: { backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  bankLabel: { color: '#475569', fontSize: 12 },
  bankValue: { color: 'white', fontSize: 12, fontWeight: '800', fontFamily: 'monospace' },

  noConfig: { paddingVertical: 32, alignItems: 'center' },
  noConfigText: { color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 22 },

  confirmCard: { alignItems: 'center', paddingVertical: 44 },
  confirmEmoji: { fontSize: 56, marginBottom: 18 },
  confirmTitle: { color: '#e8630a', fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 14 },
  confirmSub: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 24, marginBottom: 28 },

  emptyText: { color: '#334155', textAlign: 'center', paddingVertical: 24, fontSize: 13 },

  ledgerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111827', gap: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(232,99,10,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,99,10,0.2)' },
  avatarText: { color: '#e8630a', fontSize: 18, fontWeight: '900' },
  ledgerMid: { flex: 1 },
  ledgerName: { color: 'white', fontWeight: '800', fontSize: 14 },
  ledgerSub: { color: '#334155', fontSize: 10, marginTop: 3 },
  ledgerRight: { alignItems: 'flex-end', gap: 5 },
  ledgerAmt: { color: '#e8630a', fontWeight: '900', fontSize: 16 },
  ledgerBadge: { backgroundColor: 'rgba(56,189,248,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)' },
  ledgerBadgeText: { color: '#38bdf8', fontSize: 8, fontWeight: '900', letterSpacing: 1 },

  trustCard: { backgroundColor: '#0d1117', borderRadius: 22, padding: 28, borderWidth: 1, borderColor: '#1f2937', alignItems: 'center', marginBottom: 10 },
  trustIcon: { fontSize: 40, marginBottom: 14 },
  trustTitle: { color: 'white', fontWeight: '900', fontSize: 16, marginBottom: 10 },
  trustDesc: { color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
