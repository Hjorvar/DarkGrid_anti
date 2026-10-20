/**
 * DARKGRID — First-Person Action Viewport Client Engine (SPA)
 * Standalone prototype inside action-ui-lab/.
 * Implements:
 *  - Independent hero facing (NORTH, EAST, SOUTH, WEST) + relative movement (W/S/A/D/Q/E)
 *  - Map-connected multi-plane viewport & deterministic seeded SVG foreground/obstacles
 *  - In-scene Stage 1 (DISCOVERED) shadow threat with 1-step bypass+move
 *  - Sequenced multi-beat combat choreography (~380ms beat cadence)
 *  - Zero-confirmation post-victory exploration flow
 */

let currentState = null;
let isBusy = false;
let currentPresenceMode = 'integrated'; // 'integrated' (Cutout in POV — Default) | 'card' | 'blend' | 'framed'
let currentSceneMode = 'C'; // 'C' (First-Person POV — Default) | 'A' | 'B' | 'LEGACY'
let currentEffectsMode = 'subtle'; // 'off' | 'subtle' (Default) | 'full'
let isPoiPlaqueOpen = false;
let expandedDiscoveryKey = null;
let cachedAtlasData = null;
let selectedAtlasCoord = { x: 7, y: 7 };
let currentAtlasFilter = 'ALL'; // 'ALL' | 'A' | 'B' | 'C' | 'D' | 'POI'
let currentMonsterScaleMode = 'adaptive'; // 'adaptive' (PF1e Size & Body Profile — Default) | 'legacy' (Uniform 23vh Box)
let isSizeComparisonLabOpen = false;
let currentSizeComparisonPreset = 'SIZE_PROGRESSION_5'; // 'SIZE_PROGRESSION_5' | 'SAME_SIZE_MEDIUM_PROFILES' | 'SAME_SIZE_LARGE_PROFILES' | 'ALL_9_PF1E_TIERS' | 'BEFORE_AFTER_SPLIT'
let selectedBeforeAfterSpecimen = 'troll';
let fleeConfirmArmed = false;
let fleeConfirmTimer = null;
let crossfadeCleanupTimer = null;
let latestSceneImageSwapToken = 0;
const preloadedImageUrls = new Set();

// Atmospheric Canvas Particle Engine State
let atmoParticles = [];
let atmoAnimFrameId = null;
let atmoLastTick = 0;
let activeEffectProfile = null;

// Active combat sequence playback state
let activeSequenceTimers = [];
let isSequencePlaying = false;

const FACING_META = {
  NORTH: { short: 'N', arrow: '▲', label: 'Facing North', deg: 0 },
  EAST:  { short: 'E', arrow: '▶', label: 'Facing East',  deg: 90 },
  SOUTH: { short: 'S', arrow: '▼', label: 'Facing South', deg: 180 },
  WEST:  { short: 'W', arrow: '◀', label: 'Facing West',  deg: 270 }
};

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getConditionColor(bracketKey) {
  switch (bracketKey) {
    case '5_uninjured': return '#4ade80';
    case '6_barely_wounded': return '#a3e635';
    case '7_wounded': return '#f59e0b';
    case '8_badly_wounded': return '#f97316';
    case '9_near_death': return '#ef4444';
    default: return '#c5a059';
  }
}

/* =========================================================================
   1. MONSTER PRESENCE & SCENE MODE SWITCHERS (Live Visual Comparison)
   ========================================================================= */
function normalizeMonsterPresenceMode(mode) {
  const raw = String(mode || 'card').toLowerCase().trim();
  if (raw === 'hybrid' || raw === 'card' || raw === 'default') return 'card';
  if (raw === 'integrated' || raw === 'cutout' || raw === 'in-scene') return 'integrated';
  if (raw === 'blend') return 'blend';
  if (raw === 'framed' || raw === 'frame') return 'framed';
  return 'card';
}

function setMonsterPresenceMode(mode) {
  const norm = normalizeMonsterPresenceMode(mode);
  currentPresenceMode = norm;
  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.remove(
      'presence-mode-card',
      'presence-mode-hybrid',
      'presence-mode-integrated',
      'presence-mode-blend',
      'presence-mode-framed'
    );
    vp.classList.add('presence-mode-' + norm);
    if (norm === 'card') {
      vp.classList.add('presence-mode-hybrid');
    }
  }
  ['card', 'integrated', 'blend', 'framed'].forEach(m => {
    const btn = document.getElementById('blend-btn-' + m);
    if (btn) btn.classList.toggle('is-active', m === norm);
  });

  if (currentState && currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(currentState);
  }
}

function setMonsterScaleMode(mode) {
  const norm = String(mode || 'adaptive').toLowerCase().trim() === 'legacy' ? 'legacy' : 'adaptive';
  currentMonsterScaleMode = norm;
  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.toggle('scale-mode-adaptive', norm === 'adaptive');
    vp.classList.toggle('scale-mode-legacy', norm === 'legacy');
  }
  if (currentState && currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(currentState);
  }
}

function toggleMonsterSizeComparisonLab(forceState = null, presetId = null) {
  if (typeof forceState === 'boolean') {
    isSizeComparisonLabOpen = forceState;
  } else {
    isSizeComparisonLabOpen = !isSizeComparisonLabOpen;
  }
  if (presetId) {
    currentSizeComparisonPreset = presetId;
  }
  const btn = document.getElementById('btn-toggle-sizelab');
  if (btn) {
    btn.classList.toggle('is-active', isSizeComparisonLabOpen);
  }
  if (currentState && currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(currentState);
  }
}

function setSizeComparisonPreset(presetId) {
  currentSizeComparisonPreset = presetId || 'SIZE_PROGRESSION_5';
  isSizeComparisonLabOpen = true;
  const btn = document.getElementById('btn-toggle-sizelab');
  if (btn) btn.classList.add('is-active');
  if (currentState && currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(currentState);
  }
}

function setBeforeAfterSpecimen(slug) {
  selectedBeforeAfterSpecimen = slug || 'troll';
  currentSizeComparisonPreset = 'BEFORE_AFTER_SPLIT';
  isSizeComparisonLabOpen = true;
  if (currentState && currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(currentState);
  }
}

function computeClientMonsterVisualScale(monsterOrKey, state, isEffectiveIntegrated = false, extraOpts = {}) {
  const cat = window.MonsterSizeCatalog;
  if (!cat || typeof cat.computeAdaptiveMonsterVisualScale !== 'function') {
    return (monsterOrKey && monsterOrKey.adaptiveScale) || null;
  }
  const mode = (state && state.sceneMode) || currentSceneMode || 'C';
  const scene = state && state.viewportScene;
  const activeScene = (scene && scene.scenes && scene.scenes[mode]) || (scene && scene.activeScene) || {};
  const stageAnchor = activeScene.stageAnchor || {};
  const stageFloorY = typeof stageAnchor.stageFloorY === 'number' ? stageAnchor.stageFloorY : 82;

  return cat.computeAdaptiveMonsterVisualScale(monsterOrKey, {
    viewportWidth: window.innerWidth || 1920,
    viewportHeight: window.innerHeight || 1080,
    presentationMode: isEffectiveIntegrated ? 'INTEGRATED' : 'CARD',
    stageFloorY,
    virtualDistanceFt: 12,
    ...extraOpts
  });
}

function syncSceneModeButtons(mode) {
  const norm = ['A', 'B', 'C', 'LEGACY'].includes(mode) ? mode : 'C';
  currentSceneMode = norm;
  ['A', 'B', 'C', 'LEGACY'].forEach(m => {
    const btn = document.getElementById('scene-btn-' + m);
    if (btn) btn.classList.toggle('is-active', m === norm);
  });
  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.remove('scene-mode-A', 'scene-mode-B', 'scene-mode-C', 'scene-mode-LEGACY');
    vp.classList.add('scene-mode-' + norm);
  }
}

function setSceneMode(mode) {
  const norm = ['A', 'B', 'C', 'LEGACY'].includes(String(mode || 'C').toUpperCase())
    ? String(mode || 'C').toUpperCase()
    : 'C';
  syncSceneModeButtons(norm);

  // Instantaneous client-side switch using pre-resolved scenes payload
  if (currentState) {
    currentState.sceneMode = norm;
    if (currentState.viewportScene) {
      currentState.viewportScene.sceneMode = norm;
      if (currentState.viewportScene.scenes && currentState.viewportScene.scenes[norm]) {
        currentState.viewportScene.activeScene = currentState.viewportScene.scenes[norm];
      }
    }
    renderViewportScene(currentState);
    if (currentState.mode !== 'FALLEN') {
      renderViewportCenterStage(currentState);
    }
  }

  // Persist choice to sandbox server asynchronously
  fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'SET_SCENE_MODE', payload: { sceneMode: norm } })
  }).catch(() => {});
}

/* =========================================================================
   1B. PHASE 3: ATMOSPHERIC EFFECTS ENGINE (Off / Subtle ★ / Full)
   ========================================================================= */
function isReducedMotionPreferred() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function syncEffectsButtons(mode) {
  const norm = ['off', 'subtle', 'full'].includes(String(mode || 'subtle').toLowerCase())
    ? String(mode || 'subtle').toLowerCase()
    : 'subtle';
  currentEffectsMode = norm;
  ['off', 'subtle', 'full'].forEach(m => {
    const btn = document.getElementById('fx-btn-' + m);
    if (btn) btn.classList.toggle('is-active', m === norm);
  });
}

function stopAtmosphericParticleLoop() {
  atmoParticles = [];
  if (atmoAnimFrameId) {
    cancelAnimationFrame(atmoAnimFrameId);
    atmoAnimFrameId = null;
  }
  const canvas = document.getElementById('fp-atmo-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function setAtmosphericEffectsMode(mode) {
  syncEffectsButtons(mode);
  const norm = currentEffectsMode;

  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.remove('fx-mode-off', 'fx-mode-subtle', 'fx-mode-full');
    vp.classList.add('fx-mode-' + norm);
  }

  if (currentState) {
    syncAtmosphericEffects(currentState);
  }
}

function syncAtmosphericEffects(state) {
  const vp = document.getElementById('fp-viewport');
  const atmoLayer = document.getElementById('fp-atmosphere-layer');
  const pulseLayer = document.getElementById('fp-light-pulse-layer');
  const canvas = document.getElementById('fp-atmo-canvas');
  if (!vp || !atmoLayer) return;

  vp.classList.remove('fx-mode-off', 'fx-mode-subtle', 'fx-mode-full');
  vp.classList.add('fx-mode-' + currentEffectsMode);

  const scene = state && state.viewportScene;
  const mode = (state && state.sceneMode) || currentSceneMode || 'C';
  const activeScene = (scene && scene.scenes && scene.scenes[mode]) || (scene && scene.activeScene) || {};
  const profile = activeScene.effectProfile || (scene && scene.effectProfile) || {
    profileKey: 'forest-deep',
    mistColor: 'rgba(155, 190, 168, 0.14)',
    mistOpacity: 0.15,
    mistSpeedSec: 34,
    lightPulseColor: 'rgba(120, 175, 135, 0.08)',
    lightPulseStyle: 'canopy-breathe',
    particleType: 'spores',
    particleColor: 'rgba(188, 225, 195, 0.52)',
    particleCountSubtle: 11,
    particleCountFull: 24,
    particleSpeed: 0.35,
    windDriftX: 0.12
  };

  activeEffectProfile = profile;
  const mult = currentEffectsMode === 'full' ? 1.45 : (currentEffectsMode === 'subtle' ? 1.0 : 0);
  const mistOp = Math.min(0.32, (Number(profile.mistOpacity || 0.14) * mult)).toFixed(3);
  const speedBack = Math.max(16, Math.round((Number(profile.mistSpeedSec || 32)) / (currentEffectsMode === 'full' ? 1.2 : 1.0)));
  const speedFront = Math.max(12, Math.round(speedBack * 0.78));

  atmoLayer.style.setProperty('--mist-color', profile.mistColor || 'rgba(165, 195, 180, 0.14)');
  atmoLayer.style.setProperty('--mist-opacity', mistOp);
  atmoLayer.style.setProperty('--mist-duration-back', `${speedBack}s`);
  atmoLayer.style.setProperty('--mist-duration-front', `${speedFront}s`);

  if (pulseLayer) {
    pulseLayer.className = `fp-light-pulse-layer pulse-${profile.lightPulseStyle || 'canopy-breathe'}`;
    pulseLayer.style.setProperty('--pulse-color', profile.lightPulseColor || 'rgba(120, 175, 135, 0.08)');
    pulseLayer.style.setProperty('--pulse-opacity', currentEffectsMode === 'full' ? '1' : '0.72');
  }

  // Re-seed particle pool for canvas
  if (!canvas || currentEffectsMode === 'off' || isReducedMotionPreferred() || mode === 'LEGACY') {
    atmoParticles = [];
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  const targetCount = currentEffectsMode === 'full'
    ? Number(profile.particleCountFull || 20)
    : Number(profile.particleCountSubtle || 9);

  const rect = canvas.getBoundingClientRect();
  const cw = Math.max(320, Math.round(rect.width || 800));
  const ch = Math.max(220, Math.round(rect.height || 500));
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }

  atmoParticles = [];
  for (let i = 0; i < targetCount; i++) {
    const pType = profile.particleType || 'spores';
    const isEmber = pType === 'embers';
    const isWind = pType === 'dust-wind';
    atmoParticles.push({
      x: Math.random() * cw,
      y: Math.random() * ch,
      r: isEmber ? (1.2 + Math.random() * 1.6) : (isWind ? (1.0 + Math.random() * 1.4) : (1.3 + Math.random() * 2.1)),
      vx: (Number(profile.windDriftX || 0.15) * (0.65 + Math.random() * 0.7)) * (currentEffectsMode === 'full' ? 1.25 : 0.85),
      vy: isEmber
        ? -(0.22 + Math.random() * 0.38)
        : ((Math.random() - 0.46) * Number(profile.particleSpeed || 0.35)),
      phase: Math.random() * Math.PI * 2,
      alphaBase: 0.24 + Math.random() * 0.44
    });
  }

  if (!atmoAnimFrameId) {
    atmoAnimFrameId = requestAnimationFrame(stepAtmosphericParticles);
  }
}

function stepAtmosphericParticles(ts) {
  if (currentEffectsMode === 'off' || isReducedMotionPreferred() || atmoParticles.length === 0) {
    atmoAnimFrameId = null;
    return;
  }
  // Throttle to ~30fps for ultra-low CPU/GPU footprint
  if (ts - atmoLastTick < 32) {
    atmoAnimFrameId = requestAnimationFrame(stepAtmosphericParticles);
    return;
  }
  atmoLastTick = ts;

  const canvas = document.getElementById('fp-atmo-canvas');
  if (!canvas) {
    atmoAnimFrameId = null;
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    atmoAnimFrameId = null;
    return;
  }

  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  const colorStr = (activeEffectProfile && activeEffectProfile.particleColor) || 'rgba(188, 225, 195, 0.52)';
  ctx.fillStyle = colorStr;

  for (let i = 0; i < atmoParticles.length; i++) {
    const p = atmoParticles[i];
    p.phase += 0.04;
    p.x += p.vx + Math.sin(p.phase) * 0.18;
    p.y += p.vy + Math.cos(p.phase * 0.8) * 0.10;

    if (p.x > cw + 8) p.x = -6;
    if (p.x < -8) p.x = cw + 6;
    if (p.y > ch + 8) p.y = -6;
    if (p.y < -8) p.y = ch + 6;

    const pulseAlpha = Math.max(0.08, Math.min(0.85, p.alphaBase + Math.sin(p.phase) * 0.16));
    ctx.globalAlpha = pulseAlpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  atmoAnimFrameId = requestAnimationFrame(stepAtmosphericParticles);
}

/* =========================================================================
   2. API DISPATCHER & SEQUENCE MANAGEMENT
   ========================================================================= */
function cancelActiveCombatSequence() {
  if (activeSequenceTimers.length > 0) {
    activeSequenceTimers.forEach(t => clearTimeout(t));
    activeSequenceTimers = [];
  }
  isSequencePlaying = false;
}

async function fetchInitialState() {
  cancelActiveCombatSequence();
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data && data.state) {
      renderGameState(data.state, { skipSequence: true });
    }
  } catch (err) {
    console.error('Failed to load initial state:', err);
  }
}

async function dispatchAction(action, payload = {}) {
  if (isBusy) return;

  // If a combat beat animation is still playing and the player acts again,
  // snap the previous state to completion cleanly before sending the next request
  if (isSequencePlaying) {
    cancelActiveCombatSequence();
    if (currentState) {
      renderGameState(currentState, { skipSequence: true });
    }
  }

  isBusy = true;

  if (action !== 'FLEE') {
    fleeConfirmArmed = false;
  }

  // Attach expectedRound on combat actions to prevent accidental double-submits
  if ((action === 'ATTACK' || action === 'POTION' || action === 'FLEE') &&
      currentState && currentState.encounter && currentState.encounter.status === 'IN_COMBAT') {
    payload = {
      ...payload,
      expectedRound: currentState.encounter.combat_round
    };
  }

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
      if (backdrop && !backdrop.hidden && currentOpenModal) {
        renderModalContent(currentOpenModal);
      }
    }
  } catch (err) {
    console.error('Action error:', err);
  } finally {
    isBusy = false;
  }
}

function dispatchTurn(turn) {
  if (!currentState || currentState.mode === 'FALLEN') return Promise.resolve();
  isPoiPlaqueOpen = false;
  return dispatchAction('TURN', { turn });
}

function dispatchRelativeMove(relative) {
  if (!currentState || currentState.mode === 'FALLEN') return Promise.resolve();
  isPoiPlaqueOpen = false;
  const relMoves = (currentState.viewportScene && currentState.viewportScene.relativeMoves) || {};
  const mInfo = relMoves[relative];
  const direction = mInfo && mInfo.cardinal ? mInfo.cardinal : undefined;
  return dispatchAction('MOVE', { relative, direction });
}

function dispatchMove(direction) {
  if (!currentState || currentState.mode === 'FALLEN') return Promise.resolve();
  isPoiPlaqueOpen = false;
  return dispatchAction('MOVE', { direction });
}

function triggerLabScenario(scenario, monsterName = null) {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  isPoiPlaqueOpen = false;
  expandedDiscoveryKey = null;
  return dispatchAction('LAB_SCENARIO', {
    scenario,
    monsterName,
    preserveFacing: Boolean(monsterName)
  });
}

function triggerTeleport(x, y, facing = 'NORTH') {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  isPoiPlaqueOpen = false;
  expandedDiscoveryKey = null;
  return dispatchAction('TELEPORT_TO_TILE', { x, y, facing });
}

function triggerInspectPoi() {
  if (!currentState || !currentState.viewportScene || !currentState.viewportScene.pointOfInterest) {
    return Promise.resolve();
  }
  if (isPoiPlaqueOpen) {
    isPoiPlaqueOpen = false;
    renderTopBarAndDeckSnapshot(currentState);
    renderViewportCenterStage(currentState);
    return Promise.resolve();
  }
  isPoiPlaqueOpen = true;
  return dispatchAction('INSPECT_POI');
}

function closePoiPlaque() {
  isPoiPlaqueOpen = false;
  if (currentState) {
    renderTopBarAndDeckSnapshot(currentState);
    renderViewportCenterStage(currentState);
  }
}

function triggerClassSwitch(classType) {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  isPoiPlaqueOpen = false;
  expandedDiscoveryKey = null;
  return dispatchAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType });
}

/* =========================================================================
   2B. ADVENTURE EXPERIENCE — EXPERIMENTAL DISPATCHERS (Phases 3, 5, 6, 8, 9)
   ========================================================================= */
function setAdventureExperienceMode(enabled) {
  expandedDiscoveryKey = null;
  return dispatchAction('SET_ADVENTURE_MODE', { enabled: Boolean(enabled) });
}

function startExpeditionRoute(expeditionKey = 'MIRKWOOD_EXPEDITION') {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  isPoiPlaqueOpen = false;
  expandedDiscoveryKey = null;
  return dispatchAction('START_EXPEDITION', { expeditionKey });
}

function resetExpeditionRoute() {
  closeLabModal();
  cancelActiveCombatSequence();
  clearTransientFloatingPopups();
  isPoiPlaqueOpen = false;
  expandedDiscoveryKey = null;
  const expKey = (currentState && currentState.adventure && currentState.adventure.expeditionKey) || 'MIRKWOOD_EXPEDITION';
  return dispatchAction('RESET_EXPEDITION', { expeditionKey: expKey });
}

function expandDiscoveryCard(discoveryKey) {
  expandedDiscoveryKey = discoveryKey || (currentState && currentState.adventure && currentState.adventure.activeDiscovery && currentState.adventure.activeDiscovery.id) || true;
  if (currentState) {
    renderAdventureOverlays(currentState);
  }
}

function resolveDiscoveryChoiceClick(discoveryKey, choiceKey) {
  expandedDiscoveryKey = null;
  return dispatchAction('RESOLVE_DISCOVERY_CHOICE', { discoveryKey, discoveryId: discoveryKey, choiceKey, choiceId: choiceKey });
}

function dismissActiveDiscovery() {
  expandedDiscoveryKey = null;
  return dispatchAction('DISMISS_DISCOVERY');
}

function forceTriggerDiscovery(discoveryId = null) {
  closeLabModal();
  expandedDiscoveryKey = null;
  return dispatchAction('FORCE_DISCOVERY', { discoveryId, discoveryKey: discoveryId });
}

