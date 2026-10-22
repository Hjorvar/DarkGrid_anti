# DARKGRID ADVENTURE LAB — PHASE 5.1 ARTWORK REVIEW (`REVIEW REQUIRED`)

**Branch:** `phase_5_1_review`  
**Scope:** `action-ui-lab/`  
**Review Status:** **ALL 13 CANDIDATES (`P5-ART-01`..`P5-ART-13`) + REPLACEMENT CANDIDATE (`P5-ART-04-REPL`) REMAIN `REVIEW REQUIRED` UNTIL OWNER APPROVAL**

---

## 1. Executive Summary & Recommendations Matrix

Every Phase 5 candidate painting in [`action-ui-lab/docs/phase-5/art-candidates/`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/docs/phase-5/art-candidates) was inspected at full `1376×768` resolution, verified against SHA-256 checksums, and tested inside the live First-Person Action Viewport (`Candidate Preview Mode`) across exploration, landmark approach, biome transition, and Stage 2 monster grounding scenarios.

| ID | File Name | Category | Target Biome / Slot | Viewpoints | Phase 5.1 Recommendation | Governance Status |
|---|---|---|---|---:|---|---|
| **P5-ART-01** | `forest_tangled_canopy_pov.jpg` | Generic Biome POV | `FOREST` Tier 4 (`forest_tangled_canopy`) | 49 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-02** | `forest_misty_birch_hollow_pov.jpg` | Generic Biome POV | `FOREST` Tier 4 (`forest_misty_birch_hollow_pov`) | 42 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-03** | `plains_rutted_wagon_track_pov.jpg` | Generic Biome POV | `PLAINS` Tier 4 (`plains_rutted_wagon_track_pov`) | 16 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-04** | `plains_lone_barrow_horizon_pov.jpg` | Generic Biome POV | `PLAINS` Tier 4 (`plains_lone_barrow_horizon_pov`) | 19 (unrestricted) / 3 (restricted) | **RECOMMEND RESTRICTED USE** (`Option B` on `12,1:S`, `12,2:N`, `13,2:W`) + **RECOMMEND REPLACEMENT** (`Option C` via `P5-ART-04-REPL` for generic Tier 4) | `REVIEW REQUIRED` |
| **P5-ART-04-REPL** | `plains_open_moorland_swell_pov.jpg` | Generic Biome POV (Replacement Candidate) | `PLAINS` Tier 4 (`plains_lone_barrow_horizon_pov` slot) | 16 (when `P5-ART-04` restricted) / 19 (full replacement) | **RECOMMEND APPROVAL (AS TIER 4 PLAINS REPLACEMENT)** | `REVIEW REQUIRED` |
| **P5-ART-05** | `swamp_sunken_roots_channel_pov.jpg` | Generic Biome POV | `SWAMP` Tier 4 (`swamp_overgrown_bog`) | 9 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-06** | `hills_windswept_scree_pass_pov.jpg` | Generic Biome POV | `HILLS` Tier 4 (`hills_windswept_scree_pass_pov`) | 20 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-07** | `jungle_briar_thicket_pov.jpg` | Generic Biome POV | `JUNGLE` Tier 4 (`jungle_shadowed_hollow`) | 21 | **RECOMMEND APPROVAL** (`Option A — Keep`) | `REVIEW REQUIRED` |
| **P5-ART-08** | `transition_hills_to_swamp_pov.jpg` | Biome Transition POV | `HILLS -> SWAMP` (`pov_transition_hills_to_swamp`) | 4 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-09** | `transition_swamp_to_plains_pov.jpg` | Biome Transition POV | `SWAMP -> PLAINS` (`pov_transition_swamp_to_plains`) | 6 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-10** | `transition_hills_to_forest_pov.jpg` | Biome Transition POV | `HILLS -> FOREST` (`pov_transition_hills_to_forest`) | 8 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-11** | `transition_plains_to_hills_pov.jpg` | Biome Transition POV | `PLAINS -> HILLS` (`pov_transition_plains_to_hills`) | 3 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-12** | `transition_hills_to_plains_pov.jpg` | Biome Transition POV | `HILLS -> PLAINS` (`pov_transition_hills_to_plains`) | 12 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |
| **P5-ART-13** | `watchpost_9_7_south_river_gorge.jpg` | Landmark Bespoke POV | `[9,7] SOUTH` (`fp_watchpost_9_7_south`) | 1 | **RECOMMEND APPROVAL** | `REVIEW REQUIRED` |

