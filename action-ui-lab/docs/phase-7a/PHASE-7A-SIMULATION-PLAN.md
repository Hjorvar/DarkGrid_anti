# DARKGRID — PHASE 7A: DETERMINISTIC BALANCE SIMULATION PLAN

## 1. Purpose & Isolation Architecture

To validate **Darkgrid Balance V2** in Phase 7B before any live rollout, we specify a deterministic, isolated Monte Carlo simulation suite (`scripts/simulate-balance-v2.js` or `tests/simulation/balance-v2-sim.js`).

### 1.1 Strict Safety & Isolation Requirements
- **100% In-Memory Execution:** All simulations must use `initializeDatabase(':memory:')` (`src/db/connection.js:18`) and seeded PRNG (`createSeededSimulationRng` from `action-ui-lab/adventure-engine.js:2057`), never touching `data/darkgrid.sqlite` or any shared database file.
- **Deterministic Reproducibility:** Every simulation batch must accept an explicit integer `--seed` (default `20260701`) and emit a JSON + Markdown telemetry report so balance regressions can be asserted in CI.

---

## 2. Four Core Simulation Suites

### Suite 1: 1v1 Combat Matrix Simulator (`N = 1,000` Duels per Matchup)
Simulates full combat encounters (`initializeCombat` + `executeCombatRound` loop) across:
- **Classes (3):** `FIGHTER`, `RANGER`, `CLERIC`
- **Builds per Class (3):** Offensive (`F1/R1/C1`), Defensive (`F2/R2/C2`), Balanced (`F3/R3/C3`)
- **Progression Milestones (5):** Levels `1`, `3`, `5`, `8`, `10`
- **Equipment Tiers (3):**
  - *Starter Gear* (Creation loadout)
  - *Ordinary Tier Gear* (Expected wealth at milestone)
  - *Optimized Tier Gear* (Best-in-slot available at milestone)
- **Monster Targets:** Every monster in the corresponding `solo_level` tier (`Tiers 1..8`), plus $+1$ and $+2$ level step-up matchups.

**Tactical AI Policy for Simulated Heroes:**
1. **Pre-Combat (`DISCOVERED`):** Always `Investigate` in 1v1 benchmark mode (testing raw combat lethality).
2. **In-Combat Healing Policy:**
   - If `CLERIC` has `CHANNEL_HEAL` charges and `current_hp <= 0.45 * max_hp`, invoke `CHANNEL_HEAL`.
   - Else if hero has a Healing Potion and `current_hp <= Math.max(monsterExpectedHitDmg * 1.25, 0.35 * max_hp)`, execute `DRINK_POTION`.
3. **In-Combat Retreat Policy (`FLEE` Enabled vs. Fight-to-Death Modes):**
   - Run every matchup in two sub-modes:
     - **Mode A (No-Flee / Pure Combat Power):** Hero fights to victory or death (max 2 potions per fight).
     - **Mode B (Rational Permadeath Survivor):** Hero attempts `FLEE` if `current_hp <= monsterMaxHitDmg` and no healing potions/charges remain.

---

### Suite 2: Consecutive Encounter Attrition ("Gauntlet") Simulator (`N = 2,500` Runs per Class/Level)
Models a hero departing Oakhaven at 100% HP with a standard expedition consumable loadout (`2` healing potions at L1, `3` at L3–5, `4` at L8–10) and fighting consecutive random encounters from their target Zone until `current_hp < 0.35 * max_hp` or out of healing resources.
- **Key Metrics Captured:**
  - Mean & median **Encounters Cleared Per Rest** (`ECPR`).
  - Potion consumption rate per encounter (`Potions/Fight`).
  - Net Gold profit per expedition (`Gross Loot Gold + Salvage - Potion Cost`).
  - Probability of sudden death during an expedition (`P(Death per Expedition)`).

---

