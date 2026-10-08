// Detail-Sheets: feste Termine, eigene Aktivitäten (Editor), Orte.
import { html, icon, fmtDateLong, dateFromKey, mapsDirUrl, share, uid, fmtKm, haversineKm, isHttpUrl, parseCoords } from './util.js';
import * as M from './model.js';
import { DAYS, PLACES } from './data.js';
import { sheet, badge, STATUS, routeUrl, navUrlFor, placeMapsUrl, toast, confirmDialog, lockNote } from './ui.js';
import { catById, isOpenNow, CATEGORIES } from './overpass.js';

const dayLabel = (d) => fmtDateLong(dateFromKey(d));
const timeText = (e) => (e.kind === 'user' ? e.time || 'ohne Uhrzeit' : e.timeLabel || e.time || 'Zeit offen');

/* ---------- Teilen (ohne sensible Daten) ---------- */
export function eventShareText(e) {
  const lines = [`${e.title}`, `${dayLabel(e.date)} · ${timeText(e)}`];
  if (e.kind === 'user') {
    if (e.placeData?.name) lines.push(`Ort: ${e.placeData.name}`);
    const u = e.placeData ? placeMapsUrl(e.placeData) : null;
    if (u) lines.push(`Google Maps: ${u}`);
  } else {
    if (e.subtitle) lines.push(e.subtitle);
    // Nur öffentliche Orte verlinken (keine Villa, keine Privatadresse).
    const pid = e.place && PLACES[e.place] ? e.place : e.route && PLACES[e.route.to] ? e.route.to : null;
    if (pid) { const p = PLACES[pid]; lines.push(`Google Maps: ${placeMapsUrl(p)}`); }
  }
  return lines.join('\n');
}
export function dayShareText(date) {
  const d = DAYS.find((x) => x.date === date);
  const { timed, untimed } = M.dayTimeline(date);
  const lines = [`${dayLabel(date)} – ${d?.title || ''}`, ''];
  for (const e of timed) lines.push(`${timeText(e)}  ${e.title}${e.kind === 'user' && e.placeData?.name ? ' (' + e.placeData.name + ')' : ''}`);
  if (untimed.length) { lines.push('', 'Ohne feste Uhrzeit:'); for (const e of untimed) lines.push(`• ${e.title}${e.placeData?.name ? ' (' + e.placeData.name + ')' : ''}`); }
  if (!timed.length && !untimed.length) lines.push('Noch nichts geplant.');
  return lines.join('\n');
}
export function placeShareText(p, withQuestion = false) {
  const cat = catById(p.category);
  const lines = [p.name];
  if (cat) lines.push(`Kategorie: ${cat.label}`);
  if (p.lat != null) lines.push(`Standort: ${p.lat < 45 ? 'Mallorca' : 'Eifel / Nürburgring'}`);
  const u = placeMapsUrl(p); if (u) lines.push(`Google-Maps-Link: ${u}`);
  if (withQuestion) lines.push('', cat?.group === 'food' ? 'Wie wäre es, wenn wir heute Abend hier essen gehen?' : 'Wie wäre es, wenn wir hier hingehen?');
  return lines.join('\n');
}

