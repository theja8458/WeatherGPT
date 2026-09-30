import React, { useState, useEffect } from 'react';
import {
  Radio,
  Activity,
  Wifi,
  Zap,
  CloudRain,
  Thermometer,
  Wind,
  Gauge,
  BatteryCharging,
  RefreshCw,
  Sparkles,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import alertSocket from '../services/alertSocket';

export default function AWSLiveFeed() {
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(null);

  // Fetch initial stations list
  const fetchInitialStations = async () => {
    try {
      setIsLoading(true);
      const res = await api.getLatestAWSStations();
      if (res && res.stations) {
        setStations(res.stations);
      }
    } catch (err) {
      console.warn('Failed to load initial AWS stations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialStations();

    // Subscribe to live WebSocket AWS telemetry stream
    const unsubscribe = alertSocket.subscribeAWS((updatedStation) => {
      setLastMessageTime(new Date());
      setRecentlyUpdatedId(updatedStation.station_id);

      setStations((prevStations) => {
        const index = prevStations.findIndex((s) => s.station_id === updatedStation.station_id);
        if (index >= 0) {
          const next = [...prevStations];
          next[index] = { ...next[index], ...updatedStation };
          return next;
        } else {
          return [updatedStation, ...prevStations];
        }
      });

      // Clear pulse highlight after 2.5s
      setTimeout(() => {
        setRecentlyUpdatedId((curr) => (curr === updatedStation.station_id ? null : curr));
      }, 2500);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSimulateOne = async (station = null) => {
    try {
      setIsSimulating(true);
      const payload = station ? { station_id: station.station_id, station_name: station.station_name, district: station.district, state: station.state, lat: station.lat, lon: station.lon } : {};
      await api.publishMockAWSTelemetry(payload);
    } catch (err) {
      console.error('Failed to trigger mock AWS telemetry:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md shadow-xl transition-all">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-white tracking-wide">
                IMD Automatic Weather Stations (AWS)
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping"></span>
                WIS 2.0 / MQTT LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sub-minute surface telemetry ingested via MQTT subscriber into MongoDB Atlas & streamed over WebSockets
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={() => handleSimulateOne()}
            disabled={isSimulating}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-medium border border-cyan-500/30 transition-all disabled:opacity-50"
            title="Trigger an AWS telemetry transmission through MQTT pipeline"
          >
            <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : 'text-cyan-400'}`} />
            <span>{isSimulating ? 'Transmitting...' : 'Simulate Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* Stations Grid */}
      {isLoading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          <span className="text-xs">Connecting to WIS 2.0 station feed...</span>
        </div>
      ) : stations.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          No active AWS telemetry received yet. Click "Simulate Telemetry" to test the pipeline.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {stations.map((st) => {
            const isJustUpdated = recentlyUpdatedId === st.station_id;
            return (
              <div
                key={st.station_id}
                className={`relative rounded-xl p-4 transition-all duration-300 border ${
                  isJustUpdated
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                {/* Updated Ping Indicator */}
                {isJustUpdated && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                  </span>
                )}

                {/* Station Title */}
                <div className="flex items-start justify-between mb-2.5">
                  <div className="pr-2">
                    <div className="text-xs font-semibold text-white truncate max-w-[170px]" title={st.station_name}>
                      {st.station_name.replace('IMD AWS ', '')}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{st.district}, {st.state}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold font-mono text-cyan-300">
                      {st.temperature_c !== undefined ? `${st.temperature_c}°C` : '--'}
                    </span>
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-700/50">
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                    <span>Rain: <strong className="text-white">{st.rain_rate_mmh || 0}</strong> mm/h</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <Wind className="w-3.5 h-3.5 text-teal-400" />
                    <span>Wind: <strong className="text-white">{st.wind_speed_kmh || 0}</strong> kph</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <Gauge className="w-3.5 h-3.5 text-amber-400" />
                    <span>{st.pressure_hpa || 1012} hPa</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{st.battery_v || 12.6}V ({st.humidity_percent}%)</span>
                  </div>
                </div>

                {/* Bottom Footer with Chat query trigger */}
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">
                    {isJustUpdated ? '⚡ Live update' : st.station_id.split('_').slice(-1)[0]}
                  </span>
                  <button
                    onClick={() => {
                      navigate(`/chat?q=${encodeURIComponent(`What is the latest AWS station reading for ${st.district}?`)}`);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-0.5 font-medium transition-colors"
                  >
                    <span>Ask bot</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Status */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-teal-400"></span>
          <span>WMO WIS 2.0 Topic: <code className="font-mono text-slate-300">wis2/in-imd/.../synop/#</code></span>
        </div>
        <div>
          {lastMessageTime ? (
            <span>Last packet received: <strong className="text-slate-300">{lastMessageTime.toLocaleTimeString()}</strong></span>
          ) : (
            <span>Listening for real-time telemetry packets</span>
          )}
        </div>
      </div>
    </div>
  );
}
