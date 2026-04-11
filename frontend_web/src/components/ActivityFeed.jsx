import React from 'react';
import { Activity, BellRing, Navigation, Package, Siren } from 'lucide-react';

export default function ActivityFeed({ activities = [] }) {

  const getIcon = (type) => {
    switch (type) {
      case 'SOS': return <Siren size={16} color="#ef4444" />;
      case 'DISPATCH': return <Navigation size={16} color="#3b82f6" />;
      case 'DELIVERY': return <Package size={16} color="#10b981" />;
      case 'ALERT': return <BellRing size={16} color="#f59e0b" />;
      default: return <Activity size={16} color="#8b5cf6" />;
    }
  };

  const getColorObj = (type) => {
    switch (type) {
      case 'SOS': return { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444' };
      case 'DISPATCH': return { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6' };
      case 'DELIVERY': return { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981' };
      case 'ALERT': return { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b' };
      default: return { bg: 'rgba(139, 92, 246, 0.1)', border: '#8b5cf6' };
    }
  };

  return (
     <div className="card" style={{ height: '100%', borderRadius: 32, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '24px 32px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Activity size={20} color="#8b5cf6" />
                <div style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: 13, color: 'var(--text1)' }}>Real Time Log</div>
            </div>
        </div>
        
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activities.length === 0 && (
               <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 13 }}>Waiting for events...</div>
            )}
            
            {activities.map((act, index) => {
                const colors = getColorObj(act.type);
                return (
                    <div key={act.id || index} style={{
                        background: 'var(--surface2)',
                        borderLeft: `3px solid ${colors.border}`,
                        borderRadius: 12,
                        padding: 16,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <div style={{ 
                            background: colors.bg, 
                            padding: 8, 
                            borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {getIcon(act.type)}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: colors.border }}>
                                    {act.type}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                                    {act.timestamp ? new Date(act.timestamp + 'Z').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : 'Just now'}
                                </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 500, lineHeight: 1.4 }}>
                                {act.message}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
        <style>{`
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `}</style>
     </div>
  );
}
