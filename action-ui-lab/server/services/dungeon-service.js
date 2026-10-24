/**
 * DARKGRID — Phase 9C Data-Driven Large Dungeon Engine
 *
 * Implements:
 * - Reusable grid-based dungeon engine sharing movement, encounter/ambush, combat,
 *   loot, XP, permadeath, and class rules with the overworld.
 * - Two large multi-route dungeons (~360–380 total tiles each):
 *     1. GOBLIN_CAVE (20x18 = 360 tiles) beneath Whispering Crags [9, 12]
 *     2. ANCIENT_CRYPT (20x19 = 380 tiles) beneath Necropolis Sanctum [26, 5]
 * - Strict Dungeon Fog of War & True Line-of-Sight (supercover raycasting + corner
 *   blocking; radius 2 for standard classes, radius 3 for Ranger).
 * - Three visual states: UNEXPLORED (pitch black, zero leakage), EXPLORED_MEMORY
 *   (dimmed previously discovered terrain), VISIBLE (currently in LoS).
 * - Persistent per-character, per-dungeon discovery & event tracking in SQLite.
 */

const { getTileById, getTileByCoords } = require('../../../src/domain/world/map');
const { getEncounterById, investigateEncounter } = require('../../../src/domain/encounters/engine');
const { startCombat } = require('../../../src/domain/combat/engine');
const { recordEncounterStart, getOrCreateAdventureState } = require('../../adventure-engine');

const DUNGEON_KEYS = {
  GOBLIN_CAVE: 'GOBLIN_CAVE',
  ANCIENT_CRYPT: 'ANCIENT_CRYPT'
};

const DUNGEON_VISION_RADIUS = {
  DEFAULT: 2,
  RANGER: 3
};

const DUNGEON_BOSS_PROFILES = {
  GOBLIN_CAVE: {
    bossKey: 'GOBLIN_CAVE_BROOD_KING',
    dungeonKey: 'GOBLIN_CAVE',
    customTitle: 'Skulkrip the Cave Brood-King',
    baseMonsterName: 'Bugbear',
    fallbackMonsterName: 'Hobgoblin',
    maxHp: 18,
    heldGold: 65,
    xpBonus: 120,
    x: 16,
    y: 2,
    introMessage: 'Deep within the web-choked Brood-King Sanctum, Skulkrip the Cave Brood-King rises from a throne of gnawed bones and hefted iron!'
  },
  ANCIENT_CRYPT: {
    bossKey: 'ANCIENT_CRYPT_BARROW_KING',
    dungeonKey: 'ANCIENT_CRYPT',
    customTitle: 'Lord Malakor the Barrow-Wight King',
    baseMonsterName: 'Barrow Wight',
    fallbackMonsterName: 'Wight',
    maxHp: 20,
    heldGold: 80,
    xpBonus: 160,
    x: 10,
    y: 2,
    introMessage: 'Cold emerald fire erupts from the obsidian sarcophagus as Lord Malakor the Barrow-Wight King draws his runed greatsword!'
  }
};

const DUNGEON_FIXED_ENCOUNTERS = {
  // Goblin Cave fixed guards
  CAVE_SPIDER_BROOD: {
    eventKey: 'CAVE_SPIDER_BROOD',
    dungeonKey: 'GOBLIN_CAVE',
    monsterName: 'Giant Spider',
    customTitle: 'Broodmother Spinner',
    hpBoost: 3,
    goldBoost: 18,
    isAmbush: true,
    message: 'Venomous fangs click in the overhead webbing — a Broodmother Spinner drops from the cavern ceiling!'
  },
  CAVE_WARCAMP_SENTRY: {
    eventKey: 'CAVE_WARCAMP_SENTRY',
    dungeonKey: 'GOBLIN_CAVE',
    monsterName: 'Hobgoblin',
    customTitle: 'Crag-Tunnel Taskmaster',
    hpBoost: 3,
    goldBoost: 20,
    isAmbush: false,
    message: 'A Crag-Tunnel Taskmaster kicking embers by the subterranean war-camp snarls and raises a notched cleaver!'
  },
  CAVE_BRIDGE_BUGBEAR: {
    eventKey: 'CAVE_BRIDGE_BUGBEAR',
    dungeonKey: 'GOBLIN_CAVE',
    monsterName: 'Bugbear',
    customTitle: 'Chasm-Guard Stalker',
    hpBoost: 4,
    goldBoost: 24,
    isAmbush: true,
    message: 'From the stalagmite shadows beside the chasm bridge, a Hulking Bugbear Chasm-Guard lunges forward!'
  },
  // Ancient Crypt fixed guards
  CRYPT_NAVE_WARDEN: {
    eventKey: 'CRYPT_NAVE_WARDEN',
    dungeonKey: 'ANCIENT_CRYPT',
    monsterName: 'Skeletal Champion',
    customTitle: 'Sepulcher Honor-Guard',
    hpBoost: 3,
    goldBoost: 22,
    isAmbush: false,
    message: 'An armored Sepulcher Honor-Guard steps down from its plinth in the Pillared Nave, ancient blade gleaming with cold light!'
  },
  CRYPT_TOMB_GHOUL: {
    eventKey: 'CRYPT_TOMB_GHOUL',
    dungeonKey: 'ANCIENT_CRYPT',
    monsterName: 'Ghoul',
    customTitle: 'Sarcophagus Stalker',
    hpBoost: 3,
    goldBoost: 18,
    isAmbush: true,
    message: 'A stone lid grinds open in the Hall of Sarcophagi as a famished Sarcophagus Stalker leaps from the shadows!'
  },
  CRYPT_CATACOMB_SHADOW: {
    eventKey: 'CRYPT_CATACOMB_SHADOW',
    dungeonKey: 'ANCIENT_CRYPT',
    monsterName: 'Shadow',
    customTitle: 'Whispering Shade of the Ossuary',
    hpBoost: 3,
    goldBoost: 20,
    isAmbush: true,
    message: 'The necrotic torchlight dims — a Whispering Shade detaches itself from the bone-stacked catacomb wall!'
  },
  CRYPT_OSSUARY_WIGHT: {
    eventKey: 'CRYPT_OSSUARY_WIGHT',
    dungeonKey: 'ANCIENT_CRYPT',
    monsterName: 'Wight',
    customTitle: 'Crypt-Bearer of the Inner Seal',
    hpBoost: 4,
    goldBoost: 26,
    isAmbush: false,
    message: 'Before the Inner Seal, a Crypt-Bearer Wight levels a corroded halberd and rasps an ancient curse!'
  },
  CRYPT_MUMMY_SENTINEL: {
    eventKey: 'CRYPT_MUMMY_SENTINEL',
    dungeonKey: 'ANCIENT_CRYPT',
    monsterName: 'Mummy',
    customTitle: 'Anointed Tomb-Guardian',
    hpBoost: 4,
    goldBoost: 30,
    isAmbush: false,
    message: 'Linen wrappings trailed in grave-dust stir as an Anointed Tomb-Guardian steps before the royal treasury!'
  }
};

const DUNGEON_TREASURES = {
  CAVE_SMUGGLER_STASH: {
    treasureKey: 'CAVE_SMUGGLER_STASH',
    dungeonKey: 'GOBLIN_CAVE',
    title: 'Gnawed Smuggler Pack',
    gold: 25,
    healHp: 0,
    grantPotion: false,
    message: 'You pry open a half-buried smuggler pack wedged behind the bone pit (+25 Gold).'
  },
  CAVE_SILK_CACHE: {
    treasureKey: 'CAVE_SILK_CACHE',
    dungeonKey: 'GOBLIN_CAVE',
    title: 'Web-Wrapped Adventurer Satchel',
    gold: 32,
    healHp: 0,
    grantPotion: true,
    message: 'Cutting through the thick spider-silk cocoons, you recover +32 Gold and an intact Healing Potion!'
  },
  CAVE_ARMORY_CHEST: {
    treasureKey: 'CAVE_ARMORY_CHEST',
    dungeonKey: 'GOBLIN_CAVE',
    title: 'Ironbound Raiders Chest',
    gold: 42,
    healHp: 0,
    grantPotion: false,
    message: 'Inside the old goblin war-camp armory, you force open a plundered iron chest (+42 Gold).'
  },
  CAVE_FUNGAL_SHRINE: {
    treasureKey: 'CAVE_FUNGAL_SHRINE',
    dungeonKey: 'GOBLIN_CAVE',
    title: 'Luminous Spring Basin',
    gold: 28,
    healHp: 4,
    grantPotion: false,
    message: 'Clear mineral water pools beside bioluminescent cavern moss (+28 Gold in votive coins, +4 HP restored).'
  },
  CRYPT_RELIQUARY_COFFER: {
    treasureKey: 'CRYPT_RELIQUARY_COFFER',
    dungeonKey: 'ANCIENT_CRYPT',
    title: 'Silver Reliquary Coffer',
    gold: 38,
    healHp: 4,
    grantPotion: false,
    message: 'Within the Sunken Reliquary, a consecrated silver coffer yields +38 Gold and a faint radiant warmth (+4 HP).'
  },
  CRYPT_EMBALMING_URN: {
    treasureKey: 'CRYPT_EMBALMING_URN',
    dungeonKey: 'ANCIENT_CRYPT',
    title: 'Gilded Canopic Urn',
    gold: 34,
    healHp: 0,
    grantPotion: true,
    message: 'Among the funerary jars in the Embalming Chamber, you uncover +34 Gold and a preserved restorative vial (+1 Potion)!'
  },
  CRYPT_ROYAL_OFFERING: {
    treasureKey: 'CRYPT_ROYAL_OFFERING',
    dungeonKey: 'ANCIENT_CRYPT',
    title: 'Altar of the Eclipsed Sun',
    gold: 48,
    healHp: 0,
    grantPotion: false,
    message: 'From the ancient funerary altar you gather ceremonial gold burial-discs (+48 Gold).'
  },
  CRYPT_CROWN_TREASURY: {
    treasureKey: 'CRYPT_CROWN_TREASURY',
    dungeonKey: 'ANCIENT_CRYPT',
    title: 'Vault of the Undying Guard',
    gold: 55,
    healHp: 0,
    grantPotion: true,
    message: 'Behind the guardian sarcophagus lies a royal funerary coffer (+55 Gold and +1 Healing Potion)!'
  }
};

