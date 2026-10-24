/**
 * DARKGRID ADVENTURE LAB — Unified Action Controller Orchestrator (POST /api/action)
 * Delegates incoming actions to focused domain controllers:
 *   - auth-character-controller.js     : REGISTER, LOGIN, LOGOUT, CREATE_CHARACTER
 *   - navigation-controller.js         : SET_SCENE_MODE, TURN, DISMISS_VICTORY, MOVE, INSPECT_POI, TELEPORT_TO_TILE
 *   - combat-controller.js             : INVESTIGATE/ENGAGE, IGNORE/BYPASS, ATTACK, POTION/USE_CONSUMABLE, FLEE
 *   - character-town-controller.js     : STANCE, REST, CLERIC_HEAL, EQUIP, UNEQUIP, BUY, SELL, ACCEPT_BOUNTY, ABANDON_BOUNTY
 *   - adventure-scenario-controller.js : SET_ADVENTURE_MODE, START/RESET_EXPEDITION, DISCOVERY actions, LAB_SCENARIO
 */
const { getLivingCharacterByUserId } = require('../../../src/domain/character/rules');
const { registerUser, loginUser } = require('../../../src/domain/auth/service');
const { setCandidateArtPreviewMode } = require('../../scene-catalog');
const { normalizeFacing } = require('../services/facing-service');
const { ensureLivingHero } = require('../services/sandbox-db-service');
const { buildClientState } = require('../services/client-state-service');
const {
  isAuthRequired,
  isLabToolsAllowedForUser,
  resolveRequestUserId,
  getPublicUserById
} = require('../services/legacy-compatibility-service');
const {
  executeCreateCharacterForUser,
  saveSessionAsync
} = require('./auth-character-controller');
const { handleNavigationAction } = require('./navigation-controller');
const { handleCombatAction } = require('./combat-controller');
const { handleCharacterTownAction } = require('./character-town-controller');
const { handleAdventureScenarioAction } = require('./adventure-scenario-controller');

