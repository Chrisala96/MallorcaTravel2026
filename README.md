# Herbstreise 2026 – Travel Companion

Progressive Web App für die Reise vom 10.–17. Oktober 2026 (Thayngen → Nürburgring → Mallorca → Schaffhausen).
Läuft komplett statisch auf GitHub Pages – kein Server, kein Build-Schritt, keine Konten, keine API-Schlüssel.

---

## 1. Architektur

| Baustein | Lösung | Warum |
|---|---|---|
| Frontend | Vanilla JavaScript (ES-Module), HTML, CSS | Kein Build, keine Framework-Abhängigkeit, läuft direkt auf GitHub Pages |
| Routing | Hash-Router (`#/plan/2026-10-12`) | Funktioniert unter jeder Projekt-URL ohne Server-Rewrites |
| Speicher | IndexedDB (nur auf dem Gerät) | Reiseplan, Favoriten, Checkliste, Notizen, PDFs, Ergänzungen |
| Offline | Service Worker + Web-App-Manifest | App-Shell, Schriften, Karte-Bibliothek und Reisedaten im Cache |
| Private Daten | AES-256-GCM, Schlüssel per PBKDF2 (600 000 Runden) | Buchungsnummern etc. liegen nur verschlüsselt im öffentlichen Repo |
| Karte | Leaflet 1.9.4 (lokal) + OpenStreetMap-Kacheln | Kostenlos, ohne Schlüssel |
| Ortssuche | OpenStreetMap Overpass API (live) | Kostenlos, ohne Schlüssel, CORS-fähig |
| Wetter | Open-Meteo | Kostenlos, ohne Schlüssel, CORS-fähig |
| Navigation | Offizielle Google-Maps-URLs (`/maps/dir/?api=1…`) | Öffnet App oder Browser, inkl. Live-Verkehr |
| Teilen | Web Share API, Fallback `https://wa.me/?text=` | Dokumentierte, plattformübergreifende Links |

**Bewusst nicht eingebaut:** Google Places (Bewertungen, Preise) und Live-Flugstatus. Beide benötigen kostenpflichtige
API-Schlüssel, die auf GitHub Pages nicht geheim gehalten werden können. Ersatz: gezielte Google-Maps-Suche bzw. Websuche
per Button. Fahrzeiten werden nicht berechnet, sondern in Google Maps geöffnet („Fahrzeit bitte in Google Maps prüfen“).

### Was funktioniert offline, online, extern?

| Funktion | Offline | Online nötig |
|---|---|---|
| Reiseplan, Buchungen, Checkliste, Favoriten, Notizen, Dokumente, Export | ✓ | – |
| Private Daten entsperren | ✓ (nach dem ersten Entsperren) | einmalig |
| Wetter | letzter Stand mit Zeitstempel | Open-Meteo |
| Entdecken (Ortssuche) | letzte Ergebnisse | Overpass API |
| Kartenhintergrund | nur bereits geladene Kacheln | OSM-Kacheln |
| Navigation, Verkehr, Bewertungen, Flugstatus | – | Google Maps / Websuche (extern) |

## 2. Designkonzept

- **Farben:** warmes Sand-Papier (`#f5f1ea`) als Grund, tiefes Mittelmeer-Petrol (`#0e5a61`) als Akzent, Gold (`#b07a2f`) für Wärme. Eigene Dunkelpalette, automatisch nach Systemeinstellung oder manuell.
- **Typografie:** *Fraunces* (Display-Serif) für Titel und Zahlen, *Inter* für die Oberfläche – beide lokal eingebunden.
- **Statussystem** (überall gleich):
  `Gebucht` (grün) · `Feste Zeit` (blau) · `Ca.-Zeit` (bernstein, gestrichelt) · `Offen` (grau, gestrichelt) · `Konflikt` (rot) ·
  eigene Planung: `Idee` · `Geplant` · `Bestätigt` (nur nach ausdrücklicher Rückfrage) · `Erledigt`.
- **Navigation:** fixe Bottom-Bar mit Home · Reiseplan · Entdecken · Karte · Mehr; Detailansichten als Bottom-Sheets (Einhand-Bedienung).
- **Dashboard** passt sich automatisch an: *vor der Reise* Countdown + Treffpunkt, *während* Reisetag/Abschnitt/„Heute zeitkritisch“, *danach* Rückblick + Export.

## 3. Ordnerstruktur

