/**
 * DARKGRID — ACTION UI LAB: WORLD TRAVEL & SCENE CONTINUITY ENGINE (`travel-continuity.js`)
 *
 * Strictly isolated inside `action-ui-lab/`.
 * Makes exploration feel like traveling through a persistent, directional dark-fantasy world
 * rather than cycling through disconnected visual states.
 *
 * Provides:
 *  1. Relative movement (`FORWARD`, `BACKWARD`, `STRAFE_LEFT`, `STRAFE_RIGHT`) & rotation (`LEFT`, `RIGHT`) classification.
 *  2. 4-Direction Compass & Landmark Orientation (`computeDirectionalCompassContext`) across `ahead`, `left`, `right`, `behind`.
 *  3. Corridor & Adjacent-Tile Transition Continuity (`evaluateTransitionContinuity`):
 *     - `SAME_CORRIDOR_ADVANCE`, `BIOME_THRESHOLD_CROSSING`, `LANDMARK_APPROACH`,
 *       `LANDMARK_DEPARTURE`, `ROTATION_IN_PLACE`, `RETREAT_STEP`
 *     - Cohesive `continuityNote`, `horizonHint`, `behindHint`, and `breadcrumbTrail`.
 *  4. Sub-Biome Atmosphere & Lighting Persistence (`resolveBiomePersistence`) with threshold cues.
 *  5. Combat-to-Exploration Context Preservation (`recordTravelCombatTransition`) preserving facing,
 *     active discovery state, breadcrumb trail, and scene stage anchor.
 *  6. Location Revisit & Fled-Threat Memory (`revisitStatus`: `'FIRST_VISIT'` | `'FAMILIAR_SAFE'` |
 *     `'LINGERING_THREAT_SITE'` | `'CLEARED_SITE'`).
 *  7. SQLite Persistence & Reload Restoration (`lab_adventure_state` & `lab_travel_continuity`).
 *  8. Expedition Objective Continuity (`computeActiveObjectiveHint`).
 *  9. World-Consistent Boundary & Impassable Terrain Guidance (`resolveBoundaryGuidance` / `getBoundaryGuidance`).
 */

const FACING_ORDER = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

const FACING_VECTORS = {
  NORTH: { dx: 0, dy: -1, label: 'North', short: 'N', deg: 0, opposite: 'SOUTH', left: 'WEST', right: 'EAST' },
  EAST:  { dx: 1, dy: 0,  label: 'East',  short: 'E', deg: 90, opposite: 'WEST', left: 'NORTH', right: 'SOUTH' },
  SOUTH: { dx: 0, dy: 1,  label: 'South', short: 'S', deg: 180, opposite: 'NORTH', left: 'EAST', right: 'WEST' },
  WEST:  { dx: -1, dy: 0, label: 'West',  short: 'W', deg: 270, opposite: 'EAST', left: 'SOUTH', right: 'NORTH' }
};

const TRANSITION_CONTEXT_TYPES = {
  SAME_CORRIDOR_ADVANCE: 'SAME_CORRIDOR_ADVANCE',
  BIOME_THRESHOLD_CROSSING: 'BIOME_THRESHOLD_CROSSING',
  LANDMARK_APPROACH: 'LANDMARK_APPROACH',
  LANDMARK_DEPARTURE: 'LANDMARK_DEPARTURE',
  ROTATION_IN_PLACE: 'ROTATION_IN_PLACE',
  RETREAT_STEP: 'RETREAT_STEP',
  LATERAL_STEP: 'LATERAL_STEP',
  SANCTUARY_ARRIVAL: 'SANCTUARY_ARRIVAL',
  INITIAL_POSITION: 'INITIAL_POSITION'
};

const REVISIT_STATUS_TYPES = {
  FIRST_VISIT: 'FIRST_VISIT',
  FAMILIAR_SAFE: 'FAMILIAR_SAFE',
  LINGERING_THREAT_SITE: 'LINGERING_THREAT_SITE',
  CLEARED_SITE: 'CLEARED_SITE'
};

/**
 * Authoritative World Landmarks on the 15x15 Map (`[0..14, 0..14]`)
 */
const WORLD_LANDMARKS = {
  '7,7': {
    coord: '7,7',
    x: 7,
    y: 7,
    key: 'OAKHAVEN_SANCTUARY',
    name: 'Oakhaven Sanctuary',
    shortName: 'Oakhaven',
    terrain: 'CITY',
    feature: 'MARKETPLACE',
    isMajorLandmark: true,
    isSanctuary: true,
    silhouetteCue: 'the torchlit timber palisades and hearth-smoke of Oakhaven Sanctuary'
  },
  '7,6': {
    coord: '7,6',
    x: 7,
    y: 6,
    key: 'OAKHAVEN_NORTH_GATE',
    name: 'Oakhaven North Gate',
    shortName: 'North Gate',
    terrain: 'PLAINS',
    feature: 'TOWN_GATES',
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the iron-strapped timber gatehouse and watchfire braziers of Oakhaven North Gate'
  },
  '7,8': {
    coord: '7,8',
    x: 7,
    y: 8,
    key: 'OAKHAVEN_SOUTH_GATE',
    name: 'Fen-Ward South Gate',
    shortName: 'South Gate',
    terrain: 'PLAINS',
    feature: 'TOWN_GATES',
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the marsh-facing timber watchtowers of Oakhaven’s Fen-Ward South Gate'
  },
  '7,5': {
    coord: '7,5',
    x: 7,
    y: 5,
    key: 'MIRKWOOD_CROSSROADS',
    name: 'Mirkwood Crossroads',
    shortName: 'Crossroads Waystone',
    terrain: 'FOREST',
    feature: null,
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the carved Runic Waystone and notched ranger signpost at Mirkwood Crossroads'
  },
  '7,4': {
    coord: '7,4',
    x: 7,
    y: 4,
    key: 'MIRKWOOD_TRAIL',
    name: 'Mirkwood Trail',
    shortName: 'Mirkwood Trail',
    terrain: 'FOREST',
    feature: null,
    isMajorLandmark: false,
    isCorridorNode: true,
    isSanctuary: false,
    silhouetteCue: 'the root-woven northern Mirkwood Trail beside the abandoned ranger bivouac'
  },
  '7,3': {
    coord: '7,3',
    x: 7,
    y: 3,
    key: 'PRIMEVAL_BLACK_OAK',
    name: 'Heart of the Mirkwood',
    shortName: 'Primeval Black Oak',
    terrain: 'FOREST',
    feature: 'ANCIENT_OAK',
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the colossal gnarled root-arch and amber sap fissures of the Primeval Black Oak'
  },
  '8,7': {
    coord: '8,7',
    x: 8,
    y: 7,
    key: 'OLD_STONE_BRIDGE',
    name: 'The Old Stone Bridge',
    shortName: 'Old Stone Bridge',
    terrain: 'BRIDGE',
    feature: 'ANCIENT_BRIDGE',
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the weathered masonry arches and parapets of The Old Stone Bridge spanning the Blackwater gorge'
  },
  '9,7': {
    coord: '9,7',
    x: 9,
    y: 7,
    key: 'BRIDGE_EAST_WATCHPOST',
    name: 'Bridge East Watchpost',
    shortName: 'East Watchpost',
    terrain: 'UNDERGROUND_RUINS',
    feature: 'SUNK_RUIN',
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the ivy-draped Gothic archway and crumbled toll-keep of Bridge East Watchpost'
  },
  '6,5': {
    coord: '6,5',
    x: 6,
    y: 5,
    key: 'STONEFANG_CRAG',
    name: 'Stonefang Crag',
    shortName: 'Stonefang Crag',
    terrain: 'MOUNTAINS',
    feature: null,
    isMajorLandmark: true,
    isBarrierLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the sheer black granite monolith of Stonefang Crag barring passage'
  },
  '4,11': {
    coord: '4,11',
    x: 4,
    y: 11,
    key: 'DEADMANS_MIRE',
    name: 'Deadman’s Mire',
    shortName: 'Deadman’s Mire Ruins',
    terrain: 'SWAMP',
    feature: 'SUNK_RUIN',
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the drowned Gothic sanctuary arches and tilted pillars of Deadman’s Mire'
  },
  '6,10': {
    coord: '6,10',
    x: 6,
    y: 10,
    key: 'ROTTING_FEN_BOARDWALK',
    name: 'Rotting Fen Boardwalk',
    shortName: 'Willow Causeway',
    terrain: 'SWAMP',
    feature: null,
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the half-sunken timber plank causeway and weeping bog-willows of the Rotting Fen'
  },
  '3,5': {
    coord: '3,5',
    x: 3,
    y: 5,
    key: 'RAVEN_CRAGS_CAIRN',
    name: 'Raven Crags Sentinel Cairn',
    shortName: 'Sentinel Cairn',
    terrain: 'HILLS',
    feature: null,
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the dry-stacked slate Sentinel Cairn overlooking the highland ravine of Raven Crags'
  },
  '12,4': {
    coord: '12,4',
    x: 12,
    y: 4,
    key: 'WINDBLOWN_HEATH_STONES',
    name: 'Windblown Heath Standing Stones',
    shortName: 'Standing Stones',
    terrain: 'PLAINS',
    feature: null,
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the salt-pitted granite monoliths flanking the old eastern road on Windblown Heath'
  },
  '9,11': {
    coord: '9,11',
    x: 9,
    y: 11,
    key: 'VENOMOUS_JUNGLE_HOLLOW',
    name: 'Bioluminescent Spore Hollow',
    shortName: 'Spore Hollow',
    terrain: 'JUNGLE',
    feature: null,
    isMajorLandmark: true,
    isSanctuary: false,
    silhouetteCue: 'the colossal coiled buttress roots and glowing amber-green fungi of the Venomous Jungle'
  }
};

/**
 * Named World Corridors for Cohesive Step-by-Step Progression
 */
const NAMED_CORRIDORS = {
  NORTHERN_MIRKWOOD_CORRIDOR: {
    key: 'NORTHERN_MIRKWOOD_CORRIDOR',
    name: 'The Northern Mirkwood Corridor',
    subtitle: 'Oakhaven Sanctuary → North Gate → Mirkwood Crossroads → Mirkwood Trail → Primeval Black Oak',
    axis: 'NORTH_SOUTH',
    outboundDirection: 'NORTH',
    returnDirection: 'SOUTH',
    orderedCoords: ['7,7', '7,6', '7,5', '7,4', '7,3', '7,2']
  },
  EASTERN_BRIDGE_WATCHPOST_CORRIDOR: {
    key: 'EASTERN_BRIDGE_WATCHPOST_CORRIDOR',
    name: 'The Blackwater Crossing & Watchpost Corridor',
    subtitle: 'Oakhaven Sanctuary → The Old Stone Bridge → Bridge East Watchpost → Eastern Frontier Road',
    axis: 'EAST_WEST',
    outboundDirection: 'EAST',
    returnDirection: 'WEST',
    orderedCoords: ['7,7', '8,7', '9,7', '10,7']
  },
  SOUTHERN_ROTTING_FEN_CORRIDOR: {
    key: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    name: 'The Rotting Fen & Deadman’s Mire Causeway',
    subtitle: 'Oakhaven Sanctuary → Fen-Ward South Gate → Rotting Fen Boardwalk → Deadman’s Mire',
    axis: 'NORTH_SOUTH_SW',
    outboundDirection: 'SOUTH',
    returnDirection: 'NORTH',
    orderedCoords: ['7,7', '7,8', '7,9', '6,9', '6,10', '5,10', '4,10', '4,11']
  },
  WESTERN_RAVEN_CRAGS_CORRIDOR: {
    key: 'WESTERN_RAVEN_CRAGS_CORRIDOR',
    name: 'The Raven Crags Highland Pass',
    subtitle: 'Western Foothills → Highland Slate Ravine → Sentinel Cairn of Raven Crags',
    axis: 'EAST_WEST',
    outboundDirection: 'WEST',
    returnDirection: 'EAST',
    orderedCoords: ['5,5', '4,5', '3,5']
  }
};

/**
 * Authoritative Step-by-Step Corridor Transition Narratives
 * Keyed by `"fromX,fromY->toX,toY"`
 */
