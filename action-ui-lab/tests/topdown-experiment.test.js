/**
 * DARKGRID — TOP-DOWN EXPLORATION & PHASE 8 PARITY SUITE
 *
 * Verifies core top-down exploration, town, quest, stronghold boss, and Phase 7C parity
 * on the expanded 30×30 (900-tile) Goblin Forest world.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createLabApp } = require('../server');
const {
  selectGoblinForestMonster,
  ROUTE_A_MAIN_TRAIL,
  ROUTE_C_EASTERN_RIVER
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

describe('Top-Down Exploration — Town, 30×30 Goblin Forest, Stronghold & Phase 7C Parity', () => {
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

  it('1. Initializes at Oakhaven [15,27] with 30x30 (900-tile) Top-Down Map and The Goblin Chieftain quest', async () => {
    const state = await getState();
    assert.equal(state.mode, 'CITY');
    assert.equal(state.isSafeCity, true);
    assert.equal(state.currentTile.name, 'Oakhaven');
    assert.equal(state.currentTile.x, 15);
    assert.equal(state.currentTile.y, 27);

    // Top-down map payload has 30x30 = 900 tiles
    assert.ok(state.topdownMap, 'topdownMap payload should exist');
    assert.equal(state.topdownMap.bounds.cols, 30);
    assert.equal(state.topdownMap.bounds.rows, 30);
    assert.equal(state.topdownMap.tiles.length, 900);
    assert.equal(state.topdownMap.bossSlain, false);
    assert.deepEqual(state.topdownMap.strongholdCoord, { x: 15, y: 2 });
    assert.deepEqual(state.topdownMap.townCoord, { x: 15, y: 27 });

    // Quest initial state
    assert.ok(state.quest, 'quest payload should exist');
    assert.equal(state.quest.title, 'The Goblin Chieftain');
    assert.equal(
      state.quest.description,
      'A goblin chieftain has taken control of an old stronghold deep within Blackwood Forest. Travelers are disappearing. Find the stronghold and defeat the chieftain.'
    );
    assert.equal(state.quest.status, 'NOT_ACCEPTED');
    assert.equal(state.quest.canAccept, true);
  });

  it('2. Enforces 30x30 region boundaries and impassable obstacles while allowing multi-path forest navigation', async () => {
    const resetRes = await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    assert.equal(resetRes.ok, true);

    // Moving South from Oakhaven [15,27] into Southern Border Woods [15,28] is impassable and must be blocked
    const southBlocked = await postAction('MOVE', { direction: 'SOUTH' });
    assert.equal(southBlocked.ok, false);
    assert.equal(southBlocked.state.currentTile.x, 15);
    assert.equal(southBlocked.state.currentTile.y, 27);

    // Move North from Oakhaven [15,27] -> Oakhaven North Gate [15,26] (1 move = 1 tile)
    const stepGate = await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(stepGate.ok, true);
    assert.equal(stepGate.state.currentTile.x, 15);
    assert.equal(stepGate.state.currentTile.y, 26);
    assert.equal(stepGate.state.facing, 'NORTH');

    // Move North to King's Road South [15,25] -> [15,24] -> Blackwood Crossroads [15,23]
    await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    const stepCross = await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(stepCross.ok, true);
    assert.equal(stepCross.state.currentTile.x, 15);
    assert.equal(stepCross.state.currentTile.y, 23);
    assert.equal(stepCross.state.currentTile.name, 'Blackwood Crossroads');

    // Move West from Crossroads [15,23] along the Western Trail [14,23] -> [13,23] -> [12,23] -> [12,22], then try North into Stonefang Crag [12,21] -> Blocked!
    await postAction('MOVE', { direction: 'WEST', testForceEncounter: false });
    await postAction('MOVE', { direction: 'WEST', testForceEncounter: false });
    await postAction('MOVE', { direction: 'WEST', testForceEncounter: false });
    const stepBeforeCrag = await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(stepBeforeCrag.ok, true);
    assert.equal(stepBeforeCrag.state.currentTile.x, 12);
    assert.equal(stepBeforeCrag.state.currentTile.y, 22);

    const cragBlocked = await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(cragBlocked.ok, false, 'Stonefang Crag [12,21] must block movement');
    assert.equal(cragBlocked.state.currentTile.x, 12);
    assert.equal(cragBlocked.state.currentTile.y, 22);

    // Return to Oakhaven [15,27]
    const inTown = await postAction('TELEPORT_TO_TILE', { x: 15, y: 27, facing: 'NORTH' });
    assert.equal(inTown.ok, true);
    assert.equal(inTown.state.isSafeCity, true);
    assert.equal(inTown.state.currentTile.x, 15);
    assert.equal(inTown.state.currentTile.y, 27);
  });

  it('3. Verifies Goblin Forest encounter distribution (~80% Goblin, ~15% Forest Animals, ~5% Other)', () => {
    let goblinCount = 0;
    let animalCount = 0;
    let otherCount = 0;
    const totalSamples = 1000;

    for (let i = 0; i < totalSamples; i++) {
      const u1 = ((i * 9301 + 49297) % 233280) / 233280;
      const u2 = (((i + 77) * 9301 + 49297) % 233280) / 233280;
      let call = 0;
      const rng = () => (call++ === 0 ? u1 : u2);
      const picked = selectGoblinForestMonster(db, rng);
      assert.ok(picked && picked.monster, 'Should always pick a valid database monster');
      if (picked.bucket === 'GOBLIN') goblinCount++;
      else if (picked.bucket === 'ANIMAL') animalCount++;
      else otherCount++;
    }

    const goblinPct = (goblinCount / totalSamples) * 100;
    const animalPct = (animalCount / totalSamples) * 100;
    const otherPct = (otherCount / totalSamples) * 100;

    assert.ok(goblinPct >= 75 && goblinPct <= 85, `Expected ~80% goblins, got ${goblinPct.toFixed(1)}%`);
    assert.ok(animalPct >= 11 && animalPct <= 19, `Expected ~15% animals, got ${animalPct.toFixed(1)}%`);
    assert.ok(otherPct >= 2 && otherPct <= 9, `Expected ~5% other, got ${otherPct.toFixed(1)}%`);
  });

  it('4. Completes full Town -> Accept Quest -> Route A (Main Forest Trail) -> Stronghold Boss -> Town Reward loop', async () => {
    const resetRes = await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    assert.equal(resetRes.ok, true);

    // Accept quest in Oakhaven
    const acceptRes = await postAction('ACCEPT_QUEST');
    assert.equal(acceptRes.ok, true);
    assert.equal(acceptRes.state.quest.status, 'ACTIVE');

    // Walk along ROUTE_A_MAIN_TRAIL from [15,27] to Goblin Stronghold [15,2]
    for (let i = 1; i < ROUTE_A_MAIN_TRAIL.length; i++) {
      const dir = stepDirection(ROUTE_A_MAIN_TRAIL[i - 1], ROUTE_A_MAIN_TRAIL[i]);
      const step = await postAction('MOVE', { direction: dir, testForceEncounter: false });
      assert.equal(step.ok, true, `Route A step ${i} (${dir}) should succeed`);
      assert.equal(step.state.currentTile.x, ROUTE_A_MAIN_TRAIL[i][0]);
      assert.equal(step.state.currentTile.y, ROUTE_A_MAIN_TRAIL[i][1]);
    }

    // At [15,2] Goblin Stronghold: stepping onto the entrance does NOT auto-trigger a random encounter
    const atStronghold = await getState();
    assert.equal(atStronghold.currentTile.x, 15);
    assert.equal(atStronghold.currentTile.y, 2);
    assert.equal(atStronghold.currentTile.name, 'Goblin Stronghold');
    assert.equal(atStronghold.encounter, null);
    assert.equal(atStronghold.topdownMap.bossSlain, false);

    // Player initiates the boss fight via ENGAGE_STRONGHOLD_BOSS
    const engageBoss = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engageBoss.ok, true);
    assert.equal(engageBoss.state.mode, 'IN_COMBAT');
    assert.ok(engageBoss.state.encounter, 'Boss encounter should be active');
    assert.match(engageBoss.state.encounter.monsterName, /Warchief Grak|Goblin/i);
    assert.equal(engageBoss.state.encounter.imageUrl, '/images/monsters/goblin.png', 'Boss uses Goblin portrait');

    // Boost hero strength & HP in DB to guarantee a clean victory over the Chieftain
    const heroId = engageBoss.state.character.id;
    const goldBefore = engageBoss.state.character.gold;
    const xpBefore = engageBoss.state.character.xp;
    db.prepare('UPDATE characters SET strength = 28, current_hp = 60, max_hp = 60 WHERE id = ?').run(heroId);

    let combatState = engageBoss.state;
    let safetyRounds = 0;
    while (combatState.mode === 'IN_COMBAT' && safetyRounds < 20) {
      safetyRounds++;
      const atk = await postAction('ATTACK');
      assert.equal(atk.ok, true);
      combatState = atk.state;
      db.prepare('UPDATE characters SET current_hp = 60 WHERE id = ?').run(heroId);
    }

    assert.notEqual(combatState.mode, 'IN_COMBAT', 'Boss should be defeated');
    assert.equal(combatState.topdownMap.bossSlain, true, 'Boss should be marked slain on the world map');
    assert.equal(combatState.quest.status, 'COMPLETED', 'Quest should transition to COMPLETED');
    assert.equal(combatState.currentTile.x, 15, 'Hero remains at [15,2] after combat');
    assert.equal(combatState.currentTile.y, 2, 'Hero remains at [15,2] after combat');

    // Attempting to engage the Stronghold boss again must fail because the boss is permanently slain
    const engageAgain = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engageAgain.ok, false);

    // Travel back along Route A to Oakhaven [15,27]
    for (let i = ROUTE_A_MAIN_TRAIL.length - 1; i >= 1; i--) {
      const dir = stepDirection(ROUTE_A_MAIN_TRAIL[i], ROUTE_A_MAIN_TRAIL[i - 1]);
      const step = await postAction('MOVE', { direction: dir, testForceEncounter: false });
      assert.equal(step.ok, true);
    }

    // Claim quest reward in Oakhaven
    const claimRes = await postAction('CLAIM_QUEST_REWARD');
    assert.equal(claimRes.ok, true);
    assert.equal(claimRes.state.quest.status, 'REWARD_CLAIMED');
    assert.ok(claimRes.state.character.gold >= goldBefore + 100, 'Hero should receive +100 gold quest reward');
    assert.ok(claimRes.state.character.xp >= xpBefore + 120, 'Hero should receive +120 XP quest reward');
  });

  it('5. Handles defeating the Stronghold Boss BEFORE accepting the quest without reviving the boss', async () => {
    const resetRes = await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    assert.equal(resetRes.ok, true);

    const initial = await getState();
    assert.equal(initial.quest.status, 'NOT_ACCEPTED');
    assert.equal(initial.topdownMap.bossSlain, false);

    // Teleport to Stronghold [15,2] without accepting quest
    await postAction('TELEPORT_TO_TILE', { x: 15, y: 2, facing: 'NORTH' });

    const engage = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engage.ok, true);
    const heroId = engage.state.character.id;
    db.prepare('UPDATE characters SET strength = 30, current_hp = 60, max_hp = 60 WHERE id = ?').run(heroId);

    let st = engage.state;
    for (let i = 0; i < 15 && st.mode === 'IN_COMBAT'; i++) {
      const r = await postAction('ATTACK');
      st = r.state;
    }
    assert.equal(st.topdownMap.bossSlain, true);
    assert.equal(st.quest.bossSlain, true);
    assert.equal(st.quest.status, 'NOT_ACCEPTED');

    // Return to Oakhaven [15,27]
    await postAction('TELEPORT_TO_TILE', { x: 15, y: 27, facing: 'NORTH' });

    // Accepting the quest now immediately transitions to COMPLETED without reviving the boss
    const acceptAfterKill = await postAction('ACCEPT_QUEST');
    assert.equal(acceptAfterKill.ok, true);
    assert.equal(acceptAfterKill.state.quest.status, 'COMPLETED');
    assert.equal(acceptAfterKill.state.topdownMap.bossSlain, true);

    const claim = await postAction('CLAIM_QUEST_REWARD');
    assert.equal(claim.ok, true);
    assert.equal(claim.state.quest.status, 'REWARD_CLAIMED');
  });

  it('6. Preserves Town Rest (free healing), Shop Buy/Sell, Inventory Equip/Unequip, and Healing Potions', async () => {
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    const wound = await postAction('LAB_SCENARIO', { scenario: 'WOUNDED' });
    assert.equal(wound.ok, true);
    assert.ok(wound.state.character.current_hp < wound.state.character.max_hp);

    const restRes = await postAction('REST');
    assert.equal(restRes.ok, true);
    assert.equal(restRes.state.character.current_hp, restRes.state.character.max_hp);

    await postAction('LAB_SCENARIO', { scenario: 'WOUNDED' });
    const beforePotions = (await getState()).potionCount;
    assert.ok(beforePotions > 0, 'Hero starts with healing potions');
    const drinkRes = await postAction('POTION');
    assert.equal(drinkRes.ok, true);
    assert.equal(drinkRes.state.potionCount, beforePotions - 1);

    const st = await getState();
    assert.ok(st.shopStock && st.shopStock.standardItems.length > 0, 'Town shop should be stocked');
    const firstAffordable = st.shopStock.standardItems.find((item) => item.buy_price <= st.character.gold);
    assert.ok(firstAffordable, 'Hero can afford an item in Oakhaven shop');

    const buyRes = await postAction('BUY', { itemDefinitionId: firstAffordable.id });
    assert.equal(buyRes.ok, true);
    assert.equal(buyRes.state.character.gold, st.character.gold - firstAffordable.buy_price);

    const eqWeapon = buyRes.state.equipment.meleeWeapon;
    assert.ok(eqWeapon, 'Fighter has a melee weapon equipped');
    const unequipRes = await postAction('UNEQUIP', { itemInstanceId: eqWeapon.id });
    assert.equal(unequipRes.ok, true);
    assert.equal(unequipRes.state.equipment.meleeWeapon, null);

    const equipRes = await postAction('EQUIP', { itemInstanceId: eqWeapon.id });
    assert.equal(equipRes.ok, true);
    assert.equal(equipRes.state.equipment.meleeWeapon.id, eqWeapon.id);
  });

  it('7. Preserves Phase 7C Class Abilities (Fighter Second Wind, Ranger Favored Enemy, Cleric Divine Charges/Prayer/Smite/Shield)', async () => {
    const switchCleric = await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'CLERIC' });
    assert.equal(switchCleric.ok, true);
    assert.equal(switchCleric.state.character.class, 'CLERIC');
    assert.ok(switchCleric.state.clericDivineInfo.currentCharges > 0, 'Cleric has Divine Charges');

    const goblinCombat = await postAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Goblin' });
    assert.equal(goblinCombat.ok, true);
    assert.equal(goblinCombat.state.mode, 'IN_COMBAT');
    const clericId = goblinCombat.state.character.id;
    db.prepare('UPDATE encounters SET current_monster_hp = 40, monster_max_hp = 40 WHERE id = ?').run(goblinCombat.state.encounter.id);
    db.prepare('UPDATE characters SET current_hp = 6 WHERE id = ?').run(clericId);

    const chargesBefore = goblinCombat.state.clericDivineInfo.currentCharges;
    const shieldRes = await postAction('DIVINE_SHIELD');
    assert.equal(shieldRes.ok, true);
    assert.equal(shieldRes.state.clericDivineInfo.currentCharges, chargesBefore - 2);
    assert.equal(shieldRes.state.clericDivineInfo.divineShieldActive, true);

    const prayerRes = await postAction('BATTLE_PRAYER');
    assert.equal(prayerRes.ok, true);
    assert.equal(prayerRes.state.clericDivineInfo.currentCharges, chargesBefore - 3);

    const smiteRes = await postAction('SMITE');
    assert.equal(smiteRes.ok, true);
    assert.equal(smiteRes.state.clericDivineInfo.currentCharges, chargesBefore - 4);

    const switchRanger = await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'RANGER' });
    assert.equal(switchRanger.ok, true);
    assert.equal(switchRanger.state.character.class, 'RANGER');
    assert.ok(switchRanger.state.character.favored_enemy_family, 'Ranger has a Favored Enemy family');

    const switchFighter = await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'FIGHTER' });
    assert.equal(switchFighter.ok, true);
    assert.equal(switchFighter.state.character.class, 'FIGHTER');
    db.prepare('UPDATE characters SET level = 3 WHERE id = ?').run(switchFighter.state.character.id);
    const fighterLvl3 = await getState();
    assert.equal(fighterLvl3.character.secondWindStatus, 'Ready');
  });

  it('8. Preserves Permadeath & Nemesis Monster Persistence when a hero falls in Goblin Forest', async () => {
    await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'FIGHTER' });
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    const combatStart = await postAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Hobgoblin' });
    assert.equal(combatStart.ok, true);
    assert.equal(combatStart.state.mode, 'IN_COMBAT');
    const doomedHeroId = combatStart.state.character.id;
    const encId = combatStart.state.encounter.id;

    db.prepare('UPDATE characters SET current_hp = 1, dexterity = 4 WHERE id = ?').run(doomedHeroId);
    db.prepare('UPDATE encounters SET current_monster_hp = 50, monster_max_hp = 50 WHERE id = ?').run(encId);

    let st = combatStart.state;
    for (let round = 0; round < 15 && st.mode === 'IN_COMBAT'; round++) {
      const r = await postAction('ATTACK');
      st = r.state;
    }

    assert.equal(st.mode, 'FALLEN', 'Slain hero enters FALLEN permadeath state');
    assert.ok(st.fallen, 'Fallen memorial record exists');
    assert.equal(st.fallen.id, doomedHeroId);
    assert.equal(st.fallen.is_alive, 0);

    const nemesisRow = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(st.fallen.killed_by_monster_instance_id);
    assert.ok(nemesisRow, 'Persistent Nemesis monster instance should exist in DB');
    assert.equal(nemesisRow.status, 'ACTIVE');
    assert.ok(nemesisRow.kill_count >= 1, 'Nemesis kill_count should be incremented');

    const reviveRes = await postAction('REVIVE', { classType: 'FIGHTER' });
    assert.equal(reviveRes.ok, true);
    assert.equal(reviveRes.state.mode, 'CITY');
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });

  it('9. Verifies Eastern River Route (Old Stone Bridge [19,25] & Old Log Crossing [20,9]), blocks mid-combat ENGAGE_STRONGHOLD_BOSS exploit, and attaches combatSequence', async () => {
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Walk along ROUTE_C_EASTERN_RIVER from [15,27] across Old Stone Bridge [19,25] and Old Log Crossing [20,9] to [15,2]
    for (let i = 1; i < ROUTE_C_EASTERN_RIVER.length; i++) {
      const dir = stepDirection(ROUTE_C_EASTERN_RIVER[i - 1], ROUTE_C_EASTERN_RIVER[i]);
      const stepRes = await postAction('MOVE', { direction: dir, testForceEncounter: false });
      assert.equal(stepRes.ok, true, `Route C step ${i} (${dir}) should be passable`);
      assert.equal(stepRes.state.currentTile.x, ROUTE_C_EASTERN_RIVER[i][0]);
      assert.equal(stepRes.state.currentTile.y, ROUTE_C_EASTERN_RIVER[i][1]);
    }

    // Verify non-bridge river tiles [19,24] and [20,8] are impassable river tiles in topdownMap
    const st = await getState();
    const river1 = st.topdownMap.tiles.find((t) => t.x === 19 && t.y === 24);
    const river2 = st.topdownMap.tiles.find((t) => t.x === 20 && t.y === 8);
    assert.equal(river1.isPassable, false);
    assert.equal(river2.isPassable, false);
    assert.equal(st.currentTile.x, 15);
    assert.equal(st.currentTile.y, 2);

    const engage = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engage.ok, true);
    assert.ok(engage.state.combatSequence, 'ENGAGE_STRONGHOLD_BOSS should attach combatSequence');
    const midCombatExploit = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(midCombatExploit.ok, false, 'Must reject ENGAGE_STRONGHOLD_BOSS when already in active combat');
    assert.match(midCombatExploit.error, /already engaged in active combat/i);

    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });
});
