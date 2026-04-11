import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Dynamic Disaster Icon Factory
const disasterIconCache = {};
const getDisasterIcon = (priority = 5, status = 'REPORTED', selected = false) => {
  const cacheKey = `${priority}-${status}-${selected}`;
  if (disasterIconCache[cacheKey]) return disasterIconCache[cacheKey];

  let color = selected ? 'bg-cyan-400' : 'bg-yellow-500';
  let shadow = selected ? 'rgba(34,211,238,0.9)' : 'rgba(234,179,8,0.8)';
  
  const isDispatched = status === 'ACTIVE' || status === 'DISPATCHED';
  const isResolved = status === 'RESOLVED';

  if (isResolved) {
    color = 'bg-green-500';
    shadow = 'rgba(34,197,94,0.9)';
  } else if (isDispatched) {
    color = 'bg-blue-500';
    shadow = 'rgba(59,130,246,0.9)';
  } else if (!selected) {
    if (priority >= 7) { 
      color = 'bg-red-600'; 
      shadow = 'rgba(220,38,38,0.8)'; 
    } else if (priority < 4) { 
      color = 'bg-green-500'; 
      shadow = 'rgba(34,197,94,0.8)'; 
    }
  }

  const size = selected || isDispatched || isResolved ? 'w-8 h-8' : 'w-6 h-6';
  const pulseClass = isDispatched ? 'pulsing-rescue' : selected ? 'pulsing-critical' : 'pulsing-generic';

  disasterIconCache[cacheKey] = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${size} ${color} rounded-full border-2 border-white ${pulseClass} cursor-pointer shadow-[0_0_20px_${shadow}] flex items-center justify-center">
             <span class="text-[8px] font-black text-white">${isResolved || isDispatched ? '✓' : selected ? '◎' : '!'}</span>
           </div>`,
    iconSize: selected || isDispatched || isResolved ? [32, 32] : [24, 24],
    iconAnchor: selected || isDispatched || isResolved ? [16, 16] : [12, 12],
    popupAnchor: [0, -12]
  });

  return disasterIconCache[cacheKey];
};

const volunteerIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white cursor-pointer shadow-[0_0_10px_rgba(37,99,235,0.8)]"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8]
});

const shelterIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-5 h-5 bg-green-600 rounded border-2 border-white cursor-pointer shadow-[0_0_10px_rgba(22,163,74,0.8)]"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

// Component to handle auto-panning when selectedId changes
function AutoPan({ disasters, selectedId }) {
  const map = useMap();
  const [lastPan, setLastPan] = useState(null);

  useEffect(() => {
    if (!selectedId) {
      setLastPan(null);
      return;
    }
    if (selectedId && selectedId !== lastPan && disasters && disasters.length > 0) {
      const selected = disasters.find(d => d.id === selectedId);
      if (selected && selected.lat && selected.lon) {
        map.flyTo([selected.lat, selected.lon], 15, { duration: 1.5 });
        setLastPan(selectedId);
      }
    }
  }, [selectedId, disasters, map, lastPan]);
  return null;
}

// Haversine distance helper
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
};

export default function DisasterMap({ disasters, volunteers, shelters, selectedId, onIncidentClick }) {
  // Wait for component to mount before rendering map to avoid SSR issues if any
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[26.7606, 83.3732]} // Gorakhpur
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        className="bg-[#0b0b0b]" // Dark background behind tiles
      >
        <AutoPan disasters={disasters} selectedId={selectedId} />
        {/* Dark theme tiles similar to mapbox dark-v11 */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Disasters */}
        {(disasters || []).map(d => {
          if (!d.lat || !d.lon) return null;
          const isSelected = selectedId === d.id;
          return (
            <Marker 
                key={`disaster-${d.id || (d.lat + '-' + d.lon)}`} 
                position={[d.lat, d.lon]} 
                icon={getDisasterIcon(d.priority_score, d.status, isSelected)}
                eventHandlers={{
                    click: () => onIncidentClick && onIncidentClick(d)
                }}
            >
              <Popup>
                <div className="p-1 text-black">
                  <h3 className="font-black uppercase text-red-600 border-b border-red-100 mb-2">{d.disaster_type || d.type}</h3>
                  <p className="text-[10px] font-medium leading-tight">{d.description}</p>
                  
                  {shelters && shelters.length > 0 && (
                     <div className="mt-2 text-[8px] p-2 bg-green-50 rounded border border-green-100 italic">
                        NEAREST SHELTER: {Math.min(...shelters.map(s => getDistance(d.lat, d.lon, s.lat, s.lon)))} km
                     </div>
                  )}

                  <div className="mt-2 text-[9px] font-bold text-gray-500 uppercase">
                    PRIORITY: {d.priority_score?.toFixed(1) || 'N/A'} | STATUS: {d.status || 'REPORTED'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Volunteers */}
        {(volunteers || []).map(v => {
          if (!v.lat || !v.lon) return null;
          return (
            <Marker key={`vol-${v.id || Math.random()}`} position={[v.lat, v.lon]} icon={volunteerIcon}>
              <Popup>
                <div className="p-1 text-black">
                  <h3 className="font-bold text-blue-600">{v.name}</h3>
                  <p className="text-[10px]">Skills: {v.skills}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Shelters */}
        {(shelters || []).map(s => {
          if (!s.lat || !s.lon) return null;
          return (
            <Marker key={`shelter-${s.id || Math.random()}`} position={[s.lat, s.lon]} icon={shelterIcon}>
              <Popup>
                <div className="p-1 text-black">
                  <h3 className="font-bold text-green-600">{s.name}</h3>
                  <p className="text-[10px]">Capacity: {s.capacity}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
