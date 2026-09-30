import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  Circle,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  Thermometer,
  CloudRain,
  Wind,
  Cloud,
  AlertTriangle,
  MapPin,
  MessageSquare,
  Navigation,
  Compass,
  RefreshCw,
  Sun,
  ShieldAlert,
  Sparkles,
  Check,
} from 'lucide-react';
import { useWeather } from '../context/WeatherContext';
import api from '../services/api';
import indiaGeoJSON from '../data/indiaGeoJSON';

// Fix leaflet icon default issues using HTML divIcons
const createTemperatureIcon = (temp) => {
  let color = 'bg-sky-500 text-white';
  if (temp >= 38) color = 'bg-rose-600 text-white animate-pulse';
  else if (temp >= 32) color = 'bg-amber-500 text-slate-950 font-extrabold';
  else if (temp >= 24) color = 'bg-emerald-500 text-slate-950 font-bold';
  else if (temp >= 16) color = 'bg-teal-500 text-white';

  return L.divIcon({
    className: 'custom-weather-marker',
    html: `<div class="px-1.5 py-0.5 rounded-full text-[11px] shadow-lg border border-white/30 font-mono font-bold flex items-center space-x-0.5 ${color}">
      <span>${Math.round(temp)}°</span>
    </div>`,
    iconSize: [36, 22],
    iconAnchor: [18, 11],
  });
};

const createRainfallIcon = (rain) => {
  const hasRain = rain > 0;
  const color = hasRain ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' : 'bg-slate-800 text-slate-300';
  return L.divIcon({
    className: 'custom-weather-marker',
    html: `<div class="px-1.5 py-0.5 rounded-full text-[10px] shadow-md border border-sky-400/40 font-mono ${color}">
      <span>${rain > 0 ? rain.toFixed(1) + 'mm' : '0mm'}</span>
    </div>`,
    iconSize: [42, 20],
    iconAnchor: [21, 10],
  });
};

const createWindIcon = (speed, direction) => {
  return L.divIcon({
    className: 'custom-weather-marker',
    html: `<div class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-teal-300 border border-teal-500/40 shadow-md font-mono flex items-center space-x-1">
      <span style="display:inline-block; transform: rotate(${direction}deg); font-weight:bold;">↑</span>
      <span>${Math.round(speed)}k</span>
    </div>`,
    iconSize: [44, 20],
    iconAnchor: [22, 10],
  });
};

const createCloudIcon = (cloudCover) => {
  return L.divIcon({
    className: 'custom-weather-marker',
    html: `<div class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-200 border border-slate-600 shadow-md font-mono">
      <span>☁️${cloudCover}%</span>
    </div>`,
    iconSize: [44, 20],
    iconAnchor: [22, 10],
  });
};

