/**
 * DARKGRID ADVENTURE LAB — Authentication, User Session & Character Creation Controller
 *
 * Connects the authoritative authentication (`src/domain/auth/service.js`)
 * and character creation/point-buy rules (`src/domain/character/rules.js`) to the
 * Adventure Lab, supporting both REST endpoints (`/api/auth/*`, `/api/character/create`,
 * `/api/character/attributes/spend`) and unified `/api/action` dispatches
 * (`REGISTER`, `LOGIN`, `LOGOUT`, `CREATE_CHARACTER`, `SPEND_ATTRIBUTE_POINT`).
 */

const config = require('../../../src/config');
const { registerUser, loginUser } = require('../../../src/domain/auth/service');
const {
  createCharacter,
  getLivingCharacterByUserId,
  spendAttributePoint
} = require('../../../src/domain/character/rules');
const { normalizeSceneMode } = require('../../scene-catalog');
const { buildClientState } = require('../services/client-state-service');
const {
  FAVORED_ENEMY_OPTIONS,
  isProductionMode,
  isAuthRequired,
  isLabToolsAllowedForUser,
  resolveRequestUserId,
  getPublicUserById,
  verifyLegacyDatabaseCompatibility
} = require('../services/legacy-compatibility-service');

function buildDefaultPointBuyStats(classType) {
  const upper = String(classType || 'FIGHTER').toUpperCase();
  const base = config.classBases[upper] || config.classBases.FIGHTER;
  return {
    strength: base.strength,
    constitution: base.constitution,
    dexterity: base.dexterity,
    intelligence: base.intelligence,
    wisdom: base.wisdom,
    charisma: base.charisma
  };
}

function executeCreateCharacterForUser(db, userId, payload = {}) {
  if (!userId) {
    const err = new Error('Authentication required to create a character.');
    err.status = 401;
    throw err;
  }

  // Canonical Darkgrid Rule: Strictly enforce one living character per account.
  // Never destroy or retire an existing living character.
  const existingLiving = getLivingCharacterByUserId(db, userId);
  if (existingLiving) {
    const err = new Error('User already has a living hero. Only one living hero is permitted.');
    err.status = 409;
    throw err;
  }

  const classType = String(payload.classType || payload.class || 'FIGHTER').toUpperCase().trim();
  const name = String(payload.name || '').trim();

  let stats = payload.stats;
  if (!stats && (payload.strength !== undefined || payload.constitution !== undefined)) {
    stats = {
      strength: Number(payload.strength),
      constitution: Number(payload.constitution),
      dexterity: Number(payload.dexterity),
      intelligence: Number(payload.intelligence),
      wisdom: Number(payload.wisdom),
      charisma: Number(payload.charisma)
    };
  }
  if (!stats && payload.useClassDefaults === true) {
    stats = buildDefaultPointBuyStats(classType);
  }

  const explicitFamily = payload.favoredEnemyFamily !== undefined
    ? payload.favoredEnemyFamily
    : payload.favored_enemy_family;
  const explicitType = payload.favoredEnemyType !== undefined
    ? payload.favoredEnemyType
    : payload.favored_enemy_type;
  const explicitSubtype = payload.favoredEnemySubtype !== undefined
    ? payload.favoredEnemySubtype
    : (payload.favored_enemy_subtype || null);

  const hasExplicitFavoredEnemy = explicitFamily !== undefined || explicitType !== undefined;
  const favoredEnemyFamily = explicitFamily !== undefined
    ? explicitFamily
    : (!hasExplicitFavoredEnemy && classType === 'RANGER' ? 'ANIMALS' : null);
  const favoredEnemyType = explicitType !== undefined
    ? explicitType
    : (favoredEnemyFamily || (classType === 'RANGER' && !hasExplicitFavoredEnemy ? 'ANIMALS' : null));

  const hero = createCharacter(db, {
    userId,
    name,
    classType,
    stats,
    startingGold: config.startingGold,
    favoredEnemyFamily,
    favoredEnemyType,
    favoredEnemySubtype: explicitSubtype,
    primaryWeapon: payload.primaryWeapon || payload.primary_weapon || (classType === 'RANGER' ? 'RANGED' : 'MELEE')
  });

  const lastChar = db.prepare('SELECT scene_mode FROM characters WHERE user_id = ? AND id != ? ORDER BY id DESC LIMIT 1').get(userId, hero.id);
  const initialSceneMode = normalizeSceneMode((lastChar && lastChar.scene_mode) || payload.sceneMode || 'C');

  db.prepare("UPDATE characters SET facing = 'NORTH', pending_victory_encounter_id = NULL, scene_mode = ? WHERE id = ?").run(
    initialSceneMode,
    hero.id
  );

  return getLivingCharacterByUserId(db, userId);
}

