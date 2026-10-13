const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../src/domain/auth/service');
const {
  createCharacter,
  getCharacterEquipment,
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  getActiveWeapon,
  getRangerFavoredEnemyBonus,
  getClericHolyRadianceBonus,
  performClericSelfHeal,
  getClericRemainingHealUses
} = require('../src/domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus,
  getHeroDamageFormula
} = require('../src/domain/combat/rules');
const {
  startCombat,
  executeCombatRound,
  getCombatState
} = require('../src/domain/combat/engine');
const {
  getDistanceToNearestSafeCity,
  getTileByCoords
} = require('../src/domain/world/map');
const {
  checkTileEncounter,
  getMaxCrForDistance,
  getActiveEncounterForCharacter
} = require('../src/domain/encounters/engine');

// =============================================================================
// Helper: create deterministic RNG
// =============================================================================
function createRngSequence(sequence) {
  let idx = 0;
  return () => {
    if (idx < sequence.length) {
      return sequence[idx++];
    }
    return 0.5;
  };
}

const defaultStatsByClass = {
  FIGHTER: { strength: 16, constitution: 13, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 10 },
  RANGER: { strength: 12, constitution: 10, dexterity: 16, intelligence: 10, wisdom: 13, charisma: 10 },
  CLERIC: { strength: 12, constitution: 11, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 12 }
};

// =============================================================================
// Helper: create character with given class
// =============================================================================
async function setupTestHero(db, username, classType = 'RANGER', options = {}) {
  const user = await registerUser(db, username, 'pass1234');
  const upperClass = (classType || 'RANGER').toUpperCase();
  const hero = createCharacter(db, {
    userId: user.id,
    name: username,
    classType: upperClass,
    stats: options.stats || defaultStatsByClass[upperClass],
    primaryWeapon: options.primaryWeapon,
    favoredEnemyType: options.favoredEnemyType || (upperClass === 'RANGER' ? 'BEAST' : undefined),
    favoredEnemySubtype: options.favoredEnemySubtype
  });
  return { user, hero };
}

// =============================================================================
// 1. PRIMARY WEAPON PREFERENCE & SHIELD AC
// =============================================================================

test('1.1 Primary Weapon Preference: Melee preference selects melee weapon against ground targets', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'MeleeHero', 'FIGHTER');
  const equipment = getCharacterEquipment(db, hero.id);
  const groundMonster = { is_flying: 0, creature_type: 'BEAST' };

  setPrimaryWeaponPreference(db, hero.id, 'MELEE');
  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  const active = getActiveWeapon(refreshedHero, equipment, groundMonster);

  assert.equal(active.isRangedActive, false);
  assert.equal(active.activeWeapon.id, equipment.meleeWeapon.id);
});

test('1.2 Primary Weapon Preference: Ranged preference selects ranged weapon against ground targets', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'RangedHero', 'RANGER');
  const equipment = getCharacterEquipment(db, hero.id);
  const groundMonster = { is_flying: 0, creature_type: 'BEAST' };

  setPrimaryWeaponPreference(db, hero.id, 'RANGED');
  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  const active = getActiveWeapon(refreshedHero, equipment, groundMonster);

  assert.equal(active.isRangedActive, true);
  assert.equal(active.activeWeapon.id, equipment.rangedWeapon.id);
});

test('1.3 Primary Weapon Preference: Flying monster forces ranged weapon regardless of preference', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'FlyingTargetHero', 'FIGHTER');
  const equipment = getCharacterEquipment(db, hero.id);
  const flyingMonster = { is_flying: 1, creature_type: 'BEAST' };

  // Set preference to MELEE
  setPrimaryWeaponPreference(db, hero.id, 'MELEE');
  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  const active = getActiveWeapon(refreshedHero, equipment, flyingMonster);

  // Must force ranged
  assert.equal(active.isRangedActive, true);
  assert.equal(active.activeWeapon.id, equipment.rangedWeapon.id);
});

