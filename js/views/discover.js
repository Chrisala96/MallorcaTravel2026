import { html, icon, haversineKm, fmtKm, mapsSearchUrl, mapsDirUrl, fmtTime, fmtDate } from '../util.js';
import * as M from '../model.js';
import { CATEGORIES, catById, search, isOpenNow } from '../overpass.js';
import { sheet, toast, emptyState, placeMapsUrl } from '../ui.js';
import { openPlaceDetail, openShareChooser, openManualPlace } from '../details.js';

const S = { favCat: 'all', tab: 'food', cat: null, term: '', baseId: null, radius: 5, openOnly: false, io: 'all', rainOk: false, sort: 'dist', results: null, loading: false, error: null, meta: null, gps: null };

const RADII = [1, 2, 5, 10, 20, 30];

function base() {
  const b = M.searchBases().find((x) => x.id === S.baseId);
  if (b?.gps) return S.gps ? { ...b, ...S.gps } : b;
  return b;
}

function applyFilters(list) {
  const b = base();
  let out = list.map((p) => ({ ...p, _dist: b?.lat != null ? haversineKm(b, p) : null, _open: isOpenNow(p.openingHours) }));
  if (S.openOnly) out = out.filter((p) => p._open === true);
  if (S.io !== 'all') out = out.filter((p) => { const c = catById(p.category); return c && (c.io === S.io || c.io === 'mixed'); });
  if (S.rainOk) out = out.filter((p) => catById(p.category)?.rain);
  out.sort(S.sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'de') : (a, b) => (a._dist ?? 1e9) - (b._dist ?? 1e9));
  return out;
}

function card(p) {
  const c = catById(p.category);
  const fav = M.isFav(p);
  const nav = p.lat != null ? mapsDirUrl(p) : placeMapsUrl(p);
  return html`<article class="place-card">
    <button class="pc-main" data-open="${M.placeKey(p)}">
      <span class="pc-ic cat-${c?.group || 'x'}">${icon(c?.icon || 'map-pin')}</span>
      <span class="pc-txt"><b>${p.name}</b>
        ${M.favOf(p)?.myRating ? html`<span class="own-rating" title="Unsere eigene Bewertung">${Array.from({ length: M.favOf(p).myRating }, () => icon('star', 'filled'))} unsere Bewertung</span>` : ''}
        <small>${c?.label || 'Ort'}${p.cuisine ? ' · ' + p.cuisine : ''}</small>
        <small class="pc-meta">${p._dist != null ? html`${icon('navigation', 'xs')} ${fmtKm(p._dist)} Luftlinie` : ''}
          ${p._open === true ? html`<span class="ok">· laut OSM geöffnet</span>` : p._open === false ? html`<span class="muted">· laut OSM geschlossen</span>` : ''}</small>
        ${p.address ? html`<small class="muted">${p.address}</small>` : ''}</span>
    </button>
    <div class="pc-actions">
      <button class="icon-btn ${fav ? 'fav-on' : ''}" data-fav="${M.placeKey(p)}" aria-pressed="${fav}" aria-label="${fav ? 'Aus Favoriten entfernen' : 'Als Favorit speichern'}">${icon('heart', fav ? 'filled' : '')}</button>
      ${nav ? html`<a class="icon-btn" href="${nav}" target="_blank" rel="noopener" aria-label="Navigation zu ${p.name}">${icon('navigation')}</a>` : ''}
      <button class="icon-btn" data-share="${M.placeKey(p)}" aria-label="${p.name} teilen">${icon('share-2')}</button>
    </div></article>`;
}

