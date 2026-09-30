import React from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudDrizzle,
  Snowflake,
  Wind,
  Droplets,
  ShieldAlert,
  Sprout,
  Activity,
  Calendar,
  TrendingUp,
  TrendingDown,
  Flame,
  Thermometer,
} from 'lucide-react';
import { Link } from 'react-router-dom';

function getWeatherIcon(iconName) {
  switch (iconName) {
    case 'sun':
      return <Sun className="w-5 h-5 text-amber-400" />;
    case 'cloud-sun':
      return <Cloud className="w-5 h-5 text-sky-300" />;
    case 'cloud':
      return <Cloud className="w-5 h-5 text-slate-400" />;
    case 'cloud-rain':
    case 'cloud-rain-heavy':
      return <CloudRain className="w-5 h-5 text-sky-400" />;
    case 'cloud-drizzle':
      return <CloudDrizzle className="w-5 h-5 text-teal-300" />;
    case 'cloud-lightning':
      return <CloudLightning className="w-5 h-5 text-yellow-400" />;
    case 'snowflake':
      return <Snowflake className="w-5 h-5 text-blue-200" />;
    default:
      return <Cloud className="w-5 h-5 text-sky-400" />;
  }
}

export function CurrentWeatherCard({ data }) {
  if (!data) return null;
  return (
    <div className="my-2 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700/60 p-3.5 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
            Live Observation
          </span>
          <h4 className="text-sm font-bold text-white">{data.place_name || 'Current Location'}</h4>
        </div>
        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
          {getWeatherIcon(data.weather_icon)}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline justify-between">
        <div>
          <span className="text-3xl font-extrabold text-white">{Math.round(data.temperature)}°C</span>
          <span className="text-xs text-slate-400 ml-2">Feels {Math.round(data.feels_like)}°C</span>
        </div>
        <span className="text-xs font-medium text-slate-300 capitalize">{data.weather_description}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-700/50 text-[11px] text-slate-300">
        <div className="flex items-center space-x-1">
          <Droplets className="w-3.5 h-3.5 text-sky-400" />
          <span>{data.humidity}%</span>
        </div>
        <div className="flex items-center space-x-1">
          <Wind className="w-3.5 h-3.5 text-teal-400" />
          <span>{Math.round(data.wind_speed)} km/h</span>
        </div>
        <div className="flex items-center space-x-1">
          <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
          <span>{data.rain} mm</span>
        </div>
      </div>
    </div>
  );
}

