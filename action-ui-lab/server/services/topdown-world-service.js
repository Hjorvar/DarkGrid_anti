/**
 * DARKGRID — Top-Down Exploration Experiment 1 Service
 *
 * Implements the cohesive 8×7 (56-tile) Top-Down Town & Goblin Forest (Blackwood Forest)
 * exploration region, the "The Goblin Chieftain" quest lifecycle, the persistent
 * Goblin Stronghold world boss at [7, 1], and the 80% / 15% / 5% Goblin Forest
 * encounter selection rules while preserving all Phase 7C combat, class, inventory,
 * progression, permadeath, and Nemesis systems.
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

const TOPDOWN_REGION_BOUNDS = Object.freeze({
  minX: 4,
  maxX: 11,
  minY: 1,
  maxY: 7,
  width: 8,
  height: 7,
  cols: 8,
  rows: 7,
  totalTiles: 56
});

const TOWN_COORD = Object.freeze({ x: 7, y: 7 });
const STRONGHOLD_COORD = Object.freeze({ x: 7, y: 1 });

const QUEST_GOBLIN_CHIEFTAIN = Object.freeze({
  key: 'THE_GOBLIN_CHIEFTAIN',
  title: 'The Goblin Chieftain',
  giver: 'Captain Vane of Oakhaven Watch',
  regionName: 'Blackwood Forest (Goblin Forest)',
  strongholdName: 'Goblin Stronghold',
  strongholdCoord: { x: 7, y: 1 },
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
  customTitle: 'Warchief Grak the Goblin Chieftain',
  preferredMonsterName: 'Hobgoblin',
  fallbackMonsterId: 12,
  maxHp: 14,
  heldGold: 45,
  entranceImageUrl: '/images/terrain/terrain_town_gates.webp',
  entranceTitle: 'The Goblin Stronghold of Blackwood',
  entranceDescription:
    'Sharpened timber palisades and a crude watchtower rise through the choking mist of northern Blackwood Forest. Iron braziers burn with foul pitch beside the spiked gate where the Goblin Chieftain holds court.'
});

/**
 * Authoritative 8×7 (56-tile) layout for Oakhaven & Blackwood (Goblin) Forest.
 * Coordinates: x = 4..11 (8 columns), y = 1..7 (7 rows).
 */
