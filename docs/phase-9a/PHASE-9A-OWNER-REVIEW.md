# DARKGRID — PHASE 9A: OWNER REVIEW & PHASE 9B DECISION BRIEF
## Ambush & Encounter Frequency, Flee Mechanics, Landmark Scenes & Open Decisions

---

## 1. Actual Frequency of `ENCOUNTER` vs. `AMBUSH`

Across **1,000 Monte Carlo trips** from **Oakhaven `[15, 27]`** to **Goblin Stronghold `[15, 2]`**:

1. **Standard Level 2+ Hero (Fighter / Cleric):**
   - **Route A (Main Forest Road — 31 steps):**
     - **Total Threat Events:** **`4.36` per trip** (median `4`, 10th–90th percentile `3–6`).
     - **Spotted `ENCOUNTER` (Optional Fight or Avoid):** **`2.76` per trip (`63.3%`)**.
     - **Forced `AMBUSH` (Immediate Combat, No Avoid):** **`1.60` per trip (`36.7%`)**.
   - **Route B (Western Off-Road Wilderness — 43 steps):**
     - **Total Threat Events:** **`5.98` per trip** (`3.81` Spotted Encounters + `2.17` Forced Ambushes).
   - **Route C (Eastern River & Hunting Grounds — 45 steps):**
     - **Total Threat Events:** **`6.18` per trip** (`3.96` Spotted Encounters + `2.22` Forced Ambushes).

2. **Ranger Scouting Advantage (Level 2+ Ranger on Route A):**
   - **Total Threat Events:** **`4.41` per trip**.
   - **Spotted `ENCOUNTER`:** **`4.03` per trip (`91.4%`)**.
   - **Forced `AMBUSH`:** **`0.38` per trip (`8.6%`)**.
   - Ranger’s `+3` perception bonus + `50%` Trail-Sense conversion (`ambushFoiledByRanger = true`) converts the majority of potential ambushes into spotted Encounters where the Ranger can either `Avoid` or initiate with **Opening Shot**.

---

## 2. How `Flee` Works (Normal Combat vs. Ambush)

1. **Spotted `ENCOUNTER` (`DISCOVERED` Screen):**
   - Before combat starts, the player can choose **Avoid** (`AVOID` / `4` / `F`) to slip past the creature with **no Attack of Opportunity**, **0 XP**, and **0 loot**, or choose **Fight** (`FIGHT` / `Space` / `1`) to start combat on their own terms (`isAmbush = false`).
   - If the player chooses **Fight**, `Flee` is available from **Round 1** onward using standard Attack-of-Opportunity (AoO) retreat rules.

2. **Forced `AMBUSH` (`IN_COMBAT` Immediately):**
   - Combat begins immediately at **Round 1** with the **`AMBUSH!`** banner; there is no `Avoid` option.
   - **Rounds 1 & 2 (`combat_round <= 2`) — Server-Enforced Lock:**
     - The hero **cannot flee** during the first two full combat rounds.
     - Both the UI button (`🔒 Flee Locked — Ambush (2 Rds Left)`) and the server endpoint (`POST /api/action { action: 'FLEE' }` -> `HTTP 400 AMBUSH_FLEE_LOCKED`) enforce this rule.
   - **Round 3+ (`combat_round >= 3`) — Flee Unlocks:**
     - Once two full combat rounds have been resolved (`combat_round = 3`), the ambush lock expires (`⚡ AMBUSH SURVIVED (ROUND 3) — RETREAT PATH IS NOW OPEN`).
     - Pressing **Flee Battle** (`4 / F`) executes the standard Darkgrid retreat roll (provoking one parting Attack of Opportunity from the monster before escaping if the hero survives).

---

## 3. Which Locations Open Automatic Major Landmark Scenes

Only **Major Landmarks** (`is_major_landmark = 1` and `auto_open_on_arrival = 1` in `landmark_scene_definitions`) open a full-viewport scene in `#fp-viewport`:

| Location | Coordinates | Category | Auto-Opens Scene? | Scene Artwork | Available Actions |
|---|---|---|---|---|---|
| **Oakhaven Sanctuary** | `[15, 27]` | `CITY` | **Yes (Major Landmark)** | `terrain_city_oakhaven.webp` | `Rest / Heal`, `Shop [M]`, `Quests & Bounties [J]`, contextual Quest Accept/Claim, `Continue Exploring` |
| **Goblin Stronghold** | `[15, 2]` | `BOSS_AREA` | **Yes (Major Landmark)** | `terrain_town_gates.webp` | `Challenge the Goblin Chieftain`, `Continue Exploring` |
| *Old Stone Bridge* | `[19, 25]` | `BRIDGE` (Minor) | **No** | — | Keeps 2D map active without interruption |
| *Blackwood Crossroads* | `[15, 23]` | `CROSSROADS` (Minor) | **No** | — | Keeps 2D map active without interruption |
| *Ancient Black Oak* | `[15, 15]` | `LANDMARK` (Minor) | **No** | — | Keeps 2D map active without interruption |
| *Abandoned Watchpost / Broken Shrine / Old Log Crossing* | `[21, 25]`, `[7, 17]`, `[20, 9]` | Minor Landmarks | **No** | — | Keeps 2D map active without interruption |

- **Future-Ready Schema:** `landmark_scene_definitions` is also pre-seeded with inactive templates for future Phase 9B+ `DUNGEON_ENTRANCE` (`ANCIENT_DUNGEON_ENTRANCE`) and `CRYPT` (`SUNKEN_CRYPT`) major landmarks.

---

## 4. Decisions Required from Owner Before Phase 9B Begins

Please review and confirm your preferences on the following items before we proceed to **Phase 9B**:

1. **Level 1 Ambush Protection Policy:**
   - Currently, **Level 1 Ambush Protection is preserved** (`Level 1` heroes have potential Ambushes downgraded to spotted `ENCOUNTER`s so they are not locked into a 2-round no-flee Ambush at 10–14 HP; full Ambushes activate at `Level 2+`).
   - **Decision:** Keep Level 1 Ambush Protection across the entire forest, OR allow Ambushes against Level 1 heroes specifically inside **Very High** danger zones (`Goblin Hunting Grounds` and `Near Goblin Stronghold`)?
2. **Danger Zone Pacing (`~4.4` threats on Main Road vs. `~6.0` Off-Road):**
   - **Decision:** Does the `4.36` average threat count (`2.76` Encounters + `1.60` Ambushes) on the Main Forest Road feel right, or would you like the Ambush share adjusted up or down?
3. **Next Major Landmark Scenes for Phase 9B:**
   - **Decision:** Which additional locations (e.g., a Crypt, Dungeon Entrance, or Ancient Black Oak sub-boss shrine) should be promoted to full Major Landmark Scenes in Phase 9B?