test('1.4 Shield AC: drops to 0 when ranged is active, restored when melee is active', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'ShieldACUser', 'FIGHTER');
  const equipment = getCharacterEquipment(db, hero.id);
  const monster = { creature_type: 'BEAST' };

  // Fighter base AC with Melee active (Armor + Shield + DEX)
  const meleeAC = calculateHeroAC(hero, equipment.armor, equipment.shield, false, monster);
  assert.ok(equipment.shield, 'Fighter starts with shield');
  const shieldBonus = equipment.shield.armor_bonus || 1;

  // With Ranged active: shield AC must drop to 0
  const rangedAC = calculateHeroAC(hero, equipment.armor, equipment.shield, true, monster);
  assert.equal(rangedAC, meleeAC - shieldBonus, 'AC with ranged weapon active must exclude shield bonus');

  // Restored when switching back to melee
  const restoredAC = calculateHeroAC(hero, equipment.armor, equipment.shield, false, monster);
  assert.equal(restoredAC, meleeAC, 'AC must restore shield bonus when melee is active');
});

test('1.5 Equipment Preference: persists in database across fetches', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'PersistHero', 'CLERIC');
  assert.equal(hero.primary_weapon, 'MELEE');

  setPrimaryWeaponPreference(db, hero.id, 'RANGED');
  let row = db.prepare('SELECT primary_weapon FROM characters WHERE id = ?').get(hero.id);
  assert.equal(row.primary_weapon, 'RANGED');

  setPrimaryWeaponPreference(db, hero.id, 'MELEE');
  row = db.prepare('SELECT primary_weapon FROM characters WHERE id = ?').get(hero.id);
  assert.equal(row.primary_weapon, 'MELEE');
});

test('1.6 In-Combat Lock: cannot change primary weapon or equip/unequip gear while IN_COMBAT', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'CombatLockedHero', 'FIGHTER');
  const tile = getTileByCoords(db, 7, 5);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero.id);

  // Put hero in combat
  const enc = checkTileEncounter(db, hero, tile, { rng: () => 0.01 });
  db.prepare("UPDATE encounters SET status = 'IN_COMBAT' WHERE id = ?").run(enc.id);

  // Attempting to switch primary weapon must throw error
  assert.throws(() => {
    setPrimaryWeaponPreference(db, hero.id, 'RANGED');
  }, /combat/i);

  // Attempting to equip or unequip gear must throw error
  const equipment = getCharacterEquipment(db, hero.id);
  assert.throws(() => {
    unequipItem(db, hero.id, equipment.shield.id);
  }, /combat/i);
});

test('1.7 Safe Fallback: if preferred weapon is unequipped, safely fall back to remaining weapon', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'FallbackHero', 'RANGER');
  const equipment = getCharacterEquipment(db, hero.id);
  setPrimaryWeaponPreference(db, hero.id, 'RANGED');

  // Unequip ranged weapon
  unequipItem(db, hero.id, equipment.rangedWeapon.id);
  const refreshedEquip = getCharacterEquipment(db, hero.id);
  assert.equal(refreshedEquip.rangedWeapon, null);

  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  const active = getActiveWeapon(refreshedHero, refreshedEquip, { is_flying: 0 });

  // Safe fallback to melee weapon
  assert.equal(active.isRangedActive, false);
  assert.ok(active.activeWeapon, 'Should have fell back to melee weapon');
});

// =============================================================================
// 2. RANGER OPENING SHOT
// =============================================================================