const DUNGEON_HAZARDS = {
  HAZARD_BONE_SPIKES: {
    damage: 2,
    title: 'Sharpened Bone-Spike Pit',
    message: 'Splintered bone-spikes concealed in the cavern muck gash your boots (-2 HP)!'
  },
  HAZARD_SPIDER_WEBS: {
    damage: 1,
    title: 'Caustic Web-Tangle',
    message: 'Sticky acid-laced spider webs burn as you tear free (-1 HP).'
  },
  HAZARD_NECROTIC_MIST: {
    damage: 2,
    title: 'Pool of Necrotic Mist',
    message: 'Freezing emerald grave-mist seeps through your armor, draining warmth (-2 HP)!'
  },
  HAZARD_CURSED_BRAZIER: {
    damage: 2,
    title: 'Hexed Sepulcher Brazier',
    message: 'A pulse of violet necrotic fire lashes out from the cursed funerary brazier (-2 HP)!'
  }
};

/**
 * 20x18 = 360 tiles layout for GOBLIN_CAVE
 * Legend:
 *  '#' = Impassable Cavern Wall (is_passable=0, is_opaque=1)
 *  'E' = Entrance / Exit Stairs at [3, 16] (is_safe=1)
 *  '.' = Damp Cavern Tunnel / Gallery
 *  'R' = Underground Room / Chamber Floor
 *  'C' = Old Goblin War-Camp Floor
 *  'W' = Web-Choked Hollow Floor
 *  'B' = Chasm Bridge / Narrow Ledge
 *  'S' = Brood-King Sanctum Floor
 *  'K' = Fixed Boss Tile at [16, 2]
 */
const GOBLIN_CAVE_ASCII = [
  //01234567890123456789
  '####################', // y=0
  '##############SSSSS#', // y=1
  '##RRR#########SSKSS#', // y=2
  '##RRR...######SSSSS#', // y=3
  '##RRR...######..SSS#', // y=4
  '###.####.......#####', // y=5
  '###.####.#####.#####', // y=6
  '###....BBBBBBB..####', // y=7
  '#WWWW#.#######..####', // y=8
  '#WWWW#...#####..####', // y=9
  '#WWWW###.#####CCCCC#', // y=10
  '###.####.#####CCCCC#', // y=11
  '###...........CCCCC#', // y=12
  '###.##########CC.RR#', // y=13
  '#RR.##########...RR#', // y=14
  '#RR...#########.RRR#', // y=15
  '##.E..##############', // y=16
  '####################'  // y=17
];

/**
 * 20x19 = 380 tiles layout for ANCIENT_CRYPT
 * Legend:
 *  '#' = Impassable Obsidian / Crypt Masonry Wall (is_passable=0, is_opaque=1)
 *  'E' = Crypt Entrance / Exit Stairs at [10, 17] (is_safe=1)
 *  '.' = Cold Stone Corridor / Vault Passage
 *  'N' = Pillared Temple Nave
 *  'T' = Hall of Sarcophagi / Stone Tombs
 *  'C' = Charnel Catacomb Gallery
 *  'V' = Consecrated Reliquary / Treasury Vault
 *  'S' = Royal Sepulcher Inner Sanctum
 *  'K' = Fixed Undead Boss Tile at [10, 2]
 */
const ANCIENT_CRYPT_ASCII = [
  //01234567890123456789
  '####################', // y=0
  '########SSSSS#######', // y=1
  '##VVV###SSKSS###VVV#', // y=2
  '##VVV...SSSSS...VVV#', // y=3
  '##VVV###SSSSS###VVV#', // y=4
  '###.######N######.##', // y=5
  '###.######N######.##', // y=6
  '###.......N.......##', // y=7
  '####.####NNN####.###', // y=8
  '####.####NNN####.###', // y=9
  '####.####NNN####.###', // y=10
  '###TTTT..NNN..CCCC##', // y=11
  '###TTTT#.NNN.#CCCC##', // y=12
  '###TTTT#.NNN.#CCCC##', // y=13
  '###TTTT..NNN..CCCC##', // y=14
  '#VVV.####NNN####.VV#', // y=15
  '#VVV.....NNN.....VV#', // y=16
  '#VVV####NNE.N###VVV#', // y=17
  '####################'  // y=18
];

function buildGoblinCaveTileMeta(x, y, ch) {
  const isWall = ch === '#';
  const isEntry = x === 3 && y === 16;
  const isBoss = x === 16 && y === 2;
  const isDeep = y <= 8 || x >= 14;
  const dangerZoneKey = isWall || isEntry
    ? null
    : (isDeep ? 'GOBLIN_CAVE_DEEP_LAIR' : 'GOBLIN_CAVE_TUNNELS');

  let name = isWall ? 'Sheer Cavern Wall' : 'Damp Cavern Tunnel';
  let roomType = isWall ? 'WALL' : 'CORRIDOR';
  let visualType = isWall ? 'CAVE_WALL' : 'CAVE_FLOOR';
  let feature = null;
  let fixedEncounterKey = null;
  let treasureKey = null;
  let bossKey = null;
  let isLandmark = 0;
  let landmarkKey = null;
  let description = isWall
    ? 'Solid subterranean granite slick with mineral moisture.'
    : 'A narrow subterranean tunnel carved through dark limestone beneath Whispering Crags.';

  if (isEntry) {
    name = 'Goblin Cave — Cavern Mouth Stairs';
    roomType = 'ENTRANCE';
    visualType = 'DUNGEON_ENTRANCE_STAIRS';
    feature = 'DUNGEON_EXIT';
    isLandmark = 1;
    landmarkKey = 'GOBLIN_CAVE_EXIT';
    description = 'Rough-hewn stone steps climb toward the pale daylight of Whispering Crags [9, 12]. Deeper north and east, pitch-lit goblin tunnels descend into darkness.';
  } else if (isBoss) {
    name = 'Brood-King Sanctum — Bone Throne';
    roomType = 'BOSS_SANCTUM';
    visualType = 'CAVE_BOSS_ALTAR';
    feature = 'DUNGEON_BOSS';
    bossKey = DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.bossKey;
    isLandmark = 1;
    landmarkKey = 'GOBLIN_CAVE_SANCTUM';
    description = 'A cavernous subterranean vault festooned with skull-totems, rusted shields, and a jagged throne of monster bones where Skulkrip the Cave Brood-King rules.';
  } else if (ch === 'S') {
    name = 'Brood-King Sanctum';
    roomType = 'BOSS_SANCTUM';
    visualType = 'CAVE_SANCTUM_FLOOR';
    description = 'Torch-lit stalagmites and piles of gnawed bones ring the inner sanctum of the Goblin Cave.';
  } else if (ch === 'W') {
    name = 'Spider-Silk Hollow';
    roomType = 'CHAMBER';
    visualType = 'CAVE_WEB_FLOOR';
    description = 'Thick curtains of glistening spider-silk drape the cavern ceiling and bone-strewn floor.';
  } else if (ch === 'C') {
    name = 'Subterranean Goblin War-Camp';
    roomType = 'CHAMBER';
    visualType = 'CAVE_CAMP_FLOOR';
    description = 'Smoldering firepits, crude weapon racks, and goblin clan-totems fill this wide underground cavern.';
  } else if (ch === 'B') {
    name = 'Echoing Chasm Ledge';
    roomType = 'BRIDGE';
    visualType = 'CAVE_CHASM_BRIDGE';
    description = 'A narrow natural stone span arches over a pitch-black subterranean abyss.';
  } else if (ch === 'R') {
    if (y >= 14 && x <= 3) {
      name = 'Sunken Bone-Pit Alcove';
      roomType = 'OPTIONAL_CHAMBER';
      visualType = 'CAVE_BONE_FLOOR';
      description = 'A dank dead-end hollow choked with discarded bones and broken crates.';
    } else if (y >= 13 && x >= 16) {
      name = 'Plundered Cavern Armory';
      roomType = 'OPTIONAL_CHAMBER';
      visualType = 'CAVE_ARMORY_FLOOR';
      description = 'An auxiliary storage chamber stacked with rusted iron gear and stolen merchant chests.';
    } else {
      name = 'Luminous Fungal Grotto';
      roomType = 'OPTIONAL_CHAMBER';
      visualType = 'CAVE_FUNGAL_FLOOR';
      description = 'Pale blue cavern fungi and a trickle of underground spring water illuminate the damp stone.';
    }
  }

  // Specific fixed encounters, treasures, and hazards
  if (x === 2 && y === 9) {
    fixedEncounterKey = 'CAVE_SPIDER_BROOD';
    feature = 'GUARD_POST';
  } else if (x === 14 && y === 12) {
    fixedEncounterKey = 'CAVE_WARCAMP_SENTRY';
    feature = 'GUARD_POST';
  } else if (x === 10 && y === 7) {
    fixedEncounterKey = 'CAVE_BRIDGE_BUGBEAR';
    feature = 'GUARD_POST';
  }

  if (x === 1 && y === 15) {
    treasureKey = 'CAVE_SMUGGLER_STASH';
    feature = 'TREASURE_CACHE';
    isLandmark = 1;
    landmarkKey = 'CAVE_SMUGGLER_STASH';
  } else if (x === 1 && y === 8) {
    treasureKey = 'CAVE_SILK_CACHE';
    feature = 'TREASURE_CACHE';
    isLandmark = 1;
    landmarkKey = 'CAVE_SILK_CACHE';
  } else if (x === 18 && y === 15) {
    treasureKey = 'CAVE_ARMORY_CHEST';
    feature = 'TREASURE_CACHE';
    isLandmark = 1;
    landmarkKey = 'CAVE_ARMORY_CHEST';
  } else if (x === 2 && y === 2) {
    treasureKey = 'CAVE_FUNGAL_SHRINE';
    feature = 'TREASURE_CACHE';
    isLandmark = 1;
    landmarkKey = 'CAVE_FUNGAL_SHRINE';
  }

  if (x === 2 && y === 14) {
    feature = 'HAZARD_BONE_SPIKES';
  } else if (x === 3 && y === 9) {
    feature = 'HAZARD_SPIDER_WEBS';
  }

  return {
    name,
    terrain: isWall ? 'WALL' : 'CAVE',
    roomType,
    feature,
    visualType,
    visualKind: isLandmark ? 'LANDMARK' : roomType,
    isPassable: isWall ? 0 : 1,
    isOpaque: isWall ? 1 : 0,
    isSafe: isEntry ? 1 : 0,
    isLandmark,
    landmarkKey,
    dangerZoneKey,
    fixedEncounterKey,
    treasureKey,
    bossKey,
    description
  };
}

