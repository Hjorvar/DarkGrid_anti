const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../../src/domain/auth/service');
const { createCharacter, getCharacterPotionCount, getCharacterEquipment, formatModifier } = require('../../src/domain/character/rules');
const { getTileByCoords, validateMovement, getMinimapData, getAvailableDirections } = require('../../src/domain/world/map');
const {
  checkTileEncounter,
  getActiveEncounterForCharacter,
  investigateEncounter,
  ignoreEncounter
} = require('../../src/domain/encounters/engine');
const {
  startCombat,
  getCombatState,
  executeCombatRound,
  getHealthBracket
} = require('../../src/domain/combat/engine');
const {
  resolveAttackRoll,
  resolveDamage,
  calculateHeroAC,
  calculateHeroAttackBonus
} = require('../../src/domain/combat/rules');
const { handlePlayerDeath, handleMonsterDefeat } = require('../../src/domain/monsters/persistence');

// Helper to render game view to HTML string for testing
function renderGame(db, character, currentTile, encounter) {
  return new Promise((resolve, reject) => {
    const minimap = getMinimapData(db, currentTile, 2);
    const directions = getAvailableDirections(db, currentTile);
    const modifiers = {
      strength: formatModifier(character.strength),
      constitution: formatModifier(character.constitution),
      dexterity: formatModifier(character.dexterity),
      intelligence: formatModifier(character.intelligence),
      wisdom: formatModifier(character.wisdom),
      charisma: formatModifier(character.charisma)
    };

    const combatState = encounter ? getCombatState(db, character.id, encounter.id) : null;
    const potionCount = getCharacterPotionCount(db, character.id);
    const equipment = getCharacterEquipment(db, character.id);

    app.render('game', {
      currentUser: { id: character.user_id || 1, username: 'CombatHero' },
      character,
      currentTile,
      minimap,
      directions,
      encounter,
      combatState,
      potionCount,
      equipment,
      modifiers,
      errorMessage: null,
      infoMessage: null
    }, (err, html) => {
      if (err) return reject(err);
      resolve(html);
    });
  });
}

// Deterministic RNG generator
function createRngSequence(sequence) {
  let idx = 0;
  return () => {
    if (idx < sequence.length) {
      return sequence[idx++];
    }
    return 0.5;
  };
}

// Setup helper: creates a user, character, and puts them in an active combat encounter
async function setupCombatScenario(db, username = 'HeroCombat', classType = 'FIGHTER', initiativeWinner = 'HERO') {
  const user = await registerUser(db, username, 'password123');
  const hero = createCharacter(db, {
    userId: user.id,
    name: username,
    classType,
    stats: { strength: 16, constitution: 13, dexterity: 12, intelligence: 11, wisdom: 10, charisma: 10 }
  });

  const forestTile = getTileByCoords(db, 7, 5); // Wild tile
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(forestTile.id, hero.id);
  hero.tile_id = forestTile.id;

  const encounter = checkTileEncounter(db, hero, forestTile, { rng: () => 0.01, ambushRng: () => 0.95 });
  assert.ok(encounter, 'Encounter must be generated');

  const revealed = investigateEncounter(db, hero.id, encounter.id, hero.class);
  assert.equal(revealed.status, 'IN_COMBAT');

  // Enforce deterministic initiative winner for tests
  db.prepare('UPDATE encounters SET initiative_winner = ? WHERE id = ?').run(initiativeWinner, revealed.id);
  revealed.initiative_winner = initiativeWinner;

  return { user, hero, tile: forestTile, encounter: revealed };
}

