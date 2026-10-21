# DARKGRID ADVENTURE LAB — PHASE 2.5: MODULE STRUCTURE & DEPENDENCY GUIDE

**Date:** 2026-10-21  
**Worktree:** `darkgrid_overnight_development`  
**Directory:** `action-ui-lab/`

---

## 1. Complete File Tree (`action-ui-lab/`)

```text
action-ui-lab/
│
├── server.js                                     # 115 lines — Express app factory & backward-compatible CommonJS barrel
├── scene-catalog.js                              # 1,738 lines — World scene catalog, POV rules, POI & atmosphere catalog
├── monster-size-catalog.js                       # 1,353 lines — PF1e 98-monster size & adaptive visual scaling catalog
├── adventure-engine.js                           # 1,244 lines — Exploration pacing, expeditions, discoveries & travel continuity
│
├── server/
│   ├── routes/
│   │   └── api-routes.js                         # 30 lines — Express Router for GET /api/* and POST /api/action
│   │
│   ├── middleware/
│   │   └── static-assets.js                      # 56 lines — Static assets (/lab-assets, /images) + virtual bundle endpoints
│   │
│   ├── controllers/
│   │   ├── state-controller.js                   # 208 lines — GET /, /api/state, /api/atlas, /api/visual-qa, /api/monster-*
│   │   ├── action-controller.js                  # 64 lines — POST /api/action orchestrator
│   │   ├── navigation-controller.js              # 346 lines — SET_SCENE_MODE, TURN, DISMISS_VICTORY, MOVE, INSPECT_POI, TELEPORT
│   │   ├── combat-controller.js                  # 237 lines — INVESTIGATE/ENGAGE, IGNORE/BYPASS, ATTACK, POTION, FLEE
│   │   ├── character-town-controller.js          # 133 lines — STANCE, REST, CLERIC_HEAL, EQUIP, UNEQUIP, BUY, SELL, BOUNTIES
│   │   └── adventure-scenario-controller.js      # 435 lines — Adventure mode, Expeditions, Discoveries & LAB_SCENARIO
│   │
│   └── services/
│       ├── facing-service.js                     # 90 lines — Cardinal vectors, relative movement & facing math
│       ├── monster-profile-service.js            # 332 lines — Integrated RGBA monster cutout & shadow grounding profiles
│       ├── sandbox-db-service.js                 # 169 lines — Sandbox SQLite initialization, schema & hero seeding
│       ├── viewport-scene-service.js             # 234 lines — Tile inspection & first-person viewportScene builder
│       ├── combat-sequence-service.js            # 314 lines — Multi-beat combatSequence builder & pre-round snapshots
│       └── client-state-service.js               # 408 lines — Secrecy-compliant buildClientState payload assembler
│
├── public/
│   ├── index.html                                # 541 lines — Single-page application HTML shell
│   │
│   ├── css/
│   │   ├── base.css                              # 114 lines — CSS variables (:root), reset, base typography, reduced motion
│   │   ├── layout.css                            # 280 lines — 100dvh shell, header bar, progressive disclosure, mode classes
│   │   ├── character.css                         # 448 lines — Top Champion Deck, hand slots, quick stance/pack, HP pill
│   │   ├── world.css                             # 1,499 lines — First-person stage, A/B crossfade, atmosphere, compass, minimap
│   │   ├── combat.css                            # 1,198 lines — Stage 1 mystery overlay, Stage 2 combat HUD, cutouts & shadows
│   │   ├── inventory.css                         # 17 lines — Backpack grid & item rows
│   │   ├── components.css                        # 822 lines — Tactical Action Deck, Chronicle drawer, modals, Atlas, Fallen
│   │   └── responsive.css                        # 152 lines — Viewport breakpoints (1200px, 960px, height<=820px)
│   │
│   ├── js/
│   │   ├── app.js                                # 279 lines — Single ES6 entrypoint, master render() & init()
│   │   ├── state/
│   │   │   └── store.js                          # 76 lines — Central store, FACING_META, uiCallbacks & window state proxies
│   │   ├── api/
│   │   │   └── client.js                         # 227 lines — fetchState(), dispatchAction(), Director & Adventure API helpers
│   │   ├── world/
│   │   │   ├── atmosphere.js                     # 187 lines — Fog, rain, spore, ember & shadow-pulse particle engine
│   │   │   ├── legacy-svg.js                     # 250 lines — Legacy SVG peripheral corridor walls & obstacle overlays
│   │   │   ├── scene-renderer.js                 # 579 lines — First-person A/B crossfade, POI badge, travel continuity HUD
│   │   │   ├── minimap.js                        # 79 lines — 5×5 tactical minimap & player facing arrow renderer
│   │   │   └── navigation.js                     # 180 lines — Compass pill, 6-button movement pad & turn/step handlers
│   │   ├── combat/
│   │   │   ├── fx.js                             # 199 lines — Floating combat text, hit flash, lunge, shake & fxCue handler
│   │   │   ├── size-arena.js                     # 296 lines — Pathfinder 1e Monster Size & Cutout Comparison Arena
│   │   │   ├── combat-ui.js                      # 385 lines — Stage 1/2 encounter HUD, monster cutout/card & 3-slot Action Deck
│   │   │   └── sequence.js                       # 190 lines — Multi-beat combat round playback (HERO -> MONSTER -> OUTCOME)
│   │   ├── character/
│   │   │   └── character-ui.js                   # 272 lines — Top Champion Deck, vitals, equipment paperdoll & Hero Sheet
│   │   ├── inventory/
│   │   │   └── inventory-ui.js                   # 69 lines — Backpack inventory renderer & item action bindings
│   │   └── ui/
│   │       ├── utils.js                          # 91 lines — escapeHtml, setText, formatTerrain, getTierBadgeClass
│   │       ├── hud.js                            # 89 lines — Mode-reactive body classes, Player/Dev toggle & Quest Tracker pill
│   │       ├── chronicle.js                      # 164 lines — Compact & expandable bottom Chronicle drawer ([H])
│   │       ├── adventure-overlays.js             # 211 lines — Tension banner, Discovery choice modal, Expedition drawer & Fallen
│   │       ├── modals.js                         # 650 lines — Modal open/close, Market, Bounties, Tavern & World Visual Atlas
│   │       └── shortcuts.js                      # 176 lines — Keyboard shortcut listener (WASD/Arrows/Q/E/Space/1-3/C/I/M/B/J/H/?)
│   │
│   └── images/                                   # World POV paintings & RGBA monster cutouts
│
├── tests/                                        # 7 automated test suites (96 tests total)
└── docs/
    └── implementation/
        └── phase-2.5/                            # Phase 2.5 architecture & verification deliverables
```

