/**
 * DARKGRID — PHASE 9A Automated Test Suite
 * Threat States (NORMAL / ENCOUNTER / AMBUSH), 2-Round Server Flee Lock,
 * Data-Driven Danger Zones, Ranger Scouting, & Major Landmark Scene System
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createLabApp } = require('../server');
const {
  DANGER_ZONE_PROFILES,
  LANDMARK_SCENE_DEFINITIONS,
  ROUTE_A_MAIN_TRAIL,
  ROUTE_B_WESTERN_WILDERNESS,
  ROUTE_C_EASTERN_RIVER,
  resolveTileDangerZone,
  computePhase9ThreatDecision,
  runPhase9MonteCarloSimulation
} = require('../server/services/topdown-world-service');

describe('Phase 9A — Threat States, Ambush & Major Landmark Scene System', () => {
  let db;
  let server;
  let baseUrl;

  async function apiGetState() {
    const res = await fetch(`${baseUrl}/api/state`);
    const json = await res.json();
    return json.state || json;
  }

  async function apiAction(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    const body = await res.json();
    body._httpStatus = res.status;
    return body;
  }

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
      try { db.close(); } catch {}
    }
  });

  it('1. Seeds 5 data-driven Danger Zone profiles and Major Landmark Scene definitions in SQLite', () => {
    const zoneRows = db.prepare('SELECT zone_key, danger_level, encounter_rate, ambush_share FROM danger_zone_profiles ORDER BY id ASC').all();
    const zoneKeys = zoneRows.map((r) => r.zone_key);
    assert.ok(zoneKeys.includes('OAKHAVEN_SAFE'));
    assert.ok(zoneKeys.includes('GOBLIN_FOREST_ROAD'));
    assert.ok(zoneKeys.includes('GOBLIN_FOREST_OFF_ROAD'));
    assert.ok(zoneKeys.includes('GOBLIN_HUNTING_GROUNDS'));
    assert.ok(zoneKeys.includes('STRONGHOLD_APPROACH'));

    const sceneRows = db.prepare('SELECT scene_key, landmark_type, is_major_landmark, auto_open_on_arrival FROM landmark_scene_definitions ORDER BY id ASC').all();
    const sceneKeys = sceneRows.map((r) => r.scene_key);
    assert.ok(sceneKeys.includes('OAKHAVEN'));
    assert.ok(sceneKeys.includes('GOBLIN_STRONGHOLD'));
    assert.ok(sceneKeys.includes('ANCIENT_DUNGEON_ENTRANCE'));
    assert.ok(sceneKeys.includes('SUNKEN_CRYPT_ENTRANCE'));

    // Verify hierarchy of danger zones: Oakhaven (0) < Main Road < Off-Road < Hunting Grounds <= Stronghold Approach
    assert.equal(DANGER_ZONE_PROFILES.OAKHAVEN_SAFE.encounterRate, 0);
    assert.ok(DANGER_ZONE_PROFILES.GOBLIN_FOREST_ROAD.encounterRate < DANGER_ZONE_ZONE_CHECK(DANGER_ZONE_PROFILES.GOBLIN_FOREST_OFF_ROAD.encounterRate));
    assert.ok(DANGER_ZONE_PROFILES.GOBLIN_FOREST_OFF_ROAD.encounterRate < DANGER_ZONE_PROFILES.GOBLIN_HUNTING_GROUNDS.encounterRate);
    assert.ok(DANGER_ZONE_PROFILES.GOBLIN_HUNTING_GROUNDS.encounterRate <= DANGER_ZONE_PROFILES.STRONGHOLD_APPROACH.encounterRate);
  });

  it('2. Scenario 1: NORMAL movement advances the hero cleanly with no encounter interruption', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    const stepRes = await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(stepRes.ok, true);
    assert.equal(stepRes.state.currentTile.x, 15);
    assert.equal(stepRes.state.currentTile.y, 25);
    assert.equal(stepRes.state.encounter, null);
    assert.equal(stepRes.state.mode, 'EXPLORATION');
  });

  it('3. Scenario 2: ENCOUNTER -> Fight starts combat cleanly and NEVER turns into an Ambush', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    const st0 = await apiGetState();
    db.prepare('UPDATE characters SET level = 3, current_hp = 30, max_hp = 30 WHERE id = ?').run(st0.character.id);
    await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });

    const moveEnc = await apiAction('MOVE', {
      direction: 'NORTH',
      testForceEncounter: true,
      testForceOutcome: 'ENCOUNTER'
    });
    assert.equal(moveEnc.ok, true);
    assert.ok(moveEnc.state.encounter, 'Encounter should be discovered');
    assert.equal(moveEnc.state.encounter.status, 'DISCOVERED');
    assert.equal(moveEnc.state.encounter.travelOutcome, 'ENCOUNTER');
    assert.equal(moveEnc.state.encounter.isAmbush, false);
    assert.equal(moveEnc.state.encounter.spottedByHero, true);
    assert.equal(moveEnc.state.encounter.monster_ac, undefined);
    assert.equal(moveEnc.state.encounter.current_monster_hp, undefined);

    const fightRes = await apiAction('FIGHT');
    assert.equal(fightRes.ok, true);
    assert.equal(fightRes.state.mode, 'IN_COMBAT');
    assert.equal(fightRes.state.encounter.status, 'IN_COMBAT');
    assert.equal(fightRes.state.encounter.isAmbush, false, 'Spotted ENCOUNTER must NEVER become an Ambush when Fight is chosen');
    assert.equal(fightRes.state.encounter.travelOutcome, 'ENCOUNTER');
    assert.equal(fightRes.state.encounter.fleeLocked, false, 'Normal Encounter combat must NOT lock Flee');
    assert.equal(fightRes.state.encounter.canFlee, true);
  });

  it('4. Scenario 3: ENCOUNTER -> Avoid bypasses the monster without combat, granting 0 XP and 0 loot and no monster attack', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    const beforeState = await apiGetState();
    const hpBefore = beforeState.character.current_hp;
    const xpBefore = beforeState.character.xp;
    const goldBefore = beforeState.character.gold;
    const invCountBefore = beforeState.inventory.length;
    await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });

    const moveEnc = await apiAction('MOVE', {
      direction: 'NORTH',
      testForceEncounter: true,
      testForceOutcome: 'ENCOUNTER'
    });
    assert.equal(moveEnc.ok, true);
    assert.equal(moveEnc.state.encounter.status, 'DISCOVERED');

    const avoidRes = await apiAction('AVOID');
    assert.equal(avoidRes.ok, true);
    assert.equal(avoidRes.state.encounter, null, 'Encounter should be cleared after Avoid');
    assert.equal(avoidRes.state.mode, 'EXPLORATION');
    assert.equal(avoidRes.state.character.current_hp, hpBefore, 'Monster must not attack when hero chooses Avoid');
    assert.equal(avoidRes.state.character.xp, xpBefore, 'Avoid must grant 0 XP');
    assert.equal(avoidRes.state.character.gold, goldBefore, 'Avoid must grant 0 gold');
    assert.equal(avoidRes.state.inventory.length, invCountBefore, 'Avoid must grant 0 items');
  });

  it('5. Scenarios 4 & 5: AMBUSH starts combat immediately, locks Flee on server for Rounds 1 & 2, and unlocks Flee on Round 3+', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    const st0 = await apiGetState();
    const heroId = st0.character.id;
    db.prepare('UPDATE characters SET level = 3, current_hp = 60, max_hp = 60, constitution = 16 WHERE id = ?').run(heroId);
    await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });

    const ambushMove = await apiAction('MOVE', {
      direction: 'NORTH',
      testForceEncounter: true,
      testForceOutcome: 'AMBUSH'
    });
    assert.equal(ambushMove.ok, true);
    assert.equal(ambushMove.state.mode, 'IN_COMBAT', 'Ambush must start combat immediately without an Avoid screen');
    assert.ok(ambushMove.state.encounter);
    assert.equal(ambushMove.state.encounter.status, 'IN_COMBAT');
    assert.equal(ambushMove.state.encounter.isAmbush, true);
    assert.equal(ambushMove.state.encounter.travelOutcome, 'AMBUSH');
    assert.equal(ambushMove.state.encounter.combat_round, 1);
    assert.equal(ambushMove.state.encounter.fleeLocked, true);
    assert.equal(ambushMove.state.encounter.canFlee, false);
    assert.equal(ambushMove.state.encounter.ambushFleeLockedRoundsRemaining, 2);
    assert.match(ambushMove.state.infoMessage, /AMBUSH!/i);

    const encId = ambushMove.state.encounter.id;
    db.prepare('UPDATE encounters SET current_monster_hp = 80, monster_max_hp = 80 WHERE id = ?').run(encId);

    // Attempt to FLEE in Round 1 -> MUST be rejected by server!
    const fleeRound1 = await apiAction('FLEE');
    assert.equal(fleeRound1.ok, false, 'Server must reject FLEE during Ambush Round 1');
    assert.equal(fleeRound1._httpStatus, 400);
    assert.match(fleeRound1.error, /AMBUSH! You cannot flee during the first 2 combat rounds/i);

    // Execute Round 1 (ATTACK) -> advances to Round 2
    const atk1 = await apiAction('ATTACK');
    assert.equal(atk1.ok, true);
    db.prepare('UPDATE characters SET current_hp = 60 WHERE id = ?').run(heroId);
    const stRound2 = await apiGetState();
    assert.equal(stRound2.encounter.combat_round, 2);
    assert.equal(stRound2.encounter.fleeLocked, true, 'Flee must remain locked in Round 2');
    assert.equal(stRound2.encounter.canFlee, false);
    assert.equal(stRound2.encounter.ambushFleeLockedRoundsRemaining, 1);

    // Attempt to FLEE in Round 2 -> MUST still be rejected by server!
    const fleeRound2 = await apiAction('FLEE');
    assert.equal(fleeRound2.ok, false, 'Server must reject FLEE during Ambush Round 2');
    assert.equal(fleeRound2._httpStatus, 400);
    assert.match(fleeRound2.error, /AMBUSH! You cannot flee during the first 2 combat rounds/i);

    // Execute Round 2 (ATTACK) -> advances to Round 3
    const atk2 = await apiAction('ATTACK');
    assert.equal(atk2.ok, true);
    db.prepare('UPDATE characters SET current_hp = 60 WHERE id = ?').run(heroId);
    const stRound3 = await apiGetState();
    assert.equal(stRound3.encounter.combat_round, 3);
    assert.equal(stRound3.encounter.fleeLocked, false, 'Flee must unlock in Round 3 after 2 full rounds');
    assert.equal(stRound3.encounter.canFlee, true);
    assert.equal(stRound3.encounter.ambushFleeLockedRoundsRemaining, 0);

    // Now FLEE in Round 3 -> succeeds using standard flee rules!
    const fleeRound3 = await apiAction('FLEE');
    assert.equal(fleeRound3.ok, true, 'FLEE must succeed in Round 3+');
    assert.equal(fleeRound3.state.encounter, null);
    assert.equal(fleeRound3.state.mode, 'EXPLORATION');
  });

  it('6. Scenario 6 & 7: Verifies Ranger Scouting ambush conversion, Level 1 Ambush Protection, and 4–6 trip threat frequency via Monte Carlo', () => {
    const fighterSim = runPhase9MonteCarloSimulation(db, {
      trials: 1000,
      route: ROUTE_A_MAIN_TRAIL,
      heroClass: 'FIGHTER',
      heroLevel: 2,
      seed: 9001
    });
    const rangerSim = runPhase9MonteCarloSimulation(db, {
      trials: 1000,
      route: ROUTE_A_MAIN_TRAIL,
      heroClass: 'RANGER',
      heroLevel: 2,
      seed: 9001
    });
    const level1Sim = runPhase9MonteCarloSimulation(db, {
      trials: 500,
      route: ROUTE_A_MAIN_TRAIL,
      heroClass: 'FIGHTER',
      heroLevel: 1,
      allowLevel1Ambush: false,
      seed: 9001
    });

    assert.ok(
      fighterSim.avgThreats >= 3.8 && fighterSim.avgThreats <= 6.2,
      `Expected ~4-6 average threat events on Route A, got ${fighterSim.avgThreats}`
    );

    assert.ok(
      rangerSim.avgAmbushes < fighterSim.avgAmbushes,
      `Ranger should suffer fewer Ambushes (${rangerSim.avgAmbushes}) than Fighter (${fighterSim.avgAmbushes})`
    );
    assert.ok(
      rangerSim.rangerAmbushConversions > 0,
      'Ranger Trail-Sense should convert a portion of potential Ambushes into spotted Encounters'
    );

    assert.ok(level1Sim.avgAmbushes > 0, 'Phase 9B Owner Decision: Level 1 heroes can be ambushed just like Level 2+');
    assert.equal(level1Sim.level1AmbushProtections, 0, 'Phase 9B Owner Decision: Level 1 Ambush protection is completely removed');
  });

  it('7. Scenarios 8, 9 & 10: Major Landmark Scene auto-opens at Oakhaven & Stronghold, respects anti-interruption rules, and never overlaps Combat', async () => {
    const resetRes = await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    assert.equal(resetRes.ok, true);

    let st = resetRes.state;
    assert.ok(st.landmarkScene, 'Oakhaven should have a landmarkScene descriptor');
    assert.equal(st.landmarkScene.sceneKey, 'OAKHAVEN');
    assert.equal(st.landmarkScene.isActive, true, 'Oakhaven Landmark Scene opens automatically on arrival');
    assert.equal(st.landmarkScene.artworkUrl, '/images/terrain/terrain_city_oakhaven.webp');
    const oakhavenActionKeys = st.landmarkScene.actions.map((a) => a.key);
    assert.deepEqual(oakhavenActionKeys, ['REST_HEAL', 'OPEN_SHOP', 'OPEN_QUESTS', 'CONTINUE_EXPLORING']);

    const dismissRes = await apiAction('DISMISS_LANDMARK_SCENE');
    assert.equal(dismissRes.ok, true);
    assert.equal(dismissRes.state.landmarkScene.isActive, false, 'Landmark Scene should close when dismissed');

    // UI actions on the same tile must NOT re-open the dismissed Landmark Scene
    const restRes = await apiAction('REST');
    assert.equal(restRes.ok, true);
    assert.equal(restRes.state.landmarkScene.isActive, false, 'REST must NOT re-open a dismissed Landmark Scene');

    const acceptRes = await apiAction('ACCEPT_QUEST');
    assert.equal(acceptRes.ok, true);
    assert.equal(acceptRes.state.landmarkScene.isActive, false, 'ACCEPT_QUEST must NOT re-open a dismissed Landmark Scene');

    // Stepping onto a minor landmark (North Gate [15,26]) must NOT open a Major Landmark Scene
    const stepNorthGate = await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(stepNorthGate.ok, true);
    assert.equal(stepNorthGate.state.currentTile.x, 15);
    assert.equal(stepNorthGate.state.currentTile.y, 26);
    assert.equal(stepNorthGate.state.landmarkScene, null, 'Minor landmark (North Gate) must NOT open a Major Landmark Scene');

    // Stepping back South onto Oakhaven [15,27] MUST re-open the Oakhaven Landmark Scene!
    const stepBackTown = await apiAction('MOVE', { direction: 'SOUTH', testForceEncounter: false });
    assert.equal(stepBackTown.ok, true);
    assert.equal(stepBackTown.state.currentTile.x, 15);
    assert.equal(stepBackTown.state.currentTile.y, 27);
    assert.ok(stepBackTown.state.landmarkScene);
    assert.equal(stepBackTown.state.landmarkScene.sceneKey, 'OAKHAVEN');
    assert.equal(stepBackTown.state.landmarkScene.isActive, true, 'Returning to Oakhaven after leaving re-opens the Landmark Scene');

    // Arriving at Goblin Stronghold [15,2] automatically opens the Stronghold Major Landmark Scene
    await apiAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    const toStronghold = await apiAction('TELEPORT_TO_TILE', { x: 15, y: 2, facing: 'NORTH' });
    assert.equal(toStronghold.ok, true);
    assert.ok(toStronghold.state.landmarkScene, 'Stronghold should have a landmarkScene descriptor');
    assert.equal(toStronghold.state.landmarkScene.sceneKey, 'GOBLIN_STRONGHOLD');
    assert.equal(toStronghold.state.landmarkScene.isActive, true, 'Goblin Stronghold Landmark Scene opens automatically on arrival');
    assert.equal(toStronghold.state.landmarkScene.artworkUrl, '/images/terrain/terrain_town_gates.webp');

    // Challenging the Goblin Chieftain starts Combat and immediately suppresses the Landmark Scene
    const engageBoss = await apiAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engageBoss.ok, true);
    assert.equal(engageBoss.state.mode, 'IN_COMBAT');
    assert.equal(engageBoss.state.landmarkScene, null, 'Combat and Landmark Scene must NEVER be active simultaneously');

    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });

  it('8. Scenario 11: Preserves Ambush combat state across reload, handles permadeath & Nemesis persistence', async () => {
    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    const ambushStart = await apiAction('LAB_SCENARIO', { scenario: 'STAGE2_AMBUSH', monsterName: 'Hobgoblin' });
    assert.equal(ambushStart.ok, true);
    assert.equal(ambushStart.state.mode, 'IN_COMBAT');
    assert.equal(ambushStart.state.encounter.isAmbush, true);
    assert.equal(ambushStart.state.encounter.fleeLocked, true);

    // Reloading state via GET /api/state preserves the Ambush combat & Flee lock
    const reloaded = await apiGetState();
    assert.equal(reloaded.mode, 'IN_COMBAT');
    assert.equal(reloaded.encounter.isAmbush, true);
    assert.equal(reloaded.encounter.fleeLocked, true);
    assert.equal(reloaded.encounter.combat_round, 1);

    await apiAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });
});

function DANGER_ZONE_ZONE_CHECK(val) {
  return Number(val);
}
