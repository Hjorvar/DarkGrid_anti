/**
 * DARKGRID — Action Viewport Cohesive Scene Catalog & Deterministic Resolver
 * Strictly self-contained inside action-ui-lab/.
 *
 * Implements:
 *  - Multi-variant artwork catalog per terrain type stored in sandbox SQLite (`lab_scene_variants`)
 *  - Scalable image metadata classification (`camera_type`, `environment_scope`, `view_category`,
 *    `directionality`, `has_directional_landmark`, `safe_for_pov_fallback`)
 *  - Special landmark overrides (`MARKETPLACE`, `TOWN_GATES`, `ANCIENT_BRIDGE`, `SUNK_RUIN`, `ANCIENT_OAK`)
 *  - Directional transition overrides (`lab_directional_overrides`)
 *  - Mode C 5-Tier POV-First Selection System (`EXACT_POV` -> `LANDMARK_DIRECTIONAL_POV` ->
 *    `SUBBIOME_CONTEXT_POV` -> `GENERIC_TERRAIN_POV` -> `SAFE_NEUTRAL_POV`) + Combat Stage Stabilization
 *  - Mode A ("Single Scene" / Place-Centric) vs Mode B ("Directional Scene" / Forward-Vista-Centric)
 *    vs Mode C ("First-Person POV") vs Mode LEGACY
 */

const {
  TRANSITION_CONTEXT_TYPES,
  REVISIT_STATUS_TYPES,
  WORLD_LANDMARKS,
  NAMED_CORRIDORS,
  initTravelContinuityTables,
  resolveBoundaryGuidance,
  getBoundaryGuidance,
  computeDirectionalCompassContext,
  resolveBiomePersistence,
  evaluateTransitionContinuity
} = require('./travel-continuity');

const SCENE_MODES = ['A', 'B', 'C', 'LEGACY'];

let isBuildingAtlas = false;
let latestLiveViewportContext = null;

function getLatestSceneViewportContext() {
  return latestLiveViewportContext;
}

const POV_TIERS = {
  EXACT_POV: {
    tier: 1,
    key: 'EXACT_POV',
    label: 'Tier 1 • Exact (x,y,facing) POV'
  },
  LANDMARK_DIRECTIONAL_POV: {
    tier: 2,
    key: 'LANDMARK_DIRECTIONAL_POV',
    label: 'Tier 2 • Landmark Directional POV'
  },
  SUBBIOME_CONTEXT_POV: {
    tier: 3,
    key: 'SUBBIOME_CONTEXT_POV',
    label: 'Tier 3 • Sub-Biome Context POV'
  },
  GENERIC_TERRAIN_POV: {
    tier: 4,
    key: 'GENERIC_TERRAIN_POV',
    label: 'Tier 4 • Generic Eye-Level POV'
  },
  SAFE_NEUTRAL_POV: {
    tier: 5,
    key: 'SAFE_NEUTRAL_POV',
    label: 'Tier 5 • Safe Neutral POV Fallback'
  }
};

function normalizeSceneMode(mode) {
  const upper = String(mode || 'C').toUpperCase().trim();
  if (upper === 'SINGLE' || upper === 'MODE_A') return 'A';
  if (upper === 'DIRECTIONAL' || upper === 'MODE_B') return 'B';
  if (upper === 'FIRST_PERSON' || upper === 'FIRST-PERSON' || upper === 'PERSPECTIVE' || upper === 'MODE_C') return 'C';
  return SCENE_MODES.includes(upper) ? upper : 'C';
}

/**
 * Deterministic spatial variant index for a tile at (x, y) given a pool of `count` variants.
 * When `facing` is supplied (Mode C Tier 4 directional selection), guarantees that
 * adjacent 90° turns (`N -> E -> S -> W -> N`) and `NORTH` vs `WEST` never collide
 * due to modulo-3 periodicity.
 */
function computeDeterministicVariantIndex(x, y, count, facing = null) {
  const n = Number(count || 1);
  if (n <= 1) return 0;
  const ix = Math.abs(Math.trunc(Number(x || 0)));
  const iy = Math.abs(Math.trunc(Number(y || 0)));

  if (facing !== null && facing !== undefined) {
    const fIdx = typeof facing === 'number'
      ? ((Math.trunc(facing) % 4) + 4) % 4
      : ({ NORTH: 0, EAST: 1, SOUTH: 2, WEST: 3 }[String(facing).toUpperCase().trim()] ?? 0);
    if (n >= 4) {
      const perms = [
        [0, 1, 2, 3],
        [1, 2, 3, 0],
        [2, 3, 0, 1],
        [3, 0, 1, 2]
      ];
      const perm = perms[((ix + iy * 2) % 4 + 4) % 4];
      return (perm[fIdx] + Math.floor((ix + iy) / 4)) % n;
    }
    if (n === 3) {
      const tileShift = (ix * 2 + iy + Math.floor(ix / 2) + Math.floor(iy / 2)) % 3;
      const dirOffsets = ((ix + iy) & 1) ? [0, 1, 0, 2] : [0, 1, 2, 1];
      return (tileShift + dirOffsets[fIdx]) % 3;
    }
    if (n === 2) {
      return (ix + iy + fIdx) % 2;
    }
  }

  if (n === 4) {
    return (ix & 1) ? (iy & 1) : (3 - (iy & 1));
  }
  if (n === 2) {
    return (ix + iy + 1) % 2;
  }
  return (ix * 7 + iy * 13 + Math.floor(ix / 2) * 5 + Math.floor(iy / 2) * 11) % n;
}

const DEFAULT_SCENE_VARIANTS = [
  // =========================================================================
  // 1. SPECIAL LANDMARK OVERRIDES (location_key)
  // =========================================================================
  {
    terrain_type: 'CITY',
    location_key: 'MARKETPLACE',
    tile_id: null,
    variant_index: 0,
    variant_key: 'landmark_city_oakhaven',
    image_path: '/images/terrain/terrain_city_oakhaven.webp',
    title: 'Oakhaven Sanctuary',
    subtitle: 'Fortified timber palisades and warm hearth-fires against the dark wilds',
    atmosphere_profile: 'sanctuary',
    lighting_tint: 'rgba(230, 175, 85, 0.10)',
    mist_style: 'warm-hearth',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'PLAINS',
    location_key: 'TOWN_GATES',
    tile_id: null,
    variant_index: 0,
    variant_key: 'landmark_town_gates',
    image_path: '/images/terrain/terrain_town_gates.webp',
    title: 'Oakhaven Gatehouse',
    subtitle: 'Torchlit timber palisade gate standing guard at the town perimeter',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(230, 170, 80, 0.11)',
    mist_style: 'gate-mist',
    focal_x: 48,
    focal_y: 45,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'BRIDGE',
    location_key: 'ANCIENT_BRIDGE',
    tile_id: null,
    variant_index: 0,
    variant_key: 'landmark_stone_bridge',
    image_path: '/images/terrain/terrain_bridge.webp',
    title: 'The Old Stone Bridge',
    subtitle: 'Weathered stone arches spanning the churning Blackwater River',
    atmosphere_profile: 'bridge',
    lighting_tint: 'rgba(120, 155, 190, 0.10)',
    mist_style: 'river-mist',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'UNDERGROUND_RUINS',
    location_key: 'SUNK_RUIN',
    tile_id: null,
    variant_index: 0,
    variant_key: 'landmark_watchpost_ruins',
    image_path: '/lab-assets/images/terrain/watchpost_ruins_exterior.jpg',
    title: 'Bridge East Watchpost',
    subtitle: 'Crumbling stone watchtower ruins overlooking the Blackwater crossing',
    atmosphere_profile: 'ruins-exterior',
    lighting_tint: 'rgba(130, 145, 175, 0.11)',
    mist_style: 'river-mist',
    focal_x: 50,
    focal_y: 44,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'FOREST',
    location_key: 'ANCIENT_OAK',
    tile_id: null,
    variant_index: 0,
    variant_key: 'landmark_ancient_oak',
    image_path: '/lab-assets/images/terrain/forest_ancient_oak.jpg',
    title: 'Heart of the Mirkwood',
    subtitle: 'A colossal ancient black oak with gnarled root arches in primeval fog',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(185, 140, 70, 0.10)',
    mist_style: 'deep-forest',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },

  // =========================================================================
  // 2. MULTI-VARIANT TERRAIN POOLS (location_key IS NULL)
  // =========================================================================
  // FOREST (4 distinct cohesive paintings; 3 are landmark-free eye-level POVs)
  {
    terrain_type: 'FOREST',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'forest_deep_boughs',
    image_path: '/images/terrain/terrain_forest.webp',
    title: 'Mirkwood — Deep Mossy Boughs',
    subtitle: 'Twisted ancient oaks, sprawling moss-covered roots, and creeping ground mist',
    atmosphere_profile: 'forest-deep',
    lighting_tint: 'rgba(42, 78, 56, 0.12)',
    mist_style: 'deep-forest',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'FOREST',
    location_key: null,
    tile_id: null,
    variant_index: 1,
    variant_key: 'forest_monolith_clearing',
    image_path: '/lab-assets/images/terrain/forest_monolith_clearing.jpg',
    title: 'Mirkwood — Waystone Clearing',
    subtitle: 'A weathered carved rune monolith standing beside the muddy woodland crossroads',
    atmosphere_profile: 'forest-clearing',
    lighting_tint: 'rgba(56, 88, 66, 0.10)',
    mist_style: 'deep-forest',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'FOREST',
    location_key: null,
    tile_id: null,
    variant_index: 2,
    variant_key: 'forest_pine_ravine',
    image_path: '/lab-assets/images/terrain/forest_pine_ravine.jpg',
    title: 'Mirkwood — Dark Fir Ravine',
    subtitle: 'Jagged mossy boulders, fallen timber, and towering evergreens along a cold brook',
    atmosphere_profile: 'forest-ravine',
    lighting_tint: 'rgba(60, 82, 96, 0.12)',
    mist_style: 'river-mist',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'FOREST',
    location_key: null,
    tile_id: null,
    variant_index: 3,
    variant_key: 'forest_tangled_canopy',
    image_path: '/lab-assets/images/perspective/ancient_oak_7_3_south.jpg',
    title: 'Mirkwood — Tangled Old-Growth',
    subtitle: 'Dense primeval oak canopy where overarching mossy root-arches and ancient trunks blot out the sky',
    atmosphere_profile: 'forest-canopy',
    lighting_tint: 'rgba(38, 72, 48, 0.14)',
    mist_style: 'deep-forest',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },

  // PLAINS (3 distinct cohesive paintings)
  {
    terrain_type: 'PLAINS',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'plains_windswept_trail',
    image_path: '/images/terrain/terrain_plains.webp',
    title: 'Verdant Plains — Windswept Trail',
    subtitle: 'Muddy wheel-ruts cutting across pale windswept grasses under storm clouds',
    atmosphere_profile: 'plains-open',
    lighting_tint: 'rgba(180, 165, 125, 0.08)',
    mist_style: 'light-haze',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'PLAINS',
    location_key: null,
    tile_id: null,
    variant_index: 1,
    variant_key: 'plains_standing_stones',
    image_path: '/images/terrain/terrain_fallback.webp',
    title: 'Verdant Plains — Standing Stones Moor',
    subtitle: 'Weathered monoliths and stone cairns rising from the mist-shrouded moorland',
    atmosphere_profile: 'plains-moor',
    lighting_tint: 'rgba(130, 145, 160, 0.10)',
    mist_style: 'moor-mist',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'PLAINS',
    location_key: null,
    tile_id: null,
    variant_index: 2,
    variant_key: 'plains_rolling_heath',
    image_path: '/images/terrain/terrain_hills.webp',
    title: 'Verdant Plains — Rolling Borderlands',
    subtitle: 'Heather-grown rises and a distant stone cairn overlooking the lowland trail',
    atmosphere_profile: 'plains-heath',
    lighting_tint: 'rgba(155, 145, 110, 0.09)',
    mist_style: 'light-haze',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },

  // HILLS (3 distinct cohesive paintings)
  {
    terrain_type: 'HILLS',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'hills_cairn_ridge',
    image_path: '/images/terrain/terrain_hills.webp',
    title: 'Raven Crags — Highland Cairn Ridge',
    subtitle: 'Windswept highland ridges crowned by an ancient sentinel cairn',
    atmosphere_profile: 'hills-ridge',
    lighting_tint: 'rgba(145, 140, 115, 0.09)',
    mist_style: 'light-haze',
    focal_x: 50,
    focal_y: 44,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'HILLS',
    location_key: null,
    tile_id: null,
    variant_index: 1,
    variant_key: 'hills_deadwood_pass',
    image_path: '/images/terrain/terrain_fallback_v1_scorched.webp',
    title: 'Raven Crags — Deadwood Crag Pass',
    subtitle: 'Shattered rock spires and skeletal trees below the mountain peaks',
    atmosphere_profile: 'hills-crag',
    lighting_tint: 'rgba(120, 110, 100, 0.12)',
    mist_style: 'moor-mist',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'HILLS',
    location_key: null,
    tile_id: null,
    variant_index: 2,
    variant_key: 'hills_misty_barrows',
    image_path: '/images/terrain/terrain_fallback.webp',
    title: 'Raven Crags — Misty Barrow Downs',
    subtitle: 'Ancient standing stones half-buried in highland fog and heather',
    atmosphere_profile: 'hills-barrows',
    lighting_tint: 'rgba(115, 130, 148, 0.11)',
    mist_style: 'moor-mist',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },

  // SWAMP (2 distinct cohesive paintings)
  {
    terrain_type: 'SWAMP',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'swamp_drowned_mire',
    image_path: '/images/terrain/terrain_swamp.webp',
    title: 'Rotting Fen — Drowned Mire',
    subtitle: 'Stagnant black waters, drowned roots, and fetid marsh fog',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(72, 96, 64, 0.14)',
    mist_style: 'swamp-fog',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'SWAMP',
    location_key: null,
    tile_id: null,
    variant_index: 1,
    variant_key: 'swamp_overgrown_bog',
    image_path: '/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg',
    title: 'Rotting Fen — Overgrown Bog Thicket',
    subtitle: 'Tangled marsh vines and towering bog-willows choking the mire',
    atmosphere_profile: 'swamp-bog',
    lighting_tint: 'rgba(58, 88, 58, 0.15)',
    mist_style: 'swamp-fog',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },

  // JUNGLE (2 variants)
  {
    terrain_type: 'JUNGLE',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'jungle_primeval',
    image_path: '/images/terrain/terrain_jungle.webp',
    title: 'Venomous Jungle — Primeval Canopy',
    subtitle: 'Dense humid rainforest of colossal roots and hanging creepers',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(44, 86, 52, 0.14)',
    mist_style: 'deep-forest',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'JUNGLE',
    location_key: null,
    tile_id: null,
    variant_index: 1,
    variant_key: 'jungle_shadowed_hollow',
    image_path: '/lab-assets/images/perspective/transition_swamp_to_jungle_pov.jpg',
    title: 'Venomous Jungle — Shadowed Root Hollow',
    subtitle: 'Colossal coiled buttress roots, hanging lianas, and dark undergrowth heavy with spore mist',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(40, 78, 50, 0.14)',
    mist_style: 'deep-forest',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },

  // MOUNTAINS (Impassable Barrier Vistas)
  {
    terrain_type: 'MOUNTAINS',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'mountains_jagged_wall',
    image_path: '/images/terrain/terrain_mountains.webp',
    title: 'Impassable Crags — Sheer Granite Peaks',
    subtitle: 'A towering wall of jagged dark granite blocking all passage on foot',
    atmosphere_profile: 'mountain-barrier',
    lighting_tint: 'rgba(95, 110, 130, 0.14)',
    mist_style: 'crag-mist',
    focal_x: 50,
    focal_y: 42,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'MOUNTAINS',
    location_key: null,
    tile_id: null,
    variant_index: 1,
    variant_key: 'mountains_deadwood_cliff',
    image_path: '/images/terrain/terrain_fallback_v1_scorched.webp',
    title: 'Impassable Crags — Shattered Precipice',
    subtitle: 'Sheer rock faces and dead crag-trees barring the way forward',
    atmosphere_profile: 'mountain-barrier',
    lighting_tint: 'rgba(105, 105, 115, 0.14)',
    mist_style: 'crag-mist',
    focal_x: 50,
    focal_y: 43,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },

  // WATER BARRIERS & OTHER TERRAINS
  {
    terrain_type: 'RIVER_LAKE',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'river_blackwater',
    image_path: '/lab-assets/images/perspective/barrier_blackwater_bank_pov.jpg',
    title: 'Blackwater River — Churning Waters',
    subtitle: 'Deep, swift-running black waters crashing against jagged stone banks',
    atmosphere_profile: 'water-barrier',
    lighting_tint: 'rgba(56, 115, 155, 0.16)',
    mist_style: 'river-mist',
    focal_x: 50,
    focal_y: 48,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'OCEAN',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'ocean_murksea',
    image_path: '/images/terrain/terrain_coast.webp',
    title: 'The Murksea — Abyssal Swells',
    subtitle: 'Freezing black sea waves surging against sheer coastal cliffs',
    atmosphere_profile: 'water-barrier',
    lighting_tint: 'rgba(48, 105, 145, 0.16)',
    mist_style: 'river-mist',
    focal_x: 50,
    focal_y: 48,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'COAST',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'coast_storm_cliffs',
    image_path: '/images/terrain/terrain_coast.webp',
    title: 'Storm-Swept Coast',
    subtitle: 'Salt spray and dark waves hammering the rocky shoreline',
    atmosphere_profile: 'water-barrier',
    lighting_tint: 'rgba(56, 115, 155, 0.14)',
    mist_style: 'river-mist',
    focal_x: 50,
    focal_y: 47,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'BRIDGE',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'bridge_stone_default',
    image_path: '/images/terrain/terrain_bridge.webp',
    title: 'Ancient Stone Bridge',
    subtitle: 'Moss-grown masonry arches spanning the dark river below',
    atmosphere_profile: 'bridge',
    lighting_tint: 'rgba(120, 155, 190, 0.10)',
    mist_style: 'river-mist',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'UNDERGROUND_RUINS',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'ruins_sunken_vaults',
    image_path: '/images/terrain/terrain_underground_ruins.webp',
    title: 'Sunken Stone Vaults',
    subtitle: 'Collapsed gothic arches and flooded flagstones of a forgotten age',
    atmosphere_profile: 'ruins-interior',
    lighting_tint: 'rgba(90, 125, 150, 0.14)',
    mist_style: 'crypt-mist',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'POV',
    environment_scope: 'INDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'CITY',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'city_sanctuary_default',
    image_path: '/images/terrain/terrain_city_oakhaven.webp',
    title: 'Oakhaven Sanctuary',
    subtitle: 'Safe within the timber palisades and watchfires of Oakhaven',
    atmosphere_profile: 'sanctuary',
    lighting_tint: 'rgba(230, 175, 85, 0.10)',
    mist_style: 'warm-hearth',
    focal_x: 50,
    focal_y: 46,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'DESERT',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'desert_monoliths',
    image_path: '/images/terrain/terrain_desert.webp',
    title: 'Arid Monolith Wastes',
    subtitle: 'Sun-bleached stone pillars rising through swirling dust devils',
    atmosphere_profile: 'desert',
    lighting_tint: 'rgba(210, 175, 115, 0.10)',
    mist_style: 'light-haze',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'VOID',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'void_world_edge',
    image_path: '/images/terrain/terrain_mountains.webp',
    title: 'Edge of the Known Realm',
    subtitle: 'An impassable abyss and sheer mountain wall at the world boundary',
    atmosphere_profile: 'mountain-barrier',
    lighting_tint: 'rgba(80, 95, 120, 0.18)',
    mist_style: 'crag-mist',
    focal_x: 50,
    focal_y: 42,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 0
  },
  {
    terrain_type: 'FALLBACK',
    location_key: null,
    tile_id: null,
    variant_index: 0,
    variant_key: 'fallback_misty_realm',
    image_path: '/images/terrain/terrain_fallback.webp',
    title: 'Misty Borderlands',
    subtitle: 'Standing stones and drifting fog across the wild frontier',
    atmosphere_profile: 'plains-moor',
    lighting_tint: 'rgba(130, 145, 160, 0.10)',
    mist_style: 'moor-mist',
    focal_x: 50,
    focal_y: 45,
    camera_type: 'OVERVIEW',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  },

  // =========================================================================
  // 3. MODE C TIER 4 POV-SAFE SUB-BIOME POOL (`location_key: 'POV_POOL'`)
  // Used by Mode C Tier 4 (`GENERIC_TERRAIN_POV`) without altering Mode A/B indices
  // =========================================================================
  {
    terrain_type: 'HILLS',
    location_key: 'POV_POOL',
    tile_id: null,
    variant_index: 10,
    variant_key: 'hills_raven_crags_ravine_pov',
    image_path: '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
    title: 'Raven Crags — Highland Slate Ravine',
    subtitle: 'Narrow highland slate path flanked by mossy stone cairns, twisted dead pines, and perched ravens',
    atmosphere_profile: 'hills-crag',
    lighting_tint: 'rgba(110, 120, 132, 0.11)',
    mist_style: 'moor-mist',
    focal_x: 50,
    focal_y: 62,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'HILLS',
    location_key: 'POV_POOL',
    tile_id: null,
    variant_index: 11,
    variant_key: 'hills_highland_ridge_pov',
    image_path: '/lab-assets/images/terrain/hills_highland_ridge_pov.jpg',
    title: 'Raven Crags — Windswept Ridge Trail',
    subtitle: 'Cracked flagstone ridge path overlooking mist-choked highland gullies under storm clouds',
    atmosphere_profile: 'hills-ridge',
    lighting_tint: 'rgba(118, 125, 138, 0.10)',
    mist_style: 'moor-mist',
    focal_x: 50,
    focal_y: 62,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'PLAINS',
    location_key: 'POV_POOL',
    tile_id: null,
    variant_index: 10,
    variant_key: 'plains_windblown_heath_pov',
    image_path: '/lab-assets/images/terrain/plains_windblown_heath_pov.jpg',
    title: 'Windblown Heath — Frontier Track',
    subtitle: 'Ancient dirt and flagstone road cutting through wind-flattened dark heather and low silver mist',
    atmosphere_profile: 'plains-heath',
    lighting_tint: 'rgba(145, 152, 160, 0.09)',
    mist_style: 'light-haze',
    focal_x: 50,
    focal_y: 62,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'SWAMP',
    location_key: 'POV_POOL',
    tile_id: null,
    variant_index: 10,
    variant_key: 'swamp_willow_boardwalk_pov',
    image_path: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg',
    title: 'Rotting Fen — Weeping Willow Causeway',
    subtitle: 'Half-sunken timber plank causeway winding between weeping bog-willows and black mire pools',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(64, 92, 62, 0.13)',
    mist_style: 'swamp-fog',
    focal_x: 50,
    focal_y: 62,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'JUNGLE',
    location_key: 'POV_POOL',
    tile_id: null,
    variant_index: 10,
    variant_key: 'jungle_venomous_trail_pov',
    image_path: '/lab-assets/images/terrain/jungle_venomous_trail_pov.jpg',
    title: 'Venomous Jungle — Spore-Laden Floor',
    subtitle: 'Damp mossy stone slabs winding between coiled buttress roots, hanging lianas, and glowing toxic fungi',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(48, 88, 54, 0.13)',
    mist_style: 'deep-forest',
    focal_x: 50,
    focal_y: 62,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    has_directional_landmark: 0,
    safe_for_pov_fallback: 1
  },
  {
    terrain_type: 'FOREST',
    location_key: 'POV_POOL',
    tile_id: null,
    variant_index: 10,
    variant_key: 'forest_crossroads_lateral_pov',
    image_path: '/lab-assets/images/perspective/crossroads_7_5_lateral.jpg',
    title: 'Mirkwood — Mossy Signpost Track',
    subtitle: 'Damp woodland trail with weathered timber signpost and mossy boundary stones among gnarled oaks',
    atmosphere_profile: 'forest-deep',
    lighting_tint: 'rgba(46, 82, 58, 0.10)',
    mist_style: 'deep-forest',
    focal_x: 50,
    focal_y: 62,
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'LANDMARK_LOCKED',
    has_directional_landmark: 1,
    safe_for_pov_fallback: 0
  }
];

/**
 * Directional pair overrides for Mode B ("Directional Scene").
 */
const DEFAULT_DIRECTIONAL_OVERRIDES = [
  {
    from_terrain: 'BRIDGE',
    from_feature: 'ANCIENT_BRIDGE',
    to_terrain: 'UNDERGROUND_RUINS',
    to_feature: 'SUNK_RUIN',
    facing: 'EAST',
    variant_key: 'landmark_stone_bridge',
    view_title: 'The Old Stone Bridge → Bridge East Watchpost',
    view_caption: 'Looking East across the mossy stone arches toward Bridge East Watchpost',
    focal_x: 55,
    focal_y: 43,
    priority: 100
  },
  {
    from_terrain: 'BRIDGE',
    from_feature: 'ANCIENT_BRIDGE',
    to_terrain: 'CITY',
    to_feature: 'MARKETPLACE',
    facing: 'WEST',
    variant_key: 'landmark_town_gates',
    view_title: 'The Old Stone Bridge → Oakhaven West Bank',
    view_caption: 'Looking West from the bridge toward the timber walls and gates of Oakhaven',
    focal_x: 47,
    focal_y: 45,
    priority: 100
  },
  {
    from_terrain: 'UNDERGROUND_RUINS',
    from_feature: 'SUNK_RUIN',
    to_terrain: 'PLAINS',
    to_feature: null,
    facing: 'EAST',
    variant_key: 'landmark_watchpost_ruins',
    view_title: 'Bridge East Watchpost — Eastern Frontier Outlook',
    view_caption: 'Standing amid the ruined watchtower arches looking East toward the frontier plains',
    focal_x: 53,
    focal_y: 44,
    priority: 95
  },
  {
    from_terrain: 'UNDERGROUND_RUINS',
    from_feature: 'SUNK_RUIN',
    to_terrain: 'BRIDGE',
    to_feature: 'ANCIENT_BRIDGE',
    facing: 'WEST',
    variant_key: 'landmark_stone_bridge',
    view_title: 'Bridge East Watchpost → The Old Stone Bridge',
    view_caption: 'Looking West from the watchtower ruins back across The Old Stone Bridge',
    focal_x: 46,
    focal_y: 45,
    priority: 100
  },
  {
    from_terrain: 'CITY',
    from_feature: 'MARKETPLACE',
    to_terrain: 'PLAINS',
    to_feature: 'TOWN_GATES',
    facing: null,
    variant_key: 'landmark_town_gates',
    view_title: 'Oakhaven → Palisade Gatehouse',
    view_caption: 'Looking from Oakhaven Sanctuary toward the torchlit timber gatehouse',
    focal_x: 50,
    focal_y: 45,
    priority: 90
  },
  {
    from_terrain: 'CITY',
    from_feature: 'MARKETPLACE',
    to_terrain: 'BRIDGE',
    to_feature: 'ANCIENT_BRIDGE',
    facing: 'EAST',
    variant_key: 'landmark_stone_bridge',
    view_title: 'Oakhaven → Eastern River Crossing',
    view_caption: 'Looking East from Oakhaven toward The Old Stone Bridge spanning the Blackwater',
    focal_x: 46,
    focal_y: 45,
    priority: 90
  },
  {
    from_terrain: 'CITY',
    from_feature: 'MARKETPLACE',
    to_terrain: 'PLAINS',
    to_feature: null,
    facing: 'WEST',
    variant_key: 'landmark_city_oakhaven',
    view_title: 'Oakhaven Sanctuary — Western Palisade',
    view_caption: 'Looking West across the timber palisades of Oakhaven toward the open plains',
    focal_x: 46,
    focal_y: 45,
    priority: 90
  },
  {
    from_terrain: 'PLAINS',
    from_feature: 'TOWN_GATES',
    to_terrain: 'CITY',
    to_feature: 'MARKETPLACE',
    facing: null,
    variant_key: 'landmark_city_oakhaven',
    view_title: 'Gatehouse → Oakhaven Sanctuary',
    view_caption: 'Looking through the timber palisade gates into the warm streets of Oakhaven',
    focal_x: 50,
    focal_y: 46,
    priority: 95
  }
];

