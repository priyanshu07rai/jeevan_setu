import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix typical leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to smoothly center map
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2 && center[0] && center[1]) {
      map.setView(center, zoom);
    }
  }, [center, map, zoom]);
  return null;
}

export default function VolunteerMiniMap({ activeMission }) {
  const [gpsLocation, setGpsLocation] = useState(null);

  // Hybrid GPS approach: Try to get Native GPS on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsLocation([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.log('MiniMap Native GPS fallback:', err.message),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Determine center priority: Active Mission Location -> Real GPS -> Default Gorakhpur fallback
  const center = (activeMission && activeMission.lat && activeMission.lon) 
                ? [activeMission.lat, activeMission.lon] 
                : gpsLocation || [26.7606, 83.3732];

  return (
    <div style={{ 
      background: 'var(--surface2)', borderRadius: '24px', overflow: 'hidden', 
      border: '1px solid var(--border)', height: '280px', position: 'relative',
      boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
    }}>
      <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 1000, background: 'rgba(0,0,0,0.75)', padding: '6px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, color: 'var(--accent)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
        LIVE RADAR
      </div>
      
      {/* We need Leaflet to properly render within bounded heights */}
      <div style={{ height: '100%', width: '100%', zIndex: 0 }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <ChangeView center={center} zoom={14} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CARTO'
          />
          {gpsLocation && (
             <Marker position={gpsLocation}>
                <Popup>Your Location</Popup>
             </Marker>
          )}
          {activeMission && activeMission.lat && activeMission.lon && (
             <Marker position={[activeMission.lat, activeMission.lon]}>
                <Popup>Mission Location</Popup>
             </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
