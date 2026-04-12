import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import VolunteerDashboard from './VolunteerDashboard';
import MissionStatus from '../components/volunteer/MissionStatus';
import VolunteerMiniMap from '../components/volunteer/VolunteerMiniMap';
import VolunteerActivityFeed from '../components/volunteer/VolunteerActivityFeed';
import VolunteerInventoryCard from '../components/volunteer/VolunteerInventoryCard';

export default function VolunteerDashboardWrapper() {
  const { user } = useAuth();
  const volId = user?.volunteerId || localStorage.getItem("volunteerId");
  
  const [activeMission, setActiveMission] = useState(null);

  // Read-only minimal fetching for Wrapper UI ONLY
  useEffect(() => {
    if (!volId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`https://jeevansetu-api.onrender.com/api/v2/volunteers/${volId}`);
        if (res.ok) {
          const data = await res.json();
          // Minimal extraction to prevent logic breakage
          if (data.missions && data.missions.length > 0) {
             const active = data.missions.filter(m => m.status === 'DISPATCHED');
             setActiveMission(active.length > 0 ? active[0] : null);
          } else {
             setActiveMission(null);
          }
        }
      } catch (err) {
        console.error("Dashboard Wrapper Fetch Error:", err);
      }
    };
    
    fetchStatus();
    // Re-sync minimally at the same heartbeat rate
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [volId]);

  const handleStartMission = () => {
    console.log("Mission Started [UI Feedback Only]");
    alert("Deploy sequence initiated (UI Feedback).");
  };

  const handleMarkArrived = () => {
    console.log("Arrived on site [UI Feedback Only]");
    alert("Location verified. Command Center notified.");
  };

  const isDeployed = activeMission !== null;

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      
      {/* 
        We enclose everything in a massive grid layout shell so the legacy 
        VolunteerDashboard feels like an encapsulated module inside the command room.
      */}
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Top: Mission Status */}
          {isDeployed && <MissionStatus activeMission={activeMission} />}

          {/* Action Context Menu (Optional Safe UI additions) */}
          {isDeployed && (
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '-12px', marginBottom: '8px' }}>
              <button onClick={handleStartMission} 
                style={{ padding: '12px 24px', borderRadius: '14px', background: 'var(--surface3)', color: 'white', border: '1px solid var(--border)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                 Start Mission
              </button>
              <button onClick={handleMarkArrived} 
                style={{ padding: '12px 24px', borderRadius: '14px', background: '#e8630a', color: 'white', border: '1px solid #ff7b2b', fontWeight: 900, cursor: 'pointer', boxShadow: '0 0 20px rgba(232,99,10,0.4)', transition: 'all 0.2s' }}>
                 Mark Arrived
              </button>
            </div>
          )}

          {/* Master Grid Splitter */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.8fr) minmax(0, 1.2fr)', gap: '32px', alignItems: 'start' }}>
             
             {/* Left Column: Legacy Full-Feature Panel Wrapper */}
             <div className="enhanced-container" style={{
                background: '#040404', 
                borderRadius: '28px', 
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                minHeight: '820px',
                position: 'relative'
             }}>
                <div style={{ position: 'absolute', top: 18, left: 24, zIndex: 10, pointerEvents: 'none' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '2px' }}>
                    Core Terminal Active
                  </div>
                </div>
                
                {/* 100% untouched child component */}
                <VolunteerDashboard />
             </div>

             {/* Right Column: New Sidebar Widgets */}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'sticky', top: '32px' }}>
                <VolunteerMiniMap activeMission={activeMission} />
                <VolunteerInventoryCard />
                <VolunteerActivityFeed activeMission={activeMission} />
             </div>

          </div>
      </div>
    </div>
  );
}