/**
 * Tier 1 (`EXACT_POV`): Dedicated Eye-Level First-Person Views for Mode C.
 * Preserves the 6 original coordinate-locked eye-level paintings untouched.
 */
const DEFAULT_PERSPECTIVE_VIEWS = [
  // A. The Old Stone Bridge (8,7) — East & West 180° Pair
  {
    tile_x: 8,
    tile_y: 7,
    facing: 'EAST',
    view_key: 'fp_bridge_8_7_east',
    image_path: '/lab-assets/images/perspective/bridge_8_7_east.jpg',
    view_title: 'On The Old Stone Bridge — Looking East',
    view_subtitle: 'Standing on the moss-grown bridge deck between stone parapets; Bridge East Watchpost rises on the eastern bank ahead',
    landmarks_visible: 'Stone Bridge Parapets (Foreground), Blackwater River (Below), Bridge East Watchpost (Ahead East)',
    atmosphere_profile: 'bridge',
    lighting_tint: 'rgba(110, 145, 185, 0.08)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 8,
    tile_y: 7,
    facing: 'WEST',
    view_key: 'fp_bridge_8_7_west',
    image_path: '/lab-assets/images/perspective/bridge_8_7_west.jpg',
    view_title: 'On The Old Stone Bridge — Looking West',
    view_subtitle: 'Turned 180° on the same stone bridge deck; the timber palisades and torchlit gate of Oakhaven await on the western bank',
    landmarks_visible: 'Stone Bridge Parapets (Foreground), Blackwater River (Below), Oakhaven Palisades & Gate (Ahead West)',
    atmosphere_profile: 'bridge',
    lighting_tint: 'rgba(215, 165, 95, 0.08)',
    mist_style: 'river-mist',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },

  // B. Mirkwood Forest – Crossroads (7,5) — North & South 180° Pair
  {
    tile_x: 7,
    tile_y: 5,
    facing: 'NORTH',
    view_key: 'fp_crossroads_7_5_north',
    image_path: '/lab-assets/images/perspective/crossroads_7_5_north.jpg',
    view_title: 'At Mirkwood Crossroads — Looking North',
    view_subtitle: 'Standing on the muddy woodland junction with the carved rune waystone beside the path on your right, looking deeper into Mirkwood',
    landmarks_visible: 'Crossroads Rune Waystone (Right Foreground), Deep Mirkwood Trail (Ahead North)',
    atmosphere_profile: 'forest-clearing',
    lighting_tint: 'rgba(42, 78, 56, 0.09)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 64
  },
  {
    tile_x: 7,
    tile_y: 5,
    facing: 'SOUTH',
    view_key: 'fp_crossroads_7_5_south',
    image_path: '/lab-assets/images/perspective/crossroads_7_5_south.jpg',
    view_title: 'At Mirkwood Crossroads — Looking South',
    view_subtitle: 'Turned 180° in the same forest crossroads clearing (waystone now on your left); the trees open toward distant Oakhaven North Gate',
    landmarks_visible: 'Crossroads Rune Waystone (Left Foreground), Forest Eaves (Midground), Oakhaven North Gate (Distant South)',
    atmosphere_profile: 'forest-clearing',
    lighting_tint: 'rgba(180, 145, 85, 0.08)',
    mist_style: 'deep-forest',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 64
  },

  // C. Oakhaven North Gate (7,6) — North & South 180° Pair
  {
    tile_x: 7,
    tile_y: 6,
    facing: 'NORTH',
    view_key: 'fp_north_gate_7_6_north',
    image_path: '/lab-assets/images/perspective/north_gate_7_6_north.jpg',
    view_title: 'At Oakhaven North Gate — Looking North',
    view_subtitle: 'Standing at the timber gatehouse threshold looking North along the muddy road toward Mirkwood Crossroads',
    landmarks_visible: 'North Gate Timber Arch & Torches (Foreground), Northern Trail (Midground), Mirkwood Crossroads Tree Line (Ahead North)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(65, 95, 75, 0.08)',
    mist_style: 'gate-mist',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 60
  },
  {
    tile_x: 7,
    tile_y: 6,
    facing: 'SOUTH',
    view_key: 'fp_north_gate_7_6_south',
    image_path: '/lab-assets/images/perspective/north_gate_7_6_south.jpg',
    view_title: 'At Oakhaven North Gate — Looking South',
    view_subtitle: 'Turned 180° at the inner gatehouse threshold looking South down the cobblestone street into Oakhaven Sanctuary',
    landmarks_visible: 'North Gate Inner Arch & Braziers (Foreground), Oakhaven Main Street & Timber Buildings (Ahead South)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(230, 175, 85, 0.09)',
    mist_style: 'warm-hearth',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 60
  },
  {
    tile_x: 7,
    tile_y: 6,
    facing: 'EAST',
    view_key: 'fp_north_gate_7_6_east',
    image_path: '/lab-assets/images/perspective/north_gate_7_6_east.jpg',
    view_title: 'At Oakhaven North Gate — Looking East Along Palisade',
    view_subtitle: 'Standing outside North Gate looking East along Oakhaven’s timber palisade wall toward the misty Blackwater River bank',
    landmarks_visible: 'Oakhaven Timber Palisade & Wall Torches (Right), Mirkwood Pine Edge (Left), Blackwater River Bank (Ahead East)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(120, 145, 165, 0.09)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 6,
    facing: 'WEST',
    view_key: 'fp_north_gate_7_6_west',
    image_path: '/lab-assets/images/perspective/north_gate_7_6_west.jpg',
    view_title: 'At Oakhaven North Gate — Looking West Along Palisade',
    view_subtitle: 'Standing outside North Gate looking West along the timber palisade and watchtower brazier toward the Verdant Plains',
    landmarks_visible: 'Oakhaven Timber Palisade & Corner Watchtower (Left), Mirkwood Tree Line (Right), Verdant Plains Trail (Ahead West)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(195, 155, 95, 0.08)',
    mist_style: 'gate-mist',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },

  // D. Oakhaven Sanctuary (7,7) — Full 4-Direction Street & Gate Views
  {
    tile_x: 7,
    tile_y: 7,
    facing: 'NORTH',
    view_key: 'fp_oakhaven_7_7_north',
    image_path: '/lab-assets/images/perspective/oakhaven_7_7_north.jpg',
    view_title: 'Inside Oakhaven Sanctuary — Looking North to North Gate',
    view_subtitle: 'Standing on Oakhaven’s wet cobblestone main street between half-timbered houses, looking North toward the open timber arch of North Gate',
    landmarks_visible: 'Oakhaven Cobblestone Main Street & Half-Timbered Houses (Foreground), Oakhaven North Gate Arch & Torches (Ahead North)',
    atmosphere_profile: 'sanctuary',
    lighting_tint: 'rgba(230, 175, 85, 0.09)',
    mist_style: 'warm-hearth',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 7,
    facing: 'EAST',
    view_key: 'fp_oakhaven_7_7_east',
    image_path: '/lab-assets/images/perspective/oakhaven_7_7_east.jpg',
    view_title: 'Inside Oakhaven Sanctuary — Looking East to River Gate & Bridge',
    view_subtitle: 'Looking East along Oakhaven’s cobblestone lane through the open River Gate and twin brazier watchtowers directly onto The Old Stone Bridge',
    landmarks_visible: 'Oakhaven River Gate & Twin Brazier Watchtowers (Midground), The Old Stone Bridge Flagstones & Bollards (Ahead East)',
    atmosphere_profile: 'sanctuary',
    lighting_tint: 'rgba(210, 165, 95, 0.09)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 7,
    facing: 'SOUTH',
    view_key: 'fp_oakhaven_7_7_south',
    image_path: '/lab-assets/images/perspective/oakhaven_7_7_south.jpg',
    view_title: 'Inside Oakhaven Sanctuary — Looking South to South Gate',
    view_subtitle: 'Looking South down Oakhaven’s sloping cobblestone lane toward the South Gate where low marsh fog creeps across the threshold',
    landmarks_visible: 'Oakhaven Storehouses & Lanterns (Flanks), Oakhaven South Gate Arch & Creeping Fen Mist (Ahead South)',
    atmosphere_profile: 'sanctuary',
    lighting_tint: 'rgba(185, 165, 95, 0.09)',
    mist_style: 'warm-hearth',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 7,
    facing: 'WEST',
    view_key: 'fp_oakhaven_7_7_west',
    image_path: '/lab-assets/images/perspective/oakhaven_7_7_west.jpg',
    view_title: 'Inside Oakhaven Sanctuary — Looking West Across Market Square',
    view_subtitle: 'Looking West across Oakhaven’s cobblestone market square past a warm iron brazier and wooden stalls toward the western timber palisade',
    landmarks_visible: 'Oakhaven Market Stalls & Iron Brazier (Foreground), Western Timber Palisade & Watchtower (Ahead West)',
    atmosphere_profile: 'sanctuary',
    lighting_tint: 'rgba(235, 175, 85, 0.09)',
    mist_style: 'warm-hearth',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },

  // E. Oakhaven South Gate (7,8) — 4-Direction Marsh-Edge Threshold Views
  {
    tile_x: 7,
    tile_y: 8,
    facing: 'NORTH',
    view_key: 'fp_south_gate_7_8_north',
    image_path: '/lab-assets/images/perspective/south_gate_7_8_north.jpg',
    view_title: 'At Oakhaven South Gate — Looking North Into Town',
    view_subtitle: 'Standing on the southern causeway looking North through Oakhaven’s fortified timber South Gate and twin watchtowers into the warm lantern-lit town',
    landmarks_visible: 'Southern Causeway (Foreground), Oakhaven South Gate Palisade, Twin Watchtowers & Warm Town Streets (Ahead North)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(225, 170, 85, 0.09)',
    mist_style: 'warm-hearth',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 8,
    facing: 'SOUTH',
    view_key: 'fp_south_gate_7_8_south',
    image_path: '/lab-assets/images/perspective/south_gate_7_8_south.jpg',
    view_title: 'At Oakhaven South Gate — Looking South Toward Rotting Fen',
    view_subtitle: 'Standing between the torchlit timber gate posts looking South down a muddy causeway descending into the weeping willow bogs of the Rotting Fen',
    landmarks_visible: 'South Gate Iron-Bound Doors & Wall Torches (Foreground), Muddy Wetland Causeway & Rotting Fen Willows (Ahead South)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(85, 115, 78, 0.10)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 8,
    facing: 'EAST',
    view_key: 'fp_south_gate_7_8_east',
    image_path: '/lab-assets/images/perspective/barrier_blackwater_bank_pov.jpg',
    view_title: 'At Oakhaven South Gate — Looking East to Blackwater River',
    view_subtitle: 'Looking East from the southern gate perimeter where the muddy embankment drops into the impassable churning rapids of the Blackwater River',
    landmarks_visible: 'Riverbank Reeds & Slick Stones (Foreground), Impassable Churning Blackwater River (Ahead East)',
    atmosphere_profile: 'water-barrier',
    lighting_tint: 'rgba(65, 110, 145, 0.11)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 8,
    facing: 'WEST',
    view_key: 'fp_south_gate_7_8_west',
    image_path: '/lab-assets/images/perspective/north_gate_7_6_west.jpg',
    view_title: 'At Oakhaven South Gate — Looking West Along Southern Palisade',
    view_subtitle: 'Looking West along Oakhaven’s southern timber palisade wall and corner watchtower toward the lowland plains',
    landmarks_visible: 'Oakhaven Timber Palisade & Watchtower (Right), Western Lowland Trail (Ahead West)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(185, 150, 95, 0.08)',
    mist_style: 'gate-mist',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 9,
    facing: 'NORTH',
    view_key: 'fp_fen_7_9_north',
    image_path: '/lab-assets/images/perspective/south_gate_7_8_north.jpg',
    view_title: 'In the Rotting Fen — Looking North Toward Oakhaven South Gate',
    view_subtitle: 'Standing on the half-sunken timber causeway in the marsh, looking North toward the wooden watchtowers and arched gatehouse of Oakhaven South Gate',
    landmarks_visible: 'Sunken Marsh Causeway (Foreground), Oakhaven South Gate & Timber Palisade (Ahead North)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(88, 108, 74, 0.10)',
    mist_style: 'swamp-fog',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },

  // F. Bridge East Watchpost (9,7) — 4-Direction Ruined Toll-Keep Continuity
  {
    tile_x: 9,
    tile_y: 7,
    facing: 'WEST',
    view_key: 'fp_watchpost_9_7_west',
    image_path: '/lab-assets/images/perspective/watchpost_9_7_west.jpg',
    view_title: 'At Bridge East Watchpost — Looking West Across The Old Stone Bridge',
    view_subtitle: 'Standing inside the ruined watchpost looking West through the ivy-draped Gothic archway back across The Old Stone Bridge toward Oakhaven',
    landmarks_visible: 'Ruined Watchpost Gothic Arch (Foreground), The Old Stone Bridge (Midground), Oakhaven Palisades & Gate (Far West)',
    atmosphere_profile: 'ruins-exterior',
    lighting_tint: 'rgba(135, 145, 168, 0.09)',
    mist_style: 'river-mist',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 9,
    tile_y: 7,
    facing: 'EAST',
    view_key: 'fp_watchpost_9_7_east',
    image_path: '/lab-assets/images/perspective/watchpost_9_7_east.jpg',
    view_title: 'At Bridge East Watchpost — Looking East to Frontier Plains',
    view_subtitle: 'Standing amid the collapsed watchtower walls looking East along an overgrown stone road winding into the windswept Verdant Plains',
    landmarks_visible: 'Crumbled Watchpost Masonry & Flagstones (Foreground), Overgrown Frontier Road & Verdant Plains (Ahead East)',
    atmosphere_profile: 'ruins-exterior',
    lighting_tint: 'rgba(130, 140, 165, 0.09)',
    mist_style: 'light-haze',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 9,
    tile_y: 7,
    facing: 'NORTH',
    view_key: 'fp_watchpost_9_7_north',
    image_path: '/lab-assets/images/perspective/watchpost_9_7_river_flank.jpg',
    view_title: 'At Bridge East Watchpost — Looking North Over Broken River Parapet',
    view_subtitle: 'Looking North across tumbled watchpost masonry and dead roots into the impassable churning gorge of the Blackwater River',
    landmarks_visible: 'Collapsed Watchpost Parapet & Carved Blocks (Foreground), Impassable Blackwater River Gorge (Below North)',
    atmosphere_profile: 'ruins-exterior',
    lighting_tint: 'rgba(78, 118, 152, 0.11)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 9,
    tile_y: 7,
    facing: 'SOUTH',
    view_key: 'fp_watchpost_9_7_south',
    image_path: '/lab-assets/images/perspective/watchpost_9_7_river_flank.jpg',
    view_title: 'At Bridge East Watchpost — Looking South Over Broken River Parapet',
    view_subtitle: 'Looking South across the shattered stone parapet wall into the dark, mist-shrouded rapids of the Blackwater River',
    landmarks_visible: 'Collapsed Watchpost Parapet & Mossy Stones (Foreground), Impassable Blackwater River Gorge (Below South)',
    atmosphere_profile: 'ruins-exterior',
    lighting_tint: 'rgba(78, 118, 152, 0.11)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    focal_x: 50,
    focal_y: 62
  },

  // G. Heart of the Mirkwood (7,3) & Approach Continuity
  {
    tile_x: 7,
    tile_y: 3,
    facing: 'NORTH',
    view_key: 'fp_ancient_oak_7_3_north',
    image_path: '/lab-assets/images/terrain/forest_ancient_oak.jpg',
    view_title: 'Heart of the Mirkwood — Facing the Ancient Black Oak',
    view_subtitle: 'Standing directly before the colossal gnarled root archway and amber-glowing bark fissures of the primeval black oak',
    landmarks_visible: 'Colossal Ancient Black Oak, Glowing Bark Fissures & Root Archway (Foreground/Center)',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(185, 140, 70, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 3,
    facing: 'SOUTH',
    view_key: 'fp_ancient_oak_7_3_south',
    image_path: '/lab-assets/images/perspective/ancient_oak_7_3_south.jpg',
    view_title: 'Heart of the Mirkwood — Looking South From Beneath the Root Arch',
    view_subtitle: 'Turned 180° beneath the massive moss-draped root arch of the Ancient Oak, looking South back down the damp woodland trail',
    landmarks_visible: 'Overarching Ancient Oak Roots (Foreground Frame), Southern Mirkwood Trail Toward Crossroads (Ahead South)',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(65, 98, 68, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 4,
    facing: 'NORTH',
    view_key: 'fp_mirkwood_trail_7_4_north',
    image_path: '/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg',
    view_title: 'Mirkwood Trail — Approaching the Primeval Black Oak',
    view_subtitle: 'Looking North along the root-woven Mirkwood trail as the colossal amber-veined root arch of the Primeval Black Oak looms ahead through the mist',
    landmarks_visible: 'Mossy Root Trail (Foreground), Colossal Primeval Black Oak of (7,3) Looming Ahead (North)',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(145, 125, 68, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 4,
    facing: 'SOUTH',
    view_key: 'fp_mirkwood_trail_7_4_south',
    image_path: '/lab-assets/images/perspective/crossroads_7_5_lateral.jpg',
    view_title: 'Mirkwood Trail — Looking South Toward Mirkwood Crossroads',
    view_subtitle: 'Turned 180° on the northern Mirkwood trail looking South back toward the weathered signpost and boundary stones of Mirkwood Crossroads',
    landmarks_visible: 'Root-Strewn Mirkwood Trail (Foreground), Crossroads Signpost & Boundary Stones of (7,5) (Ahead South)',
    atmosphere_profile: 'forest-deep',
    lighting_tint: 'rgba(46, 82, 58, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 3,
    facing: 'EAST',
    view_key: 'fp_ancient_oak_7_3_east',
    image_path: '/lab-assets/images/terrain/forest_pine_ravine.jpg',
    view_title: 'Heart of the Mirkwood — Eastern Ravine Flank',
    view_subtitle: 'Looking East from the Primeval Black Oak hollow into a shadowed pine-and-boulder ravine descending toward the eastern woods',
    landmarks_visible: 'Mossy Ravine Boulders & Fallen Timber (Foreground), Eastern Mirkwood Fir Ravine (Ahead East)',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(95, 115, 88, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 3,
    facing: 'WEST',
    view_key: 'fp_ancient_oak_7_3_west',
    image_path: '/images/terrain/terrain_forest.webp',
    view_title: 'Heart of the Mirkwood — Western Deep Boughs',
    view_subtitle: 'Looking West from beneath the Primeval Black Oak into the sprawling moss-draped trunks and creeping ground mist of western Mirkwood',
    landmarks_visible: 'Sprawling Moss-Covered Oak Roots (Foreground), Western Mirkwood Boughs (Ahead West)',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(85, 110, 72, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 7,
    tile_y: 2,
    facing: 'SOUTH',
    view_key: 'fp_forest_7_2_south_oak',
    image_path: '/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg',
    view_title: 'Mirkwood Trail — Approaching the Heart of the Mirkwood',
    view_subtitle: 'Looking South along the root-woven forest path as the colossal amber-veined root arch of the Ancient Oak looms ahead',
    landmarks_visible: 'Mossy Root Path (Foreground), Colossal Ancient Oak of (7,3) Looming Ahead',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(135, 120, 68, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },

  // H. Deadman's Mire (4,11) & Sunken Ruins Approaches
  {
    tile_x: 4,
    tile_y: 11,
    facing: 'NORTH',
    view_key: 'fp_deadmans_mire_4_11_north',
    image_path: '/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg',
    view_title: 'At Deadman’s Mire — Sunken Gothic Temple Ruins (North)',
    view_subtitle: 'Standing on flooded flagstones before ancient Gothic stone arches and tilted carved pillars half-swallowed by black bog water',
    landmarks_visible: 'Flooded Temple Flagstones (Foreground), Sunken Gothic Arches & Tilted Pillars of Deadman’s Mire (Center)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(68, 98, 66, 0.12)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 4,
    tile_y: 11,
    facing: 'SOUTH',
    view_key: 'fp_deadmans_mire_4_11_south',
    image_path: '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg',
    view_title: 'At Deadman’s Mire — Looking South Across the Drowned Colonnades',
    view_subtitle: 'Looking South from the sunken temple flagstones along a decaying plank causeway past outer ruined arches into the southern mire pools',
    landmarks_visible: 'Rotting Mire Boardwalk (Foreground), Outer Sunken Colonnades & Southern Fen Pools (Ahead South)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(68, 98, 66, 0.12)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 4,
    tile_y: 11,
    facing: 'EAST',
    view_key: 'fp_deadmans_mire_4_11_east',
    image_path: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg',
    view_title: 'At Deadman’s Mire — Looking East Along the Willow Causeway',
    view_subtitle: 'Looking East from the drowned temple ruins along a half-sunken timber plank boardwalk winding through weeping bog-willows toward the central fen',
    landmarks_visible: 'Sunken Timber Causeway & Iron Lantern Posts (Foreground), Rotting Fen Willow Bog (Ahead East)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(66, 94, 62, 0.13)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 4,
    tile_y: 11,
    facing: 'WEST',
    view_key: 'fp_deadmans_mire_4_11_west',
    image_path: '/images/terrain/terrain_swamp.webp',
    view_title: 'At Deadman’s Mire — Looking West Into the Drowned Backwaters',
    view_subtitle: 'Looking West from the sunken masonry into stagnant black bog channels, drowned cypress roots, and drifting marsh miasma',
    landmarks_visible: 'Drowned Roots & Stagnant Black Water Channel (Foreground), Western Rotting Fen (Ahead West)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(72, 96, 64, 0.14)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 4,
    tile_y: 10,
    facing: 'SOUTH',
    view_key: 'fp_mire_approach_4_10_south',
    image_path: '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg',
    view_title: 'Rotting Fen — Approaching Deadman’s Mire (South)',
    view_subtitle: 'Looking South along a muddy bog causeway where the sunken Gothic temple arches of Deadman’s Mire rise out of the swamp mist ahead',
    landmarks_visible: 'Rotting Fen Causeway & Willows (Foreground), Sunken Gothic Temple Ruins of Deadman’s Mire (Ahead South)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(68, 96, 64, 0.12)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 3,
    tile_y: 11,
    facing: 'EAST',
    view_key: 'fp_mire_approach_3_11_east',
    image_path: '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg',
    view_title: 'Rotting Fen — Approaching Deadman’s Mire (East)',
    view_subtitle: 'Looking East across the stagnant fen toward the sunken Gothic stone arches and tilted obelisks of Deadman’s Mire',
    landmarks_visible: 'Bog Causeway (Foreground), Sunken Gothic Ruins of Deadman’s Mire (Ahead East)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(68, 96, 64, 0.12)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },

  // I. Stonefang Crag (6,5) Direct Spire Approaches
  {
    tile_x: 6,
    tile_y: 6,
    facing: 'NORTH',
    view_key: 'fp_plains_6_6_north_stonefang',
    image_path: '/lab-assets/images/perspective/barrier_stonefang_crag_pov.jpg',
    view_title: 'South of Stonefang Crag — Impassable Black Spire Ahead',
    view_subtitle: 'Standing at the northern edge of the plains where the colossal fang-shaped monolith of Stonefang Crag blocks all passage North',
    landmarks_visible: 'Rocky Turf & Roots (Foreground), Impassable Spire of Stonefang Crag & Circling Crows (Ahead North)',
    atmosphere_profile: 'mountain-barrier',
    lighting_tint: 'rgba(98, 106, 118, 0.12)',
    mist_style: 'crag-mist',
    horizon_glow: 'dark-crag',
    focal_x: 50,
    focal_y: 60
  },
  {
    tile_x: 5,
    tile_y: 5,
    facing: 'EAST',
    view_key: 'fp_forest_5_5_east_stonefang',
    image_path: '/lab-assets/images/perspective/barrier_stonefang_crag_pov.jpg',
    view_title: 'West of Stonefang Crag — Impassable Monolith Wall Ahead',
    view_subtitle: 'Looking East from Mirkwood where the jagged vertical rock spire of Stonefang Crag rises violently to block passage',
    landmarks_visible: 'Root-Strewn Ground (Foreground), Impassable Stonefang Crag Spire (Ahead East)',
    atmosphere_profile: 'mountain-barrier',
    lighting_tint: 'rgba(98, 106, 118, 0.12)',
    mist_style: 'crag-mist',
    horizon_glow: 'dark-crag',
    focal_x: 50,
    focal_y: 60
  },
  {
    tile_x: 6,
    tile_y: 4,
    facing: 'SOUTH',
    view_key: 'fp_forest_6_4_south_stonefang',
    image_path: '/lab-assets/images/perspective/barrier_stonefang_crag_pov.jpg',
    view_title: 'North of Stonefang Crag — Impassable Granite Spire Ahead',
    view_subtitle: 'Looking South toward the sheer northern precipice and fallen boulder talus of Stonefang Crag blocking the trail',
    landmarks_visible: 'Forest-Edge Stones (Foreground), Impassable Northern Precipice of Stonefang Crag (Ahead South)',
    atmosphere_profile: 'mountain-barrier',
    lighting_tint: 'rgba(98, 106, 118, 0.12)',
    mist_style: 'crag-mist',
    horizon_glow: 'dark-crag',
    focal_x: 50,
    focal_y: 60
  },

  // J. Raven Crags Sentinel Cairn (3,5) — Highland Pass & Ridge Views
  {
    tile_x: 3,
    tile_y: 5,
    facing: 'NORTH',
    view_key: 'fp_raven_crags_3_5_north',
    image_path: '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
    view_title: 'At Raven Crags Cairn — Looking North Up the Highland Ravine',
    view_subtitle: 'Standing beside the moss-grown sentinel cairn looking North up a narrow dark-slate ravine where ravens circle the crags',
    landmarks_visible: 'Ancient Sentinel Cairn (Left Foreground), Narrow Slate Ravine & Perched Ravens (Ahead North)',
    atmosphere_profile: 'hills-crag',
    lighting_tint: 'rgba(105, 115, 128, 0.11)',
    mist_style: 'moor-mist',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 3,
    tile_y: 5,
    facing: 'SOUTH',
    view_key: 'fp_raven_crags_3_5_south',
    image_path: '/lab-assets/images/terrain/hills_highland_ridge_pov.jpg',
    view_title: 'At Raven Crags Cairn — Looking South Along the Exposed Ridge',
    view_subtitle: 'Looking South along the windswept highland crest of cracked flagstones and dark heather above mist-filled gorges',
    landmarks_visible: 'Cracked Highland Flagstone Crest & Deep Mist Ravines (Ahead South)',
    atmosphere_profile: 'hills-crag',
    lighting_tint: 'rgba(115, 124, 136, 0.10)',
    mist_style: 'moor-mist',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },

  // K. Windblown Heath Standing Stones (12,4) — Northeastern Frontier Views
  {
    tile_x: 12,
    tile_y: 4,
    facing: 'NORTH',
    view_key: 'fp_windblown_heath_12_4_north',
    image_path: '/lab-assets/images/terrain/plains_windblown_heath_pov.jpg',
    view_title: 'At Windblown Heath — Ancient Frontier Standing Stones (North)',
    view_subtitle: 'Standing on an ancient flagstone road flanked by weathered standing stones half-buried in wind-flattened heather',
    landmarks_visible: 'Frontier Standing Stones & Ancient Flagstone Road (Foreground/Midground)',
    atmosphere_profile: 'plains-open',
    lighting_tint: 'rgba(135, 148, 162, 0.09)',
    mist_style: 'moor-mist',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 12,
    tile_y: 4,
    facing: 'EAST',
    view_key: 'fp_windblown_heath_12_4_east',
    image_path: '/images/terrain/terrain_plains.webp',
    view_title: 'At Windblown Heath — Looking East Across the Open Frontier',
    view_subtitle: 'Looking East past the standing stones along a windswept grassland wagon track toward the eastern coast',
    landmarks_visible: 'Windswept Grassland Track & Boulders (Foreground), Eastern Frontier Moor (Ahead East)',
    atmosphere_profile: 'plains-open',
    lighting_tint: 'rgba(135, 148, 162, 0.09)',
    mist_style: 'moor-mist',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },

  // L. Rotting Fen Willow Boardwalk (6,10) & Venomous Jungle Spore Hollow (9,11)
  {
    tile_x: 6,
    tile_y: 10,
    facing: 'SOUTH',
    view_key: 'fp_rotting_fen_6_10_south',
    image_path: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg',
    view_title: 'Rotting Fen — Sunken Timber Boardwalk (South)',
    view_subtitle: 'Standing on a half-sunken medieval timber boardwalk winding over black bog water between weeping willows and broken lanterns',
    landmarks_visible: 'Half-Sunken Timber Plank Boardwalk, Broken Lantern Post & Weeping Bog Willows',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(66, 94, 62, 0.13)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 9,
    tile_y: 11,
    facing: 'SOUTH',
    view_key: 'fp_venomous_jungle_9_11_south',
    image_path: '/lab-assets/images/terrain/jungle_venomous_trail_pov.jpg',
    view_title: 'Venomous Jungle — Bioluminescent Spore Hollow (South)',
    view_subtitle: 'Standing on mossy stone slabs between colossal coiled buttress roots and dripping lianas lit by eerie amber-green toxic fungi',
    landmarks_visible: 'Mossy Jungle Slabs, Coiled Buttress Roots & Glowing Toxic Fungi',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(46, 88, 54, 0.13)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },

  // M. Phase 5 Landmark Approach Completion (4-Way Directional Continuity)
  {
    tile_x: 6,
    tile_y: 7,
    facing: 'EAST',
    view_key: 'fp_plains_6_7_east_oakhaven',
    image_path: '/images/terrain/terrain_town_gates.webp',
    view_title: 'Western Approach — Looking East Toward Oakhaven Sanctuary',
    view_subtitle: 'Standing on the western frontier grassland track looking East toward the torchlit timber palisades and watchfires of Oakhaven Sanctuary',
    landmarks_visible: 'Western Frontier Track (Foreground), Oakhaven Timber Palisades & Watchfires (Ahead East)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(225, 170, 85, 0.09)',
    mist_style: 'gate-mist',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 60
  },
  {
    tile_x: 6,
    tile_y: 6,
    facing: 'EAST',
    view_key: 'fp_plains_6_6_east_north_gate',
    image_path: '/lab-assets/images/perspective/north_gate_7_6_west.jpg',
    view_title: 'Northwest Perimeter — Looking East Toward Oakhaven North Gate',
    view_subtitle: 'Looking East along Oakhaven’s northwestern timber palisade and watchtower brazier toward the Northern Gatehouse threshold',
    landmarks_visible: 'Oakhaven Western Watchtower & Palisade (Right), Oakhaven North Gate Road (Ahead East)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(205, 160, 92, 0.09)',
    mist_style: 'gate-mist',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 6,
    tile_y: 8,
    facing: 'EAST',
    view_key: 'fp_plains_6_8_east_south_gate',
    image_path: '/lab-assets/images/perspective/north_gate_7_6_west.jpg',
    view_title: 'Southwest Perimeter — Looking East Toward Fen-Ward South Gate',
    view_subtitle: 'Looking East along the southern timber palisade wall and corner watchtower toward Oakhaven’s Fen-Ward South Gate',
    landmarks_visible: 'Oakhaven Southern Timber Palisade & Watchtower (Left), Fen-Ward South Gate (Ahead East)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(195, 155, 92, 0.09)',
    mist_style: 'gate-mist',
    horizon_glow: 'warm-sanctuary',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 6,
    tile_y: 3,
    facing: 'EAST',
    view_key: 'fp_forest_6_3_east_oak',
    image_path: '/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg',
    view_title: 'Western Mirkwood — Approaching the Primeval Black Oak (East)',
    view_subtitle: 'Looking East along the mossy woodland floor as the colossal amber-veined root-arch of the Primeval Black Oak rises ahead through the mist',
    landmarks_visible: 'Mossy Oak Roots (Foreground), Colossal Primeval Black Oak of (7,3) Looming Ahead (East)',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(145, 125, 68, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 8,
    tile_y: 3,
    facing: 'WEST',
    view_key: 'fp_forest_8_3_west_oak',
    image_path: '/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg',
    view_title: 'Eastern Mirkwood — Approaching the Primeval Black Oak (West)',
    view_subtitle: 'Looking West from the fir ravine as the colossal gnarled root-arch and glowing sap fissures of the Primeval Black Oak loom ahead',
    landmarks_visible: 'Root-Strewn Ravine Track (Foreground), Colossal Primeval Black Oak of (7,3) Looming Ahead (West)',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(145, 125, 68, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 8,
    tile_y: 5,
    facing: 'WEST',
    view_key: 'fp_forest_8_5_west_crossroads',
    image_path: '/lab-assets/images/perspective/crossroads_7_5_lateral.jpg',
    view_title: 'Eastern Mirkwood Track — Approaching Mirkwood Crossroads (West)',
    view_subtitle: 'Looking West along the damp woodland track toward the weathered ranger signpost and mossy boundary stones of Mirkwood Crossroads',
    landmarks_visible: 'Eastern Woodland Trail (Foreground), Mirkwood Crossroads Signpost & Junction of (7,5) (Ahead West)',
    atmosphere_profile: 'forest-deep',
    lighting_tint: 'rgba(46, 82, 58, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 5,
    tile_y: 11,
    facing: 'WEST',
    view_key: 'fp_mire_approach_5_11_west',
    image_path: '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg',
    view_title: 'Rotting Fen — Approaching Deadman’s Mire (West)',
    view_subtitle: 'Looking West along the sunken marsh boardwalk as the tilted Gothic temple arches and drowned pillars of Deadman’s Mire rise out of the fog ahead',
    landmarks_visible: 'Sunken Fen Boardwalk & Willows (Foreground), Drowned Gothic Ruins of Deadman’s Mire (Ahead West)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(68, 96, 64, 0.12)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 4,
    tile_y: 12,
    facing: 'NORTH',
    view_key: 'fp_mire_approach_4_12_north',
    image_path: '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg',
    view_title: 'Southern Mire — Approaching Deadman’s Mire (North)',
    view_subtitle: 'Looking North across the black marsh pools toward the sunken Gothic stone colonnades and tilted obelisks of Deadman’s Mire',
    landmarks_visible: 'Southern Marsh Causeway (Foreground), Sunken Gothic Ruins of Deadman’s Mire (Ahead North)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(68, 96, 64, 0.12)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 6,
    tile_y: 9,
    facing: 'SOUTH',
    view_key: 'fp_rotting_fen_6_9_south',
    image_path: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg',
    view_title: 'Rotting Fen — Approaching the Sunken Willow Boardwalk (South)',
    view_subtitle: 'Looking South from the northern peat embankment onto the half-sunken timber plank causeway and broken iron lantern post of the Rotting Fen Boardwalk',
    landmarks_visible: 'Sunken Timber Plank Boardwalk, Tilted Lantern Post & Weeping Bog Willows (Ahead South)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(66, 94, 62, 0.13)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 8,
    tile_y: 11,
    facing: 'EAST',
    view_key: 'fp_jungle_8_11_east_hollow',
    image_path: '/lab-assets/images/terrain/jungle_venomous_trail_pov.jpg',
    view_title: 'Venomous Jungle — Approaching the Bioluminescent Spore Hollow (East)',
    view_subtitle: 'Looking East along damp mossy stone slabs toward colossal coiled buttress roots and pulsing amber-green spore clusters ahead',
    landmarks_visible: 'Mossy Jungle Stone Slabs (Foreground), Bioluminescent Spore Hollow of (9,11) (Ahead East)',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(46, 88, 54, 0.13)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 10,
    tile_y: 11,
    facing: 'WEST',
    view_key: 'fp_jungle_10_11_west_hollow',
    image_path: '/lab-assets/images/terrain/jungle_venomous_trail_pov.jpg',
    view_title: 'Venomous Jungle — Approaching the Bioluminescent Spore Hollow (West)',
    view_subtitle: 'Looking West through hanging lianas and buttress roots toward the glowing amber-green fungal hollow at the heart of the jungle',
    landmarks_visible: 'Hanging Lianas & Buttress Roots (Foreground), Bioluminescent Spore Hollow of (9,11) (Ahead West)',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(46, 88, 54, 0.13)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  },
  {
    tile_x: 9,
    tile_y: 12,
    facing: 'NORTH',
    view_key: 'fp_jungle_9_12_north_hollow',
    image_path: '/lab-assets/images/terrain/jungle_venomous_trail_pov.jpg',
    view_title: 'Venomous Jungle — Approaching the Bioluminescent Spore Hollow (North)',
    view_subtitle: 'Looking North across root-choked flagstones toward the eerie bioluminescent fungi and towering buttress roots of Spore Hollow',
    landmarks_visible: 'Root-Choked Jungle Slabs (Foreground), Bioluminescent Spore Hollow of (9,11) (Ahead North)',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(46, 88, 54, 0.13)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    focal_x: 50,
    focal_y: 62
  }
];

/**
 * Tiers 2 & 3 (`LANDMARK_DIRECTIONAL_POV` & `SUBBIOME_CONTEXT_POV`):
 * Scalable POV fallback rules for Mode C when an exact (x, y, facing) entry is not in `lab_perspective_views`.
 * Ensures Mode C NEVER falls back to an exterior overview (such as `terrain_bridge.webp` or `terrain_city_oakhaven.webp`)
 * and NEVER repeats a landmark-locked center asset (such as `forest_monolith_clearing.jpg`) in side facings.
 */
const DEFAULT_POV_CONTEXT_RULES = [
  // =========================================================================
  // TIER 2 — LANDMARK DIRECTIONAL POV (current landmark + facing/context)
  // =========================================================================
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_bridge_parapet_north',
    from_terrain: 'BRIDGE',
    from_feature: 'ANCIENT_BRIDGE',
    to_terrain: 'RIVER_LAKE',
    to_passable: 0,
    facing: 'NORTH',
    image_path: '/lab-assets/images/perspective/bridge_8_7_north.jpg',
    view_title: 'On The Old Stone Bridge — Looking North Over Parapet',
    view_subtitle: 'Standing on the wet flagstone bridge deck looking North over the weathered stone parapet into the churning Blackwater River',
    landmarks_visible: 'Stone Bridge Flagstones & Parapet Wall (Foreground), Churning Blackwater River (Below North), Northern Riverbank',
    atmosphere_profile: 'bridge',
    lighting_tint: 'rgba(72, 118, 158, 0.10)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 100
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_bridge_parapet_south',
    from_terrain: 'BRIDGE',
    from_feature: 'ANCIENT_BRIDGE',
    to_terrain: 'RIVER_LAKE',
    to_passable: 0,
    facing: 'SOUTH',
    image_path: '/lab-assets/images/perspective/bridge_8_7_south.jpg',
    view_title: 'On The Old Stone Bridge — Looking South Over Parapet',
    view_subtitle: 'Standing on the moss-grown bridge deck looking South over the stone parapet wall down the mist-shrouded Blackwater River',
    landmarks_visible: 'Stone Bridge Flagstones & Southern Parapet (Foreground), Blackwater River (Below South), Southern Reeds & Mist',
    atmosphere_profile: 'bridge',
    lighting_tint: 'rgba(76, 120, 156, 0.10)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 100
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_bridge_deck_east_generic',
    from_terrain: 'BRIDGE',
    from_feature: null,
    to_terrain: null,
    to_passable: null,
    facing: 'EAST',
    image_path: '/lab-assets/images/perspective/bridge_8_7_east.jpg',
    view_title: 'On Stone Bridge — Looking East Along Roadway',
    view_subtitle: 'Eye-level perspective along the mossy stone bridge deck toward the eastern bank',
    landmarks_visible: 'Stone Bridge Parapets (Foreground), Eastern Crossing Ahead',
    atmosphere_profile: 'bridge',
    lighting_tint: 'rgba(110, 145, 185, 0.08)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 85
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_bridge_deck_west_generic',
    from_terrain: 'BRIDGE',
    from_feature: null,
    to_terrain: null,
    to_passable: null,
    facing: 'WEST',
    image_path: '/lab-assets/images/perspective/bridge_8_7_west.jpg',
    view_title: 'On Stone Bridge — Looking West Along Roadway',
    view_subtitle: 'Eye-level perspective along the stone bridge deck toward the western bank',
    landmarks_visible: 'Stone Bridge Parapets (Foreground), Western Bank Ahead',
    atmosphere_profile: 'bridge',
    lighting_tint: 'rgba(215, 165, 95, 0.08)',
    mist_style: 'river-mist',
    horizon_glow: 'warm-sanctuary',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 85
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_ancient_oak_boughs',
    from_terrain: 'FOREST',
    from_feature: 'ANCIENT_OAK',
    to_terrain: null,
    to_passable: null,
    facing: null,
    image_path: '/lab-assets/images/terrain/forest_ancient_oak.jpg',
    view_title: 'Heart of the Mirkwood — Beneath the Ancient Oak',
    view_subtitle: 'Standing at eye-level beneath the colossal gnarled root arches of the primeval black oak',
    landmarks_visible: 'Colossal Ancient Black Oak & Root Arches (Foreground/Midground)',
    atmosphere_profile: 'ancient-oak',
    lighting_tint: 'rgba(185, 140, 70, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'OMNIDIRECTIONAL',
    priority: 95
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_watchpost_ruins_standing',
    from_terrain: 'UNDERGROUND_RUINS',
    from_feature: 'SUNK_RUIN',
    to_terrain: null,
    to_passable: null,
    facing: null,
    image_path: '/lab-assets/images/terrain/watchpost_ruins_exterior.jpg',
    view_title: 'At Bridge East Watchpost — Ruined Stone Arches',
    view_subtitle: 'Standing at eye-level amid the crumbling masonry arches of the eastern bridge watchpost',
    landmarks_visible: 'Weathered Watchtower Arches & Mossy Flagstones (Foreground)',
    atmosphere_profile: 'ruins-exterior',
    lighting_tint: 'rgba(130, 145, 175, 0.11)',
    mist_style: 'river-mist',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'OMNIDIRECTIONAL',
    priority: 95
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_town_gates_into_city',
    from_terrain: 'PLAINS',
    from_feature: 'TOWN_GATES',
    to_terrain: 'CITY',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/north_gate_7_6_south.jpg',
    view_title: 'At Oakhaven Gatehouse — Looking Into Oakhaven Street',
    view_subtitle: 'Standing at the timber gate threshold looking down the warm torchlit cobblestone street of Oakhaven',
    landmarks_visible: 'Gatehouse Timber Arch & Braziers (Foreground), Oakhaven Cobblestone Street (Ahead)',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(230, 175, 85, 0.09)',
    mist_style: 'warm-hearth',
    horizon_glow: 'warm-sanctuary',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 92
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_town_gates_perimeter',
    from_terrain: 'PLAINS',
    from_feature: 'TOWN_GATES',
    to_terrain: null,
    to_passable: null,
    facing: null,
    image_path: '/images/terrain/terrain_town_gates.webp',
    view_title: 'At Oakhaven Gatehouse — Palisade Perimeter',
    view_subtitle: 'Standing at eye-level beside the torchlit timber palisade walls and gatehouse road',
    landmarks_visible: 'Oakhaven Timber Palisade & Torchlit Gatehouse',
    atmosphere_profile: 'gatehouse',
    lighting_tint: 'rgba(230, 170, 80, 0.10)',
    mist_style: 'gate-mist',
    horizon_glow: 'warm-sanctuary',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 88
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_oakhaven_street_toward_gate',
    from_terrain: 'CITY',
    from_feature: 'MARKETPLACE',
    to_terrain: 'PLAINS',
    to_passable: 1,
    facing: null,
    image_path: '/images/terrain/terrain_town_gates.webp',
    view_title: 'Inside Oakhaven Sanctuary — Looking Toward Gatehouse',
    view_subtitle: 'Standing at street level inside Oakhaven looking toward the timber palisade gatehouse',
    landmarks_visible: 'Oakhaven Timber Palisade Gatehouse & Watchfires',
    atmosphere_profile: 'sanctuary',
    lighting_tint: 'rgba(230, 175, 85, 0.10)',
    mist_style: 'warm-hearth',
    horizon_glow: 'warm-sanctuary',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 92
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_oakhaven_street_interior',
    from_terrain: 'CITY',
    from_feature: null,
    to_terrain: null,
    to_passable: null,
    facing: null,
    image_path: '/lab-assets/images/perspective/north_gate_7_6_south.jpg',
    view_title: 'Inside Oakhaven Sanctuary — Cobblestone Thoroughfare',
    view_subtitle: 'Standing at eye-level on the warm torchlit cobblestone street between Oakhaven timber gables',
    landmarks_visible: 'Oakhaven Cobblestone Street, Braziers & Timber Halls',
    atmosphere_profile: 'sanctuary',
    lighting_tint: 'rgba(230, 175, 85, 0.09)',
    mist_style: 'warm-hearth',
    horizon_glow: 'warm-sanctuary',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'OMNIDIRECTIONAL',
    priority: 85
  },

  // =========================================================================
  // TIER 3 — SUBBIOME & ENVIRONMENTAL CONTEXT POV (current sub-biome + ahead context)
  // =========================================================================
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_forest_facing_crag_wall',
    from_terrain: 'FOREST',
    from_feature: null,
    to_terrain: 'MOUNTAINS',
    to_passable: 0,
    facing: null,
    image_path: '/lab-assets/images/perspective/crossroads_7_5_west.jpg',
    view_title: 'Mirkwood Edge — Sheer Cliff Wall Ahead',
    view_subtitle: 'Standing at eye-level on the root-tangled floor of Mirkwood; the impassable black granite cliff of Stonefang Crag rises directly ahead through the trees',
    landmarks_visible: 'Mirkwood Mossy Oak Trunks & Roots (Foreground), Sheer Granite Wall of Stonefang Crag (Ahead)',
    atmosphere_profile: 'forest-deep',
    lighting_tint: 'rgba(62, 86, 82, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'dark-crag',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 95
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_forest_track_east',
    from_terrain: 'FOREST',
    from_feature: null,
    to_terrain: 'FOREST',
    to_passable: 1,
    facing: 'EAST',
    image_path: '/lab-assets/images/perspective/crossroads_7_5_east.jpg',
    view_title: 'Mirkwood — Eastern Woodland Track',
    view_subtitle: 'Standing at eye-level on the damp forest floor looking East along a mossy woodland track winding between ancient oaks (no waystone in center)',
    landmarks_visible: 'Mossy Oak Trunks, Ferns & Boulders (Foreground), Eastern Woodland Track (Ahead East)',
    atmosphere_profile: 'forest-deep',
    lighting_tint: 'rgba(44, 80, 58, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 90
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_forest_facing_river_bank',
    from_terrain: 'FOREST',
    from_feature: null,
    to_terrain: 'RIVER_LAKE',
    to_passable: 0,
    facing: null,
    image_path: '/lab-assets/images/perspective/barrier_blackwater_bank_pov.jpg',
    view_title: 'Mirkwood Riverbank — Churning Blackwater River Ahead',
    view_subtitle: 'Standing at the forest edge on a muddy, reed-lined bank where the wide, furiously churning rapids of the Blackwater River block passage ahead',
    landmarks_visible: 'Forest Riverbank, Stones & Reeds (Foreground), Impassable Blackwater River Rapids (Ahead)',
    atmosphere_profile: 'water-barrier',
    lighting_tint: 'rgba(58, 112, 150, 0.13)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    priority: 88
  },
  {
    pov_tier: 2,
    tier_key: 'LANDMARK_DIRECTIONAL_POV',
    rule_key: 'pov_deadmans_mire_ruins',
    from_terrain: 'SWAMP',
    from_feature: 'SUNK_RUIN',
    to_terrain: null,
    to_passable: null,
    facing: null,
    image_path: '/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg',
    view_title: 'At Deadman’s Mire — Sunken Gothic Temple Ruins',
    view_subtitle: 'Standing on partially flooded flagstones amid the sinking Gothic temple arches and tilted carved pillars of Deadman’s Mire',
    landmarks_visible: 'Flooded Flagstones, Sunken Gothic Arches & Tilted Obelisks of Deadman’s Mire',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(68, 98, 66, 0.12)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 96
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_barrier_bottomless_mire',
    from_terrain: null,
    from_feature: null,
    to_terrain: 'SWAMP',
    to_passable: 0,
    facing: null,
    image_path: '/lab-assets/images/perspective/barrier_bottomless_mire_pov.jpg',
    view_title: 'Southern Edge — Impassable Bottomless Mire Ahead',
    view_subtitle: 'Standing at the end of solid ground where rope-lashed warning stakes mark a lethal, bubbling pitch-black quagmire blocking passage',
    landmarks_visible: 'Rope-Bound Wooden Warning Stakes (Foreground), Impassable Bubbling Quagmire of The Bottomless Mire (Ahead)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(54, 78, 52, 0.14)',
    mist_style: 'swamp-fog',
    horizon_glow: 'dark-crag',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    priority: 96
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_barrier_murksea_cliffs',
    from_terrain: null,
    from_feature: null,
    to_terrain: 'OCEAN',
    to_passable: 0,
    facing: null,
    image_path: '/lab-assets/images/perspective/barrier_murksea_cliffs_pov.jpg',
    view_title: 'Eastern Coast — Sheer Cliffs of The Murksea Ahead',
    view_subtitle: 'Standing beside a weathered coastal boundary cairn at the brink of sheer basalt sea cliffs battered by violent black ocean waves',
    landmarks_visible: 'Coastal Boundary Cairn & Cliff Brink (Foreground), Sheer Basalt Cliffs & Crashing Swells of The Murksea (Ahead)',
    atmosphere_profile: 'water-barrier',
    lighting_tint: 'rgba(56, 108, 148, 0.14)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    priority: 96
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_wilderness_facing_mountain_wall',
    from_terrain: null,
    from_feature: null,
    to_terrain: 'MOUNTAINS',
    to_passable: 0,
    facing: null,
    image_path: '/lab-assets/images/perspective/barrier_darkmount_crags_pov.jpg',
    view_title: 'Wilderness Crag — Impassable Darkmount Precipice Ahead',
    view_subtitle: 'Standing at eye-level where the highland trail terminates against a massive rockslide and sheer black granite cliffs blocking passage',
    landmarks_visible: 'Collapsed Boulder Talus (Foreground), Sheer Granite Cliffs of Darkmount Peaks (Ahead)',
    atmosphere_profile: 'mountain-barrier',
    lighting_tint: 'rgba(98, 108, 122, 0.12)',
    mist_style: 'crag-mist',
    horizon_glow: 'dark-crag',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    priority: 82
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_wilderness_facing_water_barrier',
    from_terrain: null,
    from_feature: null,
    to_terrain: 'RIVER_LAKE',
    to_passable: 0,
    facing: null,
    image_path: '/lab-assets/images/perspective/barrier_blackwater_bank_pov.jpg',
    view_title: 'Riverbank — Churning Blackwater Rapids Ahead',
    view_subtitle: 'Standing on the muddy reed-lined bank as the wide, furiously churning rapids of the Blackwater River block any crossing on foot',
    landmarks_visible: 'Muddy Bank, River Stones & Reeds (Foreground), Impassable Blackwater River Rapids (Ahead)',
    atmosphere_profile: 'water-barrier',
    lighting_tint: 'rgba(58, 112, 150, 0.13)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'BARRIER',
    directionality: 'DIRECTIONAL',
    priority: 82
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_plains_to_forest',
    from_terrain: 'PLAINS',
    from_feature: null,
    to_terrain: 'FOREST',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/transition_plains_to_forest_pov.jpg',
    view_title: 'Grassland Border — Approaching Mirkwood Tree Line',
    view_subtitle: 'A worn dirt-and-flagstone track leads across pale windswept grass straight into the brooding, mist-filled eaves of Mirkwood Forest ahead',
    landmarks_visible: 'Grassland Wagon Track & Flagstones (Foreground), Looming Mirkwood Forest Tree Line (Ahead)',
    atmosphere_profile: 'plains-open',
    lighting_tint: 'rgba(85, 110, 82, 0.09)',
    mist_style: 'light-haze',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 86
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_forest_to_plains',
    from_terrain: 'FOREST',
    from_feature: null,
    to_terrain: 'PLAINS',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/transition_forest_to_plains_pov.jpg',
    view_title: 'Mirkwood Eaves — Emerging Toward Open Grasslands',
    view_subtitle: 'Framed by overarching mossy oak boughs in the foreground, the woodland path opens out into windswept frontier plains ahead',
    landmarks_visible: 'Mossy Oak Trunks & Roots (Foreground Frame), Open Windswept Grasslands (Ahead)',
    atmosphere_profile: 'forest-clearing',
    lighting_tint: 'rgba(95, 118, 86, 0.09)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 86
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_plains_to_swamp',
    from_terrain: 'PLAINS',
    from_feature: null,
    to_terrain: 'SWAMP',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg',
    view_title: 'Southern Lowlands — Descending Into the Rotting Fen',
    view_subtitle: 'The muddy grassland track slopes downward into stagnant bog water, crooked dead willows, and a bank of greenish marsh fog ahead',
    landmarks_visible: 'Muddy Lowland Track (Foreground), Crooked Bog Willows & Rotting Fen Mist (Ahead)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(78, 104, 68, 0.11)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 86
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_swamp_to_plains',
    from_terrain: 'SWAMP',
    from_feature: null,
    to_terrain: 'PLAINS',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg',
    view_title: 'Fen Border — Climbing the Timber Causeway Out of the Marsh',
    view_subtitle: 'Standing on the half-sunken timber causeway in the willow mire, looking toward the drier lowland border ahead',
    landmarks_visible: 'Sunken Marsh Boardwalk & Willow Fen Edge (Foreground), Lowland Border Ahead',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(88, 108, 74, 0.10)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 84
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_forest_to_hills',
    from_terrain: 'FOREST',
    from_feature: null,
    to_terrain: 'HILLS',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/transition_forest_to_hills_pov.jpg',
    view_title: 'Western Woodland Edge — Climbing Into Raven Crags',
    view_subtitle: 'Mossy pine roots give way to an ascending rocky slate trail winding up between jagged highland boulders into Raven Crags',
    landmarks_visible: 'Forest Roots & Moss (Foreground), Ascending Slate Steps & Highland Boulders of Raven Crags (Ahead)',
    atmosphere_profile: 'hills-crag',
    lighting_tint: 'rgba(84, 102, 98, 0.10)',
    mist_style: 'moor-mist',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 86
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_hills_to_forest',
    from_terrain: 'HILLS',
    from_feature: null,
    to_terrain: 'FOREST',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/terrain/forest_pine_ravine.jpg',
    view_title: 'Highland Descent — Ravine Into Mirkwood Forest',
    view_subtitle: 'Descending between jagged highland boulders and mossy ravine ledges straight into the dark firs and pines of Mirkwood ahead',
    landmarks_visible: 'Rocky Highland Ravine Ledges (Foreground), Dark Fir & Pine Canopy of Mirkwood (Ahead)',
    atmosphere_profile: 'forest-ravine',
    lighting_tint: 'rgba(68, 96, 76, 0.10)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 85
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_plains_to_hills',
    from_terrain: 'PLAINS',
    from_feature: null,
    to_terrain: 'HILLS',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/terrain/hills_highland_ridge_pov.jpg',
    view_title: 'Western Foothills — Ascending Toward Raven Crags',
    view_subtitle: 'The open grassy track climbs onto cracked grey flagstones winding up along the windswept highland ridge of Raven Crags',
    landmarks_visible: 'Grassy Foothill Flagstones (Foreground), Windswept Highland Ridge of Raven Crags (Ahead)',
    atmosphere_profile: 'hills-crag',
    lighting_tint: 'rgba(110, 118, 128, 0.10)',
    mist_style: 'moor-mist',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 85
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_hills_to_plains',
    from_terrain: 'HILLS',
    from_feature: null,
    to_terrain: 'PLAINS',
    to_passable: 1,
    facing: null,
    image_path: '/images/terrain/terrain_plains.webp',
    view_title: 'Eastern Foothills — Descending Onto the Verdant Plains',
    view_subtitle: 'Looking past rocky foothill boulders as the highland track opens out into the wide windswept grasslands of the Verdant Plains',
    landmarks_visible: 'Rocky Foothill Boulders (Foreground), Open Windswept Grasslands (Ahead)',
    atmosphere_profile: 'plains-open',
    lighting_tint: 'rgba(135, 142, 125, 0.09)',
    mist_style: 'light-haze',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 84
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_hills_to_swamp',
    from_terrain: 'HILLS',
    from_feature: null,
    to_terrain: 'SWAMP',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg',
    view_title: 'Southern Crags — Descending Into the Rotting Fen',
    view_subtitle: 'Looking South down the rocky highland slope as dry stone gives way to stagnant marsh water, crooked bog willows, and drifting green fen mist ahead',
    landmarks_visible: 'Rocky Foothill Slope (Foreground), Stagnant Waters & Willows of the Rotting Fen (Ahead)',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(78, 104, 68, 0.11)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 85
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_swamp_to_hills',
    from_terrain: 'SWAMP',
    from_feature: null,
    to_terrain: 'HILLS',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/terrain/hills_highland_ridge_pov.jpg',
    view_title: 'Northern Fen Border — Ascending Toward Raven Crags',
    view_subtitle: 'Looking North from the marsh edge as the soggy track climbs onto cracked grey flagstones and rugged highland ridges rising into Raven Crags',
    landmarks_visible: 'Marsh Edge & Flagstone Climb (Foreground), Rugged Highland Ridge of Raven Crags (Ahead)',
    atmosphere_profile: 'hills-crag',
    lighting_tint: 'rgba(104, 114, 122, 0.10)',
    mist_style: 'moor-mist',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 85
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_swamp_to_jungle',
    from_terrain: 'SWAMP',
    from_feature: null,
    to_terrain: 'JUNGLE',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/transition_swamp_to_jungle_pov.jpg',
    view_title: 'Fen Edge — Entering the Venomous Jungle',
    view_subtitle: 'Shallow bog water and muddy earth lead directly into a towering wall of colossal jungle buttress roots, hanging lianas, and glowing spores ahead',
    landmarks_visible: 'Bog Mud & Water (Foreground), Colossal Buttress Roots & Lianas of Venomous Jungle (Ahead)',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(48, 88, 54, 0.13)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 86
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_jungle_to_swamp',
    from_terrain: 'JUNGLE',
    from_feature: null,
    to_terrain: 'SWAMP',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg',
    view_title: 'Jungle Border — Looking Out Into the Rotting Fen',
    view_subtitle: 'Stepping from the dense jungle roots onto a rotting timber boardwalk winding into the stagnant waters of the Rotting Fen',
    landmarks_visible: 'Rotting Timber Boardwalk & Weeping Bog Willows Ahead',
    atmosphere_profile: 'swamp-mire',
    lighting_tint: 'rgba(62, 92, 58, 0.13)',
    mist_style: 'swamp-fog',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 85
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_plains_to_jungle',
    from_terrain: 'PLAINS',
    from_feature: null,
    to_terrain: 'JUNGLE',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/transition_swamp_to_jungle_pov.jpg',
    view_title: 'Southern Frontier — Approaching the Venomous Jungle',
    view_subtitle: 'The frontier track descends into a humid, towering wall of jungle buttress roots, hanging vines, and bioluminescent spores',
    landmarks_visible: 'Lowland Path (Foreground), Towering Canopy of the Venomous Jungle (Ahead)',
    atmosphere_profile: 'jungle',
    lighting_tint: 'rgba(52, 88, 56, 0.12)',
    mist_style: 'deep-forest',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 85
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_jungle_to_plains',
    from_terrain: 'JUNGLE',
    from_feature: null,
    to_terrain: 'PLAINS',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/perspective/transition_forest_to_plains_pov.jpg',
    view_title: 'Northern Jungle Edge — Emerging Onto the Frontier Plains',
    view_subtitle: 'Looking North through overhanging boughs and vines as the trail emerges onto the windswept eastern grasslands',
    landmarks_visible: 'Overhanging Vines & Trunks (Foreground), Eastern Frontier Grasslands (Ahead)',
    atmosphere_profile: 'plains-open',
    lighting_tint: 'rgba(88, 114, 82, 0.10)',
    mist_style: 'light-haze',
    horizon_glow: 'none',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'SUBBIOME',
    directionality: 'DIRECTIONAL',
    priority: 84
  },
  {
    pov_tier: 3,
    tier_key: 'SUBBIOME_CONTEXT_POV',
    rule_key: 'pov_transition_plains_to_ruins',
    from_terrain: 'PLAINS',
    from_feature: null,
    to_terrain: 'UNDERGROUND_RUINS',
    to_passable: 1,
    facing: null,
    image_path: '/lab-assets/images/terrain/watchpost_ruins_exterior.jpg',
    view_title: 'Eastern Frontier — Approaching Bridge East Watchpost',
    view_subtitle: 'Looking West along the overgrown frontier road toward the crumbling Gothic archway and ruined stone tower of Bridge East Watchpost',
    landmarks_visible: 'Overgrown Stone Road (Foreground), Bridge East Watchpost Ruins & Blackwater Gorge (Ahead)',
    atmosphere_profile: 'ruins-exterior',
    lighting_tint: 'rgba(130, 145, 175, 0.10)',
    mist_style: 'river-mist',
    horizon_glow: 'cold-water',
    camera_type: 'POV',
    environment_scope: 'OUTDOOR',
    view_category: 'LANDMARK',
    directionality: 'DIRECTIONAL',
    priority: 88
  }
];

function ensureSceneVariantMetadataColumns(db) {
  const existingCols = new Set(
    db.prepare('PRAGMA table_info(lab_scene_variants)').all().map(c => c.name)
  );
  const additions = [
    ['camera_type', "TEXT NOT NULL DEFAULT 'POV'"],
    ['environment_scope', "TEXT NOT NULL DEFAULT 'OUTDOOR'"],
    ['view_category', "TEXT NOT NULL DEFAULT 'GENERIC_TERRAIN'"],
    ['directionality', "TEXT NOT NULL DEFAULT 'OMNIDIRECTIONAL'"],
    ['has_directional_landmark', 'INTEGER NOT NULL DEFAULT 0'],
    ['safe_for_pov_fallback', 'INTEGER NOT NULL DEFAULT 1']
  ];
  for (const [colName, colDef] of additions) {
    if (!existingCols.has(colName)) {
      db.exec(`ALTER TABLE lab_scene_variants ADD COLUMN ${colName} ${colDef};`);
    }
  }
}

function initSceneCatalogTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lab_scene_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terrain_type TEXT NOT NULL,
      location_key TEXT DEFAULT NULL,
      tile_id INTEGER DEFAULT NULL,
      variant_index INTEGER NOT NULL DEFAULT 0,
      variant_key TEXT NOT NULL UNIQUE,
      image_path TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      atmosphere_profile TEXT NOT NULL DEFAULT 'wilderness',
      lighting_tint TEXT NOT NULL DEFAULT 'rgba(14, 18, 26, 0.12)',
      mist_style TEXT NOT NULL DEFAULT 'forest-mist',
      focal_x INTEGER NOT NULL DEFAULT 50,
      focal_y INTEGER NOT NULL DEFAULT 46,
      camera_type TEXT NOT NULL DEFAULT 'POV',
      environment_scope TEXT NOT NULL DEFAULT 'OUTDOOR',
      view_category TEXT NOT NULL DEFAULT 'GENERIC_TERRAIN',
      directionality TEXT NOT NULL DEFAULT 'OMNIDIRECTIONAL',
      has_directional_landmark INTEGER NOT NULL DEFAULT 0,
      safe_for_pov_fallback INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_lab_scene_variants_lookup
      ON lab_scene_variants(terrain_type, location_key, is_active, variant_index);

    CREATE TABLE IF NOT EXISTS lab_directional_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_terrain TEXT DEFAULT NULL,
      from_feature TEXT DEFAULT NULL,
      to_terrain TEXT DEFAULT NULL,
      to_feature TEXT DEFAULT NULL,
      facing TEXT DEFAULT NULL,
      variant_key TEXT NOT NULL,
      view_title TEXT NOT NULL,
      view_caption TEXT NOT NULL,
      focal_x INTEGER NOT NULL DEFAULT 50,
      focal_y INTEGER NOT NULL DEFAULT 45,
      priority INTEGER NOT NULL DEFAULT 10,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lab_perspective_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tile_x INTEGER NOT NULL,
      tile_y INTEGER NOT NULL,
      facing TEXT NOT NULL,
      view_key TEXT NOT NULL UNIQUE,
      image_path TEXT NOT NULL,
      view_title TEXT NOT NULL,
      view_subtitle TEXT NOT NULL,
      landmarks_visible TEXT DEFAULT NULL,
      atmosphere_profile TEXT NOT NULL DEFAULT 'wilderness',
      lighting_tint TEXT NOT NULL DEFAULT 'rgba(14, 18, 26, 0.08)',
      mist_style TEXT NOT NULL DEFAULT 'forest-mist',
      horizon_glow TEXT NOT NULL DEFAULT 'none',
      focal_x INTEGER NOT NULL DEFAULT 50,
      focal_y INTEGER NOT NULL DEFAULT 48,
      is_active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(tile_x, tile_y, facing)
    );

    CREATE TABLE IF NOT EXISTS lab_pov_context_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pov_tier INTEGER NOT NULL,
      tier_key TEXT NOT NULL,
      rule_key TEXT NOT NULL UNIQUE,
      from_terrain TEXT DEFAULT NULL,
      from_feature TEXT DEFAULT NULL,
      to_terrain TEXT DEFAULT NULL,
      to_passable INTEGER DEFAULT NULL,
      facing TEXT DEFAULT NULL,
      image_path TEXT NOT NULL,
      view_title TEXT NOT NULL,
      view_subtitle TEXT NOT NULL,
      landmarks_visible TEXT DEFAULT NULL,
      atmosphere_profile TEXT NOT NULL DEFAULT 'wilderness',
      lighting_tint TEXT NOT NULL DEFAULT 'rgba(14, 18, 26, 0.08)',
      mist_style TEXT NOT NULL DEFAULT 'forest-mist',
      horizon_glow TEXT NOT NULL DEFAULT 'none',
      camera_type TEXT NOT NULL DEFAULT 'POV',
      environment_scope TEXT NOT NULL DEFAULT 'OUTDOOR',
      view_category TEXT NOT NULL DEFAULT 'SUBBIOME',
      directionality TEXT NOT NULL DEFAULT 'DIRECTIONAL',
      priority INTEGER NOT NULL DEFAULT 50,
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `);

  ensureSceneVariantMetadataColumns(db);
  db.exec('UPDATE lab_scene_variants SET is_active = 0;');

  const insertVariant = db.prepare(`
    INSERT INTO lab_scene_variants (
      terrain_type, location_key, tile_id, variant_index, variant_key,
      image_path, title, subtitle, atmosphere_profile, lighting_tint,
      mist_style, focal_x, focal_y,
      camera_type, environment_scope, view_category, directionality,
      has_directional_landmark, safe_for_pov_fallback, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(variant_key) DO UPDATE SET
      terrain_type = excluded.terrain_type,
      location_key = excluded.location_key,
      variant_index = excluded.variant_index,
      image_path = excluded.image_path,
      title = excluded.title,
      subtitle = excluded.subtitle,
      atmosphere_profile = excluded.atmosphere_profile,
      lighting_tint = excluded.lighting_tint,
      mist_style = excluded.mist_style,
      focal_x = excluded.focal_x,
      focal_y = excluded.focal_y,
      camera_type = excluded.camera_type,
      environment_scope = excluded.environment_scope,
      view_category = excluded.view_category,
      directionality = excluded.directionality,
      has_directional_landmark = excluded.has_directional_landmark,
      safe_for_pov_fallback = excluded.safe_for_pov_fallback,
      is_active = 1
  `);

  for (const v of DEFAULT_SCENE_VARIANTS) {
    insertVariant.run(
      v.terrain_type,
      v.location_key,
      v.tile_id,
      v.variant_index,
      v.variant_key,
      v.image_path,
      v.title,
      v.subtitle,
      v.atmosphere_profile,
      v.lighting_tint,
      v.mist_style,
      v.focal_x,
      v.focal_y,
      v.camera_type || 'POV',
      v.environment_scope || 'OUTDOOR',
      v.view_category || 'GENERIC_TERRAIN',
      v.directionality || 'OMNIDIRECTIONAL',
      Number(v.has_directional_landmark || 0),
      Number(v.safe_for_pov_fallback !== undefined ? v.safe_for_pov_fallback : 1)
    );
  }

  db.exec('DELETE FROM lab_directional_overrides;');
  const insertDirOverride = db.prepare(`
    INSERT INTO lab_directional_overrides (
      from_terrain, from_feature, to_terrain, to_feature, facing,
      variant_key, view_title, view_caption, focal_x, focal_y, priority, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const d of DEFAULT_DIRECTIONAL_OVERRIDES) {
    insertDirOverride.run(
      d.from_terrain,
      d.from_feature,
      d.to_terrain,
      d.to_feature,
      d.facing,
      d.variant_key,
      d.view_title,
      d.view_caption,
      d.focal_x,
      d.focal_y,
      d.priority
    );
  }

  db.exec('DELETE FROM lab_perspective_views;');
  const insertPerspectiveView = db.prepare(`
    INSERT INTO lab_perspective_views (
      tile_x, tile_y, facing, view_key, image_path,
      view_title, view_subtitle, landmarks_visible,
      atmosphere_profile, lighting_tint, mist_style, horizon_glow,
      focal_x, focal_y, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const p of DEFAULT_PERSPECTIVE_VIEWS) {
    insertPerspectiveView.run(
      p.tile_x,
      p.tile_y,
      p.facing,
      p.view_key,
      p.image_path,
      p.view_title,
      p.view_subtitle,
      p.landmarks_visible,
      p.atmosphere_profile,
      p.lighting_tint,
      p.mist_style,
      p.horizon_glow,
      p.focal_x,
      p.focal_y
    );
  }

  db.exec('DELETE FROM lab_pov_context_rules;');
  const insertPovRule = db.prepare(`
    INSERT INTO lab_pov_context_rules (
      pov_tier, tier_key, rule_key, from_terrain, from_feature,
      to_terrain, to_passable, facing, image_path, view_title,
      view_subtitle, landmarks_visible, atmosphere_profile, lighting_tint,
      mist_style, horizon_glow, camera_type, environment_scope,
      view_category, directionality, priority, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const r of DEFAULT_POV_CONTEXT_RULES) {
    insertPovRule.run(
      r.pov_tier,
      r.tier_key,
      r.rule_key,
      r.from_terrain,
      r.from_feature,
      r.to_terrain,
      r.to_passable,
      r.facing,
      r.image_path,
      r.view_title,
      r.view_subtitle,
      r.landmarks_visible,
      r.atmosphere_profile,
      r.lighting_tint,
      r.mist_style,
      r.horizon_glow,
      r.camera_type,
      r.environment_scope,
      r.view_category,
      r.directionality,
      r.priority
    );
  }

  initTravelContinuityTables(db);
}

function buildSceneContinuityMetadata(db, current, ahead1, left1, right1, facing, behindOverride = null) {
  const compassContext = computeDirectionalCompassContext(current, {
    ahead: ahead1,
    left: left1,
    right: right1,
    behind: behindOverride || undefined
  }, facing);
  const biomePersistence = resolveBiomePersistence(current, ahead1, null, facing, 1);
  const boundaryGuidance = resolveBoundaryGuidance(current, ahead1, facing);
  const transitionContinuity = evaluateTransitionContinuity(null, current, {
    facing,
    previousFacing: facing,
    aheadTile: ahead1,
    leftTile: left1,
    rightTile: right1,
    behindTile: compassContext.behind
  });

  return {
    transitionContext: transitionContinuity.transitionContext,
    matchedContexts: transitionContinuity.matchedContexts,
    continuityNote: transitionContinuity.continuityNote,
    horizonHint: transitionContinuity.horizonHint,
    behindHint: transitionContinuity.behindHint,
    corridorKey: transitionContinuity.corridorKey,
    compassContext,
    relativeVistas: compassContext.relativeVistas,
    biomePersistence,
    boundaryGuidance
  };
}

function formatVariantRow(row, matchSource = 'TERRAIN_VARIANT', poolSize = 1) {
  if (!row) {
    return {
      variantKey: 'plains_windswept_trail',
      imageUrl: '/images/terrain/terrain_plains.webp',
      title: 'Verdant Plains — Windswept Trail',
      subtitle: 'Muddy wheel-ruts cutting across pale windswept grasses under storm clouds',
      terrainType: 'PLAINS',
      locationKey: null,
      variantIndex: 0,
      poolSize: 1,
      atmosphereProfile: 'plains-open',
      lightingTint: 'rgba(180, 165, 125, 0.08)',
      mistStyle: 'light-haze',
      focalX: 50,
      focalY: 45,
      cameraType: 'POV',
      environmentScope: 'OUTDOOR',
      viewCategory: 'GENERIC_TERRAIN',
      directionality: 'OMNIDIRECTIONAL',
      hasDirectionalLandmark: false,
      safeForPovFallback: true,
      matchSource: 'FALLBACK'
    };
  }
  return {
    variantKey: row.variant_key,
    imageUrl: row.image_path,
    title: row.title,
    subtitle: row.subtitle,
    terrainType: row.terrain_type,
    locationKey: row.location_key || null,
    variantIndex: Number(row.variant_index || 0),
    poolSize: Number(poolSize || 1),
    atmosphereProfile: row.atmosphere_profile || 'wilderness',
    lightingTint: row.lighting_tint || 'rgba(14, 18, 26, 0.12)',
    mistStyle: row.mist_style || 'forest-mist',
    focalX: Number(row.focal_x || 50),
    focalY: Number(row.focal_y || 45),
    cameraType: row.camera_type || 'POV',
    environmentScope: row.environment_scope || 'OUTDOOR',
    viewCategory: row.view_category || 'GENERIC_TERRAIN',
    directionality: row.directionality || 'OMNIDIRECTIONAL',
    hasDirectionalLandmark: Boolean(row.has_directional_landmark),
    safeForPovFallback: Boolean(row.safe_for_pov_fallback !== undefined ? row.safe_for_pov_fallback : 1),
    matchSource
  };
}

/**
 * Resolves the deterministic visual variant for any map tile `(x, y, terrain, feature, id)`
 * for Mode A and Mode B.
 */
function resolveTileVariant(db, tile) {
  if (!tile) {
    const fb = db.prepare("SELECT * FROM lab_scene_variants WHERE variant_key = 'fallback_misty_realm' LIMIT 1").get();
    return formatVariantRow(fb, 'FALLBACK', 1);
  }

  // 1. Exact tile_id override
  if (tile.id) {
    const byTile = db.prepare(
      'SELECT * FROM lab_scene_variants WHERE tile_id = ? AND is_active = 1 LIMIT 1'
    ).get(tile.id);
    if (byTile) {
      return formatVariantRow(byTile, 'TILE_OVERRIDE', 1);
    }
  }

  // 2. Landmark feature override (location_key)
  if (tile.feature) {
    const byFeature = db.prepare(
      'SELECT * FROM lab_scene_variants WHERE location_key = ? AND is_active = 1 LIMIT 1'
    ).get(tile.feature);
    if (byFeature) {
      return formatVariantRow(byFeature, 'LANDMARK_OVERRIDE', 1);
    }
  }

  // 3. Multi-variant terrain pool (deterministic spatial selection by x, y)
  const terrainKey = tile.terrain || 'FALLBACK';
  const pool = db.prepare(`
    SELECT * FROM lab_scene_variants
    WHERE terrain_type = ? AND location_key IS NULL AND tile_id IS NULL AND is_active = 1
    ORDER BY variant_index ASC, id ASC
  `).all(terrainKey);

  if (pool && pool.length > 0) {
    const chosenIdx = computeDeterministicVariantIndex(tile.x, tile.y, pool.length);
    const chosen = pool[chosenIdx] || pool[0];
    return formatVariantRow(chosen, 'TERRAIN_VARIANT', pool.length);
  }

  // 4. Fallback
  const fb = db.prepare("SELECT * FROM lab_scene_variants WHERE variant_key = 'fallback_misty_realm' LIMIT 1").get();
  return formatVariantRow(fb, 'FALLBACK', 1);
}

/**
 * Computes scene-aware stage anchor metadata (`stageAnchor`) so Integrated monsters
 * are grounded on the actual perspective floor/roadway rather than floating in mid-screen.
 */
function computeSceneStageAnchor(variantKey, terrainType, atmosphereProfile, isBlockedAhead = false) {
  const key = String(variantKey || '').toLowerCase();
  const terrain = String(terrainType || '').toUpperCase();
  const profile = String(atmosphereProfile || '').toLowerCase();

  let groundSurfaceType = 'wilderness-soil';
  let groundShadowTint = 'rgba(10, 11, 9, 0.72)';
  let stageFloorY = 82;
  let stageCenterX = 50;
  let stageScale = 1.0;
  let horizonY = 46;
  let isWalkableCombatStage = true;

  if (terrain === 'BRIDGE' || profile === 'bridge' || key.includes('bridge')) {
    groundSurfaceType = 'flagstone';
    groundShadowTint = 'rgba(7, 11, 17, 0.76)';
    stageFloorY = 83;
    stageCenterX = 50;
    stageScale = 1.0;
    horizonY = 46;
    if (key.includes('parapet_north') || key.includes('parapet_south')) {
      isWalkableCombatStage = false;
    }
  } else if (terrain === 'FOREST' || profile.startsWith('forest') || profile === 'ancient-oak' || key.includes('crossroads')) {
    groundSurfaceType = 'forest-earth';
    groundShadowTint = 'rgba(11, 13, 8, 0.72)';
    stageFloorY = 82;
    stageScale = 0.98;
    horizonY = 46;
    // Shift slightly away from the foreground Rune Waystone on (7,5) N/S so the monster stands squarely in the road
    if (key === 'fp_crossroads_7_5_north') {
      stageCenterX = 46;
    } else if (key === 'fp_crossroads_7_5_south') {
      stageCenterX = 54;
    } else {
      stageCenterX = 50;
    }
  } else if (terrain === 'CITY' || profile === 'sanctuary' || profile === 'gatehouse' || key.includes('north_gate')) {
    groundSurfaceType = 'cobble-road';
    groundShadowTint = 'rgba(13, 10, 7, 0.74)';
    stageFloorY = 83;
    stageCenterX = 50;
    stageScale = 1.0;
    horizonY = 46;
  } else if (terrain === 'UNDERGROUND_RUINS' || profile.startsWith('ruins')) {
    groundSurfaceType = 'flagstone';
    groundShadowTint = 'rgba(8, 11, 15, 0.76)';
    stageFloorY = 82;
    stageCenterX = 50;
    stageScale = 0.98;
  } else if (terrain === 'SWAMP' || profile.startsWith('swamp')) {
    groundSurfaceType = 'mire-mud';
    groundShadowTint = 'rgba(8, 13, 9, 0.75)';
    stageFloorY = 82;
    stageCenterX = 50;
    stageScale = 0.98;
  }

  return {
    stageFloorY,
    stageCenterX,
    stageScale,
    groundSurfaceType,
    groundShadowTint,
    horizonY,
    isWalkableCombatStage
  };
}

/**
 * Computes subtle, natural camera framing and supporting atmosphere cues for a resolved single scene.
 */
function buildAtmosphereAndFraming(primaryVariant, current, ahead1, left1, right1, facing, seed) {
  const facingOffsetMap = {
    NORTH: { panX: -1.2, panY: -0.5 },
    EAST:  { panX:  1.2, panY:  0.3 },
    SOUTH: { panX:  0.8, panY:  0.6 },
    WEST:  { panX: -0.8, panY: -0.3 }
  };
  const baseOffset = facingOffsetMap[facing] || { panX: 0, panY: 0 };

  const microX = (((seed % 100) / 100) - 0.5) * 1.2;
  const microY = ((((seed >>> 8) % 100) / 100) - 0.5) * 0.8;

  const focalX = Math.max(44, Math.min(56, Number((primaryVariant.focalX + baseOffset.panX + microX).toFixed(1))));
  const focalY = Math.max(42, Math.min(68, Number((primaryVariant.focalY + baseOffset.panY + microY).toFixed(1))));

  let horizonGlow = 'none';
  if (ahead1 && (ahead1.isSafe || ahead1.feature === 'TOWN_GATES' || ahead1.terrain === 'CITY')) {
    horizonGlow = 'warm-sanctuary';
  } else if (ahead1 && ahead1.hasPersistentThreat) {
    horizonGlow = 'ominous-threat';
  } else if (ahead1 && !ahead1.isPassable && (ahead1.terrain === 'RIVER_LAKE' || ahead1.terrain === 'OCEAN')) {
    horizonGlow = 'cold-water';
  } else if (ahead1 && !ahead1.isPassable && ahead1.terrain === 'MOUNTAINS') {
    horizonGlow = 'dark-crag';
  }

  const flankLeftHint = left1 && !left1.isPassable
    ? (left1.terrain === 'RIVER_LAKE' || left1.terrain === 'OCEAN' ? 'water-edge' : 'rock-shadow')
    : 'open';
  const flankRightHint = right1 && !right1.isPassable
    ? (right1.terrain === 'RIVER_LAKE' || right1.terrain === 'OCEAN' ? 'water-edge' : 'rock-shadow')
    : 'open';

  let weatherEffect = 'none';
  const profile = primaryVariant.atmosphereProfile || '';
  if (profile === 'bridge' || profile === 'water-barrier' || profile === 'ruins-exterior') {
    weatherEffect = 'drizzle-mist';
  } else if (profile.startsWith('forest') || profile === 'ancient-oak' || profile.startsWith('swamp')) {
    weatherEffect = 'forest-motes';
  } else if (profile === 'sanctuary' || profile === 'gatehouse') {
    weatherEffect = 'hearth-embers';
  }

  const isBlockedAhead = Boolean(ahead1 && !ahead1.isPassable);
  return {
    focalX,
    focalY,
    panX: Number((baseOffset.panX * 0.75).toFixed(2)),
    panY: Number((baseOffset.panY * 0.75).toFixed(2)),
    lightingTint: primaryVariant.lightingTint,
    mistStyle: primaryVariant.mistStyle,
    atmosphereProfile: primaryVariant.atmosphereProfile,
    horizonGlow,
    flankLeftHint,
    flankRightHint,
    weatherEffect,
    stageAnchor: computeSceneStageAnchor(
      primaryVariant.variantKey,
      primaryVariant.terrainType || (current && current.terrain),
      primaryVariant.atmosphereProfile,
      isBlockedAhead
    )
  };
}

/**
 * MODE A — Single Scene (Place-Centric Cohesive Scene)
 */
function resolveSceneModeA(db, current, ahead1, left1, right1, facing, seed, inActiveCombat = false) {
  const currentVariant = current.variant || resolveTileVariant(db, current);
  const aheadVariant = ahead1.variant || resolveTileVariant(db, ahead1);

  let chosenVariant = currentVariant;
  let sceneRole = 'CURRENT_LOCATION';
  let viewTitle = currentVariant.title;
  let viewSubtitle = currentVariant.subtitle;
  let viewBadge = `📍 At: ${current.name}`;

  if (ahead1 && !ahead1.isPassable && !inActiveCombat) {
    chosenVariant = aheadVariant;
    sceneRole = 'IMPASSABLE_BARRIER_AHEAD';
    viewTitle = `${ahead1.name} (Blocked ${facing})`;
    viewSubtitle = ahead1.description || aheadVariant.subtitle;
    viewBadge = `⛔ Blocked (${facing}): ${ahead1.name}`;
  } else if (ahead1 && !ahead1.isPassable && inActiveCombat) {
    viewTitle = `${currentVariant.title} • Blocked ${facing}: ${ahead1.name}`;
    viewBadge = `⚔️ Combat at ${current.name}`;
  } else if (ahead1 && ahead1.exists) {
    viewBadge = `🧭 ${facing}: Toward ${ahead1.name}`;
  }

  const framing = buildAtmosphereAndFraming(chosenVariant, current, ahead1, left1, right1, facing, seed);
  const continuityMeta = buildSceneContinuityMetadata(db, current, ahead1, left1, right1, facing);

  return {
    mode: 'A',
    modeLabel: 'Single Scene (A)',
    sceneRole,
    variantKey: chosenVariant.variantKey,
    imageUrl: chosenVariant.imageUrl,
    viewTitle,
    viewSubtitle,
    viewBadge,
    variantIndex: chosenVariant.variantIndex,
    poolSize: chosenVariant.poolSize,
    matchSource: chosenVariant.matchSource,
    cameraType: chosenVariant.cameraType || 'POV',
    environmentScope: chosenVariant.environmentScope || 'OUTDOOR',
    viewCategory: chosenVariant.viewCategory || 'GENERIC_TERRAIN',
    directionality: chosenVariant.directionality || 'OMNIDIRECTIONAL',
    isBlockedAhead: Boolean(ahead1 && !ahead1.isPassable),
    blockedObstacleName: (ahead1 && !ahead1.isPassable) ? ahead1.name : null,
    blockedObstacleTerrain: (ahead1 && !ahead1.isPassable) ? ahead1.terrain : null,
    useAheadPortal: false,
    useLegacySvg: false,
    ...framing,
    ...continuityMeta
  };
}

/**
 * MODE B — Directional Scene (Forward-Vista-Centric Cohesive Scene)
 */
function resolveSceneModeB(db, current, ahead1, left1, right1, facing, seed) {
  const continuityMeta = buildSceneContinuityMetadata(db, current, ahead1, left1, right1, facing);
  const currentVariant = current.variant || resolveTileVariant(db, current);
  const aheadVariant = ahead1.variant || resolveTileVariant(db, ahead1);

  const overrides = db.prepare(`
    SELECT * FROM lab_directional_overrides
    WHERE is_active = 1
      AND (from_terrain IS NULL OR from_terrain = ?)
      AND (from_feature IS NULL OR from_feature = ?)
      AND (to_terrain IS NULL OR to_terrain = ?)
      AND (to_feature IS NULL OR to_feature = ?)
      AND (facing IS NULL OR facing = ?)
    ORDER BY priority DESC, id ASC
    LIMIT 1
  `).get(
    current.terrain || '',
    current.feature || '',
    ahead1 ? (ahead1.terrain || '') : '',
    ahead1 ? (ahead1.feature || '') : '',
    facing
  );

  if (overrides) {
    const vRow = db.prepare(
      'SELECT * FROM lab_scene_variants WHERE variant_key = ? AND is_active = 1 LIMIT 1'
    ).get(overrides.variant_key);
    const chosenVariant = vRow
      ? formatVariantRow(vRow, 'DIRECTIONAL_OVERRIDE', 1)
      : aheadVariant;
    chosenVariant.focalX = Number(overrides.focal_x || chosenVariant.focalX || 50);
    chosenVariant.focalY = Number(overrides.focal_y || chosenVariant.focalY || 45);

    const framing = buildAtmosphereAndFraming(chosenVariant, current, ahead1, left1, right1, facing, seed);
    return {
      mode: 'B',
      modeLabel: 'Directional Scene (B)',
      sceneRole: 'DIRECTIONAL_LANDMARK_PAIR',
      variantKey: chosenVariant.variantKey,
      imageUrl: chosenVariant.imageUrl,
      viewTitle: overrides.view_title,
      viewSubtitle: overrides.view_caption,
      viewBadge: `👁️ Looking ${facing}: ${ahead1 ? ahead1.name : current.name}`,
      variantIndex: chosenVariant.variantIndex,
      poolSize: chosenVariant.poolSize,
      matchSource: 'DIRECTIONAL_OVERRIDE',
      cameraType: chosenVariant.cameraType || 'POV',
      environmentScope: chosenVariant.environmentScope || 'OUTDOOR',
      viewCategory: chosenVariant.viewCategory || 'LANDMARK',
      directionality: chosenVariant.directionality || 'DIRECTIONAL',
      isBlockedAhead: Boolean(ahead1 && !ahead1.isPassable),
      blockedObstacleName: (ahead1 && !ahead1.isPassable) ? ahead1.name : null,
      blockedObstacleTerrain: (ahead1 && !ahead1.isPassable) ? ahead1.terrain : null,
      useAheadPortal: false,
      useLegacySvg: false,
      ...framing,
      ...continuityMeta
    };
  }

  if (ahead1 && !ahead1.isPassable) {
    const framing = buildAtmosphereAndFraming(aheadVariant, current, ahead1, left1, right1, facing, seed);
    return {
      mode: 'B',
      modeLabel: 'Directional Scene (B)',
      sceneRole: 'DIRECTIONAL_BARRIER_AHEAD',
      variantKey: aheadVariant.variantKey,
      imageUrl: aheadVariant.imageUrl,
      viewTitle: `Blocked ${facing}: ${ahead1.name}`,
      viewSubtitle: ahead1.description || aheadVariant.subtitle,
      viewBadge: `⛔ Blocked (${facing}): ${ahead1.name}`,
      variantIndex: aheadVariant.variantIndex,
      poolSize: aheadVariant.poolSize,
      matchSource: aheadVariant.matchSource,
      cameraType: aheadVariant.cameraType || 'POV',
      environmentScope: aheadVariant.environmentScope || 'OUTDOOR',
      viewCategory: aheadVariant.viewCategory || 'BARRIER',
      directionality: aheadVariant.directionality || 'DIRECTIONAL',
      isBlockedAhead: true,
      blockedObstacleName: ahead1.name,
      blockedObstacleTerrain: ahead1.terrain,
      useAheadPortal: false,
      useLegacySvg: false,
      ...framing,
      ...continuityMeta
    };
  }

  const targetVariant = aheadVariant || currentVariant;
  const framing = buildAtmosphereAndFraming(targetVariant, current, ahead1, left1, right1, facing, seed);

  return {
    mode: 'B',
    modeLabel: 'Directional Scene (B)',
    sceneRole: 'DIRECTIONAL_VISTA_AHEAD',
    variantKey: targetVariant.variantKey,
    imageUrl: targetVariant.imageUrl,
    viewTitle: `${ahead1 ? ahead1.name : current.name} (${targetVariant.title})`,
    viewSubtitle: `Looking ${facing} from ${current.name} toward ${ahead1 ? ahead1.name : 'the horizon'}`,
    viewBadge: `👁️ Ahead (${facing}): ${ahead1 ? ahead1.name : current.name}`,
    variantIndex: targetVariant.variantIndex,
    poolSize: targetVariant.poolSize,
    matchSource: targetVariant.matchSource,
    cameraType: targetVariant.cameraType || 'POV',
    environmentScope: targetVariant.environmentScope || 'OUTDOOR',
    viewCategory: targetVariant.viewCategory || 'GENERIC_TERRAIN',
    directionality: targetVariant.directionality || 'OMNIDIRECTIONAL',
    isBlockedAhead: false,
    blockedObstacleName: null,
    blockedObstacleTerrain: null,
    useAheadPortal: false,
    useLegacySvg: false,
    ...framing,
    ...continuityMeta
  };
}

function computeFlankHints(left1, right1) {
  const flankLeftHint = left1 && !left1.isPassable
    ? (left1.terrain === 'RIVER_LAKE' || left1.terrain === 'OCEAN' ? 'water-edge' : 'rock-shadow')
    : 'open';
  const flankRightHint = right1 && !right1.isPassable
    ? (right1.terrain === 'RIVER_LAKE' || right1.terrain === 'OCEAN' ? 'water-edge' : 'rock-shadow')
    : 'open';
  return { flankLeftHint, flankRightHint };
}

function inferWeatherEffect(atmosphereProfile) {
  const profile = String(atmosphereProfile || '');
  if (profile === 'bridge' || profile === 'water-barrier' || profile === 'ruins-exterior') {
    return 'drizzle-mist';
  }
  if (profile.startsWith('forest') || profile === 'ancient-oak' || profile.startsWith('swamp')) {
    return 'forest-motes';
  }
  if (profile === 'sanctuary' || profile === 'gatehouse') {
    return 'hearth-embers';
  }
  return 'none';
}

/**
 * MODE C — First-Person Perspective Mode with 5-Tier POV-First Selection Hierarchy
 *
 * Strictly selects an eye-level (mannhæð) first-person view and NEVER falls back to an exterior
 * aerial/hilltop overview (`camera_type === 'OVERVIEW'`) or a landmark-locked center painting
 * (`has_directional_landmark === 1`) when facing another direction:
 *
 *  Tier 1 (`EXACT_POV`): Dedicated POV painting for `(x, y, facing)` in `lab_perspective_views`.
 *  Tier 2 (`LANDMARK_DIRECTIONAL_POV`): Compatible POV painting for the current landmark & direction.
 *  Tier 3 (`SUBBIOME_CONTEXT_POV`): Compatible POV painting for the sub-biome & surrounding context.
 *  Tier 4 (`GENERIC_TERRAIN_POV`): Landmark-free eye-level POV painting (`camera_type='POV'`, `safe_for_pov_fallback=1`).
 *  Tier 5 (`SAFE_NEUTRAL_POV`): Safe eye-level neutral POV that never gives false landmark cues.
 *
 * Combat Stage Stabilization:
 *  When `inActiveCombat` is true on a Bridge tile (`BRIDGE` / `ANCIENT_BRIDGE`), even if the hero turns
 *  North/South toward the river parapet, the combat stage remains anchored to the eye-level stone bridge
 *  roadway (`fp_bridge_8_7_east` / `fp_bridge_8_7_west`) so monsters always stand on the solid bridge deck
 *  and never float on top of the river water.
 */
function resolveSceneModeCCore(db, current, ahead1, left1, right1, facing, seed, inActiveCombat = false) {
  const { flankLeftHint, flankRightHint } = computeFlankHints(left1, right1);
  const isBlocked = Boolean(ahead1 && !ahead1.isPassable);
  const aheadName = ahead1 ? ahead1.name : 'the horizon';

  // Combat Stage Stabilization for Bridge tiles:
  // If combat is active on The Old Stone Bridge (or any BRIDGE tile) while facing NORTH/SOUTH (parapet over water),
  // keep the combat background anchored on the bridge roadway deck so monsters never stand on river water.
  const isBridgeTile = current && (current.terrain === 'BRIDGE' || current.feature === 'ANCIENT_BRIDGE');
  if (inActiveCombat && isBridgeTile && (facing === 'NORTH' || facing === 'SOUTH')) {
    const stabilizedFacing = facing === 'NORTH' ? 'EAST' : 'WEST';
    const bridgeDeckRow = db.prepare(`
      SELECT * FROM lab_perspective_views
      WHERE tile_x = ? AND tile_y = ? AND facing = ? AND is_active = 1
      LIMIT 1
    `).get(current.x, current.y, stabilizedFacing) || db.prepare(`
      SELECT * FROM lab_perspective_views
      WHERE view_key = 'fp_bridge_8_7_east' AND is_active = 1
      LIMIT 1
    `).get();

    if (bridgeDeckRow) {
      return {
        mode: 'C',
        modeLabel: 'First-Person (C)',
        sceneRole: 'FIRST_PERSON_COMBAT_STABILIZED_BRIDGE',
        perspectiveStatus: 'DEDICATED_FIRST_PERSON',
        isDedicatedFirstPerson: true,
        combatStageStabilized: true,
        povTier: POV_TIERS.EXACT_POV.tier,
        povTierKey: POV_TIERS.EXACT_POV.key,
        povTierLabel: `${POV_TIERS.EXACT_POV.label} (Combat Deck Lock)`,
        variantKey: bridgeDeckRow.view_key,
        imageUrl: bridgeDeckRow.image_path,
        viewTitle: `Combat on ${current.name} — Bridge Deck (${facing})`,
        viewSubtitle: `Fighting on the stone bridge roadway between the parapets (river flanks blocked ${facing})`,
        landmarksVisible: bridgeDeckRow.landmarks_visible || null,
        viewBadge: `⚔️ 1st-Person Combat on ${current.name} (${facing})`,
        variantIndex: 0,
        poolSize: 1,
        matchSource: 'PERSPECTIVE_VIEW',
        cameraType: 'POV',
        environmentScope: 'OUTDOOR',
        viewCategory: 'LANDMARK',
        directionality: 'DIRECTIONAL',
        isBlockedAhead: isBlocked,
        blockedObstacleName: isBlocked ? ahead1.name : null,
        blockedObstacleTerrain: isBlocked ? ahead1.terrain : null,
        useAheadPortal: false,
        useLegacySvg: false,
        focalX: Number(bridgeDeckRow.focal_x || 50),
        focalY: Number(bridgeDeckRow.focal_y || 62),
        panX: 0,
        panY: 0,
        lightingTint: bridgeDeckRow.lighting_tint || 'rgba(110, 145, 185, 0.08)',
        mistStyle: bridgeDeckRow.mist_style || 'river-mist',
        atmosphereProfile: bridgeDeckRow.atmosphere_profile || 'bridge',
        horizonGlow: bridgeDeckRow.horizon_glow || 'cold-water',
        flankLeftHint,
        flankRightHint,
        weatherEffect: 'drizzle-mist',
        stageAnchor: computeSceneStageAnchor(
          bridgeDeckRow.view_key,
          current.terrain,
          bridgeDeckRow.atmosphere_profile || 'bridge',
          isBlocked
        )
      };
    }
  }

  // =========================================================================
  // TIER 1: Dedicated Exact POV for (x, y, facing) in `lab_perspective_views`
  // =========================================================================
  const fpRow = db.prepare(`
    SELECT * FROM lab_perspective_views
    WHERE tile_x = ? AND tile_y = ? AND facing = ? AND is_active = 1
    LIMIT 1
  `).get(current.x, current.y, facing);

  if (fpRow) {
    return {
      mode: 'C',
      modeLabel: 'First-Person (C)',
      sceneRole: 'FIRST_PERSON_DEDICATED',
      perspectiveStatus: 'DEDICATED_FIRST_PERSON',
      isDedicatedFirstPerson: true,
      combatStageStabilized: false,
      povTier: POV_TIERS.EXACT_POV.tier,
      povTierKey: POV_TIERS.EXACT_POV.key,
      povTierLabel: POV_TIERS.EXACT_POV.label,
      variantKey: fpRow.view_key,
      imageUrl: fpRow.image_path,
      viewTitle: fpRow.view_title,
      viewSubtitle: fpRow.view_subtitle,
      landmarksVisible: fpRow.landmarks_visible || null,
      viewBadge: inActiveCombat
        ? `⚔️ 1st-Person Combat at ${current.name} (${facing})`
        : `👁️ 1st-Person POV (${facing}): Toward ${aheadName}`,
      variantIndex: 0,
      poolSize: 1,
      matchSource: 'PERSPECTIVE_VIEW',
      cameraType: 'POV',
      environmentScope: 'OUTDOOR',
      viewCategory: 'LANDMARK',
      directionality: 'DIRECTIONAL',
      isBlockedAhead: isBlocked,
      blockedObstacleName: isBlocked ? ahead1.name : null,
      blockedObstacleTerrain: isBlocked ? ahead1.terrain : null,
      useAheadPortal: false,
      useLegacySvg: false,
      focalX: Number(fpRow.focal_x || 50),
      focalY: Number(fpRow.focal_y || 62),
      panX: 0,
      panY: 0,
      lightingTint: fpRow.lighting_tint || 'rgba(14, 18, 26, 0.08)',
      mistStyle: fpRow.mist_style || 'forest-mist',
      atmosphereProfile: fpRow.atmosphere_profile || 'wilderness',
      horizonGlow: fpRow.horizon_glow || 'none',
      flankLeftHint,
      flankRightHint,
      weatherEffect: inferWeatherEffect(fpRow.atmosphere_profile),
      stageAnchor: computeSceneStageAnchor(
        fpRow.view_key,
        current.terrain,
        fpRow.atmosphere_profile,
        isBlocked
      )
    };
  }

  // =========================================================================
  // TIER 2 & TIER 3: Landmark Directional POV (Tier 2) & Sub-Biome Context POV (Tier 3)
  // =========================================================================
  const aheadPassableInt = ahead1 ? (ahead1.isPassable ? 1 : 0) : 0;
  const aheadTerrain = ahead1 ? (ahead1.terrain || '') : '';

  for (const tierNum of [2, 3]) {
    const candidateRules = db.prepare(`
      SELECT * FROM lab_pov_context_rules
      WHERE is_active = 1
        AND pov_tier = ?
        AND (from_terrain IS NULL OR from_terrain = ?)
        AND (from_feature IS NULL OR from_feature = ?)
        AND (to_terrain IS NULL OR to_terrain = ?)
        AND (to_passable IS NULL OR to_passable = ?)
        AND (facing IS NULL OR facing = ?)
      ORDER BY priority DESC, id ASC
    `).all(
      tierNum,
      current.terrain || '',
      current.feature || '',
      aheadTerrain,
      aheadPassableInt,
      facing
    );
    const contextRule = candidateRules.find(rule => {
      if (rule.rule_key === 'pov_forest_track_east') {
        return Number(current.x) === 7 && Number(current.y) === 5;
      }
      if (rule.rule_key === 'pov_forest_facing_crag_wall') {
        return Boolean(ahead1 && Number(ahead1.x) === 6 && Number(ahead1.y) === 5);
      }
      return true;
    }) || null;

    if (contextRule) {
      const tierMeta = tierNum === 2 ? POV_TIERS.LANDMARK_DIRECTIONAL_POV : POV_TIERS.SUBBIOME_CONTEXT_POV;
      const isDedicatedPerspectiveAsset = String(contextRule.image_path || '').includes('/images/perspective/');
      const viewTitle = `${current.name} — Facing ${facing} (${isBlocked ? `Blocked: ${aheadName}` : `Toward ${aheadName}`})`;
      const viewBadge = inActiveCombat
        ? `⚔️ 1st-Person Combat at ${current.name} (${facing})`
        : isBlocked
          ? `👁️ POV ${tierMeta.key === 'LANDMARK_DIRECTIONAL_POV' ? 'Landmark' : 'Context'} (${facing}) • ⛔ ${aheadName}`
          : `👁️ POV ${tierMeta.key === 'LANDMARK_DIRECTIONAL_POV' ? 'Landmark' : 'Context'} (${facing}): Toward ${aheadName}`;

      return {
        mode: 'C',
        modeLabel: 'First-Person (C)',
        sceneRole: tierNum === 2 ? 'FIRST_PERSON_LANDMARK_DIRECTIONAL' : 'FIRST_PERSON_SUBBIOME_CONTEXT',
        perspectiveStatus: tierNum === 2 ? 'POV_LANDMARK_DIRECTIONAL' : 'POV_SUBBIOME_CONTEXT',
        isDedicatedFirstPerson: isDedicatedPerspectiveAsset,
        combatStageStabilized: false,
        povTier: tierMeta.tier,
        povTierKey: tierMeta.key,
        povTierLabel: tierMeta.label,
        variantKey: contextRule.rule_key,
        imageUrl: contextRule.image_path,
        viewTitle: contextRule. rule_key.startsWith('pov_bridge_parapet_') ? contextRule.view_title : viewTitle,
        viewSubtitle: contextRule.view_subtitle,
        landmarksVisible: contextRule.landmarks_visible || null,
        viewBadge,
        variantIndex: 0,
        poolSize: 1,
        matchSource: tierMeta.key,
        cameraType: contextRule.camera_type || 'POV',
        environmentScope: contextRule.environment_scope || 'OUTDOOR',
        viewCategory: contextRule.view_category || 'SUBBIOME',
        directionality: contextRule.directionality || 'DIRECTIONAL',
        isBlockedAhead: isBlocked,
        blockedObstacleName: isBlocked ? ahead1.name : null,
        blockedObstacleTerrain: isBlocked ? ahead1.terrain : null,
        useAheadPortal: false,
        useLegacySvg: false,
        focalX: 50,
        focalY: isDedicatedPerspectiveAsset ? 64 : 56,
        panX: 0,
        panY: 0,
        lightingTint: contextRule.lighting_tint || 'rgba(14, 18, 26, 0.08)',
        mistStyle: contextRule.mist_style || 'forest-mist',
        atmosphereProfile: contextRule.atmosphere_profile || 'wilderness',
        horizonGlow: contextRule.horizon_glow || 'none',
        flankLeftHint,
        flankRightHint,
        weatherEffect: inferWeatherEffect(contextRule.atmosphere_profile),
        stageAnchor: computeSceneStageAnchor(
          contextRule.rule_key,
          current.terrain,
          contextRule.atmosphere_profile,
          isBlocked
        )
      };
    }
  }

  // =========================================================================
  // TIER 4: Generic Eye-Level Terrain POV (`camera_type='POV'`, `has_directional_landmark=0`, `safe_for_pov_fallback=1`)
  // =========================================================================
  const povPool = db.prepare(`
    SELECT * FROM lab_scene_variants
    WHERE terrain_type = ?
      AND camera_type = 'POV'
      AND has_directional_landmark = 0
      AND safe_for_pov_fallback = 1
      AND is_active = 1
    ORDER BY variant_index ASC, id ASC
  `).all(current.terrain || '');

  if (povPool && povPool.length > 0) {
    const chosenIdx = computeDeterministicVariantIndex(
      Number(current.x || 0),
      Number(current.y || 0),
      povPool.length,
      facing
    );
    let chosenRow = povPool[chosenIdx] || povPool[0];
    if (povPool.length > 1) {
      const adjacentContextImages = new Set();
      const sameTileFpRows = db.prepare(`
        SELECT image_path FROM lab_perspective_views
        WHERE tile_x = ? AND tile_y = ? AND facing != ? AND is_active = 1
      `).all(Number(current.x || 0), Number(current.y || 0), facing);
      for (const r of sameTileFpRows) {
        if (r && r.image_path) adjacentContextImages.add(r.image_path);
      }
      for (const adjTile of [left1, right1]) {
        if (!adjTile) continue;
        const adjPassable = adjTile.isPassable ? 1 : 0;
        const adjRules = db.prepare(`
          SELECT rule_key, image_path FROM lab_pov_context_rules
          WHERE is_active = 1
            AND (from_terrain IS NULL OR from_terrain = ?)
            AND (from_feature IS NULL OR from_feature = ?)
            AND (to_terrain IS NULL OR to_terrain = ?)
            AND (to_passable IS NULL OR to_passable = ?)
          ORDER BY pov_tier ASC, priority DESC, id ASC
        `).all(
          current.terrain || '',
          current.feature || '',
          adjTile.terrain || '',
          adjPassable
        );
        const matchedAdj = adjRules.find(r => {
          if (r.rule_key === 'pov_forest_track_east') {
            return Number(current.x) === 7 && Number(current.y) === 5;
          }
          if (r.rule_key === 'pov_forest_facing_crag_wall') {
            return Number(adjTile.x) === 6 && Number(adjTile.y) === 5;
          }
          return true;
        });
        if (matchedAdj && matchedAdj.image_path) {
          adjacentContextImages.add(matchedAdj.image_path);
        }
      }
      if (adjacentContextImages.has(chosenRow.image_path)) {
        const adjFacings = {
          NORTH: ['WEST', 'EAST'],
          EAST: ['NORTH', 'SOUTH'],
          SOUTH: ['EAST', 'WEST'],
          WEST: ['SOUTH', 'NORTH']
        }[facing] || [];
        const adjacentTier4Images = new Set();
        const adjTiles = [left1, right1];
        for (let i = 0; i < adjFacings.length; i++) {
          const adjF = adjFacings[i];
          const adjIdx = computeDeterministicVariantIndex(
            Number(current.x || 0),
            Number(current.y || 0),
            povPool.length,
            adjF
          );
          if (povPool[adjIdx] && povPool[adjIdx].image_path) {
            adjacentTier4Images.add(povPool[adjIdx].image_path);
          }
        }
        let bestAlt = null;
        for (let offset = 1; offset < povPool.length; offset++) {
          const altRow = povPool[(chosenIdx + offset) % povPool.length];
          if (altRow && !adjacentContextImages.has(altRow.image_path) && !adjacentTier4Images.has(altRow.image_path)) {
            bestAlt = altRow;
            break;
          }
        }
        if (!bestAlt) {
          for (let offset = 1; offset < povPool.length; offset++) {
            const altRow = povPool[(chosenIdx + offset) % povPool.length];
            if (altRow && !adjacentContextImages.has(altRow.image_path)) {
              bestAlt = altRow;
              break;
            }
          }
        }
        if (bestAlt) {
          chosenRow = bestAlt;
        }
      }
    }
    const genericPov = formatVariantRow(chosenRow, 'GENERIC_TERRAIN_POV', povPool.length);

    return {
      mode: 'C',
      modeLabel: 'First-Person (C)',
      sceneRole: 'FIRST_PERSON_GENERIC_TERRAIN_POV',
      perspectiveStatus: 'POV_GENERIC_TERRAIN',
      isDedicatedFirstPerson: false,
      combatStageStabilized: false,
      povTier: POV_TIERS.GENERIC_TERRAIN_POV.tier,
      povTierKey: POV_TIERS.GENERIC_TERRAIN_POV.key,
      povTierLabel: POV_TIERS.GENERIC_TERRAIN_POV.label,
      variantKey: genericPov.variantKey,
      imageUrl: genericPov.imageUrl,
      viewTitle: `${current.name} — Facing ${facing} (${isBlocked ? `Blocked: ${aheadName}` : `Toward ${aheadName}`})`,
      viewSubtitle: `${genericPov.subtitle} • Eye-level ${current.terrain} POV looking ${facing}`,
      landmarksVisible: null,
      viewBadge: isBlocked
        ? `🧭 Eye-Level POV (${facing}) • ⛔ Blocked: ${aheadName}`
        : `🧭 Eye-Level POV (${facing}): Toward ${aheadName}`,
      variantIndex: genericPov.variantIndex,
      poolSize: genericPov.poolSize,
      matchSource: 'GENERIC_TERRAIN_POV',
      cameraType: 'POV',
      environmentScope: genericPov.environmentScope,
      viewCategory: genericPov.viewCategory,
      directionality: genericPov.directionality,
      isBlockedAhead: isBlocked,
      blockedObstacleName: isBlocked ? ahead1.name : null,
      blockedObstacleTerrain: isBlocked ? ahead1.terrain : null,
      useAheadPortal: false,
      useLegacySvg: false,
      focalX: Number(genericPov.focalX || 50),
      focalY: Math.max(54, Number(genericPov.focalY || 56)),
      panX: 0,
      panY: 0,
      lightingTint: genericPov.lightingTint,
      mistStyle: genericPov.mistStyle,
      atmosphereProfile: genericPov.atmosphereProfile,
      horizonGlow: isBlocked ? 'dark-crag' : 'none',
      flankLeftHint,
      flankRightHint,
      weatherEffect: inferWeatherEffect(genericPov.atmosphereProfile),
      stageAnchor: computeSceneStageAnchor(
        genericPov.variantKey,
        current.terrain,
        genericPov.atmosphereProfile,
        isBlocked
      )
    };
  }

  // =========================================================================
  // TIER 5: Safe Neutral Eye-Level Fallback (`SAFE_NEUTRAL_POV`)
  // Never shows standing-stone monoliths (`terrain_fallback.webp`) or aerial overviews.
  // =========================================================================
  const neutralRow = db.prepare(`
    SELECT * FROM lab_scene_variants
    WHERE variant_key = 'plains_windswept_trail'
      AND camera_type = 'POV'
      AND safe_for_pov_fallback = 1
    LIMIT 1
  `).get();
  const safeNeutral = formatVariantRow(neutralRow, 'SAFE_NEUTRAL_POV', 1);

  return {
    mode: 'C',
    modeLabel: 'First-Person (C)',
    sceneRole: 'FIRST_PERSON_SAFE_NEUTRAL_FALLBACK',
    perspectiveStatus: 'POV_SAFE_NEUTRAL',
    isDedicatedFirstPerson: false,
    combatStageStabilized: false,
    povTier: POV_TIERS.SAFE_NEUTRAL_POV.tier,
    povTierKey: POV_TIERS.SAFE_NEUTRAL_POV.key,
    povTierLabel: POV_TIERS.SAFE_NEUTRAL_POV.label,
    variantKey: safeNeutral.variantKey,
    imageUrl: safeNeutral.imageUrl,
    viewTitle: `${current.name} — Facing ${facing} (Neutral Eye-Level POV)`,
    viewSubtitle: `Safe eye-level wilderness POV at ${current.name} looking ${facing} toward ${aheadName}`,
    landmarksVisible: null,
    viewBadge: `🧭 Safe POV (${facing}): Toward ${aheadName}`,
    variantIndex: 0,
    poolSize: 1,
    matchSource: 'SAFE_NEUTRAL_POV',
    cameraType: 'POV',
    environmentScope: 'OUTDOOR',
    viewCategory: 'GENERIC_TERRAIN',
    directionality: 'OMNIDIRECTIONAL',
    isBlockedAhead: isBlocked,
    blockedObstacleName: isBlocked ? ahead1.name : null,
    blockedObstacleTerrain: isBlocked ? ahead1.terrain : null,
    useAheadPortal: false,
    useLegacySvg: false,
    focalX: 50,
    focalY: 54,
    panX: 0,
    panY: 0,
    lightingTint: safeNeutral.lightingTint,
    mistStyle: safeNeutral.mistStyle,
    atmosphereProfile: safeNeutral.atmosphereProfile,
    horizonGlow: 'none',
    flankLeftHint,
    flankRightHint,
    weatherEffect: 'none',
    stageAnchor: computeSceneStageAnchor(
      safeNeutral.variantKey,
      current.terrain,
      safeNeutral.atmosphereProfile,
      isBlocked
    )
  };
}

function resolveSceneModeC(db, current, ahead1, left1, right1, facing, seed, inActiveCombat = false, behindOverride = null, options = {}) {
  const baseScene = resolveSceneModeCCore(db, current, ahead1, left1, right1, facing, seed, inActiveCombat);
  const continuityMeta = buildSceneContinuityMetadata(db, current, ahead1, left1, right1, facing, behindOverride);
  const useCandidateArt = Boolean(options && options.useCandidateArt !== undefined ? options.useCandidateArt : candidateArtPreviewMode);
  const stagedCandidate = resolveStagedCandidateForScene(baseScene, current, facing);

  let resolvedImageUrl = baseScene.imageUrl;
  let resolvedVariantKey = baseScene.variantKey;
  let artApprovalStatus = 'APPROVED';

  if (useCandidateArt) {
    if (baseScene.povTier === 4 && current && CANDIDATE_TIER4_POOLS[current.terrain]) {
      const pool = CANDIDATE_TIER4_POOLS[current.terrain];
      const idx = computeDeterministicVariantIndex(
        Number(current.x || 0),
        Number(current.y || 0),
        pool.length,
        facing
      );
      const sameTileFpRows = db.prepare(`
        SELECT facing, image_path FROM lab_perspective_views
        WHERE tile_x = ? AND tile_y = ? AND facing != ? AND is_active = 1
      `).all(Number(current.x || 0), Number(current.y || 0), facing);
      const sameTileFp = new Set(sameTileFpRows.map(r => r.image_path));
      const nonTier4Facings = new Set(sameTileFpRows.map(r => r.facing));
      const otherNeighbors = [
        { tile: left1, dir: { NORTH: 'WEST', EAST: 'NORTH', SOUTH: 'EAST', WEST: 'SOUTH' }[facing] },
        { tile: right1, dir: { NORTH: 'EAST', EAST: 'SOUTH', SOUTH: 'WEST', WEST: 'NORTH' }[facing] },
        { tile: behindOverride, dir: { NORTH: 'SOUTH', EAST: 'WEST', SOUTH: 'NORTH', WEST: 'EAST' }[facing] }
      ];
      for (const item of otherNeighbors) {
        if (!item.tile || !item.dir || nonTier4Facings.has(item.dir)) continue;
        const adjPassable = item.tile.isPassable ? 1 : 0;
        const adjRules = db.prepare(`
          SELECT rule_key, image_path FROM lab_pov_context_rules
          WHERE is_active = 1
            AND (from_terrain IS NULL OR from_terrain = ?)
            AND (from_feature IS NULL OR from_feature = ?)
            AND (to_terrain IS NULL OR to_terrain = ?)
            AND (to_passable IS NULL OR to_passable = ?)
          ORDER BY pov_tier ASC, priority DESC, id ASC
        `).all(
          current.terrain || '',
          current.feature || '',
          item.tile.terrain || '',
          adjPassable
        );
        const matchedAdj = adjRules.find(r => {
          if (r.rule_key === 'pov_forest_track_east') {
            return Number(current.x) === 7 && Number(current.y) === 5;
          }
          if (r.rule_key === 'pov_forest_facing_crag_wall') {
            return Number(item.tile.x) === 6 && Number(item.tile.y) === 5;
          }
          return true;
        });
        if (matchedAdj && matchedAdj.image_path) {
          nonTier4Facings.add(item.dir);
          const cand = CANDIDATE_BY_SLOT_KEY.get(matchedAdj.rule_key);
          sameTileFp.add(cand ? cand.candidateUrl : matchedAdj.image_path);
        }
      }
      const otherTier4Imgs = new Set();
      for (const otherF of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        if (otherF === facing || nonTier4Facings.has(otherF)) continue;
        const oIdx = computeDeterministicVariantIndex(Number(current.x || 0), Number(current.y || 0), pool.length, otherF);
        if (pool[oIdx]) otherTier4Imgs.add(pool[oIdx].imageUrl);
      }
      let chosen = pool[idx] || pool[0];
      if (chosen && sameTileFp.has(chosen.imageUrl)) {
        for (let offset = 1; offset < pool.length; offset++) {
          const alt = pool[(idx + offset) % pool.length];
          if (alt && !sameTileFp.has(alt.imageUrl) && !otherTier4Imgs.has(alt.imageUrl)) {
            chosen = alt;
            break;
          }
        }
        if (sameTileFp.has(chosen.imageUrl)) {
          for (let offset = 1; offset < pool.length; offset++) {
            const alt = pool[(idx + offset) % pool.length];
            if (alt && !sameTileFp.has(alt.imageUrl)) {
              chosen = alt;
              break;
            }
          }
        }
      }
      if (chosen) {
        resolvedImageUrl = chosen.imageUrl;
        resolvedVariantKey = chosen.variantKey;
        artApprovalStatus = chosen.status || 'APPROVED';
      }
    } else if (stagedCandidate) {
      resolvedImageUrl = stagedCandidate.candidateUrl;
      resolvedVariantKey = stagedCandidate.candidateKey;
      artApprovalStatus = 'REVIEW REQUIRED';
    }
  }

  const finalScene = {
    ...baseScene,
    ...continuityMeta,
    variantKey: resolvedVariantKey,
    imageUrl: resolvedImageUrl,
    approvedImageUrl: baseScene.imageUrl,
    artApprovalStatus,
    candidatePreview: stagedCandidate ? {
      id: stagedCandidate.id,
      candidateKey: stagedCandidate.candidateKey,
      fileName: stagedCandidate.fileName,
      candidateUrl: stagedCandidate.candidateUrl,
      status: stagedCandidate.status,
      category: stagedCandidate.category,
      purpose: stagedCandidate.purpose
    } : null
  };

  if (!isBuildingAtlas && current && typeof current.x === 'number' && typeof current.y === 'number') {
    latestLiveViewportContext = {
      db,
      current,
      ahead1,
      left1,
      right1,
      behind1: continuityMeta.compassContext ? continuityMeta.compassContext.behind : null,
      facing,
      inActiveCombat: Boolean(inActiveCombat),
      scene: finalScene
    };
  }

  return finalScene;
}

/**
 * MODE LEGACY — Preserves the original multi-plane blended portal + geometric SVG overlay
 */
function resolveSceneModeLegacy(current, ahead1, facing, isTerrainTransitionAhead, isAheadBlocked) {
  return {
    mode: 'LEGACY',
    modeLabel: 'Legacy Blended + SVG',
    sceneRole: 'LEGACY_MULTI_PLANE',
    variantKey: 'legacy_blended',
    imageUrl: current.legacyImageUrl || current.imageUrl,
    aheadImageUrl: ahead1 ? (ahead1.legacyImageUrl || ahead1.imageUrl) : null,
    viewTitle: `${current.name} (Legacy Multi-Plane)`,
    viewSubtitle: 'Original prototype: radial portal blend + procedural SVG road/props/obstacles',
    viewBadge: `Legacy View (${facing})`,
    isBlockedAhead: Boolean(isAheadBlocked),
    blockedObstacleName: (ahead1 && !ahead1.isPassable) ? ahead1.name : null,
    blockedObstacleTerrain: (ahead1 && !ahead1.isPassable) ? ahead1.terrain : null,
    useAheadPortal: Boolean(isTerrainTransitionAhead || isAheadBlocked || (ahead1 && (ahead1.terrain === 'CITY' || ahead1.terrain === 'TOWN'))),
    useLegacySvg: true
  };
}

/**
 * PHASE 3 — Data-Driven Atmospheric Effect Profiles (`ATMOSPHERE_EFFECT_PROFILES`)
 * Controls subtle, scalable living environment effects per biome/profile with location overrides.
 */
const ATMOSPHERE_EFFECT_PROFILES = {
  'sanctuary': {
    profileKey: 'sanctuary',
    label: 'Sanctuary Torchlight & Hearth Smoke',
    effectType: 'city-torch',
    enabled: true,
    mistOpacity: 0.14,
    mistSpeedSec: 26,
    mistTint: 'rgba(235, 180, 95, 0.16)',
    lightPulseType: 'torch-flicker',
    lightPulseColor: 'rgba(245, 158, 11, 0.14)',
    lightPulseSpeedSec: 4.2,
    particleType: 'embers',
    particleCountSubtle: 9,
    particleCountFull: 20,
    particleSpeed: 0.32,
    particleDriftX: 0.12,
    particleDirection: 'up',
    particleColor: 'rgba(251, 191, 36, 0.65)',
    particleSecondaryColor: 'rgba(226, 232, 240, 0.28)',
    depthLayers: 2
  },
  'gatehouse': {
    profileKey: 'gatehouse',
    label: 'Gatehouse Braziers & Perimeter Mist',
    effectType: 'gate-torch-mist',
    enabled: true,
    mistOpacity: 0.18,
    mistSpeedSec: 22,
    mistTint: 'rgba(215, 165, 90, 0.15)',
    lightPulseType: 'torch-flicker',
    lightPulseColor: 'rgba(245, 158, 11, 0.12)',
    lightPulseSpeedSec: 4.5,
    particleType: 'embers',
    particleCountSubtle: 8,
    particleCountFull: 18,
    particleSpeed: 0.30,
    particleDriftX: 0.15,
    particleDirection: 'up',
    particleColor: 'rgba(251, 191, 36, 0.58)',
    particleSecondaryColor: 'rgba(186, 200, 214, 0.32)',
    depthLayers: 2
  },
  'bridge': {
    profileKey: 'bridge',
    label: 'River Gorge Mist & Cold Breeze',
    effectType: 'river-bridge',
    enabled: true,
    mistOpacity: 0.24,
    mistSpeedSec: 18,
    mistTint: 'rgba(125, 175, 215, 0.18)',
    lightPulseType: 'water-shimmer',
    lightPulseColor: 'rgba(96, 165, 250, 0.09)',
    lightPulseSpeedSec: 7.5,
    particleType: 'water-mist',
    particleCountSubtle: 10,
    particleCountFull: 22,
    particleSpeed: 0.42,
    particleDriftX: 0.48,
    particleDirection: 'drift',
    particleColor: 'rgba(186, 230, 253, 0.48)',
    particleSecondaryColor: 'rgba(148, 163, 184, 0.35)',
    depthLayers: 2
  },
  'water-barrier': {
    profileKey: 'water-barrier',
    label: 'Churning Water Spray & Cold Haze',
    effectType: 'river-bridge',
    enabled: true,
    mistOpacity: 0.26,
    mistSpeedSec: 15,
    mistTint: 'rgba(110, 168, 210, 0.20)',
    lightPulseType: 'water-shimmer',
    lightPulseColor: 'rgba(56, 189, 248, 0.10)',
    lightPulseSpeedSec: 6.5,
    particleType: 'water-mist',
    particleCountSubtle: 12,
    particleCountFull: 24,
    particleSpeed: 0.48,
    particleDriftX: 0.55,
    particleDirection: 'drift',
    particleColor: 'rgba(186, 230, 253, 0.52)',
    particleSecondaryColor: 'rgba(224, 242, 254, 0.38)',
    depthLayers: 2
  },
  'forest-deep': {
    profileKey: 'forest-deep',
    label: 'Deep Forest Mist & Woodland Spores',
    effectType: 'forest-canopy',
    enabled: true,
    mistOpacity: 0.21,
    mistSpeedSec: 28,
    mistTint: 'rgba(120, 165, 132, 0.16)',
    lightPulseType: 'canopy-dapple',
    lightPulseColor: 'rgba(134, 239, 172, 0.07)',
    lightPulseSpeedSec: 9.0,
    particleType: 'spores',
    particleCountSubtle: 10,
    particleCountFull: 22,
    particleSpeed: 0.18,
    particleDriftX: 0.16,
    particleDirection: 'float',
    particleColor: 'rgba(187, 247, 208, 0.48)',
    particleSecondaryColor: 'rgba(217, 249, 157, 0.36)',
    depthLayers: 2
  },
  'ancient-oak': {
    profileKey: 'ancient-oak',
    label: 'Primeval Root Mist & Amber Sap Motes',
    effectType: 'forest-canopy',
    enabled: true,
    mistOpacity: 0.24,
    mistSpeedSec: 26,
    mistTint: 'rgba(165, 150, 98, 0.17)',
    lightPulseType: 'canopy-dapple',
    lightPulseColor: 'rgba(245, 158, 11, 0.11)',
    lightPulseSpeedSec: 7.0,
    particleType: 'spores',
    particleCountSubtle: 12,
    particleCountFull: 26,
    particleSpeed: 0.20,
    particleDriftX: 0.14,
    particleDirection: 'float',
    particleColor: 'rgba(251, 191, 36, 0.58)',
    particleSecondaryColor: 'rgba(187, 247, 208, 0.42)',
    depthLayers: 3
  },
  'swamp-mire': {
    profileKey: 'swamp-mire',
    label: 'Creeping Bog Fog & Marsh Wisps',
    effectType: 'swamp-miasma',
    enabled: true,
    mistOpacity: 0.27,
    mistSpeedSec: 24,
    mistTint: 'rgba(115, 152, 98, 0.20)',
    lightPulseType: 'mire-gloom',
    lightPulseColor: 'rgba(163, 230, 53, 0.08)',
    lightPulseSpeedSec: 8.5,
    particleType: 'marsh-spores',
    particleCountSubtle: 11,
    particleCountFull: 24,
    particleSpeed: 0.16,
    particleDriftX: 0.12,
    particleDirection: 'up',
    particleColor: 'rgba(190, 242, 100, 0.50)',
    particleSecondaryColor: 'rgba(134, 239, 172, 0.36)',
    depthLayers: 2
  },
  'jungle': {
    profileKey: 'jungle',
    label: 'Humid Jungle Haze & Bioluminescent Spores',
    effectType: 'swamp-miasma',
    enabled: true,
    mistOpacity: 0.23,
    mistSpeedSec: 25,
    mistTint: 'rgba(86, 145, 96, 0.18)',
    lightPulseType: 'mire-gloom',
    lightPulseColor: 'rgba(74, 222, 128, 0.08)',
    lightPulseSpeedSec: 8.0,
    particleType: 'marsh-spores',
    particleCountSubtle: 12,
    particleCountFull: 25,
    particleSpeed: 0.19,
    particleDriftX: 0.14,
    particleDirection: 'float',
    particleColor: 'rgba(163, 230, 53, 0.52)',
    particleSecondaryColor: 'rgba(253, 224, 71, 0.38)',
    depthLayers: 2
  },
  'hills-crag': {
    profileKey: 'hills-crag',
    label: 'Wind-Driven Highland Mist & Slate Dust',
    effectType: 'mountain-wind',
    enabled: true,
    mistOpacity: 0.22,
    mistSpeedSec: 16,
    mistTint: 'rgba(148, 163, 184, 0.17)',
    lightPulseType: 'cold-crag',
    lightPulseColor: 'rgba(148, 163, 184, 0.08)',
    lightPulseSpeedSec: 8.0,
    particleType: 'crag-dust',
    particleCountSubtle: 10,
    particleCountFull: 22,
    particleSpeed: 0.52,
    particleDriftX: 0.65,
    particleDirection: 'drift',
    particleColor: 'rgba(203, 213, 225, 0.46)',
    particleSecondaryColor: 'rgba(148, 163, 184, 0.34)',
    depthLayers: 2
  },
  'mountain-barrier': {
    profileKey: 'mountain-barrier',
    label: 'Darkmount Precipice Wind & Cold Dust',
    effectType: 'mountain-wind',
    enabled: true,
    mistOpacity: 0.25,
    mistSpeedSec: 14,
    mistTint: 'rgba(135, 150, 172, 0.19)',
    lightPulseType: 'cold-crag',
    lightPulseColor: 'rgba(148, 163, 184, 0.09)',
    lightPulseSpeedSec: 7.0,
    particleType: 'crag-dust',
    particleCountSubtle: 11,
    particleCountFull: 24,
    particleSpeed: 0.58,
    particleDriftX: 0.72,
    particleDirection: 'drift',
    particleColor: 'rgba(226, 232, 240, 0.48)',
    particleSecondaryColor: 'rgba(148, 163, 184, 0.36)',
    depthLayers: 2
  },
  'ruins-exterior': {
    profileKey: 'ruins-exterior',
    label: 'Ruined Watchpost Mist & Drifting Ash',
    effectType: 'mountain-wind',
    enabled: true,
    mistOpacity: 0.23,
    mistSpeedSec: 19,
    mistTint: 'rgba(138, 156, 184, 0.18)',
    lightPulseType: 'cold-crag',
    lightPulseColor: 'rgba(165, 180, 252, 0.08)',
    lightPulseSpeedSec: 7.8,
    particleType: 'crag-dust',
    particleCountSubtle: 10,
    particleCountFull: 22,
    particleSpeed: 0.36,
    particleDriftX: 0.42,
    particleDirection: 'drift',
    particleColor: 'rgba(203, 213, 225, 0.46)',
    particleSecondaryColor: 'rgba(186, 230, 253, 0.34)',
    depthLayers: 2
  },
  'plains-open': {
    profileKey: 'plains-open',
    label: 'Windswept Grassland Haze & Pollen',
    effectType: 'plains-breeze',
    enabled: true,
    mistOpacity: 0.15,
    mistSpeedSec: 22,
    mistTint: 'rgba(195, 185, 155, 0.14)',
    lightPulseType: 'canopy-dapple',
    lightPulseColor: 'rgba(217, 199, 150, 0.06)',
    lightPulseSpeedSec: 9.5,
    particleType: 'heath-motes',
    particleCountSubtle: 8,
    particleCountFull: 18,
    particleSpeed: 0.34,
    particleDriftX: 0.44,
    particleDirection: 'drift',
    particleColor: 'rgba(226, 212, 180, 0.44)',
    particleSecondaryColor: 'rgba(203, 213, 225, 0.30)',
    depthLayers: 1
  }
};

function resolveAtmosphereEffectProfile(atmosphereProfile, currentTile = null, aheadTile = null, facing = 'NORTH') {
  const rawKey = String(atmosphereProfile || '').toLowerCase();
  const terrain = String((currentTile && currentTile.terrain) || '').toUpperCase();
  const biomePersistence = resolveBiomePersistence(currentTile, aheadTile, null);

  let baseProfile = ATMOSPHERE_EFFECT_PROFILES['plains-open'];
  if (currentTile && currentTile.x === 4 && currentTile.y === 11) {
    baseProfile = {
      ...ATMOSPHERE_EFFECT_PROFILES['swamp-mire'],
      profileKey: 'deadmans-mire-override',
      label: 'Deadman’s Mire Ghostly Wisps & Bog Fog',
      particleColor: 'rgba(167, 243, 208, 0.60)',
      particleCountSubtle: 12,
      particleCountFull: 26
    };
  } else if (currentTile && currentTile.x === 7 && currentTile.y === 3) {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['ancient-oak'];
  } else if (ATMOSPHERE_EFFECT_PROFILES[rawKey]) {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES[rawKey];
  } else if (rawKey.startsWith('forest')) {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['forest-deep'];
  } else if (rawKey.startsWith('swamp')) {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['swamp-mire'];
  } else if (rawKey.startsWith('hills')) {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['hills-crag'];
  } else if (rawKey.startsWith('plains')) {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['plains-open'];
  } else if (rawKey.startsWith('ruins')) {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['ruins-exterior'];
  } else if (terrain === 'CITY') {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['sanctuary'];
  } else if (terrain === 'BRIDGE') {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['bridge'];
  } else if (terrain === 'FOREST') {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['forest-deep'];
  } else if (terrain === 'SWAMP') {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['swamp-mire'];
  } else if (terrain === 'JUNGLE') {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['jungle'];
  } else if (terrain === 'HILLS' || terrain === 'MOUNTAINS') {
    baseProfile = ATMOSPHERE_EFFECT_PROFILES['hills-crag'];
  }

  return {
    ...baseProfile,
    subBiomeKey: biomePersistence.subBiomeKey,
    subBiomeLabel: biomePersistence.subBiomeLabel,
    persistedBiome: biomePersistence.persistedBiome,
    approachingThreshold: biomePersistence.approachingThreshold,
    thresholdHint: biomePersistence.thresholdHint,
    facing: String(facing || 'NORTH').toUpperCase()
  };
}

/**
 * PHASE 4.3 & ADV-2.3 — Points of Interest (`POINTS_OF_INTEREST`) with Data-Driven Line-of-Sight Visibility
 * Lightweight, non-gameplay lore inspection definitions for key landmarks and barriers.
 * Supports:
 *  - `visibleFacings`: array of cardinal directions from which the POI is visually inspectable.
 *  - `inspectionMode`: 'VISUAL_OBJECT' (specific object in line of sight) or 'SURROUNDING_LANDMARK' (large architectural/environmental space).
 *  - `facingViews`: optional per-facing overrides for `title`, `shortPrompt`, and `description` so the inspection matches the camera angle.
 */
const POINTS_OF_INTEREST = [
  {
    poiKey: 'poi_oakhaven_sanctuary',
    tileX: 7,
    tileY: 7,
    facing: null,
    visibleFacings: ['NORTH', 'EAST', 'SOUTH', 'WEST'],
    inspectionMode: 'SURROUNDING_LANDMARK',
    title: 'The Sanctuary Hearth of Oakhaven',
    category: 'SANCTUARY',
    icon: '🏛️',
    shortPrompt: 'Inspect Sanctuary Hearth',
    description: 'Ringed by sharpened oak palisades and iron-strapped gates, Oakhaven is the last fortified refuge between the Darkmount Peaks and the Rotting Fen. Around the central cobblestone watchfire, weary scouts and mercenaries trade quiet warnings of ancient horrors stirring in the mist.',
    facingViews: {
      NORTH: {
        shortPrompt: 'Inspect North Gate Approach',
        description: 'Looking north up Oakhaven’s wet cobblestone main street, lantern light glints off deep wagon ruts leading toward the open timber arch of the Northern Gatehouse and the dark canopy of Mirkwood beyond.'
      },
      EAST: {
        shortPrompt: 'Inspect Eastern River Gate',
        description: 'To the east, Oakhaven’s stone arch opens directly onto the ancient flagstones of the Old Stone Bridge. Cold mist rises from the churning Blackwater River gorge just outside the palisade.'
      },
      SOUTH: {
        shortPrompt: 'Inspect Southern Fen-Ward Lane',
        description: 'Looking south down the storehouse lane, brass oil lanterns sway in the damp draft creeping up from the Fen-Ward Gatehouse. Rangers check their boots and pitch-torches before venturing into the southern mire.'
      },
      WEST: {
        shortPrompt: 'Inspect Market Square & Brazier',
        description: 'Across the western square, a heavy iron watch-brazier crackles with oak coals beside the bounty board and timber palisade, offering warmth against the frontier chill.'
      }
    }
  },
  {
    poiKey: 'poi_north_gate',
    tileX: 7,
    tileY: 6,
    facing: null,
    visibleFacings: ['NORTH', 'EAST', 'SOUTH', 'WEST'],
    inspectionMode: 'SURROUNDING_LANDMARK',
    title: 'Oakhaven Northern Timber Gatehouse',
    category: 'GATEHOUSE',
    icon: '🚪',
    shortPrompt: 'Inspect North Gate',
    description: 'Deep claw-gouges score the lower iron bands of the heavy oak doors. Pitch torches burn day and night in forged iron brackets, casting a trembling amber halo onto the muddy wagon ruts leading north toward Mirkwood Forest.',
    facingViews: {
      NORTH: {
        shortPrompt: 'Inspect Mirkwood Threshold',
        description: 'Standing outside the Northern Gatehouse looking north, the muddy frontier track narrows toward Mirkwood Crossroads. Above the treeline, cold fog coils around ancient boughs where Oakhaven’s patrols rarely linger after dusk.'
      },
      SOUTH: {
        shortPrompt: 'Inspect Gatehouse Doors',
        description: 'Looking south directly at Oakhaven’s fortified timber gatehouse, deep claw-gouges score the lower iron bands of the heavy oak doors while pitch torches burn in forged brackets overhead.'
      },
      EAST: {
        shortPrompt: 'Inspect Eastern Palisade Flank',
        description: 'Looking east along the outer sharpened oak palisade, the defensive ditch slopes down toward the rocky bank of the Blackwater River.'
      },
      WEST: {
        shortPrompt: 'Inspect Western Watchtower',
        description: 'Looking west along the outer timber palisade, a wet slate watchtower overlooks the encroaching edge of the Mirkwood treeline.'
      }
    }
  },
  {
    poiKey: 'poi_south_gate',
    tileX: 7,
    tileY: 8,
    facing: null,
    visibleFacings: ['NORTH', 'SOUTH'],
    inspectionMode: 'SURROUNDING_LANDMARK',
    title: 'The Fen-Ward Southern Gatehouse',
    category: 'GATEHOUSE',
    icon: '🚪',
    shortPrompt: 'Inspect South Gate',
    description: 'The southern gate smells perpetually of wet peat and marsh-rot. Sentries posted to the timber watchtowers keep brass braziers lit to pierce the greenish fog creeping up the muddy causeway from the Rotting Fen.',
    facingViews: {
      NORTH: {
        shortPrompt: 'Inspect Southern Gatehouse',
        description: 'Looking north toward Oakhaven’s southern timber gatehouse, warm lantern light glows against the wet palisade timbers while sentries keep watch above the muddy wetland causeway.'
      },
      SOUTH: {
        shortPrompt: 'Inspect Fen Causeway',
        description: 'Looking south through the Fen-Ward gate posts, a slick plank-and-mud causeway descends into the greenish fog and stagnant pools of the Rotting Fen.'
      }
    }
  },
  {
    poiKey: 'poi_crossroads_waystone',
    tileX: 7,
    tileY: 5,
    facing: 'NORTH',
    visibleFacings: ['NORTH'],
    inspectionMode: 'VISUAL_OBJECT',
    title: 'Runic Waystone of Mirkwood Crossroads',
    category: 'RUNESTONE',
    icon: '🪨',
    shortPrompt: 'Inspect Runestone',
    description: 'A monolithic slab of grey highland slate half-swallowed by forest moss stands directly beside the northern trail. Weathered runes carved deep into its face read "MIÐGARD • NORÐR • MYRKVIÐR"—an ancient boundary marker warning travelers that the realm’s law ends at the tree line.'
  },
  {
    poiKey: 'poi_ancient_oak',
    tileX: 7,
    tileY: 3,
    facing: null,
    visibleFacings: ['NORTH', 'EAST', 'WEST'],
    inspectionMode: 'VISUAL_OBJECT',
    title: 'The Primeval Black Oak',
    category: 'LANDMARK',
    icon: '🌳',
    shortPrompt: 'Inspect Ancient Oak',
    description: 'Older than Oakhaven’s foundations, this colossal black oak spreads its gnarled roots like the ribs of a fallen titan. Warm amber sap weeps slowly from fissures in its bark, humming faintly against the cold woodland fog.'
  },
  {
    poiKey: 'poi_old_stone_bridge',
    tileX: 8,
    tileY: 7,
    facing: null,
    visibleFacings: ['NORTH', 'EAST', 'SOUTH', 'WEST'],
    inspectionMode: 'SURROUNDING_LANDMARK',
    title: 'The Old Stone Bridge Over the Blackwater',
    category: 'BRIDGE',
    icon: '🌉',
    shortPrompt: 'Inspect Stone Bridge',
    description: 'Built by masons of a forgotten imperial age, these heavy grey arches are the only dry crossing over the churning Blackwater River. Several parapet stones along the flank have been cracked outward, as though something massive lunged from the gorge below.',
    facingViews: {
      EAST: {
        shortPrompt: 'Inspect Bridge Crossing East',
        description: 'Looking east across the slick grey flagstones of the Old Stone Bridge, the pointed Gothic archway of the ruined Bridge East Watchpost looms through the river mist.'
      },
      WEST: {
        shortPrompt: 'Inspect Bridge Crossing West',
        description: 'Looking west across the weathered stone span, the warm torches of Oakhaven’s Eastern River Gate glimmer on the far bank.'
      },
      NORTH: {
        shortPrompt: 'Inspect North Bridge Parapet',
        description: 'Peering north over the cracked stone parapet, white water churns violently against jagged black boulders at the bottom of the Blackwater gorge.'
      },
      SOUTH: {
        shortPrompt: 'Inspect South Bridge Parapet',
        description: 'Looking south over the moss-slick parapet wall, several heavy capstones have been wrenched loose above the roaring river torrent.'
      }
    }
  },
  {
    poiKey: 'poi_bridge_watchpost',
    tileX: 9,
    tileY: 7,
    facing: null,
    visibleFacings: ['NORTH', 'EAST', 'SOUTH', 'WEST'],
    inspectionMode: 'SURROUNDING_LANDMARK',
    title: 'Ruined Bridge East Watchpost',
    category: 'RUINS',
    icon: '🏚️',
    shortPrompt: 'Inspect Watchpost Ruins',
    description: 'Ivy and damp moss choke the pointed Gothic archway of this abandoned toll-keep. Rusted spearheads and shattered masonry litter the flagstones where Oakhaven’s eastern garrison once stood watch over the frontier.',
    facingViews: {
      WEST: {
        shortPrompt: 'Inspect Toll-Keep Archway',
        description: 'Looking west through the ivy-draped Gothic archway of the ruined toll-keep, the flagstones lead directly back onto the Old Stone Bridge toward Oakhaven.'
      },
      EAST: {
        shortPrompt: 'Inspect Fallen Watchtower Base',
        description: 'Looking east past the crumbled masonry of the watchtower base, an overgrown imperial road winds out into the open frontier plains.'
      },
      NORTH: {
        shortPrompt: 'Inspect Collapsed Gorge Flank',
        description: 'Looking north through a breached section of the watchpost wall, cold spray rises from the steep Blackwater River gorge below.'
      },
      SOUTH: {
        shortPrompt: 'Inspect Breached Southern Wall',
        description: 'Looking south across the shattered parapet stones, rusted garrison pikes lie wedged between blocks of fallen river-stone.'
      }
    }
  },
  {
    poiKey: 'poi_deadmans_mire',
    tileX: 4,
    tileY: 11,
    facing: null,
    visibleFacings: ['NORTH', 'EAST', 'WEST'],
    inspectionMode: 'VISUAL_OBJECT',
    title: 'Sunken Temple of Deadman’s Mire',
    category: 'RUINS',
    icon: '⛩️',
    shortPrompt: 'Inspect Sunken Ruins',
    description: 'Tilted carved pillars and drowned Gothic arches jut from the black stagnant bog water. Whatever sanctuary once stood here has been dragged down inch by inch into the mire, leaving only flooded flagstones and pale marsh wisps.'
  },
  {
    poiKey: 'poi_raven_crags_cairn',
    tileX: 3,
    tileY: 5,
    facing: null,
    visibleFacings: ['NORTH', 'WEST'],
    inspectionMode: 'VISUAL_OBJECT',
    title: 'The Sentinel Cairn of Raven Crags',
    category: 'CAIRN',
    icon: '🪨',
    shortPrompt: 'Inspect Sentinel Cairn',
    description: 'A dry-stacked monument of dark highland slate erected by border rangers along the narrow ravine pass. Black ravens roost atop its weathered capstone, watching the mist-choked defile descending from Darkmount.'
  },
  {
    poiKey: 'poi_windblown_heath_stones',
    tileX: 12,
    tileY: 4,
    facing: null,
    visibleFacings: ['NORTH', 'EAST'],
    inspectionMode: 'VISUAL_OBJECT',
    title: 'Frontier Monoliths of Windblown Heath',
    category: 'RUNESTONE',
    icon: '🗿',
    shortPrompt: 'Inspect Standing Stones',
    description: 'Leaning monoliths of salt-pitted granite flank the forgotten eastern highway. Faint spiral carvings on their leeward faces mark the old pilgrimage road that once ran from Oakhaven to the Murksea cliffs.'
  },
  {
    poiKey: 'poi_rotting_fen_boardwalk',
    tileX: 6,
    tileY: 10,
    facing: null,
    visibleFacings: ['SOUTH', 'EAST', 'WEST'],
    inspectionMode: 'VISUAL_OBJECT',
    title: 'Drowned Causeway of the Rotting Fen',
    category: 'CAUSEWAY',
    icon: '🏮',
    shortPrompt: 'Inspect Sunken Boardwalk',
    description: 'Half-submerged oak planks creak beneath the weight of every step. A shattered iron lantern hangs from a tilting timber post, left behind by peat-cutters who fled when the southern mire began to rise.'
  },
  {
    poiKey: 'poi_venomous_jungle_hollow',
    tileX: 9,
    tileY: 11,
    facing: null,
    visibleFacings: ['NORTH', 'EAST', 'SOUTH'],
    inspectionMode: 'VISUAL_OBJECT',
    title: 'Bioluminescent Spore Hollow',
    category: 'LANDMARK',
    icon: '🍄',
    shortPrompt: 'Inspect Spore Hollow',
    description: 'Colossal buttress roots coil over ancient mossy stone slabs. Clusters of amber-green fungi pulse softly in the humid gloom, shedding drifting spores that smell faintly of crushed nightshade and copper.'
  }
];

function resolvePointOfInterest(currentTile, aheadTile, facing = 'NORTH') {
  if (!currentTile) return null;
  const cx = Number(currentTile.x);
  const cy = Number(currentTile.y);
  const normFacing = String(facing || 'NORTH').toUpperCase();

  const exactMatch = POINTS_OF_INTEREST.find(p => {
    if (p.tileX !== cx || p.tileY !== cy) return false;
    if (Array.isArray(p.visibleFacings) && p.visibleFacings.length > 0) {
      return p.visibleFacings.includes(normFacing);
    }
    return !p.facing || p.facing === normFacing;
  });

  if (exactMatch) {
    const facingOverride = (exactMatch.facingViews && exactMatch.facingViews[normFacing]) || null;
    const resolvedTitle = (facingOverride && facingOverride.title) || exactMatch.title;
    const resolvedPrompt = (facingOverride && facingOverride.shortPrompt) || exactMatch.shortPrompt;
    const resolvedDesc = (facingOverride && facingOverride.description) || exactMatch.description;
    const allowedFacings = Array.isArray(exactMatch.visibleFacings) && exactMatch.visibleFacings.length > 0
      ? exactMatch.visibleFacings
      : (exactMatch.facing ? [exactMatch.facing] : ['NORTH', 'EAST', 'SOUTH', 'WEST']);

    return {
      ...exactMatch,
      x: exactMatch.tileX,
      y: exactMatch.tileY,
      facing: normFacing,
      facings: allowedFacings,
      title: resolvedTitle,
      shortPrompt: resolvedPrompt,
      description: resolvedDesc,
      loreText: resolvedDesc
    };
  }

  // Contextual barrier / landmark ahead POIs (line-of-sight to adjacent tile)
  if (aheadTile && aheadTile.x === 6 && aheadTile.y === 5) {
    const desc = 'A jagged fang of black granite thrusting violently through the forest floor. No foothold or goat-track scales its vertical face; only mountain crows nest among its mist-wrapped spires.';
    return {
      poiKey: 'poi_stonefang_crag',
      tileX: cx,
      tileY: cy,
      x: cx,
      y: cy,
      facing: normFacing,
      facings: [normFacing],
      inspectionMode: 'VISUAL_OBJECT',
      title: 'Stonefang Crag Monolith',
      category: 'BARRIER',
      icon: '⛰️',
      shortPrompt: 'Inspect Stonefang Crag',
      description: desc,
      loreText: desc
    };
  }
  if (aheadTile && aheadTile.x === 7 && aheadTile.y === 3 && (cx !== 7 || cy !== 3)) {
    const desc = 'Just ahead through the parting mist, the colossal root-arch of the Primeval Black Oak rises above the forest trail. Faint veins of warm amber sap glimmer along its furrowed bark.';
    return {
      poiKey: 'poi_ancient_oak_approach',
      tileX: cx,
      tileY: cy,
      x: cx,
      y: cy,
      facing: normFacing,
      facings: [normFacing],
      inspectionMode: 'VISUAL_OBJECT',
      title: 'Root-Arch of the Primeval Black Oak',
      category: 'LANDMARK',
      icon: '🌳',
      shortPrompt: 'Inspect Root-Arch Ahead',
      description: desc,
      loreText: desc
    };
  }
  if (aheadTile && !aheadTile.isPassable && aheadTile.terrain === 'SWAMP') {
    const desc = 'Crooked timber stakes bound with frayed hemp rope mark the end of solid ground. Beyond them, the pitch-black quagmire bubbles slowly around sunken deadwood where no traveler can find footing.';
    return {
      poiKey: 'poi_bottomless_mire_stakes',
      tileX: cx,
      tileY: cy,
      x: cx,
      y: cy,
      facing: normFacing,
      facings: [normFacing],
      inspectionMode: 'VISUAL_OBJECT',
      title: 'Warning Stakes of the Bottomless Mire',
      category: 'BARRIER',
      icon: '☠️',
      shortPrompt: 'Inspect Mire Stakes',
      description: desc,
      loreText: desc
    };
  }
  if (aheadTile && !aheadTile.isPassable && aheadTile.terrain === 'OCEAN') {
    const desc = 'A weather-scoured stone boundary cairn stands at the brink of sheer basalt cliffs. Far below, freezing black swells of the Murksea hammer the rock into white foam.';
    return {
      poiKey: 'poi_murksea_cairn',
      tileX: cx,
      tileY: cy,
      x: cx,
      y: cy,
      facing: normFacing,
      facings: [normFacing],
      inspectionMode: 'VISUAL_OBJECT',
      title: 'Coastal Cairn of the Murksea',
      category: 'BARRIER',
      icon: '🌊',
      shortPrompt: 'Inspect Coastal Cairn',
      description: desc,
      loreText: desc
    };
  }
  if (aheadTile && aheadTile.x === 4 && aheadTile.y === 11) {
    const desc = 'Through the drifting marsh fog ahead, the tilted Gothic stone arches of Deadman’s Mire rise out of the black water like the ribs of a drowned cathedral.';
    return {
      poiKey: 'poi_deadmans_mire_approach',
      tileX: cx,
      tileY: cy,
      x: cx,
      y: cy,
      facing: normFacing,
      facings: [normFacing],
      inspectionMode: 'VISUAL_OBJECT',
      title: 'Distant Arches of Deadman’s Mire',
      category: 'RUINS',
      icon: '⛩️',
      shortPrompt: 'Inspect Distant Ruins',
      description: desc,
      loreText: desc
    };
  }
  if (aheadTile && aheadTile.x === 7 && (aheadTile.y === 6 || aheadTile.y === 7 || aheadTile.y === 8) && cx === 6 && normFacing === 'EAST') {
    const desc = 'Looking east across the frontier track, Oakhaven’s sharpened oak palisades and corner watchtowers rise against the mist, lit by the warm amber glow of watchfire braziers.';
    return {
      poiKey: 'poi_oakhaven_palisade_approach',
      tileX: cx,
      tileY: cy,
      x: cx,
      y: cy,
      facing: normFacing,
      facings: [normFacing],
      inspectionMode: 'VISUAL_OBJECT',
      title: 'Western Palisades of Oakhaven',
      category: 'SANCTUARY',
      icon: '🏰',
      shortPrompt: 'Inspect Oakhaven Palisades',
      description: desc,
      loreText: desc
    };
  }
  if (aheadTile && aheadTile.x === 9 && aheadTile.y === 11 && (cx !== 9 || cy !== 11)) {
    const desc = 'Ahead between the coiled buttress roots and dripping lianas, eerie clusters of bioluminescent amber-green fungi pulse softly in the humid gloom of Spore Hollow.';
    return {
      poiKey: 'poi_spore_hollow_approach',
      tileX: cx,
      tileY: cy,
      x: cx,
      y: cy,
      facing: normFacing,
      facings: [normFacing],
      inspectionMode: 'VISUAL_OBJECT',
      title: 'Glowing Spores of the Hollow Ahead',
      category: 'LANDMARK',
      icon: '🍄',
      shortPrompt: 'Inspect Glowing Spores',
      description: desc,
      loreText: desc
    };
  }
  return null;
}

/**
 * PHASE 5 — Consolidated Environment Art Inventory & Preview Staging (`REVIEW REQUIRED`)
 * Unifies the 11 items from Phase 1 (`PHASE-1-FOLLOWUP.md`) and 9 items from Phase 2 (`PHASE-2-ART-BACKLOG.md`)
 * into 13 distinct, non-duplicate environment paintings stored in `docs/phase-5/art-candidates/`.
 *
 * Strict Governance Rule:
 *  - No new image is marked `APPROVED` without explicit user sign-off.
 *  - Default player mode (`candidateArtPreviewMode === false`) keeps 100% approved player-facing images.
 *  - Preview/Staging mode (`useCandidateArt: true` or `?artPreview=candidates`) activates the 13 candidate paintings.
 */
let candidateArtPreviewMode = false;

function setCandidateArtPreviewMode(enabled) {
  candidateArtPreviewMode = Boolean(enabled);
  return candidateArtPreviewMode;
}

function getCandidateArtPreviewMode() {
  return candidateArtPreviewMode;
}

const CANDIDATE_ART_INVENTORY = [
  {
    id: 'P5-ART-01',
    candidateKey: 'forest_tangled_canopy_pov',
    fileName: 'forest_tangled_canopy_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/forest_tangled_canopy_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/forest_tangled_canopy_pov.jpg',
    consolidatedFrom: ['forest_tangled_canopy_pov.jpg', 'forest_mossy_oak_glade_pov.jpg'],
    category: 'GENERIC_BIOME_POV',
    targetBiome: 'FOREST',
    targetSlotKey: 'forest_tangled_canopy',
    targetLocation: 'Mirkwood Forest generic Tier 4 POV pool (variant 3)',
    facing: 'OMNIDIRECTIONAL',
    priority: 'HIGH',
    currentApprovedFallback: '/lab-assets/images/perspective/ancient_oak_7_3_south.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: 'eb2d3361e8da951baf2179d16ee4b9464b98d22407c1a20f4e5b50002fad659f',
    status: 'REVIEW REQUIRED',
    purpose: 'Replaces the borrowed [7,3] SOUTH Ancient Oak root-arch in the generic FOREST Tier 4 pool with a landmark-free mossy oak canopy trail.'
  },
  {
    id: 'P5-ART-02',
    candidateKey: 'forest_misty_birch_hollow_pov',
    fileName: 'forest_misty_birch_hollow_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/forest_misty_birch_hollow_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/forest_misty_birch_hollow_pov.jpg',
    consolidatedFrom: ['forest_misty_birch_hollow_pov.jpg', 'forest_mossy_glade_pov.jpg'],
    category: 'GENERIC_BIOME_POV',
    targetBiome: 'FOREST',
    targetSlotKey: 'forest_misty_birch_hollow_pov',
    targetLocation: 'Mirkwood Forest generic Tier 4 POV pool (4th POV variant)',
    facing: 'OMNIDIRECTIONAL',
    priority: 'MEDIUM',
    currentApprovedFallback: '/images/terrain/terrain_forest.webp',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '8908f382462d7bc812e4a3598727908280d42edebd5f435f0745d00d405665d4',
    status: 'REVIEW REQUIRED',
    purpose: 'Expands the FOREST Tier 4 POV pool to 4 distinct landmark-free woodland paintings so all 4 cardinal directions on interior forest tiles can have unique views.'
  },
  {
    id: 'P5-ART-03',
    candidateKey: 'plains_rutted_wagon_track_pov',
    fileName: 'plains_rutted_wagon_track_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/plains_rutted_wagon_track_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/plains_rutted_wagon_track_pov.jpg',
    consolidatedFrom: ['plains_rutted_wagon_track_pov.jpg', 'plains_old_cart_track_pov.jpg'],
    category: 'GENERIC_BIOME_POV',
    targetBiome: 'PLAINS',
    targetSlotKey: 'plains_rutted_wagon_track_pov',
    targetLocation: 'Verdant Plains generic Tier 4 POV pool',
    facing: 'OMNIDIRECTIONAL',
    priority: 'MEDIUM',
    currentApprovedFallback: '/images/terrain/terrain_plains.webp',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '49cd02962052f725866220496afaa11e3ad27ab1f2016e49f8685e8b6b72ccd1',
    status: 'REVIEW REQUIRED',
    purpose: 'Adds a mud-rutted frontier wagon track POV to the PLAINS Tier 4 pool, reducing repetition across the 64 passable plains tiles.'
  },
  {
    id: 'P5-ART-04',
    candidateKey: 'plains_lone_barrow_horizon_pov',
    fileName: 'plains_lone_barrow_horizon_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/plains_lone_barrow_horizon_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/plains_lone_barrow_horizon_pov.jpg',
    consolidatedFrom: ['plains_lone_barrow_horizon_pov.jpg', 'plains_standing_stones_heath_pov.jpg'],
    category: 'GENERIC_BIOME_POV',
    targetBiome: 'PLAINS',
    targetSlotKey: 'plains_lone_barrow_horizon_pov',
    targetLocation: 'Verdant Plains generic Tier 4 POV pool',
    facing: 'OMNIDIRECTIONAL',
    priority: 'MEDIUM',
    currentApprovedFallback: '/lab-assets/images/terrain/plains_windblown_heath_pov.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '3c836270a1eb0ca9bfb413ed03b8c14e6a75c849c06f6379e77a9c8722f075f7',
    status: 'REVIEW REQUIRED',
    purpose: 'Completes a 4-image PLAINS Tier 4 POV pool with a heather footpath and distant horizon barrow.'
  },
  {
    id: 'P5-ART-05',
    candidateKey: 'swamp_sunken_roots_channel_pov',
    fileName: 'swamp_sunken_roots_channel_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/swamp_sunken_roots_channel_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/swamp_sunken_roots_channel_pov.jpg',
    consolidatedFrom: ['swamp_sunken_roots_channel_pov.jpg', 'swamp_drowned_willows_pov.jpg'],
    category: 'GENERIC_BIOME_POV',
    targetBiome: 'SWAMP',
    targetSlotKey: 'swamp_overgrown_bog',
    targetLocation: 'Rotting Fen generic Tier 4 POV pool (variant 1)',
    facing: 'OMNIDIRECTIONAL',
    priority: 'HIGH',
    currentApprovedFallback: '/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '457f66a2ff5859d61d9ffb9a9a53319137de2423cca15ef92f8ae588610713e0',
    status: 'REVIEW REQUIRED',
    purpose: 'Provides a dedicated temperate bog-willow and sunken-root channel POV for Rotting Fen (`swamp_overgrown_bog`).'
  },
  {
    id: 'P5-ART-06',
    candidateKey: 'hills_windswept_scree_pass_pov',
    fileName: 'hills_windswept_scree_pass_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/hills_windswept_scree_pass_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/hills_windswept_scree_pass_pov.jpg',
    consolidatedFrom: ['hills_windswept_scree_pass_pov.jpg', 'hills_windswept_scree_pov.jpg', 'hills_cairn_pass_pov.jpg'],
    category: 'GENERIC_BIOME_POV',
    targetBiome: 'HILLS',
    targetSlotKey: 'hills_windswept_scree_pass_pov',
    targetLocation: 'Raven Crags generic Tier 4 POV pool (4th POV variant)',
    facing: 'OMNIDIRECTIONAL',
    priority: 'MEDIUM',
    currentApprovedFallback: '/lab-assets/images/terrain/hills_highland_ridge_pov.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '43b78a3874b4374372c0825b63d98ad8d7d60a3b1586df0983a7b72f314e3bdc',
    status: 'REVIEW REQUIRED',
    purpose: 'Completes a 4-image HILLS Tier 4 POV pool for Raven Crags with a shattered dark-slate scree pass.'
  },
  {
    id: 'P5-ART-07',
    candidateKey: 'jungle_briar_thicket_pov',
    fileName: 'jungle_briar_thicket_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/jungle_briar_thicket_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/jungle_briar_thicket_pov.jpg',
    consolidatedFrom: ['jungle_briar_thicket_pov.jpg'],
    category: 'GENERIC_BIOME_POV',
    targetBiome: 'JUNGLE',
    targetSlotKey: 'jungle_shadowed_hollow',
    targetLocation: 'Venomous Jungle generic Tier 4 POV pool (variant 1)',
    facing: 'OMNIDIRECTIONAL',
    priority: 'MEDIUM',
    currentApprovedFallback: '/lab-assets/images/perspective/transition_swamp_to_jungle_pov.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: 'f062ab2fcaea5a715bbac5a330a307f9d326191c486c0f3ab61e43072d11dd87',
    status: 'REVIEW REQUIRED',
    purpose: 'Provides a dedicated briar-and-vine mire POV for `jungle_shadowed_hollow` in the Venomous Jungle.'
  },
  {
    id: 'P5-ART-08',
    candidateKey: 'transition_hills_to_swamp_pov',
    fileName: 'transition_hills_to_swamp_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/transition_hills_to_swamp_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/transition_hills_to_swamp_pov.jpg',
    consolidatedFrom: ['transition_hills_to_swamp_pov.jpg'],
    category: 'BIOME_TRANSITION_POV',
    targetBiome: 'HILLS->SWAMP',
    targetSlotKey: 'pov_transition_hills_to_swamp',
    targetLocation: 'Southern Raven Crags [1,8..5,8] looking SOUTH into Rotting Fen',
    facing: 'SOUTH',
    priority: 'HIGH',
    currentApprovedFallback: '/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '9572bc5b658839cd528deff060bff7eff1d1bd47e1c6bd1023e2a86503bc95e8',
    status: 'REVIEW REQUIRED',
    purpose: 'Depicts rocky highland slate and heather in the foreground descending directly into the black marsh water and bog-willows of Rotting Fen.'
  },
  {
    id: 'P5-ART-09',
    candidateKey: 'transition_swamp_to_plains_pov',
    fileName: 'transition_swamp_to_plains_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/transition_swamp_to_plains_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/transition_swamp_to_plains_pov.jpg',
    consolidatedFrom: ['transition_swamp_to_plains_pov.jpg'],
    category: 'BIOME_TRANSITION_POV',
    targetBiome: 'SWAMP->PLAINS',
    targetSlotKey: 'pov_transition_swamp_to_plains',
    targetLocation: 'Northern Rotting Fen border [6,9], [8,9..10,9] looking NORTH/EAST onto Verdant Plains',
    facing: 'NORTH',
    priority: 'HIGH',
    currentApprovedFallback: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: 'e7e245af6a216d7298c6fd13a3444a1d0f156891d80c187c39ae8cf624ff0e6c',
    status: 'REVIEW REQUIRED',
    purpose: 'Depicts sunken marsh timbers and black mud in the foreground climbing an embankment onto open windswept grassland ahead.'
  },
  {
    id: 'P5-ART-10',
    candidateKey: 'transition_hills_to_forest_pov',
    fileName: 'transition_hills_to_forest_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/transition_hills_to_forest_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/transition_hills_to_forest_pov.jpg',
    consolidatedFrom: ['transition_hills_to_forest_pov.jpg'],
    category: 'BIOME_TRANSITION_POV',
    targetBiome: 'HILLS->FOREST',
    targetSlotKey: 'pov_transition_hills_to_forest',
    targetLocation: 'Raven Crags [3,2..3,5], [5,6] looking EAST/NORTH into Mirkwood Forest',
    facing: 'EAST',
    priority: 'HIGH',
    currentApprovedFallback: '/lab-assets/images/terrain/forest_pine_ravine.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '0dde8059fe9258090d4c26206253246181c088e8241278a3008a066262cc9ff9',
    status: 'REVIEW REQUIRED',
    purpose: 'Depicts rocky highland slate boulders in the foreground descending directly into the dark firs and mossy oaks of Mirkwood ahead.'
  },
  {
    id: 'P5-ART-11',
    candidateKey: 'transition_plains_to_hills_pov',
    fileName: 'transition_plains_to_hills_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/transition_plains_to_hills_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/transition_plains_to_hills_pov.jpg',
    consolidatedFrom: ['transition_plains_to_hills_pov.jpg'],
    category: 'BIOME_TRANSITION_POV',
    targetBiome: 'PLAINS->HILLS',
    targetSlotKey: 'pov_transition_plains_to_hills',
    targetLocation: 'Western Verdant Plains [5,7..5,8], [6,6] looking WEST toward Raven Crags',
    facing: 'WEST',
    priority: 'HIGH',
    currentApprovedFallback: '/lab-assets/images/terrain/hills_highland_ridge_pov.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '782ae2b0f7ff67e1e64e268f5e2aa3a440a010078ef05e3f87bbbe077c8d534c',
    status: 'REVIEW REQUIRED',
    purpose: 'Depicts windswept grassland and heather in the foreground climbing rocky slate foothills toward the jagged peaks of Raven Crags.'
  },
  {
    id: 'P5-ART-12',
    candidateKey: 'transition_hills_to_plains_pov',
    fileName: 'transition_hills_to_plains_pov.jpg',
    candidateUrl: '/lab-assets/art-candidates/transition_hills_to_plains_pov.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/transition_hills_to_plains_pov.jpg',
    consolidatedFrom: ['transition_hills_to_plains_pov.jpg'],
    category: 'BIOME_TRANSITION_POV',
    targetBiome: 'HILLS->PLAINS',
    targetSlotKey: 'pov_transition_hills_to_plains',
    targetLocation: 'Eastern Raven Crags [4,7..4,8], [5,6] looking EAST/SOUTH onto Verdant Plains',
    facing: 'EAST',
    priority: 'HIGH',
    currentApprovedFallback: '/images/terrain/terrain_plains.webp',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: '6ccfc2b7c0d985363fc2c10d2575fa5b7af69e903850823b4bc79030c3f0a0b2',
    status: 'REVIEW REQUIRED',
    purpose: 'Depicts weathered highland boulders and slate ledges in the foreground descending onto wide windswept frontier grasslands.'
  },
  {
    id: 'P5-ART-13',
    candidateKey: 'watchpost_9_7_south_river_gorge',
    fileName: 'watchpost_9_7_south_river_gorge.jpg',
    candidateUrl: '/lab-assets/art-candidates/watchpost_9_7_south_river_gorge.jpg',
    diskRelativePath: 'docs/phase-5/art-candidates/watchpost_9_7_south_river_gorge.jpg',
    consolidatedFrom: ['watchpost_9_7_south_river_gorge.jpg'],
    category: 'LANDMARK_BESPOKE_POV',
    targetBiome: 'UNDERGROUND_RUINS',
    targetSlotKey: 'fp_watchpost_9_7_south',
    targetLocation: 'Bridge East Watchpost [9,7] looking SOUTH over broken river parapet',
    facing: 'SOUTH',
    priority: 'HIGH',
    currentApprovedFallback: '/lab-assets/images/perspective/watchpost_9_7_river_flank.jpg',
    width: 1376,
    height: 768,
    aspectRatio: 1.792,
    sha256: 'e13f6b0ec81a3e4494f76aa19a2bbfda44a82bfbf72d4db3f7b26cceaef73321',
    status: 'REVIEW REQUIRED',
    purpose: 'Distinguishes [9,7] SOUTH from [9,7] NORTH with a bespoke southern gorge view featuring a wedged garrison pike and breached parapet.'
  }
];

const CANDIDATE_BY_SLOT_KEY = new Map(
  CANDIDATE_ART_INVENTORY.map(item => [item.targetSlotKey, item])
);

const CANDIDATE_BY_KEY = new Map(
  CANDIDATE_ART_INVENTORY.map(item => [item.candidateKey, item])
);

const CANDIDATE_TIER4_POOLS = {
  FOREST: [
    { variantKey: 'forest_deep_boughs', imageUrl: '/images/terrain/terrain_forest.webp', status: 'APPROVED' },
    { variantKey: 'forest_pine_ravine', imageUrl: '/lab-assets/images/terrain/forest_pine_ravine.jpg', status: 'APPROVED' },
    { variantKey: 'forest_tangled_canopy_pov', imageUrl: '/lab-assets/art-candidates/forest_tangled_canopy_pov.jpg', status: 'REVIEW REQUIRED' },
    { variantKey: 'forest_misty_birch_hollow_pov', imageUrl: '/lab-assets/art-candidates/forest_misty_birch_hollow_pov.jpg', status: 'REVIEW REQUIRED' }
  ],
  PLAINS: [
    { variantKey: 'plains_windswept_trail', imageUrl: '/images/terrain/terrain_plains.webp', status: 'APPROVED' },
    { variantKey: 'plains_windblown_heath_pov', imageUrl: '/lab-assets/images/terrain/plains_windblown_heath_pov.jpg', status: 'APPROVED' },
    { variantKey: 'plains_rutted_wagon_track_pov', imageUrl: '/lab-assets/art-candidates/plains_rutted_wagon_track_pov.jpg', status: 'REVIEW REQUIRED' },
    { variantKey: 'plains_lone_barrow_horizon_pov', imageUrl: '/lab-assets/art-candidates/plains_lone_barrow_horizon_pov.jpg', status: 'REVIEW REQUIRED' }
  ],
  SWAMP: [
    { variantKey: 'swamp_drowned_mire', imageUrl: '/images/terrain/terrain_swamp.webp', status: 'APPROVED' },
    { variantKey: 'swamp_overgrown_bog', imageUrl: '/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg', status: 'APPROVED' },
    { variantKey: 'swamp_willow_boardwalk_pov', imageUrl: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg', status: 'APPROVED' },
    { variantKey: 'swamp_sunken_roots_channel_pov', imageUrl: '/lab-assets/art-candidates/swamp_sunken_roots_channel_pov.jpg', status: 'REVIEW REQUIRED' }
  ],
  HILLS: [
    { variantKey: 'hills_deadwood_pass', imageUrl: '/images/terrain/terrain_fallback_v1_scorched.webp', status: 'APPROVED' },
    { variantKey: 'hills_raven_crags_ravine_pov', imageUrl: '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg', status: 'APPROVED' },
    { variantKey: 'hills_highland_ridge_pov', imageUrl: '/lab-assets/images/terrain/hills_highland_ridge_pov.jpg', status: 'APPROVED' },
    { variantKey: 'hills_windswept_scree_pass_pov', imageUrl: '/lab-assets/art-candidates/hills_windswept_scree_pass_pov.jpg', status: 'REVIEW REQUIRED' }
  ],
  JUNGLE: [
    { variantKey: 'jungle_primeval', imageUrl: '/images/terrain/terrain_jungle.webp', status: 'APPROVED' },
    { variantKey: 'jungle_shadowed_hollow', imageUrl: '/lab-assets/images/perspective/transition_swamp_to_jungle_pov.jpg', status: 'APPROVED' },
    { variantKey: 'jungle_venomous_trail_pov', imageUrl: '/lab-assets/images/terrain/jungle_venomous_trail_pov.jpg', status: 'APPROVED' },
    { variantKey: 'jungle_briar_thicket_pov', imageUrl: '/lab-assets/art-candidates/jungle_briar_thicket_pov.jpg', status: 'REVIEW REQUIRED' }
  ]
};

function resolveStagedCandidateForScene(baseScene, current, facing) {
  if (!baseScene) return null;
  if (baseScene.povTier === 4 && current && CANDIDATE_TIER4_POOLS[current.terrain]) {
    const pool = CANDIDATE_TIER4_POOLS[current.terrain];
    const idx = computeDeterministicVariantIndex(
      Number(current.x || 0),
      Number(current.y || 0),
      pool.length,
      facing
    );
    const chosen = pool[idx];
    if (chosen && chosen.status === 'REVIEW REQUIRED') {
      return CANDIDATE_BY_KEY.get(chosen.variantKey) || null;
    }
    return null;
  }
  const directSlot = CANDIDATE_BY_SLOT_KEY.get(baseScene.variantKey);
  if (directSlot) {
    return directSlot;
  }
  return null;
}

/**
 * PHASE 1.2 & 1.3 — World Visual Atlas & Coverage Quality Classification (`A`, `B`, `C`, `D`)
 * Evaluates every tile (225 tiles) and all 4 cardinal facings (900 viewpoints; 640 passable viewpoints).
 */
const COVERAGE_QUALITY_GRADES = {
  A: {
    grade: 'A',
    label: 'A — Bespoke POV',
    description: 'Dedicated, high-quality eye-level painting tailored to this specific tile and facing.'
  },
  B: {
    grade: 'B',
    label: 'B — Contextual POV',
    description: 'Eye-level painting that matches the specific area, landmark, biome transition, or impassable barrier in that direction.'
  },
  C: {
    grade: 'C',
    label: 'C — Generic POV',
    description: 'Eye-level terrain-appropriate painting from a multi-variant pool that respects geography and never shows conflicting landmarks.'
  },
  D: {
    grade: 'D',
    label: 'D — Needs Artwork',
    description: 'Current image is an exterior overview, repeats a conflicting directional landmark, or misleads the player about passability.'
  }
};

function classifyViewCoverageQuality(sceneC, currentTile, aheadTile) {
  if (!sceneC) {
    return {
      qualityGrade: 'D',
      qualityLabel: COVERAGE_QUALITY_GRADES.D.label,
      isBespoke: false,
      neighborConsistent: false,
      visuallyAppropriate: false,
      needsArtwork: true
    };
  }

  const isEyeLevelPov = (sceneC.cameraType || 'POV') === 'POV';
  const tier = Number(sceneC.povTier || 4);
  const imgUrl = String(sceneC.imageUrl || '');
  const isBlockedAhead = Boolean(aheadTile && !aheadTile.isPassable);

  // Check neighbor & barrier consistency
  let neighborConsistent = true;
  if (isBlockedAhead && currentTile && currentTile.isPassable) {
    // When looking at an impassable barrier from a passable tile, Tier 1, 2, or 3 barrier/flank rules should handle it
    neighborConsistent = tier <= 3 || sceneC.viewCategory === 'BARRIER';
  }

  const visuallyAppropriate = isEyeLevelPov && neighborConsistent;
  if (!visuallyAppropriate) {
    return {
      qualityGrade: 'D',
      qualityLabel: COVERAGE_QUALITY_GRADES.D.label,
      isBespoke: false,
      neighborConsistent,
      visuallyAppropriate: false,
      needsArtwork: true
    };
  }

  if (tier === 1) {
    return {
      qualityGrade: 'A',
      qualityLabel: COVERAGE_QUALITY_GRADES.A.label,
      isBespoke: true,
      neighborConsistent: true,
      visuallyAppropriate: true,
      needsArtwork: false
    };
  }

  if (tier === 2 || tier === 3) {
    const isBespokeLandmark = tier === 2 && imgUrl.startsWith('/lab-assets/images/');
    const grade = isBespokeLandmark ? 'A' : 'B';
    return {
      qualityGrade: grade,
      qualityLabel: COVERAGE_QUALITY_GRADES[grade].label,
      isBespoke: isBespokeLandmark,
      neighborConsistent: true,
      visuallyAppropriate: true,
      needsArtwork: false
    };
  }

  if (tier === 4 && (sceneC.corridorKey || (aheadTile && aheadTile.feature))) {
    return {
      qualityGrade: 'B',
      qualityLabel: COVERAGE_QUALITY_GRADES.B.label,
      isBespoke: false,
      neighborConsistent: true,
      visuallyAppropriate: true,
      needsArtwork: false
    };
  }

  return {
    qualityGrade: 'C',
    qualityLabel: COVERAGE_QUALITY_GRADES.C.label,
    isBespoke: false,
    neighborConsistent: true,
    visuallyAppropriate: true,
    needsArtwork: false
  };
}

function buildWorldVisualAtlas(db, options = {}) {
  const useCandidateArt = Boolean(options && options.useCandidateArt !== undefined ? options.useCandidateArt : candidateArtPreviewMode);
  const rawTiles = db.prepare('SELECT * FROM map_tiles ORDER BY y ASC, x ASC').all();
  const tileByCoord = new Map();
  for (const t of rawTiles) {
    tileByCoord.set(`${t.x},${t.y}`, {
      ...t,
      isPassable: t.is_passable === 1,
      isSafe: t.is_safe === 1,
      exists: true
    });
  }

  const dirVectors = {
    NORTH: { dx: 0, dy: -1, left: 'WEST', right: 'EAST', behind: 'SOUTH' },
    EAST:  { dx: 1, dy: 0,  left: 'NORTH', right: 'SOUTH', behind: 'WEST' },
    SOUTH: { dx: 0, dy: 1,  left: 'EAST', right: 'WEST', behind: 'NORTH' },
    WEST:  { dx: -1, dy: 0, left: 'SOUTH', right: 'NORTH', behind: 'EAST' }
  };

  function getNeighbor(x, y, dir) {
    const v = dirVectors[dir];
    const found = tileByCoord.get(`${x + v.dx},${y + v.dy}`);
    if (found) return { ...found, direction: dir };
    return {
      exists: false,
      x: x + v.dx,
      y: y + v.dy,
      direction: dir,
      name: 'Edge of the World',
      terrain: 'VOID',
      feature: null,
      isPassable: false,
      isSafe: false
    };
  }

  const gradeCountsPassable = { A: 0, B: 0, C: 0, D: 0 };
  const tierCountsPassable = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const uniqueImagesPassable = new Set();
  const biomeBreakdown = {};
  let candidatePreviewSlotsCount = 0;

  const atlasTiles = [];
  isBuildingAtlas = true;
  try {
    for (const t of rawTiles) {
      const current = {
        ...t,
        isPassable: t.is_passable === 1,
        isSafe: t.is_safe === 1,
        exists: true
      };
      const views = {};
      const gradesOnTile = [];

      for (const facing of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        const vMeta = dirVectors[facing];
        const ahead1 = getNeighbor(t.x, t.y, facing);
        const left1 = getNeighbor(t.x, t.y, vMeta.left);
        const right1 = getNeighbor(t.x, t.y, vMeta.right);
        const behind1 = getNeighbor(t.x, t.y, vMeta.behind);
        const seed = ((t.x * 73856093) ^ (t.y * 19349663)) >>> 0;

        const sceneC = resolveSceneModeC(db, current, ahead1, left1, right1, facing, seed, false, behind1, { useCandidateArt });
      const quality = classifyViewCoverageQuality(sceneC, current, ahead1);
      const poi = resolvePointOfInterest(current, ahead1, facing);
      const effectProfile = resolveAtmosphereEffectProfile(sceneC.atmosphereProfile, current, ahead1, facing);

      if (current.isPassable && sceneC.candidatePreview) {
        candidatePreviewSlotsCount++;
      }

      views[facing] = {
        facing,
        imageUrl: sceneC.imageUrl,
        approvedImageUrl: sceneC.approvedImageUrl || sceneC.imageUrl,
        artApprovalStatus: sceneC.artApprovalStatus || 'APPROVED',
        candidatePreview: sceneC.candidatePreview || null,
        variantKey: sceneC.variantKey,
        viewTitle: sceneC.viewTitle,
        viewSubtitle: sceneC.viewSubtitle,
        povTier: sceneC.povTier,
        povTierKey: sceneC.povTierKey,
        povTierLabel: sceneC.povTierLabel,
        sourceType: sceneC.povTier === 1 ? 'Bespoke POV' : (sceneC.povTier <= 3 ? 'Contextual POV' : 'Generic Pool POV'),
        qualityGrade: quality.qualityGrade,
        qualityLabel: quality.qualityLabel,
        isBespoke: quality.isBespoke,
        landmarksVisible: sceneC.landmarksVisible || (ahead1.feature ? `${ahead1.name} (${ahead1.feature})` : null),
        canTravelForward: Boolean(current.isPassable && ahead1.isPassable),
        isBlockedAhead: Boolean(!ahead1.isPassable),
        aheadTile: {
          x: ahead1.x,
          y: ahead1.y,
          name: ahead1.name,
          terrain: ahead1.terrain,
          feature: ahead1.feature || null,
          isPassable: ahead1.isPassable
        },
        neighborConsistent: quality.neighborConsistent,
        visuallyAppropriate: quality.visuallyAppropriate,
        needsArtwork: quality.needsArtwork,
        atmosphereProfile: effectProfile.profileKey,
        atmosphereLabel: effectProfile.label,
        effectProfile,
        stageSurface: sceneC.stageAnchor ? sceneC.stageAnchor.groundSurfaceType : 'wilderness-soil',
        stageAnchor: sceneC.stageAnchor || { groundSurfaceType: 'wilderness-soil' },
        pointOfInterest: poi ? { poiKey: poi.poiKey, title: poi.title, icon: poi.icon, category: poi.category } : null,
        poi: poi ? { poiKey: poi.poiKey, title: poi.title, icon: poi.icon } : null
      };

      gradesOnTile.push(quality.qualityGrade);

      if (current.isPassable) {
        gradeCountsPassable[quality.qualityGrade] = (gradeCountsPassable[quality.qualityGrade] || 0) + 1;
        tierCountsPassable[sceneC.povTier] = (tierCountsPassable[sceneC.povTier] || 0) + 1;
        uniqueImagesPassable.add(sceneC.imageUrl);
        if (!biomeBreakdown[current.terrain]) {
          biomeBreakdown[current.terrain] = { tiles: 0, views: 0, A: 0, B: 0, C: 0, D: 0 };
        }
        biomeBreakdown[current.terrain].views++;
        biomeBreakdown[current.terrain][quality.qualityGrade]++;
      }
    }

    if (current.isPassable && biomeBreakdown[current.terrain]) {
      biomeBreakdown[current.terrain].tiles++;
    }

    // Best grade on this tile for map color coding (A > B > C > D, unless any direction is D)
    let tileGrade = 'C';
    if (gradesOnTile.includes('D')) tileGrade = 'D';
    else if (gradesOnTile.includes('A')) tileGrade = 'A';
    else if (gradesOnTile.includes('B')) tileGrade = 'B';

    const tilePoi = POINTS_OF_INTEREST.find(p => p.tileX === current.x && p.tileY === current.y) || resolvePointOfInterest(current, null, 'NORTH');

    const terrainSymbols = {
      CITY: '🏰',
      BRIDGE: '🌉',
      FOREST: '🌲',
      PLAINS: '🌾',
      HILLS: '⛰️',
      SWAMP: '🌿',
      JUNGLE: '🌴',
      UNDERGROUND_RUINS: '🏚️',
      MOUNTAINS: '▲',
      RIVER_LAKE: '≈',
      OCEAN: '≈'
    };

    atlasTiles.push({
      id: t.id,
      x: t.x,
      y: t.y,
      name: t.name,
      terrain: t.terrain,
      subBiome: t.feature || t.name || t.terrain,
      symbol: terrainSymbols[t.terrain] || '·',
      feature: t.feature || null,
      description: t.description || '',
      isPassable: current.isPassable,
      isSafe: current.isSafe,
      tileGrade,
      bestGrade: tileGrade,
      hasPoi: Boolean(tilePoi),
      poiTitle: tilePoi ? tilePoi.title : null,
      views,
      directions: views
    });
    }
  } finally {
    isBuildingAtlas = false;
  }

  const totalTilesCount = rawTiles.length;
  const passableTilesCount = rawTiles.filter(t => t.is_passable === 1).length;
  const impassableTilesCount = rawTiles.filter(t => t.is_passable === 0).length;
  const passableViewpointsCount = passableTilesCount * 4;

  return {
    generatedAt: new Date().toISOString(),
    artPreviewMode: useCandidateArt ? 'CANDIDATES_STAGED' : 'APPROVED_DEFAULT',
    gridWidth: 15,
    gridHeight: 15,
    totalTiles: totalTilesCount,
    passableTiles: passableTilesCount,
    impassableTiles: impassableTilesCount,
    totalPassableViewpoints: passableViewpointsCount,
    gradeDefinitions: COVERAGE_QUALITY_GRADES,
    candidateArtInventory: CANDIDATE_ART_INVENTORY,
    summary: {
      artPreviewMode: useCandidateArt ? 'CANDIDATES_STAGED' : 'APPROVED_DEFAULT',
      totalTiles: totalTilesCount,
      passableTiles: passableTilesCount,
      impassableTiles: impassableTilesCount,
      totalViewpoints: totalTilesCount * 4,
      passableViewpoints: passableViewpointsCount,
      grades: gradeCountsPassable,
      passableGradeCounts: gradeCountsPassable,
      tiers: tierCountsPassable,
      uniqueImagesCount: uniqueImagesPassable.size,
      uniqueImagesUsed: uniqueImagesPassable.size,
      uniqueImages: Array.from(uniqueImagesPassable).sort(),
      needsArtworkCount: gradeCountsPassable.D || 0,
      pointsOfInterestCount: POINTS_OF_INTEREST.length,
      candidateArtCount: CANDIDATE_ART_INVENTORY.length,
      candidatePreviewSlotsCount,
      biomeBreakdown
    },
    tiles: atlasTiles
  };
}

module.exports = {
  SCENE_MODES,
  POV_TIERS,
  COVERAGE_QUALITY_GRADES,
  ATMOSPHERE_EFFECT_PROFILES,
  POINTS_OF_INTEREST,
  CANDIDATE_ART_INVENTORY,
  CANDIDATE_TIER4_POOLS,
  DEFAULT_SCENE_VARIANTS,
  DEFAULT_PERSPECTIVE_VIEWS,
  DEFAULT_POV_CONTEXT_RULES,
  TRANSITION_CONTEXT_TYPES,
  REVISIT_STATUS_TYPES,
  WORLD_LANDMARKS,
  NAMED_CORRIDORS,
  setCandidateArtPreviewMode,
  getCandidateArtPreviewMode,
  normalizeSceneMode,
  computeDeterministicVariantIndex,
  computeSceneStageAnchor,
  resolveAtmosphereEffectProfile,
  resolvePointOfInterest,
  buildWorldVisualAtlas,
  initSceneCatalogTables,
  resolveTileVariant,
  resolveSceneModeA,
  resolveSceneModeB,
  resolveSceneModeC,
  resolveSceneModeLegacy,
  getLatestSceneViewportContext,
  resolveBoundaryGuidance,
  getBoundaryGuidance,
  computeDirectionalCompassContext,
  resolveBiomePersistence,
  evaluateTransitionContinuity
};
