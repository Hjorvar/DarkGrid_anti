/**
 * DARKGRID ADVENTURE LAB — Progressive Disclosure Header & Mode-Reactive UI (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';

function renderViewportCenterStage(state) {
  return uiCallbacks.renderViewportCenterStage(state);
}

export function toggleDevToolsDrawer(forceCollapsed = null) {
  if (typeof forceCollapsed === 'boolean') {
    store.devToolsCollapsed = forceCollapsed;
  } else {
    store.devToolsCollapsed = !store.devToolsCollapsed;
  }
  const body = document.body;
  const shell = document.getElementById('dm-shell');
  if (body) {
    body.classList.toggle('dev-mode-collapsed', store.devToolsCollapsed);
    body.classList.toggle('dev-mode-visible', !store.devToolsCollapsed);
  }
  if (shell) {
    shell.classList.toggle('dev-mode-collapsed', store.devToolsCollapsed);
    shell.classList.toggle('dev-mode-visible', !store.devToolsCollapsed);
  }
  const btn = document.getElementById('btn-toggle-devtools');
  if (btn) {
    btn.setAttribute('aria-expanded', String(!store.devToolsCollapsed));
    btn.classList.toggle('is-active', !store.devToolsCollapsed);
    const lbl = document.getElementById('lbl-toggle-devtools');
    if (lbl) {
      lbl.textContent = store.devToolsCollapsed ? 'Lab Tools' : 'Hide Lab Tools';
    }
  }
  if (store.currentState && store.currentState.mode !== 'FALLEN' && !store.isSequencePlaying) {
    renderViewportCenterStage(store.currentState);
  }
}

export function syncUiModeClasses(state) {
  if (!state) return;
  const enc = state.encounter;
  const isCombatStage2 = Boolean(enc && enc.status === 'IN_COMBAT');
  const isCombatStage1 = Boolean(enc && enc.status === 'DISCOVERED');
  const isCombat = isCombatStage1 || isCombatStage2;
  const isTown = Boolean(!isCombat && (state.isSafeCity || (state.currentTile && state.currentTile.is_safe === 1)));
  const isExploration = Boolean(!isCombat && !isTown);

  const targets = [document.body, document.getElementById('dm-shell')].filter(Boolean);
  targets.forEach(el => {
    el.classList.toggle('ui-mode-combat', isCombat);
    el.classList.toggle('ui-combat-stage1', isCombatStage1);
    el.classList.toggle('ui-combat-stage2', isCombatStage2);
    el.classList.toggle('ui-mode-town', isTown);
    el.classList.toggle('ui-mode-exploration', isExploration);
  });

  const modeInd = document.getElementById('header-mode-indicator');
  if (modeInd) {
    modeInd.className = 'lab-mode-indicator';
    if (isCombatStage2) {
      modeInd.classList.add('mode-combat');
      modeInd.textContent = `⚔️ Active Combat (Rd ${enc.combat_round || 1})`;
    } else if (isCombatStage1) {
      modeInd.classList.add('mode-mystery');
      modeInd.textContent = enc.isAmbush ? '⚠️ Ambush Ahead' : '👁️ Presence Sensed';
    } else if (isTown) {
      modeInd.classList.add('mode-town');
      modeInd.textContent = '🏛️ Safe Sanctuary';
    } else {
      modeInd.classList.add('mode-exploration');
      modeInd.textContent = '🌲 Wilderness Exploration';
    }
  }

  const deckHeading = document.getElementById('action-deck-heading');
  if (deckHeading) {
    if (isCombatStage2) {
      deckHeading.textContent = '⚔️ Combat Actions';
    } else if (isCombatStage1) {
      deckHeading.textContent = '👁️ Encounter Response';
    } else if (isTown) {
      deckHeading.textContent = '🏛️ Sanctuary Actions';
    } else {
      deckHeading.textContent = '⚔️ Tactical Actions';
    }
  }
}
