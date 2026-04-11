import React from 'react';
import AppShell from '../components/AppShell';
import { Phone, MapPin, Ambulance, Shield, Hospital, Navigation } from 'lucide-react';


export default function Help() {
  const contacts = [
    { name: 'Police Control', phone: '100', icon: Shield, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'Fire Station', phone: '101', icon: Navigation, color: 'text-red-500', bg: 'bg-red-500/10' },
    { name: 'Ambulance / Medical', phone: '102', icon: Ambulance, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'Disaster Helpline', phone: '108', icon: Hospital, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { name: 'Women Helpline', phone: '1091', icon: Shield, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { name: 'Child Help', phone: '1098', icon: Shield, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ];

  return (
    <AppShell title="Emergency Contacts" sub="HELP CENTER · RESCUE SERVICES">
      <div className="page" style={{maxWidth:900,margin:'0 auto'}}>
        <div style={{marginBottom:32}}>
          <h1 style={{fontFamily:'var(--display)',fontSize:32,fontWeight:900,marginBottom:8}}>Emergency <span style={{color:'var(--red)'}}>Contacts</span></h1>
          <p style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text3)'}}>Get immediate help based on your current location.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {contacts.map((c, i) => (
            <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-between hover:border-white/20 hover:scale-105 transition-all">
              <div className={`w-16 h-16 ${c.bg} ${c.color} rounded-full flex items-center justify-center mb-6`}>
                <c.icon size={32} />
              </div>
              <h3 className="text-xl font-black italic text-white uppercase mb-2">{c.name}</h3>
              <a 
                href={`tel:${c.phone}`} 
                className="w-full py-4 bg-white/5 border border-white/10 hover:bg-red-600 text-white rounded-xl font-black italic text-2xl text-center uppercase tracking-tighter transition-all flex items-center justify-center gap-3"
              >
                <Phone size={24} /> {c.phone}
              </a>
            </div>
          ))}
        </div>

        <div className="p-10 bg-red-600 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-10 shadow-[0_20px_50px_rgba(255,0,0,0.3)]">
          <div>
            <h2 className="text-3xl font-black italic text-white uppercase mb-2">Nearby Rescue Services</h2>
            <p className="text-red-100 font-medium max-w-md">Our intelligence engine has identified 3 active rescue stations within 2km of your current location at <span className="text-white font-bold italic">Gorakhpur 26.7606°N 83.3732°E</span>.</p>
          </div>
          <button className="flex items-center gap-3 py-6 px-10 bg-white text-red-600 rounded-2xl font-black italic text-xl uppercase tracking-tighter shadow-lg hover:scale-105 transition-all active:scale-95">
             <MapPin size={24} /> FIND ON MAP
          </button>
        </div>
      </div>
    </AppShell>

  );
}
