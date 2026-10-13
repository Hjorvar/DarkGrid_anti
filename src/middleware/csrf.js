const crypto = require('crypto');
const config = require('../config');

/**
 * Validates strings in constant time to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Cross-Site Request Forgery (CSRF) Protection Middleware
 * Employs the Synchronizer Token Pattern tied to the server-side session.
 */
function csrfProtection(req, res, next) {
  if (!req.session) {
    return next(new Error('Session middleware must be mounted before CSRF middleware.'));
  }

  // Ensure a persistent cryptographically secure CSRF token exists for the session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  const sessionToken = req.session.csrfToken;
  res.locals.csrfToken = sessionToken;

  // Set readable cookie for SPA or script requests
  res.cookie('XSRF-TOKEN', sessionToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  });

  // Safe HTTP methods do not change state
  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes((req.method || '').toUpperCase());
  if (!isStateChanging) {
    return next();
  }

  // Extract submitted token
  const submittedToken = (req.body && (req.body._csrf || req.body.csrfToken)) ||
                         req.headers['x-csrf-token'] ||
                         req.headers['csrf-token'];

  if (!submittedToken || !safeCompare(sessionToken, submittedToken)) {
    console.warn(`[Security] CSRF validation failed for ${req.method} ${req.originalUrl || req.url} from user ${req.session?.userId || 'anonymous'}`);
    
    if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or missing CSRF token.'
      });
    }

    return res.status(403).render('error', {
      title: '403 - Forbidden',
      message: 'Cross-Site Request Forgery (CSRF) validation failed. Your action was safely blocked.'
    });
  }

  next();
}

module.exports = {
  csrfProtection,
  safeCompare
};
