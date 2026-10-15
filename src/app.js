const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const config = require('./config');
const { getDb } = require('./db/connection');
const { SqliteSessionStore } = require('./db/session-store');
const { saveDurableSnapshotFile, pushDeltaToFirestoreServer } = require('./db/durable-store');
const { attachDb } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');
const {
  securityHeaders,
  antiTamperProtection,
  gameRateLimiter,
  maintenanceModeGuard
} = require('./middleware/security');
const { idempotencyMiddleware } = require('./middleware/idempotency');
const { logError } = require('./utils/logger');

const authRoutes = require('./routes/auth');
const characterRoutes = require('./routes/character');
const gameRoutes = require('./routes/game');

const app = express();

// Trust first proxy (required for secure session cookies behind Cloud Run / Firebase App Hosting)
app.set('trust proxy', 1);

// Standard HTTP security headers
app.use(securityHeaders);

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Lightweight health check for Cloud Run / App Hosting probes (zero DB/Firestore read cost)
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'darkgrid-rpg',
    environment: config.nodeEnv
  });
});

// Default view locals
app.use((req, res, next) => {
  res.locals.currentUser = null;
  res.locals.csrfToken = '';
  next();
});

// Restrict development/internal inspection pages from public access (M7)
app.use((req, res, next) => {
  if (req.path === '/monster_review.html' || req.path === '/monster_comparison.html') {
    if (config.nodeEnv !== 'development') {
      return res.status(404).render('error', {
        title: '404 - Not Found',
        message: 'The page or path you sought does not exist in Darkgrid.'
      });
    }
  }
  next();
});

// Static assets
app.use(express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.join(__dirname, '../images')));

// Request parsing with safe payload size limits
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

// Attach database connection to req
app.use(attachDb);

// Persistent SQLite-backed server-side session store (survives server restarts)
const sessionStore = new SqliteSessionStore(() => getDb());
app.use(
  session({
    store: sessionStore,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

// Pass session user to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session?.userId ? {
    id: req.session.userId,
    username: req.session.username
  } : null;
  next();
});

// Maintenance window guard, rate limiting, and anti-tamper validation
app.use(maintenanceModeGuard);
app.use(gameRateLimiter());
app.use(antiTamperProtection);

// Enforce CSRF protection across all state-changing requests
app.use(csrfProtection);

// Prevent duplicate action execution on double-click / retried POSTs (Próf 7)
app.use(idempotencyMiddleware);

// Durable write-through after state-changing requests in production / durable mode
app.use((req, res, next) => {
  if (req.method === 'POST') {
    res.on('finish', () => {
      try {
        if (process.env.DURABLE_SNAPSHOT_PATH && req.db) {
          saveDurableSnapshotFile(req.db, process.env.DURABLE_SNAPSHOT_PATH);
        }
        if ((process.env.ENABLE_FIRESTORE_SYNC === 'true' || process.env.FIRESTORE_DURABLE_SYNC === 'true') && req.db) {
          pushDeltaToFirestoreServer(req.db).catch(err => {
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

// Mount routes
app.use('/', authRoutes);
app.use('/character', characterRoutes);
app.use('/', gameRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Not Found',
    message: 'The page or path you sought does not exist in Darkgrid.'
  });
});

// Central error handler
app.use((err, req, res, next) => {
  logError('UNHANDLED_ROUTE_ERROR', err.message || 'Unhandled server error', {
    status: err.status || 500,
    path: req.originalUrl || req.url
  });
  const status = err.status || 500;

  // Sanitize internal database / engine errors so SQL/internal stack details are not leaked (M3)
  let userFacingMessage = err.message || 'An unexpected error occurred in the darkness.';
  if (status >= 500 || err.name === 'SqliteError' || (err.message && (err.message.includes('SqliteError') || err.message.includes('UNIQUE constraint')))) {
    userFacingMessage = 'An unexpected internal error occurred. Please try again.';
  }

  res.status(status).render('error', {
    title: `Error (${status})`,
    message: userFacingMessage
  });
});

module.exports = app;

