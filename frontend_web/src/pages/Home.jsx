import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import { fetchDisasters, fetchVolunteers, fetchShelters, fetchActivity, likeDonor } from '../services/api';

const HeroImage = () => (
  <div style={{ position: 'relative', width: 560, height: 315, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0 }}>
    <div style={{ position: 'absolute', width: '100%', height: '100%', background: 'radial-gradient(ellipse, rgba(232,99,10,0.2) 0%, transparent 70%)', borderRadius: '24px', filter: 'blur(20px)' }} />
    <div style={{ width: '100%', height: '100%', borderRadius: '24px', overflow: 'hidden', border: '2px solid rgba(232,99,10,0.3)', boxShadow: '0 0 60px rgba(232,99,10,0.15), inset 0 0 40px rgba(0,0,0,0.5)' }}>
      <img src="/dashboard_hero.jpg" alt="Jeevan Setu - Humanitarian Aid" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(1.0) saturate(1.1)' }} />
    </div>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({ disasters: 0, volunteers: 122, shelters: 6, aid: '₹0' });
  const [activity, setActivity] = useState([]);
  const [donors, setDonors] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState(null);

  const loadData = async () => {
    try {
      const [d, v, s, act, dn] = await Promise.all([
        fetchDisasters(), fetchVolunteers(), fetchShelters(), fetchActivity(),
        fetch('https://jeevansetu-api.onrender.com/api/v2/donations/top').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      setActivity(Array.isArray(act) ? act : []);
      const validatedDonors = Array.isArray(dn) ? dn : [];
      setDonors(validatedDonors);
      
      const total = validatedDonors.reduce((acc, curr) => acc + (parseFloat(curr.amount)||0), 0);
      setStats({
        disasters: (d || []).filter(x => x.status !== 'RESOLVED').length,
        volunteers: (v || []).length || 122,
        shelters: (s || []).length || 6,
        aid: '₹' + (total / 100000).toFixed(1) + 'L'
      });
    } catch (err) { console.error("Home Load Error:", err); }
  };

  useEffect(() => { loadData(); const i = setInterval(loadData, 10000); return () => clearInterval(i); }, []);

  const handleLike = async (name) => {
    if (!user) return alert("Please log in to salute donors!");
    try { await likeDonor(name, user.email); loadData(); } catch(e) { console.error(e); }
  };

  return (
    <AppShell title="Jeevan Setu" sub="CITIZEN INTERFACE · REAL-TIME MISSION AWARENESS" activeAlerts={stats.disasters}>
      <div className="page" style={{maxWidth:1500, padding:'60px 48px', margin:'0 auto'}}>
        
        <div style={{ borderRadius:32, background:'linear-gradient(135deg,#080b10 0%,#111827 50%,#080b10 100%)', border:'1px solid var(--border)', padding:'80px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:64 }}>
           <div style={{maxWidth:650, zIndex:2}}>
              <div style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)', textTransform:'uppercase', letterSpacing:4, marginBottom:20, display:'flex', alignItems:'center', gap:12}}><span style={{width:40, height:2, background:'var(--accent)'}}/> HUMANITARIAN GRID</div>
              <h1 style={{fontFamily:'var(--display)', fontSize:60, fontWeight:900, lineHeight:1, marginBottom:24, color:'white', fontStyle:'italic'}}>Lending a Hand when <span style={{color:'var(--accent)'}}>Humanity Calls.</span></h1>
              <p style={{fontSize:18, color:'var(--text2)', lineHeight:1.8, marginBottom:40}}>Connecting survivors, responders, and donors in a single unified intelligence framework.</p>
              <div style={{display:'flex', gap:24}}>
                <button className="btn btn-primary" onClick={()=>navigate('/donor')} style={{padding:'20px 36px'}}>Donate to Mission →</button>
                <button className="btn btn-ghost" onClick={()=>navigate('/report')} style={{padding:'20px 36px', border:'1px solid var(--border)'}}>Report Emergency</button>
              </div>
           </div>
           <HeroImage />
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:32, marginBottom:64}}>
           {[
             { label:'Active Alerts', val:stats.disasters, col:'#e8630a' },
             { label:'Field Responders', val:stats.volunteers, col:'#10e882' },
             { label:'Safe Shelters', val:stats.shelters, col:'#3b82f6' },
             { label:'Total Aid Sent', val:stats.aid, col:'#a78bfa' }
           ].map((s,i)=>(
             <div key={i} className="card" style={{padding:40, textAlign:'center', borderRadius:24}}>
                <div style={{fontSize:42, fontWeight:900, color:s.col, fontFamily:'var(--display)', fontStyle:'italic'}}>{s.val}</div>
                <div style={{fontSize:10, color:'var(--text3)', textTransform:'uppercase', marginTop:8, letterSpacing:2}}>{s.label}</div>
             </div>
           ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:64}}>
           <div className="card" style={{borderRadius:32}}>
              <div className="card-header" style={{padding:'32px 40px'}}><div className="card-title">🕒 Real-Time Impact Feed</div></div>
              <div className="card-body" style={{padding:'0 40px 32px 40px'}}>
                 {(activity.length > 0 ? activity : FEED).map((a, i) => {
                   const isResolved = a.status === 'RESOLVED';
                   const displayColor = a.color || (isResolved ? '#10b981' : '#f43f5e');
                   const icon = a.type === 'donation' ? '💰' : (isResolved ? '✅' : '🚨');
                   const actionStr = a.type === 'donation' ? 'sent help' : (isResolved ? 'mission resolved' : 'alerted');
                   
                   return (
                     <div 
                        key={i} 
                        onClick={() => setSelectedFeed(a)}
                        style={{padding:'24px 0', borderBottom:i===activity.length-1?'none':'1px solid var(--border)', display:'flex', alignItems:'center', cursor:'pointer'}}
                        className="hover-card"
                     >
                        <div style={{width:44, height:44, borderRadius:12, background: displayColor+'15', color:displayColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>{icon}</div>
                        <div style={{flex:1, marginLeft:24}}>
                           <div style={{fontSize:15, fontWeight:800, color: isResolved ? '#10b981' : 'inherit'}}>{a.title} {actionStr}</div>
                           <div style={{fontSize:12, color:'var(--text3)', marginTop:6, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{a.detail ? (a.detail.substring(0,60) + (a.detail.length > 60 ? '...' : '')) : 'Mission log entry recorded.'}</div>
                        </div>
                        <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)'}}>{a.time?.split('T')[1]?.slice(0,5) || '--:--'}</div>
                     </div>
                   );
                 })}
                 {activity.length === 0 && <div style={{textAlign:'center', padding:20, color:'var(--text3)'}}>Awaiting signals...</div>}
              </div>
           </div>

           <div style={{display:'flex', flexDirection:'column', gap:48}}>
              <div className="card" style={{borderRadius:32}}>
                 <div className="card-header" style={{padding:'32px 40px'}}><div className="card-title">🏆 Top Contributors</div></div>
                 <div className="card-body" style={{padding:'0 40px 32px 40px'}}>
                    {donors.map((d, i) => (
                      <div key={i} style={{display:'flex', alignItems:'center', padding:'20px 0', borderBottom:i===donors.length-1?'none':'1px solid var(--border)'}}>
                         <div style={{width:52, height:52, borderRadius:16, background:'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>👤</div>
                         <div style={{flex:1, marginLeft:20}}>
                            <div style={{fontSize:16, fontWeight:900}}>{d.name}</div>
                            <div style={{fontSize:11, color:'var(--accent)', fontFamily:'var(--mono)', marginTop:4}}>₹{(parseFloat(d.amount)||0).toLocaleString()} Relief Credit</div>
                         </div>
                         <button onClick={()=>handleLike(d.name)} style={{background:'rgba(244,63,94,0.06)', border:'1px solid rgba(244,63,94,0.1)', padding:'12px 20px', borderRadius:24, color:'#f43f5e', fontSize:14, fontWeight:900, cursor:'pointer'}}> ❤️ {d.hearts || 0} </button>
                      </div>
                    ))}
                    {donors.length === 0 && <div style={{textAlign:'center', padding:20, color:'var(--text3)'}}>No contributions logged yet.</div>}
                    <div style={{textAlign:'center', marginTop:32, fontSize:11, color:'var(--text3)', fontStyle:'italic'}}>Help us salute those who stand with us. One salute per account.</div>
                 </div>
              </div>
              <div className="card" style={{borderRadius:32, padding:48, textAlign:'center'}}>
                 <div style={{fontSize:48, marginBottom:20}}>📋</div>
                 <h3 style={{fontSize:12, fontWeight:900, color:'var(--text3)', textTransform:'uppercase', marginBottom:8}}>Operational Center</h3>
                 <p style={{fontSize:13, color:'var(--text3)', marginBottom:32}}>Launch the high-fidelity mission intelligence deck.</p>
                 <button className="btn btn-ghost" onClick={()=>navigate('/dashboard')} style={{width:'100%'}}>Open Intel Dashboard</button>
              </div>
           </div>
        </div>
        
        {/* IMPACT FEED DETAILS MODAL */}
        {selectedFeed && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)'}}>
             <div className="card" style={{width:500, padding:40, borderRadius:32, border:'1px solid var(--border)'}}>
                <div style={{fontSize:18, fontWeight:900, marginBottom:24, color:'var(--accent)', textTransform:'uppercase'}}>
                  {selectedFeed.title} Log Details
                </div>
                <div style={{background:'var(--surface3)', padding:24, borderRadius:16, border:'1px solid var(--border)'}}>
                   <div style={{fontSize:14, color:'white', whiteSpace:'pre-wrap', lineHeight:1.6, fontFamily:'var(--mono)'}}>
                      {selectedFeed.detail}
                   </div>
                </div>
                <div style={{marginTop:24, fontSize:10, color:'var(--text3)', textAlign:'center', textTransform:'uppercase'}}>
                  Logged at: {selectedFeed.time ? new Date(selectedFeed.time).toLocaleString() : 'Unknown Time'}
                </div>
                <button className="btn btn-ghost" style={{width:'100%', marginTop:32}} onClick={() => setSelectedFeed(null)}>Close Intel</button>
             </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}

const FEED = [
  { color:'#10e882', title:'Operational Feed', detail:'System syncing with global survival mesh...', time:'T04:30' }
];
