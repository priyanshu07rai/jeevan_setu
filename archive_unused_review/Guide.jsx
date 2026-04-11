import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import { BookOpen, ChevronDown, ChevronRight, Activity, ShieldAlert, Heart, Info, CheckCircle } from 'lucide-react';

const SafetyCategory = ({ title, icon: Icon, items, isOpen, onToggle }) => {
  return (
    <div style={{
      background: isOpen ? 'var(--surface2)' : 'var(--surface)',
      border: '1px solid ' + (isOpen ? 'var(--accent)' : 'var(--border)'),
      borderRadius: 24, padding: '32px', marginBottom: '24px', cursor: 'pointer',
      transition: 'all 0.4s var(--ease)',
      boxShadow: isOpen ? '0 12px 48px rgba(0,0,0,0.5)' : 'none'
    }} onClick={onToggle}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <div style={{
            width: 72, height: 72, borderRadius: 16, background: isOpen ? 'var(--accent)22' : 'var(--surface2)',
            display:'flex', alignItems:'center', justifyContent:'center', color: isOpen ? 'var(--accent)' : 'var(--text3)',
            transition: 'all 0.3s'
          }}>
            <Icon size={32} />
          </div>
          <div>
            <h3 style={{fontFamily:'var(--display)', fontSize:24, fontWeight:900, textTransform:'uppercase', fontStyle:'italic', color:'white'}}>{title}</h3>
            <p style={{fontFamily:'var(--mono)', fontSize:11, letterSpacing:1, color:'var(--text3)', textTransform:'uppercase', marginTop:4}}>Survival Protocols</p>
          </div>
        </div>
        {isOpen ? <ChevronDown color="var(--text3)" /> : <ChevronRight color="var(--text3)" />}
      </div>

      {isOpen && (
        <div style={{marginTop:32, display:'flex', flexDirection:'column', gap:10, animation: 'fadeIn 0.5s'}}>
          {items.map((item, i) => (
            <div key={i} style={{
              display:'flex', gap:20, padding:20, background:'var(--surface3)', borderRadius:14, border:'1px solid var(--border)',
              alignItems:'flex-start'
            }}>
              <CheckCircle size={18} color="var(--accent)" style={{marginTop:2, flexShrink:0}} />
              <p style={{fontSize:14, color:'var(--text2)', lineHeight:1.7, margin:0}}>{item}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Guide() {
  const [openIndex, setOpenIndex] = useState(0);

  const guides = [
    {
      title: 'Flood Safety',
      icon: Activity,
      items: [
        'Move to the highest ground possible immediately.',
        'Avoid walking or driving through flood waters — 6 inches of water can knock you down.',
        'Turn off utilities (gas, electricity) if safe to do so.',
        'Keep emergency supplies in a waterproof container nearby.',
        'Monitor local weather reports via radio or mobile data.'
      ]
    },
    {
      title: 'Fire Emergency',
      icon: ShieldAlert,
      items: [
        'If smoke is present, stay low to the ground and crawl.',
        'Check doors for heat with the back of your hand before opening.',
        'Never use elevators during a building fire.',
        'If your clothes catch fire: Stop, Drop, and Roll.',
        'Assemble at a pre-arranged meeting point outside.'
      ]
    },
    {
      title: 'Earthquake Protocol',
      icon: Info,
      items: [
        'DROP, COVER, AND HOLD ON under heavy furniture.',
        'Stay away from glass, windows, outside doors and walls.',
        'If outdoors, move away from buildings, streetlights, and utility wires.',
        'Wait for the shaking to stop before moving.',
        'Be prepared for aftershocks at any time.'
      ]
    },
    {
      title: 'Medical Distress',
      icon: Heart,
      items: [
        'Call for help immediately via the Home/COMMAND signal pulsator.',
        'Check the victim for responsiveness and breathing.',
        'Apply pressure to any heavy bleeding with clean cloth.',
        'Do not move the victim unless they are in immediate danger of fire or flood.',
        'Keep the victim warm and comfortable until responders arrive.'
      ]
    }
  ];

  return (
    <AppShell title="Safety Guide" sub="SURVIVAL PROTOCOLS · FIELD OPERATIONS">
      <div className="page" style={{maxWidth:900}}>
        <div style={{marginBottom:64, textAlign:'center'}}>
          <div style={{width:80, height:80, background:'rgba(167,139,250,0.1)', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--purple)', margin:'0 auto 24px'}}>
            <BookOpen size={40} />
          </div>
          <h1 style={{fontFamily:'var(--display)', fontSize:48, fontWeight:900, textTransform:'uppercase', fontStyle:'italic', color:'white', marginBottom:12}}>
            Survival <span style={{color:'var(--accent)'}}>Guide</span>
          </h1>
          <p style={{color:'var(--text3)', fontSize:16, fontFamily:'var(--mono)', maxWidth:550, margin:'0 auto'}}>
            Standard operating procedures for managing critical disaster events with zero compromised safety.
          </p>
        </div>

        <div style={{display:'flex', flexDirection:'column'}}>
          {guides.map((g, i) => (
            <SafetyCategory 
              key={i}
              {...g}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </div>

        <div style={{marginTop:64, padding:40, background:'var(--surface2)', borderRadius:24, border:'1px solid var(--border)', textAlign:'center'}}>
           <h4 style={{fontSize:18, fontWeight:900, textTransform:'uppercase', fontStyle:'italic', color:'white', marginBottom:10}}>Notice of Compliance</h4>
           <p style={{fontSize:13, color:'var(--text3)', lineHeight:1.6, maxWidth:600, margin:'0 auto'}}>These protocols are derived from international disaster response standards. Always prioritize immediate physical safety over data recording.</p>
        </div>
      </div>
    </AppShell>
  );
}
