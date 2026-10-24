/**
 * DARKGRID ADVENTURE LAB — Full Gamepad API Engine, Focus Navigation & Controller HUD (ES Module)
 * Supports W3C Standard Gamepad Mapping, Xbox Controllers, and Lenovo Legion Go 2 Built-In TrueStrike Controls.
 */
import { store } from '../state/store.js';
import { closeLabModal, openLabModal, setQuestsModalTab } from './modals.js';
import { setMarketTab, setMarketCategoryFilter } from '../inventory/inventory-ui.js';
import {
  closePoiPlaque,
  dispatchAction,
  dispatchMove,
  triggerInspectPoi,
  dismissActiveDiscovery
} from '../api/client.js';
import { toggleChronicleHistory } from './chronicle.js';
import {
  handleSlot1Click,
  handleSlot2Click,
  handleSlot3Click,
  handleSlot4Click,
  handleBattlePrayerClick,
  handleSmiteClick,
  handleDivineShieldClick
} from '../combat/combat-ui.js';

export const GAMEPAD_CONFIG = {
  DEADZONE: 0.45,
  REPEAT_DELAY_MS: 195,
  INITIAL_REPEAT_DELAY_MS: 205,
  TRIGGER_THRESHOLD: 0.5,
  MODAL_SCROLL_STEP_PX: 14
};

export const GAMEPAD_BUTTONS = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  VIEW: 8,
  SELECT: 8,
  START: 9,
  MENU: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  GUIDE: 16
};

const BUTTON_NAME_TO_INDEX = {
  A: 0,
  CONFIRM: 0,
  CROSS: 0,
  B: 1,
  CANCEL: 1,
  CIRCLE: 1,
  X: 2,
  SQUARE: 2,
  Y: 3,
  TRIANGLE: 3,
  LB: 4,
  L1: 4,
  RB: 5,
  R1: 5,
  LT: 6,
  L2: 6,
  RT: 7,
  R2: 7,
  BACK: 8,
  VIEW: 8,
  SELECT: 8,
  START: 9,
  MENU: 9,
  L3: 10,
  R3: 11,
  UP: 12,
  DPAD_UP: 12,
  NORTH: 12,
  DOWN: 13,
  DPAD_DOWN: 13,
  SOUTH: 13,
  LEFT: 14,
  DPAD_LEFT: 14,
  WEST: 14,
  RIGHT: 15,
  DPAD_RIGHT: 15,
  EAST: 15,
  GUIDE: 16
};

const gamepadRuntime = {
  initialized: false,
  rafId: null,
  connected: false,
  activeProfile: null,
  lastButtons: new Array(17).fill(false),
  lastDirection: null,
  lastDirectionStepAt: 0,
  lastRightStickStepAt: 0,
  focusContextKey: null,
  focusIndex: 0,
  focusedElement: null,
  mockPads: null,
  lastManualStepWallTime: 0,
  syntheticClockMs: 1000,
  lastDispatchedAction: null,
  mutationObserver: null
};

export function identifyControllerProfile(rawId = '', rawMapping = '') {
  const id = String(rawId || 'Standard Gamepad').trim();
  const mapping = String(rawMapping || 'standard').toLowerCase().trim();
  const isLegionGo = /legion|lenovo|truestrike/i.test(id);
  const isXbox = !isLegionGo && /xbox|xinput|microsoft/i.test(id);

  if (isLegionGo) {
    return {
      id,
      mapping: mapping || 'standard',
      profileKey: 'LEGION_GO',
      pillText: '🎮 Legion Go Controller',
      cssClass: 'is-legion-go',
      isStandard: true
    };
  }
  if (isXbox) {
    return {
      id,
      mapping: mapping || 'standard',
      profileKey: 'XBOX',
      pillText: '🎮 Xbox Controller',
      cssClass: 'is-xbox',
      isStandard: true
    };
  }
  return {
    id,
    mapping: mapping || 'standard',
    profileKey: 'STANDARD',
    pillText: '🎮 Gamepad Ready',
    cssClass: 'is-standard',
    isStandard: mapping === 'standard' || mapping === ''
  };
}

export function ensureGamepadStatusPill() {
  if (typeof document === 'undefined') return null;
  let pill = document.getElementById('gamepad-status-pill');
  if (pill) return pill;

  const headerPrimary =
    document.querySelector('#lab-director-bar .lab-header-primary') ||
    document.getElementById('lab-director-bar') ||
    document.getElementById('dm-top-deck');
  if (!headerPrimary) return null;

  pill = document.createElement('span');
  pill.id = 'gamepad-status-pill';
  pill.className = 'gamepad-status-pill';
  pill.hidden = true;
  pill.setAttribute('role', 'status');
  pill.setAttribute('aria-live', 'polite');
  pill.textContent = '🎮 Gamepad Ready';
  pill.title = 'Controller Status • D-Pad/Left Stick: Move & Focus • A: Confirm/Attack • B: Cancel/Flee • X: Ability/Avoid • Y: Potion • LB/RB: Stance & Panels • View: Map • Menu: Hero';
  headerPrimary.appendChild(pill);
  return pill;
}

export function updateGamepadStatusPill(profile = null) {
  const pill = ensureGamepadStatusPill();
  if (!pill) return null;

  if (!profile) {
    pill.hidden = true;
    pill.classList.remove('is-connected', 'is-legion-go', 'is-xbox', 'is-standard');
    return pill;
  }

  pill.hidden = false;
  pill.classList.add('is-connected');
  pill.classList.remove('is-legion-go', 'is-xbox', 'is-standard');
  if (profile.cssClass) {
    pill.classList.add(profile.cssClass);
  }
  pill.textContent = profile.pillText || '🎮 Gamepad Ready';
  pill.setAttribute('data-controller-profile', profile.profileKey || 'STANDARD');
  pill.title = `${profile.pillText} (${profile.id}) • D-Pad/Stick: Move & Navigate • A: Confirm/Attack • B: Back/Flee • X: Ability/Avoid • Y: Potion • LB/RB: Stance & Modals • View: Map • Menu: Hero`;
  return pill;
}

function readRawButtonPressed(btn, threshold = GAMEPAD_CONFIG.TRIGGER_THRESHOLD) {
  if (!btn) return false;
  if (typeof btn === 'boolean') return btn;
  if (typeof btn === 'number') return btn > threshold;
  if (typeof btn === 'object') {
    if (btn.pressed === true) return true;
    if (typeof btn.value === 'number' && btn.value > threshold) return true;
  }
  return false;
}

