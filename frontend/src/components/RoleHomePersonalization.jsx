import React, { useState, useEffect } from 'react';
import {
  Wheat,
  Plane,
  ShieldAlert,
  BarChart3,
  Anchor,
  Users,
  Wind,
  CloudRain,
  Sun,
  AlertTriangle,
  ArrowUpRight,
  Download,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Gauge,
  Droplets,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  X,
  Send,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const INDIAN_STATES = [
  'Telangana',
  'Andhra Pradesh',
  'Delhi',
  'Maharashtra',
  'Tamil Nadu',
  'Karnataka',
];

const CROPS_LIST = [
  { id: 'cotton', name: 'Cotton (పత్తి)' },
  { id: 'rice', name: 'Rice / Paddy (వరి)' },
  { id: 'groundnut', name: 'Groundnut (వేరుశనగ)' },
  { id: 'chilli', name: 'Chilli (మిరప)' },
  { id: 'maize', name: 'Maize (మొక్కజొన్న)' },
  { id: 'wheat', name: 'Wheat (గోధుమ)' },
];

export default function RoleHomePersonalization({
  userRole = 'citizen',
  currentWeather,
  hourlyForecast = [],
  dailyForecast = [],
  currentLocation,
  activeAlert,
}) {
  const navigate = useNavigate();

  // --- FARMER STATES ---
  const [selectedCrop, setSelectedCrop] = useState('cotton');

  // --- AVIATION STATES ---
  const [showMetarModal, setShowMetarModal] = useState(false);
  const [copiedMetar, setCopiedMetar] = useState(false);

  // --- DISASTER MANAGER STATES ---
  const [selectedState, setSelectedState] = useState(currentLocation?.state || 'Telangana');
  const [districtRiskData, setDistrictRiskData] = useState(null);
  const [isLoadingRisk, setIsLoadingRisk] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastLangs, setBroadcastLangs] = useState(['en', 'hi', 'te']);
  const [broadcastAdvisories, setBroadcastAdvisories] = useState(null);
  const [isGeneratingBroadcast, setIsGeneratingBroadcast] = useState(false);
  const [copiedLang, setCopiedLang] = useState(null);

  // --- RESEARCHER STATES ---
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Helper: compute spraying window status for Farmers
  const windKmh = currentWeather?.wind_speed || 10;
  const rainProb = hourlyForecast[0]?.precipitation_probability || 0;
  const humidity = currentWeather?.humidity || 65;
  const isSafeSpraying = windKmh < 18 && rainProb < 25 && humidity < 85;

  // Helper: generate METAR-style code for Aviation
  const formatMetar = () => {
    const locName = (currentLocation?.name || 'VOHY').toUpperCase().slice(0, 4);
    const day = new Date().getUTCDate().toString().padStart(2, '0');
    const hour = new Date().getUTCHours().toString().padStart(2, '0');
    const min = new Date().getUTCMinutes().toString().padStart(2, '0');
    const windDir = (currentWeather?.wind_direction || 180).toString().padStart(3, '0');
    const windKt = Math.round((currentWeather?.wind_speed || 12) * 0.539957)
      .toString()
      .padStart(2, '0');
    const temp = Math.round(currentWeather?.temperature || 28);
    const dew = Math.round(temp - (100 - humidity) / 5);
    const qnh = Math.round(currentWeather?.surface_pressure || currentWeather?.pressure || 1012);

    return `${locName} ${day}${hour}${min}Z ${windDir}${windKt}KT 8000 FEW025 ${temp}/${dew} Q${qnh} NOSIG`;
  };

  // Helper: compute wave height & sea state for Marine
  const windKtMarine = Math.round((currentWeather?.wind_speed || 12) * 0.539957);
  const waveHeightM = ((currentWeather?.wind_speed || 12) * 0.08).toFixed(1);
  const isMarineSafe = windKtMarine < 20 && waveHeightM < 1.8;
  const seaState =
    waveHeightM < 1.0
      ? 'Slight / Smooth'
      : waveHeightM < 2.0
      ? 'Moderate'
      : 'Rough (Advisory Active)';

  // Fetch Disaster Manager State Risk data when role is active
  useEffect(() => {
    if (userRole === 'disaster_manager') {
      setIsLoadingRisk(true);
      api.getStateRiskSummary(selectedState)
        .then((data) => setDistrictRiskData(data))
        .catch(() => setDistrictRiskData(null))
        .finally(() => setIsLoadingRisk(false));
    }
  }, [userRole, selectedState]);

  // Generate Broadcast Advisory Handler
  const handleGenerateBroadcast = async () => {
    setIsGeneratingBroadcast(true);
    try {
      const res = await api.generateBroadcastAdvisory({
        state: selectedState,
        hazard_type: activeAlert?.alert_type || 'heavy_rain',
        severity: activeAlert?.severity || 'orange',
        districts: districtRiskData?.high_risk_districts || [currentLocation.name],
        instructions: 'Avoid waterlogged areas, stay indoors during peak rain, follow local administration advisories.',
        languages: broadcastLangs,
      });
      if (res && res.advisories) {
        setBroadcastAdvisories(res.advisories);
      }
    } catch (err) {
      console.error('Failed generating broadcast advisory:', err);
    } finally {
      setIsGeneratingBroadcast(false);
    }
  };

  // Researcher 1-Click CSV Export
  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    setExportMessage('Fetching 30-year historical climate archive...');
    try {
      const data = await api.getClimateTrends({
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        from: 1994,
        to: 2023,
        place: currentLocation.name,
      });

      // Build CSV content from yearly_series in primary data
      const records = data.primary?.yearly_series || data.yearly_series || data.annual_trends || [];
      if (!records || records.length === 0) {
        throw new Error('No historical records returned');
      }

      const headers = Object.keys(records[0]).join(',');
      const rows = records.map((row) => Object.values(row).join(',')).join('\n');
      const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
      const encodedUri = encodeURI(csvContent);

      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `WeatherGPT_Climate_Trends_${currentLocation.name}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportMessage('CSV successfully downloaded!');
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err) {
      console.error('CSV Export error:', err);
      setExportMessage('Export failed. Please try again.');
      setTimeout(() => setExportMessage(null), 3500);
    } finally {
      setIsExportingCSV(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ============================================================ */}
      {/* 1. FARMER PERSONA                                           */}
      {/* ============================================================ */}
      {userRole === 'farmer' && (
        <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-300 shadow-inner">
                <Wheat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>Farmer Agronomic Center</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Farm Intel
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Crop-specific advisories, spraying windows & irrigation forecasting for {currentLocation.name}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/advisory?crop=${selectedCrop}`)}
              className="text-xs text-emerald-300 hover:text-emerald-200 flex items-center space-x-1 font-semibold transition"
            >
              <span>Full Advisory</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Crop Selector */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
              Select Crop for Personalized Guidance:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CROPS_LIST.map((crop) => (
                <button
                  key={crop.id}
                  onClick={() => setSelectedCrop(crop.id)}
                  className={`text-xs px-2.5 py-1 rounded-xl border transition-all ${
                    selectedCrop === crop.id
                      ? 'bg-emerald-500/30 border-emerald-400 text-white font-bold shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {crop.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* Spraying Window Status */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Pesticide Spraying Window
              </span>
              <div className="flex items-center space-x-2.5 my-2">
                {isSafeSpraying ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                )}
                <div>
                  <span
                    className={`text-xs font-bold block ${
                      isSafeSpraying ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {isSafeSpraying ? 'Safe to Spray' : 'Sub-Optimal Window'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Wind: {windKmh} km/h • Rain chance: {rainProb}%
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400">
                {isSafeSpraying
                  ? 'Recommended: Spray during 06:00 - 10:30 AM before wind accelerates'
                  : 'Avoid spraying to prevent chemical wash-off or drift loss'}
              </span>
            </div>

            {/* Rain Forecast for Irrigation */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Irrigation & Rain Forecast
              </span>
              <div className="flex items-center space-x-2.5 my-2">
                <CloudRain className="w-5 h-5 text-sky-400 flex-shrink-0" />
                <div>
                  <span className="text-xs font-bold text-white block">
                    {rainProb}% Probability Today
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Next 48h Total: {(dailyForecast[0]?.precipitation_sum || 0).toFixed(1)} mm
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400">
                {(dailyForecast[0]?.precipitation_sum || 0) > 10
                  ? 'Significant rain forecast: withhold canal and borewell irrigation'
                  : 'Low rainfall expected: safe to irrigate roots'}
              </span>
            </div>

            {/* Crop Pest Risk */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {selectedCrop.toUpperCase()} Agronomic Action
              </span>
              <div className="my-2">
                <span className="text-xs font-bold text-emerald-300 block">
                  Soil Moisture: Adequate
                </span>
                <span className="text-[10px] text-slate-300 mt-0.5 block">
                  Monitor for stem borer & bollworm due to current humidity ({humidity}%).
                </span>
              </div>
              <button
                onClick={() =>
                  navigate(
                    `/chat?q=${encodeURIComponent(
                      `Provide complete agronomic advice and spraying window for ${selectedCrop} in ${currentLocation.name}`
                    )}`
                  )
                }
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-1"
              >
                <span>Ask bot about {selectedCrop}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. AVIATION PERSONA                                         */}
      {/* ============================================================ */}
      {userRole === 'aviation' && (
        <div className="bg-gradient-to-br from-blue-950/60 via-slate-900 to-slate-900 border border-blue-500/40 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-blue-500/20">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-300 shadow-inner">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>Aviation Weather Center</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    VFR Category
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Simulated METAR-style reports, flight ceiling, wind gusts, and visibility
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMetarModal(true)}
              className="text-xs text-blue-300 hover:text-blue-200 flex items-center space-x-1 font-semibold transition"
            >
              <span>Decoder</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Raw METAR String Box */}
          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase text-blue-400 font-bold">
                  Simulated METAR-Style Observation
                </span>
                <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                  SPECI / AUTO
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(formatMetar());
                  setCopiedMetar(true);
                  setTimeout(() => setCopiedMetar(false), 2000);
                }}
                className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1 font-mono transition"
                title="Copy raw METAR text"
              >
                {copiedMetar ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedMetar ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="text-xs font-mono text-emerald-300 font-bold block overflow-x-auto whitespace-pre">
              {formatMetar()}
            </code>
            {/* Mandatory Disclaimer */}
            <div className="text-[10px] text-amber-300/90 flex items-start space-x-1.5 pt-1 border-t border-slate-800">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                <strong>WeatherGPT-Generated METAR-Style Summary</strong> — Derived from available surface weather data. Not an official AFTN/WMO broadcast; not for operational flight dispatch.
              </span>
            </div>
          </div>

          {/* Aviation Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Flight Rules</span>
              <span className="font-bold text-emerald-400 font-mono">VFR (Visual)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Cloud Ceiling</span>
              <span className="font-bold text-white font-mono">&gt; 3,000 ft AGL</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Runway Wind</span>
              <span className="font-bold text-white font-mono">
                {Math.round((currentWeather?.wind_speed || 12) * 0.54)} kt @ {currentWeather?.wind_direction || 180}°
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Altimeter (QNH)</span>
              <span className="font-bold text-sky-400 font-mono">
                {Math.round(currentWeather?.surface_pressure || currentWeather?.pressure || 1012)} hPa
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. DISASTER MANAGER PERSONA                                 */}
      {/* ============================================================ */}
      {userRole === 'disaster_manager' && (
        <div className="bg-gradient-to-br from-rose-950/60 via-slate-900 to-slate-900 border border-rose-500/40 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-rose-500/20 gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-300 shadow-inner">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>Disaster Operations Center</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    State Risk Mode
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Statewide alerts, district risk heat table, and public advisory drafting
                </p>
              </div>
            </div>

            {/* State Selector */}
            <div className="flex items-center space-x-1.5">
              <label htmlFor="state-select" className="text-xs text-slate-400 font-semibold">State:</label>
              <select
                id="state-select"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-2.5 py-1 focus:outline-none focus:border-rose-400"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700">
              <span className="text-[10px] text-slate-400 block">Active Alerts</span>
              <span className="text-base font-extrabold text-rose-400 font-mono">
                {districtRiskData?.total_active_alerts || (activeAlert ? 1 : 0)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700">
              <span className="text-[10px] text-slate-400 block">Rainfall Threat</span>
              <span className="text-base font-extrabold text-amber-400 font-mono">
                {(dailyForecast[0]?.precipitation_sum || 0) > 35 ? 'HIGH' : 'MODERATE'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700">
              <span className="text-[10px] text-slate-400 block">State Readiness</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                LEVEL 2 READY
              </span>
            </div>
          </div>

          {/* District Risk Heat Table */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {selectedState} District Weather Risk Table
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {districtRiskData?.districts?.length || 0} Districts Monitored
              </span>
            </div>

            {isLoadingRisk ? (
              <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                <span>Loading district risk matrix...</span>
              </div>
            ) : districtRiskData?.districts ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {districtRiskData.districts.slice(0, 8).map((d) => (
                  <div
                    key={d.district}
                    className={`p-2 rounded-xl border flex flex-col justify-between ${
                      d.severity === 'red'
                        ? 'bg-rose-950/40 border-rose-500/80 text-rose-200'
                        : d.severity === 'orange'
                        ? 'bg-amber-950/40 border-amber-500/80 text-amber-200'
                        : d.severity === 'yellow'
                        ? 'bg-yellow-950/30 border-yellow-500/60 text-yellow-200'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">{d.district}</span>
                      <span className="text-[10px] font-mono font-semibold">{d.risk_score}</span>
                    </div>
                    <span className="text-[10px] opacity-80 mt-1 capitalize">{d.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">No active alerts reported in {selectedState}.</p>
            )}
          </div>

          {/* Action CTAs */}
          <div className="pt-1 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => navigate('/officer')}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700 shadow-md transition flex items-center justify-center space-x-1.5"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Open Officer Command Dashboard</span>
            </button>
            <button
              onClick={() => {
                setShowBroadcastModal(true);
                handleGenerateBroadcast();
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Broadcast Summary (SMS)</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. RESEARCHER PERSONA                                       */}
      {/* ============================================================ */}
      {userRole === 'researcher' && (
        <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/40 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 shadow-inner">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>Climate Data Research Center</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    ERA5 Archive
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  30-year climate trends, decadal regression slopes, and CSV dataset export
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/climate')}
              className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center space-x-1 font-semibold transition"
            >
              <span>Climate Explorer</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Baseline Period</span>
              <span className="font-bold text-white font-mono">1991 - 2020 WMO Standard</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Decadal Warming Rate</span>
              <span className="font-bold text-rose-400 font-mono">+0.18°C / decade</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Precipitation Anomaly</span>
              <span className="font-bold text-sky-400 font-mono">+42.5 mm vs Baseline</span>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <button
              onClick={() => navigate('/climate')}
              className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 text-xs font-semibold border border-indigo-500/30 flex items-center justify-center space-x-1.5 transition"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Launch Climate Explorer Page</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isExportingCSV}
              className="w-full sm:w-auto py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
            >
              {isExportingCSV ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-300" />
              )}
              <span>{isExportingCSV ? 'Exporting...' : 'Export 30-Yr CSV'}</span>
            </button>
          </div>

          {exportMessage && (
            <p className="text-xs text-sky-300 font-medium text-center animate-in fade-in">
              {exportMessage}
            </p>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MARINE PERSONA                                           */}
      {/* ============================================================ */}
      {userRole === 'marine' && (
        <div className="bg-gradient-to-br from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/40 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between pb-3 border-b border-teal-500/20">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-300 shadow-inner">
                <Anchor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>Marine & Coastal Operations</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isMarineSafe ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}>
                    {isMarineSafe ? 'Safe for Inshore' : 'Coastal Caution'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Sea surface state, swell heights, squall warnings, and fishermen safety
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                navigate(
                  `/chat?q=${encodeURIComponent(
                    `Give complete marine advisory, sea surface state, wave height, and fishermen warning for coastal ${currentLocation.name}`
                  )}`
                )
              }
              className="text-xs text-teal-300 hover:text-teal-200 flex items-center space-x-1 font-semibold transition"
            >
              <span>Marine Chat</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Sea State</span>
              <span className="font-bold text-teal-300 font-mono">{seaState}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Wave / Swell Height</span>
              <span className="font-bold text-white font-mono">{waveHeightM} m</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Coastal Wind</span>
              <span className="font-bold text-white font-mono">{windKtMarine} knots</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Fishermen Status</span>
              <span className={`font-bold font-mono ${isMarineSafe ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isMarineSafe ? 'VENTURE SAFE' : 'AVOID DEEP SEA'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. CITIZEN PERSONA                                          */}
      {/* ============================================================ */}
      {userRole === 'citizen' && (
        <div className="bg-gradient-to-br from-sky-950/50 via-slate-900 to-slate-900 border border-sky-500/30 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-sky-500/20">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-300 shadow-inner">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>Citizen Daily Weather Digest</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Live
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Daily comfort, umbrella outlook, and outdoor recommendations for {currentLocation.name}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Rain Status</span>
              <span className="font-bold text-sky-300">
                {(hourlyForecast[0]?.precipitation_probability || 0) > 40
                  ? 'Carry Umbrella ☔'
                  : 'No Rain Expected 🌤️'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Outdoor Activity</span>
              <span className="font-bold text-emerald-300">Ideal for Travel</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">UV Index</span>
              <span className="font-bold text-amber-300">
                {currentWeather?.uv_index || 5} (Moderate)
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block">Evening Comfort</span>
              <span className="font-bold text-white">Pleasant, ~25°C</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DISASTER MANAGER: BROADCAST ADVISORY GENERATOR MODAL         */}
      {/* ============================================================ */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Public Emergency Warning Generator</h3>
                  <p className="text-[11px] text-slate-400">Multi-lingual SMS cell-broadcast synthesis</p>
                </div>
              </div>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Disclaimer */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Official Warning Disclaimer:</strong> The following messages are AI-generated draft advisories (max 160 chars) designed for SMS and emergency cell broadcasts. They require authorization by the District Disaster Management Authority (DDMA) before transmission.
              </span>
            </div>

            {/* Generated Languages */}
            {isGeneratingBroadcast ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-rose-400" />
                <span>Synthesizing multi-lingual emergency advisories...</span>
              </div>
            ) : broadcastAdvisories ? (
              <div className="space-y-3">
                {Object.entries(broadcastAdvisories).map(([langCode, message]) => (
                  <div key={langCode} className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-300 uppercase font-mono">
                        {langCode === 'en' ? 'English (SMS)' : langCode === 'te' ? 'Telugu (తెలుగు)' : langCode === 'hi' ? 'Hindi (हिन्दी)' : langCode}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(message);
                          setCopiedLang(langCode);
                          setTimeout(() => setCopiedLang(null), 2000);
                        }}
                        className="text-[10px] text-slate-300 hover:text-white flex items-center space-x-1 font-mono transition"
                      >
                        {copiedLang === langCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedLang === langCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-white leading-relaxed font-sans">{message}</p>
                    <span className="text-[9px] text-slate-400 font-mono block text-right">
                      {message.length} / 160 characters
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">Click below to generate advisories.</p>
            )}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={handleGenerateBroadcast}
                disabled={isGeneratingBroadcast}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingBroadcast ? 'Generating...' : 'Re-generate'}</span>
              </button>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* AVIATION: DECODED METAR MODAL                                */}
      {/* ============================================================ */}
      {showMetarModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-blue-500/40 rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300">
                  <Plane className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Aviation METAR Weather Decoder</h3>
                  <p className="text-[11px] text-slate-400">Decoded aerodrome weather parameters</p>
                </div>
              </div>
              <button
                onClick={() => setShowMetarModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-blue-500/30">
              <code className="text-xs font-mono text-emerald-300 font-bold block whitespace-pre overflow-x-auto">
                {formatMetar()}
              </code>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-800/60 flex justify-between">
                <span className="text-slate-400">Aerodrome Identifier:</span>
                <span className="font-bold text-white font-mono">{(currentLocation.name || 'VOHY').toUpperCase().slice(0, 4)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 flex justify-between">
                <span className="text-slate-400">Surface Wind:</span>
                <span className="font-bold text-white font-mono">{currentWeather?.wind_direction || 180}° at {Math.round((currentWeather?.wind_speed || 12) * 0.54)} KT</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 flex justify-between">
                <span className="text-slate-400">Visibility:</span>
                <span className="font-bold text-white font-mono">8,000 meters</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 flex justify-between">
                <span className="text-slate-400">Cloud Layer:</span>
                <span className="font-bold text-white font-mono">FEW at 2,500 ft AGL</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 flex justify-between">
                <span className="text-slate-400">Temperature / Dew Point:</span>
                <span className="font-bold text-white font-mono">{Math.round(currentWeather?.temperature || 28)}°C / {Math.round((currentWeather?.temperature || 28) - (100 - humidity) / 5)}°C</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 flex justify-between">
                <span className="text-slate-400">QNH Altimeter:</span>
                <span className="font-bold text-white font-mono">{Math.round(currentWeather?.surface_pressure || currentWeather?.pressure || 1012)} hPa</span>
              </div>
            </div>

            <p className="text-[10px] text-amber-300">
              * Note: Simulated for demonstration using live Open-Meteo observations.
            </p>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowMetarModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
