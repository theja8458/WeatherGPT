import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart as LineChartIcon,
  BarChart3,
  TrendingUp,
  TrendingDown,
  CloudRain,
  Thermometer,
  Flame,
  Download,
  Calendar,
  Layers,
  MapPin,
  ChevronDown,
  Info,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useWeather } from '../context/WeatherContext';
import api from '../services/api';

const PERIOD_OPTIONS = [
  { id: '10', label: '10 Years', from: 2014, to: 2023 },
  { id: '20', label: '20 Years', from: 2004, to: 2023 },
  { id: '30', label: '30 Years', from: 1994, to: 2023 },
];

const METRIC_TABS = [
  { id: 'rainfall', label: 'Rainfall Trends', icon: CloudRain, color: 'text-sky-400' },
  { id: 'temperature', label: 'Temperature', icon: Thermometer, color: 'text-amber-400' },
  { id: 'extremes', label: 'Extreme Days', icon: Flame, color: 'text-rose-400' },
  { id: 'heatmap', label: 'Monthly Heatmap', icon: Layers, color: 'text-emerald-400' },
];

const PRESET_DISTRICTS = [
  { name: 'Anantapur', state: 'Andhra Pradesh', lat: 14.6819, lon: 77.6006 },
  { name: 'Kurnool', state: 'Andhra Pradesh', lat: 15.8281, lon: 78.0373 },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lon: 78.4867 },
  { name: 'New Delhi', state: 'Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lon: 72.8777 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707 },
  { name: 'Vijayawada', state: 'Andhra Pradesh', lat: 16.5062, lon: 80.648 },
];