const TOPDOWN_REGION_TILES = Object.freeze([
  // Row y = 1 (Northern Stronghold & Deep Blackwood Ridge)
  {
    x: 4, y: 1,
    name: 'Blackwood North-West Clearing',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['E', 'S'],
    description: 'Gnawed bones and crude goblin totems hang from pine boughs along the northwestern bend of the forest trail.'
  },
  {
    x: 5, y: 1,
    name: 'Shadowed Pine Approach',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['W', 'S'],
    description: 'A narrow needle-strewn track winding beneath ancient black pines west of the stronghold palisades.'
  },
  {
    x: 6, y: 1,
    name: 'Western Stronghold Palisade',
    terrain: 'MOUNTAINS',
    feature: 'STRONGHOLD_PALISADE_WEST',
    is_passable: 0, is_safe: 0,
    visualType: 'STRONGHOLD_WALL_WEST',
    pathConnections: [],
    description: 'Jagged timber stakes lashed with iron chain and banked against sheer forest crags block passage to the west of the gate.'
  },
  {
    x: 7, y: 1,
    name: 'Goblin Stronghold',
    terrain: 'FOREST',
    feature: 'GOBLIN_STRONGHOLD',
    is_passable: 1, is_safe: 0,
    visualType: 'STRONGHOLD_GATE',
    pathConnections: ['S'],
    description: 'The fortified timber gate and watchtower of the Goblin Stronghold. Torchlight flickers across tribal war-banners.'
  },
  {
    x: 8, y: 1,
    name: 'Eastern Stronghold Watchtower',
    terrain: 'MOUNTAINS',
    feature: 'STRONGHOLD_PALISADE_EAST',
    is_passable: 0, is_safe: 0,
    visualType: 'STRONGHOLD_WALL_EAST',
    pathConnections: [],
    description: 'A timber watchtower and sharpened log palisade crowning a rocky ledge, sealing the eastern flank of the stronghold.'
  },
  {
    x: 9, y: 1,
    name: 'Goblin Lookout Ridge',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['E', 'S'],
    description: 'Trampled earth and spent arrow shafts mark a goblin sentry path overlooking the northern ravine.'
  },
  {
    x: 10, y: 1,
    name: 'Blackwood North-East Trail',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['W', 'S'],
    description: 'Twisted roots and moss-clad boulders line a quiet smugglers trail through the northeastern woods.'
  },
  {
    x: 11, y: 1,
    name: 'Ironwood Edge',
    terrain: 'FOREST',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'DEEP_FOREST',
    pathConnections: [],
    description: 'Dense ironwood trunks and thorny brambles press close along the northeastern boundary of Blackwood Forest.'
  },

  // Row y = 2 (Stronghold Approach & Lateral Flanking Trails)
  {
    x: 4, y: 2,
    name: 'Thornbriar Thicket',
    terrain: 'MOUNTAINS',
    feature: 'IMPASSABLE_THICKET',
    is_passable: 0, is_safe: 0,
    visualType: 'THICKET_BLOCK',
    pathConnections: [],
    description: 'An impenetrable wall of razor-sharp blackbriar and fallen trunks that no traveler can force on foot.'
  },
  {
    x: 5, y: 2,
    name: 'Western Outrider Path',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'E', 'S'],
    description: 'Bootprints and wolf-tracks mingle in the dark loam where the western trail bends toward the stronghold.'
  },
  {
    x: 6, y: 2,
    name: 'Stronghold West Flank',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['W', 'E', 'S'],
    description: 'Smoke from the stronghold braziers drifts low between the trees, carrying the harsh clatter of goblin iron.'
  },
  {
    x: 7, y: 2,
    name: 'Stronghold Approach',
    terrain: 'FOREST',
    feature: 'STRONGHOLD_APPROACH',
    is_passable: 1, is_safe: 0,
    visualType: 'STRONGHOLD_APPROACH',
    pathConnections: ['N', 'W', 'E', 'S'],
    description: 'A rutted war-path leading directly north to the timber gate and watchtower of the Goblin Stronghold.'
  },
  {
    x: 8, y: 2,
    name: 'Stronghold East Flank',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['W', 'E', 'S'],
    description: 'Crude warning skulls on stakes mark the eastern approach to the goblin fortress.'
  },
  {
    x: 9, y: 2,
    name: 'Ravine Headwaters Glade',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E', 'S'],
    description: 'Cold mist rises where a dark forest spring feeds the Blackwater Ravine to the south.'
  },
  {
    x: 10, y: 2,
    name: 'Eastern Hunter Track',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'S'],
    description: 'An overgrown game trail winding through fern-choked hollows on the eastern side of Blackwood Forest.'
  },
  {
    x: 11, y: 2,
    name: 'Gnarled Bramble Wall',
    terrain: 'MOUNTAINS',
    feature: 'IMPASSABLE_THICKET',
    is_passable: 0, is_safe: 0,
    visualType: 'THICKET_BLOCK',
    pathConnections: [],
    description: 'Ancient deadfall and knotted thorns form an impassable barrier along the eastern ridge.'
  },

  // Row y = 3 (Heart of Blackwood & Branching Crossroads)
  {
    x: 4, y: 3,
    name: 'Moss-Grown Hollow',
    terrain: 'FOREST',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'DEEP_FOREST',
    pathConnections: ['S', 'E'],
    description: 'Thick emerald moss carpets the roots of towering oaks, muffling every footstep.'
  },
  {
    x: 5, y: 3,
    name: 'Western Whispering Trail',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E', 'S'],
    description: 'A winding forest path flanked by weathered standing stones and dense pine shadow.'
  },
  {
    x: 6, y: 3,
    name: 'Blackwood Bramble Arch',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E', 'S'],
    description: 'Overarching boughs weave a dim tunnel above the trail west of the Primeval Black Oak.'
  },
  {
    x: 7, y: 3,
    name: 'Heart of Blackwood',
    terrain: 'FOREST',
    feature: 'ANCIENT_OAK',
    is_passable: 1, is_safe: 0,
    visualType: 'ANCIENT_OAK_LANDMARK',
    pathConnections: ['N', 'W', 'E', 'S'],
    description: 'A colossal Primeval Black Oak stands at the center of the forest, its gnarled trunk scarred by goblin blades.'
  },
  {
    x: 8, y: 3,
    name: 'Goblin Ambush Bend',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E', 'S'],
    description: 'Low mossy boulders and tangled ferns flank the central road where goblin raiders often lurk.'
  },
  {
    x: 9, y: 3,
    name: 'Old Log Crossing',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'LOG_BRIDGE_PATH',
    pathConnections: ['N', 'W', 'E'],
    description: 'Felled ironwood logs span the narrow upper gorge of Blackwater Stream, linking the central and eastern trails.'
  },
  {
    x: 10, y: 3,
    name: 'Eastern Pine Trail',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'S'],
    description: 'Tall conifers cast long shadows across the eastern bypass trail.'
  },
  {
    x: 11, y: 3,
    name: 'Deepwood Fern Glade',
    terrain: 'FOREST',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'DEEP_FOREST',
    pathConnections: ['S'],
    description: 'Pale shafts of twilight pierce the canopy above a quiet glade of waist-high ferns.'
  },

  // Row y = 4 (Mid-Forest Trails & Blackwater Ravine)
  {
    x: 4, y: 4,
    name: 'Western Crag-Side Woods',
    terrain: 'FOREST',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'DEEP_FOREST',
    pathConnections: ['N', 'E', 'S'],
    description: 'Mossy boulders tumbled from the western cliffs lie half-buried in dark forest leaf-litter.'
  },
  {
    x: 5, y: 4,
    name: 'Westwood Fork',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E', 'S'],
    description: 'The western woodland trail skirts around the base of Stonefang Crag.'
  },
  {
    x: 6, y: 4,
    name: 'Crag-Shadow Glade',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E'],
    description: 'Chill air pools in the shadow north of Stonefang Crag where the trail rejoins the main road.'
  },
  {
    x: 7, y: 4,
    name: 'Blackwood Central Trail',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E', 'S'],
    description: 'The ancient king’s road winds deeper into Blackwood Forest, hemmed in by dark pines and drifting mist.'
  },
  {
    x: 8, y: 4,
    name: 'Ravine West Bank',
    terrain: 'FOREST',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_CLEARING',
    pathConnections: ['N', 'W', 'S'],
    description: 'The sound of rushing black water echoes from the steep ravine immediately to the east.'
  },
  {
    x: 9, y: 4,
    name: 'Blackwater Ravine',
    terrain: 'RIVER_LAKE',
    feature: 'BLACKWATER_RAVINE',
    is_passable: 0, is_safe: 0,
    visualType: 'RIVER_RAVINE',
    pathConnections: [],
    description: 'A deep, turbulent gorge of pitch-black water cutting through the forest floor. Impassable without a bridge.'
  },
  {
    x: 10, y: 4,
    name: 'Ravine East Trail',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'E', 'S'],
    description: 'A narrow path following the eastern rim of Blackwater Ravine northward toward the stronghold.'
  },
  {
    x: 11, y: 4,
    name: 'Mist-Wreathed Hollow',
    terrain: 'FOREST',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'DEEP_FOREST',
    pathConnections: ['N', 'W', 'S'],
    description: 'Coiling ribbons of silver mist drift between ancient yew trees.'
  },

  // Row y = 5 (Stonefang Crag, Crossroads & Lower Ravine)
  {
    x: 4, y: 5,
    name: 'Old Charcoal Burner Camp',
    terrain: 'FOREST',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_CLEARING',
    pathConnections: ['N', 'E', 'S'],
    description: 'Cold ash pits and a collapsed timber lean-to sit abandoned beneath the western pines.'
  },
  {
    x: 5, y: 5,
    name: 'Western Bypass Trail',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'S'],
    description: 'A well-trodden ranger path curving west around the sheer granite face of Stonefang Crag.'
  },
  {
    x: 6, y: 5,
    name: 'Stonefang Crag',
    terrain: 'MOUNTAINS',
    feature: 'STONEFANG_CRAG',
    is_passable: 0, is_safe: 0,
    visualType: 'ROCK_CRAG',
    pathConnections: [],
    description: 'A sheer wall of jagged black granite rising abruptly from the forest floor, blocking direct passage west.'
  },
  {
    x: 7, y: 5,
    name: 'Blackwood Crossroads',
    terrain: 'FOREST',
    feature: 'FOREST_CROSSROADS',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_CROSSROADS',
    pathConnections: ['N', 'E', 'S'],
    description: 'A weathered wooden signpost stands at the main forest crossroads north of Oakhaven Gate.'
  },
  {
    x: 8, y: 5,
    name: 'Sunken Waystone Glade',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'S'],
    description: 'A tilted moss-covered waystone marks the eastern fork between the central road and the river.'
  },
  {
    x: 9, y: 5,
    name: 'Blackwater Rapids',
    terrain: 'RIVER_LAKE',
    feature: 'BLACKWATER_RAVINE',
    is_passable: 0, is_safe: 0,
    visualType: 'RIVER_RAVINE',
    pathConnections: [],
    description: 'White foam churns over jagged black rocks in the river gorge, impossible to ford on foot.'
  },
  {
    x: 10, y: 5,
    name: 'Eastern Woodland Trail',
    terrain: 'FOREST',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'E', 'S'],
    description: 'A quiet forest track linking the eastern watchpost to the upper ravine trail.'
  },
  {
    x: 11, y: 5,
    name: 'Thorny Underbrush',
    terrain: 'FOREST',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'DEEP_FOREST',
    pathConnections: ['N', 'W', 'S'],
    description: 'Tangled briars and crooked oaks cast deep shadows across the eastern forest edge.'
  },

  // Row y = 6 (Southern Forest Threshold & Oakhaven North Gate)
  {
    x: 4, y: 6,
    name: 'Western Foothill Woods',
    terrain: 'HILLS',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_EDGE',
    pathConnections: ['N', 'E'],
    description: 'Rocky wooded slopes rising toward the western ridges outside Oakhaven.'
  },
  {
    x: 5, y: 6,
    name: 'Westgate Woodland Path',
    terrain: 'PLAINS',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E'],
    description: 'Trampled grass and wheel ruts lead from Oakhaven’s outer fields into the western woods.'
  },
  {
    x: 6, y: 6,
    name: 'Oakhaven Outer Glade',
    terrain: 'PLAINS',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['W', 'E', 'S'],
    description: 'Tree stumps and watch-clearing markers border the southern eaves of Blackwood Forest.'
  },
  {
    x: 7, y: 6,
    name: 'Oakhaven North Gate',
    terrain: 'PLAINS',
    feature: 'TOWN_GATES',
    is_passable: 1, is_safe: 1,
    visualType: 'TOWN_GATE_NORTH',
    pathConnections: ['N', 'W', 'S'],
    description: 'Outside the timber palisades of Oakhaven. The main road winds north into the dark canopy of Blackwood Forest.'
  },
  {
    x: 8, y: 6,
    name: 'Blackwater River Gorge',
    terrain: 'RIVER_LAKE',
    feature: 'BLACKWATER_RAVINE',
    is_passable: 0, is_safe: 0,
    visualType: 'RIVER_RAVINE',
    pathConnections: [],
    description: 'Dark, churning river waters rushing toward the Old Stone Bridge, too deep and swift to cross here.'
  },
  {
    x: 9, y: 6,
    name: 'Riverbank Willows',
    terrain: 'PLAINS',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['E', 'S'],
    description: 'Weeping willows and reeds line the eastern bank of the Blackwater River north of the watchpost.'
  },
  {
    x: 10, y: 6,
    name: 'Eastbank Trail',
    terrain: 'PLAINS',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_PATH',
    pathConnections: ['N', 'W', 'E'],
    description: 'A stone-bordered path leading north from the East Watchpost into Blackwood Forest.'
  },
  {
    x: 11, y: 6,
    name: 'Windy Forest Eaves',
    terrain: 'PLAINS',
    feature: null,
    is_passable: 1, is_safe: 0,
    visualType: 'FOREST_EDGE',
    pathConnections: ['N', 'W'],
    description: 'Tall heath grass gives way to the dark boughs of the eastern woods.'
  },

  // Row y = 7 (Oakhaven Sanctuary, Old Stone Bridge & Southern Frontier)
  {
    x: 4, y: 7,
    name: 'Oakhaven West Cliff',
    terrain: 'MOUNTAINS',
    feature: 'WEST_CLIFF',
    is_passable: 0, is_safe: 0,
    visualType: 'ROCK_CRAG',
    pathConnections: [],
    description: 'Steep rocky bluffs anchoring the western defensive perimeter of Oakhaven.'
  },
  {
    x: 5, y: 7,
    name: 'Oakhaven West Palisade',
    terrain: 'MOUNTAINS',
    feature: 'TOWN_PALISADE',
    is_passable: 0, is_safe: 0,
    visualType: 'TOWN_WALL',
    pathConnections: [],
    description: 'Sturdy oak logs and watch-parapets shielding the western quarter of Oakhaven Sanctuary.'
  },
  {
    x: 6, y: 7,
    name: 'Oakhaven West Commons',
    terrain: 'PLAINS',
    feature: 'FOREST_TRAIL',
    is_passable: 1, is_safe: 0,
    visualType: 'TOWN_OUTSKIRTS',
    pathConnections: ['N', 'E'],
    description: 'Lantern-lit paths outside the western gate of Oakhaven Sanctuary.'
  },
  {
    x: 7, y: 7,
    name: 'Oakhaven',
    terrain: 'CITY',
    feature: 'MARKETPLACE',
    is_passable: 1, is_safe: 1,
    visualType: 'TOWN_SANCTUARY',
    pathConnections: ['N', 'W', 'E'],
    description: 'A fortified sanctuary town standing at the edge of Blackwood Forest. Watchfires burn warmly upon the timber walls, offering free rest, a market, and quests.'
  },
  {
    x: 8, y: 7,
    name: 'The Old Stone Bridge',
    terrain: 'BRIDGE',
    feature: 'ANCIENT_BRIDGE',
    is_passable: 1, is_safe: 0,
    visualType: 'STONE_BRIDGE',
    pathConnections: ['W', 'E'],
    description: 'An ancient mossy stone bridge spanning the churning black waters of the river east of Oakhaven.'
  },
  {
    x: 9, y: 7,
    name: 'Bridge East Watchpost',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'SUNK_RUIN',
    is_passable: 1, is_safe: 0,
    visualType: 'WATCHPOST_RUIN',
    pathConnections: ['N', 'W'],
    description: 'Weathered stone watchpost ruins guarding the eastern end of the Old Stone Bridge, with a trail leading north into the woods.'
  },
  {
    x: 10, y: 7,
    name: 'Oakhaven East Palisade',
    terrain: 'MOUNTAINS',
    feature: 'TOWN_PALISADE',
    is_passable: 0, is_safe: 0,
    visualType: 'ROCK_CRAG',
    pathConnections: [],
    description: 'Jagged river bluffs and defensive stakes closing off the southeastern ridge.'
  },
  {
    x: 11, y: 7,
    name: 'Eastern Cliff Wall',
    terrain: 'MOUNTAINS',
    feature: 'EAST_CLIFF',
    is_passable: 0, is_safe: 0,
    visualType: 'ROCK_CRAG',
    pathConnections: [],
    description: 'Sheer stone cliffs rising above the river valley, impassable on foot.'
  }
]);

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
    tile.feature === 'GOBLIN_STRONGHOLD'
  );
}