### Suite 3: Full Expedition & World Pacing Simulator (`N = 1,000` Seeded Expeditions per Route)
Extends `runEncounterPacingSimulation` (`action-ui-lab/adventure-engine.js:2071-2410`) by coupling movement pacing with real monster selection (`selectMonsterForTile`), Stage 1 perception/bypass decisions, combat resolution, and return-to-Oakhaven survival:
- **Route 1 (Zone 1–2 Starter Loop):** Oakhaven `(7,7)` $\to$ North Gate `(7,6)` $\to$ Mirkwood Crossroads `(7,5)` $\to$ Eastern Plains $\to$ Old Stone Bridge `(8,7)` $\to$ Oakhaven (`16` steps).
- **Route 2 (Zone 2–3 Mirkwood Expedition):** Oakhaven `(7,7)` $\to$ Heart of the Mirkwood `(7,3)` $\to$ Raven Crags `(3,4)` $\to$ Oakhaven (`22` steps).
- **Route 3 (Zone 3–4 Southern Mire & Jungle Expedition):** Oakhaven `(7,7)` $\to$ South Gate `(7,8)` $\to$ Rotting Fen $\to$ Deadman's Mire `(4,11)` $\to$ Venomous Jungle `(10,11)` $\to$ Oakhaven (`28` steps).
- **Route 4 (Bounty Hunter Loop):** Accept active Watcher's Board contract $\to$ patrol target region until quarry is slain $\to$ return to Oakhaven to auto-claim reward.

---

### Suite 4: Full Campaign Progression Simulator (Level 1 $\to$ Level 10 Career Runs, `N = 500` Heroes per Class)
Simulates complete hero careers from fresh Level 1 creation (`10 gp`, starter gear) to Level 10 (or Permadeath), including:
- Automatic town rest at Oakhaven when returning from an expedition.
- Automatic shop purchasing of priority upgrades (Shield $\to$ Armor $\to$ Masterwork Weapon $\to$ Potions $\to$ `+1` Weapon/Armor/Accessories $\to$ `+2/+3` Gear) and selling looted gear.
- Accepting and claiming Watcher's Board bounties.
- Tracking persistent monsters spawned when simulated heroes die (`processHeroDeath`).

---

## 3. Quantitative Balance Acceptance Gates (Target KPIs for Phase 7B)

Phase 7B balance tuning will iterate until the simulation suite passes all 8 quantitative gates below:

| Gate ID | Balance Metric | Current Baseline (Verified Audit) | Phase 7B V2 Target Band |
| :---: | :--- | :--- | :--- |
| **G1** | **Same-Tier `STANDARD` Monster Win Rate (Levels 1–8, Ordinary Gear, up to 1 Potion)** | L1: `91%–98%`<br>L5 Cleric: `31.4%`, L5 Ranger: `46.2%`, L5 Fighter: `94.6%` | **`85% – 93%`** for **all 3 classes** at every milestone (`L1, L3, L5, L8, L10`) |
| **G2** | **Inter-Class Win Rate Spread (Max Class minus Min Class at Same Level)** | **`63.2%` spread** at Level 5 (`Fighter 94.6%` vs `Cleric 31.4%`) | **$\le 8.0\%$ spread** between `FIGHTER`, `RANGER`, and `CLERIC` at every level |
| **G3** | **Level 1 Unavoidable Death Rate (Zone 1 Expedition with Rational Retreat)** | `~4.5%` per expedition (due to Gaussian L3–5 spikes & failed flee) | **$\le 1.0\%$ per Zone 1 expedition** for a cautious player who retreats at `<35%` HP |
| **G4** | **Combat Duration (Mean Rounds to Kill vs. `STANDARD` / `ELITE` / `BOSS`)** | L1: `1.3–2.2` rds; L5 Cleric: `9.1` rds | • `STANDARD`: **`3.0 – 4.5` rounds**<br>• `ELITE`: **`5.0 – 7.0` rounds**<br>• `BOSS`: **`6.5 – 9.5` rounds** |
| **G5** | **Consecutive Encounters Per Sanctuary Rest (`ECPR`, No Potions vs. With 2 Potions)** | L5 Ranger/Cleric: `0.8` fights | **`2.5 – 3.5` fights** (0 potions) / **`4.5 – 6.0` fights** (with 2 potions / class heals) |
| **G6** | **Monster Spawn Reachability Across World Map** | `86 / 98` (`87.8%`; 12 monsters unreachable, `BRIDGE` has 0) | **`98 / 98` (`100.0%`)** monsters reachable across passable tiles + landmarks |
| **G7** | **Wealth-to-Gear Alignment at Level Milestones** | Level 5 hero has `~600 gp` vs `2,315 gp` `+1` weapon (`26%` affordability) | Hero can afford **Masterwork at L2–3**, **`+1` Core Set at L4–5**, **`+2` Core Set at L7–8**, **`+3` Weapon at L9–10** |
| **G8** | **Career Survival Rate to Level 5 / Level 10 (Rational Survivor AI)** | Fighter `~62%`, Ranger `~28%`, Cleric `~14%` to L5 | **`55% – 70%` to Level 5** and **`30% – 45%` to Level 10** across all 3 classes |
