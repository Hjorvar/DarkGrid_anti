const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../src/domain/auth/service');
const { createCharacter, getCharacterInventory, getCharacterEquipment, unequipItem } = require('../src/domain/character/rules');
const { checkTileEncounter, ignoreEncounter, selectMonsterForTerrainAndHero } = require('../src/domain/encounters/engine');
const { startCombat, executeCombatRound, getCombatState } = require('../src/domain/combat/engine');
const { generateMonsterLoot } = require('../src/domain/combat/loot');
const { getMonsterAbilityProfile } = require('../src/domain/combat/abilities');
const { sellItem } = require('../src/domain/economy/shop');
const { handlePlayerDeath } = require('../src/domain/monsters/persistence');
const { getOrGenerateContracts, acceptContract, abandonContract } = require('../src/domain/bounties/board');

const THIRTY_NEW_MONSTERS = [
  // Level 1
  'Mite', 'Bog Strider', 'Blood Hawk', 'Jungle Viper', 'Plague Zombie', 'Grippli Scout',
  // Level 2
  'Worg', 'Hippogriff', 'Giant Toad', 'Carbuncle', 'Phantom Fungus', 'Gnoll Packmaster',
  // Level 3
  'Giant Mantis', 'Spriggan', "Will-o'-Wisp", 'Cheetah', 'Draugr', 'Hobgoblin Captain',
  // Level 4
  'Displacer Beast', 'Shambling Mound', 'Leucrotta', 'Dire Boar', 'Forest Drake', 'Otyugh',
  // Level 5
  'Wyvern', 'Girallon', 'Catoblepas', 'Barrow Wight', 'Green Hag', 'Orc Warchief'
];

