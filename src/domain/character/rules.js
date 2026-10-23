const config = require('../../config');
const { withTransaction } = require('../../db/connection');
const { rollDice } = require('../combat/dice');
const {
  validateRangerFavoredEnemyChoice,
  normalizeRangerFavoredEnemy
} = require('../monsters/taxonomy');
const {
  doesMonsterMatchRangerFavoredEnemy,
  doesMonsterMatchSacredKnowledge
} = require('../combat/knowledge');

const STAT_KEYS = ['strength', 'constitution', 'dexterity', 'intelligence', 'wisdom', 'charisma'];

const STAT_KEY_ALIASES = {
  STR: 'strength',
  STRENGTH: 'strength',
  DEX: 'dexterity',
  DEXTERITY: 'dexterity',
  CON: 'constitution',
  CONSTITUTION: 'constitution',
  INT: 'intelligence',
  INTELLIGENCE: 'intelligence',
  WIS: 'wisdom',
  WISDOM: 'wisdom',
  CHA: 'charisma',
  CHARISMA: 'charisma'
};

const ATTRIBUTE_MILESTONE_LEVELS = Object.freeze([2, 4, 6, 8, 10]);

const DESCRIPTIVE_ATTRIBUTE_TIER_LABELS = Object.freeze({
  strength: [
    { min: 20, label: 'Titan-Born' },
    { min: 18, label: 'Herculean' },
    { min: 16, label: 'Mighty' },
    { min: 14, label: 'Strong' },
    { min: 12, label: 'Sturdy' },
    { min: 10, label: 'Capable' },
    { min: -Infinity, label: 'Unconditioned' }
  ],
  dexterity: [
    { min: 20, label: 'Wind-Swift' },
    { min: 18, label: 'Razor-Quick' },
    { min: 16, label: 'Nimble' },
    { min: 14, label: 'Agile' },
    { min: 12, label: 'Deft' },
    { min: 10, label: 'Steady' },
    { min: -Infinity, label: 'Stiff' }
  ],
  constitution: [
    { min: 20, label: 'Unbreakable' },
    { min: 18, label: 'Iron-Blooded' },
    { min: 16, label: 'Stalwart' },
    { min: 14, label: 'Resilient' },
    { min: 12, label: 'Hardened' },
    { min: 10, label: 'Hale' },
    { min: -Infinity, label: 'Frail' }
  ],
  intelligence: [
    { min: 20, label: 'Mastermind' },
    { min: 18, label: 'Brilliant' },
    { min: 16, label: 'Tactical' },
    { min: 14, label: 'Analytical' },
    { min: 12, label: 'Sharp-Minded' },
    { min: 10, label: 'Observant' },
    { min: -Infinity, label: 'Unstudied' }
  ],
  wisdom: [
    { min: 20, label: 'Oracular' },
    { min: 18, label: 'Prescient' },
    { min: 16, label: 'Wise' },
    { min: 14, label: 'Perceptive' },
    { min: 12, label: 'Attentive' },
    { min: 10, label: 'Grounded' },
    { min: -Infinity, label: 'Unwary' }
  ],
  charisma: [
    { min: 20, label: 'Mythic' },
    { min: 18, label: 'Sovereign' },
    { min: 16, label: 'Inspiring' },
    { min: 14, label: 'Commanding' },
    { min: 12, label: 'Assured' },
    { min: 10, label: 'Composed' },
    { min: -Infinity, label: 'Reserved' }
  ]
});

const FAST_XP_TABLE = {
  1: 0,
  2: 1300,
  3: 3300,
  4: 6000,
  5: 10000,
  6: 15000,
  7: 23000,
  8: 34000,
  9: 50000,
  10: 71000
};

/**
 * Normalizes an attribute key (e.g. 'STR' -> 'strength', 'constitution' -> 'constitution').
 */
function normalizeAttributeKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const upper = rawKey.trim().toUpperCase();
  return STAT_KEY_ALIASES[upper] || null;
}

/**
 * Returns the Phase 7A.3 / 7B qualitative attribute tier label for a given stat and score.
 */
function getAttributeTierLabel(statKeyOrScore, maybeScore) {
  let statKey = 'strength';
  let score = maybeScore;
  if (maybeScore === undefined && (typeof statKeyOrScore === 'number' || !Number.isNaN(Number(statKeyOrScore)))) {
    score = statKeyOrScore;
  } else {
    statKey = statKeyOrScore;
  }
  const normKey = normalizeAttributeKey(statKey) || 'strength';
  const tiers = DESCRIPTIVE_ATTRIBUTE_TIER_LABELS[normKey] || DESCRIPTIVE_ATTRIBUTE_TIER_LABELS.strength;
  const numScore = Number(score);
  const val = Number.isFinite(numScore) ? numScore : 10;
  for (const tier of tiers) {
    if (val >= tier.min) {
      return tier.label;
    }
  }
  return tiers[tiers.length - 1].label;
}

/**
 * Calculates ability modifier according to standard d20: floor((score - 10) / 2)
 */
function getModifier(score) {
  return Math.floor((Number(score) - 10) / 2);
}

/**
 * Formats modifier with a + or - sign, e.g. +2 or -1 or +0
 */
