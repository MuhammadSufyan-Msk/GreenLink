// ============================================
// Data Routes — Live + Historical Sensor Data
// ============================================
const router = require('express').Router();
const passport = require('passport');
const { getLatestNodeData, getNodeData, getSourceSummary } = require('../services/mqttConsumer');
const { getHistoricalData } = require('../services/firebaseService');

/**
 * @swagger
 * /api/data/sources:
 *   get:
 *     tags: [Sensor Data]
 *     summary: Get available data sources (urban, rural, api) with live node counts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of data sources with metadata and node counts
 */
router.get('/sources',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json({
      sources: getSourceSummary(),
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * @swagger
 * /api/data/live:
 *   get:
 *     tags: [Sensor Data]
 *     summary: Get latest sensor data from all nodes (or filtered by source)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [urban, rural, api]
 *         description: Filter nodes by data source type. 'api' returns all nodes.
 *     responses:
 *       200:
 *         description: Latest sensor readings filtered by source
 */
router.get('/live',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const { source } = req.query; // 'urban' | 'rural' | 'api' | undefined
    const data = getLatestNodeData(source || null);

    const nodes = Object.values(data).map(node => ({
      node_id:   node.node_id,
      node_name: node.node_name,
      node_type: node.node_type,
      source:    node.source || 'simulated',
      status:    node.status || 'unknown',
      battery:   node.battery,
      rssi:      node.rssi,
      last_seen: node.last_seen,
      sensors: {
        // Urban / AWS IoT fields
        temperature:      node.temperature,
        humidity:         node.humidity,
        pressure:         node.pressure,
        light_intensity:  node.light_intensity,
        pm25:             node.pm25,
        pm10:             node.pm10,
        air_quality:      node.air_quality,
        gas_resistance:   node.gas_resistance,
        // Rural / simulation fields
        water_level:      node.water_level,
        soil_moisture:    node.soil_moisture,
        // API Data (Open-Meteo) specific fields
        eu_aqi:           node.eu_aqi,
        nitrogen_dioxide: node.nitrogen_dioxide,
        ozone:            node.ozone,
        carbon_monoxide:  node.carbon_monoxide
      },
      ai: {
        filtered: node.filtered,
        anomaly:  node.anomaly
      }
    }));

    res.json({
      source: source || 'all',
      count: nodes.length,
      nodes,
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * @swagger
 * /api/data/live/{nodeId}:
 *   get:
 *     tags: [Sensor Data]
 *     summary: Get latest data for a specific node
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema: { type: string }
 *     security: [{ bearerAuth: [] }]
 */
router.get('/live/:nodeId',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const data = getNodeData(req.params.nodeId);
    if (!data) return res.status(404).json({ error: true, message: 'Node not found' });
    res.json(data);
  }
);

/**
 * @swagger
 * /api/data/history:
 *   get:
 *     tags: [Sensor Data]
 *     summary: Get historical sensor data
 *     parameters:
 *       - in: query
 *         name: nodeId
 *         schema: { type: string }
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [urban, rural, api]
 *         description: Filter by source type (maps to node_type prefix)
 *       - in: query
 *         name: start
 *         schema: { type: string, example: "-24h" }
 *       - in: query
 *         name: end
 *         schema: { type: string, example: "now()" }
 *       - in: query
 *         name: window
 *         schema: { type: string, example: "5m" }
 *     security: [{ bearerAuth: [] }]
 */
router.get('/history',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { nodeId, source, start = '-24h', end = 'now()', window = '5m' } = req.query;

      // If source is given and no specific nodeId, try to resolve a nodeId from source type
      const resolvedNodeId = nodeId || null;
      const data = await getHistoricalData(resolvedNodeId, start, end, window);

      // Filter by source if provided and no explicit nodeId given
      const filtered = (source && !nodeId)
        ? data.filter(d => d.node_type && d.node_type.toLowerCase().includes(source.toLowerCase()))
        : data;

      res.json({ source: source || 'all', count: filtered.length, data: filtered });
    } catch (err) {
      res.status(500).json({ error: true, message: err.message });
    }
  }
);

module.exports = router;


