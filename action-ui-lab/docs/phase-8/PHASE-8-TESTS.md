# DARKGRID — PHASE 8: AUTOMATED TESTS & SIMULATION REPORT (`PHASE-8-TESTS.md`)

## 1. Automated Test Execution Summary

| Test Suite | Command | Total Tests | Passed | Failed | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Phase 8 World, Camera, Discovery, Quests, Nemesis & Pacing** | `node --test action-ui-lab/tests/phase8-world-and-systems.test.js` | 7 | 7 | 0 | **PASS** |
| **Top-Down Exploration & Phase 7C Parity** | `node --test action-ui-lab/tests/topdown-experiment.test.js` | 9 | 9 | 0 | **PASS** |
| **Headless Chrome Multi-Resolution & 14-Screenshot Visual QA** | `node action-ui-lab/tests/phase8-visual-qa.js` | 14 | 14 | 0 | **PASS** |
| **Baseline Darkgrid Domain, Combat, Economy & Security** | `npm test` | 244 | 244 | 0 | **PASS** |
| **Total Verified Automated Tests** | — | **274** | **274** | **0** | **PASS** |

---

## 2. Detailed Test Coverage (`phase8-world-and-systems.test.js` & `topdown-experiment.test.js`)

### A. Map Integrity & Topology (Section 16.A)
- **900 Tiles (`30×30`):** Verified `TOPDOWN_TILES.length === 900` and `map_tiles` count `=== 900` spanning `x = 0..29`, `y = 0..29`.
- **Zero Isolated Passable Islands:** Breadth-first search (BFS) from `Oakhaven [15, 27]` reaches all `681` passable tiles (`visited.size === 681`), proving zero unreachable passable pockets exist.
- **3 Continuous Routes:** Verified `ROUTE_A_MAIN_TRAIL` (32 tiles), `ROUTE_B_WESTERN_WILDERNESS` (44 tiles), and `ROUTE_C_EASTERN_RIVER` (46 tiles) are 100% passable, start at `[15, 27]`, end at `[15, 2]`, and have Manhattan distance `=== 1` between every consecutive step.
- **13 Landmarks:** Verified all 13 landmarks (`OAKHAVEN_CITY`, `NORTH_GATE`, `SOUTHERN_CROSSROADS`, `OLD_STONE_BRIDGE`, `ABANDONED_WATCHPOST`, `BROKEN_SHRINE`, `CHARCOAL_CAMP`, `ANCIENT_BLACK_OAK`, `EASTBANK_OVERLOOK`, `OLD_LOG_CROSSING`, `GOBLIN_HUNTING_GROUNDS`, `STRONGHOLD_APPROACH`, `GOBLIN_STRONGHOLD`) are persisted in `map_tiles` with `is_landmark = 1` and accurate `landmark_key`.

### B. Camera Viewport & Movement (Section 16.B)
- **Viewport Ratio:** Verified `visibleCols` (~11.5) and `visibleRows` (~8.5) across `1280×720`, `1440×900`, and `1920×1080` desktop viewports.
- **Outer Border Clamping:** Verified camera clamps cleanly near `[15, 27]` (`camPxY <= maxCamPxY`) and `[15, 2]` (`camPxY >= 0`) without showing out-of-bounds void.
- **Interior Centering:** Verified hero is centered (`heroScreenX === width / 2`, `heroScreenY === height / 2`) when standing at `Ancient Black Oak [15, 15]`.

### C. Discovery, Fog of War & Ranger Scouting (Section 16.C)
- **Class Vision Radius:** Verified `getVisionRadiusForClass('RANGER') === 4` (`52` initial discovered tiles in Oakhaven) vs `3` (`33` initial discovered tiles) for `FIGHTER` and `CLERIC`.
- **Stronghold Secrecy:** Verified `Goblin Stronghold [15, 2]` is undiscovered (`isDiscovered === false`, `regionMap.strongholdDiscovered === false`) at start and only appears on the Region Map once discovered.
- **Fog Never Blocks Movement:** Verified stepping into previously undiscovered tiles succeeds and dynamically increments `discoveredTileCount`.

### D. General Quest Framework & Unified Bounties (Section 16.E)
- **Database Persistence:** Verified `quest_definitions` and `character_quests` rows are created, updated, and synchronized with legacy `characters` columns across all 4 states (`NOT_ACCEPTED` -> `ACTIVE` -> `COMPLETED` -> `REWARD_CLAIMED`), including pre-acceptance boss defeat.
- **Level 1 Bounty Access:** Verified a Level 1 hero in Oakhaven can accept (`ACCEPT_BOUNTY`) and abandon (`ABANDON_BOUNTY`) Watcher's Board contracts with no artificial Level 2 lock.

### E. Boss, Nemesis & Permadeath Loot Inheritance (Section 16.F)
- **Boss Presentation:** Verified `Warchief Grak the Goblin Chieftain` uses `/images/monsters/goblin.png` against `/images/terrain/terrain_town_gates.webp`.
- **Nemesis Promotion & Loot Recovery:** Verified that when Hero A (`75 Gold`) falls to Warchief Grak at `[15, 2]`:
  1. Hero A enters permadeath (`mode === 'FALLEN'`, `is_alive === 0`).
  2. Warchief Grak remains `ACTIVE` at `[15, 2]`, increments `kill_count >= 1`, receives a `+10%` Nemesis `max_hp` boost (`14 -> 16`), restores `current_hp = max_hp`, and inherits 50% of Hero A's gold (`+37g` -> `82g` held gold).
  3. When Hero B travels to `[15, 2]` and slays Warchief Grak, Hero B recovers Warchief Grak's base gold plus Hero A's stolen gold (`+82g+`).

### F. Monte Carlo Travel Simulation & Encounter Pacing (Section 16.G)
- **Category Distribution (1,000 samples):**
  - Goblin-related (`Goblin`, `Hobgoblin`, `Bugbear`, `Worg`): **80.7%** (target ~80%)
  - Forest Animals (`Wolf`, `Dire Rat`, `Bat`): **15.0%** (target ~15%)
  - Other Forest Monsters (`Giant Spider`, `Skeleton`, `Zombie`, `Assassin Vine`): **4.3%** (target ~5%)
- **200-Trip Monte Carlo Route Simulation:**
  - `Route A (Main Forest Trail, 31 steps)`: **~2.35 average encounters** per trip (within target 2–4 range).
  - `Route B (Western Wilderness Route, 43 steps)`: **~3.10 average encounters** per trip.
  - `Route C (Eastern River Route, 45 steps)`: **~3.18 average encounters** per trip.

### G. Coordinate Migration & Server Restart Persistence (Section 15 & 16.D)
- Verified `mapLegacyCoordToPhase8` maps legacy 8×7 coordinates (`[7,7] -> [15,27]`, `[7,6] -> [15,26]`, `[7,1] -> [15,2]`, `[8,7] -> [19,25]`, `[9,7] -> [21,25]`) cleanly.
- Verified re-running `applyTopdownExperimentWorld(db)` (simulating a server restart) preserves hero position (`[15, 15]`), defeated boss status (`bossSlain === true`), discovered tiles (`character_discovered_tiles`), and quest state (`COMPLETED`).
