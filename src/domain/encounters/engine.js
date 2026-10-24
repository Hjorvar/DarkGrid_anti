const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { withTransaction } = require('../../db/connection');
const { getDistanceToNearestSafeCity } = require('../world/map');
const { resolveMonsterFamily } = require('../monsters/taxonomy');
const {
  hasClassGeneralKnowledge,
  getCharacterMonsterKnowledge,
  evaluateHeroMonsterKnowledge
} = require('../combat/knowledge');

/**
 * Calculates the maximum Challenge Rating (CR) allowed for random encounters
 * based on distance (in grid steps) from the nearest safe city haven.
 */
function getMaxCrForDistance(distance) {
  if (distance === null || distance === undefined || !isFinite(distance)) {
    return null;
  }
  if (distance <= 0) return 0;
  if (distance === 1) return (1 / 3) + 0.001;
  if (distance === 2) return 0.5;
  if (distance === 3) return 1.0;
  return null;
}

/**
 * Calculates Gaussian weight for an available monster level L relative to hero level H.
 */
function calculateNormalWeight(monsterLevel, heroLevel, sigma = config.encounterSigma) {
  const diff = monsterLevel - heroLevel;
  return Math.exp(-Math.pow(diff, 2) / (2 * Math.pow(sigma, 2)));
}

/**
 * Weighted random picker
 */
function weightedPick(itemsWithWeights, rng = Math.random) {
  if (!itemsWithWeights || itemsWithWeights.length === 0) return null;
  const totalWeight = itemsWithWeights.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return itemsWithWeights[0].item;

  let roll = rng() * totalWeight;
  for (const entry of itemsWithWeights) {
    if (roll < entry.weight) {
      return entry.item;
    }
    roll -= entry.weight;
  }
  return itemsWithWeights[itemsWithWeights.length - 1].item;
}

/**
 * Selects monster candidate using the two-step normal-weighted algorithm
 */
function selectMonsterForTerrainAndHero(db, terrainName, heroLevel, options = {}) {
  const rng = options.rng || Math.random;
  const sigma = options.sigma || config.encounterSigma;
  const maxCr = options.maxCr !== undefined ? options.maxCr : null;
  const normalizedTerrain = (terrainName || '').toUpperCase();

  let matchingMonsters = [];

  try {
    const stmt = db.prepare(`
      SELECT m.* FROM monsters m
      JOIN monster_terrains mt ON m.id = mt.monster_id
      WHERE mt.terrain = ? AND m.solo_level IS NOT NULL AND m.solo_level >= 1
    `);
    matchingMonsters = stmt.all(normalizedTerrain);
  } catch {
    matchingMonsters = [];
  }

  if (matchingMonsters.length === 0) {
    const habitatCode = config.terrainHabitatMap[normalizedTerrain];
    if (habitatCode) {
      try {
        const stmt = db.prepare(`
          SELECT * FROM monsters
          WHERE solo_level IS NOT NULL AND solo_level >= 1
        `);
        const allMonsters = stmt.all();
        matchingMonsters = allMonsters.filter(m => {
          try {
            const habitats = JSON.parse(m.habitat);
            return Array.isArray(habitats) && habitats.includes(habitatCode);
          } catch {
            return false;
          }
        });
      } catch {
        matchingMonsters = [];
      }
    }
  }

  if (maxCr !== null && maxCr !== undefined) {
    matchingMonsters = matchingMonsters.filter(m => m.challenge_rating <= maxCr);
  }

  if (matchingMonsters.length === 0) {
    return null;
  }

  const byLevel = new Map();
  for (const m of matchingMonsters) {
    if (!byLevel.has(m.solo_level)) {
      byLevel.set(m.solo_level, []);
    }
    byLevel.get(m.solo_level).push(m);
  }

  const levelWeightEntries = [];
  for (const level of byLevel.keys()) {
    const weight = calculateNormalWeight(level, heroLevel, sigma);
    levelWeightEntries.push({ item: level, weight });
  }

  const chosenLevel = weightedPick(levelWeightEntries, rng);
  const candidatesAtLevel = byLevel.get(chosenLevel);

  const monsterWeightEntries = candidatesAtLevel.map(m => ({
    item: m,
    weight: Math.max(1, m.spawn_weight || 10)
  }));

  return weightedPick(monsterWeightEntries, rng);
}