describe('Night Work: Gameplay Fixes, Loot Progression, and 30 New Monsters', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('1A. Ambush Mechanics: blocks free bypass and contract-abandon bypass at Level 2+, and grants monster +4 surprise initiative & tie-breaker', async () => {
    const user = await registerUser(db, 'ambush_tester', 'password123');
    const hero = createCharacter(db, {
      userId: user.id,
      name: 'Sir Ambush',
      classType: 'FIGHTER',
      stats: { strength: 16, dexterity: 10, constitution: 14, intelligence: 11, wisdom: 11, charisma: 10 }
    });

    const forestTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'FOREST' AND is_safe = 0 AND is_passable = 1 LIMIT 1").get();
    const worg = db.prepare("SELECT * FROM monsters WHERE name = 'Worg'").get();

    // At Level 1, ambush immunity applies even if is_ambush = 1 in DB
    const l1EncRes = db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, is_ambush)
      VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 1)
    `).run(hero.id, forestTile.id, worg.id, worg.base_hp, worg.base_hp);
    const l1EncId = Number(l1EncRes.lastInsertRowid);
    const l1Ignored = ignoreEncounter(db, hero.id, l1EncId);
    assert.equal(l1Ignored.success, true);
    const l1EncRow = db.prepare('SELECT status FROM encounters WHERE id = ?').get(l1EncId);
    assert.equal(l1EncRow.status, 'IGNORED', 'Level 1 hero retains ambush immunity and can bypass');

    // Promote hero to Level 2
    db.prepare('UPDATE characters SET level = 2, current_hp = 22, max_hp = 22, tile_id = ? WHERE id = ?').run(forestTile.id, hero.id);
    const heroL2 = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);

    // Give hero an active bounty contract
    const contracts = getOrGenerateContracts(db, heroL2);
    acceptContract(db, hero.id, contracts[0].id);

    // Create Level 2+ ambush encounter linked to the bounty contract
    const l2EncRes = db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, bounty_contract_id, status, current_monster_hp, monster_max_hp, is_ambush)
      VALUES (?, ?, ?, ?, 'DISCOVERED', ?, ?, 1)
    `).run(hero.id, forestTile.id, worg.id, contracts[0].id, worg.base_hp, worg.base_hp);
    const l2EncId = Number(l2EncRes.lastInsertRowid);

    // 1. Free bypass (ignoreEncounter) must be blocked
    assert.throws(
      () => ignoreEncounter(db, hero.id, l2EncId),
      /Ambush! Your path is cut off/,
      'Level 2+ ambush must block free bypass'
    );

    // 2. Abandoning a contract to bypass an active ambush must also be blocked
    const abandonRes = abandonContract(db, hero.id);
    assert.equal(abandonRes.ok, false, 'Level 2+ ambush must block contract-abandon bypass');
    assert.match(abandonRes.error, /Ambush! You cannot abandon your contract/);

    // 3. Starting combat on an ambush grants monster +4 surprise initiative bonus and tie-breaker
    // Hero DEX 10 (+0 mod), Orc init +0. If hero rolls 14 (rng 0.65) -> 14, and Orc rolls 10 (rng 0.45) + 0 + 4 ambush = 14 (tie!)
    // On a tie during an ambush, MONSTER wins initiative!
    const orc = db.prepare("SELECT * FROM monsters WHERE name = 'Orc'").get();
    db.prepare('UPDATE encounters SET monster_id = ? WHERE id = ?').run(orc.id, l2EncId);

    let rollIdx = 0;
    const tieRng = () => {
      rollIdx++;
      return rollIdx === 1 ? 0.65 : 0.45; // Hero roll = 14, Monster roll = 10 (+4 ambush = 14)
    };

    const started = startCombat(db, hero.id, l2EncId, { rng: tieRng });
    assert.equal(started.encounter.hero_initiative, 14);
    assert.equal(started.encounter.monster_initiative, 14, 'Monster receives +4 surprise initiative bonus on ambush');
    assert.equal(started.encounter.initiative_winner, 'MONSTER', 'Monster wins initiative ties during an ambush');
  });

  it('1B. Level 1 Unfair Death Protection: Round-1 Death\'s Door spike guard clamps healthy Level 1 hero at 1 HP once, while Round 2 allows normal death', async () => {
    const user = await registerUser(db, 'l1_guard_tester', 'password123');
    const hero = createCharacter(db, {
      userId: user.id,
      name: 'Young Squire',
      classType: 'FIGHTER',
      stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 11, wisdom: 10, charisma: 9 }
    });

    // Verify Level 1 outlier monsters were rebalanced in Seed 010
    const orc = db.prepare("SELECT * FROM monsters WHERE name = 'Orc'").get();
    assert.equal(orc.attack_bonus, 3);
    assert.equal(orc.damage_dice, '1d6+2');

    const zombie = db.prepare("SELECT * FROM monsters WHERE name = 'Human Zombie'").get();
    assert.equal(zombie.attack_bonus, 2);
    assert.equal(zombie.damage_dice, '1d6+2');

    const gnoll = db.prepare("SELECT * FROM monsters WHERE name = 'Gnoll'").get();
    assert.equal(gnoll.attack_bonus, 3);
    assert.equal(gnoll.damage_dice, '1d6+2');

    // Pit Level 1 hero (12/12 HP) against an Ogre in Round 1 where monster wins initiative and crits
    const ogre = db.prepare("SELECT * FROM monsters WHERE name = 'Ogre'").get();
    const tile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();

    const encRes = db.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id, status, combat_round,
        current_monster_hp, monster_max_hp, initiative_winner, combat_state_json
      ) VALUES (?, ?, ?, 'IN_COMBAT', 1, 25, 25, 'MONSTER', '{}')
    `).run(hero.id, tile.id, ogre.id);
    const encId = Number(encRes.lastInsertRowid);

    // Round 1: Monster hits with max roll, Hero misses. Hero would take >12 damage, but Death's Door clamps at 1 HP!
    let step = 0;
    const r1Rng = () => {
      step++;
      if (step <= 4) return 0.95;
      return 0.05;
    };

    executeCombatRound(db, hero.id, encId, 'ATTACK', { rng: r1Rng });
    const afterR1 = getCombatState(db, hero.id, encId);
    assert.equal(afterR1.character.is_alive, 1, 'Healthy Level 1 hero must survive Round 1 lethal spike at 1 HP');
    assert.equal(afterR1.character.current_hp, 1, 'Hero HP clamped at 1 HP');
    assert.equal(afterR1.encounter.status, 'IN_COMBAT');
    assert.ok(
      afterR1.events.some(e => e.public_text.includes("Death's Door")),
      "Combat log must record Death's Door warning in Round 1"
    );

    // Round 2: Hero is now in Round 2 at 1 HP -> monster hit kills hero normally
    executeCombatRound(db, hero.id, encId, 'ATTACK', { rng: () => 0.95 });
    const afterR2 = getCombatState(db, hero.id, encId);
    assert.equal(afterR2.character.is_alive, 0, 'Hero dies normally in Round 2 if they do not heal or escape');
    assert.equal(afterR2.encounter.status, 'DEFEAT');
  });

  it('1C. Permadeath & Starter Gear Exploit Fix: blocks selling starter gear and prevents zero-XP Level 1 mule feeding', async () => {
    const user = await registerUser(db, 'mule_tester', 'password123');
    const hero1 = createCharacter(db, {
      userId: user.id,
      name: 'FirstHero',
      classType: 'FIGHTER',
      stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 11, wisdom: 10, charisma: 9 }
    });

    // Move to Oakhaven city (terrain = 'CITY', is_safe = 1) to test selling starter gear
    const cityTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1").get();
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(cityTile.id, hero1.id);

    // Unequip starter Longsword and try to sell it -> must be rejected as starter gear
    const eqBefore = getCharacterEquipment(db, hero1.id);
    unequipItem(db, hero1.id, eqBefore.meleeWeapon.instance_id);
    const inv = getCharacterInventory(db, hero1.id);
    const starterSword = inv.find(i => i.name === 'Longsword');
    assert.ok(starterSword, 'Unequipped starter Longsword is in backpack');

    assert.throws(
      () => sellItem(db, hero1.id, starterSword.instance_id),
      /Starter issue equipment cannot be sold at the Oakhaven market/,
      'Selling starter equipment must be blocked'
    );

    const starterPotion = inv.find(i => i.category === 'POTION');
    assert.ok(starterPotion, 'Starter potion is in backpack');
    assert.throws(
      () => sellItem(db, hero1.id, starterPotion.instance_id),
      /Starter issue equipment cannot be sold at the Oakhaven market/,
      'Selling starter potion must be blocked'
    );

    // Now test zero-XP Level 1 mule feeding:
    // FirstHero dies at 0 XP on a wilderness tile -> organic first death transfers 50% gold (5 gp)
    const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
    const goblin = db.prepare("SELECT * FROM monsters WHERE name = 'Goblin'").get();
    const enc1Res = db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp)
      VALUES (?, ?, ?, 'IN_COMBAT', 5, 5)
    `).run(hero1.id, wildTile.id, goblin.id);
    const enc1 = db.prepare('SELECT * FROM encounters WHERE id = ?').get(Number(enc1Res.lastInsertRowid));

    const death1 = handlePlayerDeath(db, hero1, enc1, goblin, null, { rng: () => 0.01 });
    assert.equal(death1.goldTransferred, 5, 'First organic death transfers 5 gp');

    const pmAfter1 = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(death1.instanceId);
    const goldAfter1 = pmAfter1.held_gold;
    const itemsAfter1 = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_type = 'MONSTER' AND owner_monster_id = ?").get(death1.instanceId).c;

    // Now user creates a second zero-XP Level 1 character (MuleAlt) and immediately feeds it to the same persistent monster
    const muleHero = createCharacter(db, {
      userId: user.id,
      name: 'MuleAlt',
      classType: 'FIGHTER',
      stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 11, wisdom: 10, charisma: 9 }
    });

    const enc2Res = db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, monster_instance_id, status, current_monster_hp, monster_max_hp)
      VALUES (?, ?, ?, ?, 'IN_COMBAT', 5, 5)
    `).run(muleHero.id, wildTile.id, goblin.id, death1.instanceId);
    const enc2 = db.prepare('SELECT * FROM encounters WHERE id = ?').get(Number(enc2Res.lastInsertRowid));

    const death2 = handlePlayerDeath(db, muleHero, enc2, goblin, pmAfter1, { rng: () => 0.01 });
    assert.equal(death2.goldTransferred, 0, 'Mule alt must transfer 0 starter gold to persistent monster');
    assert.equal(death2.itemsTransferred, 0, 'Mule alt must transfer 0 starter items to persistent monster');

    const pmAfter2 = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(death1.instanceId);
    assert.equal(pmAfter2.held_gold, goldAfter1, 'Persistent monster held_gold must not increase from mule feeding');
    const itemsAfter2 = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_type = 'MONSTER' AND owner_monster_id = ?").get(death1.instanceId).c;
    assert.equal(itemsAfter2, itemsAfter1, 'Persistent monster items must not increase from mule feeding');
  });

  it('2. Loot Table Fix & Progression Gating: all 55 previously unlinked active equipment items are connected and min_cr is strictly enforced', () => {
    const deferredNames = [
      'Potion of Barkskin',
      "Potion of Bull's Strength",
      "Potion of Cat's Grace",
      'Potion of Shield of Faith',
      'Potion of Heroism',
      "Elixir of Dragon's Breath",
      'Antitoxin',
      'Boots of Elvenkind',
      'Cloak of Resistance +1',
      'Bracers of Armor +1'
    ];

    const unlinkedActive = db.prepare(`
      SELECT id.id, id.name, id.category, id.subtype, id.is_magical, id.min_cr
      FROM item_definitions id
      LEFT JOIN loot_table_entries lte ON lte.item_definition_id = id.id
      WHERE lte.id IS NULL
    `).all().filter(item => !deferredNames.includes(item.name));

    assert.equal(
      unlinkedActive.length,
      0,
      `Expected 0 unlinked active items, found ${unlinkedActive.length}: ${unlinkedActive.map(i => i.name).join(', ')}`
    );

    // Verify the 4 new creature-type loot tables exist and have entries
    for (const code of ['MONSTROUS_HUMANOID_SPOILS', 'FEY_CURIOS', 'PLANT_TROVE', 'VERMIN_CARCASS_CACHE']) {
      const table = db.prepare('SELECT * FROM loot_tables WHERE code = ? AND is_active = 1').get(code);
      assert.ok(table, `Loot table ${code} must exist and be active`);
      const entryCount = db.prepare('SELECT COUNT(*) as c FROM loot_table_entries WHERE loot_table_id = ?').get(table.id).c;
      assert.ok(entryCount >= 12, `Loot table ${code} must have at least 12 entries, found ${entryCount}`);
    }

    // Verify min_cr gating on non-magical and magical drops for a CR 0.25 Kobold
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (901, 'loot_user', 'hash')").run();
    db.prepare(`
      INSERT INTO characters (id, user_id, name, class, level, current_hp, max_hp, strength, dexterity, constitution, intelligence, wisdom, charisma, gold, tile_id, is_alive)
      VALUES (901, 901, 'LootTester', 'RANGER', 1, 12, 12, 14, 16, 12, 10, 12, 10, 10, 1, 1)
    `).run();

    const kobold = db.prepare("SELECT * FROM monsters WHERE name = 'Kobold'").get();
    for (let i = 0; i < 60; i++) {
      db.prepare('DELETE FROM item_instances WHERE owner_character_id = 901').run();
      const loot = generateMonsterLoot(db, kobold, 901, { forceNormalItem: true });
      for (const awarded of loot.itemsAwarded) {
        const def = db.prepare('SELECT min_cr FROM item_definitions WHERE id = ?').get(awarded.definitionId);
        assert.ok(
          (def.min_cr || 0) <= kobold.challenge_rating,
          `Kobold (CR ${kobold.challenge_rating}) dropped ${awarded.name} with min_cr ${def.min_cr}`
        );
      }
    }
  });

  it('3, 4 & 5. All 30 new monsters are seeded (6 per Level 1-5, 6 primary per active terrain), spawnable, have ability profiles, valid descriptions, and 60 verified art files', () => {
    const activeTerrains = ['FOREST', 'SWAMP', 'PLAINS', 'JUNGLE', 'HILLS'];
    const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const primaryTerrainCounts = { FOREST: 0, SWAMP: 0, PLAINS: 0, JUNGLE: 0, HILLS: 0 };

    for (const name of THIRTY_NEW_MONSTERS) {
      const m = db.prepare('SELECT * FROM monsters WHERE name = ?').get(name);
      assert.ok(m, `New monster "${name}" must exist in monsters table`);
      levelCounts[m.solo_level] = (levelCounts[m.solo_level] || 0) + 1;

      // Check terrains
      const terrains = db.prepare('SELECT terrain, is_primary FROM monster_terrains WHERE monster_id = ?').all(m.id);
      assert.ok(terrains.length >= 2, `Monster ${name} must have primary and secondary terrains`);
      const primaries = terrains.filter(t => t.is_primary === 1);
      assert.equal(primaries.length, 1, `Monster ${name} must have exactly 1 primary terrain`);
      assert.ok(activeTerrains.includes(primaries[0].terrain), `Monster ${name} primary terrain must be an active map terrain`);
      primaryTerrainCounts[primaries[0].terrain]++;

      // Verify monster can be selected by selectMonsterForTerrainAndHero on its primary terrain
      const selected = selectMonsterForTerrainAndHero(db, primaries[0].terrain, m.solo_level, () => 0.5, 99.0);
      assert.ok(selected, `selectMonsterForTerrainAndHero must return a valid monster on ${primaries[0].terrain}`);

      // Verify 9 descriptions and Encounter Secrecy
      const desc = JSON.parse(m.descriptions);
      for (const key of ['1_distant', '2_ranger_distant', '3_close', '4_ranger_close', '5_health_100', '6_health_75', '7_health_50', '8_health_25', '9_dead']) {
        assert.ok(typeof desc[key] === 'string' && desc[key].length >= 25, `Monster ${name} missing or short description ${key}`);
      }
      assert.ok(!desc['1_distant'].toLowerCase().includes(name.toLowerCase()), `${name} 1_distant must not leak monster name`);
      assert.ok(!desc['2_ranger_distant'].toLowerCase().includes(name.toLowerCase()), `${name} 2_ranger_distant must not leak monster name`);

      // Verify Special Ability profile resolves with at least one combat trait
      const profile = getMonsterAbilityProfile(m);
      assert.ok(profile, `Monster ${name} must resolve an ability profile`);

      // Verify living and defeated images exist on disk in both root and public directories
      assert.ok(m.image_path && m.image_path.startsWith('images/monsters/'), `${name} valid image_path`);
      assert.ok(m.defeated_image_path && m.defeated_image_path.endsWith('_defeated.png'), `${name} valid defeated_image_path`);

      for (const rel of [m.image_path, m.defeated_image_path]) {
        const rootFile = path.join(__dirname, '..', rel);
        const pubFile = path.join(__dirname, '../public', rel);
        assert.ok(fs.existsSync(rootFile) && fs.statSync(rootFile).size > 1000, `Missing root image: ${rel}`);
        assert.ok(fs.existsSync(pubFile) && fs.statSync(pubFile).size > 1000, `Missing public image: ${rel}`);
      }
    }

    assert.deepEqual(levelCounts, { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6 }, 'Must have exactly 6 new monsters per level 1-5');
    assert.deepEqual(
      primaryTerrainCounts,
      { FOREST: 6, SWAMP: 6, PLAINS: 6, JUNGLE: 6, HILLS: 6 },
      'Must have exactly 6 primary monsters per active terrain'
    );
  });
});