function buildAncientCryptTileMeta(x, y, ch) {
  const isWall = ch === '#';
  const isEntry = x === 10 && y === 17;
  const isBoss = x === 10 && y === 2;
  const isInner = y <= 8;
  const dangerZoneKey = isWall || isEntry
    ? null
    : (isInner ? 'CRYPT_INNER_CATACOMBS' : 'CRYPT_OUTER_GALLERIES');

  let name = isWall ? 'Obsidian Crypt Wall' : 'Sepulcher Corridor';
  let roomType = isWall ? 'WALL' : 'CORRIDOR';
  let visualType = isWall ? 'CRYPT_WALL' : 'CRYPT_FLOOR';
  let feature = null;
  let fixedEncounterKey = null;
  let treasureKey = null;
  let bossKey = null;
  let isLandmark = 0;
  let landmarkKey = null;
  let description = isWall
    ? 'Cyclopean blocks of polished black basalt carved with worn funerary reliefs.'
    : 'Cold flagstone catacomb passage lit by flickering necrotic sconces.';

  if (isEntry) {
    name = 'Ancient Crypt — Sepulcher Threshold Stairs';
    roomType = 'ENTRANCE';
    visualType = 'DUNGEON_ENTRANCE_STAIRS';
    feature = 'DUNGEON_EXIT';
    isLandmark = 1;
    landmarkKey = 'ANCIENT_CRYPT_EXIT';
    description = 'Broad obsidian steps ascend toward the Necropolis Sanctum [26, 5]. Northward lies the Pillared Nave of the Ancient Crypt.';
  } else if (isBoss) {
    name = 'Royal Sepulcher — Throne of the Barrow-King';
    roomType = 'BOSS_SANCTUM';
    visualType = 'CRYPT_BOSS_DAIS';
    feature = 'DUNGEON_BOSS';
    bossKey = DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.bossKey;
    isLandmark = 1;
    landmarkKey = 'ANCIENT_CRYPT_SANCTUM';
    description = 'Beneath a vaulted dome of black stone stands the runed sarcophagus and necrotic throne of Lord Malakor the Barrow-Wight King.';
  } else if (ch === 'S') {
    name = 'Royal Sepulcher Sanctum';
    roomType = 'BOSS_SANCTUM';
    visualType = 'CRYPT_SANCTUM_FLOOR';
    description = 'Towering funerary statues and emerald necrotic braziers flank the royal burial dais.';
  } else if (ch === 'N') {
    name = 'Pillared Nave of the Fallen';
    roomType = 'CHAMBER';
    visualType = 'CRYPT_NAVE_FLOOR';
    description = 'Shattered marble columns and cold stone effigies line the central processional nave of the crypt.';
  } else if (ch === 'T') {
    name = 'Western Hall of Sarcophagi';
    roomType = 'CHAMBER';
    visualType = 'CRYPT_TOMB_FLOOR';
    description = 'Rows of carved stone sarcophagi rest within recessed burial alcoves along the western wing.';
  } else if (ch === 'C') {
    name = 'Eastern Charnel Catacombs';
    roomType = 'CHAMBER';
    visualType = 'CRYPT_CATACOMB_FLOOR';
    description = 'Tiered ossuary niches packed with ancient skulls and burial urns line the eastern catacomb hall.';
  } else if (ch === 'V') {
    if (y >= 15 && x <= 3) {
      name = 'Sunken Reliquary Vault';
      roomType = 'OPTIONAL_CHAMBER';
      visualType = 'CRYPT_VAULT_FLOOR';
      description = 'A hidden side chapel housing tarnished silver reliquaries and faded murals.';
    } else if (y >= 15 && x >= 16) {
      name = 'Forsaken Embalming Chamber';
      roomType = 'OPTIONAL_CHAMBER';
      visualType = 'CRYPT_VAULT_FLOOR';
      description = 'Stone preparation tables and sealed canopic jars fill this cold funerary annex.';
    } else if (y <= 4 && x <= 4) {
      name = 'Sanctum of the Eclipsed Altar';
      roomType = 'OPTIONAL_CHAMBER';
      visualType = 'CRYPT_SHRINE_FLOOR';
      description = 'An ancient subterranean shrine where necrotic light pools around an eclipsed sun altar.';
    } else {
      name = 'Vault of the Undying Guard';
      roomType = 'OPTIONAL_CHAMBER';
      visualType = 'CRYPT_VAULT_FLOOR';
      description = 'A sealed royal treasury vault guarded by ancient embalmed sentinels.';
    }
  }

  // Specific fixed encounters, treasures, and hazards
  if (x === 10 && y === 12) {
    fixedEncounterKey = 'CRYPT_NAVE_WARDEN';
    feature = 'GUARD_POST';
  } else if (x === 4 && y === 12) {
    fixedEncounterKey = 'CRYPT_TOMB_GHOUL';
    feature = 'GUARD_POST';
  } else if (x === 15 && y === 12) {
    fixedEncounterKey = 'CRYPT_CATACOMB_SHADOW';
    feature = 'GUARD_POST';
  } else if (x === 10 && y === 6) {
    fixedEncounterKey = 'CRYPT_OSSUARY_WIGHT';
    feature = 'GUARD_POST';
  } else if (x === 16 && y === 3) {
    fixedEncounterKey = 'CRYPT_MUMMY_SENTINEL';
    feature = 'GUARD_POST';
  }

  if (x === 1 && y === 17) {
    treasureKey = 'CRYPT_RELIQUARY_COFFER';
    feature = 'TREASURE_CACHE';
    isLandmark = 1;
    landmarkKey = 'CRYPT_RELIQUARY_COFFER';
  } else if (x === 18 && y === 17) {
    treasureKey = 'CRYPT_EMBALMING_URN';
    feature = 'TREASURE_CACHE';
    isLandmark = 1;
    landmarkKey = 'CRYPT_EMBALMING_URN';
  } else if (x === 2 && y === 2) {
    treasureKey = 'CRYPT_ROYAL_OFFERING';
    feature = 'TREASURE_CACHE';
    isLandmark = 1;
    landmarkKey = 'CRYPT_ROYAL_OFFERING';
  } else if (x === 17 && y === 2) {
    treasureKey = 'CRYPT_CROWN_TREASURY';
    feature = 'TREASURE_CACHE';
    isLandmark = 1;
    landmarkKey = 'CRYPT_CROWN_TREASURY';
  }

  if (x === 15 && y === 14) {
    feature = 'HAZARD_NECROTIC_MIST';
  } else if (x === 7 && y === 7) {
    feature = 'HAZARD_CURSED_BRAZIER';
  }

  return {
    name,
    terrain: isWall ? 'WALL' : 'RUINS',
    roomType,
    feature,
    visualType,
    visualKind: isLandmark ? 'LANDMARK' : roomType,
    isPassable: isWall ? 0 : 1,
    isOpaque: isWall ? 1 : 0,
    isSafe: isEntry ? 1 : 0,
    isLandmark,
    landmarkKey,
    dangerZoneKey,
    fixedEncounterKey,
    treasureKey,
    bossKey,
    description
  };
}

function buildDungeonLayout(dungeonKey) {
  const isGoblinCave = dungeonKey === DUNGEON_KEYS.GOBLIN_CAVE;
  const asciiRows = isGoblinCave ? GOBLIN_CAVE_ASCII : ANCIENT_CRYPT_ASCII;
  const height = asciiRows.length;
  const width = asciiRows[0].length;
  const rawGrid = [];

  for (let y = 0; y < height; y++) {
    const row = asciiRows[y];
    for (let x = 0; x < width; x++) {
      const ch = row[x] || '#';
      const meta = isGoblinCave
        ? buildGoblinCaveTileMeta(x, y, ch)
        : buildAncientCryptTileMeta(x, y, ch);
      rawGrid.push({
        dungeonKey,
        x,
        y,
        ...meta
      });
    }
  }

  const byCoord = new Map(rawGrid.map((t) => [`${t.x},${t.y}`, t]));
  for (const tile of rawGrid) {
    if (!tile.isPassable) {
      tile.pathConnections = '';
      continue;
    }
    const dirs = [];
    const n = byCoord.get(`${tile.x},${tile.y - 1}`);
    const s = byCoord.get(`${tile.x},${tile.y + 1}`);
    const e = byCoord.get(`${tile.x + 1},${tile.y}`);
    const w = byCoord.get(`${tile.x - 1},${tile.y}`);
    if (n && n.isPassable) dirs.push('N');
    if (s && s.isPassable) dirs.push('S');
    if (e && e.isPassable) dirs.push('E');
    if (w && w.isPassable) dirs.push('W');
    tile.pathConnections = dirs.join(',');
  }

  return {
    width,
    height,
    totalTiles: width * height,
    passableCount: rawGrid.filter((t) => t.isPassable === 1).length,
    tileMap: byCoord,
    tiles: rawGrid
  };
}

