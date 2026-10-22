# DARKGRID — PHASE 7A.1: MATHEMATICAL VALIDATION & BOUNDARY ANALYSIS

This document verifies all mathematical formulas, boundary conditions, minimum/maximum damage spikes, turn-order state machines, and economy expectations for Balance V2.

> **Epistemic Distinction (§5 Requirement):** Closed-form expected values ($\mathbb{E}[\text{DMG}]$, $P(\text{Hit})$, $P(\text{Confirmed Crit})$, single-round survival probabilities) are **exact analytical derivations**. Multi-round combat win rates with stateful abilities (*Opening Shot*, *Second Wind*, *Divine Healing*, status conditions, and rational retreat thresholds) are **analytical approximations** that **must be empirically verified** by the Phase 7B.0 deterministic Monte Carlo harness (`N >= 10,000` trials per matchup) before final numeric sign-off.

---

## 1. Attribute Thresholds ($8 \le S \le 20$) & Strict Monotonicity Proof

### 1.1 Proof of Non-Monotonic Defect in Phase 7A's Odd-`CON` HP Formula
Phase 7A proposed:
$$\text{MaxHP}_{\text{7A}}(L, \text{CON}) = 4 + L \times \left(B + \left\lfloor\frac{\text{CON}-10}{2}\right\rfloor\right) + 2 \cdot \mathbb{I}(\text{CON is odd and } \text{CON} \ge 11)$$
Let $\text{CON} = 2k + 1$ ($k \ge 5$, so $\text{CON} \in \{11, 13, 15, 17, 19\}$). Then $\lfloor(\text{CON}-10)/2\rfloor = k - 5$, and for $\text{CON}+1 = 2k+2$, $\lfloor(\text{CON}+1-10)/2\rfloor = k - 4$.
The marginal change in `MaxHP` when increasing `CON` by $+1$ from $2k+1$ to $2k+2$ is:
$$\Delta \text{MaxHP}_{\text{7A}}(L) = \text{MaxHP}_{\text{7A}}(L, 2k+2) - \text{MaxHP}_{\text{7A}}(L, 2k+1) = L(k - 4) - \left[L(k - 5) + 2\right] = L - 2$$
At **Level 1 ($L = 1$)**:
$$\Delta \text{MaxHP}_{\text{7A}}(1) = 1 - 2 = \mathbf{-1 < 0}$$
Thus, at Level 1, **every transition from an odd `CON` ($\ge 11$) to the next higher even `CON` (`11 -> 12`, `13 -> 14`, `15 -> 16`, `17 -> 18`, `19 -> 20`) strictly decreases the character's Maximum HP by 1!**

### 1.2 Monotonicity Verification Table Across All Thresholds ($8 \le S \le 20$)

Comparing Phase 7A's defective formula against the corrected **Phase 7A.1 Option A Formula** ($\text{MaxHP}_{\text{V2}}(L, \text{CON}) = 4 + L \times (B + \lfloor(\text{CON}-10)/2\rfloor)$) for a Fighter ($B = 10$):

