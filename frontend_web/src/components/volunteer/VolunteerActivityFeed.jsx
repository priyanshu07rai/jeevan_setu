import React from 'react';

export default function VolunteerActivityFeed({ activeMission }) {
  const hasMission = !!activeMission;

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: '24px',
      padding: '24px',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
    }}>
      <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '20px', color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>📝</span>
        Action Log
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        {hasMission ? (
          <>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
               <div style={{ 
                 width: '32px', height: '32px', borderRadius: '10px', 
                 background: 'rgba(232,99,10,0.15)', border: '1px solid rgba(232,99,10,0.3)',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
               }}>
                 📡
               </div>
               <div>
                  <div style={{ fontSize: '13px', color: 'var(--text1)', fontWeight: 800, marginBottom: '4px' }}>Telemetry Established</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.5 }}>
                     Awaiting field arrival confirmation for mission logistics tracking.
                  </div>
               </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
               <div style={{ 
                 width: '32px', height: '32px', borderRadius: '10px', 
                 background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
               }}>
                 📋
               </div>
               <div>
                  <div style={{ fontSize: '13px', color: 'var(--text1)', fontWeight: 800, marginBottom: '4px' }}>Deploy Order Issued</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.5 }}>
                     {`Mission #${activeMission.id} securely assigned. Proceed with caution.`}
                  </div>
               </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: '13px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>💤</div>
            No recent activity. Active missions will populate logs.
          </div>
        )}
      </div>
    </div>
  );
}
