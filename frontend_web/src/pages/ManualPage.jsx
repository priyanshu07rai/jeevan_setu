import React from 'react';
import AppShell from '../components/AppShell';

const GUIDES = [
  { title: "First Aid: Bleeding", content: "Apply firm, direct pressure with a clean cloth. Do not remove the cloth if blood soaks through, add another on top." },
  { title: "First Aid: Burns", content: "Cool the burn under cool (not cold) running water for at least 10 minutes. Do not pop blisters." },
  { title: "Earthquake Survival", content: "Drop, Cover, and Hold On. Stay away from glass, windows, outside doors and walls." },
  { title: "Flood Evacuation", content: "Move to higher ground immediately. Do not walk through moving water. 6 inches of moving water can make you fall." }
];

export default function ManualPage() {
  return (
    <AppShell title="Safety Manual" sub="CACHED LOCALLY · AVAILABLE OFFLINE">
      <div className="page" style={{ maxWidth: 800, margin: '0 auto', paddingTop: 40 }}>
        
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Survival & Protocol Manuals</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>These resources are cached on your browser and will remain fully accessible even if you lose internet connectivity during a blackout.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {GUIDES.map((g, i) => (
            <div key={i} style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 24
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginBottom: 12 }}>
                {g.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                {g.content}
              </p>
            </div>
          ))}
        </div>

      </div>
    </AppShell>
  );
}
