/**
 * DARKGRID ADVENTURE LAB — Pure UI Formatting & Continuity Utilities (ES Module)
 */

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getConditionColor(bracketKey) {
  switch (bracketKey) {
    case '5_uninjured': return '#4ade80';
    case '6_barely_wounded': return '#a3e635';
    case '7_wounded': return '#f59e0b';
    case '8_badly_wounded': return '#f97316';
    case '9_near_death': return '#ef4444';
    default: return '#c5a059';
  }
}

export function isReducedMotionPreferred() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export function seededUnit(seed, salt) {
  let h = (seed ^ (salt * 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function sanitizePlayerContinuityText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const terrainMap = {
    FOREST: 'Forest',
    PLAINS: 'Plains',
    SWAMP: 'Swamp',
    HILLS: 'Hills',
    JUNGLE: 'Jungle',
    CITY: 'Sanctuary',
    TOWN: 'Settlement',
    BRIDGE: 'Stone Bridge',
    UNDERGROUND_RUINS: 'Ruins',
    HIGH_ROAD: 'High Road',
    MOUNTAINS: 'Mountains',
    RIVER_LAKE: 'River',
    OCEAN: 'Sea'
  };
  return rawText
    .replace(/\s*\((?:CLEARED_SITE|LINGERING_THREAT_SITE|FAMILIAR_SAFE|FIRST_VISIT|FOREST|PLAINS|SWAMP|HILLS|JUNGLE|CITY|TOWN|BRIDGE|UNDERGROUND_RUINS|HIGH_ROAD|MOUNTAINS|RIVER_LAKE|OCEAN)\)/g, '')
    .replace(/\bLINGERING_THREAT_SITE\b/g, 'a site of lingering danger')
    .replace(/\bCLEARED_SITE\b/g, 'secured ground')
    .replace(/\bFAMILIAR_SAFE\b/g, 'familiar ground')
    .replace(/\bFIRST_VISIT\b/g, 'uncharted ground')
    .replace(/\bcontinuous\s+(FOREST|PLAINS|SWAMP|HILLS|JUNGLE|CITY|TOWN|BRIDGE|UNDERGROUND_RUINS)\s+stretch\b/g, (_m, t) => `continuous ${(terrainMap[t] || t).toLowerCase()} stretch`)
    .replace(/\b(FOREST|PLAINS|SWAMP|HILLS|JUNGLE|UNDERGROUND_RUINS|RIVER_LAKE|OCEAN|MOUNTAINS|CITY|TOWN|BRIDGE|HIGH_ROAD)\b/g, (m) => terrainMap[m] || m)
    .replace(/\bfacing\s+(NORTH|EAST|SOUTH|WEST)\b/g, (_m, dir) => `facing ${dir[0]}${dir.slice(1).toLowerCase()}`)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function buildRevisitBadgeHtml(adv) {
  if (!adv || typeof adv !== 'object') return '';
  const tc = adv.travelContinuity || {};
  const status = adv.revisitStatus || tc.revisitStatus || null;
  const banner = sanitizePlayerContinuityText(adv.revisitBanner || tc.revisitBanner || '');
  const visitCount = (tc.tileMemory && Number(tc.tileMemory.visitCount)) || 1;
  if (status === 'CLEARED_SITE') {
    return `<span class="fp-revisit-pill is-cleared" data-revisit-status="CLEARED_SITE" title="${escapeHtml(banner || 'You previously defeated the threat here and secured this ground.')}">✓ Secured Ground</span>`;
  }
  if (status === 'LINGERING_THREAT_SITE') {
    return `<span class="fp-revisit-pill is-lingering" data-revisit-status="LINGERING_THREAT_SITE" title="${escapeHtml(banner || 'A previously bypassed or fled threat still lingers near this location.')}">⚠️ Lingering Threat</span>`;
  }
  if (status === 'FAMILIAR_SAFE' && visitCount >= 2) {
    return `<span class="fp-revisit-pill is-familiar" data-revisit-status="FAMILIAR_SAFE" title="${escapeHtml(banner || 'Known ground along your expedition route.')}">↺ Familiar Ground</span>`;
  }
  return '';
}

export function isEditableTarget(target) {
  if (!target) return false;
  const tag = (target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}
