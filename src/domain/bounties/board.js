const config = require('../../config');
const { withTransaction } = require('../../db/connection');
const { getMaxCrForDistance } = require('../encounters/engine');

const MAX_BOARD_CONTRACTS = 3;

/**
 * Boost definitions for Named Bounty targets.
 * Exactly one boost is chosen when a contract is generated.
 */
const BOUNTY_BOOSTS = [
  {
    type: 'TOUGH',
    label: 'Tough (+15% Max HP)',
    shortLabel: 'Tough',
    apply(baseMonster) {
      const boostedMaxHp = Math.max(baseMonster.base_hp + 1, Math.ceil(baseMonster.base_hp * 1.15));
      return {
        boostType: 'TOUGH',
        boostLabel: 'Tough (+15% Max HP)',
        boostedMaxHp,
        attackBonusMod: 0,
        damageBonusMod: 0
      };
    }
  },
  {
    type: 'AGGRESSIVE',
    label: 'Aggressive (+1 Attack Bonus)',
    shortLabel: 'Aggressive',
    apply(baseMonster) {
      return {
        boostType: 'AGGRESSIVE',
        boostLabel: 'Aggressive (+1 Attack Bonus)',
        boostedMaxHp: baseMonster.base_hp,
        attackBonusMod: 1,
        damageBonusMod: 0
      };
    }
  },
  {
    type: 'BRUTAL',
    label: 'Brutal (+1 Damage)',
    shortLabel: 'Brutal',
    apply(baseMonster) {
      return {
        boostType: 'BRUTAL',
        boostLabel: 'Brutal (+1 Damage)',
        boostedMaxHp: baseMonster.base_hp,
        attackBonusMod: 0,
        damageBonusMod: 1
      };
    }
  }
];

/**
 * Curated dark-fantasy name prefixes and epithets for Named Bounty targets.
 */
const NAME_PREFIXES_BY_CATEGORY = {
  goblinoid: ['Gorgan', 'Skarr', 'Grimgut', 'Snagtooth', 'Vrak', 'Krag', 'Zulgar', 'Morguk', 'Razzik', 'Gnarl'],
  undead: ['Morgrath', 'Vaelor', 'Dreadbone', 'Malakor', 'rotted Thane', 'Ashwraith', 'Grimhollow', 'Sorrowbone', 'Kaelen', 'Vorgath'],
  beast: ['Bloodfang', 'Blackclaw', 'Goremaw', 'Shadowpelt', 'Razorback', 'bristlefang', 'Nightstalker', 'Ironjaw', 'Grimtalon', 'uskrend'],
  vermin: ['Skittermaw', 'Venomcarapace', 'Chitinrend', 'Blightsting', 'Rotmandible', 'Dreadweaver', 'Vilecrawler', 'ichorback'],
  plant: ['Rotvine', 'Corpsebloom', 'Stranglethorn', 'Blightroot', 'Gallowmoss', 'Bloodbriar', 'Mirecreep', 'Witherbough'],
  default: ['Morgrath', 'Gorgan', 'Bloodfang', 'Grimgut', 'Blackclaw', 'Skarr', 'Vorgath', 'Dreadmaw', 'Malakor', 'Grimscar']
};

const DARK_EPITHETS = [
  'the One-Eyed',
  'the Cruel',
  'the Scarred',
  'the Vicious',
  'the Hunter',
  'the Merciless',
  'the Hollow',
  'the Bloodied',
  'the Relentless',
  'the Widowmaker',
  'the Rot-Touched',
  'the Gravesworn',
  'the Ash-Born',
  'the Iron-Jaw',
  'the Night-Stalker',
  'the Flesh-Render'
];

/**
 * Normalizes a map tile's region name.
 * Sub-landmarks inside a larger wilderness region map to their parent region
 * so that hunting contracts apply across the entire region rather than a single coordinate.
 *
 * @param {object} tile - Row from map_tiles
 * @returns {string|null} Canonical wilderness region name, or null if not a valid hunting region
 */