/**
 * Applies the 8×7 Town & Goblin Forest tile definitions to `map_tiles`
 * and ensures the persistent Goblin Stronghold boss exists if not yet defeated.
 */
function applyTopdownExperimentWorld(db, { preserveOuterPassability = true } = {}) {
  const updateStmt = db.prepare(`
    UPDATE map_tiles
    SET name = ?,
        terrain = ?,
        feature = ?,
        description = ?,
        is_passable = ?,
        is_safe = ?
    WHERE x = ? AND y = ?
  `);

  for (const tileDef of TOPDOWN_REGION_TILES) {
    updateStmt.run(
      tileDef.name,
      tileDef.terrain,
      tileDef.feature,
      tileDef.description,
      tileDef.is_passable,
      tileDef.is_safe,
      tileDef.x,
      tileDef.y
    );
  }

  // Keep (8, 8) as Blackwater River directly south of The Old Stone Bridge (8, 7)
  db.prepare(`
    UPDATE map_tiles
    SET name = 'Blackwater River',
        terrain = 'RIVER_LAKE',
        feature = NULL,
        description = 'Dark, churning river waters rushing beneath the stone bridge arches, too deep and swift to ford on foot.',
        is_passable = 0,
        is_safe = 0
    WHERE x = 8 AND y = 8
  `).run();

  if (!preserveOuterPassability) {
    db.prepare(`
      UPDATE map_tiles
      SET is_passable = 0
      WHERE x < ? OR x > ? OR y < ? OR y > ?
    `).run(
      TOPDOWN_REGION_BOUNDS.minX,
      TOPDOWN_REGION_BOUNDS.maxX,
      TOPDOWN_REGION_BOUNDS.minY,
      TOPDOWN_REGION_BOUNDS.maxY
    );
  }

  ensureStrongholdBossInstance(db);
}