/**
 * Resolves the appropriate description text based on hero class / Monster Knowledge / Battle Experience and encounter state.
 * Unlocks 2_ranger_distant and 4_ranger_close when:
 * - Hero is a RANGER (Keen Senses / Natural Knowledge), OR
 * - Hero has thematic class knowledge for monsterContext (Fighter Know Your Enemy / Cleric Sacred Knowledge), OR
 * - Hero has Recognized/Experienced Battle Experience (victories >= 1) against monsterContext.
 */
function resolveMonsterDescription(descriptionsJson, heroClassOrCharacter, state = 'DISCOVERED', monsterContext = null) {
  let descriptions = {};
  if (typeof descriptionsJson === 'string') {
    try {
      descriptions = JSON.parse(descriptionsJson);
    } catch {
      descriptions = {};
    }
  } else if (typeof descriptionsJson === 'object' && descriptionsJson !== null) {
    descriptions = descriptionsJson;
  }

  const heroClass = typeof heroClassOrCharacter === 'string'
    ? heroClassOrCharacter
    : (heroClassOrCharacter && heroClassOrCharacter.class ? heroClassOrCharacter.class : '');
  const isRanger = (heroClass || '').toUpperCase() === 'RANGER';

  let hasEnhancedKnowledge = isRanger;
  if (!hasEnhancedKnowledge && monsterContext) {
    if (hasClassGeneralKnowledge(heroClassOrCharacter, monsterContext)) {
      hasEnhancedKnowledge = true;
    } else if (
      Number(monsterContext.victories || monsterContext.victories_against || 0) >= 1 ||
      (heroClassOrCharacter && typeof heroClassOrCharacter === 'object' && Number(heroClassOrCharacter.monster_victories || 0) >= 1)
    ) {
      hasEnhancedKnowledge = true;
    }
  }

  if (state === 'DISCOVERED') {
    if (hasEnhancedKnowledge && descriptions['2_ranger_distant']) {
      return {
        text: descriptions['2_ranger_distant'],
        isRangerSpecial: true,
        type: 'ranger_distant'
      };
    }
    return {
      text: descriptions['1_distant'] || 'An indistinct threat lurks in the shadows.',
      isRangerSpecial: false,
      type: 'distant'
    };
  }

  if (state === 'IN_COMBAT' || state === 'INVESTIGATED') {
    if (hasEnhancedKnowledge && descriptions['4_ranger_close']) {
      return {
        text: descriptions['4_ranger_close'],
        isRangerSpecial: true,
        type: 'ranger_close'
      };
    }
    return {
      text: descriptions['3_close'] || 'The creature lunges forward with menace and fury!',
      isRangerSpecial: false,
      type: 'close'
    };
  }

  return {
    text: descriptions['1_distant'] || '',
    isRangerSpecial: false,
    type: 'default'
  };
}

/**
 * Resolves hero detection (spottedByHero) and ambush status (isAmbush).
 * Phase 9B Owner Decision: Level 1 heroes can be ambushed just like Level 2+.
 */
function resolveDetectionAndAmbush(character, monster, options = {}, defaults = {}) {
  let isAmbush = 0;
  let spottedByHero = 1;

  if (options.isAmbush !== undefined) {
    isAmbush = options.isAmbush ? 1 : 0;
    spottedByHero = options.spottedByHero !== undefined ? (options.spottedByHero ? 1 : 0) : (isAmbush ? 0 : 1);
  } else if (options.spottedByHero !== undefined) {
    spottedByHero = options.spottedByHero ? 1 : 0;
    isAmbush = spottedByHero ? 0 : 1;
  } else if (defaults.isPersistent && !options.ambushRng) {
    spottedByHero = 1;
    isAmbush = 0;
  } else {
    const ambushRng = options.ambushRng || Math.random;
    const wisMod = Math.floor(((character.wisdom || 10) - 10) / 2);
    const perceptionBonus = ((character.class || '').toUpperCase() === 'RANGER') ? wisMod + 3 : wisMod;
    const d20 = Math.floor(ambushRng() * 20) + 1;
    const perceptionRoll = d20 + perceptionBonus;
    const monsterStealth = 10 + ((monster && monster.initiative_bonus) || 0);

    if (perceptionRoll < monsterStealth) {
      isAmbush = 1;
      spottedByHero = 0;
    }
  }

  return { isAmbush, spottedByHero };
}

/**
 * Normalizes a tile's wilderness region name for Hunting Contract matching.
 */
