# Martiniloben Podersdorf 2026 – Geheime Missionen

Sprache: Deutsch. Details zu Setup, Regeln und Struktur: `README.md`.

## Stack
- Vite 8 + React 19 + TypeScript + Tailwind CSS 4 (`@tailwindcss/vite`, Theme-Tokens in `src/index.css`).
- Animationen ausschließlich mit GSAP + `@gsap/react` (`useGSAP` mit `scope`, `contextSafe` für Handler,
  `gsap.matchMedia` für reduced-motion). Skills: gsap-react, gsap-timeline, gsap-core.
- Backend: Supabase. Gesamte Spiellogik in `supabase/schema.sql` (RPCs). `src/lib/demoApi.ts` spiegelt
  dieselbe Logik für den Demo-Modus – **Regeländerungen immer in beiden Dateien machen.**

## Regeln für Änderungen
- Missionen nur in `src/lib/missions.ts` ändern, dann `node scripts/gen-seed.ts` (erzeugt `supabase/seed.sql`).
- Keine PINs ins Repo schreiben – sie werden beim Seed zufällig erzeugt.
- `vite` ist bewusst exakt auf 8.3.5 gepinnt (Windows Smart App Control blockierte die native
  rolldown-Binärdatei einer neueren Version).
- Fixed-Elemente (Modals) per Portal rendern; GSAP-Übergänge auf Containern mit `clearProps` beenden.

## Prüfen
- `npm run build` (Typprüfung + Build).
- SQL-Logik wurde mit PGlite getestet (Rollen `anon`/`authenticated` und Publication `supabase_realtime` vorher anlegen).
- Dev-Server: `G:\Claude\.claude\launch.json` → `martiniloben-dev` (Port 5180).

## graphify
- Graph in `graphify-out/` (nur AST, SQL wird mangels `tree_sitter_sql` nicht erfasst).
- Aktualisieren: graphify-Skill mit `--update`; CLI nur aus `G:\Claude\Tools\graphify-venv`.
