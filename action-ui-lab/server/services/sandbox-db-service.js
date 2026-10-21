/**
 * DARKGRID ADVENTURE LAB — Sandbox SQLite Initialization, Schema Extensions & Hero Seeding
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations, runSeeds } = require('../../../src/db/migrate');
const {
  getLivingCharacterByUserId,
  createCharacter
} = require('../../../src/domain/character/rules');
const { initSceneCatalogTables, normalizeSceneMode } = require('../../scene-catalog');

const DATA_DIR = path.join(__dirname, '../../data');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'action_lab.sqlite');

function applyLabSchemaAndTestMap(db) {
  const cols = db.prepare('PRAGMA table_info(characters)').all().map(c => c.name);
  if (!cols.includes('facing')) {
    db.exec("ALTER TABLE characters ADD COLUMN facing TEXT NOT NULL DEFAULT 'NORTH';");
  }
  if (!cols.includes('pending_victory_encounter_id')) {
    db.exec('ALTER TABLE characters ADD COLUMN pending_victory_encounter_id INTEGER DEFAULT NULL;');
  }
  if (!cols.includes('scene_mode')) {
    db.exec("ALTER TABLE characters ADD COLUMN scene_mode TEXT NOT NULL DEFAULT 'C';");
  }

  // Ensure terrain_artworks mappings exist for river, ocean, and sunken ruins in the sandbox DB
  db.prepare(`
    INSERT OR IGNORE INTO terrain_artworks (
      terrain_type, location_key, tile_id, image_path, alt_text, title, description, is_active
    ) VALUES
      ('RIVER_LAKE', NULL, NULL, 'images/terrain/terrain_coast.webp', 'Dark churning river waters cutting across the wilds.', 'Blackwater River', 'Turbulent black waters blocking passage on foot.', 1),
      ('OCEAN', NULL, NULL, 'images/terrain/terrain_coast.webp', 'Crashing black sea waves against jagged cliffs.', 'The Murksea', 'Abyssal ocean swells crashing against stone cliffs.', 1),
      (NULL, 'SUNK_RUIN', NULL, 'images/terrain/terrain_underground_ruins.webp', 'Crumbling stone ruins and sunken arches.', 'Sunken Ruins', 'Ancient weathered masonry half-swallowed by the wilds.', 1)
  `).run();

  // Initialize multi-variant scene catalog and directional override tables
  initSceneCatalogTables(db);

  // Enrich the local test map around Oakhaven (7,7) so terrain transitions, passable paths,
  // and impassable obstacles can be tested within 1-2 steps of spawn:
  // 1. (6, 5) Stonefang Crag: Impassable MOUNTAINS directly West of (7, 5) Mirkwood Forest.
  db.prepare(`
    UPDATE map_tiles
    SET name = 'Stonefang Crag',
        terrain = 'MOUNTAINS',
        feature = NULL,
        description = 'A sheer wall of jagged black granite rising abruptly from the forest floor, blocking passage to the west.',
        is_passable = 0,
        is_safe = 0
    WHERE x = 6 AND y = 5
  `).run();

  // 2. (8, 6) and (8, 8) Blackwater River: Impassable river channel flowing North and South under The Old Stone Bridge (8, 7).
  db.prepare(`
    UPDATE map_tiles
    SET name = 'Blackwater River',
        terrain = 'RIVER_LAKE',
        feature = NULL,
        description = 'Dark, churning river waters rushing beneath the stone bridge arches, too deep and swift to ford on foot.',
        is_passable = 0,
        is_safe = 0
    WHERE x = 8 AND y IN (6, 8)
  `).run();

  // 3. (9, 7) Bridge East Watchpost: Passable UNDERGROUND_RUINS at the eastern end of The Old Stone Bridge (8, 7).
  db.prepare(`
    UPDATE map_tiles
    SET name = 'Bridge East Watchpost',
        terrain = 'UNDERGROUND_RUINS',
        feature = 'SUNK_RUIN',
        description = 'Crumbling stone watchtower ruins at the eastern end of the Old Stone Bridge, overlooking the Blackwater River.',
        is_passable = 1,
        is_safe = 0
    WHERE x = 9 AND y = 7
  `).run();
}

function initSandboxDb(customDbPath = null) {
  const targetDbPath = customDbPath || DEFAULT_DB_PATH;
  const targetDir = path.dirname(targetDbPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const db = new DatabaseSync(targetDbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  runMigrations(db);
  runSeeds(db);
  applyLabSchemaAndTestMap(db);

  // Ensure sandbox demo user exists
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get('action_hero');
  if (!user) {
    const res = db.prepare(`
      INSERT INTO users (username, password_hash)
      VALUES ('action_hero', 'sandbox_hash_not_used')
    `).run();
    user = { id: Number(res.lastInsertRowid), username: 'action_hero' };
  }

  ensureLivingHero(db, user.id);
  return { db, userId: user.id, dbPath: targetDbPath };
}

function ensureLivingHero(db, userId, classOverride = null, sceneModeOverride = null) {
  let hero = getLivingCharacterByUserId(db, userId);
  if (hero) return hero;

  let initialSceneMode = 'C';
  if (sceneModeOverride) {
    initialSceneMode = normalizeSceneMode(sceneModeOverride);
  } else {
    const lastChar = db.prepare('SELECT scene_mode FROM characters WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    if (lastChar && lastChar.scene_mode) {
      initialSceneMode = normalizeSceneMode(lastChar.scene_mode);
    }
  }

  const chosenClass = classOverride || 'FIGHTER';
  const statsByClass = {
    FIGHTER: { strength: 16, constitution: 13, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 10 },
    RANGER: { strength: 12, constitution: 11, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 10 },
    CLERIC: { strength: 13, constitution: 11, dexterity: 10, intelligence: 10, wisdom: 15, charisma: 12 }
  };
  const namesByClass = {
    FIGHTER: 'Vaelen Ironhand',
    RANGER: 'Kaelen Thornstrider',
    CLERIC: 'Brother Aldric'
  };

  hero = createCharacter(db, {
    userId,
    name: namesByClass[chosenClass] || 'Vaelen Ironhand',
    classType: chosenClass,
    stats: statsByClass[chosenClass] || statsByClass.FIGHTER,
    startingGold: 180,
    favoredEnemyType: chosenClass === 'RANGER' ? 'BEAST' : null,
    primaryWeapon: chosenClass === 'RANGER' ? 'RANGED' : 'MELEE'
  });

  db.prepare("UPDATE characters SET facing = 'NORTH', pending_victory_encounter_id = NULL, scene_mode = ? WHERE id = ?").run(
    initialSceneMode,
    hero.id
  );

  // Add one extra healing potion so the player has 3 potions to test with
  const potionDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Minor Healing Potion'").get();
  if (potionDef) {
    db.prepare(`
      INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
      VALUES (?, 'CHARACTER', ?, NULL)
    `).run(potionDef.id, hero.id);
  }

  return getLivingCharacterByUserId(db, userId);
}

module.exports = {
  DATA_DIR,
  DEFAULT_DB_PATH,
  applyLabSchemaAndTestMap,
  initSandboxDb,
  ensureLivingHero
};
