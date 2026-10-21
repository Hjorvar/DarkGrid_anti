/**
 * DARKGRID ADVENTURE LAB — Client State Store & Shared Constants (ES Module)
 */

export const FACING_META = {
  NORTH: { short: 'N', arrow: '▲', label: 'Facing North', deg: 0 },
  EAST:  { short: 'E', arrow: '▶', label: 'Facing East',  deg: 90 },
  SOUTH: { short: 'S', arrow: '▼', label: 'Facing South', deg: 180 },
  WEST:  { short: 'W', arrow: '◀', label: 'Facing West',  deg: 270 }
};

export const store = {
  currentState: null,
  isBusy: false,
  currentPresenceMode: 'integrated',
  currentSceneMode: 'C',
  currentEffectsMode: 'subtle',
  isPoiPlaqueOpen: false,
  expandedDiscoveryKey: null,
  cachedAtlasData: null,
  selectedAtlasCoord: { x: 7, y: 7 },
  currentAtlasFilter: 'ALL',
  currentMonsterScaleMode: 'adaptive',
  isSizeComparisonLabOpen: false,
  currentSizeComparisonPreset: 'SIZE_PROGRESSION_5',
  selectedBeforeAfterSpecimen: 'troll',
  devToolsCollapsed: true,
  isChronicleExpanded: false,
  chronicleHistoryBuffer: [],
  fleeConfirmArmed: false,
  fleeConfirmTimer: null,
  crossfadeCleanupTimer: null,
  isSceneCrossfading: false,
  activeSceneTargetUrl: null,
  pendingSceneStyles: null,
  backdropMotionTimer: null,
  activeActionPromise: null,
  latestSceneImageSwapToken: 0,
  preloadedImageUrls: new Set(),
  atmoParticles: [],
  atmoAnimFrameId: null,
  atmoLastTick: 0,
  activeEffectProfile: null,
  activeSequenceTimers: [],
  isSequencePlaying: false,
  currentOpenModal: null
};

export const uiCallbacks = {
  renderGameState: () => {},
  renderModalContent: () => {},
  closeLabModal: () => {},
  openLabModal: () => {},
  cancelActiveCombatSequence: () => {},
  clearTransientFloatingPopups: () => {},
  renderTopBarAndDeckSnapshot: () => {},
  renderViewportCenterStage: () => {},
  renderViewportScene: () => {},
  renderAdventureOverlays: () => {},
  renderBottomChronicle: () => {},
  renderActionDeckAndPad: () => {}
};

export function registerUiCallbacks(callbacks) {
  Object.assign(uiCallbacks, callbacks);
}

export function bindWindowStateProxies() {
  if (typeof window === 'undefined') return;
  for (const key of Object.keys(store)) {
    if (!(key in window)) {
      Object.defineProperty(window, key, {
        configurable: true,
        enumerable: true,
        get() { return store[key]; },
        set(val) { store[key] = val; }
      });
    }
  }
}
