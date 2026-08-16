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

const BACKEND_URL = 'https://flood-intelligence-tool-production.up.railway.app';

function App() {


  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlayLayerRef = useRef(null);

  const [token, setToken] = useState(null);
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [showAfter, setShowAfter] = useState(true);
  const [isLoadingImagery, setIsLoadingImagery] = useState(false);
  const [imageryError, setImageryError] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const hasToken = Boolean(token);

  useEffect(() => {
  const fetchToken = async () => {
    const response = await fetch(`${BACKEND_URL}/api/token`);
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
    const response = await fetch(`${BACKEND_URL}/api/imagery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: region.lat,
        lng: region.lng,
        fromDate,
        toDate,
        accessToken: token,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch imagery');
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };
 


const handleRegionClick = async (region) => {
  if (!token) return;
  mapInstanceRef.current.flyTo([region.lat, region.lng], 11);
  setIsLoadingImagery(true);
  setImageryError(null);

  try {
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
  } catch (err) {
    setImageryError('Failed to load satellite imagery. Please try again.');
  } finally {
    setIsLoadingImagery(false);
  }
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
      <button
        onClick={() => setShowAbout(!showAbout)}
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'white', padding: '8px' }}
      >
        ℹ️ About
      </button>
      {showAbout && (
        <div
          style={{
            position: 'absolute',
            top: 50,
            right: 10,
            zIndex: 1000,
            background: 'white',
            padding: '16px',
            maxWidth: 300,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>About this tool</h3>
          <p>
            This tool compares real satellite imagery of Sindh, Pakistan before and during the 2022 floods —
            one of the worst climate disasters in the country's recent history.
          </p>
          <p>
            Imagery is pulled live from Sentinel-2, via the Copernicus Data Space Ecosystem. "Before" shows June 2022;
            "after" shows August 2022, within the documented peak-flood window (22–28 August 2022).
          </p>
          <p>
            Regions shown were confirmed among the hardest-hit districts in published flood research.
          </p>
          <button onClick={() => setShowAbout(false)}>Close</button>
        </div>
      )}
      {isLoadingImagery && (
        <div style={{ position: 'absolute', top: 10, right: 90, zIndex: 1000, background: 'white', padding: '8px' }}>
          Loading satellite imagery...
        </div>
      )}
      {imageryError && (
        <div style={{ position: 'absolute', top: 60, left: 10, zIndex: 1000, background: '#fee', color: '#900', padding: '8px' }}>
          {imageryError}
        </div>
      )}
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
