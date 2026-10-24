const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const http = require('node:http');
const app = require('../src/app');
const { initializeDatabase, setDb, closeDb, withTransaction } = require('../src/db/connection');
const { runMigrations, runSeeds } = require('../src/db/migrate');
const {
  createCharacter,
  getCharacterEquipment,
  getCharacterInventory,
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  useConsumable,
  performClericSelfHeal,
  performCityRest,
  getEffectiveStats,
  getRangerFavoredEnemyBonus
} = require('../src/domain/character/rules');
const {
  checkTileEncounter,
  getEncounterById,
  ignoreEncounter,
  investigateEncounter
} = require('../src/domain/encounters/engine');
const {
  startCombat,
  getCombatState,
  executeCombatRound
} = require('../src/domain/combat/engine');
const {
  calculateHeroAC,
  calculateHeroAttackBonus,
  getHeroDamageFormula
} = require('../src/domain/combat/rules');
const { sellItem } = require('../src/domain/economy/shop');

function setupTestDb() {
  const db = initializeDatabase(':memory:');
  runMigrations(db);
  runSeeds(db);
  setDb(db);
  return db;
}

function createTestUser(db, username = 'stab_hero') {
  const res = db.prepare(`
    INSERT INTO users (username, password_hash) VALUES (?, 'hash')
  `).run(username);
  return Number(res.lastInsertRowid);
}

function giveItemByName(db, characterId, itemName, equippedSlot = null) {
  const def = db.prepare('SELECT * FROM item_definitions WHERE name = ?').get(itemName);
  assert.ok(def, `Item definition "${itemName}" must exist in DB`);
  const res = db.prepare(`
    INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id, equipped_slot)
    VALUES (?, 'CHARACTER', ?, ?)
  `).run(def.id, characterId, equippedSlot);
  return { instanceId: Number(res.lastInsertRowid), definition: def };
}

function createHttpClient(baseUrl) {
  let cookieHeader = '';
  let csrfToken = '';

  function updateCookies(setCookieHeaders) {
    if (!setCookieHeaders) return;
    const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    const map = new Map();
    if (cookieHeader) {
      for (const pair of cookieHeader.split(';')) {
        const [k, v] = pair.trim().split('=');
        if (k) map.set(k, v);
      }
    }
    for (const c of cookies) {
      const firstPart = c.split(';')[0];
      const [k, v] = firstPart.trim().split('=');
      if (k) map.set(k, v);
    }
    cookieHeader = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  function extractCsrf(html) {
    const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
    if (match) csrfToken = match[1];
  }

  async function request(method, path, bodyObj = null, followRedirect = false) {
    const headers = {};
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    let payload = null;
    if (bodyObj) {
      const withCsrf = { _csrf: csrfToken, ...bodyObj };
      payload = new URLSearchParams(withCsrf).toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: payload,
      redirect: 'manual'
    });

    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie');
    updateCookies(setCookie);
    const text = await res.text();
    extractCsrf(text);
    const location = res.headers.get('location');

    if (followRedirect && location && [301, 302, 303].includes(res.status)) {
      return request('GET', location, null, true);
    }

    return { status: res.status, text, location };
  }

  return { request, getCsrfToken: () => csrfToken };
}

