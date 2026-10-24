/**
 * DARKGRID — PHASE 10: Isolated Staging Deployment, Production Readiness, Restart & Rollback Smoke Suite
 *
 * Tests the exact production configuration (`NODE_ENV=production`, strong `SESSION_SECRET`,
 * isolated `DB_PATH` and `DURABLE_SNAPSHOT_PATH` in temp directory, `FIRESTORE_DURABLE_SYNC=false`)
 * without touching live Firestore or `data/darkgrid.sqlite`.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const rootIndex = require('../index');
const { startServer, createMainApp } = require('../src/server');
const { initializeDatabase } = require('../src/db/connection');
const {
  saveDurableSnapshotFile,
  loadDurableSnapshotFile,
  verifySnapshotIntegrity,
  importDynamicState
} = require('../src/db/durable-store');
const { prepareStaticHostingAssets } = require('../scripts/deploy_blaze');

const STAGING_SESSION_SECRET = 'darkgrid-phase10-staging-verified-secret-key-2026-prod';

async function waitForServerPort(server) {
  if (!server.listening) {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
  }
  return server.address().port;
}

function createStagingClient(getBaseUrl, defaultHeaders = { 'X-Forwarded-Proto': 'https' }) {
  let cookie = null;

  function captureCookie(res) {
    const raw = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    for (const c of raw) {
      if (!c) continue;
      const m = c.match(/(__session=[^;]+)/);
      if (m) cookie = m[1];
    }
  }

  return {
    getCookie: () => cookie,
    setCookie: (val) => { cookie = val; },
    async get(urlPath, extraHeaders = {}) {
      const headers = { ...defaultHeaders, ...extraHeaders };
      if (cookie) headers.Cookie = cookie;
      const res = await fetch(`${getBaseUrl()}${urlPath}`, { headers });
      captureCookie(res);
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: res.status, text, json, headers: res.headers };
    },
    async post(urlPath, body = {}, extraHeaders = {}) {
      const headers = { 'Content-Type': 'application/json', ...defaultHeaders, ...extraHeaders };
      if (cookie) headers.Cookie = cookie;
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

describe('Phase 10 — Staging Deployment, Production Readiness, Container Restart & Rollback Smoke Suite', () => {
  let stagingDir;
  let dbPath1;
  let dbPath2;
  let dbPathRollback;
  let durableSnapshotPath;
  let preDungeonSnapshotPath;

  let serverInstance1 = null;
  let serverUrl1 = null;
  let db1 = null;

  const prevEnv = {};
  const envKeys = [
    'NODE_ENV',
    'SESSION_SECRET',
    'DB_PATH',
    'DURABLE_SNAPSHOT_PATH',
    'FIRESTORE_DURABLE_SYNC',
    'ENABLE_FIRESTORE_SYNC',
    'FIREBASE_PROJECT_ID'
  ];

  let savedSessionCookie = null;
  let overworldDiscoveredCountBeforeDungeon = 0;
  let dungeonDiscoveredCountBeforeRestart = 0;

  before(async () => {
    for (const k of envKeys) {
      prevEnv[k] = process.env[k];
    }

    stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-phase10-staging-'));
    dbPath1 = path.join(stagingDir, 'staging-instance-1.sqlite');
    dbPath2 = path.join(stagingDir, 'staging-instance-2.sqlite');
    dbPathRollback = path.join(stagingDir, 'staging-rollback.sqlite');
    durableSnapshotPath = path.join(stagingDir, 'staging-durable-snapshot.json');
    preDungeonSnapshotPath = path.join(stagingDir, 'staging-pre-dungeon-checkpoint.json');

    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = STAGING_SESSION_SECRET;
    process.env.DB_PATH = dbPath1;
    process.env.DURABLE_SNAPSHOT_PATH = durableSnapshotPath;
    process.env.FIRESTORE_DURABLE_SYNC = 'false';
    process.env.ENABLE_FIRESTORE_SYNC = 'false';
    process.env.FIREBASE_PROJECT_ID = 'darkgrid-rpg';

    db1 = initializeDatabase(dbPath1);
    const started = await startServer({
      db: db1,
      dbPath: dbPath1,
      port: 0,
      production: true,
      sessionSecret: STAGING_SESSION_SECRET,
      rng: () => 0.99
    });
    serverInstance1 = started.server;
    const port1 = await waitForServerPort(serverInstance1);
    serverUrl1 = `http://127.0.0.1:${port1}`;
  });

  after(async () => {
    if (serverInstance1) {
      await new Promise((resolve) => serverInstance1.close(resolve));
      serverInstance1 = null;
    }
    if (db1) {
      try { db1.close(); } catch {}
      db1 = null;
    }
    for (const k of envKeys) {
      if (prevEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = prevEnv[k];
      }
    }
    if (stagingDir && fs.existsSync(stagingDir)) {
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('1. Verifies Phase 10 Root App, Dockerfile, firebase.json & Static Hosting Asset Build (dist/)', () => {
    const repoRoot = path.resolve(__dirname, '..');

    // Root entrypoints
    assert.equal(typeof rootIndex.startServer, 'function');
    assert.equal(typeof rootIndex.createMainApp, 'function');
    assert.ok(fs.existsSync(path.join(repoRoot, 'legacy-game', 'app.js')), 'legacy-game/app.js must remain preserved');

    // Dockerfile verification
    const dockerfileText = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
    for (const expectedCopy of [
      'COPY index.js ./',
      'COPY src ./src',
      'COPY action-ui-lab ./action-ui-lab',
      'COPY db ./db',
      'COPY public ./public',
      'COPY images ./images',
      'COPY scripts ./scripts'
    ]) {
      assert.ok(dockerfileText.includes(expectedCopy), `Dockerfile must contain: ${expectedCopy}`);
    }
    assert.match(dockerfileText, /ENV NODE_ENV=production/);
    assert.match(dockerfileText, /CMD \["node", "src\/server\.js"\]/);

    // firebase.json verification
    const firebaseConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
    assert.equal(firebaseConfig.hosting.public, 'dist');
    const runRewrite = (firebaseConfig.hosting.rewrites || []).find(r => r.source === '**');
    assert.ok(runRewrite && runRewrite.run, 'firebase.json must rewrite ** to Cloud Run');
    assert.equal(runRewrite.run.serviceId, 'darkgrid-api');
    assert.equal(runRewrite.run.region, 'europe-west1');

    // Build Firebase static hosting assets into dist/ and verify layout
    prepareStaticHostingAssets();
    const distDir = path.join(repoRoot, 'dist');
    assert.equal(fs.existsSync(path.join(distDir, 'index.html')), false, 'dist/index.html must be removed so / routes to Cloud Run');
    assert.equal(fs.existsSync(path.join(distDir, 'monster_review.html')), false, 'Internal dev HTML must be removed from dist/');
    assert.equal(fs.existsSync(path.join(distDir, 'monster_comparison.html')), false, 'Internal dev HTML must be removed from dist/');

    // Required static CDN directories and files in dist/
    assert.ok(fs.existsSync(path.join(distDir, 'lab-assets', 'css', 'base.css')));
    assert.ok(fs.existsSync(path.join(distDir, 'lab-assets', 'css', 'world.css')));
    assert.ok(fs.existsSync(path.join(distDir, 'lab-assets', 'js', 'app.js')));
    assert.ok(fs.existsSync(path.join(distDir, 'lab-assets', 'monster-size-catalog.js')));
    assert.ok(fs.existsSync(path.join(distDir, 'lab-assets', 'images', 'monsters-cutout', 'goblin.png')));
    assert.ok(fs.existsSync(path.join(distDir, 'lab-assets', 'images', 'perspective', 'oakhaven_7_7_north.jpg')));
    assert.ok(fs.existsSync(path.join(distDir, 'images', 'monsters', 'goblin.png')));
    assert.ok(fs.existsSync(path.join(distDir, 'images', 'terrain', 'terrain_plains.webp')));
  });

  it('2. Verifies Production Boot, Health Probes, Root DarkGrid UI & Unauthenticated Sandbox Lockdown', async () => {
    // Reject weak or default SESSION_SECRET in production mode
    assert.throws(
      () => createMainApp({
        dbPath: ':memory:',
        production: true,
        sessionSecret: 'darkgrid-dev-secret-key-change-in-production'
      }),
      /Production security error/
    );

    const anon = createStagingClient(() => serverUrl1);

    // Health check endpoints (zero DB/Firestore read cost)
    for (const healthPath of ['/healthz', '/api/health']) {
      const hRes = await anon.get(healthPath);
      assert.equal(hRes.status, 200, `${healthPath} must return 200 OK`);
      assert.equal(hRes.json.status, 'ok');
      assert.equal(hRes.json.service, 'darkgrid-rpg');
    }

    // Root `/` serves the new DarkGrid HTML UI (not legacy EJS login redirect)
    const rootRes = await anon.get('/');
    assert.equal(rootRes.status, 200);
    assert.match(rootRes.text, /DARKGRID/i);
    assert.match(rootRes.text, /fp-viewport/);
    assert.match(rootRes.text, /\/lab-assets\/js\/app\.js/);
    assert.doesNotMatch(rootRes.text, /action="\/login"/i);

    // Verify no anonymous sandbox hero is seeded in production SQLite
    const sandboxUser = db1.prepare("SELECT * FROM users WHERE username = 'action_hero'").get();
    assert.equal(sandboxUser, undefined, 'Production DB must not seed anonymous action_hero sandbox account');

    // Unauthenticated GET /api/state and /api/auth/session expose no character and disable labTools
    const stateRes = await anon.get('/api/state');
    assert.ok([200, 401].includes(stateRes.status));
    if (stateRes.json && stateRes.json.state) {
      assert.equal(stateRes.json.state.mode, 'UNAUTHENTICATED');
      assert.equal(stateRes.json.state.currentUser, null);
      assert.equal(stateRes.json.state.character, null);
      assert.equal(stateRes.json.state.labToolsAllowed, false);
    }

    const sessRes = await anon.get('/api/auth/session');
    assert.equal(sessRes.status, 200);
    assert.equal(sessRes.json.authenticated, false);
    assert.equal(sessRes.json.user, null);
    assert.equal(sessRes.json.hasLivingCharacter, false);
    assert.equal(sessRes.json.labToolsAllowed, false);

    // Unauthenticated state-mutating or audit endpoints strictly return 401
    for (const act of ['MOVE', 'TURN', 'ENTER_DUNGEON', 'EXIT_DUNGEON', 'ATTACK', 'CREATE_CHARACTER', 'BUY', 'SELL']) {
      const actRes = await anon.action(act, { direction: 'NORTH' });
      assert.equal(actRes.status, 401, `Unauthenticated ${act} must return 401 in production`);
    }

    const createCharAnon = await anon.post('/api/character/create', {
      name: 'AnonHero',
      classType: 'FIGHTER',
      useClassDefaults: true
    });
    assert.equal(createCharAnon.status, 401);

    const spendAnon = await anon.post('/api/character/attributes/spend', { attribute: 'strength' });
    assert.equal(spendAnon.status, 401);

    const auditAnon = await anon.get('/api/legacy-audit');
    assert.equal(auditAnon.status, 401);
  });

  it('3. Executes End-to-End Staging Flow: Register, Login, Hero Creation, 44x30 Trail Navigation, Goblin Cave Entry & Durable Snapshot Save', async () => {
    const player = createStagingClient(() => serverUrl1);

    // 1. Register account
    const regRes = await player.post('/api/auth/register', {
      username: 'staging_ranger',
      password: 'StagingPassword2026!'
    });
    assert.equal(regRes.status, 200);
    assert.equal(regRes.json.ok, true);
    assert.equal(regRes.json.user.username, 'staging_ranger');
    assert.equal(regRes.json.state.mode, 'NO_CHARACTER');
    assert.equal(regRes.json.state.labToolsAllowed, false);
    assert.ok(player.getCookie(), 'Registration must set __session cookie');

    // 2. Logout and Login to verify full auth lifecycle
    const logoutRes = await player.post('/api/auth/logout', {});
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.json.state.mode, 'UNAUTHENTICATED');

    const loginRes = await player.post('/api/auth/login', {
      username: 'staging_ranger',
      password: 'StagingPassword2026!'
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.json.ok, true);
    assert.equal(loginRes.json.state.mode, 'NO_CHARACTER');
    savedSessionCookie = player.getCookie();
    assert.ok(savedSessionCookie && savedSessionCookie.startsWith('__session='));

    // 3. Create Hero (Ranger) in Oakhaven Sanctuary [15, 27]
    const createRes = await player.post('/api/character/create', {
      name: 'Kaelen of Oakhaven',
      classType: 'RANGER',
      useClassDefaults: true,
      favoredEnemyFamily: 'GOBLINOIDS'
    });
    assert.equal(createRes.status, 200);
    assert.equal(createRes.json.ok, true);
    assert.equal(createRes.json.state.character.name, 'Kaelen of Oakhaven');
    assert.equal(createRes.json.state.character.class, 'RANGER');
    assert.equal(createRes.json.state.currentTile.x, 15);
    assert.equal(createRes.json.state.currentTile.y, 27);
    assert.equal(createRes.json.state.topdownMap.totalTiles, 1320);
    assert.equal(createRes.json.state.topdownMap.regionMap.regions.length, 3);

    // 4. Walk the legitimate 23-step wilderness trail from Oakhaven [15, 27] to Goblin Cave [9, 12]
    const stepsToGoblinCave = [
      'NORTH', 'NORTH', 'NORTH', 'NORTH', 'NORTH', 'NORTH',
      'WEST',
      'NORTH', 'NORTH', 'NORTH',
      'EAST',
      'NORTH', 'NORTH', 'NORTH',
      'WEST', 'WEST', 'WEST', 'WEST', 'WEST', 'WEST',
      'NORTH', 'NORTH', 'NORTH'
    ];

    let lastMoveState = null;
    for (const dir of stepsToGoblinCave) {
      const stepRes = await player.action('MOVE', { direction: dir });
      assert.equal(stepRes.status, 200);
      assert.equal(stepRes.json.ok, true, `Step ${dir} failed: ${stepRes.json.error || ''}`);
      lastMoveState = stepRes.json.state;
    }

    assert.equal(lastMoveState.currentTile.x, 9);
    assert.equal(lastMoveState.currentTile.y, 12);
    assert.match(lastMoveState.currentTile.name, /Goblin Cave/i);
    overworldDiscoveredCountBeforeDungeon = db1
      .prepare('SELECT COUNT(*) as cnt FROM character_discovered_tiles WHERE character_id = ?')
      .get(lastMoveState.character.id).cnt;
    assert.ok(overworldDiscoveredCountBeforeDungeon > 40, 'Walking the trail must record overworld Fog of War tile discoveries');

    // Save a pre-dungeon checkpoint snapshot for Rollback verification in Test 5
    const preDungeonSnap = saveDurableSnapshotFile(db1, preDungeonSnapshotPath);
    assert.equal(verifySnapshotIntegrity(preDungeonSnap).valid, true);

    // 5. Enter Goblin Cave dungeon and move inside
    const enterRes = await player.action('ENTER_DUNGEON', { dungeonKey: 'GOBLIN_CAVE' });
    assert.equal(enterRes.status, 200);
    assert.equal(enterRes.json.ok, true);
    assert.equal(enterRes.json.state.dungeonMap.inDungeon, true);
    assert.equal(enterRes.json.state.dungeonMap.dungeonKey, 'GOBLIN_CAVE');
    assert.equal(enterRes.json.state.dungeonMap.heroX, 3);
    assert.equal(enterRes.json.state.dungeonMap.heroY, 16);

    const dungeonStepRes = await player.action('MOVE', { direction: 'NORTH' });
    assert.equal(dungeonStepRes.status, 200);
    assert.equal(dungeonStepRes.json.ok, true);
    assert.equal(dungeonStepRes.json.state.dungeonMap.heroX, 3);
    assert.equal(dungeonStepRes.json.state.dungeonMap.heroY, 15);
    dungeonDiscoveredCountBeforeRestart = dungeonStepRes.json.state.dungeonMap.discoveredCount;
    assert.ok(dungeonDiscoveredCountBeforeRestart > 5);

    // Verify automatic POST write-through updated DURABLE_SNAPSHOT_PATH on disk
    assert.ok(fs.existsSync(durableSnapshotPath), 'DURABLE_SNAPSHOT_PATH must be written automatically after POST actions');
    const diskSnapshot = JSON.parse(fs.readFileSync(durableSnapshotPath, 'utf8'));
    const integrity = verifySnapshotIntegrity(diskSnapshot);
    assert.equal(integrity.valid, true, 'Durable snapshot on disk must have a valid SHA-256 checksum');
    assert.equal(diskSnapshot.counts.users, 1);
    assert.equal(diskSnapshot.counts.characters, 1);
    assert.ok(diskSnapshot.counts.user_sessions >= 1);
    assert.ok(diskSnapshot.counts.character_discovered_tiles >= overworldDiscoveredCountBeforeDungeon);
    assert.equal(diskSnapshot.counts.character_dungeon_discovered_tiles, dungeonDiscoveredCountBeforeRestart);
  });

  it('4. Enforces Public Debug Lockdown (403 Forbidden), Anti-Tamper (400) & Cost Guardrails (503 / Kill-Switch)', async () => {
    const player = createStagingClient(() => serverUrl1);
    player.setCookie(savedSessionCookie);

    // 1. All public debug / lab scenario / encounter-spawning endpoints must return 403 Forbidden
    const forbiddenDebugCalls = [
      ['TELEPORT_TO_TILE', { x: 15, y: 2 }],
      ['LAB_SCENARIO', { scenario: 'COMBAT', monsterName: 'goblin' }],
      ['LAB_SCENARIO', { scenario: 'STAGE1_MYSTERY', monsterName: 'wolf' }],
      ['LAB_SCENARIO', { scenario: 'HEAL' }],
      ['LAB_SCENARIO', { scenario: 'RESET_WORLD' }],
      ['MOVE', { direction: 'NORTH', testForceEncounter: true }],
      ['MOVE', { direction: 'NORTH', testForceAmbush: true }],
      ['REVIVE', {}],
      ['FORCE_DISCOVERY', { discoveryKey: 'SHRINE_BLESSING' }],
      ['SET_DETERMINISTIC_SEED', { seed: 1337 }],
      ['SET_ART_PREVIEW_MODE', { enabled: true }]
    ];

    for (const [act, payload] of forbiddenDebugCalls) {
      const res = await player.action(act, payload);
      assert.equal(res.status, 403, `Debug action ${act} (${JSON.stringify(payload)}) must return 403 Forbidden in production`);
      assert.equal(res.json.ok, false);
    }

    const auditRes = await player.get('/api/legacy-audit');
    assert.equal(auditRes.status, 403, 'GET /api/legacy-audit must return 403 Forbidden in production');
    assert.equal(auditRes.json.ok, false);

    // 2. Anti-Tamper protection rejects client-supplied authoritative fields with 400 Bad Request
    for (const tampered of [
      { direction: 'SOUTH', gold: 999999 },
      { direction: 'SOUTH', current_hp: 999 },
      { direction: 'SOUTH', xp: 50000 },
      { direction: 'SOUTH', level: 20 },
      { direction: 'SOUTH', isAdmin: true }
    ]) {
      const tamperRes = await player.action('MOVE', tampered);
      assert.equal(tamperRes.status, 400);
      assert.equal(tamperRes.json.ok, false);
    }

    // 3. Cost Guardrails: Daily HTTP Request Cap (503) & Budget Kill-Switch Webhook authentication
    const capRes = await player.get('/api/state', {
      'X-Enforce-Daily-Cap': '1',
      'X-Daily-Cap-Max': '1'
    });
    assert.equal(capRes.status, 503, 'Exceeding MAX_DAILY_HTTP_REQUESTS cap must return 503 Service Unavailable');
    assert.match(capRes.text, /budget protection/i);

    const unauthorizedKillSwitch = await player.post('/internal/budget-killswitch?key=wrong-key', {
      costAmount: 30,
      budgetAmount: 25
    });
    assert.equal(unauthorizedKillSwitch.status, 403, 'Budget kill-switch webhook must reject invalid keys with 403');

    const expectedKillSwitchKey = crypto
      .createHash('sha256')
      .update('darkgrid-budget-killswitch-darkgrid-rpg-v1')
      .digest('hex');
    const thresholdAlertRes = await player.post(`/internal/budget-killswitch?key=${expectedKillSwitchKey}`, {
      costAmount: 12.5,
      budgetAmount: 25,
      currencyCode: 'USD'
    });
    assert.equal(thresholdAlertRes.status, 200);
    assert.equal(thresholdAlertRes.json.status, 'ok');
  });

  it('5. Simulates Full Container Restart (Wiped SQLite -> Hydrate from DURABLE_SNAPSHOT_PATH) & Verifies Clean Rollback', async () => {
    // Ensure latest state is flushed before shutting down Server 1
    saveDurableSnapshotFile(db1, durableSnapshotPath);

    // Shut down Server 1 and close DB 1 (simulating Cloud Run container termination)
    await new Promise((resolve) => serverInstance1.close(resolve));
    serverInstance1 = null;
    db1.close();
    db1 = null;

    // Boot Server 2 on a brand-new empty SQLite database file (dbPath2),
    // relying on startServer()'s automatic hydration from process.env.DURABLE_SNAPSHOT_PATH
    process.env.DB_PATH = dbPath2;
    const db2 = initializeDatabase(dbPath2);
    const started2 = await startServer({
      db: db2,
      dbPath: dbPath2,
      port: 0,
      production: true,
      sessionSecret: STAGING_SESSION_SECRET,
      rng: () => 0.99
    });
    const serverInstance2 = started2.server;
    const port2 = await waitForServerPort(serverInstance2);
    const serverUrl2 = `http://127.0.0.1:${port2}`;

    try {
      const clientAfterRestart = createStagingClient(() => serverUrl2);
      // Reuse the exact __session cookie issued by Server 1 before the restart!
      clientAfterRestart.setCookie(savedSessionCookie);

      const sessAfter = await clientAfterRestart.get('/api/auth/session');
      assert.equal(sessAfter.status, 200);
      assert.equal(sessAfter.json.authenticated, true, '__session cookie must remain valid after container restart');
      assert.equal(sessAfter.json.user.username, 'staging_ranger');
      assert.equal(sessAfter.json.hasLivingCharacter, true);

      const stateAfter = await clientAfterRestart.get('/api/state');
      assert.equal(stateAfter.status, 200);
      assert.equal(stateAfter.json.ok, true);
      const st = stateAfter.json.state;
      assert.equal(st.character.name, 'Kaelen of Oakhaven');
      assert.equal(st.character.class, 'RANGER');
      assert.equal(st.currentTile.x, 3);
      assert.equal(st.currentTile.y, 15);
      assert.equal(st.topdownMap.heroX, 9);
      assert.equal(st.topdownMap.heroY, 12);
      assert.equal(st.dungeonMap.inDungeon, true, 'Active dungeon state must survive container restart');
      assert.equal(st.dungeonMap.dungeonKey, 'GOBLIN_CAVE');
      assert.equal(st.dungeonMap.heroX, 3);
      assert.equal(st.dungeonMap.heroY, 15);
      assert.equal(st.dungeonMap.discoveredCount, dungeonDiscoveredCountBeforeRestart, 'Dungeon Fog of War tiles must survive container restart');

      const overworldDiscoveredAfter = db2
        .prepare('SELECT COUNT(*) as cnt FROM character_discovered_tiles WHERE character_id = ?')
        .get(st.character.id).cnt;
      assert.equal(overworldDiscoveredAfter, overworldDiscoveredCountBeforeDungeon, 'Overworld Fog of War tiles must survive container restart');

      // Verify Monotonic State Protection (Permadeath cannot be undone by importing a stale snapshot onto the same DB)
      db2.prepare('UPDATE characters SET is_alive = 0, current_hp = 0, died_at = CURRENT_TIMESTAMP WHERE id = ?').run(st.character.id);
      const staleSnap = JSON.parse(fs.readFileSync(preDungeonSnapshotPath, 'utf8'));
      importDynamicState(db2, staleSnap);
      const charAfterStaleImport = db2.prepare('SELECT is_alive, current_hp FROM characters WHERE id = ?').get(st.character.id);
      assert.equal(charAfterStaleImport.is_alive, 0, 'Monotonic rule: stale snapshot import must never resurrect a fallen hero');
      assert.equal(charAfterStaleImport.current_hp, 0);
    } finally {
      await new Promise((resolve) => serverInstance2.close(resolve));
      try { db2.close(); } catch {}
    }

    // Verify Clean Rollback Procedure: Restore pre-dungeon checkpoint onto a fresh rollback SQLite instance
    const dbRollback = initializeDatabase(dbPathRollback);
    const rollbackApp = createMainApp({
      db: dbRollback,
      dbPath: dbPathRollback,
      production: true,
      sessionSecret: STAGING_SESSION_SECRET,
      rng: () => 0.99
    });
    const rollbackResult = loadDurableSnapshotFile(dbRollback, preDungeonSnapshotPath);
    assert.equal(rollbackResult.imported, true);

    const rollbackServer = rollbackApp.listen(0, '127.0.0.1');
    await new Promise((resolve) => rollbackServer.once('listening', resolve));
    const rollbackUrl = `http://127.0.0.1:${rollbackServer.address().port}`;

    try {
      const rollbackClient = createStagingClient(() => rollbackUrl);
      rollbackClient.setCookie(savedSessionCookie);

      const rbStateRes = await rollbackClient.get('/api/state');
      assert.equal(rbStateRes.status, 200);
      const rbState = rbStateRes.json.state;
      assert.equal(rbState.character.name, 'Kaelen of Oakhaven');
      assert.equal(rbState.character.is_alive, 1);
      assert.equal(rbState.currentTile.x, 9);
      assert.equal(rbState.currentTile.y, 12);
      assert.equal(Boolean(rbState.dungeonMap && rbState.dungeonMap.inDungeon), false, 'Rolled-back checkpoint must restore hero to pre-dungeon overworld state at [9, 12]');
    } finally {
      await new Promise((resolve) => rollbackServer.close(resolve));
      try { dbRollback.close(); } catch {}
    }
  });
});
