import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import VolunteerDashboard from './VolunteerDashboard';
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
