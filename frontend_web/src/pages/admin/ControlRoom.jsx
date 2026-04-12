import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AppShell from '../../components/AppShell';
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { socketManager } from '../../services/socketManager';
import { AlertTriangle, CloudRain, ShieldAlert, Wind, Zap, Navigation, Loader, Users, ArrowRight, Shield } from 'lucide-react';
import InventoryPanel from '../../components/InventoryPanel';
import ActivityFeed from '../../components/ActivityFeed';
import FieldInventorySync from '../../components/admin/FieldInventorySync';

// --- Memoized Child Components to prevent render storms ---
const MemoizedInventoryPanel = React.memo(InventoryPanel);
const MemoizedActivityFeed = React.memo(ActivityFeed);

const MapObserver = React.memo(({ socket }) => {
  const map = useMapEvents({
    moveend() { emitBounds(); },
    zoomend() { emitBounds(); }
  });

  const emitBounds = useCallback(() => {
    if (socket && socket.connected) {
      const bounds = map.getBounds();
      socket.emit("control_room:bounds", {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        zoom: map.getZoom()
      });
    }
  }, [map, socket]);

  useEffect(() => {
    const handleConnect = () => emitBounds();
    if (socket) {
        socket.on('connect', handleConnect);
        if (socket.connected) emitBounds();
    }
    return () => {
        if (socket) socket.off('connect', handleConnect);
    };
  }, [socket, emitBounds]);

  return null;
});

