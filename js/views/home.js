import { html, icon, now, fmtDateLong, fmtDate, fmtTime, relTime, dateFromKey, isSimulated, dayKey, $ } from '../util.js';
import * as M from '../model.js';
import { TRIP, DAYS, WEATHER_SPOTS } from '../data.js';
import { badge, eventRow, navUrlFor, routeUrl, toast } from '../ui.js';
import { getWeather, wmo } from '../weather.js';
import { openEventDetail, openItemEditor } from '../details.js';

let timer;

function countdown(n) {
  const ms = new Date(TRIP.start) - n;
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return { d, h, m };
}

function hero(n) {
  const ph = M.phase(n);
  if (ph === 'before') {
    const c = countdown(n);
    return html`<section class="hero">
      <p class="eyebrow">${TRIP.subtitle}</p>
      <h1 class="display">${TRIP.title}</h1>
      <div class="countdown" aria-label="Countdown bis Reisebeginn">
        <div><b>${c.d}</b><span>Tage</span></div><div><b>${c.h}</b><span>Std.</span></div><div><b>${c.m}</b><span>Min.</span></div>
      </div>
      <div class="hero-meet">
        <div>${icon('flag')}<div><b>Treffpunkt · Sa, 10. Oktober · 09:00</b><span>Urban Racing Motorsport Halle, Bohlstrasse 24, 8240 Thayngen</span></div></div>
        <div class="btn-row">
          <a class="btn light" href="${navUrlFor('meet')}" target="_blank" rel="noopener">${icon('navigation')} Navigation</a>
          <a class="btn light ghost" href="#/plan/2026-10-10">${icon('calendar-range')} Reiseplan</a>
        </div>
      </div>
    </section>`;
  }
  if (ph === 'during') {
    const d = M.currentDay(n);
    const idx = M.dayIndex(d.date) + 1;
    return html`<section class="hero ${d.region}">
      <p class="eyebrow">Tag ${idx} von ${DAYS.length} · ${d.section}</p>
      <h1 class="display">${d.title}</h1>
      <p class="hero-date">${fmtDateLong(n)}</p>
      <a class="btn light ghost" href="#/plan/${d.date}">${icon('calendar-range')} Tagesplan öffnen</a>
    </section>`;
  }
  const done = M.state.plan.filter((p) => p.status === 'done').length;
  return html`<section class="hero after">
    <p class="eyebrow">Reise abgeschlossen</p>
    <h1 class="display">Willkommen zurück</h1>
    <p class="hero-date">10.–17. Oktober 2026 · Nürburgring & Mallorca</p>
    <div class="countdown"><div><b>${DAYS.length}</b><span>Tage</span></div><div><b>${done}</b><span>Erledigt</span></div><div><b>${M.state.favorites.length}</b><span>Favoriten</span></div></div>
    <a class="btn light" href="#/backup">${icon('download')} Reisedaten exportieren</a>
  </section>`;
}

function alertsBlock() {
  const a = M.alerts();
  if (!a.length) return '';
  return html`<section class="block"><h2 class="block-title">${icon('triangle-alert')} Achtung</h2>
    <div class="alerts">${a.map((x) => html`<a class="alert ${x.level}" href="${x.route}">
      ${icon(x.level === 'danger' ? 'triangle-alert' : x.level === 'warn' ? 'shield-alert' : 'info')}
      <div><b>${x.title}</b><span>${x.text}</span>${x.sub ? html`<small>${x.sub}</small>` : ''}</div>${icon('chevron-right', 'chev')}</a>`)}</div></section>`;
}

