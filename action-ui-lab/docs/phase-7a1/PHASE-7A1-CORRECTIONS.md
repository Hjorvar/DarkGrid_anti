# DARKGRID — PHASE 7A.1: MASTER TABLE OF CORRECTIONS & TECHNICAL REVIEW FINDINGS

This document catalogues all **20 findings (5 CRITICAL, 7 HIGH, 5 MEDIUM, 3 LOW)** identified during our independent review of the ten Phase 7A documents ([action-ui-lab/docs/phase-7a/](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/)) against the authoritative codebase at commit `87ed6f3` / `b604661`.

---

## 1. Summary Index of Findings

| ID | Priority | Category | Short Title | Primary Affected Phase 7A Docs |
| :--- | :---: | :--- | :--- | :--- |
| **C1** | **CRITICAL** | Math / Attributes | Non-monotonic odd-`CON` HP formula (`CON 13` beats `CON 14` at Level 1) | `BALANCE-V2-DESIGN`, `IMPLEMENTATION-PLAN` |
| **C2** | **CRITICAL** | Combat Codebase | Fabricated `65%` Flee probability formula (actual code is 100% escape after 1 parting blow) | `MONSTER-COMBAT-AUDIT`, `BALANCE-V2-DESIGN`, `SUMMARY` |
| **C3** | **CRITICAL** | DB / Fresh Start | Retirement via `is_alive = 0` + `died_at` corrupts *Hall of the Fallen* and triggers irreversible permadeath lock | `FRESH-START-STRATEGY`, `IMPLEMENTATION-PLAN` |
| **C4** | **CRITICAL** | Character Codebase | Falsified Era 1 class base attribute arrays and illegal Ranger audit builds (`R1`–`R3`) | `CURRENT-BALANCE-AUDIT`, `CLASS-BALANCE` |
| **C5** | **CRITICAL** | Combat Codebase | Falsified 2H melee `1.5x STR` damage claim and critical hit `1x` multiplier claim | `CURRENT-BALANCE-AUDIT`, `MONSTER-COMBAT-AUDIT` |
| **H1** | **HIGH** | Monster Persistence | Misstated persistent monster HP compounding (`+10%` only once) and loot transfer (`50%` burn) | `WORLD-PERMADEATH`, `SUMMARY` |
| **H2** | **HIGH** | Economy / Loot | Misstated city shop stock, global resale markup (`125%`, not `60%`), gold drops, and bounty payouts | `PROGRESSION-ECONOMY` |
| **H3** | **HIGH** | World Safety | Misstated Oakhaven CR cap (`getMaxCrForDistance` already caps $d \le 3$, but fails on persistent monsters & $d=4$) | `WORLD-PERMADEATH`, `MONSTER-COMBAT-AUDIT` |
| **H4** | **HIGH** | Combat State | Unchecked *Opening Shot* kill leaves `0 HP` monster in `IN_COMBAT`, triggers dead monster aura, and hides reveal | `BALANCE-V2-DESIGN`, `CLASS-BALANCE`, `IMPLEMENTATION-PLAN` |
| **H5** | **HIGH** | World Ecology | Ecological mismatch assigning underground, desert, and aquatic monsters to generic dry surface tiles | `BALANCE-V2-DESIGN`, `MONSTER-COMBAT-AUDIT` |
| **H6** | **HIGH** | Simulation Math | Mathematically incompatible Simulation Gates `G1` (`85–93%` win rate) vs `G8` (`30–45%` L10 survival over 70 fights) | `SIMULATION-PLAN`, `SUMMARY` |
| **H7** | **HIGH** | Consistency | Contradictory starting gold specifications (`25 gp` vs `10 gp` vs `180 gp` sandbox seed) | `FRESH-START-STRATEGY`, `SIMULATION-PLAN`, `IMPLEMENTATION-PLAN` |
| **M1** | **MEDIUM** | Class Balance | Fighter armor + shield + `DR 4/-` + `2/combat` *Second Wind* creates excessive late-game invulnerability | `CLASS-BALANCE`, `BALANCE-V2-DESIGN` |
| **M2** | **MEDIUM** | Class Identity | Cleric heavy armor + *Sacred Weapon* + unlimited combat heals blurs Fighter vs Cleric identity | `CLASS-BALANCE`, `BALANCE-V2-DESIGN` |
| **M3** | **MEDIUM** | Combat Rules | Stun/Paralysis cooldown (`paralysisCooldown = 3`) has initiative-order asymmetry | `MONSTER-COMBAT-AUDIT`, `BALANCE-V2-DESIGN` |
| **M4** | **MEDIUM** | Loot / Items | `Cloak of Resistance +1` is implemented in `character/rules.js` but blocked in `loot.js` `INACTIVE_ITEM_NAMES` | `PROGRESSION-ECONOMY`, `MONSTER-COMBAT-AUDIT` |
| **M5** | **MEDIUM** | Attributes | `INT` XP bonus (`+8%` per mod) becomes completely useless at Level 10 cap | `BALANCE-V2-DESIGN`, `CURRENT-BALANCE-AUDIT` |
| **L1** | **LOW** | Equipment Rules | Buckler bow usage (`+1 AC`) omits standard `-1 ATK` trade-off or explicit Skirmisher proficiency rule | `CLASS-BALANCE`, `BALANCE-V2-DESIGN` |
| **L2** | **LOW** | Math Specification | Ambiguous rounding rules (`floor` vs `ceil` vs `round`) across composite damage and economy formulas | `BALANCE-V2-DESIGN`, `PROGRESSION-ECONOMY` |
| **L3** | **LOW** | Phase 6.2 Conflict | Table name collision risk on `characters_legacy_v1_archive` between Phase 6.1/6.2 and Phase 7B Fresh Start | `FRESH-START-STRATEGY`, `IMPLEMENTATION-PLAN` |

