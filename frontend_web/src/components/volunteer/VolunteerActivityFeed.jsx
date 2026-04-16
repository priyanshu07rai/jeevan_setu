import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API = 'https://jeevansetu-api.onrender.com';

const TYPE_META = {
  REQUEST: { icon: '📥', color: '#e8630a', label: 'Requested supplies' },
  OFFER:   { icon: '📤', color: '#10b981', label: 'Offered supplies' },
  UPDATE:  { icon: '📦', color: '#3b82f6', label: 'Updated inventory' },
};

export default function VolunteerActivityFeed({ activeMission }) {
  const { user } = useAuth();
  const volId = user?.volunteerId || localStorage.getItem('volunteerId');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!volId) return;
    try {
      const res = await fetch(`${API}/api/v2/admin/inventory-requests`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        // Filter to only this volunteer's activity, most recent first
        const mine = data
          .filter(r => String(r.from_volunteer_id) === String(volId))
          .sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0))
          .slice(0, 10);
        setRequests(mine);
      }
    } catch (e) {
      console.error('ActivityFeed fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Poll every 10 seconds to catch new events
    const pollId = setInterval(fetchRequests, 10000);
    return () => clearInterval(pollId);
  }, [volId]);

  const statusColor = (status) => {
    if (status === 'APPROVED' || status === 'COMPLETED') return '#10b981';
    if (status === 'REJECTED') return '#ef4444';
    return '#f59e0b'; // PENDING
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: '24px',
      padding: '24px',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
    }}>
      <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '20px', color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>📝</span>
        Action Log
        <span style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 400, marginLeft: 'auto' }}>auto-refresh 10s</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '320px' }}>

        {/* Active mission entry (always show if mission exists) */}
        {activeMission && (
          <>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: 'rgba(232,99,10,0.15)', border: '1px solid rgba(232,99,10,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>📡</div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text1)', fontWeight: 800, marginBottom: '4px' }}>Telemetry Established</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.5 }}>
                  Awaiting field arrival confirmation for mission logistics tracking.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>📋</div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text1)', fontWeight: 800, marginBottom: '4px' }}>Deploy Order Issued</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.5 }}>
                  {`Mission #${activeMission.id} securely assigned. Proceed with caution.`}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Real inventory activity entries */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: '12px' }}>
            Loading logs...
          </div>
        ) : requests.length === 0 && !activeMission ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: '13px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>💤</div>
            No recent activity. Use Update, Request, or Offer to log actions.
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: '12px' }}>
            No supply requests logged yet.
          </div>
        ) : (
          requests.map(r => {
            const meta = TYPE_META[r.type] || TYPE_META.UPDATE;
            return (
              <div key={r.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: `${meta.color}18`, border: `1px solid ${meta.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: '14px'
                }}>{meta.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text1)', fontWeight: 800, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {meta.label}
                    <span style={{
                      fontSize: '9px', fontWeight: 900, padding: '2px 7px', borderRadius: '20px',
                      background: `${statusColor(r.status)}22`, color: statusColor(r.status)
                    }}>{r.status}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.5 }}>
                    F: {r.food_qty} &nbsp;|&nbsp; W: {r.water_qty} &nbsp;|&nbsp; M: {r.medical_qty}
                  </div>
                  {(r.timestamp || r.created_at) && (
                    <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '3px', opacity: 0.6 }}>
                      {formatTime(r.timestamp || r.created_at)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
