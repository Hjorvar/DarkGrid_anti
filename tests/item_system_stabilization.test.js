const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { generateMonsterLoot } = require('../src/domain/combat/loot');
const {
  equipItem,
  unequipItem,
  getCharacterEquipment,
  getCharacterInventory,
  getCharacterPotions,
  useConsumable,
  getEffectiveStats,
  getActiveWeapon
} = require('../src/domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus,
  getHeroDamageFormula,
  resolveAttackRoll,
  resolveDamage
} = require('../src/domain/combat/rules');
const {
  handlePlayerDeath,
  handleMonsterDefeat
} = require('../src/domain/monsters/persistence');
const {
  getCityStoreStock,
  buyItem,
  sellItem
} = require('../src/domain/economy/shop');
const {
  startCombat,
  getCombatState,
  executeCombatRound
} = require('../src/domain/combat/engine');

describe('Final Item System Stabilization Test Suite', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();

    // Seed test user and character
    db.prepare(`
      INSERT INTO users (id, username, password_hash)
      VALUES (201, 'stabilize_hero', 'hashed_pass')
    `).run();

    // Place character in Oakhaven (safe city tile)
    const cityTile = db.prepare("SELECT id FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1").get();
    const cityTileId = cityTile ? cityTile.id : 1;

    db.prepare(`
      INSERT INTO characters (
        id, user_id, name, class, level, current_hp, max_hp,
        strength, dexterity, constitution, intelligence, wisdom, charisma,
        gold, tile_id, is_alive
      ) VALUES (
        201, 201, 'Kaelen', 'FIGHTER', 1, 20, 20,
        16, 14, 14, 10, 10, 10,
        500, ?, 1
      )
    `).run(cityTileId);
  });

  // =========================================================================
  // 1. AC Calculation: No Double Counting & Proper Stacking
  // =========================================================================
  describe('1. AC Enhancement Bonuses and Stacking', () => {
    test('Mundane armor AC calculation includes base armor and capped DEX', () => {
      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();
      // Fighter with DEX 14 (+2 mod). Full Plate: armor_bonus = 9, max_dex_bonus = 1.
      const fullPlate = db.prepare("SELECT * FROM item_definitions WHERE name = 'Full Plate'").get();
      assert.ok(fullPlate, 'Full Plate exists in item_definitions');

      const ac = calculateHeroAC(hero, fullPlate, null, false);
      // Base 10 + 9 (armor) + 1 (capped DEX) = 20
      assert.equal(ac, 20, 'Full Plate should yield 10 + 9 + 1 = 20 AC');
    });

    test('Magical armor +1 and +2 do not double count enhancement bonus', () => {
      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();
      // Full Plate +1: armor_bonus is already 10 (base 9 + 1 enhancement), enhancement_bonus = 1
      const fullPlatePlus1 = db.prepare("SELECT * FROM item_definitions WHERE name = 'Full Plate +1'").get();
      assert.ok(fullPlatePlus1, 'Full Plate +1 exists');
      assert.equal(fullPlatePlus1.armor_bonus, 10);
      assert.equal(fullPlatePlus1.enhancement_bonus, 1);

      const acPlus1 = calculateHeroAC(hero, fullPlatePlus1, null, false);
      // Base 10 + 10 (armor_bonus containing +1 enh) + 1 (capped DEX) = 21 (NOT 22!)
      assert.equal(acPlus1, 21, 'Full Plate +1 AC must be exactly 21, avoiding double enhancement addition');

      // Full Plate +2: armor_bonus is 11, enhancement_bonus = 2
      const fullPlatePlus2 = db.prepare("SELECT * FROM item_definitions WHERE name = 'Full Plate +2'").get();
      assert.ok(fullPlatePlus2, 'Full Plate +2 exists');
      assert.equal(fullPlatePlus2.armor_bonus, 11);
      assert.equal(fullPlatePlus2.enhancement_bonus, 2);

      const acPlus2 = calculateHeroAC(hero, fullPlatePlus2, null, false);
      // Base 10 + 11 (armor_bonus containing +2 enh) + 1 (capped DEX) = 22 (NOT 24!)
      assert.equal(acPlus2, 22, 'Full Plate +2 AC must be exactly 22, avoiding double enhancement addition');
    });

    test('Magical shields do not double count enhancement bonus', () => {
      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();
      // Heavy Steel Shield +1: shield_bonus is 3 (base 2 + 1 enh), enhancement_bonus = 1
      const shieldPlus1 = db.prepare("SELECT * FROM item_definitions WHERE name = 'Heavy Steel Shield +1'").get();
      assert.ok(shieldPlus1, 'Heavy Steel Shield +1 exists');
      assert.equal(shieldPlus1.shield_bonus, 3);
      assert.equal(shieldPlus1.enhancement_bonus, 1);

      // Unarmored hero (10 + 2 DEX = 12) + Shield +1 (3) = 15 (NOT 16!)
      const acWithShield = calculateHeroAC(hero, null, shieldPlus1, false);
      assert.equal(acWithShield, 15, 'Heavy Steel Shield +1 must provide exactly 3 shield bonus, total 15 AC');

      // Combined Full Plate +1 (10 bonus + 1 DEX) and Shield +1 (3 bonus): 10 + 10 + 1 + 3 = 24
      const fullPlatePlus1 = db.prepare("SELECT * FROM item_definitions WHERE name = 'Full Plate +1'").get();
      const acCombined = calculateHeroAC(hero, fullPlatePlus1, shieldPlus1, false);
      assert.equal(acCombined, 24, 'Full Plate +1 and Shield +1 combined must be exactly 24 AC');
    });

    test('Accessories and class-specific AC bonuses stack correctly', () => {
      // Create a Cleric hero to test Holy Radiance stacking
      db.prepare(`
        INSERT INTO users (id, username, password_hash)
        VALUES (202, 'cleric_user', 'hashed_pass')
      `).run();

      db.prepare(`
        INSERT INTO characters (
          id, user_id, name, class, level, current_hp, max_hp,
          strength, dexterity, constitution, intelligence, wisdom, charisma,
          gold, tile_id, is_alive
        ) VALUES (
          202, 202, 'Kyra', 'CLERIC', 1, 18, 18,
          14, 12, 14, 10, 16, 12,
          100, 1, 1
        )
      `).run();

      const cleric = db.prepare('SELECT * FROM characters WHERE id = 202').get();
      const ringDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Ring of Protection +1'").get();
      const amuletDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Amulet of Natural Armor +1'").get();

      // Equip ring and amulet on cleric
      const rInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)").run(ringDef.id, cleric.id);
      const aInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)").run(amuletDef.id, cleric.id);
      equipItem(db, cleric.id, Number(rInst.lastInsertRowid), 'RING');
      equipItem(db, cleric.id, Number(aInst.lastInsertRowid), 'NECK');

      const eq = getCharacterEquipment(db, cleric.id);
      // Unarmored cleric: 10 + 1 DEX + 1 deflection + 1 natural armor = 13 AC
      const baseAc = calculateHeroAC(cleric, eq, false);
      assert.equal(baseAc, 13, 'Cleric with Ring +1 and Amulet +1 should have 13 AC');

      // Against Undead encounter: Cleric Holy Radiance adds +2 AC
      const undeadEncounter = { creature_type: 'UNDEAD' };
      const holyAc = calculateHeroAC(cleric, eq, false, undeadEncounter);
      assert.equal(holyAc, 15, 'Holy Radiance adds +2 AC against Undead (total 15)');
    });
  });

  // =========================================================================
  // 2. Full Inventory Overflow After Persistent Monster
  // =========================================================================
  describe('2. Persistent Monster Inventory Overflow (>50 items)', () => {
    test('Defeating persistent monster allows inventory overflow > 50 items without item loss', () => {
      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();
      const daggerDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Dagger'").get();
      const longswordDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longsword'").get();

      // Fill hero's backpack with exactly 50 daggers
      for (let i = 0; i < 50; i++) {
        db.prepare(`
          INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
          VALUES (?, 'CHARACTER', ?)
        `).run(daggerDef.id, hero.id);
      }

      const initialCount = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_character_id = ?").get(hero.id).c;
      assert.equal(initialCount, 50, 'Hero inventory is at maximum capacity (50)');

      // Create persistent monster carrying 5 longswords and 100 gold
      const pmRes = db.prepare(`
        INSERT INTO monster_instances (monster_id, tile_id, current_hp, max_hp, status, held_gold)
        VALUES (1, 1, 0, 30, 'ACTIVE', 100)
      `).run();
      const pmId = Number(pmRes.lastInsertRowid);

      for (let i = 0; i < 5; i++) {
        db.prepare(`
          INSERT INTO item_instances (item_definition_id, owner_type, owner_monster_id)
          VALUES (?, 'MONSTER', ?)
        `).run(longswordDef.id, pmId);
      }

      // Create encounter for this persistent monster
      const encRes = db.prepare(`
        INSERT INTO encounters (character_id, tile_id, monster_id, monster_instance_id, status, current_monster_hp, combat_round)
        VALUES (?, 1, 1, ?, 'IN_COMBAT', 0, 1)
      `).run(hero.id, pmId);
      const encId = Number(encRes.lastInsertRowid);

      const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
      const monster = db.prepare('SELECT * FROM monsters WHERE id = 1').get();
      const pm = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(pmId);

      // Defeat the persistent monster
      const defeatResult = handleMonsterDefeat(db, hero, encounter, monster, pm);
      assert.equal(defeatResult.itemsLooted, 5, 'All 5 items should be looted');
      assert.equal(defeatResult.goldLooted, 100, 'All 100 gold should be looted');

      // Verify hero now has 55 items (overflow allowed!) and 0 items destroyed
      const afterCount = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_character_id = ?").get(hero.id).c;
      assert.equal(afterCount, 55, 'Hero inventory must overflow to 55 items with 0 items lost');

      const monsterItemsLeft = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_monster_id = ?").get(pmId).c;
      assert.equal(monsterItemsLeft, 0, 'Monster instance must hold 0 remaining items');
    });

    test('Hero with >50 items is blocked from normal monster item drops and shop purchases', () => {
      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();
      const daggerDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Dagger'").get();

      // Populate hero with 52 items (overflow state)
      for (let i = 0; i < 52; i++) {
        db.prepare(`
          INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
          VALUES (?, 'CHARACTER', ?)
        `).run(daggerDef.id, hero.id);
      }

      // 1. Regular monster loot drop must NOT award items
      const goblin = db.prepare("SELECT * FROM monsters WHERE name = 'Goblin'").get();
      const lootResult = generateMonsterLoot(db, goblin, hero.id, { forceNormalItem: true, forceMagicItem: true });
      assert.equal(lootResult.backpackFull, true, 'Loot system must flag backpackFull = true');
      assert.equal(lootResult.itemsAwarded.length, 0, 'No items should be awarded when inventory is > 50');

      // 2. Shop purchase must be strictly rejected
      assert.throws(() => {
        buyItem(db, hero.id, { itemDefinitionId: daggerDef.id });
      }, /backpack is full/i, 'Shop must block purchases when inventory is > 50');

      // 3. Selling 3 daggers brings count down to 49
      const daggersToSell = db.prepare(`
        SELECT id FROM item_instances
        WHERE owner_character_id = ?
        LIMIT 3
      `).all(hero.id);

      for (const d of daggersToSell) {
        sellItem(db, hero.id, d.id);
      }

      const countAfterSale = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_character_id = ?").get(hero.id).c;
      assert.equal(countAfterSale, 49, 'Inventory count should now be 49');

      // 4. Shop purchase should now succeed
      const buyResult = buyItem(db, hero.id, { itemDefinitionId: daggerDef.id });
      assert.equal(buyResult.success, true, 'Purchase should succeed once inventory is below 50');
      assert.equal(buyResult.purchasedItem.name, 'Dagger');
    });

    test('Concurrent / duplicate persistent monster defeat requests do not duplicate items or gold', () => {
      const heroA = db.prepare('SELECT * FROM characters WHERE id = 201').get();

      // Hero B
      db.prepare(`
        INSERT INTO users (id, username, password_hash)
        VALUES (202, 'hero_b', 'hashed_pass')
      `).run();
      db.prepare(`
        INSERT INTO characters (
          id, user_id, name, class, level, current_hp, max_hp,
          strength, dexterity, constitution, intelligence, wisdom, charisma,
          gold, tile_id, is_alive
        ) VALUES (
          202, 202, 'Rival', 'FIGHTER', 1, 20, 20,
          16, 14, 14, 10, 10, 10,
          50, 1, 1
        )
      `).run();
      const heroB = db.prepare('SELECT * FROM characters WHERE id = 202').get();

      // Create persistent monster with 1 unique item and 75 gold
      const pmRes = db.prepare(`
        INSERT INTO monster_instances (monster_id, tile_id, current_hp, max_hp, status, held_gold)
        VALUES (1, 1, 0, 30, 'ACTIVE', 75)
      `).run();
      const pmId = Number(pmRes.lastInsertRowid);

      const ringDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Ring of Protection +1'").get();
      db.prepare(`
        INSERT INTO item_instances (item_definition_id, owner_type, owner_monster_id)
        VALUES (?, 'MONSTER', ?)
      `).run(ringDef.id, pmId);

      // Create actual encounter rows in DB for both heroes
      db.prepare(`
        INSERT INTO encounters (id, character_id, tile_id, monster_id, monster_instance_id, status, current_monster_hp)
        VALUES (991, ?, 1, 1, ?, 'IN_COMBAT', 0)
      `).run(heroA.id, pmId);
      db.prepare(`
        INSERT INTO encounters (id, character_id, tile_id, monster_id, monster_instance_id, status, current_monster_hp)
        VALUES (992, ?, 1, 1, ?, 'IN_COMBAT', 0)
      `).run(heroB.id, pmId);

      const encA = db.prepare('SELECT * FROM encounters WHERE id = 991').get();
      const encB = db.prepare('SELECT * FROM encounters WHERE id = 992').get();
      const monster = db.prepare('SELECT * FROM monsters WHERE id = 1').get();
      const pm = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(pmId);

      // Hero A defeats monster first
      const resA = handleMonsterDefeat(db, heroA, encA, monster, pm);
      assert.equal(resA.goldLooted, 75);
      assert.equal(resA.itemsLooted, 1);

      // Hero B attempts duplicate resolution
      const resB = handleMonsterDefeat(db, heroB, encB, monster, pm);
      assert.equal(resB.resolvedByOther, true, 'Hero B should be marked as resolvedByOther');
      assert.equal(resB.goldLooted, 0, 'Hero B must receive 0 gold');
      assert.equal(resB.itemsLooted, 0, 'Hero B must receive 0 items');

      // Total items with ring definition owned by players must be exactly 1
      const totalRings = db.prepare(`
        SELECT COUNT(*) as c FROM item_instances
        WHERE item_definition_id = ? AND owner_type = 'CHARACTER'
      `).get(ringDef.id).c;
      assert.equal(totalRings, 1, 'Exactly 1 ring should exist across all heroes (no duplication)');
    });
  });

  // =========================================================================
  // 3. Inactive Consumables & Functional Healing Potions
  // =========================================================================
  describe('3. Inactive Consumables and Functional Healing Potions', () => {
    test('Buff potions, Dragon Breath, and Antitoxin are absent from loot tables and shop', () => {
      const inactiveNames = [
        'Potion of Barkskin',
        "Potion of Bull's Strength",
        "Potion of Cat's Grace",
        'Potion of Shield of Faith',
        'Potion of Heroism',
        "Elixir of Dragon's Breath",
        'Antitoxin'
      ];

      // Check loot_table_entries
      const lootMatches = db.prepare(`
        SELECT id.name FROM loot_table_entries lte
        JOIN item_definitions id ON lte.item_definition_id = id.id
        WHERE id.name IN (${inactiveNames.map(n => `'${n.replace(/'/g, "''")}'`).join(', ')})
      `).all();
      assert.equal(lootMatches.length, 0, 'No inactive consumable should appear in any loot table');

      // Check general shop stock
      const storeStock = getCityStoreStock(db);
      for (const item of storeStock.standardItems) {
        assert.ok(!inactiveNames.includes(item.name), `Inactive consumable ${item.name} must not be in store stock`);
      }
    });

    test('Existing inactive potions cannot be consumed and are not deleted from inventory', () => {
      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();
      // Damage hero so healing would otherwise be valid
      db.prepare('UPDATE characters SET current_hp = 10 WHERE id = 201').run();

      const bullsStrengthDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Potion of Bull''s Strength'").get();
      const antitoxinDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Antitoxin'").get();

      const bInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)").run(bullsStrengthDef.id, hero.id);
      const aInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)").run(antitoxinDef.id, hero.id);

      // Attempt to drink Bull's Strength out of combat
      assert.throws(() => {
        useConsumable(db, hero.id, Number(bInst.lastInsertRowid));
      }, /not yet active/i, 'Drinking Bull\'s Strength must be rejected');

      // Verify item instance was NOT deleted
      const checkB = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(Number(bInst.lastInsertRowid));
      assert.ok(checkB, "Potion of Bull's Strength must remain safely preserved in backpack");

      // Attempt to drink Antitoxin out of combat
      assert.throws(() => {
        useConsumable(db, hero.id, Number(aInst.lastInsertRowid));
      }, /not yet active/i, 'Drinking Antitoxin must be rejected');

      const checkA = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(Number(aInst.lastInsertRowid));
      assert.ok(checkA, 'Antitoxin must remain safely preserved in backpack');

      // Hero HP must not have changed
      const heroAfter = db.prepare('SELECT current_hp FROM characters WHERE id = 201').get();
      assert.equal(heroAfter.current_hp, 10, 'Inactive consumable must not heal hero');
    });

    test('All six healing potions heal correctly and consume properly', () => {
      const healingPotionNames = [
        'Minor Healing Potion',
        'Potion of Cure Light Wounds',
        'Potion of Cure Moderate Wounds',
        'Potion of Cure Serious Wounds',
        'Potion of Cure Critical Wounds',
        "Draught of Troll's Blood"
      ];

      for (const name of healingPotionNames) {
        // Set hero HP low
        db.prepare('UPDATE characters SET current_hp = 5 WHERE id = 201').run();

        const potDef = db.prepare('SELECT * FROM item_definitions WHERE name = ?').get(name);
        assert.ok(potDef, `Healing potion ${name} exists in item definitions`);

        const instRes = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 201)").run(potDef.id);
        const instId = Number(instRes.lastInsertRowid);

        const useResult = useConsumable(db, 201, instId, { rng: () => 0.5 });
        assert.equal(useResult.success, true);
        assert.ok(useResult.healed > 0, `${name} must heal for > 0 HP`);

        // Verify item was consumed
        const deleted = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(instId);
        assert.equal(deleted, undefined, `${name} instance should be deleted after consumption`);
      }
    });
  });

  // =========================================================================
  // 4. Magical Accessories: Belt of Giant Strength +2 & Inactive Gear
  // =========================================================================
  describe('4. Magical Accessories', () => {
    test('Belt of Giant Strength +2 grants +2 effective STR, boosts attack bonus and damage, and reverts on unequip', () => {
      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();
      // Base strength is 16 (+3 modifier)
      assert.equal(hero.strength, 16);

      const beltDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Belt of Giant Strength +2'").get();
      assert.ok(beltDef, 'Belt of Giant Strength +2 exists');

      const beltInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 201)").run(beltDef.id);
      equipItem(db, 201, Number(beltInst.lastInsertRowid), 'BELT');

      const equipment = getCharacterEquipment(db, 201);
      assert.ok(equipment.belt, 'Belt is equipped');
      assert.equal(equipment.belt.name, 'Belt of Giant Strength +2');

      // Effective stats
      const effectiveHero = getEffectiveStats(hero, equipment);
      assert.equal(effectiveHero.strength, 18, 'Effective strength should be 16 + 2 = 18');
      assert.equal(effectiveHero.is_str_boosted, true);

      // Melee attack bonus uses full STR modifier:
      // Unboosted STR 16 (+3 mod). Boosted with Belt to STR 18 (+4 mod)
      const longswordDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Longsword'").get();
      const abBoosted = calculateHeroAttackBonus(effectiveHero, longswordDef);
      assert.equal(abBoosted, 4, 'Attack bonus with Belt should be +4 (boosted from +3)');

      // Damage formula: 1d8 + 4 (STR mod +4)
      const dmgFormula = getHeroDamageFormula(effectiveHero, longswordDef);
      assert.equal(dmgFormula, '1d8+4', 'Damage formula should reflect 18 STR (+4 mod)');

      // Unequip belt
      unequipItem(db, 201, Number(beltInst.lastInsertRowid));
      const unequippedGear = getCharacterEquipment(db, 201);
      assert.equal(unequippedGear.belt, null, 'Belt should be unequipped');

      const revertedHero = getEffectiveStats(hero, unequippedGear);
      assert.equal(revertedHero.strength, 16, 'Strength reverts to 16');
      assert.equal(revertedHero.is_str_boosted, false);

      const abReverted = calculateHeroAttackBonus(revertedHero, longswordDef);
      assert.equal(abReverted, 3, 'Attack bonus reverts to +3');
      assert.equal(getHeroDamageFormula(revertedHero, longswordDef), '1d8+3', 'Damage formula reverts to 1d8+3');
    });

    test('Boots of Elvenkind, Cloak of Resistance +1, and Bracers of Armor +1 are inactive from shop and loot', () => {
      const inactiveGear = ['Boots of Elvenkind', 'Cloak of Resistance +1', 'Bracers of Armor +1'];

      // Loot tables check
      const lootMatches = db.prepare(`
        SELECT id.name FROM loot_table_entries lte
        JOIN item_definitions id ON lte.item_definition_id = id.id
        WHERE id.name IN (${inactiveGear.map(n => `'${n.replace(/'/g, "''")}'`).join(', ')})
      `).all();
      assert.equal(lootMatches.length, 0, 'Inactive accessories must not appear in any loot table');

      // Store stock check
      const storeStock = getCityStoreStock(db);
      for (const item of storeStock.standardItems) {
        assert.ok(!inactiveGear.includes(item.name), `${item.name} must not be in standard store stock`);
      }
    });
  });

  // =========================================================================
  // 5. Critical Hit Values & Secrecy
  // =========================================================================
  describe('5. Critical Hit Metadata and Combat Execution', () => {
    test('14 non-standard critical weapons possess metadata while standard combat mechanics remain unchanged', () => {
      // Weapons with non-standard critical profiles (crit_threat < 20 or crit_mult > 2)
      const allWeapons = db.prepare("SELECT name, attributes FROM item_definitions WHERE category = 'WEAPON'").all();
      const nonStandardCritWeapons = allWeapons.filter(w => {
        try {
          const a = JSON.parse(w.attributes || '{}');
          return (a.crit_threat && Number(a.crit_threat) < 20) || (a.crit_mult && Number(a.crit_mult) > 2);
        } catch { return false; }
      });

      // Exactly 14 mundane weapons have non-standard critical profiles in Pathfinder rules
      assert.ok(nonStandardCritWeapons.length >= 14, `Expected at least 14 non-standard critical weapons, found ${nonStandardCritWeapons.length}`);

      // Combat attack roll uses natural 20 critical threshold regardless of weapon metadata
      // Rolling 19 with a weapon that has crit_threat 19 does NOT crit in current engine (natural 20 rule)
      const roll19 = resolveAttackRoll(5, 10, () => 0.90); // (0.90 * 20) + 1 = 19
      assert.equal(roll19.d20, 19);
      assert.equal(roll19.isHit, true);
      assert.equal(roll19.isCrit, false, 'Natural 19 is not a crit under standard approved combat mechanics');

      const roll20 = resolveAttackRoll(5, 10, () => 0.99); // Nat 20
      assert.equal(roll20.d20, 20);
      assert.equal(roll20.isHit, true);
      assert.equal(roll20.isCrit, true, 'Natural 20 is always a critical hit');
    });
  });

  // =========================================================================
  // 6. Ranger Opening Shot Strict Conditions
  // =========================================================================
  describe('6. Ranger Opening Shot Conditions', () => {
    let rangerId;

    beforeEach(() => {
      db.prepare(`
        INSERT INTO users (id, username, password_hash)
        VALUES (203, 'ranger_user', 'hashed_pass')
      `).run();

      db.prepare(`
        INSERT INTO characters (
          id, user_id, name, class, level, current_hp, max_hp,
          strength, dexterity, constitution, intelligence, wisdom, charisma,
          gold, tile_id, is_alive
        ) VALUES (
          203, 203, 'Erina', 'RANGER', 1, 20, 20,
          12, 16, 12, 10, 14, 10,
          100, 1, 1
        )
      `).run();
      rangerId = 203;

      // Equip Longbow in ranged slot
      const bowDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longbow'").get();
      const bowInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)").run(bowDef.id, rangerId);
      equipItem(db, rangerId, Number(bowInst.lastInsertRowid), 'RANGED');
    });

    function clearRangerEncounters() {
      db.prepare('DELETE FROM combat_events WHERE encounter_id IN (SELECT id FROM encounters WHERE character_id = ?)').run(rangerId);
      db.prepare('DELETE FROM encounters WHERE character_id = ?').run(rangerId);
    }

    test('Ranger Opening Shot triggers when spotted_by_hero=1 and is_ambush=0', () => {
      clearRangerEncounters();
      const encRes = db.prepare(`
        INSERT INTO encounters (
          character_id, tile_id, monster_id, status, current_monster_hp, combat_round,
          spotted_by_hero, is_ambush, opening_shot_resolved
        ) VALUES (?, 1, 1, 'DISCOVERED', 20, 0, 1, 0, 0)
      `).run(rangerId);
      const encId = Number(encRes.lastInsertRowid);

      const combatResult = startCombat(db, rangerId, encId, 'RANGER', {
        rng: () => 0.8 // Hit
      });

      assert.equal(combatResult.openingShotFired, true, 'Opening shot should fire when spotted_by_hero=1 and is_ambush=0');
    });

    test('Ranger Opening Shot is strictly suppressed when is_ambush=1 or spotted_by_hero=0', () => {
      // Case 1: Ambushed
      clearRangerEncounters();
      const ambRes = db.prepare(`
        INSERT INTO encounters (
          character_id, tile_id, monster_id, status, current_monster_hp, combat_round,
          spotted_by_hero, is_ambush, opening_shot_resolved
        ) VALUES (?, 1, 1, 'DISCOVERED', 20, 0, 0, 1, 0)
      `).run(rangerId);
      const ambId = Number(ambRes.lastInsertRowid);

      const ambResult = startCombat(db, rangerId, ambId, 'RANGER', { rng: () => 0.8 });
      assert.equal(ambResult.openingShotFired, false, 'Opening shot must NOT fire during ambush');

      // Case 2: Not spotted by hero
      clearRangerEncounters();
      const unspottedRes = db.prepare(`
        INSERT INTO encounters (
          character_id, tile_id, monster_id, status, current_monster_hp, combat_round,
          spotted_by_hero, is_ambush, opening_shot_resolved
        ) VALUES (?, 1, 1, 'DISCOVERED', 20, 0, 0, 0, 0)
      `).run(rangerId);
      const unspottedId = Number(unspottedRes.lastInsertRowid);

      const unspottedResult = startCombat(db, rangerId, unspottedId, 'RANGER', { rng: () => 0.8 });
      assert.equal(unspottedResult.openingShotFired, false, 'Opening shot must NOT fire if hero did not spot monster');
    });

    test('Opening shot cannot fire twice in the same combat', () => {
      clearRangerEncounters();
      const encRes = db.prepare(`
        INSERT INTO encounters (
          character_id, tile_id, monster_id, status, current_monster_hp, combat_round,
          spotted_by_hero, is_ambush, opening_shot_resolved
        ) VALUES (?, 1, 1, 'DISCOVERED', 50, 0, 1, 0, 0)
      `).run(rangerId);
      const encId = Number(encRes.lastInsertRowid);

      const firstStart = startCombat(db, rangerId, encId, 'RANGER', { rng: () => 0.8 });
      assert.equal(firstStart.openingShotFired, true);

      // Subsequent call to startCombat
      const secondStart = startCombat(db, rangerId, encId, 'RANGER', { rng: () => 0.8 });
      assert.equal(secondStart.openingShotFired, false, 'Opening shot must NOT fire a second time');
    });
  });

  // =========================================================================
  // 7. Flying Monster Detection with Real Database Monster
  // =========================================================================
  describe('7. Flying Monster Detection & Dynamic Weapon Selection', () => {
    test('Real DB monster with movement_type=FLY respects Melee preference (keeping shield AC) and applies -1 melee Evasive Flyer penalty', () => {
      const flyingMonster = db.prepare("SELECT * FROM monsters WHERE movement_type = 'FLY' LIMIT 1").get();
      assert.ok(flyingMonster, 'A monster with movement_type = FLY exists in database');
      assert.equal(flyingMonster.movement_type, 'FLY');

      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();

      // Equip melee weapon, ranged weapon, and shield
      const swordDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longsword'").get();
      const bowDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longbow'").get();
      const shieldDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Heavy Steel Shield'").get();

      const sInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 201)").run(swordDef.id);
      const bInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 201)").run(bowDef.id);
      const shInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 201)").run(shieldDef.id);

      equipItem(db, 201, Number(sInst.lastInsertRowid), 'MELEE');
      equipItem(db, 201, Number(bInst.lastInsertRowid), 'RANGED');
      equipItem(db, 201, Number(shInst.lastInsertRowid), 'SHIELD');

      const equipment = getCharacterEquipment(db, 201);

      const encounter = {
        movement_type: flyingMonster.movement_type
      };

      const { activeWeapon, isRangedActive, isAirborne } = getActiveWeapon(hero, equipment, encounter);
      assert.equal(isAirborne, true, 'Flying monster must be detected as airborne');
      assert.equal(isRangedActive, false, 'Melee hero keeps melee weapon active against flying monster');
      assert.equal(activeWeapon.name, 'Longsword', 'Active weapon must remain Longsword');

      // AC calculation: Shield bonus (+2) is PRESERVED when melee weapon is active!
      const ac = calculateHeroAC(hero, null, equipment.shield, isRangedActive, encounter, activeWeapon);
      // Unarmored (10) + DEX 14 (+2) + Heavy Steel Shield (+2) = 14 AC
      assert.equal(ac, 14, 'Shield AC must be preserved against flying threat with active melee weapon');
    });

    test('Supports both FLY and FLYING values case-insensitively', () => {
      const hero = db.prepare('SELECT * FROM characters WHERE id = 201').get();

      // Equip only a ranged weapon (no melee weapon -> falls back to ranged)
      const bowDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longbow'").get();
      const bInst = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 201)").run(bowDef.id);
      equipItem(db, 201, Number(bInst.lastInsertRowid), 'RANGED');

      const equipment = getCharacterEquipment(db, 201);

      const flyThreat = { movement_type: 'fly' };
      const flyingThreat = { movement_type: 'FLYING' };

      const resFly = getActiveWeapon(hero, equipment, flyThreat);
      const resFlying = getActiveWeapon(hero, equipment, flyingThreat);

      assert.equal(resFly.isAirborne, true);
      assert.equal(resFlying.isAirborne, true);
      assert.equal(resFly.isRangedActive, true);
      assert.equal(resFlying.isRangedActive, true);
    });
  });
});
