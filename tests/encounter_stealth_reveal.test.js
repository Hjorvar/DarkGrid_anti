const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../src/domain/auth/service');
const { createCharacter } = require('../src/domain/character/rules');
const { getTileByCoords, validateMovement, getMinimapData, getAvailableDirections } = require('../src/domain/world/map');
const {
  checkTileEncounter,
  getActiveEncounterForCharacter,
  investigateEncounter,
  ignoreEncounter,
  concludeEncounter
} = require('../src/domain/encounters/engine');
const { formatModifier } = require('../src/domain/character/rules');

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

    app.render('game', {
      currentUser: { id: character.user_id || 1, username: 'TestUser' },
      character,
      currentTile,
      minimap,
      directions,
      encounter,
      modifiers,
      errorMessage: null,
      infoMessage: null
    }, (err, html) => {
      if (err) return reject(err);
      resolve(html);
    });
  });
}

test('Encounter Secrecy Stage 1: Threat is unknown, name & image are hidden in HTML', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'SecretHero', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'SecretHero',
    classType: 'FIGHTER',
    stats: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 }
  });

  const forestTile = getTileByCoords(db, 7, 5); // Forest
  assert.equal(forestTile.is_safe, 0);

  // Trigger encounter with forced roll
  const encounter = checkTileEncounter(db, hero, forestTile, { rng: () => 0.01 });
  assert.ok(encounter);
  assert.equal(encounter.status, 'DISCOVERED');
  assert.equal(encounter.isRevealed, false);

  const monsterName = encounter.monster_name.replace(/\[.*?\]/g, '').trim();
  const monsterImage = encounter.imageUrl;

  // Render view as player sees it
  const html = await renderGame(db, hero, forestTile, encounter);

  // 1. Monster name MUST NOT appear in rendered HTML
  assert.ok(!html.includes(monsterName), `Monster name "${monsterName}" must not leak in Stage 1 HTML`);

  // 2. Monster image path MUST NOT appear in rendered HTML
  if (monsterImage) {
    const filename = monsterImage.split('/').pop();
    assert.ok(!html.includes(filename), `Monster image "${filename}" must not leak in Stage 1 HTML`);
  }

  // 3. Monster symbol badge must not leak
  assert.ok(!html.includes(`[${encounter.monster_symbol}]`), `Monster symbol must not leak in Stage 1 HTML`);

  // 4. Must show generic unknown threat cues
  assert.ok(html.includes('Unknown Threat'), 'HTML must display "Unknown Threat"');
  assert.ok(html.includes('[?]'), 'HTML must display mystery symbol badge "[?]"');
  assert.ok(html.includes(encounter.resolvedDescription), 'HTML must display resolved distant description');

  // 5. Must provide decision buttons: Investigate and Ignore
  assert.ok(html.includes('/game/encounter/investigate'), 'Must include Investigate action');
  assert.ok(html.includes('/game/encounter/ignore'), 'Must include Ignore action');
  assert.ok(html.includes('Advance & Investigate'), 'Must offer "Advance & Investigate" button');
  assert.ok(html.includes('Bypass & Ignore'), 'Must offer "Bypass & Ignore" button');

  // 6. Movement compass must be disabled
  const moveAttempt = validateMovement(db, hero, 'NORTH');
  assert.equal(moveAttempt.allowed, false);
});

