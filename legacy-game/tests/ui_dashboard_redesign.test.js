const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createTestDb } = require('./test_helpers');
const { setDb, closeDb } = require('../../src/db/connection');
const { startCombat } = require('../../src/domain/combat/engine');
const app = require('../app');

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

function extractFormsByAction(html, actionSubstring) {
  const forms = [];
  const formRegex = /<form\s+[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRegex.exec(html)) !== null) {
    const action = match[1];
    if (action.includes(actionSubstring)) {
      const formBody = match[2];
      const fields = {};
      const inputRegex = /<input\s+[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi;
      let inputMatch;
      while ((inputMatch = inputRegex.exec(formBody)) !== null) {
        fields[inputMatch[1]] = inputMatch[2];
      }
      forms.push({ action, fields, html: match[0] });
    }
  }
  return forms;
}

test('UI Dashboard: Desktop 3-column layout and core elements in City state', async () => {
  let cookie = '';
  const suffix = Date.now().toString().slice(-6);
  const username = `DashHero_${suffix}`;

  // 1. Register & login
  const regPage = await fetch(`${baseUrl}/register`);
  cookie = updateCookies(cookie, regPage);
  const regHtml = await regPage.text();
  const csrfMatch = regHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  assert.ok(csrfMatch, 'Must find CSRF token');
  const csrf = csrfMatch[1];

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

  // 2. Create Character (and verify Dark Fantasy class descriptions & pillars)
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  assert.ok(createHtml.includes('Iron-Clad Vanguard'), 'Fighter dark fantasy archetype title must be rendered');
  assert.ok(createHtml.includes('Shadow-Stalker of the Wilds'), 'Ranger dark fantasy archetype title must be rendered');
  assert.ok(createHtml.includes('Vessel of the Dying Light'), 'Cleric dark fantasy archetype title must be rendered');
  assert.ok(createHtml.includes('class-pillars-list'), 'Dark fantasy class strength pillars must be rendered');
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: `Kappi_${suffix}`,
      classType: 'FIGHTER',
      strength: '16',
      dexterity: '14',
      constitution: '12',
      intelligence: '11',
      wisdom: '10',
      charisma: '9',
      _csrf: createCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });

  // 3. GET /game
  const gamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage);
  const html = await gamePage.text();

  // Validate 3-column dashboard container
  assert.ok(html.includes('game-dashboard'), 'Dashboard grid must be present');
  assert.ok(html.includes('col-left'), 'Left column (World & Navigation) must exist');
  assert.ok(html.includes('col-center'), 'Center column (Main Gameplay) must exist');
  assert.ok(html.includes('col-right'), 'Right column (Hero Panel) must exist');

  // Validate Left Column: 5x5 minimap, legend, coords, compass
  assert.ok(html.includes('Minimap (5×5)'), 'Minimap title must be present');
  assert.ok(html.includes('minimap-grid'), 'Minimap grid must exist');
  assert.ok(html.includes('minimap-legend'), 'Minimap legend must exist');
  assert.ok(html.includes('Navigation (Movement)'), 'Navigation header must exist');
  assert.ok(html.includes('compass-grid'), 'Compass grid must exist');
  assert.ok(html.includes('value="NORTH"'), 'Compass North must be present');
  assert.ok(html.includes('value="SOUTH"'), 'Compass South must be present');
  assert.ok(html.includes('value="EAST"'), 'Compass East must be present');
  assert.ok(html.includes('value="WEST"'), 'Compass West must be present');

  // Validate Center Column in CITY:
  assert.match(html, /Oakhaven/, 'City name must be rendered');
  assert.ok(html.includes('Safe Haven (Peaceful)'), 'Safe Haven badge must be rendered');
  assert.ok(html.includes('Rest at Sanctuary'), 'Rest at Sanctuary button must be rendered');
  assert.ok(html.includes('/game/rest'), 'Rest form must be present');
  assert.ok(html.includes('Town Market'), 'Market trigger button must be present in city');

  // Validate Right Column: Hero vitals, stats, modal triggers
  assert.ok(html.includes(`Kappi_${suffix}`), 'Hero name must be rendered in right column');
  assert.ok(html.includes('FIGHTER • Level 1'), 'Hero class and level must be rendered');
  assert.ok(html.includes('Vitality (HP)'), 'Vitality HP header must be rendered');
  assert.ok(html.includes('vital-gauge-bar'), 'HP gauge bar must be rendered');
  assert.ok(html.includes('Armor Class (AC)'), 'Armor Class must be rendered');
  assert.ok(html.includes('Healing Potions'), 'Healing Potions must be rendered');
  assert.ok(html.includes('btn-open-character'), 'Character modal button must be present');
  assert.ok(html.includes('btn-open-backpack'), 'Backpack modal button must be present');
  assert.ok(html.includes('btn-open-market'), 'Market modal button must be present');
  assert.ok(html.includes('btn-open-journal'), 'Journal modal button must be present');

  // Validate Modal System Containers & Market Category Tabs
  assert.ok(html.includes('game-modal-backdrop'), 'Modal backdrop must be present');
  assert.ok(html.includes('modal-character'), 'Character modal dialog must exist');
  assert.ok(html.includes('modal-backpack'), 'Backpack modal dialog must exist');
  assert.ok(html.includes('modal-market'), 'Market modal dialog must exist');
  assert.ok(html.includes('modal-journal'), 'Journal modal dialog must exist');
  assert.ok(html.includes('data-market-tab="melee"'), 'Market Melee Weapons tab must exist');
  assert.ok(html.includes('data-market-tab="ranged"'), 'Market Ranged Weapons tab must exist');
  assert.ok(html.includes('data-market-tab="armor"'), 'Market Armor tab must exist');
  assert.ok(html.includes('data-market-tab="shield"'), 'Market Shields tab must exist');
  assert.ok(html.includes('data-market-tab="items"'), 'Market Items & Potions tab must exist');
  assert.ok(html.includes('data-market-tab="resale"'), 'Market Magical Market tab must exist');
  assert.ok(html.includes('data-market-tab="sell"'), 'Market Sell Goods tab must exist');
});

