import { html, icon, now, dateFromKey, fmtDateLong, share, $ } from '../util.js';
import * as M from '../model.js';
import { DAYS } from '../data.js';
import { eventRow, sheet, toast, emptyState, STATUS } from '../ui.js';
import { openEventDetail, openItemEditor, dayShareText } from '../details.js';
import { catById } from '../overpass.js';

const wd = (k) => new Intl.DateTimeFormat('de-CH', { weekday: 'short', timeZone: 'Europe/Zurich' }).format(dateFromKey(k));

export function render(root, params) {
  let date = params[0] && DAYS.some((d) => d.date === params[0]) ? params[0] : (M.currentDay()?.date || DAYS[0].date);

  const draw = () => {
    const day = DAYS.find((d) => d.date === date);
    const { timed, untimed } = M.dayTimeline(date);
    const today = M.currentDay()?.date;
    root.innerHTML = String(html`
    <div class="page plan">
      <header class="page-head"><div><h1>Reiseplan</h1><p class="page-sub">10.–17. Oktober 2026</p></div>
        <button class="icon-btn" data-act="legend" aria-label="Legende der Status">${icon('info')}</button></header>
      <nav class="day-strip" aria-label="Reisetage">${DAYS.map((d, i) => {
        const conf = M.fixedEvents(d.date).some((e) => e.status === 'conflict');
        const cnt = M.userItems(d.date).length;
        return html`<a class="day-chip ${d.date === date ? 'on' : ''} ${d.date === today ? 'today' : ''}" href="#/plan/${d.date}" aria-current="${d.date === date ? 'date' : 'false'}">
          <small>${wd(d.date)}</small><b>${d.date.slice(8)}</b><span class="dots">${conf ? html`<i class="dot red"></i>` : ''}${cnt ? html`<i class="dot teal"></i>` : ''}</span></a>`;
      })}</nav>
      <section class="day-head region-${day.region}">
        <p class="eyebrow">Tag ${DAYS.indexOf(day) + 1} · ${day.section}</p>
        <h2 class="display sm">${fmtDateLong(dateFromKey(date))}</h2>
        <p>${day.title}</p>
        ${day.free ? html`<p class="free-note">${icon('sparkles')} ${day.freeNote}</p>` : ''}
        <div class="btn-row">
          <button class="btn primary" data-act="add">${icon('plus')} Aktivität</button>
          <button class="btn ghost" data-act="fav">${icon('heart')} Favorit</button>
          <button class="btn ghost icon-only" data-act="share" aria-label="Tagesplan teilen">${icon('share-2')}</button>
        </div>
      </section>
      ${timed.length ? html`<div class="timeline">${timed.map((e) => itemRow(e))}</div>` : ''}
      ${untimed.length ? html`<h3 class="block-title sm">Ohne Uhrzeit · frei sortierbar</h3>
        <div class="timeline">${untimed.map((e, i) => itemRow(e, { first: i === 0, last: i === untimed.length - 1, sortable: true }))}</div>` : ''}
      ${!timed.length && !untimed.length ? emptyState('calendar-plus', 'Noch nichts geplant', 'Füge Aktivitäten oder Restaurants hinzu – oder übernimm Ideen aus deinen Favoriten.',
        html`<a class="btn ghost" href="#/discover">${icon('compass')} Entdecken</a>`) : ''}
      <section class="block"><h3 class="block-title sm">${icon('notebook-pen')} Notizen zum Tag</h3>
        <textarea class="day-notes" data-notes rows="3" placeholder="Eigene Notizen (nur auf diesem Gerät gespeichert)">${M.state.notes[date] || ''}</textarea></section>
    </div>`);
  };

  function itemRow(e, { first, last, sortable } = {}) {
    if (e.kind !== 'user') return eventRow(e);
    return html`<div class="tl-wrap">${eventRow(e)}
      <div class="tl-tools">
        <button class="icon-btn sm ${e.status === 'done' ? 'on' : ''}" data-act="done" data-id="${e.id}" aria-label="${e.status === 'done' ? 'Als offen markieren' : 'Als erledigt markieren'}" aria-pressed="${e.status === 'done'}">${icon('check')}</button>
        ${sortable ? html`<button class="icon-btn sm" data-act="up" data-id="${e.id}" ${first ? 'disabled' : ''} aria-label="Nach oben">${icon('chevron-up')}</button>
        <button class="icon-btn sm" data-act="down" data-id="${e.id}" ${last ? 'disabled' : ''} aria-label="Nach unten">${icon('chevron-down')}</button>` : ''}
      </div></div>`;
  }

  draw();
  root.onclick = async (ev) => {
    const a = ev.target.closest('[data-action],[data-act]');
    if (!a) return;
    const act = a.dataset.action || a.dataset.act;
    const id = a.dataset.id;
    if (act === 'event-detail') openEventDetail(id);
    else if (act === 'edit-item') openItemEditor(M.state.plan.find((p) => p.id === id));
    else if (act === 'add') openItemEditor({ date });
    else if (act === 'share') share({ title: 'Tagesplan', text: dayShareText(date) });
    else if (act === 'up' || act === 'down') await M.moveItem(id, act === 'up' ? -1 : 1);
    else if (act === 'done') {
      const it = M.state.plan.find((p) => p.id === id);
      it.status = it.status === 'done' ? (it.prevStatus || 'planned') : (it.prevStatus = it.status, 'done');
      await M.upsertItem(it); toast(it.status === 'done' ? 'Als erledigt markiert' : 'Wieder offen');
    } else if (act === 'fav') pickFavorite(date);
    else if (act === 'legend') legend();
  };
  root.oninput = (ev) => {
    if (ev.target.matches('[data-notes]')) {
      M.state.notes[date] = ev.target.value;
      clearTimeout(root._nt); root._nt = setTimeout(() => M.save('notes').catch(() => toast('Notiz konnte nicht gespeichert werden')), 400);
    }
  };
  const onState = (ev) => { if (!ev.detail?.includes('notes')) draw(); };
  window.addEventListener('statechange', onState);
  return () => { window.removeEventListener('statechange', onState); root.onclick = null; root.oninput = null; };
}