function formatModifier(score) {
  const mod = getModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Calculates level from cumulative XP using the configured Pathfinder 1e Fast progression table.
 * Note: Levels 1-10 are the currently configured XP thresholds, not a permanent design cap.
 */
function getLevelForXp(xp) {
  const currentXp = Math.max(0, parseInt(xp, 10) || 0);
  const configuredLevels = Object.keys(FAST_XP_TABLE)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  for (const lvl of configuredLevels) {
    if (currentXp >= FAST_XP_TABLE[lvl]) {
      return lvl;
    }
  }
  return 1;
}

/**
 * Returns required XP for the next level if configured in FAST_XP_TABLE, or null if beyond configured table.
 */
function getXpForNextLevel(level) {
  const lvl = Math.max(1, parseInt(level, 10) || 1);
  if (Object.prototype.hasOwnProperty.call(FAST_XP_TABLE, lvl + 1)) {
    return FAST_XP_TABLE[lvl + 1];
  }
  return null;
}

/**
 * Fighter Battle-Hardened progression (PHASE-7A4-LEVELS-AND-CONSTITUTION.md):
 * - Level 1-4: +(1 + L) Max HP, +1 Fortitude save
 * - Level 5+:  +(2 * L) Max HP, +2 Fortitude save, +1 Will save
 */
function getFighterBattleHardenedBonus(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  if (lvl >= 5) {
    return {
      hpBonus: 2 * lvl,
      fortBonus: 2,
      willBonus: 1
    };
  }
  return {
    hpBonus: 1 + lvl,
    fortBonus: 1,
    willBonus: 0
  };
}

/**
 * Canonical Max HP calculation (PHASE-7A4-LEVELS-AND-CONSTITUTION.md §2.1):
 * MaxHP(L, c, M_con) = max(L, H_1(c) + (L - 1) * H_lvl(c) + B_class(L, c) + L * M_con)
 *
 * Accepts:
 * - calculateCanonicalMaxHp(level, characterClass, effectiveConMod)
 * - calculateCanonicalMaxHp(characterClass, level, effectiveConMod)
 * - calculateCanonicalMaxHp(characterObject, equipmentOrNull)
 */
function calculateCanonicalMaxHp(arg1, arg2, arg3) {
  if (arg1 && typeof arg1 === 'object') {
    const eff = getEffectiveStats(arg1, arg2 || arg1._equipment || null);
    const lvl = Math.max(1, Math.floor(Number(eff.level) || 1));
    const cls = String(eff.class || 'FIGHTER').toUpperCase();
    const conMod = getModifier(eff.constitution !== undefined ? eff.constitution : 10);
    return calculateCanonicalMaxHp(lvl, cls, conMod);
  }

  let level = arg1;
  let characterClass = arg2;
  const effectiveConMod = arg3;

  if (typeof arg1 === 'string' && Number.isNaN(Number(arg1))) {
    characterClass = arg1;
    level = arg2;
  }

  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const cls = String(characterClass || 'FIGHTER').toUpperCase();
  const conMod = Math.floor(Number(effectiveConMod) || 0);

  let h1 = 8;
  let hLvl = 5;
  let classHpBonus = 0;

  if (cls === 'FIGHTER') {
    h1 = 10;
    hLvl = 6;
    classHpBonus = getFighterBattleHardenedBonus(lvl).hpBonus;
  } else if (cls === 'RANGER') {
    h1 = 10;
    hLvl = 6;
    classHpBonus = 0;
  } else if (cls === 'CLERIC') {
    h1 = 8;
    hLvl = 5;
    classHpBonus = 0;
  }

  const rawMaxHp = h1 + ((lvl - 1) * hLvl) + classHpBonus + (lvl * conMod);
  return Math.max(lvl, rawMaxHp);
}

/**
 * Equipment CON HP clamp rule (Rule A, PHASE-7A4-LEVELS-AND-CONSTITUTION.md §3):
 * - Equipping CON gear raises Max HP only; Current HP does not increase automatically.
 * - Unequipping or swapping CON gear clamps Current HP to [1, newMaxHp] so a living hero never dies.
 */
function applyEquipmentConHpClamp(oldCurrentHp, newMaxHp) {
  const cur = Math.floor(Number(oldCurrentHp) || 1);
  const max = Math.max(1, Math.floor(Number(newMaxHp) || 1));
  return Math.max(1, Math.min(cur, max));
}

/**
 * Permanent CON point investment rule (Rule B, PHASE-7A4-LEVELS-AND-CONSTITUTION.md §4):
 * - If effective CON modifier increases, both Max HP and Current HP increase by hpDelta (+L).
 * - If effective CON modifier does not change (odd CON score), hpDelta is 0.
 * - Never grants a free full heal.
 */
function applyPermanentConHpIncrease(oldCurrentHp, oldMaxHp, newMaxHp) {
  const cur = Math.floor(Number(oldCurrentHp) || 1);
  const prevMax = Math.max(1, Math.floor(Number(oldMaxHp) || 1));
  const nextMax = Math.max(1, Math.floor(Number(newMaxHp) || 1));
  const hpDelta = Math.max(0, nextMax - prevMax);
  return Math.max(1, Math.min(nextMax, cur + hpDelta));
}

/**
 * Level-up HP gain rule (Rule C, PHASE-7A4-LEVELS-AND-CONSTITUTION.md §5):
 * - Adds the canonical Max HP delta for the new level(s) to Current HP without full healing.
 */
function applyLevelUpHpGain(oldCurrentHp, oldMaxHp, newMaxHp) {
  const cur = Math.floor(Number(oldCurrentHp) || 1);
  const prevMax = Math.max(1, Math.floor(Number(oldMaxHp) || 1));
  const nextMax = Math.max(1, Math.floor(Number(newMaxHp) || 1));
  const levelHpDelta = Math.max(0, nextMax - prevMax);
  return Math.max(1, Math.min(nextMax, cur + levelHpDelta));
}

/**
 * Calculates HP gained at a given level based on class and Constitution score.
 * Uses calculateCanonicalMaxHp so Level 1 returns H_1 + B_class(1) + conMod and Level L > 1 returns the exact level delta.
 */
function getHpPerLevel(classType, conScore, level = 1) {
  const conMod = getModifier(conScore !== undefined ? conScore : 10);
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  if (lvl === 1) {
    return calculateCanonicalMaxHp(1, classType, conMod);
  }
  const prevMax = calculateCanonicalMaxHp(lvl - 1, classType, conMod);
  const nextMax = calculateCanonicalMaxHp(lvl, classType, conMod);
  return Math.max(1, nextMax - prevMax);
}

/**
 * Calculates attack progression bonus based on class and level.
 * Fighter & Ranger: level - 1
 * Cleric: Math.ceil(level * 3 / 4) (PHASE-7A4-FINAL-OWNER-DECISIONS.md)
 * Supports both (classType, level) and (level, classType) argument orders.
 */
function getLevelAttackBonus(classTypeOrLevel, levelOrClassType) {
  let upper = '';
  let rawLvl = 1;
  if (typeof classTypeOrLevel === 'number') {
    rawLvl = classTypeOrLevel;
    upper = String(levelOrClassType || '').toUpperCase();
  } else {
    upper = String(classTypeOrLevel || '').toUpperCase();
    rawLvl = levelOrClassType;
  }
  const lvl = Math.max(1, parseInt(rawLvl, 10) || 1);
  if (upper === 'CLERIC') {
    return Math.ceil((lvl * 3) / 4);
  }
  return lvl - 1;
}

/**
 * Fighter Weapon Training: applies across all weapons.
 * Level 1-4: +0 Atk / +0 Dmg
 * Level 5-8: +1 Atk / +1 Dmg
 * Level 9+:  +2 Atk / +2 Dmg
 */
function getFighterWeaponTraining(level) {
  const lvl = Math.max(1, parseInt(level, 10) || 1);
  if (lvl >= 9) return { attack: 2, damage: 2 };
  if (lvl >= 5) return { attack: 1, damage: 1 };
  return { attack: 0, damage: 0 };
}

/**
 * Fighter Armor Training: increases Maximum DEX allowed by armor.
 * Level 1-2: +0
 * Level 3-6: +1
 * Level 7+:  +2
 */
function getFighterArmorTrainingMaxDexBonus(level) {
  const lvl = Math.max(1, parseInt(level, 10) || 1);
  if (lvl >= 7) return 2;
  if (lvl >= 3) return 1;
  return 0;
}

/**
 * Ranger Favored Enemy — Option A (PHASE-7A4-FINAL-OWNER-DECISIONS.md OC-3):
 * - Level 1-3: +2 Attack / +2 Damage / +0 AC
 * - Level 4-7: +3 Attack / +3 Damage / +0 AC
 * - Level 8:   +4 Attack / +4 Damage / +0 AC
 * - Level 9+:  +4 Attack / +4 Damage / +2 AC
 * Does NOT expand critical hit range.
 * Strictly prohibits bonus against Undead under any circumstance.
 */
function getRangerFavoredEnemyBonus(character, monster) {
  if (!character || (character.class || '').toUpperCase() !== 'RANGER' || !monster) {
    return { attack: 0, damage: 0, ac: 0 };
  }

  if (!doesMonsterMatchRangerFavoredEnemy(character, monster)) {
    return { attack: 0, damage: 0, ac: 0 };
  }

  const lvl = Math.max(1, parseInt(character.level, 10) || 1);
  if (lvl >= 9) {
    return { attack: 4, damage: 4, ac: 2 };
  }
  if (lvl === 8) {
    return { attack: 4, damage: 4, ac: 0 };
  }
  if (lvl >= 4) {
    return { attack: 3, damage: 3, ac: 0 };
  }
  return { attack: 2, damage: 2, ac: 0 };
}

/**
 * Cleric Holy Radiance / Sacred Knowledge: passive class ability against Undead.
 * Level 1-4: +2 Atk / +3 Dmg / +2 AC
 * Level 5-8: +3 Atk / +4 Dmg / +3 AC
 * Level 9+:  +4 Atk / +5 Dmg / +4 AC
 */
function getClericHolyRadianceBonus(character, ...rest) {
  let charClass = '';
  let charLevel = 1;
  let targetMonster = null;

  if (typeof character === 'string') {
    charClass = character;
    if (rest.length >= 2) {
      charLevel = rest[0] || 1;
      targetMonster = rest[1];
    } else if (rest.length === 1) {
      targetMonster = rest[0];
    }
  } else if (character && typeof character === 'object') {
    charClass = character.class || '';
    charLevel = character.level || 1;
    targetMonster = rest[0];
  }

  if (charClass.toUpperCase() !== 'CLERIC' || !targetMonster) {
    return { attack: 0, damage: 0, ac: 0 };
  }

  if (!doesMonsterMatchSacredKnowledge(targetMonster)) {
    return { attack: 0, damage: 0, ac: 0 };
  }

  const lvl = Math.max(1, parseInt(charLevel, 10) || 1);
  if (lvl >= 9) {
    return { attack: 4, damage: 5, ac: 4 };
  }
  if (lvl >= 5) {
    return { attack: 3, damage: 4, ac: 3 };
  }
  return { attack: 2, damage: 3, ac: 2 };
}

/**
 * Backwards-compatibility alias for Cleric Divine Power -> Holy Radiance
 */
function getClericDivinePowerBonus(...args) {
  return getClericHolyRadianceBonus(...args);
}

/**
 * Calculates maximum Divine Charges for a Cleric (Phase 7C):
 * Max Divine Charges = max(1, 6 + Hero Level + WIS modifier)
 * Uses effective WIS modifier (including equipment bonuses). Non-Clerics have 0 max charges.
 * Supports:
 * - calculateMaxDivineCharges(level, characterClass, effectiveWisMod)
 * - calculateMaxDivineCharges(characterClass, level, effectiveWisMod)
 * - calculateMaxDivineCharges(characterObject, equipmentOrNull)
 */
function calculateMaxDivineCharges(arg1, arg2, arg3) {
  if (arg1 && typeof arg1 === 'object') {
    const cls = String(arg1.class || '').toUpperCase();
    if (cls !== 'CLERIC') return 0;
    const eq = arg2 || arg1._equipment || null;
    let wisScore = arg1.wisdom !== undefined ? Number(arg1.wisdom) : 10;
    if (eq && typeof eq === 'object' && arg1.base_wisdom === undefined) {
      const seen = new Set();
      const slotProps = ['meleeWeapon', 'rangedWeapon', 'armor', 'shield', 'ring', 'cloak', 'neck', 'belt', 'feet'];
      const items = [];
      for (const p of slotProps) {
        if (eq[p] && typeof eq[p] === 'object') items.push(eq[p]);
      }
      if (Array.isArray(eq.items)) {
        for (const it of eq.items) {
          if (it && typeof it === 'object' && it.equipped_slot) items.push(it);
        }
      }
      for (const it of items) {
        const key = it.instance_id || it.id || it;
        if (seen.has(key)) continue;
        seen.add(key);
        wisScore += extractItemStatBonuses(it).wisdom;
      }
    }
    const lvl = Math.max(1, Math.floor(Number(arg1.level) || 1));
    return calculateMaxDivineCharges(lvl, cls, getModifier(wisScore));
  }

  let level = arg1;
  let characterClass = arg2;
  const effectiveWisMod = arg3;

  if (typeof arg1 === 'string' && Number.isNaN(Number(arg1))) {
    characterClass = arg1;
    level = arg2;
  }

  const cls = String(characterClass || '').toUpperCase();
  if (cls !== 'CLERIC') {
    return 0;
  }

  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  const wisMod = Math.floor(Number(effectiveWisMod) || 0);
  return Math.max(1, 6 + lvl + wisMod);
}

/**
 * Clamps current Divine Charges to [0, maxDivineCharges] without refilling when capacity grows.
 * If currentCharges is null or undefined (uninitialized legacy row), initializes to maxDivineCharges.
 */
function clampDivineCharges(currentCharges, maxDivineCharges, isCleric = true) {
  if (!isCleric) return 0;
  const maxCharges = Math.max(0, Math.floor(Number(maxDivineCharges) || 0));
  if (currentCharges === null || currentCharges === undefined) {
    return maxCharges;
  }
  const cur = Math.floor(Number(currentCharges));
  if (!Number.isFinite(cur)) {
    return maxCharges;
  }
  return Math.max(0, Math.min(cur, maxCharges));
}

/**
 * Returns structured Cleric Divine Charges state and ability availability.
 */
function getClericDivineChargeInfo(character, equipment = null) {
  if (!character || String(character.class || '').toUpperCase() !== 'CLERIC') {
    return {
      currentCharges: 0,
      maxCharges: 0,
      canBattlePrayer: false,
      canSmite: false,
      canDivineShield: false,
      costs: { BATTLE_PRAYER: 1, SMITE: 1, DIVINE_SHIELD: 2 }
    };
  }
  const eff = getEffectiveStats(character, equipment || character._equipment || null);
  const maxCharges = calculateMaxDivineCharges(eff.level, 'CLERIC', getModifier(eff.wisdom));
  const currentCharges = clampDivineCharges(character.divine_charges, maxCharges, true);
  return {
    currentCharges,
    maxCharges,
    canBattlePrayer: currentCharges >= 1,
    canSmite: currentCharges >= 1,
    canDivineShield: currentCharges >= 2,
    costs: { BATTLE_PRAYER: 1, SMITE: 1, DIVINE_SHIELD: 2 }
  };
}

/**
 * Cleric Self-Healing tier information based on level.
 */
function getClericSelfHealInfo(level) {
  const lvl = Math.max(1, parseInt(level, 10) || 1);
  let dice = '1d6';
  let maxUses = 2;
  if (lvl >= 9) {
    dice = '5d6';
    maxUses = 4;
  } else if (lvl >= 7) {
    dice = '4d6';
    maxUses = 3;
  } else if (lvl >= 5) {
    dice = '3d6';
    maxUses = 3;
  } else if (lvl >= 3) {
    dice = '2d6';
    maxUses = 2;
  }
  return { dice, diceCount: parseInt(dice, 10) || 1, maxUses };
}

/**
 * Returns remaining self-healing uses for a Cleric.
 */
function getClericRemainingHealUses(character) {
  if (!character || (character.class || '').toUpperCase() !== 'CLERIC') {
    return 0;
  }
  const info = getClericSelfHealInfo(character.level);
  const spent = character.cleric_heal_uses || 0;
  return Math.max(0, info.maxUses - spent);
}

/**
 * Performs Cleric Self-Healing outside of combat.
 */
function performClericSelfHeal(db, characterId, options = {}) {
  const rng = typeof options === 'function' ? options : (options && options.rng ? options.rng : Math.random);

  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Hero is not eligible for healing.');
    }
    if (character.class !== 'CLERIC') {
      throw new Error('Only Clerics possess the divine gift of Self-Healing.');
    }

    const activeThreat = tx.prepare("SELECT status FROM encounters WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT') LIMIT 1").get(characterId);
    if (activeThreat) {
      throw new Error('Cleric Self-Healing can only be performed outside of combat and when no unresolved encounter is active.');
    }

    if (character.current_hp >= character.max_hp) {
      throw new Error('Hero is already at maximum health.');
    }

    const remaining = getClericRemainingHealUses(character);
    if (remaining <= 0) {
      throw new Error('You have exhausted your Self-Healing uses for this expedition. Rest in a safe city to restore them.');
    }

    const eq = getCharacterEquipment(tx, characterId);
    const eff = getEffectiveStats(character, eq);
    const info = getClericSelfHealInfo(character.level);
    const rollResult = rollDice(info.dice, rng);
    const wisMod = getModifier(eff.wisdom);
    const healAmount = Math.max(1, rollResult.total + wisMod);

    const oldHp = character.current_hp;
    const newHp = Math.min(character.max_hp, oldHp + healAmount);
    const actualHealed = newHp - oldHp;

    tx.prepare(`
      UPDATE characters
      SET current_hp = ?, cleric_heal_uses = cleric_heal_uses + 1
      WHERE id = ?
    `).run(newHp, characterId);

    return {
      healed: actualHealed,
      currentHp: newHp,
      maxHp: character.max_hp,
      remainingUses: remaining - 1,
      diceRolled: info.dice
    };
  });
}

