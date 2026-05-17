// ============================================
// Nodes Page — Sensor Node Overview
// ============================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu, Wifi, WifiOff, Battery,
  Signal, RefreshCw, MapPin
} from 'lucide-react';
import { getNodes } from '../services/api';
import wsService from '../services/websocket';

function Nodes() {
  const [nodes, setNodes] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = wsService.subscribe('node_status', (msg) => {
      setNodes(prev => prev.map(n =>
        n.node_id === msg.node_id ? { ...n, ...msg.data, last_seen: msg.timestamp } : n
      ));
    });
    return unsub;
  }, []);

  const fetchNodes = async () => {
    try {
      const res = await getNodes().catch(() => ({ data: { nodes: [], total: 0, online: 0, offline: 0 } }));
      setNodes(res.data?.nodes || []);
      setStats({ total: res.data?.total || 0, online: res.data?.online || 0, offline: res.data?.offline || 0 });
    } catch { /* handled */ }
    setLoading(false);
  };

  const getBatteryColor = (level) => {
    if (!level) return 'var(--text-muted)';
    if (level > 60) return 'var(--status-online)';
    if (level > 30) return 'var(--status-warning)';
    return 'var(--status-offline)';
  };

  const getTimeSince = (ts) => {
    if (!ts) return 'Never';
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Sensor Nodes</h2>
          <div className="page-header-subtitle">ESP32 field-deployed IoT nodes connected via LoRa SX1278</div>
        </div>
        <button className="btn-ghost" onClick={fetchNodes} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Node Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(139, 92, 246, 0.12)' }}>
              <Cpu size={20} color="#8b5cf6" />
            </div>
            <div className="stat-card-label">Total Nodes</div>
            <div className="stat-card-value">{stats.total}</div>
          </div>
          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(34, 197, 94, 0.12)' }}>
              <Wifi size={20} color="#4ade80" />
            </div>
            <div className="stat-card-label">Online</div>
            <div className="stat-card-value" style={{ color: 'var(--status-online)' }}>{stats.online}</div>
          </div>
          <div className="stat-card animate-in">
            <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
              <WifiOff size={20} color="#ef4444" />
            </div>
            <div className="stat-card-label">Offline</div>
            <div className="stat-card-value" style={{ color: 'var(--status-offline)' }}>{stats.offline}</div>
          </div>
        </div>

        {/* Node Cards */}
        <div className="nodes-grid">
          {nodes.map((node, i) => {
            const isRural = node.node_type === 'rural';
            const isOnline = node.is_online;
            return (
              <div
                key={node.node_id}
                className="node-card animate-in"
                style={{ animationDelay: `${i * 80}ms` }}
                onClick={() => navigate(`/nodes/${node.node_id}`)}
              >
                <div className="node-card-header">
                  <div>
                    <div className="node-card-name">
                      <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                      {node.node_name || node.node_id}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      ID: {node.node_id}
                    </div>
                  </div>
                  <span className={`node-card-type ${isRural ? 'rural' : ''}`}>
                    {isRural ? '🌾 Rural' : '🏙️ Urban'}
                  </span>
                </div>

                {/* Node Metrics */}
                <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isOnline ? 'var(--status-online)' : 'var(--status-offline)' }}>
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Battery</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: getBatteryColor(node.battery), display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Battery size={14} />
                      {node.battery ? `${Math.round(node.battery)}%` : '--'}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signal</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Signal size={14} />
                      {node.rssi ? `${Math.round(node.rssi)} dBm` : '--'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 10, textAlign: 'right' }}>
                  Last seen: {getTimeSince(node.last_seen)}
                </div>
              </div>
            );
          })}
          {nodes.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <Cpu size={48} />
              <p style={{ marginTop: 12 }}>No sensor nodes detected</p>
              <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Start the backend server to see simulated nodes</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Nodes;
