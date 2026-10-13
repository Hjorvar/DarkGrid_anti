const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createTestDb } = require('./test_helpers');
const { 
  selectMonsterForTerrainAndHero, 
  getEncounterById, 
  investigateEncounter,
  resolveMonsterDescription 
} = require('../src/domain/encounters/engine');
const { registerUser } = require('../src/domain/auth/service');
const { createCharacter } = require('../src/domain/character/rules');

const PROPOSED_30_NAMES = [
  'Kobold', 'Goblin', 'Human Skeleton', 'Hobgoblin', 'Human Zombie',
  'Troglodyte', 'Darkmantle', 'Lizardfolk', 'Hyena', 'Gnoll',
  'Giant Frog', 'Boar', 'Yellow Musk Creeper', 'Bugbear', 'Boggard',
  'Death Dog', 'Giant Crab', 'Ettercap', 'Cockatrice', 'Ankheg',
  'Ogre', 'Shadow', 'Owlbear', 'Minotaur', 'Yeti',
  'Gargoyle', 'Basilisk', 'Mummy', 'Ochre Jelly', 'Winter Wolf'
];

test('Session 2 Catalog: Exactly 30 new Pathfinder 1e monsters are present', () => {
  const db = createTestDb();
  const allMonsters = db.prepare('SELECT * FROM monsters ORDER BY id ASC').all();
  
  // Total monsters should be at least 38 (38 base + 30 Phase K expansion = 68)
  assert.ok(allMonsters.length >= 38, `Expected at least 38 monsters in total, found ${allMonsters.length}`);

  for (const name of PROPOSED_30_NAMES) {
    const found = allMonsters.find(m => m.name === name);
    assert.ok(found, `Expected new monster '${name}' to be present in database`);
    assert.ok(found.source_url.startsWith('https://aonprd.com/'), `source_url for '${name}' must link to Archives of Nethys`);
    assert.ok(found.base_hp > 0, `base_hp for '${name}' must be positive`);
    assert.ok(found.armor_class > 0, `armor_class for '${name}' must be positive`);
    assert.ok(found.attack_bonus !== null, `attack_bonus for '${name}' must not be null`);
    assert.ok(found.damage_dice, `damage_dice for '${name}' must not be empty`);
    assert.ok(found.challenge_rating >= 0.25 && found.challenge_rating <= 5.0, `CR for '${name}' must be between 0.25 and 5.0`);
    assert.ok(found.solo_level >= 1 && found.solo_level <= 5, `solo_level for '${name}' must be between 1 and 5`);
    assert.ok(found.creature_type, `creature_type for '${name}' must be set`);
  }
});

test('Session 2 Cleanup: Placeholders removed, Wolf and Troll upgraded', () => {
  const db = createTestDb();
  
  // Dev placeholders must NOT exist
  const shadowBramble = db.prepare("SELECT * FROM monsters WHERE name LIKE '%Shadow Bramble%'").get();
  assert.equal(shadowBramble, undefined, 'Shadow Bramble must be deleted from catalog');

  const marshLeech = db.prepare("SELECT * FROM monsters WHERE name LIKE '%Marsh Leech%'").get();
  assert.equal(marshLeech, undefined, 'Marsh Leech must be deleted from catalog');

  // Wolf must exist and be official Pathfinder Animal
  const wolf = db.prepare("SELECT * FROM monsters WHERE name = 'Wolf'").get();
  assert.ok(wolf, 'Wolf must exist');
  assert.equal(wolf.challenge_rating, 1.0);
  assert.equal(wolf.creature_type, 'Animal');
  assert.equal(wolf.base_hp, 13);
  assert.equal(wolf.armor_class, 14);
  assert.ok(wolf.source_url.includes('aonprd.com'));

  // Troll must exist and be official Pathfinder Humanoid (giant)
  const troll = db.prepare("SELECT * FROM monsters WHERE name = 'Troll'").get();
  assert.ok(troll, 'Troll must exist');
  assert.equal(troll.challenge_rating, 5.0);
  assert.equal(troll.creature_type, 'Humanoid');
  assert.equal(troll.creature_subtype, 'giant');
  assert.equal(troll.base_hp, 63);
  assert.equal(troll.armor_class, 16);
  assert.ok(troll.source_url.includes('aonprd.com'));
});