/**
 * Free full healing and Cleric recharge at a safe city haven.
 */
function performCityRest(db, characterId) {
  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT c.*, t.terrain, t.is_safe FROM characters c JOIN map_tiles t ON c.tile_id = t.id WHERE c.id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Hero is not eligible for city rest.');
    }
    if (character.terrain !== 'CITY' || character.is_safe !== 1) {
      throw new Error('Rest and free healing is only granted within peaceful sanctuary cities.');
    }

    const activeThreat = tx.prepare("SELECT status FROM encounters WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT') LIMIT 1").get(characterId);
    if (activeThreat) {
      throw new Error('Cannot rest or receive city healing while engaged in combat or an unresolved encounter.');
    }

    const eq = getCharacterEquipment(tx, characterId);
    const eff = getEffectiveStats(character, eq);
    const canonicalMaxHp = calculateCanonicalMaxHp(eff.level, eff.class, getModifier(eff.constitution));
    const isCleric = String(eff.class || '').toUpperCase() === 'CLERIC';
    const maxDivineCharges = isCleric
      ? calculateMaxDivineCharges(eff.level, 'CLERIC', getModifier(eff.wisdom))
      : 0;

    try {
      tx.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?, cleric_heal_uses = 0, divine_charges = ?
        WHERE id = ?
      `).run(canonicalMaxHp, canonicalMaxHp, maxDivineCharges, characterId);
    } catch {
      tx.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?, cleric_heal_uses = 0
        WHERE id = ?
      `).run(canonicalMaxHp, canonicalMaxHp, characterId);
    }

    const selfHealInfo = isCleric ? getClericSelfHealInfo(eff.level) : { maxUses: 0 };
    return {
      healedToFull: true,
      currentHp: canonicalMaxHp,
      maxHp: canonicalMaxHp,
      clericHealUses: 0,
      clericUsesRechargedTo: selfHealInfo.maxUses,
      divineCharges: maxDivineCharges,
      divineChargesRechargedTo: maxDivineCharges,
      maxDivineCharges
    };
  });
}

/**
 * Validates character creation input against Phase 7A.3 / 7B rules:
 * - 6 attributes: STR, DEX, CON, INT, WIS, CHA
 * - Each attribute must be an integer in [8, 18]
 * - Total attribute sum must equal exactly 72
 */