---

## 2. Detailed Technical Corrections

### CRITICAL FINDINGS

#### [C1] Non-Monotonic Odd-`CON` HP Formula (`CON 13` > `CON 14` at Level 1)
- **Original Documents:** [PHASE-7A-BALANCE-V2-DESIGN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-BALANCE-V2-DESIGN.md#L35-L48), [PHASE-7B-IMPLEMENTATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7B-IMPLEMENTATION-PLAN.md#L32)
- **Original Claim / Proposed Rule:**
  $$\text{MaxHP}(L) = 4 + L \times (\text{ClassBaseHP} + \text{CON\_mod}) + 2 \times \mathbb{I}(\text{CON is odd and } \ge 11)$$
- **Problem:** At Level 1 ($L = 1$), raising `CON` from an odd score ($2k+1$, $\text{mod} = k-5$, odd bonus $= +2$) to the next even score ($2k+2$, $\text{mod} = k-4$, odd bonus $= 0$) changes Level 1 HP by $+1 \times 1 - 2 = \mathbf{-1\text{ HP}}$!
- **Evidence:**
  - Fighter ($B = 10$) at Level 1:
    - `CON 10` ($\text{mod } 0$, even): $4 + 1(10 + 0) + 0 = 14\text{ HP}$
    - `CON 11` ($\text{mod } 0$, odd): $4 + 1(10 + 0) + 2 = 16\text{ HP}$
    - `CON 12` ($\text{mod } +1$, even): $4 + 1(10 + 1) + 0 = \mathbf{15\text{ HP}}$ (**1 HP LESS than `CON 11`!**)
    - `CON 13` ($\text{mod } +1$, odd): $4 + 1(10 + 1) + 2 = \mathbf{17\text{ HP}}$
    - `CON 14` ($\text{mod } +2$, even): $4 + 1(10 + 2) + 0 = \mathbf{16\text{ HP}}$ (**1 HP LESS than `CON 13`!**)
    - `CON 15` ($\text{mod } +2$, odd): $4 + 1(10 + 2) + 2 = \mathbf{18\text{ HP}}$
    - `CON 16` ($\text{mod } +3$, even): $4 + 1(10 + 3) + 0 = \mathbf{17\text{ HP}}$ (**1 HP LESS than `CON 15`!**)
  - Spending a scarce character creation point to raise `CON` from `13` to `14` **reduces** a Level 1 hero's HP by 1 (and only ties at Level 2). This violates strict monotonicity ($\partial \text{Performance} / \partial \text{Stat} \ge 0$).
- **Recommended Corrected Rule:** Remove the `+2 HP if CON is odd` term and the entire odd-stat micro-bonus table. Use strictly monotonic standard Pathfinder modifiers (`Mod = floor((S - 10) / 2)`) paired with `+1` Attribute Point at Levels 2, 4, 6, 8, and 10:
  $$\text{MaxHP}(L) = 4 + L \times (\text{ClassBaseHP} + \text{CON\_mod})$$
- **Priority:** **CRITICAL**

---

#### [C2] Fabricated `65%` Flee Probability Formula vs Actual Deterministic Escape Engine
- **Original Documents:** [PHASE-7A-MONSTER-COMBAT-AUDIT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-MONSTER-COMBAT-AUDIT.md#L111-L113), [PHASE-7A-BALANCE-V2-DESIGN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-BALANCE-V2-DESIGN.md#L36-L39), [PHASE-7A-SUMMARY.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-SUMMARY.md#L88)
- **Original Claim / Proposed Rule:** Claimed [src/domain/combat/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js#L294-L314) computes $P(\text{Flee}) = \text{clamp}(0.65 + (\text{DEX\_mod} - \lfloor\text{Init}_m/2\rfloor)\times 0.05, 0.25, 0.90)$ (halved when Grabbed/Entangled), and designed V2 bonuses around `+2% flee` (odd `DEX`), `+5% flee` (`CHA_mod`), and `+10% flee` (*Boots of Elvenkind*).
- **Problem:** **No flee probability roll exists anywhere in Darkgrid.**
- **Evidence:** In [src/domain/combat/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L503-L546), `if (action === 'FLEE')` is governed by `Permadeath Safety Rule #8: Flee is ALWAYS available` (even when Paralyzed, Grabbed, or Entangled). The monster makes **one parting normal attack** (`freeAttackRoll` via `resolveAttackRoll` and `resolveDamage`, with no special abilities or on-hit effects). If the hero's HP remains $> 0$ after that single parting attack, the hero **automatically escapes 100% of the time** (`status = 'ESCAPED'`, returning the hero to their previous safe tile).
- **Recommended Corrected Rule:**
  1. Preserve Darkgrid's deterministic escape-on-survival mechanic (`Permadeath Safety Rule #8`). Do **not** introduce a `% flee failure loop` (which causes multi-round death spirals in permadeath RPGs).
  2. Reframe all retreat bonuses as **Evasive Retreat AC (`+AC` against the monster's parting attack on `FLEE`)**:
     $$\text{AC}_{\text{flee}} = \text{AC}_{\text{hero}} + \text{RangerSkirmisherBonus} + \min(2, \max(0, \text{CHA\_mod})) + \text{ItemRetreatAC}$$
  3. Implement *Smoke Bomb* (`25 gp` consumable) to **suppress the monster's parting attack entirely** (or grant `+6 AC` against Bosses/Elites) when fleeing.
- **Priority:** **CRITICAL**

---

#### [C3] Fresh Start `is_alive = 0` + `died_at` Corrupts *Hall of the Fallen* and Locks DB Trigger
- **Original Documents:** [PHASE-7A-FRESH-START-STRATEGY.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-FRESH-START-STRATEGY.md#L26-L80), [PHASE-7B-IMPLEMENTATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7B-IMPLEMENTATION-PLAN.md#L82-L87)
- **Original Claim / Proposed Rule:** Proposed retiring living Era 1 characters via `UPDATE characters SET is_alive = 0, died_at = COALESCE(died_at, CURRENT_TIMESTAMP)` and running `DELETE FROM item_instances;`.
- **Problem:**
  1. Falsely records every living Era 1 hero as having died in battle on migration day.
  2. Trips the irreversible permadeath trigger (`enforce_permadeath_irreversible`).
  3. Destroys the historical inventory/equipment record of retired Era 1 heroes.
- **Evidence:**
  - [db/migrations/001_initial_schema.sql](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/db/migrations/001_initial_schema.sql#L191-L194) defines `CREATE VIEW character_history AS SELECT ... FROM characters c WHERE c.is_alive = 0;`.
  - [src/routes/game.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/routes/game.js#L244-L265) (`GET /game/fallen`) queries `character_history` and renders any character without a killer monster as `"Slain in the Wilds"` on `died_at`.
  - [db/migrations/013_production_blaze_hardening.sql](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/db/migrations/013_production_blaze_hardening.sql#L49-L54) defines `CREATE TRIGGER enforce_permadeath_irreversible BEFORE UPDATE ON characters WHEN OLD.is_alive = 0 AND NEW.is_alive = 1 BEGIN SELECT RAISE(ABORT, 'Permadeath is irreversible'); END;`.
- **Recommended Corrected Rule:**
  - Add `lifecycle_status TEXT NOT NULL DEFAULT 'ALIVE' CHECK (lifecycle_status IN ('ALIVE', 'FALLEN', 'RETIRED'))`, `era INTEGER NOT NULL DEFAULT 1`, `retired_at TEXT`, and `retirement_reason TEXT` to `characters`.
  - Retire living Era 1 heroes with `lifecycle_status = 'RETIRED'`, `is_alive = 0`, `died_at = NULL`, `retired_at = CURRENT_TIMESTAMP`.
  - Update `character_history` (Hall of the Fallen) to `WHERE c.is_alive = 0 AND c.lifecycle_status = 'FALLEN'`, and add `retired_veterans_history` (`WHERE c.lifecycle_status = 'RETIRED'`).
  - Preserve `item_instances` owned by `RETIRED` or `FALLEN` characters (`owner_type = 'CHARACTER'`) as immutable historical archives rather than running an unqualified `DELETE FROM item_instances;`.
- **Priority:** **CRITICAL**

---

#### [C4] Falsified Era 1 Class Base Attribute Arrays & Illegal Audit Builds
- **Original Documents:** [PHASE-7A-CURRENT-BALANCE-AUDIT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-CURRENT-BALANCE-AUDIT.md#L25-L33), [PHASE-7A-CLASS-BALANCE.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-CLASS-BALANCE.md#L12-L20)
- **Original Claim:** Claimed Era 1 base attributes in `src/config/index.js` are:
  - Fighter: `15 / 13 / 10 / 10 / 10 / 10`
  - Ranger: `12 / 12 / 14 / 10 / 10 / 10`
  - Cleric: `12 / 12 / 8 / 10 / 14 / 12` (`DEX 8`)
  And constructed Ranger audit builds `R1`, `R2`, `R3` with `WIS 9`, `INT 8`, `CHA 8`.
- **Problem:** Every single one of those base arrays is factually wrong, and builds `R1`, `R2`, `R3` are rejected by `validateCharacterCreation()`.
- **Evidence:** In [src/config/index.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/config/index.js#L95-L163):
  - **Fighter:** `STR 14, CON 12, DEX 12, INT 10, WIS 10, CHA 10` (sum `68`, all even; `minCON = 10`, `minDEX = 10`).
  - **Ranger:** `STR 12, CON 10, DEX 14, INT 10, WIS 12, CHA 10` (sum `68`, all even; `baseCON = 10`, `baseWIS = 12` so `minWIS = 10`!). Because `maxDumpPerAttribute = 2`, a Ranger cannot dump `WIS` to `9` (`minWIS = 10`) and cannot dump 3 different stats to reach `18/14/16`!
  - **Cleric:** `STR 12, CON 10, DEX 10, INT 10, WIS 14, CHA 12` (sum `68`, all even; `baseDEX = 10`, `baseCON = 10`, `baseCHA = 12`).
- **Recommended Corrected Rule:** Base all baseline vs V2 comparisons on the actual `src/config/index.js` arrays. Recognize that Era 1 base arrays **already sum to 68 with all even numbers** (`14/12/12/10/10/10`, `12/10/14/10/12/10`, `12/10/10/10/14/12`); the real Era 1 flaw is that Cleric has 2 base points locked in `CHA 12` (`CON 10`) while Fighter starts with `CON 12`, and players can dump `INT` and `CHA` to `8` (`base - 2`) to funnel `+7` points into `STR/DEX/CON`.
- **Priority:** **CRITICAL**

---

#### [C5] Falsified Two-Handed Melee Damage (`1.5x STR`) and Critical Hit (`1x`) Claims
- **Original Documents:** [PHASE-7A-CURRENT-BALANCE-AUDIT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-CURRENT-BALANCE-AUDIT.md#L55-L107), [PHASE-7A-MONSTER-COMBAT-AUDIT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-MONSTER-COMBAT-AUDIT.md#L101-L104)
- **Original Claim:**
  1. Claimed `src/domain/combat/rules.js` applies `floor(STR_mod * 1.5)` to Two-Handed (`2H`) melee weapons.
  2. Claimed Natural 20 does **not** multiply damage (`1x` damage) in `src/domain/combat/rules.js`.
- **Problem:** Both claims are the exact opposite of the actual code in [src/domain/combat/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js).
- **Evidence:**
  1. In [src/domain/combat/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js#L261-L290), `getHeroDamageFormula` adds `1.0x strMod` for **all** melee weapons regardless of `is_two_handed`. Meanwhile, `calculateHeroAC` ([rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js#L219-L224)) strips `shieldBonus` when `weapon.is_two_handed === 1`. Thus 2H weapons in Era 1 sacrifice `+1` to `+4` AC for only `+1` to `+2.5` weapon die damage (`1d8` -> `2d6`), making 2H builds strictly inferior to Sword-and-Board!
  2. In [src/domain/combat/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js#L317-L338), `resolveDamage(damageFormula, isCrit, rng)` explicitly executes `const total = isCrit ? result.total * 2 : result.total;` for both Hero and Monster (`engine.js:409, 513, 608`). Because `isCrit` is `naturalRoll === 20` with **no confirmation roll**, any monster rolling a Natural 20 automatically deals **double total damage (`2x`)**, explaining why Level 1 heroes suffer sudden one-shot deaths!
- **Recommended Corrected Rule:**
  1. **Implement** Two-Handed `1.5x STR` bonus (`strMod + Math.floor(Math.max(0, strMod) * 0.5)`) in `getHeroDamageFormula` when `weapon.is_two_handed === 1` so 2H weapons are a viable offensive trade-off against shields.
  2. **Add Critical Confirmation Rolls** (`d20 + attackBonus >= targetAC`) for both heroes and monsters, honor weapon `crit_threat` (`19–20`, `18–20`) and `crit_mult` (`x2`, `x3`—capped at `x3` in V2), and cap Level 1–2 monster critical damage at `1.5x` (`Math.ceil(rawDamage * 1.5)`).
- **Priority:** **CRITICAL**

---

### HIGH FINDINGS

#### [H1] Misstated Persistent Monster HP Escalation and Loot Transfer Rules
- **Original Documents:** [PHASE-7A-WORLD-PERMADEATH.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-WORLD-PERMADEATH.md#L68-L92), [PHASE-7A-SUMMARY.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-SUMMARY.md#L97-L98)
- **Original Claim:** Claimed `handlePlayerDeath` compounds monster `max_hp` by `+10%` on **every** player kill ($1.10^k$), transfers **100%** of victim gold and items, and calls `generateDynamicTitle`.
- **Problem:** Misstates the actual implementation in [src/domain/monsters/persistence.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js).
- **Evidence:**
  - In [src/domain/monsters/persistence.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js#L166-L185), when an existing persistent monster kills another player (`if (monsterInstanceId)`), `UPDATE monster_instances SET current_hp = max_hp, kill_count = kill_count + 1` is executed — `max_hp` is **never** increased after initial creation (`Math.ceil(baseMonster.base_hp * 1.1)` at line 191)!
  - In [src/domain/monsters/persistence.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js#L82-L103), `transferLootToMonster` transfers only **50% of gold** (`Math.floor(character.gold * 0.5)`) and **50% of items** (`rng() < 0.50`, max 20 items); the remaining 50% are permanently destroyed (`DELETE FROM item_instances`), and Level 1 `0 XP` mule characters transfer `0` gold and `0` starter items.
- **Recommended Corrected Rule:** Document the true persistence rules (`+10%` initial `max_hp` boost, 50% gold/item transfer, anti-mule filter). For V2, allow `+5%` `max_hp` per additional hero kill capped at `+20%` total (`1.20x base_hp`), and add the **3-Day / 3-Kill Tile Displacement & Patrol Rule** on bottleneck tiles like `(8,7)`.
- **Priority:** **HIGH**

---

#### [H2] Misstated City Shop Stock, Global Resale Market (`125%`), Loot Drops, and Bounties
- **Original Documents:** [PHASE-7A-PROGRESSION-ECONOMY.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-PROGRESSION-ECONOMY.md#L52-L92)
- **Original Claim:**
  1. Claimed the city shop sells unimplemented items (`INACTIVE_ITEM_NAMES`).
  2. Claimed `sellItem` lists items on the global resale market at `60%` of `buy_price` and allows potion flooding.
  3. Claimed direct monster gold drops average `11.5 gp` (L1) to `115 gp` (L5).
  4. Claimed Watcher's Board bounties pay `130–540 gp`.
- **Problem:** All four claims contradict the actual codebase.
- **Evidence:**
  1. [src/domain/economy/shop.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/economy/shop.js#L18-L35) (`getCityStoreStock`) queries `WHERE is_magical = 0` (plus `Minor Healing Potion`) and **already filters out** `INACTIVE_ITEM_NAMES`.
  2. [src/domain/economy/shop.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/economy/shop.js#L168-L194) (`sellItem`) **already excludes potions** (`if (!isPotion)`) from `market_listings` and prices magical items on the global market at **`125%` of `buy_price`** (`Math.ceil(item.buy_price * 1.25)`), not `60%`!
  3. [src/domain/combat/loot.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/loot.js#L71-L157) rolls `GOLD_RANGES_STANDARD` (`1..5 gp` at L1, `25..65 gp` at L5) with a `55%` `goldChance` (`0%` for `ANIMAL`), yielding an expected direct gold drop of **`1.65 gp` per non-animal kill at L1** (`~1.1 gp` overall including animals) and **`24.75 gp` at L5**—5x to 10x lower than Phase 7A's table!
  4. [src/domain/bounties/board.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/bounties/board.js#L343-L353) computes `rewardGold = 28 + (targetLevel * 12) + Math.round(cr * 18) + distBonus`, which equals **`49–65 gp` at L1** and **`170–196 gp` at L5**, not `130–540 gp`.
- **Recommended Corrected Rule:** Recalibrate the V2 Economy model around the true baseline numbers (see [PHASE-7A1-MATH-VALIDATION.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-MATH-VALIDATION.md#L210-L265)). Keep `sell_price = floor(buy_price * 0.50)` for player sales, set global market listing price for player-sold non-consumables to `85%` of `buy_price` (`Math.ceil(buy_price * 0.85)`) so second-hand gear is a bargain rather than a `125%` markup, and slightly increase L1–L3 direct coin/salvage drops so non-bounty expeditions remain solvent.
- **Priority:** **HIGH**

---

#### [H3] Oakhaven Distance CR Cap Already Exists ($d \le 3$) But Fails on Persistent Monsters & $d = 4$ Cliff
- **Original Documents:** [PHASE-7A-WORLD-PERMADEATH.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-WORLD-PERMADEATH.md#L52-L55), [PHASE-7A-MONSTER-COMBAT-AUDIT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-MONSTER-COMBAT-AUDIT.md#L120-L125)
- **Original Claim:** Claimed `selectMonsterForTile` has no distance-from-Oakhaven danger cap and can spawn `solo_level 4–5` monsters 1 step outside Oakhaven `(7,6)`.
- **Problem:** Overlooks `getMaxCrForDistance(distance)` in [src/domain/encounters/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js#L18-L27), while missing the two actual bugs in that function.
- **Evidence:**
  - [src/domain/encounters/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js#L18-L27) already enforces:
    - $d \le 1$: `maxCr = 0.334` (`solo_level 1` only)
    - $d = 2$: `maxCr = 0.5` (`solo_level 1` only)
    - $d = 3$: `maxCr = 1.0` (`solo_level 1–2` only)
    - $d \ge 4$: `maxCr = null` (uncapped!)
  - **Actual Bug 1:** Persistent monsters (`getActiveMonstersOnTile`, [engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js#L269-L280)) are selected **before** `getMaxCrForDistance`, so a high-level persistent monster on $d \le 3$ ambushes Level 1 heroes.
  - **Actual Bug 2:** At $d = 4$ (`maxCr = null`), the cap disappears completely, jumping straight from `CR 1.0` (`solo_level 2`) at $d=3$ to uncapped Gaussian selection at $d=4$.
- **Recommended Corrected Rule:** Extend `getMaxSpotDanger(distance)` smoothly across all Chebyshev rings ($d=1$: L1 `CR <= 0.5`; $d=2$: L2 `CR <= 1.0`; $d=3$: L3 `CR <= 2.0`; $d=4$: L4 `CR <= 3.0`; $d=5$: L6 `CR <= 5.0`; $d \ge 6$: L8–L10), and prevent persistent monsters with `solo_level > CharacterLevel + 2` from forcing unavoidable ambushes on $d \le 2$ starter tiles.
- **Priority:** **HIGH**

---

#### [H4] Opening Shot Pre-Combat Kill Breaks Combat State, Aura Order & Monster Reveal
- **Original Documents:** [PHASE-7A-BALANCE-V2-DESIGN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-BALANCE-V2-DESIGN.md#L68), [PHASE-7B-IMPLEMENTATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7B-IMPLEMENTATION-PLAN.md#L45)
- **Original Claim:** Proposed simply replacing `Math.max(1, currentMonsterHp - openingDamage)` with `Math.max(0, currentMonsterHp - openingDamage)` in `startCombat`.
- **Problem:** Simply changing `1` to `0` at [src/domain/combat/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L238) causes three severe bugs:
  1. Line 252 immediately calls `resolveCombatStartAura(monster, heroSaveMods, rng)` **after** Opening Shot—so a monster killed by Opening Shot (`0 HP`) would still fire its Fear/Stench/Disease aura and potentially stun/sicken the victorious Ranger!
  2. Line 281 unconditionally executes `UPDATE encounters SET status = 'IN_COMBAT'`, leaving a `0 HP` monster stuck in active combat instead of awarding XP, loot, bounty credit, and victory state.
  3. [src/domain/encounters/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js#L494) sets `isRevealed = (encounter.status === 'IN_COMBAT')`, so transitioning directly from `DISCOVERED` to `VICTORY` would leave `isRevealed = false` on the victory screen!
- **Recommended Corrected Rule:**
  1. In `startCombat` ([src/domain/combat/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L238-L250)), if `currentMonsterHp <= 0` after Opening Shot:
     - **Skip** `resolveCombatStartAura` and **skip** monster ambush attacks.
     - Immediately invoke `handleMonsterDefeat(tx, encounter, character, monster, combatState, rng)`, award XP (`awardEncounterXp`), roll loot (`generateCombatLoot`), check bounties, and set `encounters.status = 'VICTORY'`.
  2. In `getEncounterById` ([src/domain/encounters/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js#L494)), update `isRevealed` to `encounter.status === 'IN_COMBAT' || encounter.status === 'VICTORY' || encounter.status === 'DEFEAT'`.
- **Priority:** **HIGH**

---

#### [H5] Ecological Mismatch Assigning Subterranean, Desert & Aquatic Monsters to Surface Terrains
- **Original Documents:** [PHASE-7A-BALANCE-V2-DESIGN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-BALANCE-V2-DESIGN.md#L96-L98), [PHASE-7A-MONSTER-COMBAT-AUDIT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-MONSTER-COMBAT-AUDIT.md#L48-L65)
- **Original Claim:** Proposed adding generic `FOREST`, `HILLS`, and `SWAMP` rows in `monster_terrains` for *Drow*, *Duergar*, *Morlock*, *Darkmantle*, *Cloaker*, *Mummy*, *Iron Cobra*, *Skeletal Champion*, *Doppelganger*, and *Phase Spider*.
- **Problem:** Directly violates Darkgrid's world ecology rule (§6: *"Do not assign underwater monsters to ordinary dry terrain solely to make all monsters technically spawnable. If a monster requires a special habitat, recommend an appropriate reachable landmark, encounter type, or biome."*). Having sunlight-sensitive *Drow*, *Duergar*, *Morlocks*, and *Cloakers* wandering ordinary sunlit hills or *Mummies* and *Iron Cobras* roaming generic swamps breaks narrative immersion.
- **Evidence:** The 15x15 world map ([db/seeds/001_seed_world.sql](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/db/seeds/001_seed_world.sql)) and `action-ui-lab` landmark catalog already feature named crypts, ruins, crag caverns, and river crossings.
- **Recommended Corrected Rule:** Introduce **Landmark-Scoped & Sub-Biome Encounter Pools** (`landmark_monster_pools` or `sub_biome` tag on `map_tiles`):
  - **Aquatic / River Crossing (`(8,7)` *The Old Stone Bridge*, plus riparian tiles bordering *Blackwater River* `(7,6)`, `(7,8)`, `(9,7)`):** *Giant Crab*, *Sahuagin*, *Bunyip*, *Draugr*, *Troll*.
  - **Sunken Crypts & Ancient Ruins (`(4,11)` *Deadman's Mire Crypt*, `(9,7)` *Bridge East Watchpost Ruins*, `(11,11)` *Sunken Temple*):** *Skeletal Champion*, *Mummy*, *Iron Cobra*, *Doppelganger*, *Wight*, *Wraith*.
  - **Crag Caverns & Under-Delve Approaches (`(2,3)` *Raven Crags Cavern*, `(6,4)` *Stonefang Under-Pass*, `(12,3)` *Highland Delve*):** *Darkmantle*, *Drow*, *Duergar*, *Morlock*, *Cloaker*, *Gargoyle*.
  - **Eldritch Canopy Rift (`(12,12)` *Deep Jungle Rift* / `(2,12)` *Duskwood Veil*):** *Phase Spider*, *Chaos Beast*, *Shadow Demon*.
- **Priority:** **HIGH**

---

#### [H6] Mathematically Incompatible Simulation Acceptance Gates (`G1` vs `G3` vs `G8`)
- **Original Documents:** [PHASE-7A-SIMULATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-SIMULATION-PLAN.md#L70-L82), [PHASE-7A-SUMMARY.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-SUMMARY.md#L120-L128)
- **Original Claim:** Required `G1` (`85%–93%` same-level encounter win rate in 1v1 combat) alongside `G8` (`30%–45%` full-career survival to Level 10 without permadeath).
- **Problem:** Reaching Level 10 requires **~70 encounters** ([PHASE-7A-BALANCE-V2-DESIGN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-BALANCE-V2-DESIGN.md#L144)). In a permadeath game where losing a fight to the death = permadeath, an `85%–93%` per-encounter survival rate ($p \in [0.85, 0.93]$) over $N = 70$ independent encounters yields a career survival probability of:
  $$P(\text{Survive 70 fights}) = p^{70} \in [0.85^{70}, 0.93^{70}] = [\mathbf{0.0011\%}, \mathbf{0.62\%}]$$
  Even by Level 5 ($N \approx 22$ encounters), $0.89^{22} = \mathbf{7.7\%}$, far below `G8`'s `55%–70%` target!
- **Evidence:** To achieve $P(\text{Survive } N=70) \in [0.30, 0.45]$, the per-encounter **mortality rate** $m$ when playing with rational retreat (`FLEE` + potions) must satisfy $(1 - m)^{70} \in [0.30, 0.45] \implies m \in [\mathbf{1.13\%}, \mathbf{1.70\%}]$ per encounter (and at Level 1 across ~4 encounters, `G3 <= 1.0%` expedition mortality requires $m_{\text{L1}} \le 0.25\%$ per encounter).
- **Recommended Corrected Rule:** Explicitly separate **No-Flee Duel Win Rate (`G1`)** from **Rational-Play Per-Encounter Mortality (`G8`)**:
  - `G1 (No-Flee At-Level 1v1 Duel Win Rate, No Potions, Fight to 0 HP)`: **`85%–93%`** (measures raw stat/class parity when neither side retreats or uses consumables).
  - `G8 (Career Permadeath Survival under Rational Tactical Play — using Potions, Rest, Stage 1 Avoidance, and Deterministic FLEE at HP <= 30%)`: Per-encounter mortality $m \le 1.2\%$ (`98.8%+` survival/escape rate per encounter), yielding **`60%–75%` survival to Level 5** ($N \approx 22$) and **`30%–45%` survival to Level 10** ($N \approx 70$).
- **Priority:** **HIGH**

---

#### [H7] Contradictory Starting Gold Specifications (`25 gp` vs `10 gp` vs `180 gp`)
- **Original Documents:** [PHASE-7A-FRESH-START-STRATEGY.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-FRESH-START-STRATEGY.md#L103), [PHASE-7B-IMPLEMENTATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7B-IMPLEMENTATION-PLAN.md#L31) vs [PHASE-7A-SIMULATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-SIMULATION-PLAN.md#L58)
- **Original Claim:** `FRESH-START-STRATEGY` and `IMPLEMENTATION-PLAN` specify `startingGold = 25 gp`, `SIMULATION-PLAN` specifies `10 gp`, and `BALANCE-V2-DESIGN` omits starting gold altogether. Meanwhile, `src/config/index.js:15` sets `startingGold: 10`, and `action-ui-lab/server/services/sandbox-db-service.js:244` seeds `180 gp`.
- **Recommended Corrected Rule:** Establish a single authoritative Starting Character Specification across all Balance V2 documents, production config, and `action-ui-lab`: **`startingGold = 25 gp`**, **2x `Minor Healing Potion` (`2d4+2` HP)**, and class starter weapon/armor/shield kit.
- **Priority:** **HIGH**

---

### MEDIUM & LOW FINDINGS

| ID | Priority | Original Doc | Problem & Evidence | Recommended Correction |
| :--- | :---: | :--- | :--- | :--- |
| **M1** | **MEDIUM** | `CLASS-BALANCE.md`, `BALANCE-V2-DESIGN.md` | Combining Heavy Armor + Shield (`AC 24–26`), unconditional `DR 4/-`, and `2/combat` *Second Wind* reduces Level 6–8 monster expected damage per round below `2.5 HP/round`, allowing Fighter to out-heal incoming DPS indefinitely. | Cap passive Fighter Armor Mastery at **`DR 1/-` (L3), `DR 2/-` (L6), `DR 3/-` (L9)**, require wearing Medium/Heavy Armor or a Shield, and keep *Second Wind* at `1/combat` until Level 8 (`2/combat` at L8–10). |
| **M2** | **MEDIUM** | `CLASS-BALANCE.md`, `BALANCE-V2-DESIGN.md` | Allowing Cleric to wear Heavy Armor (Full Plate) while also granting *Sacred Weapon* (`+2 ATK/DMG + 1d6 radiant`) and in-combat *Divine Heal* turns Cleric into a strictly superior Fighter. | Restrict Cleric armor proficiency to **Light & Medium Armor + Shields** (max mundane armor: *Breastplate*, `+6 AC`), cap in-combat *Divine Heal* at `1/combat` (Levels 1–6) and `2/combat` (Levels 7–10) from a daily pool of `3 + WIS_mod` charges. |
| **M3** | **MEDIUM** | `MONSTER-COMBAT-AUDIT.md`, `BALANCE-V2-DESIGN.md` | In [src/domain/combat/abilities.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/abilities.js#L1033-L1111), `paralysisCooldown = 3` is decremented at the end of every round (`tickHeroConditionsEndOfRound`), including the round it was applied. This gives a hero 1 guaranteed free action if `initiative_winner === 'MONSTER'` vs 2 free actions if `initiative_winner === 'HERO'`. | Standardize an explicit **`stunImmunityRounds` rule**: when a hero recovers from `paralyzed` or `stunned` (at the end of their skipped turn), set `stunImmunityRounds = 1`, which prevents re-application during the next 1 monster attack phase regardless of initiative order. |
| **M4** | **MEDIUM** | `PROGRESSION-ECONOMY.md`, `MONSTER-COMBAT-AUDIT.md` | `Cloak of Resistance +1` is listed in `INACTIVE_ITEM_NAMES` in [src/domain/combat/loot.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/loot.js#L19) and [src/domain/economy/shop.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/economy/shop.js#L19), even though `getHeroSavingThrows` in [src/domain/character/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L1125) **already implements** `Cloak of Resistance +1` (`+1` to all saves)! | Immediately remove `'Cloak of Resistance +1'` from `INACTIVE_ITEM_NAMES` in `loot.js` and `shop.js`, and extend `getHeroSavingThrows` to read `attributes.save_bonus` dynamically for `+1/+2/+3` cloaks/rings. |
| **M5** | **MEDIUM** | `BALANCE-V2-DESIGN.md` | `INT` granting only `+8%` XP per `+1` modifier becomes a 100% dead stat once a character reaches Level 10 (`maxLevel = 10`). | Pair `+5%` XP per `+1 INT_mod` with **`+1` Tactical Insight per `+1 INT_mod`** (`+1` to Monster Special-Ability Saving Throws and `+1` to Stage 1 Monster Threat/Weakness Identification). |
| **L1** | **LOW** | `CLASS-BALANCE.md`, `BALANCE-V2-DESIGN.md` | Phase 7A allows Rangers to gain `+1 AC` from a Buckler while firing a two-handed bow with zero penalty (standard Pathfinder applies `-1 ATK` when firing a bow with a buckler strapped to the bow arm). | Grant penalty-free Buckler use with bows explicitly as part of Ranger's Level 1 **Skirmisher Form** passive (while non-Rangers take `-1 ATK` if equipping a buckler with a 2H weapon). |
| **L2** | **LOW** | `BALANCE-V2-DESIGN.md` | Several formulas omit explicit integer rounding (`0.75x` Opening Shot, `1.5x` 2H STR, `0.85x` market price). | Specify exact integer rounding (`Math.floor` for stat/damage scaling with `Math.max(1, ...)` minimum damage; `Math.ceil` for market listing prices; `Math.floor` for vendor sell prices). |
| **L3** | **LOW** | `FRESH-START-STRATEGY.md`, `PHASE-6.2` | Commit `b459d99` (Phase 6/6.1) already introduced legacy character archival logic (`characters_legacy_v1_archive`). Re-using that exact table name in Phase 7B without `IF NOT EXISTS` and schema alignment could fail. | Namespace the Phase 7B Era migration archive table as `era1_characters_snapshot` / `era1_item_instances_snapshot` alongside in-table `lifecycle_status = 'RETIRED'` and `era = 1`. |
