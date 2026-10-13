const path = require('path');

const DEFAULT_FALLBACK_ARTWORK = {
  id: 0,
  terrain_type: 'FALLBACK',
  location_key: null,
  tile_id: null,
  image_path: 'images/terrain/terrain_fallback.webp',
  alt_text: 'Atmospheric dark fantasy wilderness vista.',
  title: 'Darkgrid Realm',
  description: 'The dangerous and atmospheric wilderness of the Darkgrid realm.',
  is_active: 1
};

/**
 * Normalizes an image path to a clean, web-safe relative path with a leading slash.
 * Guards against path traversal and malicious strings.
 */
function normalizeImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return '/images/terrain/terrain_fallback.webp';
  }
  // Remove dangerous characters and path traversal attempts
  const cleaned = imagePath.replace(/\\/g, '/').replace(/\.\./g, '').trim();
  const withoutLeadingSlash = cleaned.replace(/^\/+/, '');
  return `/${withoutLeadingSlash}`;
}

/**
 * Resolves the appropriate terrain artwork for a given map tile following the priority:
 * 1. Location-specific override by exact tile_id
 * 2. Location-specific override by location_key (matching tile.feature or tile.name)
 * 3. Default artwork for tile.terrain
 * 4. Database fallback artwork (terrain_type = 'FALLBACK')
 * 5. Code-level default fallback
 *
 * @param {object} db - SQLite database connection
 * @param {object} tile - Map tile record (id, terrain, feature, name)
 * @returns {object} Resolved artwork metadata with web-ready imageUrl
 */
function getTerrainArtworkForTile(db, tile) {
  if (!tile || typeof tile !== 'object') {
    return formatArtworkResult(DEFAULT_FALLBACK_ARTWORK, false, 'FALLBACK');
  }

  // 1. Exact tile_id override
  if (tile.id) {
    const tileOverride = db.prepare(`
      SELECT * FROM terrain_artworks
      WHERE tile_id = ? AND is_active = 1
      LIMIT 1
    `).get(tile.id);

    if (tileOverride) {
      return formatArtworkResult(tileOverride, true, 'TILE_OVERRIDE');
    }
  }

  // 2. Location key override (matches tile.feature or tile.location_key if defined)
  if (tile.feature) {
    const featureOverride = db.prepare(`
      SELECT * FROM terrain_artworks
      WHERE location_key = ? AND is_active = 1
      LIMIT 1
    `).get(tile.feature);

    if (featureOverride) {
      return formatArtworkResult(featureOverride, true, 'LOCATION_OVERRIDE');
    }
  }

  // 3. Terrain default
  if (tile.terrain) {
    const terrainDefault = db.prepare(`
      SELECT * FROM terrain_artworks
      WHERE terrain_type = ? AND location_key IS NULL AND tile_id IS NULL AND is_active = 1
      LIMIT 1
    `).get(tile.terrain);

    if (terrainDefault) {
      return formatArtworkResult(terrainDefault, false, 'TERRAIN_DEFAULT');
    }
  }

  // 4. Database fallback entry
  const dbFallback = db.prepare(`
    SELECT * FROM terrain_artworks
    WHERE terrain_type = 'FALLBACK' AND is_active = 1
    LIMIT 1
  `).get();

  if (dbFallback) {
    return formatArtworkResult(dbFallback, false, 'DB_FALLBACK');
  }

  // 5. Code-level fallback
  return formatArtworkResult(DEFAULT_FALLBACK_ARTWORK, false, 'CODE_FALLBACK');
}

/**
 * Formats raw database artwork record into a consistent view-ready object.
 */
function formatArtworkResult(rawArtwork, isOverride, matchSource) {
  return {
    id: rawArtwork.id || 0,
    terrainType: rawArtwork.terrain_type || 'UNKNOWN',
    locationKey: rawArtwork.location_key || null,
    tileId: rawArtwork.tile_id || null,
    imageUrl: normalizeImageUrl(rawArtwork.image_path),
    rawPath: rawArtwork.image_path,
    altText: rawArtwork.alt_text || 'Darkgrid environment landscape',
    title: rawArtwork.title || 'Darkgrid Wilderness',
    description: rawArtwork.description || '',
    isOverride: Boolean(isOverride),
    matchSource,
    isActive: Boolean(rawArtwork.is_active)
  };
}

/**
 * Fetches all active terrain artworks from the database.
 */
function getAllActiveTerrainArtworks(db) {
  const rows = db.prepare(`
    SELECT * FROM terrain_artworks
    WHERE is_active = 1
    ORDER BY id ASC
  `).all();

  return rows.map(r => formatArtworkResult(r, Boolean(r.location_key || r.tile_id), 'ACTIVE_LIST'));
}

/**
 * Fetches a single terrain artwork by ID.
 */
function getTerrainArtworkById(db, id) {
  const row = db.prepare('SELECT * FROM terrain_artworks WHERE id = ?').get(id);
  if (!row) return null;
  return formatArtworkResult(row, Boolean(row.location_key || row.tile_id), 'DIRECT_ID');
}

module.exports = {
  DEFAULT_FALLBACK_ARTWORK,
  normalizeImageUrl,
  getTerrainArtworkForTile,
  getAllActiveTerrainArtworks,
  getTerrainArtworkById
};
