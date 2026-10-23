const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const config = require('../src/config');
const app = require('../src/app');
const { createTestDb } = require('./test_helpers');
const { getDb, setDb, closeDb } = require('../src/db/connection');
const { registerUser } = require('../src/domain/auth/service');
const {
  createCharacter,
  performCityRest,
  equipItem,
  getCharacterEquipment,
  getActiveWeapon,
  getCharacterPotions,
  getCharacterPotionCount
} = require('../src/domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus,
  resolvePotionHealing
} = require('../src/domain/combat/rules');
const { executeCombatRound, getCombatState } = require('../src/domain/combat/engine');

let server;
let baseUrl;

test.before(() => {
  const db = createTestDb();
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

// =============================================================================
// 1. Starting Gold Verification
// =============================================================================
test('1. Starting Gold: New characters receive exactly 10 gp by default', async () => {
  const db = getDb();
  assert.equal(config.startingGold, 10, 'Config startingGold must be strictly 10 gp');

  const suffix = Date.now().toString().slice(-6);
  const user = await registerUser(db, `GoldTester_${suffix}`, 'secret123');

  const hero = createCharacter(db, {
    userId: user.id,
    name: `Valiant_${suffix}`,
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 11, wisdom: 10, charisma: 9 }
  });

  assert.equal(hero.gold, 10, 'Hero starting gold must be exactly 10 gp');

  // Verify existing character gold is preserved
  db.prepare('UPDATE characters SET gold = 42 WHERE id = ?').run(hero.id);
  const fetched = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(fetched.gold, 42, 'Existing characters must not have their gold overwritten');
});

// =============================================================================
// 2. City Healing Combat Lock
// =============================================================================
test('2. City Healing: Allowed when peaceful, strictly blocked when IN_COMBAT', async () => {
  const db = getDb();
  const suffix = Date.now().toString().slice(-6);
  const user = await registerUser(db, `RestTester_${suffix}`, 'secret123');

  const cleric = createCharacter(db, {
    userId: user.id,
    name: `Healer_${suffix}`,
    classType: 'CLERIC',
    stats: { strength: 10, dexterity: 10, constitution: 14, intelligence: 11, wisdom: 16, charisma: 11 }
  });

  // Damage hero and use cleric healing
  db.prepare('UPDATE characters SET current_hp = 3, cleric_heal_uses = 1 WHERE id = ?').run(cleric.id);

  // 2a. Resting outside combat must succeed
  const rested = performCityRest(db, cleric.id);
  assert.equal(rested.currentHp, cleric.max_hp, 'Resting should restore HP to maximum');
  assert.equal(rested.clericHealUses, 0, 'Resting should reset cleric self-healing charges');

  // 2b. Introduce active combat encounter
  db.prepare('UPDATE characters SET current_hp = 3 WHERE id = ?').run(cleric.id);
  const monster = db.prepare('SELECT * FROM monsters LIMIT 1').get();
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, tile_id, status, is_ambush, current_monster_hp, monster_max_hp
    ) VALUES (?, ?, ?, 'IN_COMBAT', 0, 10, 10)
  `).run(cleric.id, monster.id, cleric.tile_id);

  // Attempting to rest while IN_COMBAT must throw an error
  assert.throws(
    () => {
      performCityRest(db, cleric.id);
    },
    /Cannot rest or receive city healing while engaged in combat/i,
    'Must prevent city rest while combat is active'
  );

  const heroAfterBlockedRest = db.prepare('SELECT * FROM characters WHERE id = ?').get(cleric.id);
  assert.equal(heroAfterBlockedRest.current_hp, 3, 'Hero HP must remain unchanged when rest is rejected');

  // Cleanup encounter
  db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encRes.lastInsertRowid);
});

// =============================================================================
// 3. CSRF & Session Security
// =============================================================================
test('3. CSRF Protection: Rejects state-changing requests missing or holding invalid CSRF token', async () => {
  let cookie = '';

  // Fetch register page to start session
  const getRes = await fetch(`${baseUrl}/register`);
  assert.equal(getRes.status, 200);
  cookie = updateCookies(cookie, getRes);

  const html = await getRes.text();
  const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
  assert.ok(csrfMatch, 'Must render CSRF token in page');
  const validToken = csrfMatch[1];

  const uniqueSuffix = Date.now().toString().slice(-7);

  // 3a. POST /register with NO token -> 403 Forbidden
  const noTokenRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({
      username: `CsrfUser1_${uniqueSuffix}`,
      password: 'password123',
      confirmPassword: 'password123'
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      Accept: 'application/json'
    }
  });
  assert.equal(noTokenRes.status, 403, 'Should reject missing CSRF token with 403');

  // 3b. POST /register with INVALID token -> 403 Forbidden
  const badTokenRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({
      username: `CsrfUser2_${uniqueSuffix}`,
      password: 'password123',
      confirmPassword: 'password123',
      _csrf: 'forged_csrf_token_value_0123456789abcdef'
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      Accept: 'application/json'
    }
  });
  assert.equal(badTokenRes.status, 403, 'Should reject invalid CSRF token with 403');

  // 3c. POST /register with VALID token -> 302 Redirect (Authorized)
  const validRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    body: new URLSearchParams({
      username: `CsrfUser3_${uniqueSuffix}`,
      password: 'password123',
      confirmPassword: 'password123',
      _csrf: validToken
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    redirect: 'manual'
  });
  assert.equal(validRes.status, 302, 'Should accept valid CSRF token');
});

// =============================================================================
// 4. Two-Handed Weapons & Shields: Rule Enforcement in Calculations & Combat
// =============================================================================
test('4. Two-Handed Weapons & Shields: Suppresses shield AC bonus for two-handed melee in both calculations and combat', async () => {
  const db = getDb();
  const suffix = Date.now().toString().slice(-6);
  const user = await registerUser(db, `GSUser_${suffix}`, 'secret123');

  const hero = createCharacter(db, {
    userId: user.id,
    name: `Blade_${suffix}`,
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 14, constitution: 12, intelligence: 11, wisdom: 10, charisma: 9 }
  });

  // Base AC: 10 + 2 (DEX) + 4 (Chain Shirt) = 16
  const greatswordDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Greatsword'").get();
  const longswordDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Longsword'").get();
  const lightShieldDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Light Steel Shield'").get();
  const magicalShieldDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Heavy Steel Shield +1'").get();

  assert.equal(greatswordDef.is_two_handed, 1, 'Greatsword must be two-handed');
  assert.equal(longswordDef.is_two_handed, 0, 'Longsword must be one-handed');

  // Equip Greatsword and Light Steel Shield
  const gsInst = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, 'MELEE')
  `).run(greatswordDef.id, hero.id);

  const shieldInst = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, 'SHIELD')
  `).run(lightShieldDef.id, hero.id);

  let equipment = getCharacterEquipment(db, hero.id);
  let active = getActiveWeapon(hero, equipment);
  assert.equal(active.activeWeapon.name, 'Greatsword');
  assert.equal(active.activeWeapon.is_two_handed, 1);

  // 4a. AC with Greatsword + Light Steel Shield must be 16 (shield bonus 0)
  const greatswordAC = calculateHeroAC(hero, equipment.armor, equipment.shield, active.isRangedActive, null, active.activeWeapon);
  assert.equal(greatswordAC, 16, 'Greatsword must suppress shield AC bonus (10 + 2 DEX + 4 Armor + 0 Shield = 16)');

  // Shield remains equipped in database
  const shieldRow = db.prepare('SELECT equipped_slot FROM item_instances WHERE id = ?').get(shieldInst.lastInsertRowid);
  assert.equal(shieldRow.equipped_slot, 'SHIELD', 'Shield must remain equipped even when AC bonus is suppressed');

  // 4b. AC with Greatsword + Magical Shield (Heavy Steel Shield +1: shield 2 + enh 1 = 3)
  const magShieldInst = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, 'SHIELD')
  `).run(magicalShieldDef.id, hero.id);
  db.prepare('DELETE FROM item_instances WHERE id = ?').run(shieldInst.lastInsertRowid);

  equipment = getCharacterEquipment(db, hero.id);
  const greatswordMagAC = calculateHeroAC(hero, equipment.armor, equipment.shield, false, null, active.activeWeapon);
  assert.equal(greatswordMagAC, 16, 'Greatsword must suppress both normal and magical shield bonuses');

  // 4c. Switch back to one-handed weapon (Longsword) -> full shield bonus restored
  db.prepare('UPDATE item_instances SET equipped_slot = NULL WHERE id = ?').run(gsInst.lastInsertRowid);
  const lsInst = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, 'MELEE')
  `).run(longswordDef.id, hero.id);

  equipment = getCharacterEquipment(db, hero.id);
  active = getActiveWeapon(hero, equipment);
  assert.equal(active.activeWeapon.name, 'Longsword');
  assert.equal(active.activeWeapon.is_two_handed, 0);

  const longswordMagAC = calculateHeroAC(hero, equipment.armor, equipment.shield, false, null, active.activeWeapon);
  assert.equal(longswordMagAC, 19, 'Longsword restores magical shield bonus (16 + 3 total shield bonus = 19)');

  // 4d. Ranged weapon active -> shield bonus is 0
  const rangedAC = calculateHeroAC(hero, equipment.armor, equipment.shield, true, null, equipment.rangedWeapon);
  assert.equal(rangedAC, 16, 'Ranged weapon active must continue to give 0 shield bonus');

  // 4e. Test AC in combat: Hero attacks with Greatsword vs Monster
  const monster = db.prepare(`
    SELECT * FROM monsters WHERE armor_class = 12 LIMIT 1
  `).get() || db.prepare('SELECT * FROM monsters LIMIT 1').get();

  // Create active combat encounter
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, tile_id, status, is_ambush, current_monster_hp, monster_max_hp, combat_round, initiative_winner
    ) VALUES (?, ?, ?, 'IN_COMBAT', 0, 30, 30, 1, 'HERO')
  `).run(hero.id, monster.id, hero.tile_id);
  const encId = encRes.lastInsertRowid;

  // Equip Greatsword again with standard Light Steel Shield
  db.prepare('UPDATE item_instances SET equipped_slot = NULL WHERE id = ?').run(lsInst.lastInsertRowid);
  db.prepare('UPDATE item_instances SET equipped_slot = ? WHERE id = ?').run('MELEE', gsInst.lastInsertRowid);
  db.prepare('DELETE FROM item_instances WHERE id = ?').run(magShieldInst.lastInsertRowid);
  const stdShield = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, 'SHIELD')
  `).run(lightShieldDef.id, hero.id);

  // In combat with Greatsword: state.heroAC must be 16
  const stateDuringCombat = getCombatState(db, hero.id, encId);
  assert.equal(stateDuringCombat.heroAC, 16, 'Combat state heroAC must be 16 when wielding Greatsword');

  // Deterministic RNG:
  // Hero rolls 10 on d20 + AB 4 = 14 vs monster AC 12 -> hit, damage roll 6
  // Monster has monster_ab (say +2). We choose roll index such that monster roll + monster_ab = 16:
  // With monster_ab = M, roll = 16 - M.
  // If hero AC = 16 (Greatsword): 16 >= 16 -> HIT!
  const monsterAB = monster.attack_bonus || 0;
  const targetRoll = 16 - monsterAB;
  const rngRollFraction = (targetRoll - 0.5) / 20; // produces targetRoll on rollD20

  const heroHpBefore = db.prepare('SELECT current_hp FROM characters WHERE id = ?').get(hero.id).current_hp;

  // Execute round with Greatsword: Hero misses, Monster rolls exactly 16 total -> HITS hero AC 16
  let rollIdx = 0;
  const greatswordRng = () => {
    // 1: hero d20 (0.05 -> miss), 2: monster d20 (rngRollFraction), 3: monster damage (0.5 -> 3)
    const seq = [0.05, rngRollFraction, 0.5];
    return seq[rollIdx++] || 0.5;
  };

  const gsRoundState = executeCombatRound(db, hero.id, encId, 'ATTACK', { rng: greatswordRng });
  assert.equal(gsRoundState.heroAC, 16);
  const monsterEventGS = gsRoundState.events.find(e => e.event_type === 'MONSTER_ATTACK');
  assert.ok(monsterEventGS, 'Monster attack event must be logged');
  const gsDetails = JSON.parse(monsterEventGS.details || '{}');
  assert.equal(gsDetails.isHit, true, 'Monster total attack 16 must HIT Greatsword AC 16');

  // Now switch back to Longsword (one-handed): Hero AC becomes 17
  db.prepare('UPDATE item_instances SET equipped_slot = NULL WHERE id = ?').run(gsInst.lastInsertRowid);
  db.prepare('UPDATE item_instances SET equipped_slot = ? WHERE id = ?').run('MELEE', lsInst.lastInsertRowid);
  db.prepare('UPDATE encounters SET combat_round = 2 WHERE id = ?').run(encId);

  rollIdx = 0;
  const longswordRng = () => {
    // 1: hero d20 (0.05 -> miss), 2: monster d20 (rngRollFraction), 3: monster damage (0.5 -> 3)
    const seq = [0.05, rngRollFraction, 0.5];
    return seq[rollIdx++] || 0.5;
  };

  const lsRoundState = executeCombatRound(db, hero.id, encId, 'ATTACK', { rng: longswordRng });
  assert.equal(lsRoundState.heroAC, 17, 'Longsword restores hero AC to 17');
  const monsterEventLS = lsRoundState.events.find(e => e.event_type === 'MONSTER_ATTACK' && e.round_number === 2);
  assert.ok(monsterEventLS, 'Monster attack event for round 2 must be logged');
  const lsDetails = JSON.parse(monsterEventLS.details || '{}');
  assert.equal(lsDetails.isHit, false, 'Monster total attack 16 must MISS Longsword AC 17');

  // Clean up encounter
  db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encId);
});

// =============================================================================
// 5. Healing Potion Selection: Query, Sorting, Consumption & Ownership Security
// =============================================================================
test('5. Healing Potion Selection: Cheapest-first default, explicit choice, ownership validation, and idempotency', async () => {
  const db = getDb();
  const suffix = Date.now().toString().slice(-6);
  const user1 = await registerUser(db, `PotUser1_${suffix}`, 'secret123');
  const user2 = await registerUser(db, `PotUser2_${suffix}`, 'secret123');

  const hero1 = createCharacter(db, {
    userId: user1.id,
    name: `Healee_${suffix}`,
    classType: 'FIGHTER',
    stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 11, wisdom: 10, charisma: 9 }
  });

  const hero2 = createCharacter(db, {
    userId: user2.id,
    name: `Stranger_${suffix}`,
    classType: 'CLERIC',
    stats: { strength: 10, dexterity: 10, constitution: 14, intelligence: 11, wisdom: 16, charisma: 11 }
  });

  // Clear starter potions to start clean
  db.prepare(`
    DELETE FROM item_instances
    WHERE owner_character_id IN (?, ?)
    AND item_definition_id IN (SELECT id FROM item_definitions WHERE category = 'POTION')
  `).run(hero1.id, hero2.id);

  const minorDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Minor Healing Potion'").get();
  const seriousDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Potion of Cure Serious Wounds'").get();
  const criticalDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Potion of Cure Critical Wounds'").get();

  // Add 1 Minor (25 gp), 1 Serious (750 gp), and 1 Critical (1400 gp) to Hero 1
  const pMinor = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
    VALUES (?, 'CHARACTER', ?)
  `).run(minorDef.id, hero1.id).lastInsertRowid;

  const pSerious = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
    VALUES (?, 'CHARACTER', ?)
  `).run(seriousDef.id, hero1.id).lastInsertRowid;

  const pCritical = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
    VALUES (?, 'CHARACTER', ?)
  `).run(criticalDef.id, hero1.id).lastInsertRowid;

  // Add 1 Serious potion to Hero 2 (stranger)
  const pStranger = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
    VALUES (?, 'CHARACTER', ?)
  `).run(seriousDef.id, hero2.id).lastInsertRowid;

  // 5a. getCharacterPotions returns potions ordered by cheapest first
  const potionsList = getCharacterPotions(db, hero1.id);
  assert.equal(potionsList.length, 3);
  assert.equal(potionsList[0].id, pMinor, 'Cheapest potion (Minor, 25 gp) must be first');
  assert.equal(potionsList[0].healEffect, '1d8+1');
  assert.ok(potionsList[0].displayName.includes('Minor Healing Potion (1d8+1)'));
  assert.equal(potionsList[1].id, pSerious, 'Middle potion (Serious, 750 gp) must be second');
  assert.equal(potionsList[2].id, pCritical, 'Most expensive potion (Critical, 1400 gp) must be third');

  // Setup combat scenario for Hero 1
  const monster = db.prepare('SELECT * FROM monsters LIMIT 1').get();
  db.prepare('UPDATE characters SET current_hp = 3 WHERE id = ?').run(hero1.id);

  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, tile_id, status, is_ambush, current_monster_hp, monster_max_hp, combat_round
    ) VALUES (?, ?, ?, 'IN_COMBAT', 0, 20, 20, 1)
  `).run(hero1.id, monster.id, hero1.tile_id);
  const encId = encRes.lastInsertRowid;

  // 5b. Default drink action (no potionInstanceId provided):
  // Must consume cheapest potion (Minor Healing Potion)
  // RNG: [potion roll: max (0.99 -> 9 HP), monster miss (0.05)]
  let pRng = () => 0.05; // monster attack misses
  let minorRng = () => 0.99; // potion rolls max
  let callCount = 0;
  const round1Rng = () => (callCount++ === 0 ? minorRng() : pRng());

  const state1 = executeCombatRound(db, hero1.id, encId, 'DRINK_POTION', { rng: round1Rng });
  assert.equal(state1.character.current_hp, 3 + 9, 'Minor potion healed 9 HP');
  assert.equal(getCharacterPotionCount(db, hero1.id), 2, 'Hero must now have 2 potions left');

  // Verify Minor was consumed and Serious + Critical still exist
  const minorInDb = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(pMinor);
  assert.equal(minorInDb, undefined, 'Minor Healing Potion must have been deleted from inventory');
  const seriousInDb = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(pSerious);
  assert.ok(seriousInDb, 'Serious Healing Potion must remain in inventory');

  // 5c. Explicit potion choice (potionInstanceId specified):
  // Choose Potion of Cure Serious Wounds (3d8+5)
  callCount = 0;
  const seriousHealRng = () => 0.99; // max 3d8+5 = 29
  const round2Rng = () => (callCount++ === 0 ? seriousHealRng() : pRng());

  db.prepare('UPDATE characters SET current_hp = 5 WHERE id = ?').run(hero1.id);
  const state2 = executeCombatRound(db, hero1.id, encId, 'DRINK_POTION', {
    potionInstanceId: pSerious,
    rng: round2Rng
  });

  assert.equal(state2.character.current_hp, Math.min(state2.character.max_hp, 5 + 29));
  const seriousInDbAfter = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(pSerious);
  assert.equal(seriousInDbAfter, undefined, 'Selected Serious Potion must be consumed');
  const criticalInDb = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(pCritical);
  assert.ok(criticalInDb, 'Critical Potion must remain in inventory');

  // 5d. Ownership validation: Hero 1 attempts to drink Hero 2's potion
  assert.throws(() => {
    executeCombatRound(db, hero1.id, encId, 'DRINK_POTION', { potionInstanceId: pStranger });
  }, /You do not possess the selected healing potion/i, 'Must reject drinking another character’s potion');

  // 5e. Type validation: Hero 1 attempts to drink an equipped sword
  const swordDef = db.prepare("SELECT * FROM item_definitions WHERE category = 'WEAPON' LIMIT 1").get();
  const swordInst = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
    VALUES (?, 'CHARACTER', ?)
  `).run(swordDef.id, hero1.id).lastInsertRowid;

  assert.throws(() => {
    executeCombatRound(db, hero1.id, encId, 'DRINK_POTION', { potionInstanceId: swordInst });
  }, /You do not possess the selected healing potion/i, 'Must reject non-potion item as healing potion');

  // 5f. Consume remaining potion, then attempt drinking with 0 potions
  db.prepare('DELETE FROM item_instances WHERE id = ?').run(pCritical);
  assert.equal(getCharacterPotionCount(db, hero1.id), 0);

  assert.throws(() => {
    executeCombatRound(db, hero1.id, encId, 'DRINK_POTION');
  }, /You do not possess any healing potions/i, 'Must reject drinking when inventory has 0 potions');

  // 5g. Idempotency test: duplicate submission with stale expectedRound
  db.prepare('UPDATE encounters SET combat_round = 3 WHERE id = ?').run(encId);
  const staleState = executeCombatRound(db, hero1.id, encId, 'DRINK_POTION', { expectedRound: 2 });
  const freshEnc = db.prepare('SELECT combat_round FROM encounters WHERE id = ?').get(encId);
  assert.equal(freshEnc.combat_round, 3, 'Round must not advance on stale request');

  // Cleanup
  db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encId);
});

// =============================================================================
// 6. UI & HTTP Integration: Potion Selection Dropdown & Combat Flow
// =============================================================================
test('6. UI & HTTP Integration: Renders potion dropdown in combat and processes selected potion via POST', async () => {
  const db = getDb();
  let cookie = '';

  const suffix = Date.now().toString().slice(-6);
  const username = `UIPotUser_${suffix}`;

  // 1. Register & login via HTTP
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

  // 2. Create character
  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  const createCsrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const createRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: `UIHero_${suffix}`,
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

  const hero = db.prepare('SELECT * FROM characters WHERE name = ?').get(`UIHero_${suffix}`);
  assert.ok(hero, 'Hero must be created');

  // Add a Potion of Cure Moderate Wounds (300 gp) in addition to 2 Minor Potions (25 gp)
  const modDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Potion of Cure Moderate Wounds'").get();
  const modInst = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
    VALUES (?, 'CHARACTER', ?)
  `).run(modDef.id, hero.id).lastInsertRowid;

  // Ensure hero has sufficient HP to survive round and select low CR monster
  db.prepare('UPDATE characters SET current_hp = 50, max_hp = 50 WHERE id = ?').run(hero.id);
  const monster = db.prepare('SELECT * FROM monsters WHERE challenge_rating <= 0.25 ORDER BY id ASC LIMIT 1').get() || db.prepare('SELECT * FROM monsters LIMIT 1').get();
  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, tile_id, status, is_ambush, current_monster_hp, monster_max_hp, combat_round
    ) VALUES (?, ?, ?, 'IN_COMBAT', 0, 20, 20, 1)
  `).run(hero.id, monster.id, hero.tile_id);
  const encId = encRes.lastInsertRowid;

  // 3. GET /game: Verify rendered dropdown contains potions and cheapest is selected
  const gamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage);
  const gameHtml = await gamePage.text();

  assert.ok(gameHtml.includes('name="potionInstanceId"'), 'Must render potionInstanceId select dropdown');
  assert.ok(gameHtml.includes('Minor Healing Potion (1d8+1)'), 'Must render Minor Healing Potion option with dice');
  assert.ok(gameHtml.includes('Potion of Cure Moderate Wounds (2d8+3)'), 'Must render Cure Moderate Wounds option with dice');
  assert.ok(gameHtml.includes('selected'), 'Cheapest potion must be selected by default');
  assert.ok(gameHtml.includes('🧪 Drink Potion'), 'Drink Potion button must be visible');

  // Extract CSRF token from combat form
  const combatCsrf = gameHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  // 4. POST /game/combat/potion selecting the Cure Moderate Wounds potion
  const drinkRes = await fetch(`${baseUrl}/game/combat/potion`, {
    method: 'POST',
    body: new URLSearchParams({
      encounterId: encId.toString(),
      round: '1',
      potionInstanceId: modInst.toString(),
      _csrf: combatCsrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(drinkRes.status, 302, 'Drink potion must redirect back to game screen');

  // Verify Cure Moderate Wounds was deleted, Minor potions still exist
  const modCheck = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(modInst);
  assert.equal(modCheck, undefined, 'Selected Cure Moderate Wounds potion must be consumed');
  const remainingPotions = getCharacterPotions(db, hero.id);
  assert.equal(remainingPotions.length, 2, 'Hero must still have the 2 Minor potions');

  // 5. Delete remaining potions and verify UI disables dropdown and button
  db.prepare(`
    DELETE FROM item_instances
    WHERE owner_character_id = ? AND item_definition_id IN (SELECT id FROM item_definitions WHERE category = 'POTION')
  `).run(hero.id);

  const emptyGamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  const emptyHtml = await emptyGamePage.text();
  assert.ok(emptyHtml.includes('No Potions Available'), 'Must show No Potions Available when 0 potions owned');
  assert.ok(emptyHtml.includes('disabled'), 'Must disable dropdown and button when 0 potions owned');

  // Cleanup
  db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encId);
});