---

## 2. Special Deep-Dive Review — `P5-ART-04` (`plains_lone_barrow_horizon_pov.jpg`)

### 2.1 Spatial & Directional Audit Across All 640 Passable Viewpoints
When used as an unrestricted generic Tier 4 `PLAINS` variant, `plains_lone_barrow_horizon_pov.jpg` resolves on **19 viewpoints across 19 distinct tiles** in **all 4 cardinal directions**:

- **By Sub-Biome / Tile Name:**
  - `Verdant Plains` (**8 viewpoints**): `[5,7] SOUTH`, `[6,6] SOUTH`, `[6,7] NORTH`, `[10,8] EAST`, `[11,8] SOUTH`, `[12,7] EAST`, `[13,7] WEST`, `[13,8] NORTH`
  - `Windblown Heath` (**11 viewpoints**): `[10,6] NORTH`, `[12,1] SOUTH`, `[12,2] NORTH`, `[12,3] EAST`, `[12,4] WEST`, `[12,5] SOUTH`, `[12,6] NORTH`, `[13,2] WEST`, `[13,4] EAST`, `[13,5] EAST`, `[13,6] SOUTH`
- **By Cardinal Direction:**
  - `SOUTH`: 6 (`[5,7]`, `[6,6]`, `[11,8]`, `[12,1]`, `[12,5]`, `[13,6]`)
  - `NORTH`: 5 (`[6,7]`, `[10,6]`, `[12,2]`, `[12,6]`, `[13,8]`)
  - `EAST`: 5 (`[10,8]`, `[12,3]`, `[12,7]`, `[13,4]`, `[13,5]`)
  - `WEST`: 3 (`[12,4]`, `[13,2]`, `[13,7]`)

### 2.2 Findings on Landmark Ambiguity & Travel Repetition
1. **Visual Focal Point:** Although the barrow mound sits on the distant right-center horizon, it has a distinctly shaped stepped stone-and-turf tumulus silhouette that reads inDarkgrid's visual vocabulary as a named destination or dungeon entrance.
2. **Spatial Contradictions During Normal Travel:** Because Tier 4 is omnidirectional, a player walking along the eastern road or western plains sees the exact same burial mound in contradictory directions on adjacent tiles:
   - Standing at `[6,6]` looking `SOUTH` shows the barrow ahead; stepping 1 tile south to `[6,7]` and turning `NORTH` shows the exact same barrow in the opposite direction.
   - Standing at `[12,7]` looking `EAST` shows the barrow to the east; stepping to `[13,7]` and looking `WEST` shows the same barrow to the west.
   - Standing at `[12,5]` looking `SOUTH` vs. `[12,6]` looking `NORTH`.
3. **Biome Fit:** The heather-lined moorland path and brooding sky fit `Windblown Heath` admirably, but using a recognizable burial mound across 19 omnidirectional plains viewpoints creates a false landmark cue.

