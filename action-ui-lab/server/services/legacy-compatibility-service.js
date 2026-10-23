/**
 * DARKGRID ADVENTURE LAB — Phase 6 & Phase 7B Legacy Compatibility, Session, Security & Idempotency Service
 *
 * Bridges the Darkgrid backend systems (`src/domain/*`, `src/db/*`, `src/middleware/*`)
 * with the Action Viewport Lab.
 *
 * Responsibilities:
 *   1. Non-destructive schema compatibility adapter for existing Darkgrid SQLite databases (including Phase 7B columns & tables)
 *   2. Multi-user session resolution (`SqliteSessionStore` + sandbox fallback for automated tests)
 *   3. JSON-native Anti-Tamper protection (enforcing `FORBIDDEN_CLIENT_FIELDS` on body, payload & query)
 *   4. JSON-native Action Idempotency protection (`X-Idempotency-Key` / `_actionId` via `action_idempotency_log`)
 *   5. Live database & system parity audit (`verifyLegacyDatabaseCompatibility`)
 *   6. Secrecy-compliant Class Ability Summary (`buildClassAbilitySummary`)
 */

const config = require('../../../src/config');
const { SqliteSessionStore } = require('../../../src/db/session-store');
const { FORBIDDEN_CLIENT_FIELDS, securityHeaders } = require('../../../src/middleware/security');
const { initSceneCatalogTables } = require('../../scene-catalog');
const {
  getRangerSelectableFamilies,
  getFamilyMetadata,
  normalizeRangerFavoredEnemy,
  applyMonsterTaxonomyToDatabase
} = require('../../../src/domain/monsters/taxonomy');

const REQUIRED_LEGACY_TABLES = [
  'users',
  'map_tiles',
  'monsters',
  'characters',
  'item_definitions',
  'item_instances',
  'encounters',
  'combat_events',
  'monster_instances',
  'market_listings',
  'hunting_contracts',
  'terrain_artworks',
  'user_sessions',
  'action_idempotency_log',
  'character_monster_knowledge'
];

/**
 * Canonical 14 initial Ranger Favored Enemy family options (Phase 7A.4 / 7B).
 * Includes TERRESTRIAL_MAGICAL_BEASTS -> "Other Magical Beasts".
 * Excludes UNDEAD (forbidden), FEY & AMPHIBIAN_HUMANOIDS (reserved), etc.
 */
const FAVORED_ENEMY_OPTIONS = getRangerSelectableFamilies().map((fam) => ({
  value: fam.key,
  key: fam.key,
  label: fam.label,
  type: fam.key,
  subtype: null,
  description: fam.description
}));

/**
 * Applies non-destructive Adventure Lab schema extensions onto any Darkgrid SQLite database
 * without altering existing player, item, encounter, or monster records.
 */
