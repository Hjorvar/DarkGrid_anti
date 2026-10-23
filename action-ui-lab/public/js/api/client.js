/**
 * DARKGRID ADVENTURE LAB — API Communication & Action Dispatchers (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';

function renderGameState(state, options) {
  return uiCallbacks.renderGameState(state, options);
}
function renderModalContent(modalName) {
  return uiCallbacks.renderModalContent(modalName);
}
function closeLabModal() {
  return uiCallbacks.closeLabModal();
}
function cancelActiveCombatSequence() {
  return uiCallbacks.cancelActiveCombatSequence();
}
function clearTransientFloatingPopups() {
  return uiCallbacks.clearTransientFloatingPopups();
}
function renderTopBarAndDeckSnapshot(state, opts) {
  return uiCallbacks.renderTopBarAndDeckSnapshot(state, opts);
}
function renderViewportCenterStage(state) {
  return uiCallbacks.renderViewportCenterStage(state);
}
function renderAdventureOverlays(state) {
  return uiCallbacks.renderAdventureOverlays(state);
}

function getClientArtPreviewQuerySuffix() {
  if (typeof window === 'undefined' || !window.location || !window.location.search) return '';
  const params = new URLSearchParams(window.location.search);
  const ap = params.get('artPreview');
  const uca = params.get('useCandidateArt');
  if (ap !== null) return `?artPreview=${encodeURIComponent(ap)}`;
  if (uca !== null) return `?useCandidateArt=${encodeURIComponent(uca)}`;
  return '';
}

export async function fetchInitialState() {
  cancelActiveCombatSequence();
  try {
    const suffix = getClientArtPreviewQuerySuffix();
    if (suffix.includes("candidates") || suffix.includes("=1")) {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_ART_PREVIEW_MODE', payload: { enabled: true } })
      }).catch(() => {});
    }
    const res = await fetch(`/api/state${suffix}`);
    const data = await res.json();
    if (data && data.state) {
      renderGameState(data.state, { skipSequence: true });
    }
  } catch (err) {
    console.error('Failed to load initial state:', err);
  }
}

export async function dispatchAction(action, payload = {}) {
  if (store.isBusy && store.activeActionPromise && (action === 'LAB_SCENARIO' || action === 'TELEPORT_TO_TILE' || action === 'RESET_EXPEDITION' || action === 'START_EXPEDITION')) {
    try { await store.activeActionPromise; } catch {}
  }
  if (store.isBusy) return;

  // If a combat beat animation is still playing and the player acts again,
  // snap the previous state to completion cleanly before sending the next request
  if (store.isSequencePlaying) {
    cancelActiveCombatSequence();
    if (store.currentState) {
      renderGameState(store.currentState, { skipSequence: true });
    }
  }

  store.isBusy = true;

  if (action !== 'FLEE') {
    store.fleeConfirmArmed = false;
  }

  // Attach expectedRound on combat actions to prevent accidental double-submits
  if ((action === 'ATTACK' || action === 'POTION' || action === 'FLEE') &&
      store.currentState && store.currentState.encounter && store.currentState.encounter.status === 'IN_COMBAT') {
    payload = {
      ...payload,
      expectedRound: store.currentState.encounter.combat_round
    };
  }

  const runPromise = (async () => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      const data = await res.json();
      if (data && data.state) {
        renderGameState(data.state);
        const backdrop = document.getElementById('lab-modal-backdrop');
        if (backdrop && !backdrop.hidden && store.currentOpenModal) {
          renderModalContent(store.currentOpenModal);
        }
      }
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      store.isBusy = false;
      if (store.activeActionPromise === runPromise) {
        store.activeActionPromise = null;
      }
    }
  })();
  store.activeActionPromise = runPromise;
  return runPromise;
}

export function dispatchTurn(turn) {
  if (!store.currentState || store.currentState.mode === 'FALLEN') return Promise.resolve();
  store.isPoiPlaqueOpen = false;
  if (turn && typeof turn === 'object') {
    const dir = turn.facing || turn.turn || turn.direction || 'RIGHT';
    return dispatchAction('TURN', { turn: dir, facing: turn.facing });
  }
  return dispatchAction('TURN', { turn });
}

export function dispatchRelativeMove(relative) {
  if (!store.currentState || store.currentState.mode === 'FALLEN') return Promise.resolve();
  store.isPoiPlaqueOpen = false;
  const relMoves = (store.currentState.viewportScene && store.currentState.viewportScene.relativeMoves) || {};
  const mInfo = relMoves[relative];
  const direction = mInfo && mInfo.cardinal ? mInfo.cardinal : undefined;
  return dispatchAction('MOVE', { relative, direction });
}

let lastMoveDispatchedAt = 0;
const MIN_MOVE_DISPATCH_INTERVAL_MS = 95;

export function dispatchMove(direction) {
  if (!store.currentState || store.currentState.mode === 'FALLEN') return Promise.resolve();
  if (store.isBusy) return Promise.resolve();
  const enc = store.currentState.encounter;
  if (enc && (enc.status === 'IN_COMBAT' || enc.isAmbush)) return Promise.resolve();
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastMoveDispatchedAt < MIN_MOVE_DISPATCH_INTERVAL_MS) return Promise.resolve();
  lastMoveDispatchedAt = now;
  store.isPoiPlaqueOpen = false;
  return dispatchAction('MOVE', { direction });
}

export function triggerLabScenario(scenario, monsterName = null) {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  store.isPoiPlaqueOpen = false;
  store.expandedDiscoveryKey = null;
  if (monsterName && typeof monsterName === 'object') {
    const opts = monsterName;
    return dispatchAction('LAB_SCENARIO', {
      scenario,
      monsterName: opts.monsterName || null,
      preserveFacing: opts.preserveFacing !== undefined ? Boolean(opts.preserveFacing) : true
    });
  }
  return dispatchAction('LAB_SCENARIO', {
    scenario,
    monsterName,
    preserveFacing: Boolean(monsterName)
  });
}

export function triggerTeleport(x, y, facing = 'NORTH') {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  store.isPoiPlaqueOpen = false;
  store.expandedDiscoveryKey = null;
  return dispatchAction('TELEPORT_TO_TILE', { x, y, facing });
}

export function triggerInspectPoi() {
  if (!store.currentState || !store.currentState.viewportScene || !store.currentState.viewportScene.pointOfInterest) {
    return Promise.resolve();
  }
  if (store.isPoiPlaqueOpen) {
    store.isPoiPlaqueOpen = false;
    renderTopBarAndDeckSnapshot(store.currentState);
    renderViewportCenterStage(store.currentState);
    return Promise.resolve();
  }
  store.isPoiPlaqueOpen = true;
  return dispatchAction('INSPECT_POI');
}

export function closePoiPlaque() {
  store.isPoiPlaqueOpen = false;
  if (store.currentState) {
    renderTopBarAndDeckSnapshot(store.currentState);
    renderViewportCenterStage(store.currentState);
  }
}

export function triggerClassSwitch(classType) {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  store.isPoiPlaqueOpen = false;
  store.expandedDiscoveryKey = null;
  return dispatchAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType });
}

export function switchHeroClass(classType) {
  return triggerClassSwitch(classType);
}

export function triggerSpawnMonster(monsterKey) {
  return triggerLabScenario('COMBAT', monsterKey);
}

/* =========================================================================
   2B. ADVENTURE EXPERIENCE — EXPERIMENTAL DISPATCHERS (Phases 3, 5, 6, 8, 9)
   ========================================================================= */