```
index.html               App-Einstieg
manifest.webmanifest     PWA-Manifest (relative Pfade)
sw.js                    Service Worker (Offline)
.nojekyll                GitHub Pages: Dateien unverändert ausliefern
css/app.css              Designsystem
js/
  app.js                 Start, Router, Theme, Service-Worker-Updates
  data.js                ÖFFENTLICHE Reisedaten (zentrale Konfiguration)
  model.js               Zustand, Konflikterkennung, Tagesablauf
  ui.js, details.js      Komponenten, Sheets, Editoren, Teilen
  store.js               IndexedDB
  crypto.js, privacy.js  Verschlüsselung / Entsperren
  weather.js             Open-Meteo
  overpass.js            OSM-Suche + Öffnungszeiten-Parser
  views/                 home, plan, discover, map, more
data/private.enc.json    verschlüsselte Buchungsdaten (darf öffentlich sein)
tools/encrypt.mjs        erzeugt private.enc.json aus private/private-data.json
vendor/, fonts/, icons/  Leaflet, Schriften, App-Icons
private/                 KLARTEXT – steht in .gitignore, niemals hochladen
```

## 4. Veröffentlichen auf GitHub Pages (Schritt für Schritt)

1. Auf github.com einloggen → **New repository** → Name z. B. `reise-2026` → *Public* (GitHub Pages ist bei kostenlosen Konten nur für öffentliche Repos verfügbar) → **Create repository**.
2. Im neuen Repo: **Add file → Upload files**. Den *Inhalt* des entpackten Ordners `travel-companion` hineinziehen (inkl. der Ordner `css`, `js`, `data`, …). **Den Ordner `private/` nicht hochladen.**
   Hinweis: Die Datei `.nojekyll` beginnt mit einem Punkt; falls der Upload sie nicht übernimmt, ist das unkritisch.
3. **Commit changes** klicken.
4. **Settings → Pages** → *Source:* „Deploy from a branch“ → *Branch:* `main`, Ordner `/ (root)` → **Save**.
5. Nach 1–2 Minuten erscheint die Adresse, z. B. `https://<benutzername>.github.io/reise-2026/`.
6. Freischalt-Link für alle Mitreisenden: `https://<benutzername>.github.io/reise-2026/#k=<Reise-Passwort>`
   (Der Teil nach `#` wird nie an einen Server gesendet. Alternativ das Passwort unter *Mehr → Private Daten* eingeben.)
7. Auf dem Smartphone öffnen und zum Home-Bildschirm hinzufügen:
   iPhone: Safari → Teilen → „Zum Home-Bildschirm“. Android: Chrome → ⋮ → „App installieren“.

Alternativ per Kommandozeile:
```bash
cd travel-companion
git init && git add . && git commit -m "Reise-App"   # private/ wird durch .gitignore ausgeschlossen
git branch -M main
git remote add origin https://github.com/<benutzername>/reise-2026.git
git push -u origin main
```

**Relative Pfade:** Alle Verweise (Manifest, Service Worker, Skripte, Daten) sind relativ (`css/app.css`, `sw.js`, `./`).
Deshalb funktioniert die App unter `…github.io/<repo>/` genauso wie unter einer eigenen Domain.

## 5. Daten ändern

- **Öffentliche Reisedaten** (Zeiten, Orte, Checkliste, Parkplatz-Anbieter): `js/data.js` bearbeiten.
- **Private Buchungsdaten:** `private/private-data.json` bearbeiten und neu verschlüsseln (Node.js ≥ 20):
  ```bash
  node tools/encrypt.mjs --generate        # neues Passwort vorschlagen (optional)
  node tools/encrypt.mjs "passwort"        # schreibt data/private.enc.json
  ```
- **Nach jeder Änderung** in `sw.js` die Konstante `VERSION` und in `js/version.js` die Version erhöhen. Die App zeigt dann „Neue Version verfügbar“.
- **Ergänzungen für alle Geräte** (Gate, Terminal, Villa-Adresse, Parkplatz …): in `private/private-data.json` im Abschnitt `shared` eintragen, neu verschlüsseln, hochladen. Jedes bereits entsperrte Gerät übernimmt die neue Version beim nächsten Öffnen mit Internet automatisch (Anzeige „ergänzt“). Mögliche Felder:
  - `flights`: `airline`, `ref`, `terminal`, `gate`, `baggage`, `returnArrival` (z. B. `"19:05"`)
  - `villa`: `address`, `checkin`, `checkout`, `keys`, `contact`, `price`, `conditions`
  - `parking`: `booked` (true/false), `provider`, `ref`, `notes`
  - `sixt`: `pickup`, `ret` (z. B. `"2026-10-17T12:30"`), `pickupConfirmed`, `retConfirmed` (true)