function readConnectedGamepads(customPads = null) {
  let rawList = [];
  if (customPads !== null && customPads !== undefined) {
    rawList = Array.isArray(customPads) ? customPads : [customPads];
  } else if (gamepadRuntime.mockPads !== null) {
    rawList = Array.isArray(gamepadRuntime.mockPads) ? gamepadRuntime.mockPads : [gamepadRuntime.mockPads];
  } else if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
    try {
      const navPads = navigator.getGamepads();
      if (navPads) {
        rawList = Array.from(navPads);
      }
    } catch (_e) {
      rawList = [];
    }
  }

  const validPads = rawList.filter(p => p && p.connected !== false);
  if (validPads.length === 0) return null;

  // Support single pad OR merged dual pads (e.g. Lenovo Legion Go 2 detached Left/Right TrueStrike controllers)
  const mergedButtons = new Array(17).fill(false);
  const mergedAxes = [0, 0, 0, 0, 0, 0, 0, 0];
  let chosenPad = validPads[0];

  for (const pad of validPads) {
    if (/legion|lenovo|truestrike|xbox|xinput/i.test(String(pad.id || ''))) {
      chosenPad = pad;
    }
    const btns = Array.isArray(pad.buttons) || (pad.buttons && typeof pad.buttons.length === 'number')
      ? pad.buttons
      : [];
    for (let i = 0; i < 17; i++) {
      if (readRawButtonPressed(btns[i])) {
        mergedButtons[i] = true;
      }
    }
    const axes = Array.isArray(pad.axes) || (pad.axes && typeof pad.axes.length === 'number')
      ? pad.axes
      : [];
    for (let a = 0; a < Math.min(8, axes.length); a++) {
      const val = Number(axes[a] || 0);
      if (Number.isFinite(val) && Math.abs(val) > Math.abs(mergedAxes[a])) {
        mergedAxes[a] = val;
      }
    }
  }

  const profile = identifyControllerProfile(chosenPad.id, chosenPad.mapping);
  return {
    id: chosenPad.id || 'Standard Gamepad',
    mapping: chosenPad.mapping || 'standard',
    profile,
    buttons: mergedButtons,
    axes: mergedAxes
  };
}

export function resolveDirectionalInput(padState, deadzone = GAMEPAD_CONFIG.DEADZONE) {
  if (!padState) {
    return { direction: null, source: null, lx: 0, ly: 0, rx: 0, ry: 0 };
  }
  const btns = padState.buttons || [];
  const axes = padState.axes || [];

  const lx = Number(axes[0] || 0);
  const ly = Number(axes[1] || 0);
  const rx = Number(axes[2] || 0);
  const ry = Number(axes[3] || 0);

  // 1. Standard D-Pad buttons [12..15]
  if (btns[GAMEPAD_BUTTONS.DPAD_UP]) {
    return { direction: 'NORTH', source: 'DPAD', lx, ly, rx, ry };
  }
  if (btns[GAMEPAD_BUTTONS.DPAD_DOWN]) {
    return { direction: 'SOUTH', source: 'DPAD', lx, ly, rx, ry };
  }
  if (btns[GAMEPAD_BUTTONS.DPAD_LEFT]) {
    return { direction: 'WEST', source: 'DPAD', lx, ly, rx, ry };
  }
  if (btns[GAMEPAD_BUTTONS.DPAD_RIGHT]) {
    return { direction: 'EAST', source: 'DPAD', lx, ly, rx, ry };
  }

  // 2. Left Analog Stick (axes[0] = X, axes[1] = Y) with configurable deadzone (0.45)
  if (Math.abs(lx) >= deadzone || Math.abs(ly) >= deadzone) {
    if (Math.abs(ly) >= Math.abs(lx)) {
      return {
        direction: ly < 0 ? 'NORTH' : 'SOUTH',
        source: 'LEFT_STICK',
        lx,
        ly,
        rx,
        ry
      };
    }
    return {
      direction: lx < 0 ? 'WEST' : 'EAST',
      source: 'LEFT_STICK',
      lx,
      ly,
      rx,
      ry
    };
  }

  // 3. Fallback for non-standard DirectInput hat-switch D-pad on axes[6]/axes[7]
  const hatX = Number(axes[6] || 0);
  const hatY = Number(axes[7] || 0);
  if (Math.abs(hatX) >= deadzone || Math.abs(hatY) >= deadzone) {
    if (Math.abs(hatY) >= Math.abs(hatX)) {
      return {
        direction: hatY < 0 ? 'NORTH' : 'SOUTH',
        source: 'HAT_AXIS',
        lx,
        ly,
        rx,
        ry
      };
    }
    return {
      direction: hatX < 0 ? 'WEST' : 'EAST',
      source: 'HAT_AXIS',
      lx,
      ly,
      rx,
      ry
    };
  }

  return { direction: null, source: null, lx, ly, rx, ry };
}

function isElementVisibleAndInteractive(el) {
  if (!el || el.disabled || el.hidden) return false;
  if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
  let cur = el;
  while (cur && cur !== document.body) {
    if (cur.hidden) return false;
    if (cur.style && cur.style.display === 'none') return false;
    if (cur.style && cur.style.visibility === 'hidden') return false;
    cur = cur.parentElement;
  }
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return true;
}

export function resolveGamepadFocusContext() {
  if (typeof document === 'undefined') {
    return { type: 'exploration', key: 'exploration' };
  }
  const backdrop = document.getElementById('lab-modal-backdrop');
  const modalOpen = Boolean((backdrop && !backdrop.hidden) || store.currentOpenModal);
  if (modalOpen) {
    const mName = store.currentOpenModal || 'modal';
    const subKey =
      mName === 'market'
        ? `${store.currentMarketTab || 'BUY_STANDARD'}:${store.currentMarketFilter || 'ALL'}`
        : (mName === 'quests' || mName === 'bounties' ? `${store.currentQuestsTab || 'QUESTS'}` : '');
    return { type: 'modal', modalName: mName, key: `modal:${mName}:${subKey}` };
  }

  const st = store.currentState;
  const enc = st && st.encounter;
  if (enc && enc.status === 'IN_COMBAT') {
    return { type: 'combat-stage2', key: 'combat-stage2' };
  }
  if (enc && enc.status === 'DISCOVERED') {
    return { type: 'combat-stage1', key: 'combat-stage1' };
  }
  if (st && (st.mode === 'FALLEN' || st.mode === 'NO_CHARACTER' || st.mode === 'UNAUTHENTICATED')) {
    return { type: 'fallen', key: `fallen:${st.mode}` };
  }
  return { type: 'exploration', key: 'exploration' };
}

function injectGamepadHelpCardIfNeeded() {
  if (typeof document === 'undefined') return;
  const grid = document.getElementById('help-controls-grid');
  if (!grid || document.getElementById('help-gamepad-card')) return;

  const card = document.createElement('div');
  card.className = 'qa-card';
  card.id = 'help-gamepad-card';
  card.style.gridColumn = '1 / -1';
  card.innerHTML = `
    <div class="qa-card-title"><span>🎮 Gamepad Controls (Xbox &amp; Lenovo Legion Go 2)</span></div>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:6px; font-size:0.75rem; color:var(--text-body); margin-top:4px;">
      <div><kbd class="help-kbd">D-Pad</kbd> / <kbd class="help-kbd">Left Stick</kbd> — Move North/South/West/East (or navigate UI focus)</div>
      <div><kbd class="help-kbd">A</kbd> — Confirm / Attack / Engage / Interact with Landmark</div>
      <div><kbd class="help-kbd">B</kbd> — Cancel / Close Modal / Dismiss Landmark / Avoid or Flee</div>
      <div><kbd class="help-kbd">X</kbd> — Class Ability (Cleric Prayer) / Avoid Threat / Switch Sub-Tab</div>
      <div><kbd class="help-kbd">Y</kbd> — Drink Healing Potion Flask / Open Inventory</div>
      <div><kbd class="help-kbd">LB</kbd> / <kbd class="help-kbd">RB</kbd> — Swap Weapon Stance (Outside Modal) / Cycle Panels</div>
      <div><kbd class="help-kbd">LT</kbd> / <kbd class="help-kbd">RT</kbd> — Inventory &amp; Shop/Quests (Cleric Smite &amp; Shield in Combat)</div>
      <div><kbd class="help-kbd">View [Back]</kbd> / <kbd class="help-kbd">Menu [Start]</kbd> — Region Map [M] / Hero Sheet [C]</div>
    </div>
  `;
  grid.appendChild(card);
}

