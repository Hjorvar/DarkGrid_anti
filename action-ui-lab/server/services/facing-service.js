/**
 * DARKGRID ADVENTURE LAB — Cardinal Facing, Relative Movement & Deterministic Seed Service
 */

const FACING_ORDER = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const FACING_VECTORS = {
  NORTH: { dx: 0, dy: -1, label: 'North', short: 'N', deg: 0, arrow: '▲' },
  EAST:  { dx: 1, dy: 0,  label: 'East',  short: 'E', deg: 90, arrow: '▶' },
  SOUTH: { dx: 0, dy: 1,  label: 'South', short: 'S', deg: 180, arrow: '▼' },
  WEST:  { dx: -1, dy: 0, label: 'West',  short: 'W', deg: 270, arrow: '◀' }
};

function normalizeFacing(facing) {
  const upper = String(facing || 'NORTH').toUpperCase().trim();
  return FACING_ORDER.includes(upper) ? upper : 'NORTH';
}

function rotateFacing(currentFacing, turn) {
  const norm = normalizeFacing(currentFacing);
  const idx = FACING_ORDER.indexOf(norm);
  const normalizedTurn = String(turn || '').toUpperCase().trim();
  if (normalizedTurn === 'LEFT' || normalizedTurn === 'CCW') {
    return FACING_ORDER[(idx + 3) % 4];
  }
  if (normalizedTurn === 'RIGHT' || normalizedTurn === 'CW') {
    return FACING_ORDER[(idx + 1) % 4];
  }
  if (FACING_ORDER.includes(normalizedTurn)) {
    return normalizedTurn;
  }
  return norm;
}

function getRelativeCardinalMap(facing) {
  const norm = normalizeFacing(facing);
  const idx = FACING_ORDER.indexOf(norm);
  return {
    FORWARD: FACING_ORDER[idx],
    RIGHT: FACING_ORDER[(idx + 1) % 4],
    STRAFE_RIGHT: FACING_ORDER[(idx + 1) % 4],
    BACKWARD: FACING_ORDER[(idx + 2) % 4],
    LEFT: FACING_ORDER[(idx + 3) % 4],
    STRAFE_LEFT: FACING_ORDER[(idx + 3) % 4]
  };
}

function getMoveKindFromCardinal(facing, cardinalDirection) {
  const rel = getRelativeCardinalMap(facing);
  const dir = String(cardinalDirection || '').toUpperCase().trim();
  if (dir === rel.FORWARD) return 'FORWARD';
  if (dir === rel.BACKWARD) return 'BACKWARD';
  if (dir === rel.STRAFE_LEFT) return 'STRAFE_LEFT';
  if (dir === rel.STRAFE_RIGHT) return 'STRAFE_RIGHT';
  return 'FORWARD';
}

function computeTileFacingSeed(x, y, facing) {
  const fIdx = FACING_ORDER.indexOf(normalizeFacing(facing)) + 1;
  const h = ((Number(x) * 73856093) ^ (Number(y) * 19349663) ^ (fIdx * 83492791)) >>> 0;
  return h;
}

function bracketNumToKey(bracket) {
  switch (Number(bracket)) {
    case 100: return '5_uninjured';
    case 75:  return '6_barely_wounded';
    case 50:  return '7_wounded';
    case 25:  return '8_badly_wounded';
    case 0:   return '9_near_death';
    default:  return '5_uninjured';
  }
}

module.exports = {
  FACING_ORDER,
  FACING_VECTORS,
  normalizeFacing,
  rotateFacing,
  getRelativeCardinalMap,
  getMoveKindFromCardinal,
  computeTileFacingSeed,
  bracketNumToKey
};
