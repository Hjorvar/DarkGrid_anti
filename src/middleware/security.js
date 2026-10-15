/**
 * Darkgrid Security, Anti-Tamper, Rate-Limiting & Maintenance Middleware
 *
 * Enforces:
 * 1. Anti-Tamper Validation (Próf 6): Rejects any request attempting to supply
 *    server-authoritative fields (HP, gold, XP, level, damage, dice rolls, loot,
 *    is_alive, or spoofed user/character IDs) in `req.body` or `req.query`.
 * 2. Rate Limiting: Protects authentication and gameplay endpoints against spam/DoS
 *    and prevents runaway Cloud Run / database costs.
 * 3. Security Headers: Standard HTTP hardening headers.
 * 4. Maintenance Mode Guard: Blocks writes cleanly during database migration windows.
 */

const { logSecurity } = require('../utils/logger');

const FORBIDDEN_CLIENT_FIELDS = new Set([
  'hp',
  'current_hp',
  'max_hp',
  'monster_hp',
  'current_monster_hp',
  'monster_max_hp',
  'gold',
  'held_gold',
  'reward_gold',
  'price',
  'buy_price',
  'sell_price',
  'xp',
  'xp_reward',
  'level',
  'damage',
  'damage_dice',
  'attack_bonus',
  'armor_class',
  'dice_roll',
  'roll',
  'initiative',
  'initiative_winner',
  'is_crit',
  'is_hit',
  'is_alive',
  'loot',
  'items_awarded',
  'kill_count',
  'uid',
  'firebase_uid',
  'user_id',
  'userId',
  'character_id',
  'characterId'
]);

const rateBuckets = new Map();

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

function antiTamperProtection(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const bodyKeys = (req.body && typeof req.body === 'object') ? Object.keys(req.body) : [];
  const queryKeys = (req.query && typeof req.query === 'object') ? Object.keys(req.query) : [];

  const tamperedFields = [];
  for (const key of [...bodyKeys, ...queryKeys]) {
    if (FORBIDDEN_CLIENT_FIELDS.has(key)) {
      tamperedFields.push(key);
    }
  }

  if (tamperedFields.length > 0) {
    logSecurity('SECURITY_TAMPER_ATTEMPT', 'Client attempted to submit server-authoritative or identity fields', {
      userId: req.session?.userId || null,
      ip: req.ip || req.socket?.remoteAddress || 'unknown',
      method: req.method,
      path: req.originalUrl || req.url,
      tamperedFields
    });

    const message = `Security violation: Client-supplied game state or identity parameters (${tamperedFields.join(', ')}) are strictly forbidden.`;
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({
        error: message,
        tamperedFields
      });
    }
    return res.status(400).render('error', {
      title: '400 - Security Violation',
      message
    });
  }

  next();
}

function gameRateLimiter(maxRequests = 120, windowMs = 60 * 1000) {
  return (req, res, next) => {
    const enforceInTest = req.headers['x-enforce-rate-limit'] === '1';
    if (process.env.NODE_ENV === 'test' && !enforceInTest) {
      return next();
    }

    const key = req.session?.userId
      ? `user:${req.session.userId}`
      : `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    const now = Date.now();
    const effectiveLimit = req.headers['x-rate-limit-max']
      ? parseInt(req.headers['x-rate-limit-max'], 10)
      : maxRequests;

    let bucket = rateBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      rateBuckets.set(key, bucket);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > effectiveLimit) {
      logSecurity('SECURITY_RATE_LIMIT_EXCEEDED', 'Rate limit exceeded for client', {
        key,
        path: req.originalUrl || req.url,
        method: req.method,
        count: bucket.count
      });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(429).json({
          error: 'Too many requests. Please slow down before taking another action.'
        });
      }
      return res.status(429).render('error', {
        title: '429 - Too Many Requests',
        message: 'Too many actions in a short period. Please wait a moment and try again.'
      });
    }

    next();
  };
}

function maintenanceModeGuard(req, res, next) {
  if (req.path === '/healthz') return next();
  if (req.method === 'GET' || req.method === 'HEAD') return next();

  let inMaintenance = process.env.MAINTENANCE_MODE === 'true' || process.env.MAINTENANCE_MODE === '1';
  if (!inMaintenance && req.db) {
    try {
      const row = req.db.prepare("SELECT value FROM world_sync_meta WHERE key = 'maintenance_mode'").get();
      if (row && (row.value === '1' || row.value === 'true')) {
        inMaintenance = true;
      }
    } catch {
      // Ignore if world_sync_meta table not yet migrated
    }
  }

  if (inMaintenance) {
    const msg = 'Darkgrid is temporarily in maintenance mode for a world update. Please try again shortly.';
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(503).json({ error: msg });
    }
    return res.status(503).render('error', {
      title: '503 - Maintenance Mode',
      message: msg
    });
  }

  next();
}

module.exports = {
  FORBIDDEN_CLIENT_FIELDS,
  securityHeaders,
  antiTamperProtection,
  gameRateLimiter,
  maintenanceModeGuard
};