function resolveTileRegionName(tile) {
  if (!tile) return null;
  if (!tile.is_passable || tile.is_safe === 1) return null;
  if (tile.terrain === 'CITY' || tile.terrain === 'BRIDGE' || tile.terrain === 'WATER' || tile.terrain === 'MOUNTAINS') {
    return null;
  }

  const rawName = (tile.name || '').trim();
  if (!rawName) return null;

  if (rawName === 'Heart of the Mirkwood') {
    return 'Mirkwood Forest';
  }
  if (rawName === "Deadman's Mire") {
    return 'Rotting Fen';
  }

  return rawName;
}

/**
 * Computes the 8-wind compass direction from a reference point (Oakhaven) to (x, y).
 * Map coordinate system: y=0 is North, y=max is South, x=0 is West, x=max is East.
 *
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @returns {string} Compass direction in English
 */
function getCompassDirection(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;

  if (dx === 0 && dy === 0) return 'Nearby';

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 to 180, where 0 is East, -90 is North, 90 is South
  const normalized = (angleDeg + 360) % 360;

  if (normalized >= 337.5 || normalized < 22.5) return 'East';
  if (normalized >= 22.5 && normalized < 67.5) return 'Southeast';
  if (normalized >= 67.5 && normalized < 112.5) return 'South';
  if (normalized >= 112.5 && normalized < 157.5) return 'Southwest';
  if (normalized >= 157.5 && normalized < 202.5) return 'West';
  if (normalized >= 202.5 && normalized < 247.5) return 'Northwest';
  if (normalized >= 247.5 && normalized < 292.5) return 'North';
  return 'Northeast';
}

/**
 * Discovers all passable wilderness regions reachable from Oakhaven via BFS.
 * Ensures contracts are never generated in impassable or isolated regions.
 *
 * @param {object} db - SQLite database connection
 * @returns {Array<object>} List of reachable region metadata objects
 */
function getReachableWildernessRegions(db) {
  const allTiles = db.prepare('SELECT id, x, y, terrain, name, is_passable, is_safe FROM map_tiles').all();
  if (!allTiles || allTiles.length === 0) return [];

  const tileByCoord = new Map();
  const safeCities = [];

  for (const tile of allTiles) {
    tileByCoord.set(`${tile.x},${tile.y}`, tile);
    if (tile.terrain === 'CITY' && tile.is_safe === 1) {
      safeCities.push(tile);
    }
  }

  // Fallback if no safe city exists in a custom test map
  const origins = safeCities.length > 0
    ? safeCities
    : allTiles.filter(t => t.is_safe === 1 && t.is_passable === 1);

  const visited = new Set();
  const queue = [];

  for (const origin of origins) {
    const key = `${origin.x},${origin.y}`;
    visited.add(key);
    queue.push(origin);
  }

  const reachableTiles = [];

  while (queue.length > 0) {
    const current = queue.shift();
    reachableTiles.push(current);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;

        const neighbor = tileByCoord.get(key);
        if (neighbor && neighbor.is_passable === 1) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }
  }

  const primaryCity = origins[0] || { x: 7, y: 7 };
  const regionsMap = new Map();

  for (const tile of reachableTiles) {
    const regionName = resolveTileRegionName(tile);
    if (!regionName) continue;

    let minDistToCity = Infinity;
    for (const city of origins) {
      const dist = Math.max(Math.abs(tile.x - city.x), Math.abs(tile.y - city.y));
      if (dist < minDistToCity) minDistToCity = dist;
    }
    if (!Number.isFinite(minDistToCity)) minDistToCity = 4;

    if (!regionsMap.has(regionName)) {
      regionsMap.set(regionName, {
        regionName,
        terrainCounts: {},
        minDist: minDistToCity,
        maxDist: minDistToCity,
        tileCount: 0,
        sumX: 0,
        sumY: 0
      });
    }

    const entry = regionsMap.get(regionName);
    entry.terrainCounts[tile.terrain] = (entry.terrainCounts[tile.terrain] || 0) + 1;
    entry.minDist = Math.min(entry.minDist, minDistToCity);
    entry.maxDist = Math.max(entry.maxDist, minDistToCity);
    entry.tileCount += 1;
    entry.sumX += tile.x;
    entry.sumY += tile.y;
  }

  const regions = [];
  for (const entry of regionsMap.values()) {
    const sortedTerrains = Object.entries(entry.terrainCounts).sort((a, b) => b[1] - a[1]);
    const primaryTerrain = sortedTerrains[0][0];
    const avgX = entry.sumX / entry.tileCount;
    const avgY = entry.sumY / entry.tileCount;
    const direction = getCompassDirection(primaryCity.x, primaryCity.y, avgX, avgY);

    regions.push({
      regionName: entry.regionName,
      primaryTerrain,
      terrains: Object.keys(entry.terrainCounts),
      minDist: entry.minDist,
      maxDist: entry.maxDist,
      tileCount: entry.tileCount,
      direction
    });
  }

  // Sort closer regions first for deterministic ordering
  regions.sort((a, b) => a.minDist - b.minDist || a.regionName.localeCompare(b.regionName));
  return regions;
}

