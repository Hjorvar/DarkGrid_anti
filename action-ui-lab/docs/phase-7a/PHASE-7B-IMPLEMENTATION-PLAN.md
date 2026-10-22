# DARKGRID — PHASE 7B: STEP-BY-STEP IMPLEMENTATION PLAN

## 1. Prerequisites & Phase 6 Revalidation Checklist

Before beginning Phase 7B implementation, the engineering agent **must** verify the final state of Phase 6 (`darkgrid_legacy_integration`) and confirm:
1. [ ] **Worktree & Branch Sync:** Phase 6 is merged or finalized, and a clean Phase 7B branch is created from the post-Phase-6 commit.
2. [ ] **Character Creation Flow in `action-ui-lab/`:** Confirm whether `action-ui-lab` now uses `createCharacter()` (`src/domain/character/rules.js`) instead of `ensureLivingHero()` (`action-ui-lab/server/services/sandbox-db-service.js:206`). If `ensureLivingHero` still exists for sandbox testing, update `CLASS_PRESETS.RANGER.favoredEnemyType` from `'UNDEAD'` (invalid) to `'WILDERNESS_PREDATORS'` and gate `REVIVE` / `LAB_SCENARIO` behind `NODE_ENV !== 'production'`.
3. [ ] **SQLite Trigger Compatibility:** Replace `status = 'SLAIN'` in `action-ui-lab/server/controllers/adventure-scenario-controller.js:264, 347` with `status = 'DEFEATED'` so it complies with `001_initial_schema.sql:86` and `013_production_blaze_hardening.sql:56`.
4. [ ] **Out-of-Combat Potion Consumption:** Ensure `action-ui-lab/server/controllers/character-town-controller.js:186` (`CONSUME_POTION`) delegates directly to `useConsumable()` in `src/domain/character/rules.js:1017`.

---

## 2. Sequenced Engineering Workstreams (Phase 7B)

### Workstream 1: Deterministic Balance Simulator First (TDD for Balance)
- **Files to Create:**
  - `scripts/simulate-balance-v2.js`
  - `tests/simulation/balance-v2.test.js`
- **Tasks:**
  1. Implement the 4 simulation suites defined in [`PHASE-7A-SIMULATION-PLAN.md`](./PHASE-7A-SIMULATION-PLAN.md) (`1v1 Matrix`, `Consecutive Attrition Gauntlet`, `Expedition Pacing`, and `Career 1-to-10 Progression`) against an `:memory:` database.
  2. Run the simulator on the **Baseline (Era 1)** ruleset and save the baseline JSON snapshot to `action-ui-lab/docs/phase-7a/baseline-sim-metrics.json`.

---

### Workstream 2: Character Creation, Attributes & Level-Up Progression V2
- **Files to Modify:**
  - `src/config/index.js`
  - `src/domain/character/rules.js`
  - `src/domain/combat/engine.js` (level-up hook)
- **Tasks:**
  1. Update `src/config/index.js:24-66` to the V2 68-point even base arrays (`FIGHTER: 14/14/10/10/10/10`, `RANGER: 12/12/14/10/10/10`, `CLERIC: 12/12/10/10/14/10`), `startingBonusPoints: 4`, `requiredTotalPoints: 72`, `maxStartingStat: 16`, `startingGold: 25`.
  2. Update `getHpPerLevel` / character creation & level-up HP calculation in `src/domain/character/rules.js:76-83` to include the `+4` Level-1 Vitality Cushion and odd-CON `+2 HP` bonus.
  3. Update `getLevelAttackBonus(level, classType)` (`src/domain/character/rules.js:88-96`) so Fighter and Ranger receive `level` (`+1` at L1 $\to$ `+10` at L10) and Cleric receives `1 + Math.floor((level - 1) * 0.75)` (`+1` at L1 $\to$ `+7` at L10).
  4. Add level-up attribute point progression (`+1` attribute point at Levels 2, 4, 6, 8, 10) or automatic primary/secondary stat milestone grants on level-up in `src/domain/combat/engine.js:659-688`.
  5. Update `FAST_XP_TABLE` (`src/domain/character/rules.js:41-52`) to the V2 10-level XP curve and add level-difference XP decay in `calculateXpWithIntelligence`.

