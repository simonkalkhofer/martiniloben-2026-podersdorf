# Martiniloben Podersdorf 2026 – Geheime Missionen

Mobile-first Web-App für ein geheimes Begleitspiel beim Martiniloben-Weinfest in Podersdorf am See.
React 19 + TypeScript + Tailwind CSS 4 + GSAP, Backend: Supabase (Postgres + Realtime).

## Schnellstart

```bash
npm install
npm run dev
```

Ohne `.env` läuft die App im **Demo-Modus**: alle Daten liegen im localStorage des Browsers,
der Admin-PIN von Simon steht auf der Login-Seite. Nur zum Ausprobieren, nicht fürs echte Spiel.

## Echtbetrieb mit Supabase

1. Auf [supabase.com](https://supabase.com) ein (kostenloses) Projekt anlegen.
2. Im **SQL Editor** nacheinander ausführen:
   1. `supabase/schema.sql` – Tabellen, Sicherheit, Spiellogik
   2. `supabase/seed.sql` – 10 Spieler (mit zufälligen PINs) und 90 Missionen
3. `.env.example` nach `.env` kopieren, `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`
   aus *Project Settings → API* eintragen.
4. `npm run build` → Ordner `dist/` auf einem statischen Hoster veröffentlichen
   (Netlify, Vercel, Cloudflare Pages, GitHub Pages …), Env-Variablen dort ebenfalls setzen.
5. Als **Simon** einloggen → Admin-Bereich → „PINs zeigen“ → PINs an die Gruppe verteilen.

Missionen ändern: `src/lib/missions.ts` bearbeiten, `node scripts/gen-seed.ts` ausführen,
`supabase/seed.sql` erneut im SQL Editor ausführen (Missionen werden aktualisiert, Spieler bleiben).

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

Alle Tabellen haben Row Level Security ohne Policies: Mit dem öffentlichen anon-Key kann niemand
PINs oder fremde Missionen direkt lesen. Alles läuft über `SECURITY DEFINER`-Funktionen mit
Session-Token. Nach 5 falschen PINs ist ein Spieler 5 Minuten gesperrt. Live-Updates laufen über
die Tabelle `app_state` (nur eine Versionsnummer) per Supabase Realtime, als Rückfall alle 20 s Polling.

## Struktur

```
src/
  lib/missions.ts      90 Missionen + Spielernamen (Quelle für seed.sql)
  lib/types.ts         Datentypen + Api-Schnittstelle
  lib/supabaseApi.ts   Supabase-RPC-Anbindung + Realtime
  lib/demoApi.ts       Demo-Modus (gleiche Logik im localStorage)
  pages/               Login, Home (Rangliste), Missionen, Bestätigungen, Admin
  components/          Hero (SVG-Leuchtturm), BottomNav, Modal, Toast
supabase/schema.sql    Schema, RLS, Spiellogik als RPCs
supabase/seed.sql      generiert von scripts/gen-seed.ts
graphify-out/          Wissensgraph des Codes (graphify), GRAPH_REPORT.md
```
