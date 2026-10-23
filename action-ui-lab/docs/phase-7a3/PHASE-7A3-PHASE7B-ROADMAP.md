# DARKGRID — PHASE 7A.3: UPDATED PHASE 7B IMPLEMENTATION ROADMAP

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Status:** Authoritative Implementation Plan for Phase 7B (Do Not Execute Until Owner Approves Phase 7A.3)

---

## 1. Pre-Implementation Guardrails

1. **Owner Sign-Off Required First:** Phase 7B coding must **not** begin until the owner reviews the Phase 7A.3 specification and confirms readiness.
2. **Non-Destructive Database Migrations:** All SQLite schema additions (`monster_family` on `monsters` and the new `character_monster_experience` table) must use additive migrations (`db/migrations/009_*.sql`) that preserve existing user accounts, living characters, fallen heroes, and persistent world monsters.
3. **No Artificial Habitat Changes:** Do not alter `001_seed_world.sql` or `monster_terrains` to force the 12 underground/coastal/mountain/desert monsters onto surface tiles.

---

## 2. Six-Stage Phase 7B Implementation Sequence

### Stage 1: Database Schema & `monster_family` Taxonomy (`db/` & `src/config/`)
- **Files to Create / Update:**
  - `db/migrations/009_phase7b_families_and_battle_experience.sql`
  - `src/config/index.js`
- **Tasks:**
  1. Add `monster_family TEXT NOT NULL DEFAULT 'MAGICAL_BEASTS'` to `monsters` and populate all `98` monsters with their exact `monster_family` assignment from [`PHASE-7A3-RANGER-FAMILIES.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-RANGER-FAMILIES.md).
  2. Create `character_monster_experience (character_id, monster_id, victories, first_victory_at, last_victory_at)` with `PRIMARY KEY (character_id, monster_id)`.
  3. Update `src/config/index.js` with `MONSTER_FAMILIES`, `RANGER_FAVORED_ENEMY_FAMILIES` (strictly excluding `UNDEAD`, `CONSTRUCTS`, `OOZES`), and the 72-point creation constants (`TOTAL_POINTS: 72, MIN_SCORE: 8, MAX_SCORE: 18`, plus the validated Fighter/Ranger/Cleric presets).

### Stage 2: Character Creation (72 Points, 8–18), Level-Up above 18 & Retroactive `CON` (`src/domain/character/rules.js`)
- **Files to Update:**
  - [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js)
  - [`action-ui-lab/server/controllers/auth-character-controller.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/controllers/auth-character-controller.js)
- **Tasks:**
  1. Update `validateCharacterCreationInput` to enforce `sum === 72` and `8 <= stat <= 18` for all six attributes (while retaining backward-compatible read support for legacy 71-point characters).
  2. Implement the canonical Max HP function $\text{MaxHP}(L, M_{\text{con}}) = \max(L, H_1 + (L-1)H_{\text{lvl}} + B_{\text{class}}(L) + L \times M_{\text{con}})$ and wire retroactive `CON` adjustment into `spendCharacterAttributePoint` (`auth-character-controller.js:222`), `processLevelUp`, and equipment `CON` changes without granting a free full heal.
  3. Allow Level-Up attribute allocation (`L2, 4, 6, 8, 10`) to raise attributes above `18` (`up to 23 base / 25 equipped`).
  4. Remove the `+10% per +1 INT_mod` multiplier in `calculateXpWithIntelligence` (`rules.js:155`) so `INT` rewards Battle Experience and investigation rather than XP inflation.
  5. Implement `doesMonsterMatchFavoredEnemy(monster, favoredEnemyValue)` with full legacy save support (`'Animal'`, `'Humanoid'`, `'Vermin'`, etc.).

### Stage 3: Combat Rules, Battle Experience, Second Wind Lethal Rescue & Lethal Opening Shot (`src/domain/combat/` & `src/domain/monsters/`)
- **Files to Update:**
  - [`src/domain/combat/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js)
  - [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js)
  - [`src/domain/monsters/persistence.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js)