/**
 * Simple deterministic hash from string/numbers into an unsigned 32-bit integer.
 */
function hashSeed(input) {
  const str = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Categorizes a monster name for flavor name generation.
 */
function inferMonsterCategory(monsterName) {
  const lower = (monsterName || '').toLowerCase();
  if (/goblin|hobgoblin|orc|kobold|bugbear|gnoll|ogre|troll|bandit|cultist/.test(lower)) {
    return 'goblinoid';
  }
  if (/skeleton|zombie|ghoul|ghast|wight|wraith|spectre|shadow|mummy|vampire|ghost/.test(lower)) {
    return 'undead';
  }
  if (/spider|centipede|scorpion|beetle|stirge|mantis|wasp|swarm|ant/.test(lower)) {
    return 'vermin';
  }
  if (/vine|fungus|violet|shrieker|vegepygmy|treant|shambling|plant/.test(lower)) {
    return 'plant';
  }
  if (/wolf|rat|bear|boar|lion|tiger|leopard|hyena|hound|bat|viper|snake|constrictor|crocodile|worg|eagle|hawk|owlbear/.test(lower)) {
    return 'beast';
  }
  return 'default';
}

/**
 * Generates a deterministic dark-fantasy custom name for a Named Bounty monster.
 *
 * @param {object} baseMonster - Monster row from DB
 * @param {number} seed - Deterministic integer seed
 * @param {Set<string>} usedNames - Already used names to avoid duplicates
 * @returns {string} e.g. "Gorgan the One-Eyed"
 */
function generateBountyMonsterName(baseMonster, seed, usedNames = new Set()) {
  const category = inferMonsterCategory(baseMonster.name);
  const prefixes = NAME_PREFIXES_BY_CATEGORY[category] || NAME_PREFIXES_BY_CATEGORY.default;

  for (let attempt = 0; attempt < 32; attempt++) {
    const h1 = hashSeed(`${seed}:prefix:${attempt}:${baseMonster.id}`);
    const h2 = hashSeed(`${seed}:epithet:${attempt}:${baseMonster.name}`);
    const rawPrefix = prefixes[h1 % prefixes.length];
    const prefix = rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1);
    const epithet = DARK_EPITHETS[h2 % DARK_EPITHETS.length];
    const candidate = `${prefix} ${epithet}`;
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }

  return `Morgrath the Vicious`;
}

/**
 * Determines threat label based on monster solo_level relative to character level and CR.
 */
function getThreatLabel(monster, characterLevel) {
  const diff = (monster.solo_level || 1) - characterLevel;
  if (diff >= 1 || (monster.challenge_rating || 0) >= characterLevel + 0.5) {
    return 'Deadly';
  }
  if (diff === 0 && (monster.challenge_rating || 0) >= 0.5) {
    return 'Dangerous';
  }
  return 'Dangerous';
}

/**
 * Calculates fair gold reward for a Hunting Contract.
 * Rewards gold only (never XP) to give players a reliable way to save for potions and gear.
 */
function calculateBountyRewardGold(monster, region, characterLevel, seed) {
  const cr = Number(monster.challenge_rating) || 0.33;
  const soloLevel = Number(monster.solo_level) || 1;
  const baseByLevel = 28 + soloLevel * 12;
  const crBonus = Math.round(cr * 18);
  const distBonus = Math.min(15, Math.max(0, (region.minDist - 2) * 4));
  const variance = (hashSeed(`${seed}:gold`) % 7) - 3; // -3 to +3 gold flavor variance

  const raw = baseByLevel + crBonus + distBonus + variance;
  return Math.max(30, raw);
}

