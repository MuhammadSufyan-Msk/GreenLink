// ============================================
// Node Routes — Sensor Node Management
// ============================================
const router = require('express').Router();
const passport = require('passport');
const { getLatestNodeData, getNodeData } = require('../services/mqttConsumer');

/**
 * @swagger
 * /api/nodes:
 *   get:
 *     tags: [Nodes]
 *     summary: Get all registered sensor nodes with status
 *     security: [{ bearerAuth: [] }]
 */
router.get('/',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const allData = getLatestNodeData();
    const nodes = Object.entries(allData).map(([id, data]) => ({
      node_id: id,
      node_name: data.node_name || id,
      node_type: data.node_type,
      status: data.status || 'unknown',
      battery: data.battery ? Math.round(data.battery) : null,
      rssi: data.rssi ? Math.round(data.rssi) : null,
      last_seen: data.last_seen,
      is_online: data.last_seen
        ? (Date.now() - new Date(data.last_seen).getTime()) < 30000
        : false
    }));

    const online = nodes.filter(n => n.is_online).length;
    const offline = nodes.length - online;

    res.json({
      total: nodes.length,
      online,
      offline,
      nodes
    });
  }
);

/**
 * @swagger
 * /api/nodes/{nodeId}:
 *   get:
 *     tags: [Nodes]
 *     summary: Get specific node details
 *     parameters:
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema: { type: string }
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:nodeId',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const data = getNodeData(req.params.nodeId);
    if (!data) return res.status(404).json({ error: true, message: 'Node not found' });

    res.json({
      node_id: req.params.nodeId,
      ...data,
      is_online: data.last_seen
        ? (Date.now() - new Date(data.last_seen).getTime()) < 30000
        : false
    });
  }
);

module.exports = router;
