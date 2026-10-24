/**
 * DARKGRID ADVENTURE LAB — Express API & Page Routes
 */
const express = require('express');
const session = require('express-session');
const config = require('../../../src/config');
const { saveDurableSnapshotFile, pushDeltaToFirestoreServer } = require('../../../src/db/durable-store');
const {
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
  labAntiTamperMiddleware,
  createLabIdempotencyMiddleware
} = require('../services/legacy-compatibility-service');

function registerApiRoutes(app, { db, userId, options = {} }) {
  const router = express.Router();
  const isProd = isProductionMode(options);
  const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET || config.sessionSecret;

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

  // Security headers & persistent SQLite session middleware (__session cookie)
  app.use(securityHeaders);
  app.use(maintenanceModeGuard);
  app.use(gameRateLimiter());
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

  // Anti-tamper & idempotency protection for all state-mutating POST requests
  const idempotencyGuard = createLabIdempotencyMiddleware({ db, defaultUserId: userId, options });
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
  router.post('/api/auth/register', idempotencyGuard, authCharCtrl.postRegister);
  router.post('/api/auth/login', authCharCtrl.postLogin);
  router.post('/api/auth/logout', authCharCtrl.postLogout);
  router.post('/api/character/create', idempotencyGuard, authCharCtrl.postCreateCharacter);
  router.post('/api/character/attributes/spend', idempotencyGuard, authCharCtrl.postSpendAttributePoint);

  // Unified Game Action Endpoint
  router.post('/api/action', idempotencyGuard, postAction);

  app.use('/', router);
}

module.exports = {
  registerApiRoutes
};
