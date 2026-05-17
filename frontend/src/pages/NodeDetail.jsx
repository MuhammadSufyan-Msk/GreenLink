// ============================================
// Node Detail Page — Individual Node Deep Dive
// ============================================
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Thermometer, Droplets, Wind,
  Waves, TreePine, Sun, Cpu, Battery, Signal
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getNodeLiveData } from '../services/api';
import wsService from '../services/websocket';

function NodeDetail() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const [node, setNode] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchNode();
    const interval = setInterval(fetchNode, 3000);
    return () => clearInterval(interval);
  }, [nodeId]);

  useEffect(() => {
    const unsub = wsService.subscribe('sensor_data', (msg) => {
      if (msg.node_id === nodeId) {
        setNode(prev => ({ ...prev, ...msg.data }));
        setHistory(prev => {
          const point = {
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            ...msg.data
          };
          return [...prev, point].slice(-30);
        });
      }
    });
    return unsub;
  }, [nodeId]);

  const fetchNode = async () => {
    try {
      const res = await getNodeLiveData(nodeId).catch(() => ({ data: null }));
      if (res.data) setNode(res.data);
    } catch { /* handled */ }
  };

  const chartTheme = {
    text: '#5f7d6e',
    grid: 'rgba(34, 197, 94, 0.06)',
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: '#111916', border: '1px solid rgba(34, 197, 94, 0.2)',
        borderRadius: 8, padding: '10px 14px', fontSize: '0.75rem'
      }}>
        <div style={{ color: '#a7c4b5', marginBottom: 6 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
          </div>
        ))}
      </div>
    );
  };

  if (!node) {
    return (
      <>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-ghost btn-sm" onClick={() => navigate('/nodes')}><ArrowLeft size={16} /></button>
            <h2>Node: {nodeId}</h2>
          </div>
        </div>
        <div className="page-body">
          <div className="empty-state">
            <Cpu size={48} />
            <p style={{ marginTop: 12 }}>Loading node data...</p>
          </div>
        </div>
      </>
    );
  }

  const isRural = (node.node_type || '').includes('rural');
  const sensors = isRural
    ? [
        { key: 'temperature', label: 'Temperature', unit: '°C', color: '#f97316', icon: '🌡️' },
        { key: 'humidity', label: 'Humidity', unit: '%', color: '#3b82f6', icon: '💧' },
        { key: 'pressure', label: 'Pressure', unit: 'hPa', color: '#8b5cf6', icon: '🌀' },
        { key: 'water_level', label: 'Water Level', unit: 'cm', color: '#06b6d4', icon: '🌊' },
        { key: 'soil_moisture', label: 'Soil Moisture', unit: '%', color: '#a16207', icon: '🌱' },
      ]
    : [
        { key: 'temperature', label: 'Temperature', unit: '°C', color: '#f97316', icon: '🌡️' },
        { key: 'humidity', label: 'Humidity', unit: '%', color: '#3b82f6', icon: '💧' },
        { key: 'pressure', label: 'Pressure', unit: 'hPa', color: '#8b5cf6', icon: '🌀' },
        { key: 'light_intensity', label: 'Light Intensity', unit: 'lx', color: '#eab308', icon: '☀️' },
        { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', color: '#ef4444', icon: '🫁' },
        { key: 'air_quality', label: 'Air Quality', unit: 'AQI', color: '#22d3ee', icon: '💨' },
      ];

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-ghost btn-sm" onClick={() => navigate('/nodes')}><ArrowLeft size={16} /></button>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`status-dot ${node.status === 'online' ? 'online' : 'offline'}`} />
              {node.node_name || nodeId}
            </h2>
            <div className="page-header-subtitle">
              {isRural ? '🌾 Rural Node' : '🏙️ Urban Node'} • {nodeId}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'right', fontSize: '0.75rem' }}>
            <div style={{ color: 'var(--text-muted)' }}>Battery</div>
            <div style={{ fontWeight: 700, color: node.battery > 50 ? 'var(--status-online)' : 'var(--status-warning)' }}>
              {node.battery ? `${Math.round(node.battery)}%` : '--'}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem' }}>
            <div style={{ color: 'var(--text-muted)' }}>RSSI</div>
            <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
              {node.rssi ? `${Math.round(node.rssi)} dBm` : '--'}
            </div>
          </div>
          <div className="data-flow-indicator">
            <span className="data-flow-dot" />
            Live
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Sensor Values */}
        <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${sensors.length}, 1fr)`, marginBottom: 24 }}>
          {sensors.map((s, i) => (
            <div key={s.key} className="stat-card animate-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div style={{ fontSize: '1.2rem', marginBottom: 8 }}>{s.icon}</div>
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value" style={{ color: s.color }}>
                {node[s.key] !== undefined
                  ? (typeof node[s.key] === 'number' ? node[s.key].toFixed(1) : node[s.key])
                  : '--'}
                <span className="card-unit">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Live Charts */}
        <div className="charts-grid">
          {sensors.filter(s => node[s.key] !== undefined).map(s => (
            <div key={s.key} className="chart-card">
              <div className="card-header">
                <span className="card-title">{s.icon} {s.label}</span>
                <span style={{ fontSize: '0.7rem', color: s.color, fontWeight: 700 }}>
                  {node[s.key] !== undefined ? (typeof node[s.key] === 'number' ? node[s.key].toFixed(1) : node[s.key]) : '--'} {s.unit}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="time" tick={{ fill: chartTheme.text, fontSize: 9 }} />
                  <YAxis tick={{ fill: chartTheme.text, fontSize: 9 }} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    fill={`url(#grad-${s.key})`}
                    strokeWidth={2}
                    name={`${s.label} (${s.unit})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>

        {/* AI Filter Status */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title">🧠 AI Data Filtering Status</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Filter Status</div>
              <div style={{ color: node.filtered ? 'var(--status-online)' : 'var(--status-warning)', fontWeight: 700, fontSize: '0.9rem' }}>
                {node.filtered ? '✓ Active — 1D CNN Filtering' : '⚠ Raw Data (Unfiltered)'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Anomaly Detection</div>
              <div style={{ color: node.anomaly ? 'var(--severity-critical)' : 'var(--status-online)', fontWeight: 700, fontSize: '0.9rem' }}>
                {node.anomaly ? '⚠ Anomaly Detected' : '✓ Normal'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default NodeDetail;
