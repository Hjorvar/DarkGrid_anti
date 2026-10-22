/**
 * DARKGRID ADVENTURE LAB — First-Person Viewport Scene & Relative Movement Builder
 */
const {
  getTileByCoords,
  validateMovement
} = require('../../../src/domain/world/map');
const { getTerrainArtworkForTile } = require('../../../src/domain/world/artwork');
const {
  DEFAULT_PERSPECTIVE_VIEWS,
  DEFAULT_POV_CONTEXT_RULES,
  normalizeSceneMode,
  resolveAtmosphereEffectProfile,
  resolvePointOfInterest,
  resolveTileVariant,
  resolveSceneModeA,
  resolveSceneModeB,
  resolveSceneModeC,
  resolveSceneModeLegacy
} = require('../../scene-catalog');
const {
  FACING_VECTORS,
  normalizeFacing,
  getRelativeCardinalMap,
  computeTileFacingSeed
} = require('./facing-service');

function inspectSceneTile(db, tx, ty, cardinalDirection = null) {
  const tile = getTileByCoords(db, tx, ty);
  if (!tile) {
    const voidVariant = resolveTileVariant(db, { x: tx, y: ty, terrain: 'VOID', feature: null });
    return {
      exists: false,
      x: tx,
      y: ty,
      direction: cardinalDirection,
      name: 'Edge of the World',
      terrain: 'VOID',
      feature: null,
      description: 'An impassable abyss at the edge of the known realm.',
      isPassable: false,
      isSafe: false,
      artworkUrl: '/images/terrain/terrain_mountains.webp',
      imageUrl: voidVariant.imageUrl,
      legacyImageUrl: '/images/terrain/terrain_mountains.webp',
      variant: voidVariant,
      obstacleType: 'WORLD_EDGE',
      hasPersistentThreat: false
    };
  }

  const art = getTerrainArtworkForTile(db, tile);
  const legacyUrl = art ? art.imageUrl : '/images/terrain/terrain_fallback.webp';
  const variant = resolveTileVariant(db, tile);
  const resolvedUrl = variant && variant.imageUrl ? variant.imageUrl : legacyUrl;

  const persistent = db.prepare(
    "SELECT id, kill_count, custom_title FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'"
  ).get(tile.id);

  let obstacleType = null;
  if (tile.is_passable === 0) {
    if (tile.terrain === 'MOUNTAINS') obstacleType = 'MOUNTAINS';
    else if (tile.terrain === 'RIVER_LAKE') obstacleType = 'RIVER';
    else if (tile.terrain === 'OCEAN' || tile.terrain === 'AQUATIC') obstacleType = 'OCEAN';
    else if (tile.terrain === 'SWAMP') obstacleType = 'MIRE';
    else obstacleType = 'WALL';
  }

  return {
    exists: true,
    id: tile.id,
    x: tile.x,
    y: tile.y,
    direction: cardinalDirection,
    name: tile.name,
    terrain: tile.terrain,
    feature: tile.feature || null,
    description: tile.description || '',
    isPassable: tile.is_passable === 1,
    isSafe: tile.is_safe === 1,
    artworkUrl: resolvedUrl,
    imageUrl: resolvedUrl,
    legacyImageUrl: legacyUrl,
    variant,
    obstacleType,
    hasPersistentThreat: Boolean(persistent)
  };
}

