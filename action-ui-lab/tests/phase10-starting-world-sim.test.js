/**
 * DARKGRID PHASE 10 — AGENT C: STARTING WORLD LEVEL 1–4
 * Deep Analysis & Deterministic Monte Carlo Simulation Suite
 *
 * Evaluates:
 * 1. Outbound routes from Oakhaven [15, 27] (Routes A, B, C, D, E + Goblin Cave path),
 *    tile passability, Major Landmark spacing, and Danger Zone profile mapping.
 * 2. Monster pools and encounter/ambush probabilities across all regions for Level 1–4 heroes,
 *    including verification that Level 1 Ambush Protection remains disabled everywhere.
 * 3. Monte Carlo step-to-encounter simulations (1st, 2nd, and 3rd encounters from Oakhaven)
 *    under both Live Paced Navigation and Raw Danger Zone rates.
 * 4. Monte Carlo full combat simulations for Fighter, Ranger, and Cleric at Levels 1–4
 *    across 7 regional danger zones + 4 Bosses (Win %, Flee %, Death %, Ambush Death %, XP/fight).
 * 5. Level 1–4 XP progression curve (FAST_XP_TABLE vs PF1e Medium), Oakhaven Quests,
 *    Watcher's Board Bounties, and open-ended level scaling verification.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createLabApp } = require('../server');
const {
  TOWN_COORD,
  STRONGHOLD_COORD,
  GOBLIN_CAVE_COORD,
  ANCIENT_CRYPT_COORD,
  RAVENCRAG_CITADEL_COORD,
  ROUTE_A_MAIN_TRAIL,
  ROUTE_B_WESTERN_WILDERNESS,
  ROUTE_C_EASTERN_RIVER,
  ROUTE_D_UNDEAD_SEPULCHER_ROAD,
  ROUTE_E_RAVENCRAG_HIGHLAND_ROAD,
  DANGER_ZONE_PROFILES,
  QUEST_DEFINITIONS,
  STRONGHOLD_BOSS_PROFILE,
  HIGHLAND_BOSS_PROFILE,
  resolveTileDangerZone,
  isMajorLandmarkTile,
  computePhase8StepEncounterChance,
  computePhase9ThreatDecision,
  selectRegionalEncounterMonster,
  selectGoblinCaveMonster
} = require('../server/services/topdown-world-service');
const {
  DUNGEON_BOSS_PROFILES
} = require('../server/services/dungeon-service');
const {
  computeEncounterPacingChance
} = require('../adventure-engine');
const {
  FAST_XP_TABLE,
  getModifier,
  getLevelForXp,
  calculateMaxDivineCharges,
  createCharacter,
  applyCharacterLevelUp,
  spendAttributePoint,
  getCharacterEquipment
} = require('../../src/domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus,
  getHeroDamageFormula
} = require('../../src/domain/combat/rules');
const {
  investigateEncounter
} = require('../../src/domain/encounters/engine');
const {
  startCombat,
  executeCombatRound
} = require('../../src/domain/combat/engine');
const {
  getReachableWildernessRegions,
  getOrGenerateContracts
} = require('../../src/domain/bounties/board');

/**
 * Deterministic Mulberry32 PRNG for reproducible Monte Carlo simulations.
 */
function createSeededRng(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return function nextRandom() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function findShortestOverworldPath(db, startCoord, goalCoord) {
  const rows = db.prepare('SELECT x, y, is_passable FROM map_tiles').all();
  const passable = new Set(rows.filter((r) => r.is_passable === 1).map((r) => `${r.x},${r.y}`));
  const startKey = `${startCoord.x},${startCoord.y}`;
  const goalKey = `${goalCoord.x},${goalCoord.y}`;
  const queue = [[[startCoord.x, startCoord.y]]];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const path = queue.shift();
    const [cx, cy] = path[path.length - 1];
    if (`${cx},${cy}` === goalKey) return path;

    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (passable.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push([...path, [nx, ny]]);
      }
    }
  }
  return null;
}