test('Section 2: CR & Loot — Full combat flow preserves CR (0.25, 1, 3, 5), treasure_type, and specialized loot tables without duplication', () => {
  const db = setupTestDb();
  try {
    const userId = createTestUser(db, 'cr_loot_tester');
    const hero = createCharacter(db, {
      userId,
      name: 'CrSlayer',
      classType: 'FIGHTER',
      stats: { strength: 18, constitution: 14, dexterity: 12, intelligence: 11, wisdom: 9, charisma: 8 }
    });
    // Boost hero so 1 hit kills target in executeCombatRound
    db.prepare('UPDATE characters SET level = 9, strength = 18, current_hp = 120, max_hp = 120 WHERE id = ?').run(hero.id);

    const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();

    // 1. CR 0.25 monster with Standard/Incidental treasure
    const cr025Monster = db.prepare("SELECT * FROM monsters WHERE challenge_rating = 0.25 AND treasure_type != 'None' AND creature_type != 'ANIMAL' LIMIT 1").get();
    assert.ok(cr025Monster, 'CR 0.25 non-animal monster with treasure must exist');

    const enc025Id = Number(db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round, spotted_by_hero, is_ambush)
      VALUES (?, ?, ?, 'DISCOVERED', 1, ?, 0, 1, 0)
    `).run(hero.id, wildTile.id, cr025Monster.id, cr025Monster.base_hp).lastInsertRowid);

    const started025 = startCombat(db, hero.id, enc025Id, { rng: () => 0.9 });
    assert.equal(started025.encounter.challenge_rating, 0.25, 'startCombat must preserve fractional CR 0.25');
    assert.equal(started025.encounter.treasure_type, cr025Monster.treasure_type, 'startCombat must include treasure_type');

    db.prepare('UPDATE encounters SET current_monster_hp = 1 WHERE id = ?').run(enc025Id);
    const goldBefore025 = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
    // rng = 0.01 triggers hit & gold/item drops, and picks lowest gold in CR 0.25 range (1..5 gp)
    const round025 = executeCombatRound(db, hero.id, enc025Id, 'ATTACK', { rng: () => 0.1 });
    assert.equal(round025.encounter.status, 'VICTORY');
    const goldAfter025 = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
    const earned025 = goldAfter025 - goldBefore025;
    assert.ok(earned025 >= 1 && earned025 <= 10, `CR 0.25 gold reward (${earned025}) must stay within CR 0.25 tier`);

    // 2. CR 1, CR 3, CR 5 monsters: verify executeCombatRound passes true CR and treasure_type to loot generation
    const cr1Monster = db.prepare("SELECT * FROM monsters WHERE challenge_rating = 1 LIMIT 1").get();
    const cr3Monster = db.prepare("SELECT * FROM monsters WHERE challenge_rating = 3 LIMIT 1").get();
    const cr5Monster = db.prepare("SELECT * FROM monsters WHERE challenge_rating = 5 LIMIT 1").get();

    assert.ok(cr1Monster && cr3Monster && cr5Monster, 'CR 1, CR 3, and CR 5 monsters must exist');

    function fightAndSlayWithHighRoll(monsterRow) {
      // Ensure standard treasure type and HUMANOID creature_type for deterministic comparison of CR gold scaling
      db.prepare("UPDATE monsters SET treasure_type = 'Standard', creature_type = 'HUMANOID' WHERE id = ?").run(monsterRow.id);
      const encId = Number(db.prepare(`
        INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round, spotted_by_hero, is_ambush, initiative_winner)
        VALUES (?, ?, ?, 'IN_COMBAT', 1, ?, 1, 1, 0, 'HERO')
      `).run(hero.id, wildTile.id, monsterRow.id, monsterRow.base_hp).lastInsertRowid);

      const beforeGold = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
      const beforeItems = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_type = 'CHARACTER' AND owner_character_id = ?").get(hero.id).c;

      // Custom RNG: high roll (0.95) for attack & damage, low roll (0.001) for loot chance checks, high roll (0.99) for gold amount roll
      let callIdx = 0;
      const customRng = () => {
        callIdx++;
        // Calls 1-2: attack d20 (0.90 -> 19, non-crit hit) & damage die -> 0.90 (guaranteed kill on 1 HP)
        if (callIdx <= 2) return 0.90;
        // Call 3: goldChance check -> 0.01 (passes)
        if (callIdx === 3) return 0.01;
        // Call 4: calculateMonsterGold amount -> 0.99 (near max of CR bracket!)
        if (callIdx === 4) return 0.99;
        // Call 5: normal item chance -> 0.01 (passes)
        if (callIdx === 5) return 0.01;
        // Call 6: weighted item pick -> 0.5
        if (callIdx === 6) return 0.5;
        // Call 7: magic item chance -> 0.99 (skip magic item)
        return 0.99;
      };

      const state = executeCombatRound(db, hero.id, encId, 'ATTACK', { rng: customRng, expectedRound: 1 });
      assert.equal(state.encounter.status, 'VICTORY');

      // Verify idempotency / duplicate submission protection: repeating round 1 after VICTORY is rejected and awards 0 extra gold/items
      assert.throws(() => {
        executeCombatRound(db, hero.id, encId, 'ATTACK', { rng: customRng, expectedRound: 1 });
      }, /VICTORY/);

      const afterGold = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
      const afterItems = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_type = 'CHARACTER' AND owner_character_id = ?").get(hero.id).c;
      const victoryEvents = db.prepare("SELECT COUNT(*) as c FROM combat_events WHERE encounter_id = ? AND event_type = 'VICTORY'").get(encId).c;
      assert.equal(victoryEvents, 1, 'VICTORY event must be recorded exactly once');

      return { goldEarned: afterGold - beforeGold, itemsEarned: afterItems - beforeItems };
    }

    const resCr1 = fightAndSlayWithHighRoll(cr1Monster);
    const resCr3 = fightAndSlayWithHighRoll(cr3Monster);
    const resCr5 = fightAndSlayWithHighRoll(cr5Monster);

    // CR 1 max base gold is 10, CR 3 max base gold is 30, CR 5 max base gold is 70 (scaled by loot table multiplier)
    assert.ok(resCr3.goldEarned > resCr1.goldEarned, `CR 3 gold (${resCr3.goldEarned}) must exceed CR 1 gold (${resCr1.goldEarned})`);
    assert.ok(resCr5.goldEarned > resCr3.goldEarned, `CR 5 gold (${resCr5.goldEarned}) must exceed CR 3 gold (${resCr3.goldEarned})`);
    assert.equal(resCr1.itemsEarned, 1);
    assert.equal(resCr3.itemsEarned, 1);
    assert.equal(resCr5.itemsEarned, 1);

    // 3. Monster with treasure_type = 'None' awards 0 gold and 0 items in executeCombatRound
    const noneMonster = db.prepare("SELECT * FROM monsters WHERE treasure_type = 'None' LIMIT 1").get();
    assert.ok(noneMonster, 'Monster with treasure_type = None must exist');
    const encNoneId = Number(db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round, spotted_by_hero, is_ambush, initiative_winner)
      VALUES (?, ?, ?, 'IN_COMBAT', 1, ?, 1, 1, 0, 'HERO')
    `).run(hero.id, wildTile.id, noneMonster.id, noneMonster.base_hp).lastInsertRowid);

    const goldBeforeNone = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
    const itemsBeforeNone = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_type = 'CHARACTER' AND owner_character_id = ?").get(hero.id).c;
    executeCombatRound(db, hero.id, encNoneId, 'ATTACK', { rng: () => 0.95 });
    const goldAfterNone = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
    const itemsAfterNone = db.prepare("SELECT COUNT(*) as c FROM item_instances WHERE owner_type = 'CHARACTER' AND owner_character_id = ?").get(hero.id).c;
    assert.equal(goldAfterNone - goldBeforeNone, 0, 'Monster with treasure_type=None must never drop gold in combat');
    assert.equal(itemsAfterNone - itemsBeforeNone, 0, 'Monster with treasure_type=None must never drop items in combat');
  } finally {
    closeDb();
  }
});

