# DARKGRID — PHASE 9A: THREAT & DANGER ZONE BALANCE REPORT
## Danger Zone Profiles, Monte Carlo Simulations & Class Scouting Comparison

---

## 1. Data-Driven Danger Zone Profiles (`danger_zone_profiles`)

Every tile in the 30×30 world resolves to one of five data-driven Danger Zone profiles based on terrain, road connectivity, landmark identity, and proximity to the Goblin Stronghold `[15, 2]`:

| Zone Key | Zone Name | Danger Level | Base Encounter Rate | Base Ambush Share | Min Steps Between Combats | Streak Dampening / Event | Primary Monster Pool |
|---|---|---:|---:|---:|---:|---:|---|
| `OAKHAVEN_SAFE` | Oakhaven Sanctuary & Gate | **None** | `0.0%` | `0.0%` | `0` | `0.0%` | None |
| `GOBLIN_FOREST_ROAD` | Goblin Forest — Main Road | **Medium** | `18.0%` | `28.0%` | `1` | `7.0%` | Goblin, Dire Rat, Wolf, Bandit, Skeleton |
| `GOBLIN_FOREST_OFF_ROAD` | Goblin Forest — Off-Road | **High** | `24.0%` | `38.0%` | `1` | `7.0%` | Goblin, Wolf, Giant Spider, Hobgoblin, Boar |
| `GOBLIN_HUNTING_GROUNDS` | Goblin Hunting Grounds | **Very High** | `32.0%` | `45.0%` | `1` | `8.0%` | Goblin, Hobgoblin, Bugbear, Worg, Wolf |
| `STRONGHOLD_APPROACH` | Near Goblin Stronghold | **Very High** | `34.0%` | `48.0%` | `1` | `8.0%` | Goblin, Hobgoblin, Bugbear, Worg, Hobgoblin Captain |

### Anti-Streak Protection
- **`minStepsBetweenCombats = 1`**: Prevents back-to-back forced combat on consecutive steps immediately after resolving a battle.
- **`streakDampeningPerEvent` (`7%–8%`, capped at `14%`)**: Temporarily reduces raw encounter probability after consecutive threat events so the player is not locked in an unplayable RNG spike, while still ensuring the forest feels genuinely dangerous.

---

## 2. Monte Carlo Route Simulation (`1,000` Trips per Route, Level 2 Hero)

Using `runPhase9MonteCarloSimulation` (`1,000` trips from Oakhaven `[15, 27]` to Goblin Stronghold `[15, 2]`):

| Route | Total Steps | Avg Total Threats | Median Threats | P10–P90 Range | Avg Spotted `ENCOUNTER` (Optional Fight/Avoid) | Avg Forced `AMBUSH` (Immediate Combat) | `ENCOUNTER` Share | `AMBUSH` Share |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Route A — Main Forest Trail** | `31` | **`4.36`** | `4` | `3 – 6` | **`2.76`** | **`1.60`** | `63.3%` | `36.7%` |
| **Route B — Western Off-Road Wilderness** | `43` | **`5.98`** | `6` | `4 – 8` | **`3.81`** | **`2.17`** | `63.6%` | `36.4%` |
| **Route C — Eastern River & Hunting Grounds** | `45` | **`6.18`** | `6` | `4 – 8` | **`3.96`** | **`2.22`** | `64.1%` | `35.9%` |

### Key Takeaways
- A standard journey along the **Main Forest Trail (Route A)** produces **`4.36` threat events** on average (`median 4`, `P10=3`, `P90=6`), right inside the Phase 9A target window of **4–6 threat events per trip**.
- Because ~`36.7%` of threats on Route A (`1.60` per trip) and `>2.1` per trip on off-road routes are forced **Ambushes**, a player **cannot** simply click Avoid through the entire forest without fighting.

---

## 3. Class Scouting Comparison: Fighter/Cleric vs. Ranger (`1,000` Trips on Route A)

| Hero Class (Level 2) | Avg Total Threats | Avg Spotted `ENCOUNTER` | Avg Forced `AMBUSH` | `ENCOUNTER` Share | `AMBUSH` Share | Ambushes Converted by Ranger Trail-Sense |
|---|---:|---:|---:|---:|---:|---:|
| **Fighter / Cleric** | `4.36` | `2.76` | `1.60` | `63.3%` | `36.7%` | `0` |
| **Ranger** (`+3` Perception + `50%` Trail-Sense) | `4.41` | **`4.03`** | **`0.38`** | **`91.4%`** | **`8.6%`** | **`360`** (across 1,000 trips) |

- **Ranger Identity:** The Ranger spots danger first on **`91.4%`** of threats (`4.03` Encounters vs. only `0.38` Ambushes per trip), converting more than half of remaining ambushes into spotted Encounters where the Ranger can either slip past (`Avoid`) or initiate with **Opening Shot** (`Fight`).

---

## 4. Level 1 Ambush Protection Analysis (`1,000` Trips on Route A)

| Configuration | Avg Total Threats | Avg Spotted `ENCOUNTER` | Avg Forced `AMBUSH` | Ambushes Downgraded by Lvl 1 Protection |
|---|---:|---:|---:|---:|
| **Level 1 Hero — Protection Active (Current Default)** | `4.36` | **`4.36` (`100%`)** | **`0.00` (`0%`)** | `1,599` (across 1,000 trips) |
| **Level 1 Hero — If Protection Disabled (`allowLevel1Ambush = true`)** | `4.36` | `2.76` (`63.3%`) | `1.60` (`36.7%`) | `0` |

- **Why Level 1 Ambush Protection is Preserved by Default:** At Level 1 (`10–14 HP`), a 2-round Flee-locked Ambush against a high-roll Goblin or Wolf in `VERY_HIGH` zones carries a significant permadeath spike before the hero has earned their first level or potion reserve. Preserving Level 1 Ambush Protection by default ensures newly created Level 1 heroes always get the `ENCOUNTER` choice (`Fight` or `Avoid`) until reaching Level 2, while allowing the owner to review whether to enable reduced Level 1 ambushes in `VERY_HIGH` zones for Phase 9B.