export function setAdventureExperienceMode(enabled) {
  store.expandedDiscoveryKey = null;
  return dispatchAction('SET_ADVENTURE_MODE', { enabled: Boolean(enabled) });
}

export function startExpeditionRoute(expeditionKey = 'MIRKWOOD_EXPEDITION') {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  store.isPoiPlaqueOpen = false;
  store.expandedDiscoveryKey = null;
  return dispatchAction('START_EXPEDITION', { expeditionKey });
}

export function resetExpeditionRoute() {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  store.isPoiPlaqueOpen = false;
  store.expandedDiscoveryKey = null;
  const expKey = (store.currentState && store.currentState.adventure && store.currentState.adventure.expeditionKey) || 'MIRKWOOD_EXPEDITION';
  return dispatchAction('RESET_EXPEDITION', { expeditionKey: expKey });
}

export function expandDiscoveryCard(discoveryKey) {
  store.expandedDiscoveryKey = discoveryKey || (store.currentState && store.currentState.adventure && store.currentState.adventure.activeDiscovery && store.currentState.adventure.activeDiscovery.id) || true;
  if (store.currentState) {
    renderAdventureOverlays(store.currentState);
  }
}

export function resolveDiscoveryChoiceClick(discoveryKey, choiceKey) {
  store.expandedDiscoveryKey = null;
  return dispatchAction('RESOLVE_DISCOVERY_CHOICE', { discoveryKey, discoveryId: discoveryKey, choiceKey, choiceId: choiceKey });
}

export function dismissActiveDiscovery() {
  store.expandedDiscoveryKey = null;
  return dispatchAction('DISMISS_DISCOVERY');
}

export function forceTriggerDiscovery(discoveryId = null) {
  closeLabModal();
  store.expandedDiscoveryKey = null;
  return dispatchAction('FORCE_DISCOVERY', { discoveryId, discoveryKey: discoveryId });
}

export function setDeterministicSeed(seed) {
  return dispatchAction('SET_DETERMINISTIC_SEED', { seed: Number(seed || 4201) });
}

export function setArtPreviewMode(enabled) {
  return dispatchAction('SET_ART_PREVIEW_MODE', { enabled: Boolean(enabled), useCandidateArt: Boolean(enabled) });
}
