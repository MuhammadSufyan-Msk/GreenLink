// ============================================
// API Client — Axios-based backend communication
// ============================================
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('greenlink_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (token expired)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('greenlink_token');
      localStorage.removeItem('greenlink_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ────────────────────────────────────
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const getProfile = () =>
  api.get('/auth/profile');

// ── Sensor Data ─────────────────────────────
export const getLiveData = (source) =>
  api.get('/data/live', { params: source ? { source } : {} });

export const getNodeLiveData = (nodeId) =>
  api.get(`/data/live/${nodeId}`);

export const getHistoricalData = (params) =>
  api.get('/data/history', { params });

// ── Alerts ──────────────────────────────────
export const getAlerts = (params) =>
  api.get('/alerts', { params });

export const getAlertStats = () =>
  api.get('/alerts/stats');

export const acknowledgeAlert = (id) =>
  api.patch(`/alerts/${id}/acknowledge`);

export const getAlertRules = () =>
  api.get('/alerts/rules');

// ── Nodes ───────────────────────────────────
export const getNodes = () =>
  api.get('/nodes');

export const getNodeDetail = (nodeId) =>
  api.get(`/nodes/${nodeId}`);

export default api;
