const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { registerUser } = require('../src/domain/auth/service');
const {
  createCharacter,
  getLivingCharacterByUserId
} = require('../src/domain/character/rules');

test('Account can create a living character and spawns in safe town', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'Aragorn', 'secret123');

  const hero = createCharacter(db, {
    userId: user.id,
    name: 'Strider',
    classType: 'RANGER',
    stats: {
      strength: 12,
      constitution: 11,
      dexterity: 16,
      intelligence: 10,
      wisdom: 13,
      charisma: 10
    }
  });

  assert.equal(hero.name, 'Strider');
  assert.equal(hero.class, 'RANGER');
  assert.equal(hero.is_alive, 1);
  assert.equal(hero.level, 1);
  assert.equal(hero.current_hp, 10); // Ranger H1=10 at CON mod 0
  assert.equal(hero.max_hp, 10);
  assert.equal(hero.gold, 10);

  // Spawn tile check
  const startTile = db.prepare('SELECT * FROM map_tiles WHERE id = ?').get(hero.tile_id);
  assert.equal(startTile.terrain, 'CITY');
  assert.equal(startTile.is_safe, 1);

  const fetched = getLivingCharacterByUserId(db, user.id);
  assert.equal(fetched.id, hero.id);
});

test('Enforces strictly only ONE living character per account', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'Boromir', 'secret123');

  // First hero
  createCharacter(db, {
    userId: user.id,
    name: 'Boromir I',
    classType: 'FIGHTER',
    stats: {
      strength: 16,
      constitution: 14,
      dexterity: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    }
  });

  // Attempting second hero while first is alive must throw error
  assert.throws(() => {
    createCharacter(db, {
      userId: user.id,
      name: 'Boromir II',
      classType: 'FIGHTER',
      stats: {
        strength: 16,
        constitution: 14,
        dexterity: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      }
    });
  }, (err) => {
    assert.match(err.message, /already has a living hero/i);
    return true;
  });

  // Check database unique index directly prevents bypass
  assert.throws(() => {
    db.prepare(`
      INSERT INTO characters (
        user_id, name, class, is_alive, level, xp, gold,
        strength, constitution, dexterity, intelligence, wisdom, charisma,
        current_hp, max_hp, tile_id
      ) VALUES (?, 'Sneaky', 'FIGHTER', 1, 1, 0, 0, 14, 14, 12, 10, 12, 10, 14, 14, 1)
    `).run(user.id);
  }, (err) => {
    assert.match(err.message, /UNIQUE constraint failed/);
    return true;
  });
});

test('Allows new character creation after previous character dies, preserving history', async () => {
  const db = createTestDb();
  const user = await registerUser(db, 'Gimli', 'secret123');

  const hero1 = createCharacter(db, {
    userId: user.id,
    name: 'Gimli First',
    classType: 'FIGHTER',
    stats: {
      strength: 16,
      constitution: 14,
      dexterity: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    }
  });

  // Hero dies
  db.prepare(`
    UPDATE characters
    SET is_alive = 0, current_hp = 0, died_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(hero1.id);

  // Now user has no living character
  const activeHero = getLivingCharacterByUserId(db, user.id);
  assert.equal(activeHero, null);

  // User can now create a new hero!
  const hero2 = createCharacter(db, {
    userId: user.id,
    name: 'Gimli Second',
    classType: 'FIGHTER',
    stats: {
      strength: 17,
      constitution: 13,
      dexterity: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    }
  });

  assert.equal(hero2.name, 'Gimli Second');
  assert.equal(hero2.is_alive, 1);

  // Historical record of hero1 exists in character_history view
  const history = db.prepare('SELECT * FROM character_history WHERE user_id = ?').all(user.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].name, 'Gimli First');
});