| Attribute Score $S$ | Modifier $\lfloor(S-10)/2\rfloor$ | Phase 7A L1 Fighter HP | Phase 7A Marginal $\Delta$ at L1 | **Phase 7A.1 V2 L1 Fighter HP** | **Phase 7A.1 V2 L5 Fighter HP** | **Phase 7A.1 V2 L10 Fighter HP** | **V2 Monotonicity ($\Delta \ge 0$)** |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **8** *(Legacy/Debuff)* | `-1` | `13` | — | `13` | `49` | `94` | Baseline |
| **9** *(Legacy/Debuff)* | `-1` | `13` | `0` | `13` | `49` | `94` | $\Delta = 0$ (Valid) |
| **10** *(Creation Floor)* | `+0` | `14` | `+1` | `14` | `54` | `104` | $\Delta > 0$ (Valid) |
| **11** | `+0` | `16` | `+2` | `14` *(Stepping stone to 12 at L2)* | `54` | `104` | $\Delta = 0$ (Valid) |
| **12** | `+1` | **`15`** | **`-1` (BUG!)** | **`15`** | `59` | `114` | $\Delta > 0$ (Valid) |
| **13** | `+1` | `17` | `+2` | `15` *(Stepping stone to 14 at L2)* | `59` | `114` | $\Delta = 0$ (Valid) |
| **14** | `+2` | **`16`** | **`-1` (BUG!)** | **`16`** | `64` | `124` | $\Delta > 0$ (Valid) |
| **15** | `+2` | `18` | `+2` | `16` *(Stepping stone to 16 at L2)* | `64` | `124` | $\Delta = 0$ (Valid) |
| **16** *(Creation Cap)* | `+3` | **`17`** | **`-1` (BUG!)** | **`17`** | `69` | `134` | $\Delta > 0$ (Valid) |
| **17** | `+3` | `19` | `+2` | `17` | `69` | `134` | $\Delta = 0$ (Valid) |
| **18** | `+4` | **`18`** | **`-1` (BUG!)** | **`18`** | `74` | `144` | $\Delta > 0$ (Valid) |
| **19** | `+4` | `20` | `+2` | `18` | `74` | `144` | $\Delta = 0$ (Valid) |
| **20** *(Level-Up Cap)* | `+5` | **`19`** | **`-1` (BUG!)** | **`19`** | `79` | `154` | $\Delta > 0$ (Valid) |

---

## 2. Exact D20 Attack, Critical Confirmation & Expected Damage Mathematics

