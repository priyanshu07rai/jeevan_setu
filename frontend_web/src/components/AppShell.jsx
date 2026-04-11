import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Ticker from './Ticker';
import AIChat from './AIChat';

export default function AppShell({ children, title, sub, rightChips, activeAlerts = 0 }) {
  const [broadcast, setBroadcast] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);

  useEffect(() => {
    const checkBroadcast = async () => {
      try {
        const r = await fetch('/api/v2/broadcast/latest');
        const data = await r.json();
        if (data && data.id) {
          const lastSeen = localStorage.getItem('last_broadcast_id');
          if (lastSeen !== String(data.id)) {
            setBroadcast(data);
            setShowBroadcast(true);
            localStorage.setItem('last_broadcast_id', String(data.id));
          }
        }
      } catch (e) {}
    };
    checkBroadcast();
    const interval = setInterval(checkBroadcast, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Ticker />
        <AIChat />

        {/* GLOBAL BROADCAST MODAL */}
        {showBroadcast && broadcast && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(10px)'}}>
            <div className="card" style={{width:550, padding:48, borderRadius:32, border:'2px solid var(--accent)', textAlign:'center', position:'relative', overflow:'hidden'}}>
               <div style={{position:'absolute', top:0, left:0, right:0, height:6, background:'linear-gradient(90deg, var(--accent), #f97316)'}} />
               <div style={{fontSize:48, marginBottom:24}}>🚨</div>
               <div style={{fontFamily:'var(--display)', fontSize:24, fontWeight:900, color:'var(--accent)', textTransform:'uppercase', letterSpacing:2, marginBottom:16}}>Priority Signal Received</div>
               <div style={{fontSize:18, color:'white', lineHeight:1.6, marginBottom:32, fontWeight:500}}>{broadcast.message}</div>
               <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', textTransform:'uppercase', marginBottom:40}}>Source: Disaster Intel Command Center · {new Date(broadcast.created_at).toLocaleString()}</div>
               <button 
                  className="btn btn-primary btn-lg" 
                  style={{width:'100%', padding:20, borderRadius:16, background:'var(--accent)', fontWeight:900, fontSize:14}}
                  onClick={() => setShowBroadcast(false)}
                >
                   ACKNOWLEDGE SIGNAL
                </button>
            </div>
          </div>
        )}

        <div className="topbar">
          <div>
            <div className="page-title">{title}</div>
            <div className="page-sub">{sub}</div>
          </div>
          <div className="topbar-right">
            {activeAlerts > 0 && (
              <div className="chip chip-alert">
                <span className="cdot" />{activeAlerts} CRITICAL
              </div>
            )}
            <div className="chip chip-green">
              <span className="cdot" />System Online
            </div>
            <div className="chip chip-blue">
              <span className="cdot" />DB Synced
            </div>
            {rightChips}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
