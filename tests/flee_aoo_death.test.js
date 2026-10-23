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
    existingCookie.split(';').forEach((c) => {
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

  return Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

test('Session 2 HTTP Integration: Flee with lethal Attack of Opportunity triggers full permadeath lifecycle', async () => {
  let cookie = '';

  // 1. Register a user
  const regPage = await fetch(`${baseUrl}/register`);
  cookie = updateCookies(cookie, regPage);
  const regHtml = await regPage.text();
  const regCsrf = regHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({
      username: 'FleeVictimHero',
      password: 'password123',
      confirmPassword: 'password123',
      _csrf: regCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, regRes);
  assert.equal(regRes.status, 302, 'Registration must succeed and redirect');

  // 2. Create Character (Fighter with 10 gp and standard gear)
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: 'FleeVictimHero',
      classType: 'FIGHTER',
      strength: '16',
      constitution: '13',
      dexterity: '12',
      intelligence: '11',
      wisdom: '10',
      charisma: '10',
      _csrf: createCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, createRes);
  assert.equal(createRes.status, 302, 'Character creation must redirect');

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get('FleeVictimHero');
  assert.ok(hero, 'Hero record must exist');
  assert.equal(hero.is_alive, 1);
  assert.equal(hero.gold, 10, 'Hero starts with 10 gold');

  // Count items owned by hero prior to combat
  const initialItems = db.prepare('SELECT * FROM item_instances WHERE owner_character_id = ?').all(hero.id);
  assert.ok(initialItems.length > 0, 'Hero must possess starting equipment and potions');

  // 3. Setup a wilderness combat encounter where hero has only 1 HP
  // Find a wild tile (forest or plains)
  const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
  assert.ok(wildTile, 'Wilderness tile must exist');

  // Move hero to the wilderness tile and set HP to 1
  db.prepare('UPDATE characters SET tile_id = ?, current_hp = 1 WHERE id = ?').run(wildTile.id, hero.id);

  // Pick Orc (CR 1/3, 2d4+4 damage) so any hit is guaranteed lethal against 1 HP
  const orcMonster = db.prepare("SELECT * FROM monsters WHERE name = 'Orc'").get() || db.prepare("SELECT * FROM monsters WHERE attack_bonus >= 3 LIMIT 1").get();
  assert.ok(orcMonster, 'Monster must exist');

  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, tile_id, status, is_ambush, current_monster_hp, monster_max_hp, combat_round
    ) VALUES (?, ?, ?, 'IN_COMBAT', 0, ?, ?, 1)
  `).run(hero.id, orcMonster.id, wildTile.id, orcMonster.base_hp, orcMonster.base_hp);
  const encounterId = encRes.lastInsertRowid;

  // 4. Fetch /game to get CSRF token and confirm IN_COMBAT state
  const gamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage);
  const gameHtml = await gamePage.text();
  assert.ok(gameHtml.includes('Battle Record') || gameHtml.includes('Combat Interface') || gameHtml.includes('Flee'), 'Must render combat interface');

  const combatCsrf = gameHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // 5. Hero submits Flee via POST /game/combat/flee with deterministic lethal hit
  // Stub Math.random: first 5 rolls return 0.95 (guarantees hit and lethal damage), subsequent return 0.25 (surviving items)
  const originalRandom = Math.random;
  let callCount = 0;
  Math.random = () => {
    callCount++;
    return callCount <= 5 ? 0.95 : 0.25;
  };

  let fleeRes;
  try {
    fleeRes = await fetch(`${baseUrl}/game/combat/flee`, {
      method: 'POST',
      body: new URLSearchParams({
        encounterId: encounterId.toString(),
        round: '1',
        _csrf: combatCsrf
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      redirect: 'manual'
    });
    cookie = updateCookies(cookie, fleeRes);
  } finally {
    Math.random = originalRandom;
  }

  // Verification 1: Redirect to /game/fallen
  assert.equal(fleeRes.status, 302, 'Lethal flee must redirect');
  assert.ok(fleeRes.headers.get('location').includes('/game/fallen'), 'Must redirect to fallen memorial screen');

  // Verification 2: Character permadeath status
  const deadHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(deadHero.is_alive, 0, 'Character is_alive must be 0');
  assert.equal(deadHero.current_hp, 0, 'Character HP must be 0');
  assert.ok(deadHero.died_at !== null, 'died_at timestamp must be recorded');
  assert.equal(deadHero.gold, 0, 'Dead hero gold must be reduced to 0');

  // Verification 3: Encounter status is DEFEAT, NOT ESCAPED
  const resolvedEncounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId);
  assert.equal(resolvedEncounter.status, 'DEFEAT', 'Encounter must be marked DEFEAT, strictly NOT ESCAPED');

  // Verification 4: Movement is strictly impossible for fallen hero
  const moveRes = await fetch(`${baseUrl}/game/move`, {
    method: 'POST',
    body: new URLSearchParams({
      direction: 'NORTH',
      _csrf: combatCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  // Must redirect to fallen or root
  const postMoveHero = db.prepare('SELECT tile_id FROM characters WHERE id = ?').get(hero.id);
  assert.equal(postMoveHero.tile_id, wildTile.id, 'Fallen hero cannot change tiles/move');

  // Verification 5: Persistent Monster created on the tile with +10% boosted HP and 50% gold
  const pm = db.prepare('SELECT * FROM monster_instances WHERE tile_id = ? AND status = ?').get(wildTile.id, 'ACTIVE');
  assert.ok(pm, 'Persistent monster must be created on the wild tile');
  assert.equal(pm.monster_id, orcMonster.id, 'Persistent monster must match the slaying monster');
  assert.equal(pm.kill_count, 1, 'Kill count must be 1');
  const expectedBoostedHp = Math.ceil(orcMonster.base_hp * 1.10);
  assert.equal(pm.max_hp, expectedBoostedHp, 'Max HP must receive exactly +10% boost once');
  assert.equal(pm.current_hp, pm.max_hp, 'Current HP must be full boosted max HP');
  assert.equal(pm.held_gold, 5, 'Persistent monster must hold 50% of the 10 gp = 5 gp');

  // Verification 6: Items transferred without duplication
  const monsterItems = db.prepare('SELECT * FROM item_instances WHERE owner_type = ? AND owner_monster_id = ?').all('MONSTER', pm.id);
  const remainingHeroItems = db.prepare('SELECT * FROM item_instances WHERE owner_character_id = ?').all(hero.id);
  assert.equal(remainingHeroItems.length, 0, 'Hero must own 0 items after death');
  assert.ok(monsterItems.length > 0, 'Persistent monster must hold surviving transferred items');

  // Total items in database across hero and monster must equal surviving items count
  const allItemInstances = db.prepare('SELECT id FROM item_instances WHERE id IN (' + initialItems.map(i => i.id).join(',') + ')').all();
  assert.equal(allItemInstances.length, monsterItems.length, 'No items may duplicate or become orphaned');

  // Verification 7: Memorial page renders authentic fallen details
  const fallenPage = await fetch(`${baseUrl}/game/fallen`, { headers: { Cookie: cookie } });
  const fallenHtml = await fallenPage.text();
  assert.equal(fallenPage.status, 200, 'Fallen memorial page must respond with 200');
  assert.ok(fallenHtml.includes('A Champion Has Fallen'), 'Must render fallen banner');
  assert.ok(fallenHtml.includes('FleeVictimHero'), 'Must display fallen hero name');
  assert.ok(fallenHtml.includes(orcMonster.name), 'Must display the slaying monster name');
});
