import { useEffect, useRef, useState } from 'react';
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

  const [token, setToken] = useState(null);
  const hasToken = Boolean(token);

  useEffect(() => {
    const fetchToken = async () => {
      const response = await fetch(
        'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: import.meta.env.VITE_SENTINEL_CLIENT_ID,
            client_secret: import.meta.env.VITE_SENTINEL_CLIENT_SECRET,
          }),
        }
      );
      const data = await response.json();
      setToken(data.access_token);
      console.log('Token:', data.access_token);
    };

    fetchToken();
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView([25.4, 68.35], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.tileLayer.wms('https://ows.terrestris.de/osm/service', {
      layers: 'OSM-WMS',
      format: 'image/png',
      transparent: true,
      attribution: 'Terrestris WMS',
    }).addTo(map);

    mapInstanceRef.current = map;
  }, []);

  const handleRegionClick = (region) => {
    mapInstanceRef.current.flyTo([region.lat, region.lng], 11);
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <div aria-busy={!hasToken} style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'white', padding: '8px' }}>
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


