import React, { useState, useEffect } from 'react';
import {
  Sprout,
  Plane,
  Anchor,
  HeartPulse,
  Building2,
  Droplets,
  Wind,
  Sun,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Gauge,
  Thermometer,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWeather } from '../context/WeatherContext';
import api from '../services/api';

const SECTOR_TABS = [
  { id: 'agriculture', label: 'Agriculture', icon: Sprout, color: 'text-emerald-400', activeBg: 'bg-emerald-500/20 border-emerald-500/50' },
  { id: 'aviation', label: 'Aviation', icon: Plane, color: 'text-sky-400', activeBg: 'bg-sky-500/20 border-sky-500/50' },
  { id: 'marine', label: 'Marine', icon: Anchor, color: 'text-teal-400', activeBg: 'bg-teal-500/20 border-teal-500/50' },
  { id: 'health', label: 'Health', icon: HeartPulse, color: 'text-rose-400', activeBg: 'bg-rose-500/20 border-rose-500/50' },
  { id: 'urban', label: 'Smart City', icon: Building2, color: 'text-amber-400', activeBg: 'bg-amber-500/20 border-amber-500/50' },
];

const CROPS = [
  { id: 'cotton', name: 'Cotton', icon: '☁️', telugu: 'పత్తి', hindi: 'कपास' },
  { id: 'rice', name: 'Rice / Paddy', icon: '🌾', telugu: 'వరి', hindi: 'धान' },
  { id: 'groundnut', name: 'Groundnut', icon: '🥜', telugu: 'వేరుశనగ', hindi: 'मूंगफली' },
  { id: 'chilli', name: 'Chilli', icon: '🌶️', telugu: 'మిరప', hindi: 'मिर्च' },
  { id: 'maize', name: 'Maize', icon: '🌽', telugu: 'మొక్కజొన్న', hindi: 'मक्का' },
  { id: 'wheat', name: 'Wheat', icon: '🌾', telugu: 'గోధుమ', hindi: 'गेहूं' },
  { id: 'sugarcane', name: 'Sugarcane', icon: '🎋', telugu: 'చెరకు', hindi: 'गन्ना' },
  { id: 'tomato', name: 'Tomato', icon: '🍅', telugu: 'టమాటా', hindi: 'टमाटर' },
];

const ROLES = [
  { id: 'farmer', label: 'Farmer', defaultSector: 'agriculture' },
  { id: 'pilot', label: 'Aviator', defaultSector: 'aviation' },
  { id: 'fisherman', label: 'Fisherman', defaultSector: 'marine' },
  { id: 'public', label: 'Citizen', defaultSector: 'health' },
  { id: 'urban_planner', label: 'Urban Admin', defaultSector: 'urban' },
];

