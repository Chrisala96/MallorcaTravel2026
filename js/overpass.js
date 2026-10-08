// Live-Ortssuche über die OpenStreetMap Overpass API (kostenlos, ohne Schlüssel, CORS-fähig).
// Daten © OpenStreetMap-Mitwirkende, ODbL. OSM enthält KEINE Bewertungen, Rezensionen oder Preisniveaus.
import * as store from './store.js';
import { now, TZ } from './util.js';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// io: indoor/outdoor/mixed · rain: bei Regen geeignet · dur: typische Dauer (Kategorie-Eigenschaft, keine Ortsangabe)
export const CATEGORIES = [
  { id: 'local', group: 'food', label: 'Lokale Küche', icon: 'utensils', io: 'indoor', rain: true,
    sel: ['nwr["amenity"="restaurant"]["cuisine"~"spanish|regional|mallorcan|balearic|catalan|mediterranean|german",i]'], g: 'lokale Küche Restaurant' },
  { id: 'tapas', group: 'food', label: 'Tapas', icon: 'utensils', io: 'indoor', rain: true,
    sel: ['nwr["amenity"~"restaurant|bar"]["cuisine"~"tapas",i]', 'nwr["amenity"~"restaurant|bar"]["name"~"tapas",i]'], g: 'Tapas Bar' },
  { id: 'fish', group: 'food', label: 'Fisch & Meeresfrüchte', icon: 'fish', io: 'indoor', rain: true,
    sel: ['nwr["amenity"="restaurant"]["cuisine"~"seafood|fish",i]'], g: 'Fisch Meeresfrüchte Restaurant' },
  { id: 'steak', group: 'food', label: 'Steakhouse', icon: 'beef', io: 'indoor', rain: true,
    sel: ['nwr["amenity"="restaurant"]["cuisine"~"steak|grill|argentin",i]'], g: 'Steakhouse' },
  { id: 'fine', group: 'food', label: 'Fine Dining', icon: 'sparkles', io: 'indoor', rain: true, googleOnly: true,
    googleNote: 'Fine Dining ist in OpenStreetMap nicht zuverlässig gekennzeichnet. Die Suche öffnet deshalb Google Maps.', g: 'Fine Dining Restaurant' },
  { id: 'intl', group: 'food', label: 'Internationale Küche', icon: 'globe', io: 'indoor', rain: true,
    sel: ['nwr["amenity"="restaurant"]["cuisine"~"italian|pizza|international|french|asian|japanese|sushi|indian|thai|chinese|mexican|greek|burger",i]'], g: 'Restaurant' },
  { id: 'breakfast', group: 'food', label: 'Frühstück & Brunch', icon: 'coffee', io: 'indoor', rain: true,
    sel: ['nwr["amenity"="cafe"]', 'nwr["cuisine"~"breakfast|brunch",i]', 'nwr["shop"="bakery"]["name"]'], g: 'Frühstück Brunch Café' },
  { id: 'bars', group: 'food', label: 'Bars & Beachclubs', icon: 'wine', io: 'mixed', rain: false,
    sel: ['nwr["amenity"~"^(bar|pub|biergarten)$"]', 'nwr["leisure"="beach_resort"]', 'nwr["name"~"beach ?club",i]'], g: 'Beach Club Bar' },

  { id: 'beach', group: 'activity', label: 'Strände', icon: 'tree-palm', io: 'outdoor', rain: false, dur: '2–4 Std.',
    sel: ['nwr["natural"="beach"]["name"]'], g: 'Strand' },
  { id: 'cove', group: 'activity', label: 'Buchten', icon: 'waves', io: 'outdoor', rain: false, dur: '2–4 Std.',
    sel: ['nwr["natural"="bay"]["name"]', 'nwr["natural"="beach"]["name"~"^cala",i]'], g: 'Cala Bucht' },
  { id: 'sights', group: 'activity', label: 'Sehenswürdigkeiten', icon: 'landmark', io: 'mixed', rain: true, dur: '1–2 Std.',
    sel: ['nwr["tourism"="attraction"]["name"]', 'nwr["historic"~"castle|monument|monastery|church|ruins|tower|fort"]["name"]'], g: 'Sehenswürdigkeiten' },
  { id: 'boat', group: 'activity', label: 'Bootsausflüge', icon: 'ship', io: 'outdoor', rain: false, dur: '2–6 Std.',
    sel: ['nwr["amenity"="boat_rental"]', 'nwr["leisure"="marina"]["name"]', 'nwr["tourism"="information"]["name"~"boat|barco|excursion",i]'], g: 'Bootsausflug' },
  { id: 'water', group: 'activity', label: 'Wassersport', icon: 'sailboat', io: 'outdoor', rain: false, dur: '1–3 Std.',
    sel: ['nwr["sport"~"diving|scuba_diving|surfing|kitesurfing|windsurfing|sailing|water_ski|canoe|kayak|paddle|snorkel",i]', 'nwr["shop"~"water_sports|scuba_diving|surf",i]'], g: 'Wassersport' },
  { id: 'hike', group: 'activity', label: 'Wandern', icon: 'footprints', io: 'outdoor', rain: false, dur: '2–6 Std.',
    sel: ['relation["route"="hiking"]["name"]', 'node["natural"="peak"]["name"]'], g: 'Wanderung' },
  { id: 'view', group: 'activity', label: 'Aussichtspunkte', icon: 'binoculars', io: 'outdoor', rain: false, dur: '0,5–1 Std.',
    sel: ['nwr["tourism"="viewpoint"]'], g: 'Aussichtspunkt' },
  { id: 'motor', group: 'activity', label: 'Motorsport', icon: 'flag', io: 'mixed', rain: true, dur: '2–4 Std.',
    sel: ['nwr["sport"~"motor|karting|motocross",i]', 'nwr["highway"="raceway"]["name"]'], g: 'Motorsport Kartbahn' },
  { id: 'museum', group: 'activity', label: 'Museen', icon: 'building-2', io: 'indoor', rain: true, dur: '1–3 Std.',
    sel: ['nwr["tourism"="museum"]', 'nwr["tourism"="gallery"]'], g: 'Museum' },
  { id: 'shop', group: 'activity', label: 'Shopping', icon: 'shopping-bag', io: 'mixed', rain: true, dur: '1–3 Std.',
    sel: ['nwr["shop"~"^(mall|department_store|gift|wine|deli|art|craft)$"]', 'nwr["amenity"="marketplace"]'], g: 'Shopping Markt' },
  { id: 'night', group: 'activity', label: 'Nachtleben', icon: 'music', io: 'indoor', rain: true, dur: 'Abend',
    sel: ['nwr["amenity"~"^(nightclub|bar|pub)$"]'], g: 'Nachtleben Bar Club' },
];
export const catById = (id) => CATEGORIES.find((c) => c.id === id);

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&');