function setDeterministicSeed(seed) {
  return dispatchAction('SET_DETERMINISTIC_SEED', { seed: Number(seed || 4201) });
}

/* =========================================================================
   3. VISUAL FX ENGINE (Directional Motion, Combat Slashes, Deduplicated Popups)
   ========================================================================= */
function triggerWeaponStrikeEffect(isCrit = false) {
  const svg = document.getElementById('fp-slash-svg');
  const actor = document.getElementById('fp-monster-actor');
  if (svg) {
    svg.classList.remove('is-striking');
    void svg.offsetWidth;
    svg.classList.add('is-striking');
  }
  if (actor) {
    actor.classList.remove('anim-monster-hit', 'anim-monster-crit-hit', 'anim-monster-dodge');
    void actor.offsetWidth;
    actor.classList.add(isCrit ? 'anim-monster-crit-hit' : 'anim-monster-hit');
  }
}

function triggerMonsterDodgeEffect() {
  const actor = document.getElementById('fp-monster-actor');
  if (actor) {
    actor.classList.remove('anim-monster-hit', 'anim-monster-crit-hit', 'anim-monster-dodge');
    void actor.offsetWidth;
    actor.classList.add('anim-monster-dodge');
  }
}

function triggerMonsterLungeEffect() {
  const actor = document.getElementById('fp-monster-actor');
  if (actor) {
    actor.classList.remove('anim-monster-lunge');
    void actor.offsetWidth;
    actor.classList.add('anim-monster-lunge');
  }
}

function clearTransientFloatingPopups() {
  const container = document.getElementById('fp-floating-pop-container');
  if (!container) return;
  container.innerHTML = '';
}

