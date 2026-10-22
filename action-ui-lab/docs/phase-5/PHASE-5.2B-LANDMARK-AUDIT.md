# DARKGRID ADVENTURE LAB — PHASE 5.2B LANDMARK ARTWORK AUDIT

**Phase:** 5.2b — Independent Pre-Merge Consistency Audit & Targeted Corrections  
**Branch / Worktree:** `phase_5_1_review`  
**Investigation B Classification:** **`DOCUMENTATION ERROR` (in `PHASE-5.1-WORLD-VERIFICATION.md` prose shorthand) / `NO ISSUE FOUND` (in actual resolver code or paintings)**

---

## 1. Executive Conclusion

1. **Did either Primeval Black Oak (`[7,3]`) or Deadman's Mire (`[4,11]`) suffer an artwork regression between Phase 5.1 and Phase 5.2?**
   - **No.** Direct comparison of `git show ea71471:action-ui-lab/scene-catalog.js` (Phase 5 commit), Phase 5.1, and Phase 5.2 proves that the `DEFAULT_PERSPECTIVE_VIEWS` Tier 1 (`EXACT_POV`) entries for `[7,3]` and `[4,11]` have **not changed by a single character** across Phase 5, Phase 5.1, and Phase 5.2.
   - All 8 landmark directional viewpoints (`[7,3]` N/E/S/W and `[4,11]` N/E/S/W) resolve at **Tier 1 (`EXACT_POV`, Grade A)** via explicit coordinate-locked entries in `DEFAULT_PERSPECTIVE_VIEWS`. Generic Tier 4 biome pools **never** override Tier 1 landmark rules.
2. **Why did `PHASE-5.1-WORLD-VERIFICATION.md` list filenames like `ancient_oak_7_3_north.jpg`, `ancient_oak_7_3_east.jpg`, `ancient_oak_7_3_west.jpg`, and `mire_4_11_north/east/south/west.jpg`?**
   - Those 7 filenames **never existed on disk or in Git history** (as confirmed by `PHASE-5-ART-INVENTORY.md` lines 60 and 63 in commit `ea71471` and `git log --all`).
   - In `PHASE-5.1-WORLD-VERIFICATION.md`, the author wrote shorthand filenames derived from the `view_key` identifiers (`fp_ancient_oak_7_3_north/east/south/west` and `fp_deadmans_mire_4_11_north/east/south/west`) instead of the actual `image_path` values stored in `DEFAULT_PERSPECTIVE_VIEWS`.
   - In `PHASE-5.2-WORLD-AUDIT.md`, the report documented the **actual `image_path` URLs** resolved by `DEFAULT_PERSPECTIVE_VIEWS`.

---

## 2. Primeval Black Oak `[7,3]` (`Heart of the Mirkwood`) — 4-Direction Audit

**Tile Metadata:** `[7,3]`, `name: "Heart of the Mirkwood"`, `terrain: "FOREST"`, `feature: "ANCIENT_OAK"`, `isPassable: true`.  
**Neighboring Tiles:** `NORTH: [7,2]` (`Mirkwood Forest`, passable `FOREST`), `EAST: [8,3]` (`Mirkwood Forest`, passable `FOREST`), `SOUTH: [7,4]` (`Mirkwood Forest`, passable `FOREST`), `WEST: [6,3]` (`Mirkwood Forest`, passable `FOREST`).

| Direction | Resolver Tier & Grade | Matching Rule (`view_key`) | Actual `imageUrl` (Phase 5, 5.1 & 5.2 Code) | Visual Content & Geographic Fit | Phase 5.2b Screenshot |
|---|---|---|---|---|---|
| **`NORTH`** | **Tier 1 (`EXACT_POV`)**, Grade `A` | `fp_ancient_oak_7_3_north` (`lines 1539–1553`) | `/lab-assets/images/terrain/forest_ancient_oak.jpg` | Colossal gnarled Primeval Black Oak with amber-glowing bark fissures and overarching root archway in the center (`POI: Inspect Ancient Oak`). Used **exclusively** at `7,3:NORTH` (`1` viewpoint worldwide). | `01_oak_7_3_north_1920x1080.png`, `21_oak_7_3_north_1366x768.png` |
| **`EAST`** | **Tier 1 (`EXACT_POV`)**, Grade `A` | `fp_ancient_oak_7_3_east` (`lines 1603–1617`) | `/lab-assets/images/terrain/forest_pine_ravine.jpg` | Looking East from the Primeval Black Oak hollow into a shadowed pine-and-boulder ravine descending toward eastern Mirkwood (`[8,3]`). | `02_oak_7_3_east_1920x1080.png` |
| **`SOUTH`** | **Tier 1 (`EXACT_POV`)**, Grade `A` | `fp_ancient_oak_7_3_south` (`lines 1555–1569`) | `/lab-assets/images/perspective/ancient_oak_7_3_south.jpg` | 180° reverse view looking South from directly beneath the massive moss-draped root arch of the Ancient Oak back down the woodland trail toward `[7,4]`. Used **exclusively** at `7,3:SOUTH` (`1` viewpoint worldwide). | `03_oak_7_3_south_1920x1080.png` |
| **`WEST`** | **Tier 1 (`EXACT_POV`)**, Grade `A` | `fp_ancient_oak_7_3_west` (`lines 1619–1633`) | `/images/terrain/terrain_forest.webp` | Looking West from beneath the Primeval Black Oak into sprawling moss-draped trunks and ground mist toward western Mirkwood (`[6,3]`). | `04_oak_7_3_west_1920x1080.png` |

