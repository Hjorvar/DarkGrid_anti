/**
 * Darkgrid Persistent Monsters & Permadeath Domain Logic
 * Handles player death, loot splitting (50% loss / 50% transfer), 20-item cap overflow,
 * +10% HP boost, map persistence, Monster Battle Experience victory recording,
 * canonical level-up HP + milestone attribute points, and victory resolution.
 */

const { withTransaction } = require('../../db/connection');
const {
  getAllCharacterItems,
  calculateXpWithIntelligence,
  applyCharacterLevelUp
} = require('../character/rules');
const { generateMonsterLoot } = require('../combat/loot');
const { recordMonsterVictory } = require('../combat/knowledge');

/**
 * Handles the complete permadeath lifecycle of a fallen hero.
 * Executed atomically in a single transaction.
 */
function handlePlayerDeath(db, character, encounter, monster, monsterInstance = null, options = {}) {
  const rng = options.rng || Math.random;

  return withTransaction(db, (tx) => {
    // 1. Mark character permanently dead atomically (idempotent: only if currently alive)
    const deathUpdate = tx.prepare(`
      UPDATE characters
      SET is_alive = 0, current_hp = 0, died_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_alive = 1
    `).run(character.id);

    if (deathUpdate.changes === 0) {
      return {
        instanceId: character.killed_by_monster_instance_id || null,
        goldTransferred: 0,
        itemsTransferred: 0,
        itemsDestroyed: 0,
        alreadyDead: true
      };
    }

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
      tx.prepare(`
        UPDATE monster_instances
        SET kill_count = kill_count + 1, current_hp = max_hp
        WHERE id = ? AND status = 'ACTIVE'
      `).run(instanceId);
    } else {
      const existingOnTile = tx.prepare(`
        SELECT * FROM monster_instances
        WHERE tile_id = ? AND status = 'ACTIVE'
      `).get(encounter.tile_id);

      const actualMonsterId = encounter.monster_id || (monster ? (monster.monster_id || monster.id) : null);
      const baseMonsterHp = (monster && monster.base_hp) || encounter.base_hp || 10;

      const standardPersistentHp = Math.ceil(baseMonsterHp * 1.10);
      const boostedMaxHp = bountyBoostedHp
        ? Math.max(standardPersistentHp, Number(bountyBoostedHp))
        : standardPersistentHp;

      if (existingOnTile && existingOnTile.monster_id === actualMonsterId) {
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
      WHERE id = ? AND status = 'ACTIVE'
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

    const currentMonsterItemCountRow = tx.prepare(`
      SELECT COUNT(*) as count
      FROM item_instances
      WHERE owner_type = 'MONSTER' AND owner_monster_id = ?
    `).get(instanceId);

    const currentCount = currentMonsterItemCountRow ? currentMonsterItemCountRow.count : 0;
    const availableSlots = Math.max(0, 20 - currentCount);

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

    for (const over of overflowItems) {
      destroyedItemIds.push(over.id);
    }

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

    const deleteStmt = tx.prepare('DELETE FROM item_instances WHERE id = ?');
    for (const delId of destroyedItemIds) {
      deleteStmt.run(delId);
    }

    tx.prepare(`
      UPDATE characters
      SET killed_by_monster_instance_id = ?
      WHERE id = ?
    `).run(instanceId, character.id);

    tx.prepare(`
      UPDATE encounters
      SET status = 'DEFEAT',
          monster_instance_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(instanceId, encounter.id);

    const deathText = 'Your vision fades to black as life leaves your shattered body. Your journey in Darkgrid has come to an end.';
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
 */
function handleMonsterDefeat(db, character, encounter, monster, monsterInstance = null, options = {}) {
  return withTransaction(db, (tx) => {
    const encCheck = tx.prepare('SELECT status FROM encounters WHERE id = ?').get(encounter.id);
    if (encCheck && (encCheck.status === 'VICTORY' || encCheck.status === 'DEFEAT')) {
      return { xpAwarded: 0, goldLooted: 0, itemsLooted: 0, alreadyResolved: true };
    }

    let goldLooted = 0;
    let itemsLooted = 0;

    const instanceId = encounter.monster_instance_id || (monsterInstance ? monsterInstance.id : null);
    let lootedItemNames = [];

    if (instanceId) {
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

      if (goldLooted > 0) {
        tx.prepare(`
          UPDATE characters
          SET gold = gold + ?
          WHERE id = ?
        `).run(goldLooted, character.id);
      }

      const lootItems = tx.prepare(`
        SELECT ii.id, id.name FROM item_instances ii
        JOIN item_definitions id ON ii.item_definition_id = id.id
        WHERE ii.owner_type = 'MONSTER' AND owner_monster_id = ?
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
      const lootResult = generateMonsterLoot(tx, resolvedMonster, character.id, options);
      goldLooted = lootResult.goldAwarded;
      itemsLooted = lootResult.itemsAwarded.length;
      lootedItemNames = (lootResult.itemsAwarded || []).map(i => i.name);
      monster = resolvedMonster;
    }

    // Record Monster Battle Experience victory for this character & species
    const knowledgeMonsterId =
      (encounter && encounter.monster_id) ||
      (monster && (monster.monster_id || monster.id)) ||
      (monsterInstance && monsterInstance.monster_id) ||
      null;
    if (knowledgeMonsterId) {
      recordMonsterVictory(tx, character.id, knowledgeMonsterId);
    }

    // Award XP reward (flat base XP per Phase 7A.4 OC-5) and apply canonical level-up + milestone attribute points
    const rawXp = (monster && monster.xp_reward) || (encounter && encounter.xp_reward) || 0;
    const charRow = tx.prepare('SELECT * FROM characters WHERE id = ?').get(character.id) || character;
    const xpAwarded = calculateXpWithIntelligence(rawXp, charRow.intelligence);
    const newXp = (charRow.xp || 0) + xpAwarded;

    const levelProgress = applyCharacterLevelUp(tx, character.id, newXp);
    const oldLevel = levelProgress ? levelProgress.oldLevel : (charRow.level || 1);
    const newLevel = levelProgress ? levelProgress.newLevel : oldLevel;
    const totalHpGain = levelProgress ? levelProgress.totalHpGain : 0;
    const attributePointsEarned = levelProgress ? levelProgress.attributePointsEarned : 0;

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

    const slainLabel = bountyCompleted
      ? `${bountyCompleted.customName} collapses to the earth with a final shudder`
      : 'The abominable beast collapses to the earth with a final shudder';
    let victoryText = `${slainLabel}. The battle is won! (+${xpAwarded} XP`;
    if (goldLooted > 0) victoryText += `, +${goldLooted} gp`;
    if (lootedItemNames.length > 0) victoryText += `, Looted: ${lootedItemNames.join(', ')}`;
    victoryText += ')';
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
        attribute_points_earned: attributePointsEarned,
        bounty_completed: Boolean(bountyCompleted),
        bounty_info: bountyCompleted
      })
    );

    if (newLevel > oldLevel) {
      let levelUpText = `Triumph! You have attained Level ${newLevel}! Maximum vitality increased by +${totalHpGain} HP.`;
      if (attributePointsEarned > 0) {
        levelUpText += ` You have earned +${attributePointsEarned} Attribute Point${attributePointsEarned > 1 ? 's' : ''} to allocate!`;
      }
      tx.prepare(`
        INSERT INTO combat_events (
          encounter_id, round_number, event_type, public_text, details
        ) VALUES (?, ?, 'LEVEL_UP', ?, ?)
      `).run(
        encounter.id,
        encounter.combat_round || 1,
        levelUpText,
        JSON.stringify({
          new_level: newLevel,
          hp_gain: totalHpGain,
          attribute_points_earned: attributePointsEarned
        })
      );
    }

    return {
      xpAwarded,
      goldLooted,
      itemsLooted,
      leveledUp: newLevel > oldLevel,
      newLevel,
      totalHpGain,
      attributePointsEarned,
      bountyCompleted
    };
  });
}

module.exports = {
  handlePlayerDeath,
  handleMonsterDefeat
};