/* ---------- Fester Termin ---------- */
export function openEventDetail(id) {
  const e = M.fixedEvents().find((x) => x.id === id);
  if (!e) return;
  const nav = e.route ? routeUrl(e.route) : e.place ? navUrlFor(e.place) : null;
  const p = e.place ? M.place(e.place) : null;
  sheet(html`
    <div class="detail-top">${badge(e.status)}<span class="muted">${dayLabel(e.date)}</span></div>
    <p class="detail-time">${icon('clock')} ${timeText(e)}</p>
    ${e.subtitle ? html`<p class="lead">${e.subtitle}</p>` : ''}
    ${e.warn ? html`<div class="alert danger">${icon('triangle-alert')}<div><b>${e.warn}</b></div></div>` : ''}
    ${(e.notes || []).length ? html`<ul class="notes">${e.notes.map((n) => html`<li>${n}</li>`)}</ul>` : ''}
    ${p?.address ? html`<p class="addr">${icon('map-pin')} ${p.address}</p>` : ''}
    ${e.route && !nav ? lockNote('Das Routenziel') : ''}
    ${e.route && nav ? html`<p class="hint">${icon('info')} Fahrzeit bitte in Google Maps prüfen – die App berechnet keine Fahrzeiten.</p>` : ''}
    <div class="btn-col">
      ${nav ? html`<a class="btn primary" href="${nav}" target="_blank" rel="noopener">${icon('navigation')} ${e.route ? 'Route in Google Maps' : 'Navigation starten'}</a>` : ''}
      ${p && p.lat != null ? html`<a class="btn ghost" href="#/map?focus=${p.id}" data-close>${icon('map')} Auf Karte zeigen</a>` : ''}
      ${e.booking ? html`<a class="btn ghost" href="${e.booking === 'parking' ? '#/parking' : e.booking === 'villa' ? '#/villa' : '#/booking/' + e.booking}" data-close>${icon('file-text')} Buchung anzeigen</a>` : ''}
      ${e.link && !e.booking ? html`<a class="btn ghost" href="${e.link}" data-close>${icon('chevron-right')} Details</a>` : ''}
      ${e.shareable ? html`<button class="btn ghost" data-share>${icon('share-2')} Teilen</button>` : ''}
    </div>`, {
    title: e.title,
    onMount: (b) => b.querySelector('[data-share]')?.addEventListener('click', () => share({ title: e.title, text: eventShareText(e) })),
  });
}

