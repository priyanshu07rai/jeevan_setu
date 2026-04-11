import React, { useState, useEffect, useRef } from 'react';
import AppShell from '../components/AppShell';
import { fetchDonations, fetchSupplies, fetchPaymentConfig, submitPaymentRequest, fetchUserPayments } from '../services/api';
import { useAuth } from '../context/AuthContext';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v2';

export default function DonorPage() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ donor_name: '', amount: '', category: 'Medical Support' });
  const [donations, setDonations] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [payConfig, setPayConfig] = useState(null);
  const [myRequests, setMyRequests] = useState([]); // Array of payment requests
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);        // 1=form  2=payment  3=confirm
  const [proofFile, setProofFile] = useState(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofDone, setProofDone] = useState(false);
  const proofRef = useRef();

  useEffect(() => { load(); }, []);

  // Auto-login citizen quietly if not logged in
  useEffect(() => {
    if (!user) login('citizen@local', 'pass', 'Citizen', 'citizen');
  }, [user, login]);

  // Polling for my requests status
  useEffect(() => {
    if (!user?.id) return;
    const fetchMine = async () => {
      const data = await fetchUserPayments(user.id);
      setMyRequests(data || []);
    };
    fetchMine();
    const interval = setInterval(fetchMine, 5000); // 5 sec poll
    return () => clearInterval(interval);
  }, [user]);

  const load = async () => {
    const [d, s, pc] = await Promise.all([fetchDonations(), fetchSupplies(), fetchPaymentConfig()]);
    setDonations(d || []);
    setSupplies(s || []);
    setPayConfig(pc && (pc.upi_id || pc.account_number || pc.qr_image_url_full) ? pc : null);
  };

  /* ── Step 1 → 2: Validate ── */
  const submitToPaymentStep = (e) => {
    e.preventDefault();
    setStep(2);
  };

  /* ── Upload Payment Proof & Submit Request ── */
  const uploadAndConfirm = async () => {
    setProofUploading(true);
    let finalProofUrl = '';
    
    // 1. Upload proof if selected
    if (proofFile) {
      try {
        const fd = new FormData();
        fd.append('file', proofFile);
        fd.append('caption', `Donation proof by ${form.donor_name || 'Anonymous'} — ₹${form.amount}`);
        fd.append('severity', 'low');
        const res = await fetch(`${BASE_URL}/uploads-proof`, { method: 'POST', body: fd });
        if (res.ok) {
           const d = await res.json();
           finalProofUrl = d.url || (d.filename ? `${BASE_URL}/uploads/${d.filename}` : '');
        }
      } catch (e) { console.error('Proof upload error', e); }
    }
    
    // 2. Submit payment request (Pending Approval)
    try {
        await submitPaymentRequest({
            user_id: user?.id || 'citizen',
            donor_name: form.donor_name || 'Anonymous',
            amount: form.amount,
            category: form.category,
            proof_url: finalProofUrl
        });
        setProofDone(true);
        setTimeout(() => {
            setStep(3);
            if (user?.id) fetchUserPayments(user.id).then(r => setMyRequests(r || []));
        }, 800);
    } catch (e) {
        alert("Failed to submit payment request.");
    }
    setProofUploading(false);
  };

  const reset = () => {
    setStep(1);
    setForm({ donor_name: '', amount: '', category: 'Medical Support' });
    setProofFile(null);
    setProofDone(false);
  };

  /* ── UPI copy helper ── */
  const copyUPI = () => {
    if (payConfig?.upi_id) {
      navigator.clipboard.writeText(payConfig.upi_id);
    }
  };

  return (
    <AppShell title="Relief Fund Portal" sub="SECURE · TRANSPARENT · IMPACT-DRIVEN">
      <div className="page">
        <div className="two-col" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>

          {/* ── LEFT: FLOW ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            
            {step === 1 && (
              <div className="card">
                <div className="card-header"><div className="card-title">💎 Make a Contribution</div></div>
                <div className="card-body">
                  <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 22 }}>
                    Your funds are sent directly to ground field teams for medical kits and food rations.
                  </p>
                  <form onSubmit={submitToPaymentStep}>
                    <div className="form-group">
                      <label className="form-label">Full Name (or Anonymous)</label>
                      <input className="form-input" placeholder="Enter name" value={form.donor_name}
                        onChange={e => setForm({ ...form, donor_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contribution Amount (₹)</label>
                      <input className="form-input" type="number" placeholder="500" value={form.amount}
                        onChange={e => setForm({ ...form, amount: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Allocation Category</label>
                      <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                        <option>Medical Support</option>
                        <option>Emergency Rations</option>
                        <option>Disaster Infrastructure</option>
                        <option>General Relief</option>
                      </select>
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%', padding: '18px 0', fontSize: 15 }} disabled={loading}>
                      {loading ? '⏳ Processing...' : 'Continue to Payment →'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="card">
                <div className="card-header"><div className="card-title">🏦 Complete Your Payment</div></div>
                <div className="card-body">
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>Amount to pay</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--accent)' }}>₹{form.amount}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{form.category}</div>
                  </div>

                  {payConfig ? (
                    <>
                      {/* QR Code */}
                      {payConfig.qr_image_url_full && (
                        <div style={{ textAlign: 'center', marginBottom: 28 }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                            📷 Scan QR Code
                          </div>
                          <img
                            src={payConfig.qr_image_url_full}
                            alt="Payment QR Code"
                            style={{
                              width: 200, height: 200, objectFit: 'contain',
                              borderRadius: 16, border: '2px solid var(--accent)',
                              padding: 8, background: 'white', margin: '0 auto', display: 'block'
                            }}
                          />
                        </div>
                      )}

                      {/* UPI ID */}
                      {payConfig.upi_id && (
                        <div style={{
                          background: 'rgba(232,99,10,0.06)', border: '1px solid rgba(232,99,10,0.25)',
                          borderRadius: 14, padding: '16px 20px', marginBottom: 16, display: 'flex',
                          alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>UPI ID</div>
                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                              {payConfig.upi_id}
                            </div>
                          </div>
                          <button
                            onClick={copyUPI}
                            style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Copy
                          </button>
                        </div>
                      )}

                      {/* Bank Details */}
                      {(payConfig.account_number || payConfig.bank_name) && (
                        <div style={{
                          background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
                          borderRadius: 14, padding: '16px 20px', marginBottom: 20
                        }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>🏦 Bank Transfer</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {[
                              { label: 'Account Name', val: payConfig.account_name },
                              { label: 'Bank Name', val: payConfig.bank_name },
                              { label: 'Account Number', val: payConfig.account_number },
                              { label: 'IFSC Code', val: payConfig.ifsc },
                            ].filter(r => r.val).map((r, i) => (
                              <div key={i}>
                                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{r.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: 'white' }}>{r.val}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{
                      textAlign: 'center', padding: '32px 20px',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 16,
                      border: '1px dashed var(--border)', marginBottom: 20
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>💳</div>
                      <div style={{ fontSize: 14, color: 'var(--text3)' }}>
                        Payment details are being configured by admin.<br />
                        <span style={{ fontSize: 11 }}>Please check back shortly or contact the relief team.</span>
                      </div>
                    </div>
                  )}

                  {/* Proof Upload */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>
                      📋 Upload Payment Screenshot (Optional)
                    </div>
                    <div
                      style={{
                        border: `2px dashed ${proofFile ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 12, padding: '20px', textAlign: 'center', cursor: 'pointer',
                        background: proofFile ? 'rgba(232,99,10,0.05)' : 'transparent', transition: 'all 0.2s'
                      }}
                      onClick={() => proofRef.current?.click()}
                    >
                      <input
                        ref={proofRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => setProofFile(e.target.files[0])}
                      />
                      {proofFile ? (
                        <><div style={{ fontSize: 18, marginBottom: 4 }}>✅</div>
                          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{proofFile.name}</div></>
                      ) : (
                        <><div style={{ fontSize: 18, marginBottom: 4 }}>📷</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Click to upload proof screenshot</div></>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 2, background: proofDone ? '#10b981' : undefined }}
                      onClick={uploadAndConfirm}
                      disabled={proofUploading}
                    >
                      {proofUploading ? '⏳ Uploading...' : proofDone ? '✅ Submitted!' : proofFile ? 'Submit Proof & Confirm' : 'Confirm Donation ✓'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="zk-card" style={{ borderColor: 'var(--accent)', background: 'rgba(232,99,10,0.02)' }}>
                <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                  <div className="zk-card-title" style={{ color: 'var(--accent)', fontSize: 20 }}>Payment Submitted!</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 16, lineHeight: 1.7 }}>
                    Thank you, <strong>{form.donor_name || 'Anonymous'}</strong>.<br />
                    Your request has been placed in the Verification Queue.
                  </div>
                  <div className="zk-verified" style={{ color: '#fbbf24', marginTop: 20 }}>
                     Waiting for Admin Approval ⏳
                  </div>
                  <button className="btn btn-ghost" style={{ width: '100%', marginTop: 24 }} onClick={reset}>
                    Submit Another Donation
                  </button>
                </div>
              </div>
            )}

            {/* User Payment Status Tracking (Polls) */}
            {myRequests.length > 0 && (
               <div className="card">
                  <div className="card-header">
                     <div className="card-title">📡 My Ongoing Verification Status</div>
                  </div>
                  <div className="card-body" style={{ padding: '0 16px' }}>
                     {myRequests.map((req, i) => (
                        <div key={req.id} className="tr" style={{ padding: '16px 0', borderBottom: i === myRequests.length - 1 ? 'none' : '1px solid var(--border)' }}>
                           <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>₹{req.amount} — {req.category}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Filed: {new Date(req.created_at).toLocaleString()}</div>
                           </div>
                           <div style={{ textAlign: 'right' }}>
                              {req.status === 'pending' && <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>Waiting for approval ⏳</span>}
                              {req.status === 'approved' && <span style={{ color: '#10b981', fontSize: 12, fontWeight: 700 }}>Payment received ✅</span>}
                              {req.status === 'rejected' && <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>Verification failed ❌</span>}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
          </div>

          {/* ── RIGHT: LEDGER + TRUST ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">📜 Verified Impact Ledger</div></div>
              <div className="card-body" style={{ padding: '0 16px' }}>
                {donations.length > 0 ? donations.slice(0, 8).map((d, i) => (
                  <div key={i} className="tr" style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(232,99,10,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                    <div style={{ flex: 1, marginLeft: 15 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{d.donor_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{d.category}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent)' }}>₹{d.amount}</div>
                      <div style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'var(--mono)' }}>VERIFIED</div>
                    </div>
                  </div>
                )) : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>No public contributions yet.</div>}
              </div>
            </div>

            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🛡️</div>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8, color: 'var(--blue2)' }}>Anti-Fraud Guarantee</div>
              <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                Every contribution is completely managed by admins before it successfully strikes the ledger. No automatic unverified commits.
              </p>
            </div>
            
            {/* Supply Status inside right column because layout */}
            <div className="card">
              <div className="card-header"><div className="card-title">🥡 Field Supply Status</div></div>
              <div className="card-body" style={{ padding: '10px 20px' }}>
                {supplies.slice(0, 3).map((s, i) => (
                  <div key={i} className="tr" style={{ alignItems: 'center', padding: '12px 0', borderBottom: i === 2 ? 'none' : '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{s.location_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                        Medical: {s.medical_kits} kits · Rations: {s.food_packets} pks
                      </div>
                    </div>
                    <div style={{ width: 40, height: 6, borderRadius: 3, background: 'var(--surface3)' }}>
                      <div style={{ width: '75%', height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
                {supplies.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 12 }}>No supply data available.</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
