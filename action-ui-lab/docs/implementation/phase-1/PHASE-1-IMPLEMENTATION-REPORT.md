# DARKGRID ADVENTURE LAB — PHASE 1 IMPLEMENTATION REPORT
## Workstream 1: World Continuity & Scene Resolver Repair

**Branch / Worktree:** `darkgrid_overnight_development`  
**Scope:** Isolated strictly to `action-ui-lab/` (zero modifications to `main`, `src/`, `db/`, Firebase, or production runtime)  
**Status:** Complete — All 12 Acceptance Criteria evaluated and verified

---

## 1. Confirmed Continuity Issues Addressed

Based on the independent audit (`ADVENTURE-IMMERSION-REVIEW.md` and `NEXT-IMPLEMENTATION-PLAN.md`), the following world-continuity defects were confirmed and repaired:

1. **Mirkwood Trail `[7,4] NORTH` Missing Bespoke Oak Approach (`A1`):**
   - **Confirmed Issue:** `forest_7_4_north_oak_approach.jpg` existed on disk in `action-ui-lab/public/images/perspective/` and was specifically painted to depict approaching the Primeval Black Oak from `[7,4]` facing `NORTH`, yet `[7,4] NORTH` had no Tier 1 entry and fell through to Tier 4 (`terrain_forest.webp`). Worse, `forest_7_4_north_oak_approach.jpg` was misassigned to `fp_ancient_oak_7_3_east` and `fp_ancient_oak_7_3_west`, causing the player to see the distant approach trail *after* already arriving at `[7,3]` and turning sideways.
   - **Fix Applied:**
     - Added Tier 1 exact perspective override `fp_mirkwood_trail_7_4_north` (`(7,4) NORTH` $\rightarrow$ `/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg`) with approach subtitle *"The central Mirkwood trail narrows ahead as the colossal root-arch of the Primeval Black Oak rises through the mist at [7,3]."*
     - Added Tier 1 exact perspective override `fp_mirkwood_trail_7_4_south` (`(7,4) SOUTH` $\rightarrow$ `/lab-assets/images/perspective/crossroads_7_5_lateral.jpg`) so turning south at `[7,4]` looks back toward the Mirkwood Crossroads `[7,5]`.
     - Reassigned `fp_ancient_oak_7_3_east` to `/lab-assets/images/terrain/forest_pine_ravine.jpg` and `fp_ancient_oak_7_3_west` to `/images/terrain/terrain_forest.webp` so all four facings at `[7,3]` (`NORTH`, `EAST`, `SOUTH`, `WEST`) are visually distinct and geographically accurate.

2. **Tier 4 Directional Variant Modulo-3 Collision (`A2`):**
   - **Confirmed Issue:** In `resolveSceneModeCCore`, Tier 4 called `computeDeterministicVariantIndex(Number(current.x) + fIndex, Number(current.y), tier4Pool.length)` where `fIndex` is `{ NORTH: 0, EAST: 1, SOUTH: 2, WEST: 3 }`. Because `computeDeterministicVariantIndex` computed `Math.abs((x * 7 + y * 13)) % count`, whenever `count === 3` (`FOREST`, `HILLS`, `SWAMP`, `JUNGLE`), `(x + 3) * 7 = x * 7 + 21` had the exact same remainder modulo `3` as `(x + 0) * 7`. Consequently, `NORTH` and `WEST` were mathematically guaranteed to display the exact same image on every 3-variant Tier 4 tile across the map.
   - **Fix Applied:**
     - Updated `computeDeterministicVariantIndex(x, y, count, facing = null)` so that:
       - When `facing` is provided (`NORTH`, `EAST`, `SOUTH`, `WEST`), it computes `((base % n) + fIdx) % n`, guaranteeing that `NORTH` (`+0`) and `WEST` (`+3`) never collide on `count = 3` and that every $90^\circ$ turn (`N -> E -> S -> W -> N`) steps to a different variant for any pool with `n >= 2`.
       - When called with 3 arguments `(x + fIndex, y, count)`, it uses coprime multipliers (`x * 5 + y * 11` for `count % 3 === 0`) so `fIndex = 0` and `fIndex = 3` never alias modulo 3 while preserving exact `(x, y)` compatibility for `count = 4` and `count = 2`.

3. **Deadman's Mire `[4,11]` 4-Way Identical Image (`A3`):**
   - **Confirmed Issue:** All four Tier 1 overrides at `Deadman's Mire [4,11]` (`fp_deadmans_mire_4_11_north`, `_south`, `_east`, `_west`) pointed to `/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg`, making rotation feel broken.
   - **Fix Applied:** Differentiated all four cardinal views at `[4,11]` using visually verified swamp/ruin perspectives:
     - `NORTH`: `/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg` (Sunken temple courtyard directly ahead)
     - `SOUTH`: `/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg` (Looking south along the sunken stone causeway)
     - `EAST`: `/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg` (Flooded boardwalk leading east toward the Rotting Fen)
     - `WEST`: `/images/terrain/terrain_swamp.webp` (Dark cypress backwaters and tangled roots to the west)
   - Also deduplicated `[12,4] EAST` (`fp_ruins_12_4_east` $\rightarrow$ `/images/terrain/terrain_plains.webp`) so `[12,4] NORTH` and `EAST` do not repeat the same ruins doorway.