// =============================================================================
// TEST 1: Player hits monster (damage subtracted, event logged)
// =============================================================================
test('1. Player hits monster: damage subtracted and narrative event logged', async () => {
  const db = createTestDb();
  const { hero, encounter } = await setupCombatScenario(db, 'Attacker1');

  const initialMonsterHp = encounter.current_monster_hp;
  assert.ok(initialMonsterHp > 0);

  // Force hero to roll high (nat 18 on d20) to ensure hit, damage roll mid-range, monster misses
  // rng rolls: [hero attack d20, hero damage dice, monster attack d20]
  const rng = createRngSequence([
    17 / 20 + 0.01, // hero d20: 18 -> hit
    0.5,            // hero damage dice
    0.05            // monster d20: 2 -> miss
  ]);

  const state = executeCombatRound(db, hero.id, encounter.id, 'ATTACK', { rng });

  // Monster HP must decrease
  assert.ok(state.encounter.current_monster_hp < initialMonsterHp, 'Monster HP must be reduced after hit');

  // Combat event must be logged
  const heroAttackEvent = state.events.find(e => e.event_type === 'HERO_ATTACK');
  assert.ok(heroAttackEvent, 'HERO_ATTACK event must be recorded');
  assert.ok(heroAttackEvent.public_text, 'Event text must not be empty');

  // Secrecy: public_text must NOT contain raw damage numbers or dice
  assert.doesNotMatch(heroAttackEvent.public_text, /\d+\s*damage/i, 'Public text must not reveal exact damage numbers');
  assert.doesNotMatch(heroAttackEvent.public_text, /d20/i, 'Public text must not reveal dice rolls');
});

// =============================================================================
// TEST 2: Player misses monster (no damage, miss event logged)
// =============================================================================
test('2. Player misses monster: no damage dealt and miss narrative logged', async () => {
  const db = createTestDb();
  const { hero, encounter } = await setupCombatScenario(db, 'MissHero');

  const initialMonsterHp = encounter.current_monster_hp;

  // Force hero d20 to roll low (e.g. 2), monster misses too
  const rng = createRngSequence([
    0.06, // hero d20: 2 + AB < AC -> miss
    0.05  // monster d20: 2 -> miss
  ]);

  const state = executeCombatRound(db, hero.id, encounter.id, 'ATTACK', { rng });

  // Monster HP must remain identical
  assert.equal(state.encounter.current_monster_hp, initialMonsterHp, 'Monster HP must not change on miss');

  // Combat event must be logged
  const heroAttackEvent = state.events.find(e => e.event_type === 'HERO_ATTACK');
  assert.ok(heroAttackEvent, 'HERO_ATTACK event must be recorded');
  const details = JSON.parse(heroAttackEvent.details || '{}');
  assert.equal(details.isHit, false, 'Details must indicate miss');
  assert.equal(details.damage, 0, 'Details damage must be 0');
});

// =============================================================================
// TEST 3: Natural 1 (fumble) and Natural 20 (crit = 2x damage)
// =============================================================================
test('3. Natural 1 is automatic miss and Natural 20 is critical hit with 2x damage', async () => {
  const db = createTestDb();

  // Test Natural 1: Even with absurdly high AB (+99), roll of 1 is automatic miss
  const rollNat1 = resolveAttackRoll(99, 10, () => 0.01 / 20); // d20 = 1
  assert.equal(rollNat1.d20, 1);
  assert.equal(rollNat1.isNat1, true);
  assert.equal(rollNat1.isHit, false, 'Natural 1 must automatically miss');

  // Test Natural 20: Even with negative AB (-50) vs 100 AC, roll of 20 is automatic hit and crit
  const rollNat20 = resolveAttackRoll(-50, 100, () => 0.999); // d20 = 20
  assert.equal(rollNat20.d20, 20);
  assert.equal(rollNat20.isNat20, true);
  assert.equal(rollNat20.isCrit, true);
  assert.equal(rollNat20.isHit, true, 'Natural 20 must automatically hit');

  // Critical damage calculation: exactly double base damage
  const normalDamage = resolveDamage('1d8+3', false, () => 0.5); // 1d8 rolls 5 + 3 = 8
  const critDamage = resolveDamage('1d8+3', true, () => 0.5);   // 8 * 2 = 16
  assert.equal(critDamage, normalDamage * 2, 'Critical damage must be exactly 2x normal damage');
});

