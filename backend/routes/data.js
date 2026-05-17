// ============================================
// Data Routes — Live + Historical Sensor Data
// ============================================
const router = require('express').Router();
const passport = require('passport');
const { getLatestNodeData, getNodeData } = require('../services/mqttConsumer');
const { getHistoricalData } = require('../services/influxService');

/**
 * @swagger
 * /api/data/live:
 *   get:
 *     tags: [Sensor Data]
 *     summary: Get latest sensor data from all nodes
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Latest sensor readings from all active nodes
 */
router.get('/live',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const data = getLatestNodeData();
    const nodes = Object.values(data).map(node => ({
      node_id: node.node_id,
      node_name: node.node_name,
      node_type: node.node_type,
      status: node.status || 'unknown',
      battery: node.battery,
      rssi: node.rssi,
      last_seen: node.last_seen,
      sensors: {
        temperature: node.temperature,
        humidity: node.humidity,
        pressure: node.pressure,
        water_level: node.water_level,
        soil_moisture: node.soil_moisture,
        light_intensity: node.light_intensity,
        pm25: node.pm25,
        air_quality: node.air_quality
      },
      ai: {
        filtered: node.filtered,
        anomaly: node.anomaly
      }
    }));

    res.json({
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
      const { nodeId, start = '-24h', end = 'now()', window = '5m' } = req.query;
      const data = await getHistoricalData(nodeId, start, end, window);
      res.json({ count: data.length, data });
    } catch (err) {
      res.status(500).json({ error: true, message: err.message });
    }
  }
);

module.exports = router;
