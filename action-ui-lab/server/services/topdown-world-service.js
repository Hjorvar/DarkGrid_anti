/**
 * DARKGRID — Phase 8 Top-Down World Foundation, Discovery, Quests & Encounter Service
 *
 * Implements:
 *   - Cohesive 30×30 (900-tile) Oakhaven & Blackwood (Goblin) Forest world (`x = 0..29, y = 0..29`)
 *   - 3 distinct, interconnected routes from Oakhaven [15, 27] to Goblin Stronghold [15, 2]:
 *       A. Main Forest Trail (Central King's Road via Blackwood Crossroads [15, 23], Ancient Black Oak [15, 15], Goblin Hunting Grounds [15, 9])
 *       B. Western Wilderness Route (Around Stonefang Crag, through Broken Shrine [7, 17] and Old Charcoal Camp [6, 13])
 *       C. Eastern River Route (Across The Old Stone Bridge [19, 25], past Abandoned Watchpost [21, 25], Ravine East Overlook [22, 15], and Old Log Crossing [20, 9])
 *   - Authoritative SQLite persistence in `map_tiles`, `quest_definitions`, `character_quests`,
 *     `world_boss_definitions`, `character_discovered_tiles`, and `encounter_profiles`
 *   - Non-destructive startup & coordinate migration (`PHASE_8_30X30` in `game_config`)
 *   - Per-character tile & landmark discovery + Ranger scouting radius bonus (`4` vs `3`)
 *   - Persistent Goblin Stronghold boss (`Warchief Grak the Goblin Chieftain`) at [15, 2]
 *   - Balanced 80% / 15% / 5% Goblin Forest encounter selection and travel pacing
 */

const { withTransaction } = require('../../../src/db/connection');
const {
  calculateXpWithIntelligence,
  applyCharacterLevelUp
} = require('../../../src/domain/character/rules');
const {
  getTileById,
  getTileByCoords
} = require('../../../src/domain/world/map');
const {
  getEncounterById,
  investigateEncounter
} = require('../../../src/domain/encounters/engine');
const { startCombat } = require('../../../src/domain/combat/engine');

const TOPDOWN_WORLD_VERSION = 'PHASE_9B_WORLD_EXPANSION';

const TOPDOWN_REGION_BOUNDS = Object.freeze({
  minX: 0,
  maxX: 29,
  minY: 0,
  maxY: 29,
  width: 30,
  height: 30,
  cols: 30,
  rows: 30,
  totalTiles: 900
});

const TOWN_COORD = Object.freeze({ x: 15, y: 27 });
const NORTH_GATE_COORD = Object.freeze({ x: 15, y: 26 });
const STRONGHOLD_COORD = Object.freeze({ x: 15, y: 2 });
const GOBLIN_CAVE_COORD = Object.freeze({ x: 9, y: 12 });
const ANCIENT_CRYPT_COORD = Object.freeze({ x: 26, y: 5 });

const LANDMARK_DEFINITIONS = Object.freeze({
  OAKHAVEN: {
    key: 'OAKHAVEN',
    x: 15,
    y: 27,
    name: 'Oakhaven',
    category: 'TOWN',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'CITY',
    feature: 'MARKETPLACE',
    visualType: 'TOWN_SANCTUARY',
    visualKind: 'TOWN',
    isSafe: 1,
    alwaysKnown: true,
    description:
      'A fortified sanctuary town standing at the southern edge of Blackwood Forest. Watchfires burn warmly upon the timber walls, offering free rest, a market, and quests.'
  },
  NORTH_GATE: {
    key: 'NORTH_GATE',
    x: 15,
    y: 26,
    name: 'Oakhaven North Gate',
    category: 'GATE',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'PLAINS',
    feature: 'TOWN_GATES',
    visualType: 'TOWN_GATE_NORTH',
    visualKind: 'NORTH_GATE',
    isSafe: 1,
    alwaysKnown: true,
    description:
      'Outside the northern timber gate of Oakhaven. The ancient King’s Road winds north into the dark canopy of Blackwood Forest.'
  },
  SOUTHERN_CROSSROADS: {
    key: 'SOUTHERN_CROSSROADS',
    x: 15,
    y: 23,
    name: 'Blackwood Crossroads',
    category: 'CROSSROADS',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'FOREST',
    feature: 'FOREST_CROSSROADS',
    visualType: 'FOREST_CROSSROADS',
    visualKind: 'CROSSROADS',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'A weathered wooden signpost stands at the southern forest crossroads where the Western Wilderness trail branches off from the Main Forest Trail.'
  },
  OLD_STONE_BRIDGE: {
    key: 'OLD_STONE_BRIDGE',
    x: 19,
    y: 25,
    name: 'The Old Stone Bridge',
    category: 'BRIDGE',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'BRIDGE',
    feature: 'ANCIENT_BRIDGE',
    visualType: 'STONE_BRIDGE',
    visualKind: 'BRIDGE',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'An ancient mossy stone arch bridge spanning the churning black waters of the Blackwater River east of Oakhaven, linking Goblin Forest toward the Undead Lands.'
  },
  ABANDONED_WATCHPOST: {
    key: 'ABANDONED_WATCHPOST',
    x: 21,
    y: 25,
    name: 'Abandoned Watchpost',
    category: 'RUINS',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'SUNK_RUIN',
    visualType: 'WATCHPOST_RUIN',
    visualKind: 'WATCHPOST',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'Weathered stone watchpost ruins guarding the eastern bank beyond the Old Stone Bridge. North follows the river ravine; East crosses into the mist-shrouded Undead Lands.'
  },
  BROKEN_SHRINE: {
    key: 'BROKEN_SHRINE',
    x: 7,
    y: 17,
    name: 'The Broken Shrine',
    category: 'SHRINE',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'BROKEN_SHRINE',
    visualType: 'BROKEN_SHRINE',
    visualKind: 'SHRINE_RUIN',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'Toppled mossy pillars and a cracked altar stone stand in a silent western clearing, defaced by crude goblin ash-marks.'
  },
  CHARCOAL_CAMP: {
    key: 'CHARCOAL_CAMP',
    x: 6,
    y: 13,
    name: 'Old Charcoal Camp',
    category: 'CAMP',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'FOREST',
    feature: 'ABANDONED_CAMP',
    visualType: 'CAMP_CLEARING',
    visualKind: 'CAMP_RUIN',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'Cold ash-mounds and a collapsed timber kiln sit abandoned beneath the western pines where woodcutters once worked.'
  },
  GOBLIN_CAVE: {
    key: 'GOBLIN_CAVE',
    x: 9,
    y: 12,
    name: 'Goblin Cave',
    category: 'DUNGEON_ENTRANCE',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'GOBLIN_CAVE',
    visualType: 'GOBLIN_CAVE_ENTRANCE',
    visualKind: 'CAVE_ENTRANCE',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'A jagged cavern maw carved into the black granite of Whispering Crags. Flickering goblin torches, bone-totems, and chittering echoes mark the subterranean lair.'
  },
  ANCIENT_BLACK_OAK: {
    key: 'ANCIENT_BLACK_OAK',
    x: 15,
    y: 15,
    name: 'Ancient Black Oak',
    category: 'LANDMARK',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'FOREST',
    feature: 'ANCIENT_OAK',
    visualType: 'ANCIENT_OAK_LANDMARK',
    visualKind: 'ANCIENT_OAK',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'A colossal Primeval Black Oak stands at the very heart of Blackwood Forest, its gnarled bark oozing golden resin and scarred by goblin blades.'
  },
  EASTBANK_OVERLOOK: {
    key: 'EASTBANK_OVERLOOK',
    x: 22,
    y: 15,
    name: 'Ravine East Overlook',
    category: 'OVERLOOK',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'FOREST',
    feature: 'RAVINE_OVERLOOK',
    visualType: 'FOREST_CLEARING',
    visualKind: 'FOREST_CLEARING',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'A rocky shelf above the eastern rim of Blackwater Ravine where mist rises from the rapids below and a weathered causeway branches east into the Ashen Barrowlands.'
  },
  OLD_LOG_CROSSING: {
    key: 'OLD_LOG_CROSSING',
    x: 20,
    y: 9,
    name: 'Old Log Crossing',
    category: 'BRIDGE',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'FOREST',
    feature: 'LOG_CROSSING',
    visualType: 'LOG_BRIDGE_PATH',
    visualKind: 'LOG_BRIDGE',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'Massive felled ironwood trunks span the narrow upper gorge of Blackwater Stream, linking the eastern ravine trail to the Goblin Hunting Grounds.'
  },
  GOBLIN_HUNTING_GROUNDS: {
    key: 'GOBLIN_HUNTING_GROUNDS',
    x: 15,
    y: 9,
    name: 'Goblin Hunting Grounds',
    category: 'DANGER',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'FOREST',
    feature: 'GOBLIN_HUNTING_GROUNDS',
    visualType: 'GOBLIN_TOTEM_CLEARING',
    visualKind: 'TOTEM_CLEARING',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'Bone-totems, sharpened stakes, and trampled bracken mark the hunting grounds where Warchief Grak’s outriders ambush travelers.'
  },
  STRONGHOLD_APPROACH: {
    key: 'STRONGHOLD_APPROACH',
    x: 15,
    y: 3,
    name: 'Stronghold Approach',
    category: 'APPROACH',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'FOREST',
    feature: 'STRONGHOLD_APPROACH',
    visualType: 'STRONGHOLD_APPROACH',
    visualKind: 'FOREST_PATH',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'A rutted war-path choked with woodsmoke leading directly north to the timber gate and watchtower of the Goblin Stronghold.'
  },
  GOBLIN_STRONGHOLD: {
    key: 'GOBLIN_STRONGHOLD',
    x: 15,
    y: 2,
    name: 'Goblin Stronghold',
    category: 'STRONGHOLD',
    regionKey: 'BLACKWOOD_FOREST',
    terrain: 'FOREST',
    feature: 'GOBLIN_STRONGHOLD',
    visualType: 'STRONGHOLD_GATE',
    visualKind: 'STRONGHOLD_GATE',
    isSafe: 0,
    alwaysKnown: false,
    bossKey: 'WARCHIEF_GRAK',
    description:
      'The fortified timber gate and watchtower of the Goblin Stronghold. Torchlight flickers across tribal war-banners where Warchief Grak holds court.'
  },
  // ==========================================================================
  // PHASE 9B — UNDEAD LANDS LANDMARKS (Minor POIs + Ancient Crypt Major Scene)
  // ==========================================================================
  GALLOWS_CROSSROADS: {
    key: 'GALLOWS_CROSSROADS',
    x: 25,
    y: 23,
    name: 'Gallows Crossroads',
    category: 'CROSSROADS',
    regionKey: 'UNDEAD_LANDS',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'GALLOWS_CROSSROADS',
    visualType: 'UNDEAD_CROSSROADS',
    visualKind: 'UNDEAD_LANDMARK',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'A leaning iron gibbet and cracked stone obelisk stand where the Watchpost causeway enters the mist-choked Undead Lands and the Sepulcher Road turns north.'
  },
  DROWNED_OSSUARY: {
    key: 'DROWNED_OSSUARY',
    x: 26,
    y: 19,
    name: 'Drowned Ossuary',
    category: 'RUINS',
    regionKey: 'UNDEAD_LANDS',
    terrain: 'SWAMP',
    feature: 'DROWNED_OSSUARY',
    visualType: 'OSSUARY_RUIN',
    visualKind: 'UNDEAD_LANDMARK',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'Half-sunken marble colonnades and flooded bone-vaults jut from the black waters of Deadman’s Mire, lit by drifting pale corpse-candles.'
  },
  WEEPING_CAIRN: {
    key: 'WEEPING_CAIRN',
    x: 26,
    y: 15,
    name: 'The Weeping Barrow',
    category: 'BARROW',
    regionKey: 'UNDEAD_LANDS',
    terrain: 'HILLS',
    feature: 'WEEPING_CAIRN',
    visualType: 'BARROW_CAIRN',
    visualKind: 'UNDEAD_LANDMARK',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'A great slate-and-ash burial mound ringed by weathered standing monoliths at the center of the Ashen Barrowlands.'
  },
  BLIGHTED_CHAPEL: {
    key: 'BLIGHTED_CHAPEL',
    x: 26,
    y: 9,
    name: 'Blighted Chapel',
    category: 'SHRINE',
    regionKey: 'UNDEAD_LANDS',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'BLIGHTED_CHAPEL',
    visualType: 'CHAPEL_RUIN',
    visualKind: 'UNDEAD_LANDMARK',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'The roofless gothic nave and desecrated altar of a forgotten funerary chapel guarding the northern road to the Ancient Crypt.'
  },
  CRYPT_APPROACH: {
    key: 'CRYPT_APPROACH',
    x: 26,
    y: 6,
    name: 'Sepulcher Terrace',
    category: 'APPROACH',
    regionKey: 'UNDEAD_LANDS',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'CRYPT_APPROACH',
    visualType: 'CRYPT_APPROACH',
    visualKind: 'UNDEAD_PATH',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'Broad obsidian processional steps flanked by spectral green-flame braziers ascending directly to the sealed threshold of the Ancient Crypt.'
  },
  ANCIENT_CRYPT: {
    key: 'ANCIENT_CRYPT',
    x: 26,
    y: 5,
    name: 'Ancient Crypt',
    category: 'CRYPT',
    regionKey: 'UNDEAD_LANDS',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'ANCIENT_CRYPT',
    visualType: 'ANCIENT_CRYPT_GATE',
    visualKind: 'CRYPT_GATE',
    isSafe: 0,
    alwaysKnown: false,
    description:
      'A monumental gothic mausoleum of black obsidian and iron gates rising from the northern Necropolis. Necrotic mist coils around the catacomb threshold where the Barrow Kings slumber.'
  }
});

const QUEST_GOBLIN_CHIEFTAIN = Object.freeze({
  key: 'THE_GOBLIN_CHIEFTAIN',
  title: 'The Goblin Chieftain',
  giver: 'Captain Vane of Oakhaven Watch',
  regionKey: 'BLACKWOOD_FOREST',
  regionName: 'Blackwood Forest (Goblin Forest)',
  strongholdName: 'Goblin Stronghold',
  strongholdCoord: { x: STRONGHOLD_COORD.x, y: STRONGHOLD_COORD.y },
  description:
    'A goblin chieftain has taken control of an old stronghold deep within Blackwood Forest. Travelers are disappearing. Find the stronghold and defeat the chieftain.',
  rewardXpBase: 250,
  rewardGold: 100
});

const QUEST_STATUS_LABELS = Object.freeze({
  NOT_ACCEPTED: 'Not Accepted',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  REWARD_CLAIMED: 'Reward Claimed'
});

const STRONGHOLD_BOSS_PROFILE = Object.freeze({
  bossKey: 'WARCHIEF_GRAK',
  customTitle: 'Warchief Grak the Goblin Chieftain',
  preferredMonsterName: 'Hobgoblin',
  fallbackMonsterId: 12,
  maxHp: 14,
  heldGold: 45,
  combatImageSlug: 'goblin',
  combatImageUrl: '/images/monsters/goblin.png',
  entranceImageUrl: '/images/terrain/terrain_town_gates.webp',
  entranceTitle: 'The Goblin Stronghold of Blackwood',
  entranceDescription:
    'Sharpened timber palisades and a crude watchtower rise through the choking mist of northern Blackwood Forest. Iron braziers burn with foul pitch beside the spiked gate where the Goblin Chieftain holds court.'
});

// ============================================================================
// AUTHORITATIVE ROUTE & TOPOGRAPHY DEFINITIONS FOR THE 30×30 WORLD
// ============================================================================

const ROUTE_A_MAIN_TRAIL = Object.freeze([
  [15, 27], [15, 26], [15, 25], [15, 24], [15, 23],
  [15, 22], [15, 21], [14, 21], [14, 20], [14, 19], [14, 18], [15, 18],
  [15, 17], [15, 16], [15, 15],
  [15, 14], [15, 13], [16, 13], [16, 12], [16, 11], [15, 11],
  [15, 10], [15, 9],
  [15, 8], [15, 7], [14, 7], [14, 6], [14, 5], [15, 5],
  [15, 4], [15, 3], [15, 2]
]);

const ROUTE_B_WESTERN_WILDERNESS = Object.freeze([
  [15, 27], [15, 26], [15, 25], [15, 24], [15, 23],
  [14, 23], [13, 23], [12, 23], [11, 23], [10, 23], [9, 23],
  [9, 22], [8, 22], [8, 21], [8, 20], [7, 20], [7, 19], [7, 18], [7, 17],
  [7, 16], [7, 15], [6, 15], [6, 14], [6, 13], [6, 12],
  [7, 12], [7, 11], [8, 11], [8, 10], [8, 9], [9, 9],
  [9, 8], [9, 7], [10, 7], [10, 6], [11, 6], [11, 5],
  [12, 5], [12, 4], [13, 4], [13, 3], [14, 3], [15, 3], [15, 2]
]);

const ROUTE_C_EASTERN_RIVER = Object.freeze([
  [15, 27], [15, 26], [15, 25],
  [16, 25], [17, 25], [18, 25], [19, 25], [20, 25], [21, 25],
  [22, 25], [22, 24], [22, 23], [22, 22], [23, 22], [23, 21], [23, 20], [23, 19], [23, 18],
  [22, 18], [22, 17], [22, 16], [22, 15], [22, 14],
  [23, 14], [23, 13], [23, 12], [23, 11], [22, 11], [22, 10], [22, 9], [21, 9], [20, 9],
  [19, 9], [18, 9], [17, 9], [16, 9], [15, 9],
  [15, 8], [15, 7], [14, 7], [14, 6], [14, 5], [15, 5], [15, 4], [15, 3], [15, 2]
]);

const ROUTE_D_UNDEAD_SEPULCHER_ROAD = Object.freeze([
  [15, 27], [15, 26], [15, 25],
  [16, 25], [17, 25], [18, 25], [19, 25], [20, 25], [21, 25],
  [22, 25], [23, 25], [24, 25], [25, 25], [25, 24], [25, 23],
  [25, 22], [25, 21], [26, 21], [26, 20], [26, 19],
  [26, 18], [26, 17], [26, 16], [26, 15],
  [26, 14], [26, 13], [26, 12], [26, 11], [26, 10], [26, 9],
  [26, 8], [26, 7], [26, 6], [26, 5]
]);

