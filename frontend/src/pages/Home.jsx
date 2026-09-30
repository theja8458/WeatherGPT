import React, { useState, useEffect } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudDrizzle,
  Snowflake,
  Wind,
  Droplets,
  Gauge,
  Eye,
  Sunrise,
  Sunset,
  Navigation,
  Heart,
  HeartOff,
  Activity,
  Calendar,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  Search,
  MapPin,
  Check,
  ChevronRight,
  AlertTriangle,
  X,
  CloudOff,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWeather, SUPPORTED_ROLES } from '../context/WeatherContext';
import api from '../services/api';
import alertSocket from '../services/alertSocket';
import AWSLiveFeed from '../components/AWSLiveFeed';
import RoleHomePersonalization from '../components/RoleHomePersonalization';

function getWeatherGradient(condition, code) {
  if (code >= 95) {
    // Thunderstorm
    return {
      gradient: 'from-purple-900/40 via-indigo-950/40 to-slate-900 border-purple-500/40',
      glow: 'bg-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
      icon: <CloudLightning className="w-9 h-9 text-amber-300 animate-pulse" />,
    };
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    // Rainy
    return {
      gradient: 'from-sky-900/40 via-blue-950/40 to-slate-900 border-sky-500/40',
      glow: 'bg-sky-500/20',
      badge: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
      icon: <CloudRain className="w-9 h-9 text-sky-300 animate-bounce" />,
    };
  } else if (code === 0 || code === 1) {
    // Clear / Sunny
    return {
      gradient: 'from-amber-600/30 via-orange-950/30 to-slate-900 border-amber-500/40',
      glow: 'bg-amber-400/20',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
      icon: <Sun className="w-9 h-9 text-amber-400 animate-spin-slow" />,
    };
  } else {
    // Cloudy / Fog
    return {
      gradient: 'from-slate-700/40 via-slate-800/40 to-slate-900 border-slate-600/40',
      glow: 'bg-sky-400/10',
      badge: 'bg-slate-700/50 text-slate-300 border-slate-600/40',
      icon: <Cloud className="w-9 h-9 text-sky-200" />,
    };
  }
}

