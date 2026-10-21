# Phase A — Safety, Dependency & File Ownership Audit

**Date:** 2026-10-20  
**Branch / Worktree:** `darkgrid_overnight_development` (`C:\Users\hih\.gemini\antigravity\worktrees\antiDark\darkgrid_overnight_development`)  
**Scope:** Strictly isolated to `action-ui-lab/`

---

## 1. Boundary & Safety Verification

- **Production Code (`src/`, `db/`, `views/`, `public/css/`, `public/js/`):** Read-only. `action-ui-lab/server.js` imports domain modules from `../src/domain/*` and `../src/db/*` against an isolated SQLite database (`action-ui-lab/data/action_lab.sqlite` or `:memory:` in tests). Zero production database or source files will be modified.
- **Approved Original Monster Artwork (`images/monsters/` & `public/images/monsters/`):** Read-only. Contains 98 approved `1024×1024` monster paintings. Never modified or overwritten.
- **Experimental Cutouts (`action-ui-lab/public/images/monsters-cutout/`):** Currently contains 7 RGBA cutouts (`assassin_vine.png`, `ghoul.png`, `giant_spider.png`, `manticore.png`, `skeletal_champion.png`, `troll.png`, `wolf.png`). All new cutouts are added here.
- **Worktree Path Fix Applied in Phase A:** Fixed `res.sendFile` in `action-ui-lab/server.js` to pass `{ root: __dirname, dotfiles: 'allow' }` so Express `send` does not return 404 when running inside a `.gemini/antigravity/worktrees/...` path.
- **Baseline Test Suite:** `node --test action-ui-lab/tests/action-lab.test.js` → **32 / 32 passing (0 failures)**.

---

## 2. Exclusive File Ownership Matrix (Phase B Concurrent Tracks 1–4)

To guarantee zero conflicting edits during concurrent Phase B execution, each of the first four tracks has strict, non-overlapping file ownership:

| Track | Role | Exclusively Owned Code / Asset Files (Phase B) | Dedicated Progress & Final Report |
| :--- | :--- | :--- | :--- |
| **Track 1** | World Travel & Stability | `action-ui-lab/scene-catalog.js`<br>`action-ui-lab/adventure-engine.js`<br>`action-ui-lab/travel-continuity.js` (new helper module)<br>`action-ui-lab/tests/world-travel.test.js` (new test file) | `action-ui-lab/docs/overnight/01-world-travel-report.md` |
| **Track 2** | Player Experience & UI | `action-ui-lab/public/index.html`<br>`action-ui-lab/public/action-ui.css`<br>`action-ui-lab/public/action-ui.js`<br>`action-ui-lab/tests/player-ui.test.js` (new test file) | `action-ui-lab/docs/overnight/02-player-ui-report.md` |
| **Track 3** | Monster Size, Perspective & Scene Integration | `action-ui-lab/monster-size-catalog.js`<br>`action-ui-lab/tests/monster-scaling.test.js` (new test file) | `action-ui-lab/docs/overnight/03-monster-scaling-report.md` |
| **Track 4** | Complete Monster Artwork Production | `action-ui-lab/public/images/monsters-cutout/*`<br>`action-ui-lab/monster-artwork-inventory.json` (new manifest)<br>`action-ui-lab/scripts/produce-monster-cutouts.js` (new script)<br>`action-ui-lab/tests/monster-artwork.test.js` (new test file) | `action-ui-lab/docs/overnight/04-monster-artwork-report.md` |

### Shared Read-Only Files During Phase B
- `action-ui-lab/server.js` is **read-only during Phase B** (owned by Orchestrator / Track 5 in Phase C so Tracks 1–4 do not collide on `server.js`).
- `action-ui-lab/tests/action-lab.test.js` is **read-only during Phase B** (each track writes its new tests to its own `action-ui-lab/tests/<track>.test.js` file and runs both `action-lab.test.js` and its new test file to verify zero regressions).

---

## 3. Shared Interface Contracts Across Tracks

1. **Track 1 (`scene-catalog.js`, `adventure-engine.js`, `travel-continuity.js`) ↔ Phase C (`server.js`):**
   - `scene-catalog.js` and `adventure-engine.js` must preserve all existing exported function signatures and return shapes tested by `action-lab.test.js`.
   - `travel-continuity.js` exports pure functions (`buildTravelContinuityPayload`, `recordTravelStep`, `evaluateTransitionContinuity`, `restoreSavedTravelContext`, `getBoundaryGuidance`) that `adventure-engine.js` and `server.js` (in Phase C) attach to `state.travelContinuity` and `state.adventure`.