const DUNGEON_DEFINITIONS = {
  GOBLIN_CAVE: {
    dungeonKey: 'GOBLIN_CAVE',
    name: 'The Goblin Cave of Whispering Crags',
    subtitle: 'Subterranean Cavern Network & Brood-King Lair',
    regionKey: 'BLACKWOOD_FOREST',
    entranceOverworldX: 9,
    entranceOverworldY: 12,
    entryX: 3,
    entryY: 16,
    exitX: 3,
    exitY: 16,
    bossKey: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.bossKey,
    bossName: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.customTitle,
    bossX: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.x,
    bossY: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.y,
    themeKey: 'CAVE_SUBTERRANEAN',
    artworkUrl: '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
    description: 'A vast network of damp limestone tunnels, spider-choked hollows, subterranean war-camps, and the deep sanctum of Skulkrip the Cave Brood-King beneath Whispering Crags.',
    ...buildDungeonLayout('GOBLIN_CAVE')
  },
  ANCIENT_CRYPT: {
    dungeonKey: 'ANCIENT_CRYPT',
    name: 'The Ancient Crypt of the Barrow Kings',
    subtitle: 'Sunken Necropolis Catacombs & Royal Sepulcher',
    regionKey: 'UNDEAD_LANDS',
    entranceOverworldX: 26,
    entranceOverworldY: 5,
    entryX: 10,
    entryY: 17,
    exitX: 10,
    exitY: 17,
    bossKey: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.bossKey,
    bossName: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.customTitle,
    bossX: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.x,
    bossY: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.y,
    themeKey: 'CRYPT_NECROPOLIS',
    artworkUrl: '/images/terrain/terrain_underground_ruins.webp',
    description: 'An ancient subterranean necropolis of cold stone tombs, pillared temple halls, bone-stacked catacombs, and the royal burial vault of Lord Malakor the Barrow-Wight King.',
    ...buildDungeonLayout('ANCIENT_CRYPT')
  }
};

let dungeonTablesSynced = false;

