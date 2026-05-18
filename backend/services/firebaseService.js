// ============================================
// Firebase Service — Real-time Firestore DB
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
    db = admin.firestore();
    return;
  }

  // Root directory contains the JSON credentials file
  const credentialsFile = path.join(__dirname, '..', '..', 'greenlinkplus-4c685-firebase-adminsdk-fbsvc-8b36f07b9a.json');

  try {
    if (fs.existsSync(credentialsFile)) {
      console.log('[Firebase] Initializing via credentials JSON file...');
      admin.initializeApp({
        credential: admin.credential.cert(require(credentialsFile))
      });
    } else {
      console.log('[Firebase] JSON credential file not found. Falling back to Environment Variables...');
      
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        })
      });
    }

    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    console.log('[✓] Firebase Admin initialized successfully');
  } catch (err) {
    console.error('[FATAL] Failed to initialize Firebase:', err.message);
  }
}

/**
 * Write a sensor data point to Firebase Firestore
 */
async function writeSensorData(nodeId, nodeType, sensorData) {
  if (!db) {
    console.warn('[Firebase] Firestore not initialized, skipping write');
    return;
  }

  try {
    const docRef = db.collection('sensor_data').doc();
    await docRef.set({
      node_id: nodeId,
      node_type: nodeType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      temperature: sensorData.temperature,
      humidity: sensorData.humidity,
      pressure: sensorData.pressure,
      water_level: sensorData.water_level,
      soil_moisture: sensorData.soil_moisture,
      light_intensity: sensorData.light_intensity,
      pm25: sensorData.pm25,
      air_quality: sensorData.air_quality,
      filtered: sensorData.filtered,
      anomaly: sensorData.anomaly
    });
  } catch (err) {
    console.error('[Firebase] Error writing sensor data point:', err.message);
  }
}

/**
 * Query historical data for nodes from Firebase Firestore
 */
async function getHistoricalData(nodeId, startTime, endTime, aggregateWindow = '5m') {
  if (!db) return [];

  try {
    let query = db.collection('sensor_data')
      .orderBy('timestamp', 'desc');

    if (nodeId && nodeId !== 'all') {
      query = query.where('node_id', '==', nodeId);
    }

    const snapshot = await query.limit(200).get();
    const results = snapshot.docs.map(doc => {
      const data = doc.data();
      const timeString = data.timestamp 
        ? data.timestamp.toDate().toISOString() 
        : new Date().toISOString();

      return {
        _time: timeString,
        node_id: data.node_id,
        node_type: data.node_type,
        temperature: data.temperature,
        humidity: data.humidity,
        pressure: data.pressure,
        water_level: data.water_level,
        soil_moisture: data.soil_moisture,
        light_intensity: data.light_intensity,
        pm25: data.pm25,
        air_quality: data.air_quality,
        filtered: data.filtered,
        anomaly: data.anomaly
      };
    });

    // Return in chronological order
    return results.reverse();
  } catch (err) {
    console.error('[Firebase] Error fetching historical data:', err.message);
    return [];
  }
}

module.exports = {
  initFirebase,
  writeSensorData,
  getHistoricalData
};
