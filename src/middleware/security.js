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

const crypto = require('crypto');
const { getServerAccessToken } = require('../db/durable-store');

let budgetKillSwitchActive = false;
let requestCounterDay = new Date().toISOString().slice(0, 10);
let dailyRequestCount = 0;

async function disableProjectBillingAndLockService() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'darkgrid-rpg';
  const region = process.env.CLOUD_RUN_REGION || 'europe-west1';
  const serviceName = 'darkgrid-api';
  const token = await getServerAccessToken();
  if (!token) return { billingDisabled: false, reason: 'no_token' };

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 1. Physically detach the Cloud Billing account from the project (hard stop on all paid GCP usage)
  let billingDisabled = false;
  try {
    const billRes = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ billingAccountName: '' })
    });
    billingDisabled = billRes.ok;
  } catch {
    billingDisabled = false;
  }

  // 2. Revoke public allUsers invoker permission on Cloud Run so external traffic cannot invoke the container
  let invokerRevoked = false;
  try {
    const iamRes = await fetch(
      `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${serviceName}:setIamPolicy`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ policy: { bindings: [] } })
      }
    );
    invokerRevoked = iamRes.ok;
  } catch {
    invokerRevoked = false;
  }

  return { billingDisabled, invokerRevoked };
}

async function budgetKillSwitchHandler(req, res) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'darkgrid-rpg';
  const expectedKey =
    process.env.BUDGET_KILLSWITCH_KEY ||
    crypto.createHash('sha256').update(`darkgrid-budget-killswitch-${projectId}-v1`).digest('hex');

  if (req.query?.key !== expectedKey) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let payload = {};
  if (req.body?.message?.data) {
    try {
      const decoded = Buffer.from(req.body.message.data, 'base64').toString('utf8');
      payload = JSON.parse(decoded);
    } catch {
      payload = {};
    }
  } else if (req.body && typeof req.body === 'object') {
    payload = req.body;
  }

  const costAmount = Number(payload.costAmount ?? 0);
  const budgetAmount = Number(payload.budgetAmount ?? 25);
  const shouldKill = payload.forceKill === true || (budgetAmount > 0 && costAmount >= budgetAmount);

  logSecurity('BUDGET_ALERT_RECEIVED', 'Received Cloud Billing budget notification', {
    costAmount,
    budgetAmount,
    currencyCode: payload.currencyCode || 'USD',
    shouldKill
  });

  if (shouldKill) {
    budgetKillSwitchActive = true;
    if (req.db) {
      try {
        req.db.prepare("INSERT OR REPLACE INTO world_sync_meta (key, value, updated_at) VALUES ('maintenance_mode', '1', CURRENT_TIMESTAMP)").run();
      } catch {
        // Ignore
      }
    }
    const result = await disableProjectBillingAndLockService();
    logSecurity('BUDGET_KILLSWITCH_TRIGGERED', 'Monthly budget cap reached — billing detached and service locked', {
      costAmount,
      budgetAmount,
      ...result
    });
    return res.status(200).json({ status: 'killswitch_activated', costAmount, budgetAmount, ...result });
  }

  return res.status(200).json({ status: 'ok', costAmount, budgetAmount });
}

function maintenanceModeGuard(req, res, next) {
  if (req.path === '/healthz' || req.path === '/internal/budget-killswitch') return next();

  // Track daily requests in production to enforce hard Free-Tier Circuit Breaker (25,000 req/day)
  if (process.env.NODE_ENV !== 'test' || req.headers['x-enforce-daily-cap'] === '1') {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== requestCounterDay) {
      requestCounterDay = today;
      dailyRequestCount = 0;
    }
    dailyRequestCount += 1;
    const maxDailyRequests = req.headers['x-daily-cap-max']
      ? parseInt(req.headers['x-daily-cap-max'], 10)
      : parseInt(process.env.MAX_DAILY_HTTP_REQUESTS || '25000', 10);

    if (dailyRequestCount > maxDailyRequests) {
      logSecurity('DAILY_FREE_TIER_CAP_REACHED', 'Hard daily request cap reached — pausing traffic to guarantee $0 cost', {
        dailyRequestCount,
        maxDailyRequests
      });
      return res.status(503).send('Darkgrid is temporarily paused: Daily free-tier traffic cap reached to prevent cloud billing charges.');
    }
  }

  if (budgetKillSwitchActive) {
    return res.status(503).send('Darkgrid is offline: Monthly budget cap reached and billing kill-switch activated.');
  }

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
  maintenanceModeGuard,
  budgetKillSwitchHandler,
  disableProjectBillingAndLockService
};
