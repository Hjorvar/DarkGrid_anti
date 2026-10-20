/**
 * DARKGRID — Action Viewport Prototype Server (Isolated Sandbox)
 * Runs in its own folder (action-ui-lab/) with an isolated SQLite database
 * so zero production files or databases are modified.
 * Uses the real Darkgrid domain engine for movement, encounters, combat, and inventory.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const { withTransaction } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const {
  getLivingCharacterByUserId,
  getModifier,
  formatModifier,
  getCharacterEquipment,
  getCharacterInventory,
  getCharacterPotions,
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  getActiveWeapon,
  performClericSelfHeal,
  performCityRest,
  getClericSelfHealInfo,
  getClericRemainingHealUses,
  useConsumable,
  getEffectiveStats,
  createCharacter
} = require('../src/domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus
} = require('../src/domain/combat/rules');
const {
  getCityStoreStock,
  buyItem,
  sellItem
} = require('../src/domain/economy/shop');
const {
  getTileById,
  getTileByCoords,
  getMinimapData,
  getAvailableDirections,
  validateMovement
} = require('../src/domain/world/map');
const {
  checkTileEncounter,
  getActiveEncounterForCharacter,
  ignoreEncounter,
  investigateEncounter
} = require('../src/domain/encounters/engine');
const {
  getHealthBracket,
  getConditionTextForBracket,
  getCombatState,
  executeCombatRound
} = require('../src/domain/combat/engine');
const { getVictoryData } = require('../src/domain/combat/victory');
const { getTerrainArtworkForTile } = require('../src/domain/world/artwork');
const {
  getOrGenerateContracts,
  getActiveContractForCharacter,
  acceptContract,
  abandonContract,
  autoClaimCompletedBounties,
  getWildernessThreats
} = require('../src/domain/bounties/board');
const {
  SCENE_MODES,
  POV_TIERS,
  COVERAGE_QUALITY_GRADES,
  ATMOSPHERE_EFFECT_PROFILES,
  POINTS_OF_INTEREST,
  DEFAULT_SCENE_VARIANTS,
  DEFAULT_PERSPECTIVE_VIEWS,
  DEFAULT_POV_CONTEXT_RULES,
  normalizeSceneMode,
  computeDeterministicVariantIndex,
  resolveAtmosphereEffectProfile,
  resolvePointOfInterest,
  buildWorldVisualAtlas,
  initSceneCatalogTables,
  resolveTileVariant,
  resolveSceneModeA,
  resolveSceneModeB,
  resolveSceneModeC,
  resolveSceneModeLegacy
} = require('./scene-catalog');
const {
  PRESENTATION_TIERS,
  DISCOVERY_CATALOG,
  EXPEDITION_DEFINITIONS,
  getOrCreateAdventureState,
  resetAdventureState,
  onPlayerStep,
  selectDiscoveryForTile,
  resolveDiscoveryChoice,
  recordPoiInspection,
  recordEncounterStart,
  recordEncounterOutcome,
  evaluateExpeditionMilestones,
  buildAdventureClientPayload
} = require('./adventure-engine');
const {
  PF1E_SIZE_CATEGORIES,
  VISUAL_BODY_PROFILES,
  MONSTER_SIZE_CATALOG,
  PF1E_SIZE_REFERENCE_SPECIMENS,
  lookupMonsterSizeEntry,
  computeAdaptiveMonsterVisualScale,
  buildVisualComparisonPresets,
  getCatalogAuditSummary
} = require('./monster-size-catalog');

const INTEGRATED_MONSTER_PROFILES = {
  manticore: {
    slug: 'manticore',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/manticore.png',
    sizeCategory: 'LARGE_WINGED',
    groundingMode: 'AIRBORNE_HOVER',
    scaleMultiplier: 1.12,
    verticalOffsetPx: -48,
    airborneGapPx: 52,
    shadowWidthPct: 72,
    shadowBlurPx: 14,
    shadowOpacity: 0.38,
    ambientPatch: {
      leftPct: 50,
      topPct: 115,
      widthPct: 72,
      heightPct: 14,
      rotateDeg: 0,
      blurPx: 12,
      opacity: 0.38
    },
    contactPatches: []
  },
  ghoul: {
    slug: 'ghoul',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/ghoul.png',
    sizeCategory: 'MEDIUM_HUMANOID',
    groundingMode: 'GROUNDED_CROUCH',
    scaleMultiplier: 0.94,
    verticalOffsetPx: 14,
    airborneGapPx: 0,
    shadowWidthPct: 56,
    shadowBlurPx: 8,
    shadowOpacity: 0.62,
    ambientPatch: {
      leftPct: 53.5,
      topPct: 93.8,
      widthPct: 54,
      heightPct: 11,
      rotateDeg: 7,
      blurPx: 8,
      opacity: 0.44
    },
    contactPatches: [
      { id: 'right-foot', leftPct: 34.5, topPct: 89.8, widthPct: 21, heightPct: 5.8, rotateDeg: -4, blurPx: 3, opacity: 0.76 },
      { id: 'left-foot', leftPct: 72.5, topPct: 97.2, widthPct: 20, heightPct: 5.8, rotateDeg: 3, blurPx: 3, opacity: 0.80 }
    ]
  },
  assassin_vine: {
    slug: 'assassin_vine',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/assassin_vine.png',
    sizeCategory: 'COILED_PLANT',
    groundingMode: 'GROUNDED_ROOTED',
    scaleMultiplier: 1.00,
    verticalOffsetPx: 16,
    airborneGapPx: 0,
    shadowWidthPct: 76,
    shadowBlurPx: 9,
    shadowOpacity: 0.68,
    ambientPatch: {
      leftPct: 50.0,
      topPct: 95.2,
      widthPct: 74,
      heightPct: 12,
      rotateDeg: 0,
      blurPx: 8,
      opacity: 0.48
    },
    contactPatches: [
      { id: 'root-coil-left', leftPct: 24.0, topPct: 93.2, widthPct: 25, heightPct: 6.2, rotateDeg: 6, blurPx: 3, opacity: 0.76 },
      { id: 'root-coil-center', leftPct: 48.0, topPct: 97.0, widthPct: 32, heightPct: 6.8, rotateDeg: 0, blurPx: 3, opacity: 0.82 },
      { id: 'root-coil-right', leftPct: 76.0, topPct: 93.0, widthPct: 25, heightPct: 6.2, rotateDeg: -6, blurPx: 3, opacity: 0.76 }
    ]
  },
  wolf: {
    slug: 'wolf',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/wolf.png',
    sizeCategory: 'MEDIUM_QUADRUPED',
    groundingMode: 'GROUNDED_PAWS',
    scaleMultiplier: 0.92,
    verticalOffsetPx: 14,
    airborneGapPx: 0,
    shadowWidthPct: 68,
    shadowBlurPx: 8,
    shadowOpacity: 0.64,
    ambientPatch: {
      leftPct: 45.0,
      topPct: 90.0,
      widthPct: 64,
      heightPct: 11,
      rotateDeg: 10,
      blurPx: 9,
      opacity: 0.42
    },
    contactPatches: [
      { id: 'hind-right-paw', leftPct: 9.5, topPct: 86.4, widthPct: 14, heightPct: 5.0, rotateDeg: 0, blurPx: 2.5, opacity: 0.74 },
      { id: 'mid-paws', leftPct: 47.5, topPct: 83.2, widthPct: 20, heightPct: 5.4, rotateDeg: 4, blurPx: 3, opacity: 0.74 },
      { id: 'front-left-paw', leftPct: 70.5, topPct: 97.4, widthPct: 19, heightPct: 5.6, rotateDeg: -2, blurPx: 2.5, opacity: 0.82 }
    ]
  },
  skeletal_champion: {
    slug: 'skeletal_champion',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/skeletal_champion.png',
    sizeCategory: 'MEDIUM_HUMANOID',
    groundingMode: 'GROUNDED_BOOTS',
    scaleMultiplier: 0.98,
    verticalOffsetPx: 14,
    airborneGapPx: 0,
    shadowWidthPct: 66,
    shadowBlurPx: 8,
    shadowOpacity: 0.66,
    ambientPatch: {
      leftPct: 48.0,
      topPct: 96.5,
      widthPct: 68,
      heightPct: 10,
      rotateDeg: -2,
      blurPx: 8,
      opacity: 0.44
    },
    contactPatches: [
      { id: 'right-sabatons', leftPct: 10.5, topPct: 98.8, widthPct: 19, heightPct: 5.5, rotateDeg: -4, blurPx: 2.5, opacity: 0.82 },
      { id: 'left-sabatons', leftPct: 79.5, topPct: 96.4, widthPct: 24, heightPct: 5.8, rotateDeg: 4, blurPx: 2.5, opacity: 0.80 }
    ]
  },
  giant_spider: {
    slug: 'giant_spider',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/giant_spider.png',
    sizeCategory: 'LARGE_ARACHNID',
    groundingMode: 'GROUNDED_ARACHNID',
    scaleMultiplier: 1.15,
    verticalOffsetPx: 18,
    airborneGapPx: 0,
    shadowWidthPct: 84,
    shadowBlurPx: 9,
    shadowOpacity: 0.68,
    ambientPatch: {
      leftPct: 52.0,
      topPct: 91.5,
      widthPct: 80,
      heightPct: 14,
      rotateDeg: 2,
      blurPx: 10,
      opacity: 0.48
    },
    contactPatches: [
      { id: 'left-forelegs', leftPct: 8.5, topPct: 90.0, widthPct: 16, heightPct: 5.2, rotateDeg: -5, blurPx: 2.5, opacity: 0.82 },
      { id: 'left-mid-leg', leftPct: 31.0, topPct: 94.5, widthPct: 15, heightPct: 5.0, rotateDeg: -2, blurPx: 2.5, opacity: 0.80 },
      { id: 'front-right-leg', leftPct: 68.5, topPct: 98.8, widthPct: 17, heightPct: 5.5, rotateDeg: 2, blurPx: 2.5, opacity: 0.88 },
      { id: 'rear-right-legs', leftPct: 90.0, topPct: 90.5, widthPct: 17, heightPct: 5.2, rotateDeg: 5, blurPx: 2.5, opacity: 0.80 }
    ]
  },
  troll: {
    slug: 'troll',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/troll.png',
    sizeCategory: 'LARGE_BRUTE',
    groundingMode: 'GROUNDED_HEAVY',
    scaleMultiplier: 1.06,
    verticalOffsetPx: 15,
    airborneGapPx: 0,
    shadowWidthPct: 74,
    shadowBlurPx: 9,
    shadowOpacity: 0.70,
    ambientPatch: {
      leftPct: 52.0,
      topPct: 95.5,
      widthPct: 68,
      heightPct: 12,
      rotateDeg: 5,
      blurPx: 9,
      opacity: 0.48
    },
    contactPatches: [
      { id: 'right-clawed-foot', leftPct: 27.5, topPct: 92.8, widthPct: 26, heightPct: 6.2, rotateDeg: -5, blurPx: 3, opacity: 0.80 },
      { id: 'left-clawed-foot', leftPct: 74.5, topPct: 99.0, widthPct: 24, heightPct: 6.5, rotateDeg: 3, blurPx: 3, opacity: 0.84 }
    ]
  }
};

function resolveMonsterIntegratedProfile(cleanSlug, isAirborne = false, monsterLookupHint = null) {
  const key = String(cleanSlug || '').toLowerCase().trim();
  const sizeEntry = lookupMonsterSizeEntry(key || monsterLookupHint);
  const profile = INTEGRATED_MONSTER_PROFILES[key];
  if (profile) {
    const fileDiskPath = path.join(__dirname, 'public/images/monsters-cutout', `${profile.slug}.png`);
    if (fs.existsSync(fileDiskPath)) {
      const adaptiveScale = computeAdaptiveMonsterVisualScale(sizeEntry, {
        viewportWidth: 1920,
        viewportHeight: 1080,
        presentationMode: 'INTEGRATED'
      });
      return {
        ...profile,
        pfSizeCategory: sizeEntry.pfSizeCategory,
        pfSizeLabel: sizeEntry.pfSizeLabel,
        visualBodyProfile: sizeEntry.visualBodyProfile,
        visualBodyProfileLabel: sizeEntry.visualBodyProfileLabel,
        proposedScaleFactor: sizeEntry.proposedScaleFactor,
        adaptiveScale,
        sizeMetadata: sizeEntry,
        fallbackPresentation: 'INTEGRATED'
      };
    }
  }
  const adaptiveScale = computeAdaptiveMonsterVisualScale(sizeEntry, {
    viewportWidth: 1920,
    viewportHeight: 1080,
    presentationMode: 'CARD'
  });
  return {
    slug: key,
    hasIntegratedCutout: false,
    cutoutImageUrl: null,
    sizeCategory: isAirborne ? 'LARGE_WINGED' : 'MEDIUM_GROUNDED',
    groundingMode: adaptiveScale.positioning.groundingMode || (isAirborne ? 'AIRBORNE_HOVER' : 'GROUNDED'),
    pfSizeCategory: sizeEntry.pfSizeCategory,
    pfSizeLabel: sizeEntry.pfSizeLabel,
    visualBodyProfile: sizeEntry.visualBodyProfile,
    visualBodyProfileLabel: sizeEntry.visualBodyProfileLabel,
    proposedScaleFactor: sizeEntry.proposedScaleFactor,
    scaleMultiplier: sizeEntry.proposedScaleFactor,
    verticalOffsetPx: adaptiveScale.positioning.verticalOffsetPx,
    airborneGapPx: adaptiveScale.positioning.airborneGapPx,
    shadowWidthPct: adaptiveScale.shadow.shadowWidthPct,
    shadowBlurPx: adaptiveScale.shadow.shadowBlurPx,
    shadowOpacity: adaptiveScale.shadow.shadowOpacity,
    ambientPatch: adaptiveScale.shadow.ambientPatch,
    contactPatches: adaptiveScale.shadow.contactPatches,
    adaptiveScale,
    sizeMetadata: sizeEntry,
    fallbackPresentation: 'CARD'
  };
}

const PORT = process.env.ACTION_LAB_PORT || 3030;
const DATA_DIR = path.join(__dirname, 'data');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'action_lab.sqlite');

const FACING_ORDER = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const FACING_VECTORS = {
  NORTH: { dx: 0, dy: -1, label: 'North', short: 'N', deg: 0, arrow: '▲' },
  EAST:  { dx: 1, dy: 0,  label: 'East',  short: 'E', deg: 90, arrow: '▶' },
  SOUTH: { dx: 0, dy: 1,  label: 'South', short: 'S', deg: 180, arrow: '▼' },
  WEST:  { dx: -1, dy: 0, label: 'West',  short: 'W', deg: 270, arrow: '◀' }
};

function normalizeFacing(facing) {
  const upper = String(facing || 'NORTH').toUpperCase().trim();
  return FACING_ORDER.includes(upper) ? upper : 'NORTH';
}

function rotateFacing(currentFacing, turn) {
  const norm = normalizeFacing(currentFacing);
  const idx = FACING_ORDER.indexOf(norm);
  const normalizedTurn = String(turn || '').toUpperCase().trim();
  if (normalizedTurn === 'LEFT' || normalizedTurn === 'CCW') {
    return FACING_ORDER[(idx + 3) % 4];
  }
  if (normalizedTurn === 'RIGHT' || normalizedTurn === 'CW') {
    return FACING_ORDER[(idx + 1) % 4];
  }
  if (FACING_ORDER.includes(normalizedTurn)) {
    return normalizedTurn;
  }
  return norm;
}

function getRelativeCardinalMap(facing) {
  const norm = normalizeFacing(facing);
  const idx = FACING_ORDER.indexOf(norm);
  return {
    FORWARD: FACING_ORDER[idx],
    RIGHT: FACING_ORDER[(idx + 1) % 4],
    STRAFE_RIGHT: FACING_ORDER[(idx + 1) % 4],
    BACKWARD: FACING_ORDER[(idx + 2) % 4],
    LEFT: FACING_ORDER[(idx + 3) % 4],
    STRAFE_LEFT: FACING_ORDER[(idx + 3) % 4]
  };
}

function getMoveKindFromCardinal(facing, cardinalDirection) {
  const rel = getRelativeCardinalMap(facing);
  const dir = String(cardinalDirection || '').toUpperCase().trim();
  if (dir === rel.FORWARD) return 'FORWARD';
  if (dir === rel.BACKWARD) return 'BACKWARD';
  if (dir === rel.STRAFE_LEFT) return 'STRAFE_LEFT';
  if (dir === rel.STRAFE_RIGHT) return 'STRAFE_RIGHT';
  return 'FORWARD';
}

function computeTileFacingSeed(x, y, facing) {
  const fIdx = FACING_ORDER.indexOf(normalizeFacing(facing)) + 1;
  const h = ((Number(x) * 73856093) ^ (Number(y) * 19349663) ^ (fIdx * 83492791)) >>> 0;
  return h;
}

function bracketNumToKey(bracket) {
  switch (Number(bracket)) {
    case 100: return '5_uninjured';
    case 75:  return '6_barely_wounded';
    case 50:  return '7_wounded';
    case 25:  return '8_badly_wounded';
    case 0:   return '9_near_death';
    default:  return '5_uninjured';
  }
}

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

function inspectSceneTile(db, tx, ty, cardinalDirection = null) {
  const tile = getTileByCoords(db, tx, ty);
  if (!tile) {
    const voidVariant = resolveTileVariant(db, { x: tx, y: ty, terrain: 'VOID', feature: null });
    return {
      exists: false,
      x: tx,
      y: ty,
      direction: cardinalDirection,
      name: 'Edge of the World',
      terrain: 'VOID',
      feature: null,
      description: 'An impassable abyss at the edge of the known realm.',
      isPassable: false,
      isSafe: false,
      artworkUrl: '/images/terrain/terrain_mountains.webp',
      imageUrl: voidVariant.imageUrl,
      legacyImageUrl: '/images/terrain/terrain_mountains.webp',
      variant: voidVariant,
      obstacleType: 'WORLD_EDGE',
      hasPersistentThreat: false
    };
  }

  const art = getTerrainArtworkForTile(db, tile);
  const legacyUrl = art ? art.imageUrl : '/images/terrain/terrain_fallback.webp';
  const variant = resolveTileVariant(db, tile);
  const resolvedUrl = variant && variant.imageUrl ? variant.imageUrl : legacyUrl;

  const persistent = db.prepare(
    "SELECT id, kill_count, custom_title FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'"
  ).get(tile.id);

  let obstacleType = null;
  if (tile.is_passable === 0) {
    if (tile.terrain === 'MOUNTAINS') obstacleType = 'MOUNTAINS';
    else if (tile.terrain === 'RIVER_LAKE') obstacleType = 'RIVER';
    else if (tile.terrain === 'OCEAN' || tile.terrain === 'AQUATIC') obstacleType = 'OCEAN';
    else if (tile.terrain === 'SWAMP') obstacleType = 'MIRE';
    else obstacleType = 'WALL';
  }

  return {
    exists: true,
    id: tile.id,
    x: tile.x,
    y: tile.y,
    direction: cardinalDirection,
    name: tile.name,
    terrain: tile.terrain,
    feature: tile.feature || null,
    description: tile.description || '',
    isPassable: tile.is_passable === 1,
    isSafe: tile.is_safe === 1,
    artworkUrl: resolvedUrl,
    imageUrl: resolvedUrl,
    legacyImageUrl: legacyUrl,
    variant,
    obstacleType,
    hasPersistentThreat: Boolean(persistent)
  };
}

function buildViewportScene(db, currentTile, facing, directions, activeEncounter, sceneMode = 'C') {
  const normFacing = normalizeFacing(facing);
  const normSceneMode = normalizeSceneMode(sceneMode);
  const relMap = getRelativeCardinalMap(normFacing);

  const fVec = FACING_VECTORS[relMap.FORWARD];
  const lVec = FACING_VECTORS[relMap.STRAFE_LEFT];
  const rVec = FACING_VECTORS[relMap.STRAFE_RIGHT];
  const bVec = FACING_VECTORS[relMap.BACKWARD];

  const current = inspectSceneTile(db, currentTile.x, currentTile.y, normFacing);
  const ahead1 = inspectSceneTile(db, currentTile.x + fVec.dx, currentTile.y + fVec.dy, relMap.FORWARD);
  const ahead2 = inspectSceneTile(db, currentTile.x + 2 * fVec.dx, currentTile.y + 2 * fVec.dy, relMap.FORWARD);
  const left1 = inspectSceneTile(db, currentTile.x + lVec.dx, currentTile.y + lVec.dy, relMap.STRAFE_LEFT);
  const right1 = inspectSceneTile(db, currentTile.x + rVec.dx, currentTile.y + rVec.dy, relMap.STRAFE_RIGHT);
  const aheadLeft = inspectSceneTile(db, currentTile.x + fVec.dx + lVec.dx, currentTile.y + fVec.dy + lVec.dy, relMap.STRAFE_LEFT);
  const aheadRight = inspectSceneTile(db, currentTile.x + fVec.dx + rVec.dx, currentTile.y + fVec.dy + rVec.dy, relMap.STRAFE_RIGHT);
  const behind1 = inspectSceneTile(db, currentTile.x + bVec.dx, currentTile.y + bVec.dy, relMap.BACKWARD);

  const seed = computeTileFacingSeed(currentTile.x, currentTile.y, normFacing);
  const aheadSeed = computeTileFacingSeed(ahead1.x, ahead1.y, normFacing);

  const isAheadBlocked = !ahead1.isPassable;
  const isTerrainTransitionAhead = Boolean(
    ahead1.exists &&
    (ahead1.terrain !== current.terrain || ahead1.feature !== current.feature || ahead1.imageUrl !== current.imageUrl)
  );

  // Determine if movement is locked by active combat or ambush
  const isInCombat = Boolean(activeEncounter && activeEncounter.status === 'IN_COMBAT');

  // Resolve all four implementations so the UI can compare Mode A, Mode B, Mode C, and Legacy seamlessly
  const sceneA = resolveSceneModeA(db, current, ahead1, left1, right1, normFacing, seed, isInCombat);
  const sceneB = resolveSceneModeB(db, current, ahead1, left1, right1, normFacing, seed);
  const sceneC = resolveSceneModeC(db, current, ahead1, left1, right1, normFacing, seed, isInCombat);
  const sceneLegacy = resolveSceneModeLegacy(current, ahead1, normFacing, isTerrainTransitionAhead, isAheadBlocked);
  const scenes = {
    A: sceneA,
    B: sceneB,
    C: sceneC,
    LEGACY: sceneLegacy
  };
  const activeScene = scenes[normSceneMode] || sceneC;

  // Phase 3 & Phase 4: Resolve Data-Driven Atmospheric Effect Profile & Point of Interest
  const effectProfile = resolveAtmosphereEffectProfile(activeScene.atmosphereProfile, current, ahead1, normFacing);
  const pointOfInterest = isInCombat ? null : resolvePointOfInterest(current, ahead1, normFacing);
  for (const sc of Object.values(scenes)) {
    if (sc) {
      sc.effectProfile = resolveAtmosphereEffectProfile(sc.atmosphereProfile, current, ahead1, normFacing);
      sc.pointOfInterest = pointOfInterest;
    }
  }

  // Preload URLs for opposite/adjacent perspective views so 90°/180° turns and steps are instantaneous
  const preloadUrls = Array.from(new Set([
    ...DEFAULT_PERSPECTIVE_VIEWS.map(p => p.image_path),
    ...DEFAULT_POV_CONTEXT_RULES.map(r => r.image_path)
  ]));

  const isAmbushLocked = Boolean(
    activeEncounter &&
    activeEncounter.status === 'DISCOVERED' &&
    (activeEncounter.isAmbush || Number(activeEncounter.is_ambush) === 1)
  );
  const isBypassMoveAllowed = Boolean(
    activeEncounter &&
    activeEncounter.status === 'DISCOVERED' &&
    !isAmbushLocked
  );

  function buildRelativeMoveInfo(relativeKey, cardinalDir) {
    const dirInfo = directions[cardinalDir] || { available: false, reason: 'Unavailable' };
    const dirMeta = FACING_VECTORS[cardinalDir];
    const terrainPassable = Boolean(dirInfo.available);

    let available = terrainPassable && !isInCombat && !isAmbushLocked;
    let reason = dirInfo.reason || '';

    if (isInCombat) {
      available = false;
      reason = 'Engaged in combat — fight or flee!';
    } else if (isAmbushLocked) {
      available = false;
      reason = 'Ambush! Your retreat is cut off — face the threat!';
    } else if (!terrainPassable) {
      available = false;
      reason = dirInfo.reason || 'Impassable terrain';
    } else if (isBypassMoveAllowed) {
      reason = `Bypass threat & move ${dirMeta.label} to ${dirInfo.tileName}`;
    } else {
      reason = `Move ${dirMeta.label} to ${dirInfo.tileName} (${dirInfo.terrain})`;
    }

    return {
      relativeKey,
      cardinal: cardinalDir,
      cardinalLabel: dirMeta.label,
      cardinalShort: dirMeta.short,
      available,
      terrainPassable,
      willBypassThreat: Boolean(available && isBypassMoveAllowed),
      tileName: dirInfo.tileName || (dirInfo.reason || 'Blocked'),
      terrain: dirInfo.terrain || null,
      reason
    };
  }

  const relativeMoves = {
    FORWARD: buildRelativeMoveInfo('FORWARD', relMap.FORWARD),
    BACKWARD: buildRelativeMoveInfo('BACKWARD', relMap.BACKWARD),
    STRAFE_LEFT: buildRelativeMoveInfo('STRAFE_LEFT', relMap.STRAFE_LEFT),
    STRAFE_RIGHT: buildRelativeMoveInfo('STRAFE_RIGHT', relMap.STRAFE_RIGHT)
  };

  return {
    facing: normFacing,
    facingMeta: FACING_VECTORS[normFacing],
    sceneMode: normSceneMode,
    activeScene,
    scenes,
    effectProfile,
    pointOfInterest,
    preloadUrls,
    seed,
    aheadSeed,
    current,
    ahead1,
    ahead2,
    left1,
    right1,
    aheadLeft,
    aheadRight,
    behind1,
    isAheadBlocked,
    isTerrainTransitionAhead,
    relativeMoves
  };
}

/**
 * Builds an ordered combat sequence from the newly inserted combat_events of a round
 * so the frontend can play Hero Action -> Monster Counterattack -> Round Outcome
 * in the exact order calculated by the server without leaking hidden monster numbers.
 */