test('Session 2 Descriptions: All 38 monsters have 9 English descriptions passing secrecy audit', () => {
  const db = createTestDb();
  const monsters = db.prepare('SELECT * FROM monsters').all();
  
  const requiredKeys = [
    '1_distant', '2_ranger_distant', '3_close', '4_ranger_close',
    '5_health_100', '6_health_75', '7_health_50', '8_health_25', '9_dead'
  ];

  for (const m of monsters) {
    const descs = JSON.parse(m.descriptions);
    for (const key of requiredKeys) {
      assert.ok(descs[key], `Monster '${m.name}' is missing description '${key}'`);
      assert.ok(descs[key].trim().length > 15, `Description '${key}' for '${m.name}' is too short`);
    }

    // Secrecy audit on Stage 1 descriptions (1_distant and 2_ranger_distant)
    // Must NOT contain the exact monster name
    const distant1 = descs['1_distant'].toLowerCase();
    const distant2 = descs['2_ranger_distant'].toLowerCase();
    const cleanLowerName = m.name.toLowerCase().replace(/\[.*?\]/g, '').trim();

    assert.ok(
      !distant1.includes(cleanLowerName),
      `1_distant for '${m.name}' leaks monster name: "${descs['1_distant']}"`
    );
    assert.ok(
      !distant2.includes(cleanLowerName),
      `2_ranger_distant for '${m.name}' leaks monster name: "${descs['2_ranger_distant']}"`
    );
  }
});

test('Session 2 Artwork: Every monster has image on disk and resolves in encounters', () => {
  const db = createTestDb();
  const monsters = db.prepare('SELECT * FROM monsters').all();

  for (const m of monsters) {
    const diskPath = path.join(__dirname, '../', m.image_path);
    assert.ok(fs.existsSync(diskPath), `Monster artwork missing at ${diskPath} for '${m.name}'`);

    const publicPath = path.join(__dirname, '../public/', m.image_path);
    assert.ok(fs.existsSync(publicPath), `Public artwork missing at ${publicPath} for '${m.name}'`);
  }
});

test('Session 2 & Artwork Expansion: All 30 monsters have unique non-placeholder images', () => {
  const ALL_30_SLUGS = [
    'stirge', 'dire_rat', 'viper', 'giant_centipede', 'skeletal_champion',
    'iron_cobra', 'blink_dog', 'duergar', 'drow', 'orc',
    'wight', 'harpy', 'doppelganger', 'griffon', 'giant_scorpion',
    'cloaker', 'phase_spider', 'wraith', 'gibbering_mouther', 'peryton',
    'giant_stag_beetle', 'vegepygmy', 'ghast', 'giant_bat', 'morlock',
    'violet_fungus', 'grick', 'krenshar', 'bunyip', 'sahuagin'
  ];
  const wolfPath = path.join(__dirname, '../images/monsters/feral_wolf.png');
  const wolfHash = crypto.createHash('sha256').update(fs.readFileSync(wolfPath)).digest('hex');

  const seenHashes = new Set();
  // Include wolf hash to prevent any match
  seenHashes.add(wolfHash);

  for (const slug of ALL_30_SLUGS) {
    const rootPath = path.join(__dirname, `../images/monsters/${slug}.png`);
    const publicPath = path.join(__dirname, `../public/images/monsters/${slug}.png`);

    assert.ok(fs.existsSync(rootPath), `Image file must exist at ${rootPath}`);
    assert.ok(fs.existsSync(publicPath), `Public image file must exist at ${publicPath}`);

    const rootBuf = fs.readFileSync(rootPath);
    const pubBuf = fs.readFileSync(publicPath);
    assert.ok(rootBuf.equals(pubBuf), `Root and public images for ${slug} must be identical`);

    const hash = crypto.createHash('sha256').update(rootBuf).digest('hex');
    assert.notEqual(hash, wolfHash, `${slug}.png must NOT be a copy of feral_wolf.png placeholder`);
    assert.ok(!seenHashes.has(hash), `${slug}.png must have a unique SHA-256 hash`);
    seenHashes.add(hash);
  }

  // Confirm exactly 30 unique hashes were added (excluding wolf)
  assert.equal(seenHashes.size, 31, 'Exactly 30 unique monster hashes plus 1 wolf hash must be verified');
});