---

### Workstream 3: Class Abilities & Combat Mathematics V2
- **Files to Modify:**
  - `src/domain/character/rules.js`
  - `src/domain/combat/rules.js`
  - `src/domain/combat/engine.js`
  - `src/domain/combat/abilities.js`
  - `src/routes/game.js` & `action-ui-lab/server/controllers/combat-controller.js`
- **Tasks:**
  1. **Fighter V2:**
     - Update `getFighterWeaponTraining` (`character/rules.js:101-106`) to start at Level 3 (`+1/+1` L3–6, `+2/+2` L7–10).
     - Add Fighter Medium/Heavy Armor DR (`DR 1/-` at L4–7, `DR 2/-` at L8–10) in `src/domain/combat/engine.js`.
     - Apply `-2` Attack Penalty when equipping `Tower Shield` in `src/domain/combat/rules.js:82-145`.
  2. **Ranger V2:**
     - Remove the 1-HP clamp on `Opening Shot` in `src/domain/combat/engine.js:238` (`Math.max(0, currentMonsterHp - openingDamage)` for non-Bosses; if `0`, transition immediately to `VICTORY` and award XP/loot).
     - Update Ranger ranged damage scaling in `src/domain/combat/rules.js:173-177` to `Math.floor(dexMod * 0.75) + Math.max(0, Math.floor(strMod * 0.5))`.
     - Allow Ranger to retain `+1` Shield AC from `Buckler` / `Light Wooden Shield` while `isRangedActive === true` in `src/domain/combat/rules.js:33`.
     - Expand `getRangerFavoredEnemyBonus` (`character/rules.js:122-163`) to support the **3 Broad Hunter Doctrines** (`WILDERNESS_PREDATORS`, `WARBANDS_AND_GIANTS`, `ABERRANT_AND_PRIMEVAL`) while maintaining backwards compatibility with legacy creature type strings.
  3. **Cleric V2:**
     - Implement `getClericDivinePowerBonus(level, wisdom)` (`character/rules.js:200-202`) so Clerics gain sacred weapon scaling (`+0/+1` L1–2, `+1/+2/+1 AC` L3–5, `+2/+3/+1 AC` L6–8, `+3/+4/+2 AC` L9–10) against **non-Undead** monsters.
     - Enable `CHANNEL_HEAL` (`performClericSelfHeal`) as an in-combat action in `src/domain/combat/engine.js` (`action === 'CLERIC_HEAL'`) that restores `Nd6 + WIS_mod` HP and purges 1 Poison/Disease/Bleed effect.
  4. **Combat Math & Saves V2:**
     - Implement bounded hero weapon critical hits (`crit_threat` and `crit_mult` with confirmation roll) in `src/domain/combat/rules.js:244-279`.
     - Split `'PHYSICAL'` saving throw calls in `src/domain/combat/abilities.js:75-100` into distinct `'FORT'` and `'REF'` saves, and add the 1-round consecutive Stun/Paralysis immunity guard.

---

### Workstream 4: Monster Re-Tiering, 100% Spawn Reachability & Zone Danger Caps
- **Files to Create / Modify:**
  - `db/migrations/014_phase7b_balance_v2.sql` (or seed `db/seeds/011_balance_v2_monsters_and_items.sql`)
  - `src/domain/encounters/engine.js`
  - `src/domain/monsters/persistence.js`
