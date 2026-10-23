/**
 * DarkGrid — Phase 7C: Cleric Divine Combat System Comprehensive Test Suite
 *
 * Covers all mandatory Phase 7C requirements:
 *  1. Divine Charge formula max(1, 6 + Level + WIS_mod) with no max level cap, migration 015 backfill,
 *     SQLite persistence, and city-only recharge (no refill on combat victory, level-up, login, or reload).
 *  2. WIS changes & equipment swaps: clamping down when max capacity drops, no free-charge exploit on
 *     repeated WIS ring equip/unequip or milestone WIS allocation.
 *  3. Separate Out-of-Combat Self-Healing: independent pool from Divine Charges; both recharged on City Rest.
 *  4. Ability 1 — Battle Prayer (Cost 1): weapon attack + heal on hit, 0 heal on miss (charge spent),
 *     healing capped at Max HP, no critical-hit multiplication of healing, exact English description.
 *  5. Ability 2 — Smite (Cost 1): weapon attack + 1d8 radiant (+2d8 vs Undead at L1), charge spent on miss,
 *     no healing, weapon damage doubled on crit while radiant bonus is NOT doubled on crit, exact description.
 *  6. Ability 3 — Divine Shield (Cost 2): consumes turn without attacking, lasts 2 monster turns including
 *     activation round, reduces incoming HP damage per hit (min 0), non-stacking, no retroactive heal,
 *     no auto-trigger at low HP, does not prevent petrification (CALCIFY stage-3 instant death).
 *  7. Mutual exclusion & class enforcement: no simultaneous Smite + Battle Prayer, Fighter/Ranger cannot
 *     invoke divine combat actions, insufficient charges rejected atomically.
 *  8. Multi-hit monster attacks, monster special abilities (Rend, Constrict, ElementalRider, CooldownSpecial),
 *     fleeing parting blow mitigation, death, and reload persistence.
 *  9. Race conditions, stale round idempotency, and security anti-tamper protection.
 * 10. Action-UI-Lab HTTP/API & DOM integration (contextual buttons, costs, shield duration, Stage 1 secrecy,
 *     and Hidden Math Policy).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { createTestDb } = require('./test_helpers');
const {
  createCharacter,
  getCharacterById,
  getCharacterEquipment,
  getEffectiveStats,
  calculateMaxDivineCharges,
  clampDivineCharges,
  getClericDivineChargeInfo,
  performClericSelfHeal,
  performCityRest,
  spendAttributePoint,
  applyCharacterLevelUp,
  reconcileCharacterHpOnLoad,
  equipItem,
  unequipItem
} = require('../src/domain/character/rules');
const {
  getClericBattlePrayerProfile,
  getClericSmiteProfile,
  getClericDivineShieldProfile,
  applyDivineShieldMitigation,
  parseCombatStateJson,
  getPublicHeroStatusBadges
} = require('../src/domain/combat/abilities');
const {
  executeCombatRound,
  getCombatState
} = require('../src/domain/combat/engine');
const { createLabApp } = require('../action-ui-lab/server');

function createUser(db, username) {
  const res = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, 'hash');
  return Number(res.lastInsertRowid);
}

function makeFixedRng(values, fallback = 0.5) {
  let idx = 0;
  return () => {
    if (idx < values.length) {
      return values[idx++];
    }
    return fallback;
  };
}

function spawnActiveCombatEncounter(db, characterId, monsterName = 'Goblin', overrides = {}) {
  const charRow = db.prepare('SELECT tile_id FROM characters WHERE id = ?').get(characterId);
  const monster = db.prepare('SELECT * FROM monsters WHERE name = ? LIMIT 1').get(monsterName)
    || db.prepare('SELECT * FROM monsters LIMIT 1').get();
  const maxHp = overrides.monsterMaxHp ?? monster.base_hp;
  const currentHp = overrides.currentMonsterHp ?? maxHp;
  const stateJson = overrides.combatState ? JSON.stringify(overrides.combatState) : '{}';
  const res = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status,
      current_monster_hp, monster_max_hp, combat_round,
      initiative_winner, spotted_by_hero, is_ambush, opening_shot_resolved, combat_state_json
    ) VALUES (?, ?, ?, 'IN_COMBAT', ?, ?, ?, 'HERO', 1, 0, 1, ?)
  `).run(
    characterId,
    charRow.tile_id,
    monster.id,
    currentHp,
    maxHp,
    overrides.combatRound ?? 1,
    stateJson
  );
  return Number(res.lastInsertRowid);
}

test('Phase 7C.1 — Divine Charges: Capacity formula, Level 1-20+ open-ended scaling, persistence & city-only recharge', () => {
  const db = createTestDb();
  const userId = createUser(db, 'cleric_p7c_1');

  // Verify exact examples from specification with WIS 16 (+3 mod):
  // Level 1: 10, Level 3: 12, Level 5: 14, Level 7: 16, Level 10: 19, plus Level 15 (no level cap): 24
  assert.equal(calculateMaxDivineCharges({ class: 'CLERIC', level: 1, wisdom: 16 }), 10);
  assert.equal(calculateMaxDivineCharges({ class: 'CLERIC', level: 3, wisdom: 16 }), 12);
  assert.equal(calculateMaxDivineCharges({ class: 'CLERIC', level: 5, wisdom: 16 }), 14);
  assert.equal(calculateMaxDivineCharges({ class: 'CLERIC', level: 7, wisdom: 16 }), 16);
  assert.equal(calculateMaxDivineCharges({ class: 'CLERIC', level: 10, wisdom: 16 }), 19);
  assert.equal(calculateMaxDivineCharges({ class: 'CLERIC', level: 15, wisdom: 16 }), 24);
  assert.equal(calculateMaxDivineCharges({ class: 'FIGHTER', level: 10, wisdom: 16 }), 0);

  // Create Level 1 Cleric with default preset (WIS 16 -> 10 Divine Charges)
  const cleric = createCharacter(db, {
    userId,
    name: 'Brother Aldric',
    classType: 'CLERIC',
    useClassDefaults: true
  });
  assert.equal(cleric.wisdom, 16);
  assert.equal(cleric.divine_charges, 10);
  assert.equal(cleric.max_divine_charges, 10);

  // Spend 4 charges and verify no automatic recharge on combat victory, level-up, or reload
  db.prepare('UPDATE characters SET divine_charges = 6, current_hp = 5 WHERE id = ?').run(cleric.id);

  // 1) Reload / reconcileCharacterHpOnLoad does NOT refill Divine Charges
  const afterReload = reconcileCharacterHpOnLoad(db, cleric.id);
  assert.equal(afterReload.divine_charges, 6);
  assert.equal(afterReload.max_divine_charges, 10);

  // 2) Combat Victory does NOT refill Divine Charges
  const encId = spawnActiveCombatEncounter(db, cleric.id, 'Goblin', { currentMonsterHp: 1, monsterMaxHp: 6 });
  // Roll 0.95 -> d20=20 (Crit Hit), kills Goblin
  const postVictoryState = executeCombatRound(db, cleric.id, encId, 'ATTACK', { rng: makeFixedRng([0.95, 0.95]) });
  assert.equal(postVictoryState.encounter.status, 'VICTORY');
  const afterVictoryHero = getCharacterById(db, cleric.id);
  assert.equal(afterVictoryHero.divine_charges, 6, 'Combat victory must not recharge Divine Charges');

  // 3) Level-up increases max_divine_charges (10 -> 11 at L2), but does NOT refill current divine_charges
  const lvlUp = applyCharacterLevelUp(db, afterVictoryHero, 2, () => 0.5);
  assert.equal(lvlUp.maxDivineCharges, 11);
  assert.equal(lvlUp.divineCharges, 6, 'Level-up must not automatically refill spent Divine Charges');
  const afterLvlHero = getCharacterById(db, cleric.id);
  assert.equal(afterLvlHero.divine_charges, 6);

  // 4) City Sanctuary Rest recharges BOTH Divine Charges and out-of-combat Self-Healing
  db.prepare('UPDATE characters SET cleric_heal_uses = 2, current_hp = 4 WHERE id = ?').run(cleric.id);
  const restRes = performCityRest(db, cleric.id);
  assert.equal(restRes.healedToFull, true);
  assert.equal(restRes.divineChargesRechargedTo, 11);
  assert.equal(restRes.clericUsesRechargedTo, 2);

  const afterRestHero = getCharacterById(db, cleric.id);
  assert.equal(afterRestHero.divine_charges, 11);
  assert.equal(afterRestHero.cleric_heal_uses, 0);
  assert.equal(afterRestHero.current_hp, afterRestHero.max_hp);
});

test('Phase 7C.2 — WIS Changes & Equipment Swaps: Clamping and anti-exploit verification', () => {
  const db = createTestDb();
  const userId = createUser(db, 'cleric_p7c_2');

  // Create Cleric with odd WIS 15 (+2 mod -> Level 1 max charges = 6 + 1 + 2 = 9)
  // 72 points: STR 13, CON 12, DEX 10, INT 10, WIS 15, CHA 12 = 72
  const cleric = createCharacter(db, {
    userId,
    name: 'Sister Seraphina',
    classType: 'CLERIC',
    stats: { strength: 13, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 15, charisma: 12 }
  });
  assert.equal(cleric.divine_charges, 9);
  assert.equal(cleric.max_divine_charges, 9);

  // Ensure a Ring of Wisdom +1 exists in item_definitions (raises effective WIS from 15 -> 16, mod +2 -> +3, max charges 9 -> 10)
  let wisRingDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Ring of Wisdom +1'").get();
  if (!wisRingDef) {
    const insDef = db.prepare(`
      INSERT INTO item_definitions (name, category, equip_slot, buy_price, sell_price, is_magical, attributes, description)
      VALUES ('Ring of Wisdom +1', 'OTHER', 'RING', 400, 200, 1, '{"wisdom_bonus":1}', 'A silver band etched with a quiet prayer.')
    `).run();
    wisRingDef = { id: Number(insDef.lastInsertRowid) };
  }
  assert.ok(wisRingDef, 'Ring of Wisdom +1 must exist in item_definitions');
  const ringInst = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, NULL)
  `).run(wisRingDef.id, cleric.id);
  const ringInstanceId = Number(ringInst.lastInsertRowid);

  // Equip Ring of Wisdom +1: max charges increases 9 -> 10, but current charges MUST stay 9 (no free charge!)
  equipItem(db, cleric.id, ringInstanceId, 'RING');
  let eq = getCharacterEquipment(db, cleric.id);
  let info = getClericDivineChargeInfo(getCharacterById(db, cleric.id), eq);
  assert.equal(info.maxCharges, 10, 'Equipping Ring of Wisdom +1 should increase Max Divine Charges to 10');
  assert.equal(info.currentCharges, 9, 'Increasing Max Divine Charges via equipment must NOT grant a free charge');

  // Repeatedly unequip and equip Ring of Wisdom +1 10 times — currentCharges must stay 9
  for (let i = 0; i < 10; i++) {
    unequipItem(db, cleric.id, ringInstanceId);
    equipItem(db, cleric.id, ringInstanceId, 'RING');
  }
  eq = getCharacterEquipment(db, cleric.id);
  info = getClericDivineChargeInfo(getCharacterById(db, cleric.id), eq);
  assert.equal(info.currentCharges, 9, 'Repeated WIS equipment toggling must never generate free charges');

  // Now rest in city while wearing Ring of Wisdom +1 -> recharges to full 10 / 10
  performCityRest(db, cleric.id);
  info = getClericDivineChargeInfo(getCharacterById(db, cleric.id), eq);
  assert.equal(info.currentCharges, 10);
  assert.equal(info.maxCharges, 10);

  // Unequip Ring of Wisdom +1 -> max drops 10 -> 9, so current charges MUST clamp down to 9 in SQLite!
  unequipItem(db, cleric.id, ringInstanceId);
  eq = getCharacterEquipment(db, cleric.id);
  const afterUnequipHero = getCharacterById(db, cleric.id);
  info = getClericDivineChargeInfo(afterUnequipHero, eq);
  assert.equal(info.maxCharges, 9);
  assert.equal(info.currentCharges, 9, 'Unequipping WIS gear must clamp current Divine Charges to new maximum');
  assert.equal(afterUnequipHero.divine_charges, 9);

  // Re-equipping Ring of Wisdom +1 after clamping must keep currentCharges at 9 (not restore 10 without resting)
  equipItem(db, cleric.id, ringInstanceId, 'RING');
  eq = getCharacterEquipment(db, cleric.id);
  info = getClericDivineChargeInfo(getCharacterById(db, cleric.id), eq);
  assert.equal(info.maxCharges, 10);
  assert.equal(info.currentCharges, 9);

  // Milestone attribute point spent on WIS: raises base WIS 15 -> 16, does not auto-refill spent charges
  unequipItem(db, cleric.id, ringInstanceId);
  db.prepare('UPDATE characters SET divine_charges = 4, attribute_points = 1 WHERE id = ?').run(cleric.id);
  const spendRes = spendAttributePoint(db, cleric.id, 'wisdom');
  assert.equal(spendRes.newBaseScore, 16);
  assert.equal(spendRes.maxDivineCharges, 10);
  assert.equal(spendRes.divineCharges, 4, 'Spending milestone point on WIS must not refill spent Divine Charges');
});

test('Phase 7C.3 — Ability 1: BATTLE PRAYER (Hit, Miss, Max HP cap, No Crit Heal Multiplication, Low HP recovery)', () => {
  const db = createTestDb();
  const userId = createUser(db, 'cleric_p7c_3');
  const cleric = createCharacter(db, {
    userId,
    name: 'Brother Aldric',
    classType: 'CLERIC',
    useClassDefaults: true
  });

  // Damage Cleric to 2 / 9 HP (low-health situation)
  db.prepare('UPDATE characters SET current_hp = 2 WHERE id = ?').run(cleric.id);
  const encId = spawnActiveCombatEncounter(db, cleric.id, 'Goblin', { currentMonsterHp: 40, monsterMaxHp: 40 });

  // 1) Battle Prayer HIT:
  // Hero attack d20: 0.70 -> 15 (Hit), weapon dmg: 0.5 -> 4, heal roll 1d6: 0.5 -> 4 + WIS_mod(3) = 7 HP healed
  // Monster attack d20: 0.01 -> 1 (Miss)
  const hitState = executeCombatRound(db, cleric.id, encId, 'BATTLE_PRAYER', {
    rng: makeFixedRng([0.70, 0.50, 0.50, 0.01])
  });

  const prayerEv = hitState.events.find(e => e.event_type === 'BATTLE_PRAYER');
  assert.ok(prayerEv, 'Should record a BATTLE_PRAYER event');
  assert.ok(
    prayerEv.public_text.includes('He cries out a prayer as his weapon strikes, drawing strength from his faith.'),
    'Battle Prayer must include the exact canonical English description'
  );
  const prayerDetails = JSON.parse(prayerEv.details);
  assert.equal(prayerDetails.isHit, true);
  assert.equal(prayerDetails.cost, 1);
  assert.equal(prayerDetails.rawHeal, 7); // 4 (1d6) + 3 (WIS mod)
  assert.equal(prayerDetails.healed, 7);  // 2 + 7 = 9 (capped at Max HP 9)
  assert.equal(hitState.character.current_hp, 9);
  assert.equal(hitState.character.divine_charges, 9);

  // 2) Battle Prayer CRIT HIT at 7 / 9 HP:
  // Verify weapon damage is doubled on crit, healing is NOT doubled on crit, and healing caps at Max HP (9)
  db.prepare('UPDATE characters SET current_hp = 7 WHERE id = ?').run(cleric.id);
  // Hero attack d20: 0.99 -> 20 (Crit), weapon dmg: 0.5 -> 4*2 = 8, heal roll 1d6: 0.99 -> 6 + 3 = 9 raw heal (not doubled to 18!)
  // Capped at Max HP 9 -> actual healed = 2
  const critState = executeCombatRound(db, cleric.id, encId, 'BATTLE_PRAYER', {
    rng: makeFixedRng([0.99, 0.50, 0.99, 0.01])
  });
  const critEv = critState.events.filter(e => e.event_type === 'BATTLE_PRAYER').pop();
  const critDetails = JSON.parse(critEv.details);
  assert.equal(critDetails.isCrit, true);
  assert.equal(critDetails.rawHeal, 9, 'Battle Prayer healing must NOT be multiplied on a critical hit');
  assert.equal(critDetails.healed, 2, 'Battle Prayer healing must not exceed Max HP');
  assert.equal(critState.character.current_hp, 9);
  assert.equal(critState.character.divine_charges, 8);

  // 3) Battle Prayer MISS:
  // Hero attack d20: 0.0 -> 1 (Fumble Miss), Monster attack d20: 0.0 -> 1 (Miss)
  db.prepare('UPDATE characters SET current_hp = 4 WHERE id = ?').run(cleric.id);
  const missState = executeCombatRound(db, cleric.id, encId, 'BATTLE_PRAYER', {
    rng: makeFixedRng([0.0, 0.0])
  });
  const missEv = missState.events.filter(e => e.event_type === 'BATTLE_PRAYER').pop();
  const missDetails = JSON.parse(missEv.details);
  assert.equal(missDetails.isHit, false);
  assert.equal(missDetails.healed, 0, 'Battle Prayer miss must not heal the Cleric');
  assert.equal(missState.character.current_hp, 4);
  assert.equal(missState.character.divine_charges, 7, 'Battle Prayer miss must still consume 1 Divine Charge');
});

test('Phase 7C.4 — Ability 2: SMITE (Living vs Undead bonus radiant dice, Crit behavior, Miss consumes charge, No heal)', () => {
  const db = createTestDb();
  const userId = createUser(db, 'cleric_p7c_4');
  const cleric = createCharacter(db, {
    userId,
    name: 'Brother Aldric',
    classType: 'CLERIC',
    useClassDefaults: true
  });

  // Damage Cleric to 5 / 9 HP to verify Smite never heals
  db.prepare('UPDATE characters SET current_hp = 5 WHERE id = ?').run(cleric.id);

  // 1) Smite against Living Monster (Goblin): +1d8 radiant damage
  const gobEncId = spawnActiveCombatEncounter(db, cleric.id, 'Goblin', { currentMonsterHp: 50, monsterMaxHp: 50 });
  const livingProfile = getClericSmiteProfile(cleric, getCharacterEquipment(db, cleric.id), { creature_type: 'HUMANOID', monster_family: 'GOBLINOIDS' });
  assert.equal(livingProfile.isUndead, false);
  assert.equal(livingProfile.radiantDice, '1d8');

  // Hero attack d20: 0.80 -> 17 (Hit), weapon dmg (1d8+1 Heavy Mace): 0.5 -> 6, radiant dmg (1d8): 0.5 -> 5 => total 11
  // Monster attack d20: 0.0 -> 1 (Miss)
  const smiteLiving = executeCombatRound(db, cleric.id, gobEncId, 'SMITE', {
    rng: makeFixedRng([0.80, 0.50, 0.50, 0.0])
  });
  const smiteLivingEv = smiteLiving.events.find(e => e.event_type === 'SMITE');
  assert.ok(smiteLivingEv);
  assert.ok(
    smiteLivingEv.public_text.includes('His weapon erupts with sacred light, punishing the enemy with divine wrath.'),
    'Smite must include the exact canonical English description'
  );
  const livingDetails = JSON.parse(smiteLivingEv.details);
  assert.equal(livingDetails.isHit, true);
  assert.equal(livingDetails.isUndead, false);
  assert.equal(livingDetails.radiantDice, '1d8');
  assert.equal(livingDetails.weaponDamage, 6);
  assert.equal(livingDetails.radiantDamage, 5);
  assert.equal(livingDetails.damage, 11);
  assert.equal(smiteLiving.character.current_hp, 5, 'Smite must not heal the Cleric');
  assert.equal(smiteLiving.character.divine_charges, 9);

  // 2) Smite Critical Hit against Undead (Human Skeleton):
  // Weapon damage IS doubled on crit (and blunt mace vs Skeleton also applies), while bonus radiant dice (2d8 vs Undead at L1) are NOT multiplied on crit!
  db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(gobEncId);
  const undeadEncId = spawnActiveCombatEncounter(db, cleric.id, 'Human Skeleton', { currentMonsterHp: 80, monsterMaxHp: 80 });
  const undeadEncRow = db.prepare(`
    SELECT e.*, m.creature_type, m.monster_family, m.name as monster_name
    FROM encounters e JOIN monsters m ON e.monster_id = m.id WHERE e.id = ?
  `).get(undeadEncId);
  const undeadProfile = getClericSmiteProfile(cleric, getCharacterEquipment(db, cleric.id), undeadEncRow);
  assert.equal(undeadProfile.isUndead, true);
  assert.equal(undeadProfile.radiantDice, '2d8', 'Smite against Undead at Level 1 must roll 2d8 radiant damage');

  // Hero Smite d20 = 0.99 (20 Crit), weapon damage roll = 0.5, radiant 2d8 rolls = [0.5, 0.5] -> 5 + 5 = 10 (not doubled to 20!)
  const smiteUndeadCrit = executeCombatRound(db, cleric.id, undeadEncId, 'SMITE', {
    rng: makeFixedRng([0.99, 0.50, 0.50, 0.50, 0.0])
  });
  const smiteUndeadEv = smiteUndeadCrit.events.filter(e => e.event_type === 'SMITE').pop();
  const undeadDetails = JSON.parse(smiteUndeadEv.details);
  assert.equal(undeadDetails.isHit, true);
  assert.equal(undeadDetails.isCrit, true);
  assert.equal(undeadDetails.isUndead, true);
  assert.equal(undeadDetails.radiantDice, '2d8');
  assert.equal(undeadDetails.radiantDamage, 10, 'Bonus radiant dice on Smite must not be multiplied on critical hit');
  assert.ok(undeadDetails.weaponDamage >= 10, 'Normal weapon damage must still be multiplied on critical hit');
  assert.equal(smiteUndeadCrit.character.divine_charges, 8);

  // 3) Smite MISS consumes 1 Divine Charge
  const smiteMiss = executeCombatRound(db, cleric.id, undeadEncId, 'SMITE', {
    rng: makeFixedRng([0.0, 0.0])
  });
  const smiteMissEv = smiteMiss.events.filter(e => e.event_type === 'SMITE').pop();
  const missDetails = JSON.parse(smiteMissEv.details);
  assert.equal(missDetails.isHit, false);
  assert.equal(missDetails.damage, 0);
  assert.equal(smiteMiss.character.divine_charges, 7, 'Smite miss must consume 1 Divine Charge');
});

test('Phase 7C.5 — Ability 3: DIVINE SHIELD (2-turn duration, per-hit DR, non-stacking, multi-hit mitigation, petrification non-bypass)', () => {
  const db = createTestDb();
  const userId = createUser(db, 'cleric_p7c_5');
  const cleric = createCharacter(db, {
    userId,
    name: 'Brother Aldric',
    classType: 'CLERIC',
    useClassDefaults: true
  });

  // Level 1 Cleric with WIS 16 (+3 mod): Divine Shield costs 2 charges, lasts 2 monster turns, reduces damage by 2 + 3 = 5 per hit
  const shieldProf = getClericDivineShieldProfile(cleric, getCharacterEquipment(db, cleric.id));
  assert.equal(shieldProf.cost, 2);
  assert.equal(shieldProf.durationTurns, 2);
  assert.equal(shieldProf.damageReduction, 5);

  // Spawn a Bugbear in combat
  const encId = spawnActiveCombatEncounter(db, cleric.id, 'Bugbear', { currentMonsterHp: 60, monsterMaxHp: 60 });

  // Round 1: Activate DIVINE_SHIELD (consumes 2 charges: 10 -> 8, sets divineShieldTurns = 2, then Monster attacks in Round 1 -> decrements to 1)
  // Monster attack d20: 0.90 (Hit), damage roll: 0.5
  const r1State = executeCombatRound(db, cleric.id, encId, 'DIVINE_SHIELD', {
    rng: makeFixedRng([0.90, 0.50])
  });

  const shieldEv = r1State.events.find(e => e.event_type === 'DIVINE_SHIELD');
  assert.ok(shieldEv, 'Should log DIVINE_SHIELD activation event');
  assert.ok(
    shieldEv.public_text.includes("A radiant barrier surrounds the Cleric, shielding him from the enemy's assault."),
    'Divine Shield must include the exact canonical English description'
  );
  // Verify no HERO_ATTACK occurred in Round 1
  assert.equal(
    r1State.events.some(e => e.event_type === 'HERO_ATTACK' || e.event_type === 'SMITE' || e.event_type === 'BATTLE_PRAYER'),
    false,
    'Divine Shield must consume the turn without performing a weapon attack'
  );
  // Monster attacked once in Round 1 and had its damage reduced by 5, and divineShieldTurns decremented from 2 -> 1
  const mAtkR1 = r1State.events.find(e => e.event_type === 'MONSTER_ATTACK');
  assert.ok(mAtkR1);
  const mAtkR1Details = JSON.parse(mAtkR1.details);
  assert.equal(mAtkR1Details.divineShieldMitigated, Math.min(mAtkR1Details.rawDamage, 5));
  assert.equal(mAtkR1Details.damage, Math.max(0, mAtkR1Details.rawDamage - 5));
  assert.equal(r1State.character.divine_charges, 8);
  assert.equal(r1State.divineShieldTurns, 1, 'After activation round monster turn, 1 monster turn of Divine Shield should remain');
  assert.ok(r1State.heroStatusBadges.some(b => b.key === 'DIVINE_SHIELD_ACTIVE' && b.label.includes('1 turn')));

  // Verify NON-STACKING: attempting to cast DIVINE_SHIELD again while divineShieldTurns > 0 is rejected server-side
  assert.throws(
    () => executeCombatRound(db, cleric.id, encId, 'DIVINE_SHIELD', { rng: makeFixedRng([0.5, 0.5]) }),
    /Divine Shield is already active/i,
    'Server must reject stacking multiple Divine Shields'
  );

  // Heal Cleric back to full so Round 2 monster attack doesn't kill him, then perform normal ATTACK in Round 2
  db.prepare('UPDATE characters SET current_hp = max_hp WHERE id = ?').run(cleric.id);
  const r2State = executeCombatRound(db, cleric.id, encId, 'ATTACK', {
    rng: makeFixedRng([0.80, 0.50, 0.90, 0.50])
  });
  const mAtkR2 = r2State.events.filter(e => e.event_type === 'MONSTER_ATTACK').pop();
  const mAtkR2Details = JSON.parse(mAtkR2.details);
  assert.equal(mAtkR2Details.divineShieldMitigated, Math.min(mAtkR2Details.rawDamage, 5), 'Second monster turn must still be mitigated by Divine Shield');
  assert.equal(r2State.divineShieldTurns, 0, 'Divine Shield must expire after 2 monster turns');

  // Verify multi-hit monster attacks are mitigated per hit while Divine Shield is active
  db.prepare('UPDATE characters SET current_hp = max_hp, divine_charges = 10 WHERE id = ?').run(cleric.id);
  // Give the encounter monster a 2-strike attack configuration via special_ability
  const multiMonster = db.prepare("SELECT id FROM monsters WHERE name = 'Troll' LIMIT 1").get();
  if (multiMonster) {
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encId);
    const trollEncId = spawnActiveCombatEncounter(db, cleric.id, 'Troll', { currentMonsterHp: 70, monsterMaxHp: 70 });
    const trollR1 = executeCombatRound(db, cleric.id, trollEncId, 'DIVINE_SHIELD', {
      rng: makeFixedRng([0.90, 0.50, 0.90, 0.50])
    });
    const trollAtks = trollR1.events.filter(e => e.event_type === 'MONSTER_ATTACK' || e.event_type === 'MONSTER_ABILITY');
    for (const ev of trollAtks) {
      const det = JSON.parse(ev.details);
      if (det.isHit && det.rawDamage !== undefined) {
        assert.equal(det.damage, Math.max(0, det.rawDamage - 5), 'Each damaging hit must be reduced by Divine Shield');
      }
    }
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(trollEncId);
  }

  // Verify Divine Shield does NOT prevent instant-death petrification (CALCIFY stage-3)
  db.prepare('UPDATE characters SET current_hp = max_hp, divine_charges = 10 WHERE id = ?').run(cleric.id);
  const cockatrice = db.prepare("SELECT id FROM monsters WHERE name = 'Cockatrice' LIMIT 1").get();
  if (cockatrice) {
    const calcEncId = spawnActiveCombatEncounter(db, cleric.id, 'Cockatrice', {
      currentMonsterHp: 30,
      monsterMaxHp: 30,
      combatState: {
        divineShieldTurns: 2,
        divineShieldReduction: 5,
        heroStatuses: { calcifyStage: 2 }
      }
    });
    // Hero misses (0.0), Cockatrice hits (0.95) and Cleric fails Fortitude save (0.0 -> d20=1) -> stage 3 petrification instant death!
    const calcState = executeCombatRound(db, cleric.id, calcEncId, 'ATTACK', {
      rng: makeFixedRng([0.0, 0.95, 0.50, 0.0])
    });
    assert.equal(calcState.character.is_alive, 0, 'Divine Shield must NOT prevent stage-3 petrification instant death');
  }
});

test('Phase 7C.6 — Action Economy, Separate Self-Healing, Fleeing Parting Blow, and Anti-Exploit Guards', () => {
  const db = createTestDb();
  const userId = createUser(db, 'cleric_p7c_6');
  const cleric = createCharacter(db, {
    userId,
    name: 'Brother Aldric',
    classType: 'CLERIC',
    useClassDefaults: true
  });

  // 1) Out-of-combat Self-Healing uses cleric_heal_uses and does NOT touch divine_charges
  db.prepare('UPDATE characters SET current_hp = 3 WHERE id = ?').run(cleric.id);
  const healRes = performClericSelfHeal(db, cleric.id);
  assert.ok(healRes.healed > 0);
  assert.equal(healRes.remainingUses, 1);
  const afterSelfHeal = getCharacterById(db, cleric.id);
  assert.equal(afterSelfHeal.divine_charges, 10, 'Out-of-combat Self-Healing must not consume Divine Charges');

  // 2) Cannot combine Battle Prayer and Smite in one attack, and invalid actions are rejected
  const encId = spawnActiveCombatEncounter(db, cleric.id, 'Goblin', { currentMonsterHp: 25, monsterMaxHp: 25 });
  assert.throws(
    () => executeCombatRound(db, cleric.id, encId, 'BATTLE_PRAYER_SMITE'),
    /Invalid combat action/i
  );

  // 3) Insufficient Divine Charges rejected atomically without advancing round or mutating HP
  db.prepare('UPDATE characters SET divine_charges = 1 WHERE id = ?').run(cleric.id);
  assert.throws(
    () => executeCombatRound(db, cleric.id, encId, 'DIVINE_SHIELD'),
    /Insufficient Divine Charges/i
  );
  assert.equal(getCharacterById(db, cleric.id).divine_charges, 1);

  db.prepare('UPDATE characters SET divine_charges = 0 WHERE id = ?').run(cleric.id);
  assert.throws(
    () => executeCombatRound(db, cleric.id, encId, 'SMITE'),
    /Insufficient Divine Charges/i
  );
  assert.throws(
    () => executeCombatRound(db, cleric.id, encId, 'BATTLE_PRAYER'),
    /Insufficient Divine Charges/i
  );

  // 4) Fleeing while Divine Shield is active mitigates the monster's parting blow
  db.prepare('UPDATE characters SET divine_charges = 5, current_hp = 9 WHERE id = ?').run(cleric.id);
  // Activate Divine Shield on Round 1 (monster misses: 0.0)
  executeCombatRound(db, cleric.id, encId, 'DIVINE_SHIELD', { rng: makeFixedRng([0.0]) });
  // Flee on Round 2 (monster hits parting blow: 0.85 -> d20=18 normal hit, dmg roll: 0.5 -> 3 raw damage, mitigated to 0 by Divine Shield DR 5!)
  const fleeState = executeCombatRound(db, cleric.id, encId, 'FLEE', { rng: makeFixedRng([0.85, 0.5]) });
  assert.equal(fleeState.encounter.status, 'ESCAPED');
  const fleeEv = fleeState.events.find(e => e.event_type === 'FLEE');
  const fleeDetails = JSON.parse(fleeEv.details);
  assert.equal(fleeDetails.damage, 0, 'Active Divine Shield must mitigate parting blow on Flee');
  assert.ok(fleeDetails.divineShieldMitigated > 0);
  assert.equal(fleeState.character.current_hp, 9);

  // 5) Stale round submission is ignored idempotently and does not double-spend Divine Charges
  const encId2 = spawnActiveCombatEncounter(db, cleric.id, 'Goblin', { currentMonsterHp: 25, monsterMaxHp: 25, combatRound: 2 });
  const chargesBeforeStale = getCharacterById(db, cleric.id).divine_charges;
  const staleRes = executeCombatRound(db, cleric.id, encId2, 'SMITE', { expectedRound: 1, rng: makeFixedRng([0.8, 0.5, 0.5, 0.0]) });
  assert.equal(staleRes.encounter.combat_round, 2);
  assert.equal(getCharacterById(db, cleric.id).divine_charges, chargesBeforeStale, 'Stale round request must not spend Divine Charges');

  // 6) Non-Cleric characters are rejected if they attempt divine combat actions
  const fighterUser = createUser(db, 'fighter_p7c_6');
  const fighter = createCharacter(db, { userId: fighterUser, name: 'Sir Roland', classType: 'FIGHTER', useClassDefaults: true });
  const fEncId = spawnActiveCombatEncounter(db, fighter.id, 'Goblin', { currentMonsterHp: 20, monsterMaxHp: 20 });
  assert.throws(
    () => executeCombatRound(db, fighter.id, fEncId, 'SMITE'),
    /Only Clerics can invoke/i
  );
});

test('Phase 7C.7 — Action-UI-Lab HTTP/API, Security Anti-Tamper, Contextual UI & Secrecy Verification', async () => {
  const app = createLabApp({ dbPath: ':memory:' });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function postAction(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    return { status: res.status, body: await res.json() };
  }

  try {
    // 1. Switch active champion to Cleric
    let res = await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'CLERIC' });
    assert.equal(res.body.ok, true);
    assert.equal(res.body.state.character.class, 'CLERIC');
    assert.equal(res.body.state.character.divine_charges, 10);
    assert.equal(res.body.state.character.max_divine_charges, 10);
    assert.ok(res.body.state.clericDivineChargeInfo);
    assert.equal(res.body.state.clericDivineChargeInfo.currentCharges, 10);
    assert.equal(res.body.state.clericDivineChargeInfo.maxCharges, 10);

    // 2. Verify Stage 1 encounter secrecy is preserved
    res = await postAction('LAB_SCENARIO', { scenario: 'STAGE1_MYSTERY', monsterName: 'Wight' });
    assert.equal(res.body.state.mode, 'DISCOVERED');
    assert.equal(res.body.state.encounter.monsterName, undefined);

    // 3. Engage into Stage 2 Combat with Wight (Undead)
    res = await postAction('INVESTIGATE');
    assert.equal(res.body.state.mode, 'IN_COMBAT');
    assert.equal(res.body.state.encounter.monsterName, 'Wight');

    // 4. Execute DIVINE_SHIELD via HTTP API (spends 2 charges: 10 -> 8)
    res = await postAction('DIVINE_SHIELD');
    assert.equal(res.body.ok, true);
    assert.equal(res.body.state.character.divine_charges, 8);
    if (res.body.state.encounter && res.body.state.encounter.status === 'IN_COMBAT') {
      assert.equal(res.body.state.encounter.divineShieldTurns, 1);
    }

    // 5. Execute SMITE via HTTP API (spends 1 charge: 8 -> 7)
    if (!res.body.state.encounter || res.body.state.encounter.status !== 'IN_COMBAT') {
      await postAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Wight' });
    }
    const beforeSmiteCharges = (await (await fetch(`${baseUrl}/api/state`)).json()).state.character.divine_charges;
    res = await postAction('SMITE');
    assert.equal(res.body.ok, true);
    assert.equal(res.body.state.character.divine_charges, beforeSmiteCharges - 1);
    // Verify Hidden Math Policy on combatSequence beats
    for (const beat of res.body.state.combatSequence.beats) {
      assert.ok(!/1d20|1d8|1d6/i.test(beat.publicText), 'Public combat text must never leak dice formulas');
    }

    // 6. Execute BATTLE_PRAYER via HTTP API (spends 1 charge)
    if (!res.body.state.encounter || res.body.state.encounter.status !== 'IN_COMBAT') {
      await postAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Ogre' });
    }
    const beforePrayerCharges = (await (await fetch(`${baseUrl}/api/state`)).json()).state.character.divine_charges;
    res = await postAction('BATTLE_PRAYER');
    assert.equal(res.body.ok, true);
    assert.equal(res.body.state.character.divine_charges, beforePrayerCharges - 1);

    // 7. Return to Oakhaven Sanctuary and verify REST recharges Divine Charges to max
    await postAction('LAB_SCENARIO', { scenario: 'CITY' });
    res = await postAction('REST');
    assert.equal(res.body.ok, true);
    assert.equal(res.body.state.character.divine_charges, res.body.state.character.max_divine_charges);

    // 8. Verify client tamper protection blocks divine_charges in request payload
    const tamperRes = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REST', divine_charges: 999 })
    });
    assert.equal(tamperRes.status, 400, 'Security middleware must reject client tampering with divine_charges');

    // 9. Verify HTML/JS UI hooks exist in action-ui-lab/public/index.html
    const html = fs.readFileSync(path.join(__dirname, '..', 'action-ui-lab', 'public', 'index.html'), 'utf8');
    assert.ok(html.includes('id="dm-cleric-divine-deck"'));
    assert.ok(html.includes('id="action-divine-prayer"'));
    assert.ok(html.includes('id="action-divine-smite"'));
    assert.ok(html.includes('id="action-divine-shield"'));
    assert.ok(html.includes('id="deck-divine-charges-badge"'));
    assert.ok(html.includes('id="deck-divine-shield-banner"'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (app.locals && app.locals.db) {
      try { app.locals.db.close(); } catch {}
    }
  }
});
