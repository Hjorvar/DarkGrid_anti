const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../domain/auth/service');

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null, success: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await loginUser(req.db, username, password);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
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

router.post('/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  try {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    const user = await registerUser(req.db, username, password);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
  } catch (err) {
    res.status(err.status || 400).render('register', {
      error: err.message,
      username
    });
  }
});

router.all('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
