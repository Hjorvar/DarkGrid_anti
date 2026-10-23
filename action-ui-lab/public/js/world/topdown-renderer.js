/**
 * DARKGRID — TOP-DOWN EXPLORATION EXPERIMENT 1
 * Cohesive 2D Top-Down Dark-Fantasy Map Renderer (Town + 8x7 Blackwood Goblin Forest + Stronghold)
 *
 * Design Principles:
 *   - Reusable graphic elements (modular trees, pine clusters, ancient oak, crags, bushes, cobblestone/forest paths,
 *     timber buildings, palisade walls, watchtower, stronghold gate, water ripples, warm lantern/brazier lighting).
 *   - Zero visible grid lines.
 *   - Zero emojis as map graphics.
 *   - Smooth short interpolation (~160ms) when stepping 1 tile in any cardinal direction.
 *   - No visible roaming monsters on the map.
 *   - Clicking any passable adjacent tile moves 1 step in that cardinal direction.
 */

import { store } from '../state/store.js';
import { dispatchMove } from '../api/client.js';

const MOVE_ANIM_DURATION_MS = 165;

const rendererState = {
  canvas: null,
  ctx: null,
  lastMapPayload: null,
  heroVisualX: null,
  heroVisualY: null,
  animFromX: null,
  animFromY: null,
  animToX: null,
  animToY: null,
  animStartTime: 0,
  isAnimatingMove: false,
  heroFacing: 'NORTH',
  hoveredCardDir: null,
  hoveredCoord: null,
  rafId: null,
  lastLayout: null,
  listenersAttached: false
};

function hash2D(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function easeOutCubic(t) {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

export function ensureTopdownCanvas() {
  const backdrop = document.getElementById('fp-scene-backdrop');
  if (!backdrop) return null;

  let wrap = document.getElementById('topdown-map-stage');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'topdown-map-stage';
    wrap.className = 'topdown-map-stage';
    const canvas = document.createElement('canvas');
    canvas.id = 'topdown-map-canvas';
    canvas.className = 'topdown-map-canvas';
    canvas.setAttribute('aria-label', 'Top-Down 2D World Map — Oakhaven and Blackwood Goblin Forest');
    wrap.appendChild(canvas);
    backdrop.appendChild(wrap);
  }

  const canvas = document.getElementById('topdown-map-canvas');
  if (!canvas) return null;

  rendererState.canvas = canvas;
  rendererState.ctx = canvas.getContext('2d');

  if (!rendererState.listenersAttached) {
    rendererState.listenersAttached = true;
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseleave', () => {
      if (rendererState.hoveredCardDir || rendererState.hoveredCoord) {
        rendererState.hoveredCardDir = null;
        rendererState.hoveredCoord = null;
        canvas.style.cursor = 'default';
        requestTopdownRedraw();
      }
    });
    canvas.addEventListener('click', handleCanvasClick);
  }

  return canvas;
}

function resolveAdjacentDirectionFromGrid(gx, gy) {
  const st = store.currentState;
  if (!st || !st.currentTile) return null;
  const enc = st.encounter;
  if (enc && (enc.status === 'IN_COMBAT' || enc.isAmbush)) return null;

  const hx = Number(st.currentTile.x);
  const hy = Number(st.currentTile.y);
  const dx = gx - hx;
  const dy = gy - hy;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;

  const mapData = st.topdownMap;
  if (mapData && Array.isArray(mapData.tiles)) {
    const target = mapData.tiles.find(t => t.x === gx && t.y === gy);
    if (!target || !target.isPassable) return null;
  }

  if (dx === 0 && dy === -1) return 'NORTH';
  if (dx === 1 && dy === 0) return 'EAST';
  if (dx === 0 && dy === 1) return 'SOUTH';
  if (dx === -1 && dy === 0) return 'WEST';
  return null;
}

function clientPointToGridCoord(clientX, clientY) {
  const canvas = rendererState.canvas;
  const layout = rendererState.lastLayout;
  const mapData = rendererState.lastMapPayload;
  if (!canvas || !layout || !mapData) return null;

  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;

  const col = Math.floor((px - layout.originX) / layout.tileSize);
  const row = Math.floor((py - layout.originY) / layout.tileSize);
  if (col < 0 || col >= mapData.bounds.cols || row < 0 || row >= mapData.bounds.rows) {
    return null;
  }
  return {
    x: mapData.bounds.minX + col,
    y: mapData.bounds.minY + row
  };
}

function handleCanvasMouseMove(e) {
  const coord = clientPointToGridCoord(e.clientX, e.clientY);
  const dir = coord ? resolveAdjacentDirectionFromGrid(coord.x, coord.y) : null;
  const changed =
    rendererState.hoveredCardDir !== dir ||
    (coord && rendererState.hoveredCoord && (coord.x !== rendererState.hoveredCoord.x || coord.y !== rendererState.hoveredCoord.y)) ||
    Boolean(coord) !== Boolean(rendererState.hoveredCoord);

  rendererState.hoveredCoord = coord;
  rendererState.hoveredCardDir = dir;
  if (rendererState.canvas) {
    rendererState.canvas.style.cursor = dir ? 'pointer' : 'default';
  }
  if (changed) {
    requestTopdownRedraw();
  }
}

function handleCanvasClick(e) {
  const coord = clientPointToGridCoord(e.clientX, e.clientY);
  if (!coord) return;
  const dir = resolveAdjacentDirectionFromGrid(coord.x, coord.y);
  if (dir) {
    dispatchMove(dir);
  }
}

