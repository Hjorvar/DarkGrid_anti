const { getDb, closeDb } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');

console.log('--- Initializing Darkgrid Database ---');
const db = getDb();

try {
  const migrations = runMigrations(db);
  console.log(`Applied migrations (${migrations.length}):`, migrations);

  const seeds = runSeeds(db);
  console.log(`Executed seeds (${seeds.length}):`, seeds);

  const tileCount = db.prepare('SELECT COUNT(*) as count FROM map_tiles').get().count;
  const monsterCount = db.prepare('SELECT COUNT(*) as count FROM monsters').get().count;
  console.log(`Status: ${tileCount} map tiles, ${monsterCount} monster types loaded.`);
  console.log('Database setup completed successfully.');
} catch (err) {
  console.error('Database setup failed:', err);
  process.exit(1);
} finally {
  closeDb();
}
