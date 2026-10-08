// Allgemeine Hilfsfunktionen: HTML-Templates, Icons, Datum/Zeit, Links, Teilen.
import { ICONS } from './icons.js';

export const TZ = 'Europe/Zurich';

/* ---------- HTML ---------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s ?? ''));

/** Tagged template: escapes interpolations, unless raw() or arrays of raw. */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += render(vals[i]);
  });
  return raw(out);
}
function render(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}

export function icon(name, cls = '') {
  const inner = ICONS[name] || ICONS['circle'];
  return raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

/* ---------- Zeit ---------- */
// Die Reise liegt komplett in der Zeitzone UTC+02:00 (CEST: Schweiz, Deutschland, Spanien).
let simulatedNow = null;
export function setSimulatedNow(iso) { simulatedNow = iso ? new Date(iso) : null; }
export const now = () => (simulatedNow ? new Date(simulatedNow) : new Date());
export const isSimulated = () => !!simulatedNow;

export const at = (date, time) => new Date(`${date}T${time}:00+02:00`);

const fmtCache = {};
function fmt(opts) {
  const k = JSON.stringify(opts);
  return (fmtCache[k] ||= new Intl.DateTimeFormat('de-CH', { timeZone: TZ, ...opts }));
}
export const fmtDate = (d) => fmt({ weekday: 'short', day: '2-digit', month: '2-digit' }).format(d);
export const fmtDateLong = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d);
export const fmtTime = (d) => fmt({ hour: '2-digit', minute: '2-digit' }).format(d);
export const fmtDateTime = (d) => fmt({ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
export const dayKey = (d) => {
  const p = Object.fromEntries(fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
export const dateFromKey = (k) => new Date(`${k}T12:00:00+02:00`);
export const hhmm = (d) => fmtTime(d);

export function relTime(target, from = now()) {
  const ms = target - from;
  const abs = Math.abs(ms);
  const m = Math.round(abs / 60000);
  let s;
  if (m < 60) s = `${m} Min.`;
  else if (m < 60 * 36) s = `${Math.floor(m / 60)} Std. ${m % 60 ? (m % 60) + ' Min.' : ''}`.trim();
  else s = `${Math.round(m / 1440)} Tagen`;
  return ms >= 0 ? `in ${s}` : `vor ${s}`;
}

/* ---------- Distanz ---------- */
export function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`);

/* ---------- Google Maps (offizielle Maps-URLs, https://developers.google.com/maps/documentation/urls) ---------- */
const coordStr = (p) => `${p.lat},${p.lng}`;
export function mapsSearchUrl(p) {
  // p: {lat,lng} oder {query}
  const q = p.query || coordStr(p);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
export function mapsDirUrl(dest, origin) {
  const d = dest.query || coordStr(dest);
  let u = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}&travelmode=driving`;
  if (origin) u += `&origin=${encodeURIComponent(origin.query || coordStr(origin))}`;
  return u;
}

/* ---------- Teilen / Kopieren ---------- */
export async function share({ title, text, url }) {
  const full = [text, url].filter(Boolean).join('\n');
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'aborted'; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, '_blank', 'noopener');
  return 'whatsapp';
}
export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); return ok;
  }
}

export function download(filename, data, type = 'application/json') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Liest Koordinaten aus Google-Maps-Links oder "lat, lng"-Text. */
export function parseCoords(input) {
  if (!input) return null;
  const s = decodeURIComponent(String(input));
  const pats = [/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /[?&](?:q|query|destination|ll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/];
  for (const re of pats) {
    const m = s.match(re);
    if (m) {
      const lat = +m[1], lng = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
export const isHttpUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());