### 2.3 Evaluation of Options A, B, and C
- **Option A — Keep (Unrestricted Generic Tier 4):** *Not recommended.* Appearing 19 times in all 4 cardinal directions (including opposite facings on adjacent tiles) undermines spatial orientation and makes the barrow feel like a recurring mirage rather than a real place.
- **Option B — Restrict (`RECOMMEND RESTRICTED USE` for `plains_lone_barrow_horizon_pov.jpg`):** *Recommended for the original painting.* The painting is artistically strong and atmospheric. By restricting `plains_lone_barrow_horizon_pov.jpg` to the northeastern `Windblown Heath` barrow basin (`[12,1] SOUTH`, `[12,2] NORTH`, and `[13,2] WEST`, all converging on the `[12,1]–[12,2]` heath ridge), the barrow becomes a coherent regional landmark in `Windblown Heath` without polluting `Verdant Plains`.
- **Option C — Replace (`RECOMMEND REPLACEMENT` for the generic Tier 4 `PLAINS` pool slot):** *Recommended for the remaining 16 generic `PLAINS` viewpoints.* Because restricting `P5-ART-04` alone would reduce the generic `PLAINS` Tier 4 pool from 4 images back to 3 (causing 7 same-tile Tier 4 duplicates), we generated a landmark-free replacement candidate:
  - **Replacement File:** `action-ui-lab/docs/phase-5/art-candidates/plains_open_moorland_swell_pov.jpg` (`P5-ART-04-REPL`, `1376×768` JPEG, `742,566` bytes, SHA-256 `a85aa292751f0b2f84f0df2e444c819ce4fe82629dd15aa577be6e3a5d352a12`, status: `REVIEW REQUIRED`).
  - **Visual Verification of `P5-ART-04-REPL`:** Depicts an eye-level limestone-and-dirt footpath winding through golden-olive tussock grass, low purple-brown heather, shallow rainwater puddles, and gently rolling open moorland swells under an overcast slate sky—with **zero** burial mounds, standing stones, ruins, or trees.
  - **Combined Result (`RESTRICTED_WITH_REPLACEMENT` mode):** Preserves `640/640 PASS` and `0` Tier 4 same-tile duplicates (`64` unique images across the world), keeps `plains_lone_barrow_horizon_pov.jpg` intact on disk for the 3 northeastern `Windblown Heath` viewpoints, and uses `plains_open_moorland_swell_pov.jpg` for the 16 generic `PLAINS` viewpoints. Both remain `REVIEW REQUIRED` until owner sign-off.

---

## 3. Special Deep-Dive Review — `P5-ART-07` (`jungle_briar_thicket_pov.jpg`)

### 3.1 Spatial & Directional Audit Across All 640 Passable Viewpoints
- **Total Viewpoints:** **21 viewpoints across 20 tiles**, exclusively within `Venomous Jungle` (`[8,11..13,13]`).
- **Directional Breakdown:** `NORTH: 4`, `EAST: 7`, `SOUTH: 7`, `WEST: 3`.
- **Role in Pool:** 4th variant in the `JUNGLE` Tier 4 pool alongside `terrain_jungle.webp` (`25` viewpoints), `transition_swamp_to_jungle_pov.jpg` (`23` viewpoints), and `jungle_venomous_trail_pov.jpg` (`15` viewpoints).

### 3.2 Findings on Lighting, Spore Hollow Uniqueness & Biome Fit
1. **Does it make `Spore Hollow [9,11]` less unique?** **No.** Direct visual comparison between `jungle_briar_thicket_pov.jpg` (`P5-ART-07`) and `jungle_venomous_trail_pov.jpg` (used at `Spore Hollow [9,11] SOUTH`) confirms:
   - `jungle_venomous_trail_pov.jpg` features **explicit clusters of glowing yellow-green mushroom caps** growing along the mossy trail edges, directly matching the `[9,11]` Spore Hollow lore (*"Clusters of amber-green fungi pulse softly in the humid gloom"*).
   - `jungle_briar_thicket_pov.jpg` (`P5-ART-07`) contains **zero mushroom caps, fungal stalks, or glowing runes**. Its emerald highlight is a natural shaft of filtered canopy sunlight illuminating wet Boston ferns and hanging moss on the right bank above a dark waterlogged mud-and-stepping-stone channel choked with thorny briars and strangler-fig roots.
2. **Does it fit `Venomous Jungle` and neighboring `SWAMP <-> JUNGLE` transitions?** **Yes.** The dark waterlogged channel, twisted buttress roots, hanging lianas, and humid green-gold canopy light harmonize seamlessly with `terrain_jungle.webp` and `transition_swamp_to_jungle_pov.jpg`.
3. **Frequency:** At 21 viewpoints out of 84 total passable `JUNGLE` viewpoints (25.0%), its distribution is completely balanced with the other 3 variants in the 4-image `JUNGLE` pool and eliminates all 8 `JUNGLE` same-tile duplicates that occur when only 3 variants exist.

### 3.3 Evaluation of Options A, B, and C
- **Option A — Keep (`RECOMMEND APPROVAL`):** **Selected.** `jungle_briar_thicket_pov.jpg` is a natural, non-landmark `Venomous Jungle` interior POV that complements the existing pool, preserves `Spore Hollow [9,11]`'s fungal identity, and grounds medium/small monsters cleanly on its central stepping-stone mud track (`stageFloorY = 83`).
- **Option B — Restrict:** Unnecessary, as the painting contains no unique landmark structure.
- **Option C — Replace:** Unnecessary; the painting meets every artistic and technical criterion.