/**
 * Ensures the persistent world boss ("Warchief Grak the Goblin Chieftain")
 * exists on the Goblin Stronghold tile [7, 1].
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
    // If existingAny is DEFEATED and forceRespawn is true (e.g. Lab RESET_WORLD),
    // fall through to insert a fresh ACTIVE instance because SQLite trigger forbids UPDATE DEFEATED -> ACTIVE.
  }

  // Clear any non-boss random persistent instance on [7,1] so the Stronghold tile is reserved for the Chieftain
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

/**
 * Checks whether the Goblin Chieftain has been slain (either by character flag or world instance status)
 * and synchronizes the character's quest status accordingly without reviving the boss.
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

  const strongholdTile = getTileByCoords(db, STRONGHOLD_COORD.x, STRONGHOLD_COORD.y);
  const bossInstance = strongholdTile
    ? db.prepare(`
        SELECT * FROM monster_instances
        WHERE tile_id = ? AND custom_title = ?
        ORDER BY id DESC LIMIT 1
      `).get(strongholdTile.id, STRONGHOLD_BOSS_PROFILE.customTitle)
    : null;

  const bossDefeatedInWorld = Boolean(bossInstance && bossInstance.status !== 'ACTIVE');
  let bossSlain = Number(charRow.goblin_chieftain_slain || 0) === 1 || bossDefeatedInWorld;
  let status = String(charRow.quest_goblin_chieftain_status || 'NOT_ACCEPTED').toUpperCase();
  if (!QUEST_STATUS_LABELS[status]) {
    status = 'NOT_ACCEPTED';
  }

  let changed = false;
  if (bossDefeatedInWorld && Number(charRow.goblin_chieftain_slain || 0) !== 1) {
    bossSlain = true;
    changed = true;
  }
  if (bossSlain && status === 'ACTIVE') {
    status = 'COMPLETED';
    changed = true;
  }

  if (changed) {
    db.prepare(`
      UPDATE characters
      SET quest_goblin_chieftain_status = ?,
          goblin_chieftain_slain = ?
      WHERE id = ?
    `).run(status, bossSlain ? 1 : 0, characterId);
  }

  const xpRewardPreview = calculateXpWithIntelligence(
    QUEST_GOBLIN_CHIEFTAIN.rewardXpBase,
    charRow.intelligence || 10
  );

  return {
    key: QUEST_GOBLIN_CHIEFTAIN.key,
    title: QUEST_GOBLIN_CHIEFTAIN.title,
    giver: QUEST_GOBLIN_CHIEFTAIN.giver,
    regionName: QUEST_GOBLIN_CHIEFTAIN.regionName,
    strongholdName: QUEST_GOBLIN_CHIEFTAIN.strongholdName,
    strongholdCoord: QUEST_GOBLIN_CHIEFTAIN.strongholdCoord,
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
    objectiveText:
      status === 'REWARD_CLAIMED'
        ? 'The Goblin Chieftain is vanquished and Oakhaven has rewarded your valor.'
        : status === 'COMPLETED'
          ? 'The Goblin Chieftain has been defeated! Return to Oakhaven to claim your reward.'
          : bossSlain && status === 'NOT_ACCEPTED'
            ? 'You have already slain the Goblin Chieftain in Blackwood Stronghold! Speak with Captain Vane in Oakhaven to report your deed and claim the reward.'
            : status === 'ACTIVE'
              ? 'Travel north through Blackwood Forest to the Goblin Stronghold [7, 1] and defeat the Goblin Chieftain.'
              : 'Speak with Captain Vane in Oakhaven to accept the quest, or venture north into Blackwood Forest.'
  };
}

/**
 * Accepts "The Goblin Chieftain" quest in Oakhaven.
 * If the boss was already slain before accepting, transitions directly to COMPLETED
 * without reviving the boss.
 */
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

  const updatedQuest = syncCharacterQuestState(db, character.id);
  const message = updatedQuest.bossSlain
    ? 'You report that Warchief Grak is already slain! Captain Vane hails your triumph—your quest is marked Completed and ready for reward.'
    : 'Accepted Quest: "The Goblin Chieftain" — Venture north into Blackwood Forest, locate the Goblin Stronghold at [7, 1], and defeat the chieftain.';

  return {
    quest: updatedQuest,
    message
  };
}

