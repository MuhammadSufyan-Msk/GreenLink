import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, SafeAreaView, StatusBar, Platform
} from 'react-native';
import axios from 'axios';

// Configuration: Edit this to match your backend IP (e.g. 'http://192.168.1.100:5000')
// '10.0.2.2' is the loopback interface pointing to host localhost on Android Emulators
const BACKEND_HOST = '10.0.2.2:5000'; 
const API_URL = `http://${BACKEND_HOST}/api`;
const WS_URL = `ws://${BACKEND_HOST}/ws/live`;

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [dataSource, setDataSource] = useState('urban');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  const ws = useRef(null);
  const pollInterval = useRef(null);

  const DATA_SOURCES = [
    { id: 'urban', label: 'Urban Node', icon: '🏙️', desc: 'City air & environment sensors' },
    { id: 'rural', label: 'Rural Node', icon: '🌾', desc: 'Field water, soil & crop sensors' },
    { id: 'api', label: 'API Data', icon: '📡', desc: 'All nodes cloud endpoint' },
  ];

  const activeDS = DATA_SOURCES.find(d => d.id === dataSource) || DATA_SOURCES[0];

  // Fetch Live Data
  const fetchData = useCallback(async (currentToken) => {
    const authHeader = currentToken || token;
    if (!authHeader) return;

    try {
      const res = await axios.get(`${API_URL}/data/live`, {
        headers: { Authorization: `Bearer ${authHeader}` },
        params: dataSource ? { source: dataSource } : {}
      });
      if (res.data && res.data.nodes) {
        setNodes(res.data.nodes);
      }
    } catch (err) {
      console.warn('[API Error] Fetch live data failed:', err.message);
    }
  }, [dataSource, token]);

  // Connect WebSockets
  const connectWebSocket = useCallback((currentToken) => {
    const authHeader = currentToken || token;
    if (!authHeader) return;

    if (ws.current) {
      ws.current.close();
    }

    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setConnected(true);
        console.log('[WS] Connected to live data stream');
      };

      ws.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'sensor_data') {
            // Apply source filtering on WS messages
            if (dataSource) {
              const isMatch = msg.node_type && msg.node_type.toLowerCase().includes(dataSource.toLowerCase());
              if (!isMatch) return;
            }

            setNodes((prev) => {
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
                  gas_resistance: msg.data.gas_resistance,
                  eu_aqi: msg.data.eu_aqi,
                  nitrogen_dioxide: msg.data.nitrogen_dioxide,
                  ozone: msg.data.ozone,
                  carbon_monoxide: msg.data.carbon_monoxide
                }
              };
              if (existing >= 0) {
                const updatedNodes = [...prev];
                updatedNodes[existing] = { ...updatedNodes[existing], ...updated };
                return updatedNodes;
              }
              return [...prev, updated];
            });
          }
        } catch (e) {
          console.warn('[WS] Msg parse error:', e.message);
        }
      };

      ws.current.onerror = (e) => {
        console.warn('[WS] Error:', e.message);
      };

      ws.current.onclose = () => {
        setConnected(false);
        console.log('[WS] Disconnected, reconnecting in 5s...');
        setTimeout(() => connectWebSocket(authHeader), 5000);
      };
    } catch (err) {
      console.warn('[WS Connection Error]', err.message);
    }
  }, [dataSource, token]);

  // Auth: Login
  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password });
      if (res.data && res.data.token) {
        setToken(res.data.token);
        setUser(res.data.user || { username });
        fetchData(res.data.token);
        connectWebSocket(res.data.token);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Check connection to backend server';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // Auth: Logout
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setNodes([]);
    if (ws.current) {
      ws.current.close();
    }
  };

  // Poll intervals & Websocket connections based on active selections
  useEffect(() => {
    if (token) {
      setNodes([]); // Reset UI list on source swap
      fetchData();
      connectWebSocket();

      if (pollInterval.current) clearInterval(pollInterval.current);
      pollInterval.current = setInterval(fetchData, 5000);
    }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [dataSource, token]);

  // UI: Login Screen
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginCard}>
          <Text style={styles.logoText}>GreenLink+</Text>
          <Text style={styles.subtext}>Environmental IoT & AI Portal</Text>

          <TextInput
            placeholder="Username"
            placeholderTextColor="#6c7a89"
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="#6c7a89"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // UI: Dashboard Screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>GreenLink+</Text>
          <Text style={styles.headerSubtitle}>
            {connected ? '🟢 Connected Live' : '🔴 Server Disconnected'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Main Body */}
      <View style={styles.body}>
        
        {/* Data Source Selector */}
        <View style={styles.dropdownContainer}>
          <TouchableOpacity 
            style={styles.dropdownTrigger} 
            onPress={() => setDropdownOpen(o => !o)}
          >
            <Text style={styles.dropdownTriggerText}>
              {activeDS.icon} {activeDS.label}
            </Text>
            <Text style={styles.dropdownChevron}>{dropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownMenu}>
              {DATA_SOURCES.map(src => (
                <TouchableOpacity
                  key={src.id}
                  style={[styles.dropdownItem, dataSource === src.id && styles.dropdownItemActive]}
                  onPress={() => {
                    setDataSource(src.id);
                    setDropdownOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>
                    {src.icon} {src.label}
                  </Text>
                  {dataSource === src.id && <Text style={styles.dropdownItemCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Scrollable Node Telemetry view */}
        <ScrollView style={styles.nodesScroll}>
          {nodes.map((node) => {
            const s = node.sensors || node;
            const isRural = (node.node_type || '').includes('rural');
            return (
              <View key={node.node_id} style={styles.nodeCard}>
                <View style={styles.nodeHeader}>
                  <View>
                    <Text style={styles.nodeName}>
                      {node.status === 'online' ? '🟢' : '🔴'} {node.node_name || node.node_id}
                    </Text>
                    {node.source === 'aws-iot' && (
                      <View style={styles.awsBadge}>
                        <Text style={styles.awsBadgeText}>📡 AWS IoT LIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.nodeTag}>{isRural ? '🌾 Rural' : '🏙️ Urban'}</Text>
                </View>

                <View style={styles.sensorsGrid}>
                  {s.temperature !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🌡️ Temp</Text>
                      <Text style={[styles.sensorVal, { color: '#f97316' }]}>{s.temperature.toFixed(1)}°C</Text>
                    </View>
                  )}
                  {s.humidity !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>💧 Humid</Text>
                      <Text style={[styles.sensorVal, { color: '#3b82f6' }]}>{s.humidity.toFixed(1)}%</Text>
                    </View>
                  )}
                  {s.pressure !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🌀 Pressure</Text>
                      <Text style={[styles.sensorVal, { color: '#8b5cf6' }]}>{s.pressure.toFixed(1)} hPa</Text>
                    </View>
                  )}
                  {s.air_quality !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>💨 Air Q</Text>
                      <Text style={[styles.sensorVal, { color: '#22d3ee' }]}>{s.air_quality.toFixed(0)} AQI</Text>
                    </View>
                  )}
                  {s.pm25 !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🫁 PM2.5</Text>
                      <Text style={[styles.sensorVal, { color: '#ef4444' }]}>{s.pm25.toFixed(1)} µg</Text>
                    </View>
                  )}
                  {s.pm10 !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🌫️ PM10</Text>
                      <Text style={[styles.sensorVal, { color: '#f59e0b' }]}>{s.pm10.toFixed(1)} µg</Text>
                    </View>
                  )}
                  {s.light_intensity !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>☀️ Light</Text>
                      <Text style={[styles.sensorVal, { color: '#eab308' }]}>{s.light_intensity.toFixed(0)} lx</Text>
                    </View>
                  )}
                  {s.gas_resistance !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>⛽ Gas</Text>
                      <Text style={[styles.sensorVal, { color: '#a855f7' }]}>{s.gas_resistance} Ω</Text>
                    </View>
                  )}
                  {s.water_level !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🌊 Water</Text>
                      <Text style={[styles.sensorVal, { color: '#06b6d4' }]}>{s.water_level.toFixed(1)} cm</Text>
                    </View>
                  )}
                  {s.soil_moisture !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🌱 Soil</Text>
                      <Text style={[styles.sensorVal, { color: '#a16207' }]}>{s.soil_moisture.toFixed(1)}%</Text>
                    </View>
                  )}
                  {s.eu_aqi !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🇪🇺 EU AQI</Text>
                      <Text style={[styles.sensorVal, { color: '#a78bfa' }]}>{s.eu_aqi}</Text>
                    </View>
                  )}
                  {s.nitrogen_dioxide !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🔵 NO₂</Text>
                      <Text style={[styles.sensorVal, { color: '#60a5fa' }]}>{typeof s.nitrogen_dioxide === 'number' ? s.nitrogen_dioxide.toFixed(2) : '--'} µg</Text>
                    </View>
                  )}
                  {s.ozone !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>🟣 Ozone</Text>
                      <Text style={[styles.sensorVal, { color: '#c084fc' }]}>{typeof s.ozone === 'number' ? s.ozone.toFixed(2) : '--'} µg</Text>
                    </View>
                  )}
                  {s.carbon_monoxide !== undefined && (
                    <View style={styles.sensorItem}>
                      <Text style={styles.sensorLabel}>💀 CO</Text>
                      <Text style={[styles.sensorVal, { color: '#fb7185' }]}>{s.carbon_monoxide} µg</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {nodes.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>📡 Waiting for {activeDS.label} telemetry...</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
  },
  loginCard: {
    margin: 24,
    padding: 24,
    backgroundColor: '#121824',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#6c7a89',
    marginBottom: 28,
  },
  input: {
    width: '100%',
    height: 48,
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  loginBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#121824',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6c7a89',
  },
  logoutBtn: {
    padding: 8,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  dropdownContainer: {
    zIndex: 10,
    marginBottom: 16,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#121824',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  dropdownTriggerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownChevron: {
    color: '#6c7a89',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#121824',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 14,
  },
  dropdownItemCheck: {
    color: '#22c55e',
  },
  nodesScroll: {
    flex: 1,
  },
  nodeCard: {
    backgroundColor: '#121824',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    marginBottom: 16,
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nodeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nodeTag: {
    color: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    fontSize: 11,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sensorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  sensorItem: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  sensorLabel: {
    color: '#6c7a89',
    fontSize: 11,
    marginBottom: 4,
  },
  sensorVal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#6c7a89',
    fontSize: 14,
  },
  awsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  awsBadgeText: {
    color: '#22d3ee',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
