/**
 * DARKGRID — PHASE 10: Main Game Cutover, Legacy Preservation, Public Playtest Security & Durable Restart Suite
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const rootIndex = require('../index');
const { createMainApp } = require('../src/app');
const legacyApp = require('../legacy-game/app');
const { setDb, closeDb } = require('../src/db/connection');
const { createTestDb } = require('./test_helpers');
const {
  saveDurableSnapshotFile,
  loadDurableSnapshotFile
} = require('../src/db/durable-store');
const { getTileByCoords } = require('../src/domain/world/map');

function createClient(getBaseUrl, defaultHeaders = { 'X-Forwarded-Proto': 'https' }) {
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
    async get(urlPath) {
      const headers = { ...defaultHeaders };
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
      const json = await res.json();
      return { status: res.status, json, headers: res.headers };
    },
    async action(action, payload = {}, extraHeaders = {}) {
      return this.post('/api/action', { action, payload }, extraHeaders);
    }
  };
}

describe('Phase 10 — Main Game Cutover, Legacy Preservation, Public Security & Durable Persistence', () => {
  let mainApp;
  let mainServer;
  let mainUrl;
  let mainDb;
  let tmpDbPath;

  before(async () => {
    tmpDbPath = path.join(os.tmpdir(), `darkgrid-phase10-main-${Date.now()}.sqlite`);
    mainApp = createMainApp({
      dbPath: tmpDbPath,
      production: true,
      sessionSecret: 'darkgrid-phase10-production-test-secret-key-2026',
      rng: () => 0.95
    });
    mainDb = mainApp.locals.db;
    mainServer = http.createServer(mainApp);
    await new Promise(resolve => mainServer.listen(0, '127.0.0.1', resolve));
    mainUrl = `http://127.0.0.1:${mainServer.address().port}`;
  });

  after(async () => {
    if (mainServer) {
      await new Promise(resolve => mainServer.close(resolve));
    }
    if (mainDb) {
      try { mainDb.close(); } catch {}
    }
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(tmpDbPath + suffix)) {
        try { fs.unlinkSync(tmpDbPath + suffix); } catch {}
      }
    }
  });

  it('1. Root index.js & src/app.js launch the Main DarkGrid Game with 44x30 3-Region World & 2 Large Dungeons, while legacy-game/app.js remains runnable', async () => {
    assert.equal(typeof rootIndex.startServer, 'function');
    assert.equal(typeof rootIndex.createMainApp, 'function');

    const anon = createClient(() => mainUrl);
    const health = await anon.get('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.status, 'ok');
    assert.equal(health.json.service, 'darkgrid-rpg');

    const rootHtml = await anon.get('/');
    assert.equal(rootHtml.status, 200);
    assert.match(rootHtml.text, /DARKGRID/i);
    assert.match(rootHtml.text, /fp-viewport/);

    // Verify 44x30 (1,320 tiles) 3-region world is initialized in production mode
    const tileCount = mainDb.prepare('SELECT COUNT(*) as cnt FROM map_tiles').get().cnt;
    assert.equal(tileCount, 1320, 'Production database must initialize the full 44x30 (1,320-tile) 3-region world');

    const highlandCount = mainDb.prepare("SELECT COUNT(*) as cnt FROM map_tiles WHERE region_key = 'RAVENCRAG_HIGHLANDS'").get().cnt;
    assert.equal(highlandCount, 420);

    // Verify legacy game app is preserved and runnable in legacy-game/app.js
    const legDb = createTestDb();
    setDb(legDb);
    const legServer = http.createServer(legacyApp);
    await new Promise(resolve => legServer.listen(0, '127.0.0.1', resolve));
    const legPort = legServer.address().port;
    try {
      const legLogin = await fetch(`http://127.0.0.1:${legPort}/login`);
      assert.equal(legLogin.status, 200);
      const legHtml = await legLogin.text();
      assert.match(legHtml, /DARKGRID/i);
    } finally {
      await new Promise(resolve => legServer.close(resolve));
      closeDb();
    }
  });

  it('2. Public Playtest Security: Enforces Auth, Isolates Multi-User Accounts, Blocks Lab Director/Debug Actions (403) & Rejects Client Tampering (400)', async () => {
    const anon = createClient(() => mainUrl);
    const clientA = createClient(() => mainUrl);
    const clientB = createClient(() => mainUrl);

    // Unauthenticated state has labToolsAllowed = false and mode = UNAUTHENTICATED
    const anonState = await anon.get('/api/state');
    assert.equal(anonState.status, 200);
    assert.equal(anonState.json.state.mode, 'UNAUTHENTICATED');
    assert.equal(anonState.json.state.labToolsAllowed, false);

    // Unauthenticated actions return 401
    for (const act of ['MOVE', 'ENTER_DUNGEON', 'EXIT_DUNGEON', 'ATTACK', 'BUY', 'SELL', 'CREATE_CHARACTER']) {
      const r = await anon.action(act, { direction: 'NORTH' });
      assert.equal(r.status, 401, `Unauthenticated ${act} must be rejected with 401`);
    }

    // Register & create Hero A (Fighter) and Hero B (Cleric)
    const regA = await clientA.post('/api/auth/register', {
      username: 'playtest_alpha',
      password: 'AlphaSecretPassword1!',
      createCharacter: {
        name: 'Sir Aldebaran',
        classType: 'FIGHTER',
        useClassDefaults: true
      }
    });
    assert.equal(regA.status, 200);
    assert.equal(regA.json.ok, true);
    assert.equal(regA.json.state.character.name, 'Sir Aldebaran');
    assert.equal(regA.json.state.labToolsAllowed, false);
    assert.equal(regA.json.state.currentTile.x, 15);
    assert.equal(regA.json.state.currentTile.y, 27);

    const regB = await clientB.post('/api/auth/register', {
      username: 'playtest_beta',
      password: 'BetaSecretPassword1!',
      createCharacter: {
        name: 'Sister Seraphina',
        classType: 'CLERIC',
        useClassDefaults: true
      }
    });
    assert.equal(regB.status, 200);
    assert.equal(regB.json.ok, true);
    assert.equal(regB.json.state.character.name, 'Sister Seraphina');
    assert.equal(regB.json.state.labToolsAllowed, false);

    // Verify Lab Director / debug / cheat actions are strictly blocked (403) in public/production mode
    const forbiddenDebugActions = [
      ['LAB_SCENARIO', { scenario: 'HEAL' }],
      ['TELEPORT_TO_TILE', { x: 37, y: 3 }],
      ['REVIVE', {}],
      ['FORCE_DISCOVERY', { discoveryKey: 'SHRINE_BLESSING' }],
      ['SET_DETERMINISTIC_SEED', { seed: 42 }],
      ['SET_ART_PREVIEW_MODE', { mode: 'staging' }],
      ['MOVE', { direction: 'NORTH', testForceEncounter: true }],
      ['MOVE', { direction: 'NORTH', testForceAmbush: true }]
    ];
    for (const [act, payload] of forbiddenDebugActions) {
      const res = await clientA.action(act, payload);
      assert.equal(res.status, 403, `Debug action ${act} must be rejected with 403 in public mode`);
      assert.equal(res.json.ok, false);
    }

    // Verify Anti-Tamper blocks client attempts to modify HP, XP, gold, level, damage, or admin status (400)
    for (const tamperedPayload of [
      { direction: 'NORTH', gold: 99999 },
      { direction: 'NORTH', xp: 50000 },
      { direction: 'NORTH', level: 10 },
      { direction: 'NORTH', current_hp: 999 },
      { direction: 'NORTH', isAdmin: true }
    ]) {
      const res = await clientA.action('MOVE', tamperedPayload);
      assert.equal(res.status, 400, 'Tampered payload must be rejected with HTTP 400');
      assert.equal(res.json.ok, false);
    }

    // Verify Account Isolation: User A moves North to North Gate [15, 26]; User B remains at Oakhaven [15, 27]
    const moveA = await clientA.action('MOVE', { direction: 'NORTH' });
    assert.equal(moveA.status, 200);
    assert.equal(moveA.json.state.currentTile.x, 15);
    assert.equal(moveA.json.state.currentTile.y, 26);

    const stateB = await clientB.get('/api/state');
    assert.equal(stateB.json.state.character.name, 'Sister Seraphina');
    assert.equal(stateB.json.state.currentTile.x, 15);
    assert.equal(stateB.json.state.currentTile.y, 27);

    // User A cannot equip or sell User B's items
    const bItem = mainDb.prepare('SELECT id FROM item_instances WHERE owner_character_id = ? LIMIT 1').get(stateB.json.state.character.id);
    assert.ok(bItem);
    const stealAttempt = await clientA.action('UNEQUIP', { itemInstanceId: bItem.id });
    assert.equal(stealAttempt.status, 403);
  });

  it('3. Durable Snapshot Persistence: Preserves Accounts, Sessions, Overworld & Dungeon Exploration Across Full Server Restart', async () => {
    const clientA = createClient(() => mainUrl);
    const loginA = await clientA.post('/api/auth/login', {
      username: 'playtest_alpha',
      password: 'AlphaSecretPassword1!'
    });
    assert.equal(loginA.status, 200);
    const charId = loginA.json.state.character.id;

    // Place Hero A at Goblin Cave entrance [9, 12], enter the dungeon, and step inside
    const caveTile = getTileByCoords(mainDb, 9, 12);
    mainDb.prepare("UPDATE characters SET tile_id = ?, active_landmark_scene_key = 'GOBLIN_CAVE_ENTRANCE' WHERE id = ?").run(caveTile.id, charId);

    const enterRes = await clientA.action('ENTER_DUNGEON', { dungeonKey: 'GOBLIN_CAVE' });
    assert.equal(enterRes.status, 200);
    assert.equal(enterRes.json.state.dungeonMap.inDungeon, true);
    assert.equal(enterRes.json.state.dungeonMap.dungeonKey, 'GOBLIN_CAVE');
    assert.equal(enterRes.json.state.dungeonMap.heroX, 3);
    assert.equal(enterRes.json.state.dungeonMap.heroY, 16);

    const stepInDungeon = await clientA.action('MOVE', { direction: 'NORTH' });
    assert.equal(stepInDungeon.status, 200);
    assert.equal(stepInDungeon.json.state.dungeonMap.heroX, 3);
    assert.equal(stepInDungeon.json.state.dungeonMap.heroY, 15);
    const discoveredCountBefore = stepInDungeon.json.state.dungeonMap.discoveredCount;
    assert.ok(discoveredCountBefore > 5);

    // Save durable snapshot to disk (simulating Cloud Run container shutdown flush)
    const snapshotPath = path.join(os.tmpdir(), `darkgrid-phase10-snapshot-${Date.now()}.json`);
    saveDurableSnapshotFile(mainDb, snapshotPath);

    // Start a brand-new server instance with a fresh SQLite DB and hydrate from the durable snapshot
    const restartedDbPath = path.join(os.tmpdir(), `darkgrid-phase10-restarted-${Date.now()}.sqlite`);
    const restartedApp = createMainApp({
      dbPath: restartedDbPath,
      production: true,
      sessionSecret: 'darkgrid-phase10-production-test-secret-key-2026',
      rng: () => 0.95
    });
    const restartedDb = restartedApp.locals.db;
    loadDurableSnapshotFile(restartedDb, snapshotPath);

    const restartedServer = http.createServer(restartedApp);
    await new Promise(resolve => restartedServer.listen(0, '127.0.0.1', resolve));
    const restartedUrl = `http://127.0.0.1:${restartedServer.address().port}`;

    try {
      // Reuse the existing __session cookie from before the restart!
      const resAfterRestart = await fetch(`${restartedUrl}/api/state`, {
        headers: {
          'X-Forwarded-Proto': 'https',
          Cookie: clientA.getCookie()
        }
      });
      assert.equal(resAfterRestart.status, 200);
      const stateJson = await resAfterRestart.json();
      assert.equal(stateJson.ok, true);
      assert.equal(stateJson.state.character.name, 'Sir Aldebaran');
      assert.equal(stateJson.state.dungeonMap.inDungeon, true, 'Dungeon state must survive server restart');
      assert.equal(stateJson.state.dungeonMap.dungeonKey, 'GOBLIN_CAVE');
      assert.equal(stateJson.state.dungeonMap.heroX, 3);
      assert.equal(stateJson.state.dungeonMap.heroY, 15);
      assert.equal(stateJson.state.dungeonMap.discoveredCount, discoveredCountBefore, 'Dungeon Fog of War discovery must survive server restart');
    } finally {
      await new Promise(resolve => restartedServer.close(resolve));
      try { restartedDb.close(); } catch {}
      try { fs.unlinkSync(snapshotPath); } catch {}
      for (const suffix of ['', '-wal', '-shm']) {
        if (fs.existsSync(restartedDbPath + suffix)) {
          try { fs.unlinkSync(restartedDbPath + suffix); } catch {}
        }
      }
    }
  });
});
