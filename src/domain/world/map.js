const { withTransaction } = require('../../db/connection');

const DIRECTIONS = {
  NORTH: { dx: 0, dy: -1, name: 'North', key: 'NORTH' },
  SOUTH: { dx: 0, dy: 1,  name: 'South',  key: 'SOUTH' },
  EAST:  { dx: 1, dy: 0,  name: 'East', key: 'EAST' },
  WEST:  { dx: -1, dy: 0, name: 'West', key: 'WEST' }
};

const TERRAIN_SYMBOLS = {
  CITY: { symbol: '🏰', char: 'C', color: '#ecc94b', label: 'City' },
  FOREST: { symbol: '🌲', char: 'F', color: '#2f855a', label: 'Forest' },
  SWAMP: { symbol: '🌫️', char: 'S', color: '#4a5568', label: 'Swamp' },
  JUNGLE: { symbol: '🌴', char: 'J', color: '#276749', label: 'Jungle' },
  PLAINS: { symbol: '🌾', char: 'P', color: '#975a16', label: 'Plains' },
  HILLS: { symbol: '⛰️', char: 'H', color: '#744210', label: 'Hills' },
  MOUNTAINS: { symbol: '▲', char: 'M', color: '#4a5568', label: 'Mountains' },
  RIVER_LAKE: { symbol: '≋', char: 'R', color: '#2b6cb0', label: 'River/Lake' },
  BRIDGE: { symbol: '═', char: 'B', color: '#b7791f', label: 'Bridge' },
  OCEAN: { symbol: '≈', char: 'O', color: '#2c5282', label: 'Ocean' },
  AQUATIC: { symbol: '≈', char: 'A', color: '#2b6cb0', label: 'Water' },
  UNDERGROUND_RUINS: { symbol: '🏛️', char: 'U', color: '#553c9a', label: 'Ruins' },
  OTHER: { symbol: '·', char: '?', color: '#718096', label: 'Unknown' }
};

/**
 * Fetch tile by ID
 */
function getTileById(db, tileId) {
  const stmt = db.prepare('SELECT * FROM map_tiles WHERE id = ?');
  return stmt.get(tileId) || null;
}

/**
 * Fetch tile by coordinates
 */
function getTileByCoords(db, x, y) {
  const stmt = db.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?');
  return stmt.get(x, y) || null;
}

/**
 * Checks which directions are passable from the current tile
 */
function getAvailableDirections(db, currentTile) {
  const result = {};

  for (const [dirKey, dir] of Object.entries(DIRECTIONS)) {
    const targetX = currentTile.x + dir.dx;
    const targetY = currentTile.y + dir.dy;
    const targetTile = getTileByCoords(db, targetX, targetY);

    if (!targetTile) {
      result[dirKey] = {
        direction: dirKey,
        name: dir.name,
        available: false,
        reason: 'Edge of the world'
      };
    } else if (targetTile.is_passable === 0) {
      result[dirKey] = {
        direction: dirKey,
        name: dir.name,
        available: false,
        reason: `Impassable (${targetTile.name})`
      };
    } else {
      result[dirKey] = {
        direction: dirKey,
        name: dir.name,
        available: true,
        tileName: targetTile.name,
        terrain: targetTile.terrain
      };
    }
  }

  return result;
}

/**
 * Prepares 5x5 minimap data centered around player's current tile
 */
function getMinimapData(db, currentTile, radius = 2) {
  const minX = currentTile.x - radius;
  const maxX = currentTile.x + radius;
  const minY = currentTile.y - radius;
  const maxY = currentTile.y + radius;

  const stmt = db.prepare(`
    SELECT x, y, name, terrain, is_passable, is_safe
    FROM map_tiles
    WHERE x >= ? AND x <= ? AND y >= ? AND y <= ?
  `);
  const tiles = stmt.all(minX, maxX, minY, maxY);

  const tileMap = new Map();
  for (const t of tiles) {
    tileMap.set(`${t.x},${t.y}`, t);
  }

  const rows = [];
  for (let y = minY; y <= maxY; y++) {
    const row = [];
    for (let x = minX; x <= maxX; x++) {
      const tile = tileMap.get(`${x},${y}`);
      const isPlayer = (x === currentTile.x && y === currentTile.y);

      if (!tile) {
        row.push({
          x,
          y,
          exists: false,
          isPlayer: false,
          symbol: ' ',
          color: '#1a202c',
          label: 'Unknown'
        });
      } else {
        const terrainMeta = TERRAIN_SYMBOLS[tile.terrain] || TERRAIN_SYMBOLS.OTHER;
        row.push({
          x,
          y,
          exists: true,
          name: tile.name,
          terrain: tile.terrain,
          isPlayer,
          isPassable: tile.is_passable === 1,
          isSafe: tile.is_safe === 1,
          symbol: isPlayer ? '@' : terrainMeta.symbol,
          char: isPlayer ? '@' : terrainMeta.char,
          color: isPlayer ? '#e53e3e' : terrainMeta.color,
          label: isPlayer ? 'You are here' : `${tile.name} (${terrainMeta.label})`
        });
      }
    }
    rows.push(row);
  }

  return {
    centerX: currentTile.x,
    centerY: currentTile.y,
    rows
  };
}