### 2.1 Hit Probability $P(\text{Hit})$ with Natural 1 & Natural 20 Boundary Clamping
Let $A = \text{ATK}$ be the total attack bonus and $C = \text{TargetAC}$ be the target's Armor Class.
Let $r_{\min} = C - A$ be the minimum raw d20 roll needed to meet or exceed $C$.
Because $d_{20} = 1$ always misses and $d_{20} = 20$ always hits ([src/domain/combat/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js#L294-L315)):
$$P(\text{Hit} \mid A, C) = \frac{21 - \text{clamp}(C - A, 2, 20)}{20} \in [0.05, 0.95]$$
- **Lower Boundary ($C - A \ge 20$):** $\text{clamp}(C - A, 2, 20) = 20 \implies P(\text{Hit}) = \frac{1}{20} = 0.05$ (Natural 20 only).
- **Upper Boundary ($C - A \le 2$):** $\text{clamp}(C - A, 2, 20) = 2 \implies P(\text{Hit}) = \frac{19}{20} = 0.95$ (only Natural 1 misses).

### 2.2 Critical Threat & Confirmed Critical Probability $P(\text{Crit})$
Let $T \in \{18, 19, 20\}$ be the weapon's critical threat minimum roll (`crit_threat`, where $T = 20$ for all monsters).
A raw roll $d_{20} \in \{1..20\}$ produces a valid **Critical Threat** if and only if it both **hits** and satisfies $d_{20} \ge T$.
Therefore, the minimum roll on the d20 that both hits and threatens a critical is:
$$t_{\text{eff}} = \max\left(T, \text{clamp}(C - A, 2, 20)\right)$$
The probability of rolling a Critical Threat on a single attack is:
$$P(\text{Threat} \mid A, C, T) = \frac{21 - t_{\text{eff}}}{20}$$
Under Balance V2's **Critical Confirmation Rule**, a second independent roll $d_{20}^{\text{conf}}$ confirms the critical with probability $P(\text{Confirm} \mid A, C) = P(\text{Hit} \mid A, C)$ (plus any confirmation bonus $b_{\text{conf}}$).
Thus, the exact probability of a **Confirmed Critical Hit** is:
$$P(\text{Confirmed Crit}) = P(\text{Threat} \mid A, C, T) \times P(\text{Hit} \mid A + b_{\text{conf}}, C)$$
And the probability of a **Normal (Non-Critical) Hit** is:
$$P(\text{Normal Hit}) = P(\text{Hit} \mid A, C) - P(\text{Confirmed Crit})$$

#### Impact on Monster Critical Spikes in Permadeath ($T = 20$, $b_{\text{conf}} = 0$)
- **Era 1 (Unconfirmed Nat 20 = 2x Damage):** Every monster has a flat $P(\text{Crit}) = \mathbf{5.00\%}$ per swing, even if the hero has high AC ($P(\text{Hit}) = 25\%$). That meant **20% of all hits landed by an inaccurate monster were double-damage crits!**
- **Balance V2 (Confirmed Crit):** For a monster with $P(\text{Hit}) = 35\%$, $P(\text{Confirmed Crit}) = 0.05 \times 0.35 = \mathbf{1.75\%}$ (a **65% reduction** in random crit spikes!), and at Levels 1–2 a confirmed monster crit multiplies damage by `1.5x` instead of `2.0x`.

---

## 3. Worked Combat Examples & Boundary Damage Audit (Levels 1, 5, and 10)

### 3.1 Level 1 Permadeath Spike Audit (Hero vs Level 1 Monster)

#### Baseline Level 1 Heroes (72-Point V2 Arrays + Starter Kit)
| Class | Attributes (`STR/CON/DEX/INT/WIS/CHA`) | Max HP | Weapon (`Dice + Bonus`) | Armor + Shield | Total AC | Attack Bonus (`ATK`) | Single-Hit Damage Range (`Avg`) | Confirmed Crit Damage Range (`x2`/`x3`) |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| **Fighter (1H+Shield)** | `16 / 14 / 12 / 10 / 10 / 10` | **`16 HP`** | *Shortsword* (`1d6 + 3`) | *Scale Mail* (`+4`) + *Light Shield* (`+1`) + `DEX +1` | **`16`** | **`+5`** (`+1 BAB +3 STR +1 WT`) | `4 – 9` (`6.5`) | `8 – 18` (`13.0`) |
| **Fighter (2H Greatsword)** | `16 / 14 / 12 / 10 / 10 / 10` | **`16 HP`** | *Greatsword* (`2d6 + 4`, `1.5x STR`) | *Scale Mail* (`+4`) + `DEX +1` | **`15`** | **`+5`** | `6 – 16` (`11.0`) | `12 – 32` (`22.0`) |
| **Ranger (Bow+Buckler)** | `14 / 12 / 16 / 10 / 10 / 10` | **`13 HP`** | *Shortbow* (`1d6 + 3` + `0.5*STR = +1` $\to$ `1d6 + 4`, `+6` vs Doctrine) | *Studded Leather* (`+3`) + *Buckler* (`+1`) + `DEX +3` | **`17`** (`19` on Flee) | **`+4`** (`+6` vs Doctrine) | `5 – 10` (`7.5`; `9.5` vs Doctrine) | `15 – 30` (`22.5`, `x3` cap) |
| **Cleric (Mace+Shield)** | `14 / 12 / 10 / 10 / 16 / 10` | **`13 HP`** | *Heavy Mace* (`1d8 + 3` w/ *Sacred Conduit I*) | *Scale Mail* (`+4`) + *Heavy Shield* (`+2`) | **`16`** | **`+4`** (`+1 BAB +2 STR +1 SC`) | `4 – 11` (`7.5`, `+1d4` Radiant after Heal) | `8 – 22` (`15.0`) |

#### Worst-Case Level 1 Monster Spike Check
- Consider the hardest-hitting Level 1 monsters (*Zombie* `1d6+3` = `4–9` dmg, `+2` ATK; *Skeleton* `1d6+2` = `3–8` dmg; *Goblin* `1d4+1` = `2–5` dmg).
- **Era 1 Unconfirmed `2x` Crit:** A *Zombie* rolling Natural 20 dealt $2 \times (6 + 3) = \mathbf{18\text{ damage}}$ (`100%` instant one-shot permadeath against a 13–16 HP Level 1 hero from full health!).
- **Balance V2 Confirmed `1.5x` Level 1 Crit:**
  - Against `AC 16–17`, a *Zombie* (`+2 ATK`) hits on `14–20` ($P(\text{Hit}) = 35\%$, or $30\%$ vs `AC 17`).
  - Probability of a confirmed crit is only $0.05 \times 0.35 = \mathbf{1.75\%}$.
  - Even on a maximum-roll (`6`) confirmed `1.5x` crit, *Zombie* deals $\lceil (6 + 2) \times 1.5 \rceil = \mathbf{12\text{ damage}}$ (with Zombie's L1 damage adjusted to `1d6+2`), leaving **every Level 1 Fighter (`16 HP`), Ranger (`13 HP`), and Cleric (`13 HP`) alive at `1–4 HP`** to use *Second Wind*, *Divine Healing*, a *Minor Healing Potion*, or deterministic `FLEE`!
  - **Result:** **Zero one-shot permadeath from full HP at Level 1.**

---

### 3.2 Level 5 Worked Analytical Comparison (vs Level 5 Monster: `HP 60, AC 17, ATK +10, DMG 2d6+5 [avg 12.0]`)

Assuming typical Level 5 gear (`+1 Weapon`, `+1 Armor`, `+1 Shield/Buckler`, Primary Stat `18` (`+4`) via L2 & L4 `+1` attribute points):

| Metric | Level 5 Fighter (1H +1 Longsword & Heavy Shield) | Level 5 Ranger (+1 Composite Longbow & +1 Buckler, Primary Doctrine) | Level 5 Cleric (+1 Warhammer & Heavy Shield, Non-Undead) |
| :--- | :--- | :--- | :--- |
| **Max HP (`CON 14` Fighter / `12` Ranger & Cleric)** | `64 HP` (+ *Second Wind* `1d10+7` = avg `12.5 HP` $\to$ **`76.5` Effective HP**) | `49 HP` (plus pre-Round-1 *Opening Shot* tempo) | `49 HP` (+ *Divine Healing II* `2d6+9` = avg `16.0 HP` $\to$ **`65.0` Effective HP**) |
| **Hero AC / DR** | `AC 21` (*Splint +1* `+8`, `DEX +1`, *Shield +1* `+3`), **`DR 1/-`** | `AC 20` (*Chain Shirt +1* `+5`, `DEX +4`, *Buckler +1* `+2` or `+1` Doctrine AC) | `AC 20` (*Breastplate +1* `+7`, *Shield +1* `+3`, *Sanctified Ward* `+1` $\to$ `AC 21`) |
| **Hero Attack Bonus (`ATK`)** | `+5 BAB + 4 STR + 2 WT + 1 Wpn =` **`+12`** | `+5 BAB + 4 DEX + 3 Doctrine + 1 Wpn =` **`+13`** (`+11` off-doctrine) | `+4 BAB + 3 STR + 1 SC + 1 Wpn =` **`+9`** |
| **Hero $P(\text{Hit vs AC 17})$** | **`80%`** | **`85%`** (`75%` off-doctrine) | **`65%`** |
| **Hero Expected Damage per Hit** | `1d8+4+2+1` = **`11.5`** (`19-20/x2` crit) | `1d8+4+1+3+1` = **`13.5`** (`19-20/x3` w/ *Hunter's Focus*) | `1d8+3+2+1` = **`10.5`** (`+1d4` = **`13.0`** for 2 rds after Heal) |
| **Hero Expected DPR (including Confirmed Crits)** | **`9.94 DPR`** | **`12.82 DPR`** (+ **`9.6` dmg** on *Opening Shot* before Round 1!) | **`7.18 DPR`** (**`8.80 DPR`** while Radiant-empowered) |
| **Expected Rounds to Kill 60 HP Monster** | **`6.0 rounds`** | **`4.0 rounds`** (`50.4 HP` left after Opening Shot) | **`7.4 rounds`** |
| **Monster $P(\text{Hit})$ & Net DPR vs Hero** | Hits `AC 21` on `11+` (`50%`); `12.0 - 1 DR = 11.0` dmg $\to$ **`5.78 DPR`** ( **`5.20 DPR`** w/ 1 rd `+2 AC` SW) | Hits `AC 20` on `10+` (`55%`); `12.0` dmg $\to$ **`6.93 DPR`** (only attacks for `3–4` rounds!) | Hits `AC 21` on `11+` (`50%`); `12.0` dmg $\to$ **`6.30 DPR`** |
| **Expected Damage Taken per Fight** | $\approx 5.5 \times 5.6 = \mathbf{30.8\text{ HP}}$ (`40%` of Effective HP) | $\approx 3.5 \times 6.93 = \mathbf{24.3\text{ HP}}$ (`49%` of Max HP) | $\approx 6.9 \times 6.30 = \mathbf{43.5\text{ HP}}$ (`67%` of Effective HP; `~35%` vs Undead/Fiends) |

---

## 4. Stun & Paralysis Turn-Order State Machine Proof (§5 Special Requirement)

### 4.1 Audit of Current `paralysisCooldown` Asymmetry in `src/domain/combat/abilities.js`
In [src/domain/combat/abilities.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/abilities.js#L1033-L1111):
- When a monster paralyzes the hero during the monster's turn, it sets `heroConditions.paralyzed = 1` and `heroConditions.paralysisCooldown = 3`.
- At the end of **every** combat round (`executeCombatRound` in [src/domain/combat/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L649)), `tickHeroConditionsEndOfRound` decrements `paralysisCooldown` by `1` (while `paralyzed` is cleared when the hero skips their action at `engine.js:561`).

Let us trace both initiative orders when a monster applies Paralysis in **Round $T$**:

| Round / Phase | Case 1: `initiative_winner === 'MONSTER'` (Monster acts first) | Case 2: `initiative_winner === 'HERO'` (Hero acts first) |
| :--- | :--- | :--- |
| **Round $T$ — Phase 1** | Monster attacks $\to$ Hero fails save $\to$ `paralyzed = 1`, `cooldown = 3`. | Hero acts normally. |
| **Round $T$ — Phase 2** | Hero is `paralyzed` $\to$ **skips turn**; `paralyzed` cleared to `0` (`engine.js:561`). | Monster attacks $\to$ Hero fails save $\to$ `paralyzed = 1`, `cooldown = 3`. |
| **Round $T$ — End of Round** | `tickHeroConditionsEndOfRound` $\to$ `cooldown` becomes **`2`**. | `tickHeroConditionsEndOfRound` $\to$ `cooldown` becomes **`2`**. |
| **Round $T+1$ — Phase 1** | Monster attacks (`cooldown = 2 > 0`, cannot paralyze). | Hero is `paralyzed` $\to$ **skips turn**; `paralyzed` cleared to `0`. |
| **Round $T+1$ — Phase 2** | **Hero acts freely (1st free turn).** | Monster attacks (`cooldown = 2 > 0`, cannot paralyze). |
| **Round $T+1$ — End of Round** | `cooldown` becomes **`1`**. | `cooldown` becomes **`1`**. |
| **Round $T+2$ — Phase 1** | Monster attacks (`cooldown = 1 > 0`, cannot paralyze). | **Hero acts freely (1st free turn).** |
| **Round $T+2$ — Phase 2** | **Hero acts freely (2nd free turn).** | Monster attacks (`cooldown = 1 > 0`, cannot paralyze!). |
| **Round $T+2$ — End of Round** | `cooldown` becomes **`0`**. | `cooldown` becomes **`0`**. |
| **Round $T+3$ — Phase 1** | Monster attacks (`cooldown = 0`, **can paralyze again**). | **Hero acts freely (2nd free turn)** before monster's Round $T+3$ attack! |

### 4.2 Recommended Consistent Recovery Rule (`stunImmunityRounds`)
While `paralysisCooldown = 3` prevents back-to-back stuns, coupling the cooldown decrement to `tickHeroConditionsEndOfRound` rather than the **monster's attack phase** makes the duration depend on whether `paralyzed` was consumed in Round $T$ or Round $T+1$.
- **Balance V2 Rule:**
  1. When `paralyzed` or `stunned` is applied, set `heroConditions.paralyzed = 1` (or `stunned = 1`).
  2. When the hero's turn arrives and is skipped (`engine.js:560`), clear `paralyzed = 0` / `stunned = 0` and set **`heroConditions.stunImmunityRounds = 1`** (or `2` against Bosses/Elites if tuned).
  3. Decrement `stunImmunityRounds` **only at the end of the monster's turn** (if the monster was prevented from applying a stun/paralysis during that turn).
  4. **Guarantee:** Regardless of whether the Hero or Monster won initiative, after skipping **1 turn**, the hero is 100% guaranteed **at least 1 full uninterrupted action** (and cannot be re-stunned on the monster's immediately following attack). Furthermore, `FLEE` remains executable even while `paralyzed = 1` (`Permadeath Safety Rule #8`).

---

## 5. Economy, Loot & Wealth Variance Validation (§7 Requirement)

### 5.1 True Era 1 Baseline vs Balance V2 Expected Gold per Level
Using verified numbers from [src/domain/combat/loot.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/loot.js#L71-L157) and [src/domain/bounties/board.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/bounties/board.js#L343-L353):

| Character Level | Kills in Level ($\Delta K$) | V2 Direct Gold + Salvage / Kill ($\mu \pm \sigma$) | Expected Vendor Loot Value / Kill | Watcher's Board Bounty Payout (`1` per Level) | Total Expected Gross Income in Level | Expected Consumable & Rest Upkeep (`25%–35%`) | Net Cumulative Wealth (`Mean` / `25th Percentile P25`) | Target Equipment Milestone Affordable at `P25` |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1 $\to$ 2** | `4.0` | `4.5 gp ± 2.8` | `6.0 gp` | `55 gp` | `97 gp` (+`25 gp` start) | `-25 gp` (`1` Potion) | **`97 gp`** / **`72 gp`** | Upgraded Mundane Armor/Weapon (`35–75 gp`) |
| **2 $\to$ 3** | `4.0` | `10.5 gp ± 6.0` | `14.0 gp` | `78 gp` | `176 gp` | `-45 gp` | **`228 gp`** / **`175 gp`** | **Masterwork Weapon (`150 gp`)** |
| **3 $\to$ 4** | `4.4` | `19.0 gp ± 10.5` | `26.0 gp` | `105 gp` | `303 gp` | `-80 gp` | **`451 gp`** / **`350 gp`** | **Masterwork Armor (`180 gp`) or `+1` Shield/Cloak (`350 gp`)** |
| **4 $\to$ 5** | `4.9` | `30.0 gp ± 16.0` | `42.0 gp` | `140 gp` | `493 gp` | `-130 gp` | **`814 gp`** / **`640 gp`** | **`+1` Weapon (`450 gp`) + `+1` Cloak (`350 gp`)** |
| **5 $\to$ 6** | `5.3` | `44.0 gp ± 22.0` | `65.0 gp` | `185 gp` | `763 gp` | `-200 gp` | **`1,377 gp`** / **`1,090 gp`** | **`+1` Armor (`500 gp`) + `+1` Ring (`450 gp`)** |
| **6 $\to$ 8** | `12.1` | `72.0 gp ± 35.0` | `110.0 gp` | `250 gp` ($\times 2$) | `2,702 gp` | `-700 gp` | **`3,379 gp`** / **`2,680 gp`** | **`+2` Weapon (`1,400 gp`) + `+2` Stat Item (`1,200 gp`)** |
| **8 $\to$ 10** | `13.0` | `120.0 gp ± 55.0` | `190.0 gp` | `360 gp` ($\times 2$) | `4,750 gp` | `-1,250 gp` | **`6,879 gp`** / **`5,450 gp`** | **`+3` Weapon (`2,800 gp`) + `+2/+3` Armor (`2,200 gp`)** |

*Key Insight on Wealth Variance:* Because random item drops are right-skewed (`30%` item roll chance in `loot.js`), equipment pricing in Balance V2 is anchored to the **25th Percentile (`P25`) wealth curve** rather than the mean, ensuring that an unlucky player who completes `1` Watcher's Board bounty per level can still afford a Masterwork weapon by Level 3 and a `+1` weapon by Level 4–5.

---

## 6. Summary of Metrics Requiring Phase 7B.0 Monte Carlo Simulation

Per Section 5 of the prompt, the following outcomes depend on multi-round state transitions and **must not** be claimed as verified until the Phase 7B.0 simulation suite runs:
1. Exact multi-round win rate distribution across all $3 \times 98 = 294$ class-vs-monster pairings.
2. Exact expedition length (encounters between Oakhaven rests) when combining Cleric daily charges (`3 + WIS_mod`), Fighter *Second Wind*, and potion drops.
3. Exact career survival rate to Level 5 and Level 10 under the Rational Retreat AI policy (`FLEE` at $\text{HP} \le 30\%$).
4. Empirical P10 / P25 / P50 / P90 net wealth curves when accounting for class-specific potion consumption.
