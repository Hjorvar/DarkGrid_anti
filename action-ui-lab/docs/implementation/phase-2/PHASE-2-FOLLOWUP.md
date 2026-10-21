# DARKGRID ADVENTURE LAB — PHASE 2 FOLLOWUP & PHASE 3 / 4 PREPARATION
## Prioritized Backlog & Readiness for Phase 3 and Phase 4

**Scope:** `action-ui-lab/`  
**Status:** Phase 1 & Phase 2 Complete (`59 / 59` automated tests passing across all 3 sandbox suites; `228 / 228` main game tests passing; `19` headless Chromium Visual QA screenshots verified with `0` console/page errors)

---

## 1. Summary of Completed Phase 2 Foundations

1. **World Exploration Pacing & Motion Continuity (Workstream A):**
   - Smooth `160ms` non-blocking scene crossfade (`applySceneImageWithCrossfade` + `@keyframes fpSceneCrossfadeIn`), subtle Tier 1 landmark arrival emphasis (`.anim-landmark-arrival`), `@media (prefers-reduced-motion: reduce)` compliance, and atomic neighbor/threat step updates in `server.js` and `adventure-engine.js`.
2. **Calibrated Encounter Pacing & Deterministic Simulation (Workstream B):**
   - Configurable `ENCOUNTER_PACING_CONFIG` & `computeEncounterPacingChance` wired via `{ forcedChance }` in `server.js`.
   - Enforces Town Gate departure grace (`0%`), 1-step post-encounter breathing room (`0%` back-to-back encounters), 2nd-step soft recovery (`0.40x`), 2-tile anti-oscillation suppression (`0%`), 8-step `CLEARED_SITE` protection (`0%`, then `0.25x`), `FAMILIAR_SAFE` revisit dampening (`0.45x`), terrain danger hierarchy (`PLAINS/BRIDGE 16% < FOREST/HILLS 22% < SWAMP/JUNGLE 28% < RUINS/LANDMARKS 30%`), and `100%` persistent/authored encounter priority.
3. **Visual World Continuity & Barrier Fidelity (Workstream C):**
   - Repaired Blackwater River barrier views (`barrier_blackwater_bank_pov.jpg`), separated Darkmount Peaks (`barrier_darkmount_crags_pov.jpg`) from Stonefang Crag (`crossroads_7_5_west.jpg`), added `HILLS ↔ SWAMP` transitions, promoted `[7,9] NORTH` (`fp_fen_7_9_north`) to Tier 1, and added Tier 4 neighbor collision avoidance.
4. **Player Experience Cleanup (Workstream D):**
   - Obstacle-specific blocked movement floating popups (`⛔ Blocked: Blackwater River`) and single-voiced Chronicle error banners (no duplicate continuity line when blocked).

---

## 2. Preparation Roadmap for Upcoming Phases

### Phase 3 — Monster Scale, Grounding & Combat Presentation (Next Up)
With world continuity and encounter pacing stabilized in Phases 1–2, **Phase 3** can focus cleanly on in-scene monster presentation inside `action-ui-lab/`:
1. **True Floor Grounding (`--stage-floor-y` & `--monster-offset-y`):**
   - Anchor both `INTEGRATED` RGBA cutouts (37 monsters) and `CARD` fallback frames (61 monsters) to the scene's perspective floor line (`stageAnchor.floorYPercent`) rather than letting `.fp-monster-hud-plate` push monsters upward into the tree canopy.
2. **Card Fallback Grounding (`CARD` Mode):**
   - Eliminate the mid-air floating behavior (`56–60%` Y) on `CARD` fallback monsters so framed cards sit on a grounded dark-fantasy pedestal/plinth aligned with the terrain floor.
3. **Per-Monster Foot Contact Shadows (`contactPatches`):**
   - Replace generic template ovals with alpha-derived foot contact patches (`alpha > 20` in the bottom 12% of each RGBA cutout) while maintaining airborne shadow separation for flying creatures (`stirge`, `manticore`, `wyvern`, `harpy`, `blood_hawk`, `gargoyle`, `will_o_wisp`).
4. **Stage 1 → Stage 2 Reveal Transition:**
   - Smoothly transition from the veiled Stage 1 `.threat-presence-shadow` silhouette into the grounded Stage 2 monster presentation upon engagement.

### Phase 4 — Player UI Simplification & Responsive Layout
Following Phase 3 combat staging, **Phase 4** will streamline the surrounding HUD frame (`index.html`, `action-ui.css`, `action-ui.js`):
1. **Right-Deck Layout & `386 px` Empty Space Elimination:**
   - Reflow `.dm-right-deck` so the compass/minimap, tactical actions (`[1–4]`), compact 3×3 navigation pad, and live Wayfinder/Continuity bearings fill the right column cleanly without dead vertical whitespace.
2. **Top-Deck Deduplication:**
   - Consolidate duplicate HP/AC readouts (`.dm-vertical-pillars` vs. `.dm-vitals-readout`) and redundant quick-stance/quick-pack buttons so every vital stat and control appears once in a clear hierarchy.
3. **Responsive Multi-Resolution Polish (`1920×1080`, `1440×900`, `1280×800`, `1280×720`):**
   - Expand `.dm-shell` max-width on 1080p displays so the first-person viewport commands maximum screen real estate while keeping zero-scroll `100dvh` ergonomics on compact laptop/handheld screens.

### Targeted Environment Art Backlog (from [`PHASE-2-ART-BACKLOG.md`](./PHASE-2-ART-BACKLOG.md))
- **HIGH Priority (2 paintings):** `forest_tangled_canopy_pov.jpg` (retiring `ancient_oak_7_3_south.jpg` from Tier 4 generic use) and `transition_hills_to_swamp_pov.jpg` (rocky scree descending into Rotting Fen).
- **MEDIUM Priority (3 paintings):** 4th generic directional POV variants for `FOREST`, `SWAMP`, and `HILLS`.

---

## 3. Readiness Assessment for Phase 3

**Status: READY FOR PHASE 3 (`GO`).**  
All 59 sandbox tests (`action-lab.test.js`, `world-travel.test.js`, `player-ui.test.js`) and all 228 main application tests pass with `0` failures, and `git status` confirms 100% sandbox isolation inside `action-ui-lab/`.