test('2.1 Ranger Opening Shot: fires once when Ranger spots enemy and initiates combat', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'SniperRanger', 'RANGER');
  const tile = getTileByCoords(db, 7, 5);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero.id);

  // Hero spots enemy first (spottedByHero = 1, isAmbush = 0)
  const encounter = checkTileEncounter(db, hero, tile, {
    rng: () => 0.01,
    spottedByHero: 1,
    isAmbush: 0
  });

  // Ensure monster has high HP so it survives the opening shot
  db.prepare('UPDATE encounters SET current_monster_hp = 50 WHERE id = ?').run(encounter.id);

  // Initiate combat: Ranger hits with high roll (nat 18 on d20)
  const result = startCombat(db, hero.id, encounter.id, hero.class, {
    rng: createRngSequence([0.9, 0.5])
  });

  assert.equal(result.openingShotFired, true);
  assert.equal(result.encounter.status, 'IN_COMBAT');

  // Check combat state logs OPENING_SHOT event
  const state = getCombatState(db, hero.id, encounter.id);
  const openingEvent = state.events.find(e => e.event_type === 'OPENING_SHOT');
  assert.ok(openingEvent, 'Combat log must contain an OPENING_SHOT event');
  assert.ok(openingEvent.public_text.includes('Opening Shot') || openingEvent.public_text.includes('draws a bead'));
});

test('2.2 Ranger Opening Shot: blocked when monster ambushes hero', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'AmbushedRanger', 'RANGER');
  const tile = getTileByCoords(db, 7, 5);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero.id);

  const encounter = checkTileEncounter(db, hero, tile, {
    rng: () => 0.01,
    spottedByHero: 0,
    isAmbush: 1
  });

  const result = startCombat(db, hero.id, encounter.id, hero.class, {
    rng: createRngSequence([0.9, 0.5])
  });

  assert.equal(result.openingShotFired, false, 'Ambushed ranger must NOT get an opening shot');
  const state = getCombatState(db, hero.id, encounter.id);
  const openingEvent = state.events.find(e => e.event_type === 'OPENING_SHOT');
  assert.equal(openingEvent, undefined, 'No OPENING_SHOT event logged on ambush');
});

test('2.3 Ranger Opening Shot: blocked when Ranger has no ranged weapon equipped', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'UnarmedRanger', 'RANGER');
  const tile = getTileByCoords(db, 7, 5);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero.id);

  // Unequip ranged weapon
  const equip = getCharacterEquipment(db, hero.id);
  unequipItem(db, hero.id, equip.rangedWeapon.id);

  const encounter = checkTileEncounter(db, hero, tile, {
    rng: () => 0.01,
    spottedByHero: 1,
    isAmbush: 0
  });

  const result = startCombat(db, hero.id, encounter.id, hero.class, {
    rng: createRngSequence([0.9, 0.5])
  });

  assert.equal(result.openingShotFired, false, 'Ranger without ranged weapon must NOT get opening shot');
});

test('2.4 Ranger Opening Shot: Fighter and Cleric do NOT get Opening Shot', async () => {
  const db = createTestDb();
  const tile = getTileByCoords(db, 7, 5);

  // Fighter test
  const { hero: fighter } = await setupTestHero(db, 'FighterHeroShot', 'FIGHTER');
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, fighter.id);
  const encF = checkTileEncounter(db, fighter, tile, { rng: () => 0.01, spottedByHero: 1, isAmbush: 0 });
  const resF = startCombat(db, fighter.id, encF.id, fighter.class, { rng: createRngSequence([0.9, 0.5]) });
  assert.equal(resF.openingShotFired, false, 'Fighter must not get Opening Shot');

  // Cleric test
  const { hero: cleric } = await setupTestHero(db, 'ClericHeroShot', 'CLERIC');
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, cleric.id);
  const encC = checkTileEncounter(db, cleric, tile, { rng: () => 0.01, spottedByHero: 1, isAmbush: 0 });
  const resC = startCombat(db, cleric.id, encC.id, cleric.class, { rng: createRngSequence([0.9, 0.5]) });
  assert.equal(resC.openingShotFired, false, 'Cleric must not get Opening Shot');
});

