/**
 * Darkgrid Production Backup Utility
 *
 * Exports:
 * 1. All Cloud Firestore collections from `darkgrid-rpg` (if credentials are available)
 * 2. Local SQLite dynamic gameplay tables (`data/darkgrid.sqlite`)
 *
 * Produces a SHA-256 checksummed JSON backup in `db/backups/` and verifies that
 * all required collections and tables are present.
 */

const fs = require('fs');
const path = require('path');
const { initializeDatabase, closeDb } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const {
  DYNAMIC_TABLES,
  exportDynamicState,
  verifySnapshotIntegrity,
  getServerAccessToken,
  sha256
} = require('../src/db/durable-store');

const BACKUPS_DIR = path.resolve(__dirname, '../db/backups');

const FIRESTORE_COLLECTIONS = [
  'users',
  'usernames',
  'characters',
  'encounters',
  'persistent_monsters',
  'market_listings',
  'hunting_contracts',
  'world_state'
];

const SERVER_FIRESTORE_COLLECTIONS = DYNAMIC_TABLES.map(t => `server_${t}`);

function fromFirestoreValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return String(v.stringValue);
  if ('timestampValue' in v) return String(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) {
    const obj = {};
    for (const [k, subVal] of Object.entries(v.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(subVal);
    }
    return obj;
  }
  return null;
}

