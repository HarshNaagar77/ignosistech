require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ensureData, getStateAggregates, getVisibleStores } = require('./db');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

ensureData();

function parseBounds(req) {
  const params = req.query;
  const neLat = Number(params.neLat);
  const neLng = Number(params.neLng);
  const swLat = Number(params.swLat);
  const swLng = Number(params.swLng);
  const zoom = Number(params.zoom);

  if ([neLat, neLng, swLat, swLng, zoom].some((value) => Number.isNaN(value))) {
    return null;
  }

  return {
    bounds: { neLat, neLng, swLat, swLng },
    zoom,
  };
}

app.get('/api/locations', (req, res) => {
  const parsed = parseBounds(req);
  if (!parsed) {
    return res.status(400).json({ error: 'Missing or invalid bounds/zoom parameters.' });
  }

  const { bounds, zoom } = parsed;
  const tier = zoom <= 5 ? 'state' : 'stores';
  let items = [];

  if (tier === 'state') {
    items = getStateAggregates({ bounds }).map((item) => ({
      markerType: 'state',
      ...item,
    }));
  } else {
    items = getVisibleStores({ bounds, zoom });
  }

  return res.json({ zoom, tier, items });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

(async function start() {
  try {
    await ensureData();
    app.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize backend:', error);
    process.exit(1);
  }
})();