/**
 * Validates whether a movement request is permitted
 */
function validateMovement(db, character, directionKey) {
  const dir = DIRECTIONS[(directionKey || '').toUpperCase()];
  if (!dir) {
    return { allowed: false, reason: `Invalid direction: ${directionKey}. Use NORTH, SOUTH, EAST, or WEST.` };
  }

  // 1. Enforce encounter lock: Cannot move if an open encounter exists
  const activeEncounter = db.prepare(`
    SELECT id FROM encounters
    WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
  `).get(character.id);

  if (activeEncounter) {
    return {
      allowed: false,
      reason: 'You must resolve the encounter (Investigate or Ignore) before traveling further!'
    };
  }

  const currentTile = getTileById(db, character.tile_id);
  if (!currentTile) {
    return { allowed: false, reason: 'Current tile not found in the world.' };
  }

  const targetX = currentTile.x + dir.dx;
  const targetY = currentTile.y + dir.dy;
  const targetTile = getTileByCoords(db, targetX, targetY);

  if (!targetTile) {
    return { allowed: false, reason: 'You stand at the edge of the world; you cannot travel further in this direction.' };
  }

  if (targetTile.is_passable === 0) {
    return { allowed: false, reason: 'The terrain is impassable (mountains or deep water block the way).' };
  }

  return {
    allowed: true,
    direction: dir.key,
    targetTile
  };
}

/**
 * Calculates the shortest passable path distance (in grid steps) from targetTile
 * to the nearest safe city haven (terrain = 'CITY' AND is_safe = 1).
 * Respects impassable terrain boundaries and valid map movement adjacency (NORTH, SOUTH, EAST, WEST).
 * Returns:
 * - 0: if targetTile is a safe city itself.
 * - number (1, 2, 3...): steps along shortest passable path.
 * - Infinity: if unreachable or targetTile is impassable.
 */
function getDistanceToNearestSafeCity(db, targetTile) {
  if (!targetTile) return Infinity;
  if (targetTile.is_passable === 0) return Infinity;

  // Safe city check
  if (targetTile.terrain === 'CITY' && targetTile.is_safe === 1) {
    return 0;
  }

  // Find all safe city origins
  const safeCities = db.prepare("SELECT id, x, y FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1").all();
  if (safeCities.length === 0) {
    return Infinity;
  }

  // Check if targetTile is in safeCities
  for (const city of safeCities) {
    if (city.id === targetTile.id || (city.x === targetTile.x && city.y === targetTile.y)) {
      return 0;
    }
  }

  // Pre-load all passable tiles into a fast coordinate map
  const passableTiles = db.prepare('SELECT id, x, y FROM map_tiles WHERE is_passable = 1').all();
  const passableCoordSet = new Set(passableTiles.map(t => `${t.x},${t.y}`));

  // Multi-source BFS starting from all safe city nodes
  const queue = [];
  const visited = new Map();

  for (const city of safeCities) {
    const key = `${city.x},${city.y}`;
    visited.set(key, 0);
    queue.push({ x: city.x, y: city.y, dist: 0 });
  }

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.x === targetTile.x && current.y === targetTile.y) {
      return current.dist;
    }

    for (const dir of Object.values(DIRECTIONS)) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nKey = `${nx},${ny}`;

      if (passableCoordSet.has(nKey) && !visited.has(nKey)) {
        visited.set(nKey, current.dist + 1);
        queue.push({ x: nx, y: ny, dist: current.dist + 1 });
      }
    }
  }

  return Infinity;
}

module.exports = {
  DIRECTIONS,
  TERRAIN_SYMBOLS,
  getTileById,
  getTileByCoords,
  getAvailableDirections,
  getMinimapData,
  validateMovement,
  getDistanceToNearestSafeCity
};
