# Martiniloben Podersdorf 2026 – Geheime Missionen

Sprache: Deutsch. Details zu Betrieb, Regeln, API und Struktur: `README.md`.

## Stack
- Frontend: Vite 8 + React 19 + TypeScript + Tailwind CSS 4 (Theme-Tokens in `src/index.css`).
- Animationen ausschließlich mit GSAP + `@gsap/react` (`useGSAP` mit `scope`, `contextSafe` für Handler,
  `gsap.matchMedia` für reduced-motion). Skills: gsap-react, gsap-timeline, gsap-core.
- Backend: **eigener Server** in `server/` (bewusst kein Supabase/Firebase – Wunsch des Nutzers).
  Node ≥ 22.18 führt die `.ts`-Dateien direkt aus (Type-Stripping) → nur löschbare TS-Syntax
  (`erasableSyntaxOnly`), Importe mit `.ts`-Endung. Datenbank: `node:sqlite`, keine Zusatzpakete.
- Live-Updates: Server-Sent Events (`/api/events`), Rückfall-Polling im Client.

## Regeln für Änderungen
- Spiellogik nur in `server/game.ts`. Das Frontend rechnet nichts selbst.
- Missionen in `src/lib/missions.ts` ändern; der Server aktualisiert sie beim nächsten Start.
- Keine PINs ins Repo: `data/` ist ignoriert, PINs entstehen beim ersten Start zufällig.
- `vite` ist exakt auf 8.3.5 gepinnt (Windows Smart App Control blockierte die rolldown-Binärdatei einer neueren Version).
- Fixed-Elemente (Modals) per Portal rendern; GSAP-Übergänge auf Containern mit `clearProps` beenden.

## Prüfen
- `npm run build` (Typprüfung inkl. Server + Build).
- Dev: `npm run dev` bzw. `G:\Claude\.claude\launch.json` → `martiniloben-dev` (Vite 5180, API fest 8787).

## graphify
- Graph in `graphify-out/` (nur AST). Aktualisieren: graphify-Skill mit `--update`;
  CLI nur aus `G:\Claude\Tools\graphify-venv`.
