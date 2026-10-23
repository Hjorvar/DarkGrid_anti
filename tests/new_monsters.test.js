const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestDb } = require('./test_helpers');
const { getEncounterById } = require('../src/domain/encounters/engine');

test('Verification: Five new Pathfinder monsters added and catalog entries verified', () => {
  const db = createTestDb();

  const allMonsters = db.prepare('SELECT * FROM monsters ORDER BY id ASC').all();
  assert.ok(allMonsters.length >= 5, 'Expected monster catalog to contain available monsters');

  const expectedRosterNames = [
    'Assassin Vine',
    'Ghoul',
    'Giant Spider',
    'Choker',
    'Rust Monster',
    'Manticore'
  ];

  for (const name of expectedRosterNames) {
    const exists = allMonsters.some(m => m.name === name);
    assert.ok(exists, `Expected monster ${name} must be present in database`);
  }

  const newExpectedMonsters = [
    { name: 'Ghoul', cr: 1.0, solo_level: 1, symbol: 'G', image: 'images/monsters/ghoul.png' },
    { name: 'Giant Spider', cr: 1.0, solo_level: 1, symbol: 'S', image: 'images/monsters/giant_spider.png' },
    { name: 'Choker', cr: 2.0, solo_level: 2, symbol: 'C', image: 'images/monsters/choker.png' },
    { name: 'Rust Monster', cr: 3.0, solo_level: 3, symbol: 'R', image: 'images/monsters/rust_monster.png' },
    { name: 'Manticore', cr: 5.0, solo_level: 5, symbol: 'M', image: 'images/monsters/manticore.png' }
  ];

  for (const exp of newExpectedMonsters) {
    const row = allMonsters.find(m => m.name === exp.name);
    assert.ok(row, `New monster ${exp.name} must exist in the database`);
    assert.equal(row.challenge_rating, exp.cr, `CR mismatch for ${exp.name}`);
    assert.equal(row.solo_level, exp.solo_level, `solo_level mismatch for ${exp.name}`);
    assert.equal(row.symbol, exp.symbol, `Symbol mismatch for ${exp.name}`);
    assert.equal(row.image_path, exp.image, `image_path mismatch for ${exp.name}`);
    assert.ok(row.source_url.startsWith('https://aonprd.com/'), `source_url must link to Archives of Nethys for ${exp.name}`);
  }
});

test('Verification: Every monster has complete required schema fields and all 9 custom descriptions', () => {
  const db = createTestDb();
  const monsters = db.prepare('SELECT * FROM monsters').all();

  const requiredDescKeys = [
    '1_distant', '2_ranger_distant', '3_close', '4_ranger_close',
    '5_health_100', '6_health_75', '7_health_50', '8_health_25', '9_dead'
  ];

  for (const m of monsters) {
    // Check mandatory fields
    assert.ok(m.name, `Missing name for ID ${m.id}`);
    assert.ok(m.symbol, `Missing symbol for ${m.name}`);
    assert.ok(m.color, `Missing color for ${m.name}`);
    assert.ok(m.base_hp > 0, `base_hp must be > 0 for ${m.name}`);
    assert.ok(m.xp_reward >= 0, `xp_reward must be >= 0 for ${m.name}`);
    assert.ok(m.damage_dice, `Missing damage_dice for ${m.name}`);
    assert.notEqual(m.initiative_bonus, null, `Missing initiative_bonus for ${m.name}`);
    assert.ok(m.armor_class > 0, `armor_class must be > 0 for ${m.name}`);
    assert.notEqual(m.attack_bonus, null, `Missing attack_bonus for ${m.name}`);
    assert.ok(m.challenge_rating >= 0, `challenge_rating must be >= 0 for ${m.name}`);
    assert.ok(m.movement_type, `Missing movement_type for ${m.name}`);
    assert.ok(m.creature_type, `Missing creature_type for ${m.name}`);

    // Verify habitat is valid JSON array
    const habitats = JSON.parse(m.habitat);
    assert.ok(Array.isArray(habitats) && habitats.length > 0, `Invalid habitat for ${m.name}`);

    // Verify all 9 descriptions exist and are non-empty
    const descs = JSON.parse(m.descriptions);
    for (const key of requiredDescKeys) {
      assert.ok(descs[key] && descs[key].trim().length > 0, `Missing description ${key} for ${m.name}`);
    }
  }
});

test('Verification: Monster artwork files exist and link correctly in encounter resolution', async () => {
  const db = createTestDb();
  const { registerUser } = require('../src/domain/auth/service');
  const { createCharacter } = require('../src/domain/character/rules');

  const user = await registerUser(db, 'ArtTester', 'password123');
  const char = createCharacter(db, {
    userId: user.id,
    name: 'ArtTester',
    classType: 'RANGER',
    stats: { strength: 12, constitution: 10, dexterity: 16, intelligence: 11, wisdom: 13, charisma: 10 }
  });

  const newMonsters = ['Ghoul', 'Giant Spider', 'Choker', 'Rust Monster', 'Manticore'];

  for (const name of newMonsters) {
    const row = db.prepare('SELECT * FROM monsters WHERE name = ?').get(name);
    assert.ok(row, `Monster ${name} found`);

    // Verify image files exist on disk
    const diskPath1 = path.join(__dirname, '../', row.image_path);
    const diskPath2 = path.join(__dirname, '../public/', row.image_path);
    assert.ok(fs.existsSync(diskPath1), `Image file missing at ${diskPath1}`);
    assert.ok(fs.existsSync(diskPath2), `Public image file missing at ${diskPath2}`);

    // Create a mock encounter for this monster and verify getEncounterById resolves imageUrl
    const insertStmt = db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
      VALUES (?, 1, ?, 'DISCOVERED', ?)
    `);
    const encResult = insertStmt.run(char.id, row.id, row.base_hp);
    const resolvedEncounter = getEncounterById(db, Number(encResult.lastInsertRowid), 'RANGER');

    assert.ok(resolvedEncounter);
    assert.equal(resolvedEncounter.monster_name, name);
    assert.equal(resolvedEncounter.imageUrl, '/' + row.image_path);
    assert.ok(resolvedEncounter.resolvedDescription, `Resolved description must be present for ${name}`);
    assert.equal(resolvedEncounter.isRangerSpecial, true, `Ranger should receive 2_ranger_distant for ${name}`);

    // Mark as IGNORED so character can encounter the next monster
    db.prepare("UPDATE encounters SET status = 'IGNORED' WHERE id = ?").run(resolvedEncounter.id);
  }
});
