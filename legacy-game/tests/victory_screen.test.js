const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../app');
const { createTestDb } = require('./test_helpers');
const { setDb, closeDb } = require('../../src/db/connection');
const { registerUser } = require('../../src/domain/auth/service');
const { createCharacter } = require('../../src/domain/character/rules');
const { handlePlayerDeath, handleMonsterDefeat } = require('../../src/domain/monsters/persistence');
const { getVictoryData, resolveDefeatDescription } = require('../../src/domain/combat/victory');

let server;
let baseUrl;
let db;

test.before(() => {
  db = createTestDb();
  setDb(db);

  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
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

// =============================================================================
// 1. Victory Domain & Data Resolution Tests
// =============================================================================
test('1. resolveDefeatDescription extracts 9_dead from JSON and provides fallback', () => {
  // Case A: valid 9_dead present in JSON string
  const jsonWithDead = JSON.stringify({
    '1_distant': 'A shadow moves.',
    '9_dead': 'A limp grey carcass sprawled cold upon the earth.'
  });
  assert.equal(
    resolveDefeatDescription(jsonWithDead),
    'A limp grey carcass sprawled cold upon the earth.'
  );

  // Case B: object input with 9_dead
  assert.equal(
    resolveDefeatDescription({ '9_dead': 'A withered pile of dead plant matter.' }),
    'A withered pile of dead plant matter.'
  );

  // Case C: missing 9_dead falls back to heroic defeat text
  assert.equal(
    resolveDefeatDescription({ '1_distant': 'Something unseen' }),
    'The abominable beast collapses to the cold earth with a final shudder, vanquished at your hand.'
  );

  // Case D: malformed JSON falls back safely
  assert.equal(
    resolveDefeatDescription('invalid json string'),
    'The abominable beast collapses to the cold earth with a final shudder, vanquished at your hand.'
  );
});

test('2. Normal monster victory: extracts confirmed XP, gold, and defeat narrative', async () => {
  const user = await registerUser(db, 'v_user_1', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Siegfried',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 13, intelligence: 11, wisdom: 10, charisma: 10 }
  });

  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  assert.ok(wolf, 'Wolf monster exists');

  // Create encounter and conclude with victory
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'IN_COMBAT', 0, 2)
  `).run(hero.id, wolf.id);
  const encId = Number(encRes.lastInsertRowid);

  const encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
  handleMonsterDefeat(db, hero, encRow, wolf, null, {
    rng: () => 0.99 // No loot items
  });

  const victoryData = getVictoryData(db, hero.id, encId);
  assert.ok(victoryData, 'Victory data should resolve');
  assert.equal(victoryData.cleanMonsterName, 'Wolf');
  assert.ok(victoryData.defeatDescription.includes('carcass sprawled cold'), 'Should use Wolf 9_dead description');
  assert.equal(victoryData.xpAwarded, wolf.xp_reward);
  assert.equal(typeof victoryData.goldLooted, 'number');
  assert.equal(victoryData.leveledUp, false);
  assert.equal(victoryData.persistentInfo, null);
});

test('3. Victory with items: accurately lists all awarded item names', async () => {
  const user = await registerUser(db, 'v_user_2', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Beowulf',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 13, intelligence: 11, wisdom: 10, charisma: 10 }
  });

  const troll = db.prepare("SELECT * FROM monsters WHERE name = 'Troll'").get();
  assert.ok(troll, 'Troll monster exists in database');
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'IN_COMBAT', 0, 3)
  `).run(hero.id, troll.id);
  const encId = Number(encRes.lastInsertRowid);

  const encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
  // Force drop items by supplying deterministic RNG: 0.1 < 0.25 (gold drop), 0.05 < 0.15 (item drop)
  handleMonsterDefeat(db, hero, encRow, troll, null, {
    rng: () => 0.05
  });

  const victoryData = getVictoryData(db, hero.id, encId);
  assert.ok(victoryData, 'Victory data should resolve');
  assert.ok(victoryData.itemsLooted >= 1, 'Should have looted at least 1 item');
  assert.ok(victoryData.lootedItems.length >= 1, 'lootedItems list must be populated');
  assert.ok(typeof victoryData.lootedItems[0] === 'string', 'Looted item must have a display name');
});