export function getFocusableElementsForContext(contextObj = null) {
  if (typeof document === 'undefined') return [];
  const ctx = contextObj || resolveGamepadFocusContext();

  if (ctx.type === 'modal') {
    if (ctx.modalName === 'help') {
      injectGamepadHelpCardIfNeeded();
    }
    const card = document.querySelector('#lab-modal-backdrop .lab-modal-card');
    if (!card) return [];
    const body = document.getElementById('lab-modal-body');
    const headerCloseBtn = card.querySelector('.lab-modal-header button');

    if (ctx.modalName === 'character' && body) {
      const attrBtns = Array.from(body.querySelectorAll('button[onclick*="spendMilestoneAttribute"]')).filter(isElementVisibleAndInteractive);
      const otherBtns = Array.from(body.querySelectorAll('button:not([onclick*="spendMilestoneAttribute"]), input, select')).filter(isElementVisibleAndInteractive);
      const all = [...attrBtns, ...otherBtns];
      if (headerCloseBtn && isElementVisibleAndInteractive(headerCloseBtn)) all.push(headerCloseBtn);
      return all;
    }

    if (ctx.modalName === 'market' && body) {
      const rowBtns = Array.from(body.querySelectorAll('.lab-item-row button')).filter(isElementVisibleAndInteractive);
      const tabBtns = Array.from(body.querySelectorAll('.market-tab-group button, .market-filter-group button')).filter(isElementVisibleAndInteractive);
      const otherBtns = Array.from(body.querySelectorAll('button')).filter(
        b => isElementVisibleAndInteractive(b) && !rowBtns.includes(b) && !tabBtns.includes(b)
      );
      const all = [...rowBtns, ...tabBtns, ...otherBtns];
      if (headerCloseBtn && isElementVisibleAndInteractive(headerCloseBtn)) all.push(headerCloseBtn);
      return all;
    }

    if ((ctx.modalName === 'quests' || ctx.modalName === 'bounties') && body) {
      const actionBtns = Array.from(
        body.querySelectorAll('[data-quest-card] button, .warrant-card button, .qa-card button')
      ).filter(isElementVisibleAndInteractive);
      const tabBtns = Array.from(body.querySelectorAll('.market-tab-group button')).filter(isElementVisibleAndInteractive);
      const all = [...actionBtns, ...tabBtns];
      if (headerCloseBtn && isElementVisibleAndInteractive(headerCloseBtn)) all.push(headerCloseBtn);
      return all;
    }

    const bodyCandidates = body
      ? Array.from(
          body.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), .atlas-cell:not(.is-impassable)')
        ).filter(isElementVisibleAndInteractive)
      : [];
    if (headerCloseBtn && isElementVisibleAndInteractive(headerCloseBtn)) {
      bodyCandidates.push(headerCloseBtn);
    }
    return bodyCandidates;
  }

  if (ctx.type === 'combat-stage2') {
    const ids = [
      'action-slot-1',
      'action-slot-2',
      'action-slot-3',
      'action-slot-4',
      'action-divine-prayer',
      'action-divine-smite',
      'action-divine-shield'
    ];
    return ids
      .map(id => document.getElementById(id))
      .filter(isElementVisibleAndInteractive);
  }

  if (ctx.type === 'combat-stage1') {
    const stageBtns = [
      document.getElementById('btn-encounter-fight'),
      document.getElementById('btn-encounter-avoid'),
      document.getElementById('action-slot-1'),
      document.getElementById('action-slot-4')
    ].filter(isElementVisibleAndInteractive);
    return Array.from(new Set(stageBtns));
  }

  if (ctx.type === 'fallen') {
    const stage = document.getElementById('fp-center-stage');
    if (!stage) return [];
    return Array.from(stage.querySelectorAll('button')).filter(isElementVisibleAndInteractive);
  }

  // Exploration context: Landmark scene buttons, dungeon CTAs, discovery choices, tactical slots & utility strip
  const explorationEls = [];
  const stage = document.getElementById('fp-center-stage');
  if (stage) {
    explorationEls.push(...Array.from(stage.querySelectorAll('button')).filter(isElementVisibleAndInteractive));
  }
  const discLayer = document.getElementById('fp-discovery-layer');
  if (discLayer && !discLayer.hidden) {
    explorationEls.push(...Array.from(discLayer.querySelectorAll('button')).filter(isElementVisibleAndInteractive));
  }
  const slotIds = ['action-slot-1', 'action-slot-2', 'action-slot-3', 'action-slot-4'];
  for (const id of slotIds) {
    const el = document.getElementById(id);
    if (isElementVisibleAndInteractive(el)) explorationEls.push(el);
  }
  const utilStrip = document.getElementById('dm-utility-strip');
  if (utilStrip) {
    explorationEls.push(...Array.from(utilStrip.querySelectorAll('button')).filter(isElementVisibleAndInteractive));
  }
  return Array.from(new Set(explorationEls));
}

export function clearGamepadFocusClasses() {
  if (typeof document === 'undefined') return;
  const existing = document.querySelectorAll('.gamepad-focus');
  existing.forEach(el => el.classList.remove('gamepad-focus'));
  gamepadRuntime.focusedElement = null;
}

export function syncGamepadFocus(forceReset = false) {
  if (typeof document === 'undefined') return null;
  const ctx = resolveGamepadFocusContext();
  const contextChanged = forceReset || gamepadRuntime.focusContextKey !== ctx.key;

  if (contextChanged) {
    gamepadRuntime.focusContextKey = ctx.key;
    gamepadRuntime.focusIndex = 0;
  }

  const candidates = getFocusableElementsForContext(ctx);
  clearGamepadFocusClasses();

  if (candidates.length === 0) {
    gamepadRuntime.focusIndex = 0;
    return null;
  }

  // Clamp focusIndex into valid range
  if (gamepadRuntime.focusIndex < 0 || gamepadRuntime.focusIndex >= candidates.length) {
    gamepadRuntime.focusIndex = 0;
  }

  const target = candidates[gamepadRuntime.focusIndex];
  if (target) {
    target.classList.add('gamepad-focus');
    gamepadRuntime.focusedElement = target;
    if (ctx.type === 'modal' && typeof target.scrollIntoView === 'function') {
      try {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } catch (_e) {
        // ignore in synthetic environments
      }
    }
  }
  return target;
}

