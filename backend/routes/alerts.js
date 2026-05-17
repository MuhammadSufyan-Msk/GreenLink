// ============================================
// Alert Routes — CRUD + Acknowledge
// ============================================
const router = require('express').Router();
const passport = require('passport');
const { getAlerts, acknowledgeAlert, getAlertStats, alertRules } = require('../services/alertEngine');

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     tags: [Alerts]
 *     summary: Get alert list with optional filters
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [critical, high, medium] }
 *       - in: query
 *         name: nodeId
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     security: [{ bearerAuth: [] }]
 */
router.get('/',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const { severity, nodeId, limit = 50 } = req.query;
    const alerts = getAlerts({
      severity,
      nodeId,
      limit: parseInt(limit)
    });
    res.json({ count: alerts.length, alerts });
  }
);

/**
 * @swagger
 * /api/alerts/stats:
 *   get:
 *     tags: [Alerts]
 *     summary: Get alert statistics
 *     security: [{ bearerAuth: [] }]
 */
router.get('/stats',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json(getAlertStats());
  }
);

/**
 * @swagger
 * /api/alerts/rules:
 *   get:
 *     tags: [Alerts]
 *     summary: Get threshold rules
 *     security: [{ bearerAuth: [] }]
 */
router.get('/rules',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json(alertRules);
  }
);

/**
 * @swagger
 * /api/alerts/{id}/acknowledge:
 *   patch:
 *     tags: [Alerts]
 *     summary: Acknowledge an alert
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     security: [{ bearerAuth: [] }]
 */
router.patch('/:id/acknowledge',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const alert = acknowledgeAlert(req.params.id);
    if (!alert) return res.status(404).json({ error: true, message: 'Alert not found' });
    res.json(alert);
  }
);

module.exports = router;
