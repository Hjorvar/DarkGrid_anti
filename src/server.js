/**
 * DARKGRID — Main Game Server Entrypoint (src/server.js)
 *
 * Starts the main DarkGrid RPG web server from the repository root (`npm start` / `npm run dev`),
 * with full SQLite initialization, 3-region overworld + 2 large dungeons, and durable
 * Cloud Firestore / snapshot persistence for production Cloud Run deployments.
 */

const fs = require('fs');
const config = require('./config');
const { getDb, closeDb } = require('./db/connection');
const { createMainApp } = require('./app');
const {
  loadDurableSnapshotFile,
  saveDurableSnapshotFile,
  pullFromFirestoreServer,
  pushDeltaToFirestoreServer,
  primeRowHashCache
} = require('./db/durable-store');
const { logInfo, logError } = require('./utils/logger');

function isFirestoreSyncEnabled() {
  return process.env.ENABLE_FIRESTORE_SYNC === 'true' || process.env.FIRESTORE_DURABLE_SYNC === 'true';
}

async function startServer(options = {}) {
  console.log('--- Darkgrid Main Game Server Startup ---');
  const db = options.db || getDb();
  let app;
  try {
    app = createMainApp({
      db,
      dbPath: config.dbPath,
      sessionSecret: config.sessionSecret,
      ...options
    });

    // Hydrate from durable snapshot file if configured and already present on disk
    if (process.env.DURABLE_SNAPSHOT_PATH && fs.existsSync(process.env.DURABLE_SNAPSHOT_PATH)) {
      loadDurableSnapshotFile(db, process.env.DURABLE_SNAPSHOT_PATH);
    }

    // Hydrate from Cloud Firestore before accepting requests if server-side Firestore persistence is enabled
    if (isFirestoreSyncEnabled()) {
      try {
        await pullFromFirestoreServer(db, { allowCliRefresh: false });
      } catch (err) {
        logError('STARTUP_FIRESTORE_HYDRATE_ERROR', 'Non-fatal error hydrating from Firestore on startup', {
          error: err.message
        });
      }
    }

    primeRowHashCache(db);
  } catch (err) {
    console.error('Fatal: Could not initialize Darkgrid main game server:', err);
    process.exit(1);
  }

  const port = options.port !== undefined ? options.port : config.port;

  // Bind to 0.0.0.0:PORT after state initialization and hydration
  const server = app.listen(port, '0.0.0.0', () => {
    const actualPort = server.address()?.port || port;
    console.log('===============================================');
    console.log(` DARKGRID (Main Game) running at: http://0.0.0.0:${actualPort}`);
    console.log(` Environment: ${config.nodeEnv}`);
    console.log(` Database: ${config.dbPath}`);
    console.log('===============================================');
    logInfo('SERVER_STARTED', 'Darkgrid main game server started', {
      port: actualPort,
      nodeEnv: config.nodeEnv
    });
  });

  async function handleShutdown() {
    console.log('\nClosing Darkgrid server...');
    try {
      const currentDb = getDb();
      if (process.env.DURABLE_SNAPSHOT_PATH) {
        saveDurableSnapshotFile(currentDb, process.env.DURABLE_SNAPSHOT_PATH);
      }
      if (isFirestoreSyncEnabled()) {
        await pushDeltaToFirestoreServer(currentDb);
      }
    } catch (err) {
      logError('SHUTDOWN_SYNC_ERROR', 'Error flushing durable state on shutdown', { error: err.message });
    }
    server.close(() => {
      closeDb();
      console.log('Darkgrid server closed safely.');
      process.exit(0);
    });
  }

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
  return { app, server, db };
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, createMainApp };
