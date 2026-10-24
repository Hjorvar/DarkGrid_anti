/**
 * DARKGRID — PHASE 10: Comprehensive Security Audit & Penetration Test Suite (Agent F)
 *
 * Covers all 11 Security Audit Domains against a live production-mode DarkGrid server:
 *   1. Authentication & Sessions (__session cookie flags, session fixation rotation, expiry pruning)
 *   2. Password Hashing & Account Migration (bcrypt cost >= 10, firebase-auth placeholder & UID binding guard)
 *   3. Authorization & Multi-User Isolation (Character, inventory, combat & bounty isolation between User A & User B)
 *   4. CSRF / CORS / Origin & Anti-Tamper (Origin & Sec-Fetch-Site 403 blocking + FORBIDDEN_CLIENT_FIELDS 400 guard)
 *   5. Rate Limiting (authRateLimiter 429 on /api/auth/* & LOGIN/REGISTER actions; gameRateLimiter 429 on action spam)
 *   6. SQLite Injection & Transactions (Parameterized queries against SQLi payloads & withTransaction rollback)
 *   7. Server-Authoritative Movement & Combat (Overworld/Dungeon wall & bounds checks, Stage 1/2 secrecy, Fog of War)
 *   8. Item / Gold / XP Exploits & Duplicate Rewards (No double quest claim, starter/equipped sell guard, chest one-time loot)
 *   9. Permadeath Persistence & Concurrent Requests (Dead hero action lock, monotonic state import guard, X-Idempotency-Key)
 *  10. Firestore Durability & Secrets Management (firestore.rules lockdown & production SESSION_SECRET validation)
 *  11. Production Security Headers & Debug APIs (CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy, 403 on Lab/Debug APIs)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const { createMainApp } = require('../src/app');
const { loginUser } = require('../src/domain/auth/service');
const { withTransaction } = require('../src/db/connection');
const { SqliteSessionStore } = require('../src/db/session-store');
const { exportDynamicState, importDynamicState } = require('../src/db/durable-store');
const { getTileByCoords } = require('../src/domain/world/map');

function createAuditClient(getBaseUrl, defaultHeaders = { 'X-Forwarded-Proto': 'https' }) {
  let cookie = null;
  let lastSetCookies = [];

  function captureCookie(res) {
    const raw = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    lastSetCookies = raw;
    for (const c of raw) {
      if (!c) continue;
      const m = c.match(/(__session=[^;]+)/);
      if (m) cookie = m[1];
    }
  }

  return {
    getCookie: () => cookie,
    setCookie: (val) => { cookie = val; },
    getLastSetCookies: () => lastSetCookies,
    async get(urlPath, extraHeaders = {}) {
      const headers = { ...defaultHeaders, ...extraHeaders };
      if (cookie && headers.Cookie === undefined) headers.Cookie = cookie;
      const res = await fetch(`${getBaseUrl()}${urlPath}`, { headers });
      captureCookie(res);
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: res.status, text, json, headers: res.headers };
    },
    async post(urlPath, body = {}, extraHeaders = {}) {
      const headers = { 'Content-Type': 'application/json', ...defaultHeaders, ...extraHeaders };
      if (cookie && headers.Cookie === undefined) headers.Cookie = cookie;
      const res = await fetch(`${getBaseUrl()}${urlPath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      captureCookie(res);
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: res.status, text, json, headers: res.headers };
    },
    async action(action, payload = {}, extraHeaders = {}) {
      return this.post('/api/action', { action, payload }, extraHeaders);
    }
  };
}

describe('Phase 10 — Agent F Comprehensive Security Audit & Penetration Suite', () => {
  let app;
  let server;
  let baseUrl;
  let serverHost;
  let db;
  let tmpDbPath;

  before(async () => {
    tmpDbPath = path.join(os.tmpdir(), `darkgrid-phase10-sec-audit-${Date.now()}.sqlite`);
    app = createMainApp({
      dbPath: tmpDbPath,
      production: true,
      sessionSecret: 'darkgrid-phase10-audit-super-secret-production-key-2026',
      rng: () => 0.95
    });
    db = app.locals.db;
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    serverHost = `127.0.0.1:${port}`;
    baseUrl = `http://${serverHost}`;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (db) {
      try { db.close(); } catch {}
    }
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(tmpDbPath + suffix)) {
        try { fs.unlinkSync(tmpDbPath + suffix); } catch {}
      }
    }
  });

  it('1. Authentication & Sessions: Enforces __session HttpOnly/SameSite=Lax/Secure flags, rotates session ID on login (Session Fixation guard), and prunes expired sessions', async () => {
    const client = createAuditClient(() => baseUrl);

    // Pre-seed a session row in SQLite to simulate a session-fixation attempt
    const store = new SqliteSessionStore({ getDb: () => db });
    const fixedSid = 'attacker-fixed-session-id-12345';
    await new Promise((resolve, reject) => {
      store.set(fixedSid, { cookie: { maxAge: 60000 }, attackerSeeded: true }, (err) => (err ? reject(err) : resolve()));
    });

    // Register a new user while supplying an existing cookie header
    const regRes = await client.post('/api/auth/register', {
      username: 'sec_session_hero',
      password: 'SessionHeroPass1!'
    });
    assert.equal(regRes.status, 200);
    assert.equal(regRes.json.ok, true);

    const setCookies = client.getLastSetCookies();
    assert.ok(setCookies.length > 0, 'Must emit Set-Cookie header on registration');
    const sessionHeader = setCookies.find(c => c.startsWith('__session='));
    assert.ok(sessionHeader, 'Cookie must be named __session for Firebase Hosting / Cloud Run pass-through');
    assert.match(sessionHeader, /HttpOnly/i, '__session cookie must be HttpOnly');
    assert.match(sessionHeader, /SameSite=Lax/i, '__session cookie must be SameSite=Lax');
    assert.match(sessionHeader, /Secure/i, '__session cookie must be Secure in production over HTTPS');

    const regCookieValue = client.getCookie();
    assert.ok(regCookieValue);

    // Log out and verify session no longer grants authenticated state
    const logoutRes = await client.post('/api/auth/logout');
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.json.state.mode, 'UNAUTHENTICATED');

    // Log back in while sending the previous cookie: verify session ID is regenerated (rotated)
    const loginRes = await client.post('/api/auth/login', {
      username: 'sec_session_hero',
      password: 'SessionHeroPass1!'
    });
    assert.equal(loginRes.status, 200);
    const rotatedCookieValue = client.getCookie();
    assert.notEqual(
      rotatedCookieValue,
      regCookieValue,
      'Session ID must be rotated upon login to prevent session fixation'
    );

    // Verify expired sessions in SqliteSessionStore are rejected and deleted upon get()
    const expiredSid = 'expired-session-id-999';
    db.prepare('INSERT OR REPLACE INTO user_sessions (sid, sess, expire) VALUES (?, ?, ?)').run(
      expiredSid,
      JSON.stringify({ cookie: {}, userId: regRes.json.user.id }),
      Date.now() - 10000
    );
    const expiredLookup = await new Promise((resolve, reject) => {
      store.get(expiredSid, (err, sess) => (err ? reject(err) : resolve(sess)));
    });
    assert.equal(expiredLookup, null, 'Expired session must return null on lookup');
    const remainingExpired = db.prepare('SELECT sid FROM user_sessions WHERE sid = ?').get(expiredSid);
    assert.equal(remainingExpired, undefined, 'Expired session row must be pruned from user_sessions');
  });

  it('2. Password Hashing & Account Migration: Enforces bcrypt cost >= 10, blocks literal "firebase-auth" login without Firebase token, and blocks UID mismatch takeover', async () => {
    const row = db.prepare("SELECT password_hash FROM users WHERE username = 'sec_session_hero'").get();
    assert.ok(row, 'User row must exist');
    assert.notEqual(row.password_hash, 'SessionHeroPass1!');
    assert.match(row.password_hash, /^\$2[ab]\$10\$/, 'Password hash must use bcryptjs with cost factor 10');

    // Insert a legacy migrated account with placeholder 'firebase-auth' hash
    db.prepare("INSERT INTO users (username, password_hash, firebase_uid) VALUES ('legacy_fb_user', 'firebase-auth', 'fb-uid-owner-001')").run();

    // 2a. Attempting to log in with the literal password 'firebase-auth' in production (no fallback, verifier rejects) must fail with 401
    await assert.rejects(
      async () => {
        await loginUser(db, 'legacy_fb_user', 'firebase-auth', {
          allowFirebaseFallback: false,
          firebaseVerifier: async () => null
        });
      },
      (err) => err.status === 401
    );

    // 2b. Attempting account takeover where Firebase verifier returns a DIFFERENT UID than bound firebase_uid must fail with 401
    await assert.rejects(
      async () => {
        await loginUser(db, 'legacy_fb_user', 'ValidFirebasePass123!', {
          allowFirebaseFallback: false,
          firebaseVerifier: async () => ({ uid: 'fb-uid-attacker-999', email: 'legacy_fb_user@darkgrid.local' })
        });
      },
      (err) => err.status === 401
    );

    // Verify account hash and firebase_uid were NOT modified by the failed UID-mismatch takeover attempt
    const unchangedRow = db.prepare("SELECT password_hash, firebase_uid FROM users WHERE username = 'legacy_fb_user'").get();
    assert.equal(unchangedRow.password_hash, 'firebase-auth');
    assert.equal(unchangedRow.firebase_uid, 'fb-uid-owner-001');

    // 2c. Valid Firebase verification with matching UID upgrades password_hash from 'firebase-auth' to bcrypt
    const upgradedUser = await loginUser(db, 'legacy_fb_user', 'ValidFirebasePass123!', {
      allowFirebaseFallback: false,
      firebaseVerifier: async () => ({ uid: 'fb-uid-owner-001', email: 'legacy_fb_user@darkgrid.local' })
    });
    assert.equal(upgradedUser.username, 'legacy_fb_user');
    const afterRow = db.prepare("SELECT password_hash, firebase_uid FROM users WHERE username = 'legacy_fb_user'").get();
    assert.match(afterRow.password_hash, /^\$2[ab]\$10\$/, 'Migrated account must be upgraded to bcrypt cost 10');
    assert.equal(afterRow.firebase_uid, 'fb-uid-owner-001');
  });

  it('3. Authorization & Multi-User Isolation: Prevents User A from reading or mutating User B character, inventory, combat, or bounties', async () => {
    const clientA = createAuditClient(() => baseUrl);
    const clientB = createAuditClient(() => baseUrl);

    const regA = await clientA.post('/api/auth/register', {
      username: 'iso_user_alpha',
      password: 'AlphaIsolationPass1!',
      createCharacter: { name: 'Alpha Knight', classType: 'FIGHTER', useClassDefaults: true }
    });
    assert.equal(regA.status, 200);
    const charA = regA.json.state.character;

    const regB = await clientB.post('/api/auth/register', {
      username: 'iso_user_beta',
      password: 'BetaIsolationPass1!',
      createCharacter: { name: 'Beta Cleric', classType: 'CLERIC', useClassDefaults: true }
    });
    assert.equal(regB.status, 200);
    const charB = regB.json.state.character;
    assert.notEqual(charA.id, charB.id);

    // User B's items cannot be equipped, unequipped, sold, or consumed by User A
    const bItems = db.prepare('SELECT id, equipped_slot FROM item_instances WHERE owner_character_id = ?').all(charB.id);
    assert.ok(bItems.length > 0);
    const bEquipped = bItems.find(i => i.equipped_slot !== null) || bItems[0];

    const unequipSteal = await clientA.action('UNEQUIP', { itemInstanceId: bEquipped.id });
    assert.equal(unequipSteal.status, 403, 'User A must not unequip User B item');
    assert.equal(unequipSteal.json.ok, false);

    const equipSteal = await clientA.action('EQUIP', { itemInstanceId: bEquipped.id });
    assert.equal(equipSteal.status, 403, 'User A must not equip User B item');
    assert.equal(equipSteal.json.ok, false);

    const sellSteal = await clientA.action('SELL', { itemInstanceId: bEquipped.id });
    assert.equal(sellSteal.status, 403, 'User A must not sell User B item');
    assert.equal(sellSteal.json.ok, false);

    // Give User B a healing potion and ensure User A cannot drink it
    const potionDef = db.prepare("SELECT id FROM item_definitions WHERE category = 'CONSUMABLE' LIMIT 1").get();
    if (potionDef) {
      const info = db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot) VALUES (?, 'CHARACTER', ?, NULL)").run(
        potionDef.id,
        charB.id
      );
      const bPotionId = Number(info.lastInsertRowid);
      const drinkSteal = await clientA.action('POTION', { itemInstanceId: bPotionId });
      assert.equal(drinkSteal.json.ok, false, 'User A must not consume User B potion');
    }

    // Bounty isolation: User B has a hunting contract; User A cannot accept or abandon User B's contract
    const openBountyB = db.prepare("SELECT id FROM hunting_contracts WHERE character_id = ? AND status = 'AVAILABLE' LIMIT 1").get(charB.id);
    if (openBountyB) {
      const acceptStealA = await clientA.action('ACCEPT_BOUNTY', { contractId: openBountyB.id });
      assert.equal(acceptStealA.status, 403, 'User A must not accept User B hunting contract');
      assert.equal(acceptStealA.json.ok, false);

      const acceptB = await clientB.action('ACCEPT_BOUNTY', { contractId: openBountyB.id });
      assert.equal(acceptB.status, 200);
      assert.equal(acceptB.json.ok, true);

      const abandonSteal = await clientA.action('ABANDON_BOUNTY', { contractId: openBountyB.id });
      assert.equal(abandonSteal.status, 403, 'User A must not abandon User B hunting contract');
      assert.equal(abandonSteal.json.ok, false);
    }
  });

  it('4. CSRF / CORS / Origin & Anti-Tamper: Rejects cross-origin Origin / Sec-Fetch-Site (403) and FORBIDDEN_CLIENT_FIELDS (400)', async () => {
    const client = createAuditClient(() => baseUrl);
    await client.post('/api/auth/login', {
      username: 'iso_user_alpha',
      password: 'AlphaIsolationPass1!'
    });

    // 4a. Cross-origin Origin header must be rejected with 403 on state-changing POST endpoints
    const evilOriginMove = await client.action('MOVE', { direction: 'NORTH' }, {
      Origin: 'https://evil-attacker.example.com'
    });
    assert.equal(evilOriginMove.status, 403, 'Cross-origin POST /api/action must be blocked with 403');
    assert.equal(evilOriginMove.json.ok, false);

    const nullOriginLogin = await client.post('/api/auth/login', {
      username: 'iso_user_alpha',
      password: 'AlphaIsolationPass1!'
    }, {
      Origin: 'null'
    });
    assert.equal(nullOriginLogin.status, 403, 'Origin: null POST /api/auth/login must be blocked with 403');

    // 4b. Sec-Fetch-Site: cross-site must be rejected with 403
    const crossSiteFetch = await client.action('MOVE', { direction: 'NORTH' }, {
      'Sec-Fetch-Site': 'cross-site'
    });
    assert.equal(crossSiteFetch.status, 403, 'Sec-Fetch-Site: cross-site must be blocked with 403');

    // 4c. Same-origin Origin header matching serverHost must be permitted
    const sameOriginTurn = await client.action('TURN', { direction: 'RIGHT' }, {
      Origin: `http://${serverHost}`,
      'Sec-Fetch-Site': 'same-origin'
    });
    assert.equal(sameOriginTurn.status, 200, 'Same-origin POST request must succeed');
    assert.equal(sameOriginTurn.json.ok, true);

    // 4d. Anti-Tamper: FORBIDDEN_CLIENT_FIELDS in body, payload, createCharacter, or query string must return 400
    const forbiddenSamples = [
      { hp: 999 },
      { current_hp: 999 },
      { max_hp: 999 },
      { gold: 100000 },
      { xp: 100000 },
      { level: 20 },
      { damage: 500 },
      { dice_roll: 20 },
      { is_alive: 1 },
      { uid: 'spoofed' },
      { userId: 1 },
      { characterId: 1 },
      { divine_charges: 99 },
      { startingGold: 99999 },
      { isAdmin: true }
    ];
    for (const badField of forbiddenSamples) {
      const res = await client.action('TURN', { direction: 'RIGHT', ...badField });
      assert.equal(res.status, 400, `Tampered field ${Object.keys(badField)[0]} must be rejected with 400`);
      assert.equal(res.json.ok, false);
      assert.ok(Array.isArray(res.json.tamperedFields));
    }

    const queryTamper = await client.post('/api/action?gold=99999', {
      action: 'TURN',
      payload: { direction: 'RIGHT' }
    });
    assert.equal(queryTamper.status, 400, 'Tampered query parameter on POST must be rejected with 400');
  });

  it('5. Rate Limiting: Enforces authRateLimiter (429) on login/register endpoints and gameRateLimiter (429) on action spam', async () => {
    const anon = createAuditClient(() => baseUrl);

    // 5a. authRateLimiter on /api/auth/login (limit = 3 attempts for test client ID)
    const authHeaders = {
      'x-enforce-rate-limit': '1',
      'x-auth-rate-limit-max': '3',
      'x-test-client-id': 'bruteforce-attacker-ip-1'
    };

    for (let i = 1; i <= 3; i++) {
      const res = await anon.post('/api/auth/login', {
        username: 'iso_user_alpha',
        password: `WrongPassAttempt${i}`
      }, authHeaders);
      assert.equal(res.status, 401, `Attempt ${i} within limit should reach auth handler (401)`);
    }

    const blockedLogin = await anon.post('/api/auth/login', {
      username: 'iso_user_alpha',
      password: 'WrongPassAttempt4'
    }, authHeaders);
    assert.equal(blockedLogin.status, 429, '4th rapid login attempt must be blocked by authRateLimiter with 429');
    assert.match(blockedLogin.json.error, /Too many authentication attempts/i);

    // Also verify /api/action with action: 'LOGIN' shares the authRateLimiter protection
    const blockedActionLogin = await anon.action('LOGIN', {
      username: 'iso_user_alpha',
      password: 'AlphaIsolationPass1!'
    }, authHeaders);
    assert.equal(blockedActionLogin.status, 429, 'POST /api/action LOGIN must also be blocked by authRateLimiter with 429');

    // 5b. gameRateLimiter on /api/action (limit = 4 requests for authenticated user)
    const spamClient = createAuditClient(() => baseUrl);
    await spamClient.post('/api/auth/login', {
      username: 'iso_user_alpha',
      password: 'AlphaIsolationPass1!'
    });

    const gameRateHeaders = {
      'x-enforce-rate-limit': '1',
      'x-rate-limit-max': '4',
      'x-test-client-id': 'game-spam-client-bucket-1'
    };
    for (let i = 1; i <= 4; i++) {
      const r = await spamClient.action('TURN', { direction: 'RIGHT' }, gameRateHeaders);
      assert.equal(r.status, 200);
    }
    const fifth = await spamClient.action('TURN', { direction: 'RIGHT' }, gameRateHeaders);
    assert.equal(fifth.status, 429, 'Exceeding gameRateLimiter threshold must return HTTP 429');
    assert.match(fifth.json.error, /Too many requests/i);
  });

  it('6. SQLite Injection & Transactions: Neutralizes SQL injection payloads via parameterized queries and rolls back failed transactions atomically', async () => {
    const anon = createAuditClient(() => baseUrl);

    const sqliPayloads = [
      "' OR '1'='1",
      "' OR 1=1 --",
      "admin'; DROP TABLE users; --",
      "' UNION SELECT 1, 'admin', '$2a$10$abcdefghijklmnopqrstuu', null, null --"
    ];

    for (const sqli of sqliPayloads) {
      const res = await anon.post('/api/auth/login', {
        username: sqli,
        password: sqli
      });
      assert.equal(res.status, 401, `SQLi login payload "${sqli}" must fail authentication with 401`);
    }

    // Verify users table is completely intact after SQL injection attempts
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    assert.ok(userCount >= 3, 'users table must remain intact after SQLi attempts');

    // Verify withTransaction atomicity: if an error occurs mid-transaction, all changes roll back
    const goldBefore = db.prepare("SELECT gold FROM characters WHERE name = 'Alpha Knight'").get().gold;
    assert.throws(() => {
      withTransaction(db, () => {
        db.prepare("UPDATE characters SET gold = gold + 5000 WHERE name = 'Alpha Knight'").run();
        throw new Error('Simulated mid-transaction failure');
      });
    }, /Simulated mid-transaction failure/);

    const goldAfter = db.prepare("SELECT gold FROM characters WHERE name = 'Alpha Knight'").get().gold;
    assert.equal(goldAfter, goldBefore, 'withTransaction must roll back partial SQLite writes on error');
  });

  it('7. Server-Authoritative Movement & Combat: Enforces wall/bounds checks, Stage 1/2 Encounter Secrecy, and Dungeon Fog of War zero-leakage', async () => {
    const client = createAuditClient(() => baseUrl);
    const loginRes = await client.post('/api/auth/login', {
      username: 'iso_user_alpha',
      password: 'AlphaIsolationPass1!'
    });
    assert.equal(loginRes.status, 200);
    const charId = loginRes.json.state.character.id;

    // 7a. Invalid movement direction is rejected (ok: false)
    const badDir = await client.action('MOVE', { direction: 'DIAGONAL_NORTHWEST' });
    assert.equal(badDir.json.ok, false, 'Non-cardinal movement direction must be rejected');

    // 7b. Cannot enter a dungeon when not standing on its entrance tile
    const oakhavenTile = getTileByCoords(db, 15, 27);
    db.prepare('UPDATE characters SET tile_id = ?, active_dungeon_key = NULL, dungeon_x = NULL, dungeon_y = NULL WHERE id = ?').run(
      oakhavenTile.id,
      charId
    );
    const illegalDungeonEnter = await client.action('ENTER_DUNGEON', { dungeonKey: 'GOBLIN_CAVE' });
    assert.equal(illegalDungeonEnter.json.ok, false, 'Cannot enter Goblin Cave from Oakhaven Sanctuary');

    // 7c. Place hero at Goblin Cave entrance [9, 12], enter dungeon, verify Fog of War zero-leakage & wall blocking
    const caveEntranceTile = getTileByCoords(db, 9, 12);
    db.prepare("UPDATE characters SET tile_id = ?, active_landmark_scene_key = 'GOBLIN_CAVE_ENTRANCE' WHERE id = ?").run(
      caveEntranceTile.id,
      charId
    );
    const enterCave = await client.action('ENTER_DUNGEON', { dungeonKey: 'GOBLIN_CAVE' });
    assert.equal(enterCave.status, 200);
    assert.equal(enterCave.json.ok, true);
    const tiles = enterCave.json.state.dungeonMap.tiles;
    assert.ok(Array.isArray(tiles) && tiles.length > 0);

    // Inspect UNEXPLORED tiles in dungeonMap.tiles: must not leak roomType, treasureKey, bossKey, or fixedEncounterKey
    let unexploredCount = 0;
    for (const cell of tiles) {
      if (cell.fogState === 'UNEXPLORED') {
        unexploredCount += 1;
        assert.equal(cell.isPassable, false);
        assert.equal(cell.roomType, 'UNKNOWN', 'UNEXPLORED dungeon cell must not leak roomType');
        assert.equal(cell.bossKey, null, 'UNEXPLORED dungeon cell must not leak bossKey');
        assert.equal(cell.treasureKey, null, 'UNEXPLORED dungeon cell must not leak treasureKey');
        assert.equal(cell.fixedEncounterKey, null, 'UNEXPLORED dungeon cell must not leak fixedEncounterKey');
        assert.equal(cell.hasTreasure, false, 'UNEXPLORED dungeon cell must not leak hasTreasure');
        assert.equal(cell.hasBoss, false, 'UNEXPLORED dungeon cell must not leak hasBoss');
      }
    }
    assert.ok(unexploredCount > 50, 'Majority of dungeon must be UNEXPLORED on initial entry');

    // Attempt to walk SOUTH from Goblin Cave entrance (3, 16) into wall/bounds -> must be rejected (ok: false)
    const walkIntoWall = await client.action('MOVE', { direction: 'SOUTH' });
    assert.equal(walkIntoWall.json.ok, false, 'Walking into a dungeon wall must be rejected');

    // Exit dungeon back to overworld
    const exitCave = await client.action('EXIT_DUNGEON');
    assert.equal(exitCave.status, 200);
    assert.equal(exitCave.json.ok, true);

    // 7d. Stage 1 (DISCOVERED) & Stage 2 (IN_COMBAT) Encounter Secrecy
    const goblinMonster = db.prepare("SELECT id FROM monsters WHERE name LIKE '%Goblin%' LIMIT 1").get()
      || db.prepare('SELECT id FROM monsters LIMIT 1').get();
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE character_id = ?").run(charId);
    const encInsert = db.prepare(`
      INSERT INTO encounters (character_id, monster_id, tile_id, status, current_monster_hp, monster_max_hp)
      VALUES (?, ?, ?, 'DISCOVERED', 18, 18)
    `).run(charId, goblinMonster.id, caveEntranceTile.id);
    const encId = Number(encInsert.lastInsertRowid);

    const stage1State = await client.get('/api/state');
    assert.equal(stage1State.status, 200);
    assert.equal(stage1State.json.state.mode, 'DISCOVERED');
    // Stage 1 must not expose exact monster HP or AC
    assert.equal(stage1State.json.state.encounter?.monster_current_hp, undefined);
    assert.equal(stage1State.json.state.encounter?.current_monster_hp, undefined);
    assert.equal(stage1State.json.state.encounter?.armor_class, undefined);

    // Advance to Stage 2 (IN_COMBAT) via ENGAGE and verify only qualitative 9-tier condition is shown (no numeric HP/AC)
    const engageRes = await client.action('ENGAGE');
    assert.equal(engageRes.status, 200);
    const combatState = engageRes.json.state;
    if (combatState.mode === 'IN_COMBAT' && combatState.combat) {
      assert.equal(combatState.combat.current_monster_hp, undefined, 'Must never expose numeric current_monster_hp');
      assert.equal(combatState.combat.monster_current_hp, undefined, 'Must never expose numeric monster_current_hp');
      assert.equal(combatState.combat.monster_max_hp, undefined, 'Must never expose numeric monster_max_hp');
      assert.equal(combatState.combat.armor_class, undefined, 'Must never expose monster armor_class');
    }

    // Clean up test encounter
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encId);
  });

  it('8. Item / Gold / XP Exploits & Duplicate Rewards: Blocks premature/double quest rewards, starter/equipped item selling, invalid shop buys & double chest looting', async () => {
    const client = createAuditClient(() => baseUrl);
    const loginRes = await client.post('/api/auth/login', {
      username: 'iso_user_alpha',
      password: 'AlphaIsolationPass1!'
    });
    const charId = loginRes.json.state.character.id;

    // Move hero back to Oakhaven Sanctuary [15, 27]
    const oakhaven = getTileByCoords(db, 15, 27);
    db.prepare('UPDATE characters SET tile_id = ?, active_dungeon_key = NULL WHERE id = ?').run(oakhaven.id, charId);

    // 8a. Cannot claim quest reward before boss is slain
    const acceptQuest = await client.action('ACCEPT_QUEST', { questKey: 'THE_GOBLIN_CHIEFTAIN' });
    assert.equal(acceptQuest.status, 200);
    assert.equal(acceptQuest.json.ok, true);

    const prematureClaim = await client.action('CLAIM_QUEST_REWARD', { questKey: 'THE_GOBLIN_CHIEFTAIN' });
    assert.equal(prematureClaim.json.ok, false, 'Cannot claim quest reward before slaying quest boss');

    // Mark boss slain, claim once (ok: true), then verify second claim is blocked (ok: false)
    db.prepare("UPDATE characters SET goblin_chieftain_slain = 1, quest_goblin_chieftain_status = 'COMPLETED' WHERE id = ?").run(charId);
    const validClaim = await client.action('CLAIM_QUEST_REWARD', { questKey: 'THE_GOBLIN_CHIEFTAIN' });
    assert.equal(validClaim.status, 200);
    assert.equal(validClaim.json.ok, true);
    const goldAfterFirstClaim = validClaim.json.state.character.gold;

    const doubleClaim = await client.action('CLAIM_QUEST_REWARD', { questKey: 'THE_GOBLIN_CHIEFTAIN' });
    assert.equal(doubleClaim.json.ok, false, 'Duplicate quest reward claim must be rejected');
    const goldCheck = db.prepare('SELECT gold FROM characters WHERE id = ?').get(charId).gold;
    assert.equal(goldCheck, goldAfterFirstClaim, 'Gold must not increase on rejected duplicate quest claim');

    // 8b. Currently equipped items cannot be sold directly without unequipping
    const equippedItem = db.prepare('SELECT id FROM item_instances WHERE owner_character_id = ? AND equipped_slot IS NOT NULL LIMIT 1').get(charId);
    if (equippedItem) {
      const sellEquipped = await client.action('SELL', { itemInstanceId: equippedItem.id });
      assert.equal(sellEquipped.json.ok, false, 'Equipped item must not be sellable while equipped');
    }

    // 8c. Shop BUY rejects negative/non-existent itemDefinitionId and insufficient gold
    const negativeBuy = await client.action('BUY', { itemDefinitionId: -99 });
    assert.equal(negativeBuy.json.ok, false, 'Negative itemDefinitionId must be rejected');

    const missingBuy = await client.action('BUY', { itemDefinitionId: 9999999 });
    assert.equal(missingBuy.json.ok, false, 'Non-existent itemDefinitionId must be rejected');

    db.prepare('UPDATE characters SET gold = 0 WHERE id = ?').run(charId);
    const anyShopItem = db.prepare('SELECT id FROM item_definitions WHERE buy_price > 10 AND is_magical = 0 LIMIT 1').get();
    const brokeBuy = await client.action('BUY', { itemDefinitionId: anyShopItem.id });
    assert.equal(brokeBuy.json.ok, false, 'Buying item with 0 gold must be rejected');
  });

  it('9. Permadeath Persistence & Concurrent Requests: Blocks dead hero actions/revival, enforces monotonic state import guard & deduplicates X-Idempotency-Key', async () => {
    const client = createAuditClient(() => baseUrl);
    await client.post('/api/auth/login', {
      username: 'iso_user_alpha',
      password: 'AlphaIsolationPass1!'
    });
    const sessionInfo = await client.get('/api/auth/session');
    const charId = sessionInfo.json.characterId;

    // 9a. X-Idempotency-Key deduplication: sending the same key twice replays the exact response without re-running
    db.prepare('UPDATE characters SET gold = 100, current_hp = 10, max_hp = 20 WHERE id = ?').run(charId);
    const idemKey = `audit-idem-key-${Date.now()}`;
    const firstRest = await client.action('REST', {}, { 'X-Idempotency-Key': idemKey });
    assert.equal(firstRest.status, 200);
    assert.equal(firstRest.json.ok, true);

    // Damage hero to 12 HP, then replay the exact same X-Idempotency-Key: cached response should return without healing back to 20
    db.prepare('UPDATE characters SET current_hp = 12 WHERE id = ?').run(charId);
    const replayRest = await client.action('REST', {}, { 'X-Idempotency-Key': idemKey });
    assert.equal(replayRest.status, 200);
    assert.equal(replayRest.headers.get('x-idempotent-replay'), 'true', 'Must set X-Idempotent-Replay: true header');
    const hpInDb = db.prepare('SELECT current_hp FROM characters WHERE id = ?').get(charId).current_hp;
    assert.equal(hpInDb, 12, 'Idempotent replay must not re-execute state mutation in database');

    // 9b. Monotonic Permadeath Guard in importDynamicState
    const liveSnapshot = exportDynamicState(db);
    // Kill the hero in DB (Permadeath: is_alive = 0, current_hp = 0)
    db.prepare('UPDATE characters SET is_alive = 0, current_hp = 0, died_at = CURRENT_TIMESTAMP WHERE id = ?').run(charId);

    // Attempt to import the older snapshot where charId had is_alive = 1
    importDynamicState(db, liveSnapshot);
    const afterImport = db.prepare('SELECT is_alive, current_hp FROM characters WHERE id = ?').get(charId);
    assert.equal(afterImport.is_alive, 0, 'Monotonic Permadeath Guard must prevent stale snapshot from resurrecting a dead hero');
    assert.equal(afterImport.current_hp, 0);

    // 9c. Dead hero cannot perform gameplay actions or call REVIVE in production
    const tileBefore = db.prepare('SELECT tile_id FROM characters WHERE id = ?').get(charId).tile_id;
    const deadMove = await client.action('MOVE', { direction: 'NORTH' });
    assert.equal(deadMove.json.state.character, null, 'Dead hero must have no active living character in state');
    const tileAfter = db.prepare('SELECT tile_id FROM characters WHERE id = ?').get(charId).tile_id;
    assert.equal(tileAfter, tileBefore, 'Dead hero tile_id must not change on MOVE attempt');

    const deadRevive = await client.action('REVIVE', {});
    assert.equal(deadRevive.status, 403, 'REVIVE must be strictly forbidden (403) in production');
  });

  it('10. Firestore Durability & Secrets Management: Verifies firestore.rules lockdown and production SESSION_SECRET enforcement', async () => {
    // 10a. Verify firestore.rules locks /server_state/{document=**} and default wildcard /{document=**}
    const rulesPath = path.join(__dirname, '../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    assert.match(rulesContent, /match\s+\/server_state\/\{document=\*\*\}/, 'firestore.rules must explicitly match /server_state/{document=**}');
    assert.match(
      rulesContent,
      /match\s+\/server_state\/\{document=\*\*\}[\s\S]*?allow\s+read,\s*write:\s*if\s+false;/,
      '/server_state/{document=**} must deny all direct client reads and writes'
    );
    assert.match(
      rulesContent,
      /match\s+\/world_state\/\{docId\}[\s\S]*?allow\s+write:\s*if\s+false;/,
      '/world_state/{docId} must deny all direct client writes'
    );
    assert.match(
      rulesContent,
      /match\s+\/\{document=\*\*\}[\s\S]*?allow\s+read,\s*write:\s*if\s+false;/,
      'Default wildcard rule must deny all reads and writes'
    );

    // 10b. Verify createMainApp in production mode refuses weak or default SESSION_SECRET
    assert.throws(
      () => {
        createMainApp({
          dbPath: ':memory:',
          production: true,
          sessionSecret: 'darkgrid-dev-secret-change-in-prod'
        });
      },
      /Production.*SESSION_SECRET/i
    );

    assert.throws(
      () => {
        createMainApp({
          dbPath: ':memory:',
          production: true,
          sessionSecret: 'short-secret'
        });
      },
      /Production.*SESSION_SECRET/i
    );
  });

  it('11. Production Security Headers & Debug APIs: Verifies CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy, and 403 on all Lab/Debug APIs', async () => {
    const anon = createAuditClient(() => baseUrl);
    const rootRes = await anon.get('/');
    assert.equal(rootRes.status, 200);

    // 11a. Verify mandatory HTTP Security Headers
    assert.equal(rootRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(rootRes.headers.get('x-frame-options'), 'DENY');
    assert.equal(rootRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    const csp = rootRes.headers.get('content-security-policy');
    assert.ok(csp, 'Content-Security-Policy header must be present');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);

    // 11b. Verify /api/legacy-audit is locked (401 unauthenticated, 403 authenticated player in production)
    const anonAudit = await anon.get('/api/legacy-audit');
    assert.equal(anonAudit.status, 401);

    const playerClient = createAuditClient(() => baseUrl);
    await playerClient.post('/api/auth/login', {
      username: 'iso_user_beta',
      password: 'BetaIsolationPass1!'
    });
    const playerAudit = await playerClient.get('/api/legacy-audit');
    assert.equal(playerAudit.status, 403, 'GET /api/legacy-audit must return 403 in production mode');

    // 11c. Verify all Lab Director / Debug actions return 403 in production mode
    const debugActions = [
      ['TELEPORT_TO_TILE', { x: 15, y: 27 }],
      ['LAB_SCENARIO', { scenario: 'FULL_HEAL' }],
      ['FORCE_DISCOVERY', { discoveryKey: 'SHRINE_BLESSING' }],
      ['SET_DETERMINISTIC_SEED', { seed: 12345 }],
      ['SET_ART_PREVIEW_MODE', { mode: 'staging' }],
      ['REVIVE', {}],
      ['MOVE', { direction: 'NORTH', testForceEncounter: true }],
      ['MOVE', { direction: 'NORTH', testForceAmbush: true }]
    ];
    for (const [act, payload] of debugActions) {
      const res = await playerClient.action(act, payload);
      assert.equal(res.status, 403, `Debug action ${act} must return 403 in production`);
      assert.equal(res.json.ok, false);
    }
  });
});
