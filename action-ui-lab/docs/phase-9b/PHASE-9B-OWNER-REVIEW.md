# DARKGRID — PHASE 9B: OWNER REVIEW & ARCHITECTURAL DECISIONS
## Hardcoded vs. Data-Driven / Future-Ready Breakdown & Next-Phase Proposals

---

## 1. Owner Decisions Implemented in Phase 9B

| # | Owner Requirement | Implementation Status | Details |
|---|---|---|---|
| **1** | **Remove all Level 1 Ambush Protection** | **COMPLETE** | Removed `heroLevel <= 1` ambush downgrades in `topdown-world-service.js`, `src/domain/encounters/engine.js`, `src/domain/combat/engine.js`, and `src/domain/bounties/board.js`. Level 1 heroes face full Ambush rates and the 2-round Flee lock everywhere. |
| **2** | **Preserve Phase 9A Encounter / Ambush Pacing** | **COMPLETE** | Goblin Forest danger zones (`OAKHAVEN_SAFE`, `GOBLIN_FOREST_ROAD`, `GOBLIN_FOREST_OFF_ROAD`, `GOBLIN_HUNTING_GROUNDS`, `STRONGHOLD_APPROACH`) retain their exact Phase 9A rates (`4–6` threat events per Oakhaven -> Stronghold trip). |
| **3** | **Add Goblin Cave & Ancient Crypt Major Landmark Scenes** | **COMPLETE** | Added `GOBLIN_CAVE` at `[9, 12]` and `ANCIENT_CRYPT` at `[26, 5]` as auto-opening Major Landmark Scenes with full anti-interruption parity and interactive delve/breach combat encounters. |
| **4** | **Undead Lands Distinct Regional Identity** | **COMPLETE** | Created `UNDEAD_LANDS` (`x = 23..29, y = 0..26`, `189` tiles) with 3 sub-biomes, stone flagstone Sepulcher Road, dead barrow trees, tombstones, corpse-candles, necrotic blight pools, undead monster pools, and 3 danger zones. |
| **5** | **Keep Work Inside Active `action-ui-lab` Game** | **COMPLETE** | Built directly on top of Phase 9A in `action-ui-lab` with non-destructive SQLite migration `018_phase9b_world_expansion_undead_lands.sql`. |

---

## 2. Hardcoded / Fixed vs. Data-Driven / Future-Ready

### A. Data-Driven & Future-Ready Systems
1. **`danger_zone_profiles` SQLite Table:**
   - All 9 danger zones (`OAKHAVEN_SAFE`, `GOBLIN_FOREST_ROAD`, `GOBLIN_FOREST_OFF_ROAD`, `GOBLIN_HUNTING_GROUNDS`, `GOBLIN_CAVE_APPROACH`, `STRONGHOLD_APPROACH`, `UNDEAD_BARROW_ROAD`, `UNDEAD_MIRE_OFF_ROAD`, `CRYPT_SEPULCHER_APPROACH`) are stored in SQLite with configurable `encounter_rate`, `ambush_share`, `min_steps_between_combats`, `streak_dampening_per_event`, and `monster_pool_json`.
2. **`landmark_scene_definitions` SQLite Table:**
   - All 4 active auto-opening Major Landmark Scenes (`OAKHAVEN`, `GOBLIN_STRONGHOLD`, `GOBLIN_CAVE`, `ANCIENT_CRYPT`) and 2 future templates (`ANCIENT_DUNGEON_ENTRANCE`, `SUNKEN_CRYPT_ENTRANCE`) are persisted in SQLite with data-driven `title`, `subtitle`, `description`, `artwork_url`, `auto_open_on_arrival`, and `actions_json`.
3. **Anti-Interruption Session Tracking (`landmarkVisitTracker`):**
   - Automatically handles any tile where `resolveLandmarkSceneState` returns `autoOpenOnArrival = true`, ensuring **Continue Exploring** (`DISMISS_LANDMARK_SCENE`) suppresses re-opening until the hero steps off the tile and returns.
4. **Dungeon Entrance Encounter Engine (`startLandmarkDungeonEncounter`):**
   - Parameterized by landmark key (`GOBLIN_CAVE` vs. `ANCIENT_CRYPT`), allowing future multi-room dungeons or boss chambers to plug into `EXPLORE_GOBLIN_CAVE` and `ENTER_ANCIENT_CRYPT` without changing client UI wiring.

### B. Intentionally Fixed / Scoped for Phase 9B
1. **30×30 World Grid Footprint (`900` tiles):**
   - Kept the world within the unified `30×30` coordinate grid (`BLACKWOOD_FOREST` = `711` tiles, `UNDEAD_LANDS` = `189` tiles) so camera clamping, fog-of-war discovery, and the Region Map `[M]` modal work seamlessly without requiring multi-map loading screens.
2. **Single-Encounter Cave Delve & Crypt Breach Actions:**
   - Clicking **Delve into the Cave Mouth** (`EXPLORE_GOBLIN_CAVE`) or **Breach the Sepulcher Vault** (`ENTER_ANCIENT_CRYPT`) currently initiates a high-stakes guardian encounter on the entrance tile rather than loading a separate multi-floor sub-map.

---

## 3. Items Awaiting Owner Decision for Phase 9C / Phase 10

1. **Multi-Room Interior Maps vs. Boss/Guardian Encounters for Goblin Cave & Ancient Crypt:**
   - Should `GOBLIN_CAVE` and `ANCIENT_CRYPT` remain single-stage guardian/delve encounters at the landmark entrance, or should Phase 9C introduce a dedicated interior sub-grid (e.g., a 5×5 subterranean dungeon floor) when delving inside?
2. **Named Crypt Boss & Undead Lands Questline:**
   - Goblin Stronghold `[15, 2]` has **Warchief Grak** and Captain Vane’s quest (`THE_GOBLIN_CHIEFTAIN`). Should Phase 9C add a second major quest in Oakhaven (e.g., from a Cleric/Prelate NPC) targeting a named boss inside **The Ancient Crypt** (`[26, 5]`, such as *Lord Malakor the Barrow-King*)?
3. **Level 1 Mortality & Starting Consumables:**
   - With Level 1 Ambush protection removed, Level 1 heroes who venture off-road into `GOBLIN_CAVE_APPROACH` (`42%` ambush share) or `UNDEAD_LANDS` (`34%–50%` ambush share) face high permadeath risk during the 2-round Flee lock. Should starting healing potions remain at `3`, or should Oakhaven offer a cheap defensive blessing/torch consumable for early expeditions?