async function fetchSingleCollection(baseUrl, col, token, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(`${baseUrl}/${col}?pageSize=1000`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (netErr) {
    const err = new Error(`Firestore network failure while fetching collection '${col}': ${netErr.message}`);
    err.code = 'FIRESTORE_NETWORK_ERROR';
    err.collection = col;
    throw err;
  }

  if (res.status === 401) {
    const err = new Error(
      `HTTP 401 UNAUTHENTICATED from Firestore on collection '${col}'. OAuth access_token is expired or invalid.`
    );
    err.status = 401;
    err.code = 'FIRESTORE_UNAUTHENTICATED';
    err.collection = col;
    throw err;
  }
  if (res.status === 403) {
    const err = new Error(
      `HTTP 403 FORBIDDEN from Firestore on collection '${col}'. Insufficient permissions for project backup.`
    );
    err.status = 403;
    err.code = 'FIRESTORE_PERMISSION_DENIED';
    err.collection = col;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} error from Firestore on collection '${col}'.`);
    err.status = res.status;
    err.code = 'FIRESTORE_API_ERROR';
    err.collection = col;
    throw err;
  }

  const data = await res.json();
  const docs = [];
  for (const d of data.documents || []) {
    const id = d.name.split('/').pop();
    const fields = {};
    for (const [k, v] of Object.entries(d.fields || {})) {
      fields[k] = fromFirestoreValue(v);
    }
    docs.push({
      id,
      createTime: d.createTime,
      updateTime: d.updateTime,
      data: fields
    });
  }
  return docs;
}

async function fetchFirestoreCollections(projectId = 'darkgrid-rpg', options = {}) {
  const token = options.token || options.accessToken || await getServerAccessToken({
    ...options,
    throwOnExpired: true
  });
  if (!token) {
    const err = new Error('Cannot fetch Firestore backup: no valid OAuth access_token available.');
    err.status = 401;
    err.code = 'NO_OAUTH_TOKEN';
    throw err;
  }

  const fetchImpl = options.fetchFn || global.fetch;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const collections = {};
  const serverCollections = {};

  for (const col of FIRESTORE_COLLECTIONS) {
    collections[col] = await fetchSingleCollection(baseUrl, col, token, fetchImpl);
  }

  if (options.includeServerCollections !== false) {
    for (const col of SERVER_FIRESTORE_COLLECTIONS) {
      serverCollections[col] = await fetchSingleCollection(baseUrl, col, token, fetchImpl);
    }
  }

  return { fetched: true, collections, serverCollections };
}

function getBackupUserCountSummary(backupObj) {
  if (!backupObj || typeof backupObj !== 'object') {
    return { sqliteUsers: 0, firestoreLegacyUsers: 0, firestoreServerUsers: 0, maxUsers: 0 };
  }
  const sqliteUsers = Array.isArray(backupObj.sqliteSnapshot?.tables?.users)
    ? backupObj.sqliteSnapshot.tables.users.length
    : Number(backupObj.sqliteSnapshot?.counts?.users || 0);
  const firestoreLegacyUsers = Array.isArray(backupObj.firestoreBackup?.collections?.users)
    ? backupObj.firestoreBackup.collections.users.length
    : Number(backupObj.firestoreBackup?.collectionCounts?.users || 0);
  const firestoreServerUsers = Array.isArray(backupObj.firestoreBackup?.serverCollections?.server_users)
    ? backupObj.firestoreBackup.serverCollections.server_users.length
    : Number(backupObj.firestoreBackup?.serverCollectionCounts?.server_users || 0);

  return {
    sqliteUsers,
    firestoreLegacyUsers,
    firestoreServerUsers,
    maxUsers: Math.max(sqliteUsers, firestoreLegacyUsers, firestoreServerUsers)
  };
}

async function runBackup(options = {}) {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const dbPath = options.dbPath || path.resolve(__dirname, '../data/darkgrid.sqlite');
  const db = initializeDatabase(dbPath);
  try {
    runMigrations(db);
    runSeeds(db);

    const sqliteSnapshot = exportDynamicState(db);
    const verification = verifySnapshotIntegrity(sqliteSnapshot);
    if (!verification.valid) {
      throw new Error(`SQLite snapshot integrity check failed: ${verification.reason}`);
    }

    let firestoreData = { fetched: false, collections: {}, serverCollections: {} };
    if (!options.skipFirestore) {
      firestoreData = await fetchFirestoreCollections(options.projectId || 'darkgrid-rpg', options);
    }

    const fullBackup = {
      backupVersion: '2.1.0-blaze',
      createdAt: new Date().toISOString(),
      projectId: options.projectId || 'darkgrid-rpg',
      sqliteSnapshot,
      firestoreBackup: {
        fetched: firestoreData.fetched,
        collectionCounts: Object.fromEntries(
          Object.entries(firestoreData.collections || {}).map(([k, v]) => [k, v.length])
        ),
        serverCollectionCounts: Object.fromEntries(
          Object.entries(firestoreData.serverCollections || {}).map(([k, v]) => [k, v.length])
        ),
        collections: firestoreData.collections || {},
        serverCollections: firestoreData.serverCollections || {},
        checksum: sha256(JSON.stringify({
          collections: firestoreData.collections || {},
          serverCollections: firestoreData.serverCollections || {}
        }))
      }
    };

    fullBackup.backupChecksum = sha256(
      JSON.stringify({
        sqliteChecksum: sqliteSnapshot.checksum,
        firestoreChecksum: fullBackup.firestoreBackup.checksum
      })
    );

    const latestPath = options.outputPath || path.join(BACKUPS_DIR, 'production-backup-latest.json');
    const newCounts = getBackupUserCountSummary(fullBackup);

    if (options.requireNonEmpty && newCounts.maxUsers === 0) {
      const err = new Error('Backup rejected: new backup contains 0 users while requireNonEmpty is enabled.');
      err.code = 'EMPTY_BACKUP_REJECTED';
      throw err;
    }

    // Fail-safe: NEVER allow a backup with 0 users (or empty SQLite when previous SQLite had users)
    // to overwrite an existing verified backup that contains real users!
    if (fs.existsSync(latestPath) && !options.allowEmptyOverwrite) {
      let existingBackup = null;
      try {
        existingBackup = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
      } catch {
        existingBackup = null;
      }
      const existingCounts = getBackupUserCountSummary(existingBackup);
      if (existingCounts.maxUsers > 0 && newCounts.maxUsers === 0) {
        const err = new Error(
          `Backup fail-safe triggered: refusing to overwrite existing backup (${existingCounts.maxUsers} users) with an empty backup (0 users).`
        );
        err.code = 'EMPTY_BACKUP_OVERWRITE_BLOCKED';
        throw err;
      }
      if (existingCounts.sqliteUsers > 0 && newCounts.sqliteUsers === 0 && !options.allowEmptySqlite) {
        const err = new Error(
          `Backup fail-safe triggered: refusing to overwrite existing SQLite snapshot (${existingCounts.sqliteUsers} users) with an empty local SQLite database (0 users).`
        );
        err.code = 'EMPTY_SQLITE_OVERWRITE_BLOCKED';
        throw err;
      }
    }

    const outDir = path.dirname(latestPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Atomic write to .tmp, read-back verification, then rename
    const tmpPath = `${latestPath}.${process.pid}.${Date.now()}.tmp`;
    const serialized = JSON.stringify(fullBackup, null, 2);
    fs.writeFileSync(tmpPath, serialized, 'utf8');

    const readBack = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
    const readBackCheck = verifySnapshotIntegrity(readBack.sqliteSnapshot);
    if (!readBackCheck.valid || readBack.backupChecksum !== fullBackup.backupChecksum) {
      fs.unlinkSync(tmpPath);
      throw new Error('Post-write backup verification failed: checksum mismatch on written temporary file.');
    }

    fs.renameSync(tmpPath, latestPath);

    return {
      outputPath: latestPath,
      backup: fullBackup
    };
  } finally {
    try {
      closeDb();
    } catch {
      // Ignore
    }
    try {
      db.close();
    } catch {
      // Ignore if already closed
    }
  }
}

if (require.main === module) {
  runBackup()
    .then(({ outputPath, backup }) => {
      console.log('=== Darkgrid Production Backup Complete ===');
      console.log('Output File:', outputPath);
      console.log('Backup Checksum:', backup.backupChecksum);
      console.log('SQLite Table Counts:', backup.sqliteSnapshot.counts);
      console.log('Firestore Collection Counts:', backup.firestoreBackup.collectionCounts);
    })
    .catch((err) => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}

module.exports = {
  runBackup,
  fetchFirestoreCollections,
  getBackupUserCountSummary,
  FIRESTORE_COLLECTIONS,
  SERVER_FIRESTORE_COLLECTIONS
};
