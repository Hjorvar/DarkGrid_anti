# DARKGRID — PHASE 7A.1: EXECUTIVE SUMMARY & DESIGN REVIEW VERDICT

## 1. Review Metadata & Concurrency Safety Record

| Field | Value |
| :--- | :--- |
| **Phase** | Phase 7A.1 — Balance V2 Design Review, Mathematical Correction & Phase 6.2 Alignment |
| **Execution Mode** | **Documentation & Analysis Only** (Zero Gameplay, Database, Asset, or Test Modifications) |
| **Dedicated Branch** | `darkgrid_phase7a1_design_review` |
| **Active Worktree** | `C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit` |
| **Reviewed Base Commit** | `b604661` (`docs(phase-7a): commit completed Phase 7A balance audit and V2 design documents`), parent `87ed6f3` (`docs(action-ui-lab): add main branch integration report and post-merge QA verification`) |
| **Phase 6.2 Alignment Status** | **PENDING PHASE 6.2 FINAL VERIFICATION** (Read-only inspection of `b459d99` and `042d122` completed without modifying any concurrent worktree or branch) |

---

## 2. Executive Review Verdict

**Verdict: CONDITIONAL APPROVAL WITH MANDATORY MATHEMATICAL & ARCHITECTURAL CORRECTIONS**