const ROLE_SUGGESTIONS = {
  farmer: [
    { label: '🌾 Rice & Cotton Crop Advisory', query: 'What is the crop advisory for rice and cotton in {loc} right now?' },
    { label: '💧 Safe Pesticide Spraying Window', query: 'Is it safe to spray pesticides or fertilizers tomorrow in {loc}?' },
    { label: '🌧️ 5-Day Rainfall & Irrigation Plan', query: 'What is the 5-day rainfall forecast for farm irrigation in {loc}?' },
    { label: '🌱 Soil Moisture & Sowing Advisory', query: 'What are the current soil moisture and sowing window conditions in {loc}?' },
  ],
  aviation: [
    { label: '✈️ METAR & TAF Flight Briefing', query: 'Provide a complete aviation weather briefing and METAR/TAF summary for {loc}.' },
    { label: '☁️ Cloud Base Ceiling & VFR Category', query: 'What is the cloud base ceiling, flight rule (VFR/IFR), and visibility at {loc}?' },
    { label: '💨 Runway Crosswind & Gusts', query: 'What is the runway wind direction, speed in knots, and gust risk at {loc}?' },
    { label: '⚡ Thunderstorm & Turbulence Risk', query: 'Are there any convective thunderstorm or clear air turbulence risks near {loc}?' },
  ],
  disaster_manager: [
    { label: '🚨 Statewide Active Alerts Breakdown', query: 'Provide a comprehensive breakdown of all active IMD severe alerts across the state for {loc}.' },
    { label: '📢 Draft Emergency Broadcast Warning (SMS)', query: 'Draft a short 160-character emergency SMS public advisory in Telugu, Hindi, and English for {loc}.' },
    { label: '📊 District Inundation & Flood Risk', query: 'Which districts near {loc} have highest rainfall accumulation and flood risk today?' },
    { label: '🌀 Cyclone Threat & Disaster Action', query: 'Analyze cyclone, gale wind, and heavy rainfall threats affecting {loc}.' },
  ],
  researcher: [
    { label: '📈 30-Year Rainfall Trend & Slope', query: 'How has annual rainfall and monsoon intensity changed over the past 30 years in {loc}?' },
    { label: '🌡️ Decadal Warming & Extreme Days', query: 'What is the decadal warming rate and count of extreme heat days (>40C) for {loc}?' },
    { label: '🔬 WMO Climatological Baseline Anomaly', query: 'Compare current temperature and precipitation against the 1991-2020 WMO baseline for {loc}.' },
    { label: '💾 Export Historical Climate CSV', query: 'How can I download the 30-year monthly historical climate dataset for {loc} as CSV?' },
  ],
  marine: [
    { label: '⚓ Coastal Fishermen Advisory', query: 'Is it safe for fishermen to venture into the sea near {loc} today?' },
    { label: '🌊 Wave Height & Swell Forecast', query: 'What are the expected wave heights, swell period, and sea conditions off the coast of {loc}?' },
    { label: '💨 Coastal Squall & Gale Warnings', query: 'Are there any squally wind warnings exceeding 45 km/h along the coastal waters of {loc}?' },
    { label: '🌊 High Tide Surge & Sea Level', query: 'What are the high tide timings and coastal inundation risks near {loc}?' },
  ],
  citizen: [
    { label: '☔ Will it rain today? Umbrella Outlook', query: 'Will it rain this afternoon or evening in {loc}? Do I need an umbrella?' },
    { label: '🌤️ Weekend Outdoor Travel & Sports', query: 'What is the weather outlook for outdoor sports and travel this weekend in {loc}?' },
    { label: '💨 Air Quality & Morning Walk Safety', query: 'Is the air quality safe for morning exercise and children in {loc}?' },
    { label: '🌡️ 7-Day Temperature Outlook', query: 'What is the 7-day temperature outlook and will it get hotter in {loc}?' },
  ],
};

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    currentLocation,
    setCurrentLocation,
    selectedLanguage,
    userRole,
    setUserRole,
  } = useWeather();

  const [currentWeather, setCurrentWeather] = useState(null);
  const [hourlyForecast, setHourlyForecast] = useState([]);
  const [dailyForecast, setDailyForecast] = useState([]);
  const [airQuality, setAirQuality] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);

  // Offline forecast states (Prompt 17D)
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isCachedForecast, setIsCachedForecast] = useState(false);
  const [cachedAtTimestamp, setCachedAtTimestamp] = useState(null);
  const [hasNoOfflineData, setHasNoOfflineData] = useState(false);

  // Favourites state in localStorage
  const [favourites, setFavourites] = useState(() => {
    try {
      const saved = localStorage.getItem('weathergpt_favourites');
      return saved ? JSON.parse(saved) : ['Hyderabad', 'Kurnool', 'Visakhapatnam'];
    } catch {
      return ['Hyderabad', 'Kurnool', 'Visakhapatnam'];
    }
  });

  const isCurrentFavourite = favourites.includes(currentLocation.name);

  const toggleFavourite = () => {
    let updated;
    if (isCurrentFavourite) {
      updated = favourites.filter((f) => f !== currentLocation.name);
    } else {
      updated = [...favourites, currentLocation.name];
    }
    setFavourites(updated);
    localStorage.setItem('weathergpt_favourites', JSON.stringify(updated));
  };

  // Helper to load locally cached forecast when offline
  const loadOfflineForecast = () => {
    try {
      const raw = localStorage.getItem('weathergpt_cached_forecast');
      if (raw) {
        const snap = JSON.parse(raw);
        if (snap && snap.currentWeather) {
          setCurrentWeather(snap.currentWeather);
          setHourlyForecast(snap.hourlyForecast || []);
          setDailyForecast(snap.dailyForecast || []);
          setAirQuality(snap.airQuality || null);
          setIsCachedForecast(true);
          setCachedAtTimestamp(snap.cachedAt || snap.cachedTimestamp);
          setHasNoOfflineData(false);
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached offline forecast:', e);
    }
    setCurrentWeather(null);
    setHourlyForecast([]);
    setDailyForecast([]);
    setAirQuality(null);
    setIsCachedForecast(false);
    setHasNoOfflineData(true);
    return false;
  };

  // Fetch all dashboard data for target location
  const loadDashboardData = async () => {
    setIsLoading(true);

    // If device is offline, immediately fall back to cached forecast
    if (!navigator.onLine) {
      setIsOffline(true);
      loadOfflineForecast();
      setIsLoading(false);
      return;
    }

    try {
      const [currentRes, hourlyRes, dailyRes, aqiRes] = await Promise.all([
        api.getCurrentWeather({
          lat: currentLocation.lat,
          lon: currentLocation.lon,
          place: currentLocation.name,
        }),
        api.getHourlyForecast({
          lat: currentLocation.lat,
          lon: currentLocation.lon,
          place: currentLocation.name,
          hours: 24,
        }),
        api.getDailyForecast({
          lat: currentLocation.lat,
          lon: currentLocation.lon,
          place: currentLocation.name,
          days: 7,
        }),
        api.getAirQuality({
          lat: currentLocation.lat,
          lon: currentLocation.lon,
          place: currentLocation.name,
        }),
      ]);

      setCurrentWeather(currentRes);
      setHourlyForecast(hourlyRes.forecast || []);
      setDailyForecast(dailyRes.forecast || []);
      setAirQuality(aqiRes);
      setIsCachedForecast(false);
      setHasNoOfflineData(false);
      setCachedAtTimestamp(null);

      // Cache latest successful forecast response locally (Prompt 17D)
      const nowIso = new Date().toISOString();
      const snapshot = {
        location: currentLocation,
        currentWeather: currentRes,
        hourlyForecast: hourlyRes.forecast || [],
        dailyForecast: dailyRes.forecast || [],
        airQuality: aqiRes,
        cachedAt: nowIso,
        cachedTimestamp: Date.now(),
      };
      localStorage.setItem('weathergpt_cached_forecast', JSON.stringify(snapshot));

      // Check for active alerts for this location
      api.getAlerts({ lat: currentLocation.lat, lon: currentLocation.lon, radius: 150 })
        .then((alertRes) => {
          const severe = alertRes.alerts?.find(
            (a) => a.severity === 'orange' || a.severity === 'red'
          );
          if (severe) setActiveAlert(severe);
        })
        .catch(() => {});
    } catch (err) {
      console.warn('Network error fetching live forecast, attempting offline fallback:', err);
      setIsOffline(true);
      const loaded = loadOfflineForecast();
      if (!loaded) {
        setHasNoOfflineData(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      loadDashboardData();
    };
    const handleOffline = () => {
      setIsOffline(true);
      loadOfflineForecast();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadDashboardData();

    // Listen to real-time WebSocket alert broadcasts
    const unsubscribe = alertSocket.subscribe((newAlert) => {
      console.log('[Home] Received live WebSocket alert broadcast:', newAlert);
      if (newAlert.severity === 'orange' || newAlert.severity === 'red') {
        setActiveAlert(newAlert);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [currentLocation]);

  // Browser Geolocation auto-detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const rev = await api.reverseGeocode(lat, lon);
          setCurrentLocation({
            name: rev.name,
            state: rev.state,
            lat,
            lon,
          });
        } catch {
          setCurrentLocation({
            name: 'Detected Location',
            state: 'India',
            lat,
            lon,
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.warn('Geolocation denied or failed:', error.message);
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  // Weather theme visual styles
  const weatherCode = currentWeather?.weather_code || 1;
  const theme = getWeatherGradient(currentWeather?.condition, weatherCode);

  // Hourly chart dataset (next 12 hours)
  const chartData = hourlyForecast.slice(0, 12).map((item) => ({
    time: item.time.slice(11, 16),
    temp: Math.round(item.temperature),
    pop: item.precipitation_probability,
    rain: item.precipitation,
  }));

  // Today's sunrise & sunset
  const todayDaily = dailyForecast[0] || {};
  const sunriseTime = todayDaily.sunrise ? todayDaily.sunrise.slice(11, 16) : '06:05';
  const sunsetTime = todayDaily.sunset ? todayDaily.sunset.slice(11, 16) : '18:15';

  return (
    <div className="space-y-5 pb-24 pt-1 max-w-3xl mx-auto">
      {/* Location Bar & Quick Favourites */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-1">
          {favourites.map((fav) => (
            <button
              key={fav}
              onClick={async () => {
                const cand = await api.searchLocations(fav);
                if (cand.results && cand.results.length > 0) {
                  const c = cand.results[0];
                  setCurrentLocation({ name: c.name, state: c.state, lat: c.lat, lon: c.lon });
                }
              }}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition flex-shrink-0 font-medium ${
                currentLocation.name === fav
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700'
              }`}
            >
              {fav}
            </button>
          ))}
        </div>

        {/* GPS Auto-detect Button */}
        <button
          onClick={handleDetectLocation}
          disabled={isLocating}
          title="Auto-detect current location via GPS"
          className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-sky-400 border border-slate-700/60 flex-shrink-0 ml-2"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Offline Mode Banner when displaying cached forecast (Prompt 17D) */}
      {isCachedForecast && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 backdrop-blur-md p-3 flex items-center justify-between text-amber-200 text-xs shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-300 flex-shrink-0">
              <CloudOff className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-amber-300">Last cached forecast — offline</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/30 text-amber-200 uppercase tracking-wider">
                  Offline Mode
                </span>
              </div>
              {cachedAtTimestamp && (
                <p className="text-[10px] text-amber-300/80 mt-0.5">
                  Cached: {new Date(cachedAtTimestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={loadDashboardData}
            className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 flex items-center space-x-1 text-[10px] font-semibold transition"
            title="Try reconnecting"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Retry</span>
          </button>
        </div>
      )}

      {/* Offline No-Cache Notice (Prompt 17D) */}
      {hasNoOfflineData && !currentWeather && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 backdrop-blur-md p-6 text-center space-y-3 shadow-lg">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400">
            <CloudOff className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No cached forecast is available offline.</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Please connect to the internet to fetch and cache the latest live meteorological data for this location.
            </p>
          </div>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center space-x-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Live Severe Weather Alert Banner (WebSocket broadcast or active severe) */}
      {activeAlert && (
        <div
          className={`rounded-2xl border p-3 flex items-start justify-between shadow-xl animate-in slide-in-from-top duration-300 ${
            activeAlert.severity === 'red'
              ? 'bg-gradient-to-r from-rose-950/90 via-red-900/80 to-slate-900 border-rose-500/80 shadow-rose-500/20'
              : 'bg-gradient-to-r from-amber-950/90 via-orange-950/80 to-slate-900 border-orange-500/80 shadow-orange-500/20'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            <div
              className={`p-1.5 rounded-xl flex-shrink-0 mt-0.5 ${
                activeAlert.severity === 'red' ? 'bg-rose-500/30 text-rose-300' : 'bg-orange-500/30 text-orange-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span
                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    activeAlert.severity === 'red' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'
                  }`}
                >
                  LIVE {activeAlert.severity.toUpperCase()} ALERT
                </span>
                <span className="text-[10px] text-slate-300 font-semibold">{activeAlert.region}</span>
              </div>
              <p className="text-xs font-bold text-white mt-1">{activeAlert.title}</p>
              <p className="text-[11px] text-slate-200 mt-0.5 line-clamp-2">{activeAlert.description}</p>
              <Link
                to="/alerts"
                className="inline-flex items-center space-x-1 text-[10px] font-bold text-sky-300 hover:text-sky-200 mt-1.5 underline underline-offset-2"
              >
                <span>View Full Bulletin & Safety Tips →</span>
              </Link>
            </div>
          </div>
          <button
            onClick={() => setActiveAlert(null)}
            className="text-slate-400 hover:text-white p-1 flex-shrink-0 ml-1"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Big Hero Weather Card with Dynamic Gradient */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.gradient} border p-5 shadow-2xl transition-all duration-500`}
      >
        <div
          className={`absolute -top-12 -right-12 w-44 h-44 ${theme.glow} rounded-full blur-3xl pointer-events-none`}
        />

        <div className="flex items-start justify-between relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              {isCachedForecast ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/50 bg-amber-500/20 text-amber-300">
                  <CloudOff className="w-3 h-3" />
                  <span>Last cached forecast — offline</span>
                </span>
              ) : (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${theme.badge}`}>
                  {t('live_observation')}
                </span>
              )}
              {!isCachedForecast && currentWeather?.cached && (
                <span className="text-[9px] text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded-md">
                  {t('cached', 'Cached (15m)')}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black mt-2 text-white tracking-tight">{currentLocation.name}</h2>
            <p className="text-xs text-slate-300 font-medium">{currentLocation.state}, India</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFavourite}
              aria-label="Toggle favorite"
              className="p-2 rounded-2xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700 text-rose-400 transition shadow"
            >
              {isCurrentFavourite ? <Heart className="w-4 h-4 fill-rose-500" /> : <HeartOff className="w-4 h-4" />}
            </button>
            <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-700/60 shadow-inner">
              {theme.icon}
            </div>
          </div>
        </div>

        {/* Big Temperature Display */}
        <div className="mt-5 flex items-baseline justify-between relative z-10">
          <div>
            <div className="text-5xl font-black tracking-tight text-white">
              {currentWeather ? `${Math.round(currentWeather.temperature)}°C` : '--°C'}
            </div>
            <p className="text-xs font-semibold text-slate-200 mt-1 capitalize">
              {currentWeather?.weather_description || 'Loading weather...'} • {t('feels_like')}{' '}
              {currentWeather ? `${Math.round(currentWeather.feels_like)}°C` : '--°C'}
            </p>
          </div>

          {airQuality && (
            <div className="text-right">
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${
                  airQuality.aqi <= 50
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : airQuality.aqi <= 100
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                AQI {airQuality.aqi} • {airQuality.category}
              </span>
            </div>
          )}
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-4 gap-2 mt-5 pt-3.5 border-t border-slate-700/40 text-center relative z-10">
          <div>
            <Droplets className="w-4 h-4 text-sky-400 mx-auto mb-1" />
            <p className="text-[10px] text-slate-400">{t('humidity')}</p>
            <p className="text-xs font-bold text-white">{currentWeather?.humidity || '--'}%</p>
          </div>
          <div>
            <Wind className="w-4 h-4 text-teal-400 mx-auto mb-1" />
            <p className="text-[10px] text-slate-400">{t('wind')}</p>
            <p className="text-xs font-bold text-white">
              {currentWeather ? `${Math.round(currentWeather.wind_speed)} km/h` : '--'}
            </p>
          </div>
          <div>
            <CloudRain className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
            <p className="text-[10px] text-slate-400">{t('rain')}</p>
            <p className="text-xs font-bold text-white">{currentWeather?.rain || 0} mm</p>
          </div>
          <div>
            <Gauge className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-[10px] text-slate-400">{t('pressure')}</p>
            <p className="text-xs font-bold text-white">
              {currentWeather ? `${Math.round(currentWeather.surface_pressure)} hPa` : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Role-Based Home Personalization Dashboard Card */}
      <RoleHomePersonalization
        userRole={userRole}
        currentWeather={currentWeather}
        hourlyForecast={hourlyForecast}
        dailyForecast={dailyForecast}
        currentLocation={currentLocation}
        activeAlert={activeAlert}
      />

      {/* Hourly Forecast Scroller & Recharts Curve */}
      <div className="rounded-3xl bg-slate-800/80 border border-slate-700/60 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {t('hourly_outlook')}
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{t('next_12_hours', 'Next 12 Hours')}</span>
        </div>

        {/* Recharts Curve */}
        {chartData.length > 0 && (
          <div className="h-28 w-full -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg text-[10px] shadow-lg">
                          <p className="text-sky-300 font-bold">{d.time}: {d.temp}°C</p>
                          <p className="text-slate-400">Rain chance: {d.pop}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="temp"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#tempGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Hourly Pill Scroller */}
        <div className="flex space-x-2 overflow-x-auto pt-2 pb-1 scrollbar-none">
          {hourlyForecast.slice(0, 12).map((item, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 w-16 p-2 rounded-2xl bg-slate-900/60 border border-slate-700/50 flex flex-col items-center text-center"
            >
              <span className="text-[10px] text-slate-400">{item.time.slice(11, 16)}</span>
              <span className="text-xs font-bold text-white mt-1">{Math.round(item.temperature)}°</span>
              <span className="text-[9px] text-sky-400 font-semibold mt-0.5">{item.precipitation_probability}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7-Day Forecast List */}
      <div className="rounded-3xl bg-slate-800/80 border border-slate-700/60 p-4 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-slate-700/40">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {t('seven_day_outlook')}
          </span>
          <span className="text-[10px] text-slate-400">{t('imd_forecast', 'IMD Forecast')}</span>
        </div>

        <div className="divide-y divide-slate-700/30">
          {dailyForecast.map((day, idx) => {
            const dateObj = new Date(day.date);
            const dayName =
              idx === 0
                ? t('today', 'Today')
                : idx === 1
                ? t('tomorrow', 'Tomorrow')
                : dateObj.toLocaleDateString(
                    selectedLanguage === 'te'
                      ? 'te-IN'
                      : selectedLanguage === 'hi'
                      ? 'hi-IN'
                      : selectedLanguage === 'ta'
                      ? 'ta-IN'
                      : selectedLanguage === 'kn'
                      ? 'kn-IN'
                      : 'en-US',
                    { weekday: 'short' }
                  );

            return (
              <div key={day.date || idx} className="py-2.5 flex items-center justify-between text-xs">
                <span className="w-16 font-semibold text-slate-200">{dayName}</span>
                <span className="text-[11px] text-sky-400 font-medium w-12 text-center">
                  {day.precipitation_probability_max > 0 ? `${day.precipitation_probability_max}%` : '-'}
                </span>
                <span className="text-slate-300 truncate max-w-[110px] text-[11px] text-left">
                  {day.weather_description}
                </span>
                <div className="flex items-center space-x-1.5 text-right font-mono">
                  <span className="font-bold text-white">{Math.round(day.temp_max)}°</span>
                  <span className="text-slate-400 text-[11px]">{Math.round(day.temp_min)}°</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sun Schedule & Air/UV Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sunrise & Sunset */}
        <div className="rounded-3xl bg-slate-800/80 border border-slate-700/60 p-3.5 shadow-md flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('sun_schedule')}</span>
          <div className="space-y-2 mt-2">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-300">
                <Sunrise className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">{t('sunrise')}</p>
                <p className="text-xs font-bold text-white">{sunriseTime}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-orange-500/20 text-orange-300">
                <Sunset className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">{t('sunset')}</p>
                <p className="text-xs font-bold text-white">{sunsetTime}</p>
              </div>
            </div>
          </div>
        </div>

        {/* UV Index & Visibility */}
        <div className="rounded-3xl bg-slate-800/80 border border-slate-700/60 p-3.5 shadow-md flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('uv_visibility')}</span>
          <div className="space-y-2 mt-2">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-300">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">{t('uv_index')}</p>
                <p className="text-xs font-bold text-white">
                  {currentWeather ? `${currentWeather.uv_index} (Mod)` : '--'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-teal-500/20 text-teal-300">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">{t('visibility')}</p>
                <p className="text-xs font-bold text-white">
                  {currentWeather ? `${Math.round(currentWeather.visibility / 1000)} km` : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time IMD AWS Weather Station Telemetry (WIS 2.0 / MQTT) */}
      <AWSLiveFeed />

      {/* Role-Specific Quick Suggestions & Dynamic Inquiry Chips */}
      {(() => {
        const roleChips = ROLE_SUGGESTIONS[userRole] || ROLE_SUGGESTIONS.citizen;
        const currentRoleObj = (SUPPORTED_ROLES || []).find((r) => r.id === userRole) || {
          name: userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Citizen',
          icon: '🏙️',
        };

        return (
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{currentRoleObj.icon}</span>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {currentRoleObj.name} Suggested Inquiries
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Domain-tailored weather questions for {currentLocation.name}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                {roleChips.length} Chips
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {roleChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const finalQ = chip.query.replace('{loc}', currentLocation.name);
                    navigate(`/chat?q=${encodeURIComponent(finalQ)}`);
                  }}
                  className="text-left p-2.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 text-slate-200 text-xs transition flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{chip.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Quick AI Inquiries Card */}
      <div className="rounded-3xl bg-gradient-to-r from-sky-900/30 to-indigo-900/30 border border-sky-500/30 p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">{t('ask_weathergpt')}</h4>
            <p className="text-[10px] text-slate-300">{t('ask_sub')}</p>
          </div>
        </div>
        <Link
          to="/chat"
          className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold transition flex items-center space-x-1"
        >
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