function nextBlock(n) {
  const next = M.nextConfirmed(n);
  const ups = M.upcoming(n, 4).filter((e) => e !== next && e.id !== next?.id).slice(0, 3);
  if (!next && !ups.length) return '';
  const nav = next ? (next.route ? routeUrl(next.route) : next.place ? navUrlFor(next.place) : null) : null;
  return html`<section class="block">
    ${next ? html`<h2 class="block-title">${icon('clock')} Nächster fester Termin</h2>
    <article class="card next-card">
      <div class="next-top">${badge(next.status)}<span class="muted">${relTime(next.at, n)}</span></div>
      <h3>${next.title}</h3>
      <p class="muted">${fmtDate(next.at)} · ${next.timeLabel || fmtTime(next.at)}${next.subtitle ? ' · ' + next.subtitle : ''}</p>
      <div class="btn-row">
        ${nav ? html`<a class="btn primary" href="${nav}" target="_blank" rel="noopener">${icon('navigation')} ${next.route ? 'Route' : 'Zum Ziel navigieren'}</a>` : ''}
        <button class="btn ghost" data-action="${next.kind === 'user' ? 'edit-item' : 'event-detail'}" data-id="${next.id}">${icon('info')} Details</button>
      </div>
    </article>` : ''}
    ${ups.length ? html`<h2 class="block-title sm">Danach</h2><div class="timeline compact">${ups.map((e) => eventRow(e, { compact: true }))}</div>` : ''}
  </section>`;
}

function todayBlock(n) {
  if (M.phase(n) !== 'during') return '';
  const d = M.currentDay(n);
  const { timed, untimed } = M.dayTimeline(d.date);
  const critical = timed.filter((e) => (e.status === 'conflict' || /flug/i.test(e.title) || e.id.includes('checkout')) && (!e.at || e.at > n));
  return html`<section class="block">
    ${critical.length ? html`<div class="card critical">${icon('hourglass')}<div><b>Heute zeitkritisch</b>
      ${critical.map((e) => html`<span>${e.timeLabel || e.time || 'Zeit offen'} · ${e.title}${e.status === 'conflict' ? ' – Konflikt!' : ''}</span>`)}</div></div>` : ''}
    <h2 class="block-title">${icon('calendar-range')} Heute</h2>
    ${timed.length || untimed.length ? html`<div class="timeline">${timed.map((e) => eventRow(e))}${untimed.map((e) => eventRow(e))}</div>`
      : html`<div class="card soft"><p>Heute ist noch nichts geplant.</p><button class="btn primary" data-action="add-today" data-date="${d.date}">${icon('plus')} Aktivität planen</button></div>`}
  </section>`;
}

function tasksBlock() {
  const open = M.checklist().filter((c) => !c.done);
  const total = M.checklist().length;
  return html`<section class="block">
    <h2 class="block-title">${icon('list-checks')} Offene Aufgaben <span class="count">${open.length}/${total}</span></h2>
    ${open.length ? html`<div class="card list">${open.slice(0, 4).map((c) => html`
      <label class="check-row prio-${c.priority}"><input type="checkbox" data-task="${c.id}"><span class="cb">${icon('check')}</span>
        <span><b>${c.title}</b>${c.detail ? html`<small>${c.detail}</small>` : ''}</span></label>`)}
      <a class="list-more" href="#/checklist">Alle Aufgaben ${icon('chevron-right')}</a></div>`
      : html`<div class="card soft">${icon('party-popper')} Alle Aufgaben erledigt.</div>`}
  </section>`;
}

function bookingsBlock() {
  const s = M.sixt();
  const sixtSt = s.pickup.state === 'ok' && s.ret.state === 'ok' ? 'booked' : 'conflict';
  const items = [
    ['hotel', 'bed-double', 'Hotel', 'Dorint Nürburgring', 'booked', '#/booking/hotel'],
    ['flights', 'plane', 'Flüge', 'DE1524 · DE1525', 'fixed', '#/booking/flights'],
    ['sixt', 'car', 'Mietwagen', 'SIXT Palma', sixtSt, '#/booking/sixt'],
    ['villa', 'house', 'Villa', 'Mallorca 12.–17.10.', 'booked', '#/villa'],
    ['parking', 'square-parking', 'Parkplatz', 'Flughafen Stuttgart', M.parking().booked ? 'booked' : 'open', '#/parking'],
  ];
  return html`<section class="block"><h2 class="block-title">${icon('file-text')} Buchungen</h2>
    <div class="tiles">${items.map(([id, ic, t, s2, st, href]) => html`<a class="tile" href="${href}">
      <span class="tile-ic">${icon(ic)}</span><b>${t}</b><small>${s2}</small>${badge(st)}</a>`)}</div></section>`;
}

