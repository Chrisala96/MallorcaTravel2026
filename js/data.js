// ÖFFENTLICHE Reisedaten – werden über GitHub Pages ausgeliefert.
// Hier stehen KEINE Reservierungsnummern, Namen, Preise, Zahlungsdetails, Villa-Standort oder Privatadressen.
// Diese liegen verschlüsselt in data/private.enc.json (siehe tools/encrypt.mjs).
//
// Status-Begriffe:
//   booked   = Buchung laut Bestätigung
//   fixed    = feste Uhrzeit laut Reiseplan (keine Buchung)
//   approx   = ungefähre Planungszeit
//   open     = Angabe offen / unbekannt
//   conflict = Zeitkonflikt / organisatorisches Risiko

export const TRIP = {
  title: 'Herbstreise 2026',
  subtitle: 'Nürburgring · Mallorca',
  start: '2026-10-10T09:00:00+02:00',
  end: '2026-10-17T23:59:00+02:00',
  firstDay: '2026-10-10',
  lastDay: '2026-10-17',
};

// Orte. approx:true = Marker zeigt nur ungefähr den Ort/das Gelände; Navigation nutzt dann die Adresse (query).
export const PLACES = {
  meet: {
    id: 'meet', name: 'Urban Racing Motorsport Halle', kind: 'trip',
    address: 'Bohlstrasse 24, 8240 Thayngen, Schweiz',
    query: 'Urban Racing Motorsport Halle, Bohlstrasse 24, 8240 Thayngen, Schweiz',
    lat: 47.7476, lng: 8.7072, approx: true, approxNote: 'Marker zeigt nur das Ortszentrum Thayngen. Navigation nutzt die genaue Adresse.',
  },
  hotel: {
    id: 'hotel', name: 'Dorint · Am Nürburgring · Hocheifel', kind: 'trip',
    address: 'Grand-Prix-Strecke, 53520 Nürburg, Deutschland',
    query: 'Dorint Am Nürburgring Hocheifel, Grand-Prix-Strecke, 53520 Nürburg',
    lat: 50.3433, lng: 6.9525, approx: true, approxNote: 'Marker zeigt nur ungefähr den Ort Nürburg. Navigation nutzt die Hoteladresse.',
    phone: '+4926913090', phoneDisplay: '+49 2691 309-0',
    email: 'info.nuerburgring@dorint.com', web: 'https://dorint.com/nuerburgring',
  },
  str: {
    id: 'str', name: 'Flughafen Stuttgart (STR)', kind: 'trip',
    query: 'Flughafen Stuttgart, 70629 Stuttgart',
    lat: 48.6899, lng: 9.2220, approx: true, approxNote: 'Marker zeigt das Flughafengelände. Navigation nutzt den Flughafen als Ziel.',
  },
  pmi: {
    id: 'pmi', name: 'Flughafen Palma de Mallorca (PMI)', kind: 'trip',
    query: 'Aeropuerto de Palma de Mallorca',
    lat: 39.5517, lng: 2.7388, approx: true, approxNote: 'Marker zeigt das Flughafengelände.',
  },
  sixt: {
    id: 'sixt', name: 'SIXT Mallorca Palma Flughafen', kind: 'trip',
    address: 'Zona rent a car – Llegadas, 07610 Palma de Mallorca',
    lat: 39.545344, lng: 2.726664, approx: false,
    coordNote: 'Koordinaten der Rückgabestation laut SIXT-Bestätigung.',
  },
};

// Feste Abläufe je Tag. "sort" dient nur zum Einsortieren eigener Aktivitäten – es ist KEINE Zeitangabe.
export const DAYS = [
  { date: '2026-10-10', title: 'Abreise & Nürburgring', region: 'nuerburg', section: 'Anreise Nürburgring' },
  { date: '2026-10-11', title: 'Nürburgring', region: 'nuerburg', section: 'Nürburgring', free: true,
    freeNote: 'Keine Aktivitäten oder Uhrzeiten bestätigt – frei planbar.' },
  { date: '2026-10-12', title: 'Nürburgring → Mallorca', region: 'transit', section: 'Reisetag nach Mallorca' },
  { date: '2026-10-13', title: 'Mallorca', region: 'mallorca', section: 'Mallorca', free: true, freeNote: 'Keine bestätigten Aktivitäten – frei planbar.' },
  { date: '2026-10-14', title: 'Mallorca', region: 'mallorca', section: 'Mallorca', free: true, freeNote: 'Keine bestätigten Aktivitäten – frei planbar.' },
  { date: '2026-10-15', title: 'Mallorca', region: 'mallorca', section: 'Mallorca', free: true, freeNote: 'Keine bestätigten Aktivitäten – frei planbar.' },
  { date: '2026-10-16', title: 'Mallorca', region: 'mallorca', section: 'Mallorca', free: true, freeNote: 'Keine bestätigten Aktivitäten – frei planbar.' },
  { date: '2026-10-17', title: 'Rückreise', region: 'return', section: 'Rückreise' },
];

