const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let currentDb = null;
const LIVE_DB_PATH = path.resolve(__dirname, '../../data/darkgrid.sqlite');

function isTestEnvironment() {
  return (
    process.env.NODE_ENV === 'test' ||
    config.nodeEnv === 'test' ||
    process.execArgv.some(arg => typeof arg === 'string' && arg.includes('test')) ||
    process.argv.some(arg => typeof arg === 'string' && (arg.includes('test') || arg.endsWith('.test.js')))
  );
}

function initializeDatabase(dbPath = config.dbPath) {
  const isTest = isTestEnvironment();

  if (dbPath !== ':memory:') {
    const resolvedPath = path.resolve(dbPath);
    if (isTest && resolvedPath === LIVE_DB_PATH) {
      throw new Error(
        `[SECURITY GUARD] CRITICAL SAFETY VIOLATION: Test environment attempted to open live game database at "${resolvedPath}"! Tests must use ':memory:' or an isolated test database.`
      );
    }
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Enable Foreign Keys, WAL mode for concurrency, and busy timeout
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA busy_timeout = 5000;');

  return db;
}

function getDb() {
  if (!currentDb) {
    if (isTestEnvironment()) {
      const { runMigrations, runSeeds } = require('./migrate');
      const testDb = initializeDatabase(':memory:');
      runMigrations(testDb);
      runSeeds(testDb);
      currentDb = testDb;
    } else {
      currentDb = initializeDatabase();
    }
  }
  return currentDb;
}

function setDb(dbInstance) {
  currentDb = dbInstance;
}

function closeDb() {
  if (currentDb) {
    currentDb.close();
    currentDb = null;
  }
}

const transactionDepthByDb = new WeakMap();

/**
 * Execute callback within a database transaction (supports nested calls via per-connection SAVEPOINTS)
 */
function withTransaction(db, callback) {
  const nextDepth = (transactionDepthByDb.get(db) || 0) + 1;
  transactionDepthByDb.set(db, nextDepth);
  const sp = `tx_${nextDepth}`;
  db.exec(`SAVEPOINT ${sp}`);
  try {
    const result = callback(db);
    db.exec(`RELEASE SAVEPOINT ${sp}`);
    transactionDepthByDb.set(db, nextDepth - 1);
    return result;
  } catch (error) {
    try {
      db.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
      db.exec(`RELEASE SAVEPOINT ${sp}`);
    } catch {
      // Ignore if rollback cannot be released
    }
    transactionDepthByDb.set(db, nextDepth - 1);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  getDb,
  setDb,
  closeDb,
  withTransaction,
  isTestEnvironment,
  LIVE_DB_PATH
};
