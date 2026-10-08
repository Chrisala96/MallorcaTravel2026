import { html, raw, icon, fmtDate, fmtTime, fmtDateTime, copyText, download, share, uid, mapsDirUrl, mapsSearchUrl, $, setSimulatedNow } from '../util.js';
import * as M from '../model.js';
import * as store from '../store.js';
import { PLACES, FLIGHTS, SIXT_PUBLIC, PARKING, DAYS } from '../data.js';
import { badge, kv, pageHead, sheet, toast, confirmDialog, emptyState, lockNote, navUrlFor, routeUrl } from '../ui.js';
import { unlockWithPassphrase, importPrivateFile, lockPrivate, hasAutoRefresh } from '../privacy.js';
import { dayShareText } from '../details.js';
import { APP_VERSION } from '../version.js';

/* ======================= Menü ======================= */
function menu() {
  const open = M.checklist().filter((c) => !c.done).length;
  const groups = [
    ['Reise', [
      ['#/bookings', 'file-text', 'Buchungen', 'Hotel, Flüge, Mietwagen, Villa, Parkplatz'],
      ['#/villa', 'house', 'Ferienvilla', 'Standort, Objekt, offene Angaben'],
      ['#/parking', 'square-parking', 'Parkplatz Stuttgart', M.parking().booked ? 'Gebucht · COMFORT P14' : 'Noch nicht gebucht'],
      ['#/checklist', 'list-checks', 'Checkliste', `${open} offen`],
      ['#/docs', 'upload', 'Dokumente', 'PDFs lokal speichern'],
    ]],
    ['Daten & Einstellungen', [
      ['#/private', M.unlocked() ? 'lock-open' : 'lock', 'Private Daten', M.unlocked() ? 'Entsperrt auf diesem Gerät' : 'Gesperrt'],
      ['#/backup', 'download', 'Sichern & Wiederherstellen', 'Export / Import'],
      ['#/settings', 'settings', 'Darstellung & App', 'Hell/Dunkel, Testmodus'],
      ['#/about', 'info', 'Über die App', 'Datenquellen, Offline, Lizenzen'],
    ]],
  ];
  return html`<div class="page more">${pageHead('Mehr')}
    ${groups.map(([t, rows]) => html`<h2 class="block-title sm">${t}</h2><nav class="card list">${rows.map(([h, ic, l, s]) => html`
      <a class="row" href="${h}">${icon(ic, 'row-ic')}<span><b>${l}</b><small>${s}</small></span>${icon('chevron-right', 'chev')}</a>`)}</nav>`)}
  </div>`;
}

/* ======================= Buchungen ======================= */
function bookings() {
  const s = M.sixt();
  const sx = s.pickup.state === 'ok' && s.ret.state === 'ok' ? 'booked' : 'conflict';
  const rows = [
    ['Hotels', '#/booking/hotel', 'bed-double', 'Dorint · Am Nürburgring', '10.–12.10.2026', 'booked', M.unlocked() ? `Res.-Nr. ${M.state.priv.hotel.reservation}` : 'Res.-Nr. privat'],
    ['Flüge', '#/booking/flights', 'plane', 'DE1524 · DE1525', '12.10. / 17.10.2026', 'fixed', 'Buchungsreferenz offen'],
    ['Mietwagen', '#/booking/sixt', 'car', 'SIXT Palma Flughafen', '12.–17.10.2026', sx, s.ret.state === 'tight' ? 'Rückgabe knapp vor Abflug' : sx === 'conflict' ? 'Zeitkonflikt' : 'Ab 12.10. 19:30 · bis 17.10.'],
    ['Ferienwohnung', '#/villa', 'house', 'Ferienvilla (e-domizil)', '12.–17.10.2026', 'booked', 'Details teilweise offen'],
    ['Flughafenparkplatz', '#/parking', 'square-parking', 'Flughafen Stuttgart', '12.–17.10.2026', M.parking().booked ? 'booked' : 'open', M.parking().booked ? 'COMFORT P14 · 12.10. 11:00 – 17.10. 23:00' : 'Noch nicht gebucht'],
  ];
  const acts = M.state.plan.filter((p) => p.status === 'confirmed');
  return html`<div class="page">${pageHead('Buchungen', 'Zentrale Übersicht', '#/more')}
    <div class="booking-list">${rows.map(([cat, href, ic, t, per, st, ref]) => html`
      <a class="card booking-row" href="${href}"><span class="tile-ic">${icon(ic)}</span>
        <span class="br-txt"><small class="eyebrow">${cat}</small><b>${t}</b><small>${per} · ${ref}</small></span>${badge(st)}</a>`)}
      <div class="card booking-row static"><span class="tile-ic">${icon('sparkles')}</span>
        <span class="br-txt"><small class="eyebrow">Aktivitäten</small><b>${acts.length ? acts.length + ' als bestätigt markiert' : 'Keine bestätigten Aktivitäten'}</b>
        <small>${acts.length ? acts.map((a) => a.title).join(', ') : 'Eigene Reservierungen im Reiseplan als „Bestätigt“ markieren.'}</small></span></div>
    </div></div>`;
}

