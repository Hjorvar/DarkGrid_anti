# DARKGRID ADVENTURE LAB — PHASE 2.5: ARCHITECTURE AUDIT

**Date**: 2026-10-21  
**Worktree**: `darkgrid_overnight_development`  
**Scope**: `action-ui-lab/` (Strictly isolated from main game & production)

---

## 1. Verified File Sizes (Pre-Refactor Baseline)

The prompt estimated ~4,000 lines of CSS, ~3,700 lines of Frontend JS, and ~500 lines of HTML. Direct inspection of `action-ui-lab/` confirms the exact baseline metrics:

| Rank | File Path | Total Lines | Non-Empty Lines | Size (Bytes) | Category |
|---:|---|---:|---:|---:|---|
| 1 | `monster-asset-manifest.json` | 13,815 | 13,815 | 407,157 | Static Asset Manifest (JSON) |
| 2 | `monster-size-catalog.js` | 10,242 | 10,162 | 332,293 | Shared UMD/CJS Catalog & PF1e Scaling Math |
| 3 | `monster-artwork-inventory.json` | 6,300 | 6,300 | 208,583 | Static Artwork Inventory (JSON) |
| 4 | `scene-catalog.js` | 4,636 | 4,380 | 186,788 | Backend POV Scene Resolver & World Visual Atlas |
| 5 | `public/action-ui.css` | **4,443** | **3,918** | **113,531** | **Frontend Monolithic Stylesheet** |
| 6 | `public/action-ui.js` | **4,256** | **3,893** | **200,637** | **Frontend Monolithic Client Script** |
| 7 | `server.js` | **2,809** | **2,604** | **117,047** | **Backend Express Server, Routes, Services & DB** |
| 8 | `adventure-engine.js` | 2,303 | 2,089 | 105,681 | Backend Adventure, Discoveries, Pacing & Expeditions |
| 9 | `travel-continuity.js` | 1,969 | 1,769 | 88,117 | Backend Directional Continuity & Revisit State |
| 10 | `tests/action-lab.test.js` | 1,467 | 1,288 | 66,770 | Core Sandbox Verification Suite (32 tests) |
| 11 | `tests/independent-qa.test.js` | 1,099 | 964 | 46,964 | Independent E2E & Headless Chrome QA Suite |
| 12 | `tests/visual-regression.js` | 811 | 715 | 33,221 | Automated Visual Regression Runner |
| 13 | `tests/world-travel.test.js` | 801 | 688 | 36,994 | World Travel & Pacing Suite (16 tests) |
| 14 | `public/index.html` | **550** | **497** | **33,370** | **Frontend Single-Page Application Shell** |
| 15 | `tests/player-ui.test.js` | 234 | 198 | 10,805 | Player Experience & UI Suite (11 tests) |

---

## 2. Responsibility Analysis of Core Files