function validateCharacterCreation(classType, stats, name) {
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Hero must have a name.');
  } else if (name.trim().length > 30) {
    errors.push('Name cannot exceed 30 characters.');
  }

  const upperClass = (classType || '').toUpperCase();
  const classBase = config.classBases[upperClass];
  if (!classBase) {
    errors.push(`Unknown class: ${classType}. Allowed classes are FIGHTER, RANGER, CLERIC.`);
    return { valid: false, errors };
  }

  if (!stats || typeof stats !== 'object') {
    errors.push('Attribute scores (stats) are missing or in an invalid format.');
    return { valid: false, errors };
  }

  const minAllowed = config.statRules.minScore !== undefined ? config.statRules.minScore : 8;
  const maxAllowed = config.statRules.maxScore !== undefined ? config.statRules.maxScore : 18;
  const requiredTotal = config.statRules.requiredTotalSum !== undefined ? config.statRules.requiredTotalSum : 72;

  let totalSum = 0;

  for (const stat of STAT_KEYS) {
    const rawVal = stats[stat];
    const val = Number(rawVal);

    if (!Number.isInteger(val)) {
      errors.push(`${stat} must be an integer.`);
      continue;
    }

    if (val < minAllowed) {
      errors.push(`${stat} (${val}) cannot drop below the minimum of ${minAllowed} at creation.`);
    }

    if (val > maxAllowed) {
      errors.push(`${stat} (${val}) cannot exceed the maximum of ${maxAllowed} at creation.`);
    }

    totalSum += val;
  }

  if (totalSum !== requiredTotal) {
    errors.push(`Total attribute points must equal exactly ${requiredTotal}. Current total is ${totalSum}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    classType: upperClass,
    sanitizedName: (name || '').trim()
  };
}

/**
 * Reconciles a character's Max HP (and clamps Current HP if needed) on login/reload.
 * Never adds a Max HP difference to Current HP during login reconciliation.
 * Preserves permadeath: dead heroes remain dead with 0 HP.
 */
function reconcileCharacterHpOnLoad(db, characterOrId) {
  if (!db || !characterOrId) return null;
  const charId = typeof characterOrId === 'object' ? characterOrId.id : Number(characterOrId);
  if (!charId) return typeof characterOrId === 'object' ? characterOrId : null;

  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(charId);
  if (!row) return null;

  if (row.is_alive !== 1 || Number(row.current_hp) <= 0) {
    if (row.is_alive !== 1 && Number(row.current_hp) !== 0) {
      db.prepare('UPDATE characters SET current_hp = 0 WHERE id = ? AND is_alive = 0').run(charId);
      row.current_hp = 0;
    }
    return row;
  }

  const equipment = getCharacterEquipment(db, charId);
  const eff = getEffectiveStats(row, equipment);
  const canonicalMaxHp = calculateCanonicalMaxHp(eff.level, eff.class, getModifier(eff.constitution));
  const reconciledCurrentHp = applyEquipmentConHpClamp(row.current_hp, canonicalMaxHp);
  const isCleric = String(eff.class || '').toUpperCase() === 'CLERIC';
  const maxDivineCharges = isCleric
    ? calculateMaxDivineCharges(eff.level, 'CLERIC', getModifier(eff.wisdom))
    : 0;
  const reconciledDivineCharges = clampDivineCharges(row.divine_charges, maxDivineCharges, isCleric);

  if (
    Number(row.max_hp) !== canonicalMaxHp ||
    Number(row.current_hp) !== reconciledCurrentHp ||
    row.divine_charges === null ||
    row.divine_charges === undefined ||
    Number(row.divine_charges) !== reconciledDivineCharges
  ) {
    try {
      db.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?, divine_charges = ?
        WHERE id = ? AND is_alive = 1
      `).run(canonicalMaxHp, reconciledCurrentHp, reconciledDivineCharges, charId);
      row.divine_charges = reconciledDivineCharges;
    } catch {
      db.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?
        WHERE id = ? AND is_alive = 1
      `).run(canonicalMaxHp, reconciledCurrentHp, charId);
    }
    row.max_hp = canonicalMaxHp;
    row.current_hp = reconciledCurrentHp;
  }

  row.max_divine_charges = maxDivineCharges;
  return row;
}

/**
 * Fetches a character row by primary key ID, or null if not found.
 */
function getCharacterById(db, characterId) {
  if (!db || !characterId) return null;
  const id = typeof characterId === 'object' ? characterId.id : Number(characterId);
  return db.prepare('SELECT * FROM characters WHERE id = ?').get(id) || null;
}

/**
 * Fetches the living character for a given user, or null if none.
 */
function getLivingCharacterByUserId(db, userId) {
  const stmt = db.prepare(`
    SELECT c.*, t.name as tile_name, t.x as tile_x, t.y as tile_y, t.terrain as tile_terrain, t.is_safe as tile_safe
    FROM characters c
    JOIN map_tiles t ON c.tile_id = t.id
    WHERE c.user_id = ? AND c.is_alive = 1
  `);
  return stmt.get(userId) || null;
}

/**
 * Creates a new character for a user, enforcing one living character rule,
 * Phase 7A.3 72-point attribute rules, and Phase 7A.4 Ranger 14-family Favored Enemy taxonomy.
 */
function createCharacter(db, {
  userId,
  name,
  classType,
  stats,
  useClassDefaults,
  startingGold,
  favoredEnemyFamily,
  favoredEnemyType,
  favoredEnemySubtype,
  primaryWeapon
}) {
  if (!stats && useClassDefaults && classType) {
    const preset = config.classBases[String(classType).toUpperCase().trim()];
    if (preset) {
      stats = { ...preset };
    }
  }
  const validation = validateCharacterCreation(classType, stats, name);
  if (!validation.valid) {
    const error = new Error(validation.errors.join(' '));
    error.status = 400;
    error.validationErrors = validation.errors;
    throw error;
  }

  let rawFavoredType = favoredEnemyFamily !== undefined && favoredEnemyFamily !== null && String(favoredEnemyFamily).trim() !== ''
    ? String(favoredEnemyFamily).trim()
    : (favoredEnemyType ? String(favoredEnemyType).trim() : '');
  let rawFavoredSub = favoredEnemySubtype ? String(favoredEnemySubtype).trim() : '';
  if (rawFavoredType.includes(':')) {
    const parts = rawFavoredType.split(':');
    rawFavoredType = (parts[0] || '').trim();
    if (!rawFavoredSub && parts[1]) {
      rawFavoredSub = parts[1].trim();
    }
  }

  let finalFavoredEnemyFamily = null;
  let finalFavoredEnemyType = null;
  let finalFavoredEnemySubtype = null;

  if (validation.classType === 'RANGER' && rawFavoredType) {
    const favCheck = validateRangerFavoredEnemyChoice(rawFavoredType, rawFavoredSub, { allowLegacy: true });
    if (!favCheck.valid) {
      const error = new Error(favCheck.error || `Invalid Favored Enemy type: ${rawFavoredType}.`);
      error.status = 400;
      throw error;
    }
    finalFavoredEnemyFamily = favCheck.family;
    finalFavoredEnemyType = rawFavoredType.toUpperCase().trim();
    finalFavoredEnemySubtype = rawFavoredSub ? rawFavoredSub.trim().toLowerCase() : null;
  }

  const defaultPrimary = (validation.classType === 'RANGER') ? 'RANGED' : 'MELEE';
  const chosenPrimary = (primaryWeapon && ['MELEE', 'RANGED'].includes(primaryWeapon.toUpperCase()))
    ? primaryWeapon.toUpperCase()
    : defaultPrimary;

  const initialAttributesJson = JSON.stringify({
    strength: Number(stats.strength),
    constitution: Number(stats.constitution),
    dexterity: Number(stats.dexterity),
    intelligence: Number(stats.intelligence),
    wisdom: Number(stats.wisdom),
    charisma: Number(stats.charisma)
  });

  return withTransaction(db, (tx) => {
    const existing = tx.prepare('SELECT id FROM characters WHERE user_id = ? AND is_alive = 1').get(userId);
    if (existing) {
      const err = new Error('User already has a living hero. Only one living hero is permitted.');
      err.status = 409;
      throw err;
    }

    let startTile = tx.prepare("SELECT id FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1").get();
    if (!startTile) {
      startTile = tx.prepare('SELECT id FROM map_tiles WHERE is_passable = 1 LIMIT 1').get();
    }

    const maxHp = calculateCanonicalMaxHp(1, validation.classType, getModifier(stats.constitution));
    const initialDivineCharges = validation.classType === 'CLERIC'
      ? calculateMaxDivineCharges(1, 'CLERIC', getModifier(stats.wisdom))
      : 0;
    const goldToGrant = startingGold !== undefined ? startingGold : config.startingGold;

    let characterId;
    try {
      const insertStmt = tx.prepare(`
        INSERT INTO characters (
          user_id, name, class, is_alive, level, xp, gold,
          strength, constitution, dexterity, intelligence, wisdom, charisma,
          current_hp, max_hp, tile_id,
          favored_enemy_type, favored_enemy_subtype, favored_enemy_family,
          attribute_points, initial_attributes_json,
          cleric_heal_uses, divine_charges, primary_weapon
        ) VALUES (
          ?, ?, ?, 1, 1, 0, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          0, ?,
          0, ?, ?
        )
      `);

      const result = insertStmt.run(
        userId,
        validation.sanitizedName,
        validation.classType,
        goldToGrant,
        stats.strength,
        stats.constitution,
        stats.dexterity,
        stats.intelligence,
        stats.wisdom,
        stats.charisma,
        maxHp,
        maxHp,
        startTile.id,
        finalFavoredEnemyType,
        finalFavoredEnemySubtype,
        finalFavoredEnemyFamily,
        initialAttributesJson,
        initialDivineCharges,
        chosenPrimary
      );
      characterId = Number(result.lastInsertRowid);
    } catch {
      // Fallback for minimal test schemas that have not run migration 014
      const fallbackStmt = tx.prepare(`
        INSERT INTO characters (
          user_id, name, class, is_alive, level, xp, gold,
          strength, constitution, dexterity, intelligence, wisdom, charisma,
          current_hp, max_hp, tile_id,
          favored_enemy_type, favored_enemy_subtype, cleric_heal_uses, primary_weapon
        ) VALUES (
          ?, ?, ?, 1, 1, 0, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, 0, ?
        )
      `);
      const result = fallbackStmt.run(
        userId,
        validation.sanitizedName,
        validation.classType,
        goldToGrant,
        stats.strength,
        stats.constitution,
        stats.dexterity,
        stats.intelligence,
        stats.wisdom,
        stats.charisma,
        maxHp,
        maxHp,
        startTile.id,
        finalFavoredEnemyType,
        finalFavoredEnemySubtype,
        chosenPrimary
      );
      characterId = Number(result.lastInsertRowid);
    }

    const starterItemsByClass = {
      FIGHTER: [
        { name: 'Longsword', slot: 'MELEE' },
        { name: 'Shortbow', slot: 'RANGED' },
        { name: 'Chain Shirt', slot: 'ARMOR' },
        { name: 'Light Steel Shield', slot: 'SHIELD' }
      ],
      RANGER: [
        { name: 'Shortsword', slot: 'MELEE' },
        { name: 'Longbow', slot: 'RANGED' },
        { name: 'Leather Armor', slot: 'ARMOR' }
      ],
      CLERIC: [
        { name: 'Heavy Mace', slot: 'MELEE' },
        { name: 'Sling', slot: 'RANGED' },
        { name: 'Scale Mail', slot: 'ARMOR' },
        { name: 'Light Steel Shield', slot: 'SHIELD' }
      ]
    };

    const starterItems = starterItemsByClass[validation.classType] || [];
    const starterMeta = JSON.stringify({ is_starter: true });
    const insertItemStmt = tx.prepare(`
      INSERT INTO item_instances (
        item_definition_id, owner_type, owner_character_id, equipped_slot, modifications
      ) VALUES (?, 'CHARACTER', ?, ?, ?)
    `);

    for (const gear of starterItems) {
      const def = tx.prepare('SELECT id FROM item_definitions WHERE name = ?').get(gear.name);
      if (def) {
        insertItemStmt.run(def.id, characterId, gear.slot, starterMeta);
      }
    }

    const potionDef = tx.prepare("SELECT id FROM item_definitions WHERE name = 'Minor Healing Potion'").get();
    if (potionDef) {
      insertItemStmt.run(potionDef.id, characterId, null, starterMeta);
      insertItemStmt.run(potionDef.id, characterId, null, starterMeta);
    }

    const createdRow = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (createdRow) {
      createdRow.max_divine_charges = initialDivineCharges;
    }
    return createdRow;
  });
}

/**
 * Permanently spends 1 available milestone attribute point on one of the six attributes
 * (STR, DEX, CON, INT, WIS, CHA).
 * Enforces:
 * - Hero is alive
 * - Hero is not in active combat or an unresolved encounter
 * - attribute_points > 0
 * - Atomic update to prevent race conditions or duplicate spending
 * - Rule B for permanent CON increases (+L to both Max HP and Current HP when CON modifier increases; 0 on odd score; no full heal)
 */
function spendAttributePoint(db, characterId, attributeName) {
  const statCol = normalizeAttributeKey(attributeName);
  if (!statCol || !STAT_KEYS.includes(statCol)) {
    const err = new Error(`Invalid attribute: ${attributeName}. Allowed: STR, DEX, CON, INT, WIS, CHA.`);
    err.status = 400;
    err.code = 'INVALID_ATTRIBUTE';
    throw err;
  }

  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      const err = new Error('Dead characters cannot spend attribute points.');
      err.status = 400;
      throw err;
    }

    const activeThreat = tx.prepare("SELECT status FROM encounters WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT') LIMIT 1").get(characterId);
    if (activeThreat) {
      const err = new Error('Cannot spend attribute points during active combat or an unresolved encounter.');
      err.status = 409;
      err.code = 'COMBAT_LOCKED_ATTRIBUTES';
      throw err;
    }

    const availablePoints = Math.max(0, parseInt(character.attribute_points, 10) || 0);
    if (availablePoints <= 0) {
      const err = new Error('No unspent attribute points available.');
      err.status = 400;
      err.code = 'NO_ATTRIBUTE_POINTS';
      throw err;
    }

    const equipment = getCharacterEquipment(tx, characterId);
    const effBefore = getEffectiveStats(character, equipment);
    const oldMaxHp = calculateCanonicalMaxHp(character.level, character.class, getModifier(effBefore.constitution));

    const updateRes = tx.prepare(`
      UPDATE characters
      SET ${statCol} = ${statCol} + 1,
          attribute_points = attribute_points - 1
      WHERE id = ? AND is_alive = 1 AND attribute_points > 0
    `).run(characterId);

    if (updateRes.changes !== 1) {
      const err = new Error('Could not spend attribute point due to concurrent state modification.');
      err.status = 409;
      throw err;
    }

    const updated = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    const effAfter = getEffectiveStats(updated, equipment);
    const newMaxHp = calculateCanonicalMaxHp(updated.level, updated.class, getModifier(effAfter.constitution));
    const newCurrentHp = statCol === 'constitution'
      ? applyPermanentConHpIncrease(character.current_hp, oldMaxHp, newMaxHp)
      : applyEquipmentConHpClamp(character.current_hp, newMaxHp);
    const isCleric = String(updated.class || '').toUpperCase() === 'CLERIC';
    const newMaxDivineCharges = isCleric
      ? calculateMaxDivineCharges(updated.level, 'CLERIC', getModifier(effAfter.wisdom))
      : 0;
    const newDivineCharges = clampDivineCharges(character.divine_charges, newMaxDivineCharges, isCleric);

    try {
      tx.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?, divine_charges = ?
        WHERE id = ?
      `).run(newMaxHp, newCurrentHp, newDivineCharges, characterId);
    } catch {
      tx.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?
        WHERE id = ?
      `).run(newMaxHp, newCurrentHp, characterId);
    }

    const finalCharacter = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    const hpGain = Math.max(0, newMaxHp - oldMaxHp);
    return {
      character: finalCharacter,
      attribute: statCol,
      attributeSpent: statCol,
      newBaseScore: finalCharacter[statCol],
      newScore: finalCharacter[statCol],
      newEffectiveScore: effAfter[statCol],
      remainingAttributePoints: finalCharacter.attribute_points || 0,
      hpDelta: hpGain,
      hpGain,
      hpGained: hpGain,
      currentHp: finalCharacter.current_hp,
      maxHp: finalCharacter.max_hp,
      divineCharges: finalCharacter.divine_charges ?? newDivineCharges,
      maxDivineCharges: newMaxDivineCharges
    };
  });
}

/**
 * Counts how many milestone attribute points are awarded when advancing from oldLevel to newLevel.
 * Milestones are strictly Levels 2, 4, 6, 8, and 10 (Prompt §3).
 */
function countMilestoneAttributePointsEarned(oldLevel, newLevel) {
  const fromLvl = Math.max(1, Math.floor(Number(oldLevel) || 1));
  const toLvl = Math.max(fromLvl, Math.floor(Number(newLevel) || 1));
  let earned = 0;
  for (let lvl = fromLvl + 1; lvl <= toLvl; lvl++) {
    if (ATTRIBUTE_MILESTONE_LEVELS.includes(lvl)) {
      earned += 1;
    }
  }
  return earned;
}

/**
 * Applies XP & level-up progression for a character inside a transaction or database connection:
 * - Calculates new level from newXp (or accepts a direct target level when 2 <= arg <= 30)
 * - Awards +1 attribute_points for each milestone crossed in [2, 4, 6, 8, 10]
 * - Recalculates canonical Max HP using effective CON modifier
 * - Adds levelHpDelta to Current HP without granting a free full heal
 */
function applyCharacterLevelUp(db, characterIdOrObj, newXpOverride = null) {
  const characterId = characterIdOrObj && typeof characterIdOrObj === 'object'
    ? characterIdOrObj.id
    : characterIdOrObj;
  return withTransaction(db, (tx) => {
    const charRow = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!charRow) return null;

    const oldLevel = Math.max(1, Math.floor(Number(charRow.level) || 1));
    let currentXp;
    let newLevel;

    if (newXpOverride !== null && newXpOverride !== undefined && Number(newXpOverride) >= 1 && Number(newXpOverride) <= 30) {
      newLevel = Math.max(oldLevel, Math.floor(Number(newXpOverride)));
      currentXp = FAST_XP_TABLE[newLevel] !== undefined
        ? Math.max(Number(charRow.xp) || 0, FAST_XP_TABLE[newLevel])
        : Math.max(0, Math.floor(Number(charRow.xp) || 0));
    } else {
      currentXp = newXpOverride !== null && newXpOverride !== undefined
        ? Math.max(0, Math.floor(Number(newXpOverride) || 0))
        : Math.max(0, Math.floor(Number(charRow.xp) || 0));
      newLevel = Math.max(oldLevel, getLevelForXp(currentXp));
    }

    const equipment = getCharacterEquipment(tx, characterId);
    const eff = getEffectiveStats(charRow, equipment);
    const effectiveConMod = getModifier(eff.constitution);

    let currentHp = Number(charRow.current_hp) || 1;
    let maxHp = Number(charRow.max_hp) || 1;
    let totalHpGain = 0;
    let attributePointsEarned = 0;

    if (newLevel > oldLevel) {
      const oldCanonicalMaxHp = calculateCanonicalMaxHp(oldLevel, charRow.class, effectiveConMod);
      const newCanonicalMaxHp = calculateCanonicalMaxHp(newLevel, charRow.class, effectiveConMod);
      totalHpGain = Math.max(0, newCanonicalMaxHp - oldCanonicalMaxHp);
      maxHp = newCanonicalMaxHp;
      currentHp = applyLevelUpHpGain(currentHp, oldCanonicalMaxHp, newCanonicalMaxHp);
      attributePointsEarned = countMilestoneAttributePointsEarned(oldLevel, newLevel);
    }

    const isCleric = String(charRow.class || '').toUpperCase() === 'CLERIC';
    const newMaxDivineCharges = isCleric
      ? calculateMaxDivineCharges(newLevel, 'CLERIC', getModifier(eff.wisdom))
      : 0;
    const newDivineCharges = clampDivineCharges(charRow.divine_charges, newMaxDivineCharges, isCleric);

    try {
      tx.prepare(`
        UPDATE characters
        SET xp = ?, level = ?, current_hp = ?, max_hp = ?,
            attribute_points = COALESCE(attribute_points, 0) + ?,
            divine_charges = ?
        WHERE id = ?
      `).run(currentXp, newLevel, currentHp, maxHp, attributePointsEarned, newDivineCharges, characterId);
    } catch {
      try {
        tx.prepare(`
          UPDATE characters
          SET xp = ?, level = ?, current_hp = ?, max_hp = ?,
              attribute_points = COALESCE(attribute_points, 0) + ?
          WHERE id = ?
        `).run(currentXp, newLevel, currentHp, maxHp, attributePointsEarned, characterId);
      } catch {
        tx.prepare(`
          UPDATE characters
          SET xp = ?, level = ?, current_hp = ?, max_hp = ?
          WHERE id = ?
        `).run(currentXp, newLevel, currentHp, maxHp, characterId);
      }
    }

    const updated = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    const finalCurrentHp = updated ? updated.current_hp : currentHp;
    const finalMaxHp = updated ? updated.max_hp : maxHp;
    return {
      character: updated,
      oldLevel,
      newLevel,
      leveledUp: newLevel > oldLevel,
      totalHpGain,
      hpGain: totalHpGain,
      attributePointsEarned,
      attributePointsAwarded: attributePointsEarned,
      currentHp: finalCurrentHp,
      newCurrentHp: finalCurrentHp,
      maxHp: finalMaxHp,
      newMaxHp: finalMaxHp,
      divineCharges: updated && updated.divine_charges !== undefined ? updated.divine_charges : newDivineCharges,
      maxDivineCharges: newMaxDivineCharges
    };
  });
}

const lastEquipmentByCharacterId = new Map();

function getLastEquipmentForCharacter(characterId) {
  if (!characterId) return null;
  return lastEquipmentByCharacterId.get(Number(characterId)) || null;
}

/**
 * Fetches equipped weapon, armor, shield, and accessories for a character across all 9 slots.
 */
function getCharacterEquipment(db, characterId) {
  const items = db.prepare(`
    SELECT ii.id, ii.id AS instance_id, ii.equipped_slot, id.name, id.category, id.damage_dice,
           id.armor_bonus, id.shield_bonus, id.is_magical, id.buy_price, id.attributes,
           id.max_dex_bonus, id.enhancement_bonus, id.weapon_range_type, id.is_two_handed,
           id.rarity, id.subtype, id.equip_slot as def_equip_slot, id.description
    FROM item_instances ii
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ? AND ii.equipped_slot IS NOT NULL
  `).all(characterId);

  let meleeWeapon = null;
  let rangedWeapon = null;
  let armor = null;
  let shield = null;
  let ring = null;
  let cloak = null;
  let neck = null;
  let belt = null;
  let feet = null;

  for (const it of items) {
    const slot = (it.equipped_slot || '').toUpperCase();
    if (slot === 'MELEE' || slot === 'PREPARED_MELEE') {
      meleeWeapon = it;
    } else if (slot === 'RANGED' || slot === 'PREPARED_RANGED') {
      rangedWeapon = it;
    } else if (slot === 'ARMOR' || slot === 'CHEST') {
      armor = it;
    } else if (slot === 'SHIELD' || slot === 'OFF_HAND') {
      shield = it;
    } else if (slot === 'RING') {
      ring = it;
    } else if (slot === 'CLOAK') {
      cloak = it;
    } else if (slot === 'NECK') {
      neck = it;
    } else if (slot === 'BELT' || slot === 'WAIST') {
      belt = it;
    } else if (slot === 'FEET') {
      feet = it;
    } else if (slot === 'MAIN_HAND') {
      if (it.weapon_range_type === 'RANGED') {
        rangedWeapon = it;
      } else {
        meleeWeapon = it;
      }
    }
  }

  const weapon = meleeWeapon || rangedWeapon;

  const equipment = {
    weapon,
    meleeWeapon,
    rangedWeapon,
    armor,
    shield,
    ring,
    cloak,
    neck,
    belt,
    feet,
    items
  };

  if (armor && typeof armor === 'object') {
    Object.defineProperty(armor, '_equipment', { value: equipment, enumerable: false, configurable: true, writable: true });
  }
  if (shield && typeof shield === 'object') {
    Object.defineProperty(shield, '_equipment', { value: equipment, enumerable: false, configurable: true, writable: true });
  }
  if (characterId) {
    lastEquipmentByCharacterId.set(Number(characterId), equipment);
  }

  return equipment;
}

/**
 * Fetches all inventory items currently in possession of the hero.
 */
function getCharacterInventory(db, characterId) {
  return db.prepare(`
    SELECT ii.id, ii.id AS instance_id, ii.item_definition_id, ii.equipped_slot, ii.owner_character_id,
           ii.modifications,
           id.name, id.category, id.buy_price, id.sell_price, id.is_magical,
           id.damage_dice, id.armor_bonus, id.shield_bonus, id.max_dex_bonus,
           id.enhancement_bonus, id.weapon_range_type, id.is_two_handed,
           id.allowed_classes, id.description, id.attributes,
           id.rarity, id.subtype, id.equip_slot
    FROM item_instances ii
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ?
    ORDER BY ii.equipped_slot DESC, id.category ASC, id.buy_price DESC, ii.id ASC
  `).all(characterId);
}

/**
 * Equips an item into a designated slot (MELEE, RANGED, ARMOR, SHIELD, RING, CLOAK, NECK, BELT, FEET).
 * Enforces:
 * - Blocks dead characters
 * - Blocks changes during active combat or unresolved encounters (status 409, code COMBAT_LOCKED_EQUIPMENT)
 * - Atomically swaps slot items and recalculates canonical Max HP + clamps Current HP via Rule A
 */
function equipItem(db, characterId, itemInstanceId, targetSlot) {
  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      const err = new Error('Dead characters are not eligible to equip items.');
      err.status = 400;
      throw err;
    }

    const activeThreat = tx.prepare("SELECT status FROM encounters WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT') LIMIT 1").get(characterId);
    if (activeThreat) {
      const err = new Error('Cannot change equipment during active combat or an unresolved encounter.');
      err.status = 409;
      err.code = 'COMBAT_LOCKED_EQUIPMENT';
      throw err;
    }

    const item = tx.prepare(`
      SELECT ii.*, id.name, id.category, id.subtype, id.equip_slot as def_equip_slot, id.equip_slot, id.weapon_range_type, id.allowed_classes
      FROM item_instances ii
      JOIN item_definitions id ON ii.item_definition_id = id.id
      WHERE ii.id = ? AND ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ?
    `).get(itemInstanceId, characterId);

    if (!item) {
      const err = new Error('Item not found in character possession.');
      err.status = 403;
      throw err;
    }

    let allowed = [];
    try { allowed = JSON.parse(item.allowed_classes || '[]'); } catch { allowed = []; }
    if (allowed.length > 0 && !allowed.includes(character.class)) {
      const err = new Error(`The ${item.name} cannot be equipped by a ${character.class}.`);
      err.status = 400;
      throw err;
    }

    let slot = (targetSlot || '').toUpperCase().trim();
    if (slot === 'WAIST') slot = 'BELT';
    if (!slot) {
      if (item.category === 'WEAPON') {
        slot = item.weapon_range_type === 'RANGED' ? 'RANGED' : 'MELEE';
      } else if (item.category === 'ARMOR') {
        slot = 'ARMOR';
      } else if (item.category === 'SHIELD') {
        slot = 'SHIELD';
      } else if (item.def_equip_slot || item.equip_slot) {
        slot = (item.def_equip_slot || item.equip_slot).toUpperCase().trim();
        if (slot === 'WAIST') slot = 'BELT';
      }
    }

    const ALLOWED_SLOTS = ['MELEE', 'RANGED', 'ARMOR', 'SHIELD', 'RING', 'CLOAK', 'NECK', 'BELT', 'FEET'];
    if (!ALLOWED_SLOTS.includes(slot)) {
      const err = new Error(`Invalid equipment slot: ${targetSlot}. Allowed: ${ALLOWED_SLOTS.join(', ')}.`);
      err.status = 400;
      throw err;
    }

    if (slot === 'MELEE') {
      if (item.category !== 'WEAPON' || item.weapon_range_type === 'RANGED') {
        throw new Error('Only melee weapons can be prepared in the MELEE slot.');
      }
    } else if (slot === 'RANGED') {
      if (item.category !== 'WEAPON' || item.weapon_range_type !== 'RANGED') {
        throw new Error('Only ranged weapons can be prepared in the RANGED slot.');
      }
    } else if (slot === 'ARMOR') {
      if (item.category !== 'ARMOR') {
        throw new Error('Only armor can be equipped in the ARMOR slot.');
      }
    } else if (slot === 'SHIELD') {
      if (item.category !== 'SHIELD') {
        throw new Error('Only shields can be equipped in the SHIELD slot.');
      }
    } else if (['RING', 'CLOAK', 'NECK', 'BELT', 'FEET'].includes(slot)) {
      let itemDefSlot = (item.def_equip_slot || item.equip_slot || '').toUpperCase().trim();
      if (itemDefSlot === 'WAIST') itemDefSlot = 'BELT';
      if (!itemDefSlot || itemDefSlot !== slot) {
        if (itemDefSlot) {
          throw new Error(`The ${item.name} must be equipped in the ${itemDefSlot} slot.`);
        }
        throw new Error(`The ${item.name} cannot be equipped in the ${slot} slot.`);
      }
      if (item.category !== 'OTHER' && item.category !== 'ARMOR' && item.category !== 'ACCESSORY') {
        throw new Error(`The ${item.name} cannot be equipped in the ${slot} slot.`);
      }
    }

    // Unequip current item in that slot atomically
    tx.prepare(`
      UPDATE item_instances
      SET equipped_slot = NULL
      WHERE owner_character_id = ? AND equipped_slot = ?
    `).run(characterId, slot);

    // Equip new item
    tx.prepare(`
      UPDATE item_instances
      SET equipped_slot = ?
      WHERE id = ?
    `).run(slot, itemInstanceId);

    const newEquipment = getCharacterEquipment(tx, characterId);
    const effAfter = getEffectiveStats(character, newEquipment);
    const newMaxHp = calculateCanonicalMaxHp(character.level, character.class, getModifier(effAfter.constitution));
    const newCurrentHp = applyEquipmentConHpClamp(character.current_hp, newMaxHp);
    const isCleric = String(character.class || '').toUpperCase() === 'CLERIC';
    const newMaxDivineCharges = isCleric
      ? calculateMaxDivineCharges(character.level, 'CLERIC', getModifier(effAfter.wisdom))
      : 0;
    const newDivineCharges = clampDivineCharges(character.divine_charges, newMaxDivineCharges, isCleric);

    try {
      tx.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?, divine_charges = ?
        WHERE id = ?
      `).run(newMaxHp, newCurrentHp, newDivineCharges, characterId);
    } catch {
      tx.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?
        WHERE id = ?
      `).run(newMaxHp, newCurrentHp, characterId);
    }

    newEquipment.maxHp = newMaxHp;
    newEquipment.currentHp = newCurrentHp;
    newEquipment.divineCharges = newDivineCharges;
    newEquipment.maxDivineCharges = newMaxDivineCharges;
    return newEquipment;
  });
}

/**
 * Unequips an item from the character.
 * Enforces combat lock, dead-character block, and Rule A HP clamping.
 */
function unequipItem(db, characterId, itemInstanceId) {
  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      const err = new Error('Dead characters are not eligible to equip items.');
      err.status = 400;
      throw err;
    }

    const activeThreat = tx.prepare("SELECT status FROM encounters WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT') LIMIT 1").get(characterId);
    if (activeThreat) {
      const err = new Error('Cannot change equipment during active combat or an unresolved encounter.');
      err.status = 409;
      err.code = 'COMBAT_LOCKED_EQUIPMENT';
      throw err;
    }

    const item = tx.prepare(`
      SELECT * FROM item_instances
      WHERE id = ? AND owner_character_id = ? AND owner_type = 'CHARACTER'
    `).get(itemInstanceId, characterId);

    if (!item) {
      const err = new Error('Item not found in character possession.');
      err.status = 403;
      throw err;
    }

    tx.prepare('UPDATE item_instances SET equipped_slot = NULL WHERE id = ?').run(itemInstanceId);

    const newEquipment = getCharacterEquipment(tx, characterId);
    const effAfter = getEffectiveStats(character, newEquipment);
    const newMaxHp = calculateCanonicalMaxHp(character.level, character.class, getModifier(effAfter.constitution));
    const newCurrentHp = applyEquipmentConHpClamp(character.current_hp, newMaxHp);
    const isCleric = String(character.class || '').toUpperCase() === 'CLERIC';
    const newMaxDivineCharges = isCleric
      ? calculateMaxDivineCharges(character.level, 'CLERIC', getModifier(effAfter.wisdom))
      : 0;
    const newDivineCharges = clampDivineCharges(character.divine_charges, newMaxDivineCharges, isCleric);

    try {
      tx.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?, divine_charges = ?
        WHERE id = ?
      `).run(newMaxHp, newCurrentHp, newDivineCharges, characterId);
    } catch {
      tx.prepare(`
        UPDATE characters
        SET max_hp = ?, current_hp = ?
        WHERE id = ?
      `).run(newMaxHp, newCurrentHp, characterId);
    }

    newEquipment.maxHp = newMaxHp;
    newEquipment.currentHp = newCurrentHp;
    newEquipment.divineCharges = newDivineCharges;
    newEquipment.maxDivineCharges = newMaxDivineCharges;
    return newEquipment;
  });
}

