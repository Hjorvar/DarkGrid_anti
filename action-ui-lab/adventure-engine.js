/**
 * DARKGRID — ACTION UI LAB: THE ADVENTURE EXPERIENCE ENGINE (`adventure-engine.js`)
 *
 * Strictly isolated inside `action-ui-lab/`.
 * Provides:
 *  - Phase 3 (4.1–4.5): Expedition Experience Mode (`Current Experience` vs `Adventure Experience`),
 *    18 world-consistent Environmental Discoveries across 3 presentation tiers (`AMBIENT`, `NOTICEABLE`, `IMPORTANT`),
 *    and an anti-oscillation Pacing & Cooldown Engine.
 *  - Phase 4 (5.1–5.3): 3-Tier Exploration Tension & Anticipation (`AMBIENT_TENSION`, `GENUINE_EVIDENCE`, `ENCOUNTER_INTRO`)
 *    with enforced quiet-step intervals.
 *  - Phase 5 (6.1–6.3): Contextual Discovery Choices (2–3 meaningful options per interactive discovery) & Lab-local Adventure Memory.
 *  - Phase 6 (7.1–7.3): Curated Expedition Journal & Exploration Progress tracking.
 *  - Phase 8 (9.1–9.3): Playable Vertical Slices (*The Mirkwood Expedition* & *The Old Stone Bridge & Ruined Watchpost*).
 *  - Phase 9 (10.1–10.3): Gameplay Experiment Director controls & deterministic seed support.
 */

const {
  TRANSITION_CONTEXT_TYPES,
  REVISIT_STATUS_TYPES,
  WORLD_LANDMARKS,
  NAMED_CORRIDORS,
  getBoundTravelContinuityDb,
  initTravelContinuityTables,
  clearInMemoryTravelCache,
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
} = require('./travel-continuity');

const {
  getLatestSceneViewportContext
} = require('./scene-catalog');

const PRESENTATION_TIERS = {
  AMBIENT: {
    tier: 'AMBIENT',
    label: 'Ambient Detail',
    blocksMovement: false,
    autoDismissOnMove: true
  },
  NOTICEABLE: {
    tier: 'NOTICEABLE',
    label: 'Noticeable Discovery',
    blocksMovement: false,
    autoDismissOnMove: true
  },
  IMPORTANT: {
    tier: 'IMPORTANT',
    label: 'Important Discovery',
    blocksMovement: false,
    autoDismissOnMove: true
  }
};

/**
 * 18 Curated, World-Consistent Environmental Discoveries
 * Every discovery is anchored to real map coordinates, terrains, or landmarks so it never
 * contradicts the 15x15 world map or fabricates unverified monster positions.
 */
