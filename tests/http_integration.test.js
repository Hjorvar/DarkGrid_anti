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

test('HTTP Flow: Register -> Create Character -> Game Screen -> Movement', async () => {
  let cookie = '';

  const uniqueSuffix = Date.now().toString().slice(-8);
  const username = `Hero_${uniqueSuffix}`;

  // 0. Get Register page to acquire initial session and CSRF token
  const getRegRes = await fetch(`${baseUrl}/register`);
  assert.equal(getRegRes.status, 200);
  const regHtml = await getRegRes.text();
  const csrfMatch = regHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  assert.ok(csrfMatch, 'Should render CSRF token input on register page');
  let csrfToken = csrfMatch[1];
  cookie = updateCookies(cookie, getRegRes);

  // 1. Register
  const regParams = new URLSearchParams({
    username,
    password: 'password123',
    confirmPassword: 'password123',
    _csrf: csrfToken
  });

  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: regParams,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    redirect: 'manual'
  });

  assert.equal(regRes.status, 302);
  cookie = updateCookies(cookie, regRes);

  // 2. Access root -> redirects to character creation
  const rootRes = await fetch(`${baseUrl}/`, {
    headers: { Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(rootRes.status, 302);
  assert.equal(rootRes.headers.get('location'), '/character/create');

  // 2b. Fetch character creation page to extract CSRF token
  const createPageRes = await fetch(`${baseUrl}/character/create`, {
    headers: { Cookie: cookie }
  });
  assert.equal(createPageRes.status, 200);
  const createPageHtml = await createPageRes.text();
  const createCsrfMatch = createPageHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  if (createCsrfMatch) {
    csrfToken = createCsrfMatch[1];
  }

  // 3. Create Ranger character
  const charParams = new URLSearchParams({
    name: 'Skugga-Valdi',
    classType: 'RANGER',
    strength: '12',
    constitution: '10',
    dexterity: '16', // base 14 + 2
    intelligence: '10',
    wisdom: '13',   // base 12 + 1
    charisma: '10',  // sum 12+10+16+10+13+10 = 71
    _csrf: csrfToken
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
  cookie = updateCookies(cookie, createCharRes);

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

  const gameCsrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (gameCsrfMatch) {
    csrfToken = gameCsrfMatch[1];
  }

  // 5. Move North
  const moveParams = new URLSearchParams({
    direction: 'NORTH',
    _csrf: csrfToken
  });
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
