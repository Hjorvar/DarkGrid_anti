/**
 * DARKGRID ADVENTURE LAB — Multi-Beat Combat Choreographer (~380ms Cadence) (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';
import { escapeHtml, getConditionColor } from '../ui/utils.js';
import {
  triggerWeaponStrikeEffect,
  triggerMonsterDodgeEffect,
  triggerMonsterLungeEffect,
  triggerMonsterDefeatEffect,
  spawnFloatingPopup,
  flashViewportOverlay
} from './fx.js';
import { buildCombatMonsterActorHtml } from './combat-ui.js';
import { updateHeroVitalsDisplay } from '../character/character-ui.js';

function renderGameState(state, options) {
  return uiCallbacks.renderGameState(state, options);
}

export function cancelActiveCombatSequence() {
  if (store.activeSequenceTimers.length > 0) {
    store.activeSequenceTimers.forEach(t => clearTimeout(t));
    store.activeSequenceTimers = [];
  }
  store.isSequencePlaying = false;
}

const BEAT_INTERVAL_MS = 380;

export function playCombatSequence(state) {
  const seq = state.combatSequence;
  if (!seq || !Array.isArray(seq.beats) || seq.beats.length === 0) {
    return false;
  }

  cancelActiveCombatSequence();
  store.isSequencePlaying = true;

  // Render initial pre-sequence frame so the monster remains on stage even if the final state is VICTORY
  renderCombatStagingFrame(state, seq);

  const beats = seq.beats;
  const displayedLogs = [];

  beats.forEach((beat, idx) => {
    const timer = setTimeout(() => {
      executeCombatBeatVisual(state, seq, beat, displayedLogs);
    }, idx * BEAT_INTERVAL_MS);
    store.activeSequenceTimers.push(timer);
  });

  // After all beats have played, settle into the authoritative server state
  const finalTimer = setTimeout(() => {
    store.isSequencePlaying = false;
    store.activeSequenceTimers = [];
    renderGameState(state, { skipSequence: true });
  }, beats.length * BEAT_INTERVAL_MS + 140);

  store.activeSequenceTimers.push(finalTimer);
  return true;
}

export function renderCombatStagingFrame(state, seq) {
  const stage = document.getElementById('fp-center-stage');
  const vp = document.getElementById('fp-viewport');
  if (!stage || !vp) return;

  vp.classList.add('in-combat', 'scene-state-combat');
  vp.classList.remove('in-discovered', 'scene-state-exploration', 'scene-state-discovered', 'scene-state-victory');

  const monster = (state.encounter && state.encounter.status === 'IN_COMBAT')
    ? state.encounter
    : (seq.monsterSnapshot || {});

  const firstBeat = seq.beats[0] || {};
  const initBracket = firstBeat.conditionBracketAfterBeat || monster.conditionBracket || '5_uninjured';
  const initCondText = firstBeat.conditionTextAfterBeat || monster.conditionText || '';

  stage.innerHTML = buildCombatMonsterActorHtml(monster, state, {
    isSequenceFrame: true,
    initBracket,
    initCondText
  });
}

export function executeCombatBeatVisual(state, seq, beat, displayedLogs) {
  // 1. Update Chronicle Log progressively with this beat
  const linesEl = document.getElementById('fp-chronicle-lines');
  const titleEl = document.getElementById('fp-chronicle-title');
  if (titleEl) {
    titleEl.textContent = `⚔️ Battle Record — Round ${seq.roundNumber || 1}`;
  }

  const iconByType = {
    OPENING_SHOT: '🏹',
    HERO_ATTACK: '⚔️',
    MONSTER_ATTACK: '🩸',
    MONSTER_ABILITY: '⚡',
    STATUS_EFFECT: '☠️',
    POTION_USED: '🧪',
    FLEE: '🏃',
    ROUND_OUTCOME: '🏆'
  };
  const ic = iconByType[beat.eventType] || '•';
  displayedLogs.push(`<div class="fp-log-line ${(beat.eventType || '').toLowerCase()}">${ic} ${escapeHtml(beat.publicText)}</div>`);
  if (linesEl) {
    linesEl.innerHTML = displayedLogs.join('');
    linesEl.scrollTop = linesEl.scrollHeight;
  }

  // 2. Update Hero Vitality Bar to match this beat's post-event HP
  if (typeof beat.heroHpAfterBeat === 'number') {
    const maxHp = (state.character && state.character.max_hp) || seq.heroMaxHp || (state.fallen && state.fallen.max_hp) || 12;
    updateHeroVitalsDisplay(beat.heroHpAfterBeat, maxHp);
  }

  // 3. Update Monster Condition Quote if changed
  if (beat.conditionTextAfterBeat) {
    const gemEl = document.getElementById('seq-condition-gem');
    const txtEl = document.getElementById('seq-condition-text');
    const badgeEl = document.getElementById('seq-condition-badge');
    const cColor = getConditionColor(beat.conditionBracketAfterBeat);
    if (gemEl) {
      gemEl.style.background = cColor;
      gemEl.style.color = cColor;
    }
    if (txtEl) {
      txtEl.textContent = `“${beat.conditionTextAfterBeat}”`;
    }
    if (badgeEl && beat.conditionBracketAfterBeat) {
      const bracketLabelMap = {
        '5_uninjured': 'Uninjured',
        '6_barely_wounded': 'Barely Wounded',
        '7_wounded': 'Wounded',
        '8_badly_wounded': 'Badly Wounded',
        '9_near_death': 'Near Death',
        '4_bruised': 'Bruised',
        '3_wounded': 'Bloodied',
        '2_critical': 'Grievously Wounded',
        '1_near_death': 'Near Death'
      };
      badgeEl.style.color = cColor;
      badgeEl.style.borderColor = `${cColor}55`;
      badgeEl.textContent = `● ${bracketLabelMap[beat.conditionBracketAfterBeat] || 'Wounded'}`;
    }
  }

  // 4. Trigger Actor Choreography, Exchange Banner & Floating Callout
  const exchEl = document.getElementById('seq-exchange-banner');
  if (beat.actor === 'HERO') {
    if (beat.outcome === 'CRIT' || beat.outcome === 'HIT') {
      triggerWeaponStrikeEffect(beat.outcome === 'CRIT');
      spawnFloatingPopup(beat.popupLabel || 'Hit!', beat.outcome === 'CRIT' ? 'pop-crit' : 'pop-strike');
      if (exchEl) {
        exchEl.className = `fp-combat-exchange-banner ${beat.outcome === 'CRIT' ? 'exchange-crit' : 'exchange-hit'}`;
        exchEl.textContent = beat.outcome === 'CRIT'
          ? `💥 Critical Hit (${beat.popupLabel || 'Crit!'})`
          : `⚔️ You struck (${beat.popupLabel || 'Hit!'})`;
      }
    } else if (beat.outcome === 'MISS') {
      const svg = document.getElementById('fp-slash-svg');
      if (svg) {
        svg.classList.remove('is-striking');
        void svg.offsetWidth;
        svg.classList.add('is-striking');
      }
      triggerMonsterDodgeEffect();
      spawnFloatingPopup('Miss', 'pop-miss');
      if (exchEl) {
        exchEl.className = 'fp-combat-exchange-banner exchange-miss';
        exchEl.textContent = '💨 Your attack missed — enemy evaded!';
      }
    } else if (beat.outcome === 'HEAL') {
      flashViewportOverlay('heal');
      spawnFloatingPopup(beat.popupLabel || '+HP', 'pop-heal');
      if (exchEl) {
        exchEl.className = 'fp-combat-exchange-banner exchange-hit';
        exchEl.textContent = `🧪 Potion consumed (${beat.popupLabel || '+HP'})`;
      }
    } else if (beat.outcome === 'FLEE') {
      spawnFloatingPopup('🏃 Retreating...', 'pop-miss');
      if (exchEl) {
        exchEl.className = 'fp-combat-exchange-banner exchange-miss';
        exchEl.textContent = '🏃 Attempting to break away from melee...';
      }
    }
  } else if (beat.actor === 'MONSTER') {
    triggerMonsterLungeEffect();
    if (beat.outcome === 'HIT') {
      flashViewportOverlay('blood');
      spawnFloatingPopup(beat.popupLabel || `-${beat.hpDelta} HP`, 'pop-damage');
      if (exchEl) {
        exchEl.className = 'fp-combat-exchange-banner exchange-damage';
        exchEl.textContent = `${exchEl.textContent ? exchEl.textContent + ' • ' : ''}🩸 Enemy struck for ${beat.hpDelta || 0} dmg`;
      }
    } else if (beat.outcome === 'MISS') {
      spawnFloatingPopup('Miss', 'pop-miss');
      if (exchEl) {
        exchEl.textContent = `${exchEl.textContent ? exchEl.textContent + ' • ' : ''}🛡️ Evaded enemy counterattack`;
      }
    } else {
      if (beat.hpDelta > 0) flashViewportOverlay('blood');
      spawnFloatingPopup(beat.popupLabel || '⚡ Status', 'pop-damage');
    }
  } else if (beat.actor === 'OUTCOME') {
    if (beat.outcome === 'VICTORY') {
      triggerMonsterDefeatEffect();
      spawnFloatingPopup('🏆 VICTORY!', 'pop-crit');
      if (exchEl) {
        exchEl.className = 'fp-combat-exchange-banner exchange-crit';
        exchEl.textContent = '🏆 Foe slain — victory achieved!';
      }
    } else if (beat.outcome === 'DEFEAT') {
      flashViewportOverlay('blood');
      spawnFloatingPopup('💀 FALLEN', 'pop-damage');
    } else if (beat.outcome === 'ESCAPED') {
      spawnFloatingPopup('🏃 Escaped!', 'pop-miss');
    }
  }
}
