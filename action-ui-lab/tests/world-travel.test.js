/**
 * DARKGRID ACTION UI LAB — Track 1: World Travel, Directional Continuity & Stability Test Suite
 *
 * Verifies all 10 core World Travel & Stability responsibilities:
 *  1. Player travel and navigation (FORWARD, BACKWARD, STRAFE_LEFT, STRAFE_RIGHT, LEFT, RIGHT)
 *  2. World position, facing, and directional landmarks (ahead, left, right, behind across all 4 facings)
 *  3. Scene continuity across adjacent tiles (transitionContext, continuityNote, horizonHint, breadcrumbTrail)
 *  4. Terrain and biome persistence (sub-biome atmosphere/lighting persistence + threshold cues)
 *  5. Encounter triggering, frequency, and exploration pacing (quiet steps, threat density, post-combat breathing room)
 *  6. Transitions between exploration and combat (preserving pre-combat facing, stageAnchor, breadcrumbs, clearing stale cues)
 *  7. Fleeing, returning, and revisiting locations (FIRST_VISIT, FAMILIAR_SAFE, LINGERING_THREAT_SITE, CLEARED_SITE)
 *  8. Save/load and restoration of travel state in SQLite (lab_adventure_state & lab_travel_continuity)
 *  9. Quest progress and objective continuity (activeObjectiveHint & objectiveGuidance across expeditions)
 * 10. Boundary conditions and blocked travel (resolveBoundaryGuidance for mountains, rivers, oceans, mires, and world edges)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createLabApp } = require('../server');
const { buildWorldVisualAtlas, computeDeterministicVariantIndex } = require('../scene-catalog');
const {
  ENCOUNTER_PACING_CONFIG,
  computeEncounterPacingChance,
  runEncounterPacingSimulation,
  TRANSITION_CONTEXT_TYPES,
  REVISIT_STATUS_TYPES,
  clearInMemoryAdventureCache,
  restoreSavedTravelContext,
  resolveBoundaryGuidance,
  computeDirectionalCompassContext,
  resolveBiomePersistence,
  evaluateTransitionContinuity
} = require('../adventure-engine');

describe('Darkgrid Action UI Lab — Track 1: World Travel, Continuity & Stability', () => {
  let server;
  let baseUrl;
  let app;
  let db;
  let mockRngValue = 0.99; // Default high value prevents random encounters unless lowered

  before(async () => {
    app = createLabApp({
      dbPath: ':memory:',
      rng: () => mockRngValue
    });
    db = app.locals.db;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (db) {
      try {
        db.close();
      } catch (_e) {
        // ignore
      }
    }
  });

  async function apiGetState() {
    const res = await fetch(`${baseUrl}/api/state`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    return data.state;
  }

  async function apiAction(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.state, 'Response must always include state');
    return data.state;
  }

  it('1. Navigates coherently using FORWARD, BACKWARD, STRAFE_LEFT, STRAFE_RIGHT, LEFT, and RIGHT without facing drift', async () => {
    mockRngValue = 0.99;
    let state = await apiAction('START_EXPEDITION', {
      expeditionKey: 'MIRKWOOD_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 101
    });

    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.facing, 'NORTH');
    assert.ok(state.adventure.travelContinuity);
    assert.equal(state.adventure.travelContinuity.facing, 'NORTH');

    // Step FORWARD (NORTH) to Oakhaven North Gate [7,6]
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.adventure.travelContinuity.moveKind, 'FORWARD');

    // Step FORWARD (NORTH) to Mirkwood Crossroads [7,5]
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.facing, 'NORTH');

    // STRAFE_RIGHT (EAST) from [7,5] -> [8,5] while keeping NORTH facing
    state = await apiAction('MOVE', { relative: 'STRAFE_RIGHT' });
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.adventure.travelContinuity.moveKind, 'STRAFE_RIGHT');

    // STRAFE_LEFT (WEST) from [8,5] -> [7,5] while keeping NORTH facing
    state = await apiAction('MOVE', { relative: 'STRAFE_LEFT' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.adventure.travelContinuity.moveKind, 'STRAFE_LEFT');

    // Step BACKWARD (SOUTH) from [7,5] -> [7,6] while keeping NORTH facing
    state = await apiAction('MOVE', { relative: 'BACKWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.adventure.travelContinuity.moveKind, 'BACKWARD');
    assert.equal(state.adventure.travelContinuity.transitionContext, TRANSITION_CONTEXT_TYPES.RETREAT_STEP);

    // Rotate RIGHT (NORTH -> EAST) in place on [7,6]
    state = await apiAction('TURN', { turn: 'RIGHT' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.facing, 'EAST');
    assert.equal(state.adventure.travelContinuity.transitionContext, TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE);

    // Rotate LEFT (EAST -> NORTH) in place on [7,6]
    state = await apiAction('TURN', { turn: 'LEFT' });
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.adventure.travelContinuity.transitionContext, TRANSITION_CONTEXT_TYPES.ROTATION_IN_PLACE);
  });

  it('2. Maintains consistent 4-direction compass & landmark orientation (ahead, left, right, behind) across all 4 cardinal facings', async () => {
    mockRngValue = 0.99;

    // Teleport to Mirkwood Crossroads [7,5]:
    // - North [7,4]: Mirkwood Trail (FOREST, passable)
    // - South [7,6]: Oakhaven North Gate (PLAINS / TOWN_GATES, passable landmark)
    // - West [6,5]: Stonefang Crag (MOUNTAINS, impassable barrier)
    // - East [8,5]: Mirkwood Forest (FOREST, passable)
    let state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 5, facing: 'NORTH' });
    let compass = state.adventure.compassContext;
    assert.ok(compass);
    assert.equal(compass.facing, 'NORTH');
    assert.equal(compass.ahead.coord, '7,4');
    assert.equal(compass.behind.coord, '7,6');
    assert.equal(compass.left.coord, '6,5');
    assert.equal(compass.left.isBlocked, true);
    assert.equal(compass.right.coord, '8,5');
    assert.equal(compass.right.isPassable, true);

    // Turn WEST at [7,5] -> Stonefang Crag [6,5] is now AHEAD, North Gate [7,6] is LEFT, [7,4] is RIGHT, [8,5] is BEHIND
    state = await apiAction('TURN', { facing: 'WEST' });
    compass = state.adventure.compassContext;
    assert.equal(compass.facing, 'WEST');
    assert.equal(compass.ahead.coord, '6,5');
    assert.equal(compass.ahead.isBlocked, true);
    assert.equal(compass.left.coord, '7,6');
    assert.equal(compass.right.coord, '7,4');
    assert.equal(compass.behind.coord, '8,5');

    // Turn SOUTH at [7,5] -> Oakhaven North Gate [7,6] is AHEAD, [8,5] is LEFT, Stonefang Crag [6,5] is RIGHT, [7,4] is BEHIND
    state = await apiAction('TURN', { facing: 'SOUTH' });
    compass = state.adventure.compassContext;
    assert.equal(compass.facing, 'SOUTH');
    assert.equal(compass.ahead.coord, '7,6');
    assert.equal(compass.ahead.isLandmark, true);
    assert.equal(compass.left.coord, '8,5');
    assert.equal(compass.right.coord, '6,5');
    assert.equal(compass.behind.coord, '7,4');

    // Turn EAST at [7,5] -> [8,5] is AHEAD, [7,4] is LEFT, [7,6] is RIGHT, Stonefang Crag [6,5] is BEHIND
    state = await apiAction('TURN', { facing: 'EAST' });
    compass = state.adventure.compassContext;
    assert.equal(compass.facing, 'EAST');
    assert.equal(compass.ahead.coord, '8,5');
    assert.equal(compass.left.coord, '7,4');
    assert.equal(compass.right.coord, '7,6');
    assert.equal(compass.behind.coord, '6,5');
    assert.equal(compass.behind.isBlocked, true);
  });

  it('3. Tracks corridor & adjacent-tile scene continuity (SAME_CORRIDOR_ADVANCE, BIOME_THRESHOLD_CROSSING, LANDMARK_APPROACH, breadcrumbTrail)', async () => {
    mockRngValue = 0.99;

    // Start Mirkwood Expedition at Oakhaven [7,7] facing NORTH
    let state = await apiAction('START_EXPEDITION', {
      expeditionKey: 'MIRKWOOD_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 202
    });

    // Step 1: [7,7] CITY -> [7,6] PLAINS (North Gate)
    state = await apiAction('MOVE', { direction: 'NORTH' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.ok(state.adventure.travelContinuity.matchedContexts.includes(TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH));
    assert.ok(state.adventure.travelContinuity.matchedContexts.includes(TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING));
    assert.equal(state.adventure.travelContinuity.corridorKey, 'NORTHERN_MIRKWOOD_CORRIDOR');
    assert.ok(state.adventure.continuityNote.includes('North Gate'));
    assert.ok(state.adventure.horizonHint.includes('Mirkwood'));

    // Step 2: [7,6] PLAINS -> [7,5] FOREST (Mirkwood Crossroads)
    state = await apiAction('MOVE', { direction: 'NORTH' });
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.adventure.transitionContext, TRANSITION_CONTEXT_TYPES.BIOME_THRESHOLD_CROSSING);
    assert.ok(state.adventure.travelContinuity.matchedContexts.includes(TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH));
    assert.ok(state.adventure.continuityNote.includes('Crossroads'));

    // Step 3: [7,5] FOREST -> [7,4] FOREST (Mirkwood Trail — same corridor advance)
    state = await apiAction('MOVE', { direction: 'NORTH' });
    assert.equal(state.currentTile.y, 4);
    assert.equal(state.adventure.transitionContext, TRANSITION_CONTEXT_TYPES.SAME_CORRIDOR_ADVANCE);
    assert.ok(state.adventure.travelContinuity.matchedContexts.includes(TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH));
    assert.ok(state.adventure.horizonHint.includes('Primeval Black Oak') || state.adventure.horizonHint.includes('Ancient Oak'));

    // Step 4: [7,4] FOREST -> [7,3] FOREST (Heart of the Mirkwood — landmark approach)
    state = await apiAction('MOVE', { direction: 'NORTH' });
    assert.equal(state.currentTile.y, 3);
    assert.equal(state.adventure.transitionContext, TRANSITION_CONTEXT_TYPES.LANDMARK_APPROACH);
    assert.ok(state.adventure.continuityNote.includes('Primeval Black Oak'));

    // Verify breadcrumb trail ordered history: [7,7] -> [7,6] -> [7,5] -> [7,4] -> [7,3]
    const coords = state.adventure.breadcrumbTrail.map(b => b.coord);
    assert.deepEqual(coords.slice(-5), ['7,7', '7,6', '7,5', '7,4', '7,3']);
  });

  it('4. Preserves sub-biome atmosphere and lighting persistence within a biome and surfaces threshold hints before biome crossings', async () => {
    mockRngValue = 0.99;

    // At [7,6] facing NORTH toward [7,5] (PLAINS -> FOREST threshold ahead)
    let state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 6, facing: 'NORTH' });
    const bpGate = state.adventure.biomePersistence;
    assert.ok(bpGate);
    assert.equal(bpGate.approachingThreshold, true);
    assert.ok(bpGate.thresholdHint.includes('Mirkwood') || bpGate.thresholdHint.includes('FOREST'));
    assert.equal(state.viewportScene.scenes.C.biomePersistence.subBiomeKey, 'OAKHAVEN_GATEHOUSE_PERIMETER');
    assert.equal(state.viewportScene.effectProfile.subBiomeKey, 'OAKHAVEN_GATEHOUSE_PERIMETER');

    // Step NORTH into [7,5] FOREST and then [7,4] FOREST -> consecutiveStepsInBiome increments & persistedBiome is true
    state = await apiAction('MOVE', { direction: 'NORTH' }); // [7,5]
    state = await apiAction('MOVE', { direction: 'NORTH' }); // [7,4]
    const bpForest = state.adventure.biomePersistence;
    assert.equal(bpForest.terrain, 'FOREST');
    assert.equal(bpForest.persistedBiome, true);
    assert.ok(bpForest.consecutiveStepsInBiome >= 2);
    assert.equal(bpForest.subBiomeKey, 'DEEP_MIRKWOOD_CANOPY');
  });

  it('5. Balances exploration pacing, quiet steps, threat density, and post-combat breathing room', async () => {
    mockRngValue = 0.99;

    let state = await apiAction('START_EXPEDITION', {
      expeditionKey: 'BRIDGE_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 303
    });

    assert.ok(state.adventure.pacing);
    assert.equal(state.adventure.pacing.threatDensity, 'SANCTUARY_CALM');

    // Step EAST onto Old Stone Bridge [8,7] with no combat
    state = await apiAction('MOVE', { direction: 'EAST' });
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.adventure.pacing.threatDensity, 'STANDARD_FRONTIER');

    // Step EAST to [9,7] and then [10,7], [11,7] to verify quiet steps are tracked and discoveries do not spam every non-landmark tile
    await apiAction('DISMISS_DISCOVERY');
    state = await apiAction('MOVE', { direction: 'EAST' }); // [9,7]
    await apiAction('DISMISS_DISCOVERY');
    state = await apiAction('MOVE', { direction: 'EAST' }); // [10,7]
    await apiAction('DISMISS_DISCOVERY');
    state = await apiAction('MOVE', { direction: 'EAST' }); // [11,7]
    assert.ok(state.adventure.pacing.quietStepsCount >= 1, 'Expected at least 1 quiet travel step along open plains');
  });

  it('6. Preserves pre-combat context (facing, stageAnchor, breadcrumbs) during combat and clears stale ENCOUNTER_INTRO cues afterward', async () => {
    mockRngValue = 0.99;

    await apiAction('START_EXPEDITION', {
      expeditionKey: 'BRIDGE_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 404
    });

    // Walk EAST onto Old Stone Bridge [8,7]
    let state = await apiAction('MOVE', { direction: 'EAST' });
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.facing, 'EAST');

    // Trigger Stage 2 combat on [8,7]
    state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Goblin' });
    assert.equal(state.encounter.status, 'IN_COMBAT');
    assert.equal(state.adventure.activeTensionCue.tier, 'ENCOUNTER_INTRO');
    assert.ok(state.adventure.travelContinuity.preCombatContext);
    assert.equal(state.adventure.travelContinuity.preCombatContext.coord, '8,7');
    assert.equal(state.adventure.travelContinuity.preCombatContext.facing, 'EAST');
    assert.ok(state.adventure.travelContinuity.preCombatContext.stageAnchor);

    // Resolve combat via FLEE -> verify pre-combat facing is preserved and stale ENCOUNTER_INTRO cue is cleared!
    state = await apiAction('FLEE');
    assert.equal(state.encounter, null);
    assert.equal(state.facing, 'EAST', 'Post-combat facing must match pre-combat facing');
    assert.notEqual(
      state.adventure.activeTensionCue ? state.adventure.activeTensionCue.tier : null,
      'ENCOUNTER_INTRO',
      'Stale ENCOUNTER_INTRO tension cue must be cleared immediately when combat ends'
    );
    assert.ok(state.adventure.combatReturnContext);
    assert.equal(state.adventure.combatReturnContext.restoredFacing, 'EAST');
    assert.equal(state.adventure.pacing.pacingState, 'POST_COMBAT_RECOVERY');
  });

  it('7. Tracks location revisit memory (FIRST_VISIT, FAMILIAR_SAFE, LINGERING_THREAT_SITE, CLEARED_SITE) across fleeing and returning', async () => {
    mockRngValue = 0.99;

    let state = await apiAction('START_EXPEDITION', {
      expeditionKey: 'MIRKWOOD_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 505
    });

    // Oakhaven [7,7] starts as FAMILIAR_SAFE
    assert.equal(state.adventure.revisitStatus, REVISIT_STATUS_TYPES.FAMILIAR_SAFE);

    // Step NORTH to [7,6] -> FIRST_VISIT
    state = await apiAction('MOVE', { direction: 'NORTH' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.adventure.revisitStatus, REVISIT_STATUS_TYPES.FIRST_VISIT);

    // Step NORTH to [7,5] with a Stage 1 encounter (low RNG)
    mockRngValue = 0.01;
    state = await apiAction('MOVE', { direction: 'NORTH' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.ok(state.encounter);

    // Bypass/slip past the encounter back SOUTH to [7,6]
    mockRngValue = 0.99;
    state = await apiAction('MOVE', { direction: 'SOUTH' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.adventure.revisitStatus, REVISIT_STATUS_TYPES.FAMILIAR_SAFE, 'Second visit to safe [7,6] must be FAMILIAR_SAFE');

    // Return NORTH to [7,5] where we bypassed the threat -> must be LINGERING_THREAT_SITE!
    state = await apiAction('MOVE', { direction: 'NORTH' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.equal(
      state.adventure.revisitStatus,
      REVISIT_STATUS_TYPES.LINGERING_THREAT_SITE,
      'Returning to a tile where an encounter was fled or bypassed must report LINGERING_THREAT_SITE'
    );

    // Now win combat on [7,5] (recordEncounterOutcome VICTORY via 1-HP enemy kill)
    await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Goblin' });
    db.prepare('UPDATE encounters SET current_monster_hp = 1 WHERE status = ?').run('IN_COMBAT');
    mockRngValue = 0.95; // Ensure hero attack hits
    state = await apiAction('ATTACK');
    mockRngValue = 0.99;
    assert.equal(state.encounter, null);
    assert.equal(
      state.adventure.revisitStatus,
      REVISIT_STATUS_TYPES.CLEARED_SITE,
      'After defeating the enemy on [7,5], revisitStatus must become CLEARED_SITE'
    );
  });

  it('8. Persists and restores full travel & adventure continuity state from SQLite across cache clears and reloads', async () => {
    mockRngValue = 0.99;

    await apiAction('START_EXPEDITION', {
      expeditionKey: 'ROTTEN_LANDS_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 606
    });

    // Walk SOUTH: [7,7] -> [7,8] -> [7,9] and turn WEST
    await apiAction('MOVE', { direction: 'SOUTH' });
    await apiAction('MOVE', { direction: 'SOUTH' });
    let beforeReload = await apiAction('TURN', { facing: 'WEST' });

    assert.equal(beforeReload.currentTile.x, 7);
    assert.equal(beforeReload.currentTile.y, 9);
    assert.equal(beforeReload.facing, 'WEST');
    assert.equal(beforeReload.adventure.expeditionKey, 'ROTTEN_LANDS_EXPEDITION');
    assert.equal(beforeReload.adventure.stepCounter, 2);

    const charId = beforeReload.character.id;

    // Simulate server memory reset by clearing in-memory caches while keeping SQLite intact
    clearInMemoryAdventureCache(db);

    const restored = restoreSavedTravelContext(db, charId);
    assert.equal(restored.ok, true);
    assert.equal(restored.restored, true);
    assert.equal(restored.facing, 'WEST');
    assert.equal(restored.currentCoord, '7,9');
    assert.equal(restored.adventureState.expeditionKey, 'ROTTEN_LANDS_EXPEDITION');
    assert.equal(restored.adventureState.stepCounter, 2);
    assert.ok(restored.continuityState.breadcrumbTrail.length >= 3);

    // Fetch /api/state after cache clear -> must seamlessly rebuild from SQLite!
    const afterReload = await apiGetState();
    assert.equal(afterReload.currentTile.x, 7);
    assert.equal(afterReload.currentTile.y, 9);
    assert.equal(afterReload.facing, 'WEST');
    assert.equal(afterReload.adventure.expeditionKey, 'ROTTEN_LANDS_EXPEDITION');
    assert.equal(afterReload.adventure.stepCounter, 2);
    assert.equal(afterReload.adventure.travelContinuity.currentCoord, '7,9');
    assert.equal(afterReload.adventure.travelContinuity.facing, 'WEST');
  });

  it('9. Computes accurate directional & distance objective continuity (activeObjectiveHint & objectiveGuidance) across expeditions', async () => {
    mockRngValue = 0.99;

    // Start Mirkwood Expedition at [7,7] facing NORTH
    let state = await apiAction('START_EXPEDITION', {
      expeditionKey: 'MIRKWOOD_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 707
    });

    assert.ok(typeof state.adventure.activeObjectiveHint === 'string' && state.adventure.activeObjectiveHint.length > 10);
    assert.ok(state.adventure.objectiveGuidance);
    assert.equal(state.adventure.objectiveGuidance.targetKey, 'PASS_NORTH_GATE');
    assert.equal(state.adventure.objectiveGuidance.cardinalDirection, 'NORTH');
    assert.equal(state.adventure.objectiveGuidance.relativeDirection, 'AHEAD');
    assert.equal(state.adventure.objectiveGuidance.manhattanDistance, 1);

    // Walk NORTH all the way to [7,3] (Heart of the Mirkwood)
    await apiAction('MOVE', { direction: 'NORTH' }); // [7,6]
    await apiAction('MOVE', { direction: 'NORTH' }); // [7,5]
    await apiAction('MOVE', { direction: 'NORTH' }); // [7,4]
    state = await apiAction('MOVE', { direction: 'NORTH' }); // [7,3]

    // At [7,3] facing NORTH, the next objective is RETURN_OAKHAVEN [7,7] which is 4 tiles SOUTH (BEHIND when facing NORTH)
    assert.equal(state.adventure.objectiveGuidance.targetKey, 'RETURN_OAKHAVEN');
    assert.equal(state.adventure.objectiveGuidance.isReturnLeg, true);
    assert.equal(state.adventure.objectiveGuidance.cardinalDirection, 'SOUTH');
    assert.equal(state.adventure.objectiveGuidance.relativeDirection, 'BEHIND');
    assert.equal(state.adventure.objectiveGuidance.manhattanDistance, 4);

    // Turn SOUTH at [7,3] -> now RETURN_OAKHAVEN is AHEAD!
    state = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(state.adventure.objectiveGuidance.relativeDirection, 'AHEAD');
  });

  it('10. Provides world-consistent boundary & impassable terrain guidance for mountains, rivers, oceans, mires, and map edges', async () => {
    mockRngValue = 0.99;

    // 1. Stonefang Crag mountain barrier ([7,5] facing WEST toward [6,5])
    let state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 5, facing: 'WEST' });
    let bg = state.adventure.boundaryGuidance;
    assert.equal(bg.isBlocked, true);
    assert.equal(bg.barrierCategory, 'MOUNTAINS');
    assert.equal(bg.obstacleName, 'Stonefang Crag');
    assert.ok(bg.suggestedDetour.includes('Mirkwood Crossroads'));

    // 2. Blackwater River barrier ([8,7] facing NORTH toward [8,6])
    state = await apiAction('TELEPORT_TO_TILE', { x: 8, y: 7, facing: 'NORTH' });
    bg = state.adventure.boundaryGuidance;
    assert.equal(bg.isBlocked, true);
    assert.equal(bg.barrierCategory, 'RIVER');
    assert.ok(bg.suggestedDetour.includes('Old Stone Bridge'));

    // 3. Unit-test ocean, mire, and all 4 world edges directly via resolveBoundaryGuidance
    const oceanGuidance = resolveBoundaryGuidance(
      { x: 13, y: 7, name: 'Coastal Cliffs', terrain: 'PLAINS' },
      { x: 14, y: 7, name: 'The Murksea', terrain: 'OCEAN', isPassable: false },
      'EAST'
    );
    assert.equal(oceanGuidance.isBlocked, true);
    assert.equal(oceanGuidance.barrierCategory, 'OCEAN');

    const mireGuidance = resolveBoundaryGuidance(
      { x: 6, y: 13, name: 'Fen Brink', terrain: 'SWAMP' },
      { x: 6, y: 14, name: 'The Bottomless Mire', terrain: 'SWAMP', isPassable: false },
      'SOUTH'
    );
    assert.equal(mireGuidance.isBlocked, true);
    assert.equal(mireGuidance.barrierCategory, 'MIRE');

    const worldEdgeGuidance = resolveBoundaryGuidance(
      { x: 7, y: 0, name: 'Northern Crest', terrain: 'HILLS' },
      { x: 7, y: -1, exists: false, isPassable: false },
      'NORTH'
    );
    assert.equal(worldEdgeGuidance.isBlocked, true);
    assert.equal(worldEdgeGuidance.barrierCategory, 'WORLD_EDGE');
  });

  it('11. Phase 1 Regression: Mirkwood Trail [7,4] NORTH/SOUTH perspective mapping, Ancient Oak [7,3] E/W separation, and Deadman\'s Mire [4,11] 4-way uniqueness', async () => {
    mockRngValue = 0.99;
    await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });

    // 1. Mirkwood Trail [7,4] NORTH -> Tier 1 Oak Approach, SOUTH -> Tier 1 Looking Back to Crossroads
    let state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 4, facing: 'NORTH' });
    let sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 1);
    assert.equal(sceneC.variantKey, 'fp_mirkwood_trail_7_4_north');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg');

    state = await apiAction('TURN', { facing: 'SOUTH' });
    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 1);
    assert.equal(sceneC.variantKey, 'fp_mirkwood_trail_7_4_south');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_lateral.jpg');

    // 2. Ancient Oak [7,3] must have 4 distinct directional images and never reuse forest_7_4_north_oak_approach.jpg on EAST/WEST
    const oakImages = new Set();
    for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 3, facing: dir });
      const url = state.viewportScene.scenes.C.imageUrl;
      if (dir === 'EAST' || dir === 'WEST') {
        assert.ok(!url.includes('forest_7_4_north_oak_approach.jpg'), `[7,3] ${dir} must not misuse [7,4] NORTH approach art`);
      }
      oakImages.add(url);
    }
    assert.equal(oakImages.size, 4, '[7,3] Primeval Black Oak should have 4 distinct directional views');

    // 3. Deadman's Mire [4,11] must have 4 distinct directional images across N/E/S/W
    const mireImages = new Set();
    for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      state = await apiAction('TELEPORT_TO_TILE', { x: 4, y: 11, facing: dir });
      mireImages.add(state.viewportScene.scenes.C.imageUrl);
    }
    assert.equal(mireImages.size, 4, '[4,11] Deadman\'s Mire must have 4 distinct directional views');
  });

  it('12. Phase 1 Regression: Tier 4 modulo-3 NORTH/WEST collision fix, zero jungle art in FOREST, and scoped Crossroads East track', async () => {
    // 1. Verify computeDeterministicVariantIndex has zero NORTH vs WEST collisions for count = 3
    for (let y = 1; y <= 12; y++) {
      for (let x = 1; x <= 12; x++) {
        const idxN3 = computeDeterministicVariantIndex(x + 0, y, 3);
        const idxW3 = computeDeterministicVariantIndex(x + 3, y, 3);
        assert.notEqual(idxN3, idxW3, `3-arg modulo-3 collision at (${x},${y})`);
        const idxN4 = computeDeterministicVariantIndex(x, y, 3, 'NORTH');
        const idxW4 = computeDeterministicVariantIndex(x, y, 3, 'WEST');
        assert.notEqual(idxN4, idxW4, `4-arg modulo-3 collision at (${x},${y})`);
      }
    }

    // 2. Verify full 15x15 atlas invariants for FOREST jungle art and Crossroads East track scoping
    const atlas = buildWorldVisualAtlas(db);
    for (const tile of atlas.tiles) {
      if (!tile.isPassable) continue;
      const coord = `${tile.x},${tile.y}`;
      for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        const view = tile.views[dir];
        if (tile.terrain === 'FOREST') {
          assert.ok(!view.imageUrl.includes('terrain_jungle.webp'), `FOREST tile [${coord}] ${dir} must never use tropical terrain_jungle.webp`);
        }
        if (view.imageUrl.includes('crossroads_7_5_east.jpg')) {
          assert.equal(coord, '7,5', `crossroads_7_5_east.jpg must only appear at [7,5] EAST, found at [${coord}] ${dir}`);
          assert.equal(dir, 'EAST');
        }
      }
    }
  });

  it('13. Phase 2 Workstream B: Enforces Encounter Pacing rules (Town Gate grace, terrain danger hierarchy, anti-oscillation, post-encounter breathing room, cleared-site protection, and persistent priority)', async () => {
    // 1. Town Gate departure grace: stepping from Oakhaven [7,7] onto North Gate [7,6] has 0% encounter chance
    await apiAction('START_EXPEDITION', { expeditionKey: 'MIRKWOOD_EXPEDITION', teleportToStart: true });
    mockRngValue = 0.001; // Even with 0.1% roll, Town Gate departure from Sanctuary must never trigger a random encounter
    let state = await apiAction('MOVE', { direction: 'NORTH' }); // [7,7] -> [7,6]
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.encounter, null, 'Stepping out of Oakhaven onto North Gate [7,6] must have 0% Town Gate departure grace');
    assert.equal(state.adventure.pacing.lastEncounterPacing.reason, 'TOWN_GATE_DEPARTURE_GRACE');
    assert.equal(state.adventure.pacing.lastEncounterPacing.chancePercent, 0);

    // 2. Stepping into unexplored Mirkwood Crossroads [7,5] with low roll (0.05 = 5% < 22% FOREST base) triggers Stage 1 encounter
    mockRngValue = 0.05;
    state = await apiAction('MOVE', { direction: 'NORTH' }); // [7,6] -> [7,5]
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.ok(state.encounter, 'Stepping onto unexplored FOREST [7,5] with 5% roll (< 22% base) should trigger encounter');
    assert.equal(state.encounter.status, 'DISCOVERED');
    assert.equal(state.adventure.pacing.lastEncounterPacing.baseChancePercent, ENCOUNTER_PACING_CONFIG.terrainBaseChancePercent.FOREST);

    // 3. Slipping past the Stage 1 encounter onto [7,4] grants an immediate post-encounter breathing step (0% chance even with mockRngValue = 0.001)
    mockRngValue = 0.001;
    state = await apiAction('MOVE', { direction: 'NORTH' }); // Bypass at [7,5] and step to [7,4]
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 4);
    assert.equal(state.encounter, null, 'Immediate step after slipping past an encounter must be protected by 0% breathing step');
    assert.equal(state.adventure.pacing.lastEncounterPacing.reason, 'POST_ENCOUNTER_BREATHING_STEP');
    assert.equal(state.adventure.pacing.lastEncounterPacing.chancePercent, 0);

    // 4. Second step after encounter ([7,4] -> [8,4] unexplored FOREST) has 0.40x soft recovery (22% * 0.40 = 8.8%)
    mockRngValue = 0.12; // 12% roll would trigger normal 22% FOREST, but is >= 8.8% soft-recovery rate!
    state = await apiAction('MOVE', { direction: 'EAST' }); // [7,4] -> [8,4]
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 4);
    assert.equal(state.encounter, null, 'Second step after encounter (8.8% soft recovery) must not trigger on a 12% roll');
    assert.equal(state.adventure.pacing.lastEncounterPacing.reason, 'POST_ENCOUNTER_SOFT_RECOVERY');
    assert.ok(state.adventure.pacing.lastEncounterPacing.chancePercent < 10);

    // 5. Anti-oscillation protection: stepping back and forth [8,4] <-> [7,4] repeatedly suppresses random encounters to 0%
    mockRngValue = 0.05; // 5% roll is above the 3.5% 1st-reversal cap
    state = await apiAction('MOVE', { direction: 'WEST' }); // [8,4] -> [7,4] (1st reversal, capped at 3.5%)
    assert.equal(state.encounter, null, '1st immediate reversal is capped at 3.5% and must not trigger on 5% roll');
    assert.equal(state.adventure.pacing.lastEncounterPacing.reason, 'IMMEDIATE_BACKTRACK_DAMPENED');
    mockRngValue = 0.001; // Even at 0.1% roll, repeated oscillation ([7,4] -> [8,4]) is 0%!
    state = await apiAction('MOVE', { direction: 'EAST' }); // [7,4] -> [8,4] (oscillationTail >= 3 -> 0%!)
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 4);
    assert.equal(state.encounter, null, 'Repeated 2-tile oscillation [7,4] <-> [8,4] must have 0% encounter chance');
    assert.equal(state.adventure.pacing.lastEncounterPacing.reason, 'ANTI_OSCILLATION_SUPPRESSED');
    assert.equal(state.adventure.pacing.lastEncounterPacing.chancePercent, 0);

    // 6. Recently Cleared Site (CLEARED_SITE): winning combat on [8,4] protects [8,4] at 0% for 8 steps
    mockRngValue = 0.99; // High d20 roll guarantees a hit/kill on the 1 HP Goblin
    await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Goblin', preserveFacing: true });
    db.prepare('UPDATE encounters SET current_monster_hp = 1 WHERE character_id = ? AND status = ?').run(state.character.id, 'IN_COMBAT');
    const atkRes = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ATTACK' })
    }).then(r => r.json());
    if (atkRes.state && atkRes.state.encounter) {
      db.prepare("UPDATE encounters SET status = 'VICTORY', current_monster_hp = 0 WHERE id = ?").run(atkRes.state.encounter.id);
    }
    mockRngValue = 0.99;
    await apiAction('MOVE', { direction: 'NORTH' }); // [8,4] -> [8,3]
    await apiAction('MOVE', { direction: 'WEST' });  // [8,3] -> [7,3]
    await apiAction('MOVE', { direction: 'SOUTH' }); // [7,3] -> [7,4]
    mockRngValue = 0.001; // Step back onto recently cleared [8,4] via non-oscillating loop!
    state = await apiAction('MOVE', { direction: 'EAST' }); // [7,4] -> [8,4]
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 4);
    assert.equal(state.adventure.revisitStatus, REVISIT_STATUS_TYPES.CLEARED_SITE);
    assert.equal(state.encounter, null, 'Stepping onto a recently cleared tile within 8 steps must have 0% random encounter chance');
    assert.equal(state.adventure.pacing.lastEncounterPacing.reason, 'RECENTLY_CLEARED_SITE_PROTECTED');
    assert.equal(state.adventure.pacing.lastEncounterPacing.chancePercent, 0);
  });

  it('14. Phase 2 Workstream B4: Runs deterministic 500-seed Encounter Pacing Simulation across Scenarios A–I and verifies all design targets', () => {
    const sim = runEncounterPacingSimulation({ runs: 500, baseSeed: 202602 });
    const sc = sim.scenarios;

    // 1. Terrain danger hierarchy: Plains (B) < Forest (A) < Swamp (C)
    assert.ok(
      sc.B.paced.meanEncounters < sc.A.paced.meanEncounters,
      `Expected Plains (${sc.B.paced.meanEncounters}) < Forest (${sc.A.paced.meanEncounters})`
    );
    assert.ok(
      sc.A.paced.meanEncounters < sc.C.paced.meanEncounters,
      `Expected Forest (${sc.A.paced.meanEncounters}) < Swamp (${sc.C.paced.meanEncounters})`
    );

    // 2. Zero back-to-back random encounters in Scenarios A, B, C, D, F, G, H
    for (const code of ['A', 'B', 'C', 'D', 'F', 'G', 'H']) {
      assert.equal(
        sc[code].paced.meanBackToBackEncounters,
        0,
        `Scenario ${code} must have 0 back-to-back random encounters in Phase 2 Paced mode`
      );
    }

    // 3. Scenario D (10 out, 10 back): Return leg is significantly calmer than Outbound leg
    assert.ok(
      sc.D.paced.returnMeanEncounters < sc.D.paced.outboundMeanEncounters * 0.55,
      `Expected return leg (${sc.D.paced.returnMeanEncounters}) to be < 55% of outbound leg (${sc.D.paced.outboundMeanEncounters})`
    );

    // 4. Scenario E (20 rotations on same tile): 0 encounters
    assert.equal(sc.E.paced.meanEncounters, 0);
    assert.equal(sc.E.baseline.meanEncounters, 0);

    // 5. Scenario F (30 oscillations between 2 adjacent tiles): >90% reduction vs unpaced baseline
    assert.ok(
      sc.F.paced.meanEncounters < 0.5 && sc.F.baseline.meanEncounters > 6.5,
      `Expected Scenario F oscillation encounters (${sc.F.paced.meanEncounters}) << baseline (${sc.F.baseline.meanEncounters})`
    );

    // 6. Scenario G (Sanctuary & Town Gate threshold): 0 encounters
    assert.equal(sc.G.paced.meanEncounters, 0);

    // 7. Scenario H (Recently cleared patrol loop): >85% reduction vs unpaced baseline
    assert.ok(
      sc.H.paced.meanEncounters < 0.75 && sc.H.baseline.meanEncounters >= 4.5,
      `Expected Scenario H cleared patrol encounters (${sc.H.paced.meanEncounters}) << baseline (${sc.H.baseline.meanEncounters})`
    );

    // 8. Scenario I (Fixed authored / persistent encounter): 100% trigger rate preserved
    assert.equal(sc.I.paced.authoredTriggerRatePct, 100);
  });

  it('15. Phase 2 Workstream C: Resolves Blackwater River barrier views, northern Mirkwood mountain barriers, HILLS<->SWAMP transitions, and [7,9] NORTH South Gate approach', async () => {
    mockRngValue = 0.99;
    await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });

    // 1. C1: Blackwater River barrier views from FOREST tiles ([8,4] EAST, [8,5] EAST, [8,5] SOUTH, [9,3] SOUTH, [10,4] WEST, [10,5] WEST)
    const riverViewpoints = [
      { x: 8, y: 4, facing: 'EAST' },
      { x: 8, y: 5, facing: 'EAST' },
      { x: 8, y: 5, facing: 'SOUTH' },
      { x: 9, y: 3, facing: 'SOUTH' },
      { x: 10, y: 4, facing: 'WEST' },
      { x: 10, y: 5, facing: 'WEST' }
    ];
    for (const vp of riverViewpoints) {
      const st = await apiAction('TELEPORT_TO_TILE', vp);
      const sceneC = st.viewportScene.scenes.C;
      assert.equal(sceneC.isBlockedAhead, true, `[${vp.x},${vp.y}] ${vp.facing} must be marked blocked ahead`);
      assert.equal(sceneC.blockedObstacleTerrain, 'RIVER_LAKE');
      assert.equal(
        sceneC.imageUrl,
        '/lab-assets/images/perspective/barrier_blackwater_bank_pov.jpg',
        `[${vp.x},${vp.y}] ${vp.facing} facing Blackwater River must show barrier_blackwater_bank_pov.jpg, not a dry pine trail`
      );
      assert.equal(sceneC.viewCategory, 'BARRIER');
    }

    // 2. [8,4] Mirkwood Forest now has 4 distinct directional images across N/E/S/W (EAST river barrier no longer collides with SOUTH pine ravine!)
    const images84 = new Set();
    for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      const st = await apiAction('TELEPORT_TO_TILE', { x: 8, y: 4, facing: dir });
      images84.add(st.viewportScene.scenes.C.imageUrl);
    }
    assert.equal(images84.size, 4, '[8,4] Mirkwood Forest must resolve 4 distinct directional images across N/E/S/W');

    // 3. C2: Northern Mirkwood edge [4,1]..[11,1] facing NORTH (Darkmount Peaks) shows barrier_darkmount_crags_pov.jpg, while [7,5] WEST keeps Stonefang Crag
    for (let x = 4; x <= 11; x++) {
      const st = await apiAction('TELEPORT_TO_TILE', { x, y: 1, facing: 'NORTH' });
      const sceneC = st.viewportScene.scenes.C;
      assert.equal(sceneC.isBlockedAhead, true);
      assert.equal(sceneC.variantKey, 'pov_wilderness_facing_mountain_wall');
      assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/barrier_darkmount_crags_pov.jpg');
    }
    const st75W = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 5, facing: 'WEST' });
    assert.equal(st75W.viewportScene.scenes.C.variantKey, 'pov_forest_facing_crag_wall');
    assert.equal(st75W.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_west.jpg');

    // 4. C3/C4: HILLS <-> SWAMP transitions at y=8 <-> y=9 and [7,9] NORTH South Gate approach
    const stHillsToSwamp = await apiAction('TELEPORT_TO_TILE', { x: 3, y: 8, facing: 'SOUTH' });
    assert.equal(stHillsToSwamp.viewportScene.scenes.C.variantKey, 'pov_transition_hills_to_swamp');
    assert.equal(stHillsToSwamp.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/transition_hills_to_swamp_pov.jpg');

    const stSwampToHills = await apiAction('TELEPORT_TO_TILE', { x: 3, y: 9, facing: 'NORTH' });
    assert.equal(stSwampToHills.viewportScene.scenes.C.variantKey, 'pov_transition_swamp_to_hills');
    assert.equal(stSwampToHills.viewportScene.scenes.C.imageUrl, '/lab-assets/images/terrain/hills_highland_ridge_pov.jpg');

    const st79N = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 9, facing: 'NORTH' });
    assert.equal(st79N.viewportScene.scenes.C.povTier, 1);
    assert.equal(st79N.viewportScene.scenes.C.variantKey, 'fp_fen_7_9_north');
    assert.equal(st79N.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/south_gate_7_8_north.jpg');
  });

  it('16. Phase 2 Workstream A: Preserves atomic coordinates and facing on blocked moves and rotations without false steps or encounters', async () => {
    mockRngValue = 0.001; // Even with 0.1% RNG, turning in place or bumping a barrier must never spawn an encounter
    await apiAction('START_EXPEDITION', { expeditionKey: 'MIRKWOOD_EXPEDITION', teleportToStart: true });
    let state = await apiAction('TELEPORT_TO_TILE', { x: 8, y: 4, facing: 'EAST' }); // Facing Blackwater River [9,4]
    const stepBefore = state.adventure.stepCounter;

    // Attempt blocked forward move into Blackwater River [9,4]
    const blockedRes = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'MOVE', relative: 'FORWARD' })
    }).then(r => r.json());
    assert.equal(blockedRes.ok, false);
    assert.equal(blockedRes.state.currentTile.x, 8);
    assert.equal(blockedRes.state.currentTile.y, 4);
    assert.equal(blockedRes.state.facing, 'EAST');
    assert.equal(blockedRes.state.adventure.stepCounter, stepBefore, 'Blocked move must not increment stepCounter');
    assert.equal(blockedRes.state.encounter, null, 'Blocked move must never roll an encounter');
    assert.equal(blockedRes.state.fxCue.type, 'BLOCKED_MOVE');

    // Rotate 20 times in place at [8,4] with mockRngValue = 0.001 -> zero encounters, zero coordinate drift, zero stepCounter increase
    for (let i = 0; i < 20; i++) {
      state = await apiAction('TURN', { direction: i % 2 === 0 ? 'LEFT' : 'RIGHT' });
      assert.equal(state.currentTile.x, 8);
      assert.equal(state.currentTile.y, 4);
      assert.equal(state.adventure.stepCounter, stepBefore);
      assert.equal(state.encounter, null, 'Turning on the same tile must never trigger a random encounter');
    }
  });
});