function favBlock() {
  if (M.phase() !== 'after') return '';
  const f = M.state.favorites;
  return html`<section class="block"><h2 class="block-title">${icon('heart')} Gespeicherte Favoriten</h2>
    ${f.length ? html`<div class="card list">${f.map((p) => html`<a class="row" href="#/discover?tab=fav">${icon('map-pin')}<span>${p.name}</span></a>`)}</div>` : html`<div class="card soft">Keine Favoriten gespeichert.</div>`}</section>`;
}

/* ---------- Wetter ---------- */
function weatherSpots() {
  const v = M.place('villa');
  return [
    { id: 'nuerburg', ...WEATHER_SPOTS.nuerburg },
    v ? { id: 'villa', label: 'Villa Mallorca', lat: v.lat, lng: v.lng } : { id: 'palma', ...WEATHER_SPOTS.palma },
  ];
}
function defaultSpot(n) {
  const d = M.currentDay(n);
  if (M.phase(n) === 'during' && d?.region === 'nuerburg') return 0;
  if (M.phase(n) === 'before') return 0;
  return 1;
}
let spotIdx = null;

async function renderWeather(root) {
  const box = $('#weather', root);
  if (!box) return;
  const spots = weatherSpots();
  if (spotIdx == null) spotIdx = defaultSpot(now());
  const spot = spots[spotIdx];
  const tabs = html`<div class="seg mini" role="tablist">${spots.map((s, i) => html`<button role="tab" aria-selected="${i === spotIdx}" class="${i === spotIdx ? 'on' : ''}" data-spot="${i}">${s.label}</button>`)}</div>`;
  box.innerHTML = String(html`${tabs}<div class="wx-loading"><span class="spinner"></span> Wetter wird geladen …</div>`);
  bindSpots(box, root);
  try {
    const w = await getWeather(spot);
    const c = w.data.current, d = w.data.daily;
    const [desc, ic] = wmo(c.weather_code);
    const tripDays = new Set(DAYS.map((x) => x.date));
    box.innerHTML = String(html`${tabs}
      <div class="wx-now">
        <div class="wx-ic">${icon(ic, 'xl')}</div>
        <div><b class="wx-temp">${Math.round(c.temperature_2m)}°</b><span>${desc}</span><small>gefühlt ${Math.round(c.apparent_temperature)}°</small></div>
        <dl class="wx-facts">
          <div><dt>${icon('arrow-up', 'xs')}${icon('arrow-down', 'xs')}</dt><dd>${Math.round(d.temperature_2m_max[0])}° / ${Math.round(d.temperature_2m_min[0])}°</dd></div>
          <div><dt>${icon('umbrella', 'xs')}</dt><dd>${d.precipitation_probability_max[0] ?? '–'} %</dd></div>
          <div><dt>${icon('wind', 'xs')}</dt><dd>${Math.round(c.wind_speed_10m)} km/h</dd></div>
          <div><dt>${icon('sunrise', 'xs')}</dt><dd>${d.sunrise[0].slice(11, 16)}</dd></div>
          <div><dt>${icon('sunset', 'xs')}</dt><dd>${d.sunset[0].slice(11, 16)}</dd></div>
        </dl>
      </div>
      <div class="wx-days">${d.time.map((t, i) => html`<div class="${tripDays.has(t) ? 'trip' : ''}">
        <span>${fmtDate(dateFromKey(t)).split(',')[0]}</span>${icon(wmo(d.weather_code[i])[1])}<b>${Math.round(d.temperature_2m_max[i])}°</b><small>${Math.round(d.temperature_2m_min[i])}°</small><small class="rain">${d.precipitation_probability_max[i] ?? '–'}%</small></div>`)}</div>
      <p class="source">Quelle: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> · Stand ${fmtDate(new Date(w.fetchedAt))} ${fmtTime(new Date(w.fetchedAt))}
        ${w.stale ? html` · <b class="warn-text">offline – zuletzt geladene Werte</b>` : ''}
        <button class="icon-btn sm" data-wx-refresh aria-label="Wetter aktualisieren">${icon('refresh-cw')}</button></p>`);
    bindSpots(box, root);
    box.querySelector('[data-wx-refresh]').onclick = async () => { try { await getWeather(spot, { force: true }); } catch { toast('Wetter derzeit nicht abrufbar'); } renderWeather(root); };
  } catch (e) {
    box.innerHTML = String(html`${tabs}<div class="wx-error">${icon('wifi-off')}<span>Wetterdaten nicht verfügbar${navigator.onLine ? '' : ' (offline)'}. Es werden keine Werte angezeigt.</span>
      <button class="btn ghost sm" data-wx-retry>Erneut versuchen</button></div>`);
    bindSpots(box, root);
    box.querySelector('[data-wx-retry]').onclick = () => renderWeather(root);
  }
}
function bindSpots(box, root) {
  box.querySelectorAll('[data-spot]').forEach((b) => (b.onclick = () => { spotIdx = +b.dataset.spot; renderWeather(root); }));
}

