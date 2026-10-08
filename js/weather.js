// Wetter über Open-Meteo (kostenlos, ohne API-Schlüssel, CORS-fähig). https://open-meteo.com
import * as store from './store.js';

const WMO = {
  0: ['Klar', 'sun'], 1: ['Überwiegend klar', 'sun'], 2: ['Teilweise bewölkt', 'cloud-sun'], 3: ['Bedeckt', 'cloud'],
  45: ['Nebel', 'cloud-fog'], 48: ['Nebel mit Reif', 'cloud-fog'],
  51: ['Leichter Nieselregen', 'cloud-drizzle'], 53: ['Nieselregen', 'cloud-drizzle'], 55: ['Starker Nieselregen', 'cloud-drizzle'],
  56: ['Gefrierender Niesel', 'cloud-drizzle'], 57: ['Gefrierender Niesel', 'cloud-drizzle'],
  61: ['Leichter Regen', 'cloud-rain'], 63: ['Regen', 'cloud-rain'], 65: ['Starker Regen', 'cloud-rain'],
  66: ['Gefrierender Regen', 'cloud-rain'], 67: ['Gefrierender Regen', 'cloud-rain'],
  71: ['Leichter Schneefall', 'cloud-snow'], 73: ['Schneefall', 'cloud-snow'], 75: ['Starker Schneefall', 'cloud-snow'], 77: ['Schneegriesel', 'cloud-snow'],
  80: ['Regenschauer', 'cloud-rain'], 81: ['Regenschauer', 'cloud-rain'], 82: ['Heftige Schauer', 'cloud-rain'],
  85: ['Schneeschauer', 'cloud-snow'], 86: ['Schneeschauer', 'cloud-snow'],
  95: ['Gewitter', 'cloud-lightning'], 96: ['Gewitter mit Hagel', 'cloud-lightning'], 99: ['Gewitter mit Hagel', 'cloud-lightning'],
};
export const wmo = (code) => WMO[code] || ['Unbekannt', 'cloud'];

export async function getWeather(spot, { force = false } = {}) {
  const key = `weather:${spot.lat.toFixed(3)},${spot.lng.toFixed(3)}`;
  const cached = await store.get(key);
  const fresh = cached && Date.now() - cached.fetchedAt < 30 * 60 * 1000;
  if (cached && fresh && !force) return { ...cached, fromCache: true };
  const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: spot.lat, longitude: spot.lng,
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset',
    timezone: 'auto', forecast_days: '7', wind_speed_unit: 'kmh',
  });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const out = { data, fetchedAt: Date.now(), label: spot.label };
    await store.set(key, out);
    return out;
  } catch (e) {
    if (cached) return { ...cached, fromCache: true, stale: true, error: String(e.message || e) };
    throw e;
  }
}