/**
 * Builds English contract title and description for The Watcher's Board.
 */
function buildContractNarrative(monster, region, threatLabel, rewardGold, seed) {
  const dirLower = (region.direction || 'nearby').toLowerCase();
  const monsterLower = (monster.name || 'creature').toLowerCase();
  const article = /^[aeiou]/i.test(monsterLower) ? 'an' : 'a';

  const titles = [
    `Trouble in ${region.regionName}`,
    `Shadow Over ${region.regionName}`,
    `The Beast of ${region.regionName}`,
    `Blood on the ${region.regionName} Trail`,
    `A Warrant for ${region.regionName}`
  ];
  const title = titles[hashSeed(`${seed}:title:${region.regionName}`) % titles.length];

  const templates = [
    `Travelers report ${article} vicious ${monsterLower} terrorizing ${region.regionName} to the ${dirLower} of Oakhaven. Several caravans have gone missing. The Watchers offer ${rewardGold} gold to anyone who ends this threat.`,
    `Outriders returning from ${region.regionName} speak of ${article} cunning ${monsterLower} stalking the wilds ${dirLower} of the city gates. The Watcher's Board has posted ${rewardGold} gold for proof of its demise.`,
    `A unusually aggressive ${monsterLower} has claimed hunting grounds within ${region.regionName}. Wayfarers dare not cross the ${dirLower} approaches alone. Slay the creature and return to Oakhaven for ${rewardGold} gold.`
  ];
  const description = templates[hashSeed(`${seed}:desc:${monster.id}`) % templates.length];

  return { title, description };
}

/**
 * Selects eligible monsters for a character and region, strictly enforcing level and City Safety CR caps.
 */
function getEligibleMonstersForRegion(db, characterLevel, region) {
  let regionMonsters = [];
  const placeholders = region.terrains.map(() => '?').join(', ');

  try {
    regionMonsters = db.prepare(`
      SELECT DISTINCT m.* FROM monsters m
      JOIN monster_terrains mt ON m.id = mt.monster_id
      WHERE mt.terrain IN (${placeholders})
        AND m.solo_level IS NOT NULL AND m.solo_level >= 1
      ORDER BY m.id ASC
    `).all(...region.terrains);
  } catch {
    regionMonsters = [];
  }

  if (regionMonsters.length === 0) {
    const allMonsters = db.prepare('SELECT * FROM monsters WHERE solo_level IS NOT NULL AND solo_level >= 1 ORDER BY id ASC').all();
    const habitatCodes = new Set(
      region.terrains.map(t => config.terrainHabitatMap[t]).filter(Boolean)
    );
    regionMonsters = allMonsters.filter(m => {
      try {
        const habitats = JSON.parse(m.habitat || '[]');
        return Array.isArray(habitats) && habitats.some(h => habitatCodes.has(h));
      } catch {
        return false;
      }
    });
  }

  // For Level 1, enforce solo_level = 1 and CR <= 0.5 so that even at distance 2 tiles (maxCr = 0.5)
  // the bounty target is always legal and fair.
  const minTileCrCap = getMaxCrForDistance(region.minDist);
  const maxSafeCr = characterLevel <= 1
    ? Math.min(0.5, minTileCrCap !== null ? minTileCrCap : 0.5)
    : (getMaxCrForDistance(region.maxDist) ?? 99);

  const maxSoloLevel = characterLevel <= 1 ? 1 : characterLevel + 1;
  const minSoloLevel = Math.max(1, characterLevel - 1);

  let eligible = regionMonsters.filter(m =>
    m.solo_level >= minSoloLevel &&
    m.solo_level <= maxSoloLevel &&
    m.challenge_rating <= maxSafeCr
  );

  // Fallback if character is high level and region only has lower-level monsters
  if (eligible.length === 0) {
    eligible = regionMonsters.filter(m =>
      m.solo_level <= maxSoloLevel &&
      m.challenge_rating <= maxSafeCr
    );
  }

  return eligible;
}