export default function ControlRoom() {
  const [mapZones, setMapZones] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const [disasters, setDisasters] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  
  const [inventory, setInventory] = useState([]);
  const [activities, setActivities] = useState([]);

  const adminSocket = socketManager.getSocket('/admin');

  // Unified Socket Lifecycle
  useEffect(() => {
    let active = true;

    const handleUpdate = (data) => {
      if (!active) return;
      setMapZones(data.map_zones || []);
      setSuggestions(data.suggestions || []);
      setLastUpdated(new Date(data.timestamp * 1000).toLocaleTimeString());
      setLoading(false);
    };

    const handleInventory = (data) => {
      if (!active) return;
      setInventory(data || []);
    };

    const handleActivity = (data) => {
      if (!active) return;
      setActivities(prev => [data, ...prev].slice(0, 50));
    };

    // Attach deduplicated handlers
    adminSocket.off('control_room:update');
    adminSocket.off('inventory:update');
    adminSocket.off('activity:new');

    adminSocket.on('control_room:update', handleUpdate);
    adminSocket.on('inventory:update', handleInventory);
    adminSocket.on('activity:new', handleActivity);

    // Initial fallback fetch
    const fetchInitialFallback = async () => {
      try {
        const [invRes, actRes] = await Promise.all([
            fetch('https://jeevansetu-api.onrender.com/api/v2/admin/inventory'),
            fetch('https://jeevansetu-api.onrender.com/api/v2/admin/activity')
        ]);
        if (active && invRes.ok) {
            const invDat = await invRes.json();
            if (Array.isArray(invDat)) setInventory(invDat);
        }
        if (active && actRes.ok) {
            const actDat = await actRes.json();
            if (Array.isArray(actDat)) setActivities(actDat);
        }
      } catch (e) {
          console.error("Fallback fetch error:", e);
      }
    };
    fetchInitialFallback();

    // STRICT CLEANUP
    return () => {
      active = false;
      adminSocket.off('control_room:update', handleUpdate);
      adminSocket.off('inventory:update', handleInventory);
      adminSocket.off('activity:new', handleActivity);
    };
  }, [adminSocket]);

  // Unified Long-Polling Marker Loop (Throttled fetching)
  useEffect(() => {
    let active = true;
    let inv;
    
    const fetchMarkers = async () => {
       try {
         const [dRes, vRes] = await Promise.all([
            fetch('https://jeevansetu-api.onrender.com/api/v2/disasters'),
            fetch('https://jeevansetu-api.onrender.com/api/v2/admin/team/map')
         ]);
         
         if (active && dRes.ok && vRes.ok) {
             const dDat = await dRes.json();
             const vDat = await vRes.json();
             setDisasters(Array.isArray(dDat) ? dDat : []);
             setVolunteers(Array.isArray(vDat) ? vDat : []);
         }
       } catch (e) {
           console.error("Marker fetch issue:", e);
       } finally {
           if (active) setLoading(false);
       }
    };
    
    fetchMarkers();
    inv = setInterval(fetchMarkers, 5000);
    
    return () => {
        active = false;
        clearInterval(inv);
    };
  }, []);

  const handleApproveDeployment = useCallback((zoneId) => {
    if (window.confirm(`CONFIRM: Deploy nearest available personnel to Tactical Zone ${zoneId}?`)) {
      alert(`Priority Signal dispatched to Zone ${zoneId} forces.`);
      setSuggestions(prev => prev.filter(s => s.zone !== zoneId));
    }
  }, []);

  const activeSOS = useMemo(() => disasters.filter(d => ['REPORTED', 'NEW', 'DISPATCHED'].includes(d.status)), [disasters]);

  // -- Memoized Map Layers --
  const memoizedZones = useMemo(() => {
    return mapZones.map(z => {
      const bounds = [[z.lat_start, z.lng_start], [z.lat_end, z.lng_end]];
      const fillColor = z.color;
      const isRisky = z.risk_level === 'HIGH RISK' || z.risk_level === 'MEDIUM RISK';
      
      return (
        <Rectangle 
          key={`zone-${z.lat_start}-${z.lng_start}`} 
          bounds={bounds} 
          pathOptions={{ 
            color: fillColor, 
            weight: z.risk_level === 'HIGH RISK' ? 2 : 1, 
            fillOpacity: isRisky ? 0.35 : 0.05 
          }}
        >
          <Popup>
            <div style={{ color: 'black', minWidth: 200, padding: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', color: fillColor, marginBottom: 8 }}>{z.risk_level}</div>
              <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Zone Key:</strong> {z.zone_id}</div>
              <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Weather:</strong> {z.condition}</div>
              <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Rainfall Intensity:</strong> {z.rainfall.toFixed(1)} mm/h</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}><strong>Threat Alerts:</strong> {z.alerts || 'None'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                 <div style={{ background: '#f8fafc', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>ACTIVE SOS</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#ef4444' }}>{z.sos_count}</div>
                 </div>
                 <div style={{ background: '#f8fafc', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>RESPONDERS</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>{z.vol_count}</div>
                 </div>
              </div>
            </div>
          </Popup>
        </Rectangle>
      );
    });
  }, [mapZones]);

  const memoizedVolunteers = useMemo(() => {
    return volunteers.map((v) => {
      if (!v.lat || !v.lng) return null;
      const isAvailable = v.status !== 'ON_MISSION';
      const clr = isAvailable ? '#10b981' : '#f59e0b';
      const iconHtml = `<div style="background:${clr}; width:16px; height:16px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 0 12px ${clr}"></div>`;
      const vIcon = L.divIcon({ html: iconHtml, className: '' });
      return <Marker key={`vol-${v.id}`} position={[v.lat, v.lng]} icon={vIcon} />;
    });
  }, [volunteers]);

  const memoizedSOS = useMemo(() => {
    return activeSOS.map((sos) => {
      if (!sos.lat || !sos.lon) return null;
      const sIcon = L.divIcon({
        html: `<div style="background:#ef4444; width:18px; height:18px; border-radius:50%; animation: pulse 1.5s infinite; border: 2px solid white;"></div>`,
        className: 'sos-radar-icon'
      });
      return <Marker key={`sos-${sos.id}`} position={[sos.lat, sos.lon]} icon={sIcon} />;
    });
  }, [activeSOS]);

  const memoizedWarehouses = useMemo(() => {
    return inventory.map((wh) => {
      if (!wh.latitude || !wh.longitude) return null;
      const wIcon = L.divIcon({
        html: `<div style="background:#0ea5e9; width:16px; height:16px; border-radius:4px; border:2px solid white; box-shadow:0 0 10px #0ea5e9"></div>`,
        className: 'warehouse-radar-icon'
      });
      return (
         <Marker key={`wh-${wh.id}`} position={[wh.latitude, wh.longitude]} icon={wIcon}>
            <Popup>
               <div style={{ color: 'black', minWidth: 150 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#0ea5e9', marginBottom: 8, textTransform: 'uppercase' }}>WAREHOUSE</div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{wh.warehouse_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                     <strong>Food:</strong> <span>{wh.food_qty}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                     <strong>Water:</strong> <span>{wh.water_qty}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                     <strong>Medical:</strong> <span>{wh.medical_qty}</span>
                  </div>
               </div>
            </Popup>
         </Marker>
      );
    });
  }, [inventory]);

  return (
    <AppShell title="Live Control Room" sub="ADVANCED AI TACTICAL OVERVIEW" activeAlerts={suggestions.filter(s => s.priority === 'CRITICAL').length}>
      <div className="page" style={{ maxWidth: 1600, padding: '32px 48px', margin: '0 auto' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.4fr 0.4fr', gap: 24, marginBottom: 32 }}>
           <div className="card" style={{ padding: 24, borderRadius: 24, background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 20 }}>
             <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(232,99,10,0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={24} />
             </div>
             <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5 }}>System Status</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>ACTIVE OPERATIONS</div>
             </div>
             <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#10b981' }}>● REAL-TIME VIEWPORT STREAM</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>LAST MAP SYNC: {lastUpdated || 'Loading...'}</div>
             </div>
           </div>
           
           <div className="card" style={{ padding: 24, borderRadius: 24, background: 'var(--surface2)', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Scanned Viewport Zones</div>
              <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'var(--display)' }}>{mapZones.length}</div>
           </div>
           
           <div className="card" style={{ padding: 24, borderRadius: 24, background: 'var(--surface2)', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Critical Threat Areas</div>
              <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'var(--display)' }}>{mapZones.filter(z => z.risk_level === 'HIGH RISK').length}</div>
           </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr', gap: 24 }}>
          
          <div className="card" style={{ height: 750, borderRadius: 32, padding: 0, position: 'relative', overflow: 'hidden', border: '1px solid var(--border)' }}>
             {loading && (
               <div style={{ position: 'absolute', inset: 0, zIndex: 9999, background: 'rgba(10,13,20,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                 <Loader size={32} className="animate-spin-slow" color="var(--accent)" />
               </div>
             )}
             
             <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 1000, background: 'rgba(8,11,16,0.95)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 24px', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text2)', marginBottom: 12 }}>DYNAMIC RADAR OVERLAYS</div>
                <div style={{ display: 'flex', gap: 20 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)' }}><div style={{ width: 12, height: 12, background: 'rgba(239,68,68,0.4)', border: '1px solid #ef4444', borderRadius: 2 }} /> HIGH RISK</div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)' }}><div style={{ width: 12, height: 12, background: 'rgba(249,115,22,0.4)', border: '1px solid #f97316', borderRadius: 2 }} /> WARNING</div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)' }}><div style={{ width: 12, height: 12, background: 'rgba(16,185,129,0.4)', border: '1px solid #10b981', borderRadius: 2 }} /> SAFE</div>
                </div>
             </div>
             
             <MapContainer center={[26.75, 83.37]} zoom={11} style={{ height: '100%', width: '100%', background: '#0a0d14' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" opacity={0.6} />
                <MapObserver socket={adminSocket} />
                
                {memoizedZones}
                {memoizedVolunteers}
                {memoizedSOS}
                {memoizedWarehouses}
             </MapContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card" style={{ borderRadius: 32, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               <div className="card-header" style={{ padding: '24px 32px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <ShieldAlert size={20} color="var(--accent)" />
                     <div className="card-title">Viewport Active Threats</div>
                  </div>
               </div>
               
               <div className="card-body" style={{ padding: 32, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {suggestions.length === 0 && !loading && (
                     <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                        <Shield size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                        No critical actions recommended at this time.<br/>Zone stability parameters nominal.
                     </div>
                  )}
                  
                  {suggestions.map((s, idx) => (
                    <div key={idx} style={{ 
                       background: s.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(249, 115, 22, 0.08)',
                       border: `1px solid ${s.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.3)'}`,
                       borderRadius: 20,
                       padding: 24,
                       position: 'relative',
                       overflow: 'hidden'
                    }}>
                       {s.priority === 'CRITICAL' && (
                         <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: '#ef4444' }} />
                       )}
                       
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <span style={{ 
                             fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1,
                             color: s.priority === 'CRITICAL' ? '#ef4444' : '#f97316',
                             background: s.priority === 'CRITICAL' ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
                             padding: '6px 12px', borderRadius: 20 
                          }}>
                             {s.priority} · {s.type}
                          </span>
                       </div>
                       
                       <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500, lineHeight: 1.6, marginBottom: 20 }}>
                          {s.message}
                       </div>
                       
                       <button 
                          className="btn"
                          style={{ 
                             width: '100%', 
                             padding: '12px', 
                             borderRadius: 12, 
                             background: s.priority === 'CRITICAL' ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'rgba(255,255,255,0.05)',
                             color: s.priority === 'CRITICAL' ? 'white' : 'var(--text2)',
                             border: s.priority === 'CRITICAL' ? 'none' : '1px solid var(--border)',
                             fontWeight: 800,
                             display: 'flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                             gap: 8,
                             transition: 'all 0.2s',
                             cursor: 'pointer'
                          }}
                          onClick={() => handleApproveDeployment(s.zone)}
                       >
                          {s.priority === 'CRITICAL' ? (
                             <>Approve Deployment <ArrowRight size={14} /></>
                          ) : (
                             'Acknowledge Risk'
                          )}
                       </button>
                    </div>
                  ))}
               </div>
            </div>
            <MemoizedInventoryPanel inventoryData={inventory} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', height: 750 }}>
            <MemoizedActivityFeed activities={activities} />
          </div>
          
        </div>
        
        <FieldInventorySync />
      </div>
      <style>{`
         .sos-radar-icon {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            background: #ef4444;
         }
         @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
         }
      `}</style>
    </AppShell>
  );
}
