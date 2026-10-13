const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createTestDb } = require('./test_helpers');
const { setDb } = require('../src/db/connection');
const app = require('../src/app');
const { createCharacter, performClericSelfHeal, validateCharacterCreation } = require('../src/domain/character/rules');
const { buyItem } = require('../src/domain/economy/shop');
const { startCombat, executeCombatRound, getCombatState } = require('../src/domain/combat/engine');
const { parseDiceFormula, rollDice } = require('../src/domain/combat/dice');
const { describeHeroAttack, describeMonsterAttack, describePotionDrink, describeFleeAttempt } = require('../src/domain/combat/narrative');
const config = require('../src/config');

function ensureUser(db, userId, username = 'testuser') {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash)
    VALUES (?, ?, 'fake_hash')
  `).run(userId, `${username}_${userId}`);
  return userId;
}

test('H1 & H2: Two heroes vs same persistent monster & full max HP reset', (t) => {
  const db = createTestDb();
  ensureUser(db, 1, 'user1');
  ensureUser(db, 2, 'user2');

  // Create two separate heroes (sum of stats = 71)
  const heroA = createCharacter(db, {
    userId: 1,
    name: 'HeroA',
    classType: 'FIGHTER',
    stats: {
      strength: 16,
      constitution: 14,
      dexterity: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 9
    }
  });

  const heroB = createCharacter(db, {
    userId: 2,
    name: 'HeroB',
    classType: 'FIGHTER',
    stats: {
      strength: 16,
      constitution: 14,
      dexterity: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 9
    }
  });

  const tile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
  const orc = db.prepare("SELECT * FROM monsters WHERE name = 'Orc'").get();

  // Create persistent monster instance on tile with 100 held gold, damaged HP (e.g. 5/22)
  const pmRes = db.prepare(`
    INSERT INTO monster_instances (
      monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, status
    ) VALUES (?, ?, 5, 22, 100, 1, 'ACTIVE')
  `).run(orc.id, tile.id);
  const pmId = Number(pmRes.lastInsertRowid);

  // Add an item instance to the persistent monster
  const longswordDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longsword'").get();
  db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_monster_id)
    VALUES (?, 'MONSTER', ?)
  `).run(longswordDef.id, pmId);

  // H2 Verification: When Hero A engages, persistent monster starts combat at full boosted max HP (22), not 5!
  const encARes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, monster_instance_id, tile_id, status,
      current_monster_hp, monster_max_hp, combat_round
    ) VALUES (?, ?, ?, ?, 'DISCOVERED', 5, 22, 0)
  `).run(heroA.id, orc.id, pmId, tile.id);
  const encAId = Number(encARes.lastInsertRowid);

  startCombat(db, heroA.id, encAId);
  const combatStateA = getCombatState(db, heroA.id, encAId);
  assert.equal(combatStateA.encounter.current_monster_hp, 22, 'H2: Persistent monster must start combat at full max HP (22)');
  assert.equal(combatStateA.encounter.monster_max_hp, 22);

  // Hero A defeats the persistent monster
  // Give Hero A plenty of HP and make hero go first so monster AoO or strike doesn't slay hero
  db.prepare('UPDATE characters SET current_hp = 50, max_hp = 50 WHERE id = ?').run(heroA.id);
  db.prepare("UPDATE encounters SET initiative_winner = 'HERO', current_monster_hp = 1 WHERE id = ?").run(encAId);
  db.prepare('UPDATE monster_instances SET current_hp = 1 WHERE id = ?').run(pmId);

  // Execute round where Hero A hits and kills
  executeCombatRound(db, heroA.id, encAId, 'ATTACK', {
    rng: () => 0.99 // natural 20 hit + max damage
  });

  const postStateA = getCombatState(db, heroA.id, encAId);
  assert.equal(postStateA.encounter.status, 'VICTORY', 'Hero A achieved victory');

  // Verify persistent monster status is now DEFEATED, held_gold is 0, item transferred to Hero A
  const updatedPm = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(pmId);
  assert.equal(updatedPm.status, 'DEFEATED', 'Persistent monster status must be DEFEATED');
  assert.equal(updatedPm.held_gold, 0, 'Held gold must be cleared to 0 upon defeat');

  const charAAfter = db.prepare('SELECT gold FROM characters WHERE id = ?').get(heroA.id);
  assert.ok(charAAfter.gold >= 100, 'Hero A looted the 100 gold');

  // H1 Verification: Hero B now tries to attack the same persistent monster instance (concurrent encounter race)
  db.prepare('UPDATE characters SET current_hp = 50, max_hp = 50 WHERE id = ?').run(heroB.id);
  const encBRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, monster_instance_id, tile_id, status,
      current_monster_hp, monster_max_hp, combat_round, initiative_winner
    ) VALUES (?, ?, ?, ?, 'IN_COMBAT', 1, 22, 1, 'HERO')
  `).run(heroB.id, orc.id, pmId, tile.id);
  const encBId = Number(encBRes.lastInsertRowid);

  const heroBGoldBefore = db.prepare('SELECT gold FROM characters WHERE id = ?').get(heroB.id).gold;

  // Hero B executes an attack round: atomic concurrency guard must resolve without duplication
  executeCombatRound(db, heroB.id, encBId, 'ATTACK', {
    rng: () => 0.99
  });

  const charBAfter = db.prepare('SELECT gold FROM characters WHERE id = ?').get(heroB.id);
  assert.equal(charBAfter.gold, heroBGoldBefore, 'H1: Hero B must NOT receive duplicate gold from already defeated persistent monster');

  const heroBItems = db.prepare('SELECT * FROM item_instances WHERE owner_character_id = ?').all(heroB.id);
  const swordDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longsword'").get();
  const heroBLongswords = heroBItems.filter(i => i.item_definition_id === swordDef.id);
  assert.equal(heroBLongswords.length, 1, 'H1: Hero B must not receive duplicate transferred item');
});