const CORRIDOR_STEP_NARRATIVES = {
  // Northern Mirkwood Corridor (Outbound North)
  '7,7->7,6': {
    corridorKey: 'NORTHERN_MIRKWOOD_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Leaving the warm hearth-fires of Oakhaven Sanctuary behind, you pass beneath the torchlit timber arch of the North Gate onto the muddy frontier track.',
    horizonHint: 'Ahead North: The carved Runic Waystone and dark eaves of Mirkwood Crossroads [7,5] rise just beyond the gate road.'
  },
  '7,6->7,5': {
    corridorKey: 'NORTHERN_MIRKWOOD_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Crossing the treeline threshold from Oakhaven’s gate road, the open sky vanishes beneath the ancient boughs of Mirkwood Crossroads beside the Runic Waystone.',
    horizonHint: 'Ahead North: The root-woven Mirkwood Trail [7,4] winds deeper toward the Primeval Black Oak, while Stonefang Crag [6,5] bars the west.'
  },
  '7,5->7,4': {
    corridorKey: 'NORTHERN_MIRKWOOD_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH
    ],
    continuityNote: 'Advancing north from the Crossroads Waystone along the central Mirkwood trail, the canopy thickens and faint veins of warm amber light glimmer through the fog ahead.',
    horizonHint: 'Ahead North: Through parting woodland mist rises the colossal root-arch of the Primeval Black Oak at Heart of the Mirkwood [7,3].'
  },
  '7,4->7,3': {
    corridorKey: 'NORTHERN_MIRKWOOD_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Following the mossy woodland corridor past the abandoned scout camp, you arrive directly before the colossal gnarled root-arch and amber sap fissures of the Primeval Black Oak.',
    horizonHint: 'At Heart of the Mirkwood [7,3]: The Primeval Black Oak towers overhead; the return trail to Oakhaven Sanctuary runs straight South.'
  },

  // Northern Mirkwood Corridor (Return South)
  '7,3->7,4': {
    corridorKey: 'NORTHERN_MIRKWOOD_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping out from beneath the overarching roots of the Primeval Black Oak, you follow the damp woodland trail south back toward Mirkwood Crossroads.',
    horizonHint: 'Ahead South: The carved Runic Waystone of Mirkwood Crossroads [7,5] stands where the forest trail begins to widen.'
  },
  '7,4->7,5': {
    corridorKey: 'NORTHERN_MIRKWOOD_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH
    ],
    continuityNote: 'Retracing the central Mirkwood corridor southward, the mossy Runic Waystone of Mirkwood Crossroads comes back into view beside the junction.',
    horizonHint: 'Ahead South: Beyond the forest eaves, the warm torchlight of Oakhaven North Gate [7,6] glimmers down the frontier road.'
  },
  '7,5->7,6': {
    corridorKey: 'NORTHERN_MIRKWOOD_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Emerging from beneath the dark Mirkwood canopy, you step back onto the open gatehouse road before the torchlit timber palisades of Oakhaven North Gate.',
    horizonHint: 'Ahead South: Through the open timber gatehouse arch lies the safe cobblestone thoroughfare of Oakhaven Sanctuary [7,7].'
  },
  '7,6->7,7': {
    corridorKey: 'NORTHERN_MIRKWOOD_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SANCTUARY_ARRIVAL,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Passing south through the iron-strapped North Gate, the familiar cobblestones and warm watchfires of Oakhaven Sanctuary welcome your return.',
    horizonHint: 'Inside Oakhaven Sanctuary [7,7]: Safe within the timber palisades; gates lead North to Mirkwood, East to the Stone Bridge, and South to the Fen.'
  },

  // Eastern Bridge & Watchpost Corridor (Outbound East)
  '7,7->8,7': {
    corridorKey: 'EASTERN_BRIDGE_WATCHPOST_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping east through Oakhaven’s River Gate, your boots ring against the wet flagstones of The Old Stone Bridge high above the churning Blackwater gorge.',
    horizonHint: 'Ahead East: Across the weathered stone span rises the ivy-draped Gothic archway of Bridge East Watchpost [9,7].'
  },
  '8,7->9,7': {
    corridorKey: 'EASTERN_BRIDGE_WATCHPOST_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Crossing the eastern arch of The Old Stone Bridge, you pass directly beneath the pointed Gothic gateway into the ruined shell of Bridge East Watchpost.',
    horizonHint: 'Ahead East: Past the collapsed watchtower masonry, an overgrown imperial road opens onto the windswept Verdant Plains [10,7].'
  },
  '9,7->10,7': {
    corridorKey: 'EASTERN_BRIDGE_WATCHPOST_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping east beyond the crumbled walls of Bridge East Watchpost, the cold river mist gives way to the open winds of the eastern frontier plains.',
    horizonHint: 'Ahead East: Wide frontier grasslands roll toward the distant coastal cliffs of the Murksea.'
  },

  // Eastern Bridge & Watchpost Corridor (Return West)
  '10,7->9,7': {
    corridorKey: 'EASTERN_BRIDGE_WATCHPOST_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Following the overgrown imperial road west from the plains, you re-enter the shattered stone walls of Bridge East Watchpost above the river gorge.',
    horizonHint: 'Ahead West: Through the ivy-draped Gothic arch, The Old Stone Bridge [8,7] spans the Blackwater back toward Oakhaven.'
  },
  '9,7->8,7': {
    corridorKey: 'EASTERN_BRIDGE_WATCHPOST_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping west through the ruined toll-keep archway, you return onto the flagstone roadway of The Old Stone Bridge with Oakhaven’s torches glowing on the far bank.',
    horizonHint: 'Ahead West: Twin brazier watchtowers flank Oakhaven’s Eastern River Gate [7,7] at the western end of the span.'
  },
  '8,7->7,7': {
    corridorKey: 'EASTERN_BRIDGE_WATCHPOST_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SANCTUARY_ARRIVAL,
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Leaving the cold spray of The Old Stone Bridge behind, you pass between the twin brazier watchtowers back into the safety of Oakhaven Sanctuary.',
    horizonHint: 'Inside Oakhaven Sanctuary [7,7]: Warm watchfires burn along the cobblestone lanes within the timber palisade.'
  },

  // Southern Rotting Fen Corridor
  '7,7->7,8': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Walking south down Oakhaven’s storehouse lane, you reach the Fen-Ward South Gate where greenish marsh fog coils against the lower palisade timbers.',
    horizonHint: 'Ahead South: Beyond the gate posts, a slick plank-and-mud causeway descends into the weeping willow bogs of the Rotting Fen [7,9].'
  },
  '7,8->7,9': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping south from the Fen-Ward Gatehouse, firm road gives way to creaking sunken timbers and black peat water as you enter the Rotting Fen.',
    horizonHint: 'Ahead South-West: Crooked warning posts and half-submerged boardwalks wind deeper toward Deadman’s Mire [4,11].'
  },
  '7,9->7,8': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Climbing north out of the stagnant marsh water, you regain the firmer causeway before Oakhaven’s Fen-Ward South Gate.',
    horizonHint: 'Ahead North: Warm lantern light glows inside Oakhaven Sanctuary [7,7] just beyond the southern gatehouse.'
  },
  '7,8->7,7': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SANCTUARY_ARRIVAL,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping north through the Fen-Ward South Gate, you leave the damp smell of peat behind and return to Oakhaven Sanctuary.',
    horizonHint: 'Inside Oakhaven Sanctuary [7,7]: Safe within the fortified palisades and central watchfire.'
  },
  '7,9->6,9': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Bearing west from the southern gate causeway, your boots squelch along a narrow peat embankment between stagnant black mire pools.',
    horizonHint: 'Ahead South: The half-sunken timber planks and broken lantern post of the Rotting Fen Boardwalk [6,10] emerge from the marsh fog.'
  },
  '6,9->6,10': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping south onto the creaking oak planks of the Rotting Fen Boardwalk, weeping bog-willows and a tilted iron lantern post frame the drowned causeway.',
    horizonHint: 'Ahead West: The sunken boardwalk winds westward across the central marsh [5,10] toward the drowned ruins of Deadman’s Mire [4,11].'
  },
  '6,10->5,10': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Following the decaying timber causeway west from the lantern post, greenish marsh miasma drifts across the black water channels.',
    horizonHint: 'Ahead West: The western fen junction [4,10] leads directly south to the sunken Gothic arches of Deadman’s Mire [4,11].'
  },
  '5,10->4,10': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH
    ],
    continuityNote: 'Advancing west to the outer mire approach, tilted stone obelisks and drowned temple masonry begin to loom through the southern swamp fog.',
    horizonHint: 'Ahead South: The sunken Gothic temple ruins of Deadman’s Mire [4,11] rise from the black bog water just ahead.'
  },
  '4,10->4,11': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Wading south onto the flooded flagstones of Deadman’s Mire, tilted Gothic arches and half-submerged carved pillars surround you in the stagnant gloom.',
    horizonHint: 'At Deadman’s Mire [4,11]: Sunken sanctuary ruins; the timber causeway back to Oakhaven runs North and East.'
  },
  '4,11->4,10': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping north off the flooded flagstones of Deadman’s Mire, you regain the outer marsh causeway heading back toward the central fen.',
    horizonHint: 'Ahead East: The sunken timber boardwalk [5,10] leads east toward the Rotting Fen Boardwalk [6,10] and Oakhaven.'
  },
  '4,10->5,10': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Retracing the marsh causeway east from Deadman’s Mire, the drowned Gothic arches fade into the greenish fog behind you.',
    horizonHint: 'Ahead East: The tilted lantern post of the Rotting Fen Boardwalk [6,10] marks the turn north toward Oakhaven.'
  },
  '5,10->6,10': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Returning east onto the Rotting Fen Boardwalk, the familiar weeping bog-willows and broken iron lantern post rise beside the plank path.',
    horizonHint: 'Ahead North: The northern peat bank [6,9] connects back to the Fen-Ward South Gate causeway [7,8].'
  },
  '6,10->6,9': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Leaving the sunken willow boardwalk behind, you climb north onto the firmer peat embankment near the northern edge of the marsh.',
    horizonHint: 'Ahead East: The southern gate causeway [7,9] leads straight north into Oakhaven’s Fen-Ward South Gate [7,8].'
  },
  '6,9->7,9': {
    corridorKey: 'SOUTHERN_ROTTING_FEN_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE,
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH
    ],
    continuityNote: 'Stepping east onto the main southern causeway, the timber watchtowers and warm braziers of Oakhaven’s Fen-Ward South Gate rise ahead to the north.',
    horizonHint: 'Ahead North: Oakhaven’s Fen-Ward South Gate [7,8] stands open above the marsh border.'
  },

  // Western Raven Crags Corridor
  '5,5->4,5': {
    corridorKey: 'WESTERN_RAVEN_CRAGS_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Leaving the western eaves of Mirkwood behind, the mossy forest floor gives way to shattered grey slate and wind-bent heather ascending into Raven Crags.',
    horizonHint: 'Ahead West: High on the highland ravine crest stands the dry-stacked Sentinel Cairn of Raven Crags [3,5].'
  },
  '4,5->3,5': {
    corridorKey: 'WESTERN_RAVEN_CRAGS_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Climbing the narrow highland slate ravine, you reach the wind-scoured crest beside the ancient Sentinel Cairn of Raven Crags.',
    horizonHint: 'At Raven Crags Sentinel Cairn [3,5]: Ravens circle the dark slate monument overlooking the western mountain defile.'
  },
  '3,5->4,5': {
    corridorKey: 'WESTERN_RAVEN_CRAGS_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Stepping east away from the Sentinel Cairn, you descend the cracked slate ridge back toward the eastern foothills and Mirkwood.',
    horizonHint: 'Ahead East: The dark fir and oak eaves of western Mirkwood [5,5] rise below the highland slope.'
  },
  '4,5->5,5': {
    corridorKey: 'WESTERN_RAVEN_CRAGS_CORRIDOR',
    primaryContext: TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
    matchedContexts: [
      TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING,
      TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE
    ],
    continuityNote: 'Descending the rocky highland steps from Raven Crags, you cross back beneath the mossy boughs of western Mirkwood.',
    horizonHint: 'Ahead East: Stonefang Crag [6,5] bars direct eastern passage; detour north or south around the monolith.'
  }
};

// Active SQLite database reference bound during initSceneCatalogTables(db) or explicit calls
let activeSandboxDb = null;

// Per-DB continuity state cache so multiple in-memory test DBs never collide
const continuityStoreByDb = new WeakMap();
const fallbackContinuityStore = new Map();

