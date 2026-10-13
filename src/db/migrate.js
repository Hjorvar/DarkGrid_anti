const fs = require('fs');
const path = require('path');
const { getDb, withTransaction } = require('./connection');

/**
 * Ensures migration tracking table exists
 */
function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Runs all pending migrations in db/migrations
 */
function runMigrations(db = getDb()) {
  ensureMigrationTable(db);

  const migrationsDir = path.join(__dirname, '../../db/migrations');
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const appliedMigrations = [];

  for (const file of files) {
    const checkStmt = db.prepare('SELECT 1 FROM schema_migrations WHERE filename = ?');
    const alreadyApplied = checkStmt.get(file);

    if (!alreadyApplied) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      withTransaction(db, (transactionDb) => {
        transactionDb.exec(sql);
        const insertStmt = transactionDb.prepare('INSERT INTO schema_migrations (filename) VALUES (?)');
        insertStmt.run(file);
      });

      appliedMigrations.push(file);
    }
  }

  return appliedMigrations;
}

/**
 * Ensures seed tracking table exists
 */
function ensureSeedTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_seeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Backfills schema_seeds for pre-existing databases that were seeded before schema_seeds existed,
 * preventing duplicate INSERT errors on non-idempotent legacy seed files (001-006) while allowing
 * newer seeds (007, 008, etc.) to run if not yet applied.
 */
function reconcileLegacySeeds(db, files) {
  const trackedCount = db.prepare('SELECT COUNT(*) as count FROM schema_seeds').get()?.count || 0;
  if (trackedCount > 0) return;

  const tileCount = db.prepare('SELECT COUNT(*) as count FROM map_tiles').get()?.count || 0;
  if (tileCount === 0) return;

  const monsterCount = db.prepare('SELECT COUNT(*) as count FROM monsters').get()?.count || 0;
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM item_definitions').get()?.count || 0;
  const lootTableCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='loot_tables'").get()?.count
    ? (db.prepare('SELECT COUNT(*) as count FROM loot_tables').get()?.count || 0)
    : 0;
  const defeatedImgCount = db.prepare("SELECT COUNT(*) as count FROM monsters WHERE defeated_image_path IS NOT NULL AND defeated_image_path != ''").get()?.count || 0;

  const markStmt = db.prepare('INSERT OR IGNORE INTO schema_seeds (filename) VALUES (?)');
  for (const file of files) {
    if (file.startsWith('001_') && tileCount > 0) markStmt.run(file);
    else if (file.startsWith('002_') && monsterCount >= 1) markStmt.run(file);
    else if (file.startsWith('003_') && monsterCount >= 38) markStmt.run(file);
    else if (file.startsWith('004_') && monsterCount >= 68) markStmt.run(file);
    else if (file.startsWith('005_') && itemCount >= 18) markStmt.run(file);
    else if (file.startsWith('006_') && monsterCount >= 98) markStmt.run(file);
    else if (file.startsWith('007_') && lootTableCount >= 10 && itemCount >= 70) markStmt.run(file);
    else if (file.startsWith('008_') && defeatedImgCount >= 90) markStmt.run(file);
  }
}

/**
 * Runs all pending seed scripts in db/seeds
 */
function runSeeds(db = getDb()) {
  ensureSeedTable(db);

  const seedsDir = path.join(__dirname, '../../db/seeds');
  if (!fs.existsSync(seedsDir)) {
    return [];
  }

  const files = fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  reconcileLegacySeeds(db, files);

  const executedSeeds = [];

  for (const file of files) {
    const alreadyApplied = db.prepare('SELECT 1 FROM schema_seeds WHERE filename = ?').get(file);
    if (!alreadyApplied) {
      const filePath = path.join(seedsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      withTransaction(db, (transactionDb) => {
        transactionDb.exec(sql);
        transactionDb.prepare('INSERT OR IGNORE INTO schema_seeds (filename) VALUES (?)').run(file);
      });

      executedSeeds.push(file);
    }
  }

  return executedSeeds;
}

module.exports = {
  runMigrations,
  runSeeds
};