### 2.1 `public/action-ui.css` (4,443 lines)
Currently holds every visual rule for the entire application in a single file:
- **Lines 1–69**: `:root` CSS custom properties, box-sizing reset, zero-scroll `100dvh` document lock.
- **Lines 70–193 & 4023–4107**: Top `.lab-director-bar`, collapsible `.lab-devtools-drawer`, `.lab-mode-indicator`, and `.dev-mode-collapsed` progressive disclosure rules.
- **Lines 194–498 & 4108–4246**: Top Champion Deck (`.dm-top-deck`, `.dm-hero-identity`, `.dm-hands-and-bars`, `.dm-hand-slot`, `.dm-equip-quick-actions`, `.dm-vertical-pillars`, `.dm-vitals-readout`, `.dm-stat-badges`).
- **Lines 499–510 & 1705–1753**: Main 2-column Dungeon Master layout (`.dm-shell`, `.dm-main-grid`, `.dm-right-deck`, `.dm-deck-card`).
- **Lines 511–1063, 1754–1903, 2000–2163, 2315–2553, 3049–3424, 4259–4263, 4400–4443**: First-person world viewport (`.fp-viewport-frame`, `.fp-scene-backdrop`, `.fp-terrain-img`, crossfade and movement animations, `.fp-top-hud`, `.fp-vista-bar`, `.dm-minimap-grid`, `.dm-compass-widget`, `.dm-movement-deck`, living environment particles/mist, POI plaques, expedition pills, tension ribbons, discovery cards, revisit pills).
- **Lines 851–882, 1064–1630, 1904–1996, 2554–2571, 3022–3048, 3606–4022, 4247–4258, 4338–4372**: Combat stage & actor presentation (`.fp-center-stage`, Stage 1 `.fp-inscene-threat`, Stage 2 `.fp-monster-actor`, Card/Integrated/Blend/Framed modes, grounding shadows, combat recoil/lunge/slash animations, `.fp-monster-hud-plate`, `.dm-action-columns`, `.fp-combat-tactical-strip`, PF1e adaptive scaling, and `.fp-size-comparison-arena`).
- **Lines 2280–2289**: Inventory & item row presentation (`.lab-item-row`).
- **Lines 1631–1704, 2164–2279, 2572–2933, 3425–3605, 4264–4337**: Shared UI components (`.fp-bottom-chronicle`, `.btn-action-gold`, `.btn-action-stone`, `.floating-pop`, `.lab-modal-backdrop`, `.lab-modal-card`, Atlas/QA/Journal/Director/Help modal styles).
- **Lines 812–827, 2290–2313, 2934–3004, 3610–3625, 4199–4203, 4373–4399**: Responsive `@media` queries, accessibility `:focus-visible`, and `prefers-reduced-motion`.

### 2.2 `public/action-ui.js` (4,256 lines)
A single browser script loaded via `<script src="/lab-assets/action-ui.js">` that mixes 8 distinct domains in one shared global scope:
1. **Client State & Mode Flags** (lines 12–66): `currentState`, `activeModal`, `isSequencePlaying`, `lastPlayedEventId`, `lastSceneIdentityKey`, `monsterPresenceMode`, `monsterScaleMode`, `sizeComparisonLabOpen`, `devToolsExpanded`, `chronicleExpanded`, `chronicleHistoryBuffer`, `FACING_META`.
2. **UI Text Sanitization & Mode Sync** (lines 68–260): `sanitizePlayerContinuityText`, `buildRevisitBadgeHtml`, `toggleDevToolsDrawer`, `toggleChronicleHistory`, `recordChronicleHistoryLine`, `syncUiModeClasses`.
3. **API Communication & Action Dispatchers** (lines 262–485): `fetchInitialState`, `dispatchAction`, `setAdventureExperienceMode`, `startExpeditionRoute`, `resetExpeditionRoute`, `resolveDiscoveryChoiceClick`, `dismissActiveDiscovery`, `forceTriggerDiscovery`, `setDeterministicSeed`, `setSceneMode`, `setMonsterPresenceMode`, `setMonsterScaleMode`, `toggleMonsterSizeComparisonLab`, `setAtmosphericEffectsMode`, `triggerInspectPoi`, `closePoiPlaque`, `dispatchTurn`, `dispatchRelativeMove`, `dispatchMove`, `triggerLabScenario`, `triggerClassSwitch`.
4. **Atmospheric Canvas Particle Engine** (lines 511–692): `AtmosphericParticleEngine` class and singleton lifecycle.
5. **World Viewport, Crossfade, Legacy SVG, Minimap & Navigation Pad** (lines 715–1550, 2199–2560): `renderViewport`, `applySceneImageWithCrossfade`, `renderFirstPersonSvg`, `renderMinimap`, `renderCompassAndPad`, `playMovementTransitionFx`.
6. **Character HUD, Hands & Vitals** (lines 694–713, 1897–2079, 2562–2611): `renderHeroHeader`, `renderHands`, `handleMainHandClick`, `handleOffHandClick`, `describeVitalityBand`.
7. **Combat Presentation, Sequencer, FX & Size Comparison Arena** (lines 1552–1896, 2081–2198, 2613–3054): `renderViewportOverlays`, `renderMonsterCombatPlate`, `renderActionSlots`, `handleSlot1Click`..`handleSlot4Click`, `playCombatSequence`, `applyBeatVisuals`, `spawnFloatingPop`, `triggerScreenFlash`, `triggerSlashFx`, `renderMonsterSizeComparisonArena`.
8. **Modals, Inventory, Market, Bounties, Atlas, Visual QA, Journal, Director & Keyboard Shortcuts** (lines 3055–4256): `openLabModal`, `closeLabModal`, `renderModalContent`, `renderCharacterModal`, `renderInventoryModal`, `renderMarketModal`, `renderBountiesModal`, `renderJournalModal`, `renderDirectorModal`, `renderHelpModal`, `renderAtlasModal`, `renderVisualQaModal`, `setupKeyboardShortcuts`.