const DISCOVERY_CATALOG = [
  // ===========================================================================
  // MIRKWOOD FOREST & NORTHERN EXPEDITION CORRIDOR (6 Discoveries)
  // ===========================================================================
  {
    discoveryKey: 'disc_crossroads_frontier_sign',
    title: 'Notched Ranger Tally-Post',
    tier: 'NOTICEABLE',
    icon: '🪵',
    terrain: ['FOREST'],
    exactTiles: [{ x: 7, y: 5 }],
    expeditionKey: 'MIRKWOOD_EXPEDITION',
    shortBanner: 'Beneath the weathered crossroads signpost, fresh ranger tally-notches mark recent patrols into the northern boughs.',
    description: 'Cut into the lower oak post beside the Runic Waystone are seven sharp dagger-notches left by Oakhaven’s border scouts. Three of the marks have been crossed through with black pitch—the frontier signal for a patrol that never returned from the trail toward the Primeval Black Oak.',
    choices: [
      {
        choiceKey: 'decode_notches',
        label: 'Decode the ranger tally marks',
        outcomeTitle: 'Patrol Marks Deciphered',
        outcomeText: 'You read the scout shorthand: the last ranger pair headed north along the central trail [7,4] toward the Black Oak two nights ago, carrying oil-cloth supplies and iron pitons.',
        journalSummary: 'Decoded Oakhaven ranger tally-marks at Mirkwood Crossroads [7,5], confirming a missing scout patrol along the northern trail toward the Black Oak.'
      },
      {
        choiceKey: 'check_mud_ruts',
        label: 'Examine the muddy ruts at the post base',
        outcomeTitle: 'Northbound Boot-Prints Found',
        outcomeText: 'Heavy hobnailed ranger boots pressed deep into the wet earth heading north toward [7,4], while no matching return prints lead back toward Oakhaven’s gate.',
        journalSummary: 'Traced northbound ranger boot-prints from Mirkwood Crossroads [7,5] deeper into the Mirkwood canopy.'
      },
      {
        choiceKey: 'leave_tally_post',
        label: 'Leave the signpost untouched and continue',
        outcomeTitle: 'Left the Crossroads Tally-Post',
        outcomeText: 'You note the warning marks in silence and keep your eyes on the mist-shrouded woodland trail.',
        journalSummary: 'Observed the notched ranger tally-post at Mirkwood Crossroads [7,5] before pressing onward.'
      }
    ]
  },
  {
    discoveryKey: 'disc_mirkwood_abandoned_camp',
    title: 'Abandoned Scout Camp beside the Trail',
    tier: 'IMPORTANT',
    icon: '⛺',
    terrain: ['FOREST'],
    exactTiles: [{ x: 7, y: 4 }],
    expeditionKey: 'MIRKWOOD_EXPEDITION',
    shortBanner: 'A cold stone fire-ring and a torn oil-cloth satchel lie half-hidden among the ferns beside the northern trail.',
    description: 'Nestled against a mossy root-buttress just south of the Primeval Black Oak is a hastily vacated ranger bivouac. The firepit stones are cold and damp, a leather water-flask lies uncorked on the bracken, and pale strands of coarse silk cling to the low branches overhead.',
    choices: [
      {
        choiceKey: 'inspect_campsite',
        label: 'Inspect the campsite & scattered satchel',
        outcomeTitle: 'Scout’s Charcoal Sketch Recovered',
        outcomeText: 'Inside the damp oil-cloth flap you find a charcoal rubbing of the Primeval Black Oak’s root-arch at [7,3], with a note in English: "The amber sap still hums at the northern hollow—something with many eyes watches from the upper boughs."',
        journalSummary: 'Searched the abandoned scout camp on the Mirkwood Trail [7,4] and uncovered a ranger’s charcoal field-note describing the amber-sap hollow beneath the Primeval Black Oak.'
      },
      {
        choiceKey: 'examine_tracks',
        label: 'Examine the tracks & disturbed bracken',
        outcomeTitle: 'Boot-Prints & Arachnid Silk Identified',
        outcomeText: 'Crushed ferns show where the scout backed rapidly away from the canopy before retreating toward the eastern trees. Coarse, dew-beaded anchor silk clings to the bark pointing north toward [7,3].',
        journalSummary: 'Examined disturbed bracken and silk strands at the abandoned camp [7,4], revealing why the scout vacated the trail near the Black Oak.'
      },
      {
        choiceKey: 'leave_camp_alone',
        label: 'Leave the camp undisturbed',
        outcomeTitle: 'Camp Left Undisturbed',
        outcomeText: 'Rather than linger in the exposed clearing, you step quietly past the cold fire-ring with your weapon ready.',
        journalSummary: 'Passed an abandoned ranger bivouac along the Mirkwood Trail [7,4] without disturbing the gear.'
      }
    ]
  },
  {
    discoveryKey: 'disc_ancient_oak_sap_shrine',
    title: 'Warden’s Hollow Beneath the Black Oak',
    tier: 'IMPORTANT',
    icon: '🌳',
    terrain: ['FOREST'],
    exactTiles: [{ x: 7, y: 3 }],
    expeditionKey: 'MIRKWOOD_EXPEDITION',
    shortBanner: 'Between the colossal roots of the Primeval Black Oak, warm amber sap pools around a weathered stone warden-basin.',
    description: 'Deep within the root-arch of the Primeval Black Oak, centuries of luminous amber resin have trickled down the black bark into a carved slate basin. Resting beside the hardened golden pool is a tarnished bronze oath-ring left by Oakhaven’s earliest forest wardens.',
    choices: [
      {
        choiceKey: 'examine_warden_oath',
        label: 'Examine the engraved warden oath-ring',
        outcomeTitle: 'Ancient Warden Inscription Read',
        outcomeText: 'The bronze band bears the words: "SO LONG AS THE AMBER SAP FLOWS AT THE HEART OF MYRKVIÐR, THE NORTH GATE SHALL NOT FALL." You record the inscription in your expedition notes as proof of reaching the heart of the forest.',
        journalSummary: 'Reached the Primeval Black Oak [7,3] and documented the ancient Warden Oath-Ring resting beside the amber-sap basin.'
      },
      {
        choiceKey: 'study_amber_resin',
        label: 'Study the warm amber sap veins',
        outcomeTitle: 'Resin Ward Observed',
        outcomeText: 'Up close, the golden sap radiates a faint, resinous warmth that keeps the creeping marsh-rot and thick cobwebs from choking the hollow directly beneath the trunk.',
        journalSummary: 'Studied the luminous amber sap fissures at the Primeval Black Oak [7,3], noting how the living resin wards the hollow beneath the roots.'
      },
      {
        choiceKey: 'step_back_quietly',
        label: 'Step back from the root-hollow in silence',
        outcomeTitle: 'Honored the Silent Hollow',
        outcomeText: 'You bow your head before the primeval tree and step back onto the mossy trail, leaving the ancient basin untouched.',
        journalSummary: 'Stood beneath the colossal root-arch of the Primeval Black Oak [7,3] and observed the warden hollow in respectful silence.'
      }
    ]
  },
  {
    discoveryKey: 'disc_forest_web_hollow',
    title: 'Silk-Shrouded Cedar Hollow',
    tier: 'NOTICEABLE',
    icon: '🕸️',
    terrain: ['FOREST'],
    minY: 1,
    maxY: 4,
    shortBanner: 'Thick grey webbing spans a split cedar trunk beside the path, trembling faintly in the damp draft.',
    description: 'Sheets of tough, funnel-shaped webbing cloak the interior of a lightning-split cedar. Dry beetle carapaces and small woodland bones hang tangled in the outer threads.',
    choices: [
      {
        choiceKey: 'probe_webbing',
        label: 'Part the outer webbing with your weapon tip',
        outcomeTitle: 'Old Feeding Nest Inspected',
        outcomeText: 'The silk is taut as bowstring, though the hollow itself is currently unoccupied—a hunting shelter used by woodland arachnids during the night watch.',
        journalSummary: 'Investigated a silk-shrouded cedar hollow in the northern Mirkwood, confirming an arachnid hunting shelter.'
      },
      {
        choiceKey: 'bypass_web_hollow',
        label: 'Give the webbed trunk a wide berth',
        outcomeTitle: 'Kept Clear of the Silk',
        outcomeText: 'You step carefully across the mossy roots to avoid brushing the vibration-sensitive anchor strands.',
        journalSummary: 'Circled past a web-choked cedar trunk in the deep Mirkwood without disturbing the silk.'
      }
    ]
  },
  {
    discoveryKey: 'disc_forest_claw_bark',
    title: 'Claw-Scored Sentinel Trunk',
    tier: 'AMBIENT',
    icon: '🐾',
    terrain: ['FOREST'],
    shortBanner: 'Deep parallel claw-gouges scar the damp bark of a leaning pine beside the trail, oozing pale resin.',
    description: 'Something heavy reared against this trunk to sharpen its claws or mark its territory along the forest track.',
    choices: []
  },
  {
    discoveryKey: 'disc_forest_broken_branches',
    title: 'Snapped Underbrush & Crushed Bracken',
    tier: 'AMBIENT',
    icon: '🌿',
    terrain: ['FOREST'],
    shortBanner: 'Snapped hazel saplings and flattened ferns mark where something heavy forced its way through the thicket.',
    description: 'The broken wood at the fracture points is still pale and damp against the dark woodland loam.',
    choices: []
  },

  // ===========================================================================
  // OLD STONE BRIDGE & RUINED WATCHPOST EXPEDITION (4 Discoveries)
  // ===========================================================================
  {
    discoveryKey: 'disc_bridge_parapet_gouges',
    title: 'Breached Parapet & Iron Crampons',
    tier: 'NOTICEABLE',
    icon: '🌉',
    terrain: ['BRIDGE'],
    exactTiles: [{ x: 8, y: 7 }],
    expeditionKey: 'BRIDGE_EXPEDITION',
    shortBanner: 'Along the northern parapet of the Old Stone Bridge, heavy granite capstones have been wrenched outward toward the river gorge.',
    description: 'Deep scrape-marks score the wet limestone ledge where a section of the bridge wall gave way above the churning Blackwater River. Wedged into a mortar crack is a bent iron garrison crampon.',
    choices: [
      {
        choiceKey: 'inspect_parapet_scrapes',
        label: 'Examine the scrape-marks along the parapet',
        outcomeTitle: 'Siege-Hook Scars Identified',
        outcomeText: 'The gouges were not made by river ice; heavy talons or grappling iron once hooked the parapet from the eastern watchpost side.',
        journalSummary: 'Examined the breached parapet on the Old Stone Bridge [8,7], finding deep talon and iron-hook scars above the Blackwater gorge.'
      },
      {
        choiceKey: 'peer_into_gorge',
        label: 'Peer down into the Blackwater torrent below',
        outcomeTitle: 'Submerged Pilings Sighted',
        outcomeText: 'Far below in the white foam, the broken masonry of an older imperial bridge juts from the black current like jagged teeth.',
        journalSummary: 'Surveyed the Blackwater River gorge from the Old Stone Bridge [8,7], spotting the drowned pilings of an older span below.'
      },
      {
        choiceKey: 'cross_bridge_onward',
        label: 'Keep moving across the stone span',
        outcomeTitle: 'Continued Across the Bridge',
        outcomeText: 'You keep to the firm center flagstones as cold river spray drifts across the arch.',
        journalSummary: 'Crossed the Old Stone Bridge [8,7] past the shattered northern parapet.'
      }
    ]
  },
  {
    discoveryKey: 'disc_watchpost_garrison_ledger',
    title: 'Collapsed Toll-Keep Guardroom',
    tier: 'IMPORTANT',
    icon: '🏚️',
    terrain: ['UNDERGROUND_RUINS'],
    exactTiles: [{ x: 9, y: 7 }],
    expeditionKey: 'BRIDGE_EXPEDITION',
    shortBanner: 'Beneath the ivy-draped Gothic arch of the Watchpost, a rusted dispatch cylinder lies wedged under fallen masonry.',
    description: 'Inside the ruined shell of the Bridge East Watchpost, shattered arrow-slits overlook both the river crossing and the eastern plains. Half-buried beneath a cracked lintel stone is a sealed brass garrison cylinder alongside a splintered oak shield bearing Oakhaven’s crest.',
    choices: [
      {
        choiceKey: 'open_dispatch_cylinder',
        label: 'Twist open the brass garrison cylinder',
        outcomeTitle: 'Last Watch-Captain’s Entry Read',
        outcomeText: 'Inside the dry brass tube is the final parchment report of Captain Vane: "We barred the eastern toll-arch at moonrise, but the dead rose from the river cellar beneath our boots. Fall back across the Stone Bridge and seal Oakhaven’s river gate."',
        journalSummary: 'Recovered Captain Vane’s final dispatch cylinder inside the Ruined Bridge East Watchpost [9,7], recounting the fall of the eastern river garrison.'
      },
      {
        choiceKey: 'examine_arch_masonry',
        label: 'Inspect the chisel-cut ward marks on the arch',
        outcomeTitle: 'Masons’ Warning Marks Documented',
        outcomeText: 'Carved into the keystone above the western arch are old frontier chisel-marks warning travelers never to camp inside the lower vault after nightfall.',
        journalSummary: 'Documented protective chisel-marks carved into the Gothic archway of Bridge East Watchpost [9,7].'
      },
      {
        choiceKey: 'leave_watchpost_gear',
        label: 'Leave the fallen garrison relics undisturbed',
        outcomeTitle: 'Left the Guardroom Relics',
        outcomeText: 'You step quietly over the mossy flagstones, leaving the fallen watchmen’s gear where it rests.',
        journalSummary: 'Surveyed the collapsed guardroom at Bridge East Watchpost [9,7] and left the garrison relics undisturbed.'
      }
    ]
  },
  {
    discoveryKey: 'disc_ruins_collapsed_vault',
    title: 'Iron-Grated Cellar Shaft',
    tier: 'NOTICEABLE',
    icon: '🗝️',
    terrain: ['UNDERGROUND_RUINS'],
    shortBanner: 'A rusted iron drainage grate set into the cracked flagstones exhales a damp, metallic draft.',
    description: 'Beneath the rubble-choked floor, a narrow stone stairwell descends into flooded darkness where river water laps against ancient mortar.',
    choices: [
      {
        choiceKey: 'listen_at_grate',
        label: 'Kneel and listen at the iron grate',
        outcomeTitle: 'Subterranean River Echoes Heard',
        outcomeText: 'Through the iron bars you hear the hollow slap of Blackwater river currents echoing through collapsed cellar vaults.',
        journalSummary: 'Listened at the grated cellar shaft in the watchpost ruins, confirming flooded subterranean vaults connected to the river.'
      },
      {
        choiceKey: 'step_away_grate',
        label: 'Step back onto solid flagstones',
        outcomeTitle: 'Stepped Clear of the Grate',
        outcomeText: 'You avoid trusting your weight to the corroded iron bars.',
        journalSummary: 'Noted a corroded cellar grate in the ruins and kept to solid stone.'
      }
    ]
  },
  {
    discoveryKey: 'disc_ruins_broken_weapons',
    title: 'Notched Pike-Heads in the Mortar',
    tier: 'AMBIENT',
    icon: '⚔️',
    terrain: ['UNDERGROUND_RUINS', 'BRIDGE'],
    shortBanner: 'Rusted garrison pike-heads and snapped crossbow bolts lie wedged between the mossy flagstones.',
    description: 'Relics of an old skirmish remain embedded in the stone joints along the crossing.',
    choices: []
  },

  // ===========================================================================
  // ROTTING FEN & DEADMAN'S MIRE EXPEDITION (4 Discoveries)
  // ===========================================================================
  {
    discoveryKey: 'disc_fen_warning_totem',
    title: 'Crooked Peat-Cutter Warning Post',
    tier: 'NOTICEABLE',
    icon: '🏮',
    terrain: ['SWAMP'],
    exactTiles: [{ x: 6, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 10 }],
    expeditionKey: 'ROTTEN_LANDS_EXPEDITION',
    shortBanner: 'A tilting cedar post rises from the black peat-water, bearing a split plank scrawled with faded red ochre.',
    description: 'Driven into the submerged clay beside the drowned boardwalk is a weather-blackened post. Faded lettering warns: "KEEP TO THE SUNKEN TIMBERS — THE MIRE WEST OF THE WILLOWS SWALLOWS IRON AND BONE ALIKE."',
    choices: [
      {
        choiceKey: 'read_reverse_plank',
        label: 'Inspect the carvings on the back of the plank',
        outcomeTitle: 'Mire Bearing Marks Found',
        outcomeText: 'On the sheltered back of the wood, a ranger has scratched a bearing: "South-west to [4,11] lies the Sunken Temple of Deadman’s Mire."',
        journalSummary: 'Examined a peat-cutter warning post in the Rotting Fen, revealing directional bearings toward Deadman’s Mire [4,11].'
      },
      {
        choiceKey: 'check_water_marks',
        label: 'Check the flood-rings on the timber post',
        outcomeTitle: 'Rising Bog Water Confirmed',
        outcomeText: 'Green algae rings show the stagnant fen water has risen nearly two spans higher over the old causeway planks.',
        journalSummary: 'Checked flood-level marks on a Rotting Fen post, confirming the mire waters are steadily rising.'
      },
      {
        choiceKey: 'press_on_fen',
        label: 'Keep moving along the firmer mud',
        outcomeTitle: 'Kept to Firm Footing',
        outcomeText: 'You test the submerged timbers with your boot before taking the next step.',
        journalSummary: 'Passed the peat-cutter warning post in the Rotting Fen.'
      }
    ]
  },
  {
    discoveryKey: 'disc_fen_submerged_gear',
    title: 'Half-Submerged Expedition Pack',
    tier: 'IMPORTANT',
    icon: '🎒',
    terrain: ['SWAMP'],
    minY: 9,
    maxY: 13,
    expeditionKey: 'ROTTEN_LANDS_EXPEDITION',
    shortBanner: 'Caught against a rotting willow root in the black bog water is a waterlogged leather pack beside bleached ribs.',
    description: 'Bubbles of marsh gas rise slowly around a sunken traveler’s pack snagged on the drowned causeway timbers. Nearby, old mud-stained bones rest half-buried in the peat.',
    choices: [
      {
        choiceKey: 'hook_pack_closer',
        label: 'Draw the pack closer with your weapon shaft',
        outcomeTitle: 'Waxed Bog-Chart Fragment Read',
        outcomeText: 'Though the leather is ruined, a waxed linen scrap inside shows soundings around the Sunken Temple at [4,11] and warns of carrion-eaters haunting the willow hummocks.',
        journalSummary: 'Examined a half-submerged pack in the Rotting Fen, uncovering a waxed chart fragment of Deadman’s Mire.'
      },
      {
        choiceKey: 'inspect_bog_bones',
        label: 'Examine the marks on the bleached ribs',
        outcomeTitle: 'Carrion Gnaw-Marks Identified',
        outcomeText: 'Jagged tooth-scores along the bone show scavengers of the fen dragged the remains onto the root-bank long ago.',
        journalSummary: 'Inspected skeletal remains beside the Rotting Fen trail, noting unmistakable carrion-scavenger marks.'
      },
      {
        choiceKey: 'leave_bog_pack',
        label: 'Leave the sunken pack undisturbed',
        outcomeTitle: 'Left the Bog Remains Alone',
        outcomeText: 'You avoid stepping off the causeway into the deep black silt.',
        journalSummary: 'Spotted a half-submerged pack in the Rotting Fen but stayed on firm ground.'
      }
    ]
  },
  {
    discoveryKey: 'disc_mire_drowned_altar',
    title: 'Sunken Chancel of Deadman’s Mire',
    tier: 'IMPORTANT',
    icon: '⛩️',
    terrain: ['SWAMP'],
    exactTiles: [{ x: 4, y: 11 }],
    expeditionKey: 'ROTTEN_LANDS_EXPEDITION',
    shortBanner: 'Between the tilted Gothic arches of Deadman’s Mire, a cracked black-marble altar juts just above the stagnant water.',
    description: 'Standing knee-deep in the flooded sanctuary of Deadman’s Mire, you can see eroded liturgical carvings running along the submerged stone steps. Pale marsh-wisps drift lazily above the drowned nave.',
    choices: [
      {
        choiceKey: 'trace_altar_glyphs',
        label: 'Trace the eroded flood-chronicle glyphs',
        outcomeTitle: 'Drowned Sanctuary Inscription Recorded',
        outcomeText: 'The carved Latinate script names this ruin the Chapel of St. Jude of the Fens, abandoned when the Blackwater burst its southern dike and turned the valley into a bottomless mire.',
        journalSummary: 'Reached the Sunken Temple of Deadman’s Mire [4,11] and recorded the flood-chronicle inscription on its drowned altar.'
      },
      {
        choiceKey: 'watch_crypt_ripples',
        label: 'Study the bubbles rising from the sunken crypt',
        outcomeTitle: 'Submerged Vault Draft Observed',
        outcomeText: 'Cold air and marsh gas bubble up from a collapsed flagstone staircase leading into the drowned crypt beneath the nave.',
        journalSummary: 'Observed submerged crypt steps beneath the flooded nave at Deadman’s Mire [4,11].'
      },
      {
        choiceKey: 'step_back_mire',
        label: 'Retreat to the firmer causeway stones',
        outcomeTitle: 'Stepped Back to Firm Stone',
        outcomeText: 'You step out of the black water onto the higher masonry plinth.',
        journalSummary: 'Surveyed the drowned chancel at Deadman’s Mire [4,11] from the upper flagstones.'
      }
    ]
  },
  {
    discoveryKey: 'disc_swamp_stagnant_ripples',
    title: 'Concentric Ripples in Stagnant Water',
    tier: 'AMBIENT',
    icon: '💧',
    terrain: ['SWAMP', 'JUNGLE'],
    shortBanner: 'Slow rings spread across the oily black water beside the path, though not a breath of wind stirs the reeds.',
    description: 'Whatever disturbed the silt below slipped back beneath the duckweed without breaking the surface.',
    choices: []
  },

  // ===========================================================================
  // VERDANT PLAINS & HIGHLAND CRAGS (4 Discoveries)
  // ===========================================================================
  {
    discoveryKey: 'disc_plains_wayfarer_shrine',
    title: 'Roadside Wayfarer Shrine',
    tier: 'IMPORTANT',
    icon: '🕯️',
    terrain: ['PLAINS'],
    shortBanner: 'A lichen-crusted stone wayfarer niche stands beside the grassland track, sheltering cold tallow stubs.',
    description: 'Erected at an old frontier junction, this low granite shrine holds small iron travel-charms and weather-frayed cloth strips tied by merchants praying for safe passage back to Oakhaven.',
    choices: [
      {
        choiceKey: 'read_travel_charms',
        label: 'Examine the travel-charms inside the niche',
        outcomeTitle: 'Frontier Trade-Route Notes Read',
        outcomeText: 'Scratched onto a tin votive plate is a traveler’s prayer thanking the wardens of Oakhaven for escorting a wagon train safely past the eastern plains.',
        journalSummary: 'Examined a Roadside Wayfarer Shrine on the Verdant Plains, reading the votive notes left by frontier travelers.'
      },
      {
        choiceKey: 'check_plinth_bearings',
        label: 'Read the distance bearings on the stone plinth',
        outcomeTitle: 'Cardinal Milestones Verified',
        outcomeText: 'The base of the shrine marks the leagues toward Oakhaven Sanctuary in the center of the valley, Mirkwood to the north, and the Murksea cliffs to the east.',
        journalSummary: 'Used the carved plinth of a wayside shrine on the plains to verify cardinal bearings across the valley.'
      },
      {
        choiceKey: 'pass_shrine_quietly',
        label: 'Nod respectfully and continue onward',
        outcomeTitle: 'Passed the Wayside Shrine',
        outcomeText: 'You leave the small roadside sanctuary undisturbed as the wind sweeps through the tall grass.',
        journalSummary: 'Passed an old stone wayfarer shrine along the grassland track.'
      }
    ]
  },
  {
    discoveryKey: 'disc_hills_sentinel_remnants',
    title: 'Cold Ranger Signal-Ash on the Ridge',
    tier: 'NOTICEABLE',
    icon: '🔥',
    terrain: ['HILLS'],
    shortBanner: 'Behind a wind-scoured slate outcrop lies a ring of cold signal-ash and stacked dry brush.',
    description: 'Highland lookouts once used this sheltered ledge to light warning beacons whenever movement was spotted descending from the Darkmount Peaks.',
    choices: [
      {
        choiceKey: 'inspect_beacon_ash',
        label: 'Sift the cold ash between the slate stones',
        outcomeTitle: 'Old Watch-Beacon Inspected',
        outcomeText: 'The charcoal is compacted by rain and mountain frost—no watchfire has been lit on this ridge in many weeks.',
        journalSummary: 'Inspected an old ranger signal-beacon site in the highland crags.'
      },
      {
        choiceKey: 'scan_ravine_below',
        label: 'Scan the mist-filled ravine below the ledge',
        outcomeTitle: 'Highland Pass Surveyed',
        outcomeText: 'From the elevated outcrop you command a clear view of the narrow shale trail winding between the crags.',
        journalSummary: 'Used a highland lookout ledge to survey the surrounding ravine pass.'
      }
    ]
  },
  {
    discoveryKey: 'disc_plains_milestone',
    title: 'Tilted Imperial League-Stone',
    tier: 'AMBIENT',
    icon: '🪨',
    terrain: ['PLAINS'],
    shortBanner: 'Half-swallowed by wind-bent grass, a worn granite milestone still bears the chiselled emblem of the old river road.',
    description: 'Lichen fills the weathered numerals carved into its eastern face.',
    choices: []
  },
  {
    discoveryKey: 'disc_hills_animal_tracks',
    title: 'Wolf Pad-Marks in the Shale',
    tier: 'AMBIENT',
    icon: '🐺',
    terrain: ['HILLS', 'PLAINS'],
    shortBanner: 'Sharp-clawed lupine pad-marks cross the damp shale dust where a mountain pack trailed quarry along the ridge.',
    description: 'The prints follow the natural contour of the windbreak before vanishing onto bare rock.',
    choices: []
  }
];

