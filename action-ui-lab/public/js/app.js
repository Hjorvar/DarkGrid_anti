/**
 * DARKGRID ADVENTURE LAB — Frontend Application Entrypoint (ES Module)
 * Orchestrates state rendering, registers UI callbacks, binds inline HTML / CDP globals,
 * and initializes keyboard shortcuts and initial server state.
 */
import { store, FACING_META, registerUiCallbacks, bindWindowStateProxies } from './state/store.js';
import {
  escapeHtml,
  getConditionColor,
  isReducedMotionPreferred,
  seededUnit,
  sanitizePlayerContinuityText,
  buildRevisitBadgeHtml,
  isEditableTarget
} from './ui/utils.js';
import { toggleDevToolsDrawer, syncUiModeClasses } from './ui/hud.js';
import { toggleChronicleHistory, recordChronicleHistoryLine, renderBottomChronicle } from './ui/chronicle.js';
import { renderAdventureOverlays } from './ui/adventure-overlays.js';
import {
  openLabModal,
  closeLabModal,
  renderModalContent,
  selectAtlasTile,
  setAtlasFilter,
  renderAtlasModal,
  renderVisualQaModal,
  renderJournalModal,
  renderDirectorModal,
  renderHelpModal
} from './ui/modals.js';
import { setupKeyboardShortcuts } from './ui/shortcuts.js';
import {
  fetchInitialState,
  dispatchAction,
  dispatchTurn,
  dispatchRelativeMove,
  dispatchMove,
  triggerLabScenario,
  triggerTeleport,
  triggerInspectPoi,
  closePoiPlaque,
  triggerClassSwitch,
  switchHeroClass,
  triggerSpawnMonster,
  setAdventureExperienceMode,
  startExpeditionRoute,
  resetExpeditionRoute,
  expandDiscoveryCard,
  resolveDiscoveryChoiceClick,
  dismissActiveDiscovery,
  forceTriggerDiscovery,
  setDeterministicSeed,
  setArtPreviewMode
} from './api/client.js';
import {
  syncEffectsButtons,
  stopAtmosphericParticleLoop,
  setAtmosphericEffectsMode,
  syncAtmosphericEffects,
  stepAtmosphericParticles
} from './world/atmosphere.js';
import {
  syncSceneModeButtons,
  setSceneMode,
  preloadAdjacentSceneImages,
  applySceneImageWithCrossfade,
  renderViewportScene,
  renderViewportCenterStage
} from './world/scene-renderer.js';
import { renderMinimap, toggleMinimapSize } from './world/minimap.js';
import { renderActionDeckAndPad } from './world/navigation.js';
import {
  getAttributeTierLabel,
  updateHeroVitalsDisplay,
  renderTopBarAndDeckSnapshot,
  handleMainHandClick,
  handleOffHandClick,
  spendMilestoneAttribute,
  selectCreatorClass,
  resetCreatorPreset,
  adjustCreatorStat,
  setCreatorField,
  submitCreatorHero,
  submitLabAuth,
  renderAccountAndCreatorModal
} from './character/character-ui.js';
import {
  setMarketTab,
  setMarketCategoryFilter
} from './inventory/inventory-ui.js';
import {
  clearTransientFloatingPopups,
  spawnFloatingPopup,
  flashViewportOverlay,
  playViewportMotionClass,
  handleFxCue
} from './combat/fx.js';
import {
  setMonsterScaleMode,
  toggleMonsterSizeComparisonLab,
  setSizeComparisonPreset,
  setBeforeAfterSpecimen,
  computeClientMonsterVisualScale,
  buildSizeComparisonArenaHtml
} from './combat/size-arena.js';
import {
  normalizeMonsterPresenceMode,
  setMonsterPresenceMode,
  handleMonsterImageError,
  resolveEnvironmentLightingGroup,
  buildCombatMonsterActorHtml,
  handleMonsterActorClick,
  handleSlot1Click,
  handleSlot2Click,
  handleSlot3Click,
  handleSlot4Click,
  renderFallenScreen
} from './combat/combat-ui.js';
import {
  cancelActiveCombatSequence,
  playCombatSequence,
  renderCombatStagingFrame,
  executeCombatBeatVisual
} from './combat/sequence.js';

