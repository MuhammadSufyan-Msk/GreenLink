const mqtt = require('mqtt');
const { writeSensorData } = require('./firebaseService');
const { checkThresholds } = require('./alertEngine');
const { startApiDataService, getApiNode, getApiNodes } = require('./apiDataService');

let mqttClient = null;
let awsMqttClient = null;
let wsInstance = null;

// In-memory store: keyed by node_id, populated by AWS IoT + simulation
let latestNodeData = {};
let simulationInterval = null;

/**
 * Connect to MQTT broker and subscribe to sensor data topics
 */
function connectMQTT(wsInst) {
  wsInstance = wsInst;

  // Start external REST API data service (powers the 'API Data' tab)
  startApiDataService((nodeId, nodeType, data) => {
    broadcastToClients({
      type: 'sensor_data',
      node_id: nodeId,
      node_type: nodeType,
      data,
      timestamp: new Date().toISOString()
    });
  });

  // Connect to AWS IoT Core (for Urban Nodes)
  connectAWSIoT(wsInst);

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
    { id: 'URBAN-001', type: 'urban', name: 'Simulated Urban Node', status: 'online' },
    { id: 'RURAL-001', type: 'rural', name: 'Rural Node (Offline)', status: 'offline' }
  ];

  const { getWeather } = require('./weatherService');
  simulationInterval = setInterval(() => {
    const weather = getWeather();
    nodes.forEach(node => {
      // Keep simulated urban node active so we always have multiple (>1) urban nodes
      // if (node.type === 'urban' && Object.keys(latestNodeData).some(id => id.startsWith('AWS-'))) {
      //   return;
      // }
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
 * Get latest data for all nodes, filtered by source type.
 * - 'urban'  → AWS IoT Core nodes (real hardware, node_type='urban')
 * - 'rural'  → Simulated rural nodes (node_type='rural')
 * - 'api'    → Open-Meteo REST API node (source='rest-api')
 * - null/all → Everything combined
 */
function getLatestNodeData(source = null) {
  // Build the combined dataset: in-memory MQTT/sim nodes + external API nodes
  const apiNodes = getApiNodes();
  const combined = { ...latestNodeData };
  if (apiNodes) {
    Object.values(apiNodes).forEach(node => {
      combined[node.node_id] = node;
    });
  }

  if (!source) return combined; // Return everything

  if (source === 'api') {
    // Return only nodes sourced from the external REST API
    return Object.fromEntries(
      Object.entries(combined).filter(([, n]) => n.source === 'rest-api')
    );
  }

  // 'urban' or 'rural' — filter by node_type from MQTT/simulation only
  return Object.fromEntries(
    Object.entries(latestNodeData).filter(([, n]) =>
      n.node_type && n.node_type.toLowerCase().includes(source.toLowerCase())
    )
  );
}

/**
 * Get data for a specific node
 */
function getNodeData(nodeId) {
  const apiNodes = getApiNodes();
  if (apiNodes && apiNodes[nodeId]) return apiNodes[nodeId];
  return latestNodeData[nodeId] || null;
}

/**
 * Get a summary of available data sources and their node counts
 */
function getSourceSummary() {
  const awsNodes = Object.values(latestNodeData);
  const apiNodes = Object.values(getApiNodes());
  return [
    {
      id: 'urban',
      label: 'Urban Node',
      icon: '🏙️',
      desc: 'Live AWS IoT Core hardware sensors',
      count: awsNodes.filter(n => (n.node_type || '').toLowerCase().includes('urban')).length,
      online: awsNodes.filter(n => (n.node_type || '').toLowerCase().includes('urban') && n.status === 'online').length
    },
    {
      id: 'rural',
      label: 'Rural Node',
      icon: '🌾',
      desc: 'Field water, soil & crop sensors',
      count: awsNodes.filter(n => (n.node_type || '').toLowerCase().includes('rural')).length,
      online: awsNodes.filter(n => (n.node_type || '').toLowerCase().includes('rural') && n.status === 'online').length
    },
    {
      id: 'api',
      label: 'API Data',
      icon: '📡',
      desc: 'Open-Meteo air quality REST API',
      count: apiNodes.length,
      online: apiNodes.filter(n => n.status === 'online').length
    }
  ];
}

/**
 * Connect to AWS IoT Core and subscribe to data
 */
function connectAWSIoT(wsInst) {
  const fs = require('fs');
  const path = require('path');

  const endpoint = process.env.AWS_IOT_ENDPOINT || 'a2erh5oc2fsaxy-ats.iot.ap-southeast-2.amazonaws.com';
  const certsDir = process.env.AWS_IOT_CERTS_DIR 
    ? path.resolve(__dirname, '..', process.env.AWS_IOT_CERTS_DIR) 
    : path.join(__dirname, '../../certs');
  
  const caFile = path.join(certsDir, 'AmazonRootCA1.pem');
  const keyFile = path.join(certsDir, '4eb24ec384ed2be191f04735af51e51cbddf71deebd3dd3b3a830ee01116fdd9-private.pem.key');
  
  // Choose the non-empty certificate file
  let certFile = path.join(certsDir, '4eb24ec384ed2be191f04735af51e51cbddf71deebd3dd3b3a830ee01116fdd9-certificate.pem (1).crt');
  if (!fs.existsSync(certFile) || fs.statSync(certFile).size === 0) {
    certFile = path.join(certsDir, '4eb24ec384ed2be191f04735af51e51cbddf71deebd3dd3b3a830ee01116fdd9-certificate.pem.crt');
  }

  if (!fs.existsSync(caFile) || !fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
    console.warn('[AWS IoT] Missing certificate files. Skipping AWS IoT Core connection.');
    return;
  }

  const options = {
    host: endpoint,
    port: 8883,
    protocol: 'mqtts',
    clientId: `greenlink_backend_aws_${Date.now()}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile),
    ca: [fs.readFileSync(caFile)],
    rejectUnauthorized: true
  };

  try {
    console.log('[AWS IoT] Connecting to AWS IoT Core at:', endpoint);
    awsMqttClient = mqtt.connect(options);

    awsMqttClient.on('connect', () => {
      console.log(`[AWS IoT] Successfully connected to ${endpoint}`);
      awsMqttClient.subscribe('greenlink/environment/urban', { qos: 1 });
      awsMqttClient.subscribe('greenlink/environment/+', { qos: 1 });
      awsMqttClient.subscribe('greenlink/+/data', { qos: 1 });
      awsMqttClient.subscribe('greenlink/+/status', { qos: 1 });
    });

    awsMqttClient.on('message', handleAWSMessage);

    awsMqttClient.on('error', (err) => {
      console.error(`[AWS IoT] Connection error: ${err.message}`);
    });
  } catch (err) {
    console.error('[AWS IoT] Connection failed:', err.message);
  }
}

/**
 * Calculate AQI from PM2.5 concentration using the US EPA standard formula
 */
function calculateAQI(pm25) {
  if (pm25 === undefined || pm25 === null || isNaN(pm25)) return 0;
  
  // Standard US EPA PM2.5 breakpoints and AQI values
  const breakpoints = [
    { cMin: 0.0, cMax: 12.0, iMin: 0, iMax: 50 },
    { cMin: 12.1, cMax: 35.4, iMin: 51, iMax: 100 },
    { cMin: 35.5, cMax: 55.4, iMin: 101, iMax: 150 },
    { cMin: 55.5, cMax: 150.4, iMin: 151, iMax: 200 },
    { cMin: 150.5, cMax: 250.4, iMin: 201, iMax: 300 },
    { cMin: 250.5, cMax: 350.4, iMin: 301, iMax: 400 },
    { cMin: 350.5, cMax: 500.4, iMin: 401, iMax: 500 }
  ];

  for (const bp of breakpoints) {
    if (pm25 >= bp.cMin && pm25 <= bp.cMax) {
      const aqi = ((bp.iMax - bp.iMin) / (bp.cMax - bp.cMin)) * (pm25 - bp.cMin) + bp.iMin;
      return Math.round(aqi);
    }
  }

  if (pm25 > 500.4) return 500;
  return 0;
}

/**
 * Handle incoming messages from AWS IoT Core
 */
function handleAWSMessage(topic, message) {
  try {
    const payload = JSON.parse(message.toString());
    const parts = topic.split('/');
    // Stable node ID derived solely from topic path — never from packet_id.
    // This ensures the same physical node always overwrites the same slot in
    // latestNodeData, keeping counts stable (Urban: 1, Rural: 1, API: 2).
    // e.g. "greenlink/environment/urban" → "AWS-URBAN"
    const nodeCategory = parts[2] || parts[1] || 'device';
    const baseId = (payload.node || nodeCategory).toUpperCase();
    const nodeId = `AWS-${baseId}`;

    // Map AWS fields (temp -> temperature, hum -> humidity, lux -> light_intensity, gas -> raw gas value)
    const temperature = typeof payload.temp === 'number' ? payload.temp : (payload.temperature || 0);
    const humidity = typeof payload.hum === 'number' ? payload.hum : (payload.humidity || 0);
    const pressure = typeof payload.pressure === 'number' ? payload.pressure : 1013;
    const pm25 = typeof payload.pm25 === 'number' ? payload.pm25 : 10;
    const pm10 = typeof payload.pm10 === 'number' ? payload.pm10 : 12;
    const light_intensity = typeof payload.lux === 'number' ? payload.lux : (payload.light_intensity || 0);
    
    // Calculate air quality index based on PM2.5 concentration using EPA standard
    const air_quality = calculateAQI(pm25);

    const typeLabel = (payload.node || nodeCategory).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const mapped = {
      node_id: nodeId,
      node_name: `AWS ${typeLabel} Node`,
      node_type: 'urban',
      source: 'aws-iot',   // marks this as live hardware data
      status: 'online',
      battery: payload.battery || 100,
      rssi: payload.rssi || -50,
      last_seen: new Date().toISOString(),
      // Mapped sensor fields
      temperature,
      humidity,
      pressure,
      pm25,
      pm10,
      air_quality,
      light_intensity,
      gas_resistance: payload.gas, // Keep raw gas resistance available
      filtered: true,
      anomaly: false
    };

    latestNodeData[nodeId] = mapped;

    // Allow simulated and AWS nodes to coexist
    // Object.keys(latestNodeData).forEach(key => {
    //   if (key !== nodeId && latestNodeData[key].node_type === 'urban' && !key.startsWith('AWS-')) {
    //     delete latestNodeData[key];
    //   }
    // });

    writeSensorData(nodeId, 'urban', {
      temperature,
      humidity,
      pressure,
      pm25,
      air_quality,
      light_intensity
    });

    // Check alert thresholds
    checkThresholds(nodeId, 'urban', {
      temperature,
      humidity,
      pressure,
      pm25,
      air_quality,
      light_intensity
    });

    // Broadcast mapped state to WebSocket clients
    broadcastToClients({
      type: 'sensor_data',
      node_id: nodeId,
      node_type: 'urban',
      data: mapped,
      timestamp: new Date().toISOString()
    });

    console.log(`[AWS IoT] Processed telemetry message from node: ${nodeId} (${temperature}°C, ${humidity}%)`);
  } catch (err) {
    console.error('[AWS IoT] Message parse error:', err.message);
  }
}

module.exports = { connectMQTT, getLatestNodeData, getNodeData, getSourceSummary };