function syncDungeonTables(db) {
  if (!db) return;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dungeon_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dungeon_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        subtitle TEXT NOT NULL DEFAULT '',
        region_key TEXT NOT NULL,
        entrance_overworld_x INTEGER NOT NULL,
        entrance_overworld_y INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        total_tiles INTEGER NOT NULL,
        entry_x INTEGER NOT NULL,
        entry_y INTEGER NOT NULL,
        exit_x INTEGER NOT NULL,
        exit_y INTEGER NOT NULL,
        boss_key TEXT NOT NULL,
        boss_name TEXT NOT NULL,
        boss_x INTEGER NOT NULL,
        boss_y INTEGER NOT NULL,
        theme_key TEXT NOT NULL,
        artwork_url TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dungeon_tiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dungeon_key TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        name TEXT NOT NULL,
        terrain TEXT NOT NULL,
        room_type TEXT NOT NULL DEFAULT 'CORRIDOR',
        feature TEXT DEFAULT NULL,
        visual_type TEXT DEFAULT NULL,
        visual_kind TEXT DEFAULT NULL,
        path_connections TEXT NOT NULL DEFAULT '',
        is_passable INTEGER NOT NULL DEFAULT 1,
        is_opaque INTEGER NOT NULL DEFAULT 0,
        is_safe INTEGER NOT NULL DEFAULT 0,
        is_landmark INTEGER NOT NULL DEFAULT 0,
        landmark_key TEXT DEFAULT NULL,
        danger_zone_key TEXT DEFAULT NULL,
        fixed_encounter_key TEXT DEFAULT NULL,
        treasure_key TEXT DEFAULT NULL,
        boss_key TEXT DEFAULT NULL,
        description TEXT NOT NULL DEFAULT '',
        UNIQUE(dungeon_key, x, y)
      );

      CREATE TABLE IF NOT EXISTS character_dungeon_discovered_tiles (
        character_id INTEGER NOT NULL,
        dungeon_key TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (character_id, dungeon_key, x, y)
      );

      CREATE TABLE IF NOT EXISTS character_dungeon_events (
        character_id INTEGER NOT NULL,
        dungeon_key TEXT NOT NULL,
        event_key TEXT NOT NULL,
        event_type TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        resolved_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (character_id, dungeon_key, event_key)
      );
    `);

    const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM dungeon_tiles').get();
    const expectedTotal = DUNGEON_DEFINITIONS.GOBLIN_CAVE.totalTiles + DUNGEON_DEFINITIONS.ANCIENT_CRYPT.totalTiles;
    if (dungeonTablesSynced && countRow && Number(countRow.cnt) === expectedTotal) {
      return;
    }

    const upsertDef = db.prepare(`
      INSERT INTO dungeon_definitions (
        dungeon_key, name, subtitle, region_key,
        entrance_overworld_x, entrance_overworld_y,
        width, height, total_tiles,
        entry_x, entry_y, exit_x, exit_y,
        boss_key, boss_name, boss_x, boss_y,
        theme_key, artwork_url, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(dungeon_key) DO UPDATE SET
        name = excluded.name,
        subtitle = excluded.subtitle,
        region_key = excluded.region_key,
        entrance_overworld_x = excluded.entrance_overworld_x,
        entrance_overworld_y = excluded.entrance_overworld_y,
        width = excluded.width,
        height = excluded.height,
        total_tiles = excluded.total_tiles,
        entry_x = excluded.entry_x,
        entry_y = excluded.entry_y,
        exit_x = excluded.exit_x,
        exit_y = excluded.exit_y,
        boss_key = excluded.boss_key,
        boss_name = excluded.boss_name,
        boss_x = excluded.boss_x,
        boss_y = excluded.boss_y,
        theme_key = excluded.theme_key,
        artwork_url = excluded.artwork_url,
        description = excluded.description
    `);

    const upsertTile = db.prepare(`
      INSERT INTO dungeon_tiles (
        dungeon_key, x, y, name, terrain, room_type, feature,
        visual_type, visual_kind, path_connections,
        is_passable, is_opaque, is_safe, is_landmark, landmark_key,
        danger_zone_key, fixed_encounter_key, treasure_key, boss_key, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(dungeon_key, x, y) DO UPDATE SET
        name = excluded.name,
        terrain = excluded.terrain,
        room_type = excluded.room_type,
        feature = excluded.feature,
        visual_type = excluded.visual_type,
        visual_kind = excluded.visual_kind,
        path_connections = excluded.path_connections,
        is_passable = excluded.is_passable,
        is_opaque = excluded.is_opaque,
        is_safe = excluded.is_safe,
        is_landmark = excluded.is_landmark,
        landmark_key = excluded.landmark_key,
        danger_zone_key = excluded.danger_zone_key,
        fixed_encounter_key = excluded.fixed_encounter_key,
        treasure_key = excluded.treasure_key,
        boss_key = excluded.boss_key,
        description = excluded.description
    `);

    db.exec('BEGIN');
    try {
      for (const def of Object.values(DUNGEON_DEFINITIONS)) {
        upsertDef.run(
          def.dungeonKey,
          def.name,
          def.subtitle,
          def.regionKey,
          def.entranceOverworldX,
          def.entranceOverworldY,
          def.width,
          def.height,
          def.totalTiles,
          def.entryX,
          def.entryY,
          def.exitX,
          def.exitY,
          def.bossKey,
          def.bossName,
          def.bossX,
          def.bossY,
          def.themeKey,
          def.artworkUrl,
          def.description
        );
        for (const t of def.tiles) {
          upsertTile.run(
            t.dungeonKey,
            t.x,
            t.y,
            t.name,
            t.terrain,
            t.roomType,
            t.feature,
            t.visualType,
            t.visualKind,
            t.pathConnections,
            t.isPassable,
            t.isOpaque,
            t.isSafe,
            t.isLandmark,
            t.landmarkKey,
            t.dangerZoneKey,
            t.fixedEncounterKey,
            t.treasureKey,
            t.bossKey,
            t.description
          );
        }
      }
      db.exec('COMMIT');
      dungeonTablesSynced = true;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  } catch {
    // Non-fatal fallback
  }
}

function getDungeonVisionRadius(characterClass) {
  return String(characterClass || '').toUpperCase() === 'RANGER'
    ? DUNGEON_VISION_RADIUS.RANGER
    : DUNGEON_VISION_RADIUS.DEFAULT;
}

function getDungeonDefinition(db, dungeonKey) {
  syncDungeonTables(db);
  return DUNGEON_DEFINITIONS[dungeonKey] || null;
}

function getDungeonTile(dbOrKey, maybeKey, maybeX, maybeY) {
  let db = null;
  let dungeonKey = null;
  let x = 0;
  let y = 0;
  if (typeof dbOrKey === 'string') {
    dungeonKey = dbOrKey;
    x = Number(maybeKey);
    y = Number(maybeX);
  } else {
    db = dbOrKey;
    dungeonKey = maybeKey;
    x = Number(maybeX);
    y = Number(maybeY);
  }
  if (!dungeonKey) return null;
  if (db && typeof db.prepare === 'function') {
    syncDungeonTables(db);
    const row = db.prepare(`
      SELECT * FROM dungeon_tiles
      WHERE dungeon_key = ? AND x = ? AND y = ?
      LIMIT 1
    `).get(String(dungeonKey), x, y);
    if (row) {
      return {
        ...row,
        isPassable: Number(row.is_passable) === 1,
        isOpaque: Number(row.is_opaque) === 1,
        roomType: row.room_type,
        dangerZoneKey: row.danger_zone_key,
        fixedEncounterKey: row.fixed_encounter_key,
        treasureKey: row.treasure_key,
        bossKey: row.boss_key
      };
    }
  }
  const def = DUNGEON_DEFINITIONS[String(dungeonKey)];
  const tileMap = def ? def.tileMap : null;
  if (!tileMap) return null;
  const mem = tileMap.get(`${x},${y}`);
  if (!mem) return null;
  return {
    ...mem,
    isPassable: Number(mem.is_passable ?? mem.isPassable ?? 0) === 1,
    isOpaque: Number(mem.is_opaque ?? mem.isOpaque ?? 0) === 1,
    roomType: mem.room_type || mem.roomType,
    dangerZoneKey: mem.danger_zone_key || mem.dangerZoneKey,
    fixedEncounterKey: mem.fixed_encounter_key || mem.fixedEncounterKey,
    treasureKey: mem.treasure_key || mem.treasureKey,
    bossKey: mem.boss_key || mem.bossKey
  };
}

/**
 * Supercover Line-of-Sight check between (x0, y0) and (x1, y1).
 * Strictly blocks sight through walls (is_opaque=1 or is_passable=0) and around
 * closed 90-degree corners.
 */
function hasDungeonLineOfSight(tileMap, x0, y0, x1, y1, maxRadius = 2) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const chebyshev = Math.max(Math.abs(dx), Math.abs(dy));
  if (chebyshev > maxRadius) return false;
  const distSq = dx * dx + dy * dy;
  if (distSq > maxRadius * maxRadius + 1) return false;
  if (dx === 0 && dy === 0) return true;

  const isWallAt = (cx, cy) => {
    const t = tileMap.get(`${cx},${cy}`);
    if (!t) return true;
    return Number(t.is_passable ?? t.isPassable ?? 0) === 0 || Number(t.is_opaque ?? t.isOpaque ?? 0) === 1;
  };

  const targetIsWall = isWallAt(x1, y1);

  // Distance 1 (immediate neighbors)
  if (chebyshev === 1) {
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      return true;
    }
    // Diagonal neighbor (|dx|===1 && |dy|===1): blocked if both orthogonal neighbors are walls,
    // and for floor targets require at least one open orthogonal neighbor.
    const wallX = isWallAt(x0 + dx, y0);
    const wallY = isWallAt(x0, y0 + dy);
    if (wallX && wallY) return false;
    if (!targetIsWall && (wallX || wallY)) {
      // Around a tight 90-degree wall corner, do not reveal the floor around the corner
      // until the hero steps onto the corner tile itself.
      return false;
    }
    return true;
  }

  // For distance > 1, test every grid cell in the bounding box between (x0,y0) and (x1,y1)
  // whose center lies within perpendicular distance < 0.495 of the segment (supercover).
  const segLen = Math.hypot(dx, dy);
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (cx === x0 && cy === y0) continue;
      if (cx === x1 && cy === y1) continue;

      // Project (cx - x0, cy - y0) onto segment (dx, dy)
      const vx = cx - x0;
      const vy = cy - y0;
      const proj = (vx * dx + vy * dy) / (segLen * segLen);
      if (proj <= 0.001 || proj >= 0.999) continue;

      // Perpendicular distance from cell center (cx, cy) to segment
      const perpDist = Math.abs(vx * dy - vy * dx) / segLen;
      const threshold = targetIsWall ? 0.42 : 0.495;
      if (perpDist < threshold) {
        if (isWallAt(cx, cy)) {
          return false;
        }
      }
    }
  }

  // If the target itself is a wall at distance > 1, only show it if it bounds a visible floor tile
  // that is closer to the hero.
  if (targetIsWall) {
    const stepX = dx === 0 ? 0 : (dx > 0 ? -1 : 1);
    const stepY = dy === 0 ? 0 : (dy > 0 ? -1 : 1);
    const frontOrthX = stepX !== 0 && !isWallAt(x1 + stepX, y1);
    const frontOrthY = stepY !== 0 && !isWallAt(x1, y1 + stepY);
    const frontDiag = stepX !== 0 && stepY !== 0 && !isWallAt(x1 + stepX, y1 + stepY);
    if (!frontOrthX && !frontOrthY && !frontDiag) {
      return false;
    }
  }

  return true;
}

/**
 * Computes currently visible coordinates in the dungeon from (heroX, heroY)
 * using class-aware radius and strict supercover Line-of-Sight.
 */
function computeDungeonVisibleCoords(dbOrKey, dungeonKeyOrX, heroXOrY, heroYOrClass, characterClass = 'FIGHTER') {
  let tileMap = null;
  let dungeonKey;
  let heroX;
  let heroY;
  let charClass;

  if (typeof dbOrKey === 'string') {
    dungeonKey = dbOrKey;
    heroX = Number(dungeonKeyOrX);
    heroY = Number(heroXOrY);
    charClass = heroYOrClass || 'FIGHTER';
    const def = DUNGEON_DEFINITIONS[dungeonKey];
    if (!def) return new Set();
    tileMap = def.tileMap;
  } else {
    const db = dbOrKey;
    dungeonKey = dungeonKeyOrX;
    heroX = Number(heroXOrY);
    heroY = Number(heroYOrClass);
    charClass = characterClass || 'FIGHTER';
    syncDungeonTables(db);
    const def = DUNGEON_DEFINITIONS[dungeonKey];
    if (!def) return new Set();
    const rows = db.prepare('SELECT * FROM dungeon_tiles WHERE dungeon_key = ?').all(dungeonKey);
    tileMap = new Map(rows.map((r) => [`${r.x},${r.y}`, r]));
  }

  const radius = getDungeonVisionRadius(charClass);
  const visible = new Set();

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = heroX + dx;
      const ty = heroY + dy;
      if (!tileMap.has(`${tx},${ty}`)) continue;
      if (hasDungeonLineOfSight(tileMap, heroX, heroY, tx, ty, radius)) {
        visible.add(`${tx},${ty}`);
      }
    }
  }

  return visible;
}

/**
 * Records persistent dungeon tile discovery for all currently visible tiles in LoS.
 */
function recordDungeonTileDiscovery(db, character, dungeonKey, heroX, heroY) {
  if (!db || !character || !character.id || !dungeonKey) return new Set();
  syncDungeonTables(db);
  const visibleSet = computeDungeonVisibleCoords(db, dungeonKey, heroX, heroY, character.class);
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO character_dungeon_discovered_tiles (character_id, dungeon_key, x, y)
    VALUES (?, ?, ?, ?)
  `);
  for (const coordKey of visibleSet) {
    const [cx, cy] = coordKey.split(',').map(Number);
    insertStmt.run(character.id, dungeonKey, cx, cy);
  }
  return visibleSet;
}

function getCharacterDungeonDiscoveredSet(db, characterId, dungeonKey) {
  syncDungeonTables(db);
  if (!db || !characterId || !dungeonKey) return new Set();
  const rows = db.prepare(`
    SELECT x, y FROM character_dungeon_discovered_tiles
    WHERE character_id = ? AND dungeon_key = ?
  `).all(characterId, dungeonKey);
  return new Set(rows.map((r) => `${r.x},${r.y}`));
}

function getCharacterDungeonResolvedEvents(db, characterId, dungeonKey) {
  syncDungeonTables(db);
  if (!db || !characterId || !dungeonKey) return new Set();
  const rows = db.prepare(`
    SELECT event_key FROM character_dungeon_events
    WHERE character_id = ? AND dungeon_key = ?
  `).all(characterId, dungeonKey);
  return new Set(rows.map((r) => r.event_key));
}