function resolveTileRegionName(tile) {
  if (!tile) return null;
  if (!tile.is_passable || tile.is_safe === 1) return null;
  if (tile.terrain === 'CITY' || tile.terrain === 'BRIDGE' || tile.terrain === 'WATER' || tile.terrain === 'MOUNTAINS') {
    return null;
  }
  const rawName = (tile.name || '').trim();
  if (!rawName) return null;
  if (rawName === 'Heart of the Mirkwood') return 'Mirkwood Forest';
  if (rawName === "Deadman's Mire") return 'Rotting Fen';
  return rawName;
}

/**
 * Checks and rolls for an encounter upon moving onto targetTile
 */
function checkTileEncounter(db, character, targetTile, options = {}) {
  const rng = options.rng || Math.random;

  if (targetTile.is_safe === 1) {
    return null;
  }

  const persistentMonster = db.prepare(`
    SELECT mi.*, m.name, m.symbol, m.color, m.descriptions, m.base_hp, m.initiative_bonus
    FROM monster_instances mi
    JOIN monsters m ON mi.monster_id = m.id
    WHERE mi.tile_id = ? AND mi.status = 'ACTIVE'
  `).get(targetTile.id);

  if (persistentMonster) {
    const { isAmbush, spottedByHero } = resolveDetectionAndAmbush(
      character,
      persistentMonster,
      options,
      { isPersistent: true }
    );
    const insertEncounter = db.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id, monster_instance_id,
        status, current_monster_hp, combat_round, spotted_by_hero, is_ambush, opening_shot_resolved
      ) VALUES (?, ?, ?, ?, 'DISCOVERED', ?, 0, ?, ?, 0)
    `);

    const result = insertEncounter.run(
      character.id,
      targetTile.id,
      persistentMonster.monster_id,
      persistentMonster.id,
      persistentMonster.max_hp,
      spottedByHero,
      isAmbush
    );

    return getEncounterById(db, Number(result.lastInsertRowid), character.class);
  }

  const distance = getDistanceToNearestSafeCity(db, targetTile);
  if (distance <= 0) {
    return null;
  }
  const maxCr = getMaxCrForDistance(distance);

  let activeBountyContract = null;
  const tileRegion = resolveTileRegionName(targetTile);
  if (tileRegion && character && character.id) {
    try {
      activeBountyContract = db.prepare(`
        SELECT hc.*
        FROM hunting_contracts hc
        WHERE hc.character_id = ? AND hc.status = 'ACTIVE' AND hc.region_name = ?
        LIMIT 1
      `).get(character.id, tileRegion);
    } catch {
      activeBountyContract = null;
    }
  }

  const defaultChance = activeBountyContract ? 40 : config.encounterChancePercent;
  const chancePercent = options.forcedChance !== undefined ? options.forcedChance : defaultChance;
  const roll = rng() * 100;
  if (roll >= chancePercent) {
    return null;
  }

  let monster = null;
  let selectedBountyContract = null;

  if (activeBountyContract) {
    const bountyMonster = db.prepare('SELECT * FROM monsters WHERE id = ?').get(activeBountyContract.base_monster_id);
    const heroLevel = Number((character && character.level) || 1);
    const passesLevel1Safety = heroLevel > 1 || (bountyMonster && bountyMonster.solo_level <= 1 && bountyMonster.challenge_rating <= 0.5);
    const passesLevelCap = Boolean(bountyMonster && bountyMonster.solo_level <= heroLevel + 1);

    if (bountyMonster && passesLevel1Safety && passesLevelCap) {
      const bountyRng = options.bountyRng || rng;
      const bountyTargetRoll = bountyRng();
      if (bountyTargetRoll < 0.75) {
        monster = bountyMonster;
        selectedBountyContract = activeBountyContract;
      }
    }
  }

  if (!monster) {
    monster = selectMonsterForTerrainAndHero(db, targetTile.terrain, character.level, { rng, maxCr });
  }
  if (!monster) {
    return null;
  }

  const { isAmbush, spottedByHero } = resolveDetectionAndAmbush(character, monster, options);

  const initialMonsterHp = selectedBountyContract
    ? (selectedBountyContract.boosted_max_hp || monster.base_hp)
    : monster.base_hp;
  const bountyContractId = selectedBountyContract ? selectedBountyContract.id : null;

  const insertEncounter = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, bounty_contract_id, status,
      current_monster_hp, monster_max_hp, combat_round,
      spotted_by_hero, is_ambush, opening_shot_resolved
    ) VALUES (?, ?, ?, ?, 'DISCOVERED', ?, ?, 0, ?, ?, 0)
  `);

  const result = insertEncounter.run(
    character.id,
    targetTile.id,
    monster.id,
    bountyContractId,
    initialMonsterHp,
    initialMonsterHp,
    spottedByHero,
    isAmbush
  );

  return getEncounterById(db, Number(result.lastInsertRowid), character.class);
}