function saveSessionAsync(req) {
  return new Promise((resolve) => {
    if (!req || !req.session || typeof req.session.save !== 'function') {
      return resolve();
    }
    req.session.save(() => resolve());
  });
}

function createAuthAndCharacterRoutes({ db, defaultUserId, options = {} }) {
  async function postRegister(req, res) {
    try {
      const body = req.body || {};
      const payload = { ...body, ...(body.payload || {}) };
      const user = await registerUser(db, payload.username, payload.password);

      if (req.session) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.loggedOut = false;
        await saveSessionAsync(req);
      }

      // Optional inline character creation during registration if character parameters were supplied
      if (payload.createCharacter && typeof payload.createCharacter === 'object') {
        executeCreateCharacterForUser(db, user.id, payload.createCharacter);
      }

      const labToolsAllowed = isLabToolsAllowedForUser(db, user.id, options, req);
      return res.status(200).json({
        ok: true,
        user: getPublicUserById(db, user.id),
        state: buildClientState(db, user.id, {
          labToolsAllowed,
          infoMessage: `Account '${user.username}' registered. Forge your champion to enter the realm.`
        })
      });
    } catch (err) {
      const status = err.status || 400;
      const currentUid = resolveRequestUserId(req, db, defaultUserId, options);
      const labToolsAllowed = isLabToolsAllowedForUser(db, currentUid, options, req);
      return res.status(status).json({
        ok: false,
        error: err.message,
        state: buildClientState(db, currentUid, { labToolsAllowed, errorMessage: err.message })
      });
    }
  }

  async function postLogin(req, res) {
    try {
      const body = req.body || {};
      const payload = { ...body, ...(body.payload || {}) };
      const user = await loginUser(db, payload.username, payload.password, {
        firebaseVerifier: options.firebaseVerifier,
        allowFirebaseFallback: Boolean(options.allowFirebaseFallback)
      });

      if (req.session) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.loggedOut = false;
        await saveSessionAsync(req);
      }

      const labToolsAllowed = isLabToolsAllowedForUser(db, user.id, options, req);
      return res.status(200).json({
        ok: true,
        user: getPublicUserById(db, user.id),
        state: buildClientState(db, user.id, {
          labToolsAllowed,
          infoMessage: `Welcome back, ${user.username}.`
        })
      });
    } catch (err) {
      const status = err.status || 401;
      const currentUid = resolveRequestUserId(req, db, defaultUserId, options);
      const labToolsAllowed = isLabToolsAllowedForUser(db, currentUid, options, req);
      return res.status(status).json({
        ok: false,
        error: err.message,
        state: buildClientState(db, currentUid, { labToolsAllowed, errorMessage: err.message })
      });
    }
  }

  async function postLogout(req, res) {
    try {
      const allowSandboxReturn = !isAuthRequired(options) && Boolean(defaultUserId);
      const requestedSandbox = Boolean(req.body && (req.body.returnToSandbox || (req.body.payload && req.body.payload.returnToSandbox)));
      const returnToSandbox = allowSandboxReturn && requestedSandbox;
      if (req.session) {
        req.session.userId = null;
        req.session.username = null;
        req.session.loggedOut = !returnToSandbox;
        await saveSessionAsync(req);
      }
      const nextUid = returnToSandbox ? defaultUserId : resolveRequestUserId(req, db, defaultUserId, options);
      const labToolsAllowed = isLabToolsAllowedForUser(db, nextUid, options, req);
      return res.status(200).json({
        ok: true,
        user: getPublicUserById(db, nextUid),
        state: buildClientState(db, nextUid, {
          labToolsAllowed,
          infoMessage: returnToSandbox
            ? 'Returned to default Sandbox Champion.'
            : 'Signed out of account.'
        })
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  function getSession(req, res) {
    try {
      const effectiveUid = resolveRequestUserId(req, db, defaultUserId, options);
      const user = getPublicUserById(db, effectiveUid);
      const hero = effectiveUid ? getLivingCharacterByUserId(db, effectiveUid) : null;
      const labToolsAllowed = isLabToolsAllowedForUser(db, effectiveUid, options, req);
      return res.status(200).json({
        ok: true,
        authenticated: Boolean(req.session && req.session.userId),
        user,
        hasLivingCharacter: Boolean(hero),
        characterId: hero ? hero.id : null,
        labToolsAllowed,
        classBases: config.classBases,
        statRules: config.statRules,
        favoredEnemyOptions: FAVORED_ENEMY_OPTIONS
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  function postCreateCharacter(req, res) {
    const effectiveUid = resolveRequestUserId(req, db, defaultUserId, options);
    const labToolsAllowed = isLabToolsAllowedForUser(db, effectiveUid, options, req);
    try {
      const body = req.body || {};
      const payload = { ...body, ...(body.payload || {}) };
      const hero = executeCreateCharacterForUser(db, effectiveUid, payload);
      return res.status(200).json({
        ok: true,
        character: hero,
        state: buildClientState(db, effectiveUid, {
          labToolsAllowed,
          infoMessage: `${hero.name} (${hero.class}) enters Oakhaven Sanctuary.`,
          fxCue: { type: 'HEAL' }
        })
      });
    } catch (err) {
      const status = err.status || 400;
      return res.status(status).json({
        ok: false,
        error: err.message,
        validationErrors: err.validationErrors || [err.message],
        state: buildClientState(db, effectiveUid, { labToolsAllowed, errorMessage: err.message })
      });
    }
  }

  function postSpendAttributePoint(req, res) {
    const effectiveUid = resolveRequestUserId(req, db, defaultUserId, options);
    const labToolsAllowed = isLabToolsAllowedForUser(db, effectiveUid, options, req);
    try {
      if (!effectiveUid) {
        const err = new Error('Authentication required.');
        err.status = 401;
        throw err;
      }
      const hero = getLivingCharacterByUserId(db, effectiveUid);
      if (!hero) {
        const err = new Error('Living character not found.');
        err.status = 404;
        throw err;
      }
      const body = req.body || {};
      const payload = { ...body, ...(body.payload || {}) };
      const attr = payload.attribute || payload.stat || payload.attributeName;
      const result = spendAttributePoint(db, hero.id, attr);
      const label = result.attribute.charAt(0).toUpperCase() + result.attribute.slice(1);
      return res.status(200).json({
        ok: true,
        result,
        spendResult: result,
        state: buildClientState(db, effectiveUid, {
          labToolsAllowed,
          infoMessage: `Permanently increased ${label} to ${result.newBaseScore}.${result.hpGained > 0 ? ` Vitality increased by +${result.hpGained} HP.` : ''}`
        })
      });
    } catch (err) {
      const status = err.status || 400;
      return res.status(status).json({
        ok: false,
        error: err.message,
        state: buildClientState(db, effectiveUid, { labToolsAllowed, errorMessage: err.message })
      });
    }
  }

  function getLegacyAudit(req, res) {
    try {
      const effectiveUid = resolveRequestUserId(req, db, defaultUserId, options);
      if (!effectiveUid) {
        return res.status(401).json({
          ok: false,
          error: 'Authentication required to inspect system audit.'
        });
      }

      const prodOrAuth = isProductionMode(options) || isAuthRequired(options);
      const isAdmin = Boolean(req && req.session && req.session.isAdmin === true);
      const labAllowed = isLabToolsAllowedForUser(db, effectiveUid, options, req);

      if (prodOrAuth && !(options.allowLegacyAudit === true && isAdmin)) {
        return res.status(403).json({
          ok: false,
          error: 'Forbidden: Legacy database audit is restricted in production.'
        });
      }

      if (!prodOrAuth && !labAllowed && !isAdmin && options.allowLegacyAudit !== true) {
        return res.status(403).json({
          ok: false,
          error: 'Forbidden: Legacy database audit is restricted to administrators and lab tools.'
        });
      }

      const report = verifyLegacyDatabaseCompatibility(db);
      return res.status(200).json({
        ok: true,
        ...report
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return {
    postRegister,
    postLogin,
    postLogout,
    getSession,
    postCreateCharacter,
    postSpendAttributePoint,
    getLegacyAudit
  };
}

module.exports = {
  buildDefaultPointBuyStats,
  executeCreateCharacterForUser,
  saveSessionAsync,
  createAuthAndCharacterRoutes
};
