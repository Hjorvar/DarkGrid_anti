# DARKGRID — PHASE 7A: EXECUTIVE SUMMARY & AUDIT METADATA

## 1. Audit Metadata & Safety Record

| Field | Value |
| :--- | :--- |
| **Phase** | Phase 7A — Complete Game Balance Audit & Redesign Blueprint |
| **Execution Mode** | Analysis & Planning Only (Zero Gameplay, Database, or Asset Modifications) |
| **Git Branch / Worktree** | `darkgrid_phase7a_balance_audit` (`C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit`) |
| **Starting Git Commit** | `87ed6f3e332e976a6396c4aa1e559c96fde03f74` (`87ed6f3 docs(action-ui-lab): add main branch integration report and post-merge QA verification`) |
| **Concurrent Phase 6 Worktree** | `darkgrid_legacy_integration` (`C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_legacy_integration`, also branched at `87ed6f3`) |
| **Authoritative Domain Layer** | `src/domain/*`, `src/config/index.js`, `db/migrations/001..013`, `db/seeds/001..010` |
| **Successor Application Layer** | `action-ui-lab/` (`server.js`, `adventure-engine.js`, `monster-size-catalog.js`, `server/controllers/*`, `server/services/*`) |

---

## 2. Authoritative Implementation vs. Successor (`action-ui-lab/`)

A central requirement of Phase 7A is determining which implementation is authoritative and where the original Darkgrid (`src/`) and the successor (`action-ui-lab/`) diverge.

### 2.1 Shared Authoritative Domain Engine (`src/domain/*`)
Both the original Express/EJS application (`src/routes/game.js`) and the successor (`action-ui-lab/server/controllers/*`) import and execute the **same underlying domain rules** from `src/domain/`:
- **Character & Attribute Rules:** `src/domain/character/rules.js` and `src/config/index.js`
- **Combat Math & D20 Resolution:** `src/domain/combat/rules.js`, `src/domain/combat/engine.js`, `src/domain/combat/abilities.js`, `src/domain/combat/dice.js`
- **Loot & Victory Processing:** `src/domain/combat/loot.js`, `src/domain/combat/victory.js`
- **Persistent Monsters & Permadeath:** `src/domain/monsters/persistence.js`
- **Economy & Global Resale Market:** `src/domain/economy/shop.js`
- **Watcher's Board Bounties:** `src/domain/bounties/board.js`
- **Encounter Selection (Gaussian Level & Terrain Filtering):** `src/domain/encounters/engine.js`

### 2.2 Critical Divergences in `action-ui-lab/` (Requiring Phase 6 / 7B Alignment)
While `action-ui-lab/` delegates core combat and RPG math to `src/domain/*`, five major behavioral divergences exist in `action-ui-lab/` at commit `87ed6f3`:

1. **Calibrated Encounter Pacing Engine (`action-ui-lab/adventure-engine.js:1730-2055`, `navigation-controller.js:103-116`):**
   - Original `src/routes/game.js:349` calls `checkTileEncounter(tx, character, targetTile)` with no `forcedChance`, using a flat `25%` encounter rate (`40%` in active bounty regions) on every non-safe step.
   - `action-ui-lab` calls `computeEncounterPacingChance()`, replacing the flat `25%` roll with terrain-tiered base rates (`PLAINS`/`BRIDGE` 16%, `FOREST`/`HILLS` 22%, `SWAMP`/`JUNGLE` 28%, High-Danger Landmarks 30%), a 0% Town Gate departure grace step, a 1-step 0% post-encounter breathing room followed by a `0.40x` soft-recovery step, a `0.45x` familiar-tile revisit multiplier, an 8-step cleared-site protection window (`0%` then `0.25x`), and anti-oscillation suppression (`0%` on repeated `A <-> B <-> A` farming).
   - **Verdict:** `action-ui-lab`'s `computeEncounterPacingChance` is a major improvement over flat 25% RNG, but its strong suppression multipliers reduce encounter density by ~45% on return trips, which must be factored into XP and resource economy calibration.

2. **Move-to-Bypass Stage 1 Encounters (`action-ui-lab/server/controllers/navigation-controller.js:61-78`):**
   - In original `src/domain/world/map.js:90-99`, `validateMovement` blocks all movement while an encounter is in `DISCOVERED` status until the player explicitly clicks `Ignore`.
   - In `action-ui-lab`, executing `MOVE` during a non-ambush `DISCOVERED` encounter automatically invokes `ignoreEncounter(tx, character.id, activeEnc.id)` and moves the hero to the next tile in a single atomic turn.

