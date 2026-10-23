const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCharacterCreation,
  getModifier,
  formatModifier
} = require('../src/domain/character/rules');

test('Modifier calculation follows d20 rule floor((score - 10) / 2)', () => {
  assert.equal(getModifier(10), 0);
  assert.equal(getModifier(11), 0);
  assert.equal(getModifier(12), 1);
  assert.equal(getModifier(14), 2);
  assert.equal(getModifier(18), 4);
  assert.equal(getModifier(8), -1);
  assert.equal(getModifier(9), -1);
  assert.equal(getModifier(7), -2);

  assert.equal(formatModifier(14), '+2');
  assert.equal(formatModifier(10), '+0');
  assert.equal(formatModifier(8), '-1');
});

test('Valid stat distribution is accepted for Fighter, Ranger, and Cleric (72 points)', () => {
  // Fighter preset: STR 14, DEX 12, CON 14, INT 10, WIS 12, CHA 10 (sum 72)
  const validFighter = validateCharacterCreation('FIGHTER', {
    strength: 14,
    constitution: 14,
    dexterity: 12,
    intelligence: 10,
    wisdom: 12,
    charisma: 10
  }, 'Kappi');
  assert.equal(validFighter.valid, true);

  // Ranger preset: STR 10, DEX 16, CON 12, INT 10, WIS 14, CHA 10 (sum 72)
  const validRanger = validateCharacterCreation('RANGER', {
    strength: 10,
    constitution: 12,
    dexterity: 16,
    intelligence: 10,
    wisdom: 14,
    charisma: 10
  }, 'Veiðimaður');
  assert.equal(validRanger.valid, true);

  // Cleric preset: STR 12, DEX 10, CON 12, INT 10, WIS 16, CHA 12 (sum 72)
  const validCleric = validateCharacterCreation('CLERIC', {
    strength: 12,
    constitution: 12,
    dexterity: 10,
    intelligence: 10,
    wisdom: 16,
    charisma: 12
  }, 'Klerkur');
  assert.equal(validCleric.valid, true);
});

test('Free allocation down to 8 per stat is allowed and can be reallocated up to 18 (sum 72)', () => {
  const reallocatedFighter = validateCharacterCreation('FIGHTER', {
    strength: 18,
    constitution: 16,
    dexterity: 12,
    intelligence: 8,
    wisdom: 10,
    charisma: 8
  }, 'Þórólfur');

  // Sum: 18 + 16 + 12 + 8 + 10 + 8 = 72
  assert.equal(reallocatedFighter.valid, true);
});

test('Rejects stat below minimum of 8', () => {
  const invalidFighter = validateCharacterCreation('FIGHTER', {
    strength: 18,
    constitution: 17,
    dexterity: 12,
    intelligence: 8,
    wisdom: 10,
    charisma: 7
  }, 'Illegal');

  assert.equal(invalidFighter.valid, false);
  assert.match(invalidFighter.errors.join(' '), /cannot drop below the minimum of 8/);
});

test('Rejects stat exceeding maximum of 18', () => {
  const over18 = validateCharacterCreation('FIGHTER', {
    strength: 19,
    constitution: 11,
    dexterity: 12,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  }, 'Overpowered');

  assert.equal(over18.valid, false);
  assert.match(over18.errors.join(' '), /cannot exceed the maximum of 18/);
});

test('Rejects incorrect total points sum', () => {
  // Sum is 73 instead of 72
  const overspent = validateCharacterCreation('FIGHTER', {
    strength: 16,
    constitution: 13,
    dexterity: 12,
    intelligence: 10,
    wisdom: 11,
    charisma: 11
  }, 'Illegal');

  assert.equal(overspent.valid, false);
  assert.match(overspent.errors.join(' '), /must equal exactly 72/);
});

test('Rejects invalid class name or empty character name', () => {
  const badClass = validateCharacterCreation('WIZARD', {
    strength: 14, constitution: 12, dexterity: 12, intelligence: 10, wisdom: 11, charisma: 13
  }, 'Gandalf');
  assert.equal(badClass.valid, false);

  const badName = validateCharacterCreation('FIGHTER', {
    strength: 15, constitution: 13, dexterity: 12, intelligence: 10, wisdom: 11, charisma: 11
  }, '   ');
  assert.equal(badName.valid, false);
});