export function renderGameState(state, options = {}) {
  store.currentState = state;
  syncUiModeClasses(state);

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

  if (state.mode === 'FALLEN' || state.mode === 'NO_CHARACTER' || state.mode === 'UNAUTHENTICATED') {
    const fallenMaxHp = (state.fallen && state.fallen.max_hp) || (state.combatSequence && state.combatSequence.heroMaxHp) || 12;
    updateHeroVitalsDisplay(0, fallenMaxHp);
    renderTopBarAndDeckSnapshot(state, { sequenceLock: false });
    renderFallenScreen(state);
    return;
  }

  renderTopBarAndDeckSnapshot(state, { sequenceLock: false });
  renderAdventureOverlays(state);
  renderViewportCenterStage(state);
  renderBottomChronicle(state);
  renderMinimap(state);
  renderActionDeckAndPad(state);

  if (store.currentOpenModal === 'journal' || store.currentOpenModal === 'director' || store.currentOpenModal === 'help' || store.currentOpenModal === 'account' || store.currentOpenModal === 'create-character' || store.currentOpenModal === 'character') {
    renderModalContent(store.currentOpenModal);
  }

  if (!options.skipSequence && state.fxCue) {
    const cue = state.fxCue;
    state.fxCue = null;
    handleFxCue(cue);
  }
}

// Register UI callbacks for decoupled cross-module invocation
registerUiCallbacks({
  renderGameState,
  renderModalContent,
  closeLabModal,
  openLabModal,
  cancelActiveCombatSequence,
  clearTransientFloatingPopups,
  renderTopBarAndDeckSnapshot,
  renderViewportCenterStage,
  renderViewportScene,
  renderAdventureOverlays,
  renderBottomChronicle,
  renderActionDeckAndPad
});

// Bind live state proxies and global functions for inline HTML handlers & headless CDP QA
bindWindowStateProxies();

if (typeof window !== 'undefined') {
  Object.assign(window, {
    FACING_META,
    escapeHtml,
    getConditionColor,
    isReducedMotionPreferred,
    seededUnit,
    sanitizePlayerContinuityText,
    buildRevisitBadgeHtml,
    isEditableTarget,
    toggleDevToolsDrawer,
    syncUiModeClasses,
    toggleChronicleHistory,
    recordChronicleHistoryLine,
    renderBottomChronicle,
    renderAdventureOverlays,
    openLabModal,
    closeLabModal,
    renderModalContent,
    selectAtlasTile,
    setAtlasFilter,
    renderAtlasModal,
    renderVisualQaModal,
    renderJournalModal,
    renderDirectorModal,
    renderHelpModal,
    fetchInitialState,
    dispatchAction,
    dispatchTurn,
    dispatchRelativeMove,
    dispatchMove,
    triggerLabScenario,
    triggerTeleport,
    triggerInspectPoi,
    closePoiPlaque,
    triggerClassSwitch,
    switchHeroClass,
    triggerSpawnMonster,
    setAdventureExperienceMode,
    startExpeditionRoute,
    resetExpeditionRoute,
    expandDiscoveryCard,
    resolveDiscoveryChoiceClick,
    dismissActiveDiscovery,
    forceTriggerDiscovery,
    setDeterministicSeed,
    setArtPreviewMode,
    syncEffectsButtons,
    stopAtmosphericParticleLoop,
    setAtmosphericEffectsMode,
    syncAtmosphericEffects,
    stepAtmosphericParticles,
    syncSceneModeButtons,
    setSceneMode,
    preloadAdjacentSceneImages,
    applySceneImageWithCrossfade,
    renderViewportScene,
    renderViewportCenterStage,
    renderMinimap,
    toggleMinimapSize,
    renderActionDeckAndPad,
    getAttributeTierLabel,
    updateHeroVitalsDisplay,
    renderTopBarAndDeckSnapshot,
    handleMainHandClick,
    handleOffHandClick,
    spendMilestoneAttribute,
    selectCreatorClass,
    resetCreatorPreset,
    adjustCreatorStat,
    setCreatorField,
    submitCreatorHero,
    submitLabAuth,
    renderAccountAndCreatorModal,
    setMarketTab,
    setMarketCategoryFilter,
    clearTransientFloatingPopups,
    spawnFloatingPopup,
    flashViewportOverlay,
    playViewportMotionClass,
    handleFxCue,
    setMonsterScaleMode,
    toggleMonsterSizeComparisonLab,
    setSizeComparisonPreset,
    setBeforeAfterSpecimen,
    computeClientMonsterVisualScale,
    buildSizeComparisonArenaHtml,
    normalizeMonsterPresenceMode,
    setMonsterPresenceMode,
    handleMonsterImageError,
    resolveEnvironmentLightingGroup,
    buildCombatMonsterActorHtml,
    handleMonsterActorClick,
    handleSlot1Click,
    handleSlot2Click,
    handleSlot3Click,
    handleSlot4Click,
    renderFallenScreen,
    cancelActiveCombatSequence,
    playCombatSequence,
    renderCombatStagingFrame,
    executeCombatBeatVisual,
    renderGameState
  });
}

setupKeyboardShortcuts();

function initApp() {
  syncEffectsButtons(store.currentEffectsMode);
  fetchInitialState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}