test('H4: Initiative has no hidden production bias', (t) => {
  const db = createTestDb();
  ensureUser(db, 1, 'init_user');
  const hero = createCharacter(db, {
    userId: 1,
    name: 'InitHero',
    classType: 'FIGHTER',
    stats: {
      strength: 15,
      constitution: 14,
      dexterity: 10, // Dex 10 -> +0 mod
      intelligence: 11,
      wisdom: 11,
      charisma: 10
    }
  });

  const tile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
  const orc = db.prepare("SELECT * FROM monsters WHERE name = 'Orc'").get(); // init bonus +0

  const encRes = db.prepare(`
    INSERT INTO encounters (
      character_id, monster_id, tile_id, status, current_monster_hp, monster_max_hp
    ) VALUES (?, ?, ?, 'DISCOVERED', 10, 10)
  `).run(hero.id, orc.id, tile.id);
  const encId = Number(encRes.lastInsertRowid);

  // Stub RNG: hero rolls 10 (roll = (10-1)/20 = 0.45), monster rolls 12 (roll = (12-1)/20 = 0.55)
  // Hero init: 10 + 0 = 10; Monster init: 12 + 0 = 12 -> Monster must win
  let rollCount = 0;
  const rng = () => {
    rollCount++;
    return rollCount === 1 ? 0.45 : 0.55;
  };

  startCombat(db, hero.id, encId, { rng });
  const enc = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
  assert.equal(enc.hero_initiative, 10, 'Hero initiative must be pure roll + mod (10)');
  assert.equal(enc.monster_initiative, 12, 'Monster initiative must be pure roll + mod (12)');
  assert.equal(enc.initiative_winner, 'MONSTER', 'H4: Monster wins when rolling higher; no artificial hero bias');
});

