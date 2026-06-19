// ============================================
// App.jsx — Root Router & Auth Guard
// ============================================
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Nodes from './pages/Nodes';
import NodeDetail from './pages/NodeDetail';
import History from './pages/History';
import wsService from './services/websocket';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('greenlink_theme') || 'dark');
  const [dataSource, setDataSource] = useState(localStorage.getItem('greenlink_datasource') || 'urban');
  const location = useLocation();

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('greenlink_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('greenlink_datasource', dataSource);
  }, [dataSource]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const token = localStorage.getItem('greenlink_token');
    const savedUser = localStorage.getItem('greenlink_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        wsService.connect();
      } catch { /* invalid stored data */ }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('greenlink_token', token);
    localStorage.setItem('greenlink_user', JSON.stringify(userData));
    setUser(userData);
    wsService.connect();
  };

  const handleLogout = () => {
    localStorage.removeItem('greenlink_token');
    localStorage.removeItem('greenlink_user');
    setUser(null);
    wsService.disconnect();
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <img src="/logo.png" alt="GreenLink+" style={{ width: 64, height: 64, opacity: 0.7 }} />
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-layout">
      <Sidebar 
        user={user} 
        onLogout={handleLogout} 
        currentPath={location.pathname} 
        theme={theme} 
        toggleTheme={toggleTheme}
        dataSource={dataSource}
        setDataSource={setDataSource}
      />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard theme={theme} toggleTheme={toggleTheme} dataSource={dataSource} setDataSource={setDataSource} />} />
          <Route path="/dashboard" element={<Dashboard theme={theme} toggleTheme={toggleTheme} dataSource={dataSource} setDataSource={setDataSource} />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/nodes" element={<Nodes />} />
          <Route path="/nodes/:nodeId" element={<NodeDetail />} />
          <Route path="/history" element={<History />} />
          <Route path="/login" element={<Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
