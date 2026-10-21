/**
 * DARKGRID ADVENTURE LAB — Legacy Geometric First-Person SVG Renderer (ES Module)
 */
import { store } from '../state/store.js';
import { escapeHtml, seededUnit } from '../ui/utils.js';

export function applyFlankClass(el, tileInfo) {
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

export function buildMapConnectedSceneSvg(scene, state = null) {
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

export function buildSideObstacleSvg(side, tileInfo, seed) {
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

export function buildForwardObstacleSvg(ahead1, vanishX, horizonY, seed) {
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

export function buildSeededForegroundPropsSvg(terrain, seed) {
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