function createActionController({ db, userId: defaultUserId, options = {} }) {
  return async function postAction(req, res) {
    const rawBody = req.body || {};
    const action = rawBody.action === 'USE_CONSUMABLE' ? 'POTION' : rawBody.action;
    const payload = { ...rawBody, ...(rawBody.payload || {}) };

    let effectiveUserId = resolveRequestUserId(req, db, defaultUserId, options);
    let labToolsAllowed = isLabToolsAllowedForUser(db, effectiveUserId, options, req);

    try {
      // 0. AUTHENTICATION & CHARACTER CREATION ACTIONS
      if (action === 'REGISTER') {
        const user = await registerUser(db, payload.username, payload.password);
        if (req.session) {
          req.session.userId = user.id;
          req.session.username = user.username;
          req.session.loggedOut = false;
          await saveSessionAsync(req);
        }
        effectiveUserId = user.id;
        labToolsAllowed = isLabToolsAllowedForUser(db, effectiveUserId, options, req);
        if (payload.createCharacter && typeof payload.createCharacter === 'object') {
          executeCreateCharacterForUser(db, effectiveUserId, payload.createCharacter);
        }
        return res.json({
          ok: true,
          user: getPublicUserById(db, effectiveUserId),
          state: buildClientState(db, effectiveUserId, {
            labToolsAllowed,
            infoMessage: `Account '${user.username}' registered. Forge your champion to enter the realm.`
          })
        });
      }

      if (action === 'LOGIN') {
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
        effectiveUserId = user.id;
        labToolsAllowed = isLabToolsAllowedForUser(db, effectiveUserId, options, req);
        return res.json({
          ok: true,
          user: getPublicUserById(db, effectiveUserId),
          state: buildClientState(db, effectiveUserId, {
            labToolsAllowed,
            infoMessage: `Welcome back, ${user.username}.`
          })
        });
      }

      if (action === 'LOGOUT') {
        const allowSandboxReturn = !isAuthRequired(options) && Boolean(defaultUserId);
        const returnToSandbox = allowSandboxReturn && Boolean(payload.returnToSandbox);
        if (req.session) {
          req.session.userId = null;
          req.session.username = null;
          req.session.loggedOut = !returnToSandbox;
          await saveSessionAsync(req);
        }
        effectiveUserId = returnToSandbox ? defaultUserId : resolveRequestUserId(req, db, defaultUserId, options);
        labToolsAllowed = isLabToolsAllowedForUser(db, effectiveUserId, options, req);
        return res.json({
          ok: true,
          user: getPublicUserById(db, effectiveUserId),
          state: buildClientState(db, effectiveUserId, {
            labToolsAllowed,
            infoMessage: returnToSandbox
              ? 'Returned to default Sandbox Champion.'
              : 'Signed out of account.'
          })
        });
      }

      if (!effectiveUserId) {
        return res.status(401).json({
          ok: false,
          error: 'Authentication required.',
          state: buildClientState(db, null, {
            labToolsAllowed: false,
            errorMessage: 'Please sign in to play.'
          })
        });
      }

      if (action === 'CREATE_CHARACTER') {
        const hero = executeCreateCharacterForUser(db, effectiveUserId, payload);
        return res.json({
          ok: true,
          character: hero,
          state: buildClientState(db, effectiveUserId, {
            labToolsAllowed,
            infoMessage: `${hero.name} (${hero.class}) enters Oakhaven Sanctuary.`,
            fxCue: { type: 'HEAL' }
          })
        });
      }

      if (action === 'SET_ART_PREVIEW_MODE') {
        if (!labToolsAllowed) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Candidate art preview staging is restricted to Lab Tools mode.',
            state: buildClientState(db, effectiveUserId, {
              labToolsAllowed: false,
              errorMessage: 'Forbidden: Candidate art preview staging is restricted to Lab Tools mode.'
            })
          });
        }
        const enabled = Boolean(payload.enabled || payload.useCandidateArt);
        setCandidateArtPreviewMode(enabled, db);
        return res.json({
          ok: true,
          artPreviewMode: enabled ? 'CANDIDATES_STAGED' : 'APPROVED_DEFAULT',
          state: buildClientState(db, effectiveUserId, {
            labToolsAllowed,
            useCandidateArt: enabled,
            infoMessage: enabled
              ? 'Candidate Art Preview Mode enabled (REVIEW REQUIRED staging active).'
              : 'Approved Default Art Mode restored.'
          })
        });
      }

      if (action === 'REVIVE') {
        if (!labToolsAllowed) {
          return res.status(403).json({
            ok: false,
            error: 'Forbidden: Sandbox quick-revive is disabled for player accounts. Use the 71-point Hero Forge to create your next champion.',
            state: buildClientState(db, effectiveUserId, {
              labToolsAllowed: false,
              errorMessage: 'Sandbox quick-revive is disabled for player accounts. Use the 71-point Hero Forge to create your next champion.'
            })
          });
        }
        const heroClass = payload.classType || 'FIGHTER';
        ensureLivingHero(db, effectiveUserId, heroClass);
        return res.json({
          ok: true,
          state: buildClientState(db, effectiveUserId, {
            labToolsAllowed,
            infoMessage: 'A new champion rises in Oakhaven Sanctuary.',
            fxCue: { type: 'HEAL' }
          })
        });
      }

      if (!labToolsAllowed && ['LAB_SCENARIO', 'TELEPORT_TO_TILE', 'FORCE_DISCOVERY', 'SET_DETERMINISTIC_SEED'].includes(action)) {
        return res.status(403).json({
          ok: false,
          error: `Forbidden: ${action} is restricted to Lab Tools mode.`,
          state: buildClientState(db, effectiveUserId, {
            labToolsAllowed: false,
            errorMessage: `Forbidden: ${action} is restricted to Lab Tools mode.`
          })
        });
      }

      let character = getLivingCharacterByUserId(db, effectiveUserId);
      if (!character && labToolsAllowed && action === 'LAB_SCENARIO') {
        ensureLivingHero(db, effectiveUserId, payload.classType || 'FIGHTER');
        character = getLivingCharacterByUserId(db, effectiveUserId);
      }
      if (!character) {
        return res.json({ ok: true, state: buildClientState(db, effectiveUserId, { labToolsAllowed }) });
      }

      let charRow = {};
      try {
        charRow = db.prepare('SELECT facing, pending_victory_encounter_id, scene_mode, active_dungeon_key, dungeon_x, dungeon_y FROM characters WHERE id = ?').get(character.id) || {};
      } catch {
        charRow = db.prepare('SELECT facing, pending_victory_encounter_id, scene_mode FROM characters WHERE id = ?').get(character.id) || {};
      }
      character.active_dungeon_key = charRow.active_dungeon_key || null;
      character.dungeon_x = charRow.dungeon_x !== undefined && charRow.dungeon_x !== null ? Number(charRow.dungeon_x) : null;
      character.dungeon_y = charRow.dungeon_y !== undefined && charRow.dungeon_y !== null ? Number(charRow.dungeon_y) : null;
      const currentFacing = normalizeFacing(charRow.facing || 'NORTH');

      const ctx = { db, userId: effectiveUserId, options, action, payload, character, currentFacing, labToolsAllowed, req, res };

      if (handleNavigationAction(ctx) !== false) return;
      if (handleCombatAction(ctx) !== false) return;
      if (handleCharacterTownAction(ctx) !== false) return;
      if (handleAdventureScenarioAction(ctx) !== false) return;

      throw new Error(`Unknown action: ${action}`);
    } catch (err) {
      const httpStatus = err.status || 200;
      return res.status(httpStatus).json({
        ok: false,
        error: err.message,
        validationErrors: err.validationErrors,
        state: buildClientState(db, effectiveUserId, {
          labToolsAllowed,
          errorMessage: err.message
        })
      });
    }
  };
}

module.exports = {
  createActionController
};
