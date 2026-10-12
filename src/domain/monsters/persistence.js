/**
 * Darkgrid Persistent Monsters & Permadeath Domain Logic
 * Handles player death, loot splitting (50% loss / 50% transfer), 20-item cap overflow,
 * +10% HP boost, map persistence, and victory resolution.
 */

const { withTransaction } = require('../../db/connection');
const { getAllCharacterItems } = require('../character/rules');

/**
 * Handles the complete permadeath lifecycle of a fallen hero.
 * Executed atomically in a single transaction.
 * @param {object} db Database connection
 * @param {object} character Fallen character
 * @param {object} encounter Active encounter
 * @param {object} monster Base monster record
 * @param {object|null} monsterInstance Existing persistent monster if applicable
 * @param {object} options Optional { rng }
 * @returns {{ instanceId: number, goldTransferred: number, itemsTransferred: number, itemsDestroyed: number }}
 */
function handlePlayerDeath(db, character, encounter, monster, monsterInstance = null, options = {}) {
  const rng = options.rng || Math.random;

  return withTransaction(db, (tx) => {
    // 1. Mark character permanently dead
    tx.prepare(`
      UPDATE characters
      SET is_alive = 0, current_hp = 0, died_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(character.id);

    // 2. Identify or create persistent monster instance
    let instanceId = encounter.monster_instance_id || (monsterInstance ? monsterInstance.id : null);

    if (instanceId) {
      // Monster was already persistent — increment kill count, no secondary HP boost
      tx.prepare(`
        UPDATE monster_instances
        SET kill_count = kill_count + 1
        WHERE id = ?
      `).run(instanceId);
    } else {
      // Monster was a random spawn — check if an active persistent monster already occupies the tile
      const existingOnTile = tx.prepare(`
        SELECT * FROM monster_instances
        WHERE tile_id = ? AND status = 'ACTIVE'
      `).get(encounter.tile_id);

      if (existingOnTile) {
        // Tile collision edge case: absorb kill into existing persistent monster
        instanceId = existingOnTile.id;
        tx.prepare(`
          UPDATE monster_instances
          SET kill_count = kill_count + 1
          WHERE id = ?
        `).run(instanceId);
      } else {
        // Create new persistent monster instance with +10% HP boost (granted once)
        const boostedMaxHp = Math.ceil(monster.base_hp * 1.10);
        const insertStmt = tx.prepare(`
          INSERT INTO monster_instances (
            monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, status
          ) VALUES (?, ?, ?, ?, 0, 1, 'ACTIVE')
        `);

        const res = insertStmt.run(
          monster.id,
          encounter.tile_id,
          boostedMaxHp,
          boostedMaxHp
        );
        instanceId = Number(res.lastInsertRowid);
      }
    }

    // 3. Gold retention: 50% transferred to monster, 50% destroyed
    const charRow = tx.prepare('SELECT * FROM characters WHERE id = ?').get(character.id) || character;
    const goldTransferred = Math.floor((charRow.gold || 0) * 0.5);
    tx.prepare(`
      UPDATE monster_instances
      SET held_gold = held_gold + ?
      WHERE id = ?
    `).run(goldTransferred, instanceId);

    tx.prepare(`
      UPDATE characters
      SET gold = 0
      WHERE id = ?
    `).run(character.id);

    // 4. Equipment and Inventory retention: 50% roll per item across ALL owned items
    const allItems = getAllCharacterItems(tx, character.id);
    const survivingItems = [];
    const destroyedItemIds = [];

    for (const item of allItems) {
      if (rng() < 0.50) {
        survivingItems.push(item);
      } else {
        destroyedItemIds.push(item.id);
      }
    }

    // Enforce 20-item cap on the monster instance
    const currentMonsterItemCountRow = tx.prepare(`
      SELECT COUNT(*) as count
      FROM item_instances
      WHERE owner_type = 'MONSTER' AND owner_monster_id = ?
    `).get(instanceId);

    const currentCount = currentMonsterItemCountRow ? currentMonsterItemCountRow.count : 0;
    const availableSlots = Math.max(0, 20 - currentCount);

    // Sort surviving items by priority:
    // 1. Magical items first
    // 2. Highest buy_price next
    // 3. Lowest ID (deterministic tie-breaker)
    survivingItems.sort((a, b) => {
      const magA = a.is_magical ? 1 : 0;
      const magB = b.is_magical ? 1 : 0;
      if (magA !== magB) return magB - magA;
      const priceA = a.buy_price || 0;
      const priceB = b.buy_price || 0;
      if (priceA !== priceB) return priceB - priceA;
      return a.id - b.id;
    });

    const itemsToTransfer = survivingItems.slice(0, availableSlots);
    const overflowItems = survivingItems.slice(availableSlots);

    // Overflow items are destroyed
    for (const over of overflowItems) {
      destroyedItemIds.push(over.id);
    }

    // Transfer surviving items to monster
    const transferStmt = tx.prepare(`
      UPDATE item_instances
      SET owner_type = 'MONSTER',
          owner_monster_id = ?,
          owner_character_id = NULL,
          equipped_slot = NULL
      WHERE id = ?
    `);

    for (const item of itemsToTransfer) {
      transferStmt.run(instanceId, item.id);
    }

    // Destroy lost items
    const deleteStmt = tx.prepare(`DELETE FROM item_instances WHERE id = ?`);
    for (const delId of destroyedItemIds) {
      deleteStmt.run(delId);
    }

    // 5. Link fallen character to the killer monster instance
    tx.prepare(`
      UPDATE characters
      SET killed_by_monster_instance_id = ?
      WHERE id = ?
    `).run(instanceId, character.id);

    // 6. Conclude encounter with DEFEAT
    tx.prepare(`
      UPDATE encounters
      SET status = 'DEFEAT',
          monster_instance_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(instanceId, encounter.id);

    // 7. Log death event in combat log
    const deathText = `Your vision fades to black as life leaves your shattered body. Your journey in Darkgrid has come to an end.`;
    tx.prepare(`
      INSERT INTO combat_events (
        encounter_id, round_number, event_type, public_text, details
      ) VALUES (?, ?, 'DEATH', ?, ?)
    `).run(
      encounter.id,
      encounter.combat_round || 1,
      deathText,
      JSON.stringify({
        killed_by_monster_instance_id: instanceId,
        gold_transferred: goldTransferred,
        items_transferred: itemsToTransfer.length,
        items_destroyed: destroyedItemIds.length
      })
    );

    return {
      instanceId,
      goldTransferred,
      itemsTransferred: itemsToTransfer.length,
      itemsDestroyed: destroyedItemIds.length
    };
  });
}

/**
 * Handles victory over a monster (random or persistent).
 * Executed atomically in a single transaction.
 * @param {object} db Database connection
 * @param {object} character Winning hero
 * @param {object} encounter Active encounter
 * @param {object} monster Base monster record
 * @param {object|null} monsterInstance Persistent monster instance if applicable
 * @returns {{ xpAwarded: number, goldLooted: number, itemsLooted: number }}
 */
function handleMonsterDefeat(db, character, encounter, monster, monsterInstance = null) {
  return withTransaction(db, (tx) => {
    let goldLooted = 0;
    let itemsLooted = 0;

    const instanceId = encounter.monster_instance_id || (monsterInstance ? monsterInstance.id : null);

    if (instanceId) {
      // Persistent monster defeated: mark DEFEATED and transfer all held loot to the victor
      const instRow = tx.prepare('SELECT * FROM monster_instances WHERE id = ?').get(instanceId);
      if (instRow) {
        goldLooted = instRow.held_gold || 0;
      }

      tx.prepare(`
        UPDATE monster_instances
        SET status = 'DEFEATED', defeated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(instanceId);

      // Transfer held gold
      if (goldLooted > 0) {
        tx.prepare(`
          UPDATE characters
          SET gold = gold + ?
          WHERE id = ?
        `).run(goldLooted, character.id);
      }

      // Transfer all preserved items from monster to winner's inventory
      const lootItems = tx.prepare(`
        SELECT id FROM item_instances
        WHERE owner_type = 'MONSTER' AND owner_monster_id = ?
      `).all(instanceId);

      itemsLooted = lootItems.length;

      tx.prepare(`
        UPDATE item_instances
        SET owner_type = 'CHARACTER',
            owner_character_id = ?,
            owner_monster_id = NULL,
            equipped_slot = NULL
        WHERE owner_type = 'MONSTER' AND owner_monster_id = ?
      `).run(character.id, instanceId);
    }

    // Award standard XP reward
    const xpAwarded = monster.xp_reward || 0;
    tx.prepare(`
      UPDATE characters
      SET xp = xp + ?
      WHERE id = ?
    `).run(xpAwarded, character.id);

    // Conclude encounter with VICTORY
    tx.prepare(`
      UPDATE encounters
      SET status = 'VICTORY',
          current_monster_hp = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(encounter.id);

    // Log victory event in combat log
    const victoryText = `The abominable beast collapses to the earth with a final shudder. The battle is won!`;
    tx.prepare(`
      INSERT INTO combat_events (
        encounter_id, round_number, event_type, public_text, details
      ) VALUES (?, ?, 'VICTORY', ?, ?)
    `).run(
      encounter.id,
      encounter.combat_round || 1,
      victoryText,
      JSON.stringify({
        xp_awarded: xpAwarded,
        gold_looted: goldLooted,
        items_looted: itemsLooted
      })
    );

    return {
      xpAwarded,
      goldLooted,
      itemsLooted
    };
  });
}

module.exports = {
  handlePlayerDeath,
  handleMonsterDefeat
};
