import { useCallback, useMemo, useRef, useState } from 'react';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 4;

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function roundValue(value, precision = 3) {
  return Number(Number(value).toFixed(precision));
}

function getZoomTier(zoom) {
  if (zoom <= 5) return 'state';
  if (zoom <= 10) return 'cluster';
  return 'store';
}

const brandColors = {
  A: '#ef4444', B: '#1d4ed8', C: '#0f766e', D: '#f59e0b', E: '#6d28d9',
  F: '#15803d', G: '#be123c', H: '#0f172a', I: '#0284c7', J: '#8b5cf6',
  K: '#db2777', L: '#0ea5e9', M: '#ea580c', N: '#4b5563', O: '#14b8a6',
  P: '#7c3aed', Q: '#d97706', R: '#dc2626', S: '#2563eb', T: '#16a34a',
  U: '#7c3aed', V: '#0f172a', W: '#ea580c', X: '#0ea5e9', Y: '#16a34a',
  Z: '#db2777',
};

const stateIconCache = {};
function createStateIcon(state, count) {
  const cacheKey = `${state}-${count}`;
  if (stateIconCache[cacheKey]) return stateIconCache[cacheKey];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
      <circle cx="48" cy="48" r="44" fill="#ffffff" stroke="#0f172a" stroke-width="6" />
      <text x="48" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#0f172a">${state}</text>
      <text x="48" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#0f172a">${count}</text>
    </svg>
  `;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(48, 48),
    anchor: new window.google.maps.Point(24, 24),
  };
  stateIconCache[cacheKey] = icon;
  return icon;
}

const storeIconCache = {};
function createStoreIcon(brandInitial) {
  if (storeIconCache[brandInitial]) return storeIconCache[brandInitial];

  const color = brandColors[brandInitial] || '#ef4444';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
      <circle cx="20" cy="20" r="18" fill="${color}" stroke="#ffffff" stroke-width="4" />
      <text x="20" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff">${brandInitial}</text>
    </svg>
  `;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(40, 40),
    anchor: new window.google.maps.Point(20, 20),
  };
  storeIconCache[brandInitial] = icon;
  return icon;
}

const clusterIconCache = {};
function createClusterIcon(count) {
  if (clusterIconCache[count]) return clusterIconCache[count];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56">
      <circle cx="28" cy="28" r="24" fill="#111827" opacity="0.95" />
      <circle cx="28" cy="28" r="18" fill="#111827" />
      <text x="28" y="33" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff">${count}</text>
    </svg>
  `;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(56, 56),
    anchor: new window.google.maps.Point(28, 28),
  };
  clusterIconCache[count] = icon;
  return icon;
}

export default function StoreMap() {
  const [status, setStatus] = useState('loading');
  const [viewport, setViewport] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [tier, setTier] = useState('state');
  const [selectedMarker, setSelectedMarker] = useState(null);
  const cacheRef = useRef({});
  const mapRef = useRef(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const fetchViewportData = useCallback(async (bounds, zoom) => {
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const cacheKey = [
      roundValue(ne.lat()),
      roundValue(ne.lng()),
      roundValue(sw.lat()),
      roundValue(sw.lng()),
      Math.floor(zoom),
    ].join('|');

    if (cacheRef.current[cacheKey]) {
      const cached = cacheRef.current[cacheKey];
      setMarkers(cached.items);
      setTier(cached.tier);
      setStatus('ready');
      return;
    }

    setStatus('loading');

    try {
      const params = new URLSearchParams({
        neLat: ne.lat().toString(),
        neLng: ne.lng().toString(),
        swLat: sw.lat().toString(),
        swLng: sw.lng().toString(),
        zoom: zoom.toString(),
      });
      const response = await fetch(`${apiBaseUrl}/api/locations?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch viewport data.');
      }

      cacheRef.current[cacheKey] = data;
      setMarkers(data.items || []);
      setTier(data.tier || 'state');
      setStatus('ready');
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  }, [apiBaseUrl]);

  const debouncedFetch = useMemo(
    () => debounce((bounds, zoom) => fetchViewportData(bounds, zoom), 250),
    [fetchViewportData],
  );

  const handleBoundsChanged = useCallback(() => {
    const bounds = mapRef.current?.getBounds();
    const zoom = mapRef.current?.getZoom();
    if (bounds && typeof zoom === 'number') {
      setViewport({ bounds, zoom });
      debouncedFetch(bounds, zoom);
    }
  }, [debouncedFetch]);

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
    setStatus('ready');
    handleBoundsChanged();
  }, [handleBoundsChanged]);

  const handleClusterClick = useCallback((lat, lng) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(mapRef.current.getZoom() + 2);
    }
  }, []);

  if (loadError) {
    return <div className="map-placeholder">Failed to load Google Maps API.</div>;
  }

  if (!apiKey) {
    return (
      <div className="map-placeholder">
        Missing <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env</code>.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="map-placeholder">Loading map engine…</div>;
  }

  const storeMarkers = markers.filter((marker) => marker.markerType === 'store');
  const stateMarkers = markers.filter((marker) => marker.markerType === 'state');
  const clusterMarkers = markers.filter((marker) => marker.markerType === 'cluster');
  
  const zoomTier = viewport ? getZoomTier(viewport.zoom) : 'state';

  return (
    <div className="map-container">
      <div className="map-status">Status: {status}</div>
      <GoogleMap
        mapContainerClassName="google-map"
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        onLoad={handleMapLoad}
        onBoundsChanged={handleBoundsChanged}
        options={{ gestureHandling: 'greedy' }}
      >
        {zoomTier === 'state' && stateMarkers.map((marker) => (
          <Marker
            key={`state-${marker.state}`}
            position={{ lat: marker.lat, lng: marker.lng }}
            icon={createStateIcon(marker.state, marker.count)}
            title={`${marker.state}: ${marker.count} stores`}
          />
        ))}

        {zoomTier === 'cluster' && clusterMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={{ lat: marker.latitude, lng: marker.longitude }}
            icon={createClusterIcon(marker.count)}
            onClick={() => handleClusterClick(marker.latitude, marker.longitude)}
          />
        ))}

        {zoomTier === 'cluster' && storeMarkers.map((marker) => (
          <Marker
            key={`iso-${marker.id}`}
            position={{ lat: marker.latitude, lng: marker.longitude }}
            icon={createClusterIcon(1)}
            onClick={() => handleClusterClick(marker.latitude, marker.longitude)}
          />
        ))}

        {zoomTier === 'store' && storeMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={{ lat: marker.latitude, lng: marker.longitude }}
            icon={createStoreIcon(marker.brand_initial || 'S')}
            title={`${marker.brand_initial} • ${marker.city}, ${marker.state}`}
            onClick={() => setSelectedMarker(marker)}
          />
        ))}

        {selectedMarker && (
          <InfoWindow
            position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="info-window-content">
              <strong>{selectedMarker.brand_initial}</strong>
              <p>{selectedMarker.city}, {selectedMarker.state} {selectedMarker.zipcode}</p>
              <p>Status: {selectedMarker.status}</p>
              <p>Type: {selectedMarker.type}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      <div className="map-overlay">
        <strong>Viewport</strong>
        <p>Zoom: {viewport?.zoom ?? '—'}</p>
        <p>Tier: {zoomTier}</p>
        <p>{status === 'loading' ? 'Fetching data…' : 'Data loaded'}</p>
      </div>
    </div>
  );
}
