import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Bell,
  BellOff,
  Filter,
  Flame,
  CloudRain,
  CloudLightning,
  Wind,
  PhoneCall,
  Sparkles,
  Radio,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWeather } from '../context/WeatherContext';
import api from '../services/api';
import alertSocket from '../services/alertSocket';

const SEVERITY_STYLES = {
  red: {
    gradient: 'from-rose-950/70 via-red-900/40 to-slate-900 border-rose-500/60',
    badge: 'bg-rose-500 text-white border-rose-400 font-extrabold animate-pulse',
    iconBg: 'bg-rose-500/20 text-rose-400',
    title: 'text-rose-200',
    label: 'Red Warning (Take Action)',
  },
  orange: {
    gradient: 'from-amber-950/70 via-orange-950/40 to-slate-900 border-orange-500/60',
    badge: 'bg-orange-500 text-white border-orange-400 font-bold',
    iconBg: 'bg-orange-500/20 text-orange-400',
    title: 'text-orange-200',
    label: 'Orange Alert (Be Prepared)',
  },
  yellow: {
    gradient: 'from-yellow-950/60 via-amber-950/30 to-slate-900 border-yellow-500/50',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 font-semibold',
    iconBg: 'bg-yellow-500/20 text-yellow-400',
    title: 'text-yellow-200',
    label: 'Yellow Watch (Be Updated)',
  },
  green: {
    gradient: 'from-emerald-950/50 via-teal-950/30 to-slate-900 border-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
    title: 'text-emerald-200',
    label: 'Green (No Warning)',
  },
};

