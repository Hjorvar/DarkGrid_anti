# DARKGRID — PHASE 9A: AUTOMATED TEST REPORT
## Verification of All 11 Phase 9A Scenarios & Legacy Regression Suites

---

## 1. Test Execution Summary

| Test Suite | Command | Tests | Passed | Failed | Status |
|---|---|---:|---:|---:|---|
| **Phase 9A Threat States, Ambush & Landmarks** | `node --test action-ui-lab/tests/phase9a-threat-and-landmarks.test.js` | `8` (covering all 11 scenarios) | `8` | `0` | **PASS** |
| **Phase 8 Top-Down Exploration & 7C Parity** | `node --test action-ui-lab/tests/topdown-experiment.test.js` | `9` | `9` | `0` | **PASS** |
| **Phase 8 World Architecture & Systems** | `node --test action-ui-lab/tests/phase8-world-and-systems.test.js` | `7` | `7` | `0` | **PASS** |
| **Monster Artwork & PF1e Size Scaling** | `node --test action-ui-lab/tests/monster-artwork.test.js action-ui-lab/tests/monster-scaling.test.js` | `16` | `16` | `0` | **PASS** |
| **Core Domain, Combat, Security & Persistence** | `npm test` (`tests/*.test.js`) | `244` | `244` | `0` | **PASS** |
| **TOTAL AUTOMATED TESTS** | | **`284`** | **`284`** | **`0`** | **100% PASS** |

---

## 2. Detailed Coverage of the 11 Required Phase 9A Scenarios

Tested in `action-ui-lab/tests/phase9a-threat-and-landmarks.test.js`:

1. **Scenario 1 — Normal Movement (`NORMAL`):**
   - Verified stepping along the forest trail with `NORMAL` outcome advances character coordinates cleanly (`[15, 27] -> [15, 26] -> [15, 25]`), creates no encounter record (`state.encounter === null`), and keeps `state.mode === 'EXPLORATION'`.

2. **Scenario 2 — `ENCOUNTER -> Fight`:**
   - Verified stepping into a forest tile with `ENCOUNTER` sets `status = 'DISCOVERED'`, `travelOutcome = 'ENCOUNTER'`, `isAmbush = false`, `spottedByHero = true`, and conceals exact combat numbers (`monster_ac === undefined`, `current_monster_hp === undefined`).
   - Verified sending `FIGHT` (`INVESTIGATE` / `ENGAGE`) transitions to `status = 'IN_COMBAT'` with `isAmbush = false`, `fleeLocked = false`, `canFlee = true`. Confirmed that `ENCOUNTER -> Fight` **never** turns into an Ambush.

3. **Scenario 3 — `ENCOUNTER -> Avoid`:**
   - Verified sending `AVOID` (`IGNORE` / `BYPASS`) on a spotted `ENCOUNTER` marks the encounter `ESCAPED`, clears `state.encounter = null`, returns to `EXPLORATION`, deals `0` monster damage (`current_hp` unchanged), and grants `0 XP`, `0 gold`, and `0 items`.

4. **Scenario 4 — `AMBUSH -> Flee Locked` (Rounds 1 & 2):**
   - Verified `AMBUSH` outcome skips the `DISCOVERED` Avoid screen and enters `status = 'IN_COMBAT'` at `combat_round = 1` with `isAmbush = true`, `fleeLocked = true`, `canFlee = false`, `ambushFleeLockedRoundsRemaining = 2`, and `AMBUSH!` info banner.
   - Verified server-side enforcement: sending `POST /api/action { action: 'FLEE' }` during Round 1 and Round 2 is rejected by the server with `HTTP 400` (`AMBUSH! You cannot flee during the first 2 combat rounds`).

5. **Scenario 5 — `AMBUSH -> Flee Unlocks After Two Full Rounds` (Round 3+):**
   - Verified that after executing Round 1 (`ATTACK`) and Round 2 (`ATTACK`), the encounter reaches `combat_round = 3` where `fleeLocked = false`, `canFlee = true`, `ambushFleeLockedRoundsRemaining = 0`.
   - Verified sending `FLEE` in Round 3 succeeds on the server using standard Attack-of-Opportunity (AoO) retreat rules.

6. **Scenario 6 — Ranger Scouting:**
   - Verified across 400 simulated trips that a Level 2 Ranger (`avgAmbushes = 0.38`, `91.4%` spotted Encounters) converts more than 50% of potential ambushes into spotted Encounters compared to a Level 2 Fighter (`avgAmbushes = 1.60`), while retaining `visionRadius = 4` vs. `3`.

7. **Scenario 7 — Level 1 Threat Balance & Protection:**
   - Verified Level 1 Ambush Protection downgrades potential ambushes to spotted Encounters (`avgAmbushes = 0`, `level1AmbushProtections > 0`) in normal play, while Level 2+ heroes experience `4.36` average threat events (`~2.76` Encounters + `~1.60` Ambushes) on Route A.

8. **Scenario 8 — Oakhaven Automatic Major Landmark Scene:**
   - Verified arrival at Oakhaven `[15, 27]` sets `state.landmarkScene.isActive = true`, `sceneKey = 'OAKHAVEN'`, with actions `REST_HEAL`, `OPEN_SHOP`, `OPEN_QUESTS`, and `CONTINUE_EXPLORING`.

9. **Scenario 9 — Goblin Stronghold Automatic Major Landmark Scene:**
   - Verified arrival at Goblin Stronghold `[15, 2]` sets `state.landmarkScene.isActive = true`, `sceneKey = 'GOBLIN_STRONGHOLD'`, with actions `CHALLENGE_CHIEFTAIN` and `CONTINUE_EXPLORING`.

10. **Scenario 10 — Anti-Interruption Rules (No Repeated Scene Popups Without New Arrival):**
    - Verified clicking **Continue Exploring** (`DISMISS_LANDMARK_SCENE`) sets `landmarkScene.isActive = false`.
    - Verified executing `REST`, `ACCEPT_QUEST`, or modal actions on the same tile does **not** re-open the Landmark Scene.
    - Verified stepping away (`[15, 26]`) and stepping back into Oakhaven (`[15, 27]`) automatically re-opens the Landmark Scene.
    - Verified minor landmarks (`Old Stone Bridge [19, 25]`, `Blackwood Crossroads [15, 23]`, `Ancient Black Oak [15, 15]`) never trigger a Major Landmark Scene (`state.landmarkScene === null`).
    - Verified **Combat and Landmark Scene are never active simultaneously** (`ENGAGE_STRONGHOLD_BOSS` sets `mode = 'IN_COMBAT'` and `landmarkScene = null`).

11. **Scenario 11 — Combat, Permadeath, Reload & Nemesis Persistence:**
    - Verified active Ambush combat state (`combat_round`, `fleeLocked`, `isAmbush`) persists across `GET /api/state` reloads.
    - Verified falling in Ambush combat sets `mode = 'FALLEN'`, `is_alive = 0`, and promotes the victorious monster to an active persistent Nemesis instance (`monster_instances`) on that tile.