### 2.3 `server.js` (2,809 lines)
Uses **Express** (`express()`). Currently combines HTTP server setup, static middleware, database seeding, domain services, state serialization, and a 1,045-line `POST /api/action` switch/if-else block in one file:
- **Static Asset Serving**:
  - `/images` -> `path.join(__dirname, '../public/images')` (read-only access to main game art)
  - `/lab-assets` -> `path.join(__dirname, 'public')` with `Cache-Control: no-store`
  - `/vendor/monster-size-catalog.js` -> serves `monster-size-catalog.js`
- **API Routes**:
  - `GET /` — Serves `public/index.html` with `Cache-Control: no-store`
  - `GET /api/state` — Returns full `buildClientState(db)`
  - `GET /api/atlas` — Returns `buildWorldVisualAtlas(db)`
  - `GET /api/visual-qa` — Returns QA audit summary across atlas, cutouts, POIs, and atmosphere profiles
  - `GET /api/monster-manifest` — Returns `monster-asset-manifest.json`
  - `GET /api/monster-scaling` — Computes PF1e monster scaling catalog & comparison presets for a given viewport size
  - `POST /api/action` — Handles 30+ action types (`TURN`, `MOVE`, `INSPECT_POI`, `SET_SCENE_MODE`, `SET_ATMO_MODE`, `TELEPORT_TO_TILE`, `SET_ADVENTURE_MODE`, `START_EXPEDITION`, `RESET_EXPEDITION`, `DISMISS_DISCOVERY`, `FORCE_DISCOVERY`, `RESOLVE_DISCOVERY_CHOICE`, `SET_ADVENTURE_SEED`, `INVESTIGATE`, `IGNORE`, `CONTINUE_EXPLORING`, `ATTACK`, `POTION`, `FLEE`, `REST`, `STANCE`, `EQUIP`, `UNEQUIP`, `BUY`, `SELL`, `ACCEPT_BOUNTY`, `CLAIM_BOUNTY`, `REVIVE`, `LAB_SCENARIO`).
- **Database Access**:
  - Uses Node's built-in `node:sqlite` (`DatabaseSync`) copied into `action-ui-lab/data/action_lab.sqlite` (or `:memory:` in tests), plus lab-specific schema migrations (`characters.facing`, `characters.scene_mode`, `characters.atmo_mode`, `lab_scene_variants`, `lab_directional_overrides`, `lab_adventure_state`, `lab_travel_continuity`).

### 2.4 `scene-catalog.js` (4,636 lines), `adventure-engine.js` (2,303 lines), `travel-continuity.js` (1,969 lines), `monster-size-catalog.js` (10,242 lines)
- These four backend/shared domain modules are already separated from `server.js` by domain (Scene Catalog, Adventure Engine, Travel Continuity, Monster Size Catalog) and expose clean CommonJS exports consumed by `server.js` and directly by unit tests (`world-travel.test.js`, `monster-scaling.test.js`).

