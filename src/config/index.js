const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'darkgrid-dev-secret-key-change-in-production',
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/darkgrid.sqlite'),

  // Configurable game mechanics (Phase 1)
  encounterChancePercent: parseInt(process.env.ENCOUNTER_CHANCE_PERCENT, 10) || 25,
  encounterSigma: parseFloat(process.env.ENCOUNTER_SIGMA) || 1.5,
  startingGold: 50,

  // Mapping from map_tiles.terrain to monsters.habitat codes
  // FOREST -> F, JUNGLE -> J, SWAMP -> S, etc.
  terrainHabitatMap: {
    FOREST: 'F',
    JUNGLE: 'J',
    SWAMP: 'S',
    PLAINS: 'P',
    HILLS: 'H',
    MOUNTAINS: 'M',
    DESERT: 'D',
    RIVER_LAKE: 'R',
    COAST: 'C',
    OCEAN: 'O',
    AQUATIC: 'A',
    UNDERGROUND_RUINS: 'U',
    CITY: 'T',
    BRIDGE: 'B',
    EXTRAPLANAR: 'X',
    OTHER: 'Z'
  },

  // Base character definitions according to DARKGRID_GAME_SPEC.md §3.1
  classBases: {
    FIGHTER: {
      name: 'Fighter',
      description: 'A battle-hardened warrior with formidable vitality and mastery over all weapons and armor.',
      strength: 14,
      constitution: 12,
      dexterity: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      hpPerLevel: 10
    },
    RANGER: {
      name: 'Ranger',
      description: 'A hunter and wilderness tracker who perceives nature and lurking threats with keen senses from afar.',
      strength: 12,
      constitution: 10,
      dexterity: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 10,
      hpPerLevel: 8
    },
    CLERIC: {
      name: 'Cleric',
      description: 'An anointed servant of divine powers possessing deep wisdom and the sacred power to heal wounds.',
      strength: 12,
      constitution: 10,
      dexterity: 10,
      intelligence: 10,
      wisdom: 14,
      charisma: 12,
      hpPerLevel: 8
    }
  },

  // Stat allocation constraints
  statRules: {
    bonusPoints: 3,
    maxReductionPerStat: 2,
    maxScore: 18,
    baseSum: 68, // 14+12+12+10+10+10
    requiredTotalSum: 71 // 68 + 3
  }
};

module.exports = config;
