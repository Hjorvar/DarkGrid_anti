const bcrypt = require('bcryptjs');
const { verifyPasswordWithFirebaseAuth } = require('../../firebase/token-verifier');
const { uidToNumericId } = require('../../db/durable-store');

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

async function verifyPassword(plainPassword, hash) {
  if (!hash || typeof hash !== 'string' || !hash.startsWith('$2')) {
    return false;
  }
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Registers a new user account
 */
async function registerUser(db, username, password) {
  const cleanUsername = (username || '').trim();

  if (!USERNAME_REGEX.test(cleanUsername)) {
    const error = new Error('Username must be 3-20 characters (letters, numbers, and underscores only).');
    error.status = 400;
    throw error;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    const error = new Error('Password must be at least 6 characters.');
    error.status = 400;
    throw error;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(cleanUsername);
  if (existing) {
    const error = new Error('This username is already taken.');
    error.status = 409;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  const result = stmt.run(cleanUsername, passwordHash);

  return {
    id: Number(result.lastInsertRowid),
    username: cleanUsername
  };
}

/**
 * Validates login credentials and returns user object.
 * Supports migrated Firebase Auth accounts (password_hash === 'firebase-auth'),
 * verifying against Firebase Auth REST API and upgrading their hash to bcrypt.
 */
async function loginUser(db, username, password, options = {}) {
  const cleanUsername = (username || '').trim();

  if (!cleanUsername || !password) {
    const error = new Error('Please enter both username and password.');
    error.status = 400;
    throw error;
  }

  let user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(cleanUsername);

  if (user && user.password_hash === 'firebase-auth') {
    const verifier = options.firebaseVerifier || verifyPasswordWithFirebaseAuth;
    const fbAuthResult = await verifier(cleanUsername, password);
    if (!fbAuthResult || (user.firebase_uid && fbAuthResult.uid !== user.firebase_uid)) {
      const error = new Error('Invalid username or password.');
      error.status = 401;
      throw error;
    }
    const upgradedHash = await hashPassword(password);
    const hasFirebaseUidCol = Boolean(
      db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'firebase_uid'").get()
    );
    if (hasFirebaseUidCol) {
      db.prepare('UPDATE users SET password_hash = ?, firebase_uid = COALESCE(firebase_uid, ?) WHERE id = ?')
        .run(upgradedHash, fbAuthResult.uid, user.id);
    } else {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(upgradedHash, user.id);
    }
    return {
      id: user.id,
      username: user.username,
      firebaseUid: fbAuthResult.uid,
      createdAt: user.created_at
    };
  }

  if (!user && options.allowFirebaseFallback) {
    const verifier = options.firebaseVerifier || verifyPasswordWithFirebaseAuth;
    const fbAuthResult = await verifier(cleanUsername, password);
    if (fbAuthResult && fbAuthResult.uid) {
      const numericId = uidToNumericId(fbAuthResult.uid);
      const upgradedHash = await hashPassword(password);
      const hasFirebaseUidCol = Boolean(
        db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'firebase_uid'").get()
      );
      if (hasFirebaseUidCol) {
        db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, firebase_uid) VALUES (?, ?, ?, ?)')
          .run(numericId, fbAuthResult.displayName || cleanUsername, upgradedHash, fbAuthResult.uid);
      } else {
        db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)')
          .run(numericId, fbAuthResult.displayName || cleanUsername, upgradedHash);
      }
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(numericId);
      if (user) {
        return {
          id: user.id,
          username: user.username,
          firebaseUid: fbAuthResult.uid,
          createdAt: user.created_at
        };
      }
    }
  }

  if (!user) {
    const error = new Error('Invalid username or password.');
    error.status = 401;
    throw error;
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    const error = new Error('Invalid username or password.');
    error.status = 401;
    throw error;
  }

  return {
    id: user.id,
    username: user.username,
    firebaseUid: user.firebase_uid || null,
    createdAt: user.created_at
  };
}

function getUserById(db, userId) {
  const stmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
  return stmt.get(userId) || null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  registerUser,
  loginUser,
  getUserById
};
