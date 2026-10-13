const { createTestDb } = require('../tests/test_helpers');
const db = createTestDb();

console.log('--- 1. MAP_TILES SCHEMA ---');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'map_tiles'").get();
console.log(schema.sql);

console.log('\n--- 2. MAP TILES BY TERRAIN & PASSABILITY ---');
const tileStats = db.prepare("SELECT terrain, is_passable, count(*) as count FROM map_tiles GROUP BY terrain, is_passable ORDER BY terrain").all();
console.table(tileStats);

console.log('\n--- 3. SPECIAL FEATURES ON MAP TILES ---');
const features = db.prepare("SELECT id, x, y, name, terrain, feature, is_passable, is_safe FROM map_tiles WHERE feature IS NOT NULL").all();
console.table(features);

console.log('\n--- 4. MONSTER_TERRAINS DISTINCT VALUES ---');
const monsterTerrains = db.prepare("SELECT DISTINCT terrain FROM monster_terrains ORDER BY terrain").all();
console.table(monsterTerrains);

console.log('\n--- 5. MONSTERS PER TERRAIN COUNT ---');
const monsterTerrainCounts = db.prepare("SELECT terrain, is_primary, count(*) as count FROM monster_terrains GROUP BY terrain, is_primary ORDER BY terrain, is_primary DESC").all();
console.table(monsterTerrainCounts);

console.log('\n--- 6. CURRENT TERRAIN_ARTWORKS MAPPINGS ---');
const artworks = db.prepare("SELECT id, terrain_type, location_key, tile_id, image_path, title, is_active FROM terrain_artworks ORDER BY id").all();
console.table(artworks);
