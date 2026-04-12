import React, { useState, useEffect } from 'react';
import { adminSocket } from '../../services/socket';

export default function FieldInventorySync() {
  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const fetchData = async () => {
    try {
      const [invRes, reqRes, matRes] = await Promise.all([
        fetch('https://jeevansetu-api.onrender.com/api/v2/admin/volunteer-inventory'),
        fetch('https://jeevansetu-api.onrender.com/api/v2/admin/inventory-requests'),
        fetch('https://jeevansetu-api.onrender.com/api/v2/admin/inventory-matches'),
      ]);
      const invData = await invRes.json();
      const reqData = await reqRes.json();
      const matData = await matRes.json();
      
      if (Array.isArray(invData)) setInventory(invData);
      if (Array.isArray(reqData)) setRequests(reqData);
      if (Array.isArray(matData)) setMatches(matData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();

    const onRefresh = () => fetchData();
    const onAck = () => fetchData(); 
    
    adminSocket.on("inventory:update_sync", setInventory);
    adminSocket.on("inventory:requests_sync", setRequests);
    adminSocket.on("inventory:matches_sync", setMatches);
    adminSocket.on("inventory:refresh", onRefresh);
    adminSocket.on("inventory:ack", onAck);
    
    return () => {
      adminSocket.off("inventory:update_sync", setInventory);
      adminSocket.off("inventory:requests_sync", setRequests);
      adminSocket.off("inventory:matches_sync", setMatches);
      adminSocket.off("inventory:refresh", onRefresh);
      adminSocket.off("inventory:ack", onAck);
    }
  }, []);

  const approveTransfer = (match) => {
    adminSocket.emit('inventory:transfer', match);
  };

  const approveRawRequest = async (id) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v2/admin/inventory-requests/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(`Approval Failed: ${data.error || data.message || 'Unknown error'}`);
      }
      fetchData();
    } catch(e) { console.error(e); }
    setProcessingId(null);
  };

  const rejectRawRequest = async (id) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v2/admin/inventory-requests/${id}/reject`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(`Rejection Failed: ${data.error || data.message || 'Unknown error'}`);
      }
      fetchData();
    } catch(e) { console.error(e); }
    setProcessingId(null);
  };

  return (
    <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
         <span style={{ fontSize: '24px' }}>🔄</span> Field Inventory Sync
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* Left: Global Volunteer Stock Table */}
        <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '16px' }}>
           <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Live Volunteer Stock</div>
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
                      <td style={{ padding: '8px', color: 'var(--accent)', fontWeight: 'bold' }}>{inv.volunteer_name || inv.volunteer_id}</td>
                      <td style={{ padding: '8px' }}>{inv.food_qty}</td>
                      <td style={{ padding: '8px' }}>{inv.water_qty}</td>
                      <td style={{ padding: '8px' }}>{inv.medical_qty}</td>
                   </tr>
                 ))}
                 {inventory.length===0 && <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)' }}>No field stock documented yet.</td></tr>}
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
                           F: {m.items.food_qty} | W: {m.items.water_qty} | M: {m.items.medical_qty}
                        </div>
                     </div>
                     <button onClick={() => approveTransfer(m)} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                        Approve
                     </button>
                   </div>
                ))}
             </div>
           )}
           
           <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>Raw Requests Queue</div>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
              {requests.filter(r => r.status === 'PENDING').map(r => (
                 <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', background: 'var(--surface)', padding: '8px', borderRadius: '6px', borderLeft: r.type === 'REQUEST' ? '3px solid #e8630a' : '3px solid #10b981' }}>
                    <div>
                        <strong style={{ color: 'var(--text2)' }}>{r.volunteer_name || r.from_volunteer_id}</strong>
                        <div style={{ color: 'var(--text3)', marginTop: 4 }}>{r.type}: (F: {r.food_qty}, W: {r.water_qty}, M: {r.medical_qty})</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button disabled={processingId === r.id} onClick={() => approveRawRequest(r.id)} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: processingId === r.id ? 'not-allowed' : 'pointer', fontSize: '10px' }}>
                            {processingId === r.id ? '...' : 'Approve'}
                        </button>
                        <button disabled={processingId === r.id} onClick={() => rejectRawRequest(r.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: processingId === r.id ? 'not-allowed' : 'pointer', fontSize: '10px' }}>
                            {processingId === r.id ? '...' : 'Reject'}
                        </button>
                    </div>
                 </div>
              ))}
              {requests.filter(r => r.status === 'PENDING').length === 0 && <div style={{ color: 'var(--text3)', fontSize: '12px' }}>No pending supply requests.</div>}
           </div>
        </div>
      </div>
    </div>
  );
}
