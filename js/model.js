// Zentraler Zustand + abgeleitete Informationen (Konflikte, Tagesablauf, Phase).
import * as store from './store.js';
import { TRIP, PLACES, DAYS, EVENTS, FLIGHTS, SIXT_PUBLIC, CHECKLIST_DEFAULT } from './data.js';
import { at, now, dayKey, fmtTime, fmtDate, uid } from './util.js';

export const state = {
  priv: null,          // entschlüsselte private Buchungsdaten (oder null = gesperrt)
  overrides: {},       // lokale manuelle Ergänzungen {sixt:{}, flights:{}, villa:{}, parking:{}}
  plan: [],            // eigene Aktivitäten
  favorites: [],       // gespeicherte Orte
  checklist: { done: {}, custom: [], prio: {} },
  notes: {},           // Tagesnotizen {date: text}
  settings: { theme: 'auto', simulate: '' },
};

const KEYS = ['priv', 'overrides', 'plan', 'favorites', 'checklist', 'notes', 'settings'];

export async function load() {
  for (const k of KEYS) {
    const v = await store.get(k);
    if (v != null) state[k] = k === 'settings' || k === 'checklist' ? { ...state[k], ...v } : v;
  }
}
export async function save(...keys) {
  for (const k of keys) await store.set(k, state[k]);
  window.dispatchEvent(new CustomEvent('statechange', { detail: keys }));
}

/* ---------- Orte ---------- */
export function place(id) {
  if (PLACES[id]) return PLACES[id];
  if (id === 'villa') {
    if (!state.priv?.villa) return null;
    const v = state.priv.villa;
    return { id: 'villa', name: 'Ferienvilla Mallorca', lat: v.lat, lng: v.lng, approx: false, kind: 'trip',
      address: ov('villa').address || null, coordNote: 'Navigationsziel: Koordinaten laut Buchung (keine bestätigte Strassenadresse).' };
  }
  if (id === 'home') {
    if (!state.priv?.home) return null;
    return { id: 'home', name: state.priv.home.label, query: state.priv.home.address, address: state.priv.home.address, kind: 'trip' };
  }
  return null;
}
export const unlocked = () => !!state.priv;

/* ---------- Zeitkonflikte ---------- */
export const FLIGHT_OUT_ARR = at(FLIGHTS.out.date, FLIGHTS.out.arr);
export const FLIGHT_OUT_DEP = at(FLIGHTS.out.date, FLIGHTS.out.dep);
export const FLIGHT_BACK_DEP = at(FLIGHTS.back.date, FLIGHTS.back.dep);

const localDate = (v) => (v ? new Date(v.length === 16 ? v + ':00+02:00' : v) : null);

/* ---------- Ergänzungen: zentral (verschlüsselte Datei, für alle Geräte) + lokal (nur dieses Gerät) ----------
 * Lokale Werte überschreiben zentrale. Leere lokale Felder fallen auf den zentralen Wert zurück. */
export function ov(section) {
  return { ...(state.priv?.shared?.[section] || {}), ...(state.overrides[section] || {}) };
}
/** 'local' | 'shared' | null – woher ein Wert stammt */
export function ovSrc(section, key) {
  const l = state.overrides[section]?.[key], sh = state.priv?.shared?.[section]?.[key];
  if (l !== undefined && l !== '' && l !== false) return 'local';
  if (sh !== undefined && sh !== '' && sh !== false) return 'shared';
  return null;
}

export function sixt() {
  const o = ov('sixt');
  const grace = (SIXT_PUBLIC.graceMinutes || 0) * 60000;
  const warnGap = (SIXT_PUBLIC.returnWarnMinutes || 0) * 60000;
  const mk = (bookedIso, localV, confirmed, check) => {
    const booked = new Date(bookedIso);
    const local = localDate(localV);
    const effective = local && confirmed ? local : booked;
    const res = check(effective); // 'ok' | 'tight' | 'conflict'
    const state_ = local && !confirmed ? 'pending' : res;
    return { booked, local, confirmed: !!confirmed, effective, conflict: res === 'conflict', state: state_, changed: !!(local && confirmed) };
  };
  return {
    // Abholung: Konflikt erst, wenn selbst mit Kulanz die Landung danach liegt.
    pickup: mk(SIXT_PUBLIC.bookedPickup, o.pickup, o.pickupConfirmed, (d) => (d.getTime() + grace < FLIGHT_OUT_ARR.getTime() ? 'conflict' : 'ok')),
    // Rückgabe: Konflikt ab Abflugzeit, Warnung unter der Warnschwelle.
    ret: mk(SIXT_PUBLIC.bookedReturn, o.ret, o.retConfirmed, (d) => (d >= FLIGHT_BACK_DEP ? 'conflict' : FLIGHT_BACK_DEP - d < warnGap ? 'tight' : 'ok')),
    gapMinutes: (d) => Math.round((FLIGHT_BACK_DEP - d) / 60000),
  };
}

