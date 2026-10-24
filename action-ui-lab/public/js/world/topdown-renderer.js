/**
 * DARKGRID PHASE 8 — 2D Top-Down Camera Viewport, Fog of War & Region Map Renderer (ES Module)
 *
 * Implements:
 * - Hero-centered Camera Viewport (~11×9 visible tiles on desktop) with smooth interpolation
 * - Strict world-boundary camera clamping across the 30×30 (900-tile) Goblin Forest
 * - Accurate camera-offset mouse hover and click-to-step hit-testing
 * - Data-driven continuous river, 3 winding forest routes, multi-species tree canopies, and 13 landmarks
 * - Discovery & Light Fog of War (Unexplored shroud vs. Explored memory vs. Active vision radius)
 * - Region Map overview renderer (`renderRegionMapCanvas`) for the Map [M] modal
 */
import { store } from '../state/store.js';
import { dispatchMove, dispatchAction, triggerInspectPoi } from '../api/client.js';
import { escapeHtml } from '../ui/utils.js';

let canvasEl = null;
let ctx = null;
let animFrameId = null;

// Smooth camera & hero interpolation state (persisted across combat & modals)
let heroVisualX = null;
let heroVisualY = null;
let heroAnimStartX = null;
let heroAnimStartY = null;
let heroAnimTargetX = null;
let heroAnimTargetY = null;
let heroAnimStartTime = 0;
const HERO_MOVE_DURATION_MS = 145;

let hoveredGridCoord = null;
let lastLayoutMetrics = null;
let eventsBound = false;