/**
 * Fetch encounter by ID with resolved descriptions and Monster Knowledge metadata
 */
function hasExplicitAmbushOverride(encounter) {
  if (!encounter || !encounter.combat_state_json) return false;
  try {
    const parsed = typeof encounter.combat_state_json === 'string'
      ? JSON.parse(encounter.combat_state_json)
      : encounter.combat_state_json;
    return Boolean(parsed && (parsed.labForcedAmbush === true || parsed.allowLevel1Ambush === true));
  } catch {
    return false;
  }
}

function getEncounterById(db, encounterId, heroClass) {
  let encounter;
  try {
    encounter = db.prepare(`
      SELECT e.*, m.name as base_monster_name, m.symbol as monster_symbol,
             m.color as monster_color, m.solo_level as monster_level,
             m.descriptions as monster_descriptions, m.image_path as monster_image_path,
             m.defeated_image_path as monster_defeated_image_path,
             m.movement_type, m.creature_type, m.creature_subtype, m.monster_family,
             m.challenge_rating, m.treasure_type, m.xp_reward, m.base_hp,
             m.armor_class as monster_ac, m.attack_bonus as monster_ab,
             m.damage_dice as monster_damage_dice, m.initiative_bonus,
             c.level as character_level, c.class as character_class,
             c.intelligence as character_int, c.wisdom as character_wis,
             c.favored_enemy_family as character_fav_family,
             c.favored_enemy_type as character_fav_type,
             c.favored_enemy_subtype as character_fav_sub,
             t.name as tile_name, t.terrain as tile_terrain,
             hc.custom_name as bounty_custom_name,
             hc.title as bounty_title,
             hc.region_name as bounty_region_name,
             hc.boost_type as bounty_boost_type,
             hc.boost_label as bounty_boost_label,
             hc.boosted_max_hp as bounty_boosted_max_hp,
             hc.attack_bonus_mod as bounty_attack_bonus_mod,
             hc.damage_bonus_mod as bounty_damage_bonus_mod,
             hc.reward_gold as bounty_reward_gold,
             hc.status as bounty_status,
             mi.custom_title as instance_custom_title
      FROM encounters e
      JOIN monsters m ON e.monster_id = m.id
      JOIN map_tiles t ON e.tile_id = t.id
      LEFT JOIN characters c ON e.character_id = c.id
      LEFT JOIN hunting_contracts hc ON e.bounty_contract_id = hc.id
      LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
      WHERE e.id = ?
    `).get(encounterId);
  } catch {
    encounter = db.prepare(`
      SELECT e.*, m.name as base_monster_name, m.symbol as monster_symbol,
             m.color as monster_color, m.solo_level as monster_level,
             m.descriptions as monster_descriptions, m.image_path as monster_image_path,
             m.defeated_image_path as monster_defeated_image_path,
             m.movement_type, m.creature_type, m.creature_subtype,
             m.challenge_rating, m.treasure_type, m.xp_reward, m.base_hp,
             m.armor_class as monster_ac, m.attack_bonus as monster_ab,
             m.damage_dice as monster_damage_dice, m.initiative_bonus,
             c.level as character_level, c.class as character_class,
             t.name as tile_name, t.terrain as tile_terrain,
             mi.custom_title as instance_custom_title
      FROM encounters e
      JOIN monsters m ON e.monster_id = m.id
      JOIN map_tiles t ON e.tile_id = t.id
      LEFT JOIN characters c ON e.character_id = c.id
      LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
      WHERE e.id = ?
    `).get(encounterId);
  }

  if (!encounter) return null;

  const monsterFamily = encounter.monster_family || resolveMonsterFamily({
    id: encounter.monster_id,
    name: encounter.base_monster_name,
    creature_type: encounter.creature_type,
    creature_subtype: encounter.creature_subtype
  }, { strict: false });

  const knowledgeRecord = getCharacterMonsterKnowledge(db, encounter.character_id, encounter.monster_id);
  const effectiveClass = heroClass || encounter.character_class || 'FIGHTER';
  const monsterContext = {
    id: encounter.monster_id,
    name: encounter.base_monster_name,
    creature_type: encounter.creature_type,
    creature_subtype: encounter.creature_subtype,
    monster_family: monsterFamily,
    victories: knowledgeRecord.victories
  };

  const resolved = resolveMonsterDescription(
    encounter.monster_descriptions,
    effectiveClass,
    encounter.status,
    monsterContext
  );

  const cleanName = (encounter.base_monster_name || '').replace(/\[.*?\]/g, '').trim();
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const imageFilename = `${slug}.png`;
  const defaultDiskPath = path.join(__dirname, '../../../images/monsters', imageFilename);
  const publicDiskPath = path.join(__dirname, '../../../public/images/monsters', imageFilename);

  let imageUrl = null;
  if (encounter.monster_image_path) {
    const relPath = encounter.monster_image_path.replace(/^\/+/, '');
    const diskPath = path.join(__dirname, '../../../', relPath);
    const pubPath = path.join(__dirname, '../../../public/', relPath);
    if (fs.existsSync(diskPath) || fs.existsSync(pubPath)) {
      imageUrl = '/' + relPath.replace(/\\/g, '/');
    }
  }
  if (!imageUrl && (fs.existsSync(defaultDiskPath) || fs.existsSync(publicDiskPath))) {
    imageUrl = `/images/monsters/${imageFilename}`;
  }

  const defeatedFilename = `${slug}_defeated.png`;
  const defaultDefeatedDiskPath = path.join(__dirname, '../../../images/monsters', defeatedFilename);
  const publicDefeatedDiskPath = path.join(__dirname, '../../../public/images/monsters', defeatedFilename);

  let defeatedImageUrl = null;
  if (encounter.monster_defeated_image_path) {
    const relDefPath = encounter.monster_defeated_image_path.replace(/^\/+/, '');
    const diskDefPath = path.join(__dirname, '../../../', relDefPath);
    const pubDefPath = path.join(__dirname, '../../../public/', relDefPath);
    if (fs.existsSync(diskDefPath) || fs.existsSync(pubDefPath)) {
      defeatedImageUrl = '/' + relDefPath.replace(/\\/g, '/');
    }
  }
  if (!defeatedImageUrl && (fs.existsSync(defaultDefeatedDiskPath) || fs.existsSync(publicDefeatedDiskPath))) {
    defeatedImageUrl = `/images/monsters/${defeatedFilename}`;
  }

  const hasBountyContract = Boolean(encounter.bounty_contract_id && encounter.bounty_custom_name);
  const isRevealed = encounter.status === 'IN_COMBAT';
  const isBountyTarget = hasBountyContract && encounter.status !== 'DISCOVERED';
  const customDisplayName = (isBountyTarget ? encounter.bounty_custom_name : null) || encounter.instance_custom_title || null;
  const monsterDisplayName = customDisplayName || encounter.base_monster_name;

  let finalDescription = resolved.text;
  if (encounter.status === 'DISCOVERED' && hasBountyContract) {
    finalDescription = `${resolved.text} Fresh tracks matching the Watcher's warrant suggest a hunted quarry prowls nearby.`;
  }

  let bountyTraitNotice = null;
  if (isBountyTarget) {
    if (encounter.bounty_boost_type === 'TOUGH') {
      bountyTraitNotice = 'Tough Quarry — Battle-hardened and unusually resilient';
    } else if (encounter.bounty_boost_type === 'AGGRESSIVE') {
      bountyTraitNotice = 'Aggressive Quarry — Strikes with relentless ferocity';
    } else if (encounter.bounty_boost_type === 'BRUTAL') {
      bountyTraitNotice = 'Brutal Quarry — Delivers bone-shattering blows';
    }
  }

  const heroObj = {
    id: encounter.character_id,
    class: effectiveClass,
    level: encounter.character_level || 1,
    intelligence: encounter.character_int || 10,
    wisdom: encounter.character_wis || 10,
    favored_enemy_family: encounter.character_fav_family || null,
    favored_enemy_type: encounter.character_fav_type || null,
    favored_enemy_subtype: encounter.character_fav_sub || null
  };
  const preCombatKnowledge = evaluateHeroMonsterKnowledge(db, heroObj, monsterContext);
  const monsterKnowledge = isRevealed ? preCombatKnowledge : null;

  return {
    ...encounter,
    monster_name: monsterDisplayName,
    base_monster_name: encounter.base_monster_name,
    monster_family: monsterFamily,
    custom_title: encounter.instance_custom_title || null,
    isBountyTarget,
    bountyTraitNotice,
    description: finalDescription,
    resolvedDescription: finalDescription,
    isRangerSpecial: resolved.isRangerSpecial,
    descriptionType: resolved.type,
    imageUrl,
    defeatedImageUrl,
    hasDefeatedImage: Boolean(defeatedImageUrl),
    imageSlug: slug,
    isRevealed,
    isAmbush: Number(encounter.is_ambush || 0) === 1,
    spottedByHero: Number(encounter.spotted_by_hero !== undefined ? encounter.spotted_by_hero : 1) === 1,
    openingShotResolved: Number(encounter.opening_shot_resolved || 0) === 1,
    monsterKnowledge,
    preCombatKnowledge
  };
}