const CONNECTOR_TRAILS = Object.freeze([
  // Westgate outer commons connector
  [14, 27], [14, 26], [13, 26], [12, 26], [12, 25], [12, 24], [12, 23],
  // Eastgate commons connector
  [16, 27], [17, 27], [17, 26], [17, 25],
  // Shrine-to-Ancient-Oak mid-forest cross trail
  [7, 15], [8, 15], [9, 15], [10, 15], [11, 15], [12, 15], [13, 15], [14, 15], [15, 15],
  // Goblin Cave spur trail (connects Route B [7,12], Goblin Cave [9,12], [9,9], and [9,15])
  [7, 12], [8, 12], [9, 12], [9, 11], [9, 10], [9, 9], [9, 13], [9, 14], [9, 15],
  // Oak-to-River-Bank outlook trail
  [15, 15], [16, 15], [17, 15], [18, 15],
  // Western trail to Hunting Grounds connector
  [9, 9], [10, 9], [11, 9], [12, 9], [13, 9], [14, 9], [15, 9],
  // Upper Eastern Smuggler Ridge & Upper Ford Stones [20, 4]
  [21, 9], [21, 8], [21, 7], [21, 6], [21, 5], [21, 4], [20, 4], [19, 4], [18, 4], [18, 3], [17, 3], [16, 3], [15, 3],
  // Undead Lands Mid-Barrow Causeway (Ravine East Overlook [22,15] -> Weeping Barrow [26,15])
  [22, 15], [23, 15], [24, 15], [25, 15], [26, 15],
  // Undead Lands Northern Ossuary Trail (Eastbank [22,9] -> Blighted Chapel [26,9])
  [22, 9], [23, 9], [24, 9], [25, 9], [26, 9],
  // Undead Lands Western Barrow Ridge Path
  [24, 23], [24, 22], [24, 21], [24, 20], [24, 19], [24, 18], [24, 17], [24, 16], [24, 15]
]);

function isTileCoordInUndeadLands(x, y) {
  return Number(x) >= 23 && Number(x) <= 29 && Number(y) >= 0 && Number(y) <= 26;
}

function buildPhase8RegionTiles() {
  const landmarkByCoord = new Map();
  for (const lm of Object.values(LANDMARK_DEFINITIONS)) {
    landmarkByCoord.set(`${lm.x},${lm.y}`, lm);
  }

  const trailSet = new Set();
  for (const list of [
    ROUTE_A_MAIN_TRAIL,
    ROUTE_B_WESTERN_WILDERNESS,
    ROUTE_C_EASTERN_RIVER,
    ROUTE_D_UNDEAD_SEPULCHER_ROAD,
    CONNECTOR_TRAILS
  ]) {
    for (const [x, y] of list) {
      trailSet.add(`${x},${y}`);
    }
  }

  // River tiles (Blackwater River runs y = 0..29, bending from x = 20 in the north to x = 19 in the south)
  const riverSet = new Set();
  for (let y = 0; y <= 29; y++) {
    if (y <= 13) {
      riverSet.add(`20,${y}`);
    } else if (y === 14) {
      riverSet.add('19,14');
      riverSet.add('20,14');
    } else {
      riverSet.add(`19,${y}`);
    }
  }
  // Remove river blockage at the 3 crossings: Old Stone Bridge [19,25], Old Log Crossing [20,9], Upper Ford Stones [20,4]
  riverSet.delete('19,25');
  riverSet.delete('20,9');
  riverSet.delete('20,4');

  // Impassable Rock Crags (Stonefang Crag, Whispering Crags & Tombstone Monoliths)
  const cragCoords = new Map([
    ['11,19', 'Stonefang Crag North-West'],
    ['12,19', 'Stonefang Crag North-East'],
    ['11,20', 'Stonefang Crag West Face'],
    ['12,20', 'Stonefang Crag Spire'],
    ['11,21', 'Stonefang Crag South-West'],
    ['12,21', 'Stonefang Crag South-East'],
    ['10,12', 'Whispering Crag West'],
    ['11,12', 'Whispering Crag East'],
    ['10,13', 'Whispering Crag Base'],
    ['11,13', 'Whispering Crag Ledge'],
    ['24,11', 'Obsidian Barrow Monolith'],
    ['24,12', 'Shattered Sepulcher Spire'],
    ['28,12', 'Jagged Tombstone Crag'],
    ['28,13', 'Weathered Mausoleum Cliff']
  ]);

  // Impassable Briar Thickets in Goblin Forest
  const thicketCoords = new Set([
    '3,7', '4,7', '3,8',
    '4,21', '4,22'
  ]);

  // Impassable Necrotic Blight Pools in Deadman's Mire (Undead Lands)
  const blightPoolCoords = new Set([
    '27,20', '28,20',
    '27,21', '28,21'
  ]);

  const tiles = [];

  for (let y = TOPDOWN_REGION_BOUNDS.minY; y <= TOPDOWN_REGION_BOUNDS.maxY; y++) {
    for (let x = TOPDOWN_REGION_BOUNDS.minX; x <= TOPDOWN_REGION_BOUNDS.maxX; x++) {
      const key = `${x},${y}`;
      const lm = landmarkByCoord.get(key) || null;
      const isOnTrail = trailSet.has(key);
      const inUndeadRegion = isTileCoordInUndeadLands(x, y);

      // Compute cardinal path connections for trail tiles
      const pathConnections = [];
      if (isOnTrail || lm) {
        if (trailSet.has(`${x},${y - 1}`)) pathConnections.push('N');
        if (trailSet.has(`${x + 1},${y}`)) pathConnections.push('E');
        if (trailSet.has(`${x},${y + 1}`)) pathConnections.push('S');
        if (trailSet.has(`${x - 1},${y}`)) pathConnections.push('W');
      }

      // 1. Explicit Landmarks
      if (lm) {
        const lmRegion = lm.regionKey || (inUndeadRegion ? 'UNDEAD_LANDS' : 'BLACKWOOD_FOREST');
        const lmBiome = lm.terrain === 'CITY'
          ? 'SANCTUARY'
          : (lmRegion === 'UNDEAD_LANDS'
            ? (y <= 7 ? 'NECROPOLIS_SANCTUM' : (y <= 16 ? 'ASHEN_BARROWLANDS' : 'DEADMANS_MIRE'))
            : 'BLACKWOOD_FOREST');
        tiles.push({
          x,
          y,
          name: lm.name,
          terrain: lm.terrain,
          feature: lm.feature,
          is_passable: 1,
          is_safe: lm.isSafe,
          region_key: lmRegion,
          biome: lmBiome,
          visualType: lm.visualType,
          visualKind: lm.visualKind,
          pathConnections,
          isLandmark: true,
          landmarkKey: lm.key,
          encounterProfileKey: lm.isSafe ? 'SAFE_NONE' : (lmRegion === 'UNDEAD_LANDS' ? 'UNDEAD_LANDS' : 'GOBLIN_FOREST'),
          bossKey: lm.bossKey || null,
          description: lm.description
        });
        continue;
      }

      // 2. Stronghold Flanking Palisades & Northern Bastion
      if (y === 2 && (x === 13 || x === 14)) {
        tiles.push({
          x,
          y,
          name: 'Western Stronghold Palisade',
          terrain: 'FOREST',
          feature: 'STRONGHOLD_PALISADE_WEST',
          is_passable: 0,
          is_safe: 0,
          region_key: 'BLACKWOOD_FOREST',
          biome: 'BLACKWOOD_FOREST',
          visualType: 'STRONGHOLD_WALL_WEST',
          visualKind: 'STRONGHOLD_WALL',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: 'Jagged timber stakes lashed with iron chain and banked against earthworks block passage west of the stronghold gate.'
        });
        continue;
      }
      if (y === 2 && (x === 16 || x === 17)) {
        tiles.push({
          x,
          y,
          name: 'Eastern Stronghold Watchtower',
          terrain: 'FOREST',
          feature: 'STRONGHOLD_PALISADE_EAST',
          is_passable: 0,
          is_safe: 0,
          region_key: 'BLACKWOOD_FOREST',
          biome: 'BLACKWOOD_FOREST',
          visualType: 'STRONGHOLD_WALL_EAST',
          visualKind: 'STRONGHOLD_WALL',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: 'A timber watchtower and sharpened log palisade sealing the eastern flank of the Goblin Stronghold.'
        });
        continue;
      }
      if (y === 1 && x >= 13 && x <= 17) {
        tiles.push({
          x,
          y,
          name: 'Stronghold Inner Bastion',
          terrain: 'FOREST',
          feature: 'STRONGHOLD_BASTION',
          is_passable: 0,
          is_safe: 0,
          region_key: 'BLACKWOOD_FOREST',
          biome: 'BLACKWOOD_FOREST',
          visualType: 'STRONGHOLD_WALL_WEST',
          visualKind: 'STRONGHOLD_WALL',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: 'The fortified inner stockade and war-drums of the Goblin Stronghold.'
        });
        continue;
      }

      // 2b. Ancient Crypt Flanking Catacomb Bastion in Northern Undead Lands ([25..27, 4] and [25, 5], [27, 5])
      if ((y === 4 && x >= 25 && x <= 27) || (y === 5 && (x === 25 || x === 27))) {
        tiles.push({
          x,
          y,
          name: y === 4 ? 'Ancient Crypt Inner Mausoleum' : 'Obsidian Crypt Retaining Wall',
          terrain: 'UNDERGROUND_RUINS',
          feature: 'CRYPT_BASTION',
          is_passable: 0,
          is_safe: 0,
          region_key: 'UNDEAD_LANDS',
          biome: 'NECROPOLIS_SANCTUM',
          visualType: 'CRYPT_WALL',
          visualKind: 'CRYPT_WALL',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: 'Towering black obsidian mausoleum walls and wrought-iron catacomb grilles sealing the inner burial vaults of the Barrow Kings.'
        });
        continue;
      }

      // 3. Blackwater River channel
      if (riverSet.has(key)) {
        tiles.push({
          x,
          y,
          name: y <= 12 ? 'Blackwater Upper Gorge' : (y <= 22 ? 'Blackwater Ravine' : 'Blackwater River'),
          terrain: 'RIVER_LAKE',
          feature: 'BLACKWATER_RAVINE',
          is_passable: 0,
          is_safe: 0,
          region_key: 'BLACKWOOD_FOREST',
          biome: 'BLACKWOOD_RIVER',
          visualType: 'RIVER_RAVINE',
          visualKind: 'RIVER',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: 'A deep, turbulent gorge of pitch-black water dividing Blackwood Forest from the eastern borderlands. Impassable without a bridge.'
        });
        continue;
      }

      // 4. Outer World Perimeter (`x=0`, `x=29`, `y=0`, `y=29`)
      if (x === 0 || x === 29 || y === 0 || y === 29) {
        const isUndeadBorder = inUndeadRegion;
        const isCliff = isUndeadBorder || (y >= 25) || (y === 0 && x >= 11 && x <= 19);
        tiles.push({
          x,
          y,
          name: isUndeadBorder ? 'Necropolis Chasm Escarpment' : (isCliff ? 'Frontier Escarpment' : 'Impassable Blackwood Bramble'),
          terrain: isCliff ? 'MOUNTAINS' : 'FOREST',
          feature: isCliff ? 'BORDER_CLIFF' : 'IMPASSABLE_THICKET',
          is_passable: 0,
          is_safe: 0,
          region_key: isUndeadBorder ? 'UNDEAD_LANDS' : 'BLACKWOOD_FOREST',
          biome: isUndeadBorder ? 'UNDEAD_BORDER' : 'BLACKWOOD_BORDER',
          visualType: isCliff ? 'ROCK_CRAG' : 'THICKET_BLOCK',
          visualKind: isCliff ? 'MOUNTAIN_CRAG' : 'DENSE_WOODS',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: isUndeadBorder
            ? 'Jagged slate cliffs and abyssal fissures sealing the outer boundary of the Undead Lands.'
            : (isCliff
              ? 'Sheer frontier cliffs sealing the outer boundary of the valley.'
              : 'An impenetrable wall of primeval ironwood and razor-sharp blackbriar.')
        });
        continue;
      }

      // 5. Southern Frontier & Oakhaven Defensive Perimeter (`y = 28` and Oakhaven flanking walls on `y = 27`)
      if (y === 28 || (y === 27 && ((x >= 11 && x <= 13) || x === 18 || x >= 22 || x <= 8))) {
        const isTownWall = y === 28 && x >= 12 && x <= 18;
        tiles.push({
          x,
          y,
          name: isTownWall ? 'Oakhaven South Palisade' : 'Southern Frontier Bluff',
          terrain: 'MOUNTAINS',
          feature: isTownWall ? 'TOWN_PALISADE' : 'SOUTH_BLUFF',
          is_passable: 0,
          is_safe: 0,
          region_key: 'BLACKWOOD_FOREST',
          biome: 'OAKHAVEN_OUTSKIRTS',
          visualType: isTownWall ? 'TOWN_WALL' : 'ROCK_CRAG',
          visualKind: isTownWall ? 'TOWN_WALL' : 'MOUNTAIN_CRAG',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: isTownWall
            ? 'Sturdy oak logs and watch-parapets shielding Oakhaven Sanctuary.'
            : 'Steep rocky bluffs anchoring the southern defensive perimeter of Oakhaven.'
        });
        continue;
      }

      // 6. Named Interior Crags (Stonefang Crag, Whispering Crags & Undead Monoliths)
      if (cragCoords.has(key)) {
        const cragName = cragCoords.get(key);
        tiles.push({
          x,
          y,
          name: cragName,
          terrain: 'MOUNTAINS',
          feature: inUndeadRegion ? 'BARROW_MONOLITH' : 'STONEFANG_CRAG',
          is_passable: 0,
          is_safe: 0,
          region_key: inUndeadRegion ? 'UNDEAD_LANDS' : 'BLACKWOOD_FOREST',
          biome: inUndeadRegion ? 'ASHEN_BARROWLANDS' : 'BLACKWOOD_HIGHLANDS',
          visualType: 'ROCK_CRAG',
          visualKind: 'MOUNTAIN_CRAG',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: inUndeadRegion
            ? 'Shattered black-slate monoliths and collapsed tomb masonry blocking direct passage.'
            : 'A sheer wall of jagged black granite rising abruptly from the forest floor, blocking direct passage.'
        });
        continue;
      }

      // 7. Interior Briar Thickets (Goblin Forest) & Necrotic Blight Pools (Undead Lands)
      if (thicketCoords.has(key)) {
        tiles.push({
          x,
          y,
          name: 'Thornbriar Thicket',
          terrain: 'FOREST',
          feature: 'IMPASSABLE_THICKET',
          is_passable: 0,
          is_safe: 0,
          region_key: 'BLACKWOOD_FOREST',
          biome: 'BLACKWOOD_FOREST',
          visualType: 'THICKET_BLOCK',
          visualKind: 'DENSE_WOODS',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: 'An impenetrable knot of deadfall and razor-sharp blackbriar.'
        });
        continue;
      }

      if (blightPoolCoords.has(key)) {
        tiles.push({
          x,
          y,
          name: 'Necrotic Blight Pool',
          terrain: 'SWAMP',
          feature: 'BLIGHT_POOL',
          is_passable: 0,
          is_safe: 0,
          region_key: 'UNDEAD_LANDS',
          biome: 'DEADMANS_MIRE',
          visualType: 'BLIGHT_POOL',
          visualKind: 'BLIGHT_POOL',
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'SAFE_NONE',
          bossKey: null,
          description: 'A bottomless sinkhole of stagnant, corpse-pale mire water exhaling noxious vapors.'
        });
        continue;
      }

      // 8. Upper Ford Stones [20, 4] (Passable stepping-stone crossing on the upper river)
      if (x === 20 && y === 4) {
        tiles.push({
          x,
          y,
          name: 'Upper Ford Stones',
          terrain: 'BRIDGE',
          feature: 'RIVER_FORD',
          is_passable: 1,
          is_safe: 0,
          region_key: 'BLACKWOOD_FOREST',
          biome: 'BLACKWOOD_RIVER',
          visualType: 'LOG_BRIDGE_PATH',
          visualKind: 'LOG_BRIDGE',
          pathConnections,
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'GOBLIN_FOREST',
          bossKey: null,
          description: 'Flat granite stepping-stones and wedged timber beams allow careful passage across the upper Blackwater rapids.'
        });
        continue;
      }

      // 9. Passable Trail Tiles (Goblin Forest Trails vs Undead Lands Sepulcher Roads)
      if (isOnTrail) {
        if (inUndeadRegion) {
          const isNecropolis = y <= 8;
          const isMire = y >= 18;
          const undeadTrailName = isNecropolis
            ? 'Necropolis Processional'
            : (isMire ? 'Deadman’s Causeway' : 'The Sepulcher Road');
          const undeadTrailDesc = isNecropolis
            ? 'Cracked obsidian flagstones and cold iron funerary lanterns line the processional way toward the Ancient Crypt.'
            : (isMire
              ? 'Sunken stone slabs raised above the black waters of Deadman’s Mire, shrouded in drifting grave-mist.'
              : 'An ancient funerary road of pale weathered flagstones winding between bone-white cairns and silent barrow mounds.');

          tiles.push({
            x,
            y,
            name: undeadTrailName,
            terrain: isMire ? 'SWAMP' : 'UNDERGROUND_RUINS',
            feature: 'SEPULCHER_ROAD',
            is_passable: 1,
            is_safe: 0,
            region_key: 'UNDEAD_LANDS',
            biome: isNecropolis ? 'NECROPOLIS_SANCTUM' : (isMire ? 'DEADMANS_MIRE' : 'ASHEN_BARROWLANDS'),
            visualType: 'UNDEAD_TRAIL',
            visualKind: 'UNDEAD_PATH',
            pathConnections,
            isLandmark: false,
            landmarkKey: null,
            encounterProfileKey: 'UNDEAD_LANDS',
            bossKey: null,
            description: undeadTrailDesc
          });
          continue;
        }

        const isSouthernOutskirts = y >= 25 && x >= 12 && x <= 18;
        const isCaveApproachTrail = (x >= 7 && x <= 9 && y >= 10 && y <= 14);
        let trailName = 'Blackwood Forest Trail';
        let trailDesc = 'A winding needle-strewn woodland path threading beneath ancient oaks and dark pines.';
        if (isCaveApproachTrail) {
          trailName = 'Whispering Crag Cave Path';
          trailDesc = 'A narrow rocky track strewn with gnawed bones and goblin soot leading toward the Goblin Cave in Whispering Crags.';
        } else if (x >= 13 && x <= 16 && y >= 4 && y <= 25) {
          trailName = y >= 18 ? 'King’s Road South' : (y >= 10 ? 'Heartwood Central Trail' : 'Northern War-Trail');
          trailDesc = 'The ancient road from Oakhaven winds deeper into Blackwood Forest, hemmed in by towering timber and drifting mist.';
        } else if (x <= 12) {
          trailName = y >= 18 ? 'Westwood Crag Trail' : (y >= 11 ? 'Shrine Wilderness Path' : 'Western Pine Ridge');
          trailDesc = 'An irregular wilderness track winding past mossy boulders, gnarled roots, and silent ruins.';
        } else if (x >= 18) {
          trailName = y >= 16 ? 'Eastbank River Trail' : 'Upper Ravine Path';
          trailDesc = 'A narrow path following the misty eastern rim of Blackwater Ravine northward.';
        }

        tiles.push({
          x,
          y,
          name: trailName,
          terrain: isSouthernOutskirts ? 'PLAINS' : 'FOREST',
          feature: isCaveApproachTrail ? 'CAVE_APPROACH_TRAIL' : 'FOREST_TRAIL',
          is_passable: 1,
          is_safe: 0,
          region_key: 'BLACKWOOD_FOREST',
          biome: isSouthernOutskirts ? 'OAKHAVEN_OUTSKIRTS' : 'BLACKWOOD_FOREST',
          visualType: isSouthernOutskirts ? 'TOWN_OUTSKIRTS' : 'FOREST_PATH',
          visualKind: 'FOREST_PATH',
          pathConnections,
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'GOBLIN_FOREST',
          bossKey: null,
          description: trailDesc
        });
        continue;
      }

      // 10. Off-Trail Passable Wilderness (Undead Lands vs Goblin Forest)
      if (inUndeadRegion) {
        const isNecropolis = y <= 7;
        const isMire = y >= 17;
        const isCairnClearing = ((x * 5 + y * 11) % 7 === 0);
        const undeadTerrain = isNecropolis ? 'UNDERGROUND_RUINS' : (isMire ? 'SWAMP' : 'HILLS');
        const undeadBiome = isNecropolis ? 'NECROPOLIS_SANCTUM' : (isMire ? 'DEADMANS_MIRE' : 'ASHEN_BARROWLANDS');
        const undeadVisualType = isNecropolis
          ? 'CRYPT_PRECINCT'
          : (isMire ? 'NECROTIC_MIRE' : 'ASHEN_MOUND');
        const undeadVisualKind = isMire ? 'UNDEAD_MIRE' : 'UNDEAD_BARROWS';
        const undeadTileName = isNecropolis
          ? (isCairnClearing ? 'Shattered Sarcophagus Court' : 'Obsidian Grave Terrace')
          : (isMire
            ? (isCairnClearing ? 'Corpse-Candle Hollow' : 'Deadman’s Mire')
            : (isCairnClearing ? 'Bone-Cairn Hollow' : 'Ashen Burial Mounds'));
        const undeadTileDesc = isNecropolis
          ? 'Cracked marble tombs, leafless dead trees, and cold emerald-violet mist surrounding the Ancient Crypt.'
          : (isMire
            ? 'Sunken graves, stagnant black water, and skeletal willow roots where the restless dead stir beneath the mire.'
            : 'Wind-scoured grey ash, tilted headstones, and ancient barrow mounds where skeletal sentries prowl.');

        tiles.push({
          x,
          y,
          name: undeadTileName,
          terrain: undeadTerrain,
          feature: isNecropolis ? 'NECROPOLIS_GROUNDS' : (isMire ? 'DEADMANS_MIRE' : 'BARROW_MOUND'),
          is_passable: 1,
          is_safe: 0,
          region_key: 'UNDEAD_LANDS',
          biome: undeadBiome,
          visualType: undeadVisualType,
          visualKind: undeadVisualKind,
          pathConnections: [],
          isLandmark: false,
          landmarkKey: null,
          encounterProfileKey: 'UNDEAD_LANDS',
          bossKey: null,
          description: undeadTileDesc
        });
        continue;
      }

      const isNearTown = y >= 25 && x >= 9 && x <= 21;
      const isClearing = ((x * 7 + y * 13) % 9 === 0);
      const terrain = isNearTown ? 'PLAINS' : (x <= 4 && y >= 20 ? 'HILLS' : 'FOREST');
      const visualType = isNearTown ? 'FOREST_EDGE' : (isClearing ? 'FOREST_CLEARING' : 'DEEP_FOREST');
      const visualKind = isClearing || isNearTown ? 'FOREST_CLEARING' : 'DENSE_WOODS';
      const gladeName = isNearTown
        ? 'Oakhaven Outer Eaves'
        : (x < 11
          ? (isClearing ? 'Mossy Western Glade' : 'Western Blackwood Pines')
          : (x > 20
            ? (isClearing ? 'Fern-Choked Hollow' : 'Eastern Ravine Woods')
            : (y <= 7 ? 'Deep Northern Canopy' : 'Shadowed Blackwood Boughs')));

      tiles.push({
        x,
        y,
        name: gladeName,
        terrain,
        feature: null,
        is_passable: 1,
        is_safe: 0,
        region_key: 'BLACKWOOD_FOREST',
        biome: isNearTown ? 'OAKHAVEN_OUTSKIRTS' : 'BLACKWOOD_FOREST',
        visualType,
        visualKind,
        pathConnections: [],
        isLandmark: false,
        landmarkKey: null,
        encounterProfileKey: 'GOBLIN_FOREST',
        bossKey: null,
        description: isNearTown
          ? 'Tall frontier grass and felled stumps where Oakhaven’s watch-clearings meet the dark boughs of Blackwood Forest.'
          : 'Dense canopy shadow, mossy roots, and drifting ribbons of silver mist.'
      });
    }
  }

  return Object.freeze(tiles);
}

