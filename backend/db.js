const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const SuperclusterLib = require('supercluster');
const Supercluster = SuperclusterLib.default || SuperclusterLib;

const CSV_PATH = process.env.DATA_CSV_PATH || path.join(__dirname, 'data', 'stores.csv');
const stores = [];
let baseCluster = null;

function parseFloatValue(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function insertStoreRow(row) {
  const lat = parseFloatValue(row.latitude);
  const lng = parseFloatValue(row.longitude);

  if (lat === null || lng === null) {
    return;
  }

  const brand = row.brand_initial || row.brand_name || '';
  const state = row.state ? row.state.trim().toUpperCase() : '';
  const status = row.status ? row.status.trim() : '';

  const store = {
    id: row.id || `${state}-${row.city}-${lat}-${lng}`,
    brand_initial: brand ? String(brand).trim().charAt(0).toUpperCase() : '',
    latitude: lat,
    longitude: lng,
    state,
    city: row.city ? row.city.trim() : '',
    zipcode: row.zipcode ? row.zipcode.trim() : '',
    status,
    type: row.type ? row.type.trim() : '',
    channel: row.channel ? row.channel.trim() : '',
  };

  stores.push(store);
}

function seedSampleData() {
  const sampleRows = [
    { id: '1', brand_initial: 'A', latitude: 34.0522, longitude: -118.2437, state: 'CA', city: 'Los Angeles', zipcode: '90012', status: 'Active', type: 'Retail', channel: 'Store' },
    { id: '2', brand_initial: 'B', latitude: 40.7128, longitude: -74.0060, state: 'NY', city: 'New York', zipcode: '10004', status: 'Active', type: 'Retail', channel: 'Store' },
    { id: '3', brand_initial: 'C', latitude: 41.8781, longitude: -87.6298, state: 'IL', city: 'Chicago', zipcode: '60604', status: 'Planned', type: 'Retail', channel: 'Store' },
    { id: '4', brand_initial: 'A', latitude: 29.7604, longitude: -95.3698, state: 'TX', city: 'Houston', zipcode: '77002', status: 'Closed', type: 'Retail', channel: 'Store' },
    { id: '5', brand_initial: 'B', latitude: 33.4484, longitude: -112.0740, state: 'AZ', city: 'Phoenix', zipcode: '85004', status: 'Active', type: 'Retail', channel: 'Store' }
  ];
  sampleRows.forEach(insertStoreRow);
}

function getStateAggregates({ bounds }) {
  // Filter by bounds manually for state aggregates
  const visible = stores.filter(row =>
    row.longitude >= bounds.swLng && row.longitude <= bounds.neLng &&
    row.latitude >= bounds.swLat && row.latitude <= bounds.neLat
  );

  const groups = visible.reduce((acc, row) => {
    const state = row.state || 'UNKNOWN';
    if (!acc[state]) {
      acc[state] = { state, count: 0, latSum: 0, lngSum: 0 };
    }
    acc[state].count += 1;
    acc[state].latSum += row.latitude;
    acc[state].lngSum += row.longitude;
    return acc;
  }, {});

  return Object.values(groups)
    .map((group) => ({
      state: group.state,
      count: group.count,
      lat: group.latSum / group.count,
      lng: group.lngSum / group.count,
    }))
    .sort((a, b) => b.count - a.count);
}

function getVisibleStores({ bounds, zoom }) {
  if (!baseCluster) return [];

  const bbox = [bounds.swLng, bounds.swLat, bounds.neLng, bounds.neLat];

  // getClusters returns features which can be clusters or leaves
  const clusters = baseCluster.getClusters(bbox, Math.floor(zoom));

  // Supercluster expands the bounding box by the cluster radius.
  // We must strictly filter out points outside the exact viewport bounds.
  const strictClusters = clusters.filter(c => {
    const lng = c.geometry.coordinates[0];
    const lat = c.geometry.coordinates[1];
    return lng >= bounds.swLng && lng <= bounds.neLng &&
      lat >= bounds.swLat && lat <= bounds.neLat;
  });

  return strictClusters.map(c => {
    if (c.properties.cluster) {
      return {
        markerType: 'cluster',
        id: `cluster-${c.properties.cluster_id}`,
        latitude: c.geometry.coordinates[1],
        longitude: c.geometry.coordinates[0],
        count: c.properties.point_count,
        cluster_id: c.properties.cluster_id
      };
    } else {
      return {
        markerType: 'store',
        ...c.properties
      };
    }
  });
}

function loadCsv(filePath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream
      .pipe(csvParser())
      .on('data', insertStoreRow)
      .on('end', () => {
        const features = stores.map(store => ({
          type: 'Feature',
          properties: store,
          geometry: { type: 'Point', coordinates: [store.longitude, store.latitude] }
        }));
        baseCluster = new Supercluster({ radius: 60, maxZoom: 10 });
        baseCluster.load(features);
        resolve();
      })
      .on('error', reject);
  });
}

async function ensureData() {
  if (stores.length > 0 && baseCluster) {
    return;
  }

  if (fs.existsSync(CSV_PATH)) {
    await loadCsv(CSV_PATH);
  } else {
    seedSampleData();
    const features = stores.map(store => ({
      type: 'Feature',
      properties: store,
      geometry: { type: 'Point', coordinates: [store.longitude, store.latitude] }
    }));
    baseCluster = new Supercluster({ radius: 60, maxZoom: 10 });
    baseCluster.load(features);
  }
}

module.exports = {
  ensureData,
  getStateAggregates,
  getVisibleStores,
  DATA_CSV_PATH: CSV_PATH,
  stores,
};