function buildViewportScene(db, currentTile, facing, directions, activeEncounter, sceneMode = 'C', options = {}) {
  const normFacing = normalizeFacing(facing);
  const normSceneMode = normalizeSceneMode(sceneMode);
  const relMap = getRelativeCardinalMap(normFacing);

  const fVec = FACING_VECTORS[relMap.FORWARD];
  const lVec = FACING_VECTORS[relMap.STRAFE_LEFT];
  const rVec = FACING_VECTORS[relMap.STRAFE_RIGHT];
  const bVec = FACING_VECTORS[relMap.BACKWARD];

  const current = inspectSceneTile(db, currentTile.x, currentTile.y, normFacing);
  const ahead1 = inspectSceneTile(db, currentTile.x + fVec.dx, currentTile.y + fVec.dy, relMap.FORWARD);
  const ahead2 = inspectSceneTile(db, currentTile.x + 2 * fVec.dx, currentTile.y + 2 * fVec.dy, relMap.FORWARD);
  const left1 = inspectSceneTile(db, currentTile.x + lVec.dx, currentTile.y + lVec.dy, relMap.STRAFE_LEFT);
  const right1 = inspectSceneTile(db, currentTile.x + rVec.dx, currentTile.y + rVec.dy, relMap.STRAFE_RIGHT);
  const aheadLeft = inspectSceneTile(db, currentTile.x + fVec.dx + lVec.dx, currentTile.y + fVec.dy + lVec.dy, relMap.STRAFE_LEFT);
  const aheadRight = inspectSceneTile(db, currentTile.x + fVec.dx + rVec.dx, currentTile.y + fVec.dy + rVec.dy, relMap.STRAFE_RIGHT);
  const behind1 = inspectSceneTile(db, currentTile.x + bVec.dx, currentTile.y + bVec.dy, relMap.BACKWARD);

  const seed = computeTileFacingSeed(currentTile.x, currentTile.y, normFacing);
  const aheadSeed = computeTileFacingSeed(ahead1.x, ahead1.y, normFacing);

  const isAheadBlocked = !ahead1.isPassable;
  const isTerrainTransitionAhead = Boolean(
    ahead1.exists &&
    (ahead1.terrain !== current.terrain || ahead1.feature !== current.feature || ahead1.imageUrl !== current.imageUrl)
  );

  // Determine if movement is locked by active combat or ambush
  const isInCombat = Boolean(activeEncounter && activeEncounter.status === 'IN_COMBAT');

  // Resolve all four implementations so the UI can compare Mode A, Mode B, Mode C, and Legacy seamlessly
  const sceneA = resolveSceneModeA(db, current, ahead1, left1, right1, normFacing, seed, isInCombat);
  const sceneB = resolveSceneModeB(db, current, ahead1, left1, right1, normFacing, seed);
  const sceneC = resolveSceneModeC(db, current, ahead1, left1, right1, normFacing, seed, isInCombat, behind1, options);
  const sceneLegacy = resolveSceneModeLegacy(current, ahead1, normFacing, isTerrainTransitionAhead, isAheadBlocked);
  const scenes = {
    A: sceneA,
    B: sceneB,
    C: sceneC,
    LEGACY: sceneLegacy
  };
  const activeScene = scenes[normSceneMode] || sceneC;

  // Phase 3 & Phase 4: Resolve Data-Driven Atmospheric Effect Profile & Point of Interest
  const effectProfile = resolveAtmosphereEffectProfile(activeScene.atmosphereProfile, current, ahead1, normFacing);
  const pointOfInterest = isInCombat ? null : resolvePointOfInterest(current, ahead1, normFacing);
  for (const sc of Object.values(scenes)) {
    if (sc) {
      sc.effectProfile = resolveAtmosphereEffectProfile(sc.atmosphereProfile, current, ahead1, normFacing);
      sc.pointOfInterest = pointOfInterest;
    }
  }

  // Preload URLs for opposite/adjacent perspective views so 90°/180° turns and steps are instantaneous
  const preloadUrls = Array.from(new Set([
    ...DEFAULT_PERSPECTIVE_VIEWS.map(p => p.image_path),
    ...DEFAULT_POV_CONTEXT_RULES.map(r => r.image_path)
  ]));

  const isAmbushLocked = Boolean(
    activeEncounter &&
    activeEncounter.status === 'DISCOVERED' &&
    (activeEncounter.isAmbush || Number(activeEncounter.is_ambush) === 1)
  );
  const isBypassMoveAllowed = Boolean(
    activeEncounter &&
    activeEncounter.status === 'DISCOVERED' &&
    !isAmbushLocked
  );

  function buildRelativeMoveInfo(relativeKey, cardinalDir) {
    const dirInfo = directions[cardinalDir] || { available: false, reason: 'Unavailable' };
    const dirMeta = FACING_VECTORS[cardinalDir];
    const terrainPassable = Boolean(dirInfo.available);

    let available = terrainPassable && !isInCombat && !isAmbushLocked;
    let reason = dirInfo.reason || '';

    if (isInCombat) {
      available = false;
      reason = 'Engaged in combat — fight or flee!';
    } else if (isAmbushLocked) {
      available = false;
      reason = 'Ambush! Your retreat is cut off — face the threat!';
    } else if (!terrainPassable) {
      available = false;
      reason = dirInfo.reason || 'Impassable terrain';
    } else if (isBypassMoveAllowed) {
      reason = `Bypass threat & move ${dirMeta.label} to ${dirInfo.tileName}`;
    } else {
      reason = `Move ${dirMeta.label} to ${dirInfo.tileName} (${dirInfo.terrain})`;
    }

    return {
      relativeKey,
      cardinal: cardinalDir,
      cardinalLabel: dirMeta.label,
      cardinalShort: dirMeta.short,
      available,
      terrainPassable,
      willBypassThreat: Boolean(available && isBypassMoveAllowed),
      tileName: dirInfo.tileName || (dirInfo.reason || 'Blocked'),
      terrain: dirInfo.terrain || null,
      reason
    };
  }

  const relativeMoves = {
    FORWARD: buildRelativeMoveInfo('FORWARD', relMap.FORWARD),
    BACKWARD: buildRelativeMoveInfo('BACKWARD', relMap.BACKWARD),
    STRAFE_LEFT: buildRelativeMoveInfo('STRAFE_LEFT', relMap.STRAFE_LEFT),
    STRAFE_RIGHT: buildRelativeMoveInfo('STRAFE_RIGHT', relMap.STRAFE_RIGHT)
  };

  return {
    facing: normFacing,
    facingMeta: FACING_VECTORS[normFacing],
    sceneMode: normSceneMode,
    sceneKey: activeScene ? activeScene.variantKey : null,
    artApprovalStatus: activeScene ? activeScene.artApprovalStatus : 'APPROVED',
    candidateArtId: activeScene && activeScene.candidatePreview ? activeScene.candidatePreview.id : null,
    activeScene,
    scenes,
    effectProfile,
    pointOfInterest,
    preloadUrls,
    seed,
    aheadSeed,
    current,
    ahead1,
    ahead2,
    left1,
    right1,
    aheadLeft,
    aheadRight,
    behind1,
    isAheadBlocked,
    isTerrainTransitionAhead,
    relativeMoves
  };
}

module.exports = {
  inspectSceneTile,
  buildViewportScene
};