2. **Track 2 (`public/index.html`, `public/action-ui.css`, `public/action-ui.js`) ↔ Tests & Track 3:**
   - Must preserve all existing DOM IDs checked by `action-lab.test.js`, `size-scaling-visual-qa.js`, and `visual-regression.js` (including `#fp-ahead-portal`, `#fp-scene-svg-wrap`, `#compass-rose-ring`, `#pad-turn-left`, `#pad-turn-right`, `#pad-strafe-left`, `#pad-strafe-right`, `#fp-viewport`, `#fp-center-stage`, `#fp-monster-actor`, `.fp-monster-portrait-box`, `.sizelab-lineup-item`, etc.).
   - Must NOT override or hardcode monster dimensions in CSS that conflict with `computeClientMonsterVisualScale` / `MonsterSizeCatalog`.
   - Progressive disclosure modes (`exploration`, `combat`, `town`, `developer`) must toggle clean CSS classes on `body` / `.dm-shell` (`ui-mode-exploration`, `ui-mode-combat`, `ui-mode-town`, `dev-mode-visible` / `dev-mode-collapsed`).
3. **Track 3 (`monster-size-catalog.js`) ↔ Track 4 & Track 5:**
   - `computeAdaptiveMonsterVisualScale(monsterOrKey, options)` supports:
     - `virtualDistanceFt` (`20` for Stage 1 / distant encounter / ranged opening, `12` for standard melee, `8` for close press) and `encounterDistanceStage` (`'DISTANT'` | `'CLOSING'` | `'MELEE'`).
     - Multi-monster scene layout helper `computeMultiMonsterSceneLayout(monsters, options)` for 1–3 creatures in a scene without overlapping silhouettes or overflowing viewport bounds.
     - Cutout compatibility metadata (`cutoutAssetContract`) specifying required RGBA bounds, foot anchor ratio, and automatic fallback to `CARD` mode when a verified cutout is absent.
4. **Track 4 (`monster-artwork-inventory.json` & `public/images/monsters-cutout/`) ↔ Track 5:**
   - Every generated/extracted cutout in `action-ui-lab/public/images/monsters-cutout/<slug>.png` must be a valid PNG with true RGBA alpha channel (`colorType === 6`), verified transparency (`transparentPixelRatio >= 0.12`), non-cropped silhouette (`edgeTouchRatio` within safe bounds), and measured `contentBounds` (`minX, minY, maxX, maxY, contentWidthRatio, contentHeightRatio, topPadRatio, bottomPadRatio`).
   - `action-ui-lab/monster-artwork-inventory.json` records all 98 database monsters with their exact `id`, `slug`, `name`, `pfSize`, `visualBodyProfile`, `sourceArtworkPath`, `cutoutPath`, `hasVerifiedCutout`, `productionMethod`, `validationMetrics`, and `status` (`EXISTING_APPROVED` | `NEWLY_PRODUCED_VERIFIED` | `CARD_FALLBACK_RETAINED`).

---

## 4. Staged Execution Plan (Phases B → C → D → E)

- **Phase B (Parallel):** Launch Subagents for Track 1, Track 2, Track 3, and Track 4 concurrently in `inherit` workspace mode with strict non-overlapping file ownership enforced above.
- **Phase C (Integration — Track 5):** Upon verified completion of Tracks 1–4, launch Track 5 to integrate new cutouts, asset manifest, `monster-size-catalog.js` updates, `server.js` state payload wiring (`INTEGRATED_MONSTER_PROFILES` & `travelContinuity`), and client hooks, and produce `05-monster-integration-report.md`.
- **Phase D (Independent QA — Track 6):** Launch Track 6 to run all unit/integration suites plus headless Chrome E2E & visual QA across 1920×1080, 1440×900, and 1280×800, capturing screenshots and writing `06-independent-qa-report.md`.
- **Phase E (Final Handoff):** Compile `action-ui-lab/docs/overnight/OVERNIGHT-SUMMARY.md`, verify `git status` shows zero changes outside `action-ui-lab/`, and present the Icelandic executive summary.
