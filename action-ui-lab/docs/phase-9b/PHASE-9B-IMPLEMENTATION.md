# DARKGRID — PHASE 9B: IMPLEMENTATION REPORT
## World Expansion: Undead Lands, The Goblin Cave, The Ancient Crypt & Removal of Level 1 Ambush Protection

---

## 1. Executive Summary

Phase 9B expands the active `action-ui-lab` game directly on top of the Phase 9A foundation (`threat_states_landmark_scenes`) without creating any separate prototype or standalone application. It implements five core pillars:

1. **Complete Removal of Level 1 Ambush Protection (Owner Decision #1):**
   - Level 1 heroes now face `AMBUSH` outcomes in every danger zone across the world, identical to Level 2+ heroes.
   - Removed all automatic `AMBUSH -> ENCOUNTER` downgrades for Level 1 characters across `action-ui-lab/server/services/topdown-world-service.js`, `src/domain/encounters/engine.js`, `src/domain/combat/engine.js`, and `src/domain/bounties/board.js`.
   - Enforced the authoritative 2-round server-side Flee lock (`combat_round <= 2`) equally at Level 1.

2. **World Expansion — The Undead Lands (`UNDEAD_LANDS`):**
   - Expanded the eastern sector (`x = 23..29, y = 0..26`, `189` tiles) into a distinct exploration region (`region_key = 'UNDEAD_LANDS'`) with three sub-biomes:
     - **Deadman’s Mire** (`y = 17..26`, southern drowned marshes & necrotic blight-pools)
     - **Ashen Barrowlands** (`y = 8..16`, central burial mounds, standing monoliths & tombstones)
     - **Necropolis Sanctum** (`y = 0..7`, northern obsidian catacomb terrace & crypt bastion)
   - Connected to Goblin Forest across the Blackwater River via three cross-regional entries:
     1. **Southern Entry:** Old Stone Bridge `[19, 25]` -> Abandoned Watchpost `[21, 25]` -> Gallows Crossroads `[25, 23]`
     2. **Central Causeway:** Ravine East Overlook `[22, 15]` -> Weeping Barrow `[26, 15]`
     3. **Northern Ossuary Trail:** Old Log Crossing `[20, 9]` -> Eastbank `[22, 9]` -> Blighted Chapel `[26, 9]`
   - Added **Route D (`ROUTE_D_UNDEAD_SEPULCHER_ROAD`)**, a continuous 34-tile stone flagstone funerary road from Oakhaven `[15, 27]` to The Ancient Crypt `[26, 5]`.

3. **Two New Auto-Opening Major Landmark Scenes:**
   - **The Goblin Cave (`GOBLIN_CAVE`)** at `[9, 12]` in Goblin Forest (`BLACKWOOD_FOREST`), nested beneath the Whispering Crags along a new western spur trail (`[7, 12] -> [8, 12] -> [9, 12]`).
   - **The Ancient Crypt (`ANCIENT_CRYPT`)** at `[26, 5]` in the northern Necropolis Sanctum of the Undead Lands (`UNDEAD_LANDS`), flanked by an impassable Obsidian Crypt Bastion (`x = 25..27, y = 4` and `[25, 5]`, `[27, 5]`).
   - Both scenes auto-open on arrival, temporarily replace the 2D map canvas inside `#fp-viewport`, respect Phase 9A anti-interruption rules (`DISMISS_LANDMARK_SCENE` / **Continue Exploring**), never overlap with active combat, and provide interactive dungeon delve/breach actions (`EXPLORE_GOBLIN_CAVE` and `ENTER_ANCIENT_CRYPT`).

4. **Data-Driven Danger Zone Profiles & Regional Monster Pools:**
   - Non-destructive migration `db/migrations/018_phase9b_world_expansion_undead_lands.sql` seeds 4 new profiles into `danger_zone_profiles`:
     - `GOBLIN_CAVE_APPROACH` (`encounter_rate = 0.28`, `ambush_share = 0.42`)
     - `UNDEAD_BARROW_ROAD` (`encounter_rate = 0.21`, `ambush_share = 0.34`)
     - `UNDEAD_MIRE_OFF_ROAD` (`encounter_rate = 0.30`, `ambush_share = 0.45`)
     - `CRYPT_SEPULCHER_APPROACH` (`encounter_rate = 0.36`, `ambush_share = 0.50`)
   - Added regional monster selection (`selectRegionalEncounterMonster`, `selectUndeadLandsMonster`, `selectGoblinCaveMonster`) so Undead Lands spawns `80%` Undead (`Skeleton`, `Zombie`, `Ghoul`, `Shadow`, `Wight`, `Wraith`, `Skeletal Champion`), `15%` Carrion/Swamp Lurkers, and `5%` Aberrations/Constructs.

5. **Distinct Visual & Atmospheric Identity:**
   - Custom 2D canvas rendering in `action-ui-lab/public/js/world/topdown-renderer.js` for Undead Lands: slate-violet/corpse-green ground tiles, cracked stone flagstone Sepulcher roads, bare dead barrow trees (`drawDeadBarrowTree`), weathered tombstones & glowing corpse-candles (`drawBarrowHeadstone`), bubbling green Necrotic Blight Pools, Obsidian Crypt Bastion walls, and bespoke vector landmarks for all 7 new landmarks.
   - Distinct Major Landmark Scene styling in `action-ui-lab/public/css/world.css` and `action-ui-lab/public/js/world/scene-renderer.js`: warm subterranean torch-amber framing for `GOBLIN_CAVE` (`/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg`) vs. cold necrotic emerald-cyan framing for `ANCIENT_CRYPT` (`/images/terrain/terrain_underground_ruins.webp`).

---

## 2. Modified & Added Files

| File | Summary of Changes |
|---|---|
| `db/migrations/018_phase9b_world_expansion_undead_lands.sql` | Non-destructive SQLite migration seeding `GOBLIN_CAVE_APPROACH`, `UNDEAD_BARROW_ROAD`, `UNDEAD_MIRE_OFF_ROAD`, `CRYPT_SEPULCHER_APPROACH` in `danger_zone_profiles` and `GOBLIN_CAVE`, `ANCIENT_CRYPT` in `landmark_scene_definitions`. |
| `src/domain/encounters/engine.js` | Removed Level 1 Ambush protection in `resolveDetectionAndAmbush`, `getEncounterById`, `ignoreEncounter`, and `investigateEncounter`. |
| `src/domain/combat/engine.js` | Updated `enforceNoAmbushAtLevel1` to be a no-op so Level 1 ambushes retain `is_ambush = 1` and the 2-round server Flee lock. |
| `src/domain/bounties/board.js` | Removed Level 1 exemption in `abandonContract` so Level 1 heroes cannot abandon an active bounty during an ambush. |
| `action-ui-lab/server/services/topdown-world-service.js` | Bumped `TOPDOWN_WORLD_VERSION = 'PHASE_9B_WORLD_EXPANSION'`; added `GOBLIN_CAVE_COORD` (`[9, 12]`), `ANCIENT_CRYPT_COORD` (`[26, 5]`), `ROUTE_D_UNDEAD_SEPULCHER_ROAD`, 7 new landmarks, `UNDEAD_LANDS` region generation (`189` tiles across 3 sub-biomes), 4 new `DANGER_ZONE_PROFILES`, `GOBLIN_CAVE` & `ANCIENT_CRYPT` `LANDMARK_SCENE_DEFINITIONS`, `startLandmarkDungeonEncounter`, `selectRegionalEncounterMonster`, and removed Level 1 ambush protection in `computePhase9ThreatDecision`. |
| `action-ui-lab/server/controllers/combat-controller.js` | Added `EXPLORE_GOBLIN_CAVE` (`DELVE_GOBLIN_CAVE`) and `ENTER_ANCIENT_CRYPT` (`BREACH_ANCIENT_CRYPT`) action handlers. |
| `action-ui-lab/server/controllers/adventure-scenario-controller.js` | Added Lab Director scenarios `GOBLIN_CAVE`, `UNDEAD_LANDS`, `DEADMANS_MIRE`, and `ANCIENT_CRYPT`. |
| `action-ui-lab/server/services/viewport-scene-service.js` | Mapped `GOBLIN_CAVE`, `ANCIENT_CRYPT`, `UNDEAD_RUINS`, and `NECROTIC_POOL` to verified environment artwork on disk. |
| `action-ui-lab/public/js/world/scene-renderer.js` | Rendered Major Landmark Scene overlays and dismissed compact bars for `GOBLIN_CAVE` and `ANCIENT_CRYPT`. |
| `action-ui-lab/public/js/world/topdown-renderer.js` | Implemented Undead Lands ground palette, stone flagstone Sepulcher Road, `drawDeadBarrowTree`, `drawBarrowHeadstone`, necrotic blight pools, crypt walls, 7 new landmark structures, and Region Map `[M]` overview rendering. |
| `action-ui-lab/public/js/ui/modals.js` | Updated Region Map `[M]` modal and Lab Director `[G]` modal with Goblin Cave, Undead Lands, Sepulcher Road, and Ancient Crypt status & controls. |
| `action-ui-lab/public/css/world.css` | Added `.is-goblin-cave-scene` / `.is-goblin-cave-card` and `.is-ancient-crypt-scene` / `.is-ancient-crypt-card` thematic styling. |
| `action-ui-lab/tests/phase9b-world-expansion.test.js` | Comprehensive automated test suite covering Level 1 Ambush removal, Undead Lands world integrity, Goblin Cave scene/delve, and Ancient Crypt scene/breach. |
| `action-ui-lab/tests/phase9b-visual-qa.js` | Headless Chrome CDP Visual QA script verifying DOM states and capturing 8 screenshots into `action-ui-lab/docs/screenshots/phase-9b/`. |