function ensureNonDestructiveLabAdapter(db) {
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
  if (!cols.includes('attribute_points')) {
    db.exec('ALTER TABLE characters ADD COLUMN attribute_points INTEGER NOT NULL DEFAULT 0;');
  }
  if (!cols.includes('initial_attributes_json')) {
    db.exec('ALTER TABLE characters ADD COLUMN initial_attributes_json TEXT DEFAULT NULL;');
  }
  if (!cols.includes('favored_enemy_family')) {
    db.exec('ALTER TABLE characters ADD COLUMN favored_enemy_family TEXT DEFAULT NULL;');
  }
  if (!cols.includes('divine_charges')) {
    db.exec('ALTER TABLE characters ADD COLUMN divine_charges INTEGER DEFAULT NULL;');
  }
  if (!cols.includes('quest_goblin_chieftain_status')) {
    db.exec("ALTER TABLE characters ADD COLUMN quest_goblin_chieftain_status TEXT NOT NULL DEFAULT 'NOT_ACCEPTED';");
  }
  if (!cols.includes('goblin_chieftain_slain')) {
    db.exec('ALTER TABLE characters ADD COLUMN goblin_chieftain_slain INTEGER NOT NULL DEFAULT 0;');
  }
  db.exec(`
    UPDATE characters
    SET divine_charges = CASE
      WHEN UPPER(class) = 'CLERIC' AND is_alive = 1 THEN
        MAX(1, 6 + COALESCE(level, 1) + CASE
          WHEN COALESCE(wisdom, 10) >= 10 THEN (COALESCE(wisdom, 10) - 10) / 2
          ELSE -((11 - COALESCE(wisdom, 10)) / 2)
        END)
      ELSE 0
    END
    WHERE divine_charges IS NULL;
  `);

  const monsterCols = db.prepare('PRAGMA table_info(monsters)').all().map(c => c.name);
  if (monsterCols.length > 0 && !monsterCols.includes('monster_family')) {
    db.exec('ALTER TABLE monsters ADD COLUMN monster_family TEXT DEFAULT NULL;');
  }

  const encCols = db.prepare('PRAGMA table_info(encounters)').all().map(c => c.name);
  if (encCols.length > 0 && !encCols.includes('second_wind_used')) {
    db.exec('ALTER TABLE encounters ADD COLUMN second_wind_used INTEGER NOT NULL DEFAULT 0;');
  }

  const tileCols = db.prepare('PRAGMA table_info(map_tiles)').all().map(c => c.name);
  if (tileCols.length > 0) {
    if (!tileCols.includes('region_key')) {
      db.exec("ALTER TABLE map_tiles ADD COLUMN region_key TEXT NOT NULL DEFAULT 'GOBLIN_FOREST';");
    }
    if (!tileCols.includes('biome')) {
      db.exec("ALTER TABLE map_tiles ADD COLUMN biome TEXT NOT NULL DEFAULT 'FOREST';");
    }
    if (!tileCols.includes('visual_type')) {
      db.exec('ALTER TABLE map_tiles ADD COLUMN visual_type TEXT DEFAULT NULL;');
    }
    if (!tileCols.includes('visual_kind')) {
      db.exec('ALTER TABLE map_tiles ADD COLUMN visual_kind TEXT DEFAULT NULL;');
    }
    if (!tileCols.includes('path_connections')) {
      db.exec("ALTER TABLE map_tiles ADD COLUMN path_connections TEXT NOT NULL DEFAULT '[]';");
    }
    if (!tileCols.includes('is_landmark')) {
      db.exec('ALTER TABLE map_tiles ADD COLUMN is_landmark INTEGER NOT NULL DEFAULT 0;');
    }
    if (!tileCols.includes('landmark_key')) {
      db.exec('ALTER TABLE map_tiles ADD COLUMN landmark_key TEXT DEFAULT NULL;');
    }
    if (!tileCols.includes('encounter_profile_key')) {
      db.exec("ALTER TABLE map_tiles ADD COLUMN encounter_profile_key TEXT DEFAULT 'GOBLIN_FOREST';");
    }
    if (!tileCols.includes('boss_key')) {
      db.exec('ALTER TABLE map_tiles ADD COLUMN boss_key TEXT DEFAULT NULL;');
    }
  }

  // Ensure session, idempotency, and monster knowledge tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      sid TEXT PRIMARY KEY,
      user_id INTEGER,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS action_idempotency_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      idempotency_key TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200,
      redirect_url TEXT,
      response_body TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, idempotency_key)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS character_monster_knowledge (
      character_id INTEGER NOT NULL,
      monster_id INTEGER NOT NULL,
      encountered_count INTEGER NOT NULL DEFAULT 0,
      victory_count INTEGER NOT NULL DEFAULT 0,
      first_encountered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_victory_at TEXT DEFAULT NULL,
      PRIMARY KEY (character_id, monster_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE
    );
  `);

  // Ensure sold market_listings references do not block item_instances deletion on permadeath 50% destruction roll
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_cleanup_market_listings_before_item_delete
    BEFORE DELETE ON item_instances
    BEGIN
      DELETE FROM market_listings WHERE item_instance_id = OLD.id;
    END;
  `);

  if (monsterCols.length > 0) {
    const unclassified = db.prepare('SELECT COUNT(*) as cnt FROM monsters WHERE monster_family IS NULL').get();
    if (unclassified && Number(unclassified.cnt) > 0) {
      try {
        applyMonsterTaxonomyToDatabase(db);
      } catch {
        // Ignore if monsters table is mid-seed
      }
    }
  }

  initSceneCatalogTables(db);
}

/**
 * Determines whether the server is running in production mode.
 */
function isProductionMode(options = {}) {
  const env = options.nodeEnv || process.env.NODE_ENV || config.nodeEnv || 'development';
  return Boolean(options.production === true || env === 'production');
}

/**
 * Determines whether authentication is mandatory (no anonymous sandbox fallback).
 */
