/**
 * Darkgrid Persistent Monsters & Permadeath Domain Logic
 * Handles player death, loot splitting (50% loss / 50% transfer), 20-item cap overflow,
 * +10% HP boost, map persistence, and victory resolution.
 */

const { withTransaction } = require('../../db/connection');
const { getAllCharacterItems, getLevelForXp, getHpPerLevel, calculateXpWithIntelligence } = require('../character/rules');
const { generateMonsterLoot } = require('../combat/loot');

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

    // 1b. Fail any active or unclaimed hunting contracts belonging to the slain character
    let bountyCustomTitle = (encounter && encounter.bounty_custom_name) || null;
    let bountyBoostedHp = (encounter && encounter.bounty_boosted_max_hp) || null;

    try {
      if (encounter && encounter.bounty_contract_id && (!bountyCustomTitle || !bountyBoostedHp)) {
        const hcRow = tx.prepare('SELECT custom_name, boosted_max_hp FROM hunting_contracts WHERE id = ?').get(encounter.bounty_contract_id);
        if (hcRow) {
          bountyCustomTitle = hcRow.custom_name;
          bountyBoostedHp = hcRow.boosted_max_hp;
        }
      }
      tx.prepare(`
        UPDATE hunting_contracts
        SET status = 'FAILED', completed_at = CURRENT_TIMESTAMP
        WHERE character_id = ? AND status IN ('ACTIVE', 'READY_TO_CLAIM')
      `).run(character.id);
    } catch {
      // Gracefully ignore if hunting_contracts table is not present in a minimal test schema
    }

    // 2. Identify or create persistent monster instance
    const hadExistingInstance = Boolean(encounter.monster_instance_id || (monsterInstance && monsterInstance.id));
    let instanceId = encounter.monster_instance_id || (monsterInstance ? monsterInstance.id : null);

    if (instanceId) {
      // Monster was already persistent — increment kill count, reset HP to full (H2)
      tx.prepare(`
        UPDATE monster_instances
        SET kill_count = kill_count + 1, current_hp = max_hp
        WHERE id = ?
      `).run(instanceId);
    } else {
      // Monster was a random or bounty spawn — check if an active persistent monster already occupies the tile
      const existingOnTile = tx.prepare(`
        SELECT * FROM monster_instances
        WHERE tile_id = ? AND status = 'ACTIVE'
      `).get(encounter.tile_id);

      const actualMonsterId = encounter.monster_id || (monster ? (monster.monster_id || monster.id) : null);
      const baseMonsterHp = (monster && monster.base_hp) || encounter.base_hp || 10;

      // Avoid double-stacking +15% TOUGH bounty HP boost and +10% persistent HP boost
      const standardPersistentHp = Math.ceil(baseMonsterHp * 1.10);
      const boostedMaxHp = bountyBoostedHp
        ? Math.max(standardPersistentHp, Number(bountyBoostedHp))
        : standardPersistentHp;

      if (existingOnTile && existingOnTile.monster_id === actualMonsterId) {
        // Tile collision edge case: absorb kill into existing persistent monster of the SAME species
        instanceId = existingOnTile.id;
        const mergedMaxHp = Math.max(existingOnTile.max_hp || standardPersistentHp, boostedMaxHp);
        tx.prepare(`
          UPDATE monster_instances
          SET kill_count = kill_count + 1,
               max_hp = ?,
               current_hp = ?,
               custom_title = COALESCE(custom_title, ?)
          WHERE id = ?
        `).run(mergedMaxHp, mergedMaxHp, bountyCustomTitle, instanceId);
      } else if (!existingOnTile) {
        // Create new persistent monster instance (preserving custom_title if killed by a Named Bounty)
        const insertStmt = tx.prepare(`
          INSERT INTO monster_instances (
            monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, custom_title, status
          ) VALUES (?, ?, ?, ?, 0, 1, ?, 'ACTIVE')
        `);

        const res = insertStmt.run(
          actualMonsterId,
          encounter.tile_id,
          boostedMaxHp,
          boostedMaxHp,
          bountyCustomTitle
        );
        instanceId = Number(res.lastInsertRowid);
      } else {
        // Tile collision with DIFFERENT species: find nearest open wilderness tile (L10)
        const openTile = tx.prepare(`
          SELECT mt.id FROM map_tiles mt
          LEFT JOIN monster_instances mi ON mt.id = mi.tile_id AND mi.status = 'ACTIVE'
          WHERE mt.is_safe = 0 AND mt.is_passable = 1 AND mi.id IS NULL
          ORDER BY ABS(mt.x - (SELECT x FROM map_tiles WHERE id = ?)) + ABS(mt.y - (SELECT y FROM map_tiles WHERE id = ?)) ASC
          LIMIT 1
        `).get(encounter.tile_id, encounter.tile_id);

        const targetTileId = openTile ? openTile.id : encounter.tile_id;
        const insertStmt = tx.prepare(`
          INSERT INTO monster_instances (
            monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, custom_title, status
          ) VALUES (?, ?, ?, ?, 0, 1, ?, 'ACTIVE')
        `);

        const res = insertStmt.run(
          actualMonsterId,
          targetTileId,
          boostedMaxHp,
          boostedMaxHp,
          bountyCustomTitle
        );
        instanceId = Number(res.lastInsertRowid);
      }
    }

    // 3. Anti-Mule-Feeding & Gold retention: 50% transferred to monster, 50% destroyed
    const charRow = tx.prepare('SELECT * FROM characters WHERE id = ?').get(character.id) || character;
    const isZeroXpLevel1 = Number(charRow.level || 1) <= 1 && Number(charRow.xp || 0) === 0;
    let priorZeroXpDeaths = 0;
    if (isZeroXpLevel1 && charRow.user_id) {
      const priorRow = tx.prepare(`
        SELECT COUNT(*) as c FROM characters
        WHERE user_id = ? AND is_alive = 0 AND COALESCE(xp, 0) = 0 AND id != ?
      `).get(charRow.user_id, charRow.id);
      priorZeroXpDeaths = priorRow ? Number(priorRow.c || 0) : 0;
    }
    const isMuleFeed = isZeroXpLevel1 && (priorZeroXpDeaths > 0 || (hadExistingInstance && Number(charRow.gold || 0) <= 10));

    const goldTransferred = (isMuleFeed && Number(charRow.gold || 0) <= 10)
      ? 0
      : Math.floor((charRow.gold || 0) * 0.5);
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
    // (Starter items on a 0-XP mule alt are destroyed rather than stacked onto the monster)
    const allItems = getAllCharacterItems(tx, character.id);
    const survivingItems = [];
    const destroyedItemIds = [];

    for (const item of allItems) {
      let isStarterItem = false;
      if (item.modifications) {
        try {
          const mods = typeof item.modifications === 'string' ? JSON.parse(item.modifications) : item.modifications;
          isStarterItem = Boolean(mods && mods.is_starter === true);
        } catch {
          isStarterItem = false;
        }
      }

      if (isMuleFeed && isStarterItem) {
        destroyedItemIds.push(item.id);
      } else if (rng() < 0.50) {
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
function handleMonsterDefeat(db, character, encounter, monster, monsterInstance = null, options = {}) {
  return withTransaction(db, (tx) => {
    let goldLooted = 0;
    let itemsLooted = 0;

    const instanceId = encounter.monster_instance_id || (monsterInstance ? monsterInstance.id : null);

    let lootedItemNames = [];

    if (instanceId) {
      // Persistent monster defeated: atomically mark DEFEATED and zero held_gold where status = 'ACTIVE' (H1)
      const instRow = tx.prepare('SELECT * FROM monster_instances WHERE id = ?').get(instanceId);
      if (instRow && instRow.status === 'ACTIVE') {
        goldLooted = instRow.held_gold || 0;
      }

      const updateRes = tx.prepare(`
        UPDATE monster_instances
        SET status = 'DEFEATED', held_gold = 0, defeated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'ACTIVE'
      `).run(instanceId);

      if (updateRes.changes === 0) {
        // Monster was already defeated by another champion!
        // Player receives 0 gold, 0 loot, 0 XP, and no duplication occurs.
        tx.prepare(`
          UPDATE encounters
          SET status = 'VICTORY', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(encounter.id);

        const victoryText = 'Another champion has already slain this creature! The battlefield is quiet.';
        tx.prepare(`
          INSERT INTO combat_events (
            encounter_id, round_number, event_type, public_text, details
          ) VALUES (?, ?, 'VICTORY', ?, ?)
        `).run(
          encounter.id,
          encounter.combat_round || 1,
          victoryText,
          JSON.stringify({
            xp_awarded: 0,
            gold_looted: 0,
            items_looted: 0,
            resolved_by_other: true
          })
        );

        return { xpAwarded: 0, goldLooted: 0, itemsLooted: 0, resolvedByOther: true };
      }

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
        SELECT ii.id, id.name FROM item_instances ii
        JOIN item_definitions id ON ii.item_definition_id = id.id
        WHERE ii.owner_type = 'MONSTER' AND ii.owner_monster_id = ?
      `).all(instanceId);

      itemsLooted = lootItems.length;
      lootedItemNames = lootItems.map(i => i.name);

      tx.prepare(`
        UPDATE item_instances
        SET owner_type = 'CHARACTER',
            owner_character_id = ?,
            owner_monster_id = NULL,
            equipped_slot = NULL
        WHERE owner_type = 'MONSTER' AND owner_monster_id = ?
      `).run(character.id, instanceId);
    } else {
      // Ensure monster record carries challenge_rating, treasure_type, creature_type, creature_subtype, and xp_reward
      let resolvedMonster = monster || encounter || {};
      const targetMonsterId =
        (encounter && encounter.monster_id) ||
        (monster && (monster.monster_id || monster.id)) ||
        null;
      if (
        targetMonsterId &&
        (resolvedMonster.challenge_rating === undefined ||
          resolvedMonster.challenge_rating === null ||
          !resolvedMonster.treasure_type ||
          !resolvedMonster.creature_type)
      ) {
        const dbMonster = tx.prepare(`
          SELECT id, name, challenge_rating, treasure_type, creature_type, creature_subtype, xp_reward
          FROM monsters
          WHERE id = ?
        `).get(targetMonsterId);
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
            creature_subtype: resolvedMonster.creature_subtype || dbMonster.creature_subtype,
            xp_reward:
              resolvedMonster.xp_reward !== undefined && resolvedMonster.xp_reward !== null
                ? resolvedMonster.xp_reward
                : dbMonster.xp_reward
          };
        }
      }
      // Random encounter defeated: generate Pathfinder-inspired loot drop
      const lootResult = generateMonsterLoot(tx, resolvedMonster, character.id, options);
      goldLooted = lootResult.goldAwarded;
      itemsLooted = lootResult.itemsAwarded.length;
      lootedItemNames = (lootResult.itemsAwarded || []).map(i => i.name);
      monster = resolvedMonster;
    }

    // Award XP reward scaled by Hero Intelligence modifier (+10% per +1 INT mod) and check for level-up
    const rawXp = (monster && monster.xp_reward) || (encounter && encounter.xp_reward) || 0;
    const charRow = tx.prepare('SELECT * FROM characters WHERE id = ?').get(character.id) || character;
    const xpAwarded = calculateXpWithIntelligence(rawXp, charRow.intelligence);
    const newXp = (charRow.xp || 0) + xpAwarded;
    const oldLevel = charRow.level || 1;
    const newLevel = Math.max(oldLevel, getLevelForXp(newXp));

    let currentHp = charRow.current_hp;
    let maxHp = charRow.max_hp;
    let totalHpGain = 0;

    if (newLevel > oldLevel) {
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        const hpGain = getHpPerLevel(charRow.class, charRow.constitution);
        currentHp += hpGain;
        maxHp += hpGain;
        totalHpGain += hpGain;
      }
    }

    tx.prepare(`
      UPDATE characters
      SET xp = ?, level = ?, current_hp = ?, max_hp = ?
      WHERE id = ?
    `).run(newXp, newLevel, currentHp, maxHp, character.id);

    // Conclude encounter with VICTORY
    tx.prepare(`
      UPDATE encounters
      SET status = 'VICTORY',
          current_monster_hp = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(encounter.id);

    // Check if this encounter was a Named Hunting Contract target
    let bountyCompleted = null;
    if (encounter && encounter.bounty_contract_id) {
      try {
        const contractRow = tx.prepare(`
          SELECT hc.*, m.name AS base_monster_name
          FROM hunting_contracts hc
          JOIN monsters m ON hc.base_monster_id = m.id
          WHERE hc.id = ? AND hc.character_id = ? AND hc.status = 'ACTIVE'
        `).get(encounter.bounty_contract_id, character.id);

        if (contractRow) {
          const updateBounty = tx.prepare(`
            UPDATE hunting_contracts
            SET status = 'READY_TO_CLAIM', completed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND character_id = ? AND status = 'ACTIVE'
          `).run(contractRow.id, character.id);

          if (updateBounty.changes === 1) {
            bountyCompleted = {
              contractId: contractRow.id,
              title: contractRow.title,
              customName: contractRow.custom_name,
              baseMonsterName: contractRow.base_monster_name,
              regionName: contractRow.region_name,
              rewardGold: contractRow.reward_gold
            };
          }
        }
      } catch {
        bountyCompleted = null;
      }
    }

    // Log victory event in combat log
    const slainLabel = bountyCompleted
      ? `${bountyCompleted.customName} collapses to the earth with a final shudder`
      : `The abominable beast collapses to the earth with a final shudder`;
    let victoryText = `${slainLabel}. The battle is won! (+${xpAwarded} XP`;
    if (goldLooted > 0) victoryText += `, +${goldLooted} gp`;
    if (lootedItemNames.length > 0) victoryText += `, Looted: ${lootedItemNames.join(', ')}`;
    victoryText += `)`;
    if (bountyCompleted) {
      victoryText += ` Bounty Target Slain! Return to Oakhaven to collect your ${bountyCompleted.rewardGold} gold reward.`;
    }

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
        items_looted: itemsLooted,
        looted_items: lootedItemNames,
        leveled_up: newLevel > oldLevel,
        new_level: newLevel,
        hp_gain: totalHpGain,
        bounty_completed: Boolean(bountyCompleted),
        bounty_info: bountyCompleted
      })
    );

    if (newLevel > oldLevel) {
      const levelUpText = `Triumph! You have attained Level ${newLevel}! Maximum vitality increased by +${totalHpGain} HP.`;
      tx.prepare(`
        INSERT INTO combat_events (
          encounter_id, round_number, event_type, public_text, details
        ) VALUES (?, ?, 'LEVEL_UP', ?, ?)
      `).run(
        encounter.id,
        encounter.combat_round || 1,
        levelUpText,
        JSON.stringify({ new_level: newLevel, hp_gain: totalHpGain })
      );
    }

    return {
      xpAwarded,
      goldLooted,
      itemsLooted,
      leveledUp: newLevel > oldLevel,
      newLevel,
      totalHpGain,
      bountyCompleted
    };
  });
}

module.exports = {
  handlePlayerDeath,
  handleMonsterDefeat
};
