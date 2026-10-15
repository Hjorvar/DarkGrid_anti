const app = require('./app');
const config = require('./config');
const { getDb, closeDb } = require('./db/connection');
const { runMigrations, runSeeds } = require('./db/migrate');
const {
  loadDurableSnapshotFile,
  saveDurableSnapshotFile,
  pullFromFirestoreServer,
  pushDeltaToFirestoreServer,
  primeRowHashCache
} = require('./db/durable-store');
const { logInfo, logError } = require('./utils/logger');

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

    // Hydrate from durable snapshot file if configured
    if (process.env.DURABLE_SNAPSHOT_PATH) {
      loadDurableSnapshotFile(db, process.env.DURABLE_SNAPSHOT_PATH);
    }

    // Hydrate from Cloud Firestore if server-side Firestore persistence is enabled
    if (process.env.ENABLE_FIRESTORE_SYNC === 'true') {
      await pullFromFirestoreServer(db);
    } else {
      primeRowHashCache(db);
    }
  } catch (err) {
    console.error('Fatal: Could not initialize database schema/seeds:', err);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`===============================================`);
    console.log(` DARKGRID running at: http://localhost:${config.port}`);
    console.log(` Environment: ${config.nodeEnv}`);
    console.log(` Database: ${config.dbPath}`);
    console.log(`===============================================`);
    logInfo('SERVER_STARTED', 'Darkgrid server started', {
      port: config.port,
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
      if (process.env.ENABLE_FIRESTORE_SYNC === 'true') {
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

