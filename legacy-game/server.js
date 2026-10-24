const fs = require('fs');
const app = require('./app');
const config = require('../src/config');
const { getDb, closeDb } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const {
  loadDurableSnapshotFile,
  saveDurableSnapshotFile,
  pullFromFirestoreServer,
  pushDeltaToFirestoreServer,
  primeRowHashCache
} = require('../src/db/durable-store');
const { logInfo, logError } = require('../src/utils/logger');

function isFirestoreSyncEnabled() {
  return process.env.ENABLE_FIRESTORE_SYNC === 'true' || process.env.FIRESTORE_DURABLE_SYNC === 'true';
}

async function startServer() {
  console.log('--- Darkgrid Server Startup ---');
  const db = getDb();
  try {
    const migrations = runMigrations(db);
    if (migrations.length > 0) {
      console.log(`Applied migrations: ${migrations.join(', ')}`);
    }
    // Execute any pending seeds tracked via schema_seeds (safe on both empty and populated DBs)
    const seeds = runSeeds(db);
    if (seeds.length > 0) {
      console.log(`Executed seeds: ${seeds.join(', ')}`);
    }

    // Hydrate from durable snapshot file if configured and already present on disk
    if (process.env.DURABLE_SNAPSHOT_PATH && fs.existsSync(process.env.DURABLE_SNAPSHOT_PATH)) {
      loadDurableSnapshotFile(db, process.env.DURABLE_SNAPSHOT_PATH);
    }

    primeRowHashCache(db);
  } catch (err) {
    console.error('Fatal: Could not initialize database schema/seeds:', err);
    process.exit(1);
  }

  // Bind to 0.0.0.0:PORT immediately so Cloud Run health checks succeed without waiting on network I/O
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(` DARKGRID running at: http://0.0.0.0:${config.port}`);
    console.log(` Environment: ${config.nodeEnv}`);
    console.log(` Database: ${config.dbPath}`);
    console.log(`===============================================`);
    logInfo('SERVER_STARTED', 'Darkgrid server started', {
      port: config.port,
      nodeEnv: config.nodeEnv
    });
  });

  // Hydrate from Cloud Firestore if server-side Firestore persistence is enabled
  if (isFirestoreSyncEnabled()) {
    try {
      await pullFromFirestoreServer(db);
    } catch (err) {
      logError('STARTUP_FIRESTORE_HYDRATE_ERROR', 'Non-fatal error hydrating from Firestore on startup', {
        error: err.message
      });
    }
  }

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
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };

