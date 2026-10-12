const bcrypt = require('bcryptjs');

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

async function verifyPassword(plainPassword, hash) {
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
 * Validates login credentials and returns user object
 */
async function loginUser(db, username, password) {
  const cleanUsername = (username || '').trim();

  if (!cleanUsername || !password) {
    const error = new Error('Please enter both username and password.');
    error.status = 400;
    throw error;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(cleanUsername);
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