function buildQuery({ cat, term, lat, lng, radius }) {
  const around = `(around:${Math.round(radius)},${lat},${lng})`;
  let sels;
  if (cat) sels = cat.sel;
  else {
    const t = reEsc(term);
    sels = [
      `nwr["name"~"${t}",i]["amenity"~"restaurant|cafe|bar|pub|biergarten|nightclub|ice_cream|boat_rental|marketplace"]`,
      `nwr["name"~"${t}",i]["tourism"]`, `nwr["name"~"${t}",i]["natural"~"beach|bay|peak"]`,
      `nwr["name"~"${t}",i]["leisure"~"beach_resort|marina|park"]`, `nwr["name"~"${t}",i]["historic"]`,
      `nwr["cuisine"~"${t}",i]["amenity"~"restaurant|cafe|bar"]`,
    ];
  }
  const body = sels.map((s) => `${s}${around};`).join('');
  return `[out:json][timeout:25];(${body});out center tags 120;`;
}

function toPlace(el, catId) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
  if (lat == null || !t.name) return null;
  const addr = [[t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '), [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    osmId: `${el.type}/${el.id}`, source: 'osm', name: t.name, category: catId || guessCat(t), lat, lng,
    address: addr || null, cuisine: t.cuisine ? t.cuisine.replace(/;/g, ', ').replace(/_/g, ' ') : null,
    openingHours: t.opening_hours || null, website: t.website || t['contact:website'] || null,
    phone: t.phone || t['contact:phone'] || null, description: t.description || t['description:de'] || null,
    osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}
function guessCat(t) {
  if (t.amenity === 'restaurant') return /tapas/i.test(t.cuisine || '') ? 'tapas' : /seafood|fish/i.test(t.cuisine || '') ? 'fish' : 'local';
  if (t.amenity === 'cafe') return 'breakfast';
  if (/bar|pub|biergarten/.test(t.amenity || '')) return 'bars';
  if (t.amenity === 'nightclub') return 'night';
  if (t.natural === 'beach') return 'beach';
  if (t.natural === 'bay') return 'cove';
  if (t.tourism === 'museum') return 'museum';
  if (t.tourism === 'viewpoint') return 'view';
  return 'sights';
}

export async function search(params) {
  const q = buildQuery(params);
  const key = 'osm:' + q;
  let lastErr;
  for (const ep of ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(res.status === 429 ? 'Zu viele Anfragen – bitte kurz warten.' : 'HTTP ' + res.status);
      const json = await res.json();
      const seen = new Set();
      const places = json.elements.map((e) => toPlace(e, params.cat?.id)).filter((p) => p && !seen.has(p.osmId) && seen.add(p.osmId));
      const out = { places, fetchedAt: Date.now() };
      await store.set(key, out);
      return out;
    } catch (e) { lastErr = e; }
  }
  const cached = await store.get(key);
  if (cached) return { ...cached, stale: true, error: lastErr?.message };
  throw lastErr || new Error('Suche fehlgeschlagen');
}

