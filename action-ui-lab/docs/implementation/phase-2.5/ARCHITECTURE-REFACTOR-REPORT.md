# DARKGRID ADVENTURE LAB — PHASE 2.5: ARCHITECTURE REFACTOR REPORT

**Date:** 2026-10-21  
**Worktree:** `darkgrid_overnight_development`  
**Scope:** Strictly confined to `action-ui-lab/` (Zero changes to `main`, `src/`, `db/`, Firebase, or game rules)

---

## 1. Executive Summary

Phase 2.5 refactored the Darkgrid Adventure Lab from three monolithic files (`public/action-ui.css` at 4,443 lines, `public/action-ui.js` at 4,256 lines, and `server.js` at 2,809 lines) into a modular, single-responsibility architecture across CSS, Frontend ES6 Modules, and Express Backend Services/Controllers/Routes/Middleware.

All refactoring was executed incrementally (Step A Baseline → Step B CSS → Step C Frontend JS → Step D Backend → Step E HTML Evaluation → Step F Full Regression) with zero changes to gameplay rules, visual presentation, API contracts, keyboard shortcuts, or encounter secrecy.

---

## 2. Before vs. After File Size Comparison

| Layer | Before Phase 2.5 (Monolithic) | After Phase 2.5 (Modular) | Reduction in Largest File |
| :--- | :--- | :--- | :--- |
| **CSS (`public/css/`)** | `public/action-ui.css` (**4,443 lines**, 109.9 KB) | **8 stylesheets** in `public/css/` (largest: `world.css` at **1,499 lines**; average: **566 lines**) | **-66.3%** max file size |
| **Frontend JS (`public/js/`)** | `public/action-ui.js` (**4,256 lines**, 182.0 KB) | **20 ES6 modules** in `public/js/` (entrypoint `app.js` at **279 lines**; largest: `modals.js` at **650 lines**; average: **222 lines**) | **-84.7%** max file size |
| **Backend (`server.js` + `server/`)** | `server.js` (**2,809 lines**, 107.6 KB) | `server.js` (**115 lines**) + **14 backend modules** in `server/` (largest: `adventure-scenario-controller.js` at **435 lines**; average: **211 lines**) | **-84.5%** max file size |
| **HTML (`public/index.html`)** | `public/index.html` (**534 lines**, 32.0 KB) | `public/index.html` (**541 lines**, updated `<link>` cascade and `<script type="module" src="/lab-assets/js/app.js">`) | Retained clean static shell |

---

## 3. Step-by-Step Refactoring Execution

### Step B — CSS Architecture (`public/css/`)
- Decomposed `public/action-ui.css` (4,443 lines) into 8 responsibility-scoped stylesheets loaded in deterministic cascade order in `public/index.html`:
  1. `base.css` (114 lines) — CSS custom properties (`:root`), reset, base typography, Reduced Motion accessibility overrides.
  2. `layout.css` (280 lines) — 100dvh zero-scroll shell, top HUD bar, main grid, progressive disclosure (`player-mode` vs `dev-mode`), mode-reactive classes.
  3. `character.css` (448 lines) — Top Champion Deck, hero identity sheet trigger, hand state tags, quick stance/pack controls, HP state pill.
  4. `world.css` (1,499 lines) — First-person adventure stage, multi-plane viewport, A/B crossfade scene buffer, atmospheric effect layers, POI inspect badges, compass & 5×5 minimap, navigation pad, exploration discovery/tension cards.
  5. `combat.css` (1,198 lines) — Stage 1 encounter mystery overlay, Stage 2 combat HUD, monster portrait card, integrated RGBA monster cutout stage, anatomical contact shadows, airborne hover animations, PF1e size comparison arena.
  6. `inventory.css` (17 lines) — Backpack inventory grid, item cards, and equip/unequip/sell action rows.
  7. `components.css` (822 lines) — Tactical Action Deck (3-slot layout), bottom Chronicle drawer, modal system, World Visual Atlas modal, Lab Director bar, Fallen screen.
  8. `responsive.css` (152 lines) — Media queries (`max-width: 1200px`, `max-width: 960px`, `max-height: 820px`) and viewport clamp adaptations.
- Preserved 100% of selectors, specificity, variables, keyframes, z-index layers, and media query behavior.