test('Section 3 & Section 8: JavaScript & Modal System — Valid rendered JS, no HTML-entity corruption, and full HTTP modal round-trips', async () => {
  const db = setupTestDb();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const client = createHttpClient(baseUrl);
    await client.request('GET', '/register');
    await client.request('POST', '/register', {
      username: 'modal_hero',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });

    await client.request('GET', '/character/create');
    await client.request('POST', '/character/create', {
      name: 'ModalTester',
      classType: 'FIGHTER',
      strength: '16',
      constitution: '15',
      dexterity: '12',
      intelligence: '11',
      wisdom: '10',
      charisma: '8',
      primaryWeapon: 'MELEE'
    });

    const hero = db.prepare("SELECT * FROM characters WHERE name = 'ModalTester'").get();
    assert.ok(hero);
    db.prepare('UPDATE characters SET gold = 500, current_hp = 5 WHERE id = ?').run(hero.id);

    // Give a two-handed weapon & ranged weapon to test shield disabled span HTML rendering
    const greatsword = giveItemByName(db, hero.id, 'Greatsword');

    // Helper that extracts <script> blocks from rendered HTML and executes them in a real VM context
    function verifyRenderedScriptAndHtml(html, expectedInitialModal) {
      assert.ok(!html.includes('var initialModal = &#34;'), 'initialModal must never contain HTML-escaped quotes (&#34;)');
      assert.ok(!html.includes('&lt;span style='), 'Protection summary must never contain escaped <span> markup');
      assert.ok(!html.includes('disabled title=&#34;'), 'Button attributes must never contain &#34;');

      const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
      assert.ok(scriptMatches.length > 0, 'Page must include inline modal script');

      for (const match of scriptMatches) {
        const code = match[1];
        // 1. Parse syntax with vm.Script (throws SyntaxError if broken)
        assert.doesNotThrow(() => new vm.Script(code), 'Rendered <script> must be syntactically valid JavaScript');

        if (code.includes('function openGameModal')) {
          // 2. Execute in simulated DOM to verify openGameModal, closeGameModal, Escape key, and backdrop click
          const mockModals = {
            character: { hidden: true, attrs: {}, focusable: { focused: false, focus() { this.focused = true; } }, querySelector() { return this.focusable; }, setAttribute(k, v) { this.attrs[k] = v; } },
            backpack: { hidden: true, attrs: {}, focusable: { focused: false, focus() { this.focused = true; } }, querySelector() { return this.focusable; }, setAttribute(k, v) { this.attrs[k] = v; } },
            market: { hidden: true, attrs: {}, focusable: { focused: false, focus() { this.focused = true; } }, querySelector() { return this.focusable; }, setAttribute(k, v) { this.attrs[k] = v; } },
            journal: { hidden: true, attrs: {}, focusable: { focused: false, focus() { this.focused = true; } }, querySelector() { return this.focusable; }, setAttribute(k, v) { this.attrs[k] = v; } }
          };
          const classes = new Set();
          const mockBackdrop = {
            id: 'game-modal-backdrop',
            hidden: true,
            classList: {
              add(c) { classes.add(c); },
              remove(c) { classes.delete(c); },
              contains(c) { return classes.has(c); }
            },
            querySelectorAll() { return Object.values(mockModals); }
          };
          const listeners = {};
          const sandbox = {
            document: {
              activeElement: { focus() {} },
              getElementById(id) {
                if (id === 'game-modal-backdrop') return mockBackdrop;
                if (id.startsWith('modal-')) return mockModals[id.replace('modal-', '')] || null;
                return null;
              },
              addEventListener(evt, fn) { listeners[evt] = fn; }
            },
            window: {
              location: { pathname: '/game', search: expectedInitialModal ? `?modal=${expectedInitialModal}` : '', hash: '' },
              history: { replaceState() {} }
            }
          };

          vm.runInNewContext(code, sandbox);
          assert.ok(listeners.DOMContentLoaded, 'DOMContentLoaded listener must be registered');
          listeners.DOMContentLoaded();

          if (expectedInitialModal) {
            assert.equal(mockBackdrop.hidden, false, `Backdrop must be visible when modal=${expectedInitialModal}`);
            assert.equal(mockBackdrop.classList.contains('is-active'), true, 'Backdrop must have is-active class');
            assert.equal(mockModals[expectedInitialModal].hidden, false, `Modal ${expectedInitialModal} must be visible`);

            // Test Escape key closes modal
            listeners.keydown({ key: 'Escape' });
            assert.equal(mockBackdrop.hidden, true, 'Escape key must close modal');
            assert.equal(mockBackdrop.classList.contains('is-active'), false, 'Escape key must remove is-active');

            // Re-open and test backdrop click
            sandbox.openGameModal(expectedInitialModal);
            assert.equal(mockBackdrop.hidden, false);
            sandbox.handleBackdropClick({ target: { id: 'game-modal-backdrop' } });
            assert.equal(mockBackdrop.hidden, true, 'Clicking backdrop must close modal');

            // Re-open and test X button (closeGameModal)
            sandbox.openGameModal(expectedInitialModal);
            sandbox.closeGameModal();
            assert.equal(mockBackdrop.hidden, true, 'closeGameModal() (X button) must close modal');
          } else {
            assert.equal(mockBackdrop.hidden, true, 'Backdrop must remain hidden when no valid modal is active');
          }
        }
      }
    }

    // 1. Open Backpack modal
    const bpPage = await client.request('GET', '/game?modal=backpack');
    assert.equal(bpPage.status, 200);
    verifyRenderedScriptAndHtml(bpPage.text, 'backpack');

    // 2. Equip Greatsword (two-handed) via POST and follow redirect to /game?modal=backpack
    const equipRes = await client.request('POST', '/game/inventory/equip', {
      itemInstanceId: String(greatsword.instanceId),
      targetSlot: 'MELEE',
      returnModal: 'backpack'
    }, true);
    verifyRenderedScriptAndHtml(equipRes.text, 'backpack');
    assert.ok(equipRes.text.includes('(Shield disabled with two-handed weapon)'), 'Must render unescaped two-handed shield disabled notice');

    // 3. Unequip Greatsword via POST
    const unequipRes = await client.request('POST', '/game/inventory/unequip', {
      itemInstanceId: String(greatsword.instanceId),
      returnModal: 'backpack'
    }, true);
    verifyRenderedScriptAndHtml(unequipRes.text, 'backpack');

    // 4. Use Healing Potion from Backpack via POST
    const potion = db.prepare(`
      SELECT ii.id FROM item_instances ii
      JOIN item_definitions id ON ii.item_definition_id = id.id
      WHERE ii.owner_character_id = ? AND id.category = 'POTION' LIMIT 1
    `).get(hero.id);
    const useRes = await client.request('POST', '/game/inventory/use', {
      itemInstanceId: String(potion.id),
      returnModal: 'backpack'
    }, true);
    verifyRenderedScriptAndHtml(useRes.text, 'backpack');

    // 5. Open Market modal, buy an item, and sell an item
    const marketPage = await client.request('GET', '/game?modal=market');
    verifyRenderedScriptAndHtml(marketPage.text, 'market');

    const daggerDef = db.prepare("SELECT id FROM item_definitions WHERE name = 'Dagger'").get();
    const buyRes = await client.request('POST', '/game/shop/buy', {
      itemDefinitionId: String(daggerDef.id),
      returnModal: 'market'
    }, true);
    verifyRenderedScriptAndHtml(buyRes.text, 'market');

    const daggerInst = db.prepare(`
      SELECT id FROM item_instances WHERE owner_character_id = ? AND item_definition_id = ? AND equipped_slot IS NULL LIMIT 1
    `).get(hero.id, daggerDef.id);
    const sellRes = await client.request('POST', '/game/shop/sell', {
      itemInstanceId: String(daggerInst.id),
      returnModal: 'market'
    }, true);
    verifyRenderedScriptAndHtml(sellRes.text, 'market');

    // 6. Open Character modal and change Primary Weapon Preference to RANGED
    const charPage = await client.request('GET', '/game?modal=character');
    verifyRenderedScriptAndHtml(charPage.text, 'character');

    const prefRes = await client.request('POST', '/game/character/primary-weapon', {
      primaryWeapon: 'RANGED',
      returnModal: 'character'
    }, true);
    verifyRenderedScriptAndHtml(prefRes.text, 'character');
    assert.ok(prefRes.text.includes('(Shield disabled with ranged)'), 'Must render unescaped ranged shield disabled notice');

    // 7. XSS attempt in modal query param is neutralized by whitelist
    const xssRes = await client.request('GET', '/game?modal=' + encodeURIComponent('backpack";alert(1);//'));
    verifyRenderedScriptAndHtml(xssRes.text, null);
  } finally {
    await new Promise(resolve => server.close(resolve));
    closeDb();
  }
});

