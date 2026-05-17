// ============================================
// MQTT Consumer — Subscribe to Sensor Topics
// ============================================
const mqtt = require('mqtt');
const { writeSensorData } = require('./influxService');
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
    { id: 'RURAL-001', type: 'rural', name: 'Riverside Station Alpha' },
    { id: 'RURAL-002', type: 'rural', name: 'Farmland Station Beta' },
    { id: 'URBAN-001', type: 'urban', name: 'City Center Station' },
    { id: 'URBAN-002', type: 'urban', name: 'Industrial Zone Station' },
    { id: 'URBAN-003', type: 'urban', name: 'Park District Station' }
  ];

  simulationInterval = setInterval(() => {
    nodes.forEach(node => {
      let data;

      if (node.type === 'rural') {
        data = {
          node_type: 'rural',
          temperature: 22 + Math.random() * 15 - 5,
          humidity: 45 + Math.random() * 40,
          pressure: 1010 + Math.random() * 20 - 10,
          water_level: 30 + Math.random() * 70,
          soil_moisture: 20 + Math.random() * 60,
          filtered: true,
          anomaly: Math.random() < 0.05
        };
      } else {
        data = {
          node_type: 'urban',
          temperature: 24 + Math.random() * 12 - 4,
          humidity: 35 + Math.random() * 45,
          pressure: 1012 + Math.random() * 15 - 7,
          light_intensity: 200 + Math.random() * 800,
          pm25: 10 + Math.random() * 150,
          air_quality: 50 + Math.random() * 200,
          filtered: true,
          anomaly: Math.random() < 0.08
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
