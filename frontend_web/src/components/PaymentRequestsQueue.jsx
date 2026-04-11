import React, { useState, useEffect } from 'react';
import { fetchAdminPayments, approvePayment, rejectPayment } from '../services/api';

export default function PaymentRequestsQueue() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await fetchAdminPayments();
    setRequests(data || []);
    setLoading(false);
  };

  const handleAction = async (id, action) => {
    try {
      if (action === 'approve') await approvePayment(id);
      else await rejectPayment(id);
      
      // Update UI instantly
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));
    } catch {
      alert(`Failed to ${action} payment.`);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>🛡️ Payment Verification Queue</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Approve submitted citizen payments to officially record them on the public impact ledger.
          </div>
        </div>
        <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: 'rgba(255,255,255,0.02)', borderRadius: 16 }}>
          No payment requests found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {requests.map(req => (
            <div key={req.id} style={{
              background: 'var(--surface2)', borderRadius: 16, padding: 24,
              border: `1px solid ${req.status === 'pending' ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`
            }}>
              <div style={{ display: 'flex', gap: 24 }}>
                
                {/* Visual Proof Box */}
                {req.proof_url ? (
                  <div style={{ width: 120, height: 120, background: 'black', borderRadius: 12, overflow: 'hidden' }}>
                    <img src={req.proof_url} alt="Proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: 120, height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 11, textAlign: 'center', padding: 10 }}>
                    No receipt uploaded
                  </div>
                )}
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>₹{req.amount}</div>
                      
                      {/* Status Badge */}
                      <div style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                        background: req.status === 'pending' ? 'rgba(251,191,36,0.2)' : req.status === 'approved' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        color: req.status === 'pending' ? '#fbbf24' : req.status === 'approved' ? '#10b981' : '#ef4444'
                      }}>
                        {req.status}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 0' }}>{req.donor_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{req.category} Allocation</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Filed: {new Date(req.created_at).toLocaleString()}</div>
                  </div>

                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                      <button 
                        onClick={() => handleAction(req.id, 'approve')}
                        style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '10px 0', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>
                        ✅ Approve & Log
                      </button>
                      <button 
                        onClick={() => handleAction(req.id, 'reject')}
                        style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '10px 0', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>
                        ❌ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
