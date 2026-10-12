const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { selectMonsterForTerrainAndHero } = require('../src/domain/encounters/engine');

test('monster_terrains: table schema, foreign keys, and unique constraints', () => {
  const db = createTestDb();

  // Verify PRAGMA foreign_key_check passes cleanly
  const fkErrors = db.prepare('PRAGMA foreign_key_check').all();
  assert.deepEqual(fkErrors, [], 'Foreign key check must return zero errors');

  // Verify table columns
  const cols = db.prepare('PRAGMA table_info(monster_terrains)').all();
  const colNames = cols.map(c => c.name);
  assert.ok(colNames.includes('id'));
  assert.ok(colNames.includes('monster_id'));
  assert.ok(colNames.includes('terrain'));
  assert.ok(colNames.includes('is_primary'));

  // Verify indexes exist
  const indexes = db.prepare('PRAGMA index_list(monster_terrains)').all();
  const indexNames = indexes.map(i => i.name);
  assert.ok(indexNames.includes('idx_monster_terrains_terrain'));
  assert.ok(indexNames.includes('one_primary_terrain_per_monster'));
});

test('monster_terrains: every monster has valid terrains and exactly ONE primary terrain', () => {
  const db = createTestDb();
  const monsters = db.prepare('SELECT id, name FROM monsters').all();

  for (const m of monsters) {
    const terrains = db.prepare('SELECT * FROM monster_terrains WHERE monster_id = ?').all(m.id);
    assert.ok(terrains.length > 0, `Monster ${m.name} must have at least one terrain`);

    const primaryTerrains = terrains.filter(t => t.is_primary === 1);
    assert.equal(
      primaryTerrains.length,
      1,
      `Monster ${m.name} must have exactly one primary terrain (found ${primaryTerrains.length})`
    );
  }
});

test('monster_terrains: rejects duplicate (monster_id, terrain) insertion', () => {
  const db = createTestDb();
  const vine = db.prepare("SELECT id FROM monsters WHERE name = 'Assassin Vine'").get();
  assert.ok(vine);

  // Attempting to insert FOREST a second time for Assassin Vine must throw SQLITE_CONSTRAINT
  assert.throws(() => {
    db.prepare(`
      INSERT INTO monster_terrains (monster_id, terrain, is_primary)
      VALUES (?, 'FOREST', 0)
    `).run(vine.id);
  }, /UNIQUE constraint failed/i);
});

test('monster_terrains: rejects a second primary terrain for the same monster', () => {
  const db = createTestDb();
  const ghoul = db.prepare("SELECT id FROM monsters WHERE name = 'Ghoul'").get();
  assert.ok(ghoul);

  // Ghoul already has UNDERGROUND_RUINS as primary (is_primary = 1)
  // Attempting to insert a new terrain with is_primary = 1 must be rejected by partial unique index
  assert.throws(() => {
    db.prepare(`
      INSERT INTO monster_terrains (monster_id, terrain, is_primary)
      VALUES (?, 'HILLS', 1)
    `).run(ghoul.id);
  }, /UNIQUE constraint failed/i);
});

test('monster_terrains: encounter engine queries via monster_terrains accurately', () => {
  const db = createTestDb();

  // Test selecting in Hills (Manticore, Choker, Rust Monster, Feral Wolf)
  for (let i = 0; i < 20; i++) {
    const picked = selectMonsterForTerrainAndHero(db, 'HILLS', 3);
    assert.ok(picked, 'Should pick a monster in HILLS');

    // Confirm that the picked monster has an entry in monster_terrains for HILLS
    const mapping = db.prepare(`
      SELECT 1 FROM monster_terrains WHERE monster_id = ? AND terrain = 'HILLS'
    `).get(picked.id);
    assert.ok(mapping, `Picked monster ${picked.name} must be linked to HILLS in monster_terrains`);
  }

  // Test selecting in Jungle (Assassin Vine, Giant Spider)
  for (let i = 0; i < 20; i++) {
    const picked = selectMonsterForTerrainAndHero(db, 'JUNGLE', 1);
    assert.ok(picked, 'Should pick a monster in JUNGLE');

    const mapping = db.prepare(`
      SELECT 1 FROM monster_terrains WHERE monster_id = ? AND terrain = 'JUNGLE'
    `).get(picked.id);
    assert.ok(mapping, `Picked monster ${picked.name} must be linked to JUNGLE in monster_terrains`);
  }
});

test('creature_type: all monsters have standard Pathfinder 1e creature types populated', () => {
  const db = createTestDb();
  const monsters = db.prepare('SELECT id, name, creature_type, creature_subtype FROM monsters').all();

  const validPrimaryTypes = [
    'Aberration', 'Animal', 'Construct', 'Dragon', 'Fey',
    'Humanoid', 'Magical Beast', 'Monstrous Humanoid', 'Ooze',
    'Outsider', 'Plant', 'Undead', 'Vermin'
  ];

  for (const m of monsters) {
    assert.ok(m.creature_type, `Monster ${m.name} must have creature_type defined`);
    assert.ok(
      validPrimaryTypes.includes(m.creature_type),
      `Monster ${m.name} creature_type '${m.creature_type}' must be a valid Pathfinder 1e type`
    );
  }
});
