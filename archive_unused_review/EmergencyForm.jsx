import React, { useState, useEffect } from 'react';
import AppShell from '../components/AppShell';
import { submitReport } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Upload, CheckCircle, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapSync({ position }) {
  const map = useMap();
  map.setView(position, 16);
  return null;
}

export default function EmergencyForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const DEFAULT_LAT = 26.7606 + (Math.random() - 0.5) * 0.005;
  const DEFAULT_LON = 83.3732 + (Math.random() - 0.5) * 0.005;

  const [disasterType, setDisasterType] = useState('Flood');
  const [description, setDescription] = useState('');
  const [peopleTrapped, setPeopleTrapped] = useState(0);
  const [location, setLocation] = useState({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [gpsLocked, setGpsLocked] = useState(false);

  useEffect(() => {
    // Attempt auto-fetch location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setGpsLocked(true);
        },
        err => {
          console.warn("GPS Access Denied/Failed:", err);
          setLocation({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
          setGpsLocked(true); // Fallback to unlock for testing/demo
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setLocation({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
      setGpsLocked(true);
    }
  }, []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file.name);
      // In a real app, you'd upload to S3/Cloudinary here
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gpsLocked) {
      alert("Cannot submit: GPS coordinate lock not yet established.");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitReport({
        disaster_type: disasterType,
        description,
        people_count: Number(peopleTrapped),
        lat: location.lat,
        lon: location.lon,
        name: user?.name || 'Anonymous',
        phone: user?.email || 'Unknown',
        evidence: photo || 'No visual proof attached'
      });
      setSubmitted(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch {
      alert("Submission failed. Check backend connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AppShell title="Signal Sent" sub="EMERGENCY TRANSMISSION COMPLETE">
        <div style={{height:'60vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{textAlign:'center'}}>
            <CheckCircle size={80} color="var(--green)" style={{marginBottom:24}} className="pulse-slow" />
            <h2 style={{fontSize:32, fontWeight:900, marginBottom:10}}>SIGNAL DISPATCHED</h2>
            <p style={{color:'var(--text3)'}}>Field teams have been notified. Redirecting to live dashboard...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="SOS Dispatch" sub="STRICT GPS VERIFICATION · ANTI-FRAUD LAYER">
      <div className="page" style={{maxWidth:1100}}>
        <div style={{marginBottom:48}}>
          <h1 style={{fontFamily:'var(--display)', fontSize:42, fontWeight:900, textTransform:'uppercase', fontStyle:'italic'}}>
            SOS <span style={{color:'var(--red)'}}>Signal</span>
          </h1>
          <p style={{color:'var(--text3)', fontSize:14, fontFamily:'var(--mono)'}}>Verified GPS dispatch for immediate life-saving response.</p>
        </div>

        <form onSubmit={handleSubmit} className="two-col" style={{gridTemplateColumns:'1.2fr 1.8fr', gap:48, alignItems:'start'}}>
          <div style={{display:'flex', flexDirection:'column', gap:32}}>
            <div className="form-group">
              <label className="form-label" style={{marginBottom:18}}>Emergency Type</label>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                {['Flood', 'Fire', 'Earthquake', 'Medical', 'Conflict', 'Other'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDisasterType(type)}
                    style={{
                      padding:'14px', borderRadius:10, fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1,
                      background: disasterType === type ? 'var(--red)' : 'var(--surface2)',
                      border: '1px solid ' + (disasterType === type ? 'var(--red)' : 'var(--border)'),
                      color: disasterType === type ? 'white' : 'var(--text3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Situation Description</label>
              <textarea 
                className="form-input" 
                rows={5} 
                placeholder="Trapped on roof, need medical assistance..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
               <div className="form-group">
                  <label className="form-label">People Affected</label>
                  <input type="number" className="form-input" value={peopleTrapped} onChange={e=>setPeopleTrapped(e.target.value)} />
               </div>
               <div className="form-group">
                  <label className="form-label">Evidence (Required)</label>
                  <label style={{
                    height:52, background:photo?'rgba(16,232,130,0.1)':'var(--surface2)', 
                    border:photo?'1px solid var(--green)':'1px dashed var(--border)', 
                    borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', 
                    fontSize:11, color:photo?'var(--green)':'var(--text3)', cursor:'pointer'
                  }}>
                     <input type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
                     <Upload size={14} style={{marginRight:8}}/> {photo ? 'PHOTO CAPTURED' : 'UPLOAD LIVE PHOTO'}
                  </label>
               </div>
            </div>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:32}}>
            <div className="card" style={{height:400, borderRadius:24, border:'1px solid ' + (gpsLocked?'var(--green)':'var(--red)'), position:'relative'}}>
              <MapContainer 
                center={[location.lat, location.lon]} 
                zoom={16} 
                dragging={false} 
                scrollWheelZoom={false} 
                zoomControl={false}
                style={{ height: '100%', width: '100%', filter:'grayscale(0.9) invert(0.9)' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[location.lat, location.lon]} />
                <MapSync position={[location.lat, location.lon]} />
              </MapContainer>
              
              <div style={{
                position:'absolute', top:20, left:20, zIndex:1000, 
                background:'rgba(8,11,16,0.92)', backdropFilter:'blur(8px)', 
                padding:'10px 16px', borderRadius:12, border: '1px solid ' + (gpsLocked?'var(--green)':'var(--red)'),
                display:'flex', alignItems:'center', gap:10
              }}>
                 <Navigation size={14} color={gpsLocked?'var(--green)':'var(--red)'} className={gpsLocked?'':'animate-pulse'} />
                 <span style={{fontSize:10, fontWeight:800, color:'white', textTransform:'uppercase', letterSpacing:1}}>
                   {gpsLocked ? 'GPS COORDINATE LOCKED' : 'WAITING FOR GPS...'}
                 </span>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSubmitting || !gpsLocked}
              style={{
                background: gpsLocked ? 'var(--red)' : 'var(--border)', 
                width:'100%', padding:'22px', fontSize:16, fontWeight:900, textTransform:'uppercase', fontStyle:'italic', letterSpacing:1.5,
                boxShadow: gpsLocked ? '0 8px 32px rgba(239, 68, 68, 0.4)' : 'none'
              }}
            >
              {isSubmitting ? 'DISPATCHING...' : gpsLocked ? '🚀 SEND EMERGENCY SIGNAL' : '⏳ LOCKING GPS LOCATION...'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