/**
 * Gets the current active encounter for a character (persisting across page reloads)
 */
function getActiveEncounterForCharacter(db, characterId, heroClass) {
  const stmt = db.prepare(`
    SELECT e.id, e.status, e.monster_instance_id, mi.status as instance_status
    FROM encounters e
    LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
    WHERE e.character_id = ? AND e.status IN ('DISCOVERED', 'IN_COMBAT')
    ORDER BY e.id DESC LIMIT 1
  `);
  const row = stmt.get(characterId);
  if (!row) return null;

  if (row.monster_instance_id && row.status === 'DISCOVERED' && row.instance_status && row.instance_status !== 'ACTIVE') {
    db.prepare(`
      UPDATE encounters
      SET status = 'ESCAPED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'DISCOVERED'
    `).run(row.id);
    return null;
  }

  return getEncounterById(db, row.id, heroClass);
}

/**
 * Handle "Ignore" action - dismisses the pre-combat encounter and allows travel
 */
function ignoreEncounter(db, characterId, encounterId) {
  return withTransaction(db, (tx) => {
    const enc = tx.prepare(`
      SELECT e.*, c.level as character_level
      FROM encounters e
      LEFT JOIN characters c ON e.character_id = c.id
      WHERE e.id = ? AND e.character_id = ?
    `).get(encounterId, characterId);

    if (!enc) {
      throw new Error('No active encounter found to ignore.');
    }

    if (enc.status === 'IN_COMBAT') {
      throw new Error('Cannot ignore an encounter during active combat! You must fight or flee.');
    }

    if (enc.status !== 'DISCOVERED') {
      throw new Error(`Encounter cannot be ignored in status: ${enc.status}`);
    }

    const effectiveAmbush = Number(enc.is_ambush || 0);
    if (effectiveAmbush === 1) {
      throw new Error('Ambush! Your path is cut off—you cannot bypass this threat and must face the ambush!');
    }

    tx.prepare(`
      UPDATE encounters
      SET status = 'IGNORED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(encounterId);

    if (enc.monster_instance_id) {
      tx.prepare("UPDATE monster_instances SET current_hp = max_hp WHERE id = ? AND status = 'ACTIVE'").run(enc.monster_instance_id);
    }

    return { success: true };
  });
}

/**
 * Handle "Investigate" action - shifts encounter to IN_COMBAT and initializes combat session
 */
function investigateEncounter(db, characterId, encounterId, heroClass) {
  const { startCombat } = require('../combat/engine');
  return withTransaction(db, (txDb) => {
    const enc = txDb.prepare(`
      SELECT e.*, c.level as character_level
      FROM encounters e
      LEFT JOIN characters c ON e.character_id = c.id
      WHERE e.id = ? AND e.character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
    `).get(encounterId, characterId);

    if (!enc) {
      throw new Error('No active encounter found to investigate.');
    }

    if (enc.monster_instance_id) {
      const inst = txDb.prepare('SELECT status FROM monster_instances WHERE id = ?').get(enc.monster_instance_id);
      if (!inst || inst.status !== 'ACTIVE') {
        txDb.prepare("UPDATE encounters SET status = 'ESCAPED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(encounterId);
        throw new Error('Another champion has already slain this creature.');
      }
    }

    if (enc.status === 'DISCOVERED' && Number(enc.is_ambush || 0) === 0) {
      txDb.prepare('UPDATE encounters SET is_ambush = 0, spotted_by_hero = 1 WHERE id = ?').run(encounterId);
    }

    startCombat(txDb, characterId, encounterId);
    return getEncounterById(txDb, encounterId, heroClass);
  });
}

module.exports = {
  calculateNormalWeight,
  weightedPick,
  selectMonsterForTerrainAndHero,
  resolveMonsterDescription,
  checkTileEncounter,
  getEncounterById,
  getActiveEncounterForCharacter,
  ignoreEncounter,
  investigateEncounter,
  getMaxCrForDistance
};
