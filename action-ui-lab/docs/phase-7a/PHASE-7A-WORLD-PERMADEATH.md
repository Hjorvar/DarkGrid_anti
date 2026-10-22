# DARKGRID — PHASE 7A: WORLD EXPLORATION, PACING & PERMADEATH AUDIT

## 1. World Topology & Regional Geography Audit

### 1.1 The 15x15 World Map (`db/seeds/001_seed_world.sql` vs. `action-ui-lab` Overrides)
The Darkgrid world is a $15 \times 15$ grid (`225` tiles total, coordinates $x \in [0, 14], y \in [0, 14]$) centered on the fortified sanctuary town of **Oakhaven at `(7, 7)`**.

| Region / Biome Name | Terrain Code | Coordinate Bounds | Production Tile Count (`001_seed_world.sql`) | `action-ui-lab` Overrides (`sandbox-db-service.js:107-160`) | Passable / Safe Status | Reachable Monsters (`monster_terrains`) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Oakhaven Sanctuary** | `CITY` | `(7, 7)` | 1 | Unchanged | Passable, **Safe (`1`)** | N/A (0% encounter) |
| **Oakhaven North & South Gates** | `PLAINS` (`TOWN_GATES`) | `(7, 6)` & `(7, 8)` | 2 | Unchanged (`is_safe = 1` in seed, treated as `TOWN_GATES` threshold in Lab) | Passable, Safe on Exit / `8%` Re-entry in Lab | 30 `PLAINS` monsters |
| **Verdant Plains & Windblown Heath** | `PLAINS` | Central `(5..8, 6..8)`, East `(10..13, 1..8)` | 26 | `(8,6)` & `(8,8)` changed to impassable `RIVER_LAKE`; `(9,7)` changed to passable `PLAINS` (*Bridge East Watchpost*) | Passable, Unsafe (`0`) | 30 monsters (`L1:11, L2:6, L3:5, L4:2, L5:6`) |
| **The Old Stone Bridge** | `BRIDGE` | `(8, 7)` | 1 | Unchanged (East leads to `(9,7)` Watchpost in Lab) | Passable, Unsafe (`0`) | **0 monsters** *(Bug!)* |
| **Mirkwood Forest & Heart of Mirkwood `(7,3)`** | `FOREST` | North `(4..11, 1..5)` | 38 | `(6,5)` changed to impassable `MOUNTAINS` (*Stonefang Crag*) | Passable, Unsafe (`0`) | 47 monsters (`L1:15, L2:9, L3:10, L4:8, L5:5`) |
| **Raven Crags** | `HILLS` | Northwest `(1..3, 1..5)` & West `(1..4, 6..8)` | 27 | Unchanged | Passable, Unsafe (`0`) | 47 monsters (`L1:12, L2:8, L3:8, L4:11, L5:8`) |
| **Rotting Fen & Deadman's Mire `(4,11)`** | `SWAMP` | Southwest `(1..7, 9..13)` | 35 | Unchanged | Passable, Unsafe (`0`) | 34 monsters (`L1:15, L2:4, L3:6, L4:2, L5:7`) |
| **Venomous Jungle** | `JUNGLE` | Southeast `(8..13, 9..13)` | 27 | Unchanged | Passable, Unsafe (`0`) | 15 monsters (`L1:5, L2:3, L3:2, L4:4, L5:1`) |
| **Darkmount Peaks / Murksea / Blackwater River / Bottomless Mire** | `MOUNTAINS`, `OCEAN`, `RIVER_LAKE`, `SWAMP` (row 14) | Borders & River `(9, 4..10)` | 68 | `+3` impassable (`(6,5)`, `(8,6)`, `(8,8)`), `-1` (`(9,7)`) | **Impassable (`0`)** | 12 monsters trapped in unreachable habitats! |

---

## 2. Exploration & Encounter Pacing Audit: Original vs. `action-ui-lab/`

