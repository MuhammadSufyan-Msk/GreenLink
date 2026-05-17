// ============================================
// GreenLink+ Backend — Main Server Entry Point
// ============================================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const expressWs = require('express-ws');
const passport = require('passport');
const path = require('path');

const { setupSwagger } = require('./config/swagger');
const { configurePassport } = require('./config/passport');
const { connectMQTT } = require('./services/mqttConsumer');
const { initInflux } = require('./services/influxService');
const { startAlertEngine } = require('./services/alertEngine');

// Import routes
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const alertRoutes = require('./routes/alerts');
const nodeRoutes = require('./routes/nodes');

const app = express();
const wsInstance = expressWs(app);

// ── Middleware ──────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ── Passport Config ────────────────────────
configurePassport(passport);

// ── Swagger API Docs ───────────────────────
setupSwagger(app);

// ── REST Routes ────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/nodes', nodeRoutes);

// ── WebSocket for Real-Time Data ───────────
app.ws('/ws/live', (ws, req) => {
  console.log('[WS] Client connected for live data');
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ── Health Check ───────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'GreenLink+ Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ── Static serving for production ──────────
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// ── Error Handler ──────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: true,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ── Start Server ───────────────────────────
const PORT = process.env.PORT || 5000;

async function boot() {
  try {
    // Initialize services
    await initInflux();
    console.log('[✓] InfluxDB connected');

    connectMQTT(wsInstance);
    console.log('[✓] MQTT consumer started');

    startAlertEngine();
    console.log('[✓] Alert engine started');

    app.listen(PORT, () => {
      console.log(`\n🌿 GreenLink+ Backend running on http://localhost:${PORT}`);
      console.log(`📖 API Docs: http://localhost:${PORT}/api-docs\n`);
    });
  } catch (err) {
    console.error('[FATAL] Boot failed:', err.message);
    // Start server anyway for development without external services
    app.listen(PORT, () => {
      console.log(`\n🌿 GreenLink+ Backend running on http://localhost:${PORT} (degraded mode)`);
      console.log(`📖 API Docs: http://localhost:${PORT}/api-docs\n`);
    });
  }
}

boot();

module.exports = app;
