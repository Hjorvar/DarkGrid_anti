const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../src/domain/auth/service');
const { createCharacter } = require('../src/domain/character/rules');
const {
  getTileById,
  getTileByCoords,
  getMinimapData,
  getAvailableDirections,
  validateMovement
} = require('../src/domain/world/map');

test('Valid navigation moves hero to neighbor tile and updates database', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'Legolas', 'secret123');

  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Legolas',
    classType: 'RANGER',
    stats: {
      strength: 12, constitution: 10, dexterity: 17, intelligence: 11, wisdom: 12, charisma: 10
    }
  });

  const startTile = getTileById(db, hero.tile_id);
  assert.equal(startTile.x, 7);
  assert.equal(startTile.y, 7);

  // Moving NORTH: (7, 7) -> (7, 6)
  const validation = validateMovement(db, hero, 'NORTH');
  assert.equal(validation.allowed, true);
  assert.equal(validation.targetTile.x, 7);
  assert.equal(validation.targetTile.y, 6);

  // Apply movement
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(validation.targetTile.id, hero.id);

  // Reload character and verify DB persistence
  const updatedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(updatedHero.tile_id, validation.targetTile.id);
  const newTile = getTileById(db, updatedHero.tile_id);
  assert.equal(newTile.x, 7);
  assert.equal(newTile.y, 6);
});

test('Rejects movement outside map boundaries', () => {
  const db = createTestDb();

  // Find a tile on the border, say (0, 0)
  const cornerTile = getTileByCoords(db, 0, 0);
  assert.ok(cornerTile);

  const mockChar = { id: 1, tile_id: cornerTile.id };

  // Attempting to move WEST or NORTH from (0, 0)
  const westCheck = validateMovement(db, mockChar, 'WEST');
  assert.equal(westCheck.allowed, false);
  assert.match(westCheck.reason, /edge of the world/i);

  const northCheck = validateMovement(db, mockChar, 'NORTH');
  assert.equal(northCheck.allowed, false);
});

test('Rejects movement into impassable terrain (mountains / deep water)', () => {
  const db = createTestDb();

  // River tile at (9, 6) is impassable (is_passable = 0)
  const riverTile = getTileByCoords(db, 9, 6);
  assert.ok(riverTile);
  assert.equal(riverTile.is_passable, 0);

  // Place character on adjacent passable plains tile at (8, 6)
  const adjacentTile = getTileByCoords(db, 8, 6);
  assert.ok(adjacentTile);
  assert.equal(adjacentTile.is_passable, 1);

  const mockChar = { id: 1, tile_id: adjacentTile.id };

  // Moving EAST attempts to step into the impassable river
  const eastCheck = validateMovement(db, mockChar, 'EAST');
  assert.equal(eastCheck.allowed, false);
  assert.match(eastCheck.reason, /impassable/i);
});

test('Minimap produces 5x5 grid with player in the center', () => {
  const db = createTestDb();
  const centerTile = getTileByCoords(db, 7, 7);
  const minimap = getMinimapData(db, centerTile, 2);

  assert.equal(minimap.rows.length, 5);
  minimap.rows.forEach(row => {
    assert.equal(row.length, 5);
  });

  // Center cell (index [2][2]) is the player
  const centerCell = minimap.rows[2][2];
  assert.equal(centerCell.x, 7);
  assert.equal(centerCell.y, 7);
  assert.equal(centerCell.isPlayer, true);
  assert.equal(centerCell.symbol, '@');
});

test('Minimap displays skull icon (💀) on tiles with an active persistent monster without leaking species name', () => {
  const db = createTestDb();
  const centerTile = getTileByCoords(db, 7, 7);
  const neighborTile = getTileByCoords(db, 7, 6); // 1 step North of (7, 7) -> row 1, col 2
  const monster = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();

  // Insert active persistent monster on (7, 6)
  const pmRes = db.prepare(`
    INSERT INTO monster_instances (monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, status)
    VALUES (?, ?, 25, 25, 10, 2, 'ACTIVE')
  `).run(monster.id, neighborTile.id);
  const pmId = Number(pmRes.lastInsertRowid);

  const minimap = getMinimapData(db, centerTile, 2);
  const northCell = minimap.rows[1][2];

  assert.equal(northCell.x, 7);
  assert.equal(northCell.y, 6);
  assert.equal(northCell.hasPersistentMonster, true);
  assert.equal(northCell.persistentKillCount, 2);
  assert.equal(northCell.symbol, '💀');
  assert.ok(northCell.label.includes('Persistent Threat (2 fallen heroes)'), 'Label should indicate persistent threat and fallen count');
  assert.ok(!northCell.label.includes('Wolf'), 'Minimap label must NOT leak monster species name');

  // When defeated, minimap returns to normal terrain icon
  db.prepare("UPDATE monster_instances SET status = 'DEFEATED' WHERE id = ?").run(pmId);
  const minimapAfter = getMinimapData(db, centerTile, 2);
  const northCellAfter = minimapAfter.rows[1][2];
  assert.equal(northCellAfter.hasPersistentMonster, false);
  assert.notEqual(northCellAfter.symbol, '💀');
});

