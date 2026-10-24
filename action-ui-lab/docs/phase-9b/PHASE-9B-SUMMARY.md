# DARKGRID — PHASE 9B: EXECUTIVE SUMMARY REPORT
## World Expansion: Undead Lands + Goblin Cave + Ancient Crypt

---

## 1. What Was Built in Phase 9B

Phase 9B expands the active `action-ui-lab` top-down world from a single-region forest expedition into a multi-region dark fantasy world with **four auto-opening Major Landmark Scenes**, **nine data-driven Danger Zones**, and **unforgiving Level 1 Ambush parity**:

1. **Level 1 Ambush Protection Removed Everywhere:**
   - Level 1 heroes can now be ambushed on any hostile tile in Goblin Forest or the Undead Lands.
   - Ambushes at Level 1 enter `IN_COMBAT` immediately (skipping the `ENCOUNTER` Avoid screen) and enforce the 2-round server-side Flee lock (`Rounds 1 & 2` locked, `Round 3+` unlocked).
   - Ranger Scouting (`+4` to perception rolls and `-35%` ambush share) remains the primary tactical counter to ambushes from Level 1 onward.

2. **Two New Major Landmark Scenes (`GOBLIN_CAVE` & `ANCIENT_CRYPT`):**
   - **The Goblin Cave (`[9, 12]` in Goblin Forest):**
     - Auto-opens on arrival with `/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg`.
     - Actions: **Delve into the Cave Mouth** (`EXPLORE_GOBLIN_CAVE`) and **Continue Exploring** (`DISMISS_LANDMARK_SCENE`).
   - **The Ancient Crypt (`[26, 5]` in Undead Lands):**
     - Auto-opens on arrival with `/images/terrain/terrain_underground_ruins.webp`.
     - Actions: **Breach the Sepulcher Vault** (`ENTER_ANCIENT_CRYPT`) and **Continue Exploring** (`DISMISS_LANDMARK_SCENE`).
   - Both follow Phase 9A anti-interruption rules: dismissing the scene restores the 2D map on the same tile without re-popping until the hero leaves and re-enters the tile, and active combat immediately suppresses the landmark scene overlay.

3. **The Undead Lands (`UNDEAD_LANDS`, `x = 23..29, y = 0..26`):**
   - A 189-tile eastern region divided into **Deadman’s Mire** (`y = 17..26`), **Ashen Barrowlands** (`y = 8..16`), and **Necropolis Sanctum** (`y = 0..7`).
   - Features **Route D (Undead Sepulcher Road)**, 5 minor undead landmarks (`GALLOWS_CROSSROADS` `[25, 23]`, `DROWNED_OSSUARY` `[26, 19]`, `WEEPING_CAIRN` `[26, 15]`, `BLIGHTED_CHAPEL` `[26, 9]`, `CRYPT_APPROACH` `[26, 6]`), 1 major landmark (`ANCIENT_CRYPT` `[26, 5]`), custom undead monster pools (`80%` Undead), and a distinct necrotic visual identity on both the 2D map canvas and first-person viewport.

---

## 2. Verification Overview

- **Automated Test Suites:** `288 / 288` tests passing (`0` failures) across `phase9b-world-expansion.test.js`, `phase9a-threat-and-landmarks.test.js`, `topdown-experiment.test.js`, `phase8-world-and-systems.test.js`, `monster-artwork.test.js`, `monster-scaling.test.js`, and `npm test` (`tests/*.test.js`).
- **Headless Chrome Visual QA:** `8 / 8` Phase 9B screenshots captured (`1440×900`) in `action-ui-lab/docs/screenshots/phase-9b/` with `0` console errors and `0` page exceptions.
