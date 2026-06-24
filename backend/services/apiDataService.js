// ============================================
// API Data Service — Open-Meteo Air Quality REST API (free, no key required)
// Powers the "API Data" tab — completely separate from AWS IoT Core hardware data.
// API Docs: https://open-meteo.com/en/docs/air-quality-api
// ============================================

const CITIES = [
  { id: 'API-FAISALABAD', name: 'Open-Meteo REST API — Faisalabad', lat: 31.4504, lon: 73.1350, tz: 'Asia/Karachi' },
  { id: 'API-LAHORE', name: 'Open-Meteo REST API — Lahore', lat: 31.5204, lon: 74.3587, tz: 'Asia/Karachi' }
];

let cachedApiNodes = {};
let apiDataInterval = null;
let dataCallback = null;

/**
 * Fetch live air quality data from Open-Meteo for multiple cities.
 * Uses Node.js built-in fetch with explicit error handling.
 */
async function fetchApiData() {
  const fields = [
    'pm10', 'pm2_5',
    'us_aqi',
    'european_aqi',
    'carbon_monoxide',
    'nitrogen_dioxide',
    'ozone'
  ].join(',');

  for (const city of CITIES) {
    try {
      const url =
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${city.lat}&longitude=${city.lon}` +
        `&current=${fields}` +
        `&timezone=${city.tz}`;

      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const c = data.current || {};

      const pm25         = typeof c.pm2_5         === 'number' ? Math.round(c.pm2_5 * 10) / 10 : null;
      const pm10         = typeof c.pm10          === 'number' ? Math.round(c.pm10  * 10) / 10 : null;
      const us_aqi       = typeof c.us_aqi        === 'number' ? Math.round(c.us_aqi) : null;
      const eu_aqi       = typeof c.european_aqi  === 'number' ? Math.round(c.european_aqi) : null;
      const co           = typeof c.carbon_monoxide=== 'number' ? Math.round(c.carbon_monoxide) : null;
      const no2          = typeof c.nitrogen_dioxide==='number' ? Math.round(c.nitrogen_dioxide * 100) / 100 : null;
      const o3           = typeof c.ozone         === 'number' ? Math.round(c.ozone * 100) / 100 : null;

      const nodeData = {
        node_id:          city.id,
        node_name:        city.name,
        node_type:        'api',
        source:           'rest-api',
        status:           'online',
        battery:          null,
        rssi:             null,
        last_seen:        new Date().toISOString(),
        // All sensor readings at top-level (mapped by route handler into sensors{})
        pm25,
        pm10,
        air_quality:      us_aqi,
        eu_aqi,
        nitrogen_dioxide: no2,
        ozone:            o3,
        carbon_monoxide:  co,
        filtered:         true,
        anomaly:          false
      };

      cachedApiNodes[city.id] = nodeData;

      console.log(
        `[API] Open-Meteo ${city.name.split(' — ')[1]} → PM2.5: ${pm25} µg/m³ | PM10: ${pm10} µg/m³ | US AQI: ${us_aqi} | EU AQI: ${eu_aqi}`
      );

      if (dataCallback) {
        try {
          dataCallback(city.id, 'api', nodeData);
        } catch (cbErr) {
          console.warn('[API] Broadcast callback error:', cbErr.message);
        }
      }
    } catch (err) {
      console.warn(`[API] Open-Meteo fetch failed for ${city.name}:`, err.message);
      // Keep stale cache if available, just update timestamp
      if (cachedApiNodes[city.id]) {
        cachedApiNodes[city.id].last_seen = new Date().toISOString();
      }
    }
  }
  return cachedApiNodes;
}

/**
 * Start periodic refresh every 15 minutes.
 */
function startApiDataService(callback) {
  if (callback) dataCallback = callback;
  if (apiDataInterval) return;
  console.log('[API] Starting Open-Meteo air quality service for Faisalabad & Lahore...');
  fetchApiData(); // Immediate first fetch on startup
  apiDataInterval = setInterval(fetchApiData, 15 * 60 * 1000);
}

function stopApiDataService() {
  if (apiDataInterval) {
    clearInterval(apiDataInterval);
    apiDataInterval = null;
  }
}

/** Returns the first cached API node (backward compatibility) */
function getApiNode() {
  return Object.values(cachedApiNodes)[0] || null;
}

/** Returns all cached API nodes as an object */
function getApiNodes() {
  return cachedApiNodes;
}

module.exports = { startApiDataService, stopApiDataService, getApiNode, getApiNodes, fetchApiData };

