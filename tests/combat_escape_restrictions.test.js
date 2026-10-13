const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createTestDb } = require('./test_helpers');
const { setDb, closeDb } = require('../src/db/connection');
const app = require('../src/app');

let server;
let baseUrl;
let db;

test.before(() => {
  db = createTestDb();
  setDb(db);

  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(() => {
  closeDb();
  return new Promise((resolve) => {
    server.close(resolve);
  });
});

function updateCookies(existingCookie, res) {
  const cookieMap = {};
  if (existingCookie) {
    existingCookie.split(';').forEach(c => {
      const parts = c.trim().split('=');
      if (parts[0]) cookieMap[parts[0]] = parts.slice(1).join('=');
    });
  }
  const rawHeaders = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? res.headers.get('set-cookie').split(/,(?=[a-zA-Z0-9_.-]+=)/) : []);

  for (const str of rawHeaders) {
    if (!str) continue;
    const firstPart = str.split(';')[0].trim();
    const parts = firstPart.split('=');
    if (parts[0]) cookieMap[parts[0]] = parts.slice(1).join('=');
  }

  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

test('C2 HTTP Integration: Illegal escape attempts during IN_COMBAT are rejected; legal Flee and AoO enforced', async () => {
  let cookie = '';
  const suffix = Date.now().toString().slice(-6);
  const username = `EscapeUser_${suffix}`;

  // 1. Register & Login
  const regPage = await fetch(`${baseUrl}/register`);
  cookie = updateCookies(cookie, regPage);
  const regHtml = await regPage.text();
  const csrf = regHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({
      username,
      password: 'password123',
      confirmPassword: 'password123',
      _csrf: csrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, regRes);

  // 2. Create Character
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: `Kappi_${suffix}`,
      classType: 'FIGHTER',
      strength: '16',
      dexterity: '14',
      constitution: '12',
      intelligence: '10',
      wisdom: '10',
      charisma: '9',
      _csrf: createCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get(`Kappi_${suffix}`);
  assert.ok(hero);

  // 3. Move hero to a wilderness tile and create an active DISCOVERED encounter
  const forestTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND terrain = 'FOREST' LIMIT 1").get();
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(forestTile.id, hero.id);

  const monster = db.prepare('SELECT * FROM monsters WHERE challenge_rating <= 0.5 ORDER BY id ASC LIMIT 1').get();
  const enc1 = db.prepare(`
    INSERT INTO encounters (character_id, monster_id, tile_id, status, is_ambush, current_monster_hp, monster_max_hp, combat_round)
    VALUES (?, ?, ?, 'DISCOVERED', 0, ?, ?, 0)
  `).run(hero.id, monster.id, forestTile.id, monster.base_hp, monster.base_hp);
  const enc1Id = enc1.lastInsertRowid;

  // Verify GET /game in DISCOVERED status: offers Investigate and Ignore
  const discPage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, discPage);
  const discHtml = await discPage.text();
  assert.ok(discHtml.includes('/game/encounter/ignore'), 'Must offer ignore in DISCOVERED status');
  assert.ok(discHtml.includes('/game/encounter/investigate'), 'Must offer investigate in DISCOVERED status');

  const discCsrf = discHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // Ignore works in DISCOVERED status
  const ignoreRes = await fetch(`${baseUrl}/game/encounter/ignore`, {
    method: 'POST',
    body: new URLSearchParams({
      encounterId: enc1Id.toString(),
      _csrf: discCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(ignoreRes.status, 302);
  cookie = updateCookies(cookie, ignoreRes);

  const enc1Db = db.prepare('SELECT * FROM encounters WHERE id = ?').get(enc1Id);
  assert.equal(enc1Db.status, 'IGNORED', 'Encounter must be IGNORED when ignored in DISCOVERED status');

  // 4. Create second encounter and engage in combat (IN_COMBAT)
  const enc2 = db.prepare(`
    INSERT INTO encounters (character_id, monster_id, tile_id, status, is_ambush, current_monster_hp, monster_max_hp, combat_round)
    VALUES (?, ?, ?, 'IN_COMBAT', 0, ?, ?, 1)
  `).run(hero.id, monster.id, forestTile.id, monster.base_hp, monster.base_hp);
  const enc2Id = enc2.lastInsertRowid;

  // Verify GET /game while IN_COMBAT
  const combatPage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, combatPage);
  const combatHtml = await combatPage.text();

  // A. No ignore or conclude form in UI
  assert.equal(combatHtml.includes('/game/encounter/ignore'), false, 'UI must NOT render ignore form during IN_COMBAT');
  assert.equal(combatHtml.includes('/game/encounter/conclude'), false, 'UI must NOT render conclude form during IN_COMBAT');
  assert.equal(combatHtml.includes('Withdraw Carefully'), false, 'UI must NOT render Withdraw Carefully button');

  // B. Legal combat actions are Attack, Drink Potion, Flee
  assert.ok(combatHtml.includes('/game/combat/attack'), 'UI must render Attack action');
  assert.ok(combatHtml.includes('/game/combat/flee'), 'UI must render Flee action');

  const combatCsrf = combatHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // 5. Illegal attempt 1: POST /game/encounter/ignore during IN_COMBAT
  const illegalIgnoreRes = await fetch(`${baseUrl}/game/encounter/ignore`, {
    method: 'POST',
    body: new URLSearchParams({
      encounterId: enc2Id.toString(),
      _csrf: combatCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(illegalIgnoreRes.status, 302);
  const redirectLocation = illegalIgnoreRes.headers.get('location') || '';
  assert.ok(redirectLocation.includes('error='), 'Server must redirect with error query parameter on illegal ignore');
  assert.ok(
    decodeURIComponent(redirectLocation).includes('Cannot ignore an encounter during active combat'),
    'Error message must specify that ignoring is forbidden during combat'
  );

  // Verify SQLite state: STILL IN_COMBAT
  const enc2AfterIgnore = db.prepare('SELECT * FROM encounters WHERE id = ?').get(enc2Id);
  assert.equal(enc2AfterIgnore.status, 'IN_COMBAT', 'Encounter must remain IN_COMBAT after illegal ignore attempt');

  // 6. Movement attempt during active combat must fail
  const moveRes = await fetch(`${baseUrl}/game/move`, {
    method: 'POST',
    body: new URLSearchParams({
      direction: 'SOUTH',
      _csrf: combatCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(moveRes.status, 302);
  const moveRedirect = moveRes.headers.get('location') || '';
  assert.ok(moveRedirect.includes('error='), 'Movement must be blocked during combat');
  assert.ok(decodeURIComponent(moveRedirect).includes('combat'), 'Error message must mention combat');

  const heroTileAfterMove = db.prepare('SELECT tile_id FROM characters WHERE id = ?').get(hero.id).tile_id;
  assert.equal(heroTileAfterMove, forestTile.id, 'Hero position must not change when movement is blocked');

  // 7. Illegal attempt 2: POST /game/encounter/conclude (route removed)
  const illegalConcludeRes = await fetch(`${baseUrl}/game/encounter/conclude`, {
    method: 'POST',
    body: new URLSearchParams({
      encounterId: enc2Id.toString(),
      _csrf: combatCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(illegalConcludeRes.status, 404, 'POST /game/encounter/conclude must return 404 Not Found');

  const enc2AfterConclude = db.prepare('SELECT * FROM encounters WHERE id = ?').get(enc2Id);
  assert.equal(enc2AfterConclude.status, 'IN_COMBAT', 'Encounter must remain IN_COMBAT');

  // 8. Legal Flee: POST /game/combat/flee
  // Give hero plenty of HP so hero survives Attack of Opportunity
  db.prepare('UPDATE characters SET current_hp = 30, max_hp = 30 WHERE id = ?').run(hero.id);

  const fleeRes = await fetch(`${baseUrl}/game/combat/flee`, {
    method: 'POST',
    body: new URLSearchParams({
      encounterId: enc2Id.toString(),
      _csrf: combatCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(fleeRes.status, 302);
  cookie = updateCookies(cookie, fleeRes);

  const enc2AfterFlee = db.prepare('SELECT * FROM encounters WHERE id = ?').get(enc2Id);
  assert.equal(enc2AfterFlee.status, 'ESCAPED', 'Legal flee must set status to ESCAPED');

  // Verify Attack of Opportunity was logged
  const fleeEvents = db.prepare("SELECT * FROM combat_events WHERE encounter_id = ? AND event_type = 'FLEE'").all(enc2Id);
  assert.equal(fleeEvents.length, 1, 'Exactly one FLEE combat event must be logged for Attack of Opportunity');

  // Verify movement is now unlocked
  const legalMovePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  const legalMoveHtml = await legalMovePage.text();
  const legalMoveCsrf = legalMoveHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const legalMoveRes = await fetch(`${baseUrl}/game/move`, {
    method: 'POST',
    body: new URLSearchParams({
      direction: 'SOUTH',
      _csrf: legalMoveCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(legalMoveRes.status, 302);
  const legalMoveRedirect = legalMoveRes.headers.get('location') || '';
  assert.equal(legalMoveRedirect.includes('error='), false, 'Movement must succeed after combat is resolved');

  const heroTileAfterLegalMove = db.prepare('SELECT tile_id FROM characters WHERE id = ?').get(hero.id).tile_id;
  assert.notEqual(heroTileAfterLegalMove, forestTile.id, 'Hero must have moved to new tile');
});