The Phase 7A audit ([PHASE-7A-SUMMARY.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-SUMMARY.md)) accurately identified several core structural bottlenecks in Darkgrid Era 1:
- All 98 database monsters are compressed into `solo_level` 1–5 while character progression spans Levels 1–10.
- Twelve monsters (12.2% of the roster) have zero valid spawn tiles on the 15x15 world map, and *The Old Stone Bridge* `(8,7)` (`terrain = 'BRIDGE'`) has zero mapped monsters.
- Cleric suffers a severe combat collapse against non-Undead monsters (88% of the spawnable roster) due to `0.75x` attack scaling (`+0` at Level 1), inability to use *Divine Self-Heal* in combat, and lack of general combat passives.
- Ranger's *Opening Shot* is artificially clamped at `1 HP` (`Math.max(1, currentMonsterHp - openingDamage)` in [engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L238)), and single-type *Favored Enemy* lock-in creates extreme variance (`CONSTRUCT` has 0 spawnable targets).
- Fighter and Ranger both receive `+0` Base Attack Bonus at Level 1 (`level - 1` in [rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L88-L96)), inflating early-game permadeath RNG.
- Eighteen seeded items (`INACTIVE_ITEM_NAMES` / `INACTIVE_CONSUMABLE_NAMES`) lack runtime implementation, and monster `special_abilities` JSON in SQLite is bypassed by a hardcoded name switch in [abilities.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/abilities.js#L272-L1200).

**However, our independent code-level and mathematical audit uncovered 20 defects across the 10 Phase 7A documents (5 CRITICAL, 7 HIGH, 5 MEDIUM, 3 LOW) that would introduce game-breaking bugs, non-monotonic character progression, data-corrupting migrations, and impossible simulation gates if implemented as written.**

---

## 3. Summary of Findings by Severity

| Severity | Count | Key Themes |
| :--- | :---: | :--- |
| **CRITICAL** | **5** | (C1) Non-monotonic odd-`CON` HP formula where `CON 13` (`17 HP`) beats `CON 14` (`16 HP`) at Level 1; (C2) Fabricated `65%` Flee roll (`FLEE` in Darkgrid is a 100% deterministic escape after 1 parting attack); (C3) Fresh Start `is_alive = 0` + `died_at` corrupts *Hall of the Fallen* and triggers irreversible permadeath lock; (C4) Falsified Era 1 class base arrays and illegal Ranger audit builds; (C5) Misstated 2H melee damage (`1.0x STR` in code, not `1.5x`) and critical hit multiplier (`2x` already active in code, including unconfirmed `2x` monster crits). |
| **HIGH** | **7** | (H1) Persistent monster HP escalation & loot transfer misstated (`+10%` once, 50% gold/item burn); (H2) Shop stock, global resale (`125%`, not `60%`), loot drops, and bounty rewards misstated; (H3) Oakhaven CR cap (`getMaxCrForDistance`) already exists for `d <= 3` but fails on persistent monsters and `d = 4` cliff; (H4) *Opening Shot* instant kill breaks combat state & aura order unless routed through `handleMonsterDefeat`; (H5) Ecological violations in V2 terrain mapping (subterranean/desert monsters dumped into surface forests/hills); (H6) Mathematically incompatible Simulation Gates `G1` (`85–93%` win rate) vs `G8` (`30–45%` L10 survival over 70 fights); (H7) Starting gold contradiction (`25 gp` vs `10 gp` vs `100 gp`). |
| **MEDIUM** | **5** | (M1) Fighter defensive stacking (`AC 24 + DR 4 + 2/combat Second Wind`) creates near-immortality against multi-hit monsters; (M2) Cleric *Sacred Weapon* + in-combat *Divine Heal* + heavy armor blurs Fighter identity; (M3) Stun/Paralysis cooldown decrement timing depends on initiative winner (`paralysisCooldown = 3`); (M4) `Cloak of Resistance +1` is implemented in [character/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L1125) but mistakenly blocked in `INACTIVE_ITEM_NAMES` in [loot.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/loot.js#L19); (M5) `INT` XP bonus (`+8%` per mod) remains a dead stat at Level 10 cap. |
| **LOW** | **3** | (L1) Buckler bow penalty (`-1 ATK` in Pathfinder vs penalty-free in V2); (L2) Unspecified rounding conventions (`floor` vs `round`) across V2 damage/economy formulas; (L3) Phase 6.2 `characters_legacy_v1_archive` table name collision risk with Phase 7B Era migration. |

Full evidence and line-by-line citations are provided in [PHASE-7A1-CORRECTIONS.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-CORRECTIONS.md).

---

## 4. Core Design Recommendations (Balance V2 Corrected)

1. **Attribute System (Simplicity & Monotonicity First):**
   - **Reject** the Phase 7A odd-stat secondary bonus table (`+2 HP if CON is odd`, `+1 Init if DEX is odd`, etc.), which causes `CON 13` to have **more HP than `CON 14` at Level 1** (`17 HP` vs `16 HP` for Fighter) and adds unnecessary cognitive complexity.
   - **Adopt Option A (Standard Pathfinder Modifiers + Level-Up Attribute Growth):** Normalize class base arrays to `68` points, grant `4` creation points (`72` total, dump floor `10`, creation cap `16`), and grant **`+1` Attribute Point at Levels 2, 4, 6, 8, and 10 (`+5` total, max `20`)**. Because characters receive 5 level-up points, an odd starting score (`13` or `15`) is naturally a 1-step bridge to the next even breakpoint at Level 2 or 4 without convoluted odd-score rules.
   - **Make `INT` and `CHA` Proportionate Without Dominant Traps:**
     - `INT_mod > 0`: Grants `+5%` Combat XP per `+1` modifier **plus** `+1` **Tactical Insight** per `+1` modifier (`+1` to Encounter Stage 1 Lore/Identification threshold and `+1` to Monster Special-Ability Saving Throws / Trap Avoidance). Unlike XP alone, saving throw / insight utility remains valuable at Level 10.
     - `CHA_mod > 0`: Grants `-5%` City Shop buy price, `+5%` Direct NPC Vendor sell price (`sell_price`), `+5%` Watcher's Board bounty gold reward, and **`+1` Resolve AC against the monster's parting blow when executing `FLEE`** (capped at `+2`).

2. **Preserve Deterministic Flee & Fix Monster Crit Spikes:**
   - Keep Darkgrid's core deterministic `FLEE` rule ([engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L503-L546)): `FLEE` always succeeds (`status = 'ESCAPED'`) if the hero survives one parting normal attack from the monster.
   - Replace all fabricated `% flee chance` bonuses in Phase 7A with **Retreat Defense (`+AC` against the parting blow)** and a **Smoke Bomb** consumable that negates the parting attack when escaping.
   - Require **Critical Confirmation Rolls** (`d20 + ATK >= Target AC`) for both Heroes and Monsters on critical threats, and cap standard monster critical multipliers at `1.5x` (`Math.ceil(damage * 1.5)`) at Levels 1–2 (`2.0x` for Level 3+ only on confirmed crits) to eliminate unavoidable Level 1 one-shot permadeaths.

3. **Distinct Class Identities Across Levels 1–10:**
   - **Fighter (Armored Vanguard):** Full BAB (`+1` to `+10`), `10 + CON` HP/level, *Weapon Training* (`+1` to `+3`), *Armor Training* (reduces heavy armor DEX/Initiative penalty), *Shield Block / DR* (`DR 1/-` at L3, `DR 2/-` at L6, `DR 3/-` at L9 **while wearing Medium/Heavy Armor or a Shield**), and *Second Wind* (`1/combat`, `2/combat` at L8 only).
   - **Ranger (Precision Skirmisher & Scout):** Full BAB (`+1` to `+10`), `8 + CON` HP/level, lethal *Opening Shot* (`0.75x` damage pre-Round 1, `1.0x` at L7; properly triggers `handleMonsterDefeat` on kill), 3 broad *Hunter Doctrines* (*Beasts & Predators*, *Twisted & Unnatural*, *Brigands & Sentients*), *Skirmisher's Evasion* (`+2 AC` against parting blows on `FLEE` and `+1` Initiative/Detection), and Composite Bow `DEX + 0.5*STR` scaling.
   - **Cleric (Sacred Bulwark & Conduit):** `3/4` BAB (`+1` at L1 to `+8` at L10), `8 + CON` HP/level, **Medium Armor + Shields** (preserving Fighter's Heavy Armor exclusivity), *Sacred Conduit* (`+1` to `+2` sacred attack/damage and `1d4` to `1d6` radiant damage when channeling), in-combat *Divine Healing* (`3 + WIS_mod` daily charges, `1/combat` limit until L6, `2/combat` at L7+), and *Holy Radiance* against Undead/Fiends/Aberrations.

4. **Coherent World Ecology for All 98 Monsters:**
   - Do **not** dump subterranean (*Drow, Duergar, Morlock, Cloaker*), desert (*Mummy*), or aquatic (*Giant Crab, Sahuagin*) creatures into ordinary dry surface forests or hills.
   - Instead, bind those 12 monsters to **specific reachable landmarks and sub-biomes** on the 15x15 grid:
     - *The Old Stone Bridge / Blackwater Ford `(8,7)`* (`BRIDGE` + river crossing): *Giant Crab (L2)*, *Sahuagin (L3)*, plus riparian ambushers (*Bunyip, Draugr,Troll*).
     - *Bridge East Watchpost / Sunken Ruins `(9,7)`* & *Deadman's Mire Crypts `(4,11)`*: *Skeletal Champion (L3)*, *Iron Cobra (L3)*, *Mummy (L6)*, *Doppelganger (L4)*.
     - *Raven Crags Cavern Approach `(2,3)`* & *Highland Under-Delve `(11,3)`*: *Darkmantle (L2)*, *Drow (L2)*, *Duergar (L2)*, *Morlock (L3)*, *Cloaker (L6)*.
     - *Deep Jungle / Eldritch Rift `(12,12)`*: *Phase Spider (L6)*.

5. **Safe Lifecycle-Aware Era Migration:**
   - Never set `is_alive = 0` and `died_at = CURRENT_TIMESTAMP` on living Era 1 heroes without lifecycle differentiation.
   - Add `lifecycle_status TEXT NOT NULL DEFAULT 'ALIVE' CHECK (lifecycle_status IN ('ALIVE', 'FALLEN', 'RETIRED'))` and `era INTEGER NOT NULL DEFAULT 1`.
   - Retired Era 1 heroes transition to `lifecycle_status = 'RETIRED'`, `is_alive = 0`, `died_at = NULL`, `retired_at = CURRENT_TIMESTAMP`, keeping the *Hall of the Fallen* strictly for battle deaths (`lifecycle_status = 'FALLEN'`) while preserving Era 1 veterans and their equipped panoply in a dedicated *Hall of Legends (Era I Archives)*.

---

## 5. Unresolved Design Decisions Requiring Owner Approval

Before Phase 7B implementation begins, the project owner must approve the following 5 policy choices (documented in [PHASE-7A1-BALANCE-V2-FINAL-PROPOSAL.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-BALANCE-V2-FINAL-PROPOSAL.md#L395-L425)):

1. **OD-7A1-01 (Attribute System):** Confirm **Option A** (Standard Pathfinder modifiers + `+1` attribute point at Levels 2, 4, 6, 8, 10, rejecting odd-stat sub-bonuses).
2. **OD-7A1-02 (Starting Gold):** Confirm **25 gp** starting gold across production (`src/config/index.js`) and `action-ui-lab` (replacing `10 gp` in `config` and `180 gp` sandbox seed).
3. **OD-7A1-03 (Cleric Armor Proficiency):** Confirm Cleric is capped at **Medium Armor + Shields** (Breastplate max) so Heavy Armor (Banded/Splint/Full Plate) remains exclusive to Fighter.
4. **OD-7A1-04 (Subterranean & Aquatic Monster Ecology):** Confirm Landmark-Scoped Encounter Pools (`landmark_monster_pools` / tile-specific sub-biomes) over generic surface terrain assignment for the 12 unspawnable monsters.
5. **OD-7A1-05 (Era 1 Retirement Policy):** Confirm whether the Fresh Start Era Migration should be executed as an **Opt-In / Admin-Gated CLI Migration** (`lifecycle_status = 'RETIRED'`) or only applied after Phase 7B passes all simulation gates `G1–G8`.

---

## 6. Readiness & Phase 6.2 Status

- **Phase 6.2 Alignment Status:** **PENDING PHASE 6.2 FINAL VERIFICATION** (See [PHASE-7A1-PHASE6.2-ALIGNMENT.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-PHASE6.2-ALIGNMENT.md)).
- **Phase 7B Readiness:** **READY FOR STAGE 7B.0 (SIMULATION HARNESS & POST-6.2 RECONCILIATION)** once Phase 6.2 final verification and owner sign-off on `OD-7A1-01..05` are completed.
