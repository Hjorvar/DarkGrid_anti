const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../src/domain/auth/service');
const {
  createCharacter,
  getLivingCharacterByUserId,
  getCharacterEquipment,
  getCharacterInventory,
  getCharacterPotionCount,
  equipItem,
  unequipItem,
  performClericSelfHeal,
  performCityRest,
  getClericRemainingHealUses,
  getClericSelfHealInfo,
  getFighterWeaponTraining,
  getFighterArmorTrainingMaxDexBonus,
  getRangerFavoredEnemyBonus,
  getClericDivinePowerBonus,
  getLevelForXp,
  getXpForNextLevel
} = require('../src/domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus
} = require('../src/domain/combat/rules');
const {
  getCityStoreStock,
  buyItem,
  sellItem
} = require('../src/domain/economy/shop');
const {
  calculateMonsterGold,
  getMagicDropChance,
  TREASURE_CHANCES
} = require('../src/domain/combat/loot');
const {
  startCombat,
  executeCombatRound
} = require('../src/domain/combat/engine');

test('1. Character creation grants authentic starting equipment and prepared slots', async () => {
  const db = createTestDb();
  const userF = await registerUser(db, 'FighterUser', 'pass1234');
  const userR = await registerUser(db, 'RangerUser', 'pass1234');
  const userC = await registerUser(db, 'ClericUser', 'pass1234');

  // Fighter
  const fighter = createCharacter(db, {
    userId: userF.id,
    name: 'Sir Galahad',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 },
    startingGold: 10
  });
  const eqF = getCharacterEquipment(db, fighter.id);
  assert.equal(eqF.meleeWeapon.name, 'Longsword');
  assert.equal(eqF.rangedWeapon.name, 'Shortbow');
  assert.equal(eqF.armor.name, 'Chain Shirt');
  assert.equal(eqF.shield.name, 'Light Steel Shield');
  assert.equal(getCharacterPotionCount(db, fighter.id), 2);
  assert.equal(fighter.gold, 10);

  // Ranger (with Favored Enemy)
  const ranger = createCharacter(db, {
    userId: userR.id,
    name: 'Robin',
    classType: 'RANGER',
    stats: { strength: 12, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 9 },
    startingGold: 10,
    favoredEnemyType: 'HUMANOID',
    favoredEnemySubtype: 'goblinoid'
  });
  const eqR = getCharacterEquipment(db, ranger.id);
  assert.equal(eqR.meleeWeapon.name, 'Shortsword');
  assert.equal(eqR.rangedWeapon.name, 'Longbow');
  assert.equal(eqR.armor.name, 'Leather Armor');
  assert.equal(eqR.shield, null);
  assert.equal(getCharacterPotionCount(db, ranger.id), 2);
  assert.equal(ranger.favored_enemy_type, 'HUMANOID');
  assert.equal(ranger.favored_enemy_subtype, 'goblinoid');

  // Cleric
  const cleric = createCharacter(db, {
    userId: userC.id,
    name: 'Brother Tuck',
    classType: 'CLERIC',
    stats: { strength: 12, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 11 },
    startingGold: 10
  });
  const eqC = getCharacterEquipment(db, cleric.id);
  assert.equal(eqC.meleeWeapon.name, 'Heavy Mace');
  assert.equal(eqC.rangedWeapon.name, 'Sling');
  assert.equal(eqC.armor.name, 'Scale Mail');
  assert.equal(eqC.shield.name, 'Light Steel Shield');
  assert.equal(getCharacterPotionCount(db, cleric.id), 2);
});

test('2. Ranger Favored Enemy validation rejects Undead and bare Humanoid', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'RangerValidator', 'pass1234');

  // Reject Undead
  assert.throws(() => {
    createCharacter(db, {
      userId: user.id,
      name: 'UndeadHunter',
      classType: 'RANGER',
      stats: { strength: 12, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 9 },
      favoredEnemyType: 'UNDEAD'
    });
  }, /Undead is not permitted as a Favored Enemy/i);

  // Reject Humanoid without subtype
  assert.throws(() => {
    createCharacter(db, {
      userId: user.id,
      name: 'HumanoidHunter',
      classType: 'RANGER',
      stats: { strength: 12, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 9 },
      favoredEnemyType: 'HUMANOID',
      favoredEnemySubtype: ''
    });
  }, /Humanoid Favored Enemy requires a subtype/i);
});

