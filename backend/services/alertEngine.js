// ============================================
// Alert Engine — Threshold Detection + Notifications
// ============================================
const { v4: uuidv4 } = require('uuid');

// Alert storage (in-memory for now)
let alerts = [];
let alertRules = {
  temperature: { min: -10, max: 50, unit: '°C', severity: 'high' },
  humidity: { min: 10, max: 95, unit: '%', severity: 'medium' },
  water_level: { min: 0, max: 90, unit: 'cm', severity: 'critical' },
  pm25: { min: 0, max: 100, unit: 'µg/m³', severity: 'high' },
  air_quality: { min: 0, max: 150, unit: 'AQI', severity: 'high' },
  soil_moisture: { min: 15, max: 85, unit: '%', severity: 'medium' }
};

/**
 * Start the alert engine
 */
function startAlertEngine() {
  console.log('[Alert Engine] Monitoring thresholds...');
  // Periodic cleanup of old alerts (keep last 1000)
  setInterval(() => {
    if (alerts.length > 1000) {
      alerts = alerts.slice(-1000);
    }
  }, 60000);
}

/**
 * Check sensor data against threshold rules
 */
function checkThresholds(nodeId, nodeType, sensorData) {
  Object.entries(alertRules).forEach(([metric, rule]) => {
    const value = sensorData[metric];
    if (value === undefined) return;

    let alertType = null;
    let message = '';

    if (value > rule.max) {
      alertType = 'threshold_exceeded';
      message = `${metric} is ${value}${rule.unit} (max: ${rule.max}${rule.unit})`;
    } else if (value < rule.min) {
      alertType = 'threshold_below';
      message = `${metric} is ${value}${rule.unit} (min: ${rule.min}${rule.unit})`;
    }

    if (sensorData.anomaly === true) {
      alertType = 'anomaly_detected';
      message = `AI detected anomaly in ${metric}: ${value}${rule.unit}`;
    }

    if (alertType) {
      const alert = {
        id: uuidv4(),
        node_id: nodeId,
        node_type: nodeType,
        type: alertType,
        metric,
        value,
        threshold: value > rule.max ? rule.max : rule.min,
        severity: rule.severity,
        message,
        acknowledged: false,
        timestamp: new Date().toISOString()
      };

      alerts.unshift(alert);
      console.log(`[ALERT] ${rule.severity.toUpperCase()}: ${message} on ${nodeId}`);

      // Send SMS + Push notification for high/critical alerts
      if (rule.severity === 'high' || rule.severity === 'critical') {
        sendSMSAlert(alert).catch(() => {});
        sendPushNotification(alert).catch(() => {});
      }
    }
  });
}

/**
 * Send SMS alert via Twilio
 */
async function sendSMSAlert(alert) {
  if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID === 'your_twilio_sid') {
    return; // Skip if not configured
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    await client.messages.create({
      body: `🌿 GreenLink+ Alert [${alert.severity.toUpperCase()}]\n${alert.message}\nNode: ${alert.node_id}\nTime: ${alert.timestamp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.ALERT_PHONE_NUMBER || '+1234567890'
    });
    console.log('[SMS] Alert sent');
  } catch (err) {
    console.warn('[SMS] Failed:', err.message);
  }
}

/**
 * Send push notification via Firebase Cloud Messaging
 */
async function sendPushNotification(alert) {
  if (!process.env.FCM_SERVER_KEY || process.env.FCM_SERVER_KEY === 'your_fcm_server_key') {
    return; // Skip if not configured
  }

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FCM_PROJECT_ID,
          privateKey: process.env.FCM_PRIVATE_KEY,
          clientEmail: process.env.FCM_CLIENT_EMAIL
        })
      });
    }

    await admin.messaging().sendToTopic('alerts', {
      notification: {
        title: `GreenLink+ ${alert.severity.toUpperCase()} Alert`,
        body: alert.message
      },
      data: {
        node_id: alert.node_id,
        alert_id: alert.id,
        severity: alert.severity
      }
    });
    console.log('[PUSH] Notification sent');
  } catch (err) {
    console.warn('[PUSH] Failed:', err.message);
  }
}

// ── Alert CRUD ─────────────────────────────

function getAlerts(filters = {}) {
  let result = [...alerts];
  if (filters.severity) result = result.filter(a => a.severity === filters.severity);
  if (filters.nodeId) result = result.filter(a => a.node_id === filters.nodeId);
  if (filters.acknowledged !== undefined) result = result.filter(a => a.acknowledged === filters.acknowledged);
  if (filters.limit) result = result.slice(0, filters.limit);
  return result;
}

function acknowledgeAlert(alertId) {
  const alert = alerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledged_at = new Date().toISOString();
    return alert;
  }
  return null;
}

function getAlertStats() {
  const total = alerts.length;
  const unacknowledged = alerts.filter(a => !a.acknowledged).length;
  const critical = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
  const high = alerts.filter(a => a.severity === 'high' && !a.acknowledged).length;
  return { total, unacknowledged, critical, high };
}

module.exports = {
  startAlertEngine,
  checkThresholds,
  getAlerts,
  acknowledgeAlert,
  getAlertStats,
  alertRules
};