/**
 * Ambient Tension Cues (Tier 1 of Phase 4 Tension Separation)
 * Purely atmospheric unease—never makes false claims about specific monster coordinates.
 */
const AMBIENT_TENSION_BY_TERRAIN = {
  FOREST: [
    'The forest canopy suddenly falls dead silent; even the wind in the black needles ceases.',
    'A damp, resinous draft drifts between the trunks, carrying the scent of old moss and wet fur.',
    'Somewhere high in the mist-choked boughs, a dry branch snaps with a sharp report.'
  ],
  SWAMP: [
    'A sudden ribbon of cold marsh-fog coils across the submerged planks at your boots.',
    'From the reed-beds comes a low, hollow plop—then only the slow spread of oily ripples.',
    'The stagnant air thickens with the coppery tang of disturbed peat and marsh-gas.'
  ],
  UNDERGROUND_RUINS: [
    'A cold draft exhales through the fractured masonry, stirring the dead ivy along the arch.',
    'Loose mortar dust trickles from the keystone overhead, pattering softly onto the flagstones.',
    'From the river gorge below the ruins comes a hollow echo against the wet stone.'
  ],
  BRIDGE: [
    'Cold spray from the Blackwater gorge surges over the cracked parapet in a sudden gust.',
    'A low vibration hums through the ancient bridge flagstones beneath your boots.'
  ],
  HILLS: [
    'Small shale stones clatter down the ravine wall in the mist, followed by tense silence.',
    'High overhead, a pair of crag-ravens wheel sharply and croak against the mountain wind.'
  ],
  PLAINS: [
    'A sudden gust flattens the tall sedge grass in a wide silver wave across the trail.',
    'Distant crows lift all at once from a patch of brambles along the horizon.'
  ],
  JUNGLE: [
    'Clouds of luminescent spores drift across the path as the humid air grows eerily still.',
    'Heavy water droplets patter from the canopy leaves onto the coiled buttress roots.'
  ]
};

/**
 * Expedition Route Definitions (Phase 8 Vertical Slices)
 */
const EXPEDITION_DEFINITIONS = {
  MIRKWOOD_EXPEDITION: {
    expeditionKey: 'MIRKWOOD_EXPEDITION',
    title: 'The Mirkwood Expedition',
    subtitle: 'Oakhaven → North Gate → Crossroads → Forest Trail → Ancient Oak → Return',
    startTile: { x: 7, y: 7, facing: 'NORTH' },
    briefingTitle: 'Expedition Briefing — Into the Mirkwood',
    briefingText: 'Scouts at Oakhaven’s watchfire report that the northern patrol to the Primeval Black Oak [7,3] failed to return. Head north through the Gatehouse [7,6], pass Mirkwood Crossroads [7,5], investigate the Forest Trail [7,4], reach the Primeval Black Oak [7,3], and return safely to Oakhaven Sanctuary [7,7].',
    milestones: [
      { stage: 1, key: 'DEPART_OAKHAVEN', label: 'Depart Oakhaven Sanctuary [7,7]', x: 7, y: 7 },
      { stage: 2, key: 'PASS_NORTH_GATE', label: 'Pass Oakhaven North Gate [7,6]', x: 7, y: 6 },
      { stage: 3, key: 'REACH_CROSSROADS', label: 'Survey Mirkwood Crossroads [7,5]', x: 7, y: 5 },
      { stage: 4, key: 'EXPLORE_TRAIL', label: 'Investigate the Mirkwood Trail [7,4]', x: 7, y: 4 },
      { stage: 5, key: 'REACH_ANCIENT_OAK', label: 'Reach the Primeval Black Oak [7,3]', x: 7, y: 3 },
      { stage: 6, key: 'RETURN_OAKHAVEN', label: 'Return to Oakhaven Sanctuary [7,7]', x: 7, y: 7, requiresPriorMilestone: 'REACH_ANCIENT_OAK' }
    ]
  },
  BRIDGE_EXPEDITION: {
    expeditionKey: 'BRIDGE_EXPEDITION',
    title: 'The Old Stone Bridge & Ruined Watchpost',
    subtitle: 'Oakhaven → Old Stone Bridge → Bridge East Watchpost → Frontier Survey → Return',
    startTile: { x: 7, y: 7, facing: 'EAST' },
    briefingTitle: 'Expedition Briefing — The Ruined Watchpost',
    briefingText: 'Cross the Old Stone Bridge [8,7] east from Oakhaven [7,7] to inspect the ruined Bridge East Watchpost [9,7], examine the remnants of the eastern river garrison, and return across the Blackwater gorge to Oakhaven Sanctuary [7,7].',
    milestones: [
      { stage: 1, key: 'DEPART_OAKHAVEN', label: 'Depart Oakhaven Eastern Gate [7,7]', x: 7, y: 7 },
      { stage: 2, key: 'CROSS_STONE_BRIDGE', label: 'Cross The Old Stone Bridge [8,7]', x: 8, y: 7 },
      { stage: 3, key: 'REACH_WATCHPOST', label: 'Investigate Bridge East Watchpost [9,7]', x: 9, y: 7 },
      { stage: 4, key: 'SURVEY_WATCHPOST_FLANKS', label: 'Inspect Watchpost Ruins or Eastern Approach', x: 9, y: 7 },
      { stage: 5, key: 'RETURN_OAKHAVEN', label: 'Return to Oakhaven Sanctuary [7,7]', x: 7, y: 7, requiresPriorMilestone: 'REACH_WATCHPOST' }
    ]
  },
  ROTTEN_LANDS_EXPEDITION: {
    expeditionKey: 'ROTTEN_LANDS_EXPEDITION',
    title: 'Into the Rotten Lands',
    subtitle: 'Oakhaven → South Gate → Rotting Fen → Deadman’s Mire → Return',
    startTile: { x: 7, y: 7, facing: 'SOUTH' },
    briefingTitle: 'Expedition Briefing — Into the Rotten Lands',
    briefingText: 'Venture south through the Fen-Ward Gatehouse [7,8] into the sunken boardwalks of the Rotting Fen, navigate the bog causeways to the Sunken Temple of Deadman’s Mire [4,11], and return to Oakhaven [7,7].',
    milestones: [
      { stage: 1, key: 'DEPART_OAKHAVEN', label: 'Depart Oakhaven Sanctuary [7,7]', x: 7, y: 7 },
      { stage: 2, key: 'PASS_SOUTH_GATE', label: 'Pass Fen-Ward South Gate [7,8]', x: 7, y: 8 },
      { stage: 3, key: 'ENTER_ROTTING_FEN', label: 'Explore the Rotting Fen [6,10]', x: 6, y: 10 },
      { stage: 4, key: 'REACH_DEADMANS_MIRE', label: 'Reach Deadman’s Mire Sunken Ruins [4,11]', x: 4, y: 11 },
      { stage: 5, key: 'RETURN_OAKHAVEN', label: 'Return to Oakhaven Sanctuary [7,7]', x: 7, y: 7, requiresPriorMilestone: 'REACH_DEADMANS_MIRE' }
    ]
  }
};

// In-memory store keyed by characterId (scoped per SQLite DB instance + fallback map)
const adventureStateByCharId = new Map();
const adventureStateByDb = new WeakMap();

function getScopedAdventureMap(dbOverride = null) {
  const db = dbOverride || getBoundTravelContinuityDb();
  if (db && typeof db === 'object') {
    if (!adventureStateByDb.has(db)) {
      adventureStateByDb.set(db, new Map());
    }
    return adventureStateByDb.get(db);
  }
  return adventureStateByCharId;
}

function clearInMemoryAdventureCache(dbOverride = null) {
  const db = dbOverride || getBoundTravelContinuityDb();
  if (db && typeof db === 'object' && adventureStateByDb.has(db)) {
    adventureStateByDb.get(db).clear();
  }
  adventureStateByCharId.clear();
  clearInMemoryTravelCache(db);
}

function persistAdventureStateToDb(advState, dbOverride = null) {
  if (!advState) return;
  const db = dbOverride || getBoundTravelContinuityDb();
  if (!db) return;
  saveTravelContextToDb(db, advState.characterId || 'default', advState, null);
}

function loadAdventureStateFromDb(characterId, dbOverride = null) {
  const db = dbOverride || getBoundTravelContinuityDb();
  if (!db) return null;
  try {
    initTravelContinuityTables(db);
    const key = String(characterId || 'default');
    const row = db.prepare('SELECT state_json FROM lab_adventure_state WHERE character_id = ? LIMIT 1').get(key);
    if (row && row.state_json) {
      return JSON.parse(row.state_json);
    }
  } catch (_) {
    // Ignore read errors
  }
  return null;
}

function inferMoveTypeFromStep(fromTile, toTile, facing = 'NORTH') {
  if (!fromTile || !toTile) return 'FORWARD';
  const dx = Number(toTile.x) - Number(fromTile.x);
  const dy = Number(toTile.y) - Number(fromTile.y);
  const dist = Math.abs(dx) + Math.abs(dy);
  if (dist === 0) return 'ROTATE';
  if (dist > 1) return 'TELEPORT';

  const normFacing = String(facing || 'NORTH').toUpperCase();
  const vecMap = {
    NORTH: { fwd: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] },
    EAST:  { fwd: [1, 0],  back: [-1, 0], left: [0, -1], right: [0, 1] },
    SOUTH: { fwd: [0, 1],  back: [0, -1], left: [1, 0],  right: [-1, 0] },
    WEST:  { fwd: [-1, 0], back: [1, 0],  left: [0, 1],  right: [0, -1] }
  }[normFacing] || { fwd: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] };

  if (dx === vecMap.fwd[0] && dy === vecMap.fwd[1]) return 'FORWARD';
  if (dx === vecMap.back[0] && dy === vecMap.back[1]) return 'BACKWARD';
  if (dx === vecMap.left[0] && dy === vecMap.left[1]) return 'STRAFE_LEFT';
  if (dx === vecMap.right[0] && dy === vecMap.right[1]) return 'STRAFE_RIGHT';
  return 'FORWARD';
}

