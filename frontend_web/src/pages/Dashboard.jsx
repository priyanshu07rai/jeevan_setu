import React, { useState, useEffect } from 'react';
import { fetchDisasters, fetchVolunteers, fetchShelters, fetchActivity } from '../services/api';
import AppShell from '../components/AppShell';
import DisasterMap from '../components/DisasterMap';
import { Radio, Filter, Activity, Clock } from 'lucide-react';

export default function Dashboard() {
  const [disasters, setDisasters] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [activity, setActivity] = useState([]);
  const [filter, setFilter] = useState('All');
  const [stats, setStats] = useState({ pending: 0, active: 0, resolved: 0 });

  const loadData = async () => {
    try {
      const [d, v, s, act] = await Promise.all([
        fetchDisasters(), fetchVolunteers(), fetchShelters(), fetchActivity()
      ]);
      setDisasters(d || []);
      setVolunteers(v || []);
      setShelters(s || []);
      setActivity(act || []);
      
      const counts = (d || []).reduce((acc, curr) => {
        const s = (curr.status || 'pending').toLowerCase();
        if (s === 'pending' || s === 'new' || s === 'reported') acc.pending++;
        else if (s === 'active' || s === 'dispatch' || s === 'in-progress') acc.active++;
        else if (s === 'resolved' || s === 'closed' || s === 'completed') acc.resolved++;
        return acc;
      }, { pending: 0, active: 0, resolved: 0 });
      setStats(counts);
    } catch (e) { console.error("Dashboard Sync Error:", e); }
  };

  useEffect(() => { loadData(); const i = setInterval(loadData, 10000); return () => clearInterval(i); }, []);

  const filtered = filter === 'All' ? disasters : disasters.filter(d => (d.type || d.disaster_type || '').toLowerCase() === filter.toLowerCase());

  return (
    <AppShell title="Operational Dashboard" sub="REAL-TIME MESH NETWORK INTELLIGENCE · SECURE FEED" activeAlerts={stats.pending}>
      <div style={{ display:'flex', flex:1, height:'calc(100vh - 112px)', overflow:'hidden' }}>
        
        {/* SIDEBAR: SS4 NETWORK STATUS */}
        <aside style={{ width:320, background:'var(--surface)', padding:32, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:40, overflowY:'auto' }}>
           <div>
              <div style={{fontSize:10, fontWeight:900, color:'var(--red)', textTransform:'uppercase', letterSpacing:2, marginBottom:24, display:'flex', alignItems:'center', gap:10}}>
                 <Radio size={14} className="animate-pulse" /> NETWORK STATUS
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:16}}>
                 {[
                   { label: 'Pending Signals', val: stats.pending, clr: '#fff' },
                   { label: 'Active Rescue', val: stats.active, clr: '#3b82f6' },
                   { label: 'Resolved SOS', val: stats.resolved, clr: '#10e882' }
                 ].map((s,i)=>(
                   <div key={i} style={{padding:24, background:'var(--surface2)', borderRadius:20, border:'1px solid var(--border)'}}>
                      <div style={{fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:8}}>{s.label}</div>
                      <div style={{fontSize:36, fontWeight:900, color:s.clr, fontStyle:'italic'}}>{s.val}</div>
                   </div>
                 ))}
              </div>
           </div>

           <div>
              <div style={{fontSize:10, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', letterSpacing:2, marginBottom:16, display:'flex', alignItems:'center', gap:10}}>
                 <Filter size={14} /> CATEGORY FILTERS
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                 {['All', 'Flood', 'Fire', 'Medical', 'Earthquake', 'Other'].map(f => (
                   <button key={f} onClick={()=>setFilter(f)} style={{padding:'12px 0', borderRadius:12, fontSize:10, fontWeight:800, background: filter === f ? 'var(--accent)' : 'var(--surface2)', color: filter === f ? 'white' : 'var(--text3)', border: '1px solid ' + (filter === f ? 'var(--accent)' : 'var(--border)'), transition:'all 0.2s', cursor:'pointer'}}> {f.toUpperCase()} </button>
                 ))}
              </div>
           </div>

           <div style={{marginTop:'auto', padding:24, background:'var(--surface3)', borderRadius:20, border:'1px solid var(--border)'}}>
              <div style={{fontSize:11, fontWeight:900, color:'var(--accent)', marginBottom:8, display:'flex', alignItems:'center', gap:8}}><Activity size={12}/> SYSTEM HEALTH</div>
              <p style={{fontSize:10, color:'var(--text3)', lineHeight:1.6}}>Core operational layer synchronized via anti-fraud global mesh. Latency: 42ms.</p>
           </div>
        </aside>

        {/* MAIN: MAP + SS2 FEED */}
        <main style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--bg)' }}>
           <div style={{ flex:1, position:'relative' }}>
              <DisasterMap disasters={filtered} volunteers={volunteers} shelters={shelters} height="100%" />
           </div>
           
           {/* CITIZEN OPERATIONAL FEED (SS2) */}
           <div style={{ height:320, background:'var(--surface)', borderTop:'1px solid var(--border)', padding:24, overflowY:'auto' }}>
              <div style={{fontSize:12, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', letterSpacing:2, marginBottom:20, display:'flex', alignItems:'center', gap:10}}>
                 <Clock size={14} /> Intelligence Feed (SS2 Integrated)
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
                 {activity.slice(0, 10).map((a, i) => (
                   <div key={i} style={{padding:16, background:'var(--surface2)', borderRadius:16, borderLeft:`4px solid ${a.color}`, display:'flex', alignItems:'center', gap:16}}>
                      <div style={{width:24, height:24, borderRadius:6, background:a.color+'15', color:a.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12}}>{a.type==='donation'?'💰':'🚨'}</div>
                      <div style={{flex:1}}>
                         <div style={{fontSize:13, fontWeight:700}}>{a.title} {a.type==='donation'?'sent help':'alerted'}</div>
                         <div style={{fontSize:11, color:'var(--text3)', marginTop:2}}>{a.detail || a.time}</div>
                      </div>
                      <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)'}}>{a.time?.split('T')[1]?.slice(0,5)}</div>
                   </div>
                 ))}
                 {activity.length === 0 && <div style={{textAlign:'center', padding:40, color:'var(--text3)', gridColumn:'1 / span 2'}}>Awaiting live operational signals...</div>}
              </div>
           </div>
        </main>

      </div>
    </AppShell>
  );
}