- **Tasks:**
  1. Map all **12 unreachable monsters** and **The Old Stone Bridge `(8,7)`** (`terrain = 'BRIDGE'`) in `monster_terrains` so all 98 monsters are 100% spawnable across the world map.
  2. Rebalance monster `solo_level` (`1..8`), `base_hp`, `armor_class`, `attack_bonus`, `damage_dice`, `xp_reward`, and explicit `difficulty_tier` (`TRIVIAL`, `STANDARD`, `DANGEROUS`, `ELITE`, `BOSS`), normalizing extreme early outliers (*Duergar*, *Stirge*, *Skeletal Champion*, *Ogre*, *Assassin Vine*, *Minotaur*, *Mummy*).
  3. Update `selectMonsterForTile` (`src/domain/encounters/engine.js:16-86`) to enforce **Concentric Zone Danger Caps** based on tile coordinates / Manhattan distance from Oakhaven `(7,7)`:
     - Zone 1 ($d \le 2$): `solo_level` clamped to `[1, 2]`.
     - Zone 2 ($2 < d \le 4$): `solo_level` clamped to `[1, 4]`.
     - Zone 3 ($4 < d \le 7$): `solo_level` clamped to `[3, 6]`.
     - Zone 4 ($d > 7$ or High-Danger Landmark): `solo_level` clamped to `[5, 8]`.
  4. Update `processHeroDeath` (`src/domain/monsters/persistence.js:55-165`):
     - Cap persistent monster HP boost at **3 stacks (`+30%` max HP)** and partial post-combat heal (`max(current_hp, ceil(0.60 * max_hp))`).
     - If a hero dies on a Sanctuary Gate `(7,6)`/`(7,8)`, Bridge `(8,7)`, or within distance $\le 2$ of Oakhaven `(7,7)`, relocate the persistent `monster_instances` row to a passable wilderness tile at distance $3\text{–}4$ in the same biome so new Level 1 heroes are never roadblocked outside town.

---

### Workstream 5: Equipment, Consumables, Economy & Fresh Start Migration
- **Files to Modify:**
  - `src/domain/character/rules.js` (`useConsumable`, `getEffectiveStats`, `INACTIVE_CONSUMABLE_NAMES`)
  - `src/domain/combat/engine.js` (buff/offensive potions in combat)
  - `src/domain/economy/shop.js`
  - `db/seeds/011_balance_v2_monsters_and_items.sql`
  - `scripts/execute-era2-fresh-start.js`
- **Tasks:**
  1. Add **Masterwork Weapons** (`320 gp`, `+1 Atk`), reprice `+1`/`+2`/`+3` magic gear to match solo progression wealth, give `Boots of Elvenkind` real stats (`+1 DEX_mod` init, `+2` perception, `+10%` flee), and fix `Minor Healing Potion` (`1d6+2`, `25 gp`) vs `Potion of Cure Light Wounds` (`2d6+3`, `50 gp`).
  2. Implement active effects for all 7 potions in `INACTIVE_CONSUMABLE_NAMES` (*Antitoxin*, *Shield of Faith*, *Barkskin*, *Bull's Strength*, *Cat's Grace*, *Heroism*, *Elixir of Dragon's Breath*) and remove them from `INACTIVE_CONSUMABLE_NAMES`.
  3. Exclude common potions from `market_listings` and add a `character.level >= item.min_cr` requirement to buy magic gear from the global resale market (`src/domain/economy/shop.js:116-155`).
  4. Implement `scripts/execute-era2-fresh-start.js` following [`PHASE-7A-FRESH-START-STRATEGY.md`](./PHASE-7A-FRESH-START-STRATEGY.md) with automatic pre-migration SQLite backup and post-migration invariant verification.

---

## 3. Verification & Sign-Off Gates for Phase 7B

1. **Automated Unit & Integration Tests (`npm test`):** All existing and updated domain, route, and `action-ui-lab` tests must pass (`100%` green).
2. **Monte Carlo Simulation Gate (`node scripts/simulate-balance-v2.js`):** Must pass all **8 Quantitative Balance Acceptance Gates (`G1`–`G8`)** defined in [`PHASE-7A-SIMULATION-PLAN.md`](./PHASE-7A-SIMULATION-PLAN.md).
3. **Fresh Start Dry-Run Verification:** Run `scripts/execute-era2-fresh-start.js` against a cloned copy of the database and verify all 7 Fresh Start invariants before touching any live environment.
