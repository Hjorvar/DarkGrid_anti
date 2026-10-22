/**
 * DARKGRID ADVENTURE LAB — Phase 6 Legacy Compatibility, Session, Security & Idempotency Service
 *
 * Bridges the original Darkgrid backend systems (`src/domain/*`, `src/db/*`, `src/middleware/*`)
 * with the Action Viewport Lab without mutating or replacing any files in `src/` or `db/`.
 *
 * Responsibilities:
 *   1. Non-destructive schema compatibility adapter for existing Darkgrid SQLite databases
 *   2. Multi-user session resolution (`SqliteSessionStore` + sandbox fallback for automated tests)
 *   3. JSON-native Anti-Tamper protection (enforcing `FORBIDDEN_CLIENT_FIELDS` on body, payload & query)
 *   4. JSON-native Action Idempotency protection (`X-Idempotency-Key` / `_actionId` via `action_idempotency_log`)
 *   5. Live database & system parity audit (`verifyLegacyDatabaseCompatibility`)
 */

const config = require('../../../src/config');
const { SqliteSessionStore } = require('../../../src/db/session-store');
const { FORBIDDEN_CLIENT_FIELDS, securityHeaders } = require('../../../src/middleware/security');
const { initSceneCatalogTables } = require('../../scene-catalog');

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
  'action_idempotency_log'
];

const FAVORED_ENEMY_OPTIONS = [
  { value: 'ANIMAL', label: 'Beast / Animal (Wolves, Bears, Boars)' },
  { value: 'MAGICAL BEAST', label: 'Magical Beast (Owlbears, Manticores, Spiders)' },
  { value: 'MONSTROUS HUMANOID', label: 'Monstrous Humanoid (Hags, Gargoyles, Harpies)' },
  { value: 'ABERRATION', label: 'Aberration (Chokers, Ettercaps, Will-o’-Wisps)' },
  { value: 'VERMIN', label: 'Vermin (Giant Scorpions, Centipedes, Wasps)' },
  { value: 'PLANT', label: 'Plant (Assassin Vines, Shambling Mounds)' },
  { value: 'GIANT', label: 'Giant / Trollkin (Trolls, Ogres, Ettins)' },
  { value: 'DRAGON', label: 'Dragonkin (Wyverns, Drakes)' },
  { value: 'OOZE', label: 'Ooze (Gelatinous Cubes, Ochre Jellies)' },
  { value: 'CONSTRUCT', label: 'Construct (Animated Armor, Gargoyle Statues)' },
  { value: 'OUTSIDER', label: 'Outsider (Fiends, Elementals, Hell Hounds)' },
  { value: 'FEY', label: 'Fey (Mites, Redcaps)' },
  { value: 'HUMANOID:goblinoid', label: 'Humanoid — Goblinoid (Goblins, Hobgoblins, Bugbears)' },
  { value: 'HUMANOID:gnoll', label: 'Humanoid — Gnoll' },
  { value: 'HUMANOID:reptilian', label: 'Humanoid — Reptilian (Kobolds, Lizardfolk, Troglodytes)' },
  { value: 'HUMANOID:boggard', label: 'Humanoid — Boggard' },
  { value: 'HUMANOID:giant', label: 'Humanoid — Giant Subtype (Ogres, Trolls)' },
  { value: 'HUMANOID:orc', label: 'Humanoid — Orc' },
  { value: 'HUMANOID:drow', label: 'Humanoid — Drow' },
  { value: 'HUMANOID:duergar', label: 'Humanoid — Duergar' }
];

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

  // Ensure session and idempotency tables exist
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

  // Ensure sold market_listings references do not block item_instances deletion on permadeath 50% destruction roll
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_cleanup_market_listings_before_item_delete
    BEFORE DELETE ON item_instances
    BEGIN
      DELETE FROM market_listings WHERE item_instance_id = OLD.id;
    END;
  `);

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
    'cleric_heal_uses', 'primary_weapon', 'killed_by_monster_instance_id', 'died_at',
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
 */
function buildClassAbilitySummary(hero, clericHealInfo = null) {
  if (!hero) return [];
  const cls = String(hero.class || 'FIGHTER').toUpperCase();
  const lvl = Number(hero.level || 1);

  if (cls === 'FIGHTER') {
    const wtAtk = lvl >= 9 ? 2 : (lvl >= 5 ? 1 : 0);
    const atDex = lvl >= 7 ? 2 : (lvl >= 3 ? 1 : 0);
    return [
      {
        name: 'Master of All Arms (Weapon Training)',
        active: wtAtk > 0,
        currentTier: wtAtk > 0 ? `+${wtAtk} Attack & +${wtAtk} Damage with all weapons` : 'Unlocks +1 Atk/Dmg at Level 5 (+2 at Level 9)',
        detail: 'Full proficiency with all martial melee and ranged armaments, heavy plate, and tower shields.'
      },
      {
        name: 'Bulwark of Iron (Armor Training)',
        active: atDex > 0,
        currentTier: atDex > 0 ? `+${atDex} Maximum DEX Bonus in Armor` : 'Unlocks +1 Max DEX in Armor at Level 3 (+2 at Level 7)',
        detail: 'Reduces armor stiffness, allowing higher Dexterity AC bonuses in medium and heavy armor.'
      },
      {
        name: 'Unyielding Lifeblood',
        active: true,
        currentTier: '10 + CON modifier HP per level',
        detail: 'Highest base vitality progression among all champion classes.'
      }
    ];
  }

  if (cls === 'RANGER') {
    const feBonus = lvl >= 9 ? 3 : (lvl >= 5 ? 2 : 1);
    const feLabel = hero.favored_enemy_type
      ? `${hero.favored_enemy_type}${hero.favored_enemy_subtype ? ` (${hero.favored_enemy_subtype})` : ''}`
      : 'None selected';
    return [
      {
        name: 'Sworn Blood-Quarry (Favored Enemy)',
        active: Boolean(hero.favored_enemy_type),
        currentTier: `+${feBonus} Attack & +${feBonus} Damage vs ${feLabel}`,
        detail: 'Scales to +2 at Level 5 and +3 at Level 9. Never applies to Undead.'
      },
      {
        name: 'Ambush from the Shadows (Opening Shot)',
        active: true,
        currentTier: 'Free ranged opening attack when engaging grounded foes with a bow/crossbow',
        detail: 'Fires automatically upon entering combat before Round 1 initiative when Ranged weapon is active.'
      },
      {
        name: 'Eyes in the Mist (Keen Senses)',
        active: true,
        currentTier: 'Enhanced wilderness tracking clues during Stage 1 encounters',
        detail: 'Reveals deeper behavioral tells of lurking creatures without breaking encounter secrecy.'
      }
    ];
  }

  if (cls === 'CLERIC') {
    const hrAtk = lvl >= 9 ? 4 : (lvl >= 5 ? 3 : 2);
    const hrDmg = lvl >= 9 ? 5 : (lvl >= 5 ? 4 : 3);
    const hrAc = lvl >= 9 ? 4 : (lvl >= 5 ? 3 : 2);
    const healText = clericHealInfo
      ? `${clericHealInfo.dice} + WIS mod (${clericHealInfo.remainingUses}/${clericHealInfo.maxUses} uses remaining)`
      : '1d6 + WIS mod (2 uses per sanctuary rest)';
    return [
      {
        name: 'Bane of the Restless Dead (Holy Radiance)',
        active: true,
        currentTier: `+${hrAtk} Attack, +${hrDmg} Damage, +${hrAc} AC vs Undead`,
        detail: 'Sacred aura blazes automatically when fighting Undead abominations. Scales at Levels 5 and 9.'
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