/* ---------- Öffnungszeiten (konservativer Parser) ----------
 * Unterstützt nur einfache Angaben wie "Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off" oder "24/7".
 * Alles andere (Feiertage, Monate, Sonnenauf-/untergang …) → null = "nicht verifizierbar". */
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
function parseDays(s) {
  const set = new Set();
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = DAYS.indexOf(m[1]), b = m[2] ? DAYS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) { set.add(i); if (i === b) break; }
  }
  return set;
}
function parseTimes(s) {
  const ranges = [];
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    ranges.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]);
  }
  return ranges;
}
export function isOpenNow(oh, d = now()) {
  if (!oh) return null;
  const str = oh.trim();
  if (str === '24/7') return true;
  const week = Array.from({ length: 7 }, () => null); // je Wochentag: Zeitbereiche oder [] (geschlossen)
  for (const ruleRaw of str.split(';')) {
    const rule = ruleRaw.trim();
    if (!rule) continue;
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1]) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    const rest = m[2].trim();
    let ranges;
    if (/^(off|closed)$/i.test(rest)) ranges = [];
    else { ranges = parseTimes(rest); if (!ranges) return null; }
    for (const di of days) week[di] = ranges;
  }
  // OSM-Semantik: Nicht genannte Wochentage sind geschlossen.
  for (let i = 0; i < 7; i++) if (week[i] == null) week[i] = [];
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((p) => [p.type, p.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
  const mins = +parts.hour * 60 + +parts.minute;
  const today = week[wd], yesterday = week[(wd + 6) % 7];
  if (today == null && yesterday == null) return null;
  // Über Mitternacht laufende Zeiten vom Vortag
  for (const [a, b] of yesterday || []) if (b <= a && mins < b) return true;
  if (today == null) return null;
  for (const [a, b] of today) {
    if (b > a && mins >= a && mins < b) return true;
    if (b <= a && mins >= a) return true;
  }
  return false;
}
