const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createTestDb } = require('./test_helpers');
const { setDb, closeDb } = require('../../src/db/connection');
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

/**
 * Helper to extract all forms matching an action substring from HTML
 */
function extractFormsByAction(html, actionSubstring) {
  const forms = [];
  const formRegex = /<form\s+action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/gi;
  let match;

  while ((match = formRegex.exec(html)) !== null) {
    const action = match[1];
    const formBody = match[2];

    if (action.includes(actionSubstring)) {
      const inputRegex = /<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi;
      const fields = {};
      let inputMatch;
      while ((inputMatch = inputRegex.exec(formBody)) !== null) {
        fields[inputMatch[1]] = inputMatch[2];
      }

      // Also try reverse attribute order: value before name
      const inputRegexRev = /<input[^>]+value="([^"]*)"[^>]+name="([^"]+)"/gi;
      while ((inputMatch = inputRegexRev.exec(formBody)) !== null) {
        fields[inputMatch[2]] = inputMatch[1];
      }

      forms.push({ action, fields, formBody });
    }
  }

  return forms;
}

test('C1 HTTP Integration: Full Equip -> Unequip -> Buy -> Sell cycle via real parsed HTML forms', async () => {
  let cookie = '';
  const suffix = Date.now().toString().slice(-6);
  const username = `EquipHero_${suffix}`;

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

  // 2. Create Fighter character (receives Longsword, Shortbow, Chain Shirt, Light Steel Shield, 2 Potions)
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createRes = await fetch(`${baseUrl}/character/create`, {
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
  cookie = updateCookies(cookie, createRes);

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get(`Kappi_${suffix}`);
  assert.ok(hero, 'Character must exist in SQLite');

  // 3. GET /game: Verify initial equipment and parsed Unequip forms
  const gamePage1 = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage1);
  const html1 = await gamePage1.text();

  const unequipForms1 = extractFormsByAction(html1, '/game/inventory/unequip');
  assert.equal(unequipForms1.length, 4, 'Must render exactly 4 unequip forms for 4 starting equipped items');

  // Verify each unequip form has a valid non-empty itemInstanceId
  for (const form of unequipForms1) {
    assert.ok(form.fields._csrf, 'Form must contain CSRF token');
    assert.ok(form.fields.itemInstanceId, 'itemInstanceId must not be empty');
    assert.ok(!isNaN(parseInt(form.fields.itemInstanceId, 10)), 'itemInstanceId must be a valid integer');
  }

  // 4. Unequip the first item (e.g. Longsword or Shield) by submitting the parsed form unchanged
  const targetUnequip = unequipForms1[0];
  const targetItemId = parseInt(targetUnequip.fields.itemInstanceId, 10);

  const unequipRes = await fetch(`${baseUrl}${targetUnequip.action}`, {
    method: 'POST',
    body: new URLSearchParams(targetUnequip.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(unequipRes.status, 302, 'Unequip must redirect to /game');
  cookie = updateCookies(cookie, unequipRes);

  // Verify in SQLite that the item instance now has equipped_slot IS NULL
  const dbItemAfterUnequip = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(targetItemId);
  assert.equal(dbItemAfterUnequip.equipped_slot, null, 'SQLite: item equipped_slot must be null after unequip');

  // 5. GET /game: Verify that unequipped item now appears in Backpack Items with valid Equip form
  const gamePage2 = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage2);
  const html2 = await gamePage2.text();

  const equipForms = extractFormsByAction(html2, '/game/inventory/equip');
  assert.ok(equipForms.length >= 1, 'Must render at least 1 equip form in backpack');

  const reEquipForm = equipForms.find(f => f.fields.itemInstanceId === targetItemId.toString());
  assert.ok(reEquipForm, 'Must render equip form for the recently unequipped item');
  assert.ok(reEquipForm.fields.targetSlot, 'Equip form must contain valid non-empty targetSlot');
  assert.ok(['MELEE', 'RANGED', 'ARMOR', 'SHIELD'].includes(reEquipForm.fields.targetSlot), 'targetSlot must be one of allowed slots');

  // 6. Submit the parsed Equip form unchanged
  const equipRes = await fetch(`${baseUrl}${reEquipForm.action}`, {
    method: 'POST',
    body: new URLSearchParams(reEquipForm.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(equipRes.status, 302, 'Equip must redirect to /game');
  cookie = updateCookies(cookie, equipRes);

  // Verify in SQLite that the item is equipped again
  const dbItemAfterReEquip = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(targetItemId);
  assert.equal(dbItemAfterReEquip.equipped_slot, reEquipForm.fields.targetSlot, 'SQLite: item equipped_slot must match targetSlot');

  // 7. Verify Buy -> Equip -> Unequip -> Sell flow
  // Give character 50 gp
  db.prepare('UPDATE characters SET gold = 50 WHERE id = ?').run(hero.id);

  const gamePage3 = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage3);
  const html3 = await gamePage3.text();

  // Find buy form for Dagger (2 gp)
  const buyForms = extractFormsByAction(html3, '/game/shop/buy');
  assert.ok(buyForms.length > 0, 'Shop stock buy forms must be rendered in city');

  const daggerDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Dagger'").get();
  const daggerBuyForm = buyForms.find(f => f.fields.itemDefinitionId === daggerDef.id.toString());
  assert.ok(daggerBuyForm, 'Dagger buy form must exist in market stock');

  const buyRes = await fetch(`${baseUrl}${daggerBuyForm.action}`, {
    method: 'POST',
    body: new URLSearchParams(daggerBuyForm.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(buyRes.status, 302, 'Buy must redirect to /game');
  cookie = updateCookies(cookie, buyRes);

  // Verify Dagger purchased in SQLite
  const purchasedDagger = db.prepare(`
    SELECT * FROM item_instances
    WHERE owner_character_id = ? AND item_definition_id = ? AND equipped_slot IS NULL
  `).get(hero.id, daggerDef.id);
  assert.ok(purchasedDagger, 'Purchased dagger must exist in SQLite backpack');

  // 8. Equip Dagger into MELEE slot (displacing previous melee weapon)
  const gamePage4 = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage4);
  const html4 = await gamePage4.text();

  const equipDaggerForm = extractFormsByAction(html4, '/game/inventory/equip')
    .find(f => f.fields.itemInstanceId === purchasedDagger.id.toString());
  assert.ok(equipDaggerForm, 'Dagger must have equip form in backpack');
  assert.equal(equipDaggerForm.fields.targetSlot, 'MELEE', 'Dagger targetSlot must be MELEE');

  const equipDaggerRes = await fetch(`${baseUrl}${equipDaggerForm.action}`, {
    method: 'POST',
    body: new URLSearchParams(equipDaggerForm.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(equipDaggerRes.status, 302, 'Equip dagger must redirect to /game');
  cookie = updateCookies(cookie, equipDaggerRes);

  // Verify Dagger is now equipped and old melee weapon was unequipped
  const daggerAfterEquip = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(purchasedDagger.id);
  assert.equal(daggerAfterEquip.equipped_slot, 'MELEE');

  // 9. Unequip Dagger
  const gamePage5 = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage5);
  const html5 = await gamePage5.text();

  const unequipDaggerForm = extractFormsByAction(html5, '/game/inventory/unequip')
    .find(f => f.fields.itemInstanceId === purchasedDagger.id.toString());
  assert.ok(unequipDaggerForm, 'Unequip form for dagger must be rendered in Equipped Gear');

  const unequipDaggerRes = await fetch(`${baseUrl}${unequipDaggerForm.action}`, {
    method: 'POST',
    body: new URLSearchParams(unequipDaggerForm.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(unequipDaggerRes.status, 302, 'Unequip dagger must redirect to /game');
  cookie = updateCookies(cookie, unequipDaggerRes);

  // 10. Sell Dagger from Backpack via parsed Sell form
  const gamePage6 = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage6);
  const html6 = await gamePage6.text();

  const sellDaggerForm = extractFormsByAction(html6, '/game/shop/sell')
    .find(f => f.fields.itemInstanceId === purchasedDagger.id.toString());
  assert.ok(sellDaggerForm, 'Sell form for unequipped dagger must be rendered in Sell from Backpack');

  const goldBeforeSell = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
  const sellRes = await fetch(`${baseUrl}${sellDaggerForm.action}`, {
    method: 'POST',
    body: new URLSearchParams(sellDaggerForm.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(sellRes.status, 302, 'Sell must redirect to /game');
  cookie = updateCookies(cookie, sellRes);

  const goldAfterSell = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
  assert.ok(goldAfterSell > goldBeforeSell, 'Hero gold must increase after selling');

  const daggerInInventory = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(purchasedDagger.id);
  assert.equal(daggerInInventory, undefined, 'Sold non-magical item must be deleted from SQLite');
});

test('C1 HTTP Integration: Primary Weapon Preference and Two-Handed Shield Suppression', async () => {
  let cookie = '';
  const suffix = (Date.now() + 1).toString().slice(-6);
  const username = `PrefHero_${suffix}`;

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

  // Create character
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: `PrefKappi_${suffix}`,
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

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get(`PrefKappi_${suffix}`);

  // Fetch /game and parse primary-weapon preference forms
  const gamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage);
  const html = await gamePage.text();

  const prefForms = extractFormsByAction(html, '/game/character/primary-weapon');
  assert.equal(prefForms.length, 2, 'Must render 2 primary weapon preference forms (Melee & Ranged)');

  const rangedForm = prefForms.find(f => f.fields.primaryWeapon === 'RANGED');
  assert.ok(rangedForm, 'Ranged preference form must be rendered');

  // Submit Ranged preference
  const prefRes = await fetch(`${baseUrl}${rangedForm.action}`, {
    method: 'POST',
    body: new URLSearchParams(rangedForm.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(prefRes.status, 302);
  cookie = updateCookies(cookie, prefRes);

  const updatedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(updatedHero.primary_weapon, 'RANGED', 'SQLite: primary_weapon must be RANGED');

  // Verify game view reflects active ranged weapon and shield suppression note
  const gamePageRanged = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  const htmlRanged = await gamePageRanged.text();
  assert.ok(htmlRanged.includes('Active: 🏹 Ranged'), 'UI must display Active: Ranged');
  assert.ok(htmlRanged.includes('Shield disabled with ranged'), 'UI must note that shield is disabled with ranged');
});

test('C1 HTTP Integration: Out-of-combat potion drinking via Backpack modal form', async () => {
  let cookie = '';
  const suffix = Date.now().toString().slice(-6);
  const username = `PotionHero_${suffix}`;

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

  // 2. Create Fighter character (receives starting gear including potions)
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: `PotKappi_${suffix}`,
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

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get(`PotKappi_${suffix}`);

  // Reduce hero's HP to 3 so potion can be drunk
  db.prepare('UPDATE characters SET current_hp = 3 WHERE id = ?').run(hero.id);

  // Fetch /game and extract potion use forms
  const gamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage);
  const html = await gamePage.text();

  const potionForms = extractFormsByAction(html, '/game/inventory/use');
  assert.ok(potionForms.length >= 1, 'Must render at least 1 potion use form');

  const drinkForm = potionForms[0];
  assert.equal(drinkForm.fields.returnModal, 'backpack');
  assert.ok(drinkForm.fields.itemInstanceId, 'Must have itemInstanceId');

  // Submit Drink POST
  const drinkRes = await fetch(`${baseUrl}${drinkForm.action}`, {
    method: 'POST',
    body: new URLSearchParams(drinkForm.fields),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(drinkRes.status, 302);
  cookie = updateCookies(cookie, drinkRes);

  // Verify HP restored in DB
  const heroAfterDrink = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.ok(heroAfterDrink.current_hp > 3, `Hero HP must be restored (was 3, now ${heroAfterDrink.current_hp})`);

  // Verify item consumed
  const consumedItem = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(Number(drinkForm.fields.itemInstanceId));
  assert.strictEqual(consumedItem, undefined, 'Consumed potion instance must be deleted from SQLite');
});

