/**
 * DARKGRID ADVENTURE LAB — Multi-Beat Combat Sequence & Snapshot Service
 */
const {
  getHealthBracket,
  getConditionTextForBracket
} = require('../../../src/domain/combat/engine');
const { bracketNumToKey } = require('./facing-service');
const { resolveMonsterIntegratedProfile } = require('./monster-profile-service');

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
        if (currentBeat.kind === 'POTION_USED' || currentBeat.kind === 'SECOND_WIND') computedOutcome = 'HEAL';
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

    if (type === 'OPENING_SHOT' || type === 'HERO_ATTACK' || type === 'TURN_UNDEAD') {
      flushBeat();
      const isHit = type === 'TURN_UNDEAD'
        ? Boolean(details.effect && details.effect !== 'RESISTED')
        : Boolean(details.isHit);
      const isCrit = Boolean(details.isCrit);
      const paralyzedStun = Boolean(details.paralyzedStun);
      let popupText = 'Miss';
      let popupStyle = 'pop-miss';
      if (type === 'TURN_UNDEAD') {
        popupText = isHit ? '✨ Turn Undead!' : 'Unholy Resistance';
        popupStyle = isHit ? 'pop-strike' : 'pop-miss';
      } else if (paralyzedStun) {
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
    } else if (type === 'SECOND_WIND') {
      flushBeat();
      const healed = Number(details.healed ?? details.actualHealed ?? 0);
      runningHeroHp = Math.min(beforeSnap.heroMaxHp, Math.max(0, runningHeroHp) + healed);
      currentBeat = {
        actor: 'HERO',
        kind: 'SECOND_WIND',
        isHit: true,
        healed,
        popupText: healed > 0 ? `🛡️ Second Wind +${healed} HP` : '🛡️ Second Wind!',
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

module.exports = {
  buildCombatSequence,
  getLastEventId,
  captureCombatBeforeSnapshot
};