function hotel() {
  const h = PLACES.hotel, p = M.state.priv?.hotel;
  return html`<div class="page booking">${pageHead('Hotel', 'Dorint · Am Nürburgring · Hocheifel', '#/bookings')}
    <section class="card booking-hero">
      <div class="next-top">${badge('booked')}<span class="muted">10.–12. Oktober 2026 · 2 Nächte</span></div>
      <div class="grid2 big-times"><div><small>Check-in</small><b>Sa 10.10.</b><span>ab 15:00 Uhr</span></div><div><small>Check-out</small><b>Mo 12.10.</b><span>bis 11:00 Uhr</span></div></div>
      <div class="btn-grid">
        <a class="btn primary" href="${navUrlFor('hotel')}" target="_blank" rel="noopener">${icon('navigation')} Navigation</a>
        <a class="btn ghost" href="tel:${h.phone}">${icon('phone')} Anrufen</a>
        <a class="btn ghost" href="mailto:${h.email}">${icon('mail')} E-Mail</a>
        <a class="btn ghost" href="${h.web}" target="_blank" rel="noopener">${icon('globe')} Website</a>
      </div>
    </section>
    <section class="card"><h3>Buchung</h3>
      ${p ? html`<dl class="kvs">
        ${kv('Reservierungsnummer', p.reservation, { mono: true, copy: true })}
        ${kv('Zimmer', raw(p.rooms.map((r) => `${r.count} × ${String(html`${r.type}`)}`).join('<br>')))}
        ${kv('Belegung', p.guests)}
        ${kv('Verpflegung', p.breakfast)}
        ${kv('Gesamtpreis', html`<b>${p.total}</b> <small class="muted">gemäss Buchungsbestätigung</small>`)}
      </dl>
      <h4>Preise pro Nacht</h4>
      <table class="tbl"><thead><tr><th>Nacht</th><th>Doppelzimmer</th><th>Einzelzimmer</th></tr></thead>
        <tbody>${p.prices.map((x) => html`<tr><td>${x.night}</td><td>${x.double}</td><td>${x.single}</td></tr>`)}</tbody></table>
      <h4>Konditionen</h4><ul class="notes"><li>${p.parking}</li><li>${p.cancellation}</li><li>${p.payment}</li></ul>`
      : lockNote('Reservierungsnummer, Zimmer und Preise')}
    </section>
    <section class="card"><h3>Kontakt</h3><dl class="kvs">
      ${kv('Adresse', h.address)}
      ${kv('Telefon', html`<a href="tel:${h.phone}">${h.phoneDisplay}</a>`)}
      ${kv('E-Mail', html`<a href="mailto:${h.email}">${h.email}</a>`)}
      ${kv('Website', html`<a href="${h.web}" target="_blank" rel="noopener">dorint.com/nuerburgring</a>`)}
    </dl></section>
    <section class="card"><h3>Anreise</h3><p class="muted">Abfahrt Thayngen 10:00 Uhr. Fahrzeit nicht bestätigt – bitte in Google Maps prüfen.</p>
      <a class="btn ghost" href="${routeUrl({ from: 'meet', to: 'hotel' })}" target="_blank" rel="noopener">${icon('route')} Route Thayngen → Hotel</a></section>
  </div>`;
}

const srcBadge = (section, k) => { const src = M.ovSrc(section, k); return src === 'local' ? html` <span class="badge s-manual" title="Nur auf diesem Gerät">manuell</span>` : src === 'shared' ? html` <span class="badge s-manual" title="Zentral für alle Geräte hinterlegt">ergänzt</span>` : ''; };
const OV_HINT = 'Zentral hinterlegte Angaben („ergänzt“) gelten auf allen Geräten. Eigene Änderungen („manuell“) gelten nur auf diesem Gerät und haben Vorrang.';

function flights() {
  const o = M.ov('flights');
  const mf = (k) => (o[k] ? html`${o[k]}${srcBadge('flights', k)}` : null);
  const statusLink = (no) => `https://www.google.com/search?q=${encodeURIComponent('Flugstatus ' + no)}`;
  const fCard = (f, back) => html`<section class="card flight">
    <div class="next-top">${badge('fixed')}<span class="muted">${fmtDate(new Date(f.date + 'T12:00:00+02:00'))}</span></div>
    <div class="fl-route"><div><b>${f.from.match(/\((\w+)\)/)[1]}</b><span>${f.from.replace(/ \(\w+\)/, '')}</span><strong>${f.dep}</strong></div>
      <div class="fl-mid">${icon('plane')}<small>${f.no}</small></div>
      <div><b>${f.to.match(/\((\w+)\)/)[1]}</b><span>${f.to.replace(/ \(\w+\)/, '')}</span><strong>${back ? (o.returnArrival ? html`${o.returnArrival}<sup>${M.ovSrc('flights', 'returnArrival') === 'local' ? 'manuell' : 'ergänzt'}</sup>` : html`<span class="is-open">offen</span>`) : f.arr}</strong></div></div>
    <a class="btn ghost sm" href="${statusLink(f.no)}" target="_blank" rel="noopener">${icon('external-link')} Aktuellen Flugstatus online prüfen</a>
  </section>`;
  return html`<div class="page booking">${pageHead('Flüge', 'DE1524 · DE1525', '#/bookings')}
    ${fCard(FLIGHTS.out, false)}${fCard(FLIGHTS.back, true)}
    <p class="hint">${icon('info')} Die App ruft keinen Live-Flugstatus ab (dafür gäbe es nur kostenpflichtige APIs). Der Button öffnet eine Websuche.</p>
    <section class="card"><h3>Buchungsdetails</h3><dl class="kvs">
      ${kv('Fluggesellschaft', mf('airline'), { open: !o.airline })}
      ${kv('Buchungsreferenz', mf('ref'), { open: !o.ref })}
      ${kv('Terminal', mf('terminal'), { open: !o.terminal })}
      ${kv('Gate', mf('gate'), { open: !o.gate })}
      ${kv('Gepäckbestimmungen', mf('baggage'), { open: !o.baggage })}
      ${kv('Ankunft Rückflug STR', mf('returnArrival'), { open: !o.returnArrival })}
    </dl>
    <button class="btn ghost" data-edit="flights">${icon('pencil')} Angaben ergänzen</button>
    <p class="hint">${OV_HINT}</p></section>
  </div>`;
}