export default function Alerts() {
  const { t } = useTranslation();
  const { currentLocation } = useWeather();

  const [alerts, setAlerts] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  // Simulation form state
  const [simRegion, setSimRegion] = useState(currentLocation.name);
  const [simSeverity, setSimSeverity] = useState('orange');
  const [simType, setSimType] = useState('heavy_rain');
  const [isSimulating, setIsSimulating] = useState(false);

  // Fetch active alerts
  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAlerts({
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        radius: 300,
      });
      setAlerts(res.alerts || []);
    } catch (e) {
      console.error('Failed to load alerts:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();

    // Subscribe to live WebSocket alerts
    const unsubscribe = alertSocket.subscribe((newAlert) => {
      console.log('Received WebSocket alert in Alerts page:', newAlert);
      setAlerts((prev) => {
        // Prepend and avoid duplicate by id
        const filtered = prev.filter((a) => (a._id || a.id) !== (newAlert._id || newAlert.id));
        return [newAlert, ...filtered];
      });
    });

    return () => unsubscribe();
  }, [currentLocation]);

  const handleRequestPermission = async () => {
    const granted = await alertSocket.requestNotificationPermission();
    setHasNotificationPermission(granted);
  };

  const handleSimulateAlert = async () => {
    setIsSimulating(true);
    try {
      const res = await api.simulateAlert({
        region: simRegion,
        severity: simSeverity,
        alert_type: simType,
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        custom_title: `IMD ${simSeverity.toUpperCase()} Warning: ${simType.replace('_', ' ').toUpperCase()} in ${simRegion}`,
        custom_description: `Urgent meteorological advisory for ${simRegion}. Severe conditions expected over the next 24 hours. Follow district disaster management guidelines.`,
      });
      if (res && res.alert) {
        setAlerts((prev) => [res.alert, ...prev]);
      }
      setShowSimulateModal(false);
    } catch (e) {
      console.error('Alert simulation failed:', e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTriggerLoweredThreshold = async () => {
    setIsSimulating(true);
    try {
      const res = await api.triggerLoweredThreshold({
        region: currentLocation.name,
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        custom_rain_threshold: 0.0,
      });
      if (res && res.alerts && res.alerts.length > 0) {
        setAlerts((prev) => {
          const newIds = new Set(res.alerts.map((a) => a._id || a.id));
          const filtered = prev.filter((a) => !newIds.has(a._id || a.id));
          return [...res.alerts, ...filtered];
        });
      }
      setShowSimulateModal(false);
    } catch (e) {
      console.error('Trigger lowered threshold failed:', e);
    } finally {
      setIsSimulating(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  const getAlertIcon = (type, severity) => {
    if (severity === 'red') return <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />;
    if (type === 'heatwave') return <Flame className="w-5 h-5 text-orange-400" />;
    if (type === 'thunderstorm') return <CloudLightning className="w-5 h-5 text-amber-300" />;
    if (type === 'strong_wind') return <Wind className="w-5 h-5 text-teal-400" />;
    return <CloudRain className="w-5 h-5 text-sky-400" />;
  };

  return (
    <div className="space-y-4 pb-24 pt-1 max-w-md mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center space-x-2">
            <span>IMD Early Warnings</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">Color-Coded Weather Bulletins & Safety Guidance</p>
        </div>

        {/* Simulate Alert Trigger Button for SIH evaluation */}
        <button
          onClick={() => setShowSimulateModal(true)}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold shadow transition"
          title="Simulate lowered threshold or test alert"
        >
          <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span>Simulate</span>
        </button>
      </div>

      {/* Browser Notification Banner */}
      {!hasNotificationPermission && (
        <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-3 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5 text-xs text-slate-300">
            <Bell className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>Enable instant alerts for severe storm warnings</span>
          </div>
          <button
            onClick={handleRequestPermission}
            className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-bold text-[11px] transition shadow"
          >
            Enable
          </button>
        </div>
      )}

      {/* Severity Filter Tabs */}
      <div className="flex space-x-1.5 overflow-x-auto scrollbar-none py-1">
        {[
          { id: 'all', label: 'All Alerts' },
          { id: 'red', label: 'Red (Warning)' },
          { id: 'orange', label: 'Orange (Alert)' },
          { id: 'yellow', label: 'Yellow (Watch)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterSeverity(tab.id)}
            className={`text-[11px] px-3 py-1 rounded-full border transition font-semibold flex-shrink-0 ${
              filterSeverity === tab.id
                ? 'bg-sky-500 text-white border-sky-400 shadow-md'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Alerts Feed */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
            <Sparkles className="w-6 h-6 text-sky-400 animate-spin" />
            <span>Syncing live IMD bulletins...</span>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 p-6 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">No Severe Weather Warnings</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              All meteorological parameters in {currentLocation.name} and surrounding regions are within normal limits (Green).
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.yellow;

            return (
              <div
                key={alert._id || alert.id || idx}
                className={`rounded-3xl bg-gradient-to-br ${style.gradient} border p-4 shadow-xl space-y-2.5 transition animate-in fade-in duration-300`}
              >
                {/* Header row: Badge, Type Icon, Region */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-xl ${style.iconBg}`}>
                      {getAlertIcon(alert.type, alert.severity)}
                    </div>
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.badge}`}>
                        {style.label}
                      </span>
                      <h3 className={`text-xs font-bold mt-1 ${style.title}`}>{alert.title}</h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-700/50">
                    {alert.region}
                  </span>
                </div>

                {/* Description & Action Advice */}
                <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
                  {alert.description}
                </p>

                {/* Footer: Validity, Helpline */}
                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                  <span>Valid until: {new Date(alert.valid_to).toLocaleDateString()} {new Date(alert.valid_to).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className="flex items-center space-x-1 text-rose-300 font-bold">
                    <PhoneCall className="w-3 h-3" />
                    <span>Disaster Helpline: 1070</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* "What To Do" Standard Disaster Safety Action Guidelines */}
      <div className="rounded-3xl bg-slate-800/80 border border-slate-700/60 p-4 shadow-lg space-y-3">
        <div className="flex items-center space-x-2 pb-1 border-b border-slate-700/50">
          <ShieldAlert className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            What To Do: IMD Safety Protocols
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/40 space-y-1">
            <span className="font-bold text-sky-300 flex items-center space-x-1">
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
              <span>Heavy Rain / Flood</span>
            </span>
            <p className="text-[10px] text-slate-300">
              Avoid underpasses, stay off waterlogged roads. Keep torch and power banks ready.
            </p>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/40 space-y-1">
            <span className="font-bold text-amber-300 flex items-center space-x-1">
              <CloudLightning className="w-3.5 h-3.5 text-amber-400" />
              <span>Lightning Storm</span>
            </span>
            <p className="text-[10px] text-slate-300">
              Do not stand near lone trees or metal fences. Stay inside pukka houses or vehicles.
            </p>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/40 space-y-1">
            <span className="font-bold text-orange-300 flex items-center space-x-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Severe Heatwave</span>
            </span>
            <p className="text-[10px] text-slate-300">
              Avoid sun 11am-4pm. Drink ORS, buttermilk, and lassi. Wear light-colored clothing.
            </p>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/40 space-y-1">
            <span className="font-bold text-teal-300 flex items-center space-x-1">
              <Wind className="w-3.5 h-3.5 text-teal-400" />
              <span>High Wind / Squall</span>
            </span>
            <p className="text-[10px] text-slate-300">
              Tie down outdoor sheets. Steer clear of old dilapidated structures and hoardings.
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Simulate Alert (Lowered Threshold / Custom Trigger Showcase) */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-4 shadow-2xl space-y-3 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>Simulate Live IMD Alert</span>
              </h3>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Trigger a real-time warning broadcast to test WebSocket push, live dashboard banners, and browser notifications.
            </p>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Target District / City</label>
                <input
                  type="text"
                  value={simRegion}
                  onChange={(e) => setSimRegion(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Severity</label>
                  <select
                    value={simSeverity}
                    onChange={(e) => setSimSeverity(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                  >
                    <option value="red">Red (Warning)</option>
                    <option value="orange">Orange (Alert)</option>
                    <option value="yellow">Yellow (Watch)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Alert Type</label>
                  <select
                    value={simType}
                    onChange={(e) => setSimType(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
                  >
                    <option value="heavy_rain">Heavy Rain</option>
                    <option value="heatwave">Heatwave</option>
                    <option value="thunderstorm">Thunderstorm</option>
                    <option value="strong_wind">Strong Wind</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col space-y-2">
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowSimulateModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimulateAlert}
                  disabled={isSimulating}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 text-white font-bold text-xs hover:opacity-95 shadow-md flex items-center space-x-1.5"
                >
                  {isSimulating ? (
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Radio className="w-3.5 h-3.5" />
                  )}
                  <span>Push Custom Alert</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={handleTriggerLoweredThreshold}
                  disabled={isSimulating}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-600/30 via-orange-600/30 to-rose-600/30 hover:from-amber-600/40 hover:to-rose-600/40 text-amber-200 border border-amber-500/40 text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow"
                  title="Evaluates real forecast using lowered rain threshold (0.0mm) to verify live WebSocket banner"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test Artificially Lowered Threshold (Prompt 10 Test)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
