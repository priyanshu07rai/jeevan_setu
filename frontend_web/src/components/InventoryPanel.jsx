import React from 'react';
import { PackageOpen, AlertTriangle } from 'lucide-react';

export default function InventoryPanel({ inventoryData = [] }) {
  
  const getStatus = (food, water, med) => {
    if (food < 100 || water < 100 || med < 25) return 'CRITICAL';
    if (food < 250 || water < 250 || med < 50) return 'LOW';
    return 'NORMAL';
  };

  return (
     <div className="card" style={{ height: '100%', borderRadius: 32, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '24px 32px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PackageOpen size={20} color="#3b82f6" />
                <div style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: 13, color: 'var(--text1)' }}>Logistics Intel</div>
            </div>
        </div>
        
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {inventoryData.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 13 }}>Syncing Warehouses...</div>
            )}
            
            {inventoryData.map((wh) => {
                const status = getStatus(wh.food_qty, wh.water_qty, wh.medical_qty);
                const color = status === 'CRITICAL' ? '#ef4444' : status === 'LOW' ? '#f59e0b' : '#10b981';
                
                return (
                    <div key={wh.id} style={{
                        background: `rgba(${status === 'CRITICAL' ? '239,68,68' : status === 'LOW' ? '245,158,11' : '16,185,129'}, 0.05)`,
                        border: `1px solid rgba(${status === 'CRITICAL' ? '239,68,68' : status === 'LOW' ? '245,158,11' : '16,185,129'}, 0.3)`,
                        borderRadius: 20,
                        padding: 20,
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text1)' }}>{wh.warehouse_name}</span>
                            <span style={{
                                fontSize: 9, fontWeight: 900, color, background: `${color}1A`, padding: '4px 8px', borderRadius: 12
                            }}>
                                {status}
                            </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            <div style={{ background: 'var(--surface1)', padding: '10px 4px', borderRadius: 12, textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 800, marginBottom: 4 }}>FOOD</div>
                                <div style={{ fontSize: 15, fontWeight: 900, color: wh.food_qty < 100 ? '#ef4444' : 'var(--text1)' }}>
                                   {wh.food_qty}
                                   {wh.food_qty < 100 && <AlertTriangle size={10} color="#ef4444" style={{ marginLeft: 4 }}/>}
                                </div>
                            </div>
                            <div style={{ background: 'var(--surface1)', padding: '10px 4px', borderRadius: 12, textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 800, marginBottom: 4 }}>WATER</div>
                                <div style={{ fontSize: 15, fontWeight: 900, color: wh.water_qty < 100 ? '#ef4444' : 'var(--text1)' }}>
                                   {wh.water_qty}
                                   {wh.water_qty < 100 && <AlertTriangle size={10} color="#ef4444" style={{ marginLeft: 4 }}/>}
                                </div>
                            </div>
                            <div style={{ background: 'var(--surface1)', padding: '10px 4px', borderRadius: 12, textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 800, marginBottom: 4 }}>MEDS</div>
                                <div style={{ fontSize: 15, fontWeight: 900, color: wh.medical_qty < 25 ? '#ef4444' : 'var(--text1)' }}>
                                   {wh.medical_qty}
                                   {wh.medical_qty < 25 && <AlertTriangle size={10} color="#ef4444" style={{ marginLeft: 4 }}/>}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
     </div>
  );
}
