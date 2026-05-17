// ============================================
// Alerts Page — Alert History & Management
// ============================================
import { useState, useEffect } from 'react';
import {
  Bell, AlertTriangle, CheckCircle,
  Filter, RefreshCw, Shield
} from 'lucide-react';
import { getAlerts, acknowledgeAlert, getAlertStats } from '../services/api';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      const params = { limit: 100 };
      if (filter !== 'all') params.severity = filter;
      const [alertRes, statsRes] = await Promise.all([
        getAlerts(params).catch(() => ({ data: { alerts: [] } })),
        getAlertStats().catch(() => ({ data: {} }))
      ]);
      setAlerts(alertRes.data?.alerts || []);
      setStats(statsRes.data || {});
    } catch { /* handled */ }
    setLoading(false);
  };

  const handleAcknowledge = async (id) => {
    try {
      await acknowledgeAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() } : a));
    } catch { /* handled */ }
  };

  const formatTime = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Alerts</h2>
          <div className="page-header-subtitle">Threshold breaches & anomaly detections</div>
        </div>
        <button className="btn-ghost" onClick={fetchAlerts} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Alert Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card animate-in">
            <div className="stat-card-label">Total Alerts</div>
            <div className="stat-card-value">{stats.total || 0}</div>
          </div>
          <div className="stat-card animate-in">
            <div className="stat-card-label">Unacknowledged</div>
            <div className="stat-card-value" style={{ color: 'var(--severity-high)' }}>{stats.unacknowledged || 0}</div>
          </div>
          <div className="stat-card animate-in">
            <div className="stat-card-label">Critical</div>
            <div className="stat-card-value" style={{ color: 'var(--severity-critical)' }}>{stats.critical || 0}</div>
          </div>
          <div className="stat-card animate-in">
            <div className="stat-card-label">High</div>
            <div className="stat-card-value" style={{ color: 'var(--severity-high)' }}>{stats.high || 0}</div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['all', 'critical', 'high', 'medium'].map(f => (
            <button
              key={f}
              className={`btn-ghost btn-sm ${filter === f ? '' : ''}`}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'rgba(34, 197, 94, 0.12)' : undefined,
                color: filter === f ? 'var(--text-accent)' : undefined,
                borderColor: filter === f ? 'var(--border-accent)' : undefined,
                textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Alerts Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Node</th>
                <th>Metric</th>
                <th>Message</th>
                <th>Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <tr key={alert.id || i} style={{ opacity: alert.acknowledged ? 0.5 : 1 }}>
                  <td>
                    <span className={`severity-badge ${alert.severity}`}>
                      {alert.severity === 'critical' && <AlertTriangle size={11} />}
                      {alert.severity}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{alert.node_id}</td>
                  <td style={{ color: 'var(--text-accent)', fontSize: '0.8rem' }}>{alert.metric}</td>
                  <td style={{ fontSize: '0.8rem', maxWidth: 300 }}>{alert.message}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatTime(alert.timestamp)}
                  </td>
                  <td>
                    {alert.acknowledged ? (
                      <span style={{ color: 'var(--status-online)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={13} /> Ack
                      </span>
                    ) : (
                      <span style={{ color: 'var(--severity-high)', fontSize: '0.75rem' }}>Pending</span>
                    )}
                  </td>
                  <td>
                    {!alert.acknowledged && (
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => handleAcknowledge(alert.id)}
                        style={{ fontSize: '0.7rem' }}
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <Shield size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div>No alerts found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default Alerts;