export default function Climate() {
  const { currentLocation, setCurrentLocation } = useWeather();

  const [period, setPeriod] = useState(PERIOD_OPTIONS[1]); // Default: 20 Years (2004-2023)
  const [activeTab, setActiveTab] = useState('rainfall');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Comparison State
  const [isComparing, setIsComparing] = useState(false);
  const [compareLocation, setCompareLocation] = useState(PRESET_DISTRICTS[0]); // Anantapur default comparison

  // Anomaly heatmap metric toggle: 'rainfall' or 'temperature'
  const [heatmapMetric, setHeatmapMetric] = useState('rainfall');
  const [hoveredCell, setHoveredCell] = useState(null);

  // Fetch Climate Trends
  const fetchTrends = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getClimateTrends({
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        from: period.from,
        to: period.to,
        place: `${currentLocation.name}, ${currentLocation.state || ''}`,
        compareLat: isComparing && compareLocation ? compareLocation.lat : undefined,
        compareLon: isComparing && compareLocation ? compareLocation.lon : undefined,
        compareName: isComparing && compareLocation ? `${compareLocation.name}, ${compareLocation.state}` : undefined,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load climate trends:', err);
      setError('Could not retrieve historical climate data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [currentLocation.lat, currentLocation.lon, period.id, isComparing, compareLocation?.name]);

  // Export CSV Handler
  const handleDownloadCSV = () => {
    if (!data?.primary?.yearly_series) return;
    const series = data.primary.yearly_series;
    const headers = [
      'Year',
      'Average_Temperature_C',
      'Temperature_Trend_C',
      'Temp_Anomaly_C',
      'Total_Rainfall_mm',
      'Rainfall_Trend_mm',
      'Rain_Anomaly_mm',
      'Heatwave_Days_gt_40C',
      'Heavy_Rain_Days_gte_64_5mm',
    ];

    const rows = series.map((row) => [
      row.year,
      row.temperature,
      row.temp_trend,
      row.temp_anomaly,
      row.rainfall,
      row.rain_trend,
      row.rain_anomaly,
      row.extreme_heat_days,
      row.heavy_rain_days,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `WeatherGPT_Climate_Trends_${currentLocation.name}_${period.from}_${period.to}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const primary = data?.primary;
  const comparison = data?.comparison;
  const trends = primary?.trends;
  const baseline = primary?.baseline;
  const extremes = primary?.extremes;

  // Custom Recharts Tooltip
  const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
          <p className="font-bold text-white mb-1">Year: {label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center space-x-2 text-[11px]" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-300">{entry.name}:</span>
              <span className="font-semibold font-mono">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 px-3 pt-3 max-w-2xl mx-auto space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center space-x-1.5">
                <span>Climate Trends & Analytics</span>
                <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  MoES / IMD
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Historical climate decadal slopes, anomaly heatmaps & extreme counts
              </p>
            </div>
          </div>

          {/* Download CSV Button */}
          <button
            onClick={handleDownloadCSV}
            disabled={!primary}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-sky-300 shadow-sm transition disabled:opacity-50"
            title="Download full historical dataset as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
            <span>CSV</span>
          </button>
        </div>

        {/* Location & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 p-2 rounded-2xl">
          {/* Active Location Picker */}
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <select
              value={currentLocation.name}
              onChange={(e) => {
                const found = PRESET_DISTRICTS.find((d) => d.name === e.target.value);
                if (found) setCurrentLocation(found);
              }}
              className="bg-slate-800 text-xs text-white rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:border-sky-500 font-medium"
            >
              {PRESET_DISTRICTS.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}, {d.state}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector (10, 20, 30 Years) */}
          <div className="flex items-center space-x-1 bg-slate-800/90 p-0.5 rounded-xl border border-slate-700/60">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt)}
                className={`text-[11px] px-2.5 py-0.5 rounded-lg font-medium transition ${
                  period.id === opt.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Comparison Mode Toggle */}
          <button
            onClick={() => setIsComparing(!isComparing)}
            className={`flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-xl border transition ${
              isComparing
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-3 h-3" />
            <span>Compare</span>
          </button>
        </div>

        {/* Comparison Location Selector (When enabled) */}
        {isComparing && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
            <span className="text-amber-300 font-medium">Compare with district:</span>
            <select
              value={compareLocation.name}
              onChange={(e) => {
                const found = PRESET_DISTRICTS.find((d) => d.name === e.target.value);
                if (found) setCompareLocation(found);
              }}
              className="bg-slate-900 text-white rounded-lg px-2 py-1 border border-amber-500/40 focus:outline-none"
            >
              {PRESET_DISTRICTS.filter((d) => d.name !== currentLocation.name).map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}, {d.state}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-slate-900/60 rounded-3xl border border-slate-800">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading {period.label} of historical climate observations...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : primary ? (
        <>
          {/* Key Metric Highlights Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Baseline Annual Rainfall */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Mean Annual Rain</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {baseline?.mean_rainfall_mm} <span className="text-xs font-normal text-slate-400">mm</span>
              </p>
              <div className="flex items-center space-x-1 text-[10px] mt-1 text-sky-400">
                <CloudRain className="w-3 h-3" />
                <span>Normal baseline</span>
              </div>
            </div>

            {/* Rainfall Decadal Trend */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Rainfall Rate</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {trends?.rainfall?.slope_per_decade_mm > 0 ? '+' : ''}
                {trends?.rainfall?.slope_per_decade_mm}
                <span className="text-xs font-normal text-slate-400"> mm/dec</span>
              </p>
              <div
                className={`flex items-center space-x-1 text-[10px] mt-1 font-semibold ${
                  trends?.rainfall?.slope_per_decade_mm >= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {trends?.rainfall?.slope_per_decade_mm >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{trends?.rainfall?.direction}</span>
              </div>
            </div>

            {/* Baseline Temperature */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Mean Annual Temp</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {baseline?.mean_temperature_c} <span className="text-xs font-normal text-slate-400">°C</span>
              </p>
              <div className="flex items-center space-x-1 text-[10px] mt-1 text-amber-400">
                <Thermometer className="w-3 h-3" />
                <span>Thermal baseline</span>
              </div>
            </div>

            {/* Temperature Decadal Trend */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Warming Rate</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {trends?.temperature?.slope_per_decade_c > 0 ? '+' : ''}
                {trends?.temperature?.slope_per_decade_c}
                <span className="text-xs font-normal text-slate-400"> °C/dec</span>
              </p>
              <div className="flex items-center space-x-1 text-[10px] mt-1 font-semibold text-rose-400">
                <Flame className="w-3 h-3" />
                <span>{trends?.temperature?.direction}</span>
              </div>
            </div>
          </div>

          {/* Sector / Metric Navigation Tabs */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none">
            {METRIC_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex-1 justify-center ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main Visualizer Area */}
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800/90 shadow-xl space-y-4">
            {/* 1. RAINFALL TAB */}
            {activeTab === 'rainfall' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <h3 className="font-bold text-white">Annual Precipitation & 30-Year Trend</h3>
                    <p className="text-[10px] text-slate-400">
                      Total precipitation (mm) with decadal linear regression slope
                    </p>
                  </div>
                  <span className="text-[10px] text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                    R² = {trends?.rainfall?.r_squared}
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={primary.yearly_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <ReferenceLine
                        y={baseline?.mean_rainfall_mm}
                        label={{ value: `Normal (${baseline?.mean_rainfall_mm}mm)`, fill: '#38bdf8', fontSize: 10 }}
                        stroke="#0284c7"
                        strokeDasharray="4 4"
                      />
                      <Bar dataKey="rainfall" name="Annual Rainfall (mm)" fill="#0ea5e9" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Line
                        type="monotone"
                        dataKey="rain_trend"
                        name="Trend Line (mm)"
                        stroke="#34d399"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Anomaly summary footer */}
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-300 flex items-center justify-between">
                  <span>
                    Highest Rainfall: <strong className="text-white">
                      {Math.max(...primary.yearly_series.map((y) => y.rainfall))} mm
                    </strong>
                  </span>
                  <span>
                    Lowest Rainfall: <strong className="text-white">
                      {Math.min(...primary.yearly_series.map((y) => y.rainfall))} mm
                    </strong>
                  </span>
                </div>
              </div>
            )}

            {/* 2. TEMPERATURE TAB */}
            {activeTab === 'temperature' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <h3 className="font-bold text-white">Mean Temperature & Warming Trend</h3>
                    <p className="text-[10px] text-slate-400">
                      Annual mean temperature (°C) with decadal linear slope
                    </p>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                    R² = {trends?.temperature?.r_squared}
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={primary.yearly_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <ReferenceLine
                        y={baseline?.mean_temperature_c}
                        label={{ value: `Normal (${baseline?.mean_temperature_c}°C)`, fill: '#f59e0b', fontSize: 10 }}
                        stroke="#d97706"
                        strokeDasharray="4 4"
                      />
                      <Area
                        type="monotone"
                        dataKey="temperature"
                        name="Mean Temp (°C)"
                        fill="#f59e0b"
                        fillOpacity={0.2}
                        stroke="#f59e0b"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="temp_trend"
                        name="Trend Line (°C)"
                        stroke="#f43f5e"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 3. EXTREMES TAB */}
            {activeTab === 'extremes' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <h3 className="font-bold text-white">Extreme Weather Events per Year</h3>
                    <p className="text-[10px] text-slate-400">
                      Heatwave days (&gt;40°C) vs Heavy rainfall days (≥64.5 mm)
                    </p>
                  </div>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    IMD Thresholds
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={primary.yearly_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="extreme_heat_days" name="Heatwave Days (>40°C)" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="heavy_rain_days" name="Heavy Rain Days (≥64.5mm)" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                    Average Heatwave Days: <strong>{extremes?.avg_heatwave_days_per_year} days/year</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                    Average Heavy Rain Days: <strong>{extremes?.avg_heavy_rain_days_per_year} days/year</strong>
                  </div>
                </div>
              </div>
            )}

            {/* 4. MONTHLY ANOMALY HEATMAP */}
            {activeTab === 'heatmap' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <h3 className="font-bold text-white">Monthly Anomaly Matrix</h3>
                    <p className="text-[10px] text-slate-400">
                      Deviation from 30-year climatological normal by month
                    </p>
                  </div>
                  <div className="flex items-center space-x-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                    <button
                      onClick={() => setHeatmapMetric('rainfall')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        heatmapMetric === 'rainfall' ? 'bg-sky-500 text-white' : 'text-slate-400'
                      }`}
                    >
                      Rain (mm)
                    </button>
                    <button
                      onClick={() => setHeatmapMetric('temperature')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        heatmapMetric === 'temperature' ? 'bg-amber-500 text-white' : 'text-slate-400'
                      }`}
                    >
                      Temp (°C)
                    </button>
                  </div>
                </div>

                {/* Heatmap Grid */}
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[480px]">
                    {/* Month Header */}
                    <div className="grid grid-cols-13 gap-1 text-[10px] text-slate-400 font-bold mb-1 text-center">
                      <div className="text-left pl-1">Year</div>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                        <div key={m}>{m}</div>
                      ))}
                    </div>

                    {/* Matrix Rows */}
                    <div className="space-y-1">
                      {primary.anomaly_heatmap.map((row) => (
                        <div key={row.year} className="grid grid-cols-13 gap-1 items-center">
                          <div className="text-[10px] font-mono text-slate-300 pl-1">{row.year}</div>
                          {row.months.map((m) => {
                            const val = heatmapMetric === 'rainfall' ? m.rain_anomaly : m.temp_anomaly;
                            let bgColor = 'bg-slate-800 text-slate-400';

                            if (heatmapMetric === 'rainfall') {
                              if (val > 40) bgColor = 'bg-sky-600 text-white font-bold';
                              else if (val > 10) bgColor = 'bg-sky-500/60 text-sky-100';
                              else if (val >= -10) bgColor = 'bg-slate-800 text-slate-400';
                              else if (val >= -40) bgColor = 'bg-amber-600/60 text-amber-100';
                              else bgColor = 'bg-rose-700 text-white font-bold';
                            } else {
                              if (val > 1.2) bgColor = 'bg-rose-600 text-white font-bold';
                              else if (val > 0.4) bgColor = 'bg-amber-500/70 text-white';
                              else if (val >= -0.4) bgColor = 'bg-slate-800 text-slate-400';
                              else if (val >= -1.2) bgColor = 'bg-teal-500/60 text-teal-100';
                              else bgColor = 'bg-sky-700 text-white font-bold';
                            }

                            return (
                              <div
                                key={m.month}
                                onMouseEnter={() => setHoveredCell({ year: row.year, ...m })}
                                onMouseLeave={() => setHoveredCell(null)}
                                className={`h-6 rounded flex items-center justify-center text-[9px] cursor-pointer transition transform hover:scale-110 shadow-sm ${bgColor}`}
                              >
                                {val > 0 ? `+${Math.round(val)}` : Math.round(val)}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Heatmap Tooltip / Active Inspection Bar */}
                <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs flex items-center justify-between min-h-[36px]">
                  {hoveredCell ? (
                    <div className="flex items-center space-x-2 text-[11px]">
                      <span className="font-bold text-white">
                        {hoveredCell.month_name} {hoveredCell.year}:
                      </span>
                      <span className="text-sky-300">
                        Rain: {hoveredCell.actual_rain}mm (Anomaly: {hoveredCell.rain_anomaly > 0 ? '+' : ''}{hoveredCell.rain_anomaly}mm)
                      </span>
                      <span className="text-amber-300">
                        Temp: {hoveredCell.actual_temp}°C (Anomaly: {hoveredCell.temp_anomaly > 0 ? '+' : ''}{hoveredCell.temp_anomaly}°C)
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Hover or tap on any monthly cell above to inspect exact anomaly and actual readings.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* LOCATION COMPARISON PANEL (When enabled) */}
          {isComparing && comparison && (
            <div className="p-4 rounded-3xl bg-amber-950/20 border border-amber-500/30 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                <ArrowRightLeft className="w-4 h-4" />
                <span>Location Comparison: {currentLocation.name} vs {compareLocation.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Column 1: Primary */}
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <p className="font-bold text-white border-b border-slate-800 pb-1">{currentLocation.name}</p>
                  <p className="text-[11px] text-slate-300">
                    Mean Rain: <strong className="text-sky-300">{baseline?.mean_rainfall_mm} mm</strong>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Rain Trend: <strong className="text-emerald-300">{trends?.rainfall?.slope_per_decade_mm} mm/dec</strong>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Mean Temp: <strong className="text-amber-300">{baseline?.mean_temperature_c}°C</strong>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Warming: <strong className="text-rose-300">{trends?.temperature?.slope_per_decade_c}°C/dec</strong>
                  </p>
                </div>

                {/* Column 2: Compare */}
                <div className="p-3 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-2">
                  <p className="font-bold text-amber-300 border-b border-slate-800 pb-1">{compareLocation.name}</p>
                  <p className="text-[11px] text-slate-300">
                    Mean Rain: <strong className="text-sky-300">{comparison.baseline?.mean_rainfall_mm} mm</strong>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Rain Trend: <strong className="text-emerald-300">{comparison.trends?.rainfall?.slope_per_decade_mm} mm/dec</strong>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Mean Temp: <strong className="text-amber-300">{comparison.baseline?.mean_temperature_c}°C</strong>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Warming: <strong className="text-rose-300">{comparison.trends?.temperature?.slope_per_decade_c}°C/dec</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Plain Language AI Narrative (MoES & IMD) */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-lg space-y-2.5">
            <div className="flex items-center space-x-2 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>MoES & IMD Climatological Assessment</span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              {primary.narrative}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span className="font-semibold text-slate-300">Data Sources:</span>
              {primary.sources?.map((s, idx) => (
                <span key={idx} className="bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/60">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