test('3. Town Shop: Buy and sell standard equipment with 50% resale liquidation', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'TraderHero', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'MerchantKnight',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 },
    startingGold: 50
  });

  // Verify stock
  const stock = getCityStoreStock(db);
  assert.ok(stock.standardItems.length > 30, 'Store must offer comprehensive standard catalog');
  const daggerDef = stock.standardItems.find(i => i.name === 'Dagger');
  assert.ok(daggerDef);
  assert.equal(daggerDef.buy_price, 2);

  // Buy Dagger
  const buyRes = buyItem(db, hero.id, { itemDefinitionId: daggerDef.id });
  assert.equal(buyRes.success, true);
  assert.equal(buyRes.purchasedItem.name, 'Dagger');
  assert.equal(buyRes.remainingGold, 48);

  const heroAfterBuy = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id);
  assert.equal(heroAfterBuy.gold, 48);

  // Sell Dagger from backpack (Buy price 2 gp -> 50% is 1 gp)
  const sellRes = sellItem(db, hero.id, buyRes.purchasedItem.instanceId);
  assert.equal(sellRes.success, true);
  assert.equal(sellRes.goldEarned, 1);
  assert.equal(sellRes.totalGold, 49);

  const heroAfterSell = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id);
  assert.equal(heroAfterSell.gold, 49);

  // Rejection when attempting to sell equipped items
  const eq = getCharacterEquipment(db, hero.id);
  assert.throws(() => {
    sellItem(db, hero.id, eq.meleeWeapon.id);
  }, /Cannot sell equipped gear/i);
});

test('4. Safe Haven Rest: Fully restores HP and recharges Cleric self-healing', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'RestingCleric', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Father Paul',
    classType: 'CLERIC',
    stats: { strength: 12, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 11 }
  });

  // Damage hero and use a cleric charge
  db.prepare('UPDATE characters SET current_hp = 3, cleric_heal_uses = 2 WHERE id = ?').run(hero.id);

  const heroDamaged = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(heroDamaged.current_hp, 3);
  assert.equal(heroDamaged.cleric_heal_uses, 2);

  // Perform sanctuary rest
  const restRes = performCityRest(db, hero.id);
  assert.equal(restRes.currentHp, hero.max_hp);
  assert.equal(restRes.clericHealUses, 0);

  const heroRested = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(heroRested.current_hp, hero.max_hp);
  assert.equal(heroRested.cleric_heal_uses, 0);
});