---

## 4. Verification of the Other 11 Candidate Paintings

All 11 remaining paintings passed full-resolution (`1376×768`) and live in-viewport verification without defects:

1. **`P5-ART-01` — `forest_tangled_canopy_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Confirmed **100% free of the Primeval Black Oak** (`[7,3]`). Shows ordinary gnarled temperate oaks and dark firs arching over a damp leaf-littered dirt track (`stageFloorY = 82`), replacing the old `ancient_oak_7_3_south.jpg` leak across 49 generic Mirkwood viewpoints.
2. **`P5-ART-02` — `forest_misty_birch_hollow_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Fits `Mirkwood Forest` naturally—peeling silver-barked birches, dark conifers, mossy boulders, and cold blue-grey mist along a sunken dirt path (`42` viewpoints, `stageFloorY = 82`).
3. **`P5-ART-03` — `plains_rutted_wagon_track_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Depicts a clearly passable, mud-rutted frontier wagon track with rainwater puddles and wooden fence stakes leading straight ahead (`16` viewpoints, `stageFloorY = 83`).
4. **`P5-ART-05` — `swamp_sunken_roots_channel_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Temperate bog-willows, reeds, and a mud-and-root causeway (`9` viewpoints in `Rotting Fen`, `stageFloorY = 83`), eliminating tropical liana contamination in `SWAMP`.
5. **`P5-ART-06` — `hills_windswept_scree_pass_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Narrow pass through dark slate talus and rust-colored heather in `Raven Crags` (`20` viewpoints, `stageFloorY = 82`).
6. **`P5-ART-08` — `transition_hills_to_swamp_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Foreground (`from_terrain = HILLS`) shows dry grey highland slate slabs and rust heather descending into `to_terrain = SWAMP` (black bog water, reeds, and drowned willows ahead) across `4` viewpoints (`[1,8..3,8] SOUTH`, `[4,9] WEST`).
7. **`P5-ART-09` — `transition_swamp_to_plains_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Foreground (`from_terrain = SWAMP`) shows dark marsh water, reeds, and rotting timber planks rising onto `to_terrain = PLAINS` (golden-green grassland and overcast sky ahead) across `6` viewpoints.
8. **`P5-ART-10` — `transition_hills_to_forest_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Foreground (`from_terrain = HILLS`) shows shattered dark-slate boulders descending directly into `to_terrain = FOREST` (dense Mirkwood firs and mossy oaks ahead) across `8` viewpoints.
9. **`P5-ART-11` — `transition_plains_to_hills_pov.jpg` (`RECOMMEND APPROVAL`)**
   - **Check:** Foreground (`from_terrain = PLAINS`) shows golden-tan grassland tussocks, low heather, and a pebbled dirt path climbing onto `to_terrain = HILLS` (cracked grey slate flagstones and jagged highland crags of Raven Crags ahead) across `3` viewpoints (`[5,6] WEST`, `[5,7] WEST`, `[5,8] WEST`). Note: `FOREST -> HILLS` is separately served by the pre-existing approved painting `transition_forest_to_hills_pov.jpg` across all `6` `FOREST -> HILLS` viewpoints (`[4,1..4,5] WEST`, `[4,5] SOUTH`).
10. **`P5-ART-12` — `transition_hills_to_plains_pov.jpg` (`RECOMMEND APPROVAL`)**
    - **Check:** Foreground (`from_terrain = HILLS`) shows rocky slate ledges descending onto `to_terrain = PLAINS` (wide windswept frontier grasslands ahead) across `12` viewpoints.
11. **`P5-ART-13` — `watchpost_9_7_south_river_gorge.jpg` (`RECOMMEND APPROVAL`)**
    - **Check:** Bespoke Tier 1 POV for `[9,7] SOUTH`. Depicts the broken southern stone parapet of `Bridge East Watchpost` with a rusted garrison pike wedged in the masonry on the left, overlooking the churning rapids of the impassable `Blackwater River` (`[9,8]`) and the southern `Verdant Plains` beyond. Distinct from `[9,7] NORTH` (`watchpost_9_7_river_flank.jpg`).