export function renderTopdownWorld(state) {
  if (!state || !state.topdownMap) return;
  const canvas = ensureTopdownCanvas();
  if (!canvas) return;

  const mapData = state.topdownMap;
  rendererState.lastMapPayload = mapData;
  rendererState.heroFacing = mapData.heroFacing || state.facing || 'NORTH';

  const targetX = Number(mapData.heroX);
  const targetY = Number(mapData.heroY);

  if (rendererState.heroVisualX === null || rendererState.heroVisualY === null) {
    rendererState.heroVisualX = targetX;
    rendererState.heroVisualY = targetY;
    rendererState.animToX = targetX;
    rendererState.animToY = targetY;
    rendererState.isAnimatingMove = false;
  } else if (rendererState.animToX !== targetX || rendererState.animToY !== targetY) {
    const dist = Math.abs(targetX - rendererState.heroVisualX) + Math.abs(targetY - rendererState.heroVisualY);
    if (dist > 0 && dist <= 1.75) {
      rendererState.animFromX = rendererState.heroVisualX;
      rendererState.animFromY = rendererState.heroVisualY;
      rendererState.animToX = targetX;
      rendererState.animToY = targetY;
      rendererState.animStartTime = performance.now();
      rendererState.isAnimatingMove = true;
    } else {
      rendererState.heroVisualX = targetX;
      rendererState.heroVisualY = targetY;
      rendererState.animToX = targetX;
      rendererState.animToY = targetY;
      rendererState.isAnimatingMove = false;
    }
  }

  requestTopdownRedraw();
}

export function requestTopdownRedraw() {
  if (rendererState.rafId) return;
  rendererState.rafId = requestAnimationFrame(stepTopdownFrame);
}

function stepTopdownFrame(now) {
  rendererState.rafId = null;
  const canvas = rendererState.canvas;
  const ctx = rendererState.ctx;
  const mapData = rendererState.lastMapPayload;
  if (!canvas || !ctx || !mapData) return;

  if (rendererState.isAnimatingMove) {
    const elapsed = now - rendererState.animStartTime;
    const t = easeOutCubic(elapsed / MOVE_ANIM_DURATION_MS);
    rendererState.heroVisualX = rendererState.animFromX + (rendererState.animToX - rendererState.animFromX) * t;
    rendererState.heroVisualY = rendererState.animFromY + (rendererState.animToY - rendererState.animFromY) * t;
    if (elapsed >= MOVE_ANIM_DURATION_MS) {
      rendererState.heroVisualX = rendererState.animToX;
      rendererState.heroVisualY = rendererState.animToY;
      rendererState.isAnimatingMove = false;
    }
  }

  drawTopdownScene(canvas, ctx, mapData, now);

  if (rendererState.isAnimatingMove) {
    requestTopdownRedraw();
  }
}

/* =========================================================================
   REUSABLE GRAPHIC PRIMITIVES (Trees, Paths, Crags, Water, Town, Stronghold, Hero)
   ========================================================================= */