/**
 * Sets hero's primary weapon preference ('MELEE' or 'RANGED').
 * Enforces that switching is forbidden during active combat or unresolved encounters.
 */
function setPrimaryWeaponPreference(db, characterId, preference) {
  const pref = (preference || '').toUpperCase().trim();
  if (pref !== 'MELEE' && pref !== 'RANGED') {
    throw new Error('Invalid primary weapon preference. Must be MELEE or RANGED.');
  }

  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Hero is not eligible to set primary weapon preference.');
    }

    const activeThreat = tx.prepare("SELECT status FROM encounters WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT') LIMIT 1").get(characterId);
    if (activeThreat) {
      throw new Error('Cannot change primary weapon preference during active combat or an unresolved encounter.');
    }

    tx.prepare('UPDATE characters SET primary_weapon = ? WHERE id = ?').run(pref, characterId);
    return tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  });
}

/**
 * Determines the hero's active weapon and whether ranged is active for combat & defense.
 */
function getActiveWeapon(character, equipment, monster = null) {
  const mType = (monster && monster.movement_type ? monster.movement_type : '').toUpperCase();
  const isAirborne = Boolean(monster && (
    mType === 'FLY' ||
    mType === 'FLYING' ||
    Boolean(monster.is_flying)
  ));
  const meleeWeapon = equipment ? (equipment.meleeWeapon || null) : null;
  const rangedWeapon = equipment ? (equipment.rangedWeapon || null) : null;
  const genericWeapon = equipment ? (equipment.weapon || null) : null;

  const preference = (character && character.primary_weapon ? character.primary_weapon : 'MELEE').toUpperCase();

  if (preference === 'RANGED') {
    if (rangedWeapon) {
      return { activeWeapon: rangedWeapon, isRangedActive: true, isAirborne };
    }
    if (meleeWeapon) {
      return { activeWeapon: meleeWeapon, isRangedActive: false, isAirborne };
    }
    return { activeWeapon: genericWeapon, isRangedActive: false, isAirborne };
  }

  if (meleeWeapon) {
    return { activeWeapon: meleeWeapon, isRangedActive: false, isAirborne };
  }
  if (rangedWeapon) {
    return { activeWeapon: rangedWeapon, isRangedActive: true, isAirborne };
  }
  return { activeWeapon: genericWeapon, isRangedActive: false, isAirborne };
}

