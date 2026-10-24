/**
 * DARKGRID ADVENTURE LAB — Encounter Engagement & Combat Round Controller
 */
const {
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
  recordEncounterOutcome
} = require('../../adventure-engine');
const {
  buildCombatSequence,
  getLastEventId,
  captureCombatBeforeSnapshot
} = require('../services/combat-sequence-service');
const { buildClientState } = require('../services/client-state-service');
const {
  HIGHLAND_BOSS_PROFILE,
  startStrongholdBossEncounter,
  startHighlandBossEncounter,
  startLandmarkDungeonEncounter,
  markHighlandBossSlain,
  markAncientCryptBossSlain,
  syncCharacterQuestState,
  syncAllCharacterQuests
} = require('../services/topdown-world-service');
const {
  DUNGEON_BOSS_PROFILES,
  startDungeonBossEncounter,
  markDungeonEventResolved
} = require('../services/dungeon-service');

function resolvePostVictoryHooks(db, characterId, encounterId) {
  if (!db || !characterId || !encounterId) return;
  try {
    const encRow = db.prepare('SELECT monster_instance_id, combat_state_json FROM encounters WHERE id = ?').get(encounterId);
    if (encRow) {
      if (encRow.combat_state_json) {
        let meta = {};
        try {
          meta = JSON.parse(encRow.combat_state_json) || {};
        } catch {
          meta = {};
        }
        const goldBoost = Math.max(0, Number(meta.goldBoost || 0));
        if (goldBoost > 0 && !meta.goldBoostAwarded) {
          db.prepare('UPDATE characters SET gold = gold + ? WHERE id = ?').run(goldBoost, characterId);
          meta.goldBoostAwarded = true;
          db.prepare('UPDATE encounters SET combat_state_json = ? WHERE id = ?').run(JSON.stringify(meta), encounterId);
        }
        if (meta.isDungeonBoss && meta.dungeonKey && meta.dungeonBossKey) {
          markDungeonEventResolved(db, characterId, meta.dungeonKey, meta.dungeonBossKey, 'BOSS');
          if (meta.dungeonKey === 'ANCIENT_CRYPT') {
            markAncientCryptBossSlain(db, characterId);
          }
        }
        if (meta.dungeonEventKey && meta.dungeonKey) {
          markDungeonEventResolved(db, characterId, meta.dungeonKey, meta.dungeonEventKey, 'FIXED_ENCOUNTER');
        }
      }
      if (encRow.monster_instance_id) {
        const inst = db.prepare('SELECT custom_title FROM monster_instances WHERE id = ?').get(encRow.monster_instance_id);
        if (inst && inst.custom_title === HIGHLAND_BOSS_PROFILE.customTitle) {
          markHighlandBossSlain(db, characterId);
        }
        if (inst && inst.custom_title === DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.customTitle) {
          markDungeonEventResolved(
            db,
            characterId,
            'GOBLIN_CAVE',
            DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.bossKey,
            'BOSS',
            DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.x,
            DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.y
          );
        }
        if (inst && inst.custom_title === DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.customTitle) {
          markDungeonEventResolved(
            db,
            characterId,
            'ANCIENT_CRYPT',
            DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.bossKey,
            'BOSS',
            DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.x,
            DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.y
          );
          markAncientCryptBossSlain(db, characterId);
        }
      }
    }
  } catch {
    // Non-fatal
  }
  syncCharacterQuestState(db, characterId);
  syncAllCharacterQuests(db, characterId);
}

