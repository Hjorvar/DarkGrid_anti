/**
 * DARKGRID — Repository Root Entrypoint (index.js)
 * Launches the main DarkGrid game when invoked directly (`node .` or `node index.js`).
 */

const { startServer, createMainApp } = require('./src/server');
const appModule = require('./src/app');

if (require.main === module) {
  startServer();
}

module.exports = {
  ...appModule,
  startServer,
  createMainApp
};