### 2.1 Original Unpaced Exploration (`src/routes/game.js:349`, `src/domain/encounters/engine.js:186-267`)
- Every step onto an unsafe tile rolls a flat **`25%`** chance (`40%` if an active Watcher's Board bounty targets that region).
- **Flaws in Unpaced Mode:**
  - High back-to-back encounter clustering (`6.25%` chance of two fights on consecutive steps; `16%` in bounty regions).
  - Return trips to Oakhaven at low HP have the exact same `25%` encounter density as outbound exploration into uncharted territory.
  - All terrains (`PLAINS` outside town vs. deep `SWAMP` or `JUNGLE`) have the exact same `25%` encounter probability and the exact same Gaussian monster level target ($\mu = \text{character.level}, \sigma = 1.5$).

### 2.2 Successor Pacing Engine (`action-ui-lab/adventure-engine.js:1730-2055`)
`action-ui-lab` introduces `computeEncounterPacingChance()`, which governs random encounter probability through a state-aware modifier pipeline:
1. **Terrain Danger Hierarchy:**
   - `CITY`: `0%`
   - `TOWN_GATES` `(7,6)` / `(7,8)`: `0%` when departing Oakhaven; `8%` when re-entering from the wild.
   - `PLAINS` / `BRIDGE`: `16%` base
   - `FOREST` / `HILLS`: `22%` base
   - `SWAMP` / `JUNGLE`: `28%` base
   - `UNDERGROUND_RUINS` & High-Danger Landmarks (`(7,3)` Heart of Mirkwood, `(9,7)` Bridge East Watchpost, `(4,11)` Deadman's Mire): `30%` base
   - Active Bounty Region override: $\max(\text{base}, 40\%)$.
2. **Breathing Room & Revisit Dampening:**
   - **Step 1 after any encounter (Victory, Flee, or Bypass):** `0%` (`POST_ENCOUNTER_BREATHING_STEP`).
   - **Step 2 after any encounter:** `0.40x` multiplier (`POST_ENCOUNTER_SOFT_RECOVERY`).
   - **Recently Cleared Tile ($\le 8$ steps since victory on that tile):** `0%` (`RECENTLY_CLEARED_SITE_PROTECTED`), then `0.25x` long-term (`CLEARED_SITE_REDUCED`).
   - **Familiar Visited Tile (no lingering threat):** `0.45x` multiplier (`FAMILIAR_SAFE_REVISIT`).
   - **Lingering Threat Tile (where hero previously fled or bypassed):** `1.25x` multiplier (`LINGERING_THREAT_SITE`).
   - **Immediate Backtrack Step (`A -> B -> A`):** Capped at `3.5%` (`IMMEDIATE_BACKTRACK_DAMPENED`).
   - **2-Tile Oscillation (`A <-> B <-> A`):** `0%` (`ANTI_OSCILLATION_SUPPRESSED`).
   - **Quiet Streak Ramp ($\ge 5$ quiet steps on unexplored tiles):** `+2%` per step up to `+8%` (`maxRandomChancePercent = 45%`).

### 2.3 Balance Audit of the New World & Pacing Engine
1. **Distance vs. Monster Level Disconnect (Critical):**
   - While `action-ui-lab` scales **encounter frequency** by terrain (`16%` Plains $\to$ `22%` Forest/Hills $\to$ `28%` Swamp/Jungle $\to$ `30%` Landmarks), **monster level selection (`selectMonsterForTile` in `src/domain/encounters/engine.js:67-76`) is still 100% blind to distance from Oakhaven and regional danger!**
   - Specifically, `selectMonsterForTile(db, terrain, characterLevel)` always sets `targetLevel = characterLevel` with $\sigma = 1.5$, whether the hero is 1 tile outside Oakhaven at `(6,7)` Verdant Plains or 7 tiles away at `(4,11)` Deadman's Mire!
   - Conversely, a Level 1 hero who steps 2 tiles north of Oakhaven into `(7,5)` Mirkwood Forest can roll a Level 4 *Owlbear* or Level 5 *Orc Warchief*, while a Level 5 hero who travels to the deepest landmark at `(4,11)` Deadman's Mire can still roll a Level 1 *Dire Rat* or *Human Zombie*!
2. **Environmental Discoveries Have Zero Mechanical Integration (`action-ui-lab/adventure-engine.js:118-520, 1423-1512`):**
   - `DISCOVERY_CATALOG` contains rich interactive discoveries (*Abandoned Ranger Cache*, *Moonwell Basin*, *Fungal Spores*, *Ancient Runestone*, etc.) with player choices (`resolveDiscoveryChoice`).
   - **Verified Fact:** Resolving a discovery choice only logs narrative text to the Expedition Journal (`advState.journalEntries`) and increments `choicesTakenCount`—it grants **zero XP, zero gold, zero items, zero healing, and zero temporary buffs or hazards**! Integrating modest, bounded mechanical rewards/risks (e.g., `+15–40 XP` for lore discoveries, a minor heal at a shrine, or a small consumable find once per expedition) will make exploration genuinely rewarding without breaking the economy.

---

## 3. Permadeath & Persistent Monster Escalation Audit

### 3.1 How Persistent Monsters Work (`src/domain/monsters/persistence.js:19-165`)
When a character's HP drops to `0` (`processHeroDeath` in `src/domain/monsters/persistence.js:55-165`):
1. **Irreversible Permadeath:** `characters.is_alive` is set to `0`, `died_at = CURRENT_TIMESTAMP`, and `killed_by_monster_instance_id` records the killer. (Enforced at the SQLite level by trigger `enforce_permadeath_irreversible` in `013_production_blaze_hardening.sql:49-54`).
2. **Active Bounty Failure:** Any active or unclaimed hunting contracts (`hunting_contracts`) for that character are marked `'FAILED'`.
3. **Monster Strengthening & Full Heal:**
   - If the killer was a new monster, a `monster_instances` row is created on that `tile_id` with `kill_count = 1` and `max_hp = Math.max(1, Math.round(base_hp * 1.10))` (`+10%` max HP), healed to full (`current_hp = max_hp`).
   - If the killer was already a persistent `monster_instances` row, its `kill_count` increments by `+1` and its `max_hp` compounds by another **`+10%`** (`Math.max(1, Math.round(inst.max_hp * 1.10))`), and it **heals to 100% of its new `max_hp`**!
   - Dynamic Title Escalation (`generateDynamicTitle` in `persistence.js:24-39`):
     - 1 kill: `Slayer of <HeroName>`
     - 2 kills: `The Bloodied <MonsterName>`
     - 3–4 kills: `<MonsterName> the Bone-Crusher`
     - 5+ kills: `<MonsterName>, Scourge of the Realm`
4. **Total Wealth & Inventory Transfer:**
   - `100%` of the dead hero's `gold` is added to `monster_instances.held_gold`.
   - `100%` of the dead hero's equipped and backpack `item_instances` (`getAllCharacterItems`) have their `owner_type` transferred to `'MONSTER'` (`owner_monster_id = monsterInstanceId`, `equipped_slot = NULL`).
5. **100% Tile Lockout (`src/domain/encounters/engine.js:195-210`, `adventure-engine.js:1851-1870`):**
   - Stepping onto a tile with an `'ACTIVE'` persistent monster triggers an encounter **`100%` of the time** (bypassing all random encounter rolls).

### 3.2 Critical Escalation & Choke-Point Hazards
1. **Choke-Point Griefing / New-Player Lockout:**
   - Look at the map layout around Oakhaven `(7,7)`:
     - In `action-ui-lab`, `(8,6)` and `(8,8)` are impassable river tiles, making **The Old Stone Bridge `(8,7)` the ONLY path to the eastern half of the world**!
     - Similarly, `(7,6)` North Gate leads directly into `(7,5)` Mirkwood Crossroads (where `(6,5)` is blocked by Stonefang Crag).
   - If a high-level hero (say Level 4 or 5) dies on `(7,5)`, `(7,8)`, or `(8,7)` to a Level 4–5 monster (*Minotaur*, *Orc Warchief*, *Manticore*), that Level 5 monster (now boosted to `~45–52 HP`) remains permanently parked 1–2 tiles outside Oakhaven with a **100% encounter rate**!
   - When the player creates a fresh **Level 1 character** (or another new player enters the world), stepping onto `(7,5)` or `(8,7)` immediately forces a Level 1 hero into an encounter with a boosted Level 5 persistent monster!
2. **Compound HP Runaway & Instant Full-Heal on Victory:**
   - Because `max_hp` compounds by `1.10x` per kill with **no upper cap** and **heals to 100% HP** every time a hero dies (`persistence.js:76, 99`), players cannot even wear down a persistent monster across multiple lives (zerging it leaves it stronger and at 100% HP!). After 5 kills, a 45 HP monster has **$45 \times 1.10^5 = 72\text{ HP}$**!
3. **Pinata Wealth Distortion on Slaying a Persistent Monster:**
   - When a high-level hero finally slays a multi-kill persistent monster (`src/domain/monsters/persistence.js:173-224`), `processPersistentMonsterDefeat` transfers **100% of all accumulated `held_gold` and all accumulated `item_instances`** from every fallen hero at once, which can dump thousands of gold and multiple sets of gear onto a single character.

---

## 4. World & Permadeath Redesign Recommendations (Balance V2 Preview)

1. **Concentric Regional Danger Zones (Distance-Clamped Monster Levels):**
   - Tie `selectMonsterForTile` to **Zone Danger Bands** based on distance from Oakhaven `(7,7)` and biome tier so Level 1 heroes near town cannot roll Level 4–5 apex monsters, and deep regions remain dangerous even if visited early.
2. **Choke-Point Sanctuary Radius & Persistent Monster Migration:**
   - **Rule 1 (Gate & Choke-Point Clearance):** Persistent monsters (`monster_instances`) cannot camp on `TOWN_GATES` `(7,6)`/`(7,8)`, `BRIDGE` `(8,7)`, or within Manhattan distance $\le 2$ of Oakhaven `(7,7)`. If a hero dies within 2 tiles of Oakhaven, the victorious monster **retreats 1–2 tiles deeper into its home biome** (`FOREST`, `HILLS`, `SWAMP`, `PLAINS`) rather than blocking the town exit!
   - **Rule 2 (Cap Persistent HP Boost at +30% / 3 Stacks):** Cap the compound HP bonus at **+30% max HP** (`+10%` per kill up to 3 kills) and retain the battle damage dealt to the monster above 50% HP (only healing up to $\max(\text{current\_hp}, \lceil 0.60 \times \text{max\_hp} \rceil)$ on a hero kill) so a monster that barely survived at 2 HP does not magically regenerate to 100% HP.
3. **Clear Pre-Engagement Threat Signaling (`Stage 1 DISCOVERED`):**
   - Surface the 5-tier difficulty classification (`TRIVIAL`, `STANDARD`, `DANGEROUS`, `ELITE`, `BOSS`) as an atmospheric **Threat Aura / Omen** during Stage 1 (`DISCOVERED`) when `spotted_by_hero === 1` (without spoiling the monster's exact name or stat block, preserving `.agents/rules/encounter-design.md` encounter secrecy!). This gives players informed risk/reward agency before clicking `Investigate` vs. `Ignore/Bypass`.