test('2.5 Ranger Opening Shot: can miss and logs miss narrative', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'MissRanger', 'RANGER');
  const tile = getTileByCoords(db, 7, 5);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero.id);

  const encounter = checkTileEncounter(db, hero, tile, {
    rng: () => 0.01,
    spottedByHero: 1,
    isAmbush: 0
  });

  // Roll natural 1 (0.01) -> automatic miss
  const result = startCombat(db, hero.id, encounter.id, hero.class, {
    rng: createRngSequence([0.01, 0.5])
  });

  assert.equal(result.openingShotFired, true);
  assert.equal(result.openingShotHit, false);
  const state = getCombatState(db, hero.id, encounter.id);
  const ev = state.events.find(e => e.event_type === 'OPENING_SHOT');
  assert.ok(ev);
  assert.ok(ev.public_text.includes('FUMBLE') || ev.public_text.includes('astray') || ev.public_text.includes('dodges') || ev.public_text.includes('misses'));
});

test('2.6 Ranger Opening Shot: critical hits double damage dice', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'CritRanger', 'RANGER');
  const tile = getTileByCoords(db, 7, 5);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero.id);

  const encounter = checkTileEncounter(db, hero, tile, {
    rng: () => 0.01,
    spottedByHero: 1,
    isAmbush: 0
  });
  db.prepare('UPDATE encounters SET current_monster_hp = 100 WHERE id = ?').run(encounter.id);

  // Roll nat 20 (0.999) -> critical hit!
  // RNG: [d20=0.999 (nat 20), d8=0.99 (8), crit d8=0.99 (8)]
  const result = startCombat(db, hero.id, encounter.id, hero.class, {
    rng: createRngSequence([0.999, 0.99, 0.99])
  });

  assert.equal(result.openingShotFired, true);
  assert.equal(result.openingShotCrit, true);
  const state = getCombatState(db, hero.id, encounter.id);
  const ev = state.events.find(e => e.event_type === 'OPENING_SHOT');
  assert.ok(/CRITICAL/i.test(ev.public_text));
});

test('2.7 Ranger Opening Shot: Favored Enemy applies to legal type and strictly 0 vs Undead', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'FavEnemyRanger', 'RANGER', {
    favoredEnemyType: 'BEAST'
  });

  // Legal type: Level 1 provides +1/+1
  const beastMonster = { creature_type: 'BEAST' };
  const bonusBeast = getRangerFavoredEnemyBonus(hero, beastMonster);
  assert.equal(bonusBeast.attack, 1);
  assert.equal(bonusBeast.damage, 1);

  // Level 5 provides +2/+2
  const level5Hero = { ...hero, level: 5 };
  const bonusBeastLvl5 = getRangerFavoredEnemyBonus(level5Hero, beastMonster);
  assert.equal(bonusBeastLvl5.attack, 2);
  assert.equal(bonusBeastLvl5.damage, 2);

  // Illegal Undead type
  const undeadMonster = { creature_type: 'UNDEAD' };
  const bonusUndead = getRangerFavoredEnemyBonus(hero, undeadMonster);
  assert.equal(bonusUndead.attack, 0, 'Ranger must never receive Favored Enemy attack bonus vs Undead');
  assert.equal(bonusUndead.damage, 0, 'Ranger must never receive Favored Enemy damage bonus vs Undead');

  // Even if character somehow had favored_enemy_type = 'UNDEAD' in DB
  const corruptedHero = { ...hero, favored_enemy_type: 'UNDEAD' };
  const corruptedBonus = getRangerFavoredEnemyBonus(corruptedHero, undeadMonster);
  assert.equal(corruptedBonus.attack, 0);
  assert.equal(corruptedBonus.damage, 0);
});

test('2.8 Ranger Opening Shot: lethal hit completes victory with XP and loot', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'LethalSniper', 'RANGER');
  const tile = getTileByCoords(db, 7, 5);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero.id);

  const encounter = checkTileEncounter(db, hero, tile, {
    rng: () => 0.01,
    spottedByHero: 1,
    isAmbush: 0
  });

  // Set monster HP low so opening shot kills it
  db.prepare('UPDATE encounters SET current_monster_hp = 2 WHERE id = ?').run(encounter.id);

  const startXp = hero.xp;
  const result = startCombat(db, hero.id, encounter.id, hero.class, {
    rng: createRngSequence([0.9, 0.9]) // Nat 19 hit, max damage
  });

  assert.equal(result.openingShotFired, true);
  assert.equal(result.encounter.status, 'VICTORY');

  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.ok(refreshedHero.xp > startXp, 'Hero must be awarded XP from opening shot victory');
});

