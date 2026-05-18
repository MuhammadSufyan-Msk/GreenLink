// ============================================
// Sidebar Navigation Component
// ============================================
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Bell,
  Cpu,
  Clock,
  LogOut,
  Wifi,
  Moon,
  Sun
} from 'lucide-react';

function Sidebar({ user, onLogout, currentPath, theme, toggleTheme }) {
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/nodes', icon: Cpu, label: 'Sensor Nodes' },
    { path: '/alerts', icon: Bell, label: 'Alerts', badge: null },
    { path: '/history', icon: Clock, label: 'History' },
  ];

  const isActive = (path) => {
    if (path === '/') return currentPath === '/' || currentPath === '/dashboard';
    return currentPath.startsWith(path);
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/logo.png" alt="GreenLink+ Logo" />
        <div>
          <h1>GreenLink+</h1>
          <span>Linking Nature With Intelligence</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Monitoring</div>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
          >
            <item.icon />
            <span>{item.label}</span>
            {item.badge !== null && item.badge > 0 && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </Link>
        ))}

        <div className="nav-section-label" style={{ marginTop: 16 }}>System</div>
        <div className="nav-link" style={{ cursor: 'default' }}>
          <Wifi />
          <span>MQTT Status</span>
          <span className="data-flow-indicator" style={{ marginLeft: 'auto' }}>
            <span className="data-flow-dot" />
            Live
          </span>
        </div>
      </nav>

      {/* Footer — User Info */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-role">{user?.role || 'operator'}</div>
          </div>
          <button
            onClick={onLogout}
            className="btn-ghost btn-sm"
            title="Logout"
            style={{ marginLeft: 'auto', padding: '6px' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