export const EVENTS = [
  // Samstag 10.10.
  { id: 'ev-meet', date: '2026-10-10', time: '09:00', sort: '09:00', status: 'fixed', icon: 'flag',
    title: 'Treffpunkt', subtitle: 'Urban Racing Motorsport Halle, Thayngen', place: 'meet', shareable: true },
  { id: 'ev-drive-nbr', date: '2026-10-10', time: '10:00', sort: '10:00', status: 'fixed', icon: 'car',
    title: 'Abfahrt Richtung Nürburgring', subtitle: 'Auto · Thayngen → Dorint Am Nürburgring',
    route: { from: 'meet', to: 'hotel' }, notes: ['Fahrzeit nicht bestätigt – Fahrzeit bitte in Google Maps prüfen.', 'Ankunftszeit offen.'], shareable: true },
  { id: 'ev-checkin', date: '2026-10-10', timeLabel: 'ab 15:00', sort: '15:00', status: 'booked', icon: 'bed-double',
    title: 'Check-in Dorint Hotel', subtitle: 'Übernachtung 10.–12.10.', place: 'hotel', booking: 'hotel',
    notes: ['Check-in ab 15:00 Uhr laut Buchung. Tatsächliche Ankunft hängt von der Fahrzeit ab.'] },

  // Montag 12.10.
  { id: 'ev-breakfast', date: '2026-10-12', timeLabel: 'Morgens', sort: '07:00', status: 'booked', timeOpen: true, icon: 'coffee',
    title: 'Frühstück im Hotel', subtitle: 'inklusive', place: 'hotel', notes: ['Keine Frühstückszeit bestätigt.'] },
  { id: 'ev-drive-str', date: '2026-10-12', time: '10:30', timeLabel: 'ca. 10:30', sort: '10:30', status: 'approx', icon: 'car',
    title: 'Abfahrt zum Flughafen Stuttgart', subtitle: 'Auto · Nürburgring → STR', route: { from: 'hotel', to: 'str' },
    notes: ['Ungefähre Planungszeit.', 'Fahrzeit bitte in Google Maps prüfen – inkl. Parkieren, Weg zum Terminal, Check-in und Sicherheitskontrolle.'], shareable: true },
  { id: 'ev-checkout', date: '2026-10-12', timeLabel: 'bis 11:00', sort: '10:31', status: 'booked', icon: 'key',
    title: 'Check-out Dorint', subtitle: 'spätestens 11:00 Uhr', place: 'hotel', booking: 'hotel' },
  { id: 'ev-parking', date: '2026-10-12', timeLabel: 'vor Abflug', sort: '16:00', status: 'open', icon: 'square-parking',
    title: 'Parkieren Flughafen Stuttgart', subtitle: 'Parkplatz noch nicht gebucht', link: '#/parking', booking: 'parking', dynamic: 'parking' },
  { id: 'ev-flight-out', date: '2026-10-12', time: '17:50', sort: '17:50', status: 'fixed', icon: 'plane-takeoff',
    title: 'Flug DE1524', subtitle: 'Stuttgart (STR) → Palma (PMI) · Ankunft 19:55', place: 'str', booking: 'flights', shareable: true,
    notes: ['Fluggesellschaft, Terminal, Gate, Gepäck und Buchungsreferenz: offen.'] },
  { id: 'ev-landing', date: '2026-10-12', time: '19:55', sort: '19:55', status: 'fixed', icon: 'plane-landing',
    title: 'Landung Palma de Mallorca', subtitle: 'PMI · planmässig 19:55', place: 'pmi', shareable: true },
  { id: 'ev-sixt-pickup', date: '2026-10-12', sort: '20:00', status: 'conflict', icon: 'car',
    title: 'SIXT-Mietwagen übernehmen', subtitle: 'Mallorca Palma Flughafen', place: 'sixt', booking: 'sixt', dynamic: 'sixtPickup' },
  { id: 'ev-to-villa', date: '2026-10-12', timeLabel: 'Zeit offen', sort: '21:00', status: 'open', icon: 'route',
    title: 'Fahrt zur Villa', subtitle: 'Flughafen Palma → Ferienvilla', route: { from: 'sixt', to: 'villa' }, booking: 'villa',
    notes: ['Abfahrtszeit offen. Fahrzeit bitte in Google Maps prüfen.'] },

  // Samstag 17.10.
  { id: 'ev-villa-out', date: '2026-10-17', timeLabel: 'Zeit offen', sort: '08:00', status: 'open', icon: 'key',
    title: 'Abreise aus der Villa', subtitle: 'Check-out-Zeit nicht bestätigt', place: 'villa', booking: 'villa' },
  { id: 'ev-drive-pmi', date: '2026-10-17', timeLabel: 'Zeit offen', sort: '09:00', status: 'open', icon: 'route',
    title: 'Fahrt zum Flughafen Palma', subtitle: 'Villa → SIXT-Rückgabe', route: { from: 'villa', to: 'sixt' },
    notes: ['Fahrzeit bitte in Google Maps prüfen.'] },
  { id: 'ev-sixt-return', date: '2026-10-17', sort: '10:00', status: 'conflict', icon: 'car',
    title: 'SIXT-Mietwagen zurückgeben', subtitle: 'Mallorca Palma Flughafen', place: 'sixt', booking: 'sixt', dynamic: 'sixtReturn' },
  { id: 'ev-flight-back', date: '2026-10-17', time: '14:45', sort: '14:45', status: 'fixed', icon: 'plane-takeoff',
    title: 'Flug DE1525', subtitle: 'Palma (PMI) → Stuttgart (STR)', place: 'pmi', booking: 'flights', dynamic: 'returnFlight', shareable: true },
  { id: 'ev-drive-home', date: '2026-10-17', timeLabel: 'Zeit offen', sort: '20:00', status: 'open', icon: 'house',
    title: 'Rückfahrt in die Schweiz', subtitle: 'Flughafen Stuttgart → Schaffhausen', route: { from: 'str', to: 'home' },
    notes: ['Abfahrts- und Ankunftszeit offen.', 'Ziel ist Schaffhausen – nicht Thayngen.'] },
];

