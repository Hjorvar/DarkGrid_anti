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
      strength: 12, constitution: 10, dexterity: 17, intelligence: 10, wisdom: 12, charisma: 10
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