function spawnFloatingPopup(text, styleClass = 'pop-strike') {
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

function flashViewportOverlay(type) {
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

function playViewportMotionClass(animClass) {
  const backdrop = document.getElementById('fp-scene-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove(
    'step-anim',
    'anim-step-forward',
    'anim-step-backward',
    'anim-strafe-left',
    'anim-strafe-right',
    'anim-turn-left',
    'anim-turn-right',
    'anim-blocked-bump'
  );
  void backdrop.offsetWidth;
  backdrop.classList.add(animClass);
}

function handleFxCue(fxCue) {
  if (!fxCue) return;

  if (fxCue.type === 'TURN') {
    playViewportMotionClass(fxCue.turn === 'LEFT' ? 'anim-turn-left' : 'anim-turn-right');
  } else if (fxCue.type === 'STEP' || fxCue.type === 'ENCOUNTER_DISCOVERED') {
    expandedDiscoveryKey = null;
    const rel = fxCue.relativeMove || 'FORWARD';
    const animMap = {
      FORWARD: 'anim-step-forward',
      BACKWARD: 'anim-step-backward',
      STRAFE_LEFT: 'anim-strafe-left',
      STRAFE_RIGHT: 'anim-strafe-right'
    };
    playViewportMotionClass(animMap[rel] || 'anim-step-forward');
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
    spawnFloatingPopup('⛔ Blocked', 'pop-miss');
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
    isPoiPlaqueOpen = true;
    if (currentState) {
      renderTopBarAndDeckSnapshot(currentState);
      renderViewportCenterStage(currentState);
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

/* =========================================================================
   4. DETERMINISTIC MAP-CONNECTED VIEWPORT RENDERER
   ========================================================================= */
function seededUnit(seed, salt) {
  let h = (seed ^ (salt * 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function preloadAdjacentSceneImages(scene) {
  if (!scene) return;
  const urls = [];
  if (scene.current && scene.current.imageUrl) urls.push(scene.current.imageUrl);
  if (scene.ahead1 && scene.ahead1.imageUrl) urls.push(scene.ahead1.imageUrl);
  if (scene.left1 && scene.left1.imageUrl) urls.push(scene.left1.imageUrl);
  if (scene.right1 && scene.right1.imageUrl) urls.push(scene.right1.imageUrl);
  if (scene.behind1 && scene.behind1.imageUrl) urls.push(scene.behind1.imageUrl);
  if (scene.scenes) {
    if (scene.scenes.A && scene.scenes.A.imageUrl) urls.push(scene.scenes.A.imageUrl);
    if (scene.scenes.B && scene.scenes.B.imageUrl) urls.push(scene.scenes.B.imageUrl);
    if (scene.scenes.C && scene.scenes.C.imageUrl) urls.push(scene.scenes.C.imageUrl);
    if (scene.scenes.LEGACY && scene.scenes.LEGACY.imageUrl) urls.push(scene.scenes.LEGACY.imageUrl);
  }
  if (Array.isArray(scene.preloadUrls)) {
    scene.preloadUrls.forEach(u => {
      if (u) urls.push(u);
    });
  }
  urls.forEach(u => {
    if (u && !preloadedImageUrls.has(u)) {
      preloadedImageUrls.add(u);
      const img = new Image();
      img.src = u;
    }
  });
}

function applySceneImageWithCrossfade(terrainImg, prevImg, targetUrl, objectPos, transformStr, filterStr) {
  if (!terrainImg || !targetUrl) return;
  const currentSrc = terrainImg.getAttribute('src');

  // Phase 2.1 Fix: Hold the previous loaded image in #fp-terrain-img-prev at opacity 1
  // while #fp-terrain-img fetches & decodes the new image, preventing any black frame flash.
  if (currentSrc && currentSrc !== targetUrl) {
    const swapToken = ++latestSceneImageSwapToken;
    if (prevImg && terrainImg.complete && terrainImg.naturalWidth > 0) {
      prevImg.setAttribute('src', currentSrc);
      prevImg.style.objectPosition = terrainImg.style.objectPosition || objectPos;
      prevImg.style.transform = terrainImg.style.transform || transformStr;
      prevImg.style.filter = terrainImg.style.filter || filterStr;
      prevImg.style.opacity = '1';
    }

    terrainImg.setAttribute('src', targetUrl);
    terrainImg.style.objectPosition = objectPos;
    terrainImg.style.transform = transformStr;
    terrainImg.style.filter = filterStr;

    const finalizeSwap = () => {
      if (swapToken !== latestSceneImageSwapToken) return;
      if (prevImg) {
        prevImg.style.opacity = '0';
      }
      terrainImg.classList.remove('is-crossfading');
    };

    const decodePromise = (typeof terrainImg.decode === 'function')
      ? terrainImg.decode().catch(() => {})
      : new Promise(resolve => {
          if (terrainImg.complete) return resolve();
          terrainImg.addEventListener('load', resolve, { once: true });
          terrainImg.addEventListener('error', resolve, { once: true });
        });

    window.__sceneImageDecodePromise = decodePromise.then(() => {
      finalizeSwap();
    });
    return;
  }

  if (currentSrc !== targetUrl) {
    terrainImg.setAttribute('src', targetUrl);
  }
  if (prevImg) {
    prevImg.style.opacity = '0';
  }
  terrainImg.style.objectPosition = objectPos;
  terrainImg.style.transform = transformStr;
  terrainImg.style.filter = filterStr;
}

window.__waitForSceneReady = async function () {
  if (window.__sceneImageDecodePromise) {
    try {
      await window.__sceneImageDecodePromise;
    } catch {}
  }
  const terrainImg = document.getElementById('fp-terrain-img');
  if (terrainImg) {
    if (!terrainImg.complete) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1500);
        terrainImg.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
        terrainImg.addEventListener('error', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    if (typeof terrainImg.decode === 'function') {
      try {
        await terrainImg.decode();
      } catch {}
    }
  }
  const prevImg = document.getElementById('fp-terrain-img-prev');
  if (prevImg) {
    prevImg.style.opacity = '0';
  }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return {
    src: terrainImg ? terrainImg.getAttribute('src') : null,
    complete: Boolean(terrainImg && terrainImg.complete),
    naturalWidth: terrainImg ? terrainImg.naturalWidth : 0,
    naturalHeight: terrainImg ? terrainImg.naturalHeight : 0
  };
};

function renderViewportScene(state) {
  const scene = state.viewportScene;
  if (!scene) return;

  const seed = scene.seed || 1;
  const current = scene.current;
  const ahead1 = scene.ahead1;
  const left1 = scene.left1;
  const right1 = scene.right1;
  const facing = state.facing || 'NORTH';
  const fMeta = FACING_META[facing] || FACING_META.NORTH;

  const mode = ['A', 'B', 'C', 'LEGACY'].includes(state.sceneMode)
    ? state.sceneMode
    : (['A', 'B', 'C', 'LEGACY'].includes(scene.sceneMode) ? scene.sceneMode : currentSceneMode);
  syncSceneModeButtons(mode);
  preloadAdjacentSceneImages(scene);

  const activeScene = (scene.scenes && scene.scenes[mode]) || scene.activeScene || null;

  // 1. Update Top Viewport Facing, Scene Mode Badge, Caption & Field-of-View Badges
  const facingPill = document.getElementById('fp-facing-pill');
  if (facingPill) {
    facingPill.textContent = `🧭 ${fMeta.short} ${fMeta.arrow}`;
    facingPill.title = `${fMeta.label} (${facing})`;
  }

  const modeTag = document.getElementById('fp-scene-mode-tag');
  if (modeTag) {
    modeTag.classList.remove('is-fp-dedicated', 'is-fp-fallback');
    if (mode === 'A') {
      modeTag.textContent = 'Scene A: Single';
    } else if (mode === 'B') {
      modeTag.textContent = 'Scene B: Directional';
    } else if (mode === 'C') {
      const povTier = activeScene && activeScene.povTier ? Number(activeScene.povTier) : 1;
      if (povTier === 1) {
        modeTag.textContent = 'Scene C • Tier 1 Exact POV';
        modeTag.classList.add('is-fp-dedicated');
      } else if (povTier === 2) {
        modeTag.textContent = 'Scene C • Tier 2 Landmark POV';
        modeTag.classList.add('is-fp-dedicated');
      } else if (povTier === 3) {
        modeTag.textContent = 'Scene C • Tier 3 Context POV';
        modeTag.classList.add('is-fp-dedicated');
      } else if (povTier === 4) {
        modeTag.textContent = 'Scene C • Tier 4 Generic POV';
        modeTag.classList.add('is-fp-fallback');
      } else {
        modeTag.textContent = 'Scene C • Tier 5 Safe POV';
        modeTag.classList.add('is-fp-fallback');
      }
      modeTag.title = (activeScene && activeScene.povTierLabel) || 'Mode C 5-Tier POV Selection';
    } else {
      modeTag.textContent = 'Legacy: Blended+SVG';
    }
  }

  const captionLine = document.getElementById('fp-scene-caption-line');
  if (captionLine && activeScene) {
    captionLine.textContent = activeScene.viewTitle || current.name;
    captionLine.title = activeScene.viewSubtitle || '';
  }

  const fovLeft = document.getElementById('fp-fov-left');
  const fovAhead = document.getElementById('fp-fov-ahead');
  const fovRight = document.getElementById('fp-fov-right');

  if (fovLeft && left1) {
    fovLeft.textContent = `◀ ${left1.direction[0]}: ${left1.name}${left1.isPassable ? '' : ' (Blocked)'}`;
  }
  if (fovAhead && ahead1) {
    fovAhead.textContent = `▲ ${ahead1.direction[0]}: ${ahead1.name}${ahead1.isPassable ? '' : ' (Blocked)'}`;
    fovAhead.classList.toggle('is-blocked', !ahead1.isPassable);
  }
  if (fovRight && right1) {
    fovRight.textContent = `▶ ${right1.direction[0]}: ${right1.name}${right1.isPassable ? '' : ' (Blocked)'}`;
  }

  const terrainImg = document.getElementById('fp-terrain-img');
  const prevImg = document.getElementById('fp-terrain-img-prev');
  const atmoLayer = document.getElementById('fp-atmosphere-layer');
  const aheadPortal = document.getElementById('fp-ahead-portal');
  const aheadImg = document.getElementById('fp-ahead-img');
  const flankLeft = document.getElementById('fp-flank-left');
  const flankRight = document.getElementById('fp-flank-right');
  const svgWrap = document.getElementById('fp-scene-svg-wrap');

  // =========================================================================
  // COHESIVE SINGLE-PAINTING MODES (MODE A, MODE B & MODE C: FIRST-PERSON)
  // Zero multi-image portal blending. Zero geometric SVG overlays.
  // =========================================================================
  if (mode === 'A' || mode === 'B' || mode === 'C') {
    const targetUrl = (activeScene && activeScene.imageUrl) || (current && current.imageUrl);
    const focalX = activeScene && typeof activeScene.focalX === 'number' ? activeScene.focalX : 50;
    const focalY = activeScene && typeof activeScene.focalY === 'number' ? activeScene.focalY : 45;
    const panX = activeScene && typeof activeScene.panX === 'number' ? activeScene.panX : 0;
    const panY = activeScene && typeof activeScene.panY === 'number' ? activeScene.panY : 0;

    applySceneImageWithCrossfade(
      terrainImg,
      prevImg,
      targetUrl,
      `${focalX}% ${focalY}%`,
      `translate(${panX}%, ${panY}%)`,
      'brightness(0.92) contrast(1.04) saturate(0.98)'
    );

    if (atmoLayer) {
      atmoLayer.style.display = 'block';
      atmoLayer.style.setProperty('--scene-lighting-tint', (activeScene && activeScene.lightingTint) || 'rgba(14, 18, 26, 0.08)');
      atmoLayer.className = `fp-atmosphere-layer horizon-${(activeScene && activeScene.horizonGlow) || 'none'}`;
    }
    syncAtmosphericEffects(state);

    if (aheadPortal) {
      aheadPortal.classList.remove('is-visible', 'is-blocked-ahead');
    }
    if (svgWrap) {
      svgWrap.innerHTML = '';
    }

    applyFlankClass(flankLeft, left1);
    applyFlankClass(flankRight, right1);
    return;
  }

  // =========================================================================
  // LEGACY MODE (Preserved for Side-by-Side Comparison)
  // =========================================================================
  if (atmoLayer) {
    atmoLayer.style.display = 'none';
  }
  stopAtmosphericParticleLoop();

  const legacyCurrentUrl = (current && (current.legacyImageUrl || current.imageUrl)) || '/images/terrain/terrain_fallback.webp';
  const facingPanMap = { NORTH: -4.5, EAST: 1.8, SOUTH: 4.5, WEST: -1.8 };
  const basePanX = facingPanMap[facing] || 0;
  const shiftX = (basePanX + (seededUnit(seed, 1) - 0.5) * 6).toFixed(1);
  const shiftY = ((seededUnit(seed, 2) - 0.5) * 4).toFixed(1);
  const posX = (42 + seededUnit(seed, 1) * 16).toFixed(1);
  const posY = (46 + seededUnit(seed, 2) * 8).toFixed(1);
  const bright = (0.80 + seededUnit(seed, 3) * 0.10).toFixed(2);

  applySceneImageWithCrossfade(
    terrainImg,
    prevImg,
    legacyCurrentUrl,
    `${posX}% ${posY}%`,
    `translate(${shiftX}%, ${shiftY}%)`,
    `brightness(${bright}) contrast(1.06) saturate(0.95)`
  );

  if (aheadPortal && aheadImg && ahead1) {
    const showPortal = scene.isTerrainTransitionAhead || scene.isAheadBlocked || ahead1.terrain === 'CITY' || ahead1.terrain === 'TOWN';
    aheadPortal.classList.toggle('is-visible', Boolean(showPortal));
    aheadPortal.classList.toggle('is-blocked-ahead', !ahead1.isPassable);
    const legacyAheadUrl = ahead1.legacyImageUrl || ahead1.imageUrl;
    if (legacyAheadUrl && aheadImg.getAttribute('src') !== legacyAheadUrl) {
      aheadImg.setAttribute('src', legacyAheadUrl);
    }
    const aPosX = (45 + seededUnit(seed, 4) * 10).toFixed(1);
    aheadImg.style.objectPosition = `${aPosX}% 50%`;
  }

  applyFlankClass(flankLeft, left1);
  applyFlankClass(flankRight, right1);

  if (svgWrap) {
    svgWrap.innerHTML = buildMapConnectedSceneSvg(scene, state);
  }
}

function applyFlankClass(el, tileInfo) {
  if (!el || !tileInfo) return;
  el.classList.remove('flank-blocked-rock', 'flank-blocked-water', 'flank-blocked-mire', 'flank-open-pass');
  if (!tileInfo.isPassable) {
    if (tileInfo.terrain === 'RIVER_LAKE' || tileInfo.terrain === 'OCEAN') {
      el.classList.add('flank-blocked-water');
    } else if (tileInfo.terrain === 'SWAMP') {
      el.classList.add('flank-blocked-mire');
    } else {
      el.classList.add('flank-blocked-rock');
    }
  } else {
    el.classList.add('flank-open-pass');
  }
}

function buildMapConnectedSceneSvg(scene, state = null) {
  const seed = scene.seed || 1;
  const current = scene.current;
  const ahead1 = scene.ahead1;
  const ahead2 = scene.ahead2;
  const left1 = scene.left1;
  const right1 = scene.right1;
  const isInCombatOrEncounter = Boolean(
    state && (state.encounter || state.victory)
  );

  const vanishX = Math.round(485 + (seededUnit(seed, 10) - 0.5) * 30);
  const horizonY = 295;

  const parts = [];

  // A. Distant Horizon Silhouette (ahead2 / ahead1 terrain contour)
  const distTerrain = (ahead1 && !ahead1.isPassable) ? ahead1.terrain : (ahead2 ? ahead2.terrain : current.terrain);
  if (distTerrain === 'MOUNTAINS' || distTerrain === 'WORLD_EDGE') {
    parts.push(`
      <polygon points="80,${horizonY} 210,175 340,235 490,145 640,220 780,165 920,${horizonY}"
               fill="rgba(14, 17, 24, 0.78)" stroke="rgba(148, 163, 184, 0.22)" stroke-width="1.5"/>
    `);
  } else if (distTerrain === 'CITY' || distTerrain === 'TOWN') {
    parts.push(`
      <g fill="rgba(12, 15, 21, 0.82)" stroke="rgba(197, 160, 89, 0.28)" stroke-width="1.2">
        <rect x="${vanishX - 95}" y="205" width="32" height="90"/>
        <polygon points="${vanishX - 100},205 ${vanishX - 79},175 ${vanishX - 58},205"/>
        <rect x="${vanishX - 55}" y="228" width="110" height="67"/>
        <rect x="${vanishX + 58}" y="205" width="32" height="90"/>
        <polygon points="${vanishX + 53},205 ${vanishX + 74},175 ${vanishX + 95},205"/>
      </g>
    `);
  }

  // B. Side Branch Paths (Left & Right Passable Openings)
  if (left1 && left1.isPassable) {
    parts.push(`
      <polygon points="0,425 0,355 ${vanishX - 75},325 ${vanishX - 135},395"
               fill="rgba(36, 32, 26, 0.45)" stroke="rgba(197, 160, 89, 0.18)" stroke-width="1"/>
    `);
  } else if (left1 && !left1.isPassable) {
    parts.push(buildSideObstacleSvg('LEFT', left1, seed));
  }

  if (right1 && right1.isPassable) {
    parts.push(`
      <polygon points="1000,425 1000,355 ${vanishX + 75},325 ${vanishX + 135},395"
               fill="rgba(36, 32, 26, 0.45)" stroke="rgba(197, 160, 89, 0.18)" stroke-width="1"/>
    `);
  } else if (right1 && !right1.isPassable) {
    parts.push(buildSideObstacleSvg('RIGHT', right1, seed));
  }

  // C. Forward Path OR Forward Impassable Barrier
  if (ahead1 && ahead1.isPassable) {
    const isPaved = current.terrain === 'HIGH_ROAD' || current.terrain === 'CITY' || current.terrain === 'TOWN' ||
                    ahead1.terrain === 'HIGH_ROAD' || ahead1.terrain === 'CITY' || ahead1.terrain === 'TOWN';
    const isBridge = (current.name && current.name.includes('Bridge')) || (ahead1.name && ahead1.name.includes('Bridge'));
    const pathFill = isPaved ? 'rgba(54, 49, 43, 0.56)' : 'rgba(38, 33, 25, 0.52)';
    const edgeStroke = isPaved ? 'rgba(197, 160, 89, 0.38)' : 'rgba(148, 126, 88, 0.26)';

    parts.push(`
      <polygon points="230,600 ${vanishX - 58},${horizonY} ${vanishX + 58},${horizonY} 770,600"
               fill="${pathFill}" stroke="${edgeStroke}" stroke-width="2"/>
    `);

    // Perspective stepping stones / road lines
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const y = Math.round(horizonY + (600 - horizonY) * (t * t));
      const halfW = Math.round(58 + (270 - 58) * (t * t));
      parts.push(`
        <line x1="${vanishX - halfW}" y1="${y}" x2="${vanishX + halfW}" y2="${y}"
              stroke="rgba(215, 195, 155, ${0.10 + t * 0.12})" stroke-width="${1 + t * 1.5}" stroke-dasharray="${isPaved ? '18 8' : '10 14'}"/>
      `);
    }

    // Bridge parapets if looking across or standing on the Stone Bridge
    if (isBridge) {
      parts.push(`
        <g fill="rgba(42, 46, 54, 0.85)" stroke="rgba(197, 160, 89, 0.45)" stroke-width="1.5">
          <polygon points="205,600 245,600 ${vanishX - 54},${horizonY} ${vanishX - 72},${horizonY}"/>
          <polygon points="755,600 795,600 ${vanishX + 72},${horizonY} ${vanishX + 54},${horizonY}"/>
        </g>
      `);
    }
  } else if (ahead1 && !ahead1.isPassable && !isInCombatOrEncounter) {
    parts.push(buildForwardObstacleSvg(ahead1, vanishX, horizonY, seed));
  }

  // D. Seeded Foreground Silhouettes (Terrain-specific left/right props)
  parts.push(buildSeededForegroundPropsSvg(current.terrain, seed));

  // E. Subtle Compass Coordinate Watermark on Ground Plane
  parts.push(`
    <g opacity="0.55">
      <line x1="${vanishX}" y1="565" x2="${vanishX}" y2="590" stroke="rgba(197, 160, 89, 0.45)" stroke-width="1.5"/>
    </g>
  `);

  return `<svg class="fp-scene-svg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">${parts.join('')}</svg>`;
}

function buildSideObstacleSvg(side, tileInfo, seed) {
  const isLeft = side === 'LEFT';
  const jitter = Math.round(seededUnit(seed, isLeft ? 21 : 22) * 25);

  if (tileInfo.terrain === 'RIVER_LAKE' || tileInfo.terrain === 'OCEAN') {
    return isLeft
      ? `<polygon points="0,330 ${185 + jitter},345 140,600 0,600" fill="rgba(14, 42, 68, 0.65)" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1.5"/>`
      : `<polygon points="1000,330 ${815 - jitter},345 860,600 1000,600" fill="rgba(14, 42, 68, 0.65)" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1.5"/>`;
  }

  // Crag / cliff / world boundary wall on flank
  return isLeft
    ? `<polygon points="0,120 ${175 + jitter},240 ${210 + jitter},430 130,600 0,600" fill="rgba(16, 18, 23, 0.84)" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1.5"/>`
    : `<polygon points="1000,120 ${825 - jitter},240 ${790 - jitter},430 870,600 1000,600" fill="rgba(16, 18, 23, 0.84)" stroke="rgba(148, 163, 184, 0.25)" stroke-width="1.5"/>`;
}

function buildForwardObstacleSvg(ahead1, vanishX, horizonY, seed) {
  const label = escapeHtml(ahead1.name || 'Impassable Obstacle');
  if (ahead1.terrain === 'RIVER_LAKE' || ahead1.terrain === 'OCEAN') {
    return `
      <g class="fp-forward-obstacle-river">
        <polygon points="120,340 880,340 960,515 40,515"
                 fill="rgba(12, 38, 62, 0.82)" stroke="rgba(56, 189, 248, 0.45)" stroke-width="2"/>
        <line x1="190" y1="385" x2="810" y2="385" stroke="rgba(125, 211, 252, 0.35)" stroke-width="2" stroke-dasharray="28 16"/>
        <line x1="150" y1="435" x2="850" y2="435" stroke="rgba(125, 211, 252, 0.28)" stroke-width="2" stroke-dasharray="18 22"/>
        <!-- Warning Posts on Riverbank -->
        <rect x="330" y="310" width="12" height="85" fill="#2b2118" stroke="#c5a059" stroke-width="1"/>
        <rect x="658" y="310" width="12" height="85" fill="#2b2118" stroke="#c5a059" stroke-width="1"/>
        <rect x="${vanishX - 155}" y="348" width="310" height="34" rx="4" fill="rgba(9, 12, 16, 0.86)" stroke="rgba(56, 189, 248, 0.55)" stroke-width="1.5"/>
        <text x="${vanishX}" y="370" text-anchor="middle" fill="#bae6fd" font-family="Cinzel, serif" font-size="15" font-weight="700">
          🌊 BLOCKED AHEAD: ${label}
        </text>
      </g>
    `;
  }

  if (ahead1.terrain === 'SWAMP') {
    return `
      <g class="fp-forward-obstacle-mire">
        <polygon points="150,335 850,335 920,500 80,500"
                 fill="rgba(20, 33, 24, 0.85)" stroke="rgba(132, 204, 22, 0.4)" stroke-width="2"/>
        <path d="M 240,470 L 310,270 L 355,470 M 640,470 L 690,265 L 745,470"
              fill="none" stroke="rgba(68, 55, 38, 0.9)" stroke-width="8" stroke-linecap="round"/>
        <rect x="${vanishX - 155}" y="350" width="310" height="34" rx="4" fill="rgba(9, 12, 16, 0.88)" stroke="rgba(163, 230, 53, 0.5)" stroke-width="1.5"/>
        <text x="${vanishX}" y="372" text-anchor="middle" fill="#d9f99d" font-family="Cinzel, serif" font-size="15" font-weight="700">
          ☠️ IMPASSABLE MIRE: ${label}
        </text>
      </g>
    `;
  }

  // Default: Jagged Mountain Crag / Sheer Cliff / World Boundary
  const p1 = 155 + Math.round(seededUnit(seed, 31) * 35);
  const p2 = 130 + Math.round(seededUnit(seed, 32) * 30);
  const p3 = 160 + Math.round(seededUnit(seed, 33) * 35);
  return `
    <g class="fp-forward-obstacle-crag">
      <polygon points="145,455 240,${p1} 375,275 500,${p2} 635,270 765,${p3} 865,455"
               fill="rgba(17, 20, 26, 0.92)" stroke="rgba(239, 68, 68, 0.42)" stroke-width="2"/>
      <polyline points="240,${p1} 310,360 500,${p2} 610,375 765,${p3}"
                fill="none" stroke="rgba(148, 163, 184, 0.25)" stroke-width="2"/>
      <rect x="${vanishX - 165}" y="345" width="330" height="36" rx="4" fill="rgba(9, 12, 16, 0.9)" stroke="rgba(239, 68, 68, 0.6)" stroke-width="1.5"/>
      <text x="${vanishX}" y="368" text-anchor="middle" fill="#fca5a5" font-family="Cinzel, serif" font-size="15" font-weight="700">
        ⛰️ BLOCKED AHEAD: ${label}
      </text>
    </g>
  `;
}

function buildSeededForegroundPropsSvg(terrain, seed) {
  const props = [];
  const leftX = Math.round(70 + seededUnit(seed, 41) * 75);
  const rightX = Math.round(855 + seededUnit(seed, 42) * 75);
  const scaleL = (0.85 + seededUnit(seed, 43) * 0.35).toFixed(2);
  const scaleR = (0.85 + seededUnit(seed, 44) * 0.35).toFixed(2);

  if (terrain === 'FOREST') {
    props.push(`
      <g transform="translate(${leftX}, 560) scale(${scaleL})" fill="rgba(10, 16, 12, 0.86)" stroke="rgba(74, 222, 128, 0.18)" stroke-width="1.2">
        <rect x="-12" y="-220" width="24" height="220"/>
        <polygon points="-75,-150 0,-320 75,-150"/>
        <polygon points="-60,-230 0,-380 60,-230"/>
      </g>
      <g transform="translate(${rightX}, 565) scale(${scaleR})" fill="rgba(10, 16, 12, 0.86)" stroke="rgba(74, 222, 128, 0.18)" stroke-width="1.2">
        <rect x="-12" y="-220" width="24" height="220"/>
        <polygon points="-75,-150 0,-320 75,-150"/>
        <polygon points="-60,-230 0,-380 60,-230"/>
      </g>
    `);
  } else if (terrain === 'UNDERGROUND_RUINS' || terrain === 'SUNK_RUIN') {
    props.push(`
      <g transform="translate(${leftX}, 580) scale(${scaleL})" fill="rgba(18, 20, 26, 0.88)" stroke="rgba(197, 160, 89, 0.28)" stroke-width="1.5">
        <rect x="-26" y="-290" width="52" height="290"/>
        <rect x="-36" y="-310" width="72" height="24"/>
      </g>
      <g transform="translate(${rightX}, 580) scale(${scaleR})" fill="rgba(18, 20, 26, 0.88)" stroke="rgba(197, 160, 89, 0.28)" stroke-width="1.5">
        <rect x="-26" y="-250" width="52" height="250"/>
        <polygon points="-26,-250 0,-285 26,-250"/>
      </g>
    `);
  } else if (terrain === 'SWAMP') {
    props.push(`
      <g transform="translate(${leftX}, 585) scale(${scaleL})" stroke="rgba(132, 204, 22, 0.26)" stroke-width="3" fill="none">
        <path d="M -20,0 Q -35,-90 -10,-165 M 0,0 Q 15,-105 30,-175 M 18,0 Q 35,-70 48,-130"/>
      </g>
      <g transform="translate(${rightX}, 585) scale(${scaleR})" stroke="rgba(132, 204, 22, 0.26)" stroke-width="3" fill="none">
        <path d="M -20,0 Q -35,-90 -10,-165 M 0,0 Q 15,-105 30,-175 M 18,0 Q 35,-70 48,-130"/>
      </g>
    `);
  } else {
    // Milestones / Boulders for HIGH_ROAD, PLAINS, TOWN, CITY
    props.push(`
      <g transform="translate(${leftX}, 575) scale(${scaleL})" fill="rgba(22, 24, 30, 0.82)" stroke="rgba(197, 160, 89, 0.25)" stroke-width="1.3">
        <polygon points="-38,0 -28,-68 4,-85 32,-58 40,0"/>
      </g>
      <g transform="translate(${rightX}, 575) scale(${scaleR})" fill="rgba(22, 24, 30, 0.82)" stroke="rgba(197, 160, 89, 0.25)" stroke-width="1.3">
        <polygon points="-34,0 -22,-60 12,-76 35,-48 38,0"/>
      </g>
    `);
  }

  return props.join('');
}

/* =========================================================================
   5. SEQUENCED MULTI-BEAT COMBAT CHOREOGRAPHY (~380ms Beat Cadence)
   ========================================================================= */
const BEAT_INTERVAL_MS = 380;

function playCombatSequence(state) {
  const seq = state.combatSequence;
  if (!seq || !Array.isArray(seq.beats) || seq.beats.length === 0) {
    return false;
  }

  cancelActiveCombatSequence();
  isSequencePlaying = true;

  // Render initial pre-sequence frame so the monster remains on stage even if the final state is VICTORY
  renderCombatStagingFrame(state, seq);

  const beats = seq.beats;
  const displayedLogs = [];

  beats.forEach((beat, idx) => {
    const timer = setTimeout(() => {
      executeCombatBeatVisual(state, seq, beat, displayedLogs);
    }, idx * BEAT_INTERVAL_MS);
    activeSequenceTimers.push(timer);
  });

  // After all beats have played, settle into the authoritative server state
  const finalTimer = setTimeout(() => {
    isSequencePlaying = false;
    activeSequenceTimers = [];
    renderGameState(state, { skipSequence: true });
  }, beats.length * BEAT_INTERVAL_MS + 140);

  activeSequenceTimers.push(finalTimer);
  return true;
}

function resolveEnvironmentLightingGroup(state) {
  const mode = (state && state.sceneMode) || currentSceneMode || 'C';
  const scene = state && state.viewportScene;
  const activeScene = (scene && scene.scenes && scene.scenes[mode]) || (scene && scene.activeScene) || {};
  const atmo = String(activeScene.atmosphereProfile || '').toLowerCase();
  const terrain = String((state && state.currentTile && state.currentTile.terrain) || '').toUpperCase();

  if (atmo.includes('bridge') || atmo.includes('water') || terrain === 'BRIDGE') {
    return 'bridge';
  }
  if (atmo.includes('forest') || atmo.includes('oak') || atmo.includes('swamp') || atmo.includes('jungle') || terrain === 'FOREST') {
    return 'forest';
  }
  if (atmo.includes('sanctuary') || atmo.includes('gatehouse') || terrain === 'CITY') {
    return 'sanctuary';
  }
  return 'wilderness';
}

function buildCombatMonsterActorHtml(monster, state, { isSequenceFrame = false, initBracket = null, initCondText = null } = {}) {
  const bracketKey = initBracket || monster.conditionBracket || '5_uninjured';
  const condText = initCondText !== null ? initCondText : (monster.conditionText || '');
  const gemColor = getConditionColor(bracketKey);
  const isRanged = Boolean(state && state.combatStats && state.combatStats.isRangedActive);
  const weaponName = (state && state.combatStats && state.combatStats.activeWeapon && state.combatStats.activeWeapon.name) || 'Weapon';

  const wantsIntegrated = currentPresenceMode === 'integrated';
  const canUseIntegrated = Boolean(monster && monster.hasIntegratedCutout && monster.cutoutImageUrl);
  const isEffectiveIntegrated = wantsIntegrated && canUseIntegrated;
  const didFallbackToCard = wantsIntegrated && !canUseIntegrated;

  const vp = document.getElementById('fp-viewport');
  const envGroup = resolveEnvironmentLightingGroup(state);
  if (vp) {
    vp.classList.toggle('is-effective-integrated', isEffectiveIntegrated);
    vp.classList.toggle('is-effective-card', !isEffectiveIntegrated);
    vp.classList.remove('env-light-bridge', 'env-light-forest', 'env-light-sanctuary', 'env-light-wilderness');
    vp.classList.add(`env-light-${envGroup}`);
  }

  const profile = (monster && monster.integratedProfile) || {};
  const groundingMode = String(profile.groundingMode || (monster && monster.isAirborne ? 'AIRBORNE_HOVER' : 'GROUNDED')).toLowerCase();
  const sizeCategory = String(profile.sizeCategory || 'MEDIUM').toLowerCase();
  const scaleMult = Number(profile.scaleMultiplier || 1.0);
  const verticalOffsetPx = Number(profile.verticalOffsetPx || 0);
  const shadowWidthPct = Number(profile.shadowWidthPct || 72);
  const shadowBlurPx = Number(profile.shadowBlurPx || 9);
  const shadowOpacity = Number(profile.shadowOpacity || 0.64);

  const mode = (state && state.sceneMode) || currentSceneMode || 'C';
  const scene = state && state.viewportScene;
  const activeScene = (scene && scene.scenes && scene.scenes[mode]) || (scene && scene.activeScene) || {};
  const stageAnchor = activeScene.stageAnchor || {};
  const stageCenterX = typeof stageAnchor.stageCenterX === 'number' ? stageAnchor.stageCenterX : 50;
  const stageShiftX = Number((stageCenterX - 50).toFixed(1));
  const stageFloorY = typeof stageAnchor.stageFloorY === 'number' ? stageAnchor.stageFloorY : 82;
  const groundSurfaceType = stageAnchor.groundSurfaceType || 'wilderness-soil';
  const groundShadowTint = stageAnchor.groundShadowTint || 'rgba(8, 10, 12, 0.72)';

  const imgSrc = isEffectiveIntegrated
    ? monster.cutoutImageUrl
    : (monster.imageUrl || '/images/monsters/assassin_vine.png');

  const strikeSvg = isRanged
    ? `<svg id="fp-slash-svg" class="slash-svg" viewBox="0 0 200 200">
         <circle cx="100" cy="100" r="46" fill="none" stroke="#e6be6e" stroke-width="3" stroke-dasharray="10 6"/>
         <line x1="25" y1="175" x2="115" y2="85" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
         <polygon points="122,78 98,86 114,102" fill="#e6be6e"/>
       </svg>`
    : `<svg id="fp-slash-svg" class="slash-svg" viewBox="0 0 200 200">
         <path d="M 25 165 Q 95 85 178 28" fill="none" stroke="#c5a059" stroke-width="10" stroke-linecap="round" opacity="0.65"/>
         <path d="M 30 160 Q 100 90 175 32" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
       </svg>`;

  const adaptive = computeClientMonsterVisualScale(monster, state, isEffectiveIntegrated);
  const useAdaptiveScale = currentMonsterScaleMode === 'adaptive' && Boolean(adaptive);
  const pfSizeClass = adaptive ? `pf-size-${String(adaptive.pfSizeCategory || 'MEDIUM').toLowerCase()}` : 'pf-size-medium';
  const bodyProfClass = adaptive ? `profile-${String(adaptive.visualBodyProfile || 'BIPED_MEDIUM').toLowerCase()}` : 'profile-biped_medium';

  const actorClasses = [
    'fp-monster-actor',
    isEffectiveIntegrated ? 'is-integrated-monster' : 'is-card-monster',
    useAdaptiveScale ? 'is-adaptive-scale' : 'is-legacy-scale',
    `grounding-${groundingMode}`,
    `size-${sizeCategory}`,
    pfSizeClass,
    bodyProfClass,
    `env-grade-${envGroup}`,
    `surface-${groundSurfaceType}`
  ].join(' ');

  const effVisW = adaptive ? adaptive.visibleWidthPx : 220;
  const effVisH = adaptive ? adaptive.visibleHeightPx : 220;
  const trimScale = adaptive ? adaptive.transparencyCompensation.imageTrimScale : 1;
  const shiftXPct = adaptive ? adaptive.transparencyCompensation.imageShiftXPct : 0;
  const shiftYPct = adaptive ? adaptive.transparencyCompensation.imageShiftYPct : 0;
  const effShadowW = adaptive ? adaptive.shadow.shadowWidthPct : shadowWidthPct;
  const effShadowBlur = adaptive ? adaptive.shadow.shadowBlurPx : shadowBlurPx;
  const effShadowOp = adaptive ? adaptive.shadow.shadowOpacity : shadowOpacity;
  const effShadowWPx = adaptive ? adaptive.shadow.shadowWidthPx : 220;
  const effShadowHPx = adaptive ? adaptive.shadow.shadowHeightPx : 24;
  const effOffsetY = isEffectiveIntegrated
    ? verticalOffsetPx
    : (adaptive ? adaptive.positioning.verticalOffsetPx : 0);

  const inlineVars = useAdaptiveScale
    ? `--monster-vis-w:${effVisW}px; --monster-vis-h:${effVisH}px; --monster-img-trim-scale:${trimScale}; --monster-img-shift-x:${shiftXPct}%; --monster-img-shift-y:${shiftYPct}%; --monster-scale:1; --monster-offset-y:${effOffsetY}px; --stage-shift-x:${stageShiftX}%; --stage-floor-y:${stageFloorY}%; --shadow-width:${effShadowW}%; --shadow-width-px:${effShadowWPx}px; --shadow-height-px:${effShadowHPx}px; --shadow-blur:${effShadowBlur}px; --shadow-opacity:${effShadowOp}; --ground-shadow-tint:${groundShadowTint};`
    : (isEffectiveIntegrated
      ? `--monster-scale:${scaleMult}; --monster-offset-y:${verticalOffsetPx}px; --stage-shift-x:${stageShiftX}%; --stage-floor-y:${stageFloorY}%; --shadow-width:${shadowWidthPct}%; --shadow-blur:${shadowBlurPx}px; --shadow-opacity:${shadowOpacity}; --ground-shadow-tint:${groundShadowTint};`
      : '');

  let integratedRigHtml = '';
  if (isEffectiveIntegrated) {
    const amb = profile.ambientPatch || {
      leftPct: 50,
      topPct: monster.isAirborne ? 115 : 93,
      widthPct: shadowWidthPct,
      heightPct: 12,
      rotateDeg: 0,
      blurPx: shadowBlurPx,
      opacity: shadowOpacity * 0.65
    };
    const contacts = Array.isArray(profile.contactPatches) ? profile.contactPatches : [];
    const contactsHtml = contacts.map(cp => `
      <span class="fp-rig-contact-patch"
            data-contact-id="${escapeHtml(cp.id || 'pt')}"
            style="left:${Number(cp.leftPct || 50)}%; top:${Number(cp.topPct || 95)}%; width:${Number(cp.widthPct || 18)}%; height:${Number(cp.heightPct || 5.5)}%; transform:translate(-50%, -50%) rotate(${Number(cp.rotateDeg || 0)}deg); filter:blur(${Number(cp.blurPx || 3)}px); opacity:${Number(cp.opacity || 0.76)};"></span>
    `).join('');

    integratedRigHtml = `
      <div class="fp-integrated-grounding-rig surface-${escapeHtml(groundSurfaceType)}" aria-hidden="true">
        <span class="fp-rig-ambient-patch"
              style="left:${Number(amb.leftPct)}%; top:${Number(amb.topPct)}%; width:${Number(amb.widthPct)}%; height:${Number(amb.heightPct)}%; transform:translate(-50%, -50%) rotate(${Number(amb.rotateDeg || 0)}deg); filter:blur(${Number(amb.blurPx || 8)}px); opacity:${Number(amb.opacity || 0.44)};"></span>
        ${contactsHtml}
      </div>
    `;
  }

  const modeBadgeHtml = isEffectiveIntegrated
    ? `<span class="lab-badge badge-integrated-active" title="Rendered in-scene with alpha cutout, anatomical ground contact shadows & environment lighting">✦ In-Scene Cutout</span>`
    : (didFallbackToCard
      ? `<span class="lab-badge badge-card-fallback" title="No cutout asset found for this creature — safely fell back to Card mode">🛡️ Card Fallback</span>`
      : '');

  const bracketLabelMap = {
    '5_uninjured': 'Uninjured',
    '4_bruised': 'Bruised',
    '3_wounded': 'Bloodied',
    '2_critical': 'Grievously Wounded',
    '1_near_death': 'Near Death'
  };
  const bracketLabel = bracketLabelMap[bracketKey] || 'Engaged';
  const roundNum = Number(monster.combat_round || 1);
  const atkBonus = isRanged
    ? ((state && state.combatStats && state.combatStats.rangedAttackBonus) || '+0')
    : ((state && state.combatStats && state.combatStats.meleeAttackBonus) || '+0');

  const conditionBlockHtml = isSequenceFrame
    ? `<div class="fp-monster-condition-quote" id="seq-condition-quote">
         <span class="condition-gem" id="seq-condition-gem" style="background:${gemColor}; color:${gemColor};"></span>
         <span id="seq-condition-text">“${escapeHtml(condText || 'Engaged in melee!')}”</span>
       </div>`
    : (condText ? `
       <div class="fp-monster-condition-quote">
         <span class="condition-gem" style="background:${gemColor}; color:${gemColor};"></span>
         <span>“${escapeHtml(condText)}”</span>
       </div>
    ` : '');

  const tacticalReadoutHtml = `
    <div class="fp-combat-tactical-strip">
      <span class="fp-tactical-chip">⚔️ Round ${roundNum}</span>
      <span class="fp-tactical-chip" id="seq-condition-badge" style="color:${gemColor}; border-color:${gemColor}55;">● ${escapeHtml(bracketLabel)}</span>
      <span class="fp-tactical-chip fp-tactical-hint">${isRanged ? '🏹' : '🗡️'} ${escapeHtml(weaponName)} (${escapeHtml(String(atkBonus))}) • [Space] Strike</span>
    </div>
  `;

  const pfSizeBadgeHtml = adaptive
    ? `<span class="lab-badge badge-pf-size" title="Pathfinder 1e Size: ${escapeHtml(adaptive.pfSizeLabel)} (${adaptive.pfSpaceFt} ft space) • Profile: ${escapeHtml(adaptive.visualBodyProfileLabel || adaptive.visualBodyProfile)} • Visible: ${adaptive.visibleWidthPx}×${adaptive.visibleHeightPx}px">📏 ${escapeHtml(adaptive.pfSizeLabel)}</span>`
    : '';

  return `
    <div class="${actorClasses}" id="fp-monster-actor" data-pf-size="${escapeHtml(adaptive ? adaptive.pfSizeCategory : 'MEDIUM')}" data-body-profile="${escapeHtml(adaptive ? adaptive.visualBodyProfile : 'BIPED_MEDIUM')}" data-vis-w="${effVisW}" data-vis-h="${effVisH}" data-ground-surface="${escapeHtml(groundSurfaceType)}" data-stage-floor-y="${stageFloorY}" style="${inlineVars}" onclick="handleMonsterActorClick()" title="Click creature or press [Space / 1] to strike with ${escapeHtml(weaponName)}!">
      <div class="fp-monster-stage-figure">
        <div class="fp-monster-portrait-box">
          <span class="fp-corner-bracket tl"></span>
          <span class="fp-corner-bracket tr"></span>
          <span class="fp-corner-bracket bl"></span>
          <span class="fp-corner-bracket br"></span>
          ${integratedRigHtml}
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(monster.monsterName || 'Monster')}" class="fp-monster-img" data-presentation="${isEffectiveIntegrated ? 'integrated' : 'card'}">
          <div class="fp-combat-fx-layer">${strikeSvg}</div>
        </div>
        <div class="fp-monster-ground-shadow" aria-hidden="true">
          <div class="fp-shadow-ambient"></div>
          <div class="fp-shadow-contact"></div>
          <div class="fp-shadow-mist-wisp"></div>
        </div>
      </div>

      <div class="fp-monster-hud-plate">
        <div class="fp-monster-title-row">
          <span style="color: ${escapeHtml(monster.monsterColor || '#c5a059')}; font-family: var(--font-mono);">[${escapeHtml(monster.monsterSymbol || 'M')}]</span>
          <span>${escapeHtml(monster.monsterName || 'Enemy')}</span>
          ${pfSizeBadgeHtml}
          ${monster.isBountyTarget ? '<span class="lab-badge" style="border-color:#ef4444; color:#fca5a5;">🎯 Quarry</span>' : ''}
          ${monster.isAirborne ? '<span class="lab-badge">🦅 Airborne</span>' : ''}
          ${modeBadgeHtml}
        </div>
        ${conditionBlockHtml}
        ${tacticalReadoutHtml}
      </div>
    </div>
  `;
}

function renderCombatStagingFrame(state, seq) {
  const stage = document.getElementById('fp-center-stage');
  const vp = document.getElementById('fp-viewport');
  if (!stage || !vp) return;

  vp.classList.add('in-combat');
  vp.classList.remove('in-discovered');

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

function executeCombatBeatVisual(state, seq, beat, displayedLogs) {
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

  // 4. Trigger Actor Choreography & Floating Callout
  if (beat.actor === 'HERO') {
    if (beat.outcome === 'CRIT' || beat.outcome === 'HIT') {
      triggerWeaponStrikeEffect(beat.outcome === 'CRIT');
      spawnFloatingPopup(beat.popupLabel || 'Hit!', beat.outcome === 'CRIT' ? 'pop-crit' : 'pop-strike');
    } else if (beat.outcome === 'MISS') {
      const svg = document.getElementById('fp-slash-svg');
      if (svg) {
        svg.classList.remove('is-striking');
        void svg.offsetWidth;
        svg.classList.add('is-striking');
      }
      triggerMonsterDodgeEffect();
      spawnFloatingPopup('Miss', 'pop-miss');
    } else if (beat.outcome === 'HEAL') {
      flashViewportOverlay('heal');
      spawnFloatingPopup(beat.popupLabel || '+HP', 'pop-heal');
    } else if (beat.outcome === 'FLEE') {
      spawnFloatingPopup('🏃 Retreating...', 'pop-miss');
    }
  } else if (beat.actor === 'MONSTER') {
    triggerMonsterLungeEffect();
    if (beat.outcome === 'HIT') {
      flashViewportOverlay('blood');
      spawnFloatingPopup(beat.popupLabel || `-${beat.hpDelta} HP`, 'pop-damage');
    } else if (beat.outcome === 'MISS') {
      spawnFloatingPopup('Miss', 'pop-miss');
    } else {
      if (beat.hpDelta > 0) flashViewportOverlay('blood');
      spawnFloatingPopup(beat.popupLabel || '⚡ Status', 'pop-damage');
    }
  } else if (beat.actor === 'OUTCOME') {
    if (beat.outcome === 'VICTORY') {
      spawnFloatingPopup('🏆 VICTORY!', 'pop-crit');
    } else if (beat.outcome === 'DEFEAT') {
      flashViewportOverlay('blood');
      spawnFloatingPopup('💀 FALLEN', 'pop-damage');
    } else if (beat.outcome === 'ESCAPED') {
      spawnFloatingPopup('🏃 Escaped!', 'pop-miss');
    }
  }
}

function updateHeroVitalsDisplay(currentHp, maxHp) {
  const hpPct = Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100)));
  const hpHealthClass = hpPct <= 25 ? 'critical' : (hpPct <= 50 ? 'wounded' : 'healthy');

  const hpText = document.getElementById('hud-hp-text');
  if (hpText) hpText.textContent = `${currentHp} / ${maxHp}`;

  const hpBar = document.getElementById('hud-hp-bar');
  if (hpBar) {
    hpBar.style.width = `${hpPct}%`;
    hpBar.className = `dm-hp-bar-inner ${hpHealthClass}`;
  }

  const hpPillar = document.getElementById('pillar-hp');
  if (hpPillar) {
    hpPillar.style.height = `${hpPct}%`;
    hpPillar.className = `dm-pillar-fill hp-pillar ${hpHealthClass}`;
  }
}

/* =========================================================================
   6. MAIN STATE RENDERER
   ========================================================================= */
function renderGameState(state, options = {}) {
  currentState = state;

  // Always update map-connected viewport backdrop first
  renderViewportScene(state);

  // If this response contains a multi-beat combat sequence and we haven't played it yet,
  // play the choreographed sequence before settling into final state.
  if (!options.skipSequence && state.combatSequence && Array.isArray(state.combatSequence.beats) && state.combatSequence.beats.length > 0) {
    if (state.character) {
      renderTopBarAndDeckSnapshot(state, { sequenceLock: true });
      renderMinimap(state);
    }
    playCombatSequence(state);
    return;
  }

  if (state.mode === 'FALLEN') {
    const fallenMaxHp = (state.fallen && state.fallen.max_hp) || (state.combatSequence && state.combatSequence.heroMaxHp) || 12;
    updateHeroVitalsDisplay(0, fallenMaxHp);
    renderFallenScreen(state);
    return;
  }

  renderTopBarAndDeckSnapshot(state, { sequenceLock: false });
  renderAdventureOverlays(state);
  renderViewportCenterStage(state);
  renderBottomChronicle(state);
  renderMinimap(state);
  renderActionDeckAndPad(state);

  if (currentOpenModal === 'journal' || currentOpenModal === 'director') {
    renderModalContent(currentOpenModal);
  }

  if (!options.skipSequence && state.fxCue) {
    const cue = state.fxCue;
    state.fxCue = null;
    handleFxCue(cue);
  }
}

function renderTopBarAndDeckSnapshot(state, { sequenceLock = false } = {}) {
  const hero = state.character;
  if (!hero) return;
  const cStats = state.combatStats;
  const eq = state.equipment;
  const enc = state.encounter;
  const victory = state.victory;

  ['FIGHTER', 'RANGER', 'CLERIC'].forEach(cls => {
    const btn = document.getElementById('class-btn-' + cls);
    if (btn) btn.classList.toggle('is-active', hero.class === cls);
  });

  const classIcons = { FIGHTER: '⚔️', RANGER: '🏹', CLERIC: '✨' };
  document.getElementById('hud-class-crest').textContent = classIcons[hero.class] || '⚔️';
  document.getElementById('hud-hero-name').textContent = hero.name;
  document.getElementById('hud-hero-class-lvl').textContent = `${hero.class} • LVL ${hero.level}`;

  // Status badges
  const statusContainer = document.getElementById('hud-status-pills');
  if (enc && Array.isArray(enc.heroStatusBadges) && enc.heroStatusBadges.length > 0) {
    statusContainer.innerHTML = enc.heroStatusBadges.map(b =>
      `<span style="background: rgba(220,38,38,0.28); border: 1px solid #ef4444; color: #fca5a5; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem;">⚠️ ${escapeHtml(b.label)}</span>`
    ).join(' ');
  } else {
    statusContainer.innerHTML = '';
  }

  // Hands & Stance Slots (Connected only to implemented actions)
  const isRanged = cStats.isRangedActive;
  const mainSlot = document.getElementById('slot-main-hand');
  const offSlot = document.getElementById('slot-off-hand');

  if (isRanged) {
    const rWep = eq.rangedWeapon || cStats.activeWeapon;
    document.getElementById('main-hand-icon').textContent = '🏹';
    document.getElementById('main-hand-label').textContent = 'Both Hands (Ranged Active)';
    document.getElementById('main-hand-name').textContent = rWep ? rWep.name : 'Unarmed';
    document.getElementById('main-hand-stats').textContent = `Atk ${cStats.rangedAttackBonus} • ${rWep ? rWep.damage_dice : '1d4'}`;
    mainSlot.title = (enc && enc.status === 'IN_COMBAT')
      ? `Click to fire ${rWep ? rWep.name : 'Ranged Weapon'} [Space / 1]`
      : 'Click to inspect weapons in Backpack [B]';

    const mWep = eq.meleeWeapon;
    document.getElementById('off-hand-icon').textContent = '🗡️';
    document.getElementById('off-hand-label').textContent = 'Sheathed Melee';
    document.getElementById('off-hand-name').textContent = mWep ? mWep.name : 'Bare Hands';
    document.getElementById('off-hand-stats').textContent = eq.shield ? `(${eq.shield.name} stowed)` : `Atk ${cStats.meleeAttackBonus}`;
    offSlot.classList.toggle('is-disabled-hand', Boolean(enc));
    offSlot.title = enc
      ? 'Cannot swap weapon stance during an active encounter'
      : 'Click to switch to Melee Stance [3 / R]';
  } else {
    const mWep = eq.meleeWeapon || cStats.activeWeapon;
    document.getElementById('main-hand-icon').textContent = '🗡️';
    document.getElementById('main-hand-label').textContent = 'Right Hand (Melee Active)';
    document.getElementById('main-hand-name').textContent = mWep ? mWep.name : 'Bare Hands';
    document.getElementById('main-hand-stats').textContent = `Atk ${cStats.meleeAttackBonus} • ${mWep ? mWep.damage_dice : '1d3'}`;
    mainSlot.title = (enc && enc.status === 'IN_COMBAT')
      ? `Click to strike with ${mWep ? mWep.name : 'Melee Weapon'} [Space / 1]`
      : 'Click to inspect weapons in Backpack [B]';

    if (eq.shield) {
      const twoHanded = mWep && mWep.is_two_handed;
      document.getElementById('off-hand-icon').textContent = '🛡️';
      document.getElementById('off-hand-label').textContent = twoHanded ? 'Left Hand (2H Disabled)' : 'Left Hand (Defense)';
      document.getElementById('off-hand-name').textContent = eq.shield.name;
      document.getElementById('off-hand-stats').textContent = twoHanded ? 'Disabled by 2H weapon' : `+${eq.shield.shield_bonus || 1} Shield AC (Passive)`;
      offSlot.classList.toggle('is-disabled-hand', Boolean(twoHanded));
      offSlot.title = twoHanded
        ? 'Shield AC bonus disabled while wielding a two-handed weapon'
        : `${eq.shield.name} grants passive +${eq.shield.shield_bonus || 1} AC (Click to open Pack [B])`;
    } else if (eq.rangedWeapon) {
      document.getElementById('off-hand-icon').textContent = '🏹';
      document.getElementById('off-hand-label').textContent = 'Slung on Back';
      document.getElementById('off-hand-name').textContent = eq.rangedWeapon.name;
      document.getElementById('off-hand-stats').textContent = `Atk ${cStats.rangedAttackBonus}`;
      offSlot.classList.toggle('is-disabled-hand', Boolean(enc));
      offSlot.title = enc
        ? 'Cannot swap weapon stance during an active encounter'
        : 'Click to switch to Ranged Stance [3 / R]';
    } else {
      document.getElementById('off-hand-icon').textContent = '✋';
      document.getElementById('off-hand-label').textContent = 'Left Hand';
      document.getElementById('off-hand-name').textContent = 'Empty Off-Hand';
      document.getElementById('off-hand-stats').textContent = 'No shield equipped';
      offSlot.classList.add('is-disabled-hand');
      offSlot.title = 'Click to open Backpack and equip off-hand gear [B]';
    }
  }

  if (!sequenceLock) {
    updateHeroVitalsDisplay(hero.current_hp, hero.max_hp);
  }

  const acPct = Math.min(100, Math.max(20, Math.round(((cStats.heroAC - 8) / 14) * 100)));
  document.getElementById('pillar-ac').style.height = `${acPct}%`;

  const xpPct = Math.min(100, Math.max(12, (hero.xp % 1300) / 13));
  document.getElementById('pillar-xp').style.height = `${xpPct}%`;

  document.getElementById('hud-ac-val').textContent = cStats.heroAC;
  document.getElementById('hud-gold-val').textContent = hero.gold;
  document.getElementById('hud-potions-val').textContent = state.combatPotionCount;

  // Viewport Top HUD Area & Banner
  const vp = document.getElementById('fp-viewport');
  vp.classList.toggle('in-combat', Boolean(enc && enc.status === 'IN_COMBAT'));
  vp.classList.toggle('in-discovered', Boolean(enc && enc.status === 'DISCOVERED'));

  document.getElementById('fp-area-title').textContent = state.currentTile.name;
  document.getElementById('fp-area-coords').textContent = `[X: ${state.currentTile.x}, Y: ${state.currentTile.y}]`;
  document.getElementById('fp-area-terrain').textContent = state.currentTile.terrain;

  const stateBanner = document.getElementById('fp-state-banner');
  if (victory) {
    stateBanner.className = 'fp-state-banner state-safe';
    stateBanner.textContent = '🏆 Threat Vanquished — Step [W/S/Q/E] to Advance';
  } else if (enc && enc.status === 'IN_COMBAT') {
    stateBanner.className = 'fp-state-banner state-combat';
    stateBanner.textContent = `⚔️ Combat — Round ${enc.combat_round || 1}`;
  } else if (enc && enc.status === 'DISCOVERED') {
    stateBanner.className = 'fp-state-banner state-mystery';
    stateBanner.textContent = enc.isAmbush ? '⚠️ Ambush in the Mist!' : '👁️ Shadow in the Mist Ahead';
  } else if (state.currentTile.is_safe === 1) {
    stateBanner.className = 'fp-state-banner state-safe';
    stateBanner.textContent = '🛡️ Safe Haven Sanctuary';
  } else {
    stateBanner.className = 'fp-state-banner state-wild';
    stateBanner.textContent = '🌲 Wilderness Exploration';
  }

  // Point of Interest (POI) Inspect Trigger Button in Top HUD Right
  const poiWrap = document.getElementById('fp-poi-trigger-wrap');
  if (poiWrap) {
    const poi = state.viewportScene && state.viewportScene.pointOfInterest;
    const canInspectPoi = Boolean(poi && (!enc || enc.status !== 'IN_COMBAT') && !victory);
    if (canInspectPoi) {
      poiWrap.innerHTML = `
        <button type="button"
                class="btn-poi-inspect ${isPoiPlaqueOpen ? 'is-open' : ''}"
                id="btn-poi-inspect"
                onclick="triggerInspectPoi()"
                title="Inspect ${escapeHtml(poi.title)} [I]">
          🔍 ${escapeHtml(poi.shortPrompt || 'Inspect Landmark')} <kbd style="font-family:var(--font-mono); font-size:0.65rem; opacity:0.85;">[I]</kbd>
        </button>
      `;
    } else {
      poiWrap.innerHTML = '';
    }
  }
}

function renderAdventureOverlays(state) {
  const adv = state && state.adventure;
  const isAdvEnabled = Boolean(adv && adv.enabled);

  const btnCurrent = document.getElementById('exp-mode-btn-current');
  const btnAdventure = document.getElementById('exp-mode-btn-adventure');
  if (btnCurrent) btnCurrent.classList.toggle('is-active-mode', !isAdvEnabled);
  if (btnAdventure) btnAdventure.classList.toggle('is-active-mode', isAdvEnabled);

  const expPillWrap = document.getElementById('fp-expedition-pill-wrap');
  const tensionWrap = document.getElementById('fp-tension-ribbon-wrap');
  const discLayer = document.getElementById('fp-discovery-layer');

  if (!isAdvEnabled) {
    if (expPillWrap) expPillWrap.innerHTML = '';
    if (tensionWrap) {
      tensionWrap.hidden = true;
      tensionWrap.innerHTML = '';
    }
    if (discLayer) {
      discLayer.hidden = true;
      discLayer.innerHTML = '';
    }
    return;
  }

  // 1. Expedition Progress Pill in Top-Right Viewport HUD
  if (expPillWrap) {
    const exp = adv.expedition;
    if (exp) {
      const doneCount = (exp.waypoints || []).filter(w => w.completed).length;
      const totalCount = (exp.waypoints || []).length;
      const nextWp = exp.nextWaypoint;
      expPillWrap.innerHTML = `
        <button type="button"
                class="fp-expedition-pill ${exp.isComplete ? 'is-complete' : ''}"
                id="btn-expedition-pill"
                onclick="openLabModal('journal')"
                title="Open Expedition Journal [L]">
          <span class="exp-pill-title">🧭 ${escapeHtml(exp.title)} (${doneCount}/${totalCount})</span>
          <span class="exp-pill-sub">${exp.isComplete ? '🏆 Expedition Complete — View Journal [L]' : `Next: ${escapeHtml(nextWp ? nextWp.label : 'Explore')} [${nextWp ? `${nextWp.x},${nextWp.y}` : ''}]`}</span>
        </button>
      `;
    } else {
      expPillWrap.innerHTML = '';
    }
  }

  const inCombat = Boolean(state.encounter && state.encounter.status === 'IN_COMBAT');
  const inVictory = Boolean(state.victory);

  // 2. Exploration Tension Ribbon (3-Tier Separation: GENUINE_EVIDENCE vs AMBIENT_TENSION vs ENCOUNTER_INTRO)
  if (tensionWrap) {
    const cue = adv.activeTensionCue;
    if (cue && !inCombat && !inVictory) {
      const tierMeta = {
        GENUINE_EVIDENCE: { badge: '🐾 Genuine Threat Sign', cls: 'tension-genuine' },
        AMBIENT_TENSION: { badge: '🌫️ Ambient Unease', cls: 'tension-ambient' },
        ENCOUNTER_INTRO: { badge: '👁️ Encounter Warning', cls: 'tension-intro' }
      }[cue.tier] || { badge: '🌫️ Field Sign', cls: 'tension-ambient' };

      tensionWrap.hidden = false;
      tensionWrap.innerHTML = `
        <div class="fp-tension-ribbon ${tierMeta.cls}" id="fp-tension-ribbon" data-tension-tier="${escapeHtml(cue.tier)}">
          <span class="fp-tension-badge">${tierMeta.badge}</span>
          <span class="fp-tension-text">${escapeHtml(cue.text)}</span>
        </div>
      `;
    } else {
      tensionWrap.hidden = true;
      tensionWrap.innerHTML = '';
    }
  }

  // 3. Environmental Discovery Layer (3-Tier Presentation Hierarchy: AMBIENT / NOTICEABLE / IMPORTANT)
  if (discLayer) {
    const disc = adv.activeDiscovery;
    const lastRes = adv.lastChoiceResolution;

    if (inCombat || inVictory) {
      discLayer.hidden = true;
      discLayer.innerHTML = '';
      return;
    }

    if (!disc && lastRes && lastRes.step === adv.stepCounter) {
      discLayer.hidden = false;
      discLayer.innerHTML = `
        <div class="fp-discovery-ribbon is-outcome-ribbon" id="fp-discovery-outcome">
          <div class="fp-disc-ribbon-main">
            <span class="fp-disc-tier-badge tier-outcome">✓ ${escapeHtml(lastRes.discoveryTitle)} — ${escapeHtml(lastRes.choiceLabel)}</span>
            <span class="fp-disc-summary">${escapeHtml(lastRes.outcomeText)}</span>
          </div>
          <div class="fp-disc-ribbon-actions">
            <button type="button" class="btn-disc-action" onclick="openLabModal('journal')">📖 Journal [L]</button>
          </div>
        </div>
      `;
      return;
    }

    if (!disc) {
      discLayer.hidden = true;
      discLayer.innerHTML = '';
      return;
    }

    discLayer.hidden = false;
    const tier = disc.tier || 'NOTICEABLE';
    const hasChoices = Array.isArray(disc.choices) && disc.choices.length > 0;
    const isDiscoveryExpanded = Boolean(
      expandedDiscoveryKey &&
      (expandedDiscoveryKey === true || expandedDiscoveryKey === disc.id || expandedDiscoveryKey === disc.discoveryKey)
    );

    if (tier === 'AMBIENT' && !isDiscoveryExpanded) {
      discLayer.innerHTML = `
        <div class="fp-discovery-ambient-strip" id="fp-discovery-ambient" data-discovery-id="${escapeHtml(disc.id)}" data-discovery-tier="AMBIENT">
          <span class="fp-disc-icon">${escapeHtml(disc.icon || '🍃')}</span>
          <span class="fp-disc-ambient-title">${escapeHtml(disc.title)}:</span>
          <span class="fp-disc-ambient-text">${escapeHtml(disc.shortText || disc.fullText)}</span>
          ${hasChoices ? `<button type="button" class="btn-disc-inline" onclick="expandDiscoveryCard()">Inspect</button>` : ''}
          <button type="button" class="btn-disc-close" onclick="dismissActiveDiscovery()" title="Dismiss">✕</button>
        </div>
      `;
    } else if (tier === 'NOTICEABLE' && !isDiscoveryExpanded) {
      discLayer.innerHTML = `
        <div class="fp-discovery-ribbon" id="fp-discovery-ribbon" data-discovery-id="${escapeHtml(disc.id)}" data-discovery-tier="NOTICEABLE">
          <div class="fp-disc-ribbon-main">
            <div class="fp-disc-ribbon-header">
              <span class="fp-disc-tier-badge tier-noticeable">${escapeHtml(disc.icon || '🔍')} Field Discovery • ${escapeHtml(disc.category || 'Sign')}</span>
              <span class="fp-disc-title">${escapeHtml(disc.title)}</span>
            </div>
            <div class="fp-disc-summary">${escapeHtml(disc.shortText || disc.fullText)}</div>
          </div>
          <div class="fp-disc-ribbon-actions">
            ${hasChoices ? `
              <button type="button" class="btn-disc-primary" id="btn-disc-expand" onclick="expandDiscoveryCard()">
                🔍 Examine Closer (${disc.choices.length} Options)
              </button>
            ` : ''}
            <button type="button" class="btn-disc-action" onclick="dismissActiveDiscovery()">Leave It</button>
          </div>
        </div>
      `;
    } else {
      // IMPORTANT tier or expanded NOTICEABLE/AMBIENT card
      const choicesHtml = (disc.choices || []).map((c, idx) => `
        <button type="button"
                class="btn-discovery-choice"
                id="btn-discovery-choice-${escapeHtml(c.id)}"
                data-choice-id="${escapeHtml(c.id)}"
                onclick="resolveDiscoveryChoiceClick('${escapeHtml(disc.id)}', '${escapeHtml(c.id)}')">
          <span class="choice-num">[${idx + 1}]</span>
          <span class="choice-body">
            <strong>${escapeHtml(c.label)}</strong>
            <small>${escapeHtml(c.prompt)}</small>
          </span>
        </button>
      `).join('');

      discLayer.innerHTML = `
        <div class="fp-discovery-card" id="fp-discovery-card" data-discovery-id="${escapeHtml(disc.id)}" data-discovery-tier="${escapeHtml(tier)}">
          <div class="fp-disc-card-header">
            <div>
              <div class="fp-disc-card-kicker">${escapeHtml(disc.icon || '🧭')} ${escapeHtml(tier === 'IMPORTANT' ? 'Major Field Discovery' : 'Environmental Discovery')} • ${escapeHtml(disc.category || 'Exploration')}</div>
              <div class="fp-disc-card-title">${escapeHtml(disc.title)}</div>
            </div>
            <button type="button" class="btn-disc-close" onclick="dismissActiveDiscovery()" title="Step past without disturbing">✕</button>
          </div>
          <p class="fp-disc-card-body">${escapeHtml(disc.fullText || disc.shortText)}</p>
          ${choicesHtml ? `
            <div class="fp-disc-choices-grid">
              ${choicesHtml}
            </div>
          ` : ''}
        </div>
      `;
    }
  }
}

/* =========================================================================
   7. VIEWPORT CENTER STAGE RENDERER (In-Scene Shadow, Combat, Seamless Victory)
   ========================================================================= */
function handleMainHandClick() {
  if (!currentState) return;
  const enc = currentState.encounter;
  if (enc && enc.status === 'IN_COMBAT') {
    dispatchAction('ATTACK');
  } else if (enc && enc.status === 'DISCOVERED') {
    dispatchAction('INVESTIGATE');
  } else {
    openLabModal('backpack');
  }
}

function handleOffHandClick() {
  if (!currentState) return;
  const enc = currentState.encounter;
  if (enc) {
    spawnFloatingPopup('🔒 Stance Locked in Encounter', 'pop-miss');
    return;
  }
  if (currentState.equipment && currentState.equipment.rangedWeapon) {
    dispatchAction('STANCE');
  } else {
    openLabModal('backpack');
  }
}

function handleMonsterActorClick() {
  if (!currentState) return;
  const enc = currentState.encounter;
  if (enc && enc.status === 'IN_COMBAT') {
    dispatchAction('ATTACK');
  }
}

function buildSizeComparisonArenaHtml(state) {
  const cat = window.MonsterSizeCatalog;
  if (!cat || typeof cat.buildVisualComparisonPresets !== 'function') {
    return `<div class="fp-threat-whisper-plate">Monster Size Catalog loading...</div>`;
  }
  const vpW = window.innerWidth || 1920;
  const vpH = window.innerHeight || 1080;
  const bundle = cat.buildVisualComparisonPresets({ width: vpW, height: vpH });
  const presets = bundle.presets || {};
  const isAdaptive = currentMonsterScaleMode === 'adaptive';
  const wantsCutout = currentPresenceMode === 'integrated';

  const tabs = [
    { id: 'SIZE_PROGRESSION_5',        label: '1. Size Progression (Tiny → Huge)' },
    { id: 'SAME_SIZE_MEDIUM_PROFILES', label: '2. Medium Body Shapes' },
    { id: 'SAME_SIZE_LARGE_PROFILES',  label: '3. Large Body Shapes' },
    { id: 'ALL_9_PF1E_TIERS',          label: '4. All 9 PF1e Sizes' },
    { id: 'BEFORE_AFTER_SPLIT',        label: '5. Before vs. After' }
  ];

  const tabsHtml = tabs.map(t => `
    <button type="button"
            class="sizelab-tab-btn ${currentSizeComparisonPreset === t.id ? 'is-active' : ''}"
            data-preset-id="${escapeHtml(t.id)}"
            onclick="setSizeComparisonPreset('${escapeHtml(t.id)}')">
      ${escapeHtml(t.label)}
    </button>
  `).join('');

  let bodyHtml = '';
  let subtitleText = '';

  if (currentSizeComparisonPreset === 'BEFORE_AFTER_SPLIT') {
    const specimenChoices = [
      { slug: 'stirge',               label: 'Stirge (Tiny • 1 ft)' },
      { slug: 'goblin',               label: 'Goblin (Small • 3.2 ft)' },
      { slug: 'giant_spider',         label: 'Giant Spider (Medium Wide • 5.5 ft span)' },
      { slug: 'wolf',                 label: 'Wolf (Medium Quadruped • 3.2 ft shld)' },
      { slug: 'skeletal_champion',    label: 'Skeletal Champion (Medium Biped • 6.1 ft)' },
      { slug: 'troll',                label: 'Troll (Large Brute • 14 ft)' },
      { slug: 'manticore',            label: 'Manticore (Large Winged • 16 ft span)' },
      { slug: 'ochre_jelly',          label: 'Ochre Jelly (Large Ooze • 10 ft wide)' },
      { slug: 'ref_huge_elder_troll', label: 'Ancient Troll (Huge Ref • 24 ft)' }
    ];
    const entry = cat.lookupMonsterSizeEntry(selectedBeforeAfterSpecimen);
    const useCut = wantsCutout && Boolean(entry.hasCutout && entry.cutoutImagePath);
    const imgSrc = useCut ? entry.cutoutImagePath : entry.imagePath;
    const sc = cat.computeAdaptiveMonsterVisualScale(entry, {
      viewportWidth: vpW,
      viewportHeight: vpH,
      presentationMode: useCut ? 'INTEGRATED' : 'CARD',
      virtualDistanceFt: 12
    });

    // Fit inside split arena stage height while keeping exact 1:1 ratio between Before & After
    const maxStageH = Math.max(150, Math.round(vpH * 0.36));
    const peakH = Math.max(sc.legacyComparison.legacyBoxPx, sc.visibleHeightPx);
    const splitFit = peakH > maxStageH ? +(maxStageH / peakH).toFixed(3) : 1.0;

    const beforeW = Math.round(sc.legacyComparison.legacyBoxPx * splitFit);
    const beforeH = Math.round(sc.legacyComparison.legacyBoxPx * splitFit);
    const afterW = Math.round(sc.visibleWidthPx * splitFit);
    const afterH = Math.round(sc.visibleHeightPx * splitFit);
    const deltaSign = sc.legacyComparison.heightDeltaPct >= 0 ? '+' : '';

    subtitleText = `${entry.name} — PF1e ${sc.pfSizeLabel} (${sc.pfSpaceFt} ft space) • ${sc.visualBodyProfileLabel} • Shared 12-ft Virtual Distance`;

    const selectorPills = specimenChoices.map(c => `
      <button type="button"
              class="sizelab-subpill ${selectedBeforeAfterSpecimen === c.slug ? 'is-active' : ''}"
              onclick="setBeforeAfterSpecimen('${escapeHtml(c.slug)}')">
        ${escapeHtml(c.label)}
      </button>
    `).join('');

    bodyHtml = `
      <div class="sizelab-subbar">${selectorPills}</div>
      <div class="sizelab-split-stage" id="sizelab-split-stage">
        <div class="sizelab-split-col is-before-col" data-col="before">
          <div class="sizelab-col-badge badge-before">BEFORE — Legacy Uniform Box (23vh Square)</div>
          <div class="sizelab-figure-floor">
            <div class="sizelab-specimen-box ${useCut ? 'is-cutout' : 'is-card'} is-legacy-box"
                 style="width:${beforeW}px; height:${beforeH}px;">
              <img src="${escapeHtml(imgSrc)}" alt="Before ${escapeHtml(entry.name)}" class="sizelab-specimen-img">
            </div>
            <div class="sizelab-ground-shadow" style="width:${Math.round(beforeW * 0.78)}px; height:16px; opacity:0.68;"></div>
          </div>
          <div class="sizelab-specimen-caption">
            <strong>${escapeHtml(entry.name)} (Legacy)</strong>
            <span>1:1 Combat Box: <code>${sc.legacyComparison.legacyBoxPx}×${sc.legacyComparison.legacyBoxPx}px</code> (1.00:1)</span>
            <span>Ignores PF1e size, body profile &amp; margin padding</span>
          </div>
        </div>

        <div class="sizelab-split-col is-after-col" data-col="after">
          <div class="sizelab-col-badge badge-after">AFTER — PF1e Adaptive (${escapeHtml(sc.pfSizeLabel)} • ${deltaSign}${sc.legacyComparison.heightDeltaPct}% Height)</div>
          <div class="sizelab-figure-floor ${sc.positioning.isAirborne ? 'is-airborne-specimen' : ''}">
            <div class="sizelab-specimen-box ${useCut ? 'is-cutout' : 'is-card'} is-adaptive-box"
                 style="width:${afterW}px; height:${afterH}px; --trim-scale:${sc.transparencyCompensation.imageTrimScale};">
              <img src="${escapeHtml(imgSrc)}" alt="After ${escapeHtml(entry.name)}" class="sizelab-specimen-img">
            </div>
            <div class="sizelab-ground-shadow" style="width:${Math.round(afterW * (sc.shadow.shadowWidthPct / 100))}px; height:${Math.max(10, Math.round(sc.shadow.shadowHeightPx * splitFit * 0.65))}px; opacity:${sc.shadow.shadowOpacity}; filter:blur(${Math.round(sc.shadow.shadowBlurPx * 0.45)}px);"></div>
          </div>
          <div class="sizelab-specimen-caption">
            <strong>${escapeHtml(entry.name)} (${escapeHtml(sc.pfSizeLabel)})</strong>
            <span>1:1 Combat Box: <code>${sc.visibleWidthPx}×${sc.visibleHeightPx}px</code> (Aspect ${sc.aspectRatio}:1)</span>
            <span>Profile: ${escapeHtml(sc.visualBodyProfile)} • Trim ×${sc.transparencyCompensation.imageTrimScale}${sc.clamping.wasClamped ? ' • 🛡️ UI Clamped' : ''}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    const activePreset = presets[currentSizeComparisonPreset] || presets.SIZE_PROGRESSION_5;
    subtitleText = activePreset.subtitle;
    const specimens = activePreset.specimens || [];

    // Compute a uniform lineup fit factor so all specimens fit side-by-side at current resolution
    // while preserving 100% of their relative height and width proportions!
    const availStageW = Math.max(540, Math.round(vpW * 0.62) - (specimens.length * 22));
    const availStageH = Math.max(155, Math.round(vpH * 0.37));

    const totalRawW = specimens.reduce((sum, s) => {
      const w = isAdaptive ? s.adaptive.visibleWidthPx : s.adaptive.legacyComparison.legacyBoxPx;
      return sum + w;
    }, 0);
    const maxRawH = specimens.reduce((max, s) => {
      const h = isAdaptive ? s.adaptive.visibleHeightPx : s.adaptive.legacyComparison.legacyBoxPx;
      return Math.max(max, h);
    }, 1);

    const fitW = availStageW / Math.max(1, totalRawW);
    const fitH = availStageH / Math.max(1, maxRawH);
    const lineupFit = Math.min(1.0, fitW, fitH);

    const cardsHtml = specimens.map(spec => {
      const sc = spec.adaptive;
      const useCut = wantsCutout && Boolean(spec.hasCutout && spec.cutoutImagePath);
      const imgSrc = useCut ? spec.cutoutImagePath : spec.imagePath;
      const rawW = isAdaptive ? sc.visibleWidthPx : sc.legacyComparison.legacyBoxPx;
      const rawH = isAdaptive ? sc.visibleHeightPx : sc.legacyComparison.legacyBoxPx;
      const dispW = Math.max(34, Math.round(rawW * lineupFit));
      const dispH = Math.max(34, Math.round(rawH * lineupFit));
      const shW = Math.max(24, Math.round(dispW * (isAdaptive ? (sc.shadow.shadowWidthPct / 100) : 0.78)));
      const shH = Math.max(8, Math.round((isAdaptive ? sc.shadow.shadowHeightPx : 18) * lineupFit * 0.65));
      const deltaSign = sc.legacyComparison.heightDeltaPct >= 0 ? '+' : '';

      return `
        <div class="sizelab-lineup-item ${sc.positioning.isAirborne && isAdaptive ? 'is-airborne-specimen' : ''}"
             data-slug="${escapeHtml(spec.slug)}"
             data-pf-size="${escapeHtml(sc.pfSizeCategory)}"
             data-body-profile="${escapeHtml(sc.visualBodyProfile)}"
             data-combat-w="${rawW}"
             data-combat-h="${rawH}"
             data-disp-w="${dispW}"
             data-disp-h="${dispH}">
          <div class="sizelab-figure-floor">
            <div class="sizelab-specimen-box ${useCut ? 'is-cutout' : 'is-card'} ${isAdaptive ? 'is-adaptive-box' : 'is-legacy-box'}"
                 style="width:${dispW}px; height:${dispH}px; --trim-scale:${isAdaptive ? sc.transparencyCompensation.imageTrimScale : 1};">
              <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(spec.name)}" class="sizelab-specimen-img">
            </div>
            <div class="sizelab-ground-shadow"
                 style="width:${shW}px; height:${shH}px; opacity:${isAdaptive ? sc.shadow.shadowOpacity : 0.68};"></div>
          </div>
          <div class="sizelab-specimen-caption">
            <div class="sizelab-size-pill pf-badge-${escapeHtml(sc.pfSizeCategory.toLowerCase())}">
              ${escapeHtml(sc.pfSizeLabel)} (${sc.pfSpaceFt}ft)
            </div>
            <strong class="sizelab-mon-name">${escapeHtml(spec.name.replace(/\s*\(.*?\)/g, ''))}</strong>
            <span class="sizelab-mon-dims"><code>${rawW}×${rawH}px</code> (${deltaSign}${sc.legacyComparison.heightDeltaPct}%)</span>
            <span class="sizelab-mon-prof">${escapeHtml(sc.bodyProportions.approxHeightFt)}ft • ${escapeHtml(sc.visualBodyProfile.replace(/_/g, ' '))}${sc.clamping.wasClamped ? ' • 🛡️Clamp' : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    bodyHtml = `
      <div class="sizelab-lineup-stage" id="sizelab-lineup-stage" data-lineup-fit="${lineupFit.toFixed(3)}">
        <div class="sizelab-horizon-reference-line" title="Human Eye-Level Reference (~5.8 ft Medium Biped)">
          <span>Human Eye-Level (6 ft Medium)</span>
        </div>
        <div class="sizelab-ground-plane-line"></div>
        <div class="sizelab-lineup-row">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="fp-size-comparison-arena" id="fp-size-comparison-arena" data-preset="${escapeHtml(currentSizeComparisonPreset)}" data-scale-mode="${escapeHtml(currentMonsterScaleMode)}">
      <div class="sizelab-header">
        <div class="sizelab-title-block">
          <div class="sizelab-kicker">⚖️ PATHFINDER 1E MONSTER SIZE &amp; ADAPTIVE VISUAL SCALING ARENA (${vpW}×${vpH})</div>
          <div class="sizelab-subtitle">${escapeHtml(subtitleText)}</div>
        </div>
        <div class="sizelab-header-actions">
          <div class="sizelab-mode-toggle" role="group" aria-label="Scale Mode Toggle">
            <button type="button" class="sizelab-toggle-pill ${isAdaptive ? 'is-active' : ''}" id="sizelab-btn-adaptive" onclick="setMonsterScaleMode('adaptive')">PF1e Adaptive ★</button>
            <button type="button" class="sizelab-toggle-pill ${!isAdaptive ? 'is-active' : ''}" id="sizelab-btn-legacy" onclick="setMonsterScaleMode('legacy')">Legacy Uniform (Before)</button>
          </div>
          <button type="button" class="btn-action-stone" style="padding:3px 9px; font-size:0.7rem;" onclick="toggleMonsterSizeComparisonLab(false)" title="Close Size Comparison Arena [Z / Esc]">✕ Exit Arena</button>
        </div>
      </div>
      <div class="sizelab-tabs-row">
        ${tabsHtml}
      </div>
      ${bodyHtml}
    </div>
  `;
}

function renderViewportCenterStage(state) {
  const stage = document.getElementById('fp-center-stage');
  const enc = state.encounter;
  const victory = state.victory;

  // CASE 0: PATHFINDER 1E MONSTER SIZE & BODY-PROFILE VISUAL COMPARISON ARENA (Phase 4)
  if (isSizeComparisonLabOpen) {
    stage.innerHTML = buildSizeComparisonArenaHtml(state);
    return;
  }

  // CASE A: POST-VICTORY PRESENTATION (No confirmation required to keep walking!)
  if (victory) {
    const lootHtml = (victory.lootedItems && victory.lootedItems.length > 0)
      ? `<div style="margin-top: 4px; color: var(--accent-gold-bright); font-size: 0.8rem;">📦 Looted: <strong>${victory.lootedItems.map(escapeHtml).join(', ')}</strong></div>`
      : `<div style="margin-top: 3px; color: var(--text-muted); font-size: 0.76rem;">No items found on the remains.</div>`;

    stage.innerHTML = `
      <div class="fp-monster-actor" onclick="dispatchAction('DISMISS_VICTORY')" title="Step [W/S/Q/E] to keep moving, or click / press [Space] to clear">
        <div class="fp-monster-portrait-box" style="width: clamp(110px, 18vh, 175px); height: clamp(110px, 18vh, 175px); opacity: 0.75; filter: grayscale(0.45);">
          <span class="fp-corner-bracket tl"></span>
          <span class="fp-corner-bracket tr"></span>
          <span class="fp-corner-bracket bl"></span>
          <span class="fp-corner-bracket br"></span>
          <img src="${escapeHtml(victory.imageUrl)}" alt="Defeated ${escapeHtml(victory.cleanMonsterName)}" class="fp-monster-img">
        </div>
        <div class="fp-monster-ground-shadow"></div>
        <div class="fp-monster-hud-plate" style="border-color: var(--border-gold-solid);">
          <div class="fp-monster-title-row" style="color: var(--accent-gold-bright);">
            <span>🏆 VICTORY — ${escapeHtml(victory.cleanMonsterName)} Slain!</span>
          </div>
          <div style="display: flex; justify-content: center; gap: 14px; margin-top: 2px; font-family: var(--font-mono); font-size: 0.8rem;">
            <span style="color: #93c5fd;">✨ +${victory.xpAwarded} XP</span>
            <span style="color: var(--accent-gold-bright);">🪙 +${victory.goldLooted} Gold</span>
          </div>
          ${lootHtml}
          <div style="margin-top: 3px; font-size: 0.72rem; color: #86efac;">
            ✦ Walk freely with <strong>[W / S / Q / E]</strong> to advance immediately
          </div>
        </div>
      </div>
    `;
    return;
  }

  // CASE B: STAGE 2 — ACTIVE COMBAT (Monster Standing in the Viewport)
  if (enc && enc.status === 'IN_COMBAT') {
    stage.innerHTML = buildCombatMonsterActorHtml(enc, state, { isSequenceFrame: false });
    return;
  }

  // CASE C: STAGE 1 — IN-SCENE SHADOW THREAT (Strict Secrecy, No Opaque Center Card!)
  if (enc && enc.status === 'DISCOVERED') {
    const bypassHint = enc.isAmbush
      ? `<span style="color: #fca5a5;">⚠️ Ambush! Retreat is cut off — press <strong>[Space]</strong> to face the threat!</span>`
      : `<span>Click shadow or press <strong>[Space]</strong> to Engage • Step <strong>[W/S/Q/E]</strong> or <strong>[4/F]</strong> to Slip Past</span>`;

    stage.innerHTML = `
      <div class="fp-inscene-threat" id="fp-inscene-threat" onclick="dispatchAction('INVESTIGATE')" title="Click shadow or press [Space] to Engage threat">
        <div class="fp-shadow-apparition" aria-label="Unidentified shadow lurking in the mist">
          <svg class="fp-shadow-silhouette-svg" viewBox="0 0 200 220" aria-hidden="true">
            <defs>
              <radialGradient id="shadowMistGrad" cx="50%" cy="48%" r="50%">
                <stop offset="0%" stop-color="#05070a" stop-opacity="0.95"/>
                <stop offset="65%" stop-color="#111622" stop-opacity="0.72"/>
                <stop offset="100%" stop-color="#111622" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <!-- Generic amorphous lurking shadow in the mist (never identifies creature species) -->
            <ellipse cx="100" cy="195" rx="74" ry="16" fill="rgba(0,0,0,0.65)"/>
            <path d="M 48,190 C 38,135 55,68 82,45 C 96,32 112,34 124,48 C 148,74 162,135 152,190 Z"
                  fill="url(#shadowMistGrad)"/>
            <path d="M 32,175 Q 65,120 100,132 Q 135,144 168,170"
                  fill="none" stroke="rgba(197, 160, 89, 0.25)" stroke-width="2" stroke-dasharray="8 6"/>
            <!-- Faint ominous glints in the fog -->
            <circle cx="88" cy="84" r="2.8" fill="rgba(239, 68, 68, 0.75)"/>
            <circle cx="112" cy="84" r="2.8" fill="rgba(239, 68, 68, 0.75)"/>
          </svg>
        </div>

        <div class="fp-threat-whisper-plate" onclick="event.stopPropagation();">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-serif); font-size: 0.84rem; font-weight: 700; color: var(--accent-gold-bright);">
            <span>👁️ Unidentified Presence Ahead</span>
            ${enc.isRangerSpecial ? `<span class="lab-badge" style="color:#86efac; border-color:#4ade80;">🏹 Keen Senses</span>` : ''}
            ${enc.isAmbush ? `<span class="lab-badge" style="color:#fca5a5; border-color:#ef4444;">⚠️ Ambush</span>` : ''}
          </div>
          <p class="fp-mystery-clue">
            “${escapeHtml(enc.resolvedDescription)}”
          </p>
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn-action-gold" style="padding: 5px 14px; font-size: 0.76rem;" onclick="dispatchAction('INVESTIGATE')">
              ⚔️ ${enc.isAmbush ? 'Face Ambush' : 'Engage Threat'} [Space]
            </button>
            ${!enc.isAmbush ? `
              <button type="button" class="btn-action-stone" style="padding: 5px 12px; font-size: 0.74rem;" onclick="dispatchAction('IGNORE')">
                👣 Slip Past [4 / F]
              </button>
            ` : ''}
          </div>
          <div style="font-size: 0.71rem; color: var(--text-muted); margin-top: 2px;">
            ${bypassHint}
          </div>
        </div>
      </div>
    `;
    return;
  }

  // CASE C.5: POINT OF INTEREST (POI) ENVIRONMENTAL LORE PLAQUE (When inspected outside active combat)
  const poi = state.viewportScene && state.viewportScene.pointOfInterest;
  if (isPoiPlaqueOpen && poi) {
    stage.innerHTML = `
      <div class="fp-poi-plaque-card" id="fp-poi-plaque-card">
        <div class="fp-poi-plaque-header">
          <div class="fp-poi-plaque-title">
            <span>🔍 ${escapeHtml(poi.title)}</span>
            <span class="fp-poi-plaque-category">${escapeHtml(poi.category || 'Landmark')}</span>
          </div>
          <button type="button" class="btn-action-stone" style="padding: 3px 10px; font-size: 0.72rem;" onclick="closePoiPlaque()">
            ✕ Close [I / Esc]
          </button>
        </div>
        <div class="fp-poi-plaque-lore">
          “${escapeHtml(poi.loreText)}”
        </div>
        <div class="fp-poi-plaque-footer">
          <span>📍 Coordinates [${state.currentTile.x}, ${state.currentTile.y}] • Facing ${escapeHtml(state.facing)}</span>
          <span>✦ Pure Environmental Lore • Walk with <strong>[W/A/S/D]</strong> to continue</span>
        </div>
      </div>
    `;
    return;
  }

  // CASE D: SAFE HAVEN CITY (Compact non-intrusive sanctuary bar at bottom of stage)
  if (state.isSafeCity) {
    const aheadCity = state.viewportScene && state.viewportScene.ahead1;
    const aheadSub = aheadCity
      ? `Looking ${escapeHtml(state.facing)} toward <strong>${escapeHtml(aheadCity.name)}</strong>`
      : 'Safe within the timber walls';
    stage.innerHTML = `
      <div class="fp-threat-whisper-plate" style="margin-top: auto; max-width: 560px;">
        <div style="font-family: var(--font-serif); font-size: 0.86rem; color: var(--accent-gold); font-weight: 700;">
          🏛️ Sanctuary of ${escapeHtml(state.currentTile.name)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-body);">
          ${aheadSub}. Press <strong>[Space]</strong> to rest, <strong>[W/A/S/D]</strong> to navigate, or open Market <strong>[M]</strong>.
        </div>
      </div>
    `;
    return;
  }

  // CASE E: CLEAR WILDERNESS VISTA (Unobstructed first-person view of the cohesive scene)
  const ahead1 = state.viewportScene && state.viewportScene.ahead1;
  const isBlocked = Boolean(ahead1 && !ahead1.isPassable);
  const mode = currentSceneMode || state.sceneMode || 'A';
  const activeScene = (state.viewportScene && state.viewportScene.scenes && state.viewportScene.scenes[mode]) ||
                      (state.viewportScene && state.viewportScene.activeScene) || null;

  let vistaHint = 'Choose a direction to explore';
  if (ahead1) {
    const povTier = activeScene && activeScene.povTier ? Number(activeScene.povTier) : 1;
    if (!ahead1.isPassable) {
      const povContextNote = (mode === 'C' && activeScene && activeScene.viewSubtitle)
        ? ` • <em>${escapeHtml(activeScene.viewSubtitle)}</em>`
        : '';
      vistaHint = `⛔ <strong style="color:#fca5a5;">Impassable Barrier (${escapeHtml(state.facing)}): ${escapeHtml(ahead1.name)}</strong> (${escapeHtml(ahead1.terrain)})${povContextNote} — Turn <strong>[A/D]</strong> or step <strong>[S/Q/E]</strong>`;
    } else if (mode === 'C' && povTier <= 3) {
      vistaHint = `👁️ <strong style="color:#86efac;">1st-Person POV (${escapeHtml(state.facing)} • Tier ${povTier}):</strong> ${escapeHtml(activeScene.viewSubtitle || `Looking toward ${ahead1.name}`)} — Press <strong>[W]</strong> to advance or <strong>[A/D]</strong> to turn`;
    } else if (mode === 'C') {
      vistaHint = `🧭 <strong style="color:#fde68a;">Eye-Level POV Fallback (${escapeHtml(state.facing)} • Tier ${povTier}):</strong> Looking toward <strong>${escapeHtml(ahead1.name)}</strong> (${escapeHtml(ahead1.terrain)}) — Press <strong>[W]</strong> to advance or <strong>[A/D]</strong> to turn`;
    } else if (mode === 'B') {
      vistaHint = `👁️ Looking ${escapeHtml(state.facing)} toward <strong>${escapeHtml(ahead1.name)}</strong> (${escapeHtml(ahead1.terrain)}) — Press <strong>[W]</strong> to advance or <strong>[A/D]</strong> to turn`;
    } else {
      vistaHint = `🧭 Ahead (${escapeHtml(state.facing)}): <strong>${escapeHtml(ahead1.name)}</strong> (${escapeHtml(ahead1.terrain)}) — Press <strong>[W]</strong> to advance or <strong>[A/D]</strong> to turn`;
    }
  }

  stage.innerHTML = `
    <div class="fp-vista-bar ${isBlocked ? 'is-blocked-vista' : ''}">
      <span style="font-size: 0.76rem; color: var(--text-body);">
        ${vistaHint}
      </span>
    </div>
  `;
}

/* =========================================================================
   8. BOTTOM CHRONICLE & COMBAT LOG RENDERER
   ========================================================================= */
function renderBottomChronicle(state) {
  const titleEl = document.getElementById('fp-chronicle-title');
  const linesEl = document.getElementById('fp-chronicle-lines');
  const enc = state.encounter;

  const feedbackBanner = [];
  if (state.errorMessage) {
    feedbackBanner.push(`<div class="fp-log-line monster_attack">⚠️ ${escapeHtml(state.errorMessage)}</div>`);
  }
  if (state.infoMessage) {
    feedbackBanner.push(`<div class="fp-log-line potion_used">🕯️ ${escapeHtml(state.infoMessage)}</div>`);
  }

  if (enc && enc.status === 'IN_COMBAT') {
    titleEl.textContent = `⚔️ Battle Record — Round ${enc.combat_round || 1}`;
    const events = Array.isArray(enc.currentRoundEvents) ? enc.currentRoundEvents : [];
    const iconByType = {
      OPENING_SHOT: '🏹',
      HERO_ATTACK: '⚔️',
      MONSTER_ATTACK: '🩸',
      MONSTER_ABILITY: '⚡',
      STATUS_EFFECT: '☠️',
      POTION_USED: '🧪',
      FLEE: '🏃'
    };

    if (events.length > 0) {
      linesEl.innerHTML = feedbackBanner.concat(
        events.map(ev => {
          const ic = iconByType[ev.event_type] || '•';
          return `<div class="fp-log-line ${(ev.event_type || '').toLowerCase()}">${ic} ${escapeHtml(ev.public_text)}</div>`;
        })
      ).join('');
    } else {
      linesEl.innerHTML = feedbackBanner.concat([
        `<div class="fp-log-line hero_attack">⚔️ ${escapeHtml(enc.resolvedDescription || 'Battle joined! Click the monster or press [Space] to strike.')}</div>`
      ]).join('');
    }
    linesEl.scrollTop = linesEl.scrollHeight;
    return;
  }

  titleEl.textContent = `📖 ${state.currentTile.name} — Chronicle`;
  linesEl.innerHTML = feedbackBanner.concat([
    `<div class="fp-log-line" style="font-style: italic; color: var(--text-body);">“${escapeHtml(state.currentTile.description)}”</div>`
  ]).join('');
}

/* =========================================================================
   9. 5x5 MINIMAP (NORTH UP + ROTATING HERO ARROW) & COMPASS ROSE
   ========================================================================= */
function renderMinimap(state) {
  const grid = document.getElementById('dm-minimap-grid');
  const lockInd = document.getElementById('minimap-Lock-indicator');
  const enc = state.encounter;
  const facing = state.facing || 'NORTH';
  const fMeta = FACING_META[facing] || FACING_META.NORTH;

  const isCombatLocked = Boolean(enc && (enc.status === 'IN_COMBAT' || enc.isAmbush));
  lockInd.textContent = isCombatLocked
    ? '🔒 Combat Lock'
    : `[${state.currentTile.x}, ${state.currentTile.y}] • ${fMeta.short} ${fMeta.arrow}`;
  lockInd.style.color = isCombatLocked ? '#fca5a5' : 'var(--accent-gold)';

  // Update Compass Rose Widget
  ['N', 'E', 'S', 'W'].forEach(pt => {
    const el = document.getElementById('comp-' + pt.toLowerCase());
    if (el) el.classList.toggle('is-active-dir', fMeta.short === pt);
  });
  const needle = document.getElementById('compass-needle');
  if (needle) {
    needle.textContent = fMeta.arrow;
  }
  const compFacingLbl = document.getElementById('compass-facing-lbl');
  if (compFacingLbl) compFacingLbl.textContent = fMeta.label;

  const ahead1 = state.viewportScene && state.viewportScene.ahead1;
  const compAheadLbl = document.getElementById('compass-ahead-lbl');
  if (compAheadLbl && ahead1) {
    compAheadLbl.textContent = `Ahead: ${ahead1.name}${ahead1.isPassable ? '' : ' (Blocked)'}`;
  }

  // Render 5x5 North-Up Grid with Rotating Hero Arrow & Forward FOV Highlight
  const pX = state.currentTile.x;
  const pY = state.currentTile.y;
  const aheadX = ahead1 ? ahead1.x : null;
  const aheadY = ahead1 ? ahead1.y : null;

  grid.innerHTML = state.minimap.rows.map(row => `
    <div class="dm-minimap-row">
      ${row.map(cell => {
        const dx = cell.x - pX;
        const dy = cell.y - pY;
        let stepDir = null;
        if (!isCombatLocked && cell.isPassable) {
          if (dx === 0 && dy === -1) stepDir = 'NORTH';
          else if (dx === 0 && dy === 1) stepDir = 'SOUTH';
          else if (dx === -1 && dy === 0) stepDir = 'WEST';
          else if (dx === 1 && dy === 0) stepDir = 'EAST';
        }
        const isFovAhead = (cell.x === aheadX && cell.y === aheadY);
        const cls = [
          'dm-minimap-cell',
          cell.isPlayer ? 'is-player' : '',
          isFovAhead ? 'is-fov-ahead' : '',
          stepDir ? 'is-adjacent-step' : '',
          !cell.isPassable ? 'impassable' : ''
        ].filter(Boolean).join(' ');
        const clickAttr = stepDir ? `onclick="dispatchMove('${stepDir}')"` : '';
        const symbolHtml = cell.isPlayer
          ? `<span class="minimap-hero-arrow" title="Hero Facing ${facing}">${fMeta.arrow}</span>`
          : escapeHtml(cell.symbol);
        return `<div class="${cls}" style="color: ${escapeHtml(cell.color)};" title="${escapeHtml(cell.label)} [${cell.x}, ${cell.y}]" ${clickAttr}>${symbolHtml}</div>`;
      }).join('')}
    </div>
  `).join('');
}

/* =========================================================================
   10. TACTICAL ACTION DECK & FIRST-PERSON NAVIGATION PAD
   ========================================================================= */
function renderActionDeckAndPad(state) {
  const enc = state.encounter;
  const hero = state.character;
  const cStats = state.combatStats;
  const facing = state.facing || 'NORTH';
  const fMeta = FACING_META[facing] || FACING_META.NORTH;

  document.getElementById('deck-stance-indicator').textContent = cStats.isRangedActive ? '🏹 Ranged Stance' : '🗡️ Melee Stance';

  const slot1 = document.getElementById('action-slot-1');
  const slot2 = document.getElementById('action-slot-2');
  const slot3 = document.getElementById('action-slot-3');
  const slot4 = document.getElementById('action-slot-4');

  // SLOT 1: Primary Context Action (Attack / Engage Threat / Sanctuary Rest)
  if (enc && enc.status === 'IN_COMBAT') {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = cStats.isRangedActive ? '🏹' : '⚔️';
    document.getElementById('slot1-title').textContent = cStats.activeWeapon.name;
    const atkB = cStats.isRangedActive ? cStats.rangedAttackBonus : cStats.meleeAttackBonus;
    document.getElementById('slot1-sub').textContent = `${atkB} • ${cStats.activeWeapon.damage_dice}`;
    slot1.title = `Attack with ${cStats.activeWeapon.name} [Space / 1]`;
  } else if (enc && enc.status === 'DISCOVERED') {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '⚔️';
    document.getElementById('slot1-title').textContent = enc.isAmbush ? 'Face Ambush' : 'Engage Threat';
    document.getElementById('slot1-sub').textContent = 'Reveal & Fight';
    slot1.title = 'Step forward into the mist and engage the threat [Space / 1]';
  } else if (state.isSafeCity) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '🛌';
    document.getElementById('slot1-title').textContent = 'Sanctuary Rest';
    document.getElementById('slot1-sub').textContent = hero.current_hp < hero.max_hp ? 'Restore Full HP' : 'Full Vitality';
    slot1.title = 'Rest at Oakhaven Sanctuary to restore full HP and Cleric prayers [Space / 1]';
  } else {
    slot1.disabled = true;
    document.getElementById('slot1-icon').textContent = cStats.isRangedActive ? '🏹' : '🗡️';
    document.getElementById('slot1-title').textContent = cStats.activeWeapon.name;
    document.getElementById('slot1-sub').textContent = 'No Threat Here';
    slot1.title = 'No active enemy on this tile — use W/A/S/D/Q/E to explore';
  }

  // SLOT 2: Quick Potion Flask
  const hasPotions = state.combatPotionCount > 0;
  const atFullHp = hero.current_hp >= hero.max_hp;
  const canDrinkInCombat = enc && enc.status === 'IN_COMBAT' && hasPotions;
  const canDrinkOut = !enc && hasPotions && !atFullHp;
  slot2.disabled = !(canDrinkInCombat || canDrinkOut);
  document.getElementById('slot2-title').textContent = 'Drink Potion';

  if (!hasPotions) {
    document.getElementById('slot2-sub').textContent = 'None in Pack';
    slot2.title = 'No Healing Potions remaining in backpack';
  } else if (!enc && atFullHp) {
    document.getElementById('slot2-sub').textContent = `${state.combatPotionCount}× (Full HP)`;
    slot2.title = 'Already at full Vitality';
  } else {
    document.getElementById('slot2-sub').textContent = `${state.combatPotionCount}× (${state.combatPotions[0].healEffect || '1d8+1'})`;
    slot2.title = 'Drink a Healing Potion [2]';
  }

  // SLOT 3: Dedicated Stance Toggle (Single place in the UI)
  slot3.disabled = Boolean(enc);
  document.getElementById('slot3-icon').textContent = cStats.isRangedActive ? '🗡️' : '🏹';
  document.getElementById('slot3-title').textContent = 'Swap Stance';
  if (enc) {
    document.getElementById('slot3-sub').textContent = 'Locked in Combat';
    slot3.title = 'Cannot swap weapon stance during an active encounter';
  } else {
    document.getElementById('slot3-sub').textContent = cStats.isRangedActive ? 'To Melee' : 'To Ranged';
    slot3.title = 'Toggle between Melee and Ranged weapon stance [3 / R]';
  }

  // SLOT 4: Retreat / Slip Past / Cleric Prayer
  if (enc && enc.status === 'IN_COMBAT') {
    slot4.disabled = false;
    document.getElementById('slot4-icon').textContent = '🏃';
    document.getElementById('slot4-title').textContent = fleeConfirmArmed ? 'Confirm Flee?' : 'Flee Battle';
    document.getElementById('slot4-sub').textContent = fleeConfirmArmed ? 'Press [4/F] Again' : 'Provokes AoO';
    slot4.title = 'Attempt to flee combat (monster gets a parting attack of opportunity) [4 / F]';
  } else if (enc && enc.status === 'DISCOVERED') {
    slot4.disabled = Boolean(enc.isAmbush);
    document.getElementById('slot4-icon').textContent = '👣';
    document.getElementById('slot4-title').textContent = 'Slip Past';
    document.getElementById('slot4-sub').textContent = enc.isAmbush ? 'Ambush Locked!' : 'Bypass Threat';
    slot4.title = enc.isAmbush
      ? 'Ambush! You cannot slip past — you must engage the threat'
      : 'Slip past the unidentified threat without fighting (or simply walk with W/S/Q/E) [4 / F]';
  } else if (hero.class === 'CLERIC' && state.clericHealInfo) {
    const canHeal = state.clericHealInfo.remainingUses > 0 && hero.current_hp < hero.max_hp;
    slot4.disabled = !canHeal;
    document.getElementById('slot4-icon').textContent = '✨';
    document.getElementById('slot4-title').textContent = 'Divine Heal';
    document.getElementById('slot4-sub').textContent = state.clericHealInfo.remainingUses === 0
      ? '0 Prayers Left'
      : (hero.current_hp >= hero.max_hp ? 'Full HP' : `${state.clericHealInfo.remainingUses}/${state.clericHealInfo.maxUses} (${state.clericHealInfo.dice})`);
    slot4.title = canHeal ? 'Channel Cleric Divine Heal [4 / F]' : 'Requires missing HP and available daily prayers';
  } else {
    slot4.disabled = true;
    document.getElementById('slot4-icon').textContent = '🏃';
    document.getElementById('slot4-title').textContent = 'Retreat';
    document.getElementById('slot4-sub').textContent = 'No Threat';
    slot4.title = 'Available when an encounter or combat is active';
  }

  // First-Person Navigation Pad (Turn Left/Right, Forward/Backward, Strafe Left/Right)
  const relMoves = (state.viewportScene && state.viewportScene.relativeMoves) || {};
  const isMoveLockedByCombat = Boolean(enc && (enc.status === 'IN_COMBAT' || enc.isAmbush));

  const leftCard = relMoves.STRAFE_LEFT ? relMoves.STRAFE_LEFT.cardinal : 'WEST';
  const rightCard = relMoves.STRAFE_RIGHT ? relMoves.STRAFE_RIGHT.cardinal : 'EAST';
  const fwdCard = relMoves.FORWARD ? relMoves.FORWARD.cardinal : 'NORTH';
  const backCard = relMoves.BACKWARD ? relMoves.BACKWARD.cardinal : 'SOUTH';

  document.getElementById('lbl-turn-left').textContent = `Turn ${leftCard[0]}`;
  document.getElementById('lbl-turn-right').textContent = `Turn ${rightCard[0]}`;
  document.getElementById('lbl-forward').textContent = `Forward (${fwdCard[0]})`;
  document.getElementById('lbl-backward').textContent = `Back (${backCard[0]})`;
  document.getElementById('lbl-strafe-left').textContent = `Strafe (${leftCard[0]})`;
  document.getElementById('lbl-strafe-right').textContent = `Strafe (${rightCard[0]})`;

  document.getElementById('pad-center-glyph').textContent = fMeta.arrow;
  document.getElementById('pad-center-lbl').textContent = facing;

  const padMap = [
    { id: 'pad-forward', rel: 'FORWARD', label: 'Forward' },
    { id: 'pad-backward', rel: 'BACKWARD', label: 'Backward' },
    { id: 'pad-strafe-left', rel: 'STRAFE_LEFT', label: 'Strafe Left' },
    { id: 'pad-strafe-right', rel: 'STRAFE_RIGHT', label: 'Strafe Right' }
  ];

  padMap.forEach(({ id, rel, label }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const mInfo = relMoves[rel];
    const canStep = !isMoveLockedByCombat && mInfo && mInfo.available;
    btn.classList.toggle('is-blocked-dir', !canStep);
    if (isMoveLockedByCombat) {
      btn.title = enc.isAmbush
        ? 'Ambush! You cannot move away without facing the threat'
        : 'Locked in melee combat — use Flee [4/F] to retreat';
    } else if (mInfo) {
      btn.title = mInfo.available
        ? `${label} (${mInfo.cardinal}): ${mInfo.tileName}${enc && enc.status === 'DISCOVERED' ? ' (Slips past threat)' : ''}`
        : `Blocked (${mInfo.cardinal}): ${mInfo.reason}`;
    }
  });

  // Update Single Pack Counter
  const packLbl = document.getElementById('util-pack-lbl');
  if (packLbl) {
    packLbl.textContent = `🎒 Pack (${state.inventory.length})`;
  }
}

/* =========================================================================
   11. ACTION DECK CLICK HANDLERS
   ========================================================================= */
function handleSlot1Click() {
  if (!currentState) return;
  const enc = currentState.encounter;
  if (enc && enc.status === 'IN_COMBAT') {
    dispatchAction('ATTACK');
  } else if (enc && enc.status === 'DISCOVERED') {
    dispatchAction('INVESTIGATE');
  } else if (currentState.victory) {
    dispatchAction('DISMISS_VICTORY');
  } else if (currentState.isSafeCity) {
    dispatchAction('REST');
  }
}

function handleSlot2Click() {
  if (!currentState) return;
  dispatchAction('POTION');
}

function handleSlot3Click() {
  if (!currentState || currentState.encounter) return;
  dispatchAction('STANCE');
}

function handleSlot4Click() {
  if (!currentState) return;
  const enc = currentState.encounter;
  if (enc && enc.status === 'IN_COMBAT') {
    if (!fleeConfirmArmed) {
      fleeConfirmArmed = true;
      renderActionDeckAndPad(currentState);
      clearTimeout(fleeConfirmTimer);
      fleeConfirmTimer = setTimeout(() => {
        fleeConfirmArmed = false;
        if (currentState) renderActionDeckAndPad(currentState);
      }, 3500);
      return;
    }
    fleeConfirmArmed = false;
    dispatchAction('FLEE');
  } else if (enc && enc.status === 'DISCOVERED' && !enc.isAmbush) {
    dispatchAction('IGNORE');
  } else if (!enc && currentState.character.class === 'CLERIC') {
    dispatchAction('CLERIC_HEAL');
  }
}

function renderFallenScreen(state) {
  const stage = document.getElementById('fp-center-stage');
  const fallen = state.fallen || { name: 'Fallen Hero', class: 'FIGHTER', level: 1, killer_name: 'a lurker in the dark' };
  stage.innerHTML = `
    <div class="fp-threat-whisper-plate" style="border-color: var(--accent-crimson-bright); max-width: 520px; padding: 18px 24px;">
      <div style="font-size: 2.2rem; margin-bottom: 4px;">💀</div>
      <div style="font-family: var(--font-serif); font-size: 1.2rem; color: #fca5a5; font-weight: 800;">
        YOU HAVE FALLEN IN BATTLE
      </div>
      <p style="font-size: 0.86rem; color: var(--text-body); margin: 8px 0;">
        <strong>${escapeHtml(fallen.name)}</strong> (${escapeHtml(fallen.class)} • Level ${fallen.level}) was slain by <strong>${escapeHtml(fallen.killer_name || 'an unknown horror')}</strong>.
      </p>
      <div style="display: flex; justify-content: center; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
        <button type="button" class="btn-action-gold" onclick="dispatchAction('REVIVE', { classType: 'FIGHTER' })">
          ⚔️ Rise Again (Fighter)
        </button>
        <button type="button" class="btn-action-stone" onclick="dispatchAction('REVIVE', { classType: 'RANGER' })">
          🏹 Rise Again (Ranger)
        </button>
        <button type="button" class="btn-action-stone" onclick="dispatchAction('REVIVE', { classType: 'CLERIC' })">
          ✨ Rise Again (Cleric)
        </button>
      </div>
    </div>
  `;
}

/* =========================================================================
   12. MODAL DRAWERS (Character, Backpack, Market, Watcher's Board)
   ========================================================================= */
let currentOpenModal = null;

function openLabModal(modalName) {
  currentOpenModal = modalName;
  const backdrop = document.getElementById('lab-modal-backdrop');
  const card = backdrop ? backdrop.querySelector('.lab-modal-card') : null;
  if (card) {
    card.classList.toggle(
      'is-wide-modal',
      modalName === 'atlas' || modalName === 'qa' || modalName === 'journal' || modalName === 'director'
    );
  }
  backdrop.hidden = false;
  renderModalContent(modalName);
}

function closeLabModal() {
  currentOpenModal = null;
  const backdrop = document.getElementById('lab-modal-backdrop');
  if (backdrop) backdrop.hidden = true;
}

function renderModalContent(modalName) {
  const titleEl = document.getElementById('lab-modal-title');
  const bodyEl = document.getElementById('lab-modal-body');
  if (!titleEl || !bodyEl) return;

  if (modalName === 'atlas') {
    renderAtlasModal(titleEl, bodyEl);
    return;
  }
  if (modalName === 'qa') {
    renderVisualQaModal(titleEl, bodyEl);
    return;
  }
  if (modalName === 'journal') {
    renderJournalModal(titleEl, bodyEl);
    return;
  }
  if (modalName === 'director') {
    renderDirectorModal(titleEl, bodyEl);
    return;
  }

  if (!currentState || !currentState.character) return;
  const hero = currentState.character;
  const mods = currentState.modifiers;

  if (modalName === 'character') {
    titleEl.textContent = `👤 Champion Record — ${hero.name}`;
    bodyEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
        <div class="lab-item-row"><span>STR: <strong>${hero.strength}</strong></span><span style="color:var(--accent-gold);">${mods.strength}</span></div>
        <div class="lab-item-row"><span>CON: <strong>${hero.constitution}</strong></span><span style="color:var(--accent-gold);">${mods.constitution}</span></div>
        <div class="lab-item-row"><span>DEX: <strong>${hero.dexterity}</strong></span><span style="color:var(--accent-gold);">${mods.dexterity}</span></div>
        <div class="lab-item-row"><span>INT: <strong>${hero.intelligence}</strong></span><span style="color:var(--accent-gold);">${mods.intelligence}</span></div>
        <div class="lab-item-row"><span>WIS: <strong>${hero.wisdom}</strong></span><span style="color:var(--accent-gold);">${mods.wisdom}</span></div>
        <div class="lab-item-row"><span>CHA: <strong>${hero.charisma}</strong></span><span style="color:var(--accent-gold);">${mods.charisma}</span></div>
      </div>
      <div class="lab-item-row" style="margin-top: 6px;">
        <span>Current Facing: <strong>${escapeHtml(currentState.facing || 'NORTH')}</strong> • Coordinates: <strong>[${currentState.currentTile.x}, ${currentState.currentTile.y}]</strong></span>
      </div>
      <div class="lab-item-row" style="margin-top: 6px;">
        <span>Active Combat Stance: <strong>${hero.primary_weapon}</strong></span>
        <button type="button" class="btn-action-stone" style="padding: 4px 10px; font-size: 0.78rem;" onclick="dispatchAction('STANCE')" ${currentState.encounter ? 'disabled' : ''}>
          Swap Stance [3 / R]
        </button>
      </div>
    `;
  } else if (modalName === 'backpack') {
    titleEl.textContent = `🎒 Equipment & Backpack (${currentState.inventory.length}/50)`;
    const locked = Boolean(currentState.encounter);
    bodyEl.innerHTML = currentState.inventory.map(item => `
      <div class="lab-item-row">
        <div>
          <div style="font-weight: 700; color: var(--text-heading);">
            ${item.equipped_slot ? `<span style="color:var(--accent-gold);">[${escapeHtml(item.equipped_slot)}]</span> ` : ''}
            ${escapeHtml(item.name)}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.category)} ${item.description ? '• ' + escapeHtml(item.description) : ''}</div>
        </div>
        <div>
          ${item.equipped_slot ? `
            <button type="button" class="btn-action-stone" style="padding: 4px 10px; font-size: 0.75rem;" ${locked ? 'disabled' : ''} onclick="dispatchAction('UNEQUIP', { itemInstanceId: ${item.id} })">Unequip</button>
          ` : (item.category === 'POTION' ? `
            <button type="button" class="btn-action-gold" style="padding: 4px 10px; font-size: 0.75rem;" onclick="dispatchAction('POTION', { potionInstanceId: ${item.id} })">🧪 Drink</button>
          ` : `
            <button type="button" class="btn-action-stone" style="padding: 4px 10px; font-size: 0.75rem;" ${locked ? 'disabled' : ''} onclick="dispatchAction('EQUIP', { itemInstanceId: ${item.id} })">Equip</button>
          `)}
        </div>
      </div>
    `).join('');
  } else if (modalName === 'market') {
    titleEl.textContent = `🛒 Oakhaven Market (Purse: ${hero.gold} gp)`;
    if (!currentState.isSafeCity || !currentState.shopStock) {
      bodyEl.innerHTML = `<div class="lab-item-row"><span>Return to Oakhaven Sanctuary to trade with merchants.</span><button class="btn-action-gold" onclick="triggerLabScenario('CITY')">Teleport to Oakhaven</button></div>`;
      return;
    }
    const items = currentState.shopStock.standardItems || [];
    bodyEl.innerHTML = items.slice(0, 20).map(item => `
      <div class="lab-item-row">
        <div>
          <div style="font-weight: 700; color: var(--text-heading);">${escapeHtml(item.name)}</div>
          <div style="font-size: 0.75rem; color: var(--accent-gold);">${item.buy_price} gp • ${escapeHtml(item.category)}</div>
        </div>
        <button type="button" class="btn-action-gold" style="padding: 4px 12px; font-size: 0.75rem;" ${hero.gold < item.buy_price ? 'disabled' : ''} onclick="dispatchAction('BUY', { itemDefinitionId: ${item.id} })">Buy</button>
      </div>
    `).join('');
  } else if (modalName === 'bounties') {
    titleEl.textContent = `🎯 The Watcher's Board & Bounties`;
    if (!currentState.isSafeCity) {
      bodyEl.innerHTML = `<div class="lab-item-row"><span>Visit Oakhaven Sanctuary to inspect hunting contracts.</span><button class="btn-action-gold" onclick="triggerLabScenario('CITY')">Teleport to Oakhaven</button></div>`;
      return;
    }
    const contracts = currentState.bountyContracts || [];
    bodyEl.innerHTML = contracts.map(c => `
      <div class="lab-item-row">
        <div>
          <div style="font-weight: 700; color: var(--text-heading);">${escapeHtml(c.contract_title)} <span class="lab-badge">${escapeHtml(c.status)}</span></div>
          <div style="font-size: 0.76rem; color: var(--text-muted);">Region: <strong>${escapeHtml(c.target_region)}</strong> • Reward: <strong style="color:var(--accent-gold);">${c.reward_gold} gp</strong></div>
        </div>
        ${c.status === 'AVAILABLE' && !currentState.activeContract ? `
          <button type="button" class="btn-action-gold" style="padding: 4px 10px; font-size: 0.75rem;" onclick="dispatchAction('ACCEPT_BOUNTY', { contractId: ${c.id} })">Accept</button>
        ` : ''}
      </div>
    `).join('');
  }
}

/* =========================================================================
   12.5 WORLD VISUAL ATLAS & VISUAL QA DEVELOPER TOOLS (Phases 1 & 6)
   ========================================================================= */
function selectAtlasTile(x, y) {
  selectedAtlasCoord = { x: Number(x), y: Number(y) };
  if (currentOpenModal === 'atlas') {
    const titleEl = document.getElementById('lab-modal-title');
    const bodyEl = document.getElementById('lab-modal-body');
    if (titleEl && bodyEl) renderAtlasModal(titleEl, bodyEl);
  }
}

function setAtlasFilter(filterKey) {
  currentAtlasFilter = filterKey;
  if (currentOpenModal === 'atlas') {
    const titleEl = document.getElementById('lab-modal-title');
    const bodyEl = document.getElementById('lab-modal-body');
    if (titleEl && bodyEl) renderAtlasModal(titleEl, bodyEl);
  }
}

async function renderAtlasModal(titleEl, bodyEl) {
  titleEl.textContent = '🗺️ World Visual Atlas — First-Person POV Coverage & Inspector [V]';
  if (!cachedAtlasData) {
    bodyEl.innerHTML = '<div class="lab-item-row"><span>Loading 15×15 World Visual Atlas...</span></div>';
    try {
      const res = await fetch('/api/atlas');
      cachedAtlasData = await res.json();
    } catch (err) {
      bodyEl.innerHTML = `<div class="lab-item-row"><span>Failed to load World Visual Atlas: ${escapeHtml(err.message)}</span></div>`;
      return;
    }
  }

  const atlas = cachedAtlasData;
  const sum = atlas.summary || {};
  const tiles = atlas.tiles || [];

  // Default selected tile to current hero tile if not yet selected
  if (!selectedAtlasCoord || typeof selectedAtlasCoord.x !== 'number') {
    if (currentState && currentState.currentTile) {
      selectedAtlasCoord = { x: currentState.currentTile.x, y: currentState.currentTile.y };
    } else {
      selectedAtlasCoord = { x: 7, y: 7 };
    }
  }

  const tileByKey = new Map();
  tiles.forEach(t => tileByKey.set(`${t.x},${t.y}`, t));
  const selectedTile = tileByKey.get(`${selectedAtlasCoord.x},${selectedAtlasCoord.y}`) || tiles[0];

  const heroX = currentState && currentState.currentTile ? currentState.currentTile.x : -1;
  const heroY = currentState && currentState.currentTile ? currentState.currentTile.y : -1;

  // Build 15x15 Grid HTML
  const gridCellsHtml = [];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const t = tileByKey.get(`${x},${y}`);
      if (!t) continue;
      const isSelected = (x === selectedTile.x && y === selectedTile.y);
      const isHero = (x === heroX && y === heroY);
      const bestGrade = t.bestGrade || 'C';

      let matchesFilter = true;
      if (currentAtlasFilter === 'A') {
        matchesFilter = Object.values(t.directions || {}).some(d => d.qualityGrade === 'A');
      } else if (currentAtlasFilter === 'B') {
        matchesFilter = Object.values(t.directions || {}).some(d => d.qualityGrade === 'B');
      } else if (currentAtlasFilter === 'C') {
        matchesFilter = Object.values(t.directions || {}).some(d => d.qualityGrade === 'C');
      } else if (currentAtlasFilter === 'POI') {
        matchesFilter = Boolean(t.hasPoi);
      } else if (currentAtlasFilter === 'PASSABLE') {
        matchesFilter = Boolean(t.isPassable);
      }

      const cellClasses = [
        'atlas-cell',
        !t.isPassable ? 'is-impassable' : '',
        t.isPassable ? `grade-${bestGrade.toLowerCase()}-tile` : '',
        isSelected ? 'is-selected' : '',
        isHero ? 'is-hero-here' : ''
      ].filter(Boolean).join(' ');

      const dimStyle = matchesFilter ? '' : 'opacity: 0.18;';
      const poiDot = t.hasPoi ? '<span class="atlas-cell-poi-dot" title="Point of Interest"></span>' : '';
      const gradeBadge = t.isPassable ? `<span class="atlas-cell-grade">${escapeHtml(bestGrade)}</span>` : '';

      gridCellsHtml.push(`
        <div class="${cellClasses}"
             style="${dimStyle}"
             onclick="selectAtlasTile(${x}, ${y})"
             title="[${x},${y}] ${escapeHtml(t.name)} (${escapeHtml(t.terrain)}) • Best Grade: ${bestGrade}">
          ${poiDot}
          <span>${escapeHtml(t.symbol || '·')}</span>
          ${gradeBadge}
        </div>
      `);
    }
  }

  // Build Selected Tile 4-Direction Inspector
  const dirs = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
  const dirCardsHtml = dirs.map(dir => {
    const dInfo = (selectedTile.directions && selectedTile.directions[dir]) || {};
    const grade = dInfo.qualityGrade || 'C';
    const ahead = dInfo.aheadTile || {};
    const poi = dInfo.pointOfInterest;
    const eff = dInfo.effectProfile || {};
    return `
      <div class="atlas-dir-card">
        <div class="atlas-dir-thumb-wrap">
          <img src="${escapeHtml(dInfo.imageUrl || '')}" alt="${escapeHtml(selectedTile.name)} ${dir}" class="atlas-dir-thumb" loading="lazy">
          <span class="atlas-dir-badge">${dir}</span>
          <span class="atlas-grade-badge grade-${grade}">${grade}: ${escapeHtml(dInfo.qualityLabel || '')}</span>
        </div>
        <div class="atlas-dir-meta">
          <div class="atlas-dir-title">${escapeHtml(dInfo.viewTitle || selectedTile.name)}</div>
          <div class="atlas-dir-sub">${escapeHtml(dInfo.viewSubtitle || '')}</div>
          <div class="atlas-dir-tags">
            <span class="atlas-tag">Tier ${dInfo.povTier || 4} (${escapeHtml(dInfo.sourceType || 'Fallback')})</span>
            <span class="atlas-tag">Ahead: ${escapeHtml(ahead.name || 'Edge')} (${ahead.isPassable ? 'Open' : 'Blocked'})</span>
            <span class="atlas-tag">Surface: ${escapeHtml((dInfo.stageAnchor && dInfo.stageAnchor.groundSurfaceType) || 'wilderness-soil')}</span>
            <span class="atlas-tag">FX: ${escapeHtml(eff.label || 'None')}</span>
            ${poi ? `<span class="atlas-tag" style="color:#fde68a; border-color:#c5a059;">🔍 POI: ${escapeHtml(poi.title)}</span>` : ''}
          </div>
          ${selectedTile.isPassable ? `
            <div style="margin-top: 4px; display: flex; justify-content: flex-end;">
              <button type="button" class="btn-action-gold" style="padding: 3px 9px; font-size: 0.68rem;" onclick="triggerTeleport(${selectedTile.x}, ${selectedTile.y}, '${dir}')">
                ⚡ Teleport (${dir})
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  const pCounts = sum.passableGradeCounts || { A: 0, B: 0, C: 0, D: 0 };

  bodyEl.innerHTML = `
    <div class="atlas-summary-strip">
      <div class="atlas-stat-pill">
        <span class="stat-val">${sum.passableViewpoints || 640}</span>
        <span class="stat-lbl">Passable POVs (${sum.passableTiles || 160} Tiles)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:#86efac;">${pCounts.A || 0}</span>
        <span class="stat-lbl">Grade A (Bespoke POV)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:#93c5fd;">${pCounts.B || 0}</span>
        <span class="stat-lbl">Grade B (Contextual POV)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:#fde68a;">${pCounts.C || 0}</span>
        <span class="stat-lbl">Grade C (Generic Safe)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:${(pCounts.D || 0) === 0 ? '#86efac' : '#fca5a5'};">${pCounts.D || 0}</span>
        <span class="stat-lbl">Grade D (Needs Art)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${sum.uniqueImagesUsed || 0}</span>
        <span class="stat-lbl">Unique Paintings Used</span>
      </div>
    </div>

    <div class="atlas-filter-bar">
      <span style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">Filter Map:</span>
      ${[
        { key: 'ALL', label: 'All Tiles (225)' },
        { key: 'PASSABLE', label: `Passable (${sum.passableTiles || 160})` },
        { key: 'A', label: 'Has Grade A Bespoke' },
        { key: 'B', label: 'Has Grade B Contextual' },
        { key: 'C', label: 'Has Grade C Generic' },
        { key: 'POI', label: `🔍 Points of Interest (${sum.pointsOfInterestCount || 0})` }
      ].map(f => `
        <button type="button"
                class="lab-btn ${currentAtlasFilter === f.key ? 'is-active-mode' : ''}"
                onclick="setAtlasFilter('${f.key}')">
          ${escapeHtml(f.label)}
        </button>
      `).join('')}
    </div>

    <div class="atlas-layout">
      <div class="atlas-grid-panel">
        <div style="font-family:var(--font-serif); font-size:0.78rem; color:var(--accent-gold); font-weight:700;">
          15×15 World Grid (Click any tile to inspect 4 directions)
        </div>
        <div class="atlas-15x15-grid" id="atlas-15x15-grid">
          ${gridCellsHtml.join('')}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.66rem; color:var(--text-muted); font-family:var(--font-mono);">
          <span>🟢 Grade A • 🔵 Grade B • 🟡 Grade C</span>
          <span>🟡 Dot = Inspectable POI</span>
        </div>
      </div>

      <div class="atlas-inspector-panel" id="atlas-inspector-panel">
        <div class="atlas-inspector-header">
          <div>
            <div style="font-family:var(--font-serif); font-size:0.95rem; font-weight:700; color:var(--accent-gold-bright);">
              [${selectedTile.x}, ${selectedTile.y}] ${escapeHtml(selectedTile.name)}
            </div>
            <div style="font-size:0.73rem; color:var(--text-muted);">
              Terrain: <strong>${escapeHtml(selectedTile.terrain)}</strong> • Sub-Biome: <strong>${escapeHtml(selectedTile.subBiome)}</strong> • ${selectedTile.isPassable ? 'Passable' : 'Impassable Barrier'}
            </div>
          </div>
          ${selectedTile.isPassable ? `
            <button type="button" class="btn-action-gold" style="padding: 5px 12px; font-size: 0.74rem;" onclick="triggerTeleport(${selectedTile.x}, ${selectedTile.y}, 'NORTH')">
              ⚡ Teleport to [${selectedTile.x}, ${selectedTile.y}]
            </button>
          ` : ''}
        </div>
        <div class="atlas-dir-grid">
          ${dirCardsHtml}
        </div>
      </div>
    </div>
  `;
}

async function renderVisualQaModal(titleEl, bodyEl) {
  titleEl.textContent = '📊 Visual QA & Expedition Verification Suite';
  bodyEl.innerHTML = '<div class="lab-item-row"><span>Loading Visual QA & Asset Verification Report...</span></div>';
  try {
    const res = await fetch('/api/visual-qa');
    const qa = await res.json();
    const sum = qa.atlasSummary || {};
    const pCounts = sum.passableGradeCounts || {};
    const monsters = qa.integratedMonsters || [];
    const pois = qa.pointsOfInterest || [];
    const fxProfiles = qa.atmosphereProfiles || [];
    const results = qa.automatedVisualQaResults;

    bodyEl.innerHTML = `
      <div class="atlas-summary-strip">
        <div class="atlas-stat-pill">
          <span class="stat-val" style="color:#86efac;">${(pCounts.D || 0) === 0 ? '100% PASS' : 'WARN'}</span>
          <span class="stat-lbl">Zero Grade-D Views (${pCounts.D || 0} Missing)</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val">${sum.uniqueImagesUsed || 0}</span>
          <span class="stat-lbl">Active Environment Paintings</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val">${monsters.length}</span>
          <span class="stat-lbl">Integrated Cutout Monsters</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val">${fxProfiles.length}</span>
          <span class="stat-lbl">Atmospheric Effect Profiles</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val">${pois.length}</span>
          <span class="stat-lbl">Inspectable Lore Landmarks</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val" style="color:#86efac;">${results ? `${results.passedChecks}/${results.totalChecks}` : 'Ready'}</span>
          <span class="stat-lbl">Headless Chrome Checks</span>
        </div>
      </div>

      <div style="font-family:var(--font-serif); font-size:0.84rem; color:var(--accent-gold); font-weight:700; margin-top:4px;">
        👹 Integrated Monster Cutout Rigs (${monsters.length} Active + Automatic Card Fallback)
      </div>
      <div class="qa-section-grid">
        ${monsters.map(m => `
          <div class="qa-card">
            <div class="qa-card-title">
              <span>${escapeHtml(m.key)}</span>
              <span class="qa-pass-badge">${escapeHtml(m.groundingMode)}</span>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted);">
              Size: <strong>${escapeHtml(m.sizeCategory)}</strong> • Contact Patches: <strong>${m.contactCount}</strong><br>
              Asset: <code>${escapeHtml(m.cutoutImageUrl)}</code>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="font-family:var(--font-serif); font-size:0.84rem; color:var(--accent-gold); font-weight:700; margin-top:6px;">
        🔍 Inspectable Points of Interest (${pois.length} Landmarks)
      </div>
      <div class="qa-section-grid">
        ${pois.map(p => `
          <div class="qa-card">
            <div class="qa-card-title">
              <span>${escapeHtml(p.title)}</span>
              <button type="button" class="btn-action-gold" style="padding:2px 8px; font-size:0.66rem;" onclick="triggerTeleport(${p.x}, ${p.y}, '${(p.facings && p.facings[0]) || 'NORTH'}')">
                ⚡ Visit [${p.x},${p.y}]
              </button>
            </div>
            <div style="font-size:0.71rem; color:var(--text-muted);">
              Category: <strong>${escapeHtml(p.category)}</strong> • Facings: <strong>${escapeHtml((p.facings || []).join(', '))}</strong>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    bodyEl.innerHTML = `<div class="lab-item-row"><span>Failed to load Visual QA data: ${escapeHtml(err.message)}</span></div>`;
  }
}

/* =========================================================================
   12.6 EXPEDITION JOURNAL & DIRECTOR DRAWERS (Phase 3 — Adventure Experience)
   ========================================================================= */
function renderJournalModal(titleEl, bodyEl) {
  titleEl.textContent = '📖 Expedition Journal & Adventure Memory [L]';
  const adv = (currentState && currentState.adventure) || {};
  const isEnabled = Boolean(adv.enabled);
  const exp = adv.expedition;
  const availableExps = adv.availableExpeditions || [];
  const journal = adv.journal || [];
  const stats = adv.stats || {};

  const expSelectorHtml = availableExps.map(def => {
    const isActive = exp && exp.key === def.key;
    return `
      <div class="journal-exp-card ${isActive ? 'is-active-exp' : ''}">
        <div class="journal-exp-header">
          <div>
            <div class="journal-exp-title">🧭 ${escapeHtml(def.title)}</div>
            <div class="journal-exp-sub">${escapeHtml(def.subtitle)}</div>
          </div>
          <button type="button"
                  class="${isActive ? 'btn-action-gold' : 'btn-action-stone'}"
                  style="padding: 4px 10px; font-size: 0.72rem;"
                  onclick="startExpeditionRoute('${escapeHtml(def.key)}')">
            ${isActive ? '↻ Restart Expedition' : '▶ Embark'}
          </button>
        </div>
        <p class="journal-exp-summary">${escapeHtml(def.summary)}</p>
      </div>
    `;
  }).join('');

  const waypointsHtml = exp
    ? (exp.waypoints || []).map((wp, idx) => `
        <div class="journal-waypoint-row ${wp.completed ? 'is-done' : ''}">
          <span class="wp-status-icon">${wp.completed ? '✓' : (idx + 1)}</span>
          <div class="wp-meta">
            <div class="wp-label">${escapeHtml(wp.label)} <span style="font-family:var(--font-mono); color:var(--text-muted);">[${wp.x},${wp.y}]</span></div>
            <div class="wp-prompt">${escapeHtml(wp.prompt)}</div>
          </div>
          ${wp.completed ? `<span class="qa-pass-badge">Reached (Step ${wp.completedAtStep || 0})</span>` : ''}
        </div>
      `).join('')
    : '<div class="lab-item-row"><span>Select an Expedition Route above to track waypoints.</span></div>';

  const journalRowsHtml = journal.length > 0
    ? journal.slice(0, 25).map(entry => {
        const typeBadgeMap = {
          EXPEDITION_START: { icon: '🧭', label: 'Expedition Embarked', color: '#93c5fd' },
          WAYPOINT: { icon: '🚩', label: 'Waypoint Reached', color: '#86efac' },
          EXPEDITION_COMPLETE: { icon: '🏆', label: 'Expedition Complete', color: '#fde68a' },
          DISCOVERY: { icon: '🔍', label: 'Field Discovery', color: '#e6be6e' },
          CHOICE: { icon: '⚖️', label: 'Decision Taken', color: '#c4b5fd' },
          POI_INSPECTED: { icon: '🏛️', label: 'Landmark Inspected', color: '#fde68a' },
          ENCOUNTER_START: { icon: '👁️', label: 'Threat Encountered', color: '#fca5a5' },
          ENCOUNTER_VICTORY: { icon: '⚔️', label: 'Threat Vanquished', color: '#86efac' },
          ENCOUNTER_FLEE: { icon: '🏃', label: 'Retreated Alive', color: '#cbd5e1' },
          ENCOUNTER_DEFEAT: { icon: '💀', label: 'Fallen in Battle', color: '#ef4444' }
        };
        const meta = typeBadgeMap[entry.type] || { icon: '•', label: entry.type || 'Note', color: '#c5a059' };
        return `
          <div class="journal-log-entry">
            <div class="journal-log-top">
              <span class="journal-log-badge" style="color:${meta.color}; border-color:${meta.color}44;">${meta.icon} ${escapeHtml(meta.label)}</span>
              <span class="journal-log-title">${escapeHtml(entry.title)}</span>
              <span class="journal-log-coord">${entry.coords ? `[${entry.coords.x},${entry.coords.y}]` : ''} • Step ${entry.step || 0}</span>
            </div>
            <div class="journal-log-detail">${escapeHtml(entry.detail)}</div>
          </div>
        `;
      }).join('')
    : '<div class="lab-item-row"><span>No expedition field notes recorded yet. Step out from Oakhaven to begin your chronicle.</span></div>';

  bodyEl.innerHTML = `
    <div class="atlas-summary-strip">
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:${isEnabled ? '#86efac' : '#fde68a'};">${isEnabled ? 'ADVENTURE ★' : 'CURRENT'}</span>
        <span class="stat-lbl">Active Experience Mode</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.stepsTaken || 0}</span>
        <span class="stat-lbl">Expedition Steps</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.discoveriesFound || 0} / ${adv.totalDiscoveriesInCatalog || 18}</span>
        <span class="stat-lbl">Field Discoveries Found</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.choicesResolved || 0}</span>
        <span class="stat-lbl">Contextual Decisions</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.poisInspectedCount || 0}</span>
        <span class="stat-lbl">Landmarks Inspected</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.encountersWon || 0}W / ${stats.encountersFled || 0}F</span>
        <span class="stat-lbl">Combat Encounters</span>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
      <div style="font-size:0.76rem; color:var(--text-muted);">
        Compare <strong>Current Experience</strong> (baseline exploration) vs. <strong>Adventure Experience ★</strong> (discoveries, tension tiers, choices & expedition arcs).
      </div>
      <div style="display:flex; gap:6px;">
        <button type="button" class="lab-btn ${!isEnabled ? 'is-active-mode' : ''}" onclick="setAdventureExperienceMode(false)">Use Current Experience</button>
        <button type="button" class="lab-btn ${isEnabled ? 'is-active-mode' : ''}" onclick="setAdventureExperienceMode(true)">Use Adventure Experience ★</button>
        <button type="button" class="btn-action-stone" style="padding:3px 9px; font-size:0.7rem;" onclick="resetExpeditionRoute(true)">↺ Reset Log & Return to Oakhaven</button>
      </div>
    </div>

    <div class="journal-modal-grid">
      <div class="journal-column">
        <div class="journal-section-heading">🧭 Playable Expedition Arcs</div>
        <div class="journal-exp-list">
          ${expSelectorHtml}
        </div>
        <div class="journal-section-heading" style="margin-top:6px;">
          🚩 Active Route Waypoints ${exp ? `— ${escapeHtml(exp.title)}` : ''}
        </div>
        <div class="journal-waypoint-list" id="journal-waypoint-list">
          ${waypointsHtml}
        </div>
      </div>

      <div class="journal-column">
        <div class="journal-section-heading">📜 Field Chronicle & Adventure Memory (${journal.length} Entries)</div>
        <div class="journal-log-list" id="journal-log-list">
          ${journalRowsHtml}
        </div>
      </div>
    </div>
  `;
}

function renderDirectorModal(titleEl, bodyEl) {
  titleEl.textContent = '🎬 Lab Director & Scenario Staging Controls [G]';
  const adv = (currentState && currentState.adventure) || {};
  bodyEl.innerHTML = `
    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:6px;">
      Stage combat encounters, test monster cutouts, trigger environmental discoveries, or teleport across the 15×15 Darkgrid world.
    </div>

    <div class="director-modal-grid">
      <div class="qa-card">
        <div class="qa-card-title"><span>⚡ Core Scenario Staging</span></div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          <button type="button" class="btn-action-gold" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('CITY'); closeLabModal();">🏰 Oakhaven Safe City</button>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('WILDERNESS'); closeLabModal();">🌲 Forest Trail [7,6]</button>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('SHADOW'); closeLabModal();">👁️ Shadow in Mist</button>
          <button type="button" class="btn-action-gold" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('COMBAT'); closeLabModal();">⚔️ Stage Active Combat</button>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('WOUNDED'); closeLabModal();">🩸 Critical HP (3 HP)</button>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('HEAL'); closeLabModal();">✨ Restore Full Vitals</button>
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>👹 Spawn Integrated Cutout Monster</span></div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          ${[
            { key: 'skeleton', label: '💀 Skeleton' },
            { key: 'zombie', label: '🧟 Zombie' },
            { key: 'giant_rat', label: '🐀 Giant Rat' },
            { key: 'giant_spider', label: '🕷️ Giant Spider' },
            { key: 'goblin', label: '👺 Goblin' },
            { key: 'cockatrice', label: '🐓 Cockatrice' },
            { key: 'stirge', label: '🦇 Stirge (Airborne)' },
            { key: 'assassin_vine', label: '🌿 Assassin Vine (Card Fallback)' }
          ].map(m => `
            <button type="button" class="btn-action-stone" style="padding:4px 9px; font-size:0.72rem;" onclick="triggerSpawnMonster('${m.key}'); closeLabModal();">
              ${escapeHtml(m.label)}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>🧭 Stage Environmental Discovery (Adventure Mode)</span></div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          ${[
            { id: 'disc_mirkwood_abandoned_camp', label: '⛺ Abandoned Scout Camp (Important)' },
            { id: 'disc_ancient_oak_sap_shrine', label: '🌳 Warden’s Hollow at Black Oak (Important)' },
            { id: 'disc_crossroads_frontier_sign', label: '🪵 Ranger Tally-Post (Noticeable)' },
            { id: 'disc_watchpost_garrison_ledger', label: '🏚️ Watchpost Guardroom (Important)' },
            { id: 'disc_bridge_parapet_gouges', label: '🌉 Breached Bridge Parapet (Noticeable)' },
            { id: 'disc_fen_submerged_gear', label: '🎒 Submerged Expedition Pack (Important)' },
            { id: 'disc_plains_wayfarer_shrine', label: '🕯️ Roadside Wayfarer Shrine (Important)' },
            { id: 'disc_forest_claw_bark', label: '🐾 Claw-Scored Trunk (Ambient)' }
          ].map(d => `
            <button type="button" class="btn-action-stone" style="padding:4px 9px; font-size:0.72rem;" onclick="forceTriggerDiscovery('${d.id}'); closeLabModal();">
              ${escapeHtml(d.label)}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>🎲 Deterministic Pacing Seed & Hero Class</span></div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; align-items:center;">
          <span style="font-size:0.72rem; color:var(--text-muted);">Current Seed: <code>${adv.deterministicSeed !== null && adv.deterministicSeed !== undefined ? adv.deterministicSeed : 'Live Random'}</code></span>
          <button type="button" class="lab-btn" onclick="setDeterministicSeed(42)">Seed #42 (Deterministic)</button>
          <button type="button" class="lab-btn" onclick="setDeterministicSeed(null)">Live Random</button>
          <button type="button" class="lab-btn" onclick="switchHeroClass('FIGHTER')">⚔️ Fighter</button>
          <button type="button" class="lab-btn" onclick="switchHeroClass('RANGER')">🏹 Ranger</button>
          <button type="button" class="lab-btn" onclick="switchHeroClass('CLERIC')">✨ Cleric</button>
        </div>
      </div>
    </div>
  `;
}

/* =========================================================================
   13. CONFLICT-FREE KEYBOARD SHORTCUTS
   - W / ArrowUp: Move Forward (relative to facing)
   - S / ArrowDown: Step Backward (relative to facing)
   - A / ArrowLeft: Turn 90° Counter-Clockwise
   - D / ArrowRight: Turn 90° Clockwise
   - Q: Strafe Left
   - E: Strafe Right
   - Space / 1: Primary Context Action (Strike / Engage / Rest)
   - 2: Drink Potion
   - 3 / R: Swap Stance
   - 4 / F: Flee / Bypass / Cleric Heal
   - I: Inspect Landmark Point of Interest (when present)
   - V: Open World Visual Atlas
   - C / B / M / J: Hero / Pack / Market / Watcher's Board
   ========================================================================= */
function isEditableTarget(target) {
  if (!target) return false;
  const tag = (target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

document.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  if (isEditableTarget(e.target)) return;

  const backdrop = document.getElementById('lab-modal-backdrop');
  const modalOpen = backdrop && !backdrop.hidden;

  if (e.key === 'Escape') {
    if (modalOpen) {
      e.preventDefault();
      closeLabModal();
    } else if (isSizeComparisonLabOpen) {
      e.preventDefault();
      toggleMonsterSizeComparisonLab(false);
    } else if (isPoiPlaqueOpen) {
      e.preventDefault();
      closePoiPlaque();
    }
    return;
  }

  // Do not trigger game navigation or action hotkeys while a modal dialog owns keyboard focus
  if (modalOpen) return;

  switch (e.key) {
    case 'w':
    case 'W':
    case 'ArrowUp':
      e.preventDefault();
      dispatchRelativeMove('FORWARD');
      break;
    case 's':
    case 'S':
    case 'ArrowDown':
      e.preventDefault();
      dispatchRelativeMove('BACKWARD');
      break;
    case 'a':
    case 'A':
    case 'ArrowLeft':
      e.preventDefault();
      dispatchTurn('LEFT');
      break;
    case 'd':
    case 'D':
    case 'ArrowRight':
      e.preventDefault();
      dispatchTurn('RIGHT');
      break;
    case 'q':
    case 'Q':
      e.preventDefault();
      dispatchRelativeMove('STRAFE_LEFT');
      break;
    case 'e':
    case 'E':
      e.preventDefault();
      dispatchRelativeMove('STRAFE_RIGHT');
      break;
    case ' ':
    case '1':
      e.preventDefault();
      handleSlot1Click();
      break;
    case '2':
      e.preventDefault();
      handleSlot2Click();
      break;
    case '3':
    case 'r':
    case 'R':
      e.preventDefault();
      handleSlot3Click();
      break;
    case '4':
    case 'f':
    case 'F':
      e.preventDefault();
      handleSlot4Click();
      break;
    case 'i':
    case 'I':
      e.preventDefault();
      triggerInspectPoi();
      break;
    case 'v':
    case 'V':
      e.preventDefault();
      openLabModal('atlas');
      break;
    case 'c':
    case 'C':
      e.preventDefault();
      openLabModal('character');
      break;
    case 'b':
    case 'B':
      e.preventDefault();
      openLabModal('backpack');
      break;
    case 'm':
    case 'M':
      e.preventDefault();
      openLabModal('market');
      break;
    case 'j':
    case 'J':
      e.preventDefault();
      openLabModal('bounties');
      break;
    case 'l':
    case 'L':
      e.preventDefault();
      openLabModal('journal');
      break;
    case 'g':
    case 'G':
      e.preventDefault();
      openLabModal('director');
      break;
    case 'z':
    case 'Z':
      e.preventDefault();
      toggleMonsterSizeComparisonLab();
      break;
  }
});

let resizeScaleDebounce = null;
window.addEventListener('resize', () => {
  if (resizeScaleDebounce) clearTimeout(resizeScaleDebounce);
  resizeScaleDebounce = setTimeout(() => {
    if (currentState && currentState.mode !== 'FALLEN' && !isSequencePlaying) {
      renderViewportCenterStage(currentState);
    }
  }, 80);
});

document.addEventListener('DOMContentLoaded', () => {
  syncEffectsButtons(currentEffectsMode);
  fetchInitialState();
});
