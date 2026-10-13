const config = require('../../config');
const { withTransaction } = require('../../db/connection');
const { rollDice } = require('../combat/dice');

const STAT_KEYS = ['strength', 'constitution', 'dexterity', 'intelligence', 'wisdom', 'charisma'];

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
 * Calculates ability modifier according to standard d20: floor((score - 10) / 2)
 */
function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Formats modifier with a + or - sign, e.g. +2 or -1 or +0
 */
function formatModifier(score) {
  const mod = getModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Calculates level from cumulative XP using Pathfinder 1e Fast progression
 */
function getLevelForXp(xp) {
  const currentXp = Math.max(0, parseInt(xp, 10) || 0);
  for (let lvl = 10; lvl >= 1; lvl--) {
    if (currentXp >= FAST_XP_TABLE[lvl]) {
      return lvl;
    }
  }
  return 1;
}

/**
 * Returns required XP for the next level, or null if at max level (10)
 */
function getXpForNextLevel(level) {
  const lvl = Math.max(1, parseInt(level, 10) || 1);
  if (lvl >= 10) return null;
  return FAST_XP_TABLE[lvl + 1];
}

/**
 * Calculates HP gained per level based on class and Constitution modifier.
 * Fighter: 10 + CON mod (min 1)
 * Ranger: 8 + CON mod (min 1)
 * Cleric: 8 + CON mod (min 1)
 */
function getHpPerLevel(classType, conScore) {
  const conMod = getModifier(conScore);
  const base = (classType || '').toUpperCase() === 'FIGHTER' ? 10 : 8;
  return Math.max(1, base + conMod);
}

/**
 * Calculates attack progression bonus based on class and level.
 * Fighter & Ranger: level - 1
 * Cleric: floor(level * 0.75)
 */
function getLevelAttackBonus(classType, level) {
  const upper = (classType || '').toUpperCase();
  const lvl = Math.max(1, parseInt(level, 10) || 1);
  if (upper === 'CLERIC') {
    return Math.floor(lvl * 0.75);
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
 * Ranger Favored Enemy: attack & damage bonus against chosen creature type/subtype.
 * Level 1-4: +1 Atk / +1 Dmg
 * Level 5-8: +2 Atk / +2 Dmg
 * Level 9+:  +3 Atk / +3 Dmg
 * Strictly prohibits bonus against Undead under any circumstance, even with legacy/corrupt data.
 */
function getRangerFavoredEnemyBonus(character, monster) {
  if (!character || (character.class || '').toUpperCase() !== 'RANGER') {
    return { attack: 0, damage: 0 };
  }
  if (!character.favored_enemy_type || !monster) {
    return { attack: 0, damage: 0 };
  }
  const favoredType = character.favored_enemy_type.trim().toUpperCase();
  const monsterType = (monster.creature_type || '').trim().toUpperCase();

  // STRICT GUARANTEE: Ranger NEVER receives Favored Enemy bonus against Undead
  if (favoredType === 'UNDEAD' || monsterType === 'UNDEAD') {
    return { attack: 0, damage: 0 };
  }

  if (favoredType !== monsterType) {
    return { attack: 0, damage: 0 };
  }

  if (favoredType === 'HUMANOID') {
    const favoredSub = (character.favored_enemy_subtype || '').trim().toLowerCase();
    const monsterSub = (monster.creature_subtype || '').trim().toLowerCase();
    if (!favoredSub || favoredSub !== monsterSub) {
      return { attack: 0, damage: 0 };
    }
  }

  const lvl = Math.max(1, parseInt(character.level, 10) || 1);
  const bonus = lvl >= 9 ? 3 : (lvl >= 5 ? 2 : 1);
  return { attack: bonus, damage: bonus };
}

/**
 * Cleric Holy Radiance: passive class ability against Undead.
 * Replaces previous Divine Power bonuses (do not stack).
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

  if (charClass.toUpperCase() !== 'CLERIC') {
    return { attack: 0, damage: 0, ac: 0 };
  }
  if (!targetMonster) {
    return { attack: 0, damage: 0, ac: 0 };
  }
  const monsterType = (targetMonster.creature_type || '').trim().toUpperCase();
  if (monsterType !== 'UNDEAD') {
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

    const inCombat = tx.prepare("SELECT 1 FROM encounters WHERE character_id = ? AND status = 'IN_COMBAT'").get(characterId);
    if (inCombat) {
      throw new Error('Cleric Self-Healing can only be performed outside of combat.');
    }

    if (character.current_hp >= character.max_hp) {
      throw new Error('Hero is already at maximum health.');
    }

    const remaining = getClericRemainingHealUses(character);
    if (remaining <= 0) {
      throw new Error('You have exhausted your Self-Healing uses for this expedition. Rest in a safe city to restore them.');
    }

    const info = getClericSelfHealInfo(character.level);
    const rollResult = rollDice(info.dice, rng);
    const wisMod = getModifier(character.wisdom);
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

    const inCombat = tx.prepare("SELECT 1 FROM encounters WHERE character_id = ? AND status = 'IN_COMBAT'").get(characterId);
    if (inCombat) {
      throw new Error('Cannot rest or receive city healing while engaged in combat.');
    }

    tx.prepare(`
      UPDATE characters
      SET current_hp = max_hp, cleric_heal_uses = 0
      WHERE id = ?
    `).run(characterId);

    return {
      currentHp: character.max_hp,
      maxHp: character.max_hp,
      clericHealUses: 0
    };
  });
}

/**
 * Validates character creation input against DARKGRID_GAME_SPEC.md §3 rules
 */
function validateCharacterCreation(classType, stats, name) {
  const errors = [];

  // Name check
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Hero must have a name.');
  } else if (name.trim().length > 30) {
    errors.push('Name cannot exceed 30 characters.');
  }

  // Class check
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

  let totalSum = 0;

  for (const stat of STAT_KEYS) {
    const rawVal = stats[stat];
    const val = Number(rawVal);
    const baseVal = classBase[stat];

    if (!Number.isInteger(val)) {
      errors.push(`${stat} must be an integer.`);
      continue;
    }

    const minAllowed = baseVal - config.statRules.maxReductionPerStat;
    const maxAllowed = config.statRules.maxScore;

    if (val < minAllowed) {
      errors.push(`${stat} (${val}) cannot drop below the minimum of ${minAllowed} for ${classBase.name} (base ${baseVal} - 2).`);
    }

    if (val > maxAllowed) {
      errors.push(`${stat} (${val}) cannot exceed the maximum of ${maxAllowed} at creation.`);
    }

    totalSum += val;
  }

  if (totalSum !== config.statRules.requiredTotalSum) {
    errors.push(`Total attribute points must equal exactly ${config.statRules.requiredTotalSum} (base ${config.statRules.baseSum} + ${config.statRules.bonusPoints} bonus points). Current total is ${totalSum}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    classType: upperClass,
    sanitizedName: (name || '').trim()
  };
}

/**
 * Fetches the living character for a given user, or null if none
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
 * Creates a new character for a user, enforcing one living character rule
 */
function createCharacter(db, {
  userId,
  name,
  classType,
  stats,
  startingGold,
  favoredEnemyType,
  favoredEnemySubtype,
  primaryWeapon
}) {
  const validation = validateCharacterCreation(classType, stats, name);
  if (!validation.valid) {
    const error = new Error(validation.errors.join(' '));
    error.status = 400;
    error.validationErrors = validation.errors;
    throw error;
  }

  // Favored Enemy validation for Ranger (L6)
  const ALLOWED_FAVORED_ENEMIES = [
    'ANIMAL', 'BEAST', 'MAGICAL BEAST', 'MAGICAL_BEAST', 'MONSTROUS HUMANOID', 'MONSTROUS_HUMANOID',
    'DRAGON', 'ABERRATION', 'GIANT', 'PLANT', 'VERMIN',
    'OUTSIDER', 'CONSTRUCT', 'OOZE', 'FEY', 'HUMANOID'
  ];

  if (validation.classType === 'RANGER' && favoredEnemyType) {
    const normType = favoredEnemyType.toUpperCase().trim();
    if (normType === 'UNDEAD') {
      const error = new Error('Undead is not permitted as a Favored Enemy.');
      error.status = 400;
      throw error;
    }
    if (!ALLOWED_FAVORED_ENEMIES.includes(normType)) {
      const error = new Error(`Invalid Favored Enemy type: ${favoredEnemyType}.`);
      error.status = 400;
      throw error;
    }
    if (normType === 'HUMANOID' && !favoredEnemySubtype) {
      const error = new Error('Humanoid Favored Enemy requires a subtype (e.g. reptilian, goblinoid, giant).');
      error.status = 400;
      throw error;
    }
  }

  const finalFavoredEnemyType = validation.classType === 'RANGER' ? (favoredEnemyType ? favoredEnemyType.toUpperCase().trim() : null) : null;
  const finalFavoredEnemySubtype = validation.classType === 'RANGER' ? (favoredEnemySubtype ? favoredEnemySubtype.trim() : null) : null;

  const defaultPrimary = (validation.classType === 'RANGER') ? 'RANGED' : 'MELEE';
  const chosenPrimary = (primaryWeapon && ['MELEE', 'RANGED'].includes(primaryWeapon.toUpperCase()))
    ? primaryWeapon.toUpperCase()
    : defaultPrimary;

  return withTransaction(db, (tx) => {
    // 1. Strict check for living character
    const existing = tx.prepare('SELECT id FROM characters WHERE user_id = ? AND is_alive = 1').get(userId);
    if (existing) {
      const err = new Error('User already has a living hero. Only one living hero is permitted.');
      err.status = 409;
      throw err;
    }

    // 2. Locate starting safe city tile
    let startTile = tx.prepare("SELECT id FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1").get();
    if (!startTile) {
      startTile = tx.prepare("SELECT id FROM map_tiles WHERE is_passable = 1 LIMIT 1").get();
    }

    const maxHp = getHpPerLevel(validation.classType, stats.constitution);
    const goldToGrant = startingGold !== undefined ? startingGold : config.startingGold;

    const insertStmt = tx.prepare(`
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
      chosenPrimary
    );

    const characterId = Number(result.lastInsertRowid);

    // Grant class starting equipment (Phase F)
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
    const insertItemStmt = tx.prepare(`
      INSERT INTO item_instances (
        item_definition_id, owner_type, owner_character_id, equipped_slot
      ) VALUES (?, 'CHARACTER', ?, ?)
    `);

    // Insert class gear
    for (const gear of starterItems) {
      const def = tx.prepare('SELECT id FROM item_definitions WHERE name = ?').get(gear.name);
      if (def) {
        insertItemStmt.run(def.id, characterId, gear.slot);
      }
    }

    // Insert 2 Minor Healing Potions
    const potionDef = tx.prepare("SELECT id FROM item_definitions WHERE name = 'Minor Healing Potion'").get();
    if (potionDef) {
      insertItemStmt.run(potionDef.id, characterId, null);
      insertItemStmt.run(potionDef.id, characterId, null);
    }

    return tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  });
}

/**
 * Fetches equipped weapon, armor, and shield for a character.
 * Provides backwards-compatible 'weapon' property along with distinct 'meleeWeapon' and 'rangedWeapon'.
 */
function getCharacterEquipment(db, characterId) {
  const items = db.prepare(`
    SELECT ii.id, ii.id AS instance_id, ii.equipped_slot, id.name, id.category, id.damage_dice,
           id.armor_bonus, id.shield_bonus, id.is_magical, id.buy_price, id.attributes,
           id.max_dex_bonus, id.enhancement_bonus, id.weapon_range_type, id.is_two_handed,
           id.rarity, id.subtype, id.equip_slot as def_equip_slot
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
    } else if (slot === 'BELT') {
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

  return {
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
}

/**
 * Fetches all inventory items currently in possession of the hero.
 */
function getCharacterInventory(db, characterId) {
  return db.prepare(`
    SELECT ii.id, ii.id AS instance_id, ii.item_definition_id, ii.equipped_slot, ii.owner_character_id,
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
 * Equips an item into a designated slot (MELEE, RANGED, ARMOR, SHIELD).
 */
function equipItem(db, characterId, itemInstanceId, targetSlot) {
  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Hero is not eligible to equip items.');
    }

    const inCombat = tx.prepare("SELECT 1 FROM encounters WHERE character_id = ? AND status = 'IN_COMBAT'").get(characterId);
    if (inCombat) {
      throw new Error('Cannot change equipment during active combat.');
    }

    const item = tx.prepare(`
      SELECT ii.*, id.name, id.category, id.weapon_range_type, id.allowed_classes
      FROM item_instances ii
      JOIN item_definitions id ON ii.item_definition_id = id.id
      WHERE ii.id = ? AND ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ?
    `).get(itemInstanceId, characterId);

    if (!item) {
      throw new Error('Item not found in character possession.');
    }

    let allowed = [];
    try { allowed = JSON.parse(item.allowed_classes || '[]'); } catch { allowed = []; }
    if (allowed.length > 0 && !allowed.includes(character.class)) {
      throw new Error(`The ${item.name} cannot be equipped by a ${character.class}.`);
    }

    let slot = (targetSlot || '').toUpperCase().trim();
    if (!slot) {
      if (item.category === 'WEAPON') {
        slot = item.weapon_range_type === 'RANGED' ? 'RANGED' : 'MELEE';
      } else if (item.category === 'ARMOR') {
        slot = 'ARMOR';
      } else if (item.category === 'SHIELD') {
        slot = 'SHIELD';
      } else if (item.def_equip_slot || item.equip_slot) {
        slot = (item.def_equip_slot || item.equip_slot).toUpperCase().trim();
      }
    }

    const ALLOWED_SLOTS = ['MELEE', 'RANGED', 'ARMOR', 'SHIELD', 'RING', 'CLOAK', 'NECK', 'BELT', 'FEET'];
    if (!ALLOWED_SLOTS.includes(slot)) {
      throw new Error(`Invalid equipment slot: ${targetSlot}. Allowed: ${ALLOWED_SLOTS.join(', ')}.`);
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
      const itemDefSlot = (item.def_equip_slot || item.equip_slot || '').toUpperCase().trim();
      if (itemDefSlot && itemDefSlot !== slot) {
        throw new Error(`The ${item.name} must be equipped in the ${itemDefSlot} slot.`);
      }
      if (item.category !== 'OTHER' && item.category !== 'ARMOR') {
        throw new Error(`The ${item.name} cannot be equipped in the ${slot} slot.`);
      }
    }

    // Unequip current item in that slot
    tx.prepare(`
      UPDATE item_instances
      SET equipped_slot = NULL
      WHERE owner_character_id = ? AND equipped_slot = ?
    `).run(characterId, slot);

    // Equip item
    tx.prepare(`
      UPDATE item_instances
      SET equipped_slot = ?
      WHERE id = ?
    `).run(slot, itemInstanceId);

    return getCharacterEquipment(tx, characterId);
  });
}

