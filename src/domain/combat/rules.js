/**
 * Darkgrid Combat System — Core Rules & Formulas
 * Handles attack rolls, critical hits, armor class, initiative, and damage resolution.
 * Integrates character progression, class abilities (Know Your Enemy, Natural Knowledge,
 * Favored Enemy Option A, Sacred Knowledge / Holy Radiance), INT/WIS Battle Experience,
 * and 9-slot weapon/armor/accessory enhancement bonuses.
 */

const {
  getModifier,
  getLevelAttackBonus,
  getFighterWeaponTraining,
  getFighterArmorTrainingMaxDexBonus,
  getRangerFavoredEnemyBonus,
  getClericHolyRadianceBonus,
  getClericDivinePowerBonus,
  getEffectiveStats,
  getLastEquipmentForCharacter,
  getHeroSavingThrows
} = require('../character/rules');
const {
  getFighterKnowYourEnemyBonus,
  getRangerNaturalKnowledgeBonus,
  hasClassGeneralKnowledge,
  computeBattleExperienceModifiers
} = require('./knowledge');
const { rollD20, rollDice } = require('./dice');

/**
 * Determines whether the active weapon or hero attack mode is Ranged.
 */
function isWeaponRanged(equippedWeapon, character = null, equipment = null) {
  if (equippedWeapon) {
    const rangeType = (equippedWeapon.weapon_range_type || '').toUpperCase();
    if (rangeType === 'RANGED') return true;
    if (rangeType === 'MELEE') return false;
    const slot = (equippedWeapon.equipped_slot || '').toUpperCase();
    if (slot === 'RANGED' || slot === 'PREPARED_RANGED') return true;
    if (slot === 'MELEE' || slot === 'PREPARED_MELEE') return false;
    if (equippedWeapon.attributes) {
      let attrs = equippedWeapon.attributes;
      if (typeof attrs === 'string') {
        try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
      }
      const wType = (attrs.weapon_type || '').toLowerCase();
      if (wType === 'ranged') return true;
      if (wType === 'melee') return false;
    }
    const nameLower = (equippedWeapon.name || '').toLowerCase();
    if (nameLower.includes('bow') || nameLower.includes('sling') || nameLower.includes('dart') || nameLower.includes('javelin')) {
      return true;
    }
    return false;
  }
  if (character && (character.primary_weapon || '').toUpperCase() === 'RANGED') {
    if (!equipment || equipment.rangedWeapon) return true;
  }
  return false;
}

/**
 * Helper to resolve Battle Experience modifiers for a character against a target monster.
 */
function resolveCombatBattleExperience(effectiveCharacter, monster = null, options = {}) {
  if (!effectiveCharacter || !monster) {
    return { damageBonus: 0, acBonus: 0, tier: 'UNFAMILIAR', victories: 0 };
  }
  if (options && options.battleExperience && typeof options.battleExperience === 'object') {
    return options.battleExperience;
  }
  if (effectiveCharacter._battleExperience && typeof effectiveCharacter._battleExperience === 'object') {
    return effectiveCharacter._battleExperience;
  }
  if (effectiveCharacter._learnedDamageBonus !== undefined || effectiveCharacter._learnedAcBonus !== undefined) {
    return {
      damageBonus: Number(effectiveCharacter._learnedDamageBonus || 0),
      acBonus: Number(effectiveCharacter._learnedAcBonus || 0),
      tier: effectiveCharacter._knowledgeTier || 'UNFAMILIAR',
      victories: Number(effectiveCharacter.monsterVictories || 0)
    };
  }
  const victories = options && options.victories !== undefined
    ? Number(options.victories)
    : (monster.victories_against !== undefined
      ? Number(monster.victories_against)
      : (effectiveCharacter.monster_victories !== undefined
        ? Number(effectiveCharacter.monster_victories)
        : (effectiveCharacter.monsterVictories !== undefined ? Number(effectiveCharacter.monsterVictories) : 0)));
  return computeBattleExperienceModifiers({
    effectiveInt: effectiveCharacter.intelligence !== undefined ? effectiveCharacter.intelligence : 10,
    effectiveWis: effectiveCharacter.wisdom !== undefined ? effectiveCharacter.wisdom : 10,
    victories,
    hasClassExemption: hasClassGeneralKnowledge(effectiveCharacter, monster)
  });
}

