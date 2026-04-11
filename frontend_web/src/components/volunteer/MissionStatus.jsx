import React from 'react';

export default function MissionStatus({ activeMission }) {
  if (!activeMission) return null;

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      padding: '24px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{
          width: '56px', height: '56px',
          borderRadius: '16px',
          background: 'rgba(232,99,10,0.15)',
          border: '1px solid rgba(232,99,10,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px',
          boxShadow: '0 0 15px rgba(232,99,10,0.2)'
        }}>
          🚨
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            Active Task
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text1)' }}>
            {activeMission.type || 'Mission Assigned'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>
            {activeMission.description || 'Proceed to destination immediately.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '32px', textAlign: 'right' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Status</div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#e8630a', background: 'rgba(232,99,10,0.1)', padding: '6px 12px', borderRadius: '12px' }}>
            IN PROGRESS
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Location / Coordinates</div>
          <div style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
            {activeMission.lat?.toFixed(4)}, {activeMission.lon?.toFixed(4)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>ETA</div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>
            ~ 15 mins
          </div>
        </div>
      </div>
    </div>
  );
}
