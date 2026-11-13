# Martiniloben Podersdorf 2026 – Geheime Missionen

Mobile-first Web-App für ein geheimes Begleitspiel beim Martiniloben-Weinfest in Podersdorf am See.
React 19 + TypeScript + Tailwind CSS 4 + GSAP im Frontend, **eigener Node.js-Server** mit SQLite
(in Node eingebaut) und Live-Updates per Server-Sent Events. Keine externen Dienste nötig.

## Entwickeln

```bash
npm install
npm run dev
```

Startet API-Server (Port 8787) und Vite (Port 5173) zusammen. Beim **ersten Start** legt der Server
die Datenbank `data/martiniloben.sqlite` mit zufälligen PINs an. Simons Admin-PIN ist fest **1413**
(Variable `ADMIN_PIN` überschreibt ihn). Alle anderen PINs stehen im Admin-Bereich der App.

## Betrieb

```bash
npm run build      # baut die App nach dist/
npm start          # startet den Server: App + API auf PORT (Standard 8787)
```

Umgebungsvariablen: `PORT` (Standard 8787), `DATA_DIR` (Ordner für die Datenbank, Standard `./data`), `ADMIN_PIN` (Standard 1413).
Voraussetzung: Node.js ≥ 22.18. Alternativ per Docker (`Dockerfile` liegt bei, Datenbank im Volume `/data`).

**Wichtig:** Die Datenbank ist eine Datei. Der Hoster muss sie dauerhaft speichern (persistentes
Volume/Disk), sonst ist der Spielstand nach einem Neustart weg. Sicherung = Datei kopieren.

## Hosting auf Railway

1. Railway → *New Project* → *Deploy from GitHub repo* → `simonkalkhofer/martiniloben-2026-podersdorf`.
   Railway baut per `Dockerfile` (Einstellungen in `railway.json`: 1 Instanz, Healthcheck `/api/health`).
2. Im Service: **Volume anlegen**, Mount-Pfad `/data`. Ohne Volume ist der Spielstand nach jedem Deploy weg
   (der Server warnt dann im Log). Der Server nutzt `RAILWAY_VOLUME_MOUNT_PATH` automatisch.
3. *Settings → Networking → Generate Domain* → das ist der Link für die Handys.
4. Simons Admin-PIN ist fest **1413** (änderbar über die Railway-Variable `ADMIN_PIN`).
   Danach alle PINs im Admin-Bereich.
5. Jeder Push auf `main` deployt automatisch neu; der Spielstand bleibt im Volume erhalten.

Wichtig: nur **eine** Instanz betreiben (SQLite-Datei + Live-Updates im Speicher).

## Spielregeln (so umgesetzt)

- Standardmäßig 2 reguläre Ziehungen pro Kalendertag (Zeitzone Europe/Vienna, im Admin-Bereich 0–10
  einstellbar), Stufe frei wählbar: Leicht = 1 Punkt, Mittel = 2, Schwer = 3.
- Gezogen wird eine zufällige Karte, die **noch niemand** hatte. Erst wenn eine Stufe leer ist,
  kommen Karten, die dieser Spieler selbst noch nie hatte.
- „Als erledigt melden“ → Zeuge auswählen → der Zeuge bestätigt (Punkte) oder lehnt ab.
- Gescheitert (aufgegeben oder abgelehnt) = 0 Punkte. Bei einer **regulären** Karte gibt es
  +1 Ersatz-Ziehung, bei einer Ersatz-Karte nicht. Ersatz-Ziehungen verfallen nicht am Tagesende.
- Reihenfolge beim Ziehen: regulär (verfällt um Mitternacht) → Ersatz → Extra-Karten vom Admin.
- Extra-Karten verfallen nicht, zählen nicht gegen das Tageslimit und verhalten sich sonst wie reguläre
  Karten (scheitern → +1 Ersatz-Ziehung).

## Admin-Bereich (Simon und Andi)

Admins sind in `ADMINS` (`server/db.ts`) festgelegt und werden bei jedem Start gesetzt. Nur Simon hat den festen PIN (1413);
Andis PIN ist zufällig und kann neu erzeugt werden. Admins können nicht entfernt werden.

- **Spielsteuerung:** Karten pro Tag (0–10), Ziehen pausieren/erlauben, Ansage an alle (Startseite).
- **Spieler** (antippen): Extra-Karten geben (+1/+2/+3) oder wegnehmen (−1), Ansage-Recht ein/aus,
  Tageslimit zurücksetzen, neuen PIN erzeugen, Spieler entfernen. Neue Spieler anlegen, PINs anzeigen.

## Ansagen an alle

- Dürfen: Admin immer, außerdem freigeschaltete Spieler (📣 in der Spielerliste).
  Beim allerersten Start werden **Mario, Stefan und Andi** freigeschaltet (`DEFAULT_ANNOUNCERS` in
  `server/db.ts`), danach nur noch über den Admin-Bereich änderbar.
- Knopf „📣 Ansage an alle machen“ auf der Startseite. Die Ansage erscheint bei allen sofort,
  immer mit Absender und Uhrzeit („— Mario · Fr., 20:15“). Eine neue Ansage ersetzt die alte.
- **Missionen:** alle Karten mit Status; wartende Bestätigungen stellvertretend bestätigen/ablehnen;
  laufende Karten zurück in den Stapel legen (Ziehung wird erstattet).
- **Gefahrenzone:** Spiel komplett zurücksetzen (Bestätigungswort `NEU`): alle Karten zurück und neu
  gemischt, Punkte auf 0, Extra-Karten weg. Spieler, PINs und Einstellungen bleiben.

## Sicherheit

- PINs und fremde Missionen verlassen den Server nur über den Admin-Endpunkt (nur für Admins).
- Login erzeugt ein zufälliges Session-Token; PIN neu setzen meldet den Spieler überall ab.
- Nach 5 falschen PINs ist ein Spieler 5 Minuten gesperrt.
- Live-Kanal `/api/events` überträgt nur eine Versionsnummer, keine Spieldaten.

## API

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/players` | Spielernamen für das Login |
| POST | `/api/login` | `{playerId, pin}` → `{token, player}` |
| GET | `/api/state` | Rangliste, eigene Karten, Ziehungen, offene Bestätigungen |
| POST | `/api/draw` · `/api/report` · `/api/give-up` · `/api/resolve` | Spielaktionen |
| POST | `/api/announce` | `{text}` Ansage an alle (Admin + freigeschaltete Spieler; leer = entfernen) |
| GET/POST | `/api/admin/*` | `announcer`, `overview`, `players`, `reset-pin`, `reset-draws`, `settings`, `give-extra`, `resolve`, `return-card`, `delete-player`, `reset-game` |
| GET | `/api/events` | Server-Sent Events bei jeder Änderung |

Authentifizierung: `Authorization: Bearer <token>`.

## Struktur

```
server/index.ts      HTTP-Server, Routen, Live-Updates, Auslieferung von dist/
server/game.ts       gesamte Spiellogik
server/db.ts         SQLite-Schema, Erst-Befüllung (Spieler + 90 Missionen)
src/lib/missions.ts  90 Missionen + Spielernamen
src/lib/httpApi.ts   Frontend-Anbindung an den Server
src/pages/           Login, Home (Rangliste), Missionen, Bestätigungen, Admin
src/components/      Hero (SVG-Leuchtturm), BottomNav, Modal, Toast
graphify-out/        Wissensgraph des Codes (graphify), GRAPH_REPORT.md
```