/* ---------- Editor für eigene Aktivitäten ---------- */
export function openItemEditor(item, { onSaved } = {}) {
  const isNew = !item?.id || !M.state.plan.some((p) => p.id === item.id);
  const it = { date: DAYS[0].date, time: '', duration: '', title: '', placeData: null, notes: '', priority: 'normal', status: 'planned', ...item };
  const favs = M.state.favorites;
  const statusOpts = ['idea', 'planned', 'confirmed', 'done'];
  sheet(html`
    <form class="form" novalidate>
      <label class="field"><span>Titel</span><input name="title" required maxlength="120" value="${it.title}" placeholder="z. B. Abendessen am Hafen" autocomplete="off"></label>
      <div class="grid2">
        <label class="field"><span>Tag</span><select name="date">${DAYS.map((d) => html`<option value="${d.date}" ${d.date === it.date ? 'selected' : ''}>${fmtDateLong(dateFromKey(d.date))}</option>`)}</select></label>
        <label class="field"><span>Startzeit</span><input type="time" name="time" value="${it.time}"></label>
      </div>
      <div class="grid2">
        <label class="field"><span>Dauer</span><select name="duration">${['', 30, 60, 90, 120, 180, 240, 360].map((m) => html`<option value="${m}" ${String(m) === String(it.duration) ? 'selected' : ''}>${m ? (m < 60 ? m + ' Min.' : m / 60 + ' Std.').replace('.5', ',5') : 'keine Angabe'}</option>`)}</select></label>
        <label class="field"><span>Priorität</span><select name="priority">
          <option value="normal" ${it.priority === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="high" ${it.priority === 'high' ? 'selected' : ''}>Wichtig</option>
          <option value="low" ${it.priority === 'low' ? 'selected' : ''}>Niedrig</option></select></label>
      </div>
      <fieldset class="field"><legend>Status</legend><div class="seg" role="radiogroup">
        ${statusOpts.map((s) => html`<label class="seg-opt"><input type="radio" name="status" value="${s}" ${it.status === s ? 'checked' : ''}><span>${icon(STATUS[s].icon)}${STATUS[s].label}</span></label>`)}
      </div><small class="muted">„Bestätigt“ nur wählen, wenn eine Reservierung tatsächlich bestätigt wurde.</small></fieldset>
      <fieldset class="field"><legend>Ort</legend>
        ${favs.length ? html`<select name="fav"><option value="">– Favorit wählen –</option>${favs.map((f) => html`<option value="${M.placeKey(f)}" ${it.placeData && M.placeKey(it.placeData) === M.placeKey(f) ? 'selected' : ''}>${f.name}</option>`)}</select>` : ''}
        <input name="placeName" placeholder="Ortsname (optional)" value="${it.placeData?.name || ''}" autocomplete="off">
        <input name="placeLink" inputmode="url" placeholder="Google-Maps-Link oder Koordinaten (optional)" value="${it.placeData?.mapsUrl || (it.placeData?.lat != null ? it.placeData.lat + ', ' + it.placeData.lng : '')}" autocomplete="off">
      </fieldset>
      <label class="field"><span>Notizen</span><textarea name="notes" rows="3" maxlength="2000">${it.notes}</textarea></label>
      <div class="btn-col">
        <button class="btn primary" type="submit">${icon('check')} ${isNew ? 'Hinzufügen' : 'Speichern'}</button>
        ${!isNew ? html`<div class="btn-row">
          <button class="btn ghost" type="button" data-share>${icon('share-2')} Teilen</button>
          ${it.placeData && placeMapsUrl(it.placeData) ? html`<a class="btn ghost" href="${placeMapsUrl(it.placeData)}" target="_blank" rel="noopener">${icon('navigation')} Maps</a>` : ''}
          <button class="btn danger-ghost" type="button" data-delete>${icon('trash-2')} Löschen</button></div>` : ''}
      </div>
    </form>`, {
    title: isNew ? 'Aktivität hinzufügen' : 'Aktivität bearbeiten',
    onMount: (b, close) => {
      const f = b.querySelector('form');
      const favSel = f.elements.fav;
      favSel?.addEventListener('change', () => {
        const fav = favs.find((x) => M.placeKey(x) === favSel.value);
        if (fav) { f.elements.placeName.value = fav.name; f.elements.placeLink.value = fav.mapsUrl || (fav.lat != null ? `${fav.lat}, ${fav.lng}` : ''); if (!f.elements.title.value) f.elements.title.value = fav.name; }
      });
      let confirmedOk = it.status === 'confirmed';
      f.addEventListener('change', async (ev) => {
        if (ev.target.name === 'status' && ev.target.value === 'confirmed' && !confirmedOk) {
          const ok = await confirmDialog('Ist diese Aktivität wirklich reserviert bzw. vom Anbieter bestätigt? Der Status „Bestätigt“ wird sonst nicht gesetzt.', { ok: 'Ja, bestätigt', title: 'Status „Bestätigt“' });
          if (ok) confirmedOk = true; else f.querySelector(`input[name=status][value="${it.status === 'confirmed' ? 'planned' : it.status}"]`).checked = true;
        }
      });
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        if (!v.title.trim()) { f.elements.title.focus(); toast('Bitte einen Titel eingeben.'); return; }
        let placeData = null;
        const fav = favs.find((x) => M.placeKey(x) === v.fav);
        if (fav && fav.name === v.placeName) placeData = { ...fav };
        else if (v.placeName.trim() || v.placeLink.trim()) {
          const c = parseCoords(v.placeLink);
          placeData = { id: uid(), source: 'manual', name: v.placeName.trim() || 'Ort', ...(c || {}), mapsUrl: isHttpUrl(v.placeLink) ? v.placeLink.trim() : null };
          if (!c && !placeData.mapsUrl && v.placeName.trim()) placeData.query = v.placeName.trim();
        }
        const changedDay = !isNew && v.date !== it.date;
        const out = { ...it, title: v.title.trim(), date: v.date, time: v.time, duration: v.duration, priority: v.priority, status: v.status, notes: v.notes, placeData };
        if (changedDay) out.order = 9999;
        await M.upsertItem(out);
        toast(isNew ? 'Zum Reiseplan hinzugefügt' : 'Gespeichert');
        close(); onSaved?.(out);
      });
      b.querySelector('[data-delete]')?.addEventListener('click', async () => {
        if (await confirmDialog(`„${it.title}“ aus dem Reiseplan entfernen?`, { ok: 'Entfernen', danger: true })) { await M.removeItem(it.id); toast('Entfernt'); close(); }
      });
      b.querySelector('[data-share]')?.addEventListener('click', () => share({ title: it.title, text: eventShareText({ ...it, kind: 'user' }) }));
    },
  });
}

