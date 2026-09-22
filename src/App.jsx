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

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:4000'
    : 'https://flood-intelligence-tool-1.onrender.com');

function App() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const imageryRequestRef = useRef(0);

  const [token, setToken] = useState(null);
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [selectedRegionName, setSelectedRegionName] = useState(null);
  const [showAfter, setShowAfter] = useState(true);

  const [isLoadingImagery, setIsLoadingImagery] = useState(false);
  const [imageryError, setImageryError] = useState(null);
  const [tokenError, setTokenError] = useState(null);

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [showAbout, setShowAbout] = useState(false);

  const hasToken = Boolean(token);

  const fetchToken = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/token`);

      if (!response.ok) {
        throw new Error('Failed to fetch token');
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('Token response did not include access_token');
      }

      setToken(data.access_token);
      setTokenError(null);

      return data.access_token;
    } catch (err) {
      const message =
        'Satellite token is not available right now. You can still select regions on the map.';

      console.error('Token error:', err);
      setTokenError(message);

      throw new Error(message, { cause: err });
    }
  };

  // Get Sentinel access token
  useEffect(() => {
    const loadToken = async () => {
      try {
        await fetchToken();
      } catch {
        // The visible token error is already set in fetchToken.
      }
    };

    loadToken();
  }, []);

  // Create Leaflet map
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView(
      [25.4, 68.35],
      8
    );

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
      }
    ).addTo(map);

    L.tileLayer.wms(
      'https://ows.terrestris.de/osm/service',
      {
        layers: 'OSM-WMS',
        format: 'image/png',
        transparent: true,
        attribution: 'Terrestris WMS',
      }
    ).addTo(map);

    mapInstanceRef.current = map;
  }, []);

  // Fetch satellite imagery
  const fetchImagery = async (
    region,
    fromDate,
    toDate,
    accessToken
  ) => {
    const response = await fetch(
      `${BACKEND_URL}/api/imagery`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: region.lat,
          lng: region.lng,
          fromDate,
          toDate,
          accessToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch imagery');
    }

    const blob = await response.blob();

    return URL.createObjectURL(blob);
  };

  // Handle region selection
  const handleRegionClick = async (region) => {
    const requestId = imageryRequestRef.current + 1;

    imageryRequestRef.current = requestId;
    mapInstanceRef.current.flyTo(
      [region.lat, region.lng],
      11
    );

    setIsLoadingImagery(true);
    setImageryError(null);
    setAiAnalysis(null);
    setBeforeImage(null);
    setAfterImage(null);
    setSelectedRegionName(region.name);
    setShowAfter(true);

    if (overlayLayerRef.current) {
      mapInstanceRef.current.removeLayer(
        overlayLayerRef.current
      );
      overlayLayerRef.current = null;
    }

    try {
      const accessToken = token || (await fetchToken());

      const before = await fetchImagery(
        region,
        '2022-06-01',
        '2022-06-30',
        accessToken
      );

      const after = await fetchImagery(
        region,
        '2022-08-01',
        '2022-08-31',
        accessToken
      );

      if (requestId !== imageryRequestRef.current) return;

      setBeforeImage(before);
      setAfterImage(after);

      const bounds = [
        [region.lat - 0.15, region.lng - 0.15],
        [region.lat + 0.15, region.lng + 0.15],
      ];

      overlayLayerRef.current = L.imageOverlay(
        after,
        bounds
      ).addTo(mapInstanceRef.current);
    } catch (err) {
      if (requestId !== imageryRequestRef.current) return;

      console.error(err);

      setImageryError(
        err.message ||
          tokenError ||
          'Failed to load satellite imagery. Please try again.'
      );
    } finally {
      setIsLoadingImagery(false);
    }
  };

  // Analyze imagery with AI
  const analyzeWithAI = async () => {
  setIsAnalyzing(true);
  setAiAnalysis(null);

  try {
    const beforeBlob = await fetch(beforeImage).then((res) =>
      res.blob()
    );

    const afterBlob = await fetch(afterImage).then((res) =>
      res.blob()
    );

    const beforeBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(beforeBlob);
    });

    const afterBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(afterBlob);
    });

    const response = await fetch(
      `${BACKEND_URL}/api/analyze`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: selectedRegionName || 'Selected region',
          fromDate: '2022-06-01',
          toDate: '2022-08-31',
          beforeImage: beforeBase64,
          afterImage: afterBase64,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('AI analysis failed');
    }

    const data = await response.json();

    setAiAnalysis(data.analysis);
  } catch (err) {
    console.error(err);

    setAiAnalysis(
      'Failed to analyze the imagery.'
    );
  } finally {
    setIsAnalyzing(false);
  }
};

  return (
    <div
      style={{
        position: 'relative',
        height: '100vh',
        width: '100%',
      }}
    >
      {/* Region buttons */}
      <div
        aria-busy={!hasToken}
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          background: 'white',
          padding: '8px',
        }}
      >
        {REGIONS.map((region) => (
          <button
            key={region.name}
            onClick={() =>
              handleRegionClick(region)
            }
          >
            {region.name}
          </button>
        ))}
      </div>

      {/* About button */}
      <button
        onClick={() =>
          setShowAbout(!showAbout)
        }
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          background: 'white',
          padding: '8px',
        }}
      >
        ℹ️ About
      </button>

      {/* About panel */}
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
            boxShadow:
              '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            About this tool
          </h3>

          <p>
            This tool compares real satellite imagery
            of Sindh, Pakistan before and during the
            2022 floods — one of the worst climate
            disasters in the country's recent history.
          </p>

          <p>
            Imagery is pulled live from Sentinel-2,
            via the Copernicus Data Space Ecosystem.
            "Before" shows June 2022; "after" shows
            August 2022.
          </p>

          <p>
            Regions shown were confirmed among the
            hardest-hit districts in published flood
            research.
          </p>

          <button
            onClick={() =>
              setShowAbout(false)
            }
          >
            Close
          </button>
        </div>
      )}

      {/* Loading message */}
      {isLoadingImagery && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 90,
            zIndex: 1000,
            background: 'white',
            padding: '8px',
          }}
        >
          Loading satellite imagery...
        </div>
      )}

      {/* Error message */}
      {imageryError && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 10,
            zIndex: 1000,
            background: '#fee',
            color: '#900',
            padding: '8px',
          }}
        >
          {imageryError}
        </div>
      )}

      {/* Imagery controls */}
      {(beforeImage || afterImage) && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 10,
            zIndex: 1000,
          }}
        >
          {/* AI button */}
          <button
            onClick={analyzeWithAI}
            disabled={isAnalyzing}
            style={{
              display: 'block',
              marginBottom: 4,
            }}
          >
            {isAnalyzing
              ? 'Analyzing...'
              : 'Analyze with AI'}
          </button>

          {/* Before / After button */}
          <button
            onClick={() => {
              const newShowAfter = !showAfter;

              setShowAfter(newShowAfter);

              if (
                overlayLayerRef.current &&
                mapInstanceRef.current
              ) {
                const bounds =
                  overlayLayerRef.current.getBounds();

                mapInstanceRef.current.removeLayer(
                  overlayLayerRef.current
                );

                const newImage = newShowAfter
                  ? afterImage
                  : beforeImage;

                overlayLayerRef.current =
                  L.imageOverlay(
                    newImage,
                    bounds
                  ).addTo(
                    mapInstanceRef.current
                  );
              }
            }}
            style={{
              marginBottom: 4,
            }}
          >
            Show{' '}
            {showAfter
              ? 'Before (June)'
              : 'After (August)'}
          </button>

          {/* Image preview */}
          <img
            src={
              showAfter
                ? afterImage
                : beforeImage
            }
            alt={
              showAfter
                ? 'August 2022 imagery'
                : 'June 2022 imagery'
            }
            style={{
              display: 'block',
              width: 250,
              border: '2px solid white',
            }}
          />

          {/* AI result */}
          {aiAnalysis && (
            <div
              style={{
                marginTop: 8,
                background: 'white',
                padding: '10px',
                width: 250,
                boxShadow:
                  '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <strong>AI Analysis</strong>

              <p>{aiAnalysis}</p>
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div
        ref={mapContainerRef}
        style={{
          height: '100%',
          width: '100%',
        }}
      />
    </div>
  );
}

export default App;