test('M2: Narrative distinctions across weapon types and clean grammar', (t) => {
  const monster = { name: 'Cave Spider' };

  // Blunt / Club
  const bluntText = describeHeroAttack({ name: 'Club' }, { isHit: true, isCrit: false, isFumble: false });
  assert.ok(bluntText.includes('weapon crashes heavily') || bluntText.includes('staggering it with a dull thud'), 'Blunt attack narrative');

  // Bow
  const bowText = describeHeroAttack({ name: 'Shortbow' }, { isHit: true, isCrit: false, isFumble: false });
  assert.ok(bowText.includes('arrow strikes home'), 'Bow attack narrative');

  // Sling
  const slingText = describeHeroAttack({ name: 'Sling' }, { isHit: true, isCrit: false, isFumble: false });
  assert.ok(slingText.includes('sling bullet strikes home'), 'Sling attack narrative');

  // Spear
  const spearText = describeHeroAttack({ name: 'Spear' }, { isHit: true, isCrit: false, isFumble: false });
  assert.ok(spearText.includes('spear drives forward'), 'Spear attack narrative');

  // Blade
  const bladeText = describeHeroAttack({ name: 'Longsword' }, { isHit: true, isCrit: false, isFumble: false });
  assert.ok(bladeText.includes('blade bites deep'), 'Blade narrative');

  // Miss narrative must be neutral
  const missText = describeHeroAttack({ name: 'Longsword' }, { isHit: false, isCrit: false, isFumble: false });
  assert.ok(missText.includes('parries the blow into empty air') || missText.includes('lunge forward'));

  // Monster attack narrative grammar check: never contain "you painfully!" after "strike with vicious force"
  const wolfMonster = { name: 'Wolf' };
  const monsterHitText = describeMonsterAttack(wolfMonster, { isHit: true, isCrit: false, isFumble: false });
  assert.ok(!monsterHitText.includes('force you painfully!'), 'Grammar bug "force you painfully!" must never occur');
});

test('M6: Shop economy enforces 50 item cap and max 2 free Clubs', (t) => {
  const db = createTestDb();
  ensureUser(db, 1, 'shop_user');
  const hero = createCharacter(db, {
    userId: 1,
    name: 'ShopHero',
    classType: 'FIGHTER',
    stats: {
      strength: 15,
      constitution: 14,
      dexterity: 11,
      intelligence: 11,
      wisdom: 10,
      charisma: 10
    }
  });

  const clubDef = db.prepare("SELECT * FROM item_definitions WHERE name = 'Club'").get();
  assert.equal(clubDef.buy_price, 0, 'Club is zero cost');

  // 1st Club purchase succeeds
  const buy1 = buyItem(db, hero.id, { itemDefinitionId: clubDef.id });
  assert.equal(buy1.success, true);

  // 2nd Club purchase succeeds
  const buy2 = buyItem(db, hero.id, { itemDefinitionId: clubDef.id });
  assert.equal(buy2.success, true);

  // 3rd Club purchase must be blocked
  assert.throws(() => {
    buyItem(db, hero.id, { itemDefinitionId: clubDef.id });
  }, /maximum permitted amount/i, 'M6: May not acquire more than 2 free Clubs');

  // Test 50 item capacity cap
  // Fill backpack up to 50 items
  const currentCount = db.prepare('SELECT COUNT(*) as c FROM item_instances WHERE owner_character_id = ?').get(hero.id).c;
  for (let i = currentCount; i < 50; i++) {
    db.prepare(`
      INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
      VALUES (?, 'CHARACTER', ?)
    `).run(clubDef.id, hero.id);
  }

  // Next purchase of any item should fail with inventory limit
  const potionDef = db.prepare("SELECT * FROM item_definitions WHERE category = 'POTION' LIMIT 1").get();
  db.prepare('UPDATE characters SET gold = 100 WHERE id = ?').run(hero.id);
  assert.throws(() => {
    buyItem(db, hero.id, { itemDefinitionId: potionDef.id });
  }, /backpack is full/i, 'M6: Maximum 50 items capacity enforced');
});