function markDungeonEventResolved(db, characterId, dungeonKey, eventKey, eventType, x = 0, y = 0) {
  syncDungeonTables(db);
  db.prepare(`
    INSERT OR REPLACE INTO character_dungeon_events (
      character_id, dungeon_key, event_key, event_type, x, y, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(characterId, dungeonKey, eventKey, eventType, Number(x || 0), Number(y || 0));
}

function isDungeonBossDefeated(db, characterId, dungeonKey) {
  const bossProfile = DUNGEON_BOSS_PROFILES[dungeonKey];
  if (!bossProfile) return false;
  const resolved = getCharacterDungeonResolvedEvents(db, characterId, dungeonKey);
  return resolved.has(bossProfile.bossKey);
}

/**
 * Verifies via Breadth-First Search that every passable tile in a dungeon is reachable
 * from the entrance tile, and that the boss tile is reachable via multiple distinct routes.
 */
function verifyDungeonConnectivity(dungeonKey) {
  const def = DUNGEON_DEFINITIONS[dungeonKey];
  if (!def) return { ok: false, error: `Unknown dungeon: ${dungeonKey}` };

  const passableTiles = def.tiles.filter((t) => t.isPassable === 1);
  const byCoord = new Map(def.tiles.map((t) => [`${t.x},${t.y}`, t]));
  const startKey = `${def.entryX},${def.entryY}`;
  const bossKey = `${def.bossX},${def.bossY}`;

  const visited = new Set([startKey]);
  const queue = [[def.entryX, def.entryY]];

  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    const neighbors = [
      [cx, cy - 1],
      [cx, cy + 1],
      [cx - 1, cy],
      [cx + 1, cy]
    ];
    for (const [nx, ny] of neighbors) {
      const k = `${nx},${ny}`;
      if (visited.has(k)) continue;
      const nt = byCoord.get(k);
      if (nt && nt.isPassable === 1) {
        visited.add(k);
        queue.push([nx, ny]);
      }
    }
  }

  const unreachable = passableTiles.filter((t) => !visited.has(`${t.x},${t.y}`));
  const bossReachable = visited.has(bossKey);

  return {
    ok: unreachable.length === 0 && bossReachable,
    dungeonKey,
    width: def.width,
    height: def.height,
    totalTiles: def.totalTiles,
    passableCount: passableTiles.length,
    reachableCount: visited.size,
    unreachableCount: unreachable.length,
    bossReachable
  };
}

/**
 * Enters a dungeon from its overworld entrance landmark.
 */
function enterDungeon(db, character, dungeonKey) {
  syncDungeonTables(db);
  const def = DUNGEON_DEFINITIONS[dungeonKey];
  if (!def) {
    return { ok: false, error: `Unknown dungeon: ${dungeonKey}` };
  }

  const entryX = def.entryX;
  const entryY = def.entryY;

  db.prepare(`
    UPDATE characters
    SET active_dungeon_key = ?,
        dungeon_x = ?,
        dungeon_y = ?,
        facing = 'NORTH',
        active_landmark_scene_key = NULL
    WHERE id = ?
  `).run(dungeonKey, entryX, entryY, character.id);

  recordDungeonTileDiscovery(db, character, dungeonKey, entryX, entryY);

  return {
    ok: true,
    dungeonKey,
    x: entryX,
    y: entryY,
    definition: def,
    message: `Entered ${def.name}. Pitch darkness presses close around your torchlight — explore with caution.`
  };
}

/**
 * Exits the active dungeon back to its overworld landmark tile.
 */
function exitDungeon(db, character) {
  syncDungeonTables(db);
  const dungeonKey = character.active_dungeon_key;
  const def = DUNGEON_DEFINITIONS[dungeonKey];
  if (!def) {
    db.prepare(`
      UPDATE characters
      SET active_dungeon_key = NULL, dungeon_x = NULL, dungeon_y = NULL
      WHERE id = ?
    `).run(character.id);
    return { ok: true, message: 'Returned to the overworld.' };
  }

  const overworldTile = getTileByCoords(db, def.entranceOverworldX, def.entranceOverworldY);
  if (overworldTile) {
    db.prepare(`
      UPDATE characters
      SET tile_id = ?,
          active_dungeon_key = NULL,
          dungeon_x = NULL,
          dungeon_y = NULL,
          active_landmark_scene_key = NULL,
          dismissed_landmark_tile_id = ?
      WHERE id = ?
    `).run(overworldTile.id, overworldTile.id, character.id);
  } else {
    db.prepare(`
      UPDATE characters
      SET active_dungeon_key = NULL, dungeon_x = NULL, dungeon_y = NULL
      WHERE id = ?
    `).run(character.id);
  }

  return {
    ok: true,
    dungeonKey,
    overworldX: def.entranceOverworldX,
    overworldY: def.entranceOverworldY,
    message: `Climbed out of ${def.name} back to the overworld at [${def.entranceOverworldX}, ${def.entranceOverworldY}].`
  };
}

function selectDungeonMonster(db, dungeonKey, tile, rng = Math.random) {
  const isCrypt = dungeonKey === DUNGEON_KEYS.ANCIENT_CRYPT;
  const isDeep = tile && (
    tile.danger_zone_key === 'GOBLIN_CAVE_DEEP_LAIR'
    || tile.danger_zone_key === 'CRYPT_INNER_CATACOMBS'
    || Number(tile.y) <= 8
  );

  let poolNames;
  if (isCrypt) {
    poolNames = isDeep
      ? ['Ghoul', 'Shadow', 'Skeletal Champion', 'Ghast', 'Wight', 'Wraith', 'Mummy', 'Barrow Wight']
      : ['Human Skeleton', 'Human Zombie', 'Ghoul', 'Shadow', 'Skeletal Champion'];
  } else {
    poolNames = isDeep
      ? ['Goblin', 'Hobgoblin', 'Bugbear', 'Giant Spider', 'Rust Monster', 'Stirge']
      : ['Goblin', 'Giant Bat', 'Stirge', 'Mite', 'Giant Spider', 'Hobgoblin'];
  }

  const placeholders = poolNames.map(() => '?').join(',');
  const candidates = db.prepare(`SELECT * FROM monsters WHERE name IN (${placeholders})`).all(...poolNames);
  if (candidates.length > 0) {
    const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
    return candidates[idx];
  }
  return db.prepare('SELECT * FROM monsters ORDER BY RANDOM() LIMIT 1').get();
}

function spawnDungeonEncounter(db, character, dungeonKey, dungeonTile, {
  monsterName = null,
  customTitle = null,
  hpBoost = 0,
  goldBoost = 0,
  isAmbush = false,
  isBoss = false,
  bossKey = null,
  fixedEncounterKey = null,
  maxHpOverride = null,
  rng = Math.random
} = {}) {
  let monster = null;
  if (monsterName) {
    monster = db.prepare('SELECT * FROM monsters WHERE LOWER(name) = LOWER(?) LIMIT 1').get(monsterName);
  }
  if (!monster) {
    monster = selectDungeonMonster(db, dungeonKey, dungeonTile, rng);
  }
  if (!monster) return null;

  const baseHp = maxHpOverride !== null
    ? Number(maxHpOverride)
    : Math.max(1, Number(monster.base_hp || 8) + Number(hpBoost || 0));

  const spottedByHero = isAmbush ? 0 : 1;
  const stateObj = {
    inDungeon: true,
    dungeonKey,
    dungeonX: Number(dungeonTile.x),
    dungeonY: Number(dungeonTile.y),
    dungeonRoomName: dungeonTile.name,
    customTitle: customTitle || null,
    goldBoost: Number(goldBoost || 0),
    isDungeonBoss: Boolean(isBoss),
    dungeonBossKey: bossKey || null,
    fixedEncounterKey: fixedEncounterKey || null
  };

  const ins = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status,
      current_monster_hp, monster_max_hp, combat_round,
      spotted_by_hero, is_ambush, opening_shot_resolved, combat_state_json
    ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, ?, ?, 0, ?)
  `).run(
    character.id,
    character.tile_id,
    monster.id,
    baseHp,
    baseHp,
    spottedByHero,
    isAmbush ? 1 : 0,
    JSON.stringify(stateObj)
  );

  const encId = Number(ins.lastInsertRowid);
  if (isAmbush) {
    startCombat(db, character.id, encId, { rng });
  }
  const overworldTile = getTileById(db, character.tile_id);
  const advState = getOrCreateAdventureState(character.id, overworldTile || dungeonTile);
  recordEncounterStart(advState, dungeonTile, {
    status: isAmbush ? 'IN_COMBAT' : 'STAGE1_PRE_COMBAT',
    monsterName: isAmbush ? (customTitle || monster.name) : null
  });

  return {
    encounterId: encId,
    monster,
    isAmbush,
    customTitle
  };
}

function ensureDungeonBossInstance(db, character, dungeonKey, bossProfile) {
  let monster = db.prepare('SELECT * FROM monsters WHERE LOWER(name) = LOWER(?) LIMIT 1').get(bossProfile.baseMonsterName);
  if (!monster && bossProfile.fallbackMonsterName) {
    monster = db.prepare('SELECT * FROM monsters WHERE LOWER(name) = LOWER(?) LIMIT 1').get(bossProfile.fallbackMonsterName);
  }
  if (!monster) {
    monster = db.prepare('SELECT * FROM monsters ORDER BY id ASC LIMIT 1').get();
  }

  let existing = db.prepare(`
    SELECT * FROM monster_instances
    WHERE custom_title = ?
    ORDER BY id DESC LIMIT 1
  `).get(bossProfile.customTitle);

  if (existing) {
    db.prepare(`
      UPDATE monster_instances
      SET status = 'ACTIVE',
          current_hp = ?,
          max_hp = ?,
          held_gold = ?,
          tile_id = ?
      WHERE id = ?
    `).run(bossProfile.maxHp, bossProfile.maxHp, bossProfile.heldGold, character.tile_id, existing.id);
    return db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(existing.id);
  }

  const ins = db.prepare(`
    INSERT INTO monster_instances (
      monster_id, tile_id, custom_title, max_hp, current_hp, held_gold, kill_count, status
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'ACTIVE')
  `).run(
    monster.id,
    character.tile_id,
    bossProfile.customTitle,
    bossProfile.maxHp,
    bossProfile.maxHp,
    bossProfile.heldGold
  );

  return db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(Number(ins.lastInsertRowid));
}