function handleCombatAction({ db, userId, options, action, payload, character, labToolsAllowed = false, res }) {
  // 1a. DUNGEON BOSS ENGAGEMENT (Inside Goblin Cave [16, 2] or Ancient Crypt [10, 2])
  if (action === 'ENGAGE_DUNGEON_BOSS' || action === 'CHALLENGE_DUNGEON_BOSS') {
    const currentTile = getTileById(db, character.tile_id);
    const bossResult = startDungeonBossEncounter(db, character, options);
    const enc = bossResult.encounter;
    const beforeSnap = captureCombatBeforeSnapshot(db, character, enc);
    const bossTitle = (bossResult.bossDef && bossResult.bossDef.customTitle) || 'Dungeon Boss';
    const isOpeningVictory =
      (enc && enc.status === 'VICTORY') ||
      Boolean(bossResult.investigateResult && (bossResult.investigateResult.status === 'VICTORY' || bossResult.investigateResult.monsterDied));

    if (isOpeningVictory) {
      db.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(bossResult.encounterId, character.id);
      resolvePostVictoryHooks(db, character.id, bossResult.encounterId);
      const victoryData = getVictoryData(db, character.id, bossResult.encounterId);
      recordEncounterOutcome(character.id, currentTile, bossTitle, 'VICTORY');
      const nextState = buildClientState(db, userId, {
        labToolsAllowed,
        victory: victoryData,
        fxCue: { type: 'VICTORY', openingShotKill: true }
      });
      nextState.combatSequence = buildCombatSequence(db, bossResult.encounterId, 0, beforeSnap, nextState);
      return res.json({ ok: true, state: nextState });
    }

    const advState = getOrCreateAdventureState(character.id, currentTile);
    recordEncounterStart(advState, currentTile, {
      status: 'IN_COMBAT',
      monsterName: bossTitle
    });
    const nextState = buildClientState(db, userId, {
      labToolsAllowed,
      infoMessage: `${bossTitle} rises within the inner sanctum to challenge you!`,
      fxCue: { type: 'REVEAL_MONSTER', isBoss: true }
    });
    nextState.combatSequence = buildCombatSequence(db, bossResult.encounterId, 0, beforeSnap, nextState);
    return res.json({ ok: true, state: nextState });
  }

  // 1a-ii. RAVENCRAG HIGHLANDS BOSS: CONFRONT WARLORD KRAUG AT [37, 3]
  if (action === 'CONFRONT_HIGHLAND_WARLORD' || action === 'ENGAGE_HIGHLAND_BOSS' || action === 'CHALLENGE_HIGHLAND_BOSS') {
    const currentTile = getTileById(db, character.tile_id);
    const bossResult = startHighlandBossEncounter(db, character, options);
    const enc = bossResult.encounter;
    const beforeSnap = captureCombatBeforeSnapshot(db, character, enc);
    const isOpeningVictory =
      (enc && enc.status === 'VICTORY') ||
      Boolean(bossResult.investigateResult && (bossResult.investigateResult.status === 'VICTORY' || bossResult.investigateResult.monsterDied));

    if (isOpeningVictory) {
      db.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(bossResult.encounterId, character.id);
      resolvePostVictoryHooks(db, character.id, bossResult.encounterId);
      const victoryData = getVictoryData(db, character.id, bossResult.encounterId);
      recordEncounterOutcome(character.id, currentTile, HIGHLAND_BOSS_PROFILE.customTitle, 'VICTORY');
      const nextState = buildClientState(db, userId, {
        labToolsAllowed,
        victory: victoryData,
        fxCue: { type: 'VICTORY', openingShotKill: true }
      });
      nextState.combatSequence = buildCombatSequence(db, bossResult.encounterId, 0, beforeSnap, nextState);
      return res.json({ ok: true, state: nextState });
    }

    const advState = getOrCreateAdventureState(character.id, currentTile);
    recordEncounterStart(advState, currentTile, {
      status: 'IN_COMBAT',
      monsterName: HIGHLAND_BOSS_PROFILE.customTitle
    });
    const nextState = buildClientState(db, userId, {
      labToolsAllowed,
      infoMessage: 'The iron-bound gates of Ravencrag Citadel groan open! Warlord Kraug the Crag-Breaker strides into the storm!',
      fxCue: { type: 'REVEAL_MONSTER', isBoss: true }
    });
    nextState.combatSequence = buildCombatSequence(db, bossResult.encounterId, 0, beforeSnap, nextState);
    return res.json({ ok: true, state: nextState });
  }

  // 1b. STRONGHOLD BOSS: ENGAGE THE GOBLIN CHIEFTAIN AT [15, 2]
  if (action === 'ENGAGE_STRONGHOLD_BOSS' || action === 'CHALLENGE_STRONGHOLD_BOSS') {
    const currentTile = getTileById(db, character.tile_id);
    const bossResult = startStrongholdBossEncounter(db, character, options);
    const enc = bossResult.encounter;
    const beforeSnap = captureCombatBeforeSnapshot(db, character, enc);
    const isOpeningVictory =
      (enc && enc.status === 'VICTORY') ||
      Boolean(bossResult.investigateResult && (bossResult.investigateResult.status === 'VICTORY' || bossResult.investigateResult.monsterDied));

    if (isOpeningVictory) {
      db.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(bossResult.encounterId, character.id);
      resolvePostVictoryHooks(db, character.id, bossResult.encounterId);
      const victoryData = getVictoryData(db, character.id, bossResult.encounterId);
      recordEncounterOutcome(character.id, currentTile, 'Warchief Grak the Goblin Chieftain', 'VICTORY');
      const nextState = buildClientState(db, userId, {
        labToolsAllowed,
        victory: victoryData,
        fxCue: { type: 'VICTORY', openingShotKill: true }
      });
      nextState.combatSequence = buildCombatSequence(db, bossResult.encounterId, 0, beforeSnap, nextState);
      return res.json({ ok: true, state: nextState });
    }

    const advState = getOrCreateAdventureState(character.id, currentTile);
    recordEncounterStart(advState, currentTile, {
      status: 'IN_COMBAT',
      monsterName: 'Warchief Grak the Goblin Chieftain'
    });
    const nextState = buildClientState(db, userId, {
      labToolsAllowed,
      infoMessage: 'The timber gates of Goblin Stronghold burst open! Warchief Grak charges forth with a notched iron cleaver!',
      fxCue: { type: 'REVEAL_MONSTER', isBoss: true }
    });
    nextState.combatSequence = buildCombatSequence(db, bossResult.encounterId, 0, beforeSnap, nextState);
    return res.json({ ok: true, state: nextState });
  }
  // 2. ENCOUNTER: INVESTIGATE / ENGAGE (Enter Stage 2 Combat)
  if (action === 'INVESTIGATE' || action === 'ENGAGE' || action === 'FIGHT') {
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
      resolvePostVictoryHooks(db, character.id, activeEnc.id);
      const victoryData = getVictoryData(db, character.id, activeEnc.id);
      recordEncounterOutcome(
        character.id,
        currentTile,
        beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
        'VICTORY'
      );
      const nextState = buildClientState(db, userId, {
        labToolsAllowed,
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
      labToolsAllowed,
      fxCue: { type: 'REVEAL_MONSTER' }
    });
    nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
    return res.json({ ok: true, state: nextState });
  }

  // 3. ENCOUNTER: IGNORE / BYPASS IN PLACE
  if (action === 'IGNORE' || action === 'BYPASS' || action === 'AVOID') {
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
        labToolsAllowed,
        infoMessage: 'You slipped past the threat in the shadows undetected.',
        fxCue: { type: 'BYPASS' }
      })
    });
  }

  // 4. COMBAT: ATTACK / BATTLE_PRAYER / SMITE / DIVINE_SHIELD
  if (action === 'ATTACK' || action === 'BATTLE_PRAYER' || action === 'SMITE' || action === 'DIVINE_SHIELD') {
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

    const resultState = executeCombatRound(db, character.id, activeEnc.id, action, roundOpts);
    const hpLost = Math.max(0, prevHp - (resultState.character ? resultState.character.current_hp : prevHp));
    const hpDelta = (resultState.character ? resultState.character.current_hp : prevHp) - prevHp;

    if (resultState.character && resultState.character.is_alive === 0) {
      // Ensure pre-seeded Stronghold Boss receives +10% Nemesis max_hp boost on first hero kill
      const encRow = db.prepare('SELECT monster_instance_id FROM encounters WHERE id = ?').get(activeEnc.id);
      if (encRow && encRow.monster_instance_id) {
        const inst = db.prepare('SELECT id, kill_count, max_hp FROM monster_instances WHERE id = ? AND status = \'ACTIVE\'').get(encRow.monster_instance_id);
        if (inst && inst.kill_count === 1 && inst.max_hp <= 14) {
          const boostedHp = Math.ceil(inst.max_hp * 1.10);
          db.prepare('UPDATE monster_instances SET max_hp = ?, current_hp = ? WHERE id = ?').run(boostedHp, boostedHp, inst.id);
        }
      }
      recordEncounterOutcome(
        character.id,
        currentTile,
        beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
        'DEFEAT'
      );
      const nextState = buildClientState(db, userId, { labToolsAllowed, fxCue: { type: 'HERO_DEATH', hpLost } });
      nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
      return res.json({ ok: true, state: nextState });
    }

    if (resultState.encounter && resultState.encounter.status === 'VICTORY') {
      db.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(activeEnc.id, character.id);
      resolvePostVictoryHooks(db, character.id, activeEnc.id);
      const victoryData = getVictoryData(db, character.id, activeEnc.id);
      recordEncounterOutcome(
        character.id,
        currentTile,
        beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
        'VICTORY'
      );
      const nextState = buildClientState(db, userId, {
        labToolsAllowed,
        victory: victoryData,
        fxCue: { type: 'VICTORY', hpLost, hpDelta, divineAction: action !== 'ATTACK' ? action : null }
      });
      nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
      return res.json({ ok: true, state: nextState });
    }

    const fxType = action === 'ATTACK' ? 'ATTACK_EXCHANGE' : action;
    const nextState = buildClientState(db, userId, {
      labToolsAllowed,
      fxCue: { type: fxType, hpLost, hpDelta }
    });
    nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
    return res.json({ ok: true, staleRoundIgnored: nextState.combatSequence === null, state: nextState });
  }

  // 5. COMBAT OR EXPLORATION: DRINK POTION
  if (action === 'POTION') {
    const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
    const allPotions = getCharacterPotions(db, character.id);
    const combatPotions = getCharacterPotions(db, character.id, { combatOnly: true });

    if (payload.potionInstanceId !== undefined && payload.potionInstanceId !== null) {
      const reqPid = Number(payload.potionInstanceId);
      if (!allPotions.some(p => Number(p.id) === reqPid)) {
        const err = new Error('Item not found in character inventory.');
        err.status = 403;
        throw err;
      }
    }

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
      const currentTile = getTileById(db, character.tile_id);

      const expectedRound = payload.expectedRound !== undefined
        ? Number(payload.expectedRound)
        : (activeEnc.combat_round || 1);
      const roundRng = options.rng || (labToolsAllowed && character.current_hp >= character.max_hp ? () => Math.min(0.90, Math.random()) : undefined);

      const resultState = executeCombatRound(db, character.id, activeEnc.id, 'DRINK_POTION', {
        expectedRound,
        potionInstanceId: chosenPotionId,
        rng: roundRng
      });

      if (resultState.character && resultState.character.is_alive === 0) {
        const hpLost = Math.max(0, prevHp);
        recordEncounterOutcome(
          character.id,
          currentTile,
          beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
          'DEFEAT'
        );
        const nextState = buildClientState(db, userId, { labToolsAllowed, fxCue: { type: 'HERO_DEATH', hpLost } });
        nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
        return res.json({ ok: true, state: nextState });
      }

      const hpDelta = (resultState.character ? resultState.character.current_hp : prevHp) - prevHp;
      const nextState = buildClientState(db, userId, {
        labToolsAllowed,
        fxCue: { type: 'POTION_COMBAT', hpDelta }
      });
      nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
      return res.json({ ok: true, staleRoundIgnored: nextState.combatSequence === null, state: nextState });
    } else {
      if (activeEnc && activeEnc.status === 'DISCOVERED') {
        throw new Error('Engage or bypass the threat before drinking a potion.');
      }
      const resUse = useConsumable(db, character.id, chosenPotionId);
      return res.json({
        ok: true,
        state: buildClientState(db, userId, {
          labToolsAllowed,
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

    const expectedRound = payload.expectedRound !== undefined
      ? Number(payload.expectedRound)
      : (activeEnc.combat_round || 1);
    const roundRng = options.rng || (labToolsAllowed && character.current_hp >= character.max_hp ? () => Math.min(0.90, Math.random()) : undefined);

    const resultState = executeCombatRound(db, character.id, activeEnc.id, 'FLEE', {
      expectedRound,
      rng: roundRng
    });
    const hpLost = Math.max(0, prevHp - (resultState.character ? resultState.character.current_hp : prevHp));

    // If expectedRound was stale, the encounter remains IN_COMBAT with no new combat events
    if (resultState.encounter && resultState.encounter.status === 'IN_COMBAT') {
      const nextState = buildClientState(db, userId, { labToolsAllowed });
      nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
      return res.json({ ok: true, staleRoundIgnored: true, state: nextState });
    }

    recordEncounterOutcome(
      character.id,
      currentTile,
      beforeSnap.monsterInfo ? beforeSnap.monsterInfo.monsterName : 'Hostile Creature',
      resultState.character && resultState.character.is_alive === 0 ? 'DEFEAT' : 'FLED'
    );

    const nextState = buildClientState(db, userId, {
      labToolsAllowed,
      infoMessage: resultState.character && resultState.character.is_alive === 0
        ? null
        : 'You broke away from the creature under its parting strike and escaped!',
      fxCue: { type: resultState.character && resultState.character.is_alive === 0 ? 'HERO_DEATH' : 'FLEE', hpLost }
    });
    nextState.combatSequence = buildCombatSequence(db, activeEnc.id, lastEventIdBefore, beforeSnap, nextState);
    return res.json({ ok: true, staleRoundIgnored: false, state: nextState });
  }

  return false;
}

module.exports = {
  handleCombatAction
};