// =============================================================================
// TEST 4: Monster hits and misses player (hero HP reduced on hit, untouched on miss)
// =============================================================================
test('4. Monster hits and misses player: hero HP reduced on hit, untouched on miss', async () => {
  const db = createTestDb();
  const { hero, encounter } = await setupCombatScenario(db, 'MonsterAttacker');

  const initialHeroHp = hero.current_hp;

  // Round 1: Monster hits hero, hero misses
  // Sequence: hero misses, monster hits with non-lethal damage
  const rngHit = createRngSequence([
    0.05, // hero d20: 2 -> miss
    0.80, // monster d20: 17 -> regular hit
    0.1   // monster damage: low
  ]);

  const state1 = executeCombatRound(db, hero.id, encounter.id, 'ATTACK', { rng: rngHit });
  assert.ok(state1.character.current_hp < initialHeroHp, 'Hero HP must be reduced when monster hits');

  const hpAfterHit = state1.character.current_hp;

  // Round 2: Monster misses hero, hero misses
  const rngMiss = createRngSequence([
    0.05, // hero miss
    0.05  // monster miss
  ]);

  const state2 = executeCombatRound(db, hero.id, encounter.id, 'ATTACK', { rng: rngMiss });
  assert.equal(state2.character.current_hp, hpAfterHit, 'Hero HP must remain unchanged when monster misses');
});

// =============================================================================
// TEST 5: Player drinks potion (heals 1d8+1, 1 potion consumed, monster attacks)
// =============================================================================
test('5. Player drinks potion: heals 1d8+1 HP, consumes potion, monster attacks', async () => {
  const db = createTestDb();
  const { hero, encounter } = await setupCombatScenario(db, 'PotionDrinker');

  // Verify initial potion count (new hero starts with 2 Minor Healing Potions)
  assert.equal(getCharacterPotionCount(db, hero.id), 2, 'Hero must start with 2 healing potions');

  // Damage hero so healing is effective without hitting max HP cap
  db.prepare('UPDATE characters SET current_hp = 2 WHERE id = ?').run(hero.id);

  // Drink potion with monster missing retaliatory attack
  // rng sequence: [potion 1d8 roll (0.5 -> 5), monster attack d20 (0.05 -> miss)]
  const rng = createRngSequence([
    0.5,  // potion roll: 1d8 -> 5, plus 1 = 6 heal
    0.05  // monster d20: miss
  ]);

  const state = executeCombatRound(db, hero.id, encounter.id, 'DRINK_POTION', { rng });

  // Hero HP should increase from 2 to 8
  assert.equal(state.character.current_hp, 8, 'Hero HP must increase by potion heal amount (2 + 6 = 8)');

  // Potion count must decrement to 1
  assert.equal(getCharacterPotionCount(db, hero.id), 1, 'Potion count must decrement by 1');

  // Event POTION_USED must be logged
  const potionEvent = state.events.find(e => e.event_type === 'POTION_USED');
  assert.ok(potionEvent, 'POTION_USED event must be recorded');
  assert.ok(potionEvent.public_text.includes('elixir') || potionEvent.public_text.includes('potion'));

  // Monster attack event must also be logged for that round
  const monsterEvent = state.events.find(e => e.event_type === 'MONSTER_ATTACK' && e.round_number === 1);
  assert.ok(monsterEvent, 'Monster attack event must be recorded when drinking potion');
});

