// Utility formatting helpers
export function formatTemperature(celsius) {
  if (celsius === undefined || celsius === null) return '--°C';
  return `${Math.round(celsius)}°C`;
}

export function formatWindSpeed(kmh) {
  if (kmh === undefined || kmh === null) return '-- km/h';
  return `${Math.round(kmh)} km/h`;
}

export function formatHumidity(percent) {
  if (percent === undefined || percent === null) return '--%';
  return `${Math.round(percent)}%`;
}
