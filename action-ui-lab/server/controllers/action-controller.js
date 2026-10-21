/**
 * DARKGRID ADVENTURE LAB — Unified Action Controller Orchestrator (POST /api/action)
 * Delegates incoming actions to focused domain controllers:
 *   - navigation-controller.js         : SET_SCENE_MODE, TURN, DISMISS_VICTORY, MOVE, INSPECT_POI, TELEPORT_TO_TILE
 *   - combat-controller.js             : INVESTIGATE/ENGAGE, IGNORE/BYPASS, ATTACK, POTION, FLEE
 *   - character-town-controller.js     : STANCE, REST, CLERIC_HEAL, EQUIP, UNEQUIP, BUY, SELL, ACCEPT_BOUNTY, ABANDON_BOUNTY
 *   - adventure-scenario-controller.js : SET_ADVENTURE_MODE, START/RESET_EXPEDITION, DISCOVERY actions, LAB_SCENARIO
 */
const { getLivingCharacterByUserId } = require('../../../src/domain/character/rules');
const { normalizeFacing } = require('../services/facing-service');
const { ensureLivingHero } = require('../services/sandbox-db-service');
const { buildClientState } = require('../services/client-state-service');
const { handleNavigationAction } = require('./navigation-controller');
const { handleCombatAction } = require('./combat-controller');
const { handleCharacterTownAction } = require('./character-town-controller');
const { handleAdventureScenarioAction } = require('./adventure-scenario-controller');

function createActionController({ db, userId, options = {} }) {
  return function postAction(req, res) {
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

      const ctx = { db, userId, options, action, payload, character, currentFacing, res };

      if (handleNavigationAction(ctx) !== false) return;
      if (handleCombatAction(ctx) !== false) return;
      if (handleCharacterTownAction(ctx) !== false) return;
      if (handleAdventureScenarioAction(ctx) !== false) return;

      throw new Error(`Unknown action: ${action}`);
    } catch (err) {
      return res.json({
        ok: false,
        state: buildClientState(db, userId, { errorMessage: err.message })
      });
    }
  };
}

module.exports = {
  createActionController
};
