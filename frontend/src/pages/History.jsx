// ============================================
// History Page — Historical Data Explorer
// ============================================
import { useState, useEffect } from 'react';
import {
  Clock, Download, Filter, Search
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getLiveData } from '../services/api';

function History() {
  const [timeRange, setTimeRange] = useState('1h');
  const [selectedNode, setSelectedNode] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('temperature');
  const [nodes, setNodes] = useState([]);
  const [chartData, setChartData] = useState([]);

  const timeRanges = [
    { value: '1h', label: '1 Hour' },
    { value: '6h', label: '6 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
  ];

  const metrics = [
    { value: 'temperature', label: 'Temperature', color: '#f97316', unit: '°C' },
    { value: 'humidity', label: 'Humidity', color: '#3b82f6', unit: '%' },
    { value: 'pressure', label: 'Pressure', color: '#8b5cf6', unit: 'hPa' },
    { value: 'water_level', label: 'Water Level', color: '#06b6d4', unit: 'cm' },
    { value: 'soil_moisture', label: 'Soil Moisture', color: '#a16207', unit: '%' },
    { value: 'light_intensity', label: 'Light Intensity', color: '#eab308', unit: 'lx' },
    { value: 'pm25', label: 'PM2.5', color: '#ef4444', unit: 'µg/m³' },
    { value: 'air_quality', label: 'Air Quality', color: '#22d3ee', unit: 'AQI' },
  ];

  useEffect(() => {
    fetchNodes();
  }, []);

  // Generate simulated historical data for demo
  useEffect(() => {
    generateHistoricalData();
  }, [timeRange, selectedNode, selectedMetric]);

  const fetchNodes = async () => {
    try {
      const res = await getLiveData().catch(() => ({ data: { nodes: [] } }));
      setNodes(res.data?.nodes || []);
    } catch { /* handled */ }
  };

  const generateHistoricalData = () => {
    const now = Date.now();
    const rangeMs = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000
    };
    const ms = rangeMs[timeRange] || 3600000;
    const points = 50;
    const interval = ms / points;

    const metricConfig = metrics.find(m => m.value === selectedMetric);
    const baseValues = {
      temperature: { base: 25, variance: 8 },
      humidity: { base: 55, variance: 20 },
      pressure: { base: 1013, variance: 10 },
      water_level: { base: 45, variance: 25 },
      soil_moisture: { base: 40, variance: 15 },
      light_intensity: { base: 500, variance: 300 },
      pm25: { base: 35, variance: 40 },
      air_quality: { base: 80, variance: 60 },
    };

    const config = baseValues[selectedMetric] || { base: 50, variance: 20 };
    const data = [];

    for (let i = 0; i < points; i++) {
      const time = now - ms + (interval * i);
      const d = new Date(time);
      const timeLabel = timeRange === '1h' || timeRange === '6h'
        ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : timeRange === '24h'
          ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const point = { time: timeLabel };

      // Generate data per node or all
      const nodeIds = selectedNode === 'all'
        ? ['RURAL-001', 'URBAN-001', 'URBAN-002']
        : [selectedNode];

      nodeIds.forEach((nid, j) => {
        const noise = Math.sin(i / 5 + j * 2) * config.variance * 0.3 +
                      Math.random() * config.variance * 0.4;
        point[nid] = Math.round((config.base + noise) * 100) / 100;
      });

      data.push(point);
    }

    setChartData(data);
  };

  const currentMetric = metrics.find(m => m.value === selectedMetric);
  const nodeIds = selectedNode === 'all'
    ? ['RURAL-001', 'URBAN-001', 'URBAN-002']
    : [selectedNode];
  const lineColors = ['#4ade80', '#3b82f6', '#f97316', '#8b5cf6', '#06b6d4'];

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
            {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value} {currentMetric?.unit}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Historical Data</h2>
          <div className="page-header-subtitle">Explore environmental sensor data over time</div>
        </div>
        <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
            {/* Time Range */}
            <div>
              <div className="form-label">Time Range</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {timeRanges.map(tr => (
                  <button
                    key={tr.value}
                    className="btn-ghost btn-sm"
                    onClick={() => setTimeRange(tr.value)}
                    style={{
                      background: timeRange === tr.value ? 'rgba(34, 197, 94, 0.12)' : undefined,
                      color: timeRange === tr.value ? 'var(--text-accent)' : undefined,
                      borderColor: timeRange === tr.value ? 'var(--border-accent)' : undefined,
                    }}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric Selector */}
            <div>
              <div className="form-label">Metric</div>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="form-input"
                style={{ width: 180, padding: '8px 12px', fontSize: '0.8rem' }}
              >
                {metrics.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Node Selector */}
            <div>
              <div className="form-label">Node</div>
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="form-input"
                style={{ width: 200, padding: '8px 12px', fontSize: '0.8rem' }}
              >
                <option value="all">All Nodes</option>
                {nodes.map(n => (
                  <option key={n.node_id} value={n.node_id}>{n.node_name || n.node_id}</option>
                ))}
                {nodes.length === 0 && (
                  <>
                    <option value="RURAL-001">RURAL-001</option>
                    <option value="URBAN-001">URBAN-001</option>
                    <option value="URBAN-002">URBAN-002</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Main Chart */}
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">
              {currentMetric?.label || 'Metric'} — {timeRanges.find(t => t.value === timeRange)?.label}
            </span>
            <span style={{ fontSize: '0.75rem', color: currentMetric?.color, fontWeight: 600 }}>
              {currentMetric?.unit}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 94, 0.06)" />
              <XAxis dataKey="time" tick={{ fill: '#5f7d6e', fontSize: 10 }} />
              <YAxis tick={{ fill: '#5f7d6e', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '0.75rem', color: '#a7c4b5' }}
                iconType="line"
              />
              {nodeIds.map((nid, i) => (
                <Line
                  key={nid}
                  type="monotone"
                  dataKey={nid}
                  stroke={lineColors[i % lineColors.length]}
                  strokeWidth={2}
                  name={nid}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Data Summary */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {nodeIds.map((nid, i) => {
            const vals = chartData.map(d => d[nid]).filter(v => v !== undefined);
            const min = vals.length ? Math.min(...vals).toFixed(1) : '--';
            const max = vals.length ? Math.max(...vals).toFixed(1) : '--';
            const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '--';
            return (
              <div key={nid} className="stat-card animate-in" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="stat-card-label" style={{ color: lineColors[i % lineColors.length] }}>{nid}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Min</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{min}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-accent)' }}>{avg}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Max</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{max}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default History;
