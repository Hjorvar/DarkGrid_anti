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
  getClericHolyRadianceBonus,
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

  // Ranger Favored Enemy (guaranteed 0 vs Undead)
  let rangerBonus = 0;
  if (character.class === 'RANGER' && monster) {
    rangerBonus = getRangerFavoredEnemyBonus(character, monster).attack;
  }

  // Cleric Holy Radiance vs Undead (replaces Divine Power)
  let clericBonus = 0;
  if (character.class === 'CLERIC' && monster) {
    clericBonus = getClericHolyRadianceBonus(character, monster).attack;
  }

  return baseBonus + levelBonus + weaponBonus + fighterBonus + rangerBonus + clericBonus;
}

/**
 * Calculates hero Armor Class:
 * 10 + effective_DEX + armor_bonus + shield_bonus + sacred_bonuses (Holy Radiance)
 * Effective DEX respects armor Max DEX limit, boosted by Fighter Armor Training.
 * Shield bonus drops to 0 when ranged weapon is active.
 * Holy Radiance AC bonus is a sacred defense that applies vs Undead even when using a ranged weapon.
 * @param {object} character
 * @param {object|null} equippedArmor
 * @param {object|null} equippedShield
 * @param {boolean} isRangedActive
 * @param {object|null} monster
 * @returns {number}
 */
function calculateHeroAC(character, equippedArmor = null, equippedShield = null, isRangedActive = false, monster = null, activeWeapon = null) {
  let armor = equippedArmor;
  let shield = equippedShield;
  let rangedActive = Boolean(isRangedActive);
  let targetMonster = monster;
  let activeWep = activeWeapon;

  // Support calculateHeroAC(hero, equipmentBag, isRangedActive, monster)
  if (equippedArmor && typeof equippedArmor === 'object' && ('armor' in equippedArmor || 'shield' in equippedArmor)) {
    armor = equippedArmor.armor || null;
    shield = equippedArmor.shield || null;
    if (typeof equippedShield === 'boolean') {
      rangedActive = equippedShield;
      targetMonster = (isRangedActive && typeof isRangedActive === 'object') ? isRangedActive : monster;
    } else if (equippedShield && typeof equippedShield === 'object' && ('creature_type' in equippedShield || 'armor_class' in equippedShield || 'descriptions' in equippedShield)) {
      targetMonster = equippedShield;
      rangedActive = Boolean(isRangedActive);
    }
    if (!activeWep) {
      activeWep = rangedActive ? (equippedArmor.rangedWeapon || null) : (equippedArmor.meleeWeapon || equippedArmor.weapon || null);
    }
  } else {
    // If monster parameter was passed as a weapon object rather than a monster
    if (targetMonster && typeof targetMonster === 'object' && !activeWep) {
      const isWeaponLike = (
        targetMonster.category === 'WEAPON' ||
        targetMonster.damage_dice !== undefined ||
        targetMonster.weapon_range_type !== undefined ||
        (targetMonster.is_two_handed !== undefined && !targetMonster.creature_type && !targetMonster.challenge_rating)
      );
      if (isWeaponLike) {
        activeWep = targetMonster;
        targetMonster = null;
      }
    }
  }

  const dexMod = getModifier(character.dexterity);

  let effectiveDex = dexMod;
  if (armor && armor.max_dex_bonus !== null && armor.max_dex_bonus !== undefined) {
    const armorMaxDex = Number(armor.max_dex_bonus);
    const fighterBonus = (character.class === 'FIGHTER') ? getFighterArmorTrainingMaxDexBonus(character.level || 1) : 0;
    const effectiveMax = armorMaxDex + fighterBonus;
    effectiveDex = dexMod >= 0 ? Math.min(dexMod, effectiveMax) : dexMod;
  }

  const armorBonus = armor ? (Number(armor.armor_bonus || 0) + Number(armor.enhancement_bonus || 0)) : 0;

  // Two-handed melee weapon check:
  // When hero wields a two-handed weapon (is_two_handed = 1), shield AC bonus is 0.
  // Applies to all weapons with is_two_handed = 1, both normal and magical shields.
  const isTwoHanded = Boolean(activeWep && (Number(activeWep.is_two_handed) === 1 || activeWep.is_two_handed === true));
  const isTwoHandedMelee = !rangedActive && isTwoHanded;

  // Shield bonus does NOT apply when fighting with a ranged weapon OR when wielding a two-handed melee weapon
  let shieldBonus = 0;
  if (!rangedActive && !isTwoHandedMelee && shield) {
    shieldBonus = Number(shield.shield_bonus || 0) + Number(shield.enhancement_bonus || 0);
  }

  // Cleric Holy Radiance vs Undead (+2 AC L1-4, +3 AC L5-8, +4 AC L9+). Sacred defense, NOT shield bonus.
  let holyRadianceAC = 0;
  if (character && (character.class || '').toUpperCase() === 'CLERIC' && targetMonster) {
    holyRadianceAC = getClericHolyRadianceBonus(character, targetMonster).ac;
  }

  // Wondrous Accessories AC bonus (e.g. Ring of Protection deflection, Amulet of Natural Armor)
  let accessoryAC = 0;
  if (equippedArmor && typeof equippedArmor === 'object') {
    if (equippedArmor.ring && equippedArmor.ring.armor_bonus) {
      accessoryAC += Number(equippedArmor.ring.armor_bonus || 0);
    }
    if (equippedArmor.neck && equippedArmor.neck.armor_bonus) {
      accessoryAC += Number(equippedArmor.neck.armor_bonus || 0);
    }
  }

  return 10 + effectiveDex + armorBonus + shieldBonus + holyRadianceAC + accessoryAC;
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
    flatBonus += getClericHolyRadianceBonus(character, monster).damage;
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