test('Section 4: Ranger Favored Enemy & Opening Shot — All humanoid subtypes work in real combat and Opening Shot obeys strict 4-part condition', () => {
  const db = setupTestDb();
  try {
    const subtypesToTest = ['goblinoid', 'orc', 'gnoll', 'reptilian'];
    const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();

    for (const subtype of subtypesToTest) {
      const userId = createTestUser(db, `ranger_${subtype}`);
      const ranger = createCharacter(db, {
        userId,
        name: `Ranger_${subtype}`,
        classType: 'RANGER',
        stats: { strength: 14, constitution: 12, dexterity: 16, intelligence: 11, wisdom: 11, charisma: 8 },
        favoredEnemyType: 'HUMANOID',
        favoredEnemySubtype: subtype
      });

      const monster = db.prepare(`
        SELECT * FROM monsters
        WHERE UPPER(creature_type) = 'HUMANOID' AND LOWER(creature_subtype) = ?
        LIMIT 1
      `).get(subtype);
      assert.ok(monster, `Monster with HUMANOID:${subtype} must exist in DB`);

      // Verify bonus in startCombat & executeCombatRound
      const encId = Number(db.prepare(`
        INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round, spotted_by_hero, is_ambush)
        VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, 1, 0)
      `).run(ranger.id, wildTile.id, monster.id, monster.base_hp + 50, monster.base_hp + 50).lastInsertRowid);

      const started = startCombat(db, ranger.id, encId, { rng: () => 0.8 });
      assert.equal(started.encounter.creature_subtype.toLowerCase(), subtype, 'Combat encounter must include creature_subtype');
      assert.equal(started.openingShotFired, true, 'Ranger who spotted enemy first with ranged weapon must fire Opening Shot');

      const equip = getCharacterEquipment(db, ranger.id);
      const effHero = getEffectiveStats(ranger, equip);
      const abWithFavored = calculateHeroAttackBonus(effHero, equip.rangedWeapon, started.encounter);
      const nonMatchingMonster = { ...started.encounter, creature_subtype: 'other_humanoid' };
      const abWithoutFavored = calculateHeroAttackBonus(effHero, equip.rangedWeapon, nonMatchingMonster);
      assert.equal(abWithFavored - abWithoutFavored, 2, `Ranger must gain +2 attack (Option A) against HUMANOID:${subtype} in real combat`);

      const dmgFormulaFavored = getHeroDamageFormula(effHero, equip.rangedWeapon, started.encounter);
      const dmgFormulaNonFavored = getHeroDamageFormula(effHero, equip.rangedWeapon, nonMatchingMonster);
      assert.notEqual(dmgFormulaFavored, dmgFormulaNonFavored, `Ranger damage formula must include +1 against HUMANOID:${subtype}`);
    }

    // Animal / Beast equivalence test
    const beastUserId = createTestUser(db, 'ranger_beast');
    const beastRanger = createCharacter(db, {
      userId: beastUserId,
      name: 'BeastTracker',
      classType: 'RANGER',
      stats: { strength: 14, constitution: 12, dexterity: 16, intelligence: 11, wisdom: 11, charisma: 8 },
      favoredEnemyType: 'BEAST'
    });
    const wolf = db.prepare("SELECT * FROM monsters WHERE UPPER(creature_type) = 'ANIMAL' LIMIT 1").get();
    assert.equal(getRangerFavoredEnemyBonus(beastRanger, wolf).attack, 2, 'BEAST/ANIMAL Favored Enemy must match ANIMAL monsters with +2 Option A bonus');

    // Undead strictly forbidden
    assert.throws(() => {
      createCharacter(db, {
        userId: createTestUser(db, 'ranger_undead_fail'),
        name: 'UndeadHunter',
        classType: 'RANGER',
        stats: { strength: 14, constitution: 12, dexterity: 16, intelligence: 11, wisdom: 11, charisma: 8 },
        favoredEnemyType: 'UNDEAD'
      });
    }, /Undead is not permitted/i);
    const skeleton = db.prepare("SELECT * FROM monsters WHERE UPPER(creature_type) = 'UNDEAD' LIMIT 1").get();
    assert.equal(getRangerFavoredEnemyBonus({ ...beastRanger, favored_enemy_type: 'UNDEAD' }, skeleton).attack, 0);

    // Opening Shot negative conditions:
    // Condition A: Level 1 Ranger fails perception (spotted_by_hero = 0, is_ambush = 1 under Phase 9B) -> NO Opening Shot!
    const encUnspotted = checkTileEncounter(db, beastRanger, wildTile, {
      forcedChance: 100,
      rng: () => 0.1,
      ambushRng: () => 0.0 // d20 = 1 -> fails perception
    });
    assert.ok(encUnspotted);
    assert.equal(encUnspotted.isAmbush, true, 'Phase 9B: Level 1 Ranger failing perception is ambushed');
    assert.equal(encUnspotted.spottedByHero, false, 'Failed perception must set spottedByHero = false');

    const startedUnspotted = startCombat(db, beastRanger.id, encUnspotted.id, { rng: () => 0.5 });
    assert.equal(startedUnspotted.openingShotFired, false, 'Opening Shot must NOT fire when Ranger did not spot the monster first');

    // Resolve encUnspotted before creating next encounter for beastRanger
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encUnspotted.id);

    // Condition B: Ranger without prepared ranged weapon -> NO Opening Shot!
    const equipNow = getCharacterEquipment(db, beastRanger.id);
    db.prepare('UPDATE item_instances SET equipped_slot = NULL WHERE id = ?').run(equipNow.rangedWeapon.id);
    const encNoBow = checkTileEncounter(db, beastRanger, wildTile, {
      forcedChance: 100,
      rng: () => 0.1,
      ambushRng: () => 0.99 // spots monster
    });
    const startedNoBow = startCombat(db, beastRanger.id, encNoBow.id, { rng: () => 0.5 });
    assert.equal(startedNoBow.openingShotFired, false, 'Opening Shot must NOT fire without a prepared ranged weapon');
  } finally {
    closeDb();
  }
});

