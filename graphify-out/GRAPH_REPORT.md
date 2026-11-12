# Graph Report - Martiniloben-2026-Podersdorf  (2026-11-13)

## Corpus Check
- Corpus is ~10,882 words - fits in a single context window. You may not need a graph.

## Summary
- 181 nodes · 366 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Server-Datenbank (SQLite)
- Paket-Abhängigkeiten
- Spiellogik & Datentypen
- HTTP-API-Client
- TypeScript-Konfiguration
- App-Shell & Tab-Navigation
- GSAP-animierte UI-Bausteine
- Seiten & API-Einstieg
- Seiten-Aktionen & Fehlertexte
- Dev-Startskript
- Toasts

## God Nodes (most connected - your core abstractions)
1. `errorText()` - 16 edges
2. `Api` - 16 edges
3. `@gsap/react` - 13 edges
4. `gsap` - 13 edges
5. `react` - 13 edges
6. `compilerOptions` - 13 edges
7. `Shell()` - 12 edges
8. `useToast()` - 9 edges
9. `Level` - 9 edges
10. `createGame()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `CardRow` --references--> `Level`  [EXTRACTED]
  server/game.ts → src/lib/missions.ts
- `CardRow` --references--> `CardKind`  [EXTRACTED]
  server/game.ts → src/lib/types.ts
- `CardRow` --references--> `CardStatus`  [EXTRACTED]
  server/game.ts → src/lib/types.ts
- `CardRow` --references--> `FailReason`  [EXTRACTED]
  server/game.ts → src/lib/types.ts
- `App()` --calls--> `ToastProvider()`  [EXTRACTED]
  src/App.tsx → src/components/Toast.tsx

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "Server-Datenbank (SQLite)"
Cohesion: 0.07
Nodes (27): openDb(), randomPin(), createGame(), admin(), draws(), me(), toCard(), GameError (+19 more)

### Community 1 - "Paket-Abhängigkeiten"
Cohesion: 0.07
Nodes (34): dependencies, gsap@^3.15.1, @gsap/react@^2.1.2, react@^19.3.1, react-dom@^19.3.1, devDependencies, tailwindcss@^4.3.5, @tailwindcss/vite@^4.3.5 (+26 more)

### Community 2 - "Spiellogik & Datentypen"
Cohesion: 0.19
Nodes (18): CardRow, Game, PlayerRow, Level, AdminAssignment, AdminOverview, AdminPlayer, Card (+10 more)

### Community 3 - "HTTP-API-Client"
Cohesion: 0.12
Nodes (4): createHttpApi(), call(), Api, GameError

### Community 4 - "TypeScript-Konfiguration"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, isolatedModules, jsx, lib, module, moduleResolution (+6 more)

### Community 5 - "App-Shell & Tab-Navigation"
Cohesion: 0.28
Nodes (9): App(), readSession(), Shell(), TabView(), BottomNav(), Tab, TABS, useToast() (+1 more)

### Community 6 - "GSAP-animierte UI-Bausteine"
Cohesion: 0.44
Nodes (6): gsap, @gsap/react, react, Hero(), Home(), MEDALS

### Community 7 - "Seiten & API-Einstieg"
Cohesion: 0.38
Nodes (6): PageProps, api, LEVELS, Filter, STATUS_LABEL, LEVEL_STYLE

### Community 8 - "Seiten-Aktionen & Fehlertexte"
Cohesion: 0.33
Nodes (10): Modal(), errorText(), Admin(), addPlayer(), run(), Login(), submit(), Missions() (+2 more)

### Community 10 - "Toasts"
Cohesion: 0.67
Nodes (3): ToastCtx, ToastProvider(), ToastView()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `HTTP-API-Client` to `Spiellogik & Datentypen`, `Seiten & API-Einstieg`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Should `Server-Datenbank (SQLite)` be split into smaller, more focused modules?**
  _Cohesion score 0.06794871794871794 - nodes in this community are weakly interconnected._
- **Why does `@gsap/react` connect `GSAP-animierte UI-Bausteine` to `Paket-Abhängigkeiten`, `Toasts`, `App-Shell & Tab-Navigation`, `Seiten & API-Einstieg`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `Paket-Abhängigkeiten` be split into smaller, more focused modules?**
  _Cohesion score 0.07301587301587302 - nodes in this community are weakly interconnected._
- **Why does `gsap` connect `GSAP-animierte UI-Bausteine` to `Paket-Abhängigkeiten`, `Toasts`, `App-Shell & Tab-Navigation`, `Seiten & API-Einstieg`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `HTTP-API-Client` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `TypeScript-Konfiguration` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._