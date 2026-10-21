/**
 * DARKGRID — Action Viewport Prototype Server (Isolated Sandbox)
 * Entrypoint & Public API Barrel (action-ui-lab/server.js).
 *
 * Architecture (Phase 2.5):
 *   - server/services/facing-service.js          : Cardinal facing, rotation & tile seed math
 *   - server/services/monster-profile-service.js : Integrated monster cutout & shadow rig profiles
 *   - server/services/sandbox-db-service.js      : Isolated SQLite initialization & hero seeding
 *   - server/services/viewport-scene-service.js  : First-person viewport & relative movement builder
 *   - server/services/combat-sequence-service.js : Multi-beat combat choreographer & snapshots
 *   - server/services/client-state-service.js    : Secrecy-compliant client state serializer
 *   - server/middleware/static-assets.js         : Static asset serving & no-store cache headers
 *   - server/controllers/state-controller.js     : GET /api/state, /api/atlas, /api/visual-qa, /api/monster-*
 *   - server/controllers/action-controller.js    : POST /api/action unified game action controller
 *   - server/routes/api-routes.js                : Express Router registration
 */

const express = require('express');

const {
  SCENE_MODES,
  POV_TIERS,
  COVERAGE_QUALITY_GRADES,
  ATMOSPHERE_EFFECT_PROFILES,
  POINTS_OF_INTEREST,
  CANDIDATE_ART_INVENTORY,
  CANDIDATE_TIER4_POOLS,
  DEFAULT_SCENE_VARIANTS,
  DEFAULT_PERSPECTIVE_VIEWS,
  DEFAULT_POV_CONTEXT_RULES,
  setCandidateArtPreviewMode,
  getCandidateArtPreviewMode,
  normalizeSceneMode,
  computeDeterministicVariantIndex,
  resolveAtmosphereEffectProfile,
  resolvePointOfInterest,
  buildWorldVisualAtlas,
  resolveTileVariant,
  resolveSceneModeA,
  resolveSceneModeB,
  resolveSceneModeC,
  resolveSceneModeLegacy
} = require('./scene-catalog');

const {
  PRESENTATION_TIERS,
  DISCOVERY_CATALOG,
  EXPEDITION_DEFINITIONS
} = require('./adventure-engine');

const {
  resolveMonsterRenderMode,
  getMonsterAssetManifest
} = require('./monster-size-catalog');

const {
  FACING_ORDER,
  FACING_VECTORS,
  normalizeFacing,
  rotateFacing,
  getRelativeCardinalMap,
  computeTileFacingSeed
} = require('./server/services/facing-service');

const {
  INTEGRATED_MONSTER_PROFILES,
  resolveMonsterIntegratedProfile
} = require('./server/services/monster-profile-service');

const {
  DEFAULT_DB_PATH,
  initSandboxDb
} = require('./server/services/sandbox-db-service');

const { registerStaticAssetsMiddleware } = require('./server/middleware/static-assets');
const { registerApiRoutes } = require('./server/routes/api-routes');

const PORT = process.env.ACTION_LAB_PORT || 3030;

function createLabApp(options = {}) {
  const { db, userId } = initSandboxDb(options.dbPath || null);
  const app = express();
  app.locals.db = db;
  app.locals.userId = userId;

  registerStaticAssetsMiddleware(app);
  registerApiRoutes(app, { db, userId, options });

  return app;
}

if (require.main === module) {
  const app = createLabApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log('===========================================================');
    console.log(' DARKGRID ACTION VIEWPORT LAB running at:');
    console.log(` -> http://localhost:${PORT}`);
    console.log(` Isolated DB: ${DEFAULT_DB_PATH}`);
    console.log('===========================================================');
  });
}

module.exports = {
  createLabApp,
  FACING_ORDER,
  FACING_VECTORS,
  normalizeFacing,
  rotateFacing,
  getRelativeCardinalMap,
  computeTileFacingSeed,
  SCENE_MODES,
  POV_TIERS,
  COVERAGE_QUALITY_GRADES,
  ATMOSPHERE_EFFECT_PROFILES,
  POINTS_OF_INTEREST,
  CANDIDATE_ART_INVENTORY,
  CANDIDATE_TIER4_POOLS,
  DEFAULT_SCENE_VARIANTS,
  DEFAULT_PERSPECTIVE_VIEWS,
  DEFAULT_POV_CONTEXT_RULES,
  setCandidateArtPreviewMode,
  getCandidateArtPreviewMode,
  INTEGRATED_MONSTER_PROFILES,
  resolveMonsterIntegratedProfile,
  resolveIntegratedMonsterProfile: resolveMonsterIntegratedProfile,
  resolveMonsterRenderMode,
  getMonsterAssetManifest,
  resolveAtmosphereEffectProfile,
  resolvePointOfInterest,
  buildWorldVisualAtlas,
  normalizeSceneMode,
  computeDeterministicVariantIndex,
  resolveTileVariant,
  resolveSceneModeA,
  resolveSceneModeB,
  resolveSceneModeC,
  resolveSceneModeLegacy,
  PRESENTATION_TIERS,
  DISCOVERY_CATALOG,
  EXPEDITION_DEFINITIONS
};
