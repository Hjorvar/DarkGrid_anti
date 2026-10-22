# DARKGRID ADVENTURE LAB — PHASE 5.2B REGRESSION & BROWSER VERIFICATION RESULTS

**Phase:** 5.2b — Independent Pre-Merge Consistency Audit & Targeted Corrections  
**Branch / Worktree:** `phase_5_1_review`  
**Automated Test Status:** **`112 / 112 PASS across 8 test suites` (`0` failures, `0` skipped)**  
**640-Viewpoint World Audit Status:** **`640 / 640 PASS` (`64` unique environment paintings, `0` broken references)**

---

## 1. Full 640-Viewpoint World Integrity Recheck (`verify-art-approval.js`)

Command executed:
```bash
node action-ui-lab/scripts/verify-art-approval.js
```

| Metric | Target | Actual (Phase 5.2b Recheck) | Status |
|---|---|---|---|
| **Passable directional viewpoints** | `640 / 640 PASS` | **`640 / 640 PASS`** (`A=57`, `B=160`, `C=423`, `D=0`) | **PASS** |
| **`BROKEN_IMAGE_REFERENCE`** | `0` | **`0`** | **PASS** |
| **`WRONG_SCENE`** | `0` | **`0`** | **PASS** |
| **`VALID_APPROVED_FALLBACK` (awaiting art)** | `0` | **`0`** | **PASS** |
| **`CANDIDATE_ART_PENDING`** | `0` | **`0`** | **PASS** |
| **`EXACT_DUPLICATE_TIER4`** | `0` | **`0`** (`10` acceptable Tier 3 corner barrier/transition viewpoints) | **PASS** |
| **Unique environment paintings** | `64` | **`64`** | **PASS** |
| **`P5-ART-04` restricted viewpoints** | Exactly `3` | **`3`** (`12,1:SOUTH`, `12,2:NORTH`, `13,2:WEST`) | **PASS** |
| **`P5-ART-04-REPL` viewpoints** | Exactly `16` | **`16`** (`12,3:S`, `13,3:N`, `13,4:S`, `12,5:E`, `13,5:N`, `6,6:S`, `10,6:E`, `12,6:W`, `13,6:S`, `5,7:E`, `6,7:N`, `11,7:S`, `12,7:E`, `13,7:W`, `10,8:E`, `11,8:N`) | **PASS** |

---

## 2. Automated Test Suite Execution (`112 / 112 PASS`)

Command executed:
```bash
node --test action-ui-lab/tests/*.test.js
```

| # | Test Suite File | Total Tests | Passed | Failed | Duration |
|---|---|---:|---:|---:|---:|
| 1 | `action-ui-lab/tests/action-lab.test.js` | `32` | `32` | `0` | `3,571 ms` |
| 2 | `action-ui-lab/tests/world-travel.test.js` | `16` | `16` | `0` | `3,564 ms` |
| 3 | `action-ui-lab/tests/player-ui.test.js` | `13` | `13` | `0` | `593 ms` |
| 4 | `action-ui-lab/tests/monster-scaling.test.js` | `11` | `11` | `0` | `348 ms` |
| 5 | `action-ui-lab/tests/monster-artwork.test.js` | `5` | `5` | `0` | `1,069 ms` |
| 6 | `action-ui-lab/tests/monster-integration.test.js` | `8` | `8` | `0` | `1,412 ms` |
| 7 | `action-ui-lab/tests/phase-5-world.test.js` | `10` | `10` | `0` | `5,865 ms` |
| 8 | `action-ui-lab/tests/independent-qa.test.js` | `17` | `17` | `0` | `8,944 ms` |
| **TOTAL** | **8 Test Suites** | **`112`** | **`112`** | **`0`** | **`25,367 ms`** |

---

## 3. Real Headless Chromium Verification (`capture-phase-5-2b-screenshots.js`)

Command executed:
```bash
node action-ui-lab/scripts/capture-phase-5-2b-screenshots.js
```

### 3.1 Browser Telemetry & Layout Gate
- **Uncaught JavaScript exceptions:** `0`
- **Console errors:** `0`
- **Failed asset requests (HTTP >= 400):** `0`
- **Desktop (`1920 × 1080`) & Compact Laptop (`1366 × 768`) Horizontal Overflow:** `0 px`
- **Panel Overlap (`#fp-viewport` vs `#dm-action-deck-card` / `#dm-movement-deck`):** `false` (`0` overlaps)

### 3.2 Monster Grounding on Investigated Landmark & Transition Scenes (`1920 × 1080`)

