process.env.NODE_ENV = 'test';

const { initializeDatabase, setDb, closeDb } = require('../../src/db/connection');
const { runMigrations, runSeeds } = require('../../src/db/migrate');

/**
 * Creates an isolated in-memory test database with full migrations and seeds applied
 */
function createTestDb() {
  const db = initializeDatabase(':memory:');
  runMigrations(db);
  runSeeds(db);
  return db;
}

module.exports = {
  createTestDb
};