---

## 3. Where Responsibilities Are Mixed & Unnecessary Coupling Exists

1. **`public/action-ui.js` Global State & Inline DOM Coupling**:
   - Every UI subsystem directly mutates module-global variables (`currentState`, `activeModal`, `isSequencePlaying`) and calls functions across domains without explicit imports.
   - `public/index.html` and dynamic `innerHTML` templates rely on 35+ inline `onclick="..."` handlers that expect functions to exist on `window`.
2. **`public/action-ui.css` Monolithic Maintenance Bottleneck**:
   - At 4,443 lines, world viewport rules, combat cutout rigs, top champion deck styles, modal dialogs, and media queries are interleaved across historical phases (Phase 1, Phase 3, Phase 4, Track 2, Phase 2).
3. **`server.js` Monolithic Route & Service Mixing**:
   - `server.js` embeds the 37-monster integrated cutout profile table (`INTEGRATED_MONSTER_PROFILES`), cardinal facing math, SQLite sandbox initialization, viewport scene assembly, combat sequence beat builder, full client state serializer, and the 1,045-line `POST /api/action` controller in a single file.

---

## 4. Safe Module Boundaries vs. Change-Sensitive Invariants

### 4.1 Safe to Separate
- **CSS**: Splitting `public/action-ui.css` into 8 logical stylesheets (`base.css`, `layout.css`, `character.css`, `world.css`, `combat.css`, `inventory.css`, `components.css`, `responsive.css`) loaded in deterministic order in `public/index.html`.
- **Frontend JS**: Splitting `public/action-ui.js` into ES6 modules under `public/js/` (`state/`, `api/`, `world/`, `combat/`, `character/`, `inventory/`, `ui/`, and `app.js`).
- **Backend (`server.js`)**: Extracting cohesive modules into `action-ui-lab/server/` (`services/facing-service.js`, `services/monster-profile-service.js`, `services/sandbox-db-service.js`, `services/viewport-scene-service.js`, `services/combat-sequence-service.js`, `services/client-state-service.js`, `controllers/state-controller.js`, `controllers/action-controller.js`, `routes/api-routes.js`, `middleware/static-assets.js`) while keeping `action-ui-lab/server.js` as the application factory & export barrel.

### 4.2 Change-Sensitive Invariants (Must Be Preserved)
1. **Inline HTML `onclick` & Headless Chrome CDP (`evalInPage`) Globals**:
   - Because ES Modules (`<script type="module">`) do not automatically place top-level declarations onto `window`, `app.js` must explicitly bind all inline handler functions to `window` and define `window.currentState` and `window.isSequencePlaying` getters/setters backed by the state store so both inline `onclick` attributes and `tests/independent-qa.test.js` / `tests/visual-regression.js` `evalInPage` expressions work identically.
2. **Legacy Asset Endpoint & Test Compatibility**:
   - `tests/action-lab.test.js` (Test #11) fetches `/lab-assets/action-ui.css` and `/lab-assets/action-ui.js` and asserts `200 OK` + `Cache-Control: no-store`. Our static middleware in `server/middleware/static-assets.js` will serve the concatenated modular CSS/JS at those compatibility URLs so Test #11 passes seamlessly.
   - `tests/player-ui.test.js` inspects CSS/JS content for specific selectors and function signatures; we will ensure `player-ui.test.js` reads the modular CSS/JS files cleanly.
3. **`server.js` CommonJS Exports**:
   - All existing exports (`createLabApp`, `FACING_ORDER`, `FACING_VECTORS`, `normalizeFacing`, `rotateFacing`, `getRelativeCardinalMap`, `computeTileFacingSeed`, plus re-exports from `scene-catalog`, `adventure-engine`, and `monster-size-catalog`) must remain exported by `action-ui-lab/server.js`.