test('2.9 Ranger Opening Shot Idempotency: cannot fire twice on same encounter', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'IdempotentRanger', 'RANGER');
  const tile = getTileByCoords(db, 7, 5);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero.id);

  const encounter = checkTileEncounter(db, hero, tile, {
    rng: () => 0.01,
    spottedByHero: 1,
    isAmbush: 0
  });
  db.prepare('UPDATE encounters SET current_monster_hp = 50 WHERE id = ?').run(encounter.id);

  // First call fires opening shot
  const res1 = startCombat(db, hero.id, encounter.id, hero.class, { rng: createRngSequence([0.9, 0.5]) });
  assert.equal(res1.openingShotFired, true);

  // Repeated call (e.g. reload or duplicate HTTP request)
  const res2 = startCombat(db, hero.id, encounter.id, hero.class, { rng: createRngSequence([0.9, 0.5]) });
  assert.equal(res2.openingShotFired, false, 'Opening shot must NOT fire a second time');
});

// =============================================================================
// 3. CLERIC HOLY RADIANCE
// =============================================================================

test('3.1 Cleric Holy Radiance: Level 1, 4, 5, 8, 9 attack, damage, and AC scaling vs Undead', async () => {
  const undead = { creature_type: 'UNDEAD' };

  // Level 1-4: +2 Attack, +3 Damage, +2 AC
  const l1 = getClericHolyRadianceBonus('CLERIC', 1, undead);
  assert.deepEqual(l1, { attack: 2, damage: 3, ac: 2 });
  const l4 = getClericHolyRadianceBonus('CLERIC', 4, undead);
  assert.deepEqual(l4, { attack: 2, damage: 3, ac: 2 });

  // Level 5-8: +3 Attack, +4 Damage, +3 AC
  const l5 = getClericHolyRadianceBonus('CLERIC', 5, undead);
  assert.deepEqual(l5, { attack: 3, damage: 4, ac: 3 });
  const l8 = getClericHolyRadianceBonus('CLERIC', 8, undead);
  assert.deepEqual(l8, { attack: 3, damage: 4, ac: 3 });

  // Level 9+: +4 Attack, +5 Damage, +4 AC
  const l9 = getClericHolyRadianceBonus('CLERIC', 9, undead);
  assert.deepEqual(l9, { attack: 4, damage: 5, ac: 4 });
  const l12 = getClericHolyRadianceBonus('CLERIC', 12, undead);
  assert.deepEqual(l12, { attack: 4, damage: 5, ac: 4 });
});

test('3.2 Cleric Holy Radiance: Zero bonuses against Non-Undead creatures', async () => {
  const nonUndeadTypes = ['BEAST', 'HUMANOID', 'MONSTROSITY', 'DRAGON', 'FIEND', 'ABERRATION'];
  for (const t of nonUndeadTypes) {
    const bonus = getClericHolyRadianceBonus('CLERIC', 5, { creature_type: t });
    assert.deepEqual(bonus, { attack: 0, damage: 0, ac: 0 }, `Must give 0 bonus vs ${t}`);
  }
});