/**
 * Ensures the character has up to 3 Hunting Contracts on The Watcher's Board.
 * Does NOT reroll contracts on page refresh.
 * Uses a deterministic progression seed tied to completed bounties, combat encounters, and hero level
 * so that accepting and immediately abandoning a contract in Oakhaven cannot be abused to reroll contracts for free.
 *
 * @param {object} db - SQLite connection
 * @param {object} character - Character row
 * @returns {Array<object>} Current board contracts (ACTIVE, READY_TO_CLAIM, AVAILABLE)
 */
function getOrGenerateContracts(db, character) {
  if (!character || !character.id) return [];

  const currentContracts = db.prepare(`
    SELECT hc.*, m.name AS base_monster_name, m.image_path AS monster_image_path, m.challenge_rating
    FROM hunting_contracts hc
    JOIN monsters m ON hc.base_monster_id = m.id
    WHERE hc.character_id = ?
      AND hc.status IN ('ACTIVE', 'READY_TO_CLAIM', 'AVAILABLE')
    ORDER BY
      CASE hc.status
        WHEN 'READY_TO_CLAIM' THEN 1
        WHEN 'ACTIVE' THEN 2
        WHEN 'AVAILABLE' THEN 3
      END,
      hc.id ASC
  `).all(character.id);

  if (currentContracts.length >= MAX_BOARD_CONTRACTS) {
    return currentContracts;
  }

  const regions = getReachableWildernessRegions(db);
  if (regions.length === 0) {
    return currentContracts;
  }

  // Filter regions suitable for the hero's level
  const charLevel = Number(character.level) || 1;
  const suitableRegions = charLevel <= 1
    ? regions.filter(r => r.minDist <= 3)
    : regions;
  const regionPool = suitableRegions.length > 0 ? suitableRegions : regions;

  // Progression seed changes ONLY when the hero completes a bounty, fights a wilderness combat, or levels up.
  const completedCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM hunting_contracts
    WHERE character_id = ? AND status = 'COMPLETED'
  `).get(character.id)?.cnt || 0;

  const combatCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM encounters
    WHERE character_id = ? AND status IN ('VICTORY', 'DEFEAT', 'ESCAPED')
  `).get(character.id)?.cnt || 0;

  // Count contracts already abandoned during this exact progression state (same level and combat count)
  // so players cannot spam Accept -> Abandon in Oakhaven for infinite free contract rerolls.
  const abandonedInCurrentStep = db.prepare(`
    SELECT custom_name, region_name, base_monster_id
    FROM hunting_contracts
    WHERE character_id = ?
      AND status = 'ABANDONED'
      AND created_at_level = ?
      AND created_at_encounters = ?
  `).all(character.id, charLevel, combatCount);

  if (currentContracts.length + abandonedInCurrentStep.length >= MAX_BOARD_CONTRACTS) {
    return currentContracts;
  }

  const progressionSeed = `${character.id}:L${charLevel}:C${completedCount}:E${combatCount}`;

  // Build candidate pool of (region, monster) pairs
  const candidates = [];
  for (const region of regionPool) {
    const monsters = getEligibleMonstersForRegion(db, charLevel, region);
    for (const monster of monsters) {
      candidates.push({ region, monster });
    }
  }

  if (candidates.length === 0) {
    return currentContracts;
  }

  const allStepContracts = [...currentContracts, ...abandonedInCurrentStep];
  const usedNames = new Set(allStepContracts.map(c => c.custom_name));
  const usedPairs = new Set(allStepContracts.map(c => `${c.region_name}:${c.base_monster_id}`));
  const usedRegions = new Set(allStepContracts.map(c => c.region_name));

  const needed = MAX_BOARD_CONTRACTS - (currentContracts.length + abandonedInCurrentStep.length);

  const insertStmt = db.prepare(`
    INSERT INTO hunting_contracts (
      character_id, base_monster_id, custom_name, title, description,
      region_name, target_terrain, threat_label, boost_type, boost_label,
      boosted_max_hp, attack_bonus_mod, damage_bonus_mod, reward_gold,
      status, created_at_level, created_at_encounters
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)
  `);

  withTransaction(db, () => {
    for (let slot = 0; slot < needed; slot++) {
      const slotSeed = hashSeed(`${progressionSeed}:slot:${slot}`);

      // Prefer distinct regions first so the 3 contracts point to varied destinations
      let pool = candidates.filter(
        c => !usedPairs.has(`${c.region.regionName}:${c.monster.id}`) && !usedRegions.has(c.region.regionName)
      );
      if (pool.length === 0) {
        pool = candidates.filter(c => !usedPairs.has(`${c.region.regionName}:${c.monster.id}`));
      }
      if (pool.length === 0) {
        pool = candidates;
      }

      const chosen = pool[slotSeed % pool.length];
      const { region, monster } = chosen;

      usedPairs.add(`${region.regionName}:${monster.id}`);
      usedRegions.add(region.regionName);

      const customName = generateBountyMonsterName(monster, slotSeed, usedNames);
      usedNames.add(customName);

      const boostDef = BOUNTY_BOOSTS[hashSeed(`${slotSeed}:boost`) % BOUNTY_BOOSTS.length];
      const boostStats = boostDef.apply(monster);

      const threatLabel = getThreatLabel(monster, charLevel);
      const rewardGold = calculateBountyRewardGold(monster, region, charLevel, slotSeed);
      const { title, description } = buildContractNarrative(monster, region, threatLabel, rewardGold, slotSeed);

      insertStmt.run(
        character.id,
        monster.id,
        customName,
        title,
        description,
        region.regionName,
        region.primaryTerrain,
        threatLabel,
        boostStats.boostType,
        boostStats.boostLabel,
        boostStats.boostedMaxHp,
        boostStats.attackBonusMod,
        boostStats.damageBonusMod,
        rewardGold,
        charLevel,
        combatCount
      );
    }
  });

  return db.prepare(`
    SELECT hc.*,
           hc.title AS contract_title,
           hc.description AS contract_description,
           hc.region_name AS target_region,
           m.name AS base_monster_name,
           m.base_hp AS base_monster_hp,
           m.challenge_rating AS monster_cr,
           m.image_path AS monster_image_path,
           m.challenge_rating
    FROM hunting_contracts hc
    JOIN monsters m ON hc.base_monster_id = m.id
    WHERE hc.character_id = ?
      AND hc.status IN ('ACTIVE', 'READY_TO_CLAIM', 'AVAILABLE')
    ORDER BY
      CASE hc.status
        WHEN 'READY_TO_CLAIM' THEN 1
        WHEN 'ACTIVE' THEN 2
        WHEN 'AVAILABLE' THEN 3
      END,
      hc.id ASC
  `).all(character.id);
}

