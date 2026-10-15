/**
 * SQLite-backed Session Store for express-session
 * Ensures login sessions and CSRF tokens survive server restarts and Cloud Run cold starts,
 * while avoiding MemoryStore leaks in production.
 */

const session = require('express-session');
const { getDb } = require('./connection');

class SqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.getDbFn = options.getDb || getDb;
    this.ttlMs = options.ttlMs || 1000 * 60 * 60 * 24 * 7; // 7 days
    this.lastPruneAt = 0;
    this.pruneIntervalMs = options.pruneIntervalMs || 1000 * 60 * 15; // 15 minutes
  }

  _db() {
    return this.getDbFn();
  }

  _ensureTable(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        sid TEXT PRIMARY KEY,
        user_id INTEGER,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  _maybePrune(db) {
    const now = Date.now();
    if (now - this.lastPruneAt < this.pruneIntervalMs) return;
    this.lastPruneAt = now;
    try {
      db.prepare('DELETE FROM user_sessions WHERE expire <= ?').run(now);
    } catch {
      // Ignore if table not yet initialized
    }
  }

  get(sid, callback) {
    try {
      const db = this._db();
      this._ensureTable(db);
      this._maybePrune(db);

      const now = Date.now();
      const row = db.prepare('SELECT sess, expire FROM user_sessions WHERE sid = ?').get(String(sid));
      if (!row) {
        return callback(null, null);
      }
      if (Number(row.expire) <= now) {
        db.prepare('DELETE FROM user_sessions WHERE sid = ?').run(String(sid));
        return callback(null, null);
      }
      const parsed = JSON.parse(row.sess);
      return callback(null, parsed);
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const db = this._db();
      this._ensureTable(db);

      const maxAge = sess?.cookie?.maxAge;
      const expire = sess?.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + (typeof maxAge === 'number' ? maxAge : this.ttlMs);

      const userId = sess?.userId ? Number(sess.userId) : null;
      const sessJson = JSON.stringify(sess);

      db.prepare(`
        INSERT INTO user_sessions (sid, user_id, sess, expire, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(sid) DO UPDATE SET
          user_id = excluded.user_id,
          sess = excluded.sess,
          expire = excluded.expire,
          updated_at = CURRENT_TIMESTAMP
      `).run(String(sid), userId, sessJson, expire);

      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      const db = this._db();
      this._ensureTable(db);
      db.prepare('DELETE FROM user_sessions WHERE sid = ?').run(String(sid));
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      const db = this._db();
      this._ensureTable(db);
      const maxAge = sess?.cookie?.maxAge;
      const expire = sess?.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + (typeof maxAge === 'number' ? maxAge : this.ttlMs);

      db.prepare(`
        UPDATE user_sessions
        SET expire = ?, updated_at = CURRENT_TIMESTAMP
        WHERE sid = ?
      `).run(expire, String(sid));

      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }
}

module.exports = {
  SqliteSessionStore
};