// =============================================================================
// TEST 6: Player tries to drink potion with 0 potions (rejected with error)
// =============================================================================
test('6. Player tries to drink potion with 0 potions: rejected with error and no turn consumed', async () => {
  const db = createTestDb();
  const { hero, encounter } = await setupCombatScenario(db, 'NoPotionsHero');

  // Delete all potions
  db.prepare(`
    DELETE FROM item_instances
    WHERE owner_type = 'CHARACTER' AND owner_character_id = ?
    AND item_definition_id IN (SELECT id FROM item_definitions WHERE category = 'POTION')
  `).run(hero.id);

  assert.equal(getCharacterPotionCount(db, hero.id), 0);

  // Attempting to drink potion must throw error
  assert.throws(() => {
    executeCombatRound(db, hero.id, encounter.id, 'DRINK_POTION');
  }, /You do not possess any healing potions/i);

  // Encounter round must not have advanced
  const freshEncounter = db.prepare('SELECT combat_round FROM encounters WHERE id = ?').get(encounter.id);
  assert.equal(freshEncounter.combat_round, 1, 'Combat round must not advance on rejected potion attempt');
});

// =============================================================================
// TEST 7: Player flees and survives free attack (ESCAPED, movement unlocked, no double attack)
// =============================================================================
test('7. Player flees and survives free attack: ESCAPED, movement unlocked, stays on tile', async () => {
  const db = createTestDb();
  const { hero, tile, encounter } = await setupCombatScenario(db, 'FleerSurvive');

  // Monster free attack misses
  const rng = createRngSequence([
    0.05 // monster free attack d20: 2 -> miss
  ]);

  const state = executeCombatRound(db, hero.id, encounter.id, 'FLEE', { rng });

  // Encounter marked ESCAPED
  assert.equal(state.encounter.status, 'ESCAPED');

  // Hero still alive and on the same tile
  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(refreshedHero.is_alive, 1);
  assert.equal(refreshedHero.tile_id, tile.id, 'Hero must remain on the current tile');

  // Movement must now be unlocked
  const moveCheck = validateMovement(db, refreshedHero, 'NORTH');
  assert.equal(moveCheck.allowed, true, 'Movement must be unlocked after fleeing');

  // Active encounter query must return null
  const active = getActiveEncounterForCharacter(db, hero.id, hero.class);
  assert.equal(active, null, 'No active encounter should block the hero');
});

// =============================================================================
// TEST 8: Player dies from free attack when fleeing (permadeath triggered)
// =============================================================================
test('8. Player dies from free attack when fleeing: permadeath triggered and monster becomes persistent', async () => {
  const db = createTestDb();
  const { hero, tile, encounter } = await setupCombatScenario(db, 'FleerDies');

  // Set hero to 1 HP
  db.prepare('UPDATE characters SET current_hp = 1 WHERE id = ?').run(hero.id);

  // Free attack hits and deals damage
  const rng = createRngSequence([
    0.95, // monster d20: hit
    0.8   // damage >= 1
  ]);

  const state = executeCombatRound(db, hero.id, encounter.id, 'FLEE', { rng });

  // Hero must be dead
  const deadHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(deadHero.is_alive, 0, 'Hero must be permanently dead');
  assert.equal(deadHero.current_hp, 0);

  // Monster must now exist as persistent monster on the tile
  const persistentMonster = db.prepare(`
    SELECT * FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'
  `).get(tile.id);
  assert.ok(persistentMonster, 'Persistent monster must be created on the death tile');
  assert.equal(persistentMonster.kill_count, 1);
});

// =============================================================================
// TEST 9: Monster kills player in regular combat and locks to tile
// =============================================================================
test('9. Monster kills player in regular combat: locks to tile as persistent monster with permadeath', async () => {
  const db = createTestDb();
  const { hero, tile, encounter } = await setupCombatScenario(db, 'FallenHero9');

  // Set hero to 1 HP
  db.prepare('UPDATE characters SET current_hp = 1 WHERE id = ?').run(hero.id);

  // Force hero to miss and monster to hit and kill
  const rng = createRngSequence([
    0.05, // hero misses
    0.95, // monster hits
    0.9   // monster damage >= 1
  ]);

  const state = executeCombatRound(db, hero.id, encounter.id, 'ATTACK', { rng });

  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  assert.equal(refreshedHero.is_alive, 0, 'Character must be marked dead (is_alive = 0)');
  assert.ok(refreshedHero.died_at, 'died_at timestamp must be recorded');
  assert.ok(refreshedHero.killed_by_monster_instance_id, 'Fallen hero must reference killer persistent monster');

  // Dead character cannot perform any further combat actions
  assert.throws(() => {
    executeCombatRound(db, hero.id, encounter.id, 'ATTACK');
  }, /Dead characters cannot perform combat actions/i);
});