/**
 * Returns the character's currently active or ready-to-claim contract, if any.
 */
function getActiveContractForCharacter(db, characterOrId) {
  const characterId = typeof characterOrId === 'object' && characterOrId !== null ? characterOrId.id : characterOrId;
  if (!characterId) return null;
  return db.prepare(`
    SELECT hc.*,
           hc.title AS contract_title,
           hc.description AS contract_description,
           hc.region_name AS target_region,
           m.name AS base_monster_name,
           m.base_hp AS base_monster_hp,
           m.challenge_rating AS monster_cr,
           m.image_path AS monster_image_path,
           m.challenge_rating
    FROM hunting_contracts hc
    JOIN monsters m ON hc.base_monster_id = m.id
    WHERE hc.character_id = ?
      AND hc.status IN ('ACTIVE', 'READY_TO_CLAIM')
    LIMIT 1
  `).get(characterId) || null;
}

/**
 * Accepts an AVAILABLE hunting contract in Oakhaven.
 * Enforces that the player has no other ACTIVE or READY_TO_CLAIM contract.
 */
function acceptContract(db, characterOrId, contractId) {
  const characterId = typeof characterOrId === 'object' && characterOrId !== null ? characterOrId.id : characterOrId;
  return withTransaction(db, (txDb) => {
    const existingActive = txDb.prepare(`
      SELECT id, title, status FROM hunting_contracts
      WHERE character_id = ? AND status IN ('ACTIVE', 'READY_TO_CLAIM')
    `).get(characterId);

    if (existingActive) {
      return {
        ok: false,
        success: false,
        error: 'You already have an active hunting contract. Complete or abandon it before accepting another.'
      };
    }

    const contract = txDb.prepare(`
      SELECT hc.*,
             hc.title AS contract_title,
             hc.description AS contract_description,
             hc.region_name AS target_region,
             m.name AS base_monster_name
      FROM hunting_contracts hc
      JOIN monsters m ON hc.base_monster_id = m.id
      WHERE hc.id = ? AND hc.character_id = ?
    `).get(contractId, characterId);

    if (!contract) {
      return { ok: false, success: false, error: 'Hunting contract not found.' };
    }

    if (contract.status !== 'AVAILABLE') {
      return { ok: false, success: false, error: 'This hunting contract is no longer available.' };
    }

    txDb.prepare(`
      UPDATE hunting_contracts
      SET status = 'ACTIVE'
      WHERE id = ? AND character_id = ? AND status = 'AVAILABLE'
    `).run(contractId, characterId);

    const updated = txDb.prepare(`
      SELECT hc.*,
             hc.title AS contract_title,
             hc.description AS contract_description,
             hc.region_name AS target_region,
             m.name AS base_monster_name
      FROM hunting_contracts hc
      JOIN monsters m ON hc.base_monster_id = m.id
      WHERE hc.id = ?
    `).get(contractId);

    return {
      ok: true,
      success: true,
      contract: updated,
      message: `Contract accepted: ${updated.title}. Hunt the ${updated.base_monster_name} in ${updated.region_name}.`
    };
  });
}

