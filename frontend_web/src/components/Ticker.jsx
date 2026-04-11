import React, { useEffect, useState } from 'react';
import { fetchDisasters } from '../services/api';

const STATIC_ITEMS = [
  { text: '🌊 Flood alert: Brahmaputra basin — Level 4', color: '#3b82f6' },
  { text: '✅ Aid kits dispatched to Gorakhpur Camp-7', color: '#10e882' },
  { text: '🔗 DB sync confirmed — system operational', color: '#60a5fa' },
  { text: '📡 Mesh node sync: Base ↔ Field volunteers', color: '#f59e2e' },
  { text: '🩺 Medical request VERIFIED — AI score 94%', color: '#a78bfa' },
  { text: '🚁 Rescue team en route — ETA 12 minutes', color: '#e8630a' },
  { text: '💧 Water purification units — operational', color: '#10e882' },
  { text: '⚠️ High wind warning — drone ops suspended', color: '#f7c948' },
];

export default function Ticker() {
  const [items, setItems] = useState(STATIC_ITEMS);

  useEffect(() => {
    fetchDisasters().then(disasters => {
      if (!disasters || disasters.length === 0) return;
      const dynamic = disasters.slice(0, 6).map(d => ({
        text: `🔴 Live: ${d.disaster_type || d.type} reported near [${parseFloat(d.lat).toFixed(2)}, ${parseFloat(d.lon).toFixed(2)}] — Priority ${d.priority_score?.toFixed(1) || 'N/A'}`,
        color: (d.priority_score || 0) >= 7 ? '#f43f5e' : '#f7c948',
      }));
      setItems([...dynamic, ...STATIC_ITEMS]);
    }).catch(() => {});
  }, []);

  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        {doubled.map((item, i) => (
          <div key={i} className="ticker-item">
            <span style={{ color: item.color }}>●</span>
            <b>{item.text}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
