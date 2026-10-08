import { html, icon, mapsDirUrl } from '../util.js';
import * as M from '../model.js';
import { catById } from '../overpass.js';
import { toast as uiToast } from '../ui.js';
import { openPlaceDetail } from '../details.js';

let leafletLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js';
    s.onload = () => resolve(window.L); s.onerror = () => { leafletLoading = null; reject(new Error('Karte konnte nicht geladen werden')); };
    document.head.appendChild(s);
  });
  return leafletLoading;
}

const F = { trip: true, fav: true, plan: true };
const VIEWS = {
  mallorca: [[39.25, 2.30], [40.00, 3.50]],
  nuerburg: [[50.25, 6.80], [50.45, 7.10]],
  all: [[39.2, 2.2], [50.6, 9.4]],
};

function markerIcon(L, ic, cls) {
  return L.divIcon({ className: 'mk-wrap', html: `<span class="mk ${cls}">${String(icon(ic))}</span>`, iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18] });
}

export function render(root, params, query) {
  root.innerHTML = String(html`
    <div class="page map-page">
      <div id="map" class="map" role="application" aria-label="Karte"></div>
      <div class="map-top">
        <div class="chips-scroll">
          ${[['trip', 'flag', 'Reise'], ['fav', 'heart', 'Favoriten'], ['plan', 'calendar-range', 'Reiseplan']].map(([k, ic, l]) => html`<button class="chip glass ${F[k] ? 'on' : ''}" data-f="${k}" aria-pressed="${F[k]}">${icon(ic)}${l}</button>`)}
        </div>
        <div class="chips-scroll">
          ${[['mallorca', 'Mallorca'], ['nuerburg', 'Nürburgring'], ['all', 'Alles']].map(([k, l]) => html`<button class="chip glass" data-v="${k}">${l}</button>`)}
        </div>
      </div>
      <button class="fab locate" data-locate aria-label="Meinen Standort anzeigen">${icon('locate-fixed')}</button>
      <div class="map-msg" hidden></div>
    </div>`);
  let map, layers = {}, me;
  let alive = true;

  loadLeaflet().then((L) => {
    if (!alive) return;
    map = L.map(root.querySelector('#map'), { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
    let tileErr = 0;
    tiles.on('tileerror', () => { if (++tileErr === 3) showMsg(navigator.onLine ? 'Kartenkacheln konnten nicht geladen werden.' : 'Offline – Kartenhintergrund nicht verfügbar. Marker und Navigation-Links funktionieren weiter.'); });
    draw(L);
    const focus = query.get('focus');
    const fp = focus && M.place(focus);
    if (fp?.lat != null) { map.setView([fp.lat, fp.lng], fp.approx ? 12 : 15); layers.trip?.eachLayer((m) => m.options.pid === focus && m.openPopup()); }
    else {
      const d = M.currentDay();
      if (M.phase() === 'during' && d) map.fitBounds(VIEWS[d.region === 'nuerburg' ? 'nuerburg' : 'mallorca']);
      else { const pts = []; layers.trip.eachLayer((m) => pts.push(m.getLatLng())); pts.length ? map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] }) : map.fitBounds(VIEWS.all); }
    }
    setTimeout(() => map.invalidateSize(), 150);
  }).catch((e) => showMsg(e.message + ' Bitte Seite neu laden.'));

  function showMsg(t) { const m = root.querySelector('.map-msg'); m.textContent = t; m.hidden = false; }

  function popup(p, extra = '') {
    const nav = p.query ? mapsDirUrl({ query: p.query }) : mapsDirUrl(p);
    return `<div class="pop"><b>${String(html`${p.name}`)}</b>${extra}
      ${p.approxNote ? `<small>${String(html`${p.approxNote}`)}</small>` : ''}${p.coordNote ? `<small>${String(html`${p.coordNote}`)}</small>` : ''}
      <div class="pop-btns"><a class="btn primary sm" href="${nav}" target="_blank" rel="noopener">${String(icon('navigation'))} Navigieren</a>
      ${p.source ? `<button class="btn ghost sm" data-pop-open="${String(html`${M.placeKey(p)}`)}">Details</button>` : ''}</div></div>`;
  }

  function draw(L) {
    Object.values(layers).forEach((l) => l.remove());
    layers = { trip: L.layerGroup(), fav: L.layerGroup(), plan: L.layerGroup() };
    const tripIds = ['meet', 'hotel', 'str', 'pmi', 'sixt', 'villa'];
    const icons = { meet: 'flag', hotel: 'bed-double', str: 'plane', pmi: 'plane', sixt: 'car', villa: 'house' };
    for (const id of tripIds) {
      const p = M.place(id);
      if (!p || p.lat == null) continue;
      L.marker([p.lat, p.lng], { icon: markerIcon(L, icons[id], id === 'villa' ? 'villa' : p.approx ? 'trip approx' : 'trip'), pid: id, title: p.name, keyboard: true })
        .bindPopup(popup(p, p.address ? `<small>${String(html`${p.address}`)}</small>` : '')).addTo(layers.trip);
    }
    for (const f of M.state.favorites) {
      if (f.lat == null) continue;
      const c = catById(f.category);
      L.marker([f.lat, f.lng], { icon: markerIcon(L, c?.icon || 'heart', 'fav'), title: f.name }).bindPopup(popup(f, c ? `<small>${c.label}</small>` : '')).addTo(layers.fav);
    }
    for (const it of M.state.plan) {
      const p = it.placeData;
      if (!p || p.lat == null) continue;
      L.marker([p.lat, p.lng], { icon: markerIcon(L, 'calendar-range', 'plan'), title: it.title })
        .bindPopup(popup({ ...p, name: it.title }, `<small>${String(html`${it.date.split('-').reverse().slice(0, 2).join('.')}. ${it.time || ''} · ${p.name}`)}</small>`)).addTo(layers.plan);
    }
    for (const k of Object.keys(layers)) if (F[k]) layers[k].addTo(map);
  }

  root.onclick = (ev) => {
    const f = ev.target.closest('[data-f]');
    if (f && map) { const k = f.dataset.f; F[k] = !F[k]; f.classList.toggle('on', F[k]); f.setAttribute('aria-pressed', F[k]); F[k] ? layers[k].addTo(map) : layers[k].remove(); return; }
    const v = ev.target.closest('[data-v]');
    if (v && map) { if (v.dataset.v === 'all') { const pts = []; layers.trip.eachLayer((m) => pts.push(m.getLatLng())); map.fitBounds(pts.length ? window.L.latLngBounds(pts) : VIEWS.all, { padding: [40, 40] }); } else map.fitBounds(VIEWS[v.dataset.v]); return; }
    const po = ev.target.closest('[data-pop-open]');
    if (po) { const p = [...M.state.favorites, ...M.state.plan.map((i) => i.placeData).filter(Boolean)].find((x) => M.placeKey(x) === po.dataset.popOpen); if (p) openPlaceDetail(p); return; }
    if (ev.target.closest('[data-locate]') && map) {
      if (!navigator.geolocation) { uiToast('Standort wird nicht unterstützt'); return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        me?.remove();
        me = window.L.circleMarker(ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#2b7cff', fillOpacity: 1 }).addTo(map).bindPopup('Mein Standort');
        map.setView(ll, 14);
      }, () => uiToast('Standort nicht verfügbar oder Freigabe abgelehnt'), { timeout: 15000, maximumAge: 60000 });
    }
  };
  const onState = () => { if (map && window.L) draw(window.L); };
  window.addEventListener('statechange', onState);
  return () => { alive = false; window.removeEventListener('statechange', onState); map?.remove(); root.onclick = null; };
}