describe('Phase 10 — Agent C: Starting World Level 1–4 Analysis & Monte Carlo Simulation', () => {
  let db;
  let server;
  const simulationReportData = {};

  before(async () => {
    const app = createLabApp({ dbPath: ':memory:', allowLabTools: true });
    db = app.locals.db;
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (db) {
      try { db.close(); } catch {}
    }
  });

  it('1. Outbound Routes from Oakhaven [15, 27] & Danger Zone Architecture', () => {
    assert.deepEqual(TOWN_COORD, { x: 15, y: 27 });
    assert.deepEqual(STRONGHOLD_COORD, { x: 15, y: 2 });
    assert.deepEqual(GOBLIN_CAVE_COORD, { x: 9, y: 12 });
    assert.deepEqual(ANCIENT_CRYPT_COORD, { x: 26, y: 5 });
    assert.deepEqual(RAVENCRAG_CITADEL_COORD, { x: 37, y: 3 });

    const shortestToGoblinCave = findShortestOverworldPath(db, TOWN_COORD, GOBLIN_CAVE_COORD);
    assert.ok(shortestToGoblinCave && shortestToGoblinCave.length > 0);

    // Build Route B spur to Goblin Cave: [15,27] -> [6,13] (index 23) -> [7,13] -> [8,13] -> [9,13] -> [9,12]
    const campIdx = ROUTE_B_WESTERN_WILDERNESS.findIndex(([x, y]) => x === 6 && y === 13);
    const routeBGoblinCave = [
      ...ROUTE_B_WESTERN_WILDERNESS.slice(0, campIdx + 1),
      [7, 13],
      [8, 13],
      [9, 13],
      [9, 12]
    ];

    const routeCatalog = {
      ROUTE_A_MAIN_TRAIL: {
        label: 'Route A — King’s Road (North Trail to Goblin Stronghold)',
        coords: ROUTE_A_MAIN_TRAIL,
        destination: 'Goblin Stronghold [15, 2]'
      },
      ROUTE_B_WESTERN_WILDERNESS: {
        label: 'Route B — Western Wilds & Whispering Crags to Stronghold',
        coords: ROUTE_B_WESTERN_WILDERNESS,
        destination: 'Goblin Stronghold [15, 2]'
      },
      ROUTE_B_GOBLIN_CAVE_SPUR: {
        label: 'Route B Spur — Western Trail to Goblin Cave',
        coords: routeBGoblinCave,
        destination: 'The Goblin Cave [9, 12]'
      },
      ROUTE_SHORTEST_GOBLIN_CAVE: {
        label: 'Shortest BFS Path — Oakhaven to Goblin Cave',
        coords: shortestToGoblinCave,
        destination: 'The Goblin Cave [9, 12]'
      },
      ROUTE_C_EASTERN_RIVER: {
        label: 'Route C — Eastern River & Ravine Trail to Stronghold',
        coords: ROUTE_C_EASTERN_RIVER,
        destination: 'Goblin Stronghold [15, 2]'
      },
      ROUTE_D_UNDEAD_SEPULCHER_ROAD: {
        label: 'Route D — Sepulcher Road to Ancient Crypt',
        coords: ROUTE_D_UNDEAD_SEPULCHER_ROAD,
        destination: 'The Ancient Crypt [26, 5]'
      },
      ROUTE_E_RAVENCRAG_HIGHLAND_ROAD: {
        label: 'Route E — Highland Foothill Road to Ravencrag Citadel',
        coords: ROUTE_E_RAVENCRAG_HIGHLAND_ROAD,
        destination: 'Ravencrag Citadel [37, 3]'
      }
    };

    const routeSummaries = {};
    for (const [key, def] of Object.entries(routeCatalog)) {
      const steps = def.coords.length - 1;
      const zoneCounts = {};
      const terrainCounts = {};
      const majorLandmarksOnRoute = [];

      for (let i = 0; i < def.coords.length; i++) {
        const [x, y] = def.coords[i];
        const tile = db.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(x, y);
        assert.ok(tile, `Tile [${x},${y}] on ${key} must exist`);
        assert.equal(tile.is_passable, 1, `Tile [${x},${y}] on ${key} must be passable`);

        if (i > 0) {
          const [px, py] = def.coords[i - 1];
          assert.equal(Math.abs(x - px) + Math.abs(y - py), 1, `Step ${i} on ${key} must be cardinal`);
          const zone = resolveTileDangerZone(db, tile);
          zoneCounts[zone.zoneKey] = (zoneCounts[zone.zoneKey] || 0) + 1;
          terrainCounts[tile.terrain] = (terrainCounts[tile.terrain] || 0) + 1;
          if (isMajorLandmarkTile(tile)) {
            majorLandmarksOnRoute.push({ step: i, coord: `[${x},${y}]`, name: tile.name });
          }
        }
      }

      routeSummaries[key] = {
        label: def.label,
        destination: def.destination,
        totalSteps: steps,
        totalTiles: def.coords.length,
        zoneCounts,
        terrainCounts,
        majorLandmarksOnRoute
      };
    }

    const northGateTile = db.prepare('SELECT * FROM map_tiles WHERE x = 15 AND y = 26').get();
    const firstTrailTile = db.prepare('SELECT * FROM map_tiles WHERE x = 15 AND y = 25').get();
    const outskirtsOffRoadTile = db.prepare('SELECT * FROM map_tiles WHERE x = 14 AND y = 25').get();

    assert.equal(northGateTile.is_safe, 1, 'Oakhaven North Gate [15, 26] is marked is_safe = 1');
    assert.equal(resolveTileDangerZone(db, northGateTile).zoneKey, 'OAKHAVEN_SAFE');
    assert.equal(resolveTileDangerZone(db, firstTrailTile).zoneKey, 'GOBLIN_FOREST_ROAD');
    assert.equal(resolveTileDangerZone(db, outskirtsOffRoadTile).zoneKey, 'GOBLIN_FOREST_OFF_ROAD');

    simulationReportData.routeSummaries = routeSummaries;
    assert.equal(Object.keys(DANGER_ZONE_PROFILES).length, 12);
  });

  it('2. Regional Monster Pools (Level 1–4), Gaussian CR Comparison & Level 1 Ambush Verification', () => {
    const rawMonsters = db.prepare('SELECT * FROM monsters ORDER BY challenge_rating ASC, id ASC').all();
    assert.ok(rawMonsters.length >= 20);
    const allMonsters = rawMonsters.map((m) => ({
      id: m.id,
      name: m.name,
      cr: m.challenge_rating,
      soloLevel: m.solo_level,
      hp: m.base_hp,
      ac: m.armor_class,
      attackBonus: m.attack_bonus,
      damageDice: m.damage_dice,
      xp: m.xp_reward,
      initBonus: m.initiative_bonus
    }));

    // Verify Level 1 Ambush Protection is disabled across all danger zones
    const level1Fighter = { id: 999, class: 'FIGHTER', level: 1, wisdom: 12 };
    const sampleCoordsByZone = [
      [15, 24], // GOBLIN_FOREST_ROAD
      [14, 24], // GOBLIN_FOREST_OFF_ROAD
      [9, 13],  // GOBLIN_CAVE_APPROACH
      [19, 13], // GOBLIN_HUNTING_GROUNDS
      [15, 4],  // STRONGHOLD_APPROACH
      [26, 21], // UNDEAD_BARROW_ROAD
      [23, 16], // UNDEAD_MIRE_OFF_ROAD
      [26, 7],  // CRYPT_SEPULCHER_APPROACH
      [32, 22], // HIGHLAND_FOOTHILL_ROAD
      [35, 14], // HIGHLAND_SHATTERED_GORGE
      [37, 6]   // STORMPEAK_CITADEL_APPROACH
    ];

    for (const [x, y] of sampleCoordsByZone) {
      const tile = db.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(x, y);
      const forcedAmbush = computePhase9ThreatDecision(db, level1Fighter, null, tile, {
        forceOutcome: 'AMBUSH'
      });
      assert.equal(forcedAmbush.outcome, 'AMBUSH', `Level 1 must be able to be ambushed at [${x},${y}]`);
      assert.equal(forcedAmbush.level1AmbushProtected, false, `level1AmbushProtected must be false at [${x},${y}]`);
    }

    // Sample monster distributions across regions for Levels 1, 2, 3, and 4 (1,000 samples each)
    const regionSampleTiles = {
      GOBLIN_FOREST: db.prepare('SELECT * FROM map_tiles WHERE x = 15 AND y = 24').get(),
      GOBLIN_CAVE: db.prepare('SELECT * FROM map_tiles WHERE x = 9 AND y = 12').get(),
      UNDEAD_LANDS: db.prepare('SELECT * FROM map_tiles WHERE x = 26 AND y = 21').get(),
      RAVENCRAG_HIGHLANDS: db.prepare('SELECT * FROM map_tiles WHERE x = 32 AND y = 22').get()
    };

    const monsterPoolDistribution = {};
    const rng = createSeededRng(20261001);
    const trials = 1000;

    for (const [regionKey, tile] of Object.entries(regionSampleTiles)) {
      monsterPoolDistribution[regionKey] = {};
      for (const heroLevel of [1, 2, 3, 4]) {
        const counts = {};
        let totalCr = 0;
        let totalHp = 0;
        let totalXp = 0;
        for (let i = 0; i < trials; i++) {
          const picked = regionKey === 'GOBLIN_CAVE'
            ? selectGoblinCaveMonster(db, heroLevel, rng)
            : selectRegionalEncounterMonster(db, tile, heroLevel, rng);
          const m = picked.monster;
          const label = `${m.name} (CR ${m.challenge_rating}, L${m.solo_level}, ${m.base_hp}HP, AC${m.armor_class}, +${m.attack_bonus} ${m.damage_dice}, ${m.xp_reward}XP)`;
          counts[label] = (counts[label] || 0) + 1;
          totalCr += Number(m.challenge_rating || 0);
          totalHp += Number(m.base_hp || 0);
          totalXp += Number(m.xp_reward || 0);
        }
        const breakdown = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([monsterLabel, count]) => ({
            monster: monsterLabel,
            sharePct: Number(((count / trials) * 100).toFixed(1))
          }));
        monsterPoolDistribution[regionKey][`L${heroLevel}`] = {
          meanCr: Number((totalCr / trials).toFixed(2)),
          meanHp: Number((totalHp / trials).toFixed(1)),
          meanXp: Math.round(totalXp / trials),
          breakdown
        };
      }
    }

    simulationReportData.allMonsters = allMonsters;
    simulationReportData.monsterPoolDistribution = monsterPoolDistribution;
  });

  it('3. Monte Carlo Route Step-to-Encounter Simulation (500 runs per route & class)', () => {
    const campIdx = ROUTE_B_WESTERN_WILDERNESS.findIndex(([x, y]) => x === 6 && y === 13);
    const routeBGoblinCave = [
      ...ROUTE_B_WESTERN_WILDERNESS.slice(0, campIdx + 1),
      [7, 13],
      [8, 13],
      [9, 13],
      [9, 12]
    ];

    const routesToSimulate = {
      ROUTE_A_MAIN_TRAIL: ROUTE_A_MAIN_TRAIL,
      ROUTE_B_WESTERN_WILDERNESS: ROUTE_B_WESTERN_WILDERNESS,
      ROUTE_B_GOBLIN_CAVE_SPUR: routeBGoblinCave,
      ROUTE_C_EASTERN_RIVER: ROUTE_C_EASTERN_RIVER,
      ROUTE_D_UNDEAD_SEPULCHER_ROAD: ROUTE_D_UNDEAD_SEPULCHER_ROAD,
      ROUTE_E_RAVENCRAG_HIGHLAND_ROAD: ROUTE_E_RAVENCRAG_HIGHLAND_ROAD
    };

    const classes = [
      { key: 'FIGHTER', class: 'FIGHTER', level: 1, wisdom: 12 },
      { key: 'RANGER', class: 'RANGER', level: 1, wisdom: 14 },
      { key: 'CLERIC', class: 'CLERIC', level: 1, wisdom: 16 }
    ];

    const runs = 500;
    const stepSimResults = {};

    for (const [routeKey, coords] of Object.entries(routesToSimulate)) {
      const tiles = coords.map(([x, y]) => db.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(x, y));
      stepSimResults[routeKey] = { totalSteps: coords.length - 1, byClass: {} };

      for (const hero of classes) {
        const rngPaced = createSeededRng(30000 + routeKey.length * 97 + hero.key.charCodeAt(0));
        const rngRaw = createSeededRng(50000 + routeKey.length * 97 + hero.key.charCodeAt(0));

        // Mode 1: Live Paced Navigation (computeEncounterPacingChance + computePhase8StepEncounterChance + Major Landmark protection)
        const firstEncSteps = [];
        const secondEncSteps = [];
        const thirdEncSteps = [];
        let totalEncountersPaced = 0;
        let totalAmbushesPaced = 0;
        let totalFoiledByRangerPaced = 0;

        for (let r = 0; r < runs; r++) {
          const simCharId = 800000 + r;
          const advState = {
            characterId: simCharId,
            stepCounter: 0,
            recentTileHistory: [`${tiles[0].x},${tiles[0].y}`],
            visitedTiles: [`${tiles[0].x},${tiles[0].y}`],
            stepsSinceLastEncounter: 99,
            postCombatBreathingSteps: 0,
            quietStepsCount: 0,
            encountersFaced: []
          };
          const travelState = { tileMemory: {} };

          const encStepsInRun = [];

          for (let s = 1; s < tiles.length; s++) {
            const fromTile = tiles[s - 1];
            const toTile = tiles[s];
            const toCoord = `${toTile.x},${toTile.y}`;

            const rawPacing = computeEncounterPacingChance(null, simCharId, fromTile, toTile, {
              advState,
              travelState
            });
            const calibratedChance = computePhase8StepEncounterChance(
              null,
              hero,
              fromTile,
              toTile,
              rawPacing.chancePercent
            );

            const decision = computePhase9ThreatDecision(null, hero, fromTile, toTile, {
              forcedChance: calibratedChance,
              rng: rngPaced
            });

            advState.stepCounter += 1;
            advState.stepsSinceLastEncounter += 1;
            if (advState.postCombatBreathingSteps > 0) {
              advState.postCombatBreathingSteps = Math.max(0, advState.postCombatBreathingSteps - 1);
            }
            if (!advState.visitedTiles.includes(toCoord)) {
              advState.visitedTiles.push(toCoord);
            }
            advState.recentTileHistory.push(toCoord);
            if (advState.recentTileHistory.length > 10) advState.recentTileHistory.shift();

            if (decision.outcome === 'ENCOUNTER' || decision.outcome === 'AMBUSH') {
              encStepsInRun.push(s);
              totalEncountersPaced += 1;
              if (decision.outcome === 'AMBUSH') totalAmbushesPaced += 1;
              if (decision.ambushFoiledByRanger) totalFoiledByRangerPaced += 1;

              advState.stepsSinceLastEncounter = 0;
              advState.postCombatBreathingSteps = 1;
              advState.quietStepsCount = 0;
            } else {
              advState.quietStepsCount += 1;
            }
          }

          if (encStepsInRun[0] !== undefined) firstEncSteps.push(encStepsInRun[0]);
          if (encStepsInRun[1] !== undefined) secondEncSteps.push(encStepsInRun[1]);
          if (encStepsInRun[2] !== undefined) thirdEncSteps.push(encStepsInRun[2]);
        }

        // Mode 2: Raw Danger Zone Profile Rate (computePhase9ThreatDecision without adventure-engine scaling)
        const rawFirstEncSteps = [];
        const rawSecondEncSteps = [];
        const rawThirdEncSteps = [];
        let totalEncountersRaw = 0;
        let totalAmbushesRaw = 0;

        for (let r = 0; r < runs; r++) {
          let stepsSinceLastCombat = 99;
          let recentThreatStreak = 0;
          const encStepsInRun = [];

          for (let s = 1; s < tiles.length; s++) {
            const fromTile = tiles[s - 1];
            const toTile = tiles[s];
            if (isMajorLandmarkTile(toTile)) {
              stepsSinceLastCombat += 1;
              continue;
            }
            const decision = computePhase9ThreatDecision(null, hero, fromTile, toTile, {
              stepsSinceLastCombat,
              recentThreatStreak,
              rng: rngRaw
            });

            if (decision.outcome === 'ENCOUNTER' || decision.outcome === 'AMBUSH') {
              encStepsInRun.push(s);
              totalEncountersRaw += 1;
              if (decision.outcome === 'AMBUSH') totalAmbushesRaw += 1;
              stepsSinceLastCombat = 0;
              recentThreatStreak += 1;
            } else {
              stepsSinceLastCombat += 1;
              if (stepsSinceLastCombat >= 3) recentThreatStreak = 0;
            }
          }

          if (encStepsInRun[0] !== undefined) rawFirstEncSteps.push(encStepsInRun[0]);
          if (encStepsInRun[1] !== undefined) rawSecondEncSteps.push(encStepsInRun[1]);
          if (encStepsInRun[2] !== undefined) rawThirdEncSteps.push(encStepsInRun[2]);
        }

        const mean = (arr) => (arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null);
        const median = (arr) => {
          if (arr.length === 0) return null;
          const sorted = [...arr].sort((a, b) => a - b);
          return sorted[Math.floor(sorted.length / 2)];
        };

        stepSimResults[routeKey].byClass[hero.key] = {
          paced: {
            meanStep1stEnc: mean(firstEncSteps),
            medianStep1stEnc: median(firstEncSteps),
            meanStep2ndEnc: mean(secondEncSteps),
            medianStep2ndEnc: median(secondEncSteps),
            meanStep3rdEnc: mean(thirdEncSteps),
            medianStep3rdEnc: median(thirdEncSteps),
            meanTotalEncounters: Number((totalEncountersPaced / runs).toFixed(2)),
            meanAmbushes: Number((totalAmbushesPaced / runs).toFixed(2)),
            ambushShareOfEncountersPct: totalEncountersPaced > 0
              ? Number(((totalAmbushesPaced / totalEncountersPaced) * 100).toFixed(1))
              : 0,
            foiledByRangerPct: totalEncountersPaced > 0
              ? Number(((totalFoiledByRangerPaced / totalEncountersPaced) * 100).toFixed(1))
              : 0
          },
          rawZone: {
            meanStep1stEnc: mean(rawFirstEncSteps),
            meanStep2ndEnc: mean(rawSecondEncSteps),
            meanStep3rdEnc: mean(rawThirdEncSteps),
            meanTotalEncounters: Number((totalEncountersRaw / runs).toFixed(2)),
            meanAmbushes: Number((totalAmbushesRaw / runs).toFixed(2)),
            ambushShareOfEncountersPct: totalEncountersRaw > 0
              ? Number(((totalAmbushesRaw / totalEncountersRaw) * 100).toFixed(1))
              : 0
          }
        };
      }
    }

    simulationReportData.stepSimResults = stepSimResults;
    assert.ok(stepSimResults.ROUTE_A_MAIN_TRAIL.byClass.FIGHTER.paced.meanStep1stEnc >= 2);
  });

  it('4. Monte Carlo Combat Survival Simulation: Fighter, Ranger, Cleric × Levels 1–4 × 7 Zones & 4 Bosses', () => {
    const userRow = db.prepare('SELECT id FROM users LIMIT 1').get();
    const userId = userRow ? userRow.id : 1;

    function spawnSimulatedHero(heroClass, targetLevel) {
      db.prepare('UPDATE characters SET is_alive = 0 WHERE user_id = ?').run(userId);
      const created = createCharacter(db, {
        userId,
        name: `Sim${heroClass}L${targetLevel}`,
        classType: heroClass,
        useClassDefaults: true,
        favoredEnemyFamily: heroClass === 'RANGER' ? 'GOBLINOIDS' : null,
        favoredEnemyType: heroClass === 'RANGER' ? 'GOBLINOIDS' : null,
        primaryWeapon: heroClass === 'RANGER' ? 'RANGED' : 'MELEE'
      });

      const charId = created.id;
      for (let lvl = 2; lvl <= targetLevel; lvl++) {
        const threshold = FAST_XP_TABLE[lvl];
        applyCharacterLevelUp(db, charId, threshold);
        const cur = db.prepare('SELECT attribute_points FROM characters WHERE id = ?').get(charId);
        if (cur && Number(cur.attribute_points) > 0) {
          const abilityChoice = heroClass === 'FIGHTER' ? 'STR' : (heroClass === 'RANGER' ? 'DEX' : 'WIS');
          spendAttributePoint(db, charId, abilityChoice);
        }
      }
      return db.prepare('SELECT * FROM characters WHERE id = ?').get(charId);
    }

    // Record exact Hero stat blocks at Levels 1-4 for the report
    const heroStatTable = {};
    for (const heroClass of ['FIGHTER', 'RANGER', 'CLERIC']) {
      heroStatTable[heroClass] = {};
      for (const lvl of [1, 2, 3, 4]) {
        const h = spawnSimulatedHero(heroClass, lvl);
        const eq = getCharacterEquipment(db, h.id);
        const ac = calculateHeroAC(h, eq);
        const atk = calculateHeroAttackBonus(h, eq);
        const dmgFormula = getHeroDamageFormula(h, eq);
        const maxDivine = heroClass === 'CLERIC'
          ? calculateMaxDivineCharges(lvl, 'CLERIC', getModifier(h.wisdom))
          : 0;
        heroStatTable[heroClass][`L${lvl}`] = {
          level: h.level,
          maxHp: h.max_hp,
          ac,
          attackBonus: atk,
          damageFormula: dmgFormula,
          str: h.strength,
          dex: h.dexterity,
          con: h.constitution,
          wis: h.wisdom,
          divineChargesMax: maxDivine
        };
      }
    }
    simulationReportData.heroStatTable = heroStatTable;

    const combatZones = [
      { key: 'GOBLIN_FOREST_ROAD', label: 'Goblin Forest Road [15,24]', x: 15, y: 24, mode: 'OVERWORLD' },
      { key: 'GOBLIN_HUNTING_GROUNDS', label: 'Goblin Hunting Grounds [19,13]', x: 19, y: 13, mode: 'OVERWORLD' },
      { key: 'GOBLIN_CAVE', label: 'The Goblin Cave [9,12]', x: 9, y: 12, mode: 'GOBLIN_CAVE' },
      { key: 'UNDEAD_BARROW_ROAD', label: 'Undead Barrow Road [26,21]', x: 26, y: 21, mode: 'OVERWORLD' },
      { key: 'CRYPT_SEPULCHER_APPROACH', label: 'Crypt Sepulcher Approach [26,7]', x: 26, y: 7, mode: 'OVERWORLD' },
      { key: 'HIGHLAND_FOOTHILL_ROAD', label: 'Highland Foothill Road [32,22]', x: 32, y: 22, mode: 'OVERWORLD' },
      { key: 'STORMPEAK_CITADEL_APPROACH', label: 'Stormpeak Citadel Approach [37,6]', x: 37, y: 6, mode: 'OVERWORLD' }
    ];

    const trialsPerCell = 80;
    const combatSimMatrix = {};

    function clearCombatTablesForTile(tileId) {
      db.prepare('DELETE FROM combat_events').run();
      db.prepare('UPDATE characters SET killed_by_monster_instance_id = NULL').run();
      db.prepare('DELETE FROM encounters').run();
      db.prepare("DELETE FROM item_instances WHERE owner_type = 'MONSTER'").run();
      if (tileId) {
        db.prepare('DELETE FROM monster_instances WHERE tile_id = ?').run(tileId);
      }
      db.prepare("DELETE FROM item_instances WHERE owner_type = 'CHARACTER' AND owner_character_id IN (SELECT id FROM characters WHERE is_alive = 0)").run();
      try { db.prepare('DELETE FROM character_discovered_tiles WHERE character_id IN (SELECT id FROM characters WHERE is_alive = 0)').run(); } catch {}
      try { db.prepare('DELETE FROM character_quests WHERE character_id IN (SELECT id FROM characters WHERE is_alive = 0)').run(); } catch {}
      try { db.prepare('DELETE FROM character_monster_kills WHERE character_id IN (SELECT id FROM characters WHERE is_alive = 0)').run(); } catch {}
      db.prepare('DELETE FROM characters WHERE is_alive = 0').run();
    }

    for (const zoneSpec of combatZones) {
      combatSimMatrix[zoneSpec.key] = { label: zoneSpec.label, byLevel: {} };
      const tile = db.prepare('SELECT * FROM map_tiles WHERE x = ? AND y = ?').get(zoneSpec.x, zoneSpec.y);
      clearCombatTablesForTile(tile.id);

      for (const lvl of [1, 2, 3, 4]) {
        combatSimMatrix[zoneSpec.key].byLevel[`L${lvl}`] = {};

        for (const heroClass of ['FIGHTER', 'RANGER', 'CLERIC']) {
          clearCombatTablesForTile(tile.id);
          const rng = createSeededRng(700000 + zoneSpec.key.length * 313 + lvl * 101 + heroClass.charCodeAt(0));
          let heroTemplate = spawnSimulatedHero(heroClass, lvl);
          const maxDivine = heroClass === 'CLERIC'
            ? calculateMaxDivineCharges(lvl, 'CLERIC', getModifier(heroTemplate.wisdom))
            : 0;

          let wins = 0;
          let flees = 0;
          let deaths = 0;
          let totalAmbushes = 0;
          let ambushDeaths = 0;
          let spottedCount = 0;
          let spottedDeaths = 0;
          let totalRounds = 0;
          let totalWinHpPct = 0;
          let totalWinXp = 0;

          for (let t = 0; t < trialsPerCell; t++) {
            db.prepare(`
              UPDATE characters
              SET level = ?, xp = ?, max_hp = ?, current_hp = ?,
                  tile_id = ?, divine_charges = ?, killed_by_monster_instance_id = NULL
              WHERE id = ?
            `).run(
              heroTemplate.level,
              FAST_XP_TABLE[lvl],
              heroTemplate.max_hp,
              heroTemplate.max_hp,
              tile.id,
              maxDivine,
              heroTemplate.id
            );
            clearCombatTablesForTile(tile.id);

            const picked = zoneSpec.mode === 'GOBLIN_CAVE'
              ? selectGoblinCaveMonster(db, lvl, rng)
              : selectRegionalEncounterMonster(db, tile, lvl, rng);
            const monster = picked.monster;

            const threatDecision = computePhase9ThreatDecision(null, heroTemplate, null, tile, {
              forcedChance: 100,
              monster,
              rng
            });
            const isAmbush = threatDecision.outcome === 'AMBUSH';
            if (isAmbush) totalAmbushes += 1;
            else spottedCount += 1;

            const stateMetaJson = JSON.stringify({
              travelOutcome: isAmbush ? 'AMBUSH' : 'ENCOUNTER',
              dangerZoneKey: threatDecision.zone.zoneKey,
              dangerZoneName: threatDecision.zone.zoneName,
              dangerLevel: threatDecision.zone.dangerLevel,
              allowLevel1Ambush: true
            });

            const ins = db.prepare(`
              INSERT INTO encounters (
                character_id, tile_id, monster_id, status,
                current_monster_hp, monster_max_hp, combat_round,
                spotted_by_hero, is_ambush, opening_shot_resolved, combat_state_json
              ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, ?, ?, 0, ?)
            `).run(
              heroTemplate.id,
              tile.id,
              monster.id,
              monster.base_hp,
              monster.base_hp,
              isAmbush ? 0 : 1,
              isAmbush ? 1 : 0,
              stateMetaJson
            );
            const encId = Number(ins.lastInsertRowid);

            if (isAmbush) {
              startCombat(db, heroTemplate.id, encId, { rng });
            } else {
              investigateEncounter(db, heroTemplate.id, encId, heroClass, { rng });
            }

            let encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
            let charRow = db.prepare('SELECT * FROM characters WHERE id = ?').get(heroTemplate.id);

            let roundSafety = 0;
            while (encRow.status === 'IN_COMBAT' && charRow.is_alive === 1 && roundSafety < 40) {
              roundSafety += 1;
              let combatMeta = {};
              try { combatMeta = JSON.parse(encRow.combat_state_json || '{}'); } catch {}
              const fleeLocked = Number(encRow.is_ambush) === 1 && Number(encRow.combat_round || 1) <= 2;

              const fleeThreshold = Math.max(4, Math.floor(charRow.max_hp * 0.28));
              let chosenAction = 'ATTACK';
              if (!fleeLocked && charRow.current_hp <= fleeThreshold && encRow.current_monster_hp > 3) {
                chosenAction = 'FLEE';
              } else if (heroClass === 'CLERIC' && Number(charRow.divine_charges || 0) > 0) {
                const shieldActive = Number(combatMeta.divineShieldTurns || combatMeta.divineShieldRounds || 0) > 0;
                const prayerActive = Boolean(combatMeta.battlePrayerUsed || combatMeta.battlePrayerActive);
                if (!shieldActive && charRow.current_hp <= Math.floor(charRow.max_hp * 0.55) && Number(charRow.divine_charges || 0) >= 2) {
                  chosenAction = 'DIVINE_SHIELD';
                } else if (encRow.combat_round === 1 && !prayerActive && monster.base_hp >= 12) {
                  chosenAction = 'BATTLE_PRAYER';
                } else {
                  chosenAction = 'SMITE';
                }
              }

              executeCombatRound(db, heroTemplate.id, encId, chosenAction, {
                expectedRound: encRow.combat_round,
                rng
              });

              encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
              charRow = db.prepare('SELECT * FROM characters WHERE id = ?').get(heroTemplate.id);
            }

            totalRounds += Math.max(1, Number(encRow.combat_round || 1));

            if (charRow.is_alive === 0 || encRow.status === 'DEFEAT') {
              deaths += 1;
              if (isAmbush) ambushDeaths += 1;
              else spottedDeaths += 1;
              clearCombatTablesForTile(tile.id);
              heroTemplate = spawnSimulatedHero(heroClass, lvl);
            } else if (encRow.status === 'ESCAPED') {
              flees += 1;
            } else if (encRow.status === 'VICTORY') {
              wins += 1;
              totalWinHpPct += (charRow.current_hp / charRow.max_hp) * 100;
              totalWinXp += Math.max(0, charRow.xp - FAST_XP_TABLE[lvl]);
            }
          }

          combatSimMatrix[zoneSpec.key].byLevel[`L${lvl}`][heroClass] = {
            winRatePct: Number(((wins / trialsPerCell) * 100).toFixed(1)),
            fleeRatePct: Number(((flees / trialsPerCell) * 100).toFixed(1)),
            deathRatePct: Number(((deaths / trialsPerCell) * 100).toFixed(1)),
            ambushRatePct: Number(((totalAmbushes / trialsPerCell) * 100).toFixed(1)),
            ambushDeathRatePct: totalAmbushes > 0 ? Number(((ambushDeaths / totalAmbushes) * 100).toFixed(1)) : 0,
            spottedDeathRatePct: spottedCount > 0 ? Number(((spottedDeaths / spottedCount) * 100).toFixed(1)) : 0,
            meanRounds: Number((totalRounds / trialsPerCell).toFixed(1)),
            meanHpRemainingOnWinPct: wins > 0 ? Number((totalWinHpPct / wins).toFixed(1)) : 0,
            meanXpPerWin: wins > 0 ? Math.round(totalWinXp / wins) : 0
          };
        }
      }
    }

    // Simulate Boss Readiness (60 trials per boss / level / class, fighting to victory or death)
    const bossSpecs = [
      { key: 'WARCHIEF_GRAK', title: STRONGHOLD_BOSS_PROFILE.customTitle, baseName: STRONGHOLD_BOSS_PROFILE.preferredMonsterName || 'Hobgoblin', maxHp: STRONGHOLD_BOSS_PROFILE.maxHp },
      { key: 'SKULKRIP_BROOD_KING', title: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.customTitle, baseName: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.baseMonsterName || 'Bugbear', maxHp: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE.maxHp },
      { key: 'MALAKOR_BARROW_KING', title: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.customTitle, baseName: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.baseMonsterName || 'Wight', fallbackName: 'Wight', maxHp: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT.maxHp },
      { key: 'WARLORD_KRAUG', title: HIGHLAND_BOSS_PROFILE.customTitle, baseName: HIGHLAND_BOSS_PROFILE.preferredMonsterName || 'Ogre', maxHp: HIGHLAND_BOSS_PROFILE.maxHp }
    ];
    const bossReadinessMatrix = {};
    const bossTrials = 60;
    const bossArenaTile = db.prepare('SELECT * FROM map_tiles WHERE x = 15 AND y = 25').get();

    for (const bSpec of bossSpecs) {
      const baseMonster =
        db.prepare('SELECT * FROM monsters WHERE LOWER(name) = LOWER(?) LIMIT 1').get(bSpec.baseName) ||
        db.prepare('SELECT * FROM monsters WHERE LOWER(name) = LOWER(?) LIMIT 1').get(bSpec.fallbackName || 'Hobgoblin') ||
        db.prepare('SELECT * FROM monsters ORDER BY challenge_rating DESC LIMIT 1').get();
      bossReadinessMatrix[bSpec.key] = {
        title: bSpec.title,
        baseMonster: baseMonster.name,
        bossHp: bSpec.maxHp,
        ac: baseMonster.armor_class,
        attackBonus: baseMonster.attack_bonus,
        damageDice: baseMonster.damage_dice,
        byLevel: {}
      };

      for (const lvl of [1, 2, 3, 4]) {
        bossReadinessMatrix[bSpec.key].byLevel[`L${lvl}`] = {};
        for (const heroClass of ['FIGHTER', 'RANGER', 'CLERIC']) {
          clearCombatTablesForTile(bossArenaTile.id);
          const rng = createSeededRng(900000 + bSpec.key.length * 199 + lvl * 73 + heroClass.charCodeAt(0));
          let heroTemplate = spawnSimulatedHero(heroClass, lvl);
          const maxDivine = heroClass === 'CLERIC'
            ? calculateMaxDivineCharges(lvl, 'CLERIC', getModifier(heroTemplate.wisdom))
            : 0;
          let wins = 0;
          let deaths = 0;

          for (let t = 0; t < bossTrials; t++) {
            db.prepare(`
              UPDATE characters
              SET level = ?, xp = ?, max_hp = ?, current_hp = ?,
                  tile_id = ?, divine_charges = ?, killed_by_monster_instance_id = NULL
              WHERE id = ?
            `).run(
              heroTemplate.level,
              FAST_XP_TABLE[lvl],
              heroTemplate.max_hp,
              heroTemplate.max_hp,
              bossArenaTile.id,
              maxDivine,
              heroTemplate.id
            );
            clearCombatTablesForTile(bossArenaTile.id);

            const ins = db.prepare(`
              INSERT INTO encounters (
                character_id, tile_id, monster_id, status,
                current_monster_hp, monster_max_hp, combat_round,
                spotted_by_hero, is_ambush, opening_shot_resolved
              ) VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, 1, 0, 0)
            `).run(heroTemplate.id, bossArenaTile.id, baseMonster.id, bSpec.maxHp, bSpec.maxHp);
            const encId = Number(ins.lastInsertRowid);

            investigateEncounter(db, heroTemplate.id, encId, heroClass, { rng });

            let encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
            let charRow = db.prepare('SELECT * FROM characters WHERE id = ?').get(heroTemplate.id);
            let roundSafety = 0;
            while (encRow.status === 'IN_COMBAT' && charRow.is_alive === 1 && roundSafety < 40) {
              roundSafety += 1;
              let combatMeta = {};
              try { combatMeta = JSON.parse(encRow.combat_state_json || '{}'); } catch {}
              let chosenAction = 'ATTACK';
              if (heroClass === 'CLERIC' && Number(charRow.divine_charges || 0) > 0) {
                const shieldActive = Number(combatMeta.divineShieldTurns || combatMeta.divineShieldRounds || 0) > 0;
                const prayerActive = Boolean(combatMeta.battlePrayerUsed || combatMeta.battlePrayerActive);
                if (!shieldActive && charRow.current_hp <= Math.floor(charRow.max_hp * 0.55) && Number(charRow.divine_charges || 0) >= 2) {
                  chosenAction = 'DIVINE_SHIELD';
                } else if (encRow.combat_round === 1 && !prayerActive) {
                  chosenAction = 'BATTLE_PRAYER';
                } else {
                  chosenAction = 'SMITE';
                }
              }
              executeCombatRound(db, heroTemplate.id, encId, chosenAction, {
                expectedRound: encRow.combat_round,
                rng
              });
              encRow = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encId);
              charRow = db.prepare('SELECT * FROM characters WHERE id = ?').get(heroTemplate.id);
            }
            if (charRow.is_alive === 0 || encRow.status === 'DEFEAT') {
              deaths += 1;
              clearCombatTablesForTile(bossArenaTile.id);
              heroTemplate = spawnSimulatedHero(heroClass, lvl);
            } else if (encRow.status === 'VICTORY') {
              wins += 1;
            }
          }
          bossReadinessMatrix[bSpec.key].byLevel[`L${lvl}`][heroClass] = {
            winRatePct: Number(((wins / bossTrials) * 100).toFixed(1)),
            deathRatePct: Number(((deaths / bossTrials) * 100).toFixed(1))
          };
        }
      }
    }

    simulationReportData.combatSimMatrix = combatSimMatrix;
    simulationReportData.bossReadinessMatrix = bossReadinessMatrix;
    assert.ok(combatSimMatrix.GOBLIN_FOREST_ROAD.byLevel.L1.FIGHTER.winRatePct > 50);
  });

  it('5. Progression Curve (FAST_XP_TABLE vs Medium), Quests, Boss Readiness & Bounties (Level 1–4)', () => {
    const mediumXpTable = { 1: 0, 2: 2000, 3: 5000, 4: 9000, 5: 15000 };
    const xpComparison = {};
    const meanXpByRegion = {
      GOBLIN_FOREST_L1: simulationReportData.monsterPoolDistribution.GOBLIN_FOREST.L1.meanXp,
      GOBLIN_FOREST_L2: simulationReportData.monsterPoolDistribution.GOBLIN_FOREST.L2.meanXp,
      UNDEAD_LANDS_L2: simulationReportData.monsterPoolDistribution.UNDEAD_LANDS.L2.meanXp,
      UNDEAD_LANDS_L3: simulationReportData.monsterPoolDistribution.UNDEAD_LANDS.L3.meanXp,
      HIGHLANDS_L3: simulationReportData.monsterPoolDistribution.RAVENCRAG_HIGHLANDS.L3.meanXp,
      HIGHLANDS_L4: simulationReportData.monsterPoolDistribution.RAVENCRAG_HIGHLANDS.L4.meanXp
    };

    for (const targetLvl of [2, 3, 4, 5]) {
      const prevLvl = targetLvl - 1;
      const fastDelta = FAST_XP_TABLE[targetLvl] - FAST_XP_TABLE[prevLvl];
      const fastCumulative = FAST_XP_TABLE[targetLvl];
      const medDelta = mediumXpTable[targetLvl] - mediumXpTable[prevLvl];
      const medCumulative = mediumXpTable[targetLvl];

      const refXp = targetLvl === 2
        ? meanXpByRegion.GOBLIN_FOREST_L1
        : targetLvl === 3
          ? meanXpByRegion.GOBLIN_FOREST_L2
          : meanXpByRegion.UNDEAD_LANDS_L3;

      xpComparison[`L${prevLvl}_to_L${targetLvl}`] = {
        fastDeltaXp: fastDelta,
        fastCumulativeXp: fastCumulative,
        mediumDeltaXp: medDelta,
        mediumCumulativeXp: medCumulative,
        avgMonsterXpAtTier: refXp,
        estFightsFast: Number((fastDelta / refXp).toFixed(1)),
        estFightsMedium: Number((medDelta / refXp).toFixed(1))
      };
    }

    // Verify open-ended level scaling (no hardcoded max level cap at Level 4)
    assert.equal(getLevelForXp(0), 1);
    assert.equal(getLevelForXp(1300), 2);
    assert.equal(getLevelForXp(3300), 3);
    assert.equal(getLevelForXp(6000), 4);
    assert.equal(getLevelForXp(10000), 5);
    assert.equal(getLevelForXp(71000), 10);

    // Check Watcher's Board Bounties at Level 1-4 on the 44x30 Phase 9C world
    const reachableRegions = getReachableWildernessRegions(db);
    const bountyAnalysisByLevel = {};
    const userRow = db.prepare('SELECT id FROM users LIMIT 1').get();
    const userId = userRow ? userRow.id : 1;

    for (const lvl of [1, 2, 3, 4]) {
      db.prepare('UPDATE characters SET is_alive = 0 WHERE user_id = ?').run(userId);
      const c = createCharacter(db, {
        userId,
        name: `BountyHeroL${lvl}`,
        classType: 'FIGHTER',
        useClassDefaults: true
      });
      applyCharacterLevelUp(db, c.id, FAST_XP_TABLE[lvl]);
      const updatedChar = db.prepare('SELECT * FROM characters WHERE id = ?').get(c.id);
      const contracts = getOrGenerateContracts(db, updatedChar);
      bountyAnalysisByLevel[`L${lvl}`] = contracts.map((ct) => ({
        title: ct.title,
        customName: ct.custom_name,
        baseMonster: ct.base_monster_name,
        cr: ct.challenge_rating,
        region: ct.region_name,
        boost: ct.boost_label,
        boostedHp: ct.boosted_max_hp,
        rewardGold: ct.reward_gold
      }));
    }

    simulationReportData.xpComparison = xpComparison;
    simulationReportData.questDefinitions = QUEST_DEFINITIONS;
    simulationReportData.bossProfiles = {
      STRONGHOLD_BOSS: STRONGHOLD_BOSS_PROFILE,
      GOBLIN_CAVE_BOSS: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE,
      ANCIENT_CRYPT_BOSS: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT,
      HIGHLAND_BOSS: HIGHLAND_BOSS_PROFILE
    };
    simulationReportData.bountyReachableRegionsCount = reachableRegions.length;
    simulationReportData.bountyNearestRegions = reachableRegions.slice(0, 8);
    simulationReportData.bountyAnalysisByLevel = bountyAnalysisByLevel;

    console.log('=== PHASE 10 AGENT C SIMULATION SUMMARY ===');
    console.log(JSON.stringify(simulationReportData, null, 2));
  });
});
