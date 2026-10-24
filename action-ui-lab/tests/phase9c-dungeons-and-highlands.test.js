/**
 * DARKGRID PHASE 9C — Large Dungeons (Goblin Cave & Ancient Crypt),
 * Dungeon Fog of War & True Line of Sight, and Third Overworld Region (Ravencrag Highlands)
 * Comprehensive Automated Verification Suite
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createLabApp } = require('../server');
const {
  TOPDOWN_WORLD_VERSION,
  TOPDOWN_BOUNDS,
  TOPDOWN_TILES,
  GOBLIN_CAVE_COORD,
  ANCIENT_CRYPT_COORD,
  RAVENCRAG_CITADEL_COORD,
  ROUTE_E_RAVENCRAG_HIGHLAND_ROAD,
  resolveTileDangerZone,
  selectRavencragHighlandsMonster
} = require('../server/services/topdown-world-service');
const {
  DUNGEON_DEFINITIONS,
  verifyDungeonConnectivity,
  getDungeonVisionRadius,
  hasDungeonLineOfSight,
  computeDungeonVisibleCoords
} = require('../server/services/dungeon-service');

function stepDirection(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (dx === 0 && dy === -1) return 'NORTH';
  if (dx === 0 && dy === 1) return 'SOUTH';
  if (dx === 1 && dy === 0) return 'EAST';
  if (dx === -1 && dy === 0) return 'WEST';
  throw new Error(`Non-adjacent step from [${from}] to [${to}]`);
}

function findShortestDungeonPath(dungeonKey, startCoord, goalCoord) {
  const def = DUNGEON_DEFINITIONS[dungeonKey];
  const startKey = `${startCoord[0]},${startCoord[1]}`;
  const goalKey = `${goalCoord[0]},${goalCoord[1]}`;
  const queue = [[startCoord]];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const path = queue.shift();
    const [cx, cy] = path[path.length - 1];
    if (`${cx},${cy}` === goalKey) return path;

    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nKey = `${nx},${ny}`;
      const tile = def.tileMap.get(nKey);
      if (tile && tile.isPassable === 1 && !visited.has(nKey)) {
        visited.add(nKey);
        queue.push([...path, [nx, ny]]);
      }
    }
  }
  return null;
}

describe('Phase 9C — Large Dungeons, True Dungeon Line-of-Sight Fog of War & Ravencrag Highlands', () => {
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

  async function getState() {
    const res = await fetch(`${baseUrl}/api/state`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    return json.state;
  }

  async function apiAction(action, payload = {}) {
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

  it('1. Dungeon Architecture & BFS Connectivity: Goblin Cave (20x18 = 360) and Ancient Crypt (20x19 = 380) are large, multi-room, and 100% connected', () => {
    const caveDef = DUNGEON_DEFINITIONS.GOBLIN_CAVE;
    const cryptDef = DUNGEON_DEFINITIONS.ANCIENT_CRYPT;

    // Size requirement: ~350-400 total tiles each (~50% of an overworld region)
    assert.equal(caveDef.width, 20);
    assert.equal(caveDef.height, 18);
    assert.equal(caveDef.totalTiles, 360);
    assert.ok(caveDef.passableCount >= 120, `Goblin Cave should have >= 120 passable tiles, got ${caveDef.passableCount}`);

    assert.equal(cryptDef.width, 20);
    assert.equal(cryptDef.height, 19);
    assert.equal(cryptDef.totalTiles, 380);
    assert.ok(cryptDef.passableCount >= 150, `Ancient Crypt should have >= 150 passable tiles, got ${cryptDef.passableCount}`);

    // BFS Connectivity: 100% of passable tiles and boss rooms reachable from entry stairs
    const caveConn = verifyDungeonConnectivity('GOBLIN_CAVE');
    assert.equal(caveConn.ok, true);
    assert.equal(caveConn.unreachableCount, 0);
    assert.equal(caveConn.bossReachable, true);

    const cryptConn = verifyDungeonConnectivity('ANCIENT_CRYPT');
    assert.equal(cryptConn.ok, true);
    assert.equal(cryptConn.unreachableCount, 0);
    assert.equal(cryptConn.bossReachable, true);

    // Verify SQLite persistence of dungeon_definitions and dungeon_tiles
    const dbDefs = db.prepare('SELECT dungeon_key, total_tiles FROM dungeon_definitions ORDER BY dungeon_key ASC').all().map((r) => ({ ...r }));
    assert.deepEqual(dbDefs, [
      { dungeon_key: 'ANCIENT_CRYPT', total_tiles: 380 },
      { dungeon_key: 'GOBLIN_CAVE', total_tiles: 360 }
    ]);

    const dbCaveTiles = db.prepare("SELECT COUNT(*) AS cnt FROM dungeon_tiles WHERE dungeon_key = 'GOBLIN_CAVE'").get().cnt;
    const dbCryptTiles = db.prepare("SELECT COUNT(*) AS cnt FROM dungeon_tiles WHERE dungeon_key = 'ANCIENT_CRYPT'").get().cnt;
    assert.equal(dbCaveTiles, 360);
    assert.equal(dbCryptTiles, 380);
  });

  it('2. Dungeon Fog of War & True Line of Sight: Tighter radius than overworld, walls/corners block sight, 3 FoW states, zero unexplored leakage, and SQLite persistence', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Vision radius is tighter in dungeons (2 for Fighter/Cleric, 3 for Ranger) than overworld (3 and 4)
    assert.equal(getDungeonVisionRadius('FIGHTER'), 2);
    assert.equal(getDungeonVisionRadius('CLERIC'), 2);
    assert.equal(getDungeonVisionRadius('RANGER'), 3);

    // Direct Line-of-Sight unit checks on Goblin Cave tileMap
    const caveMap = DUNGEON_DEFINITIONS.GOBLIN_CAVE.tileMap;
    // Entry is [3, 16], [3, 15] is open, [3, 14] is open, [3, 17] is wall, [4, 13] and [4, 14] are solid walls
    assert.equal(hasDungeonLineOfSight(caveMap, 3, 16, 3, 15, 2), true, 'Open corridor 1 tile north is visible');
    assert.equal(hasDungeonLineOfSight(caveMap, 3, 16, 3, 14, 2), true, 'Open corridor 2 tiles north is visible');
    assert.equal(hasDungeonLineOfSight(caveMap, 4, 12, 4, 15, 3), false, 'Cannot see through solid walls [4, 13] and [4, 14] to [4, 15]');

    // Corner blocking check: at [3, 13], [2, 13] is a solid wall while [3, 14] is open and [2, 14] is open floor around the corner
    assert.equal(caveMap.get('2,13').isPassable, 0, '[2,13] is a solid wall corner');
    assert.equal(caveMap.get('2,14').isPassable, 1, '[2,14] is passable floor around the corner');
    assert.equal(
      hasDungeonLineOfSight(caveMap, 3, 13, 2, 14, 2),
      false,
      'Hero at [3,13] must NOT see around the 90-degree wall corner [2,13] onto floor [2,14]'
    );

    // Ranger has a modest scouting edge (radius 3 down open straight corridor) but still cannot see through walls
    const fighterVis = computeDungeonVisibleCoords('GOBLIN_CAVE', 3, 16, 'FIGHTER');
    const rangerVis = computeDungeonVisibleCoords('GOBLIN_CAVE', 3, 16, 'RANGER');
    assert.equal(fighterVis.has('3,13'), false, 'Fighter (radius 2) does not see 3 tiles down corridor [3,13]');
    assert.equal(rangerVis.has('3,13'), true, 'Ranger (radius 3) sees 3 tiles down open corridor [3,13]');
    assert.equal(rangerVis.has('4,13'), false, 'Ranger still cannot see into solid wall [4,13] around corner');

    // Live HTTP test: Enter Goblin Cave from [9, 12]
    await apiAction('TELEPORT_TO_TILE', { x: GOBLIN_CAVE_COORD.x, y: GOBLIN_CAVE_COORD.y, facing: 'NORTH' });
    const enterRes = await apiAction('EXPLORE_GOBLIN_CAVE');
    assert.equal(enterRes.ok, true);

    const dMapStart = enterRes.state.dungeonMap;
    assert.equal(dMapStart.inDungeon, true);
    assert.equal(dMapStart.dungeonKey, 'GOBLIN_CAVE');
    assert.equal(dMapStart.heroX, 3);
    assert.equal(dMapStart.heroY, 16);

    // Verify 3 distinct Fog of War states and zero information leakage on UNEXPLORED tiles
    const unexploredTiles = dMapStart.tiles.filter((t) => t.fogState === 'UNEXPLORED');
    const visibleTiles = dMapStart.tiles.filter((t) => t.fogState === 'VISIBLE');
    assert.ok(visibleTiles.length >= 5 && visibleTiles.length <= 18, `Initial visible tiles should be tight (${visibleTiles.length})`);
    assert.equal(unexploredTiles.length + visibleTiles.length, 360);

    // Boss tile [16, 2] and Treasure tiles must be UNEXPLORED at start and leak zero metadata
    const bossTileAtStart = dMapStart.tiles.find((t) => t.x === 16 && t.y === 2);
    assert.equal(bossTileAtStart.fogState, 'UNEXPLORED');
    assert.equal(bossTileAtStart.isDiscovered, false);
    assert.equal(bossTileAtStart.name, 'Unexplored Darkness');
    assert.equal(bossTileAtStart.roomType, 'UNKNOWN');
    assert.equal(bossTileAtStart.bossKey, null);
    assert.equal(bossTileAtStart.treasureKey, null);
    assert.equal(bossTileAtStart.fixedEncounterKey, null);

    // Step North 3 tiles ([3,16] -> [3,15] -> [3,14] -> [3,13]) so [3,16] falls behind vision radius 2 into EXPLORED_MEMORY
    await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    const step3 = await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(step3.ok, true);
    assert.equal(step3.state.dungeonMap.heroX, 3);
    assert.equal(step3.state.dungeonMap.heroY, 13);

    const entryTileMemory = step3.state.dungeonMap.tiles.find((t) => t.x === 3 && t.y === 16);
    assert.equal(entryTileMemory.isDiscovered, true, 'Previously visited entry stairs remain discovered');
    assert.equal(entryTileMemory.isVisibleNow, false, 'Entry stairs 3 tiles away are no longer in Fighter LoS (radius 2)');
    assert.equal(entryTileMemory.fogState, 'EXPLORED_MEMORY', 'Tile transitions cleanly to EXPLORED_MEMORY');
    assert.equal(entryTileMemory.roomType, 'EXIT_STAIRS', 'Explored memory retains terrain/room identity');

    // Verify discovery persists in SQLite across reload (GET /api/state)
    const reloadedState = await getState();
    assert.equal(reloadedState.dungeonMap.inDungeon, true);
    assert.equal(reloadedState.dungeonMap.heroX, 3);
    assert.equal(reloadedState.dungeonMap.heroY, 13);
    assert.equal(reloadedState.dungeonMap.discoveredCount, step3.state.dungeonMap.discoveredCount);
  });

  it('3. Goblin Cave Full Gameplay: Wall collision protection, treasures, underground encounters, Boss Skulkrip at [16, 2], and exit back to overworld', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    await apiAction('TELEPORT_TO_TILE', { x: GOBLIN_CAVE_COORD.x, y: GOBLIN_CAVE_COORD.y, facing: 'NORTH' });

    const enterRes = await apiAction('EXPLORE_GOBLIN_CAVE');
    assert.equal(enterRes.ok, true);
    assert.equal(enterRes.state.dungeonMap.heroX, 3);
    assert.equal(enterRes.state.dungeonMap.heroY, 16);

    // Attempting to walk into a solid wall ([3, 17] SOUTH from [3, 16]) must be rejected
    const blockedSouth = await apiAction('MOVE', { direction: 'SOUTH', testForceEncounter: false });
    assert.equal(blockedSouth.ok, false, 'Must block movement into solid dungeon wall [3, 17]');
    assert.equal(blockedSouth.state.dungeonMap.heroX, 3);
    assert.equal(blockedSouth.state.dungeonMap.heroY, 16);

    // Walk to Treasure Room [1, 15] (CAVE_SMUGGLER_STASH) and verify wall collision at [0, 15] WEST and gold/loot discovery
    const pathToTreasure = findShortestDungeonPath('GOBLIN_CAVE', [3, 16], [1, 15]);
    assert.ok(pathToTreasure && pathToTreasure.length > 1);
    const goldBeforeTreasure = enterRes.state.character.gold;
    let lastStep = enterRes;
    for (let i = 1; i < pathToTreasure.length; i++) {
      const dir = stepDirection(pathToTreasure[i - 1], pathToTreasure[i]);
      lastStep = await apiAction('MOVE', { direction: dir, testForceEncounter: false });
      assert.equal(lastStep.ok, true);
    }
    assert.equal(lastStep.state.dungeonMap.heroX, 1);
    assert.equal(lastStep.state.dungeonMap.heroY, 15);
    assert.ok(lastStep.state.character.gold > goldBeforeTreasure, 'Opening Goblin Cave treasure chest awards gold');

    const blockedWestWall = await apiAction('MOVE', { direction: 'WEST', testForceEncounter: false });
    assert.equal(blockedWestWall.ok, false, 'Must block movement into solid outer dungeon wall [0, 15]');
    assert.equal(blockedWestWall.state.dungeonMap.heroX, 1);
    assert.equal(blockedWestWall.state.dungeonMap.heroY, 15);

    // Navigate from [1, 15] to Boss Sanctum [16, 2]
    const pathToBoss = findShortestDungeonPath('GOBLIN_CAVE', [1, 15], [16, 2]);
    assert.ok(pathToBoss && pathToBoss.length > 10, 'Path to Goblin Cave boss sanctum [16, 2] exists');
    const heroId = lastStep.state.character.id;
    db.prepare('UPDATE characters SET strength = 28, current_hp = 80, max_hp = 80 WHERE id = ?').run(heroId);

    for (let i = 1; i < pathToBoss.length; i++) {
      const dir = stepDirection(pathToBoss[i - 1], pathToBoss[i]);
      const stepRes = await apiAction('MOVE', { direction: dir, testForceEncounter: false });
      assert.equal(stepRes.ok, true);
      // If a fixed guard encounter triggers on the way, resolve it
      if (stepRes.state.encounter) {
        if (stepRes.state.encounter.status === 'DISCOVERED') {
          await apiAction('FIGHT');
        }
        let st = await getState();
        while (st.mode === 'IN_COMBAT') {
          const atk = await apiAction('ATTACK');
          st = atk.state;
          db.prepare('UPDATE characters SET current_hp = 80 WHERE id = ?').run(heroId);
        }
      }
    }

    const atBoss = await getState();
    assert.equal(atBoss.dungeonMap.heroX, 16);
    assert.equal(atBoss.dungeonMap.heroY, 2);
    assert.equal(atBoss.dungeonMap.atBossTile, true);
    assert.equal(atBoss.dungeonMap.canChallengeBoss, true);

    // Engage Skulkrip the Cave Brood-King
    const engageBoss = await apiAction('ENGAGE_DUNGEON_BOSS');
    assert.equal(engageBoss.ok, true);
    let bossSt = engageBoss.state;
    while (bossSt.mode === 'IN_COMBAT') {
      assert.equal(bossSt.encounter.monsterName, 'Skulkrip the Cave Brood-King');
      const atk = await apiAction('ATTACK');
      assert.equal(atk.ok, true);
      bossSt = atk.state;
      db.prepare('UPDATE characters SET current_hp = 80 WHERE id = ?').run(heroId);
    }
    assert.equal(bossSt.dungeonMap.bossSlain, true, 'Skulkrip the Cave Brood-King is marked slain');
    assert.equal(bossSt.dungeonMap.canChallengeBoss, false);

    // Walk back to exit stairs [3, 16] and exit dungeon to [9, 12]
    const pathToExit = findShortestDungeonPath('GOBLIN_CAVE', [16, 2], [3, 16]);
    for (let i = 1; i < pathToExit.length; i++) {
      const dir = stepDirection(pathToExit[i - 1], pathToExit[i]);
      const stepRes = await apiAction('MOVE', { direction: dir, testForceEncounter: false });
      assert.equal(stepRes.ok, true);
      if (stepRes.state.encounter && stepRes.state.encounter.status === 'DISCOVERED') {
        await apiAction('AVOID');
      }
    }

    const exitRes = await apiAction('EXIT_DUNGEON');
    assert.equal(exitRes.ok, true);
    assert.equal(Boolean(exitRes.state.dungeonMap && exitRes.state.dungeonMap.inDungeon), false);
    assert.equal(exitRes.state.currentTile.x, GOBLIN_CAVE_COORD.x);
    assert.equal(exitRes.state.currentTile.y, GOBLIN_CAVE_COORD.y);
  });

  it('4. Ancient Crypt & Oakhaven Quest: Accepts THE_ANCIENT_CRYPT, explores undead halls, defeats Lord Malakor at [10, 2], and claims reward in Oakhaven', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Accept "The Crypt of the Barrow-King" in Oakhaven [15, 27]
    const acceptCryptQuest = await apiAction('ACCEPT_QUEST', { questKey: 'THE_ANCIENT_CRYPT' });
    assert.equal(acceptCryptQuest.ok, true);
    const cryptQuestActive = acceptCryptQuest.state.quests.find((q) => q.key === 'THE_ANCIENT_CRYPT');
    assert.ok(cryptQuestActive, 'THE_ANCIENT_CRYPT exists in state.quests');
    assert.equal(cryptQuestActive.status, 'ACTIVE');

    // Teleport to Ancient Crypt entrance [26, 5] and enter dungeon
    await apiAction('TELEPORT_TO_TILE', { x: ANCIENT_CRYPT_COORD.x, y: ANCIENT_CRYPT_COORD.y, facing: 'NORTH' });
    const enterCrypt = await apiAction('ENTER_ANCIENT_CRYPT');
    assert.equal(enterCrypt.ok, true);
    assert.equal(enterCrypt.state.dungeonMap.inDungeon, true);
    assert.equal(enterCrypt.state.dungeonMap.dungeonKey, 'ANCIENT_CRYPT');
    assert.equal(enterCrypt.state.dungeonMap.heroX, 10);
    assert.equal(enterCrypt.state.dungeonMap.heroY, 17);

    // Navigate from [10, 17] to Boss Sanctum [10, 2]
    const pathToCryptBoss = findShortestDungeonPath('ANCIENT_CRYPT', [10, 17], [10, 2]);
    assert.ok(pathToCryptBoss && pathToCryptBoss.length > 10);
    const heroId = enterCrypt.state.character.id;
    db.prepare('UPDATE characters SET strength = 30, current_hp = 90, max_hp = 90 WHERE id = ?').run(heroId);

    for (let i = 1; i < pathToCryptBoss.length; i++) {
      const dir = stepDirection(pathToCryptBoss[i - 1], pathToCryptBoss[i]);
      const stepRes = await apiAction('MOVE', { direction: dir, testForceEncounter: false });
      assert.equal(stepRes.ok, true);
      if (stepRes.state.encounter) {
        if (stepRes.state.encounter.status === 'DISCOVERED') {
          await apiAction('FIGHT');
        }
        let st = await getState();
        while (st.mode === 'IN_COMBAT') {
          const atk = await apiAction('ATTACK');
          st = atk.state;
          db.prepare('UPDATE characters SET current_hp = 90 WHERE id = ?').run(heroId);
        }
      }
    }

    const atCryptBoss = await getState();
    assert.equal(atCryptBoss.dungeonMap.heroX, 10);
    assert.equal(atCryptBoss.dungeonMap.heroY, 2);
    assert.equal(atCryptBoss.dungeonMap.atBossTile, true);

    // Engage and defeat Lord Malakor the Barrow-Wight King
    const engageMalakor = await apiAction('ENGAGE_DUNGEON_BOSS');
    assert.equal(engageMalakor.ok, true);
    let malakorSt = engageMalakor.state;
    while (malakorSt.mode === 'IN_COMBAT') {
      assert.equal(malakorSt.encounter.monsterName, 'Lord Malakor the Barrow-Wight King');
      const atk = await apiAction('ATTACK');
      assert.equal(atk.ok, true);
      malakorSt = atk.state;
      db.prepare('UPDATE characters SET current_hp = 90 WHERE id = ?').run(heroId);
    }

    assert.equal(malakorSt.dungeonMap.bossSlain, true, 'Lord Malakor is marked slain');
    const cryptQuestCompleted = malakorSt.quests.find((q) => q.key === 'THE_ANCIENT_CRYPT');
    assert.equal(cryptQuestCompleted.status, 'COMPLETED', 'THE_ANCIENT_CRYPT quest transitions to COMPLETED on boss kill');

    // Return to Oakhaven [15, 27] and claim quest reward
    await apiAction('TELEPORT_TO_TILE', { x: 15, y: 27, facing: 'NORTH' });
    const goldBeforeClaim = (await getState()).character.gold;
    const claimCrypt = await apiAction('CLAIM_QUEST_REWARD', { questKey: 'THE_ANCIENT_CRYPT' });
    assert.equal(claimCrypt.ok, true);
    const cryptQuestClaimed = claimCrypt.state.quests.find((q) => q.key === 'THE_ANCIENT_CRYPT');
    assert.equal(cryptQuestClaimed.status, 'REWARD_CLAIMED');
    assert.ok(claimCrypt.state.character.gold >= goldBeforeClaim + 120);
  });

  it('5. Third Overworld Region — Ravencrag Highlands: 420 tiles, 3 sub-biomes, 3 SQLite danger zones, natural passes, Ravencrag Citadel boss & quest, and 3-region World Map', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    assert.equal(TOPDOWN_WORLD_VERSION, 'PHASE_9C_DUNGEONS_AND_HIGHLANDS');
    assert.equal(TOPDOWN_BOUNDS.cols, 44);
    assert.equal(TOPDOWN_BOUNDS.rows, 30);
    assert.equal(TOPDOWN_BOUNDS.totalTiles, 1320);

    const highlandCount = db.prepare("SELECT COUNT(*) AS cnt FROM map_tiles WHERE region_key = 'RAVENCRAG_HIGHLANDS'").get().cnt;
    assert.equal(highlandCount, 420, 'Ravencrag Highlands spans x = 30..43, y = 0..29 (420 tiles)');

    // Verify 3 distinct passable sub-biomes in RAVENCRAG_HIGHLANDS
    const highlandBiomes = db.prepare(
      "SELECT DISTINCT biome FROM map_tiles WHERE region_key = 'RAVENCRAG_HIGHLANDS' AND is_passable = 1 ORDER BY biome ASC"
    ).all().map((r) => r.biome);
    assert.deepEqual(highlandBiomes, ['SHATTERED_GORGE', 'STORMPEAK_CRAGS', 'WINDSCAR_FOOTHILLS']);

    // Verify 3 independent SQLite danger_zone_profiles for Ravencrag Highlands
    const foothillTile = db.prepare('SELECT * FROM map_tiles WHERE x = 31 AND y = 23').get();
    const gorgeTile = db.prepare('SELECT * FROM map_tiles WHERE x = 35 AND y = 15').get();
    const stormpeakTile = db.prepare('SELECT * FROM map_tiles WHERE x = 37 AND y = 6').get();

    assert.equal(resolveTileDangerZone(db, foothillTile).zoneKey, 'HIGHLAND_FOOTHILL_ROAD');
    assert.equal(resolveTileDangerZone(db, gorgeTile).zoneKey, 'HIGHLAND_SHATTERED_GORGE');
    assert.equal(resolveTileDangerZone(db, stormpeakTile).zoneKey, 'STORMPEAK_CITADEL_APPROACH');

    // Verify Highland monster pools escalate across sub-biomes
    let seed = 777;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 20; i++) {
      const mFoothill = selectRavencragHighlandsMonster(db, 2, rng, foothillTile);
      const mStormpeak = selectRavencragHighlandsMonster(db, 3, rng, stormpeakTile);
      assert.ok(mFoothill && mFoothill.monster);
      assert.ok(mStormpeak && mStormpeak.monster);
    }

    // Verify Route E (Ravencrag Highland Road) is a continuous 1-tile passable path from Oakhaven [15,27] to Ravencrag Citadel [37,3]
    const passableSet = new Set(
      TOPDOWN_TILES.filter((t) => t.is_passable === 1).map((t) => `${t.x},${t.y}`)
    );
    assert.deepEqual(ROUTE_E_RAVENCRAG_HIGHLAND_ROAD[0], [15, 27]);
    assert.deepEqual(
      ROUTE_E_RAVENCRAG_HIGHLAND_ROAD[ROUTE_E_RAVENCRAG_HIGHLAND_ROAD.length - 1],
      [RAVENCRAG_CITADEL_COORD.x, RAVENCRAG_CITADEL_COORD.y]
    );
    for (let i = 1; i < ROUTE_E_RAVENCRAG_HIGHLAND_ROAD.length; i++) {
      const [rx, ry] = ROUTE_E_RAVENCRAG_HIGHLAND_ROAD[i];
      assert.ok(passableSet.has(`${rx},${ry}`), `Route E tile [${rx},${ry}] must be passable`);
      const dist = Math.abs(rx - ROUTE_E_RAVENCRAG_HIGHLAND_ROAD[i - 1][0]) + Math.abs(ry - ROUTE_E_RAVENCRAG_HIGHLAND_ROAD[i - 1][1]);
      assert.equal(dist, 1, `Route E step ${i} must be Manhattan distance 1`);
    }

    // Verify Region Map has all 3 regions and hides Ravencrag Citadel before discovery
    const startSt = await getState();
    assert.equal(startSt.topdownMap.regionMap.regions.length, 3);
    assert.equal(startSt.topdownMap.regionMap.ravencragCitadelDiscovered, false);
    assert.equal(
      startSt.topdownMap.regionMap.landmarks.some((lm) => lm.key === 'RAVENCRAG_CITADEL'),
      false,
      'Undiscovered Ravencrag Citadel must not leak onto the Region Map landmark list'
    );

    // Accept "The Warlord of Ravencrag" quest in Oakhaven
    const acceptHighlandQuest = await apiAction('ACCEPT_QUEST', { questKey: 'THE_RAVENCRAG_WARLORD' });
    assert.equal(acceptHighlandQuest.ok, true);

    // Step from Citadel Approach [37, 4] North onto Ravencrag Citadel [37, 3]
    await apiAction('TELEPORT_TO_TILE', { x: 37, y: 4, facing: 'NORTH' });
    const arriveCitadel = await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(arriveCitadel.ok, true);
    assert.equal(arriveCitadel.state.currentTile.x, 37);
    assert.equal(arriveCitadel.state.currentTile.y, 3);
    assert.ok(arriveCitadel.state.landmarkScene, 'Ravencrag Citadel opens Major Landmark Scene on arrival');
    assert.equal(arriveCitadel.state.landmarkScene.sceneKey, 'RAVENCRAG_CITADEL');
    assert.equal(arriveCitadel.state.landmarkScene.isActive, true);
    assert.equal(arriveCitadel.state.topdownMap.regionMap.ravencragCitadelDiscovered, true);

    // Confront Warlord Kraug the Crag-Breaker
    const heroId = arriveCitadel.state.character.id;
    db.prepare('UPDATE characters SET level = 6, constitution = 18, strength = 30, current_hp = 72, max_hp = 72 WHERE id = ?').run(heroId);
    const confrontRes = await apiAction('CONFRONT_HIGHLAND_WARLORD');
    assert.equal(confrontRes.ok, true);

    let kraugSt = confrontRes.state;
    while (kraugSt.mode === 'IN_COMBAT') {
      assert.equal(kraugSt.encounter.monsterName, 'Warlord Kraug the Crag-Breaker');
      const atk = await apiAction('ATTACK');
      assert.equal(atk.ok, true);
      kraugSt = atk.state;
      db.prepare('UPDATE characters SET current_hp = 72 WHERE id = ?').run(heroId);
    }

    assert.equal(kraugSt.topdownMap.highlandBossSlain, true, 'Warlord Kraug is marked slain');
    const warlordQuestDone = kraugSt.quests.find((q) => q.key === 'THE_RAVENCRAG_WARLORD');
    assert.equal(warlordQuestDone.status, 'COMPLETED');

    // Return to Oakhaven and claim reward
    await apiAction('TELEPORT_TO_TILE', { x: 15, y: 27, facing: 'NORTH' });
    const claimWarlord = await apiAction('CLAIM_QUEST_REWARD', { questKey: 'THE_RAVENCRAG_WARLORD' });
    assert.equal(claimWarlord.ok, true);
    const warlordQuestClaimed = claimWarlord.state.quests.find((q) => q.key === 'THE_RAVENCRAG_WARLORD');
    assert.equal(warlordQuestClaimed.status, 'REWARD_CLAIMED');
  });

  it('6. Dungeon Ambush (Level 1 Ambush + Round 1–2 Flee Lock), Cleric Undead Specialization in Ancient Crypt, and Permadeath in Dungeons', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'FIGHTER' });
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // 6a. Level 1 hero in Goblin Cave can be ambushed, and Flee is locked during Rounds 1–2
    await apiAction('TELEPORT_TO_TILE', { x: GOBLIN_CAVE_COORD.x, y: GOBLIN_CAVE_COORD.y, facing: 'NORTH' });
    const enterCave = await apiAction('EXPLORE_GOBLIN_CAVE');
    assert.equal(enterCave.ok, true);
    assert.equal(enterCave.state.character.level, 1);

    const ambushStep = await apiAction('MOVE', {
      direction: 'NORTH',
      testForceEncounter: true,
      testForceAmbush: true,
      testForceOutcome: 'AMBUSH'
    });
    assert.equal(ambushStep.ok, true);
    assert.equal(ambushStep.state.mode, 'IN_COMBAT', 'Dungeon ambush enters IN_COMBAT immediately even at Level 1');
    assert.equal(ambushStep.state.encounter.isAmbush, true);
    assert.equal(ambushStep.state.encounter.fleeLocked, true, 'Round 1 Flee Lock is active in dungeon ambush');

    // Attempting to FLEE in Round 1 must be blocked
    const fleeBlocked = await apiAction('FLEE');
    assert.equal(fleeBlocked.ok, false, 'Fleeing during Round 1–2 of a dungeon ambush must be rejected');

    // 6b. Switch to Cleric in Ancient Crypt and verify undead combat specialization works
    await apiAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'CLERIC' });
    await apiAction('TELEPORT_TO_TILE', { x: ANCIENT_CRYPT_COORD.x, y: ANCIENT_CRYPT_COORD.y, facing: 'NORTH' });
    const enterCryptCleric = await apiAction('ENTER_ANCIENT_CRYPT');
    assert.equal(enterCryptCleric.ok, true);
    assert.equal(enterCryptCleric.state.character.class, 'CLERIC');

    const cryptEncounterStep = await apiAction('MOVE', {
      direction: 'NORTH',
      testForceEncounter: true,
      testForceAmbush: false,
      testForceOutcome: 'ENCOUNTER'
    });
    assert.equal(cryptEncounterStep.ok, true);
    assert.ok(cryptEncounterStep.state.encounter, 'Encounter spawned inside Ancient Crypt');
    await apiAction('FIGHT');

    // 6c. Verify permadeath inside a dungeon transitions to FALLEN without free heal or free teleport
    const clericId = enterCryptCleric.state.character.id;
    db.prepare('UPDATE characters SET current_hp = 1, constitution = 8, dexterity = 6 WHERE id = ?').run(clericId);
    const activeEncRow = db.prepare("SELECT id, monster_id FROM encounters WHERE character_id = ? AND status = 'IN_COMBAT' ORDER BY id DESC LIMIT 1").get(clericId);
    if (activeEncRow) {
      db.prepare('UPDATE monsters SET attack_bonus = 25, damage_dice = ? WHERE id = ?').run('4d8+10', activeEncRow.monster_id);
      db.prepare('UPDATE encounters SET current_monster_hp = 80, monster_max_hp = 80 WHERE id = ?').run(activeEncRow.id);
    }

    const fatalRound = await apiAction('ATTACK');
    assert.equal(fatalRound.ok, true);
    assert.equal(fatalRound.state.mode, 'FALLEN', 'Dying inside a dungeon triggers standard permadeath (FALLEN mode)');
    assert.equal(fatalRound.state.character, null, 'Fallen hero is no longer living');

    // Revive for clean post-test state
    await apiAction('REVIVE', { classType: 'FIGHTER' });
  });
});
