/**
 * DARKGRID ADVENTURE LAB — Static Asset & Body Parser Middleware
 * Serves read-only game art, modular CSS/JS assets with no-store headers,
 * and backward-compatible virtual bundles for /lab-assets/action-ui.css & /lab-assets/action-ui.js.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const LAB_ROOT = path.join(__dirname, '../..');
const PUBLIC_DIR = path.join(LAB_ROOT, 'public');

const CSS_MODULE_ORDER = [
  'base.css',
  'layout.css',
  'character.css',
  'world.css',
  'combat.css',
  'inventory.css',
  'components.css',
  'responsive.css'
];

function registerStaticAssetsMiddleware(app) {
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));

  // Serve existing static assets (monster art, terrain art, base CSS) read-only
  app.use('/images', express.static(path.join(LAB_ROOT, '../public/images')));
  app.use('/images', express.static(path.join(LAB_ROOT, '../images')));
  app.use('/base-css', express.static(path.join(LAB_ROOT, '../public/css')));

  app.get('/lab-assets/monster-size-catalog.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile('monster-size-catalog.js', { root: LAB_ROOT, dotfiles: 'allow' });
  });

  // Compatibility endpoint for legacy tests fetching /lab-assets/action-ui.css
  app.get('/lab-assets/action-ui.css', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    const combined = CSS_MODULE_ORDER
      .map(name => {
        const p = path.join(PUBLIC_DIR, 'css', name);
        return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
      })
      .join('\n\n');
    res.send(combined);
  });

  // Compatibility endpoint for legacy tests fetching /lab-assets/action-ui.js
  app.get('/lab-assets/action-ui.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    const appJsPath = path.join(PUBLIC_DIR, 'js', 'app.js');
    res.sendFile(appJsPath, { dotfiles: 'allow' });
  });

  app.use('/lab-assets', (req, res, next) => {
    if (req.path.startsWith('/images/')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    next();
  }, express.static(PUBLIC_DIR));
}

module.exports = {
  registerStaticAssetsMiddleware,
  CSS_MODULE_ORDER
};
