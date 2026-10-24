# DARKGRID — PHASE 9B: AUTOMATED TEST REPORT
## Verification of Phase 9B World Expansion, Level 1 Ambush Parity & Full Regression Suites

---

## 1. Test Execution Summary

| Test Suite | Command | Tests | Passed | Failed | Status |
|---|---|---:|---:|---:|---|
| **Phase 9B World Expansion & Level 1 Ambush** | `node --test action-ui-lab/tests/phase9b-world-expansion.test.js` | `4` | `4` | `0` | **PASS** |
| **Phase 9A Threat States, Ambush & Landmarks** | `node --test action-ui-lab/tests/phase9a-threat-and-landmarks.test.js` | `8` | `8` | `0` | **PASS** |
| **Phase 8 Top-Down Exploration & 7C Parity** | `node --test action-ui-lab/tests/topdown-experiment.test.js` | `9` | `9` | `0` | **PASS** |
| **Phase 8 World Architecture & Systems** | `node --test action-ui-lab/tests/phase8-world-and-systems.test.js` | `7` | `7` | `0` | **PASS** |
| **Monster Artwork & PF1e Size Scaling** | `node --test action-ui-lab/tests/monster-artwork.test.js action-ui-lab/tests/monster-scaling.test.js` | `16` | `16` | `0` | **PASS** |
| **Core Domain, Combat, Security & Persistence** | `npm test` (`tests/*.test.js`) | `244` | `244` | `0` | **PASS** |
| **Headless Chrome Visual QA (`phase9b-visual-qa.js`)** | `node action-ui-lab/tests/phase9b-visual-qa.js` | `8` | `8` | `0` | **PASS** |
| **TOTAL AUTOMATED VERIFICATIONS** | | **`296`** | **`296`** | **`0`** | **100% PASS** |

---

## 2. Detailed Coverage in `phase9b-world-expansion.test.js`

1. **Test 1 — Level 1 Ambush Protection Removed Everywhere:**
   - Verifies `computePhase9ThreatDecision` at Level 1 across `GOBLIN_FOREST_ROAD` (`[15, 22]`), `GOBLIN_CAVE_APPROACH` (`[8, 12]`), `UNDEAD_BARROW_ROAD` (`[25, 21]`), `UNDEAD_MIRE_OFF_ROAD` (`[27, 18]`), and `CRYPT_SEPULCHER_APPROACH` (`[26, 6]`) returns `outcome = 'AMBUSH'` with `level1AmbushProtected = false`.
   - Verifies 500-trial Monte Carlo simulation at Level 1 (`heroLevel = 1`, `FIGHTER`) on Route A produces `avgAmbushes > 1.0` and `level1AmbushProtections === 0`.
   - Verifies live HTTP `MOVE` at Level 1 into an `AMBUSH` enters `IN_COMBAT` immediately, sets `isAmbush = true`, `fleeLocked = true`, `ambushFleeLockedRoundsRemaining = 2`, blocks `FLEE` on Rounds 1 & 2 (`HTTP 400`), and unlocks `FLEE` on Round 3+.

2. **Test 2 — World Expansion & Undead Lands Identity:**
   - Verifies `TOPDOWN_WORLD_VERSION === 'PHASE_9B_WORLD_EXPANSION'` and `900` total tiles (`711` `BLACKWOOD_FOREST` + `189` `UNDEAD_LANDS`).
   - Verifies the 3 passable sub-biomes inside `UNDEAD_LANDS`: `ASHEN_BARROWLANDS`, `DEADMANS_MIRE`, and `NECROPOLIS_SANCTUM`.
   - Verifies `ROUTE_D_UNDEAD_SEPULCHER_ROAD` is a continuous 1-tile Manhattan path of passable tiles from Oakhaven `[15, 27]` through Old Stone Bridge `[19, 25]` and Gallows Crossroads `[25, 23]` to The Ancient Crypt `[26, 5]`.
   - Verifies `resolveTileDangerZone` resolves `UNDEAD_BARROW_ROAD`, `UNDEAD_MIRE_OFF_ROAD`, `CRYPT_SEPULCHER_APPROACH`, and `GOBLIN_CAVE_APPROACH` accurately.
   - Verifies `selectRegionalEncounterMonster` in `UNDEAD_LANDS` spawns predominantly Undead (`>= 70%` across 40 samples).

3. **Test 3 — The Goblin Cave (`[9, 12]`) Major Landmark Scene & Cave Delve:**
   - Verifies stepping onto `[9, 12]` never triggers a random step encounter (`state.encounter === null`) and auto-opens `state.landmarkScene` (`sceneKey = 'GOBLIN_CAVE'`, `isActive = true`, `artworkUrl = '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg'`, actions `['DELVE_GOBLIN_CAVE', 'CONTINUE_EXPLORING']`).
   - Verifies `DISMISS_LANDMARK_SCENE` (**Continue Exploring**) closes the scene on `[9, 12]`, and stepping off to `[8, 12]` and back onto `[9, 12]` re-opens it.
   - Verifies `EXPLORE_GOBLIN_CAVE` (**Delve into the Cave Mouth**) initiates a cave delve encounter and suppresses `state.landmarkScene = null` so Combat and Landmark Scene never overlap.

4. **Test 4 — The Ancient Crypt (`[26, 5]`) Major Landmark Scene & Crypt Breach:**
   - Verifies stepping north from Sepulcher Terrace `[26, 6]` onto The Ancient Crypt `[26, 5]` auto-opens `state.landmarkScene` (`sceneKey = 'ANCIENT_CRYPT'`, `isActive = true`, `artworkUrl = '/images/terrain/terrain_underground_ruins.webp'`, actions `['ENTER_ANCIENT_CRYPT', 'CONTINUE_EXPLORING']`).
   - Verifies `DISMISS_LANDMARK_SCENE` closes the scene on `[26, 5]`, and stepping south to `[26, 6]` and back north to `[26, 5]` re-opens it.
   - Verifies `ENTER_ANCIENT_CRYPT` (**Breach the Sepulcher Vault**) initiates an undead crypt guardian encounter and sets `state.landmarkScene = null`.
