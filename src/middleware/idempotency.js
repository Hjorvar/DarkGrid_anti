/**
 * Darkgrid Action Idempotency & Duplicate-Request Prevention Middleware (Próf 7)
 *
 * Ensures that duplicate POST requests (e.g., double-clicking Attack, Buy, Sell, Move,
 * or network retries carrying the same `X-Idempotency-Key` or `_actionId`) are executed
 * at most once per user, replaying the original response without duplicating side effects.
 */

const { logSecurity } = require('../utils/logger');

const inFlightActions = new Set();

function ensureIdempotencyTable(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS action_idempotency_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL DEFAULT 302,
        redirect_url TEXT,
        response_body TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, idempotency_key)
      );
    `);
  } catch {
    // Ignore if read-only
  }
}

function idempotencyMiddleware(req, res, next) {
  if (req.method !== 'POST') {
    return next();
  }

  const userId = req.session?.userId;
  if (!userId || !req.db) {
    return next();
  }

  const rawKey =
    req.headers['x-idempotency-key'] ||
    (req.body && (req.body._actionId || req.body.idempotencyKey)) ||
    null;

  if (!rawKey || typeof rawKey !== 'string') {
    return next();
  }

  const idempotencyKey = rawKey.trim().slice(0, 128);
  if (!idempotencyKey) {
    return next();
  }

  ensureIdempotencyTable(req.db);

  const lockKey = `${userId}:${idempotencyKey}`;
  if (inFlightActions.has(lockKey)) {
    logSecurity('IDEMPOTENCY_DUPLICATE_BLOCKED', 'Blocked concurrent duplicate in-flight action', {
      userId,
      idempotencyKey,
      path: req.originalUrl || req.url
    });
    res.setHeader('X-Idempotent-Replay', 'true');
    return res.redirect('/game');
  }

  const existing = req.db.prepare(`
    SELECT status_code, redirect_url, response_body
    FROM action_idempotency_log
    WHERE user_id = ? AND idempotency_key = ?
  `).get(userId, idempotencyKey);

  if (existing) {
    logSecurity('IDEMPOTENCY_DUPLICATE_BLOCKED', 'Replayed cached response for duplicate action key', {
      userId,
      idempotencyKey,
      path: req.originalUrl || req.url
    });
    res.setHeader('X-Idempotent-Replay', 'true');
    if (existing.redirect_url) {
      return res.redirect(existing.redirect_url);
    }
    return res.status(existing.status_code || 200).send(existing.response_body || '');
  }

  inFlightActions.add(lockKey);

  const originalRedirect = res.redirect.bind(res);
  res.redirect = function (...args) {
    const redirectUrl = typeof args[0] === 'string' ? args[0] : args[1];
    const statusCode = typeof args[0] === 'number' ? args[0] : 302;
    try {
      req.db.prepare(`
        INSERT OR IGNORE INTO action_idempotency_log (
          user_id, idempotency_key, method, path, status_code, redirect_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, idempotencyKey, req.method, req.originalUrl || req.url, statusCode, redirectUrl || '/game', Date.now());
    } catch {
      // Ignore logging error
    } finally {
      inFlightActions.delete(lockKey);
    }
    return originalRedirect(...args);
  };

  res.on('finish', () => {
    inFlightActions.delete(lockKey);
  });
  res.on('close', () => {
    inFlightActions.delete(lockKey);
  });

  next();
}

module.exports = {
  idempotencyMiddleware
};
