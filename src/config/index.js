const path = require('path');
const fs = require('fs');

// Attempt to load .env file if available (Node 20+)
if (typeof process.loadEnvFile === 'function') {
  try {
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  } catch (err) {
    // Silently continue if .env does not exist
  }
}

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.execArgv.some(arg => typeof arg === 'string' && arg.includes('test')) ||
  process.argv.some(arg => typeof arg === 'string' && (arg.includes('test') || arg.endsWith('.test.js')));

const defaultDbPath = isTestEnv
  ? ':memory:'
  : path.join(__dirname, '../../data/darkgrid.sqlite');

const nodeEnv = process.env.NODE_ENV || (isTestEnv ? 'test' : 'development');
const sessionSecret = process.env.SESSION_SECRET || 'darkgrid-dev-secret-key-change-in-production';

// Production security guard: reject insecure default session secret (M3)
if (nodeEnv === 'production' && sessionSecret === 'darkgrid-dev-secret-key-change-in-production') {
  throw new Error('[SECURITY ERROR] Insecure SESSION_SECRET: In production, SESSION_SECRET must be explicitly set via environment variable.');
}

const parsedEncounterChance = process.env.ENCOUNTER_CHANCE_PERCENT !== undefined
  ? parseInt(process.env.ENCOUNTER_CHANCE_PERCENT, 10)
  : NaN;
const encounterChancePercent = Number.isFinite(parsedEncounterChance) ? parsedEncounterChance : 25;

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv,
  sessionSecret,
  dbPath: process.env.DB_PATH || defaultDbPath,

  // Configurable game mechanics (Phase 1)
  encounterChancePercent,
  encounterSigma: parseFloat(process.env.ENCOUNTER_SIGMA) || 1.5,
  startingGold: 10,

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

  // Base character definitions and Phase 7A.3 / 7B 72-point class presets
  classBases: {
    FIGHTER: {
      name: 'Fighter',
      title: 'Iron-Clad Vanguard',
      icon: '⚔️',
      loreQuote: '“Faith wavers and arrows spend, but cold iron and scarred sinew endure until the bitter end.”',
      description: 'Forged in the mud and blood of hopeless sieges, the Fighter stands unbroken where lesser mortals perish. Masters of every blade, polearm, and warbow, they alone bear the crushing weight of full plate and tower shields into the dark.',
      pillars: [
        {
          icon: '⚔️',
          title: 'Master of All Arms',
          text: 'No weapon is foreign to your grip—from greatswords and halberds to heavy warbows—and veteran instinct makes every strike cleave deeper as your legend grows.'
        },
        {
          icon: '🛡️',
          title: 'Bulwark of Iron',
          text: 'Trained to bear heavy plate and tower shields that would crush others; seasoned discipline gradually turns the heaviest armor into a nimble second skin.'
        },
        {
          icon: '🩸',
          title: 'Unyielding Lifeblood',
          text: 'Hardened by a lifetime of brutal close-quarters warfare, you possess the deepest reserves of vitality to survive bone-shattering blows.'
        }
      ],
      strength: 14,
      constitution: 14,
      dexterity: 12,
      intelligence: 10,
      wisdom: 12,
      charisma: 10,
      hpAtLevel1: 10,
      hpPerLevel: 6
    },
    RANGER: {
      name: 'Ranger',
      title: 'Shadow-Stalker of the Wilds',
      icon: '🏹',
      loreQuote: '“To walk the mist-choked wilds and live, you must hear the beast breathe before it catches your scent.”',
      description: 'A silent predator who reads snapped twigs, fouled wind, and faint tracks in the mire. Moving unseen through cursed boughs, the Ranger discerns lurking horrors from afar and looses the first lethal shaft before the beast knows it is hunted.',
      pillars: [
        {
          icon: '👁️',
          title: 'Eyes in the Mist',
          text: 'Where others see only shifting shadows, your keen wilderness senses uncover the habits and hidden tells of distant threats before you step into their jaws.'
        },
        {
          icon: '🏹',
          title: 'Ambush from the Shadows',
          text: 'With a bow or crossbow readied, you loose a free opening shot from the gloom against grounded threats the instant battle is joined.'
        },
        {
          icon: '🐺',
          title: 'Sworn Blood-Quarry',
          text: 'By swearing a blood-hunt against a chosen breed of living monster, you exploit their vital spots with escalating lethality—though the soulless Undead defy a hunter’s craft.'
        }
      ],
      strength: 10,
      constitution: 12,
      dexterity: 16,
      intelligence: 10,
      wisdom: 14,
      charisma: 10,
      hpAtLevel1: 10,
      hpPerLevel: 6
    },
    CLERIC: {
      name: 'Cleric',
      title: 'Vessel of the Dying Light',
      icon: '✨',
      loreQuote: '“Where the sun dares not shine, I carry the ember. What the grave refuses to keep, I shall return to ash.”',
      description: 'Anointed beneath crumbling cathedrals, the Cleric marches into the abyss clad in heavy mail, bearing mace and shield. Through solemn prayer they mend their own torn flesh in the wild and sear the restless dead with sacred wrath.',
      pillars: [
        {
          icon: '✨',
          title: 'Sacred Restoration',
          text: 'Between battles in the unforgiving wilds, you channel divine grace to knit your own wounds without relying solely on scarce potions—renewing your prayers at any sanctuary.'
        },
        {
          icon: '☀️',
          title: 'Bane of the Restless Dead',
          text: 'When confronting Undead abominations, holy radiance blazes around your vestments—guiding your strikes, searing unholy bone, and warding you from the grave’s chill.'
        },
        {
          icon: '🔨',
          title: 'Sanctified Iron & Presence',
          text: 'Clad in sturdy mail with consecrated mace and shield, your commanding presence also earns fairer terms when bartering with town merchants.'
        }
      ],
      strength: 12,
      constitution: 12,
      dexterity: 10,
      intelligence: 10,
      wisdom: 16,
      charisma: 12,
      hpAtLevel1: 8,
      hpPerLevel: 5
    }
  },

  // Phase 7A.3 / 7B: Free Starting Attribute Allocation (72 points, bounds 8..18) & Level-Up Milestones
  statRules: {
    minScore: 8,
    maxScore: 18,
    totalSum: 72,
    requiredTotalSum: 72,
    baseSum: 72,
    bonusPoints: 0,
    maxReductionPerStat: 10,
    milestoneLevels: [2, 4, 6, 8, 10]
  }
};

module.exports = config;