### 2.1 Verification of Zero Landmark Leakage & 4-Way Approaches Around `[7,3]`
- **4-Way Approaches Toward `[7,3]`:** Stepping onto any of the 4 adjacent tiles and facing `[7,3]` (`[7,4] NORTH`, `[7,2] SOUTH`, `[6,3] EAST`, `[8,3] WEST`) resolves the bespoke Tier 1 (`EXACT_POV`, Grade `A`) approach painting `/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg`, which shows the Primeval Black Oak looming ahead through the mist.
- **Zero Generic Leakage:** With `P5-ART-01` (`forest_tangled_canopy_pov.jpg`) permanently activated in the `FOREST` Tier 4 pool, neither `forest_ancient_oak.jpg` nor `ancient_oak_7_3_south.jpg` ever appears on any generic `FOREST` tile (`0` leaks across all 640 viewpoints).

---

## 3. Deadman's Mire `[4,11]` (`Sunken Temple Ruins`) — 4-Direction Audit

**Tile Metadata:** `[4,11]`, `name: "Deadman's Mire"`, `terrain: "SWAMP"`, `feature: "SUNK_RUIN"`, `isPassable: true`.  
**Neighboring Tiles:** `NORTH: [4,10]` (`Rotting Fen`, passable `SWAMP`), `EAST: [5,11]` (`Rotting Fen`, passable `SWAMP`), `SOUTH: [4,12]` (`Rotting Fen`, passable `SWAMP`), `WEST: [3,11]` (`Rotting Fen`, passable `SWAMP`).

| Direction | Resolver Tier & Grade | Matching Rule (`view_key`) | Actual `imageUrl` (Phase 5, 5.1 & 5.2 Code) | Visual Content & Geographic Fit | Phase 5.2b Screenshot |
|---|---|---|---|---|---|
| **`NORTH`** | **Tier 1 (`EXACT_POV`)**, Grade `A` | `fp_deadmans_mire_4_11_north` (`lines 1653–1667`) | `/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg` | Standing on flooded temple flagstones directly before the sunken Gothic stone arches and tilted carved pillars of Deadman's Mire (`POI: Inspect Sunken Ruins`). Used **exclusively** at `4,11:NORTH` (`1` viewpoint worldwide). | `05_mire_4_11_north_1920x1080.png`, `22_mire_4_11_north_1366x768.png` |
| **`EAST`** | **Tier 1 (`EXACT_POV`)**, Grade `A` | `fp_deadmans_mire_4_11_east` (`lines 1685–1699`) | `/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg` | Looking East from the drowned temple ruins along a half-sunken timber plank causeway with iron lantern posts winding toward the central Rotting Fen (`[5,11]`). | `06_mire_4_11_east_1920x1080.png` |
| **`SOUTH`** | **Tier 1 (`EXACT_POV`)**, Grade `A` | `fp_deadmans_mire_4_11_south` (`lines 1669–1683`) | `/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg` | Looking South from the sunken flagstones along a decaying boardwalk past outer drowned colonnades into the southern mire (`[4,12]`). | `07_mire_4_11_south_1920x1080.png` |
| **`WEST`** | **Tier 1 (`EXACT_POV`)**, Grade `A` | `fp_deadmans_mire_4_11_west` (`lines 1701–1715`) | `/images/terrain/terrain_swamp.webp` | Looking West from the sunken masonry into stagnant black bog channels and drowned cypress roots toward western Rotting Fen (`[3,11]`). | `08_mire_4_11_west_1920x1080.png` |

### 3.1 Verification of Zero Landmark Leakage & 4-Way Approaches Around `[4,11]`
- **4-Way Approaches Toward `[4,11]`:** All 4 adjacent tiles facing `[4,11]` (`[4,10] SOUTH`, `[3,11] EAST`, `[5,11] WEST`, `[4,12] NORTH`) resolve Tier 1 (`EXACT_POV`, Grade `A`) `/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg`.
- **Zero Generic Leakage:** Neither `deadmans_mire_4_11_ruins.jpg` nor `swamp_approach_mire_ruins.jpg` is in the generic Tier 4 `SWAMP` pool; neither ever leaks onto non-adjacent marsh tiles.

---

## 4. Scene Resolver Precedence Verification

In `resolveSceneModeC` (`action-ui-lab/scene-catalog.js`), resolution strictly enforces the 4-tier hierarchy:

```text
Tier 1: EXACT_POV (DEFAULT_PERSPECTIVE_VIEWS — exact tile_x, tile_y, facing)
  ↓
Tier 2: LANDMARK_DIRECTIONAL_POV (DEFAULT_POV_CONTEXT_RULES where pov_tier === 2)
  ↓
Tier 3: SUBBIOME_CONTEXT_POV / BARRIER / BIOME_TRANSITION (DEFAULT_POV_CONTEXT_RULES where pov_tier === 3)
  ↓
Tier 4: GENERIC_BIOME_POV_POOL (DEFAULT_SCENE_VARIANTS / CANDIDATE_TIER4_POOLS)
```

Because all 4 directions of `[7,3]` and all 4 directions of `[4,11]` are explicitly registered in `DEFAULT_PERSPECTIVE_VIEWS` (`Tier 1: EXACT_POV`), they always match at Tier 1 (`Grade A`) and are never overridden by Tier 3 or Tier 4 rules.