test('3.3 Cleric Holy Radiance: AC bonus is a sacred defense and applies with ranged weapons', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'HolyRadiantCleric', 'CLERIC');
  const equipment = getCharacterEquipment(db, hero.id);
  const undead = { creature_type: 'UNDEAD' };
  const beast = { creature_type: 'BEAST' };

  // Cleric using melee vs Beast
  const acMeleeBeast = calculateHeroAC(hero, equipment.armor, equipment.shield, false, beast);
  // Cleric using melee vs Undead (+2 sacred AC)
  const acMeleeUndead = calculateHeroAC(hero, equipment.armor, equipment.shield, false, undead);
  assert.equal(acMeleeUndead, acMeleeBeast + 2, 'Melee AC vs Undead must include +2 sacred defense');

  // Cleric using ranged vs Beast (shield dropped)
  const acRangedBeast = calculateHeroAC(hero, equipment.armor, equipment.shield, true, beast);
  // Cleric using ranged vs Undead: shield is 0, but +2 Holy Radiance sacred AC STILL APPLIES!
  const acRangedUndead = calculateHeroAC(hero, equipment.armor, equipment.shield, true, undead);
  assert.equal(acRangedUndead, acRangedBeast + 2, 'Ranged AC vs Undead must retain +2 sacred defense');
});

test('3.4 Cleric Holy Radiance: Self-healing remains fully functional', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'HealCleric', 'CLERIC');
  db.prepare('UPDATE characters SET current_hp = 5 WHERE id = ?').run(hero.id);

  const initialUses = getClericRemainingHealUses(hero);
  assert.ok(initialUses > 0);

  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  const healResult = performClericSelfHeal(db, refreshedHero.id);

  assert.ok(healResult.healed > 0);
  assert.ok(healResult.currentHp > 5);
  assert.equal(healResult.remainingUses, initialUses - 1);
});

// =============================================================================
// 4. CITY SAFETY & CR GATING
// =============================================================================

test('4.1 City Safety: Safe City tile never generates random encounters', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'TownDweller', 'FIGHTER');
  const cityTile = getTileByCoords(db, 7, 7); // Oakhaven safe city
  assert.equal(cityTile.terrain, 'CITY');
  assert.equal(cityTile.is_safe, 1);

  // Forced 100% encounter roll (rng = 0.001)
  const encounter = checkTileEncounter(db, hero, cityTile, { rng: () => 0.001 });
  assert.equal(encounter, null, 'Safe city must NEVER spawn random encounters');
});

test('4.2 City Safety: Distance calculation respects impassable terrain', async () => {
  const db = createTestDb();

  // (7,7) is safe city -> distance 0
  const d0 = getDistanceToNearestSafeCity(db, getTileByCoords(db, 7, 7));
  assert.equal(d0, 0);

  // (7,6) is 1 tile away
  const d1 = getDistanceToNearestSafeCity(db, getTileByCoords(db, 7, 6));
  assert.equal(d1, 1);

  // (7,5) is 2 tiles away
  const d2 = getDistanceToNearestSafeCity(db, getTileByCoords(db, 7, 5));
  assert.equal(d2, 2);

  // (7,4) is 3 tiles away
  const d3 = getDistanceToNearestSafeCity(db, getTileByCoords(db, 7, 4));
  assert.equal(d3, 3);

  // (7,3) is 4 tiles away
  const d4 = getDistanceToNearestSafeCity(db, getTileByCoords(db, 7, 3));
  assert.equal(d4, 4);
});

test('4.3 City Safety: CR caps strictly scale by distance', async () => {
  assert.equal(getMaxCrForDistance(0), 0);
  assert.ok(Math.abs(getMaxCrForDistance(1) - 1/3) < 0.01);
  assert.equal(getMaxCrForDistance(2), 0.5);
  assert.equal(getMaxCrForDistance(3), 1.0);
  assert.equal(getMaxCrForDistance(4), null);
  assert.equal(getMaxCrForDistance(10), null);
});

test('4.4 City Safety: Encounters at distance 1 never exceed CR 1/3', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'Zone1Hero', 'FIGHTER');
  const tileDist1 = getTileByCoords(db, 7, 6); // Distance 1

  for (let i = 0; i < 20; i++) {
    const enc = checkTileEncounter(db, hero, tileDist1, {
      rng: () => 0.01,
      monsterRng: () => Math.random()
    });
    if (enc) {
      const monster = db.prepare('SELECT challenge_rating FROM monsters WHERE id = ?').get(enc.monster_id);
      assert.ok(monster.challenge_rating <= 0.34, `Monster CR ${monster.challenge_rating} must be <= 1/3 at distance 1`);
      // Clean up encounter
      db.prepare('DELETE FROM encounters WHERE id = ?').run(enc.id);
    }
  }
});

