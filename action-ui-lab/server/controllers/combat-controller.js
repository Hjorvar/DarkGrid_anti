/**
 * DARKGRID ADVENTURE LAB — Encounter Engagement & Combat Round Controller
 */
const {
  getLivingCharacterByUserId,
  getCharacterPotions,
  useConsumable
} = require('../../../src/domain/character/rules');
const { getTileById } = require('../../../src/domain/world/map');
const {
  getActiveEncounterForCharacter,
  ignoreEncounter,
  investigateEncounter
} = require('../../../src/domain/encounters/engine');
const { executeCombatRound } = require('../../../src/domain/combat/engine');
const { getVictoryData } = require('../../../src/domain/combat/victory');
const {
  getOrCreateAdventureState,
  recordEncounterStart,
  recordEncounterOutcome,
  evaluateExpeditionMilestones
} = require('../../adventure-engine');
const {
  buildCombatSequence,
  getLastEventId,
  captureCombatBeforeSnapshot
} = require('../services/combat-sequence-service');
const { buildClientState } = require('../services/client-state-service');

function handleCombatAction({ db, userId, options, action, payload, character, res }) {
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
        const currentTile = getTileById(db, character.tile_id);
        ignoreEncounter(db, character.id, activeEnc.id);
        if (currentTile) {
          recordEncounterOutcome(character.id, currentTile, 'Unidentified Threat', 'BYPASSED');
        }
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

  return false;
}

module.exports = {
  handleCombatAction
};
