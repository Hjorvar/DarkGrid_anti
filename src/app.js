/**
 * DARKGRID — Main Game Express Application Factory (src/app.js)
 *
 * Launches the main DarkGrid game (top-down 3-region overworld, 2 large dungeons,
 * first-person combat & landmark scenes, 9-slot equipment, quests, bounties, and permadeath).
 * The legacy EJS/SSR game is preserved in `legacy-game/app.js`.
 */

const config = require('./config');
const labServer = require('../action-ui-lab/server');

function createMainApp(options = {}) {
  return labServer.createLabApp({
    dbPath: options.dbPath || config.dbPath,
    sessionSecret: options.sessionSecret || config.sessionSecret,
    ...options
  });
}

module.exports = {
  ...labServer,
  createMainApp,
  createLabApp: labServer.createLabApp
};