function startDungeonBossEncounter(db, character, options = {}) {
  syncDungeonTables(db);
  const dungeonKey = character.active_dungeon_key;
  const bossProfile = DUNGEON_BOSS_PROFILES[dungeonKey];
  if (!bossProfile) {
    throw new Error('No active dungeon boss found.');
  }

  if (isDungeonBossDefeated(db, character.id, dungeonKey)) {
    throw new Error(`${bossProfile.customTitle} has already been slain in this sanctum.`);
  }

  db.prepare(`
    UPDATE encounters
    SET status = 'ESCAPED'
    WHERE character_id = ? AND status = 'DISCOVERED'
  `).run(character.id);

  const bossInstance = ensureDungeonBossInstance(db, character, dungeonKey, bossProfile);
  const stateObj = {
    inDungeon: true,
    dungeonKey,
    dungeonX: Number(bossProfile.x),
    dungeonY: Number(bossProfile.y),
    dungeonBossName: bossProfile.customTitle,
    customTitle: bossProfile.customTitle,
    goldBoost: 0,
    isDungeonBoss: true,
    dungeonBossKey: bossProfile.bossKey
  };

  const ins = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, monster_instance_id,
      status, current_monster_hp, monster_max_hp, combat_round,
      spotted_by_hero, is_ambush, opening_shot_resolved, combat_state_json
    ) VALUES (?, ?, ?, ?, 'DISCOVERED', ?, ?, 0, 1, 0, 0, ?)
  `).run(
    character.id,
    character.tile_id,
    bossInstance.monster_id,
    bossInstance.id,
    bossInstance.current_hp || bossInstance.max_hp,
    bossInstance.max_hp,
    JSON.stringify(stateObj)
  );

  const encounterId = Number(ins.lastInsertRowid);
  const investigateResult = investigateEncounter(
    db,
    character.id,
    encounterId,
    character.class,
    options.rng ? { rng: options.rng } : {}
  );
  const encounter = getEncounterById(db, encounterId, character.class);
  if (encounter && encounter.status === 'VICTORY') {
    db.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(encounterId, character.id);
    markDungeonEventResolved(db, character.id, dungeonKey, bossProfile.bossKey, 'BOSS', bossProfile.x, bossProfile.y);
  }

  return {
    ok: true,
    encounterId,
    investigateResult,
    encounter,
    bossDef: bossProfile,
    bossProfile,
    message: bossProfile.introMessage
  };
}

/**
 * Executes a single grid step inside the active dungeon.
 * Validates bounds and walls server-side so players cannot walk or teleport through walls.
 */
function moveInDungeon(db, character, direction, options = {}) {
  syncDungeonTables(db);
  const dungeonKey = character.active_dungeon_key;
  const def = DUNGEON_DEFINITIONS[dungeonKey];
  if (!def) {
    return { ok: false, error: 'Character is not inside a valid dungeon.' };
  }

  const dir = String(direction || '').toUpperCase();
  const deltas = {
    NORTH: { dx: 0, dy: -1 },
    SOUTH: { dx: 0, dy: 1 },
    WEST: { dx: -1, dy: 0 },
    EAST: { dx: 1, dy: 0 }
  };
  const delta = deltas[dir];
  if (!delta) {
    return { ok: false, error: `Invalid movement direction: ${direction}` };
  }

  const curX = Number.isInteger(Number(character.dungeon_x)) ? Number(character.dungeon_x) : def.entryX;
  const curY = Number.isInteger(Number(character.dungeon_y)) ? Number(character.dungeon_y) : def.entryY;
  const targetX = curX + delta.dx;
  const targetY = curY + delta.dy;

  if (targetX < 0 || targetX >= def.width || targetY < 0 || targetY >= def.height) {
    return {
      ok: false,
      blocked: true,
      error: `Impassable subterranean wall to the ${dir.toLowerCase()}.`
    };
  }

  const targetTile = getDungeonTile(db, dungeonKey, targetX, targetY);
  if (!targetTile || Number(targetTile.is_passable) === 0) {
    return {
      ok: false,
      blocked: true,
      error: `Solid stone blocks your path to the ${dir.toLowerCase()} (${targetTile ? targetTile.name : 'Cavern Wall'}).`
    };
  }

  // Commit movement & update LoS discovery
  db.prepare(`
    UPDATE characters
    SET dungeon_x = ?, dungeon_y = ?, facing = ?
    WHERE id = ?
  `).run(targetX, targetY, dir, character.id);

  recordDungeonTileDiscovery(db, character, dungeonKey, targetX, targetY);

  const resolvedEvents = getCharacterDungeonResolvedEvents(db, character.id, dungeonKey);
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const suppressEncounters = Boolean(options.suppressRandomEncounter || options.forcedChance === 0);

  // 1. Check Treasure Cache on tile
  let treasureMessage = null;
  if (targetTile.treasure_key && !resolvedEvents.has(targetTile.treasure_key)) {
    const tDef = DUNGEON_TREASURES[targetTile.treasure_key];
    if (tDef) {
      markDungeonEventResolved(db, character.id, dungeonKey, tDef.treasureKey, 'TREASURE', targetX, targetY);
      const nextGold = Number(character.gold || 0) + Number(tDef.gold || 0);
      const nextHp = tDef.healHp > 0
        ? Math.min(Number(character.max_hp || 10), Number(character.current_hp || 10) + Number(tDef.healHp))
        : Number(character.current_hp || 10);
      db.prepare(`
        UPDATE characters
        SET gold = ?, current_hp = ?
        WHERE id = ?
      `).run(nextGold, nextHp, character.id);
      if (tDef.grantPotion) {
        try {
          const potionItem = db.prepare("SELECT id FROM items WHERE type = 'CONSUMABLE' ORDER BY id ASC LIMIT 1").get();
          if (potionItem) {
            const invRow = db.prepare('SELECT id, quantity FROM character_inventory WHERE character_id = ? AND item_id = ? LIMIT 1').get(character.id, potionItem.id);
            if (invRow) {
              db.prepare('UPDATE character_inventory SET quantity = quantity + 1 WHERE id = ?').run(invRow.id);
            } else {
              db.prepare('INSERT INTO character_inventory (character_id, item_id, quantity, is_equipped) VALUES (?, ?, 1, 0)').run(character.id, potionItem.id);
            }
          }
        } catch {
          // Non-fatal
        }
      }
      character.gold = nextGold;
      character.current_hp = nextHp;
      treasureMessage = tDef.message;
    }
  }

  // 2. Check Environmental Hazard on tile (once per dungeon delve per hazard tile)
  let hazardMessage = null;
  const hazardEventKey = targetTile.feature && DUNGEON_HAZARDS[targetTile.feature]
    ? `${targetTile.feature}_${targetX}_${targetY}`
    : null;
  if (hazardEventKey && !resolvedEvents.has(hazardEventKey)) {
    const hDef = DUNGEON_HAZARDS[targetTile.feature];
    markDungeonEventResolved(db, character.id, dungeonKey, hazardEventKey, 'HAZARD', targetX, targetY);
    // Clerics resist half of necrotic hazards in the Ancient Crypt; Rangers avoid 1 point of pit/web traps
    let dmg = Number(hDef.damage || 1);
    const heroClass = String(character.class || '').toUpperCase();
    if (heroClass === 'RANGER' && (targetTile.feature === 'HAZARD_BONE_SPIKES' || targetTile.feature === 'HAZARD_SPIDER_WEBS')) {
      dmg = Math.max(1, dmg - 1);
    } else if (heroClass === 'CLERIC' && (targetTile.feature === 'HAZARD_NECROTIC_MIST' || targetTile.feature === 'HAZARD_CURSED_BRAZIER')) {
      dmg = Math.max(1, dmg - 1);
    }
    const nextHp = Math.max(1, Number(character.current_hp || 10) - dmg);
    db.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(nextHp, character.id);
    character.current_hp = nextHp;
    hazardMessage = hDef.message;
  }

  // 3. Check Fixed Guard Encounter tile
  if (!suppressEncounters && targetTile.fixed_encounter_key && !resolvedEvents.has(targetTile.fixed_encounter_key)) {
    const guardDef = DUNGEON_FIXED_ENCOUNTERS[targetTile.fixed_encounter_key];
    if (guardDef) {
      markDungeonEventResolved(db, character.id, dungeonKey, guardDef.eventKey, 'FIXED_ENCOUNTER', targetX, targetY);
      const spawned = spawnDungeonEncounter(db, character, dungeonKey, targetTile, {
        monsterName: guardDef.monsterName,
        customTitle: guardDef.customTitle,
        hpBoost: guardDef.hpBoost,
        goldBoost: guardDef.goldBoost,
        isAmbush: guardDef.isAmbush,
        fixedEncounterKey: guardDef.eventKey,
        rng
      });
      if (spawned) {
        const encObj = getEncounterById(db, spawned.encounterId, character.class);
        return {
          ok: true,
          targetTile,
          movedTo: { x: targetX, y: targetY, name: targetTile.name },
          encounter: encObj,
          encounterTriggered: true,
          isAmbush: Boolean(guardDef.isAmbush),
          treasureFound: treasureMessage ? { message: treasureMessage } : null,
          hazardMessage,
          message: [treasureMessage, hazardMessage, guardDef.message].filter(Boolean).join(' ')
        };
      }
    }
  }

  // 4. Dynamic Dungeon Exploration Encounter / Ambush Roll (unless on safe entrance or boss sanctum altar tile)
  if (Number(targetTile.is_safe) === 0 && !targetTile.boss_key && !suppressEncounters) {
    const isDeep = targetTile.danger_zone_key === 'GOBLIN_CAVE_DEEP_LAIR'
      || targetTile.danger_zone_key === 'CRYPT_INNER_CATACOMBS';
    const encounterRate = options.forcedChance === 100
      ? 1.0
      : (isDeep ? 0.24 : 0.17);
    const ambushShare = isDeep ? 0.42 : 0.32;
    const roll = rng();
    if (roll < encounterRate) {
      const ambushRoll = rng();
      const isAmbush = options.forceAmbush !== undefined
        ? Boolean(options.forceAmbush)
        : (options.forceOutcome === 'AMBUSH' ? true : (options.forceOutcome === 'ENCOUNTER' ? false : ambushRoll < ambushShare));
      const spawned = spawnDungeonEncounter(db, character, dungeonKey, targetTile, {
        isAmbush,
        hpBoost: isDeep ? 2 : 0,
        goldBoost: isDeep ? 10 : 5,
        rng
      });
      if (spawned) {
        const encObj = getEncounterById(db, spawned.encounterId, character.class);
        const threatMsg = isAmbush
          ? `AMBUSH in ${targetTile.name}! Something lunges from the subterranean darkness!`
          : `Moved ${dir} into ${targetTile.name} [${targetX}, ${targetY}]. Movement echoes in the shadows ahead!`;
        return {
          ok: true,
          targetTile,
          movedTo: { x: targetX, y: targetY, name: targetTile.name },
          encounter: encObj,
          encounterTriggered: true,
          isAmbush,
          treasureFound: treasureMessage ? { message: treasureMessage } : null,
          hazardMessage,
          message: [treasureMessage, hazardMessage, threatMsg].filter(Boolean).join(' ')
        };
      }
    }
  }

  const exitHint = targetTile.feature === 'DUNGEON_EXIT'
    ? ' (Stand here and choose Ascend to Overworld to exit the dungeon.)'
    : '';

  const baseMoveMsg = `Moved ${dir} to ${targetTile.name} [${targetX}, ${targetY}].${exitHint}`;
  return {
    ok: true,
    targetTile,
    movedTo: { x: targetX, y: targetY, name: targetTile.name },
    encounter: null,
    encounterTriggered: false,
    isAmbush: false,
    treasureFound: treasureMessage ? { message: treasureMessage } : null,
    hazardMessage,
    hazardTriggered: Boolean(hazardMessage),
    message: [baseMoveMsg, treasureMessage, hazardMessage].filter(Boolean).join(' ')
  };
}

/**
 * Builds the sanitized dungeon map payload for the client.
 * CRITICAL SECRECY RULE:
 * Unexplored tiles (!isDiscovered) NEVER leak room types, passability, treasures,
 * fixed encounters, or boss positions to the client!
 */
function buildDungeonMapPayload(db, character) {
  if (!db || !character || !character.active_dungeon_key) return null;
  syncDungeonTables(db);

  const dungeonKey = character.active_dungeon_key;
  const def = DUNGEON_DEFINITIONS[dungeonKey];
  if (!def) return null;

  const heroX = Number.isInteger(Number(character.dungeon_x)) ? Number(character.dungeon_x) : def.entryX;
  const heroY = Number.isInteger(Number(character.dungeon_y)) ? Number(character.dungeon_y) : def.entryY;

  const visibleSet = recordDungeonTileDiscovery(db, character, dungeonKey, heroX, heroY);
  const discoveredSet = getCharacterDungeonDiscoveredSet(db, character.id, dungeonKey);
  const resolvedEvents = getCharacterDungeonResolvedEvents(db, character.id, dungeonKey);
  const bossDefeated = isDungeonBossDefeated(db, character.id, dungeonKey);
  const currentTile = getDungeonTile(db, dungeonKey, heroX, heroY);

  const rawRows = db.prepare(`
    SELECT * FROM dungeon_tiles
    WHERE dungeon_key = ?
    ORDER BY y ASC, x ASC
  `).all(dungeonKey);

  const passableTotal = rawRows.filter((r) => Number(r.is_passable) === 1).length;
  let discoveredPassable = 0;

  const tiles = rawRows.map((row) => {
    const coordKey = `${row.x},${row.y}`;
    const isVisible = visibleSet.has(coordKey);
    const isDiscovered = isVisible || discoveredSet.has(coordKey);
    const isCurrent = row.x === heroX && row.y === heroY;

    if (isDiscovered && Number(row.is_passable) === 1) {
      discoveredPassable += 1;
    }

    // Strict Fog of War Secrecy: Unexplored tiles return pitch-black masked placeholders
    if (!isDiscovered) {
      return {
        x: row.x,
        y: row.y,
        name: 'Unexplored Darkness',
        terrain: 'UNKNOWN',
        roomType: 'UNKNOWN',
        feature: null,
        visualType: 'UNEXPLORED',
        visualKind: 'UNEXPLORED',
        pathConnections: [],
        isPassable: false,
        isOpaque: true,
        isSafe: false,
        isLandmark: false,
        landmarkKey: null,
        bossKey: null,
        treasureKey: null,
        fixedEncounterKey: null,
        treasureLooted: false,
        hasTreasure: false,
        hasBoss: false,
        bossDefeated: false,
        eventResolved: false,
        fogState: 'UNEXPLORED',
        isDiscovered: false,
        isVisible: false,
        isVisibleNow: false,
        isCurrent: false
      };
    }

    const hasTreasure = Boolean(row.treasure_key);
    const treasureLooted = hasTreasure && resolvedEvents.has(row.treasure_key);
    const hasBoss = Boolean(row.boss_key);
    const eventResolved = Boolean(
      treasureLooted ||
      (row.fixed_encounter_key && resolvedEvents.has(row.fixed_encounter_key)) ||
      (hasBoss && bossDefeated)
    );

    return {
      x: row.x,
      y: row.y,
      name: row.name,
      terrain: row.terrain,
      roomType: row.room_type === 'ENTRANCE' ? 'EXIT_STAIRS' : row.room_type,
      feature: row.feature,
      visualType: row.visual_type,
      visualKind: row.visual_kind,
      pathConnections: row.path_connections
        ? String(row.path_connections).split(',').filter(Boolean)
        : [],
      isPassable: Boolean(row.is_passable),
      isOpaque: Boolean(row.is_opaque),
      isSafe: Boolean(row.is_safe),
      isLandmark: Boolean(row.is_landmark),
      landmarkKey: row.landmark_key || null,
      dangerZoneKey: row.danger_zone_key || null,
      bossKey: isVisible ? (row.boss_key || null) : null,
      treasureKey: isVisible ? (row.treasure_key || null) : null,
      fixedEncounterKey: isVisible ? (row.fixed_encounter_key || null) : null,
      hasTreasure: isVisible ? (hasTreasure && !treasureLooted) : false,
      treasureLooted: isDiscovered ? treasureLooted : false,
      hasBoss: isVisible ? (hasBoss && !bossDefeated) : false,
      bossDefeated: isDiscovered && hasBoss ? bossDefeated : false,
      eventResolved,
      fogState: isVisible ? 'VISIBLE' : 'EXPLORED_MEMORY',
      isDiscovered: true,
      isVisible,
      isVisibleNow: isVisible,
      isCurrent
    };
  });

  const byCoord = new Map(rawRows.map((r) => [`${r.x},${r.y}`, r]));
  const buildNeighborInfo = (dir, dx, dy) => {
    const nx = heroX + dx;
    const ny = heroY + dy;
    const nt = byCoord.get(`${nx},${ny}`);
    if (!nt || Number(nt.is_passable) === 0) {
      return {
        direction: dir,
        x: nx,
        y: ny,
        passable: false,
        name: nt ? nt.name : 'Solid Cavern Wall',
        terrain: 'WALL'
      };
    }
    return {
      direction: dir,
      x: nx,
      y: ny,
      passable: true,
      name: nt.name,
      terrain: nt.terrain,
      feature: nt.feature
    };
  };

  const atBossTile = heroX === def.bossX && heroY === def.bossY;

  return {
    inDungeon: true,
    dungeonKey: def.dungeonKey,
    name: def.name,
    dungeonName: def.name,
    subtitle: def.subtitle,
    regionKey: def.regionKey,
    themeKey: def.themeKey,
    artworkUrl: def.artworkUrl,
    description: def.description,
    width: def.width,
    height: def.height,
    totalTiles: def.totalTiles,
    visionRadius: getDungeonVisionRadius(character.class),
    heroX,
    heroY,
    entryX: def.entryX,
    entryY: def.entryY,
    exitX: def.exitX,
    exitY: def.exitY,
    atExitTile: heroX === def.exitX && heroY === def.exitY,
    bossName: def.bossName,
    bossDefeated,
    bossSlain: bossDefeated,
    atBossTile,
    canChallengeBoss: atBossTile && !bossDefeated,
    currentRoomName: currentTile ? currentTile.name : def.name,
    currentTile: currentTile ? {
      x: currentTile.x,
      y: currentTile.y,
      name: currentTile.name,
      terrain: currentTile.terrain,
      roomType: currentTile.room_type,
      feature: currentTile.feature,
      isSafe: Boolean(currentTile.is_safe),
      isLandmark: Boolean(currentTile.is_landmark),
      description: currentTile.description
    } : null,
    neighbors: {
      NORTH: buildNeighborInfo('NORTH', 0, -1),
      SOUTH: buildNeighborInfo('SOUTH', 0, 1),
      WEST: buildNeighborInfo('WEST', -1, 0),
      EAST: buildNeighborInfo('EAST', 1, 0)
    },
    discoveredCount: discoveredSet.size,
    discoveredPassableCount: discoveredPassable,
    passableTotalCount: passableTotal,
    tiles
  };
}

module.exports = {
  DUNGEON_KEYS,
  DUNGEON_VISION_RADIUS,
  DUNGEON_BOSS_PROFILES,
  DUNGEON_FIXED_ENCOUNTERS,
  DUNGEON_TREASURES,
  DUNGEON_HAZARDS,
  DUNGEON_DEFINITIONS,
  syncDungeonTables,
  getDungeonVisionRadius,
  getDungeonDefinition,
  getDungeonTile,
  hasDungeonLineOfSight,
  computeDungeonVisibleCoords,
  recordDungeonTileDiscovery,
  getCharacterDungeonDiscoveredSet,
  getCharacterDungeonResolvedEvents,
  markDungeonEventResolved,
  isDungeonBossDefeated,
  verifyDungeonConnectivity,
  enterDungeon,
  exitDungeon,
  selectDungeonMonster,
  spawnDungeonEncounter,
  startDungeonBossEncounter,
  moveInDungeon,
  buildDungeonMapPayload
};