test('4. Victory causing level up: flags leveledUp and calculates hpGain', async () => {
  const user = await registerUser(db, 'v_user_3', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Valeria',
    classType: 'CLERIC',
    stats: { strength: 12, dexterity: 10, constitution: 10, intelligence: 11, wisdom: 15, charisma: 14 }
  });

  // Give hero 1100 XP (Level 2 threshold is 1300 XP)
  db.prepare('UPDATE characters SET xp = 1100 WHERE id = ?').run(hero.id);

  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  assert.ok(wolf, 'Wolf monster exists');
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'IN_COMBAT', 0, 1)
  `).run(hero.id, wolf.id);
  const encId = Number(encRes.lastInsertRowid);

  const encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
  handleMonsterDefeat(db, hero, encRow, wolf, null, { rng: () => 0.99 });

  const victoryData = getVictoryData(db, hero.id, encId);
  assert.ok(victoryData, 'Victory data should resolve');
  assert.equal(victoryData.leveledUp, true, 'Hero should level up');
  assert.equal(victoryData.newLevel, 2, 'New level should be 2');
  assert.ok(victoryData.hpGain > 0, 'HP gain must be greater than 0');
});

test('5. Persistent Monster Victory: recognizes avenged fallen hero from database', async () => {
  // Create fallen hero who died to this persistent monster
  const user1 = await registerUser(db, 'victim_user', 'pass1234');
  const victimHero = createCharacter(db, {
    userId: user1.id,
    name: 'FallenKaelen',
    classType: 'RANGER',
    stats: { strength: 12, dexterity: 16, constitution: 10, intelligence: 11, wisdom: 13, charisma: 10 }
  });
  // Give victim hero 100 gold and Longsword +1
  db.prepare('UPDATE characters SET gold = 100 WHERE id = ?').run(victimHero.id);
  const swordDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longsword +1'").get();
  if (swordDef) {
    db.prepare(`
      INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
      VALUES (?, 'CHARACTER', ?)
    `).run(swordDef.id, victimHero.id);
  }

  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  const victimEncRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 5, ?, 'IN_COMBAT', 10, 1)
  `).run(victimHero.id, wolf.id);
  const victimEncId = Number(victimEncRes.lastInsertRowid);
  const victimEnc = db.prepare('SELECT * FROM encounters WHERE id = ?').get(victimEncId);

  // Victim hero dies: 50% gold (50 gp) and surviving items transfer to persistent monster
  const deathResult = handlePlayerDeath(db, victimHero, victimEnc, wolf, null, {
    rng: () => 0.1 // item survives
  });
  const persistentInstanceId = deathResult.instanceId;
  assert.ok(persistentInstanceId, 'Persistent monster instance must be created');

  // Verify victim hero record links to persistent monster
  const fallenCheck = db.prepare('SELECT killed_by_monster_instance_id FROM characters WHERE id = ?').get(victimHero.id);
  assert.equal(fallenCheck.killed_by_monster_instance_id, persistentInstanceId);

  // Now create victor hero
  const user2 = await registerUser(db, 'avenger_user', 'pass1234');
  const avengerHero = createCharacter(db, {
    userId: user2.id,
    name: 'AvengerMorrigan',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 13, intelligence: 11, wisdom: 10, charisma: 10 }
  });

  // Avenger hero engages the persistent monster
  const avengerEncRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, monster_instance_id, status, current_monster_hp, combat_round
    ) VALUES (?, 5, ?, ?, 'IN_COMBAT', 0, 4)
  `).run(avengerHero.id, wolf.id, persistentInstanceId);
  const avengerEncId = Number(avengerEncRes.lastInsertRowid);
  const avengerEnc = db.prepare('SELECT * FROM encounters WHERE id = ?').get(avengerEncId);
  const persistentInstance = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(persistentInstanceId);

  // Avenger slays the persistent monster
  handleMonsterDefeat(db, avengerHero, avengerEnc, wolf, persistentInstance, { rng: () => 0.5 });

  const victoryData = getVictoryData(db, avengerHero.id, avengerEncId);
  assert.ok(victoryData, 'Victory data should resolve for persistent monster');
  assert.ok(victoryData.persistentInfo, 'Persistent info must be present');
  assert.equal(victoryData.persistentInfo.isPersistent, true);
  assert.equal(victoryData.persistentInfo.killCount, 1);
  assert.ok(victoryData.persistentInfo.avengedHeroes.length >= 1, 'Must list at least 1 avenged hero');
  assert.equal(victoryData.persistentInfo.avengedHeroes[0].name, 'FallenKaelen', 'Must display real name of fallen hero');
  assert.equal(victoryData.goldLooted, 50, 'Must recover the 50 gp stolen from the fallen hero');
});

test('6. Non-victory encounters: getVictoryData safely returns null', async () => {
  const user = await registerUser(db, 'v_user_4', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Cautious',
    classType: 'RANGER',
    stats: { strength: 12, dexterity: 16, constitution: 10, intelligence: 11, wisdom: 13, charisma: 10 }
  });
  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();

  // Encounter in combat
  const inCombatRes = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
    VALUES (?, 1, ?, 'IN_COMBAT', 10)
  `).run(hero.id, wolf.id);
  assert.equal(getVictoryData(db, hero.id, Number(inCombatRes.lastInsertRowid)), null);

  // Encounter escaped
  const escapedRes = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
    VALUES (?, 1, ?, 'ESCAPED', 10)
  `).run(hero.id, wolf.id);
  assert.equal(getVictoryData(db, hero.id, Number(escapedRes.lastInsertRowid)), null);

  // Encounter defeat
  const defeatRes = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
    VALUES (?, 1, ?, 'DEFEAT', 10)
  `).run(hero.id, wolf.id);
  assert.equal(getVictoryData(db, hero.id, Number(defeatRes.lastInsertRowid)), null);

  // Encounter of another character
  const victoryRes = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
    VALUES (?, 1, ?, 'VICTORY', 0)
  `).run(hero.id, wolf.id);
  assert.equal(getVictoryData(db, 99999, Number(victoryRes.lastInsertRowid)), null, 'Cannot access another hero victory');
});

// =============================================================================
// 2. HTTP Flow, Idempotency & Duplicate Reward Prevention
// =============================================================================
test('7. HTTP Flow: Combat victory redirects to /game/victory?encounterId=... and renders complete screen', async () => {
  let cookie = '';
  const username = `Vic_${Date.now().toString().slice(-8)}`;

  // 1. Acquire CSRF
  const regPageRes = await fetch(`${baseUrl}/register`);
  const regPageHtml = await regPageRes.text();
  let csrfToken = regPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];
  cookie = updateCookies(cookie, regPageRes);

  // 2. Register
  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({
      username,
      password: 'password123',
      confirmPassword: 'password123',
      _csrf: csrfToken
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, regRes);

  // 3. Create hero
  const createPageRes = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  const createPageHtml = await createPageRes.text();
  csrfToken = createPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createCharRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: 'Vanquisher',
      classType: 'FIGHTER',
      strength: '16', constitution: '13', dexterity: '12',
      intelligence: '11', wisdom: '10', charisma: '10',
      _csrf: csrfToken
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, createCharRes);

  // Fetch character from DB
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  assert.ok(user, 'User should be found in db');
  const hero = db.prepare('SELECT * FROM characters WHERE user_id = ? AND is_alive = 1').get(user.id);
  assert.ok(hero, 'Hero should be created in db');

  const initialGold = hero.gold;
  const initialXp = hero.xp;

  // Insert an active combat encounter where monster has only 1 HP remaining
  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'IN_COMBAT', 1, 1)
  `).run(hero.id, wolf.id);
  const encId = Number(encRes.lastInsertRowid);

  // Fetch the game page to get fresh CSRF token
  const gamePageRes = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  const gamePageHtml = await gamePageRes.text();
  const gameCsrfMatch = gamePageHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  if (gameCsrfMatch) {
    csrfToken = gameCsrfMatch[1];
  }

  // 4. Submit ATTACK via POST /game/combat/attack (with deterministic hit/damage)
  const originalRandom = Math.random;
  let attackRes;
  try {
    Math.random = () => 0.95; // Guarantees d20 = 19/20 (hit) and max damage >= 1
    attackRes = await fetch(`${baseUrl}/game/combat/attack`, {
      method: 'POST',
      body: new URLSearchParams({
        encounterId: encId.toString(),
        round: '1',
        _csrf: csrfToken
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      redirect: 'manual'
    });
  } finally {
    Math.random = originalRandom;
  }

  // Verify HTTP 302 redirect to /game/victory?encounterId=...
  assert.equal(attackRes.status, 302);
  const redirectLocation = attackRes.headers.get('location');
  assert.ok(
    redirectLocation.includes(`/game/victory?encounterId=${encId}`),
    `Must redirect to /game/victory?encounterId=${encId}, got: ${redirectLocation}`
  );

  // 5. Access GET /game/victory?encounterId=...
  const victoryRes = await fetch(`${baseUrl}${redirectLocation}`, {
    headers: { Cookie: cookie }
  });
  assert.equal(victoryRes.status, 200);
  const victoryHtml = await victoryRes.text();

  // Validate screen content requirements
  assert.match(victoryHtml, /VICTORY/i, 'Must display VICTORY heading');
  assert.match(victoryHtml, /Wolf/, 'Must display monster name');
  assert.match(victoryHtml, /Experience Gained/i, 'Must display Experience Gained');
  assert.match(victoryHtml, /Gold Recovered/i, 'Must display Gold Recovered');
  assert.match(victoryHtml, /Continue Exploring/i, 'Must display Continue Exploring button');
  assert.match(victoryHtml, /href="\/game"/, 'Continue Exploring button must point to /game');

  // Verify hero gained rewards exactly once
  const heroAfter = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.ok(heroAfter.xp > initialXp, 'Hero must gain XP from victory');
  const postVictoryGold = heroAfter.gold;

  // 6. Refresh Test: Hit GET /game/victory multiple times
  const refreshRes1 = await fetch(`${baseUrl}${redirectLocation}`, { headers: { Cookie: cookie } });
  assert.equal(refreshRes1.status, 200);
  const refreshRes2 = await fetch(`${baseUrl}${redirectLocation}`, { headers: { Cookie: cookie } });
  assert.equal(refreshRes2.status, 200);

  // Verify absolutely no duplicate rewards awarded on page refresh
  const heroAfterRefreshes = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(heroAfterRefreshes.gold, postVictoryGold, 'Gold must not increase on page refresh');
  assert.equal(heroAfterRefreshes.xp, heroAfter.xp, 'XP must not increase on page refresh');

  // 7. Duplicate POST test: Resubmitting attack on completed encounter cannot duplicate rewards
  const dupAttackRes = await fetch(`${baseUrl}/game/combat/attack`, {
    method: 'POST',
    body: new URLSearchParams({
      encounterId: encId.toString(),
      round: '1',
      _csrf: csrfToken
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  // Should redirect to /game with error message, not award anything
  const heroAfterDup = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(heroAfterDup.gold, postVictoryGold, 'Gold must not duplicate on replay attack');
  assert.equal(heroAfterDup.xp, heroAfter.xp, 'XP must not duplicate on replay attack');

  // 8. Navigation to /game: resumes normal exploration
  const continueRes = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  assert.equal(continueRes.status, 200);
  const continueHtml = await continueRes.text();
  assert.match(continueHtml, /Minimap \(5×5\)/, 'Should be on normal exploration screen');
});

test('8. Death Screen priority: Dead character cannot access victory screen and is redirected to /game/fallen', async () => {
  let cookie = '';
  const username = `Ded_${Date.now().toString().slice(-8)}`;

  // Register and create hero
  const regPageRes = await fetch(`${baseUrl}/register`);
  const regPageHtml = await regPageRes.text();
  let csrfToken = regPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];
  cookie = updateCookies(cookie, regPageRes);

  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({ username, password: 'password123', confirmPassword: 'password123', _csrf: csrfToken }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, regRes);

  const createPageRes = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  const createPageHtml = await createPageRes.text();
  csrfToken = createPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createCharRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: 'SoonDead',
      classType: 'CLERIC',
      strength: '12', constitution: '10', dexterity: '10',
      intelligence: '11', wisdom: '15', charisma: '14',
      _csrf: csrfToken
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, createCharRes);

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  assert.ok(user);
  const hero = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(user.id);
  assert.ok(hero);

  // Kill the hero
  db.prepare('UPDATE characters SET is_alive = 0, current_hp = 0, died_at = CURRENT_TIMESTAMP WHERE id = ?').run(hero.id);

  // Attempt to access /game/victory
  const victoryAttempt = await fetch(`${baseUrl}/game/victory`, {
    headers: { Cookie: cookie },
    redirect: 'manual'
  });

  // Must redirect to /game/fallen
  assert.equal(victoryAttempt.status, 302);
  assert.equal(
    victoryAttempt.headers.get('location'),
    '/game/fallen',
    'Dead character must be redirected to /game/fallen'
  );
});

test('9. Ranger Opening Shot leaves monster at minimum 1 HP (redirects to /game combat screen), and first Attack redirects to /game/victory', async () => {
  let cookie = '';
  const username = `Rng_${Date.now().toString().slice(-8)}`;

  const regPageRes = await fetch(`${baseUrl}/register`);
  const regPageHtml = await regPageRes.text();
  let csrfToken = regPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];
  cookie = updateCookies(cookie, regPageRes);

  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({ username, password: 'password123', confirmPassword: 'password123', _csrf: csrfToken }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, regRes);

  const createPageRes = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  const createPageHtml = await createPageRes.text();
  csrfToken = createPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createCharRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: 'SniperHero',
      classType: 'RANGER',
      strength: '12', constitution: '10', dexterity: '16',
      intelligence: '11', wisdom: '13', charisma: '10',
      _csrf: csrfToken
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, createCharRes);

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  const hero = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(user.id);

  // Equip a Shortbow for Ranger
  const bowDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Shortbow'").get();
  if (bowDef) {
    db.prepare(`
      INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
      VALUES (?, 'CHARACTER', ?, 'RANGED_WEAPON')
    `).run(bowDef.id, hero.id);
  }

  // Create discovered encounter where hero spotted monster first and monster has 2 HP
  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round,
      spotted_by_hero, is_ambush, opening_shot_resolved
    ) VALUES (?, 1, ?, 'DISCOVERED', 2, 0, 1, 0, 0)
  `).run(hero.id, wolf.id);
  const encId = Number(encRes.lastInsertRowid);

  // Fetch CSRF
  const gamePageRes = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  const gamePageHtml = await gamePageRes.text();
  const gameCsrfMatch = gamePageHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  if (gameCsrfMatch) csrfToken = gameCsrfMatch[1];

  // Submit investigate: opening shot fires, wounds monster to 1 HP, and enters combat on /game
  const originalRandom = Math.random;
  let investRes;
  try {
    Math.random = () => 0.95; // Guaranteed hit & high damage
    investRes = await fetch(`${baseUrl}/game/encounter/investigate`, {
      method: 'POST',
      body: new URLSearchParams({ encounterId: encId.toString(), _csrf: csrfToken }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      redirect: 'manual'
    });
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(investRes.status, 302);
  const investLocation = investRes.headers.get('location');
  assert.equal(
    investLocation,
    '/game',
    `Opening shot must enter combat on /game rather than skipping straight to victory, got: ${investLocation}`
  );

  const encAfterOpening = db.prepare('SELECT status, current_monster_hp FROM encounters WHERE id = ?').get(encId);
  assert.equal(encAfterOpening.status, 'IN_COMBAT');
  assert.equal(encAfterOpening.current_monster_hp, 1, 'Monster must remain at 1 HP after Opening Shot');

  // Now player performs at least one Attack action to defeat the monster
  let attackRes;
  try {
    Math.random = () => 0.95;
    attackRes = await fetch(`${baseUrl}/game/combat/attack`, {
      method: 'POST',
      body: new URLSearchParams({ encounterId: encId.toString(), round: '1', _csrf: csrfToken }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      redirect: 'manual'
    });
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(attackRes.status, 302);
  const attackLocation = attackRes.headers.get('location');
  assert.ok(
    attackLocation.includes(`/game/victory?encounterId=${encId}`),
    `Player attack kill must redirect to /game/victory?encounterId=${encId}, got: ${attackLocation}`
  );
});

test('10. Escape / Flee never redirects to Victory Screen', async () => {
  let cookie = '';
  const username = `Fle_${Date.now().toString().slice(-8)}`;

  const regPageRes = await fetch(`${baseUrl}/register`);
  const regPageHtml = await regPageRes.text();
  let csrfToken = regPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];
  cookie = updateCookies(cookie, regPageRes);

  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({ username, password: 'password123', confirmPassword: 'password123', _csrf: csrfToken }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, regRes);

  const createPageRes = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  const createPageHtml = await createPageRes.text();
  csrfToken = createPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createCharRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: 'FleeHero',
      classType: 'FIGHTER',
      strength: '16', constitution: '13', dexterity: '12',
      intelligence: '11', wisdom: '10', charisma: '10',
      _csrf: csrfToken
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, createCharRes);

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  const hero = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(user.id);

  // Give plenty of HP to survive AoO
  db.prepare('UPDATE characters SET current_hp = 50, max_hp = 50 WHERE id = ?').run(hero.id);

  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'IN_COMBAT', 20, 1)
  `).run(hero.id, wolf.id);
  const encId = Number(encRes.lastInsertRowid);

  // Fetch CSRF
  const gamePageRes = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  const gamePageHtml = await gamePageRes.text();
  const gameCsrfMatch = gamePageHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  if (gameCsrfMatch) csrfToken = gameCsrfMatch[1];

  // Submit FLEE
  const fleeRes = await fetch(`${baseUrl}/game/combat/flee`, {
    method: 'POST',
    body: new URLSearchParams({ encounterId: encId.toString(), round: '1', _csrf: csrfToken }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });

  assert.equal(fleeRes.status, 302);
  const location = fleeRes.headers.get('location');
  assert.ok(
    location.startsWith('/game?info='),
    `Flee must redirect to /game?info=..., got: ${location}`
  );
  assert.ok(!location.includes('victory'), 'Flee must NEVER redirect to victory');
});