| Monster | Viewpoint | Scene Painting (`imageUrl`) | Actor Height (`px`) | Stage Floor Anchor (`actorBottomRatio`) | Grounding Rig Present | Status |
|---|---|---|---:|---:|---|---|
| **Giant Spider** | `[7,3] NORTH` (Primeval Black Oak) | `/lab-assets/images/terrain/forest_ancient_oak.jpg` | `284 px` | `0.935` | `true` | **PASS** |
| **Ghoul** | `[4,11] NORTH` (Deadman's Mire) | `/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg` | `342 px` | `0.935` | `true` | **PASS** |
| **Wolf** | `[5,7] WEST` (`P5-ART-11` Plains → Hills) | `/lab-assets/images/perspective/transition_plains_to_hills_pov.jpg` | `314 px` | `0.935` | `true` | **PASS** |

### 3.3 Complete Inventory of Phase 5.2b Screenshots (`23` Files)

Saved under `action-ui-lab/docs/phase-5/screenshots/phase-5-2b/`:

| # | Filename | Investigated Area | Viewpoint | Resolution |
|---|---|---|---|---|
| 01 | `01_oak_7_3_north_1920x1080.png` | Primeval Black Oak — `NORTH` (`forest_ancient_oak.jpg`) | `7,3:NORTH` | `1920×1080` |
| 02 | `02_oak_7_3_east_1920x1080.png` | Primeval Black Oak — `EAST` (`forest_pine_ravine.jpg`) | `7,3:EAST` | `1920×1080` |
| 03 | `03_oak_7_3_south_1920x1080.png` | Primeval Black Oak — `SOUTH` (`ancient_oak_7_3_south.jpg`) | `7,3:SOUTH` | `1920×1080` |
| 04 | `04_oak_7_3_west_1920x1080.png` | Primeval Black Oak — `WEST` (`terrain_forest.webp`) | `7,3:WEST` | `1920×1080` |
| 05 | `05_mire_4_11_north_1920x1080.png` | Deadman's Mire — `NORTH` (`deadmans_mire_4_11_ruins.jpg`) | `4,11:NORTH` | `1920×1080` |
| 06 | `06_mire_4_11_east_1920x1080.png` | Deadman's Mire — `EAST` (`swamp_willow_boardwalk_pov.jpg`) | `4,11:EAST` | `1920×1080` |
| 07 | `07_mire_4_11_south_1920x1080.png` | Deadman's Mire — `SOUTH` (`swamp_approach_mire_ruins.jpg`) | `4,11:SOUTH` | `1920×1080` |
| 08 | `08_mire_4_11_west_1920x1080.png` | Deadman's Mire — `WEST` (`terrain_swamp.webp`) | `4,11:WEST` | `1920×1080` |
| 09 | `09_p5_art_11_plains_to_hills_5_6_west_1920x1080.png` | `P5-ART-11` (`PLAINS → HILLS`, `transition_plains_to_hills_pov.jpg`) | `5,6:WEST` | `1920×1080` |
| 10 | `10_p5_art_11_plains_to_hills_5_7_west_1920x1080.png` | `P5-ART-11` (`PLAINS → HILLS`, `transition_plains_to_hills_pov.jpg`) | `5,7:WEST` | `1920×1080` |
| 11 | `11_p5_art_11_plains_to_hills_5_8_west_1920x1080.png` | `P5-ART-11` (`PLAINS → HILLS`, `transition_plains_to_hills_pov.jpg`) | `5,8:WEST` | `1920×1080` |
| 12 | `12_forest_to_hills_4_3_west_1920x1080.png` | Pre-Existing `FOREST → HILLS` (`transition_forest_to_hills_pov.jpg`) | `4,3:WEST` | `1920×1080` |
| 13 | `13_forest_to_hills_4_5_south_1920x1080.png` | Pre-Existing `FOREST → HILLS` (`transition_forest_to_hills_pov.jpg`) | `4,5:SOUTH` | `1920×1080` |
| 14 | `14_generic_forest_5_1_south_1920x1080.png` | Representative Generic `FOREST` (`forest_tangled_canopy_pov.jpg`) | `5,1:SOUTH` | `1920×1080` |
| 15 | `15_generic_plains_12_3_south_1920x1080.png` | Representative Generic `PLAINS` (`plains_open_moorland_swell_pov.jpg`) | `12,3:SOUTH` | `1920×1080` |
| 16 | `16_generic_hills_2_1_west_1920x1080.png` | Representative Generic `HILLS` (`hills_windswept_scree_pass_pov.jpg`) | `2,1:WEST` | `1920×1080` |
| 17 | `17_generic_swamp_1_9_south_1920x1080.png` | Representative Generic `SWAMP` (`swamp_sunken_roots_channel_pov.jpg`) | `1,9:SOUTH` | `1920×1080` |
| 18 | `18_monster_oak_7_3_north_giant_spider_1920x1080.png` | Monster at Primeval Black Oak — **Giant Spider** | `7,3:NORTH` | `1920×1080` |
| 19 | `19_monster_mire_4_11_north_ghoul_1920x1080.png` | Monster at Deadman's Mire — **Ghoul** | `4,11:NORTH` | `1920×1080` |
| 20 | `20_monster_p5_art_11_5_7_west_wolf_1920x1080.png` | Monster on `P5-ART-11` (`PLAINS → HILLS`) — **Wolf** | `5,7:WEST` | `1920×1080` |
| 21 | `21_oak_7_3_north_1366x768.png` | Compact Laptop `1366×768` — Primeval Black Oak `NORTH` | `7,3:NORTH` | `1366×768` |
| 22 | `22_mire_4_11_north_1366x768.png` | Compact Laptop `1366×768` — Deadman's Mire `NORTH` | `4,11:NORTH` | `1366×768` |
| 23 | `23_p5_art_11_5_6_west_1366x768.png` | Compact Laptop `1366×768` — `P5-ART-11` `PLAINS → HILLS` | `5,6:WEST` | `1366×768` |
