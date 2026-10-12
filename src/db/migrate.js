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
 * Runs all seed scripts in db/seeds
 */
function runSeeds(db = getDb()) {
  const seedsDir = path.join(__dirname, '../../db/seeds');
  if (!fs.existsSync(seedsDir)) {
    return [];
  }

  const files = fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const executedSeeds = [];

  for (const file of files) {
    const filePath = path.join(seedsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    withTransaction(db, (transactionDb) => {
      transactionDb.exec(sql);
    });

    executedSeeds.push(file);
  }

  return executedSeeds;
}

module.exports = {
  runMigrations,
  runSeeds
};