function buildCombatSequence(db, encounterId, lastEventIdBefore, beforeSnap, afterState) {
  const newEvents = db.prepare(`
    SELECT id, round_number, event_type, public_text, details
    FROM combat_events
    WHERE encounter_id = ? AND id > ?
    ORDER BY id ASC
  `).all(encounterId, lastEventIdBefore);

  if (!newEvents || newEvents.length === 0) return null;

  let runningHeroHp = beforeSnap.heroHp;
  let runningBracketKey = beforeSnap.bracketKey || '5_uninjured';
  let runningConditionText = beforeSnap.conditionText || '';

  const beats = [];
  let currentBeat = null;

  function flushBeat() {
    if (currentBeat) {
      let computedOutcome = 'HIT';
      if (currentBeat.actor === 'HERO') {
        if (currentBeat.kind === 'POTION_USED') computedOutcome = 'HEAL';
        else if (currentBeat.isCrit) computedOutcome = 'CRIT';
        else if (currentBeat.isHit) computedOutcome = 'HIT';
        else computedOutcome = 'MISS';
      } else if (currentBeat.actor === 'MONSTER') {
        if (currentBeat.kind === 'FLEE_PARTING_BLOW') {
          computedOutcome = currentBeat.isHit ? 'HIT' : 'ESCAPED';
        } else {
          computedOutcome = currentBeat.isHit ? 'HIT' : 'MISS';
        }
      } else if (currentBeat.actor === 'OUTCOME') {
        if (currentBeat.kind === 'VICTORY') computedOutcome = 'VICTORY';
        else if (currentBeat.kind === 'DEATH') computedOutcome = 'DEFEAT';
        else if (currentBeat.kind === 'LEVEL_UP') computedOutcome = 'LEVEL_UP';
        else computedOutcome = 'STATUS';
      }

      currentBeat.outcome = computedOutcome;
      currentBeat.eventType = currentBeat.kind;
      currentBeat.publicText = Array.isArray(currentBeat.events)
        ? currentBeat.events.map(e => e.public_text).join(' ')
        : '';
      currentBeat.popupLabel = currentBeat.popupText;
      currentBeat.hpDelta = Number(currentBeat.damage || currentBeat.healed || 0);

      beats.push(currentBeat);
      currentBeat = null;
    }
  }

  for (const ev of newEvents) {
    let details = {};
    try {
      details = ev.details ? JSON.parse(ev.details) : {};
    } catch {
      details = {};
    }

    const type = ev.event_type;

    if (type === 'OPENING_SHOT' || type === 'HERO_ATTACK') {
      flushBeat();
      const isHit = Boolean(details.isHit);
      const isCrit = Boolean(details.isCrit);
      const paralyzedStun = Boolean(details.paralyzedStun);
      let popupText = 'Miss';
      let popupStyle = 'pop-miss';
      if (paralyzedStun) {
        popupText = '⚡ Broke Free!';
        popupStyle = 'pop-strike';
      } else if (isCrit) {
        popupText = '💥 Critical Hit!';
        popupStyle = 'pop-strike';
      } else if (isHit) {
        popupText = type === 'OPENING_SHOT' ? '🏹 Opening Hit!' : '⚔️ Hit!';
        popupStyle = 'pop-strike';
      }

      currentBeat = {
        actor: 'HERO',
        kind: type,
        isHit,
        isCrit,
        paralyzedStun,
        popupText,
        popupStyle,
        heroHpAfterBeat: runningHeroHp,
        conditionBracketAfterBeat: runningBracketKey,
        conditionTextAfterBeat: runningConditionText,
        events: [{ id: ev.id, round_number: ev.round_number, event_type: type, public_text: ev.public_text }]
      };
    } else if (type === 'MONSTER_CONDITION' || type === 'CONDITION') {
      if (details.bracket !== undefined) {
        runningBracketKey = bracketNumToKey(details.bracket);
      }
      if (ev.public_text) {
        runningConditionText = ev.public_text;
      }
      if (currentBeat && currentBeat.actor === 'HERO') {
        currentBeat.conditionBracketAfterBeat = runningBracketKey;
        currentBeat.conditionTextAfterBeat = runningConditionText;
      }
    } else if (type === 'POTION_USED') {
      flushBeat();
      const healed = Number(details.healed ?? details.actualHealed ?? 0);
      runningHeroHp = Math.min(beforeSnap.heroMaxHp, runningHeroHp + healed);
      currentBeat = {
        actor: 'HERO',
        kind: 'POTION_USED',
        isHit: true,
        healed,
        popupText: healed > 0 ? `+${healed} HP` : '✨ Potion Used',
        popupStyle: 'pop-heal',
        heroHpAfterBeat: runningHeroHp,
        conditionBracketAfterBeat: runningBracketKey,
        conditionTextAfterBeat: runningConditionText,
        events: [{ id: ev.id, round_number: ev.round_number, event_type: type, public_text: ev.public_text }]
      };
    } else if (type === 'MONSTER_ATTACK' || type === 'MONSTER_ABILITY') {
      if (currentBeat && currentBeat.actor === 'MONSTER') {
        // Attach secondary monster ability/attack in the same monster turn phase
        const dmg = Number(details.damage || 0);
        if (dmg > 0) {
          runningHeroHp = Math.max(0, runningHeroHp - dmg);
          currentBeat.damage = (currentBeat.damage || 0) + dmg;
          currentBeat.isHit = true;
          currentBeat.popupText = `-${currentBeat.damage} HP`;
          currentBeat.popupStyle = 'pop-damage';
        }
        currentBeat.heroHpAfterBeat = runningHeroHp;
        currentBeat.events.push({ id: ev.id, round_number: ev.round_number, event_type: type, public_text: ev.public_text });
      } else {
        flushBeat();
        const isHit = type === 'MONSTER_ABILITY'
          ? Boolean(details.isHit || Number(details.damage || 0) > 0)
          : Boolean(details.isHit);
        const isCrit = Boolean(details.isCrit);
        const dmg = Number(details.damage || 0);
        if (dmg > 0) {
          runningHeroHp = Math.max(0, runningHeroHp - dmg);
        }
        let popupText = 'Miss';
        let popupStyle = 'pop-miss';
        if (isHit && dmg > 0) {
          popupText = isCrit ? `💥 Crit -${dmg} HP` : `-${dmg} HP`;
          popupStyle = 'pop-damage';
        } else if (type === 'MONSTER_ABILITY' && !isHit) {
          popupText = 'Resisted';
          popupStyle = 'pop-miss';
        }

        currentBeat = {
          actor: 'MONSTER',
          kind: type,
          isHit,
          isCrit,
          damage: dmg,
          popupText,
          popupStyle,
          heroHpAfterBeat: runningHeroHp,
          conditionBracketAfterBeat: runningBracketKey,
          conditionTextAfterBeat: runningConditionText,
          events: [{ id: ev.id, round_number: ev.round_number, event_type: type, public_text: ev.public_text }]
        };
      }
    } else if (type === 'FLEE') {
      flushBeat();
      const isHit = Boolean(details.isHit);
      const dmg = Number(details.damage || 0);
      if (dmg > 0) {
        runningHeroHp = Math.max(0, runningHeroHp - dmg);
      }
      currentBeat = {
        actor: 'MONSTER',
        kind: 'FLEE_PARTING_BLOW',
        isHit,
        isCrit: Boolean(details.isCrit),
        damage: dmg,
        popupText: isHit && dmg > 0 ? `Parting Blow -${dmg} HP` : 'Escaped Cleanly!',
        popupStyle: isHit && dmg > 0 ? 'pop-damage' : 'pop-strike',
        heroHpAfterBeat: runningHeroHp,
        conditionBracketAfterBeat: runningBracketKey,
        conditionTextAfterBeat: runningConditionText,
        events: [{ id: ev.id, round_number: ev.round_number, event_type: type, public_text: ev.public_text }]
      };
    } else if (type === 'STATUS_EFFECT' || type === 'HERO_STATUS') {
      const dmg = Number(details.damage || 0);
      if (dmg > 0) {
        runningHeroHp = Math.max(0, runningHeroHp - dmg);
      }
      if (details.level1SpikeGuard && runningHeroHp <= 0) {
        runningHeroHp = 1;
      }
      if (currentBeat) {
        currentBeat.heroHpAfterBeat = runningHeroHp;
        currentBeat.events.push({ id: ev.id, round_number: ev.round_number, event_type: type, public_text: ev.public_text });
      } else {
        currentBeat = {
          actor: 'OUTCOME',
          kind: type,
          isHit: dmg > 0,
          damage: dmg,
          popupText: dmg > 0 ? `-${dmg} HP` : 'Status',
          popupStyle: dmg > 0 ? 'pop-damage' : 'pop-strike',
          heroHpAfterBeat: runningHeroHp,
          conditionBracketAfterBeat: runningBracketKey,
          conditionTextAfterBeat: runningConditionText,
          events: [{ id: ev.id, round_number: ev.round_number, event_type: type, public_text: ev.public_text }]
        };
      }
    } else if (type === 'VICTORY' || type === 'LEVEL_UP' || type === 'DEATH') {
      flushBeat();
      currentBeat = {
        actor: 'OUTCOME',
        kind: type,
        isHit: false,
        popupText: type === 'VICTORY' ? '🏆 VICTORY!' : (type === 'LEVEL_UP' ? '⬆️ LEVEL UP!' : '💀 FALLEN'),
        popupStyle: type === 'DEATH' ? 'pop-damage' : 'pop-strike',
        heroHpAfterBeat: afterState.character ? afterState.character.current_hp : 0,
        conditionBracketAfterBeat: '9_near_death',
        conditionTextAfterBeat: runningConditionText,
        events: [{ id: ev.id, round_number: ev.round_number, event_type: type, public_text: ev.public_text }]
      };
    }
  }

  flushBeat();

  const finalHeroHp = afterState.character ? afterState.character.current_hp : 0;
  if (beats.length > 0) {
    beats[beats.length - 1].heroHpAfterBeat = finalHeroHp;
  }

  return {
    encounterId,
    roundNumber: newEvents[0] ? newEvents[0].round_number : 1,
    heroHpBefore: beforeSnap.heroHp,
    heroHpAfter: finalHeroHp,
    heroMaxHp: beforeSnap.heroMaxHp,
    monsterInfoBefore: beforeSnap.monsterInfo || null,
    monsterSnapshot: beforeSnap.monsterInfo || null,
    conditionBefore: {
      bracket: beforeSnap.bracketKey || '5_uninjured',
      text: beforeSnap.conditionText || ''
    },
    outcome: afterState.mode === 'FALLEN'
      ? 'DEFEAT'
      : (afterState.victory ? 'VICTORY' : (afterState.encounter ? 'IN_COMBAT' : 'ESCAPED')),
    beats
  };
}

