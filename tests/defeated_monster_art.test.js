const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/app');
const { createTestDb } = require('./test_helpers');
const { setDb, closeDb } = require('../src/db/connection');
const { registerUser } = require('../src/domain/auth/service');
const { createCharacter } = require('../src/domain/character/rules');
const { handleMonsterDefeat } = require('../src/domain/monsters/persistence');
const { getEncounterById } = require('../src/domain/encounters/engine');
const { getVictoryData } = require('../src/domain/combat/victory');

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
// 1. Database Schema & defeated_image_path Tests
// =============================================================================
test('1. Migration 010: monsters table has defeated_image_path column populated for all monsters', () => {
  const tableInfo = db.prepare('PRAGMA table_info(monsters)').all();
  const colNames = tableInfo.map(c => c.name);
  assert.ok(colNames.includes('defeated_image_path'), 'defeated_image_path column must exist');

  const rows = db.prepare('SELECT id, name, image_path, defeated_image_path FROM monsters').all();
  assert.ok(rows.length > 0, 'Monsters must exist');

  for (const r of rows) {
    assert.ok(r.defeated_image_path, `Monster ${r.name} (ID: ${r.id}) must have defeated_image_path`);
    assert.ok(r.defeated_image_path.includes('_defeated.png'), `Monster ${r.name} defeated_image_path must end with _defeated.png`);
  }
});

// =============================================================================
// 2. Encounter Engine Artwork Resolution Tests
// =============================================================================
test('2. Encounter engine resolves both normal imageUrl and defeatedImageUrl correctly', async () => {
  const user = await registerUser(db, 'v_test2_user', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'ResolutionHero',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 10 }
  });

  const goblin = db.prepare("SELECT * FROM monsters WHERE name = 'Goblin'").get();
  assert.ok(goblin);

  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'IN_COMBAT', 10, 1)
  `).run(hero.id, goblin.id);
  const encId = Number(encRes.lastInsertRowid);

  const resolved = getEncounterById(db, encId, 'FIGHTER');
  assert.ok(resolved);
  assert.equal(resolved.imageUrl, '/images/monsters/goblin.png', 'Living combat image must be the normal artwork');
  assert.equal(resolved.defeatedImageUrl, '/images/monsters/goblin_defeated.png', 'Defeated artwork must resolve to goblin_defeated.png');
  assert.equal(resolved.hasDefeatedImage, true);
});

test('3. Fallback behavior: if defeated artwork is absent, getVictoryData falls back gracefully to living imageUrl', async () => {
  const user = await registerUser(db, 'v_test3_user', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'FallbackHero',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 10 }
  });

  // Create mock monster without defeated artwork on disk
  const mockRes = db.prepare(`
    INSERT INTO monsters (
      name, symbol, color, base_hp, xp_reward, damage_dice, initiative_bonus,
      armor_class, attack_bonus, challenge_rating, solo_level, habitat,
      movement_type, descriptions, image_path, defeated_image_path
    ) VALUES (
      'Shadow Spectre Mock', 'S', '#999999', 20, 200, '1d6', 2,
      12, 3, 2, 2, '["DUNGEON"]',
      'GROUND', '{"9_dead":"Fades into mist."}',
      'images/monsters/non_existent_mock_spectre.png',
      'images/monsters/non_existent_mock_spectre_defeated.png'
    )
  `).run();
  const mockMonsterId = Number(mockRes.lastInsertRowid);

  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'VICTORY', 0, 2)
  `).run(hero.id, mockMonsterId);
  const encId = Number(encRes.lastInsertRowid);

  const victoryData = getVictoryData(db, hero.id, encId);
  assert.ok(victoryData);
  assert.equal(victoryData.defeatedImageUrl, null, 'defeatedImageUrl should be null when file is absent on disk');
  assert.equal(victoryData.isDefeatedArt, false);
});