function sixt() {
  const s = M.sixt(), p = M.state.priv?.sixt;
  const tState = (x) => (x.state === 'ok' ? 'booked' : x.state === 'pending' ? 'approx' : 'conflict');
  const gap = s.gapMinutes(s.ret.effective);
  return html`<div class="page booking">${pageHead('Mietwagen', 'SIXT · Mallorca Palma Flughafen', '#/bookings')}
    ${s.pickup.state === 'conflict' || s.pickup.state === 'pending' ? html`<div class="alert danger big">${icon('triangle-alert')}<div><b>${SIXT_PUBLIC.pickupWarning}</b><span>Gebucht: ${fmtDate(s.pickup.booked)}, ${fmtTime(s.pickup.booked)} · Flugankunft: 12.10.2026, 19:55</span>${s.pickup.state === 'pending' ? html`<small>Neue Zeit ${fmtTime(s.pickup.local)} eingetragen – noch nicht als bei SIXT geändert markiert.</small>` : ''}</div></div>` : ''}
    ${s.ret.state === 'conflict' || s.ret.state === 'pending' ? html`<div class="alert danger big">${icon('triangle-alert')}<div><b>${SIXT_PUBLIC.returnWarning}</b><span>Gebucht: ${fmtDate(s.ret.booked)}, ${fmtTime(s.ret.booked)} · Abflug: 17.10.2026, 14:45</span>${s.ret.state === 'pending' ? html`<small>Neue Zeit ${fmtTime(s.ret.local)} eingetragen – noch nicht als bei SIXT geändert markiert.</small>` : ''}</div></div>` : ''}
    ${s.ret.state === 'tight' ? html`<div class="alert danger big">${icon('triangle-alert')}<div><b>Rückgabe nur ${gap} Min. vor dem Abflug</b><span>Rückgabe ${fmtDate(s.ret.effective)}, ${fmtTime(s.ret.effective)} · Abflug DE1525: 17.10.2026, 14:45</span><small>${SIXT_PUBLIC.returnTightWarning}</small></div></div>` : ''}
    <section class="card booking-hero">
      <div class="grid2 big-times">
        <div><small>Abholung</small>${badge(tState(s.pickup))}<b>${fmtDate(s.pickup.effective)}</b><span>ab ${fmtTime(s.pickup.effective)} Uhr${s.pickup.changed ? ' (lokal korrigiert)' : ''}</span></div>
        <div><small>Rückgabe</small>${badge(tState(s.ret))}<b>${fmtDate(s.ret.effective)}</b><span>${fmtTime(s.ret.effective)} Uhr${s.ret.changed ? ' (lokal korrigiert)' : ''}</span></div>
      </div>
      <p class="hint">${icon('info')} Zeiten am 08.10.2026 bei SIXT geändert (ursprünglich 12.10. 14:00 / 17.10. 16:00). Abholung: Landung planmässig 19:55, laut Bestätigung ${SIXT_PUBLIC.graceMinutes} Min. Kulanz.</p>
      <div class="btn-grid">
        <a class="btn primary" href="${SIXT_PUBLIC.manageUrl}" target="_blank" rel="noopener">${icon('external-link')} Buchung bei SIXT ändern</a>
        <button class="btn ghost" data-edit="sixt">${icon('pencil')} Neue Zeiten eintragen</button>
        <a class="btn ghost" href="${mapsDirUrl(PLACES.sixt)}" target="_blank" rel="noopener">${icon('navigation')} Station navigieren</a>
        ${p ? html`<button class="btn ghost" data-copy="${p.reservation}">${icon('copy')} Res.-Nr. kopieren</button>` : ''}
      </div>
      ${s.ret.state === 'ok' ? html`<p class="hint">${icon('info')} Zeitreserve zwischen Rückgabe und Abflug bitte selbst anhand der Flughafen- und Airline-Angaben prüfen.</p>` : ''}
    </section>
    <section class="card"><h3>Station</h3><dl class="kvs">
      ${kv('Abholung', 'Mallorca Palma Flughafen, Zona rent a car – Llegadas, 07610 Palma de Mallorca')}
      ${kv('Rückgabe', html`Mallorca Palma Flughafen<br><small class="mono">39.545344, 2.726664</small>`)}
    </dl></section>
    <section class="card"><h3>Buchung</h3>
      ${p ? html`<dl class="kvs">
        ${kv('Reservierungsnummer', p.reservation, { mono: true, copy: true })}
        ${kv('Hauptfahrer', p.driver)}
        ${kv('Fahrzeuggruppe', p.group, { mono: true })}
        ${kv('Fahrzeugbeispiel', p.example)}
        ${kv('Mietdauer', p.rentalDays)}
        ${kv('Bereits bezahlt', p.paid)}
        ${kv('Sicherheitsleistung', p.deposit)}
        ${kv('Selbstbeteiligung', p.excess)}
      </dl>
      <h4>Enthalten</h4><ul class="checks">${p.included.map((x) => html`<li>${icon('check', 'xs')} ${x}</li>`)}</ul>
      <p class="muted">${p.addonsNote}</p>
      <h4>Abholung</h4><p>${p.grace}</p>
      <h4>Stornierung (Vorauszahlung)</h4><ul class="notes">${p.cancellation.map((x) => html`<li>${x}</li>`)}</ul>` : lockNote('Reservierungsnummer, Fahrer und Zahlungsdetails')}
    </section></div>`;
}