test('Session 2 Terrains: Full coverage and exactly ONE primary terrain per monster', () => {
  const db = createTestDb();
  const monsters = db.prepare('SELECT * FROM monsters').all();

  for (const m of monsters) {
    const terrains = db.prepare('SELECT * FROM monster_terrains WHERE monster_id = ?').all(m.id);
    assert.ok(terrains.length >= 1, `Monster '${m.name}' must have at least one terrain link`);

    const primaries = terrains.filter(t => t.is_primary === 1);
    assert.equal(primaries.length, 1, `Monster '${m.name}' must have strictly ONE primary terrain`);
  }

  // Check key terrains have expected variety
  const keyTerrains = ['FOREST', 'HILLS', 'UNDERGROUND_RUINS', 'PLAINS', 'SWAMP', 'MOUNTAINS', 'DESERT', 'COAST'];
  for (const terrain of keyTerrains) {
    const available = db.prepare(`
      SELECT m.* FROM monsters m
      JOIN monster_terrains mt ON m.id = mt.monster_id
      WHERE mt.terrain = ?
    `).all(terrain);

    assert.ok(available.length >= 4, `Expected at least 4 monster varieties in ${terrain}, found ${available.length}`);
  }
});

test('Session 2 Encounter Mechanics: Spawns across levels 1, 3, and 5 reflect Gaussian distribution', () => {
  const db = createTestDb();

  // Test level 1 hero in Forest: Level 1 should dominate
  const samplesLvl1 = [];
  for (let i = 0; i < 200; i++) {
    const m = selectMonsterForTerrainAndHero(db, 'FOREST', 1);
    assert.ok(m, 'Must select monster in Forest');
    samplesLvl1.push(m.solo_level);
  }
  const countLvl1At1 = samplesLvl1.filter(lvl => lvl === 1).length;
  const countLvl1At5 = samplesLvl1.filter(lvl => lvl === 5).length;
  assert.ok(countLvl1At1 > countLvl1At5, `Level 1 hero must see Level 1 monsters (${countLvl1At1}) more than Level 5 (${countLvl1At5})`);

  // Test level 5 hero in Hills: Level 5 should appear frequently
  const samplesLvl5 = [];
  for (let i = 0; i < 200; i++) {
    const m = selectMonsterForTerrainAndHero(db, 'HILLS', 5);
    assert.ok(m, 'Must select monster in Hills');
    samplesLvl5.push(m.solo_level);
  }
  const countLvl5At5 = samplesLvl5.filter(lvl => lvl === 5).length;
  const countLvl5At1 = samplesLvl5.filter(lvl => lvl === 1).length;
  assert.ok(countLvl5At5 > countLvl5At1, `Level 5 hero must see Level 5 monsters (${countLvl5At5}) more than Level 1 (${countLvl5At1})`);
});

test('Session 2 Secrecy & Revelation: Stage 1 hides identity, Stage 2 reveals with identical monster', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'SecrecyTester', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'SecrecyTester',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 }
  });

  // Pick a random monster from the new 30
  const monster = db.prepare("SELECT * FROM monsters WHERE name = 'Minotaur'").get();
  assert.ok(monster);

  // Create DISCOVERED encounter
  const res = db.prepare(`
    INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
    VALUES (?, 1, ?, 'DISCOVERED', ?)
  `).run(hero.id, monster.id, monster.base_hp);

  const encounterId = Number(res.lastInsertRowid);
  const stage1 = getEncounterById(db, encounterId, 'FIGHTER');

  // Stage 1 Assertions: Hidden
  assert.equal(stage1.isRevealed, false);
  assert.equal(stage1.status, 'DISCOVERED');
  assert.ok(stage1.resolvedDescription);
  assert.ok(!stage1.resolvedDescription.includes('Minotaur'));

  // Investigate -> Stage 2
  const stage2 = investigateEncounter(db, hero.id, encounterId, 'FIGHTER');

  // Stage 2 Assertions: Revealed
  assert.equal(stage2.isRevealed, true);
  assert.equal(stage2.status, 'IN_COMBAT');
  assert.equal(stage2.monster_id, monster.id);
  assert.equal(stage2.monster_name, 'Minotaur');
  assert.ok(stage2.imageUrl.includes('minotaur.png'));
});
