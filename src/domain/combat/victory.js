/**
 * Darkgrid Victory Screen Presentation Domain Logic
 * Strictly read-only: retrieves confirmed combat victory state, rewards, monster details,
 * and fallen hero avenger attribution without altering or re-awarding any gameplay mechanics.
 */

const { getEncounterById } = require('../encounters/engine');

/**
 * Resolves the canon defeat description from monster descriptions JSON.
 * Prioritizes the '9_dead' condition bracket.
 * Falls back to an evocative dark fantasy defeat description if absent.
 *
 * @param {string|object} descriptionsJson 
 * @returns {string} Defeat narrative text
 */
function resolveDefeatDescription(descriptionsJson) {
  let desc = {};
  if (typeof descriptionsJson === 'string') {
    try {
      desc = JSON.parse(descriptionsJson);
    } catch {
      desc = {};
    }
  } else if (typeof descriptionsJson === 'object' && descriptionsJson !== null) {
    desc = descriptionsJson;
  }

  if (desc['9_dead'] && typeof desc['9_dead'] === 'string' && desc['9_dead'].trim().length > 0) {
    return desc['9_dead'].trim();
  }

  return 'The abominable beast collapses to the cold earth with a final shudder, vanquished at your hand.';
}

/**
 * Retrieves the complete victory presentation data for a completed encounter.
 * Purely read-only; absolutely no mutations to character or monster tables.
 *
 * @param {object} db Database instance
 * @param {number} characterId Living hero ID
 * @param {number} encounterId Resolved encounter ID
 * @returns {object|null} Victory presentation payload or null if invalid/ineligible
 */
function getVictoryData(db, characterId, encounterId) {
  if (!db || !characterId || !encounterId) return null;

  // 1. Fetch character
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  if (!character) return null;

  // 2. Fetch encounter with monster & tile details
  const encounter = getEncounterById(db, encounterId, character.class);
  if (!encounter) return null;

  // Verify ownership and that this encounter is indeed completed in VICTORY
  if (encounter.character_id !== characterId || encounter.status !== 'VICTORY') {
    return null;
  }

  // 3. Resolve defeat description from monster descriptions
  const defeatDescription = resolveDefeatDescription(encounter.monster_descriptions);

  // 4. Retrieve VICTORY combat event details
  const victoryEvent = db.prepare(`
    SELECT * FROM combat_events
    WHERE encounter_id = ? AND event_type = 'VICTORY'
    ORDER BY id DESC LIMIT 1
  `).get(encounterId);

  let details = {};
  if (victoryEvent && victoryEvent.details) {
    try {
      details = JSON.parse(victoryEvent.details);
    } catch {
      details = {};
    }
  }

  const xpAwarded = details.xp_awarded ?? (encounter.xp_reward || 0);
  const goldLooted = details.gold_looted ?? 0;
  const itemsLooted = details.items_looted ?? 0;
  const lootedItems = Array.isArray(details.looted_items) ? details.looted_items : [];
  const leveledUp = Boolean(details.leveled_up);
  const newLevel = details.new_level ?? character.level;
  const hpGain = details.hp_gain ?? 0;
  const resolvedByOther = Boolean(details.resolved_by_other);

  // 5. Persistent Monster & Avenged Fallen Heroes check
  let persistentInfo = null;
  if (encounter.monster_instance_id) {
    const instance = db.prepare(`
      SELECT mi.*, m.name as monster_name
      FROM monster_instances mi
      JOIN monsters m ON mi.monster_id = m.id
      WHERE mi.id = ?
    `).get(encounter.monster_instance_id);

    if (instance) {
      // Find authentic fallen heroes slain by this persistent monster instance
      const avengedHeroes = db.prepare(`
        SELECT id, name, class, level, died_at
        FROM characters
        WHERE killed_by_monster_instance_id = ?
        ORDER BY died_at DESC, id DESC
      `).all(encounter.monster_instance_id);

      persistentInfo = {
        isPersistent: true,
        instanceId: instance.id,
        killCount: instance.kill_count || avengedHeroes.length || 0,
        customTitle: instance.custom_title || null,
        avengedHeroes: avengedHeroes || []
      };
    }
  }

  const cleanMonsterName = (encounter.monster_name || '').replace(/\[.*?\]/g, '').trim();

  return {
    character,
    encounter,
    cleanMonsterName,
    monsterSymbol: encounter.monster_symbol,
    monsterColor: encounter.monster_color || 'var(--accent-gold)',
    imageUrl: encounter.imageUrl,
    imageSlug: encounter.imageSlug,
    defeatDescription,
    xpAwarded,
    goldLooted,
    itemsLooted,
    lootedItems,
    leveledUp,
    newLevel,
    hpGain,
    resolvedByOther,
    persistentInfo
  };
}

module.exports = {
  resolveDefeatDescription,
  getVictoryData
};
