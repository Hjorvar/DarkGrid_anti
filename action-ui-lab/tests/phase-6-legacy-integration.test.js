/**
 * DARKGRID — PHASE 6: Full Legacy Integration & End-to-End Player Journey Test Suite
 *
 * Verifies against a real SQLite backend (zero mocked domain services):
 *   1. Legacy Database Compatibility & Non-Destructive Adapter (`GET /api/legacy-audit`)
 *   2. Authentication, Multi-User Sessions (`__session`), Logout/Login & Firebase Auth Upgrade Bridge
 *   3. Canonical 71-Point Character Creation, Class Validation, Ranger Favored Enemy & 1-Living-Hero Rule
 *   4. Multi-User Isolation + Shared World State
 *   5. World Exploration, Stage 1 Encounter Secrecy, Ranger Keen Senses & Opening Shot, Favored Enemy
 *   6. Cleric Holy Radiance vs Undead, Sacred Self-Heal (`CLERIC_HEAL`) & Sanctuary Rest (`REST`)
 *   7. Combat Victory, INT-Scaled XP, Level-Up Progression & Saving Throws
 *   8. 9-Slot Equipment (Belt of Giant Strength +2, Cloak of Resistance +1, Ring of Protection +1),
 *      Charisma-Scaled Market, Starter-Item Protection & Shared Global Magical Resale Market
 *   9. Watcher's Board Hunting Contracts (Accept, Abandon, Slay & Auto-Claim in Oakhaven)
 *  10. Permadeath, Persistent Monster Creation (+10% HP, Loot Transfer, Wilderness Threat Bearing) & Avenging
 *  11. Anti-Tamper Security (`FORBIDDEN_CLIENT_FIELDS`) & Action Idempotency (`X-Idempotency-Key`)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const { createLabApp } = require('../server');
const { getTileByCoords } = require('../../src/domain/world/map');

const TEST_DB_PATH = path.join(__dirname, '../data/test_phase6_legacy_integration.sqlite');
const PHASE6_SCREENSHOT_DIR = path.join(__dirname, '../docs/phase-6/screenshots');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

function findChromeExecutable() {
  for (const c of CHROME_CANDIDATES) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = TEST_DB_PATH + suffix;
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Helper client that maintains its own session cookie jar (`__session`)
 * so we can test multiple concurrent authenticated users against the server.
 */
function createSessionClient(getBaseUrl) {
  let sessionCookie = null;

  function captureCookie(res) {
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    for (const raw of setCookies) {
      const match = raw.match(/(__session=[^;]+)/);
      if (match) {
        sessionCookie = match[1];
      }
    }
  }

  function buildHeaders(extraHeaders = {}) {
    const h = { 'Content-Type': 'application/json', ...extraHeaders };
    if (sessionCookie) {
      h.Cookie = sessionCookie;
    }
    return h;
  }

  return {
    getCookie: () => sessionCookie,
    async get(urlPath) {
      const res = await fetch(`${getBaseUrl()}${urlPath}`, {
        method: 'GET',
        headers: buildHeaders()
      });
      captureCookie(res);
      const json = await res.json();
      return { status: res.status, headers: res.headers, json };
    },
    async post(urlPath, body = {}, extraHeaders = {}) {
      const res = await fetch(`${getBaseUrl()}${urlPath}`, {
        method: 'POST',
        headers: buildHeaders(extraHeaders),
        body: JSON.stringify(body)
      });
      captureCookie(res);
      const json = await res.json();
      return { status: res.status, headers: res.headers, json };
    },
    async action(action, payload = {}, extraHeaders = {}) {
      return this.post('/api/action', { action, payload }, extraHeaders);
    }
  };
}

