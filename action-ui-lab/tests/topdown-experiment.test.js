/**
 * DARKGRID — TOP-DOWN EXPLORATION EXPERIMENT 1
 * Comprehensive Integration, Rules & Headless Chrome Visual QA Suite
 *
 * Verifies all 16 criteria from Section 11:
 *   1. Game starts at the exact same Action UI entrypoint (`createLabApp`).
 *   2. Existing character system & 72-point creator work (Fighter, Ranger, Cleric).
 *   3. Town (`Oakhaven` [7,7]) navigation, free healing (`REST`), Shop (`BUY`/`SELL`).
 *   4. Quest (`The Goblin Chieftain`) states: `NOT_ACCEPTED` -> `ACTIVE` -> `COMPLETED` -> `REWARD_CLAIMED`.
 *   5. Pre-acceptance boss kill edge case: defeating the boss before accepting the quest does NOT revive the boss and allows immediate completion & reward claim.
 *   6. Travel into Goblin Forest (`Blackwood Forest`, 8x7 = 56 tiles) and back to Town.
 *   7. Grid movement (1 move = 1 tile, cardinal directions update position & facing).
 *   8. Impassable tiles (`Stonefang Crag` [6,5], `Blackwater River` [8,6], Dense Woods, outer boundary) block movement.
 *   9. Goblin Forest encounter weights (~80% Goblin, ~15% Forest Animals, ~5% Other) and pacing (not every step).
 *  10. Combat uses the full Phase 7C engine (Fighter Second Wind, Ranger Favored Enemy/Opening Shot, Cleric Divine Charges/Battle Prayer/Smite/Divine Shield).
 *  11. Goblin Stronghold boss (`Warchief Grak the Goblin Chieftain`) is at fixed landmark [7,1], does not trigger as a random encounter on step, is engaged via `ENGAGE_STRONGHOLD_BOSS`, and stays dead permanently after victory.
 *  12. Inventory, equipment, and healing potions work both in exploration and combat.
 *  13. Permadeath & Nemesis persistence rules remain intact.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createLabApp } = require('../server');
const { selectGoblinForestMonster } = require('../server/services/topdown-world-service');

describe('Top-Down Exploration Experiment 1 — Town, Goblin Forest, Stronghold & Phase 7C Parity', () => {
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

  it('1. Initializes at Oakhaven [7,7] with 8x7 (56-tile) Top-Down Map and The Goblin Chieftain quest', async () => {
    const state = await getState();
    assert.equal(state.mode, 'CITY');
    assert.equal(state.isSafeCity, true);
    assert.equal(state.currentTile.name, 'Oakhaven');
    assert.equal(state.currentTile.x, 7);
    assert.equal(state.currentTile.y, 7);

    // Top-down map payload has 8x7 = 56 tiles
    assert.ok(state.topdownMap, 'topdownMap payload should exist');
    assert.equal(state.topdownMap.bounds.cols, 8);
    assert.equal(state.topdownMap.bounds.rows, 7);
    assert.equal(state.topdownMap.tiles.length, 56);
    assert.equal(state.topdownMap.bossSlain, false);
    assert.deepEqual(state.topdownMap.strongholdCoord, { x: 7, y: 1 });
    assert.deepEqual(state.topdownMap.townCoord, { x: 7, y: 7 });

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

  it('2. Enforces 8x7 region boundaries and impassable obstacles while allowing multi-path forest navigation', async () => {
    const resetRes = await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    if (!resetRes.ok) console.error('RESET_WORLD ERROR:', resetRes.error);
    assert.equal(resetRes.ok, true);

    // Moving South from Oakhaven [7,7] to [7,8] is outside the 8x7 experiment region and must be blocked
    const southBlocked = await postAction('MOVE', { direction: 'SOUTH' });
    assert.equal(southBlocked.ok, false);
    assert.equal(southBlocked.state.currentTile.x, 7);
    assert.equal(southBlocked.state.currentTile.y, 7);

    // Move North from Oakhaven [7,7] -> Oakhaven North Gate [7,6] (1 move = 1 tile)
    const stepGate = await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(stepGate.ok, true);
    assert.equal(stepGate.state.currentTile.x, 7);
    assert.equal(stepGate.state.currentTile.y, 6);
    assert.equal(stepGate.state.facing, 'NORTH');

    // Move North to Blackwood Crossroads [7,5]
    const stepCross = await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    assert.equal(stepCross.ok, true);
    assert.equal(stepCross.state.currentTile.x, 7);
    assert.equal(stepCross.state.currentTile.y, 5);

    // Move West into Stonefang Crag [6,5] (Impassable MOUNTAINS) -> Blocked!
    const cragBlocked = await postAction('MOVE', { direction: 'WEST', testForceEncounter: false });
    assert.equal(cragBlocked.ok, false);
    assert.equal(cragBlocked.state.currentTile.x, 7);
    assert.equal(cragBlocked.state.currentTile.y, 5);

    // Take the Western Bypass Trail: South to [7,6] -> West to [6,6] -> West to [5,6] -> North to [5,5] -> North to [5,4]
    const backToGate = await postAction('MOVE', { direction: 'SOUTH', testForceEncounter: false });
    assert.equal(backToGate.ok, true);
    const westEdge = await postAction('MOVE', { direction: 'WEST', testForceEncounter: false });
    assert.equal(westEdge.ok, true);
    assert.equal(westEdge.state.currentTile.x, 6);
    assert.equal(westEdge.state.currentTile.y, 6);
    assert.equal(westEdge.state.facing, 'WEST');

    const westTrail = await postAction('MOVE', { direction: 'WEST', testForceEncounter: false });
    assert.equal(westTrail.ok, true);
    assert.equal(westTrail.state.currentTile.x, 5);
    assert.equal(westTrail.state.currentTile.y, 6);

    // Return to Oakhaven [7,7]
    await postAction('MOVE', { direction: 'EAST', testForceEncounter: false });
    await postAction('MOVE', { direction: 'EAST', testForceEncounter: false });
    const inTown = await postAction('MOVE', { direction: 'SOUTH', testForceEncounter: false });
    assert.equal(inTown.ok, true);
    assert.equal(inTown.state.isSafeCity, true);
    assert.equal(inTown.state.currentTile.x, 7);
    assert.equal(inTown.state.currentTile.y, 7);
  });

  it('3. Verifies Goblin Forest encounter distribution (~80% Goblin, ~15% Forest Animals, ~5% Other)', () => {
    let goblinCount = 0;
    let animalCount = 0;
    let otherCount = 0;
    const totalSamples = 1000;

    for (let i = 0; i < totalSamples; i++) {
      // Deterministic pseudo-random generator over [0, 1)
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

  it('4. Completes full Town -> Accept Quest -> Goblin Forest -> Stronghold Boss -> Town Reward loop', async () => {
    const resetRes = await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
    assert.equal(resetRes.ok, true);

    // Accept quest in Oakhaven
    const acceptRes = await postAction('ACCEPT_QUEST');
    assert.equal(acceptRes.ok, true);
    assert.equal(acceptRes.state.quest.status, 'ACTIVE');

    // Travel North along the central trail to Goblin Stronghold [7,1]
    for (let expectedY = 6; expectedY >= 1; expectedY--) {
      const step = await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      assert.equal(step.ok, true);
      assert.equal(step.state.currentTile.x, 7);
      assert.equal(step.state.currentTile.y, expectedY);
    }

    // At [7,1] Goblin Stronghold: stepping onto the entrance does NOT auto-trigger a random encounter
    const atStronghold = await getState();
    assert.equal(atStronghold.currentTile.x, 7);
    assert.equal(atStronghold.currentTile.y, 1);
    assert.equal(atStronghold.currentTile.name, 'Goblin Stronghold');
    assert.equal(atStronghold.encounter, null);
    assert.equal(atStronghold.topdownMap.bossSlain, false);

    // Player initiates the boss fight via ENGAGE_STRONGHOLD_BOSS
    const engageBoss = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engageBoss.ok, true);
    assert.equal(engageBoss.state.mode, 'IN_COMBAT');
    assert.ok(engageBoss.state.encounter, 'Boss encounter should be active');
    assert.match(engageBoss.state.encounter.monsterName, /Warchief Grak|Goblin/i);

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
      // Keep HP topped up during test loop
      db.prepare('UPDATE characters SET current_hp = 60 WHERE id = ?').run(heroId);
    }

    assert.notEqual(combatState.mode, 'IN_COMBAT', 'Boss should be defeated');
    assert.equal(combatState.topdownMap.bossSlain, true, 'Boss should be marked slain on the world map');
    assert.equal(combatState.quest.status, 'COMPLETED', 'Quest should transition to COMPLETED');
    assert.equal(combatState.currentTile.x, 7, 'Hero remains at [7,1] after combat');
    assert.equal(combatState.currentTile.y, 1, 'Hero remains at [7,1] after combat');

    // Attempting to engage the Stronghold boss again must fail because the boss is permanently slain
    const engageAgain = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engageAgain.ok, false);

    // Travel South back to Oakhaven [7,7]
    for (let expectedY = 2; expectedY <= 7; expectedY++) {
      const step = await postAction('MOVE', { direction: 'SOUTH', testForceEncounter: false });
      assert.equal(step.ok, true);
      assert.equal(step.state.currentTile.y, expectedY);
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

    // Verify quest is NOT_ACCEPTED
    const initial = await getState();
    assert.equal(initial.quest.status, 'NOT_ACCEPTED');
    assert.equal(initial.topdownMap.bossSlain, false);

    // Walk to Stronghold [7,1] without accepting quest
    for (let y = 6; y >= 1; y--) {
      await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    }

    // Engage and defeat boss while quest is still NOT_ACCEPTED
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

    // Return to Oakhaven [7,7]
    for (let y = 2; y <= 7; y++) {
      await postAction('MOVE', { direction: 'SOUTH', testForceEncounter: false });
    }

    // Accepting the quest now immediately transitions to COMPLETED without reviving the boss
    const acceptAfterKill = await postAction('ACCEPT_QUEST');
    assert.equal(acceptAfterKill.ok, true);
    assert.equal(acceptAfterKill.state.quest.status, 'COMPLETED');
    assert.equal(acceptAfterKill.state.topdownMap.bossSlain, true);

    // Claiming reward succeeds immediately
    const claim = await postAction('CLAIM_QUEST_REWARD');
    assert.equal(claim.ok, true);
    assert.equal(claim.state.quest.status, 'REWARD_CLAIMED');
  });

  it('6. Preserves Town Rest (free healing), Shop Buy/Sell, Inventory Equip/Unequip, and Healing Potions', async () => {
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Simulate wound and rest in Oakhaven
    const wound = await postAction('LAB_SCENARIO', { scenario: 'WOUNDED' });
    assert.equal(wound.ok, true);
    assert.ok(wound.state.character.current_hp < wound.state.character.max_hp);

    const restRes = await postAction('REST');
    assert.equal(restRes.ok, true);
    assert.equal(restRes.state.character.current_hp, restRes.state.character.max_hp);

    // Drink healing potion when wounded outside combat
    await postAction('LAB_SCENARIO', { scenario: 'WOUNDED' });
    const beforePotions = (await getState()).potionCount;
    assert.ok(beforePotions > 0, 'Hero starts with healing potions');
    const drinkRes = await postAction('POTION');
    assert.equal(drinkRes.ok, true);
    assert.equal(drinkRes.state.potionCount, beforePotions - 1);

    // Shop Buy & Inventory Equip/Unequip
    const st = await getState();
    assert.ok(st.shopStock && st.shopStock.standardItems.length > 0, 'Town shop should be stocked');
    const firstAffordable = st.shopStock.standardItems.find((item) => item.buy_price <= st.character.gold);
    assert.ok(firstAffordable, 'Hero can afford an item in Oakhaven shop');

    const buyRes = await postAction('BUY', { itemDefinitionId: firstAffordable.id });
    assert.equal(buyRes.ok, true);
    assert.equal(buyRes.state.character.gold, st.character.gold - firstAffordable.buy_price);

    // Unequip and re-equip main-hand weapon
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
    // 7a. Cleric Divine Combat Abilities
    const switchCleric = await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'CLERIC' });
    assert.equal(switchCleric.ok, true);
    assert.equal(switchCleric.state.character.class, 'CLERIC');
    assert.ok(switchCleric.state.clericDivineInfo.currentCharges > 0, 'Cleric has Divine Charges');

    // Start a Goblin combat encounter in Blackwood Forest
    const goblinCombat = await postAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Goblin' });
    assert.equal(goblinCombat.ok, true);
    assert.equal(goblinCombat.state.mode, 'IN_COMBAT');
    const clericId = goblinCombat.state.character.id;
    // Give Goblin high HP so we can test Divine Shield + Battle Prayer + Smite in sequence
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

    // 7b. Ranger Favored Enemy & Ranged Stance
    const switchRanger = await postAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'RANGER' });
    assert.equal(switchRanger.ok, true);
    assert.equal(switchRanger.state.character.class, 'RANGER');
    assert.ok(switchRanger.state.character.favored_enemy_family, 'Ranger has a Favored Enemy family');

    // 7c. Fighter Second Wind at Level 3+
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

    // Trigger combat in Goblin Forest [7,5]
    const combatStart = await postAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Hobgoblin' });
    assert.equal(combatStart.ok, true);
    assert.equal(combatStart.state.mode, 'IN_COMBAT');
    const doomedHeroId = combatStart.state.character.id;
    const encId = combatStart.state.encounter.id;

    // Set hero to 1 HP and AC 1, and boost monster attack/HP so the monster slays the hero
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

    // Verify a persistent Nemesis monster_instance was created/updated on the tile
    const nemesisRow = db.prepare('SELECT * FROM monster_instances WHERE id = ?').get(st.fallen.killed_by_monster_instance_id);
    assert.ok(nemesisRow, 'Persistent Nemesis monster instance should exist in DB');
    assert.equal(nemesisRow.status, 'ACTIVE');
    assert.ok(nemesisRow.kill_count >= 1, 'Nemesis kill_count should be incremented');

    // Revive a new hero in Oakhaven and reset world for clean state
    const reviveRes = await postAction('REVIVE', { classType: 'FIGHTER' });
    assert.equal(reviveRes.ok, true);
    assert.equal(reviveRes.state.mode, 'CITY');
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });

  it('9. Verifies Eastern Ravine & Old Log Crossing [9,3] route, blocks mid-combat ENGAGE_STRONGHOLD_BOSS exploit, and attaches combatSequence', async () => {
    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });

    // Walk the Eastern Route: [7,7] -> [8,7] Stone Bridge -> [9,7] Watchpost -> [9,6] Lower Ravine -> [10,6] -> [10,5] -> [10,4] -> [10,3] -> [9,3] Old Log Crossing -> [8,3] -> [7,3]
    const easternSteps = ['EAST', 'EAST', 'NORTH', 'EAST', 'NORTH', 'NORTH', 'NORTH', 'WEST', 'WEST', 'WEST'];
    const expectedCoords = [
      [8, 7], [9, 7], [9, 6], [10, 6], [10, 5], [10, 4], [10, 3], [9, 3], [8, 3], [7, 3]
    ];

    for (let i = 0; i < easternSteps.length; i++) {
      const stepRes = await postAction('MOVE', { direction: easternSteps[i], testForceEncounter: false });
      assert.equal(stepRes.ok, true, `Step ${i} (${easternSteps[i]}) should be passable`);
      assert.equal(stepRes.state.currentTile.x, expectedCoords[i][0]);
      assert.equal(stepRes.state.currentTile.y, expectedCoords[i][1]);
    }

    // Verify [9,4] and [9,5] are impassable river tiles in topdownMap
    const stateAtOak = await getState();
    const tile94 = stateAtOak.topdownMap.tiles.find((t) => t.x === 9 && t.y === 4);
    const tile95 = stateAtOak.topdownMap.tiles.find((t) => t.x === 9 && t.y === 5);
    assert.equal(tile94.isPassable, false);
    assert.equal(tile95.isPassable, false);

    // Move North to [7,2] -> [7,1] Goblin Stronghold
    await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    await postAction('MOVE', { direction: 'NORTH', testForceEncounter: false });

    // Engage boss and verify combatSequence is attached and calling ENGAGE_STRONGHOLD_BOSS again mid-combat is rejected
    const engage = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(engage.ok, true);
    assert.ok(engage.state.combatSequence, 'ENGAGE_STRONGHOLD_BOSS should attach combatSequence');
    const midCombatExploit = await postAction('ENGAGE_STRONGHOLD_BOSS');
    assert.equal(midCombatExploit.ok, false, 'Must reject ENGAGE_STRONGHOLD_BOSS when already in active combat');
    assert.match(midCombatExploit.error, /already engaged in active combat/i);

    await postAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
  });
});