export function moveGamepadFocus(direction) {
  const ctx = resolveGamepadFocusContext();
  if (gamepadRuntime.focusContextKey !== ctx.key) {
    gamepadRuntime.focusContextKey = ctx.key;
    gamepadRuntime.focusIndex = 0;
  }

  const candidates = getFocusableElementsForContext(ctx);
  if (candidates.length === 0) {
    clearGamepadFocusClasses();
    return null;
  }

  const total = candidates.length;
  let step = 1;
  if (direction === 'NORTH' || direction === 'WEST' || direction === 'UP' || direction === 'LEFT') {
    step = -1;
  } else {
    step = 1;
  }

  // Support 15x15 Atlas grid vertical movement when inside Atlas modal
  const currentEl = candidates[gamepadRuntime.focusIndex];
  if (
    ctx.type === 'modal' &&
    ctx.modalName === 'atlas' &&
    currentEl &&
    currentEl.classList &&
    currentEl.classList.contains('atlas-cell') &&
    (direction === 'NORTH' || direction === 'SOUTH')
  ) {
    step = direction === 'NORTH' ? -15 : 15;
  }

  gamepadRuntime.focusIndex = ((gamepadRuntime.focusIndex + step) % total + total) % total;
  return syncGamepadFocus(false);
}

export function activateGamepadFocusedElement() {
  const focused = syncGamepadFocus(false);
  if (!focused) return false;

  if (focused.id === 'action-slot-4') {
    const enc = store.currentState && store.currentState.encounter;
    if (enc && enc.status === 'IN_COMBAT') {
      store.fleeConfirmArmed = true;
    }
  }

  if (typeof focused.click === 'function') {
    focused.click();
    return true;
  }
  return false;
}

function triggerGamepadMove(direction) {
  if (!store.currentState || store.currentState.mode === 'FALLEN') return Promise.resolve();
  if (store.isBusy) return Promise.resolve();
  const enc = store.currentState.encounter;
  if (enc && (enc.status === 'IN_COMBAT' || enc.isAmbush)) return Promise.resolve();

  // Highlight directional movement button in HUD pad
  const padIdMap = {
    NORTH: 'pad-forward',
    SOUTH: 'pad-backward',
    WEST: 'pad-strafe-left',
    EAST: 'pad-strafe-right'
  };
  const padBtn = typeof document !== 'undefined' ? document.getElementById(padIdMap[direction]) : null;
  if (padBtn) {
    clearGamepadFocusClasses();
    padBtn.classList.add('gamepad-focus');
    gamepadRuntime.focusedElement = padBtn;
  }

  gamepadRuntime.lastDispatchedAction = `MOVE:${direction}`;
  store.isPoiPlaqueOpen = false;
  const movePromise = dispatchMove(direction);
  // If client.js 95ms wall-clock throttle skipped dispatchMove during a synthetic timestamp test, invoke dispatchAction directly
  if (!store.isBusy) {
    return dispatchAction('MOVE', { direction });
  }
  return movePromise;
}

export function handleGamepadConfirmAction() {
  const ctx = resolveGamepadFocusContext();

  // 1. Modal Open: click focused element inside modal
  if (ctx.type === 'modal') {
    gamepadRuntime.lastDispatchedAction = 'MODAL_CONFIRM';
    activateGamepadFocusedElement();
    return;
  }

  // 2. Stage 1 Encounter Secrecy: A = Engage / Fight (or focused Avoid button if player moved focus to Avoid)
  if (ctx.type === 'combat-stage1') {
    const focused = gamepadRuntime.focusedElement;
    if (focused && (focused.id === 'btn-encounter-avoid' || focused.id === 'action-slot-4')) {
      gamepadRuntime.lastDispatchedAction = 'AVOID';
      dispatchAction('AVOID');
      return;
    }
    gamepadRuntime.lastDispatchedAction = 'FIGHT';
    dispatchAction('FIGHT');
    return;
  }

  // 3. Stage 2 Active Combat: A activates currently focused combat button (defaults to #action-slot-1 Attack)
  if (ctx.type === 'combat-stage2') {
    const focused = syncGamepadFocus(false);
    if (focused && focused.id && focused.id !== 'action-slot-1') {
      gamepadRuntime.lastDispatchedAction = `COMBAT_FOCUS:${focused.id}`;
      activateGamepadFocusedElement();
      return;
    }
    gamepadRuntime.lastDispatchedAction = 'ATTACK';
    handleSlot1Click();
    return;
  }

  // 4. Fallen / No Character / Unauthenticated screen
  if (ctx.type === 'fallen') {
    gamepadRuntime.lastDispatchedAction = 'FALLEN_CONFIRM';
    activateGamepadFocusedElement();
    return;
  }

  // 5. Exploration / Landmark / Dungeon / Safe City Primary Interaction
  if (typeof document !== 'undefined') {
    // If user explicitly navigated focus to a utility/landmark button, click it
    const activeFocus = gamepadRuntime.focusedElement;
    if (
      activeFocus &&
      isElementVisibleAndInteractive(activeFocus) &&
      !['pad-forward', 'pad-backward', 'pad-strafe-left', 'pad-strafe-right'].includes(activeFocus.id)
    ) {
      gamepadRuntime.lastDispatchedAction = `EXPLORE_FOCUS:${activeFocus.id || 'BTN'}`;
      activeFocus.click();
      return;
    }

    // Priority contextual CTA buttons in viewport center stage
    const priorityStageButtonIds = [
      'btn-victory-continue',
      'btn-explore-goblin-cave',
      'btn-enter-ancient-crypt',
      'btn-engage-dungeon-boss',
      'btn-exit-dungeon',
      'btn-engage-stronghold-boss',
      'btn-confront-highland-warlord',
      'btn-town-accept-quest',
      'btn-town-claim-reward',
      'btn-town-rest',
      'btn-disc-expand'
    ];
    for (const id of priorityStageButtonIds) {
      const btn = document.getElementById(id);
      if (isElementVisibleAndInteractive(btn)) {
        gamepadRuntime.lastDispatchedAction = `CTA:${id}`;
        btn.click();
        return;
      }
    }

    // Discovery choice buttons if an important discovery card is open
    const firstDiscoveryChoice = document.querySelector('#fp-discovery-layer:not([hidden]) .btn-discovery-choice');
    if (isElementVisibleAndInteractive(firstDiscoveryChoice)) {
      gamepadRuntime.lastDispatchedAction = 'DISCOVERY_CHOICE';
      firstDiscoveryChoice.click();
      return;
    }
  }

  gamepadRuntime.lastDispatchedAction = 'SLOT_1';
  handleSlot1Click();
}