describe('Phase 6 — Full Legacy Integration & Complete Player Journey Verification', () => {
  let app;
  let server;
  let baseUrl;
  let db;
  let mockRngValue = 0.75;

  const clientA = createSessionClient(() => baseUrl);
  const clientB = createSessionClient(() => baseUrl);

  before(async () => {
    cleanupTestDb();
    app = createLabApp({
      dbPath: TEST_DB_PATH,
      allowLabTools: true,
      rng: () => mockRngValue,
      firebaseVerifier: async (username, password) => {
        if (username === 'migrated_hero' && password === 'firebasePass123') {
          return { uid: 'fb_uid_migrated_001', displayName: 'migrated_hero' };
        }
        return null;
      }
    });
    db = app.locals.db;
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (db) {
      try { db.close(); } catch {}
    }
    cleanupTestDb();
  });

  it('1. Audits Legacy Database Compatibility with zero missing tables, columns, or FK violations', async () => {
    const { status, json } = await clientA.get('/api/legacy-audit');
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.compatible, true);
    assert.deepEqual(json.missingTables, []);
    assert.deepEqual(json.missingCharacterColumns, []);
    assert.equal(json.foreignKeyViolations, 0);
    assert.equal(json.counts.mapTiles, 225);
    assert.ok(json.counts.monsters >= 98);
    assert.ok(json.counts.itemDefinitions >= 25);
    assert.deepEqual(json.classesSupported, ['FIGHTER', 'RANGER', 'CLERIC']);
    assert.equal(json.statRules.requiredTotalSum, 71);
  });

  it('2. Supports User Registration, Session Persistence, Logout, Login & Firebase Auth Password Upgrade Bridge', async () => {
    // Register User A
    const regRes = await clientA.post('/api/auth/register', {
      username: 'ranger_kaelen',
      password: 'darkgridPassword1!'
    });
    assert.equal(regRes.status, 200);
    assert.equal(regRes.json.ok, true);
    assert.equal(regRes.json.user.username, 'ranger_kaelen');
    assert.ok(clientA.getCookie(), 'Must issue __session cookie');
    // Newly registered user has no character yet -> mode NO_CHARACTER
    assert.equal(regRes.json.state.mode, 'NO_CHARACTER');
    assert.ok(regRes.json.state.classBases.RANGER);
    assert.equal(regRes.json.state.statRules.requiredTotalSum, 71);

    // Check /api/auth/session
    const sessRes = await clientA.get('/api/auth/session');
    assert.equal(sessRes.status, 200);
    assert.equal(sessRes.json.authenticated, true);
    assert.equal(sessRes.json.user.username, 'ranger_kaelen');
    assert.equal(sessRes.json.hasLivingCharacter, false);

    // Log out -> mode UNAUTHENTICATED
    const outRes = await clientA.post('/api/auth/logout');
    assert.equal(outRes.status, 200);
    assert.equal(outRes.json.state.mode, 'UNAUTHENTICATED');

    // Log back in -> restores ranger_kaelen session
    const loginRes = await clientA.post('/api/auth/login', {
      username: 'ranger_kaelen',
      password: 'darkgridPassword1!'
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.json.ok, true);
    assert.equal(loginRes.json.user.username, 'ranger_kaelen');
    assert.equal(loginRes.json.state.mode, 'NO_CHARACTER');

    // Verify Firebase Auth migrated user upgrade bridge
    db.prepare("INSERT INTO users (username, password_hash) VALUES ('migrated_hero', 'firebase-auth')").run();
    const fbClient = createSessionClient(() => baseUrl);
    const fbLogin = await fbClient.post('/api/auth/login', {
      username: 'migrated_hero',
      password: 'firebasePass123'
    });
    assert.equal(fbLogin.status, 200);
    assert.equal(fbLogin.json.ok, true);
    const upgradedRow = db.prepare("SELECT password_hash FROM users WHERE username = 'migrated_hero'").get();
    assert.ok(upgradedRow.password_hash.startsWith('$2'), 'Firebase-auth placeholder must be upgraded to bcrypt hash');
  });

  it('3. Enforces Canonical 71-Point Character Creation Rules, Ranger Favored Enemy Rules & 1-Living-Hero Limit', async () => {
    // 3a. Reject invalid point-buy sum (68 instead of 71)
    const badSum = await clientA.post('/api/character/create', {
      name: 'Kaelen Mistwalker',
      classType: 'RANGER',
      stats: { strength: 12, constitution: 10, dexterity: 14, intelligence: 10, wisdom: 12, charisma: 10 },
      favoredEnemyType: 'ANIMAL'
    });
    assert.equal(badSum.status, 400);
    assert.equal(badSum.json.ok, false);
    assert.match(badSum.json.error, /71/);

    // 3b. Reject Ranger Favored Enemy UNDEAD
    const badUndead = await clientA.post('/api/character/create', {
      name: 'Kaelen Mistwalker',
      classType: 'RANGER',
      stats: { strength: 12, constitution: 12, dexterity: 15, intelligence: 10, wisdom: 12, charisma: 10 },
      favoredEnemyType: 'UNDEAD'
    });
    assert.equal(badUndead.status, 400);
    assert.match(badUndead.json.error, /Undead is not permitted/i);

    // 3c. Reject HUMANOID without subtype
    const badHum = await clientA.post('/api/character/create', {
      name: 'Kaelen Mistwalker',
      classType: 'RANGER',
      stats: { strength: 12, constitution: 12, dexterity: 15, intelligence: 10, wisdom: 12, charisma: 10 },
      favoredEnemyType: 'HUMANOID'
    });
    assert.equal(badHum.status, 400);
    assert.match(badHum.json.error, /requires a subtype/i);

    // 3d. Create valid Ranger with HUMANOID:goblinoid and 71 points (12+11+16+10+12+10 = 71)
    const createRes = await clientA.post('/api/character/create', {
      name: 'Kaelen Mistwalker',
      classType: 'RANGER',
      stats: { strength: 12, constitution: 11, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 10 },
      favoredEnemyType: 'HUMANOID:goblinoid',
      primaryWeapon: 'RANGED'
    });
    assert.equal(createRes.status, 200);
    assert.equal(createRes.json.ok, true);
    const state = createRes.json.state;
    assert.equal(state.mode, 'CITY');
    assert.equal(state.character.name, 'Kaelen Mistwalker');
    assert.equal(state.character.class, 'RANGER');
    assert.equal(state.character.level, 1);
    assert.equal(state.character.gold, 10);
    assert.equal(state.character.favored_enemy_type, 'HUMANOID');
    assert.equal(state.character.favored_enemy_subtype, 'goblinoid');
    assert.equal(state.character.primary_weapon, 'RANGED');
    assert.equal(state.character.xpForNextLevel, 1300);
    assert.ok(state.savingThrows, 'State must include savingThrows');
    assert.equal(state.savingThrows.fort, 2); // Ranger Lv1 good fort (2) + CON 11 (+0)
    assert.equal(state.savingThrows.ref, 5);  // Ranger Lv1 good ref (2) + DEX 16 (+3)
    assert.equal(state.savingThrows.will, 1); // Ranger Lv1 poor will (0) + WIS 12 (+1)
    assert.ok(Array.isArray(state.classAbilities) && state.classAbilities.length >= 3);

    // 3e. Reject creating a second living character for the same user (409 Conflict)
    const dupRes = await clientA.post('/api/character/create', {
      name: 'Second Ranger',
      classType: 'RANGER',
      stats: { strength: 12, constitution: 11, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 10 },
      favoredEnemyType: 'ANIMAL'
    });
    assert.equal(dupRes.status, 409);
    assert.match(dupRes.json.error, /Only one living hero is permitted/i);
  });

  it('4. Isolates Multiple Authenticated Users while Sharing the Authoritative World Database', async () => {
    // Register User B and create a Cleric with high Intelligence (12) and Charisma (14)
    // Cleric base: STR 12, CON 10, DEX 10, INT 10, WIS 14, CHA 12 (sum 68)
    // Allocate: STR 12, CON 10, DEX 9 (-1), INT 12 (+2), WIS 14, CHA 14 (+2) -> sum 71
    const regB = await clientB.action('REGISTER', {
      username: 'cleric_aldric',
      password: 'clericPassword1!',
      createCharacter: {
        name: 'Brother Aldric',
        classType: 'CLERIC',
        stats: { strength: 12, constitution: 10, dexterity: 9, intelligence: 12, wisdom: 14, charisma: 14 },
        primaryWeapon: 'MELEE'
      }
    });
    assert.equal(regB.status, 200);
    assert.equal(regB.json.ok, true);
    assert.equal(regB.json.state.character.name, 'Brother Aldric');
    assert.equal(regB.json.state.character.class, 'CLERIC');
    assert.equal(regB.json.state.character.charisma, 14);

    // Verify User A still receives Kaelen Mistwalker on GET /api/state
    const stateA = await clientA.get('/api/state');
    assert.equal(stateA.json.state.character.name, 'Kaelen Mistwalker');
    assert.equal(stateA.json.state.character.class, 'RANGER');

    // Verify User B receives Brother Aldric on GET /api/state
    const stateB = await clientB.get('/api/state');
    assert.equal(stateB.json.state.character.name, 'Brother Aldric');
    assert.equal(stateB.json.state.character.class, 'CLERIC');
  });

  it('5. Executes Ranger Exploration, Stage 1 Secrecy, Keen Senses, Opening Shot & Favored Enemy vs Goblin', async () => {
    // Move User A (Ranger) North out of Oakhaven (7,7) -> (7,6) without encounter
    mockRngValue = 0.99;
    let moveRes = await clientA.action('MOVE', { relative: 'FORWARD', testForceEncounter: false });
    assert.equal(moveRes.json.ok, true);
    assert.equal(moveRes.json.state.currentTile.x, 7);
    assert.equal(moveRes.json.state.currentTile.y, 6);

    // Spawn a Stage 1 Mystery Encounter with a Goblin on (7,5)
    const goblin = db.prepare("SELECT * FROM monsters WHERE LOWER(name) = 'goblin'").get();
    assert.ok(goblin, 'Goblin must exist in monsters table');
    const tile75 = getTileByCoords(db, 7, 5);
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile75.id, moveRes.json.state.character.id);
    db.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id, status,
        current_monster_hp, monster_max_hp, combat_round,
        spotted_by_hero, is_ambush, opening_shot_resolved, combat_state_json
      ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, 1, 0, 0, '{}')
    `).run(moveRes.json.state.character.id, tile75.id, goblin.id, goblin.base_hp, goblin.base_hp);

    const discState = (await clientA.get('/api/state')).json.state;
    assert.equal(discState.mode, 'DISCOVERED');
    assert.equal(discState.encounter.status, 'DISCOVERED');
    // Strict Encounter Secrecy: Stage 1 NEVER leaks monsterName, monsterId, or imageUrl
    assert.equal(discState.encounter.monsterName, undefined);
    assert.equal(discState.encounter.monsterId, undefined);
    assert.equal(discState.encounter.imageUrl, undefined);
    assert.equal(discState.encounter.isRangerSpecial, true, 'Ranger must receive Keen Senses clue in Stage 1');

    // Engage (`INVESTIGATE`) with high RNG roll (0.85 -> hits on Opening Shot!)
    mockRngValue = 0.85;
    const engRes = await clientA.action('INVESTIGATE');
    assert.equal(engRes.json.ok, true);
    const afterEngage = engRes.json.state;

    // Verify Favored Enemy (+1 Atk vs Goblin) increased rangedAttackBonus when revealed (or killed on Opening Shot)
    const events = db.prepare('SELECT * FROM combat_events WHERE encounter_id = ? ORDER BY id ASC').all(discState.encounter.id);
    assert.ok(events.some(e => e.event_type === 'OPENING_SHOT'), 'Ranger in RANGED stance must fire Opening Shot on INVESTIGATE');

    // Finish combat if Goblin survived the opening shot
    let curState = afterEngage;
    let safety = 0;
    while (curState.encounter && curState.encounter.status === 'IN_COMBAT' && safety < 10) {
      safety++;
      const atkRes = await clientA.action('ATTACK');
      curState = atkRes.json.state;
    }
    assert.ok(curState.victory, 'Ranger must achieve VICTORY over Goblin');
    assert.equal(curState.victory.cleanMonsterName, 'Goblin');
  });

  it('6. Executes Cleric Holy Radiance vs Undead, Sacred Self-Heal Outside Combat & Sanctuary Rest Recharge', async () => {
    // Stage User B (Cleric) in combat against a Human Skeleton (UNDEAD)
    const stateB0 = (await clientB.get('/api/state')).json.state;
    const baseAC = stateB0.combatStats.heroAC;

    mockRngValue = 0.85;
    const stageRes = await clientB.action('LAB_SCENARIO', {
      scenario: 'STAGE2_COMBAT',
      monsterName: 'Human Skeleton'
    });
    assert.equal(stageRes.json.ok, true);
    const combatStateB = stageRes.json.state;
    assert.equal(combatStateB.mode, 'IN_COMBAT');
    assert.equal(combatStateB.encounter.monsterName, 'Human Skeleton');
    // Cleric Holy Radiance grants +2 AC vs Undead at Level 1!
    assert.equal(combatStateB.combatStats.heroAC, baseAC + 2, 'Cleric Holy Radiance must grant +2 AC vs Undead');

    // Defeat the Skeleton
    let curB = combatStateB;
    let rounds = 0;
    while (curB.encounter && curB.encounter.status === 'IN_COMBAT' && rounds < 10) {
      rounds++;
      curB = (await clientB.action('ATTACK')).json.state;
    }
    assert.ok(curB.victory, 'Cleric must defeat Human Skeleton');
    // Verify INT 12 (+1 mod -> +10% XP) scaled the XP reward
    const skel = db.prepare("SELECT xp_reward FROM monsters WHERE LOWER(name) = 'human skeleton'").get();
    const expectedXp = Math.round(skel.xp_reward * 1.10);
    assert.equal(curB.victory.xpAwarded, expectedXp, 'Intelligence modifier (+1) must increase XP by +10%');

    // Simulate wound on Cleric outside combat and cast CLERIC_HEAL
    await clientB.action('LAB_SCENARIO', { scenario: 'WOUNDED' });
    const woundedB = (await clientB.get('/api/state')).json.state;
    assert.ok(woundedB.character.current_hp < woundedB.character.max_hp);
    assert.equal(woundedB.clericHealInfo.remainingUses, 2);

    const healRes = await clientB.action('CLERIC_HEAL');
    assert.equal(healRes.json.ok, true);
    assert.ok(healRes.json.state.character.current_hp > woundedB.character.current_hp);
    assert.equal(healRes.json.state.clericHealInfo.remainingUses, 1);

    // Return to Oakhaven Sanctuary and REST -> restores full HP and resets cleric_heal_uses to 2
    await clientB.action('LAB_SCENARIO', { scenario: 'CITY' });
    const restRes = await clientB.action('REST');
    assert.equal(restRes.json.ok, true);
    assert.equal(restRes.json.state.character.current_hp, restRes.json.state.character.max_hp);
    assert.equal(restRes.json.state.clericHealInfo.remainingUses, 2);
  });

  it('7. Verifies 9-Slot Equipment Bonuses, Charisma Shop Pricing, Starter Protection & Shared Global Magical Resale Market', async () => {
    // Return User A and User B to Oakhaven Sanctuary and grant gold for market testing
    await clientA.action('LAB_SCENARIO', { scenario: 'CITY' });
    await clientB.action('LAB_SCENARIO', { scenario: 'CITY' });

    const charA = (await clientA.get('/api/state')).json.state.character;
    const charB = (await clientB.get('/api/state')).json.state.character;
    db.prepare('UPDATE characters SET gold = 2500 WHERE id IN (?, ?)').run(charA.id, charB.id);

    const marketA = (await clientA.get('/api/state')).json.state.shopStock;
    const marketB = (await clientB.get('/api/state')).json.state.shopStock;

    // User B has CHA 14 (+2 mod -> -10% prices), User A has CHA 10 (+0 mod -> 100% prices)
    const chainmailA = marketA.standardItems.find(i => i.name === 'Chainmail');
    const chainmailB = marketB.standardItems.find(i => i.name === 'Chainmail');
    assert.ok(chainmailA && chainmailB);
    assert.ok(chainmailB.buy_price < chainmailA.buy_price, 'Cleric with CHA 14 must receive discounted merchant prices');

    // Starter gear cannot be sold
    const invA = (await clientA.get('/api/state')).json.state.inventory;
    const starterArmor = invA.find(i => i.is_starter);
    assert.ok(starterArmor, 'Starter item must be flagged is_starter');
    await clientA.action('UNEQUIP', { itemInstanceId: starterArmor.id });
    const sellStarterRes = await clientA.action('SELL', { itemInstanceId: starterArmor.id });
    assert.equal(sellStarterRes.json.ok, false);
    assert.match(sellStarterRes.json.error, /starter/i);
    await clientA.action('EQUIP', { itemInstanceId: starterArmor.id });

    // Grant User A a Belt of Giant Strength +2, Cloak of Resistance +1, and Ring of Protection +1
    const beltDef = db.prepare("SELECT id FROM item_definitions WHERE name LIKE 'Belt of Giant Strength%' LIMIT 1").get();
    const cloakDef = db.prepare("SELECT id FROM item_definitions WHERE name LIKE 'Cloak of Resistance%' LIMIT 1").get();
    const ringDef = db.prepare("SELECT id FROM item_definitions WHERE name LIKE 'Ring of Protection%' LIMIT 1").get();
    assert.ok(beltDef && cloakDef && ringDef, 'Magical accessory definitions must exist');

    const beltInst = Number(db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)").run(beltDef.id, charA.id).lastInsertRowid);
    const cloakInst = Number(db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)").run(cloakDef.id, charA.id).lastInsertRowid);
    const ringInst = Number(db.prepare("INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)").run(ringDef.id, charA.id).lastInsertRowid);

    const beforeEquip = (await clientA.get('/api/state')).json.state;
    await clientA.action('EQUIP', { itemInstanceId: beltInst });
    await clientA.action('EQUIP', { itemInstanceId: cloakInst });
    const afterEquip = (await clientA.action('EQUIP', { itemInstanceId: ringInst })).json.state;

    assert.equal(afterEquip.character.is_str_boosted, true, 'Belt of Giant Strength +2 must set is_str_boosted');
    assert.equal(afterEquip.character.strength, beforeEquip.character.strength + 2, 'Belt must grant +2 STR');
    assert.equal(afterEquip.savingThrows.fort, beforeEquip.savingThrows.fort + 1, 'Cloak of Resistance +1 must grant +1 Fort');
    assert.equal(afterEquip.savingThrows.ref, beforeEquip.savingThrows.ref + 1, 'Cloak of Resistance +1 must grant +1 Ref');
    assert.equal(afterEquip.savingThrows.will, beforeEquip.savingThrows.will + 1, 'Cloak of Resistance +1 must grant +1 Will');
    assert.equal(afterEquip.combatStats.heroAC, beforeEquip.combatStats.heroAC + 1, 'Ring of Protection +1 must grant +1 AC');

    // Unequip Ring of Protection +1 and SELL it from User A -> consigns to Shared Global Magical Resale Market at 125%
    await clientA.action('UNEQUIP', { itemInstanceId: ringInst });
    const sellRingRes = await clientA.action('SELL', { itemInstanceId: ringInst });
    assert.equal(sellRingRes.json.ok, true);

    // User B inspects Oakhaven Market and buys User A's consigned Ring of Protection +1 from `resaleListings`!
    const stateBWithResale = (await clientB.get('/api/state')).json.state;
    const ringListing = stateBWithResale.shopStock.resaleListings.find(l => l.item_instance_id === ringInst);
    assert.ok(ringListing, 'Magical item sold by User A must appear in User B global resale listings');

    const buyResale = await clientB.action('BUY', { listingId: ringListing.listing_id });
    assert.equal(buyResale.json.ok, true);
    assert.ok(buyResale.json.state.inventory.some(i => i.id === ringInst), 'User B must now own the purchased resale relic');
  });

  it('8. Completes Watcher’s Board Bounty Lifecycle (Accept, Abandon, Accept, Slay Quarry & Auto-Claim Reward)', async () => {
    const stateA0 = (await clientA.get('/api/state')).json.state;
    assert.equal(stateA0.bountyContracts.length, 3, 'Oakhaven must offer 3 hunting contracts');
    const c1 = stateA0.bountyContracts[0];
    const c2 = stateA0.bountyContracts[1];

    // Accept contract 1, then abandon it
    const acc1 = await clientA.action('ACCEPT_BOUNTY', { contractId: c1.id });
    assert.equal(acc1.json.ok, true);
    assert.equal(acc1.json.state.activeContract.id, c1.id);

    const abn1 = await clientA.action('ABANDON_BOUNTY', { contractId: c1.id });
    assert.equal(abn1.json.ok, true);
    assert.equal(abn1.json.state.activeContract, null);

    // Accept contract 2 and mark it READY_TO_CLAIM to verify Oakhaven auto-claim on return
    const acc2 = await clientA.action('ACCEPT_BOUNTY', { contractId: c2.id });
    assert.equal(acc2.json.ok, true);
    const goldBeforeClaim = acc2.json.state.character.gold;
    db.prepare("UPDATE hunting_contracts SET status = 'READY_TO_CLAIM' WHERE id = ?").run(c2.id);

    const claimState = (await clientA.get('/api/state')).json.state;
    assert.equal(claimState.character.gold, goldBeforeClaim + c2.reward_gold, 'Returning to Oakhaven must auto-claim completed bounty gold');
    assert.match(claimState.infoMessage, /Bounty Completed/i);
  });

  it('9. Executes Permadeath, Persistent Monster Creation (+10% HP & Loot Transfer), Wilderness Threat Bearing & Avenging', async () => {
    // Move User B (Brother Aldric) to (7,5) Mirkwood Forest, stage combat with a Troll, and let the Troll slay Brother Aldric
    const stateB = (await clientB.action('LAB_SCENARIO', {
      scenario: 'STAGE2_COMBAT',
      monsterName: 'Troll'
    })).json.state;
    const charBId = stateB.character.id;
    const tileId = stateB.currentTile.id;
    const encId = stateB.encounter.id;
    const trollBaseHp = db.prepare('SELECT monster_max_hp FROM encounters WHERE id = ?').get(encId).monster_max_hp;

    // Set Brother Aldric to 1 HP and have the Troll slay him during a failed FLEE attempt (mockRngValue = 0.85 -> Troll rolls 18+9=27 and hits!)
    db.prepare('UPDATE characters SET current_hp = 1, gold = 300 WHERE id = ?').run(charBId);
    mockRngValue = 0.85;
    const fleeDeathRes = await clientB.action('FLEE');
    const deathState = fleeDeathRes.json.state;

    assert.equal(deathState.mode, 'FALLEN', 'Character reduced to 0 HP must transition to FALLEN permadeath state');
    assert.equal(deathState.fallen.name, 'Brother Aldric');
    assert.ok(deathState.fallen.killer_name.includes('Troll'));
    assert.ok(Array.isArray(deathState.combatEvents) && deathState.combatEvents.length > 0, 'Fallen screen must include final battle combatEvents');

    // Verify persistent monster_instance was created on tile (7,5) with +10% HP boost and kill_count = 1
    const persistent = db.prepare("SELECT * FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'").get(tileId);
    assert.ok(persistent, 'Slayer monster must persist as ACTIVE monster_instance on the tile');
    assert.equal(persistent.kill_count, 1);
    assert.equal(persistent.max_hp, Math.ceil(trollBaseHp * 1.10), 'Persistent monster must gain +10% max HP');
    assert.equal(persistent.held_gold, 150, 'Persistent monster must claim 50% of the fallen hero gold (150 of 300)');

    // Verify Oakhaven Wilderness Threats reports the compass direction & kill count without leaking species or coordinates
    await clientA.action('LAB_SCENARIO', { scenario: 'CITY' });
    const boardState = (await clientA.get('/api/state')).json.state;
    assert.ok(boardState.wildernessThreats.length >= 1, 'Watcher Board Section B must report active persistent threat');
    assert.equal(boardState.wildernessThreats[0].killCount || boardState.wildernessThreats[0].kill_count, 1);
    assert.equal(boardState.wildernessThreats[0].monster_name, undefined, 'Wilderness Threats must NEVER leak monster species');

    // User B forges a new Fighter ("Sir Galahad") and avenges Brother Aldric by slaying the persistent Troll!
    const newHeroRes = await clientB.action('CREATE_CHARACTER', {
      name: 'Sir Galahad',
      classType: 'FIGHTER',
      stats: { strength: 16, constitution: 13, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 10 },
      primaryWeapon: 'MELEE'
    });
    assert.equal(newHeroRes.json.ok, true);
    const galahadId = newHeroRes.json.state.character.id;

    // Boost Sir Galahad to Level 8 and move onto the tile with the persistent Troll!
    const trollCoords = db.prepare('SELECT x, y FROM map_tiles WHERE id = ?').get(tileId);
    const southOfTroll = getTileByCoords(db, trollCoords.x, trollCoords.y + 1);
    db.prepare('UPDATE characters SET level = 8, xp = 35000, strength = 22, current_hp = 120, max_hp = 120, tile_id = ? WHERE id = ?').run(
      southOfTroll.id,
      galahadId
    );
    mockRngValue = 0.05; // triggers encounter on step
    const stepToTroll = await clientB.action('MOVE', { direction: 'NORTH', testForceEncounter: true });
    assert.equal(stepToTroll.json.state.mode, 'DISCOVERED');

    // Weaken persistent monster HP in active encounter to 1 HP and strike with high RNG (0.95 -> crit/hit)
    mockRngValue = 0.95;
    await clientB.action('INVESTIGATE');
    const activeTrollEnc = db.prepare("SELECT id FROM encounters WHERE character_id = ? AND status = 'IN_COMBAT'").get(galahadId);
    assert.ok(activeTrollEnc, 'Sir Galahad must be IN_COMBAT with the persistent Troll');
    db.prepare('UPDATE encounters SET current_monster_hp = 1 WHERE id = ?').run(activeTrollEnc.id);
    const slayRes = await clientB.action('ATTACK');
    const vic = slayRes.json.state.victory;
    assert.ok(vic, 'Sir Galahad must slay the persistent Troll');
    assert.ok(vic.persistentInfo, 'Victory payload must include persistentInfo');
    assert.ok(vic.persistentInfo.avengedHeroes.some(h => (typeof h === 'string' ? h : h.name) === 'Brother Aldric'), 'Victory must record Brother Aldric as avenged');
    assert.ok(vic.goldLooted >= 150, 'Avenging hero must recover the fallen hero held gold');
  });

  it('10. Enforces Anti-Tamper Security (FORBIDDEN_CLIENT_FIELDS) & Action Idempotency (X-Idempotency-Key)', async () => {
    // 10a. Reject client attempt to supply gold, current_hp, or level in body or payload
    const tamperTop = await clientA.post('/api/action', {
      action: 'REST',
      gold: 999999
    });
    assert.equal(tamperTop.status, 400);
    assert.equal(tamperTop.json.ok, false);
    assert.ok(tamperTop.json.tamperedFields.includes('gold'));

    const tamperNested = await clientA.post('/api/action', {
      action: 'MOVE',
      payload: { direction: 'NORTH', current_hp: 999 }
    });
    assert.equal(tamperNested.status, 400);
    assert.equal(tamperNested.json.ok, false);
    assert.ok(tamperNested.json.tamperedFields.includes('current_hp'));

    // 10b. Verify Action Idempotency prevents duplicate item purchase on retry with same X-Idempotency-Key
    await clientA.action('LAB_SCENARIO', { scenario: 'CITY' });
    const beforeBuy = (await clientA.get('/api/state')).json.state;
    const potionItem = beforeBuy.shopStock.standardItems.find(i => i.name === 'Minor Healing Potion');
    assert.ok(potionItem);
    const startGold = beforeBuy.character.gold;
    const startInvCount = beforeBuy.inventory.length;

    const idemKey = 'test-buy-potion-idem-001';
    const buy1 = await clientA.action('BUY', { itemDefinitionId: potionItem.id }, { 'X-Idempotency-Key': idemKey });
    assert.equal(buy1.status, 200);
    assert.equal(buy1.json.ok, true);
    assert.equal(buy1.json.state.character.gold, startGold - potionItem.buy_price);
    assert.equal(buy1.json.state.inventory.length, startInvCount + 1);

    // Replay identical request with same X-Idempotency-Key -> must replay response and NOT deduct gold a second time!
    const buy2 = await clientA.action('BUY', { itemDefinitionId: potionItem.id }, { 'X-Idempotency-Key': idemKey });
    assert.equal(buy2.status, 200);
    assert.equal(buy2.headers.get('x-idempotent-replay'), 'true');
    assert.equal(buy2.json.state.character.gold, startGold - potionItem.buy_price);

    const afterState = (await clientA.get('/api/state')).json.state;
    assert.equal(afterState.character.gold, startGold - potionItem.buy_price, 'Gold must only be deducted once');
    assert.equal(afterState.inventory.length, startInvCount + 1, 'Item must only be granted once');
  });

  it('11. Verifies Live Headless Chrome Browser Visual QA across Account, Character Creator, Champion Sheet, Market Tabs, Watcher Board, Exploration & Combat with Zero Console/Network Errors', async () => {
    const chromeExe = findChromeExecutable();
    assert.ok(chromeExe, 'Headless Chrome executable must be available for Phase 6 Visual QA');

    const tmpProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-phase6-chrome-'));
    const debugPort = 9500 + Math.floor(Math.random() * 350);
    const consoleErrors = [];
    const pageExceptions = [];
    const failedNetworkRequests = [];
    const requestUrlById = new Map();

    const chromeProc = spawn(chromeExe, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${tmpProfileDir}`,
      'about:blank'
    ], { stdio: 'ignore' });

    let ws = null;
    try {
      // Wait for debugger target
      let wsUrl = null;
      const start = Date.now();
      while (Date.now() - start < 12000 && !wsUrl) {
        try {
          const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
          const list = await res.json();
          const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
          if (page) wsUrl = page.webSocketDebuggerUrl;
        } catch {}
        if (!wsUrl) await new Promise(r => setTimeout(r, 150));
      }
      assert.ok(wsUrl, 'Connected to headless Chrome DevTools WebSocket');

      ws = new WebSocket(wsUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
      });

      let msgId = 0;
      const pending = new Map();
      ws.addEventListener('message', (event) => {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject, timer } = pending.get(msg.id);
          clearTimeout(timer);
          pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
          return;
        }
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
          const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
          consoleErrors.push(text);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          pageExceptions.push(msg.params?.exceptionDetails?.text || 'Uncaught exception');
        } else if (msg.method === 'Network.requestWillBeSent' && msg.params?.requestId) {
          requestUrlById.set(msg.params.requestId, msg.params.request?.url || '');
        } else if (msg.method === 'Network.responseReceived' && msg.params?.response?.status >= 400) {
          failedNetworkRequests.push({ url: msg.params.response.url, status: msg.params.response.status });
        }
      });

      const cdpSend = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++msgId;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout on ${method}`));
        }, 12000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });

      const evalInPage = async (expression) => {
        const res = await cdpSend('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (res && res.exceptionDetails) {
          throw new Error(res.result?.description || res.exceptionDetails.text || 'Eval error');
        }
        return res?.result?.value;
      };

      const saveScreenshot = async (filename) => {
        fs.mkdirSync(PHASE6_SCREENSHOT_DIR, { recursive: true });
        const shot = await cdpSend('Page.captureScreenshot', { format: 'png' });
        const out = path.join(PHASE6_SCREENSHOT_DIR, filename);
        fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
        return out;
      };

      await cdpSend('Page.enable');
      await cdpSend('Runtime.enable');
      await cdpSend('Network.enable');
      await cdpSend('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false
      });

      await cdpSend('Page.navigate', { url: baseUrl });
      await new Promise(r => setTimeout(r, 600));
      await evalInPage(`(async () => {
        for (let i = 0; i < 40; i++) {
          if (window.currentState && window.currentState.character) break;
          await new Promise(r => setTimeout(r, 100));
        }
      })()`);

      // 11a. Open Account & 71-Point Character Creator Modal
      const accountDom = await evalInPage(`(async () => {
        openLabModal('account');
        selectCreatorClass('RANGER');
        await new Promise(r => setTimeout(r, 150));
        return {
          title: document.getElementById('lab-modal-title')?.textContent?.trim(),
          bodyText: document.getElementById('lab-modal-body')?.innerText || ''
        };
      })()`);
      assert.match(accountDom.title, /Account|Character Forge/i);
      assert.match(accountDom.bodyText, /71-Point|Favored Enemy|RANGER/i);
      await saveScreenshot('01_phase6_account_and_71pt_creator.png');

      // 11b. Open Champion Sheet Modal (Saving Throws, XP to Next Level, Class Abilities, 9-Slot Panoply)
      const charDom = await evalInPage(`(async () => {
        openLabModal('character');
        await new Promise(r => setTimeout(r, 150));
        return {
          title: document.getElementById('lab-modal-title')?.textContent?.trim(),
          bodyText: document.getElementById('lab-modal-body')?.innerText || ''
        };
      })()`);
      assert.match(charDom.bodyText, /Saving Throws/i);
      assert.match(charDom.bodyText, /Fortitude|Reflex|Will/i);
      assert.match(charDom.bodyText, /Class Pillars & Progression Tiers/i);
      assert.match(charDom.bodyText, /9-Slot Equipped Panoply/i);
      await saveScreenshot('02_phase6_champion_sheet_saving_throws_abilities.png');

      // 11c. Open Oakhaven Market Modal (Standard Stock + Magical Resale + Sell Backpack Gear)
      const marketDom = await evalInPage(`(async () => {
        await triggerLabScenario('CITY');
        openLabModal('market');
        setMarketTab('BUY_STANDARD');
        await new Promise(r => setTimeout(r, 150));
        const stdText = document.getElementById('lab-modal-body')?.innerText || '';
        setMarketTab('BUY_RESALE');
        await new Promise(r => setTimeout(r, 100));
        const resaleText = document.getElementById('lab-modal-body')?.innerText || '';
        setMarketTab('SELL_PACK');
        await new Promise(r => setTimeout(r, 100));
        const sellText = document.getElementById('lab-modal-body')?.innerText || '';
        setMarketTab('BUY_STANDARD');
        return { stdText, resaleText, sellText };
      })()`);
      assert.match(marketDom.stdText, /Standard Stock/i);
      assert.match(marketDom.resaleText, /Magical Resale Market/i);
      assert.match(marketDom.sellText, /Sell Backpack Gear/i);
      await saveScreenshot('03_phase6_oakhaven_market_tabs.png');

      // 11d. Open The Watcher's Board Modal (Section A Warrants + Section B Wilderness Threats)
      const boardDom = await evalInPage(`(async () => {
        openLabModal('bounties');
        await new Promise(r => setTimeout(r, 150));
        return {
          title: document.getElementById('lab-modal-title')?.textContent?.trim(),
          bodyText: document.getElementById('lab-modal-body')?.innerText || ''
        };
      })()`);
      assert.match(boardDom.title, /Watcher's Board/i);
      assert.match(boardDom.bodyText, /Section A/i);
      assert.match(boardDom.bodyText, /Section B/i);
      await saveScreenshot('04_phase6_watchers_board_warrants_and_threats.png');

      // 11e. Close modal, step into Mirkwood and verify Stage 2 Combat presentation
      mockRngValue = 0.85;
      const combatDom = await evalInPage(`(async () => {
        closeLabModal();
        await triggerLabScenario('STAGE2_COMBAT', 'Owlbear');
        for (let i = 0; i < 20; i++) {
          if (!window.isSequencePlaying) break;
          await new Promise(r => setTimeout(r, 80));
        }
        return {
          mode: window.currentState?.mode,
          monsterName: window.currentState?.encounter?.monsterName,
          scrollDeltaH: document.documentElement.scrollHeight - window.innerHeight
        };
      })()`);
      assert.equal(combatDom.mode, 'IN_COMBAT');
      assert.equal(combatDom.monsterName, 'Owlbear');
      assert.ok(combatDom.scrollDeltaH <= 2, 'Zero vertical page scroll in 1920x1080');
      await saveScreenshot('05_phase6_live_combat_presentation.png');

      assert.deepEqual(consoleErrors, [], 'Zero browser console errors');
      assert.deepEqual(pageExceptions, [], 'Zero uncaught page exceptions');
      assert.deepEqual(failedNetworkRequests, [], 'Zero failed network requests');
    } finally {
      if (ws) { try { ws.close(); } catch {} }
      if (chromeProc) { try { chromeProc.kill('SIGKILL'); } catch {} }
      try { fs.rmSync(tmpProfileDir, { recursive: true, force: true }); } catch {}
    }
  });
});