function villa() {
  const v = M.state.priv?.villa, pl = M.place('villa');
  const o = M.ov('villa');
  const fld = (k, l) => kv(l, o[k] ? html`${o[k]}${srcBadge('villa', k)}` : null, { open: !o[k] });
  return html`<div class="page booking">${pageHead('Ferienvilla', 'Mallorca · 12.–17. Oktober 2026', '#/more')}
    ${pl ? html`<div class="mini-map" id="villa-map" aria-label="Standortkarte der Villa"></div>` : ''}
    <section class="card booking-hero">
      <div class="next-top">${badge('booked')}<span class="muted">Aufenthalt 12.–17.10.2026</span></div>
      ${v ? html`<dl class="kvs">
        ${kv('Koordinaten', `${v.lat}, ${v.lng}`, { mono: true, copy: true })}
        ${kv('', html`<small class="mono muted">${v.dms}</small>`)}
        ${kv('Plattform', v.platform)}
        ${kv('Objekt-ID', v.objectId, { mono: true, copy: true })}
      </dl>
      <div class="btn-grid">
        <a class="btn primary" href="${mapsDirUrl(pl)}" target="_blank" rel="noopener">${icon('navigation')} Navigation (Koordinaten)</a>
        <a class="btn ghost" href="${v.url}" target="_blank" rel="noopener">${icon('external-link')} Objekt bei e-domizil</a>
        <a class="btn ghost" href="${routeUrl({ from: 'sixt', to: 'villa' })}" target="_blank" rel="noopener">${icon('route')} Route ab Flughafen</a>
        <a class="btn ghost" href="#/map?focus=villa">${icon('map')} Auf Karte</a>
      </div>
      <p class="hint">${icon('info')} Navigationsziel sind die Koordinaten aus der Buchung. Eine Strassenadresse ist nicht bestätigt.</p>` : lockNote('Standort und Objektlink der Villa')}
    </section>
    <section class="card"><h3>Offene Angaben</h3><dl class="kvs">
      ${fld('address', 'Strassenadresse')}${fld('checkin', 'Check-in')}${fld('checkout', 'Check-out')}
      ${fld('keys', 'Schlüsselübergabe')}${fld('contact', 'Kontaktperson')}${fld('price', 'Endgültiger Preis')}${fld('conditions', 'Weitere Bedingungen')}
    </dl><button class="btn ghost" data-edit="villa">${icon('pencil')} Angaben ergänzen</button>
    <p class="hint">${OV_HINT}</p>
    <p class="hint">Hinweis: Parameter aus dem ursprünglichen Suchlink (Preis, Personen, Zeiten) sind keine bestätigten Buchungsdaten.</p></section>
    <section class="card"><h3>${icon('notebook-pen')} Notizen</h3>
      <textarea class="day-notes" data-villa-notes rows="4" placeholder="z. B. WLAN, Mülltrennung, Hinweise des Vermieters (nur auf diesem Gerät)">${M.state.notes.villa || ''}</textarea></section>
  </div>`;
}

function parkingPage() {
  const p = M.parking();
  const ra = M.returnArrival();
  return html`<div class="page booking">${pageHead('Parkplatz', 'Flughafen Stuttgart · 12.–17.10.2026', '#/more')}
    <section class="card booking-hero">
      <div class="next-top">${p.booked ? badge('booked') : html`<span class="badge s-conflict">${icon('circle-dashed')}Noch nicht gebucht</span>`}${p.product ? html`<span class="muted">${p.product}</span>` : ''}</div>
      ${p.booked && p.entry ? html`<div class="grid2 big-times">
        <div><small>Einfahrt</small><b>${fmtDate(p.entry)}</b><span>ab ${fmtTime(p.entry)} Uhr</span></div>
        <div><small>Ausfahrt</small><b>${fmtDate(p.exit)}</b><span>bis ${fmtTime(p.exit)} Uhr</span></div></div>` : ''}
      ${p.booked ? html`<dl class="kvs">
        ${kv('Anbieter', p.provider || null, { open: !p.provider })}
        ${M.unlocked() ? html`${kv('Buchungsnummer', p.ref || null, { open: !p.ref, mono: true, copy: !!p.ref })}${p.total ? kv('Betrag', p.total) : ''}` : ''}
        ${p.notes ? kv('Notiz', p.notes) : ''}
        ${kv('Parkhaus', html`P14 · Einfahrtshöhe max. 2,10 m <small class="muted">(laut APCOA)</small>`)}
      </dl>
      ${!M.unlocked() ? lockNote('Buchungsnummer und QR-Code') : ''}
      ${p.qr ? html`<div class="qr-box"><img src="${p.qr}" alt="QR-Code für Ein- und Ausfahrt" width="220" height="220"><small>${p.qrNote}</small></div>` : ''}
      <div class="btn-grid">
        <a class="btn primary" href="${navUrlFor('p14')}" target="_blank" rel="noopener">${icon('navigation')} Navigation zu P14</a>
        ${p.manageUrl ? html`<a class="btn ghost" href="${p.manageUrl}" target="_blank" rel="noopener">${icon('external-link')} Parkbuchung verwalten</a>` : ''}
        <button class="btn ghost" data-edit="parking">${icon('pencil')} Ergänzen</button>
      </div>
      <p class="hint">${icon('info')} Einfahrt ab 11:00 passt zur Abfahrt am Nürburgring (ca. 10:30). Ausfahrt bis 17.10. 23:00 – Ankunftszeit DE1525 ${ra ? html`laut Angabe ${ra.time}` : 'noch offen'}, bitte prüfen.</p>`
      : html`<h4>Planungsgrundlage</h4>
      <ul class="notes"><li>Einfahrt: am 12.10. – Abflug DE1524 um 17:50 Uhr.</li>
        <li>Ausfahrt: am 17.10. – Ankunftszeit DE1525 ${ra ? html`laut Angabe ${ra.time}` : html`<b>noch offen</b>`}.</li></ul>
      <button class="btn ghost" data-edit="parking">${icon('pencil')} Als gebucht markieren</button>`}
    </section>
    ${p.booked ? html`<details class="more-opt"><summary>Weitere Anbieter (Recherche ${PARKING.checkedAt})</summary>` : html`<h2 class="block-title sm">Anbieter (Recherche ${PARKING.checkedAt})</h2>`}
    ${PARKING.options.map((o) => html`<section class="card provider">
      <h3>${o.name}</h3><p class="muted">${o.operator}</p>
      <ul class="notes">${o.facts.map((f) => html`<li>${f}</li>`)}</ul>
      <dl class="kvs">${kv('Entfernung Terminal', o.distance)}${kv('Shuttle', o.shuttle)}${kv('Öffnungszeiten', o.hours)}${kv('Preise', html`<span class="is-open">Nur beim Anbieter aktuell – nicht für unsere Daten geprüft</span>`)}</dl>
      <div class="btn-row"><a class="btn primary" href="${o.bookingUrl}" target="_blank" rel="noopener">${icon('external-link')} Online buchen</a>
        ${o.infoUrl ? html`<a class="btn ghost" href="${o.infoUrl}" target="_blank" rel="noopener">Info</a>` : ''}
        <a class="btn ghost icon-only" href="${mapsDirUrl({ query: o.query })}" target="_blank" rel="noopener" aria-label="Navigation">${icon('navigation')}</a></div>
    </section>`)}
    ${p.booked ? raw('</details>') : ''}
    <p class="hint">${icon('info')} Keine Live-Preise: Für Parkplatzpreise gibt es keine freie Schnittstelle. Bitte Preise und Verfügbarkeit direkt auf den Buchungsseiten vergleichen.</p>
  </div>`;
}