export function returnArrival() {
  const v = ov('flights').returnArrival;
  return v ? { time: v, manual: true, src: ovSrc('flights', 'returnArrival') } : null;
}

export function parking() {
  const o = ov('parking');
  return { booked: !!o.booked, provider: o.provider || '', ref: o.ref || '', notes: o.notes || '', src: ovSrc('parking', 'booked') };
}

/* ---------- Ablauf ---------- */
function resolveEvent(ev) {
  const e = { ...ev, kind: 'fixed', notes: [...(ev.notes || [])] };
  if (ev.time) e.at = at(ev.date, ev.time);
  if (ev.dynamic === 'sixtPickup') {
    const p = sixt().pickup;
    e.status = p.state === 'ok' ? 'booked' : 'conflict';
    if (p.state === 'pending') { e.timeLabel = `neu: ${fmtTime(p.local)}?`; e.warn = 'Neue Zeit eingetragen, aber noch nicht als bei SIXT geändert markiert.'; }
    else {
      e.at = p.effective; e.time = fmtTime(p.effective); e.timeLabel = `ab ${fmtTime(p.effective)}`;
      if (p.state === 'conflict') e.warn = SIXT_PUBLIC.pickupWarning;
      else if (p.effective < FLIGHT_OUT_ARR) e.notes.unshift(`Abholung ab ${fmtTime(p.effective)}, Landung planmässig 19:55. Laut Bestätigung gilt eine Kulanz von ${SIXT_PUBLIC.graceMinutes} Min. für die Abholung (innerhalb der Öffnungszeiten) – bei Verspätung SIXT informieren.`);
      if (p.changed) e.notes.unshift('Abholzeit lokal als bei SIXT geändert markiert.');
    }
  }
  if (ev.dynamic === 'sixtReturn') {
    const s_ = sixt(), r = s_.ret;
    e.status = r.state === 'ok' ? 'booked' : r.state === 'tight' ? 'approx' : 'conflict';
    if (r.state === 'pending') { e.timeLabel = `neu: ${fmtTime(r.local)}?`; e.warn = 'Neue Zeit eingetragen, aber noch nicht als bei SIXT geändert markiert.'; }
    else {
      e.at = r.effective; e.time = fmtTime(r.effective); e.timeLabel = null; e.sort = e.time;
      if (r.state === 'conflict') { e.timeLabel = `gebucht ${fmtTime(r.effective)}`; e.sort = '10:00'; e.warn = SIXT_PUBLIC.returnWarning; e.status = 'conflict'; }
      else if (r.state === 'tight') { e.status = 'booked'; e.warn = `Nur ${s_.gapMinutes(r.effective)} Min. bis zum Abflug (14:45). ${SIXT_PUBLIC.returnTightWarning}`; }
      else e.notes.unshift('Zeitreserve bis Abflug bitte selbst prüfen.');
      if (r.changed) e.notes.unshift('Rückgabezeit lokal als bei SIXT geändert markiert.');
    }
  }
  if (ev.dynamic === 'returnFlight') {
    const a = returnArrival();
    e.subtitle = a ? `Palma (PMI) → Stuttgart (STR) · Ankunft ${a.time} (ergänzt)` : 'Palma (PMI) → Stuttgart (STR) · Ankunftszeit offen';
  }
  if (ev.dynamic === 'parking') {
    const p = parking();
    if (p.booked) { e.status = 'booked'; e.subtitle = `Gebucht${p.provider ? ' · ' + p.provider : ''}`; e.warn = null; }
    else { e.status = 'conflict'; e.warn = 'Noch kein Parkplatz gebucht.'; }
  }
  if (ev.route) {
    const missing = [ev.route.from, ev.route.to].filter((id) => !place(id));
    e.routeLocked = missing.length > 0;
  }
  return e;
}

