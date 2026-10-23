# DARKGRID — PHASE 9A: TECHNICAL IMPLEMENTATION
## Architecture, Database Schema, Server Authority & Frontend Integration

---

## 1. Non-Destructive Database Schema (`017_phase9a_threat_zones_and_landmark_scenes.sql`)

Phase 9A extends SQLite non-destructively via `db/migrations/017_phase9a_threat_zones_and_landmark_scenes.sql` and `action-ui-lab/server/services/legacy-compatibility-service.js`:

1. **New Character Columns (`characters`):**
   - `active_landmark_scene_key TEXT DEFAULT NULL` — Tracks the currently open Major Landmark Scene (`'OAKHAVEN'`, `'GOBLIN_STRONGHOLD'`, or future major landmarks).
   - `dismissed_landmark_tile_id INTEGER DEFAULT NULL` — Tracks the tile ID where the player clicked **Continue Exploring** (`DISMISS_LANDMARK_SCENE`), preventing the scene from re-opening on subsequent UI actions (`REST`, `BUY`, `SELL`, `ACCEPT_QUEST`, modal close) while remaining on that tile.

2. **`danger_zone_profiles` Table:**
   - Stores data-driven threat parameters per zone:
     - `zone_key TEXT PRIMARY KEY`
     - `zone_name TEXT NOT NULL`
     - `danger_level TEXT NOT NULL` (`NONE`, `MEDIUM`, `HIGH`, `VERY_HIGH`)
     - `danger_label TEXT NOT NULL`
     - `encounter_rate REAL NOT NULL`
     - `ambush_share REAL NOT NULL`
     - `min_steps_between_combats INTEGER NOT NULL`
     - `streak_dampening_per_event REAL NOT NULL`
     - `monster_pool_json TEXT NOT NULL`
     - `description TEXT`

3. **`landmark_scene_definitions` Table:**
   - Stores data-driven Major Landmark Scene definitions (including future-ready categories `CITY`, `BOSS_AREA`, `DUNGEON_ENTRANCE`, `CRYPT`):
     - `scene_key TEXT PRIMARY KEY`
     - `landmark_type TEXT NOT NULL`
     - `category TEXT NOT NULL`
     - `title TEXT NOT NULL`
     - `subtitle TEXT`
     - `description TEXT`
     - `artwork_url TEXT NOT NULL`
     - `is_major_landmark INTEGER NOT NULL DEFAULT 1`
     - `auto_open_on_arrival INTEGER NOT NULL DEFAULT 1`
     - `actions_json TEXT NOT NULL DEFAULT '[]'`

---

## 2. Server-Side Travel Outcome & Combat Authority

### A. Three Travel Outcomes (`computePhase9ThreatDecision` & `checkGoblinForestEncounter`)
Located in `action-ui-lab/server/services/topdown-world-service.js`:
- Resolves the destination tile’s Danger Zone profile via `resolveTileDangerZone(db, targetTile)`.
- Evaluates `encounterChancePercent` with streak dampening (`recentThreatStreak * streakDampeningPerEvent`).
- When a threat triggers:
  - Evaluates whether the monster spots the hero first (`AMBUSH`) or the hero spots the monster first (`ENCOUNTER`) using the zone’s `ambushShare` combined with a `d20 + WIS_mod` perception check against stealth DC.
  - **Ranger Scouting Identity:** Rangers gain `+3` perception and a `50%` Trail-Sense conversion roll (`ambushFoiledByRanger = true`) that converts a would-be `AMBUSH` into a spotted `ENCOUNTER`.
  - **Level 1 Ambush Protection:** Preserved by default in normal play (`character.level <= 1` downgrades `AMBUSH` to spotted `ENCOUNTER` with `level1AmbushProtected = true`, unless explicitly overridden by test/lab flags).
  - If the final outcome is `AMBUSH`, `checkGoblinForestEncounter` immediately calls `startCombat(db, character.id, encId, { rng })` within the movement transaction so the encounter transitions straight into `status = 'IN_COMBAT', combat_round = 1` with an `'AMBUSH'` combat log banner.

### B. `ENCOUNTER -> Fight` Non-Ambush Guarantee
Located in `src/domain/encounters/engine.js` (`investigateEncounter`) and `src/domain/combat/engine.js` (`startCombat`):
- When an encounter is created with `travelOutcome = 'ENCOUNTER'` (`spotted_by_hero = 1, is_ambush = 0`), `hasExplicitAmbushOverride(encounter)` detects that the outcome was already determined at discovery time.
- Choosing **Fight** (`FIGHT`, `INVESTIGATE`, `ENGAGE`) preserves `is_ambush = 0` and `spotted_by_hero = 1`—it **never** re-rolls initiative into a surprise Ambush.

### C. Server-Enforced 2-Round Ambush Flee Lock
Located in `src/domain/combat/engine.js` (`getCombatState` and `executeCombatRound`) and `action-ui-lab/server/controllers/combat-controller.js`:
- `getCombatState` computes:
  - `fleeLocked = isAmbush && combatRound <= 2`
  - `ambushFleeLockedRoundsRemaining = isAmbush ? Math.max(0, 3 - combatRound) : 0`
  - `canFlee = !fleeLocked`
- `executeCombatRound(db, characterId, encounterId, 'FLEE', options)`:
  - When `Boolean(encounter.is_ambush) && Number(encounter.combat_round || 1) <= 2`, throws an error with `err.code = 'AMBUSH_FLEE_LOCKED'` and `err.httpStatus = 400` (`"AMBUSH! You cannot flee during the first 2 combat rounds (1–2 round(s) remaining)."`).
  - Once Round 1 and Round 2 have completed (`combat_round >= 3`), `FLEE` is permitted and executes the standard Attack-of-Opportunity (AoO) retreat roll.

---

## 3. Major Landmark Scene State Machine

Implemented in `action-ui-lab/server/services/topdown-world-service.js` (`getMajorLandmarkSceneForTile`, `updateCharacterLandmarkArrival`, `dismissLandmarkScene`, `openLandmarkScene`, `resolveLandmarkSceneState`) and `action-ui-lab/server/services/client-state-service.js`:
- **Arrival Detection:** `updateCharacterLandmarkArrival(db, characterId, fromTileId, toTile)` triggers only when `fromTileId !== toTile.id`. If `toTile` is a Major Landmark (`OAKHAVEN` `[15, 27]` or `GOBLIN_STRONGHOLD` `[15, 2]`), it sets `active_landmark_scene_key = sceneKey` and clears `dismissed_landmark_tile_id = NULL`.
- **Continue Exploring (`DISMISS_LANDMARK_SCENE`):** Sets `active_landmark_scene_key = NULL` and records `dismissed_landmark_tile_id = currentTile.id`.
- **Anti-Interruption Guarantee:** While `dismissed_landmark_tile_id === currentTile.id`, any non-movement action (`REST`, `BUY_ITEM`, `SELL_ITEM`, `EQUIP_ITEM`, `ACCEPT_QUEST`, `CLAIM_QUEST_REWARD`, or closing modals) keeps `landmarkScene.isActive = false`.
- **Combat Exclusivity:** In `client-state-service.js`, `landmarkScene` is only resolved when `!activeEncounter && !victoryOverlay`. During `DISCOVERED` or `IN_COMBAT`, `state.landmarkScene` is strictly `null`.
