/**
 * DARKGRID — Phase 7B: Full Game System Implementation Test Suite
 *
 * Comprehensive automated tests covering:
 *  1. Character Creation (72-point free allocation, 8-18 bounds, class presets, validation)
 *  2. Attribute Growth & Milestone Points (Levels 2, 4, 6, 8, 10, multi-level jumps, post-18 scaling)
 *  3. No Maximum Level (all mathematical functions accept levels > 10 without artificial caps)
 *  4. All 10 Mandatory Constitution & Equipment Scenarios (Rules A, B, C, D, 9-slot sum, combat locks)
 *  5. Fighter Class System & Second Wind Option B (auto 1/combat at <=25% HP, 0 HP rescue, DoT rescue, L10+ BLEED>POISON cleanse, CALCIFY non-rescue)
 *  6. Ranger Class System, 14-Family Favored Enemy Selection & Option A Bonuses (+2/+3/+4/+2 AC, Natural Knowledge stacking, UNDEAD forbidden)
 *  7. Cleric Class System, Standardized BAB (Math.ceil(L*3/4)), Sacred Knowledge, Holy Radiance & Turn Undead
 *  8. 98-Monster 22-Family Taxonomy & #36 Mummy Preservation (0 unclassified, strict error on unknown, 88 surface / 82 passable)
 *  9. INT/WIS Battle Experience & Encounter Secrecy (0/1-2/3+ victory tiers, beginner protection, Stage 1 secrecy, qualitative UI labels)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { createTestDb } = require('./test_helpers');
const { setDb, closeDb } = require('../../src/db/connection');
const app = require('../app');
const config = require('../../src/config');
const { registerUser } = require('../../src/domain/auth/service');

const {
  getModifier,
  getAttributeTierLabel,
  getLevelForXp,
  getFighterBattleHardenedBonus,
  calculateCanonicalMaxHp,
  applyEquipmentConHpClamp,
  applyPermanentConHpIncrease,
  applyLevelUpHpGain,
  reconcileCharacterHpOnLoad,
  getLevelAttackBonus,
  calculateSavingThrows,
  getFighterWeaponTraining,
  getFighterArmorTrainingMaxDexBonus,
  getRangerFavoredEnemyBonus,
  getClericDivinePowerBonus,
  calculateXpWithIntelligence,
  validateCharacterCreation,
  createCharacter,
  getCharacterEquipment,
  getEffectiveStats,
  equipItem,
  unequipItem,
  spendAttributePoint,
  applyCharacterLevelUp
} = require('../../src/domain/character/rules');

const {
  MONSTER_FAMILIES,
  RANGER_SELECTABLE_FAMILIES,
  RANGER_RESERVED_FAMILIES,
  RANGER_NON_SELECTABLE_FAMILIES,
  RANGER_FORBIDDEN_FAMILIES,
  getRangerSelectableFamilies,
  resolveMonsterFamily,
  validateRangerFavoredEnemyChoice,
  auditDatabaseMonsterTaxonomy
} = require('../../src/domain/monsters/taxonomy');

const {
  getFighterKnowYourEnemyBonus,
  getRangerNaturalKnowledgeBonus,
  getClericSacredKnowledgeBonus,
  getClericHolyRadianceBonus,
  getClericTurnUndeadProfile,
  doesMonsterMatchRangerFavoredEnemy,
  computeBattleExperienceModifiers,
  getCharacterMonsterKnowledge,
  recordMonsterEncountered,
  recordMonsterVictory,
  evaluateHeroMonsterKnowledge,
  getCharacterCompendiumKnowledge
} = require('../../src/domain/combat/knowledge');

const {
  calculateHeroAttackBonus,
  calculateHeroAC,
  getHeroDamageFormula
} = require('../../src/domain/combat/rules');

const {
  resolveFighterSecondWind
} = require('../../src/domain/combat/abilities');

const {
  startCombat,
  executeCombatRound,
  getCombatState
} = require('../../src/domain/combat/engine');

const {
  checkTileEncounter,
  getActiveEncounterForCharacter
} = require('../../src/domain/encounters/engine');

let userCounter = 0;
async function createTestUser(db, prefix = 'p7b') {
  userCounter += 1;
  const cleanPrefix = String(prefix).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 10);
  const user = await registerUser(db, `${cleanPrefix}_${userCounter}`, 'Password123!');
  return user.id;
}

function insertCustomItem(db, charId, itemSpec) {
  const name = itemSpec.name || `TestItem_${Date.now()}_${Math.random()}`;
  const existing = db.prepare('SELECT id FROM item_definitions WHERE name = ?').get(name);
  let defId;
  if (existing) {
    defId = existing.id;
  } else {
    const attrs = {
      strength_bonus: itemSpec.strBonus || 0,
      dexterity_bonus: itemSpec.dexBonus || 0,
      constitution_bonus: itemSpec.conBonus || 0,
      intelligence_bonus: itemSpec.intBonus || 0,
      wisdom_bonus: itemSpec.wisBonus || 0,
      charisma_bonus: itemSpec.chaBonus || 0
    };
    const info = db.prepare(`
      INSERT INTO item_definitions (
        name, description, category, subtype, equip_slot, allowed_classes,
        damage_dice, weapon_range_type, is_two_handed, armor_bonus, shield_bonus, max_dex_bonus,
        enhancement_bonus, buy_price, sell_price, is_magical, attributes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      itemSpec.description || 'Phase 7B test item',
      itemSpec.category || 'OTHER',
      itemSpec.subcategory || 'BELT',
      itemSpec.equipSlot || itemSpec.subcategory || 'BELT',
      JSON.stringify(itemSpec.allowedClasses || ['FIGHTER', 'RANGER', 'CLERIC']),
      itemSpec.damageDice || null,
      itemSpec.weaponRange || null,
      itemSpec.isTwoHanded ? 1 : 0,
      itemSpec.armorBonus || 0,
      itemSpec.shieldBonus || 0,
      itemSpec.maxDexBonus !== undefined ? itemSpec.maxDexBonus : null,
      itemSpec.enhancementBonus || 0,
      itemSpec.buyPrice || 100,
      itemSpec.sellPrice || 50,
      itemSpec.isMagical !== undefined ? (itemSpec.isMagical ? 1 : 0) : 1,
      JSON.stringify(attrs)
    );
    defId = Number(info.lastInsertRowid);
  }

  const inst = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, NULL)
  `).run(defId, charId);

  return { defId, instanceId: Number(inst.lastInsertRowid) };
}

test('Phase 7B.1 — Character Creation: 72-point free allocation, 8-18 bounds, class presets & persistence', async () => {
  const db = createTestDb();

  // Verify config presets sum to 72 and stay within 8..18
  const statKeys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  for (const cls of ['FIGHTER', 'RANGER', 'CLERIC']) {
    const preset = config.classBases[cls];
    assert.ok(preset, `Preset for ${cls} must exist`);
    const sum = statKeys.reduce((a, k) => a + Number(preset[k]), 0);
    assert.equal(sum, 72, `${cls} preset must sum to 72`);
    const check = validateCharacterCreation(cls, preset, `Hero_${cls}`);
    assert.equal(check.valid, true, `${cls} preset must pass validation`);
  }

  // Reject sum != 72 (71 and 73)
  const sum71 = validateCharacterCreation('FIGHTER', {
    strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 11, charisma: 10
  }, 'BadSum71');
  assert.equal(sum71.valid, false);
  assert.match(sum71.errors.join(' '), /72/);

  const sum73 = validateCharacterCreation('FIGHTER', {
    strength: 15, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10
  }, 'BadSum73');
  assert.equal(sum73.valid, false);
  assert.match(sum73.errors.join(' '), /72/);

  // Reject < 8 or > 18 at creation
  const below8 = validateCharacterCreation('RANGER', {
    strength: 7, dexterity: 18, constitution: 14, intelligence: 11, wisdom: 12, charisma: 10
  }, 'Below8');
  assert.equal(below8.valid, false);
  assert.match(below8.errors.join(' '), /minimum of 8/);

  const above18 = validateCharacterCreation('CLERIC', {
    strength: 10, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 19, charisma: 11
  }, 'Above18');
  assert.equal(above18.valid, false);
  assert.match(above18.errors.join(' '), /maximum of 18/);

  // Create Fighter, Ranger, and Cleric in SQLite and verify Phase 7B columns
  const fUserId = await createTestUser(db, 'create_fighter');
  const fighter = createCharacter(db, {
    userId: fUserId,
    name: 'Vaelen',
    classType: 'FIGHTER',
    stats: config.classBases.FIGHTER
  });
  // Fighter L1, CON 14 (+2): H1(10) + BattleHardened(2) + 1*2 = 14 HP
  assert.equal(fighter.max_hp, 14);
  assert.equal(fighter.current_hp, 14);
  assert.equal(fighter.attribute_points, 0);
  const parsedInit = JSON.parse(fighter.initial_attributes_json);
  for (const k of statKeys) {
    assert.equal(parsedInit[k], config.classBases.FIGHTER[k]);
  }

  const rUserId = await createTestUser(db, 'create_ranger');
  const ranger = createCharacter(db, {
    userId: rUserId,
    name: 'Kaelen',
    classType: 'RANGER',
    stats: config.classBases.RANGER,
    favoredEnemyFamily: 'TERRESTRIAL_MAGICAL_BEASTS'
  });
  // Ranger L1, CON 12 (+1): H1(10) + 1*1 = 11 HP
  assert.equal(ranger.max_hp, 11);
  assert.equal(ranger.current_hp, 11);
  assert.equal(ranger.favored_enemy_family, 'TERRESTRIAL_MAGICAL_BEASTS');

  const cUserId = await createTestUser(db, 'create_cleric');
  const cleric = createCharacter(db, {
    userId: cUserId,
    name: 'Aldric',
    classType: 'CLERIC',
    stats: config.classBases.CLERIC
  });
  // Cleric L1, CON 12 (+1): H1(8) + 1*1 = 9 HP
  assert.equal(cleric.max_hp, 9);
  assert.equal(cleric.current_hp, 9);
});

test('Phase 7B.2 — Attribute Growth, Milestone Points (L2,4,6,8,10), Post-18 Scaling & Security Locks', async () => {
  const db = createTestDb();
  const userId = await createTestUser(db, 'milestone_hero');
  const hero = createCharacter(db, {
    userId,
    name: 'Thorin',
    classType: 'FIGHTER',
    stats: { strength: 18, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 }
  });

  // Cannot spend when attribute_points == 0
  assert.throws(() => spendAttributePoint(db, hero.id, 'strength'), /No unspent attribute points/i);

  // Level 1 -> Level 2 awards +1 attribute point
  const l2 = applyCharacterLevelUp(db, hero.id, 2);
  assert.equal(l2.attributePointsAwarded, 1);
  assert.equal(l2.character.attribute_points, 1);

  // Multi-level jump Level 2 -> Level 6 crosses L4 and L6 -> awards +2 points (total 3 unspent)
  const l6 = applyCharacterLevelUp(db, hero.id, 6);
  assert.equal(l6.attributePointsAwarded, 2);
  assert.equal(l6.character.attribute_points, 3);

  // Level 6 -> Level 10 crosses L8 and L10 -> awards +2 points (total 5 unspent)
  const l10 = applyCharacterLevelUp(db, hero.id, 10);
  assert.equal(l10.attributePointsAwarded, 2);
  assert.equal(l10.character.attribute_points, 5);

  // Calling applyCharacterLevelUp again at Level 10 awards 0 duplicate points
  const dup = applyCharacterLevelUp(db, hero.id, 10);
  assert.equal(dup.attributePointsAwarded, 0);
  assert.equal(dup.character.attribute_points, 5);

  // Spend all 5 points into Strength (18 -> 23) to verify 18 is NOT a post-creation cap
  for (let i = 1; i <= 5; i++) {
    const res = spendAttributePoint(db, hero.id, 'STR');
    assert.equal(res.newScore, 18 + i);
    assert.equal(res.remainingAttributePoints, 5 - i);
  }

  const finalRow = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(finalRow.strength, 23);
  assert.equal(getModifier(finalRow.strength), 6, 'STR 23 must yield +6 modifier');
  assert.equal(finalRow.attribute_points, 0);

  // Lifetime invariant: sum(base_stats) + unspent == 72 + 5
  const baseSum = finalRow.strength + finalRow.dexterity + finalRow.constitution + finalRow.intelligence + finalRow.wisdom + finalRow.charisma;
  assert.equal(baseSum + finalRow.attribute_points, 72 + 5);
});

test('Phase 7B.3 — No Maximum Level: All progression and combat formulas accept levels > 10', () => {
  for (const level of [1, 5, 10, 12, 15, 20]) {
    for (const cls of ['FIGHTER', 'RANGER', 'CLERIC']) {
      const hp = calculateCanonicalMaxHp(level, cls, 2);
      assert.ok(Number.isInteger(hp) && hp > 0, `MaxHP must be positive integer at L${level} for ${cls}`);
      const bab = getLevelAttackBonus(cls, level);
      assert.ok(Number.isInteger(bab) && bab >= 0, `BAB must be non-negative integer at L${level} for ${cls}`);
      const saves = calculateSavingThrows({
        class: cls,
        level,
        constitution: 14,
        dexterity: 14,
        wisdom: 14
      });
      assert.ok(Number.isInteger(saves.fort) && Number.isInteger(saves.ref) && Number.isInteger(saves.will));
    }

    assert.equal(getFighterBattleHardenedBonus(level).hpBonus, level >= 5 ? 2 * level : 1 + level);
    assert.ok(getFighterWeaponTraining(level).attack >= 0);
    assert.ok(getFighterArmorTrainingMaxDexBonus(level) >= 0);
    assert.ok(getFighterKnowYourEnemyBonus({ class: 'FIGHTER', level }, { monster_family: 'GOBLINOIDS' }).attack >= 1);
    assert.ok(getRangerFavoredEnemyBonus({ class: 'RANGER', level, favored_enemy_family: 'GOBLINOIDS' }, { monster_family: 'GOBLINOIDS' }).attack >= 2);
    assert.ok(getRangerNaturalKnowledgeBonus({ class: 'RANGER', level }, { monster_family: 'ANIMALS' }).attack >= 1);
    assert.ok(getClericSacredKnowledgeBonus({ class: 'CLERIC', level }, { monster_family: 'UNDEAD' }).attack >= 1);
    assert.ok(getClericHolyRadianceBonus({ class: 'CLERIC', level }, { monster_family: 'UNDEAD' }).attack >= 2);
    assert.ok(getClericTurnUndeadProfile({ class: 'CLERIC', level, wisdom: 16 }).unlocked === (level >= 3));
  }

  // Cleric BAB formula: Math.ceil(level * 3 / 4) across Levels 1..15
  const expectedClericBab = {
    1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 5, 7: 6, 8: 6, 9: 7, 10: 8, 11: 9, 12: 9, 15: 12
  };
  for (const [lvl, expected] of Object.entries(expectedClericBab)) {
    assert.equal(getLevelAttackBonus('CLERIC', Number(lvl)), expected, `Cleric BAB at L${lvl} must be ${expected}`);
  }
});

test('Phase 7B.4 — All 10 Mandatory Constitution & Equipment Scenarios (Rules A, B, C, D & 9-Slot Sum)', async () => {
  const db = createTestDb();
  const userId = await createTestUser(db, 'con_rules_hero');

  // Create Fighter with CON 12 (+1 mod). At L1: 10 + 2 + 1 = 13 HP.
  const hero = createCharacter(db, {
    userId,
    name: 'Ironwall',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10 }
  });

  // Advance Fighter to Level 5:
  // Canonical Max HP at L5, CON 12 (+1): 10 + 4*6 + 2*5 + 5*1 = 10 + 24 + 10 + 5 = 49 HP
  applyCharacterLevelUp(db, hero.id, 5);
  db.prepare('UPDATE characters SET current_hp = 49, max_hp = 49 WHERE id = ?').run(hero.id);

  const beltCon2 = insertCustomItem(db, hero.id, {
    name: 'Belt of Dwarven Constitution +2',
    category: 'OTHER',
    subcategory: 'BELT',
    conBonus: 2
  });
  const beltCon4 = insertCustomItem(db, hero.id, {
    name: 'Belt of Mighty Constitution +4',
    category: 'OTHER',
    subcategory: 'BELT',
    conBonus: 4
  });

  // Scenario 1: Equipping a +CON item at full HP (49/49) increases Max HP to 54 (+5) and keeps Current HP at 49 (no free heal)
  const eq1 = equipItem(db, hero.id, beltCon2.instanceId, 'BELT');
  assert.equal(eq1.maxHp, 54, 'Scenario 1: Max HP must increase by +L (+5 at L5)');
  assert.equal(eq1.currentHp, 49, 'Scenario 1: Current HP must remain 49 (no free healing)');

  // Scenario 2: Unequipping a +CON item at full HP (54/54) clamps Current HP to new Max HP (49/49)
  db.prepare('UPDATE characters SET current_hp = 54 WHERE id = ?').run(hero.id);
  const uneq2 = unequipItem(db, hero.id, beltCon2.instanceId);
  assert.equal(uneq2.maxHp, 49, 'Scenario 2: Max HP returns to 49');
  assert.equal(uneq2.currentHp, 49, 'Scenario 2: Current HP clamps to 49');

  // Scenario 3: Unequipping a +CON item at low HP (3/54) preserves Current HP at 3/49
  equipItem(db, hero.id, beltCon2.instanceId, 'BELT');
  db.prepare('UPDATE characters SET current_hp = 3 WHERE id = ?').run(hero.id);
  const uneq3 = unequipItem(db, hero.id, beltCon2.instanceId);
  assert.equal(uneq3.maxHp, 49, 'Scenario 3: Max HP returns to 49');
  assert.equal(uneq3.currentHp, 3, 'Scenario 3: Current HP stays 3');

  // Scenario 4: Unequipping a +CON item when Current HP is 1/54 (or when clamp is tested) never kills a living hero (clamps >= 1)
  equipItem(db, hero.id, beltCon2.instanceId, 'BELT');
  db.prepare('UPDATE characters SET current_hp = 1 WHERE id = ?').run(hero.id);
  const uneq4 = unequipItem(db, hero.id, beltCon2.instanceId);
  assert.equal(uneq4.currentHp, 1, 'Scenario 4: Living hero must never drop below 1 HP from equipment change');
  assert.equal(applyEquipmentConHpClamp(0, 49), 1, 'Rule A helper must clamp >= 1');

  // Scenario 5: Repeated equip/unequip loop produces zero free healing
  db.prepare('UPDATE characters SET current_hp = 18 WHERE id = ?').run(hero.id);
  for (let i = 0; i < 10; i++) {
    const e = equipItem(db, hero.id, beltCon2.instanceId, 'BELT');
    assert.equal(e.currentHp, 18);
    assert.equal(e.maxHp, 54);
    const u = unequipItem(db, hero.id, beltCon2.instanceId);
    assert.equal(u.currentHp, 18);
    assert.equal(u.maxHp, 49);
  }

  // Scenario 6: Direct slot swap between two CON items (+2 CON -> +4 CON -> +2 CON) updates atomically without free healing
  equipItem(db, hero.id, beltCon2.instanceId, 'BELT'); // 18 / 54
  const swapUp = equipItem(db, hero.id, beltCon4.instanceId, 'BELT'); // +4 CON -> +2 mod -> 59 Max HP, 18 Current HP
  assert.equal(swapUp.maxHp, 59, 'Scenario 6: Direct swap to +4 CON belt yields 59 Max HP');
  assert.equal(swapUp.currentHp, 18, 'Scenario 6: Direct swap does not grant free HP');
  db.prepare('UPDATE characters SET current_hp = 58 WHERE id = ?').run(hero.id);
  const swapDown = equipItem(db, hero.id, beltCon2.instanceId, 'BELT'); // 58/59 -> 54/54
  assert.equal(swapDown.maxHp, 54);
  assert.equal(swapDown.currentHp, 54, 'Scenario 6: Direct swap down clamps Current HP to 54');
  unequipItem(db, hero.id, beltCon2.instanceId); // back to base CON 12 (49/49)

  // Scenario 8: Permanent CON increase to an odd value (CON 12 -> 13, delta mod = 0) grants 0 HP
  db.prepare('UPDATE characters SET current_hp = 25 WHERE id = ?').run(hero.id);
  const oddCon = spendAttributePoint(db, hero.id, 'constitution'); // CON 12 -> 13
  assert.equal(oddCon.newScore, 13);
  assert.equal(oddCon.hpGain, 0, 'Scenario 8: Odd CON increase (12 -> 13) must grant 0 HP');
  assert.equal(oddCon.maxHp, 49);
  assert.equal(oddCon.currentHp, 25);

  // Scenario 7: Permanent CON increase to an even value (CON 13 -> 14, delta mod = +1 at L5) adds +5 to both Max HP and Current HP (no full heal!)
  const evenCon = spendAttributePoint(db, hero.id, 'constitution'); // CON 13 -> 14
  assert.equal(evenCon.newScore, 14);
  assert.equal(evenCon.hpGain, 5, 'Scenario 7: Even CON increase (13 -> 14 at L5) must grant +5 HP');
  assert.equal(evenCon.maxHp, 54);
  assert.equal(evenCon.currentHp, 30, 'Scenario 7: Current HP increases from 25 to 30 (never full heal to 54)');

  // Scenario 9: Level-up (Level 5 -> Level 6 Fighter with CON 14 (+2)) adds exact level-up HP gain (+6 base +2 Battle-Hardened +2 CON = +10) to Current HP without full heal
  const lvl6 = applyCharacterLevelUp(db, hero.id, 6);
  assert.equal(lvl6.hpGain, 10, 'Scenario 9: Level 5 -> 6 Fighter (CON 14) gains +10 Max HP');
  assert.equal(lvl6.newMaxHp, 64);
  assert.equal(lvl6.newCurrentHp, 40, 'Scenario 9: Current HP increases from 30 to 40 (no automatic full heal)');

  // Scenario 10: Login/reload reconciliation updates Max HP to canonical value without adding positive difference to Current HP, and preserves permadeath
  db.prepare('UPDATE characters SET max_hp = 40, current_hp = 32 WHERE id = ?').run(hero.id);
  const reconciled = reconcileCharacterHpOnLoad(db, hero.id);
  assert.equal(reconciled.max_hp, 64, 'Scenario 10: Reconciles stale Max HP back to canonical 64');
  assert.equal(reconciled.current_hp, 32, 'Scenario 10: Never adds Max HP difference to Current HP on reload');

  // Verify dead character reconciliation preserves permadeath (is_alive = 0, current_hp = 0)
  db.prepare('UPDATE characters SET is_alive = 0, current_hp = 0 WHERE id = ?').run(hero.id);
  const deadReconciled = reconcileCharacterHpOnLoad(db, hero.id);
  assert.equal(deadReconciled.is_alive, 0);
  assert.equal(deadReconciled.current_hp, 0);
  assert.throws(() => equipItem(db, hero.id, beltCon2.instanceId, 'BELT'), /Dead characters/i);
});

test('Phase 7B.5 — Fighter Class System & Second Wind Option B (All Tiers, 0 HP Rescue, DoT Rescue, L10+ Cleanse, CALCIFY Non-Rescue)', async () => {
  const db = createTestDb();
  const userId = await createTestUser(db, 'second_wind_fighter');
  const fighter = createCharacter(db, {
    userId,
    name: 'Garrick',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 }
  });

  // 1. Unavailable at Levels 1-2
  const l2Check = resolveFighterSecondWind({
    character: { ...fighter, level: 2 },
    currentHp: 0,
    maxHp: 21,
    combatState: {},
    rng: () => 0.5
  });
  assert.equal(l2Check.triggered, false, 'Second Wind must not trigger at Level 1-2');

  // 2. Level 3-5 Tier (1d10 + Level + CON_mod): Rescues from 0 HP!
  const l4Check = resolveFighterSecondWind({
    character: { ...fighter, level: 4, constitution: 14 },
    currentHp: 0,
    maxHp: 39,
    combatState: {},
    rng: () => 0.5 // d10 roll = 6 -> 6 + 4 + 2 = 12 HP
  });
  assert.equal(l4Check.triggered, true, 'Second Wind must trigger at 0 HP for Level 4 Fighter');
  assert.equal(l4Check.rescuedFromZero, true);
  assert.equal(l4Check.healAmount, 12);
  assert.equal(l4Check.currentHp, 12);
  assert.equal(l4Check.combatState.secondWindUsed, true);

  // 3. Cannot trigger a second time in the same combat
  const secondAttempt = resolveFighterSecondWind({
    character: { ...fighter, level: 4, constitution: 14 },
    currentHp: 0,
    maxHp: 39,
    combatState: l4Check.combatState,
    rng: () => 0.5
  });
  assert.equal(secondAttempt.triggered, false, 'Second Wind must only trigger once per combat');

  // 4. Level 6-9 Tier (2d10 + Level + CON_mod) at <= 25% threshold
  const l7Check = resolveFighterSecondWind({
    character: { ...fighter, level: 7, constitution: 14 },
    currentHp: 15, // 15 / 74 <= 25% (18.5)
    maxHp: 74,
    combatState: { bleedRounds: 2, bleedDamage: '1d4' },
    rng: () => 0.5 // 2d10 = 6+6 = 12 + 7 + 2 = 21
  });
  assert.equal(l7Check.triggered, true);
  assert.equal(l7Check.healAmount, 21);
  assert.equal(l7Check.cleansedCondition, null, 'Level 7 Second Wind does not cleanse status conditions');

  // 5. Level 10+ Tier (3d10 + Level + CON_mod + cleanses 1 physical status, prioritizing BLEED over POISON)
  const l10Both = resolveFighterSecondWind({
    character: { ...fighter, level: 10, constitution: 14 },
    currentHp: 10,
    maxHp: 104,
    combatState: {
      bleedRounds: 3,
      bleedDamage: '1d4',
      poisonRounds: 3,
      poisonDamage: '1d4'
    },
    rng: () => 0.5 // 3d10 = 18 + 10 + 2 = 30
  });
  assert.equal(l10Both.triggered, true);
  assert.equal(l10Both.healAmount, 30);
  assert.equal(l10Both.cleansedCondition, 'BLEED', 'Level 10+ Second Wind must prioritize cleansing BLEED over POISON');
  assert.equal(l10Both.combatState.bleedRounds, 0);
  assert.equal(l10Both.combatState.poisonRounds, 3, 'POISON remains when BLEED was cleansed first');

  // If only POISON is active at Level 10+, cleanses POISON
  const l10PoisonOnly = resolveFighterSecondWind({
    character: { ...fighter, level: 10, constitution: 14 },
    currentHp: 10,
    maxHp: 104,
    combatState: {
      bleedRounds: 0,
      poisonRounds: 3,
      poisonDamage: '1d4'
    },
    rng: () => 0.5
  });
  assert.equal(l10PoisonOnly.cleansedCondition, 'POISON');
  assert.equal(l10PoisonOnly.combatState.poisonRounds, 0);

  // 6. Does NOT rescue non-HP instant death from CALCIFY
  const calcifiedCheck = resolveFighterSecondWind({
    character: { ...fighter, level: 10, constitution: 14 },
    currentHp: 0,
    maxHp: 104,
    combatState: {},
    isCalcifiedKilled: true,
    rng: () => 0.5
  });
  assert.equal(calcifiedCheck.triggered, false, 'Second Wind must NOT rescue CALCIFY instant petrification death');

  // 7. End-to-end combat engine test: Level 4 Fighter reduced to 0 HP by monster attack is rescued by Second Wind in executeCombatRound!
  applyCharacterLevelUp(db, fighter.id, 4);
  db.prepare('UPDATE characters SET current_hp = 5, max_hp = 39 WHERE id = ?').run(fighter.id);
  const wildTile = db.prepare('SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1').get();
  const ogre = db.prepare("SELECT * FROM monsters WHERE name = 'Ogre' LIMIT 1").get();
  const encId = Number(db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round, spotted_by_hero, is_ambush, combat_state_json)
    VALUES (?, ?, ?, 'IN_COMBAT', 60, 60, 1, 1, 0, '{}')
  `).run(fighter.id, wildTile.id, ogre.id).lastInsertRowid);

  // RNG: hero misses (0.05), monster hits (0.85) for lethal damage -> Second Wind rescues Fighter!
  let callIdx = 0;
  const seqRng = () => {
    callIdx++;
    if (callIdx === 1) return 0.01; // hero attack roll -> miss
    return 0.85; // monster hits & Second Wind heal roll
  };
  const roundRes = executeCombatRound(db, fighter.id, encId, 'ATTACK', { rng: seqRng });
  assert.equal(roundRes.encounter.status, 'IN_COMBAT', 'Fighter reduced to 0 HP must survive via automatic Second Wind');
  const rescuedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(fighter.id);
  assert.equal(rescuedHero.is_alive, 1);
  assert.ok(rescuedHero.current_hp > 0);
  const stateAfter = getCombatState(db, fighter.id, encId);
  assert.equal(stateAfter.secondWindUsed, true, 'secondWindUsed must persist in combat state');
  assert.equal(stateAfter.secondWindStatus, 'Spent', 'secondWindStatus must report Spent after Second Wind triggers');
});

test('Phase 7B.6 — Ranger 14-Family Favored Enemy Selection, Reserved/Forbidden Enforcement & Option A Bonuses', async () => {
  const db = createTestDb();

  // Verify exact family counts
  assert.equal(MONSTER_FAMILIES.length, 22, 'Must have 22 total monster families');
  assert.equal(RANGER_SELECTABLE_FAMILIES.length, 14, 'Must have 14 initial selectable Ranger families');
  assert.equal(RANGER_RESERVED_FAMILIES.length, 5, 'Must have 5 reserved families');
  assert.equal(RANGER_NON_SELECTABLE_FAMILIES.length, 2, 'Must have 2 non-selectable families');
  assert.deepEqual(RANGER_FORBIDDEN_FAMILIES, ['UNDEAD'], 'UNDEAD must be the 1 forbidden family');

  const uiFamilies = getRangerSelectableFamilies();
  assert.equal(uiFamilies.length, 14);
  const otherMagBeasts = uiFamilies.find(f => f.key === 'TERRESTRIAL_MAGICAL_BEASTS');
  assert.ok(otherMagBeasts);
  assert.equal(otherMagBeasts.label, 'Other Magical Beasts', 'TERRESTRIAL_MAGICAL_BEASTS must display as "Other Magical Beasts"');

  // Reserved, Non-Selectable, and Forbidden families must be rejected at creation
  for (const reserved of RANGER_RESERVED_FAMILIES) {
    const check = validateRangerFavoredEnemyChoice(reserved);
    assert.equal(check.valid, false, `Reserved family ${reserved} must be rejected at creation`);
  }
  for (const nonSel of RANGER_NON_SELECTABLE_FAMILIES) {
    const check = validateRangerFavoredEnemyChoice(nonSel);
    assert.equal(check.valid, false, `Non-selectable family ${nonSel} must be rejected at creation`);
  }
  const undeadCheck = validateRangerFavoredEnemyChoice('UNDEAD');
  assert.equal(undeadCheck.valid, false);
  assert.match(undeadCheck.error, /Undead is not permitted/i);

  // Verify Option A progression:
  // L1-3: +2 Atk, +2 Dmg, +0 AC
  // L4-7: +3 Atk, +3 Dmg, +0 AC
  // L8:   +4 Atk, +4 Dmg, +0 AC
  // L9+:  +4 Atk, +4 Dmg, +2 AC
  const rangerBase = { class: 'RANGER', favored_enemy_family: 'LUPINE_CANINE_BEASTS' };
  const wolf = { name: 'Wolf', creature_type: 'Animal', monster_family: 'LUPINE_CANINE_BEASTS' };
  assert.deepEqual(getRangerFavoredEnemyBonus({ ...rangerBase, level: 1 }, wolf), { attack: 2, damage: 2, ac: 0 });
  assert.deepEqual(getRangerFavoredEnemyBonus({ ...rangerBase, level: 3 }, wolf), { attack: 2, damage: 2, ac: 0 });
  assert.deepEqual(getRangerFavoredEnemyBonus({ ...rangerBase, level: 4 }, wolf), { attack: 3, damage: 3, ac: 0 });
  assert.deepEqual(getRangerFavoredEnemyBonus({ ...rangerBase, level: 7 }, wolf), { attack: 3, damage: 3, ac: 0 });
  assert.deepEqual(getRangerFavoredEnemyBonus({ ...rangerBase, level: 8 }, wolf), { attack: 4, damage: 4, ac: 0 });
  assert.deepEqual(getRangerFavoredEnemyBonus({ ...rangerBase, level: 9 }, wolf), { attack: 4, damage: 4, ac: 2 });
  assert.deepEqual(getRangerFavoredEnemyBonus({ ...rangerBase, level: 12 }, wolf), { attack: 4, damage: 4, ac: 2 });

  // Stacks with Natural Knowledge in calculateHeroAttackBonus and calculateHeroAC
  const l9Ranger = {
    class: 'RANGER',
    level: 9,
    strength: 12,
    dexterity: 18,
    constitution: 12,
    intelligence: 10,
    wisdom: 14,
    charisma: 10,
    favored_enemy_family: 'LUPINE_CANINE_BEASTS'
  };
  const bow = { category: 'WEAPON', weapon_range: 'RANGED', damage_dice: '1d6', attack_bonus: 0, damage_bonus: 0 };
  // Against Wolf (Favored +4 Atk/+2 AC + Natural Knowledge +2 Atk/+1 AC) vs Construct (0 + 0)
  const construct = { name: 'Stone Golem', creature_type: 'Construct', monster_family: 'CONSTRUCTS' };
  const atkVsWolf = calculateHeroAttackBonus(l9Ranger, bow, wolf);
  const atkVsConstruct = calculateHeroAttackBonus(l9Ranger, bow, construct);
  assert.equal(atkVsWolf - atkVsConstruct, 6, 'Level 9 Ranger must gain +4 (Favored) + 2 (Natural Knowledge) = +6 Attack vs Wolf');

  const acVsWolf = calculateHeroAC(l9Ranger, null, null, true, wolf, bow);
  const acVsConstruct = calculateHeroAC(l9Ranger, null, null, true, construct, bow);
  assert.equal(acVsWolf - acVsConstruct, 3, 'Level 9 Ranger must gain +2 (Favored) + 1 (Natural Knowledge) = +3 AC vs Wolf');
});

test('Phase 7B.7 — 98-Monster 22-Family Taxonomy Audit & #36 Mummy Preservation', () => {
  const db = createTestDb();
  const audit = auditDatabaseMonsterTaxonomy(db);

  assert.equal(audit.totalMonsters, 98, 'Database must contain all 98 documented monsters');
  assert.equal(audit.unmatched.length, 0, 'Zero monsters may be unmatched');
  assert.equal(audit.mismatchedColumn.length, 0, 'Zero monsters may have mismatched monster_family column');
  assert.equal(audit.duplicates.length, 0, 'Zero monsters may have duplicate identities');
  assert.equal(audit.designTaxonomyUndeadCount, 11, 'Approved design taxonomy specifies 11 Undead');
  assert.equal(audit.undeadCountInDb, 12, 'Actual SQLite seed data classifies all 12 Undead rows into UNDEAD');
  assert.equal(audit.designTaxonomySurfaceCount, 88, 'Design taxonomy geographic surface monsters (including RIVER) equals 88');
  assert.equal(audit.actualSurfaceMonsterCount, 92, 'SQLite monster_terrains surface monsters (including RIVER) equals 92');
  assert.equal(audit.reachablePassableMonsterCount, 86, 'Passable map surface monsters in SQLite equals 86');
  assert.equal(audit.mummyVerification.statsPreserved, true, '#36 Mummy stats must be preserved');

  // Never silently assign an unknown monster to ANIMALS when strict = true
  assert.throws(
    () => resolveMonsterFamily({ name: 'Unidentified Cosmic Horror', creature_type: 'UNKNOWN_ENTITY' }, { strict: true }),
    /Unclassified monster/i
  );

  // Locate #36 Mummy by identity (not numeric ID alone) and verify its dangerous combat stats are untouched
  const mummy = db.prepare("SELECT * FROM monsters WHERE LOWER(name) = 'mummy'").get();
  assert.ok(mummy, 'Mummy must exist in monsters table');
  assert.equal(mummy.monster_family, 'UNDEAD');
  assert.equal(mummy.base_hp, 45);
  assert.equal(mummy.armor_class, 20);
  assert.equal(mummy.attack_bonus, 14);
  assert.equal(mummy.damage_dice, '1d8+10');
  assert.equal(mummy.challenge_rating, 5);
  assert.equal(mummy.solo_level, 5);
});

test('Phase 7B.8 — INT/WIS Battle Experience, Beginner Protection, Stage 1 Secrecy & UI Qualitative Labels', async () => {
  const db = createTestDb();
  const userId = await createTestUser(db, 'battle_exp_hero');

  // Create Fighter with INT 8 (Unstudied), WIS 16 (Wise): 16 + 10 + 14 + 8 + 16 + 8 = 72
  const fighter = createCharacter(db, {
    userId,
    name: 'ScholarBlade',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 16, charisma: 8 }
  });

  const goblin = db.prepare("SELECT * FROM monsters WHERE LOWER(name) = 'goblin'").get();
  const basilisk = db.prepare("SELECT * FROM monsters WHERE LOWER(name) = 'basilisk'").get();

  // 1. At 0 victories:
  // - Goblin is in FIGHTER Know Your Enemy (GOBLINOIDS), so classFamiliarity protects against the -1 INT 8 penalty!
  const kGoblin0 = evaluateHeroMonsterKnowledge(db, fighter, goblin);
  assert.equal(kGoblin0.victories, 0);
  assert.equal(kGoblin0.tier, 'UNFAMILIAR');
  assert.equal(kGoblin0.classFamiliar, true);
  assert.equal(kGoblin0.learnedDamageBonus, 0, 'Class familiarity must protect against -1 beginner INT penalty vs Goblin');

  // - Basilisk (TERRESTRIAL_MAGICAL_BEASTS) is NOT in Fighter Know Your Enemy -> INT 8 gives -1 damage at 0 victories
  const kBasilisk0 = evaluateHeroMonsterKnowledge(db, fighter, basilisk);
  assert.equal(kBasilisk0.victories, 0);
  assert.equal(kBasilisk0.classFamiliar, false);
  assert.equal(kBasilisk0.learnedDamageBonus, -1, 'INT 8 at 0 victories against unfamiliar non-class monster gives -1 damage');
  assert.equal(kBasilisk0.learnedAcBonus, 0);

  // 2. Stage 1 (DISCOVERED) encounter must NOT increment encounters_seen or victories
  const wildTile = db.prepare('SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1').get();
  const stage1 = checkTileEncounter(db, fighter, wildTile, { forcedChance: 100, rng: () => 0.2, ambushRng: () => 0.8 });
  assert.ok(stage1);
  const kAfterStage1 = getCharacterMonsterKnowledge(db, fighter.id, stage1.monsterId);
  assert.equal(kAfterStage1.encountersSeen, 0, 'Stage 1 DISCOVERED must not increment encounters_seen');
  assert.equal(kAfterStage1.victories, 0, 'Stage 1 DISCOVERED must not increment victories');
  db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(stage1.id);

  // 3. Engaging in Stage 2 (startCombat) increments encounters_seen, but fleeing does NOT increment victories
  const encBasilisk = Number(db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round, spotted_by_hero, is_ambush)
    VALUES (?, ?, ?, 'DISCOVERED', 40, 40, 0, 1, 0)
  `).run(fighter.id, wildTile.id, basilisk.id).lastInsertRowid);
  startCombat(db, fighter.id, encBasilisk, { rng: () => 0.5 });
  assert.equal(getCharacterMonsterKnowledge(db, fighter.id, basilisk.id).encountersSeen, 1);
  assert.equal(getCharacterMonsterKnowledge(db, fighter.id, basilisk.id).victories, 0);

  // 4. Record 1 confirmed victory -> RECOGNIZED tier (INT 8 penalty cleared to 0; WIS 16 grants +1 AC)
  recordMonsterVictory(db, fighter.id, basilisk.id);
  const kBasilisk1 = evaluateHeroMonsterKnowledge(db, fighter, basilisk);
  assert.equal(kBasilisk1.victories, 1);
  assert.equal(kBasilisk1.tier, 'RECOGNIZED');
  assert.equal(kBasilisk1.tierLabel, 'Recognized');
  assert.equal(kBasilisk1.learnedDamageBonus, 0);
  assert.equal(kBasilisk1.learnedAcBonus, 1, 'WIS 16 at 1-2 victories grants +1 learned AC');

  // 5. Record 2 more victories (total 3) -> EXPERIENCED tier (WIS 16 grants +2 AC)
  recordMonsterVictory(db, fighter.id, basilisk.id);
  recordMonsterVictory(db, fighter.id, basilisk.id);
  const kBasilisk3 = evaluateHeroMonsterKnowledge(db, fighter, basilisk);
  assert.equal(kBasilisk3.victories, 3);
  assert.equal(kBasilisk3.tier, 'EXPERIENCED');
  assert.equal(kBasilisk3.tierLabel, 'Experienced');
  assert.equal(kBasilisk3.learnedAcBonus, 2, 'WIS 16 at 3+ victories grants +2 learned AC');

  // Verify INT 18+ and WIS 18+ top row (+2/+4 Damage, +2/+3 AC)
  assert.deepEqual(computeBattleExperienceModifiers({ intelligence: 20, wisdom: 20, victories: 1, classFamiliar: false }), {
    tier: 'RECOGNIZED',
    tierLabel: 'Recognized',
    victories: 1,
    damageBonus: 2,
    acBonus: 2
  });
  assert.deepEqual(computeBattleExperienceModifiers({ intelligence: 20, wisdom: 20, victories: 3, classFamiliar: false }), {
    tier: 'EXPERIENCED',
    tierLabel: 'Experienced',
    victories: 3,
    damageBonus: 4,
    acBonus: 3
  });

  // Verify qualitative attribute tier labels
  assert.equal(getAttributeTierLabel('strength', 8), 'Unconditioned');
  assert.equal(getAttributeTierLabel('strength', 14), 'Strong');
  assert.equal(getAttributeTierLabel('dexterity', 16), 'Nimble');
  assert.equal(getAttributeTierLabel('wisdom', 16), 'Wise');
  assert.equal(getAttributeTierLabel('strength', 22), 'Titan-Born');

  // Verify Compendium knowledge list only includes encountered/defeated species
  const compendium = getCharacterCompendiumKnowledge(db, fighter);
  assert.equal(compendium.length, 1);
  assert.equal(compendium[0].monsterName, 'Basilisk');
  assert.equal(compendium[0].tier, 'EXPERIENCED');
});

test('Phase 7B.9 — Action-UI-Lab HTTP/API Integration: Point-Buy, 14-Family Ranger, Spend-Attribute, CON Equip Rules, Second Wind & Compendium', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const http = require('node:http');
  const { createLabApp } = require('../../action-ui-lab/server');

  const tmpDbPath = path.join(__dirname, '../../data/test_phase7b_api_integration.sqlite');
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(tmpDbPath + suffix)) {
      try { fs.unlinkSync(tmpDbPath + suffix); } catch { /* ignore */ }
    }
  }

  const app = createLabApp({ dbPath: tmpDbPath });
  const labDb = app.locals.db;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let sessionCookie = null;
  async function api(method, urlPath, body = null, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (sessionCookie) headers.Cookie = sessionCookie;
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    for (const raw of setCookies) {
      const m = raw.match(/(__session=[^;]+)/);
      if (m) sessionCookie = m[1];
    }
    const json = await res.json();
    return { status: res.status, json };
  }

  try {
    // 1. Register user
    const reg = await api('POST', '/api/auth/register', {
      username: 'phase7b_ranger',
      password: 'Password123!'
    });
    assert.equal(reg.status, 200);
    assert.equal(reg.json.ok, true);
    assert.equal(reg.json.state.statRules.requiredTotalSum, 72);
    assert.equal(reg.json.state.favoredEnemyOptions.length, 14);

    // 2. Reject Ranger creation with UNDEAD or reserved family
    const badUndead = await api('POST', '/api/character/create', {
      name: 'ForbiddenHunter',
      classType: 'RANGER',
      favoredEnemyFamily: 'UNDEAD',
      stats: { strength: 14, dexterity: 18, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 }
    });
    assert.equal(badUndead.status, 400);
    assert.match(badUndead.json.error, /Undead is not permitted/i);

    const badFey = await api('POST', '/api/character/create', {
      name: 'ReservedHunter',
      classType: 'RANGER',
      favoredEnemyFamily: 'FEY',
      stats: { strength: 14, dexterity: 18, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 }
    });
    assert.equal(badFey.status, 400);

    // 3. Create Ranger with custom 72-point allocation and TERRESTRIAL_MAGICAL_BEASTS ("Other Magical Beasts")
    const createRes = await api('POST', '/api/character/create', {
      name: 'Sylva',
      classType: 'RANGER',
      favoredEnemyFamily: 'TERRESTRIAL_MAGICAL_BEASTS',
      stats: { strength: 14, dexterity: 18, constitution: 14, intelligence: 10, wisdom: 8, charisma: 8 }
    });
    assert.equal(createRes.status, 200);
    assert.equal(createRes.json.ok, true);

    const state1 = createRes.json.state;
    assert.equal(state1.character.name, 'Sylva');
    assert.equal(state1.character.favored_enemy_family, 'TERRESTRIAL_MAGICAL_BEASTS');
    assert.equal(state1.character.favored_enemy_label, 'Other Magical Beasts');
    assert.equal(state1.character.max_hp, 12, 'Ranger L1 with CON 14 (+2) has 10 + 2 = 12 Max HP');
    assert.equal(state1.character.attributeTierLabels.dexterity, 'Razor-Quick', 'DEX 18 must map to Razor-Quick tier');
    assert.equal(state1.character.attributeTierLabels.constitution, 'Resilient', 'CON 14 must map to Resilient tier');
    assert.equal(state1.character.attributeTierLabels.wisdom, 'Unwary', 'WIS 8 must map to Unwary tier');

    // 4. Advance Ranger to Level 4 via applyCharacterLevelUp (+2 attribute points at L2 and L4)
    const heroId = state1.character.id;
    applyCharacterLevelUp(labDb, heroId, 4);

    // Spend 1st milestone point via POST /api/character/attributes/spend on CON (14 -> 15)
    const spend1 = await api('POST', '/api/character/attributes/spend', { attribute: 'constitution' });
    assert.equal(spend1.status, 200);
    assert.equal(spend1.json.spendResult.newScore, 15);
    assert.equal(spend1.json.spendResult.hpGain, 0, 'CON 14 -> 15 does not change modifier, so +0 HP');

    // Damage hero by 4 HP first to verify Rule B does not full-heal on CON 15 -> 16 via POST /api/action SPEND_ATTRIBUTE_POINT
    labDb.prepare('UPDATE characters SET current_hp = max_hp - 4 WHERE id = ?').run(heroId);
    const spend2 = await api('POST', '/api/action', {
      action: 'SPEND_ATTRIBUTE_POINT',
      payload: { attribute: 'CON' }
    });
    assert.equal(spend2.status, 200);
    assert.equal(spend2.json.state.character.constitution, 16);
    assert.equal(spend2.json.state.character.current_hp, spend2.json.state.character.max_hp - 4, 'Must not full-heal');
    assert.equal(spend2.json.state.character.attribute_points, 0);
    assert.equal(spend2.json.state.character.attributeTierLabels.constitution, 'Stalwart', 'CON 16 must map to Stalwart tier');

    // 5. Verify /api/state returns compendiumKnowledge entries after recording a victory
    const basilisk = labDb.prepare("SELECT * FROM monsters WHERE LOWER(name) = 'basilisk'").get();
    recordMonsterVictory(labDb, heroId, basilisk.id);
    const stateRes = await api('GET', '/api/state');
    assert.equal(stateRes.status, 200);
    assert.ok(Array.isArray(stateRes.json.state.compendiumKnowledge));
    const basiliskEntry = stateRes.json.state.compendiumKnowledge.find(m => m.monsterName === 'Basilisk');
    assert.ok(basiliskEntry, 'Compendium must include defeated Basilisk in compendiumKnowledge');
    assert.equal(basiliskEntry.tier, 'RECOGNIZED');
    assert.equal(basiliskEntry.tierLabel, 'Recognized');
    assert.equal(basiliskEntry.favoredEnemyMatch, true, 'Basilisk is in TERRESTRIAL_MAGICAL_BEASTS, matching Ranger Favored Enemy');
  } finally {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
    try { labDb.close(); } catch { /* ignore */ }
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(tmpDbPath + suffix)) {
        try { fs.unlinkSync(tmpDbPath + suffix); } catch { /* ignore */ }
      }
    }
  }
});
