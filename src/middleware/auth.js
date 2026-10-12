const { getDb } = require('../db/connection');
const { getUserById } = require('../domain/auth/service');

function attachDb(req, res, next) {
  req.db = getDb();
  next();
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }
    return res.redirect('/login');
  }

  const user = getUserById(req.db, req.session.userId);
  if (!user) {
    req.session.destroy();
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