/**
 * Builds the complete, secrecy-compliant client state payload for the SPA Action Viewport.
 * Never leaks unrevealed monster identity during Stage 1 (DISCOVERED).
 */
function buildClientState(db, userId, extra = {}) {
  let character = getLivingCharacterByUserId(db, userId);

  // If hero died, return fallen memorial state
  if (!character) {
    const fallen = db.prepare(`
      SELECT c.*,
             COALESCE(mi.custom_title, m.name) as killer_name,
             m.name as killer_base_name,
             mi.kill_count as killer_kills,
             t.name as tile_name
      FROM characters c
      LEFT JOIN monster_instances mi ON c.killed_by_monster_instance_id = mi.id
      LEFT JOIN monsters m ON mi.monster_id = m.id
      LEFT JOIN map_tiles t ON c.tile_id = t.id
      WHERE c.user_id = ? AND c.is_alive = 0
      ORDER BY c.id DESC LIMIT 1
    `).get(userId);

    return {
      mode: 'FALLEN',
      fallen: fallen || null,
      combatSequence: extra.combatSequence || null,
      infoMessage: extra.infoMessage || null,
      errorMessage: extra.errorMessage || null
    };
  }

  const charRowRaw = db.prepare('SELECT facing, pending_victory_encounter_id, scene_mode FROM characters WHERE id = ?').get(character.id) || {};
  const facing = normalizeFacing(charRowRaw.facing || 'NORTH');
  const sceneMode = normalizeSceneMode(charRowRaw.scene_mode || 'C');
  let pendingVictoryEncounterId = charRowRaw.pending_victory_encounter_id || null;

  const currentTile = getTileById(db, character.tile_id);
  const isSafeCity = Boolean(currentTile && currentTile.terrain === 'CITY' && currentTile.is_safe === 1);

  let claimedBounties = [];
  if (isSafeCity) {
    claimedBounties = autoClaimCompletedBounties(db, character.id);
    if (claimedBounties.length > 0) {
      character = getLivingCharacterByUserId(db, userId) || character;
    }
  }

  const terrainArtwork = getTerrainArtworkForTile(db, currentTile);
  const activeEncounter = getActiveEncounterForCharacter(db, character.id, character.class);

  // Check if lab encounter has an explicit ambush override flag on row (for Level 1 lab testing)
  let rawEncounterRow = null;
  if (activeEncounter) {
    rawEncounterRow = db.prepare('SELECT is_ambush, spotted_by_hero, combat_state_json FROM encounters WHERE id = ?').get(activeEncounter.id);
  }
  let labForcedAmbush = false;
  if (rawEncounterRow && rawEncounterRow.combat_state_json) {
    try {
      const parsedState = JSON.parse(rawEncounterRow.combat_state_json);
      labForcedAmbush = Boolean(parsedState && parsedState.labForcedAmbush);
    } catch {
      labForcedAmbush = false;
    }
  }

  let combatState = null;
  if (activeEncounter && activeEncounter.status === 'IN_COMBAT') {
    combatState = getCombatState(db, character.id, activeEncounter.id);
  }

  // Resolve persisted victory banner if no active encounter is open
  let resolvedVictory = extra.victory || null;
  if (!resolvedVictory && !activeEncounter && pendingVictoryEncounterId) {
    const vData = getVictoryData(db, character.id, pendingVictoryEncounterId);
    if (vData && vData.encounter && vData.encounter.tile_id === currentTile.id) {
      resolvedVictory = vData;
    } else {
      db.prepare('UPDATE characters SET pending_victory_encounter_id = NULL WHERE id = ?').run(character.id);
      pendingVictoryEncounterId = null;
    }
  }

  const equipment = getCharacterEquipment(db, character.id);
  const effectiveHero = getEffectiveStats(character, equipment);
  const inventory = getCharacterInventory(db, character.id);
  const potions = getCharacterPotions(db, character.id);
  const combatPotions = getCharacterPotions(db, character.id, { combatOnly: true });

  // STRICT ENCOUNTER SECRECY: Only pass revealedMonster if status === 'IN_COMBAT'
  const isRevealed = Boolean(activeEncounter && activeEncounter.status === 'IN_COMBAT');
  const revealedMonster = isRevealed ? activeEncounter : null;

  const { activeWeapon, isRangedActive } = combatState
    ? combatState
    : getActiveWeapon(effectiveHero, equipment, revealedMonster);

  const meleeAttackBonus = calculateHeroAttackBonus(effectiveHero, equipment.meleeWeapon, revealedMonster, equipment);
  const rangedAttackBonus = calculateHeroAttackBonus(effectiveHero, equipment.rangedWeapon, revealedMonster, equipment);
  const heroAC = combatState
    ? combatState.heroAC
    : calculateHeroAC(effectiveHero, equipment, isRangedActive, revealedMonster, activeWeapon);

  let clericHealInfo = null;
  if ((effectiveHero.class || '').toUpperCase() === 'CLERIC') {
    clericHealInfo = {
      ...getClericSelfHealInfo(effectiveHero.level),
      remainingUses: getClericRemainingHealUses(effectiveHero)
    };
  }

  const shopStock = isSafeCity ? getCityStoreStock(db, effectiveHero) : null;
  const bountyContracts = isSafeCity ? getOrGenerateContracts(db, effectiveHero) : [];
  const wildernessThreats = isSafeCity ? getWildernessThreats(db) : [];
  const activeContract = getActiveContractForCharacter(db, character.id);
  const minimap = getMinimapData(db, currentTile, 2);
  const directions = getAvailableDirections(db, currentTile);

  const modifiers = {
    strength: formatModifier(effectiveHero.strength),
    constitution: formatModifier(effectiveHero.constitution),
    dexterity: formatModifier(effectiveHero.dexterity),
    intelligence: formatModifier(effectiveHero.intelligence),
    wisdom: formatModifier(effectiveHero.wisdom),
    charisma: formatModifier(effectiveHero.charisma)
  };

  // Sanitize encounter payload so Stage 1 (DISCOVERED) NEVER leaks monster identity
  let safeEncounter = null;
  if (activeEncounter) {
    if (activeEncounter.status === 'DISCOVERED') {
      const effectiveAmbush = Boolean(
        activeEncounter.isAmbush ||
        Number(activeEncounter.is_ambush) === 1 ||
        labForcedAmbush
      );
      safeEncounter = {
        id: activeEncounter.id,
        status: 'DISCOVERED',
        combat_round: 0,
        isAmbush: effectiveAmbush,
        isRangerSpecial: Boolean(activeEncounter.isRangerSpecial),
        resolvedDescription: activeEncounter.resolvedDescription
      };
    } else if (activeEncounter.status === 'IN_COMBAT') {
      const cleanMonsterName = (activeEncounter.monster_name || '').replace(/\[.*?\]/g, '').trim();
      const cleanBaseMonsterName = (activeEncounter.base_monster_name || activeEncounter.monster_name || '').replace(/\[.*?\]/g, '').trim();
      const cleanSlug = activeEncounter.imageSlug || cleanBaseMonsterName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const imageUrl = activeEncounter.imageUrl || (`/images/monsters/${cleanSlug}.png`);
      const isAirborne = Boolean(
        activeEncounter.movement_type === 'FLY' ||
        activeEncounter.movement_type === 'FLYING' ||
        activeEncounter.is_flying
      );
      const integratedProfile = resolveMonsterIntegratedProfile(cleanSlug, isAirborne, activeEncounter.monster_id || cleanSlug);

      const actionEvents = (combatState && Array.isArray(combatState.events))
        ? combatState.events.filter(ev => ev.event_type !== 'CONDITION')
        : [];
      const latestRoundNum = actionEvents.length > 0
        ? Math.max(...actionEvents.map(ev => Number(ev.round_number || 1)))
        : (activeEncounter.combat_round || 1);
      const currentRoundEvents = actionEvents.filter(ev => Number(ev.round_number || 1) === latestRoundNum);

      safeEncounter = {
        id: activeEncounter.id,
        status: 'IN_COMBAT',
        combat_round: activeEncounter.combat_round || 1,
        monsterId: activeEncounter.monster_id || null,
        monsterName: cleanMonsterName,
        baseMonsterName: cleanBaseMonsterName,
        monsterSlug: cleanSlug,
        monsterSymbol: activeEncounter.monster_symbol,
        monsterColor: activeEncounter.monster_color || '#c5a059',
        imageUrl,
        cutoutImageUrl: integratedProfile.cutoutImageUrl,
        hasIntegratedCutout: integratedProfile.hasIntegratedCutout,
        integratedProfile,
        pfSizeCategory: integratedProfile.pfSizeCategory || 'MEDIUM',
        pfSizeLabel: integratedProfile.pfSizeLabel || 'Medium',
        visualBodyProfile: integratedProfile.visualBodyProfile || 'BIPED_MEDIUM',
        visualBodyProfileLabel: integratedProfile.visualBodyProfileLabel || 'Medium Upright Biped',
        proposedScaleFactor: integratedProfile.proposedScaleFactor || 1.0,
        sizeMetadata: integratedProfile.sizeMetadata || null,
        adaptiveScale: integratedProfile.adaptiveScale || null,
        isBountyTarget: Boolean(activeEncounter.isBountyTarget),
        bountyTraitNotice: activeEncounter.bountyTraitNotice || null,
        customTitle: activeEncounter.custom_title || null,
        isRangerSpecial: Boolean(activeEncounter.isRangerSpecial),
        isAirborne,
        resolvedDescription: activeEncounter.resolvedDescription,
        conditionText: combatState ? combatState.currentConditionText : '',
        conditionBracket: combatState ? bracketNumToKey(combatState.currentBracket) : '5_uninjured',
        heroStatusBadges: (combatState && Array.isArray(combatState.heroStatusBadges)) ? combatState.heroStatusBadges : [],
        currentRoundEvents,
        allEvents: actionEvents
      };
    }
  }

  const viewportScene = buildViewportScene(db, currentTile, facing, directions, safeEncounter, sceneMode);

  // Compute genuine evidence from real persistent_monsters / monster_instances on current or adjacent tiles
  const persistentOnTile = currentTile
    ? db.prepare("SELECT id, kill_count, custom_title FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'").get(currentTile.id)
    : null;
  const persistentAlert = persistentOnTile
    ? `Genuine Sign: Fresh bloodstains and scarred earth confirm a battle-hardened survivor (${persistentOnTile.kill_count || 1} fallen hero${Number(persistentOnTile.kill_count || 1) === 1 ? '' : 'es'} claimed) lurks at ${currentTile.name}.`
    : null;
  const adjacentPersistentCount = [
    viewportScene.ahead1,
    viewportScene.left1,
    viewportScene.right1,
    viewportScene.behind1
  ].filter(t => t && t.hasPersistentThreat).length;

  const adventure = buildAdventureClientPayload(
    character.id,
    currentTile,
    safeEncounter,
    persistentAlert,
    adjacentPersistentCount
  );

  const journalEncounters = db.prepare(`
    SELECT e.id, e.status, e.combat_round, e.created_at,
           COALESCE(hc.custom_name, mi.custom_title, m.name) as monster_name,
           m.name as base_monster_name,
           t.name as tile_name,
           (SELECT ce.public_text FROM combat_events ce WHERE ce.encounter_id = e.id AND ce.event_type = 'VICTORY' LIMIT 1) as victory_text
    FROM encounters e
    LEFT JOIN monsters m ON e.monster_id = m.id
    LEFT JOIN hunting_contracts hc ON e.bounty_contract_id = hc.id
    LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
    LEFT JOIN map_tiles t ON e.tile_id = t.id
    WHERE e.character_id = ? AND e.status IN ('VICTORY', 'ESCAPED', 'IN_COMBAT')
    ORDER BY e.id DESC
    LIMIT 10
  `).all(character.id);

  let infoMessage = extra.infoMessage || null;
  if (!infoMessage && claimedBounties.length > 0) {
    infoMessage = claimedBounties
      .map(b => `Bounty Completed! You have slain ${b.customName}. Oakhaven awards you ${b.rewardGold} Gold.`)
      .join(' ');
  }

  return {
    mode: safeEncounter ? safeEncounter.status : (isSafeCity ? 'CITY' : 'EXPLORATION'),
    facing,
    facingMeta: FACING_VECTORS[facing],
    sceneMode,
    viewportScene,
    character: {
      id: effectiveHero.id,
      name: effectiveHero.name,
      class: effectiveHero.class,
      level: effectiveHero.level,
      xp: effectiveHero.xp,
      gold: effectiveHero.gold,
      current_hp: effectiveHero.current_hp,
      max_hp: effectiveHero.max_hp,
      strength: effectiveHero.strength,
      constitution: effectiveHero.constitution,
      dexterity: effectiveHero.dexterity,
      intelligence: effectiveHero.intelligence,
      wisdom: effectiveHero.wisdom,
      charisma: effectiveHero.charisma,
      is_str_boosted: effectiveHero.is_str_boosted,
      primary_weapon: effectiveHero.primary_weapon || 'MELEE',
      favored_enemy_type: effectiveHero.favored_enemy_type,
      facing,
      sceneMode
    },
    modifiers,
    combatStats: {
      heroAC,
      meleeAttackBonus: meleeAttackBonus >= 0 ? `+${meleeAttackBonus}` : `${meleeAttackBonus}`,
      rangedAttackBonus: rangedAttackBonus >= 0 ? `+${rangedAttackBonus}` : `${rangedAttackBonus}`,
      isRangedActive: Boolean(isRangedActive),
      activeWeapon: activeWeapon ? {
        name: activeWeapon.name,
        damage_dice: activeWeapon.damage_dice || '1d4',
        weapon_range_type: activeWeapon.weapon_range_type || 'MELEE',
        is_two_handed: Boolean(Number(activeWeapon.is_two_handed) === 1 || activeWeapon.is_two_handed === true)
      } : {
        name: 'Bare Hands',
        damage_dice: '1d3',
        weapon_range_type: 'MELEE',
        is_two_handed: false
      }
    },
    equipment: {
      meleeWeapon: equipment.meleeWeapon || null,
      rangedWeapon: equipment.rangedWeapon || null,
      armor: equipment.armor || null,
      shield: equipment.shield || null,
      ring: equipment.ring || null,
      cloak: equipment.cloak || null,
      neck: equipment.neck || null,
      belt: equipment.belt || null,
      feet: equipment.feet || null
    },
    inventory,
    potions,
    combatPotions,
    potionCount: potions.length,
    combatPotionCount: combatPotions.length,
    clericHealInfo,
    currentTile,
    isSafeCity,
    terrainArtwork,
    minimap,
    directions,
    encounter: safeEncounter,
    victory: resolvedVictory,
    combatSequence: extra.combatSequence || null,
    fxCue: extra.fxCue || null,
    shopStock,
    bountyContracts,
    wildernessThreats,
    activeContract: activeContract && (!safeEncounter || safeEncounter.status !== 'DISCOVERED')
      ? activeContract
      : (activeContract ? { ...activeContract, custom_name: 'Hunted Quarry', base_monster_name: 'Quarry' } : null),
    persistentAlert,
    adventure,
    journalEncounters,
    infoMessage,
    errorMessage: extra.errorMessage || null
  };
}

