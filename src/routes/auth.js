const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../domain/auth/service');
const { deriveCsrfToken } = require('../middleware/csrf');

// Lightweight in-memory rate limiter for auth endpoints (M3)
const authAttempts = new Map();
function authRateLimiter(maxAttempts = 15, windowMs = 60 * 1000) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const record = authAttempts.get(ip);
    if (record && now < record.resetAt) {
      if (record.count >= maxAttempts) {
        return res.status(429).render('error', {
          title: 'Too Many Requests (429)',
          message: 'Too many authentication attempts. Please wait a minute and try again.'
        });
      }
      record.count++;
    } else {
      authAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    }
    next();
  };
}

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null, success: null });
});

router.post('/login', authRateLimiter(), async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await loginUser(req.db, username, password, {
      allowFirebaseFallback: process.env.NODE_ENV === 'production'
    });
    if (req.session && typeof req.session.regenerate === 'function') {
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
        }
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.csrfToken = deriveCsrfToken(req.sessionID);
        req.session.save(() => {
          res.redirect('/');
        });
      });
    } else {
      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/');
    }
  } catch (err) {
    res.status(err.status || 400).render('login', {
      error: err.message,
      success: null,
      username
    });
  }
});

router.get('/register', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.render('register', { error: null, username: '' });
});

router.post('/register', authRateLimiter(), async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  try {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    const user = await registerUser(req.db, username, password);
    if (req.session && typeof req.session.regenerate === 'function') {
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
        }
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.csrfToken = deriveCsrfToken(req.sessionID);
        req.session.save(() => {
          res.redirect('/');
        });
      });
    } else {
      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/');
    }
  } catch (err) {
    res.status(err.status || 400).render('register', {
      error: err.message,
      username
    });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('__session');
    res.redirect('/login');
  });
});

router.get('/logout', (req, res) => {
  res.redirect('/');
});

module.exports = router;
