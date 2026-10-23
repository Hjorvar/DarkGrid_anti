/**
 * DARKGRID ADVENTURE LAB — Sandbox SQLite Initialization, Schema Extensions & Hero Seeding
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../../../src/config');
const { runMigrations, runSeeds } = require('../../../src/db/migrate');
const {
  getLivingCharacterByUserId,
  createCharacter
} = require('../../../src/domain/character/rules');
const { initSceneCatalogTables, normalizeSceneMode } = require('../../scene-catalog');
const {
  isProductionMode,
  isAuthRequired,
  ensureNonDestructiveLabAdapter
} = require('./legacy-compatibility-service');

const DATA_DIR = path.join(__dirname, '../../data');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'action_lab.sqlite');

function applyLabSchemaAndTestMap(db, { preserveExistingMap = false } = {}) {
  ensureNonDestructiveLabAdapter(db);

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

  if (preserveExistingMap) {
    return;
  }

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

function initSandboxDb(customDbPath = null, options = {}) {
  const targetDbPath = customDbPath || DEFAULT_DB_PATH;
  if (targetDbPath !== ':memory:') {
    const targetDir = path.dirname(targetDbPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  }
  const db = new DatabaseSync(targetDbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  const prodOrAuth = isProductionMode(options) || isAuthRequired(options);
  const preserveExistingMap = options.preserveExistingMap !== undefined
    ? Boolean(options.preserveExistingMap)
    : prodOrAuth;

  runMigrations(db);
  runSeeds(db);
  applyLabSchemaAndTestMap(db, { preserveExistingMap });

  const shouldSeedSandboxHero = options.seedSandboxHero !== undefined
    ? Boolean(options.seedSandboxHero)
    : !prodOrAuth;

  if (!shouldSeedSandboxHero) {
    return { db, userId: null, dbPath: targetDbPath };
  }

  // Ensure sandbox demo user exists (only in non-production sandbox mode)
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

  const chosenClass = String(classOverride || 'FIGHTER').toUpperCase();
  const baseStats = config.classBases[chosenClass] || config.classBases.FIGHTER;
  const stats = {
    strength: baseStats.strength,
    constitution: baseStats.constitution,
    dexterity: baseStats.dexterity,
    intelligence: baseStats.intelligence,
    wisdom: baseStats.wisdom,
    charisma: baseStats.charisma
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
    stats,
    startingGold: 180,
    favoredEnemyFamily: chosenClass === 'RANGER' ? 'ANIMALS' : null,
    favoredEnemyType: chosenClass === 'RANGER' ? 'ANIMALS' : null,
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