export const FLIGHTS = {
  out: { no: 'DE1524', date: '2026-10-12', from: 'Stuttgart (STR)', to: 'Palma de Mallorca (PMI)', dep: '17:50', arr: '19:55' },
  back: { no: 'DE1525', date: '2026-10-17', from: 'Palma de Mallorca (PMI)', to: 'Stuttgart (STR)', dep: '14:45', arr: null },
  openFields: ['Fluggesellschaft', 'Terminal', 'Gate', 'Gepäckbestimmungen', 'Buchungsreferenz'],
};

export const SIXT_PUBLIC = {
  provider: 'SIXT',
  // Am 08.10.2026 bei SIXT geändert (ursprünglich 12.10. 14:00 / 17.10. 16:00).
  bookedPickup: '2026-10-12T19:30:00+02:00',
  bookedReturn: '2026-10-17T14:30:00+02:00',
  originalPickup: '2026-10-12T14:00:00+02:00',
  originalReturn: '2026-10-17T16:00:00+02:00',
  graceMinutes: 60, // Kulanz für die Abholung laut Bestätigung (innerhalb der Öffnungszeiten)
  returnWarnMinutes: 120, // Warnschwelle der App für die Zeit zwischen Rückgabe und Abflug (keine Vorgabe von SIXT/Airline)
  station: 'Mallorca Palma Flughafen · Zona rent a car – Llegadas · 07610 Palma de Mallorca',
  manageUrl: 'https://www.sixt.de/account/#/manage-my-booking-info',
  pickupWarning: 'Abholzeit des Mietwagens stimmt nicht mit der Flugankunft überein. Änderung bei SIXT erforderlich.',
  returnWarning: 'Rückgabezeit des Mietwagens liegt nach dem Abflug. Änderung bei SIXT erforderlich.',
  returnTightWarning: 'Rückgabe sehr knapp vor dem Abflug – Check-in, Gepäckaufgabe und Sicherheitskontrolle brauchen Zeit. Bitte Rückgabezeit prüfen.',
};