// =============================================================================
// TEST 10: +10% HP boost granted once (Math.ceil(base_hp * 1.10))
// =============================================================================
test('10. Persistent monster receives Math.ceil(base_hp * 1.10) max HP boost once', async () => {
  const db = createTestDb();
  const { hero, tile, encounter } = await setupCombatScenario(db, 'HpBoostTester');

  // Fetch base monster base_hp
  const baseMonster = db.prepare('SELECT base_hp FROM monsters WHERE id = ?').get(encounter.monster_id);
  const expectedBoostedHp = Math.ceil(baseMonster.base_hp * 1.10);

  // Slay hero
  db.prepare('UPDATE characters SET current_hp = 1 WHERE id = ?').run(hero.id);
  const rng = createRngSequence([0.05, 0.95, 0.9]);
  executeCombatRound(db, hero.id, encounter.id, 'ATTACK', { rng });

  const persistentMonster = db.prepare(`
    SELECT * FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'
  `).get(tile.id);

  assert.equal(persistentMonster.max_hp, expectedBoostedHp, 'Max HP must equal Math.ceil(base_hp * 1.10)');
  assert.equal(persistentMonster.current_hp, expectedBoostedHp, 'Current HP must start at boosted max HP');
});

// =============================================================================
// TEST 11: Loot split on player death (50% gold, 50% items across ALL gear/inventory, 20-item cap)
// =============================================================================
test('11. Loot correctly split: 50% gold, 50% roll across all items, 20-item cap with priority', async () => {
  const db = createTestDb();
  const { hero, tile, encounter } = await setupCombatScenario(db, 'LootHero');

  // Give hero 100 gold
  db.prepare('UPDATE characters SET gold = 100, current_hp = 1 WHERE id = ?').run(hero.id);

  // Add 25 test items (mix of magical, high-value, and regular)
  const longswordDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Longsword'").get();
  for (let i = 0; i < 25; i++) {
    db.prepare(`
      INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
      VALUES (?, 'CHARACTER', ?)
    `).run(longswordDef.id, hero.id);
  }

  // Force all 50% item survival rolls to succeed (rng < 0.5)
  // rng: hero miss (0.05), monster hit (0.95), monster damage (0.9), item rolls (0.1 each)
  const rng = () => 0.1; // All item rolls succeed (< 0.5)

  const monster = db.prepare('SELECT * FROM monsters WHERE id = ?').get(encounter.monster_id);
  const result = handlePlayerDeath(db, hero, encounter, monster, null, { rng });

  // 1. 50% gold transferred: 100 * 0.5 = 50 gp
  assert.equal(result.goldTransferred, 50);
  const persistentMonster = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(result.instanceId);
  assert.equal(persistentMonster.held_gold, 50);

  // 2. Exactly 20 items capped
  const heldItems = db.prepare(`
    SELECT COUNT(*) as count FROM item_instances
    WHERE owner_type = 'MONSTER' AND owner_monster_id = ?
  `).get(result.instanceId);

  assert.equal(heldItems.count, 20, 'Monster must hold at most 20 items (20-item cap enforced)');
  assert.ok(result.itemsDestroyed > 0, 'Overflow items beyond 20 must be destroyed');
});