/* ---------- Ort ---------- */
export function openPlaceDetail(p, { base } = {}) {
  const cat = catById(p.category);
  const open = isOpenNow(p.openingHours);
  const dist = base && base.lat != null && p.lat != null ? haversineKm(base, p) : null;
  const gm = placeMapsUrl(p);
  const nav = p.lat != null ? mapsDirUrl(p) : p.query ? mapsDirUrl({ query: p.query }) : null;
  const render = () => html`
    <div class="detail-top">${cat ? html`<span class="badge s-cat">${icon(cat.icon)}${cat.label}</span>` : ''}
      ${p.source === 'osm' ? html`<span class="badge s-src">OpenStreetMap</span>` : html`<span class="badge s-src">Eigener Eintrag</span>`}</div>
    ${p.description ? html`<p class="lead">${p.description}</p>` : ''}
    <dl class="kvs">
      ${p.address ? html`<div class="kv"><dt>Adresse</dt><dd>${p.address}</dd></div>` : ''}
      ${dist != null ? html`<div class="kv"><dt>Entfernung</dt><dd>${fmtKm(dist)} Luftlinie ab ${base.label}</dd></div>` : ''}
      ${p.cuisine ? html`<div class="kv"><dt>Küche</dt><dd>${p.cuisine}</dd></div>` : ''}
      ${p.source === 'osm' ? html`<div class="kv"><dt>Öffnungszeiten</dt><dd>${p.openingHours ? html`${p.openingHours} <small class="muted">(laut OSM, ohne Gewähr)</small>${open === true ? html` <span class="badge s-booked">Jetzt geöffnet</span>` : open === false ? html` <span class="badge s-open">Jetzt geschlossen</span>` : ''}` : html`<span class="is-open">Nicht verfügbar</span>`}</dd></div>
      <div class="kv"><dt>Bewertung</dt><dd class="is-open">In OpenStreetMap nicht verfügbar – siehe Google Maps</dd></div>
      <div class="kv"><dt>Preisniveau</dt><dd class="is-open">Nicht verfügbar</dd></div>` : ''}
      ${p.website ? html`<div class="kv"><dt>Website</dt><dd><a href="${p.website}" target="_blank" rel="noopener">${p.website.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a></dd></div>` : ''}
      ${p.phone ? html`<div class="kv"><dt>Telefon</dt><dd><a href="tel:${p.phone.replace(/[^+\d]/g, '')}">${p.phone}</a></dd></div>` : ''}
      ${p.notes ? html`<div class="kv"><dt>Notiz</dt><dd>${p.notes}</dd></div>` : ''}
    </dl>
    <div class="btn-col">
      ${nav ? html`<a class="btn primary" href="${nav}" target="_blank" rel="noopener">${icon('navigation')} Navigation starten</a>` : ''}
      <div class="btn-row">
        <button class="btn ghost" data-fav aria-pressed="${M.isFav(p)}">${icon('heart', M.isFav(p) ? 'filled' : '')} ${M.isFav(p) ? 'Favorit' : 'Merken'}</button>
        <button class="btn ghost" data-share>${icon('share-2')} Teilen</button>
      </div>
      <div class="btn-row">
        ${gm ? html`<a class="btn ghost" href="${gm}" target="_blank" rel="noopener">${icon('external-link')} Google Maps</a>` : ''}
        <button class="btn ghost" data-plan>${icon('calendar-plus')} In Reiseplan</button>
      </div>
      ${p.osmUrl ? html`<a class="link-sm" href="${p.osmUrl}" target="_blank" rel="noopener">Daten auf OpenStreetMap ansehen · © OSM-Mitwirkende</a>` : ''}
    </div>`;
  sheet(render(), {
    title: p.name,
    onMount: (b, close) => {
      const bind = () => {
        b.querySelector('[data-fav]').onclick = async () => { const f = await M.toggleFav(p); toast(f ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt'); b.innerHTML = String(render()); bind(); };
        b.querySelector('[data-share]').onclick = () => openShareChooser(p);
        b.querySelector('[data-plan]').onclick = () => { close(); setTimeout(() => openItemEditor({ title: p.name, placeData: { ...p }, status: 'idea', date: suggestDay(p) }), 240); };
      };
      bind();
    },
  });
}
function suggestDay(p) {
  const today = M.currentDay();
  if (today) return today.date;
  return p.lat != null && p.lat > 45 ? '2026-10-11' : '2026-10-13';
}

export function openShareChooser(p) {
  sheet(html`<p class="muted">Es werden nur Name, Kategorie und Google-Maps-Link geteilt.</p>
    <div class="btn-col">
      <button class="btn primary" data-s="1">${icon('message-circle')} Mit Vorschlag teilen</button>
      <button class="btn ghost" data-s="0">${icon('share-2')} Nur Ort teilen</button>
    </div>`, {
    title: 'Ort teilen',
    onMount: (b, close) => b.querySelectorAll('[data-s]').forEach((x) => x.addEventListener('click', () => { share({ title: p.name, text: placeShareText(p, x.dataset.s === '1') }); close(); })),
  });
}

/* ---------- Manuell Ort erfassen ---------- */
export function openManualPlace({ onSaved } = {}) {
  sheet(html`<form class="form" novalidate>
    <label class="field"><span>Name</span><input name="name" required maxlength="120" autocomplete="off" placeholder="z. B. Restaurant am Hafen"></label>
    <label class="field"><span>Kategorie</span><select name="category">${CATEGORIES.map((c) => html`<option value="${c.id}">${c.label}</option>`)}</select></label>
    <label class="field"><span>Google-Maps-Link oder Koordinaten</span><input name="link" inputmode="url" autocomplete="off" placeholder="https://maps.app.goo.gl/… oder 39.85, 3.01"></label>
    <label class="field"><span>Notiz</span><textarea name="notes" rows="2" maxlength="1000"></textarea></label>
    <p class="hint">${icon('info')} Tipp: In Google Maps auf „Teilen“ tippen, Link kopieren und hier einfügen. Kurzlinks (maps.app.goo.gl) enthalten keine Koordinaten – sie öffnen sich trotzdem korrekt, erscheinen aber nicht auf der Karte.</p>
    <button class="btn primary" type="submit">${icon('heart')} Als Favorit speichern</button>
  </form>`, {
    title: 'Ort manuell hinzufügen',
    onMount: (b, close) => b.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = Object.fromEntries(new FormData(ev.target));
      if (!v.name.trim()) { toast('Bitte einen Namen eingeben.'); return; }
      const c = parseCoords(v.link);
      const p = { id: uid(), source: 'manual', name: v.name.trim(), category: v.category, notes: v.notes.trim(), ...(c || {}), mapsUrl: isHttpUrl(v.link) ? v.link.trim() : null };
      if (!c && !p.mapsUrl) p.query = p.name;
      await M.toggleFav(p);
      toast('Gespeichert'); close(); onSaved?.(p);
    }),
  });
}