// Flughafenparkplatz Stuttgart – nur reale Anbieter. Preise/Verfügbarkeit bitte immer beim Anbieter prüfen.
// Recherchestand: 08.10.2026.
export const PARKING = {
  checkedAt: '08.10.2026',
  options: [
    {
      id: 'str-official', name: 'Flughafen Stuttgart – offizielles Parken', operator: 'Flughafen Stuttgart / APCOA',
      bookingUrl: 'https://parken.flughafen-stuttgart.de/readmore/58',
      infoUrl: 'https://www.stuttgart-airport.com/de/reisende-besucher/anreise-parken/parken/',
      facts: [
        'Laut Flughafen-Website (Stand 08.10.2026) geöffnet: P0, P2, P3, P4, P5, P6, P12, P14.',
        'Online-Specials buchbar für P0, P2, P4, P6 und P14.',
        'Herbst-Special laut Website „ab 39 € pro Woche“, gültig bis 01.11.2026 – Verfügbarkeit für unsere Daten nicht geprüft.',
        'Terminals laut Flughafen über (teilweise überdachte) Fusswege erreichbar – kein Shuttle nötig.',
      ],
      distance: 'Terminalnah (Fussweg). P2 laut Vergleichsportal ParkingList ca. 500 m, P0 ca. 750 m zur Abflughalle.',
      shuttle: 'Nicht erforderlich (Fussweg).',
      hours: 'Laut Flughafen rund um die Uhr Hilfe über Ruf-/Hilfetaste; genaue Öffnungszeiten je Parkhaus bitte auf der Website prüfen.',
      query: 'Parkhaus P2 Flughafen Stuttgart',
    },
    {
      id: 'holidayextras', name: 'Holiday Extras – Vergleich (u. a. Airparks)', operator: 'Vergleichsportal',
      bookingUrl: 'https://www.holidayextras.com/de/stuttgart-flughafen-parken/parkgebuehren-flughafen-stuttgart.html',
      facts: ['Listet u. a. Airparks-Parkplätze mit Shuttle (laut Portal ca. 10–15 Min.) sowie Airport Parking Stuttgart.', 'Gezeigte Preise sind Beispielpreise des Portals – nicht für unsere Daten geprüft.'],
      distance: 'Ausserhalb des Flughafengeländes (Shuttle).', shuttle: 'Ja, laut Portal je nach Anbieter ca. 10–15 Min.', hours: 'Je Anbieter – bitte auf der Buchungsseite prüfen.',
      query: 'Airparks Stuttgart',
    },
    {
      id: 'parkinglist', name: 'ParkingList – Vergleich Flughafen Stuttgart', operator: 'Vergleichsportal',
      bookingUrl: 'https://www.parkinglist.de/terminal-parken/p2-parkhaus-flughafen-stuttgart',
      facts: ['Vergleicht offizielle Terminal-Parkhäuser und Anbieter in der Umgebung.', 'Nach Buchung erhält man laut Portal eine Einfahrts-ID für das Parkhaus.'],
      distance: 'Je nach Parkhaus (z. B. P2 ca. 500 m laut Portal).', shuttle: 'Je nach Angebot.', hours: 'Je Anbieter – bitte prüfen.',
      query: 'Flughafen Stuttgart Parken',
    },
  ],
  note: 'Abflug 12.10. um 17:50 Uhr. Ankunftszeit des Rückflugs am 17.10. ist noch offen – die Ausfahrtszeit für die Buchung muss daher mit Reserve gewählt werden.',
};

export const CHECKLIST_DEFAULT = [
  { id: 'c-sixt-pickup', title: 'SIXT-Abholzeit korrigieren', detail: 'Am 08.10. auf 12.10. ab 19:30 geändert.', priority: 'high', link: SIXT_PUBLIC.manageUrl, defaultDone: true },
  { id: 'c-sixt-return', title: 'SIXT-Rückgabezeit korrigieren', detail: 'Am 08.10. auf 17.10. 14:30 geändert.', priority: 'high', link: SIXT_PUBLIC.manageUrl, defaultDone: true },
  { id: 'c-sixt-return-check', title: 'SIXT-Rückgabe 14:30 vs. Abflug 14:45 prüfen', detail: 'Nur 15 Min. zwischen Rückgabe und Abflug – frühere Rückgabe nötig?', priority: 'high', link: SIXT_PUBLIC.manageUrl },
  { id: 'c-parking', title: 'Parkplatz am Flughafen Stuttgart suchen und buchen', detail: 'Zeitraum 12.–17.10.2026.', priority: 'high', route: '#/parking' },
  { id: 'c-return-arrival', title: 'Ankunftszeit des Rückflugs DE1525 prüfen', detail: 'Wichtig für Parkplatz und Rückfahrt.', priority: 'medium', route: '#/booking/flights' },
  { id: 'c-villa', title: 'Fehlende Villadetails ergänzen', detail: 'Adresse, Check-in/-out, Schlüsselübergabe, Kontakt, Preis.', priority: 'medium', route: '#/villa' },
  { id: 'c-flight-info', title: 'Fehlende Flugbuchungsinformationen ergänzen', detail: 'Fluggesellschaft, Terminal, Gepäck, Buchungsreferenz.', priority: 'medium', route: '#/booking/flights' },
];

// Wetter-Orte (Open-Meteo). Die Villa-Position kommt aus den privaten Daten.
export const WEATHER_SPOTS = {
  nuerburg: { label: 'Nürburg', lat: 50.3433, lng: 6.9525 },
  palma: { label: 'Mallorca (Palma)', lat: 39.5696, lng: 2.6502 },
  stuttgart: { label: 'Stuttgart Flughafen', lat: 48.6899, lng: 9.2220 },
};
