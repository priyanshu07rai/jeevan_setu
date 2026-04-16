import React, { useState, useEffect } from 'react';
import { adminSocket } from '../../services/socket';

const API = 'https://jeevansetu-api.onrender.com';

export default function FieldInventorySync() {
  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const fetchData = async () => {
    try {
      const [invRes, reqRes, matRes] = await Promise.all([
        fetch(`${API}/api/v2/admin/volunteer-inventory`),
        fetch(`${API}/api/v2/admin/inventory-requests`),
        fetch(`${API}/api/v2/admin/inventory-matches`),
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        if (Array.isArray(invData)) setInventory(invData);
      }
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        if (Array.isArray(reqData)) setRequests(reqData);
      }
      if (matRes.ok) {
        const matData = await matRes.json();
        if (Array.isArray(matData)) setMatches(matData);
      }
    } catch (e) {
      console.error('FieldInventorySync fetch error:', e);
    }
  };

  useEffect(() => {
    fetchData();

    // Poll every 10 seconds so the table is always current
    const pollId = setInterval(fetchData, 10000);

    // Only subscribe to events the backend actually emits
    const onRefresh = () => fetchData();
    const onAck = () => fetchData();

    adminSocket.on("inventory:refresh", onRefresh);
    adminSocket.on("inventory:ack", onAck);

    return () => {
      clearInterval(pollId);
      adminSocket.off("inventory:refresh", onRefresh);
      adminSocket.off("inventory:ack", onAck);
    };
  }, []);

  const approveTransfer = (match) => {
    adminSocket.emit('inventory:transfer', match);
    // Optimistic: refresh after a short delay
    setTimeout(fetchData, 1000);
  };

  const approveRawRequest = async (id) => {
    setProcessingId(id);
    try {
      const res = await fetch(`${API}/api/v2/admin/inventory-requests/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Approval Failed: ${data.error || data.message || 'Unknown error'}`);
      } else {
        // Immediately remove from pending in UI (optimistic)
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'APPROVED' } : r));
      }
      fetchData();
    } catch (e) {
      console.error('Approve error:', e);
      alert('Network error while approving. Please try again.');
    }
    setProcessingId(null);
  };

  const rejectRawRequest = async (id) => {
    setProcessingId(id);
    try {
      const res = await fetch(`${API}/api/v2/admin/inventory-requests/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(`Rejection Failed: ${data.error || data.message || 'Unknown error'}`);
      } else {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r));
      }
      fetchData();
    } catch (e) {
      console.error('Reject error:', e);
      alert('Network error while rejecting. Please try again.');
    }
    setProcessingId(null);
  };

  const pending = requests.filter(r => r.status === 'PENDING');

  return (
    <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '24px' }}>🔄</span> Field Inventory Sync
        <span style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 400, marginLeft: 'auto' }}>auto-refresh 10s</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left: Global Volunteer Stock Table */}
        <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
            Live Volunteer Stock
            <span style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 400, marginLeft: '8px' }}>
              ({inventory.length} field operatives)
            </span>
          </div>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px' }}>Volunteer</th>
                <th style={{ padding: '8px' }}>Food</th>
                <th style={{ padding: '8px' }}>Water</th>
                <th style={{ padding: '8px' }}>Med</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(inv => (
                <tr key={inv.volunteer_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', color: 'var(--accent)', fontWeight: 'bold' }}>
                    {inv.volunteer_name || `Vol #${inv.volunteer_id}`}
                  </td>
                  <td style={{ padding: '8px' }}>{inv.food_qty ?? 0}</td>
                  <td style={{ padding: '8px' }}>{inv.water_qty ?? 0}</td>
                  <td style={{ padding: '8px' }}>{inv.medical_qty ?? 0}</td>
                </tr>
              ))}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
                    No field stock documented yet.<br />
                    <span style={{ fontSize: '10px', opacity: 0.6 }}>Volunteers must update their stock using the inventory card.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Matches & Requests */}
        <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Transfer Approvals</div>
          {matches.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: '13px', fontStyle: 'italic', padding: '16px', background: 'var(--surface3)', borderRadius: '8px' }}>
              All requests fulfilled or no feasible matches available across field operatives.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {matches.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface3)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--accent)' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      Transfer from <strong style={{ color: '#10b981' }}>{m.from_name || m.from}</strong> to <strong style={{ color: '#e8630a' }}>{m.to_name || m.to}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                      F: {m.items?.food_qty ?? 0} | W: {m.items?.water_qty ?? 0} | M: {m.items?.medical_qty ?? 0}
                    </div>
                  </div>
                  <button onClick={() => approveTransfer(m)} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>
            Raw Requests Queue
            {pending.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(232,99,10,0.2)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px' }}>
                {pending.length} pending
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
            {pending.map(r => (
              <div key={r.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '12px', background: 'var(--surface)', padding: '10px 12px', borderRadius: '6px',
                borderLeft: r.type === 'REQUEST' ? '3px solid #e8630a' : '3px solid #10b981'
              }}>
                <div>
                  <strong style={{ color: 'var(--text2)' }}>{r.volunteer_name || `Vol #${r.from_volunteer_id}`}</strong>
                  <div style={{ color: 'var(--text3)', marginTop: 4, fontSize: '11px' }}>
                    {r.type}: (F: {r.food_qty}, W: {r.water_qty}, M: {r.medical_qty})
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    disabled={processingId === r.id}
                    onClick={() => approveRawRequest(r.id)}
                    style={{
                      background: processingId === r.id ? 'rgba(232,99,10,0.4)' : 'var(--accent)',
                      color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px',
                      fontWeight: 'bold', cursor: processingId === r.id ? 'not-allowed' : 'pointer', fontSize: '10px'
                    }}>
                    {processingId === r.id ? '⏳' : 'Approve'}
                  </button>
                  <button
                    disabled={processingId === r.id}
                    onClick={() => rejectRawRequest(r.id)}
                    style={{
                      background: 'transparent', color: '#ef4444', border: '1px solid #ef4444',
                      padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold',
                      cursor: processingId === r.id ? 'not-allowed' : 'pointer', fontSize: '10px'
                    }}>
                    {processingId === r.id ? '⏳' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
            {pending.length === 0 && (
              <div style={{ color: 'var(--text3)', fontSize: '12px', padding: '12px', textAlign: 'center' }}>
                No pending supply requests.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