function checklistPage() {
  const list = M.checklist();
  const pl = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };
  return html`<div class="page">${pageHead('Checkliste', `${list.filter((c) => !c.done).length} von ${list.length} offen`, '#/more')}
    <div class="card list">${list.map((c) => html`
      <div class="check-row prio-${c.priority} ${c.done ? 'is-done' : ''}">
        <label class="cbl"><input type="checkbox" data-task="${c.id}" ${c.done ? 'checked' : ''}><span class="cb">${icon('check')}</span>
          <span><b>${c.title}</b>${c.detail ? html`<small>${c.detail}</small>` : ''}</span></label>
        <div class="cr-tools">
          <select data-prio="${c.id}" aria-label="Priorität">${['high', 'medium', 'low'].map((p) => html`<option value="${p}" ${c.priority === p ? 'selected' : ''}>${pl[p]}</option>`)}</select>
          ${c.link ? html`<a class="icon-btn sm" href="${c.link}" target="_blank" rel="noopener" aria-label="Öffnen">${icon('external-link')}</a>` : ''}
          ${c.route ? html`<a class="icon-btn sm" href="${c.route}" aria-label="Öffnen">${icon('chevron-right')}</a>` : ''}
          ${c.custom ? html`<button class="icon-btn sm" data-del-task="${c.id}" aria-label="Löschen">${icon('trash-2')}</button>` : ''}
        </div></div>`)}</div>
    <form class="search add-task" data-add-task>${icon('plus')}<input name="t" maxlength="140" placeholder="Eigene Aufgabe hinzufügen" autocomplete="off" aria-label="Neue Aufgabe"><button class="btn primary sm" type="submit">Hinzufügen</button></form>
    <p class="hint">Aufgaben werden nie automatisch abgehakt – nur durch dich.</p></div>`;
}

async function docsPage() {
  const docs = await store.listDocs();
  const cats = ['Hotel', 'Flug', 'Mietwagen', 'Villa', 'Parkplatz', 'Aktivität', 'Sonstiges'];
  return html`<div class="page">${pageHead('Dokumente', 'Nur auf diesem Gerät gespeichert', '#/more')}
    <label class="card upload">${icon('upload', 'lg')}<b>PDF hinzufügen</b><small>Bestätigungen, Tickets, Vouchers – werden nicht hochgeladen.</small>
      <input type="file" accept="application/pdf,image/*" multiple data-doc-input hidden></label>
    <div class="field inline"><span>Kategorie für neue Dokumente</span><select data-doc-cat>${cats.map((c) => html`<option>${c}</option>`)}</select></div>
    ${docs.length ? html`<div class="card list">${docs.map((d) => html`<div class="row">${icon('file-text', 'row-ic')}
      <button class="row-main" data-doc-open="${d.id}"><b>${d.name}</b><small>${d.category} · ${(d.size / 1024).toFixed(0)} KB · ${fmtDate(new Date(d.added))}</small></button>
      <button class="icon-btn sm" data-doc-del="${d.id}" aria-label="${d.name} löschen">${icon('trash-2')}</button></div>`)}</div>`
      : emptyState('file-text', 'Keine Dokumente', 'Importierte Dateien bleiben ausschliesslich im Speicher dieses Browsers.')}
  </div>`;
}

async function privatePage() {
  const u = M.unlocked();
  const auto = u && await hasAutoRefresh();
  return html`<div class="page">${pageHead('Private Daten', u ? 'Auf diesem Gerät entsperrt' : 'Gesperrt', '#/more')}
    <section class="card">
      <p>Reservierungsnummern, Namen, Preise, Zahlungsdetails, der Standort der Villa und die Heimadresse sind <b>nicht</b> öffentlich in der App enthalten. Sie liegen verschlüsselt (AES-256) im Repository und werden erst mit dem Reise-Passwort lokal entschlüsselt.</p>
      ${u ? html`<div class="alert ok">${icon('lock-open')}<div><b>Entsperrt</b><span>Die Daten sind in diesem Browser gespeichert und offline verfügbar.</span><small>${auto ? 'Zentrale Ergänzungen werden beim Öffnen mit Internet automatisch übernommen.' : 'Für automatische Aktualisierung einmal entfernen und mit dem Passwort neu entsperren.'}</small></div></div>
        <button class="btn danger-ghost" data-lock>${icon('lock')} Private Daten von diesem Gerät entfernen</button>`
      : html`<form class="form" data-unlock>
        <label class="field"><span>Reise-Passwort</span><input name="pass" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required placeholder="z. B. wort-wort-wort-wort-wort"></label>
        <button class="btn primary" type="submit">${icon('lock-open')} Entsperren</button>
        <p class="hint">Gross-/Kleinschreibung und Bindestriche spielen keine Rolle. Benötigt einmalig Internet.</p></form>
        <details class="more-opt"><summary>Alternative: Datei importieren</summary>
          <p class="muted">Falls du die Datei <code>private-data.json</code> direkt erhalten hast:</p>
          <label class="btn ghost">${icon('upload')} JSON-Datei wählen<input type="file" accept="application/json,.json" data-priv-file hidden></label></details>`}
    </section></div>`;
}