export default function Advisory() {
  const { t } = useTranslation();
  const { currentLocation, selectedLanguage } = useWeather();

  const [activeSector, setActiveSector] = useState('agriculture');
  const [selectedCrop, setSelectedCrop] = useState('cotton');
  const [selectedRole, setSelectedRole] = useState('farmer');
  const [advisoryData, setAdvisoryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedMetar, setCopiedMetar] = useState(false);

  const fetchAdvisory = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAdvisory({
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        type: activeSector,
        crop: selectedCrop,
        role: selectedRole,
        lang: selectedLanguage || 'en',
        place: currentLocation.name,
      });
      if (res && res.advisory) {
        setAdvisoryData(res.advisory);
      }
    } catch (e) {
      console.error('Failed to load advisory:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisory();
  }, [currentLocation, activeSector, selectedCrop, selectedRole, selectedLanguage]);

  const handleRoleChange = (roleObj) => {
    setSelectedRole(roleObj.id);
    setActiveSector(roleObj.defaultSector);
  };

  const handleCopyMetar = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedMetar(true);
      setTimeout(() => setCopiedMetar(false), 2000);
    }
  };

  return (
    <div className="space-y-4 pb-24 pt-1 max-w-md mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center space-x-2">
            <span>Sector Advisories</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">IMD Agro-Meteorological & NWP Guidance</p>
        </div>

        <button
          onClick={fetchAdvisory}
          disabled={isLoading}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700/60 shadow transition"
          title="Refresh advisory data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Role Picker (Role-based defaults) */}
      <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-2.5 shadow-md space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Select Role Profile:
          </span>
          <span className="text-[10px] font-bold text-sky-400">
            {ROLES.find((r) => r.id === selectedRole)?.label} Default Active
          </span>
        </div>
        <div className="flex space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleChange(role)}
              className={`text-[11px] px-2.5 py-1 rounded-xl border transition font-semibold flex-shrink-0 ${
                selectedRole === role.id
                  ? 'bg-sky-500 text-white border-sky-400 shadow-md'
                  : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sector Navigation Tabs */}
      <div className="flex space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
        {SECTOR_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSector === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSector(tab.id)}
              className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-2xl border transition font-bold flex-shrink-0 ${
                isActive
                  ? `${tab.activeBg} text-white shadow-lg`
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Crop Picker (Shown when Agriculture sector is active) */}
      {activeSector === 'agriculture' && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 p-3 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center space-x-1">
              <Sprout className="w-3.5 h-3.5" />
              <span>Target Crop Selector</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              8 IMD-Monitored Crops
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {CROPS.map((c) => {
              const isSelected = selectedCrop === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCrop(c.id)}
                  className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-0.5 ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="text-[10px] truncate max-w-full font-semibold">{c.name.split(' ')[0]}</span>
                  <span className="text-[8px] text-slate-500 truncate max-w-full">
                    {selectedLanguage === 'te' ? c.telugu : selectedLanguage === 'hi' ? c.hindi : c.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Advisory Content Display */}
      {isLoading ? (
        <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
          <Sparkles className="w-6 h-6 text-sky-400 animate-spin" />
          <span>Generating dated, data-backed IMD advisory...</span>
        </div>
      ) : advisoryData ? (
        <div className="space-y-3 animate-in fade-in duration-300">
          {/* SECTOR SPECIFIC VISUAL CARDS */}

          {/* 1. AGRICULTURE CARDS */}
          {activeSector === 'agriculture' && (
            <>
              {/* Spraying Window Card */}
              <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-700/50">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-xl bg-sky-500/20 text-sky-400">
                      <Droplets className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        Chemical Spraying Schedule
                      </h3>
                      <p className="text-[10px] text-slate-400">Pesticide / Foliar Application Window</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/30">
                    {advisoryData.crop_display_name}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800">
                  {advisoryData.spraying?.advice}
                </p>

                {/* Spray Windows Pills */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Day-by-Day Spraying Suitability:
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {advisoryData.spraying?.favorable_windows?.length > 0 ? (
                      advisoryData.spraying.favorable_windows.map((w, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="font-bold text-emerald-200">{w.day}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-emerald-300 font-mono">
                            <span>Rain: {w.rain_mm} mm</span>
                            <span>•</span>
                            <span>Wind: {w.wind_kmh} km/h</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>No zero-rain spraying windows this week due to continuous precipitation/wind.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Irrigation & Soil Moisture Card */}
              <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 p-4 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-700/50">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-xl bg-teal-500/20 text-teal-400">
                      <Gauge className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        Irrigation Guidance
                      </h3>
                      <p className="text-[10px] text-slate-400">Water Management & Runoff</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                      advisoryData.irrigation?.status === 'HOLD / POSTPONE'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {advisoryData.irrigation?.status}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800">
                  {advisoryData.irrigation?.advice}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>72h Rain Accumulation: <b className="text-white">{advisoryData.metrics?.first_3d_rain_mm} mm</b></span>
                  <span>7-Day Total: <b className="text-white">{advisoryData.metrics?.total_7d_rain_mm} mm</b></span>
                </div>
              </div>

              {/* Pest & Heat Stress Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Pest Risk */}
                <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 p-3 shadow-md space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Pest / Disease</span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        advisoryData.pest_risk?.level === 'HIGH'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {advisoryData.pest_risk?.level}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {advisoryData.pest_risk?.advice}
                  </p>
                </div>

                {/* Heat Stress */}
                <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 p-3 shadow-md space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Heat Stress</span>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-orange-500 text-white">
                      {advisoryData.heat_stress?.level}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {advisoryData.heat_stress?.advice}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* 2. AVIATION METAR CARD */}
          {activeSector === 'aviation' && (
            <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-700/50">
                <div className="flex items-center space-x-2">
                  <Plane className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Aviation METAR Briefing
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  {advisoryData.flight_rules} Conditions
                </span>
              </div>

              {/* Raw METAR String Block with Copy Button */}
              <div className="rounded-2xl bg-black/60 border border-slate-700 p-3 relative font-mono text-xs text-emerald-400">
                <div className="flex items-start justify-between">
                  <span className="break-all">{advisoryData.metar}</span>
                  <button
                    onClick={() => handleCopyMetar(advisoryData.metar)}
                    className="ml-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex-shrink-0"
                    title="Copy METAR string"
                  >
                    {copiedMetar ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Flight Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Wind (AGL)</p>
                  <p className="font-bold text-white mt-0.5">
                    {advisoryData.metrics?.wind_direction_deg}° @ {advisoryData.metrics?.wind_speed_kt} KT
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Visibility</p>
                  <p className="font-bold text-white mt-0.5">
                    {advisoryData.metrics?.visibility_meters} m
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Cloud Base</p>
                  <p className="font-bold text-white mt-0.5">
                    ~{advisoryData.metrics?.cloud_base_feet} ft
                  </p>
                </div>
              </div>

              {/* Turbulence & Convective Note */}
              <div className="p-2.5 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-300 space-y-1">
                <span className="font-bold text-amber-300 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Turbulence / Thunderstorm Risk: {advisoryData.thunderstorm_turbulence_risk?.level}</span>
                </span>
                <p className="text-[11px] text-slate-300">
                  {advisoryData.thunderstorm_turbulence_risk?.briefing}
                </p>
              </div>
            </div>
          )}

          {/* 3. MARINE & FISHERMEN CARD */}
          {activeSector === 'marine' && (
            <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-700/50">
                <div className="flex items-center space-x-2">
                  <Anchor className="w-4 h-4 text-teal-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Fishermen & Coastal Sea Guidance
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    advisoryData.badge_color === 'red'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : advisoryData.badge_color === 'yellow'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  }`}
                >
                  {advisoryData.status}
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                {advisoryData.advisory_bulletin}
              </p>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Wave Height</p>
                  <p className="font-bold text-teal-300 mt-0.5">
                    ~{advisoryData.metrics?.wave_height_proxy_m} m
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Current Wind</p>
                  <p className="font-bold text-white mt-0.5">
                    {advisoryData.metrics?.current_wind_kmh} km/h
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Peak Gust (3d)</p>
                  <p className="font-bold text-white mt-0.5">
                    {advisoryData.metrics?.peak_gust_3d_kmh} km/h
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4. HEALTH & TRAVEL CARD */}
          {activeSector === 'health' && (
            <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-700/50">
                <div className="flex items-center space-x-2">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Health & Travel Heat Index
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {advisoryData.heat_risk} Risk
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Apparent Heat Index</p>
                  <p className="text-lg font-black text-white mt-0.5">
                    {advisoryData.metrics?.heat_index_c}°C
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Air Quality</p>
                  <p className="text-lg font-black text-sky-300 mt-0.5">
                    AQI {advisoryData.metrics?.aqi}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
                <span className="font-bold text-rose-300 block">Hydration Guidance:</span>
                <p className="text-slate-200">{advisoryData.hydration_tips}</p>
                <span className="font-bold text-sky-300 block pt-1">Travel Advice:</span>
                <p className="text-slate-200">{advisoryData.travel_guidance}</p>
              </div>
            </div>
          )}

          {/* 5. SMART CITY & URBAN FLOOD CARD */}
          {activeSector === 'urban' && (
            <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-700/50">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Urban Inundation & Traffic
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {advisoryData.waterlogging_risk} Risk
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                {advisoryData.traffic_impact}
              </p>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">24h Rainfall Expected</p>
                  <p className="font-bold text-white mt-0.5">
                    {advisoryData.metrics?.expected_24h_rain_mm} mm
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-700/50">
                  <p className="text-[10px] text-slate-400">Peak Hourly Intensity</p>
                  <p className="font-bold text-amber-300 mt-0.5">
                    {advisoryData.metrics?.peak_hourly_rate_mm_h} mm/h
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* FULL IMD NARRATIVE BULLETIN */}
          {advisoryData.narrative && (
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 p-4 shadow-xl space-y-2">
              <div className="flex items-center space-x-2 pb-1 border-b border-slate-700/50">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Official IMD Advisory Narrative ({advisoryData.location})
                </h3>
              </div>
              <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-sans bg-slate-950/40 p-3 rounded-2xl border border-slate-800">
                {advisoryData.narrative}
              </div>
              <p className="text-[10px] text-slate-400 text-right">
                Generated: {new Date(advisoryData.generated_at).toLocaleString()} • {advisoryData.source}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 text-xs">
          No advisory data available for this location.
        </div>
      )}
    </div>
  );
}
