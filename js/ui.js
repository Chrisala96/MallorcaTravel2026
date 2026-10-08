// Wiederverwendbare UI-Bausteine: Status-Badges, Bottom-Sheet, Toast, Bestätigungsdialog, Ereigniszeilen.
import { html, raw, icon, esc, $, mapsDirUrl, mapsSearchUrl, fmtTime } from './util.js';
import { place, unlocked } from './model.js';

export const STATUS = {
  booked: { label: 'Gebucht', icon: 'circle-check', cls: 'booked', hint: 'Laut Buchungsbestätigung' },
  fixed: { label: 'Feste Zeit', icon: 'clock', cls: 'fixed', hint: 'Feste Uhrzeit laut Reiseplan' },
  approx: { label: 'Ca.-Zeit', icon: 'hourglass', cls: 'approx', hint: 'Ungefähre Planungszeit' },
  open: { label: 'Offen', icon: 'circle-dashed', cls: 'open', hint: 'Angabe noch offen' },
  conflict: { label: 'Konflikt', icon: 'triangle-alert', cls: 'conflict', hint: 'Zeitkonflikt / Risiko' },
  idea: { label: 'Idee', icon: 'sparkles', cls: 'idea', hint: 'Nur eine Idee' },
  planned: { label: 'Geplant', icon: 'circle-dot', cls: 'planned', hint: 'Eigene Planung – nicht gebucht' },
  confirmed: { label: 'Bestätigt', icon: 'circle-check', cls: 'booked', hint: 'Manuell als reserviert/bestätigt markiert' },
  done: { label: 'Erledigt', icon: 'check', cls: 'done', hint: 'Erledigt' },
};

export const badge = (status, extra = '') => {
  const s = STATUS[status] || STATUS.open;
  return html`<span class="badge s-${s.cls} ${extra}" title="${s.hint}">${icon(s.icon)}${s.label}</span>`;
};

export const lockNote = (what = 'Diese Angabe') => html`<a class="lock-note" href="#/private">${icon('lock')}<span>${what} ist privat. Zum Anzeigen private Daten entsperren.</span></a>`;

/* ---------- Navigationslinks ---------- */
export function navUrlFor(id) {
  const p = place(id);
  if (!p) return null;
  return mapsDirUrl(p.query ? { query: p.query } : p);
}
export function routeUrl(route) {
  const a = place(route.from), b = place(route.to);
  if (!a || !b) return null;
  return mapsDirUrl(b.query ? { query: b.query } : b, a.query ? { query: a.query } : a);
}
export function placeMapsUrl(p) {
  if (p.mapsUrl) return p.mapsUrl;
  if (p.query) return mapsSearchUrl({ query: p.query });
  if (p.lat != null) return mapsSearchUrl(p.name && p.source === 'osm' ? { query: `${p.name} ${p.lat},${p.lng}` } : p);
  return null;
}

/* ---------- Ereigniszeile (Timeline) ---------- */
export function timeCell(e) {
  if (e.kind === 'user') return e.time ? html`<b>${e.time}</b>` : html`<span class="muted">–</span>`;
  if (e.timeLabel) return html`<b class="${e.status === 'approx' ? 'approx-time' : ''}">${e.timeLabel}</b>`;
  if (e.time) return html`<b>${e.time}</b>`;
  return html`<span class="muted">offen</span>`;
}