export function handleGamepadCancelAction() {
  const ctx = resolveGamepadFocusContext();

  // 1. Close active Modal
  if (ctx.type === 'modal') {
    gamepadRuntime.lastDispatchedAction = 'CLOSE_MODAL';
    closeLabModal();
    syncGamepadFocus(true);
    return;
  }

  // 2. Stage 1 Encounter Secrecy: B = Avoid / Evade threat (when not ambush)
  if (ctx.type === 'combat-stage1') {
    const enc = store.currentState && store.currentState.encounter;
    if (enc && !enc.isAmbush) {
      gamepadRuntime.lastDispatchedAction = 'AVOID';
      dispatchAction('AVOID');
    }
    return;
  }

  // 3. Stage 2 Active Combat: B = Flee Battle (goes through server validation for ambush round lock)
  if (ctx.type === 'combat-stage2') {
    gamepadRuntime.lastDispatchedAction = 'FLEE';
    store.fleeConfirmArmed = false;
    dispatchAction('FLEE');
    return;
  }

  // 4. Dismiss active Landmark Scene overlay if open
  if (store.currentState && store.currentState.landmarkScene && store.currentState.landmarkScene.isActive) {
    gamepadRuntime.lastDispatchedAction = 'DISMISS_LANDMARK_SCENE';
    dispatchAction('DISMISS_LANDMARK_SCENE');
    return;
  }

  // 5. Close POI Plaque if open
  if (store.isPoiPlaqueOpen) {
    gamepadRuntime.lastDispatchedAction = 'CLOSE_POI';
    closePoiPlaque();
    return;
  }

  // 6. Dismiss active Environmental Discovery overlay if open
  if (store.currentState && store.currentState.adventure && store.currentState.adventure.activeDiscovery) {
    gamepadRuntime.lastDispatchedAction = 'DISMISS_DISCOVERY';
    dismissActiveDiscovery();
    return;
  }

  // 7. Dismiss Victory banner if active
  if (store.currentState && store.currentState.victory) {
    gamepadRuntime.lastDispatchedAction = 'DISMISS_VICTORY';
    dispatchAction('DISMISS_VICTORY');
    return;
  }

  // 8. Collapse Chronicle History if expanded
  if (store.isChronicleExpanded) {
    gamepadRuntime.lastDispatchedAction = 'COLLAPSE_CHRONICLE';
    toggleChronicleHistory(false);
    return;
  }

  clearGamepadFocusClasses();
}

export function handleGamepadSecondaryXAction() {
  const ctx = resolveGamepadFocusContext();

  // Inside Modals: X switches sub-tabs in Market / Quests
  if (ctx.type === 'modal') {
    if (ctx.modalName === 'quests' || ctx.modalName === 'bounties') {
      const nextTab = store.currentQuestsTab === 'BOUNTIES' ? 'QUESTS' : 'BOUNTIES';
      gamepadRuntime.lastDispatchedAction = `QUESTS_TAB:${nextTab}`;
      setQuestsModalTab(nextTab);
      syncGamepadFocus(true);
      return;
    }
    if (ctx.modalName === 'market') {
      const tabs = ['BUY_STANDARD', 'BUY_RESALE', 'SELL_PACK'];
      const idx = tabs.indexOf(store.currentMarketTab || 'BUY_STANDARD');
      const nextTab = tabs[(idx + 1) % tabs.length];
      gamepadRuntime.lastDispatchedAction = `MARKET_TAB:${nextTab}`;
      setMarketTab(nextTab);
      syncGamepadFocus(true);
      return;
    }
    activateGamepadFocusedElement();
    return;
  }

  // Stage 1 Encounter Secrecy: X = Avoid / Evade
  if (ctx.type === 'combat-stage1') {
    const enc = store.currentState && store.currentState.encounter;
    if (enc && !enc.isAmbush) {
      gamepadRuntime.lastDispatchedAction = 'AVOID';
      dispatchAction('AVOID');
    }
    return;
  }

  // Stage 2 Active Combat: X = Class Ability / Special Action
  if (ctx.type === 'combat-stage2') {
    const hero = store.currentState && store.currentState.character;
    if (hero && hero.class === 'CLERIC') {
      const focused = gamepadRuntime.focusedElement;
      if (focused && focused.id === 'action-divine-smite' && !focused.disabled) {
        gamepadRuntime.lastDispatchedAction = 'SMITE';
        handleSmiteClick();
        return;
      }
      if (focused && focused.id === 'action-divine-shield' && !focused.disabled) {
        gamepadRuntime.lastDispatchedAction = 'DIVINE_SHIELD';
        handleDivineShieldClick();
        return;
      }
      const prayerBtn = typeof document !== 'undefined' ? document.getElementById('action-divine-prayer') : null;
      if (!prayerBtn || !prayerBtn.disabled) {
        gamepadRuntime.lastDispatchedAction = 'BATTLE_PRAYER';
        handleBattlePrayerClick();
        return;
      }
    }
    gamepadRuntime.lastDispatchedAction = 'ATTACK';
    handleSlot1Click();
    return;
  }

  // Exploration / Town: Cleric out-of-combat Divine Heal, POI Inspect, or Quests modal
  const st = store.currentState;
  const hero = st && st.character;
  if (
    hero &&
    hero.class === 'CLERIC' &&
    st.clericHealInfo &&
    st.clericHealInfo.remainingUses > 0 &&
    hero.current_hp < hero.max_hp
  ) {
    gamepadRuntime.lastDispatchedAction = 'CLERIC_HEAL';
    handleSlot4Click();
    return;
  }
  if (st && st.viewportScene && st.viewportScene.pointOfInterest) {
    gamepadRuntime.lastDispatchedAction = 'INSPECT_POI';
    triggerInspectPoi();
    return;
  }
  gamepadRuntime.lastDispatchedAction = 'OPEN_QUESTS';
  openLabModal('quests');
  syncGamepadFocus(true);
}

export function handleGamepadTertiaryYAction() {
  const ctx = resolveGamepadFocusContext();

  if (ctx.type === 'modal') {
    if (ctx.modalName === 'market') {
      const filters = ['ALL', 'WEAPON', 'ARMOR', 'SHIELD', 'ACCESSORY', 'POTION'];
      const idx = filters.indexOf(store.currentMarketFilter || 'ALL');
      const nextFilter = filters[(idx + 1) % filters.length];
      gamepadRuntime.lastDispatchedAction = `MARKET_FILTER:${nextFilter}`;
      setMarketCategoryFilter(nextFilter);
      syncGamepadFocus(true);
      return;
    }
    if (ctx.modalName === 'backpack') {
      gamepadRuntime.lastDispatchedAction = 'CLOSE_MODAL';
      closeLabModal();
      syncGamepadFocus(true);
      return;
    }
    gamepadRuntime.lastDispatchedAction = 'OPEN_BACKPACK';
    openLabModal('backpack');
    syncGamepadFocus(true);
    return;
  }

  // Stage 2 Combat: Y = Use Healing Potion
  if (ctx.type === 'combat-stage2') {
    gamepadRuntime.lastDispatchedAction = 'POTION';
    handleSlot2Click();
    return;
  }

  // Outside Combat: Drink Potion if injured and holding potions; otherwise open Backpack
  const st = store.currentState;
  const hero = st && st.character;
  if (st && hero && st.combatPotionCount > 0 && hero.current_hp < hero.max_hp) {
    gamepadRuntime.lastDispatchedAction = 'POTION';
    handleSlot2Click();
    return;
  }

  gamepadRuntime.lastDispatchedAction = 'OPEN_BACKPACK';
  openLabModal('backpack');
  syncGamepadFocus(true);
}

