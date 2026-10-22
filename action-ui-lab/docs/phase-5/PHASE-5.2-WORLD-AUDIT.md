# DARKGRID ADVENTURE LAB — PHASE 5.2 WORLD AUDIT

**Phase:** 5.2 — Artwork Activation, World Verification & Final Quality Gate  
**Branch / Worktree:** `phase_5_1_review`  
**Audit Mode:** `APPROVED_DEFAULT` (Default Player Runtime — No `?artPreview=candidates`)  
**Total Grid Dimensions:** `15 × 15` (`225` tiles total: `160` passable tiles / `640` passable directional viewpoints, `65` impassable barrier tiles)

---

## 1. Six-Metric Classifier Summary (Expected vs. Actual)

All **640 passable directional viewpoints** across the 15×15 world were audited using the Phase 5.1/5.2 six-metric classifier (`evaluateWorldArtAudit` and `node action-ui-lab/scripts/verify-art-approval.js`):

| Metric | Target | Actual (Phase 5.2 Default Runtime) | Status |
|---|---|---|---|
| `BROKEN_IMAGE_REFERENCE` | `0` | **`0`** | **PASS** |
| `WRONG_SCENE` | `0` | **`0`** | **PASS** |
| `VALID_APPROVED_FALLBACK` (awaiting artwork) | `0` | **`0`** | **PASS** |
| `CANDIDATE_ART_PENDING` | `0` | **`0`** | **PASS** |
| `EXACT_DUPLICATE_TIER4` | `0` | **`0`** | **PASS** |
| `CORNER_BARRIER_OR_TRANSITION_PAIRS` | `10` (Acceptable) | **`10`** (5 geographic corner pairs) | **PASS** |
| **Unique environment paintings** | **`64`** | **`64`** | **PASS** |
| **Passable viewpoints passing** | **`640 / 640`** | **`640 / 640`** (`A=57`, `B=160`, `C=423`, `D=0`) | **PASS** |

Every file referenced by the approved scene catalog exists on disk under `action-ui-lab/public/images/` or `public/images/`, decodes with valid dimensions (`1376 × 768` for all Phase 5 JPEGs), and loads with HTTP `200 OK` in Chromium.

---

## 2. Quality Grade & POV Tier Breakdown (640 Passable Viewpoints)