// =============================================================================
// TEST 12: Another player enters tile with persistent monster (random encounter bypassed)
// =============================================================================
test('12. Second player enters tile with persistent monster: encounters it directly, random encounter bypassed', async () => {
  const db = createTestDb();
  const { hero: hero1, tile, encounter } = await setupCombatScenario(db, 'HeroOne');

  // Hero 1 dies
  db.prepare('UPDATE characters SET current_hp = 1 WHERE id = ?').run(hero1.id);
  executeCombatRound(db, hero1.id, encounter.id, 'ATTACK', { rng: createRngSequence([0.05, 0.95, 0.9]) });

  // Hero 2 arrives at the same tile
  const user2 = await registerUser(db, 'HeroTwo', 'password123');
  const hero2 = createCharacter(db, {
    userId: user2.id,
    name: 'HeroTwo',
    classType: 'CLERIC',
    stats: { strength: 12, constitution: 10, dexterity: 10, intelligence: 11, wisdom: 16, charisma: 13 }
  });
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero2.id);

  // Check tile encounter for Hero 2 (with rng that would normally NOT spawn random encounter: 0.99)
  const encounter2 = checkTileEncounter(db, hero2, tile, { rng: () => 0.99 });
  assert.ok(encounter2, 'Persistent monster must trigger encounter regardless of random spawn roll');
  assert.ok(encounter2.monster_instance_id, 'Encounter must link to persistent monster_instance_id');

  // Hero 2 chooses to Ignore the threat
  const ignoreRes = ignoreEncounter(db, hero2.id, encounter2.id);
  assert.equal(ignoreRes.success, true);

  // Persistent monster must still remain ALIVE on the tile
  const persistentStillAlive = db.prepare(`
    SELECT * FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'
  `).get(tile.id);
  assert.ok(persistentStillAlive, 'Persistent monster must remain on tile after being ignored');
});

// =============================================================================
// TEST 13: Persistent monster slays second player (kill_count=2, loot accumulates, no 2nd HP boost)
// =============================================================================
test('13. Persistent monster slays second player: kill_count=2, loot accumulates, max HP does not re-boost', async () => {
  const db = createTestDb();
  const { hero: hero1, tile, encounter } = await setupCombatScenario(db, 'FirstVictim');

  // Slay Hero 1
  db.prepare('UPDATE characters SET current_hp = 1, gold = 40 WHERE id = ?').run(hero1.id);
  executeCombatRound(db, hero1.id, encounter.id, 'ATTACK', { rng: createRngSequence([0.05, 0.95, 0.9]) });

  const pmAfterFirstKill = db.prepare(`SELECT * FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'`).get(tile.id);
  assert.equal(pmAfterFirstKill.kill_count, 1);
  assert.equal(pmAfterFirstKill.held_gold, 20);
  const originalBoostedHp = pmAfterFirstKill.max_hp;

  // Hero 2 engages persistent monster
  const user2 = await registerUser(db, 'SecondVictim', 'password123');
  const hero2 = createCharacter(db, {
    userId: user2.id,
    name: 'SecondVictim',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 11, wisdom: 10, charisma: 9 }
  });
  db.prepare('UPDATE characters SET tile_id = ?, current_hp = 1, gold = 60 WHERE id = ?').run(tile.id, hero2.id);

  const enc2 = checkTileEncounter(db, hero2, tile, { rng: () => 0.01 });
  investigateEncounter(db, hero2.id, enc2.id, hero2.class);
  db.prepare("UPDATE encounters SET initiative_winner = 'HERO' WHERE id = ?").run(enc2.id);

  // Slay Hero 2
  executeCombatRound(db, hero2.id, enc2.id, 'ATTACK', { rng: createRngSequence([0.05, 0.95, 0.9]) });

  const pmAfterSecondKill = db.prepare(`SELECT * FROM monster_instances WHERE id = ?`).get(pmAfterFirstKill.id);
  assert.equal(pmAfterSecondKill.kill_count, 2, 'kill_count must increment to 2');
  assert.equal(pmAfterSecondKill.held_gold, 50, 'Gold must accumulate: 20 + (60 * 0.5) = 50 gp');
  assert.equal(pmAfterSecondKill.max_hp, originalBoostedHp, 'Max HP must NOT receive a secondary boost');
});