/**
 * Claims the reward for "The Goblin Chieftain" in Oakhaven after the boss is defeated.
 * Uses canonical Darkgrid XP, Intelligence modifier, level-up, and gold rules.
 */
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
 * Initiates the fixed Goblin Stronghold Boss encounter on [7, 1] using the Phase 7C combat engine.
 */
function startStrongholdBossEncounter(db, character, options = {}) {
  const currentTile = getTileById(db, character.tile_id);
  if (!isGoblinStrongholdTile(currentTile)) {
    throw new Error('You must stand at the Goblin Stronghold entrance [7, 1] to challenge the Goblin Chieftain.');
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

  let bossInstance = ensureStrongholdBossInstance(db);
  if (!bossInstance || bossInstance.status !== 'ACTIVE') {
    throw new Error('The Goblin Chieftain has already been vanquished.');
  }

  return withTransaction(db, (tx) => {
    // Clear any unengaged Stage 1 DISCOVERED encounter before starting the boss fight
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
 * Selects a monster for Goblin Forest travel encounters using the required
 * 80% Goblin-related / 15% Forest Animals / 5% Other Forest Monsters distribution,
 * filtered appropriately by hero level so Level 1 combat remains fair and balanced.
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
      // Weight common Goblins highest at Level 1 (70% Goblin, 30% Hobgoblin)
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
 * Rolls for a Goblin Forest encounter when stepping onto a non-safe, non-stronghold tile.
 * Preserves Nemesis / persistent monster encounters on normal forest tiles if a hero died there.
 */
function checkGoblinForestEncounter(db, character, targetTile, options = {}) {
  if (!targetTile || targetTile.is_safe === 1) return null;
  // Stepping onto the Goblin Stronghold landmark [7, 1] never triggers a random encounter;
  // it presents the Stronghold Entrance UI where the player can initiate the boss fight.
  if (isGoblinStrongholdTile(targetTile)) {
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

  const chancePercent = options.forcedChance !== undefined ? Number(options.forcedChance) : 24;
  if (chancePercent <= 0) return null;
  const roll = rng() * 100;
  if (roll >= chancePercent) {
    return null;
  }

  const monster = selectGoblinForestMonster(db, character.level, rng);
  if (!monster) return null;

  const heroLevel = Number(character.level || 1);
  let isAmbush = 0;
  let spottedByHero = 1;
  if (heroLevel > 1) {
    const wisMod = Math.floor(((character.wisdom || 10) - 10) / 2);
    const perceptionBonus = String(character.class || '').toUpperCase() === 'RANGER' ? wisMod + 3 : wisMod;
    const d20 = Math.floor(rng() * 20) + 1;
    const monsterStealth = 10 + Number(monster.initiative_bonus || 0);
    if (d20 + perceptionBonus < monsterStealth) {
      isAmbush = 1;
      spottedByHero = 0;
    }
  }

  const initialHp = Number(monster.base_hp || 6);
  const ins = db.prepare(`
    INSERT INTO encounters (
      character_id, tile_id, monster_id, status,
      current_monster_hp, monster_max_hp, combat_round,
      spotted_by_hero, is_ambush, opening_shot_resolved
    ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, ?, ?, 0)
  `).run(
    character.id,
    targetTile.id,
    monster.id,
    initialHp,
    initialHp,
    spottedByHero,
    isAmbush
  );

  return getEncounterById(db, Number(ins.lastInsertRowid), character.class);
}

/**
 * Builds the complete 8×7 top-down map payload for the frontend renderer.
 */
function buildTopdownMapPayload(db, character, currentTile) {
  const questState = syncCharacterQuestState(db, character ? character.id : null);
  const rows = db.prepare(`
    SELECT id, x, y, name, terrain, feature, description, is_passable, is_safe
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

  const tiles = rows.map((r) => {
    const meta = TILE_META_BY_COORD.get(`${r.x},${r.y}`) || {};
    const inst = instanceByTileId.get(Number(r.id));
    const isStronghold = isGoblinStrongholdTile(r);
    const isTown = r.terrain === 'CITY' && r.is_safe === 1;
    const visualType = meta.visualType || (isTown ? 'TOWN_SANCTUARY' : 'DEEP_FOREST');
    let visualKind = 'DENSE_WOODS';
    if (isTown) visualKind = 'TOWN';
    else if (isStronghold) visualKind = 'STRONGHOLD_GATE';
    else if (visualType === 'STRONGHOLD_WALL_WEST' || visualType === 'STRONGHOLD_WALL_EAST') visualKind = 'STRONGHOLD_WALL';
    else if (visualType === 'STRONGHOLD_APPROACH') visualKind = 'FOREST_PATH';
    else if (visualType === 'TOWN_GATE_NORTH') visualKind = 'NORTH_GATE';
    else if (visualType === 'FOREST_CROSSROADS') visualKind = 'CROSSROADS';
    else if (visualType === 'ANCIENT_OAK_LANDMARK') visualKind = 'ANCIENT_OAK';
    else if (visualType === 'STONE_BRIDGE') visualKind = 'BRIDGE';
    else if (visualType === 'WATCHPOST_RUIN') visualKind = 'WATCHPOST';
    else if (r.terrain === 'RIVER_LAKE') visualKind = 'RIVER';
    else if (r.terrain === 'MOUNTAINS') visualKind = Number(r.is_passable) === 0 && (r.x === 6 && r.y === 5) ? 'MOUNTAIN_CRAG' : (visualType === 'ROCK_CRAG' ? 'MOUNTAIN_CRAG' : 'DENSE_WOODS');
    else if (Number(r.is_passable) === 0) visualKind = 'DENSE_WOODS';
    else if (visualType === 'FOREST_CLEARING') visualKind = 'FOREST_CLEARING';
    else if (visualType === 'DEEP_FOREST') visualKind = 'FOREST_CLEARING';
    else visualKind = 'FOREST_PATH';

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
      visualType,
      visualKind,
      pathConnections: meta.pathConnections || [],
      hasNemesis: Boolean(inst && !isStronghold),
      strongholdBossActive: isStronghold ? Boolean(questState && !questState.bossSlain) : false
    };
  });

  const atStronghold = isGoblinStrongholdTile(currentTile);
  const heroX = currentTile ? Number(currentTile.x) : TOWN_COORD.x;
  const heroY = currentTile ? Number(currentTile.y) : TOWN_COORD.y;
  const heroFacing = (character && character.facing) || 'NORTH';
  const bossSlain = Boolean(questState && questState.bossSlain);

  return {
    bounds: TOPDOWN_REGION_BOUNDS,
    townCoord: TOWN_COORD,
    strongholdCoord: STRONGHOLD_COORD,
    heroCoord: { x: heroX, y: heroY },
    heroX,
    heroY,
    heroFacing,
    bossSlain,
    atStronghold,
    strongholdEntrance: {
      title: STRONGHOLD_BOSS_PROFILE.entranceTitle,
      description: STRONGHOLD_BOSS_PROFILE.entranceDescription,
      imageUrl: STRONGHOLD_BOSS_PROFILE.entranceImageUrl,
      bossName: STRONGHOLD_BOSS_PROFILE.customTitle,
      bossSlain,
      canChallengeBoss: Boolean(atStronghold && !bossSlain)
    },
    tiles
  };
}

module.exports = {
  TOPDOWN_REGION_BOUNDS,
  TOWN_COORD,
  STRONGHOLD_COORD,
  QUEST_GOBLIN_CHIEFTAIN,
  QUEST_STATUS_LABELS,
  STRONGHOLD_BOSS_PROFILE,
  TOPDOWN_REGION_TILES,
  isCoordInTopdownRegion,
  isGoblinStrongholdTile,
  applyTopdownExperimentWorld,
  ensureStrongholdBossInstance,
  syncCharacterQuestState,
  acceptGoblinChieftainQuest,
  claimGoblinChieftainReward,
  startStrongholdBossEncounter,
  selectGoblinForestMonster,
  checkGoblinForestEncounter,
  buildTopdownMapPayload
};
