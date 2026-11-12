# Graph Report - Martiniloben-2026-Podersdorf  (2026-11-13)

## Corpus Check
- Corpus is ~13,398 words - fits in a single context window. You may not need a graph.

## Summary
- 157 nodes · 337 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Build-Werkzeuge (devDeps)
- Demo-Modus (localStorage)
- API-Auswahl & Supabase-RPC
- API-Vertrag (Methoden)
- TypeScript-Konfiguration
- GSAP-animierte UI-Bausteine
- Spiel-Datentypen
- Seiten-Aktionen & Fehlertexte
- Missionsdaten & Seed
- App-Shell & Tab-Navigation
- Admin- & Missionsseite
- Laufzeit-Abhängigkeiten
- Toasts & Bestätigungen

## God Nodes (most connected - your core abstractions)
1. `Api` - 17 edges
2. `errorText()` - 16 edges
3. `@gsap/react` - 13 edges
4. `gsap` - 13 edges
5. `react` - 13 edges
6. `Shell()` - 12 edges
7. `compilerOptions` - 11 edges
8. `useToast()` - 9 edges
9. `Level` - 8 edges
10. `Admin()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `ToastProvider()`  [EXTRACTED]
  src/App.tsx → src/components/Toast.tsx
- `Shell()` --calls--> `useToast()`  [EXTRACTED]
  src/App.tsx → src/components/Toast.tsx
- `Shell()` --calls--> `errorText()`  [EXTRACTED]
  src/App.tsx → src/lib/api.ts
- `Shell()` --calls--> `Admin()`  [EXTRACTED]
  src/App.tsx → src/pages/Admin.tsx
- `Shell()` --calls--> `Confirmations()`  [EXTRACTED]
  src/App.tsx → src/pages/Confirmations.tsx

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "Build-Werkzeuge (devDeps)"
Cohesion: 0.11
Nodes (23): devDependencies, tailwindcss@^4.3.5, @tailwindcss/vite@^4.3.5, @types/react@^19.3.0, @types/react-dom@^19.3.0, typescript@^7.0.2, vite@8.3.5, @vitejs/plugin-react@^6.3.0 (+15 more)

### Community 1 - "Demo-Modus (localStorage)"
Cohesion: 0.15
Nodes (14): Db, DbAssignment, DbPlayer, demoAdminPin(), draws(), listeners, load(), randomPin() (+6 more)

### Community 2 - "API-Auswahl & Supabase-RPC"
Cohesion: 0.19
Nodes (11): @supabase/supabase-js, key, LEVELS, url, admin(), createDemoApi(), me(), createSupabaseApi() (+3 more)

### Community 4 - "TypeScript-Konfiguration"
Cohesion: 0.15
Nodes (12): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+4 more)

### Community 5 - "GSAP-animierte UI-Bausteine"
Cohesion: 0.36
Nodes (6): gsap, @gsap/react, react, Hero(), Home(), MEDALS

### Community 6 - "Spiel-Datentypen"
Cohesion: 0.24
Nodes (10): Level, AdminAssignment, AdminPlayer, Card, Confirmation, Draws, GameState, LeaderRow (+2 more)

### Community 7 - "Seiten-Aktionen & Fehlertexte"
Cohesion: 0.33
Nodes (10): Modal(), errorText(), Admin(), addPlayer(), run(), Login(), submit(), Missions() (+2 more)

### Community 8 - "Missionsdaten & Seed"
Cohesion: 0.28
Nodes (5): lines, MISSIONS, MissionSeed, PLAYER_NAMES, raw

### Community 9 - "App-Shell & Tab-Navigation"
Cohesion: 0.39
Nodes (7): App(), readSession(), Shell(), TabView(), BottomNav(), Tab, TABS

### Community 10 - "Admin- & Missionsseite"
Cohesion: 0.29
Nodes (6): PageProps, api, AdminOverview, Filter, STATUS_LABEL, LEVEL_STYLE

### Community 11 - "Laufzeit-Abhängigkeiten"
Cohesion: 0.29
Nodes (7): dependencies, gsap@^3.15.1, @gsap/react@^2.1.2, react@^19.3.1, react-dom@^19.3.1, @supabase/supabase-js@^2.119.0, react-dom

### Community 12 - "Toasts & Bestätigungen"
Cohesion: 0.43
Nodes (5): ToastCtx, ToastProvider(), ToastView(), useToast(), Confirmations()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `API-Vertrag (Methoden)` to `Demo-Modus (localStorage)`, `API-Auswahl & Supabase-RPC`, `Spiel-Datentypen`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._
- **Should `Build-Werkzeuge (devDeps)` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Why does `@gsap/react` connect `GSAP-animierte UI-Bausteine` to `Build-Werkzeuge (devDeps)`, `App-Shell & Tab-Navigation`, `Admin- & Missionsseite`, `Laufzeit-Abhängigkeiten`, `Toasts & Bestätigungen`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `gsap` connect `GSAP-animierte UI-Bausteine` to `Build-Werkzeuge (devDeps)`, `App-Shell & Tab-Navigation`, `Admin- & Missionsseite`, `Laufzeit-Abhängigkeiten`, `Toasts & Bestätigungen`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._