function getModalCycleOrder() {
  const isSafeCity = Boolean(store.currentState && store.currentState.isSafeCity);
  return isSafeCity
    ? ['character', 'backpack', 'market', 'quests', 'map']
    : ['character', 'backpack', 'quests', 'map'];
}

export function handleGamepadBumperAction(side) {
  const ctx = resolveGamepadFocusContext();
  const delta = side === 'LEFT' ? -1 : 1;

  // When a modal is open, LB/RB cycles across the primary player panels
  if (ctx.type === 'modal') {
    const order = getModalCycleOrder();
    const current = ctx.modalName === 'bounties' ? 'quests' : ctx.modalName;
    const idx = order.indexOf(current);
    const nextIdx = idx === -1 ? 0 : ((idx + delta) % order.length + order.length) % order.length;
    const nextModal = order[nextIdx];
    gamepadRuntime.lastDispatchedAction = `CYCLE_MODAL:${nextModal}`;
    openLabModal(nextModal);
    syncGamepadFocus(true);
    return;
  }

  // In Stage 2 Combat, LB/RB moves focus across combat action buttons
  if (ctx.type === 'combat-stage2') {
    moveGamepadFocus(side === 'LEFT' ? 'WEST' : 'EAST');
    return;
  }

  // In Exploration / Town: LB swaps weapon stance [3/R], RB opens Inventory/Backpack [B]
  if (side === 'LEFT') {
    gamepadRuntime.lastDispatchedAction = 'STANCE';
    handleSlot3Click();
  } else {
    gamepadRuntime.lastDispatchedAction = 'OPEN_BACKPACK';
    openLabModal('backpack');
    syncGamepadFocus(true);
  }
}

export function handleGamepadTriggerAction(side) {
  const ctx = resolveGamepadFocusContext();

  if (ctx.type === 'modal') {
    if (ctx.modalName === 'market') {
      const tabs = ['BUY_STANDARD', 'BUY_RESALE', 'SELL_PACK'];
      const idx = tabs.indexOf(store.currentMarketTab || 'BUY_STANDARD');
      const delta = side === 'LEFT' ? -1 : 1;
      const nextTab = tabs[((idx + delta) % tabs.length + tabs.length) % tabs.length];
      gamepadRuntime.lastDispatchedAction = `MARKET_TAB:${nextTab}`;
      setMarketTab(nextTab);
      syncGamepadFocus(true);
      return;
    }
    if (ctx.modalName === 'quests' || ctx.modalName === 'bounties') {
      const nextTab = side === 'LEFT' ? 'QUESTS' : 'BOUNTIES';
      gamepadRuntime.lastDispatchedAction = `QUESTS_TAB:${nextTab}`;
      setQuestsModalTab(nextTab);
      syncGamepadFocus(true);
      return;
    }
    handleGamepadBumperAction(side);
    return;
  }

  // Stage 2 Combat: Cleric Smite (LT) & Divine Shield (RT)
  if (ctx.type === 'combat-stage2') {
    const hero = store.currentState && store.currentState.character;
    if (hero && hero.class === 'CLERIC') {
      if (side === 'LEFT') {
        gamepadRuntime.lastDispatchedAction = 'SMITE';
        handleSmiteClick();
      } else {
        gamepadRuntime.lastDispatchedAction = 'DIVINE_SHIELD';
        handleDivineShieldClick();
      }
      return;
    }
    moveGamepadFocus(side === 'LEFT' ? 'WEST' : 'EAST');
    return;
  }

  // Exploration / Town shortcuts: LT = Backpack, RT = Shop (in Safe City) or Quests (in Wilderness)
  if (side === 'LEFT') {
    gamepadRuntime.lastDispatchedAction = 'OPEN_BACKPACK';
    openLabModal('backpack');
    syncGamepadFocus(true);
  } else if (store.currentState && store.currentState.isSafeCity) {
    gamepadRuntime.lastDispatchedAction = 'OPEN_MARKET';
    openLabModal('market');
    syncGamepadFocus(true);
  } else {
    gamepadRuntime.lastDispatchedAction = 'OPEN_QUESTS';
    openLabModal('quests');
    syncGamepadFocus(true);
  }
}

function toggleModalByName(modalName) {
  const ctx = resolveGamepadFocusContext();
  if (ctx.type === 'modal' && ctx.modalName === modalName) {
    gamepadRuntime.lastDispatchedAction = `CLOSE_MODAL:${modalName}`;
    closeLabModal();
    syncGamepadFocus(true);
  } else {
    gamepadRuntime.lastDispatchedAction = `OPEN_MODAL:${modalName}`;
    openLabModal(modalName);
    syncGamepadFocus(true);
  }
}

