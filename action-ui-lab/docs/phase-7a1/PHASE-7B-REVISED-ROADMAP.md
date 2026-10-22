# DARKGRID — PHASE 7A.1: REVISED PHASE 7B IMPLEMENTATION ROADMAP

> **Execution Constraint (§12.9 & §13):** **DO NOT EXECUTE THIS ROADMAP IN PHASE 7A.1.**
> Implementation may only begin after:
> 1. Phase 6.2 final verification ([PHASE-7A1-PHASE6.2-ALIGNMENT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-PHASE6.2-ALIGNMENT.md)) is completed.
> 2. Project owner approves open design decisions `OD-7A1-01` through `OD-7A1-05` ([PHASE-7A1-BALANCE-V2-FINAL-PROPOSAL.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-BALANCE-V2-FINAL-PROPOSAL.md#L395-L425)).

---

## 1. Key Architectural Changes from Phase 7A's Original Implementation Plan

Compared to [PHASE-7B-IMPLEMENTATION-PLAN.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7B-IMPLEMENTATION-PLAN.md), this revised roadmap incorporates six critical engineering corrections:
1. **Simulation-First Baseline (`Stage 7B.0` Moved Before Any Gameplay Edits):** Build the deterministic seeded PRNG (`mulberry32`) Monte Carlo simulation harness and measure the exact Era 1 baseline **before** modifying a single line of domain code.
2. **Removal of Defective Odd-`CON` HP & Odd-Stat Rules:** Implements clean, strictly monotonic **Option A** (`Mod = floor((S - 10)/2)` + `+1` attribute point at Levels 2, 4, 6, 8, 10).
3. **Preservation of Deterministic `FLEE`:** Retains Darkgrid's parting-blow escape mechanic (`Permadeath Safety Rule #8`) instead of introducing a fabricated `65%` flee roll, adding Retreat AC bonuses and *Smoke Bomb* parting-blow suppression.
4. **Full State-Machine Handling for Lethal *Opening Shot*:** Properly routes pre-Round-1 *Opening Shot* kills through `handleMonsterDefeat`, skips dead-monster start auras, updates `isRevealed` for `VICTORY` encounters, and updates `action-ui-lab`'s `combat-controller.js`.
5. **Coherent Landmark-Scoped Monster Ecology:** Binds the 12 unspawnable underground/aquatic/crypt monsters to specific reachable landmarks (`(8,7)` *Old Stone Bridge*, `(4,11)` *Deadman's Mire Crypt*, `(9,7)` *East Watchpost Ruins*, `(2,3)` *Raven Crags Cavern*, `(12,12)` *Deep Jungle Rift*) instead of dumping them into generic surface forests/hills.
6. **Safe `ALIVE` / `FALLEN` / `RETIRED` Lifecycle & Post-6.2 `sandbox-db-service.js` Reconciliation:** Separates schema migration (`014_character_lifecycle_and_era2.sql`) from the operator-gated Era 1 retirement CLI (`scripts/era2-cutover.js`), and updates `migrateLegacyV1CharactersIfNeeded()` in `sandbox-db-service.js` so it checks `era === 1` rather than comparing XP against `FAST_XP_TABLE`.

---

## 2. Stage-by-Stage Implementation Plan (Small, Independently Testable Stages)

### Stage 7B.0 — Post-6.2 Alignment & Deterministic Simulation Harness (Read-Only Baseline)
- **Goal:** Reconcile with post-6.2 `main` and build the deterministic simulation suite (`tests/simulation/`) before changing any gameplay rules.
- **Files to Create (Test/Simulation Only):**
  - `tests/simulation/prng.js` (`mulberry32(seed)` deterministic PRNG)
  - `tests/simulation/tier1-combat-matrix.js` (294 class-vs-monster 1v1 duel runner)
  - `tests/simulation/tier2-expedition-agent.js` (Rational retreat + potion + rest expedition loop)
  - `tests/simulation/tier3-career-progression.js` (1,000-career Level 1 $\to$ 10 survival & P25 wealth verifier)
- **Verification Gate:**
  - Execute post-6.2 checklist ([PHASE-7A1-PHASE6.2-ALIGNMENT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-PHASE6.2-ALIGNMENT.md#L40-L60)).
  - Run baseline Era 1 simulation (`seed = 20261022`) and archive baseline metrics JSON (`artifacts/era1-baseline-metrics.json`).
  - Confirm `npm test` and `action-ui-lab/tests/phase6-integration.test.js` pass 100%.

---

### Stage 7B.1 — Database Schema Migration (`014`) & Lifecycle Safety
- **Goal:** Add non-destructive schema support for character lifecycle (`ALIVE`, `FALLEN`, `RETIRED`), Era tracking (`era`), level-up attribute points, Hunter Doctrines, active potion buffs, and Landmark encounter pools.
- **Files to Create / Modify:**
  - `db/migrations/014_character_lifecycle_and_era2.sql`
  - `action-ui-lab/server/services/sandbox-db-service.js` (update `migrateLegacyV1CharactersIfNeeded` to use `era` and `lifecycle_status = 'RETIRED'` so lowering `FAST_XP_TABLE` in Stage 7B.2 never auto-retires active Era 2 heroes; promote map tile overrides cleanly).
  - `src/domain/monsters/persistence.js` (`handlePlayerDeath` sets `lifecycle_status = 'FALLEN'`).
- **Independent Test Gate:**
  - Unit & integration tests verifying:
    1. `character_history` view includes `'FALLEN'` characters and excludes `'RETIRED'` characters.
    2. `retired_veterans_history` view displays `'RETIRED'` characters with `died_at IS NULL`.
    3. `idx_one_living_character_per_user` permits a user with a `'RETIRED'` character to create a new `'ALIVE'` character.

---

### Stage 7B.2 — Attribute System V2, XP Curve & Character Creation (`INV-1`)
- **Goal:** Implement the 68+4=72 attribute system (floor `10`, creation cap `16`), `+1` attribute point at Levels 2, 4, 6, 8, 10 (cap `20`), `25 gp` starting gold, monotonic HP formula, V2 `FAST_XP_TABLE` (`30,000 XP` at L10), and proportionate `INT` / `CHA` bonuses.
- **Files to Modify:**
  - `src/config/index.js` (`startingGold: 25`, `bonusPointsAtCreation: 4`, `minAttributeFloor: 10`, `maxAttributeAtCreation: 16`, normalized base arrays `14/12/12/10/10/10`, `12/12/14/10/10/10`, `12/12/10/10/14/10`).
  - `src/domain/character/rules.js` (`FAST_XP_TABLE`, `calculateMaxHp`, `spendAttributePoint`, `calculateXpWithIntelligence` at `+5%` + `+1` insight save, `calculateShopPriceWithCharisma` + vendor sell bonus).
  - `action-ui-lab/server/controllers/auth-character-controller.js` and `character-town-controller.js` (expose `SPEND_ATTRIBUTE_POINT` action and 4-point creation validation).
- **Independent Test Gate:**
  - Automated monotonicity test asserting **`INV-1`** across all classes, levels `1..10`, and attribute scores `8..20`.

---

### Stage 7B.3 — Class Progression V2 (Fighter, Ranger, Cleric) & Lethal *Opening Shot*
- **Goal:** Implement the Level 1–10 progression tables ([PHASE-7A1-CLASS-PROGRESSION.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-CLASS-PROGRESSION.md)):
  - Full BAB (`+1` to `+10`) for Fighter/Ranger; `3/4` BAB (`+1` at L1 to `+8` at L10) for Cleric.
  - Fighter *Weapon Training*, *Armor Training*, *Armor Mastery* (`DR 1/-` to `3/-` in Medium/Heavy Armor or Shield), and *Second Wind* (`+2 AC` for 1 rd at L4+, `2/combat` at L8+).
  - Ranger 3 broad *Hunter Doctrines* (+ Secondary Doctrine at L5), *Precision Aim*, *Skirmisher Form* (Buckler with Bow, Composite Bow `DEX + 0.5*STR`), *Evasive Retreat* (`+2/+3` Retreat AC), and lethal *Opening Shot* (`0.75x` L1–6, `1.0x` L7+) properly routed through `handleMonsterDefeat`.
  - Cleric Medium Armor + Shield proficiency, *Sacred Conduit* (`+1/+2` ATK/DMG + `+1d4/+1d6` Radiant for 2 rounds after healing), in-combat *Divine Healing* (`1/combat` L1–6, `2/combat` L7–10), and expanded *Holy Radiance* (`UNDEAD` + half vs `OUTSIDER`/`ABERRATION`).
- **Files to Modify:**
  - `src/domain/character/rules.js`
  - `src/domain/combat/rules.js`
  - `src/domain/combat/engine.js`
  - `src/domain/encounters/engine.js` (`isRevealed` includes `'VICTORY'`)
  - `src/routes/game.js` and `action-ui-lab/server/controllers/combat-controller.js`
- **Independent Test Gate:**
  - Unit tests for every class milestone at Levels 1–10 and integration test verifying a Ranger *Opening Shot* kill transitions cleanly to `VICTORY`, awards XP/loot/bounty credit, reveals the monster, and does **not** trigger dead-monster start-of-combat auras.

---

### Stage 7B.4 — Combat Mathematics V2, Confirmed Crits & Status Recovery (`INV-2`, `INV-4`)
- **Goal:** Implement `1.5x STR` for 2H melee weapons, critical threat/multiplier reading from weapon attributes (`crit_threat`, `crit_mult` capped at `x3`), **Critical Confirmation Rolls** (`d20 + ATK >= AC`) for heroes and monsters, `1.5x` monster crit cap at Levels 1–2 (`INV-2`), Retreat AC on `FLEE`, and turn-order-independent `stunImmunityRounds = 1` (`INV-4`).
- **Files to Modify:**
  - `src/domain/combat/rules.js` (`resolveAttackRoll`, `resolveDamage`, `getHeroDamageFormula`, `calculateRetreatAC`)
  - `src/domain/combat/engine.js` (`executeCombatRound`, `FLEE` parting blow against `calculateRetreatAC`, `stunImmunityRounds` decrement on monster turn)
  - `src/domain/combat/abilities.js`
- **Independent Test Gate:**
  - Automated tests verifying **`INV-2`** (zero L1 one-shots across all 20 Tier 1 monsters) and **`INV-4`** (guaranteed free action after stun/paralysis under both `'HERO'` and `'MONSTER'` initiative winners).

---

### Stage 7B.5 — Monster Re-Tiering (Levels 1–10), Data-Driven Abilities & Coherent Landmark Ecology (`INV-3`)
- **Goal:** Spread the 98 monsters across `solo_level` 1–8 (with Veteran/Apex templates for L9–10), wire `abilities.js` to read `monsters.special_abilities` JSON with scaled DCs (`10 + floor(solo_level * 0.75)`), implement smooth 7-ring Chebyshev danger caps around Oakhaven, add the Chokepoint Patrol Displacement rule on `(8,7)`, and map the 12 unspawnable monsters to their ecologically coherent Landmark Pools.
- **Files to Create / Modify:**
  - `db/migrations/015_monster_retiering_and_landmark_ecology.sql`
  - `src/domain/encounters/engine.js` (`getMaxCrForDistance`, Landmark pool selector, Stage 1 Threat Skull indicator, grey-mob XP decay)
  - `src/domain/combat/abilities.js`
  - `src/domain/monsters/persistence.js`
- **Independent Test Gate:**
  - Automated test verifying **`INV-3`** (all 98 monsters spawnable in ecologically matching habitats; `(8,7)` *Old Stone Bridge* spawns riparian/bridge monsters; persistent monsters on `(8,7)` with `solo_level >= L+2` cannot force Stage 2 ambushes).

---

### Stage 7B.6 — Economy, Masterwork Gear, Active Consumables & Global Market (`INV-5`)
- **Goal:** Remove `'Cloak of Resistance +1'` from `INACTIVE_ITEM_NAMES`, implement all remaining items and the 7 buff/utility consumables (`useConsumable` + `active_buff_json` + *Smoke Bomb*), unify `action-ui-lab`'s `CONSUME_POTION` controller with `useConsumable()`, add Masterwork weapons/armor to the Oakhaven shop, set global market resale listing price to `85%` of `buy_price` (FIFO cap `30`), and add Pelt/Trophy salvage drops to `ANIMAL`/`VERMIN` monsters.
- **Files to Create / Modify:**
  - `db/migrations/016_economy_masterwork_and_items_v2.sql`
  - `src/domain/character/rules.js` (`useConsumable`, dynamic item attribute readers)
  - `src/domain/combat/loot.js`
  - `src/domain/economy/shop.js`
  - `src/domain/bounties/board.js`
  - `action-ui-lab/server/controllers/character-town-controller.js`
- **Independent Test Gate:**
  - Automated test verifying **`INV-5`** (every seeded item and potion executes its intended effect; `INACTIVE_ITEM_NAMES` and `INACTIVE_CONSUMABLE_NAMES` are empty).

---

### Stage 7B.7 — Full Monte Carlo Simulation Verification & Tuning Loop (`G1`–`G8`)
- **Goal:** Run the Stage 7B.0 simulation suite (`seed = 20261022`) against the completed Balance V2 implementation and iteratively tune monster HP/AC/damage and loot tables until all Hard Safety Invariants (`INV-1`..`INV-5`) and Design Gates (`G1`–`G8`) pass simultaneously.
- **Deliverable:** `action-ui-lab/docs/phase-7b/PHASE-7B-SIMULATION-VERIFICATION-REPORT.md` comparing Era 1 vs Era 2 across all gates.

---

### Stage 7B.8 — Operator-Gated Era 2 Cutover Tooling (`scripts/era2-cutover.js`)
- **Goal:** Implement and test `scripts/era2-cutover.js` (with `--dry-run`, `VACUUM INTO` backup + SHA-256 verification, `era1_characters_snapshot`, `lifecycle_status = 'RETIRED'`, and post-transaction invariant assertions) against a temporary copy of the database.
- **Strict Rule:** Do **not** execute `scripts/era2-cutover.js` against the live production database without explicit owner sign-off (`OD-7A1-05`).