/**
 * Abandons the character's currently ACTIVE hunting contract.
 * Cannot abandon while actively in combat with the target.
 */
function abandonContract(db, characterOrId, contractId = null) {
  const characterId = typeof characterOrId === 'object' && characterOrId !== null ? characterOrId.id : characterOrId;
  return withTransaction(db, (txDb) => {
    const active = contractId
      ? txDb.prepare(`SELECT * FROM hunting_contracts WHERE id = ? AND character_id = ? AND status = 'ACTIVE'`).get(contractId, characterId)
      : txDb.prepare(`SELECT * FROM hunting_contracts WHERE character_id = ? AND status = 'ACTIVE'`).get(characterId);

    if (!active) {
      return { ok: false, success: false, error: 'No active hunting contract to abandon.' };
    }

    const activeCombat = txDb.prepare(`
      SELECT e.id, e.status, e.is_ambush, c.level as character_level
      FROM encounters e
      LEFT JOIN characters c ON e.character_id = c.id
      WHERE e.character_id = ? AND e.bounty_contract_id = ? AND e.status IN ('IN_COMBAT', 'DISCOVERED')
    `).get(characterId, active.id);

    if (activeCombat && activeCombat.status === 'IN_COMBAT') {
      return { ok: false, success: false, error: 'You cannot abandon a hunting contract while locked in combat with your quarry!' };
    }

    if (activeCombat && activeCombat.status === 'DISCOVERED' && Number(activeCombat.character_level || 1) > 1 && Number(activeCombat.is_ambush || 0) === 1) {
      return { ok: false, success: false, error: 'Ambush! You cannot abandon your contract to slip away while your quarry has you ambushed!' };
    }

    // Dismiss any unengaged non-ambush DISCOVERED encounter with this bounty target
    txDb.prepare(`
      UPDATE encounters
      SET status = 'IGNORED'
      WHERE character_id = ? AND bounty_contract_id = ? AND status = 'DISCOVERED'
    `).run(characterId, active.id);

    txDb.prepare(`
      UPDATE hunting_contracts
      SET status = 'ABANDONED', completed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND character_id = ? AND status = 'ACTIVE'
    `).run(active.id, characterId);

    return {
      ok: true,
      success: true,
      abandonedContract: active,
      message: `Abandoned contract: ${active.title}.`
    };
  });
}

/**
 * Automatically pays out any READY_TO_CLAIM hunting contracts when a living character is in Oakhaven.
 * Uses an atomic transaction and strict status check so a contract can NEVER be paid out twice.
 *
 * @param {object} db - SQLite connection
 * @param {number} characterId
 * @returns {Array<object>} List of claimed contracts paid out during this call
 */