export function fixedEvents(date) {
  return EVENTS.filter((e) => !date || e.date === date).map(resolveEvent);
}

export function userItems(date) {
  return state.plan.filter((i) => i.date === date);
}

/** Tagesablauf: feste Termine + eigene Aktivitäten mit Uhrzeit (sortiert), danach Aktivitäten ohne Uhrzeit. */
export function dayTimeline(date) {
  const fixed = fixedEvents(date).map((e) => ({ ...e, _sort: e.sort || e.time || '99:99' }));
  const items = userItems(date);
  const timed = items.filter((i) => i.time).map((i) => ({ ...i, kind: 'user', _sort: i.time, at: at(i.date, i.time) }));
  const untimed = items.filter((i) => !i.time).sort((a, b) => a.order - b.order).map((i) => ({ ...i, kind: 'user' }));
  const merged = [...fixed, ...timed].sort((a, b) => a._sort.localeCompare(b._sort));
  return { timed: merged, untimed };
}

export function phase(n = now()) {
  if (n < new Date(TRIP.start)) return 'before';
  if (n > new Date(TRIP.end)) return 'after';
  return 'during';
}
export function currentDay(n = now()) {
  const k = dayKey(n);
  return DAYS.find((d) => d.date === k) || null;
}
export const dayIndex = (date) => DAYS.findIndex((d) => d.date === date);

/** Alle Ereignisse mit konkreter Uhrzeit ab jetzt. */
export function upcoming(n = now(), limit = 5) {
  const all = [];
  for (const d of DAYS) {
    const { timed } = dayTimeline(d.date);
    for (const e of timed) if (e.at && e.at >= n && e.status !== 'idea' && e.status !== 'done') all.push(e);
  }
  return all.sort((a, b) => a.at - b.at).slice(0, limit);
}
export function nextConfirmed(n = now()) {
  return upcoming(n, 50).find((e) => ['booked', 'fixed', 'confirmed'].includes(e.status)) || null;
}

/* ---------- Warnungen ---------- */
export function alerts() {
  const out = [];
  const s = sixt();
  if (s.pickup.state === 'conflict') out.push({ level: 'danger', id: 'sixt-pickup', title: 'Mietwagen-Abholung', text: SIXT_PUBLIC.pickupWarning, sub: `Gebucht: ${fmtDate(s.pickup.effective)} ${fmtTime(s.pickup.effective)} · Landung: 12.10. 19:55`, route: '#/booking/sixt' });
  if (s.pickup.state === 'pending') out.push({ level: 'warn', id: 'sixt-pickup', title: 'Mietwagen-Abholung', text: `Neue Abholzeit ${fmtDate(s.pickup.local)} ${fmtTime(s.pickup.local)} eingetragen – noch nicht als bei SIXT geändert markiert.`, route: '#/booking/sixt' });
  if (s.ret.state === 'conflict') out.push({ level: 'danger', id: 'sixt-return', title: 'Mietwagen-Rückgabe', text: SIXT_PUBLIC.returnWarning, sub: `Gebucht: ${fmtDate(s.ret.effective)} ${fmtTime(s.ret.effective)} · Abflug: 17.10. 14:45`, route: '#/booking/sixt' });
  if (s.ret.state === 'tight') out.push({ level: 'danger', id: 'sixt-return', title: 'Mietwagen-Rückgabe sehr knapp', text: `Rückgabe ${fmtTime(s.ret.effective)} – nur ${s.gapMinutes(s.ret.effective)} Min. vor dem Abflug um 14:45.`, sub: 'Check-in, Gepäckaufgabe und Sicherheitskontrolle brauchen Zeit. Bitte prüfen.', route: '#/booking/sixt' });
  if (s.ret.state === 'pending') out.push({ level: 'warn', id: 'sixt-return', title: 'Mietwagen-Rückgabe', text: `Neue Rückgabezeit ${fmtTime(s.ret.local)} eingetragen – noch nicht als bei SIXT geändert markiert.`, route: '#/booking/sixt' });
  if (!parking().booked) out.push({ level: 'warn', id: 'parking', title: 'Parkplatz Stuttgart', text: 'Noch nicht gebucht (12.–17.10.).', route: '#/parking' });
  if (!returnArrival()) out.push({ level: 'info', id: 'ret-arr', title: 'Rückflug DE1525', text: 'Ankunftszeit in Stuttgart noch offen.', route: '#/booking/flights' });
  return out;
}