const TOPDOWN_REGION_TILES = buildPhase8RegionTiles();

const TILE_META_BY_COORD = new Map(
  TOPDOWN_REGION_TILES.map((t) => [`${t.x},${t.y}`, t])
);

function isCoordInTopdownRegion(x, y) {
  return (
    Number(x) >= TOPDOWN_REGION_BOUNDS.minX &&
    Number(x) <= TOPDOWN_REGION_BOUNDS.maxX &&
    Number(y) >= TOPDOWN_REGION_BOUNDS.minY &&
    Number(y) <= TOPDOWN_REGION_BOUNDS.maxY
  );
}

function isGoblinStrongholdTile(tile) {
  if (!tile) return false;
  return (
    (Number(tile.x) === STRONGHOLD_COORD.x && Number(tile.y) === STRONGHOLD_COORD.y) ||
    tile.feature === 'GOBLIN_STRONGHOLD' ||
    tile.landmark_key === 'GOBLIN_STRONGHOLD' ||
    tile.landmarkKey === 'GOBLIN_STRONGHOLD'
  );
}

function isGoblinCaveTile(tile) {
  if (!tile) return false;
  return (
    (Number(tile.x) === GOBLIN_CAVE_COORD.x && Number(tile.y) === GOBLIN_CAVE_COORD.y) ||
    tile.feature === 'GOBLIN_CAVE' ||
    tile.landmark_key === 'GOBLIN_CAVE' ||
    tile.landmarkKey === 'GOBLIN_CAVE'
  );
}

function isAncientCryptTile(tile) {
  if (!tile) return false;
  return (
    (Number(tile.x) === ANCIENT_CRYPT_COORD.x && Number(tile.y) === ANCIENT_CRYPT_COORD.y) ||
    tile.feature === 'ANCIENT_CRYPT' ||
    tile.landmark_key === 'ANCIENT_CRYPT' ||
    tile.landmarkKey === 'ANCIENT_CRYPT'
  );
}

function isMajorLandmarkTile(tile) {
  if (!tile) return false;
  return (
    (Number(tile.x) === TOWN_COORD.x && Number(tile.y) === TOWN_COORD.y) ||
    (tile.terrain === 'CITY' && Number(tile.is_safe) === 1) ||
    isGoblinStrongholdTile(tile) ||
    isGoblinCaveTile(tile) ||
    isAncientCryptTile(tile)
  );
}

/**
 * Returns the hero's exploration discovery radius on the 30×30 map.
 * Connects Ranger's scouting/visibility class identity directly to exploration (`4` vs `3`).
 */
function getHeroVisionRadius(character) {
  const cls = String((character && character.class) || '').toUpperCase();
  return cls === 'RANGER' ? 4 : 3;
}

/**
 * Records discovered tiles around `(centerX, centerY)` for `characterOrId` in `character_discovered_tiles`.
 */
