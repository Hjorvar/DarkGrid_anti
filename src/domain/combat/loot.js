/**
 * Darkgrid Data-Driven Pathfinder-Inspired Loot System
 * Slices drops by Challenge Rating, Creature Classification, and Loot Tables.
 * Strictly guarantees ordinary animals never drop random gold or equipment.
 * Supports configurable rarity, weighted loot tables, and backpack capacity enforcement (50 items).
 */

const { withTransaction } = require('../../db/connection');

const INACTIVE_ITEM_NAMES = [
  'Potion of Barkskin',
  "Potion of Bull's Strength",
  "Potion of Cat's Grace",
  'Potion of Shield of Faith',
  'Potion of Heroism',
  "Elixir of Dragon's Breath",
  'Antitoxin',
  'Boots of Elvenkind',
  'Cloak of Resistance +1',
  'Bracers of Armor +1'
];

const INACTIVE_ITEMS_SQL = INACTIVE_ITEM_NAMES.map(n => `'${n.replace(/'/g, "''")}'`).join(', ');

const TREASURE_CHANCES = {
  None:       { goldChance: 0.00, itemChance: 0.00 },
  Incidental: { goldChance: 0.15, itemChance: 0.05 },
  Standard:   { goldChance: 0.55, itemChance: 0.20 },
  Double:     { goldChance: 0.80, itemChance: 0.35 },
  'NPC Gear': { goldChance: 0.35, itemChance: 0.45 }
};

const GOLD_RANGES_STANDARD = [
  { maxCr: 0.5, minGold: 1,  maxGold: 5 },
  { maxCr: 1.0, minGold: 3,  maxGold: 10 },
  { maxCr: 2.0, minGold: 6,  maxGold: 18 },
  { maxCr: 3.0, minGold: 10, maxGold: 30 },
  { maxCr: 4.0, minGold: 16, maxGold: 45 },
  { maxCr: 5.0, minGold: 25, maxGold: 70 },
  { maxCr: Infinity, minGold: 35, maxGold: 100 }
];

const MAGIC_DROP_CHANCES = [
  { maxCr: 0.99, chance: 0.015 }, // CR < 1: 1.5%
  { maxCr: 1.00, chance: 0.025 }, // CR 1: 2.5%
  { maxCr: 2.00, chance: 0.035 }, // CR 2: 3.5%
  { maxCr: 3.00, chance: 0.045 }, // CR 3: 4.5%
  { maxCr: 4.00, chance: 0.055 }, // CR 4: 5.5%
  { maxCr: Infinity, chance: 0.065 } // CR 5+: 6.5%
];

/**
 * Returns the base magical drop chance for a given CR.
 */
function getMagicDropChance(cr) {
  for (const tier of MAGIC_DROP_CHANCES) {
    if (cr <= tier.maxCr) {
      return tier.chance;
    }
  }
  return 0.065;
}

/**
 * Generates gold amount for a defeated monster based on CR and Treasure Classification.
 */
function calculateMonsterGold(cr, treasureType, rng = Math.random) {
  if (treasureType === 'None') return 0;

  let minG = 1;
  let maxG = 5;
  for (const range of GOLD_RANGES_STANDARD) {
    if (cr <= range.maxCr) {
      minG = range.minGold;
      maxG = range.maxGold;
      break;
    }
  }

  const baseRoll = Math.floor(rng() * (maxG - minG + 1)) + minG;

  let multiplier = 1.0;
  if (treasureType === 'Incidental') multiplier = 0.5;
  else if (treasureType === 'Double') multiplier = 2.0;

  return Math.max(1, Math.round(baseRoll * multiplier));
}

/**
 * Resolves the most appropriate active loot table for a monster by creature type and CR.
 */
function resolveLootTable(db, creatureType, cr) {
  const normType = (creatureType || '').trim().toUpperCase();

  // Try matching specific creature type first, fallback to generic
  const row = db.prepare(`
    SELECT * FROM loot_tables
    WHERE is_active = 1 AND min_cr <= ? AND max_cr >= ?
      AND (UPPER(creature_type) = ? OR creature_type IS NULL)
    ORDER BY CASE WHEN creature_type IS NOT NULL THEN 0 ELSE 1 END ASC, min_cr DESC
    LIMIT 1
  `).get(cr, cr, normType);

  return row || null;
}

/**
 * Performs weighted random selection from a list of loot entries.
 */
function pickWeightedItem(entries, rng = Math.random) {
  if (!entries || entries.length === 0) return null;
  const totalWeight = entries.reduce((sum, e) => sum + (Number(e.weight) || 1), 0);
  if (totalWeight <= 0) return entries[0];

  let threshold = rng() * totalWeight;
  for (const entry of entries) {
    const w = Number(entry.weight) || 1;
    if (threshold < w) {
      return entry;
    }
    threshold -= w;
  }
  return entries[entries.length - 1];
}