export function stepGamepadFrame(customPads = null, customTimestamp = null) {
  if (customPads !== null || customTimestamp !== null) {
    gamepadRuntime.lastManualStepWallTime = Date.now();
  }
  const now =
    typeof customTimestamp === 'number'
      ? customTimestamp
      : (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const pad = readConnectedGamepads(customPads);
  if (!pad) {
    if (gamepadRuntime.connected) {
      gamepadRuntime.connected = false;
      gamepadRuntime.activeProfile = null;
      gamepadRuntime.lastButtons.fill(false);
      gamepadRuntime.lastDirection = null;
      updateGamepadStatusPill(null);
    }
    return Promise.resolve(getGamepadDebugState());
  }

  if (!gamepadRuntime.connected || !gamepadRuntime.activeProfile || gamepadRuntime.activeProfile.id !== pad.profile.id) {
    gamepadRuntime.connected = true;
    gamepadRuntime.activeProfile = pad.profile;
    updateGamepadStatusPill(pad.profile);
  }

  // Ensure initial focus exists for current context when gamepad is active
  syncGamepadFocus(false);

  // 1. Process Rising-Edge Action Buttons [0..11]
  const btns = pad.buttons;
  const prevBtns = gamepadRuntime.lastButtons;
  const justPressed = idx => Boolean(btns[idx] && !prevBtns[idx]);

  if (justPressed(GAMEPAD_BUTTONS.A)) {
    handleGamepadConfirmAction();
  } else if (justPressed(GAMEPAD_BUTTONS.B)) {
    handleGamepadCancelAction();
  } else if (justPressed(GAMEPAD_BUTTONS.X)) {
    handleGamepadSecondaryXAction();
  } else if (justPressed(GAMEPAD_BUTTONS.Y)) {
    handleGamepadTertiaryYAction();
  } else if (justPressed(GAMEPAD_BUTTONS.LB)) {
    handleGamepadBumperAction('LEFT');
  } else if (justPressed(GAMEPAD_BUTTONS.RB)) {
    handleGamepadBumperAction('RIGHT');
  } else if (justPressed(GAMEPAD_BUTTONS.LT)) {
    handleGamepadTriggerAction('LEFT');
  } else if (justPressed(GAMEPAD_BUTTONS.RT)) {
    handleGamepadTriggerAction('RIGHT');
  } else if (justPressed(GAMEPAD_BUTTONS.VIEW)) {
    toggleModalByName('map');
  } else if (justPressed(GAMEPAD_BUTTONS.MENU)) {
    toggleModalByName('character');
  } else if (justPressed(GAMEPAD_BUTTONS.L3)) {
    toggleModalByName('quests');
  } else if (justPressed(GAMEPAD_BUTTONS.R3)) {
    if (store.currentState && store.currentState.isSafeCity) {
      toggleModalByName('market');
    } else {
      toggleModalByName('help');
    }
  }

  for (let i = 0; i < 17; i++) {
    prevBtns[i] = Boolean(btns[i]);
  }

  // 2. Process D-Pad & Left Analog Stick (Movement in Exploration/Dungeons vs Focus in Modals/Combat)
  const dirInfo = resolveDirectionalInput(pad, GAMEPAD_CONFIG.DEADZONE);
  const dir = dirInfo.direction;

  if (!dir) {
    gamepadRuntime.lastDirection = null;
    gamepadRuntime.lastDirectionStepAt = 0;
  } else {
    const isNewDirection = dir !== gamepadRuntime.lastDirection;
    const elapsed = now - gamepadRuntime.lastDirectionStepAt;
    const shouldStep = isNewDirection || elapsed >= GAMEPAD_CONFIG.REPEAT_DELAY_MS;

    if (shouldStep) {
      const ctx = resolveGamepadFocusContext();
      if (ctx.type === 'exploration') {
        if (!store.isBusy) {
          gamepadRuntime.lastDirection = dir;
          gamepadRuntime.lastDirectionStepAt = now;
          triggerGamepadMove(dir);
        }
      } else {
        gamepadRuntime.lastDirection = dir;
        gamepadRuntime.lastDirectionStepAt = now;
        moveGamepadFocus(dir);
      }
    }
  }

  // 3. Process Right Analog Stick (Modal Scroll or HUD Focus Navigation in Exploration)
  const rx = dirInfo.rx;
  const ry = dirInfo.ry;
  if (Math.abs(rx) >= GAMEPAD_CONFIG.DEADZONE || Math.abs(ry) >= GAMEPAD_CONFIG.DEADZONE) {
    const ctx = resolveGamepadFocusContext();
    if (ctx.type === 'modal' && typeof document !== 'undefined') {
      const modalBody = document.getElementById('lab-modal-body');
      if (modalBody && Math.abs(ry) >= GAMEPAD_CONFIG.DEADZONE) {
        modalBody.scrollTop += Math.round(ry * GAMEPAD_CONFIG.MODAL_SCROLL_STEP_PX);
      }
    } else if (now - gamepadRuntime.lastRightStickStepAt >= GAMEPAD_CONFIG.REPEAT_DELAY_MS) {
      gamepadRuntime.lastRightStickStepAt = now;
      const rDir = Math.abs(ry) >= Math.abs(rx) ? (ry < 0 ? 'NORTH' : 'SOUTH') : (rx < 0 ? 'WEST' : 'EAST');
      moveGamepadFocus(rDir);
    }
  }

  syncGamepadFocus(false);

  if (store.activeActionPromise) {
    return store.activeActionPromise
      .catch(() => {})
      .then(() => {
        syncGamepadFocus(false);
        return getGamepadDebugState();
      });
  }

  return Promise.resolve(getGamepadDebugState());
}

export function createMockGamepad(overrides = {}) {
  const buttons = Array.from({ length: 17 }, (_, idx) => {
    const custom = overrides.buttons && overrides.buttons[idx];
    const pressed = readRawButtonPressed(custom);
    return { pressed, touched: pressed, value: pressed ? 1 : 0 };
  });

  if (Array.isArray(overrides.pressedButtons)) {
    for (const key of overrides.pressedButtons) {
      const idx = typeof key === 'number' ? key : BUTTON_NAME_TO_INDEX[String(key).toUpperCase()];
      if (typeof idx === 'number' && buttons[idx]) {
        buttons[idx] = { pressed: true, touched: true, value: 1 };
      }
    }
  }

  const axes = [0, 0, 0, 0];
  if (Array.isArray(overrides.axes)) {
    for (let i = 0; i < Math.min(8, overrides.axes.length); i++) {
      axes[i] = Number(overrides.axes[i] || 0);
    }
  }

  return {
    id: overrides.id || 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
    index: overrides.index || 0,
    connected: overrides.connected !== false,
    mapping: overrides.mapping !== undefined ? overrides.mapping : 'standard',
    axes,
    buttons,
    timestamp: overrides.timestamp || Date.now()
  };
}

export function setMockGamepadState(overrides = null) {
  if (overrides === null) {
    gamepadRuntime.mockPads = null;
    return null;
  }
  const pad = Array.isArray(overrides)
    ? overrides.map(o => (o && o.buttons && o.axes ? o : createMockGamepad(o || {})))
    : [overrides.buttons && overrides.axes ? overrides : createMockGamepad(overrides)];
  gamepadRuntime.mockPads = pad;
  return pad[0];
}

export async function simulateGamepadButtonPress(buttonIndexOrName, options = {}) {
  const idx =
    typeof buttonIndexOrName === 'number'
      ? buttonIndexOrName
      : BUTTON_NAME_TO_INDEX[String(buttonIndexOrName || '').toUpperCase()];
  if (typeof idx !== 'number') {
    throw new Error(`Unknown gamepad button: ${buttonIndexOrName}`);
  }

  const padId = options.id || (gamepadRuntime.activeProfile && gamepadRuntime.activeProfile.id) || 'Lenovo Legion Go 2 TrueStrike Controller';
  gamepadRuntime.syntheticClockMs += 250;

  // Frame 1: Button Down
  const downPad = createMockGamepad({
    id: padId,
    mapping: options.mapping || 'standard',
    pressedButtons: [idx]
  });
  await stepGamepadFrame([downPad], gamepadRuntime.syntheticClockMs);

  // Frame 2: Button Released
  gamepadRuntime.syntheticClockMs += 40;
  const upPad = createMockGamepad({
    id: padId,
    mapping: options.mapping || 'standard',
    pressedButtons: []
  });
  return stepGamepadFrame([upPad], gamepadRuntime.syntheticClockMs);
}

export async function simulateGamepadDirection(direction, options = {}) {
  const upper = String(direction || 'NORTH').toUpperCase();
  const useStick = Boolean(options.useStick);
  const holdFrames = Number(options.holdFrames || 1);
  const stepMs = Number(options.frameDeltaMs || 220);
  const padId = options.id || (gamepadRuntime.activeProfile && gamepadRuntime.activeProfile.id) || 'Lenovo Legion Go 2 TrueStrike Controller';

  let axes = [0, 0, 0, 0];
  let pressedButtons = [];
  if (useStick) {
    const mag = typeof options.magnitude === 'number' ? options.magnitude : 0.85;
    if (upper === 'NORTH' || upper === 'UP') axes = [0, -mag, 0, 0];
    else if (upper === 'SOUTH' || upper === 'DOWN') axes = [0, mag, 0, 0];
    else if (upper === 'WEST' || upper === 'LEFT') axes = [-mag, 0, 0, 0];
    else if (upper === 'EAST' || upper === 'RIGHT') axes = [mag, 0, 0, 0];
  } else {
    if (upper === 'NORTH' || upper === 'UP') pressedButtons = [GAMEPAD_BUTTONS.DPAD_UP];
    else if (upper === 'SOUTH' || upper === 'DOWN') pressedButtons = [GAMEPAD_BUTTONS.DPAD_DOWN];
    else if (upper === 'WEST' || upper === 'LEFT') pressedButtons = [GAMEPAD_BUTTONS.DPAD_LEFT];
    else if (upper === 'EAST' || upper === 'RIGHT') pressedButtons = [GAMEPAD_BUTTONS.DPAD_RIGHT];
  }

  let lastResult = null;
  for (let f = 0; f < holdFrames; f++) {
    gamepadRuntime.syntheticClockMs += f === 0 ? 250 : stepMs;
    const activePad = createMockGamepad({
      id: padId,
      mapping: options.mapping || 'standard',
      axes,
      pressedButtons
    });
    lastResult = await stepGamepadFrame([activePad], gamepadRuntime.syntheticClockMs);
  }

  if (options.release !== false) {
    gamepadRuntime.syntheticClockMs += 40;
    const neutralPad = createMockGamepad({
      id: padId,
      mapping: options.mapping || 'standard',
      axes: [0, 0, 0, 0],
      pressedButtons: []
    });
    lastResult = await stepGamepadFrame([neutralPad], gamepadRuntime.syntheticClockMs);
  }

  return lastResult;
}

export function getGamepadDebugState() {
  const ctx = resolveGamepadFocusContext();
  const focused = gamepadRuntime.focusedElement;
  const pill = typeof document !== 'undefined' ? document.getElementById('gamepad-status-pill') : null;
  return {
    connected: gamepadRuntime.connected,
    profile: gamepadRuntime.activeProfile,
    pillVisible: Boolean(pill && !pill.hidden),
    pillText: pill ? pill.textContent : '',
    focusContext: ctx.type,
    focusContextKey: ctx.key,
    focusIndex: gamepadRuntime.focusIndex,
    focusedElementId: focused ? focused.id || null : null,
    focusedElementText: focused ? String(focused.textContent || '').trim().slice(0, 60) : null,
    hasGamepadFocusClass: Boolean(focused && focused.classList && focused.classList.contains('gamepad-focus')),
    lastDirection: gamepadRuntime.lastDirection,
    lastDispatchedAction: gamepadRuntime.lastDispatchedAction,
    openModal: store.currentOpenModal
  };
}

export function resetGamepadState() {
  gamepadRuntime.connected = false;
  gamepadRuntime.activeProfile = null;
  gamepadRuntime.lastButtons.fill(false);
  gamepadRuntime.lastDirection = null;
  gamepadRuntime.lastDirectionStepAt = 0;
  gamepadRuntime.lastRightStickStepAt = 0;
  gamepadRuntime.focusContextKey = null;
  gamepadRuntime.focusIndex = 0;
  gamepadRuntime.mockPads = null;
  gamepadRuntime.lastDispatchedAction = null;
  clearGamepadFocusClasses();
  updateGamepadStatusPill(null);
}

function startGamepadLoop() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
  if (gamepadRuntime.rafId !== null) return;

  const tick = timestamp => {
    try {
      if (Date.now() - gamepadRuntime.lastManualStepWallTime >= 2500) {
        stepGamepadFrame(null, timestamp);
      }
    } catch (_e) {
      // Never break animation loop on transient DOM error
    }
    gamepadRuntime.rafId = window.requestAnimationFrame(tick);
  };
  gamepadRuntime.rafId = window.requestAnimationFrame(tick);
}