function isAuthRequired(options = {}) {
  return Boolean(options.requireAuth === true || isProductionMode(options));
}

/**
 * Resolves the effective userId for the current request:
 *   1. Authenticated user in `req.session.userId` (if present and valid in `users` table)
 *   2. Explicit logged-out marker (`req.session.loggedOut === true` or `isAuthRequired(options)`) -> null
 *   3. Default sandbox user (`defaultUserId`) in non-production sandbox mode so automated lab tests work seamlessly
 */
function resolveRequestUserId(req, db, defaultUserId, options = {}) {
  const prod = isProductionMode(options);
  const authReq = isAuthRequired(options);

  if (req && req.session && req.session.userId) {
    const uid = Number(req.session.userId);
    const exists = db.prepare('SELECT id, username FROM users WHERE id = ?').get(uid);
    if (exists) {
      if ((prod || authReq) && exists.username === 'action_hero' && !options.allowSandboxUserInAuthMode) {
        return null;
      }
      return Number(exists.id);
    }
  }
  if (req && req.session && req.session.loggedOut === true) {
    return null;
  }
  if (authReq) {
    return null;
  }
  return defaultUserId || null;
}

/**
 * Retrieves sanitized public user metadata for a userId.
 */
function getPublicUserById(db, userId) {
  if (!userId) return null;
  const row = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(Number(userId));
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    createdAt: row.created_at || null,
    isSandboxDefault: row.username === 'action_hero'
  };
}

/**
 * Determines whether Lab scenario/debug tools (`LAB_SCENARIO`, `TELEPORT_TO_TILE`, `REVIVE`,
 * `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, `SET_ART_PREVIEW_MODE`, `testForceEncounter`)
 * are permitted for the current user and environment.
 * Fails closed (`false`) in production, in `requireAuth` mode, and for all normal player accounts.
 */
function isLabToolsAllowedForUser(db, userId, options = {}, req = null) {
  if (options && options.allowLabTools === false) return false;
  if (isProductionMode(options)) {
    return Boolean(options && options.allowLabToolsInProduction === true && req && req.session && req.session.isAdmin === true);
  }
  if (options && options.allowLabTools === true) return true;
  if (isAuthRequired(options)) {
    return Boolean(req && req.session && req.session.isAdmin === true);
  }
  if (!userId) return false;
  const user = getPublicUserById(db, userId);
  if (!user) return false;
  if (req && req.session && req.session.isAdmin === true) return true;
  return Boolean(user.isSandboxDefault);
}

const EXTRA_FORBIDDEN_CLIENT_FIELDS = new Set([
  'startingGold',
  'starting_gold',
  'isAdmin',
  'is_admin'
]);

/**
 * JSON-aware Anti-Tamper Middleware for the Action Viewport API.
 * Inspects `req.body`, `req.body.payload`, and `req.query` for any `FORBIDDEN_CLIENT_FIELDS`.
 */
function labAntiTamperMiddleware(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const bodyObj = (req.body && typeof req.body === 'object') ? req.body : {};
  const payloadObj = (bodyObj.payload && typeof bodyObj.payload === 'object') ? bodyObj.payload : {};
  const createCharObj = (payloadObj.createCharacter && typeof payloadObj.createCharacter === 'object') ? payloadObj.createCharacter : {};
  const queryObj = (req.query && typeof req.query === 'object') ? req.query : {};

  const candidateKeys = new Set([
    ...Object.keys(bodyObj),
    ...Object.keys(payloadObj),
    ...Object.keys(createCharObj),
    ...Object.keys(queryObj)
  ]);

  const tamperedFields = [];
  for (const key of candidateKeys) {
    if (FORBIDDEN_CLIENT_FIELDS.has(key) || EXTRA_FORBIDDEN_CLIENT_FIELDS.has(key)) {
      tamperedFields.push(key);
    }
  }

  if (tamperedFields.length > 0) {
    const message = `Security violation: Client-supplied game state or identity parameters (${tamperedFields.join(', ')}) are strictly forbidden.`;
    return res.status(400).json({
      ok: false,
      error: message,
      tamperedFields
    });
  }

  next();
}

const inFlightLabActions = new Set();

/**
 * JSON-aware Action Idempotency Middleware for POST /api/action and /api/character/create.
 * Prevents duplicate execution when `X-Idempotency-Key` or `_actionId` / `idempotencyKey` is supplied.
 */