// =============================================================================
// TEST 14: Persistent monster defeated (victor receives held gold, items, XP, tile freed)
// =============================================================================
test('14. Persistent monster defeated: victor claims loot and XP, monster marked DEFEATED, tile freed', async () => {
  const db = createTestDb();
  const { hero: hero1, tile, encounter } = await setupCombatScenario(db, 'SacrificialHero');

  // Hero 1 dies with 100 gold
  db.prepare('UPDATE characters SET current_hp = 1, gold = 100 WHERE id = ?').run(hero1.id);
  executeCombatRound(db, hero1.id, encounter.id, 'ATTACK', { rng: createRngSequence([0.05, 0.95, 0.9]) });

  // Hero 3 (the Avenger) engages
  const user3 = await registerUser(db, 'AvengerHero', 'password123');
  const hero3 = createCharacter(db, {
    userId: user3.id,
    name: 'AvengerHero',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 13, dexterity: 12, intelligence: 11, wisdom: 10, charisma: 10 }
  });
  db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(tile.id, hero3.id);

  const enc3 = checkTileEncounter(db, hero3, tile, { rng: () => 0.01 });
  investigateEncounter(db, hero3.id, enc3.id, hero3.class);
  db.prepare("UPDATE encounters SET initiative_winner = 'HERO' WHERE id = ?").run(enc3.id);

  // Set monster HP low so one attack slays it
  db.prepare('UPDATE encounters SET current_monster_hp = 1 WHERE id = ?').run(enc3.id);
  db.prepare('UPDATE monster_instances SET current_hp = 1 WHERE id = ?').run(enc3.monster_instance_id);

  // Hero 3 hits and kills monster
  const rngVictory = createRngSequence([
    0.95, // hero hits
    0.9   // hero damage >= 1
  ]);

  const victoryState = executeCombatRound(db, hero3.id, enc3.id, 'ATTACK', { rng: rngVictory });
  assert.equal(victoryState.encounter.status, 'VICTORY');

  // Verify persistent monster status updated to DEFEATED
  const slainMonster = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(enc3.monster_instance_id);
  assert.equal(slainMonster.status, 'DEFEATED');
  assert.ok(slainMonster.defeated_at);

  // Hero 3 claims the 50 gp held gold
  const avengerRefreshed = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero3.id);
  assert.ok(avengerRefreshed.gold >= 50, 'Avenger hero must have looted the held gold');
  assert.ok(avengerRefreshed.xp > 0, 'Avenger hero must be awarded XP');

  // Tile is now freed: no active persistent monster remains
  const activeRemaining = db.prepare(`
    SELECT * FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'
  `).get(tile.id);
  assert.equal(activeRemaining, undefined, 'Tile must have no active persistent monsters remaining');
});

// =============================================================================
// TEST 15: Concurrency / Idempotency protection (duplicate round submissions)
// =============================================================================
test('15. Idempotency: duplicate submission with stale round number does not re-execute action', async () => {
  const db = createTestDb();
  const { hero, encounter } = await setupCombatScenario(db, 'IdempotencyHero');

  // Execute round 1 with expectedRound = 1
  const rng1 = createRngSequence([0.05, 0.05]);
  const state1 = executeCombatRound(db, hero.id, encounter.id, 'ATTACK', { rng: rng1, expectedRound: 1 });
  assert.equal(state1.encounter.combat_round, 2, 'Encounter round should advance to 2');

  const hpAfterRound1 = state1.encounter.current_monster_hp;

  // Client resubmits round 1 (e.g. double click or network retry) with expectedRound = 1
  const stateDuplicate = executeCombatRound(db, hero.id, encounter.id, 'ATTACK', { expectedRound: 1 });

  // Must not have advanced round or re-executed damage
  assert.equal(stateDuplicate.encounter.combat_round, 2, 'Combat round must remain at 2');
  assert.equal(stateDuplicate.encounter.current_monster_hp, hpAfterRound1, 'Monster HP must not change on duplicate submission');
});