function autoClaimCompletedBounties(db, characterOrId) {
  const characterId = typeof characterOrId === 'object' && characterOrId !== null ? characterOrId.id : characterOrId;
  if (!characterId) return [];

  return withTransaction(db, (txDb) => {
    const character = txDb.prepare('SELECT id, is_alive, gold, tile_id FROM characters WHERE id = ?').get(characterId);
    if (!character || Number(character.is_alive) !== 1) {
      return [];
    }

    const tile = txDb.prepare('SELECT terrain, is_safe FROM map_tiles WHERE id = ?').get(character.tile_id);
    if (!tile || tile.terrain !== 'CITY' || tile.is_safe !== 1) {
      return [];
    }

    const claimable = txDb.prepare(`
      SELECT hc.*, m.name AS base_monster_name
      FROM hunting_contracts hc
      JOIN monsters m ON hc.base_monster_id = m.id
      WHERE hc.character_id = ? AND hc.status = 'READY_TO_CLAIM'
      ORDER BY hc.id ASC
    `).all(characterId);

    if (claimable.length === 0) {
      return [];
    }

    const claimed = [];
    for (const contract of claimable) {
      const updateResult = txDb.prepare(`
        UPDATE hunting_contracts
        SET status = 'COMPLETED', claimed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND character_id = ? AND status = 'READY_TO_CLAIM'
      `).run(contract.id, characterId);

      if (updateResult.changes === 1) {
        txDb.prepare(`
          UPDATE characters
          SET gold = gold + ?
          WHERE id = ? AND is_alive = 1
        `).run(contract.reward_gold, characterId);

        claimed.push({
          id: contract.id,
          title: contract.title,
          customName: contract.custom_name,
          baseMonsterName: contract.base_monster_name,
          regionName: contract.region_name,
          rewardGold: contract.reward_gold
        });
      }
    }

    return claimed;
  });
}

/**
 * System B: Threats in the Wilderness.
 * Returns sanitized rumors about active global persistent monsters (monster_instances)
 * that have slain heroes, showing ONLY compass direction from Oakhaven, kill count, and a dark warning.
 * Strictly hides monster type/species, custom name, exact coordinates, stats, and stolen items.
 *
 * @param {object} db - SQLite connection
 * @returns {Array<object>} List of sanitized wilderness threat warnings
 */
function getWildernessThreats(db) {
  const cityTile = db.prepare(`
    SELECT x, y FROM map_tiles
    WHERE terrain = 'CITY' AND is_safe = 1
    ORDER BY id ASC LIMIT 1
  `).get() || { x: 7, y: 7 };

  const activeInstances = db.prepare(`
    SELECT mi.id, mi.kill_count, mi.created_at, mt.x, mt.y
    FROM monster_instances mi
    JOIN map_tiles mt ON mi.tile_id = mt.id
    WHERE mi.status = 'ACTIVE' AND mi.kill_count >= 1
    ORDER BY mi.kill_count DESC, mi.id DESC
  `).all();

  return activeInstances.map((inst) => {
    const direction = getCompassDirection(cityTile.x, cityTile.y, inst.x, inst.y);
    const killCount = Number(inst.kill_count) || 1;

    let severityLabel = 'Lethal Threat';
    let warningText;

    if (killCount >= 3) {
      severityLabel = 'Dread Menace';
      warningText = `A dread horror has slaughtered ${killCount} heroes to the ${direction} of Oakhaven. None who ventured near its hunting grounds have returned.`;
    } else if (killCount === 2) {
      severityLabel = 'High Threat';
      warningText = `A lethal creature has claimed the lives of 2 heroes to the ${direction}. Approach the ${direction.toLowerCase()} wilds with extreme caution.`;
    } else {
      severityLabel = 'Known Threat';
      warningText = `An adventurer fell to a lingering predator to the ${direction} of Oakhaven. The creature still stalks the area.`;
    }

    return {
      direction,
      killCount,
      severityLabel,
      severity: severityLabel,
      warningText,
      rumor: warningText
    };
  });
}

module.exports = {
  MAX_BOARD_CONTRACTS,
  BOUNTY_BOOSTS,
  resolveTileRegionName,
  getCompassDirection,
  getReachableWildernessRegions,
  generateBountyMonsterName,
  calculateBountyRewardGold,
  getOrGenerateContracts,
  getActiveContractForCharacter,
  acceptContract,
  abandonContract,
  autoClaimCompletedBounties,
  getWildernessThreats
};
