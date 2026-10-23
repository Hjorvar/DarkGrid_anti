# DARKGRID — PHASE 7A.2: REVISED PHASE 7B IMPLEMENTATION ROADMAP & PHASE 6.2 ALIGNMENT

> [!IMPORTANT]
> **Historical Design Baseline (Superseded by Phase 7A.3):** This Phase 7A.2 document is preserved as historical design context. For the authoritative Phase 7B implementation roadmap—incorporating `monster_family`, `character_monster_experience`, 72-point free attribute allocation (`8–18`), Fighter *Second Wind Lethal Rescue*, and the fix for the Ranger *Opening Shot* `Math.max(1, ...)` bug in `src/domain/combat/engine.js:238`—see [`../phase-7a3/PHASE-7A3-PHASE7B-ROADMAP.md`](../phase-7a3/PHASE-7A3-PHASE7B-ROADMAP.md).

**Date:** 2026-10-22  
**Phase:** 7A.2 — Class Identity & Thematic Progression (Design & Documentation Only)  
**Verified Against `main` Commit:** `042d122` (`docs(action-ui-lab): add Phase 6.2 final source-of-truth verification report`)

---

## 1. Post-Phase-6.2 Repository Verification & Alignment (`042d122`)

Before revising the Phase 7B roadmap, the actual `main` branch (`042d122`, incorporating Phase 6 + 6.1 implementation commit `b459d99` and Phase 6.2 reconciliation commit `7dd0909`) was audited and merged cleanly into the working design branch.

