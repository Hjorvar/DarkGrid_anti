const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const config = require('./config');
const { attachDb } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');

const authRoutes = require('./routes/auth');
const characterRoutes = require('./routes/character');
const gameRoutes = require('./routes/game');

const app = express();

// Trust first proxy (required for secure session cookies behind Cloud Run / Firebase App Hosting)
app.set('trust proxy', 1);

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

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

// Request parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Server-side session
app.use(
  session({
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

// Attach database connection to req
app.use(attachDb);

// Pass session user to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session?.userId ? {
    id: req.session.userId,
    username: req.session.username
  } : null;
  next();
});

// Enforce CSRF protection across all state-changing requests
app.use(csrfProtection);

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
  console.error('[Error]', err);
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
