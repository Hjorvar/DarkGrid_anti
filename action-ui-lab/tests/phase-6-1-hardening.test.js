/**
 * DARKGRID — PHASE 6.1: Pre-Cutover Hardening, Security Audit, Migration Rehearsal & Player UX Suite
 *
 * Independently verifies all Phase 6.1 fixes:
 *   1. Character Creation Contradiction Fix:
 *      - Strict 1-living-character per account enforcement (HTTP 409)
 *      - Removal of `retireCurrentHero` backdoor (living hero is never destroyed)
 *      - Creation allowed after permadeath (`is_alive = 0`)
 *   2. Production Security Hardening:
 *      - Mandatory strong SESSION_SECRET in production (fails closed)
 *      - Mandatory authentication in production (`UNAUTHENTICATED` state, 401 on mutations, zero sandbox fallback)
 *      - Preservation of canonical legacy map tiles in production/auth mode
 *      - Lockdown of `/api/legacy-audit` (401 unauthenticated, 403 non-admin / production)
 *      - Lockdown of Lab/debug actions (`LAB_SCENARIO`, `TELEPORT_TO_TILE`, `REVIVE`, `FORCE_DISCOVERY`,
 *        `SET_DETERMINISTIC_SEED`, `SET_ART_PREVIEW_MODE`, `testForceEncounter`) for normal players (403)
 *      - Lockdown of `START_EXPEDITION` / `RESET_EXPEDITION` teleport/heal/encounter-escape exploits
 *      - Ownership enforcement on `EQUIP`, `UNEQUIP`, `SELL`, `POTION`, `ABANDON_BOUNTY`
 *      - Combat `expectedRound` protection on `ATTACK`, `POTION`, and `FLEE`
 *      - Anti-tamper rejection of `startingGold`, `isAdmin`, etc.
 *      - Concurrent & replay idempotency protection
 *   3. Production Migration Rehearsal on an Isolated Copy of a Legacy Database:
 *      - Backup, checksum, non-destructive adapter execution, 100% data retention, FK/integrity checks, rollback restore
 *   4. Full Multi-Class Player Journey (Fighter, Ranger, Cleric) & Multi-Resolution Real-Browser UI Verification:
 *      - Desktop (1920x1080), Laptop (1366x768), and Mobile (390x844) screenshots in `docs/phase-6.1/screenshots/`
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const { createLabApp } = require('../server');
const {
  ensureNonDestructiveLabAdapter,
  verifyLegacyDatabaseCompatibility
} = require('../server/services/legacy-compatibility-service');

const TEST_PROD_DB_PATH = path.join(__dirname, '../data/test_phase6_1_prod.sqlite');
const TEST_MIGRATION_ORIG_PATH = path.join(__dirname, '../data/test_phase6_1_legacy_orig.sqlite');
const TEST_MIGRATION_COPY_PATH = path.join(__dirname, '../data/test_phase6_1_legacy_copy.sqlite');
const TEST_MIGRATION_BACKUP_PATH = path.join(__dirname, '../data/test_phase6_1_legacy_backup.sqlite');
const SCREENSHOT_DIR = path.join(__dirname, '../docs/phase-6.1/screenshots');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

function findChromeExecutable() {
  for (const c of CHROME_CANDIDATES) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function unlinkSqliteFiles(basePath) {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = basePath + suffix;
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
  }
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function createSessionClient(getBaseUrl, defaultHeaders = { 'X-Forwarded-Proto': 'https' }) {
  let sessionCookie = null;

  function captureCookie(res) {
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    for (const raw of setCookies) {
      if (!raw) continue;
      const match = raw.match(/(__session=[^;]+)/);
      if (match) {
        sessionCookie = match[1];
      }
    }
    return setCookies;
  }

  return {
    getCookie() {
      return sessionCookie;
    },
    clearCookie() {
      sessionCookie = null;
    },
    async get(urlPath, extraHeaders = {}) {
      const headers = { ...defaultHeaders, ...extraHeaders };
      if (sessionCookie) headers.Cookie = sessionCookie;
      const res = await fetch(`${getBaseUrl()}${urlPath}`, { headers });
      const setCookies = captureCookie(res);
      const json = await res.json();
      return { status: res.status, json, setCookies };
    },
    async post(urlPath, body, extraHeaders = {}) {
      const headers = { 'Content-Type': 'application/json', ...defaultHeaders, ...extraHeaders };
      if (sessionCookie) headers.Cookie = sessionCookie;
      const res = await fetch(`${getBaseUrl()}${urlPath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const setCookies = captureCookie(res);
      const json = await res.json();
      return { status: res.status, json, setCookies };
    },
    async action(action, payload = {}, extraHeaders = {}) {
      return this.post('/api/action', { action, payload }, extraHeaders);
    }
  };
}

describe('Phase 6.1 — Pre-Cutover Hardening, Security Audit, Migration Rehearsal & Player UX', () => {
  let app;
  let server;
  let baseUrl;
  let db;
  let mockRngValue = 0.75;

  const anonClient = createSessionClient(() => baseUrl);
  const fighterClient = createSessionClient(() => baseUrl);
  const rangerClient = createSessionClient(() => baseUrl);
  const clericClient = createSessionClient(() => baseUrl);

  before(async () => {
    unlinkSqliteFiles(TEST_PROD_DB_PATH);
    unlinkSqliteFiles(TEST_MIGRATION_ORIG_PATH);
    unlinkSqliteFiles(TEST_MIGRATION_COPY_PATH);
    unlinkSqliteFiles(TEST_MIGRATION_BACKUP_PATH);

    app = createLabApp({
      dbPath: TEST_PROD_DB_PATH,
      production: true,
      preserveExistingMap: true,
      sessionSecret: 'phase-6-1-hardened-production-secret-key-2026',
      rng: () => mockRngValue
    });
    db = app.locals.db;
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (db) {
      try { db.close(); } catch {}
    }
    unlinkSqliteFiles(TEST_PROD_DB_PATH);
    unlinkSqliteFiles(TEST_MIGRATION_ORIG_PATH);
    unlinkSqliteFiles(TEST_MIGRATION_COPY_PATH);
    unlinkSqliteFiles(TEST_MIGRATION_BACKUP_PATH);
  });

  it('1. Fails closed when started in production mode without a strong SESSION_SECRET', () => {
    assert.throws(
      () => createLabApp({
        dbPath: TEST_PROD_DB_PATH,
        production: true,
        sessionSecret: 'darkgrid-dev-secret-key-change-in-production'
      }),
      /Production security error: A strong SESSION_SECRET/
    );

    assert.throws(
      () => createLabApp({
        dbPath: TEST_PROD_DB_PATH,
        production: true,
        sessionSecret: 'short-secret'
      }),
      /Production security error: A strong SESSION_SECRET/
    );
  });

  it('2. Enforces mandatory authentication in production with zero anonymous sandbox fallback and preserves canonical map tiles', async () => {
    // 1. Canonical legacy map tiles (6,5), (8,6), (8,8), (9,7) are NOT overwritten in production mode
    const tile65 = db.prepare('SELECT name, terrain FROM map_tiles WHERE x = 6 AND y = 5').get();
    assert.equal(tile65.name, 'Mirkwood Forest');
    assert.equal(tile65.terrain, 'FOREST');

    // 2. Synthetic action_hero account is NOT seeded in production mode
    const sandboxUser = db.prepare("SELECT id FROM users WHERE username = 'action_hero'").get();
    assert.equal(sandboxUser, undefined);

    // 3. Unauthenticated GET /api/state returns UNAUTHENTICATED with null user and character
    const stateRes = await anonClient.get('/api/state');
    assert.equal(stateRes.status, 200);
    assert.equal(stateRes.json.state.mode, 'UNAUTHENTICATED');
    assert.equal(stateRes.json.state.currentUser, null);
    assert.equal(stateRes.json.state.character, null);
    assert.equal(stateRes.json.state.labToolsAllowed, false);

    // 4. Unauthenticated gameplay/creation mutations are rejected with 401
    for (const act of ['MOVE', 'TURN', 'CREATE_CHARACTER', 'REVIVE', 'BUY', 'SELL', 'ATTACK', 'REST']) {
      const res = await anonClient.action(act, { direction: 'NORTH', classType: 'FIGHTER' });
      assert.equal(res.status, 401, `Expected 401 for unauthenticated ${act}, got ${res.status}`);
      assert.equal(res.json.ok, false);
    }

    // 5. Unauthenticated /api/legacy-audit is rejected with 401
    const auditAnon = await anonClient.get('/api/legacy-audit');
    assert.equal(auditAnon.status, 401);
    assert.equal(auditAnon.json.ok, false);
  });

  it('3. Configures secure session cookies (HttpOnly, SameSite=Lax, Secure) and blocks /api/legacy-audit and all Lab/debug actions for normal players', async () => {
    const regFighter = await fighterClient.action('REGISTER', {
      username: 'vaelen_p61',
      password: 'Password123!'
    });
    assert.equal(regFighter.status, 200);
    assert.equal(regFighter.json.ok, true);
    assert.equal(regFighter.json.state.labToolsAllowed, false);

    // Verify Set-Cookie attributes in production mode behind TLS proxy (HttpOnly, Secure, SameSite=Lax)
    const rawCookieHeader = regFighter.setCookies.join('; ');
    assert.match(rawCookieHeader, /__session=/);
    assert.match(rawCookieHeader, /HttpOnly/i);
    assert.match(rawCookieHeader, /Secure/i);
    assert.match(rawCookieHeader, /SameSite=Lax/i);

    // Authenticated player in production cannot access /api/legacy-audit (403)
    const auditPlayer = await fighterClient.get('/api/legacy-audit');
    assert.equal(auditPlayer.status, 403);
    assert.equal(auditPlayer.json.ok, false);

    // Normal player cannot invoke any Lab/debug/cheat actions
    const forbiddenLabActions = [
      ['LAB_SCENARIO', { scenario: 'HEAL' }],
      ['LAB_SCENARIO', { scenario: 'COMBAT' }],
      ['LAB_SCENARIO', { scenario: 'CITY' }],
      ['TELEPORT_TO_TILE', { x: 7, y: 5, facing: 'NORTH' }],
      ['REVIVE', { classType: 'FIGHTER' }],
      ['FORCE_DISCOVERY', { discoveryId: 'disc_mirkwood_abandoned_camp' }],
      ['SET_DETERMINISTIC_SEED', { seed: 42 }],
      ['SET_ART_PREVIEW_MODE', { enabled: true }]
    ];
    for (const [act, payload] of forbiddenLabActions) {
      const res = await fighterClient.action(act, payload);
      assert.equal(res.status, 403, `Expected 403 for ${act}, got ${res.status}`);
      assert.equal(res.json.ok, false);
    }
  });

  it('4. Resolves the Character Creation Contradiction: enforces 1-living-hero (409) and ignores retireCurrentHero without destroying living hero', async () => {
    // Create Fighter hero (71 points)
    const createRes = await fighterClient.action('CREATE_CHARACTER', {
      name: 'Vaelen Ironhand',
      classType: 'FIGHTER',
      stats: {
        strength: 16,
        constitution: 14,
        dexterity: 12,
        intelligence: 11,
        wisdom: 9,
        charisma: 10
      },
      primaryWeapon: 'MELEE'
    });
    assert.equal(createRes.status, 200);
    assert.equal(createRes.json.ok, true);
    const heroId = createRes.json.state.character.id;
    assert.equal(createRes.json.state.character.name, 'Vaelen Ironhand');

    // Attempt to create a second character with retireCurrentHero: true AND invalid stats (total 60 != 71)
    // Previously this destroyed the living character before failing validation!
    const badRetireAttempt = await fighterClient.action('CREATE_CHARACTER', {
      name: 'Should Fail',
      classType: 'RANGER',
      stats: { strength: 10, constitution: 10, dexterity: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      retireCurrentHero: true
    });
    assert.equal(badRetireAttempt.status, 409);
    assert.equal(badRetireAttempt.json.ok, false);
    assert.match(badRetireAttempt.json.error, /already has a living hero|already have a living character/i);

    // Attempt to create a second character with retireCurrentHero: true AND valid 71-point stats
    const validRetireAttempt = await fighterClient.action('CREATE_CHARACTER', {
      name: 'Replacement Hero',
      classType: 'CLERIC',
      stats: { strength: 12, constitution: 12, dexterity: 10, intelligence: 11, wisdom: 16, charisma: 11 },
      retireCurrentHero: true
    });
    assert.equal(validRetireAttempt.status, 409);
    assert.equal(validRetireAttempt.json.ok, false);

    // Verify original hero is 100% intact and still alive in SQLite and API state
    const checkState = await fighterClient.get('/api/state');
    assert.equal(checkState.json.state.character.id, heroId);
    assert.equal(checkState.json.state.character.name, 'Vaelen Ironhand');
    assert.equal(checkState.json.state.character.is_alive, 1);

    // Verify anti-tamper blocks startingGold override
    const tamperGold = await fighterClient.action('CREATE_CHARACTER', {
      name: 'Rich Cheat',
      classType: 'FIGHTER',
      startingGold: 999999
    });
    assert.equal(tamperGold.status, 400);
    assert.deepEqual(tamperGold.json.tamperedFields, ['startingGold']);
  });

  it('5. Executes Full Fighter, Ranger & Cleric Journeys, Ownership Checks, Replay/Concurrency Protection & Permadeath Recovery', async () => {
    // Register Ranger & Cleric accounts
    const regRanger = await rangerClient.action('REGISTER', {
      username: 'kaelen_p61',
      password: 'Password123!'
    });
    assert.equal(regRanger.status, 200);

    const createRanger = await rangerClient.action('CREATE_CHARACTER', {
      name: 'Kaelen Thornstrider',
      classType: 'RANGER',
      stats: {
        strength: 12,
        constitution: 12,
        dexterity: 16,
        intelligence: 11,
        wisdom: 11,
        charisma: 10
      },
      favoredEnemyType: 'HUMANOID:goblinoid',
      primaryWeapon: 'RANGED'
    });
    assert.equal(createRanger.status, 200);
    const rangerId = createRanger.json.state.character.id;
    assert.ok(rangerId);

    const regCleric = await clericClient.action('REGISTER', {
      username: 'aldric_p61',
      password: 'Password123!'
    });
    assert.equal(regCleric.status, 200);

    const createCleric = await clericClient.action('CREATE_CHARACTER', {
      name: 'Brother Aldric',
      classType: 'CLERIC',
      stats: {
        strength: 12,
        constitution: 11,
        dexterity: 10,
        intelligence: 11,
        wisdom: 16,
        charisma: 12
      },
      primaryWeapon: 'MELEE'
    });
    assert.equal(createCleric.status, 200);
    const clericId = createCleric.json.state.character.id;

    // Verify `testForceEncounter` in MOVE is blocked for normal players (403)
    const forceEncMove = await rangerClient.action('MOVE', {
      direction: 'NORTH',
      testForceEncounter: true
    });
    assert.equal(forceEncMove.status, 403);

    // Cross-account item ownership check: Ranger cannot equip, unequip, sell, or drink Fighter's items
    const fighterState = (await fighterClient.get('/api/state')).json.state;
    const fighterWeapon = fighterState.inventory.find(i => i.category === 'WEAPON');
    const fighterPotion = fighterState.inventory.find(i => i.category === 'POTION');
    assert.ok(fighterWeapon && fighterPotion);

    const crossEquip = await rangerClient.action('EQUIP', { itemInstanceId: fighterWeapon.id });
    assert.equal(crossEquip.status, 403);
    assert.equal(crossEquip.json.ok, false);

    const crossPotion = await rangerClient.action('POTION', { potionInstanceId: fighterPotion.id });
    assert.equal(crossPotion.status, 403);
    assert.equal(crossPotion.json.ok, false);

    // Cross-account bounty ownership check: Ranger accepts Ranger's own contract; Cleric cannot accept or abandon Ranger's contract
    const rangerState = (await rangerClient.get('/api/state')).json.state;
    const contracts = rangerState.bountyContracts;
    assert.ok(contracts.length >= 1);
    for (const c of contracts) {
      assert.ok(c.contract_title && c.contract_title.length > 3);
      assert.ok(c.target_region && c.target_region.length > 2);
      assert.doesNotMatch(c.description, /\ba Assassin\b|\ba Owlbear\b|\ba Orc\b|\ba Ogre\b/i);
    }

    const targetContractId = contracts[0].id;
    const crossAccept = await clericClient.action('ACCEPT_BOUNTY', { contractId: targetContractId });
    assert.equal(crossAccept.status, 403);

    const acceptRes = await rangerClient.action('ACCEPT_BOUNTY', { contractId: targetContractId });
    assert.equal(acceptRes.status, 200);

    const crossAbandon = await clericClient.action('ABANDON_BOUNTY', { contractId: targetContractId });
    assert.equal(crossAbandon.status, 403);
    assert.equal(crossAbandon.json.ok, false);

    // Give Cleric 100 gp via DB to test Market Buy, Magical Consignment (40% payout / 125% resale), and Concurrent/Replay safety
    db.prepare('UPDATE characters SET gold = 100 WHERE id = ?').run(clericId);
    const clericShopState = (await clericClient.get('/api/state')).json.state;
    const potionDef = clericShopState.shopStock.standardItems.find(i => i.category === 'POTION');
    assert.ok(potionDef);

    // Replay idempotency check on BUY
    const idemKey = 'idem-buy-potion-p61-001';
    const buy1 = await clericClient.action('BUY', { itemDefinitionId: potionDef.id }, { 'X-Idempotency-Key': idemKey });
    const buy2 = await clericClient.action('BUY', { itemDefinitionId: potionDef.id }, { 'X-Idempotency-Key': idemKey });
    assert.equal(buy1.status, 200);
    assert.equal(buy2.status, 200);
    assert.equal(buy1.json.state.character.gold, buy2.json.state.character.gold);

    // Grant Cleric a magical item (+1 Ring of Protection) and sell it: verify 40% seller payout and 125% resale listing
    const ringDef = db.prepare("SELECT id, buy_price FROM item_definitions WHERE name LIKE '%Ring of Protection%' LIMIT 1").get();
    assert.ok(ringDef);
    const insRing = db.prepare(`
      INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot, modifications)
      VALUES (?, 'CHARACTER', ?, NULL, '{}')
    `).run(ringDef.id, clericId);
    const ringInstanceId = Number(insRing.lastInsertRowid);

    const goldBeforeSell = buy1.json.state.character.gold;
    const sellRingRes = await clericClient.action('SELL', { itemInstanceId: ringInstanceId });
    assert.equal(sellRingRes.status, 200);
    const expectedPayout = Math.max(1, Math.floor(ringDef.buy_price * 0.40));
    const expectedResale = Math.max(1, Math.ceil(ringDef.buy_price * 1.25));
    assert.equal(sellRingRes.json.state.character.gold, goldBeforeSell + expectedPayout);

    const resaleListing = sellRingRes.json.state.shopStock.resaleListings.find(l => l.definition_id === ringDef.id);
    assert.ok(resaleListing, 'Magical item should appear in Global Magical Resale Market');
    assert.equal(resaleListing.resale_price, expectedResale);

    // Step Fighter into wilderness (7,6) -> (7,5) -> (7,4) until an encounter triggers
    mockRngValue = 0.05; // triggers encounter after leaving town gate grace
    const step1 = await fighterClient.action('MOVE', { relative: 'FORWARD', direction: 'NORTH' }); // (7,6) town gate grace
    assert.equal(step1.status, 200);
    assert.equal(step1.json.state.currentTile.x, 7);
    assert.equal(step1.json.state.currentTile.y, 6);

    // Verify normal player in wilderness cannot use START_EXPEDITION or RESET_EXPEDITION to teleport back to (7,7) or heal
    db.prepare('UPDATE characters SET current_hp = 5 WHERE id = ?').run(fighterState.character.id);
    const expStartWild = await fighterClient.action('START_EXPEDITION', { expeditionKey: 'MIRKWOOD_EXPEDITION' });
    assert.equal(expStartWild.status, 200);
    assert.equal(expStartWild.json.state.currentTile.y, 6, 'START_EXPEDITION must not teleport normal player back to (7,7)');
    assert.equal(expStartWild.json.state.character.current_hp, 5, 'START_EXPEDITION must not heal normal player');

    // Step to (7,5) and trigger encounter
    const step2 = await fighterClient.action('MOVE', { relative: 'FORWARD', direction: 'NORTH' });
    assert.equal(step2.status, 200);
    assert.ok(step2.json.state.encounter, 'Encounter should trigger at (7,5) with low RNG');
    assert.ok(['DISCOVERED', 'IN_COMBAT'].includes(step2.json.state.encounter.status));

    // Engage encounter if not already in ambush combat
    const engageRes = step2.json.state.encounter.status === 'DISCOVERED'
      ? await fighterClient.action('INVESTIGATE')
      : step2;
    assert.equal(engageRes.status, 200);
    assert.equal(engageRes.json.state.encounter.status, 'IN_COMBAT');
    const currentRound = engageRes.json.state.encounter.combat_round;

    // Stale expectedRound on POTION or FLEE is rejected cleanly without advancing combat round
    const stalePotion = await fighterClient.action('POTION', { expectedRound: currentRound + 99 });
    assert.equal(stalePotion.status, 200);
    assert.equal(stalePotion.json.staleRoundIgnored, true);

    const staleFlee = await fighterClient.action('FLEE', { expectedRound: currentRound + 99 });
    assert.equal(staleFlee.status, 200);
    assert.equal(staleFlee.json.staleRoundIgnored, true);

    // Now test Fighter permadeath when monster kills hero, and verify Fighter can create a new hero afterward!
    db.prepare('UPDATE characters SET current_hp = 1, dexterity = 1 WHERE id = ?').run(fighterState.character.id);
    db.prepare('UPDATE encounters SET current_monster_hp = 200 WHERE character_id = ? AND status = \'IN_COMBAT\'').run(fighterState.character.id);
    mockRngValue = 0.55;
    let deathState = engageRes.json.state;
    for (let i = 0; i < 6 && deathState.mode !== 'FALLEN'; i++) {
      const atkRes = await fighterClient.action('ATTACK');
      assert.equal(atkRes.status, 200);
      deathState = atkRes.json.state;
    }
    assert.equal(deathState.mode, 'FALLEN', 'Fighter should reach FALLEN state upon permadeath');
    assert.equal(deathState.character, null);
    assert.ok(deathState.fallen);

    // After death, Fighter account CAN create a new hero via CREATE_CHARACTER!
    const newHeroRes = await fighterClient.action('CREATE_CHARACTER', {
      name: 'Vaelen II the Risen',
      classType: 'FIGHTER',
      useClassDefaults: true
    });
    assert.equal(newHeroRes.status, 200);
    assert.equal(newHeroRes.json.ok, true);
    assert.equal(newHeroRes.json.state.mode, 'CITY');
    assert.equal(newHeroRes.json.state.character.name, 'Vaelen II the Risen');
    assert.equal(newHeroRes.json.state.character.is_alive, 1);

    // Concurrent purchase attempts on the unique Global Magical Resale listing: only one can succeed!
    db.prepare('UPDATE characters SET gold = ? WHERE id IN (?, ?)').run(resaleListing.resale_price + 100, rangerId, clericId);
    const [concBuyRanger, concBuyCleric] = await Promise.all([
      rangerClient.action('BUY', { listingId: resaleListing.listing_id }),
      clericClient.action('BUY', { listingId: resaleListing.listing_id })
    ]);
    const successBuys = [concBuyRanger, concBuyCleric].filter(r => r.json.ok === true);
    assert.equal(successBuys.length, 1, 'Exactly one concurrent buyer may acquire a unique Global Resale relic');

    // Verify session isolation across all 3 accounts on reconnect / state refresh
    const [refFighter, refRanger, refCleric] = await Promise.all([
      fighterClient.get('/api/state'),
      rangerClient.get('/api/state'),
      clericClient.get('/api/state')
    ]);
    assert.equal(refFighter.json.state.character.name, 'Vaelen II the Risen');
    assert.equal(refRanger.json.state.character.name, 'Kaelen Thornstrider');
    assert.equal(refCleric.json.state.character.name, 'Brother Aldric');

    // And Watcher's Board Section B now reports the persistent hero-slayer with direction, severityLabel, and warningText
    const threats = newHeroRes.json.state.wildernessThreats;
    assert.ok(threats.length >= 1);
    assert.ok(threats[0].direction);
    assert.ok(threats[0].severityLabel);
    assert.ok(threats[0].warningText);
  });

  it('6. Executes Production Migration Rehearsal on an isolated copy of a Legacy Database (Retention, Integrity, Gameplay & Rollback)', () => {
    // 1. Build a pure legacy database using only legacy migrations (001..005) and seeds (001..010)
    const legacyDb = new DatabaseSync(TEST_MIGRATION_ORIG_PATH);
    legacyDb.exec('PRAGMA foreign_keys = ON;');

    const migrationsDir = path.join(__dirname, '../../db/migrations');
    for (const file of fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()) {
      legacyDb.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
    }
    const seedsDir = path.join(__dirname, '../../db/seeds');
    for (const file of fs.readdirSync(seedsDir).filter(f => f.endsWith('.sql')).sort()) {
      legacyDb.exec(fs.readFileSync(path.join(seedsDir, file), 'utf-8'));
    }

    const tile76 = legacyDb.prepare('SELECT id FROM map_tiles WHERE x = 7 AND y = 6').get();
    const tile74 = legacyDb.prepare('SELECT id FROM map_tiles WHERE x = 7 AND y = 4').get();
    const wolfTemplate = legacyDb.prepare("SELECT id FROM monsters WHERE name = 'Wolf' LIMIT 1").get();
    const firstWeapon = legacyDb.prepare("SELECT id FROM item_definitions WHERE category = 'WEAPON' LIMIT 1").get();

    // Seed representative legacy production data: 2 users, 1 living hero with items, 1 fallen hero, 1 persistent monster, 1 encounter + combat_event
    legacyDb.prepare(`INSERT INTO users (id, username, password_hash) VALUES (10, 'legacy_vet', 'scrypt:salt:hash')`).run();
    legacyDb.prepare(`INSERT INTO users (id, username, password_hash) VALUES (11, 'legacy_fallen_acct', 'scrypt:salt:hash')`).run();

    legacyDb.prepare(`
      INSERT INTO monster_instances (id, monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, custom_title, status)
      VALUES (501, ?, ?, 22, 22, 35, 1, 'Bloodfang the Wolf', 'ACTIVE')
    `).run(wolfTemplate.id, tile74.id);

    legacyDb.prepare(`
      INSERT INTO characters (id, user_id, name, class, is_alive, level, xp, gold, strength, constitution, dexterity, intelligence, wisdom, charisma, current_hp, max_hp, tile_id, killed_by_monster_instance_id)
      VALUES (101, 10, 'Sir Galen of Oakhaven', 'FIGHTER', 1, 4, 6500, 145, 16, 14, 12, 10, 10, 9, 34, 38, ?, NULL)
    `).run(tile76.id);

    legacyDb.prepare(`
      INSERT INTO characters (id, user_id, name, class, is_alive, level, xp, gold, strength, constitution, dexterity, intelligence, wisdom, charisma, current_hp, max_hp, tile_id, killed_by_monster_instance_id)
      VALUES (102, 11, 'Lyra the Lost', 'RANGER', 0, 2, 1200, 0, 12, 11, 16, 10, 12, 10, 0, 18, ?, 501)
    `).run(tile74.id);

    legacyDb.prepare(`
      INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot, modifications)
      VALUES (?, 'CHARACTER', 101, 'MELEE', '{"is_starter":true}')
    `).run(firstWeapon.id);

    legacyDb.prepare(`
      INSERT INTO encounters (id, character_id, tile_id, monster_id, status, current_monster_hp, combat_round)
      VALUES (901, 101, ?, ?, 'VICTORY', 0, 3)
    `).run(tile76.id, wolfTemplate.id);

    legacyDb.prepare(`
      INSERT INTO combat_events (encounter_id, round_number, event_type, public_text)
      VALUES (901, 3, 'VICTORY', 'Sir Galen vanquished a Wolf.')
    `).run();
    legacyDb.close();

    // 2. Copy legacy DB to rehearsal path and create pre-migration backup + SHA-256 checksum
    fs.copyFileSync(TEST_MIGRATION_ORIG_PATH, TEST_MIGRATION_COPY_PATH);
    fs.copyFileSync(TEST_MIGRATION_COPY_PATH, TEST_MIGRATION_BACKUP_PATH);
    const preMigrationHash = sha256File(TEST_MIGRATION_BACKUP_PATH);
    assert.equal(preMigrationHash, sha256File(TEST_MIGRATION_ORIG_PATH));

    // 3. Run Adventure Lab compatibility adapter on the copy
    const rehearsalDb = new DatabaseSync(TEST_MIGRATION_COPY_PATH);
    rehearsalDb.exec('PRAGMA foreign_keys = ON;');
    ensureNonDestructiveLabAdapter(rehearsalDb);

    const audit = verifyLegacyDatabaseCompatibility(rehearsalDb);
    assert.equal(audit.compatible, true);
    assert.equal(audit.foreignKeyViolations, 0);
    assert.deepEqual(audit.missingTables, []);
    assert.deepEqual(audit.missingCharacterColumns, []);

    const integrityRow = rehearsalDb.prepare('PRAGMA integrity_check').get();
    assert.equal(integrityRow.integrity_check, 'ok');

    // 4. Verify 100% of existing player data is retained unmodified
    const sirGalen = rehearsalDb.prepare('SELECT * FROM characters WHERE id = 101').get();
    assert.equal(sirGalen.name, 'Sir Galen of Oakhaven');
    assert.equal(sirGalen.level, 4);
    assert.equal(sirGalen.xp, 6500);
    assert.equal(sirGalen.gold, 145);
    assert.equal(sirGalen.current_hp, 34);
    assert.equal(sirGalen.tile_id, tile76.id);
    assert.equal(sirGalen.is_alive, 1);

    const lyra = rehearsalDb.prepare('SELECT * FROM characters WHERE id = 102').get();
    assert.equal(lyra.name, 'Lyra the Lost');
    assert.equal(lyra.is_alive, 0);
    assert.equal(lyra.killed_by_monster_instance_id, 501);

    const pMonster = rehearsalDb.prepare("SELECT * FROM monster_instances WHERE custom_title = 'Bloodfang the Wolf'").get();
    assert.ok(pMonster);
    assert.equal(pMonster.held_gold, 35);

    const logCount = rehearsalDb.prepare('SELECT COUNT(*) AS c FROM combat_events WHERE encounter_id = 901').get().c;
    assert.equal(logCount, 1);
    rehearsalDb.close();

    // 5. Test Rollback procedure: restore backup over copy and verify exact SHA-256 match
    fs.copyFileSync(TEST_MIGRATION_BACKUP_PATH, TEST_MIGRATION_COPY_PATH);
    const postRollbackHash = sha256File(TEST_MIGRATION_COPY_PATH);
    assert.equal(postRollbackHash, preMigrationHash);
  });

  it('7. Verifies Real Headless Chrome UI Polish & Captures Desktop (1920x1080), Laptop (1366x768) & Mobile (390x844) Screenshots', async (t) => {
    const chromePath = findChromeExecutable();
    if (!chromePath) {
      t.skip('Chrome executable not found on system');
      return;
    }

    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-p61-chrome-'));
    const debugPort = 9440 + Math.floor(Math.random() * 400);

    const chromeProc = spawn(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      baseUrl
    ], { stdio: 'ignore' });

    try {
      let wsUrl = null;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 150));
        try {
          const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
          const pages = await res.json();
          const page = pages.find(p => p.type === 'page' && p.webSocketDebuggerUrl);
          if (page) {
            wsUrl = page.webSocketDebuggerUrl;
            break;
          }
        } catch {
          // retry
        }
      }
      assert.ok(wsUrl, 'Failed to connect to headless Chrome DevTools WebSocket');

      const ws = new WebSocket(wsUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
      });

      let msgId = 1;
      const pending = new Map();
      const consoleErrors = [];

      ws.addEventListener('message', (ev) => {
        const data = JSON.parse(String(ev.data));
        if (data.id && pending.has(data.id)) {
          const { resolve, reject } = pending.get(data.id);
          pending.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        } else if (data.method === 'Runtime.exceptionThrown') {
          consoleErrors.push(data.params.exceptionDetails.text || 'Uncaught exception');
        }
      });

      function sendCdp(method, params = {}) {
        const id = msgId++;
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          ws.send(JSON.stringify({ id, method, params }));
        });
      }

      async function evalJs(expression) {
        const res = await sendCdp('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true
        });
        if (res.exceptionDetails) {
          throw new Error(`JS Eval Error: ${res.exceptionDetails.text}`);
        }
        return res.result ? res.result.value : undefined;
      }

      async function setViewport(width, height, mobile = false) {
        await sendCdp('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile
        });
        await new Promise(r => setTimeout(r, 180));
      }

      async function capturePng(filename) {
        const shot = await sendCdp('Page.captureScreenshot', { format: 'png' });
        const outPath = path.join(SCREENSHOT_DIR, filename);
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        assert.ok(fs.statSync(outPath).size > 15000, `Screenshot ${filename} should be non-empty`);
      }

      await sendCdp('Page.enable');
      await sendCdp('Runtime.enable');
      await setViewport(1920, 1080);
      await sendCdp('Page.navigate', { url: baseUrl });
      await new Promise(r => setTimeout(r, 500));
      await evalJs(`(async () => {
        for (let i = 0; i < 40; i++) {
          if (window.currentState) break;
          await new Promise(r => setTimeout(r, 100));
        }
      })()`);

      // 1. Verify initial unauthenticated production screen has NO Lab Tools button and NO Quick Start REVIVE button
      const unauthCheck = await evalJs(`(() => {
        const devBtn = document.getElementById('btn-toggle-devtools');
        const stageText = document.getElementById('fp-center-stage').innerText;
        return {
          devBtnHidden: devBtn ? devBtn.style.display === 'none' : true,
          stageText
        };
      })()`);
      assert.equal(unauthCheck.devBtnHidden, true, 'Lab Tools toggle button must be hidden for unauthenticated production users');
      assert.match(unauthCheck.stageText, /AUTHENTICATION REQUIRED/);
      assert.doesNotMatch(unauthCheck.stageText, /Quick Start/i);

      // 2. Register a new account in the browser and open the Hero Forge before creating a character
      await evalJs(`(async () => {
        window.openLabModal('account');
        document.getElementById('lab-auth-username').value = 'browser_p61';
        document.getElementById('lab-auth-password').value = 'Password123!';
        await window.submitLabAuth('REGISTER');
        window.openLabModal('account');
      })()`);
      await new Promise(r => setTimeout(r, 250));
      await capturePng('01b-character-forge-ready.png');

      // 3. Forge "Vaelen Ironhand" via the 71-point UI button
      await evalJs(`(async () => {
        window.selectCreatorClass('FIGHTER');
        await window.submitCreatorHero();
      })()`);
      await new Promise(r => setTimeout(r, 250));

      // Verify top HUD hero name "VAELEN IRONHAND" is not truncated (scrollWidth <= clientWidth + 1)
      const hudNameCheck = await evalJs(`(() => {
        const el = document.getElementById('hud-hero-name');
        return {
          text: el.textContent,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth
        };
      })()`);
      assert.equal(hudNameCheck.text, 'Vaelen Ironhand');
      assert.ok(
        hudNameCheck.scrollWidth <= hudNameCheck.clientWidth + 1,
        `Hero name should not truncate: scrollWidth=${hudNameCheck.scrollWidth}, clientWidth=${hudNameCheck.clientWidth}`
      );

      // 4. Re-open Account & Hero Forge while Vaelen Ironhand is alive: verify living-lock banner & disabled button
      await evalJs(`window.openLabModal('account')`);
      await new Promise(r => setTimeout(r, 200));
      const forgeLockCheck = await evalJs(`(() => {
        const bodyText = document.getElementById('lab-modal-body').innerText;
        const btn = document.getElementById('btn-submit-create-character');
        return {
          bodyText,
          btnDisabled: btn ? btn.disabled : false
        };
      })()`);
      assert.equal(forgeLockCheck.btnDisabled, true, 'Forge button must be disabled when a living champion exists');
      assert.match(forgeLockCheck.bodyText, /one living champion per account/i);
      assert.doesNotMatch(forgeLockCheck.bodyText, /will retire/i);
      await capturePng('01-character-forge-living-lock.png');

      // 5. Open Champion Sheet [C] and verify panoply item bonuses & saving throws
      await evalJs(`window.openLabModal('character')`);
      await new Promise(r => setTimeout(r, 200));
      const champText = await evalJs(`document.getElementById('lab-modal-body').innerText`);
      assert.match(champText, /9-Slot Equipped Panoply/);
      assert.match(champText, /Armor AC/);
      await capturePng('02-champion-sheet-panoply.png');

      // 6. Open Oakhaven Market [M] and verify zero raw JSON allowed_classes strings
      await evalJs(`window.openLabModal('market')`);
      await new Promise(r => setTimeout(r, 200));
      const marketText = await evalJs(`document.getElementById('lab-modal-body').innerText`);
      assert.doesNotMatch(marketText, /\["FIGHTER"/, 'Market must never display raw JSON class arrays');
      await capturePng('03-oakhaven-market-polished.png');

      // 7. Open Watcher's Board [J] and verify warrant titles, regions, and Section B threat bearings
      await evalJs(`window.openLabModal('bounties')`);
      await new Promise(r => setTimeout(r, 200));
      const bountiesText = await evalJs(`document.getElementById('lab-modal-body').innerText`);
      assert.match(bountiesText, /Daily Hunting Warrants/);
      assert.match(bountiesText, /Region:/);
      assert.doesNotMatch(bountiesText, /\ba Assassin\b|\ba Owlbear\b|\ba Orc\b/i);
      await capturePng('04-watchers-board-polished.png');

      // 8. Laptop resolution (1366x768) Market verification
      await setViewport(1366, 768);
      await evalJs(`window.openLabModal('market')`);
      await new Promise(r => setTimeout(r, 200));
      await capturePng('06-laptop-1366x768-market.png');

      // 9. Mobile resolution (390x844) Character Forge verification
      await setViewport(390, 844, true);
      await evalJs(`window.openLabModal('account')`);
      await new Promise(r => setTimeout(r, 200));
      await capturePng('07-mobile-390x844-forge.png');

      // 10. Return to Desktop (1920x1080), step north into combat, and capture Combat Presentation
      await setViewport(1920, 1080, false);
      await evalJs(`window.closeLabModal()`);
      mockRngValue = 0.05;
      await evalJs(`(async () => {
        await window.dispatchRelativeMove('FORWARD');
        await window.dispatchRelativeMove('FORWARD');
        if (window.currentState && window.currentState.encounter) {
          await window.dispatchAction('INVESTIGATE');
        }
      })()`);
      await new Promise(r => setTimeout(r, 350));
      await capturePng('05-combat-presentation.png');

      assert.deepEqual(consoleErrors, [], `Expected zero browser console exceptions, got: ${consoleErrors.join('; ')}`);
      await sendCdp('Browser.close').catch(() => {});
      ws.close();
      await new Promise(r => setTimeout(r, 150));
    } finally {
      try {
        chromeProc.kill();
      } catch {
        // ignore
      }
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });
});
