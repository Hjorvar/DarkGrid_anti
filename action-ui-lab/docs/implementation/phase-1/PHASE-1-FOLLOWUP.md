# DARKGRID ADVENTURE LAB — PHASE 1 FOLLOW-UP & ART BACKLOG
## Remaining Perspective Gaps, Deferred Changes & Readiness for Workstream 2

---

## 1. Missing Perspectives & Future Artwork Backlog

During Phase 1, we strictly avoided generating unapproved bulk artwork or faking directional variety with mismatched biomes. To achieve 100% bespoke 4-way uniqueness across all generic tiles and reverse biome transitions in a future art pass, the following **11 targeted eye-level POV illustrations** are recommended:

### A. Generic Tier 4 Biome Pool Expansion (6 Images)
Currently, Tier 4 `GENERIC_TERRAIN_POV` pools have `3` safe eye-level variants in `FOREST`, `HILLS`, `SWAMP`, and `JUNGLE`, and `2` in `PLAINS`. Adding the following images will bring every major biome to `4` distinct generic eye-level POV variants (eliminating all opposite/flank sharing when turning $360^\circ$ on generic tiles):
1. `forest_mossy_oak_glade_pov.jpg` (`FOREST` generic POV #3 — replaces the shared `ancient_oak_7_3_south.jpg` on `forest_tangled_canopy` so `ancient_oak_7_3_south.jpg` remains exclusive to `[7,3] SOUTH`)
2. `forest_misty_birch_hollow_pov.jpg` (`FOREST` generic POV #4)
3. `plains_rutted_wagon_track_pov.jpg` (`PLAINS` generic POV #3)
4. `plains_lone_barrow_horizon_pov.jpg` (`PLAINS` generic POV #4)
5. `swamp_sunken_roots_channel_pov.jpg` (`SWAMP` generic POV #4)
6. `hills_windswept_scree_pass_pov.jpg` (`HILLS` generic POV #3 — allowing `terrain_hills.webp` overview to be retired from Tier 4 fallback)

### B. Dedicated Reverse-Transition POV Paintings (4 Images)
Currently, forward biome transitions have bespoke paintings (`transition_plains_to_forest_pov.jpg`, `transition_forest_to_plains_pov.jpg`, `transition_plains_to_swamp_pov.jpg`, `transition_forest_to_hills_pov.jpg`, `transition_swamp_to_jungle_pov.jpg`), whereas reverse transitions use the closest foreground-accurate terrain POV. Painting these 4 dedicated reverse-transition scenes will complete bidirectional threshold symmetry:
7. `transition_swamp_to_plains_pov.jpg` (Foreground: dark bog water & boardwalk planks; Mid/Background: rising dry grassland & sunlit plains road)
8. `transition_hills_to_forest_pov.jpg` (Foreground: rocky highland ledge & scree; Mid/Background: descending trail into dense dark Mirkwood pines)
9. `transition_plains_to_hills_pov.jpg` (Foreground: golden frontier grass & heather; Mid/Background: steepening rocky foothills & crags)
10. `transition_hills_to_plains_pov.jpg` (Foreground: rocky ridge overlook at eye level; Mid/Background: wide open windswept plains stretching to the horizon)

### C. Landmark Flank Separation (1 Image)
11. `watchpost_9_7_south_river_gorge.jpg` (`[9,7] SOUTH` — distinguishes the southern river flank of Bridge East Watchpost from `[9,7] NORTH`, which currently shares `watchpost_9_7_river_flank.jpg`).

---

## 2. Changes Explicitly Deferred Beyond Phase 1

In accordance with the Phase 1 scope boundaries:
- **Encounter Probabilities & Pacing Curves (Workstream 2):** No changes were made to encounter roll probabilities, discovery cooldown math, or Stage 1 / Stage 2 combat rules.
- **Monster Cutout Edge Matting & Grounding Polish (Workstream 3):** No changes were made to monster PNG cutouts or combat staging anchors.
- **Main UI Layout & Viewport Architecture (Workstream 4):** No new modal cards or layout restructurings were introduced; all travel continuity signals (`continuityNote`, `horizonHint`, `revisitStatus` / `revisitBanner`, `compassContext`, `combatReturnContext`) were integrated directly into the existing `.fp-vista-bar`, `#fp-bottom-chronicle`, and compass/FOV labels.

---

## 3. Readiness Assessment for Workstream 2

**Recommendation: READY TO PROCEED TO WORKSTREAM 2.**

- **Why:**
  1. The Mirkwood primary expedition spine (`[7,7] ↔ [7,6] ↔ [7,5] ↔ [7,4] ↔ [7,3]`) now has unbroken, bidirectional Tier 1 visual continuity (`[7,4] NORTH` shows the Primeval Black Oak approach; `[7,4] SOUTH` looks back toward the Crossroads; `[7,3] EAST/WEST` no longer misuse the `[7,4]` approach painting).
  2. The deterministic Tier 4 `NORTH === WEST` modulo-3 bug is eliminated across the entire map.
  3. All `FOREST` tiles are free of tropical `terrain_jungle.webp` art, and `crossroads_7_5_east.jpg` no longer repeats on generic eastward forest steps.
  4. `Deadman's Mire [4,11]` has 4 distinct directional views.
  5. The player HUD (`#fp-bottom-chronicle` and `.fp-vista-bar`) now surfaces `continuityNote`, `horizonHint`, `revisitStatus`, `compassContext`, and `combatReturnContext` in clean English with zero technical enum leaks.
  6. All **54 automated tests** across `action-lab.test.js`, `world-travel.test.js`, and `player-ui.test.js` pass (`0` failures), and headless Chromium verification confirmed `0` console/runtime errors.