### Verified Post-Phase-6.2 Ground Truth
1. **Authentication & Session Security ([`action-ui-lab/server/controllers/auth-character-controller.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/controllers/auth-character-controller.js)):**
   - Uses `bcryptjs` password hashing via `src/domain/auth/service.js` and HttpOnly `__session` cookies backed by the `user_sessions` table.
   - Enforces one living character per user (`getLivingCharacterByUserId`), dead-hero preservation in the Hall of the Fallen (`is_alive = 0`), and clean successor character creation after permadeath.
2. **Production vs. Sandbox Separation ([`action-ui-lab/server/services/legacy-compatibility-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/legacy-compatibility-service.js)):**
   - `isProductionMode()` (`NODE_ENV === 'production' || Boolean(process.env.K_SERVICE)`) and `isAuthRequired()` isolate production Cloud Run / Firebase environments from local sandbox conveniences.
   - `ensureLivingHero(db)` in [`sandbox-db-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/sandbox-db-service.js) is strictly skipped when `isProductionMode() || isAuthRequired()`.
   - `labAntiTamperMiddleware` blocks client-trusted combat outcomes (`forceOutcome`, `instantKill`, `godMode`, `winCombat`, `grantXp`, `grantGold`, `setHp`, `bypassCombat`) and gates `/api/lab/*` endpoints behind `isLabToolsAllowedForUser`.
3. **Already-Implemented Engine Wiring in `b459d99`:**
   - Out-of-combat Cleric healing (`performClericSelfHeal` in [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L261-L320)) is **already wired** to `POST /api/town/action` (`action === 'CLERIC_HEAL'`) in [`character-town-controller.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/controllers/character-town-controller.js#L21-L35) with current charge rules (`2` at L1, `3` at L5, `4` at L9; `1d6+WIS` to `5d6+WIS`)!
   - Lethal **Opening Shot** victory handling (`result.status === 'VICTORY' || result.monsterDied` setting `pending_victory_encounter_id`) is **already wired** in [`combat-controller.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/controllers/combat-controller.js#L40-L56)!
   - Explicit special-ability profiles for **all 98 monsters** are **already implemented** in [`src/domain/combat/abilities.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/abilities.js#L131-L527)!

---

## 2. Catalogue of Obsolete Phase 7A.1 Proposals (Retired by Phase 7A.2)

The following proposals from `action-ui-lab/docs/phase-7a1/` are **formally superseded and retired** under Phase 7A.2:

| Obsolete Phase 7A.1 Proposal | Why It Is Retired | Phase 7A.2 Authoritative Replacement |
| :--- | :--- | :--- |
| **1. Three Broad Ranger "Hunter Doctrines" (`WILD_STALKER`, `WARBAND_SLAYER`, `ABERRANT_HUNTER`) + L5 Secondary Doctrine** | Destroyed the personal hunting identity of choosing a single Favored Enemy at character creation. | **Restored Single Favored Enemy:** Player chooses **ONE Favored Enemy** at character creation from 7 curated, well-represented categories (Undead strictly excluded; Humanoid subtypes preserved). |
| **2. Cleric In-Combat Self-Healing (`1/combat` L1–6, `2/combat` L7–10, `3 + WIS_mod` charges)** | Turned Cleric into a heavily armored Fighter with repeatable mid-combat healing, erasing Cleric's distinct expedition-recovery identity. | **Restored Out-of-Combat Divine Self-Healing:** Primarily between battles (`2` charges L1, `3` L5, `4` L9; `1d6+WIS` to `5d6+WIS`, recharged in a city). |
| **3. Cleric *Sacred Conduit* General Combat Bonus & Half-Bonus vs. All Outsiders/Aberrations** | Artificially inflated Cleric general DPS to satisfy equal-win-rate simulation gates and diluted Undead specialization. | **Intentional Asymmetry & Pure Undead Mastery:** Cleric is intentionally the weakest general direct combatant, but dominates all 12 Undead via *Undead Knowledge*, *Sacred Strike*, *Turn Undead*, and *Holy Protection*. |
| **4. Simulation Gate `G2` (`<= 8.0 pp` Inter-Class Win-Rate Spread)** | Forced homogenization of Fighter, Ranger, and Cleric into identical win-rate bands. | **Removed:** Replaced by the 10 Thematic Asymmetry & Safety Verification Criteria in [`PHASE-7A2-SIMULATION-REVISION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-SIMULATION-REVISION.md). |
| **5. Numerical Min-Max Point-Buy UI & Raw `+X` Stat/Ability Displays** | Violated the **Hidden Mathematics** rule by exposing raw modifiers (`STR 16 (+3)`, `+2 Atk vs Undead`, `Atk +4 • 1d8`) in the UI. | **Hidden Mathematics & Descriptive Progression:** Descriptive aptitudes (*Strong*, *Tough*, *Agile*, *Perceptive*, *Wise*, *Commanding*) and qualitative ability/equipment prose in UI; exact math stays server-side. |
| **6. Mandatory Era V2 Retirement of Existing Living Characters** | Unnecessary and disruptive when changes are additive and backward-compatible. | **Non-Destructive In-Place Compatibility:** Existing characters remain playable without reset or forced retirement; canonical Max HP and legacy `favored_enemy` strings are supported non-destructively. |

---

## 3. Revised Phase 7B Implementation Roadmap (6 Stages)

When the owner approves Phase 7A.2 to proceed into **Phase 7B (Implementation)**, execution will follow six clean, non-destructive stages:

### Stage 7B.1 — Non-Destructive Schema & Config Foundation (`db/` & `src/config/index.js`)
- **Objective:** Codify the Phase 7A.2 progression tables, descriptive aptitude mappings, and monster specialization rules in configuration without resetting or retiring any characters.
- **Files to Modify:**
  - [`src/config/index.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/config/index.js):
    - Update `CLASSES` constants (`FIGHTER`, `RANGER`, `CLERIC`) with Level 1–10 internal progression tables (*Battle-Hardened*, *Weapon Mastery*, *Know Your Enemy*, *Armor Mastery*, *Second Wind*; *Favored Enemy*, *Opening Shot*, *Wilderness Instinct*, *Hunter's Knowledge*, *Evasive Retreat*; *Divine Self-Healing*, *Undead Knowledge*, *Sacred Strike*, *Turn Undead*, *Holy Protection*).
    - Add `DESCRIPTIVE_APTITUDES` (`Strong`, `Agile`, `Tough`, `Perceptive`, `Wise`, `Commanding`) and qualitative attribute tier lookup tables (`ATTRIBUTE_TIER_LABELS`).
  - [`action-ui-lab/server/services/legacy-compatibility-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/legacy-compatibility-service.js):
    - Update `FAVORED_ENEMY_OPTIONS` to the 7 curated categories (while keeping backward compatibility for legacy saved strings).
    - Update `buildClassAbilitySummary` so **zero** numerical bonuses (`+1`, `+2`, `1d6`) appear in player-facing ability summaries.

### Stage 7B.2 — Character Creation, Level-Up & Retroactive Constitution Engine (`src/domain/character/rules.js`)
- **Objective:** Implement descriptive character creation support, Level 2/4/6/8/10 attribute growth, and the **Mandatory Retroactive Constitution Rule**.
- **Files to Modify:**
  - [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js):
    - Add `resolveDescriptiveAttributes(heroClass, primaryAptitude, secondaryAptitude)` alongside existing `validateAttributeAllocation` so both descriptive creation and legacy test payloads work seamlessly.
    - Implement `calculateCanonicalMaxHp({ heroClass, level, con })` including Fighter *Battle-Hardened* bonus HP and retroactive $L \times \text{CON\_mod}$.
    - Implement `applyAttributeIncrease(db, characterId, attributeKey)` for Levels 2, 4, 6, 8, and 10:
      - When `CON_mod` increases by $+1$ at Level $L$, increase `max_hp` by $+L$ and increase `current_hp` by $+L$ (capped at `max_hp`, **never** full-healing missing HP).
      - Support symmetric retroactive `CON_mod` decreases while keeping `1 <= current_hp <= max_hp`.

### Stage 7B.3 — Monster Knowledge System (Approved Option A) & Encounter Integration (`src/domain/encounters/` & `src/domain/monsters/`)
- **Objective:** Connect all 98 monsters to the three class expertise domains (*Fighter Martial/Humanoid/Giant*, *Ranger Natural Knowledge + Favored Enemy*, *Cleric Undead Mastery*).
- **Files to Modify:**
  - Create `src/domain/monsters/knowledge.js` (or extend `src/domain/encounters/engine.js`):
    - Implement `isFighterMartialTarget(monster)` (all 17 `Humanoid` + 8 martial `Monstrous Humanoid`/`Fey (gnome)` giants/raiders; excluding occult `Green Hag`).
    - Implement `isRangerNaturalTarget(monster)` (`Animal`, `Magical Beast`, `Vermin`, `Plant`, `Fey`, `Dragon` = 61 monsters).
    - Implement `doesMonsterMatchFavoredEnemy(favoredEnemy, monster)` (supporting both the 7 curated categories and legacy subtype strings; strictly returning `false` for `Undead`).
    - Implement `isClericUndeadTarget(monster)` (all 12 `Undead` monsters, plus secondary curse-save recognition).
  - [`src/domain/encounters/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js):
    - Update `resolveMonsterDescription(descriptions, heroClass, encounterState, monster, favoredEnemy)` so **Fighter**, **Ranger**, and **Cleric** automatically unlock `2_ranger_distant` (Stage 1) and `4_ranger_close` (Stage 2) descriptions for monsters within their respective knowledge domains!
    - Apply Ranger **Wilderness Instinct** detection and ambush-avoidance scaling (`L1`, `L3`, `L7`).

### Stage 7B.4 — Combat Engine Specialization & Signature Abilities (`src/domain/combat/rules.js` & `engine.js`)
- **Objective:** Wire the automatic hidden combat bonuses and level-scaled signature abilities into the combat resolver and narrative log.
- **Files to Modify:**
  - [`src/domain/combat/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js) & [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js):
    - **Fighter:** Apply *Weapon Mastery* (L1–10), *Armor Mastery* AC & DR (L1–10), *Know Your Enemy* offensive/defensive bonuses vs `isFighterMartialTarget`, and scaled *Second Wind* (L3/L7/L10).
    - **Ranger:** Apply scaled *Favored Enemy* (L1–10), *Hunter's Knowledge* vs non-favored natural creatures (L1/L3/L7), scaled *Opening Shot* precision damage (`+1d6` to `+3d6`/`+4d6`) when `DISCOVERED` with a ranged weapon, and *Evasive Retreat* flee bonus & parting-damage reduction (L1/L5/L9).
    - **Cleric:** Apply three-quarter base attack, scaled *Sacred Strike* (L1–10, including incorporeal bypass at L3+), *Turn Undead* combat-start disruption and attack penalty against Undead (L1/L3/L7/L10), and *Holy Protection* AC, DR, and affliction save bonuses against Undead (L1/L5/L9).
  - [`src/domain/combat/narrative.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/narrative.js):
    - Emit the approved atmospheric recognition lines at combat start (*"You recognize the familiar stance..."*, *"Years of hunting this kind of creature..."*, *"Your sacred training reveals the weaknesses..."*) with **zero** numerical formulas.

### Stage 7B.5 — Hidden Mathematics UI Scrub (`action-ui-lab/public/js/character/character-ui.js` & `client-state-service.js`)
- **Objective:** Remove all exposed internal math from player-facing modals, HUD pillars, hand slots, and character creation while keeping HP, XP, gold, potions, and prayer charges crystal clear.
- **Files to Modify:**
  - [`action-ui-lab/server/services/client-state-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/client-state-service.js):
    - Include qualitative attribute tier descriptors, guard/protection descriptor, and descriptive ability summaries in the serialized client state.
  - [`action-ui-lab/public/js/character/character-ui.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/public/js/character/character-ui.js):
    - Replace raw hand-slot math (`Atk +4 • 1d8`, `+1 Shield AC`) with qualitative weapon/guard readiness labels.
    - Replace raw `#hud-ac-val` integer with qualitative Guard/Protection state (or armor readiness badge) while preserving `HP current / max`, `XP`, and `Gold`.
    - Replace raw `STR: 16 (+3)` and raw save/passive formulas in Champion Record (`openCharacterModal`) with qualitative tier titles (*Mighty*, *Tough*, *Devout*) and descriptive training notes.
    - Update `openCreateCharacterModal` to present the **Descriptive Aptitude** selection (*Strong*, *Agile*, *Tough*, *Perceptive*, *Wise*, *Commanding*) and the 7 curated Ranger **Favored Enemy** choices.

### Stage 7B.6 — Automated Test Suite & Thematic Simulation Verification (`tests/`)
- **Objective:** Verify all 10 Phase 7A.2 simulation and integration criteria (`S1–S4` and `H1–H6`) and ensure 100% pass rate across existing and new unit/integration tests.
- **Files to Create/Update:**
  - Add `tests/phase7b_thematic_progression.test.js` testing:
    - Retroactive `CON` Max HP & Current HP invariant across levels, persistence, and reload.
    - 98-monster knowledge classification and `resolveMonsterDescription` routing for Fighter, Ranger, and Cleric.
    - Lethal *Opening Shot* victory, XP, loot, and bounty completion.
    - Out-of-combat *Divine Self-Healing* charge economy and city rest recharge.
    - Hidden Mathematics UI string verification (asserting zero `+X` bonus leaks in `buildClassAbilitySummary`).
    - Thematic simulation runner verifying Criteria 1–10 without any equal-win-rate spread failure gate.