---

## 2. Frontend ES6 Module Responsibilities & Dependency Graph (`public/js/`)

All frontend modules use standard ES6 `import` and `export` with zero circular dependencies:

1. **`state/store.js`** (Leaf foundation module — imports nothing):
   - Exports `store` (reactive state container), `FACING_META`, `uiCallbacks` (dependency-inversion callback registry), and `bindWindowStateProxies()`.
2. **`ui/utils.js`** (Leaf utility module — imports `store`):
   - Pure DOM/text helpers (`escapeHtml`, `setText`, `formatTerrain`, `getTierBadgeClass`, `showToast`, `clearToast`).
3. **`api/client.js`** (Imports `store`, `utils`, `fx`, `sequence`, `adventure-overlays`):
   - Centralizes all `fetch('/api/state')` and `fetch('/api/action')` communication, coordinates combat sequence playback vs. immediate state rendering, and exposes Director/Adventure action helpers.
4. **`world/*`** (`atmosphere.js`, `legacy-svg.js`, `scene-renderer.js`, `minimap.js`, `navigation.js`):
   - Encapsulates all first-person viewport rendering, A/B crossfade transitions, atmospheric particles, POI inspection badges, 5×5 minimap, compass, and relative movement/rotation controls.
5. **`combat/*`** (`fx.js`, `size-arena.js`, `combat-ui.js`, `sequence.js`):
   - Encapsulates Stage 1 mystery overlays, Stage 2 monster presentation (integrated RGBA cutouts + anatomical contact shadows + card fallback), the 3-slot Tactical Action Deck, sequential round beat playback, and the PF1e Size Comparison Arena.
6. **`character/character-ui.js`** & **`inventory/inventory-ui.js`**:
   - Encapsulates Top Champion Deck vitals, hand slots, quick stance/potion buttons, full Hero Sheet attributes, paperdoll equipment slots, and backpack item management.
7. **`ui/*`** (`hud.js`, `chronicle.js`, `adventure-overlays.js`, `modals.js`, `shortcuts.js`):
   - Encapsulates Player/Dev progressive disclosure, Quest Tracker pill, bottom Chronicle drawer, Adventure Discovery/Tension/Expedition overlays, town modals (Market, Bounties, Tavern, World Visual Atlas), and conflict-free keyboard shortcuts.
8. **`app.js`** (Single application entrypoint):
   - Wires `uiCallbacks`, defines the master `render()` pipeline, exposes backward-compatible `window.*` hooks for automated tests and inline modal controls, registers event listeners, and boots the application.

---

## 3. Backend Module Responsibilities (`server/`)

- **`server/services/facing-service.js`**: Pure directional math (`FACING_ORDER`, `FACING_VECTORS`, `normalizeFacing`, `rotateFacing`, `getRelativeCardinalMap`, `getMoveKindFromCardinal`, `computeTileFacingSeed`, `bracketNumToKey`).
- **`server/services/monster-profile-service.js`**: Resolves integrated RGBA monster cutouts, grounding modes, anatomical contact shadows, and `renderContract` metadata.
- **`server/services/sandbox-db-service.js`**: Manages isolated SQLite connection (`data/action_lab.sqlite`), Lab schema migrations, test corridor enrichments, and living hero creation.
- **`server/services/viewport-scene-service.js`**: Inspects current and neighboring tiles and constructs the `viewportScene` payload across Modes A, B, C, and Legacy.
- **`server/services/combat-sequence-service.js`**: Translates server-side `combat_events` into ordered client playback beats (`HERO` → `MONSTER` → `OUTCOME`) without exposing hidden monster stats.
- **`server/services/client-state-service.js`**: Assembles the complete, secrecy-compliant `state` object returned by `GET /api/state` and `POST /api/action`.
- **`server/controllers/*`**: Express route handlers separated by domain (`state-controller.js`, `action-controller.js`, `navigation-controller.js`, `combat-controller.js`, `character-town-controller.js`, `adventure-scenario-controller.js`).
- **`server/routes/api-routes.js`** & **`server/middleware/static-assets.js`**: Express routing table and static asset serving with `Cache-Control: no-store`.
