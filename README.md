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
die Datenbank `data/martiniloben.sqlite` an und schreibt den Admin-PIN von Simon in die Konsole.
Alle anderen PINs stehen danach im Admin-Bereich der App.

## Betrieb

```bash
npm run build      # baut die App nach dist/
npm start          # startet den Server: App + API auf PORT (Standard 8787)
```

Umgebungsvariablen: `PORT` (Standard 8787), `DATA_DIR` (Ordner für die Datenbank, Standard `./data`).
Voraussetzung: Node.js ≥ 22.18. Alternativ per Docker (`Dockerfile` liegt bei, Datenbank im Volume `/data`).

**Wichtig:** Die Datenbank ist eine Datei. Der Hoster muss sie dauerhaft speichern (persistentes
Volume/Disk), sonst ist der Spielstand nach einem Neustart weg. Sicherung = Datei kopieren.

## Spielregeln (so umgesetzt)

- 2 reguläre Ziehungen pro Kalendertag (Zeitzone Europe/Vienna), Stufe frei wählbar:
  Leicht = 1 Punkt, Mittel = 2, Schwer = 3.
- Gezogen wird eine zufällige Karte, die **noch niemand** hatte. Erst wenn eine Stufe leer ist,
  kommen Karten, die dieser Spieler selbst noch nie hatte.
- „Als erledigt melden“ → Zeuge auswählen → der Zeuge bestätigt (Punkte) oder lehnt ab.
- Gescheitert (aufgegeben oder abgelehnt) = 0 Punkte. Bei einer **regulären** Karte gibt es
  +1 Ersatz-Ziehung, bei einer Ersatz-Karte nicht. Ersatz-Ziehungen verfallen nicht am Tagesende.
- Sind reguläre und Ersatz-Ziehungen offen, wird zuerst regulär gezogen (die verfallen um Mitternacht).
- Admin (Simon): PINs ansehen/neu erzeugen, Spieler hinzufügen, Tageslimit pro Spieler oder für alle
  zurücksetzen, alle Missionen mit Status sehen.

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
| GET/POST | `/api/admin/*` | Übersicht, Spieler anlegen, PIN/Tageslimit zurücksetzen |
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
