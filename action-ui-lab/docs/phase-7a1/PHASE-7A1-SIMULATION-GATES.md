# DARKGRID — PHASE 7A.1: REVISED SIMULATION ACCEPTANCE GATES & MATHEMATICAL COHERENCE

This document critically evaluates Phase 7A's quantitative acceptance gates (`G1`–`G8` in [PHASE-7A-SIMULATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-SIMULATION-PLAN.md)), resolves the mathematical contradiction between per-battle win rates (`G1`) and multi-battle career survival (`G3`, `G8`), and classifies all metrics into **Hard Safety Invariants**, **Initial Design Targets**, and **Empirical Calibration Metrics**.

---

## 1. Mathematical Proof of the `G1` vs `G8` Contradiction in Phase 7A (Finding H6)

In [PHASE-7A-SIMULATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-SIMULATION-PLAN.md#L70-L82), Phase 7A simultaneously required:
- **`G1`:** Same-level encounter win rate $w \in [0.85, 0.93]$.
- **`G8`:** Full-career survival without permadeath of $S_5 \in [0.55, 0.70]$ to Level 5 and $S_{10} \in [0.30, 0.45]$ to Level 10.

### Why `G1` and `G8` Cannot Coexist Under a Fight-to-the-Death Model
In a permadeath game, if a character fights every encounter to the death (no retreat, so $P(\text{Death per fight}) = 1 - w \in [0.07, 0.15]$), the probability of surviving $N$ independent encounters to reach a target level is:
$$S(N) = w^N$$
- Under Phase 7A's progression (`N = 22` kills to Level 5, `N = 70` kills to Level 10) or Phase 7A.1's refined progression (`N = 18` kills to Level 5, `N = 48` kills to Level 10):
  - At $w = 0.89$ (midpoint of `G1`):
    - **By Level 5 ($N = 18$):** $0.89^{18} = \mathbf{12.27\%}$ (or $0.89^{22} = \mathbf{7.69\%}$) — **far below `55%–70%`!**
    - **By Level 10 ($N = 48$):** $0.89^{48} = \mathbf{0.37\%}$ (or $0.89^{70} = \mathbf{0.029\%}$) — **100x to 1000x below `30%–45%`!**

### How Deterministic `FLEE` & Tactical Play Reconcile `G1` and `G8`
In Darkgrid, losing an isolated no-flee duel (`1 - w`) **is not equal to permadeath (`m`)** because a rational player (and the Tier 2 Expedition Agent) has three survival layers before `0 HP`:
1. **In-Combat Healing & Potions:** Fighter *Second Wind*, Cleric *Divine Healing*, and `Minor/Moderate Healing Potions`.
2. **Deterministic Escape (`FLEE`):** Because `FLEE` in [src/domain/combat/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L503-L546) **always succeeds (`ESCAPED`)** if the hero survives 1 parting attack (or uses a *Smoke Bomb*), a hero who triggers `FLEE` when $\text{HP} \le \max(\text{MonsterMaxHit}, 0.30 \times \text{MaxHP})$ escapes alive in **`~90%–95%` of losing fights**!
3. **Stage 1 Threat Avoidance:** Skipping Crimson-Skull ($\Delta L \ge +2$) encounters in Stage 1 (`DISCOVERED`).

Let $p_{\text{lose}} = 1 - w_{\text{tactical}}$ be the probability that an encounter forces the hero to retreat (`FLEE`), and let $p_{\text{parting\_kill}}$ be the probability that the monster's single parting blow kills the retreating hero. Then the true **per-encounter permadeath rate** $m$ is:
$$m = p_{\text{unexpected\_spike}} + p_{\text{lose}} \times p_{\text{parting\_kill}}$$
For $N = 48$ encounters to Level 10, achieving $S(48) = (1 - m)^{48} \in [0.30, 0.45]$ requires:
$$m \in \left[1 - 0.45^{1/48},\; 1 - 0.30^{1/48}\right] = [\mathbf{1.65\%},\; \mathbf{2.48\%}] \text{ per encounter}$$
And for $N = 18$ encounters to Level 5 with $m \in [1.65\%, 2.48\%]$:
$$S(18) = (1 - m)^{18} \in [\mathbf{63.6\%},\; \mathbf{74.1\%}]$$
This is **100% mathematically coherent** once `G1` is defined as the **No-Flee, No-Potion 1v1 Duel Benchmark** (`78%–90%` raw win rate) and `G8` is defined under **Rational Tactical Expedition Play** (with potions, class abilities, and deterministic `FLEE`).

---

## 2. Three-Tier Classification of Validation Gates (§10 Requirement)

To prevent conflating non-negotiable permadeath safety bugs with tunable progression pacing targets, Phase 7A.1 divides all simulation criteria into three distinct tiers:

### Tier A — Hard Safety Invariants (Must Pass 100% Before Any Balance V2 Merge)

| Invariant ID | Definition | Mathematical / Simulation Requirement |
| :--- | :--- | :--- |
| **`INV-1` (Attribute Monotonicity)** | Raising any attribute $S \to S+1$ ($S \in [10, 20]$) never reduces HP, AC, ATK, DMG, Saves, XP, or Economy value at any level $L \in [1, 10]$. | $\forall L \in [1..10], \forall S \in [10..19]: f(L, S+1) \ge f(L, S)$ (**0 violations allowed**). |
| **`INV-2` (Zero Full-HP Level 1 One-Shots)** | No Level 1 monster (`solo_level = 1`) can kill a full-HP Level 1 Fighter (`16 HP`), Ranger (`13 HP`), or Cleric (`13 HP`) in a single attack, even on a maximum-roll confirmed critical hit (`1.5x`). | $\max_{m \in \text{Tier } 1} \left\lceil \text{MaxRawDmg}(m) \times 1.5 \right\rceil \le 12 < 13\text{ HP}$ (**0 one-shots in 100,000 rolls**). |
| **`INV-3` (100% Roster Spawnability & Ecology)** | All 98 monsters have $\ge 1$ reachable, ecologically coherent spawn tile or landmark pool on the 15x15 world map, and `(8,7)` *Old Stone Bridge* has $\ge 4$ valid monsters. | `unspawnableMonsters.length === 0` and `bridgeMonsters.length >= 4`. |
| **`INV-4` (Anti-Chain-Stun Guarantee)** | No monster can keep a hero continuously `Paralyzed` or `Stunned` across two consecutive hero turns, regardless of who won initiative. | Minimum `1` unskipped hero action between any two skipped stun/paralysis turns (**0 violations**). |
| **`INV-5` (Zero Dead / Harmful Consumables)** | Every item and potion obtainable via shop, loot, or bounty has an active, beneficial runtime effect (`INACTIVE_ITEM_NAMES` and `INACTIVE_CONSUMABLE_NAMES` are empty or 100% implemented). | `0` items consumed for `1 HP` dummy fallback. |

---

### Tier B — Initial Design Targets (`G1`–`G8`, Subject to Phase 7B.0 Calibration)

All simulations in `G1`–`G8` must use the **canonical Starting Character Specification** (**`25 gp` starting gold**, `2x Minor Healing Potion`, 72-point V2 attribute arrays—fixing Phase 7A's `10 gp` contradiction in `PHASE-7A-SIMULATION-PLAN.md:58`).

| Gate | Metric Name | Simulation Protocol | Phase 7A Target | **Corrected Phase 7A.1 Target** | Rationale for Revision |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **`G1`** | **No-Flee At-Level 1v1 Duel Win Rate** | Tier 1 Matrix (`N = 10,000` duels/pair): Hero uses class active abilities (*Second Wind*, *Opening Shot*, *Divine Healing*) but **0 potions and 0 `FLEE`**. | `85% – 93%` | **`78% – 90%`** (with class abilities; **`96%–99%`** survival when `FLEE` + potions are enabled) | In a no-potion, no-flee duel, `78%–90%` win rate ensures monsters feel genuinely dangerous and require occasional potion/retreat decisions, while keeping tactical survival $>98\%$. |
| **`G2`** | **Inter-Class Win Rate Spread** | Max absolute difference $\max_c \bar{W}_{c,L} - \min_c \bar{W}_{c,L}$ across Fighter, Ranger, Cleric at each level $L \in [1..10]$. | $\le 8.0\text{ pp}$ | **$\le 8.0\text{ pp}$** overall; **$\le 10.0\text{ pp}$** within any single creature-type family | Preserves tight class parity while allowing Cleric (`UNDEAD`) and Ranger (*Hunter Doctrines*) to shine in their thematic niches. |
| **`G3`** | **Level 1 Expedition Mortality Rate** | Tier 2 Rational Agent starting at Level 1 (`25 gp`, `2` potions) on $d \in [1, 2]$ around Oakhaven across a 4-encounter expedition (`FLEE` at $\text{HP} \le 35\%$). | $\le 1.0\%$ | **$\le 1.0\%$ per 4-fight L1 expedition** ($\le 0.25\%$ death rate per L1 encounter) | Achievable with `INV-2` (no L1 one-shots), `+1` BAB at L1, `0%` ambush at $d=1$, and deterministic `FLEE`. |
| **`G4`** | **Mean Combat Duration** | Mean rounds per victorious at-level encounter across Levels 1–10. | `3.5 – 5.5` rds (L1–4)<br>`4.5 – 7.0` rds (L5–10) | **`3.0 – 5.5` rds (L1–4)**<br>**`4.5 – 7.5` rds (L5–10)** | Accounts for Ranger *Opening Shot* shortening L1–2 fights to ~3 rounds and L8–10 Apex monsters taking up to 7.5 rounds. |
| **`G5`** | **Sustainable Expedition Length** | Mean victorious encounters completed per Town Rest before resources (`HP`, *Divine Healing* charges, or 2 potions) force a return to Oakhaven. | `3.0 – 4.5` encounters | **`3.0 – 5.0` encounters** | Matches Oakhaven $\leftrightarrow$ Landmark round-trip travel distance under `action-ui-lab`'s encounter pacing engine. |
| **`G6`** | **Monster Roster Coverage** | % of 98 monsters spawned $\ge 50$ times across 1,000 simulated full careers exploring all 15x15 tiles and landmarks. | `100%` (`98 / 98`) | **`100%` (`98 / 98`)** | Verified via Landmark-Scoped Encounter Pools (`INV-3`). |
| **`G7`** | **P25 Equipment Milestone Affordability** | Fraction of surviving simulated heroes at the **25th wealth percentile (`P25`)** who can afford their tier milestone weapon/armor on schedule. | Mean wealth within `±15%` | **$\ge 75\%$ of surviving heroes (i.e. `P25` wealth $\ge$ Milestone Cost)** at L3 (Masterwork), L5 (`+1`), L8 (`+2`), L10 (`+3`) | Anchoring to `P25` instead of mean wealth protects players against bad loot RNG in a permadeath economy. |
| **`G8`** | **Career Permadeath Survival Rate (Rational Agent)** | Fraction of 1,000 simulated Level 1 heroes (using rational `FLEE` at $\text{HP} \le 30\%$, potions, and Stage 1 skull warnings) that reach Level 5 and Level 10 alive. | L5: `55% – 70%`<br>L10: `30% – 45%` | **L5 (`~18` kills): `60% – 75%`**<br>**L10 (`~48` kills): `30% – 45%`**<br>*(Implies per-encounter mortality $m \in [1.6\%, 2.4\%]$)* | Mathematically consistent with $N \approx 48$ total encounters to Level 10 under rational retreat play. |

---

### Tier C — Metrics Requiring Empirical Calibration in Stage 7B.0

Before locking final database seed numbers in Phase 7B, the deterministic simulation harness must empirically calibrate:
1. **Pacing Multiplier Interaction:** Compare career step counts under legacy flat `25%` encounter rate ([src/routes/game.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/routes/game.js#L349)) vs `action-ui-lab`'s `computeEncounterPacingChance()` ([adventure-engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/adventure-engine.js#L1730-L2055)).
2. **Retreat Threshold Sensitivity:** Measure `G8` career survival across three AI retreat thresholds (`FLEE` at `HP <= 25%`, `30%`, and `35%`) to verify that cautious play is rewarded without encouraging constant flee-spamming.
3. **Cleric Per-Combat Heal Cap vs Tier 7–8 Elites:** Empirically test whether Cleric's `2/combat` *Divine Healing* cap at Levels 7–10 keeps Cleric within `±8 pp` (`G2`) of Fighter and Ranger against *Wyvern*, *Medusa*, and *Hydra*.