export function render(root) {
  const n = now();
  const draw = () => {
    const n2 = now();
    root.innerHTML = String(html`
      <div class="page home">
        <header class="topbar">
          <div><span class="muted">${fmtDateLong(n2)}</span></div>
          <a class="icon-btn" href="${M.unlocked() ? '#/private' : '#/private'}" aria-label="${M.unlocked() ? 'Private Daten entsperrt' : 'Private Daten gesperrt'}">${icon(M.unlocked() ? 'lock-open' : 'lock')}</a>
        </header>
        ${isSimulated() ? html`<a class="sim-banner" href="#/settings">${icon('flask-conical')} Simuliertes Datum aktiv: ${fmtDate(n2)} ${fmtTime(n2)} – nur zum Testen</a>` : ''}
        ${hero(n2)}
        ${!M.unlocked() ? html`<a class="card unlock-card" href="#/private">${icon('lock')}<div><b>Private Buchungsdaten entsperren</b><span>Reservierungsnummern, Villa-Standort und Heimadresse sind verschlüsselt.</span></div>${icon('chevron-right')}</a>` : ''}
        ${alertsBlock()}
        ${todayBlock(n2)}
        ${nextBlock(n2)}
        <section class="block"><h2 class="block-title">${icon('sun')} Wetter</h2><div class="card" id="weather"></div></section>
        ${M.phase(n2) !== 'after' ? tasksBlock() : favBlock()}
        ${bookingsBlock()}
      </div>`);
    renderWeather(root);
  };
  draw();
  root.onchange = async (ev) => {
    const t = ev.target.closest('[data-task]');
    if (t) { await M.toggleTask(t.dataset.task, t.checked); toast('Aufgabe erledigt'); }
  };
  root.onclick = (ev) => {
    const a = ev.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'event-detail') openEventDetail(a.dataset.id);
    if (a.dataset.action === 'edit-item') { const it = M.state.plan.find((p) => p.id === a.dataset.id); if (it) openItemEditor(it, { onSaved: draw }); }
    if (a.dataset.action === 'add-today') openItemEditor({ date: a.dataset.date }, { onSaved: draw });
  };
  clearInterval(timer);
  timer = setInterval(() => { if (M.phase() === 'before') { const cd = root.querySelector('.countdown'); if (cd) { const c = countdown(now()); cd.querySelectorAll('b').forEach((b, i) => (b.textContent = [c.d, c.h, c.m][i])); } } }, 30000);
  const onState = () => draw();
  window.addEventListener('statechange', onState);
  return () => { clearInterval(timer); window.removeEventListener('statechange', onState); root.onchange = null; root.onclick = null; };
}
