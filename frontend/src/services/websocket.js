// ============================================
// WebSocket Service — Real-time data stream
// ============================================

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnect = 10;
  }

  connect() {
    const isSecure = window.location.protocol === 'https:';
    const defaultWsUrl = `${isSecure ? 'wss' : 'ws'}://${window.location.host}/ws/live`;
    const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Connected to live data stream');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notify(data.type, data);
        } catch (err) {
          console.warn('[WS] Parse error:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Error:', err);
      };
    } catch (err) {
      console.warn('[WS] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnect) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => this.listeners.get(eventType)?.delete(callback);
  }

  notify(eventType, data) {
    this.listeners.get(eventType)?.forEach(cb => cb(data));
    // Also notify "all" listeners
    this.listeners.get('*')?.forEach(cb => cb(data));
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) this.ws.close();
  }
}

const wsService = new WebSocketService();
export default wsService;