test('UI Dashboard: Modal forms, returnModal parameter, and redirect preservation', async () => {
  let cookie = '';
  const suffix = (Date.now() + 2).toString().slice(-6);
  const username = `ModHero_${suffix}`;

  // Register & login
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

  // Create character (Fighter: 16+14+12+10+10+9 = 71)
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createCharRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: `Kappi_${suffix}`,
      classType: 'FIGHTER',
      strength: '16',
      dexterity: '14',
      constitution: '12',
      intelligence: '11',
      wisdom: '10',
      charisma: '9',
      _csrf: createCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(createCharRes.status, 302, 'Character creation must redirect to /game');
  cookie = updateCookies(cookie, createCharRes);

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get(`Kappi_${suffix}`);

  // Fetch /game and extract unequip form from Backpack modal
  const gamePage1 = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage1);
  const html1 = await gamePage1.text();

  const unequipForms = extractFormsByAction(html1, '/game/inventory/unequip');
  assert.ok(unequipForms.length > 0, 'Backpack modal must contain unequip forms');
  const targetUnequip = unequipForms[0];
  assert.equal(targetUnequip.fields.returnModal, 'backpack', 'Unequip form must pass returnModal=backpack');

  // Submit unequip form and verify redirect includes modal=backpack
  const unequipRes = await fetch(`${baseUrl}${targetUnequip.action}`, {
    method: 'POST',
    body: new URLSearchParams(targetUnequip.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(unequipRes.status, 302);
  const unequipLocation = unequipRes.headers.get('location') || '';
  assert.ok(unequipLocation.includes('modal=backpack'), `Redirect must return user to backpack modal: ${unequipLocation}`);
  cookie = updateCookies(cookie, unequipRes);

  // Verify that GET /game?modal=backpack receives activeModal in template
  const gamePageModal = await fetch(`${baseUrl}${unequipLocation}`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePageModal);
  const htmlModal = await gamePageModal.text();
  assert.ok(htmlModal.includes('"backpack"'), 'Template script must receive activeModal = backpack');

  // Test Primary Weapon Preference form in Character modal
  const prefForms = extractFormsByAction(htmlModal, '/game/character/primary-weapon');
  assert.ok(prefForms.length >= 2, 'Character modal must contain Melee and Ranged preference forms');
  const rangedForm = prefForms.find(f => f.fields.primaryWeapon === 'RANGED');
  assert.ok(rangedForm, 'Must have RANGED preference form');
  assert.equal(rangedForm.fields.returnModal, 'character', 'Preference form must pass returnModal=character');

  const prefRes = await fetch(`${baseUrl}${rangedForm.action}`, {
    method: 'POST',
    body: new URLSearchParams(rangedForm.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(prefRes.status, 302);
  const prefLocation = prefRes.headers.get('location') || '';
  assert.ok(prefLocation.includes('modal=character'), `Redirect must return user to character modal: ${prefLocation}`);

  // Test Market Buy form in Market modal
  db.prepare('UPDATE characters SET gold = 100 WHERE id = ?').run(hero.id);
  const marketPage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, marketPage);
  const marketHtml = await marketPage.text();

  const buyForms = extractFormsByAction(marketHtml, '/game/shop/buy');
  assert.ok(buyForms.length > 0, 'Market modal must contain buy forms');
  const targetBuy = buyForms[0];
  assert.equal(targetBuy.fields.returnModal, 'market', 'Buy form must pass returnModal=market');

  const buyRes = await fetch(`${baseUrl}${targetBuy.action}`, {
    method: 'POST',
    body: new URLSearchParams(targetBuy.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(buyRes.status, 302);
  const buyLocation = buyRes.headers.get('location') || '';
  assert.ok(buyLocation.includes('modal=market'), `Redirect must return user to market modal: ${buyLocation}`);
});

test('UI Dashboard: Combat interface renders 3 actions and battle record without scrolling', async () => {
  let cookie = '';
  const suffix = (Date.now() + 3).toString().slice(-6);
  const username = `CombatHero_${suffix}`;

  // Register & login
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

  // Create Fighter (16+14+12+10+10+9 = 71)
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
      intelligence: '11',
      wisdom: '10',
      charisma: '9',
      _csrf: createCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get(`Kappi_${suffix}`);
  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(wildTile.id, hero.id);

  // Create an encounter and start combat
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, tile_id, status, current_monster_hp,
      monster_max_hp, combat_round, created_at
    ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, CURRENT_TIMESTAMP)
  `).run(hero.id, wolf.id, wildTile.id, wolf.base_hp, wolf.base_hp);
  const encId = Number(encRes.lastInsertRowid);
  startCombat(db, hero.id, encId);

  const gamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage);
  const html = await gamePage.text();

  // Validate combat display in center column
  assert.ok(html.includes('Revealed Threat: <strong>Wolf</strong>'), 'Monster name must be revealed');
  assert.ok(html.includes('monster-art-frame'), 'Monster art frame must exist');
  assert.ok(html.includes('Battle Record (Round 1)'), 'Battle record header must be visible');
  assert.ok(html.includes('combat-actions-bar'), 'Fixed combat action bar must be present');
  assert.ok(html.includes('⚔️ Attack'), 'Attack button must be present');
  assert.ok(html.includes('🧪 Drink Potion'), 'Drink Potion button must be present');
  assert.ok(html.includes('🏃 Flee'), 'Flee button must be present');

  // Movement must be locked during active combat
  assert.ok(html.includes('Combat active: Fight or flee'), 'Lock banner must notify player');
  const compassDisabledCount = (html.match(/disabled\s+title="[^"]*"/g) || []).length;
  assert.ok(compassDisabledCount >= 4, 'All 4 movement directions must be locked during combat');
});

test('UI Dashboard: Combat log displays only current round events in active combat, and Victory/Fallen screens include full battle record toggle', async () => {
  let cookie = '';
  const suffix = (Date.now() + 5).toString().slice(-6);
  const username = `RoundHero_${suffix}`;

  // Register & login
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

  // Create Fighter
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: `Hrolfur_${suffix}`,
      classType: 'FIGHTER',
      strength: '16',
      dexterity: '14',
      constitution: '12',
      intelligence: '11',
      wisdom: '10',
      charisma: '9',
      _csrf: createCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get(`Hrolfur_${suffix}`);
  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(wildTile.id, hero.id);

  // Create an encounter in Round 3 with events from Round 1 and Round 2
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, tile_id, status, current_monster_hp,
      monster_max_hp, combat_round, initiative_winner, created_at
    ) VALUES (?, ?, ?, 'IN_COMBAT', 5, ?, 3, 'HERO', CURRENT_TIMESTAMP)
  `).run(hero.id, wolf.id, wildTile.id, wolf.base_hp);
  const encId = Number(encRes.lastInsertRowid);

  db.prepare(`
    INSERT INTO combat_events (encounter_id, round_number, event_type, public_text)
    VALUES (?, 1, 'HERO_ATTACK', 'RoundOneUniqueStrikeText'),
           (?, 1, 'MONSTER_ATTACK', 'RoundOneUniqueBiteText'),
           (?, 2, 'HERO_ATTACK', 'RoundTwoUniqueSlashText'),
           (?, 2, 'MONSTER_ATTACK', 'RoundTwoUniqueClawText')
  `).run(encId, encId, encId, encId);

  // 1. Verify active combat screen ONLY renders the latest round (Round 2) and NOT Round 1
  const gamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage);
  const combatHtml = await gamePage.text();

  // Extract active combat log scroll block
  const logScrollMatch = combatHtml.match(/<div class="combat-log-scroll">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
  assert.ok(logScrollMatch, 'Combat log scroll container must exist');
  const activeLogContent = logScrollMatch[1];

  assert.ok(!activeLogContent.includes('RoundOneUniqueStrikeText'), 'Round 1 hero event must NOT appear in active combat log during later rounds');
  assert.ok(!activeLogContent.includes('RoundOneUniqueBiteText'), 'Round 1 monster event must NOT appear in active combat log during later rounds');
  assert.ok(activeLogContent.includes('RoundTwoUniqueSlashText'), 'Latest round hero event MUST appear in active combat log');
  assert.ok(activeLogContent.includes('RoundTwoUniqueClawText'), 'Latest round monster event MUST appear in active combat log');

  // 2. Conclude encounter in VICTORY and verify /game/victory has single-button toggle with ALL rounds
  db.prepare(`UPDATE encounters SET status = 'VICTORY', current_monster_hp = 0 WHERE id = ?`).run(encId);
  db.prepare(`
    INSERT INTO combat_events (encounter_id, round_number, event_type, public_text, details)
    VALUES (?, 3, 'VICTORY', 'FinalVictoryStrikeText', '{"xp_awarded":100,"gold_looted":10}')
  `).run(encId);

  const victoryPage = await fetch(`${baseUrl}/game/victory?encounterId=${encId}`, { headers: { Cookie: cookie } });
  assert.equal(victoryPage.status, 200);
  const victoryHtml = await victoryPage.text();

  assert.ok(victoryHtml.includes('id="btn-toggle-battle-log"'), 'Victory screen must render single-click battle log toggle button');
  assert.ok(victoryHtml.includes('Read Full Battle Record'), 'Victory toggle button must have English label');
  assert.ok(victoryHtml.includes('RoundOneUniqueStrikeText'), 'Victory full battle record must include Round 1 events');
  assert.ok(victoryHtml.includes('RoundTwoUniqueSlashText'), 'Victory full battle record must include Round 2 events');
  assert.ok(victoryHtml.includes('FinalVictoryStrikeText'), 'Victory full battle record must include final Victory event');

  // 3. Simulate hero death and verify /game/fallen has single-button toggle with ALL rounds
  db.prepare(`UPDATE encounters SET status = 'DEFEAT' WHERE id = ?`).run(encId);
  db.prepare(`
    INSERT INTO combat_events (encounter_id, round_number, event_type, public_text)
    VALUES (?, 3, 'DEATH', 'FinalFallenHeroText')
  `).run(encId);
  db.prepare(`UPDATE characters SET is_alive = 0, current_hp = 0, died_at = CURRENT_TIMESTAMP WHERE id = ?`).run(hero.id);

  const fallenPage = await fetch(`${baseUrl}/game/fallen`, { headers: { Cookie: cookie } });
  assert.equal(fallenPage.status, 200);
  const fallenHtml = await fallenPage.text();

  assert.ok(fallenHtml.includes('id="btn-toggle-battle-log"'), 'Fallen screen must render single-click battle log toggle button');
  assert.ok(fallenHtml.includes('Read Final Battle Record'), 'Fallen toggle button must have English label');
  assert.ok(fallenHtml.includes('RoundOneUniqueStrikeText'), 'Fallen full battle record must include Round 1 events');
  assert.ok(fallenHtml.includes('RoundTwoUniqueSlashText'), 'Fallen full battle record must include Round 2 events');
  assert.ok(fallenHtml.includes('FinalFallenHeroText'), 'Fallen full battle record must include final Death event');
});