/**
 * Calculates hero Attack Bonus:
 * - Melee attacks use STR modifier (+ level_progression + weapon_enhancement + class_bonuses, -1 vs airborne FLY targets).
 * - Ranged attacks use DEX modifier (+ level_progression + weapon_enhancement + class_bonuses, 0 penalty vs FLY targets).
 * - Integrates Fighter Weapon Training + Know Your Enemy, Ranger Favored Enemy (Option A) + Natural Knowledge,
 *   and Cleric Sacred Knowledge / Holy Radiance (with Cleric BAB ceil(level * 3 / 4)).
 * - Note: INT/WIS Battle Experience grants Damage and AC only, never Attack bonus (OC-5).
 */
function calculateHeroAttackBonus(character, equippedWeapon = null, monster = null, equipment = null, options = {}) {
  const eff = getEffectiveStats(character, equipment);
  const strMod = getModifier(eff.strength);
  const dexMod = getModifier(eff.dexterity);
  const isRanged = isWeaponRanged(equippedWeapon, eff, equipment);
  const baseBonus = isRanged ? dexMod : strMod;

  const mType = (monster && monster.movement_type ? monster.movement_type : '').toUpperCase();
  const isAirborne = Boolean(monster && (
    mType === 'FLY' ||
    mType === 'FLYING' ||
    Boolean(monster.is_flying)
  ));
  const evasiveFlyerPenalty = (!isRanged && isAirborne) ? -1 : 0;

  const levelBonus = getLevelAttackBonus(eff.class, eff.level || 1);

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

  const cls = (eff.class || '').toUpperCase();
  const allowNameOnly = Boolean(options && options.allowNameOnly);

  let fighterBonus = 0;
  if (cls === 'FIGHTER') {
    fighterBonus += getFighterWeaponTraining(eff.level || 1).attack;
    if (monster) {
      fighterBonus += getFighterKnowYourEnemyBonus(eff, monster, { allowNameOnly }).attack;
    }
  }

  let rangerBonus = 0;
  if (cls === 'RANGER' && monster) {
    rangerBonus += getRangerFavoredEnemyBonus(eff, monster).attack;
    rangerBonus += getRangerNaturalKnowledgeBonus(eff, monster, { allowNameOnly }).attack;
  }

  let clericBonus = 0;
  if (cls === 'CLERIC' && monster) {
    clericBonus += getClericHolyRadianceBonus(eff, monster).attack;
  }

  return baseBonus + levelBonus + weaponBonus + fighterBonus + rangerBonus + clericBonus + evasiveFlyerPenalty;
}

/**
 * Calculates hero Armor Class:
 * 10 + effective_DEX + armor_bonus + shield_bonus + class_knowledge_AC + favored_enemy_AC + battle_experience_AC + accessoryAC
 * Supports both:
 *   calculateHeroAC(hero, equipment, isRangedActive, monster, activeWeapon, options)
 * and:
 *   calculateHeroAC(hero, armor, shield, isRangedActive, monster, activeWeapon, options)
 */
