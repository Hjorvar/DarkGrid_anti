/**
 * DARKGRID ADVENTURE LAB — 5x5 Directional Minimap & Compass Rose Widget (ES Module)
 */
import { store, FACING_META } from '../state/store.js';

export function toggleMinimapSize(forceState) {
  const card = document.getElementById('dm-minimap-card');
  const btn = document.getElementById('btn-toggle-minimap-size');
  if (!card) return false;
  const nextState = typeof forceState === 'boolean'
    ? forceState
    : !card.classList.contains('is-expanded-map');
  card.classList.toggle('is-expanded-map', nextState);
  store.isMinimapExpanded = nextState;
  if (btn) {
    btn.setAttribute('aria-expanded', String(nextState));
    btn.textContent = nextState ? '⊟' : '⊞';
    btn.title = nextState ? 'Compact Tactical Minimap' : 'Expand Tactical Minimap';
  }
  return nextState;
}
import { escapeHtml, sanitizePlayerContinuityText } from '../ui/utils.js';

export function renderMinimap(state) {
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
  const cCtx = state.adventure && state.adventure.compassContext;
  const compAheadLbl = document.getElementById('compass-ahead-lbl');
  if (compAheadLbl && ahead1) {
    const aheadLandmark = cCtx && cCtx.ahead && cCtx.ahead.landmark;
    const displayName = (aheadLandmark && aheadLandmark.shortLabel) || ahead1.name;
    compAheadLbl.textContent = `Ahead: ${displayName}${ahead1.isPassable ? '' : ' (Blocked)'}`;
    const aheadTip = (cCtx && cCtx.ahead && cCtx.ahead.summary) ? sanitizePlayerContinuityText(cCtx.ahead.summary) : '';
    const behindTip = (cCtx && cCtx.behind && cCtx.behind.summary) ? sanitizePlayerContinuityText(cCtx.behind.summary) : '';
    compAheadLbl.title = [aheadTip, behindTip].filter(Boolean).join(' • ');
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
