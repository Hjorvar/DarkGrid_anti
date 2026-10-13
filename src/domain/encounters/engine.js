const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { withTransaction } = require('../../db/connection');
const { getDistanceToNearestSafeCity } = require('../world/map');

/**
 * Calculates the maximum Challenge Rating (CR) allowed for random encounters
 * based on distance (in grid steps) from the nearest safe city haven.
 * 
 * Rules:
 * - 0 steps (city itself): No random combat (CR = 0)
 * - 1 step: CR <= 1/3 (approx 0.334)
 * - 2 steps: CR <= 1/2 (0.5)
 * - 3 steps: CR <= 1.0
 * - 4+ steps: null (unrestricted Gaussian distribution)
 */
function getMaxCrForDistance(distance) {
  if (distance === null || distance === undefined || !isFinite(distance)) {
    return null;
  }
  if (distance <= 0) return 0;
  if (distance === 1) return (1 / 3) + 0.001; // ~0.334 to safely include 0.33
  if (distance === 2) return 0.5;
  if (distance === 3) return 1.0;
  return null; // 4+ steps: normal Gaussian
}

/**
 * Calculates Gaussian weight for an available monster level L relative to hero level H.
 * weight(L) = exp(-((L - H)^2) / (2 * sigma^2))
 */
function calculateNormalWeight(monsterLevel, heroLevel, sigma = config.encounterSigma) {
  const diff = monsterLevel - heroLevel;
  return Math.exp(-Math.pow(diff, 2) / (2 * Math.pow(sigma, 2)));
}

/**
 * Weighted random picker
 * @param {Array<{ item: any, weight: number }>} itemsWithWeights
 * @param {() => number} rng Optional RNG function (0 to 1), defaults to Math.random
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
 * 1. Filter candidates by terrain habitat and optional maxCr safety cap
 * 2. Group by solo_level and choose level using Gaussian normal weights
 * 3. Choose candidate within selected level by spawn_weight
 */
function selectMonsterForTerrainAndHero(db, terrainName, heroLevel, options = {}) {
  const rng = options.rng || Math.random;
  const sigma = options.sigma || config.encounterSigma;
  const maxCr = options.maxCr !== undefined ? options.maxCr : null;
  const normalizedTerrain = (terrainName || '').toUpperCase();

  let matchingMonsters = [];

  // 1. Primary lookup: query monster_terrains join table
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

  // 2. Fallback to legacy JSON habitat array if monster_terrains table is absent or empty
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

  // Apply City Safety CR filter if present
  if (maxCr !== null && maxCr !== undefined) {
    matchingMonsters = matchingMonsters.filter(m => m.challenge_rating <= maxCr);
  }

  if (matchingMonsters.length === 0) {
    return null;
  }

  // Group candidate monsters by solo_level
  const byLevel = new Map();
  for (const m of matchingMonsters) {
    if (!byLevel.has(m.solo_level)) {
      byLevel.set(m.solo_level, []);
    }
    byLevel.get(m.solo_level).push(m);
  }

  // Calculate normal weights for each available level
  const levelWeightEntries = [];
  for (const level of byLevel.keys()) {
    const weight = calculateNormalWeight(level, heroLevel, sigma);
    levelWeightEntries.push({ item: level, weight });
  }

  // Pick level using normal distribution
  const chosenLevel = weightedPick(levelWeightEntries, rng);
  const candidatesAtLevel = byLevel.get(chosenLevel);

  // Pick specific monster at that level using spawn_weight
  const monsterWeightEntries = candidatesAtLevel.map(m => ({
    item: m,
    weight: Math.max(1, m.spawn_weight || 10)
  }));

  return weightedPick(monsterWeightEntries, rng);
}

/**
 * Resolves the appropriate description text based on hero class and encounter state
 */
