/**
 * Darkgrid Pathfinder-Inspired Loot System
 * Slices drops by Challenge Rating and Treasure Classification (None, Incidental, Standard, Double, NPC Gear).
 * Strictly guarantees ordinary animals never drop random gold or equipment.
 */

const { withTransaction } = require('../../db/connection');

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
  { maxCr: 0.99, chance: 0.005 }, // CR < 1: 0.5%
  { maxCr: 1.00, chance: 0.010 }, // CR 1: 1.0%
  { maxCr: 2.00, chance: 0.015 }, // CR 2: 1.5%
  { maxCr: 3.00, chance: 0.020 }, // CR 3: 2.0%
  { maxCr: 4.00, chance: 0.025 }, // CR 4: 2.5%
  { maxCr: Infinity, chance: 0.030 } // CR 5+: 3.0%
];

/**
 * Returns the magical drop chance for a given CR.
 */
function getMagicDropChance(cr) {
  for (const tier of MAGIC_DROP_CHANCES) {
    if (cr <= tier.maxCr) {
      return tier.chance;
    }
  }
  return 0.03;
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
 * Generates loot (gold and items) for a defeated monster, creating real item instances in SQLite.
 * @param {object} db Database connection
 * @param {object} monster Monster definition
 * @param {number} characterId Winning character ID
 * @param {object} options Optional { rng, forceGold, forceNormalItem, forceMagicItem }
 * @returns {{ goldAwarded: number, itemsAwarded: Array<{ id: number, name: string, is_magical: number }> }}
 */
function generateMonsterLoot(db, monster, characterId, options = {}) {
  const rng = options.rng || Math.random;

  // Rule: Ordinary animals NEVER drop random gold or equipment
  const creatureType = (monster.creature_type || '').toUpperCase().trim();
  if (creatureType === 'ANIMAL') {
    return { goldAwarded: 0, itemsAwarded: [] };
  }

  const treasureType = monster.treasure_type || 'Standard';
  const chances = TREASURE_CHANCES[treasureType] || TREASURE_CHANCES.Standard;

  let goldAwarded = 0;
  const itemsAwarded = [];

  return withTransaction(db, (tx) => {
    // 1. Roll Gold
    const rollGold = (options.forceGold !== undefined) ? options.forceGold : (rng() < chances.goldChance);
    if (rollGold && chances.goldChance > 0) {
      goldAwarded = calculateMonsterGold(monster.challenge_rating || 1, treasureType, rng);
      if (goldAwarded > 0) {
        tx.prepare('UPDATE characters SET gold = gold + ? WHERE id = ?').run(goldAwarded, characterId);
      }
    }

    // 2. Roll Normal Item
    const rollNormal = (options.forceNormalItem !== undefined) ? options.forceNormalItem : (rng() < chances.itemChance);
    if (rollNormal && chances.itemChance > 0) {
      const candidates = tx.prepare(`
        SELECT * FROM item_definitions
        WHERE is_magical = 0 AND buy_price > 0 AND category IN ('WEAPON', 'ARMOR', 'SHIELD')
        ORDER BY id ASC
      `).all();

      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(rng() * candidates.length)];
        const insertRes = tx.prepare(`
          INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
          VALUES (?, 'CHARACTER', ?)
        `).run(chosen.id, characterId);

        itemsAwarded.push({
          instanceId: Number(insertRes.lastInsertRowid),
          definitionId: chosen.id,
          name: chosen.name,
          category: chosen.category,
          is_magical: 0
        });
      }
    }

    // 3. Roll Magical Item
    const magicChance = getMagicDropChance(monster.challenge_rating || 1);
    const rollMagic = (options.forceMagicItem !== undefined) ? options.forceMagicItem : (rng() < magicChance);
    if (rollMagic && treasureType !== 'None') {
      const cr = monster.challenge_rating || 1;
      let magicCandidates = [];

      // +2 equipment is eligible only at CR 4+ and is rarer
      if (cr >= 4.0 && rng() < 0.25) {
        magicCandidates = tx.prepare(`
          SELECT * FROM item_definitions
          WHERE is_magical = 1 AND enhancement_bonus = 2 AND min_cr <= ?
          ORDER BY id ASC
        `).all(cr);
      }

      if (magicCandidates.length === 0) {
        magicCandidates = tx.prepare(`
          SELECT * FROM item_definitions
          WHERE is_magical = 1 AND (enhancement_bonus = 1 OR category = 'POTION') AND min_cr <= ?
          ORDER BY id ASC
        `).all(cr);
      }

      if (magicCandidates.length > 0) {
        const chosenMagic = magicCandidates[Math.floor(rng() * magicCandidates.length)];
        const insertRes = tx.prepare(`
          INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id)
          VALUES (?, 'CHARACTER', ?)
        `).run(chosenMagic.id, characterId);

        itemsAwarded.push({
          instanceId: Number(insertRes.lastInsertRowid),
          definitionId: chosenMagic.id,
          name: chosenMagic.name,
          category: chosenMagic.category,
          is_magical: 1,
          enhancement_bonus: chosenMagic.enhancement_bonus
        });
      }
    }

    return {
      goldAwarded,
      itemsAwarded
    };
  });
}

module.exports = {
  TREASURE_CHANCES,
  GOLD_RANGES_STANDARD,
  MAGIC_DROP_CHANCES,
  getMagicDropChance,
  calculateMonsterGold,
  generateMonsterLoot
};
