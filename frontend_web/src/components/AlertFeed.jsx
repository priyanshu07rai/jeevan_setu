import React, { useEffect, useState } from 'react';
import socket from '../services/socket';
import { fetchDisasters } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function AlertFeed() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial Load from DB
    const loadInitial = async () => {
      try {
        const data = await fetchDisasters();
        // Sort by id desc to show newest first
        const sorted = (data || []).sort((a,b) => (b.id || 0) - (a.id || 0));
        setAlerts(sorted.slice(0, 50));
      } catch (e) {
        console.error("Initial alert fetch failed:", e);
      } finally {
        setLoading(false);
      }
    };
    loadInitial();

    // 2. Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // 3. Socket real-time updates
    socket.on('new_disaster_event', (event) => {
      setAlerts(prev => [event, ...prev].slice(0, 50));
      
      if ((event.priority || 5) >= 7 && Notification.permission === "granted") {
        new Notification("CRITICAL DISASTER REPORT", {
          body: `${event.disaster_type || 'New SOS'}: ${event.description}`,
          icon: "/favicon.ico"
        });
      }
    });

    return () => {
      socket.off('new_disaster_event');
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
         <h3 style={{fontSize:11, fontWeight:900, color:'var(--text3)', letterSpacing:2, textTransform:'uppercase', display:'flex', alignItems:'center', gap:10}}>
            <RadioPulse /> LIVE OPERATIONAL FEED
         </h3>
         <span style={{fontSize:9, fontFamily:'var(--mono)', color:'rgba(16,232,130,0.6)', background:'rgba(16,232,130,0.05)', padding:'4px 10px', borderRadius:20, border:'1px solid rgba(16,232,130,0.1)'}}>
           SYNCING ⚡
         </span>
      </div>

      <AnimatePresence initial={false}>
        {alerts.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
            <AlertTriangle size={48} />
            <p className="text-xs font-bold mt-4 tracking-widest uppercase">No Active Signals</p>
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <motion.div
              key={alert.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-[#141926]/40 border border-white/5 rounded-2xl hover:border-[#e8630a]33 transition-all group relative overflow-hidden"
            >
              <div style={{position:'absolute', top:0, left:0, width:4, height:'100%', background: (alert.priority || 5) >= 7 ? 'var(--red)' : (alert.priority || 5) < 4 ? 'var(--green)' : 'var(--accent)'}} />
              
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  (alert.priority || 5) >= 7 ? 'text-red-500' : (alert.priority || 5) < 4 ? 'text-green-500' : 'text-blue-400'
                }`}>
                  {alert.disaster_type || alert.type || 'SOS SIGNAL'} • P{(alert.priority || 5).toFixed(1)}
                </span>
                <span className="text-[10px] font-mono text-gray-500 flex items-center gap-2">
                  <Clock size={10} /> {alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : 'LIVE'}
                </span>
              </div>
              
              <p className="text-[13px] text-gray-200 leading-relaxed font-medium mb-4">
                {alert.description || 'Anonymous signal received from field unit.'}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                <div className="flex items-center gap-3 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                   <div style={{display:'flex', alignItems:'center', gap:6}}><MapPin size={12} className="text-[#e8630a]" /> {alert.lat?.toFixed(3)}, {alert.lon?.toFixed(3)}</div>
                </div>
                <div style={{fontSize:9, background:'rgba(255,255,255,0.03)', padding:'4px 8px', borderRadius:20, color:'var(--text3)', textTransform:'uppercase'}}>
                   Verified Signal ●
                </div>
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}

const RadioPulse = () => (
  <div className="relative w-2 h-2">
     <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
     <div className="relative w-2 h-2 bg-red-500 rounded-full" />
  </div>
);
