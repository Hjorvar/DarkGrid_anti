/**
 * DARKGRID PHASE 9B — World Expansion: Undead Lands + Goblin Cave + Ancient Crypt Automated Test Suite
 *
 * Verifies:
 * 1. Complete removal of Level 1 Ambush protection across all zones, encounter engines, and combat Flee locks.
 * 2. World expansion with Undead Lands (`UNDEAD_LANDS`), 3 undead sub-biomes, Sepulcher Road (`ROUTE_D_UNDEAD_SEPULCHER_ROAD`),
 *    minor undead landmarks, and BFS connectivity across all passable tiles.
 * 3. Data-driven Danger Zone profiles for Goblin Cave Approach and Undead Lands (`GOBLIN_CAVE_APPROACH`,
 *    `UNDEAD_BARROW_ROAD`, `UNDEAD_MIRE_OFF_ROAD`, `CRYPT_SEPULCHER_APPROACH`) and regional undead monster pools.
 * 4. Auto-opening Major Landmark Scene for The Goblin Cave (`[9, 12]`), anti-interruption behavior, and cave delve action.
 * 5. Auto-opening Major Landmark Scene for The Ancient Crypt (`[26, 5]`), anti-interruption behavior, and crypt breach action.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const { createLabApp } = require('../server');
const {
  TOPDOWN_WORLD_VERSION,
  TOPDOWN_BOUNDS,
  TOPDOWN_TILES,
  GOBLIN_CAVE_COORD,
  ANCIENT_CRYPT_COORD,
  LANDMARK_DEFINITIONS,
  ROUTE_A_MAIN_TRAIL,
  ROUTE_D_UNDEAD_SEPULCHER_ROAD,
  resolveTileDangerZone,
  computePhase9ThreatDecision,
  selectRegionalEncounterMonster,
  runPhase9MonteCarloSimulation
} = require('../server/services/topdown-world-service');

function createTestSandboxDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  const migrationsDir = path.join(__dirname, '../../db/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrationFiles) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  const seedsDir = path.join(__dirname, '../../db/seeds');
  const seedFiles = fs.readdirSync(seedsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of seedFiles) {
    db.exec(fs.readFileSync(path.join(seedsDir, file), 'utf8'));
  }

  return db;
}

describe('Phase 9B — World Expansion: Undead Lands, Goblin Cave, Ancient Crypt & Level 1 Ambush', () => {
  let db;
  let server;
  let baseUrl;

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

  async function apiAction(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lab-Client': 'darkgrid-action-ui-lab'
      },
      body: JSON.stringify({ action, payload })
    });
    const json = await res.json();
    return { status: res.status, ...json };
  }

  it('1. Level 1 Ambush Protection Removed Everywhere: Level 1 heroes face Ambushes and 2-round Flee lock in all zones', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Force character to Level 1
    db.prepare('UPDATE characters SET level = 1, xp = 0, current_hp = 24, max_hp = 24').run();
    const charL1 = db.prepare('SELECT * FROM characters WHERE is_alive = 1 LIMIT 1').get();
    assert.equal(charL1.level, 1);

    // Check computePhase9ThreatDecision across Goblin Forest, Goblin Cave Approach, Undead Barrow Road, and Crypt Approach
    const coordsToTest = [
      [15, 22], // Goblin Forest Road
      [8, 12],  // Goblin Cave Approach
      [25, 21], // Undead Barrow Road
      [27, 18], // Undead Mire Off-Road
      [26, 6]   // Crypt Sepulcher Approach
    ];

    for (const [tx, ty] of coordsToTest) {
      const tile = db.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(tx, ty);
      assert.ok(tile, `Tile [${tx},${ty}] must exist`);
      const decision = computePhase9ThreatDecision(db, charL1, null, tile, {
        forcedChance: 100,
        rng: () => 0.01 // Rolls < encounterChance and < rawAmbushProb -> AMBUSH
      });
      assert.equal(
        decision.outcome,
        'AMBUSH',
        `Level 1 hero at [${tx},${ty}] (${decision.zone.zoneKey}) must receive AMBUSH without Level 1 downgrade`
      );
      assert.equal(decision.level1AmbushProtected, false);
    }

    // Verify Monte Carlo simulation at Level 1 produces Ambushes with 0 Level 1 protections
    const simL1 = runPhase9MonteCarloSimulation(db, {
      trials: 500,
      route: ROUTE_A_MAIN_TRAIL,
      heroClass: 'FIGHTER',
      heroLevel: 1,
      seed: 9001
    });
    assert.ok(simL1.avgAmbushes > 1.0, `Expected Level 1 Fighter to average > 1.0 ambushes per trip, got ${simL1.avgAmbushes}`);
    assert.equal(simL1.level1AmbushProtections, 0, 'Zero Level 1 ambush protections should occur');

    // Verify live HTTP step at Level 1 into an Ambush enters IN_COMBAT and locks Flee for 2 rounds
    await apiAction('TELEPORT_TO_TILE', { x: 15, y: 23, facing: 'NORTH' });
    db.prepare('UPDATE characters SET level = 1, current_hp = 80, max_hp = 80').run();

    const stepAmbush = await apiAction('MOVE', {
      direction: 'NORTH',
      testForceEncounter: true,
      testForceOutcome: 'AMBUSH'
    });
    assert.equal(stepAmbush.ok, true);
    assert.equal(stepAmbush.state.character.level, 1);
    assert.ok(stepAmbush.state.encounter, 'Level 1 Ambush must create an active encounter');
    assert.equal(stepAmbush.state.encounter.status, 'IN_COMBAT', 'Level 1 Ambush starts combat immediately');
    assert.equal(stepAmbush.state.encounter.isAmbush, true);
    assert.equal(stepAmbush.state.encounter.fleeLocked, true);
    assert.equal(stepAmbush.state.encounter.ambushFleeLockedRoundsRemaining, 2);

    // Attempt Flee on Round 1 -> blocked
    const fleeR1 = await apiAction('FLEE');
    assert.equal(fleeR1.ok, false);
    assert.match(fleeR1.error, /AMBUSH! You cannot flee during the first 2 combat rounds/i);

    // Keep monster alive through Round 1 & 2 to test Round 2 lock and Round 3 unlock
    db.prepare("UPDATE encounters SET current_monster_hp = 80, monster_max_hp = 80 WHERE status = 'IN_COMBAT'").run();
    const atk1 = await apiAction('ATTACK');
    assert.equal(atk1.ok, true);
    db.prepare('UPDATE characters SET current_hp = 80').run();
    assert.equal(atk1.state.encounter.fleeLocked, true);
    assert.equal(atk1.state.encounter.ambushFleeLockedRoundsRemaining, 1);

    const fleeR2 = await apiAction('FLEE');
    assert.equal(fleeR2.ok, false);

    const atk2 = await apiAction('ATTACK');
    assert.equal(atk2.ok, true);
    db.prepare('UPDATE characters SET current_hp = 80').run();
    assert.equal(atk2.state.encounter.fleeLocked, false);
    assert.equal(atk2.state.encounter.ambushFleeLockedRoundsRemaining, 0);

    const fleeR3 = await apiAction('FLEE');
    assert.equal(fleeR3.ok, true, 'Level 1 hero can flee on Round 3+ after surviving the 2-round ambush lock');
  });

  it('2. World Expansion & Undead Lands Identity: 3 regions, 3 undead sub-biomes, Sepulcher Road, and regional undead monsters', () => {
    assert.equal(TOPDOWN_WORLD_VERSION, 'PHASE_9C_DUNGEONS_AND_HIGHLANDS');
    assert.equal(TOPDOWN_BOUNDS.totalTiles, 1320);

    const blackwoodCount = db.prepare("SELECT COUNT(*) AS cnt FROM map_tiles WHERE region_key = 'BLACKWOOD_FOREST'").get().cnt;
    const undeadCount = db.prepare("SELECT COUNT(*) AS cnt FROM map_tiles WHERE region_key = 'UNDEAD_LANDS'").get().cnt;
    assert.equal(blackwoodCount + undeadCount, 900);
    assert.ok(undeadCount >= 180, `Expected >= 180 Undead Lands tiles, got ${undeadCount}`);

    // Verify 3 distinct passable sub-biomes inside UNDEAD_LANDS
    const undeadBiomes = db.prepare("SELECT DISTINCT biome FROM map_tiles WHERE region_key = 'UNDEAD_LANDS' AND is_passable = 1 ORDER BY biome ASC").all().map((r) => r.biome);
    assert.deepEqual(undeadBiomes, ['ASHEN_BARROWLANDS', 'DEADMANS_MIRE', 'NECROPOLIS_SANCTUM']);

    // Verify Route D (Undead Sepulcher Road) is a continuous 1-tile passable path from Oakhaven [15,27] through Old Stone Bridge [19,25] to Ancient Crypt [26,5]
    const passableSet = new Set(
      TOPDOWN_TILES.filter((t) => t.is_passable === 1).map((t) => `${t.x},${t.y}`)
    );
    assert.deepEqual(ROUTE_D_UNDEAD_SEPULCHER_ROAD[0], [15, 27]);
    const lastCoord = ROUTE_D_UNDEAD_SEPULCHER_ROAD[ROUTE_D_UNDEAD_SEPULCHER_ROAD.length - 1];
    assert.deepEqual(lastCoord, [ANCIENT_CRYPT_COORD.x, ANCIENT_CRYPT_COORD.y]);

    for (let i = 0; i < ROUTE_D_UNDEAD_SEPULCHER_ROAD.length; i++) {
      const [rx, ry] = ROUTE_D_UNDEAD_SEPULCHER_ROAD[i];
      assert.ok(passableSet.has(`${rx},${ry}`), `Route D tile [${rx},${ry}] must be passable`);
      if (i > 0) {
        const dist = Math.abs(rx - ROUTE_D_UNDEAD_SEPULCHER_ROAD[i - 1][0]) + Math.abs(ry - ROUTE_D_UNDEAD_SEPULCHER_ROAD[i - 1][1]);
        assert.equal(dist, 1, `Route D step ${i} must be Manhattan distance 1`);
      }
    }

    // Verify Undead Lands danger zones & undead monster selection
    const barrowRoadTile = db.prepare('SELECT * FROM map_tiles WHERE x = 26 AND y = 15').get();
    const mireOffRoadTile = db.prepare('SELECT * FROM map_tiles WHERE x = 27 AND y = 18').get();
    const cryptApproachTile = db.prepare('SELECT * FROM map_tiles WHERE x = 26 AND y = 6').get();
    const caveApproachTile = db.prepare('SELECT * FROM map_tiles WHERE x = 8 AND y = 12').get();

    assert.equal(resolveTileDangerZone(db, barrowRoadTile).zoneKey, 'UNDEAD_BARROW_ROAD');
    assert.equal(resolveTileDangerZone(db, mireOffRoadTile).zoneKey, 'UNDEAD_MIRE_OFF_ROAD');
    assert.equal(resolveTileDangerZone(db, cryptApproachTile).zoneKey, 'CRYPT_SEPULCHER_APPROACH');
    assert.equal(resolveTileDangerZone(db, caveApproachTile).zoneKey, 'GOBLIN_CAVE_APPROACH');

    // Sample 40 monsters in Undead Lands and verify undead thematic dominance
    let undeadBucketCount = 0;
    let seed = 4242;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 40; i++) {
      const res = selectRegionalEncounterMonster(db, barrowRoadTile, 2, rng);
      assert.ok(res && res.monster);
      if (res.bucket === 'UNDEAD') undeadBucketCount++;
    }
    assert.ok(undeadBucketCount >= 28, `Expected majority of Undead Lands spawns to be UNDEAD, got ${undeadBucketCount}/40`);
  });

  it('3. The Goblin Cave [9, 12]: Auto-opens Major Landmark Scene on arrival, respects anti-interruption, and supports Cave Delve', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Teleport adjacent to Goblin Cave at [8, 12] on the Goblin Cave Spur Trail
    const adjRes = await apiAction('TELEPORT_TO_TILE', { x: 8, y: 12, facing: 'EAST' });
    assert.equal(adjRes.ok, true);
    assert.equal(adjRes.state.landmarkScene, null, 'Adjacent approach tile [8,12] does not open a Major Landmark Scene');

    // Step East onto The Goblin Cave [9, 12]
    const arriveCave = await apiAction('MOVE', { direction: 'EAST', testForceEncounter: false });
    assert.equal(arriveCave.ok, true);
    assert.deepEqual(
      [arriveCave.state.currentTile.x, arriveCave.state.currentTile.y],
      [GOBLIN_CAVE_COORD.x, GOBLIN_CAVE_COORD.y]
    );
    assert.equal(arriveCave.state.encounter, null, 'Stepping onto Goblin Cave never triggers a random step encounter');
    assert.ok(arriveCave.state.landmarkScene, 'Goblin Cave must provide a Major Landmark Scene');
    assert.equal(arriveCave.state.landmarkScene.sceneKey, 'GOBLIN_CAVE');
    assert.equal(arriveCave.state.landmarkScene.isActive, true, 'Goblin Cave scene auto-opens on arrival');
    assert.equal(arriveCave.state.landmarkScene.artworkUrl, '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg');

    const actionKeys = arriveCave.state.landmarkScene.actions.map((a) => a.key);
    assert.deepEqual(actionKeys, ['DELVE_GOBLIN_CAVE', 'CONTINUE_EXPLORING']);

    // Dismiss ("Continue Exploring") -> stays closed on [9, 12]
    const dismissRes = await apiAction('DISMISS_LANDMARK_SCENE');
    assert.equal(dismissRes.ok, true);
    assert.equal(dismissRes.state.landmarkScene.isActive, false);

    // Stepping off [9, 12] to [8, 12] and back onto [9, 12] re-opens the Goblin Cave scene
    await apiAction('MOVE', { direction: 'WEST', testForceEncounter: false });
    const reArrive = await apiAction('MOVE', { direction: 'EAST', testForceEncounter: false });
    assert.equal(reArrive.ok, true);
    assert.equal(reArrive.state.landmarkScene.sceneKey, 'GOBLIN_CAVE');
    assert.equal(reArrive.state.landmarkScene.isActive, true);

    // Clicking "Delve into the Cave Mouth" enters the Goblin Cave dungeon and suppresses landmarkScene
    const delveRes = await apiAction('EXPLORE_GOBLIN_CAVE');
    assert.equal(delveRes.ok, true);
    assert.ok(delveRes.state.dungeonMap && delveRes.state.dungeonMap.inDungeon, 'Delving into Goblin Cave must enter the Goblin Cave dungeon map');
    assert.equal(delveRes.state.dungeonMap.dungeonKey, 'GOBLIN_CAVE');
    assert.equal(delveRes.state.landmarkScene, null, 'Landmark scene must not overlap with active dungeon exploration');
    const exitCave = await apiAction('EXIT_DUNGEON');
    assert.equal(exitCave.ok, true);
  });

  it('4. The Ancient Crypt [26, 5]: Auto-opens Major Landmark Scene on arrival, respects anti-interruption, and supports Crypt Breach', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Teleport to Crypt Approach [26, 6] in Undead Lands
    const approachRes = await apiAction('TELEPORT_TO_TILE', { x: 26, y: 6, facing: 'NORTH' });
    assert.equal(approachRes.ok, true);
    assert.equal(approachRes.state.currentTile.name, 'Sepulcher Terrace');
    assert.equal(approachRes.state.landmarkScene, null);

    // Step North onto The Ancient Crypt [26, 5]
    const arriveCrypt = await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(arriveCrypt.ok, true);
    assert.deepEqual(
      [arriveCrypt.state.currentTile.x, arriveCrypt.state.currentTile.y],
      [ANCIENT_CRYPT_COORD.x, ANCIENT_CRYPT_COORD.y]
    );
    assert.equal(arriveCrypt.state.encounter, null, 'Stepping onto Ancient Crypt never triggers a random step encounter');
    assert.ok(arriveCrypt.state.landmarkScene, 'Ancient Crypt must provide a Major Landmark Scene');
    assert.equal(arriveCrypt.state.landmarkScene.sceneKey, 'ANCIENT_CRYPT');
    assert.equal(arriveCrypt.state.landmarkScene.isActive, true, 'Ancient Crypt scene auto-opens on arrival');
    assert.equal(arriveCrypt.state.landmarkScene.artworkUrl, '/images/terrain/terrain_underground_ruins.webp');

    const actionKeys = arriveCrypt.state.landmarkScene.actions.map((a) => a.key);
    assert.deepEqual(actionKeys, ['ENTER_ANCIENT_CRYPT', 'CONTINUE_EXPLORING']);

    // Dismiss ("Continue Exploring") -> stays closed on [26, 5]
    const dismissRes = await apiAction('DISMISS_LANDMARK_SCENE');
    assert.equal(dismissRes.ok, true);
    assert.equal(dismissRes.state.landmarkScene.isActive, false);

    // Stepping South to [26, 6] and back North to [26, 5] re-opens the Ancient Crypt scene
    await apiAction('MOVE', { direction: 'SOUTH', testForceEncounter: false });
    const reArrive = await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(reArrive.ok, true);
    assert.equal(reArrive.state.landmarkScene.sceneKey, 'ANCIENT_CRYPT');
    assert.equal(reArrive.state.landmarkScene.isActive, true);

    // Clicking "Breach the Sepulcher Vault" enters the Ancient Crypt dungeon and suppresses landmarkScene
    const breachRes = await apiAction('ENTER_ANCIENT_CRYPT');
    assert.equal(breachRes.ok, true);
    assert.ok(breachRes.state.dungeonMap && breachRes.state.dungeonMap.inDungeon, 'Breaching the Ancient Crypt must enter the Ancient Crypt dungeon map');
    assert.equal(breachRes.state.dungeonMap.dungeonKey, 'ANCIENT_CRYPT');
    assert.equal(breachRes.state.landmarkScene, null, 'Landmark scene must not overlap with active dungeon exploration');
    const exitCrypt = await apiAction('EXIT_DUNGEON');
    assert.equal(exitCrypt.ok, true);
  });
});