/**
 * Counts available potions for a character.
 */
function getCharacterPotionCount(db, characterId) {
  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM item_instances ii
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ? AND id.category = 'POTION'
  `).get(characterId);
  return row ? row.count : 0;
}

const INACTIVE_CONSUMABLE_NAMES = [
  'Potion of Barkskin',
  "Potion of Bull's Strength",
  "Potion of Cat's Grace",
  'Potion of Shield of Faith',
  'Potion of Heroism',
  "Elixir of Dragon's Breath",
  'Antitoxin'
];

/**
 * Extracts per-stat bonuses from a single equipped item definition/instance.
 * Does not add synthetic dexterity to Boots of Elvenkind unless an explicit dexterity_bonus is defined.
 */
function extractItemStatBonuses(item) {
  const bonuses = {
    strength: 0,
    constitution: 0,
    dexterity: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0
  };
  if (!item || typeof item !== 'object') return bonuses;

  let attrs = item.attributes;
  if (typeof attrs === 'string') {
    try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
  }
  if (!attrs || typeof attrs !== 'object') {
    attrs = {};
  }

  const statBonusObj = (attrs.stat_bonus && typeof attrs.stat_bonus === 'object') ? attrs.stat_bonus : {};
  const shortKeys = {
    strength: 'str_bonus',
    constitution: 'con_bonus',
    dexterity: 'dex_bonus',
    intelligence: 'int_bonus',
    wisdom: 'wis_bonus',
    charisma: 'cha_bonus'
  };

  for (const stat of STAT_KEYS) {
    const bonusKey = `${stat}_bonus`;
    const shortKey = shortKeys[stat];
    let val = 0;
    if (attrs[bonusKey] !== undefined) {
      val = Number(attrs[bonusKey]) || 0;
    } else if (statBonusObj[stat] !== undefined) {
      val = Number(statBonusObj[stat]) || 0;
    } else if (attrs[shortKey] !== undefined) {
      val = Number(attrs[shortKey]) || 0;
    } else if (item[bonusKey] !== undefined) {
      val = Number(item[bonusKey]) || 0;
    }
    bonuses[stat] += Math.floor(val);
  }

  if (item.name === 'Belt of Giant Strength +2' && bonuses.strength === 0) {
    bonuses.strength = 2;
  }

  return bonuses;
}

/**
 * Calculates effective character attributes taking all nine equipped slots into account:
 * MELEE, RANGED, ARMOR, SHIELD, RING, CLOAK, NECK, BELT, FEET.
 * Ensures no double-counting even if called repeatedly on an already-computed object.
 */
function getEffectiveStats(character, equipment = null) {
  if (!character) return character;

  const eq = equipment || character._equipment || null;
  const baseScores = {};
  const bonuses = {
    strength: 0,
    constitution: 0,
    dexterity: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0
  };

  for (const stat of STAT_KEYS) {
    const baseKey = `base_${stat}`;
    const rawBase = character[baseKey] !== undefined ? character[baseKey] : character[stat];
    baseScores[stat] = Number.isFinite(Number(rawBase)) ? Number(rawBase) : 10;
  }

  if (eq && typeof eq === 'object') {
    const seenItems = new Set();
    const slotProps = ['meleeWeapon', 'rangedWeapon', 'armor', 'shield', 'ring', 'cloak', 'neck', 'belt', 'feet'];
    const candidateItems = [];

    for (const prop of slotProps) {
      if (eq[prop] && typeof eq[prop] === 'object') {
        candidateItems.push(eq[prop]);
      }
    }
    if (Array.isArray(eq.items)) {
      for (const it of eq.items) {
        if (it && typeof it === 'object' && it.equipped_slot) {
          candidateItems.push(it);
        }
      }
    }

    for (const item of candidateItems) {
      const dedupKey = item.instance_id || item.id || item;
      if (seenItems.has(dedupKey)) continue;
      seenItems.add(dedupKey);

      const itemBonuses = extractItemStatBonuses(item);
      for (const stat of STAT_KEYS) {
        bonuses[stat] += itemBonuses[stat];
      }
    }
  }

  const effectiveScores = {};
  const modifiers = {};
  for (const stat of STAT_KEYS) {
    effectiveScores[stat] = baseScores[stat] + bonuses[stat];
    modifiers[stat] = getModifier(effectiveScores[stat]);
  }

  const isCleric = String(character.class || '').toUpperCase() === 'CLERIC';
  const maxDivineCharges = isCleric
    ? calculateMaxDivineCharges(character.level || 1, 'CLERIC', modifiers.wisdom)
    : 0;
  const currentDivineCharges = clampDivineCharges(character.divine_charges, maxDivineCharges, isCleric);

  const result = {
    ...character,
    base_strength: baseScores.strength,
    base_constitution: baseScores.constitution,
    base_dexterity: baseScores.dexterity,
    base_intelligence: baseScores.intelligence,
    base_wisdom: baseScores.wisdom,
    base_charisma: baseScores.charisma,
    strength: effectiveScores.strength,
    constitution: effectiveScores.constitution,
    dexterity: effectiveScores.dexterity,
    intelligence: effectiveScores.intelligence,
    wisdom: effectiveScores.wisdom,
    charisma: effectiveScores.charisma,
    strength_bonus: bonuses.strength,
    constitution_bonus: bonuses.constitution,
    dexterity_bonus: bonuses.dexterity,
    intelligence_bonus: bonuses.intelligence,
    wisdom_bonus: bonuses.wisdom,
    charisma_bonus: bonuses.charisma,
    strength_mod: modifiers.strength,
    constitution_mod: modifiers.constitution,
    dexterity_mod: modifiers.dexterity,
    intelligence_mod: modifiers.intelligence,
    wisdom_mod: modifiers.wisdom,
    charisma_mod: modifiers.charisma,
    modifiers,
    divine_charges: currentDivineCharges,
    max_divine_charges: maxDivineCharges,
    is_str_boosted: bonuses.strength > 0,
    is_con_boosted: bonuses.constitution > 0,
    is_dex_boosted: bonuses.dexterity > 0,
    is_int_boosted: bonuses.intelligence > 0,
    is_wis_boosted: bonuses.wisdom > 0,
    is_cha_boosted: bonuses.charisma > 0
  };

  if (eq && typeof eq === 'object') {
    Object.defineProperty(result, '_equipment', { value: eq, enumerable: false, configurable: true, writable: true });
    if (character.id) {
      lastEquipmentByCharacterId.set(Number(character.id), eq);
    }
  }

  return result;
}

/**
 * Fetches potions owned by the hero, ordered by price ASC (cheapest first).
 */
function getCharacterPotions(db, characterId, options = {}) {
  const combatOnly = Boolean(options && options.combatOnly);
  const rows = db.prepare(`
    SELECT ii.id, ii.item_definition_id, id.name, id.buy_price, id.attributes, id.description,
           id.category, id.subtype, id.rarity, id.is_magical
    FROM item_instances ii
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ? AND id.category = 'POTION'
    ORDER BY id.buy_price ASC, ii.id ASC
  `).all(characterId);

  const mapped = rows.map((r) => {
    let attrs = {};
    if (typeof r.attributes === 'string') {
      try { attrs = JSON.parse(r.attributes); } catch { attrs = {}; }
    } else if (r.attributes && typeof r.attributes === 'object') {
      attrs = r.attributes;
    }
    const isInactive = INACTIVE_CONSUMABLE_NAMES.includes(r.name) || r.subtype === 'BUFF_POTION' || r.subtype === 'OFFENSIVE';
    const healEffect = isInactive ? null : (attrs.heal_dice || '1d8+1');
    return {
      ...r,
      healEffect,
      is_inactive: isInactive,
      displayName: isInactive ? `${r.name} (Inactive)` : `${r.name} (${healEffect})`
    };
  });

  if (combatOnly) {
    return mapped.filter(p => !p.is_inactive);
  }
  return mapped;
}

/**
 * Fetches ALL items owned by the character (equipped + backpack) for looting upon death.
 */
function getAllCharacterItems(db, characterId) {
  return db.prepare(`
    SELECT ii.id, ii.item_definition_id, ii.equipped_slot, ii.owner_character_id, ii.modifications,
           id.name, id.category, id.buy_price, id.is_magical, id.attributes
    FROM item_instances ii
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ?
  `).all(characterId);
}

/**
 * Uses a consumable item (e.g. potion, elixir) from the player's inventory outside of combat.
 */
function useConsumable(db, characterId, itemInstanceId, options = {}) {
  const rng = typeof options === 'function' ? options : (options && options.rng ? options.rng : Math.random);

  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Dead characters cannot use consumables.');
    }

    const activeThreat = tx.prepare("SELECT status FROM encounters WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT') LIMIT 1").get(characterId);
    if (activeThreat) {
      throw new Error('Cannot use items from your backpack during active combat or an unresolved encounter. Use the combat action menu.');
    }

    const item = tx.prepare(`
      SELECT ii.*, id.name, id.category, id.subtype, id.attributes, id.is_magical
      FROM item_instances ii
      JOIN item_definitions id ON ii.item_definition_id = id.id
      WHERE ii.id = ? AND ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ?
    `).get(itemInstanceId, characterId);

    if (!item) {
      throw new Error('Item not found in your inventory.');
    }

    if (item.category !== 'POTION') {
      throw new Error(`The ${item.name} is not a consumable item.`);
    }

    if (INACTIVE_CONSUMABLE_NAMES.includes(item.name) || item.subtype === 'BUFF_POTION' || item.subtype === 'OFFENSIVE') {
      throw new Error(`${item.name} cannot be consumed: its effect is not yet active in this version.`);
    }

    let attrs = {};
    if (typeof item.attributes === 'string') {
      try { attrs = JSON.parse(item.attributes); } catch { attrs = {}; }
    } else if (item.attributes && typeof item.attributes === 'object') {
      attrs = item.attributes;
    }

    const potionType = attrs.potion_type || (attrs.heal_dice ? 'healing' : 'other');

    if (potionType === 'healing' || (attrs.heal_dice && attrs.heal_dice !== '0')) {
      if (character.current_hp >= character.max_hp) {
        throw new Error('Hero is already at maximum health.');
      }

      tx.prepare('DELETE FROM item_instances WHERE id = ?').run(item.id);

      const healResult = rollDice(attrs.heal_dice || '1d8+1', rng);
      const healAmount = Math.max(1, healResult.total);
      const oldHp = character.current_hp;
      const newHp = Math.min(character.max_hp, oldHp + healAmount);
      const actualHealed = newHp - oldHp;

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(newHp, characterId);

      return {
        success: true,
        item: { id: item.id, name: item.name },
        healed: actualHealed,
        currentHp: newHp,
        maxHp: character.max_hp,
        message: `You drank ${item.name} and recovered ${actualHealed} HP (${newHp}/${character.max_hp} HP).`
      };
    }

    throw new Error(`${item.name} cannot be consumed: its effect is not yet active in this version.`);
  });
}

/**
 * Calculates Hero Saving Throws (Fortitude, Reflex, Will, and Physical = max(Fort, Ref))
 * based on Pathfinder 1e class progressions, effective attribute modifiers,
 * Fighter Battle-Hardened bonuses, and Cloak of Resistance.
 */
function getHeroSavingThrows(character, equipment = null) {
  if (!character) {
    return { fort: 0, ref: 0, will: 0, physical: 0 };
  }
  const eq = equipment || character._equipment || (character.id ? getLastEquipmentForCharacter(character.id) : null);
  const eff = getEffectiveStats(character, eq);

  const lvl = Math.max(1, Number(eff.level || 1));
  const goodSave = 2 + Math.floor(lvl / 2);
  const poorSave = Math.floor(lvl / 3);
  const cls = (eff.class || 'FIGHTER').toUpperCase();

  let baseFort = goodSave;
  let baseRef = poorSave;
  let baseWill = poorSave;

  if (cls === 'RANGER') {
    baseRef = goodSave;
  } else if (cls === 'CLERIC') {
    baseWill = goodSave;
  } else if (cls === 'FIGHTER') {
    const bh = getFighterBattleHardenedBonus(lvl);
    baseFort += bh.fortBonus;
    baseWill += bh.willBonus;
  }

  let cloakBonus = 0;
  if (eq && eq.cloak) {
    if (eq.cloak.enhancement_bonus) {
      cloakBonus += Number(eq.cloak.enhancement_bonus);
    } else if ((eq.cloak.name || '').includes('Cloak of Resistance')) {
      cloakBonus += 1;
    }
  }

  const fort = baseFort + getModifier(eff.constitution || 10) + cloakBonus;
  const ref = baseRef + getModifier(eff.dexterity || 10) + cloakBonus;
  const will = baseWill + getModifier(eff.wisdom || 10) + cloakBonus;
  const physical = Math.max(fort, ref);

  return { fort, ref, will, physical };
}

/**
 * Phase 7A.4 / 7B (OC-5): General INT XP multiplier is retired.
 * INT now fuels Monster Battle Experience learned damage bonuses and tactical recognition.
 * Returns the flat base XP reward as a non-negative integer.
 */
function calculateXpWithIntelligence(baseXp, _intelligence = 10) {
  const rawXp = Math.max(0, Math.floor(Number(baseXp) || 0));
  return rawXp;
}

/**
 * Scales shop purchase prices by the hero's Charisma modifier (-5% price per +1 CHA mod, +5% price per -1 CHA mod).
 */
function calculateShopPriceWithCharisma(basePrice, charisma = 10) {
  const rawPrice = Math.max(0, Number(basePrice) || 0);
  if (rawPrice === 0) return 0;
  const chaMod = getModifier(Number(charisma !== undefined && charisma !== null ? charisma : 10));
  const multiplier = Math.min(1.5, Math.max(0.6, 1 - (chaMod * 0.05)));
  return Math.max(1, Math.round(rawPrice * multiplier));
}

module.exports = {
  STAT_KEYS,
  STAT_KEY_ALIASES,
  ATTRIBUTE_MILESTONE_LEVELS,
  DESCRIPTIVE_ATTRIBUTE_TIER_LABELS,
  FAST_XP_TABLE,
  normalizeAttributeKey,
  getAttributeTierLabel,
  getModifier,
  formatModifier,
  getLevelForXp,
  getXpForNextLevel,
  getFighterBattleHardenedBonus,
  calculateCanonicalMaxHp,
  applyEquipmentConHpClamp,
  applyPermanentConHpIncrease,
  applyLevelUpHpGain,
  reconcileCharacterHpOnLoad,
  getHpPerLevel,
  getLevelAttackBonus,
  getFighterWeaponTraining,
  getFighterArmorTrainingMaxDexBonus,
  getRangerFavoredEnemyBonus,
  getClericHolyRadianceBonus,
  getClericDivinePowerBonus,
  calculateMaxDivineCharges,
  clampDivineCharges,
  getClericDivineChargeInfo,
  getClericSelfHealInfo,
  getClericRemainingHealUses,
  performClericSelfHeal,
  performCityRest,
  validateCharacterCreation,
  getCharacterById,
  getLivingCharacterByUserId,
  createCharacter,
  spendAttributePoint,
  countMilestoneAttributePointsEarned,
  applyCharacterLevelUp,
  getCharacterEquipment,
  getCharacterInventory,
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  getActiveWeapon,
  getCharacterPotionCount,
  getCharacterPotions,
  getAllCharacterItems,
  useConsumable,
  extractItemStatBonuses,
  getEffectiveStats,
  getLastEquipmentForCharacter,
  getHeroSavingThrows,
  calculateSavingThrows: getHeroSavingThrows,
  calculateXpWithIntelligence,
  calculateShopPriceWithCharisma,
  INACTIVE_CONSUMABLE_NAMES,
  normalizeRangerFavoredEnemy
};
