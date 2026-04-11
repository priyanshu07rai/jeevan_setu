import React, { useState, useEffect } from 'react';
import { fetchDisasters, fetchVolunteers, fetchShelters, fetchActivity } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Activity, Globe, CheckCircle2, Compass, Users, Shield, CreditCard } from 'lucide-react';
import DisasterMap from '../components/DisasterMap';
import AppShell from '../components/AppShell';
import PaymentSettings from '../components/PaymentSettings';
import PaymentRequestsQueue from '../components/PaymentRequestsQueue';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import socket from '../services/socketService';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('ops'); // 'ops' | 'payment' | 'team'
  const [data, setData] = useState({ disasters: [], volunteers: [], shelters: [], activity: [], donors: [] });
  
  // Tactical Mission State
  const [activeMissions, setActiveMissions] = useState([]);
  const [dispatchedZones, setDispatchedZones] = useState([]);
  const [resolvedZones, setResolvedZones] = useState([]);
  const [dispatchTargetZone, setDispatchTargetZone] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const [teamMap, setTeamMap] = useState([]);
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamPayload, setNewTeamPayload] = useState({ name: '', phone: '', organization_name: '', organization_type: 'NGO', access_code: '' });

  useEffect(() => {
    let interval;
    if (activeTab === 'team') {
       const loadTeam = async () => {
         try {
           const res = await fetch('/api/v2/admin/team/map');
           const dt = await res.json();
           setTeamMap(Array.isArray(dt) ? dt : []);
         } catch(e){}
       }
       loadTeam();
       interval = setInterval(loadTeam, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  // Real-time location tracking via Socket.IO
  useEffect(() => {
    const handleLocationBroadcast = (msg) => {
      const nowFormatted = new Date().toISOString().replace('T', ' ').substring(0, 19);
      // Update Team Roster map seamlessly
      setTeamMap(prev => {
        let exists = false;
        const nxt = prev.map(t => {
          if (t.id === msg.volunteerId) {
            exists = true;
            return { ...t, lat: msg.lat, lng: msg.lng, last_updated: nowFormatted };
          }
          return t;
        });
        return exists ? nxt : prev;
      });
      // Update Operations tab map seamlessly
      setData(prev => {
        if (!prev.volunteers) return prev;
        const updatedVols = prev.volunteers.map(v => {
          if (v.id === msg.volunteerId) {
            return { ...v, lat: msg.lat, lon: msg.lng, last_updated: nowFormatted };
          }
          return v;
        });
        return { ...prev, volunteers: updatedVols };
      });
    };

    socket.on('locationBroadcast', handleLocationBroadcast);
    return () => socket.off('locationBroadcast', handleLocationBroadcast);
  }, []);

  const loadData = async () => {
    try {
      const [d, v, s, act, dn] = await Promise.all([
        fetchDisasters(), fetchVolunteers(), fetchShelters(), fetchActivity(),
        fetch('/api/v2/donations/top').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      setData({ 
        disasters: Array.isArray(d) ? d : [], 
        volunteers: Array.isArray(v) ? v : [], 
        shelters: Array.isArray(s) ? s : [], 
        activity: Array.isArray(act) ? act : [], 
        donors: Array.isArray(dn) ? dn : [] 
      });
      
      // Sync dispatched zones from backend — only overwrite optimistic state if backend has real data
      const safeVolunteers = Array.isArray(v) ? v : [];
      const onMissionVols = safeVolunteers.filter(vol => vol.status === 'ON_MISSION');
      if (onMissionVols.length > 0) {
        const synced = onMissionVols.map(vol => {
          const zoneReports = (d || []).filter(rep => rep.assigned_volunteer_id === vol.id && rep.status !== 'RESOLVED');
          const zoneId = zoneReports.length > 0
            ? `${zoneReports[0].lat.toFixed(2)},${zoneReports[0].lon.toFixed(2)}`
            : 'Remote';
          return {
            id: `M-${vol.id}`,
            volunteerId: vol.id,
            volunteerName: vol.name,
            zoneId,
            alerts: zoneReports,
            dispatchedAt: vol.created_at ? new Date(vol.created_at).toLocaleTimeString() : new Date().toLocaleTimeString()
          };
        }).filter(z => z.alerts.length > 0);
        setDispatchedZones(synced);
        setActiveMissions(synced);
      } else {
        setDispatchedZones([]);
      }

      // Sync resolved zones
      const resVolsMap = {};
      (d || []).filter(rep => rep.status === 'RESOLVED' && rep.assigned_volunteer_id).forEach(rep => {
         if (!resVolsMap[rep.assigned_volunteer_id]) {
             resVolsMap[rep.assigned_volunteer_id] = [];
         }
         resVolsMap[rep.assigned_volunteer_id].push(rep);
      });
      const syncedResolved = Object.keys(resVolsMap).map(volId => {
         const vol = (v || []).find(x => x.id === parseInt(volId)) || { name: `Volunteer #${volId}` };
         return {
             id: `R-${volId}`,
             volunteerId: parseInt(volId),
             volunteerName: vol.name,
             alerts: resVolsMap[volId]
         };
      });
      setResolvedZones(syncedResolved);

    } catch (e) {
      console.error("Admin Load Error:", e);
    }
  };

  useEffect(() => { loadData(); const i = setInterval(loadData, 8000); return () => clearInterval(i); }, []);

  // Volunteer Management (Persistent)
  const handleAddTeamSubmit = async () => {
    if (!newTeamPayload.name) return;
    try {
      await fetch('/api/v2/volunteers', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
           name: newTeamPayload.name, 
           phone: newTeamPayload.phone, 
           organization_name: newTeamPayload.organization_name, 
           organization_type: newTeamPayload.organization_type,
           access_code: newTeamPayload.access_code,
           skills: 'Search and Rescue', lat: 26.76, lon: 83.37 
        })
      });
      setShowAddTeamModal(false);
      setNewTeamPayload({ name: '', phone: '', organization_name: '', organization_type: 'NGO', access_code: '' });
      loadData();
    } catch (e) {}
  };

  const handleRemoveVolunteer = async (id) => {
    try {
      await fetch(`/api/v2/volunteers/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {}
  };

  const handleDispatch = async (volunteerId, zoneId, alerts) => {
    const volunteer = data.volunteers.find(v => v.id === volunteerId);
    if (!volunteer) return;

    // Optimistic UI: move zone immediately
    const newMission = {
      id: `M-${volunteerId}-${Date.now()}`,
      volunteerId,
      volunteerName: volunteer.name,
      zoneId,
      alerts,
      dispatchedAt: new Date().toLocaleTimeString()
    };
    setDispatchedZones(prev => [newMission, ...prev.filter(z => z.zoneId !== zoneId)]);
    setDispatchTargetZone(null);

    try {
      await fetch('/api/v2/dispatch', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ volunteer_id: volunteerId, report_ids: alerts.map(a => a.id) })
      });
      loadData();
    } catch (e) {}
  };

  const handleAssignNearest = (zone) => {
      if(!zone.id || typeof zone.id !== 'string') return;
      const [zlat, zlon] = zone.id.split(',').map(Number);
      
      const available = (data.volunteers || []).filter(v => v.status !== 'ON_MISSION');
      if (available.length === 0) {
        alert("CRITICAL ERROR: No available personnel to dispatch.");
        return;
      }
      
      let nearest = available[0];
      let minDist = Infinity;
      available.forEach(v => {
         const dx = (v.lat || 0) - zlat;
         const dy = (v.lon || 0) - zlon;
         const dist = dx*dx + dy*dy;
         if (dist < minDist) {
            minDist = dist;
            nearest = v;
         }
      });
      alert(`NEAREST FOUND: ${nearest.name} [${nearest.organization_type}]. Auto-binding to Zone ${zone.id}.`);
      handleDispatch(nearest.id, zone.id, zone.alerts);
  };

  const handleCompleteMission = async (volunteerId) => {
    // Optimistic UI: remove zone immediately
    setDispatchedZones(prev => prev.filter(z => z.volunteerId !== volunteerId));
    // Optimistically add to resolved
    const completedZone = dispatchedZones.find(z => z.volunteerId === volunteerId);
    if(completedZone) {
       setResolvedZones(prev => [{...completedZone, id: `R-${volunteerId}-${Date.now()}`}, ...prev]);
    }
    try {
      await fetch('/api/v2/missions/complete', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ volunteer_id: volunteerId })
      });
      loadData();
    } catch (e) {}
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMsg) return;
    try {
      await fetch('/api/v2/broadcast', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ message: broadcastMsg })
      });
      alert("Priority Signal Broadcasted!");
      setBroadcastMsg("");
      loadData();
    } catch (e) {}
  };

  const handleUpdateIncidentStatus = async (id, status) => {
    try {
      await fetch(`/api/v2/disasters/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setSelectedId(null);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // SS1 + SS4 UNIFIED STATS
  const stats = [
    { label: 'Pending Signals', val: (data.disasters || []).filter(d => d.status === 'REPORTED' || d.status === 'NEW').length, clr: '#e8630a', icon: AlertCircle },
    { label: 'Active Rescue', val: (data.disasters || []).filter(d => d.status === 'ACTIVE' || d.status === 'DISPATCHED').length, clr: '#3b82f6', icon: Activity },
    { label: 'Resolved SOS', val: (data.disasters || []).filter(d => d.status === 'RESOLVED').length, clr: '#10e882', icon: CheckCircle2 },
    { label: 'Total Aid Sent', val: '₹' + ((data.donors || []).reduce((acc, d) => acc + (parseFloat(d.amount)||0), 0) / 100000).toFixed(1) + 'L', clr: '#a78bfa', icon: CreditCard },
  ];

  // AREA-WISE GROUPING LOGIC
  const groupDisastersByArea = () => {
    const groups = {};
    (data.disasters || [])
      .filter(d => d.status !== 'DISPATCHED' && d.status !== 'RESOLVED')
      .forEach(d => {
        const zoneKey = `${(d.lat||0).toFixed(2)},${(d.lon||0).toFixed(2)}`;
        if (!groups[zoneKey]) groups[zoneKey] = { id: zoneKey, alerts: [] };
        groups[zoneKey].alerts.push(d);
      });
    return Object.values(groups).sort((a,b) => b.alerts.length - a.alerts.length);
  };

  const tacticalZones = groupDisastersByArea();

  // ─── Tab bar styles ───────────────────────────────────────────────────
  const tabBtn = (id, label, icon) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{
        padding: '10px 24px',
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        fontWeight: 800,
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.2s',
        background: activeTab === id
          ? 'linear-gradient(135deg, var(--accent), #f97316)'
          : 'var(--surface3)',
        color: activeTab === id ? 'white' : 'var(--text3)',
        boxShadow: activeTab === id ? '0 4px 16px rgba(232,99,10,0.25)' : 'none',
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <AppShell title="Jeevan Setu" sub="ADMIN PANEL · MISSION CRITICAL INTEL" activeAlerts={stats[0].val}>
      <div className="page" style={{maxWidth:1600, padding:'32px 48px', margin:'0 auto'}}>
        
        {/* ADD TEAM MODAL */}
        {showAddTeamModal && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)'}}>
             <div className="card" style={{width:500, padding:40, borderRadius:32, border:'1px solid var(--accent)'}}>
                <div style={{fontSize:18, fontWeight:900, marginBottom:24, color:'var(--accent)'}}>＋ DEPLOY NEW ASSET</div>
                
                <div style={{display:'flex', flexDirection:'column', gap:16}}>
                   <input type="text" className="input" style={{color: 'white', background: 'var(--surface3)'}} placeholder="Staff Name" value={newTeamPayload.name} onChange={e=>setNewTeamPayload({...newTeamPayload, name: e.target.value})} />
                   <input type="text" className="input" style={{color: 'white', background: 'var(--surface3)'}} placeholder="Phone Number" value={newTeamPayload.phone} onChange={e=>setNewTeamPayload({...newTeamPayload, phone: e.target.value})} />
                   <input type="text" className="input" style={{color: 'white', background: 'var(--surface3)'}} placeholder="Organization Name (Optional)" value={newTeamPayload.organization_name} onChange={e=>setNewTeamPayload({...newTeamPayload, organization_name: e.target.value})} />
                   <select className="input" style={{color: 'white', background: 'var(--surface3)'}} value={newTeamPayload.organization_type} onChange={e=>setNewTeamPayload({...newTeamPayload, organization_type: e.target.value})}>
                      <option value="NGO">NGO (Non-Government)</option>
                      <option value="GOVT">GOVT (Government Asset)</option>
                      <option value="PRIVATE">PRIVATE (Independent/Corporate)</option>
                   </select>
                   <div style={{borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4}}>
                     <div style={{fontSize: 10, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10}}>🔐 Responder Access Token</div>
                     <input type="text" className="input" style={{color: 'white', background: 'var(--surface3)', fontFamily: 'var(--mono)', letterSpacing: 2}} placeholder="Set login token (e.g. FORCE-2024)" value={newTeamPayload.access_code} onChange={e=>setNewTeamPayload({...newTeamPayload, access_code: e.target.value})} />
                     <div style={{fontSize: 10, color: '#94a3b8', marginTop: 8}}>Share this token with the responder — they'll use their Name + Token to login on the mobile app.</div>
                   </div>
                </div>

                <div style={{display:'flex', gap:10, marginTop:32}}>
                   <button className="btn btn-ghost" style={{flex:1}} onClick={() => setShowAddTeamModal(false)}>Abort</button>
                   <button className="btn btn-primary" style={{flex:1}} onClick={handleAddTeamSubmit}>Deploy Force</button>
                </div>
             </div>
          </div>
        )}

        {/* DISPATCH OVERLAY */}
        {dispatchTargetZone && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)'}}>
             <div className="card" style={{width:500, padding:40, borderRadius:32, border:'1px solid var(--accent)'}}>
                <div style={{fontSize:18, fontWeight:900, marginBottom:24, color:'var(--accent)'}}>🎯 SELECT TACTICAL PERSONNEL</div>
                <div style={{fontSize:12, color:'var(--text3)', marginBottom:32}}>Assigning responder to Zone: {dispatchTargetZone.id}</div>
                
                <div style={{display:'flex', flexDirection:'column', gap:16, maxHeight:400, overflowY:'auto', paddingRight:10}}>
                   {(data.volunteers || [])
                    .filter(v => v.status === 'AVAILABLE' || v.status === 'Active')
                    .map(v => (
                     <div 
                        key={v.id} 
                        onClick={() => handleDispatch(v.id, dispatchTargetZone.id, dispatchTargetZone.alerts)}
                        style={{padding:20, background:'var(--surface3)', borderRadius:16, border:'1px solid var(--border)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.2s'}}
                        className="hover-card"
                     >
                        <div>
                           <div style={{fontWeight:700, fontSize:14}}>{v.name}</div>
                           <div style={{fontSize:10, color:'var(--text3)', marginTop:4}}>{v.skills}</div>
                        </div>
                        <div style={{fontSize:10, fontWeight:900, color:'var(--green)'}}>ONLINE</div>
                     </div>
                   ))}
                   {data.volunteers.filter(v => v.status === 'AVAILABLE' || v.status === 'Active').length === 0 && (
                     <div style={{textAlign:'center', padding:40, color:'var(--text3)'}}>No available personnel found.</div>
                   )}
                </div>

                <button className="btn btn-ghost" style={{width:'100%', marginTop:32}} onClick={() => setDispatchTargetZone(null)}>Abort Dispatch</button>
             </div>
          </div>
        )}

        {/* STATS ROW */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:24, marginBottom:40}}>
           {stats.map((s,i)=>(
             <div key={i} className="card" style={{padding:32, borderBottom:`4px solid ${s.clr}`, borderRadius:20, background:'var(--surface2)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                   <span style={{fontSize:10, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5}}>{s.label}</span>
                   <div style={{width:32, height:32, borderRadius:8, background:s.clr+'15', color:s.clr, display:'flex', alignItems:'center', justifyContent:'center'}}>
                      <s.icon size={16} />
                   </div>
                </div>
                <div style={{fontSize:36, fontWeight:900, fontFamily:'var(--display)'}}>{s.val}</div>
                <div style={{fontSize:10, color:s.clr, marginTop:5, fontFamily:'var(--mono)', fontWeight:700}}>● REAL-TIME SYNC</div>
             </div>
           ))}
        </div>

        {/* TAB BAR */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {tabBtn('ops',     '⚡ Operations',       '')}
          {tabBtn('team',    '👥 Team Roster',      '')}
          {tabBtn('queue',   '🛡️ Verification Queue', '')}
          {tabBtn('payment', '💳 Payment Settings', '')}
        </div>

        {/* TEAM ROSTER TAB */}
        {activeTab === 'team' && (
           <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:32}}>
             <div className="card" style={{padding:0, borderRadius:28, overflow:'hidden', height:600}}>
                <MapContainer center={[26.7606, 83.3732]} zoom={12} style={{height:'100%', width:'100%', background:'#0a0d14'}}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.7} />
                  {teamMap.filter(t => (teamFilter==='ALL'||(t.organization_type||'PRIVATE')===teamFilter) && t.lat && t.lng).map(t => {
                     let clr = t.organization_type==='NGO'?'#3b82f6':t.organization_type==='GOVT'?'#eab308':'#10b981';
                     const timeNow = new Date().getTime();
                     const luDate = t.last_updated ? new Date(t.last_updated + "Z").getTime() : 0;
                     const isLive = (timeNow - luDate) < 15000;
                     
                     // Cache the icon globally on the component object or window to prevent re-creation
                     const cacheKey = `team-icon-${t.id}-${isLive}`;
                     if (!window._teamIconCache) window._teamIconCache = {};
                     if (!window._teamIconCache[cacheKey]) {
                         window._teamIconCache[cacheKey] = L.divIcon({
                            html: `<div style="background:${clr}; width:16px; height:16px; border-radius:50%; border:2px solid ${isLive?'#10b981':'#ffffff'}; box-shadow:0 0 10px ${isLive?'#10b981':clr}"></div>`,
                            className: 'custom-leaflet-icon'
                         });
                     }
                     const icon = window._teamIconCache[cacheKey];

                     return (
                       <Marker key={`team-${t.id}`} position={[t.lat, t.lng]} icon={icon}>
                          <Popup>
                            <div style={{color:'black', fontSize:12, padding:4}}>
                              <strong>{t.name}</strong><br/>
                              {t.organization_name || 'Independent Responder'}<br/>
                              {t.phone || 'No Contact Info'}<br/>
                              <span style={{color:clr, fontWeight:900, marginTop:4, display:'block'}}>{t.organization_type || 'PRIVATE'} TEAM</span>
                              <span style={{color: isLive ? '#10b981' : '#ef4444', fontWeight: 900, fontSize: 10, marginTop: 4, display: 'inline-block'}}>
                                {isLive ? '🟢 SYS LIVE (5s)' : '🔴 OFFLINE'}
                              </span>
                            </div>
                          </Popup>
                       </Marker>
                     )
                  })}
               </MapContainer>
             </div>
             
             <div className="card" style={{padding:32, borderRadius:28, maxHeight:600, overflowY:'auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
                  <div style={{fontSize:20, fontWeight:900, fontFamily:'var(--display)'}}>DEPLOYED ASSETS</div>
                  <button onClick={() => setShowAddTeamModal(true)} className="btn btn-primary" style={{padding:'8px 16px', fontSize:12, borderRadius:8}}>+ Add Force</button>
                </div>
                <div style={{display:'flex', gap:10, marginBottom:24}}>
                  {['ALL','NGO','GOVT','PRIVATE'].map(f => (
                     <button key={f} onClick={()=>setTeamFilter(f)} className={teamFilter===f?"btn btn-primary":"btn btn-ghost"} style={{fontSize:10, padding:'6px 12px'}}>{f}</button>
                  ))}
                </div>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                   <thead>
                     <tr style={{textAlign:'left', color:'var(--text3)', borderBottom:'1px solid var(--border)'}}>
                       <th style={{padding:12}}>Name / Phone</th>
                       <th style={{padding:12}}>Organization</th>
                       <th style={{padding:12}}>Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {teamMap.filter(t => teamFilter==='ALL'||(t.organization_type||'PRIVATE')===teamFilter).map(t => (
                       <tr key={t.id} style={{borderBottom:'1px solid var(--border)'}}>
                         <td style={{padding:12, fontWeight:700}}>{t.name}<br/><span style={{fontSize:10, color:'var(--text3)', fontWeight:400}}>{t.phone || 'No phone'}</span></td>
                         <td style={{padding:12}}>{t.organization_name || 'Independent'}<br/><span style={{fontSize:10, color:'var(--text3)'}}>{t.organization_type || 'PRIVATE'}</span></td>
                         <td style={{padding:12}}>
                            <span style={{padding:'4px 8px', borderRadius:4, background: t.status==='AVAILABLE'?'rgba(16,185,129,0.1)':'rgba(244,63,94,0.1)', color: t.status==='AVAILABLE'?'#10b981':'#f43f5e', fontSize:10, fontWeight:900}}>
                              {t.status}
                            </span>
                            { (() => {
                               const tNow = new Date().getTime();
                               const sLuDate = t.last_updated ? new Date(t.last_updated + "Z").getTime() : 0;
                               const diff = tNow - sLuDate;
                               
                               let statusText = 'OFFLINE';
                               let bgColor = 'rgba(100,116,139,0.1)';
                               let color = '#94a3b8';
                               
                               if (diff < 2 * 60 * 1000) {
                                 statusText = '⚡ ACTIVE';
                                 bgColor = 'rgba(16,185,129,0.1)';
                                 color = '#10b981';
                               } else if (diff < 10 * 60 * 1000) {
                                 statusText = '🟡 IDLE';
                                 bgColor = 'rgba(245,158,11,0.1)';
                                 color = '#f59e0b';
                               }
                               
                               return (
                                  <span style={{marginLeft: 8, padding:'4px 8px', borderRadius:4, background: bgColor, color: color, fontSize:10, fontWeight:900}}>
                                     {statusText}
                                  </span>
                               )
                            })() }
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
             </div>
           </div>
        )}

        {/* VERIFICATION QUEUE TAB */}
        {activeTab === 'queue' && (
          <PaymentRequestsQueue />
        )}

        {/* PAYMENT SETTINGS TAB */}
        {activeTab === 'payment' && (
          <div className="card" style={{ borderRadius: 28, padding: '40px 48px' }}>
            <PaymentSettings />
          </div>
        )}

        {/* OPERATIONS TAB */}
        {activeTab === 'ops' && <div style={{display:'grid', gridTemplateColumns:'1.4fr 0.6fr', gap:40}}>
           {/* LEFT CONTROL AREA */}
           <div style={{display:'flex', flexDirection:'column', gap:32}}>
              <div className="card" style={{height:550, position:'relative', borderRadius:28, overflow:'hidden'}}>
                 <div style={{position:'absolute', top:24, left:24, zIndex:1000, background:'rgba(8,11,16,0.95)', border:'1px solid var(--border)', borderRadius:16, padding:'12px 24px'}}>
                    <div style={{fontSize:11, fontWeight:900, color:'var(--accent)', display:'flex', alignItems:'center', gap:10}}>
                       <Globe size={14} className="animate-spin-slow" /> GLOBAL INTELLIGENCE MAP
                    </div>
                 </div>
                 <DisasterMap 
                   disasters={data.disasters} 
                   volunteers={data.volunteers} 
                   shelters={data.shelters} 
                   height="550px"
                   selectedId={selectedId}
                   onIncidentClick={(d) => setSelectedId(d.id)}
                 />
              </div>

              <div className="card" style={{borderRadius:28}}>
                 <div className="card-header" style={{padding:'24px 32px'}}><div className="card-title">📡 Tactical Response Queue (Area Grouped)</div></div>
                 <div className="card-body" style={{padding:'0 32px 32px 32px'}}>
                    {tacticalZones.length === 0 && (
                      <div style={{padding:60, textAlign:'center', color:'var(--text3)', fontSize:12}}>All tactical zones clear. Monitoring for signals...</div>
                    )}
                    {tacticalZones.map((zone) => (
                      <div key={zone.id} style={{marginBottom:32}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'var(--surface3)', borderRadius:12, marginBottom:12, border:'1px solid var(--border)'}}>
                           <div style={{fontSize:11, fontWeight:900, color:'var(--accent)', textTransform:'uppercase'}}>Tactical Zone: {zone.id}</div>
                           <div style={{display: 'flex', gap: 10}}>
                             <button 
                                className="btn" 
                                onClick={() => handleAssignNearest(zone)}
                                style={{fontSize:9, padding:'4px 10px', background:'rgba(16, 185, 129, 0.1)', color:'#10b981', border:'1px solid #10b981', borderRadius:8}}
                              >
                                 ⚡ Assign Nearest Active Responder
                              </button>
                             <button 
                                className="btn" 
                                onClick={() => setDispatchTargetZone(zone)}
                                style={{fontSize:9, padding:'4px 10px', background:'var(--accent)', color:'white', borderRadius:8}}
                              >
                                 Dispatch Target Group →
                              </button>
                           </div>
                        </div>
                        <table style={{width:'100%', borderCollapse:'collapse'}}>
                           <thead>
                              <tr style={{textAlign:'left', fontSize:10, color:'var(--text3)', textTransform:'uppercase', borderBottom:'1px solid var(--border)'}}>
                                 <th style={{padding:'12px 8px'}}>Alert Type</th>
                                 <th style={{padding:'12px 8px', width:'40%'}}>Situation Report</th>
                                 <th style={{padding:'12px 8px'}}>Priority</th>
                                 <th style={{padding:'12px 8px'}}>Action</th>
                              </tr>
                           </thead>
                           <tbody>
                              {zone.alerts.map(d => (
                                 <tr 
                                   key={d.id} 
                                   onClick={() => setSelectedId(d.id)}
                                   style={{
                                     fontSize:12, borderBottom:'1px solid var(--border)', 
                                     background: selectedId === d.id ? 'var(--accent)05' : 'transparent',
                                     borderLeft: selectedId === d.id ? '4px solid var(--accent)' : 'none',
                                     cursor:'pointer', transition:'all 0.1s'
                                   }}
                                 >
                                    <td style={{padding:'16px 8px', fontWeight:900, color:'var(--accent)'}}>{d.type || d.disaster_type}</td>
                                    <td style={{padding:'16px 8px', color:'var(--text2)', lineHeight:1.5}}>{d.description}</td>
                                    <td style={{padding:'16px 8px'}}>
                                       <div style={{width:32, height:32, borderRadius:'50%', border:`1px solid ${d.priority_score >= 7 ? '#f43f5e':'#3b82f6'}33`, display:'flex', alignItems:'center', justifyContent:'center', color:d.priority_score >= 7 ? '#f43f5e':'#3b82f6', fontWeight:900}}>
                                          {(d.priority_score||0).toFixed(1)}
                                       </div>
                                    </td>
                                    <td style={{padding:'16px 8px'}}>
                                       <button className="btn btn-ghost" style={{fontSize:10, padding:'6px 12px', borderRadius:20}}>Select Target</button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                      </div>
                    ))}
                 </div>
                 {/* DISPATCHED — WORK IN PROGRESS */}
               {dispatchedZones.length > 0 && (
                 <div className="card" style={{borderRadius:28, background:'rgba(232,99,10,0.04)', border:'1px solid rgba(232,99,10,0.3)'}}>
                    <div className="card-header" style={{padding:'24px 32px', borderBottom:'1px solid rgba(232,99,10,0.15)'}}>
                       <div style={{display:'flex', alignItems:'center', gap:12}}>
                          <div style={{width:10, height:10, borderRadius:'50%', background:'var(--accent)', animation:'pulse 1.5s infinite'}} />
                          <div className="card-title" style={{color:'var(--accent)'}}>🚧 Dispatched — Work In Progress</div>
                          <div style={{fontSize:10, color:'var(--text3)', marginLeft:'auto', fontFamily:'var(--mono)'}}>{dispatchedZones.length} ACTIVE ZONE{dispatchedZones.length>1?'S':''}</div>
                       </div>
                    </div>
                    <div className="card-body" style={{padding:'24px 32px', display:'flex', flexDirection:'column', gap:20}}>
                       {dispatchedZones.map(zone => (
                          <div key={zone.id} style={{background:'rgba(232,99,10,0.06)', borderRadius:16, border:'1px solid rgba(232,99,10,0.2)', overflow:'hidden'}}>
                             {/* Zone Header */}
                             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', background:'rgba(232,99,10,0.08)', borderBottom:'1px solid rgba(232,99,10,0.15)'}}>
                                <div style={{display:'flex', alignItems:'center', gap:12}}>
                                   <span style={{fontSize:16}}>🚧</span>
                                   <div>
                                      <div style={{fontSize:11, fontWeight:900, color:'var(--accent)', textTransform:'uppercase', letterSpacing:1}}>Zone {zone.zoneId}</div>
                                      <div style={{fontSize:10, color:'var(--text3)', marginTop:2}}>👤 {zone.volunteerName} · Dispatched at {zone.dispatchedAt}</div>
                                   </div>
                                </div>
                                <div style={{display:'flex', alignItems:'center', gap:12}}>
                                   <span style={{fontSize:10, fontWeight:900, color:'var(--accent)', padding:'4px 12px', background:'rgba(232,99,10,0.15)', borderRadius:20, border:'1px solid rgba(232,99,10,0.3)'}}>⚙ WORK IN PROGRESS</span>
                                   <button
                                      className="btn btn-primary"
                                      style={{fontSize:9, padding:'6px 14px', borderRadius:20, background:'#10b981', boxShadow:'none'}}
                                      onClick={() => handleCompleteMission(zone.volunteerId)}
                                   >
                                      ✓ Verify & Resolve
                                   </button>
                                </div>
                             </div>
                             {/* Alerts in this zone */}
                             <table style={{width:'100%', borderCollapse:'collapse'}}>
                                <thead>
                                   <tr style={{textAlign:'left', fontSize:9, color:'var(--text3)', textTransform:'uppercase', borderBottom:'1px solid rgba(232,99,10,0.1)'}}>
                                      <th style={{padding:'10px 20px'}}>Alert Type</th>
                                      <th style={{padding:'10px 20px', width:'45%'}}>Situation Report</th>
                                      <th style={{padding:'10px 20px'}}>Priority</th>
                                   </tr>
                                </thead>
                                <tbody>
                                   {(zone.alerts || []).map(d => (
                                      <tr key={d.id} style={{fontSize:11, borderBottom:'1px solid rgba(232,99,10,0.08)'}}>
                                         <td style={{padding:'12px 20px', fontWeight:800, color:'var(--accent)', opacity:0.8}}>{d.type || d.disaster_type}</td>
                                         <td style={{padding:'12px 20px', color:'var(--text2)'}}>{d.description}</td>
                                         <td style={{padding:'12px 20px'}}>
                                            <div style={{width:28, height:28, borderRadius:'50%', border:'1px solid rgba(232,99,10,0.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', fontWeight:900, fontSize:10}}>
                                               {(d.priority_score||0).toFixed(1)}
                                            </div>
                                         </td>
                                      </tr>
                                   ))}
                                </tbody>
                             </table>
                          </div>
                       ))}
                    </div>
                 </div>
               )}

               {/* RESOLVED ZONES */}
               {resolvedZones.length > 0 && (
                 <div className="card" style={{borderRadius:28, background:'rgba(16,185,129,0.04)', border:'1px solid rgba(16,185,129,0.3)', marginTop: 32}}>
                    <div className="card-header" style={{padding:'24px 32px', borderBottom:'1px solid rgba(16,185,129,0.15)'}}>
                       <div style={{display:'flex', alignItems:'center', gap:12}}>
                          <div style={{width:10, height:10, borderRadius:'50%', background:'#10b981'}} />
                          <div className="card-title" style={{color:'#10b981'}}>✅ Completed Field Missions</div>
                          <div style={{fontSize:10, color:'var(--text3)', marginLeft:'auto', fontFamily:'var(--mono)'}}>{resolvedZones.length} LOG{resolvedZones.length>1?'S':''}</div>
                       </div>
                    </div>
                    <div className="card-body" style={{padding:'24px 32px', display:'flex', flexDirection:'column', gap:20}}>
                       {resolvedZones.map(zone => (
                          <div key={zone.id} style={{background:'rgba(16,185,129,0.06)', borderRadius:16, border:'1px solid rgba(16,185,129,0.2)', overflow:'hidden'}}>
                             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', background:'rgba(16,185,129,0.08)', borderBottom:'1px solid rgba(16,185,129,0.15)'}}>
                                <div style={{display:'flex', alignItems:'center', gap:12}}>
                                   <span style={{fontSize:16}}>✅</span>
                                   <div>
                                      <div style={{fontSize:11, fontWeight:900, color:'#10b981', textTransform:'uppercase', letterSpacing:1}}>Mission Accomplished</div>
                                      <div style={{fontSize:10, color:'var(--text3)', marginTop:2}}>👤 Executed by {zone.volunteerName}</div>
                                   </div>
                                </div>
                                <span style={{fontSize:10, fontWeight:900, color:'#10b981', padding:'4px 12px', background:'rgba(16,185,129,0.15)', borderRadius:20, border:'1px solid rgba(16,185,129,0.3)'}}>RESOLVED</span>
                             </div>
                             <table style={{width:'100%', borderCollapse:'collapse'}}>
                                <tbody>
                                   {(zone.alerts || []).map(d => (
                                      <tr key={d.id} style={{fontSize:11, borderBottom:'1px solid rgba(16,185,129,0.08)'}}>
                                         <td style={{padding:'12px 20px', fontWeight:800, color:'#10b981', opacity:0.8}}>{d.type || d.disaster_type}</td>
                                         <td style={{padding:'12px 20px', color:'var(--text2)', width:'60%'}}>{d.description}</td>
                                      </tr>
                                   ))}
                                </tbody>
                             </table>
                          </div>
                       ))}
                    </div>
                 </div>
               )}

              </div>
           </div>

           {/* RIGHT COLUMN: STAFF + FIELD INTEL */}
           <div style={{display:'flex', flexDirection:'column', gap:32}}>
              
              {/* STAFF MANAGEMENT (REFACTORED) */}
              <div className="card" style={{borderRadius:28}}>
                 <div className="card-header" style={{padding:'24px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div className="card-title">👥 Tactical Staff</div>
                    <button 
                      onClick={() => setShowAddTeamModal(true)}
                      style={{width:24, height:24, borderRadius:'50%', background:'var(--accent)', color:'white', border:'none', fontSize:16, fontWeight:900, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}
                    >
                       +
                    </button>
                 </div>
                 <div className="card-body" style={{padding:'0 32px 32px 32px'}}>
                    <div style={{display:'grid', gridTemplateColumns:'1fr', gap:12}}>
                       {(data.volunteers || []).map(v => (
                          <div key={v.id} style={{padding:16, background:'var(--surface2)', borderRadius:16, border:'1px solid var(--border)', position:'relative'}}>
                             <button 
                                onClick={() => handleRemoveVolunteer(v.id)}
                                style={{position:'absolute', top:8, right:8, background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:14}}
                              >
                                 ×
                              </button>
                             <div style={{display:'flex', alignItems:'center', gap:12}}>
                                <div style={{width:32, height:32, borderRadius:8, background: (v.status === 'ON_MISSION' ? 'var(--accent)' : 'var(--green)') + '15', color: v.status === 'ON_MISSION' ? 'var(--accent)' : 'var(--green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16}}>
                                   {v.status === 'ON_MISSION' ? '🚁' : '🙋'}
                                </div>
                                <div style={{flex:1}}>
                                   <div style={{fontSize:13, fontWeight:700}}>{v.name}</div>
                                   <div style={{fontSize:10, color:'var(--text3)', marginTop:2}}>{v.skills || 'General Tactical'}</div>
                                </div>
                             </div>
                             <div style={{marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                 <div style={{fontSize:9, fontWeight:900, color: v.status === 'ON_MISSION' ? 'var(--accent)' : 'var(--green)', display:'flex', alignItems:'center', gap:5}}>
                                    <div style={{width:6, height:6, borderRadius:'50%', background: v.status === 'ON_MISSION' ? 'var(--accent)' : 'var(--green)'}} className='animate-pulse' />
                                    {v.status === 'ON_MISSION' ? 'WORK IN PROGRESS' : 'AVAILABLE'}
                                 </div>
                                <div style={{fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)'}}>{v.id}</div>
                             </div>
                          </div>
                       ))}
                       {data.volunteers.length === 0 && (
                         <div style={{textAlign:'center', padding:20, color:'var(--text3)', fontSize:11}}>No tactical staff online.</div>
                       )}
                    </div>
                 </div>
              </div>

              {/* FIELD INTEL */}

              <div className="card" style={{borderRadius:28, background:'#111827', border:'1px solid var(--accent)33'}}>
                 <div className="card-header" style={{padding:'24px 32px', background:'rgba(232,99,10,0.05)'}}><div className="card-title" style={{color:'var(--accent)', fontSize:12}}>⚠️ GLOBAL BROADCAST</div></div>
                 <div className="card-body" style={{padding:'0 32px 32px 32px'}}>
                    <div style={{color:'var(--text3)', fontSize:11, marginBottom:16, lineHeight:1.5}}>Enter a message to broadcast to all tactical terminals and citizen mobile units.</div>
                    <textarea 
                      className="form-input" 
                      placeholder="Dispatch command..." 
                      rows={4} 
                      value={broadcastMsg}
                      onChange={(e) => setBroadcastMsg(e.target.value)}
                      style={{background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:16, color:'white', padding:16, fontSize:13}}
                    />
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSendBroadcast}
                      style={{width:'100%', marginTop:24, padding:18, background:'linear-gradient(135deg, var(--accent), #f97316)', boxShadow:'0 8px 24px rgba(232,99,10,0.3)'}}
                    >
                       SEND PRIORITY SIGNAL
                    </button>
                 </div>
              </div>
           </div>
        </div>}

        {/* IMPACT FEED DETAILS MODAL (SELECTED ROW) */}
        {selectedId && data.disasters.find(d => d.id === selectedId) && (
          (() => {
             const selectedDisaster = data.disasters.find(d => d.id === selectedId);
             return (
              <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', padding: 20}}>
                 <div className="card" style={{width:'100%', maxWidth:700, padding:40, borderRadius:32, border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto'}}>
                    <div style={{fontSize:18, fontWeight:900, marginBottom:24, color:'var(--accent)', textTransform:'uppercase', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span>{selectedDisaster.type || selectedDisaster.disaster_type} Log Details</span>
                      <span style={{fontSize:10, backgroundColor:'rgba(244,63,94,0.15)', color:'#f43f5e', padding:'4px 10px', borderRadius:20}}>PRIORITY {(selectedDisaster.priority_score || selectedDisaster.priority || 0).toFixed(1)}</span>
                    </div>

                    {/* AI SEVERITY & STATUS BOX */}
                    <div style={{display:'flex', gap:20, marginBottom:24}}>
                       <div style={{flex:1, background: 'rgba(16,185,129,0.05)', border: '1px solid #10b981', borderRadius:16, padding:20}}>
                          <div style={{fontSize:10, fontWeight:800, color:'#10b981', marginBottom:8}}>🤖 AI VERIFICATION STATUS</div>
                          <div style={{fontSize:16, fontWeight:800}}>
                             {selectedDisaster.ai_verified === 1 ? '✅ Real Incident' : '⚠️ Unverified'} ({Math.round(selectedDisaster.ai_confidence * 100)}%)
                          </div>
                       </div>
                       <div style={{flex:1, background: 'rgba(244,63,94,0.05)', border:`1px solid ${selectedDisaster.severity_level==='CRITICAL'?'#f43f5e':selectedDisaster.severity_level==='HIGH'?'#f97316':selectedDisaster.severity_level==='MEDIUM'?'#fbbf24':'#10b981'}`, borderRadius:16, padding:20}}>
                          <div style={{fontSize:10, fontWeight:800, color:'var(--text3)', marginBottom:8}}>🚨 AI SEVERITY ASSESSMENT</div>
                          <div style={{fontSize:16, fontWeight:800, color: selectedDisaster.severity_level==='CRITICAL'?'#f43f5e':selectedDisaster.severity_level==='HIGH'?'#f97316':selectedDisaster.severity_level==='MEDIUM'?'#fbbf24':'#10b981'}}>
                             {selectedDisaster.severity_level || 'UNKNOWN'} (Score: {selectedDisaster.severity_score || 0})
                          </div>
                       </div>
                    </div>

                    {/* TWO COLUMN MEDIA/MAP | INFO */}
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24}}>
                        {/* Map & Images */}
                        <div style={{display:'flex', flexDirection:'column', gap:16}}>
                           <div style={{height:180, borderRadius:16, overflow:'hidden', border:'1px solid var(--border)', position:'relative'}}>
                              {selectedDisaster.lat ? (
                                 <MapContainer center={[selectedDisaster.lat, selectedDisaster.lon]} zoom={15} style={{height:'100%', width:'100%'}} zoomControl={false} scrollWheelZoom={false} dragging={false}>
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.7}/>
                                    <Marker position={[selectedDisaster.lat, selectedDisaster.lon]} />
                                 </MapContainer>
                              ) : <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', background:'var(--surface3)'}}>No GPS Data</div>}
                              <div style={{position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,0.8)', padding:'4px 8px', borderRadius:8, fontSize:10, fontWeight:800}}>📍 {selectedDisaster.lat?.toFixed(4)}, {selectedDisaster.lon?.toFixed(4)}</div>
                           </div>
                           
                           {/* Evidence Image */}
                           {selectedDisaster.image_url ? (
                              <div style={{height:180, borderRadius:16, border:'1px solid var(--border)', overflow:'hidden', background:'black', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                 <img src={`/api/v2/uploads/${selectedDisaster.image_url}`} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} alt="Evidence" />
                              </div>
                           ) : (
                              <div style={{height:80, borderRadius:16, border:'1px dashed var(--border)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:11}}>📸 No Evidence Photo Attachments</div>
                           )}
                        </div>

                        {/* Text Block */}
                        <div style={{display:'flex', flexDirection:'column', gap:16}}>
                           <div style={{background:'var(--surface3)', padding:24, borderRadius:16, border:'1px solid var(--border)', display:'flex', flexDirection:'column', flex:1}}>
                              <div style={{fontSize:10, color:'var(--text3)', fontWeight:900, marginBottom:10}}>RAW SITUATION DESCRIPTION</div>
                              <div style={{fontSize:13, color:'white', whiteSpace:'pre-wrap', lineHeight:1.6, fontFamily:'var(--mono)'}}>
                                 {selectedDisaster.description ? selectedDisaster.description : 'No detailed intelligence available for this trace.'}
                              </div>
                           </div>
                           
                           <div style={{background:'rgba(59,130,246,0.05)', padding:24, borderRadius:16, border:'1px solid rgba(59,130,246,0.2)', display:'flex', flexDirection:'column', flex:1}}>
                              <div style={{fontSize:10, color:'#3b82f6', fontWeight:900, marginBottom:10}}>🤖 AI SCENE ANALYSIS</div>
                              <div style={{fontSize:13, color:'white', whiteSpace:'pre-wrap', lineHeight:1.6}}>
                                 {selectedDisaster.ai_description ? selectedDisaster.ai_description : "Awaiting visual intelligence payload or fallback heuristics used."}
                              </div>
                           </div>
                        </div>
                    </div>

                    <div style={{marginTop:24, fontSize:10, color:'var(--text3)', textAlign:'center', textTransform:'uppercase'}}>
                      Logged at: {selectedDisaster.created_at ? new Date(selectedDisaster.created_at).toLocaleString() : 'Unknown Time'}
                       <br/>Status: {selectedDisaster.status}
                    </div>
                    
                    <div style={{display:'flex', gap:10, marginTop:32}}>
                      <button className="btn btn-ghost" style={{flex:1}} onClick={() => setSelectedId(null)}>Close Intel</button>
                      <button 
                         className="btn btn-primary" 
                         style={{flex:1.5, background: '#10b981', borderColor: 'transparent', color: '#fff'}}
                         onClick={() => handleUpdateIncidentStatus(selectedDisaster.id, 'VERIFIED')}
                      >
                         ✅ Approve & Verify Intelligence
                      </button>
                      <button 
                         className="btn btn-ghost" 
                         style={{flex:1.5, color: '#f43f5e', border: '1px solid #f43f5e'}}
                         onClick={() => handleUpdateIncidentStatus(selectedDisaster.id, 'REJECTED')}
                      >
                         🚫 Reject / Dismiss Verification
                      </button>
                    </div>
                 </div>
              </div>
             );
          })()
        )}

      </div>
    </AppShell>
  );
}