- **Tasks:**
  1. Implement `getBattleExperienceBonuses({ intScore, wisScore, victories, hasClassSpecialization })` in `src/domain/combat/rules.js` matching the internal table (`0` wins `8–9` penalty with class-spec exemption; `1` win *Recognized*; `3` wins *Experienced*).
  2. Extend `resolveAttackRoll(attackBonus, targetAC, rng, critMinRoll = 20)` to support `19–20` critical threat range at Fighter L7, Ranger Opening Shot L7, and Ranger Favored Enemy L9.
  3. **Fix Ranger Lethal Opening Shot Bug (`src/domain/combat/engine.js:238`):** Replace `Math.max(1, currentMonsterHp - openingDamage)` with `Math.max(0, currentMonsterHp - openingDamage)` and resolve immediate victory via `handleMonsterDefeat` when `currentMonsterHp === 0`.
  4. **Implement Fighter Second Wind & Lethal Rescue (`src/domain/combat/engine.js`):** Add `secondWindUsed: false` to combat session state and execute the 10-step trigger order from [`PHASE-7A3-SECOND-WIND.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-SECOND-WIND.md).
  5. **Record Confirmed Victories (`src/domain/monsters/persistence.js`):** Inside `handleMonsterDefeat`, atomically upsert `character_monster_experience` (`victories = victories + 1`).

### Stage 4: Approved Option A Monster Knowledge & Combat Narrative (`src/domain/encounters/` & `src/domain/combat/narrative.js`)
- **Files to Update:**
  - `src/domain/encounters/knowledge.js` (or `src/domain/encounters/engine.js`)
  - [`src/domain/combat/narrative.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/narrative.js)
- **Tasks:**
  1. Wire automatic Option A class recognition (*Know Your Enemy*, *Natural Knowledge* + *Favored Enemy*, *Undead Knowledge*) and Battle Experience familiarity (*Unfamiliar*, *Recognized*, *Experienced*) into encounter start payloads without adding any new combat buttons.
  2. Emit qualitative English recognition prose (`"You remember how this creature fights."`, `"Years of hunting these creatures give you an instinctive advantage."`, `"You have learned to anticipate its attacks."`).

### Stage 5: UI Alignment — Visible Attribute Allocation + Hidden Combat Math (`action-ui-lab/`)
- **Files to Update:**
  - [`action-ui-lab/server/services/legacy-compatibility-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/legacy-compatibility-service.js)
  - [`action-ui-lab/server/services/client-state-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/client-state-service.js)
  - [`action-ui-lab/public/js/character/character-ui.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/public/js/character/character-ui.js)
- **Tasks:**
  1. Update the Character Creation modal to `72` points, bounds `8–18`, the validated Fighter/Ranger/Cleric presets, and the natural `monster_family` Favored Enemy dropdown.
  2. Keep attribute integers (`8–18+`) and remaining unspent points visible during Character Creation and Level-Up allocation, paired with descriptive tier labels (*Strong*, *Nimble*, *Wise*).
  3. Strip all raw `+X` attack/damage/AC formula strings from `legacy-compatibility-service.js` and `character-ui.js`, while keeping `HP`, `Level`, `XP`, `Gold`, `Potions/Arrows`, `Cleric Prayer Charges (X / Y)`, and `Second Wind (Ready / Spent)` explicitly visible.

### Stage 6: Automated Verification & Phase 7B Simulation Suite (`tests/` & `scripts/`)
- **Files to Create / Update:**
  - `tests/phase7b_families_attributes_battle_exp.test.js`
  - `tests/phase7b_second_wind_and_opening_shot.test.js`
  - `scripts/run_phase7b_simulations.js`
- **Tasks:**
  1. Unit and integration tests covering all 98 `monster_family` mappings, legacy Ranger compatibility, 72-point creation bounds (`8–18`), post-18 level-ups, retroactive `CON` HP, Battle Experience (`0`, `1`, `3` wins, low-stat `8–9` penalties & exemptions, permadeath reset, `FLEE`/`INVESTIGATE` non-increment), Fighter *Second Wind Lethal Rescue* (including crits, `REND`, DoT, `CALCIFY` non-immunity), and Ranger lethal *Opening Shot*.
  2. Execute `scripts/run_phase7b_simulations.js` across the full Phase 7A.3 simulation matrix and verify Gates `C1–C6`.
