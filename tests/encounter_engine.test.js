const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../src/domain/auth/service');
const { createCharacter } = require('../src/domain/character/rules');
const { getTileByCoords, validateMovement } = require('../src/domain/world/map');
const {
  calculateNormalWeight,
  selectMonsterForTerrainAndHero,
  resolveMonsterDescription,
  checkTileEncounter,
  getActiveEncounterForCharacter,
  ignoreEncounter,
  investigateEncounter
} = require('../src/domain/encounters/engine');

test('Gaussian normal weight peaks at hero level and decreases with distance', () => {
  const heroLevel = 1;
  const sigma = 1.5;

  const w1 = calculateNormalWeight(1, heroLevel, sigma);
  const w2 = calculateNormalWeight(2, heroLevel, sigma);
  const w3 = calculateNormalWeight(3, heroLevel, sigma);
  const w4 = calculateNormalWeight(4, heroLevel, sigma);

  assert.equal(w1, 1.0); // exp(0) = 1
  assert.ok(w1 > w2, `Weight for lvl 1 (${w1}) should be > lvl 2 (${w2})`);
  assert.ok(w2 > w3, `Weight for lvl 2 (${w2}) should be > lvl 3 (${w3})`);
  assert.ok(w3 > w4, `Weight for lvl 3 (${w3}) should be > lvl 4 (${w4})`);
});

test('Statistical simulation of monster selection confirms peak at hero level', () => {
  const db = createTestDb();
  const heroLevel = 1;

  // Let's run 1,000 picks in Forest ('FOREST' -> 'F')
  // Available levels: 1 (Shadow Bramble, Marsh Leech), 2 (Feral Wolf), 3 (Assassin Vine), 4 (Grave Troll)
  const countsByLevel = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const monster = selectMonsterForTerrainAndHero(db, 'FOREST', heroLevel);
    assert.ok(monster, 'Monster should be selected in Forest');
    countsByLevel[monster.solo_level]++;
  }

  // Level 1 should be most common, then Level 2, then 3, then 4
  assert.ok(
    countsByLevel[1] > countsByLevel[2],
    `Level 1 count (${countsByLevel[1]}) must exceed Level 2 (${countsByLevel[2]})`
  );
  assert.ok(
    countsByLevel[2] > countsByLevel[3],
    `Level 2 count (${countsByLevel[2]}) must exceed Level 3 (${countsByLevel[3]})`
  );
  assert.ok(
    countsByLevel[3] >= countsByLevel[4],
    `Level 3 count (${countsByLevel[3]}) must be >= Level 4 (${countsByLevel[4]})`
  );
});

test('Terrain filter strictly matches monster habitat codes', () => {
  const db = createTestDb();

  // Test in Swamp ('SWAMP' -> 'S')
  for (let i = 0; i < 50; i++) {
    const monster = selectMonsterForTerrainAndHero(db, 'SWAMP', 1);
    const habitats = JSON.parse(monster.habitat);
    assert.ok(habitats.includes('S'), `Monster ${monster.name} must have 'S' in habitat for SWAMP`);
  }

  // Test in Jungle ('JUNGLE' -> 'J')
  // In our seeds, Assassin Vine has J.
  for (let i = 0; i < 20; i++) {
    const monster = selectMonsterForTerrainAndHero(db, 'JUNGLE', 3);
    const habitats = JSON.parse(monster.habitat);
    assert.ok(habitats.includes('J'), `Monster ${monster.name} must have 'J' in habitat for JUNGLE`);
  }
});

test('Safe tiles never spawn random encounters even with forced 100% trigger', () => {
  const db = createTestDb();
  const safeTile = getTileByCoords(db, 7, 7); // Oakhaven City, is_safe = 1
  assert.equal(safeTile.is_safe, 1);

  const mockChar = { id: 1, level: 1, class: 'FIGHTER' };
  // Forced roll = 0 (would trigger any non-zero percentage)
  const encounter = checkTileEncounter(db, mockChar, safeTile, { rng: () => 0.0 });
  assert.equal(encounter, null);
});

test('Assassin Vine has all 9 custom descriptions and Ranger gets perceptive versions', () => {
  const db = createTestDb();
  const vine = db.prepare("SELECT * FROM monsters WHERE name = 'Assassin Vine'").get();
  assert.ok(vine);

  const descs = JSON.parse(vine.descriptions);
  const requiredKeys = [
    '1_distant', '2_ranger_distant', '3_close', '4_ranger_close',
    '5_health_100', '6_health_75', '7_health_50', '8_health_25', '9_dead'
  ];
  for (const k of requiredKeys) {
    assert.ok(descs[k], `Missing description key: ${k}`);
  }

  // Distant resolution
  const fighterDistant = resolveMonsterDescription(descs, 'FIGHTER', 'DISCOVERED');
  assert.equal(fighterDistant.text, descs['1_distant']);
  assert.equal(fighterDistant.isRangerSpecial, false);

  const rangerDistant = resolveMonsterDescription(descs, 'RANGER', 'DISCOVERED');
  assert.equal(rangerDistant.text, descs['2_ranger_distant']);
  assert.equal(rangerDistant.isRangerSpecial, true);

  // Close resolution
  const fighterClose = resolveMonsterDescription(descs, 'FIGHTER', 'IN_COMBAT');
  assert.equal(fighterClose.text, descs['3_close']);

  const rangerClose = resolveMonsterDescription(descs, 'RANGER', 'IN_COMBAT');
  assert.equal(rangerClose.text, descs['4_ranger_close']);
  assert.equal(rangerClose.isRangerSpecial, true);
});

test('Encounter lifecycle: locks movement, survives refresh, and unlocks on Ignore', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'Hawk', 'secret123');

  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Hawk',
    classType: 'RANGER',
    stats: {
      strength: 12, constitution: 10, dexterity: 16, intelligence: 11, wisdom: 13, charisma: 10
    }
  });

  const forestTile = getTileByCoords(db, 7, 5); // Forest
  assert.equal(forestTile.is_safe, 0);

  // Force encounter trigger on stepping into forest
  const encounter = checkTileEncounter(db, hero, forestTile, { rng: () => 0.05 });
  assert.ok(encounter);
  assert.equal(encounter.status, 'DISCOVERED');

  // Verify movement is locked while encounter is active!
  const moveAttempt = validateMovement(db, hero, 'NORTH');
  assert.equal(moveAttempt.allowed, false);
  assert.match(moveAttempt.reason, /resolve the encounter/i);

  // Simulating page refresh: getActiveEncounterForCharacter returns exact same encounter
  const refreshedEncounter = getActiveEncounterForCharacter(db, hero.id, hero.class);
  assert.ok(refreshedEncounter);
  assert.equal(refreshedEncounter.id, encounter.id);
  assert.equal(refreshedEncounter.monster_id, encounter.monster_id);

  // Player clicks Ignore
  const ignoreRes = ignoreEncounter(db, hero.id, encounter.id);
  assert.equal(ignoreRes.success, true);

  // Encounter is no longer active
  const afterIgnoreEncounter = getActiveEncounterForCharacter(db, hero.id, hero.class);
  assert.equal(afterIgnoreEncounter, null);

  // Movement is now permitted again!
  const freeMove = validateMovement(db, hero, 'NORTH');
  assert.equal(freeMove.allowed, true);
});