// =============================================================================
// TEST 16: Page refresh mid-combat preserves state without rerolling initiative or round
// =============================================================================
test('16. Page refresh mid-combat preserves combat state, round, and initiative', async () => {
  const db = createTestDb();
  const { hero, encounter } = await setupCombatScenario(db, 'RefreshHero');

  const initWinner = encounter.initiative_winner;
  const heroInit = encounter.hero_initiative;
  const monsterInit = encounter.monster_initiative;
  const round = encounter.combat_round;

  // Simulate refresh by refetching active encounter
  const activeEnc = getActiveEncounterForCharacter(db, hero.id, hero.class);
  assert.ok(activeEnc);
  assert.equal(activeEnc.initiative_winner, initWinner, 'Initiative winner must persist across page refresh');
  assert.equal(activeEnc.hero_initiative, heroInit, 'Hero initiative roll must persist');
  assert.equal(activeEnc.monster_initiative, monsterInit, 'Monster initiative roll must persist');
  assert.equal(activeEnc.combat_round, round, 'Combat round must persist');

  const combatState = getCombatState(db, hero.id, activeEnc.id);
  assert.ok(combatState);
  assert.equal(combatState.events.length, 1, 'Initial engagement condition event must be preserved');
});

// =============================================================================
// TEST 17: Secrecy check: HTML never exposes monster HP, AC, attack bonus, or raw dice
// =============================================================================
test('17. Encounter Secrecy in Combat: rendered HTML never exposes monster HP, AC, AB, or dice', async () => {
  const db = createTestDb();
  const { hero, tile, encounter } = await setupCombatScenario(db, 'SecrecyHero');
  // Ensure monster has enough HP to survive attack round for secrecy test under City Safety CR capping
  db.prepare('UPDATE encounters SET current_monster_hp = 50 WHERE id = ?').run(encounter.id);

  // Execute one attack round to generate combat events
  executeCombatRound(db, hero.id, encounter.id, 'ATTACK', {
    rng: createRngSequence([0.9, 0.5, 0.05])
  });

  const refreshedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  const refreshedEnc = getActiveEncounterForCharacter(db, hero.id, hero.class);

  const html = await renderGame(db, refreshedHero, tile, refreshedEnc);

  // Allowed visible items
  assert.ok(html.includes(`${refreshedHero.current_hp} / ${refreshedHero.max_hp}`), 'Hero HP must be visible');
  assert.ok(html.includes('Healing Potions'), 'Potion counter must be visible');
  assert.ok(html.includes('Battle Record'), 'Battle log section must be visible');
  assert.ok(html.includes('⚔️ Attack'), 'Attack button must be visible');
  assert.ok(html.includes('🧪 Drink Potion'), 'Drink potion button must be visible');
  assert.ok(html.includes('🏃 Flee'), 'Flee button must be visible');

  // Forbidden hidden numbers & technical leaks
  assert.doesNotMatch(html, /Armor Class:\s*\d+/i, 'Monster Armor Class must never appear in HTML');
  assert.doesNotMatch(html, /Attack Bonus:\s*\+?\d+/i, 'Monster Attack Bonus must never appear in HTML');
  assert.doesNotMatch(html, /Challenge Rating/i, 'Challenge Rating must never appear in HTML');
  assert.doesNotMatch(html, /CR\s*\d+/i, 'CR must not appear in HTML');
  assert.doesNotMatch(html, /d20\s*[+-]/i, 'Raw dice roll math must not appear in HTML');
  assert.doesNotMatch(html, /deals\s+\d+\s+damage/i, 'Exact damage numbers must not appear in combat log HTML');

  // Ensure monster HP gauge or numerical HP track is NOT rendered for the monster
  const baseMonster = db.prepare('SELECT * FROM monsters WHERE id = ?').get(refreshedEnc.monster_id);
  assert.doesNotMatch(html, new RegExp(`${baseMonster.base_hp}\\s*\\/\\s*${baseMonster.base_hp}`, 'i'), 'Monster numeric HP must not leak');
});