- **Lokale Korrekturen** ohne Code: in der App „Angaben ergänzen“ – gilt nur auf diesem Gerät („manuell“) und hat Vorrang vor zentralen Werten. „Zurücksetzen“ stellt die zentralen Werte wieder her.

## 6. Datenschutz

- Im öffentlichen Repo stehen **keine** Reservierungsnummern, Namen, Preise, Zahlungsdaten, Villa-Koordinaten oder die Heimadresse im Klartext – nur verschlüsselt.
- Hoteladresse/-kontakt, Flugnummern, SIXT-Station und Treffpunkt sind öffentlich (geschäftliche, unkritische Angaben).
- Geteilte Nachrichten enthalten nie Reservierungsnummern, Villa-Standort oder Heimadresse.
- Exporte enthalten private Daten nur, wenn das ausdrücklich angehakt wird.
- `robots: noindex` verhindert die Indexierung durch Suchmaschinen (kein Zugriffsschutz).
- Browserdaten (Plan, Favoriten, Dokumente) gehen verloren, wenn Website-Daten gelöscht werden → regelmässig unter *Mehr → Sichern* exportieren.

## 7. Teststatus (08.10.2026, Version 1.2.1)

Tatsächlich ausgeführt (Chromium headless, 390 px und 320 px Breite, unter einer Projekt-Unterpfad-URL):

- ✔ Alle fünf Hauptbereiche und alle Unterseiten laden ohne JavaScript-Fehler
- ✔ Entsperren per Passwort und per Freischalt-Link; Hash wird danach entfernt
- ✔ Service Worker registriert sich unter dem Projektpfad; App startet offline aus dem Cache inkl. privater Daten
- ✔ SIXT-Konflikte sichtbar; verschwinden nur nach eingetragener *und* als „bei SIXT geändert“ bestätigter Zeit, die zum Flug passt; eine Rückgabezeit nach Abflug bleibt Konflikt
- ✔ Aktivität hinzufügen, „Bestätigt“ nur nach Rückfrage, Reihenfolge ändern, erledigt markieren, Persistenz nach Neuladen
- ✔ Manueller Favorit mit Google-Maps-Link (Koordinaten werden erkannt), Marker auf der Karte
- ✔ Teilen-Fallback auf WhatsApp; geteilter Tagesplan ohne Reservierungsnummern/Adressen
- ✔ Checkliste wird nie automatisch abgehakt
- ✔ Dashboard-Phasen per Testmodus (vor/während/nach der Reise)
- ✔ Dark Mode, kein horizontales Scrollen bei 320 px
- ✔ Export ohne private Daten (Standard)
- ✔ Ortssuche sendet den von Overpass geforderten Referrer; Ergebnisdarstellung mit simulierter Server-Antwort
- ✔ Keine Überlappung von Bezeichnung und Wert in den Buchungsdetails (360 px)
- ✔ Neue SIXT-Zeiten (ab 19:30 / 14:30): keine Abholwarnung, Warnung „Rückgabe nur 15 Min. vor Abflug“
- ✔ Zentrale Ergänzung kommt nach neuer Veröffentlichung automatisch an; lokale Korrektur hat Vorrang; Zurücksetzen
- ✔ Parkplatz P14: gebucht, Ein-/Ausfahrt, Buchungsnummer/Betrag/QR nur entsperrt; QR in der App lesbar und identisch mit dem Original
- ✔ Eigene Bewertung (1–5 Sterne) speichert Ort als Favorit; Favoriten-Filter Essen/Aktivitäten/bewertet

**Noch nicht durchgeführt** (in der Entwicklungsumgebung war kein Internetzugriff für den Browser möglich):

- ✘ Live-Abruf Open-Meteo (Wetter), Overpass (Entdecken) und OSM-Kartenkacheln gegen die echten Server
- ✘ Tests auf echten iPhone-/Android-Geräten (Safari, Installation auf dem Home-Bildschirm, Web Share API)
- ✘ Tatsächliches Deployment auf GitHub Pages
- ✘ Öffnen der Google-Maps-, SIXT-, e-domizil- und Parkplatz-Links

**Bitte nach dem Veröffentlichen kurz prüfen:** Wetter lädt, eine Kategorie in *Entdecken* liefert Treffer, Karte zeigt Hintergrund, App lässt sich installieren.

## 8. Lizenzen

Leaflet (BSD-2-Clause) · Lucide Icons (ISC) · Inter und Fraunces (SIL Open Font License, siehe `fonts/`) ·
Karten- und Ortsdaten © OpenStreetMap-Mitwirkende (ODbL) · Wetter: Open-Meteo (CC BY 4.0).
