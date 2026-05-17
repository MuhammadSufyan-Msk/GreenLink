// ============================================
// InfluxDB Service — Read/Write Sensor Data
// ============================================
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

let influxClient = null;
let writeApi = null;
let queryApi = null;

const BUCKET = process.env.INFLUXDB_BUCKET || 'sensor_data';
const ORG = process.env.INFLUXDB_ORG || 'greenlink';

async function initInflux() {
  const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
  const token = process.env.INFLUXDB_TOKEN || '';

  influxClient = new InfluxDB({ url, token });
  writeApi = influxClient.getWriteApi(ORG, BUCKET, 'ns');
  queryApi = influxClient.getQueryApi(ORG);

  console.log(`[InfluxDB] Connected to ${url}, bucket: ${BUCKET}`);
}

/**
 * Write a sensor data point to InfluxDB
 */
function writeSensorData(nodeId, nodeType, sensorData) {
  if (!writeApi) {
    console.warn('[InfluxDB] Not connected, skipping write');
    return;
  }

  const point = new Point('environmental')
    .tag('node_id', nodeId)
    .tag('node_type', nodeType) // 'rural' or 'urban'
    .timestamp(new Date());

  // Common fields (BME280)
  if (sensorData.temperature !== undefined) point.floatField('temperature', sensorData.temperature);
  if (sensorData.humidity !== undefined) point.floatField('humidity', sensorData.humidity);
  if (sensorData.pressure !== undefined) point.floatField('pressure', sensorData.pressure);

  // Rural-specific
  if (sensorData.water_level !== undefined) point.floatField('water_level', sensorData.water_level);
  if (sensorData.soil_moisture !== undefined) point.floatField('soil_moisture', sensorData.soil_moisture);

  // Urban-specific
  if (sensorData.light_intensity !== undefined) point.floatField('light_intensity', sensorData.light_intensity);
  if (sensorData.pm25 !== undefined) point.floatField('pm25', sensorData.pm25);
  if (sensorData.air_quality !== undefined) point.floatField('air_quality', sensorData.air_quality);

  // AI filter metadata
  if (sensorData.filtered !== undefined) point.booleanField('ai_filtered', sensorData.filtered);
  if (sensorData.anomaly !== undefined) point.booleanField('anomaly_detected', sensorData.anomaly);

  writeApi.writePoint(point);
}

/**
 * Query latest sensor data for all nodes
 */
async function getLatestData() {
  if (!queryApi) return [];

  const query = `
    from(bucket: "${BUCKET}")
      |> range(start: -5m)
      |> filter(fn: (r) => r._measurement == "environmental")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;

  const results = [];
  return new Promise((resolve, reject) => {
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        results.push(tableMeta.toObject(row));
      },
      error(err) { reject(err); },
      complete() { resolve(results); }
    });
  });
}

/**
 * Query historical data with time range
 */
async function getHistoricalData(nodeId, startTime, endTime, aggregateWindow = '5m') {
  if (!queryApi) return [];

  let nodeFilter = '';
  if (nodeId) {
    nodeFilter = `|> filter(fn: (r) => r.node_id == "${nodeId}")`;
  }

  const query = `
    from(bucket: "${BUCKET}")
      |> range(start: ${startTime}, stop: ${endTime})
      |> filter(fn: (r) => r._measurement == "environmental")
      ${nodeFilter}
      |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"])
  `;

  const results = [];
  return new Promise((resolve, reject) => {
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        results.push(tableMeta.toObject(row));
      },
      error(err) { reject(err); },
      complete() { resolve(results); }
    });
  });
}

/**
 * Flush pending writes
 */
async function flushWrites() {
  if (writeApi) await writeApi.flush();
}

module.exports = {
  initInflux,
  writeSensorData,
  getLatestData,
  getHistoricalData,
  flushWrites
};