function getLastEventId(db, encounterId) {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM combat_events WHERE encounter_id = ?').get(encounterId);
  return row ? Number(row.maxId || 0) : 0;
}

function captureCombatBeforeSnapshot(db, character, activeEnc) {
  const effMaxHp = activeEnc.instance_max_hp || activeEnc.bounty_boosted_max_hp || activeEnc.monster_max_hp || activeEnc.base_hp || 10;
  const bracketNum = getHealthBracket(activeEnc.current_monster_hp, effMaxHp);
  const conditionText = getConditionTextForBracket(activeEnc.monster_descriptions, bracketNum) || '';
  const cleanMonsterName = (activeEnc.monster_name || '').replace(/\[.*?\]/g, '').trim();
  const cleanBaseMonsterName = (activeEnc.base_monster_name || activeEnc.monster_name || '').replace(/\[.*?\]/g, '').trim();
  const cleanSlug = activeEnc.imageSlug || cleanBaseMonsterName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const imageUrl = activeEnc.imageUrl || (`/images/monsters/${cleanSlug}.png`);
  const isAirborne = Boolean(
    activeEnc.movement_type === 'FLY' ||
    activeEnc.movement_type === 'FLYING' ||
    activeEnc.is_flying
  );
  const integratedProfile = resolveMonsterIntegratedProfile(cleanSlug, isAirborne);

  return {
    heroHp: character.current_hp,
    heroMaxHp: character.max_hp,
    bracketKey: bracketNumToKey(bracketNum),
    conditionText,
    monsterInfo: {
      monsterName: cleanMonsterName,
      baseMonsterName: cleanBaseMonsterName,
      monsterSlug: cleanSlug,
      monsterSymbol: activeEnc.monster_symbol,
      monsterColor: activeEnc.monster_color || '#c5a059',
      imageUrl,
      cutoutImageUrl: integratedProfile.cutoutImageUrl,
      hasIntegratedCutout: integratedProfile.hasIntegratedCutout,
      integratedProfile,
      isBountyTarget: Boolean(activeEnc.isBountyTarget),
      isAirborne
    }
  };
}