function getStoreForDb(db = null) {
  const targetDb = db || activeSandboxDb;
  if (targetDb && typeof targetDb === 'object') {
    if (!continuityStoreByDb.has(targetDb)) {
      continuityStoreByDb.set(targetDb, new Map());
    }
    return continuityStoreByDb.get(targetDb);
  }
  return fallbackContinuityStore;
}

function bindTravelContinuityDb(db) {
  if (db && typeof db.prepare === 'function') {
    activeSandboxDb = db;
  }
  return activeSandboxDb;
}

function getBoundTravelContinuityDb() {
  return activeSandboxDb;
}

function initTravelContinuityTables(db) {
  if (!db || typeof db.exec !== 'function') return;
  bindTravelContinuityDb(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lab_adventure_state (
      character_id TEXT PRIMARY KEY,
      expedition_key TEXT NOT NULL DEFAULT 'MIRKWOOD_EXPEDITION',
      enabled INTEGER NOT NULL DEFAULT 1,
      deterministic_seed INTEGER NOT NULL DEFAULT 4201,
      step_counter INTEGER NOT NULL DEFAULT 0,
      facing TEXT NOT NULL DEFAULT 'NORTH',
      current_x INTEGER NOT NULL DEFAULT 7,
      current_y INTEGER NOT NULL DEFAULT 7,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lab_travel_continuity (
      character_id TEXT PRIMARY KEY,
      current_x INTEGER NOT NULL DEFAULT 7,
      current_y INTEGER NOT NULL DEFAULT 7,
      facing TEXT NOT NULL DEFAULT 'NORTH',
      transition_context TEXT NOT NULL DEFAULT 'INITIAL_POSITION',
      revisit_status TEXT NOT NULL DEFAULT 'FIRST_VISIT',
      corridor_key TEXT DEFAULT NULL,
      continuity_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function clearInMemoryTravelCache(db = null) {
  const targetDb = db || activeSandboxDb;
  if (targetDb && continuityStoreByDb.has(targetDb)) {
    continuityStoreByDb.get(targetDb).clear();
  }
  fallbackContinuityStore.clear();
}

function normalizeFacing(facing) {
  const upper = String(facing || 'NORTH').toUpperCase().trim();
  return FACING_ORDER.includes(upper) ? upper : 'NORTH';
}

function rotateFacing(currentFacing, turn) {
  const norm = normalizeFacing(currentFacing);
  const idx = FACING_ORDER.indexOf(norm);
  const normalizedTurn = String(turn || '').toUpperCase().trim();
  if (normalizedTurn === 'LEFT' || normalizedTurn === 'CCW') {
    return FACING_ORDER[(idx + 3) % 4];
  }
  if (normalizedTurn === 'RIGHT' || normalizedTurn === 'CW') {
    return FACING_ORDER[(idx + 1) % 4];
  }
  if (normalizedTurn === 'AROUND' || normalizedTurn === '180' || normalizedTurn === 'BACK') {
    return FACING_ORDER[(idx + 2) % 4];
  }
  if (FACING_ORDER.includes(normalizedTurn)) {
    return normalizedTurn;
  }
  return norm;
}

function getRelativeCardinalMap(facing) {
  const norm = normalizeFacing(facing);
  const idx = FACING_ORDER.indexOf(norm);
  return {
    FORWARD: FACING_ORDER[idx],
    AHEAD: FACING_ORDER[idx],
    RIGHT: FACING_ORDER[(idx + 1) % 4],
    STRAFE_RIGHT: FACING_ORDER[(idx + 1) % 4],
    BACKWARD: FACING_ORDER[(idx + 2) % 4],
    BEHIND: FACING_ORDER[(idx + 2) % 4],
    LEFT: FACING_ORDER[(idx + 3) % 4],
    STRAFE_LEFT: FACING_ORDER[(idx + 3) % 4]
  };
}

function inferMoveKind(fromCoord, toCoord, facing) {
  if (!fromCoord || !toCoord) return 'INITIAL';
  const fx = Number(fromCoord.x);
  const fy = Number(fromCoord.y);
  const tx = Number(toCoord.x);
  const ty = Number(toCoord.y);
  const dx = tx - fx;
  const dy = ty - fy;

  if (dx === 0 && dy === 0) return 'TURN_IN_PLACE';
  if (Math.abs(dx) + Math.abs(dy) > 1) return 'TELEPORT';

  const rel = getRelativeCardinalMap(facing);
  for (const [relKey, cardDir] of [
    ['FORWARD', rel.FORWARD],
    ['BACKWARD', rel.BACKWARD],
    ['STRAFE_LEFT', rel.STRAFE_LEFT],
    ['STRAFE_RIGHT', rel.STRAFE_RIGHT]
  ]) {
    const vec = FACING_VECTORS[cardDir];
    if (vec && vec.dx === dx && vec.dy === dy) {
      return relKey;
    }
  }
  return 'FORWARD';
}

function resolveCorridorForCoord(x, y) {
  const coord = `${Number(x)},${Number(y)}`;
  for (const corridor of Object.values(NAMED_CORRIDORS)) {
    const idx = corridor.orderedCoords.indexOf(coord);
    if (idx !== -1) {
      return {
        ...corridor,
        stepIndex: idx,
        totalSteps: corridor.orderedCoords.length
      };
    }
  }
  return null;
}

function resolveSharedCorridor(fromX, fromY, toX, toY) {
  const c1 = `${Number(fromX)},${Number(fromY)}`;
  const c2 = `${Number(toX)},${Number(toY)}`;
  for (const corridor of Object.values(NAMED_CORRIDORS)) {
    const i1 = corridor.orderedCoords.indexOf(c1);
    const i2 = corridor.orderedCoords.indexOf(c2);
    if (i1 !== -1 && i2 !== -1) {
      return {
        ...corridor,
        fromIndex: i1,
        toIndex: i2,
        isOutbound: i2 > i1,
        isReturn: i2 < i1
      };
    }
  }
  return null;
}

function getLandmarkAt(x, y, tile = null) {
  const coord = `${Number(x)},${Number(y)}`;
  if (WORLD_LANDMARKS[coord]) {
    return WORLD_LANDMARKS[coord];
  }
  if (tile && tile.feature) {
    return {
      coord,
      x: Number(x),
      y: Number(y),
      key: tile.feature,
      name: tile.name || tile.feature,
      shortName: tile.name || tile.feature,
      terrain: tile.terrain || 'WILDERNESS',
      feature: tile.feature,
      isMajorLandmark: true,
      isSanctuary: Boolean(tile.isSafe || tile.is_safe === 1),
      silhouetteCue: `${tile.name || tile.feature}`
    };
  }
  return null;
}

/**
 * Resolves World-Consistent Boundary & Impassable Terrain Guidance
 * Supports:
 *  - `resolveBoundaryGuidance(currentTile, targetTile, facing)`
 *  - `resolveBoundaryGuidance({ currentTile, targetTile, direction, facing, x, y })`
 */
function resolveBoundaryGuidance(currentTileOrOpts, targetTileOrDirection = null, facingArg = 'NORTH') {
  let currentTile = null;
  let targetTile = null;
  let direction = normalizeFacing(facingArg);

  if (currentTileOrOpts && typeof currentTileOrOpts === 'object' && ('targetTile' in currentTileOrOpts || 'currentTile' in currentTileOrOpts)) {
    currentTile = currentTileOrOpts.currentTile || null;
    targetTile = currentTileOrOpts.targetTile || null;
    direction = normalizeFacing(currentTileOrOpts.direction || currentTileOrOpts.facing || facingArg);
  } else {
    currentTile = currentTileOrOpts || null;
    if (typeof targetTileOrDirection === 'string') {
      direction = normalizeFacing(targetTileOrDirection);
    } else if (targetTileOrDirection && typeof targetTileOrDirection === 'object') {
      targetTile = targetTileOrDirection;
      if (targetTile.direction) {
        direction = normalizeFacing(targetTile.direction);
      }
    }
  }

  const vec = FACING_VECTORS[direction] || FACING_VECTORS.NORTH;
  const cx = currentTile && currentTile.x !== undefined ? Number(currentTile.x) : 7;
  const cy = currentTile && currentTile.y !== undefined ? Number(currentTile.y) : 7;
  const tx = targetTile && targetTile.x !== undefined ? Number(targetTile.x) : cx + vec.dx;
  const ty = targetTile && targetTile.y !== undefined ? Number(targetTile.y) : cy + vec.dy;

  const isOutOfBounds = tx < 0 || tx > 14 || ty < 0 || ty > 14 || (targetTile && targetTile.exists === false) || (targetTile && targetTile.terrain === 'VOID');
  const isPassable = !isOutOfBounds && targetTile
    ? Boolean(targetTile.isPassable !== undefined ? targetTile.isPassable : targetTile.is_passable !== 0)
    : false;

  if (isPassable) {
    return {
      isBlocked: false,
      barrierCategory: 'PASSABLE',
      direction,
      targetCoords: { x: tx, y: ty },
      obstacleName: targetTile ? targetTile.name : 'Open Path',
      title: `Passable Route ${vec.label}`,
      narrative: `The route ${vec.label.toLowerCase()} toward ${targetTile ? targetTile.name : 'the frontier'} [${tx},${ty}] is open on foot.`,
      suggestedDetour: null
    };
  }

  // 1. World Map Boundaries (x < 0, x > 14, y < 0, y > 14)
  if (isOutOfBounds) {
    let edgeTitle = 'Boundary of the Known Realm';
    let edgeNarrative = 'An impassable precipice at the edge of the charted frontier bars further travel.';
    let detour = 'Turn back toward the charted valley corridors.';

    if (ty < 0) {
      edgeTitle = 'Northern World Boundary — The Darkmount Wall';
      edgeNarrative = 'Towering, ice-sheathed granite cliffs of the upper Darkmount Range rise straight into storm clouds at the northern edge of the realm [Y=0], impossible to scale.';
      detour = 'Head SOUTH back down the northern mountain passes toward Mirkwood and Oakhaven.';
    } else if (ty > 14) {
      edgeTitle = 'Southern World Boundary — Abyssal Mire';
      edgeNarrative = 'Beyond the southern boundary [Y=14], all solid earth dissolves into a bottomless, bubbling pitch-black quagmire that swallows timber and stone alike.';
      detour = 'Turn NORTH onto the firmer sunken boardwalks of the Rotting Fen.';
    } else if (tx > 14) {
      edgeTitle = 'Eastern World Boundary — The Murksea Abyss';
      edgeNarrative = 'At the eastern edge of the realm [X=14], sheer basalt sea-cliffs drop straight into the freezing, storm-lashed swells of the Murksea.';
      detour = 'Head WEST inland across the coastal heath toward Bridge East Watchpost and Oakhaven.';
    } else if (tx < 0) {
      edgeTitle = 'Western World Boundary — Razor Crag Chasms';
      edgeNarrative = 'Jagged highland chasms and unbroken granite walls along the western border [X=0] cut off any passage further west.';
      detour = 'Turn EAST back into the highland trails of Raven Crags.';
    }

    return {
      isBlocked: true,
      barrierCategory: 'WORLD_EDGE',
      direction,
      targetCoords: { x: tx, y: ty },
      obstacleName: (targetTile && targetTile.name) || 'Edge of the World',
      title: edgeTitle,
      narrative: edgeNarrative,
      suggestedDetour: detour
    };
  }

  const terrain = String((targetTile && targetTile.terrain) || 'MOUNTAINS').toUpperCase();
  const obsName = (targetTile && targetTile.name) || terrain;

  // 2. Mountain Barriers (Stonefang Crag [6,5] & Darkmount Peaks)
  if (terrain === 'MOUNTAINS') {
    if (tx === 6 && ty === 5) {
      return {
        isBlocked: true,
        barrierCategory: 'MOUNTAINS',
        direction,
        targetCoords: { x: tx, y: ty },
        obstacleName: 'Stonefang Crag',
        title: 'Blocked by Stonefang Crag [6,5]',
        narrative: 'The sheer black granite fang of Stonefang Crag thrusts vertically out of the forest floor ahead. No foothold or goat-track scales its vertical rock face.',
        suggestedDetour: 'Skirt around Stonefang Crag via Mirkwood Crossroads [7,5] to the east or the woodland pass [5,5] to the west.'
      };
    }
    return {
      isBlocked: true,
      barrierCategory: 'MOUNTAINS',
      direction,
      targetCoords: { x: tx, y: ty },
      obstacleName: obsName,
      title: `Blocked by ${obsName} [${tx},${ty}]`,
      narrative: `A towering wall of jagged dark granite and shattered talus at ${obsName} [${tx},${ty}] blocks all passage on foot to the ${vec.label.toLowerCase()}.`,
      suggestedDetour: 'Follow the lower highland valleys or forest trails where the crags open into passable ravines.'
    };
  }

  // 3. River Barriers (Blackwater River [8,6], [8,8], etc.)
  if (terrain === 'RIVER_LAKE') {
    return {
      isBlocked: true,
      barrierCategory: 'RIVER',
      direction,
      targetCoords: { x: tx, y: ty },
      obstacleName: obsName,
      title: `Blocked by ${obsName} [${tx},${ty}]`,
      narrative: `Deep, furiously churning black waters of ${obsName} [${tx},${ty}] crash against slick stone banks to the ${vec.label.toLowerCase()}, far too swift and freezing to ford on foot.`,
      suggestedDetour: 'Use The Old Stone Bridge at [8,7] between Oakhaven Sanctuary [7,7] and Bridge East Watchpost [9,7] to cross the Blackwater River safely.'
    };
  }

  // 4. Ocean Barriers (The Murksea)
  if (terrain === 'OCEAN' || terrain === 'COAST' || terrain === 'AQUATIC') {
    return {
      isBlocked: true,
      barrierCategory: 'OCEAN',
      direction,
      targetCoords: { x: tx, y: ty },
      obstacleName: obsName,
      title: `Blocked by ${obsName} [${tx},${ty}]`,
      narrative: `Sheer coastal basalt cliffs drop into the freezing black ocean swells of ${obsName} [${tx},${ty}] to the ${vec.label.toLowerCase()}.`,
      suggestedDetour: 'Follow the coastal ridge north or south, or head west along the frontier road toward Oakhaven.'
    };
  }

  // 5. Impassable Swamp / Bottomless Mire
  if (terrain === 'SWAMP') {
    return {
      isBlocked: true,
      barrierCategory: 'MIRE',
      direction,
      targetCoords: { x: tx, y: ty },
      obstacleName: obsName,
      title: `Blocked by ${obsName} [${tx},${ty}]`,
      narrative: `Rope-lashed wooden warning stakes mark where solid earth ends and the lethal, bubbling peat quagmire of ${obsName} [${tx},${ty}] begins.`,
      suggestedDetour: 'Keep to the sunken timber boardwalks and firmer causeways further north in the Rotting Fen.'
    };
  }

  return {
    isBlocked: true,
    barrierCategory: 'WALL',
    direction,
    targetCoords: { x: tx, y: ty },
    obstacleName: obsName,
    title: `Blocked by ${obsName} [${tx},${ty}]`,
    narrative: `${obsName} [${tx},${ty}] forms an impassable physical barrier to the ${vec.label.toLowerCase()}.`,
    suggestedDetour: 'Choose an open cardinal direction to continue your journey.'
  };
}

const getBoundaryGuidance = resolveBoundaryGuidance;

/**
 * Computes 4-Direction Compass & Landmark Context (`ahead`, `left`, `right`, `behind`)
 * Guarantees directional landmarks and relative vista descriptions rotate coherently across N/E/S/W.
 */
function computeDirectionalCompassContext(currentTile, neighbors = {}, facing = 'NORTH') {
  const normFacing = normalizeFacing(facing);
  const relMap = getRelativeCardinalMap(normFacing);
  const cx = currentTile && currentTile.x !== undefined ? Number(currentTile.x) : 7;
  const cy = currentTile && currentTile.y !== undefined ? Number(currentTile.y) : 7;
  const currentLandmark = getLandmarkAt(cx, cy, currentTile);

  // Normalize neighbor lookup whether passed as { ahead, left, right, behind }, { ahead1, left1, right1, behind1 }, or { NORTH, EAST, SOUTH, WEST }
  const byCardinal = {};
  if (neighbors.NORTH || neighbors.EAST || neighbors.SOUTH || neighbors.WEST) {
    for (const dir of FACING_ORDER) {
      byCardinal[dir] = neighbors[dir] || null;
    }
  } else {
    byCardinal[relMap.FORWARD] = neighbors.ahead || neighbors.ahead1 || null;
    byCardinal[relMap.STRAFE_LEFT] = neighbors.left || neighbors.left1 || null;
    byCardinal[relMap.STRAFE_RIGHT] = neighbors.right || neighbors.right1 || null;
    byCardinal[relMap.BACKWARD] = neighbors.behind || neighbors.behind1 || null;
  }

  function describeNeighborSlot(relativeSlot, cardinalDir) {
    const vec = FACING_VECTORS[cardinalDir];
    let tile = byCardinal[cardinalDir];
    const tx = tile && tile.x !== undefined ? Number(tile.x) : cx + vec.dx;
    const ty = tile && tile.y !== undefined ? Number(tile.y) : cy + vec.dy;
    const isOut = tx < 0 || tx > 14 || ty < 0 || ty > 14 || (tile && tile.exists === false);
    if (!tile && !isOut && activeSandboxDb && typeof activeSandboxDb.prepare === 'function') {
      try {
        const dbRow = activeSandboxDb.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ? LIMIT 1').get(tx, ty);
        if (dbRow) {
          tile = {
            ...dbRow,
            isPassable: dbRow.is_passable === 1,
            isSafe: dbRow.is_safe === 1,
            exists: true
          };
        }
      } catch (_err) {
        // Ignore DB lookup errors
      }
    }
    const isPassable = !isOut && tile
      ? Boolean(tile.isPassable !== undefined ? tile.isPassable : tile.is_passable !== 0)
      : false;
    const landmark = !isOut ? getLandmarkAt(tx, ty, tile) : null;
    const tileName = isOut
      ? 'Edge of the World'
      : ((tile && tile.name) || (landmark && landmark.name) || 'Frontier');
    const terrain = isOut ? 'VOID' : ((tile && tile.terrain) || (landmark && landmark.terrain) || 'PLAINS');
    const boundary = !isPassable ? resolveBoundaryGuidance(currentTile, tile || { x: tx, y: ty, exists: !isOut }, cardinalDir) : null;

    let vistaText = '';
    if (!isPassable) {
      vistaText = landmark && landmark.silhouetteCue
        ? `Blocked (${vec.label}): ${landmark.silhouetteCue} [${tx},${ty}]`
        : `Blocked (${vec.label}): ${tileName} (${terrain}) [${tx},${ty}]`;
    } else if (landmark) {
      vistaText = `Open (${vec.label}): Toward ${landmark.name} [${tx},${ty}] — ${landmark.silhouetteCue}`;
    } else {
      vistaText = `Open (${vec.label}): ${tileName} (${terrain}) [${tx},${ty}]`;
    }

    return {
      relativeSlot,
      cardinal: cardinalDir,
      cardinalLabel: vec.label,
      cardinalShort: vec.short,
      x: tx,
      y: ty,
      coord: `${tx},${ty}`,
      tileName,
      terrain,
      isPassable,
      isBlocked: !isPassable,
      isLandmark: Boolean(landmark && landmark.isMajorLandmark),
      landmarkKey: landmark ? landmark.key : null,
      landmarkName: landmark ? landmark.name : null,
      silhouetteCue: landmark ? landmark.silhouetteCue : null,
      vistaText,
      boundaryGuidance: boundary
    };
  }

  const relativeVistas = {
    ahead: describeNeighborSlot('ahead', relMap.FORWARD),
    left: describeNeighborSlot('left', relMap.STRAFE_LEFT),
    right: describeNeighborSlot('right', relMap.STRAFE_RIGHT),
    behind: describeNeighborSlot('behind', relMap.BACKWARD)
  };

  const compassRose = {
    NORTH: normFacing === 'NORTH' ? relativeVistas.ahead : (normFacing === 'SOUTH' ? relativeVistas.behind : (normFacing === 'EAST' ? relativeVistas.left : relativeVistas.right)),
    EAST:  normFacing === 'EAST'  ? relativeVistas.ahead : (normFacing === 'WEST'  ? relativeVistas.behind : (normFacing === 'SOUTH' ? relativeVistas.left : relativeVistas.right)),
    SOUTH: normFacing === 'SOUTH' ? relativeVistas.ahead : (normFacing === 'NORTH' ? relativeVistas.behind : (normFacing === 'WEST' ? relativeVistas.left : relativeVistas.right)),
    WEST:  normFacing === 'WEST'  ? relativeVistas.ahead : (normFacing === 'EAST'  ? relativeVistas.behind : (normFacing === 'NORTH' ? relativeVistas.left : relativeVistas.right))
  };

  const orientationSummary = `Facing ${FACING_VECTORS[normFacing].label} at ${(currentTile && currentTile.name) || 'Frontier'} [${cx},${cy}]: Ahead is ${relativeVistas.ahead.tileName} [${relativeVistas.ahead.coord}]; Left (${relativeVistas.left.cardinalShort}) is ${relativeVistas.left.tileName}; Right (${relativeVistas.right.cardinalShort}) is ${relativeVistas.right.tileName}; Behind (${relativeVistas.behind.cardinalShort}) is ${relativeVistas.behind.tileName}.`;

  return {
    facing: normFacing,
    facingLabel: FACING_VECTORS[normFacing].label,
    currentCoord: `${cx},${cy}`,
    currentLandmark: currentLandmark ? currentLandmark.name : null,
    ahead: relativeVistas.ahead,
    left: relativeVistas.left,
    right: relativeVistas.right,
    behind: relativeVistas.behind,
    relativeVistas,
    compassRose,
    orientationSummary
  };
}

/**
 * Resolves Sub-Biome Atmosphere & Lighting Persistence across adjacent tiles
 */
function resolveBiomePersistence(currentTile, aheadTile = null, prevTile = null, facing = 'NORTH', streakCount = 1) {
  const normFacing = normalizeFacing(facing);
  const cx = currentTile && currentTile.x !== undefined ? Number(currentTile.x) : 7;
  const cy = currentTile && currentTile.y !== undefined ? Number(currentTile.y) : 7;
  const terrain = String((currentTile && currentTile.terrain) || 'PLAINS').toUpperCase();

  let subBiomeKey = 'VERDANT_BORDER_PLAINS';
  let subBiomeLabel = 'Verdant Frontier Plains';
  let atmosphereProfile = 'plains-open';
  let lightingTint = 'rgba(180, 165, 125, 0.08)';
  let mistStyle = 'light-haze';

  if (cx === 7 && cy === 7) {
    subBiomeKey = 'OAKHAVEN_SANCTUARY';
    subBiomeLabel = 'Oakhaven Sanctuary Hearth';
    atmosphereProfile = 'sanctuary';
    lightingTint = 'rgba(230, 175, 85, 0.10)';
    mistStyle = 'warm-hearth';
  } else if (cx === 7 && (cy === 6 || cy === 8)) {
    subBiomeKey = 'OAKHAVEN_GATEHOUSE_PERIMETER';
    subBiomeLabel = 'Oakhaven Palisade Threshold';
    atmosphereProfile = 'gatehouse';
    lightingTint = 'rgba(230, 170, 80, 0.10)';
    mistStyle = 'gate-mist';
  } else if (terrain === 'BRIDGE' || (cx === 8 && cy === 7)) {
    subBiomeKey = 'BLACKWATER_GORGE_CROSSING';
    subBiomeLabel = 'Blackwater River Stone Span';
    atmosphereProfile = 'bridge';
    lightingTint = 'rgba(120, 155, 190, 0.10)';
    mistStyle = 'river-mist';
  } else if (terrain === 'UNDERGROUND_RUINS' || (cx === 9 && cy === 7)) {
    subBiomeKey = 'BLACKWATER_WATCHPOST_RUINS';
    subBiomeLabel = 'Ruined River Watchpost';
    atmosphereProfile = 'ruins-exterior';
    lightingTint = 'rgba(130, 145, 175, 0.11)';
    mistStyle = 'river-mist';
  } else if (cx === 7 && cy === 3) {
    subBiomeKey = 'HEART_OF_MIRKWOOD';
    subBiomeLabel = 'Primeval Black Oak Hollow';
    atmosphereProfile = 'ancient-oak';
    lightingTint = 'rgba(185, 140, 70, 0.10)';
    mistStyle = 'deep-forest';
  } else if (terrain === 'FOREST') {
    if (cy <= 4) {
      subBiomeKey = 'DEEP_MIRKWOOD_CANOPY';
      subBiomeLabel = 'Deep Mirkwood Old-Growth';
      atmosphereProfile = 'forest-deep';
      lightingTint = 'rgba(42, 78, 56, 0.12)';
      mistStyle = 'deep-forest';
    } else {
      subBiomeKey = 'MIRKWOOD_BORDER_EAVES';
      subBiomeLabel = 'Mirkwood Southern Eaves';
      atmosphereProfile = 'forest-clearing';
      lightingTint = 'rgba(56, 88, 66, 0.10)';
      mistStyle = 'deep-forest';
    }
  } else if (cx === 4 && cy === 11) {
    subBiomeKey = 'DEADMANS_MIRE_SANCTUARY';
    subBiomeLabel = 'Deadman’s Mire Sunken Temple';
    atmosphereProfile = 'deadmans-mire-override';
    lightingTint = 'rgba(68, 98, 66, 0.14)';
    mistStyle = 'swamp-fog';
  } else if (terrain === 'SWAMP') {
    subBiomeKey = 'ROTTING_FEN_MIRE';
    subBiomeLabel = 'The Rotting Fen Boardwalks';
    atmosphereProfile = 'swamp-mire';
    lightingTint = 'rgba(72, 96, 64, 0.14)';
    mistStyle = 'swamp-fog';
  } else if (terrain === 'JUNGLE') {
    subBiomeKey = 'VENOMOUS_JUNGLE_CANOPY';
    subBiomeLabel = 'Venomous Spore Jungle';
    atmosphereProfile = 'jungle';
    lightingTint = 'rgba(44, 86, 52, 0.14)';
    mistStyle = 'deep-forest';
  } else if (terrain === 'HILLS') {
    subBiomeKey = 'RAVEN_CRAGS_HIGHLANDS';
    subBiomeLabel = 'Raven Crags & Highland Passes';
    atmosphereProfile = 'hills-crag';
    lightingTint = 'rgba(115, 125, 138, 0.11)';
    mistStyle = 'moor-mist';
  } else if (terrain === 'PLAINS' && cx >= 11) {
    subBiomeKey = 'WINDBLOWN_EASTERN_HEATH';
    subBiomeLabel = 'Windblown Frontier Heath';
    atmosphereProfile = 'plains-heath';
    lightingTint = 'rgba(145, 152, 160, 0.09)';
    mistStyle = 'light-haze';
  }

  const prevTerrain = prevTile && prevTile.terrain ? String(prevTile.terrain).toUpperCase() : terrain;
  const persistedBiome = prevTerrain === terrain;

  const aheadTerrain = aheadTile && aheadTile.terrain ? String(aheadTile.terrain).toUpperCase() : null;
  const aheadPassable = aheadTile
    ? Boolean(aheadTile.isPassable !== undefined ? aheadTile.isPassable : aheadTile.is_passable !== 0)
    : false;
  const aheadLandmark = aheadTile && aheadTile.x !== undefined ? getLandmarkAt(aheadTile.x, aheadTile.y, aheadTile) : null;

  let approachingThreshold = false;
  let thresholdHint = null;

  if (aheadTile && aheadPassable && aheadTerrain && aheadTerrain !== terrain) {
    approachingThreshold = true;
    const transitionPair = `${terrain}->${aheadTerrain}`;
    const thresholdDescriptions = {
      'PLAINS->FOREST': `Biome Threshold Ahead (${normFacing}): Cool woodland shadow and resin-scented mist gather along the Mirkwood treeline at ${aheadTile.name || 'the forest edge'}.`,
      'FOREST->PLAINS': `Biome Threshold Ahead (${normFacing}): The dense oak canopy parts ahead, letting pale daylight and open grassland breeze spill onto the trail toward ${aheadTile.name || 'the plains'}.`,
      'PLAINS->SWAMP': `Biome Threshold Ahead (${normFacing}): The track slopes downward into stagnant black water, weeping bog-willows, and greenish fen fog at ${aheadTile.name || 'the marsh edge'}.`,
      'SWAMP->PLAINS': `Biome Threshold Ahead (${normFacing}): The sunken boardwalk climbs out of the mire toward drier grassland footing at ${aheadTile.name || 'the lowland border'}.`,
      'FOREST->HILLS': `Biome Threshold Ahead (${normFacing}): Mossy roots give way to ascending slate ledges and cold highland gusts rising toward ${aheadTile.name || 'Raven Crags'}.`,
      'HILLS->FOREST': `Biome Threshold Ahead (${normFacing}): The rocky crag trail descends straight into the brooding pine-and-oak canopy of ${aheadTile.name || 'Mirkwood'}.`,
      'SWAMP->JUNGLE': `Biome Threshold Ahead (${normFacing}): Humid air and glowing amber-green spores drift from the towering buttress roots of ${aheadTile.name || 'the Venomous Jungle'} ahead.`,
      'JUNGLE->SWAMP': `Biome Threshold Ahead (${normFacing}): Coiled jungle lianas open onto a half-sunken timber boardwalk winding into ${aheadTile.name || 'the Rotting Fen'}.`,
      'CITY->BRIDGE': `Biome Threshold Ahead (${normFacing}): Cold river spray rises beyond Oakhaven’s eastern arch where The Old Stone Bridge spans the Blackwater gorge.`,
      'BRIDGE->UNDERGROUND_RUINS': `Biome Threshold Ahead (${normFacing}): The bridge flagstones lead directly beneath the ivy-choked Gothic arch of ${aheadTile.name || 'Bridge East Watchpost'}.`,
      'UNDERGROUND_RUINS->PLAINS': `Biome Threshold Ahead (${normFacing}): Beyond the crumbled watchtower masonry, the road opens onto the windswept grasslands of ${aheadTile.name || 'the Verdant Plains'}.`
    };
    thresholdHint = thresholdDescriptions[transitionPair]
      || `Biome Threshold Ahead (${normFacing}): ${terrain} transitions into ${aheadTerrain} at ${aheadTile.name || 'the next tile'} [${aheadTile.x},${aheadTile.y}].`;
  } else if (aheadLandmark && aheadLandmark.isMajorLandmark && (!currentTile || aheadLandmark.coord !== `${cx},${cy}`)) {
    approachingThreshold = true;
    thresholdHint = `Landmark Threshold Ahead (${normFacing}): Approaching ${aheadLandmark.name} [${aheadLandmark.coord}] — ${aheadLandmark.silhouetteCue}.`;
  } else if (aheadTile && !aheadPassable) {
    const barrier = resolveBoundaryGuidance(currentTile, aheadTile, normFacing);
    thresholdHint = `Physical Barrier Ahead (${normFacing}): ${barrier.title} — ${barrier.narrative}`;
  }

  return {
    terrain,
    subBiomeKey,
    subBiomeLabel,
    atmosphereProfile,
    lightingTint,
    mistStyle,
    persistedBiome,
    consecutiveStepsInBiome: Math.max(1, Number(streakCount || 1)),
    approachingThreshold,
    thresholdHint
  };
}

/**
 * Evaluates Transition Continuity between `fromState` and `toState`
 */
function evaluateTransitionContinuity(fromState, toState, options = {}) {
  const toTile = toState || { x: 7, y: 7, name: 'Oakhaven Sanctuary', terrain: 'CITY', facing: 'NORTH' };
  const fromTile = fromState || toTile;
  const facing = normalizeFacing(toTile.facing || options.facing || (fromTile && fromTile.facing) || 'NORTH');
  const prevFacing = normalizeFacing((fromTile && fromTile.facing) || options.previousFacing || facing);

  const fx = Number(fromTile.x ?? 7);
  const fy = Number(fromTile.y ?? 7);
  const tx = Number(toTile.x ?? 7);
  const ty = Number(toTile.y ?? 7);

  const aheadTile = options.aheadTile || null;
  const leftTile = options.leftTile || null;
  const rightTile = options.rightTile || null;
  const behindTile = options.behindTile || null;

  const moveKind = options.moveKind || inferMoveKind({ x: fx, y: fy }, { x: tx, y: ty }, facing);
  const stepKey = `${fx},${fy}->${tx},${ty}`;
  const authoredStep = CORRIDOR_STEP_NARRATIVES[stepKey] || null;
  const sharedCorridor = resolveSharedCorridor(fx, fy, tx, ty);
  const activeCorridor = sharedCorridor || resolveCorridorForCoord(tx, ty);
  const fromLandmark = getLandmarkAt(fx, fy, fromTile);
  const toLandmark = getLandmarkAt(tx, ty, toTile);
  const aheadLandmark = aheadTile && aheadTile.x !== undefined ? getLandmarkAt(aheadTile.x, aheadTile.y, aheadTile) : null;

  const matchedContexts = [];
  let primaryContext = TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE;

  if (!fromState || (fx === tx && fy === ty && prevFacing === facing && !options.isExplicitAction)) {
    primaryContext = TRANSITION_CONTEXT_TYPES.INITIAL_POSITION;
    matchedContexts.push(TRANSITION_CONTEXT_TYPES.INITIAL_POSITION);
  } else if (fx === tx && fy === ty && prevFacing !== facing) {
    primaryContext = TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE;
    matchedContexts.push(TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE);
    if (aheadLandmark && aheadLandmark.isMajorLandmark) {
      matchedContexts.push(TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH);
    }
  } else {
    const isRetreat = moveKind === 'BACKWARD' || Boolean(options.isRetreat);
    const isBiomeCrossing = Boolean(fromTile.terrain && toTile.terrain && fromTile.terrain !== toTile.terrain);
    const isApproachingLandmark = Boolean(
      (toLandmark && toLandmark.isMajorLandmark) ||
      (aheadLandmark && aheadLandmark.isMajorLandmark && moveKind === 'FORWARD')
    );
    const isDepartingLandmark = Boolean(fromLandmark && fromLandmark.isMajorLandmark && `${fx},${fy}` !== `${tx},${ty}`);

    if (isRetreat) {
      matchedContexts.push(TRANSITION_CONTEXT_TYPES.RETREAT_STEP);
    }
    if (authoredStep && Array.isArray(authoredStep.matchedContexts)) {
      for (const c of authoredStep.matchedContexts) {
        if (!matchedContexts.includes(c)) matchedContexts.push(c);
      }
    }
    if (sharedCorridor || (fromTile.terrain && toTile.terrain && fromTile.terrain === toTile.terrain)) {
      if (!matchedContexts.includes(TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE)) {
        matchedContexts.push(TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE);
      }
    }
    if (isBiomeCrossing && !matchedContexts.includes(TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING)) {
      matchedContexts.push(TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING);
    }
    if (isApproachingLandmark && !matchedContexts.includes(TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH)) {
      matchedContexts.push(TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH);
    }
    if (isDepartingLandmark && !matchedContexts.includes(TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE)) {
      matchedContexts.push(TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE);
    }

    if (isRetreat) {
      primaryContext = TRANSITION_CONTEXT_TYPES.RETREAT_STEP;
    } else if (authoredStep && authoredStep.primaryContext) {
      primaryContext = authoredStep.primaryContext;
    } else if (toLandmark && toLandmark.isMajorLandmark) {
      primaryContext = TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH;
    } else if (isBiomeCrossing) {
      primaryContext = TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING;
    } else if (isDepartingLandmark && !sharedCorridor) {
      primaryContext = TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE;
    } else {
      primaryContext = TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE;
    }
  }

  const compass = computeDirectionalCompassContext(
    toTile,
    { ahead: aheadTile, left: leftTile, right: rightTile, behind: behindTile },
    facing
  );

  // Build continuityNote & horizonHint
  let continuityNote = '';
  let horizonHint = '';

  if (primaryContext === TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE) {
    continuityNote = `Turned from ${FACING_VECTORS[prevFacing].label} to face ${FACING_VECTORS[facing].label} while standing at ${toTile.name || 'current location'} [${tx},${ty}]. ${compass.relativeVistas.ahead.vistaText}.`;
    horizonHint = compass.relativeVistas.ahead.vistaText;
  } else if (primaryContext === TRANSITION_CONTEXT_TYPES.RETREAT_STEP) {
    continuityNote = `Stepping backward from ${fromTile.name || `[${fx},${fy}]`} to ${toTile.name || `[${tx},${ty}]`} while keeping your eyes fixed ${FACING_VECTORS[facing].label}.`;
    horizonHint = authoredStep ? authoredStep.horizonHint : compass.relativeVistas.ahead.vistaText;
  } else if (authoredStep) {
    continuityNote = authoredStep.continuityNote;
    horizonHint = authoredStep.horizonHint;
  } else if (primaryContext === TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING) {
    continuityNote = `Crossing from ${fromTile.name || fromTile.terrain} [${fx},${fy}] into ${toTile.name || toTile.terrain} [${tx},${ty}], the terrain shifts from ${fromTile.terrain} to ${toTile.terrain}.`;
    horizonHint = compass.relativeVistas.ahead.vistaText;
  } else if (primaryContext === TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH && toLandmark) {
    continuityNote = `Arriving at ${toLandmark.name} [${tx},${ty}] from ${fromTile.name || `[${fx},${fy}]`}, you stand before ${toLandmark.silhouetteCue}.`;
    horizonHint = compass.relativeVistas.ahead.vistaText;
  } else if (primaryContext === TRANSITION_CONTEXT_TYPES.LANDMARK_DEPARTURE && fromLandmark) {
    continuityNote = `Departing ${fromLandmark.name} [${fx},${fy}], you press onward to ${toTile.name || `[${tx},${ty}]`} facing ${FACING_VECTORS[facing].label}.`;
    horizonHint = compass.relativeVistas.ahead.vistaText;
  } else {
    continuityNote = `Advancing ${FACING_VECTORS[facing].label.toLowerCase()} through ${toTile.name || toTile.terrain || 'the frontier'} [${tx},${ty}] along a continuous ${toTile.terrain || 'wilderness'} stretch.`;
    horizonHint = compass.relativeVistas.ahead.vistaText;
  }

  // If facing was rotated away from the corridor's natural axis, ensure horizonHint reflects the actual facing!
  if (aheadTile && authoredStep) {
    const stepDx = tx - fx;
    const stepDy = ty - fy;
    const fVec = FACING_VECTORS[facing];
    if ((stepDx !== 0 || stepDy !== 0) && (fVec.dx !== stepDx || fVec.dy !== stepDy)) {
      horizonHint = compass.relativeVistas.ahead.vistaText;
    }
  }

  const behindHint = `Behind (${compass.relativeVistas.behind.cardinalShort}): ${compass.relativeVistas.behind.tileName} [${compass.relativeVistas.behind.coord}]`;
  const biomePersistence = resolveBiomePersistence(
    toTile,
    aheadTile,
    fromTile,
    facing,
    options.biomeStreakCount || 1
  );

  return {
    fromCoord: `${fx},${fy}`,
    toCoord: `${tx},${ty}`,
    fromFacing: prevFacing,
    facing,
    moveKind,
    transitionContext: primaryContext,
    matchedContexts,
    corridorKey: activeCorridor ? activeCorridor.key : null,
    corridorName: activeCorridor ? activeCorridor.name : null,
    corridor: activeCorridor,
    continuityNote,
    horizonHint,
    behindHint,
    compassContext: compass,
    biomePersistence,
    boundaryGuidance: compass.relativeVistas.ahead.boundaryGuidance || resolveBoundaryGuidance(toTile, aheadTile, facing)
  };
}

/**
 * Computes clear directional and distance objective guidance (`activeObjectiveHint` + `objectiveGuidance`)
 */
function computeActiveObjectiveHint(advState, currentTile, facing = 'NORTH', expDef = null) {
  if (!advState) return { activeObjectiveHint: 'Explore the frontier.', objectiveGuidance: null };
  const normFacing = normalizeFacing(facing);
  const cx = currentTile && currentTile.x !== undefined ? Number(currentTile.x) : 7;
  const cy = currentTile && currentTile.y !== undefined ? Number(currentTile.y) : 7;

  const milestones = (expDef && Array.isArray(expDef.milestones)) ? expDef.milestones : [];
  const completed = Array.isArray(advState.completedMilestones) ? advState.completedMilestones : [];

  if (advState.expeditionCompleted) {
    const doneText = `Expedition Complete — ${expDef ? expDef.title : 'Objective'} fulfilled. You stand safely back at ${currentTile ? currentTile.name : 'Oakhaven Sanctuary'} [${cx},${cy}].`;
    return {
      activeObjectiveHint: doneText,
      objectiveGuidance: {
        hint: doneText,
        isComplete: true,
        isReturnLeg: false,
        targetKey: 'COMPLETED',
        targetLabel: 'Expedition Complete',
        targetCoords: { x: 7, y: 7 },
        manhattanDistance: Math.abs(7 - cx) + Math.abs(7 - cy),
        cardinalDirection: 'HERE',
        relativeDirection: 'HERE'
      }
    };
  }

  const nextMilestone = milestones.slice(1).find(m => !completed.includes(m.key)) || milestones[milestones.length - 1] || null;
  if (!nextMilestone) {
    return {
      activeObjectiveHint: 'Return to Oakhaven Sanctuary [7,7].',
      objectiveGuidance: null
    };
  }

  const tx = Number(nextMilestone.x ?? 7);
  const ty = Number(nextMilestone.y ?? 7);
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.abs(dx) + Math.abs(dy);
  const isReturnLeg = nextMilestone.key === 'RETURN_OAKHAVEN';

  let primaryCardinal = 'HERE';
  if (dist > 0) {
    if (Math.abs(dy) >= Math.abs(dx)) {
      primaryCardinal = dy < 0 ? 'NORTH' : 'SOUTH';
    } else {
      primaryCardinal = dx > 0 ? 'EAST' : 'WEST';
    }
  }

  const relMap = getRelativeCardinalMap(normFacing);
  let relativeDir = 'HERE';
  if (primaryCardinal !== 'HERE') {
    if (primaryCardinal === relMap.FORWARD) relativeDir = 'AHEAD';
    else if (primaryCardinal === relMap.BACKWARD) relativeDir = 'BEHIND';
    else if (primaryCardinal === relMap.STRAFE_LEFT) relativeDir = 'LEFT';
    else if (primaryCardinal === relMap.STRAFE_RIGHT) relativeDir = 'RIGHT';
  }

  let compassComposite = primaryCardinal;
  if (dx !== 0 && dy !== 0) {
    const ns = dy < 0 ? 'NORTH' : 'SOUTH';
    const ew = dx > 0 ? 'EAST' : 'WEST';
    compassComposite = `${ns}-${ew}`;
  }

  let hintText = '';
  if (dist === 0) {
    hintText = `At Objective [${cx},${cy}]: ${nextMilestone.label} — survey the area or inspect nearby landmarks before continuing.`;
  } else if (isReturnLeg) {
    hintText = `Return Objective: Head ${compassComposite} (${relativeDir}, ${dist} tile${dist === 1 ? '' : 's'}) to ${nextMilestone.label}.`;
  } else {
    hintText = `Next Waypoint: Head ${compassComposite} (${relativeDir}, ${dist} tile${dist === 1 ? '' : 's'}) to ${nextMilestone.label}.`;
  }

  return {
    activeObjectiveHint: hintText,
    objectiveGuidance: {
      hint: hintText,
      isComplete: false,
      isReturnLeg,
      stage: nextMilestone.stage,
      targetKey: nextMilestone.key,
      targetLabel: nextMilestone.label,
      targetCoords: { x: tx, y: ty },
      manhattanDistance: dist,
      cardinalDirection: primaryCardinal,
      compassBearing: compassComposite,
      relativeDirection: relativeDir
    }
  };
}

/**
 * Creates a fresh Travel Continuity state record for a character
 */
function createInitialContinuityState(characterId, startTile = null, startFacing = 'NORTH') {
  const sx = startTile && startTile.x !== undefined ? Number(startTile.x) : 7;
  const sy = startTile && startTile.y !== undefined ? Number(startTile.y) : 7;
  const sName = (startTile && startTile.name) || 'Oakhaven Sanctuary';
  const sTerrain = (startTile && startTile.terrain) || 'CITY';
  const normFacing = normalizeFacing(startFacing);
  const coord = `${sx},${sy}`;

  const initialRevisitEntry = {
    coord,
    x: sx,
    y: sy,
    tileName: sName,
    terrain: sTerrain,
    visitCount: 1,
    firstVisitedStep: 0,
    lastVisitedStep: 0,
    lastFacing: normFacing,
    hasLingeringThreat: false,
    hasClearedThreat: false,
    fledMonsterName: null,
    clearedMonsterName: null,
    revisitStatus: sx === 7 && sy === 7 ? REVISIT_STATUS_TYPES.FAMILIAR_SAFE : REVISIT_STATUS_TYPES.FIRST_VISIT
  };

  return {
    characterId: String(characterId || 'default'),
    currentCoord: coord,
    currentX: sx,
    currentY: sy,
    currentTileName: sName,
    currentTerrain: sTerrain,
    facing: normFacing,
    stepCount: 0,
    biomeStreakCount: 1,
    lastMoveKind: 'INITIAL',
    lastTransitionContext: TRANSITION_CONTEXT_TYPES.INITIAL_POSITION,
    lastMatchedContexts: [TRANSITION_CONTEXT_TYPES.INITIAL_POSITION],
    lastContinuityNote: `Positioned at ${sName} [${coord}] facing ${FACING_VECTORS[normFacing].label}.`,
    lastHorizonHint: '',
    breadcrumbTrail: [
      {
        step: 0,
        coord,
        x: sx,
        y: sy,
        tileName: sName,
        terrain: sTerrain,
        facing: normFacing,
        moveKind: 'INITIAL',
        transitionContext: TRANSITION_CONTEXT_TYPES.INITIAL_POSITION
      }
    ],
    tileRevisitMap: {
      [coord]: initialRevisitEntry
    },
    preCombatContext: null,
    lastCombatReturnContext: null
  };
}

function computeTileRevisitStatus(entry, hasPersistentThreatOnTile = false) {
  if (!entry) return REVISIT_STATUS_TYPES.FIRST_VISIT;
  if (entry.hasLingeringThreat || hasPersistentThreatOnTile) {
    return REVISIT_STATUS_TYPES.LINGERING_THREAT_SITE;
  }
  if (entry.hasClearedThreat) {
    return REVISIT_STATUS_TYPES.CLEARED_SITE;
  }
  if (entry.visitCount >= 2 || (entry.x === 7 && entry.y === 7)) {
    return REVISIT_STATUS_TYPES.FAMILIAR_SAFE;
  }
  return REVISIT_STATUS_TYPES.FIRST_VISIT;
}

function buildRevisitBanner(entry, revisitStatus) {
  const tileLabel = entry ? `${entry.tileName || 'Location'} [${entry.coord}]` : 'this tile';
  switch (revisitStatus) {
    case REVISIT_STATUS_TYPES.LINGERING_THREAT_SITE:
      return entry && entry.fledMonsterName
        ? `Lingering Threat at ${tileLabel}: You previously retreated from ${entry.fledMonsterName} here—tread warily.`
        : `Lingering Threat at ${tileLabel}: Unresolved danger still haunts this ground.`;
    case REVISIT_STATUS_TYPES.CLEARED_SITE:
      return entry && entry.clearedMonsterName
        ? `Cleared Ground at ${tileLabel}: You previously defeated ${entry.clearedMonsterName} and secured this stretch of the trail.`
        : `Cleared Ground at ${tileLabel}: You previously secured this location in battle.`;
    case REVISIT_STATUS_TYPES.FAMILIAR_SAFE:
      return `Familiar Ground at ${tileLabel}: Visited ${entry ? entry.visitCount : 2} time${entry && entry.visitCount === 1 ? '' : 's'} on this expedition.`;
    case REVISIT_STATUS_TYPES.FIRST_VISIT:
    default:
      return `First Visit to ${tileLabel}: Freshly charted territory on this expedition.`;
  }
}

function persistContinuityStateToDb(db, characterId, contState) {
  const targetDb = db || activeSandboxDb;
  if (!targetDb || !contState) return;
  try {
    initTravelContinuityTables(targetDb);
    const key = String(characterId || contState.characterId || 'default');
    const curEntry = contState.tileRevisitMap[contState.currentCoord];
    const revStatus = computeTileRevisitStatus(curEntry, false);
    const corridor = resolveCorridorForCoord(contState.currentX, contState.currentY);

    targetDb.prepare(`
      INSERT INTO lab_travel_continuity (
        character_id, current_x, current_y, facing,
        transition_context, revisit_status, corridor_key,
        continuity_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(character_id) DO UPDATE SET
        current_x = excluded.current_x,
        current_y = excluded.current_y,
        facing = excluded.facing,
        transition_context = excluded.transition_context,
        revisit_status = excluded.revisit_status,
        corridor_key = excluded.corridor_key,
        continuity_json = excluded.continuity_json,
        updated_at = excluded.updated_at
    `).run(
      key,
      Number(contState.currentX ?? 7),
      Number(contState.currentY ?? 7),
      normalizeFacing(contState.facing || 'NORTH'),
      contState.lastTransitionContext || TRANSITION_CONTEXT_TYPES.INITIAL_POSITION,
      revStatus,
      corridor ? corridor.key : null,
      JSON.stringify(contState),
      new Date().toISOString()
    );
  } catch (_err) {
    // Non-fatal if DB is read-only or closed
  }
}

function loadContinuityStateFromDb(db, characterId) {
  const targetDb = db || activeSandboxDb;
  if (!targetDb || typeof targetDb.prepare !== 'function') return null;
  try {
    initTravelContinuityTables(targetDb);
    const key = String(characterId || 'default');
    const row = targetDb.prepare('SELECT continuity_json FROM lab_travel_continuity WHERE character_id = ?').get(key);
    if (row && row.continuity_json) {
      return JSON.parse(row.continuity_json);
    }
  } catch (_err) {
    return null;
  }
  return null;
}

function getOrCreateContinuityState(characterId, currentTile = null, facing = null, db = null) {
  const key = String(characterId || 'default');
  const store = getStoreForDb(db);
  if (!store.has(key)) {
    const loaded = loadContinuityStateFromDb(db, key);
    if (loaded) {
      store.set(key, loaded);
    } else {
      const created = createInitialContinuityState(key, currentTile, facing || 'NORTH');
      store.set(key, created);
      persistContinuityStateToDb(db, key, created);
    }
  }
  return store.get(key);
}

function resetTravelContinuityState(characterId, startTile = null, startFacing = 'NORTH', db = null) {
  const key = String(characterId || 'default');
  const store = getStoreForDb(db);
  const fresh = createInitialContinuityState(key, startTile, startFacing);
  store.set(key, fresh);
  persistContinuityStateToDb(db, key, fresh);
  return fresh;
}

/**
 * Records a player step or teleport and updates breadcrumb trail, revisit status, and transition continuity
 */
function recordTravelStep(characterId, stepInput = {}, db = null) {
  const currentTile = stepInput.toTile || stepInput.currentTile || stepInput.tile || { x: 7, y: 7, name: 'Oakhaven Sanctuary', terrain: 'CITY' };
  const facing = normalizeFacing(stepInput.facing || (currentTile && currentTile.facing) || 'NORTH');
  const contState = getOrCreateContinuityState(characterId, currentTile, facing, db);

  const prevTile = stepInput.fromTile || {
    x: contState.currentX,
    y: contState.currentY,
    name: contState.currentTileName,
    terrain: contState.currentTerrain,
    facing: contState.facing
  };

  const tx = Number(currentTile.x ?? 7);
  const ty = Number(currentTile.y ?? 7);
  const nextCoord = `${tx},${ty}`;
  const moveKind = stepInput.moveKind || inferMoveKind({ x: prevTile.x, y: prevTile.y }, { x: tx, y: ty }, facing);

  // Detect immediate retreat / back-step onto the prior breadcrumb
  const priorBreadcrumb = contState.breadcrumbTrail.length >= 2
    ? contState.breadcrumbTrail[contState.breadcrumbTrail.length - 2]
    : null;
  const isRetreat = moveKind === 'BACKWARD' || Boolean(priorBreadcrumb && priorBreadcrumb.coord === nextCoord && moveKind !== 'TELEPORT');

  if (prevTile.terrain === currentTile.terrain && `${prevTile.x},${prevTile.y}` !== nextCoord) {
    contState.biomeStreakCount = (contState.biomeStreakCount || 1) + 1;
  } else if (prevTile.terrain !== currentTile.terrain) {
    contState.biomeStreakCount = 1;
  }

  const transition = evaluateTransitionContinuity(prevTile, { ...currentTile, facing }, {
    facing,
    previousFacing: contState.facing,
    moveKind,
    isRetreat,
    isExplicitAction: true,
    aheadTile: stepInput.aheadTile || null,
    leftTile: stepInput.leftTile || null,
    rightTile: stepInput.rightTile || null,
    behindTile: stepInput.behindTile || null,
    biomeStreakCount: contState.biomeStreakCount
  });

  if (`${prevTile.x},${prevTile.y}` !== nextCoord) {
    contState.stepCount += 1;
  }

  contState.currentCoord = nextCoord;
  contState.currentX = tx;
  contState.currentY = ty;
  contState.currentTileName = currentTile.name || 'Frontier';
  contState.currentTerrain = currentTile.terrain || 'PLAINS';
  contState.facing = facing;
  contState.lastMoveKind = moveKind;
  contState.lastTransitionContext = transition.transitionContext;
  contState.lastMatchedContexts = transition.matchedContexts;
  contState.lastContinuityNote = transition.continuityNote;
  contState.lastHorizonHint = transition.horizonHint;

  // Update tile revisit memory
  const existingEntry = contState.tileRevisitMap[nextCoord];
  if (!existingEntry) {
    contState.tileRevisitMap[nextCoord] = {
      coord: nextCoord,
      x: tx,
      y: ty,
      tileName: currentTile.name || 'Frontier',
      terrain: currentTile.terrain || 'PLAINS',
      visitCount: 1,
      firstVisitedStep: contState.stepCount,
      lastVisitedStep: contState.stepCount,
      lastFacing: facing,
      hasLingeringThreat: Boolean(stepInput.hasPersistentThreat),
      hasClearedThreat: false,
      fledMonsterName: null,
      clearedMonsterName: null,
      revisitStatus: REVISIT_STATUS_TYPES.FIRST_VISIT
    };
  } else {
    if (`${prevTile.x},${prevTile.y}` !== nextCoord) {
      existingEntry.visitCount += 1;
    }
    existingEntry.lastVisitedStep = contState.stepCount;
    existingEntry.lastFacing = facing;
    existingEntry.tileName = currentTile.name || existingEntry.tileName;
    existingEntry.terrain = currentTile.terrain || existingEntry.terrain;
    existingEntry.revisitStatus = computeTileRevisitStatus(existingEntry, Boolean(stepInput.hasPersistentThreat));
  }

  // Append to breadcrumb trail (avoid duplicate consecutive entries on pure re-renders)
  const lastCrumb = contState.breadcrumbTrail[contState.breadcrumbTrail.length - 1];
  if (!lastCrumb || lastCrumb.coord !== nextCoord || lastCrumb.facing !== facing) {
    contState.breadcrumbTrail.push({
      step: contState.stepCount,
      coord: nextCoord,
      x: tx,
      y: ty,
      tileName: currentTile.name || 'Frontier',
      terrain: currentTile.terrain || 'PLAINS',
      facing,
      moveKind,
      transitionContext: transition.transitionContext
    });
    if (contState.breadcrumbTrail.length > 25) {
      contState.breadcrumbTrail.shift();
    }
  }

  persistContinuityStateToDb(db, characterId, contState);
  return {
    continuityState: contState,
    transition,
    revisitEntry: contState.tileRevisitMap[nextCoord]
  };
}

/**
 * Records a 90°/180° rotation in place without advancing step count
 */
function recordTravelRotation(characterId, currentTile, previousFacing, nextFacing, neighbors = {}, db = null) {
  const normPrev = normalizeFacing(previousFacing);
  const normNext = normalizeFacing(nextFacing);
  const contState = getOrCreateContinuityState(characterId, currentTile, normNext, db);

  const transition = evaluateTransitionContinuity(
    { ...currentTile, facing: normPrev },
    { ...currentTile, facing: normNext },
    {
      facing: normNext,
      previousFacing: normPrev,
      moveKind: 'TURN_IN_PLACE',
      isExplicitAction: true,
      aheadTile: neighbors.ahead || neighbors.ahead1 || null,
      leftTile: neighbors.left || neighbors.left1 || null,
      rightTile: neighbors.right || neighbors.right1 || null,
      behindTile: neighbors.behind || neighbors.behind1 || null,
      biomeStreakCount: contState.biomeStreakCount
    }
  );

  contState.facing = normNext;
  contState.lastMoveKind = 'TURN_IN_PLACE';
  contState.lastTransitionContext = TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE;
  contState.lastMatchedContexts = transition.matchedContexts;
  contState.lastContinuityNote = transition.continuityNote;
  contState.lastHorizonHint = transition.horizonHint;

  const coord = `${currentTile.x},${currentTile.y}`;
  if (contState.tileRevisitMap[coord]) {
    contState.tileRevisitMap[coord].lastFacing = normNext;
  }

  const lastCrumb = contState.breadcrumbTrail[contState.breadcrumbTrail.length - 1];
  if (lastCrumb && lastCrumb.coord === coord) {
    lastCrumb.facing = normNext;
    lastCrumb.transitionContext = TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE;
  }

  persistContinuityStateToDb(db, characterId, contState);
  return transition;
}

/**
 * Records combat start and combat outcome transitions (`ENCOUNTER_START`, `VICTORY`, `FLED`, `BYPASSED`, `DEFEAT`),
 * preserving pre-combat exploration context and updating tile revisit memory (`LINGERING_THREAT_SITE` vs `CLEARED_SITE`).
 */
function recordTravelCombatTransition(characterId, eventType, contextData = {}, db = null) {
  const currentTile = contextData.currentTile || { x: 7, y: 5, name: 'Wilderness', terrain: 'FOREST' };
  const facing = normalizeFacing(contextData.facing || 'NORTH');
  const contState = getOrCreateContinuityState(characterId, currentTile, facing, db);
  const tx = Number(currentTile.x ?? contState.currentX ?? 7);
  const ty = Number(currentTile.y ?? contState.currentY ?? 5);
  const coord = `${tx},${ty}`;

  if (!contState.tileRevisitMap[coord]) {
    contState.tileRevisitMap[coord] = {
      coord,
      x: tx,
      y: ty,
      tileName: currentTile.name || 'Wilderness',
      terrain: currentTile.terrain || 'FOREST',
      visitCount: 1,
      firstVisitedStep: contState.stepCount,
      lastVisitedStep: contState.stepCount,
      lastFacing: facing,
      hasLingeringThreat: false,
      hasClearedThreat: false,
      fledMonsterName: null,
      clearedMonsterName: null,
      revisitStatus: REVISIT_STATUS_TYPES.FIRST_VISIT
    };
  }
  const tileEntry = contState.tileRevisitMap[coord];
  const monsterName = contextData.monsterName || 'Unseen Threat';

  if (eventType === 'ENCOUNTER_START') {
    contState.preCombatContext = {
      coord,
      x: tx,
      y: ty,
      tileName: currentTile.name || tileEntry.tileName,
      terrain: currentTile.terrain || tileEntry.terrain,
      facing: contState.facing || facing,
      corridorKey: (resolveCorridorForCoord(tx, ty) || {}).key || null,
      activeDiscoverySnapshot: contextData.activeDiscovery || null,
      activeObjectiveHint: contextData.activeObjectiveHint || null,
      sceneVariantKey: contextData.sceneVariantKey || null,
      stageAnchor: contextData.stageAnchor || null,
      breadcrumbSnapshot: contState.breadcrumbTrail.slice(-6),
      stepAtStart: contState.stepCount
    };
  } else if (eventType === 'VICTORY' || eventType === 'ENCOUNTER_VICTORY') {
    tileEntry.hasClearedThreat = true;
    tileEntry.hasLingeringThreat = false;
    tileEntry.clearedMonsterName = monsterName;
    tileEntry.revisitStatus = REVISIT_STATUS_TYPES.CLEARED_SITE;

    const pre = contState.preCombatContext;
    contState.lastCombatReturnContext = {
      outcome: 'VICTORY',
      monsterName,
      coord,
      x: tx,
      y: ty,
      tileName: currentTile.name || tileEntry.tileName,
      restoredFacing: (pre && pre.facing) || contState.facing || facing,
      restoredCorridorKey: (pre && pre.corridorKey) || (resolveCorridorForCoord(tx, ty) || {}).key || null,
      restoredSceneVariantKey: (pre && pre.sceneVariantKey) || null,
      restoredStageAnchor: (pre && pre.stageAnchor) || null,
      restoredDiscovery: (pre && pre.activeDiscoverySnapshot) || null,
      revisitStatusAfterCombat: REVISIT_STATUS_TYPES.CLEARED_SITE,
      groundedReturnNote: `Victory at ${currentTile.name || tileEntry.tileName} [${coord}]: With ${monsterName} slain, the area is now secured (CLEARED_SITE) and you resume your bearings facing ${(pre && pre.facing) || contState.facing || facing}.`,
      step: contState.stepCount
    };
  } else if (eventType === 'FLED' || eventType === 'ENCOUNTER_FLEE' || eventType === 'BYPASSED') {
    tileEntry.hasLingeringThreat = true;
    tileEntry.fledMonsterName = monsterName;
    tileEntry.revisitStatus = REVISIT_STATUS_TYPES.LINGERING_THREAT_SITE;

    const pre = contState.preCombatContext;
    contState.lastCombatReturnContext = {
      outcome: eventType === 'BYPASSED' ? 'BYPASSED' : 'FLED',
      monsterName,
      coord,
      x: tx,
      y: ty,
      tileName: currentTile.name || tileEntry.tileName,
      restoredFacing: (pre && pre.facing) || contState.facing || facing,
      restoredCorridorKey: (pre && pre.corridorKey) || (resolveCorridorForCoord(tx, ty) || {}).key || null,
      restoredSceneVariantKey: (pre && pre.sceneVariantKey) || null,
      restoredStageAnchor: (pre && pre.stageAnchor) || null,
      restoredDiscovery: (pre && pre.activeDiscoverySnapshot) || null,
      revisitStatusAfterCombat: REVISIT_STATUS_TYPES.LINGERING_THREAT_SITE,
      groundedReturnNote: `Retreated from ${monsterName} at ${currentTile.name || tileEntry.tileName} [${coord}]: This location remains marked as a LINGERING_THREAT_SITE while you regain your bearings facing ${(pre && pre.facing) || contState.facing || facing}.`,
      step: contState.stepCount
    };
  }

  persistContinuityStateToDb(db, characterId, contState);
  return {
    continuityState: contState,
    tileEntry,
    combatReturnContext: contState.lastCombatReturnContext
  };
}

/**
 * Saves both `lab_adventure_state` and `lab_travel_continuity` to SQLite
 */
function saveTravelContextToDb(db, characterId, advState = null, contState = null) {
  const targetDb = db || activeSandboxDb;
  if (!targetDb || typeof targetDb.prepare !== 'function') return false;
  try {
    initTravelContinuityTables(targetDb);
    const key = String(characterId || (advState && advState.characterId) || 'default');
    if (contState) {
      persistContinuityStateToDb(targetDb, key, contState);
    }
    if (advState) {
      const lastCoord = Array.isArray(advState.recentTileHistory) && advState.recentTileHistory.length > 0
        ? advState.recentTileHistory[advState.recentTileHistory.length - 1]
        : '7,7';
      const [cxStr, cyStr] = String(lastCoord).split(',');
      const cx = Number(cxStr || 7);
      const cy = Number(cyStr || 7);
      const facing = normalizeFacing(advState.currentFacing || (contState && contState.facing) || 'NORTH');

      targetDb.prepare(`
        INSERT INTO lab_adventure_state (
          character_id, expedition_key, enabled, deterministic_seed,
          step_counter, facing, current_x, current_y, state_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(character_id) DO UPDATE SET
          expedition_key = excluded.expedition_key,
          enabled = excluded.enabled,
          deterministic_seed = excluded.deterministic_seed,
          step_counter = excluded.step_counter,
          facing = excluded.facing,
          current_x = excluded.current_x,
          current_y = excluded.current_y,
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `).run(
        key,
        advState.expeditionKey || 'MIRKWOOD_EXPEDITION',
        advState.enabled ? 1 : 0,
        Number(advState.deterministicSeed ?? 4201),
        Number(advState.stepCounter ?? 0),
        facing,
        cx,
        cy,
        JSON.stringify(advState),
        new Date().toISOString()
      );
    }
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Restores persisted Adventure & Travel Continuity context from SQLite (`lab_adventure_state` & `lab_travel_continuity`)
 */
function restoreSavedTravelContext(db, characterId) {
  const targetDb = db || activeSandboxDb;
  const key = String(characterId || 'default');
  if (!targetDb || typeof targetDb.prepare !== 'function') {
    return { ok: false, restored: false, characterId: key };
  }

  try {
    initTravelContinuityTables(targetDb);
    const advRow = targetDb.prepare('SELECT * FROM lab_adventure_state WHERE character_id = ?').get(key);
    const contRow = targetDb.prepare('SELECT * FROM lab_travel_continuity WHERE character_id = ?').get(key);

    let restoredAdv = null;
    let restoredCont = null;

    if (advRow && advRow.state_json) {
      restoredAdv = JSON.parse(advRow.state_json);
    }
    if (contRow && contRow.continuity_json) {
      restoredCont = JSON.parse(contRow.continuity_json);
      const store = getStoreForDb(targetDb);
      store.set(key, restoredCont);
    }

    return {
      ok: true,
      restored: Boolean(restoredAdv || restoredCont),
      characterId: key,
      facing: (contRow && contRow.facing) || (advRow && advRow.facing) || 'NORTH',
      currentCoord: contRow ? `${contRow.current_x},${contRow.current_y}` : (advRow ? `${advRow.current_x},${advRow.current_y}` : '7,7'),
      transitionContext: contRow ? contRow.transition_context : null,
      revisitStatus: contRow ? contRow.revisit_status : null,
      adventureState: restoredAdv,
      continuityState: restoredCont
    };
  } catch (_err) {
    return { ok: false, restored: false, characterId: key };
  }
}

/**
 * Builds the complete, client-ready `travelContinuity` payload
 */
function buildTravelContinuityPayload(characterId, currentTile, facing = 'NORTH', viewportScene = null, adventurePayload = null, db = null) {
  const normFacing = normalizeFacing(facing || (viewportScene && viewportScene.facing) || 'NORTH');
  const cx = currentTile && currentTile.x !== undefined ? Number(currentTile.x) : 7;
  const cy = currentTile && currentTile.y !== undefined ? Number(currentTile.y) : 7;
  const coord = `${cx},${cy}`;

  const contState = getOrCreateContinuityState(characterId, currentTile, normFacing, db);

  const aheadTile = viewportScene ? viewportScene.ahead1 : null;
  const leftTile = viewportScene ? viewportScene.left1 : null;
  const rightTile = viewportScene ? viewportScene.right1 : null;
  const behindTile = viewportScene ? viewportScene.behind1 : null;

  // Detect if facing rotated on the same tile since last state build (e.g., via TURN action)
  if (contState.currentCoord === coord && contState.facing !== normFacing) {
    recordTravelRotation(
      characterId,
      currentTile,
      contState.facing,
      normFacing,
      { ahead: aheadTile, left: leftTile, right: rightTile, behind: behindTile },
      db
    );
  } else if (contState.currentCoord !== coord) {
    // Sync position if changed via teleport/scenario
    recordTravelStep(
      characterId,
      {
        toTile: currentTile,
        facing: normFacing,
        aheadTile,
        leftTile,
        rightTile,
        behindTile
      },
      db
    );
  }

  const compassContext = computeDirectionalCompassContext(
    currentTile,
    { ahead: aheadTile, left: leftTile, right: rightTile, behind: behindTile },
    normFacing
  );

  // Re-evaluate live horizon/continuity with full neighbor awareness if needed
  const prevCrumb = contState.breadcrumbTrail.length >= 2
    ? contState.breadcrumbTrail[contState.breadcrumbTrail.length - 2]
    : null;
  const liveTransition = evaluateTransitionContinuity(
    prevCrumb
      ? { x: prevCrumb.x, y: prevCrumb.y, name: prevCrumb.tileName, terrain: prevCrumb.terrain, facing: prevCrumb.facing }
      : { ...currentTile, facing: normFacing },
    { ...currentTile, facing: normFacing },
    {
      facing: normFacing,
      previousFacing: contState.facing,
      moveKind: contState.lastMoveKind,
      isRetreat: contState.lastTransitionContext === TRANSITION_CONTEXT_TYPES.RETREAT_STEP,
      isExplicitAction: contState.stepCount > 0 || contState.lastTransitionContext === TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE,
      aheadTile,
      leftTile,
      rightTile,
      behindTile,
      biomeStreakCount: contState.biomeStreakCount
    }
  );

  const effectiveTransitionContext = contState.lastTransitionContext === TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE
    ? TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE
    : liveTransition.transitionContext;

  const tileEntry = contState.tileRevisitMap[coord] || {
    coord,
    x: cx,
    y: cy,
    tileName: currentTile ? currentTile.name : 'Frontier',
    terrain: currentTile ? currentTile.terrain : 'PLAINS',
    visitCount: 1,
    firstVisitedStep: contState.stepCount,
    lastVisitedStep: contState.stepCount,
    lastFacing: normFacing,
    hasLingeringThreat: false,
    hasClearedThreat: false,
    fledMonsterName: null,
    clearedMonsterName: null
  };
  const hasPersistentThreatOnTile = Boolean(
    (currentTile && currentTile.hasPersistentThreat) ||
    (viewportScene && viewportScene.current && viewportScene.current.hasPersistentThreat)
  );
  const revisitStatus = computeTileRevisitStatus(tileEntry, hasPersistentThreatOnTile);
  tileEntry.revisitStatus = revisitStatus;

  const breadcrumbSummary = contState.breadcrumbTrail
    .slice(-5)
    .map(b => `${b.tileName} [${b.coord}]`)
    .join(' → ');

  const blockedDirections = {};
  for (const dir of FACING_ORDER) {
    const slot = compassContext.compassRose[dir];
    if (slot && slot.isBlocked && slot.boundaryGuidance) {
      blockedDirections[dir] = slot.boundaryGuidance;
    }
  }

  return {
    currentCoord: coord,
    x: cx,
    y: cy,
    tileName: currentTile ? currentTile.name : 'Frontier',
    terrain: currentTile ? currentTile.terrain : 'PLAINS',
    facing: normFacing,
    facingLabel: FACING_VECTORS[normFacing].label,
    moveKind: contState.lastMoveKind,
    transitionContext: effectiveTransitionContext,
    matchedContexts: contState.lastTransitionContext === TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE
      ? [TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE, ...liveTransition.matchedContexts.filter(c => c !== TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE)]
      : liveTransition.matchedContexts,
    continuityNote: contState.lastTransitionContext === TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE
      ? contState.lastContinuityNote
      : liveTransition.continuityNote,
    horizonHint: liveTransition.horizonHint,
    behindHint: liveTransition.behindHint,
    corridorKey: liveTransition.corridorKey,
    corridorName: liveTransition.corridorName,
    corridor: liveTransition.corridor,
    biomePersistence: liveTransition.biomePersistence,
    revisitStatus,
    revisitBanner: buildRevisitBanner(tileEntry, revisitStatus),
    tileMemory: {
      ...tileEntry,
      revisitStatus
    },
    breadcrumbTrail: contState.breadcrumbTrail.slice(),
    breadcrumbSummary,
    compassContext,
    boundaryGuidance: liveTransition.boundaryGuidance,
    blockedDirections,
    preCombatContext: contState.preCombatContext || null,
    combatReturnContext: contState.lastCombatReturnContext || null,
    activeObjectiveHint: adventurePayload ? adventurePayload.activeObjectiveHint : null
  };
}

module.exports = {
  FACING_ORDER,
  FACING_VECTORS,
  TRANSITION_CONTEXT_TYPES,
  REVISIT_STATUS_TYPES,
  WORLD_LANDMARKS,
  NAMED_CORRIDORS,
  CORRIDOR_STEP_NARRATIVES,
  bindTravelContinuityDb,
  getBoundTravelContinuityDb,
  initTravelContinuityTables,
  clearInMemoryTravelCache,
  normalizeFacing,
  rotateFacing,
  getRelativeCardinalMap,
  inferMoveKind,
  resolveCorridorForCoord,
  resolveSharedCorridor,
  getLandmarkAt,
  resolveBoundaryGuidance,
  getBoundaryGuidance,
  computeDirectionalCompassContext,
  resolveBiomePersistence,
  evaluateTransitionContinuity,
  computeActiveObjectiveHint,
  getOrCreateContinuityState,
  resetTravelContinuityState,
  recordTravelStep,
  recordTravelRotation,
  recordTravelCombatTransition,
  saveTravelContextToDb,
  restoreSavedTravelContext,
  buildTravelContinuityPayload
};
