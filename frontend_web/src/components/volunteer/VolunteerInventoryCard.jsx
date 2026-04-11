import React, { useState, useEffect } from 'react';
import { adminSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

export default function VolunteerInventoryCard() {
  const { user } = useAuth();
  const volId = user?.volunteerId || localStorage.getItem("volunteerId");

  const [inventory, setInventory] = useState({ food_qty: 0, water_qty: 0, medical_qty: 0 });
  const [loading, setLoading] = useState(true);
  
  const [mode, setMode] = useState(null); // 'UPDATE', 'REQUEST', 'OFFER'
  const [form, setForm] = useState({ food_qty: 0, water_qty: 0, medical_qty: 0 });

  const fetchInitialData = async () => {
    if (!volId) return;
    try {
      const res = await fetch('/api/v2/admin/volunteer-inventory');
      const data = await res.json();
      if (Array.isArray(data)) {
        const myInv = data.find(d => String(d.volunteer_id) === String(volId));
        if (myInv) setInventory({
          food_qty: myInv.food_qty || 0,
          water_qty: myInv.water_qty || 0,
          medical_qty: myInv.medical_qty || 0,
        });
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    const refreshHandler = () => fetchInitialData();
    const ackHandler = () => {
       fetchInitialData();
       setMode(null);
    };

    adminSocket.on("inventory:refresh", refreshHandler);
    adminSocket.on("inventory:ack", ackHandler);

    return () => {
      adminSocket.off("inventory:refresh", refreshHandler);
      adminSocket.off("inventory:ack", ackHandler);
    };
  }, [volId]);

  const submitAction = async () => {
    let socketWorked = false;
    
    if (adminSocket && adminSocket.connected) {
      try {
        if (mode === 'UPDATE') {
          adminSocket.emit('inventory:update', { volunteer_id: volId, items: form });
        } else if (mode === 'REQUEST' || mode === 'OFFER') {
          adminSocket.emit('inventory:request', { volunteer_id: volId, type: mode, items: form });
        }
        socketWorked = true;
      } catch (e) {
        console.error("Error during emit:", e);
      }
    }

    if (!socketWorked) {
      try {
        const requestData = { volunteer_id: volId, items: form, type: mode };
        const endpoint = mode === 'UPDATE' 
          ? "/api/v2/admin/inventory/update" 
          : "/api/v2/admin/inventory/request";
          
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData)
        });

        await res.json();
        fetchInitialData();
        setMode(null);
      } catch (err) {
        console.error("API Call error:", err);
      }
    }
  };

  const getStatus = (qty, type) => {
     let threshold = type === 'medical_qty' ? 10 : 50; 
     if (qty === 0) return { icon: '🔴', label: 'Critical' };
     if (qty < threshold) return { icon: '🟡', label: 'Low' };
     return { icon: '🟢', label: 'Normal' };
  };

  if (loading) return null;

  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: '24px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
      marginTop: '16px'
    }}>
      <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '20px', color: 'var(--text1)' }}>
        📦 My Stock
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
         {[
           { k: 'food_qty', l: 'Food', val: inventory.food_qty },
           { k: 'water_qty', l: 'Water', val: inventory.water_qty },
           { k: 'medical_qty', l: 'Med', val: inventory.medical_qty },
         ].map(s => {
           const status = getStatus(s.val, s.k);
           return (
             <div key={s.k} style={{ flex: 1, background: 'var(--surface3)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>{s.l}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }}>{s.val} {status.icon}</div>
             </div>
           );
         })}
      </div>

      {!mode ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
           <button onClick={() => {setMode('UPDATE'); setForm(inventory);}} style={btnStyle('var(--surface3)')}>Update</button>
           <button onClick={() => {setMode('REQUEST'); setForm({food_qty:0, water_qty:0, medical_qty:0});}} style={btnStyle('var(--surface3)', 'var(--accent)')}>Request</button>
           <button onClick={() => {setMode('OFFER'); setForm({food_qty:0, water_qty:0, medical_qty:0});}} style={btnStyle('var(--surface3)', '#10b981')}>Offer</button>
        </div>
      ) : (
        <div style={{ background: 'var(--surface3)', padding: '16px', borderRadius: '16px' }}>
           <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '12px', color: 'white' }}>{mode} INVENTORY</div>
           <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div><label style={lblStyle}>Food</label><input type="number" value={form.food_qty} onChange={e=>setForm({...form, food_qty: Number(e.target.value)})} style={inpStyle}/></div>
              <div><label style={lblStyle}>Water</label><input type="number" value={form.water_qty} onChange={e=>setForm({...form, water_qty: Number(e.target.value)})} style={inpStyle}/></div>
              <div><label style={lblStyle}>Med</label><input type="number" value={form.medical_qty} onChange={e=>setForm({...form, medical_qty: Number(e.target.value)})} style={inpStyle}/></div>
           </div>
           <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setMode(null)} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitAction} style={{ flex: 2, padding: '8px', borderRadius: '8px', background: 'var(--accent)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Confirm</button>
           </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg, color='white') => ({ padding: '10px 4px', borderRadius: '12px', border: '1px solid var(--border)', background: bg, color: color, fontWeight: 'bold', cursor: 'pointer', flex: 1, fontSize: '11px' });
const lblStyle = { fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px' };
const inpStyle = { width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'white', boxSizing: 'border-box' };
