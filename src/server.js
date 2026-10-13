const app = require('./app');
const config = require('./config');
const { getDb, closeDb } = require('./db/connection');
const { runMigrations, runSeeds } = require('./db/migrate');

// Ensure database is prepared
console.log('--- Darkgrid Server Startup ---');
const db = getDb();
try {
  const migrations = runMigrations(db);
  if (migrations.length > 0) {
    console.log(`Applied migrations: ${migrations.join(', ')}`);
  }
  // Only execute seeds if database is unseeded/empty (L11)
  const tileCount = db.prepare('SELECT COUNT(*) as count FROM map_tiles').get()?.count || 0;
  if (tileCount === 0) {
    const seeds = runSeeds(db);
    if (seeds.length > 0) {
      console.log(`Executed seeds: ${seeds.join(', ')}`);
    }
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
});

function handleShutdown() {
  console.log('\nClosing Darkgrid server...');
  server.close(() => {
    closeDb();
    console.log('Darkgrid server closed safely.');
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
