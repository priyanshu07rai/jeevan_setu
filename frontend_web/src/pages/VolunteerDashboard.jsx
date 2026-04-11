import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socketService';

const SEVERITY = [
  { val:'low',      label:'LOW',      color:'#10b981', bg:'rgba(16,185,129,0.12)',  emoji:'🟢' },
  { val:'medium',   label:'MEDIUM',   color:'#f59e0b', bg:'rgba(245,158,11,0.12)', emoji:'🟡' },
  { val:'high',     label:'HIGH',     color:'#f43f5e', bg:'rgba(244,63,94,0.12)',  emoji:'🔴' },
  { val:'critical', label:'CRITICAL', color:'#e8630a', bg:'rgba(232,99,10,0.15)',  emoji:'🚨' },
];

export default function VolunteerDashboard() {
  const { user, logout } = useAuth();
  const [volunteer, setVolunteer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('mission');
  const chatEndRef = useRef(null);

  // Emergency coordination state
  const [emergencyAlert, setEmergencyAlert] = useState(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [severity, setSeverity] = useState('medium');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef(null);

  const volId = user?.volunteerId;

  // Socket room registration & Background Heartbeats
  useEffect(() => {
    if (!volId) return;
    
    const register = () => {
      socket.emit('register_volunteer', { volunteerId: volId });
      socket.emit('join', { user_id: volId });
    };

    if (socket.connected) {
      register();
    }
    socket.on('connect', register);

    // Maintain live status without needing GPS shifts
    const pingId = setInterval(() => {
       if (socket.connected) {
         socket.emit('heartbeat', { volunteerId: volId });
       }
    }, 45000); // 45 seconds

    return () => {
      socket.off('connect', register);
      clearInterval(pingId);
    };
  }, [volId]);

  useEffect(() => {
    if (!volId) return;
    const handleRequestUpdate = (data) => {
      alert(`🔔 Transfer Status Update:\n\n${data.message}`);
      // Refresh local data to reflect approved/rejected state changes
      loadData();
    };
    socket.on('request_update', handleRequestUpdate);
    return () => socket.off('request_update', handleRequestUpdate);
  }, [volId]);

  // Real-time volunteer location tracking
  useEffect(() => {
    if (!volId) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        socket.emit('locationUpdate', {
          volunteerId: volId,
          lat: latitude,
          lng: longitude
        });
      },
      (error) => console.error("GPS Tracking Error:", error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [volId]);

  const loadData = async () => {
    if (!volId) return;
    try {
      const [v, m, p] = await Promise.all([
        fetch(`/api/v2/volunteers/${volId}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/v2/volunteers/${volId}/messages`).then(r => r.ok ? r.json() : []),
        fetch(`/api/v2/volunteers/${volId}/proofs`).then(r => r.ok ? r.json() : []),
      ]);
      if (v && !v.error) setVolunteer(v);
      if (Array.isArray(m)) setMessages(m);
      if (Array.isArray(p)) setProofs(p);
    } catch(e) {}
  };

  useEffect(() => {
    loadData();
    const i = setInterval(loadData, 8000);
    return () => clearInterval(i);
  }, [volId]);

  useEffect(() => {
    const handleEmergencyRequest = (data) => {
      // Room-based dispatch, no need for targetIds filter here
      setEmergencyAlert(data);
    };
    socket.on('emergencyRequest', handleEmergencyRequest);
    return () => socket.off('emergencyRequest', handleEmergencyRequest);
  }, [volId]);

  const handleEmergencyResponse = (status) => {
    socket.emit('emergencyRespond', { volunteerId: volId, status, missionData: emergencyAlert });
    setEmergencyAlert(null);
    if (status === 'ACCEPTED') {
       setTimeout(loadData, 1000); // give backend a second to update
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!msgInput.trim()) return;
    setSending(true);
    const activeMissionId = active[0]?.id || null;
    const optimistic = { id: Date.now(), sender: 'volunteer', message: msgInput, mission_id: activeMissionId, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    const text = msgInput; setMsgInput('');
    try {
      await fetch(`/api/v2/volunteers/${volId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sender: 'volunteer', mission_id: activeMissionId })
      });
    } catch(e) {}
    setSending(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadDone(false);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setFilePreview({ type:'image', url: ev.target.result });
      reader.readAsDataURL(file);
    } else {
      setFilePreview({ type:'video', url: URL.createObjectURL(file) });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    const activeMissionId = active[0]?.id || null;
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('severity', severity);
    formData.append('caption', caption);
    if (activeMissionId) formData.append('mission_id', activeMissionId);
    try {
      const r = await fetch(`/api/v2/volunteers/${volId}/proofs`, { method:'POST', body: formData });
      if (r.ok) {
        setUploadDone(true);
        setSelectedFile(null); setFilePreview(null); setCaption('');
        await loadData();
      }
    } catch(e) {}
    setUploading(false);
  };

  const clearFile = () => { setSelectedFile(null); setFilePreview(null); setUploadDone(false); };

  const missions   = volunteer?.missions || [];
  const active     = missions.filter(m => m.status === 'DISPATCHED');
  const resolved   = missions.filter(m => m.status === 'RESOLVED');
  const isDeployed = volunteer?.status === 'ON_MISSION';

  const tabs = [
    { key:'mission',   label:'📋 Assignments',       count: missions.length },
    { key:'messages',  label:'📡 Command Messages',   count: messages.filter(m => m.sender==='admin').length },
    { key:'evidence',  label:'📸 Field Evidence',     count: proofs.length },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text1)', display:'flex', flexDirection:'column' }}>

      {/* Topbar */}
      <div style={{ height:56, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 40px', gap:20, background:'var(--surface)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:'rgba(232,99,10,0.15)', border:'1px solid rgba(232,99,10,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🛰</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--accent)', fontWeight:700, letterSpacing:1 }}>DISASTER INTEL</div>
        </div>
        <div style={{ width:1, height:20, background:'var(--border)' }} />
        <div style={{ fontFamily:'var(--display)', fontSize:14, fontWeight:900 }}>Field Portal</div>
        <div style={{ flex:1 }} />
        <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
          OPERATIVE: <span style={{ color:'var(--accent)', fontWeight:700 }}>{user?.name?.toUpperCase()}</span>
        </div>
        <div style={{ width:8, height:8, borderRadius:'50%', background: isDeployed ? '#e8630a' : '#10b981', boxShadow:`0 0 8px ${isDeployed ? '#e8630a' : '#10b981'}` }} />
        <div style={{ fontSize:11, fontWeight:700, color: isDeployed ? '#e8630a' : '#10b981' }}>{isDeployed ? 'DEPLOYED' : 'STANDBY'}</div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:900, margin:'0 auto', width:'100%', padding:'32px 40px', display:'flex', flexDirection:'column', gap:28 }}>

        {/* Identity Header */}
        <div style={{ display:'flex', alignItems:'center', gap:20, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:24, padding:'24px 32px' }}>
          <div style={{ width:56, height:56, borderRadius:18, background: isDeployed ? 'rgba(232,99,10,0.15)' : 'rgba(16,185,129,0.12)', border:`2px solid ${isDeployed ? 'rgba(232,99,10,0.4)' : 'rgba(16,185,129,0.4)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
            {isDeployed ? '🚧' : '🙋'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--display)', fontSize:22, fontWeight:900 }}>{user?.name}</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>{volunteer?.skills || 'Field Operations'}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:12, fontWeight:900, color: isDeployed ? '#e8630a' : '#10b981', display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: isDeployed ? '#e8630a' : '#10b981', boxShadow:`0 0 8px ${isDeployed ? '#e8630a' : '#10b981'}` }} />
              {isDeployed ? 'DEPLOYED' : 'AVAILABLE'}
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:4, fontFamily:'var(--mono)' }}>ID #{volId}</div>
          </div>
          <button onClick={logout} style={{ background:'none', border:'1px solid var(--border)', borderRadius:12, padding:'8px 16px', color:'var(--text3)', cursor:'pointer', fontSize:12, marginLeft:12 }}>
            Sign Out
          </button>
        </div>

        {/* Active Mission Banner */}
        {isDeployed && active.length > 0 && (
          <div style={{ background:'rgba(232,99,10,0.06)', border:'1px solid rgba(232,99,10,0.3)', borderRadius:20, padding:'24px 32px' }}>
            <div style={{ fontSize:11, fontWeight:900, color:'var(--accent)', textTransform:'uppercase', letterSpacing:2, marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', animation:'pulse 1.5s infinite' }} />
              Your Active Assignment
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
              {[
                { label:'Incident Type', val: active[0]?.type || 'Unknown' },
                { label:'GPS Location',  val: active[0] ? `${active[0].lat?.toFixed(4)}, ${active[0].lon?.toFixed(4)}` : 'N/A', mono:true },
                { label:'Total Incidents', val: active.length },
              ].map((s,i) => (
                <div key={i} style={{ background:'rgba(232,99,10,0.08)', borderRadius:14, padding:'18px' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{s.label}</div>
                  <div style={{ fontSize:s.mono ? 12 : 18, fontWeight:900, fontFamily: s.mono ? 'var(--mono)' : undefined, color: s.mono ? 'var(--accent)' : 'var(--text1)' }}>{s.val}</div>
                </div>
              ))}
            </div>
            {active.map(a => (
              <div key={a.id} style={{ marginTop:12, background:'rgba(232,99,10,0.05)', border:'1px solid rgba(232,99,10,0.15)', borderRadius:12, padding:'14px 18px', fontSize:13, lineHeight:1.6, color:'var(--text2)' }}>
                <span style={{ fontWeight:700, color:'var(--accent)', marginRight:8 }}>⚠</span>{a.description}
              </div>
            ))}
          </div>
        )}

        {!isDeployed && (
          <div style={{ background:'rgba(16,185,129,0.04)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:20, padding:'24px 32px', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:28 }}>🟢</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#10b981', marginBottom:4 }}>On Standby</div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>No active assignment. Wait for command center to dispatch you.</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, background:'var(--surface2)', padding:5, borderRadius:16, width:'fit-content', border:'1px solid var(--border)' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding:'10px 18px', borderRadius:12, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, transition:'all 0.15s',
                background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.key ? 'white' : 'var(--text3)',
                display:'flex', alignItems:'center', gap:7
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{ fontSize:10, background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--surface3)', padding:'2px 6px', borderRadius:10 }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── ASSIGNMENTS TAB ── */}
        {activeTab === 'mission' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {missions.length === 0 && (
              <div style={{ textAlign:'center', padding:60, color:'var(--text3)', fontSize:13, background:'var(--surface2)', borderRadius:20, border:'1px solid var(--border)' }}>No assignments yet.</div>
            )}
            {missions.map(m => {
              const ms = m.status === 'DISPATCHED' ? { c:'#e8630a', l:'IN PROGRESS', icon:'🚧' } : { c:'#10b981', l:'RESOLVED', icon:'✅' };
              return (
                <div key={m.id} style={{ background:'var(--surface2)', border:`1px solid ${ms.c}33`, borderRadius:18, overflow:'hidden' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 24px', background:`${ms.c}08`, borderBottom:`1px solid ${ms.c}22` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:18 }}>{ms.icon}</span>
                      <div>
                        <div style={{ fontWeight:800, fontSize:14, textTransform:'capitalize' }}>{m.type || 'Disaster'}</div>
                        <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:10, fontWeight:900, color: ms.c, background:`${ms.c}15`, padding:'4px 12px', borderRadius:20 }}>{ms.l}</div>
                  </div>
                  <div style={{ padding:'16px 24px', display:'grid', gridTemplateColumns:'1fr 2fr 80px', gap:20 }}>
                    <div><div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>Location</div>
                      <div style={{ fontSize:12, fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)' }}>{m.lat?.toFixed(4)}, {m.lon?.toFixed(4)}</div></div>
                    <div><div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>Situation</div>
                      <div style={{ fontSize:13, lineHeight:1.5 }}>{m.description}</div></div>
                    <div><div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>Severity</div>
                      <div style={{ fontSize:24, fontWeight:900, color: (m.severity||0) >= 7 ? '#f43f5e' : '#3b82f6' }}>{(m.severity||0).toFixed(1)}</div></div>
                  </div>
                </div>
              );
            })}
            {missions.length > 0 && (
              <div style={{ display:'flex', gap:14 }}>
                <div style={{ flex:1, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:16, padding:'16px 20px', textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:900, color:'#10b981' }}>{resolved.length}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Missions Resolved</div>
                </div>
                <div style={{ flex:1, background:'rgba(232,99,10,0.06)', border:'1px solid rgba(232,99,10,0.2)', borderRadius:16, padding:'16px 20px', textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:900, color:'var(--accent)' }}>{active.length}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Active Now</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── COMMAND MESSAGES TAB ── */}
        {activeTab === 'messages' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>
              <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:11, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5 }}>📡 Command Center Messages</div>
                <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>auto-refresh 8s</div>
              </div>
              <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:12, maxHeight:420, overflowY:'auto', minHeight:200 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign:'center', padding:48, color:'var(--text3)', fontSize:12 }}>No messages yet. Command center will send you updates here.</div>
                )}
                {messages.map(msg => {
                  const isAdmin = msg.sender === 'admin';
                  return (
                    <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignItems: isAdmin ? 'flex-start' : 'flex-end' }}>
                      <div style={{ maxWidth:'75%', padding:'12px 16px',
                        borderRadius: isAdmin ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                        background: isAdmin ? 'rgba(232,99,10,0.12)' : 'var(--surface3)',
                        border: isAdmin ? '1px solid rgba(232,99,10,0.25)' : '1px solid var(--border)',
                        fontSize:13, lineHeight:1.6
                      }}>
                        <div style={{ fontSize:10, fontWeight:700, marginBottom:4, color: isAdmin ? 'var(--accent)' : 'var(--text3)' }}>
                          {isAdmin ? '📡 Command Center' : '🙋 You'}
                        </div>
                        {msg.message}
                        <div style={{ fontSize:9, opacity:0.5, marginTop:5 }}>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Send status update to command..."
                style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:16, padding:'14px 20px', color:'white', fontSize:13, outline:'none' }}
                onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'}
              />
              <button onClick={sendMessage} disabled={sending||!msgInput.trim()}
                style={{ background:'var(--accent)', border:'none', borderRadius:16, padding:'14px 24px', color:'white', fontWeight:900, fontSize:13, cursor:'pointer', opacity:(sending||!msgInput.trim())?0.5:1 }}>
                {sending?'...':'Send ↑'}
              </button>
            </div>
          </div>
        )}

        {/* ── FIELD EVIDENCE TAB ── */}
        {activeTab === 'evidence' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Upload Panel */}
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>
              <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5 }}>
                📤 Upload Field Evidence
              </div>
              <div style={{ padding:'24px' }}>
                {/* File drop zone */}
                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{ border:'2px dashed rgba(232,99,10,0.35)', borderRadius:16, padding:'40px 24px', textAlign:'center', cursor:'pointer', transition:'all 0.2s', background:'rgba(232,99,10,0.02)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(232,99,10,0.6)'; e.currentTarget.style.background='rgba(232,99,10,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(232,99,10,0.35)'; e.currentTarget.style.background='rgba(232,99,10,0.02)'; }}
                  >
                    <div style={{ fontSize:36, marginBottom:12 }}>📷</div>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>Tap to attach photo or video</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>JPG, PNG, GIF, MP4, MOV supported</div>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display:'none' }} onChange={handleFileSelect} />
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {/* Preview */}
                    <div style={{ position:'relative', borderRadius:14, overflow:'hidden', background:'#000', maxHeight:280 }}>
                      {filePreview?.type === 'image' ? (
                        <img src={filePreview.url} alt="preview" style={{ width:'100%', maxHeight:280, objectFit:'contain' }} />
                      ) : (
                        <video src={filePreview?.url} controls style={{ width:'100%', maxHeight:280 }} />
                      )}
                      <button onClick={clearFile}
                        style={{ position:'absolute', top:10, right:10, width:30, height:30, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'none', color:'white', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ×
                      </button>
                      <div style={{ position:'absolute', bottom:10, left:10, fontSize:11, color:'white', background:'rgba(0,0,0,0.6)', padding:'4px 10px', borderRadius:8, fontFamily:'var(--mono)' }}>
                        {selectedFile.name}
                      </div>
                    </div>

                    {/* Severity selector */}
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10 }}>
                        Situation Severity
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                        {SEVERITY.map(s => (
                          <button key={s.val} type="button" onClick={() => setSeverity(s.val)}
                            style={{ padding:'10px 6px', borderRadius:12, border:`1.5px solid ${severity===s.val ? s.color : 'var(--border)'}`,
                              background: severity===s.val ? s.bg : 'var(--surface3)',
                              cursor:'pointer', transition:'all 0.15s', textAlign:'center'
                            }}
                          >
                            <div style={{ fontSize:18, marginBottom:4 }}>{s.emoji}</div>
                            <div style={{ fontSize:9, fontWeight:900, color: severity===s.val ? s.color : 'var(--text3)' }}>{s.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Caption */}
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:8 }}>
                        Situation Description
                      </div>
                      <textarea
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder="Describe what you see, number of people affected, immediate needs..."
                        rows={3}
                        style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', color:'white', fontSize:13, resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.6 }}
                        onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'}
                      />
                    </div>

                    <button onClick={handleUpload} disabled={uploading}
                      style={{ width:'100%', padding:'16px', background: uploading ? 'rgba(232,99,10,0.5)' : 'var(--accent)', border:'none', borderRadius:14, color:'white', fontWeight:900, fontSize:14, cursor:'pointer' }}>
                      {uploading ? '⏳ Uploading...' : '📤 Submit Field Evidence'}
                    </button>

                    {uploadDone && (
                      <div style={{ textAlign:'center', fontSize:12, color:'#10b981', fontWeight:700 }}>✅ Evidence submitted to command center</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Evidence Gallery */}
            {proofs.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ fontSize:12, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5 }}>Submitted Evidence Log</div>
                {proofs.map(p => {
                  const sev = SEVERITY.find(s => s.val === p.severity) || SEVERITY[1];
                  const url = `/api/v2/uploads/${p.filename}`;
                  return (
                    <div key={p.id} style={{ background:'var(--surface2)', border:`1px solid ${sev.color}33`, borderRadius:16, overflow:'hidden' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', background:`${sev.color}08`, borderBottom:`1px solid ${sev.color}15` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span>{sev.emoji}</span>
                          <div style={{ fontSize:10, fontWeight:900, color: sev.color }}>{sev.label} PRIORITY</div>
                        </div>
                        <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                          {p.created_at ? new Date(p.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:16, padding:'16px 20px', alignItems:'flex-start' }}>
                        {/* Thumbnail */}
                        <div style={{ width:100, height:75, borderRadius:10, overflow:'hidden', background:'#000', flexShrink:0 }}>
                          {p.file_type === 'image' ? (
                            <img src={url} alt={p.original_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          ) : (
                            <video src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          )}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6, fontFamily:'var(--mono)' }}>{p.original_name}</div>
                          {p.caption && <div style={{ fontSize:13, lineHeight:1.6, color:'var(--text2)' }}>{p.caption}</div>}
                          <a href={url} target="_blank" rel="noreferrer"
                            style={{ fontSize:10, color:'var(--accent)', marginTop:8, display:'inline-block', textDecoration:'none', fontWeight:700 }}>
                            ↗ View Full {p.file_type === 'video' ? 'Video' : 'Image'}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {proofs.length === 0 && (
              <div style={{ textAlign:'center', padding:40, color:'var(--text3)', fontSize:12 }}>No evidence submitted yet.</div>
            )}
          </div>
        )}

      </div>

      {/* Emergency Alert Modal */}
      {emergencyAlert && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(15px)' }}>
          <div style={{ width:400, background:'#0a0a0a', border:'2px solid #e8630a', borderRadius:24, padding:32, textAlign:'center', boxShadow:'0 0 50px rgba(232,99,10,0.4)', animation: 'pulse 1.5s infinite' }}>
             <div style={{ fontSize:48, marginBottom:16 }}>🚨</div>
             <div style={{ fontSize:18, fontWeight:900, color:'#e8630a', textTransform:'uppercase', letterSpacing:1.5, marginBottom:8 }}>CRITICAL DISPATCH</div>
             <div style={{ fontSize:15, color:'white', fontWeight:800, marginBottom:16 }}>{emergencyAlert.incidentType} Incident</div>
             <div style={{ fontSize:13, color:'var(--text2)', marginBottom:24, lineHeight:1.6 }}>{emergencyAlert.message}</div>
             <div style={{ background:'rgba(232,99,10,0.1)', border:'1px solid rgba(232,99,10,0.2)', padding:14, borderRadius:12, marginBottom:24, fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)' }}>
                📍 {emergencyAlert.location}
             </div>
             <div style={{ display:'flex', gap:10 }}>
               <button onClick={() => handleEmergencyResponse('REJECTED')} style={{ flex:1, padding:14, borderRadius:12, border:'none', background:'var(--surface3)', color:'white', fontWeight:700, cursor:'pointer' }}>Abort</button>
               <button onClick={() => handleEmergencyResponse('ACCEPTED')} style={{ flex:2, padding:14, borderRadius:12, border:'none', background:'#e8630a', color:'white', fontWeight:900, fontSize:14, cursor:'pointer' }}>ACCEPT MISSION</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
