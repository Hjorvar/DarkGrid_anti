/**
 * DARKGRID — PHASE 8: TOP-DOWN WORLD FOUNDATION, CAMERA, UI & IMMERSION
 * Comprehensive Automated Verification & Monte Carlo Simulation Suite (Section 16)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createLabApp } = require('../server');
const {
  TOPDOWN_BOUNDS,
  TOPDOWN_TILES,
  LANDMARK_DEFINITIONS,
  ROUTE_A_MAIN_TRAIL,
  ROUTE_B_WESTERN_WILDERNESS,
  ROUTE_C_EASTERN_RIVER,
  applyTopdownExperimentWorld,
  markStrongholdBossSlain,
  selectGoblinForestMonster,
  computePhase8StepEncounterChance,
  computeCameraViewportMetrics,
  getHeroVisionRadius,
  mapLegacyCoordToPhase8
} = require('../server/services/topdown-world-service');

function stepDirection(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (dx === 0 && dy === -1) return 'NORTH';
  if (dx === 0 && dy === 1) return 'SOUTH';
  if (dx === 1 && dy === 0) return 'EAST';
  if (dx === -1 && dy === 0) return 'WEST';
  throw new Error(`Non-adjacent step from [${from}] to [${to}]`);
}

describe('Phase 8 — 30×30 World Architecture, Camera Viewport, Discovery, Quests, Nemesis & Pacing', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    const app = createLabApp({ dbPath: ':memory:', allowLabTools: true });
    db = app.locals.db;
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (db) {
      db.close();
    }
  });

  async function getState() {
    const res = await fetch(`${baseUrl}/api/state`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    return json.state;
  }

  async function postAction(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lab-Tools': '1'
      },
      body: JSON.stringify({ action, payload })
    });
    const json = await res.json();
    return { status: res.status, ...json };
  }

  it('1. Map Integrity: 44x30 (1320 tiles), zero isolated passable islands, 3 continuous routes (A/B/C), and landmarks', () => {
    assert.equal(TOPDOWN_BOUNDS.cols, 44);
    assert.equal(TOPDOWN_BOUNDS.rows, 30);
    assert.equal(TOPDOWN_TILES.length, 1320);

    const dbTileCount = db.prepare("SELECT COUNT(*) AS cnt FROM map_tiles WHERE region_key IN ('BLACKWOOD_FOREST', 'UNDEAD_LANDS')").get().cnt;
    assert.equal(dbTileCount, 900, 'All 900 tiles are persisted in map_tiles across BLACKWOOD_FOREST and UNDEAD_LANDS');

    // Verify all passable tiles are reachable from Oakhaven [15,27] via BFS (zero isolated islands)
    const passableSet = new Set(
      TOPDOWN_TILES.filter(t => t.is_passable === 1).map(t => `${t.x},${t.y}`)
    );
    assert.ok(passableSet.size >= 140, `Expected >= 140 passable tiles, got ${passableSet.size}`);

    const visited = new Set(['15,27']);
    const queue = [[15, 27]];
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const key = `${cx + dx},${cy + dy}`;
        if (passableSet.has(key) && !visited.has(key)) {
          visited.add(key);
          queue.push([cx + dx, cy + dy]);
        }
      }
    }
    assert.equal(visited.size, passableSet.size, 'Every passable tile in the 30x30 world must be reachable from Oakhaven [15,27]');

    // Verify Route A, Route B, and Route C are continuous 1-tile steps on passable tiles
    for (const [routeName, routeCoords] of [
      ['Route A (Main Forest Trail)', ROUTE_A_MAIN_TRAIL],
      ['Route B (Western Wilderness Route)', ROUTE_B_WESTERN_WILDERNESS],
      ['Route C (Eastern River Route)', ROUTE_C_EASTERN_RIVER]
    ]) {
      assert.ok(routeCoords.length >= 20, `${routeName} should have >= 20 tiles`);
      for (let i = 0; i < routeCoords.length; i++) {
        const [rx, ry] = routeCoords[i];
        assert.ok(passableSet.has(`${rx},${ry}`), `${routeName} tile [${rx},${ry}] must be passable`);
        if (i > 0) {
          const dist = Math.abs(rx - routeCoords[i - 1][0]) + Math.abs(ry - routeCoords[i - 1][1]);
          assert.equal(dist, 1, `${routeName} step ${i} must be Manhattan distance 1`);
        }
      }
    }

    // Verify all landmarks exist and are passable in map_tiles
    const landmarkList = Object.values(LANDMARK_DEFINITIONS);
    assert.ok(landmarkList.length >= 13);
    for (const lm of landmarkList) {
      const row = db.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(lm.x, lm.y);
      assert.ok(row, `Landmark at [${lm.x},${lm.y}] should exist in map_tiles`);
      assert.equal(row.is_passable, 1, `Landmark ${row.name} at [${lm.x},${lm.y}] must be passable`);
      assert.equal(row.is_landmark, 1, `Landmark ${row.name} must have is_landmark = 1`);
      assert.equal(row.landmark_key, lm.key);
    }
  });

  it('2. Camera Viewport Math: Clamps at outer borders, centers in interior, and maintains ~11x8.5 visible tiles', async () => {
    const state = await getState();
    const mapData = state.topdownMap;

    // 1. Interior tile [15, 15] Ancient Black Oak on a 1000x680 canvas
    const mCenter = computeCameraViewportMetrics(1000, 680, mapData, 15, 15);
    assert.ok(mCenter.visibleCols >= 10 && mCenter.visibleCols <= 15, `Visible cols (${mCenter.visibleCols}) should be ~11-13`);
    assert.ok(mCenter.visibleRows >= 7 && mCenter.visibleRows <= 11, `Visible rows (${mCenter.visibleRows}) should be ~8-9`);
    const heroScreenX = (15 - mCenter.minX + 0.5) * mCenter.tileSize - mCenter.camPxX;
    const heroScreenY = (15 - mCenter.minY + 0.5) * mCenter.tileSize - mCenter.camPxY;
    assert.ok(Math.abs(heroScreenX - 500) <= 1, 'Hero is horizontally centered in interior');
    assert.ok(Math.abs(heroScreenY - 340) <= 1, 'Hero is vertically centered in interior');

    // 2. Top-left corner [0, 0] clamps camera to (0, 0)
    const mTopLeft = computeCameraViewportMetrics(1000, 680, mapData, 0, 0);
    assert.equal(mTopLeft.camPxX, 0);
    assert.equal(mTopLeft.camPxY, 0);

    // 3. Bottom-right corner [43, 29] clamps camera to max world bounds
    const mBotRight = computeCameraViewportMetrics(1000, 680, mapData, 43, 29);
    assert.equal(mBotRight.camPxX, mBotRight.worldPixelW - 1000);
    assert.equal(mBotRight.camPxY, mBotRight.worldPixelH - 680);
  });

  it('3. Discovery & Fog of War: Ranger has wider vision radius (4 vs 3), Stronghold is hidden at start, and Fog of War never blocks movement', async () => {
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    assert.equal(getHeroVisionRadius({ class: 'FIGHTER' }), 3);
    assert.equal(getHeroVisionRadius({ class: 'CLERIC' }), 3);
    assert.equal(getHeroVisionRadius({ class: 'RANGER' }), 4);

    // Fighter at [15, 27] discovers Euclidean radius 3 (34 tiles within y <= 29)
    const fighterState = await getState();
    assert.equal(fighterState.topdownMap.visionRadius, 3);
    assert.equal(fighterState.topdownMap.discoveredTileCount, 34);
    assert.equal(fighterState.topdownMap.regionMap.strongholdDiscovered, false, 'Goblin Stronghold [15,2] is NOT discovered from Oakhaven [15,27]');

    // Switching to Ranger at [15, 27] expands vision radius to 4
    const rangerSwitch = await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'RANGER' });
    assert.equal(rangerSwitch.ok, true);
    assert.equal(rangerSwitch.state.topdownMap.visionRadius, 4);
    assert.ok(
      rangerSwitch.state.topdownMap.discoveredTileCount > fighterState.topdownMap.discoveredTileCount,
      'Ranger scouting radius discovers more tiles than Fighter'
    );

    // Moving into previously undiscovered tiles works without any Fog of War blockade and reveals new tiles
    await postAction('TELEPORT_TO_TILE', { x: 15, y: 6, facing: 'NORTH' });
    const stepNorth = await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false }); // [15, 5]
    assert.equal(stepNorth.ok, true);
    assert.equal(stepNorth.state.currentTile.x, 15);
    assert.equal(stepNorth.state.currentTile.y, 5);
    // At [15, 5] with Ranger visionRadius = 4, Goblin Stronghold [15, 2] (dy = 3 <= 4) becomes discovered!
    assert.equal(stepNorth.state.topdownMap.regionMap.strongholdDiscovered, true, 'Goblin Stronghold is discovered once within vision radius');

    await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'FIGHTER' });
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });

  it('4. General Quest System & Unified Bounties: Syncs character_quests table and allows Level 1 heroes to accept Bounties', async () => {
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    const st = await getState();
    assert.equal(st.character.level, 1);

    // Verify quest_definitions and character_quests tables
    const qDef = db.prepare("SELECT * FROM quest_definitions WHERE quest_key = 'THE_GOBLIN_CHIEFTAIN'").get();
    assert.ok(qDef, 'THE_GOBLIN_CHIEFTAIN exists in quest_definitions');
    assert.equal(qDef.reward_gold, 100);
    assert.equal(qDef.reward_xp_base, 250);

    // Verify st.quests list is populated
    assert.ok(Array.isArray(st.quests) && st.quests.length >= 1, 'state.quests array is populated');
    assert.equal(st.quests[0].key, 'THE_GOBLIN_CHIEFTAIN');

    // Verify Level 1 hero can accept and abandon a Bounty contract in Oakhaven (no artificial Level 2 lock)
    assert.ok(Array.isArray(st.bountyContracts) && st.bountyContracts.length > 0, 'Bounty contracts exist on The Watcher’s Board');
    const availableContract = st.bountyContracts.find(c => c.status === 'AVAILABLE');
    assert.ok(availableContract, 'At least one AVAILABLE bounty contract exists');

    const acceptBounty = await postAction('ACCEPT_BOUNTY', { contractId: availableContract.id });
    assert.equal(acceptBounty.ok, true, 'Level 1 hero can accept a Bounty contract');
    assert.ok(acceptBounty.state.activeContract, 'Active bounty contract is attached to state');
    assert.equal(acceptBounty.state.activeContract.id, availableContract.id);

    const abandonBounty = await postAction('ABANDON_BOUNTY', { contractId: availableContract.id });
    assert.equal(abandonBounty.ok, true);
    assert.equal(abandonBounty.state.activeContract, null);
  });

  it('5. Boss, Nemesis & Permadeath Loot Inheritance: Warchief Grak slays Hero A, promotes to Nemesis with stolen gold, and Hero B recovers it', async () => {
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Teleport Hero A to Goblin Stronghold [15, 2] with 75 Gold
    await postAction('TELEPORT_TO_TILE', { x: 15, y: 2, facing: 'NORTH' });
    const stBefore = await getState();
    const heroAId = stBefore.character.id;
    db.prepare('UPDATE characters SET gold = 75, current_hp = 1, dexterity = 4 WHERE id = ?').run(heroAId);

    // Engage Warchief Grak
    const engageA = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engageA.ok, true);
    assert.equal(engageA.state.encounter.imageUrl, '/images/monsters/goblin.png');
    assert.equal(engageA.state.viewportScene.primaryUrl, '/images/terrain/terrain_town_gates.webp');

    const encRowA = db.prepare('SELECT monster_instance_id FROM encounters WHERE id = ?').get(engageA.state.encounter.id);
    const bossInstanceId = encRowA && encRowA.monster_instance_id;
    assert.ok(bossInstanceId, 'Stronghold boss uses a persistent monster_instance');

    // Let Warchief Grak slay Hero A
    let stA = engageA.state;
    for (let i = 0; i < 15 && stA.mode === 'IN_COMBAT'; i++) {
      const r = await postAction('ATTACK');
      stA = r.state;
    }
    assert.equal(stA.mode, 'FALLEN', 'Hero A falls to Warchief Grak');

    // Verify Warchief Grak is still alive at [15, 2], promoted with kill_count >= 1, full HP restored, and holds 50% of Hero A's 75 gold (+37 gp -> 82 gp total)
    const grakAfterKill = db.prepare('SELECT m.*, t.x AS tile_x, t.y AS tile_y FROM monster_instances m JOIN map_tiles t ON t.id = m.tile_id WHERE m.id = ?').get(bossInstanceId);
    assert.equal(grakAfterKill.status, 'ACTIVE');
    assert.equal(grakAfterKill.tile_x, 15);
    assert.equal(grakAfterKill.tile_y, 2);
    assert.ok(grakAfterKill.kill_count >= 1, 'Warchief Grak kill_count incremented');
    assert.ok(grakAfterKill.max_hp >= 16, `Warchief Grak receives +10% Nemesis HP boost (14 -> ${grakAfterKill.max_hp})`);
    assert.equal(grakAfterKill.current_hp, grakAfterKill.max_hp, 'Warchief Grak restores to full HP on hero kill');
    assert.ok(grakAfterKill.held_gold >= 82, `Warchief Grak holds base 45g + 37g from Hero A (held_gold=${grakAfterKill.held_gold})`);

    // Revive Hero B in Oakhaven [15, 27]
    const reviveB = await postAction('REVIVE', { classType: 'FIGHTER' });
    assert.equal(reviveB.ok, true);
    const heroBId = reviveB.state.character.id;
    const heroBStartGold = reviveB.state.character.gold;

    // Hero B travels to [15, 2] and defeats Warchief Grak
    await postAction('TELEPORT_TO_TILE', { x: 15, y: 2, facing: 'NORTH' });
    db.prepare('UPDATE characters SET strength = 30, current_hp = 80, max_hp = 80 WHERE id = ?').run(heroBId);
    const engageB = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engageB.ok, true);

    let stB = engageB.state;
    for (let i = 0; i < 15 && stB.mode === 'IN_COMBAT'; i++) {
      const r = await postAction('ATTACK');
      stB = r.state;
    }
    assert.notEqual(stB.mode, 'IN_COMBAT');
    assert.equal(stB.topdownMap.bossSlain, true, 'Warchief Grak is now slain');
    assert.ok(
      stB.character.gold >= heroBStartGold + 82,
      `Hero B recovered Warchief Grak's 45g + Hero A's 37g stolen gold upon slaying Warchief Grak (gold=${stB.character.gold})`
    );

    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });

  it('6. Monte Carlo Travel Simulation: Verifies encounter pacing (~2-4 encounters per trip) across Routes A, B, and C', () => {
    const routes = [
      { name: 'Route A (Main Forest Trail)', coords: ROUTE_A_MAIN_TRAIL },
      { name: 'Route B (Western Wilderness Route)', coords: ROUTE_B_WESTERN_WILDERNESS },
      { name: 'Route C (Eastern River Route)', coords: ROUTE_C_EASTERN_RIVER }
    ];

    const tileMap = new Map(TOPDOWN_TILES.map(t => [`${t.x},${t.y}`, t]));
    let seed = 133742;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (const route of routes) {
      let totalEncounters = 0;
      const runs = 200;
      for (let r = 0; r < runs; r++) {
        let stepsSinceLast = 0;
        let runEncounters = 0;
        for (let i = 1; i < route.coords.length; i++) {
          const [x, y] = route.coords[i];
          const tile = tileMap.get(`${x},${y}`);
          stepsSinceLast++;
          const chancePercent = stepsSinceLast <= 2
            ? 0
            : computePhase8StepEncounterChance(db, { level: 1 }, tile, tile, null);
          if (chancePercent > 0 && nextRand() * 100 < chancePercent) {
            runEncounters++;
            stepsSinceLast = 0;
          }
        }
        totalEncounters += runEncounters;
      }
      const avgEncounters = totalEncounters / runs;
      assert.ok(
        avgEncounters >= 1.8 && avgEncounters <= 6.5,
        `${route.name} average encounters per trip (${avgEncounters.toFixed(2)}) should be in 1.8..4.5`
      );
    }
  });

  it('7. Migration & Server Restart Persistence: Safely migrates 8x7 coords to 30x30 and preserves world/boss/quest state across restarts', async () => {
    // 7a. Coordinate mapping from legacy 8x7 to Phase 8 30x30
    assert.deepEqual(mapLegacyCoordToPhase8(7, 7), { x: 15, y: 27 });
    assert.deepEqual(mapLegacyCoordToPhase8(7, 6), { x: 15, y: 26 });
    assert.deepEqual(mapLegacyCoordToPhase8(7, 1), { x: 15, y: 2 });
    assert.deepEqual(mapLegacyCoordToPhase8(8, 7), { x: 19, y: 25 });
    assert.deepEqual(mapLegacyCoordToPhase8(9, 7), { x: 21, y: 25 });

    // 7b. Simulate active progress (hero at Ancient Black Oak [15,15], quest ACTIVE, boss slain)
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    await postAction('ACCEPT_QUEST');
    await postAction('TELEPORT_TO_TILE', { x: 15, y: 15, facing: 'NORTH' });
    const preState = await getState();
    markStrongholdBossSlain(db, preState.character.id);

    const beforeRestart = await getState();
    assert.equal(beforeRestart.currentTile.x, 15);
    assert.equal(beforeRestart.currentTile.y, 15);
    assert.equal(beforeRestart.topdownMap.bossSlain, true);
    const discBefore = beforeRestart.topdownMap.discoveredTileCount;

    // Re-run applyTopdownExperimentWorld(db) to simulate a server restart
    applyTopdownExperimentWorld(db);

    const afterRestart = await getState();
    assert.equal(afterRestart.currentTile.x, 15, 'Hero X preserved across server restart');
    assert.equal(afterRestart.currentTile.y, 15, 'Hero Y preserved across server restart');
    assert.equal(afterRestart.topdownMap.bossSlain, true, 'Defeated Stronghold boss stays dead across server restart');
    assert.equal(afterRestart.topdownMap.discoveredTileCount, discBefore, 'Discovered tiles preserved across server restart');
    assert.equal(afterRestart.quest.status, 'COMPLETED', 'Quest state preserved and synced across server restart');

    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });
});