// =============================================================================
// 3. Victory Screen Presentation Layer Tests
// =============================================================================
test('4. Victory screen presentation prioritizes defeatedImageUrl over living imageUrl for Goblin', async () => {
  const user = await registerUser(db, 'v_goblin_user', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'GorbagSlayer',
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 10 }
  });

  const goblin = db.prepare("SELECT * FROM monsters WHERE name = 'Goblin'").get();
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'IN_COMBAT', 0, 2)
  `).run(hero.id, goblin.id);
  const encId = Number(encRes.lastInsertRowid);

  const encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
  handleMonsterDefeat(db, hero, encRow, goblin, null, { rng: () => 0.5 });

  const victoryData = getVictoryData(db, hero.id, encId);
  assert.ok(victoryData);
  assert.equal(victoryData.imageUrl, '/images/monsters/goblin_defeated.png', 'Victory data imageUrl must be defeated variant');
  assert.equal(victoryData.defeatedImageUrl, '/images/monsters/goblin_defeated.png');
  assert.equal(victoryData.livingImageUrl, '/images/monsters/goblin.png');
  assert.equal(victoryData.isDefeatedArt, true);
});

test('5. HTTP /game/victory renders defeated monster artwork and Vanquished badge in UI', async () => {
  let cookie = '';
  const username = `Gbl_${Date.now().toString().slice(-8)}`;

  // 1. Acquire CSRF and Register
  const regPageRes = await fetch(`${baseUrl}/register`);
  const regPageHtml = await regPageRes.text();
  let csrfToken = regPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];
  cookie = updateCookies(cookie, regPageRes);

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

  // 2. Create Character with CSRF
  const createPageRes = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  const createPageHtml = await createPageRes.text();
  csrfToken = createPageHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createCharRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: 'GoblinCrusher',
      classType: 'FIGHTER',
      strength: '16', constitution: '13', dexterity: '12',
      intelligence: '10', wisdom: '10', charisma: '10',
      _csrf: csrfToken
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  cookie = updateCookies(cookie, createCharRes);

  const hero = db.prepare('SELECT * FROM characters WHERE user_id = (SELECT id FROM users WHERE username = ?)').get(username);
  assert.ok(hero);
  const goblin = db.prepare("SELECT * FROM monsters WHERE name = 'Goblin'").get();

  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round
    ) VALUES (?, 1, ?, 'IN_COMBAT', 0, 1)
  `).run(hero.id, goblin.id);
  const encId = Number(encRes.lastInsertRowid);

  const encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
  handleMonsterDefeat(db, hero, encRow, goblin, null, { rng: () => 0.5 });

  const vicRes = await fetch(`${baseUrl}/game/victory?encounterId=${encId}`, {
    headers: { Cookie: cookie }
  });
  assert.equal(vicRes.status, 200);
  const html = await vicRes.text();

  assert.ok(html.includes('/images/monsters/goblin_defeated.png'), 'HTML must include defeated artwork image source');
  assert.ok(html.includes('victory-defeated-badge'), 'HTML must render victory-defeated-badge');
  assert.ok(html.includes('Vanquished'), 'HTML must render Vanquished badge label');
});

test('6. Assets integrity: goblin_defeated.png exists in both project root and public images directory', () => {
  const rootPath = path.join(__dirname, '../images/monsters/goblin_defeated.png');
  const pubPath = path.join(__dirname, '../public/images/monsters/goblin_defeated.png');

  assert.ok(fs.existsSync(rootPath), 'Root images/monsters/goblin_defeated.png must exist');
  assert.ok(fs.existsSync(pubPath), 'Public images/monsters/goblin_defeated.png must exist');
  assert.ok(fs.statSync(rootPath).size > 1000, 'Root image must have non-zero size');
  assert.ok(fs.statSync(pubPath).size > 1000, 'Public image must have non-zero size');
});

test('7. Comprehensive catalog audit: 58 monsters have defeated artwork, 10 pending use safe living fallback', () => {
  const monsters = db.prepare("SELECT id, name, image_path, defeated_image_path FROM monsters WHERE name != 'Shadow Spectre Mock' ORDER BY name ASC").all();
  assert.equal(monsters.length, 68, 'There must be exactly 68 active monsters in the game');

  let defeatedCount = 0;
  let fallbackCount = 0;

  for (const m of monsters) {
    assert.ok(m.defeated_image_path, `Monster ${m.name} must have defeated_image_path column`);
    const rootPath = path.join(__dirname, '..', m.defeated_image_path);
    const pubPath = path.join(__dirname, '../public', m.defeated_image_path);

    if (fs.existsSync(rootPath)) {
      defeatedCount++;
      assert.ok(fs.existsSync(pubPath), `Public file must also exist for ${m.name}`);
      assert.ok(fs.statSync(rootPath).size > 1000, `Root file must be valid size for ${m.name}`);
      assert.ok(fs.statSync(pubPath).size > 1000, `Public file must be valid size for ${m.name}`);
    } else {
      fallbackCount++;
      // Verify that living image exists as safe fallback
      const livingRoot = path.join(__dirname, '..', m.image_path);
      assert.ok(fs.existsSync(livingRoot), `Living image fallback must exist on disk for ${m.name}`);
    }
  }

  assert.equal(defeatedCount, 58, 'Exactly 58 monsters must have high-fidelity defeated artwork on disk');
  assert.equal(fallbackCount, 10, 'Exactly 10 monsters are temporarily pending with living image fallback');
});