function calculateHeroAC(character, equippedArmor = null, equippedShield = null, isRangedActive = false, monster = null, activeWeapon = null, options = {}) {
  let armor = equippedArmor;
  let shield = equippedShield;
  let rangedActive = Boolean(isRangedActive);
  let targetMonster = monster;
  let activeWep = activeWeapon;
  let equipmentBag = null;
  let opts = options || {};

  const isEquipmentBag = Boolean(
    equippedArmor &&
    typeof equippedArmor === 'object' &&
    ('armor' in equippedArmor || 'shield' in equippedArmor || 'ring' in equippedArmor || 'neck' in equippedArmor || 'meleeWeapon' in equippedArmor)
  );

  if (isEquipmentBag) {
    equipmentBag = equippedArmor;
    armor = equippedArmor.armor || null;
    shield = equippedArmor.shield || null;
    if (typeof equippedShield === 'boolean') {
      rangedActive = equippedShield;
      targetMonster = (isRangedActive && typeof isRangedActive === 'object') ? isRangedActive : monster;
      if (monster && typeof monster === 'object' && !activeWep && (monster.category === 'WEAPON' || monster.damage_dice !== undefined || monster.is_two_handed !== undefined)) {
        activeWep = monster;
        if (targetMonster === monster) targetMonster = null;
      }
      if (activeWeapon && typeof activeWeapon === 'object' && !('category' in activeWeapon) && ('victories' in activeWeapon || 'battleExperience' in activeWeapon || 'allowNameOnly' in activeWeapon)) {
        opts = activeWeapon;
      }
    } else if (equippedShield && typeof equippedShield === 'object' && ('creature_type' in equippedShield || 'armor_class' in equippedShield || 'descriptions' in equippedShield || 'monster_family' in equippedShield)) {
      targetMonster = equippedShield;
      rangedActive = Boolean(isRangedActive);
    }
    if (!activeWep) {
      activeWep = rangedActive ? (equippedArmor.rangedWeapon || null) : (equippedArmor.meleeWeapon || equippedArmor.weapon || null);
    }
  } else {
    equipmentBag =
      (character && character._equipment) ||
      (equippedArmor && equippedArmor._equipment) ||
      (equippedShield && equippedShield._equipment) ||
      null;

    if (!equipmentBag && character && character.id) {
      const cached = getLastEquipmentForCharacter(character.id);
      if (cached && ((armor && cached.armor === armor) || (shield && cached.shield === shield) || (!armor && !cached.armor && !shield && !cached.shield))) {
        equipmentBag = cached;
      }
    }

    if (targetMonster && typeof targetMonster === 'object' && !activeWep) {
      const isWeaponLike = (
        targetMonster.category === 'WEAPON' ||
        targetMonster.damage_dice !== undefined ||
        targetMonster.weapon_range_type !== undefined ||
        (targetMonster.is_two_handed !== undefined && !targetMonster.creature_type && !targetMonster.challenge_rating && !targetMonster.monster_family)
      );
      if (isWeaponLike) {
        activeWep = targetMonster;
        targetMonster = null;
      }
    }
  }

  const eff = getEffectiveStats(character, equipmentBag);
  const cls = (eff.class || '').toUpperCase();
  const dexMod = getModifier(eff.dexterity);

  let effectiveDex = dexMod;
  if (armor && armor.max_dex_bonus !== null && armor.max_dex_bonus !== undefined) {
    const armorMaxDex = Number(armor.max_dex_bonus);
    const fighterBonus = (cls === 'FIGHTER') ? getFighterArmorTrainingMaxDexBonus(eff.level || 1) : 0;
    const effectiveMax = armorMaxDex + fighterBonus;
    effectiveDex = dexMod >= 0 ? Math.min(dexMod, effectiveMax) : dexMod;
  }

  let armorBonus = 0;
  if (armor) {
    if (armor.base_armor_bonus !== undefined) {
      armorBonus = Number(armor.base_armor_bonus) + Number(armor.enhancement_bonus || 0);
    } else if (armor.armor_bonus_includes_enhancement === false) {
      armorBonus = Number(armor.armor_bonus || 0) + Number(armor.enhancement_bonus || 0);
    } else {
      armorBonus = Number(armor.armor_bonus || 0);
    }
  }

  const isTwoHanded = Boolean(activeWep && (Number(activeWep.is_two_handed) === 1 || activeWep.is_two_handed === true));
  const isTwoHandedMelee = !rangedActive && isTwoHanded;

  let shieldBonus = 0;
  if (!rangedActive && !isTwoHandedMelee && shield) {
    if (shield.base_shield_bonus !== undefined) {
      shieldBonus = Number(shield.base_shield_bonus) + Number(shield.enhancement_bonus || 0);
    } else if (shield.shield_bonus_includes_enhancement === false) {
      shieldBonus = Number(shield.shield_bonus || 0) + Number(shield.enhancement_bonus || 0);
    } else {
      shieldBonus = Number(shield.shield_bonus || 0);
    }
  }

  const allowNameOnly = Boolean(opts && opts.allowNameOnly);
  let classTargetAC = 0;
  if (targetMonster) {
    if (cls === 'FIGHTER') {
      classTargetAC += getFighterKnowYourEnemyBonus(eff, targetMonster, { allowNameOnly }).ac;
    } else if (cls === 'RANGER') {
      classTargetAC += getRangerFavoredEnemyBonus(eff, targetMonster).ac;
      classTargetAC += getRangerNaturalKnowledgeBonus(eff, targetMonster, { allowNameOnly }).ac;
    } else if (cls === 'CLERIC') {
      classTargetAC += getClericHolyRadianceBonus(eff, targetMonster).ac;
    }
  }

  let battleExperienceAC = 0;
  if (targetMonster) {
    const bexp = resolveCombatBattleExperience(eff, targetMonster, opts);
    battleExperienceAC = Number(bexp.acBonus || 0);
  }

  let accessoryAC = 0;
  const ringItem = (equipmentBag && equipmentBag.ring) || null;
  const neckItem = (equipmentBag && equipmentBag.neck) || null;
  if (ringItem && ringItem.armor_bonus) {
    accessoryAC += Number(ringItem.armor_bonus || 0);
  }
  if (neckItem && neckItem.armor_bonus) {
    accessoryAC += Number(neckItem.armor_bonus || 0);
  }

  return 10 + effectiveDex + armorBonus + shieldBonus + classTargetAC + battleExperienceAC + accessoryAC;
}