function backupPage() {
  return html`<div class="page">${pageHead('Sichern & Wiederherstellen', '', '#/more')}
    <section class="card"><h3>Wichtig</h3><p>Alle persönlichen Daten (Reiseplan, Favoriten, Checkliste, Notizen, Ergänzungen) liegen nur im Speicher dieses Browsers. Beim Löschen der Website-Daten, beim Wechsel des Browsers oder Geräts gehen sie verloren. Erstelle deshalb regelmässig eine Sicherung.</p>
      <button class="btn ghost" data-persist>${icon('shield-alert')} Dauerhafte Speicherung anfragen</button></section>
    <section class="card"><h3>Export</h3>
      <label class="switch"><input type="checkbox" data-inc-priv><span></span>Private Buchungsdaten mit exportieren <small>(Datei dann vertraulich behandeln)</small></label>
      <div class="btn-col"><button class="btn primary" data-export>${icon('download')} Sicherung herunterladen (.json)</button>
      <button class="btn ghost" data-export-text>${icon('file-text')} Reiseplan als Text exportieren</button></div></section>
    <section class="card"><h3>Import</h3><p class="muted">Eine Sicherung ersetzt die aktuellen persönlichen Daten auf diesem Gerät. Dokumente (PDF) sind nicht enthalten.</p>
      <label class="btn ghost">${icon('upload')} Sicherung wählen<input type="file" accept="application/json,.json" data-import hidden></label></section>
  </div>`;
}

function settingsPage() {
  const t = M.state.settings.theme;
  return html`<div class="page">${pageHead('Darstellung & App', '', '#/more')}
    <section class="card"><h3>Erscheinungsbild</h3><div class="seg" role="radiogroup">
      ${[['auto', 'sun-moon', 'System'], ['light', 'sun', 'Hell'], ['dark', 'moon', 'Dunkel']].map(([v, ic, l]) => html`<label class="seg-opt"><input type="radio" name="theme" value="${v}" ${t === v ? 'checked' : ''} data-theme-opt><span>${icon(ic)}${l}</span></label>`)}
    </div></section>
    <section class="card"><h3>Testmodus: Datum simulieren</h3>
      <p class="muted">Zeigt das Dashboard so, als wäre es zum gewählten Zeitpunkt. Nur zum Testen – wird deutlich markiert.</p>
      <div class="sim-row field"><input type="datetime-local" data-sim value="${M.state.settings.simulate || ''}" min="2026-10-01T00:00" max="2026-10-31T23:59" aria-label="Simuliertes Datum">
      <button class="btn ghost" data-sim-reset>Zurücksetzen</button></div></section>
    <section class="card"><h3>App</h3><dl class="kvs">${kv('Version', APP_VERSION)}${kv('Offline-Modus', 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'aktiv' : 'wird beim nächsten Laden aktiv') : 'nicht unterstützt')}
      ${kv('Speicher', store.storageIsPersistent() ? 'IndexedDB' : 'Nur Arbeitsspeicher (Daten gehen beim Schliessen verloren!)')}</dl>
      <button class="btn ghost" data-update>${icon('refresh-cw')} Nach Update suchen</button></section>
    <section class="card"><h3>Zurücksetzen</h3><button class="btn danger-ghost" data-wipe>${icon('trash-2')} Alle lokalen Daten löschen</button></section>
  </div>`;
}

function aboutPage() {
  return html`<div class="page about">${pageHead('Über die App', 'Travel Companion 2026', '#/more')}
    <section class="card"><h3>Was funktioniert wo?</h3>
      <table class="tbl"><thead><tr><th>Funktion</th><th>Offline</th><th>Benötigt</th></tr></thead><tbody>
        <tr><td>Reiseplan, Buchungen, Checkliste, Favoriten, Notizen, Dokumente</td><td>✓</td><td>–</td></tr>
        <tr><td>Private Daten entsperren</td><td>nach 1. Mal ✓</td><td>einmalig Internet</td></tr>
        <tr><td>Wetter</td><td>letzter Stand</td><td>Open-Meteo</td></tr>
        <tr><td>Orte suchen (Entdecken)</td><td>letzte Ergebnisse</td><td>OpenStreetMap / Overpass</td></tr>
        <tr><td>Kartenhintergrund</td><td>nur bereits geladene Kacheln</td><td>OpenStreetMap-Kacheln</td></tr>
        <tr><td>Navigation, Fahrzeiten, Verkehr, Bewertungen</td><td>–</td><td>Google Maps (externe App)</td></tr>
        <tr><td>Flugstatus</td><td>–</td><td>Websuche (extern)</td></tr>
      </tbody></table></section>
    <section class="card"><h3>Datenqualität</h3><ul class="notes">
      <li>Keine erfundenen Zeiten, Preise, Bewertungen oder Öffnungszeiten. Unbekanntes ist als „Offen“ markiert.</li>
      <li>Fahrzeiten werden nicht berechnet – „Fahrzeit bitte in Google Maps prüfen“.</li>
      <li>Entfernungen in „Entdecken“ sind Luftlinie.</li>
      <li>Manuelle Ergänzungen sind als „manuell“ gekennzeichnet.</li></ul></section>
    <section class="card"><h3>Quellen & Lizenzen</h3><ul class="notes">
      <li>Karten- und Ortsdaten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-Mitwirkende</a> (ODbL)</li>
      <li>Wetter: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (CC BY 4.0)</li>
      <li>Karte: Leaflet 1.9.4 (BSD-2) · Icons: Lucide (ISC) · Schriften: Inter, Fraunces (SIL OFL)</li></ul></section>
  </div>`;
}

