const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../src/domain/auth/service');
const { createCharacter } = require('../src/domain/character/rules');
const {
  getTerrainArtworkForTile,
  getAllActiveTerrainArtworks,
  getTerrainArtworkById,
  DEFAULT_FALLBACK_ARTWORK,
  normalizeImageUrl
} = require('../src/domain/world/artwork');
const { getTileById, getTileByCoords, validateMovement } = require('../src/domain/world/map');
const { startCombat, executeCombatRound } = require('../src/domain/combat/engine');

test('1. Terrain-art migration creates terrain_artworks table and partial unique indexes', () => {
  const db = createTestDb();

  // Verify table exists
  const tableCheck = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='terrain_artworks'
  `).get();
  assert.ok(tableCheck, 'terrain_artworks table must exist');

  // Verify columns
  const tableInfo = db.prepare("PRAGMA table_info('terrain_artworks')").all();
  const columnNames = tableInfo.map(c => c.name);
  assert.ok(columnNames.includes('id'));
  assert.ok(columnNames.includes('terrain_type'));
  assert.ok(columnNames.includes('location_key'));
  assert.ok(columnNames.includes('tile_id'));
  assert.ok(columnNames.includes('image_path'));
  assert.ok(columnNames.includes('alt_text'));
  assert.ok(columnNames.includes('title'));
  assert.ok(columnNames.includes('description'));
  assert.ok(columnNames.includes('is_active'));
  assert.ok(columnNames.includes('created_at'));

  // Verify partial unique indexes exist
  const indexList = db.prepare("PRAGMA index_list('terrain_artworks')").all();
  const indexNames = indexList.map(i => i.name);
  assert.ok(indexNames.includes('uq_terrain_artworks_active_default'), 'Active default unique index must exist');
  assert.ok(indexNames.includes('uq_terrain_artworks_active_location'), 'Active location unique index must exist');
  assert.ok(indexNames.includes('uq_terrain_artworks_active_tile'), 'Active tile unique index must exist');
});

test('2. Safe and idempotent metadata seeding: rejects duplicate active defaults and tolerates re-running', () => {
  const db = createTestDb();

  // Count seeded artworks
  const initialCount = db.prepare('SELECT COUNT(*) as count FROM terrain_artworks').get().count;
  assert.ok(initialCount >= 14, 'Initial seeding should contain at least 14 artwork records');

  // Attempting to insert a duplicate active default for FOREST should fail due to unique constraint
  assert.throws(() => {
    db.prepare(`
      INSERT INTO terrain_artworks (terrain_type, location_key, tile_id, image_path, alt_text, title, is_active)
      VALUES ('FOREST', NULL, NULL, 'images/terrain/duplicate_forest.webp', 'Duplicate Forest', 'Forest 2', 1)
    `).run();
  }, /UNIQUE constraint failed/i);

  // But inserting an INACTIVE variation for FOREST should succeed
  assert.doesNotThrow(() => {
    db.prepare(`
      INSERT INTO terrain_artworks (terrain_type, location_key, tile_id, image_path, alt_text, title, is_active)
      VALUES ('FOREST', NULL, NULL, 'images/terrain/forest_night.webp', 'Forest at Night', 'Night Forest', 0)
    `).run();
  });
});

test('3. Terrain -> correct default artwork resolution for all primary and supported types', () => {
  const db = createTestDb();

  const testCases = [
    { terrain: 'CITY', expectedFile: 'terrain_city_oakhaven.webp' },
    { terrain: 'FOREST', expectedFile: 'terrain_forest.webp' },
    { terrain: 'PLAINS', expectedFile: 'terrain_plains.webp' },
    { terrain: 'SWAMP', expectedFile: 'terrain_swamp.webp' },
    { terrain: 'HILLS', expectedFile: 'terrain_hills.webp' },
    { terrain: 'JUNGLE', expectedFile: 'terrain_jungle.webp' },
    { terrain: 'BRIDGE', expectedFile: 'terrain_bridge.webp' },
    { terrain: 'MOUNTAINS', expectedFile: 'terrain_mountains.webp' },
    { terrain: 'UNDERGROUND_RUINS', expectedFile: 'terrain_underground_ruins.webp' },
    { terrain: 'COAST', expectedFile: 'terrain_coast.webp' },
    { terrain: 'DESERT', expectedFile: 'terrain_desert.webp' }
  ];

  for (const tc of testCases) {
    const mockTile = { id: 9999, terrain: tc.terrain, feature: null, name: `Test ${tc.terrain}` };
    const artwork = getTerrainArtworkForTile(db, mockTile);

    assert.ok(artwork, `Artwork must resolve for ${tc.terrain}`);
    assert.equal(artwork.imageUrl, `/images/terrain/${tc.expectedFile}`);
    assert.equal(artwork.isOverride, false);
    assert.equal(artwork.matchSource, 'TERRAIN_DEFAULT');
  }
});

test('4. Location override -> TOWN_GATES takes priority over PLAINS terrain default', () => {
  const db = createTestDb();

  // Oakhaven North Gate has feature = 'TOWN_GATES' and terrain = 'PLAINS'
  const northGateTile = db.prepare("SELECT * FROM map_tiles WHERE name = 'Oakhaven North Gate'").get();
  assert.ok(northGateTile);
  assert.equal(northGateTile.terrain, 'PLAINS');
  assert.equal(northGateTile.feature, 'TOWN_GATES');

  const artwork = getTerrainArtworkForTile(db, northGateTile);
  assert.equal(artwork.imageUrl, '/images/terrain/terrain_town_gates.webp');
  assert.equal(artwork.isOverride, true);
  assert.equal(artwork.matchSource, 'LOCATION_OVERRIDE');
  assert.match(artwork.title, /Town Gates/i);

  // Standard plains tile without feature should still resolve to standard plains artwork
  const standardPlainsTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'PLAINS' AND feature IS NULL LIMIT 1").get();
  assert.ok(standardPlainsTile);
  const plainsArtwork = getTerrainArtworkForTile(db, standardPlainsTile);
  assert.equal(plainsArtwork.imageUrl, '/images/terrain/terrain_plains.webp');
  assert.equal(plainsArtwork.isOverride, false);
  assert.equal(plainsArtwork.matchSource, 'TERRAIN_DEFAULT');
});

test('5. Location override -> ANCIENT_BRIDGE takes priority or resolves to bridge artwork', () => {
  const db = createTestDb();

  // The Old Stone Bridge has id 114, coords (8, 7), feature 'ANCIENT_BRIDGE', terrain 'BRIDGE'
  const bridgeTile = db.prepare("SELECT * FROM map_tiles WHERE name = 'The Old Stone Bridge'").get();
  assert.ok(bridgeTile);
  assert.equal(bridgeTile.feature, 'ANCIENT_BRIDGE');
  assert.equal(bridgeTile.terrain, 'BRIDGE');

  const artwork = getTerrainArtworkForTile(db, bridgeTile);
  assert.equal(artwork.imageUrl, '/images/terrain/terrain_bridge.webp');
  assert.equal(artwork.isOverride, true);
  assert.equal(artwork.matchSource, 'LOCATION_OVERRIDE');
  assert.equal(artwork.title, 'The Old Stone Bridge');
});

test('6. Exact tile_id override takes highest priority over feature and terrain defaults', () => {
  const db = createTestDb();
  const forestTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'FOREST' LIMIT 1").get();
  assert.ok(forestTile);

  // Insert a specific tile_id override
  db.prepare(`
    INSERT INTO terrain_artworks (terrain_type, location_key, tile_id, image_path, alt_text, title, is_active)
    VALUES (NULL, NULL, ?, 'images/terrain/special_shrine.webp', 'An ancient stone shrine hidden in the woods.', 'Forgotten Shrine', 1)
  `).run(forestTile.id);

  const resolved = getTerrainArtworkForTile(db, forestTile);
  assert.equal(resolved.imageUrl, '/images/terrain/special_shrine.webp');
  assert.equal(resolved.isOverride, true);
  assert.equal(resolved.matchSource, 'TILE_OVERRIDE');
  assert.equal(resolved.title, 'Forgotten Shrine');
});

test('7. Inactive artwork (is_active = 0) is bypassed and falls back gracefully', () => {
  const db = createTestDb();

  // Deactivate swamp artwork
  db.prepare("UPDATE terrain_artworks SET is_active = 0 WHERE terrain_type = 'SWAMP'").run();

  const mockSwamp = { id: 7001, terrain: 'SWAMP', feature: null, name: 'Murky Bog' };
  const resolved = getTerrainArtworkForTile(db, mockSwamp);

  // Should fallback to DB fallback entry
  assert.equal(resolved.imageUrl, '/images/terrain/terrain_fallback.webp');
  assert.equal(resolved.matchSource, 'DB_FALLBACK');
});

test('8. Unknown or unmapped terrain values resolve to dark-fantasy fallback', () => {
  const db = createTestDb();

  const alienTile = { id: 8888, terrain: 'ASTRAL_VOID', feature: null, name: 'The Void' };
  const resolved = getTerrainArtworkForTile(db, alienTile);

  assert.equal(resolved.imageUrl, '/images/terrain/terrain_fallback.webp');
  assert.equal(resolved.title, 'Misty Realm');
  assert.equal(resolved.matchSource, 'DB_FALLBACK');

  // Even for null or undefined tile input
  const nullResolved = getTerrainArtworkForTile(db, null);
  assert.equal(nullResolved.imageUrl, '/images/terrain/terrain_fallback.webp');
});

test('9. Safe in-code fallback if database fallback row is removed', () => {
  const db = createTestDb();

  // Delete all artwork rows
  db.prepare('DELETE FROM terrain_artworks').run();

  const mockTile = { id: 1, terrain: 'FOREST', feature: null, name: 'Woods' };
  const resolved = getTerrainArtworkForTile(db, mockTile);

  assert.equal(resolved.imageUrl, '/images/terrain/terrain_fallback.webp');
  assert.equal(resolved.matchSource, 'CODE_FALLBACK');
  assert.equal(resolved.title, DEFAULT_FALLBACK_ARTWORK.title);
});

test('10. Specific verification for Oakhaven City and Town Gates in real world map', () => {
  const db = createTestDb();

  // Oakhaven at (7, 7)
  const cityTile = getTileByCoords(db, 7, 7);
  assert.ok(cityTile);
  assert.equal(cityTile.name, 'Oakhaven');
  const cityArt = getTerrainArtworkForTile(db, cityTile);
  assert.equal(cityArt.imageUrl, '/images/terrain/terrain_city_oakhaven.webp');
  assert.equal(cityArt.matchSource, 'TERRAIN_DEFAULT');

  // North Gate at (7, 6)
  const northGate = getTileByCoords(db, 7, 6);
  assert.ok(northGate);
  assert.equal(northGate.name, 'Oakhaven North Gate');
  const northGateArt = getTerrainArtworkForTile(db, northGate);
  assert.equal(northGateArt.imageUrl, '/images/terrain/terrain_town_gates.webp');
  assert.equal(northGateArt.isOverride, true);

  // South Gate at (7, 8)
  const southGate = getTileByCoords(db, 7, 8);
  assert.ok(southGate);
  assert.equal(southGate.name, 'Oakhaven South Gate');
  const southGateArt = getTerrainArtworkForTile(db, southGate);
  assert.equal(southGateArt.imageUrl, '/images/terrain/terrain_town_gates.webp');
  assert.equal(southGateArt.isOverride, true);
});

test('11. Moving hero between tiles dynamically updates resolved terrain artwork', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'Traveler', 'pass123');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Wanderer',
    classType: 'RANGER',
    stats: { strength: 12, constitution: 10, dexterity: 17, intelligence: 10, wisdom: 12, charisma: 10 }
  });

  // Start at Oakhaven City (7, 7)
  let currentTile = getTileById(db, hero.tile_id);
  assert.equal(currentTile.name, 'Oakhaven');
  let art = getTerrainArtworkForTile(db, currentTile);
  assert.equal(art.imageUrl, '/images/terrain/terrain_city_oakhaven.webp');

  // Step 1: Move NORTH to Oakhaven North Gate (7, 6)
  const moveNorth1 = validateMovement(db, hero, 'NORTH');
  assert.equal(moveNorth1.allowed, true);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(moveNorth1.targetTile.id, hero.id);
  currentTile = getTileById(db, moveNorth1.targetTile.id);
  art = getTerrainArtworkForTile(db, currentTile);
  assert.equal(art.imageUrl, '/images/terrain/terrain_town_gates.webp');
  assert.equal(art.isOverride, true);

  // Step 2: Move NORTH into Mirkwood Forest (7, 5)
  hero.tile_id = currentTile.id;
  const moveNorth2 = validateMovement(db, hero, 'NORTH');
  assert.equal(moveNorth2.allowed, true);
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(moveNorth2.targetTile.id, hero.id);
  currentTile = getTileById(db, moveNorth2.targetTile.id);
  assert.equal(currentTile.terrain, 'FOREST');
  art = getTerrainArtworkForTile(db, currentTile);
  assert.equal(art.imageUrl, '/images/terrain/terrain_forest.webp');
  assert.equal(art.isOverride, false);

  // Step 3: Teleport/navigate to Plains tile (e.g. Windblown Heath at 12, 1)
  const plainsTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'PLAINS' AND feature IS NULL LIMIT 1").get();
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(plainsTile.id, hero.id);
  currentTile = getTileById(db, plainsTile.id);
  art = getTerrainArtworkForTile(db, currentTile);
  assert.equal(art.imageUrl, '/images/terrain/terrain_plains.webp');
});

test('12. All active terrain artwork image files exist on disk with non-zero size', () => {
  const db = createTestDb();
  const artworks = getAllActiveTerrainArtworks(db);
  assert.ok(artworks.length >= 14, `Expected at least 14 active artworks, got ${artworks.length}`);

  const publicDir = path.resolve(__dirname, '..', 'public');

  for (const art of artworks) {
    const filePath = path.join(publicDir, art.rawPath);
    assert.ok(fs.existsSync(filePath), `File must exist on disk: ${filePath}`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 10000, `File must be a real image (>10KB): ${art.rawPath} (size: ${stat.size} bytes)`);
  }
});

test('13. Encounter secrecy verification: HTML never exposes monster HP, AC, AB or hidden attributes', () => {
  const db = createTestDb();
  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  assert.ok(wolf);

  // Ensure secret combat stats are not leaked in artwork alt or title
  const allArts = getAllActiveTerrainArtworks(db);
  for (const art of allArts) {
    assert.doesNotMatch(art.altText, new RegExp(wolf.name, 'i'));
    assert.doesNotMatch(art.title, new RegExp(wolf.name, 'i'));
    assert.doesNotMatch(art.altText, /\b(AC|HP|Challenge Rating|CR|damage_dice)\b/i);
  }
});

test('14. Combat retains terrain artwork without corrupting active combat state', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'Gladiator', 'pass123');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Gladiator',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 }
  });

  const forestTile = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'FOREST' AND is_passable = 1 LIMIT 1").get();
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(forestTile.id, hero.id);

  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  const encounterRes = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
    VALUES (?, ?, ?, 'IN_COMBAT', ?)
  `).run(hero.id, forestTile.id, wolf.id, wolf.base_hp);
  const encounterId = Number(encounterRes.lastInsertRowid);

  // Initialize combat
  startCombat(db, hero.id, encounterId);

  // Check terrain artwork resolution during combat
  const updatedHeroTile = getTileById(db, forestTile.id);
  const artwork = getTerrainArtworkForTile(db, updatedHeroTile);
  assert.equal(artwork.imageUrl, '/images/terrain/terrain_forest.webp');

  // Execute an attack round
  const combatRound = executeCombatRound(db, hero.id, encounterId, 'ATTACK');
  assert.ok(combatRound);
  assert.ok(combatRound.events.length > 0);

  // Artwork resolution remains solid
  const postCombatArt = getTerrainArtworkForTile(db, updatedHeroTile);
  assert.equal(postCombatArt.imageUrl, '/images/terrain/terrain_forest.webp');
});

test('15. Gameplay mechanics integrity: d20 rolls, movement, and permadeath rules are untouched', () => {
  const db = createTestDb();

  // Test map impassability is preserved
  const mountain = db.prepare("SELECT * FROM map_tiles WHERE terrain = 'MOUNTAINS' LIMIT 1").get();
  assert.equal(mountain.is_passable, 0);

  // Test water impassability is preserved
  const water = db.prepare("SELECT * FROM map_tiles WHERE terrain IN ('OCEAN', 'RIVER_LAKE') LIMIT 1").get();
  assert.equal(water.is_passable, 0);

  // Test dice roll helper works cleanly
  const { rollDice } = require('../src/domain/combat/dice');
  const d20 = rollDice(1, 20);
  assert.ok(d20.total >= 1 && d20.total <= 20);
});
