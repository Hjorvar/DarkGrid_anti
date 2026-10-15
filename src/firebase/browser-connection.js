/**
 * Browser-side DatabaseSync-compatible wrapper around sql.js
 * Mirrors node:sqlite DatabaseSync (.exec, .prepare().get/all/run)
 */

let currentDb = null;

class SqlJsDatabaseWrapper {
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
  }

  exec(sql) {
    this._db.run(sql);
  }

  prepare(sql) {
    const db = this._db;
    return {
      get(...params) {
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params.map(p => (p === undefined ? null : p)));
          }
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        const stmt = db.prepare(sql);
        const rows = [];
        try {
          if (params.length > 0) {
            stmt.bind(params.map(p => (p === undefined ? null : p)));
          }
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      },
      run(...params) {
        if (params.length > 0) {
          db.run(sql, params.map(p => (p === undefined ? null : p)));
        } else {
          db.run(sql);
        }
        const changes = db.getRowsModified();
        let lastInsertRowid = 0;
        const stmt = db.prepare('SELECT last_insert_rowid() as id');
        try {
          if (stmt.step()) {
            lastInsertRowid = stmt.getAsObject().id;
          }
        } finally {
          stmt.free();
        }
        return { changes, lastInsertRowid };
      }
    };
  }

  exportBytes() {
    return this._db.export();
  }

  close() {
    this._db.close();
  }
}

function getDb() {
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
      // Ignore
    }
    transactionDepthByDb.set(db, nextDepth - 1);
    throw error;
  }
}

function isTestEnvironment() {
  return false;
}

module.exports = {
  SqlJsDatabaseWrapper,
  getDb,
  setDb,
  closeDb,
  withTransaction,
  isTestEnvironment,
  LIVE_DB_PATH: '/darkgrid.sqlite'
};
