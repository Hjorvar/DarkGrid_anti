/**
 * DARKGRID ADVENTURE LAB — Combat & Movement Visual FX Engine (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';
import { isReducedMotionPreferred } from '../ui/utils.js';

function renderTopBarAndDeckSnapshot(state, opts) {
  return uiCallbacks.renderTopBarAndDeckSnapshot(state, opts);
}
function renderViewportCenterStage(state) {
  return uiCallbacks.renderViewportCenterStage(state);
}

export function triggerWeaponStrikeEffect(isCrit = false) {
  const svg = document.getElementById('fp-slash-svg');
  const actor = document.getElementById('fp-monster-actor');
  if (svg) {
    svg.classList.remove('is-striking', 'is-crit-striking');
    void svg.offsetWidth;
    svg.classList.add('is-striking');
    if (isCrit) svg.classList.add('is-crit-striking');
  }
  if (actor) {
    actor.classList.remove('anim-monster-hit', 'anim-monster-crit-hit', 'anim-monster-dodge', 'anim-monster-defeat');
    void actor.offsetWidth;
    actor.classList.add(isCrit ? 'anim-monster-crit-hit' : 'anim-monster-hit');
  }
}

export function triggerMonsterDodgeEffect() {
  const actor = document.getElementById('fp-monster-actor');
  if (actor) {
    actor.classList.remove('anim-monster-hit', 'anim-monster-crit-hit', 'anim-monster-dodge', 'anim-monster-defeat');
    void actor.offsetWidth;
    actor.classList.add('anim-monster-dodge');
  }
}

export function triggerMonsterLungeEffect() {
  const actor = document.getElementById('fp-monster-actor');
  if (actor) {
    actor.classList.remove('anim-monster-lunge');
    void actor.offsetWidth;
    actor.classList.add('anim-monster-lunge');
  }
}

export function triggerMonsterDefeatEffect() {
  const actor = document.getElementById('fp-monster-actor');
  if (actor) {
    actor.classList.remove('anim-monster-hit', 'anim-monster-crit-hit', 'anim-monster-dodge', 'anim-monster-lunge');
    void actor.offsetWidth;
    actor.classList.add('anim-monster-defeat');
  }
}

export function clearTransientFloatingPopups() {
  const container = document.getElementById('fp-floating-pop-container');
  if (!container) return;
  container.innerHTML = '';
}

export function spawnFloatingPopup(text, styleClass = 'pop-strike') {
  const container = document.getElementById('fp-floating-pop-container');
  if (!container) return;
  const normText = String(text || '').trim();
  if (!normText) return;

  // Phase 2.2 Fix: Deduplicate identical active popups in-place so the same message
  // (e.g. "🔍 Landmark Inspected") never renders twice on screen simultaneously.
  const existingChildren = Array.from(container.querySelectorAll('.floating-pop'));
  const duplicateEl = existingChildren.find(child => child.dataset.popText === normText);
  if (duplicateEl) {
    if (duplicateEl.__removeTimer) {
      clearTimeout(duplicateEl.__removeTimer);
    }
    duplicateEl.className = `floating-pop ${styleClass}`;
    duplicateEl.__removeTimer = setTimeout(() => {
      if (duplicateEl.parentNode) duplicateEl.parentNode.removeChild(duplicateEl);
    }, 1150);
    return;
  }

  // Offset concurrent distinct popups vertically so legitimate distinct events never overlap
  const stackIndex = Math.min(3, existingChildren.length);
  const el = document.createElement('div');
  el.className = `floating-pop ${styleClass}`;
  el.dataset.popText = normText;
  el.style.setProperty('--pop-stack-offset', `${stackIndex * 34}px`);
  el.textContent = normText;
  container.appendChild(el);

  el.__removeTimer = setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 1150);
}

export function flashViewportOverlay(type) {
  const flash = document.getElementById('fp-fx-flash');
  const vp = document.getElementById('fp-viewport');
  if (!flash || !vp) return;

  flash.className = 'fp-fx-flash';
  if (type === 'blood') {
    flash.classList.add('flash-blood');
    vp.classList.remove('shake-damage');
    void vp.offsetWidth;
    vp.classList.add('shake-damage');
  } else if (type === 'heal') {
    flash.classList.add('flash-heal');
  }

  setTimeout(() => {
    flash.className = 'fp-fx-flash';
  }, 420);
}

export function playViewportMotionClass(animClass, extraClass = null) {
  if (isReducedMotionPreferred()) return;
  const backdrop = document.getElementById('fp-scene-backdrop');
  if (!backdrop) return;
  if (store.backdropMotionTimer) {
    clearTimeout(store.backdropMotionTimer);
    store.backdropMotionTimer = null;
  }
  const motionClasses = [
    'step-anim',
    'anim-step-forward',
    'anim-step-backward',
    'anim-strafe-left',
    'anim-strafe-right',
    'anim-turn-left',
    'anim-turn-right',
    'anim-blocked-bump',
    'anim-landmark-arrival'
  ];
  backdrop.classList.remove(...motionClasses);
  void backdrop.offsetWidth;
  backdrop.classList.add(animClass);
  if (extraClass) {
    backdrop.classList.add(extraClass);
  }
  const cleanupMs = extraClass === 'anim-landmark-arrival' ? 440 : 240;
  store.backdropMotionTimer = setTimeout(() => {
    backdrop.classList.remove(...motionClasses);
    store.backdropMotionTimer = null;
  }, cleanupMs);
}

export function handleFxCue(fxCue) {
  if (!fxCue) return;

  if (fxCue.type === 'TURN') {
    playViewportMotionClass(fxCue.turn === 'LEFT' ? 'anim-turn-left' : 'anim-turn-right');
  } else if (fxCue.type === 'STEP' || fxCue.type === 'ENCOUNTER_DISCOVERED') {
    store.expandedDiscoveryKey = null;
    const rel = fxCue.relativeMove || 'FORWARD';
    const animMap = {
      FORWARD: 'anim-step-forward',
      BACKWARD: 'anim-step-backward',
      STRAFE_LEFT: 'anim-strafe-left',
      STRAFE_RIGHT: 'anim-strafe-right'
    };
    const isLandmarkArrival = Boolean(
      store.currentState &&
      ((store.currentState.adventure && store.currentState.adventure.transitionContext === 'LANDMARK_APPROACH') ||
       (store.currentState.currentTile && store.currentState.currentTile.feature))
    );
    playViewportMotionClass(
      animMap[rel] || 'anim-step-forward',
      isLandmarkArrival ? 'anim-landmark-arrival' : null
    );
    if (fxCue.bypassedPrevious) {
      spawnFloatingPopup('👣 Slipped Past Threat', 'pop-miss');
    }
    if (fxCue.type === 'ENCOUNTER_DISCOVERED') {
      setTimeout(() => {
        spawnFloatingPopup(fxCue.isAmbush ? '⚠️ Ambush!' : '👁️ Presence Sensed', 'pop-damage');
      }, 120);
    }
  } else if (fxCue.type === 'BLOCKED_MOVE') {
    playViewportMotionClass('anim-blocked-bump');
    const blockedObstacle = (store.currentState && store.currentState.viewportScene && store.currentState.viewportScene.ahead1 && !store.currentState.viewportScene.ahead1.isPassable)
      ? store.currentState.viewportScene.ahead1.name
      : null;
    spawnFloatingPopup(blockedObstacle ? `⛔ Blocked: ${blockedObstacle}` : '⛔ Blocked', 'pop-miss');
  } else if (fxCue.type === 'BYPASS') {
    spawnFloatingPopup('👣 Threat Bypassed', 'pop-miss');
  } else if (fxCue.type === 'REVEAL_MONSTER') {
    spawnFloatingPopup('⚔️ Battle Joined!', 'pop-strike');
    const actor = document.getElementById('fp-monster-actor');
    if (actor) {
      actor.classList.remove('anim-monster-emerge');
      void actor.offsetWidth;
      actor.classList.add('anim-monster-emerge');
    }
  } else if (fxCue.type === 'INSPECT_POI') {
    store.isPoiPlaqueOpen = true;
    if (store.currentState) {
      renderTopBarAndDeckSnapshot(store.currentState);
      renderViewportCenterStage(store.currentState);
    }
    spawnFloatingPopup('🔍 Landmark Inspected', 'pop-heal');
  } else if (fxCue.type === 'DISCOVERY_RESOLVED') {
    spawnFloatingPopup(`🔎 ${fxCue.outcomeTitle || 'Discovery Recorded'}`, 'pop-heal');
  } else if (fxCue.type === 'TELEPORT') {
    spawnFloatingPopup('⚡ Teleported', 'pop-strike');
  } else if (fxCue.type === 'POTION_COMBAT' || fxCue.type === 'HEAL') {
    flashViewportOverlay('heal');
    if (fxCue.healed) {
      spawnFloatingPopup(`+${fxCue.healed} HP`, 'pop-heal');
    } else {
      spawnFloatingPopup('✨ Restored', 'pop-heal');
    }
  } else if (fxCue.type === 'STANCE_SWAP') {
    spawnFloatingPopup(`${fxCue.stance === 'RANGED' ? '🏹 Ranged' : '🗡️ Melee'} Stance`, 'pop-strike');
  }
}
