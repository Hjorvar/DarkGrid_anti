/**
 * Firebase Authentication Server-Side Verifier & Password Migration Bridge
 *
 * 1. Cryptographically verifies Firebase ID Tokens (RS256 JWTs) against Google's
 *    securetoken x509 public keys (`aud: darkgrid-rpg`, `iss: https://securetoken.google.com/darkgrid-rpg`).
 * 2. Verifies legacy Firebase Auth user credentials (`${username.toLowerCase()}@darkgrid-rpg.firebaseapp.com`)
 *    via the Identity Toolkit REST API when a migrated user logs into the server for the first time,
 *    transparently upgrading their SQLite `password_hash` from `'firebase-auth'` to `bcrypt`.
 * 3. Strictly rejects any unverified `uid` or `firebase_uid` sent in request bodies.
 */

const crypto = require('crypto');

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'darkgrid-rpg';
// Public Firebase Web API Key (identifies the Firebase project to Identity Toolkit; not a secret key)
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBio45_bUjhJdNukfXC49ZECHSu7ptfc5s';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts = null;
let cachedCertsExpiresAt = 0;

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

async function getGooglePublicCerts() {
  const now = Date.now();
  if (cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }
  const resp = await fetch(GOOGLE_CERTS_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Google public certificates (${resp.status})`);
  }
  const certs = await resp.json();
  cachedCerts = certs;
  cachedCertsExpiresAt = now + 3600 * 1000;
  return certs;
}

/**
 * Verifies a Firebase ID Token (JWT) cryptographically.
 * Returns { uid, email, name } on success, or throws an Error with status=401.
 */
async function verifyFirebaseIdToken(idToken, customCerts = null) {
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('Missing Firebase ID token.');
    err.status = 401;
    throw err;
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    const err = new Error('Malformed Firebase ID token.');
    err.status = 401;
    throw err;
  }

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  } catch {
    const err = new Error('Invalid JWT encoding in Firebase ID token.');
    err.status = 401;
    throw err;
  }

  if (header.alg !== 'RS256' || !header.kid) {
    const err = new Error('Unsupported JWT algorithm or missing key ID.');
    err.status = 401;
    throw err;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    const err = new Error('Firebase ID token has expired.');
    err.status = 401;
    throw err;
  }
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    const err = new Error('Firebase ID token audience mismatch.');
    err.status = 401;
    throw err;
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    const err = new Error('Firebase ID token issuer mismatch.');
    err.status = 401;
    throw err;
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    const err = new Error('Firebase ID token subject (uid) is empty.');
    err.status = 401;
    throw err;
  }

  const certs = customCerts || await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    const err = new Error('Signing key ID not found in Google public certificates.');
    err.status = 401;
    throw err;
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();

  const signature = base64UrlDecode(parts[2]);
  const isValid = verifier.verify(certPem, signature);
  if (!isValid) {
    const err = new Error('Firebase ID token cryptographic signature verification failed.');
    err.status = 401;
    throw err;
  }

  return {
    uid: payload.sub,
    email: payload.email || null,
    username: payload.name || null
  };
}

/**
 * Verifies username + password against Firebase Auth Identity Toolkit REST API
 * for accounts migrated from the Spark plan (`${username.toLowerCase()}@darkgrid-rpg.firebaseapp.com`).
 */
async function verifyPasswordWithFirebaseAuth(username, password) {
  const lowerUser = String(username || '').trim().toLowerCase();
  if (!lowerUser || !password) return null;

  const synthEmail = `${lowerUser}@${FIREBASE_PROJECT_ID}.firebaseapp.com`;
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: synthEmail,
        password,
        returnSecureToken: true
      })
    });
    if (!resp.ok) {
      return null;
    }
    const data = await resp.json();
    if (!data || !data.localId) {
      return null;
    }
    return {
      uid: data.localId,
      email: data.email,
      displayName: data.displayName || username,
      idToken: data.idToken
    };
  } catch {
    return null;
  }
}

module.exports = {
  verifyFirebaseIdToken,
  verifyPasswordWithFirebaseAuth
};