test('5. Combat dynamic weapon selection: Flying monster respects weapon preference and preserves shield AC in melee', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'TacticalFighter', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'ShieldBearer',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 }
  });

  const eq = getCharacterEquipment(db, hero.id);
  // Normal grounded melee AC: 10 + Chain Shirt (4) + Shield (1) + DEX (1) = 16
  const meleeAc = calculateHeroAC(hero, eq, false);
  assert.equal(meleeAc, 16);

  // Ranged AC: Shield is excluded! 10 + Chain Shirt (4) + DEX (1) = 15
  const rangedAc = calculateHeroAC(hero, eq, true);
  assert.equal(rangedAc, 15);

  // Start combat against a flying monster (Stirge) with default MELEE preference
  const stirge = db.prepare("SELECT * FROM monsters WHERE name = 'Stirge'").get();
  assert.equal(stirge.movement_type, 'FLY');

  const encounterRes = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
    VALUES (?, 1, ?, 'IN_COMBAT', ?)
  `).run(hero.id, stirge.id, stirge.base_hp);

  const encounterId = Number(encounterRes.lastInsertRowid);
  const combatState = startCombat(db, hero.id, encounterId);

  // Fighter with MELEE preference keeps Longsword and full 16 AC (including shield) against flying monster
  assert.equal(combatState.activeWeapon.weapon_range_type, 'MELEE');
  assert.equal(combatState.activeWeapon.name, 'Longsword');
  assert.equal(combatState.heroAC, 16);
});

test('6. Class abilities: Fighter Weapon/Armor Training, Ranger Favored Enemy, Cleric Divine Power', () => {
  // Fighter Weapon Training
  assert.deepEqual(getFighterWeaponTraining(1), { attack: 0, damage: 0 });
  assert.deepEqual(getFighterWeaponTraining(4), { attack: 0, damage: 0 });
  assert.deepEqual(getFighterWeaponTraining(5), { attack: 1, damage: 1 });
  assert.deepEqual(getFighterWeaponTraining(8), { attack: 1, damage: 1 });
  assert.deepEqual(getFighterWeaponTraining(9), { attack: 2, damage: 2 });

  // Fighter Armor Training Max DEX
  assert.equal(getFighterArmorTrainingMaxDexBonus(1), 0);
  assert.equal(getFighterArmorTrainingMaxDexBonus(3), 1);
  assert.equal(getFighterArmorTrainingMaxDexBonus(6), 1);
  assert.equal(getFighterArmorTrainingMaxDexBonus(7), 2);

  // Ranger Favored Enemy
  const rangerHero = { class: 'RANGER', level: 5, favored_enemy_type: 'HUMANOID', favored_enemy_subtype: 'goblinoid' };
  const goblin = { creature_type: 'Humanoid', creature_subtype: 'goblinoid' };
  const wolf = { creature_type: 'Animal', creature_subtype: null };
  assert.deepEqual(getRangerFavoredEnemyBonus(rangerHero, goblin), { attack: 2, damage: 2 });
  assert.deepEqual(getRangerFavoredEnemyBonus(rangerHero, wolf), { attack: 0, damage: 0 });

  // Cleric Holy Radiance (upgraded from Divine Power)
  assert.deepEqual(getClericDivinePowerBonus('CLERIC', 1, { creature_type: 'Undead' }), { attack: 2, damage: 3, ac: 2 });
  assert.deepEqual(getClericDivinePowerBonus('CLERIC', 5, { creature_type: 'Undead' }), { attack: 3, damage: 4, ac: 3 });
  assert.deepEqual(getClericDivinePowerBonus('CLERIC', 9, { creature_type: 'Undead' }), { attack: 4, damage: 5, ac: 4 });
  assert.deepEqual(getClericDivinePowerBonus('CLERIC', 5, { creature_type: 'Animal' }), { attack: 0, damage: 0, ac: 0 });
  assert.deepEqual(getClericDivinePowerBonus('FIGHTER', 5, { creature_type: 'Undead' }), { attack: 0, damage: 0, ac: 0 });
});

test('7. Cleric out-of-combat self-healing: rolls dice, respects caps, enforces cooldowns', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'HealerUser', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'HolyHealer',
    classType: 'CLERIC',
    stats: { strength: 12, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 11 }
  });

  // At Level 1, max charges = 2, dice = 1d6
  const healInfo = getClericSelfHealInfo(hero.level);
  assert.equal(healInfo.maxUses, 2);
  assert.equal(healInfo.diceCount, 1);

  // Damage hero: 9 Max HP -> down to 2 HP
  db.prepare('UPDATE characters SET current_hp = 2 WHERE id = ?').run(hero.id);

  // First heal (WIS mod +3)
  const heal1 = performClericSelfHeal(db, hero.id, () => 4); // rolled 4 + 3 = 7 healed -> 2 + 7 = 9 HP
  assert.equal(heal1.healed, 7);
  assert.equal(heal1.currentHp, 9);
  assert.equal(heal1.remainingUses, 1);

  // Damage hero again: down to 5 HP
  db.prepare('UPDATE characters SET current_hp = 5 WHERE id = ?').run(hero.id);

  // Second heal (rolls 5 + 3 = 8 healed, but capped at 9 Max HP!)
  const heal2 = performClericSelfHeal(db, hero.id, () => 5);
  assert.equal(heal2.currentHp, 9);
  assert.equal(heal2.healed, 4); // only 4 needed to hit max
  assert.equal(heal2.remainingUses, 0);

  // Third heal attempt: rejected because 0 uses remain!
  db.prepare('UPDATE characters SET current_hp = 3 WHERE id = ?').run(hero.id);
  assert.throws(() => {
    performClericSelfHeal(db, hero.id);
  }, /exhausted your Self-Healing uses/i);
});

test('8. Automatic Level-up: Current HP and Max HP increase equally without free full heal', () => {
  assert.equal(getLevelForXp(0), 1);
  assert.equal(getLevelForXp(1299), 1);
  assert.equal(getLevelForXp(1300), 2);
  assert.equal(getLevelForXp(3300), 3);
  assert.equal(getLevelForXp(10000), 5);
  assert.equal(getLevelForXp(71000), 10);
});

test('9. Magic item resale and global market circulation between players', async () => {
  const db = createTestDb();
  const user1 = await registerUser(db, 'PlayerOne', 'pass1234');
  const user2 = await registerUser(db, 'PlayerTwo', 'pass1234');

  const hero1 = createCharacter(db, {
    userId: user1.id,
    name: 'HeroOne',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 },
    startingGold: 10
  });

  const hero2 = createCharacter(db, {
    userId: user2.id,
    name: 'HeroTwo',
    classType: 'RANGER',
    stats: { strength: 12, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 9 },
    startingGold: 5000 // wealthy buyer
  });

  // Give Hero 1 a magical Longsword +1 (buy_price = 2315 gp) in backpack
  const magicSwordDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Longsword +1'").get();
  assert.ok(magicSwordDef);
  assert.equal(magicSwordDef.is_magical, 1);

  const instRes = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, NULL)
  `).run(magicSwordDef.id, hero1.id);
  const swordInstanceId = Number(instRes.lastInsertRowid);

  // Hero 1 sells the Longsword +1 at town shop:
  // Payout is 40% of 2315 gp = 926 gp.
  // Item moves to MARKET listings at 125% of 2315 gp = 2894 gp.
  const sellResult = sellItem(db, hero1.id, swordInstanceId);
  assert.equal(sellResult.success, true);
  assert.equal(sellResult.goldEarned, 926);
  assert.equal(sellResult.movedToMarket, true);
  assert.equal(sellResult.resalePrice, 2894);

  const hero1AfterSell = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero1.id);
  assert.equal(hero1AfterSell.gold, 10 + 926);

  // Hero 2 visits market in safe city: sees the Longsword +1 listing!
  const stockHero2 = getCityStoreStock(db);
  const listing = stockHero2.resaleListings.find(l => l.name === 'Longsword +1');
  assert.ok(listing, 'Resale listing must appear in global city market');
  assert.equal(listing.resale_price, 2894);

  // Hero 2 buys the listing
  const buyMarketRes = buyItem(db, hero2.id, { listingId: listing.listing_id });
  assert.equal(buyMarketRes.success, true);
  assert.equal(buyMarketRes.purchasedItem.name, 'Longsword +1');

  // Verify item now in Hero 2 possession
  const hero2Inventory = getCharacterInventory(db, hero2.id);
  assert.ok(hero2Inventory.some(i => i.id === swordInstanceId));

  // Verify listing is no longer active in the global market
  const stockAfterPurchase = getCityStoreStock(db);
  const listingGone = stockAfterPurchase.resaleListings.find(l => l.name === 'Longsword +1');
  assert.equal(listingGone, undefined, 'Purchased resale item must disappear immediately');
});