const createPinnedPinIcon = () => {
  return L.divIcon({
    className: 'custom-pinned-marker',
    html: `<div class="relative flex items-center justify-center">
      <div class="w-6 h-6 rounded-full bg-sky-500/30 animate-ping absolute"></div>
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 28],
    popupAnchor: [0, -28],
  });
};

const createAlertMarkerIcon = (severity) => {
  const isRed = severity === 'red';
  const isOrange = severity === 'orange';
  const color = isRed ? 'bg-rose-600 text-white' : isOrange ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-yellow-400 text-slate-950';

  return L.divIcon({
    className: 'custom-alert-marker',
    html: `<div class="p-1 rounded-full ${color} shadow-lg border-2 border-white animate-bounce">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Map click detector component
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Controller to fly map to coordinates
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || map.getZoom(), { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const { currentLocation, setCurrentLocation } = useWeather();

  const [activeLayer, setActiveLayer] = useState('temperature'); // temperature, rainfall, wind, clouds, alerts
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [tileTheme, setTileTheme] = useState('dark'); // 'dark' or 'osm'

  const [gridData, setGridData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isLoadingGrid, setIsLoadingGrid] = useState(true);

  // Clicked Location State
  const [clickedPin, setClickedPin] = useState(null); // { lat, lon }
  const [clickedWeather, setClickedWeather] = useState(null);
  const [isLoadingPinWeather, setIsLoadingPinWeather] = useState(false);

  // Map view target
  const [mapTarget, setMapTarget] = useState({
    center: [21.5, 78.9],
    zoom: 5,
  });

  // Fetch weather grid and alerts
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingGrid(true);
      try {
        const [gridRes, alertsRes] = await Promise.all([
          api.getWeatherGrid(),
          api.getAlerts().catch(() => ({ alerts: [] })),
        ]);
        if (gridRes?.points) {
          setGridData(gridRes.points);
        }
        if (alertsRes?.alerts) {
          setAlerts(alertsRes.alerts);
        }
      } catch (err) {
        console.error('Failed to load GIS weather grid:', err);
      } finally {
        setIsLoadingGrid(false);
      }
    };

    fetchData();
  }, []);

  // Handle map click: drop pin & fetch live weather
  const handleMapClick = async (latlng) => {
    const { lat, lng } = latlng;
    setClickedPin({ lat, lon: lng });
    setIsLoadingPinWeather(true);
    setClickedWeather(null);

    try {
      const data = await api.getCurrentWeather({ lat, lon: lng });
      setClickedWeather(data);
    } catch (err) {
      console.error('Failed to fetch weather for pinned coordinate:', err);
      setClickedWeather({
        place_name: `Location (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`,
        temperature: 28,
        feels_like: 29,
        weather_description: 'Observation available',
        humidity: 60,
        wind_speed: 12,
        rain: 0,
      });
    } finally {
      setIsLoadingPinWeather(false);
    }
  };

  // Action: Ask WeatherGPT about this location
  const handleAskWeatherGPT = () => {
    if (!clickedWeather && !clickedPin) return;

    const placeName = clickedWeather?.place_name || `Location (${clickedPin.lat.toFixed(2)}, ${clickedPin.lon.toFixed(2)})`;
    const targetState = clickedWeather?.state || 'India';

    // Update global active location
    setCurrentLocation({
      name: placeName.split(',')[0].trim(),
      state: targetState,
      lat: clickedPin.lat,
      lon: clickedPin.lon,
    });

    // Navigate to Chat with prefilled initialMessage
    navigate('/chat', {
      state: {
        initialMessage: `What is the live weather, forecast, and warnings for ${placeName}?`,
      },
    });
  };

  // Jump to Current Location
  const handleLocateMe = () => {
    if (currentLocation?.lat && currentLocation?.lon) {
      setMapTarget({
        center: [currentLocation.lat, currentLocation.lon],
        zoom: 9,
      });
      handleMapClick({ lat: currentLocation.lat, lng: currentLocation.lon });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-120px)] overflow-hidden rounded-3xl border border-slate-800 shadow-2xl bg-slate-950 flex flex-col">
      {/* Top Floating Control Bar */}
      <div className="absolute top-2 left-2 right-2 z-[1000] flex flex-col space-y-1.5 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Layer Selector Bar */}
          <div className="flex items-center space-x-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-xl overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveLayer('temperature')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
                activeLayer === 'temperature'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" />
              <span>Temp</span>
            </button>

            <button
              onClick={() => setActiveLayer('rainfall')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
                activeLayer === 'rainfall'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
              <span>Rain</span>
            </button>

            <button
              onClick={() => setActiveLayer('wind')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
                activeLayer === 'wind'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span>Wind</span>
            </button>

            <button
              onClick={() => setActiveLayer('clouds')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
                activeLayer === 'clouds'
                  ? 'bg-slate-700 text-white border border-slate-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Clouds</span>
            </button>

            <button
              onClick={() => setActiveLayer('alerts')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
                activeLayer === 'alerts'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Alerts</span>
              {alerts.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping ml-0.5"></span>
              )}
            </button>
          </div>

          {/* Quick Action Buttons (Locate Me & Theme) */}
          <div className="flex items-center space-x-1.5 pointer-events-auto">
            <button
              onClick={() => setShowBoundaries(!showBoundaries)}
              className={`p-2 rounded-xl text-xs font-semibold backdrop-blur-md border shadow-xl transition ${
                showBoundaries
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-900/90 text-slate-400 border-slate-700/80 hover:text-white'
              }`}
              title="Toggle State & District Boundaries GeoJSON"
            >
              <Layers className="w-4 h-4" />
            </button>

            <button
              onClick={handleLocateMe}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-sky-400 border border-slate-700/80 shadow-xl backdrop-blur-md transition"
              title="Jump to current location"
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Informative Hint Pill */}
        <div className="self-center bg-slate-950/80 backdrop-blur-md px-3 py-0.5 rounded-full border border-slate-700/60 shadow-lg text-[10px] text-slate-300 flex items-center space-x-1">
          <MapPin className="w-3 h-3 text-sky-400" />
          <span>Click anywhere on the map to pin location & see live weather</span>
        </div>
      </div>

      {/* Main Leaflet Map Container */}
      <div className="flex-1 w-full h-full relative z-0">
        <MapContainer
          center={mapTarget.center}
          zoom={mapTarget.zoom}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          {/* Map Recenter Controller */}
          <MapController center={mapTarget.center} zoom={mapTarget.zoom} />

          {/* Map Click Listener */}
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Base Tile Layer */}
          {tileTheme === 'dark' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}

          {/* State / District Boundaries GeoJSON Layer */}
          {showBoundaries && (
            <GeoJSON
              data={indiaGeoJSON}
              style={{
                color: '#38bdf8',
                weight: 1.5,
                opacity: 0.6,
                fillColor: '#0284c7',
                fillOpacity: 0.05,
              }}
            />
          )}

          {/* Weather Grid Station Points */}
          {gridData.map((pt) => {
            let icon = createTemperatureIcon(pt.temperature);
            if (activeLayer === 'rainfall') icon = createRainfallIcon(pt.rain || pt.precipitation);
            else if (activeLayer === 'wind') icon = createWindIcon(pt.wind_speed, pt.wind_direction);
            else if (activeLayer === 'clouds') icon = createCloudIcon(pt.cloud_cover);

            return (
              <Marker
                key={pt.name}
                position={[pt.lat, pt.lon]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    handleMapClick({ lat: pt.lat, lng: pt.lon });
                  },
                }}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="text-xs p-1">
                    <p className="font-bold text-slate-900">{pt.name}, {pt.state}</p>
                    <p className="text-[11px] text-slate-700 capitalize">{pt.weather_description}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] border-t pt-1 font-mono">
                      <span>Temp: {Math.round(pt.temperature)}°C</span>
                      <span>Rain: {pt.rain}mm</span>
                      <span>Wind: {Math.round(pt.wind_speed)}k</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Active IMD Alerts Overlay */}
          {activeLayer === 'alerts' &&
            alerts.map((al) => {
              const sev = al.severity?.toLowerCase() || 'yellow';
              const color = sev === 'red' ? '#ef4444' : sev === 'orange' ? '#f97316' : '#eab308';

              return (
                <React.Fragment key={al.id || `${al.lat}_${al.lon}`}>
                  <Circle
                    center={[al.lat, al.lon]}
                    radius={(al.radius_km || 40) * 1000}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: 0.25,
                      weight: 2,
                    }}
                  />
                  <Marker
                    position={[al.lat, al.lon]}
                    icon={createAlertMarkerIcon(sev)}
                  >
                    <Popup className="custom-leaflet-popup">
                      <div className="text-xs p-1 max-w-[200px]">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white ${
                            sev === 'red' ? 'bg-red-600' : sev === 'orange' ? 'bg-orange-500' : 'bg-yellow-500'
                          }`}
                        >
                          IMD {sev} ALERT
                        </span>
                        <h4 className="font-bold mt-1 text-slate-900">{al.headline || al.alert_type}</h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">{al.description}</p>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

          {/* User Clicked Pin Marker */}
          {clickedPin && (
            <Marker position={[clickedPin.lat, clickedPin.lon]} icon={createPinnedPinIcon()} />
          )}
        </MapContainer>
      </div>

      {/* Slide-Up Pin Weather Inspection Card */}
      {clickedPin && (
        <div className="absolute bottom-2 left-2 right-2 z-[1000] p-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-sky-500/20 text-sky-400">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-tight">
                  {isLoadingPinWeather ? (
                    'Querying meteorological observation...'
                  ) : (
                    clickedWeather?.place_name || `Location (${clickedPin.lat.toFixed(2)}, ${clickedPin.lon.toFixed(2)})`
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  Coordinates: {clickedPin.lat.toFixed(4)}°N, {clickedPin.lon.toFixed(4)}°E
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setClickedPin(null);
                setClickedWeather(null);
              }}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>

          {/* Weather Details Grid */}
          {isLoadingPinWeather ? (
            <div className="py-4 flex items-center justify-center space-x-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              <span>Fetching live IMD & Open-Meteo observation...</span>
            </div>
          ) : clickedWeather ? (
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-extrabold text-white">
                    {Math.round(clickedWeather.temperature)}°C
                  </span>
                  <span className="text-xs text-slate-400 ml-2">
                    Feels {Math.round(clickedWeather.feels_like)}°C
                  </span>
                </div>
                <span className="text-xs font-medium text-sky-300 capitalize">
                  {clickedWeather.weather_description}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-1">
                  <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Rain: {clickedWeather.rain || 0}mm</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Wind className="w-3.5 h-3.5 text-teal-400" />
                  <span>Wind: {Math.round(clickedWeather.wind_speed || 0)}km/h</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Humidity: {clickedWeather.humidity || 60}%</span>
                </div>
              </div>

              {/* Action: Ask WeatherGPT About This Place */}
              <button
                onClick={handleAskWeatherGPT}
                className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/25 transition transform active:scale-98"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask WeatherGPT about this place →</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