test('Encounter Revelation Stage 2: Proceeding reveals exact same monster, name, and image', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'RevealHero', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'RevealHero',
    classType: 'RANGER',
    stats: { strength: 12, constitution: 10, dexterity: 16, intelligence: 10, wisdom: 13, charisma: 10 }
  });

  const forestTile = getTileByCoords(db, 7, 5);
  const initialEncounter = checkTileEncounter(db, hero, forestTile, { rng: () => 0.01 });
  assert.ok(initialEncounter);
  const initialMonsterId = initialEncounter.monster_id;
  const initialMonsterName = initialEncounter.monster_name.replace(/\[.*?\]/g, '').trim();

  // Player decides to proceed -> investigateEncounter
  const revealedEncounter = investigateEncounter(db, hero.id, initialEncounter.id, hero.class);
  assert.ok(revealedEncounter);
  assert.equal(revealedEncounter.id, initialEncounter.id, 'Must be the exact same encounter ID');
  assert.equal(revealedEncounter.monster_id, initialMonsterId, 'Must be the exact same monster ID');
  assert.equal(revealedEncounter.status, 'IN_COMBAT');
  assert.equal(revealedEncounter.isRevealed, true);

  // Render view after revelation
  const html = await renderGame(db, hero, forestTile, revealedEncounter);

  // 1. Monster name MUST now appear in rendered HTML
  assert.ok(html.includes(initialMonsterName), `Monster name "${initialMonsterName}" must appear upon reveal`);
  assert.ok(html.includes('Revealed Threat'), 'HTML must state "Revealed Threat"');

  // 2. Monster image MUST now appear in rendered HTML
  if (revealedEncounter.imageUrl) {
    const filename = revealedEncounter.imageUrl.split('/').pop();
    assert.ok(html.includes(filename), `Monster image "${filename}" must be present in HTML`);
  }

  // 3. Monster symbol badge MUST now appear
  assert.ok(html.includes(`[${revealedEncounter.monster_symbol}]`), 'Monster symbol must appear upon reveal');

  // 4. Standoff action: Option to withdraw
  assert.ok(html.includes('/game/encounter/conclude'), 'Must offer conclude / withdraw form');
  assert.ok(html.includes('Withdraw Carefully'), 'Must offer "Withdraw Carefully" button');

  // 5. Conclude standoff -> movement unlocks
  const concludeRes = concludeEncounter(db, hero.id, revealedEncounter.id);
  assert.equal(concludeRes.success, true);

  const activeAfterConclude = getActiveEncounterForCharacter(db, hero.id, hero.class);
  assert.equal(activeAfterConclude, null);

  const moveAttempt = validateMovement(db, hero, 'NORTH');
  assert.equal(moveAttempt.allowed, true);
});

test('Encounter lifecycle across multiple monster types verifies consistency and secrecy', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'CatalogTester', 'pass1234');
  const hero = createCharacter(db, {
    userId: user.id,
    name: 'CatalogTester',
    classType: 'CLERIC',
    stats: { strength: 12, constitution: 10, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 13 }
  });

  const testMonsters = ['Ghoul', 'Giant Spider', 'Choker', 'Rust Monster', 'Manticore', 'Assassin Vine'];

  for (const name of testMonsters) {
    const monsterRow = db.prepare('SELECT * FROM monsters WHERE name = ?').get(name);
    assert.ok(monsterRow, `Monster ${name} must exist`);

    // Create encounter manually in DISCOVERED status
    const ins = db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp)
      VALUES (?, 1, ?, 'DISCOVERED', ?)
    `);
    const result = ins.run(hero.id, monsterRow.id, monsterRow.base_hp);
    const encounterId = Number(result.lastInsertRowid);

    const tile = db.prepare('SELECT * FROM map_tiles WHERE id = 1').get();
    const encStage1 = getActiveEncounterForCharacter(db, hero.id, hero.class);

    // Stage 1 check
    const htmlStage1 = await renderGame(db, hero, tile, encStage1);
    assert.ok(!htmlStage1.includes(name), `Monster ${name} name leaked in Stage 1!`);
    assert.ok(!htmlStage1.includes(`[${monsterRow.symbol}]`), `Monster ${name} symbol leaked in Stage 1!`);
    assert.ok(htmlStage1.includes('Unknown Threat'), `Mystery label missing for ${name} in Stage 1`);

    // Player investigates -> Stage 2
    const encStage2 = investigateEncounter(db, hero.id, encounterId, hero.class);
    assert.equal(encStage2.monster_id, monsterRow.id);

    const htmlStage2 = await renderGame(db, hero, tile, encStage2);
    assert.ok(htmlStage2.includes(name), `Monster ${name} name not shown upon reveal in Stage 2!`);
    assert.ok(htmlStage2.includes(`[${monsterRow.symbol}]`), `Monster ${name} symbol not shown in Stage 2!`);

    // Clean up encounter
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encounterId);
  }
});