function computeDeterministicRoll(seed, step, x, y, salt = 0) {
  let h = (Number(seed || 1337) ^ (step * 374761393) ^ (x * 668265263) ^ (y * 2147483647) ^ (salt * 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 10000) / 10000;
}

function resolveRegionLabel(tile) {
  if (!tile) return 'Unknown Frontier';
  const x = Number(tile.x);
  const y = Number(tile.y);
  if (x === 7 && y === 7) return 'Oakhaven Sanctuary';
  if (x === 7 && (y === 6 || y === 8)) return 'Oakhaven Gatehouses';
  if (x === 8 && y === 7) return 'Blackwater Crossing';
  if (x === 9 && y === 7) return 'Bridge East Watchpost';
  if (x === 4 && y === 11) return 'Deadman’s Mire';
  if (tile.terrain === 'FOREST') return y <= 4 ? 'Deep Mirkwood' : 'Mirkwood Border';
  if (tile.terrain === 'SWAMP') return 'The Rotting Fen';
  if (tile.terrain === 'JUNGLE') return 'Venomous Jungle';
  if (tile.terrain === 'HILLS') return 'Raven Crags & Highlands';
  if (tile.terrain === 'PLAINS') return x >= 11 ? 'Windblown Heath' : 'Verdant Plains';
  if (tile.terrain === 'UNDERGROUND_RUINS') return 'Ancient Ruins';
  return tile.name || tile.terrain || 'Frontier';
}

function createInitialAdventureState(characterId, options = {}) {
  const expeditionKey = EXPEDITION_DEFINITIONS[options.expeditionKey]
    ? options.expeditionKey
    : 'MIRKWOOD_EXPEDITION';
  const expDef = EXPEDITION_DEFINITIONS[expeditionKey];
  const enabled = options.enabled !== undefined ? Boolean(options.enabled) : true;
  const deterministicSeed = options.deterministicSeed !== undefined ? options.deterministicSeed : 4201;

  const initialJournal = [
    {
      entryId: 'j_exp_start_1',
      step: 0,
      type: 'EXPEDITION_START',
      icon: '🧭',
      title: expDef.briefingTitle,
      locationLabel: 'Oakhaven Sanctuary [7,7]',
      text: expDef.briefingText,
      timestamp: new Date().toISOString()
    }
  ];

  return {
    characterId,
    enabled,
    modeLabel: enabled ? 'Adventure Experience — Experimental' : 'Current Experience (Baseline)',
    expeditionKey,
    deterministicSeed,
    stepCounter: 0,
    stepsSinceLastDiscovery: 2, // Allows first landmark discovery on route after leaving town
    stepsSinceLastTension: 1,
    stepsSinceLastEncounter: 3,
    quietStepsCount: 0,
    consecutiveEventSteps: 0,
    postCombatBreathingSteps: 0,
    currentFacing: (expDef.startTile && expDef.startTile.facing) || 'NORTH',
    lastResolvedFacing: (expDef.startTile && expDef.startTile.facing) || 'NORTH',
    lastResolvedTileCoord: '7,7',
    lastStepRecordedAtCoord: null,
    lastKnownTile: { x: 7, y: 7, name: 'Oakhaven', terrain: 'CITY', feature: 'MARKETPLACE', is_safe: 1, is_passable: 1 },
    preCombatContext: null,
    activeEncounterCoord: null,
    recentTileHistory: ['7,7'],
    visitedTiles: ['7,7'],
    visitedRegions: ['Oakhaven Sanctuary'],
    completedMilestones: ['DEPART_OAKHAVEN'],
    expeditionCompleted: false,
    inspectedPois: [],
    discoveredMap: {},
    activeDiscovery: null,
    activeTensionCue: null,
    lastEncounterIntro: null,
    encountersFaced: [],
    choicesTakenCount: 0,
    journalEntries: initialJournal
  };
}

function getOrCreateAdventureState(characterId, currentTile = null, dbOverride = null) {
  const key = String(characterId || 'default');
  const scopedMap = getScopedAdventureMap(dbOverride);
  if (!scopedMap.has(key)) {
    const fromDb = loadAdventureStateFromDb(key, dbOverride);
    if (fromDb) {
      scopedMap.set(key, fromDb);
    } else {
      const created = createInitialAdventureState(key);
      scopedMap.set(key, created);
      persistAdventureStateToDb(created, dbOverride);
    }
  }
  const st = scopedMap.get(key);
  if (currentTile) {
    const coord = `${currentTile.x},${currentTile.y}`;
    if (!st.visitedTiles.includes(coord)) st.visitedTiles.push(coord);
    const region = resolveRegionLabel(currentTile);
    if (!st.visitedRegions.includes(region)) st.visitedRegions.push(region);
    if (!st.lastKnownTile) {
      st.lastKnownTile = {
        x: currentTile.x,
        y: currentTile.y,
        name: currentTile.name,
        terrain: currentTile.terrain,
        feature: currentTile.feature || null,
        is_safe: currentTile.is_safe !== undefined ? currentTile.is_safe : (currentTile.isSafe ? 1 : 0),
        is_passable: currentTile.is_passable !== undefined ? currentTile.is_passable : 1
      };
    }
  }
  return st;
}

function resetAdventureState(characterId, options = {}) {
  const key = String(characterId || 'default');
  const scopedMap = getScopedAdventureMap(options.db);
  const existing = scopedMap.get(key);
  const next = createInitialAdventureState(key, {
    enabled: options.enabled !== undefined ? options.enabled : (existing ? existing.enabled : true),
    expeditionKey: options.expeditionKey || (existing ? existing.expeditionKey : 'MIRKWOOD_EXPEDITION'),
    deterministicSeed: options.deterministicSeed !== undefined ? options.deterministicSeed : (existing ? existing.deterministicSeed : 4201)
  });
  scopedMap.set(key, next);
  persistAdventureStateToDb(next, options.db);
  const expDef = EXPEDITION_DEFINITIONS[next.expeditionKey] || EXPEDITION_DEFINITIONS.MIRKWOOD_EXPEDITION;
  resetTravelContinuityState(
    key,
    { x: 7, y: 7, name: 'Oakhaven', terrain: 'CITY', feature: 'MARKETPLACE', is_safe: 1, is_passable: 1 },
    (expDef.startTile && expDef.startTile.facing) || 'NORTH',
    options.db
  );
  return next;
}

function addJournalEntry(advState, entry) {
  if (!advState || !entry) return;
  // Deduplicate identical consecutive or same-key entries
  if (entry.dedupeKey && advState.journalEntries.some(e => e.dedupeKey === entry.dedupeKey)) {
    const idx = advState.journalEntries.findIndex(e => e.dedupeKey === entry.dedupeKey);
    advState.journalEntries[idx] = {
      ...advState.journalEntries[idx],
      ...entry,
      timestamp: new Date().toISOString()
    };
    return;
  }
  advState.journalEntries.push({
    entryId: `j_${advState.journalEntries.length + 1}_${Date.now()}`,
    step: advState.stepCounter,
    timestamp: new Date().toISOString(),
    ...entry
  });
}

/**
 * Checks whether the player is oscillating back and forth between the same 2 tiles
 * (Section 4.4 requirement: prevent farming discoveries by walking back and forth).
 */
function isOscillatingBetweenTiles(recentTileHistory, nextCoord) {
  if (!Array.isArray(recentTileHistory) || recentTileHistory.length < 2) return false;
  const prev2 = recentTileHistory[recentTileHistory.length - 2];
  // If A -> B -> A, that's an immediate back-step / oscillation
  if (prev2 === nextCoord) return true;
  // Also check if nextCoord appeared more than once in the last 4 steps
  const recentWindow = recentTileHistory.slice(-4);
  return recentWindow.filter(c => c === nextCoord).length >= 1;
}

/**
 * Evaluates Expedition Route Milestones & Return Journey Reflection (Phase 8)
 */
function evaluateExpeditionMilestones(advState, currentTile) {
  const expDef = EXPEDITION_DEFINITIONS[advState.expeditionKey];
  if (!expDef || !currentTile) return null;

  const cx = Number(currentTile.x);
  const cy = Number(currentTile.y);
  let newlyCompleted = null;

  for (const m of expDef.milestones) {
    if (advState.completedMilestones.includes(m.key)) continue;
    if (m.x !== cx || m.y !== cy) continue;
    if (m.requiresPriorMilestone && !advState.completedMilestones.includes(m.requiresPriorMilestone)) {
      continue;
    }
    advState.completedMilestones.push(m.key);
    newlyCompleted = m;

    if (m.key === 'RETURN_OAKHAVEN' && !advState.expeditionCompleted) {
      advState.expeditionCompleted = true;
      const discCount = Object.keys(advState.discoveredMap).length;
      const poiCount = advState.inspectedPois.length;
      const encCount = advState.encountersFaced.length;
      addJournalEntry(advState, {
        dedupeKey: `exp_return_${advState.expeditionKey}`,
        type: 'EXPEDITION_RETURN',
        icon: '🏰',
        title: `Returned to Oakhaven — ${expDef.title} Complete`,
        locationLabel: 'Oakhaven Sanctuary [7,7]',
        text: `You step back inside the timber gates of Oakhaven Sanctuary after completing ${expDef.title}. Along the journey you explored ${advState.visitedTiles.length} tiles, recorded ${discCount} environmental discoveries, inspected ${poiCount} landmarks, and faced ${encCount} combat encounters.`
      });
    }
  }

  return newlyCompleted;
}

/**
 * Selects a world-consistent discovery for the current tile (or returns null if pacing dictates a quiet step).
 */
function selectDiscoveryForTile(advState, currentTile, options = {}) {
  if (!advState.enabled || !currentTile) return null;
  const forceTrigger = Boolean(options.forceTrigger);
  const requestedKey = options.discoveryKey || options.discoveryId || null;

  const cx = Number(currentTile.x);
  const cy = Number(currentTile.y);
  const coord = `${cx},${cy}`;

  if (forceTrigger && requestedKey) {
    const forcedDef = DISCOVERY_CATALOG.find(c => c.discoveryKey === requestedKey || c.id === requestedKey);
    if (forcedDef) {
      return registerDiscoveryInstance(advState, forcedDef, cx, cy);
    }
  }

  if (currentTile.is_safe === 1 || currentTile.terrain === 'CITY') return null;

  // Anti-oscillation guard applies before re-surfacing or selecting any tile discovery
  if (!forceTrigger && isOscillatingBetweenTiles(advState.recentTileHistory, coord)) {
    return null;
  }

  // If this exact tile already has a previously discovered event, do not re-pop if already resolved or dismissed/passed
  const existingOnTile = Object.values(advState.discoveredMap).find(
    d => d.tileX === cx && d.tileY === cy
  );
  if (existingOnTile) {
    if (!forceTrigger && (existingOnTile.status === 'CHOICE_RESOLVED' || existingOnTile.status === 'PASSED')) {
      return null;
    }
    const catalogDef = DISCOVERY_CATALOG.find(c => c.discoveryKey === existingOnTile.discoveryKey);
    if (catalogDef) {
      return decorateDiscoveryForClient({
        ...catalogDef,
        tileX: cx,
        tileY: cy,
        status: existingOnTile.status,
        selectedChoiceKey: existingOnTile.choiceKey || null,
        selectedChoiceTitle: existingOnTile.choiceTitle || null,
        outcomeText: existingOnTile.outcomeText || null
      });
    }
  }

  // 1. Check for authored exact-tile landmark/route discoveries first (e.g. [7,5], [7,4], [7,3], [8,7], [9,7], [4,11])
  const exactCandidate = DISCOVERY_CATALOG.find(d => {
    if (advState.discoveredMap[d.discoveryKey]) return false;
    if (!Array.isArray(d.exactTiles)) return false;
    return d.exactTiles.some(t => t.x === cx && t.y === cy);
  });

  if (exactCandidate) {
    return registerDiscoveryInstance(advState, exactCandidate, cx, cy);
  }

  // 2. Anti-Oscillation & Pacing Check for general biome discoveries
  if (!forceTrigger) {
    if (isOscillatingBetweenTiles(advState.recentTileHistory, coord)) {
      return null;
    }
    // Enforce quiet moments: require at least 2 quiet steps between non-landmark discoveries
    if (advState.stepsSinceLastDiscovery < 2) {
      return null;
    }
    const roll = computeDeterministicRoll(advState.deterministicSeed, advState.stepCounter, cx, cy, 17);
    if (roll > 0.48) {
      return null;
    }
  }

  // 3. Filter eligible biome discoveries not yet seen in this expedition
  const eligible = DISCOVERY_CATALOG.filter(d => {
    if (advState.discoveredMap[d.discoveryKey]) return false;
    if (Array.isArray(d.exactTiles) && d.exactTiles.length > 0) return false;
    if (!d.terrain.includes(currentTile.terrain)) return false;
    if (d.minY !== undefined && cy < d.minY) return false;
    if (d.maxY !== undefined && cy > d.maxY) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const pickRoll = computeDeterministicRoll(advState.deterministicSeed, advState.stepCounter, cx, cy, 31);
  const picked = eligible[Math.floor(pickRoll * eligible.length) % eligible.length];
  return registerDiscoveryInstance(advState, picked, cx, cy);
}

function decorateDiscoveryForClient(disc) {
  if (!disc) return null;
  const choices = Array.isArray(disc.choices)
    ? disc.choices.map(c => ({
        ...c,
        id: c.choiceKey || c.id,
        choiceKey: c.choiceKey || c.id,
        prompt: c.prompt || c.outcomeTitle || 'Examine closely'
      }))
    : [];
  return {
    ...disc,
    id: disc.discoveryKey || disc.id,
    discoveryKey: disc.discoveryKey || disc.id,
    category: disc.category || (Array.isArray(disc.terrain) ? disc.terrain[0] : 'Exploration'),
    shortText: disc.shortBanner || disc.shortText || disc.description,
    fullText: disc.description || disc.fullText || disc.shortBanner,
    choices
  };
}

function registerDiscoveryInstance(advState, catalogDef, cx, cy) {
  advState.stepsSinceLastDiscovery = 0;
  advState.lastChoiceResolution = null;
  const record = {
    discoveryKey: catalogDef.discoveryKey,
    title: catalogDef.title,
    tier: catalogDef.tier,
    icon: catalogDef.icon,
    tileX: cx,
    tileY: cy,
    step: advState.stepCounter,
    status: 'DISCOVERED',
    choiceKey: null,
    choiceTitle: null,
    outcomeText: null
  };
  advState.discoveredMap[catalogDef.discoveryKey] = record;

  // Record IMPORTANT and NOTICEABLE discoveries in the Expedition Journal upon discovery
  if (catalogDef.tier === 'IMPORTANT' || catalogDef.tier === 'NOTICEABLE') {
    addJournalEntry(advState, {
      dedupeKey: `disc_${catalogDef.discoveryKey}`,
      type: 'DISCOVERY',
      icon: catalogDef.icon || '🔎',
      title: catalogDef.title,
      locationLabel: `[${cx},${cy}]`,
      coords: { x: cx, y: cy },
      detail: catalogDef.shortBanner,
      text: catalogDef.shortBanner
    });
  }

  return decorateDiscoveryForClient({
    ...catalogDef,
    tileX: cx,
    tileY: cy,
    status: 'DISCOVERED',
    selectedChoiceKey: null,
    selectedChoiceTitle: null,
    outcomeText: null
  });
}

/**
 * Resolves 3-Tier Exploration Tension & Anticipation (Phase 4: Sections 5.1–5.3)
 * Strictly distinguishes:
 *  1. `GENUINE_EVIDENCE` — Only when backed by real game state (persistent monster on/near tile or active bounty region).
 *  2. `AMBIENT_TENSION` — Purely atmospheric unease on quiet steps when no discovery popped.
 *  3. `ENCOUNTER_INTRO` — When an encounter actually begins.
 */
function resolveTensionCue(advState, currentTile, encounterState, persistentAlert, adjacentPersistentCount = 0) {
  if (!advState.enabled || !currentTile) return null;

  // Tier 3: Encounter Introduction (when an encounter is active in Stage 1 DISCOVERED or Stage 2 IN_COMBAT)
  if (encounterState && (encounterState.status === 'DISCOVERED' || encounterState.status === 'STAGE1_PRE_COMBAT' || encounterState.status === 'IN_COMBAT')) {
    const monsterName = encounterState.monsterName || 'An unseen presence';
    const isPersistent = Boolean(encounterState.isPersistent);
    return {
      tier: 'ENCOUNTER_INTRO',
      cueType: 'ENCOUNTER_INTRO',
      badge: isPersistent ? 'KNOWN SURVIVOR ENCOUNTER' : 'HOSTILE ENCOUNTER',
      icon: '⚔️',
      text: isPersistent
        ? `The battle-scarred ${monsterName} emerges from the shadows ahead, blocking the path!`
        : (encounterState.status === 'DISCOVERED'
          ? `A shadow stirs in the mist ahead across ${currentTile.name || currentTile.terrain}—decide whether to engage or slip past!`
          : `The air tightens—${monsterName} steps into your path across ${currentTile.name || currentTile.terrain}!`)
    };
  }

  if (currentTile.is_safe === 1 || currentTile.terrain === 'CITY') return null;

  // Tier 2: Genuine Evidence (ONLY when real game data confirms a persistent monster on this tile or adjacent tile)
  if (persistentAlert) {
    return {
      tier: 'GENUINE_EVIDENCE',
      cueType: 'GENUINE_EVIDENCE',
      badge: 'GENUINE EVIDENCE • CONFIRMED TRACKS',
      icon: '🩸',
      text: persistentAlert
    };
  }
  if (adjacentPersistentCount > 0) {
    return {
      tier: 'GENUINE_EVIDENCE',
      cueType: 'GENUINE_EVIDENCE',
      badge: 'GENUINE EVIDENCE • NEARBY SURVIVOR',
      icon: '🐾',
      text: 'Freshly scarred earth and heavy tracks confirm a battle-hardened creature lurks on a neighboring tile.'
    };
  }

  // Tier 1: Ambient Tension (only when no discovery is currently active on this step, and after a quiet interval)
  if (advState.activeDiscovery) return null;
  if (advState.postCombatBreathingSteps > 0) return null;
  if (advState.stepsSinceLastTension < 1) return null;

  const cx = Number(currentTile.x);
  const cy = Number(currentTile.y);
  const pool = AMBIENT_TENSION_BY_TERRAIN[currentTile.terrain] || AMBIENT_TENSION_BY_TERRAIN.PLAINS;
  const roll = computeDeterministicRoll(advState.deterministicSeed, advState.stepCounter, cx, cy, 73);
  if (roll > 0.55) return null;

  advState.stepsSinceLastTension = 0;
  const text = pool[Math.floor(roll * pool.length * 10) % pool.length];
  return {
    tier: 'AMBIENT_TENSION',
    cueType: 'AMBIENT_TENSION',
    badge: 'ATMOSPHERIC CUE',
    icon: '🌫️',
    text
  };
}

/**
 * Processes a real movement step (`MOVE`) in Adventure Experience Mode.
 */
function onPlayerStep(characterId, currentTile, encounterState, persistentAlert, adjacentPersistentCount = 0, options = {}) {
  const advState = getOrCreateAdventureState(characterId, currentTile, options.db);
  if (!currentTile) return advState;

  const coord = `${currentTile.x},${currentTile.y}`;
  const prevTile = advState.lastKnownTile || currentTile;
  const liveCtx = getLatestSceneViewportContext();
  const prevFacing = advState.currentFacing || 'NORTH';
  const nextFacing = String(options.facing || (liveCtx && liveCtx.facing) || prevFacing).toUpperCase();
  const moveType = options.moveAction || inferMoveTypeFromStep(prevTile, currentTile, nextFacing);

  // If stepping away from a tile that had an unresolved/bypassed Stage 1 encounter, mark it as fled/lingering threat
  if (advState.activeEncounterCoord && advState.activeEncounterCoord !== coord) {
    const lastEnc = advState.encountersFaced[advState.encountersFaced.length - 1];
    if (lastEnc && lastEnc.outcome === 'ACTIVE') {
      lastEnc.outcome = 'FLED';
      recordTravelCombatTransition(
        characterId,
        'BYPASSED',
        {
          currentTile: { x: lastEnc.tileX, y: lastEnc.tileY, name: prevTile.name, terrain: prevTile.terrain },
          facing: prevFacing,
          monsterName: lastEnc.monsterName
        },
        options.db
      );
    }
    advState.activeEncounterCoord = null;
  }

  if (options.encounterPacing) {
    advState.lastEncounterPacing = options.encounterPacing;
  }

  recordTravelStep(
    characterId,
    {
      fromTile: prevTile,
      toTile: currentTile,
      facing: nextFacing,
      moveKind: moveType,
      aheadTile: options.aheadTile !== undefined ? options.aheadTile : (liveCtx ? liveCtx.ahead1 : null),
      leftTile: options.leftTile !== undefined ? options.leftTile : (liveCtx ? liveCtx.left1 : null),
      rightTile: options.rightTile !== undefined ? options.rightTile : (liveCtx ? liveCtx.right1 : null),
      behindTile: options.behindTile !== undefined ? options.behindTile : (liveCtx ? liveCtx.behind1 : null),
      hasPersistentThreat: Boolean(persistentAlert)
    },
    options.db
  );

  advState.lastKnownTile = {
    x: currentTile.x,
    y: currentTile.y,
    name: currentTile.name,
    terrain: currentTile.terrain,
    feature: currentTile.feature || null,
    is_safe: currentTile.is_safe !== undefined ? currentTile.is_safe : (currentTile.isSafe ? 1 : 0),
    is_passable: currentTile.is_passable !== undefined ? currentTile.is_passable : 1
  };
  advState.currentFacing = nextFacing;
  advState.lastResolvedFacing = nextFacing;
  advState.lastResolvedTileCoord = coord;
  advState.lastStepRecordedAtCoord = coord;
  advState.lastChoiceResolution = null;

  // If previous tile had an unexamined discovery, mark it as gracefully passed/ignored (Section 11.2 #7)
  if (advState.activeDiscovery && (advState.activeDiscovery.tileX !== currentTile.x || advState.activeDiscovery.tileY !== currentTile.y)) {
    const prevRec = advState.discoveredMap[advState.activeDiscovery.discoveryKey];
    if (prevRec && prevRec.status === 'DISCOVERED') {
      prevRec.status = 'PASSED';
    }
    advState.activeDiscovery = null;
  }

  advState.stepCounter += 1;
  advState.stepsSinceLastDiscovery += 1;
  advState.stepsSinceLastTension += 1;
  advState.stepsSinceLastEncounter = Number(advState.stepsSinceLastEncounter || 0) + 1;
  if (advState.postCombatBreathingSteps > 0) {
    advState.postCombatBreathingSteps = Math.max(0, advState.postCombatBreathingSteps - 1);
  }

  if (!advState.visitedTiles.includes(coord)) {
    advState.visitedTiles.push(coord);
  }
  const region = resolveRegionLabel(currentTile);
  if (!advState.visitedRegions.includes(region)) {
    advState.visitedRegions.push(region);
  }

  evaluateExpeditionMilestones(advState, currentTile);

  if (!advState.enabled) {
    advState.activeDiscovery = null;
    advState.activeTensionCue = null;
    advState.recentTileHistory.push(coord);
    if (advState.recentTileHistory.length > 10) advState.recentTileHistory.shift();
    persistAdventureStateToDb(advState, options.db);
    return advState;
  }

  // If an encounter started on this step, prioritize the encounter over discovery popups
  if (encounterState && (encounterState.status === 'DISCOVERED' || encounterState.status === 'STAGE1_PRE_COMBAT' || encounterState.status === 'IN_COMBAT')) {
    advState.activeDiscovery = null;
    advState.activeTensionCue = resolveTensionCue(advState, currentTile, encounterState, persistentAlert, adjacentPersistentCount);
    advState.stepsSinceLastEncounter = 0;
    advState.consecutiveEventSteps = Number(advState.consecutiveEventSteps || 0) + 1;
    recordEncounterStart(advState, currentTile, encounterState);
  } else {
    advState.activeDiscovery = selectDiscoveryForTile(advState, currentTile);
    advState.activeTensionCue = resolveTensionCue(advState, currentTile, null, persistentAlert, adjacentPersistentCount);
    if (advState.activeDiscovery) {
      advState.consecutiveEventSteps = Number(advState.consecutiveEventSteps || 0) + 1;
    } else {
      advState.quietStepsCount = Number(advState.quietStepsCount || 0) + 1;
      advState.consecutiveEventSteps = 0;
    }
  }

  advState.recentTileHistory.push(coord);
  if (advState.recentTileHistory.length > 10) advState.recentTileHistory.shift();

  persistAdventureStateToDb(advState, options.db);
  return advState;
}

function recordEncounterStart(advStateOrCharId, currentTile, encounterState) {
  if (!advStateOrCharId || !encounterState) return null;
  const advState = typeof advStateOrCharId === 'object'
    ? advStateOrCharId
    : getOrCreateAdventureState(advStateOrCharId, currentTile);
  const monsterName = encounterState.monsterName || 'Unseen Shadow in the Mist';
  const cx = currentTile ? currentTile.x : 0;
  const cy = currentTile ? currentTile.y : 0;
  const coord = `${cx},${cy}`;
  const dedupeKey = `enc_${advState.stepCounter}_${monsterName}_${cx}_${cy}`;

  const liveCtx = getLatestSceneViewportContext();
  const effectiveFacing = (liveCtx && liveCtx.facing) || advState.currentFacing || 'NORTH';
  const stageAnchor = (liveCtx && liveCtx.scene && liveCtx.scene.stageAnchor) || null;
  const variantKey = (liveCtx && liveCtx.scene && liveCtx.scene.variantKey) || null;

  advState.activeEncounterCoord = coord;
  advState.preCombatContext = {
    tileX: cx,
    tileY: cy,
    tileName: currentTile ? currentTile.name : 'Wilderness',
    terrain: currentTile ? currentTile.terrain : 'PLAINS',
    facing: effectiveFacing,
    stageAnchor,
    variantKey,
    step: advState.stepCounter
  };

  recordTravelCombatTransition(
    advState.characterId,
    'ENCOUNTER_START',
    {
      currentTile,
      facing: effectiveFacing,
      monsterName,
      activeDiscovery: advState.activeDiscovery,
      sceneVariantKey: variantKey,
      stageAnchor
    },
    null
  );

  if (!advState.encountersFaced.some(e => e.dedupeKey === dedupeKey)) {
    advState.encountersFaced.push({
      dedupeKey,
      monsterName,
      tileX: cx,
      tileY: cy,
      step: advState.stepCounter,
      outcome: 'ACTIVE'
    });
    addJournalEntry(advState, {
      dedupeKey: `journal_enc_${advState.encountersFaced.length}`,
      type: 'ENCOUNTER_START',
      icon: '⚔️',
      title: `Encountered ${monsterName}`,
      locationLabel: `${currentTile ? currentTile.name : 'Wilderness'} [${cx},${cy}]`,
      coords: { x: cx, y: cy },
      detail: `Crossed paths with ${monsterName} at [${cx},${cy}].`,
      text: `Crossed paths with ${monsterName} at [${cx},${cy}].`
    });
  }

  persistAdventureStateToDb(advState);
  return advState;
}

function recordEncounterOutcome(characterId, currentTile, monsterName, outcome) {
  const advState = getOrCreateAdventureState(characterId, currentTile);
  const lastEnc = advState.encountersFaced[advState.encountersFaced.length - 1];
  if (lastEnc && lastEnc.outcome === 'ACTIVE') {
    lastEnc.outcome = outcome;
  } else if (monsterName) {
    advState.encountersFaced.push({
      dedupeKey: `enc_out_${advState.stepCounter}_${monsterName}`,
      monsterName,
      tileX: currentTile ? currentTile.x : 0,
      tileY: currentTile ? currentTile.y : 0,
      step: advState.stepCounter,
      outcome
    });
  }

  advState.activeEncounterCoord = null;
  advState.stepsSinceLastEncounter = 0;
  advState.postCombatBreathingSteps = 1;
  if (advState.activeTensionCue && advState.activeTensionCue.tier === 'ENCOUNTER_INTRO') {
    advState.activeTensionCue = null;
  }

  const effectiveFacing = (advState.preCombatContext && advState.preCombatContext.facing) || advState.currentFacing || 'NORTH';
  const phaseKey = (outcome === 'FLED' || outcome === 'BYPASSED') ? 'FLED' : (outcome === 'DEFEAT' ? 'DEFEAT' : 'VICTORY');
  recordTravelCombatTransition(
    characterId,
    phaseKey,
    {
      currentTile,
      facing: effectiveFacing,
      monsterName: monsterName || (lastEnc && lastEnc.monsterName) || 'Hostile Creature',
      outcome,
      stageAnchor: advState.preCombatContext ? advState.preCombatContext.stageAnchor : null,
      sceneVariantKey: advState.preCombatContext ? advState.preCombatContext.variantKey : null
    },
    null
  );

  const labelMap = {
    VICTORY: `Defeated ${monsterName || 'the enemy'} and secured the trail.`,
    FLED: `Broke contact and retreated from ${monsterName || 'the threat'}.`,
    BYPASSED: `Slipped past ${monsterName || 'the threat'} in the shadows.`,
    DEFEAT: `Fell in battle against ${monsterName || 'the enemy'}.`
  };
  const typeMap = {
    VICTORY: 'ENCOUNTER_VICTORY',
    FLED: 'ENCOUNTER_FLEE',
    BYPASSED: 'ENCOUNTER_FLEE',
    DEFEAT: 'ENCOUNTER_DEFEAT'
  };
  const detailText = labelMap[outcome] || `Resolved encounter with ${monsterName}.`;
  addJournalEntry(advState, {
    dedupeKey: `journal_enc_out_${advState.encountersFaced.length}`,
    type: typeMap[outcome] || 'ENCOUNTER_VICTORY',
    icon: outcome === 'VICTORY' ? '🏆' : '🛡️',
    title: `${outcome === 'VICTORY' ? 'Victory over' : 'Encounter with'} ${monsterName || 'Hostile Creature'}`,
    locationLabel: currentTile ? `${currentTile.name} [${currentTile.x},${currentTile.y}]` : 'Wilderness',
    coords: currentTile ? { x: currentTile.x, y: currentTile.y } : null,
    detail: detailText,
    text: detailText
  });

  persistAdventureStateToDb(advState);
  return advState;
}

function recordPoiInspection(characterId, currentTile, poi) {
  const advState = getOrCreateAdventureState(characterId, currentTile);
  if (!poi) return advState;

  if (!advState.inspectedPois.some(p => p.poiKey === poi.poiKey)) {
    advState.inspectedPois.push({
      poiKey: poi.poiKey,
      title: poi.title,
      tileX: currentTile ? currentTile.x : poi.tileX,
      tileY: currentTile ? currentTile.y : poi.tileY,
      facing: poi.facing || 'NORTH',
      step: advState.stepCounter
    });
  }

  addJournalEntry(advState, {
    dedupeKey: `poi_${poi.poiKey}`,
    type: 'POI_INSPECTED',
    icon: poi.icon || '🏛️',
    title: `Inspected: ${poi.title}`,
    locationLabel: currentTile ? `${currentTile.name} [${currentTile.x},${currentTile.y}]` : `[${poi.tileX},${poi.tileY}]`,
    coords: currentTile ? { x: currentTile.x, y: currentTile.y } : { x: poi.tileX, y: poi.tileY },
    detail: poi.description,
    text: poi.description
  });

  persistAdventureStateToDb(advState);
  return advState;
}

/**
 * Resolves a player's choice on an interactive discovery (Phase 5: Sections 6.1–6.2)
 */
function resolveDiscoveryChoice(characterId, currentTile, discoveryKey, choiceKey) {
  const advState = getOrCreateAdventureState(characterId, currentTile);
  const catalogDef = DISCOVERY_CATALOG.find(d => d.discoveryKey === discoveryKey || d.id === discoveryKey)
    || (advState.activeDiscovery && (advState.activeDiscovery.discoveryKey === discoveryKey || advState.activeDiscovery.id === discoveryKey) ? advState.activeDiscovery : null);

  if (!catalogDef) {
    return { ok: false, error: 'Discovery not found on current route.' };
  }

  const choice = Array.isArray(catalogDef.choices)
    ? (catalogDef.choices.find(c => c.choiceKey === choiceKey || c.id === choiceKey) || catalogDef.choices[0])
    : null;

  if (!choice) {
    const rec = advState.discoveredMap[catalogDef.discoveryKey] || {
      discoveryKey: catalogDef.discoveryKey,
      title: catalogDef.title,
      tier: catalogDef.tier,
      tileX: currentTile ? currentTile.x : 0,
      tileY: currentTile ? currentTile.y : 0,
      step: advState.stepCounter
    };
    rec.status = 'EXAMINED';
    advState.discoveredMap[catalogDef.discoveryKey] = rec;
    advState.activeDiscovery = null;
    persistAdventureStateToDb(advState);
    return {
      ok: true,
      discovery: null,
      outcomeTitle: catalogDef.title,
      outcomeText: catalogDef.description
    };
  }

  const cx = currentTile ? currentTile.x : (catalogDef.tileX || 0);
  const cy = currentTile ? currentTile.y : (catalogDef.tileY || 0);

  const rec = advState.discoveredMap[catalogDef.discoveryKey] || {
    discoveryKey: catalogDef.discoveryKey,
    title: catalogDef.title,
    tier: catalogDef.tier,
    icon: catalogDef.icon,
    tileX: cx,
    tileY: cy,
    step: advState.stepCounter
  };

  if (rec.status !== 'CHOICE_RESOLVED') {
    advState.choicesTakenCount += 1;
  }
  rec.status = 'CHOICE_RESOLVED';
  rec.choiceKey = choice.choiceKey;
  rec.choiceTitle = choice.outcomeTitle;
  rec.outcomeText = choice.outcomeText;
  advState.discoveredMap[catalogDef.discoveryKey] = rec;

  advState.lastChoiceResolution = {
    discoveryId: catalogDef.discoveryKey,
    discoveryKey: catalogDef.discoveryKey,
    discoveryTitle: catalogDef.title,
    choiceId: choice.choiceKey,
    choiceKey: choice.choiceKey,
    choiceLabel: choice.label,
    outcomeTitle: choice.outcomeTitle,
    outcomeText: choice.outcomeText,
    step: advState.stepCounter
  };
  advState.activeDiscovery = null;

  const detailText = `${choice.journalSummary || choice.outcomeText}`;
  addJournalEntry(advState, {
    dedupeKey: `disc_${catalogDef.discoveryKey}`,
    type: 'CHOICE',
    icon: catalogDef.icon || '🔎',
    title: `${catalogDef.title} — ${choice.outcomeTitle}`,
    locationLabel: `${currentTile ? currentTile.name : 'Wilderness'} [${cx},${cy}]`,
    coords: { x: cx, y: cy },
    detail: detailText,
    text: detailText
  });

  persistAdventureStateToDb(advState);
  return {
    ok: true,
    discovery: null,
    choice,
    outcomeTitle: choice.outcomeTitle,
    outcomeText: choice.outcomeText
  };
}

/**
 * Serializes the client-facing `state.adventure` payload for the HUD, Journal, and Director.
 */
function buildAdventureClientPayload(characterId, currentTile, encounterState, persistentAlert, adjacentPersistentCount = 0, options = {}) {
  const advState = getOrCreateAdventureState(characterId, currentTile, options.db);
  const expDef = EXPEDITION_DEFINITIONS[advState.expeditionKey] || EXPEDITION_DEFINITIONS.MIRKWOOD_EXPEDITION;

  const liveCtx = getLatestSceneViewportContext();
  const liveMatchesCurrent = Boolean(
    liveCtx &&
    liveCtx.current &&
    currentTile &&
    Number(liveCtx.current.x) === Number(currentTile.x) &&
    Number(liveCtx.current.y) === Number(currentTile.y)
  );
  const effectiveFacing = String(
    options.facing ||
    (liveMatchesCurrent ? liveCtx.facing : null) ||
    advState.currentFacing ||
    'NORTH'
  ).toUpperCase();

  if (currentTile) {
    const coord = `${currentTile.x},${currentTile.y}`;
    advState.currentFacing = effectiveFacing;
    advState.lastResolvedFacing = effectiveFacing;
    advState.lastResolvedTileCoord = coord;
    advState.lastKnownTile = {
      x: currentTile.x,
      y: currentTile.y,
      name: currentTile.name,
      terrain: currentTile.terrain,
      feature: currentTile.feature || null,
      is_safe: currentTile.is_safe !== undefined ? currentTile.is_safe : (currentTile.isSafe ? 1 : 0),
      is_passable: currentTile.is_passable !== undefined ? currentTile.is_passable : 1
    };
  }

  // Refresh tension cue if encounter state changed, and clear stale ENCOUNTER_INTRO cues after combat/flee/ignore
  const isActiveEncounter = Boolean(
    encounterState &&
    (encounterState.status === 'DISCOVERED' || encounterState.status === 'STAGE1_PRE_COMBAT' || encounterState.status === 'IN_COMBAT')
  );
  if (advState.enabled && isActiveEncounter) {
    advState.activeTensionCue = resolveTensionCue(advState, currentTile, encounterState, persistentAlert, adjacentPersistentCount);
    recordEncounterStart(advState, currentTile, encounterState);
  } else if (!isActiveEncounter) {
    if (currentTile && advState.activeEncounterCoord === `${currentTile.x},${currentTile.y}`) {
      const lastEnc = advState.encountersFaced[advState.encountersFaced.length - 1];
      if (lastEnc && lastEnc.outcome === 'ACTIVE') {
        lastEnc.outcome = 'FLED';
        recordTravelCombatTransition(
          characterId,
          'BYPASSED',
          {
            currentTile,
            facing: effectiveFacing,
            monsterName: lastEnc.monsterName
          },
          options.db
        );
      }
      advState.activeEncounterCoord = null;
    }
    if (advState.activeTensionCue && advState.activeTensionCue.tier === 'ENCOUNTER_INTRO') {
      advState.activeTensionCue = (persistentAlert || adjacentPersistentCount > 0)
        ? resolveTensionCue(advState, currentTile, null, persistentAlert, adjacentPersistentCount)
        : null;
    }
  }

  const objectiveResult = computeActiveObjectiveHint(advState, currentTile, effectiveFacing, expDef);
  const activeObjectiveHint = objectiveResult.activeObjectiveHint;
  const objectiveGuidance = objectiveResult.objectiveGuidance;

  const travelContinuity = buildTravelContinuityPayload(
    characterId,
    currentTile,
    effectiveFacing,
    liveMatchesCurrent ? liveCtx : null,
    { activeObjectiveHint },
    options.db
  );

  const milestones = expDef.milestones.map(m => ({
    ...m,
    prompt: m.prompt || m.label,
    completed: advState.completedMilestones.includes(m.key),
    completedAtStep: advState.completedMilestones.includes(m.key) ? advState.stepCounter : null
  }));

  // Waypoints represent the route destinations after departure (indices 1..end of milestones)
  const waypoints = milestones.slice(1);
  const nextWaypoint = waypoints.find(w => !w.completed) || null;

  const discoveredList = Object.values(advState.discoveredMap);
  const wins = advState.encountersFaced.filter(e => e.outcome === 'VICTORY').length;
  const fled = advState.encountersFaced.filter(e => e.outcome === 'FLED').length;

  const journalReversed = advState.journalEntries.slice().reverse().map(j => ({
    ...j,
    type: j.type === 'EXPEDITION_RETURN' ? 'EXPEDITION_COMPLETE' : j.type,
    detail: j.detail || j.text || '',
    coords: j.coords || null
  }));

  const threatDensity = isActiveEncounter
    ? 'ACTIVE_ENCOUNTER'
    : (persistentAlert
      ? 'HIGH_PERSISTENT_ON_TILE'
      : (adjacentPersistentCount > 0
        ? 'ELEVATED_NEARBY_SURVIVOR'
        : (currentTile && (currentTile.is_safe === 1 || currentTile.terrain === 'CITY')
          ? 'SANCTUARY_CALM'
          : 'STANDARD_FRONTIER')));

  const pacingState = isActiveEncounter
    ? 'COMBAT_ENGAGED'
    : (advState.postCombatBreathingSteps > 0
      ? 'POST_COMBAT_RECOVERY'
      : (advState.activeDiscovery ? 'DISCOVERY_MOMENT' : 'QUIET_TRAVEL'));

  persistAdventureStateToDb(advState, options.db);

  return {
    enabled: advState.enabled,
    modeLabel: advState.enabled ? 'Adventure Experience — Experimental' : 'Current Experience (Baseline)',
    totalDiscoveriesInCatalog: DISCOVERY_CATALOG.length,
    expeditionKey: advState.expeditionKey,
    expeditionTitle: expDef.title,
    expeditionSubtitle: expDef.subtitle,
    briefingTitle: expDef.briefingTitle,
    briefingText: expDef.briefingText,
    expeditionCompleted: advState.expeditionCompleted,
    activeObjectiveHint,
    objectiveGuidance,
    expedition: {
      key: advState.expeditionKey,
      expeditionKey: advState.expeditionKey,
      title: expDef.title,
      subtitle: expDef.subtitle,
      summary: expDef.briefingText,
      isComplete: advState.expeditionCompleted,
      waypoints,
      nextWaypoint,
      activeObjectiveHint,
      objectiveGuidance
    },
    deterministicSeed: advState.deterministicSeed,
    stepCounter: advState.stepCounter,
    stepsSinceLastDiscovery: advState.stepsSinceLastDiscovery,
    currentRegion: resolveRegionLabel(currentTile),
    facing: effectiveFacing,
    milestones,
    travelContinuity,
    transitionContext: travelContinuity.transitionContext,
    continuityNote: travelContinuity.continuityNote,
    horizonHint: travelContinuity.horizonHint,
    behindHint: travelContinuity.behindHint,
    breadcrumbTrail: travelContinuity.breadcrumbTrail,
    revisitStatus: travelContinuity.revisitStatus,
    revisitBanner: travelContinuity.revisitBanner,
    compassContext: travelContinuity.compassContext,
    biomePersistence: travelContinuity.biomePersistence,
    boundaryGuidance: travelContinuity.boundaryGuidance,
    combatReturnContext: travelContinuity.combatReturnContext,
    pacing: {
      quietStepsCount: Number(advState.quietStepsCount || 0),
      stepsSinceLastEncounter: Number(advState.stepsSinceLastEncounter || 0),
      stepsSinceLastDiscovery: Number(advState.stepsSinceLastDiscovery || 0),
      consecutiveEventSteps: Number(advState.consecutiveEventSteps || 0),
      postCombatBreathingSteps: Number(advState.postCombatBreathingSteps || 0),
      threatDensity,
      pacingState,
      lastEncounterPacing: advState.lastEncounterPacing || null
    },
    progress: {
      locationsVisited: advState.visitedTiles.length,
      regionsExplored: advState.visitedRegions.length,
      landmarksInspected: advState.inspectedPois.length,
      discoveriesMade: discoveredList.length,
      choicesTaken: advState.choicesTakenCount,
      encountersFaced: advState.encountersFaced.length
    },
    stats: {
      stepsTaken: advState.stepCounter,
      discoveriesFound: discoveredList.length,
      choicesResolved: advState.choicesTakenCount,
      poisInspectedCount: advState.inspectedPois.length,
      encountersWon: wins,
      encountersFled: fled
    },
    activeDiscovery: advState.enabled ? decorateDiscoveryForClient(advState.activeDiscovery) : null,
    activeTensionCue: advState.enabled ? advState.activeTensionCue : null,
    lastChoiceResolution: advState.enabled ? (advState.lastChoiceResolution || null) : null,
    discoveredList,
    inspectedPois: advState.inspectedPois,
    encountersFaced: advState.encountersFaced,
    journalEntries: journalReversed,
    journal: journalReversed,
    availableExpeditions: Object.values(EXPEDITION_DEFINITIONS).map(e => ({
      key: e.expeditionKey,
      expeditionKey: e.expeditionKey,
      title: e.title,
      subtitle: e.subtitle,
      summary: e.briefingText,
      startTile: e.startTile
    }))
  };
}


// ============================================================================
// WORKSTREAM B: ENCOUNTER PACING ENGINE & DETERMINISTIC SIMULATION
// ============================================================================

const ENCOUNTER_PACING_CONFIG = {
  baselineUnpacedChancePercent: 25,
  bountyContractBaseChancePercent: 40,
  terrainBaseChancePercent: {
    CITY: 0,
    PLAINS: 16,
    BRIDGE: 16,
    FOREST: 22,
    HILLS: 22,
    SWAMP: 28,
    JUNGLE: 28,
    UNDERGROUND_RUINS: 30,
    DEFAULT: 20
  },
  highDangerLandmarks: {
    '7,3': 30,  // Heart of the Mirkwood
    '9,7': 30,  // Bridge East Watchpost
    '4,11': 30  // Deadman's Mire
  },
  townGateDepartureGraceChancePercent: 0,
  townGateReentryChancePercent: 8,
  postEncounterImmediateCooldownSteps: 1,
  postEncounterSoftRecoveryStep: 1,
  postEncounterSoftRecoveryMultiplier: 0.40,
  clearedSiteProtectedSteps: 8,
  clearedSiteLongTermMultiplier: 0.25,
  familiarSafeRevisitMultiplier: 0.45,
  lingeringThreatRevisitMultiplier: 1.25,
  immediateBacktrackCapPercent: 3.5,
  oscillationZeroThresholdTail: 3,
  quietStreakRampStartSteps: 5,
  quietStreakRampPerStepPercent: 2,
  quietStreakRampMaxBonusPercent: 8,
  maxRandomChancePercent: 45
};

/**
 * Counts how many trailing entries in `recentTileHistory` alternate exclusively
 * within the two-tile pair `{fromCoord, targetCoord}`.
 * - 1: normal forward or non-oscillating step
 * - 2: single immediate reversal (A -> B -> A)
 * - >= 3: repeated 2-tile oscillation (A -> B -> A -> B ...)
 */
function countTwoTileOscillationTail(recentTileHistory, fromCoord, targetCoord) {
  if (!Array.isArray(recentTileHistory) || recentTileHistory.length < 2) return 1;
  if (!fromCoord || !targetCoord || fromCoord === targetCoord) return 1;
  const lastIdx = recentTileHistory.length - 1;
  if (recentTileHistory[lastIdx] !== fromCoord) return 1;
  if (recentTileHistory[lastIdx - 1] !== targetCoord) return 1;

  const pair = new Set([fromCoord, targetCoord]);
  let count = 0;
  for (let i = lastIdx; i >= 0; i--) {
    if (pair.has(recentTileHistory[i])) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Computes the calibrated random encounter chance (0..100) for a movement step
 * from `currentTile` onto `targetTile`.
 *
 * Guarantees:
 * - Safe Sanctuary (`CITY` / `is_safe === 1`): 0%
 * - Persistent world monsters on `targetTile` or fixed authored encounters: 100%
 * - Immediate Town Gate departure from Oakhaven (`[7,7] -> [7,6]` or `[7,8]`): 0%
 * - Immediate step after an encounter (victory, retreat, or slip-past): 0% breathing step
 * - Second step after an encounter: 0.40x soft recovery
 * - Repeated 2-tile back-and-forth oscillation (`A <-> B <-> A`): 0%
 * - Recently cleared tile (`<= 8` steps since victory on that tile): 0%, then 0.25x
 * - Revisit to known safe tile (`FAMILIAR_SAFE`): 0.45x
 * - Revisit to tile with bypassed/fled threat (`LINGERING_THREAT_SITE`): 1.25x
 * - Terrain-specific danger hierarchy: PLAINS/BRIDGE (16%) < FOREST/HILLS (22%) < SWAMP/JUNGLE (28%) < RUINS/LANDMARKS (30%)
 */
function computeEncounterPacingChance(db, characterOrId, currentTile, targetTile, options = {}) {
  const characterId = typeof characterOrId === 'object' && characterOrId !== null
    ? characterOrId.id
    : Number(characterOrId || 1);

  if (!targetTile) {
    return {
      chancePercent: 0,
      baseChancePercent: 0,
      reason: 'INVALID_TARGET_TILE',
      modifiers: []
    };
  }

  const targetCoord = `${targetTile.x},${targetTile.y}`;
  const fromCoord = currentTile ? `${currentTile.x},${currentTile.y}` : null;
  const isFromSafeCity = Boolean(
    currentTile && (currentTile.is_safe === 1 || currentTile.isSafe === true || currentTile.terrain === 'CITY')
  );
  if (targetTile.feature === 'TOWN_GATES' && isFromSafeCity && options.mode !== 'BASELINE_UNPACED') {
    const advStateGrace = options.advState || getOrCreateAdventureState(characterId, currentTile || targetTile, db);
    const decision = {
      chancePercent: ENCOUNTER_PACING_CONFIG.townGateDepartureGraceChancePercent,
      baseChancePercent: ENCOUNTER_PACING_CONFIG.townGateReentryChancePercent,
      reason: 'TOWN_GATE_DEPARTURE_GRACE',
      modifiers: ['TOWN_GATE_DEPARTURE_GRACE']
    };
    if (advStateGrace) advStateGrace.lastEncounterPacing = decision;
    return decision;
  }

  const isSafeTarget = (targetTile.is_safe === 1 || targetTile.isSafe === true || targetTile.terrain === 'CITY') && targetTile.feature !== 'TOWN_GATES';

  if (isSafeTarget) {
    return {
      chancePercent: 0,
      baseChancePercent: 0,
      reason: 'SANCTUARY_SAFE_ZONE',
      modifiers: ['SANCTUARY_ZERO']
    };
  }

  // Persistent monster or fixed authored encounter always takes 100% priority
  let hasPersistentOnTarget = Boolean(options.hasPersistentMonsterOnTile);
  if (!hasPersistentOnTarget && db && targetTile.id) {
    try {
      const row = db.prepare(
        "SELECT id FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE' LIMIT 1"
      ).get(targetTile.id);
      hasPersistentOnTarget = Boolean(row);
    } catch (_e) {
      hasPersistentOnTarget = false;
    }
  }
  if (hasPersistentOnTarget) {
    return {
      chancePercent: 100,
      baseChancePercent: 100,
      reason: 'PERSISTENT_MONSTER_ON_TILE',
      modifiers: ['PERSISTENT_GUARANTEED'],
      isPersistent: true
    };
  }

  if (options.fixedAuthoredEncounter || options.questEncounterGuaranteed) {
    return {
      chancePercent: 100,
      baseChancePercent: 100,
      reason: 'AUTHORED_FIXED_ENCOUNTER',
      modifiers: ['AUTHORED_GUARANTEED'],
      isAuthored: true
    };
  }

  // Baseline unpaced mode for A/B simulation comparison
  if (options.mode === 'BASELINE_UNPACED') {
    const baseUnpaced = options.hasActiveBounty
      ? ENCOUNTER_PACING_CONFIG.bountyContractBaseChancePercent
      : ENCOUNTER_PACING_CONFIG.baselineUnpacedChancePercent;
    return {
      chancePercent: baseUnpaced,
      baseChancePercent: baseUnpaced,
      reason: 'BASELINE_UNPACED',
      modifiers: []
    };
  }

  const advState = options.advState || getOrCreateAdventureState(characterId, currentTile || targetTile, db);
  const travelState = options.travelState || getOrCreateContinuityState(characterId, currentTile || targetTile, 'NORTH', db);
  const modifiers = [];

  // 1. Town Gate departure grace handled above

  // 2. Post-encounter breathing room (prevents back-to-back random encounters)
  const stepsSinceEnc = Number(
    advState.stepsSinceLastEncounter !== undefined ? advState.stepsSinceLastEncounter : 99
  );
  const breathingSteps = Number(advState.postCombatBreathingSteps || 0);
  if (stepsSinceEnc === 0 || breathingSteps > 0 || options.bypassedPreviousEncounter) {
    const decision = {
      chancePercent: 0,
      baseChancePercent: 0,
      reason: 'POST_ENCOUNTER_BREATHING_STEP',
      modifiers: ['POST_ENCOUNTER_COOLDOWN_ZERO']
    };
    advState.lastEncounterPacing = decision;
    return decision;
  }

  // 3. Anti-oscillation protection (A <-> B <-> A 2-tile farming)
  const oscillationTail = countTwoTileOscillationTail(advState.recentTileHistory, fromCoord, targetCoord);
  if (oscillationTail >= ENCOUNTER_PACING_CONFIG.oscillationZeroThresholdTail) {
    const decision = {
      chancePercent: 0,
      baseChancePercent: 0,
      reason: 'ANTI_OSCILLATION_SUPPRESSED',
      modifiers: ['TWO_TILE_OSCILLATION_ZERO'],
      oscillationTail
    };
    advState.lastEncounterPacing = decision;
    return decision;
  }

  // 4. Determine terrain / landmark / bounty base rate
  let baseChance = ENCOUNTER_PACING_CONFIG.terrainBaseChancePercent[targetTile.terrain]
    ?? ENCOUNTER_PACING_CONFIG.terrainBaseChancePercent.DEFAULT;
  if (targetTile.feature === 'TOWN_GATES') {
    baseChance = ENCOUNTER_PACING_CONFIG.townGateReentryChancePercent;
    modifiers.push('TOWN_GATE_THRESHOLD');
  } else if (ENCOUNTER_PACING_CONFIG.highDangerLandmarks[targetCoord] !== undefined) {
    baseChance = ENCOUNTER_PACING_CONFIG.highDangerLandmarks[targetCoord];
    modifiers.push('HIGH_DANGER_LANDMARK');
  }

  // Check active bounty contract in region if db is provided
  let hasBounty = Boolean(options.hasActiveBounty);
  if (!hasBounty && db && targetTile.region_name) {
    try {
      const bRow = db.prepare(`
        SELECT cc.id
        FROM character_contracts cc
        JOIN bounty_contracts bc ON cc.contract_id = bc.id
        WHERE cc.character_id = ? AND cc.status = 'ACTIVE' AND bc.target_region = ?
        LIMIT 1
      `).get(characterId, targetTile.region_name);
      hasBounty = Boolean(bRow);
    } catch (_e) {
      hasBounty = false;
    }
  }
  if (hasBounty) {
    baseChance = Math.max(baseChance, ENCOUNTER_PACING_CONFIG.bountyContractBaseChancePercent);
    modifiers.push('ACTIVE_BOUNTY_CONTRACT');
  }

  let chance = baseChance;
  let primaryReason = 'TERRAIN_BASE_RATE';

  // 5. Tile revisit & cleared-site memory
  const revisitMap = (travelState && (travelState.tileRevisitMap || travelState.tileMemory)) || null;
  const mem = revisitMap ? revisitMap[targetCoord] : null;
  const wasVisited = Boolean((mem && mem.visitCount > 0) || (Array.isArray(advState.visitedTiles) && advState.visitedTiles.includes(targetCoord)));
  const hasClearedOnTile = Boolean(
    mem && (mem.hasClearedThreat || Number(mem.clearedCount || 0) > 0 || mem.revisitStatus === REVISIT_STATUS_TYPES.CLEARED_SITE)
  );
  const hasLingeringOnTile = Boolean(
    mem && (mem.hasLingeringThreat || mem.lingeringThreat || mem.revisitStatus === REVISIT_STATUS_TYPES.LINGERING_THREAT_SITE)
  );

  if (hasClearedOnTile && !hasLingeringOnTile) {
    let stepsSinceClearedOnTile = 99;
    if (Array.isArray(advState.encountersFaced)) {
      for (let i = advState.encountersFaced.length - 1; i >= 0; i--) {
        const enc = advState.encountersFaced[i];
        if (
          enc &&
          enc.outcome === 'VICTORY' &&
          Number(enc.tileX) === Number(targetTile.x) &&
          Number(enc.tileY) === Number(targetTile.y)
        ) {
          stepsSinceClearedOnTile = Math.max(0, Number(advState.stepCounter || 0) - Number(enc.step || 0));
          break;
        }
      }
    }
    if (stepsSinceClearedOnTile <= ENCOUNTER_PACING_CONFIG.clearedSiteProtectedSteps) {
      const decision = {
        chancePercent: 0,
        baseChancePercent: baseChance,
        reason: 'RECENTLY_CLEARED_SITE_PROTECTED',
        modifiers: [...modifiers, 'CLEARED_SITE_PROTECTED_WINDOW'],
        stepsSinceClearedOnTile
      };
      advState.lastEncounterPacing = decision;
      return decision;
    }
    chance *= ENCOUNTER_PACING_CONFIG.clearedSiteLongTermMultiplier;
    primaryReason = 'CLEARED_SITE_REDUCED';
    modifiers.push('CLEARED_SITE_REDUCED');
  } else if (hasLingeringOnTile) {
    chance *= ENCOUNTER_PACING_CONFIG.lingeringThreatRevisitMultiplier;
    primaryReason = 'LINGERING_THREAT_SITE';
    modifiers.push('LINGERING_THREAT_BOOST');
  } else if (wasVisited) {
    chance *= ENCOUNTER_PACING_CONFIG.familiarSafeRevisitMultiplier;
    primaryReason = 'FAMILIAR_SAFE_REVISIT';
    modifiers.push('FAMILIAR_SAFE_REVISIT');
  } else {
    primaryReason = 'UNEXPLORED_FRONTIER';
    const quietStreak = Number(advState.quietStepsCount || 0);
    if (quietStreak >= ENCOUNTER_PACING_CONFIG.quietStreakRampStartSteps) {
      const rampBonus = Math.min(
        ENCOUNTER_PACING_CONFIG.quietStreakRampMaxBonusPercent,
        (quietStreak - ENCOUNTER_PACING_CONFIG.quietStreakRampStartSteps + 1) * ENCOUNTER_PACING_CONFIG.quietStreakRampPerStepPercent
      );
      chance += rampBonus;
      modifiers.push(`QUIET_STREAK_RAMP_+${rampBonus}%`);
    }
  }

  // 6. Second step after an encounter: soft recovery multiplier (0.40x)
  if (stepsSinceEnc === ENCOUNTER_PACING_CONFIG.postEncounterSoftRecoveryStep) {
    chance *= ENCOUNTER_PACING_CONFIG.postEncounterSoftRecoveryMultiplier;
    primaryReason = 'POST_ENCOUNTER_SOFT_RECOVERY';
    modifiers.push('POST_ENCOUNTER_SOFT_RECOVERY');
  }

  // 7. Single-step immediate backtrack cap (A -> B -> A turnaround step)
  if (oscillationTail === 2 && !hasLingeringOnTile) {
    chance = Math.min(chance, ENCOUNTER_PACING_CONFIG.immediateBacktrackCapPercent);
    primaryReason = 'IMMEDIATE_BACKTRACK_DAMPENED';
    modifiers.push('IMMEDIATE_BACKTRACK_CAP');
  }

  const finalChance = Number(
    Math.max(0, Math.min(ENCOUNTER_PACING_CONFIG.maxRandomChancePercent, chance)).toFixed(2)
  );

  const decision = {
    chancePercent: finalChance,
    baseChancePercent: baseChance,
    reason: primaryReason,
    modifiers,
    oscillationTail
  };
  advState.lastEncounterPacing = decision;
  return decision;
}

function createSeededSimulationRng(seed) {
  let state = (Number(seed || 1) >>> 0) || 1;
  return function nextRng() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Encounter Pacing Simulation Runner for Workstream B4 (Scenarios A–I).
 * Compares Baseline (Unpaced 25% flat wilderness rate) vs. Phase 2 Paced across N seeded runs.
 */
function runEncounterPacingSimulation(options = {}) {
  const runs = Number(options.runs || 500);
  const baseSeed = Number(options.baseSeed || 202602);

  const makeTile = (x, y, terrain, name, extra = {}) => ({
    id: y * 15 + x + 1,
    x,
    y,
    terrain,
    name: name || `${terrain} [${x},${y}]`,
    feature: extra.feature || null,
    is_safe: extra.is_safe || 0,
    is_passable: 1,
    region_name: extra.region_name || terrain
  });

  const scenarios = {
    A: {
      code: 'A',
      title: '20 new tiles in Forest (Mirkwood)',
      buildSteps: () => {
        const tiles = [];
        for (let i = 0; i <= 20; i++) {
          tiles.push(makeTile(4 + (i % 8), 1 + Math.floor(i / 8), 'FOREST', `Mirkwood Forest #${i}`));
        }
        return tiles.slice(1).map((to, idx) => ({ type: 'MOVE', from: tiles[idx], to }));
      }
    },
    B: {
      code: 'B',
      title: '20 new tiles in Plains (Verdant Plains)',
      buildSteps: () => {
        const tiles = [];
        for (let i = 0; i <= 20; i++) {
          tiles.push(makeTile(4 + (i % 8), 6 + Math.floor(i / 8), 'PLAINS', `Verdant Plains #${i}`));
        }
        return tiles.slice(1).map((to, idx) => ({ type: 'MOVE', from: tiles[idx], to }));
      }
    },
    C: {
      code: 'C',
      title: '20 new tiles in Swamp (Rotting Fen)',
      buildSteps: () => {
        const tiles = [];
        for (let i = 0; i <= 20; i++) {
          tiles.push(makeTile(1 + (i % 7), 9 + Math.floor(i / 7), 'SWAMP', `Rotting Fen #${i}`));
        }
        return tiles.slice(1).map((to, idx) => ({ type: 'MOVE', from: tiles[idx], to }));
      }
    },
    D: {
      code: 'D',
      title: '10 tiles forward in Forest and same 10 tiles back',
      buildSteps: () => {
        const corridor = [];
        for (let i = 0; i <= 10; i++) {
          corridor.push(makeTile(4 + (i % 5), 2 + Math.floor(i / 5), 'FOREST', `Mirkwood Corridor #${i}`));
        }
        const steps = [];
        for (let i = 0; i < 10; i++) {
          steps.push({ type: 'MOVE', from: corridor[i], to: corridor[i + 1], leg: 'OUTBOUND' });
        }
        for (let i = 10; i > 0; i--) {
          steps.push({ type: 'MOVE', from: corridor[i], to: corridor[i - 1], leg: 'RETURN' });
        }
        return steps;
      }
    },
    E: {
      code: 'E',
      title: '20 rotations on the same tile',
      buildSteps: () => {
        const tile = makeTile(7, 5, 'FOREST', 'Mirkwood Crossroads');
        const facings = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
        const steps = [];
        for (let i = 0; i < 20; i++) {
          steps.push({ type: 'TURN', tile, facing: facings[i % 4] });
        }
        return steps;
      }
    },
    F: {
      code: 'F',
      title: '30 steps oscillating between two adjacent tiles',
      buildSteps: () => {
        const tileA = makeTile(7, 5, 'FOREST', 'Mirkwood Crossroads');
        const tileB = makeTile(7, 4, 'FOREST', 'Mirkwood Trail');
        const steps = [];
        let cur = tileA;
        let next = tileB;
        for (let i = 0; i < 30; i++) {
          steps.push({ type: 'MOVE', from: cur, to: next });
          const tmp = cur;
          cur = next;
          next = tmp;
        }
        return steps;
      }
    },
    G: {
      code: 'G',
      title: 'Travel across Sanctuary and Town Gate threshold',
      buildSteps: () => {
        const city = makeTile(7, 7, 'CITY', 'Oakhaven', { feature: 'MARKETPLACE', is_safe: 1 });
        const northGate = makeTile(7, 6, 'PLAINS', 'Oakhaven North Gate', { feature: 'TOWN_GATES', is_safe: 0 });
        const southGate = makeTile(7, 8, 'PLAINS', 'Oakhaven South Gate', { feature: 'TOWN_GATES', is_safe: 0 });
        const steps = [];
        for (let i = 0; i < 5; i++) {
          steps.push({ type: 'MOVE', from: city, to: northGate });
          steps.push({ type: 'MOVE', from: northGate, to: city });
          steps.push({ type: 'MOVE', from: city, to: southGate });
          steps.push({ type: 'MOVE', from: southGate, to: city });
        }
        return steps;
      }
    },
    H: {
      code: 'H',
      title: '20 steps patrolling a recently cleared 4-tile loop',
      buildSteps: () => {
        const loop = [
          makeTile(6, 4, 'FOREST', 'Cleared Grove W'),
          makeTile(7, 4, 'FOREST', 'Cleared Grove N'),
          makeTile(8, 4, 'FOREST', 'Cleared Grove E'),
          makeTile(7, 5, 'FOREST', 'Cleared Crossroads')
        ];
        const steps = [];
        for (let i = 0; i < 20; i++) {
          const from = loop[i % loop.length];
          const to = loop[(i + 1) % loop.length];
          steps.push({ type: 'MOVE', from, to, preCleared: true });
        }
        return steps;
      }
    },
    I: {
      code: 'I',
      title: 'Travel through a fixed authored / persistent monster encounter',
      buildSteps: () => {
        const t0 = makeTile(7, 6, 'PLAINS', 'Oakhaven North Gate', { feature: 'TOWN_GATES' });
        const t1 = makeTile(7, 5, 'FOREST', 'Mirkwood Crossroads');
        const t2 = makeTile(7, 4, 'FOREST', 'Mirkwood Trail');
        const t3 = makeTile(7, 3, 'FOREST', 'Heart of the Mirkwood', { feature: 'ANCIENT_OAK' });
        return [
          { type: 'MOVE', from: t0, to: t1 },
          { type: 'MOVE', from: t1, to: t2 },
          { type: 'MOVE', from: t2, to: t3, fixedAuthoredEncounter: true }
        ];
      }
    }
  };

  function simulateScenarioMode(scenarioDef, mode) {
    let totalEncounters = 0;
    let totalSteps = 0;
    let totalBackToBack = 0;
    let outboundEncounters = 0;
    let returnEncounters = 0;
    let authoredTriggeredCount = 0;
    let zeroEncounterRuns = 0;
    const encounterCounts = [];

    for (let runIdx = 0; runIdx < runs; runIdx++) {
      const rng = createSeededSimulationRng(baseSeed + runIdx * 7919 + scenarioDef.code.charCodeAt(0) * 131);
      const simCharId = 900000 + runIdx;
      const steps = scenarioDef.buildSteps();
      const startTile = steps[0].from || steps[0].tile;

      const startCoord = `${startTile.x},${startTile.y}`;
      const advState = createInitialAdventureState(simCharId);
      advState.recentTileHistory = [startCoord];
      advState.visitedTiles = [startCoord];
      advState.lastKnownTile = startTile;
      const travelState = {
        characterId: simCharId,
        lastTile: startTile,
        lastFacing: 'NORTH',
        currentCorridorKey: null,
        corridorSteps: 0,
        recentSteps: [],
        breadcrumbTrail: [`${startTile.x},${startTile.y}`],
        tileMemory: {
          [`${startTile.x},${startTile.y}`]: {
            coord: `${startTile.x},${startTile.y}`,
            x: startTile.x,
            y: startTile.y,
            name: startTile.name,
            terrain: startTile.terrain,
            visitCount: 1,
            clearedCount: 0,
            fledCount: 0,
            lingeringThreat: false
          }
        },
        combatTransition: null
      };

      // Pre-populate cleared status for Scenario H
      if (scenarioDef.code === 'H') {
        for (const st of steps) {
          const tc = `${st.to.x},${st.to.y}`;
          travelState.tileMemory[tc] = {
            coord: tc,
            x: st.to.x,
            y: st.to.y,
            name: st.to.name,
            terrain: st.to.terrain,
            visitCount: 1,
            clearedCount: 1,
            fledCount: 0,
            lingeringThreat: false
          };
          if (!advState.visitedTiles.includes(tc)) {
            advState.visitedTiles.push(tc);
          }
          advState.encountersFaced.push({
            dedupeKey: `preclear_${tc}`,
            monsterName: 'Cleared Patrol Threat',
            tileX: st.to.x,
            tileY: st.to.y,
            step: 0,
            outcome: 'VICTORY'
          });
        }
      }

      let runEncounters = 0;
      let prevStepHadEncounter = false;

      for (let sIdx = 0; sIdx < steps.length; sIdx++) {
        const step = steps[sIdx];
        totalSteps += 1;

        if (step.type === 'TURN') {
          prevStepHadEncounter = false;
          continue;
        }

        const toCoord = `${step.to.x},${step.to.y}`;
        const decision = computeEncounterPacingChance(null, simCharId, step.from, step.to, {
          mode,
          advState,
          travelState,
          fixedAuthoredEncounter: Boolean(step.fixedAuthoredEncounter)
        });

        const roll = rng() * 100;
        const triggered = roll < decision.chancePercent;

        // Advance step state identically to onPlayerStep
        advState.stepCounter += 1;
        advState.stepsSinceLastEncounter = Number(advState.stepsSinceLastEncounter || 0) + 1;
        if (advState.postCombatBreathingSteps > 0) {
          advState.postCombatBreathingSteps = Math.max(0, advState.postCombatBreathingSteps - 1);
        }

        if (!advState.visitedTiles.includes(toCoord)) {
          advState.visitedTiles.push(toCoord);
        }
        const existingMem = travelState.tileMemory[toCoord] || {
          coord: toCoord,
          x: step.to.x,
          y: step.to.y,
          name: step.to.name,
          terrain: step.to.terrain,
          visitCount: 0,
          clearedCount: 0,
          fledCount: 0,
          lingeringThreat: false
        };
        existingMem.visitCount += 1;
        travelState.tileMemory[toCoord] = existingMem;

        if (triggered) {
          runEncounters += 1;
          totalEncounters += 1;
          if (prevStepHadEncounter) {
            totalBackToBack += 1;
          }
          prevStepHadEncounter = true;
          if (step.leg === 'OUTBOUND') outboundEncounters += 1;
          if (step.leg === 'RETURN') returnEncounters += 1;
          if (step.fixedAuthoredEncounter) authoredTriggeredCount += 1;

          // Resolve encounter as VICTORY so standard post-encounter state applies
          advState.stepsSinceLastEncounter = 0;
          advState.postCombatBreathingSteps = 1;
          advState.quietStepsCount = 0;
          existingMem.clearedCount += 1;
          advState.encountersFaced.push({
            dedupeKey: `sim_${advState.stepCounter}_${toCoord}`,
            monsterName: 'Simulated Threat',
            tileX: step.to.x,
            tileY: step.to.y,
            step: advState.stepCounter,
            outcome: 'VICTORY'
          });
        } else {
          prevStepHadEncounter = false;
          advState.quietStepsCount = Number(advState.quietStepsCount || 0) + 1;
        }

        advState.recentTileHistory.push(toCoord);
        if (advState.recentTileHistory.length > 10) {
          advState.recentTileHistory.shift();
        }
      }

      if (runEncounters === 0) zeroEncounterRuns += 1;
      encounterCounts.push(runEncounters);
    }

    const stepsPerRun = totalSteps / runs;
    const meanEncounters = Number((totalEncounters / runs).toFixed(2));
    const encounterRatePerStepPct = Number(((totalEncounters / Math.max(1, totalSteps)) * 100).toFixed(2));
    const meanBackToBack = Number((totalBackToBack / runs).toFixed(3));
    return {
      mode,
      runs,
      stepsPerRun,
      meanEncounters,
      encounterRatePerStepPct,
      meanStepsBetweenEncounters: meanEncounters > 0 ? Number((stepsPerRun / meanEncounters).toFixed(2)) : null,
      meanBackToBackEncounters: meanBackToBack,
      zeroEncounterRunPct: Number(((zeroEncounterRuns / runs) * 100).toFixed(1)),
      outboundMeanEncounters: scenarioDef.code === 'D' ? Number((outboundEncounters / runs).toFixed(2)) : undefined,
      returnMeanEncounters: scenarioDef.code === 'D' ? Number((returnEncounters / runs).toFixed(2)) : undefined,
      authoredTriggerRatePct: scenarioDef.code === 'I' ? Number(((authoredTriggeredCount / runs) * 100).toFixed(1)) : undefined
    };
  }

  const results = {};
  for (const [code, scenarioDef] of Object.entries(scenarios)) {
    const baseline = simulateScenarioMode(scenarioDef, 'BASELINE_UNPACED');
    const paced = simulateScenarioMode(scenarioDef, 'PHASE2_PACED');
    results[code] = {
      code,
      title: scenarioDef.title,
      baseline,
      paced,
      deltaMeanEncounters: Number((paced.meanEncounters - baseline.meanEncounters).toFixed(2)),
      deltaRatePct: Number((paced.encounterRatePerStepPct - baseline.encounterRatePerStepPct).toFixed(2))
    };
  }

  return {
    runs,
    baseSeed,
    config: ENCOUNTER_PACING_CONFIG,
    scenarios: results
  };
}


module.exports = {
  ENCOUNTER_PACING_CONFIG,
  computeEncounterPacingChance,
  runEncounterPacingSimulation,
  PRESENTATION_TIERS,
  DISCOVERY_CATALOG,
  EXPEDITION_DEFINITIONS,
  TRANSITION_CONTEXT_TYPES,
  REVISIT_STATUS_TYPES,
  WORLD_LANDMARKS,
  NAMED_CORRIDORS,
  getOrCreateAdventureState,
  resetAdventureState,
  clearInMemoryAdventureCache,
  persistAdventureStateToDb,
  loadAdventureStateFromDb,
  onPlayerStep,
  selectDiscoveryForTile,
  resolveDiscoveryChoice,
  recordPoiInspection,
  recordEncounterStart,
  recordEncounterOutcome,
  evaluateExpeditionMilestones,
  buildAdventureClientPayload,
  buildTravelContinuityPayload,
  recordTravelStep,
  recordTravelRotation,
  recordTravelCombatTransition,
  evaluateTransitionContinuity,
  restoreSavedTravelContext,
  resolveBoundaryGuidance,
  getBoundaryGuidance,
  computeDirectionalCompassContext,
  resolveBiomePersistence,
  computeActiveObjectiveHint
};
