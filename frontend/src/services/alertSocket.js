// Real-Time Alert & AWS Telemetry WebSocket Client with automatic reconnection and Native Browser Notifications
import { API_BASE_URL } from './api';

/**
 * Derives the WebSocket URL directly from the backend API URL:
 * - https://weathergpt-backend-tm6r.onrender.com -> wss://weathergpt-backend-tm6r.onrender.com/ws/alerts
 * - http://localhost:8000 -> ws://localhost:8000/ws/alerts
 *
 * NOTE: Never uses window.location.hostname/host to prevent connecting to the Vercel frontend domain!
 */
export function getWebSocketUrl(apiUrl = API_BASE_URL) {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const base = (apiUrl || 'http://localhost:8000').replace(/\/+$/, '');

  if (base.startsWith('https://')) {
    return base.replace(/^https:\/\//i, 'wss://') + '/ws/alerts';
  } else if (base.startsWith('http://')) {
    return base.replace(/^http:\/\//i, 'ws://') + '/ws/alerts';
  } else if (base.startsWith('wss://') || base.startsWith('ws://')) {
    return base.endsWith('/ws/alerts') ? base : `${base}/ws/alerts`;
  }

  return `ws://${base}/ws/alerts`;
}

const WS_BASE_URL = getWebSocketUrl();


class AlertSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.awsListeners = new Set();
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(WS_BASE_URL);

      this.ws.onopen = () => {
        console.log('[AlertSocket] Connected to live IMD alerts & WIS 2.0 telemetry stream.');
        this.isConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'NEW_ALERT' && data.alert) {
            console.log('[AlertSocket] Received live alert broadcast:', data.alert);

            // Notify alert subscribers
            this.listeners.forEach((callback) => {
              try {
                callback(data.alert);
              } catch (e) {
                console.error('[AlertSocket] Listener error:', e);
              }
            });

            // Trigger native browser notification if permitted
            this.showNativeNotification(data.alert);
          } else if (data.type === 'aws_station_update' && data.data) {
            console.log('[AlertSocket] Received live AWS telemetry:', data.data.station_name, `${data.data.temperature_c}°C`);
            
            // Notify AWS telemetry subscribers
            this.awsListeners.forEach((callback) => {
              try {
                callback(data.data);
              } catch (e) {
                console.error('[AlertSocket] AWS listener error:', e);
              }
            });
          }
        } catch (err) {
          console.warn('[AlertSocket] Error parsing message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[AlertSocket] Disconnected from stream. Reconnecting in 4s...');
        this.isConnected = false;
        this.reconnectTimer = setTimeout(() => this.connect(), 4000);
      };

      this.ws.onerror = (err) => {
        console.warn('[AlertSocket] WebSocket error:', err);
        if (this.ws) this.ws.close();
      };
    } catch (e) {
      console.warn('[AlertSocket] Connection failed:', e);
      this.reconnectTimer = setTimeout(() => this.connect(), 4000);
    }
  }

  // Subscribe to incoming alerts
  subscribe(callback) {
    this.listeners.add(callback);
    this.connect();
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Subscribe to live AWS Automatic Weather Station telemetry
  subscribeAWS(callback) {
    this.awsListeners.add(callback);
    this.connect();
    return () => {
      this.awsListeners.delete(callback);
    };
  }

  // Request browser notification permission
  async requestNotificationPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return Notification.permission === 'granted';
    }
    return false;
  }

  // Display browser notification
  showNativeNotification(alert) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const title = alert.title || `Weather Alert for ${alert.region}`;
      const options = {
        body: alert.description || 'Check WeatherGPT for safety instructions.',
        icon: '/favicon.ico',
        tag: `weather_alert_${alert._id || Date.now()}`,
        requireInteraction: alert.severity === 'red',
      };
      try {
        new Notification(title, options);
      } catch (e) {
        console.warn('Native notification failed:', e);
      }
    }
  }
}

export const alertSocket = new AlertSocketService();
export default alertSocket;
