// ============================================
// Dashboard Page — Real-time Environmental Overview
// ============================================
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Thermometer, Droplets, Wind, Waves,
  TreePine, Sun, Moon, CloudRain, Cpu,
  AlertTriangle, Wifi, WifiOff, Activity,
  ChevronDown, Radio, Globe, Antenna
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { getLiveData, getAlertStats } from '../services/api';
import wsService from '../services/websocket';

function Dashboard({ theme, toggleTheme, dataSource, setDataSource }) {
  const [nodes, setNodes] = useState([]);
  const [alertStats, setAlertStats] = useState({ total: 0, unacknowledged: 0, critical: 0, high: 0 });
  const [chartData, setChartData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [analyticsMode, setAnalyticsMode] = useState('native');
  const [grafanaOnline, setGrafanaOnline] = useState(false);
  const [dsDropdownOpen, setDsDropdownOpen] = useState(false);
  const dsDropdownRef = useRef(null);

  const DATA_SOURCES = [
    { id: 'urban',  label: 'Urban Node',  icon: '🏙️',  desc: 'Live AWS IoT Core hardware sensors' },
    { id: 'rural',  label: 'Rural Node',  icon: '🌾',  desc: 'Field water, soil & crop sensors' },
    { id: 'api',    label: 'API Data',    icon: '📡',  desc: 'Open-Meteo air quality REST API' },
  ];

  const activeDS = DATA_SOURCES.find(d => d.id === dataSource) || DATA_SOURCES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dsDropdownRef.current && !dsDropdownRef.current.contains(e.target)) {
        setDsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fallbackChartData = Array.from({ length: 15 }, (_, i) => {
    const time = new Date(Date.now() - (15 - i) * 60000).toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    return {
      time,
      pm25: Math.round(35 + Math.sin(i * 0.5) * 10 + Math.random() * 5),
      air_quality: Math.round(50 + Math.sin(i * 0.5) * 15 + Math.random() * 8),
      temperature: Math.round(28 + Math.sin(i * 0.3) * 2),
      humidity: Math.round(45 + Math.cos(i * 0.3) * 5)
    };
  });

  const checkGrafanaStatus = useCallback(async () => {
    const url = import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000';
    try {
      const img = new Image();
      img.onload = () => setGrafanaOnline(true);
      img.onerror = () => setGrafanaOnline(false);
      img.src = `${url}/public/img/grafana_icon.svg?t=${Date.now()}`;
    } catch {
      setGrafanaOnline(false);
    }
  }, []);

  useEffect(() => {
    checkGrafanaStatus();
    const interval = setInterval(checkGrafanaStatus, 5000);
    return () => clearInterval(interval);
  }, [checkGrafanaStatus]);

  const fetchData = useCallback(async () => {
    try {
      const [liveRes, alertRes] = await Promise.all([
        getLiveData(dataSource).catch(() => ({ data: { nodes: [] } })),
        getAlertStats().catch(() => ({ data: { total: 0, unacknowledged: 0, critical: 0, high: 0 } }))
      ]);
      if (liveRes.data?.nodes) {
        setNodes(liveRes.data.nodes);
        setLastUpdate(new Date());
      }
      setAlertStats(alertRes.data || {});
    } catch { /* handled above */ }
  }, [dataSource]);

  // Initial data load
  useEffect(() => {
    setNodes([]); // Reset nodes on datasource swap
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // WebSocket real-time updates
  useEffect(() => {
    const unsub = wsService.subscribe('sensor_data', (msg) => {
      // Filter websocket events to match the currently selected source
      if (dataSource) {
        const isMatch = msg.node_type && msg.node_type.toLowerCase().includes(dataSource.toLowerCase());
        if (!isMatch) return;
      }

      setNodes(prev => {
        const existing = prev.findIndex(n => n.node_id === msg.node_id);
        const updated = {
          node_id: msg.node_id,
          node_name: msg.data.node_name,
          node_type: msg.node_type,
          source: msg.data.source || 'simulated',
          status: msg.data.status || 'online',
          battery: msg.data.battery,
          rssi: msg.data.rssi,
          last_seen: msg.data.last_seen || new Date().toISOString(),
          sensors: {
            temperature: msg.data.temperature,
            humidity: msg.data.humidity,
            pressure: msg.data.pressure,
            water_level: msg.data.water_level,
            soil_moisture: msg.data.soil_moisture,
            light_intensity: msg.data.light_intensity,
            pm25: msg.data.pm25,
            pm10: msg.data.pm10,
            air_quality: msg.data.air_quality,
            gas_resistance: msg.data.gas_resistance
          },
          ai: {
            filtered: msg.data.filtered,
            anomaly: msg.data.anomaly
          }
        };
        if (existing >= 0) {
          const newNodes = [...prev];
          newNodes[existing] = { ...newNodes[existing], ...updated };
          return newNodes;
        }
        // New node arriving — if it's a real AWS node, evict stale simulated nodes of the same type
        let base = [...prev];
        if (msg.node_id && msg.node_id.startsWith('AWS-')) {
          base = base.filter(n =>
            !(n.node_type === msg.node_type && !n.node_id.startsWith('AWS-'))
          );
        }
        return [...base, updated];
      });
      setLastUpdate(new Date());

      // Add to chart data (keep last 20 points)
      setChartData(prev => {
        const point = {
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          ...msg.data
        };
        const updated = [...prev, point];
        return updated.slice(-20);
      });
    });
    return unsub;
  }, [dataSource]);

  // Aggregated stats
  const onlineNodes = nodes.filter(n => n.status === 'online').length;
  const totalNodes = nodes.length;
  const tempNodes = nodes.filter(n => (n.sensors?.temperature !== undefined || n.temperature !== undefined));
  const avgTemp = tempNodes.length 
    ? (tempNodes.reduce((s, n) => s + (n.sensors?.temperature || n.temperature || 0), 0) / tempNodes.length).toFixed(1) 
    : '--';
  const humNodes = nodes.filter(n => (n.sensors?.humidity !== undefined || n.humidity !== undefined));
  const avgHumidity = humNodes.length 
    ? (humNodes.reduce((s, n) => s + (n.sensors?.humidity || n.humidity || 0), 0) / humNodes.length).toFixed(1) 
    : '--';
  const aqNodes = nodes.filter(n => (n.sensors?.air_quality || n.air_quality));
  const avgAQ = aqNodes.length
    ? (aqNodes.reduce((s, n) => s + (n.sensors?.air_quality || n.air_quality || 0), 0) / aqNodes.length).toFixed(0)
    : '--';

  const chartTheme = {
    background: 'transparent',
    text: '#5f7d6e',
    grid: 'rgba(34, 197, 94, 0.06)',
    tooltip: { bg: '#111916', border: 'rgba(34, 197, 94, 0.2)' }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: chartTheme.tooltip.bg,
        border: `1px solid ${chartTheme.tooltip.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: '0.75rem'
      }}>
        <div style={{ color: '#a7c4b5', marginBottom: 6 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, display: 'flex', gap: 8, marginBottom: 2 }}>
            <span style={{ opacity: 0.7 }}>{p.name}:</span>
            <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Environmental Dashboard</h2>
          <div className="page-header-subtitle">
            Real-time monitoring across all sensor nodes
            {lastUpdate && (
              <span style={{ marginLeft: 12, color: 'var(--text-accent)' }}>
                • Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* ── Data Source Dropdown ── */}
          <div className="ds-dropdown-wrapper" ref={dsDropdownRef}>
            <button
              id="data-source-toggle"
              className="btn-ghost ds-dropdown-trigger"
              onClick={() => setDsDropdownOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={dsDropdownOpen}
              title="Select data source"
            >
              <span className="ds-trigger-icon">{activeDS.icon}</span>
              <span className="ds-trigger-label">{activeDS.label}</span>
              <ChevronDown
                size={14}
                className={`ds-chevron ${dsDropdownOpen ? 'open' : ''}`}
              />
            </button>

            {dsDropdownOpen && (
              <div className="ds-dropdown-menu" role="listbox">
                <div className="ds-dropdown-header">Data Source</div>
                {DATA_SOURCES.map(source => (
                  <button
                    key={source.id}
                    id={`ds-option-${source.id}`}
                    role="option"
                    aria-selected={dataSource === source.id}
                    className={`ds-dropdown-item ${dataSource === source.id ? 'active' : ''}`}
                    onClick={() => { setDataSource(source.id); setDsDropdownOpen(false); }}
                  >
                    <span className="ds-item-icon">{source.icon}</span>
                    <span className="ds-item-text">
                      <span className="ds-item-label">{source.label}</span>
                      <span className="ds-item-desc">{source.desc}</span>
                    </span>
                    {dataSource === source.id && (
                      <span className="ds-item-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Theme Toggle ── */}
          <button
            onClick={toggleTheme}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <div className="data-flow-indicator">
            <span className="data-flow-dot" />
            Live Data Stream
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* ── Stat Cards ── */}
        <div className="stats-grid">
          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(34, 197, 94, 0.12)' }}>
              <Cpu size={20} color="#4ade80" />
            </div>
            <div className="stat-card-label">Active Nodes</div>
            <div className="stat-card-value" style={{ color: 'var(--text-accent)' }}>
              {onlineNodes}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/{totalNodes}</span>
            </div>
            <div className="stat-card-change positive">
              {totalNodes > 0 ? Math.round((onlineNodes / totalNodes) * 100) : 0}% online
            </div>
          </div>

          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(249, 115, 22, 0.12)' }}>
              <Thermometer size={20} color="#f97316" />
            </div>
            <div className="stat-card-label">Avg Temperature</div>
            <div className="stat-card-value" style={{ color: 'var(--color-temperature)' }}>
              {avgTemp}<span className="card-unit">°C</span>
            </div>
          </div>

          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
              <Droplets size={20} color="#3b82f6" />
            </div>
            <div className="stat-card-label">Avg Humidity</div>
            <div className="stat-card-value" style={{ color: 'var(--color-humidity)' }}>
              {avgHumidity}<span className="card-unit">%</span>
            </div>
          </div>

          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(34, 211, 238, 0.12)' }}>
              <Wind size={20} color="#22d3ee" />
            </div>
            <div className="stat-card-label">Avg Air Quality</div>
            <div className="stat-card-value" style={{ color: 'var(--color-air-quality)' }}>
              {avgAQ}<span className="card-unit">AQI</span>
            </div>
          </div>

          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
              <AlertTriangle size={20} color="#ef4444" />
            </div>
            <div className="stat-card-label">Active Alerts</div>
            <div className="stat-card-value" style={{ color: alertStats.unacknowledged > 0 ? 'var(--severity-critical)' : 'var(--text-accent)' }}>
              {alertStats.unacknowledged || 0}
            </div>
            {alertStats.critical > 0 && (
              <div className="stat-card-change negative">{alertStats.critical} critical</div>
            )}
          </div>

          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(139, 92, 246, 0.12)' }}>
              <Activity size={20} color="#8b5cf6" />
            </div>
            <div className="stat-card-label">AI Filtering</div>
            <div className="stat-card-value" style={{ color: '#8b5cf6' }}>Active</div>
            <div className="stat-card-change positive">1D CNN pipeline</div>
          </div>
        </div>

        {/* ── Charts ── */}
        <div className="charts-grid">
          {/* Temperature & Humidity Trend */}
          <div className="chart-card">
            <div className="card-header">
              <span className="card-title">Temperature & Humidity Trend</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Last 20 readings</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="time" tick={{ fill: chartTheme.text, fontSize: 10 }} />
                <YAxis tick={{ fill: chartTheme.text, fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="temperature" stroke="#f97316" fill="url(#tempGrad)" strokeWidth={2} name="Temperature (°C)" dot={false} />
                <Area type="monotone" dataKey="humidity" stroke="#3b82f6" fill="url(#humGrad)" strokeWidth={2} name="Humidity (%)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Air Quality Chart */}
          <div className="chart-card">
            <div className="card-header">
              <span className="card-title">Air Quality Index</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PM2.5 & AQI</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="time" tick={{ fill: chartTheme.text, fontSize: 10 }} />
                <YAxis tick={{ fill: chartTheme.text, fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pm25" fill="#ef4444" opacity={0.7} radius={[4, 4, 0, 0]} name="PM2.5 (µg/m³)" />
                <Bar dataKey="air_quality" fill="#22d3ee" opacity={0.7} radius={[4, 4, 0, 0]} name="AQI" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Water Level & Soil Moisture */}
          <div className="chart-card full-width">
            <div className="card-header">
              <span className="card-title">Rural Sensors — Water Level & Soil Moisture</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="time" tick={{ fill: chartTheme.text, fontSize: 10 }} />
                <YAxis tick={{ fill: chartTheme.text, fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="water_level" stroke="#06b6d4" strokeWidth={2} name="Water Level (cm)" dot={false} />
                <Line type="monotone" dataKey="soil_moisture" stroke="#a16207" strokeWidth={2} name="Soil Moisture (%)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Node Cards ── */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Sensor Nodes</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live readings from field-deployed ESP32 nodes</p>
        </div>
        <div className="nodes-grid">
          {nodes.map((node, i) => {
            const s = node.sensors || node;
            const isRural = (node.node_type || '').includes('rural');
            return (
              <div key={node.node_id || i} className="node-card animate-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="node-card-header">
                  <div>
                    <div className="node-card-name">
                      <span className={`status-dot ${node.status === 'online' ? 'online' : 'offline'}`} />
                      {node.node_name || node.node_id}
                    </div>
                    {/* AWS IoT Live badge */}
                    {node.source === 'aws-iot' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
                        color: '#22d3ee', background: 'rgba(34,211,238,0.12)',
                        border: '1px solid rgba(34,211,238,0.3)',
                        borderRadius: 4, padding: '1px 6px', marginTop: 4
                      }}>
                        📡 AWS IoT LIVE
                      </span>
                    )}
                  </div>
                  <span className={`node-card-type ${isRural ? 'rural' : ''}`}>
                    {isRural ? '🌾 Rural' : '🏙️ Urban'}
                  </span>
                </div>
                <div className="node-sensors">
                  {(s.temperature !== undefined || node.status === 'offline') && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">🌡️ Temperature</span>
                      <span className="sensor-reading-value" style={{ color: 'var(--color-temperature)' }}>
                        {typeof s.temperature === 'number' ? `${s.temperature.toFixed(1)}°C` : '--'}
                      </span>
                    </div>
                  )}
                  {(s.humidity !== undefined || node.status === 'offline') && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">💧 Humidity</span>
                      <span className="sensor-reading-value" style={{ color: 'var(--color-humidity)' }}>
                        {typeof s.humidity === 'number' ? `${s.humidity.toFixed(1)}%` : '--'}
                      </span>
                    </div>
                  )}
                  {(s.water_level !== undefined || (isRural && node.status === 'offline')) && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">🌊 Water Level</span>
                      <span className="sensor-reading-value" style={{ color: 'var(--color-water-level)' }}>
                        {typeof s.water_level === 'number' ? `${s.water_level.toFixed(1)}cm` : '--'}
                      </span>
                    </div>
                  )}
                  {(s.soil_moisture !== undefined || (isRural && node.status === 'offline')) && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">🌱 Soil Moisture</span>
                      <span className="sensor-reading-value" style={{ color: 'var(--color-soil-moisture)' }}>
                        {typeof s.soil_moisture === 'number' ? `${s.soil_moisture.toFixed(1)}%` : '--'}
                      </span>
                    </div>
                  )}
                  {(s.pm25 !== undefined || (!isRural && node.status === 'offline')) && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">🫁 PM2.5</span>
                      <span className="sensor-reading-value" style={{ color: 'var(--color-pm25)' }}>
                        {typeof s.pm25 === 'number' ? `${s.pm25.toFixed(1)}µg` : '--'}
                      </span>
                    </div>
                  )}
                  {s.pm10 !== undefined && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">🌫️ PM10</span>
                      <span className="sensor-reading-value" style={{ color: '#f59e0b' }}>
                        {typeof s.pm10 === 'number' ? `${s.pm10.toFixed(1)}µg` : '--'}
                      </span>
                    </div>
                  )}
                  {(s.air_quality !== undefined || (!isRural && node.status === 'offline')) && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">💨 Air Quality</span>
                      <span className="sensor-reading-value" style={{ color: 'var(--color-air-quality)' }}>
                        {typeof s.air_quality === 'number' ? `${s.air_quality.toFixed(0)} AQI` : '--'}
                      </span>
                    </div>
                  )}
                  {/* EU AQI — Open-Meteo API only */}
                  {s.eu_aqi !== undefined && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">🇪🇺 EU AQI</span>
                      <span className="sensor-reading-value" style={{ color: '#a78bfa' }}>
                        {typeof s.eu_aqi === 'number' ? s.eu_aqi : '--'}
                      </span>
                    </div>
                  )}
                  {s.nitrogen_dioxide !== undefined && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">🔵 NO₂</span>
                      <span className="sensor-reading-value" style={{ color: '#60a5fa' }}>
                        {typeof s.nitrogen_dioxide === 'number' ? `${s.nitrogen_dioxide.toFixed(2)} µg/m³` : '--'}
                      </span>
                    </div>
                  )}
                  {s.ozone !== undefined && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">🟣 O₃</span>
                      <span className="sensor-reading-value" style={{ color: '#c084fc' }}>
                        {typeof s.ozone === 'number' ? `${s.ozone.toFixed(2)} µg/m³` : '--'}
                      </span>
                    </div>
                  )}
                  {s.carbon_monoxide !== undefined && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">💀 CO</span>
                      <span className="sensor-reading-value" style={{ color: '#fb7185' }}>
                        {typeof s.carbon_monoxide === 'number' ? `${s.carbon_monoxide} µg/m³` : '--'}
                      </span>
                    </div>
                  )}
                  {(s.light_intensity !== undefined || (!isRural && node.status === 'offline')) && (
                    <div className="sensor-reading">
                      <span className="sensor-reading-label">☀️ Light</span>
                      <span className="sensor-reading-value" style={{ color: 'var(--color-light)' }}>
                        {typeof s.light_intensity === 'number' ? `${s.light_intensity.toFixed(0)} lx` : '--'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {nodes.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <Wifi size={48} />
              <p style={{ marginTop: 12 }}>Waiting for sensor data...</p>
              <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Start the backend server to see live data</p>
            </div>
          )}
        </div>

        {/* ── Detailed Analytics ── */}
        <div style={{ marginTop: 32 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Detailed Analytics</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setAnalyticsMode('native')}
                className={`btn-ghost btn-sm ${analyticsMode === 'native' ? 'active' : ''}`}
                style={{
                  padding: '4px 12px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  border: analyticsMode === 'native' ? '1px solid var(--text-accent)' : '1px solid transparent',
                  background: analyticsMode === 'native' ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                  color: analyticsMode === 'native' ? 'var(--text-accent)' : 'var(--text-muted)'
                }}
              >
                📊 Native Chart
              </button>
              <button 
                onClick={() => setAnalyticsMode('grafana')}
                className={`btn-ghost btn-sm ${analyticsMode === 'grafana' ? 'active' : ''}`}
                style={{
                  padding: '4px 12px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  border: analyticsMode === 'grafana' ? '1px solid var(--text-accent)' : '1px solid transparent',
                  background: analyticsMode === 'grafana' ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                  color: analyticsMode === 'grafana' ? 'var(--text-accent)' : 'var(--text-muted)'
                }}
              >
                📈 Grafana Panel
              </button>
            </div>
          </div>
          
          <div className="chart-card full-width" style={{ padding: analyticsMode === 'native' ? '20px' : '0px', overflow: 'hidden', position: 'relative', minHeight: '300px' }}>
            {analyticsMode === 'native' ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.length > 0 ? chartData : fallbackChartData}>
                  <defs>
                    <linearGradient id="pm25Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="time" tick={{ fill: chartTheme.text, fontSize: 10 }} />
                  <YAxis tick={{ fill: chartTheme.text, fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="pm25" stroke="#ef4444" fill="url(#pm25Grad)" strokeWidth={2} name="PM2.5 (µg/m³)" dot={false} />
                  <Area type="monotone" dataKey="air_quality" stroke="#22d3ee" fill="url(#aqiGrad)" strokeWidth={2} name="AQI" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : grafanaOnline ? (
              <iframe 
                src={`${import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000'}/d-solo/greenlink-main/greenlink-environmental-monitoring?orgId=1&panelId=2&theme=${theme}`} 
                width="100%" 
                height="300" 
                frameBorder="0"
                style={{ display: 'block' }}
                title="Grafana PM2.5 Panel"
              ></iframe>
            ) : (
              <div style={{
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                minHeight: '300px'
              }}>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  padding: '12px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <AlertTriangle size={32} />
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-accent)', marginBottom: '8px' }}>
                  Grafana Server is Offline
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '24px', lineHeight: '1.5' }}>
                  GreenLink could not reach the Grafana server at <code>{import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000'}</code>. Make sure Grafana is running on your machine.
                </p>
                
                <div style={{
                  width: '100%',
                  maxWidth: '600px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '20px',
                  textAlign: 'left',
                  marginBottom: '24px'
                }}>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-accent)', marginBottom: '12px' }}>
                    🚀 How to Start Grafana with Embedding Enabled:
                  </h5>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
                    To allow Grafana to render inside this dashboard, embedding must be allowed. Run either command:
                  </p>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6', marginBottom: '4px' }}>🐳 Using Docker (Recommended):</div>
                    <pre style={{
                      background: 'rgba(0,0,0,0.4)',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: '#a7c4b5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      docker run -d -p 3000:3000 --name=grafana -e "GF_SECURITY_ALLOW_EMBEDDING=true" grafana/grafana
                    </pre>
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>💻 Local Install (PowerShell):</div>
                    <pre style={{
                      background: 'rgba(0,0,0,0.4)',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: '#a7c4b5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      $env:GF_SECURITY_ALLOW_EMBEDDING="true"; grafana-server.exe
                    </pre>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => setAnalyticsMode('native')}
                    style={{
                      background: 'var(--color-primary, #22c55e)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 20px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    📊 Use Native Live Chart
                  </button>
                  <button 
                    onClick={checkGrafanaStatus}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-accent)',
                      padding: '8px 20px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    🔄 Retry Connection
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {analyticsMode === 'grafana' && (
            <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              💡 <strong>Troubleshooting embedding:</strong> Grafana blocks iframe embedding by default. To fix this, set <code>allow_embedding = true</code> in your <code>grafana.ini</code> configuration, or run Grafana with the environment variable <code>GF_SECURITY_ALLOW_EMBEDDING=true</code>.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Dashboard;