test('10. Permadeath with 50% gold and item transfer to Persistent Monster, and recovery by victor', async () => {
  const db = createTestDb();
  const userVictim = await registerUser(db, 'VictimUser', 'pass1234');
  const userVictor = await registerUser(db, 'VictorUser', 'pass1234');

  const victim = createCharacter(db, {
    userId: userVictim.id,
    name: 'UnfortunateHero',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 },
    startingGold: 100
  });

  const victor = createCharacter(db, {
    userId: userVictor.id,
    name: 'AvengingHero',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 },
    startingGold: 10
  });

  // Victim moves to wilderness tile and encounters an Ogre (CR 3, 59 HP)
  const ogre = db.prepare("SELECT * FROM monsters WHERE name = 'Ogre'").get();
  const wildernessTile = db.prepare("SELECT id FROM map_tiles WHERE terrain != 'CITY' AND is_safe = 0 LIMIT 1").get();

  db.prepare('UPDATE characters SET tile_id = ?, current_hp = 1 WHERE id = ?').run(wildernessTile.id, victim.id);

  const encRes = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
    VALUES (?, ?, ?, 'IN_COMBAT', ?)
  `).run(victim.id, wildernessTile.id, ogre.id, ogre.base_hp);
  const encounterId = Number(encRes.lastInsertRowid);

  // Deterministic combat where monster rolls hit and kills victim
  const rngKill = () => 0.99; // Monster hits and rolls high damage
  const combatDeath = executeCombatRound(db, victim.id, encounterId, 'ATTACK', { rng: rngKill });

  // Victim is slain -> Permadeath triggered
  assert.equal(combatDeath.character.is_alive, 0);

  // Persistent monster spawned on tile with +10% HP boost (59 * 1.10 = 65)
  const pm = db.prepare("SELECT * FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'").get(wildernessTile.id);
  assert.ok(pm, 'Persistent monster must lock to tile');
  assert.equal(pm.current_hp, Math.ceil(ogre.base_hp * 1.10));
  assert.equal(pm.kill_count, 1);
  assert.equal(pm.held_gold, 50); // 50% of 100 gp

  // Victor hero travels to the tile and encounters the persistent monster
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(wildernessTile.id, victor.id);

  // We set persistent monster current_hp to 1 for victor to deliver killing blow
  db.prepare('UPDATE monster_instances SET current_hp = 1 WHERE id = ?').run(pm.id);

  const victorEncRes = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_instance_id)
    VALUES (?, ?, ?, 'IN_COMBAT', 1, ?)
  `).run(victor.id, wildernessTile.id, ogre.id, pm.id);
  const victorEncId = Number(victorEncRes.lastInsertRowid);

  // Victor executes killing attack (rolls Nat 20)
  const rngWin = () => 0.99;
  const combatWin = executeCombatRound(db, victor.id, victorEncId, 'ATTACK', { rng: rngWin });

  assert.equal(combatWin.encounter.status, 'VICTORY');

  // Victor claims stored gold (10 starting + 50 stored = 60 gp)
  const victorAfterWin = db.prepare('SELECT gold FROM characters WHERE id = ?').get(victor.id);
  assert.ok(victorAfterWin.gold >= 60, 'Victor must claim stored gold from persistent monster');

  // Tile is now freed
  const pmAfterDefeat = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(pm.id);
  assert.equal(pmAfterDefeat.status, 'DEFEATED');
  assert.ok(pmAfterDefeat.defeated_at !== null);
});
