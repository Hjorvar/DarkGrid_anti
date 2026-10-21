/**
 * Darkgrid Action UI Lab — Automated Verification Suite
 * Strictly self-contained inside action-ui-lab/.
 * Run with: node --test action-ui-lab/tests/action-lab.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const { createLabApp, computeTileFacingSeed } = require('../server');

const TEST_DB_PATH = path.join(__dirname, '../data/test_action_lab.sqlite');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = TEST_DB_PATH + suffix;
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch (_err) {
        // ignore if locked momentarily
      }
    }
  }
}

describe('Darkgrid Action UI Lab — First-Person Facing, Map Viewport, Encounters & Combat Flow', () => {
  let server;
  let baseUrl;
  let app;
  let mockRngValue = 0.5;

  async function apiGetState() {
    const res = await fetch(`${baseUrl}/api/state`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    return json.state;
  }

  async function apiAction(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.state, 'Response must always include state');
    return json.state;
  }

  before(async () => {
    cleanupTestDb();
    app = createLabApp({
      dbPath: TEST_DB_PATH,
      rng: () => mockRngValue
    });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (app && app.locals && app.locals.db) {
      try {
        app.locals.db.close();
      } catch (_e) {
        // ignore
      }
    }
    cleanupTestDb();
  });

  it('1. Initializes at Oakhaven (7,7) facing NORTH and persists facing across reloads', async () => {
    let state = await apiAction('LAB_SCENARIO', { scenario: 'CITY' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.viewportScene.ahead1.x, 7);
    assert.equal(state.viewportScene.ahead1.y, 6);
    assert.equal(state.viewportScene.ahead1.name, 'Oakhaven North Gate');

    // Turn RIGHT -> EAST
    state = await apiAction('TURN', { turn: 'RIGHT' });
    assert.equal(state.facing, 'EAST');
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.viewportScene.ahead1.x, 8);
    assert.equal(state.viewportScene.ahead1.y, 7);
    assert.equal(state.viewportScene.ahead1.name, 'The Old Stone Bridge');

    // Reload state via GET /api/state -> facing EAST must persist
    const reloaded = await apiGetState();
    assert.equal(reloaded.facing, 'EAST');
    assert.equal(reloaded.viewportScene.ahead1.name, 'The Old Stone Bridge');

    // Turn RIGHT -> SOUTH, RIGHT -> WEST, LEFT -> SOUTH, LEFT -> EAST, LEFT -> NORTH
    state = await apiAction('TURN', { turn: 'RIGHT' });
    assert.equal(state.facing, 'SOUTH');
    state = await apiAction('TURN', { turn: 'RIGHT' });
    assert.equal(state.facing, 'WEST');
    state = await apiAction('TURN', { turn: 'LEFT' });
    assert.equal(state.facing, 'SOUTH');
    state = await apiAction('TURN', { turn: 'LEFT' });
    assert.equal(state.facing, 'EAST');
    state = await apiAction('TURN', { turn: 'LEFT' });
    assert.equal(state.facing, 'NORTH');
  });

  it('2. Executes relative movements (FORWARD, BACKWARD, STRAFE_LEFT, STRAFE_RIGHT) accurately for each facing', async () => {
    // Suppress random encounters during pure navigation test by setting high RNG roll (d20 > threshold)
    mockRngValue = 0.99;

    let state = await apiAction('LAB_SCENARIO', { scenario: 'CITY' });
    // Facing NORTH at (7,7): FORWARD moves North to (7,6) Oakhaven North Gate
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.facing, 'NORTH');

    // Step BACKWARD while facing NORTH -> returns South to (7,7) Oakhaven
    state = await apiAction('MOVE', { relative: 'BACKWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);

    // Turn EAST at (7,7):
    // - FORWARD moves East to (8,7) The Old Stone Bridge
    // - BACKWARD moves West back to (7,7)
    // - STRAFE_LEFT moves North to (7,6)
    // - STRAFE_RIGHT moves South back to (7,7)
    state = await apiAction('TURN', { turn: 'RIGHT' });
    assert.equal(state.facing, 'EAST');

    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.currentTile.name, 'The Old Stone Bridge');

    state = await apiAction('MOVE', { relative: 'BACKWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);

    state = await apiAction('MOVE', { relative: 'STRAFE_LEFT' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);

    state = await apiAction('MOVE', { relative: 'STRAFE_RIGHT' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);
  });

  it('3. Connects viewportScene to map topology, obstacles, and deterministic seed', async () => {
    mockRngValue = 0.99;

    // Teleport to (7,5) Mirkwood Forest Crossroads facing NORTH
    let state = await apiAction('LAB_SCENARIO', { scenario: 'WILDERNESS' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.facing, 'NORTH');

    const seedNorth1 = state.viewportScene.seed;
    // Ahead is (7,4) Mirkwood Forest (same terrain FOREST, passable, different aheadSeed)
    assert.equal(state.viewportScene.ahead1.x, 7);
    assert.equal(state.viewportScene.ahead1.y, 4);
    assert.equal(state.viewportScene.ahead1.terrain, 'FOREST');
    assert.equal(state.viewportScene.ahead1.isPassable, true);
    assert.equal(state.viewportScene.isAheadBlocked, false);
    assert.notEqual(state.viewportScene.aheadSeed, seedNorth1);

    // Left is (6,5) Stonefang Crag (MOUNTAINS, impassable)
    assert.equal(state.viewportScene.left1.x, 6);
    assert.equal(state.viewportScene.left1.y, 5);
    assert.equal(state.viewportScene.left1.isPassable, false);

    // Turn LEFT to face WEST toward Stonefang Crag (6,5)
    state = await apiAction('TURN', { turn: 'LEFT' });
    assert.equal(state.facing, 'WEST');
    assert.notEqual(state.viewportScene.seed, seedNorth1);
    assert.equal(state.viewportScene.ahead1.name, 'Stonefang Crag');
    assert.equal(state.viewportScene.ahead1.isPassable, false);
    assert.equal(state.viewportScene.isAheadBlocked, true);
    assert.equal(state.viewportScene.isTerrainTransitionAhead, true);

    // Attempting to move FORWARD into Stonefang Crag must fail with clear feedback and keep hero at (7,5)
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.ok(state.errorMessage && state.errorMessage.toLowerCase().includes('impassable'));
    assert.equal(state.fxCue.type, 'BLOCKED_MOVE');

    // Turning RIGHT back to NORTH restores the exact same deterministic seed
    state = await apiAction('TURN', { turn: 'RIGHT' });
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.viewportScene.seed, seedNorth1);
    assert.equal(computeTileFacingSeed(7, 5, 'NORTH'), seedNorth1);
  });

  it('4. Enforces Stage 1 (DISCOVERED) secrecy, turning stability, and single-action bypass+move', async () => {
    mockRngValue = 0.99;

    // Trigger Stage 1 Mystery Threat at (7,5)
    let state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE1_MYSTERY' });
    const startX = state.currentTile.x;
    const startY = state.currentTile.y;
    assert.ok(state.encounter);
    assert.equal(state.encounter.status, 'DISCOVERED');
    assert.equal(state.encounter.isAmbush, false);

    const encId = state.encounter.id;
    // Strict secrecy check: must NOT expose monsterName, imageUrl, monsterSymbol, or monster HP
    assert.equal(state.encounter.monsterName, undefined);
    assert.equal(state.encounter.imageUrl, undefined);
    assert.equal(state.encounter.monsterSymbol, undefined);
    assert.equal(state.encounter.current_monster_hp, undefined);
    assert.ok(typeof state.encounter.resolvedDescription === 'string' && state.encounter.resolvedDescription.length > 5);

    // Turning on the same tile must NOT re-roll or delete the DISCOVERED encounter
    state = await apiAction('TURN', { turn: 'LEFT' });
    assert.equal(state.facing, 'WEST');
    assert.ok(state.encounter);
    assert.equal(state.encounter.id, encId);
    assert.equal(state.encounter.status, 'DISCOVERED');

    // Turn back NORTH and step BACKWARD (South to startY + 1) in a single action -> bypasses encounter AND moves!
    state = await apiAction('TURN', { turn: 'RIGHT' });
    assert.equal(state.facing, 'NORTH');

    state = await apiAction('MOVE', { relative: 'BACKWARD' });
    assert.equal(state.currentTile.x, startX);
    assert.equal(state.currentTile.y, startY + 1);
    assert.equal(state.encounter, null);
    assert.equal(state.fxCue.bypassedPrevious, true);
  });

  it('5. Does not consume a DISCOVERED encounter if the attempted bypass move is into an obstacle, and blocks bypass on Ambush', async () => {
    mockRngValue = 0.99;

    // Teleport to (7,5) Crossroads and trigger STAGE1_MYSTERY there
    await apiAction('LAB_SCENARIO', { scenario: 'WILDERNESS' });
    let state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE1_MYSTERY' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.encounter.status, 'DISCOVERED');

    // Turn WEST toward impassable Stonefang Crag (6,5)
    state = await apiAction('TURN', { turn: 'LEFT' });
    assert.equal(state.facing, 'WEST');

    // Attempt to move FORWARD (West into impassable Stonefang Crag):
    // Move must be rejected AND the DISCOVERED encounter must still be active!
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.ok(state.encounter);
    assert.equal(state.encounter.status, 'DISCOVERED');
    assert.equal(state.fxCue.type, 'BLOCKED_MOVE');

    // Now test STAGE1_AMBUSH: must block both IGNORE and MOVE
    state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE1_AMBUSH' });
    const ambushX = state.currentTile.x;
    const ambushY = state.currentTile.y;
    assert.ok(state.encounter);
    assert.equal(state.encounter.status, 'DISCOVERED');
    assert.equal(state.encounter.isAmbush, true);

    state = await apiAction('IGNORE');
    assert.ok(state.encounter);
    assert.equal(state.encounter.status, 'DISCOVERED');
    assert.ok(state.errorMessage && state.errorMessage.includes('Ambush'));

    state = await apiAction('MOVE', { relative: 'BACKWARD' });
    assert.equal(state.currentTile.x, ambushX);
    assert.equal(state.currentTile.y, ambushY);
    assert.ok(state.encounter);
    assert.equal(state.encounter.status, 'DISCOVERED');
    assert.ok(state.errorMessage && state.errorMessage.includes('Ambush'));

    // Engaging the ambush transitions cleanly to IN_COMBAT
    state = await apiAction('INVESTIGATE');
    assert.ok(state.encounter);
    assert.equal(state.encounter.status, 'IN_COMBAT');
    assert.ok(state.encounter.monsterName);
  });

  it('6. Produces ordered combatSequence beats (HERO -> MONSTER -> OUTCOME), shows "Miss" on misses, and guards against duplicate expectedRound requests', async () => {
    // Start active combat with Ghoul
    mockRngValue = 0.05; // Low roll -> Miss
    let state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Ghoul' });
    assert.ok(state.encounter);
    assert.equal(state.encounter.status, 'IN_COMBAT');
    const initialRound = state.encounter.combat_round;

    // Turning during active combat is allowed visually and does not advance combat_round or trigger a free attack
    state = await apiAction('TURN', { turn: 'RIGHT' });
    assert.equal(state.facing, 'EAST');
    assert.equal(state.encounter.combat_round, initialRound);
    assert.equal(state.combatSequence, null);

    // Execute a round where both Hero and Monster miss (mockRngValue = 0.05 -> d20 roll = 2)
    state = await apiAction('ATTACK', { expectedRound: initialRound });
    assert.ok(state.combatSequence);
    assert.ok(Array.isArray(state.combatSequence.beats));
    assert.ok(state.combatSequence.beats.length >= 2);

    const heroBeat = state.combatSequence.beats[0];
    assert.equal(heroBeat.actor, 'HERO');
    assert.equal(heroBeat.outcome, 'MISS');
    assert.equal(heroBeat.popupLabel, 'Miss'); // Never "Blocked"

    const monsterBeat = state.combatSequence.beats.find(b => b.actor === 'MONSTER');
    assert.ok(monsterBeat);
    assert.equal(monsterBeat.outcome, 'MISS');
    assert.equal(monsterBeat.popupLabel, 'Miss');

    // Duplicate/rapid request with stale expectedRound must be rejected without advancing round
    const roundAfterFirstAttack = state.encounter.combat_round;
    const duplicateState = await apiAction('ATTACK', { expectedRound: initialRound });
    assert.equal(duplicateState.encounter.combat_round, roundAfterFirstAttack);
    assert.equal(duplicateState.combatSequence, null);
  });

  it('7. Ensures dead monsters do not counterattack, grants rewards once, and allows seamless 1-step movement after victory', async () => {
    // Set high RNG roll so hero hits and crits
    mockRngValue = 0.96; // d20 = 20 (Crit!)

    let state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Ghoul' });
    const startX = state.currentTile.x;
    const startY = state.currentTile.y;
    const xpBefore = state.character.xp;
    const goldBefore = state.character.gold;
    const encId = state.encounter.id;

    // Set monster HP to 1 so the hero's strike is guaranteed to slay it on this beat
    app.locals.db.prepare('UPDATE encounters SET current_monster_hp = 1 WHERE id = ?').run(encId);

    state = await apiAction('ATTACK', { expectedRound: state.encounter.combat_round });
    assert.equal(state.encounter, null);
    assert.ok(state.victory, 'Victory state should be present after slaying the monster');
    assert.ok(state.combatSequence);

    // Verify beat order: HERO hit -> OUTCOME (VICTORY), with ZERO MONSTER_ATTACK beats after monster death
    const beats = state.combatSequence.beats;
    assert.equal(beats[0].actor, 'HERO');
    const monsterCounterBeats = beats.filter(b => b.actor === 'MONSTER' && b.eventType === 'MONSTER_ATTACK');
    assert.equal(monsterCounterBeats.length, 0, 'Dead monster must not get a counterattack');
    assert.equal(beats[beats.length - 1].actor, 'OUTCOME');
    assert.equal(beats[beats.length - 1].outcome, 'VICTORY');

    // Verify XP and Gold were awarded once
    const xpAfterVictory = state.character.xp;
    const goldAfterVictory = state.character.gold;
    assert.equal(xpAfterVictory, xpBefore + state.victory.xpAwarded);
    assert.equal(goldAfterVictory, goldBefore + state.victory.goldLooted);

    // Reloading state via GET /api/state keeps victory banner and does NOT duplicate rewards
    const reloaded = await apiGetState();
    assert.ok(reloaded.victory);
    assert.equal(reloaded.character.xp, xpAfterVictory);
    assert.equal(reloaded.character.gold, goldAfterVictory);

    // Next valid movement (without clicking "Continue Exploring") dismisses victory and moves the hero in 1 action!
    mockRngValue = 0.99; // no new encounter on step
    await apiAction('TURN', { facing: 'NORTH' });
    const movedState = await apiAction('MOVE', { relative: 'BACKWARD' });
    assert.equal(movedState.currentTile.x, startX);
    assert.equal(movedState.currentTile.y, startY + 1);
    assert.equal(movedState.victory, null, 'Victory overlay must auto-dismiss on movement');
    assert.equal(movedState.character.xp, xpAfterVictory, 'XP must remain intact after moving');
    assert.equal(movedState.character.gold, goldAfterVictory, 'Gold must remain intact after moving');
  });

  it('8. Enforces bridge water flanks, eastern ruins transition, and world map boundaries', async () => {
    mockRngValue = 0.99;

    // Start at Oakhaven (7,7), turn EAST, step onto The Old Stone Bridge (8,7)
    await apiAction('LAB_SCENARIO', { scenario: 'CITY' });
    await apiAction('TURN', { facing: 'EAST' });
    let state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.currentTile.name, 'The Old Stone Bridge');

    // On the bridge facing EAST:
    // - Left (North, 8,6) is impassable Blackwater River
    // - Right (South, 8,8) is impassable Blackwater River
    // - Ahead (East, 9,7) is passable Bridge East Watchpost (UNDERGROUND_RUINS)
    assert.equal(state.viewportScene.left1.isPassable, false);
    assert.equal(state.viewportScene.left1.terrain, 'RIVER_LAKE');
    assert.equal(state.viewportScene.right1.isPassable, false);
    assert.equal(state.viewportScene.right1.terrain, 'RIVER_LAKE');
    assert.equal(state.viewportScene.ahead1.isPassable, true);
    assert.equal(state.viewportScene.ahead1.name, 'Bridge East Watchpost');

    // Strafe LEFT into Blackwater River must be blocked
    state = await apiAction('MOVE', { relative: 'STRAFE_LEFT' });
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.fxCue.type, 'BLOCKED_MOVE');

    // Step FORWARD onto Bridge East Watchpost (9,7)
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 9);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.currentTile.terrain, 'UNDERGROUND_RUINS');

    // Test world boundary at y = 0 facing NORTH
    const northEdgeTile = app.locals.db.prepare('SELECT * FROM map_tiles WHERE y = 0 AND is_passable = 1 LIMIT 1').get();
    if (northEdgeTile) {
      app.locals.db.prepare("UPDATE characters SET tile_id = ?, facing = 'NORTH' WHERE id = ?").run(northEdgeTile.id, state.character.id);
      state = await apiGetState();
      assert.equal(state.viewportScene.ahead1.exists, false);
      assert.equal(state.viewportScene.ahead1.obstacleType, 'WORLD_EDGE');
      assert.equal(state.viewportScene.isAheadBlocked, true);

      const edgeMove = await apiAction('MOVE', { relative: 'FORWARD' });
      assert.equal(edgeMove.currentTile.x, northEdgeTile.x);
      assert.equal(edgeMove.currentTile.y, 0);
      assert.equal(edgeMove.fxCue.type, 'BLOCKED_MOVE');
    }
  });

  it('9. Sequences combat POTION and FLEE actions with accurate HP progression', async () => {
    mockRngValue = 0.5;
    let state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Assassin Vine' });
    assert.ok(state.encounter);
    assert.equal(state.encounter.status, 'IN_COMBAT');

    // Wound hero to 5 HP so potion healing is visible
    app.locals.db.prepare('UPDATE characters SET current_hp = 5 WHERE id = ?').run(state.character.id);
    state = await apiGetState();
    assert.equal(state.character.current_hp, 5);

    // Drink potion in combat (with low RNG so monster misses after potion)
    mockRngValue = 0.05;
    state = await apiAction('POTION', { expectedRound: state.encounter.combat_round });
    assert.ok(state.combatSequence);
    assert.equal(state.combatSequence.beats[0].actor, 'HERO');
    assert.equal(state.combatSequence.beats[0].outcome, 'HEAL');
    assert.ok(state.combatSequence.beats[0].heroHpAfterBeat > 5);

    // Flee combat
    state = await apiAction('FLEE', { expectedRound: state.encounter.combat_round });
    assert.equal(state.encounter, null);
    assert.ok(state.combatSequence);
    assert.equal(state.combatSequence.outcome, 'ESCAPED');
  });

  it('10. Serves clean SPA HTML without duplicate Hero/Pack/Rest/Stance controls', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();

    // Must include new first-person navigation & viewport elements
    assert.ok(html.includes('id="fp-ahead-portal"'));
    assert.ok(html.includes('id="fp-scene-svg-wrap"'));
    assert.ok(html.includes('id="compass-rose-ring"'));
    assert.ok(html.includes('id="pad-turn-left"'));
    assert.ok(html.includes('id="pad-turn-right"'));
    assert.ok(html.includes('id="pad-strafe-left"'));
    assert.ok(html.includes('id="pad-strafe-right"'));

    // Must NOT include old duplicate top-bar or 3x3 corner buttons
    assert.equal(html.includes('id="btn-top-stance"'), false);
    assert.equal(html.includes('id="btn-top-rest"'), false);
    assert.equal(html.includes('id="pad-tl"'), false);
    assert.equal(html.includes('id="pad-tr"'), false);
    assert.equal(html.includes('id="pad-bl"'), false);
    assert.equal(html.includes('id="pad-br"'), false);
  });

  it('11. Enforces zero-scroll 100dvh viewport CSS and no-store cache headers on static assets', async () => {
    const cssRes = await fetch(`${baseUrl}/lab-assets/action-ui.css`);
    assert.equal(cssRes.status, 200);
    assert.ok(String(cssRes.headers.get('cache-control') || '').includes('no-store'));
    const css = await cssRes.text();

    assert.ok(css.includes('100dvh'), 'CSS must use 100dvh viewport height lock');
    assert.ok(css.includes('overflow: hidden'), 'CSS must lock document/shell overflow to prevent scrolling');
    assert.equal(css.includes('min-height: 660px'), false, 'CSS must not force a 660px min-height that causes laptop scrolling');

    const jsRes = await fetch(`${baseUrl}/lab-assets/action-ui.js`);
    assert.equal(jsRes.status, 200);
    assert.ok(String(jsRes.headers.get('cache-control') || '').includes('no-store'));
  });

  it('12. Resolves deterministic multi-variant forest scenes and landmark overrides without repeating on consecutive steps', async () => {
    mockRngValue = 0.99;

    // Verify all 4 newly added test paintings in action-ui-lab/public/images/terrain/ serve HTTP 200
    const labImages = [
      '/lab-assets/images/terrain/forest_monolith_clearing.jpg',
      '/lab-assets/images/terrain/forest_pine_ravine.jpg',
      '/lab-assets/images/terrain/forest_ancient_oak.jpg',
      '/lab-assets/images/terrain/watchpost_ruins_exterior.jpg'
    ];
    for (const imgUrl of labImages) {
      const imgRes = await fetch(`${baseUrl}${imgUrl}`);
      assert.equal(imgRes.status, 200, `Expected 200 OK for ${imgUrl}`);
    }

    // Start at (7,5) Mirkwood Crossroads facing NORTH in Mode A
    await apiAction('SET_SCENE_MODE', { sceneMode: 'A' });
    let state = await apiAction('LAB_SCENARIO', { scenario: 'WILDERNESS' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.sceneMode, 'A');

    const img75 = state.viewportScene.scenes.A.imageUrl;
    const key75 = state.viewportScene.scenes.A.variantKey;
    assert.equal(key75, 'forest_monolith_clearing');

    // Step NORTH to (7,4) Mirkwood Forest -> must use a different forest painting!
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 4);
    const img74 = state.viewportScene.scenes.A.imageUrl;
    const key74 = state.viewportScene.scenes.A.variantKey;
    assert.notEqual(img74, img75, 'Adjacent forest tiles (7,5) and (7,4) must not show the same painting');
    assert.equal(key74, 'forest_deep_boughs');

    // Step NORTH to (7,3) Heart of the Mirkwood (feature: ANCIENT_OAK) -> must override generic forest with landmark_ancient_oak!
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 3);
    assert.equal(state.currentTile.feature, 'ANCIENT_OAK');
    const img73 = state.viewportScene.scenes.A.imageUrl;
    const key73 = state.viewportScene.scenes.A.variantKey;
    assert.equal(key73, 'landmark_ancient_oak');
    assert.equal(state.viewportScene.scenes.A.matchSource, 'LANDMARK_OVERRIDE');
    assert.notEqual(img73, img74);
    assert.notEqual(img73, img75);

    // Step BACKWARD to (7,4) and BACKWARD to (7,5) -> must deterministically restore the exact same paintings
    state = await apiAction('MOVE', { relative: 'BACKWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 4);
    assert.equal(state.viewportScene.scenes.A.variantKey, key74);
    assert.equal(state.viewportScene.scenes.A.imageUrl, img74);

    state = await apiAction('MOVE', { relative: 'BACKWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.viewportScene.scenes.A.variantKey, key75);
    assert.equal(state.viewportScene.scenes.A.imageUrl, img75);
  });

  it('13. Compares Mode A (Single Scene) vs Mode B (Directional Scene) across 4-direction rotation and Bridge/Watchpost landmarks', async () => {
    mockRngValue = 0.99;

    // Position at (7,5) Mirkwood Crossroads
    let state = await apiAction('LAB_SCENARIO', { scenario: 'WILDERNESS' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);

    // Switch to Mode B (Directional Scene) and persist
    state = await apiAction('SET_SCENE_MODE', { sceneMode: 'B' });
    assert.equal(state.sceneMode, 'B');
    assert.equal(state.viewportScene.activeScene.mode, 'B');

    // Collect Mode A and Mode B variant keys across all 4 facings at (7,5):
    // North = (7,4) Forest, East = (8,5) Forest Ravine, South = (7,6) North Gate, West = (6,5) Stonefang Crag
    const modeAByFacing = {};
    const modeBByFacing = {};

    for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      state = await apiAction('TURN', { facing: dir });
      assert.equal(state.facing, dir);
      const sA = state.viewportScene.scenes.A;
      const sB = state.viewportScene.scenes.B;
      assert.equal(sA.useAheadPortal, false, 'Mode A must never blend two paintings via ahead-portal');
      assert.equal(sA.useLegacySvg, false, 'Mode A must never draw legacy geometric SVG overlays');
      assert.equal(sB.useAheadPortal, false, 'Mode B must never blend two paintings via ahead-portal');
      assert.equal(sB.useLegacySvg, false, 'Mode B must never draw legacy geometric SVG overlays');
      modeAByFacing[dir] = sA.variantKey;
      modeBByFacing[dir] = sB.variantKey;
    }

    // In Mode A at (7,5), passable directions (N, E, S) stay anchored to the Waystone Clearing ('forest_monolith_clearing'),
    // while facing WEST into impassable Stonefang Crag shows the mountain barrier ('mountains_jagged_wall')
    assert.equal(modeAByFacing.NORTH, 'forest_monolith_clearing');
    assert.equal(modeAByFacing.EAST, 'forest_monolith_clearing');
    assert.equal(modeAByFacing.SOUTH, 'forest_monolith_clearing');
    assert.equal(modeAByFacing.WEST, 'mountains_jagged_wall');

    // In Mode B at (7,5), each of the 4 directions shows a distinct cohesive painting of what lies ahead!
    assert.equal(modeBByFacing.NORTH, 'forest_deep_boughs');
    assert.equal(modeBByFacing.EAST, 'forest_pine_ravine');
    assert.equal(modeBByFacing.SOUTH, 'landmark_town_gates');
    assert.equal(modeBByFacing.WEST, 'mountains_jagged_wall');
    const uniqueModeB = new Set(Object.values(modeBByFacing));
    assert.equal(uniqueModeB.size, 4, 'All 4 facings at Crossroads (7,5) in Mode B must show distinct cohesive paintings');

    // Now test The Old Stone Bridge (8,7) scenario
    state = await apiAction('LAB_SCENARIO', { scenario: 'BRIDGE' });
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.facing, 'EAST');

    // Facing EAST on the bridge toward Bridge East Watchpost (9,7):
    // Both Mode A and Mode B show the cohesive Stone Bridge painting (no double-exposed dungeon vault!)
    assert.equal(state.viewportScene.scenes.A.variantKey, 'landmark_stone_bridge');
    assert.equal(state.viewportScene.scenes.B.variantKey, 'landmark_stone_bridge');

    // Facing WEST on the bridge back toward Oakhaven (7,7):
    // Mode A keeps the Stone Bridge; Mode B shows the Oakhaven West Bank Gatehouse ('landmark_town_gates')
    state = await apiAction('TURN', { facing: 'WEST' });
    assert.equal(state.viewportScene.scenes.A.variantKey, 'landmark_stone_bridge');
    assert.equal(state.viewportScene.scenes.B.variantKey, 'landmark_town_gates');

    // Facing NORTH on the bridge toward impassable Blackwater River (8,6):
    // Both Mode A and Mode B show the churning river barrier ('river_blackwater')
    state = await apiAction('TURN', { facing: 'NORTH' });
    assert.equal(state.viewportScene.scenes.A.variantKey, 'river_blackwater');
    assert.equal(state.viewportScene.scenes.B.variantKey, 'river_blackwater');

    // Step EAST onto Bridge East Watchpost (9,7): uses the exterior watchpost ruins painting!
    await apiAction('TURN', { facing: 'EAST' });
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 9);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.viewportScene.scenes.A.variantKey, 'landmark_watchpost_ruins');
    assert.equal(state.viewportScene.scenes.A.imageUrl, '/lab-assets/images/terrain/watchpost_ruins_exterior.jpg');
    assert.equal(state.viewportScene.scenes.B.variantKey, 'landmark_watchpost_ruins');
  });

  it('14. Supports RESET_WORLD scenario and preserves sceneMode across class switches and revives', async () => {
    await apiAction('SET_SCENE_MODE', { sceneMode: 'B' });
    let state = await apiAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'RANGER' });
    assert.equal(state.character.class, 'RANGER');
    assert.equal(state.sceneMode, 'B', 'Scene mode must persist across class switch');

    state = await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.sceneMode, 'B');

    // Switch back to Mode A and Fighter
    await apiAction('SET_SCENE_MODE', { sceneMode: 'A' });
    state = await apiAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'FIGHTER' });
    assert.equal(state.character.class, 'FIGHTER');
    assert.equal(state.sceneMode, 'A');
  });

  it('15. Resolves Mode C (First-Person) 5-Tier POV-First views across (8,7), (7,5), (7,6) without overview or landmark-locked fallbacks', async () => {
    mockRngValue = 0.99;

    // 1. Verify all 10 first-person perspective paintings serve HTTP 200 OK
    const fpImages = [
      '/lab-assets/images/perspective/bridge_8_7_east.jpg',
      '/lab-assets/images/perspective/bridge_8_7_west.jpg',
      '/lab-assets/images/perspective/bridge_8_7_north.jpg',
      '/lab-assets/images/perspective/bridge_8_7_south.jpg',
      '/lab-assets/images/perspective/crossroads_7_5_north.jpg',
      '/lab-assets/images/perspective/crossroads_7_5_south.jpg',
      '/lab-assets/images/perspective/crossroads_7_5_west.jpg',
      '/lab-assets/images/perspective/crossroads_7_5_east.jpg',
      '/lab-assets/images/perspective/north_gate_7_6_north.jpg',
      '/lab-assets/images/perspective/north_gate_7_6_south.jpg'
    ];
    for (const imgUrl of fpImages) {
      const imgRes = await fetch(`${baseUrl}${imgUrl}`);
      assert.equal(imgRes.status, 200, `Expected 200 OK for ${imgUrl}`);
    }

    // 2. Activate Mode C (First-Person)
    let state = await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });
    assert.equal(state.sceneMode, 'C');
    assert.equal(state.viewportScene.activeScene.mode, 'C');

    // 3. Test Location A: The Old Stone Bridge (8,7) across all 4 directions
    state = await apiAction('LAB_SCENARIO', { scenario: 'BRIDGE' });
    assert.equal(state.currentTile.x, 8);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.facing, 'EAST');

    let sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 1);
    assert.equal(sceneC.povTierKey, 'EXACT_POV');
    assert.equal(sceneC.variantKey, 'fp_bridge_8_7_east');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/bridge_8_7_east.jpg');
    assert.equal(sceneC.cameraType, 'POV');
    assert.equal(sceneC.useAheadPortal, false);
    assert.equal(sceneC.useLegacySvg, false);

    // 180° turn to WEST on the Stone Bridge -> Tier 1 Exact POV
    state = await apiAction('TURN', { facing: 'WEST' });
    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 1);
    assert.equal(sceneC.povTierKey, 'EXACT_POV');
    assert.equal(sceneC.variantKey, 'fp_bridge_8_7_west');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/bridge_8_7_west.jpg');

    // 90° turn to NORTH on the Stone Bridge -> Tier 2 Landmark Directional POV (Blackwater River over stone parapet, NEVER exterior bridge overview!)
    state = await apiAction('TURN', { facing: 'NORTH' });
    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 2);
    assert.equal(sceneC.povTierKey, 'LANDMARK_DIRECTIONAL_POV');
    assert.equal(sceneC.variantKey, 'pov_bridge_parapet_north');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/bridge_8_7_north.jpg');
    assert.notEqual(sceneC.imageUrl, '/images/terrain/terrain_bridge.webp');
    assert.equal(sceneC.cameraType, 'POV');
    assert.equal(sceneC.isBlockedAhead, true);

    // 90° turn to SOUTH on the Stone Bridge -> Tier 2 Landmark Directional POV (Blackwater River South over stone parapet)
    state = await apiAction('TURN', { facing: 'SOUTH' });
    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 2);
    assert.equal(sceneC.povTierKey, 'LANDMARK_DIRECTIONAL_POV');
    assert.equal(sceneC.variantKey, 'pov_bridge_parapet_south');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/bridge_8_7_south.jpg');
    assert.notEqual(sceneC.imageUrl, '/images/terrain/terrain_bridge.webp');
    assert.equal(sceneC.cameraType, 'POV');
    assert.equal(sceneC.isBlockedAhead, true);

    // 4. Test Location B: Mirkwood Forest – Crossroads (7,5) across all 4 directions
    state = await apiAction('LAB_SCENARIO', { scenario: 'WILDERNESS' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.facing, 'NORTH');

    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 1);
    assert.equal(sceneC.povTierKey, 'EXACT_POV');
    assert.equal(sceneC.variantKey, 'fp_crossroads_7_5_north');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_north.jpg');

    // 180° turn to SOUTH at (7,5) -> Tier 1 Exact POV
    state = await apiAction('TURN', { facing: 'SOUTH' });
    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 1);
    assert.equal(sceneC.povTierKey, 'EXACT_POV');
    assert.equal(sceneC.variantKey, 'fp_crossroads_7_5_south');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_south.jpg');
    assert.notEqual(sceneC.imageUrl, state.viewportScene.scenes.B.imageUrl);

    // 90° turn to WEST at (7,5) toward impassable Stonefang Crag (6,5) ->
    // Tier 3 Sub-Biome Context POV showing Stonefang Crag cliff from inside Mirkwood (NO waystone monolith in center!)
    state = await apiAction('TURN', { facing: 'WEST' });
    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 3);
    assert.equal(sceneC.povTierKey, 'SUBBIOME_CONTEXT_POV');
    assert.equal(sceneC.variantKey, 'pov_forest_facing_crag_wall');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_west.jpg');
    assert.notEqual(sceneC.imageUrl, '/lab-assets/images/terrain/forest_monolith_clearing.jpg');
    assert.notEqual(sceneC.imageUrl, '/images/terrain/terrain_mountains.webp');
    assert.equal(sceneC.isBlockedAhead, true);

    // 90° turn to EAST at (7,5) toward passable Mirkwood Forest (8,5) ->
    // Tier 3 Sub-Biome Context POV showing eastern Mirkwood forest track (NO waystone monolith in center!)
    state = await apiAction('TURN', { facing: 'EAST' });
    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 3);
    assert.equal(sceneC.povTierKey, 'SUBBIOME_CONTEXT_POV');
    assert.equal(sceneC.variantKey, 'pov_forest_track_east');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/crossroads_7_5_east.jpg');
    assert.notEqual(sceneC.imageUrl, '/lab-assets/images/terrain/forest_monolith_clearing.jpg');
    assert.equal(sceneC.isBlockedAhead, false);

    // 5. Walk SOUTH from (7,5) to Oakhaven North Gate (7,6)
    await apiAction('TURN', { facing: 'SOUTH' });
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.facing, 'SOUTH');

    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 1);
    assert.equal(sceneC.variantKey, 'fp_north_gate_7_6_south');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/north_gate_7_6_south.jpg');

    state = await apiAction('TURN', { facing: 'NORTH' });
    sceneC = state.viewportScene.scenes.C;
    assert.equal(sceneC.povTier, 1);
    assert.equal(sceneC.variantKey, 'fp_north_gate_7_6_north');
    assert.equal(sceneC.imageUrl, '/lab-assets/images/perspective/north_gate_7_6_north.jpg');
  });

  it('16. Enforces scalable POV metadata classification (Tier 4 Generic POV & Tier 5 Safe Neutral POV) and never leaks OVERVIEW or landmark-locked fallbacks', async () => {
    mockRngValue = 0.99;
    await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });

    // Verify metadata columns exist on lab_scene_variants and exclude OVERVIEW / landmark-locked assets from POV fallback pool
    const allVariants = app.locals.db.prepare('SELECT * FROM lab_scene_variants WHERE is_active = 1').all();
    assert.ok(allVariants.length >= 15);
    for (const v of allVariants) {
      assert.ok(['POV', 'OVERVIEW'].includes(v.camera_type), `Invalid camera_type on ${v.variant_key}`);
      assert.ok(['INDOOR', 'OUTDOOR'].includes(v.environment_scope), `Invalid environment_scope on ${v.variant_key}`);
      assert.ok(['LANDMARK', 'SUBBIOME', 'GENERIC_TERRAIN', 'BARRIER'].includes(v.view_category), `Invalid view_category on ${v.variant_key}`);
      assert.ok(['OMNIDIRECTIONAL', 'DIRECTIONAL', 'LANDMARK_LOCKED'].includes(v.directionality), `Invalid directionality on ${v.variant_key}`);
      if (v.camera_type === 'OVERVIEW' || v.has_directional_landmark === 1) {
        assert.equal(v.safe_for_pov_fallback, 0, `${v.variant_key} must not be marked safe_for_pov_fallback`);
      }
    }

    // Step to (7,4) Mirkwood Forest facing NORTH (toward (7,3) Primeval Black Oak):
    // Resolves via Tier 1 bespoke Oak approach (fp_mirkwood_trail_7_4_north), then turning EAST resolves via Tier 4 (GENERIC_TERRAIN_POV)!
    await apiAction('LAB_SCENARIO', { scenario: 'WILDERNESS' });
    let state = await apiAction('MOVE', { relative: 'FORWARD' }); // (7,4) facing NORTH
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 4);
    assert.equal(state.viewportScene.scenes.C.povTier, 1);
    assert.equal(state.viewportScene.scenes.C.variantKey, 'fp_mirkwood_trail_7_4_north');
    state = await apiAction('TURN', { direction: 'RIGHT' }); // (7,4) facing EAST -> Tier 4
    const sceneC74 = state.viewportScene.scenes.C;
    assert.equal(sceneC74.povTier, 4);
    assert.equal(sceneC74.povTierKey, 'GENERIC_TERRAIN_POV');
    assert.equal(sceneC74.cameraType, 'POV');
    assert.notEqual(sceneC74.variantKey, 'forest_monolith_clearing', 'Tier 4 must never pick landmark-locked Waystone Monolith');
    assert.notEqual(sceneC74.variantKey, 'forest_crossroads_lateral_pov', 'Tier 4 must never pick landmark-locked Crossroads signpost');
  });

  it('17. Supports Card vs. Integrated monster cutout presentation for Manticore, Ghoul, Assassin/Creeping Vine, and Wolf, plus safe Card fallback and Bridge combat stabilization', async () => {
    mockRngValue = 0.99;
    await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });

    // 1. Verify all 4 RGBA cutout PNG assets serve HTTP 200 OK
    const cutoutUrls = [
      '/lab-assets/images/monsters-cutout/manticore.png',
      '/lab-assets/images/monsters-cutout/ghoul.png',
      '/lab-assets/images/monsters-cutout/assassin_vine.png',
      '/lab-assets/images/monsters-cutout/wolf.png'
    ];
    for (const url of cutoutUrls) {
      const res = await fetch(`${baseUrl}${url}`);
      assert.equal(res.status, 200, `Expected 200 OK for cutout ${url}`);
    }

    // 2. Test all 4 required monster archetypes (including 'Creeping Vine' alias)
    const expectedMonsters = [
      { query: 'Manticore', slug: 'manticore', size: 'LARGE_WINGED', grounding: 'AIRBORNE_HOVER', airborne: true },
      { query: 'Ghoul', slug: 'ghoul', size: 'MEDIUM_HUMANOID', grounding: 'GROUNDED_CROUCH', airborne: false },
      { query: 'Creeping Vine', slug: 'assassin_vine', size: 'COILED_PLANT', grounding: 'GROUNDED_ROOTED', airborne: false },
      { query: 'Wolf', slug: 'wolf', size: 'MEDIUM_QUADRUPED', grounding: 'GROUNDED_PAWS', airborne: false }
    ];

    for (const item of expectedMonsters) {
      const state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: item.query });
      assert.ok(state.encounter, `Expected encounter for ${item.query}`);
      assert.equal(state.encounter.status, 'IN_COMBAT');
      assert.equal(state.encounter.monsterSlug, item.slug);
      assert.equal(state.encounter.hasIntegratedCutout, true);
      assert.equal(state.encounter.cutoutImageUrl, `/lab-assets/images/monsters-cutout/${item.slug}.png`);
      assert.equal(state.encounter.imageUrl, `/images/monsters/${item.slug}.png`, 'Original monster art must remain intact for Card mode');
      assert.equal(state.encounter.isAirborne, item.airborne);
      assert.equal(state.encounter.integratedProfile.sizeCategory, item.size);
      assert.equal(state.encounter.integratedProfile.groundingMode, item.grounding);
    }

    // 3. Test newly integrated Track 4/5 cutout (Rust Monster) AND safe fallback to Card when a monster lacks a cutout (e.g., Choker)
    const rustState = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Rust Monster' });
    assert.equal(rustState.encounter.status, 'IN_COMBAT');
    assert.equal(rustState.encounter.hasIntegratedCutout, true);
    assert.equal(rustState.encounter.cutoutImageUrl, '/lab-assets/images/monsters-cutout/rust_monster.png');

    const chokerState = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Choker' });
    assert.equal(chokerState.encounter.status, 'IN_COMBAT');
    assert.equal(chokerState.encounter.hasIntegratedCutout, false);
    assert.equal(chokerState.encounter.cutoutImageUrl, null);
    assert.equal(chokerState.encounter.integratedProfile.fallbackPresentation, 'CARD');

    // 4. Test Combat Stage Stabilization on The Old Stone Bridge (8,7):
    // Even if the hero turns NORTH toward the Blackwater River during active combat on the bridge,
    // Mode C keeps the combat background stabilized on the stone bridge roadway so monsters never stand on water!
    await apiAction('LAB_SCENARIO', { scenario: 'BRIDGE' });
    let bridgeCombat = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Wolf' });
    assert.equal(bridgeCombat.currentTile.x, 8);
    assert.equal(bridgeCombat.currentTile.y, 7);
    assert.equal(bridgeCombat.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/bridge_8_7_east.jpg');

    bridgeCombat = await apiAction('TURN', { facing: 'NORTH' });
    assert.equal(bridgeCombat.facing, 'NORTH');
    assert.equal(bridgeCombat.viewportScene.scenes.C.combatStageStabilized, true);
    assert.equal(bridgeCombat.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/bridge_8_7_east.jpg');
  });

  it('18. Provides anatomical contact shadow profiles, true airborne Manticore separation, scene stageAnchor metadata, and facing preservation at Crossroads (7,5) N/E/S/W', async () => {
    mockRngValue = 0.99;
    await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });

    // 1. Verify Manticore has true airborne elevation + detached ground shadow (no foot contact patches)
    const manticoreState = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Manticore' });
    const mProf = manticoreState.encounter.integratedProfile;
    assert.equal(manticoreState.encounter.isAirborne, true);
    assert.equal(mProf.groundingMode, 'AIRBORNE_HOVER');
    assert.ok(mProf.verticalOffsetPx <= -40, 'Airborne Manticore must be elevated high in the scene');
    assert.ok(mProf.airborneGapPx >= 45, 'Airborne Manticore must maintain a clear air gap above its ground shadow');
    assert.ok(Array.isArray(mProf.contactPatches) && mProf.contactPatches.length === 0, 'Airborne Manticore must not have grounded paw contact patches');
    assert.ok(mProf.ambientPatch && mProf.ambientPatch.topPct >= 110, 'Airborne shadow must be cast on the ground plane far below the flying body');

    // 2. Verify Wolf, Ghoul, and Assassin Vine have multi-point anatomical contact patches and grounded placement
    for (const [query, expectedMinContacts] of [['Wolf', 3], ['Ghoul', 2], ['Assassin Vine', 3]]) {
      const st = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: query });
      const prof = st.encounter.integratedProfile;
      assert.equal(st.encounter.isAirborne, false);
      assert.ok(prof.verticalOffsetPx > 0, `${query} must be anchored downward onto the stage floor`);
      assert.equal(prof.airborneGapPx, 0);
      assert.ok(Array.isArray(prof.contactPatches) && prof.contactPatches.length >= expectedMinContacts, `${query} must define anatomical contact patches`);
      for (const cp of prof.contactPatches) {
        assert.ok(cp.leftPct > 0 && cp.leftPct < 100);
        assert.ok(cp.topPct >= 80 && cp.topPct <= 100);
      }
    }

    // 3. Verify Crossroads (7,5) preserves facing across all 4 directions when spawning monsters and provides stageAnchor metadata
    await apiAction('LAB_SCENARIO', { scenario: 'WILDERNESS' });
    for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
      await apiAction('TURN', { facing: dir });
      const combatAtDir = await apiAction('LAB_SCENARIO', {
        scenario: 'STAGE2_COMBAT',
        monsterName: 'Wolf',
        preserveFacing: true
      });
      assert.equal(combatAtDir.currentTile.x, 7);
      assert.equal(combatAtDir.currentTile.y, 5);
      assert.equal(combatAtDir.facing, dir, `Spawning monster with preserveFacing must keep ${dir} at Crossroads (7,5)`);
      const sceneC = combatAtDir.viewportScene.scenes.C;
      assert.ok(sceneC.stageAnchor, `Missing stageAnchor for Crossroads (7,5) facing ${dir}`);
      assert.equal(sceneC.stageAnchor.groundSurfaceType, 'forest-earth');
      assert.ok(sceneC.stageAnchor.stageFloorY >= 80 && sceneC.stageAnchor.stageFloorY <= 86);
      assert.equal(sceneC.stageAnchor.isWalkableCombatStage, true);
      assert.ok(sceneC.focalY >= 60, `Expected ground-revealing focalY >= 60 for Crossroads ${dir}, got ${sceneC.focalY}`);
    }
  });

  it('19. Builds complete 15x15 World Visual Atlas (GET /api/atlas & /api/visual-qa) with zero Grade D gaps and verified image files on disk', async () => {
    const atlasRes = await fetch(`${baseUrl}/api/atlas`);
    assert.equal(atlasRes.status, 200);
    const atlas = await atlasRes.json();

    assert.equal(atlas.gridWidth, 15);
    assert.equal(atlas.gridHeight, 15);
    assert.equal(atlas.summary.totalTiles, 225);
    assert.equal(atlas.summary.passableTiles, 160);
    assert.equal(atlas.summary.impassableTiles, 65);
    assert.equal(atlas.summary.totalViewpoints, 900);
    assert.equal(atlas.summary.passableViewpoints, 640);
    assert.equal(atlas.summary.needsArtworkCount, 0, 'Zero passable viewpoints may remain Grade D (Needs Artwork)');
    assert.equal(atlas.summary.passableGradeCounts.D, 0);
    assert.ok(atlas.summary.passableGradeCounts.A >= 30, `Expected >= 30 Grade A bespoke viewpoints, got ${atlas.summary.passableGradeCounts.A}`);
    assert.ok(atlas.summary.passableGradeCounts.B >= 150, `Expected >= 150 Grade B contextual viewpoints, got ${atlas.summary.passableGradeCounts.B}`);
    assert.ok(atlas.summary.uniqueImagesUsed >= 40, `Expected >= 40 unique environment paintings in active use, got ${atlas.summary.uniqueImagesUsed}`);

    // Verify every single image URL in the 225-tile atlas resolves HTTP 200 OK
    const uniqueUrls = new Set();
    for (const tile of atlas.tiles) {
      for (const dir of ['NORTH', 'EAST', 'SOUTH', 'WEST']) {
        const dInfo = tile.directions[dir];
        assert.ok(dInfo && dInfo.imageUrl, `Missing imageUrl at (${tile.x},${tile.y}) ${dir}`);
        assert.ok(['A', 'B', 'C'].includes(dInfo.qualityGrade), `Expected Grade A/B/C at (${tile.x},${tile.y}) ${dir}, got ${dInfo.qualityGrade}`);
        uniqueUrls.add(dInfo.imageUrl);
      }
    }

    for (const url of uniqueUrls) {
      const imgRes = await fetch(`${baseUrl}${url}`);
      assert.equal(imgRes.status, 200, `Expected 200 OK for atlas image ${url}`);
    }

    const qaRes = await fetch(`${baseUrl}/api/visual-qa`);
    assert.equal(qaRes.status, 200);
    const qa = await qaRes.json();
    assert.equal(qa.status, 'OK');
    assert.equal(qa.integratedMonsters.length, 37);
    assert.ok(qa.pointsOfInterest.length >= 10);
    assert.ok(qa.atmosphereProfiles.length >= 8);
  });

  it('20. Resolves newly added Bespoke & Contextual POV paintings across Oakhaven, South Gate, Watchpost, Ancient Oak, Deadman’s Mire, Biome Transitions, and Barriers', async () => {
    mockRngValue = 0.99;
    await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });

    // 1. Oakhaven Sanctuary (7,7) all 4 directions -> Tier 1 Bespoke POV
    await apiAction('LAB_SCENARIO', { scenario: 'CITY' });
    const expectedOakhaven = {
      NORTH: '/lab-assets/images/perspective/oakhaven_7_7_north.jpg',
      EAST: '/lab-assets/images/perspective/oakhaven_7_7_east.jpg',
      SOUTH: '/lab-assets/images/perspective/oakhaven_7_7_south.jpg',
      WEST: '/lab-assets/images/perspective/oakhaven_7_7_west.jpg'
    };
    for (const [dir, expectedUrl] of Object.entries(expectedOakhaven)) {
      const st = await apiAction('TURN', { facing: dir });
      assert.equal(st.viewportScene.scenes.C.povTier, 1, `Oakhaven (7,7) ${dir} should be Tier 1`);
      assert.equal(st.viewportScene.scenes.C.imageUrl, expectedUrl);
    }

    // 2. Oakhaven South Gate (7,8) NORTH and SOUTH -> Tier 1 Bespoke POV
    let state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 8, facing: 'SOUTH' });
    assert.equal(state.viewportScene.scenes.C.povTier, 1);
    assert.equal(state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/south_gate_7_8_south.jpg');

    state = await apiAction('TURN', { facing: 'NORTH' });
    assert.equal(state.viewportScene.scenes.C.povTier, 1);
    assert.equal(state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/south_gate_7_8_north.jpg');

    // 3. Bridge East Watchpost (9,7) all 4 directions -> Tier 1 Bespoke POV
    const expectedWatchpost = {
      WEST: '/lab-assets/images/perspective/watchpost_9_7_west.jpg',
      EAST: '/lab-assets/images/perspective/watchpost_9_7_east.jpg',
      NORTH: '/lab-assets/images/perspective/watchpost_9_7_river_flank.jpg',
      SOUTH: '/lab-assets/images/perspective/watchpost_9_7_river_flank.jpg'
    };
    for (const [dir, expectedUrl] of Object.entries(expectedWatchpost)) {
      const st = await apiAction('TELEPORT_TO_TILE', { x: 9, y: 7, facing: dir });
      assert.equal(st.viewportScene.scenes.C.povTier, 1);
      assert.equal(st.viewportScene.scenes.C.imageUrl, expectedUrl);
    }

    // 4. Ancient Oak (7,3) & Deadman's Mire (4,11) -> Tier 1 Bespoke POV
    state = await apiAction('LAB_SCENARIO', { scenario: 'ANCIENT_OAK' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 3);
    assert.equal(state.viewportScene.scenes.C.povTier, 1);
    assert.equal(state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/terrain/forest_ancient_oak.jpg');

    state = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(state.viewportScene.scenes.C.povTier, 1);
    assert.equal(state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/ancient_oak_7_3_south.jpg');

    state = await apiAction('LAB_SCENARIO', { scenario: 'DEADMANS_MIRE' });
    assert.equal(state.currentTile.x, 4);
    assert.equal(state.currentTile.y, 11);
    assert.equal(state.viewportScene.scenes.C.povTier, 1);
    assert.equal(state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg');

    // 5. Impassable Barriers (Bottomless Mire, Murksea, Darkmount Peaks) -> Tier 3 Barrier POV
    state = await apiAction('TELEPORT_TO_TILE', { x: 4, y: 13, facing: 'SOUTH' }); // Facing (4,14) Bottomless Mire
    assert.equal(state.viewportScene.scenes.C.povTier, 3);
    assert.equal(state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/barrier_bottomless_mire_pov.jpg');

    state = await apiAction('TELEPORT_TO_TILE', { x: 13, y: 7, facing: 'EAST' }); // Facing (14,7) Murksea
    assert.equal(state.viewportScene.scenes.C.povTier, 3);
    assert.equal(state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/barrier_murksea_cliffs_pov.jpg');

    state = await apiAction('TELEPORT_TO_TILE', { x: 2, y: 1, facing: 'NORTH' }); // Facing (2,0) Darkmount Peaks from Raven Crags
    assert.equal(state.viewportScene.scenes.C.povTier, 3);
    assert.equal(state.viewportScene.scenes.C.imageUrl, '/lab-assets/images/perspective/barrier_darkmount_crags_pov.jpg');
  });

  it('21. Resolves data-driven Atmospheric Effect Profiles per terrain and landmark override', async () => {
    mockRngValue = 0.99;

    // Oakhaven Sanctuary -> warm torchlight & embers
    let state = await apiAction('LAB_SCENARIO', { scenario: 'CITY' });
    assert.equal(state.viewportScene.effectProfile.profileKey, 'sanctuary');
    assert.equal(state.viewportScene.effectProfile.particleType, 'embers');

    // Old Stone Bridge -> cold river mist & water mist
    state = await apiAction('LAB_SCENARIO', { scenario: 'BRIDGE' });
    assert.equal(state.viewportScene.effectProfile.profileKey, 'bridge');
    assert.equal(state.viewportScene.effectProfile.particleType, 'water-mist');

    // Ancient Oak -> amber sap spores
    state = await apiAction('LAB_SCENARIO', { scenario: 'ANCIENT_OAK' });
    assert.equal(state.viewportScene.effectProfile.profileKey, 'ancient-oak');
    assert.equal(state.viewportScene.effectProfile.particleType, 'spores');

    // Deadman's Mire -> swamp miasma override
    state = await apiAction('LAB_SCENARIO', { scenario: 'DEADMANS_MIRE' });
    assert.equal(state.viewportScene.effectProfile.profileKey, 'deadmans-mire-override');
    assert.equal(state.viewportScene.effectProfile.particleType, 'marsh-spores');

    // Raven Crags -> highland dust & wind
    state = await apiAction('TELEPORT_TO_TILE', { x: 3, y: 5, facing: 'WEST' });
    assert.equal(state.viewportScene.effectProfile.profileKey, 'hills-crag');
    assert.equal(state.viewportScene.effectProfile.particleType, 'crag-dust');
  });

  it('22. Supports non-gameplay Points of Interest (INSPECT_POI) with English lore and zero stat/loot side effects', async () => {
    mockRngValue = 0.99;

    // Teleport to Mirkwood Crossroads (7,5) facing NORTH -> Runic Waystone of Mirkwood Crossroads POI
    let state = await apiAction('LAB_SCENARIO', { scenario: 'WILDERNESS' });
    assert.ok(state.viewportScene.pointOfInterest, 'Expected POI at Mirkwood Crossroads (7,5) NORTH');
    assert.equal(state.viewportScene.pointOfInterest.poiKey, 'poi_crossroads_waystone');

    const hpBefore = state.character.current_hp;
    const xpBefore = state.character.xp;
    const goldBefore = state.character.gold;
    const invCountBefore = state.inventory.length;

    const inspected = await apiAction('INSPECT_POI');
    assert.equal(inspected.fxCue.type, 'INSPECT_POI');
    assert.ok(inspected.infoMessage.includes('Runic Waystone of Mirkwood Crossroads'));
    assert.equal(inspected.character.current_hp, hpBefore);
    assert.equal(inspected.character.xp, xpBefore);
    assert.equal(inspected.character.gold, goldBefore);
    assert.equal(inspected.inventory.length, invCountBefore);
  });

  it('23. Supports all 7 Integrated Monster Cutouts (including Skeletal Champion, Giant Spider, and Troll) across diverse world terrains', async () => {
    mockRngValue = 0.99;
    await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });

    const newCutoutMonsters = [
      { query: 'Skeletal Champion', slug: 'skeletal_champion', size: 'MEDIUM_HUMANOID', grounding: 'GROUNDED_BOOTS', minContacts: 2 },
      { query: 'Giant Spider', slug: 'giant_spider', size: 'LARGE_ARACHNID', grounding: 'GROUNDED_ARACHNID', minContacts: 3 },
      { query: 'Troll', slug: 'troll', size: 'LARGE_BRUTE', grounding: 'GROUNDED_HEAVY', minContacts: 2 }
    ];

    for (const item of newCutoutMonsters) {
      const imgRes = await fetch(`${baseUrl}/lab-assets/images/monsters-cutout/${item.slug}.png`);
      assert.equal(imgRes.status, 200, `Expected 200 OK for new monster cutout ${item.slug}.png`);

      const state = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: item.query });
      assert.equal(state.encounter.status, 'IN_COMBAT');
      assert.equal(state.encounter.monsterSlug, item.slug);
      assert.equal(state.encounter.hasIntegratedCutout, true);
      assert.equal(state.encounter.cutoutImageUrl, `/lab-assets/images/monsters-cutout/${item.slug}.png`);
      assert.equal(state.encounter.integratedProfile.sizeCategory, item.size);
      assert.equal(state.encounter.integratedProfile.groundingMode, item.grounding);
      assert.ok(state.encounter.integratedProfile.contactPatches.length >= item.minContacts);
    }
  });

  it('24. Enforces data-driven POI Line-of-Sight & Directional Visibility rules across landmarks', async () => {
    mockRngValue = 0.99;
    await apiAction('SET_SCENE_MODE', { sceneMode: 'C' });

    // 1. At Mirkwood Crossroads (7,5):
    // - Facing NORTH shows Runic Waystone POI
    // - Facing WEST shows Stonefang Crag Barrier POI (no longer shadowed by Waystone!)
    // - Facing EAST or SOUTH has no false Waystone button
    let state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 5, facing: 'NORTH' });
    assert.ok(state.viewportScene.pointOfInterest);
    assert.equal(state.viewportScene.pointOfInterest.poiKey, 'poi_crossroads_waystone');
    assert.equal(state.viewportScene.pointOfInterest.shortPrompt, 'Inspect Runestone');

    state = await apiAction('TURN', { facing: 'WEST' });
    assert.ok(state.viewportScene.pointOfInterest);
    assert.equal(state.viewportScene.pointOfInterest.poiKey, 'poi_stonefang_crag');
    assert.equal(state.viewportScene.pointOfInterest.shortPrompt, 'Inspect Stonefang Crag');

    state = await apiAction('TURN', { facing: 'EAST' });
    assert.equal(state.viewportScene.pointOfInterest, null, 'Waystone must not be inspectable when facing EAST away from the stone');

    state = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(state.viewportScene.pointOfInterest, null, 'Waystone must not be inspectable when facing SOUTH down the gate road');

    // 2. Approaching Ancient Oak from (7,4) facing NORTH -> shows approach POI
    state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 4, facing: 'NORTH' });
    assert.ok(state.viewportScene.pointOfInterest);
    assert.equal(state.viewportScene.pointOfInterest.poiKey, 'poi_ancient_oak_approach');

    // 3. At Heart of the Mirkwood (7,3):
    // - Visible facing NORTH, EAST, WEST with directional prompts
    // - Hidden when facing SOUTH down the return trail (tree is behind the player)
    state = await apiAction('TELEPORT_TO_TILE', { x: 7, y: 3, facing: 'NORTH' });
    assert.ok(state.viewportScene.pointOfInterest);
    assert.equal(state.viewportScene.pointOfInterest.poiKey, 'poi_ancient_oak');

    state = await apiAction('TURN', { facing: 'SOUTH' });
    assert.equal(state.viewportScene.pointOfInterest, null, 'Ancient Oak must not show Inspect button when facing SOUTH away from the tree');
  });

  it('25. Toggles cleanly between Current Experience and Adventure Experience without altering core rules', async () => {
    mockRngValue = 0.99;

    // Reset expedition and disable Adventure Mode (Current Experience)
    let state = await apiAction('RESET_EXPEDITION', { teleportToStart: true });
    state = await apiAction('SET_ADVENTURE_MODE', { enabled: false });
    assert.equal(state.adventure.enabled, false);
    assert.equal(state.adventure.activeDiscovery, null);
    assert.equal(state.adventure.activeTensionCue, null);

    // Step north in Current Experience -> no discoveries or tension cues should fire
    state = await apiAction('MOVE', { relative: 'FORWARD' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.adventure.activeDiscovery, null);
    assert.equal(state.adventure.activeTensionCue, null);

    // Re-enable Adventure Experience
    state = await apiAction('SET_ADVENTURE_MODE', { enabled: true });
    assert.equal(state.adventure.enabled, true);
    assert.ok(Array.isArray(state.adventure.availableExpeditions));
    assert.equal(state.adventure.availableExpeditions.length, 3);
    assert.ok(state.adventure.totalDiscoveriesInCatalog >= 16);
  });

  it('26. Tracks complete Mirkwood & Bridge Expedition waypoint arcs across real movement steps', async () => {
    mockRngValue = 0.99; // Suppress random combat so we can test pure movement progression

    let state = await apiAction('START_EXPEDITION', {
      expeditionKey: 'MIRKWOOD_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 42
    });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.adventure.expedition.key, 'MIRKWOOD_EXPEDITION');
    assert.equal(state.adventure.expedition.isComplete, false);
    assert.equal(state.adventure.expedition.waypoints[0].completed, false);

    // Walk NORTH: (7,7) -> (7,6) -> (7,5) -> (7,4) -> (7,3)
    state = await apiAction('MOVE', { direction: 'NORTH' }); // (7,6) North Gate
    assert.equal(state.currentTile.y, 6);
    assert.equal(state.adventure.expedition.waypoints[0].completed, true);

    state = await apiAction('MOVE', { direction: 'NORTH' }); // (7,5) Mirkwood Crossroads
    assert.equal(state.currentTile.y, 5);
    assert.equal(state.adventure.expedition.waypoints[1].completed, true);

    state = await apiAction('MOVE', { direction: 'NORTH' }); // (7,4) Mirkwood Trail
    assert.equal(state.currentTile.y, 4);
    assert.equal(state.adventure.expedition.waypoints[2].completed, true);

    state = await apiAction('MOVE', { direction: 'NORTH' }); // (7,3) Heart of the Mirkwood
    assert.equal(state.currentTile.y, 3);
    assert.equal(state.adventure.expedition.waypoints[3].completed, true);
    assert.equal(state.adventure.expedition.isComplete, false, 'Must return to Oakhaven to complete expedition');

    // Walk SOUTH back to Oakhaven: (7,3) -> (7,4) -> (7,5) -> (7,6) -> (7,7)
    await apiAction('MOVE', { direction: 'SOUTH' });
    await apiAction('MOVE', { direction: 'SOUTH' });
    await apiAction('MOVE', { direction: 'SOUTH' });
    state = await apiAction('MOVE', { direction: 'SOUTH' });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.adventure.expedition.waypoints[4].completed, true);
    assert.equal(state.adventure.expedition.isComplete, true, 'Mirkwood Expedition must mark complete upon returning to Oakhaven');
    assert.ok(state.adventure.journal.some(j => j.type === 'EXPEDITION_COMPLETE'));
  });

  it('27. Enforces discovery pacing cooldowns and anti-oscillation protection when stepping back and forth', async () => {
    mockRngValue = 0.99;

    await apiAction('START_EXPEDITION', {
      expeditionKey: 'MIRKWOOD_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 7
    });

    // Step to (7,6) -> (7,5) -> (7,4)
    let state = await apiAction('MOVE', { direction: 'NORTH' }); // (7,6)
    state = await apiAction('MOVE', { direction: 'NORTH' }); // (7,5)
    state = await apiAction('MOVE', { direction: 'NORTH' }); // (7,4)

    // Dismiss any active discovery and oscillate (7,4) <-> (7,5) <-> (7,4)
    await apiAction('DISMISS_DISCOVERY');
    state = await apiAction('MOVE', { direction: 'SOUTH' }); // (7,5)
    await apiAction('DISMISS_DISCOVERY');
    state = await apiAction('MOVE', { direction: 'NORTH' }); // back to (7,4) — oscillation!
    assert.equal(
      state.adventure.activeDiscovery,
      null,
      'Oscillating between the same two tiles (7,4 <-> 7,5 <-> 7,4) must never spawn a new discovery'
    );
  });

  it('28. Resolves contextual discovery choices and records outcomes in the Expedition Journal', async () => {
    mockRngValue = 0.99;

    await apiAction('START_EXPEDITION', {
      expeditionKey: 'MIRKWOOD_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 42
    });
    await apiAction('TELEPORT_TO_TILE', { x: 7, y: 4, facing: 'NORTH' });

    // Force-stage an IMPORTANT discovery with 3 choices
    let state = await apiAction('FORCE_DISCOVERY', { discoveryId: 'disc_mirkwood_abandoned_camp' });
    assert.ok(state.adventure.activeDiscovery);
    assert.equal(state.adventure.activeDiscovery.id, 'disc_mirkwood_abandoned_camp');
    assert.equal(state.adventure.activeDiscovery.tier, 'IMPORTANT');
    assert.equal(state.adventure.activeDiscovery.choices.length, 3);

    const xpBefore = state.character.xp;
    const goldBefore = state.character.gold;

    // Resolve a contextual choice
    state = await apiAction('RESOLVE_DISCOVERY_CHOICE', {
      discoveryId: 'disc_mirkwood_abandoned_camp',
      choiceId: 'inspect_campsite'
    });
    assert.equal(state.adventure.activeDiscovery, null, 'Active discovery should clear after choice resolution');
    assert.ok(state.adventure.lastChoiceResolution);
    assert.equal(state.adventure.lastChoiceResolution.choiceId, 'inspect_campsite');
    assert.ok(state.adventure.lastChoiceResolution.outcomeText.length > 20);
    assert.equal(state.adventure.stats.choicesResolved, 1);
    assert.ok(state.adventure.journal.some(j => j.type === 'CHOICE' && j.title.includes('Abandoned Scout Camp')));

    // Verify core progression economy (XP, Gold) was not mutated by Lab discovery choice
    assert.equal(state.character.xp, xpBefore);
    assert.equal(state.character.gold, goldBefore);
  });

  it('29. Separates 3-tier exploration tension cues (GENUINE_EVIDENCE vs AMBIENT_TENSION vs ENCOUNTER_INTRO)', async () => {
    mockRngValue = 0.99;

    await apiAction('START_EXPEDITION', {
      expeditionKey: 'BRIDGE_EXPEDITION',
      teleportToStart: true,
      deterministicSeed: 19
    });

    // Step EAST onto Old Stone Bridge (8,7) with no persistent monster and no combat -> if tension cue fires, it must be AMBIENT_TENSION, never GENUINE_EVIDENCE
    let state = await apiAction('MOVE', { direction: 'EAST' });
    if (state.adventure.activeTensionCue) {
      assert.equal(
        state.adventure.activeTensionCue.tier,
        'AMBIENT_TENSION',
        'Without a persistent monster on or adjacent to the tile, tension tier must be AMBIENT_TENSION'
      );
    }

    // Trigger an encounter at (8,7) with low RNG -> must record ENCOUNTER_INTRO tension tier
    mockRngValue = 0.01;
    state = await apiAction('MOVE', { direction: 'EAST' }); // (9,7) Watchpost with encounter
    assert.ok(state.encounter);
    assert.ok(state.adventure.activeTensionCue);
    assert.equal(state.adventure.activeTensionCue.tier, 'ENCOUNTER_INTRO');
    assert.ok(state.adventure.journal.some(j => j.type === 'ENCOUNTER_START'));
  });

  it('30. Resets Expedition state cleanly and restores hero to Oakhaven Sanctuary', async () => {
    mockRngValue = 0.99;

    const state = await apiAction('RESET_EXPEDITION', {
      expeditionKey: 'ROTTEN_LANDS_EXPEDITION',
      teleportToStart: true
    });
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);
    assert.equal(state.facing, 'NORTH');
    assert.equal(state.adventure.expedition.key, 'ROTTEN_LANDS_EXPEDITION');
    assert.equal(state.adventure.stats.stepsTaken, 0);
    assert.equal(state.adventure.stats.discoveriesFound, 0);
    assert.equal(state.adventure.stats.choicesResolved, 0);
  });

  it('31. Audits all 98 database monsters (68 Core + 30 Seed-010), supports all 9 Pathfinder 1e size categories, and provides complete visual metadata (Phases 1 & 2)', async () => {
    const res = await fetch(`${baseUrl}/api/monster-scaling?viewportWidth=1920&viewportHeight=1080`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);

    // 1. Verify all 9 Pathfinder 1e size categories exist
    const expectedNineSizes = ['FINE', 'DIMINUTIVE', 'TINY', 'SMALL', 'MEDIUM', 'LARGE', 'HUGE', 'GARGANTUAN', 'COLOSSAL'];
    assert.deepEqual(Object.keys(data.pfSizeCategories), expectedNineSizes);
    assert.equal(data.auditSummary.supportedPfSizeCategoriesCount, 9);

    // 2. Verify all 98 DB monsters (68 Core + 30 Seed-010 Expansion) are present with required Phase 2 metadata
    assert.equal(data.catalogCount, 98);
    assert.equal(data.auditSummary.totalDatabaseMonsters, 98);
    assert.equal(data.auditSummary.coreMonstersCount, 68);
    assert.equal(data.auditSummary.expansionMonstersCount, 30);

    for (const m of data.catalog) {
      assert.ok(m.id > 0, `Missing id on monster ${m.name}`);
      assert.ok(typeof m.name === 'string' && m.name.length > 0);
      assert.ok(expectedNineSizes.includes(m.pfSizeCategory), `Invalid pfSizeCategory ${m.pfSizeCategory} on ${m.name}`);
      assert.ok(typeof m.sourceUrl === 'string' && m.sourceUrl.startsWith('http'), `Missing sourceUrl on ${m.name}`);
      assert.ok(typeof m.visualBodyProfile === 'string' && data.visualBodyProfiles[m.visualBodyProfile], `Invalid visualBodyProfile on ${m.name}`);
      assert.ok(m.bodyProportions && m.bodyProportions.approxHeightFt > 0);
      assert.ok(typeof m.imagePath === 'string' && m.imagePath.startsWith('/images/monsters/'));
      assert.ok(m.imageContentBounds && m.imageContentBounds.contentWidthRatio > 0.5 && m.imageContentBounds.contentHeightRatio > 0.5);
      assert.ok(typeof m.proposedScaleFactor === 'number' && m.proposedScaleFactor > 0.2);
      assert.ok(['GROUNDED', 'AIRBORNE_HOVER'].includes(m.positioningMode));
      assert.ok(typeof m.verificationStatus === 'string' && m.verificationStatus.length > 0);
    }

    // 3. Verify key Pathfinder 1e audit corrections & edge cases
    const spider = data.catalog.find(m => m.slug === 'giant_spider');
    assert.equal(spider.pfSizeCategory, 'MEDIUM', 'CR 1 Giant Spider in PF1e Bestiary 1 is officially Medium Vermin');
    assert.equal(spider.verificationStatus, 'CORRECTED_INTERNAL_MISMATCH');

    const deathDog = data.catalog.find(m => m.slug === 'death_dog');
    assert.equal(deathDog.pfSizeCategory, 'MEDIUM', 'Death Dog in PF1e Bestiary 4 is officially Medium Magical Beast');

    const carbuncle = data.catalog.find(m => m.slug === 'carbuncle');
    assert.equal(carbuncle.pfSizeCategory, 'TINY', 'Carbuncle in PF1e Bestiary 3 is officially Tiny Magical Beast');

    const wisp = data.catalog.find(m => m.slug === 'will_o_wisp');
    assert.equal(wisp.pfSizeCategory, 'SMALL', 'Will-o-Wisp in PF1e Bestiary 1 is officially Small Aberration');

    const bogStrider = data.catalog.find(m => m.slug === 'bog_strider');
    assert.equal(bogStrider.verificationStatus, 'UNCERTAIN_DUAL_SOURCE');

    const spriggan = data.catalog.find(m => m.slug === 'spriggan');
    assert.equal(spriggan.verificationStatus, 'VERIFIED_DUAL_FORM');
  });

  it('32. Computes adaptive monster scaling with body-profile differentiation, transparency compensation, UI safety clamping, and multi-resolution support (Phases 3 & 4)', async () => {
    const {
      computeAdaptiveMonsterVisualScale,
      buildVisualComparisonPresets
    } = require('../monster-size-catalog');

    // 1. Verify monotonic size progression across Tiny -> Small -> Medium -> Large -> Huge at 1920x1080
    const vp1080 = { viewportWidth: 1920, viewportHeight: 1080 };
    const fine = computeAdaptiveMonsterVisualScale('ref_fine_spore_mite', vp1080);
    const diminutive = computeAdaptiveMonsterVisualScale('ref_diminutive_toad', vp1080);
    const tiny = computeAdaptiveMonsterVisualScale('stirge', vp1080);
    const small = computeAdaptiveMonsterVisualScale('goblin', vp1080);
    const medium = computeAdaptiveMonsterVisualScale('skeletal_champion', vp1080);
    const large = computeAdaptiveMonsterVisualScale('troll', vp1080);
    const huge = computeAdaptiveMonsterVisualScale('ref_huge_elder_troll', vp1080);
    const gargantuan = computeAdaptiveMonsterVisualScale('ref_gargantuan_wyrm', vp1080);
    const colossal = computeAdaptiveMonsterVisualScale('ref_colossal_titan', vp1080);

    assert.ok(fine.visibleHeightPx < diminutive.visibleHeightPx);
    assert.ok(diminutive.visibleHeightPx < tiny.visibleHeightPx);
    assert.ok(tiny.visibleHeightPx < small.visibleHeightPx);
    assert.ok(small.visibleHeightPx < medium.visibleHeightPx);
    assert.ok(medium.visibleHeightPx < large.visibleHeightPx);
    assert.ok(large.visibleHeightPx < huge.visibleHeightPx);
    assert.ok(huge.visibleHeightPx < gargantuan.visibleHeightPx);
    assert.ok(gargantuan.visibleHeightPx < colossal.visibleHeightPx);
    assert.equal(large.clamping.wasClamped, false, 'Large Troll must not be clamped at 1920x1080');
    assert.equal(huge.clamping.wasClamped, true, 'Huge reference engages soft-knee UI safety clamp');
    assert.equal(gargantuan.clamping.wasClamped, true, 'Gargantuan must trigger UI safety clamp');
    assert.equal(colossal.clamping.wasClamped, true, 'Colossal must trigger UI safety clamp');

    // 2. Verify monsters sharing MEDIUM size category receive distinct body proportions (aspect ratio & height)
    const skelMed = computeAdaptiveMonsterVisualScale('skeletal_champion', vp1080); // Upright Biped
    const ghoulMed = computeAdaptiveMonsterVisualScale('ghoul', vp1080);            // Crouched Biped
    const wolfMed = computeAdaptiveMonsterVisualScale('wolf', vp1080);              // Low Quadruped
    const spiderMed = computeAdaptiveMonsterVisualScale('giant_spider', vp1080);    // Wide Arachnid

    assert.equal(skelMed.pfSizeCategory, 'MEDIUM');
    assert.equal(ghoulMed.pfSizeCategory, 'MEDIUM');
    assert.equal(wolfMed.pfSizeCategory, 'MEDIUM');
    assert.equal(spiderMed.pfSizeCategory, 'MEDIUM');

    assert.ok(skelMed.visibleHeightPx > ghoulMed.visibleHeightPx, 'Upright Skeletal Champion should stand taller than crouched Ghoul');
    assert.ok(ghoulMed.visibleHeightPx > wolfMed.visibleHeightPx, 'Crouched Ghoul should stand taller than quadruped Wolf');
    assert.ok(wolfMed.visibleHeightPx > spiderMed.visibleHeightPx, 'Quadruped Wolf should stand taller than low Giant Spider');
    assert.ok(spiderMed.aspectRatio > wolfMed.aspectRatio && wolfMed.aspectRatio > skelMed.aspectRatio, 'Giant Spider and Wolf must have wider aspect ratios than upright Biped');

    // 3. Verify monsters sharing LARGE size category receive distinct body proportions & grounding
    const trollLarge = computeAdaptiveMonsterVisualScale('troll', vp1080);
    const manticoreLarge = computeAdaptiveMonsterVisualScale('manticore', vp1080);
    const jellyLarge = computeAdaptiveMonsterVisualScale('ochre_jelly', vp1080);

    assert.ok(trollLarge.visibleHeightPx > manticoreLarge.visibleHeightPx);
    assert.ok(manticoreLarge.visibleHeightPx > jellyLarge.visibleHeightPx);
    assert.ok(manticoreLarge.visibleWidthPx > trollLarge.visibleWidthPx, 'Winged Manticore should have wider span than upright Troll');
    assert.equal(manticoreLarge.positioning.isAirborne, true);
    assert.equal(trollLarge.positioning.isAirborne, false);

    // 4. Verify multi-resolution responsiveness across 1920x1080, 1440x900, and 1280x800
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 800]]) {
      const presets = buildVisualComparisonPresets({ width: w, height: h });
      const prog = presets.presets.SIZE_PROGRESSION_5.specimens;
      assert.equal(prog.length, 5);
      for (let i = 1; i < prog.length; i++) {
        assert.ok(
          prog[i].adaptive.visibleHeightPx > prog[i - 1].adaptive.visibleHeightPx,
          `Expected strictly increasing height at ${w}x${h} between ${prog[i - 1].name} and ${prog[i].name}`
        );
        assert.ok(
          prog[i].adaptive.visibleHeightPx <= prog[i].adaptive.clamping.maxSafeHeightPx,
          `Exceeded maxSafeHeightPx at ${w}x${h} for ${prog[i].name}`
        );
      }
    }
  });
});
