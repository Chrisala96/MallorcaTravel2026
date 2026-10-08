// Einstiegspunkt: lädt Zustand, steuert Navigation (Hash-Router), Theme, Service Worker.
import { html, icon, $, $$, copyText, setSimulatedNow } from './util.js';
import * as M from './model.js';
import { toast } from './ui.js';
import { unlockWithPassphrase, refreshPrivate } from './privacy.js';
import * as home from './views/home.js';
import * as plan from './views/plan.js';
import * as discover from './views/discover.js';
import * as mapView from './views/map.js';
import * as more from './views/more.js';

const TABS = [
  ['home', 'house', 'Home'],
  ['plan', 'calendar-range', 'Reiseplan'],
  ['discover', 'compass', 'Entdecken'],
  ['map', 'map', 'Karte'],
  ['more', 'circle-ellipsis', 'Mehr'],
];
const MORE_PAGES = ['more', 'booking', 'bookings', 'villa', 'parking', 'checklist', 'docs', 'private', 'backup', 'settings', 'about'];

let cleanup = null;
let currentKey = '';

function shell() {
  document.body.innerHTML = String(html`
    <a class="skip" href="#view">Zum Inhalt springen</a>
    <div id="offline" class="offline-bar" hidden>${icon('wifi-off')} Offline – gespeicherte Daten werden angezeigt</div>
    <main id="view" tabindex="-1"></main>
    <nav class="tabbar" aria-label="Hauptnavigation">
      ${TABS.map(([id, ic, label]) => html`<a href="#/${id}" data-tab="${id}">${icon(ic)}<span>${label}</span><i class="tab-dot" hidden></i></a>`)}
    </nav>`);
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { page: parts[0] || 'home', params: parts.slice(1), query: new URLSearchParams(qs) };
}

function route() {
  const { page, params, query } = parseHash();
  const key = location.hash;
  if (key === currentKey) return;
  currentKey = key;
  const view = $('#view');
  cleanup?.(); cleanup = null;
  let mod, tab = page;
  if (page === 'home') mod = home;
  else if (page === 'plan') mod = plan;
  else if (page === 'discover') mod = discover;
  else if (page === 'map') mod = mapView;
  else if (MORE_PAGES.includes(page)) { mod = more; tab = 'more'; }
  else { location.replace('#/home'); return; }
  $$('.tabbar a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  document.body.dataset.page = page;
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  try { cleanup = mod.render(view, params, query, page) || null; }
  catch (e) { console.error(e); view.innerHTML = `<div class="page"><div class="alert danger"><b>Fehler beim Anzeigen</b><span>${String(e.message).replace(/</g, '&lt;')}</span></div></div>`; }
  window.scrollTo(0, 0);
  if (!query.has('focus')) view.focus({ preventScroll: true });
  updateTabDots();
}

function updateTabDots() {
  const conflicts = M.alerts().some((a) => a.level === 'danger');
  const dot = $('.tabbar a[data-tab="home"] .tab-dot');
  if (dot) dot.hidden = !conflicts;
}

function applyTheme() {
  const t = M.state.settings.theme;
  document.documentElement.dataset.theme = t === 'auto' ? '' : t;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111416' : '#f5f1ea');
}

function online() { const b = $('#offline'); if (b) b.hidden = navigator.onLine; }

async function handleUnlockLink() {
  // Freischalt-Link: …/#k=passwort – der Hash wird nie an einen Server übertragen.
  const m = location.hash.match(/^#k=(.+)$/);
  if (!m) return;
  const pass = decodeURIComponent(m[1]);
  history.replaceState(null, '', location.pathname + location.search + '#/home');
  if (M.unlocked()) return;
  try { await unlockWithPassphrase(pass); toast('Private Daten entsperrt'); }
  catch (e) { toast('Freischalt-Link ungültig: ' + e.message, 4500); }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          const bar = document.createElement('div');
          bar.className = 'update-bar';
          bar.innerHTML = String(html`<span>Neue Version verfügbar</span><button class="btn light sm">Aktualisieren</button>`);
          bar.querySelector('button').onclick = () => { nw.postMessage('skipWaiting'); };
          document.body.appendChild(bar);
        }
      });
    });
  }).catch((e) => console.warn('Service Worker nicht registriert:', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

async function start() {
  shell();
  try { await M.load(); } catch (e) { console.error(e); toast('Lokaler Speicher nicht verfügbar – Daten werden nicht gespeichert.', 5000); }
  if (M.state.settings.simulate) setSimulatedNow(M.state.settings.simulate + ':00+02:00');
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  await handleUnlockLink();
  const syncCentral = async () => {
    const r = await refreshPrivate();
    if (r === true) toast('Zentrale Reisedaten aktualisiert');
    if (r === 'password') toast('Reise-Passwort wurde geändert – bitte unter Mehr → Private Daten neu entsperren.', 6000);
  };
  syncCentral();
  window.addEventListener('online', syncCentral);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncCentral(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('statechange', (ev) => {
    if (ev.detail?.includes('settings')) { applyTheme(); if (!M.state.settings.simulate) setSimulatedNow(null); currentKey = ''; route(); }
    updateTabDots();
  });
  window.addEventListener('online', online); window.addEventListener('offline', online); online();
  // Globale Kopierfunktion
  document.addEventListener('click', async (ev) => {
    const c = ev.target.closest('[data-copy]');
    if (c) { ev.preventDefault(); toast((await copyText(c.dataset.copy)) ? 'Kopiert' : 'Kopieren nicht möglich'); }
  });
  if (!location.hash || location.hash === '#') location.replace('#/home');
  route();
  registerSW();
}

start();