function drawDeciduousTree(ctx, cx, cy, radius, variant = 0) {
  ctx.save();
  // Ground drop shadow
  ctx.fillStyle = 'rgba(3, 5, 7, 0.56)';
  ctx.beginPath();
  ctx.ellipse(cx + radius * 0.22, cy + radius * 0.28, radius * 0.98, radius * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  const palettes = [
    ['#101d15', '#172b1e', '#223b29', '#2e4c35'],
    ['#132017', '#1b2f21', '#26412d', '#34543b'],
    ['#161f16', '#212e1f', '#2d3f2a', '#3d5137']
  ];
  const pal = palettes[variant % palettes.length];

  // Outer foliage lobes
  const lobeCount = 7;
  ctx.fillStyle = pal[0];
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < lobeCount; i++) {
    const ang = (i / lobeCount) * Math.PI * 2 + variant * 0.5;
    const lx = cx + Math.cos(ang) * radius * 0.44;
    const ly = cy + Math.sin(ang) * radius * 0.44;
    ctx.fillStyle = i % 2 === 0 ? pal[1] : pal[0];
    ctx.beginPath();
    ctx.arc(lx, ly, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mid canopy crown
  ctx.fillStyle = pal[2];
  ctx.beginPath();
  ctx.arc(cx - radius * 0.08, cy - radius * 0.08, radius * 0.66, 0, Math.PI * 2);
  ctx.fill();

  // Top moonlit crown highlight
  ctx.fillStyle = pal[3];
  ctx.beginPath();
  ctx.arc(cx - radius * 0.18, cy - radius * 0.18, radius * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPineTree(ctx, cx, cy, radius, variant = 0) {
  ctx.save();
  // Ground shadow
  ctx.fillStyle = 'rgba(3, 5, 8, 0.58)';
  ctx.beginPath();
  ctx.ellipse(cx + radius * 0.24, cy + radius * 0.26, radius * 0.92, radius * 0.76, 0, 0, Math.PI * 2);
  ctx.fill();

  const tiers = [
    { r: radius * 0.98, color: '#0d1914', rot: variant * 0.3 },
    { r: radius * 0.72, color: '#14261e', rot: variant * 0.3 + 0.4 },
    { r: radius * 0.46, color: '#1f382c', rot: variant * 0.3 + 0.8 }
  ];

  tiers.forEach((tier, idx) => {
    const points = 8;
    const ox = cx - idx * radius * 0.05;
    const oy = cy - idx * radius * 0.05;
    ctx.fillStyle = tier.color;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const ang = (i / (points * 2)) * Math.PI * 2 + tier.rot;
      const rad = i % 2 === 0 ? tier.r : tier.r * 0.56;
      const px = ox + Math.cos(ang) * rad;
      const py = oy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  });

  ctx.fillStyle = '#2d4c3b';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.08, cy - radius * 0.08, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBush(ctx, cx, cy, radius) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 9, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 3, radius * 1.05, radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#192b1e';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.arc(cx - radius * 0.5, cy + radius * 0.1, radius * 0.75, 0, Math.PI * 2);
  ctx.arc(cx + radius * 0.5, cy + radius * 0.15, radius * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#29422f';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.15, cy - radius * 0.15, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRockOutcrop(ctx, cx, cy, rx, ry, seed = 0) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 10, 0.58)';
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.18, cy + ry * 0.24, rx * 1.04, ry * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  const pts = 7;
  ctx.beginPath();
  for (let i = 0; i < pts; i++) {
    const ang = (i / pts) * Math.PI * 2 + seed;
    const jitter = 0.78 + ((i * 37) % 10) * 0.03;
    const px = cx + Math.cos(ang) * rx * jitter;
    const py = cy + Math.sin(ang) * ry * jitter;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#252a34';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#12151b';
  ctx.stroke();

  // Top rock ridge highlight
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.45, cy - ry * 0.2);
  ctx.lineTo(cx, cy - ry * 0.52);
  ctx.lineTo(cx + rx * 0.42, cy - ry * 0.1);
  ctx.lineTo(cx + rx * 0.08, cy + ry * 0.18);
  ctx.closePath();
  ctx.fillStyle = '#3b4352';
  ctx.fill();
  ctx.restore();
}

function drawWarmGlow(ctx, cx, cy, radius, rgbaInner = 'rgba(245, 175, 75, 0.34)') {
  ctx.save();
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.06, cx, cy, radius);
  grad.addColorStop(0, rgbaInner);
  grad.addColorStop(0.5, 'rgba(217, 119, 6, 0.12)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTimberRoof(ctx, x, y, w, h, roofColor = '#4a2e1b', ridgeHorizontal = true) {
  ctx.save();
  // Drop shadow
  ctx.fillStyle = 'rgba(3, 5, 8, 0.65)';
  ctx.fillRect(x + 4, y + 5, w, h);

  // Base timber roof
  ctx.fillStyle = roofColor;
  ctx.strokeStyle = '#1c120b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.stroke();

  // Roof slope shading & ridge beam
  if (ridgeHorizontal) {
    ctx.fillStyle = 'rgba(255, 220, 170, 0.09)';
    ctx.fillRect(x + 1, y + 1, w - 2, h * 0.48);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fillRect(x + 1, y + h * 0.5, w - 2, h * 0.48);
    ctx.strokeStyle = '#785133';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + h / 2);
    ctx.lineTo(x + w - 2, y + h / 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255, 220, 170, 0.09)';
    ctx.fillRect(x + 1, y + 1, w * 0.48, h - 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fillRect(x + w * 0.5, y + 1, w * 0.48, h - 2);
    ctx.strokeStyle = '#785133';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 2);
    ctx.lineTo(x + w / 2, y + h - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPalisadeLogRow(ctx, x1, y1, x2, y2, logRadius = 4.2) {
  ctx.save();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(2, Math.floor(dist / (logRadius * 1.75)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lx = x1 + dx * t;
    const ly = y1 + dy * t;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.arc(lx + 2, ly + 2.5, logRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = i % 2 === 0 ? '#3e2918' : '#4c331e';
    ctx.strokeStyle = '#1b1109';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(lx, ly, logRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6b492c';
    ctx.beginPath();
    ctx.arc(lx - 0.8, ly - 0.8, logRadius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeroTopDownToken(ctx, cx, cy, tileSize, facing, heroClass = 'FIGHTER') {
  ctx.save();
  const scale = tileSize / 64;

  // Selection / Presence Aura Ring on ground
  const ringGrad = ctx.createRadialGradient(cx, cy, tileSize * 0.1, cx, cy, tileSize * 0.44);
  ringGrad.addColorStop(0, 'rgba(230, 190, 110, 0.36)');
  ringGrad.addColorStop(0.68, 'rgba(197, 160, 89, 0.16)');
  ringGrad.addColorStop(1, 'rgba(197, 160, 89, 0)');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * 0.44, 0, Math.PI * 2);
  ctx.fill();

  // Crisp gold ground ring
  ctx.strokeStyle = 'rgba(230, 190, 110, 0.88)';
  ctx.lineWidth = Math.max(1.5, 2.0 * scale);
  ctx.beginPath();
  ctx.arc(cx, cy, tileSize * 0.27, 0, Math.PI * 2);
  ctx.stroke();

  // Rotate character body according to facing
  const angleMap = {
    NORTH: 0,
    EAST: Math.PI / 2,
    SOUTH: Math.PI,
    WEST: -Math.PI / 2
  };
  const angle = angleMap[facing] ?? 0;

  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Facing direction chevron in front of hero
  ctx.fillStyle = '#fde68a';
  ctx.strokeStyle = '#1c1408';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -tileSize * 0.36);
  ctx.lineTo(-tileSize * 0.08, -tileSize * 0.25);
  ctx.lineTo(tileSize * 0.08, -tileSize * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Drop shadow under hero shoulders
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.ellipse(1.5, 2.5, tileSize * 0.21, tileSize * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cloak / cape trailing behind
  const cloakColors = {
    FIGHTER: '#7f1d1d',
    RANGER: '#14532d',
    CLERIC: '#1e3a8a'
  };
  ctx.fillStyle = cloakColors[String(heroClass).toUpperCase()] || '#7f1d1d';
  ctx.beginPath();
  ctx.arc(0, tileSize * 0.04, tileSize * 0.19, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.closePath();
  ctx.fill();

  // Armored shoulders (pauldrons)
  ctx.fillStyle = '#64748b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, tileSize * 0.20, tileSize * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Shield on left arm
  ctx.fillStyle = '#94a3b8';
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-tileSize * 0.23, -tileSize * 0.12, tileSize * 0.07, tileSize * 0.18, 2);
  ctx.fill();
  ctx.stroke();

  // Drawn steel blade on right hand pointing forward
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = Math.max(2, 2.4 * scale);
  ctx.beginPath();
  ctx.moveTo(tileSize * 0.18, -tileSize * 0.04);
  ctx.lineTo(tileSize * 0.18, -tileSize * 0.29);
  ctx.stroke();
  // Crossguard
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tileSize * 0.13, -tileSize * 0.08);
  ctx.lineTo(tileSize * 0.23, -tileSize * 0.08);
  ctx.stroke();

  // Helmet / Crown seen from above
  const helmGrad = ctx.createRadialGradient(-tileSize * 0.03, -tileSize * 0.03, 1, 0, 0, tileSize * 0.12);
  helmGrad.addColorStop(0, '#f8fafc');
  helmGrad.addColorStop(0.55, '#94a3b8');
  helmGrad.addColorStop(1, '#334155');
  ctx.fillStyle = helmGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, tileSize * 0.115, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawTopdownScene(canvas, ctx, mapData, now = 0) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  const cssW = Math.max(320, Math.floor(rect.width));
  const cssH = Math.max(260, Math.floor(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  // 1. Deep Dark-Fantasy Forest Void Fill
  const bgGrad = ctx.createRadialGradient(cssW * 0.5, cssH * 0.5, cssH * 0.1, cssW * 0.5, cssH * 0.5, Math.max(cssW, cssH) * 0.75);
  bgGrad.addColorStop(0, '#131d16');
  bgGrad.addColorStop(0.65, '#0b120e');
  bgGrad.addColorStop(1, '#060908');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, cssW, cssH);

  const cols = mapData.bounds.cols || 8;
  const rows = mapData.bounds.rows || 7;
  const minX = mapData.bounds.minX;
  const minY = mapData.bounds.minY;

  // Reserve a comfortable margin at top and bottom so Town / Stronghold HUD bars never overlap tile 7,7 or 7,1
  const padX = Math.max(18, cssW * 0.04);
  const padTop = Math.max(36, cssH * 0.06);
  const padBottom = Math.max(106, cssH * 0.145);
  const availW = cssW - padX * 2;
  const availH = cssH - padTop - padBottom;
  const tileSize = Math.floor(Math.min(availW / cols, availH / rows));
  const mapW = tileSize * cols;
  const mapH = tileSize * rows;
  const originX = Math.floor((cssW - mapW) / 2);
  const originY = Math.floor(padTop + (availH - mapH) / 2);

  rendererState.lastLayout = { originX, originY, tileSize, mapW, mapH, cssW, cssH };

  const tileByKey = new Map();
  (mapData.tiles || []).forEach(t => tileByKey.set(`${t.x},${t.y}`, t));

  const toScreenCenter = (gx, gy) => ({
    x: originX + (gx - minX + 0.5) * tileSize,
    y: originY + (gy - minY + 0.5) * tileSize
  });

  // 2. Continuous Terrain Ground Layer (Zero grid lines — overlapping organic biome patches)
  for (let gy = minY - 1; gy <= mapData.bounds.maxY + 1; gy++) {
    for (let gx = minX - 1; gx <= mapData.bounds.maxX + 1; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      const { x: cx, y: cy } = toScreenCenter(gx, gy);
      const kind = tile ? tile.visualKind : 'DENSE_WOODS';

      let baseColor = '#111b14';
      let accentColor = '#18261c';
      if (kind === 'TOWN') {
        baseColor = '#2a251e';
        accentColor = '#3a3228';
      } else if (kind === 'STRONGHOLD_GATE' || kind === 'STRONGHOLD_WALL') {
        baseColor = '#231c16';
        accentColor = '#31251c';
      } else if (kind === 'MOUNTAIN_CRAG') {
        baseColor = '#1a1e26';
        accentColor = '#262b36';
      } else if (kind === 'RIVER' || kind === 'BRIDGE') {
        baseColor = '#0c1d29';
        accentColor = '#122938';
      } else if (kind === 'RUINS' || kind === 'WATCHPOST') {
        baseColor = '#1a211e';
        accentColor = '#252e2b';
      } else if (kind === 'FOREST_CLEARING' || kind === 'ANCIENT_OAK') {
        baseColor = '#162419';
        accentColor = '#1f3223';
      } else if (kind === 'FOREST_PATH' || kind === 'NORTH_GATE' || kind === 'CROSSROADS') {
        baseColor = '#18251a';
        accentColor = '#213124';
      }

      ctx.fillStyle = baseColor;
      ctx.fillRect(cx - tileSize * 0.54, cy - tileSize * 0.54, tileSize * 1.08, tileSize * 1.08);

      // Soft organic moss/earth blend circles so adjacent tiles fuse seamlessly
      const g = ctx.createRadialGradient(cx, cy, tileSize * 0.08, cx, cy, tileSize * 0.78);
      g.addColorStop(0, accentColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, tileSize * 0.78, 0, Math.PI * 2);
      ctx.fill();

      // Subtle grass/moss tufts on passable forest ground
      if (tile && tile.isPassable && kind !== 'TOWN' && kind !== 'BRIDGE') {
        const tuftSeed = hash2D(gx, gy, 11);
        ctx.fillStyle = 'rgba(46, 78, 52, 0.35)';
        ctx.beginPath();
        ctx.arc(
          cx + (tuftSeed - 0.5) * tileSize * 0.45,
          cy + (hash2D(gx, gy, 19) - 0.5) * tileSize * 0.45,
          tileSize * 0.14,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  // 3. Blackwater River Channel (Continuous flowing dark water through [9,3] Log Crossing -> [9,4] Ravine -> [9,5] Rapids -> [8,6] River -> [8,7] Stone Bridge)
  ctx.save();
  const riverWaypoints = [
    toScreenCenter(9, 2.45),
    toScreenCenter(9, 3.0),
    toScreenCenter(9, 4.0),
    toScreenCenter(9, 5.0),
    toScreenCenter(8, 6.0),
    toScreenCenter(8, 7.0),
    toScreenCenter(8, 7.62)
  ];

  const traceRiverPath = (offsetX = 0) => {
    ctx.beginPath();
    ctx.moveTo(riverWaypoints[0].x + offsetX, riverWaypoints[0].y);
    for (let i = 1; i < riverWaypoints.length - 1; i++) {
      const curr = riverWaypoints[i];
      const next = riverWaypoints[i + 1];
      const midX = (curr.x + next.x) * 0.5 + offsetX;
      const midY = (curr.y + next.y) * 0.5;
      ctx.quadraticCurveTo(curr.x + offsetX, curr.y, midX, midY);
    }
    const last = riverWaypoints[riverWaypoints.length - 1];
    ctx.lineTo(last.x + offsetX, last.y);
  };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Muddy / rocky river bank
  ctx.strokeStyle = '#1b221e';
  ctx.lineWidth = tileSize * 0.68;
  traceRiverPath(0);
  ctx.stroke();

  // Deep black-blue river water
  ctx.strokeStyle = '#0b2232';
  ctx.lineWidth = tileSize * 0.50;
  traceRiverPath(0);
  ctx.stroke();

  // Shimmering current lines
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.24)';
  ctx.lineWidth = 1.6;
  [-7, 0, 7].forEach(offsetX => {
    traceRiverPath(offsetX);
    ctx.stroke();
  });

  // Whitewater rapids & submerged river boulders on impassable river tiles [9,4], [9,5], [8,6]
  [
    { x: 9, y: 4 },
    { x: 9, y: 5 },
    { x: 8, y: 6 }
  ].forEach(({ x, y }, idx) => {
    const rp = toScreenCenter(x, y);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(rp.x - tileSize * 0.10, rp.y - tileSize * 0.08, tileSize * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rp.x + tileSize * 0.11, rp.y + tileSize * 0.09, tileSize * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();

  // 4. Continuous Winding Forest Trails & Roads Connecting ONLY Passable Tiles
  const rawTrailSegments = [
    // Main spine: Oakhaven [7,7] -> North Gate [7,6] -> Crossroads [7,5] -> Trail [7,4] -> Ancient Oak [7,3] -> Approach [7,2] -> Stronghold Gate [7,1]
    [[7, 7], [7, 6], [7, 5], [7, 4], [7, 3], [7, 2], [7, 1]],
    // Western Bypass around Stonefang Crag [6,5]: Gate [7,6] -> [6,6] -> [5,6] -> [5,5] -> [5,4] -> [6,4] -> [7,4]
    [[7, 6], [6, 6], [5, 6], [5, 5], [5, 4], [6, 4], [7, 4]],
    [[6, 4], [6, 3], [7, 3]],
    [[5, 4], [5, 3], [5, 2], [6, 2], [7, 2]],
    [[6, 3], [5, 3]],
    [[6, 3], [6, 2]],
    // West Bank River Glade & Mossy Clearing: [7,5] -> [8,5] -> [8,4] -> [8,3] -> [8,2] -> [7,2]
    [[7, 5], [8, 5], [8, 4], [8, 3], [8, 2], [7, 2]],
    [[7, 4], [8, 4]],
    [[7, 3], [8, 3]],
    // Eastern Stone Bridge & East Bank Ravine Trail -> Old Log Crossing [9,3]:
    // Oakhaven [7,7] -> Bridge [8,7] -> Watchpost [9,7] -> [9,6] -> [10,6] -> [10,5] -> [10,4] -> [10,3] -> Log Crossing [9,3] -> [8,3]
    [[7, 7], [8, 7], [9, 7], [9, 6], [10, 6], [10, 5], [10, 4], [10, 3], [9, 3], [8, 3]],
    // Northern Ridge Trail from Old Log Crossing [9,3] -> [9,2] -> [8,2]
    [[9, 3], [9, 2], [8, 2]]
  ];

  // Runtime guard: only render trail segments where every waypoint is passable in mapData
  const trailSegments = rawTrailSegments
    .map(chain => chain.filter(([gx, gy]) => {
      const t = tileByKey.get(`${gx},${gy}`);
      return !t || t.isPassable;
    }))
    .filter(chain => chain.length >= 2);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Soft dark earth border under trails
  ctx.strokeStyle = 'rgba(26, 20, 14, 0.82)';
  ctx.lineWidth = tileSize * 0.34;
  trailSegments.forEach(chain => {
    ctx.beginPath();
    chain.forEach(([gx, gy], idx) => {
      const jx = (hash2D(gx, gy, 3) - 0.5) * tileSize * 0.12;
      const jy = (hash2D(gx, gy, 7) - 0.5) * tileSize * 0.12;
      const pt = toScreenCenter(gx, gy);
      const px = pt.x + (gy === 7 || gy === 1 ? 0 : jx);
      const py = pt.y + (gy === 7 || gy === 1 ? 0 : jy);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  // Warm worn dirt center path
  ctx.strokeStyle = '#473828';
  ctx.lineWidth = tileSize * 0.21;
  trailSegments.forEach(chain => {
    ctx.beginPath();
    chain.forEach(([gx, gy], idx) => {
      const jx = (hash2D(gx, gy, 3) - 0.5) * tileSize * 0.12;
      const jy = (hash2D(gx, gy, 7) - 0.5) * tileSize * 0.12;
      const pt = toScreenCenter(gx, gy);
      const px = pt.x + (gy === 7 || gy === 1 ? 0 : jx);
      const py = pt.y + (gy === 7 || gy === 1 ? 0 : jy);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  // Subtle wagon/footpath highlight down the center of the main road
  ctx.strokeStyle = 'rgba(138, 112, 80, 0.35)';
  ctx.lineWidth = tileSize * 0.08;
  ctx.beginPath();
  trailSegments[0].forEach(([gx, gy], idx) => {
    const pt = toScreenCenter(gx, gy);
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();
  ctx.restore();

  // 5. Landmarks, Town Buildings, Bridges, Ruins & Stronghold Architecture
  // 5A. The Old Stone Bridge at [8, 7] & Old Log Crossing at [9, 3]
  {
    const b = toScreenCenter(8, 7);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(b.x - tileSize * 0.44, b.y - tileSize * 0.22 + 3, tileSize * 0.88, tileSize * 0.44);
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(b.x - tileSize * 0.44, b.y - tileSize * 0.20, tileSize * 0.88, tileSize * 0.40, 3);
    ctx.fill();
    ctx.stroke();
    // Stone parapets
    ctx.fillStyle = '#64748b';
    ctx.fillRect(b.x - tileSize * 0.44, b.y - tileSize * 0.23, tileSize * 0.88, tileSize * 0.07);
    ctx.fillRect(b.x - tileSize * 0.44, b.y + tileSize * 0.16, tileSize * 0.88, tileSize * 0.07);

    // Old Log Crossing timber bridge at [9, 3]
    const logB = toScreenCenter(9, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.50)';
    ctx.fillRect(logB.x - tileSize * 0.42, logB.y - tileSize * 0.18 + 2, tileSize * 0.84, tileSize * 0.36);
    ctx.fillStyle = '#5c3a21';
    ctx.strokeStyle = '#2d1c10';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(logB.x - tileSize * 0.42, logB.y - tileSize * 0.17, tileSize * 0.84, tileSize * 0.34, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 5B. Oakhaven Sanctuary Town at [7, 7] + North Gate at [7, 6]
  {
    const town = toScreenCenter(7, 7);
    const gate = toScreenCenter(7, 6);

    // Cobblestone town plaza
    ctx.save();
    const plazaGrad = ctx.createRadialGradient(town.x, town.y, tileSize * 0.05, town.x, town.y, tileSize * 0.55);
    plazaGrad.addColorStop(0, '#574c3f');
    plazaGrad.addColorStop(0.75, '#3b332a');
    plazaGrad.addColorStop(1, 'rgba(59, 51, 42, 0)');
    ctx.fillStyle = plazaGrad;
    ctx.beginPath();
    ctx.arc(town.x, town.y, tileSize * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Stone sanctuary perimeter wall around Oakhaven
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(town.x, town.y, tileSize * 0.46, 0.12 * Math.PI, 1.38 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(town.x, town.y, tileSize * 0.46, 1.62 * Math.PI, 1.88 * Math.PI);
    ctx.stroke();

    // Warm sanctuary hearth & lantern glow
    drawWarmGlow(ctx, town.x, town.y, tileSize * 0.68, 'rgba(251, 191, 36, 0.30)');

    // Town roofs (Sanctuary Hall, Market Smithy, Watch Barracks)
    drawTimberRoof(ctx, town.x - tileSize * 0.38, town.y - tileSize * 0.18, tileSize * 0.26, tileSize * 0.34, '#5c341d', false);
    drawTimberRoof(ctx, town.x + tileSize * 0.12, town.y - tileSize * 0.22, tileSize * 0.26, tileSize * 0.26, '#4a2c18', true);
    drawTimberRoof(ctx, town.x - tileSize * 0.22, town.y + tileSize * 0.16, tileSize * 0.42, tileSize * 0.22, '#6b3e23', true);

    // North Gatehouse Twin Towers at southern edge of [7, 6]
    const gateY = gate.y + tileSize * 0.26;
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    [-1, 1].forEach(side => {
      const tx = gate.x + side * tileSize * 0.26;
      ctx.beginPath();
      ctx.arc(tx, gateY, tileSize * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawWarmGlow(ctx, tx, gateY - 2, tileSize * 0.22, 'rgba(245, 158, 11, 0.35)');
    });
    ctx.restore();
  }

  // 5C. Heart of Blackwood — The Primeval Black Oak at [7, 3]
  {
    const oak = toScreenCenter(7, 3);
    ctx.save();
    // Mossy clearing ring
    ctx.strokeStyle = 'rgba(134, 239, 172, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(oak.x, oak.y, tileSize * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    // Massive gnarled roots & ancient trunk offset slightly so path passes beside it
    const ox = oak.x - tileSize * 0.24;
    const oy = oak.y - tileSize * 0.18;
    drawDeciduousTree(ctx, ox, oy, tileSize * 0.34, 1);
    // Amber sap lantern glow on the Ancient Oak
    drawWarmGlow(ctx, ox + tileSize * 0.1, oy + tileSize * 0.1, tileSize * 0.25, 'rgba(250, 204, 21, 0.28)');
    ctx.restore();
  }

  // 5D. Watchpost & Sunken Ruins Masonry (data-driven from passable WATCHPOST / RUINS tiles: [9, 7], [10, 4], [10, 3])
  (mapData.tiles || [])
    .filter(t => t.isPassable && (t.visualKind === 'WATCHPOST' || t.visualKind === 'RUINS'))
    .forEach(({ x, y }) => {
    const pt = toScreenCenter(x, y);
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.fillStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pt.x + tileSize * 0.18, pt.y - tileSize * 0.16, tileSize * 0.16, 0.2 * Math.PI, 1.55 * Math.PI);
    ctx.stroke();
    ctx.fillRect(pt.x - tileSize * 0.26, pt.y + tileSize * 0.12, tileSize * 0.16, tileSize * 0.10);
    ctx.restore();
  });

  // 5E. GOBLIN STRONGHOLD LANDMARK at [6, 1], [7, 1], [8, 1] and Approach [7, 2]
  {
    const shWest = toScreenCenter(6, 1);
    const shGate = toScreenCenter(7, 1);
    const shEast = toScreenCenter(8, 1);
    const shApproach = toScreenCenter(7, 2);

    ctx.save();
    // Scorched war-camp ground around the stronghold
    const campGrad = ctx.createRadialGradient(shGate.x, shGate.y, tileSize * 0.1, shGate.x, shGate.y, tileSize * 1.35);
    campGrad.addColorStop(0, 'rgba(68, 34, 20, 0.72)');
    campGrad.addColorStop(0.65, 'rgba(42, 24, 16, 0.42)');
    campGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = campGrad;
    ctx.beginPath();
    ctx.arc(shGate.x, shGate.y, tileSize * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Sharpened log palisade walls enclosing [6,1], [7,1], [8,1]
    const wallTopY = shGate.y - tileSize * 0.36;
    const wallBotY = shGate.y + tileSize * 0.32;
    const wallLeftX = shWest.x - tileSize * 0.32;
    const wallRightX = shEast.x + tileSize * 0.32;

    // Back & side palisade walls
    drawPalisadeLogRow(ctx, wallLeftX, wallTopY, wallRightX, wallTopY, 4.2);
    drawPalisadeLogRow(ctx, wallLeftX, wallTopY, wallLeftX, wallBotY, 4.2);
    drawPalisadeLogRow(ctx, wallRightX, wallTopY, wallRightX, wallBotY, 4.2);
    // Front palisade walls flanking the central gate opening at [7,1]
    drawPalisadeLogRow(ctx, wallLeftX, wallBotY, shGate.x - tileSize * 0.24, wallBotY, 4.2);
    drawPalisadeLogRow(ctx, shGate.x + tileSize * 0.24, wallBotY, wallRightX, wallBotY, 4.2);

    // Timber Watchtower on the western stronghold flank [6,1]
    drawTimberRoof(ctx, shWest.x - tileSize * 0.20, shWest.y - tileSize * 0.20, tileSize * 0.40, tileSize * 0.40, '#3b2314', true);
    // Chieftain War-Hall roof behind the gate at [7,1]
    drawTimberRoof(ctx, shGate.x - tileSize * 0.28, shGate.y - tileSize * 0.30, tileSize * 0.56, tileSize * 0.28, '#4f2216', true);
    // Guard barracks on the eastern flank [8,1]
    drawTimberRoof(ctx, shEast.x - tileSize * 0.20, shEast.y - tileSize * 0.16, tileSize * 0.36, tileSize * 0.32, '#3b2314', false);

    // Twin Gatehouse Towers & Iron-Bound Gate Arch at [7,1]
    [-1, 1].forEach(side => {
      const gx = shGate.x + side * tileSize * 0.24;
      const gy = wallBotY;
      ctx.fillStyle = '#2d1c10';
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(gx, gy, tileSize * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Burning war-braziers flanking the Stronghold Gate & Approach
      const flicker = 0.85 + Math.sin(now * 0.006 + side) * 0.15;
      if (!mapData.bossSlain) {
        drawWarmGlow(ctx, gx, gy, tileSize * 0.35 * flicker, 'rgba(239, 68, 68, 0.42)');
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(gx, gy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawWarmGlow(ctx, gx, gy, tileSize * 0.26, 'rgba(134, 239, 172, 0.25)');
      }
    });

    // Approach Palisade Stakes at [7, 2]
    drawPalisadeLogRow(ctx, shApproach.x - tileSize * 0.38, shApproach.y - tileSize * 0.18, shApproach.x - tileSize * 0.18, shApproach.y + tileSize * 0.18, 3.2);
    drawPalisadeLogRow(ctx, shApproach.x + tileSize * 0.38, shApproach.y - tileSize * 0.18, shApproach.x + tileSize * 0.18, shApproach.y + tileSize * 0.18, 3.2);
    ctx.restore();
  }

  // 6. Impassable Crags & Dense Forest Canopy (Rendered in depth order top-to-bottom)
  for (let gy = minY - 1; gy <= mapData.bounds.maxY + 1; gy++) {
    for (let gx = minX - 1; gx <= mapData.bounds.maxX + 1; gx++) {
      const tile = tileByKey.get(`${gx},${gy}`);
      const { x: cx, y: cy } = toScreenCenter(gx, gy);
      const kind = tile ? tile.visualKind : 'DENSE_WOODS';

      // Outer border or impassable Dense Woods: lush multi-tree canopy cluster
      if (!tile || kind === 'DENSE_WOODS') {
        const offsets = [
          [-0.24, -0.22, 0.32],
          [0.24, -0.18, 0.30],
          [-0.20, 0.22, 0.31],
          [0.22, 0.24, 0.33],
          [0.0, 0.0, 0.36]
        ];
        offsets.forEach(([ox, oy, rad], idx) => {
          const jx = (hash2D(gx, gy, idx * 7 + 1) - 0.5) * 0.10;
          const jy = (hash2D(gx, gy, idx * 7 + 2) - 0.5) * 0.10;
          const tx = cx + (ox + jx) * tileSize;
          const ty = cy + (oy + jy) * tileSize;
          const tr = rad * tileSize;
          if ((gx + gy + idx) % 2 === 0) {
            drawPineTree(ctx, tx, ty, tr, gx + idx);
          } else {
            drawDeciduousTree(ctx, tx, ty, tr, gy + idx);
          }
        });
        continue;
      }

      // Impassable Mountain Crags (Stonefang Crag [6,5] and Western Ridge [4,3]..[4,5])
      if (kind === 'MOUNTAIN_CRAG') {
        drawRockOutcrop(ctx, cx - tileSize * 0.14, cy - tileSize * 0.10, tileSize * 0.34, tileSize * 0.28, gx + gy);
        drawRockOutcrop(ctx, cx + tileSize * 0.18, cy + tileSize * 0.14, tileSize * 0.30, tileSize * 0.25, gx * 2 + gy);
        drawPineTree(ctx, cx - tileSize * 0.28, cy + tileSize * 0.24, tileSize * 0.22, gx);
        continue;
      }

      // Passable Forest tiles: scatter trees and bushes along tile edges so paths remain clear and readable
      if (tile.isPassable && !['TOWN', 'BRIDGE', 'STRONGHOLD_GATE'].includes(kind)) {
        const cornerCandidates = [
          [-0.33, -0.31],
          [0.33, -0.31],
          [-0.33, 0.31],
          [0.33, 0.31]
        ];
        cornerCandidates.forEach(([ox, oy], cIdx) => {
          const roll = hash2D(gx, gy, 40 + cIdx);
          if (roll < 0.58) {
            const tx = cx + ox * tileSize + (hash2D(gx, gy, 50 + cIdx) - 0.5) * 6;
            const ty = cy + oy * tileSize + (hash2D(gx, gy, 60 + cIdx) - 0.5) * 6;
            if (roll < 0.28) {
              drawPineTree(ctx, tx, ty, tileSize * 0.22, cIdx + gx);
            } else if (roll < 0.46) {
              drawDeciduousTree(ctx, tx, ty, tileSize * 0.21, cIdx + gy);
            } else {
              drawBush(ctx, tx, ty, tileSize * 0.12);
            }
          }
        });
      }
    }
  }

  // 7. Subtle Landmark Title Ribbons on Key World Locations (Pure canvas typography, no emojis)
  const landmarks = [
    { gx: 7, gy: 7, label: 'OAKHAVEN', sub: 'Safe Sanctuary', color: '#fde68a', dy: tileSize * 0.43 },
    { gx: 7, gy: 1, label: 'GOBLIN STRONGHOLD', sub: mapData.bossSlain ? 'Cleared' : 'Chieftain Lair', color: mapData.bossSlain ? '#86efac' : '#fca5a5', dy: -tileSize * 0.42 },
    { gx: 7, gy: 3, label: 'Black Oak', sub: null, color: '#cbd5e1', dy: -tileSize * 0.38 },
    { gx: 8, gy: 7, label: 'Stone Bridge', sub: null, color: '#cbd5e1', dy: tileSize * 0.38 }
  ];

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  landmarks.forEach(lm => {
    // Do not overlap label directly on top of the hero if standing on that exact tile
    const distToHero = Math.hypot(lm.gx - rendererState.heroVisualX, lm.gy - rendererState.heroVisualY);
    if (distToHero < 0.35 && lm.gy !== 1 && lm.gy !== 7) return;

    const pt = toScreenCenter(lm.gx, lm.gy);
    const lx = pt.x;
    const ly = pt.y + lm.dy;
    ctx.font = `700 ${Math.max(9, Math.round(tileSize * 0.15))}px Cinzel, Georgia, serif`;
    const textW = ctx.measureText(lm.label).width;
    const pillW = textW + 14;
    const pillH = Math.max(15, Math.round(tileSize * 0.23));

    ctx.fillStyle = 'rgba(7, 10, 14, 0.82)';
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.48)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx - pillW / 2, ly - pillH / 2, pillW, pillH, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = lm.color;
    ctx.fillText(lm.label, lx, ly + 0.5);
  });
  ctx.restore();

  // 8. Subtle Interactive Highlight on Passable Adjacent Step when Hovered with Mouse
  if (rendererState.hoveredCoord && rendererState.hoveredCardDir) {
    const hPt = toScreenCenter(rendererState.hoveredCoord.x, rendererState.hoveredCoord.y);
    ctx.save();
    ctx.strokeStyle = 'rgba(230, 190, 110, 0.72)';
    ctx.fillStyle = 'rgba(230, 190, 110, 0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hPt.x, hPt.y, tileSize * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 9. Draw Top-Down Hero Token with Smooth Interpolation
  const heroScreen = toScreenCenter(rendererState.heroVisualX, rendererState.heroVisualY);
  const heroClass = (store.currentState && store.currentState.character && store.currentState.character.class) || 'FIGHTER';
  drawHeroTopDownToken(ctx, heroScreen.x, heroScreen.y, tileSize, rendererState.heroFacing, heroClass);

  // 10. Atmospheric Dark-Fantasy Vignette around Map Perimeter
  const vig = ctx.createRadialGradient(cssW * 0.5, cssH * 0.5, Math.min(mapW, mapH) * 0.38, cssW * 0.5, cssH * 0.5, Math.max(cssW, cssH) * 0.72);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.75, 'rgba(5, 8, 11, 0.28)');
  vig.addColorStop(1, 'rgba(4, 6, 9, 0.82)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.restore();
}
