const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { generateMonsterLoot, calculateMonsterGold } = require('../src/domain/combat/loot');
const { equipItem, unequipItem, getCharacterEquipment, getCharacterInventory, useConsumable } = require('../src/domain/character/rules');
const { calculateHeroAC } = require('../src/domain/combat/rules');
const { handlePlayerDeath, recordMonsterKill } = require('../src/domain/monsters/persistence');

describe('Item, Equipment & Loot System Test Suite', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();

    // Seed test user and test character
    db.prepare(`
      INSERT INTO users (id, username, password_hash)
      VALUES (101, 'tester_item', 'hashed_pass')
    `).run();

    db.prepare(`
      INSERT INTO characters (id, user_id, name, class, level, current_hp, max_hp, strength, dexterity, constitution, intelligence, wisdom, charisma, gold, tile_id, is_alive)
      VALUES (101, 101, 'Valeros', 'FIGHTER', 1, 10, 20, 16, 14, 14, 10, 10, 10, 50, 1, 1)
    `).run();
  });

  describe('1. Item Database & Schema Integrity', () => {
    test('Item definitions catalog contains at least 100 items with valid categories', () => {
      const allItems = db.prepare('SELECT * FROM item_definitions').all();
      assert.ok(allItems.length >= 100, `Expected at least 100 items, found ${allItems.length}`);

      const categories = db.prepare(`
        SELECT category, COUNT(*) as count 
        FROM item_definitions 
        GROUP BY category
      `).all();

      const catMap = Object.fromEntries(categories.map(c => [c.category, c.count]));
      assert.ok(catMap.WEAPON >= 40, `Expected >= 40 weapons, found ${catMap.WEAPON}`);
      assert.ok(catMap.ARMOR >= 20, `Expected >= 20 armors, found ${catMap.ARMOR}`);
      assert.ok(catMap.SHIELD >= 8, `Expected >= 8 shields, found ${catMap.SHIELD}`);
      assert.ok(catMap.POTION >= 10, `Expected >= 10 potions, found ${catMap.POTION}`);
      assert.ok(catMap.OTHER >= 15, `Expected >= 15 other/treasures, found ${catMap.OTHER}`);
    });

    test('All item definitions have valid rarity values and populated subtypes', () => {
      const validRarities = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
      const items = db.prepare('SELECT id, name, rarity, subtype, category FROM item_definitions').all();

      for (const item of items) {
        assert.ok(validRarities.includes(item.rarity), `Item ${item.name} (${item.id}) has invalid rarity: ${item.rarity}`);
        assert.ok(item.subtype && item.subtype.length > 0, `Item ${item.name} (${item.id}) has empty subtype`);
      }
    });

    test('Loot tables and loot table entries are seeded with valid foreign keys', () => {
      const tables = db.prepare('SELECT * FROM loot_tables WHERE is_active = 1').all();
      assert.ok(tables.length >= 8, `Expected at least 8 loot tables, found ${tables.length}`);

      const entries = db.prepare(`
        SELECT lte.*, id.name, id.category, id.rarity
        FROM loot_table_entries lte
        JOIN item_definitions id ON lte.item_definition_id = id.id
      `).all();
      assert.ok(entries.length >= 50, `Expected at least 50 loot table entries, found ${entries.length}`);

      for (const entry of entries) {
        assert.ok(entry.weight > 0, `Entry weight must be > 0: ${entry.name}`);
      }
    });
  });

  describe('2. Data-Driven Loot Generation & Constraints', () => {
    test('Ordinary animals strictly never drop gold or equipment', () => {
      const wolf = {
        id: 99,
        name: 'Forest Wolf',
        creature_type: 'ANIMAL',
        challenge_rating: 1.0,
        treasure_type: 'Standard'
      };

      for (let i = 0; i < 50; i++) {
        const loot = generateMonsterLoot(db, wolf, 101, { forceGold: true, forceNormalItem: true, forceMagicItem: true });
        assert.strictEqual(loot.goldAwarded, 0);
        assert.strictEqual(loot.itemsAwarded.length, 0);
        assert.strictEqual(loot.backpackFull, false);
      }
    });

    test('Humanoid monsters award appropriate gold scaled by CR and table drops', () => {
      const goblin = {
        id: 1,
        name: 'Goblin Scout',
        creature_type: 'HUMANOID',
        challenge_rating: 0.33,
        treasure_type: 'Standard'
      };

      const loot = generateMonsterLoot(db, goblin, 101, { forceGold: true, forceNormalItem: true });
      assert.ok(loot.goldAwarded >= 1, `Goblin gold awarded should be >= 1, got ${loot.goldAwarded}`);
      assert.ok(loot.itemsAwarded.length > 0, 'Goblin should drop an item when forced');
      assert.strictEqual(loot.itemsAwarded[0].is_magical, 0);
    });

    test('Dragon monster drops high-tier treasures and valuables', () => {
      const dragon = {
        id: 88,
        name: 'Venomfang',
        creature_type: 'DRAGON',
        challenge_rating: 8.0,
        treasure_type: 'Double'
      };

      const loot = generateMonsterLoot(db, dragon, 101, { forceGold: true, forceNormalItem: true, forceMagicItem: true });
      assert.ok(loot.goldAwarded >= 50, `Dragon gold should be >= 50, got ${loot.goldAwarded}`);
      assert.ok(loot.itemsAwarded.length >= 1, 'Dragon should award at least one item');
      
      const hasTreasureOrMagic = loot.itemsAwarded.some(it => it.rarity === 'RARE' || it.rarity === 'EPIC' || it.rarity === 'LEGENDARY' || it.is_magical);
      assert.ok(hasTreasureOrMagic, 'Dragon drops should include Rare/Epic/Legendary or magical items');
    });

    test('50-item backpack limit is strictly enforced and flags backpackFull', () => {
      // Clear character's inventory
      db.prepare("DELETE FROM item_instances WHERE owner_character_id = 101").run();

      // Insert 50 dummy items
      for (let i = 0; i < 50; i++) {
        db.prepare(`
          INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
          VALUES (1, 'CHARACTER', 101)
        `).run();
      }

      const orc = {
        id: 2,
        name: 'Orc Warrior',
        creature_type: 'HUMANOID',
        challenge_rating: 1.0,
        treasure_type: 'Standard'
      };

      const loot = generateMonsterLoot(db, orc, 101, { forceGold: true, forceNormalItem: true });
      assert.strictEqual(loot.backpackFull, true, 'backpackFull must be true');
      assert.strictEqual(loot.itemsAwarded.length, 0, 'No items should be added when backpack is full');
      assert.ok(loot.goldAwarded > 0, 'Gold should still be awarded even if backpack is full of items');

      const count = db.prepare("SELECT COUNT(*) as count FROM item_instances WHERE owner_character_id = 101").get().count;
      assert.strictEqual(count, 50, 'Total item count must remain capped at 50');
    });
  });

  describe('3. Out-of-Combat Consumable Consumption', () => {
    test('Drinking healing potion heals hero and deletes item instance atomically', () => {
      // Hero HP is 10/20
      const potionDef = db.prepare("SELECT id FROM item_definitions WHERE category = 'POTION' AND name = 'Potion of Cure Light Wounds'").get();
      assert.ok(potionDef, 'Potion of Cure Light Wounds definition should exist');

      const insRes = db.prepare(`
        INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
        VALUES (?, 'CHARACTER', 101)
      `).run(potionDef.id);
      const potionInstanceId = Number(insRes.lastInsertRowid);

      const result = useConsumable(db, 101, potionInstanceId);
      assert.strictEqual(result.success, true);
      assert.ok(result.healed >= 2 && result.healed <= 9, `Heal amount ${result.healed} should be within 1d8+1 (2-9)`);
      assert.strictEqual(result.currentHp, 10 + result.healed);

      // Verify DB character HP updated
      const char = db.prepare('SELECT current_hp FROM characters WHERE id = 101').get();
      assert.strictEqual(char.current_hp, result.currentHp);

      // Verify item instance was deleted
      const instance = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(potionInstanceId);
      assert.strictEqual(instance, undefined, 'Consumed potion instance must be deleted');
    });

    test('Drinking potion when already at max HP is strictly rejected', () => {
      // Set hero to full HP
      db.prepare('UPDATE characters SET current_hp = max_hp WHERE id = 101').run();

      const potionDef = db.prepare("SELECT id FROM item_definitions WHERE category = 'POTION' LIMIT 1").get();
      const insRes = db.prepare(`
        INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
        VALUES (?, 'CHARACTER', 101)
      `).run(potionDef.id);
      const potionInstanceId = Number(insRes.lastInsertRowid);

      assert.throws(
        () => useConsumable(db, 101, potionInstanceId),
        /Hero is already at maximum health/
      );

      // Verify item instance was NOT deleted
      const instance = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(potionInstanceId);
      assert.ok(instance, 'Potion must not be consumed if heal was rejected');
    });

    test('Dead hero cannot consume potions', () => {
      db.prepare('UPDATE characters SET is_alive = 0, current_hp = 0 WHERE id = 101').run();

      const potionDef = db.prepare("SELECT id FROM item_definitions WHERE category = 'POTION' LIMIT 1").get();
      const insRes = db.prepare(`
        INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
        VALUES (?, 'CHARACTER', 101)
      `).run(potionDef.id);
      const potionInstanceId = Number(insRes.lastInsertRowid);

      assert.throws(
        () => useConsumable(db, 101, potionInstanceId),
        /Dead characters cannot use consumables/
      );
    });

    test('Cannot consume an item not owned or of non-potion category', () => {
      // Non-potion item (Longsword)
      const swordDef = db.prepare("SELECT id FROM item_definitions WHERE category = 'WEAPON' AND name = 'Longsword'").get();
      const insRes = db.prepare(`
        INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
        VALUES (?, 'CHARACTER', 101)
      `).run(swordDef.id);
      const swordInstanceId = Number(insRes.lastInsertRowid);

      assert.throws(
        () => useConsumable(db, 101, swordInstanceId),
        /is not a consumable item/
      );

      // Create a second living character who does NOT own this sword
      db.prepare(`
        INSERT INTO users (id, username, password_hash)
        VALUES (102, 'tester_two', 'hash2')
      `).run();
      db.prepare(`
        INSERT INTO characters (id, user_id, name, class, level, current_hp, max_hp, strength, dexterity, constitution, intelligence, wisdom, charisma, gold, tile_id, is_alive)
        VALUES (102, 102, 'SecondHero', 'RANGER', 1, 10, 20, 14, 16, 12, 10, 14, 10, 10, 1, 1)
      `).run();

      // Living character 102 tries to consume item owned by 101
      assert.throws(
        () => useConsumable(db, 102, swordInstanceId),
        /Item not found in your inventory/
      );
    });
  });

  describe('4. Accessory Slots & Equipment AC Calculations', () => {
    test('Equipping Ring of Protection +1 and Amulet of Natural Armor +1 adds deflection and natural armor AC', () => {
      // Base Hero AC unarmored with DEX 14 (+2): 10 + 2 = 12
      const baseHero = db.prepare('SELECT * FROM characters WHERE id = 101').get();
      const initialEquip = getCharacterEquipment(db, 101);
      const baseAC = calculateHeroAC(baseHero, initialEquip);
      assert.strictEqual(baseAC, 12);

      // Give hero a Ring of Protection +1 and Amulet of Natural Armor +1
      const ringDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Ring of Protection +1'").get();
      const amuletDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Amulet of Natural Armor +1'").get();

      const ringIns = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(ringDef.id);
      const amuletIns = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(amuletDef.id);

      // Equip Ring and Amulet
      equipItem(db, 101, Number(ringIns.lastInsertRowid), 'RING');
      equipItem(db, 101, Number(amuletIns.lastInsertRowid), 'NECK');

      const equipAfter = getCharacterEquipment(db, 101);
      assert.ok(equipAfter.ring, 'Ring should be equipped');
      assert.ok(equipAfter.neck, 'Neck amulet should be equipped');
      assert.strictEqual(equipAfter.ring.name, 'Ring of Protection +1');
      assert.strictEqual(equipAfter.neck.name, 'Amulet of Natural Armor +1');

      // New AC: Base 10 + DEX 2 + Ring 1 + Amulet 1 = 14
      const boostedAC = calculateHeroAC(baseHero, equipAfter);
      assert.strictEqual(boostedAC, 14, `Expected AC 14 with ring & amulet, got ${boostedAC}`);

      // Unequip Ring
      unequipItem(db, 101, Number(ringIns.lastInsertRowid));
      const equipNoRing = getCharacterEquipment(db, 101);
      assert.strictEqual(equipNoRing.ring, null);
      const acNoRing = calculateHeroAC(baseHero, equipNoRing);
      assert.strictEqual(acNoRing, 13);
    });

    test('Two-handed melee weapon suppresses shield AC bonus while preserving accessory bonuses', () => {
      const greatswordDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Greatsword'").get();
      const shieldDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Heavy Steel Shield'").get();
      const ringDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Ring of Protection +1'").get();

      const swordIns = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(greatswordDef.id);
      const shieldIns = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(shieldDef.id);
      const ringIns = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(ringDef.id);

      equipItem(db, 101, Number(swordIns.lastInsertRowid), 'MELEE');
      equipItem(db, 101, Number(shieldIns.lastInsertRowid), 'SHIELD');
      equipItem(db, 101, Number(ringIns.lastInsertRowid), 'RING');

      const hero = db.prepare('SELECT * FROM characters WHERE id = 101').get();
      const equip = getCharacterEquipment(db, 101);

      // Greatsword is two-handed -> Shield (+2 AC) is suppressed!
      // Base 10 + DEX 2 + Ring 1 = 13 (Shield bonus 0)
      const ac = calculateHeroAC(hero, equip, { activeWeaponType: 'MELEE' });
      assert.strictEqual(ac, 13, `Expected AC 13 with suppressed shield and ring +1, got ${ac}`);
    });
  });

  describe('5. Permadeath & Persistent Monster Loot Atomicity', () => {
    test('Permadeath transfers 50% gold and items to persistent monster without duplication', () => {
      // Give character 100 gold and 4 items
      db.prepare('UPDATE characters SET gold = 100 WHERE id = 101').run();
      const swordDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longsword'").get();
      const shieldDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Heavy Steel Shield'").get();
      const potionDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Potion of Cure Light Wounds'").get();
      const ringDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Ring of Protection +1'").get();

      db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(swordDef.id);
      db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(shieldDef.id);
      db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(potionDef.id);
      db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', 101)").run(ringDef.id);

      const character = db.prepare('SELECT * FROM characters WHERE id = 101').get();
      const monster = db.prepare('SELECT * FROM monsters WHERE id = 1').get();
      const encRes = db.prepare(`
        INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
        VALUES (101, 1, 1, 'IN_COMBAT', 20)
      `).run();
      const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(Number(encRes.lastInsertRowid));

      // Handle player death with deterministic rng (survive all 50% rolls)
      const deathRes = handlePlayerDeath(db, character, encounter, monster, null, { rng: () => 0.1 });

      // Check character state
      const deadChar = db.prepare('SELECT * FROM characters WHERE id = 101').get();
      assert.strictEqual(deadChar.is_alive, 0);
      assert.strictEqual(deadChar.gold, 0);

      // Check persistent monster state
      const persMonster = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(deathRes.instanceId);
      assert.ok(persMonster, 'Persistent monster instance must be created');
      assert.strictEqual(persMonster.held_gold, 50); // 50% of 100 gold
      assert.strictEqual(persMonster.kill_count, 1);

      // Check items transferred
      const charItems = db.prepare("SELECT COUNT(*) as count FROM item_instances WHERE owner_character_id = 101").get().count;
      assert.strictEqual(charItems, 0, 'Dead character must own 0 items');

      const monsterItems = db.prepare("SELECT * FROM item_instances WHERE owner_type = 'MONSTER' AND owner_monster_id = ?").all(deathRes.instanceId);
      assert.strictEqual(monsterItems.length, deathRes.itemsTransferred);
      assert.ok(monsterItems.length >= 1, 'Monster should hold transferred items');

      for (const mItem of monsterItems) {
        assert.strictEqual(mItem.equipped_slot, null);
      }
    });
  });
});