function hashCoord(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function initTopdownRenderer() {
  let stageEl = document.getElementById('topdown-map-stage');
  if (!stageEl) {
    const vp = document.getElementById('fp-viewport');
    if (vp) {
      stageEl = document.createElement('div');
      stageEl.id = 'topdown-map-stage';
      stageEl.className = 'topdown-map-stage';
      const c = document.createElement('canvas');
      c.id = 'topdown-map-canvas';
      c.className = 'topdown-map-canvas';
      stageEl.appendChild(c);
      vp.insertBefore(stageEl, vp.firstChild);
    }
  }
  canvasEl = document.getElementById('topdown-map-canvas');
  if (!canvasEl) return;
  ctx = canvasEl.getContext('2d');

  if (!eventsBound) {
    eventsBound = true;
    canvasEl.addEventListener('mousemove', handleCanvasMouseMove);
    canvasEl.addEventListener('mouseleave', () => {
      if (hoveredGridCoord) {
        hoveredGridCoord = null;
        if (canvasEl) canvasEl.style.cursor = 'default';
        scheduleRedraw();
      }
    });
    canvasEl.addEventListener('click', handleCanvasClick);
    window.addEventListener('resize', () => {
      if (store.currentState) drawTopdownWorld(store.currentState);
    });
  }
}

let lastActiveDungeonKey = null;

function getActiveGridMap(state) {
  if (!state) return null;
  if (state.dungeonMap && state.dungeonMap.inDungeon) {
    return state.dungeonMap;
  }
  return state.topdownMap || null;
}

/**
 * Computes camera & viewport layout metrics.
 * Shows ~11.5 × 8.5 tiles on desktop, centered on (focusX, focusY) and clamped to world bounds.
 */
export function computeCameraViewportMetrics(cssWidth, cssHeight, mapData, focusX, focusY) {
  const minX = mapData.minX ?? 0;
  const maxX = mapData.maxX ?? 29;
  const minY = mapData.minY ?? 0;
  const maxY = mapData.maxY ?? 29;
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  // Target ~11.5 columns by ~8.5 rows visible in the viewport regardless of total world size
  const targetVisibleCols = 11.5;
  const targetVisibleRows = 8.5;
  const rawTileSize = Math.min(cssWidth / targetVisibleCols, cssHeight / targetVisibleRows);
  const tileSize = Math.max(46, Math.min(96, Math.round(rawTileSize)));

  const worldPixelW = cols * tileSize;
  const worldPixelH = rows * tileSize;

  const fx = typeof focusX === 'number' ? focusX : ((mapData.heroX ?? (mapData.heroCoord && mapData.heroCoord.x)) ?? 15);
  const fy = typeof focusY === 'number' ? focusY : ((mapData.heroY ?? (mapData.heroCoord && mapData.heroCoord.y)) ?? 27);

  const heroWorldPxX = (fx - minX + 0.5) * tileSize;
  const heroWorldPxY = (fy - minY + 0.5) * tileSize;

  const idealCamPxX = heroWorldPxX - cssWidth / 2;
  const idealCamPxY = heroWorldPxY - cssHeight / 2;

  const maxCamPxX = Math.max(0, worldPixelW - cssWidth);
  const maxCamPxY = Math.max(0, worldPixelH - cssHeight);

  const rawCamPxX = worldPixelW <= cssWidth
    ? Math.floor((worldPixelW - cssWidth) / 2)
    : Math.max(0, Math.min(maxCamPxX, idealCamPxX));
  const rawCamPxY = worldPixelH <= cssHeight
    ? Math.floor((worldPixelH - cssHeight) / 2)
    : Math.max(0, Math.min(maxCamPxY, idealCamPxY));

  // Snap stationary camera coordinates to exact integer pixels to eliminate sub-pixel canvas blurriness
  const camPxX = heroAnimTargetX !== null ? rawCamPxX : Math.round(rawCamPxX);
  const camPxY = heroAnimTargetY !== null ? rawCamPxY : Math.round(rawCamPxY);

  const visibleCols = Number((cssWidth / tileSize).toFixed(2));
  const visibleRows = Number((cssHeight / tileSize).toFixed(2));

  const startCol = Math.max(minX, minX + Math.floor(camPxX / tileSize) - 2);
  const endCol = Math.min(maxX, minX + Math.ceil((camPxX + cssWidth) / tileSize) + 2);
  const startRow = Math.max(minY, minY + Math.floor(camPxY / tileSize) - 2);
  const endRow = Math.min(maxY, minY + Math.ceil((camPxY + cssHeight) / tileSize) + 2);

  return {
    minX,
    maxX,
    minY,
    maxY,
    cols,
    rows,
    tileSize,
    worldPixelW,
    worldPixelH,
    camPxX,
    camPxY,
    visibleCols,
    visibleRows,
    startCol,
    endCol,
    startRow,
    endRow,
    cssWidth,
    cssHeight
  };
}

function clientPointToGridCoord(clientX, clientY) {
  if (!canvasEl || !lastLayoutMetrics) return null;
  const rect = canvasEl.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const { minX, maxX, minY, maxY, tileSize, camPxX, camPxY } = lastLayoutMetrics;
  const worldPxX = mx + camPxX;
  const worldPxY = my + camPxY;
  const gx = minX + Math.floor(worldPxX / tileSize);
  const gy = minY + Math.floor(worldPxY / tileSize);
  if (gx < minX || gx > maxX || gy < minY || gy > maxY) return null;
  return { x: gx, y: gy };
}

function handleCanvasMouseMove(e) {
  const state = store.currentState;
  const mapData = getActiveGridMap(state);
  if (!state || !mapData) return;
  const coord = clientPointToGridCoord(e.clientX, e.clientY);
  const prev = hoveredGridCoord;
  const changed = (!prev && coord) || (prev && !coord) || (prev && coord && (prev.x !== coord.x || prev.y !== coord.y));
  hoveredGridCoord = coord;

  if (coord && canvasEl) {
    const heroX = typeof mapData.heroX === 'number' ? mapData.heroX : (state.currentTile ? Number(state.currentTile.x) : 15);
    const heroY = typeof mapData.heroY === 'number' ? mapData.heroY : (state.currentTile ? Number(state.currentTile.y) : 27);
    const dist = Math.abs(coord.x - heroX) + Math.abs(coord.y - heroY);
    const tile = (mapData.tiles || []).find(t => t.x === coord.x && t.y === coord.y);
    const isLocked = Boolean(state.encounter && (state.encounter.status === 'IN_COMBAT' || state.encounter.isAmbush));
    if (dist === 1 && tile && tile.isPassable && !isLocked) {
      canvasEl.style.cursor = 'pointer';
    } else if (dist === 0 && (mapData.atBossTile || mapData.atExitTile || state.isSafeCity || (state.viewportScene && state.viewportScene.pointOfInterest))) {
      canvasEl.style.cursor = 'pointer';
    } else {
      canvasEl.style.cursor = 'default';
    }
  } else if (canvasEl) {
    canvasEl.style.cursor = 'default';
  }

  if (changed) scheduleRedraw();
}

function handleCanvasClick(e) {
  const state = store.currentState;
  const mapData = getActiveGridMap(state);
  if (!state || !mapData) return;
  if (state.mode === 'FALLEN') return;
  const isLocked = Boolean(state.encounter && (state.encounter.status === 'IN_COMBAT' || state.encounter.isAmbush));
  if (isLocked) return;

  const coord = clientPointToGridCoord(e.clientX, e.clientY);
  if (!coord) return;

  const heroX = typeof mapData.heroX === 'number' ? mapData.heroX : (state.currentTile ? Number(state.currentTile.x) : 15);
  const heroY = typeof mapData.heroY === 'number' ? mapData.heroY : (state.currentTile ? Number(state.currentTile.y) : 27);
  const dx = coord.x - heroX;
  const dy = coord.y - heroY;
  const manhattan = Math.abs(dx) + Math.abs(dy);

  if (manhattan === 1) {
    if (dy === -1) dispatchMove('NORTH');
    else if (dy === 1) dispatchMove('SOUTH');
    else if (dx === -1) dispatchMove('WEST');
    else if (dx === 1) dispatchMove('EAST');
    return;
  }

  if (manhattan === 0) {
    if (mapData.inDungeon) {
      if (mapData.atBossTile && !mapData.bossSlain && !state.encounter) {
        dispatchAction('ENGAGE_DUNGEON_BOSS');
      } else if (mapData.atExitTile && !state.encounter) {
        dispatchAction('EXIT_DUNGEON');
      }
      return;
    }
    const sh = mapData.strongholdCoord || { x: 15, y: 2 };
    if (heroX === sh.x && heroY === sh.y && !mapData.bossSlain && !state.encounter) {
      dispatchAction('CHALLENGE_STRONGHOLD_BOSS');
    } else if (mapData.atRavencragCitadel && !mapData.highlandBossSlain && !state.encounter) {
      dispatchAction('CONFRONT_HIGHLAND_WARLORD');
    } else if (mapData.atGoblinCave && !state.encounter) {
      dispatchAction('EXPLORE_GOBLIN_CAVE');
    } else if (mapData.atAncientCrypt && !state.encounter) {
      dispatchAction('ENTER_ANCIENT_CRYPT');
    } else if (state.viewportScene && state.viewportScene.pointOfInterest) {
      triggerInspectPoi();
    }
  }
}

function scheduleRedraw() {
  if (animFrameId) return;
  animFrameId = requestAnimationFrame(animateTopdownFrame);
}

function animateTopdownFrame(now) {
  animFrameId = null;
  if (!store.currentState || !getActiveGridMap(store.currentState)) return;

  let stillAnimating = false;
  if (heroAnimTargetX !== null && heroAnimTargetY !== null) {
    const elapsed = now - heroAnimStartTime;
    if (elapsed < HERO_MOVE_DURATION_MS) {
      const t = easeOutCubic(Math.max(0, Math.min(1, elapsed / HERO_MOVE_DURATION_MS)));
      heroVisualX = heroAnimStartX + (heroAnimTargetX - heroAnimStartX) * t;
      heroVisualY = heroAnimStartY + (heroAnimTargetY - heroAnimStartY) * t;
      stillAnimating = true;
    } else {
      heroVisualX = heroAnimTargetX;
      heroVisualY = heroAnimTargetY;
      heroAnimTargetX = null;
      heroAnimTargetY = null;
    }
  }

  drawTopdownWorld(store.currentState);

  if (stillAnimating) {
    animFrameId = requestAnimationFrame(animateTopdownFrame);
  }
}

export function renderTopdownStage(state) {
  if (!canvasEl) initTopdownRenderer();
  const mapData = getActiveGridMap(state);
  if (!canvasEl || !state || !mapData) return;
  const stageEl = document.getElementById('topdown-map-stage');
  const isLandmarkSceneActive = Boolean(!mapData.inDungeon && state.landmarkScene && state.landmarkScene.isActive && !state.encounter);
  if (stageEl) {
    stageEl.hidden = isLandmarkSceneActive;
    stageEl.style.display = isLandmarkSceneActive ? 'none' : '';
  }
  if (isLandmarkSceneActive) return;

  const currentDungeonKey = mapData.inDungeon ? mapData.dungeonKey : null;
  const targetX = typeof mapData.heroX === 'number' ? mapData.heroX : (state.currentTile ? Number(state.currentTile.x) : 15);
  const targetY = typeof mapData.heroY === 'number' ? mapData.heroY : (state.currentTile ? Number(state.currentTile.y) : 27);

  if (heroVisualX === null || heroVisualY === null || currentDungeonKey !== lastActiveDungeonKey) {
    lastActiveDungeonKey = currentDungeonKey;
    heroVisualX = targetX;
    heroVisualY = targetY;
    heroAnimTargetX = null;
    heroAnimTargetY = null;
  } else if (Math.abs(targetX - heroVisualX) > 0.01 || Math.abs(targetY - heroVisualY) > 0.01) {
    const dist = Math.abs(targetX - heroVisualX) + Math.abs(targetY - heroVisualY);
    if (dist <= 2.2) {
      heroAnimStartX = heroVisualX;
      heroAnimStartY = heroVisualY;
      heroAnimTargetX = targetX;
      heroAnimTargetY = targetY;
      heroAnimStartTime = performance.now();
    } else {
      // Teleport or scenario jump: snap camera immediately without multi-tile slide
      heroVisualX = targetX;
      heroVisualY = targetY;
      heroAnimTargetX = null;
      heroAnimTargetY = null;
    }
  }

  updateContextualActionOverlays(state);
  drawTopdownWorld(state);
  if (heroAnimTargetX !== null && heroAnimTargetY !== null) {
    scheduleRedraw();
  }
}

export const renderTopdownWorld = renderTopdownStage;

function updateContextualActionOverlays() {
  const overlayEl = document.getElementById('topdown-contextual-overlay');
  if (overlayEl) {
    overlayEl.hidden = true;
    overlayEl.innerHTML = '';
  }
}

function drawPineTree(ctx, cx, cy, scale, shade = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Soft canopy ground shadow
  ctx.fillStyle = 'rgba(3, 5, 4, 0.46)';
  ctx.beginPath();
  ctx.ellipse(3, 12, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk
  ctx.fillStyle = '#3b281a';
  ctx.fillRect(-2.5, 3, 5, 9);

  const g1 = shade > 0.5 ? '#122619' : '#162d1e';
  const g2 = shade > 0.5 ? '#1b3724' : '#1f3f29';
  const g3 = shade > 0.5 ? '#254830' : '#2a5236';

  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-16, 6);
  ctx.lineTo(16, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.moveTo(0, -23);
  ctx.lineTo(-13, -1);
  ctx.lineTo(13, -1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = g3;
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.lineTo(-9, -9);
  ctx.lineTo(9, -9);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDeciduousTree(ctx, cx, cy, scale, variant = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(3, 5, 4, 0.45)';
  ctx.beginPath();
  ctx.ellipse(3, 11, 17, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3d2819';
  ctx.fillRect(-3, 1, 6, 10);

  const baseColor = variant > 0.65 ? '#1c3422' : (variant > 0.3 ? '#172e1e' : '#213824');
  const midColor = variant > 0.65 ? '#26462e' : (variant > 0.3 ? '#203e29' : '#2c4a2e');
  const topColor = variant > 0.65 ? '#32593b' : (variant > 0.3 ? '#2b5036' : '#395c39');

  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.arc(-6, -4, 11, 0, Math.PI * 2);
  ctx.arc(7, -3, 10, 0, Math.PI * 2);
  ctx.arc(0, -10, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = midColor;
  ctx.beginPath();
  ctx.arc(-4, -7, 9, 0, Math.PI * 2);
  ctx.arc(5, -6, 8, 0, Math.PI * 2);
  ctx.arc(0, -12, 9.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.arc(-2, -12, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBushClump(ctx, cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(4, 7, 5, 0.36)';
  ctx.beginPath();
  ctx.ellipse(1, 4, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1b3523';
  ctx.beginPath();
  ctx.arc(-4, 0, 5.5, 0, Math.PI * 2);
  ctx.arc(4, 1, 5, 0, Math.PI * 2);
  ctx.arc(0, -2, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#294c33';
  ctx.beginPath();
  ctx.arc(-1, -3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRockOutcrop(ctx, cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(4, 6, 8, 0.45)';
  ctx.beginPath();
  ctx.ellipse(2, 6, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#333b44';
  ctx.beginPath();
  ctx.moveTo(-13, 5);
  ctx.lineTo(-9, -7);
  ctx.lineTo(1, -10);
  ctx.lineTo(12, -3);
  ctx.lineTo(14, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#47525e';
  ctx.beginPath();
  ctx.moveTo(-9, -7);
  ctx.lineTo(1, -10);
  ctx.lineTo(6, -1);
  ctx.lineTo(-5, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDeadBarrowTree(ctx, cx, cy, scale, variant = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Cold necrotic ground shadow
  ctx.fillStyle = 'rgba(4, 6, 10, 0.52)';
  ctx.beginPath();
  ctx.ellipse(2, 10, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Twisted ashen-grey dead trunk & bare branches
  ctx.strokeStyle = variant > 0.5 ? '#475569' : '#334155';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(-1, -6);
  ctx.stroke();

  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-1, -4);
  ctx.lineTo(-11, -15);
  ctx.moveTo(-1, -6);
  ctx.lineTo(10, -16);
  ctx.moveTo(-6, -10);
  ctx.lineTo(-3, -20);
  ctx.moveTo(5, -11);
  ctx.lineTo(13, -11);
  ctx.stroke();

  // Faint spectral wisp or dead moss on some barrow trees
  if (variant > 0.62) {
    ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.beginPath();
    ctx.arc(-8, -14, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBarrowHeadstone(ctx, cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(4, 6, 10, 0.45)';
  ctx.beginPath();
  ctx.ellipse(1, 5, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#64748b';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-5, 5);
  ctx.lineTo(-5, -4);
  ctx.arc(0, -4, 5, Math.PI, 0);
  ctx.lineTo(5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawLandmarkStructure(ctx, cx, cy, tileSize, landmarkKey, bossSlain) {
  const r = tileSize * 0.44;
  ctx.save();

  if (landmarkKey === 'OAKHAVEN' || landmarkKey === 'OAKHAVEN_CITY') {
    // Warm sanctuary aura
    const townGlow = ctx.createRadialGradient(cx, cy, 4, cx, cy, tileSize * 1.15);
    townGlow.addColorStop(0, 'rgba(245, 185, 75, 0.34)');
    townGlow.addColorStop(1, 'rgba(245, 185, 75, 0)');
    ctx.fillStyle = townGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Stone & timber sanctuary walls
    ctx.fillStyle = '#25211b';
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Main hall roof
    ctx.fillStyle = '#6b442a';
    ctx.fillRect(cx - r * 0.56, cy - r * 0.25, r * 1.12, r * 0.62);
    ctx.fillStyle = '#92352b';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.68, cy - r * 0.22);
    ctx.lineTo(cx, cy - r * 0.78);
    ctx.lineTo(cx + r * 0.68, cy - r * 0.22);
    ctx.closePath();
    ctx.fill();

    // Warm windows
    ctx.fillStyle = '#fde047';
    ctx.fillRect(cx - r * 0.30, cy - r * 0.06, r * 0.20, r * 0.22);
    ctx.fillRect(cx + r * 0.10, cy - r * 0.06, r * 0.20, r * 0.22);
  } else if (landmarkKey === 'NORTH_GATE' || landmarkKey === 'OAKHAVEN_NORTH_GATE') {
    // Timber Gatehouse pillars & arch
    ctx.fillStyle = '#3d291a';
    ctx.strokeStyle = '#a37c40';
    ctx.lineWidth = 1.6;
    ctx.fillRect(cx - r * 0.75, cy - r * 0.35, r * 0.38, r * 0.7);
    ctx.strokeRect(cx - r * 0.75, cy - r * 0.35, r * 0.38, r * 0.7);
    ctx.fillRect(cx + r * 0.37, cy - r * 0.35, r * 0.38, r * 0.7);
    ctx.strokeRect(cx + r * 0.37, cy - r * 0.35, r * 0.38, r * 0.7);

    // Overhead timber beam
    ctx.fillStyle = '#4f3521';
    ctx.fillRect(cx - r * 0.8, cy - r * 0.42, r * 1.6, r * 0.22);

    // Warm lanterns
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx - r * 0.55, cy, 3.2, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.55, cy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'SOUTHERN_CROSSROADS' || landmarkKey === 'BLACKWOOD_CROSSROADS') {
    // Wooden signpost
    ctx.fillStyle = '#4a321e';
    ctx.fillRect(cx - 12, cy - 12, 4, 18);
    ctx.fillStyle = '#7c5836';
    ctx.fillRect(cx - 18, cy - 10, 16, 5);
    ctx.fillRect(cx - 14, cy - 4, 15, 5);
  } else if (landmarkKey === 'OLD_STONE_BRIDGE') {
    // Arched stone bridge over river
    ctx.fillStyle = '#5c5852';
    ctx.strokeStyle = '#8c857B';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - tileSize * 0.48, cy - tileSize * 0.28, tileSize * 0.96, tileSize * 0.56);
    ctx.strokeRect(cx - tileSize * 0.48, cy - tileSize * 0.28, tileSize * 0.96, tileSize * 0.56);

    // Parapet stones
    ctx.fillStyle = '#78716c';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(cx + i * (tileSize * 0.17) - 4, cy - tileSize * 0.31, 8, 5);
      ctx.fillRect(cx + i * (tileSize * 0.17) - 4, cy + tileSize * 0.26, 8, 5);
    }
  } else if (landmarkKey === 'OLD_LOG_CROSSING') {
    // Giant mossy fallen log spanning the northern river
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.08);
    ctx.fillStyle = '#4a3321';
    ctx.strokeStyle = '#291b10';
    ctx.lineWidth = 2;
    ctx.fillRect(-tileSize * 0.48, -tileSize * 0.18, tileSize * 0.96, tileSize * 0.36);
    ctx.strokeRect(-tileSize * 0.48, -tileSize * 0.18, tileSize * 0.96, tileSize * 0.36);
    // Moss patches on log
    ctx.fillStyle = '#2d5a36';
    ctx.beginPath();
    ctx.ellipse(-tileSize * 0.18, -tileSize * 0.08, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(tileSize * 0.15, tileSize * 0.06, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (landmarkKey === 'ABANDONED_WATCHPOST') {
    // Ruined stone tower & flanking wall remnants
    ctx.fillStyle = '#374151';
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4b5563';
    ctx.fillRect(cx - r * 1.05, cy - r * 0.72, 11, 11);
    ctx.fillRect(cx + r * 1.05 - 11, cy - r * 0.72, 11, 11);

    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 2, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'BROKEN_SHRINE') {
    // Cracked stone dais, flanking broken pillars & glowing cyan rune altar
    const shrineGlow = ctx.createRadialGradient(cx, cy, 4, cx, cy, tileSize * 0.95);
    shrineGlow.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    shrineGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = shrineGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 0.95, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Flanking broken stone pillars (visible even when hero stands at center)
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(cx - r * 0.82, cy - r * 0.65, 8, 16);
    ctx.fillRect(cx + r * 0.82 - 8, cy - r * 0.55, 8, 13);

    // Glowing rune crystal
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.58, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'CHARCOAL_CAMP' || landmarkKey === 'OLD_CHARCOAL_CAMP') {
    // Cold firepit & tent ruin
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 8);
    ctx.lineTo(cx - 10, cy - 14);
    ctx.lineTo(cx + 2, cy + 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(cx + 14, cy + 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(cx + 14, cy + 6, 2.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'ANCIENT_BLACK_OAK') {
    // Colossal world-tree at [15, 15] towering over the crossroads
    const oakGlow = ctx.createRadialGradient(cx, cy, 4, cx, cy, tileSize * 1.15);
    oakGlow.addColorStop(0, 'rgba(234, 179, 8, 0.32)');
    oakGlow.addColorStop(1, 'rgba(234, 179, 8, 0)');
    ctx.fillStyle = oakGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Spreading roots & ancient bark ring
    ctx.fillStyle = '#291a10';
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Colossal dark-emerald & gold-rimmed boughs rising above and flanking the tile
    ctx.fillStyle = '#0f2417';
    ctx.strokeStyle = '#3f6212';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.68, r * 0.72, 0, Math.PI * 2);
    ctx.arc(cx - r * 0.76, cy - r * 0.24, r * 0.58, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.76, cy - r * 0.24, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing amber sap hollow
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.58, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'EASTBANK_OVERLOOK' || landmarkKey === 'RAVINE_OVERLOOK') {
    drawRockOutcrop(ctx, cx, cy, (tileSize / 68) * 0.75);
  } else if (landmarkKey === 'GOBLIN_HUNTING_GROUNDS') {
    // Tribal bone stakes & warning totems
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 8);
    ctx.lineTo(cx - 9, cy - 10);
    ctx.moveTo(cx + 12, cy + 8);
    ctx.lineTo(cx + 9, cy - 10);
    ctx.stroke();

    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.arc(cx - 9, cy - 11, 3.5, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy - 11, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'STRONGHOLD_APPROACH') {
    // Torch-lit palisade spikes flanking the trail
    ctx.fillStyle = '#422006';
    ctx.fillRect(cx - r * 0.85, cy - 6, 8, 14);
    ctx.fillRect(cx + r * 0.85 - 8, cy - 6, 8, 14);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx - r * 0.85 + 4, cy - 8, 3, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.85 - 4, cy - 8, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'GOBLIN_STRONGHOLD') {
    const shGlow = ctx.createRadialGradient(cx, cy, 4, cx, cy, tileSize * 1.15);
    if (bossSlain) {
      shGlow.addColorStop(0, 'rgba(74, 222, 128, 0.25)');
      shGlow.addColorStop(1, 'rgba(74, 222, 128, 0)');
    } else {
      shGlow.addColorStop(0, 'rgba(220, 38, 38, 0.36)');
      shGlow.addColorStop(1, 'rgba(220, 38, 38, 0)');
    }
    ctx.fillStyle = shGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1f1918';
    ctx.strokeStyle = bossSlain ? '#4ade80' : '#ef4444';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Fortified palisade battlements
    ctx.fillStyle = '#3f2e26';
    ctx.fillRect(cx - r * 0.62, cy - r * 0.38, r * 1.24, r * 0.78);
    ctx.fillStyle = '#291d18';
    ctx.fillRect(cx - r * 0.72, cy - r * 0.56, r * 0.38, r * 0.94);
    ctx.fillRect(cx + r * 0.34, cy - r * 0.56, r * 0.38, r * 0.94);

    // Gate & war brazier glow
    ctx.fillStyle = bossSlain ? '#86efac' : '#f97316';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.08, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'GOBLIN_CAVE') {
    // Subterranean Goblin Cave Mouth in the western crags [9, 12]
    const caveGlow = ctx.createRadialGradient(cx, cy, 4, cx, cy, tileSize * 1.15);
    caveGlow.addColorStop(0, 'rgba(245, 158, 11, 0.34)');
    caveGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = caveGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Jagged limestone crag arch
    ctx.fillStyle = '#333b44';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Yawning subterranean cave maw
    ctx.fillStyle = '#07090d';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.14, r * 0.56, Math.PI, 0);
    ctx.lineTo(cx + r * 0.56, cy + r * 0.52);
    ctx.lineTo(cx - r * 0.56, cy + r * 0.52);
    ctx.closePath();
    ctx.fill();

    // Flanking goblin pitch-torches & skull stakes
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(cx - r * 0.65, cy - r * 0.12, 3.6, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.65, cy - r * 0.12, 3.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'GALLOWS_CROSSROADS') {
    // Timber gallows & iron cage at the Undead Lands threshold [25, 23]
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 10);
    ctx.lineTo(cx - 10, cy - 12);
    ctx.lineTo(cx + 8, cy - 12);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx + 4, cy - 8, 7, 9);
  } else if (landmarkKey === 'DROWNED_OSSUARY') {
    // Half-submerged bone vault in Deadman's Mire [26, 19]
    const mireGlow = ctx.createRadialGradient(cx, cy, 3, cx, cy, tileSize * 0.95);
    mireGlow.addColorStop(0, 'rgba(45, 212, 191, 0.28)');
    mireGlow.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = mireGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 0.95, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r * 0.36, Math.PI, 0);
    ctx.fill();
  } else if (landmarkKey === 'WEEPING_CAIRN') {
    // Standing monolith ring & barrow mound at [26, 15]
    const cairnGlow = ctx.createRadialGradient(cx, cy, 3, cx, cy, tileSize * 0.95);
    cairnGlow.addColorStop(0, 'rgba(167, 139, 250, 0.28)');
    cairnGlow.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.fillStyle = cairnGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 0.95, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx - r * 0.65, cy - r * 0.55, 6, 13);
    ctx.fillRect(cx + r * 0.65 - 6, cy - r * 0.55, 6, 13);
    ctx.fillRect(cx - 3, cy - r * 0.72, 6, 14);
  } else if (landmarkKey === 'BLIGHTED_CHAPEL') {
    // Ruined stone chapel nave & desecrated altar at [26, 9]
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - r * 0.72, cy - r * 0.52, r * 1.44, r * 1.04);
    ctx.strokeRect(cx - r * 0.72, cy - r * 0.52, r * 1.44, r * 1.04);

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'CRYPT_APPROACH') {
    // Twin obsidian obelisks with necrotic green fire braziers at [26, 6]
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.6;
    ctx.fillRect(cx - r * 0.85, cy - 8, 8, 16);
    ctx.strokeRect(cx - r * 0.85, cy - 8, 8, 16);
    ctx.fillRect(cx + r * 0.85 - 8, cy - 8, 8, 16);
    ctx.strokeRect(cx + r * 0.85 - 8, cy - 8, 8, 16);

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(cx - r * 0.85 + 4, cy - 10, 3.2, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.85 - 4, cy - 10, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'ANCIENT_CRYPT') {
    // Major Landmark in Undead Lands: The Ancient Crypt [26, 5]
    const cryptGlow = ctx.createRadialGradient(cx, cy, 4, cx, cy, tileSize * 1.22);
    cryptGlow.addColorStop(0, 'rgba(52, 211, 153, 0.42)');
    cryptGlow.addColorStop(0.55, 'rgba(139, 92, 246, 0.22)');
    cryptGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = cryptGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 1.22, 0, Math.PI * 2);
    ctx.fill();

    // Obsidian & bone sepulcher ring
    ctx.fillStyle = '#0f1420';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Mausoleum pediment & columns
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - r * 0.66, cy - r * 0.32, r * 1.32, r * 0.78);
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.76, cy - r * 0.32);
    ctx.lineTo(cx, cy - r * 0.84);
    ctx.lineTo(cx + r * 0.76, cy - r * 0.32);
    ctx.closePath();
    ctx.fill();

    // Sunken necrotic vault portal
    ctx.fillStyle = '#05070b';
    ctx.fillRect(cx - r * 0.28, cy - r * 0.12, r * 0.56, r * 0.58);
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(cx - r * 0.48, cy + r * 0.08, 3.4, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.48, cy + r * 0.08, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'WINDSCAR_GATE') {
    // Shattered cyclopean stone border gatehouse at [31, 23]
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - r * 0.82, cy - r * 0.45, r * 0.42, r * 0.90);
    ctx.strokeRect(cx - r * 0.82, cy - r * 0.45, r * 0.42, r * 0.90);
    ctx.fillRect(cx + r * 0.40, cy - r * 0.45, r * 0.42, r * 0.90);
    ctx.strokeRect(cx + r * 0.40, cy - r * 0.45, r * 0.42, r * 0.90);
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(cx - r * 0.61, cy - r * 0.1, 3.2, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.61, cy - r * 0.1, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'HIGHLAND_PINE_TOR') {
    // Windswept granite tor crowned with ancient highland pines at [34, 21]
    drawRockOutcrop(ctx, cx, cy + 4, (tileSize / 68) * 0.95);
    drawPineTree(ctx, cx - 8, cy - 6, (tileSize / 68) * 0.72, 0.8);
    drawPineTree(ctx, cx + 8, cy - 4, (tileSize / 68) * 0.68, 0.4);
  } else if (landmarkKey === 'GIANTS_SPAN_BRIDGE') {
    // Cyclopean stone arch spanning the Shattered Gorge chasm at [35, 15]
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.2;
    ctx.fillRect(cx - tileSize * 0.34, cy - tileSize * 0.48, tileSize * 0.68, tileSize * 0.96);
    ctx.strokeRect(cx - tileSize * 0.34, cy - tileSize * 0.48, tileSize * 0.68, tileSize * 0.96);
    ctx.fillStyle = '#94a3b8';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(cx - tileSize * 0.38, cy + i * (tileSize * 0.17) - 4, 5, 8);
      ctx.fillRect(cx + tileSize * 0.33, cy + i * (tileSize * 0.17) - 4, 5, 8);
    }
  } else if (landmarkKey === 'CYCLOPS_WATCHTOWER') {
    // Leaning megalithic watchtower overlooking the gorge at [39, 13]
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.25, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'STORMPEAK_CAIRN') {
    // Ancient frost-rimmed highland warrior cairn & monolith at [37, 8]
    const cairnGlow = ctx.createRadialGradient(cx, cy, 3, cx, cy, tileSize * 0.92);
    cairnGlow.addColorStop(0, 'rgba(56, 189, 248, 0.30)');
    cairnGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = cairnGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 0.92, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.88);
    ctx.lineTo(cx + r * 0.56, cy + r * 0.65);
    ctx.lineTo(cx - r * 0.56, cy + r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (landmarkKey === 'CITADEL_APPROACH') {
    // Iron-spiked siege barricades & war-braziers at [37, 4]
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.8;
    ctx.fillRect(cx - r * 0.86, cy - 7, 9, 15);
    ctx.strokeRect(cx - r * 0.86, cy - 7, 9, 15);
    ctx.fillRect(cx + r * 0.86 - 9, cy - 7, 9, 15);
    ctx.strokeRect(cx + r * 0.86 - 9, cy - 7, 9, 15);
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(cx - r * 0.86 + 4.5, cy - 9, 3.4, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.86 - 4.5, cy - 9, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (landmarkKey === 'RAVENCRAG_CITADEL') {
    // Major Landmark in Ravencrag Highlands: Ravencrag Citadel [37, 3]
    const citGlow = ctx.createRadialGradient(cx, cy, 4, cx, cy, tileSize * 1.22);
    if (bossSlain) {
      citGlow.addColorStop(0, 'rgba(74, 222, 128, 0.30)');
      citGlow.addColorStop(1, 'rgba(74, 222, 128, 0)');
    } else {
      citGlow.addColorStop(0, 'rgba(249, 115, 22, 0.42)');
      citGlow.addColorStop(0.55, 'rgba(220, 38, 38, 0.24)');
      citGlow.addColorStop(1, 'rgba(220, 38, 38, 0)');
    }
    ctx.fillStyle = citGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, tileSize * 1.22, 0, Math.PI * 2);
    ctx.fill();

    // Basalt & iron citadel ring
    ctx.fillStyle = '#141820';
    ctx.strokeStyle = bossSlain ? '#4ade80' : '#f97316';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Twin basalt bastion towers & central war-keep
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - r * 0.66, cy - r * 0.36, r * 1.32, r * 0.78);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - r * 0.78, cy - r * 0.62, r * 0.42, r * 1.02);
    ctx.fillRect(cx + r * 0.36, cy - r * 0.62, r * 0.42, r * 1.02);

    // Iron gate war-brazier
    ctx.fillStyle = bossSlain ? '#86efac' : '#fb923c';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.10, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws richly detailed subterranean dungeon walls (Goblin Cave rugged rock strata vs Ancient Crypt arched ashlar masonry)
 * with 2.5D bevels, directional drop-shadows, cracks, wooden support beams, skull bas-reliefs, and glowing runestones.
 */
function drawDungeonWallTile(ctx, gx, gy, x0, y0, tileSize, isCrypt, adjPassable, isVisibleNow) {
  const n1 = hashCoord(gx, gy, 77);
  const n2 = hashCoord(gx, gy, 113);
  const n3 = hashCoord(gx, gy, 191);
  const ix = Math.round(x0);
  const iy = Math.round(y0);
  const ts = Math.ceil(tileSize);

  if (isCrypt) {
    // ANCIENT CRYPT: Cold slate/granite sepulcher masonry with gothic recesses
    ctx.fillStyle = n1 > 0.5 ? '#111622' : '#151b29';
    ctx.fillRect(ix, iy, ts, ts);

    // Upper stone crown face (2.5D perspective top face)
    const inset = Math.max(3, Math.round(ts * 0.09));
    const southLip = adjPassable.s ? Math.max(8, Math.round(ts * 0.22)) : inset;
    const crownW = ts - inset * 2;
    const crownH = Math.max(8, ts - inset - southLip);

    ctx.fillStyle = n2 > 0.5 ? '#1e2738' : '#232d40';
    ctx.fillRect(ix + inset, iy + inset, crownW, crownH);

    // Ashlar dressed stone course lines (horizontal + staggered vertical mortar joints)
    ctx.strokeStyle = 'rgba(10, 14, 23, 0.85)';
    ctx.lineWidth = 1;
    const midY = Math.round(iy + inset + crownH * 0.5);
    ctx.beginPath();
    ctx.moveTo(ix + inset, midY + 0.5);
    ctx.lineTo(ix + inset + crownW, midY + 0.5);
    const vSplit1 = Math.round(ix + inset + crownW * (0.35 + (n1 - 0.5) * 0.15));
    const vSplit2 = Math.round(ix + inset + crownW * (0.65 + (n2 - 0.5) * 0.15));
    ctx.moveTo(vSplit1 + 0.5, iy + inset);
    ctx.lineTo(vSplit1 + 0.5, midY);
    ctx.moveTo(vSplit2 + 0.5, midY);
    ctx.lineTo(vSplit2 + 0.5, iy + inset + crownH);
    ctx.stroke();

    // Top/Left cold moonlight/crypt edge highlight on stone blocks
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.strokeRect(ix + inset + 0.5, iy + inset + 0.5, crownW - 1, crownH - 1);

    // South-facing 2.5D vertical wall facade when a passable floor lies south of this wall
    if (adjPassable.s) {
      const faceY = iy + inset + crownH;
      const faceH = iy + ts - faceY;
      const faceGrad = ctx.createLinearGradient(0, faceY, 0, iy + ts);
      faceGrad.addColorStop(0, '#182030');
      faceGrad.addColorStop(1, '#0b0f18');
      ctx.fillStyle = faceGrad;
      ctx.fillRect(ix + 1, faceY, ts - 2, faceH);

      // Gothic arched burial niche or carved frieze on south-facing crypt walls
      const archW = Math.max(10, Math.round(ts * 0.36));
      const archH = Math.max(5, Math.round(faceH * 0.72));
      const archX = Math.round(ix + ts * 0.5);
      const archBot = iy + ts - 2;
      ctx.fillStyle = '#070a10';
      ctx.beginPath();
      ctx.arc(archX, archBot - archH * 0.45, archW * 0.35, Math.PI, 0, false);
      ctx.lineTo(archX + archW * 0.35, archBot);
      ctx.lineTo(archX - archW * 0.35, archBot);
      ctx.closePath();
      ctx.fill();

      // Skull bas-relief (hauskúpu-lágmynd) or glowing runestone (rúnasteinn) inside south facade/crown
      if (n3 > 0.55) {
        // Carved skull bas-relief emblem
        const skX = Math.round(ix + ts * 0.5);
        const skY = Math.round(iy + inset + crownH * 0.52);
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(skX, skY - 1, Math.max(3, ts * 0.075), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(skX - 2, skY + 1, 4, 3);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(skX - 2, skY - 2, 1.5, 1.5);
        ctx.fillRect(skX + 0.8, skY - 2, 1.5, 1.5);
      } else if (n3 < 0.28) {
        // Glowing eldritch runestone (rúnasteinn) carved into the crypt wall
        const rx = Math.round(ix + ts * 0.5);
        const ry = Math.round(iy + inset + crownH * 0.5);
        ctx.strokeStyle = isVisibleNow ? 'rgba(56, 189, 248, 0.92)' : 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 4);
        ctx.lineTo(rx, ry + 4);
        ctx.moveTo(rx - 3, ry - 1);
        ctx.lineTo(rx + 3, ry - 3);
        ctx.moveTo(rx - 3, ry + 2);
        ctx.lineTo(rx + 3, ry);
        ctx.stroke();
      }
    } else if (n3 < 0.18) {
      // Subtle weathered fracture in deep crypt masonry
      ctx.strokeStyle = 'rgba(7, 10, 16, 0.9)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(ix + inset + crownW * 0.3, iy + inset + crownH * 0.25);
      ctx.lineTo(ix + inset + crownW * 0.48, iy + inset + crownH * 0.55);
      ctx.lineTo(ix + inset + crownW * 0.42, iy + inset + crownH * 0.8);
      ctx.stroke();
    }
  } else {
    // GOBLIN CAVE: Rugged subterranean rock strata, jagged crags, damp moss, and timber mine supports
    ctx.fillStyle = n1 > 0.5 ? '#161310' : '#1b1713';
    ctx.fillRect(ix, iy, ts, ts);

    const inset = Math.max(3, Math.round(ts * 0.08));
    const southLip = adjPassable.s ? Math.max(8, Math.round(ts * 0.22)) : inset;
    const crownW = ts - inset * 2;
    const crownH = Math.max(8, ts - inset - southLip);

    // Rough hewn earth-brown / slate rock mass
    ctx.fillStyle = n2 > 0.5 ? '#2b241d' : '#322921';
    ctx.fillRect(ix + inset, iy + inset, crownW, crownH);

    // Jagged rock facets & natural crevices
    ctx.fillStyle = 'rgba(20, 16, 12, 0.72)';
    ctx.beginPath();
    ctx.moveTo(ix + inset, iy + inset + crownH * 0.65);
    ctx.lineTo(ix + inset + crownW * 0.45, iy + inset + crownH * (0.42 + n1 * 0.18));
    ctx.lineTo(ix + inset + crownW, iy + inset + crownH * 0.72);
    ctx.lineTo(ix + inset + crownW, iy + inset + crownH);
    ctx.lineTo(ix + inset, iy + inset + crownH);
    ctx.closePath();
    ctx.fill();

    // Rock strata fracture lines
    ctx.strokeStyle = 'rgba(12, 9, 7, 0.88)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ix + inset + crownW * 0.18, iy + inset + crownH * 0.28);
    ctx.lineTo(ix + inset + crownW * 0.52, iy + inset + crownH * 0.48);
    ctx.lineTo(ix + inset + crownW * 0.82, iy + inset + crownH * 0.34);
    ctx.stroke();

    // Warm ochre rock rim highlight
    ctx.strokeStyle = 'rgba(180, 142, 98, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + inset + 0.5, iy + inset + 0.5, crownW - 1, crownH - 1);

    // Damp cave moss / lichen patches on wall edges near floors
    if ((adjPassable.s || adjPassable.e || adjPassable.w) && n3 > 0.48) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
      ctx.beginPath();
      ctx.arc(ix + inset + crownW * (0.28 + n2 * 0.45), iy + inset + crownH * 0.76, Math.max(3, ts * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }

    // South-facing rough cliff wall drop + wooden support beams (viðarstoðir)
    if (adjPassable.s) {
      const faceY = iy + inset + crownH;
      const faceH = iy + ts - faceY;
      const cliffGrad = ctx.createLinearGradient(0, faceY, 0, iy + ts);
      cliffGrad.addColorStop(0, '#221c16');
      cliffGrad.addColorStop(1, '#0e0b09');
      ctx.fillStyle = cliffGrad;
      ctx.fillRect(ix + 1, faceY, ts - 2, faceH);

      // Wooden timber shoring beams (viðarstoðir) along tunnel walls
      if (n3 > 0.35) {
        const beamW = Math.max(3, Math.round(ts * 0.09));
        ctx.fillStyle = '#5c3a21';
        ctx.strokeStyle = '#2a180d';
        ctx.lineWidth = 1;
        // Left & right vertical timber posts + crossbeam header
        ctx.fillRect(ix + 3, faceY - 2, beamW, faceH + 1);
        ctx.fillRect(ix + ts - 3 - beamW, faceY - 2, beamW, faceH + 1);
        ctx.fillRect(ix + 2, faceY - 3, ts - 4, Math.max(3, Math.round(faceH * 0.38)));
        ctx.strokeRect(ix + 2.5, faceY - 2.5, ts - 5, Math.max(3, Math.round(faceH * 0.38)));
      }
    }
  }

  // Crisp beveled stone border where wall meets adjacent passable floor (N, S, E, W)
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isCrypt ? '#475569' : '#6b533b';
  if (adjPassable.n) {
    ctx.beginPath();
    ctx.moveTo(ix, iy + 1);
    ctx.lineTo(ix + ts, iy + 1);
    ctx.stroke();
  }
  if (adjPassable.s) {
    ctx.strokeStyle = isCrypt ? '#334155' : '#4a3828';
    ctx.beginPath();
    ctx.moveTo(ix, iy + ts - 1);
    ctx.lineTo(ix + ts, iy + ts - 1);
    ctx.stroke();
  }
  if (adjPassable.w) {
    ctx.strokeStyle = isCrypt ? '#3b495e' : '#574330';
    ctx.beginPath();
    ctx.moveTo(ix + 1, iy);
    ctx.lineTo(ix + 1, iy + ts);
    ctx.stroke();
  }
  if (adjPassable.e) {
    ctx.strokeStyle = isCrypt ? '#3b495e' : '#574330';
    ctx.beginPath();
    ctx.moveTo(ix + ts - 1, iy);
    ctx.lineTo(ix + ts - 1, iy + ts);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws richly textured passable dungeon floors, ambient occlusion wall shadows,
 * thematic props (glowing mushrooms, skeletal bones, wooden bridges, sarcophagi, runic slabs),
 * and clear interactive event icons (Stairs, Guard Posts, Treasure Chests, Shrines, Hazards, Boss Sanctum).
 */
function drawDungeonFloorAndProps(ctx, tile, gx, gy, cx, cy, x0, y0, tileSize, isCrypt, adjWalls, isVisibleNow, mapData) {
  const n1 = hashCoord(gx, gy, 77);
  const n2 = hashCoord(gx, gy, 151);
  const n3 = hashCoord(gx, gy, 229);
  const ix = Math.round(x0);
  const iy = Math.round(y0);
  const ts = Math.ceil(tileSize);

  const isBossTile = Boolean(tile.hasBoss || tile.feature === 'DUNGEON_BOSS' || tile.roomType === 'BOSS');
  const isSanctumFloor = Boolean(isBossTile || tile.roomType === 'BOSS_SANCTUM');
  const isTreasureTile = Boolean(tile.hasTreasure || tile.feature === 'TREASURE_CACHE' || tile.roomType === 'TREASURE');
  const isHazardTile = Boolean(tile.roomType === 'HAZARD' || (tile.feature && String(tile.feature).startsWith('HAZARD_')));
  const isGuardPost = Boolean(tile.feature === 'GUARD_POST' || tile.fixedEncounterKey);
  const isExitStairs = Boolean(tile.roomType === 'EXIT_STAIRS' || tile.feature === 'DUNGEON_EXIT');
  const isChamber = Boolean(tile.roomType === 'CHAMBER' || isSanctumFloor || isTreasureTile);

  // 1. Base Passable Floor Tone — Distinct high-contrast separation from solid walls & corridors vs chambers
  if (isCrypt) {
    if (isSanctumFloor) {
      ctx.fillStyle = (gx + gy) % 2 === 0 ? '#1b353b' : '#162c32';
    } else if (isChamber) {
      ctx.fillStyle = (gx + gy) % 2 === 0 ? '#2b3952' : '#253248';
    } else {
      ctx.fillStyle = n1 > 0.5 ? '#212d42' : '#1e293c';
    }
    ctx.fillRect(ix, iy, ts, ts);

    // Dressed marble/slate flagstone grid & beveled stone joints
    ctx.strokeStyle = isSanctumFloor ? 'rgba(52, 211, 153, 0.26)' : 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + 0.5, iy + 0.5, ts - 1, ts - 1);

    // Inner flagstone slab seam or diamond inlay in chambers
    if (isChamber) {
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.14)';
      ctx.strokeRect(ix + 4.5, iy + 4.5, ts - 9, ts - 9);
    } else {
      const subX = Math.round(ix + ts * (0.45 + (n2 - 0.5) * 0.12));
      const subY = Math.round(iy + ts * 0.5);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.beginPath();
      ctx.moveTo(ix + 2, subY + 0.5);
      ctx.lineTo(ix + ts - 2, subY + 0.5);
      ctx.moveTo(subX + 0.5, iy + 2);
      ctx.lineTo(subX + 0.5, subY);
      ctx.stroke();
    }

    // Crypt Nave central royal runner / processional aisle (x === 10)
    if (gx === 10 && gy >= 3 && gy <= 16) {
      const runW = Math.max(10, Math.round(ts * 0.44));
      ctx.fillStyle = isSanctumFloor ? 'rgba(16, 185, 129, 0.22)' : 'rgba(88, 28, 135, 0.34)';
      ctx.fillRect(Math.round(cx - runW / 2), iy, runW, ts);
      ctx.strokeStyle = isSanctumFloor ? 'rgba(52, 211, 153, 0.45)' : 'rgba(192, 132, 252, 0.35)';
      ctx.beginPath();
      ctx.moveTo(Math.round(cx - runW / 2) + 0.5, iy);
      ctx.lineTo(Math.round(cx - runW / 2) + 0.5, iy + ts);
      ctx.moveTo(Math.round(cx + runW / 2) - 0.5, iy);
      ctx.lineTo(Math.round(cx + runW / 2) - 0.5, iy + ts);
      ctx.stroke();
    }
  } else {
    // GOBLIN CAVE: Earthy subterranean limestone, worn cobbles in chambers, packed gravel in tunnels
    if (isSanctumFloor) {
      ctx.fillStyle = n1 > 0.5 ? '#42261e' : '#3a211a';
    } else if (isChamber) {
      ctx.fillStyle = n1 > 0.5 ? '#3d3227' : '#372d23';
    } else {
      ctx.fillStyle = n1 > 0.5 ? '#31281f' : '#2c241c';
    }
    ctx.fillRect(ix, iy, ts, ts);

    // Natural rough stone slab border & floor cracks
    ctx.strokeStyle = isSanctumFloor ? 'rgba(239, 68, 68, 0.28)' : 'rgba(180, 146, 108, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + 0.5, iy + 0.5, ts - 1, ts - 1);

    // Subterranean pebbles & floor cracks
    ctx.fillStyle = 'rgba(20, 15, 11, 0.42)';
    ctx.beginPath();
    ctx.arc(ix + ts * (0.28 + n1 * 0.4), iy + ts * (0.32 + n2 * 0.38), Math.max(1.5, ts * 0.045), 0, Math.PI * 2);
    ctx.arc(ix + ts * (0.68 - n2 * 0.3), iy + ts * (0.66 - n1 * 0.25), Math.max(1.2, ts * 0.035), 0, Math.PI * 2);
    ctx.fill();

    if (n3 < 0.35) {
      ctx.strokeStyle = 'rgba(18, 14, 10, 0.55)';
      ctx.beginPath();
      ctx.moveTo(ix + ts * 0.22, iy + ts * 0.35);
      ctx.lineTo(ix + ts * 0.48, iy + ts * 0.52);
      ctx.lineTo(ix + ts * 0.66, iy + ts * 0.44);
      ctx.stroke();
    }
  }

  // 2. Directional Ambient Occlusion Drop-Shadows from adjacent solid walls (gives immediate 3D corridor depth)
  if (adjWalls.n) {
    const shH = Math.max(6, Math.round(ts * 0.26));
    const gN = ctx.createLinearGradient(0, iy, 0, iy + shH);
    gN.addColorStop(0, 'rgba(3, 5, 10, 0.72)');
    gN.addColorStop(1, 'rgba(3, 5, 10, 0)');
    ctx.fillStyle = gN;
    ctx.fillRect(ix, iy, ts, shH);
  }
  if (adjWalls.s) {
    const shH = Math.max(4, Math.round(ts * 0.14));
    const gS = ctx.createLinearGradient(0, iy + ts - shH, 0, iy + ts);
    gS.addColorStop(0, 'rgba(3, 5, 10, 0)');
    gS.addColorStop(1, 'rgba(3, 5, 10, 0.48)');
    ctx.fillStyle = gS;
    ctx.fillRect(ix, iy + ts - shH, ts, shH);
  }
  if (adjWalls.w) {
    const shW = Math.max(4, Math.round(ts * 0.16));
    const gW = ctx.createLinearGradient(ix, 0, ix + shW, 0);
    gW.addColorStop(0, 'rgba(3, 5, 10, 0.52)');
    gW.addColorStop(1, 'rgba(3, 5, 10, 0)');
    ctx.fillStyle = gW;
    ctx.fillRect(ix, iy, shW, ts);
  }
  if (adjWalls.e) {
    const shW = Math.max(4, Math.round(ts * 0.16));
    const gE = ctx.createLinearGradient(ix + ts - shW, 0, ix + ts, 0);
    gE.addColorStop(0, 'rgba(3, 5, 10, 0)');
    gE.addColorStop(1, 'rgba(3, 5, 10, 0.52)');
    ctx.fillStyle = gE;
    ctx.fillRect(ix + ts - shW, iy, shW, ts);
  }

  // 3. Thematic Ambient Dungeon Architecture & Props (when not occupied by a primary interactive icon)
  const isPlainFloor = !isExitStairs && !isTreasureTile && !isHazardTile && !isBossTile && !isGuardPost;
  if (isPlainFloor) {
    const roomName = String(tile.name || '');
    if (!isCrypt) {
      // GOBLIN CAVE thematic props:
      // Rope & plank bridge across the Subterranean Chasm Bridge
      if (roomName.includes('Chasm Bridge')) {
        ctx.fillStyle = '#5c3a21';
        ctx.strokeStyle = '#2a180d';
        ctx.lineWidth = 1;
        for (let p = -2; p <= 2; p++) {
          const py = Math.round(cy + p * (ts * 0.17) - 2);
          ctx.fillRect(ix + 4, py, ts - 8, 4);
          ctx.strokeRect(ix + 4.5, py + 0.5, ts - 9, 3);
        }
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ix + 5, iy);
        ctx.lineTo(ix + 5, iy + ts);
        ctx.moveTo(ix + ts - 5, iy);
        ctx.lineTo(ix + ts - 5, iy + ts);
        ctx.stroke();
      } else if (roomName.includes('Fungal Grotto') || (n3 < 0.24 && (adjWalls.n || adjWalls.w || adjWalls.e))) {
        // Glowing bioluminescent cave mushrooms (blágrænir lýsandi sveppir)
        const mx = Math.round(cx + (n1 - 0.5) * ts * 0.36);
        const my = Math.round(cy + (n2 - 0.5) * ts * 0.32);
        const glowG = ctx.createRadialGradient(mx, my, 1, mx, my, ts * 0.28);
        glowG.addColorStop(0, 'rgba(45, 212, 191, 0.42)');
        glowG.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = glowG;
        ctx.beginPath();
        ctx.arc(mx, my, ts * 0.28, 0, Math.PI * 2);
        ctx.fill();

        // Mushroom stems & glowing cyan/emerald caps
        const cluster = [
          { dx: -4, dy: 2, r: 3.2 },
          { dx: 3, dy: 3, r: 2.6 },
          { dx: 0, dy: -2, r: 4.0 }
        ];
        for (const m of cluster) {
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(mx + m.dx - 1, my + m.dy, 2, 4);
          ctx.fillStyle = '#2dd4bf';
          ctx.strokeStyle = '#0f766e';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(mx + m.dx, my + m.dy, m.r, Math.PI, 0, false);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else if (roomName.includes('Spider-Silk Hollow')) {
        // Corner cobweb strands in the Spider-Silk Hollow
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.36)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ix + 2, iy + 2);
        ctx.lineTo(ix + ts * 0.42, iy + 2);
        ctx.lineTo(ix + 2, iy + ts * 0.42);
        ctx.closePath();
        ctx.stroke();
      } else if (roomName.includes('Bone-Strewn') || (n3 > 0.84 && isChamber)) {
        // Scattered bleached bone fragments & skull on cave floor
        const bx = Math.round(cx + (n2 - 0.5) * ts * 0.28);
        const by = Math.round(cy + (n1 - 0.5) * ts * 0.28);
        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx - 5, by - 2);
        ctx.lineTo(bx + 5, by + 3);
        ctx.moveTo(bx - 4, by + 4);
        ctx.lineTo(bx + 4, by - 3);
        ctx.stroke();
        ctx.fillStyle = '#e7e5e4';
        ctx.beginPath();
        ctx.arc(bx, by - 1, 2.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (roomName.includes('War-Camp') && n3 > 0.45) {
        // Crude goblin timber weapon rack / planks
        ctx.fillStyle = '#78350f';
        ctx.fillRect(Math.round(cx - 7), Math.round(cy - 2), 14, 4);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(cx - 7) + 0.5, Math.round(cy - 2) + 0.5, 13, 3);
      }
    } else {
      // ANCIENT CRYPT thematic props:
      if ((roomName.includes('Tomb Alcove') || roomName.includes('Catacomb Gallery') || roomName.includes('Mummy')) && (adjWalls.n || adjWalls.s) && n3 > 0.32) {
        // Carved stone sarcophagus (steinkista) in crypt burial alcoves
        const sw = Math.max(16, Math.round(ts * 0.54));
        const sh = Math.max(10, Math.round(ts * 0.34));
        const sx = Math.round(cx - sw / 2);
        const sy = Math.round(cy - sh / 2);
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.3;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        // Sarcophagus lid cross relief
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx + 4, cy + 0.5);
        ctx.lineTo(sx + sw - 4, cy + 0.5);
        ctx.moveTo(Math.round(cx - sw * 0.12) + 0.5, sy + 2);
        ctx.lineTo(Math.round(cx - sw * 0.12) + 0.5, sy + sh - 2);
        ctx.stroke();
      } else if (roomName.includes('Pillared Crypt Nave') && (gx === 9 || gx === 11) && gy % 2 === 0) {
        // Fluted stone colonnade pillars flanking the Crypt Nave
        const pr = Math.max(4, Math.round(ts * 0.14));
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (roomName.includes('Ossuary') && n3 > 0.42) {
        // Bronze ossuary floor grate & bone niche
        const gw = Math.max(12, Math.round(ts * 0.36));
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(cx - gw / 2) + 0.5, Math.round(cy - gw / 2) + 0.5, gw, gw);
      } else if (isSanctumFloor && !isBossTile) {
        // Eldritch pale-gold / emerald runic inlays on the Barrow-Wight Sanctum floor
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.38)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.24, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // 4. Local Tile Radial Illumination (only on VISIBLE tiles)
  if (isVisibleNow) {
    const glowR = ts * 0.52;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowR);
    if (isCrypt) {
      grad.addColorStop(0, isSanctumFloor ? 'rgba(52, 211, 153, 0.24)' : 'rgba(129, 140, 248, 0.18)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    } else {
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
      grad.addColorStop(1, 'rgba(28, 25, 23, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Interactive Dungeon Features & Event Icons (only on discovered tiles)
  if (isExitStairs) {
    // ENTRANCE / EXIT STAIRS: Recessed stone stairwell with descending steps, iron handrails & daylight/lantern beacon
    const sw = Math.round(ts * 0.64);
    const sx = Math.round(cx - sw / 2);
    const sy = Math.round(cy - sw / 2);

    // Outer stone curb
    ctx.fillStyle = isCrypt ? '#1e293b' : '#292524';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.fillRect(sx, sy, sw, sw);
    ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sw - 1);

    // Descending carved steps with progressive shadow depth
    const steps = 5;
    const stepH = Math.floor((sw - 6) / steps);
    for (let s = 0; s < steps; s++) {
      const shade = 215 - s * 28;
      ctx.fillStyle = `rgb(${shade}, ${shade - 8}, ${shade - 18})`;
      ctx.fillRect(sx + 3, sy + 3 + s * stepH, sw - 6, Math.max(2, stepH - 1));
    }

    // Upward exit arrow indicator
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(cx, sy + 4);
    ctx.lineTo(cx - 5, sy + 10);
    ctx.lineTo(cx + 5, sy + 10);
    ctx.closePath();
    ctx.fill();
  } else if (isTreasureTile) {
    const opened = Boolean(tile.eventResolved || tile.treasureLooted);
    const isShrineOrAltar = Boolean(
      tile.treasureKey === 'CAVE_FUNGAL_SHRINE' ||
      tile.treasureKey === 'CRYPT_ROYAL_OFFERING' ||
      String(tile.name || '').includes('Shrine') ||
      String(tile.name || '').includes('Altar')
    );

    if (isShrineOrAltar) {
      // SACRED SHRINE / ALTAR: Glowing pedestal with chalice/crystal aura
      const auraR = ts * 0.36;
      if (!opened) {
        const sGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, auraR);
        sGrad.addColorStop(0, isCrypt ? 'rgba(250, 204, 21, 0.55)' : 'rgba(45, 212, 191, 0.55)');
        sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stone altar base
      ctx.fillStyle = isCrypt ? '#334155' : '#3f3f46';
      ctx.strokeStyle = opened ? '#64748b' : (isCrypt ? '#fde047' : '#2dd4bf');
      ctx.lineWidth = 1.8;
      ctx.fillRect(Math.round(cx - 11), Math.round(cy - 7), 22, 14);
      ctx.strokeRect(Math.round(cx - 11) + 0.5, Math.round(cy - 7) + 0.5, 21, 13);

      // Glowing gem / sacred flame on top of shrine
      ctx.fillStyle = opened ? '#475569' : (isCrypt ? '#fef08a' : '#5eead4');
      ctx.beginPath();
      ctx.moveTo(cx, cy - 11);
      ctx.lineTo(cx - 5, cy - 2);
      ctx.lineTo(cx, cy + 3);
      ctx.lineTo(cx + 5, cy - 2);
      ctx.closePath();
      ctx.fill();
    } else {
      // TREASURE CHEST: Domed oak/iron or silver-bound reliquary chest with gold lock & sparkles
      if (!opened) {
        const tGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, ts * 0.36);
        tGrad.addColorStop(0, 'rgba(250, 204, 21, 0.42)');
        tGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }

      const cw = 24;
      const ch = 16;
      const bx = Math.round(cx - cw / 2);
      const by = Math.round(cy - ch / 2 + 1);

      // Chest body
      ctx.fillStyle = opened ? '#334155' : (isCrypt ? '#475569' : '#78350f');
      ctx.strokeStyle = opened ? '#64748b' : '#facc15';
      ctx.lineWidth = 1.8;
      ctx.fillRect(bx, by, cw, ch);
      ctx.strokeRect(bx + 0.5, by + 0.5, cw - 1, ch - 1);

      // Metal straps
      ctx.fillStyle = opened ? '#475569' : '#eab308';
      ctx.fillRect(bx + 4, by, 3, ch);
      ctx.fillRect(bx + cw - 7, by, 3, ch);

      if (!opened) {
        // Closed lid seam & golden lock plate
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(bx, by + 6.5);
        ctx.lineTo(bx + cw, by + 6.5);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.fillRect(Math.round(cx - 3), by + 4, 6, 6);

        // Sparkle stars around unopened chest
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(bx - 3, by - 3, 2, 2);
        ctx.fillRect(bx + cw + 1, by - 2, 2, 2);
      } else {
        // Dark open interior showing chest has been looted
        ctx.fillStyle = '#090d16';
        ctx.fillRect(bx + 2, by + 2, cw - 4, 5);
      }
    }
  } else if (isHazardTile) {
    // TRAP / HAZARD: Distinct iconography per hazard type (bone spikes, spider webs, necrotic mist, cursed brazier)
    const triggered = Boolean(tile.eventResolved || tile.hazardTriggered);
    const feat = String(tile.feature || '');

    if (feat === 'HAZARD_SPIDER_WEBS') {
      // Concentric spider web trap across the tunnel
      ctx.strokeStyle = triggered ? 'rgba(148, 163, 184, 0.35)' : 'rgba(241, 245, 249, 0.82)';
      ctx.lineWidth = 1.3;
      const r = ts * 0.34;
      ctx.beginPath();
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 4;
        ctx.moveTo(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r);
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    } else if (feat === 'HAZARD_BONE_SPIKES') {
      // Jagged bone spikes erupting from floor sockets
      const spikes = [
        { dx: -7, dy: 4 },
        { dx: 0, dy: 6 },
        { dx: 7, dy: 4 },
        { dx: -4, dy: -2 },
        { dx: 4, dy: -2 }
      ];
      for (const sp of spikes) {
        ctx.fillStyle = triggered ? '#64748b' : '#f8fafc';
        ctx.strokeStyle = triggered ? '#334155' : '#ef4444';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(cx + sp.dx - 3, cy + sp.dy);
        ctx.lineTo(cx + sp.dx, cy + sp.dy - 9);
        ctx.lineTo(cx + sp.dx + 3, cy + sp.dy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (feat === 'HAZARD_CURSED_BRAZIER') {
      // Dark-iron tripod brazier with purple-green soulfire
      if (!triggered) {
        const bGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, ts * 0.36);
        bGrad.addColorStop(0, 'rgba(168, 85, 247, 0.50)');
        bGrad.addColorStop(1, 'rgba(52, 211, 153, 0)');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = triggered ? '#64748b' : '#c084fc';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 8, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!triggered) {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx - 5, cy + 1);
        ctx.lineTo(cx + 5, cy + 1);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // HAZARD_NECROTIC_MIST or generic hazard vent
      const mGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, ts * 0.36);
      mGrad.addColorStop(0, triggered ? 'rgba(100, 116, 139, 0.25)' : 'rgba(52, 211, 153, 0.48)');
      mGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.36, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = triggered ? '#64748b' : (isCrypt ? '#34d399' : '#f97316');
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else if (isGuardPost) {
    // GUARD POST / FIXED ENCOUNTER: Watchfire brazier, crossed blades, and threat marker
    const cleared = Boolean(tile.eventResolved);
    if (!cleared) {
      const gGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, ts * 0.36);
      gGrad.addColorStop(0, isCrypt ? 'rgba(56, 189, 248, 0.38)' : 'rgba(249, 115, 22, 0.42)');
      gGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crossed swords / halberds over guard post ring
    ctx.strokeStyle = cleared ? 'rgba(100, 116, 139, 0.55)' : (isCrypt ? '#38bdf8' : '#fb923c');
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, ts * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = cleared ? '#64748b' : '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 7);
    ctx.lineTo(cx + 7, cy + 7);
    ctx.moveTo(cx + 7, cy - 7);
    ctx.lineTo(cx - 7, cy + 7);
    ctx.stroke();

    if (!cleared) {
      // Glowing watchfire ember in center
      ctx.fillStyle = isCrypt ? '#38bdf8' : '#facc15';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (isBossTile) {
    // BOSS SANCTUM: Grand ritual summoning circle, corner braziers, throne/sarcophagus dais & boss crown sigil
    const bossDead = Boolean(mapData.bossSlain);
    const rOuter = ts * 0.42;
    const rInner = ts * 0.28;

    const bGrad = ctx.createRadialGradient(cx, cy, 3, cx, cy, rOuter * 1.15);
    if (bossDead) {
      bGrad.addColorStop(0, 'rgba(34, 197, 94, 0.40)');
      bGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
    } else if (isCrypt) {
      bGrad.addColorStop(0, 'rgba(52, 211, 153, 0.52)');
      bGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.26)');
      bGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    } else {
      bGrad.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
      bGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.25)');
      bGrad.addColorStop(1, 'rgba(28, 25, 23, 0)');
    }
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Outer & inner ritual rings
    ctx.strokeStyle = bossDead ? '#4ade80' : (isCrypt ? '#34d399' : '#ef4444');
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = bossDead ? 'rgba(74, 222, 128, 0.7)' : (isCrypt ? '#c084fc' : '#f59e0b');
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Corner Sanctum Braziers
    const bOff = ts * 0.34;
    const corners = [
      { dx: -bOff, dy: -bOff },
      { dx: bOff, dy: -bOff },
      { dx: -bOff, dy: bOff },
      { dx: bOff, dy: bOff }
    ];
    for (const c of corners) {
      ctx.fillStyle = bossDead ? '#4ade80' : (isCrypt ? '#34d399' : '#fb923c');
      ctx.beginPath();
      ctx.arc(cx + c.dx, cy + c.dy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crown / Skull Boss Emblem in center
    ctx.fillStyle = bossDead ? '#86efac' : '#fde047';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 5);
    ctx.lineTo(cx - 9, cy - 4);
    ctx.lineTo(cx - 4, cy + 1);
    ctx.lineTo(cx, cy - 7);
    ctx.lineTo(cx + 4, cy + 1);
    ctx.lineTo(cx + 9, cy - 4);
    ctx.lineTo(cx + 8, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawDungeonWorld(state, mapData, w, h) {
  const tiles = mapData.tiles || [];
  const isCrypt = mapData.dungeonKey === 'ANCIENT_CRYPT';
  const focusX = heroVisualX !== null ? heroVisualX : (typeof mapData.heroX === 'number' ? mapData.heroX : 3);
  const focusY = heroVisualY !== null ? heroVisualY : (typeof mapData.heroY === 'number' ? mapData.heroY : 16);

  const metrics = computeCameraViewportMetrics(w, h, mapData, focusX, focusY);
  lastLayoutMetrics = metrics;

  const {
    minX,
    minY,
    tileSize,
    camPxX,
    camPxY,
    startCol,
    endCol,
    startRow,
    endRow
  } = metrics;

  // Pitch-black subterranean void backdrop (#050508 per dungeon specification)
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, w, h);

  const tileByKey = new Map();
  for (const t of tiles) {
    tileByKey.set(`${t.x},${t.y}`, t);
  }

  // Integer-snapped tile centers for razor-sharp rendering at 1440x900 and 1920x1080
  const toScreenCenter = (gx, gy) => ({
    cx: Math.round((gx - minX + 0.5) * tileSize - camPxX),
    cy: Math.round((gy - minY + 0.5) * tileSize - camPxY)
  });

  const isPassableAt = (gx, gy) => {
    const t = tileByKey.get(`${gx},${gy}`);
    return Boolean(t && t.isPassable);
  };

  // 1. Render Dungeon Tiles with strict 3-State Fog of War (UNEXPLORED, EXPLORED_MEMORY, VISIBLE)
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      const { cx, cy } = toScreenCenter(gx, gy);
      const x0 = Math.round(cx - tileSize / 2);
      const y0 = Math.round(cy - tileSize / 2);
      const ts = Math.ceil(tileSize);

      const isDiscovered = Boolean(tile && tile.isDiscovered && tile.fogState !== 'UNEXPLORED');
      const isVisibleNow = Boolean(tile && (tile.isVisibleNow || tile.isVisible || tile.fogState === 'VISIBLE'));

      // STATE 1: UNEXPLORED — Completely pitch black (#050508), zero leakage of walls, corridors, treasures, or bosses
      if (!isDiscovered) {
        ctx.fillStyle = '#050508';
        ctx.fillRect(x0, y0, ts, ts);
        continue;
      }

      const adjPassable = {
        n: isPassableAt(gx, gy - 1),
        s: isPassableAt(gx, gy + 1),
        w: isPassableAt(gx - 1, gy),
        e: isPassableAt(gx + 1, gy)
      };
      const adjWalls = {
        n: !adjPassable.n,
        s: !adjPassable.s,
        w: !adjPassable.w,
        e: !adjPassable.e
      };

      // STATE 2 & 3: Discovered Dungeon Wall or Passable Floor
      if (!tile.isPassable) {
        drawDungeonWallTile(ctx, gx, gy, x0, y0, tileSize, isCrypt, adjPassable, isVisibleNow);
      } else {
        drawDungeonFloorAndProps(ctx, tile, gx, gy, cx, cy, x0, y0, tileSize, isCrypt, adjWalls, isVisibleNow, mapData);
      }

      // STATE 2 SHROUD: Explored memory outside current Line of Sight (cool desaturated slate-blue memory shroud)
      if (!isVisibleNow) {
        ctx.fillStyle = isCrypt ? 'rgba(4, 7, 14, 0.64)' : 'rgba(5, 6, 10, 0.62)';
        ctx.fillRect(x0, y0, ts, ts);
      }
    }
  }

  // 2. Hero Torch / Lantern Radial Illumination across currently VISIBLE tiles
  const { cx: heroCx, cy: heroCy } = toScreenCenter(focusX, focusY);
  const visionRadius = Number(mapData.visionRadius || 2);
  const torchRadiusPx = (visionRadius + 0.85) * tileSize;
  ctx.save();
  const torchGrad = ctx.createRadialGradient(heroCx, heroCy, tileSize * 0.18, heroCx, heroCy, torchRadiusPx);
  if (isCrypt) {
    // Cold blue-violet & pale gold lantern aura in the Ancient Crypt
    torchGrad.addColorStop(0, 'rgba(254, 240, 138, 0.16)');
    torchGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.10)');
    torchGrad.addColorStop(1, 'rgba(5, 5, 8, 0)');
  } else {
    // Warm flickering amber-orange torchlight in the Goblin Cave
    torchGrad.addColorStop(0, 'rgba(251, 191, 36, 0.20)');
    torchGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.11)');
    torchGrad.addColorStop(1, 'rgba(5, 5, 8, 0)');
  }
  ctx.fillStyle = torchGrad;
  ctx.beginPath();
  ctx.arc(heroCx, heroCy, torchRadiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Re-stamp strict #050508 darkness on any UNEXPLORED tiles within the radial gradient bounding box
  // so zero torchlight ever bleeds onto undiscovered tiles!
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      const isDiscovered = Boolean(tile && tile.isDiscovered && tile.fogState !== 'UNEXPLORED');
      if (!isDiscovered) {
        const { cx, cy } = toScreenCenter(gx, gy);
        const x0 = Math.round(cx - tileSize / 2);
        const y0 = Math.round(cy - tileSize / 2);
        const ts = Math.ceil(tileSize);
        ctx.fillStyle = '#050508';
        ctx.fillRect(x0, y0, ts, ts);
      }
    }
  }

  // 3. Adjacent Passable Step Hints
  const heroTileX = Number(mapData.heroX);
  const heroTileY = Number(mapData.heroY);
  const isLocked = Boolean(state.encounter && (state.encounter.status === 'IN_COMBAT' || state.encounter.isAmbush));
  if (!isLocked) {
    const adjCoords = [
      { x: heroTileX, y: heroTileY - 1 },
      { x: heroTileX, y: heroTileY + 1 },
      { x: heroTileX - 1, y: heroTileY },
      { x: heroTileX + 1, y: heroTileY }
    ];
    for (const adj of adjCoords) {
      const t = tileByKey.get(`${adj.x},${adj.y}`);
      if (!t || !t.isPassable) continue;
      const { cx, cy } = toScreenCenter(adj.x, adj.y);
      const isHovered = Boolean(hoveredGridCoord && hoveredGridCoord.x === adj.x && hoveredGridCoord.y === adj.y);
      ctx.save();
      ctx.strokeStyle = isHovered ? 'rgba(250, 204, 21, 0.92)' : 'rgba(197, 160, 89, 0.34)';
      ctx.fillStyle = isHovered ? 'rgba(250, 204, 21, 0.16)' : 'rgba(197, 160, 89, 0.06)';
      ctx.lineWidth = isHovered ? 2.2 : 1.2;
      const box = Math.round(tileSize * 0.72);
      const bx = Math.round(cx - box / 2);
      const by = Math.round(cy - box / 2);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, box, box, 8);
      else ctx.rect(bx, by, box, box);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 4. Hero Token
  drawHeroToken(ctx, heroCx, heroCy, tileSize, state);

  // 5. Crisp, Non-Overlapping Labels for Visible/Discovered Exit Stairs, Boss Sanctum, Treasures, or Hovered Room
  const placedLabelBoxes = [];
  const labelCandidates = [];
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !tile.isDiscovered || !tile.isPassable) continue;
      const isHovered = Boolean(hoveredGridCoord && hoveredGridCoord.x === gx && hoveredGridCoord.y === gy);
      const isBoss = tile.roomType === 'BOSS';
      const isExit = tile.roomType === 'EXIT_STAIRS';
      const isVisibleTreasure = tile.roomType === 'TREASURE' && tile.isVisibleNow && !tile.eventResolved && !tile.treasureLooted;
      const isVisibleGuard = tile.feature === 'GUARD_POST' && tile.isVisibleNow && !tile.eventResolved;
      if (!isHovered && !isBoss && !isExit && !isVisibleTreasure && !isVisibleGuard) continue;

      // Priority order: Hovered (1) > Boss (2) > Exit Stairs (3) > Visible Treasure (4) > Visible Guard Post (5)
      const priority = isHovered ? 1 : (isBoss ? 2 : (isExit ? 3 : (isVisibleTreasure ? 4 : 5)));
      labelCandidates.push({ tile, gx, gy, priority, isBoss, isExit, isVisibleTreasure, isVisibleGuard });
    }
  }
  labelCandidates.sort((a, b) => a.priority - b.priority);

  for (const item of labelCandidates) {
    const { tile, gx, gy, isBoss, isExit, isVisibleGuard } = item;
    const { cx, cy } = toScreenCenter(gx, gy);
    let borderCol = '#c5a059';
    let textCol = '#fde68a';
    if (isBoss) {
      borderCol = mapData.bossSlain ? '#4ade80' : '#ef4444';
      textCol = mapData.bossSlain ? '#86efac' : '#fca5a5';
    } else if (isExit) {
      borderCol = '#fde047';
      textCol = '#fef08a';
    } else if (isVisibleGuard) {
      borderCol = isCrypt ? '#38bdf8' : '#fb923c';
      textCol = isCrypt ? '#bae6fd' : '#fed7aa';
    }

    const labelY = Math.round(cy - tileSize * 0.44);
    ctx.save();
    ctx.font = '700 11px Georgia, serif';
    const estW = Math.ceil(ctx.measureText(tile.name).width) + 18;
    const estH = 20;
    ctx.restore();

    const box = {
      x1: Math.max(8, Math.min(w - estW - 8, Math.round(cx - estW / 2))),
      y1: Math.max(8, Math.min(h - estH - 8, Math.round(labelY - estH / 2))),
      x2: 0,
      y2: 0
    };
    box.x2 = box.x1 + estW;
    box.y2 = box.y1 + estH;

    const overlaps = placedLabelBoxes.some(
      (b) => !(box.x2 + 4 < b.x1 || box.x1 - 4 > b.x2 || box.y2 + 4 < b.y1 || box.y1 - 4 > b.y2)
    );
    if (!overlaps) {
      placedLabelBoxes.push(box);
      const clampedCx = Math.round((box.x1 + box.x2) / 2);
      const clampedCy = Math.round((box.y1 + box.y2) / 2);
      drawMapLabel(ctx, clampedCx, clampedCy, tile.name, textCol, borderCol);
    }
  }

  // 6. Subterranean Vignette around outer viewport perimeter (preserving #050508 darkness)
  const edgeGrad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.28,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.68
  );
  edgeGrad.addColorStop(0, 'rgba(5, 5, 8, 0)');
  edgeGrad.addColorStop(1, 'rgba(5, 5, 8, 0.78)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);
}

export function drawTopdownWorld(state) {
  if (!canvasEl || !ctx || !state || !state.topdownMap) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvasEl.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width));
  const h = Math.max(240, Math.floor(rect.height));

  if (canvasEl.width !== Math.floor(w * dpr) || canvasEl.height !== Math.floor(h * dpr)) {
    canvasEl.width = Math.floor(w * dpr);
    canvasEl.height = Math.floor(h * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  if (state.dungeonMap && state.dungeonMap.inDungeon) {
    drawDungeonWorld(state, state.dungeonMap, w, h);
    ctx.restore();
    return;
  }

  const mapData = state.topdownMap;
  const tiles = mapData.tiles || [];

  const focusX = heroVisualX !== null ? heroVisualX : (state.currentTile ? state.currentTile.x : 15);
  const focusY = heroVisualY !== null ? heroVisualY : (state.currentTile ? state.currentTile.y : 27);

  const metrics = computeCameraViewportMetrics(w, h, mapData, focusX, focusY);
  lastLayoutMetrics = metrics;

  const {
    minX,
    minY,
    tileSize,
    camPxX,
    camPxY,
    startCol,
    endCol,
    startRow,
    endRow
  } = metrics;

  // Deep forest backdrop
  ctx.fillStyle = '#070b09';
  ctx.fillRect(0, 0, w, h);

  const tileByKey = new Map();
  for (const t of tiles) {
    tileByKey.set(`${t.x},${t.y}`, t);
  }

  const toScreenCenter = (gx, gy) => ({
    cx: (gx - minX + 0.5) * tileSize - camPxX,
    cy: (gy - minY + 0.5) * tileSize - camPxY
  });

  // 1. Base ground terrain layer (only within camera frustum)
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      const { cx, cy } = toScreenCenter(gx, gy);
      const x0 = cx - tileSize / 2;
      const y0 = cy - tileSize / 2;
      const n = hashCoord(gx, gy, 1);

      const isUndeadTile = Boolean(tile && (tile.isUndeadLands || tile.regionKey === 'UNDEAD_LANDS'));
      const isHighlandTile = Boolean(tile && (tile.isRavencragHighlands || tile.regionKey === 'RAVENCRAG_HIGHLANDS'));

      if (!tile || !tile.isPassable) {
        if (tile && tile.visualKind === 'RIVER') {
          ctx.fillStyle = '#0b181c';
        } else if (tile && tile.visualKind === 'BLIGHT_POOL') {
          ctx.fillStyle = '#0d2624';
        } else if (tile && tile.visualKind === 'CRYPT_WALL') {
          ctx.fillStyle = '#111520';
        } else if (tile && tile.visualKind === 'HIGHLAND_CHASM') {
          ctx.fillStyle = '#070a0f';
        } else if (tile && tile.visualKind === 'CITADEL_WALL') {
          ctx.fillStyle = '#1d222b';
        } else if (isHighlandTile) {
          ctx.fillStyle = n > 0.5 ? '#151921' : '#181d26';
        } else if (isUndeadTile) {
          ctx.fillStyle = n > 0.5 ? '#0e131b' : '#111722';
        } else if (tile && tile.visualKind === 'CLIFF_ROCK') {
          ctx.fillStyle = '#14191e';
        } else {
          ctx.fillStyle = n > 0.5 ? '#0b130f' : '#0d1611';
        }
        ctx.fillRect(x0 - 0.5, y0 - 0.5, tileSize + 1, tileSize + 1);
      } else {
        if (tile.biome === 'SANCTUARY') {
          ctx.fillStyle = '#1e271c';
        } else if (tile.biome === 'STRONGHOLD') {
          ctx.fillStyle = '#201916';
        } else if (isHighlandTile) {
          if (tile.biome === 'STORMPEAK_CRAGS') {
            ctx.fillStyle = n > 0.5 ? '#1e242e' : '#222834';
          } else if (tile.biome === 'SHATTERED_GORGE') {
            ctx.fillStyle = n > 0.5 ? '#1b2028' : '#1e242d';
          } else {
            ctx.fillStyle = n > 0.5 ? '#20231c' : '#242720';
          }
        } else if (isUndeadTile) {
          if (tile.biome === 'NECROPOLIS_SANCTUM') {
            ctx.fillStyle = n > 0.5 ? '#151b26' : '#181f2c';
          } else if (tile.biome === 'DEADMANS_MIRE') {
            ctx.fillStyle = n > 0.5 ? '#122022' : '#142426';
          } else {
            ctx.fillStyle = n > 0.5 ? '#161b24' : '#191f29';
          }
        } else if (tile.visualType === 'TRAIL' || (tile.pathConnections && tile.pathConnections.length > 0)) {
          ctx.fillStyle = n > 0.5 ? '#182419' : '#1a271b';
        } else {
          ctx.fillStyle = n > 0.5 ? '#121d15' : '#152118';
        }
        ctx.fillRect(x0 - 0.5, y0 - 0.5, tileSize + 1, tileSize + 1);

        // Organic floor patches: Highland slate/amber vs. Undead necrotic teal/violet vs. Goblin Forest moss
        const patchR = tileSize * (0.28 + n * 0.16);
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, patchR);
        if (isHighlandTile) {
          grad.addColorStop(0, tile.biome === 'STORMPEAK_CRAGS' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(249, 115, 22, 0.16)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        } else if (isUndeadTile) {
          grad.addColorStop(0, tile.biome === 'DEADMANS_MIRE' ? 'rgba(45, 212, 191, 0.20)' : 'rgba(139, 92, 246, 0.18)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        } else {
          grad.addColorStop(0, 'rgba(42, 68, 44, 0.32)');
          grad.addColorStop(1, 'rgba(20, 33, 23, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, patchR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 2. Continuous Blackwood River & Gorge Watercourse
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const riverSpine = [
    [20, -0.5], [20, 3], [20, 6], [20, 9],
    [19.5, 10], [19, 13], [19, 17], [19, 21],
    [19, 25], [19, 29.5]
  ];
  // Outer muddy gorge bank
  ctx.strokeStyle = 'rgba(18, 28, 32, 0.92)';
  ctx.lineWidth = tileSize * 0.72;
  ctx.beginPath();
  riverSpine.forEach(([rx, ry], idx) => {
    const { cx, cy } = toScreenCenter(rx, ry);
    if (idx === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  // Deep river water channel
  ctx.strokeStyle = '#133b4e';
  ctx.lineWidth = tileSize * 0.48;
  ctx.beginPath();
  riverSpine.forEach(([rx, ry], idx) => {
    const { cx, cy } = toScreenCenter(rx, ry);
    if (idx === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  // Shimmering current center-line
  ctx.strokeStyle = 'rgba(94, 176, 212, 0.35)';
  ctx.lineWidth = tileSize * 0.16;
  ctx.beginPath();
  riverSpine.forEach(([rx, ry], idx) => {
    const { cx, cy } = toScreenCenter(rx, ry);
    if (idx === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();
  ctx.restore();

  // 3. Data-Driven Winding Trails (Goblin Forest dirt vs. Undead Lands stone causeway vs. Ravencrag Highland mountain trails)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const dirDeltas = {
    N: [0, -1],
    S: [0, 1],
    E: [1, 0],
    W: [-1, 0]
  };

  // Outer worn trail edge (Goblin Forest)
  ctx.strokeStyle = 'rgba(62, 46, 30, 0.72)';
  ctx.lineWidth = Math.max(14, tileSize * 0.36);
  ctx.beginPath();
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || tile.isUndeadLands || tile.regionKey === 'UNDEAD_LANDS' || tile.isRavencragHighlands || tile.regionKey === 'RAVENCRAG_HIGHLANDS') continue;
      if (!Array.isArray(tile.pathConnections) || tile.pathConnections.length === 0) continue;
      const { cx, cy } = toScreenCenter(gx, gy);
      for (const dir of tile.pathConnections) {
        const d = dirDeltas[dir];
        if (!d) continue;
        const { cx: nx, cy: ny } = toScreenCenter(gx + d[0] * 0.52, gy + d[1] * 0.52);
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
      }
    }
  }
  ctx.stroke();

  // Inner warm dirt path (Goblin Forest)
  ctx.strokeStyle = 'rgba(104, 79, 51, 0.78)';
  ctx.lineWidth = Math.max(8, tileSize * 0.21);
  ctx.beginPath();
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || tile.isUndeadLands || tile.regionKey === 'UNDEAD_LANDS' || tile.isRavencragHighlands || tile.regionKey === 'RAVENCRAG_HIGHLANDS') continue;
      if (!Array.isArray(tile.pathConnections) || tile.pathConnections.length === 0) continue;
      const { cx, cy } = toScreenCenter(gx, gy);
      for (const dir of tile.pathConnections) {
        const d = dirDeltas[dir];
        if (!d) continue;
        const { cx: nx, cy: ny } = toScreenCenter(gx + d[0] * 0.52, gy + d[1] * 0.52);
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
      }
    }
  }
  ctx.stroke();

  // Undead Lands Sepulcher Flagstone Road (Outer slate border + Inner cracked stone causeway)
  ctx.strokeStyle = 'rgba(45, 55, 72, 0.82)';
  ctx.lineWidth = Math.max(14, tileSize * 0.36);
  ctx.beginPath();
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !(tile.isUndeadLands || tile.regionKey === 'UNDEAD_LANDS')) continue;
      if (!Array.isArray(tile.pathConnections) || tile.pathConnections.length === 0) continue;
      const { cx, cy } = toScreenCenter(gx, gy);
      for (const dir of tile.pathConnections) {
        const d = dirDeltas[dir];
        if (!d) continue;
        const { cx: nx, cy: ny } = toScreenCenter(gx + d[0] * 0.52, gy + d[1] * 0.52);
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
      }
    }
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(100, 116, 139, 0.72)';
  ctx.lineWidth = Math.max(8, tileSize * 0.21);
  ctx.beginPath();
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !(tile.isUndeadLands || tile.regionKey === 'UNDEAD_LANDS')) continue;
      if (!Array.isArray(tile.pathConnections) || tile.pathConnections.length === 0) continue;
      const { cx, cy } = toScreenCenter(gx, gy);
      for (const dir of tile.pathConnections) {
        const d = dirDeltas[dir];
        if (!d) continue;
        const { cx: nx, cy: ny } = toScreenCenter(gx + d[0] * 0.52, gy + d[1] * 0.52);
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
      }
    }
  }
  ctx.stroke();

  // Ravencrag Highlands Mountain Ridge Trails (Outer basalt curb + Inner crushed amber-slate gravel)
  ctx.strokeStyle = 'rgba(55, 65, 81, 0.85)';
  ctx.lineWidth = Math.max(14, tileSize * 0.36);
  ctx.beginPath();
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !(tile.isRavencragHighlands || tile.regionKey === 'RAVENCRAG_HIGHLANDS')) continue;
      if (!Array.isArray(tile.pathConnections) || tile.pathConnections.length === 0) continue;
      const { cx, cy } = toScreenCenter(gx, gy);
      for (const dir of tile.pathConnections) {
        const d = dirDeltas[dir];
        if (!d) continue;
        const { cx: nx, cy: ny } = toScreenCenter(gx + d[0] * 0.52, gy + d[1] * 0.52);
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
      }
    }
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(180, 142, 92, 0.78)';
  ctx.lineWidth = Math.max(8, tileSize * 0.21);
  ctx.beginPath();
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !(tile.isRavencragHighlands || tile.regionKey === 'UNDEAD_LANDS' && false || tile.regionKey === 'RAVENCRAG_HIGHLANDS')) continue;
      if (!Array.isArray(tile.pathConnections) || tile.pathConnections.length === 0) continue;
      const { cx, cy } = toScreenCenter(gx, gy);
      for (const dir of tile.pathConnections) {
        const d = dirDeltas[dir];
        if (!d) continue;
        const { cx: nx, cy: ny } = toScreenCenter(gx + d[0] * 0.52, gy + d[1] * 0.52);
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
      }
    }
  }
  ctx.stroke();
  ctx.restore();

  // 4. Passable Tile Ground Details & Landmarks
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !tile.isPassable) continue;
      const { cx, cy } = toScreenCenter(gx, gy);
      const isUndeadTile = Boolean(tile.isUndeadLands || tile.regionKey === 'UNDEAD_LANDS');
      const isHighlandTile = Boolean(tile.isRavencragHighlands || tile.regionKey === 'RAVENCRAG_HIGHLANDS');

      // Small pebbles, tufts & border bushes/headstones/boulders on passable wilderness tiles
      if (!tile.isLandmark) {
        for (let i = 0; i < 3; i++) {
          const r1 = hashCoord(gx, gy, 20 + i);
          const r2 = hashCoord(gx, gy, 40 + i);
          const px = cx + (r1 - 0.5) * tileSize * 0.65;
          const py = cy + (r2 - 0.5) * tileSize * 0.65;
          ctx.fillStyle = isHighlandTile
            ? (i === 0 ? 'rgba(251, 146, 60, 0.22)' : 'rgba(148, 163, 184, 0.28)')
            : isUndeadTile
              ? (i === 0 ? 'rgba(52, 211, 153, 0.22)' : 'rgba(148, 163, 184, 0.24)')
              : (i === 0 ? 'rgba(148, 163, 184, 0.16)' : 'rgba(54, 83, 58, 0.34)');
          ctx.beginPath();
          ctx.arc(px, py, 1.5 + (r1 * 1.4), 0, Math.PI * 2);
          ctx.fill();
        }
        const isOffTrail = !tile.pathConnections || tile.pathConnections.length === 0;
        if (isOffTrail && hashCoord(gx, gy, 88) > 0.32) {
          const bx = cx + (hashCoord(gx, gy, 89) - 0.5) * tileSize * 0.58;
          const by = cy + (hashCoord(gx, gy, 90) - 0.5) * tileSize * 0.58;
          if (isHighlandTile) {
            drawRockOutcrop(ctx, bx, by, (tileSize / 68) * 0.62);
          } else if (isUndeadTile) {
            drawBarrowHeadstone(ctx, bx, by, (tileSize / 68) * 0.85);
          } else {
            drawBushClump(ctx, bx, by, (tileSize / 68) * 0.76);
          }
        }
      }

      if (tile.isLandmark && tile.landmarkKey) {
        const isSlainForLandmark = tile.landmarkKey === 'RAVENCRAG_CITADEL'
          ? Boolean(mapData.highlandBossSlain)
          : Boolean(mapData.bossSlain);
        drawLandmarkStructure(ctx, cx, cy, tileSize, tile.landmarkKey, isSlainForLandmark);
      }
    }
  }

  // 5. Dense Forest Canopy, Undead Barrow Trees & Highland Crags (sorted top-to-bottom for natural 2.5D overlap)
  const treeScaleBase = Math.max(0.55, Math.min(1.18, tileSize / 68));
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      const isUndeadTile = Boolean(tile && (tile.isUndeadLands || tile.regionKey === 'UNDEAD_LANDS'));
      const isHighlandTile = Boolean(tile && (tile.isRavencragHighlands || tile.regionKey === 'RAVENCRAG_HIGHLANDS'));

      if (tile && tile.isPassable) {
        if (tile.isLandmark) continue;
        const { cx, cy } = toScreenCenter(gx, gy);
        const hasTrail = Array.isArray(tile.pathConnections) && tile.pathConnections.length > 0;

        if (!hasTrail) {
          const t1x = (hashCoord(gx, gy, 111) > 0.5 ? 0.31 : -0.31) * tileSize;
          const t1y = (hashCoord(gx, gy, 112) - 0.5) * 0.34 * tileSize - 2;
          const sp1 = hashCoord(gx, gy, 113);
          if (isHighlandTile) {
            if (sp1 > 0.45) {
              drawRockOutcrop(ctx, cx + t1x, cy + t1y, treeScaleBase * (0.76 + sp1 * 0.16));
            } else {
              drawPineTree(ctx, cx + t1x, cy + t1y, treeScaleBase * (0.76 + sp1 * 0.16), 0.8);
            }
          } else if (isUndeadTile) {
            drawDeadBarrowTree(ctx, cx + t1x, cy + t1y, treeScaleBase * (0.78 + sp1 * 0.16), sp1);
          } else if (sp1 > 0.45) {
            drawPineTree(ctx, cx + t1x, cy + t1y, treeScaleBase * (0.76 + sp1 * 0.16), sp1);
          } else {
            drawDeciduousTree(ctx, cx + t1x, cy + t1y, treeScaleBase * (0.74 + sp1 * 0.16), sp1);
          }

          if (tile.visualType === 'DEEP_FOREST' || isUndeadTile || isHighlandTile || hashCoord(gx, gy, 114) > 0.35) {
            const t2x = -t1x * 0.85 + (hashCoord(gx, gy, 115) - 0.5) * 6;
            const t2y = (hashCoord(gx, gy, 116) - 0.5) * 0.36 * tileSize + 4;
            const sp2 = hashCoord(gx, gy, 117);
            if (isHighlandTile) {
              drawRockOutcrop(ctx, cx + t2x, cy + t2y, treeScaleBase * 0.68);
            } else if (isUndeadTile) {
              drawBarrowHeadstone(ctx, cx + t2x, cy + t2y, treeScaleBase * 0.78);
            } else if (sp2 > 0.5) {
              drawPineTree(ctx, cx + t2x, cy + t2y, treeScaleBase * 0.68, sp2);
            } else {
              drawDeciduousTree(ctx, cx + t2x, cy + t2y, treeScaleBase * 0.66, sp2);
            }
          }
        } else if (hashCoord(gx, gy, 118) > 0.48) {
          // Trailside margin prop on a non-connected flank
          const conns = tile.pathConnections;
          const sideX = !conns.includes('W') ? -0.37 : (!conns.includes('E') ? 0.37 : 0);
          const sideY = !conns.includes('N') ? -0.35 : (!conns.includes('S') ? 0.35 : 0);
          if (sideX !== 0 || sideY !== 0) {
            if (isHighlandTile) {
              drawRockOutcrop(ctx, cx + sideX * tileSize, cy + sideY * tileSize, treeScaleBase * 0.64);
            } else if (isUndeadTile) {
              drawBarrowHeadstone(ctx, cx + sideX * tileSize, cy + sideY * tileSize, treeScaleBase * 0.72);
            } else {
              drawBushClump(ctx, cx + sideX * tileSize, cy + sideY * tileSize, treeScaleBase * 0.68);
            }
          }
        }
        continue;
      }

      const { cx, cy } = toScreenCenter(gx, gy);
      if (tile && tile.visualKind === 'RIVER') {
        // Riverbank boulders & reeds
        if (hashCoord(gx, gy, 210) > 0.45) {
          drawRockOutcrop(ctx, cx - tileSize * 0.28, cy + tileSize * 0.15, treeScaleBase * 0.55);
        }
        continue;
      }

      if (tile && tile.visualKind === 'HIGHLAND_CHASM') {
        // Deep Shattered Gorge abyssal fissure
        ctx.fillStyle = '#04060a';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.rect(cx - tileSize * 0.46, cy - tileSize * 0.38, tileSize * 0.92, tileSize * 0.76);
        ctx.fill();
        ctx.stroke();
        continue;
      }

      if (tile && tile.visualKind === 'CITADEL_WALL') {
        // Iron-bound Basalt Rampart around Ravencrag Citadel
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.8;
        ctx.fillRect(cx - tileSize * 0.42, cy - tileSize * 0.26, tileSize * 0.84, tileSize * 0.52);
        ctx.strokeRect(cx - tileSize * 0.42, cy - tileSize * 0.26, tileSize * 0.84, tileSize * 0.52);
        continue;
      }

      if (tile && tile.visualKind === 'BLIGHT_POOL') {
        // Necrotic Blight Pool in Deadman's Mire
        ctx.fillStyle = 'rgba(20, 184, 166, 0.28)';
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.62)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, tileSize * 0.36, tileSize * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawDeadBarrowTree(ctx, cx - tileSize * 0.22, cy - tileSize * 0.14, treeScaleBase * 0.72, 0.8);
        continue;
      }

      if (tile && tile.visualKind === 'CRYPT_WALL') {
        // Obsidian Necropolis Wall around the Ancient Crypt
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.8;
        ctx.fillRect(cx - tileSize * 0.42, cy - tileSize * 0.26, tileSize * 0.84, tileSize * 0.52);
        ctx.strokeRect(cx - tileSize * 0.42, cy - tileSize * 0.26, tileSize * 0.84, tileSize * 0.52);
        continue;
      }

      if (tile && (tile.visualKind === 'MOUNTAIN_CRAG' || tile.visualType === 'ROCK_CRAG' || tile.visualKind === 'CLIFF_ROCK')) {
        drawRockOutcrop(ctx, cx - tileSize * 0.10, cy - tileSize * 0.06, treeScaleBase * 0.96);
        drawRockOutcrop(ctx, cx + tileSize * 0.16, cy + tileSize * 0.14, treeScaleBase * 0.68);
        if (isUndeadTile) {
          drawDeadBarrowTree(ctx, cx + tileSize * 0.20, cy - tileSize * 0.12, treeScaleBase * 0.72, 0.7);
        } else {
          drawPineTree(ctx, cx + tileSize * 0.20, cy - tileSize * 0.12, treeScaleBase * 0.72, 0.7);
        }
        continue;
      }

      if (tile && (tile.visualKind === 'STRONGHOLD_WALL' || tile.visualKind === 'TOWN_WALL')) {
        ctx.fillStyle = tile.visualKind === 'STRONGHOLD_WALL' ? '#3b2416' : '#4a3525';
        ctx.strokeStyle = '#1f140d';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - tileSize * 0.42, cy - tileSize * 0.24, tileSize * 0.84, tileSize * 0.48);
        ctx.strokeRect(cx - tileSize * 0.42, cy - tileSize * 0.24, tileSize * 0.84, tileSize * 0.48);
        continue;
      }

      // Impassable wilderness cluster
      const o1x = (hashCoord(gx, gy, 301) - 0.5) * tileSize * 0.36;
      const o1y = (hashCoord(gx, gy, 302) - 0.5) * tileSize * 0.32 - 3;
      const o2x = (hashCoord(gx, gy, 303) - 0.5) * tileSize * 0.42;
      const o2y = (hashCoord(gx, gy, 304) - 0.5) * tileSize * 0.32 + 5;
      const species1 = hashCoord(gx, gy, 305);
      const species2 = hashCoord(gx, gy, 306);

      if (isHighlandTile) {
        drawRockOutcrop(ctx, cx + o1x, cy + o1y, treeScaleBase * (0.92 + species1 * 0.18));
        if (species2 > 0.45) {
          drawRockOutcrop(ctx, cx + o2x, cy + o2y, treeScaleBase * (0.78 + species2 * 0.16));
        } else {
          drawPineTree(ctx, cx + o2x, cy + o2y, treeScaleBase * 0.78, 0.8);
        }
      } else if (isUndeadTile) {
        drawDeadBarrowTree(ctx, cx + o1x, cy + o1y, treeScaleBase * (0.86 + species1 * 0.18), species1);
        if (species2 > 0.45) {
          drawDeadBarrowTree(ctx, cx + o2x, cy + o2y, treeScaleBase * (0.76 + species2 * 0.16), species2);
        } else {
          drawBarrowHeadstone(ctx, cx + o2x, cy + o2y, treeScaleBase * 0.85);
        }
      } else {
        if (species1 > 0.45) {
          drawPineTree(ctx, cx + o1x, cy + o1y, treeScaleBase * (0.86 + species1 * 0.2), species1);
        } else {
          drawDeciduousTree(ctx, cx + o1x, cy + o1y, treeScaleBase * (0.84 + species1 * 0.2), species1);
        }

        if (species2 > 0.4) {
          drawPineTree(ctx, cx + o2x, cy + o2y, treeScaleBase * (0.78 + species2 * 0.18), species2);
        } else {
          drawDeciduousTree(ctx, cx + o2x, cy + o2y, treeScaleBase * (0.76 + species2 * 0.18), species2);
        }
      }
    }
  }

  // 6. Adjacent Reachable Tile Hints & Hover Highlight
  const heroTileX = state.currentTile ? Number(state.currentTile.x) : 15;
  const heroTileY = state.currentTile ? Number(state.currentTile.y) : 27;
  const isLocked = Boolean(state.encounter && (state.encounter.status === 'IN_COMBAT' || state.encounter.isAmbush));

  if (!isLocked) {
    const adjCoords = [
      { x: heroTileX, y: heroTileY - 1 },
      { x: heroTileX, y: heroTileY + 1 },
      { x: heroTileX - 1, y: heroTileY },
      { x: heroTileX + 1, y: heroTileY }
    ];
    for (const adj of adjCoords) {
      const t = tileByKey.get(`${adj.x},${adj.y}`);
      if (!t || !t.isPassable) continue;
      const { cx, cy } = toScreenCenter(adj.x, adj.y);
      const isHovered = Boolean(hoveredGridCoord && hoveredGridCoord.x === adj.x && hoveredGridCoord.y === adj.y);

      ctx.save();
      ctx.strokeStyle = isHovered ? 'rgba(250, 204, 21, 0.88)' : 'rgba(197, 160, 89, 0.24)';
      ctx.fillStyle = isHovered ? 'rgba(250, 204, 21, 0.14)' : 'rgba(197, 160, 89, 0.04)';
      ctx.lineWidth = isHovered ? 2.2 : 1.1;
      const box = tileSize * 0.72;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cx - box / 2, cy - box / 2, box, box, 8);
      } else {
        ctx.rect(cx - box / 2, cy - box / 2, box, box);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 7. Discovery & Light Fog of War Layer
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      const { cx, cy } = toScreenCenter(gx, gy);
      const x0 = cx - tileSize / 2;
      const y0 = cy - tileSize / 2;

      const isDiscovered = tile ? Boolean(tile.isDiscovered) : false;
      const isVisibleNow = tile ? Boolean(tile.isVisibleNow) : false;

      if (!isDiscovered) {
        // Unexplored Fog of War shroud
        ctx.fillStyle = 'rgba(5, 8, 7, 0.84)';
        ctx.fillRect(x0 - 0.5, y0 - 0.5, tileSize + 1, tileSize + 1);
      } else if (!isVisibleNow) {
        // Explored memory outside active vision radius
        ctx.fillStyle = 'rgba(6, 10, 9, 0.36)';
        ctx.fillRect(x0 - 0.5, y0 - 0.5, tileSize + 1, tileSize + 1);
      }
    }
  }

  // 8. Hero Marker (Centered in Camera Viewport)
  const { cx: heroCx, cy: heroCy } = toScreenCenter(focusX, focusY);
  drawHeroToken(ctx, heroCx, heroCy, tileSize, state);

  // 9. Clean Landmark Labels (Only discovered landmarks within view or hovered — zero label clutter)
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !tile.isLandmark || !tile.isDiscovered) continue;

      const isMajorLandmark = [
        'OAKHAVEN',
        'OAKHAVEN_CITY',
        'GOBLIN_STRONGHOLD',
        'GOBLIN_CAVE',
        'ANCIENT_CRYPT',
        'RAVENCRAG_CITADEL',
        'ANCIENT_BLACK_OAK',
        'OLD_STONE_BRIDGE',
        'ABANDONED_WATCHPOST',
        'BROKEN_SHRINE',
        'GOBLIN_HUNTING_GROUNDS',
        'OLD_LOG_CROSSING',
        'SOUTHERN_CROSSROADS',
        'BLACKWOOD_CROSSROADS',
        'GALLOWS_CROSSROADS',
        'DROWNED_OSSUARY',
        'WEEPING_CAIRN',
        'BLIGHTED_CHAPEL',
        'CRYPT_APPROACH',
        'WINDSCAR_GATE',
        'HIGHLAND_PINE_TOR',
        'GIANTS_SPAN_BRIDGE',
        'CYCLOPS_WATCHTOWER',
        'STORMPEAK_CAIRN',
        'CITADEL_APPROACH'
      ].includes(tile.landmarkKey);
      const isHeroHere = (gx === heroTileX && gy === heroTileY);
      const isHovered = Boolean(hoveredGridCoord && hoveredGridCoord.x === gx && hoveredGridCoord.y === gy);

      if (!isMajorLandmark && !isHeroHere && !isHovered) continue;

      const { cx, cy } = toScreenCenter(gx, gy);
      let borderCol = '#c5a059';
      let textCol = '#e2e8f0';
      if (tile.landmarkKey === 'GOBLIN_STRONGHOLD') {
        borderCol = mapData.bossSlain ? '#4ade80' : '#f87171';
        textCol = mapData.bossSlain ? '#86efac' : '#fca5a5';
      } else if (tile.landmarkKey === 'RAVENCRAG_CITADEL') {
        borderCol = mapData.highlandBossSlain ? '#4ade80' : '#f97316';
        textCol = mapData.highlandBossSlain ? '#86efac' : '#fdba74';
      } else if (tile.landmarkKey === 'OAKHAVEN' || tile.landmarkKey === 'OAKHAVEN_CITY') {
        borderCol = '#fde047';
        textCol = '#fef08a';
      } else if (tile.landmarkKey === 'GOBLIN_CAVE') {
        borderCol = '#f59e0b';
        textCol = '#fcd34d';
      } else if (tile.landmarkKey === 'ANCIENT_CRYPT') {
        borderCol = '#34d399';
        textCol = '#6ee7b7';
      } else if (tile.isRavencragHighlands || tile.regionKey === 'RAVENCRAG_HIGHLANDS') {
        borderCol = '#fb923c';
        textCol = '#fed7aa';
      } else if (tile.isUndeadLands || tile.regionKey === 'UNDEAD_LANDS') {
        borderCol = '#a78bfa';
        textCol = '#ddd6fe';
      }

      drawMapLabel(ctx, cx, cy - tileSize * 0.42, tile.name, textCol, borderCol);
    }
  }

  // 10. Soft Edge Vignette around Camera Viewport
  const edgeGrad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.34,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72
  );
  edgeGrad.addColorStop(0, 'rgba(5, 8, 7, 0)');
  edgeGrad.addColorStop(1, 'rgba(4, 6, 5, 0.65)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function drawHeroToken(ctx, cx, cy, tileSize, state) {
  const r = Math.max(13, Math.min(20, tileSize * 0.28));
  const hero = state.character || {};
  const enc = state.encounter;

  ctx.save();

  // Warm lantern / scouting aura around hero
  const auraGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, tileSize * 1.45);
  if (enc && enc.status === 'DISCOVERED') {
    auraGrad.addColorStop(0, 'rgba(245, 158, 11, 0.38)');
    auraGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  } else {
    auraGrad.addColorStop(0, 'rgba(250, 204, 21, 0.26)');
    auraGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
  }
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * 1.45, 0, Math.PI * 2);
  ctx.fill();

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.72, r * 0.9, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Token medallion
  ctx.fillStyle = '#172130';
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hero silhouette (hooded cloak & shoulders)
  const cloakColor = hero.class === 'RANGER'
    ? '#22c55e'
    : (hero.class === 'CLERIC' ? '#60a5fa' : '#f59e0b');
  ctx.fillStyle = cloakColor;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.32, r * 0.56, Math.PI, 0);
  ctx.fill();

  // Hero head
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.2, r * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // Stage 1 threat indicator badge above hero
  if (enc && enc.status === 'DISCOVERED') {
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + r * 0.78, cy - r * 0.78, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cx + r * 0.78, cy - r * 0.78);
  }

  ctx.restore();
}

function drawMapLabel(ctx, cx, cy, text, textColor, borderColor) {
  if (!text) return;
  ctx.save();
  ctx.font = '700 11px Georgia, serif';
  const metrics = ctx.measureText(text);
  const padX = 8;
  const boxW = Math.ceil(metrics.width) + padX * 2;
  const boxH = 19;
  const bx = Math.round(cx - boxW / 2);
  const by = Math.round(cy - boxH / 2);

  // Subtle dark drop-shadow for crisp readability over dungeon stone & torchlight
  ctx.fillStyle = 'rgba(2, 3, 6, 0.55)';
  ctx.fillRect(bx + 1, by + 2, boxW, boxH);

  ctx.fillStyle = 'rgba(7, 10, 15, 0.92)';
  ctx.strokeStyle = borderColor || 'rgba(197, 160, 89, 0.72)';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1, 4);
  } else {
    ctx.rect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor || '#fde68a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, Math.round(bx + boxW / 2), Math.round(by + boxH / 2));
  ctx.restore();
}