### 2.1 Quality Grades
- **Grade A (`57` viewpoints):** Bespoke coordinate-locked landmark views (Oakhaven Sanctuary `7,7`, North Gate `7,6`, South Gate `7,8`, The Old Stone Bridge `8,7`, Bridge East Watchpost `9,7`, Mirkwood Crossroads `7,5`, Primeval Black Oak `7,3`, Deadman's Mire `4,11`, Raven Crags Cairn `3,5`, Stonefang Crag approaches, and the 3 restricted Windblown Heath barrow views).
- **Grade B (`160` viewpoints):** Context-locked barrier walls (`MOUNTAINS`, `RIVER_LAKE`, `OCEAN`) and directional biome transition borders (`FOREST↔PLAINS`, `PLAINS↔HILLS`, `HILLS↔FOREST`, `HILLS↔SWAMP`, `PLAINS↔SWAMP`, `SWAMP↔JUNGLE`).
- **Grade C (`423` viewpoints):** Multi-variant generic biome POV pools (4 distinct omnidirectional paintings per major biome, guaranteeing zero same-tile Tier 4 duplicates).
- **Grade D (`0` viewpoints):** Zero missing, contradictory, or unapproved fallback scenes remain.

### 2.2 POV Resolution Tiers
- **Tier 1 (`EXACT_POV`):** `33` viewpoints
- **Tier 2 (`LANDMARK_APPROACH`):** `24` viewpoints
- **Tier 3 (`BIOME_TRANSITION` / `BARRIER`):** `160` viewpoints
- **Tier 4 (`BIOME_POOL`):** `423` viewpoints

---

## 3. Special Handling Verification: `P5-ART-04` & `P5-ART-04-REPL`

`P5-ART-04` (`plains_lone_barrow_horizon_pov.jpg`) is permanently configured with `approvalMode: 'RESTRICTED_WITH_REPLACEMENT'`:

| Asset | Assigned Role | Viewpoint Count | Exact Viewpoints |
|---|---|---|---|
| `P5-ART-04` (`/lab-assets/images/terrain/plains_lone_barrow_horizon_pov.jpg`) | Northeastern Windblown Heath Barrow Landmark | **`3`** | `12,1:SOUTH`, `12,2:NORTH`, `13,2:WEST` |
| `P5-ART-04-REPL` (`/lab-assets/images/terrain/plains_open_moorland_swell_pov.jpg`) | Generic `PLAINS` Tier 4 Slot Replacement | **`16`** | `6,6:SOUTH`, `8,6:WEST`, `9,1:SOUTH`, `9,3:EAST`, `9,5:SOUTH`, `9,6:WEST`, `10,2:SOUTH`, `10,3:WEST`, `10,4:EAST`, `10,6:WEST`, `11,2:WEST`, `11,5:SOUTH`, `12,3:SOUTH`, `12,4:WEST`, `13,3:WEST`, `13,6:SOUTH` |

The recognizable burial mound never appears randomly across the central or southern Verdant Plains.

---

## 4. Acceptable Corner Barrier / Transition Pairs (`10` Viewpoints / `5` Pairs)

As documented in Phase 5.1 and preserved in Phase 5.2, exactly 5 tiles sit inside 90° L-shaped geographic corners where two adjacent cardinal directions face the exact same continuous barrier or border terrain:

1. **`[1,1]` (`HILLS`) — `NORTH` & `WEST`:** Both face the continuous northwestern `MOUNTAINS` perimeter wall (`barrier_mountain_wall_pov.jpg`).
2. **`[13,1]` (`PLAINS`) — `NORTH` & `EAST`:** Both face the continuous northeastern `MOUNTAINS` perimeter wall (`barrier_mountain_wall_pov.jpg`).
3. **`[8,6]` (`PLAINS`) — `NORTH` & `EAST`:** Both face the bend of the impassable Blackwater River (`barrier_river_rapids_pov.jpg`).
4. **`[9,8]` (`PLAINS`) — `SOUTH` & `WEST`:** Both face the southern Blackwater River channel (`barrier_river_rapids_pov.jpg`).
5. **`[8,11]` (`SWAMP`) — `EAST` & `SOUTH`:** Both face the continuous `JUNGLE` border wrapping around the southeastern edge of the Rotting Fen (`transition_swamp_to_jungle_pov.jpg`).

All 5 pairs are Tier 3 context-locked barrier/transition views (`EXACT_DUPLICATE_TIER4 = 0`).

---

## 5. Canonical World Continuity Journeys (Travel & 360° Rotation)

All three canonical journeys were revalidated in both directions (outbound travel, 360° cardinal rotation at each stop, and return travel):

### 5.1 Journey A — Oakhaven to Primeval Black Oak
**Route:** `[7,7] → [7,6] → [7,5] → [7,4] → [7,3]` (and return `[7,3] → [7,7]`)
- **`[7,7]` Oakhaven Sanctuary:** All 4 cardinal directions (`oakhaven_7_7_north/east/south/west.jpg`) render distinct cobblestone street and gate perspectives.
- **`[7,6]` Oakhaven North Gate:** `NORTH` looks up the forest road (`north_gate_7_6_north.jpg`), `SOUTH` looks back through the gatehouse into Oakhaven (`north_gate_7_6_south.jpg`), `EAST` and `WEST` follow the timber palisade walls.
- **`[7,5]` Mirkwood Crossroads:** `NORTH` and `SOUTH` form a coherent 180° rune-waystone pair (`crossroads_7_5_north.jpg` / `south.jpg`), while `EAST` and `WEST` resolve distinct lateral woodland trails (`crossroads_7_5_lateral.jpg` and `forest_Hollow_log_pov.jpg`).
- **`[7,4]` Mirkwood Trail:** `NORTH` previews the colossal Primeval Black Oak looming ahead (`forest_7_4_north_oak_approach.jpg`), `SOUTH` looks back toward the crossroads signpost (`crossroads_7_5_lateral.jpg`).
- **`[7,3]` Heart of the Mirkwood (Primeval Black Oak):** All 4 directions are visually distinct (`NORTH`: `forest_ancient_oak.jpg`, `SOUTH`: `ancient_oak_7_3_south.jpg`, `EAST`: `forest_pine_ravine.jpg`, `WEST`: `terrain_forest.webp`). Zero generic forest tiles leak the Ancient Oak landmark.

### 5.2 Journey B — Oakhaven to Eastern Plains
**Route:** `[7,7] → [8,7] → [9,7] → [10,7]` (plus northeastern heath `[12,1]`, `[12,2]`, `[13,2]`)
- **`[8,7]` The Old Stone Bridge:** `EAST` (`bridge_8_7_east.jpg`) and `WEST` (`bridge_8_7_west.jpg`) form a 180° bridge-deck pair; `NORTH` and `SOUTH` face the impassable Blackwater River (`barrier_blackwater_bridge_north_pov.jpg` / `south_pov.jpg`) with movement blocked.
- **`[9,7]` Bridge East Watchpost:** All 4 cardinal views are bespoke and distinct (`WEST`: `watchpost_9_7_west.jpg`, `EAST`: `watchpost_9_7_east.jpg`, `NORTH`: `watchpost_9_7_river_flank.jpg`, and newly activated `P5-ART-13` `SOUTH`: `watchpost_9_7_south_river_gorge.jpg`).
- **`[10,7]` Verdant Plains:** Resolves 4 distinct `PLAINS` views (`WEST` looks back toward the ruined watchpost `watchpost_approach_10_7_west.jpg`, while `NORTH`, `EAST`, and `SOUTH` resolve distinct Tier 4 plains paintings including `plains_rutted_wagon_track_pov.jpg`).
- **Northeastern Barrow Continuity (`[12,1]`, `[12,2]`, `[13,2]`):** Looking toward `[12,2]` from `[12,1] SOUTH`, `[12,2] NORTH`, or `[13,2] WEST` displays the lone barrow (`plains_lone_barrow_horizon_pov.jpg`), while `[12,3] SOUTH` and other plains tiles use the open moorland swell (`plains_open_moorland_swell_pov.jpg`).

### 5.3 Journey C — Oakhaven to Deadman's Mire
**Route:** `[7,7] → [7,8] → [7,9] → [6,9] → [6,10] → [6,11] → [5,11] → [4,11]` (and return)
- **`[7,8]` Oakhaven South Gate & `[7,9]` Rotting Fen Threshold:** Smooth causeway transition from town cobblestones into marshy willow bogs (`south_gate_7_8_south.jpg` / `north.jpg`).
- **`[6,9]` Northern Marsh Border:** Looking `NORTH` toward `[6,8]` (`PLAINS`) resolves the newly activated `P5-ART-09` (`transition_swamp_to_plains_pov.jpg`).
- **`[6,10]`, `[6,11]`, `[5,11]` Rotting Fen Interior:** Resolves temperate dark-fantasy marsh views (`swamp_willow_boardwalk_pov.jpg`, `swamp_sunken_roots_channel_pov.jpg`, `transition_plains_to_swamp_pov.jpg`, `terrain_swamp.webp`) with zero tropical jungle foliage.
- **`[4,11]` Deadman's Mire:** All 4 cardinal directions are visually distinct (`NORTH`: `deadmans_mire_4_11_ruins.jpg`, `SOUTH`: `swamp_approach_mire_ruins.jpg`, `EAST`: `swamp_willow_boardwalk_pov.jpg`, `WEST`: `terrain_swamp.webp`).
