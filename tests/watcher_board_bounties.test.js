const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./test_helpers');
const { setDb, closeDb } = require('../src/db/connection');
const { registerUser } = require('../src/domain/auth/service');
const { createCharacter } = require('../src/domain/character/rules');
const {
  getOrGenerateContracts,
  getActiveContractForCharacter,
  acceptContract,
  abandonContract,
  autoClaimCompletedBounties,
  getWildernessThreats,
} = require('../src/domain/bounties/board');
const {
  checkTileEncounter,
  investigateEncounter,
} = require('../src/domain/encounters/engine');
const {
  getCombatState,
  executeCombatRound,
} = require('../src/domain/combat/engine');
const { getVictoryData } = require('../src/domain/combat/victory');

describe("The Watcher's Board & Bounty Hunting System", () => {
  let db;
  let userId;
  let oakhavenTile;

  before(async () => {
    db = createTestDb();
    setDb(db);

    const user = await registerUser(db, 'bounty_tester', 'password123');
    userId = user.id;

    oakhavenTile = db
      .prepare("SELECT * FROM map_tiles WHERE terrain = 'CITY' AND is_safe = 1 LIMIT 1")
      .get();
    assert.ok(oakhavenTile, 'Oakhaven safe city tile must exist');
  });

  after(() => {
    closeDb();
  });

  let heroCounter = 0;
  function createTestHero(name, level = 1) {
    heroCounter += 1;
    const uRes = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(`bounty_user_${heroCounter}_${Date.now()}`, 'hash123');
    const newUserId = Number(uRes.lastInsertRowid);

    const hero = createCharacter(db, {
      userId: newUserId,
      name,
      classType: 'FIGHTER',
      stats: {
        strength: 16,
        dexterity: 12,
        constitution: 13,
        intelligence: 11,
        wisdom: 10,
        charisma: 10,
      },
    });
    if (level > 1) {
      db.prepare('UPDATE characters SET level = ?, max_hp = ?, current_hp = ? WHERE id = ?').run(
        level,
        20 + level * 10,
        20 + level * 10,
        hero.id
      );
    }
    return db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
  }

  it('1. Contract creation & persistence: generates 3 valid contracts with unique names, single boosts, and reachable regions', () => {
    const hero = createTestHero('Aldric the Watcher');
    const contracts = getOrGenerateContracts(db, hero);

    assert.equal(contracts.length, 3, 'Must generate exactly 3 contracts for a character');

    const validBoosts = new Set(['TOUGH', 'AGGRESSIVE', 'BRUTAL']);
    for (const c of contracts) {
      assert.equal(c.character_id, hero.id);
      assert.equal(c.status, 'AVAILABLE');
      assert.ok(c.custom_name && c.custom_name.includes(' the '), `Custom name "${c.custom_name}" must have an epithet`);
      assert.ok(validBoosts.has(c.boost_type), `Boost "${c.boost_type}" must be one of TOUGH, AGGRESSIVE, BRUTAL`);
      assert.ok(c.target_region && c.target_region !== 'Oakhaven', 'Target region must be a wilderness region');
      assert.ok(c.reward_gold >= 25, 'Reward gold must be positive and reasonable');
      assert.ok(c.boosted_max_hp >= c.base_monster_hp, 'Boosted max HP must be >= base HP');

      if (c.boost_type === 'TOUGH') {
        const expectedToughHp = Math.max(c.base_monster_hp + 1, Math.ceil(c.base_monster_hp * 1.15));
        assert.equal(c.boosted_max_hp, expectedToughHp, 'TOUGH boost must increase Max HP by +15%');
        assert.equal(c.attack_bonus_mod, 0);
        assert.equal(c.damage_bonus_mod, 0);
      } else if (c.boost_type === 'AGGRESSIVE') {
        assert.equal(c.boosted_max_hp, c.base_monster_hp, 'AGGRESSIVE boost must keep base Max HP');
        assert.equal(c.attack_bonus_mod, 1);
        assert.equal(c.damage_bonus_mod, 0);
      } else if (c.boost_type === 'BRUTAL') {
        assert.equal(c.boosted_max_hp, c.base_monster_hp, 'BRUTAL boost must keep base Max HP');
        assert.equal(c.attack_bonus_mod, 0);
        assert.equal(c.damage_bonus_mod, 1);
      }

      // Level 1 safety check: CR must be <= 1
      assert.ok(Number(c.monster_cr) <= 1, `Level 1 contract monster CR (${c.monster_cr}) must respect CR safety cap`);
    }

    // Calling getOrGenerateContracts again on refresh must return the exact same 3 persisted contracts
    const refreshedContracts = getOrGenerateContracts(db, hero);
    assert.deepEqual(
      refreshedContracts.map((c) => c.id),
      contracts.map((c) => c.id),
      'Contracts must persist across refreshes without generating new rows'
    );
    assert.deepEqual(
      refreshedContracts.map((c) => c.custom_name),
      contracts.map((c) => c.custom_name),
      'Custom monster names must remain identical across refreshes'
    );
  });

  it('2 & 3. Accept, single active contract enforcement, and Abandon lifecycle (with anti-reroll protection)', () => {
    const hero = createTestHero('Beren the Hunter');
    const contracts = getOrGenerateContracts(db, hero);

    // Accept contract #1 in Oakhaven
    const acceptRes = acceptContract(db, hero, contracts[0].id);
    assert.equal(acceptRes.ok, true);
    assert.equal(acceptRes.contract.status, 'ACTIVE');

    const active = getActiveContractForCharacter(db, hero.id);
    assert.ok(active);
    assert.equal(active.id, contracts[0].id);

    // Attempting to accept contract #2 while #1 is ACTIVE must fail
    const secondAccept = acceptContract(db, hero, contracts[1].id);
    assert.equal(secondAccept.ok, false);
    assert.match(secondAccept.error, /already have an active hunting contract/i);

    // Database partial unique index must also block direct SQL insertion of a second ACTIVE contract
    assert.throws(() => {
      db.prepare(`
        INSERT INTO hunting_contracts (
          character_id, base_monster_id, custom_name, title, description,
          region_name, target_terrain, threat_label, boost_type, boost_label,
          boosted_max_hp, attack_bonus_mod, damage_bonus_mod, reward_gold, status
        ) VALUES (?, ?, 'Duplicate Quarry', 'Test', 'Test', 'Verdant Plains', 'PLAINS', 'Dangerous', 'TOUGH', 'Tough', 10, 0, 0, 35, 'ACTIVE')
      `).run(hero.id, contracts[0].base_monster_id);
    }, /UNIQUE constraint failed/);

    // Abandon contract #1
    const abandonRes = abandonContract(db, hero, contracts[0].id);
    assert.equal(abandonRes.ok, true);
    assert.equal(getActiveContractForCharacter(db, hero.id), null);

    // Now contract #2 can be accepted
    const acceptSecondAfterAbandon = acceptContract(db, hero, contracts[1].id);
    assert.equal(acceptSecondAfterAbandon.ok, true);

    // Abandon #2 and accept+abandon #3 without fighting any battles:
    // Verify anti-reroll protection (does NOT generate a free new batch while progression seed hasn't changed)
    abandonContract(db, hero, contracts[1].id);
    acceptContract(db, hero, contracts[2].id);
    abandonContract(db, hero, contracts[2].id);

    const afterAllAbandoned = getOrGenerateContracts(db, hero);
    assert.equal(
      afterAllAbandoned.length,
      0,
      'Abandoning all 3 contracts in town without combat/progression must NOT grant free infinite rerolls'
    );
  });

  it('4. Encounter probability & Region isolation: 40% in region, 75% target roll, 0% outside region, persistent priority, and Stage 1 secrecy', () => {
    const hero = createTestHero('Caelen the Tracker');
    const otherHero = createTestHero('Doran the Bystander');
    const contracts = getOrGenerateContracts(db, hero);
    acceptContract(db, hero, contracts[0].id);
    const activeContract = getActiveContractForCharacter(db, hero.id);

    // Find a tile in the target region
    const regionTile = db
      .prepare("SELECT * FROM map_tiles WHERE name = ? AND terrain != 'CITY' AND is_passable = 1 LIMIT 1")
      .get(activeContract.target_region);
    assert.ok(regionTile, `Must find a passable tile in target region "${activeContract.target_region}"`);

    // Find a wilderness tile in a DIFFERENT region
    const otherRegionTile = db
      .prepare("SELECT * FROM map_tiles WHERE name != ? AND terrain NOT IN ('CITY', 'MOUNTAINS', 'WATER') AND is_passable = 1 LIMIT 1")
      .get(activeContract.target_region);
    assert.ok(otherRegionTile, 'Must find a passable tile in a different region');

    // A) Roll > 0.25 and <= 0.40 (e.g. 0.32):
    // Outside active bounty region -> NO encounter (since 0.32 > 0.25)
    const outsideNoEnc = checkTileEncounter(db, hero, otherRegionTile, { rng: () => 0.32 });
    assert.equal(outsideNoEnc, null, 'Roll 0.32 outside target region must NOT trigger an encounter (25% cap)');

    // For otherHero (no contract) on regionTile, roll 0.32 must ALSO NOT trigger an encounter
    const otherHeroNoEnc = checkTileEncounter(db, otherHero, regionTile, { rng: () => 0.32 });
    assert.equal(otherHeroNoEnc, null, 'Roll 0.32 for another hero without the contract must NOT trigger an encounter');

    // For hero with active contract on regionTile:
    // 1st rng call = 0.32 (< 0.40, triggers encounter)
    // 2nd rng call = 0.50 (< 0.75, selects Named Bounty target!)
    // 3rd rng call = 0.90 (perception check)
    const rngValues = [0.32, 0.50, 0.90];
    let rngIdx = 0;
    const bountyEnc = checkTileEncounter(db, hero, regionTile, { rng: () => rngValues[rngIdx++] });
    assert.ok(bountyEnc, 'Roll 0.32 in active bounty region must trigger an encounter');
    assert.equal(bountyEnc.bounty_contract_id, activeContract.id, 'Roll 0.50 (< 0.75) must select the Named Bounty target');
    assert.equal(bountyEnc.monster_id, activeContract.base_monster_id);
    assert.equal(bountyEnc.current_monster_hp, activeContract.boosted_max_hp);

    // Verify Stage 1 (DISCOVERED) secrecy: custom_name and base_monster_name must NOT be revealed as monster_name
    assert.equal(bountyEnc.status, 'DISCOVERED');
    assert.equal(bountyEnc.isRevealed, false);
    assert.equal(bountyEnc.isBountyTarget, false, 'Stage 1 must keep bounty target identity secret');
    assert.ok(
      !bountyEnc.description.includes(activeContract.custom_name),
      'Stage 1 description must not leak the custom bounty name'
    );

    // Transition to Stage 2 (IN_COMBAT): now custom_name, isBountyTarget, and bountyTraitNotice are revealed!
    const combatEnc = investigateEncounter(db, hero.id, bountyEnc.id, hero.class);
    assert.equal(combatEnc.status, 'IN_COMBAT');
    assert.equal(combatEnc.isRevealed, true);
    assert.equal(combatEnc.isBountyTarget, true);
    assert.equal(combatEnc.monster_name, activeContract.custom_name);
    assert.equal(combatEnc.base_monster_name, activeContract.base_monster_name);
    assert.ok(combatEnc.bountyTraitNotice && combatEnc.bountyTraitNotice.length > 10);

    // Clean up this encounter so we can test persistent monster priority on the same tile
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(combatEnc.id);

    // B) Persistent monster priority: if a global persistent monster is on regionTile, it takes 100% priority
    const persistRes = db
      .prepare(`
        INSERT INTO monster_instances (monster_id, tile_id, current_hp, max_hp, kill_count, status)
        VALUES (?, ?, 25, 25, 1, 'ACTIVE')
      `)
      .run(activeContract.base_monster_id, regionTile.id);
    const persistId = Number(persistRes.lastInsertRowid);

    const priorityEnc = checkTileEncounter(db, hero, regionTile, { rng: () => 0.10 });
    assert.ok(priorityEnc);
    assert.equal(priorityEnc.monster_instance_id, persistId, 'Global persistent monster must take priority over bounty target');
    assert.equal(priorityEnc.bounty_contract_id, null);

    // Clean up persistent monster & encounter
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(priorityEnc.id);
    db.prepare("UPDATE monster_instances SET status = 'DEFEATED' WHERE id = ?").run(persistId);
  });

  it('5. Monster Boosts (TOUGH, AGGRESSIVE, BRUTAL) apply accurately in real combat calculations', () => {
    const hero = createTestHero('Elowen the Swift', 2);
    const contracts = getOrGenerateContracts(db, hero);
    acceptContract(db, hero, contracts[0].id);
    const contract = getActiveContractForCharacter(db, hero.id);

    const regionTile = db
      .prepare("SELECT * FROM map_tiles WHERE name = ? AND terrain != 'CITY' AND is_passable = 1 LIMIT 1")
      .get(contract.target_region);

    const baseMonster = db.prepare('SELECT * FROM monsters WHERE id = ?').get(contract.base_monster_id);

    for (const boostType of ['TOUGH', 'AGGRESSIVE', 'BRUTAL']) {
      const toughHp =
        boostType === 'TOUGH'
          ? Math.max(baseMonster.base_hp + 1, Math.ceil(baseMonster.base_hp * 1.15))
          : baseMonster.base_hp;
      const abMod = boostType === 'AGGRESSIVE' ? 1 : 0;
      const dmgMod = boostType === 'BRUTAL' ? 1 : 0;

      db.prepare(`
        UPDATE hunting_contracts
        SET boost_type = ?, boosted_max_hp = ?, attack_bonus_mod = ?, damage_bonus_mod = ?
        WHERE id = ?
      `).run(boostType, toughHp, abMod, dmgMod, contract.id);

      let idx = 0;
      const seq = [0.10, 0.10, 0.90];
      const enc = checkTileEncounter(db, hero, regionTile, { rng: () => seq[idx++] });
      investigateEncounter(db, hero.id, enc.id, hero.class);
      const state = getCombatState(db, hero.id, enc.id);

      if (boostType === 'TOUGH') {
        assert.equal(state.encounter.bounty_boosted_max_hp, toughHp, 'TOUGH boost must set bounty_boosted_max_hp to +15%');
        assert.equal(state.encounter.current_monster_hp, toughHp, 'TOUGH boost must initialize encounter current_monster_hp to +15%');
      } else if (boostType === 'AGGRESSIVE') {
        assert.equal(
          state.encounter.monster_ab,
          baseMonster.attack_bonus + 1,
          'AGGRESSIVE boost must add +1 to monster_ab in combat encounter'
        );
      } else if (boostType === 'BRUTAL') {
        assert.equal(
          state.encounter.bounty_damage_bonus,
          1,
          'BRUTAL boost must set +1 bounty_damage_bonus in combat encounter'
        );
      }

      db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(enc.id);
    }
  });

  it('6. Completion & Auto-Claim in Oakhaven: slaying normal monster does not complete; slaying quarry marks READY_TO_CLAIM and pays gold only upon returning to Oakhaven', () => {
    const hero = createTestHero('Faelan the Just', 3);
    const contracts = getOrGenerateContracts(db, hero);
    acceptContract(db, hero, contracts[0].id);
    const contract = getActiveContractForCharacter(db, hero.id);

    const regionTile = db
      .prepare("SELECT * FROM map_tiles WHERE name = ? AND terrain != 'CITY' AND is_passable = 1 LIMIT 1")
      .get(contract.target_region);

    // Move hero out to regionTile
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(regionTile.id, hero.id);

    // 6a. Spawn a NORMAL monster of the same species (bounty_contract_id = NULL) and defeat it
    const normalEncRes = db
      .prepare(`
        INSERT INTO encounters (character_id, monster_id, tile_id, status, current_monster_hp, combat_round, bounty_contract_id)
        VALUES (?, ?, ?, 'IN_COMBAT', 1, 1, NULL)
      `)
      .run(hero.id, contract.base_monster_id, regionTile.id);
    const normalEncId = Number(normalEncRes.lastInsertRowid);

    // Force a guaranteed hero hit (roll 0.95 -> d20 = 20)
    const normalCombatRes = executeCombatRound(db, hero.id, normalEncId, 'ATTACK', { rng: () => 0.95 });
    assert.equal(normalCombatRes.encounter.status, 'VICTORY');

    const contractAfterNormalKill = db.prepare('SELECT * FROM hunting_contracts WHERE id = ?').get(contract.id);
    assert.equal(
      contractAfterNormalKill.status,
      'ACTIVE',
      'Slaying a normal monster of the same species must NOT complete the Named Hunting Contract'
    );

    // 6b. Now spawn the actual Named Bounty target and defeat it
    const heroInWilds = db.prepare('SELECT * FROM characters WHERE id = ?').get(hero.id);
    let idx = 0;
    const seq = [0.10, 0.10, 0.90];
    const bountyEnc = checkTileEncounter(db, heroInWilds, regionTile, { rng: () => seq[idx++] });
    assert.equal(bountyEnc.bounty_contract_id, contract.id);
    investigateEncounter(db, hero.id, bountyEnc.id, hero.class);

    // Set monster HP to 1 and hero initiative so next strike deterministically slays it
    db.prepare("UPDATE encounters SET current_monster_hp = 1, initiative_winner = 'HERO' WHERE id = ?").run(bountyEnc.id);
    const goldBeforeKill = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;

    const killRes = executeCombatRound(db, hero.id, bountyEnc.id, 'ATTACK', { rng: () => 0.95 });
    assert.equal(killRes.encounter.status, 'VICTORY');

    const contractAfterTargetKill = db.prepare('SELECT * FROM hunting_contracts WHERE id = ?').get(contract.id);
    assert.equal(
      contractAfterTargetKill.status,
      'READY_TO_CLAIM',
      'Slaying the Named Bounty target must transition the contract to READY_TO_CLAIM'
    );

    // Verify Victory screen data includes bountyInfo and custom_name, and that bounty gold was NOT paid in the wilds
    const victoryData = getVictoryData(db, hero.id, bountyEnc.id);
    assert.ok(victoryData);
    assert.equal(victoryData.cleanMonsterName, contract.custom_name);
    assert.ok(victoryData.bountyInfo);
    assert.equal(victoryData.bountyInfo.isBountyTarget, true);
    assert.equal(victoryData.bountyInfo.rewardGold, contract.reward_gold);

    const goldAfterKill = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
    assert.equal(
      goldAfterKill,
      goldBeforeKill + victoryData.goldLooted,
      'Bounty reward gold must NOT be paid immediately in the wilderness'
    );

    // 6c. Hero returns alive to Oakhaven -> autoClaimCompletedBounties pays the reward once
    db.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(oakhavenTile.id, hero.id);
    const claimed = autoClaimCompletedBounties(db, hero.id);
    assert.equal(claimed.length, 1, 'Must auto-claim the 1 READY_TO_CLAIM contract upon reaching Oakhaven');
    assert.equal(claimed[0].rewardGold, contract.reward_gold);
    assert.equal(claimed[0].customName, contract.custom_name);

    const goldAfterClaim = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
    assert.equal(
      goldAfterClaim,
      goldAfterKill + contract.reward_gold,
      'Character gold must increase by exact contract reward_gold upon returning to Oakhaven'
    );

    const settledContract = db.prepare('SELECT * FROM hunting_contracts WHERE id = ?').get(contract.id);
    assert.equal(settledContract.status, 'COMPLETED');

    // Calling autoClaimCompletedBounties a second time must not double-pay
    const secondClaim = autoClaimCompletedBounties(db, hero.id);
    assert.equal(secondClaim.length, 0, 'Must never double-claim an already COMPLETED contract');
  });

  it('7. Permadeath interaction: dying with ACTIVE or READY_TO_CLAIM contract marks it FAILED, and dying to Named Bounty promotes it to monster_instances with custom_title and non-compounding HP', () => {
    const doomedHero = createTestHero('Garrick the Doomed', 2);
    const contracts = getOrGenerateContracts(db, doomedHero);
    acceptContract(db, doomedHero, contracts[0].id);
    const contract = getActiveContractForCharacter(db, doomedHero.id);

    const baseMonster = db.prepare('SELECT * FROM monsters WHERE id = ?').get(contract.base_monster_id);
    const toughMaxHp = Math.max(baseMonster.base_hp + 1, Math.ceil(baseMonster.base_hp * 1.15));

    // Set contract boost to TOUGH so we can verify non-compounding HP promotion
    db.prepare("UPDATE hunting_contracts SET boost_type = 'TOUGH', boosted_max_hp = ? WHERE id = ?").run(
      toughMaxHp,
      contract.id
    );

    const regionTile = db
      .prepare("SELECT * FROM map_tiles WHERE name = ? AND terrain != 'CITY' AND is_passable = 1 LIMIT 1")
      .get(contract.target_region);
    db.prepare('UPDATE characters SET tile_id = ?, current_hp = 1, gold = 40 WHERE id = ?').run(
      regionTile.id,
      doomedHero.id
    );

    const updatedDoomedHero = db.prepare('SELECT * FROM characters WHERE id = ?').get(doomedHero.id);
    let idx = 0;
    const seq = [0.10, 0.10, 0.90];
    const bountyEnc = checkTileEncounter(db, updatedDoomedHero, regionTile, { rng: () => seq[idx++] });
    investigateEncounter(db, doomedHero.id, bountyEnc.id, doomedHero.class);

    // Ensure monster has high HP and hero misses while monster hits (hero roll 0.01 -> miss, monster roll 0.99 -> hit)
    db.prepare("UPDATE encounters SET current_monster_hp = 50, initiative_winner = 'MONSTER' WHERE id = ?").run(bountyEnc.id);

    const deathRes = executeCombatRound(db, doomedHero.id, bountyEnc.id, 'ATTACK', {
      rng: () => 0.95, // Monster attacks first and hits
    });

    assert.equal(deathRes.encounter.status, 'DEFEAT', 'Hero at 1 HP must be slain by monster hit');

    // Verify contract is marked FAILED
    const failedContract = db.prepare('SELECT * FROM hunting_contracts WHERE id = ?').get(contract.id);
    assert.equal(failedContract.status, 'FAILED', 'Contract must be marked FAILED upon permadeath');

    // Verify Named Bounty killer was promoted to global monster_instances with custom_title and non-compounding HP
    const promotedInstance = db
      .prepare("SELECT * FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1")
      .get(regionTile.id);
    assert.ok(promotedInstance, 'Slayer Named Bounty monster must be promoted to monster_instances');
    assert.equal(
      promotedInstance.custom_title,
      contract.custom_name,
      'Promoted persistent monster must retain the Named Bounty custom_name in custom_title'
    );

    const expectedMaxHp = Math.max(Math.ceil(baseMonster.base_hp * 1.10), toughMaxHp);
    assert.equal(
      promotedInstance.max_hp,
      expectedMaxHp,
      'Promoted persistent monster max_hp must use Math.max(base*1.10, toughMaxHp) without double-compounding'
    );
    assert.equal(promotedInstance.current_hp, expectedMaxHp);
  });

  it('8. Wilderness Threats (System B): reports compass direction and kill count while strictly hiding monster species, custom name, coordinates, stats, and items', () => {
    const threats = getWildernessThreats(db);
    assert.ok(threats.length >= 1, 'Promoted persistent killer from test 7 must appear in Wilderness Threats');

    const latestThreat = threats[0];
    const validDirections = new Set([
      'North',
      'Northeast',
      'East',
      'Southeast',
      'South',
      'Southwest',
      'West',
      'Northwest',
      'In Oakhaven',
    ]);
    assert.ok(validDirections.has(latestThreat.direction), `Direction "${latestThreat.direction}" must be a valid compass direction`);
    assert.ok(latestThreat.killCount >= 1);
    assert.ok(latestThreat.severity && latestThreat.severity.length > 0);
    assert.ok(latestThreat.rumor && latestThreat.rumor.length > 10);

    // Strictly verify that no forbidden fields exist on the threat object
    const serialized = JSON.stringify(latestThreat);
    assert.equal(latestThreat.monster_name, undefined);
    assert.equal(latestThreat.custom_title, undefined);
    assert.equal(latestThreat.x, undefined);
    assert.equal(latestThreat.y, undefined);
    assert.equal(latestThreat.current_hp, undefined);
    assert.equal(latestThreat.max_hp, undefined);

    // Also verify custom_title from Test 7 is NOT leaked in the rumor text
    const promoted = db.prepare("SELECT custom_title FROM monster_instances WHERE status = 'ACTIVE' LIMIT 1").get();
    if (promoted && promoted.custom_title) {
      assert.ok(
        !serialized.includes(promoted.custom_title),
        'Wilderness Threat entry must never leak the persistent monster custom_title'
      );
    }
  });

  it("9. UI & View Rendering: renders The Watcher's Board (Section A & B), Named Bounty crimson frame in combat, Victory banner, and Oakhaven auto-claim alert without leaking hidden names or numbers", async () => {
    const app = require('../src/app');
    const { getMinimapData, getAvailableDirections } = require('../src/domain/world/map');
    const { formatModifier } = require('../src/domain/character/rules');

    const hero = createTestHero('Haldor the Bold', 2);
    const contracts = getOrGenerateContracts(db, hero);
    const threats = getWildernessThreats(db);

    const renderView = (viewName, locals) =>
      new Promise((resolve, reject) => {
        app.render(viewName, locals, (err, html) => (err ? reject(err) : resolve(html)));
      });

    const modifiers = {
      strength: formatModifier(hero.strength),
      constitution: formatModifier(hero.constitution),
      dexterity: formatModifier(hero.dexterity),
      intelligence: formatModifier(hero.intelligence),
      wisdom: formatModifier(hero.wisdom),
      charisma: formatModifier(hero.charisma),
    };

    // 9a. Render Oakhaven with The Watcher's Board modal open
    const boardHtml = await renderView('game', {
      currentUser: { id: 1, username: 'bounty_tester' },
      character: hero,
      currentTile: oakhavenTile,
      minimap: getMinimapData(db, oakhavenTile, 2),
      directions: getAvailableDirections(db, oakhavenTile),
      encounter: null,
      isSafeCity: true,
      bountyContracts: contracts,
      wildernessThreats: threats,
      activeContract: null,
      bountyClaimMessage: 'Bounty Completed: You slew Gorgan the One-Eyed (Goblin) in Verdant Plains and received 45 Gold from the Watchers of Oakhaven!',
      activeModal: 'bounties',
      modifiers,
      errorMessage: null,
      infoMessage: null,
    });

    assert.ok(boardHtml.includes("The Watcher's Board"), "Must render The Watcher's Board button and modal title");
    assert.ok(boardHtml.includes('A. Hunting Contracts'), 'Must render Section A: Hunting Contracts');
    assert.ok(boardHtml.includes('B. Threats in the Wilderness'), 'Must render Section B: Threats in the Wilderness');
    assert.ok(boardHtml.includes('alert-bounty-claimed'), 'Must render Oakhaven bounty auto-claim banner');

    // Verify custom_name of AVAILABLE contracts is NOT leaked on the board before identification
    for (const c of contracts) {
      assert.ok(
        !boardHtml.includes(c.custom_name),
        `Available contract custom_name "${c.custom_name}" must remain hidden on The Watcher's Board`
      );
    }

    // 9b. Accept a contract, engage the Named Bounty target in Stage 2 (IN_COMBAT), and verify crimson frame & custom name
    acceptContract(db, hero, contracts[0].id);
    const activeContract = getActiveContractForCharacter(db, hero.id);
    const regionTile = db
      .prepare("SELECT * FROM map_tiles WHERE name = ? AND terrain != 'CITY' AND is_passable = 1 LIMIT 1")
      .get(activeContract.target_region);

    let idx = 0;
    const seq = [0.10, 0.10, 0.90];
    const enc = checkTileEncounter(db, hero, regionTile, { rng: () => seq[idx++] });
    const combatEnc = investigateEncounter(db, hero.id, enc.id, hero.class);
    const combatState = getCombatState(db, hero.id, combatEnc.id);

    const combatHtml = await renderView('game', {
      currentUser: { id: 1, username: 'bounty_tester' },
      character: hero,
      currentTile: regionTile,
      minimap: getMinimapData(db, regionTile, 2),
      directions: getAvailableDirections(db, regionTile),
      encounter: combatEnc,
      combatState,
      isSafeCity: false,
      bountyContracts: [],
      wildernessThreats: [],
      activeContract,
      modifiers,
      errorMessage: null,
      infoMessage: null,
    });

    assert.ok(combatHtml.includes(activeContract.custom_name), 'Stage 2 combat HTML must display the custom bounty name');
    assert.ok(combatHtml.includes('bounty-art-frame'), 'Stage 2 combat HTML must apply the crimson .bounty-art-frame');
    assert.ok(combatHtml.includes('Wanted Quarry'), 'Stage 2 combat HTML must display the Wanted Quarry badge');

    // 9c. Defeat the Named Bounty target and verify Victory screen HTML
    db.prepare("UPDATE encounters SET current_monster_hp = 1, initiative_winner = 'HERO' WHERE id = ?").run(combatEnc.id);
    executeCombatRound(db, hero.id, combatEnc.id, 'ATTACK', { rng: () => 0.95 });
    const victoryData = getVictoryData(db, hero.id, combatEnc.id);
    const victoryHtml = await renderView('victory', victoryData);

    assert.ok(victoryHtml.includes('BOUNTY TARGET SLAIN'), 'Victory screen must render BOUNTY TARGET SLAIN heading');
    assert.ok(victoryHtml.includes(activeContract.custom_name), 'Victory screen must render custom bounty name');
    assert.ok(victoryHtml.includes('bounty-art-frame'), 'Victory screen must apply crimson .bounty-art-frame');
  });
});
