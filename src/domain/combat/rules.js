/**
 * Darkgrid Combat System — Core Rules & Formulas
 * Handles attack rolls, critical hits, armor class, initiative, and damage resolution.
 * Integrates character progression, class abilities, and weapon/armor enhancement bonuses.
 */

const {
  getModifier,
  getLevelAttackBonus,
  getFighterWeaponTraining,
  getFighterArmorTrainingMaxDexBonus,
  getRangerFavoredEnemyBonus,
  getClericDivinePowerBonus
} = require('../character/rules');
const { rollD20, rollDice } = require('./dice');

/**
 * Calculates hero Attack Bonus according to DARKGRID_GAME_SPEC.md §8.1:
 * floor((STR_modifier + DEX_modifier) / 2) + level_progression + weapon_enhancement + class_bonuses
 * @param {object} character
 * @param {object|null} equippedWeapon
 * @param {object|null} monster
 * @returns {number}
 */
function calculateHeroAttackBonus(character, equippedWeapon = null, monster = null) {
  const strMod = getModifier(character.strength);
  const dexMod = getModifier(character.dexterity);
  const baseBonus = Math.floor((strMod + dexMod) / 2);

  // Level Attack Progression
  const levelBonus = getLevelAttackBonus(character.class, character.level || 1);

  // Weapon enhancement bonus or attribute bonus
  let weaponBonus = 0;
  if (equippedWeapon) {
    if (equippedWeapon.enhancement_bonus) {
      weaponBonus += Number(equippedWeapon.enhancement_bonus);
    } else if (equippedWeapon.attributes) {
      let attrs = equippedWeapon.attributes;
      if (typeof attrs === 'string') {
        try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
      }
      weaponBonus += Number(attrs.attack_bonus || 0);
    }
  }

  // Fighter Weapon Training
  let fighterBonus = 0;
  if (character.class === 'FIGHTER') {
    fighterBonus = getFighterWeaponTraining(character.level || 1).attack;
  }

  // Ranger Favored Enemy
  let rangerBonus = 0;
  if (character.class === 'RANGER' && monster) {
    rangerBonus = getRangerFavoredEnemyBonus(character, monster).attack;
  }

  // Cleric Divine Power
  let clericBonus = 0;
  if (character.class === 'CLERIC' && monster) {
    clericBonus = getClericDivinePowerBonus(character, monster).attack;
  }

  return baseBonus + levelBonus + weaponBonus + fighterBonus + rangerBonus + clericBonus;
}

/**
 * Calculates hero Armor Class:
 * 10 + effective_DEX + armor_bonus + shield_bonus
 * Effective DEX respects armor Max DEX limit, boosted by Fighter Armor Training.
 * Shield bonus drops to 0 when ranged weapon is active.
 * @param {object} character
 * @param {object|null} equippedArmor
 * @param {object|null} equippedShield
 * @param {boolean} isRangedActive
 * @returns {number}
 */
function calculateHeroAC(character, equippedArmor = null, equippedShield = null, isRangedActive = false) {
  // Support both calculateHeroAC(hero, equipment, isRangedActive) and calculateHeroAC(hero, armor, shield, isRangedActive)
  if (equippedArmor && typeof equippedArmor === 'object' && ('armor' in equippedArmor || 'shield' in equippedArmor)) {
    isRangedActive = Boolean(equippedShield);
    const bag = equippedArmor;
    equippedArmor = bag.armor || null;
    equippedShield = bag.shield || null;
  }

  const dexMod = getModifier(character.dexterity);

  let effectiveDex = dexMod;
  if (equippedArmor && equippedArmor.max_dex_bonus !== null && equippedArmor.max_dex_bonus !== undefined) {
    const armorMaxDex = Number(equippedArmor.max_dex_bonus);
    const fighterBonus = (character.class === 'FIGHTER') ? getFighterArmorTrainingMaxDexBonus(character.level || 1) : 0;
    const effectiveMax = armorMaxDex + fighterBonus;
    effectiveDex = dexMod >= 0 ? Math.min(dexMod, effectiveMax) : dexMod;
  }

  const armorBonus = equippedArmor ? (Number(equippedArmor.armor_bonus || 0) + Number(equippedArmor.enhancement_bonus || 0)) : 0;

  // Shield bonus does NOT apply when fighting with a ranged weapon
  let shieldBonus = 0;
  if (!isRangedActive && equippedShield) {
    shieldBonus = Number(equippedShield.shield_bonus || 0) + Number(equippedShield.enhancement_bonus || 0);
  }

  return 10 + effectiveDex + armorBonus + shieldBonus;
}

/**
 * Determines damage formula for hero based on equipped weapon, STR modifier,
 * enhancement bonuses, and class ability bonuses.
 * @param {object} character
 * @param {object|null} equippedWeapon
 * @param {object|null} monster
 * @returns {string} e.g. '1d8+2' or '1d6+1'
 */
function getHeroDamageFormula(character, equippedWeapon = null, monster = null) {
  const strMod = getModifier(character.strength);
  let baseDice = '1d4';

  if (equippedWeapon && equippedWeapon.damage_dice) {
    baseDice = equippedWeapon.damage_dice;
  }

  let flatBonus = strMod;
  if (equippedWeapon && equippedWeapon.enhancement_bonus) {
    flatBonus += Number(equippedWeapon.enhancement_bonus);
  }

  if (character.class === 'FIGHTER') {
    flatBonus += getFighterWeaponTraining(character.level || 1).damage;
  }

  if (character.class === 'RANGER' && monster) {
    flatBonus += getRangerFavoredEnemyBonus(character, monster).damage;
  }

  if (character.class === 'CLERIC' && monster) {
    flatBonus += getClericDivinePowerBonus(character, monster).damage;
  }

  if (flatBonus > 0) {
    return `${baseDice}+${flatBonus}`;
  } else if (flatBonus < 0) {
    return `${baseDice}${flatBonus}`;
  }
  return baseDice;
}

/**
 * Resolves an attack roll (works for both Hero and Monster).
 * @param {number} attackBonus
 * @param {number} targetAC
 * @param {() => number} rng
 * @returns {{ roll: number, total: number, isHit: boolean, isCrit: boolean, isFumble: boolean, isNat1: boolean, isNat20: boolean, d20: number }}
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
 * Defaults to '1d8+1' if not specified in potion attributes.
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