function createLabApp(options = {}) {
  const { db, userId } = initSandboxDb(options.dbPath || null);
  const app = express();
  app.locals.db = db;
  app.locals.userId = userId;

  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));

  // Serve existing static assets (monster art, terrain art, base CSS) read-only
  app.use('/images', express.static(path.join(__dirname, '../public/images')));
  app.use('/images', express.static(path.join(__dirname, '../images')));
  app.use('/base-css', express.static(path.join(__dirname, '../public/css')));
  app.get('/lab-assets/monster-size-catalog.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile(path.join(__dirname, 'monster-size-catalog.js'));
  });
  app.use('/lab-assets', (req, res, next) => {
    if (req.path.startsWith('/images/')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    next();
  }, express.static(path.join(__dirname, 'public')));

  // Main Action Viewport SPA page
  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });

  // Get current game state
  app.get('/api/state', (req, res) => {
    try {
      const state = buildClientState(db, userId);
      res.json({ ok: true, state });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Phase 1.2: World Visual Atlas API (Interactive Developer Atlas for all 225 tiles & 900 viewpoints)
  app.get('/api/atlas', (req, res) => {
    try {
      const atlas = buildWorldVisualAtlas(db);
      res.json({ ok: true, ...atlas, atlas });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Phase 6.2: Visual QA & Coverage Dashboard API
  app.get('/api/visual-qa', (req, res) => {
    try {
      const atlas = buildWorldVisualAtlas(db);
      const qaPath = path.join(__dirname, 'docs/visual-qa-results.json');
      let qaReport = null;
      if (fs.existsSync(qaPath)) {
        try {
          qaReport = JSON.parse(fs.readFileSync(qaPath, 'utf8'));
        } catch {
          qaReport = null;
        }
      }
      const integratedMonsters = Object.entries(INTEGRATED_MONSTER_PROFILES).map(([key, p]) => ({
        key,
        slug: p.slug,
        sizeCategory: p.sizeCategory,
        groundingMode: p.groundingMode,
        cutoutImageUrl: p.cutoutImageUrl,
        contactCount: Array.isArray(p.contactPatches) ? p.contactPatches.length : 0,
        airborneGapPx: p.airborneGapPx || 0
      }));
      const pointsOfInterest = POINTS_OF_INTEREST.map(p => ({
        ...p,
        x: p.tileX,
        y: p.tileY,
        facings: Array.isArray(p.visibleFacings) && p.visibleFacings.length > 0
          ? p.visibleFacings
          : (p.facing ? [p.facing] : ['NORTH', 'EAST', 'SOUTH', 'WEST'])
      }));
      const atmosphereProfiles = Object.values(ATMOSPHERE_EFFECT_PROFILES);
      res.json({
        ok: true,
        status: 'OK',
        atlasSummary: atlas.summary,
        totalTiles: atlas.totalTiles,
        passableTiles: atlas.passableTiles,
        impassableTiles: atlas.impassableTiles,
        totalPassableViewpoints: atlas.totalPassableViewpoints,
        integratedMonsters,
        pointsOfInterest,
        atmosphereProfiles,
        effectProfilesCount: atmosphereProfiles.length,
        pointsOfInterestCount: pointsOfInterest.length,
        adventureCatalog: {
          discoveriesCount: DISCOVERY_CATALOG.length,
          expeditionsCount: Object.keys(EXPEDITION_DEFINITIONS).length
        },
        qaReport,
        automatedVisualQaResults: qaReport
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Pathfinder 1e Monster Size & Adaptive Visual Scaling API (Phases 1-4)
  app.get('/api/monster-scaling', (req, res) => {
    try {
      const vpW = Number(req.query.viewportWidth || 1920);
      const vpH = Number(req.query.viewportHeight || 1080);
      const virtualDistanceFt = Number(req.query.virtualDistanceFt || 12);
      const presentationMode = String(req.query.presentationMode || 'INTEGRATED').toUpperCase();
      const monsterQuery = req.query.monster || null;

      const auditSummary = getCatalogAuditSummary();
      const comparisonPresets = buildVisualComparisonPresets({ width: vpW, height: vpH });

      let singleScale = null;
      if (monsterQuery) {
        singleScale = computeAdaptiveMonsterVisualScale(monsterQuery, {
          viewportWidth: vpW,
          viewportHeight: vpH,
          virtualDistanceFt,
          presentationMode,
          overridePfSize: req.query.overridePfSize || null
        });
      }

      const scaledCatalog = MONSTER_SIZE_CATALOG.map(entry => ({
        ...entry,
        adaptiveScale: computeAdaptiveMonsterVisualScale(entry, {
          viewportWidth: vpW,
          viewportHeight: vpH,
          virtualDistanceFt,
          presentationMode: entry.hasCutout ? 'INTEGRATED' : 'CARD'
        })
      }));

      const scaledReferenceSpecimens = PF1E_SIZE_REFERENCE_SPECIMENS.map(entry => ({
        ...entry,
        adaptiveScale: computeAdaptiveMonsterVisualScale(entry, {
          viewportWidth: vpW,
          viewportHeight: vpH,
          virtualDistanceFt,
          presentationMode: entry.hasCutout ? 'INTEGRATED' : 'CARD'
        })
      }));

      res.json({
        ok: true,
        viewport: { width: vpW, height: vpH, virtualDistanceFt },
        auditSummary,
        pfSizeCategories: PF1E_SIZE_CATEGORIES,
        visualBodyProfiles: VISUAL_BODY_PROFILES,
        catalogCount: scaledCatalog.length,
        catalog: scaledCatalog,
        referenceSpecimens: scaledReferenceSpecimens,
        comparisonPresets,
        singleScale
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Unified Action Endpoint for Single-Page Flow
  app.post('/api/action', (req, res) => {
    const rawBody = req.body || {};
    const action = rawBody.action;
    const payload = { ...rawBody, ...(rawBody.payload || {}) };
    const character = getLivingCharacterByUserId(db, userId);

    try {
      if (action === 'REVIVE') {
        const heroClass = payload.classType || 'FIGHTER';
        ensureLivingHero(db, userId, heroClass);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: 'A new champion rises in Oakhaven Sanctuary.',
            fxCue: { type: 'HEAL' }
          })
        });
      }

      if (!character) {
        return res.json({ ok: true, state: buildClientState(db, userId) });
      }

      const charRow = db.prepare('SELECT facing, pending_victory_encounter_id, scene_mode FROM characters WHERE id = ?').get(character.id) || {};
      const currentFacing = normalizeFacing(charRow.facing || 'NORTH');

      // 0a. SET_SCENE_MODE ('A' | 'B' | 'C' | 'LEGACY') — Live comparison switcher
      if (action === 'SET_SCENE_MODE') {
        const nextMode = normalizeSceneMode(payload.sceneMode || payload.mode || 'A');
        db.prepare('UPDATE characters SET scene_mode = ? WHERE id = ?').run(nextMode, character.id);
        const modeDescMap = {
          A: 'Scene Mode A (Single Scene — Place-Centric)',
          B: 'Scene Mode B (Directional Scene — Forward-Vista)',
          C: 'Scene Mode C (First-Person Perspective — Eye-Level Location + Facing)',
          LEGACY: 'Legacy Multi-Plane Blended + SVG'
        };
        const modeDesc = modeDescMap[nextMode] || modeDescMap.A;
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Switched viewport renderer to ${modeDesc}.`
          })
        });
      }

      // 0. TURN / ROTATE FACING (Never rolls encounters, never resets active encounter, never grants free combat actions)
      if (action === 'TURN') {
        const turnDir = String(payload.turn || payload.direction || '').toUpperCase().trim();
        const nextFacing = payload.facing
          ? normalizeFacing(payload.facing)
          : rotateFacing(currentFacing, turnDir);

        db.prepare('UPDATE characters SET facing = ? WHERE id = ?').run(nextFacing, character.id);

        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            fxCue: {
              type: 'TURN',
              turn: turnDir === 'LEFT' || turnDir === 'CCW' ? 'LEFT' : 'RIGHT',
              previousFacing: currentFacing,
              facing: nextFacing
            }
          })
        });
      }

      // 0b. OPTIONAL DISMISS VICTORY OVERLAY (Not required before moving!)
      if (action === 'DISMISS_VICTORY') {
        db.prepare('UPDATE characters SET pending_victory_encounter_id = NULL WHERE id = ?').run(character.id);
        return res.json({
          ok: true,
          state: buildClientState(db, userId)
        });
      }

      // 1. MOVEMENT (Relative FORWARD / BACKWARD / STRAFE_LEFT / STRAFE_RIGHT or Cardinal NORTH / EAST / SOUTH / WEST)
      if (action === 'MOVE') {
        const relInput = String(payload.relative || '').toUpperCase().trim();
        const relMap = getRelativeCardinalMap(currentFacing);

        let direction = '';
        let moveKind = 'FORWARD';

        if (relInput && relMap[relInput]) {
          direction = relMap[relInput];
          moveKind = relInput === 'LEFT' ? 'STRAFE_LEFT' : (relInput === 'RIGHT' ? 'STRAFE_RIGHT' : relInput);
        } else {
          direction = String(payload.direction || '').toUpperCase().trim();
          moveKind = getMoveKindFromCardinal(currentFacing, direction);
        }

        if (!FACING_ORDER.includes(direction)) {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: `Invalid movement direction: ${direction || relInput || 'NONE'}.`,
              fxCue: { type: 'BLOCKED_MOVE', moveKind, relativeMove: moveKind }
            })
          });
        }

        // Check active encounter state first
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (activeEnc && activeEnc.status === 'IN_COMBAT') {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: 'You cannot walk away while engaged in combat! You must fight or flee.',
              fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
            })
          });
        }

        // Check if DISCOVERED encounter is an Ambush
        let isAmbushLocked = false;
        if (activeEnc && activeEnc.status === 'DISCOVERED') {
          let labForcedAmbush = false;
          const rawEnc = db.prepare('SELECT is_ambush, combat_state_json FROM encounters WHERE id = ?').get(activeEnc.id);
          if (rawEnc && rawEnc.combat_state_json) {
            try {
              const parsed = JSON.parse(rawEnc.combat_state_json);
              labForcedAmbush = Boolean(parsed && parsed.labForcedAmbush);
            } catch {
              labForcedAmbush = false;
            }
          }
          isAmbushLocked = Boolean(activeEnc.isAmbush || (rawEnc && Number(rawEnc.is_ambush) === 1) || labForcedAmbush);
          if (isAmbushLocked) {
            return res.json({
              ok: false,
              state: buildClientState(db, userId, {
                errorMessage: 'Ambush! Your path is cut off—you cannot bypass this threat and must face the ambush!',
                fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
              })
            });
          }
        }

        // Validate target tile coordinates and passability BEFORE modifying any DISCOVERED encounter
        const currentTile = getTileById(db, character.tile_id);
        const dirVec = FACING_VECTORS[direction];
        const targetTile = currentTile ? getTileByCoords(db, currentTile.x + dirVec.dx, currentTile.y + dirVec.dy) : null;

        if (!targetTile) {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: 'You stand at the edge of the world; you cannot travel further in this direction.',
              fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
            })
          });
        }

        if (targetTile.is_passable === 0) {
          return res.json({
            ok: false,
            state: buildClientState(db, userId, {
              errorMessage: `Path blocked: ${targetTile.name} (${targetTile.terrain}) is impassable.`,
              fxCue: { type: 'BLOCKED_MOVE', direction, moveKind, relativeMove: moveKind }
            })
          });
        }

        let spawnedEncounter = null;
        let bypassedEncounter = false;

        withTransaction(db, (tx) => {
          // If an un-ambushed DISCOVERED encounter was on the tile, bypass it and move in the same atomic action
          if (activeEnc && activeEnc.status === 'DISCOVERED') {
            ignoreEncounter(tx, character.id, activeEnc.id);
            bypassedEncounter = true;
          }

          // Clear any pending victory overlay and update character tile_id
          tx.prepare('UPDATE characters SET tile_id = ?, pending_victory_encounter_id = NULL WHERE id = ?').run(
            targetTile.id,
            character.id
          );

          // Roll for encounter on the new tile unless safe city
          if (!(targetTile.terrain === 'CITY' && targetTile.is_safe === 1)) {
            const encounterOpts = {};
            if (options.rng) encounterOpts.rng = options.rng;
            if (payload.testForceEncounter !== undefined) {
              encounterOpts.forcedChance = payload.testForceEncounter ? 100 : 0;
            }
            spawnedEncounter = checkTileEncounter(tx, character, targetTile, encounterOpts);
          }
        });

        const infoMessage = bypassedEncounter
          ? `You slipped past the threat in the shadows and moved ${FACING_VECTORS[direction].label.toLowerCase()} to ${targetTile.name}.`
          : null;

        // Update isolated Adventure Experience state on movement step (never consumes combat/encounter RNG)
        onPlayerStep(
          character.id,
          targetTile,
          spawnedEncounter
            ? { status: 'STAGE1_PRE_COMBAT', isPersistent: Boolean(spawnedEncounter.monster_instance_id), monsterName: null }
            : null,
          null,
          0
        );

        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage,
            fxCue: {
              type: spawnedEncounter ? 'ENCOUNTER_DISCOVERED' : 'STEP',
              direction,
              moveKind,
              relativeMove: moveKind,
              facing: currentFacing,
              bypassedEncounter,
              bypassedPrevious: bypassedEncounter
            }
          })
        });
      }

      // 2. ENCOUNTER: INVESTIGATE / ENGAGE (Enter Stage 2 Combat)
      if (action === 'INVESTIGATE' || action === 'ENGAGE') {
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (!activeEnc) {
          throw new Error('No active threat to engage.');
        }
        const lastEventIdBefore = getLastEventId(db, activeEnc.id);
        const beforeSnap = captureCombatBeforeSnapshot(db, character, activeEnc);
        const currentTile = getTileById(db, character.tile_id);

        const result = investigateEncounter(db, character.id, activeEnc.id, character.class);
        if (result && (result.status === 'VICTORY' || result.monsterDied)) {
          db.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(activeEnc.id, character.id);
          const victoryData = getVictoryData(db, character.id, activeEnc.id);
          recordEncounterOutcome(
            character.id,
            currentTile,
            beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
            'VICTORY'
          );
          const nextState = buildClientState(db, userId, {
            victory: victoryData,
            fxCue: { type: 'VICTORY', openingShotKill: true }
          });
          nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
          return res.json({ ok: true, state: nextState });
        }

        const advState = getOrCreateAdventureState(character.id, currentTile);
        recordEncounterStart(advState, currentTile, {
          status: 'IN_COMBAT',
          monsterName: beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature'
        });

        const nextState = buildClientState(db, userId, {
          fxCue: { type: 'REVEAL_MONSTER' }
        });
        nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
        return res.json({ ok: true, state: nextState });
      }

      // 3. ENCOUNTER: IGNORE / BYPASS IN PLACE
      if (action === 'IGNORE' || action === 'BYPASS') {
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (!activeEnc) {
          throw new Error('No active threat to bypass.');
        }
        const rawEnc = db.prepare('SELECT combat_state_json FROM encounters WHERE id = ?').get(activeEnc.id);
        if (rawEnc && rawEnc.combat_state_json) {
          let parsed = {};
          try { parsed = JSON.parse(rawEnc.combat_state_json); } catch { parsed = {}; }
          if (parsed && parsed.labForcedAmbush) {
            throw new Error('Ambush! Your path is cut off—you cannot bypass this threat and must face the ambush!');
          }
        }
        ignoreEncounter(db, character.id, activeEnc.id);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: 'You slipped past the threat in the shadows undetected.',
            fxCue: { type: 'BYPASS' }
          })
        });
      }

      // 4. COMBAT: ATTACK
      if (action === 'ATTACK') {
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (!activeEnc || activeEnc.status !== 'IN_COMBAT') {
          throw new Error('No active combat encounter.');
        }
        const prevHp = character.current_hp;
        const lastEventIdBefore = getLastEventId(db, activeEnc.id);
        const beforeSnap = captureCombatBeforeSnapshot(db, character, activeEnc);
        const currentTile = getTileById(db, character.tile_id);

        const roundOpts = {
          expectedRound: payload.expectedRound !== undefined ? Number(payload.expectedRound) : (activeEnc.combat_round || 1)
        };
        if (options.rng) roundOpts.rng = options.rng;

        const resultState = executeCombatRound(db, character.id, activeEnc.id, 'ATTACK', roundOpts);
        const hpLost = Math.max(0, prevHp - (resultState.character ? resultState.character.current_hp : prevHp));

        if (resultState.character && resultState.character.is_alive === 0) {
          recordEncounterOutcome(
            character.id,
            currentTile,
            beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
            'DEFEAT'
          );
          const nextState = buildClientState(db, userId, { fxCue: { type: 'HERO_DEATH', hpLost } });
          nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
          return res.json({ ok: true, state: nextState });
        }

        if (resultState.encounter && resultState.encounter.status === 'VICTORY') {
          db.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(activeEnc.id, character.id);
          const victoryData = getVictoryData(db, character.id, activeEnc.id);
          recordEncounterOutcome(
            character.id,
            currentTile,
            beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
            'VICTORY'
          );
          const nextState = buildClientState(db, userId, {
            victory: victoryData,
            fxCue: { type: 'VICTORY', hpLost }
          });
          nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
          return res.json({ ok: true, state: nextState });
        }

        const nextState = buildClientState(db, userId, {
          fxCue: { type: 'ATTACK_EXCHANGE', hpLost }
        });
        nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
        return res.json({ ok: true, state: nextState });
      }

      // 5. COMBAT OR EXPLORATION: DRINK POTION
      if (action === 'POTION') {
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        const combatPotions = getCharacterPotions(db, character.id, { combatOnly: true });
        const chosenPotionId = payload.potionInstanceId
          ? Number(payload.potionInstanceId)
          : (combatPotions[0] ? combatPotions[0].id : null);

        if (!chosenPotionId) {
          throw new Error('No healing potions remaining in your pack.');
        }

        if (activeEnc && activeEnc.status === 'IN_COMBAT') {
          const prevHp = character.current_hp;
          const lastEventIdBefore = getLastEventId(db, activeEnc.id);
          const beforeSnap = captureCombatBeforeSnapshot(db, character, activeEnc);

          const resultState = executeCombatRound(db, character.id, activeEnc.id, 'DRINK_POTION', {
            expectedRound: activeEnc.combat_round || 1,
            potionInstanceId: chosenPotionId,
            rng: options.rng
          });
          const hpDelta = (resultState.character ? resultState.character.current_hp : prevHp) - prevHp;
          const nextState = buildClientState(db, userId, {
            fxCue: { type: 'POTION_COMBAT', hpDelta }
          });
          nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
          return res.json({ ok: true, state: nextState });
        } else {
          if (activeEnc && activeEnc.status === 'DISCOVERED') {
            throw new Error('Engage or bypass the threat before drinking a potion.');
          }
          const resUse = useConsumable(db, character.id, chosenPotionId);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: resUse.message,
              fxCue: { type: 'HEAL', healed: resUse.healed }
            })
          });
        }
      }

      // 6. COMBAT: FLEE
      if (action === 'FLEE') {
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (!activeEnc || activeEnc.status !== 'IN_COMBAT') {
          throw new Error('Not currently in combat.');
        }
        const prevHp = character.current_hp;
        const lastEventIdBefore = getLastEventId(db, activeEnc.id);
        const beforeSnap = captureCombatBeforeSnapshot(db, character, activeEnc);
        const currentTile = getTileById(db, character.tile_id);

        const resultState = executeCombatRound(db, character.id, activeEnc.id, 'FLEE', {
          expectedRound: activeEnc.combat_round || 1,
          rng: options.rng
        });
        const hpLost = Math.max(0, prevHp - (resultState.character ? resultState.character.current_hp : prevHp));

        recordEncounterOutcome(
          character.id,
          currentTile,
          beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
          resultState.character && resultState.character.is_alive === 0 ? 'DEFEAT' : 'FLED'
        );

        const nextState = buildClientState(db, userId, {
          infoMessage: resultState.character && resultState.character.is_alive === 0
            ? null
            : 'You broke away from the creature under its parting strike and escaped!',
          fxCue: { type: 'FLEE', hpLost }
        });
        nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
        return res.json({ ok: true, state: nextState });
      }

      // 7. SWITCH STANCE (MELEE / RANGED)
      if (action === 'STANCE') {
        const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
        if (activeEnc) {
          throw new Error('Cannot switch weapon stance while engaged in an encounter.');
        }
        const nextStance = payload.primaryWeapon || (character.primary_weapon === 'RANGED' ? 'MELEE' : 'RANGED');
        setPrimaryWeaponPreference(db, character.id, nextStance);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Combat stance switched to ${nextStance}.`,
            fxCue: { type: 'STANCE_SWAP', stance: nextStance }
          })
        });
      }

      // 8. SANCTUARY REST
      if (action === 'REST') {
        const result = performCityRest(db, character.id);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `You rested in Oakhaven Sanctuary. Vitality restored to ${result.maxHp} HP.`,
            fxCue: { type: 'HEAL' }
          })
        });
      }

      // 9. CLERIC HEAL
      if (action === 'CLERIC_HEAL') {
        const result = performClericSelfHeal(db, character.id);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Divine radiance restores ${result.healed} HP (${result.currentHp}/${result.maxHp} HP).`,
            fxCue: { type: 'HEAL', healed: result.healed }
          })
        });
      }

      // 10. EQUIP / UNEQUIP / BUY / SELL / BOUNTIES
      if (action === 'EQUIP') {
        equipItem(db, character.id, Number(payload.itemInstanceId), payload.targetSlot || null);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, { infoMessage: 'Armament equipped.' })
        });
      }

      if (action === 'UNEQUIP') {
        unequipItem(db, character.id, Number(payload.itemInstanceId));
        return res.json({
          ok: true,
          state: buildClientState(db, userId, { infoMessage: 'Item stowed in backpack.' })
        });
      }

      if (action === 'BUY') {
        const result = buyItem(db, character.id, {
          itemDefinitionId: payload.itemDefinitionId ? Number(payload.itemDefinitionId) : null,
          listingId: payload.listingId ? Number(payload.listingId) : null
        });
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Purchased ${result.purchasedItem.name} for ${result.purchasedItem.price} gp.`
          })
        });
      }

      if (action === 'SELL') {
        const result = sellItem(db, character.id, Number(payload.itemInstanceId));
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Sold ${result.itemName} for ${result.goldEarned} gp.`
          })
        });
      }

      if (action === 'ACCEPT_BOUNTY') {
        const result = acceptContract(db, character, Number(payload.contractId));
        if (!result.ok) throw new Error(result.error);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Accepted Warrant: "${result.contract.contract_title}" in ${result.contract.target_region}.`
          })
        });
      }

      if (action === 'ABANDON_BOUNTY') {
        const result = abandonContract(db, character, Number(payload.contractId));
        if (!result.ok) throw new Error(result.error);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: 'Hunting contract abandoned.'
          })
        });
      }

      // 11. PHASE 4.3: INSPECT POINT OF INTEREST (Non-gameplay lore inspection)
      if (action === 'INSPECT_POI') {
        const currentTile = getTileById(db, character.tile_id);
        const fVec = FACING_VECTORS[currentFacing];
        const ahead1 = currentTile ? inspectSceneTile(db, currentTile.x + fVec.dx, currentTile.y + fVec.dy, currentFacing) : null;
        const currentInspected = currentTile ? inspectSceneTile(db, currentTile.x, currentTile.y, currentFacing) : null;
        const poi = resolvePointOfInterest(currentInspected, ahead1, currentFacing);
        if (!poi) {
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `You survey ${currentTile ? currentTile.name : 'your surroundings'}: ${currentTile && currentTile.description ? currentTile.description : 'Only the cold wind and drifting mist stir ahead.'}`
            })
          });
        }
        recordPoiInspection(character.id, currentTile, poi);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `${poi.icon} ${poi.title}: ${poi.description}`,
            fxCue: { type: 'INSPECT_POI', poi }
          })
        });
      }

      // 11b. ADVENTURE EXPERIENCE ACTIONS (Isolated Lab-Only Layer — Phases 3, 5, 6, 8, 9)
      if (action === 'SET_ADVENTURE_MODE') {
        const currentTile = getTileById(db, character.tile_id);
        const advState = getOrCreateAdventureState(character.id, currentTile);
        const nextEnabled = payload.enabled !== undefined ? Boolean(payload.enabled) : !advState.enabled;
        advState.enabled = nextEnabled;
        advState.modeLabel = nextEnabled ? 'Adventure Experience — Experimental' : 'Current Experience (Baseline)';
        if (!nextEnabled) {
          advState.activeDiscovery = null;
          advState.activeTensionCue = null;
        } else if (currentTile && currentTile.is_safe === 0) {
          advState.activeDiscovery = selectDiscoveryForTile(advState, currentTile);
        }
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: nextEnabled
              ? 'Enabled Adventure Experience — Experimental (environmental discoveries, tension cues, choices & expedition journal active).'
              : 'Switched to Current Experience (baseline Lab exploration without experimental overlays).'
          })
        });
      }

      if (action === 'START_EXPEDITION' || action === 'RESET_EXPEDITION') {
        const requestedKey = payload.expeditionKey || 'MIRKWOOD_EXPEDITION';
        const expDef = EXPEDITION_DEFINITIONS[requestedKey] || EXPEDITION_DEFINITIONS.MIRKWOOD_EXPEDITION;
        const startFacing = normalizeFacing(
          payload.facing || (action === 'RESET_EXPEDITION' ? 'NORTH' : (expDef.startTile.facing || 'NORTH'))
        );
        const startTile = getTileByCoords(db, expDef.startTile.x, expDef.startTile.y);

        db.prepare(`
          UPDATE encounters SET status = 'ESCAPED'
          WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
        `).run(character.id);
        if (startTile) {
          db.prepare('UPDATE characters SET tile_id = ?, current_hp = max_hp, facing = ?, pending_victory_encounter_id = NULL WHERE id = ?').run(
            startTile.id,
            startFacing,
            character.id
          );
        }

        const currentAdv = getOrCreateAdventureState(character.id, startTile);
        resetAdventureState(character.id, {
          enabled: action === 'START_EXPEDITION' ? true : currentAdv.enabled,
          expeditionKey: expDef.expeditionKey,
          deterministicSeed: payload.deterministicSeed !== undefined ? Number(payload.deterministicSeed) : currentAdv.deterministicSeed
        });

        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: action === 'RESET_EXPEDITION'
              ? `Expedition reset: returned to Oakhaven Sanctuary [7,7] for ${expDef.title}.`
              : `${expDef.briefingTitle}: ${expDef.briefingText}`,
            fxCue: { type: 'STEP', moveKind: 'FORWARD' }
          })
        });
      }

      if (action === 'RESOLVE_DISCOVERY_CHOICE') {
        const currentTile = getTileById(db, character.tile_id);
        const result = resolveDiscoveryChoice(
          character.id,
          currentTile,
          payload.discoveryKey || payload.discoveryId,
          payload.choiceKey || payload.choiceId
        );
        if (!result.ok) {
          throw new Error(result.error || 'Could not resolve discovery choice.');
        }
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `${result.outcomeTitle}: ${result.outcomeText}`,
            fxCue: {
              type: 'DISCOVERY_RESOLVED',
              outcomeTitle: result.outcomeTitle,
              outcomeText: result.outcomeText
            }
          })
        });
      }

      if (action === 'DISMISS_DISCOVERY') {
        const currentTile = getTileById(db, character.tile_id);
        const advState = getOrCreateAdventureState(character.id, currentTile);
        if (advState.activeDiscovery) {
          const rec = advState.discoveredMap[advState.activeDiscovery.discoveryKey];
          if (rec && rec.status === 'DISCOVERED') {
            rec.status = 'PASSED';
          }
          advState.activeDiscovery = null;
        }
        return res.json({
          ok: true,
          state: buildClientState(db, userId)
        });
      }

      if (action === 'FORCE_DISCOVERY') {
        const currentTile = getTileById(db, character.tile_id);
        const advState = getOrCreateAdventureState(character.id, currentTile);
        advState.enabled = true;
        const forced = selectDiscoveryForTile(advState, currentTile, {
          forceTrigger: true,
          discoveryKey: payload.discoveryKey || payload.discoveryId || null
        });
        advState.activeDiscovery = forced;
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: forced
              ? `Director Triggered Discovery: ${forced.title} (${forced.tier}).`
              : `No eligible wilderness discovery on ${currentTile ? currentTile.name : 'this tile'} (step outside safe sanctuary to trigger).`
          })
        });
      }

      if (action === 'SET_DETERMINISTIC_SEED') {
        const currentTile = getTileById(db, character.tile_id);
        const advState = getOrCreateAdventureState(character.id, currentTile);
        advState.deterministicSeed = Number(payload.seed || 4201);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Deterministic Adventure Seed set to ${advState.deterministicSeed}.`
          })
        });
      }

      // 12. PHASE 1.2: TELEPORT TO TILE (From World Visual Atlas / Expedition Presets)
      if (action === 'TELEPORT_TO_TILE') {
        const tx = Number(payload.x);
        const ty = Number(payload.y);
        const targetFacing = payload.facing ? normalizeFacing(payload.facing) : currentFacing;
        const targetTile = getTileByCoords(db, tx, ty);
        if (!targetTile) {
          throw new Error(`No map tile found at coordinates (${tx}, ${ty}).`);
        }
        db.prepare(`
          UPDATE encounters SET status = 'ESCAPED'
          WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
        `).run(character.id);
        db.prepare('UPDATE characters SET tile_id = ?, facing = ?, pending_victory_encounter_id = NULL WHERE id = ?').run(
          targetTile.id,
          targetFacing,
          character.id
        );
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Atlas Teleport: Positioned at ${targetTile.name} [${targetTile.x}, ${targetTile.y}] Facing ${targetFacing}.`,
            fxCue: { type: 'STEP', moveKind: 'FORWARD' }
          })
        });
      }

      // =====================================================================
      // LAB DIRECTOR ACTIONS (For instant UI testing of any scenario!)
      // =====================================================================
      if (action === 'LAB_SCENARIO') {
        const scenario = payload.scenario;

        // Clear any active encounter and pending victory first
        db.prepare(`
          UPDATE encounters SET status = 'ESCAPED'
          WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
        `).run(character.id);
        db.prepare('UPDATE characters SET pending_victory_encounter_id = NULL WHERE id = ?').run(character.id);

        if (scenario === 'TELEPORT') {
          const tx = Number(payload.x ?? 7);
          const ty = Number(payload.y ?? 7);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          const targetTile = getTileByCoords(db, tx, ty);
          if (!targetTile) {
            throw new Error(`No map tile found at (${tx}, ${ty}).`);
          }
          db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(targetTile.id, targetFacing, character.id);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Teleported to ${targetTile.name} [${targetTile.x}, ${targetTile.y}] (Facing ${targetFacing}).`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'CITY') {
          const cityTile = db.prepare("SELECT id FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1").get();
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (cityTile) {
            db.prepare('UPDATE characters SET tile_id = ?, current_hp = max_hp, facing = ? WHERE id = ?').run(cityTile.id, targetFacing, character.id);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Teleported to Oakhaven Sanctuary (Facing ${targetFacing}).`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'NORTH_GATE' || scenario === 'GATE') {
          const gateTile = getTileByCoords(db, 7, 6);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (gateTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(gateTile.id, targetFacing, character.id);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Oakhaven North Gate [7, 6] Facing ${targetFacing} (North: Mirkwood Crossroads, South: Oakhaven Sanctuary).`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'BRIDGE') {
          const bridgeTile = getTileByCoords(db, 8, 7);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'EAST';
          if (bridgeTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(bridgeTile.id, targetFacing, character.id);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at The Old Stone Bridge [8, 7] Facing ${targetFacing} (East: Watchpost, West: Oakhaven, N/S: Blackwater River).`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'ANCIENT_OAK' || scenario === 'OAK') {
          const oakTile = getTileByCoords(db, 7, 3);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (oakTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(oakTile.id, targetFacing, character.id);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at The Primeval Black Oak [7, 3] Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'DEADMANS_MIRE' || scenario === 'MIRE') {
          const mireTile = getTileByCoords(db, 4, 11);
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (mireTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(mireTile.id, targetFacing, character.id);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Deadman’s Mire Sunken Ruins [4, 11] Facing ${targetFacing}.`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'RESET_WORLD') {
          db.prepare("UPDATE monster_instances SET status = 'SLAIN' WHERE status = 'ACTIVE'").run();
          db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE status IN ('DISCOVERED', 'IN_COMBAT')").run();
          const cityTile = db.prepare("SELECT id FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1").get();
          if (cityTile) {
            db.prepare("UPDATE characters SET tile_id = ?, current_hp = max_hp, facing = 'NORTH', pending_victory_encounter_id = NULL WHERE id = ?").run(cityTile.id, character.id);
          }
          resetAdventureState(character.id);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: 'Sandbox world reset: cleared persistent monster instances and returned to Oakhaven Sanctuary.',
              fxCue: { type: 'HEAL' }
            })
          });
        }

        if (scenario === 'WILDERNESS' || scenario === 'TEST_CORRIDOR') {
          // Place at (7, 5) Mirkwood Forest where:
          // North = Mirkwood Forest, West = Stonefang Crag (Blocked), South = Oakhaven North Gate, East = Mirkwood Forest (toward River)
          const wildTile = getTileByCoords(db, 7, 5) || db.prepare("SELECT * FROM map_tiles WHERE terrain = 'FOREST' AND is_safe = 0 AND is_passable = 1 LIMIT 1").get();
          const targetFacing = payload.facing ? normalizeFacing(payload.facing) : 'NORTH';
          if (wildTile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ? WHERE id = ?').run(wildTile.id, targetFacing, character.id);
          }
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Positioned at Mirkwood Crossroads [7, 5] Facing ${targetFacing} (Ahead: Forest, West: Crag Obstacle, South: Gate).`,
              fxCue: { type: 'STEP', moveKind: 'FORWARD' }
            })
          });
        }

        if (scenario === 'STAGE1_MYSTERY' || scenario === 'STAGE1_AMBUSH' || scenario === 'STAGE2_COMBAT') {
          // Move to a suitable wilderness tile if currently in a safe tile
          let tile = getTileById(db, character.tile_id);
          let relocatedFromSafe = false;
          if (!tile || tile.is_safe === 1) {
            relocatedFromSafe = true;
            tile = getTileByCoords(db, 7, 5) || db.prepare("SELECT * FROM map_tiles WHERE terrain IN ('FOREST', 'SWAMP', 'HILLS') AND is_safe = 0 AND is_passable = 1 LIMIT 1").get();
          }
          const liveCharRow = db.prepare('SELECT facing FROM characters WHERE id = ?').get(character.id);
          const heroFacing = normalizeFacing((liveCharRow && liveCharRow.facing) || character.facing || 'NORTH');
          let targetFacing = 'NORTH';
          if (payload.facing) {
            targetFacing = normalizeFacing(payload.facing);
          } else if (tile && (tile.terrain === 'BRIDGE' || (tile.x === 8 && tile.y === 7))) {
            targetFacing = (heroFacing === 'EAST' || heroFacing === 'WEST') ? heroFacing : 'EAST';
          } else if (payload.preserveFacing && !relocatedFromSafe) {
            targetFacing = heroFacing;
          }
          if (tile) {
            db.prepare('UPDATE characters SET tile_id = ?, facing = ?, current_hp = max_hp WHERE id = ?').run(tile.id, targetFacing, character.id);
            // Clear any leftover persistent monster_instances on the test tile so scenario spawn is clean and predictable
            db.prepare("UPDATE monster_instances SET status = 'SLAIN' WHERE tile_id = ? AND status = 'ACTIVE'").run(tile.id);
          }

          let monster = null;
          if (payload.monsterName) {
            const rawQuery = String(payload.monsterName).trim().toLowerCase();
            const normalizedMonsterQuery = rawQuery === 'creeping vine' ? 'assassin vine' : rawQuery;
            monster = db.prepare('SELECT * FROM monsters WHERE LOWER(name) = ? LIMIT 1').get(normalizedMonsterQuery)
              || db.prepare('SELECT * FROM monsters WHERE LOWER(name) LIKE ? LIMIT 1').get(`%${normalizedMonsterQuery}%`);
          }
          if (!monster) {
            monster = db.prepare("SELECT * FROM monsters WHERE name IN ('Assassin Vine', 'Ghoul', 'Wolf', 'Manticore', 'Giant Spider', 'Rust Monster') ORDER BY RANDOM() LIMIT 1").get()
              || db.prepare('SELECT * FROM monsters ORDER BY RANDOM() LIMIT 1').get();
          }

          const isAmbushScenario = scenario === 'STAGE1_AMBUSH' ? 1 : 0;
          const spottedByHero = isAmbushScenario ? 0 : 1;
          const stateJson = isAmbushScenario ? JSON.stringify({ labForcedAmbush: true }) : '{}';

          const ins = db.prepare(`
            INSERT INTO encounters (
              character_id, tile_id, monster_id, status,
              current_monster_hp, monster_max_hp, combat_round,
              spotted_by_hero, is_ambush, opening_shot_resolved, combat_state_json
            ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, ?, ?, 0, ?)
          `).run(character.id, tile.id, monster.id, monster.base_hp, monster.base_hp, spottedByHero, isAmbushScenario, stateJson);

          const encId = Number(ins.lastInsertRowid);
          if (scenario === 'STAGE2_COMBAT') {
            investigateEncounter(db, character.id, encId, character.class, options.rng ? { rng: options.rng } : {});
            db.prepare("UPDATE encounters SET initiative_winner = 'HERO' WHERE id = ?").run(encId);
            return res.json({
              ok: true,
              state: buildClientState(db, userId, {
                fxCue: { type: 'REVEAL_MONSTER' }
              })
            });
          }

          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              fxCue: { type: 'ENCOUNTER_DISCOVERED' }
            })
          });
        }

        if (scenario === 'SWITCH_CLASS') {
          const nextClass = payload.classType || 'FIGHTER';
          db.prepare('UPDATE characters SET is_alive = 0 WHERE id = ?').run(character.id);
          ensureLivingHero(db, userId, nextClass);
          return res.json({
            ok: true,
            state: buildClientState(db, userId, {
              infoMessage: `Switched active test champion to ${nextClass}.`,
              fxCue: { type: 'HEAL' }
            })
          });
        }
      }

      throw new Error(`Unknown action: ${action}`);
    } catch (err) {
      return res.json({
        ok: false,
        state: buildClientState(db, userId, { errorMessage: err.message })
      });
    }
  });

  return app;
}