test('4.5 City Safety: Encounters at distance 2 never exceed CR 1/2', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'Zone2Hero', 'FIGHTER');
  const tileDist2 = getTileByCoords(db, 7, 5); // Distance 2

  for (let i = 0; i < 20; i++) {
    const enc = checkTileEncounter(db, hero, tileDist2, {
      rng: () => 0.01,
      monsterRng: () => Math.random()
    });
    if (enc) {
      const monster = db.prepare('SELECT challenge_rating FROM monsters WHERE id = ?').get(enc.monster_id);
      assert.ok(monster.challenge_rating <= 0.51, `Monster CR ${monster.challenge_rating} must be <= 1/2 at distance 2`);
      db.prepare('DELETE FROM encounters WHERE id = ?').run(enc.id);
    }
  }
});

test('4.6 City Safety: Encounters at distance 3 never exceed CR 1', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'Zone3Hero', 'FIGHTER');
  const tileDist3 = getTileByCoords(db, 7, 4); // Distance 3

  for (let i = 0; i < 20; i++) {
    const enc = checkTileEncounter(db, hero, tileDist3, {
      rng: () => 0.01,
      monsterRng: () => Math.random()
    });
    if (enc) {
      const monster = db.prepare('SELECT challenge_rating FROM monsters WHERE id = ?').get(enc.monster_id);
      assert.ok(monster.challenge_rating <= 1.01, `Monster CR ${monster.challenge_rating} must be <= 1.0 at distance 3`);
      db.prepare('DELETE FROM encounters WHERE id = ?').run(enc.id);
    }
  }
});

test('4.7 City Safety: Persistent monsters ignore CR caps and preserve position, stats, and loot', async () => {
  const db = createTestDb();
  const { hero } = await setupTestHero(db, 'PersistentVictim', 'FIGHTER');
  const wildTileDist2 = getTileByCoords(db, 7, 5); // Distance 2 from city, wild forest (is_safe = 0, max CR = 0.5)
  assert.equal(wildTileDist2.is_safe, 0);
  assert.equal(getDistanceToNearestSafeCity(db, wildTileDist2), 2);
  assert.equal(getMaxCrForDistance(2), 0.5);

  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(wildTileDist2.id, hero.id);

  // Spawn an explicit high CR persistent monster (e.g. CR 5 Troll) on this tile
  const troll = db.prepare("SELECT * FROM monsters WHERE name LIKE '%Troll%' LIMIT 1").get();
  assert.ok(troll, 'Troll exists in database');
  assert.ok(troll.challenge_rating >= 5, 'Troll has CR 5 > 0.5');

  // Insert persistent monster instance
  const insertPM = db.prepare(`
    INSERT INTO monster_instances (
      tile_id, monster_id, current_hp, max_hp, kill_count, held_gold, custom_title, status
    ) VALUES (?, ?, 60, 60, 1, 150, 'Scourge of the Forest Gate', 'ACTIVE')
  `);
  insertPM.run(wildTileDist2.id, troll.id);

  // New hero enters tile 7,5
  const { hero: newHero } = await setupTestHero(db, 'NewInvestigator', 'RANGER');
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(wildTileDist2.id, newHero.id);

  // Encounter must directly engage the persistent Troll despite being in a CR <= 0.5 zone
  const enc = checkTileEncounter(db, newHero, wildTileDist2, { rng: () => 0.01 });
  assert.ok(enc, 'Encounter generated');
  assert.equal(enc.monster_id, troll.id, 'Must encounter the persistent Troll despite distance 2 CR 0.5 cap');
  assert.equal(enc.current_monster_hp, 60);
});