/* ---------- Checkliste ---------- */
export function checklist() {
  const all = [...CHECKLIST_DEFAULT, ...state.checklist.custom].map((c) => ({
    ...c, priority: state.checklist.prio[c.id] || c.priority || 'medium', done: c.id in state.checklist.done ? !!state.checklist.done[c.id] : !!c.defaultDone,
  }));
  const rank = { high: 0, medium: 1, low: 2 };
  return all.sort((a, b) => (a.done - b.done) || (rank[a.priority] - rank[b.priority]));
}
export async function toggleTask(id, done) {
  state.checklist.done[id] = done ? Date.now() : false;
  await save('checklist');
}
export async function addTask(title, priority = 'medium') {
  state.checklist.custom.push({ id: 'cu-' + uid(), title, priority, custom: true });
  await save('checklist');
}
export async function removeTask(id) {
  state.checklist.custom = state.checklist.custom.filter((c) => c.id !== id);
  delete state.checklist.done[id];
  await save('checklist');
}

/* ---------- Planer ---------- */
export async function upsertItem(item) {
  const i = state.plan.findIndex((p) => p.id === item.id);
  if (i >= 0) state.plan[i] = item;
  else {
    item.id ||= uid();
    item.order = Math.max(0, ...state.plan.filter((p) => p.date === item.date).map((p) => p.order || 0)) + 1;
    state.plan.push(item);
  }
  await save('plan');
}
export async function removeItem(id) { state.plan = state.plan.filter((p) => p.id !== id); await save('plan'); }
export async function moveItem(id, dir) {
  const it = state.plan.find((p) => p.id === id);
  const list = state.plan.filter((p) => p.date === it.date && !p.time).sort((a, b) => a.order - b.order);
  list.forEach((p, idx) => (p.order = idx + 1));
  const idx = list.indexOf(it), j = idx + dir;
  if (j < 0 || j >= list.length) return;
  [list[idx].order, list[j].order] = [list[j].order, list[idx].order];
  await save('plan');
}

/* ---------- Favoriten ---------- */
export const placeKey = (p) => p.osmId || p.id;
export const isFav = (p) => state.favorites.some((f) => placeKey(f) === placeKey(p));
export async function toggleFav(p) {
  if (isFav(p)) state.favorites = state.favorites.filter((f) => placeKey(f) !== placeKey(p));
  else state.favorites.push({ ...p, id: p.id || uid(), savedAt: Date.now() });
  await save('favorites');
  return isFav(p);
}

/* ---------- Basisort für Suche ---------- */
export function searchBases() {
  const b = [];
  const v = place('villa');
  b.push(v ? { id: 'villa', label: 'Villa', lat: v.lat, lng: v.lng, region: 'mallorca' } : { id: 'villa', label: 'Villa (gesperrt)', locked: true, region: 'mallorca' });
  b.push({ id: 'nuerburg', label: 'Nürburgring', lat: PLACES.hotel.lat, lng: PLACES.hotel.lng, region: 'nuerburg', approx: true });
  b.push({ id: 'palma', label: 'Palma', lat: 39.5696, lng: 2.6502, region: 'mallorca' });
  b.push({ id: 'gps', label: 'Mein Standort', gps: true });
  return b;
}
export function defaultBase(n = now()) {
  const d = currentDay(n);
  const p = phase(n);
  if (p === 'during' && d && d.region === 'nuerburg') return 'nuerburg';
  if (p === 'before') {
    const daysTo = (new Date(TRIP.start) - n) / 864e5;
    if (daysTo < 3) return 'nuerburg';
  }
  return unlocked() ? 'villa' : 'palma';
}