export function initGamepad() {
  ensureGamepadStatusPill();

  if (typeof window !== 'undefined') {
    if (!('currentQuestsTab' in window)) {
      Object.defineProperty(window, 'currentQuestsTab', {
        configurable: true,
        get: () => store.currentQuestsTab,
        set: v => {
          store.currentQuestsTab = v;
        }
      });
    }
    const api = {
      GAMEPAD_CONFIG,
      GAMEPAD_BUTTONS,
      identifyControllerProfile,
      ensureGamepadStatusPill,
      updateGamepadStatusPill,
      resolveDirectionalInput,
      resolveGamepadFocusContext,
      getFocusableElementsForContext,
      syncGamepadFocus,
      moveGamepadFocus,
      activateGamepadFocusedElement,
      handleGamepadConfirmAction,
      handleGamepadCancelAction,
      handleGamepadSecondaryXAction,
      handleGamepadTertiaryYAction,
      handleGamepadBumperAction,
      handleGamepadTriggerAction,
      stepGamepadFrame,
      createMockGamepad,
      setMockGamepadState,
      simulateGamepadButtonPress,
      simulateGamepadDirection,
      getGamepadDebugState,
      resetGamepadState,
      initGamepad
    };
    window.DarkgridGamepad = api;
    Object.assign(window, api);
  }

  if (gamepadRuntime.initialized) return;
  gamepadRuntime.initialized = true;

  if (typeof window !== 'undefined') {
    window.addEventListener('gamepadconnected', e => {
      const gp = e && e.gamepad;
      const profile = identifyControllerProfile(gp ? gp.id : '', gp ? gp.mapping : 'standard');
      gamepadRuntime.connected = true;
      gamepadRuntime.activeProfile = profile;
      updateGamepadStatusPill(profile);
      syncGamepadFocus(true);
    });

    window.addEventListener('gamepaddisconnected', () => {
      const stillConnected = readConnectedGamepads();
      if (!stillConnected) {
        gamepadRuntime.connected = false;
        gamepadRuntime.activeProfile = null;
        clearGamepadFocusClasses();
        updateGamepadStatusPill(null);
      } else {
        gamepadRuntime.activeProfile = stillConnected.profile;
        updateGamepadStatusPill(stillConnected.profile);
      }
    });

    if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
      gamepadRuntime.mutationObserver = new MutationObserver(() => {
        if (gamepadRuntime.connected) {
          syncGamepadFocus(false);
        }
      });
      const modalBackdrop = document.getElementById('lab-modal-backdrop');
      const centerStage = document.getElementById('fp-center-stage');
      if (modalBackdrop) {
        gamepadRuntime.mutationObserver.observe(modalBackdrop, {
          attributes: true,
          attributeFilter: ['hidden'],
          childList: true,
          subtree: true
        });
      }
      if (centerStage) {
        gamepadRuntime.mutationObserver.observe(centerStage, {
          childList: true
        });
      }
    }

    startGamepadLoop();
  }
}