### Step C — Frontend JavaScript ES6 Modules (`public/js/`)
- Replaced the 4,256-line IIFE script (`public/action-ui.js`) with 20 native ES6 modules (`import` / `export`) orchestrated by `public/js/app.js`.
- Eliminated implicit shared closure globals by introducing `public/js/state/store.js`, which encapsulates `store` state, `FACING_META`, `uiCallbacks` (dependency-inversion registry preventing circular imports between UI/API/Combat/World modules), and `bindWindowStateProxies()` (preserving `window.state`, `window.combatPlaybackActive`, and `window.adventureDrawerOpen` for automated test/QA compatibility).
- Verified the entire module dependency graph with `verify-es-modules.js`:
  - **20 modules parsed**
  - **0 syntax errors**
  - **0 missing named imports/exports**
  - **0 circular dependencies**

### Step D — Backend Node.js & Express Architecture (`server.js` + `server/`)
- Refactored `action-ui-lab/server.js` from 2,809 lines down to a clean **115-line** application factory and backward-compatible CommonJS barrel export.
- Extracted 6 domain/state services in `server/services/`:
  - `facing-service.js` (90 lines) — Cardinal vectors, relative movement mapping, deterministic tile/facing seeds.
  - `monster-profile-service.js` (332 lines) — Integrated monster RGBA cutout grounding profiles, anatomical contact shadows, and render-mode contract resolution.
  - `sandbox-db-service.js` (169 lines) — Sandbox SQLite initialization, Lab schema extensions, test map enrichment, and living hero seeding.
  - `viewport-scene-service.js` (234 lines) — First-person tile inspection, `buildViewportScene` (Modes A/B/C/Legacy), atmosphere & POI binding, and relative move availability.
  - `combat-sequence-service.js` (314 lines) — Ordered multi-beat combat sequence builder (`HERO` → `MONSTER` → `OUTCOME`) and pre-round snapshot capture.
  - `client-state-service.js` (408 lines) — Secrecy-compliant `buildClientState` payload builder (strictly redacting monster identity during Stage 1 `DISCOVERED`).
- Extracted 6 focused controllers in `server/controllers/`:
  - `state-controller.js` (208 lines) — `GET /`, `GET /api/state`, `GET /api/atlas`, `GET /api/visual-qa`, `GET /api/monster-manifest`, `GET /api/monster-scaling`.
  - `action-controller.js` (64 lines) — Unified `POST /api/action` orchestrator delegating to 4 domain action controllers:
    - `navigation-controller.js` (346 lines) — `SET_SCENE_MODE`, `TURN`, `DISMISS_VICTORY`, `MOVE`, `INSPECT_POI`, `TELEPORT_TO_TILE`.
    - `combat-controller.js` (237 lines) — `INVESTIGATE`/`ENGAGE`, `IGNORE`/`BYPASS`, `ATTACK`, `POTION`, `FLEE`.
    - `character-town-controller.js` (133 lines) — `STANCE`, `REST`, `CLERIC_HEAL`, `EQUIP`, `UNEQUIP`, `BUY`, `SELL`, `ACCEPT_BOUNTY`, `ABANDON_BOUNTY`.
    - `adventure-scenario-controller.js` (435 lines) — `SET_ADVENTURE_MODE`, `START_EXPEDITION`, `RESET_EXPEDITION`, `RESOLVE_DISCOVERY_CHOICE`, `DISMISS_DISCOVERY`, `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, `LAB_SCENARIO`.
- Extracted Express routing & middleware:
  - `server/routes/api-routes.js` (30 lines) — Express Router mounting all GET and POST endpoints.
  - `server/middleware/static-assets.js` (56 lines) — Static asset middleware with `Cache-Control: no-store` for `/lab-assets` (`public/css/`, `public/js/`, `public/images/`) and `/images`, plus backward-compatible virtual bundle endpoints for `/lab-assets/action-ui.css` and `/lab-assets/action-ui.js`.

### Step E — HTML Evaluation (`public/index.html`)
- Evaluated `public/index.html` (541 lines). Because it is already cleanly segmented into semantic regions (Top Champion Deck, Main Stage Viewport, Tactical Action Deck, Right Compass/Minimap/Navigation Pad, Bottom Chronicle Drawer, and Modal Overlays) and has no inline logic, splitting it into runtime-fetched HTML fragments or server-side EJS templates would introduce asynchronous DOM-mounting complexity without architectural benefit.
- Retained `public/index.html` as a clean, zero-dependency static HTML shell, updating only the `<head>` stylesheet links (`public/css/*.css`) and ES module entrypoint (`<script type="module" src="/lab-assets/js/app.js"></script>`).