test('Section 5: Magical Equipment, AC & Character Sheet — Ring of Protection +1, Amulet of Natural Armor +1, and Belt of Giant Strength +2 work end-to-end', () => {
  const db = setupTestDb();
  try {
    const userId = createTestUser(db, 'magic_gear_user');
    const hero = createCharacter(db, {
      userId,
      name: 'SirGalahad',
      classType: 'FIGHTER',
      stats: { strength: 16, constitution: 15, dexterity: 12, intelligence: 11, wisdom: 10, charisma: 8 }
    });

    // Base Fighter: DEX 12 (+1), Chain Shirt (+4), Light Steel Shield (+1) => AC 16
    const baseEquip = getCharacterEquipment(db, hero.id);
    const baseEff = getEffectiveStats(hero, baseEquip);
    assert.equal(calculateHeroAC(baseEff, baseEquip, false, null, baseEquip.meleeWeapon), 16);
    assert.equal(calculateHeroAC(baseEff, baseEquip.armor, baseEquip.shield, false, null, baseEquip.meleeWeapon), 16);

    // Grant Ring of Protection +1, Amulet of Natural Armor +1, and Belt of Giant Strength +2
    const ring = giveItemByName(db, hero.id, 'Ring of Protection +1');
    const amulet = giveItemByName(db, hero.id, 'Amulet of Natural Armor +1');
    const belt = giveItemByName(db, hero.id, 'Belt of Giant Strength +2');
    const garnet = giveItemByName(db, hero.id, 'Uncut Garnet');

    // Non-equippable treasure must be rejected from accessory slots
    assert.throws(() => equipItem(db, hero.id, garnet.instanceId, 'RING'), /cannot be equipped/i);

    equipItem(db, hero.id, ring.instanceId, 'RING');
    equipItem(db, hero.id, amulet.instanceId, 'NECK');
    equipItem(db, hero.id, belt.instanceId, 'BELT');

    const boostedEquip = getCharacterEquipment(db, hero.id);
    const boostedHero = getEffectiveStats(hero, boostedEquip);

    // Base STR in DB must remain 16, effective STR must be 18
    const dbHeroRow = db.prepare('SELECT strength FROM characters WHERE id = ?').get(hero.id);
    assert.equal(dbHeroRow.strength, 16, 'Base strength in SQLite must not be mutated');
    assert.equal(boostedHero.strength, 18, 'Effective strength with Belt of Giant Strength +2 must be 18');
    assert.equal(boostedHero.is_str_boosted, true);

    // AC must now be 16 + 1 (Ring) + 1 (Amulet) = 18 across BOTH call signatures AND in real combat
    assert.equal(calculateHeroAC(boostedHero, boostedEquip, false, null, boostedEquip.meleeWeapon), 18);
    assert.equal(calculateHeroAC(boostedHero, boostedEquip.armor, boostedEquip.shield, false, null, boostedEquip.meleeWeapon), 18);

    // Ranged weapon suppresses shield (+1) -> AC 17 (keeps Ring +1 and Amulet +1)
    assert.equal(calculateHeroAC(boostedHero, boostedEquip, true, null, boostedEquip.rangedWeapon), 17);

    // Verify in real combat state (startCombat -> getCombatState -> executeCombatRound)
    const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
    const goblin = db.prepare("SELECT * FROM monsters WHERE name = 'Goblin' LIMIT 1").get();
    const encId = Number(db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round, spotted_by_hero, is_ambush)
      VALUES (?, ?, ?, 'DISCOVERED', 25, 25, 0, 1, 0)
    `).run(hero.id, wildTile.id, goblin.id).lastInsertRowid);

    const combatState = startCombat(db, hero.id, encId, { rng: () => 0.5 });
    assert.equal(combatState.heroAC, 19, 'getCombatState must include Ring +1, Amulet +1, and Fighter Know Your Enemy +1 AC vs Goblin in heroAC');
    assert.equal(combatState.character.strength, 18, 'getCombatState must expose effective STR 18');

    // End combat to test unequipping
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(encId);
    unequipItem(db, hero.id, ring.instanceId);
    unequipItem(db, hero.id, amulet.instanceId);
    unequipItem(db, hero.id, belt.instanceId);

    const afterUnequip = getCharacterEquipment(db, hero.id);
    const afterEff = getEffectiveStats(hero, afterUnequip);
    assert.equal(afterEff.strength, 16, 'STR bonus must disappear when Belt is unequipped');
    assert.equal(calculateHeroAC(afterEff, afterUnequip, false, null, afterUnequip.meleeWeapon), 16, 'AC bonuses must disappear when Ring and Amulet are unequipped');
  } finally {
    closeDb();
  }
});

test('Section 6: Encounter Secrecy & DISCOVERED Lock — No Hero Panel stat leaks and no equipment/consumable/heal exploits while DISCOVERED', async () => {
  const db = setupTestDb();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const client = createHttpClient(baseUrl);
    await client.request('GET', '/register');
    await client.request('POST', '/register', {
      username: 'secrecy_cleric',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });

    await client.request('GET', '/character/create');
    await client.request('POST', '/character/create', {
      name: 'BrotherThomas',
      classType: 'CLERIC',
      strength: '14',
      constitution: '13',
      dexterity: '8',
      intelligence: '11',
      wisdom: '15',
      charisma: '11',
      primaryWeapon: 'MELEE'
    });

    const cleric = db.prepare("SELECT * FROM characters WHERE name = 'BrotherThomas'").get();
    assert.ok(cleric, 'Cleric BrotherThomas must be created');
    db.prepare('UPDATE characters SET current_hp = 5 WHERE id = ?').run(cleric.id);
    const spareMace = giveItemByName(db, cleric.id, 'Light Mace');

    // 1. Baseline peaceful Hero Panel stats (Cleric L1: STR 14 (+2 melee), DEX 8 (-1 ranged))
    const peacefulPage = await client.request('GET', '/game');
    assert.ok(peacefulPage.text.includes('Active: 🗡️ Melee'), 'Peaceful Cleric must show Active: Melee');
    assert.ok(peacefulPage.text.includes('⚔️ +3 • 🏹 +0'), 'Peaceful Cleric (BAB +1 at L1) must show baseline +3 melee / +0 ranged attack');

    // 2. Create a DISCOVERED encounter with a FLYING UNDEAD monster
    const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();
    const undeadMonster = db.prepare("SELECT * FROM monsters WHERE UPPER(creature_type) = 'UNDEAD' LIMIT 1").get();
    db.prepare("UPDATE monsters SET movement_type = 'FLY' WHERE id = ?").run(undeadMonster.id);

    const encId = Number(db.prepare(`
      INSERT INTO encounters (character_id, tile_id, monster_id, status, current_monster_hp, monster_max_hp, combat_round, spotted_by_hero, is_ambush)
      VALUES (?, ?, ?, 'DISCOVERED', ?, ?, 0, 1, 0)
    `).run(cleric.id, wildTile.id, undeadMonster.id, undeadMonster.base_hp, undeadMonster.base_hp).lastInsertRowid);

    // Fetch /game while DISCOVERED:
    // - Must NOT leak flying or Undead status in Hero Panel while DISCOVERED
    const discoveredPage = await client.request('GET', '/game');
    assert.ok(discoveredPage.text.includes('Active: 🗡️ Melee'), 'DISCOVERED state must NOT leak flying status');
    assert.ok(discoveredPage.text.includes('⚔️ +3 • 🏹 +0'), 'DISCOVERED state must NOT leak Undead status via Holy Radiance attack bonus');

    // 3. Server-side & HTTP locks while DISCOVERED:
    const equip = getCharacterEquipment(db, cleric.id);
    const potion = db.prepare(`
      SELECT ii.id FROM item_instances ii
      JOIN item_definitions id ON ii.item_definition_id = id.id
      WHERE ii.owner_character_id = ? AND id.category = 'POTION' LIMIT 1
    `).get(cleric.id);

    assert.throws(() => equipItem(db, cleric.id, spareMace.instanceId, 'MELEE'), /unresolved encounter|combat/i);
    assert.throws(() => unequipItem(db, cleric.id, equip.meleeWeapon.id), /unresolved encounter|combat/i);
    assert.throws(() => setPrimaryWeaponPreference(db, cleric.id, 'RANGED'), /unresolved encounter|combat/i);
    assert.throws(() => useConsumable(db, cleric.id, potion.id), /unresolved encounter|combat/i);
    assert.throws(() => performClericSelfHeal(db, cleric.id), /unresolved encounter|combat/i);
    assert.throws(() => performCityRest(db, cleric.id), /unresolved encounter|combat/i);

    // 4. Once Investigated -> IN_COMBAT: monster is revealed, Melee preference stays Melee (-1 Evasive Flyer) and Holy Radiance (+2 Atk, +2 AC) applies!
    await client.request('POST', '/game/encounter/investigate', { encounterId: String(encId) });
    const combatPage = await client.request('GET', '/game');
    assert.ok(combatPage.text.includes('Active: 🗡️ Melee'), 'IN_COMBAT must preserve Melee stance and shield against flying monster');
    assert.ok(combatPage.text.includes('⚔️ +4 • 🏹 +2'), 'IN_COMBAT must apply Cleric Holy Radiance (+2 Atk vs Undead) and -1 melee Evasive Flyer penalty');
  } finally {
    await new Promise(resolve => server.close(resolve));
    closeDb();
  }
});

test('Section 7: Phase 9B Owner Decision — Level 1 Ambush Protection Removed (Level 1 heroes face Ambush & 2-round flee lock identical to Level 2+)', () => {
  const db = setupTestDb();
  try {
    const userId = createTestUser(db, 'lvl1_ambush_enabled');
    const hero = createCharacter(db, {
      userId,
      name: 'RookieFighter',
      classType: 'FIGHTER',
      stats: { strength: 16, constitution: 15, dexterity: 12, intelligence: 11, wisdom: 10, charisma: 8 }
    });

    const wildTile = db.prepare("SELECT * FROM map_tiles WHERE is_safe = 0 AND is_passable = 1 LIMIT 1").get();

    // 1. Random encounter at Level 1 with failed perception roll (d20 = 1) triggers Ambush!
    const enc1 = checkTileEncounter(db, hero, wildTile, {
      forcedChance: 100,
      rng: () => 0.2,
      ambushRng: () => 0.0
    });
    assert.ok(enc1);
    assert.equal(enc1.isAmbush, true, 'Level 1 random encounter with failed perception must set isAmbush = true');
    assert.equal(enc1.is_ambush, 1);

    // 2. Level 1 hero cannot bypass an Ambush via ignoreEncounter
    assert.throws(
      () => ignoreEncounter(db, hero.id, enc1.id),
      /Ambush! Your path is cut off/,
      'Level 1 Ambush must block free bypass'
    );

    // 3. getEncounterById and startCombat preserve is_ambush = 1 for Level 1 character and enforce 2-round flee lock
    const fetched1 = getEncounterById(db, enc1.id, hero.class);
    assert.equal(fetched1.isAmbush, true, 'getEncounterById must preserve is_ambush=1 for Level 1 character');

    const started1 = startCombat(db, hero.id, enc1.id, { rng: () => 0.5 });
    assert.equal(Number(started1.encounter.is_ambush), 1, 'startCombat must preserve is_ambush = 1 for Level 1 character');

    assert.throws(
      () => executeCombatRound(db, hero.id, enc1.id, 'FLEE', { rng: () => 0.5 }),
      /AMBUSH! You cannot flee during the first 2 combat rounds/,
      'Level 1 Ambush must enforce the 2-round flee lock on Round 1'
    );

    // 4. Level 1 hero can still lose combat and die permanently
    db.prepare('UPDATE characters SET current_hp = 1 WHERE id = ?').run(hero.id);
    db.prepare("UPDATE encounters SET initiative_winner = 'MONSTER', current_monster_hp = 50 WHERE id = ?").run(enc1.id);
    const deathState = executeCombatRound(db, hero.id, enc1.id, 'ATTACK', { rng: () => 0.9 });
    assert.equal(deathState.character.is_alive, 0, 'Level 1 hero can still die in combat');

    // 5. At Level 2, Ambush works identically when perception fails
    const user2Id = createTestUser(db, 'lvl2_ambush_user');
    const heroLvl2 = createCharacter(db, {
      userId: user2Id,
      name: 'VeteranFighter',
      classType: 'FIGHTER',
      stats: { strength: 16, constitution: 15, dexterity: 12, intelligence: 11, wisdom: 10, charisma: 8 }
    });
    db.prepare('UPDATE characters SET level = 2, xp = 300 WHERE id = ?').run(heroLvl2.id);
    const updatedLvl2 = db.prepare('SELECT * FROM characters WHERE id = ?').get(heroLvl2.id);

    const encLvl2 = checkTileEncounter(db, updatedLvl2, wildTile, {
      forcedChance: 100,
      rng: () => 0.2,
      ambushRng: () => 0.0 // d20 = 1 -> fails perception -> Ambush!
    });
    assert.ok(encLvl2);
    assert.equal(encLvl2.isAmbush, true, 'Level 2 character who fails perception must be ambushed as normal');
    assert.equal(encLvl2.is_ambush, 1);
  } finally {
    closeDb();
  }
});

test('Section 9 & Section 10: Treasure sell prices match DB/UI and DB seed tracking + WeakMap transactions are isolated', () => {
  const db = setupTestDb();
  try {
    const userId = createTestUser(db, 'treasure_seller');
    const hero = createCharacter(db, {
      userId,
      name: 'TreasureMerchant',
      classType: 'FIGHTER',
      stats: { strength: 16, constitution: 15, dexterity: 12, intelligence: 11, wisdom: 10, charisma: 8 }
    });

    const treasures = db.prepare("SELECT * FROM item_definitions WHERE subtype = 'TREASURE' ORDER BY id ASC").all();
    assert.ok(treasures.length >= 14, 'All 14 treasure items must exist in item_definitions');

    for (const t of treasures) {
      assert.ok(t.sell_price > 0, `Treasure ${t.name} must have positive sell_price`);
      const inst = giveItemByName(db, hero.id, t.name);
      const beforeGold = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
      const sale = sellItem(db, hero.id, inst.instanceId);
      assert.equal(sale.goldEarned, t.sell_price, `Selling ${t.name} must award exact sell_price (${t.sell_price} gp)`);
      const afterGold = db.prepare('SELECT gold FROM characters WHERE id = ?').get(hero.id).gold;
      assert.equal(afterGold - beforeGold, t.sell_price);
    }

    // Section 10A: Running runSeeds again on an already-seeded DB is a safe no-op and tracks all 10 seeds
    const secondRun = runSeeds(db);
    assert.equal(secondRun.length, 0, 'runSeeds must not re-run already tracked seeds');
    const trackedSeeds = db.prepare('SELECT COUNT(*) as c FROM schema_seeds').get().c;
    assert.equal(trackedSeeds, 10, 'All 10 seed files must be recorded in schema_seeds');

    // Section 10B: Concurrent nested transactions across two separate DB connections do not collide
    const db2 = initializeDatabase(':memory:');
    runMigrations(db2);
    withTransaction(db, () => {
      withTransaction(db2, () => {
        const c1 = db.prepare('SELECT COUNT(*) as c FROM map_tiles').get().c;
        const c2 = db2.prepare('SELECT COUNT(*) as c FROM map_tiles').get().c;
        assert.equal(c1, 225);
        assert.equal(c2, 0);
      });
    });
    db2.close();
  } finally {
    closeDb();
  }
});
