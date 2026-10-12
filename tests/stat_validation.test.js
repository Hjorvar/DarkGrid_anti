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

test('Valid stat distribution is accepted for Fighter, Ranger, and Cleric', () => {
  // Fighter base: STR 14, CON 12, DEX 12, INT 10, WIS 10, CHA 10 (sum 68) + 3 points
  const validFighter = validateCharacterCreation('FIGHTER', {
    strength: 16,
    constitution: 13,
    dexterity: 12,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  }, 'Kappi');
  assert.equal(validFighter.valid, true);

  // Ranger base: STR 12, CON 10, DEX 14, INT 10, WIS 12, CHA 10 (sum 68) + 3 points
  const validRanger = validateCharacterCreation('RANGER', {
    strength: 12,
    constitution: 10,
    dexterity: 16,
    intelligence: 10,
    wisdom: 13,
    charisma: 10
  }, 'Veiðimaður');
  assert.equal(validRanger.valid, true);

  // Cleric base: STR 12, CON 10, DEX 10, INT 10, WIS 14, CHA 12 (sum 68) + 3 points
  const validCleric = validateCharacterCreation('CLERIC', {
    strength: 12,
    constitution: 10,
    dexterity: 10,
    intelligence: 10,
    wisdom: 16,
    charisma: 13
  }, 'Klerkur');
  assert.equal(validCleric.valid, true);
});

test('Reduction by up to 2 points per stat is allowed and can be reallocated', () => {
  // Fighter lowering CHA from 10 to 8 (-2) and INT from 10 to 8 (-2)
  // giving 3 bonus + 4 returned = 7 points to add!
  // e.g. STR from 14 to 18 (+4), CON from 12 to 15 (+3)
  const reallocatedFighter = validateCharacterCreation('FIGHTER', {
    strength: 18,
    constitution: 15,
    dexterity: 12,
    intelligence: 8, // reduced by 2 (allowed)
    wisdom: 10,
    charisma: 8     // reduced by 2 (allowed)
  }, 'Þórólfur');

  // Sum: 18 + 15 + 12 + 8 + 10 + 8 = 71
  assert.equal(reallocatedFighter.valid, true);
});

test('Rejects reduction greater than 2 from base stat', () => {
  // Fighter lowering CHA from 10 to 7 (-3, disallowed)
  const invalidFighter = validateCharacterCreation('FIGHTER', {
    strength: 18,
    constitution: 16,
    dexterity: 12,
    intelligence: 8,
    wisdom: 10,
    charisma: 7 // 10 - 3 = 7, should fail!
  }, 'Illegal');

  assert.equal(invalidFighter.valid, false);
  assert.match(invalidFighter.errors.join(' '), /cannot drop below the minimum of 8/);
});

test('Rejects stat exceeding maximum of 18', () => {
  const over18 = validateCharacterCreation('FIGHTER', {
    strength: 19,
    constitution: 10,
    dexterity: 12,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  }, 'Overpowered');

  assert.equal(over18.valid, false);
  assert.match(over18.errors.join(' '), /cannot exceed the maximum of 18/);
});

test('Rejects incorrect total points sum', () => {
  // Sum is 72 instead of 71
  const overspent = validateCharacterCreation('FIGHTER', {
    strength: 15,
    constitution: 13,
    dexterity: 12,
    intelligence: 10,
    wisdom: 11,
    charisma: 11
  }, 'Illegal');

  assert.equal(overspent.valid, false);
  assert.match(overspent.errors.join(' '), /must equal exactly 71/);
});

test('Rejects invalid class name or empty character name', () => {
  const badClass = validateCharacterCreation('WIZARD', {
    strength: 14, constitution: 12, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 13
  }, 'Gandalf');
  assert.equal(badClass.valid, false);

  const badName = validateCharacterCreation('FIGHTER', {
    strength: 15, constitution: 12, dexterity: 12, intelligence: 10, wisdom: 11, charisma: 11
  }, '   ');
  assert.equal(badName.valid, false);
});
