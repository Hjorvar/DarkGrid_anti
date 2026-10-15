/**
 * Darkgrid Database Restore & Verification Utility
 *
 * Restores a backup created by `scripts/backup_database.js` or `exportDynamicState`
 * into a target SQLite database, verifying SHA-256 checksums and record counts.
 */

const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const {
  importDynamicState,
  verifySnapshotIntegrity,
  exportDynamicState,
  sha256
} = require('../src/db/durable-store');

function verifyBackupFile(backupObj) {
  if (!backupObj || typeof backupObj !== 'object') {
    return { valid: false, reason: 'Invalid backup object.' };
  }

  // Support both full backup wrapper and direct sqliteSnapshot
  const sqliteSnap = backupObj.sqliteSnapshot || backupObj;
  const snapCheck = verifySnapshotIntegrity(sqliteSnap);
  if (!snapCheck.valid) {
    return snapCheck;
  }

  if (backupObj.firestoreBackup && backupObj.firestoreBackup.collections) {
    const expectedFsHash = sha256(JSON.stringify(backupObj.firestoreBackup.collections));
    if (expectedFsHash !== backupObj.firestoreBackup.checksum) {
      return { valid: false, reason: 'Firestore collections checksum mismatch.' };
    }
  }

  return { valid: true };
}

function restoreFromBackupObject(db, backupObj, options = {}) {
  const check = verifyBackupFile(backupObj);
  if (!check.valid && !options.skipChecksum) {
    throw new Error(`Backup verification failed: ${check.reason}`);
  }

  const sqliteSnap = backupObj.sqliteSnapshot || backupObj;
  const result = importDynamicState(db, sqliteSnap, options);
  const postState = exportDynamicState(db);

  return {
    restored: true,
    restoredCounts: postState.counts,
    sourceCounts: sqliteSnap.counts,
    checksum: postState.checksum
  };
}

function restoreFromBackupFile(backupFilePath, options = {}) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file does not exist: ${backupFilePath}`);
  }

  const raw = fs.readFileSync(backupFilePath, 'utf8');
  const backupObj = JSON.parse(raw);

  const targetDbPath = options.dryRun
    ? ':memory:'
    : (options.targetDbPath || path.resolve(__dirname, '../data/darkgrid.sqlite'));

  const db = initializeDatabase(targetDbPath);
  runMigrations(db);
  runSeeds(db);

  try {
    const res = restoreFromBackupObject(db, backupObj, options);
    return {
      ...res,
      dryRun: Boolean(options.dryRun),
      targetDbPath
    };
  } finally {
    db.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find(a => !a.startsWith('--'));
  const backupPath = fileArg
    ? path.resolve(process.cwd(), fileArg)
    : path.resolve(__dirname, '../db/backups/production-backup-latest.json');

  try {
    const res = restoreFromBackupFile(backupPath, { dryRun });
    console.log(`=== Darkgrid Backup Restore ${res.dryRun ? '(DRY RUN)' : ''} Complete ===`);
    console.log('Target DB:', res.targetDbPath);
    console.log('Restored Counts:', res.restoredCounts);
    console.log('Post-Restore Checksum:', res.checksum);
  } catch (err) {
    console.error('Restore failed:', err);
    process.exit(1);
  }
}

module.exports = {
  verifyBackupFile,
  restoreFromBackupObject,
  restoreFromBackupFile
};
