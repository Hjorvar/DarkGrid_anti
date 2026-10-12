/**
 * Darkgrid Combat System — Core Rules & Formulas
 * Handles attack rolls, critical hits, armor class, initiative, and damage resolution.
 */

const { getModifier } = require('../character/rules');
const { rollD20, rollDice } = require('./dice');

/**
 * Calculates hero Attack Bonus according to DARKGRID_GAME_SPEC.md §8.1:
 * floor((STR_modifier + DEX_modifier) / 2) + weapon_attack_bonus
 * @param {object} character
 * @param {object|null} equippedWeapon
 * @returns {number}
 */
function calculateHeroAttackBonus(character, equippedWeapon = null) {
  const strMod = getModifier(character.strength);
  const dexMod = getModifier(character.dexterity);
  const baseBonus = Math.floor((strMod + dexMod) / 2);

  let weaponBonus = 0;
  if (equippedWeapon && equippedWeapon.attributes) {
    let attrs = equippedWeapon.attributes;
    if (typeof attrs === 'string') {
      try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
    }
    weaponBonus = Number(attrs.attack_bonus || 0);
  }

  return baseBonus + weaponBonus;
}

/**
 * Calculates hero Armor Class:
 * 10 + DEX_modifier + armor_bonus + shield_bonus
 * @param {object} character
 * @param {object|null} equippedArmor
 * @param {object|null} equippedShield
 * @returns {number}
 */
function calculateHeroAC(character, equippedArmor = null, equippedShield = null) {
  const dexMod = getModifier(character.dexterity);
  const armorBonus = equippedArmor ? Number(equippedArmor.armor_bonus || 0) : 0;
  const shieldBonus = equippedShield ? Number(equippedShield.shield_bonus || 0) : 0;

  return 10 + dexMod + armorBonus + shieldBonus;
}

/**
 * Determines damage formula for hero based on equipped weapon and STR modifier.
 * Default unequipped damage is 1d4 + max(0, STR_mod).
 * @param {object} character
 * @param {object|null} equippedWeapon
 * @returns {string} e.g. '1d8+2' or '1d6+1'
 */
function getHeroDamageFormula(character, equippedWeapon = null) {
  const strMod = getModifier(character.strength);
  let baseDice = '1d4';

  if (equippedWeapon && equippedWeapon.damage_dice) {
    baseDice = equippedWeapon.damage_dice;
  }

  if (strMod > 0) {
    return `${baseDice}+${strMod}`;
  } else if (strMod < 0) {
    return `${baseDice}${strMod}`;
  }
  return baseDice;
}

/**
 * Resolves an attack roll (works for both Hero and Monster).
 * @param {number} attackBonus
 * @param {number} targetAC
 * @param {() => number} rng
 * @returns {{ roll: number, total: number, isHit: boolean, isCrit: boolean, isFumble: boolean }}
 */
function resolveAttackRoll(attackBonus, targetAC, rng = Math.random) {
  const roll = rollD20(rng);
  const total = roll + attackBonus;

  if (roll === 20) {
    return { roll, d20: roll, total, isHit: true, isCrit: true, isFumble: false, isNat1: false, isNat20: true };
  }
  if (roll === 1) {
    return { roll, d20: roll, total, isHit: false, isCrit: false, isFumble: true, isNat1: true, isNat20: false };
  }

  const isHit = total >= targetAC;
  return { roll, d20: roll, total, isHit, isCrit: false, isFumble: false, isNat1: false, isNat20: false };
}

/**
 * Calculates damage for a hit, doubling on critical hits.
 * @param {string} damageFormula
 * @param {boolean} isCrit
 * @param {() => number} rng
 * @returns {number}
 */
function resolveDamage(damageFormula, isCrit = false, rng = Math.random) {
  const result = rollDice(damageFormula, rng, 1);
  return isCrit ? result.total * 2 : result.total;
}

/**
 * Calculates initiative roll: 1d20 + bonus.
 * @param {number} bonus
 * @param {() => number} rng
 * @returns {number}
 */
function rollInitiative(bonus, rng = Math.random) {
  return rollD20(rng) + bonus;
}

/**
 * Calculates healing amount for potion.
 * Defaults to '1d8+1'.
 * @param {object|null} potionItem
 * @param {() => number} rng
 * @returns {number}
 */
function resolvePotionHealing(potionItem = null, rng = Math.random) {
  let healDice = '1d8+1';
  if (potionItem && potionItem.attributes) {
    let attrs = potionItem.attributes;
    if (typeof attrs === 'string') {
      try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
    }
    if (attrs.heal_dice) healDice = attrs.heal_dice;
  }
  const result = rollDice(healDice, rng, 2);
  return result.total;
}

module.exports = {
  calculateHeroAttackBonus,
  calculateHeroAC,
  getHeroDamageFormula,
  resolveAttackRoll,
  resolveDamage,
  rollInitiative,
  resolvePotionHealing
};
