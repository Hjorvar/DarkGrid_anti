# DARKGRID ADVENTURE LAB — PHASE 2 ENCOUNTER PACING ANALYSIS
## Workstream B: Audit, Calibrated Pacing Model & 500-Seed Deterministic Simulation

**Scope:** `action-ui-lab/adventure-engine.js`, `action-ui-lab/server.js`, `action-ui-lab/tests/world-travel.test.js`  
**Status:** Implemented & Verified (`500` deterministic seed runs per scenario, `baseSeed: 202602`)

---

## 1. Workstream B1 — Audit of the Pre-Phase 2 Encounter System

Before Phase 2, `server.js` invoked `checkTileEncounter(db, character, targetTile, rng)` from `src/domain/encounters/service.js` on every passable `MOVE` action without passing a `forcedChance` parameter:

```js
// Pre-Phase 2 behavior in src/domain/encounters/service.js:
let encounterChance = options.forcedChance !== undefined ? options.forcedChance : 25;
if (options.forcedChance === undefined && activeContract) {
  encounterChance = 40;
}
```

### Audit Findings Table (What Existed vs. What Was Missing)

| Rule / Mechanism | Pre-Phase 2 Status | Audit Finding |
| :--- | :--- | :--- |
| **Base Encounter Probability** | Flat `25%` (`40%` with regional bounty) | Every passable non-city step rolled a flat `25%` (`1-in-4` steps), regardless of biome danger, exploration history, or recent combat. |
| **Terrain-Specific Encounter Rates** | **Missing** (only monster pool filtered by terrain) | `PLAINS`, `BRIDGE`, `FOREST`, `HILLS`, `SWAMP`, and `UNDERGROUND_RUINS` all used the exact same `25%` step probability. |
| **Town Gate Threshold (`[7,6]` & `[7,8]`)** | **Unprotected (`25%`)** | Oakhaven's North Gate `[7,6]` and South Gate `[7,8]` have `is_safe = 0` in `map_tiles`, so stepping 1 tile out of Oakhaven `[7,7]` had an immediate `25%` ambush/encounter rate on the gate threshold itself. |
| **Rotation in Place (`Q/E`, `LEFT/RIGHT/BACK`)** | `0%` (Handled in `TURN`) | `TURN` actions never called `checkTileEncounter`. Verified safe (`0%`). |
| **Post-Encounter Breathing Room** | Tracked in `advState`, **not wired to RNG** | `advState.postCombatBreathingSteps` and `advState.stepsSinceLastEncounter` were tracked for narrative tension cues, but `server.js` still rolled a full `25%` encounter check on the very next step (`1.27` back-to-back encounters per 20 forest steps). |
| **2-Tile Back-and-Forth Oscillation (`A ↔ B ↔ A`)** | Guarded discoveries only, **not encounters** | `isOscillatingBetweenTiles` suppressed *environmental discoveries*, but stepping back and forth between two adjacent tiles (`[7,5] ↔ [7,4]`) rolled `25%` every step (`7.53` encounters in 30 steps), making 2-tile oscillation a trivial XP/loot farming exploit and a frustrating backtracking trap. |
| **Revisit to Known Safe Tile (`FAMILIAR_SAFE`)** | Tracked in UI, **no encounter dampening** | Retracing a known corridor back toward Oakhaven had the same `25%` encounter rate as pushing into unexplored frontier (`2.49` encounters on 10 return steps vs `2.41` outbound). |
| **Recently Cleared Site (`CLEARED_SITE`)** | Tracked in `tileRevisitMap`, **no encounter protection** | Defeating an enemy marked the tile `CLEARED_SITE` in the UI (`✓ Secured Ground`), yet stepping back onto that exact tile 2 steps later still rolled a `25%` random encounter. |
| **Lingering Threat Site (`LINGERING_THREAT_SITE`)** | Tracked in `tileRevisitMap` + `monster_instances` | Fleeing Stage 2 combat leaves an `ACTIVE` persistent monster (`100%` re-encounter); slipping past a Stage 1 `DISCOVERED` threat marks `hasLingeringThreat = true`. |
| **Persistent & Authored Encounters** | `100%` deterministic priority | `getActiveMonstersOnTile` in `checkTileEncounter` guarantees `100%` engagement when an active `monster_instance` is on the tile. |

