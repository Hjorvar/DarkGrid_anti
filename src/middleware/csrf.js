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
 * Derives a deterministic, cryptographically bound CSRF token for a given session ID.
 * Using HMAC-SHA256 tied to the server's sessionSecret ensures tokens cannot be forged
 * while remaining resilient if a Cloud Run instance cold-starts between GET /login and POST /login.
 */
function deriveCsrfToken(sessionId) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`darkgrid-csrf:${sessionId}`)
    .digest('hex');
}

/**
 * Cross-Site Request Forgery (CSRF) Protection Middleware
 * Employs the Synchronizer Token Pattern tied to the server-side session (`__session` cookie).
 */
function csrfProtection(req, res, next) {
  if (!req.session) {
    return next(new Error('Session middleware must be mounted before CSRF middleware.'));
  }

  // Ensure a persistent cryptographically secure CSRF token exists for the session
  if (!req.session.csrfToken) {
    req.session.csrfToken = req.sessionID
      ? deriveCsrfToken(req.sessionID)
      : crypto.randomBytes(32).toString('hex');
  }

  const sessionToken = req.session.csrfToken;
  res.locals.csrfToken = sessionToken;

  // Safe HTTP methods do not change state
  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes((req.method || '').toUpperCase());
  if (!isStateChanging) {
    return next();
  }

  // Extract submitted token
  const submittedToken = (req.body && (req.body._csrf || req.body.csrfToken)) ||
                         req.headers['x-csrf-token'] ||
                         req.headers['csrf-token'];

  let isValid = Boolean(submittedToken) && safeCompare(sessionToken, submittedToken);

  // If the session was recreated due to a container cold start after an unauthenticated GET (e.g. GET /login),
  // verify whether the client holds a cryptographically valid server-signed `__session` cookie matching the HMAC token.
  if (!isValid && submittedToken && req.signedCookies && typeof req.signedCookies.__session === 'string') {
    const expectedFromSignedSession = deriveCsrfToken(req.signedCookies.__session);
    if (safeCompare(expectedFromSignedSession, submittedToken)) {
      isValid = true;
      req.session.csrfToken = expectedFromSignedSession;
      res.locals.csrfToken = expectedFromSignedSession;
    }
  }

  if (!isValid) {
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
  deriveCsrfToken,
  safeCompare
};