/* ======================= Editoren ======================= */
function editOverrides(section) {
  const base = section === 'parking' ? PARKING.booking || {} : {};
  const o = { ...base, ...M.ov(section) };
  const shared = { ...base, ...(M.state.priv?.shared?.[section] || {}) };
  const defs = {
    flights: { title: 'Flugangaben ergänzen', fields: [['airline', 'Fluggesellschaft'], ['ref', 'Buchungsreferenz'], ['terminal', 'Terminal'], ['gate', 'Gate'], ['baggage', 'Gepäckbestimmungen'], ['returnArrival', 'Ankunftszeit Rückflug in STR', 'time']] },
    villa: { title: 'Villa-Angaben ergänzen', fields: [['address', 'Strassenadresse'], ['checkin', 'Check-in'], ['checkout', 'Check-out'], ['keys', 'Schlüsselübergabe'], ['contact', 'Kontaktperson'], ['price', 'Endgültiger Preis'], ['conditions', 'Weitere Bedingungen', 'textarea']] },
    sixt: { title: 'Neue SIXT-Zeiten', fields: [['pickup', 'Neue Abholzeit', 'datetime-local', '2026-10-12T00:00'], ['pickupConfirmed', 'Abholzeit wurde bei SIXT geändert', 'checkbox'], ['ret', 'Neue Rückgabezeit', 'datetime-local', '2026-10-17T00:00'], ['retConfirmed', 'Rückgabezeit wurde bei SIXT geändert', 'checkbox']] },
    parking: { title: 'Parkplatzbuchung', fields: [['booked', 'Parkplatz ist gebucht', 'checkbox'], ['provider', 'Anbieter / Parkhaus'], ['ref', 'Buchungsnummer'], ['notes', 'Notiz (z. B. Ein-/Ausfahrtszeit)', 'textarea']] },
  }[section];
  sheet(html`<form class="form">
    ${defs.fields.map(([k, l, type = 'text', min]) => type === 'checkbox'
      ? html`<label class="switch"><input type="checkbox" name="${k}" ${o[k] ? 'checked' : ''}><span></span>${l}</label>`
      : type === 'textarea' ? html`<label class="field"><span>${l}</span><textarea name="${k}" rows="2" maxlength="1000">${o[k] || ''}</textarea></label>`
      : html`<label class="field"><span>${l}</span><input name="${k}" type="${type}" value="${o[k] || ''}" ${min ? html`min="${min}" max="${min.slice(0, 10)}T23:59"` : ''} autocomplete="off"></label>`)}
    ${section === 'sixt' ? html`<p class="hint">${icon('info')} Die Warnung verschwindet erst, wenn du bestätigst, dass die Zeit bei SIXT tatsächlich geändert wurde – und die neue Zeit zum Flug passt.</p>` : ''}
    <p class="hint">Wird nur auf diesem Gerät gespeichert und als „manuell“ gekennzeichnet.${Object.keys(shared).length ? ' „Zurücksetzen“ stellt die zentral hinterlegten Angaben wieder her.' : ''}</p>
    <div class="btn-row"><button class="btn ghost" type="button" data-clear>${Object.keys(shared).length ? 'Zurücksetzen' : 'Leeren'}</button><button class="btn primary" type="submit">Speichern</button></div>
  </form>`, {
    title: defs.title,
    onMount: (b, close) => {
      const f = b.querySelector('form');
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const out = {};
        for (const [k, , type] of defs.fields) {
          const el = f.elements[k];
          // Nur speichern, was vom zentralen Wert abweicht – so kommen spätere zentrale Ergänzungen weiterhin an.
          if (type === 'checkbox') { if (el.checked !== !!shared[k]) out[k] = el.checked; }
          else if (el.value.trim() && el.value.trim() !== (shared[k] || '')) out[k] = el.value.trim();
        }
        if (section === 'sixt') {
          if (out.pickupConfirmed && !out.pickup) { toast('Bitte zuerst die neue Abholzeit eintragen.'); return; }
          if (out.retConfirmed && !out.ret) { toast('Bitte zuerst die neue Rückgabezeit eintragen.'); return; }
        }
        M.state.overrides[section] = out;
        await M.save('overrides'); toast('Gespeichert'); close();
      });
      b.querySelector('[data-clear]').addEventListener('click', async () => { delete M.state.overrides[section]; await M.save('overrides'); toast('Ergänzungen entfernt'); close(); });
    },
  });
}

/* ======================= Router ======================= */
const PAGES = { more: menu, bookings, hotel, flights, sixt, villa, parking: parkingPage, checklist: checklistPage, docs: docsPage, private: privatePage, backup: backupPage, settings: settingsPage, about: aboutPage };