---

## 2. Workstream B2 & B3 — Calibrated Encounter Pacing Model (`ENCOUNTER_PACING_CONFIG`)

Rather than rewriting `src/domain/encounters/service.js` (outside `action-ui-lab/`), we leveraged its existing `options.forcedChance` hook in `action-ui-lab/server.js` and implemented `computeEncounterPacingChance(db, character, currentTile, targetTile, options)` in [`adventure-engine.js`](../../adventure-engine.js).

### Configurable Parameters (`ENCOUNTER_PACING_CONFIG`)

| Parameter | Value | Design Rationale |
| :--- | :--- | :--- |
| `terrainBaseChancePercent.CITY` | `0%` | Safe sanctuary (`Oakhaven [7,7]`) never spawns encounters. |
| `terrainBaseChancePercent.PLAINS` / `BRIDGE` | `16%` | Open sightlines and patrolled roads/bridges feel noticeably safer than dense woods. |
| `terrainBaseChancePercent.FOREST` / `HILLS` | `22%` | Standard wilderness frontier danger (Mirkwood, Raven Crags). |
| `terrainBaseChancePercent.SWAMP` / `JUNGLE` | `28%` | Oppressive, high-risk mire and overgrown wetlands (Rotting Fen). |
| `terrainBaseChancePercent.UNDERGROUND_RUINS` | `30%` | Highest baseline danger in ruined depths. |
| `highDangerLandmarks` (`[7,3]`, `[9,7]`, `[4,11]`) | `30%` | Major expedition focal points (Heart of the Mirkwood, Bridge East Watchpost, Deadman's Mire) carry heightened danger on first approach. |
| `townGateDepartureGraceChancePercent` | `0%` | Stepping directly out of Oakhaven Sanctuary `[7,7]` onto North Gate `[7,6]` or South Gate `[7,8]` is a guaranteed `0%` threshold step so the player can orient at the gate before entering the wilds. |
| `townGateReentryChancePercent` | `8%` | Approaching the town gates from the wilderness carries only a low `8%` perimeter risk. |
| `postEncounterImmediateCooldownSteps` | `1 step @ 0%` | Immediately after resolving or slipping past an encounter, the very next movement step is `0%` (`POST_ENCOUNTER_BREATHING_STEP`), completely eliminating frustrating back-to-back random encounters (`0.00` back-to-back). |
| `postEncounterSoftRecoveryStep` | `Step 2 @ 0.40x` | The second step after an encounter applies a `0.40x` soft recovery multiplier before full frontier tension resumes on step 3. |
| `clearedSiteProtectedSteps` | `8 steps @ 0%` | A tile where the hero defeated an enemy (`CLEARED_SITE`) is protected at `0%` random encounter chance for `8` steps (`RECENTLY_CLEARED_SITE_PROTECTED`), then `0.25x` (`CLEARED_SITE_REDUCED`) thereafter. |
| `familiarSafeRevisitMultiplier` | `0.45x` | Stepping onto an already-explored safe tile (`FAMILIAR_SAFE`) scales random encounter probability by `0.45x` (e.g., `22% → 9.9%` in forest), making backtracking noticeably calmer without making the world lifeless. |
| `lingeringThreatRevisitMultiplier` | `1.25x` | Returning to a tile where a Stage 1 threat was bypassed (`LINGERING_THREAT_SITE`) increases encounter chance by `1.25x`. |
| `immediateBacktrackCapPercent` | `3.5%` | A single immediate reversal (`A → B → A`) is capped at `3.5%` (`IMMEDIATE_BACKTRACK_DAMPENED`). |
| `oscillationZeroThresholdTail` | `>= 3` (`0%`) | Repeated 2-tile oscillation (`A → B → A → B ...`) drops random encounter probability to **`0%`** (`ANTI_OSCILLATION_SUPPRESSED`), eliminating 2-tile encounter farming. |
| `quietStreakRamp` | `+2%/step` after `5` quiet steps (max `+8%`) | On unexplored frontier tiles (`FIRST_VISIT`), if the player goes `5+` steps without an encounter, tension gently ramps by `+2%` per step (up to `+8%`), preventing dead 20-step dry spells on new terrain. |

---

## 3. Workstream B4 — Deterministic 500-Seed Simulation Results (Scenarios A–I)

Executed via `runEncounterPacingSimulation({ runs: 500, baseSeed: 202602 })` in [`adventure-engine.js`](../../adventure-engine.js) and verified automatically in Test 14 of [`world-travel.test.js`](../../tests/world-travel.test.js):

| Scenario | Travel Pattern | Baseline (Before Phase 2) Mean Encounters | Baseline Rate / Step | Phase 2 Paced Mean Encounters | Phase 2 Rate / Step | Back-to-Back Encounters (Before → After) | Key Pacing Verification |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **A** | **20 new tiles in `FOREST`** | `5.12` | `25.62%` (`3.90` steps/enc) | **`3.56`** | **`17.80%`** (`5.62` steps/enc) | `1.27` → **`0.00`** | Meaningful danger every ~5–6 steps; zero back-to-back chains. |
| **B** | **20 new tiles in `PLAINS`** | `4.93` | `24.63%` (`4.06` steps/enc) | **`2.87`** | **`14.33%`** (`6.97` steps/enc) | `1.12` → **`0.00`** | Open plains are measurably safer than forest (`2.87 < 3.56`). |
| **C** | **20 new tiles in `SWAMP`** | `5.08` | `25.41%` (`3.94` steps/enc) | **`4.07`** | **`20.33%`** (`4.91` steps/enc) | `1.22` → **`0.00`** | Swamp is measurably more dangerous than forest (`4.07 > 3.56`). |
| **D** | **10 Forest tiles out + same 10 back** | `4.90` (`2.41` out / `2.49` back) | `24.51%` | **`2.47`** (`1.79` out / **`0.68` back**) | **`12.35%`** | `1.18` → **`0.00`** | Return leg encounters drop by **72.7%** (`2.49 → 0.68`). |
| **E** | **20 rotations on the same tile** | `0.00` | `0.00%` | **`0.00`** | **`0.00%`** | `0.00` → **`0.00`** | Turning in place (`Q/E`, `A/D`, `S`) never triggers random encounters. |
| **F** | **30 steps oscillating between 2 adjacent tiles** | `7.53` | `25.09%` | **`0.24`** | **`0.81%`** | `1.85` → **`0.00`** | **96.8% reduction** (`7.53 → 0.24`); only the initial step into `[7,4]` can roll. |
| **G** | **Travel across Sanctuary & Town Gate departure** | `2.56` | `12.80%` | **`0.00`** | **`0.00%`** | `0.32` → **`0.00`** | Oakhaven Sanctuary `[7,7]` and immediate departure onto `[7,6]`/`[7,8]` are `0%`. |
| **H** | **20 steps across a recently cleared 4-tile loop** | `5.00` | `25.00%` | **`0.48`** | **`2.39%`** | `1.21` → **`0.00`** | **90.4% reduction** (`5.00 → 0.48`); `0%` within the 8-step protection window, `0.25x` thereafter. |
| **I** | **Travel through a fixed authored / persistent encounter** | `1.00` (`100%`) | `100%` | **`1.00` (`100%`)** | **`100%`** | N/A | Persistent world monsters and authored encounters always trigger at `100%` even during cooldowns. |

---

## 4. Preservation of Core Combat & Class Mechanics

- **Class Abilities Preserved:** Ranger/Rogue perception bonuses, stealth slip-past (`MOVE` during Stage 1 `DISCOVERED`), and opening ranged shots in `src/domain/encounters/service.js` remain 100% intact because `computeEncounterPacingChance` only calibrates the `forcedChance` parameter passed to `checkTileEncounter`.
- **Stage 1 Secrecy Preserved:** All triggered random encounters enter Stage 1 (`DISCOVERED`) with veiled sensory clues and silhouette presentation; monster names are never leaked prior to Stage 2 combat.
- **Persistent Monsters & Bounties Preserved:** Active `monster_instances` on a tile bypass all cooldowns (`100%` `PERSISTENT_MONSTER_ON_TILE`), and active regional `bounty_contracts` elevate the base chance to `40%` on frontier tiles while still respecting post-combat breathing steps and anti-oscillation guards.