/**
 * Generates loot (gold and items) for a defeated monster, creating real item instances in SQLite.
 * Uses data-driven loot tables, respects 50-item backpack limits, and guarantees animal rules.
 * @param {object} db Database connection
 * @param {object} monster Monster definition
 * @param {number} characterId Winning character ID
 * @param {object} options Optional { rng, forceGold, forceNormalItem, forceMagicItem }
 * @returns {{ goldAwarded: number, itemsAwarded: Array<{ instanceId: number, name: string, is_magical: number, rarity: string }>, backpackFull: boolean }}
 */
function generateMonsterLoot(db, monster, characterId, options = {}) {
  const rng = options.rng || Math.random;

  let resolvedMonster = monster || {};
  const monsterId = resolvedMonster.monster_id || resolvedMonster.id;
  if (
    monsterId &&
    (resolvedMonster.challenge_rating === undefined ||
      resolvedMonster.challenge_rating === null ||
      !resolvedMonster.treasure_type ||
      !resolvedMonster.creature_type)
  ) {
    const dbMonster = db.prepare(`
      SELECT id, name, challenge_rating, treasure_type, creature_type, creature_subtype, xp_reward
      FROM monsters
      WHERE id = ?
    `).get(monsterId);
    if (dbMonster) {
      resolvedMonster = {
        ...dbMonster,
        ...resolvedMonster,
        challenge_rating:
          resolvedMonster.challenge_rating !== undefined && resolvedMonster.challenge_rating !== null
            ? resolvedMonster.challenge_rating
            : dbMonster.challenge_rating,
        treasure_type: resolvedMonster.treasure_type || dbMonster.treasure_type,
        creature_type: resolvedMonster.creature_type || dbMonster.creature_type,
        creature_subtype: resolvedMonster.creature_subtype || dbMonster.creature_subtype
      };
    }
  }

  // Rule: Ordinary animals NEVER drop random gold or equipment
  const creatureType = (resolvedMonster.creature_type || '').toUpperCase().trim();
  if (creatureType === 'ANIMAL') {
    return { goldAwarded: 0, itemsAwarded: [], backpackFull: false };
  }

  const parsedCr = Number(resolvedMonster.challenge_rating);
  const cr = Number.isFinite(parsedCr) && parsedCr > 0 ? parsedCr : 1;
  const treasureType = resolvedMonster.treasure_type || 'Standard';
  const chances = TREASURE_CHANCES[treasureType] || TREASURE_CHANCES.Standard;

  let goldAwarded = 0;
  const itemsAwarded = [];
  let backpackFull = false;

  return withTransaction(db, (tx) => {
    // 0. Check character inventory capacity (M6 rule: max 50 items)
    const currentInventoryCount = tx.prepare(`
      SELECT COUNT(*) as count FROM item_instances
      WHERE owner_type = 'CHARACTER' AND owner_character_id = ?
    `).get(characterId).count;

    if (currentInventoryCount >= 50) {
      backpackFull = true;
    }

    // 1. Resolve active loot table for this monster
    const lootTable = resolveLootTable(tx, creatureType, cr);
    const goldMultiplier = lootTable ? (Number(lootTable.gold_multiplier) || 1.0) : 1.0;
    const itemChanceMultiplier = lootTable ? (Number(lootTable.item_chance) / 0.25) : 1.0;
    const magicChanceMultiplier = lootTable ? (Number(lootTable.magic_chance_multiplier) || 1.0) : 1.0;

    // 2. Roll Gold
    const rollGold = (options.forceGold !== undefined) ? options.forceGold : (rng() < chances.goldChance);
    if (rollGold && chances.goldChance > 0) {
      const baseGold = calculateMonsterGold(cr, treasureType, rng);
      goldAwarded = Math.max(1, Math.round(baseGold * goldMultiplier));
      if (goldAwarded > 0) {
        tx.prepare('UPDATE characters SET gold = gold + ? WHERE id = ?').run(goldAwarded, characterId);
      }
    }

    // 3. Roll Normal / Loot Table Item
    const effectiveItemChance = Math.min(0.95, chances.itemChance * itemChanceMultiplier);
    const rollNormal = (options.forceNormalItem !== undefined) ? options.forceNormalItem : (rng() < effectiveItemChance);

    if (rollNormal && chances.itemChance > 0 && !backpackFull) {
      let chosen = null;

      if (lootTable) {
        // Query non-magical entries from the resolved loot table matching CR
        const tableEntries = tx.prepare(`
          SELECT lte.weight, id.*
          FROM loot_table_entries lte
          JOIN item_definitions id ON lte.item_definition_id = id.id
          WHERE lte.loot_table_id = ? AND id.is_magical = 0 AND COALESCE(id.min_cr, 0) <= ? AND id.name NOT IN (${INACTIVE_ITEMS_SQL})
        `).all(lootTable.id, cr);

        if (tableEntries.length > 0) {
          chosen = pickWeightedItem(tableEntries, rng);
        }
      }

      // Safe fallback if table has no non-magical entries
      if (!chosen) {
        const fallbackCandidates = tx.prepare(`
          SELECT * FROM item_definitions
          WHERE is_magical = 0 AND buy_price > 0 AND COALESCE(min_cr, 0) <= ? AND category IN ('WEAPON', 'ARMOR', 'SHIELD', 'POTION', 'OTHER')
            AND name NOT IN (${INACTIVE_ITEMS_SQL})
          ORDER BY id ASC
        `).all(cr);

        if (fallbackCandidates.length > 0) {
          chosen = fallbackCandidates[Math.floor(rng() * fallbackCandidates.length)];
        }
      }

      if (chosen) {
        const insertRes = tx.prepare(`
          INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
          VALUES (?, 'CHARACTER', ?)
        `).run(chosen.id, characterId);

        itemsAwarded.push({
          instanceId: Number(insertRes.lastInsertRowid),
          definitionId: chosen.id,
          name: chosen.name,
          category: chosen.category,
          rarity: chosen.rarity || 'COMMON',
          is_magical: 0
        });

        // Check if backpack hit capacity after this item
        if (currentInventoryCount + itemsAwarded.length >= 50) {
          backpackFull = true;
        }
      }
    }

    // 4. Roll Magical Item
    const baseMagicChance = getMagicDropChance(cr);
    const effectiveMagicChance = Math.min(0.50, baseMagicChance * magicChanceMultiplier);
    const rollMagic = (options.forceMagicItem !== undefined) ? options.forceMagicItem : (rng() < effectiveMagicChance);

    if (rollMagic && treasureType !== 'None' && !backpackFull) {
      let chosenMagic = null;

      if (lootTable) {
        // Query magical entries from the resolved loot table matching CR
        const magicTableEntries = tx.prepare(`
          SELECT lte.weight, id.*
          FROM loot_table_entries lte
          JOIN item_definitions id ON lte.item_definition_id = id.id
          WHERE lte.loot_table_id = ? AND id.is_magical = 1 AND id.min_cr <= ? AND id.name NOT IN (${INACTIVE_ITEMS_SQL})
        `).all(lootTable.id, cr);

        if (magicTableEntries.length > 0) {
          chosenMagic = pickWeightedItem(magicTableEntries, rng);
        }
      }

      // Fallback if no specific table entries
      if (!chosenMagic) {
        let magicCandidates = [];

        // +2 and +3 equipment / Epic relics at high CR (CR 4+)
        if (cr >= 4.0 && rng() < 0.25) {
          magicCandidates = tx.prepare(`
            SELECT * FROM item_definitions
            WHERE is_magical = 1 AND (enhancement_bonus >= 2 OR rarity IN ('RARE', 'EPIC', 'LEGENDARY')) AND min_cr <= ?
              AND name NOT IN (${INACTIVE_ITEMS_SQL})
            ORDER BY id ASC
          `).all(cr);
        }

        if (magicCandidates.length === 0) {
          magicCandidates = tx.prepare(`
            SELECT * FROM item_definitions
            WHERE is_magical = 1 AND (enhancement_bonus = 1 OR category = 'POTION' OR rarity IN ('UNCOMMON', 'RARE')) AND min_cr <= ?
              AND name NOT IN (${INACTIVE_ITEMS_SQL})
            ORDER BY id ASC
          `).all(cr);
        }

        if (magicCandidates.length > 0) {
          chosenMagic = magicCandidates[Math.floor(rng() * magicCandidates.length)];
        }
      }

      if (chosenMagic) {
        const insertRes = tx.prepare(`
          INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
          VALUES (?, 'CHARACTER', ?)
        `).run(chosenMagic.id, characterId);

        itemsAwarded.push({
          instanceId: Number(insertRes.lastInsertRowid),
          definitionId: chosenMagic.id,
          name: chosenMagic.name,
          category: chosenMagic.category,
          rarity: chosenMagic.rarity || 'UNCOMMON',
          is_magical: 1,
          enhancement_bonus: chosenMagic.enhancement_bonus || 0
        });
      }
    }

    return {
      goldAwarded,
      itemsAwarded,
      backpackFull
    };
  });
}

module.exports = {
  INACTIVE_ITEM_NAMES,
  TREASURE_CHANCES,
  GOLD_RANGES_STANDARD,
  MAGIC_DROP_CHANCES,
  getMagicDropChance,
  calculateMonsterGold,
  resolveLootTable,
  pickWeightedItem,
  generateMonsterLoot
};