function recordTileDiscovery(db, characterOrId, centerX = null, centerY = null) {
  if (!db || !characterOrId) return;
  const charRow = typeof characterOrId === 'object' && characterOrId.id
    ? characterOrId
    : db.prepare('SELECT id, class, tile_id FROM characters WHERE id = ?').get(Number(characterOrId));
  if (!charRow || !charRow.id) return;

  let cx = centerX !== null && centerX !== undefined ? Number(centerX) : null;
  let cy = centerY !== null && centerY !== undefined ? Number(centerY) : null;
  if (cx === null || cy === null || Number.isNaN(cx) || Number.isNaN(cy)) {
    const t = charRow.tile_id ? getTileById(db, charRow.tile_id) : null;
    cx = t ? Number(t.x) : TOWN_COORD.x;
    cy = t ? Number(t.y) : TOWN_COORD.y;
  }

  const radius = getHeroVisionRadius(charRow);
  const maxDistSq = radius * radius + 1;

  try {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO character_discovered_tiles (character_id, x, y)
      VALUES (?, ?, ?)
    `);

    // Always ensure Oakhaven and North Gate are known
    insertStmt.run(charRow.id, TOWN_COORD.x, TOWN_COORD.y);
    insertStmt.run(charRow.id, NORTH_GATE_COORD.x, NORTH_GATE_COORD.y);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > maxDistSq) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (isCoordInTopdownRegion(tx, ty)) {
          insertStmt.run(charRow.id, tx, ty);
        }
      }
    }
  } catch {
    // Graceful no-op if migration 016 table is not yet present
  }
}

function getDiscoveredCoordSet(db, characterId) {
  const set = new Set([
    `${TOWN_COORD.x},${TOWN_COORD.y}`,
    `${NORTH_GATE_COORD.x},${NORTH_GATE_COORD.y}`
  ]);
  if (!db || !characterId) return set;
  try {
    const rows = db.prepare(`
      SELECT x, y FROM character_discovered_tiles
      WHERE character_id = ?
    `).all(Number(characterId));
    for (const r of rows) {
      set.add(`${r.x},${r.y}`);
    }
  } catch {
    // Graceful fallback
  }
  return set;
}

/**
 * Maps legacy 8×7 (or 15×15) coordinates to the new 30×30 Goblin Forest world
 * so existing characters are preserved safely without losing their progress.
 */
function mapLegacyCoordToPhase8(oldX, oldY) {
  const key = `${oldX},${oldY}`;
  const exactMap = {
    '7,7': { x: 15, y: 27 }, // Oakhaven
    '7,6': { x: 15, y: 26 }, // Oakhaven North Gate
    '8,7': { x: 19, y: 25 }, // The Old Stone Bridge
    '9,7': { x: 21, y: 25 }, // Abandoned Watchpost
    '7,5': { x: 15, y: 23 }, // Blackwood Crossroads
    '7,4': { x: 15, y: 19 }, // Central Trail
    '7,3': { x: 15, y: 15 }, // Ancient Black Oak
    '9,3': { x: 20, y: 9 },  // Old Log Crossing
    '7,2': { x: 15, y: 3 },  // Stronghold Approach
    '7,1': { x: 15, y: 2 }   // Goblin Stronghold
  };
  if (exactMap[key]) return exactMap[key];

  // If already in 30x30 passable tile, keep or snap to Oakhaven
  const meta = TILE_META_BY_COORD.get(key);
  if (meta && meta.is_passable === 1) {
    return { x: Number(oldX), y: Number(oldY) };
  }
  return { x: TOWN_COORD.x, y: TOWN_COORD.y };
}

/**
 * Ensures Phase 8 lookup tables (`quest_definitions`, `world_boss_definitions`, `encounter_profiles`)
 * are populated idempotently.
 */
function ensurePhase8DefinitionsSeeded(db) {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO quest_definitions (
        quest_key, title, giver, region_key, region_name, description,
        objectives_json, reward_xp_base, reward_gold,
        target_landmark_key, target_boss_key, target_x, target_y, is_active
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        'GOBLIN_STRONGHOLD', 'WARCHIEF_GRAK', ?, ?, 1
      )
    `).run(
      QUEST_GOBLIN_CHIEFTAIN.key,
      QUEST_GOBLIN_CHIEFTAIN.title,
      QUEST_GOBLIN_CHIEFTAIN.giver,
      QUEST_GOBLIN_CHIEFTAIN.regionKey,
      QUEST_GOBLIN_CHIEFTAIN.regionName,
      QUEST_GOBLIN_CHIEFTAIN.description,
      JSON.stringify([
        {
          key: 'DEFEAT_GOBLIN_CHIEFTAIN',
          type: 'BOSS_KILL',
          targetBossKey: 'WARCHIEF_GRAK',
          targetLandmarkKey: 'GOBLIN_STRONGHOLD',
          description: 'Find the Goblin Stronghold in northern Blackwood Forest and defeat Warchief Grak.'
        },
        {
          key: 'RETURN_TO_OAKHAVEN',
          type: 'RETURN_TO_TOWN',
          targetLandmarkKey: 'OAKHAVEN',
          description: 'Return to Captain Vane in Oakhaven Sanctuary to claim your reward.'
        }
      ]),
      QUEST_GOBLIN_CHIEFTAIN.rewardXpBase,
      QUEST_GOBLIN_CHIEFTAIN.rewardGold,
      STRONGHOLD_COORD.x,
      STRONGHOLD_COORD.y
    );

    db.prepare(`
      INSERT OR IGNORE INTO world_boss_definitions (
        boss_key, custom_title, region_key, landmark_key, spawn_x, spawn_y,
        preferred_monster_name, fallback_monster_id, max_hp, held_gold,
        combat_image_slug, entrance_image_url, entrance_title, entrance_description
      ) VALUES (?, ?, 'BLACKWOOD_FOREST', 'GOBLIN_STRONGHOLD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      STRONGHOLD_BOSS_PROFILE.bossKey,
      STRONGHOLD_BOSS_PROFILE.customTitle,
      STRONGHOLD_COORD.x,
      STRONGHOLD_COORD.y,
      STRONGHOLD_BOSS_PROFILE.preferredMonsterName,
      STRONGHOLD_BOSS_PROFILE.fallbackMonsterId,
      STRONGHOLD_BOSS_PROFILE.maxHp,
      STRONGHOLD_BOSS_PROFILE.heldGold,
      STRONGHOLD_BOSS_PROFILE.combatImageSlug,
      STRONGHOLD_BOSS_PROFILE.entranceImageUrl,
      STRONGHOLD_BOSS_PROFILE.entranceTitle,
      STRONGHOLD_BOSS_PROFILE.entranceDescription
    );
  } catch {
    // Ignore if tables not yet migrated
  }
}

/**
 * Applies the 30×30 (900-tile) Phase 8 Goblin Forest world to `map_tiles`
 * and migrates existing characters/quests/boss state safely.
 *
 * CRITICAL RESTART GUARANTEE (Section 6):
 * Once `game_config('topdown_world_version') === 'PHASE_8_30X30'` is recorded and all 900 tiles exist,
 * subsequent calls on server restart do NOT overwrite `map_tiles`, character positions, boss status,
 * or quest progress unless `options.forceRebuild === true`.
 */
const DANGER_ZONE_PROFILES = Object.freeze({
  OAKHAVEN_SAFE: {
    zoneKey: 'OAKHAVEN_SAFE',
    zoneName: 'Oakhaven',
    dangerLevel: 'NONE',
    dangerLabel: 'None',
    encounterRate: 0.0,
    ambushShare: 0.0,
    minStepsBetweenCombats: 0,
    streakDampeningPerEvent: 0.0,
    monsterPool: [],
    description: 'The fortified sanctuary of Oakhaven. No monsters prowl within the palisade.'
  },
  GOBLIN_FOREST_ROAD: {
    zoneKey: 'GOBLIN_FOREST_ROAD',
    zoneName: 'Main Road in Goblin Forest',
    dangerLevel: 'MEDIUM',
    dangerLabel: 'Medium',
    encounterRate: 0.18,
    ambushShare: 0.28,
    minStepsBetweenCombats: 1,
    streakDampeningPerEvent: 0.07,
    monsterPool: ['Goblin', 'Hobgoblin', 'Dire Rat', 'Wolf', 'Viper'],
    description: 'Patrolled woodland roads and bridges threading through Blackwood Forest. Moderate risk of goblin scouts and predators.'
  },
  GOBLIN_FOREST_OFF_ROAD: {
    zoneKey: 'GOBLIN_FOREST_OFF_ROAD',
    zoneName: 'Off-Road Forest',
    dangerLevel: 'HIGH',
    dangerLabel: 'High',
    encounterRate: 0.24,
    ambushShare: 0.38,
    minStepsBetweenCombats: 1,
    streakDampeningPerEvent: 0.08,
    monsterPool: ['Goblin', 'Hobgoblin', 'Wolf', 'Giant Spider', 'Stirge', 'Mite', 'Vegepygmy'],
    description: 'Shadowed off-trail woodland and tangled undergrowth where lurking predators and goblin stalkers set traps.'
  },
  GOBLIN_HUNTING_GROUNDS: {
    zoneKey: 'GOBLIN_HUNTING_GROUNDS',
    zoneName: 'Goblin Hunting Grounds',
    dangerLevel: 'VERY_HIGH',
    dangerLabel: 'Very High',
    encounterRate: 0.32,
    ambushShare: 0.45,
    minStepsBetweenCombats: 1,
    streakDampeningPerEvent: 0.08,
    monsterPool: ['Goblin', 'Hobgoblin', 'Bugbear', 'Worg', 'Wolf'],
    description: 'Bone-strewn hunting grounds patrolled by goblin packs and worg riders.'
  },
  STRONGHOLD_APPROACH: {
    zoneKey: 'STRONGHOLD_APPROACH',
    zoneName: 'Near Goblin Stronghold',
    dangerLevel: 'VERY_HIGH',
    dangerLabel: 'Very High',
    encounterRate: 0.34,
    ambushShare: 0.48,
    minStepsBetweenCombats: 1,
    streakDampeningPerEvent: 0.08,
    monsterPool: ['Goblin', 'Hobgoblin', 'Bugbear', 'Worg', 'Hobgoblin Captain'],
    description: 'The heavily guarded northern perimeter surrounding the Goblin Stronghold. Sentry ambushes are frequent.'
  },
  GOBLIN_CAVE_APPROACH: {
    zoneKey: 'GOBLIN_CAVE_APPROACH',
    zoneName: 'Goblin Cave Approach',
    dangerLevel: 'VERY_HIGH',
    dangerLabel: 'Very High',
    encounterRate: 0.30,
    ambushShare: 0.46,
    minStepsBetweenCombats: 1,
    streakDampeningPerEvent: 0.08,
    monsterPool: ['Goblin', 'Hobgoblin', 'Bugbear', 'Giant Spider', 'Stirge', 'Mite'],
    description: 'Craggy ravines and bone-totem ledges leading to the Goblin Cave mouth. Cave lookouts and subterranean vermin lurk in the clefts.'
  },
  UNDEAD_BARROW_ROAD: {
    zoneKey: 'UNDEAD_BARROW_ROAD',
    zoneName: 'Sepulcher Road in Undead Lands',
    dangerLevel: 'HIGH',
    dangerLabel: 'High',
    encounterRate: 0.24,
    ambushShare: 0.36,
    minStepsBetweenCombats: 1,
    streakDampeningPerEvent: 0.07,
    monsterPool: ['Skeleton', 'Zombie', 'Ghoul', 'Crawling Claw', 'Shadow'],
    description: 'Cracked flagstone causeways and burial roads winding through the Undead Lands. Restless dead march along the old procession stones.'
  },
  UNDEAD_MIRE_OFF_ROAD: {
    zoneKey: 'UNDEAD_MIRE_OFF_ROAD',
    zoneName: 'Ashen Barrows & Deadman’s Mire',
    dangerLevel: 'VERY_HIGH',
    dangerLabel: 'Very High',
    encounterRate: 0.30,
    ambushShare: 0.45,
    minStepsBetweenCombats: 1,
    streakDampeningPerEvent: 0.08,
    monsterPool: ['Skeleton', 'Zombie', 'Ghoul', 'Shadow', 'Wight', 'Will-o-Wisp', 'Crawling Claw'],
    description: 'Grave-choked mires and collapsed burial mounds off the road where drowned corpses and shadows lunge from the necrotic fog.'
  },
  CRYPT_SEPULCHER_APPROACH: {
    zoneKey: 'CRYPT_SEPULCHER_APPROACH',
    zoneName: 'Near the Ancient Crypt',
    dangerLevel: 'EXTREME',
    dangerLabel: 'Extreme',
    encounterRate: 0.36,
    ambushShare: 0.50,
    minStepsBetweenCombats: 1,
    streakDampeningPerEvent: 0.08,
    monsterPool: ['Skeleton', 'Ghoul', 'Shadow', 'Wight', 'Wraith', 'Specter'],
    description: 'The cursed Necropolis Sanctum surrounding the Ancient Crypt. Elite Barrow-Wights and incorporeal horrors guard the sepulcher steps.'
  }
});

const LANDMARK_SCENE_DEFINITIONS = Object.freeze({
  OAKHAVEN: {
    sceneKey: 'OAKHAVEN',
    landmarkType: 'CITY',
    category: 'CITY',
    title: 'Oakhaven Sanctuary',
    subtitle: 'Fortified Frontier Settlement',
    description: 'Lantern light glows warm against the timber palisades of Oakhaven. Weary travellers mend their wounds at the hearth, trade steel and elixirs at the quartermaster’s stalls, and gather around the watch-board for news of the northern woods.',
    artworkUrl: '/images/terrain/terrain_city_oakhaven.webp',
    isMajorLandmark: true,
    autoOpenOnArrival: true,
    actions: [
      { key: 'REST_HEAL', label: 'Rest / Heal', action: 'REST', style: 'primary' },
      { key: 'OPEN_SHOP', label: 'Shop', modal: 'SHOP', style: 'secondary' },
      { key: 'OPEN_QUESTS', label: 'Quests & Bounties', modal: 'BOUNTY', style: 'secondary' },
      { key: 'CONTINUE_EXPLORING', label: 'Continue Exploring', action: 'DISMISS_LANDMARK_SCENE', style: 'ghost' }
    ]
  },
  GOBLIN_STRONGHOLD: {
    sceneKey: 'GOBLIN_STRONGHOLD',
    landmarkType: 'BOSS_AREA',
    category: 'BOSS_AREA',
    title: 'Goblin Stronghold',
    subtitle: 'Northern War-Stockade of Warchief Grak',
    description: 'Sharpened timber stakes, skull-totems, and iron-bound war gates loom out of the northern mist. War-drums echo from within the stockade where Warchief Grak commands the Goblin Forest.',
    artworkUrl: '/images/terrain/terrain_town_gates.webp',
    isMajorLandmark: true,
    autoOpenOnArrival: true,
    actions: [
      { key: 'CHALLENGE_CHIEFTAIN', label: 'Challenge the Goblin Chieftain', action: 'ENGAGE_STRONGHOLD_BOSS', style: 'danger' },
      { key: 'CONTINUE_EXPLORING', label: 'Continue Exploring', action: 'DISMISS_LANDMARK_SCENE', style: 'ghost' }
    ]
  },
  GOBLIN_CAVE: {
    sceneKey: 'GOBLIN_CAVE',
    landmarkType: 'DUNGEON_ENTRANCE',
    category: 'DUNGEON_ENTRANCE',
    title: 'The Goblin Cave',
    subtitle: 'Subterranean Lair of the Whispering Crags',
    description: 'A jagged limestone maw yawns beneath the western cliffs, flanked by crude bone-totems, guttering pitch-torches, and gnawed shields. Chittering voices, clattering iron, and the dank stench of subterranean dens echo up from the dark warrens below.',
    artworkUrl: '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
    isMajorLandmark: true,
    autoOpenOnArrival: true,
    actions: [
      { key: 'DELVE_GOBLIN_CAVE', label: 'Delve into the Cave Mouth', action: 'EXPLORE_GOBLIN_CAVE', style: 'danger' },
      { key: 'CONTINUE_EXPLORING', label: 'Continue Exploring', action: 'DISMISS_LANDMARK_SCENE', style: 'ghost' }
    ]
  },
  ANCIENT_CRYPT: {
    sceneKey: 'ANCIENT_CRYPT',
    landmarkType: 'CRYPT',
    category: 'CRYPT',
    title: 'The Ancient Crypt',
    subtitle: 'Dread Sepulcher of the Undead Lands',
    description: 'Towering obsidian obelisks and cracked marble archways frame a sunken staircase descending into the Necropolis Sanctum. Pale necrotic fire burns cold in iron braziers while the whispers of entombed Barrow-Kings echo from the sealed vault below.',
    artworkUrl: '/images/terrain/terrain_underground_ruins.webp',
    isMajorLandmark: true,
    autoOpenOnArrival: true,
    actions: [
      { key: 'ENTER_ANCIENT_CRYPT', label: 'Breach the Sepulcher Vault', action: 'ENTER_ANCIENT_CRYPT', style: 'danger' },
      { key: 'CONTINUE_EXPLORING', label: 'Continue Exploring', action: 'DISMISS_LANDMARK_SCENE', style: 'ghost' }
    ]
  },
  ANCIENT_DUNGEON_ENTRANCE: {
    sceneKey: 'ANCIENT_DUNGEON_ENTRANCE',
    landmarkType: 'DUNGEON_ENTRANCE',
    category: 'DUNGEON_ENTRANCE',
    title: 'Ancient Dungeon Entrance',
    subtitle: 'Sealed Underworld Descent',
    description: 'Weathered stone steps descend into yawning darkness beneath the roots of the mountain.',
    artworkUrl: '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
    isMajorLandmark: true,
    autoOpenOnArrival: false,
    actions: [
      { key: 'CONTINUE_EXPLORING', label: 'Continue Exploring', action: 'DISMISS_LANDMARK_SCENE', style: 'ghost' }
    ]
  },
  SUNKEN_CRYPT_ENTRANCE: {
    sceneKey: 'SUNKEN_CRYPT_ENTRANCE',
    landmarkType: 'CRYPT',
    category: 'CRYPT',
    title: 'Sunken Crypt',
    subtitle: 'Forsaken Vault of the Restless Dead',
    description: 'Cracked marble archways and cold sepulchral mist mark an ancient burial vault.',
    artworkUrl: '/images/terrain/terrain_underground_ruins.webp',
    isMajorLandmark: true,
    autoOpenOnArrival: false,
    actions: [
      { key: 'CONTINUE_EXPLORING', label: 'Continue Exploring', action: 'DISMISS_LANDMARK_SCENE', style: 'ghost' }
    ]
  }
});

function ensurePhase9DefinitionsSeeded(db) {
  if (!db) return;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS danger_zone_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_key TEXT NOT NULL UNIQUE,
        zone_name TEXT NOT NULL,
        danger_level TEXT NOT NULL,
        encounter_rate REAL NOT NULL DEFAULT 0.18,
        ambush_share REAL NOT NULL DEFAULT 0.30,
        min_steps_between_combats INTEGER NOT NULL DEFAULT 1,
        streak_dampening_per_event REAL NOT NULL DEFAULT 0.08,
        monster_pool_json TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS landmark_scene_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scene_key TEXT NOT NULL UNIQUE,
        landmark_type TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'MAJOR_LANDMARK',
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        artwork_url TEXT NOT NULL,
        is_major_landmark INTEGER NOT NULL DEFAULT 1,
        auto_open_on_arrival INTEGER NOT NULL DEFAULT 1,
        actions_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const upsertZone = db.prepare(`
      INSERT INTO danger_zone_profiles (
        zone_key, zone_name, danger_level, encounter_rate, ambush_share,
        min_steps_between_combats, streak_dampening_per_event, monster_pool_json, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(zone_key) DO UPDATE SET
        zone_name = excluded.zone_name,
        danger_level = excluded.danger_level,
        encounter_rate = excluded.encounter_rate,
        ambush_share = excluded.ambush_share,
        min_steps_between_combats = excluded.min_steps_between_combats,
        streak_dampening_per_event = excluded.streak_dampening_per_event,
        monster_pool_json = excluded.monster_pool_json,
        description = excluded.description
    `);
    for (const z of Object.values(DANGER_ZONE_PROFILES)) {
      upsertZone.run(
        z.zoneKey,
        z.zoneName,
        z.dangerLevel,
        z.encounterRate,
        z.ambushShare,
        z.minStepsBetweenCombats,
        z.streakDampeningPerEvent,
        JSON.stringify(z.monsterPool || []),
        z.description || ''
      );
    }

    const upsertScene = db.prepare(`
      INSERT INTO landmark_scene_definitions (
        scene_key, landmark_type, category, title, subtitle, description,
        artwork_url, is_major_landmark, auto_open_on_arrival, actions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(scene_key) DO UPDATE SET
        landmark_type = excluded.landmark_type,
        category = excluded.category,
        title = excluded.title,
        subtitle = excluded.subtitle,
        description = excluded.description,
        artwork_url = excluded.artwork_url,
        is_major_landmark = excluded.is_major_landmark,
        auto_open_on_arrival = excluded.auto_open_on_arrival,
        actions_json = excluded.actions_json
    `);
    for (const sc of Object.values(LANDMARK_SCENE_DEFINITIONS)) {
      upsertScene.run(
        sc.sceneKey,
        sc.landmarkType,
        sc.category,
        sc.title,
        sc.subtitle || '',
        sc.description || '',
        sc.artworkUrl,
        sc.isMajorLandmark ? 1 : 0,
        sc.autoOpenOnArrival ? 1 : 0,
        JSON.stringify(sc.actions || [])
      );
    }
  } catch {
    // Graceful no-op if database is read-only
  }
}

function applyTopdownExperimentWorld(db, options = {}) {
  ensurePhase9DefinitionsSeeded(db);
  ensurePhase8DefinitionsSeeded(db);

  let currentVersion = null;
  let tileCount30x30 = 0;
  try {
    const vRow = db.prepare("SELECT value FROM game_config WHERE key = 'topdown_world_version'").get();
    currentVersion = vRow ? vRow.value : null;
    const cRow = db.prepare('SELECT COUNT(*) as cnt FROM map_tiles WHERE x BETWEEN 0 AND 29 AND y BETWEEN 0 AND 29').get();
    tileCount30x30 = cRow ? Number(cRow.cnt) : 0;
  } catch {
    currentVersion = null;
  }

  if (currentVersion === TOPDOWN_WORLD_VERSION && tileCount30x30 === TOPDOWN_REGION_BOUNDS.totalTiles && !options.forceRebuild) {
    // World is already at Phase 8 30×30; ensure Stronghold boss row exists (without reviving if defeated)
    // and ensure living characters have initial discovery seeded.
    ensureStrongholdBossInstance(db);
    try {
      const livingChars = db.prepare('SELECT id, class, tile_id FROM characters WHERE is_alive = 1').all();
      for (const ch of livingChars) {
        const discCount = db.prepare('SELECT COUNT(*) as cnt FROM character_discovered_tiles WHERE character_id = ?').get(ch.id);
        if (!discCount || Number(discCount.cnt) === 0) {
          recordTileDiscovery(db, ch);
        }
        syncCharacterQuestState(db, ch.id);
      }
    } catch {
      // Ignore if table not ready
    }
    return;
  }

  withTransaction(db, (tx) => {
    // Capture existing characters' coordinates before updating map_tiles
    const existingChars = tx.prepare(`
      SELECT c.id, c.class, c.is_alive, c.tile_id,
             c.quest_goblin_chieftain_status, c.goblin_chieftain_slain,
             t.x as old_x, t.y as old_y
      FROM characters c
      LEFT JOIN map_tiles t ON c.tile_id = t.id
    `).all();

    // Capture any existing Stronghold boss instance before tile coordinates change
    const existingBoss = tx.prepare(`
      SELECT * FROM monster_instances
      WHERE custom_title = ?
      ORDER BY id DESC LIMIT 1
    `).get(STRONGHOLD_BOSS_PROFILE.customTitle);

    const upsertStmt = tx.prepare(`
      INSERT INTO map_tiles (
        x, y, name, terrain, feature, description, is_passable, is_safe,
        region_key, biome, visual_type, visual_kind, path_connections,
        is_landmark, landmark_key, encounter_profile_key, boss_key
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
      ON CONFLICT(x, y) DO UPDATE SET
        name = excluded.name,
        terrain = excluded.terrain,
        feature = excluded.feature,
        description = excluded.description,
        is_passable = excluded.is_passable,
        is_safe = excluded.is_safe,
        region_key = excluded.region_key,
        biome = excluded.biome,
        visual_type = excluded.visual_type,
        visual_kind = excluded.visual_kind,
        path_connections = excluded.path_connections,
        is_landmark = excluded.is_landmark,
        landmark_key = excluded.landmark_key,
        encounter_profile_key = excluded.encounter_profile_key,
        boss_key = excluded.boss_key
    `);

    for (const tileDef of TOPDOWN_REGION_TILES) {
      upsertStmt.run(
        tileDef.x,
        tileDef.y,
        tileDef.name,
        tileDef.terrain,
        tileDef.feature,
        tileDef.description,
        tileDef.is_passable,
        tileDef.is_safe,
        tileDef.region_key || 'BLACKWOOD_FOREST',
        tileDef.biome || 'BLACKWOOD_FOREST',
        tileDef.visualType || 'DEEP_FOREST',
        tileDef.visualKind || 'DENSE_WOODS',
        JSON.stringify(tileDef.pathConnections || []),
        tileDef.isLandmark ? 1 : 0,
        tileDef.landmarkKey || null,
        tileDef.encounterProfileKey || 'GOBLIN_FOREST',
        tileDef.bossKey || null
      );
    }

    // Relocate existing characters from legacy 8x7 / 15x15 coordinates to their 30x30 equivalents
    const newTownTile = getTileByCoords(tx, TOWN_COORD.x, TOWN_COORD.y);
    for (const ch of existingChars) {
      const mapped = mapLegacyCoordToPhase8(ch.old_x ?? 7, ch.old_y ?? 7);
      const targetTile = getTileByCoords(tx, mapped.x, mapped.y) || newTownTile;
      if (targetTile) {
        tx.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(targetTile.id, ch.id);
      }
      if (ch.is_alive === 1 && targetTile) {
        recordTileDiscovery(tx, { id: ch.id, class: ch.class, tile_id: targetTile.id }, targetTile.x, targetTile.y);
      }
    }

    // Relocate existing Stronghold boss instance to the new [15, 2] Stronghold tile (preserving ACTIVE/DEFEATED status)
    const newStrongholdTile = getTileByCoords(tx, STRONGHOLD_COORD.x, STRONGHOLD_COORD.y);
    if (existingBoss && newStrongholdTile && existingBoss.tile_id !== newStrongholdTile.id) {
      tx.prepare('UPDATE monster_instances SET tile_id = ? WHERE id = ?').run(newStrongholdTile.id, existingBoss.id);
    }

    tx.prepare(`
      INSERT INTO game_config (key, value)
      VALUES ('topdown_world_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(TOPDOWN_WORLD_VERSION);
  });

  ensureStrongholdBossInstance(db);
  try {
    const allChars = db.prepare('SELECT id FROM characters').all();
    for (const ch of allChars) {
      syncCharacterQuestState(db, ch.id);
    }
  } catch {
    // Ignore
  }
}

/**
 * Ensures the persistent world boss ("Warchief Grak the Goblin Chieftain")
 * exists on the Goblin Stronghold tile [15, 2].
 * If the boss has already been defeated in this world/character state, it is NOT revived.
 */
function ensureStrongholdBossInstance(db, options = {}) {
  const strongholdTile = getTileByCoords(db, STRONGHOLD_COORD.x, STRONGHOLD_COORD.y);
  if (!strongholdTile) return null;

  const existingAny = db.prepare(`
    SELECT mi.*, m.name as base_monster_name
    FROM monster_instances mi
    JOIN monsters m ON mi.monster_id = m.id
    WHERE mi.tile_id = ? AND mi.custom_title = ?
    ORDER BY mi.id DESC
    LIMIT 1
  `).get(strongholdTile.id, STRONGHOLD_BOSS_PROFILE.customTitle);

  if (existingAny) {
    if (options.respawnIfDefeated && existingAny.status !== 'ACTIVE') {
      // A previous fallen hero had already defeated the boss; spawn a fresh ACTIVE instance for the new hero
    } else if (!options.forceRespawn) {
      return existingAny;
    } else if (existingAny.status === 'ACTIVE') {
      db.prepare(`
        UPDATE monster_instances
        SET current_hp = max_hp,
            kill_count = 0,
            held_gold = ?
        WHERE id = ?
      `).run(STRONGHOLD_BOSS_PROFILE.heldGold, existingAny.id);
      return db.prepare(`
        SELECT mi.*, m.name as base_monster_name
        FROM monster_instances mi
        JOIN monsters m ON mi.monster_id = m.id
        WHERE mi.id = ?
      `).get(existingAny.id);
    }
  }

  // Clear any non-boss random persistent instance on [15, 2] so the Stronghold tile is reserved for the Chieftain
  db.prepare(`
    DELETE FROM monster_instances
    WHERE tile_id = ? AND (custom_title IS NULL OR custom_title != ?)
  `).run(strongholdTile.id, STRONGHOLD_BOSS_PROFILE.customTitle);

  const bossMonster =
    db.prepare('SELECT * FROM monsters WHERE LOWER(name) = LOWER(?) LIMIT 1').get(STRONGHOLD_BOSS_PROFILE.preferredMonsterName) ||
    db.prepare('SELECT * FROM monsters WHERE id = ? LIMIT 1').get(STRONGHOLD_BOSS_PROFILE.fallbackMonsterId) ||
    db.prepare("SELECT * FROM monsters WHERE LOWER(name) LIKE '%goblin%' ORDER BY challenge_rating DESC LIMIT 1").get();

  if (!bossMonster) return null;

  const maxHp = Math.max(Number(bossMonster.base_hp || 8), STRONGHOLD_BOSS_PROFILE.maxHp);
  const res = db.prepare(`
    INSERT INTO monster_instances (
      monster_id, tile_id, current_hp, max_hp, held_gold, kill_count, custom_title, status
    ) VALUES (?, ?, ?, ?, ?, 0, ?, 'ACTIVE')
  `).run(
    bossMonster.id,
    strongholdTile.id,
    maxHp,
    maxHp,
    STRONGHOLD_BOSS_PROFILE.heldGold,
    STRONGHOLD_BOSS_PROFILE.customTitle
  );

  return db.prepare(`
    SELECT mi.*, m.name as base_monster_name
    FROM monster_instances mi
    JOIN monsters m ON mi.monster_id = m.id
    WHERE mi.id = ?
  `).get(Number(res.lastInsertRowid));
}

function markStrongholdBossSlain(db, characterId) {
  const strongholdTile = getTileByCoords(db, STRONGHOLD_COORD.x, STRONGHOLD_COORD.y);
  if (strongholdTile) {
    db.prepare(`
      UPDATE monster_instances
      SET status = 'DEFEATED', current_hp = 0
      WHERE tile_id = ? AND custom_title = ? AND status = 'ACTIVE'
    `).run(strongholdTile.id, STRONGHOLD_BOSS_PROFILE.customTitle);
  }
  if (characterId) {
    db.prepare('UPDATE characters SET goblin_chieftain_slain = 1 WHERE id = ?').run(characterId);
    syncCharacterQuestState(db, characterId);
  }
}

/**
 * Synchronizes the character's quest status across both the general `character_quests` table
 * and the legacy `characters` columns (`quest_goblin_chieftain_status`, `goblin_chieftain_slain`)
 * without ever reviving a defeated boss.
 */
function syncCharacterQuestState(db, characterId) {
  if (!db || !characterId) return null;
  const charRow = db.prepare(`
    SELECT id, level, intelligence, gold,
           quest_goblin_chieftain_status, goblin_chieftain_slain
    FROM characters
    WHERE id = ?
  `).get(characterId);
  if (!charRow) return null;

  ensurePhase8DefinitionsSeeded(db);

  const strongholdTile = getTileByCoords(db, STRONGHOLD_COORD.x, STRONGHOLD_COORD.y);
  const bossInstance = strongholdTile
    ? db.prepare(`
        SELECT * FROM monster_instances
        WHERE tile_id = ? AND custom_title = ?
        ORDER BY id DESC LIMIT 1
      `).get(strongholdTile.id, STRONGHOLD_BOSS_PROFILE.customTitle)
    : null;

  const bossDefeatedInWorld = Boolean(bossInstance && bossInstance.status !== 'ACTIVE');

  // Check if a row exists in `character_quests`
  let cqRow = null;
  try {
    cqRow = db.prepare(`
      SELECT * FROM character_quests
      WHERE character_id = ? AND quest_key = ?
    `).get(characterId, QUEST_GOBLIN_CHIEFTAIN.key);
  } catch {
    cqRow = null;
  }

  let bossSlain =
    Number(charRow.goblin_chieftain_slain || 0) === 1 ||
    Boolean(cqRow && Number(cqRow.objective_completed) === 1) ||
    bossDefeatedInWorld;

  // Determine canonical status between character_quests and characters column
  const colStatus = String(charRow.quest_goblin_chieftain_status || 'NOT_ACCEPTED').toUpperCase();
  const tableStatus = cqRow ? String(cqRow.status || 'NOT_ACCEPTED').toUpperCase() : null;
  const rank = { NOT_ACCEPTED: 0, ACTIVE: 1, COMPLETED: 2, REWARD_CLAIMED: 3 };

  let status = (tableStatus && rank[tableStatus] !== undefined) ? tableStatus : colStatus;
  if (rank[colStatus] !== undefined && rank[colStatus] > (rank[status] ?? 0)) {
    status = colStatus;
  }
  if (!QUEST_STATUS_LABELS[status]) {
    status = 'NOT_ACCEPTED';
  }

  if (bossSlain && status === 'ACTIVE') {
    status = 'COMPLETED';
  }

  // Persist synchronized state to both `characters` and `character_quests`
  if (
    status !== colStatus ||
    (bossSlain ? 1 : 0) !== Number(charRow.goblin_chieftain_slain || 0)
  ) {
    db.prepare(`
      UPDATE characters
      SET quest_goblin_chieftain_status = ?,
          goblin_chieftain_slain = ?
      WHERE id = ?
    `).run(status, bossSlain ? 1 : 0, characterId);
  }

  try {
    const objDone = bossSlain ? 1 : 0;
    if (!cqRow) {
      db.prepare(`
        INSERT INTO character_quests (
          character_id, quest_key, status, objective_completed, progress_count, target_count,
          accepted_at, completed_at, claimed_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        characterId,
        QUEST_GOBLIN_CHIEFTAIN.key,
        status,
        objDone,
        objDone,
        status !== 'NOT_ACCEPTED' ? new Date().toISOString() : null,
        (status === 'COMPLETED' || status === 'REWARD_CLAIMED') ? new Date().toISOString() : null,
        status === 'REWARD_CLAIMED' ? new Date().toISOString() : null
      );
    } else if (cqRow.status !== status || Number(cqRow.objective_completed) !== objDone) {
      db.prepare(`
        UPDATE character_quests
        SET status = ?,
            objective_completed = ?,
            progress_count = ?,
            accepted_at = COALESCE(accepted_at, CASE WHEN ? != 'NOT_ACCEPTED' THEN CURRENT_TIMESTAMP ELSE NULL END),
            completed_at = COALESCE(completed_at, CASE WHEN ? IN ('COMPLETED', 'REWARD_CLAIMED') THEN CURRENT_TIMESTAMP ELSE NULL END),
            claimed_at = COALESCE(claimed_at, CASE WHEN ? = 'REWARD_CLAIMED' THEN CURRENT_TIMESTAMP ELSE NULL END),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, objDone, objDone, status, status, status, cqRow.id);
    }
  } catch {
    // Ignore if character_quests table is unavailable
  }

  const xpRewardPreview = calculateXpWithIntelligence(
    QUEST_GOBLIN_CHIEFTAIN.rewardXpBase,
    charRow.intelligence || 10
  );

  const discoveredSet = getDiscoveredCoordSet(db, characterId);
  const strongholdDiscovered = discoveredSet.has(`${STRONGHOLD_COORD.x},${STRONGHOLD_COORD.y}`);

  return {
    key: QUEST_GOBLIN_CHIEFTAIN.key,
    questKey: QUEST_GOBLIN_CHIEFTAIN.key,
    title: QUEST_GOBLIN_CHIEFTAIN.title,
    giver: QUEST_GOBLIN_CHIEFTAIN.giver,
    regionKey: QUEST_GOBLIN_CHIEFTAIN.regionKey,
    regionName: QUEST_GOBLIN_CHIEFTAIN.regionName,
    strongholdName: QUEST_GOBLIN_CHIEFTAIN.strongholdName,
    strongholdCoord: QUEST_GOBLIN_CHIEFTAIN.strongholdCoord,
    strongholdDiscovered,
    description: QUEST_GOBLIN_CHIEFTAIN.description,
    status,
    statusLabel: QUEST_STATUS_LABELS[status] || 'Not Accepted',
    bossSlain,
    bossStatus: bossSlain ? 'DEFEATED' : 'ACTIVE',
    bossName: STRONGHOLD_BOSS_PROFILE.customTitle,
    rewardXpBase: QUEST_GOBLIN_CHIEFTAIN.rewardXpBase,
    rewardXp: xpRewardPreview,
    rewardGold: QUEST_GOBLIN_CHIEFTAIN.rewardGold,
    canAccept: status === 'NOT_ACCEPTED',
    canClaimReward: status === 'COMPLETED',
    objectives: [
      {
        key: 'DEFEAT_GOBLIN_CHIEFTAIN',
        label: 'Find the Goblin Stronghold in northern Blackwood Forest and defeat Warchief Grak',
        completed: bossSlain
      },
      {
        key: 'RETURN_TO_OAKHAVEN',
        label: 'Return to Captain Vane in Oakhaven Sanctuary to claim your reward',
        completed: status === 'REWARD_CLAIMED'
      }
    ],
    objectiveText:
      status === 'REWARD_CLAIMED'
        ? 'The Goblin Chieftain is vanquished and Oakhaven has rewarded your valor.'
        : status === 'COMPLETED'
          ? 'The Goblin Chieftain has been defeated! Return to Oakhaven Sanctuary to claim your reward.'
          : bossSlain && status === 'NOT_ACCEPTED'
            ? 'You have already slain the Goblin Chieftain in Blackwood Stronghold! Speak with Captain Vane in Oakhaven to report your deed and claim the reward.'
            : status === 'ACTIVE'
              ? 'Travel north through Blackwood Forest along the forest trails, locate the Goblin Stronghold, and defeat the Goblin Chieftain.'
              : 'Speak with Captain Vane in Oakhaven to accept the quest, or venture north into Blackwood Forest.'
  };
}

/**
 * Returns all quests for the character from the general quest system.
 */
function getCharacterQuests(db, characterId) {
  const primary = syncCharacterQuestState(db, characterId);
  return primary ? [primary] : [];
}

function resolveCharacterArg(db, characterOrId) {
  if (!characterOrId) return null;
  if (typeof characterOrId === 'object' && characterOrId.id) {
    return characterOrId;
  }
  return db.prepare('SELECT * FROM characters WHERE id = ?').get(Number(characterOrId));
}

function acceptGoblinChieftainQuest(db, characterOrId) {
  const character = resolveCharacterArg(db, characterOrId);
  if (!character) {
    throw new Error('Character not found.');
  }
  const currentTile = getTileById(db, character.tile_id);
  if (!currentTile || currentTile.terrain !== 'CITY' || currentTile.is_safe !== 1) {
    throw new Error('You must be in Oakhaven Sanctuary to accept The Goblin Chieftain quest.');
  }

  const questState = syncCharacterQuestState(db, character.id);
  if (questState.status === 'REWARD_CLAIMED') {
    throw new Error('You have already completed The Goblin Chieftain quest and claimed your reward.');
  }
  if (questState.status === 'ACTIVE' || questState.status === 'COMPLETED') {
    return {
      quest: questState,
      message:
        questState.status === 'COMPLETED'
          ? 'The Goblin Chieftain is already slain! You may now claim your reward in Oakhaven.'
          : 'Quest "The Goblin Chieftain" is already active.'
    };
  }

  const nextStatus = questState.bossSlain ? 'COMPLETED' : 'ACTIVE';
  db.prepare(`
    UPDATE characters
    SET quest_goblin_chieftain_status = ?
    WHERE id = ?
  `).run(nextStatus, character.id);
  try {
    db.prepare(`
      UPDATE character_quests
      SET status = ?, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE character_id = ? AND quest_key = ?
    `).run(nextStatus, character.id, QUEST_GOBLIN_CHIEFTAIN.key);
  } catch {
    // Ignore
  }

  const updatedQuest = syncCharacterQuestState(db, character.id);
  const message = updatedQuest.bossSlain
    ? 'You report that Warchief Grak is already slain! Captain Vane hails your triumph—your quest is marked Completed and ready for reward.'
    : 'Accepted Quest: "The Goblin Chieftain" — Venture north into Blackwood Forest, locate the Goblin Stronghold, and defeat the chieftain.';

  return {
    quest: updatedQuest,
    message
  };
}

function claimGoblinChieftainReward(db, characterOrId) {
  const character = resolveCharacterArg(db, characterOrId);
  if (!character) {
    throw new Error('Character not found.');
  }
  const currentTile = getTileById(db, character.tile_id);
  if (!currentTile || currentTile.terrain !== 'CITY' || currentTile.is_safe !== 1) {
    throw new Error('You must return to Oakhaven Sanctuary to claim your quest reward.');
  }

  return withTransaction(db, (tx) => {
    const synced = syncCharacterQuestState(tx, character.id);
    if (synced.status === 'REWARD_CLAIMED') {
      throw new Error('Quest reward has already been claimed.');
    }
    if (!synced.bossSlain) {
      throw new Error('You must defeat the Goblin Chieftain at the Goblin Stronghold before claiming this reward.');
    }

    const charRow = tx.prepare('SELECT * FROM characters WHERE id = ?').get(character.id);
    const xpAwarded = calculateXpWithIntelligence(
      QUEST_GOBLIN_CHIEFTAIN.rewardXpBase,
      charRow.intelligence || 10
    );
    const goldAwarded = QUEST_GOBLIN_CHIEFTAIN.rewardGold;
    const newXp = Number(charRow.xp || 0) + xpAwarded;

    tx.prepare(`
      UPDATE characters
      SET gold = gold + ?,
          quest_goblin_chieftain_status = 'REWARD_CLAIMED',
          goblin_chieftain_slain = 1
      WHERE id = ?
    `).run(goldAwarded, character.id);

    try {
      tx.prepare(`
        UPDATE character_quests
        SET status = 'REWARD_CLAIMED',
            claimed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE character_id = ? AND quest_key = ?
      `).run(character.id, QUEST_GOBLIN_CHIEFTAIN.key);
    } catch {
      // Ignore
    }

    const levelProgress = applyCharacterLevelUp(tx, character.id, newXp);
    const updatedQuest = syncCharacterQuestState(tx, character.id);

    let message = `Quest Complete: "The Goblin Chieftain"! Captain Vane awards you +${goldAwarded} Gold and +${xpAwarded} XP.`;
    if (levelProgress && levelProgress.leveledUp) {
      message += ` You have reached Level ${levelProgress.newLevel} (+${levelProgress.totalHpGain} Max HP)!`;
    }

    return {
      quest: updatedQuest,
      xpAwarded,
      goldAwarded,
      rewardXp: xpAwarded,
      rewardGold: goldAwarded,
      leveledUp: Boolean(levelProgress && levelProgress.leveledUp),
      newLevel: levelProgress ? levelProgress.newLevel : charRow.level,
      message
    };
  });
}

/**
 * Initiates the fixed Goblin Stronghold Boss encounter on [15, 2] using the Phase 7C combat engine.
 */
function startStrongholdBossEncounter(db, character, options = {}) {
  const currentTile = getTileById(db, character.tile_id);
  if (!isGoblinStrongholdTile(currentTile)) {
    throw new Error(`You must stand at the Goblin Stronghold entrance [${STRONGHOLD_COORD.x}, ${STRONGHOLD_COORD.y}] to challenge the Goblin Chieftain.`);
  }

  const activeCombat = db.prepare(`
    SELECT id FROM encounters
    WHERE character_id = ? AND status = 'IN_COMBAT'
    LIMIT 1
  `).get(character.id);
  if (activeCombat) {
    throw new Error('You are already engaged in active combat.');
  }

  const questState = syncCharacterQuestState(db, character.id);
  if (questState.bossSlain) {
    throw new Error('The Goblin Chieftain has already been vanquished. The stronghold stands silent.');
  }

  const bossInstance = ensureStrongholdBossInstance(db);
  if (!bossInstance || bossInstance.status !== 'ACTIVE') {
    throw new Error('The Goblin Chieftain has already been vanquished.');
  }

  return withTransaction(db, (tx) => {
    tx.prepare(`
      UPDATE encounters
      SET status = 'ESCAPED'
      WHERE character_id = ? AND status = 'DISCOVERED'
    `).run(character.id);

    const ins = tx.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id, monster_instance_id,
        status, current_monster_hp, monster_max_hp, combat_round,
        spotted_by_hero, is_ambush, opening_shot_resolved
      ) VALUES (?, ?, ?, ?, 'DISCOVERED', ?, ?, 0, 1, 0, 0)
    `).run(
      character.id,
      currentTile.id,
      bossInstance.monster_id,
      bossInstance.id,
      bossInstance.current_hp || bossInstance.max_hp,
      bossInstance.max_hp
    );

    const encounterId = Number(ins.lastInsertRowid);
    const investigateResult = investigateEncounter(
      tx,
      character.id,
      encounterId,
      character.class,
      options.rng ? { rng: options.rng } : {}
    );
    const encounter = getEncounterById(tx, encounterId, character.class);
    if (encounter && encounter.status === 'VICTORY') {
      tx.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(encounterId, character.id);
      markStrongholdBossSlain(tx, character.id);
    }
    return {
      encounterId,
      investigateResult,
      encounter,
      ...(encounter || {})
    };
  });
}

/**
 * Initiates a delve/breach encounter at the Goblin Cave [9, 12] or Ancient Crypt [26, 5]
 * when the hero clicks the landmark action button in the Major Landmark Scene.
 */
function startLandmarkDungeonEncounter(db, character, landmarkKey, options = {}) {
  const currentTile = getTileById(db, character.tile_id);
  const key = String(landmarkKey || '').toUpperCase();
  if (key === 'GOBLIN_CAVE' && !isGoblinCaveTile(currentTile)) {
    throw new Error(`You must stand at the Goblin Cave entrance [${GOBLIN_CAVE_COORD.x}, ${GOBLIN_CAVE_COORD.y}] to delve into the warrens.`);
  }
  if (key === 'ANCIENT_CRYPT' && !isAncientCryptTile(currentTile)) {
    throw new Error(`You must stand at the Ancient Crypt [${ANCIENT_CRYPT_COORD.x}, ${ANCIENT_CRYPT_COORD.y}] to breach the sepulcher vault.`);
  }

  const activeCombat = db.prepare(`
    SELECT id FROM encounters
    WHERE character_id = ? AND status = 'IN_COMBAT'
    LIMIT 1
  `).get(character.id);
  if (activeCombat) {
    throw new Error('You are already engaged in active combat.');
  }

  const rng = options.rng || Math.random;
  const pickedResult = key === 'ANCIENT_CRYPT'
    ? selectUndeadLandsMonster(db, Math.max(2, Number(character.level || 1)), rng)
    : selectGoblinCaveMonster(db, Math.max(1, Number(character.level || 1)), rng);
  const pickedMonster = pickedResult && pickedResult.monster ? pickedResult.monster : pickedResult;
  if (!pickedMonster) {
    throw new Error('No creature stirs within the threshold right now.');
  }

  return withTransaction(db, (tx) => {
    tx.prepare(`
      UPDATE encounters
      SET status = 'ESCAPED'
      WHERE character_id = ? AND status = 'DISCOVERED'
    `).run(character.id);

    const initialHp = Number(pickedMonster.base_hp || 8);
    const ins = tx.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id,
        status, current_monster_hp, monster_max_hp, combat_round,
        spotted_by_hero, is_ambush, opening_shot_resolved
      ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, 1, 0, 0)
    `).run(
      character.id,
      currentTile.id,
      pickedMonster.id,
      initialHp,
      initialHp
    );

    const encounterId = Number(ins.lastInsertRowid);
    const investigateResult = investigateEncounter(
      tx,
      character.id,
      encounterId,
      character.class,
      options.rng ? { rng: options.rng } : {}
    );
    const encounter = getEncounterById(tx, encounterId, character.class);
    if (encounter && encounter.status === 'VICTORY') {
      tx.prepare('UPDATE characters SET pending_victory_encounter_id = ? WHERE id = ?').run(encounterId, character.id);
    }
    return {
      encounterId,
      investigateResult,
      encounter,
      ...(encounter || {})
    };
  });
}

/**
 * Selects a monster for Goblin Cave / Cave Approach encounters.
 */
function selectGoblinCaveMonster(db, heroLevelOrRng = 1, maybeRng = Math.random) {
  const isSecondFn = typeof heroLevelOrRng === 'function';
  const lvl = isSecondFn ? 1 : Math.max(1, Number(heroLevelOrRng || 1));
  const rng = isSecondFn ? heroLevelOrRng : (typeof maybeRng === 'function' ? maybeRng : Math.random);

  const wrapResult = (monster, bucket) => {
    if (!monster) return null;
    return { ...monster, monster, bucket };
  };

  const caveNames = lvl <= 1
    ? ['Goblin', 'Hobgoblin', 'Giant Spider', 'Stirge', 'Mite']
    : ['Goblin', 'Hobgoblin', 'Bugbear', 'Giant Spider', 'Stirge', 'Hobgoblin Captain'];
  const placeholders = caveNames.map(() => '?').join(', ');
  const pool = db.prepare(`
    SELECT * FROM monsters
    WHERE name IN (${placeholders})
    ORDER BY challenge_rating ASC, id ASC
  `).all(...caveNames);

  if (pool.length > 0) {
    const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    return wrapResult(pool[idx], 'CAVE');
  }

  return selectGoblinForestMonster(db, lvl, rng);
}

/**
 * Selects an Undead monster for Undead Lands travel encounters (85% Undead / 15% Blighted Swamp & Grave scavengers).
 */
function selectUndeadLandsMonster(db, heroLevelOrRng = 1, maybeRng = Math.random) {
  const isSecondFn = typeof heroLevelOrRng === 'function';
  const lvl = isSecondFn ? 1 : Math.max(1, Number(heroLevelOrRng || 1));
  const rng = isSecondFn ? heroLevelOrRng : (typeof maybeRng === 'function' ? maybeRng : Math.random);
  const categoryRoll = rng();

  const wrapResult = (monster, bucket) => {
    if (!monster) return null;
    return { ...monster, monster, bucket };
  };

  // Bucket 1: 85% Core Undead Horrors
  if (categoryRoll < 0.85) {
    const undeadNames = lvl <= 1
      ? ['Skeleton', 'Zombie', 'Crawling Claw', 'Shadow', 'Ghoul']
      : (lvl === 2
        ? ['Skeleton', 'Zombie', 'Ghoul', 'Shadow', 'Wight', 'Specter']
        : ['Skeleton', 'Zombie', 'Ghoul', 'Shadow', 'Wight', 'Wraith', 'Specter', 'Ghast']);
    const placeholders = undeadNames.map(() => '?').join(', ');
    const undead = db.prepare(`
      SELECT * FROM monsters
      WHERE name IN (${placeholders})
      ORDER BY challenge_rating ASC, id ASC
    `).all(...undeadNames);

    if (undead.length > 0) {
      const weights = undead.map((m) => {
        if (m.name === 'Skeleton' || m.name === 'Zombie') return 55;
        if (m.name === 'Crawling Claw' || m.name === 'Ghoul' || m.name === 'Shadow') return 32;
        return 16;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      for (let i = 0; i < undead.length; i++) {
        if (r < weights[i]) return wrapResult(undead[i], 'UNDEAD');
        r -= weights[i];
      }
      return wrapResult(undead[0], 'UNDEAD');
    }
  }

  // Bucket 2: 15% Mire & Barrow Scavengers (Will-o-Wisp, Stirge, Giant Spider, Carrion Crawler)
  const mireNames = lvl <= 1
    ? ['Stirge', 'Giant Spider', 'Dire Rat']
    : ['Will-o-Wisp', 'Stirge', 'Giant Spider', 'Carrion Crawler'];
  const placeholders = mireNames.map(() => '?').join(', ');
  const scavengers = db.prepare(`
    SELECT * FROM monsters
    WHERE name IN (${placeholders})
    ORDER BY challenge_rating ASC, id ASC
  `).all(...mireNames);

  if (scavengers.length > 0) {
    const idx = Math.min(scavengers.length - 1, Math.floor(rng() * scavengers.length));
    return wrapResult(scavengers[idx], 'MIRE_SCAVENGER');
  }

  const fallback = db.prepare("SELECT * FROM monsters WHERE name IN ('Skeleton', 'Zombie', 'Goblin') ORDER BY id ASC LIMIT 1").get();
  return wrapResult(fallback, 'UNDEAD');
}

function selectRegionalEncounterMonster(db, targetTile, heroLevelOrRng = 1, maybeRng = Math.random) {
  if (!targetTile) {
    return selectGoblinForestMonster(db, heroLevelOrRng, maybeRng);
  }
  const x = Number(targetTile.x);
  const y = Number(targetTile.y);
  const meta = TILE_META_BY_COORD.get(`${x},${y}`);
  const regionKey = targetTile.region_key || (meta && meta.region_key) || 'BLACKWOOD_FOREST';
  const encounterProfileKey = targetTile.encounter_profile_key || (meta && meta.encounterProfileKey) || 'GOBLIN_FOREST';

  if (regionKey === 'UNDEAD_LANDS' || encounterProfileKey === 'UNDEAD_LANDS') {
    return selectUndeadLandsMonster(db, heroLevelOrRng, maybeRng);
  }
  if (
    encounterProfileKey === 'GOBLIN_CAVE' ||
    isGoblinCaveTile(targetTile) ||
    (Math.abs(x - GOBLIN_CAVE_COORD.x) <= 2 && Math.abs(y - GOBLIN_CAVE_COORD.y) <= 2)
  ) {
    return selectGoblinCaveMonster(db, heroLevelOrRng, maybeRng);
  }
  return selectGoblinForestMonster(db, heroLevelOrRng, maybeRng);
}

/**
 * Selects a monster for Goblin Forest travel encounters using the required
 * 80% Goblin-related / 15% Forest Animals / 5% Other Forest Monsters distribution,
 * backed by `encounter_profiles` and filtered appropriately by hero level.
 */
function selectGoblinForestMonster(db, heroLevelOrRng = 1, maybeRng = Math.random) {
  const isSecondFn = typeof heroLevelOrRng === 'function';
  const lvl = isSecondFn ? 1 : Math.max(1, Number(heroLevelOrRng || 1));
  const rng = isSecondFn ? heroLevelOrRng : (typeof maybeRng === 'function' ? maybeRng : Math.random);
  const categoryRoll = rng();

  const wrapResult = (monster, bucket) => {
    if (!monster) return null;
    return {
      ...monster,
      monster,
      bucket
    };
  };

  // Bucket 1: 80% Goblin-related monsters
  if (categoryRoll < 0.80) {
    const goblinNames = lvl <= 1
      ? ['Goblin', 'Hobgoblin']
      : (lvl === 2
        ? ['Goblin', 'Hobgoblin', 'Bugbear', 'Worg']
        : ['Goblin', 'Hobgoblin', 'Bugbear', 'Worg', 'Hobgoblin Captain']);

    const placeholders = goblinNames.map(() => '?').join(', ');
    const goblins = db.prepare(`
      SELECT * FROM monsters
      WHERE name IN (${placeholders})
      ORDER BY challenge_rating ASC, id ASC
    `).all(...goblinNames);

    if (goblins.length > 0) {
      const weights = goblins.map((m) => {
        if (m.name === 'Goblin') return 70;
        if (m.name === 'Hobgoblin') return 30;
        if (m.name === 'Bugbear' || m.name === 'Worg') return 20;
        return 12;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      for (let i = 0; i < goblins.length; i++) {
        if (r < weights[i]) return wrapResult(goblins[i], 'GOBLIN');
        r -= weights[i];
      }
      return wrapResult(goblins[0], 'GOBLIN');
    }
  }

  // Bucket 2: 15% Forest animals (0.80 <= roll < 0.95)
  if (categoryRoll < 0.95) {
    const animalNames = lvl <= 1
      ? ['Dire Rat', 'Viper', 'Blood Hawk', 'Wolf']
      : ['Dire Rat', 'Viper', 'Blood Hawk', 'Wolf', 'Boar'];
    const placeholders = animalNames.map(() => '?').join(', ');
    const animals = db.prepare(`
      SELECT * FROM monsters
      WHERE name IN (${placeholders})
      ORDER BY challenge_rating ASC, id ASC
    `).all(...animalNames);

    if (animals.length > 0) {
      const idx = Math.min(animals.length - 1, Math.floor(rng() * animals.length));
      return wrapResult(animals[idx], 'ANIMAL');
    }
  }

  // Bucket 3: 5% Other appropriate forest monsters (0.95 <= roll < 1.00)
  const otherNames = lvl <= 1
    ? ['Mite', 'Stirge', 'Vegepygmy', 'Giant Spider']
    : ['Mite', 'Stirge', 'Vegepygmy', 'Giant Spider', 'Orc'];
  const placeholders = otherNames.map(() => '?').join(', ');
  const others = db.prepare(`
    SELECT * FROM monsters
    WHERE name IN (${placeholders})
    ORDER BY challenge_rating ASC, id ASC
  `).all(...otherNames);

  if (others.length > 0) {
    const idx = Math.min(others.length - 1, Math.floor(rng() * others.length));
    return wrapResult(others[idx], 'OTHER');
  }

  const fallback = db.prepare("SELECT * FROM monsters WHERE name = 'Goblin' LIMIT 1").get();
  return wrapResult(fallback, 'GOBLIN');
}

/**
 * Resolves the data-driven Danger Zone profile for any tile across Goblin Forest and Undead Lands.
 */
function resolveTileDangerZone(db, tile) {
  if (!tile || Number(tile.is_safe) === 1 || tile.terrain === 'CITY') {
    return { ...DANGER_ZONE_PROFILES.OAKHAVEN_SAFE };
  }
  if (isGoblinStrongholdTile(tile)) {
    return {
      zoneKey: 'GOBLIN_STRONGHOLD_GATE',
      zoneName: 'Goblin Stronghold Gate',
      dangerLevel: 'VERY_HIGH',
      dangerLabel: 'Major Landmark (Boss Gate)',
      encounterRate: 0.0,
      ambushShare: 0.0,
      minStepsBetweenCombats: 0,
      streakDampeningPerEvent: 0.0,
      monsterPool: ['Hobgoblin Captain', 'Bugbear', 'Worg'],
      description: 'The fortified inner stockade of Warchief Grak.'
    };
  }
  if (isGoblinCaveTile(tile)) {
    return {
      zoneKey: 'GOBLIN_CAVE_ENTRANCE',
      zoneName: 'The Goblin Cave Entrance',
      dangerLevel: 'VERY_HIGH',
      dangerLabel: 'Major Landmark (Dungeon Entrance)',
      encounterRate: 0.0,
      ambushShare: 0.0,
      minStepsBetweenCombats: 0,
      streakDampeningPerEvent: 0.0,
      monsterPool: ['Goblin', 'Hobgoblin', 'Bugbear', 'Giant Spider'],
      description: 'The yawning subterranean mouth of the Goblin Cave beneath Whispering Crags.'
    };
  }
  if (isAncientCryptTile(tile)) {
    return {
      zoneKey: 'ANCIENT_CRYPT_ENTRANCE',
      zoneName: 'The Ancient Crypt Entrance',
      dangerLevel: 'EXTREME',
      dangerLabel: 'Major Landmark (Crypt Sepulcher)',
      encounterRate: 0.0,
      ambushShare: 0.0,
      minStepsBetweenCombats: 0,
      streakDampeningPerEvent: 0.0,
      monsterPool: ['Skeleton', 'Ghoul', 'Shadow', 'Wight', 'Wraith'],
      description: 'The sealed obsidian sepulcher of the Ancient Crypt.'
    };
  }

  const x = Number(tile.x);
  const y = Number(tile.y);
  const meta = TILE_META_BY_COORD.get(`${x},${y}`);
  const landmarkKey = tile.landmark_key || (meta && meta.landmarkKey) || null;
  const regionKey = tile.region_key || (meta && meta.region_key) || (x >= 23 && y <= 26 ? 'UNDEAD_LANDS' : 'BLACKWOOD_FOREST');
  const hasPathConnections = Boolean(
    (meta && Array.isArray(meta.pathConnections) && meta.pathConnections.length > 0) ||
    tile.feature === 'FOREST_TRAIL' ||
    tile.feature === 'SEPULCHER_ROAD' ||
    tile.terrain === 'BRIDGE' ||
    tile.terrain === 'ROAD'
  );

  let selectedKey = 'GOBLIN_FOREST_OFF_ROAD';
  const distToStrongholdX = Math.abs(x - STRONGHOLD_COORD.x);
  const distToStrongholdY = Math.abs(y - STRONGHOLD_COORD.y);
  const distToGoblinCaveX = Math.abs(x - GOBLIN_CAVE_COORD.x);
  const distToGoblinCaveY = Math.abs(y - GOBLIN_CAVE_COORD.y);

  if (regionKey === 'UNDEAD_LANDS') {
    if (y <= 8 || landmarkKey === 'CRYPT_APPROACH' || landmarkKey === 'BLIGHTED_CHAPEL') {
      selectedKey = 'CRYPT_SEPULCHER_APPROACH';
    } else if (hasPathConnections) {
      selectedKey = 'UNDEAD_BARROW_ROAD';
    } else {
      selectedKey = 'UNDEAD_MIRE_OFF_ROAD';
    }
  } else if ((distToStrongholdX <= 2 && distToStrongholdY <= 3) || (y <= 5 && x >= 12 && x <= 18)) {
    selectedKey = 'STRONGHOLD_APPROACH';
  } else if (distToGoblinCaveX <= 2 && distToGoblinCaveY <= 2) {
    selectedKey = 'GOBLIN_CAVE_APPROACH';
  } else if (landmarkKey === 'GOBLIN_HUNTING_GROUNDS' || (x >= 18 && x <= 22 && y >= 10 && y <= 15 && !hasPathConnections)) {
    selectedKey = 'GOBLIN_HUNTING_GROUNDS';
  } else if (hasPathConnections) {
    selectedKey = 'GOBLIN_FOREST_ROAD';
  } else {
    selectedKey = 'GOBLIN_FOREST_OFF_ROAD';
  }

  const baseProfile = DANGER_ZONE_PROFILES[selectedKey] || DANGER_ZONE_PROFILES.GOBLIN_FOREST_ROAD;

  if (db) {
    try {
      const dbRow = db.prepare('SELECT * FROM danger_zone_profiles WHERE zone_key = ?').get(selectedKey);
      if (dbRow) {
        let pool = baseProfile.monsterPool;
        try {
          const parsed = JSON.parse(dbRow.monster_pool_json || '[]');
          if (Array.isArray(parsed) && parsed.length > 0) pool = parsed;
        } catch {
          // Use baseProfile pool
        }
        return {
          ...baseProfile,
          zoneName: dbRow.zone_name || baseProfile.zoneName,
          dangerLevel: dbRow.danger_level || baseProfile.dangerLevel,
          encounterRate: Number(dbRow.encounter_rate ?? baseProfile.encounterRate),
          ambushShare: Number(dbRow.ambush_share ?? baseProfile.ambushShare),
          minStepsBetweenCombats: Number(dbRow.min_steps_between_combats ?? baseProfile.minStepsBetweenCombats),
          streakDampeningPerEvent: Number(dbRow.streak_dampening_per_event ?? baseProfile.streakDampeningPerEvent),
          monsterPool: pool,
          description: dbRow.description || baseProfile.description
        };
      }
    } catch {
      // Fallback to in-memory constant
    }
  }

  return { ...baseProfile };
}

function computePhase9ThreatDecision(db, character, currentTile, targetTile, options = {}) {
  const rng = options.rng || Math.random;
  const zone = resolveTileDangerZone(db, targetTile);

  if (!targetTile || Number(targetTile.is_safe) === 1 || isMajorLandmarkTile(targetTile)) {
    return {
      outcome: 'NORMAL',
      encounterChancePercent: 0,
      ambushProbability: 0,
      zone,
      streakProtected: false,
      ambushFoiledByRanger: false,
      level1AmbushProtected: false
    };
  }

  if (options.forcedChance !== undefined && Number(options.forcedChance) <= 0) {
    return {
      outcome: 'NORMAL',
      encounterChancePercent: 0,
      ambushProbability: 0,
      zone,
      streakProtected: false,
      ambushFoiledByRanger: false,
      level1AmbushProtected: false
    };
  }

  const stepsSinceLastCombat = options.stepsSinceLastCombat !== undefined ? Number(options.stepsSinceLastCombat) : 99;
  const recentThreatStreak = Math.max(0, Number(options.recentThreatStreak || 0));

  if (
    options.forcedChance === undefined &&
    options.forceOutcome === undefined &&
    stepsSinceLastCombat < Number(zone.minStepsBetweenCombats || 1)
  ) {
    return {
      outcome: 'NORMAL',
      encounterChancePercent: 0,
      ambushProbability: 0,
      zone,
      streakProtected: true,
      ambushFoiledByRanger: false,
      level1AmbushProtected: false
    };
  }

  const streakDampening = Math.min(0.14, recentThreatStreak * Number(zone.streakDampeningPerEvent || 0.07));
  const effectiveZoneRate = Math.max(0.05, Number(zone.encounterRate || 0.18) - streakDampening);
  const encounterChancePercent = options.forcedChance !== undefined
    ? Math.max(0, Math.min(100, Number(options.forcedChance)))
    : Math.round(effectiveZoneRate * 1000) / 10;

  if (options.forceOutcome !== 'ENCOUNTER' && options.forceOutcome !== 'AMBUSH') {
    const roll = rng() * 100;
    if (roll >= encounterChancePercent) {
      return {
        outcome: 'NORMAL',
        encounterChancePercent,
        ambushProbability: zone.ambushShare,
        zone,
        streakProtected: false,
        ambushFoiledByRanger: false,
        level1AmbushProtected: false
      };
    }
  }

  const heroClass = String((character && character.class) || 'FIGHTER').toUpperCase();
  const wisMod = Math.floor(((Number((character && character.wisdom) || 10)) - 10) / 2);
  const monsterInitBonus = Number((options.monster && options.monster.initiative_bonus) || 0);

  let rawAmbushProb = Number(zone.ambushShare || 0.30) + (monsterInitBonus * 0.025) - (wisMod * 0.035);
  if (heroClass === 'RANGER') {
    rawAmbushProb -= 0.14;
  }
  rawAmbushProb = Math.max(0.06, Math.min(0.75, rawAmbushProb));

  let wantsAmbush = false;
  let ambushFoiledByRanger = false;
  // Phase 9B Owner Decision: Level 1 Ambush protection removed everywhere.
  // Level 1 heroes face the exact same ambush rules as Level 2+.
  const level1AmbushProtected = false;

  if (options.forceOutcome === 'AMBUSH' || options.forceAmbush === true) {
    wantsAmbush = true;
  } else if (options.forceOutcome === 'ENCOUNTER' || options.forceAmbush === false) {
    wantsAmbush = false;
  } else {
    const ambushRoll = rng();
    if (ambushRoll < rawAmbushProb) {
      wantsAmbush = true;
      // Ranger Class Identity: Trail-Sense Scouting converts 50% of potential Ambushes into spotted Encounters
      if (heroClass === 'RANGER' && rng() < 0.50) {
        wantsAmbush = false;
        ambushFoiledByRanger = true;
      }
    }
  }

  const wouldHaveBeenAmbushAtLevel2Plus = wantsAmbush;

  return {
    outcome: wantsAmbush ? 'AMBUSH' : 'ENCOUNTER',
    encounterChancePercent,
    ambushProbability: Number(rawAmbushProb.toFixed(3)),
    zone,
    streakProtected: false,
    ambushFoiledByRanger,
    level1AmbushProtected,
    wouldHaveBeenAmbushAtLevel2Plus
  };
}

function computePhase8StepEncounterChance(db, character, currentTile, targetTile, rawPacingChance = null) {
  if (!targetTile || targetTile.is_safe === 1 || isMajorLandmarkTile(targetTile)) {
    return 0;
  }
  if (rawPacingChance !== null && rawPacingChance !== undefined && Number(rawPacingChance) <= 0) {
    return 0;
  }

  const zone = resolveTileDangerZone(db, targetTile);
  let chance = Number((zone.encounterRate || 0) * 100);

  if (rawPacingChance !== null && rawPacingChance !== undefined) {
    // Scale by any recovery/revisit modifiers from adventure-engine (where FOREST base is 22)
    const ratio = Math.min(1.5, Math.max(0, Number(rawPacingChance) / 22));
    chance = Math.round(chance * ratio * 10) / 10;
  }

  return Math.min(38, Math.max(0, chance));
}

/**
 * Rolls for a regional travel encounter when stepping onto a non-safe, non-major-landmark tile.
 * Preserves Nemesis / persistent monster encounters on normal tiles if a hero died there.
 */
function checkGoblinForestEncounter(db, character, targetTile, options = {}) {
  if (!targetTile || targetTile.is_safe === 1) return null;
  if (isMajorLandmarkTile(targetTile)) {
    return null;
  }

  const rng = options.rng || Math.random;

  // Check if a persistent Nemesis monster (other than the Stronghold Chieftain) lurks on this tile
  const persistentMonster = db.prepare(`
    SELECT mi.*, m.name, m.symbol, m.color, m.descriptions, m.base_hp, m.initiative_bonus
    FROM monster_instances mi
    JOIN monsters m ON mi.monster_id = m.id
    WHERE mi.tile_id = ? AND mi.status = 'ACTIVE'
      AND (mi.custom_title IS NULL OR mi.custom_title != ?)
  `).get(targetTile.id, STRONGHOLD_BOSS_PROFILE.customTitle);

  if (persistentMonster) {
    const ins = db.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id, monster_instance_id,
        status, current_monster_hp, monster_max_hp, combat_round,
        spotted_by_hero, is_ambush, opening_shot_resolved
      ) VALUES (?, ?, ?, ?, 'DISCOVERED', ?, ?, 0, 1, 0, 0)
    `).run(
      character.id,
      targetTile.id,
      persistentMonster.monster_id,
      persistentMonster.id,
      persistentMonster.current_hp || persistentMonster.max_hp,
      persistentMonster.max_hp
    );
    return getEncounterById(db, Number(ins.lastInsertRowid), character.class);
  }

  const decision = computePhase9ThreatDecision(db, character, options.currentTile || null, targetTile, options);
  if (decision.outcome === 'NORMAL') {
    return null;
  }

  const pickedResult = selectRegionalEncounterMonster(db, targetTile, character.level || 1, rng);
  const pickedMonster = pickedResult && pickedResult.monster ? pickedResult.monster : pickedResult;
  if (!pickedMonster) return null;

  const isAmbushOut = decision.outcome === 'AMBUSH' ? 1 : 0;
  const spottedByHeroOut = isAmbushOut === 1 ? 0 : 1;
  const stateMetaJson = JSON.stringify({
    travelOutcome: decision.outcome,
    dangerZoneKey: decision.zone.zoneKey,
    dangerZoneName: decision.zone.zoneName,
    dangerLevel: decision.zone.dangerLevel,
    ambushFoiledByRanger: Boolean(decision.ambushFoiledByRanger),
    level1AmbushProtected: Boolean(decision.level1AmbushProtected),
    allowLevel1Ambush: true,
    labForcedAmbush: Boolean(options.labForcedAmbush)
  });

  const initialMonsterHp = Number(pickedMonster.base_hp || 6);
  const insOut = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status,
      current_monster_hp, monster_max_hp, combat_round,
      spotted_by_hero, is_ambush, opening_shot_resolved, combat_state_json
    ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, ?, ?, 0, ?)
  `).run(
    character.id,
    targetTile.id,
    pickedMonster.id,
    initialMonsterHp,
    initialMonsterHp,
    spottedByHeroOut,
    isAmbushOut,
    stateMetaJson
  );

  const encId = Number(insOut.lastInsertRowid);
  if (isAmbushOut === 1) {
    startCombat(db, character.id, encId, { rng });
  }

  const resolvedEnc = getEncounterById(db, encId, character.class);
  if (resolvedEnc) {
    resolvedEnc.travelOutcome = decision.outcome;
    resolvedEnc.dangerZone = decision.zone;
    resolvedEnc.ambushFoiledByRanger = Boolean(decision.ambushFoiledByRanger);
    resolvedEnc.level1AmbushProtected = Boolean(decision.level1AmbushProtected);
  }
  return resolvedEnc;
}

/**
 * Builds the complete 30×30 (900-tile) top-down map & Region Map payload for the frontend renderer.
 */
function getMajorLandmarkSceneForTile(db, tile) {
  if (!tile) return null;
  const x = Number(tile.x);
  const y = Number(tile.y);
  const meta = TILE_META_BY_COORD.get(`${x},${y}`);
  const landmarkKey = tile.landmark_key || (meta && meta.landmarkKey) || null;

  let sceneKey = null;
  if (
    (x === TOWN_COORD.x && y === TOWN_COORD.y) ||
    (tile.terrain === 'CITY' && Number(tile.is_safe) === 1) ||
    landmarkKey === 'OAKHAVEN'
  ) {
    sceneKey = 'OAKHAVEN';
  } else if (isGoblinStrongholdTile(tile) || landmarkKey === 'GOBLIN_STRONGHOLD') {
    sceneKey = 'GOBLIN_STRONGHOLD';
  } else if (isGoblinCaveTile(tile) || landmarkKey === 'GOBLIN_CAVE') {
    sceneKey = 'GOBLIN_CAVE';
  } else if (isAncientCryptTile(tile) || landmarkKey === 'ANCIENT_CRYPT') {
    sceneKey = 'ANCIENT_CRYPT';
  } else if (landmarkKey && LANDMARK_SCENE_DEFINITIONS[landmarkKey]) {
    sceneKey = landmarkKey;
  }

  if (!sceneKey) {
    return null;
  }

  const baseScene = LANDMARK_SCENE_DEFINITIONS[sceneKey];
  if (!baseScene || !baseScene.isMajorLandmark || !baseScene.autoOpenOnArrival) {
    return null;
  }

  if (db) {
    try {
      const dbRow = db.prepare('SELECT * FROM landmark_scene_definitions WHERE scene_key = ?').get(sceneKey);
      if (dbRow) {
        if (Number(dbRow.is_major_landmark) !== 1 || Number(dbRow.auto_open_on_arrival) !== 1) {
          return null;
        }
        let actions = baseScene.actions;
        try {
          const parsed = JSON.parse(dbRow.actions_json || '[]');
          if (Array.isArray(parsed) && parsed.length > 0) actions = parsed;
        } catch {
          // Use baseScene actions
        }
        return {
          ...baseScene,
          title: dbRow.title || baseScene.title,
          subtitle: dbRow.subtitle || baseScene.subtitle,
          description: dbRow.description || baseScene.description,
          artworkUrl: dbRow.artwork_url || baseScene.artworkUrl,
          actions
        };
      }
    } catch {
      // Fallback to in-memory definition
    }
  }

  return { ...baseScene, actions: baseScene.actions.map((a) => ({ ...a })) };
}

function updateCharacterLandmarkArrival(db, characterId, fromTileId, toTile) {
  if (!db || !characterId || !toTile) return null;
  const movedToDifferentTile = Number(fromTileId || 0) !== Number(toTile.id || 0);
  if (!movedToDifferentTile) return null;

  const sceneDef = getMajorLandmarkSceneForTile(db, toTile);
  try {
    if (sceneDef && sceneDef.autoOpenOnArrival) {
      db.prepare(`
        UPDATE characters
        SET active_landmark_scene_key = ?,
            dismissed_landmark_tile_id = NULL
        WHERE id = ?
      `).run(sceneDef.sceneKey, characterId);
      return sceneDef.sceneKey;
    } else {
      db.prepare(`
        UPDATE characters
        SET active_landmark_scene_key = NULL,
            dismissed_landmark_tile_id = NULL
        WHERE id = ?
      `).run(characterId);
      return null;
    }
  } catch {
    return sceneDef ? sceneDef.sceneKey : null;
  }
}

function dismissLandmarkScene(db, characterId) {
  if (!db || !characterId) return { dismissed: false };
  try {
    const charRow = db.prepare('SELECT id, tile_id FROM characters WHERE id = ?').get(characterId);
    if (!charRow) return { dismissed: false };
    db.prepare(`
      UPDATE characters
      SET active_landmark_scene_key = NULL,
          dismissed_landmark_tile_id = ?
      WHERE id = ?
    `).run(charRow.tile_id || null, characterId);
    return { dismissed: true, tileId: charRow.tile_id };
  } catch {
    return { dismissed: false };
  }
}

function openLandmarkScene(db, characterId) {
  if (!db || !characterId) return { opened: false };
  try {
    const charRow = db.prepare('SELECT id, tile_id FROM characters WHERE id = ?').get(characterId);
    if (!charRow || !charRow.tile_id) return { opened: false };
    const tile = getTileById(db, charRow.tile_id);
    const sceneDef = getMajorLandmarkSceneForTile(db, tile);
    if (!sceneDef) return { opened: false };
    db.prepare(`
      UPDATE characters
      SET active_landmark_scene_key = ?,
          dismissed_landmark_tile_id = NULL
      WHERE id = ?
    `).run(sceneDef.sceneKey, characterId);
    return { opened: true, sceneKey: sceneDef.sceneKey };
  } catch {
    return { opened: false };
  }
}

function resolveLandmarkSceneState(db, character, currentTile, activeEncounter = null, victory = null) {
  if (!character || Number(character.is_alive) !== 1 || !currentTile) {
    return null;
  }
  if (activeEncounter || victory) {
    return null;
  }

  const sceneDef = getMajorLandmarkSceneForTile(db, currentTile);
  if (!sceneDef) {
    return null;
  }

  const dismissedTileId = character.dismissed_landmark_tile_id !== undefined && character.dismissed_landmark_tile_id !== null
    ? Number(character.dismissed_landmark_tile_id)
    : null;
  const activeKey = character.active_landmark_scene_key || null;

  let isActive = false;
  if (dismissedTileId !== null && dismissedTileId === Number(currentTile.id)) {
    isActive = false;
  } else if (activeKey === sceneDef.sceneKey) {
    isActive = true;
  } else if (activeKey === null && dismissedTileId === null) {
    isActive = true;
    try {
      db.prepare('UPDATE characters SET active_landmark_scene_key = ? WHERE id = ?').run(sceneDef.sceneKey, character.id);
    } catch {
      // Ignore read-only DB
    }
  }

  const questState = syncCharacterQuestState(db, character.id);
  const bossSlain = Boolean(questState && questState.bossSlain);

  let description = sceneDef.description;
  const actions = (sceneDef.actions || []).map((act) => {
    if (act.action === 'ENGAGE_STRONGHOLD_BOSS') {
      return {
        ...act,
        disabled: bossSlain,
        label: bossSlain ? 'Goblin Chieftain Vanquished' : act.label
      };
    }
    return { ...act };
  });

  if (sceneDef.sceneKey === 'GOBLIN_STRONGHOLD' && bossSlain) {
    description = 'The war-drums of the Goblin Stronghold have fallen silent. Warchief Grak lies vanquished, and the surviving goblins have scattered into the deep woods.';
  }

  return {
    sceneKey: sceneDef.sceneKey,
    landmarkType: sceneDef.landmarkType,
    category: sceneDef.category,
    title: sceneDef.title,
    subtitle: sceneDef.subtitle,
    description,
    artworkUrl: sceneDef.artworkUrl,
    isMajorLandmark: true,
    isActive,
    bossSlain: sceneDef.sceneKey === 'GOBLIN_STRONGHOLD' ? bossSlain : undefined,
    canChallengeBoss: sceneDef.sceneKey === 'GOBLIN_STRONGHOLD' ? !bossSlain : undefined,
    tileId: currentTile.id,
    tileCoord: { x: Number(currentTile.x), y: Number(currentTile.y) },
    actions
  };
}

function runPhase9MonteCarloSimulation(db, options = {}) {
  const trials = Math.max(50, Math.min(5000, Number(options.trials || 1000)));
  const routeCoords = Array.isArray(options.route) && options.route.length > 1
    ? options.route
    : ROUTE_A_MAIN_TRAIL;
  const heroClass = String(options.heroClass || 'FIGHTER').toUpperCase();
  const heroLevel = Number(options.heroLevel || 2);
  const heroWisdom = Number(options.heroWisdom || (heroClass === 'RANGER' || heroClass === 'CLERIC' ? 14 : 10));
  const allowLevel1Ambush = Boolean(options.allowLevel1Ambush);

  let seed = Number(options.seed || 9001);
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const routeTiles = routeCoords.map(([x, y]) => {
    const meta = TILE_META_BY_COORD.get(`${x},${y}`) || {};
    return {
      id: y * 30 + x + 1,
      x,
      y,
      name: meta.name || `Tile [${x},${y}]`,
      terrain: meta.terrain || 'FOREST',
      feature: meta.feature || null,
      is_safe: meta.is_safe || 0,
      landmark_key: meta.landmarkKey || null
    };
  });

  const character = {
    id: 0,
    class: heroClass,
    level: heroLevel,
    wisdom: heroWisdom
  };

  let totalThreats = 0;
  let totalNormals = 0;
  let totalEncounters = 0;
  let totalAmbushes = 0;
  let totalRangerFoiled = 0;
  let totalLevel1Protected = 0;
  const threatsPerTrip = [];

  for (let t = 0; t < trials; t++) {
    let stepsSinceLastCombat = 99;
    let recentThreatStreak = 0;
    let tripThreats = 0;

    for (let i = 1; i < routeTiles.length; i++) {
      const prevTile = routeTiles[i - 1];
      const nextTile = routeTiles[i];
      const decision = computePhase9ThreatDecision(db, character, prevTile, nextTile, {
        rng: nextRand,
        stepsSinceLastCombat,
        recentThreatStreak,
        allowLevel1Ambush,
        monster: { initiative_bonus: 2 }
      });

      if (decision.outcome === 'NORMAL') {
        totalNormals++;
        stepsSinceLastCombat++;
        if (stepsSinceLastCombat >= 3) {
          recentThreatStreak = Math.max(0, recentThreatStreak - 1);
        }
      } else {
        tripThreats++;
        totalThreats++;
        stepsSinceLastCombat = 0;
        recentThreatStreak++;
        if (decision.outcome === 'AMBUSH') {
          totalAmbushes++;
        } else {
          totalEncounters++;
        }
        if (decision.ambushFoiledByRanger) totalRangerFoiled++;
        if (decision.level1AmbushProtected) totalLevel1Protected++;
      }
    }
    threatsPerTrip.push(tripThreats);
  }

  threatsPerTrip.sort((a, b) => a - b);
  const avgThreats = Number((totalThreats / trials).toFixed(2));
  const avgEncounters = Number((totalEncounters / trials).toFixed(2));
  const avgAmbushes = Number((totalAmbushes / trials).toFixed(2));
  const avgNormals = Number((totalNormals / trials).toFixed(2));
  const medianThreats = threatsPerTrip[Math.floor(trials / 2)];
  const p10Threats = threatsPerTrip[Math.floor(trials * 0.10)];
  const p90Threats = threatsPerTrip[Math.floor(trials * 0.90)];

  return {
    trials,
    stepsPerTrip: routeTiles.length - 1,
    heroClass,
    heroLevel,
    allowLevel1Ambush,
    avgThreats,
    avgEncounters,
    avgAmbushes,
    avgNormals,
    encounterShareOfThreats: totalThreats > 0 ? Number(((totalEncounters / totalThreats) * 100).toFixed(1)) : 0,
    ambushShareOfThreats: totalThreats > 0 ? Number(((totalAmbushes / totalThreats) * 100).toFixed(1)) : 0,
    rangerAmbushConversions: totalRangerFoiled,
    level1AmbushProtections: totalLevel1Protected,
    medianThreats,
    p10Threats,
    p90Threats
  };
}

function buildTopdownMapPayload(db, character, currentTile) {
  const heroX = currentTile ? Number(currentTile.x) : TOWN_COORD.x;
  const heroY = currentTile ? Number(currentTile.y) : TOWN_COORD.y;
  const heroFacing = (character && character.facing) || 'NORTH';
  const visionRadius = getHeroVisionRadius(character);

  if (character && character.id) {
    recordTileDiscovery(db, character, heroX, heroY);
  }

  const discoveredSet = getDiscoveredCoordSet(db, character ? character.id : null);
  const questState = syncCharacterQuestState(db, character ? character.id : null);

  const rows = db.prepare(`
    SELECT id, x, y, name, terrain, feature, description, is_passable, is_safe,
           region_key, biome, visual_type, visual_kind, path_connections,
           is_landmark, landmark_key, encounter_profile_key
    FROM map_tiles
    WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?
    ORDER BY y ASC, x ASC
  `).all(
    TOPDOWN_REGION_BOUNDS.minX,
    TOPDOWN_REGION_BOUNDS.maxX,
    TOPDOWN_REGION_BOUNDS.minY,
    TOPDOWN_REGION_BOUNDS.maxY
  );

  const activeInstances = db.prepare(`
    SELECT tile_id, custom_title, kill_count, status
    FROM monster_instances
    WHERE status = 'ACTIVE'
  `).all();
  const instanceByTileId = new Map();
  for (const inst of activeInstances) {
    instanceByTileId.set(Number(inst.tile_id), inst);
  }

  const maxVisibleDistSq = visionRadius * visionRadius + 1;

  const tiles = rows.map((r) => {
    const coordKey = `${r.x},${r.y}`;
    const meta = TILE_META_BY_COORD.get(coordKey) || {};
    const inst = instanceByTileId.get(Number(r.id));
    const isStronghold = isGoblinStrongholdTile(r);
    const isGoblinCave = isGoblinCaveTile(r);
    const isAncientCrypt = isAncientCryptTile(r);
    const isTown = r.terrain === 'CITY' && Number(r.is_safe) === 1;
    const regionKey = r.region_key || meta.region_key || (Number(r.x) >= 23 && Number(r.y) <= 26 ? 'UNDEAD_LANDS' : 'BLACKWOOD_FOREST');
    const biome = r.biome || meta.biome || regionKey;
    const isUndeadLands = regionKey === 'UNDEAD_LANDS';
    const visualType = r.visual_type || meta.visualType || (isTown ? 'TOWN_SANCTUARY' : 'DEEP_FOREST');
    const visualKind = r.visual_kind || meta.visualKind || 'DENSE_WOODS';

    let pathConnections = meta.pathConnections || [];
    if (r.path_connections && typeof r.path_connections === 'string') {
      try {
        const parsed = JSON.parse(r.path_connections);
        if (Array.isArray(parsed)) pathConnections = parsed;
      } catch {
        // Use meta.pathConnections
      }
    }

    const dx = Number(r.x) - heroX;
    const dy = Number(r.y) - heroY;
    const distSq = dx * dx + dy * dy;
    const isVisibleNow = distSq <= maxVisibleDistSq;
    const isDiscovered = isVisibleNow || discoveredSet.has(coordKey);
    const isLandmark = Boolean(Number(r.is_landmark) === 1 || meta.isLandmark);
    const landmarkKey = r.landmark_key || meta.landmarkKey || null;

    return {
      id: r.id,
      x: r.x,
      y: r.y,
      name: r.name,
      terrain: r.terrain,
      feature: r.feature,
      description: r.description,
      isPassable: Number(r.is_passable) === 1,
      isSafe: Number(r.is_safe) === 1,
      isTown,
      isStronghold,
      isGoblinCave,
      isAncientCrypt,
      isUndeadLands,
      regionKey,
      biome,
      isLandmark,
      landmarkKey,
      isDiscovered,
      isVisibleNow,
      visualType,
      visualKind,
      pathConnections,
      hasNemesis: Boolean(inst && !isStronghold),
      strongholdBossActive: isStronghold ? Boolean(questState && !questState.bossSlain) : false
    };
  });

  const atStronghold = isGoblinStrongholdTile(currentTile);
  const atGoblinCave = isGoblinCaveTile(currentTile);
  const atAncientCrypt = isAncientCryptTile(currentTile);
  const bossSlain = Boolean(questState && questState.bossSlain);
  const strongholdDiscovered = discoveredSet.has(`${STRONGHOLD_COORD.x},${STRONGHOLD_COORD.y}`);
  const goblinCaveDiscovered = discoveredSet.has(`${GOBLIN_CAVE_COORD.x},${GOBLIN_CAVE_COORD.y}`);
  const ancientCryptDiscovered = discoveredSet.has(`${ANCIENT_CRYPT_COORD.x},${ANCIENT_CRYPT_COORD.y}`);

  const currentMeta = TILE_META_BY_COORD.get(`${heroX},${heroY}`) || {};
  const currentRegionKey = (currentTile && currentTile.region_key) || currentMeta.region_key || (heroX >= 23 && heroY <= 26 ? 'UNDEAD_LANDS' : 'BLACKWOOD_FOREST');
  const currentRegionName = currentRegionKey === 'UNDEAD_LANDS'
    ? 'The Undead Lands (Ashen Barrowlands & Necropolis)'
    : 'Blackwood Forest (Goblin Forest)';

  // Build Region Map summary (only includes discovered landmarks + Oakhaven)
  const discoveredLandmarks = Object.values(LANDMARK_DEFINITIONS)
    .filter((lm) => lm.alwaysKnown || discoveredSet.has(`${lm.x},${lm.y}`))
    .map((lm) => ({
      key: lm.key,
      name: lm.name,
      category: lm.category,
      x: lm.x,
      y: lm.y,
      regionKey: lm.x >= 23 && lm.y <= 26 ? 'UNDEAD_LANDS' : 'BLACKWOOD_FOREST',
      isDiscovered: true,
      isStronghold: lm.key === 'GOBLIN_STRONGHOLD',
      isGoblinCave: lm.key === 'GOBLIN_CAVE',
      isAncientCrypt: lm.key === 'ANCIENT_CRYPT',
      bossSlain: lm.key === 'GOBLIN_STRONGHOLD' ? bossSlain : undefined
    }));

  const discoveredCount = tiles.filter((t) => t.isDiscovered).length;
  const totalPassableCount = tiles.filter((t) => t.isPassable).length;
  const discoveredPassableCount = tiles.filter((t) => t.isPassable && t.isDiscovered).length;
  const discoveryPercent = totalPassableCount > 0 ? Math.round((discoveredPassableCount / totalPassableCount) * 100) : 0;

  return {
    worldVersion: TOPDOWN_WORLD_VERSION,
    bounds: TOPDOWN_REGION_BOUNDS,
    minX: TOPDOWN_REGION_BOUNDS.minX,
    maxX: TOPDOWN_REGION_BOUNDS.maxX,
    minY: TOPDOWN_REGION_BOUNDS.minY,
    maxY: TOPDOWN_REGION_BOUNDS.maxY,
    viewportConfig: {
      visibleCols: 11,
      visibleRows: 9,
      smoothing: 0.22
    },
    townCoord: TOWN_COORD,
    northGateCoord: NORTH_GATE_COORD,
    strongholdCoord: STRONGHOLD_COORD,
    goblinCaveCoord: GOBLIN_CAVE_COORD,
    ancientCryptCoord: ANCIENT_CRYPT_COORD,
    strongholdDiscovered,
    goblinCaveDiscovered,
    ancientCryptDiscovered,
    currentRegionKey,
    currentRegionName,
    heroCoord: { x: heroX, y: heroY },
    heroX,
    heroY,
    heroFacing,
    visionRadius,
    discoveredCount,
    discoveredTileCount: discoveredCount,
    totalTiles: TOPDOWN_REGION_BOUNDS.totalTiles,
    bossSlain,
    atStronghold,
    atGoblinCave,
    atAncientCrypt,
    strongholdEntrance: {
      title: STRONGHOLD_BOSS_PROFILE.entranceTitle,
      description: STRONGHOLD_BOSS_PROFILE.entranceDescription,
      imageUrl: STRONGHOLD_BOSS_PROFILE.entranceImageUrl,
      bossName: STRONGHOLD_BOSS_PROFILE.customTitle,
      bossSlain,
      canChallengeBoss: Boolean(atStronghold && !bossSlain)
    },
    regionMap: {
      regionKey: currentRegionKey,
      regionName: currentRegionName,
      regions: [
        {
          key: 'BLACKWOOD_FOREST',
          name: 'Blackwood Forest (Goblin Forest)',
          majorLandmarks: ['OAKHAVEN', 'GOBLIN_CAVE', 'GOBLIN_STRONGHOLD']
        },
        {
          key: 'UNDEAD_LANDS',
          name: 'The Undead Lands',
          majorLandmarks: ['ANCIENT_CRYPT']
        }
      ],
      discoveredCount,
      discoveredPassableCount,
      totalPassableCount,
      discoveryPercent,
      totalTiles: TOPDOWN_REGION_BOUNDS.totalTiles,
      strongholdDiscovered,
      goblinCaveDiscovered,
      ancientCryptDiscovered,
      landmarks: discoveredLandmarks,
      discoveredLandmarks
    },
    tiles
  };
}

function computeCameraViewportMetrics(cssWidth, cssHeight, mapData, focusX, focusY) {
  const minX = mapData.minX ?? (mapData.bounds && mapData.bounds.minX) ?? 0;
  const maxX = mapData.maxX ?? (mapData.bounds && mapData.bounds.maxX) ?? 29;
  const minY = mapData.minY ?? (mapData.bounds && mapData.bounds.minY) ?? 0;
  const maxY = mapData.maxY ?? (mapData.bounds && mapData.bounds.maxY) ?? 29;
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const targetVisibleCols = 11.5;
  const targetVisibleRows = 8.5;
  const rawTileSize = Math.min(cssWidth / targetVisibleCols, cssHeight / targetVisibleRows);
  const tileSize = Math.max(46, Math.min(96, Math.round(rawTileSize)));

  const worldPixelW = cols * tileSize;
  const worldPixelH = rows * tileSize;

  const fx = typeof focusX === 'number' ? focusX : ((mapData.heroCoord && mapData.heroCoord.x) ?? 15);
  const fy = typeof focusY === 'number' ? focusY : ((mapData.heroCoord && mapData.heroCoord.y) ?? 27);

  const heroWorldPxX = (fx - minX + 0.5) * tileSize;
  const heroWorldPxY = (fy - minY + 0.5) * tileSize;

  const idealCamPxX = heroWorldPxX - cssWidth / 2;
  const idealCamPxY = heroWorldPxY - cssHeight / 2;

  const maxCamPxX = Math.max(0, worldPixelW - cssWidth);
  const maxCamPxY = Math.max(0, worldPixelH - cssHeight);

  const camPxX = worldPixelW <= cssWidth
    ? Math.floor((worldPixelW - cssWidth) / 2)
    : Math.max(0, Math.min(maxCamPxX, idealCamPxX));
  const camPxY = worldPixelH <= cssHeight
    ? Math.floor((worldPixelH - cssHeight) / 2)
    : Math.max(0, Math.min(maxCamPxY, idealCamPxY));

  const visibleCols = Number((cssWidth / tileSize).toFixed(2));
  const visibleRows = Number((cssHeight / tileSize).toFixed(2));

  return {
    minX,
    maxX,
    minY,
    maxY,
    cols,
    rows,
    tileSize,
    worldPixelW,
    worldPixelH,
    camPxX,
    camPxY,
    visibleCols,
    visibleRows,
    cssWidth,
    cssHeight
  };
}

module.exports = {
  TOPDOWN_WORLD_VERSION,
  TOPDOWN_REGION_BOUNDS,
  TOPDOWN_BOUNDS: TOPDOWN_REGION_BOUNDS,
  TOWN_COORD,
  NORTH_GATE_COORD,
  STRONGHOLD_COORD,
  GOBLIN_CAVE_COORD,
  ANCIENT_CRYPT_COORD,
  LANDMARK_DEFINITIONS,
  LANDMARK_METADATA: LANDMARK_DEFINITIONS,
  ROUTE_A_MAIN_TRAIL,
  ROUTE_B_WESTERN_WILDERNESS,
  ROUTE_C_EASTERN_RIVER,
  ROUTE_D_UNDEAD_SEPULCHER_ROAD,
  QUEST_GOBLIN_CHIEFTAIN,
  QUEST_STATUS_LABELS,
  STRONGHOLD_BOSS_PROFILE,
  TOPDOWN_REGION_TILES,
  TOPDOWN_TILES: TOPDOWN_REGION_TILES,
  computeCameraViewportMetrics,
  isCoordInTopdownRegion,
  isGoblinStrongholdTile,
  isGoblinCaveTile,
  isAncientCryptTile,
  isMajorLandmarkTile,
  getHeroVisionRadius,
  recordTileDiscovery,
  getDiscoveredCoordSet,
  mapLegacyCoordToPhase8,
  applyTopdownExperimentWorld,
  ensureStrongholdBossInstance,
  markStrongholdBossSlain,
  syncCharacterQuestState,
  getCharacterQuests,
  acceptGoblinChieftainQuest,
  claimGoblinChieftainReward,
  startStrongholdBossEncounter,
  startLandmarkDungeonEncounter,
  selectGoblinForestMonster,
  selectGoblinCaveMonster,
  selectUndeadLandsMonster,
  selectRegionalEncounterMonster,
  computePhase8StepEncounterChance,
  checkGoblinForestEncounter,
  buildTopdownMapPayload,
  DANGER_ZONE_PROFILES,
  LANDMARK_SCENE_DEFINITIONS,
  ensurePhase9DefinitionsSeeded,
  resolveTileDangerZone,
  computePhase9ThreatDecision,
  getMajorLandmarkSceneForTile,
  updateCharacterLandmarkArrival,
  dismissLandmarkScene,
  openLandmarkScene,
  resolveLandmarkSceneState,
  runPhase9MonteCarloSimulation
};
