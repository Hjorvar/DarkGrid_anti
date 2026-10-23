# DARKGRID — PHASE 9A: SUMMARY REPORT
## Threat States, Ambush & Major Landmark Scene System

- **Repository & Branch:** `C:\Users\hih\Documents\antiDark` (`main`, built directly on top of Phase 8.1)
- **Safety Checkpoint Tag:** `pre-phase-9a` (`de2a3ec`) + non-destructive SQLite backup in `db/backups/pre-phase-9a/`
- **Database Migration:** `db/migrations/017_phase9a_threat_zones_and_landmark_scenes.sql` (applied non-destructively; zero character deletions or resets)
- **Status:** Complete, verified with **284 / 284 automated tests** and **21 / 21 headless Chrome Visual QA screenshots** (`7/7` Phase 9A + `14/14` Phase 8 regression)

---

## 1. Executive Summary

Phase 9A upgrades Darkgrid’s exploration threat engine and major location arrival presentation directly inside `action-ui-lab`:

1. **Three Distinct Travel Outcomes (`NORMAL`, `ENCOUNTER`, `AMBUSH`):**
   - **`NORMAL`**: The hero advances cleanly along the 30×30 map without interruption.
   - **`ENCOUNTER` (Hero Spots Monster First)**: Opens the pre-combat Encounter screen (`status = 'DISCOVERED', is_ambush = 0, spotted_by_hero = 1`) with situational clues and qualitative class/tier Monster Knowledge (never leaking secret numbers such as exact HP, AC, or attack bonuses). The player chooses **Fight** (`FIGHT` / `INVESTIGATE` / `ENGAGE`) or **Avoid** (`AVOID` / `IGNORE` / `BYPASS`). Choosing **Avoid** grants `0 XP` and `0 loot`, and the monster does not attack. Choosing **Fight** starts normal combat (`is_ambush = 0`) and is strictly guaranteed **never** to mutate into an Ambush.
   - **`AMBUSH` (Monster Spots Hero First)**: Skips the Avoid screen and enters active combat immediately (`status = 'IN_COMBAT', combat_round = 1, is_ambush = 1, spotted_by_hero = 0`) with a prominent **`AMBUSH!`** banner. Retreat (`FLEE`) is **locked on the server for the first two full combat rounds (Rounds 1 and 2)** (`HTTP 400`, `code = 'AMBUSH_FLEE_LOCKED'`). Starting on **Round 3 (`combat_round >= 3`)**, `FLEE` unlocks and uses standard Attack-of-Opportunity (AoO) retreat rules.

2. **Data-Driven Danger Zones (`danger_zone_profiles`):**
   - Threat probability, ambush share, monster pools, and streak protection are stored in SQLite (`danger_zone_profiles`) and evaluated per tile:
     - **Oakhaven (`OAKHAVEN_SAFE`):** `0%` encounter rate, `0%` ambush share (`Safe`).
     - **Main Forest Road (`GOBLIN_FOREST_ROAD`):** `18%` base encounter rate, `28%` ambush share (`Medium`).
     - **Off-Road Forest (`GOBLIN_FOREST_OFF_ROAD`):** `24%` base encounter rate, `38%` ambush share (`High`).
     - **Goblin Hunting Grounds (`GOBLIN_HUNTING_GROUNDS`):** `32%` base encounter rate, `45%` ambush share (`Very High`).
     - **Near Goblin Stronghold (`STRONGHOLD_APPROACH`):** `34%` base encounter rate, `48%` ambush share (`Very High`).
   - Calibrated with streak dampening so a standard trip from Oakhaven `[15, 27]` to Goblin Stronghold `[15, 2]` averages **`4.36` to `6.18` threat events** depending on route choice.

3. **Class Identity Preserved:**
   - **Ranger:** Retains wider map vision (`radius 4` vs `3`), higher perception bonus (`WIS mod + 3`), and **Trail-Sense Ambush Conversion** (`50%` chance to convert a potential Ambush into a spotted `ENCOUNTER` with `ambushFoiledByRanger = true`), plus Opening Shot on spotted encounters.
   - **Fighter:** Retains combat durability, *Know Your Enemy* passive Monster Knowledge (+1 effective knowledge tier), and *Second Wind* (Level 3+).
   - **Cleric:** Retains *Holy Radiance* vs. Undead, *Battle Prayer*, *Divine Charges*, *Sacred Smite*, and *Divine Shield*.

4. **Major Landmark Scene System (`landmark_scene_definitions`):**
   - Automatically opens a full-viewport environmental artwork scene in `#fp-viewport` (temporarily yielding the 2D map canvas) when the hero arrives at a Major Landmark:
     - **Oakhaven (`[15, 27]`):** Displays `terrain_city_oakhaven.webp` with **Rest / Heal**, **Shop**, **Quests & Bounties**, contextual Quest Accept/Claim button, and **Continue Exploring**.
     - **Goblin Stronghold (`[15, 2]`):** Displays `terrain_town_gates.webp` with **Challenge the Goblin Chieftain** and **Continue Exploring**.
   - **Strict Anti-Interruption Rules:**
     - Never opens for minor landmarks (bridges, crossroads, shrines, trees, watchposts).
     - Never re-opens on UI refreshes, resting, buying/selling, or closing modals while remaining on the same tile (`dismissed_landmark_tile_id`).
     - Re-opens cleanly when the hero leaves the landmark tile and returns later.
     - **Combat and Landmark Scene are never active simultaneously.**