/**
 * Unequips an item from the character.
 */
function unequipItem(db, characterId, itemInstanceId) {
  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Hero is not eligible to equip items.');
    }

    const inCombat = tx.prepare("SELECT 1 FROM encounters WHERE character_id = ? AND status = 'IN_COMBAT'").get(characterId);
    if (inCombat) {
      throw new Error('Cannot change equipment during active combat.');
    }

    const item = tx.prepare(`
      SELECT * FROM item_instances
      WHERE id = ? AND owner_character_id = ? AND owner_type = 'CHARACTER'
    `).get(itemInstanceId, characterId);

    if (!item) {
      throw new Error('Item not found in character possession.');
    }

    tx.prepare('UPDATE item_instances SET equipped_slot = NULL WHERE id = ?').run(itemInstanceId);
    return getCharacterEquipment(tx, characterId);
  });
}

/**
 * Sets hero's primary weapon preference ('MELEE' or 'RANGED').
 * Enforces that switching is forbidden during active combat.
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

    const inCombat = tx.prepare("SELECT 1 FROM encounters WHERE character_id = ? AND status = 'IN_COMBAT'").get(characterId);
    if (inCombat) {
      throw new Error('Cannot change primary weapon preference during active combat.');
    }

    tx.prepare('UPDATE characters SET primary_weapon = ? WHERE id = ?').run(pref, characterId);
    return tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  });
}

/**
 * Determines the hero's active weapon and whether ranged is active for combat & defense.
 * Rules:
 * 1. Against airborne enemies (movement_type === 'FLY'):
 *    Forces prepared ranged weapon if available, regardless of preference.
 * 2. Against ground enemies:
 *    Uses preferred primary weapon (RANGED or MELEE).
 * 3. Safe fallback:
 *    If preferred weapon is not equipped (removed, sold), falls back to the other legally equipped weapon,
 *    or unequipped/bare hands.
 */
