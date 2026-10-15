const { getDb } = require('../db/connection');
const { getUserById } = require('../domain/auth/service');
const { verifyFirebaseIdToken } = require('../firebase/token-verifier');
const { uidToNumericId } = require('../db/durable-store');
const { logSecurity } = require('../utils/logger');

function attachDb(req, res, next) {
  req.db = getDb();
  next();
}

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const verified = await verifyFirebaseIdToken(token);
        const numericId = uidToNumericId(verified.uid);
        let user = getUserById(req.db, numericId);
        if (!user && verified.username) {
          req.db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)')
            .run(numericId, verified.username, 'firebase-auth');
          user = getUserById(req.db, numericId);
        }
        if (user) {
          if (req.session) {
            req.session.userId = user.id;
            req.session.username = user.username;
          }
          req.user = user;
          res.locals.currentUser = user;
          return next();
        }
      } catch (err) {
        logSecurity('SECURITY_INVALID_BEARER_TOKEN', 'Rejected invalid Firebase Bearer token', {
          path: req.originalUrl || req.url,
          reason: err.message
        });
        return res.status(401).json({ error: 'Invalid or expired authentication token.' });
      }
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }
    return res.redirect('/login');
  }

  const user = getUserById(req.db, req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.redirect('/login');
  }

  req.user = user;
  res.locals.currentUser = user;
  next();
}

module.exports = {
  attachDb,
  requireAuth
};

