// ============================================
// Firebase Service — Real-time Database (RTDB)
// ============================================
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;

/**
 * Initialize Firebase Admin SDK using local JSON file or Environment Variables
 */
function initFirebase() {
  if (admin.apps.length > 0) {
    db = admin.database();
    return;
  }

  // Root directory contains the JSON credentials file
  const credentialsFile = path.join(__dirname, '..', '..', 'greenlinkplus-4c685-firebase-adminsdk-fbsvc-8b36f07b9a.json');
  const databaseURL = process.env.FIREBASE_DATABASE_URL || "https://greenlinkplus-4c685-default-rtdb.firebaseio.com";

  try {
    if (fs.existsSync(credentialsFile)) {
      console.log(`[Firebase] Initializing RTDB via credentials JSON file at ${databaseURL}...`);
      admin.initializeApp({
        credential: admin.credential.cert(require(credentialsFile)),
        databaseURL: databaseURL
      });
    } else {
      console.log(`[Firebase] JSON credential file not found. Initializing RTDB via Environment Variables at ${databaseURL}...`);
      
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        }),
        databaseURL: databaseURL
      });
    }

    db = admin.database();
    console.log('[✓] Firebase Realtime Database (RTDB) initialized successfully');
  } catch (err) {
    console.error('[FATAL] Failed to initialize Firebase RTDB:', err.message);
  }
}

/**
 * Write a sensor data point to Firebase Realtime Database (RTDB)
 */
async function writeSensorData(nodeId, nodeType, sensorData) {
  if (!db) {
    console.warn('[Firebase] RTDB not initialized, skipping write');
    return;
  }

  try {
    const ref = db.ref('sensor_data').push();
    const payload = {
      node_id: nodeId,
      node_type: nodeType,
      timestamp: Date.now(),
      temperature: sensorData.temperature !== undefined ? sensorData.temperature : null,
      humidity: sensorData.humidity !== undefined ? sensorData.humidity : null,
      pressure: sensorData.pressure !== undefined ? sensorData.pressure : null,
      water_level: sensorData.water_level !== undefined ? sensorData.water_level : null,
      soil_moisture: sensorData.soil_moisture !== undefined ? sensorData.soil_moisture : null,
      light_intensity: sensorData.light_intensity !== undefined ? sensorData.light_intensity : null,
      pm25: sensorData.pm25 !== undefined ? sensorData.pm25 : null,
      air_quality: sensorData.air_quality !== undefined ? sensorData.air_quality : null,
      filtered: sensorData.filtered !== undefined ? sensorData.filtered : null,
      anomaly: sensorData.anomaly !== undefined ? sensorData.anomaly : null
    };
    await ref.set(payload);
  } catch (err) {
    console.error('[Firebase] Error writing sensor data point to RTDB:', err.message);
  }
}

/**
 * Query historical data for nodes from Firebase Realtime Database (RTDB)
 */
async function getHistoricalData(nodeId, startTime, endTime, aggregateWindow = '5m') {
  if (!db) return [];

  try {
    const ref = db.ref('sensor_data');
    let query;

    if (nodeId && nodeId !== 'all') {
      query = ref.orderByChild('node_id').equalTo(nodeId).limitToLast(200);
    } else {
      query = ref.orderByChild('timestamp').limitToLast(200);
    }

    const snapshot = await query.once('value');
    const results = [];

    snapshot.forEach(child => {
      const val = child.val();
      const timeString = val.timestamp 
        ? new Date(val.timestamp).toISOString() 
        : new Date().toISOString();

      results.push({
        _time: timeString,
        node_id: val.node_id,
        node_type: val.node_type,
        temperature: val.temperature,
        humidity: val.humidity,
        pressure: val.pressure,
        water_level: val.water_level,
        soil_moisture: val.soil_moisture,
        light_intensity: val.light_intensity,
        pm25: val.pm25,
        air_quality: val.air_quality,
        filtered: val.filtered,
        anomaly: val.anomaly
      });
    });

    return results;
  } catch (err) {
    console.error('[Firebase] Error fetching historical data from RTDB:', err.message);
    return [];
  }
}

module.exports = {
  initFirebase,
  writeSensorData,
  getHistoricalData
};
