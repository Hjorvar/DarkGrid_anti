const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let currentDb = null;

function initializeDatabase(dbPath = config.dbPath) {
  if (dbPath !== ':memory:') {
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
    currentDb = initializeDatabase();
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

let transactionDepth = 0;

/**
 * Execute callback within a database transaction (supports nested calls via SAVEPOINTS)
 */
function withTransaction(db, callback) {
  transactionDepth++;
  const sp = `tx_${transactionDepth}`;
  db.exec(`SAVEPOINT ${sp}`);
  try {
    const result = callback(db);
    db.exec(`RELEASE SAVEPOINT ${sp}`);
    transactionDepth--;
    return result;
  } catch (error) {
    try {
      db.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
      db.exec(`RELEASE SAVEPOINT ${sp}`);
    } catch {
      // Ignore if rollback cannot be released
    }
    transactionDepth--;
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  getDb,
  setDb,
  closeDb,
  withTransaction
};