export function render(root, params, query) {
  if (query.get('tab')) S.tab = query.get('tab');
  if (!S.baseId) S.baseId = M.defaultBase();
  let pool = []; // aktuell angezeigte Orte (für Klick-Zuordnung)

  const draw = () => {
    const b = base();
    const cats = CATEGORIES.filter((c) => c.group === S.tab);
    const favs = M.state.favorites.filter((f) => S.favCat === 'all' || (S.favCat === 'rated' ? f.myRating > 0 : catById(f.category)?.group === S.favCat));
    let list = S.tab === 'fav' ? applyFilters(favs) : S.results ? applyFilters(S.results) : null;
    if (S.tab === 'fav' && S.favCat === 'rated') list = list.sort((a, b) => (b.myRating || 0) - (a.myRating || 0));
    pool = S.tab === 'fav' ? M.state.favorites : S.results || [];
    const cat = catById(S.cat);
    const gQuery = (cat?.g || S.term || (S.tab === 'food' ? 'Restaurant' : 'Sehenswürdigkeiten'));
    const gUrl = b?.lat != null ? mapsSearchUrl({ query: `${gQuery} near ${b.lat.toFixed(5)},${b.lng.toFixed(5)}` }) : mapsSearchUrl({ query: `${gQuery} ${b?.region === 'nuerburg' ? 'Nürburg' : 'Mallorca'}` });
    const activeFilters = (S.openOnly ? 1 : 0) + (S.io !== 'all' ? 1 : 0) + (S.rainOk ? 1 : 0) + (S.radius !== 5 ? 1 : 0);
    root.innerHTML = String(html`
    <div class="page discover">
      <header class="page-head"><div><h1>Entdecken</h1><p class="page-sub">Restaurants & Aktivitäten</p></div>
        <button class="icon-btn" data-act="manual" aria-label="Ort manuell hinzufügen">${icon('plus')}</button></header>
      <div class="seg tabs" role="tablist">
        ${[['food', 'utensils', 'Essen'], ['activity', 'compass', 'Aktivitäten'], ['fav', 'heart', `Favoriten${M.state.favorites.length ? ' ' + M.state.favorites.length : ''}`]].map(([id, ic, l]) =>
          html`<button role="tab" aria-selected="${S.tab === id}" class="${S.tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic)}${l}</button>`)}
      </div>
      ${S.tab !== 'fav' ? html`
      <div class="base-row">${icon('map-pin', 'xs')}<span>Ausgangspunkt:</span>
        ${M.searchBases().map((x) => html`<button class="chip ${x.id === S.baseId ? 'on' : ''}" data-base="${x.id}" ${x.locked ? 'data-locked' : ''}>${x.locked ? icon('lock', 'xs') : ''}${x.label}</button>`)}</div>
      <form class="search" role="search" data-search>
        ${icon('search')}<input type="search" name="q" value="${S.term}" placeholder="Name oder Küche, z. B. Paella" enterkeyhint="search" autocomplete="off" aria-label="Suchbegriff">
        <button type="button" class="icon-btn sm ${activeFilters ? 'on' : ''}" data-act="filters" aria-label="Filter">${icon('sliders-horizontal')}${activeFilters ? html`<i class="badge-dot">${activeFilters}</i>` : ''}</button>
      </form>
      <div class="chips-scroll" role="list">${cats.map((c) => html`<button role="listitem" class="chip big ${S.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${icon(c.icon)}${c.label}</button>`)}</div>
      ` : html`<div class="chips-scroll">${[['all', 'Alle'], ['food', 'Essen'], ['activity', 'Aktivitäten'], ['rated', 'Von uns bewertet']].map(([k, l]) => html`<button class="chip big ${S.favCat === k ? 'on' : ''}" data-favcat="${k}">${l}</button>`)}</div>
      <div class="btn-row"><button class="btn ghost" data-act="manual">${icon('plus')} Ort manuell hinzufügen</button></div>`}

      <div class="results" aria-live="polite">
        ${S.loading ? html`<div class="loading">${[1, 2, 3, 4].map(() => html`<div class="skeleton"></div>`)}</div>` : ''}
        ${!S.loading && S.error && S.tab !== 'fav' ? html`<div class="alert warn">${icon('wifi-off')}<div><b>Live-Suche nicht möglich</b><span>${S.error}</span><small>Alternative: gezielte Suche in Google Maps (Button unten).</small></div></div>` : ''}
        ${!S.loading && S.meta?.stale && S.tab !== 'fav' ? html`<p class="hint">${icon('wifi-off')} Offline – zuletzt geladene Ergebnisse vom ${fmtDate(new Date(S.meta.fetchedAt))} ${fmtTime(new Date(S.meta.fetchedAt))}.</p>` : ''}
        ${!S.loading && list ? (list.length ? html`<p class="result-count">${list.length} ${list.length === 1 ? 'Ort' : 'Orte'}${S.tab !== 'fav' ? ` im Umkreis von ${S.radius} km` : ''}</p>${list.slice(0, 80).map(card)}`
          : S.tab === 'fav' ? emptyState('heart', 'Noch keine Favoriten', 'Tippe bei einem Ort auf das Herz, um ihn hier zu speichern.')
          : emptyState('search', 'Keine Treffer', 'OpenStreetMap kennt hier nichts Passendes. Grösseren Radius wählen oder Google Maps nutzen.')) : ''}
        ${!S.loading && !list && S.tab !== 'fav' ? html`<div class="intro card soft">${icon('compass', 'lg')}<p>Wähle eine Kategorie oder gib einen Suchbegriff ein. Die Suche nutzt Live-Daten von OpenStreetMap.</p></div>` : ''}
      </div>

      ${S.tab !== 'fav' ? html`<a class="btn ghost wide" href="${gUrl}" target="_blank" rel="noopener">${icon('external-link')} „${gQuery}“ in Google Maps suchen</a>` : ''}
      <p class="source">${S.tab === 'fav' ? 'Favoriten und eigene Bewertungen sind nur auf diesem Gerät gespeichert.' : html`Daten: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap-Mitwirkende</a> via Overpass API. Bewertungen, Rezensionen und Preisniveaus sind in OSM nicht enthalten – „Bewertungen & Fotos“ öffnet Google Maps. Entfernungen sind Luftlinie.`}</p>
    </div>`);
  };

  async function run() {
    const b = base();
    const cat = catById(S.cat);
    if (cat?.googleOnly) { S.results = null; S.error = null; draw(); toast(cat.googleNote, 4500); return; }
    if (!cat && !S.term.trim()) { S.results = null; draw(); return; }
    if (b?.gps && !S.gps) { locate(); return; }
    if (!b || b.lat == null) { toast('Ausgangspunkt nicht verfügbar'); return; }
    S.loading = true; S.error = null; draw();
    try {
      const r = await search({ cat, term: S.term.trim(), lat: b.lat, lng: b.lng, radius: S.radius * 1000 });
      S.results = r.places; S.meta = r; S.error = r.stale ? (r.error || 'Keine Verbindung') : null;
    } catch (e) {
      S.results = null; S.meta = null;
      S.error = navigator.onLine ? `Der OpenStreetMap-Dienst antwortet gerade nicht (${e.message}).` : 'Keine Internetverbindung.';
    }
    S.loading = false; draw();
  }

  function locate() {
    if (!navigator.geolocation) { toast('Standort wird von diesem Browser nicht unterstützt'); return; }
    toast('Standort wird ermittelt …');
    navigator.geolocation.getCurrentPosition((pos) => { S.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude }; run(); },
      () => { toast('Standortfreigabe abgelehnt oder nicht verfügbar'); S.baseId = M.defaultBase(); draw(); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
  }

  function filters() {
    sheet(html`<form class="form" data-f>
      <fieldset class="field"><legend>Umkreis</legend><div class="seg">${RADII.map((r) => html`<label class="seg-opt"><input type="radio" name="radius" value="${r}" ${S.radius === r ? 'checked' : ''}><span>${r} km</span></label>`)}</div></fieldset>
      <label class="switch"><input type="checkbox" name="openOnly" ${S.openOnly ? 'checked' : ''}><span></span>Nur jetzt geöffnet <small>(nur wenn OSM-Öffnungszeiten eindeutig auswertbar sind)</small></label>
      <fieldset class="field"><legend>Indoor / Outdoor</legend><div class="seg">${[['all', 'Alle'], ['indoor', 'Indoor'], ['outdoor', 'Outdoor']].map(([v, l]) => html`<label class="seg-opt"><input type="radio" name="io" value="${v}" ${S.io === v ? 'checked' : ''}><span>${l}</span></label>`)}</div></fieldset>
      <label class="switch"><input type="checkbox" name="rainOk" ${S.rainOk ? 'checked' : ''}><span></span>Bei Regen geeignet</label>
      <fieldset class="field"><legend>Sortierung</legend><div class="seg">${[['dist', 'Entfernung'], ['name', 'Name']].map(([v, l]) => html`<label class="seg-opt"><input type="radio" name="sort" value="${v}" ${S.sort === v ? 'checked' : ''}><span>${l}</span></label>`)}</div></fieldset>
      <div class="disabled-filters"><p>${icon('info')} <b>Bewertung, Anzahl Bewertungen, Preisniveau</b> – nicht verfügbar: OpenStreetMap enthält diese Daten nicht, und Google Places würde einen kostenpflichtigen API-Schlüssel benötigen. Bewertungen bitte direkt in Google Maps ansehen.</p>
      <p>Indoor/Outdoor, Regen-Eignung und Dauer sind Eigenschaften der <i>Kategorie</i>, nicht des einzelnen Orts.</p></div>
      <button class="btn primary" type="submit">Anwenden</button></form>`, {
      title: 'Filter',
      onMount: (b, close) => b.querySelector('form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const oldR = S.radius;
        S.radius = +f.get('radius'); S.openOnly = f.get('openOnly') === 'on'; S.io = f.get('io'); S.rainOk = f.get('rainOk') === 'on'; S.sort = f.get('sort');
        close(); if (oldR !== S.radius && S.results) run(); else draw();
      }),
    });
  }

  draw();
  root.onclick = async (ev) => {
    const t = ev.target;
    const fc = t.closest('[data-favcat]'); if (fc) { S.favCat = fc.dataset.favcat; draw(); return; }
    const tab = t.closest('[data-tab]'); if (tab) { S.tab = tab.dataset.tab; S.cat = null; S.results = null; S.error = null; draw(); return; }
    const bs = t.closest('[data-base]');
    if (bs) {
      if (bs.hasAttribute('data-locked')) { location.hash = '#/private'; return; }
      S.baseId = bs.dataset.base; if (bs.dataset.base !== 'gps') S.gps = null;
      if (S.cat || S.term) run(); else if (S.baseId === 'gps') locate(); else draw();
      return;
    }
    const c = t.closest('[data-cat]'); if (c) { S.cat = S.cat === c.dataset.cat ? null : c.dataset.cat; S.term = ''; if (S.cat) run(); else { S.results = null; draw(); } return; }
    const o = t.closest('[data-open]'); if (o) { const p = pool.find((x) => M.placeKey(x) === o.dataset.open); if (p) openPlaceDetail(p, { base: base() }); return; }
    const f = t.closest('[data-fav]'); if (f) { const p = pool.find((x) => M.placeKey(x) === f.dataset.fav); if (p) { const on = await M.toggleFav(p); toast(on ? 'Als Favorit gespeichert' : 'Aus Favoriten entfernt'); } return; }
    const s = t.closest('[data-share]'); if (s) { const p = pool.find((x) => M.placeKey(x) === s.dataset.share); if (p) openShareChooser(p); return; }
    const a = t.closest('[data-act]');
    if (a?.dataset.act === 'filters') filters();
    if (a?.dataset.act === 'manual') openManualPlace();
  };
  root.onsubmit = (ev) => {
    if (!ev.target.matches('[data-search]')) return;
    ev.preventDefault();
    S.term = ev.target.elements.q.value; S.cat = null;
    ev.target.elements.q.blur();
    run();
  };
  const onState = (ev) => { if (ev.detail?.includes('favorites') || ev.detail?.includes('priv')) draw(); };
  window.addEventListener('statechange', onState);
  return () => { window.removeEventListener('statechange', onState); root.onclick = null; root.onsubmit = null; };
}