3. **Out-of-Combat Potion Consumption Bug in Lab Controller (`action-ui-lab/server/controllers/character-town-controller.js:186-237`):**
   - Original `src/routes/game.js:588` calls `useConsumable()` (`src/domain/character/rules.js:1017-1092`), which blocks consuming the 7 unimplemented buff/alchemical/offensive potions (`INACTIVE_CONSUMABLE_NAMES`: *Potion of Barkskin*, *Bull's Strength*, *Cat's Grace*, *Shield of Faith*, *Heroism*, *Elixir of Dragon's Breath*, *Antitoxin*).
   - `action-ui-lab`'s `CONSUME_POTION` handler bypasses `useConsumable()` and executes inline SQL that deletes the potion and rolls `attrs.heal_dice` (`"0"` -> clamped to `1 HP`), destroying 150–800 gp potions for 1 HP of healing.

4. **Sandbox Hero Seeding, Revive, and Director Cheats (`action-ui-lab/server/services/sandbox-db-service.js:206-298`, `character-town-controller.js:103-114`, `adventure-scenario-controller.js:160-428`):**
   - `ensureLivingHero` seeds sandbox characters with `180 gp` and `3 Minor Healing Potions` (versus production `config.startingGold = 10 gp` and `2 Minor Healing Potions` in `createCharacter`), and uses invalid Ranger `favoredEnemyType: 'UNDEAD'` in `CLASS_PRESETS.RANGER` (`sandbox-db-service.js:179`), which `createCharacter` (`src/domain/character/rules.js:457`) explicitly forbids with HTTP 400 (`Undead is not permitted as a Favored Enemy`) so `sandbox-db-service.js:239` catches the error and retries with `favoredEnemyType: null` (leaving the sandbox Ranger with **no Favored Enemy**!).
   - Furthermore, `character-town-controller.js:108` attempts `UPDATE characters SET is_alive = 1` on `REVIVE`, which conflicts with the monotonic database trigger `enforce_permadeath_irreversible` added in `db/migrations/013_production_blaze_hardening.sql:49-54`, and `adventure-scenario-controller.js:264,347` executes `UPDATE monster_instances SET status = 'SLAIN'`, which violates `CHECK (status IN ('ACTIVE', 'DEFEATED'))` in `001_initial_schema.sql:86`.

5. **Local Map Tile Overrides (`action-ui-lab/server/services/sandbox-db-service.js:107-160`):**
   - On startup, the lab mutates 4 tiles in `map_tiles`: `(6,5)` becomes impassable `MOUNTAINS` (*Stonefang Crag*), `(8,6)` and `(8,8)` become impassable `RIVER_LAKE` (*Blackwater River*), and `(9,7)` becomes passable `PLAINS` (*Bridge East Watchpost*).

---

## 3. Top 12 Critical Balance & Systems Findings (Verified Facts)

1. **Level 6–10 Content Vacuum (`db/seeds/002..010`, `src/domain/character/rules.js:41-52`, `src/domain/encounters/engine.js:67-76`):**
   - `FAST_XP_TABLE` defines character levels **1 through 10** (`0` to `71,000 XP`), and class abilities scale at Levels 5–8 and 9–10. However, all **98 monsters** in the database have `solo_level` in `1..5` (`Level 1: 29`, `Level 2: 21`, `Level 3: 18`, `Level 4: 14`, `Level 5: 16`; `Levels 6–10: 0`). Once a hero reaches Level 6+, the Gaussian encounter selector (`targetLevel = characterLevel`, $\sigma = 1.5$) only samples the tail at `solo_level <= 5`, causing progression and challenge to collapse after Level 5.

2. **12 of 98 Monsters (12.2%) Can Never Spawn on the World Map (`db/seeds/001_seed_world.sql`, `db/migrations/003_add_creature_type_and_monster_terrains.sql`):**
   - The 15x15 world map contains only 5 unsafe passable terrains (`FOREST`: 38, `SWAMP`: 35, `HILLS`: 27, `JUNGLE`: 27, `PLAINS`: 26) plus 1 `BRIDGE` tile `(8,7)`. There are **zero** passable unsafe tiles with terrain `UNDERGROUND_RUINS`, `MOUNTAINS`, `DESERT`, `COAST`, `OCEAN`, `RIVER_LAKE`, `AQUATIC`, or `EXTRAPLANAR`.
   - Consequently, **12 monsters** (*Darkmantle*, *Drow*, *Duergar*, *Giant Crab*, *Iron Cobra*, *Morlock*, *Sahuagin*, *Skeletal Champion*, *Doppelganger*, *Cloaker*, *Mummy*, *Phase Spider*) have **zero valid spawn tiles** in the game, and *The Old Stone Bridge* `(8,7)` (`terrain = 'BRIDGE'`) has **zero monsters** mapped in `monster_terrains`.

3. **Attribute Min-Maxing & Odd-Score Dead Zones (`src/config/index.js:24-66`, `src/domain/character/rules.js:57-59`):**
   - Ability modifiers use `floor((score - 10) / 2)` and there are **zero** ability score increases on level-up. Odd ability scores (`9, 11, 13, 15, 17`) provide zero mechanical benefit over the even score below them.
   - Because players can dump up to 2 points from any attribute (`base - 2`), dumping `INT` and `CHA` to `8` (`-1` mod) yields `+4` extra creation points (`+7` total with the 3 bonus points) to push primary combat stats to `18/16/14`, dominating balanced allocations in a permadeath game.

4. **Intelligence & Charisma Are Trap Stats (`src/domain/character/rules.js:1141-1158`, `src/domain/economy/shop.js`):**
   - `INT` only modifies combat XP by `+10%` per `+1` modifier (`calculateXpWithIntelligence`) and has zero impact on combat survival, skills, or abilities; at Level 10 it does nothing.
   - `CHA` only modifies city shop purchase prices by `-5%` per `+1` modifier (`calculateShopPriceWithCharisma`) and does **not** affect item sell prices (`sell_price`) or global resale market listings (`market_listings.price`). Furthermore, Cleric is forced into base `CHA 12` (minimum `10`), wasting 2 base stat points compared to Fighter and Ranger (base `CHA 10`, minimum `8`).

5. **Level 1 Attack Bonus Formula Anomaly (`src/domain/character/rules.js:88-96`):**
   - `getLevelAttackBonus(level, classType)` computes `level - 1` for Fighter and Ranger (`+0` at Level 1, `+9` at Level 10) and `floor(level * 0.75)` for Cleric (`+0` at Level 1, `+7` at Level 10). At Level 1—where permadeath risk is highest—Fighter and Ranger receive **+0 Base Attack Bonus**, identical to Cleric!

6. **Cleric Severe Late-Tier Underperformance (`src/domain/character/rules.js:169-215`, `docs/post-rebalance-combat-report.md`):**
   - Against Undead (only 12 of 98 monsters, 10 of which are spawnable), Cleric receives massive *Holy Radiance* bonuses (`+2/+3/+2` to `+4/+5/+4`). Against the remaining **88% of spawnable monsters**, Cleric has **zero combat class bonuses**, `0.75x` attack scaling, `8 + CON` HP/level, restricted weapons (best mundane 1H weapon is `1d8` Heavy Mace/Morningstar/Warhammer), and **cannot use Divine Self-Heal during combat** (`src/routes/game.js:520`). By Level 4–5, Cleric combat win rate drops to **~28–31%** against same-level threats.

7. **Ranger Opening Shot Cannot Kill & Favored Enemy Is Lock-In RNG (`src/domain/combat/engine.js:238`, `src/domain/character/rules.js:122-163`):**
   - In `src/domain/combat/engine.js:238`, Ranger's pre-combat Opening Shot is clamped via `currentMonsterHp = Math.max(1, currentMonsterHp - openingDamage)`, meaning a Ranger can hit a 3 HP Kobold for 10 damage on Opening Shot and the Kobold still survives at `1 HP` to enter Round 1!
   - Ranger's ranged damage bonus (`Math.max(strMod, Math.floor(dexMod / 2))`) makes `STR 12 -> 14` completely redundant when `DEX >= 18`.
   - Ranger's Favored Enemy is locked to a single creature type at creation; choosing `CONSTRUCT` (`0` spawnable monsters), `OOZE` (`1` monster), `DRAGON` (`2` monsters), or a narrow `HUMANOID` subtype yields near-zero uptime across a run.

8. **Monster Special Abilities Ignore Database Definitions (`src/domain/combat/abilities.js:272-1200`):**
   - `monsters.special_abilities` JSON in SQLite is completely ignored by combat execution. Instead, `src/domain/combat/abilities.js` uses a giant hardcoded `switch (name)` across monster names. Any monster renamed, added, or modified in the database without editing `abilities.js` loses its special abilities.

9. **Gaussian Encounter Spawner Allows Lethal $+2$ / $+3$ Level Spikes (`src/domain/encounters/engine.js:16-86`):**
   - `selectMonsterForTile` uses a Gaussian weight $\exp(-(L_m - L_c)^2 / (2 \times 1.5^2))$ with **no hard upper cap** on `solo_level`. A Level 1 hero (`~12 HP`) has a `~13.8%` chance per encounter to roll a Level 3 monster (e.g., *Ogre* dealing `2d8+7` = `16` avg damage or *Assassin Vine* dealing `1d8+7` + Entangle) and a `~2.1%` chance to roll a Level 4–5 monster (*Minotaur* `3d6+6`, *Wyvern* `1d8+5` + Poison). Even with the Round 1 Level-1 Spike Guard (`engine.js:774`), a Level 1 hero who survives Round 1 at `1 HP` ("Death's Door") against a faster or high-AC Level 3–5 monster frequently dies on Round 2 when `FLEE` (`65%` base chance) fails (`35%` failure rate).

10. **Equipment Slot Sparsity, Inactive Items, and Price Cliffs (`db/seeds/005,007,010`, `src/domain/character/rules.js:264-322`):**
    - Out of 113 items: `RING`, `CLOAK`, `NECK`, `BELT`, and `FEET` have only **1 item each** in the entire database.
    - *Boots of Elvenkind* (`2,500 gp`, `FEET`) grants **zero mechanical stats**.
    - *Bracers of Armor +1* (`1,000 gp`, `CHEST`) occupies the chest armor slot and grants `+1 AC`—strictly worse than `10 gp` Leather Armor (`+2 AC`).
    - 7 potions (`INACTIVE_CONSUMABLE_NAMES`) drop as loot and appear in the city shop (`50–800 gp`) despite having **no implemented effect**.
    - Mundane weapons cost `0–100 gp`, whereas `+1` magic weapons jump straight to `2,302–2,375 gp` (`+2` at `8,315 gp`, `+3` at `18,000 gp`), while monsters drop only `~11–115 gp` on average, creating a massive mid-game progression cliff.

11. **Persistent Monster Snowballing & Uncapped Title Escalation (`src/domain/monsters/persistence.js:19-165`):**
    - When a monster kills a hero, it heals to full and gains `+10%` compound `max_hp` (`Math.max(1, Math.round(max_hp * 1.10))`) with **no cap**, steals `100%` of the hero's gold and inventory (`owner_type = 'MONSTER'`), and blocks that tile (`100%` encounter rate). If a high-level monster spawns near Oakhaven (e.g., at `(7,5)` Mirkwood Crossroads or `(8,7)` Old Stone Bridge) and kills several heroes, it becomes an unkillable roadblock for new Level 1 characters.

12. **Global Resale Market Cross-Character Twinking (`src/domain/economy/shop.js:116-195`):**
    - Selling any `is_magical = 1` item lists it permanently in `market_listings` at `sell_price * 1.5`, visible to all characters across all accounts, and **ignores CHA discounts**. High-level characters can dump magic items into the market or persistent monsters can accumulate massive loot hoards that distort a fresh character's progression curve.

---

## 4. Phase 7A Documentation Map (`action-ui-lab/docs/phase-7a/`)

All Phase 7A deliverables are organized in `action-ui-lab/docs/phase-7a/`:

1. [`PHASE-7A-SUMMARY.md`](./PHASE-7A-SUMMARY.md) — Executive summary, commit/worktree metadata, authoritative vs. successor comparison, top findings, and Phase 6 revalidation checklist.
2. [`PHASE-7A-CURRENT-BALANCE-AUDIT.md`](./PHASE-7A-CURRENT-BALANCE-AUDIT.md) — Deep audit of the 71-point character creation system, attribute math, odd-score dead zones, trap stats (`INT`/`CHA`), derived stat scaling, and 9 representative builds (3 per class).
3. [`PHASE-7A-CLASS-BALANCE.md`](./PHASE-7A-CLASS-BALANCE.md) — Complete class audit (Fighter, Ranger, Cleric) across offense, defense, healing, special abilities, equipment dependence, and level scaling, with concrete rebalance specifications.
4. [`PHASE-7A-MONSTER-COMBAT-AUDIT.md`](./PHASE-7A-MONSTER-COMBAT-AUDIT.md) — Audit of all 98 monsters, habitat/spawn reachability bug (12 unreachable monsters), visual size vs. combat strength analysis, 5-tier difficulty classification (`TRIVIAL`, `STANDARD`, `DANGEROUS`, `ELITE`, `BOSS`), and full combat mathematics at Levels 1, 3, 5, 8, and 10.
5. [`PHASE-7A-PROGRESSION-ECONOMY.md`](./PHASE-7A-PROGRESSION-ECONOMY.md) — XP table & progression pacing audit, Level 6–10 content gap, 9-slot equipment audit, inactive items, gold faucets/sinks, shop/market economy, and Watcher's Board bounty math.
6. [`PHASE-7A-WORLD-PERMADEATH.md`](./PHASE-7A-WORLD-PERMADEATH.md) — 15x15 world map topology, `action-ui-lab` pacing engine analysis, danger communication, persistent monster escalation hazards, and permadeath fairness rules.
7. [`PHASE-7A-BALANCE-V2-DESIGN.md`](./PHASE-7A-BALANCE-V2-DESIGN.md) — Cohesive **Darkgrid Balance V2** mathematical specification covering attributes, classes, combat, monsters, XP/levels 1–10, economy, exploration pacing, and permadeath safeguards.
8. [`PHASE-7A-SIMULATION-PLAN.md`](./PHASE-7A-SIMULATION-PLAN.md) — Architecture and acceptance targets for the Phase 7B deterministic Monte Carlo balance simulator (10,000+ combat & expedition runs).
9. [`PHASE-7A-FRESH-START-STRATEGY.md`](./PHASE-7A-FRESH-START-STRATEGY.md) — Safe database & state reset architecture for launching Balance V2 with Level 1 characters while preserving user accounts (`users`, `firebase_uid`) and archiving Hall of the Fallen memorials.
10. [`PHASE-7B-IMPLEMENTATION-PLAN.md`](./PHASE-7B-IMPLEMENTATION-PLAN.md) — Step-by-step engineering roadmap, file-level change manifest, migration/seed plan, and verification gates for Phase 7B.

---

## 5. Findings Requiring Revalidation After Phase 6 Finalization

Because Phase 6 (`darkgrid_legacy_integration`) may run concurrently to integrate legacy Darkgrid systems into `action-ui-lab/`, the following items **must be revalidated** before Phase 7B code changes begin:

- [ ] **Character Creation & Auth Integration in `action-ui-lab/`:** Verify whether Phase 6 replaces `ensureLivingHero` (`sandbox-db-service.js`) with real character creation (`createCharacter` from `src/domain/character/rules.js`), removing the `180 gp` / `3 potion` sandbox override and fixing the `RANGER` `favoredEnemyType` preset bug.
- [ ] **Permadeath & Revive Handling in `action-ui-lab/`:** Verify whether Phase 6 removes the sandbox `REVIVE` action (`character-town-controller.js:103`) and aligns dead-character routing with `/game/fallen` and trigger `enforce_permadeath_irreversible` (`013_production_blaze_hardening.sql`).
- [ ] **Out-of-Combat Consumable Handler (`character-town-controller.js:186`):** Check whether Phase 6 delegates `CONSUME_POTION` to `useConsumable()` in `src/domain/character/rules.js`.
- [ ] **Map Tile Overrides (`sandbox-db-service.js:107-160`):** Confirm whether the 4 local tile overrides (`(6,5)`, `(8,6)`, `(8,8)`, `(9,7)`) are promoted to canonical world seeds or reverted to `001_seed_world.sql`.
- [ ] **Lab Director Actions (`LAB_SCENARIO`):** Confirm whether `adventure-scenario-controller.js` is gated behind a development environment flag in production builds and whether `status = 'SLAIN'` (`lines 264, 347`) is updated to `'DEFEATED'`.
