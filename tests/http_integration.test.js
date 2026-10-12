const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');
const { getDb } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');

let server;
let baseUrl;

test.before(() => {
  const db = getDb();
  runMigrations(db);
  runSeeds(db);

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
  return new Promise((resolve) => {
    server.close(resolve);
  });
});

test('HTTP Flow: Register -> Create Character -> Game Screen -> Movement', async () => {
  let cookie = '';

  const uniqueSuffix = Date.now().toString().slice(-8);
  const username = `Hero_${uniqueSuffix}`;

  // 1. Register
  const regParams = new URLSearchParams({
    username,
    password: 'password123',
    confirmPassword: 'password123'
  });

  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: regParams,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual'
  });

  assert.equal(regRes.status, 302);
  const setCookie = regRes.headers.get('set-cookie');
  assert.ok(setCookie, 'Should receive session cookie upon registration');
  cookie = setCookie.split(';')[0];

  // 2. Access root -> redirects to character creation
  const rootRes = await fetch(`${baseUrl}/`, {
    headers: { Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(rootRes.status, 302);
  assert.equal(rootRes.headers.get('location'), '/character/create');

  // 3. Create Ranger character
  const charParams = new URLSearchParams({
    name: 'Skugga-Valdi',
    classType: 'RANGER',
    strength: '12',
    constitution: '10',
    dexterity: '16', // base 14 + 2
    intelligence: '10',
    wisdom: '13',   // base 12 + 1
    charisma: '10'  // sum 12+10+16+10+13+10 = 71
  });

  const createCharRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: charParams,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    redirect: 'manual'
  });
  assert.equal(createCharRes.status, 302);
  assert.equal(createCharRes.headers.get('location'), '/game');

  // 4. Access Game screen
  const gameRes = await fetch(`${baseUrl}/game`, {
    headers: { Cookie: cookie }
  });
  assert.equal(gameRes.status, 200);
  const html = await gameRes.text();

  assert.match(html, /Oakhaven/, 'Should show starting city tile name');
  assert.match(html, /Skugga-Valdi/, 'Should show character name');
  assert.match(html, /RANGER/, 'Should show character class');
  assert.match(html, /Minimap \(5×5\)/, 'Should show minimap');
  assert.match(html, /Navigation \(Movement\)/, 'Should show movement section');

  // 5. Move North
  const moveParams = new URLSearchParams({ direction: 'NORTH' });
  const moveRes = await fetch(`${baseUrl}/game/move`, {
    method: 'POST',
    body: moveParams,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    redirect: 'manual'
  });
  assert.equal(moveRes.status, 302);

  // 6. Access Game screen after move
  const gameAfterMoveRes = await fetch(`${baseUrl}/game`, {
    headers: { Cookie: cookie }
  });
  assert.equal(gameAfterMoveRes.status, 200);
  const htmlAfterMove = await gameAfterMoveRes.text();
  assert.match(htmlAfterMove, /Oakhaven North Gate/, 'Should now be at north gates of the city');
  assert.match(htmlAfterMove, /Coordinates: \[X: 7, Y: 6\]/, 'Coordinates should be updated to (7, 6)');
});
