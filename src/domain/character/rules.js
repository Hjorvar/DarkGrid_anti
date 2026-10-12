const config = require('../../config');
const { withTransaction } = require('../../db/connection');

const STAT_KEYS = ['strength', 'constitution', 'dexterity', 'intelligence', 'wisdom', 'charisma'];

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
function createCharacter(db, { userId, name, classType, stats }) {
  const validation = validateCharacterCreation(classType, stats, name);
  if (!validation.valid) {
    const error = new Error(validation.errors.join(' '));
    error.status = 400;
    error.validationErrors = validation.errors;
    throw error;
  }

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
      // Fallback to passable tile
      startTile = tx.prepare("SELECT id FROM map_tiles WHERE is_passable = 1 LIMIT 1").get();
    }

    const classInfo = config.classBases[validation.classType];
    const maxHp = classInfo.hpPerLevel; // Level 1 HP per spec

    const insertStmt = tx.prepare(`
      INSERT INTO characters (
        user_id, name, class, is_alive, level, xp, gold,
        strength, constitution, dexterity, intelligence, wisdom, charisma,
        current_hp, max_hp, tile_id
      ) VALUES (
        ?, ?, ?, 1, 1, 0, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const result = insertStmt.run(
      userId,
      validation.sanitizedName,
      validation.classType,
      config.startingGold,
      stats.strength,
      stats.constitution,
      stats.dexterity,
      stats.intelligence,
      stats.wisdom,
      stats.charisma,
      maxHp,
      maxHp,
      startTile.id
    );

    const characterId = Number(result.lastInsertRowid);

    // Grant starting weapon, armor, and 2 Minor Healing Potions
    const starterItemsByClass = {
      FIGHTER: [
        { name: 'Longsword', slot: 'MAIN_HAND' },
        { name: 'Chain Shirt', slot: 'CHEST' }
      ],
      RANGER: [
        { name: 'Shortbow', slot: 'MAIN_HAND' },
        { name: 'Leather Armor', slot: 'CHEST' }
      ],
      CLERIC: [
        { name: 'Heavy Mace', slot: 'MAIN_HAND' },
        { name: 'Scale Mail', slot: 'CHEST' }
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
 */
function getCharacterEquipment(db, characterId) {
  const items = db.prepare(`
    SELECT ii.id, ii.equipped_slot, id.name, id.category, id.damage_dice,
           id.armor_bonus, id.shield_bonus, id.is_magical, id.buy_price, id.attributes
    FROM item_instances ii
    JOIN item_definitions id ON ii.item_definition_id = id.id
    WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ? AND ii.equipped_slot IS NOT NULL
  `).all(characterId);

  let weapon = null;
  let armor = null;
  let shield = null;

  for (const it of items) {
    if (it.category === 'WEAPON' || it.equipped_slot === 'MAIN_HAND') {
      weapon = it;
    } else if (it.category === 'ARMOR' || it.equipped_slot === 'CHEST') {
      armor = it;
    } else if (it.category === 'SHIELD' || it.equipped_slot === 'OFF_HAND') {
      shield = it;
    }
  }

  return { weapon, armor, shield, items };
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
 * Fetches ALL items owned by the character (equipped + backpack) for looting upon death.
 * Strictly guarantees no duplicate entries.
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

module.exports = {
  STAT_KEYS,
  getModifier,
  formatModifier,
  validateCharacterCreation,
  getLivingCharacterByUserId,
  createCharacter,
  getCharacterEquipment,
  getCharacterPotionCount,
  getAllCharacterItems
};