function resolveMonsterDescription(descriptionsJson, heroClass, state = 'DISCOVERED') {
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

  const isRanger = (heroClass || '').toUpperCase() === 'RANGER';

  if (state === 'DISCOVERED') {
    if (isRanger && descriptions['2_ranger_distant']) {
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
    if (isRanger && descriptions['4_ranger_close']) {
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
 * Checks and rolls for an encounter upon moving onto targetTile
 * Strictly called ONLY during valid move step, not on page refresh
 */
function checkTileEncounter(db, character, targetTile, options = {}) {
  const rng = options.rng || Math.random;

  // 1. Safe tiles (cities, etc.) never trigger random encounters
  if (targetTile.is_safe === 1) {
    return null;
  }

  // 2. Check for active persistent monster on tile (NOT subject to CR restriction!)
  const persistentMonster = db.prepare(`
    SELECT mi.*, m.name, m.symbol, m.color, m.descriptions, m.base_hp
    FROM monster_instances mi
    JOIN monsters m ON mi.monster_id = m.id
    WHERE mi.tile_id = ? AND mi.status = 'ACTIVE'
  `).get(targetTile.id);

  if (persistentMonster) {
    // Persistent monster discovered
    const insertEncounter = db.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id, monster_instance_id,
        status, current_monster_hp, combat_round, spotted_by_hero, is_ambush, opening_shot_resolved
      ) VALUES (?, ?, ?, ?, 'DISCOVERED', ?, 0, 1, 0, 0)
    `);

    const result = insertEncounter.run(
      character.id,
      targetTile.id,
      persistentMonster.monster_id,
      persistentMonster.id,
      persistentMonster.max_hp
    );

    return getEncounterById(db, Number(result.lastInsertRowid), character.class);
  }

  // 3. City Safety: Calculate distance to nearest safe city
  const distance = getDistanceToNearestSafeCity(db, targetTile);
  if (distance <= 0) {
    return null; // The city itself: no random combat
  }
  const maxCr = getMaxCrForDistance(distance);

  // 4. Roll encounter chance (configurable 25%)
  const chancePercent = options.forcedChance !== undefined ? options.forcedChance : config.encounterChancePercent;
  const roll = rng() * 100;
  if (roll >= chancePercent) {
    return null; // No encounter
  }

  // 5. Select appropriate monster via terrain, level normal distribution, and City Safety CR cap
  const monster = selectMonsterForTerrainAndHero(db, targetTile.terrain, character.level, { rng, maxCr });
  if (!monster) {
    return null;
  }

  // 6. Ambush vs Hero Detection Check
  let isAmbush = 0;
  let spottedByHero = 1;
  if (options.isAmbush !== undefined) {
    isAmbush = options.isAmbush ? 1 : 0;
    spottedByHero = isAmbush ? 0 : 1;
  } else if (options.spottedByHero !== undefined) {
    spottedByHero = options.spottedByHero ? 1 : 0;
    isAmbush = spottedByHero ? 0 : 1;
  } else {
    // Standard perception check: Hero Perception (1d20 + WIS mod + 3 if Ranger) vs Monster Stealth (10 + init bonus)
    const ambushRng = options.ambushRng || Math.random;
    const wisMod = Math.floor(((character.wisdom || 10) - 10) / 2);
    const perceptionBonus = ((character.class || '').toUpperCase() === 'RANGER') ? wisMod + 3 : wisMod;
    const d20 = Math.floor(ambushRng() * 20) + 1;
    const perceptionRoll = d20 + perceptionBonus;
    const monsterStealth = 10 + (monster.initiative_bonus || 0);

    if (perceptionRoll < monsterStealth) {
      isAmbush = 1;
      spottedByHero = 0;
    }
  }

  // 7. Create pending encounter record
  const insertEncounter = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status, current_monster_hp, combat_round,
      spotted_by_hero, is_ambush, opening_shot_resolved
    ) VALUES (?, ?, ?, 'DISCOVERED', ?, 0, ?, ?, 0)
  `);

  const result = insertEncounter.run(
    character.id,
    targetTile.id,
    monster.id,
    monster.base_hp,
    spottedByHero,
    isAmbush
  );

  return getEncounterById(db, Number(result.lastInsertRowid), character.class);
}

/**
 * Fetch encounter by ID with resolved descriptions
 */
function getEncounterById(db, encounterId, heroClass) {
  const stmt = db.prepare(`
    SELECT e.*, m.name as monster_name, m.symbol as monster_symbol,
           m.color as monster_color, m.solo_level as monster_level,
           m.descriptions as monster_descriptions, m.image_path as monster_image_path,
           m.defeated_image_path as monster_defeated_image_path,
           m.movement_type, m.creature_type, m.creature_subtype,
           t.name as tile_name, t.terrain as tile_terrain
    FROM encounters e
    JOIN monsters m ON e.monster_id = m.id
    JOIN map_tiles t ON e.tile_id = t.id
    WHERE e.id = ?
  `);

  const encounter = stmt.get(encounterId);
  if (!encounter) return null;

  const resolved = resolveMonsterDescription(
    encounter.monster_descriptions,
    heroClass,
    encounter.status
  );

  const cleanName = (encounter.monster_name || '').replace(/\[.*?\]/g, '').trim();
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

  // Defeated artwork resolution
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

  return {
    ...encounter,
    resolvedDescription: resolved.text,
    isRangerSpecial: resolved.isRangerSpecial,
    descriptionType: resolved.type,
    imageUrl,
    defeatedImageUrl,
    hasDefeatedImage: Boolean(defeatedImageUrl),
    imageSlug: slug,
    isRevealed: encounter.status === 'IN_COMBAT',
    isAmbush: Number(encounter.is_ambush || 0) === 1,
    spottedByHero: Number(encounter.spotted_by_hero !== undefined ? encounter.spotted_by_hero : 1) === 1,
    openingShotResolved: Number(encounter.opening_shot_resolved || 0) === 1
  };
}

/**
 * Gets the current active encounter for a character (persisting across page reloads)
 */
function getActiveEncounterForCharacter(db, characterId, heroClass) {
  const stmt = db.prepare(`
    SELECT id FROM encounters
    WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
    ORDER BY id DESC LIMIT 1
  `);
  const row = stmt.get(characterId);
  if (!row) return null;
  return getEncounterById(db, row.id, heroClass);
}

/**
 * Handle "Ignore" action - dismisses the pre-combat encounter and allows travel
 */
function ignoreEncounter(db, characterId, encounterId) {
  return withTransaction(db, (tx) => {
    const enc = tx.prepare(`
      SELECT * FROM encounters
      WHERE id = ? AND character_id = ?
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

    tx.prepare(`
      UPDATE encounters
      SET status = 'IGNORED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(encounterId);

    if (enc.monster_instance_id) {
      tx.prepare('UPDATE monster_instances SET current_hp = max_hp WHERE id = ?').run(enc.monster_instance_id);
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
      SELECT * FROM encounters
      WHERE id = ? AND character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')
    `).get(encounterId, characterId);

    if (!enc) {
      throw new Error('No active encounter found to investigate.');
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
