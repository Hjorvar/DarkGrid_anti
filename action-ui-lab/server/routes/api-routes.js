/**
 * DARKGRID ADVENTURE LAB — Express API & Page Routes
 */
const express = require('express');
const { createStateControllers } = require('../controllers/state-controller');
const { createActionController } = require('../controllers/action-controller');

function registerApiRoutes(app, { db, userId, options = {} }) {
  const router = express.Router();
  const stateCtrl = createStateControllers({ db, userId });
  const postAction = createActionController({ db, userId, options });

  router.get('/', stateCtrl.getIndexPage);
  router.get('/favicon.ico', stateCtrl.getFavicon);
  router.get('/api/state', stateCtrl.getState);
  router.get('/api/atlas', stateCtrl.getAtlas);
  router.get('/api/visual-qa', stateCtrl.getVisualQa);
  router.get('/api/monster-manifest', stateCtrl.getMonsterManifest);
  router.get('/api/monster-scaling', stateCtrl.getMonsterScaling);
  router.post('/api/action', postAction);

  app.use('/', router);
}

module.exports = {
  registerApiRoutes
};