if (require.main === module) {
  const app = createLabApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log('===========================================================');
    console.log(' DARKGRID ACTION VIEWPORT LAB running at:');
    console.log(` -> http://localhost:${PORT}`);
    console.log(` Isolated DB: ${DEFAULT_DB_PATH}`);
    console.log('===========================================================');
  });
}

module.exports = {
  createLabApp,
  FACING_ORDER,
  FACING_VECTORS,
  normalizeFacing,
  rotateFacing,
  getRelativeCardinalMap,
  computeTileFacingSeed,
  SCENE_MODES,
  POV_TIERS,
  COVERAGE_QUALITY_GRADES,
  ATMOSPHERE_EFFECT_PROFILES,
  POINTS_OF_INTEREST,
  DEFAULT_SCENE_VARIANTS,
  DEFAULT_PERSPECTIVE_VIEWS,
  DEFAULT_POV_CONTEXT_RULES,
  INTEGRATED_MONSTER_PROFILES,
  resolveMonsterIntegratedProfile,
  resolveAtmosphereEffectProfile,
  resolvePointOfInterest,
  buildWorldVisualAtlas,
  normalizeSceneMode,
  computeDeterministicVariantIndex,
  resolveTileVariant,
  resolveSceneModeA,
  resolveSceneModeB,
  resolveSceneModeC,
  resolveSceneModeLegacy,
  PRESENTATION_TIERS,
  DISCOVERY_CATALOG,
  EXPEDITION_DEFINITIONS
};