export function TargetForecastCard({ targetDay, location, dayOffset }) {
  if (!targetDay) return null;
  const dayTitle = dayOffset === 1 ? 'Tomorrow' : dayOffset === 2 ? 'Day After Tomorrow' : 'Target Day';

  return (
    <div className="my-2 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-800 to-slate-900 border border-indigo-500/30 p-3.5 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-indigo-300 text-xs font-semibold">
          <Calendar className="w-3.5 h-3.5" />
          <span>{dayTitle} Forecast • {location}</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{targetDay.date}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-white">
            {Math.round(targetDay.temp_max)}° / <span className="text-slate-400 text-lg">{Math.round(targetDay.temp_min)}°C</span>
          </p>
          <p className="text-xs font-medium text-indigo-200 mt-0.5">{targetDay.weather_description}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-indigo-900/40 border border-indigo-500/30">
          {getWeatherIcon(targetDay.weather_icon)}
        </div>
      </div>

      {/* Rainfall probability bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-slate-300">Rain Probability</span>
          <span className="font-semibold text-sky-400">{targetDay.precipitation_probability_max}% ({targetDay.precipitation_sum} mm)</span>
        </div>
        <div className="w-full bg-slate-700/60 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              targetDay.precipitation_probability_max > 50
                ? 'bg-gradient-to-r from-sky-400 to-indigo-500'
                : 'bg-sky-400'
            }`}
            style={{ width: `${Math.max(5, targetDay.precipitation_probability_max)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function SevenDayStripCard({ forecast }) {
  if (!forecast || !forecast.length) return null;
  return (
    <div className="my-2 rounded-2xl bg-slate-800/80 border border-slate-700/60 p-3 shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300">7-Day Outlook</span>
        <span className="text-[10px] text-slate-400">Scroll for more →</span>
      </div>
      <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-thin">
        {forecast.map((day, idx) => (
          <div
            key={day.date || idx}
            className="flex-shrink-0 w-20 p-2 rounded-xl bg-slate-900/60 border border-slate-700/40 flex flex-col items-center text-center"
          >
            <span className="text-[10px] font-medium text-slate-400">
              {idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : day.date.slice(5)}
            </span>
            <div className="my-1.5">{getWeatherIcon(day.weather_icon)}</div>
            <span className="text-xs font-bold text-white">{Math.round(day.temp_max)}°</span>
            <span className="text-[10px] text-slate-400">{Math.round(day.temp_min)}°</span>
            <span className="text-[9px] text-sky-400 mt-1 font-semibold">{day.precipitation_probability_max}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AirQualityCard({ data }) {
  if (!data) return null;
  const aqi = data.aqi || 45;
  const badgeColor =
    aqi <= 50
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : aqi <= 100
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : aqi <= 150
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-red-500/20 text-red-400 border-red-500/30';

  return (
    <div className="my-2 rounded-2xl bg-slate-800/90 border border-slate-700/60 p-3.5 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white">Air Quality (AQI)</span>
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${badgeColor}`}>
          {data.category}
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <span className="text-3xl font-extrabold text-white">{aqi}</span>
          <span className="text-xs text-slate-400 ml-2">US AQI</span>
        </div>
        <div className="text-right text-[11px] text-slate-300 space-y-0.5">
          <p>PM2.5: <span className="font-semibold text-white">{data.pm2_5} µg/m³</span></p>
          <p>PM10: <span className="font-semibold text-white">{data.pm10} µg/m³</span></p>
        </div>
      </div>
    </div>
  );
}

export function CropAdvisoryCard({ crop, activity, weatherSummary }) {
  return (
    <div className="my-2 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-800 to-slate-900 border border-emerald-500/30 p-3.5 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-bold">
          <Sprout className="w-4 h-4" />
          <span>Farming Advisory: {crop}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
          MoES Agri
        </span>
      </div>
      <p className="text-xs text-slate-200 mt-2 font-medium">
        Activity: <span className="text-emerald-300 capitalize">{activity}</span>
      </p>
      <div className="mt-2 text-[11px] text-slate-300 bg-slate-900/60 rounded-xl p-2.5 border border-slate-700/40">
        💡 If rain probability exceeds 40%, postpone chemical spraying to prevent wash-off. Maintain drainage in black cotton soil.
      </div>
    </div>
  );
}

export function AlertBannerCard({ title, severity, description }) {
  const isRed = severity === 'red';
  const isOrange = severity === 'orange';
  const colorClass = isRed
    ? 'bg-red-500/20 border-red-500 text-red-200'
    : isOrange
    ? 'bg-amber-500/20 border-amber-500 text-amber-200'
    : 'bg-yellow-500/20 border-yellow-500 text-yellow-200';

  return (
    <div className={`my-2 rounded-2xl border p-3.5 shadow-lg ${colorClass}`}>
      <div className="flex items-center space-x-2">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 animate-bounce" />
        <h4 className="text-xs font-bold uppercase tracking-wide">{title}</h4>
      </div>
      <p className="text-xs mt-1.5 leading-relaxed">{description}</p>
    </div>
  );
}

export function ClimateTrendsCard({ card }) {
  if (!card) return null;
  const { location, from_year, to_year, years, trends, baseline, extremes } = card;
  const rainTrend = trends?.rainfall;
  const tempTrend = trends?.temperature;

  return (
    <div className="my-2 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/40 p-3.5 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide">
              {years}-Year Climate Analysis
            </h4>
            <p className="text-[10px] text-indigo-300">
              {location} ({from_year}–{to_year})
            </p>
          </div>
        </div>
        <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          MoES IMD
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {/* Rainfall Trend Box */}
        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center space-x-1 text-sky-400 text-[10px] font-semibold">
            <CloudRain className="w-3.5 h-3.5" />
            <span>Rainfall Trend</span>
          </div>
          <p className="text-sm font-bold text-white mt-1">
            {rainTrend?.slope_per_decade_mm > 0 ? '+' : ''}{rainTrend?.slope_per_decade_mm} mm
            <span className="text-[10px] font-normal text-slate-400"> / decade</span>
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">
            Baseline: <span className="font-semibold text-sky-300">{baseline?.mean_rainfall_mm} mm/yr</span>
          </p>
        </div>

        {/* Temperature Trend Box */}
        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center space-x-1 text-amber-400 text-[10px] font-semibold">
            <Thermometer className="w-3.5 h-3.5" />
            <span>Thermal Trend</span>
          </div>
          <p className="text-sm font-bold text-white mt-1">
            {tempTrend?.slope_per_decade_c > 0 ? '+' : ''}{tempTrend?.slope_per_decade_c}°C
            <span className="text-[10px] font-normal text-slate-400"> / decade</span>
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">
            Mean Temp: <span className="font-semibold text-amber-300">{baseline?.mean_temperature_c}°C</span>
          </p>
        </div>
      </div>

      {/* Extremes footer */}
      {extremes && (
        <div className="flex items-center justify-between text-[10px] text-slate-300 mt-2.5 pt-2 border-t border-slate-800/80 px-1">
          <div className="flex items-center space-x-1">
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Heatwave (&gt;40°C): <strong className="text-white">{extremes.avg_heatwave_days_per_year} d/yr</strong></span>
          </div>
          <div className="flex items-center space-x-1">
            <CloudRain className="w-3 h-3 text-indigo-400" />
            <span>Heavy Rain: <strong className="text-white">{extremes.avg_heavy_rain_days_per_year} d/yr</strong></span>
          </div>
        </div>
      )}

      {/* Direct link to Full Climate Page */}
      <Link
        to="/climate"
        className="mt-3 block text-center py-1.5 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-semibold transition"
      >
        View Full 30-Year Trend Charts & Heatmap →
      </Link>
    </div>
  );
}

export default function RenderDataCard({ card }) {
  if (!card) return null;
  switch (card.card_type) {
    case 'current_weather':
      return <CurrentWeatherCard data={card.data} />;
    case 'target_forecast':
      return (
        <TargetForecastCard
          targetDay={card.target_day}
          location={card.location}
          dayOffset={card.day_offset}
        />
      );
    case '7day_forecast_strip':
      return <SevenDayStripCard forecast={card.forecast} />;
    case 'air_quality':
      return <AirQualityCard data={card.data} />;
    case 'crop_advisory':
      return (
        <CropAdvisoryCard
          crop={card.crop}
          activity={card.activity}
          weatherSummary={card.weather_summary}
        />
      );
    case 'climate_trends':
      return <ClimateTrendsCard card={card} />;
    case 'alert':
      return (
        <AlertBannerCard
          title={card.title}
          severity={card.severity}
          description={card.description}
        />
      );
    default:
      return null;
  }
}