export function eventRow(e, { compact = false } = {}) {
  const st = e.kind === 'user' ? e.status : e.status;
  const nav = e.route ? routeUrl(e.route) : e.place ? navUrlFor(e.place) : e.placeData ? placeMapsUrl(e.placeData) : null;
  return html`
  <article class="tl-item st-${(STATUS[st] || STATUS.open).cls}" data-event="${e.id}" data-kind="${e.kind}">
    <div class="tl-time">${timeCell(e)}</div>
    <div class="tl-dot">${icon(e.icon || (e.kind === 'user' ? 'circle-dot' : 'circle'))}</div>
    <div class="tl-body">
      <button class="tl-main" data-action="${e.kind === 'user' ? 'edit-item' : 'event-detail'}" data-id="${e.id}">
        <span class="tl-title">${e.title}</span>
        ${e.subtitle ? html`<span class="tl-sub">${e.subtitle}</span>` : ''}
        ${e.kind === 'user' && e.placeData?.name ? html`<span class="tl-sub">${icon('map-pin', 'xs')} ${e.placeData.name}</span>` : ''}
        ${e.kind === 'user' && e.duration ? html`<span class="tl-sub">${icon('hourglass', 'xs')} ${e.duration} Min. (eigene Schätzung)</span>` : ''}
      </button>
      ${e.warn ? html`<p class="tl-warn">${icon('triangle-alert', 'xs')} ${e.warn}</p>` : ''}
      ${!compact ? html`<div class="tl-meta">
        ${badge(st)}
        ${e.kind === 'user' && e.priority === 'high' ? html`<span class="badge s-prio">${icon('flag-triangle-right')}Wichtig</span>` : ''}
        ${nav ? html`<a class="chip-btn" href="${nav}" target="_blank" rel="noopener">${icon('navigation')}${e.route ? 'Route' : 'Navigieren'}</a>`
              : (e.route || e.place) && !unlocked() ? html`<a class="chip-btn ghost" href="#/private">${icon('lock')}Ziel privat</a>` : ''}
      </div>` : ''}
    </div>
  </article>`;
}

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg, ms = 2600) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------- Bottom Sheet ---------- */
let openSheets = 0;
export function sheet(content, { title = '', onMount, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = String(html`
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sheet-grip" aria-hidden="true"></div>
      <header class="sheet-head">
        <h2>${title}</h2>
        <button class="icon-btn" data-close aria-label="Schliessen">${icon('x')}</button>
      </header>
      <div class="sheet-body">${raw(String(content))}</div>
    </section>`);
  document.body.appendChild(wrap);
  openSheets++; document.body.classList.add('sheet-open');
  const prevFocus = document.activeElement;
  requestAnimationFrame(() => wrap.classList.add('show'));
  const close = () => {
    wrap.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { wrap.remove(); if (--openSheets <= 0) { openSheets = 0; document.body.classList.remove('sheet-open'); } prevFocus?.focus?.(); }, 220);
    onClose?.();
  };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) close(); });
  const body = wrap.querySelector('.sheet-body');
  onMount?.(body, close);
  setTimeout(() => (wrap.querySelector('.sheet-body input, .sheet-body button, .sheet-body a') || wrap.querySelector('[data-close]'))?.focus({ preventScroll: true }), 60);
  return close;
}

export function confirmDialog(text, { ok = 'OK', danger = false, title = 'Bitte bestätigen' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    sheet(html`<p class="lead">${text}</p>
      <div class="btn-row"><button class="btn ghost" data-close>Abbrechen</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${ok}</button></div>`, {
      title,
      onMount: (b, close) => b.querySelector('[data-ok]').addEventListener('click', () => { answered = true; resolve(true); close(); }),
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

export const emptyState = (ic, title, text, action = '') => html`
  <div class="empty">${icon(ic, 'lg')}<h3>${title}</h3><p>${text}</p>${action}</div>`;

export const kv = (label, value, { open = false, mono = false, copy = false } = {}) => html`
  <div class="kv"><dt>${label}</dt><dd class="${open ? 'is-open' : ''} ${mono ? 'mono' : ''}">
    ${open ? html`${icon('circle-dashed', 'xs')} Offen` : value}
    ${copy && !open ? html`<button class="icon-btn sm" data-copy="${String(value)}" aria-label="${label} kopieren">${icon('copy')}</button>` : ''}
  </dd></div>`;

export const pageHead = (title, sub = '', back = '') => html`
  <header class="page-head">
    ${back ? html`<a class="icon-btn back" href="${back}" aria-label="Zurück">${icon('chevron-left')}</a>` : ''}
    <div><h1>${title}</h1>${sub ? html`<p class="page-sub">${sub}</p>` : ''}</div>
  </header>`;

export { fmtTime };