function pickFavorite(date) {
  const favs = M.state.favorites;
  sheet(favs.length ? html`<div class="list pick">${favs.map((f) => html`<button class="row" data-k="${M.placeKey(f)}">
      ${icon(catById(f.category)?.icon || 'map-pin')}<span><b>${f.name}</b><small>${catById(f.category)?.label || ''}</small></span>${icon('plus')}</button>`)}</div>`
    : emptyState('heart', 'Noch keine Favoriten', 'Speichere Orte unter „Entdecken“ mit dem Herz-Symbol.', html`<a class="btn primary" href="#/discover" data-close>Zu Entdecken</a>`), {
    title: 'Favorit übernehmen',
    onMount: (b, close) => b.querySelectorAll('[data-k]').forEach((x) => x.addEventListener('click', () => {
      const f = favs.find((p) => M.placeKey(p) === x.dataset.k);
      close(); setTimeout(() => openItemEditor({ date, title: f.name, placeData: { ...f }, status: 'idea' }), 240);
    })),
  });
}

function legend() {
  const rows = ['booked', 'fixed', 'approx', 'open', 'conflict', 'idea', 'planned', 'confirmed', 'done'];
  sheet(html`<dl class="legend">${rows.map((r) => html`<div><dt><span class="badge s-${STATUS[r].cls}">${icon(STATUS[r].icon)}${STATUS[r].label}</span></dt><dd>${STATUS[r].hint}</dd></div>`)}</dl>
    <p class="hint">${icon('info')} Eigene Planungen werden nie automatisch als gebucht angezeigt. „Bestätigt“ entsteht nur durch deine ausdrückliche Markierung.</p>`, { title: 'Legende' });
}