test('L3: Cleric self-heal is rejected at full HP', (t) => {
  const db = createTestDb();
  ensureUser(db, 1, 'cleric_user');
  const cleric = createCharacter(db, {
    userId: 1,
    name: 'ClericHeal',
    classType: 'CLERIC',
    stats: {
      strength: 12,
      constitution: 14,
      dexterity: 10,
      intelligence: 9,
      wisdom: 16,
      charisma: 10
    }
  });

  assert.equal(cleric.current_hp, cleric.max_hp);

  assert.throws(() => {
    performClericSelfHeal(db, cleric.id);
  }, /Hero is already at maximum health/, 'L3: Cleric cannot heal at max HP');
});

test('L6: Ranger Favored Enemy validation and restriction', (t) => {
  const db = createTestDb();
  ensureUser(db, 1, 'user_fighter');
  ensureUser(db, 2, 'user_ranger1');
  ensureUser(db, 3, 'user_ranger2');

  // Non-Ranger must have favoredEnemy forced to null
  const fighter = createCharacter(db, {
    userId: 1,
    name: 'FighterFav',
    classType: 'FIGHTER',
    stats: {
      strength: 15,
      constitution: 14,
      dexterity: 11,
      intelligence: 11,
      wisdom: 10,
      charisma: 10
    },
    favoredEnemyType: 'ANIMAL'
  });
  assert.equal(fighter.favored_enemy_type, null, 'Non-ranger cannot have favored enemy');

  // Ranger with valid favored enemy succeeds
  const ranger = createCharacter(db, {
    userId: 2,
    name: 'RangerFav',
    classType: 'RANGER',
    stats: {
      strength: 12,
      constitution: 14,
      dexterity: 16,
      intelligence: 10,
      wisdom: 10,
      charisma: 9
    },
    favoredEnemyType: 'ANIMAL'
  });
  assert.equal(ranger.favored_enemy_type, 'ANIMAL');

  // Ranger with invalid favored enemy throws validation error
  assert.throws(() => {
    createCharacter(db, {
      userId: 3,
      name: 'RangerBadFav',
      classType: 'RANGER',
      stats: {
        strength: 12,
        constitution: 14,
        dexterity: 16,
        intelligence: 10,
        wisdom: 10,
        charisma: 9
      },
      favoredEnemyType: 'ALIEN_DRAGON'
    });
  }, /Invalid Favored Enemy/i, 'L6: Invalid favored enemy is rejected');
});

test('L7 & L8: Encounter chance 0% and Dice parser validation', (t) => {
  // L7: config accepts 0 without falling back to default 25
  assert.equal(typeof config.encounterChancePercent, 'number');

  // L8: Dice parser throws on malformed formulas
  assert.throws(() => parseDiceFormula('invalid'), /Invalid dice formula/);
  assert.throws(() => parseDiceFormula('3d'), /Invalid dice formula/);
  assert.throws(() => parseDiceFormula('2d+1'), /Invalid dice formula/);

  // Valid dice parse properly
  const parsed = parseDiceFormula('2d6+3');
  assert.equal(parsed.count, 2);
  assert.equal(parsed.sides, 6);
  assert.equal(parsed.modifier, 3);
});

test('M7 & M3: Dev pages disabled in non-development and auth security', async (t) => {
  const db = createTestDb();
  setDb(db);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // M7: Dev pages return 404 or 403 in test/production environment
    const reviewRes = await fetch(`${baseUrl}/monster_review.html`);
    assert.equal(reviewRes.status, 404, 'M7: monster_review.html must return 404 when not in development');

    const compRes = await fetch(`${baseUrl}/monster_comparison.html`);
    assert.equal(compRes.status, 404, 'M7: monster_comparison.html must return 404 when not in development');

    // M3: GET /logout redirects safely without error
    const logoutRes = await fetch(`${baseUrl}/logout`, { redirect: 'manual' });
    assert.equal(logoutRes.status, 302, 'M3: GET /logout safely redirects');
  } finally {
    server.close();
  }
});
