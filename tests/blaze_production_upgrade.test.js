/**
 * Darkgrid RPG — Firebase Blaze Production Upgrade & Security Test Suite
 *
 * Covers all 15 required test categories from Section 9 and all 7 mandatory
 * Acceptance Tests (Próf 1 through Próf 7):
 *  - Próf 1: Two players attempt to buy the same market listing simultaneously; only one succeeds.
 *  - Próf 2: Player A kills a persistent monster; Player B cannot resurrect it with stale state or get double rewards.
 *  - Próf 3: Player accepts a Bounty contract, reloads the page (and syncs state), and the contract persists.
 *  - Próf 4: Player dies and permadeath is saved; reload, stale state import, or DB update cannot resurrect the hero.
 *  - Próf 5: Server and database restart; all saved data and active user sessions remain intact.
 *  - Próf 6: Player attempts to send tampered HP, gold, XP, or damage from the browser; server rejects with HTTP 400.
 *  - Próf 7: Player rapidly double-clicks a combat or shop button; action does not execute twice.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { createTestDb } = require('./test_helpers');
const { setDb, getDb, closeDb } = require('../src/db/connection');
const app = require('../src/app');
const { loginUser } = require('../src/domain/auth/service');
const { buyItem, sellItem } = require('../src/domain/economy/shop');
const { checkTileEncounter, investigateEncounter, ignoreEncounter, getActiveEncounterForCharacter } = require('../src/domain/encounters/engine');
const { executeCombatRound, startCombat } = require('../src/domain/combat/engine');
const { handlePlayerDeath, handleMonsterDefeat } = require('../src/domain/monsters/persistence');
const {
  exportDynamicState,
  importDynamicState,
  verifySnapshotIntegrity,
  saveSnapshotToFile,
  restoreSnapshotFromFile,
  uidToNumericId
} = require('../src/db/durable-store');
const { restoreFromBackupObject, verifyBackupFile } = require('../scripts/restore_database');
const { migrateFirestoreCollectionsToSqlite } = require('../scripts/migrate_from_firestore');
const { getRecentSecurityLogs } = require('../src/utils/logger');

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

async function registerAndCreateHero(username, heroName, classType = 'FIGHTER') {
  let cookie = '';
  const getReg = await fetch(`${baseUrl}/register`);
  cookie = updateCookies(cookie, getReg);
  const regHtml = await getReg.text();
  let csrf = regHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

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
  assert.equal(regRes.status, 302);
  cookie = updateCookies(cookie, regRes);

  const createPage = await fetch(`${baseUrl}/character/create`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, createPage);
  const createHtml = await createPage.text();
  csrf = createHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const statsByClass = {
    FIGHTER: { strength: '16', constitution: '13', dexterity: '12', intelligence: '10', wisdom: '10', charisma: '10' },
    RANGER: { strength: '12', constitution: '10', dexterity: '16', intelligence: '10', wisdom: '13', charisma: '10' },
    CLERIC: { strength: '12', constitution: '12', dexterity: '10', intelligence: '10', wisdom: '16', charisma: '11' }
  };

  const createRes = await fetch(`${baseUrl}/character/create`, {
    method: 'POST',
    body: new URLSearchParams({
      name: heroName,
      classType,
      ...statsByClass[classType],
      _csrf: csrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    redirect: 'manual'
  });
  assert.equal(createRes.status, 302);
  assert.equal(createRes.headers.get('location'), '/game');
  cookie = updateCookies(cookie, createRes);

  const gamePage = await fetch(`${baseUrl}/game`, { headers: { Cookie: cookie } });
  cookie = updateCookies(cookie, gamePage);
  const gameHtml = await gamePage.text();
  csrf = gameHtml.match(/name="_csrf"\s+value="([^"]+)"/)[1];

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const character = db.prepare('SELECT * FROM characters WHERE user_id = ? AND is_alive = 1').get(user.id);

  return { cookie, csrf, user, character };
}

test('Próf 1: Two players attempt to buy the same market item simultaneously — only one succeeds', async () => {
  const db = getDb();
  const seller = await registerAndCreateHero('SellerP1', 'SellerHero', 'FIGHTER');
  const buyerA = await registerAndCreateHero('BuyerAP1', 'BuyerAHero', 'FIGHTER');
  const buyerB = await registerAndCreateHero('BuyerBP1', 'BuyerBHero', 'RANGER');

  // Give Seller an unequipped magical item and sell it to the Global Resale Market
  const magicDef = db.prepare('SELECT * FROM item_definitions WHERE is_magical = 1 AND category != \'POTION\' LIMIT 1').get();
  assert.ok(magicDef, 'Should find a magical item definition');

  const itemInsert = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, NULL)
  `).run(magicDef.id, seller.character.id);
  const magicInstanceId = Number(itemInsert.lastInsertRowid);

  const sellRes = sellItem(db, seller.character.id, magicInstanceId);
  assert.equal(sellRes.movedToMarket, true);

  const listing = db.prepare('SELECT * FROM market_listings WHERE item_instance_id = ? AND status = \'ACTIVE\'').get(magicInstanceId);
  assert.ok(listing, 'Magical item should be listed as ACTIVE on the global market');

  // Give both Buyer A and Buyer B enough gold to afford the listing
  const startGold = listing.price + 500;
  db.prepare('UPDATE characters SET gold = ? WHERE id IN (?, ?)').run(startGold, buyerA.character.id, buyerB.character.id);

  // Both Buyer A and Buyer B attempt to buy the exact same listing simultaneously via HTTP POST
  const [resA, resB] = await Promise.all([
    fetch(`${baseUrl}/game/shop/buy`, {
      method: 'POST',
      body: new URLSearchParams({ listingId: String(listing.id), _csrf: buyerA.csrf }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: buyerA.cookie },
      redirect: 'manual'
    }),
    fetch(`${baseUrl}/game/shop/buy`, {
      method: 'POST',
      body: new URLSearchParams({ listingId: String(listing.id), _csrf: buyerB.csrf }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: buyerB.cookie },
      redirect: 'manual'
    })
  ]);

  assert.equal(resA.status, 302);
  assert.equal(resB.status, 302);

  const locA = decodeURIComponent(resA.headers.get('location') || '');
  const locB = decodeURIComponent(resB.headers.get('location') || '');

  const aSucceeded = locA.includes('Purchased');
  const bSucceeded = locB.includes('Purchased');

  // Exactly ONE buyer must succeed, and the other must receive the already-acquired error
  assert.notEqual(aSucceeded, bSucceeded, 'Exactly one of the two concurrent buyers must succeed');

  const winnerId = aSucceeded ? buyerA.character.id : buyerB.character.id;
  const loserId = aSucceeded ? buyerB.character.id : buyerA.character.id;

  const updatedWinner = db.prepare('SELECT gold FROM characters WHERE id = ?').get(winnerId);
  const updatedLoser = db.prepare('SELECT gold FROM characters WHERE id = ?').get(loserId);
  assert.equal(updatedWinner.gold, startGold - listing.price, 'Winner should have gold deducted exactly once');
  assert.equal(updatedLoser.gold, startGold, 'Loser must not have any gold deducted');

  const updatedItem = db.prepare('SELECT * FROM item_instances WHERE id = ?').get(magicInstanceId);
  assert.equal(updatedItem.owner_type, 'CHARACTER');
  assert.equal(updatedItem.owner_character_id, winnerId, 'Unique item instance must belong exclusively to the winner');

  const updatedListing = db.prepare('SELECT * FROM market_listings WHERE id = ?').get(listing.id);
  assert.equal(updatedListing.status, 'SOLD');
  assert.equal(updatedListing.buyer_character_id, winnerId);

  // Verify database trigger also blocks reverting SOLD -> ACTIVE
  assert.throws(() => {
    db.prepare("UPDATE market_listings SET status = 'ACTIVE' WHERE id = ?").run(listing.id);
  }, /Completed market listing cannot be reactivated/);
});

test('Próf 2: Player A kills a persistent monster — Player B cannot resurrect it with stale state or claim double rewards', async () => {
  const db = getDb();
  const fallenHero = await registerAndCreateHero('FallenP2', 'FallenKnight', 'FIGHTER');
  const playerA = await registerAndCreateHero('SlayerAP2', 'SlayerA', 'FIGHTER');
  const playerB = await registerAndCreateHero('SlayerBP2', 'SlayerB', 'FIGHTER');

  const wildernessTile = db.prepare('SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1').get();
  const baseMonster = db.prepare('SELECT * FROM monsters WHERE challenge_rating <= 1 ORDER BY id ASC LIMIT 1').get();

  db.prepare('UPDATE characters SET tile_id = ?, gold = 200 WHERE id = ?').run(wildernessTile.id, fallenHero.character.id);
  const encFallen = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round)
    VALUES (?, ?, ?, 'IN_COMBAT', ?, ?, 1)
  `).run(fallenHero.character.id, wildernessTile.id, baseMonster.id, baseMonster.base_hp, baseMonster.base_hp);

  const deathRes = handlePlayerDeath(
    db,
    { ...fallenHero.character, tile_id: wildernessTile.id, gold: 200 },
    { id: Number(encFallen.lastInsertRowid), tile_id: wildernessTile.id, monster_id: baseMonster.id, base_hp: baseMonster.base_hp, combat_round: 1 },
    baseMonster,
    null,
    { rng: () => 0.2 } // transfer items
  );

  const pmId = deathRes.instanceId;
  assert.ok(pmId, 'Persistent monster instance should be created');
  const pmBefore = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(pmId);
  assert.equal(pmBefore.status, 'ACTIVE');
  assert.equal(pmBefore.held_gold, 100);

  // Capture a stale snapshot while the persistent monster is still ACTIVE
  const staleSnapshot = exportDynamicState(db);

  // Both Player A and Player B move onto the tile and discover the persistent monster
  db.prepare('UPDATE characters SET tile_id = ?, strength = 20, current_hp = 50, max_hp = 50 WHERE id IN (?, ?)').run(
    wildernessTile.id,
    playerA.character.id,
    playerB.character.id
  );

  const encA = checkTileEncounter(db, { ...playerA.character, tile_id: wildernessTile.id }, wildernessTile);
  const encB = checkTileEncounter(db, { ...playerB.character, tile_id: wildernessTile.id }, wildernessTile);
  assert.equal(encA.monster_instance_id, pmId);
  assert.equal(encB.monster_instance_id, pmId);

  // Both enter combat before either kills it
  startCombat(db, playerA.character.id, encA.id, { rng: () => 0.9 });
  startCombat(db, playerB.character.id, encB.id, { rng: () => 0.9 });

  // Set persistent monster HP to 1 in Player A's encounter so Player A kills it on the next swing
  db.prepare('UPDATE encounters SET current_monster_hp = 1, initiative_winner = \'HERO\' WHERE id = ?').run(encA.id);
  db.prepare('UPDATE encounters SET current_monster_hp = 1, initiative_winner = \'HERO\' WHERE id = ?').run(encB.id);

  const goldABefore = db.prepare('SELECT gold FROM characters WHERE id = ?').get(playerA.character.id).gold;
  const goldBBefore = db.prepare('SELECT gold FROM characters WHERE id = ?').get(playerB.character.id).gold;

  // Player A strikes and kills the persistent monster
  const stateA = executeCombatRound(db, playerA.character.id, encA.id, 'ATTACK', { rng: () => 0.95 });
  assert.equal(stateA.encounter.status, 'VICTORY');

  const goldAAfter = db.prepare('SELECT gold FROM characters WHERE id = ?').get(playerA.character.id).gold;
  assert.equal(goldAAfter, goldABefore + 100, 'Player A should receive the 100 held gold from the persistent monster');

  const pmAfterA = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(pmId);
  assert.equal(pmAfterA.status, 'DEFEATED');
  assert.equal(pmAfterA.held_gold, 0);

  // Now Player B attempts to attack in their stale combat session
  const stateB = executeCombatRound(db, playerB.character.id, encB.id, 'ATTACK', { rng: () => 0.95 });
  assert.equal(stateB.encounter.status, 'VICTORY');
  const goldBAfter = db.prepare('SELECT gold FROM characters WHERE id = ?').get(playerB.character.id).gold;
  assert.equal(goldBAfter, goldBBefore, 'Player B must receive 0 gold (no double reward)');

  // Now test importing the stale snapshot where the persistent monster was still ACTIVE
  importDynamicState(db, staleSnapshot);
  const pmAfterStaleImport = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(pmId);
  assert.equal(pmAfterStaleImport.status, 'DEFEATED', 'Stale snapshot import must NEVER resurrect a DEFEATED persistent monster');
  assert.equal(pmAfterStaleImport.held_gold, 0, 'Defeated monster held_gold must remain 0');

  // Also verify SQLite trigger blocks direct SQL resurrection
  assert.throws(() => {
    db.prepare("UPDATE monster_instances SET status = 'ACTIVE' WHERE id = ?").run(pmId);
  }, /Defeated persistent monster cannot be resurrected/);
});

test('Próf 3: Player accepts a Bounty contract, reloads the page (and syncs state), and the contract persists', async () => {
  const db = getDb();
  const hunter = await registerAndCreateHero('BountyHunterP3', 'Vaelen', 'RANGER');

  // 1. Load /game in Oakhaven to generate Watcher's Board contracts
  const res1 = await fetch(`${baseUrl}/game`, { headers: { Cookie: hunter.cookie } });
  assert.equal(res1.status, 200);

  const contracts = db.prepare('SELECT * FROM hunting_contracts WHERE character_id = ? AND status = \'AVAILABLE\'').all(hunter.character.id);
  assert.ok(contracts.length > 0, 'Oakhaven Watcher\'s Board should generate available contracts');
  const chosen = contracts[0];

  // 2. Accept the contract via POST /game/bounties/accept
  const acceptRes = await fetch(`${baseUrl}/game/bounties/accept`, {
    method: 'POST',
    body: new URLSearchParams({
      contractId: String(chosen.id),
      returnModal: 'bounties',
      _csrf: hunter.csrf
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: hunter.cookie },
    redirect: 'manual'
  });
  assert.equal(acceptRes.status, 302);

  // 3. Reload /game (simulating F5 page refresh)
  const reloadRes = await fetch(`${baseUrl}/game`, { headers: { Cookie: hunter.cookie } });
  assert.equal(reloadRes.status, 200);
  const reloadHtml = await reloadRes.text();
  assert.ok(reloadHtml.includes(chosen.region_name), 'Reloaded page must display the active bounty contract region');

  // 4. Export state, wipe hunting_contracts in a fresh DB, and re-import to verify durable persistence
  const snap = exportDynamicState(db);
  const freshDb = createTestDb();
  importDynamicState(freshDb, snap);
  const restoredContract = freshDb.prepare('SELECT * FROM hunting_contracts WHERE id = ?').get(chosen.id);
  assert.ok(restoredContract, 'Hunting contract must be preserved in durable snapshot');
  assert.equal(restoredContract.status, 'ACTIVE');
  assert.equal(restoredContract.custom_name, chosen.custom_name);
  assert.equal(restoredContract.boosted_max_hp, chosen.boosted_max_hp);
  assert.equal(restoredContract.reward_gold, chosen.reward_gold);
  freshDb.close();
});

test('Próf 4: Player dies and permadeath is saved — reload, action requests, or stale state cannot resurrect the hero', async () => {
  const db = getDb();
  const doomed = await registerAndCreateHero('DoomedP4', 'Boromir', 'FIGHTER');

  // Capture snapshot while Boromir is alive
  const aliveSnapshot = exportDynamicState(db);

  // Move Boromir out of Oakhaven and trigger lethal combat
  const wildTile = db.prepare('SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1').get();
  const monster = db.prepare('SELECT * FROM monsters ORDER BY challenge_rating DESC LIMIT 1').get();
  db.prepare('UPDATE characters SET tile_id = ?, current_hp = 1, dexterity = 1 WHERE id = ?').run(wildTile.id, doomed.character.id);

  const encInsert = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp,
      combat_round, initiative_winner
    ) VALUES (?, ?, ?, 'IN_COMBAT', 500, 500, 2, 'MONSTER')
  `).run(doomed.character.id, wildTile.id, monster.id);
  const encounterId = Number(encInsert.lastInsertRowid);

  // Execute combat round via HTTP POST where monster attacks first and slays Boromir
  // (Loop up to 5 rounds in case the monster rolls a 1-in-20 natural 1 miss)
  let atkRes;
  for (let r = 2; r <= 6; r++) {
    atkRes = await fetch(`${baseUrl}/game/combat/attack`, {
      method: 'POST',
      body: new URLSearchParams({
        encounterId: String(encounterId),
        round: String(r),
        _csrf: doomed.csrf
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: doomed.cookie },
      redirect: 'manual'
    });
    if (atkRes.headers.get('location') === '/game/fallen') {
      break;
    }
  }
  assert.equal(atkRes.status, 302);
  assert.equal(atkRes.headers.get('location'), '/game/fallen');

  const charAfterDeath = db.prepare('SELECT * FROM characters WHERE id = ?').get(doomed.character.id);
  assert.equal(charAfterDeath.is_alive, 0, 'Character must be marked dead (is_alive = 0)');
  assert.equal(charAfterDeath.current_hp, 0);

  // Reloading /game (F5) must redirect to /game/fallen and NEVER resurrect the character
  const reloadRes = await fetch(`${baseUrl}/game`, {
    headers: { Cookie: doomed.cookie },
    redirect: 'manual'
  });
  assert.equal(reloadRes.status, 302);
  assert.equal(reloadRes.headers.get('location'), '/game/fallen');

  // Attempting to move after death must not change tile_id
  const moveAttempt = await fetch(`${baseUrl}/game/move`, {
    method: 'POST',
    body: new URLSearchParams({ direction: 'NORTH', _csrf: doomed.csrf }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: doomed.cookie },
    redirect: 'manual'
  });
  assert.equal(moveAttempt.status, 302);
  const charAfterMoveAttempt = db.prepare('SELECT * FROM characters WHERE id = ?').get(doomed.character.id);
  assert.equal(charAfterMoveAttempt.is_alive, 0);
  assert.equal(charAfterMoveAttempt.tile_id, wildTile.id, 'Dead character must not be able to move');

  // Importing a stale snapshot where Boromir was alive must NOT resurrect him
  importDynamicState(db, aliveSnapshot);
  const charAfterStaleImport = db.prepare('SELECT * FROM characters WHERE id = ?').get(doomed.character.id);
  assert.equal(charAfterStaleImport.is_alive, 0, 'Stale snapshot must never resurrect a dead character');

  // SQLite trigger must also block direct SQL resurrection
  assert.throws(() => {
    db.prepare('UPDATE characters SET is_alive = 1 WHERE id = ?').run(doomed.character.id);
  }, /Permadeath is final/);
});

test('Próf 5: Server and database restart — all saved data and active sessions remain intact', async () => {
  const db = getDb();
  const survivor = await registerAndCreateHero('SurvivorP5', 'Aragorn', 'RANGER');

  // Modify character gold, XP, and level
  db.prepare('UPDATE characters SET gold = 777, xp = 1200, level = 2 WHERE id = ?').run(survivor.character.id);

  // Save durable snapshot to a temporary file
  const tmpFile = path.join(os.tmpdir(), `darkgrid-restart-test-${Date.now()}.json`);
  const saved = saveSnapshotToFile(db, tmpFile);
  assert.ok(saved.checksum);

  // Simulate full server & database restart: close current DB, create a brand-new in-memory DB,
  // run migrations & seeds, and restore from the durable snapshot file
  closeDb();
  const restartedDb = createTestDb();
  setDb(restartedDb);

  const restored = restoreSnapshotFromFile(restartedDb, tmpFile);
  assert.equal(restored.imported, true);
  fs.unlinkSync(tmpFile);

  // Verify character data survived the restart
  const charAfterRestart = restartedDb.prepare('SELECT * FROM characters WHERE id = ?').get(survivor.character.id);
  assert.ok(charAfterRestart);
  assert.equal(charAfterRestart.name, 'Aragorn');
  assert.equal(charAfterRestart.gold, 777);
  assert.equal(charAfterRestart.xp, 1200);
  assert.equal(charAfterRestart.level, 2);

  // Verify the player's HTTP session cookie STILL works without having to log in again!
  const gameRes = await fetch(`${baseUrl}/game`, {
    headers: { Cookie: survivor.cookie },
    redirect: 'manual'
  });
  assert.equal(gameRes.status, 200, 'Session stored in SqliteSessionStore must survive server/DB restart');
  const html = await gameRes.text();
  assert.match(html, /Aragorn/);
  assert.match(html, /777/);
});

test('Próf 6: Player attempts to send tampered HP, gold, XP, damage, or UID from the browser — server rejects with HTTP 400', async () => {
  const db = getDb();
  const cheater = await registerAndCreateHero('CheaterP6', 'SneakyPete', 'FIGHTER');

  const beforeChar = db.prepare('SELECT * FROM characters WHERE id = ?').get(cheater.character.id);

  // 1. Attempt to inject gold, current_hp, and damage into a POST request
  const tamperRes1 = await fetch(`${baseUrl}/game/move`, {
    method: 'POST',
    body: new URLSearchParams({
      direction: 'NORTH',
      gold: '999999',
      current_hp: '9999',
      damage: '5000',
      _csrf: cheater.csrf
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Cookie: cheater.cookie
    }
  });
  assert.equal(tamperRes1.status, 400, 'Server must reject tampered gold/HP/damage fields with HTTP 400');
  const errJson1 = await tamperRes1.json();
  assert.ok(Array.isArray(errJson1.tamperedFields));
  assert.ok(errJson1.tamperedFields.includes('gold'));
  assert.ok(errJson1.tamperedFields.includes('current_hp'));
  assert.ok(errJson1.tamperedFields.includes('damage'));

  // 2. Attempt to spoof uid / character_id in request body
  const tamperRes2 = await fetch(`${baseUrl}/game/rest`, {
    method: 'POST',
    body: new URLSearchParams({
      uid: 'spoofed-firebase-uid',
      character_id: '1',
      _csrf: cheater.csrf
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Cookie: cheater.cookie
    }
  });
  assert.equal(tamperRes2.status, 400, 'Server must reject spoofed uid/character_id in body with HTTP 400');

  // Verify database state was completely untouched
  const afterChar = db.prepare('SELECT * FROM characters WHERE id = ?').get(cheater.character.id);
  assert.equal(afterChar.gold, beforeChar.gold);
  assert.equal(afterChar.current_hp, beforeChar.current_hp);
  assert.equal(afterChar.tile_id, beforeChar.tile_id);

  // Verify security event was logged
  const secLogs = getRecentSecurityLogs();
  assert.ok(secLogs.some(l => l.eventType === 'SECURITY_TAMPER_ATTEMPT'), 'Tamper attempt must be recorded in security logs');
});

test('Próf 7: Player rapidly double-clicks a combat or shop button — action does not execute twice', async () => {
  const db = getDb();
  const shopper = await registerAndCreateHero('DoubleClickP7', 'QuickFingers', 'FIGHTER');

  db.prepare('UPDATE characters SET gold = 100 WHERE id = ?').run(shopper.character.id);
  const potionDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Minor Healing Potion'").get();
  assert.ok(potionDef);

  const idempotencyKey = `buy-potion-${Date.now()}`;

  // Send two identical shop purchase requests with the same X-Idempotency-Key
  const [buy1, buy2] = await Promise.all([
    fetch(`${baseUrl}/game/shop/buy`, {
      method: 'POST',
      body: new URLSearchParams({ itemDefinitionId: String(potionDef.id), _csrf: shopper.csrf }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Idempotency-Key': idempotencyKey,
        Cookie: shopper.cookie
      },
      redirect: 'manual'
    }),
    fetch(`${baseUrl}/game/shop/buy`, {
      method: 'POST',
      body: new URLSearchParams({ itemDefinitionId: String(potionDef.id), _csrf: shopper.csrf }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Idempotency-Key': idempotencyKey,
        Cookie: shopper.cookie
      },
      redirect: 'manual'
    })
  ]);

  assert.equal(buy1.status, 302);
  assert.equal(buy2.status, 302);

  // Only ONE potion should have been bought and gold deducted once
  const charAfterBuy = db.prepare('SELECT gold FROM characters WHERE id = ?').get(shopper.character.id);
  assert.equal(charAfterBuy.gold, 100 - potionDef.buy_price, 'Gold must only be deducted once on double-click');

  // Now test double-clicking Attack on the same combat round (round mismatch guard)
  const wildTile = db.prepare('SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1').get();
  const monster = db.prepare('SELECT * FROM monsters WHERE challenge_rating <= 1 LIMIT 1').get();
  db.prepare('UPDATE characters SET tile_id = ?, current_hp = 50, max_hp = 50 WHERE id = ?').run(wildTile.id, shopper.character.id);

  const encInsert = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp,
      combat_round, initiative_winner
    ) VALUES (?, ?, ?, 'IN_COMBAT', 100, 100, 1, 'HERO')
  `).run(shopper.character.id, wildTile.id, monster.id);
  const encId = Number(encInsert.lastInsertRowid);

  // First attack with round=1 advances round to 2
  const atk1 = await fetch(`${baseUrl}/game/combat/attack`, {
    method: 'POST',
    body: new URLSearchParams({ encounterId: String(encId), round: '1', _csrf: shopper.csrf }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: shopper.cookie },
    redirect: 'manual'
  });
  assert.equal(atk1.status, 302);

  const roundAfter1 = db.prepare('SELECT combat_round FROM encounters WHERE id = ?').get(encId).combat_round;
  assert.equal(roundAfter1, 2);

  // Second duplicate attack still carrying round=1 is rejected by expectedRound guard
  const atk2 = await fetch(`${baseUrl}/game/combat/attack`, {
    method: 'POST',
    body: new URLSearchParams({ encounterId: String(encId), round: '1', _csrf: shopper.csrf }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: shopper.cookie },
    redirect: 'manual'
  });
  assert.equal(atk2.status, 302);
  const roundAfter2 = db.prepare('SELECT combat_round FROM encounters WHERE id = ?').get(encId).combat_round;
  assert.equal(roundAfter2, 2, 'Duplicate combat submission for round 1 must not advance round to 3');
});

test('Migration & Firebase Auth Login Bridge: Migrated Spark accounts retain UIDs/IDs and upgrade password hash on first login', async () => {
  const db = createTestDb();

  const mockCollections = {
    users: [
      { id: 'fbUid_Friend1', data: { uid: 'fbUid_Friend1', username: 'FriendOne', created_at: '2026-04-12T18:00:00Z' } }
    ],
    characters: [
      {
        id: '5001',
        data: {
          user_id: 'fbUid_Friend1',
          name: 'Aldric',
          class: 'CLERIC',
          level: 3,
          xp: 2500,
          gold: 145,
          current_hp: 24,
          max_hp: 24,
          is_alive: 1,
          tile_id: 113,
          strength: 12,
          constitution: 12,
          dexterity: 10,
          intelligence: 10,
          wisdom: 16,
          charisma: 11,
          inventory_json: JSON.stringify([{ id: 9001, item_definition_id: 1, equipped_slot: null }])
        }
      }
    ],
    persistent_monsters: [],
    market_listings: [],
    hunting_contracts: [],
    encounters: []
  };

  const migSummary = migrateFirestoreCollectionsToSqlite(db, mockCollections);
  assert.equal(migSummary.usersMigrated, 1);
  assert.equal(migSummary.charactersMigrated, 1);

  const expectedNumericUserId = uidToNumericId('fbUid_Friend1');
  const migratedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(expectedNumericUserId);
  assert.ok(migratedUser);
  assert.equal(migratedUser.username, 'FriendOne');
  assert.equal(migratedUser.firebase_uid, 'fbUid_Friend1');
  assert.equal(migratedUser.password_hash, 'firebase-auth');

  // Log in as FriendOne using the Firebase Auth bridge verifier
  const loggedIn = await loginUser(db, 'FriendOne', 'friendSecretPass', {
    firebaseVerifier: async (uname, pass) => {
      if (uname === 'FriendOne' && pass === 'friendSecretPass') {
        return { uid: 'fbUid_Friend1', displayName: 'FriendOne' };
      }
      return null;
    }
  });

  assert.equal(loggedIn.id, expectedNumericUserId);
  assert.equal(loggedIn.username, 'FriendOne');

  // Verify password_hash was upgraded from 'firebase-auth' to bcrypt ('$2...')
  const upgradedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(expectedNumericUserId);
  assert.ok(upgradedUser.password_hash.startsWith('$2'), 'Password hash must be upgraded to bcrypt after first login');

  // Subsequent login uses local bcrypt directly without needing Firebase Auth REST call
  const secondLogin = await loginUser(db, 'FriendOne', 'friendSecretPass');
  assert.equal(secondLogin.id, expectedNumericUserId);

  db.close();
});
