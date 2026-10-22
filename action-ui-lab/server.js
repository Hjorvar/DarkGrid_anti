/**
 * DARKGRID — Action Viewport Prototype Server (Isolated Sandbox & Phase 6 Legacy Integration)
 * Entrypoint & Public API Barrel (action-ui-lab/server.js).
 *
 * Architecture (Phases 2.5 – 6):
 *   - server/services/facing-service.js               : Cardinal facing, rotation & tile seed math
 *   - server/services/monster-profile-service.js      : Integrated monster cutout & shadow rig profiles
 *   - server/services/sandbox-db-service.js           : Isolated SQLite initialization & hero seeding
 *   - server/services/legacy-compatibility-service.js : Non-destructive schema adapter, sessions, anti-tamper & idempotency
 *   - server/services/viewport-scene-service.js       : First-person viewport & relative movement builder
 *   - server/services/combat-sequence-service.js      : Multi-beat combat choreographer & snapshots
 *   - server/services/client-state-service.js         : Secrecy-compliant client state serializer
 *   - server/middleware/static-assets.js              : Static asset serving & no-store cache headers
 *   - server/controllers/state-controller.js          : GET /api/state, /api/atlas, /api/visual-qa, /api/monster-*
 *   - server/controllers/auth-character-controller.js : Auth (/api/auth/*), character creation & legacy audit
 *   - server/controllers/action-controller.js         : POST /api/action unified game action controller
 *   - server/routes/api-routes.js                     : Express Router registration
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
  setCandidateArtApprovalStatus,
  getCandidateArtApprovalStatus,
  resetCandidateArtApprovalStatus,
  evaluateWorldArtAudit,
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

const config = require('../src/config');
const {
  FAVORED_ENEMY_OPTIONS,
  isProductionMode,
  isAuthRequired,
  isLabToolsAllowedForUser,
  ensureNonDestructiveLabAdapter,
  verifyLegacyDatabaseCompatibility
} = require('./server/services/legacy-compatibility-service');

const { registerStaticAssetsMiddleware } = require('./server/middleware/static-assets');
const { registerApiRoutes } = require('./server/routes/api-routes');

const PORT = process.env.ACTION_LAB_PORT || 3030;

function createLabApp(options = {}) {
  const isProd = isProductionMode(options);
  const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET || config.sessionSecret;
  if (isProd && (!sessionSecret || sessionSecret === 'darkgrid-dev-secret-key-change-in-production' || String(sessionSecret).length < 16)) {
    throw new Error('Production security error: A strong SESSION_SECRET (minimum 16 characters, not the default development secret) is required in production.');
  }

  const { db, userId } = initSandboxDb(options.dbPath || null, options);
  const app = express();
  app.set('trust proxy', 1);
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
  setCandidateArtApprovalStatus,
  getCandidateArtApprovalStatus,
  resetCandidateArtApprovalStatus,
  evaluateWorldArtAudit,
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
  EXPEDITION_DEFINITIONS,
  FAVORED_ENEMY_OPTIONS,
  ensureNonDestructiveLabAdapter,
  verifyLegacyDatabaseCompatibility
};