function getActiveWeapon(character, equipment, monster = null) {
  const isAirborne = Boolean(monster && (
    (monster.movement_type || '').toUpperCase() === 'FLY' ||
    Boolean(monster.is_flying)
  ));
  const meleeWeapon = equipment ? (equipment.meleeWeapon || null) : null;
  const rangedWeapon = equipment ? (equipment.rangedWeapon || null) : null;
  const genericWeapon = equipment ? (equipment.weapon || null) : null;

  // 1. Airborne monster forces prepared ranged weapon if equipped
  if (isAirborne && rangedWeapon) {
    return { activeWeapon: rangedWeapon, isRangedActive: true };
  }

  const preference = (character && character.primary_weapon ? character.primary_weapon : 'MELEE').toUpperCase();

  // 2. Primary Weapon Preference with Safe Fallback
  if (preference === 'RANGED') {
    if (rangedWeapon) {
      return { activeWeapon: rangedWeapon, isRangedActive: true };
    }
    // Safe fallback to melee
    if (meleeWeapon) {
      return { activeWeapon: meleeWeapon, isRangedActive: false };
    }
    return { activeWeapon: genericWeapon, isRangedActive: false };
  }

  // Melee preference (default)
  if (meleeWeapon) {
    return { activeWeapon: meleeWeapon, isRangedActive: false };
  }
  // Safe fallback to ranged
  if (rangedWeapon) {
    return { activeWeapon: rangedWeapon, isRangedActive: true };
  }
  return { activeWeapon: genericWeapon, isRangedActive: false };
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

/**
 * Fetches all healing potions owned by the hero, ordered by price ASC (cheapest first).
 * Includes display name and heal effect for combat selection.
 */
function getCharacterPotions(db, characterId) {
  const rows = db.prepare(`
    SELECT ii.id, ii.item_definition_id, id.name, id.buy_price, id.attributes, id.description
    FROM item_instances ii
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ? AND id.category = 'POTION'
    ORDER BY id.buy_price ASC, ii.id ASC
  `).all(characterId);

  return rows.map((r) => {
    let attrs = {};
    if (typeof r.attributes === 'string') {
      try { attrs = JSON.parse(r.attributes); } catch { attrs = {}; }
    } else if (r.attributes && typeof r.attributes === 'object') {
      attrs = r.attributes;
    }
    const healEffect = attrs.heal_dice || '1d8+1';
    return {
      ...r,
      healEffect,
      displayName: `${r.name} (${healEffect})`
    };
  });
}

/**
 * Fetches ALL items owned by the character (equipped + backpack) for looting upon death.
 */
function getAllCharacterItems(db, characterId) {
  return db.prepare(`
    SELECT ii.id, ii.item_definition_id, ii.equipped_slot, ii.owner_character_id,
           id.name, id.category, id.buy_price, id.is_magical, id.attributes
    FROM item_instances ii
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ?
  `).all(characterId);
}

/**
 * Uses a consumable item (e.g. potion, elixir) from the player's inventory outside of combat.
 * Thread-safe, atomic, validates ownership, prevents dead hero usage and race conditions.
 */
function useConsumable(db, characterId, itemInstanceId, options = {}) {
  const rng = typeof options === 'function' ? options : (options && options.rng ? options.rng : Math.random);

  return withTransaction(db, (tx) => {
    // 1. Validate living character
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Dead characters cannot use consumables.');
    }

    // 2. Validate out-of-combat
    const inCombat = tx.prepare("SELECT 1 FROM encounters WHERE character_id = ? AND status = 'IN_COMBAT'").get(characterId);
    if (inCombat) {
      throw new Error('Cannot use items from your backpack during active combat. Use the combat action menu.');
    }

    // 3. Fetch item instance
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

    let attrs = {};
    if (typeof item.attributes === 'string') {
      try { attrs = JSON.parse(item.attributes); } catch { attrs = {}; }
    } else if (item.attributes && typeof item.attributes === 'object') {
      attrs = item.attributes;
    }

    const potionType = attrs.potion_type || (attrs.heal_dice ? 'healing' : 'other');

    // Healing potion handling
    if (potionType === 'healing' || (attrs.heal_dice && attrs.heal_dice !== '0')) {
      if (character.current_hp >= character.max_hp) {
        throw new Error('Hero is already at maximum health.');
      }

      // Consume item (atomic delete)
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

    // Buff or other potion consumed out of combat
    tx.prepare('DELETE FROM item_instances WHERE id = ?').run(item.id);
    const desc = attrs.description || `Consumed ${item.name}.`;

    return {
      success: true,
      item: { id: item.id, name: item.name },
      healed: 0,
      currentHp: character.current_hp,
      maxHp: character.max_hp,
      message: `You consumed ${item.name}. ${desc}`
    };
  });
}

module.exports = {
  STAT_KEYS,
  FAST_XP_TABLE,
  getModifier,
  formatModifier,
  getLevelForXp,
  getXpForNextLevel,
  getHpPerLevel,
  getLevelAttackBonus,
  getFighterWeaponTraining,
  getFighterArmorTrainingMaxDexBonus,
  getRangerFavoredEnemyBonus,
  getClericHolyRadianceBonus,
  getClericDivinePowerBonus,
  getClericSelfHealInfo,
  getClericRemainingHealUses,
  performClericSelfHeal,
  performCityRest,
  validateCharacterCreation,
  getLivingCharacterByUserId,
  createCharacter,
  getCharacterEquipment,
  getCharacterInventory,
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  getActiveWeapon,
  getCharacterPotionCount,
  getCharacterPotions,
  getAllCharacterItems,
  useConsumable
};
