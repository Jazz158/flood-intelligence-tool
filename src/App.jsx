import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';


const REGIONS = [
  { name: 'Manchar Lake', lat: 26.4167, lng: 67.6167 },
  { name: 'Jacobabad', lat: 28.2769, lng: 68.4514 },
  { name: 'Larkana', lat: 27.5590, lng: 68.2120 },
  { name: 'Shikarpur', lat: 27.9560, lng: 68.6382 },
  { name: 'Kashmore', lat: 28.4321, lng: 69.5850 },
];

function App() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current).setView([25.4, 68.35], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapInstanceRef.current = map;
  }, []);

  const handleRegionClick = (region) => {
    mapInstanceRef.current.flyTo([region.lat, region.lng], 11);
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'white', padding: '8px' }}>
        {REGIONS.map((region) => (
          <button key={region.name} onClick={() => handleRegionClick(region)}>
            {region.name}
          </button>
        ))}
      </div>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
export default App;