4. **Temperate Forest Visual Consistency — Removal of `terrain_jungle.webp` (`A4`):**
   - **Confirmed Issue:** `forest_tangled_canopy` in `DEFAULT_SCENE_VARIANTS` pointed to `/images/terrain/terrain_jungle.webp` (a tropical jungle scene with palm fronds and lianas), causing 52 temperate `FOREST` viewpoints in Mirkwood to display tropical jungle artwork. Additionally, `forest_crossroads_lateral_pov` (`crossroads_7_5_lateral.jpg`, which depicts the carved wooden Crossroads signpost) was marked `safe_for_pov_fallback: 1`, leaking the Crossroads signpost onto unrelated Tier 4 forest tiles.
   - **Fix Applied:**
     - Updated `forest_tangled_canopy` to use `/lab-assets/images/perspective/ancient_oak_7_3_south.jpg` (an eye-level dark-fantasy woodland trail framed by overarching oak roots and mossy canopy).
     - Set `has_directional_landmark: 1, safe_for_pov_fallback: 0` on `forest_crossroads_lateral_pov` and added `UPDATE lab_scene_variants SET is_active = 0;` prior to seeding in `initSceneCatalogTables` so stale rows cannot persist.
     - Verified across the entire 15x15 World Visual Atlas that `0` `FOREST` viewpoints use `terrain_jungle.webp` and `0` generic Tier 4 forest tiles leak the Crossroads signpost.

5. **Generic POV & Transition Rules Audit (`A5`):**
   - **Confirmed Issue:**
     - `pov_forest_track_east` matched every `FOREST -> FOREST` eastward view on the map (28 passable views), stamping `crossroads_7_5_east.jpg` across the entire forest.
     - `pov_transition_swamp_to_plains` reused `transition_plains_to_swamp_pov.jpg` (which has dry plains in the foreground and dark swamp ahead — visually inverted when standing in `SWAMP` looking toward `PLAINS`).
     - `pov_transition_hills_to_forest` reused `transition_forest_to_hills_pov.jpg` (which has rocky hills ahead rather than forest ahead).
     - `pov_transition_plains_to_hills` and `pov_transition_hills_to_plains` used `terrain_hills.webp` (an overview angle with no plains transition).
   - **Fix Applied:**
     - Scoped `pov_forest_track_east` (`crossroads_7_5_east.jpg`) strictly to `Mirkwood Crossroads [7,5] EAST` in `resolveSceneModeCCore`.
     - Updated `pov_transition_swamp_to_plains` to `/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg` (foreground swamp boardwalk leading toward brighter open horizon).
     - Updated `pov_transition_hills_to_forest` to `/lab-assets/images/terrain/forest_pine_ravine.jpg` (downward ravine slope descending into dark pines).
     - Updated `pov_transition_plains_to_hills` to `/lab-assets/images/terrain/hills_highland_ridge_pov.jpg` (ascending grassy highland trail into craggy hills) and `pov_transition_hills_to_plains` to `/images/terrain/terrain_plains.webp` (open wind-swept grassland below the ridge).

6. **Connecting Backend Travel Continuity to Player UI (`Task B`):**
   - **Confirmed Issue:** `state.adventure` already computed `continuityNote`, `horizonHint`, `revisitStatus`, `revisitBanner`, `compassContext`, and `combatReturnContext`, but `action-ui-lab/public/action-ui.js` never rendered any of those fields in the player-facing HUD.
   - **Fix Applied:**
     - Exposed `revisitBanner` and `behindHint` at the top level of `state.adventure` in `action-ui-lab/adventure-engine.js`.
     - Added `sanitizePlayerContinuityText(rawText)` in `action-ui-lab/public/action-ui.js` to strip raw technical enum tokens (`(CLEARED_SITE)`, `LINGERING_THREAT_SITE`, `(FOREST)`, `(PLAINS)`, `facing NORTH`) into natural English for Player Mode.
     - Wired `continuityNote`, `combatReturnContext.groundedReturnNote`, and `revisitBanner` into `#fp-bottom-chronicle` (`#fp-chronicle-continuity-note`, `#fp-chronicle-combat-return`, `#fp-chronicle-revisit-note`) and `chronicleHistoryBuffer`.
     - Wired `horizonHint`, `boundaryGuidance.playerMessage`, and `buildRevisitBadgeHtml(adv)` (`✓ Secured Ground`, `⚠️ Lingering Threat`, `↺ Familiar Ground`) into `.fp-vista-bar` and the post-victory HUD plate (`.fp-combat-return-line`), while suppressing badges on `FIRST_VISIT` to prevent visual clutter.
     - Wired `compassContext` (`ahead`, `left`, `right`, `behind`) into `#compass-ahead-lbl` and `#fp-fov-left` / `#fp-fov-ahead` / `#fp-fov-right` labels and tooltips.
     - Preserved full Stage 1 (`DISCOVERED`) encounter secrecy.

