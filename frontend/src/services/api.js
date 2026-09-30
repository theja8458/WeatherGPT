// Determine backend API URL:
// 1. Explicit environment variable (VITE_API_URL) if set
// 2. In production (e.g. Vercel deployment), fallback to Render backend: https://weathergpt-backend-tm6r.onrender.com
// 3. In local development, fallback to: http://localhost:8000
const isProduction =
  import.meta.env.PROD ||
  (typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1');

const DEFAULT_API_URL = isProduction
  ? 'https://weathergpt-backend-tm6r.onrender.com'
  : 'http://localhost:8000';

const rawApiUrl = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, error);
      throw error;
    }
  }

  // Health check
  async getHealth() {
    return this.request('/health');
  }

  // Chat message
  async sendChat({ sessionId, message, language, lat, lon }) {
    return this.request('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        message,
        language: language || null,
        lat: lat || null,
        lon: lon || null,
      }),
    });
  }

  // Feedback (thumbs up = 5, thumbs down = 1)
  async sendFeedback({ messageId, rating, comment, sessionId }) {
    return this.request('/api/v1/feedback', {
      method: 'POST',
      body: JSON.stringify({
        message_id: messageId,
        rating,
        comment: comment || null,
        session_id: sessionId || null,
      }),
    });
  }

  // Location search autocomplete
  async searchLocations(query) {
    return this.request(`/api/v1/locations/search?q=${encodeURIComponent(query)}&limit=8`);
  }

  // Reverse Geocode
  async reverseGeocode(lat, lon) {
    return this.request(`/api/v1/locations/reverse?lat=${lat}&lon=${lon}`);
  }

  // Weather current
  async getCurrentWeather({ lat, lon, place }) {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', lat);
      params.append('lon', lon);
    }
    if (place) params.append('place', place);
    return this.request(`/api/v1/weather/current?${params.toString()}`);
  }

  // Hourly Forecast
  async getHourlyForecast({ lat, lon, place, hours = 24 }) {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', lat);
      params.append('lon', lon);
    }
    if (place) params.append('place', place);
    params.append('hours', hours);
    return this.request(`/api/v1/weather/forecast/hourly?${params.toString()}`);
  }

  // Daily Forecast
  async getDailyForecast({ lat, lon, place, days = 7 }) {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', lat);
      params.append('lon', lon);
    }
    if (place) params.append('place', place);
    params.append('days', days);
    return this.request(`/api/v1/weather/forecast/daily?${params.toString()}`);
  }

  // Air Quality
  async getAirQuality({ lat, lon, place }) {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', lat);
      params.append('lon', lon);
    }
    if (place) params.append('place', place);
    return this.request(`/api/v1/weather/air-quality?${params.toString()}`);
  }

  // Alerts
  async getAlerts({ lat, lon, radius = 150, severity } = {}) {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', lat);
      params.append('lon', lon);
    }
    if (radius) params.append('radius', radius);
    if (severity) params.append('severity', severity);
    return this.request(`/api/v1/alerts?${params.toString()}`);
  }

  // Simulate Alert (Triggers live WebSocket push for demonstration)
  async simulateAlert(payload) {
    return this.request('/api/v1/alerts/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Trigger artificially lowered threshold alert
  async triggerLoweredThreshold(payload) {
    return this.request('/api/v1/alerts/evaluate-lowered-threshold', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Create alert subscription
  async createSubscription(payload) {
    return this.request('/api/v1/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Delete alert subscription
  async deleteSubscription(subscriptionId) {
    return this.request(`/api/v1/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  // Multi-Sector Location-Based Advisory
  async getAdvisory({ lat, lon, type, crop, role, lang, place } = {}) {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', lat);
      params.append('lon', lon);
    }
    if (type) params.append('type', type);
    if (crop) params.append('crop', crop);
    if (role) params.append('role', role);
    if (lang) params.append('lang', lang);
    if (place) params.append('place', place);
    return this.request(`/api/v1/advisory?${params.toString()}`);
  }

  // Supported crops
  async getSupportedCrops() {
    return this.request('/api/v1/advisory/crops');
  }

  // Climate trends and historical analysis
  async getClimateTrends({ lat, lon, from, to, metric = 'all', place, compareLat, compareLon, compareName } = {}) {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', lat);
      params.append('lon', lon);
    }
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (metric) params.append('metric', metric);
    if (place) params.append('place', place);
    if (compareLat !== undefined && compareLon !== undefined) {
      params.append('compare_lat', compareLat);
      params.append('compare_lon', compareLon);
    }
    if (compareName) params.append('compare_name', compareName);
    return this.request(`/api/v1/climate/trends?${params.toString()}`);
  }

  // Live India GIS weather grid
  async getWeatherGrid() {
    return this.request('/api/v1/weather/grid');
  }

  // NWP Model Comparison (GFS vs ECMWF vs Consensus)
  async getNWPComparison({ lat, lon, place, days = 7 } = {}) {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', lat);
      params.append('lon', lon);
    }
    if (place) params.append('place', place);
    if (days) params.append('days', days);
    return this.request(`/api/v1/nwp/compare?${params.toString()}`);
  }

  // AWS Real-time Station Telemetry (WIS 2.0 / MQTT)
  async getLatestAWSStations() {
    return this.request('/api/v1/nwp/aws/latest');
  }

  // Simulate AWS Station Reading (WIS 2.0 / MQTT Mock trigger)
  async publishMockAWSTelemetry(payload = {}) {
    return this.request('/api/v1/nwp/aws/publish-mock', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // User Profile & Role Preferences
  async getUserProfile(sessionId) {
    return this.request(`/api/v1/users/profile?session_id=${encodeURIComponent(sessionId)}`);
  }

  async updateUserProfile(payload) {
    return this.request('/api/v1/users/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateUserRole(sessionId, role) {
    return this.request('/api/v1/users/role', {
      method: 'PUT',
      body: JSON.stringify({ session_id: sessionId, role }),
    });
  }

  // Disaster Manager Risk Summary & Broadcast Advisory
  async getStateRiskSummary(state = 'Telangana') {
    return this.request(`/api/v1/users/state-risk-summary?state=${encodeURIComponent(state)}`);
  }

  async generateBroadcastAdvisory(payload) {
    return this.request('/api/v1/users/broadcast-advisory', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiService(API_BASE_URL);
export default api;
