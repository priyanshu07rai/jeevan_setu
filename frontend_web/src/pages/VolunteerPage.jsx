import React, { useState, useEffect, useRef } from 'react';
import AppShell from '../components/AppShell';
import socket from '../services/socketService';

const STATUS_CONFIG = {
  AVAILABLE:   { label: 'Available',        color: '#10b981', bg: 'rgba(16,185,129,0.12)',  pulse: true  },
  ON_MISSION:  { label: 'Work In Progress', color: '#e8630a', bg: 'rgba(232,99,10,0.12)',  pulse: true  },
  OFFLINE:     { label: 'Offline',          color: '#6b7280', bg: 'rgba(107,114,128,0.1)', pulse: false },
};

/* ─── REGISTER MODAL ────────────────────────────────────── */
function RegisterModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [skills, setSkills] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) { setErr('Name and Access Code are required.'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch('https://jeevansetu-api.onrender.com/api/v2/volunteers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), skills: skills.trim() || 'Field Operations', access_code: code.trim() })
      });
      if (r.ok) { onSave(); onClose(); }
      else { const d = await r.json(); setErr(d.error || 'Server error'); }
    } catch(e) { setErr('Network error'); }
    setSaving(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(10px)' }}>
      <div style={{ width:460, background:'#0d1117', border:'1px solid rgba(232,99,10,0.4)', borderRadius:28, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ background:'rgba(232,99,10,0.08)', borderBottom:'1px solid rgba(232,99,10,0.2)', padding:'28px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:900, color:'var(--accent)' }}>
              ➕ Register New Volunteer
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
              Credentials will be used for field portal login
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:'32px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5, display:'block', marginBottom:8 }}>
                Full Name *
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 18px', color:'white', fontSize:14, outline:'none', boxSizing:'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5, display:'block', marginBottom:8 }}>
                Skills / Role
              </label>
              <input
                value={skills}
                onChange={e => setSkills(e.target.value)}
                placeholder="e.g. Medical, Search and Rescue"
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 18px', color:'white', fontSize:14, outline:'none', boxSizing:'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:1.5, display:'block', marginBottom:8 }}>
                🔑 Access Code (Login Key) *
              </label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. ALPHA-7742"
                style={{ width:'100%', background:'rgba(232,99,10,0.05)', border:'1px solid rgba(232,99,10,0.4)', borderRadius:14, padding:'14px 18px', color:'var(--accent)', fontSize:14, fontFamily:'var(--mono)', letterSpacing:2, outline:'none', boxSizing:'border-box' }}
              />
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:6 }}>
                Volunteer uses this code to log into their field portal
              </div>
            </div>

            {err && (
              <div style={{ fontSize:12, color:'#f43f5e', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:10, padding:'10px 14px' }}>
                ⚠ {err}
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:12, marginTop:28 }}>
            <button
              onClick={onClose}
              style={{ flex:1, padding:'14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:14, color:'var(--text2)', fontSize:13, fontWeight:700, cursor:'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ flex:2, padding:'14px', background: saving ? 'rgba(232,99,10,0.5)' : 'var(--accent)', border:'none', borderRadius:14, color:'white', fontSize:13, fontWeight:900, cursor:'pointer' }}
            >
              {saving ? 'Registering...' : '✓ Register Volunteer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── VOLUNTEER ROW (Elongated) ────────────────────────── */
function VolunteerRow({ volunteer, onClick, isSelected, onToggle, lastSeen }) {
  const cfg = STATUS_CONFIG[volunteer.status] || STATUS_CONFIG.AVAILABLE;
  const initials = volunteer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);

  // Compute live activity
  let activity = '🔴 Offline';
  let actColor = '#f43f5e';
  const mins = lastSeen ? (new Date() - new Date(lastSeen + (lastSeen.includes('Z')?'':'Z'))) / 60000 : Infinity;
  if (mins < 5) { activity = '🟢 Active'; actColor = '#10b981'; }
  else if (mins < 15) { activity = '🟡 Idle'; actColor = '#f59e0b'; }

  const isAvailable = mins < 5;

  return (
    <div
      onClick={() => onClick(volunteer)}
      style={{
        background: isSelected ? 'rgba(232,99,10,0.08)' : 'var(--surface2)',
        border: `1px solid ${isSelected ? 'var(--accent)' : cfg.color + '22'}`,
        borderRadius: 20,
        padding: '20px 28px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        transition: 'all 0.18s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = cfg.color + '66';
          e.currentTarget.style.background = cfg.bg.replace('0.12','0.06');
        }
        e.currentTarget.style.transform = 'translateX(4px)';
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = cfg.color + '22';
          e.currentTarget.style.background = 'var(--surface2)';
        }
        e.currentTarget.style.transform = 'translateX(0)';
      }}
    >
      <div style={{ position:'absolute', left:0, top:12, bottom:12, width:3, background: isSelected ? 'var(--accent)' : cfg.color, borderRadius:'0 3px 3px 0' }} />

      {/* Bulk Select Checkbox */}
      {isAvailable && (
        <div style={{ flexShrink:0 }} onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={onToggle} style={{ width:20, height:20, accentColor:'var(--accent)', cursor:'pointer' }} />
        </div>
      )}

      {/* Avatar */}
      <div style={{ width:48, height:48, borderRadius:14, background: cfg.bg, border:`1.5px solid ${cfg.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color: cfg.color, fontFamily:'var(--display)', flexShrink:0 }}>
        {initials}
      </div>

      {/* Name + Skills */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:3 }}>{volunteer.name}</div>
        <div style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {volunteer.skills || 'General Field Operations'}
        </div>
      </div>

      {/* Live Activity Status */}
      <div style={{ padding:'6px 12px', borderRadius:20, background:`${actColor}15`, border:`1px solid ${actColor}44`, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
         {mins < 5 && <div style={{width:6, height:6, borderRadius:'50%', background:actColor, animation:'pulse 1.5s infinite'}} />}
         {mins >= 5 && <div style={{width:6, height:6, borderRadius:'50%', background:actColor}} />}
         <span style={{ fontSize:10, fontWeight:900, color:actColor }}>{activity} {mins < Infinity && `· ${Math.floor(mins)}m`}</span>
      </div>

      {/* Status */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, width:90 }}>
        <span style={{ fontSize:11, fontWeight:800, color: cfg.color }}>{cfg.label}</span>
      </div>
      
      {/* Deployment tag if on mission */}
      {volunteer.status === 'ON_MISSION' && (
        <div style={{ fontSize:10, color:'var(--accent)', background:'rgba(232,99,10,0.1)', padding:'5px 12px', borderRadius:20, border:'1px solid rgba(232,99,10,0.3)', flexShrink:0, fontFamily:'var(--mono)', fontWeight:700 }}>
          ⚙ DEPLOYED
        </div>
      )}

      {/* ID + Arrow */}
      <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', flexShrink:0 }}>#{volunteer.id}</div>
      <div style={{ color:'var(--text3)', fontSize:16, flexShrink:0 }}>›</div>
    </div>
  );
}

/* ─── DETAIL VIEW ───────────────────────────────────────── */
function VolunteerDetail({ volunteer: initial, onBack }) {
  const [volunteer, setVolunteer] = useState(initial);
  const [messages, setMessages] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [globalMsg, setGlobalMsg] = useState('');
  const [sendingGlobal, setSendingGlobal] = useState(false);
  const [resolving, setResolving] = useState(null);
  const [activeTab, setActiveTab] = useState('mission');
  const [expanded, setExpanded] = useState({});
  const [missionMsgInput, setMissionMsgInput] = useState({});
  const [missionSending, setMissionSending] = useState({});
  const chatEndRef = useRef(null);

  const API = 'https://jeevansetu-api.onrender.com';

  const loadDetail = async () => {
    try {
      const [v, m, p] = await Promise.all([
        fetch(`${API}/api/v2/volunteers/${initial.id}`).then(r => r.ok ? r.json() : initial),
        fetch(`${API}/api/v2/volunteers/${initial.id}/messages`).then(r => r.ok ? r.json() : []),
        fetch(`${API}/api/v2/volunteers/${initial.id}/proofs`).then(r => r.ok ? r.json() : []),
      ]);
      if (v && !v.error) setVolunteer(v);
      if (Array.isArray(m)) setMessages(m);
      if (Array.isArray(p)) setProofs(p);
    } catch(e) {}
  };

  const resolveMission = async (disasterId) => {
    setResolving(disasterId);
    setVolunteer(prev => {
      const updated = prev.missions.map(m =>
        m.id === disasterId ? { ...m, status: 'RESOLVED' } : m
      );
      const stillActive = updated.some(m => m.status === 'DISPATCHED');
      return { ...prev, missions: updated, status: stillActive ? 'ON_MISSION' : 'AVAILABLE' };
    });
    try { await fetch(`${API}/api/v2/disasters/${disasterId}/resolve`, { method: 'POST' }); } catch(e) {}
    setResolving(null);
    setTimeout(loadDetail, 800);
  };

  const sendGlobal = async () => {
    if (!globalMsg.trim()) return;
    setSendingGlobal(true);
    const text = globalMsg; setGlobalMsg('');
    const opt = { id: Date.now(), sender:'admin', message: text, mission_id: null, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, opt]);
    try {
      await fetch(`${API}/api/v2/volunteers/${initial.id}/messages`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: text, sender:'admin', mission_id: null })
      });
    } catch(e) {}
    setSendingGlobal(false);
  };

  const sendMissionMsg = async (missionId) => {
    const text = (missionMsgInput[missionId] || '').trim();
    if (!text) return;
    setMissionSending(prev => ({ ...prev, [missionId]: true }));
    setMissionMsgInput(prev => ({ ...prev, [missionId]: '' }));
    const opt = { id: Date.now(), sender:'admin', message: text, mission_id: missionId, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, opt]);
    try {
      await fetch(`${API}/api/v2/volunteers/${initial.id}/messages`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: text, sender:'admin', mission_id: missionId })
      });
    } catch(e) {}
    setMissionSending(prev => ({ ...prev, [missionId]: false }));
  };

  useEffect(() => { loadDetail(); const i = setInterval(loadDetail, 8000); return () => clearInterval(i); }, [initial.id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const cfg = STATUS_CONFIG[volunteer.status] || STATUS_CONFIG.AVAILABLE;
  const missions = Array.isArray(volunteer.missions) ? volunteer.missions : [];
  const active = missions.filter(m => m.status === 'DISPATCHED');
  const resolved = missions.filter(m => m.status === 'RESOLVED');
  
  // Sort missions: Active (DISPATCHED) first, then everything else (RESOLVED, etc)
  const sortedMissions = [...missions].sort((a,b) => {
    if (a.status === 'DISPATCHED' && b.status !== 'DISPATCHED') return -1;
    if (a.status !== 'DISPATCHED' && b.status === 'DISPATCHED') return 1;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  const globalMessages = (messages || []);
  const tabs = [
    { key:'mission',  label:'📋 Mission Log',      count: missions.length },
    { key:'messages', label:'💬 Command Channel',  count: globalMessages.length },
    { key:'evidence', label:'📸 Field Evidence',   count: (proofs || []).length },
  ];

  const SEV_MAP = { low:{c:'#10b981',e:'🟢',l:'LOW'}, medium:{c:'#f59e0b',e:'🟡',l:'MEDIUM'}, high:{c:'#f43f5e',e:'🔴',l:'HIGH'}, critical:{c:'#e8630a',e:'🚨',l:'CRITICAL'} };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:32 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
        <button onClick={onBack} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 18px', color:'var(--text2)', cursor:'pointer', fontSize:13, flexShrink:0, marginTop:4 }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--display)', fontSize:28, fontWeight:900, letterSpacing:-0.5 }}>{volunteer.name}</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>{volunteer.skills || 'General Field Operations'} · ID #{volunteer.id}</div>
          {volunteer.access_code && (
            <div style={{ marginTop:8, fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
              🔑 Login Code: <strong style={{ color:'var(--accent)' }}>{volunteer.access_code}</strong>
            </div>
          )}
        </div>
        <div style={{ padding:'10px 24px', border:`1px solid ${cfg.color}44`, borderRadius:20, background:cfg.bg, fontSize:12, fontWeight:900, color:cfg.color, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.color, boxShadow:`0 0 8px ${cfg.color}` }} />
          {cfg.label}
        </div>
      </div>

      {/* Deployment Banner */}
      {volunteer.status === 'ON_MISSION' && active.length > 0 && (
        <div style={{ background:'rgba(232,99,10,0.06)', border:'1px solid rgba(232,99,10,0.25)', borderRadius:20, padding:'24px 32px' }}>
          <div style={{ fontSize:11, fontWeight:900, color:'var(--accent)', textTransform:'uppercase', letterSpacing:2, marginBottom:20 }}>⚙ Current Deployment</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16 }}>
            {[
              { label:'Active Incidents', val: active.length, color:'var(--accent)' },
              { label:'Zone Coordinates', val: active[0] ? `${active[0].lat?.toFixed(2)},${active[0].lon?.toFixed(2)}` : 'N/A', color:'var(--text1)', mono:true },
              { label:'Incident Type', val: active[0]?.type || 'Unknown', color:'var(--text1)' },
              { label:'Missions Resolved', val: resolved.length, color:'#10b981' },
            ].map((s,i) => (
              <div key={i} style={{ background:'rgba(232,99,10,0.08)', borderRadius:14, padding:'18px 20px' }}>
                <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{s.label}</div>
                <div style={{ fontSize:18, fontWeight:900, color:s.color, fontFamily:s.mono?'var(--mono)':'inherit' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'var(--surface2)', padding:5, borderRadius:16, width:'fit-content', border:'1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding:'10px 22px', borderRadius:12, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, transition:'all 0.18s',
              background: activeTab===tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab===tab.key ? 'white' : 'var(--text3)',
              display:'flex', alignItems:'center', gap:8
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ fontSize:10, background: activeTab===tab.key ? 'rgba(255,255,255,0.25)' : 'var(--surface3)', padding:'2px 7px', borderRadius:10 }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── MISSION LOG TAB ── */}
      {activeTab === 'mission' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {missions.length === 0 && (
            <div style={{ textAlign:'center', padding:80, color:'var(--text3)', fontSize:13, background:'var(--surface2)', borderRadius:20, border:'1px solid var(--border)' }}>
              No missions assigned yet. Volunteer is on standby.
            </div>
          )}
          {/* Active first, then resolved */}
          {sortedMissions.map(m => {
            const isActive = m.status === 'DISPATCHED';
            const ms = isActive ? { c:'#e8630a', l:'WORK IN PROGRESS' } : { c:'#10b981', l:'RESOLVED' };
            const isExpanded = expanded[m.id];
            const mMsgs = messages.filter(msg => msg.mission_id === m.id);
            const mProofs = proofs.filter(p => p.mission_id === m.id);

            return (
              <div key={m.id} style={{ background:'var(--surface2)', border:`1.5px solid ${ms.c}44`, borderRadius:20, overflow:'hidden', transition:'border-color 0.3s' }}>
                {/* Card header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', background:`${ms.c}08`, borderBottom:`1px solid ${ms.c}22` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ fontSize:20 }}>{isActive ? '🚧' : '✅'}</div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:14, textTransform:'capitalize' }}>{m.type || 'Disaster'} Incident</div>
                      <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
                        {isActive ? 'Active since' : 'Resolved'} · {m.created_at ? new Date(m.created_at).toLocaleString() : 'Unknown'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {/* Per-mission counts */}
                    {(mMsgs.length > 0 || mProofs.length > 0) && (
                      <div style={{ display:'flex', gap:6 }}>
                        {mMsgs.length > 0 && <span style={{ fontSize:10, background:'rgba(232,99,10,0.12)', color:'var(--accent)', padding:'3px 8px', borderRadius:10, fontWeight:700 }}>💬 {mMsgs.length}</span>}
                        {mProofs.length > 0 && <span style={{ fontSize:10, background:'rgba(16,185,129,0.12)', color:'#10b981', padding:'3px 8px', borderRadius:10, fontWeight:700 }}>📸 {mProofs.length}</span>}
                      </div>
                    )}
                    <div style={{ fontSize:10, fontWeight:900, color:ms.c, background:`${ms.c}15`, padding:'5px 14px', borderRadius:20, border:`1px solid ${ms.c}33` }}>{ms.l}</div>
                    {isActive && (
                      <button onClick={() => resolveMission(m.id)} disabled={resolving===m.id}
                        style={{ fontSize:11, fontWeight:900, cursor:'pointer', border:'1px solid #10b98155',
                          background: resolving===m.id ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.13)',
                          color:'#10b981', padding:'6px 14px', borderRadius:20, display:'flex', alignItems:'center', gap:5, transition:'all 0.2s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(16,185,129,0.28)'}
                        onMouseLeave={e=>e.currentTarget.style.background=resolving===m.id?'rgba(16,185,129,0.2)':'rgba(16,185,129,0.13)'}
                      >
                        {resolving===m.id ? '⏳' : '✓'} Mark Done
                      </button>
                    )}
                    {/* Expand toggle */}
                    <button onClick={() => setExpanded(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:18, padding:'4px 8px', lineHeight:1, transition:'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ⌄
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding:'16px 24px', display:'grid', gridTemplateColumns:'1fr 2fr 80px', gap:20 }}>
                  <div>
                    <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>GPS Coordinates</div>
                    <div style={{ fontSize:12, fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)' }}>{m.lat?.toFixed(4)}, {m.lon?.toFixed(4)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>Situation</div>
                    <div style={{ fontSize:13, lineHeight:1.6 }}>{m.description}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>Severity</div>
                    <div style={{ fontSize:26, fontWeight:900, color:(m.severity||0)>=7?'#f43f5e':'#3b82f6' }}>{(m.severity||0).toFixed(1)}</div>
                  </div>
                </div>

                {/* Expanded: per-mission chat + evidence */}
                {isExpanded && (
                  <div style={{ borderTop:`1px solid ${ms.c}22`, display:'flex', flexDirection:'column', gap:0 }}>

                    {/* Mini Chat */}
                    <div style={{ padding:'16px 24px', borderBottom:`1px solid var(--border)` }}>
                      <div style={{ fontSize:10, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:12 }}>
                        💬 Mission Chat · {mMsgs.length} message{mMsgs.length!==1?'s':''}
                      </div>
                      {mMsgs.length === 0 && (
                        <div style={{ fontSize:12, color:'var(--text3)', textAlign:'center', padding:'16px 0' }}>No messages for this mission yet.</div>
                      )}
                      <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:220, overflowY:'auto', marginBottom:12 }}>
                        {mMsgs.map(msg => {
                          const isAdm = msg.sender === 'admin';
                          return (
                            <div key={msg.id} style={{ display:'flex', justifyContent: isAdm ? 'flex-end' : 'flex-start' }}>
                              <div style={{ maxWidth:'72%', padding:'10px 14px',
                                borderRadius: isAdm ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                background: isAdm ? 'var(--accent)' : 'var(--surface3)', fontSize:12, lineHeight:1.5 }}>
                                <div style={{ fontSize:9, opacity:0.6, marginBottom:3, fontWeight:700 }}>
                                  {isAdm ? '👨‍💼 Admin' : `🙋 ${volunteer.name}`}
                                </div>
                                {msg.message}
                                <div style={{ fontSize:9, opacity:0.45, marginTop:4 }}>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display:'flex', gap:10 }}>
                        <input
                          value={missionMsgInput[m.id] || ''}
                          onChange={e => setMissionMsgInput(prev => ({ ...prev, [m.id]: e.target.value }))}
                          onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendMissionMsg(m.id)}
                          placeholder={`Send message about this ${m.type || 'mission'}...`}
                          style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px', color:'white', fontSize:12, outline:'none' }}
                          onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}
                        />
                        <button onClick={() => sendMissionMsg(m.id)} disabled={missionSending[m.id] || !missionMsgInput[m.id]?.trim()}
                          style={{ background:'var(--accent)', border:'none', borderRadius:12, padding:'10px 18px', color:'white', fontWeight:900, fontSize:12, cursor:'pointer', opacity:(!missionMsgInput[m.id]?.trim()||missionSending[m.id])?0.5:1 }}>
                          {missionSending[m.id] ? '...' : '↑'}
                        </button>
                      </div>
                    </div>

                    {/* Mini Evidence */}
                    <div style={{ padding:'16px 24px' }}>
                      <div style={{ fontSize:10, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:12 }}>
                        📸 Field Evidence · {mProofs.length} file{mProofs.length!==1?'s':''}
                      </div>
                      {mProofs.length === 0 ? (
                        <div style={{ fontSize:12, color:'var(--text3)', textAlign:'center', padding:'16px 0' }}>No evidence uploaded for this mission.</div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                          {mProofs.map(p => {
                            const sev = SEV_MAP[p.severity] || SEV_MAP.medium;
                            const url = `${API}/api/v2/uploads/${p.filename}`;
                            return (
                              <div key={p.id} style={{ display:'flex', gap:14, alignItems:'flex-start', background:`${sev.c}06`, border:`1px solid ${sev.c}22`, borderRadius:12, padding:'12px 16px' }}>
                                <a href={url} target="_blank" rel="noreferrer" style={{ flexShrink:0, display:'block', width:90, height:65, borderRadius:8, overflow:'hidden', background:'#000' }}>
                                  {p.file_type==='image'
                                    ? <img src={url} alt={p.original_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                    : <video src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                  }
                                </a>
                                <div style={{ flex:1 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                                    <span style={{ fontSize:12 }}>{sev.e}</span>
                                    <span style={{ fontSize:10, fontWeight:900, color:sev.c }}>{sev.l}</span>
                                    <span style={{ fontSize:9, color:'var(--text3)', marginLeft:'auto', fontFamily:'var(--mono)' }}>{p.created_at ? new Date(p.created_at).toLocaleTimeString() : ''}</span>
                                  </div>
                                  {p.caption && <div style={{ fontSize:12, lineHeight:1.5, color:'var(--text2)', marginBottom:6 }}>{p.caption}</div>}
                                  <a href={url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'var(--accent)', fontWeight:700, textDecoration:'none' }}>↗ View Full</a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── COMMAND CHANNEL TAB ── */}
      {activeTab === 'messages' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'rgba(99,99,232,0.06)', border:'1px solid rgba(99,99,232,0.2)', borderRadius:14, padding:'12px 18px', fontSize:12, color:'var(--text2)' }}>
            📡 Command Channel — complete log of all incoming and outgoing transmissions with this operative.
          </div>
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>
            <div style={{ padding:'16px 26px', display:'flex', flexDirection:'column', gap:12, maxHeight:420, overflowY:'auto', minHeight:200 }}>
              {globalMessages.length === 0 && (
                <div style={{ textAlign:'center', padding:48, color:'var(--text3)', fontSize:12 }}>No messages in channel...</div>
              )}
              {globalMessages.map(msg => {
                const isAdm = msg.sender === 'admin';
                return (
                  <div key={msg.id} style={{ display:'flex', justifyContent: isAdm ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth:'68%', padding:'12px 16px', borderRadius: isAdm ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isAdm ? 'var(--accent)' : 'var(--surface3)', fontSize:13, lineHeight:1.6 }}>
                      <div style={{ fontSize:10, opacity:0.65, marginBottom:4, fontWeight:700 }}>{isAdm ? '👨‍💼 Admin Command' : `🙋 ${volunteer.name}`}</div>
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
            <input value={globalMsg} onChange={e => setGlobalMsg(e.target.value)}
              onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendGlobal()}
              placeholder={`General message to ${volunteer.name}...`}
              style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:16, padding:'14px 20px', color:'white', fontSize:13, outline:'none' }}
              onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}
            />
            <button onClick={sendGlobal} disabled={sendingGlobal||!globalMsg.trim()}
              style={{ background:'var(--accent)', border:'none', borderRadius:16, padding:'14px 26px', color:'white', fontWeight:900, fontSize:13, cursor:'pointer', opacity:(sendingGlobal||!globalMsg.trim())?0.5:1 }}>
              {sendingGlobal?'...':'Send ↑'}
            </button>
          </div>
        </div>
      )}

      {/* ── FIELD EVIDENCE TAB ── */}
      {activeTab === 'evidence' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'rgba(232,99,10,0.06)', border:'1px solid rgba(232,99,10,0.2)', borderRadius:14, padding:'12px 18px', fontSize:12, color:'var(--text2)' }}>
            📸 Field Evidence — complete record of all evidence uploaded by this operative across their deployment.
          </div>
          {proofs.length === 0 && (
            <div style={{ textAlign:'center', padding:60, color:'var(--text3)', fontSize:13, background:'var(--surface2)', borderRadius:20, border:'1px solid var(--border)' }}>
              No evidence uploaded yet.
            </div>
          )}
          {proofs.map(p => {
            const sev = SEV_MAP[p.severity] || SEV_MAP.medium;
            const url = `${API}/api/v2/uploads/${p.filename}`;
            return (
              <div key={p.id} style={{ background:'var(--surface2)', border:`1px solid ${sev.c}33`, borderRadius:18, overflow:'hidden' }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 20px', background:`${sev.c}08`, borderBottom:`1px solid ${sev.c}15` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}><span>{sev.e}</span><span style={{ fontSize:11, fontWeight:900, color:sev.c }}>{sev.l} PRIORITY</span></div>
                  <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</div>
                </div>
                <div style={{ display:'flex', gap:18, padding:'14px 20px', alignItems:'flex-start' }}>
                  <a href={url} target="_blank" rel="noreferrer" style={{ flexShrink:0, display:'block', width:120, height:85, borderRadius:10, overflow:'hidden', background:'#000' }}>
                    {p.file_type==='image' ? <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <video src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                  </a>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginBottom:6 }}>{p.original_name}</div>
                    {p.caption ? <div style={{ fontSize:13, lineHeight:1.6, marginBottom:8 }}>{p.caption}</div> : <div style={{ fontSize:12, color:'var(--text3)', fontStyle:'italic', marginBottom:8 }}>No description</div>}
                    <a href={url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'var(--accent)', fontWeight:700, textDecoration:'none', padding:'5px 12px', borderRadius:8, border:'1px solid rgba(232,99,10,0.3)', background:'rgba(232,99,10,0.06)' }}>
                      ↗ Open Full {p.file_type==='video'?'Video':'Image'}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── MAIN PAGE ─────────────────────────────────────────── */
export default function VolunteerPage() {
  const [volunteers, setVolunteers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [loading, setLoading] = useState(true);

  // Tactical Dispatch State
  const [selectedVols, setSelectedVols] = useState([]);
  const [liveStamps, setLiveStamps] = useState({});
  const [tick, setTick] = useState(0);
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({ incidentType: 'Disaster', message:'', location:'' });

  const loadVolunteers = async () => {
    try {
      const r = await fetch('https://jeevansetu-api.onrender.com/api/v2/volunteers');
      const data = r.ok ? await r.json() : [];
      if (Array.isArray(data)) {
        setVolunteers(data);
        const stamps = {};
        data.forEach(v => { stamps[v.id] = v.last_updated; });
        setLiveStamps(prev => ({ ...stamps, ...prev }));
      }
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { loadVolunteers(); const i = setInterval(loadVolunteers, 10000); return () => clearInterval(i); }, []);

  // Update tick every 30s to re-render active statuses
  useEffect(() => { const i = setInterval(() => setTick(t=>t+1), 30000); return () => clearInterval(i); }, []);

  // Listen for socket events
  useEffect(() => {
    const handleLoc = (msg) => {
      setLiveStamps(prev => ({ ...prev, [msg.volunteerId]: new Date().toISOString().replace('T', ' ').substring(0, 19) }));
    };
    const handleResp = (msg) => {
      if (msg.status === 'ACCEPTED') {
        loadVolunteers(); 
      }
    };
    socket.on('locationBroadcast', handleLoc);
    socket.on('updateAdmin', handleResp);
    return () => { socket.off('locationBroadcast', handleLoc); socket.off('updateAdmin', handleResp); };
  }, []);

  const toggleSelect = (id) => {
    setSelectedVols(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev, id]);
  };

  const submitDispatch = () => {
    if(!dispatchForm.message || !dispatchForm.location) return;
    socket.emit('sendEmergency', {
       targetIds: selectedVols,
       target: selectedVols.length > 0 ? 'selected' : 'active',
       incidentType: dispatchForm.incidentType,
       message: dispatchForm.message,
       location: dispatchForm.location
    });
    setShowDispatch(false);
    setSelectedVols([]);
    setDispatchForm({ incidentType: 'Disaster', message:'', location:'' });
    alert("Emergency Request Sent! Waiting for responses...");
  };

  const onMission  = volunteers.filter(v => v.status === 'ON_MISSION');
  const available  = volunteers.filter(v => v.status === 'AVAILABLE' || !v.status);

  return (
    <AppShell title="Tactical Field Personnel" sub="VOLUNTEER COMMAND & COMMUNICATION CENTRE">
      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)} onSave={loadVolunteers} />
      )}

      {/* DISPATCH OVERLAY */}
      {showDispatch && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(10px)' }}>
          <div style={{ width:460, background:'#0d1117', border:'1px solid #e8630a', borderRadius:24, padding:32, boxShadow:'0 0 50px rgba(232,99,10,0.3)' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>🚨</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#e8630a', textTransform:'uppercase', letterSpacing:1 }}>Push Emergency Dispatch</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:24 }}>Sending to {selectedVols.length} active responder{selectedVols.length>1?'s':''}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
               <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', display:'block', marginBottom:6 }}>Incident Type</label>
                  <input value={dispatchForm.incidentType} onChange={e=>setDispatchForm({...dispatchForm, incidentType:e.target.value})} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:12, padding:12, color:'white', fontSize:13 }} />
               </div>
               <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', display:'block', marginBottom:6 }}>Coordinates / Location</label>
                  <input value={dispatchForm.location} onChange={e=>setDispatchForm({...dispatchForm, location:e.target.value})} placeholder="e.g. Zone 4, Near River" style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:12, padding:12, color:'white', fontSize:13 }} />
               </div>
               <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', display:'block', marginBottom:6 }}>Mission Order / Request</label>
                  <textarea value={dispatchForm.message} onChange={e=>setDispatchForm({...dispatchForm, message:e.target.value})} rows={3} placeholder="Provide tactical commands..." style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:12, padding:12, color:'white', fontSize:13 }} />
               </div>
               <div style={{ display:'flex', gap:10, marginTop:10 }}>
                  <button onClick={()=>setShowDispatch(false)} style={{ flex:1, padding:12, borderRadius:12, border:'none', background:'var(--surface3)', color:'white', fontWeight:700, cursor:'pointer' }}>Cancel</button>
                  <button onClick={submitDispatch} style={{ flex:2, padding:12, borderRadius:12, border:'none', background:'#e8630a', color:'white', fontWeight:900, cursor:'pointer' }}>TRANSMIT TO FIELD</button>
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="page" style={{ maxWidth:1100, padding:'36px 56px', margin:'0 auto' }}>
        {selected ? (
          <VolunteerDetail volunteer={selected} onBack={() => { setSelected(null); loadVolunteers(); }} />
        ) : (
          <>
            {/* Header Row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:40 }}>
              <div>
                <div style={{ fontFamily:'var(--display)', fontSize:26, fontWeight:900, letterSpacing:-0.5 }}>Field Personnel Roster</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>Click any volunteer to open their mission log and command channel</div>
              </div>
              <button
                onClick={() => setShowRegister(true)}
                style={{ display:'flex', alignItems:'center', gap:10, background:'var(--surface2)', border:'1px solid var(--accent)', borderRadius:16, padding:'14px 24px', color:'var(--accent)', fontWeight:900, fontSize:13, cursor:'pointer' }}
              >
                <span style={{ fontSize:18 }}>+</span> Register Volunteer
              </button>
            </div>
            
            {/* STICKY BULK ACTIONS BAR */}
            {selectedVols.length > 0 && (
            <div style={{ position:'fixed', bottom:40, left:'50%', transform:'translateX(-50%)', background:'rgba(8,11,16,0.95)', backdropFilter:'blur(20px)', border:'1px solid #e8630a', borderRadius:24, padding:'16px 24px', display:'flex', alignItems:'center', gap:24, zIndex:2000, boxShadow:'0 10px 40px rgba(232,99,10,0.3)' }}>
               <div style={{ fontSize:13, fontWeight:900, color:'white' }}>
                 <span style={{ color:'#e8630a', fontSize:16, marginRight:8 }}>{selectedVols.length}</span> Asset{selectedVols.length>1?'s':''} Selected
               </div>
               <div style={{ width:1, height:20, background:'var(--border)' }}></div>
               <button onClick={()=>setShowDispatch(true)} disabled={selectedVols.length === 0} style={{ background: selectedVols.length > 0 ? '#e8630a' : 'var(--surface3)', border:'none', borderRadius:14, padding:'10px 20px', color:'white', fontWeight:900, fontSize:12, cursor: selectedVols.length > 0 ? 'pointer' : 'not-allowed' }}>
                  + Issue Emergency Request
               </button>
            </div>
            )}

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, marginBottom:40 }}>
              {[
                { label:'Total Personnel',  val: volunteers.length, color:'#a78bfa', icon:'👥' },
                { label:'Active Deployments', val: onMission.length, color:'#e8630a', icon:'🚧' },
                { label:'Available',         val: available.length,  color:'#10b981', icon:'🟢' },
              ].map((s,i) => (
                <div key={i} style={{ background:'var(--surface2)', border:`1px solid ${s.color}33`, borderRadius:20, padding:'24px 32px', display:'flex', alignItems:'center', gap:20 }}>
                  <div style={{ fontSize:28 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize:34, fontWeight:900, fontFamily:'var(--display)', color: s.color }}>{s.val}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ACTIVE DEPLOYMENTS */}
            {onMission.length > 0 && (
              <div style={{ marginBottom:36 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#e8630a', boxShadow:'0 0 8px #e8630a' }} />
                  <div style={{ fontSize:12, fontWeight:900, color:'#e8630a', textTransform:'uppercase', letterSpacing:2 }}>Active Deployments</div>
                  <div style={{ flex:1, height:1, background:'rgba(232,99,10,0.2)' }} />
                  <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>{onMission.length} unit{onMission.length>1?'s':''}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {onMission.map(v => <VolunteerRow key={v.id} volunteer={v} onClick={setSelected} lastSeen={liveStamps[v.id]} isSelected={selectedVols.includes(v.id)} onToggle={() => toggleSelect(v.id)} />)}
                </div>
              </div>
            )}

            {/* AVAILABLE PERSONNEL */}
            {available.length > 0 && (
              <div style={{ marginBottom:36 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#10b981' }} />
                  <div style={{ fontSize:12, fontWeight:900, color:'#10b981', textTransform:'uppercase', letterSpacing:2 }}>Available Personnel</div>
                  <div style={{ flex:1, height:1, background:'rgba(16,185,129,0.15)' }} />
                  <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>{available.length} unit{available.length>1?'s':''}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {available.map(v => <VolunteerRow key={v.id} volunteer={v} onClick={setSelected} lastSeen={liveStamps[v.id]} isSelected={selectedVols.includes(v.id)} onToggle={() => toggleSelect(v.id)} />)}
                </div>
              </div>
            )}

            {loading && volunteers.length === 0 && (
              <div style={{ textAlign:'center', padding:80, color:'var(--text3)', fontSize:13 }}>Loading roster...</div>
            )}
            {!loading && volunteers.length === 0 && (
              <div style={{ textAlign:'center', padding:80, color:'var(--text3)', fontSize:13, background:'var(--surface2)', borderRadius:24, border:'1px solid var(--border)' }}>
                No volunteers registered. Click <strong style={{color:'var(--accent)'}}>Register Volunteer</strong> to add your first field unit.
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
