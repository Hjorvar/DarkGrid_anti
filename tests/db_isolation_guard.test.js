const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const config = require('../src/config');
const { initializeDatabase, getDb, createTestDb, LIVE_DB_PATH } = require('../src/db/connection');
const { createTestDb: helperCreateTestDb } = require('./test_helpers');

test('C3 Guard 1: config.dbPath defaults to :memory: in test environment', () => {
  assert.equal(config.nodeEnv, 'test', 'nodeEnv must be test');
  assert.equal(config.dbPath, ':memory:', 'config.dbPath must default to :memory: in test environment');
});

test('C3 Guard 2: Safety guard strictly forbids opening live game database in test environment', () => {
  assert.throws(
    () => {
      initializeDatabase(LIVE_DB_PATH);
    },
    (err) => {
      return err.message.includes('[SECURITY GUARD]') &&
             err.message.includes('CRITICAL SAFETY VIOLATION');
    },
    'Must throw critical safety violation if attempting to open data/darkgrid.sqlite in tests'
  );

  // Also test with relative path to darkgrid.sqlite
  const relativeLivePath = path.join(__dirname, '../data/darkgrid.sqlite');
  assert.throws(
    () => {
      initializeDatabase(relativeLivePath);
    },
    (err) => {
      return err.message.includes('[SECURITY GUARD]');
    },
    'Must throw critical safety violation if attempting to open relative path to darkgrid.sqlite'
  );
});

test('C3 Guard 3: Parallel / multiple createTestDb calls are strictly isolated', () => {
  const db1 = helperCreateTestDb();
  const db2 = helperCreateTestDb();

  // Create character in db1
  db1.prepare(`
    INSERT INTO users (username, password_hash) VALUES ('isolated_user_1', 'hash123')
  `).run();

  const userInDb1 = db1.prepare("SELECT * FROM users WHERE username = 'isolated_user_1'").get();
  assert.ok(userInDb1, 'User must exist in db1');

  // Verify db2 does NOT contain this user
  const userInDb2 = db2.prepare("SELECT * FROM users WHERE username = 'isolated_user_1'").get();
  assert.equal(userInDb2, undefined, 'db2 must be completely isolated from db1 data');

  db1.close();
  db2.close();
});

test('C3 Guard 4: getDb() in test environment initializes an isolated in-memory DB', () => {
  const db = getDb();
  assert.ok(db, 'getDb() must return a database instance');
  // Check that it's working with tables
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  assert.equal(typeof userCount, 'number', 'users table must exist');
});
