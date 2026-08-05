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
  const overlayLayerRef = useRef(null);

  const [token, setToken] = useState(null);
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [showAfter, setShowAfter] = useState(true);
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
  const fetchImagery = async (region, fromDate, toDate) => {
  const bbox = [
    region.lng - 0.15, region.lat - 0.15,
    region.lng + 0.15, region.lat + 0.15,
  ];

  const evalscript = `
    //VERSION=3
    function setup() {
      return { input: ["B02", "B03", "B04"], output: { bands: 3 } };
    }
    function evaluatePixel(sample) {
      return [sample.B04 * 3.5, sample.B03 * 3.5, sample.B02 * 3.5];
    }
  `;

  const response = await fetch('https://sh.dataspace.copernicus.eu/api/v1/process', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        bounds: { bbox },
        data: [{
          type: 'sentinel-2-l2a',
          dataFilter: { timeRange: { from: `${fromDate}T00:00:00Z`, to: `${toDate}T23:59:59Z` } },
        }],
      },
      output: { width: 512, height: 512 },
      evalscript,
    }),
  });

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
const handleRegionClick = async (region) => {
  if (!token) return;
  mapInstanceRef.current.flyTo([region.lat, region.lng], 11);

  const before = await fetchImagery(region, '2022-06-01', '2022-06-30');
  const after = await fetchImagery(region, '2022-08-01', '2022-08-31');

  setBeforeImage(before);
  setAfterImage(after);

  const bounds = [
    [region.lat - 0.15, region.lng - 0.15],
    [region.lat + 0.15, region.lng + 0.15],
  ];

  if (overlayLayerRef.current) {
    mapInstanceRef.current.removeLayer(overlayLayerRef.current);
  }

  overlayLayerRef.current = L.imageOverlay(after, bounds).addTo(mapInstanceRef.current);
};
  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <div aria-busy={!hasToken} style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'white', padding: '8px' }}>
        {REGIONS.map((region) => (
          <button key={region.name} disabled={!hasToken} onClick={() => handleRegionClick(region)}>
            {region.name}
          </button>
        ))}
      </div>
      {(beforeImage || afterImage) && (
        <div style={{ position: 'absolute', top: 60, left: 10, zIndex: 1000 }}>
          <button
            onClick={() => {
              const newShowAfter = !showAfter;
              setShowAfter(newShowAfter);

              if (overlayLayerRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.removeLayer(overlayLayerRef.current);
                const bounds = overlayLayerRef.current.getBounds();
                const newImage = newShowAfter ? afterImage : beforeImage;
                overlayLayerRef.current = L.imageOverlay(newImage, bounds).addTo(mapInstanceRef.current);
              }
            }}
            style={{ marginBottom: 4 }}
          >
            Show {showAfter ? 'Before (June)' : 'After (August)'}
          </button>
          <img
            src={showAfter ? afterImage : beforeImage}
            alt={showAfter ? 'August 2022 imagery' : 'June 2022 imagery'}
            style={{ display: 'block', width: 250, border: '2px solid white' }}
          />
        </div>
      )}
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export default App;