/**
 * Renders the 44×30 Three-Region Map Overview Canvas inside the Map [M] modal.
 * Respects discovery state: shows discovered paths, discovered landmarks, Oakhaven,
 * current hero position, and major landmarks (only if discovered).
 * Uses integer cell sizing and DPR snapping so the overview is razor-sharp.
 */
export function renderRegionMapCanvas(canvas, state) {
  if (!canvas || !state || !state.topdownMap) return;
  const rCtx = canvas.getContext('2d');
  const mapData = state.topdownMap;
  const tiles = mapData.tiles || [];

  const minX = mapData.minX ?? 0;
  const maxX = mapData.maxX ?? 43;
  const minY = mapData.minY ?? 0;
  const maxY = mapData.maxY ?? 29;
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const cellPx = 13;
  const padX = 14;
  const padTop = 26;
  const padBottom = 14;
  const w = cols * cellPx + padX * 2;
  const h = rows * cellPx + padTop + padBottom;

  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  rCtx.save();
  rCtx.scale(dpr, dpr);

  // Dark slate & parchment frame
  rCtx.fillStyle = mapData.isDungeon ? '#050508' : '#090d12';
  rCtx.fillRect(0, 0, w, h);

  if (mapData.isDungeon) {
    const isCrypt = mapData.dungeonKey === 'ANCIENT_CRYPT';
    rCtx.font = '700 11px Georgia, serif';
    rCtx.textBaseline = 'middle';
    rCtx.textAlign = 'center';
    rCtx.fillStyle = isCrypt ? '#6ee7b7' : '#fde68a';
    rCtx.fillText(
      String(mapData.dungeonName || (isCrypt ? 'THE ANCIENT CRYPT' : 'THE GOBLIN CAVE')).toUpperCase(),
      Math.round(w / 2),
      13
    );

    rCtx.strokeStyle = isCrypt ? 'rgba(52, 211, 153, 0.45)' : 'rgba(245, 158, 11, 0.45)';
    rCtx.lineWidth = 1.5;
    rCtx.strokeRect(padX - 2, padTop - 2, cols * cellPx + 4, rows * cellPx + 4);

    const tileByKey = new Map();
    for (const t of tiles) {
      tileByKey.set(`${t.x},${t.y}`, t);
    }

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const t = tileByKey.get(`${gx},${gy}`);
        const x0 = padX + (gx - minX) * cellPx;
        const y0 = padTop + (gy - minY) * cellPx;

        if (!t || !t.isDiscovered || t.fogState === 'UNEXPLORED') {
          rCtx.fillStyle = '#050508';
          rCtx.fillRect(x0, y0, cellPx, cellPx);
          continue;
        }

        if (!t.isPassable) {
          rCtx.fillStyle = isCrypt ? '#1e293b' : '#29221b';
        } else if (t.roomType === 'BOSS' || t.hasBoss) {
          rCtx.fillStyle = mapData.bossSlain ? '#166534' : (isCrypt ? '#0f766e' : '#7f1d1d');
        } else if (t.roomType === 'EXIT_STAIRS' || t.feature === 'DUNGEON_EXIT') {
          rCtx.fillStyle = '#ca8a04';
        } else if (t.roomType === 'TREASURE' || t.hasTreasure) {
          rCtx.fillStyle = (t.eventResolved || t.treasureLooted) ? '#334155' : '#b45309';
        } else {
          rCtx.fillStyle = isCrypt ? '#334155' : '#44382c';
        }
        rCtx.fillRect(x0, y0, cellPx - 1, cellPx - 1);
      }
    }

    const hX = typeof mapData.heroX === 'number' ? mapData.heroX : 3;
    const hY = typeof mapData.heroY === 'number' ? mapData.heroY : 16;
    const hCx = padX + (hX - minX + 0.5) * cellPx;
    const hCy = padTop + (hY - minY + 0.5) * cellPx;
    rCtx.fillStyle = '#38bdf8';
    rCtx.strokeStyle = '#ffffff';
    rCtx.lineWidth = 2;
    rCtx.beginPath();
    rCtx.arc(hCx, hCy, 4.5, 0, Math.PI * 2);
    rCtx.fill();
    rCtx.stroke();
    rCtx.restore();
    return;
  }

  // Region Header Labels along top border
  rCtx.font = '700 10px Georgia, serif';
  rCtx.textBaseline = 'middle';
  rCtx.textAlign = 'center';
  rCtx.fillStyle = '#86efac';
  rCtx.fillText('GOBLIN FOREST (WEST)', padX + 10.5 * cellPx, 13);
  rCtx.fillStyle = '#c4b5fd';
  rCtx.fillText('UNDEAD LANDS', padX + 25.5 * cellPx, 13);
  rCtx.fillStyle = '#fdba74';
  rCtx.fillText('RAVENCRAG HIGHLANDS (EAST)', padX + 37 * cellPx, 13);

  rCtx.strokeStyle = 'rgba(197, 160, 89, 0.45)';
  rCtx.lineWidth = 1.5;
  rCtx.strokeRect(padX - 2, padTop - 2, cols * cellPx + 4, rows * cellPx + 4);

  const tileByKey = new Map();
  for (const t of tiles) {
    tileByKey.set(`${t.x},${t.y}`, t);
  }

  // Draw tiles
  for (let gy = minY; gy <= maxY; gy++) {
    for (let gx = minX; gx <= maxX; gx++) {
      const t = tileByKey.get(`${gx},${gy}`);
      const x0 = padX + (gx - minX) * cellPx;
      const y0 = padTop + (gy - minY) * cellPx;

      if (!t || !t.isDiscovered) {
        rCtx.fillStyle = '#070a0e';
        rCtx.fillRect(x0, y0, cellPx, cellPx);
        continue;
      }

      const isUndead = Boolean(t.isUndeadLands || t.regionKey === 'UNDEAD_LANDS');
      const isHighland = Boolean(t.isRavencragHighlands || t.regionKey === 'RAVENCRAG_HIGHLANDS');

      if (!t.isPassable) {
        if (t.visualKind === 'RIVER') {
          rCtx.fillStyle = '#154257';
        } else if (t.visualKind === 'BLIGHT_POOL') {
          rCtx.fillStyle = '#11423e';
        } else if (t.visualKind === 'CRYPT_WALL') {
          rCtx.fillStyle = '#1e293b';
        } else if (t.visualKind === 'HIGHLAND_CHASM') {
          rCtx.fillStyle = '#05080f';
        } else if (t.visualKind === 'CITADEL_WALL') {
          rCtx.fillStyle = '#334155';
        } else if (isHighland) {
          rCtx.fillStyle = '#1a202c';
        } else if (isUndead) {
          rCtx.fillStyle = '#151c28';
        } else if (t.visualKind === 'CLIFF_ROCK') {
          rCtx.fillStyle = '#262d36';
        } else {
          rCtx.fillStyle = '#101d15';
        }
      } else if (t.biome === 'SANCTUARY') {
        rCtx.fillStyle = '#3b331e';
      } else if (t.biome === 'STRONGHOLD') {
        rCtx.fillStyle = '#3b1d1d';
      } else if (isHighland) {
        rCtx.fillStyle = (t.visualType === 'TRAIL' || (t.pathConnections && t.pathConnections.length > 0))
          ? '#4a3f31'
          : (t.biome === 'STORMPEAK_CRAGS' ? '#283140' : '#232933');
      } else if (isUndead) {
        rCtx.fillStyle = (t.visualType === 'TRAIL' || (t.pathConnections && t.pathConnections.length > 0))
          ? '#334155'
          : '#1e293b';
      } else if (t.visualType === 'TRAIL' || (t.pathConnections && t.pathConnections.length > 0)) {
        rCtx.fillStyle = '#4a3a28';
      } else {
        rCtx.fillStyle = '#1b2e21';
      }

      rCtx.fillRect(x0, y0, cellPx - 1, cellPx - 1);
    }
  }

  // Subtle region border dividers (x=21 and x=30)
  rCtx.save();
  rCtx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  rCtx.setLineDash([3, 3]);
  rCtx.lineWidth = 1;
  rCtx.beginPath();
  rCtx.moveTo(padX + 21 * cellPx, padTop);
  rCtx.lineTo(padX + 21 * cellPx, padTop + rows * cellPx);
  rCtx.moveTo(padX + 30 * cellPx, padTop);
  rCtx.lineTo(padX + 30 * cellPx, padTop + rows * cellPx);
  rCtx.stroke();
  rCtx.restore();

  // Draw discovered Goblin Forest trail connections
  const dirDeltas = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  rCtx.strokeStyle = '#a38252';
  rCtx.lineWidth = 2.5;
  rCtx.lineCap = 'round';
  rCtx.beginPath();
  for (const t of tiles) {
    if (!t.isDiscovered || !Array.isArray(t.pathConnections) || t.pathConnections.length === 0) continue;
    if (t.isUndeadLands || t.regionKey === 'UNDEAD_LANDS' || t.isRavencragHighlands || t.regionKey === 'RAVENCRAG_HIGHLANDS') continue;
    const cx = padX + (t.x - minX + 0.5) * cellPx;
    const cy = padTop + (t.y - minY + 0.5) * cellPx;
    for (const dir of t.pathConnections) {
      const d = dirDeltas[dir];
      if (!d) continue;
      rCtx.moveTo(cx, cy);
      rCtx.lineTo(cx + d[0] * (cellPx * 0.5), cy + d[1] * (cellPx * 0.5));
    }
  }
  rCtx.stroke();

  // Draw discovered Undead Lands Sepulcher Road connections
  rCtx.strokeStyle = '#94a3b8';
  rCtx.lineWidth = 2.5;
  rCtx.lineCap = 'round';
  rCtx.beginPath();
  for (const t of tiles) {
    if (!t.isDiscovered || !Array.isArray(t.pathConnections) || t.pathConnections.length === 0) continue;
    if (!(t.isUndeadLands || t.regionKey === 'UNDEAD_LANDS')) continue;
    const cx = padX + (t.x - minX + 0.5) * cellPx;
    const cy = padTop + (t.y - minY + 0.5) * cellPx;
    for (const dir of t.pathConnections) {
      const d = dirDeltas[dir];
      if (!d) continue;
      rCtx.moveTo(cx, cy);
      rCtx.lineTo(cx + d[0] * (cellPx * 0.5), cy + d[1] * (cellPx * 0.5));
    }
  }
  rCtx.stroke();

  // Draw discovered Ravencrag Highlands Mountain Trail connections
  rCtx.strokeStyle = '#fb923c';
  rCtx.lineWidth = 2.5;
  rCtx.lineCap = 'round';
  rCtx.beginPath();
  for (const t of tiles) {
    if (!t.isDiscovered || !Array.isArray(t.pathConnections) || t.pathConnections.length === 0) continue;
    if (!(t.isRavencragHighlands || t.regionKey === 'RAVENCRAG_HIGHLANDS')) continue;
    const cx = padX + (t.x - minX + 0.5) * cellPx;
    const cy = padTop + (t.y - minY + 0.5) * cellPx;
    for (const dir of t.pathConnections) {
      const d = dirDeltas[dir];
      if (!d) continue;
      rCtx.moveTo(cx, cy);
      rCtx.lineTo(cx + d[0] * (cellPx * 0.5), cy + d[1] * (cellPx * 0.5));
    }
  }
  rCtx.stroke();

  // Draw discovered landmarks (strictly hidden if !t.isDiscovered, except Oakhaven home sanctuary)
  for (const t of tiles) {
    if (!t.isLandmark) continue;
    if (!t.isDiscovered && t.landmarkKey !== 'OAKHAVEN' && t.landmarkKey !== 'OAKHAVEN_CITY') continue;

    const cx = padX + (t.x - minX + 0.5) * cellPx;
    const cy = padTop + (t.y - minY + 0.5) * cellPx;

    const isCity = t.landmarkKey === 'OAKHAVEN' || t.landmarkKey === 'OAKHAVEN_CITY';
    const isMajor =
      isCity ||
      t.landmarkKey === 'GOBLIN_STRONGHOLD' ||
      t.landmarkKey === 'GOBLIN_CAVE' ||
      t.landmarkKey === 'ANCIENT_CRYPT' ||
      t.landmarkKey === 'RAVENCRAG_CITADEL';
    if (t.landmarkKey === 'GOBLIN_STRONGHOLD') {
      rCtx.fillStyle = mapData.bossSlain ? '#4ade80' : '#ef4444';
    } else if (t.landmarkKey === 'RAVENCRAG_CITADEL') {
      rCtx.fillStyle = mapData.highlandBossSlain ? '#4ade80' : '#f97316';
    } else if (t.landmarkKey === 'ANCIENT_CRYPT') {
      rCtx.fillStyle = '#34d399';
    } else if (t.landmarkKey === 'GOBLIN_CAVE') {
      rCtx.fillStyle = '#f59e0b';
    } else if (isCity) {
      rCtx.fillStyle = '#facc15';
    } else if (t.isRavencragHighlands || t.regionKey === 'RAVENCRAG_HIGHLANDS') {
      rCtx.fillStyle = '#fdba74';
    } else if (t.isUndeadLands || t.regionKey === 'UNDEAD_LANDS') {
      rCtx.fillStyle = '#c4b5fd';
    } else {
      rCtx.fillStyle = '#fde68a';
    }
    rCtx.strokeStyle = '#090d12';
    rCtx.lineWidth = 1.5;
    rCtx.beginPath();
    rCtx.arc(cx, cy, isMajor ? 4.8 : 3.4, 0, Math.PI * 2);
    rCtx.fill();
    rCtx.stroke();
  }

  // Draw current hero overworld position
  const heroX = state.currentTile && typeof state.currentTile.overworld_x === 'number'
    ? Number(state.currentTile.overworld_x)
    : ((mapData.heroCoord && typeof mapData.heroCoord.x === 'number') ? mapData.heroCoord.x : (state.currentTile ? Number(state.currentTile.x) : 15));
  const heroY = state.currentTile && typeof state.currentTile.overworld_y === 'number'
    ? Number(state.currentTile.overworld_y)
    : ((mapData.heroCoord && typeof mapData.heroCoord.y === 'number') ? mapData.heroCoord.y : (state.currentTile ? Number(state.currentTile.y) : 27));
  const hCx = padX + (heroX - minX + 0.5) * cellPx;
  const hCy = padTop + (heroY - minY + 0.5) * cellPx;

  rCtx.fillStyle = 'rgba(250, 204, 21, 0.35)';
  rCtx.beginPath();
  rCtx.arc(hCx, hCy, 8.5, 0, Math.PI * 2);
  rCtx.fill();

  rCtx.fillStyle = '#38bdf8';
  rCtx.strokeStyle = '#ffffff';
  rCtx.lineWidth = 2;
  rCtx.beginPath();
  rCtx.arc(hCx, hCy, 4.6, 0, Math.PI * 2);
  rCtx.fill();
  rCtx.stroke();

  rCtx.restore();
}