function createLabIdempotencyMiddleware({ db, defaultUserId, options = {} }) {
  return function labIdempotencyMiddleware(req, res, next) {
    if (req.method !== 'POST') {
      return next();
    }

    const rawKey =
      req.headers['x-idempotency-key'] ||
      (req.body && (req.body._actionId || req.body.idempotencyKey)) ||
      (req.body && req.body.payload && (req.body.payload._actionId || req.body.payload.idempotencyKey)) ||
      null;

    if (!rawKey || typeof rawKey !== 'string') {
      return next();
    }

    const idempotencyKey = rawKey.trim().slice(0, 128);
    if (!idempotencyKey) {
      return next();
    }

    const userId = resolveRequestUserId(req, db, defaultUserId, options) || 0;
    const lockKey = `${userId}:${idempotencyKey}`;

    if (inFlightLabActions.has(lockKey)) {
      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(409).json({
        ok: false,
        idempotentReplay: true,
        error: 'Action already in flight.'
      });
    }

    const existing = db.prepare(`
      SELECT status_code, response_body
      FROM action_idempotency_log
      WHERE user_id = ? AND idempotency_key = ?
    `).get(userId, idempotencyKey);

    if (existing && existing.response_body) {
      res.setHeader('X-Idempotent-Replay', 'true');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(existing.status_code || 200).send(existing.response_body);
    }

    inFlightLabActions.add(lockKey);

    const originalJson = res.json.bind(res);
    res.json = function (bodyPayload) {
      try {
        const serialized = JSON.stringify(bodyPayload);
        db.prepare(`
          INSERT OR IGNORE INTO action_idempotency_log (
            user_id, idempotency_key, method, path, status_code, response_body, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          userId,
          idempotencyKey,
          req.method,
          req.originalUrl || req.url,
          res.statusCode || 200,
          serialized
        );
      } catch {
        // Ignore logging error on read-only or closed DB
      } finally {
        inFlightLabActions.delete(lockKey);
      }
      return originalJson(bodyPayload);
    };

    res.on('finish', () => inFlightLabActions.delete(lockKey));
    res.on('close', () => inFlightLabActions.delete(lockKey));

    next();
  };
}

/**
 * Audits database schema, referential integrity, and legacy feature parity.
 */
function verifyLegacyDatabaseCompatibility(db) {
  const existingTables = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name)
  );
  const missingTables = REQUIRED_LEGACY_TABLES.filter(t => !existingTables.has(t));

  const charCols = new Set(
    db.prepare('PRAGMA table_info(characters)').all().map(c => c.name)
  );
  const requiredCharCols = [
    'id', 'user_id', 'name', 'class', 'is_alive', 'level', 'xp', 'gold',
    'strength', 'constitution', 'dexterity', 'intelligence', 'wisdom', 'charisma',
    'current_hp', 'max_hp', 'tile_id', 'favored_enemy_type', 'favored_enemy_subtype',
    'favored_enemy_family', 'attribute_points', 'initial_attributes_json',
    'cleric_heal_uses', 'divine_charges', 'primary_weapon', 'killed_by_monster_instance_id', 'died_at',
    'facing', 'pending_victory_encounter_id', 'scene_mode'
  ];
  const missingCharCols = requiredCharCols.filter(c => !charCols.has(c));

  const counts = {
    users: (db.prepare('SELECT COUNT(*) as cnt FROM users').get() || {}).cnt || 0,
    characters: (db.prepare('SELECT COUNT(*) as cnt FROM characters').get() || {}).cnt || 0,
    livingCharacters: (db.prepare('SELECT COUNT(*) as cnt FROM characters WHERE is_alive = 1').get() || {}).cnt || 0,
    fallenCharacters: (db.prepare('SELECT COUNT(*) as cnt FROM characters WHERE is_alive = 0').get() || {}).cnt || 0,
    mapTiles: (db.prepare('SELECT COUNT(*) as cnt FROM map_tiles').get() || {}).cnt || 0,
    monsters: (db.prepare('SELECT COUNT(*) as cnt FROM monsters').get() || {}).cnt || 0,
    itemDefinitions: (db.prepare('SELECT COUNT(*) as cnt FROM item_definitions').get() || {}).cnt || 0,
    itemInstances: (db.prepare('SELECT COUNT(*) as cnt FROM item_instances').get() || {}).cnt || 0,
    activePersistentMonsters: (db.prepare("SELECT COUNT(*) as cnt FROM monster_instances WHERE status = 'ACTIVE'").get() || {}).cnt || 0,
    resaleListings: (db.prepare('SELECT COUNT(*) as cnt FROM market_listings').get() || {}).cnt || 0,
    huntingContracts: (db.prepare('SELECT COUNT(*) as cnt FROM hunting_contracts').get() || {}).cnt || 0
  };

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();

  return {
    compatible: missingTables.length === 0 && missingCharCols.length === 0 && fkViolations.length === 0,
    missingTables,
    missingCharacterColumns: missingCharCols,
    foreignKeyViolations: fkViolations.length,
    counts,
    classesSupported: Object.keys(config.classBases),
    statRules: config.statRules
  };
}

/**
 * Builds structured class ability progression details for the Champion Sheet UI.
 * Uses English descriptive prose without leaking hidden numeric combat formulas.
 */
function buildClassAbilitySummary(hero, clericHealInfo = null, combatOptions = {}) {
  if (!hero) return [];
  const cls = String(hero.class || 'FIGHTER').toUpperCase();
  const lvl = Number(hero.level || 1);

  if (cls === 'FIGHTER') {
    const wtActive = lvl >= 5;
    const atActive = lvl >= 3;
    const swAvailable = lvl >= 3;
    const swUsed = Boolean(combatOptions && combatOptions.secondWindUsed);
    const swStatus = !swAvailable
      ? 'Unlocks at Level 3'
      : (swUsed ? 'Spent' : 'Ready');

    return [
      {
        name: 'Know Your Enemy (Martial Lore)',
        active: true,
        currentTier: lvl >= 6
          ? 'Veteran Tactical Insight against humanoid and giant-kin foes'
          : 'Seasoned Tactical Insight against humanoid foes',
        detail: 'Instinctively reads the combat stance, weaponry, and openings of humanoid opponents.'
      },
      {
        name: 'Battle-Hardened',
        active: true,
        currentTier: lvl >= 5
          ? 'Veteran Conditioning (Bolstered vitality, physical grit, and iron will)'
          : 'Hardened Conditioning (Bolstered vitality and physical grit)',
        detail: 'Relentless frontline conditioning hardens the body and spirit against mortal blows and afflictions.'
      },
      {
        name: 'Second Wind',
        active: swAvailable && !swUsed,
        statusBadge: swStatus,
        currentTier: !swAvailable
          ? 'Unlocks at Level 3 (Automatic once-per-battle survival surge)'
          : `Second Wind: ${swStatus}${lvl >= 10 ? ' (Includes physical status cleanse)' : ''}`,
        detail: 'Automatically triggers once per combat when gravely wounded (at or below a quarter vitality), surging back from the brink.'
      },
      {
        name: 'Master of All Arms (Weapon Training)',
        active: wtActive,
        currentTier: lvl >= 9
          ? 'Grandmaster of Arms (Melee & Ranged)'
          : (wtActive ? 'Seasoned Weapon Discipline (Melee & Ranged)' : 'Foundational Martial Proficiency (Deepens at Levels 5 and 9)'),
        detail: 'Full proficiency with all martial melee and ranged armaments, heavy plate, and tower shields.'
      },
      {
        name: 'Bulwark of Iron (Armor Training)',
        active: atActive,
        currentTier: lvl >= 7
          ? 'Mastered Plate Mobility'
          : (atActive ? 'Trained Armor Mobility' : 'Standard Armor Poise (Deepens at Levels 3 and 7)'),
        detail: 'Reduces armor stiffness, allowing greater agility and defensive poise in medium and heavy mail.'
      }
    ];
  }

  if (cls === 'RANGER') {
    const normalizedFamily = normalizeRangerFavoredEnemy(
      hero.favored_enemy_family || hero.favored_enemy_type,
      hero.favored_enemy_subtype
    );
    const famMeta = normalizedFamily ? getFamilyMetadata(normalizedFamily) : null;
    const feLabel = famMeta
      ? famMeta.label
      : (hero.favored_enemy_type
        ? `${hero.favored_enemy_type}${hero.favored_enemy_subtype ? ` (${hero.favored_enemy_subtype})` : ''}`
        : 'None selected');

    return [
      {
        name: 'Sworn Blood-Quarry (Favored Enemy)',
        active: Boolean(feLabel && feLabel !== 'None selected'),
        currentTier: `Sworn Quarry: ${feLabel}${lvl >= 9 ? ' (Includes evasive guard)' : ''}`,
        detail: 'Honed precision and lethal focus when hunting your chosen monster family. Deepens at Levels 4, 8, and 9.'
      },
      {
        name: 'Natural Knowledge (Wilderness Lore)',
        active: true,
        currentTier: lvl >= 7
          ? 'Master Naturalist Lore across beasts, flora, vermin, and magical fauna'
          : 'Keen Wilderness Lore across natural creatures, flora, and predators',
        detail: 'Recognizes the habits, anatomy, and territorial signs of natural creatures without expending a turn.'
      },
      {
        name: 'Ambush from the Shadows (Opening Shot)',
        active: true,
        currentTier: 'Free ranged opening volley when engaging spotted foes with a bow or crossbow',
        detail: 'Looses an opening shot before melee closes whenever you spot the quarry first and wield a ranged weapon.'
      },
      {
        name: 'Eyes in the Mist (Wilderness Awareness)',
        active: true,
        currentTier: lvl >= 6
          ? 'Master Tracker & Ambush Evasion'
          : 'Heightened Trail Senses & Ambush Evasion',
        detail: 'Reads subtle tracks and disturbances in the wilds, spotting lurking threats before they can spring an ambush.'
      }
    ];
  }

  if (cls === 'CLERIC') {
    const healText = clericHealInfo
      ? `Sacred prayer outside of combat (${clericHealInfo.remainingUses}/${clericHealInfo.maxUses} uses remaining)`
      : 'Sacred prayer outside of combat (2 uses per sanctuary rest)';
    const divineChargesCurrent = combatOptions && typeof combatOptions.divineCharges === 'number'
      ? combatOptions.divineCharges
      : Number(hero.divine_charges ?? 0);
    const divineChargesMax = combatOptions && typeof combatOptions.maxDivineCharges === 'number'
      ? combatOptions.maxDivineCharges
      : Math.max(1, 6 + lvl + Math.floor(((Number(hero.wisdom || 10)) - 10) / 2));
    return [
      {
        name: 'Divine Charges (Holy Combat Techniques)',
        active: divineChargesCurrent > 0,
        statusBadge: `${divineChargesCurrent}/${divineChargesMax} Charges`,
        currentTier: `Divine Charges: ${divineChargesCurrent}/${divineChargesMax} remaining (Recharges on City Rest)`,
        detail: 'Sacred combat reservoir fueling Battle Prayer (1), Smite (1), and Divine Shield (2). Recharges only upon resting in a city sanctuary.'
      },
      {
        name: 'Sacred Knowledge (Ecclesiastic Lore)',
        active: true,
        currentTier: lvl >= 6
          ? 'Sanctified Mastery of Undead rites, weaknesses, and curses'
          : 'Consecrated Lore of Undead abominations and restless spirits',
        detail: 'Reveals the nature and unholy perils of Undead creatures and bolsters resistance against their afflictions.'
      },
      {
        name: 'Turn Undead',
        active: true,
        currentTier: 'Sanctified invocation at battle start against Undead foes',
        detail: 'Channels holy authority when engaging Undead, staggering, searing, or shattering lesser revenants.'
      },
      {
        name: 'Bane of the Restless Dead (Holy Radiance)',
        active: true,
        currentTier: lvl >= 9
          ? 'Radiant Judgment against Undead'
          : (lvl >= 5 ? 'Resplendent Ward & Strike against Undead' : 'Consecrated Ward & Strike against Undead'),
        detail: 'Sacred aura blazes automatically when fighting Undead abominations, guiding strikes and warding off blows.'
      },
      {
        name: 'Sacred Restoration (Divine Self-Heal)',
        active: true,
        currentTier: healText,
        detail: 'Channel prayer outside of combat [4 / F] to mend wounds. Recharges upon resting in Oakhaven Sanctuary.'
      }
    ];
  }

  return [];
}

module.exports = {
  REQUIRED_LEGACY_TABLES,
  FAVORED_ENEMY_OPTIONS,
  SqliteSessionStore,
  securityHeaders,
  isProductionMode,
  isAuthRequired,
  isLabToolsAllowedForUser,
  ensureNonDestructiveLabAdapter,
  resolveRequestUserId,
  getPublicUserById,
  labAntiTamperMiddleware,
  createLabIdempotencyMiddleware,
  verifyLegacyDatabaseCompatibility,
  buildClassAbilitySummary
};
