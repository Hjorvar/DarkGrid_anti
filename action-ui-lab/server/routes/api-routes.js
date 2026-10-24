/**
 * DARKGRID ADVENTURE LAB — Express API & Page Routes
 */
const express = require('express');
const session = require('express-session');
const config = require('../../../src/config');
const { saveDurableSnapshotFile, pushDeltaToFirestoreServer } = require('../../../src/db/durable-store');
const {
  originCsrfProtection,
  authRateLimiter,
  gameRateLimiter,
  maintenanceModeGuard,
  budgetKillSwitchHandler
} = require('../../../src/middleware/security');
const { logError } = require('../../../src/utils/logger');
const { createStateControllers } = require('../controllers/state-controller');
const { createActionController } = require('../controllers/action-controller');
const { createAuthAndCharacterRoutes } = require('../controllers/auth-character-controller');
const {
  SqliteSessionStore,
  securityHeaders,
  isProductionMode,
  resolveRequestUserId,
  labAntiTamperMiddleware,
  createLabIdempotencyMiddleware
} = require('../services/legacy-compatibility-service');

function registerApiRoutes(app, { db, userId, options = {} }) {
  const router = express.Router();
  const isProd = isProductionMode(options);
  const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET || config.sessionSecret;

  if (
    isProd &&
    (!sessionSecret ||
      sessionSecret === 'darkgrid-dev-secret-change-in-prod' ||
      sessionSecret === 'darkgrid-dev-secret-key-change-in-production' ||
      String(sessionSecret).length < 16)
  ) {
    throw new Error(
      'CRITICAL SECURITY ERROR: Production mode requires a strong SESSION_SECRET (minimum 16 characters, not the default development secret).'
    );
  }

  // Lightweight health check for Cloud Run / App Hosting probes (zero DB/Firestore read cost)
  app.get(['/healthz', '/api/health'], (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'darkgrid-rpg',
      environment: config.nodeEnv
    });
  });

  // Cloud Billing Pub/Sub Hard Kill-Switch Webhook
  app.post('/internal/budget-killswitch', budgetKillSwitchHandler);

  // Security headers, Origin/CSRF protection & persistent SQLite session middleware (__session cookie)
  app.use(securityHeaders);
  app.use(originCsrfProtection);
  app.use(maintenanceModeGuard);
  app.use(
    session({
      name: '__session',
      store: new SqliteSessionStore({ getDb: () => db }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: options.secureCookies !== undefined ? options.secureCookies : (isProd ? 'auto' : false),
        maxAge: 1000 * 60 * 60 * 24 * 7
      }
    })
  );
  app.use(gameRateLimiter());

  // Durable write-through after state-changing POST requests in production / durable mode
  app.use((req, res, next) => {
    if (req.method === 'POST') {
      res.on('finish', () => {
        try {
          if (process.env.DURABLE_SNAPSHOT_PATH && db) {
            saveDurableSnapshotFile(db, process.env.DURABLE_SNAPSHOT_PATH);
          }
          if ((process.env.ENABLE_FIRESTORE_SYNC === 'true' || process.env.FIRESTORE_DURABLE_SYNC === 'true') && db) {
            pushDeltaToFirestoreServer(db).catch(err => {
              logError('FIRESTORE_SYNC_ERROR', 'Async Firestore delta sync failed', { error: err.message });
            });
          }
        } catch (err) {
          logError('DURABLE_SNAPSHOT_ERROR', 'Failed to write durable snapshot', { error: err.message });
        }
      });
    }
    next();
  });

  // Anti-tamper, auth rate-limiting, session-fixation rotation & idempotency protection
  const idempotencyGuard = createLabIdempotencyMiddleware({ db, defaultUserId: userId, options });
  const authLimiter = authRateLimiter();

  function regenerateSessionBeforeAuth(req, res, next) {
    if (!req.session || typeof req.session.regenerate !== 'function') {
      return next();
    }
    const wasLoggedOut = Boolean(req.session.loggedOut);
    req.session.regenerate((err) => {
      if (err) return next(err);
      if (wasLoggedOut && req.session) {
        req.session.loggedOut = true;
      }
      next();
    });
  }

  function conditionalActionAuthGuard(req, res, next) {
    const rawAction = String((req.body && req.body.action) || '').toUpperCase().trim();
    if (rawAction === 'LOGIN' || rawAction === 'REGISTER') {
      return authLimiter(req, res, (err) => {
        if (err) return next(err);
        return regenerateSessionBeforeAuth(req, res, next);
      });
    }
    if (rawAction === 'ENTER_DUNGEON' || rawAction === 'EXPLORE_GOBLIN_CAVE' || rawAction === 'ENTER_ANCIENT_CRYPT') {
      const effectiveUid = resolveRequestUserId(req, db, userId, options);
      if (effectiveUid) {
        const hero = db.prepare('SELECT id, tile_id FROM characters WHERE user_id = ? AND is_alive = 1 LIMIT 1').get(effectiveUid);
        if (hero) {
          const tile = db.prepare('SELECT x, y FROM map_tiles WHERE id = ?').get(hero.tile_id);
          const payload = { ...(req.body || {}), ...((req.body && req.body.payload) || {}) };
          const dungeonKey = rawAction === 'ENTER_ANCIENT_CRYPT'
            ? 'ANCIENT_CRYPT'
            : rawAction === 'EXPLORE_GOBLIN_CAVE'
              ? 'GOBLIN_CAVE'
              : String(payload.dungeonKey || 'GOBLIN_CAVE').toUpperCase();
          const requiredCoord = dungeonKey === 'ANCIENT_CRYPT' ? { x: 26, y: 5 } : { x: 9, y: 12 };
          if (!tile || Number(tile.x) !== requiredCoord.x || Number(tile.y) !== requiredCoord.y) {
            return res.status(400).json({
              ok: false,
              error: `You must be standing at the ${dungeonKey === 'ANCIENT_CRYPT' ? 'Ancient Crypt' : 'Goblin Cave'} entrance to enter this dungeon.`
            });
          }
        }
      }
    }
    return next();
  }

  router.use(labAntiTamperMiddleware);

  const stateCtrl = createStateControllers({ db, userId, options });
  const postAction = createActionController({ db, userId, options });
  const authCharCtrl = createAuthAndCharacterRoutes({ db, defaultUserId: userId, options });

  router.get('/', stateCtrl.getIndexPage);
  router.get('/favicon.ico', stateCtrl.getFavicon);
  router.get('/api/state', stateCtrl.getState);
  router.get('/api/atlas', stateCtrl.getAtlas);
  router.get('/api/visual-qa', stateCtrl.getVisualQa);
  router.get('/api/monster-manifest', stateCtrl.getMonsterManifest);
  router.get('/api/monster-scaling', stateCtrl.getMonsterScaling);
  router.get('/api/legacy-audit', authCharCtrl.getLegacyAudit);

  // Auth & Character Creation REST Endpoints
  router.get('/api/auth/session', authCharCtrl.getSession);
  router.post('/api/auth/register', authLimiter, regenerateSessionBeforeAuth, idempotencyGuard, authCharCtrl.postRegister);
  router.post('/api/auth/login', authLimiter, regenerateSessionBeforeAuth, authCharCtrl.postLogin);
  router.post('/api/auth/logout', authCharCtrl.postLogout);
  router.post('/api/character/create', idempotencyGuard, authCharCtrl.postCreateCharacter);
  router.post('/api/character/attributes/spend', idempotencyGuard, authCharCtrl.postSpendAttributePoint);

  // Unified Game Action Endpoint
  router.post('/api/action', conditionalActionAuthGuard, idempotencyGuard, postAction);

  app.use('/', router);
}

module.exports = {
  registerApiRoutes
};
