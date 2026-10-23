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

  const fx = typeof focusX === 'number' ? focusX : ((mapData.heroCoord && mapData.heroCoord.x) ?? 15);
  const fy = typeof focusY === 'number' ? focusY : ((mapData.heroCoord && mapData.heroCoord.y) ?? 27);

  const heroWorldPxX = (fx - minX + 0.5) * tileSize;
  const heroWorldPxY = (fy - minY + 0.5) * tileSize;

  const idealCamPxX = heroWorldPxX - cssWidth / 2;
  const idealCamPxY = heroWorldPxY - cssHeight / 2;

  const maxCamPxX = Math.max(0, worldPixelW - cssWidth);
  const maxCamPxY = Math.max(0, worldPixelH - cssHeight);

  const camPxX = worldPixelW <= cssWidth
    ? Math.floor((worldPixelW - cssWidth) / 2)
    : Math.max(0, Math.min(maxCamPxX, idealCamPxX));
  const camPxY = worldPixelH <= cssHeight
    ? Math.floor((worldPixelH - cssHeight) / 2)
    : Math.max(0, Math.min(maxCamPxY, idealCamPxY));

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
  if (!store.currentState || !store.currentState.topdownMap) return;
  const coord = clientPointToGridCoord(e.clientX, e.clientY);
  const prev = hoveredGridCoord;
  const changed = (!prev && coord) || (prev && !coord) || (prev && coord && (prev.x !== coord.x || prev.y !== coord.y));
  hoveredGridCoord = coord;

  if (coord && canvasEl) {
    const state = store.currentState;
    const heroX = state.currentTile ? Number(state.currentTile.x) : 15;
    const heroY = state.currentTile ? Number(state.currentTile.y) : 27;
    const dist = Math.abs(coord.x - heroX) + Math.abs(coord.y - heroY);
    const tile = (state.topdownMap.tiles || []).find(t => t.x === coord.x && t.y === coord.y);
    const isLocked = Boolean(state.encounter && (state.encounter.status === 'IN_COMBAT' || state.encounter.isAmbush));
    if (dist === 1 && tile && tile.isPassable && !isLocked) {
      canvasEl.style.cursor = 'pointer';
    } else if (dist === 0 && (state.isSafeCity || (state.viewportScene && state.viewportScene.pointOfInterest))) {
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
  if (!store.currentState || !store.currentState.topdownMap) return;
  const state = store.currentState;
  if (state.mode === 'FALLEN') return;
  const isLocked = Boolean(state.encounter && (state.encounter.status === 'IN_COMBAT' || state.encounter.isAmbush));
  if (isLocked) return;

  const coord = clientPointToGridCoord(e.clientX, e.clientY);
  if (!coord) return;

  const heroX = state.currentTile ? Number(state.currentTile.x) : 15;
  const heroY = state.currentTile ? Number(state.currentTile.y) : 27;
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
    const sh = state.topdownMap.strongholdCoord || { x: 15, y: 2 };
    if (heroX === sh.x && heroY === sh.y && !state.topdownMap.bossSlain && !state.encounter) {
      dispatchAction('CHALLENGE_STRONGHOLD_BOSS');
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
  if (!store.currentState || !store.currentState.topdownMap) return;

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
  if (!canvasEl || !state || !state.topdownMap) return;
  const stageEl = document.getElementById('topdown-map-stage');
  const isLandmarkSceneActive = Boolean(state.landmarkScene && state.landmarkScene.isActive && !state.encounter);
  if (stageEl) {
    stageEl.hidden = isLandmarkSceneActive;
    stageEl.style.display = isLandmarkSceneActive ? 'none' : '';
  }
  if (isLandmarkSceneActive) return;

  const targetX = state.currentTile ? Number(state.currentTile.x) : 15;
  const targetY = state.currentTile ? Number(state.currentTile.y) : 27;

  if (heroVisualX === null || heroVisualY === null) {
    heroVisualX = targetX;
    heroVisualY = targetY;
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
  }

  ctx.restore();
}

export function drawTopdownWorld(state) {
  if (!canvasEl || !ctx || !state || !state.topdownMap) return;

  const mapData = state.topdownMap;
  const tiles = mapData.tiles || [];
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

      if (!tile || !tile.isPassable) {
        if (tile && tile.visualKind === 'RIVER') {
          ctx.fillStyle = '#0b181c';
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
        } else if (tile.visualType === 'TRAIL' || (tile.pathConnections && tile.pathConnections.length > 0)) {
          ctx.fillStyle = n > 0.5 ? '#182419' : '#1a271b';
        } else {
          ctx.fillStyle = n > 0.5 ? '#121d15' : '#152118';
        }
        ctx.fillRect(x0 - 0.5, y0 - 0.5, tileSize + 1, tileSize + 1);

        // Organic woodland floor moss & grass patches
        const patchR = tileSize * (0.28 + n * 0.16);
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, patchR);
        grad.addColorStop(0, 'rgba(42, 68, 44, 0.32)');
        grad.addColorStop(1, 'rgba(20, 33, 23, 0)');
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

  // 3. Data-Driven Winding Forest Trails (drawn from tile.pathConnections + main route spines)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const dirDeltas = {
    N: [0, -1],
    S: [0, 1],
    E: [1, 0],
    W: [-1, 0]
  };

  // Outer worn trail edge
  ctx.strokeStyle = 'rgba(62, 46, 30, 0.72)';
  ctx.lineWidth = Math.max(14, tileSize * 0.36);
  ctx.beginPath();
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !Array.isArray(tile.pathConnections) || tile.pathConnections.length === 0) continue;
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

  // Inner warm dirt path
  ctx.strokeStyle = 'rgba(104, 79, 51, 0.78)';
  ctx.lineWidth = Math.max(8, tileSize * 0.21);
  ctx.beginPath();
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (!tile || !Array.isArray(tile.pathConnections) || tile.pathConnections.length === 0) continue;
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

      // Small pebbles, tufts & border bushes on passable wilderness tiles
      if (!tile.isLandmark) {
        for (let i = 0; i < 3; i++) {
          const r1 = hashCoord(gx, gy, 20 + i);
          const r2 = hashCoord(gx, gy, 40 + i);
          const px = cx + (r1 - 0.5) * tileSize * 0.65;
          const py = cy + (r2 - 0.5) * tileSize * 0.65;
          ctx.fillStyle = i === 0 ? 'rgba(148, 163, 184, 0.16)' : 'rgba(54, 83, 58, 0.34)';
          ctx.beginPath();
          ctx.arc(px, py, 1.5 + (r1 * 1.4), 0, Math.PI * 2);
          ctx.fill();
        }
        const isOffTrailForest = !tile.pathConnections || tile.pathConnections.length === 0;
        if (isOffTrailForest && hashCoord(gx, gy, 88) > 0.32) {
          const bx = cx + (hashCoord(gx, gy, 89) - 0.5) * tileSize * 0.58;
          const by = cy + (hashCoord(gx, gy, 90) - 0.5) * tileSize * 0.58;
          drawBushClump(ctx, bx, by, (tileSize / 68) * 0.76);
        }
      }

      if (tile.isLandmark && tile.landmarkKey) {
        drawLandmarkStructure(ctx, cx, cy, tileSize, tile.landmarkKey, mapData.bossSlain);
      }
    }
  }

  // 5. Dense Forest Canopy & Rocky Crags (sorted top-to-bottom for natural 2.5D overlap)
  const treeScaleBase = Math.max(0.55, Math.min(1.18, tileSize / 68));
  for (let gy = startRow; gy <= endRow; gy++) {
    for (let gx = startCol; gx <= endCol; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      if (tile && tile.isPassable) {
        if (tile.isLandmark) continue;
        const { cx, cy } = toScreenCenter(gx, gy);
        const hasTrail = Array.isArray(tile.pathConnections) && tile.pathConnections.length > 0;

        if (!hasTrail) {
          // Off-trail passable woodland: draw 1-2 trees framing the tile corners so the forest feels lush and cohesive
          const t1x = (hashCoord(gx, gy, 111) > 0.5 ? 0.31 : -0.31) * tileSize;
          const t1y = (hashCoord(gx, gy, 112) - 0.5) * 0.34 * tileSize - 2;
          const sp1 = hashCoord(gx, gy, 113);
          if (sp1 > 0.45) {
            drawPineTree(ctx, cx + t1x, cy + t1y, treeScaleBase * (0.76 + sp1 * 0.16), sp1);
          } else {
            drawDeciduousTree(ctx, cx + t1x, cy + t1y, treeScaleBase * (0.74 + sp1 * 0.16), sp1);
          }

          if (tile.visualType === 'DEEP_FOREST' || hashCoord(gx, gy, 114) > 0.35) {
            const t2x = -t1x * 0.85 + (hashCoord(gx, gy, 115) - 0.5) * 6;
            const t2y = (hashCoord(gx, gy, 116) - 0.5) * 0.36 * tileSize + 4;
            const sp2 = hashCoord(gx, gy, 117);
            if (sp2 > 0.5) {
              drawPineTree(ctx, cx + t2x, cy + t2y, treeScaleBase * 0.68, sp2);
            } else {
              drawDeciduousTree(ctx, cx + t2x, cy + t2y, treeScaleBase * 0.66, sp2);
            }
          }
        } else if (hashCoord(gx, gy, 118) > 0.48) {
          // Trailside margin bush or sapling on a non-connected flank
          const conns = tile.pathConnections;
          const sideX = !conns.includes('W') ? -0.37 : (!conns.includes('E') ? 0.37 : 0);
          const sideY = !conns.includes('N') ? -0.35 : (!conns.includes('S') ? 0.35 : 0);
          if (sideX !== 0 || sideY !== 0) {
            drawBushClump(ctx, cx + sideX * tileSize, cy + sideY * tileSize, treeScaleBase * 0.68);
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

      if (tile && (tile.visualKind === 'MOUNTAIN_CRAG' || tile.visualType === 'ROCK_CRAG' || tile.visualKind === 'CLIFF_ROCK')) {
        drawRockOutcrop(ctx, cx - tileSize * 0.10, cy - tileSize * 0.06, treeScaleBase * 0.96);
        drawRockOutcrop(ctx, cx + tileSize * 0.16, cy + tileSize * 0.14, treeScaleBase * 0.68);
        drawPineTree(ctx, cx + tileSize * 0.20, cy - tileSize * 0.12, treeScaleBase * 0.72, 0.7);
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

      // Multi-species dense forest cluster (2 trees per impassable forest tile)
      const o1x = (hashCoord(gx, gy, 301) - 0.5) * tileSize * 0.36;
      const o1y = (hashCoord(gx, gy, 302) - 0.5) * tileSize * 0.32 - 3;
      const o2x = (hashCoord(gx, gy, 303) - 0.5) * tileSize * 0.42;
      const o2y = (hashCoord(gx, gy, 304) - 0.5) * tileSize * 0.32 + 5;
      const species1 = hashCoord(gx, gy, 305);
      const species2 = hashCoord(gx, gy, 306);

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
        'ANCIENT_BLACK_OAK',
        'OLD_STONE_BRIDGE',
        'ABANDONED_WATCHPOST',
        'BROKEN_SHRINE',
        'GOBLIN_HUNTING_GROUNDS',
        'OLD_LOG_CROSSING',
        'SOUTHERN_CROSSROADS',
        'BLACKWOOD_CROSSROADS'
      ].includes(tile.landmarkKey);
      const isHeroHere = (gx === heroTileX && gy === heroTileY);
      const isHovered = Boolean(hoveredGridCoord && hoveredGridCoord.x === gx && hoveredGridCoord.y === gy);

      if (!isMajorLandmark && !isHeroHere && !isHovered) continue;

      const { cx, cy } = toScreenCenter(gx, gy);
      const borderCol = tile.landmarkKey === 'GOBLIN_STRONGHOLD'
        ? (mapData.bossSlain ? '#4ade80' : '#f87171')
        : (tile.landmarkKey === 'OAKHAVEN' || tile.landmarkKey === 'OAKHAVEN_CITY' ? '#fde047' : '#c5a059');
      const textCol = tile.landmarkKey === 'GOBLIN_STRONGHOLD'
        ? (mapData.bossSlain ? '#86efac' : '#fca5a5')
        : (tile.landmarkKey === 'OAKHAVEN' || tile.landmarkKey === 'OAKHAVEN_CITY' ? '#fef08a' : '#e2e8f0');

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
  ctx.save();
  ctx.font = '700 11px Georgia, serif';
  const metrics = ctx.measureText(text);
  const padX = 7;
  const boxW = metrics.width + padX * 2;
  const boxH = 18;

  ctx.fillStyle = 'rgba(8, 12, 16, 0.88)';
  ctx.strokeStyle = borderColor || 'rgba(197, 160, 89, 0.65)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 4);
  } else {
    ctx.rect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor || '#fde68a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}

/**
 * Renders the 30×30 Region Map Overview Canvas inside the Map [M] modal.
 * Respects discovery state: shows discovered paths, discovered landmarks, Oakhaven,
 * current hero position, and Goblin Stronghold (only if discovered).
 */
export function renderRegionMapCanvas(canvas, state) {
  if (!canvas || !state || !state.topdownMap) return;
  const rCtx = canvas.getContext('2d');
  const mapData = state.topdownMap;
  const tiles = mapData.tiles || [];

  const minX = mapData.minX ?? 0;
  const maxX = mapData.maxX ?? 29;
  const minY = mapData.minY ?? 0;
  const maxY = mapData.maxY ?? 29;
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const cellPx = 15;
  const pad = 16;
  const w = cols * cellPx + pad * 2;
  const h = rows * cellPx + pad * 2;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  rCtx.save();
  rCtx.scale(dpr, dpr);

  // Dark slate & parchment frame
  rCtx.fillStyle = '#090d12';
  rCtx.fillRect(0, 0, w, h);

  rCtx.strokeStyle = 'rgba(197, 160, 89, 0.45)';
  rCtx.lineWidth = 1.5;
  rCtx.strokeRect(pad - 2, pad - 2, cols * cellPx + 4, rows * cellPx + 4);

  const tileByKey = new Map();
  for (const t of tiles) {
    tileByKey.set(`${t.x},${t.y}`, t);
  }

  // Draw tiles
  for (let gy = minY; gy <= maxY; gy++) {
    for (let gx = minX; gx <= maxX; gx++) {
      const t = tileByKey.get(`${gx},${gy}`);
      const x0 = pad + (gx - minX) * cellPx;
      const y0 = pad + (gy - minY) * cellPx;

      if (!t || !t.isDiscovered) {
        rCtx.fillStyle = '#070a0e';
        rCtx.fillRect(x0, y0, cellPx, cellPx);
        continue;
      }

      if (!t.isPassable) {
        if (t.visualKind === 'RIVER') {
          rCtx.fillStyle = '#154257';
        } else if (t.visualKind === 'CLIFF_ROCK') {
          rCtx.fillStyle = '#262d36';
        } else {
          rCtx.fillStyle = '#101d15';
        }
      } else if (t.biome === 'SANCTUARY') {
        rCtx.fillStyle = '#3b331e';
      } else if (t.biome === 'STRONGHOLD') {
        rCtx.fillStyle = '#3b1d1d';
      } else if (t.visualType === 'TRAIL' || (t.pathConnections && t.pathConnections.length > 0)) {
        rCtx.fillStyle = '#4a3a28';
      } else {
        rCtx.fillStyle = '#1b2e21';
      }

      rCtx.fillRect(x0, y0, cellPx - 0.5, cellPx - 0.5);
    }
  }

  // Draw discovered trail connections
  const dirDeltas = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  rCtx.strokeStyle = '#a38252';
  rCtx.lineWidth = 3;
  rCtx.lineCap = 'round';
  rCtx.beginPath();
  for (const t of tiles) {
    if (!t.isDiscovered || !Array.isArray(t.pathConnections) || t.pathConnections.length === 0) continue;
    const cx = pad + (t.x - minX + 0.5) * cellPx;
    const cy = pad + (t.y - minY + 0.5) * cellPx;
    for (const dir of t.pathConnections) {
      const d = dirDeltas[dir];
      if (!d) continue;
      rCtx.moveTo(cx, cy);
      rCtx.lineTo(cx + d[0] * (cellPx * 0.5), cy + d[1] * (cellPx * 0.5));
    }
  }
  rCtx.stroke();

  // Draw discovered landmarks
  for (const t of tiles) {
    if (!t.isLandmark) continue;
    // Oakhaven is always known as home sanctuary; other landmarks require discovery
    if (!t.isDiscovered && t.landmarkKey !== 'OAKHAVEN' && t.landmarkKey !== 'OAKHAVEN_CITY') continue;

    const cx = pad + (t.x - minX + 0.5) * cellPx;
    const cy = pad + (t.y - minY + 0.5) * cellPx;

    const isCity = t.landmarkKey === 'OAKHAVEN' || t.landmarkKey === 'OAKHAVEN_CITY';
    rCtx.fillStyle = t.landmarkKey === 'GOBLIN_STRONGHOLD'
      ? (mapData.bossSlain ? '#4ade80' : '#ef4444')
      : (isCity ? '#facc15' : '#fde68a');
    rCtx.strokeStyle = '#090d12';
    rCtx.lineWidth = 1.5;
    rCtx.beginPath();
    rCtx.arc(cx, cy, isCity || t.landmarkKey === 'GOBLIN_STRONGHOLD' ? 5.2 : 3.8, 0, Math.PI * 2);
    rCtx.fill();
    rCtx.stroke();
  }

  // Draw current hero position
  const heroX = state.currentTile ? Number(state.currentTile.x) : 15;
  const heroY = state.currentTile ? Number(state.currentTile.y) : 27;
  const hCx = pad + (heroX - minX + 0.5) * cellPx;
  const hCy = pad + (heroY - minY + 0.5) * cellPx;

  rCtx.fillStyle = 'rgba(250, 204, 21, 0.35)';
  rCtx.beginPath();
  rCtx.arc(hCx, hCy, 9, 0, Math.PI * 2);
  rCtx.fill();

  rCtx.fillStyle = '#38bdf8';
  rCtx.strokeStyle = '#ffffff';
  rCtx.lineWidth = 2;
  rCtx.beginPath();
  rCtx.arc(hCx, hCy, 5, 0, Math.PI * 2);
  rCtx.fill();
  rCtx.stroke();

  rCtx.restore();
}
