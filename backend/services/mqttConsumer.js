// ============================================
// MQTT Consumer — Subscribe to Sensor Topics
// ============================================
const mqtt = require('mqtt');
const { writeSensorData } = require('./firebaseService');
const { checkThresholds } = require('./alertEngine');

let mqttClient = null;
let wsInstance = null;

// Simulated data store for demo mode (when MQTT broker unavailable)
let latestNodeData = {};
let simulationInterval = null;

/**
 * Connect to MQTT broker and subscribe to sensor data topics
 */
function connectMQTT(wsInst) {
  wsInstance = wsInst;

  const host = process.env.MQTT_HOST || 'localhost';
  const port = process.env.MQTT_PORT || 1883;
  const url = `mqtt://${host}:${port}`;

  const options = {
    clientId: `greenlink_backend_${Date.now()}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 5000
  };

  if (process.env.MQTT_USERNAME) {
    options.username = process.env.MQTT_USERNAME;
    options.password = process.env.MQTT_PASSWORD;
  }

  try {
    mqttClient = mqtt.connect(url, options);

    mqttClient.on('connect', () => {
      console.log(`[MQTT] Connected to ${url}`);
      // Subscribe to sensor data topics
      mqttClient.subscribe('greenlink/+/data', { qos: 1 });
      mqttClient.subscribe('greenlink/+/status', { qos: 1 });
      mqttClient.subscribe('greenlink/gateway/health', { qos: 1 });
    });

    mqttClient.on('message', handleMessage);

    mqttClient.on('error', (err) => {
      console.warn(`[MQTT] Connection error: ${err.message}`);
      console.log('[MQTT] Falling back to simulation mode...');
      startSimulation();
    });

    mqttClient.on('offline', () => {
      console.warn('[MQTT] Broker offline, simulation mode active');
      startSimulation();
    });
  } catch (err) {
    console.warn('[MQTT] Failed to connect, starting simulation mode');
    startSimulation();
  }
}

/**
 * Handle incoming MQTT messages
 */
function handleMessage(topic, message) {
  try {
    const payload = JSON.parse(message.toString());
    const parts = topic.split('/');
    const nodeId = parts[1]; // greenlink/<nodeId>/data

    if (topic.includes('/data')) {
      // Sensor data from a node (already filtered by edge 1D CNN)
      const nodeType = payload.node_type || 'unknown';

      // Store latest data
      latestNodeData[nodeId] = {
        ...payload,
        node_id: nodeId,
        node_type: nodeType,
        last_seen: new Date().toISOString()
      };

      // Write to InfluxDB
      writeSensorData(nodeId, nodeType, payload);

      // Check alert thresholds
      checkThresholds(nodeId, nodeType, payload);

      // Broadcast to WebSocket clients
      broadcastToClients({
        type: 'sensor_data',
        node_id: nodeId,
        node_type: nodeType,
        data: payload,
        timestamp: new Date().toISOString()
      });

    } else if (topic.includes('/status')) {
      // Node health status
      latestNodeData[nodeId] = {
        ...latestNodeData[nodeId],
        status: payload.status,
        battery: payload.battery,
        rssi: payload.rssi,
        last_seen: new Date().toISOString()
      };

      broadcastToClients({
        type: 'node_status',
        node_id: nodeId,
        data: payload,
        timestamp: new Date().toISOString()
      });
    }

  } catch (err) {
    console.error('[MQTT] Message parse error:', err.message);
  }
}

/**
 * Broadcast data to all connected WebSocket clients
 */
function broadcastToClients(data) {
  if (!wsInstance) return;

  const clients = wsInstance.getWss().clients;
  const payload = JSON.stringify(data);

  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload);
    }
  });
}

/**
 * Start simulated sensor data (for development without MQTT)
 */
function startSimulation() {
  if (simulationInterval) return; // Already running

  console.log('[SIM] Starting sensor simulation...');

  const nodes = [
    { id: 'URBAN-001', type: 'urban', name: 'Test Node Urban', status: 'online' },
    { id: 'RURAL-001', type: 'rural', name: 'Test Node Rural', status: 'offline' }
  ];

  const { getWeather } = require('./weatherService');
  simulationInterval = setInterval(() => {
    const weather = getWeather();
    nodes.forEach(node => {
      let data;

      if (node.status === 'offline') {
        latestNodeData[node.id] = {
          node_id: node.id,
          node_name: node.name,
          node_type: node.type,
          status: 'offline',
          battery: null,
          rssi: null,
          last_seen: null
        };

        // Broadcast to WS that node is offline
        broadcastToClients({
          type: 'node_status',
          node_id: node.id,
          data: { status: 'offline', battery: null, rssi: null },
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (node.type === 'rural') {
        data = {
          node_type: 'rural',
          temperature: weather.temperature + 1.0 + Math.random() * 0.6 - 0.3,
          humidity: Math.min(100, Math.max(0, weather.humidity - 2.0 + Math.random() * 2.0 - 1.0)),
          pressure: weather.pressure + Math.random() * 0.4 - 0.2,
          water_level: 45.2 + Math.random() * 5.0 - 2.5,
          soil_moisture: 38.6 + Math.random() * 4.0 - 2.0,
          filtered: true,
          anomaly: Math.random() < 0.01 // Reduced anomalies for clean demo presentation
        };
      } else {
        data = {
          node_type: 'urban',
          temperature: weather.temperature + 0.5 + Math.random() * 0.8 - 0.4,
          humidity: Math.min(100, Math.max(0, weather.humidity - 2.0 + Math.random() * 2.0 - 1.0)),
          pressure: weather.pressure + Math.random() * 0.4 - 0.2,
          light_intensity: Math.max(0, (new Date().getHours() >= 6 && new Date().getHours() <= 18 ? 650.0 : 15.0) + Math.random() * 40.0 - 20.0),
          pm25: 18.0 + Math.random() * 4.0 - 2.0,
          air_quality: 35.0 + Math.random() * 6.0 - 3.0,
          filtered: true,
          anomaly: Math.random() < 0.01
        };
      }

      // Round values
      Object.keys(data).forEach(k => {
        if (typeof data[k] === 'number') data[k] = Math.round(data[k] * 100) / 100;
      });

      latestNodeData[node.id] = {
        ...data,
        node_id: node.id,
        node_name: node.name,
        node_type: node.type,
        status: 'online',
        battery: 70 + Math.random() * 30,
        rssi: -50 - Math.random() * 40,
        last_seen: new Date().toISOString()
      };

      // Broadcast to WS
      broadcastToClients({
        type: 'sensor_data',
        node_id: node.id,
        node_type: node.type,
        data: latestNodeData[node.id],
        timestamp: new Date().toISOString()
      });

      // Write simulation data to Firebase RTDB for Faisalabad history
      writeSensorData(node.id, node.type, data);

      // Check thresholds
      checkThresholds(node.id, node.type, data);
    });
  }, 3000); // Every 3 seconds
}

/**
 * Get latest data for all nodes
 */
function getLatestNodeData() {
  return latestNodeData;
}

/**
 * Get data for a specific node
 */
function getNodeData(nodeId) {
  return latestNodeData[nodeId] || null;
}

module.exports = { connectMQTT, getLatestNodeData, getNodeData };