export function render(root, params, query, page) {
  let key = page === 'booking' ? params[0] : page;
  if (!PAGES[key]) key = 'more';
  let villaMap;
  const draw = async () => {
    const out = await PAGES[key]();
    root.innerHTML = String(out);
    if (key === 'villa') mountVillaMap();
  };
  async function mountVillaMap() {
    const el = $('#villa-map', root); const pl = M.place('villa');
    if (!el || !pl) return;
    try {
      const L = window.L || await new Promise((res, rej) => { const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'vendor/leaflet/leaflet.css'; document.head.appendChild(c); const s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js'; s.onload = () => res(window.L); s.onerror = rej; document.head.appendChild(s); });
      villaMap?.remove();
      villaMap = L.map(el, { zoomControl: false, attributionControl: true, dragging: true, scrollWheelZoom: false }).setView([pl.lat, pl.lng], 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(villaMap);
      L.marker([pl.lat, pl.lng], { icon: L.divIcon({ className: 'mk-wrap', html: `<span class="mk villa">${String(icon('house'))}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] }) }).addTo(villaMap);
    } catch { el.innerHTML = '<p class="hint">Karte nicht verfügbar.</p>'; }
  }
  draw();

  root.onclick = async (ev) => {
    const t = ev.target;
    const ed = t.closest('[data-edit]'); if (ed) { editOverrides(ed.dataset.edit); return; }
    if (t.closest('[data-lock]')) { if (await confirmDialog('Private Buchungsdaten von diesem Gerät entfernen? Du kannst sie jederzeit mit dem Passwort wieder entsperren.', { ok: 'Entfernen', danger: true })) { await lockPrivate(); toast('Private Daten entfernt'); } return; }
    const dOpen = t.closest('[data-doc-open]');
    if (dOpen) { const d = await store.getDoc(dOpen.dataset.docOpen); if (d) { const url = URL.createObjectURL(d.blob); const w = window.open(url, '_blank'); if (!w) location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60000); } return; }
    const dDel = t.closest('[data-doc-del]');
    if (dDel) { if (await confirmDialog('Dokument von diesem Gerät löschen?', { ok: 'Löschen', danger: true })) { await store.delDoc(dDel.dataset.docDel); draw(); } return; }
    const del = t.closest('[data-del-task]');
    if (del) { await M.removeTask(del.dataset.delTask); return; }
    if (t.closest('[data-persist]')) { const ok = await store.requestPersistence(); toast(ok ? 'Dauerhafte Speicherung aktiviert' : 'Vom Browser nicht gewährt – bitte regelmässig sichern', 4000); return; }
    if (t.closest('[data-export]')) { exportData($('[data-inc-priv]', root)?.checked); return; }
    if (t.closest('[data-export-text]')) { const txt = DAYS.map((d) => dayShareText(d.date)).join('\n\n———\n\n'); download('reiseplan-2026.txt', txt, 'text/plain'); return; }
    if (t.closest('[data-sim-reset]')) { M.state.settings.simulate = ''; setSimulatedNow(null); await M.save('settings'); toast('Echtes Datum aktiv'); return; }
    if (t.closest('[data-update]')) { const r = await navigator.serviceWorker?.getRegistration(); if (r) { await r.update(); toast(r.waiting || r.installing ? 'Update wird geladen …' : 'App ist aktuell'); } else toast('Offline-Modus nicht aktiv'); return; }
    if (t.closest('[data-wipe]')) {
      if (await confirmDialog('Wirklich ALLE lokalen Daten löschen (Reiseplan, Favoriten, Checkliste, Notizen, Dokumente, private Daten)? Das kann nicht rückgängig gemacht werden.', { ok: 'Alles löschen', danger: true })) {
        indexedDB.deleteDatabase('travel-companion-2026'); toast('Gelöscht – App wird neu geladen'); setTimeout(() => location.reload(), 800);
      }
    }
    const cp = t.closest('[data-copy]'); if (cp && !cp.closest('.kvs')) { /* global handler in app.js */ }
  };
  root.onchange = async (ev) => {
    const t = ev.target;
    if (t.matches('[data-task]')) { await M.toggleTask(t.dataset.task, t.checked); return; }
    if (t.matches('[data-prio]')) { M.state.checklist.prio[t.dataset.prio] = t.value; await M.save('checklist'); return; }
    if (t.matches('[data-theme-opt]')) { M.state.settings.theme = t.value; await M.save('settings'); return; }
    if (t.matches('[data-sim]')) { M.state.settings.simulate = t.value; setSimulatedNow(t.value ? t.value + ':00+02:00' : null); await M.save('settings'); toast('Simuliertes Datum gesetzt'); return; }
    if (t.matches('[data-doc-input]')) {
      const cat = $('[data-doc-cat]', root)?.value || 'Sonstiges';
      for (const file of t.files) {
        if (file.size > 25 * 1024 * 1024) { toast(`${file.name}: zu gross (max. 25 MB)`); continue; }
        await store.putDoc({ id: uid(), name: file.name, type: file.type, size: file.size, category: cat, added: Date.now(), blob: file });
      }
      toast('Dokument gespeichert'); draw(); return;
    }
    if (t.matches('[data-priv-file]')) { try { await importPrivateFile(t.files[0]); toast('Private Daten importiert'); } catch (e) { toast(e.message, 4000); } return; }
    if (t.matches('[data-import]')) { importData(t.files[0]); }
  };
  root.oninput = (ev) => {
    if (ev.target.matches('[data-villa-notes]')) { M.state.notes.villa = ev.target.value; clearTimeout(root._vn); root._vn = setTimeout(() => M.save('notes'), 400); }
  };
  root.onsubmit = async (ev) => {
    const f = ev.target;
    ev.preventDefault();
    if (f.matches('[data-unlock]')) {
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Entschlüssele …';
      try { await unlockWithPassphrase(f.elements.pass.value); toast('Entsperrt'); }
      catch (e) { toast(e.message, 4000); btn.disabled = false; btn.textContent = 'Entsperren'; }
    }
    if (f.matches('[data-add-task]')) { const v = f.elements.t.value.trim(); if (v) { await M.addTask(v); } }
  };
  const onState = (ev) => { if (!ev.detail?.includes('notes')) draw(); };
  window.addEventListener('statechange', onState);
  return () => { window.removeEventListener('statechange', onState); villaMap?.remove(); root.onclick = root.onchange = root.oninput = root.onsubmit = null; };
}

async function exportData(includePriv) {
  const s = M.state;
  const data = { app: 'travel-companion-2026', version: 1, exportedAt: new Date().toISOString(), plan: s.plan, favorites: s.favorites, checklist: s.checklist, notes: s.notes, overrides: s.overrides, settings: { theme: s.settings.theme } };
  if (includePriv && s.priv) data.priv = s.priv;
  download(`reise-sicherung-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
  toast('Sicherung erstellt');
}
async function importData(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'travel-companion-2026') throw new Error('Keine gültige Sicherung dieser App');
    if (!(await confirmDialog('Aktuelle persönliche Daten durch die Sicherung ersetzen?', { ok: 'Ersetzen' }))) return;
    const keys = [];
    for (const k of ['plan', 'favorites', 'checklist', 'notes', 'overrides', 'priv']) if (data[k] !== undefined) { M.state[k] = data[k]; keys.push(k); }
    if (data.settings?.theme) { M.state.settings.theme = data.settings.theme; keys.push('settings'); }
    await M.save(...keys);
    toast('Sicherung wiederhergestellt');
  } catch (e) { toast('Import fehlgeschlagen: ' + e.message, 4500); }
}