---

## 2. Files Modified

| File | Summary of Changes |
| :--- | :--- |
| `action-ui-lab/scene-catalog.js` | Added `fp_mirkwood_trail_7_4_north` and `fp_mirkwood_trail_7_4_south`; fixed `[7,3] EAST/WEST`, `[4,11] N/E/S/W`, and `[12,4] EAST`; fixed modulo-3 collision in `computeDeterministicVariantIndex`; replaced `terrain_jungle.webp` on `forest_tangled_canopy`; scoped `pov_forest_track_east` to `(7,5) EAST`; fixed 4 biome transition rules. |
| `action-ui-lab/adventure-engine.js` | Exposed `revisitBanner` and `behindHint` directly on `state.adventure` alongside `continuityNote`, `horizonHint`, `revisitStatus`, `compassContext`, and `combatReturnContext`. |
| `action-ui-lab/public/action-ui.js` | Added `sanitizePlayerContinuityText` and `buildRevisitBadgeHtml`; connected `continuityNote`, `horizonHint`, `revisitStatus`/`revisitBanner`, `compassContext`, and `combatReturnContext` to `#fp-bottom-chronicle`, `.fp-vista-bar`, post-victory HUD, and compass/FOV labels. |
| `action-ui-lab/public/action-ui.css` | Added compact styling for `.fp-log-line.travel_continuity` and `.fp-revisit-pill` (`is-cleared`, `is-lingering`, `is-familiar`). |
| `action-ui-lab/tests/action-lab.test.js` | Updated Test 16 for `[7,4] NORTH` now resolving via Tier 1 (`fp_mirkwood_trail_7_4_north`) and `[7,4] EAST` resolving via Tier 4 (`GENERIC_TERRAIN_POV`). |
| `action-ui-lab/tests/world-travel.test.js` | Added Phase 1 regression tests 11 & 12 verifying `[7,4] N/S`, `[7,3] E/W`, `[4,11]` 4-way uniqueness, modulo-3 fix, `0` jungle views in `FOREST`, and `[7,5] EAST` scoping. |
| `action-ui-lab/tests/player-ui.test.js` | Added Phase 1 regression test 10 verifying Player UI travel continuity bindings and technical enum sanitization. |

---

## 3. Unresolved / Art-Limited Items (Documented for Follow-Up)

Per the strict instruction not to fabricate continuity with random images or mass-generate new artwork during Phase 1:
1. **3-Variant & 2-Variant Tier 4 Biome Pools:**
   - With the modulo-3 bug fixed, every $90^\circ$ turn (`N -> E -> S -> W -> N`) on a 3-variant pool (`FOREST`, `HILLS`, `SWAMP`, `JUNGLE`) changes the scene, and `NORTH` never collides with `WEST`. However, because 4 cardinal directions are mapped onto 3 safe generic POV images (or 2 in `PLAINS`), at least one pair of directions (`EAST` and `WEST`, or opposite $180^\circ$ directions in `PLAINS`) must still share an image on purely generic Tier 4 tiles until a 4th generic POV variant is painted for each biome.
2. **Missing Bespoke Reverse-Transition Paintings:**
   - Dedicated forward-transition paintings exist for `PLAINS -> FOREST`, `FOREST -> PLAINS`, `PLAINS -> SWAMP`, `FOREST -> HILLS`, and `SWAMP -> JUNGLE`, but dedicated reverse paintings for `SWAMP -> PLAINS`, `HILLS -> FOREST`, `PLAINS -> HILLS`, and `HILLS -> PLAINS` do not yet exist on disk. Phase 1 replaces the inverted transition images with the closest foreground-accurate terrain POVs; bespoke transition paintings are cataloged in `PHASE-1-FOLLOWUP.md`.
3. **Watchpost `[9,7] NORTH` and `SOUTH` Shared River Flank Art:**
   - `[9,7] NORTH` and `[9,7] SOUTH` both face the impassable Blackwater River from the Watchpost bank and share `watchpost_9_7_river_flank.jpg` (explicitly locked by existing Test 20 in `action-lab.test.js`).

---

## 4. Automated Test Results

All automated test suites in `action-ui-lab/tests/` were executed and passed with zero failures:

- `action-ui-lab/tests/action-lab.test.js`: **32 / 32 passed**
- `action-ui-lab/tests/world-travel.test.js`: **12 / 12 passed** (including new Phase 1 regression tests 11 & 12)
- `action-ui-lab/tests/player-ui.test.js`: **10 / 10 passed** (including new Phase 1 regression test 10)
- **Total:** **54 / 54 tests passing (`0` failures)**