/**
 * Determines damage formula for hero based on equipped weapon, STR/DEX modifier,
 * enhancement bonuses, class abilities (Weapon Training, Know Your Enemy, Favored Enemy Option A,
 * Natural Knowledge, Holy Radiance), and INT Battle Experience.
 */
function getHeroDamageFormula(character, equippedWeapon = null, monster = null, equipment = null, options = {}) {
  const eff = getEffectiveStats(character, equipment);
  const strMod = getModifier(eff.strength);
  const dexMod = getModifier(eff.dexterity);
  const isRanged = isWeaponRanged(equippedWeapon, eff, equipment);
  let baseDice = '1d4';

  if (equippedWeapon && equippedWeapon.damage_dice) {
    baseDice = equippedWeapon.damage_dice;
  }

  let flatBonus = isRanged ? Math.max(strMod, Math.floor(dexMod / 2)) : strMod;
  if (equippedWeapon && equippedWeapon.enhancement_bonus) {
    flatBonus += Number(equippedWeapon.enhancement_bonus);
  }

  const cls = (eff.class || '').toUpperCase();
  const allowNameOnly = Boolean(options && options.allowNameOnly);

  if (cls === 'FIGHTER') {
    flatBonus += getFighterWeaponTraining(eff.level || 1).damage;
    if (monster) {
      flatBonus += getFighterKnowYourEnemyBonus(eff, monster, { allowNameOnly }).damage;
    }
  } else if (cls === 'RANGER' && monster) {
    flatBonus += getRangerFavoredEnemyBonus(eff, monster).damage;
    flatBonus += getRangerNaturalKnowledgeBonus(eff, monster, { allowNameOnly }).damage;
  } else if (cls === 'CLERIC' && monster) {
    flatBonus += getClericHolyRadianceBonus(eff, monster).damage;
  }

  if (monster) {
    const bexp = resolveCombatBattleExperience(eff, monster, options);
    flatBonus += Number(bexp.damageBonus || 0);
  }

  if (flatBonus > 0) {
    return `${baseDice}+${flatBonus}`;
  } else if (flatBonus < 0) {
    return `${baseDice}${flatBonus}`;
  }
  return baseDice;
}

/**
 * Rolls hero damage for a hit (convenience wrapper over getHeroDamageFormula + resolveDamage).
 */
function rollHeroDamage(character, equippedWeapon = null, monster = null, isCrit = false, rng = Math.random, equipment = null, options = {}) {
  const formula = getHeroDamageFormula(character, equippedWeapon, monster, equipment, options);
  return resolveDamage(formula, isCrit, rng);
}

/**
 * Returns the hero's saving throw bonus for a specific save type ('FORT', 'REF', 'WILL', 'PHYSICAL').
 */
function getHeroSavingThrowBonus(character, saveType = 'FORT', equipment = null) {
  const saves = getHeroSavingThrows(character, equipment);
  const norm = String(saveType || 'FORT').toUpperCase().trim();
  if (norm === 'FORT' || norm === 'FORTITUDE') return saves.fort;
  if (norm === 'REF' || norm === 'REFLEX') return saves.ref;
  if (norm === 'WILL') return saves.will;
  if (norm === 'PHYSICAL') return saves.physical;
  return saves.fort;
}

/**
 * Resolves an attack roll (works for both Hero and Monster).
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
 */
function resolveDamage(damageFormula, isCrit = false, rng = Math.random) {
  const result = rollDice(damageFormula, rng, 1);
  return isCrit ? result.total * 2 : result.total;
}

/**
 * Calculates initiative roll: 1d20 + bonus.
 */
function rollInitiative(bonus, rng = Math.random) {
  return rollD20(rng) + bonus;
}

/**
 * Calculates healing amount for potion.
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
  isWeaponRanged,
  resolveCombatBattleExperience,
  calculateHeroAttackBonus,
  calculateHeroAC,
  getHeroDamageFormula,
  rollHeroDamage,
  getHeroSavingThrowBonus,
  getClericDivinePowerBonus,
  resolveAttackRoll,
  resolveDamage,
  rollInitiative,
  resolvePotionHealing
};
