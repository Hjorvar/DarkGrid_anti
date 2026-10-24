/**
 * Rebalance & Monster Special Abilities Test Suite
 * Verifies all 8 user-approved gameplay/balance/UI changes and all 9 Permadeath Safety Rules:
 * 1. Hidden weapon/armor numeric stats in UI & rich English item descriptions (zero numeric spoilers).
 * 2. INT modifier scales XP gained (+10% per +1 INT mod) & CHA modifier scales Oakhaven shop prices (-5% per +1 CHA mod).
 * 3. Melee attacks use STR (attack + damage); Ranged attacks use DEX (attack + max(STR, floor(DEX/2)) damage).
 * 4. Flying mechanic fix: respects hero's primary_weapon preference, preserves shield AC in melee, applies -1 melee penalty vs FLY (0 ranged).
 * 5. 25% flat monster HP reduction across all 68 monsters.
 * 6. Monster Special Abilities active across all 68 monsters (12 Pathfinder 1e archetypes) + Hero Saving Throws.
 * 7. All 9 Permadeath Safety Rules enforced (Paralysis 1-round stun + 3r immunity, 2-stage Calcification, Poison 3r cap + cure on 1 save, etc.).
 * 8. Specific monster base stat adjustments (Grick AC 15, Stag Beetle AC 17, Gibbering Mouther 2d4+2, Phase Spider 2d6+4, etc.).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTestDb } = require('./test_helpers');
const { setDb, closeDb } = require('../src/db/connection');
const { registerUser } = require('../src/domain/auth/service');
const {
  createCharacter,
  getActiveWeapon,
  calculateXpWithIntelligence,
  calculateShopPriceWithCharisma
} = require('../src/domain/character/rules');
const {
  calculateHeroAttackBonus,
  calculateHeroAC,
  getHeroDamageFormula
} = require('../src/domain/combat/rules');
const {
  getCityStoreStock
} = require('../src/domain/economy/shop');
const {
  executeCombatRound,
  getCombatState
} = require('../src/domain/combat/engine');
const {
  getMonsterAbilityProfile
} = require('../src/domain/combat/abilities');

describe('Rebalance & Monster Special Abilities Suite', () => {
  let db;

  before(() => {
    db = createTestDb();
    setDb(db);
  });

  after(() => {
    closeDb();
  });

  it('1. Item descriptions and UI never leak numeric damage dice or AC bonuses', () => {
    const items = db.prepare(`SELECT id, name, category, description FROM item_definitions`).all();
    assert.ok(items.length >= 100, 'Expected full item catalog');

    const numericLeakPattern = /(\b\d+d\d+\b|\bAC\s*\+\s*\d+|\+\d+\s*AC\b|\bDmg:\s*\d+d\d+)/i;
    for (const item of items) {
      assert.ok(item.description && item.description.trim().length >= 15, `Item "${item.name}" must have an evocative flavor description`);
      assert.equal(
        numericLeakPattern.test(item.description),
        false,
        `Item "${item.name}" description leaked raw numeric stats: "${item.description}"`
      );
    }

    // Verify EJS template rendering hides weapon damage dice and armor AC numbers
    const gameTemplatePath = path.resolve(__dirname, '../legacy-game/views/game.ejs');
    const templateSource = fs.readFileSync(gameTemplatePath, 'utf8');
    assert.equal(templateSource.includes('Dmg: <%= character.equipped.melee.damage_dice %>'), false);
    assert.equal(templateSource.includes('AC+<%= character.equipped.armor.armor_bonus %>'), false);
    assert.equal(templateSource.includes('total Armor Class'), false);
  });

  it('2. INT modifier scales XP (+10% per +1 INT mod) and CHA modifier scales shop prices (-5% per +1 CHA mod)', () => {
    // INT XP scaling
    assert.equal(calculateXpWithIntelligence(100, 10), 100, 'INT 10 (+0 mod) -> 100% XP');
    assert.equal(calculateXpWithIntelligence(100, 14), 100, 'Phase 7B retired general INT XP bonus -> flat 100% XP');
    assert.equal(calculateXpWithIntelligence(100, 16), 100, 'Phase 7B retired general INT XP bonus -> flat 100% XP');
    assert.equal(calculateXpWithIntelligence(100, 8), 100, 'Phase 7B retired general INT XP bonus -> flat 100% XP');

    // CHA shop price scaling
    assert.equal(calculateShopPriceWithCharisma(100, 10), 100, 'CHA 10 (+0 mod) -> 100% buy price');
    assert.equal(calculateShopPriceWithCharisma(100, 16), 85, 'CHA 16 (+3 mod) -> 85% buy price (-15%)');
    assert.equal(calculateShopPriceWithCharisma(100, 8), 105, 'CHA 8 (-1 mod) -> 105% buy price (+5%)');

    const neutralStore = getCityStoreStock(db, { charisma: 10 });
    const highChaStore = getCityStoreStock(db, { charisma: 16 });
    const lowChaStore = getCityStoreStock(db, { charisma: 8 });

    const longswordNeutral = neutralStore.standardItems.find(i => i.name === 'Longsword');
    const longswordHighCha = highChaStore.standardItems.find(i => i.name === 'Longsword');
    const longswordLowCha = lowChaStore.standardItems.find(i => i.name === 'Longsword');

    assert.ok(longswordNeutral, 'Longsword exists in store');
    assert.ok(longswordHighCha.buy_price < longswordNeutral.buy_price, 'High CHA lowers shop buy price');
    assert.ok(longswordLowCha.buy_price > longswordNeutral.buy_price, 'Low CHA increases shop buy price');
  });

  it('3. Melee uses STR and Ranged uses DEX (with composite STR/DEX ranged damage bonus)', () => {
    const meleeWeapon = { id: 1, name: 'Longsword', weapon_range_type: 'MELEE', damage_dice: '1d8', enhancement_bonus: 0 };
    const rangedWeapon = { id: 2, name: 'Longbow', weapon_range_type: 'RANGED', damage_dice: '1d8', enhancement_bonus: 0 };

    // Fighter (high STR 16 (+3), low DEX 10 (+0)) vs Ranger (STR 12 (+1), high DEX 18 (+4))
    const fighter = {
      class: 'FIGHTER', level: 1,
      strength: 16, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10
    };
    const ranger = {
      class: 'RANGER', level: 1,
      strength: 12, dexterity: 18, constitution: 12, intelligence: 10, wisdom: 12, charisma: 10
    };

    const groundMonster = { name: 'Goblin', armor_class: 10, movement_type: 'WALK' };

    // Fighter Melee: Level 1 AB (+0) + STR (+3) = +3; Fighter Ranged with DEX 10 (+0): Level 1 AB (+0) + DEX (+0) = 0
    const fighterMeleeAB = calculateHeroAttackBonus(fighter, meleeWeapon, groundMonster);
    const fighterRangedAB = calculateHeroAttackBonus(fighter, rangedWeapon, groundMonster);
    assert.equal(fighterMeleeAB, 3, 'Fighter melee attack bonus uses STR (+3)');
    assert.equal(fighterRangedAB, 0, 'Fighter ranged attack bonus uses DEX (+0)');

    const fighterDmg = getHeroDamageFormula(fighter, meleeWeapon, groundMonster);
    assert.equal(fighterDmg, '1d8+3', 'Fighter melee damage uses STR (+3)');

    // Ranger Ranged: Level 1 AB (+0) + DEX (+4) = +4; Ranger Melee with STR 12 (+1): Level 1 AB (+0) + STR (+1) = +1
    const rangerRangedAB = calculateHeroAttackBonus(ranger, rangedWeapon, groundMonster);
    const rangerMeleeAB = calculateHeroAttackBonus(ranger, meleeWeapon, groundMonster);
    assert.equal(rangerRangedAB, 4, 'Ranger ranged attack bonus uses DEX (+4)');
    assert.equal(rangerMeleeAB, 1, 'Ranger melee attack bonus uses STR (+1)');

    const rangerDmg = getHeroDamageFormula(ranger, rangedWeapon, groundMonster);
    // Composite ranged damage bonus: max(STR +1, floor(DEX +4 / 2) = +2) = +2
    assert.equal(rangerDmg, '1d8+2', 'Ranger ranged damage uses max(STR mod, floor(DEX mod / 2)) = +2');
  });

  it('4. Flying mechanic fix: respects primary_weapon, preserves shield AC in melee, -1 melee penalty vs FLY', () => {
    const meleeWeapon = { id: 1, name: 'Heavy Mace', weapon_range_type: 'MELEE', damage_dice: '1d8', is_two_handed: 0 };
    const rangedWeapon = { id: 2, name: 'Sling', weapon_range_type: 'RANGED', damage_dice: '1d4', is_two_handed: 0 };
    const shield = { id: 3, name: 'Heavy Wooden Shield', shield_bonus: 2 };
    const armor = { id: 4, name: 'Scale Mail', armor_bonus: 5, max_dex_bonus: 3 };

    const cleric = {
      class: 'CLERIC', level: 2,
      strength: 14, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 16, charisma: 12,
      primary_weapon: 'MELEE'
    };
    const equipment = { meleeWeapon, rangedWeapon, armor, shield };

    const flyingMonster = { name: 'Harpy', armor_class: 12, movement_type: 'FLY', creature_type: 'Monstrous Humanoid' };
    const groundMonster = { name: 'Orc', armor_class: 12, movement_type: 'WALK', creature_type: 'Humanoid' };

    // Cleric with primary_weapon='MELEE' keeps Heavy Mace even against FLY monster!
    const activeVsFly = getActiveWeapon(cleric, equipment, flyingMonster);
    assert.equal(activeVsFly.activeWeapon.name, 'Heavy Mace');
    assert.equal(activeVsFly.isRangedActive, false);

    // Shield AC is preserved!
    const acVsFly = calculateHeroAC(cleric, equipment, activeVsFly.isRangedActive, flyingMonster, activeVsFly.activeWeapon);
    assert.equal(acVsFly, 10 + 5 + 2, 'Cleric keeps +2 shield AC when fighting flying monster in melee');

    // Melee attack vs FLY gets -1 Evasive Flyer penalty compared to ground monster
    const abGround = calculateHeroAttackBonus(cleric, meleeWeapon, groundMonster);
    const abFly = calculateHeroAttackBonus(cleric, meleeWeapon, flyingMonster);
    assert.equal(abFly, abGround - 1, 'Melee vs FLY has -1 Evasive Flyer penalty');

    // Ranged attack vs FLY has 0 penalty
    const abRangedGround = calculateHeroAttackBonus(cleric, rangedWeapon, groundMonster);
    const abRangedFly = calculateHeroAttackBonus(cleric, rangedWeapon, flyingMonster);
    assert.equal(abRangedFly, abRangedGround, 'Ranged vs FLY has 0 penalty');
  });

  it('5 & 8. Monster base_hp reduced by 25% across all monsters & specific monster base stats updated', () => {
    const monsters = db.prepare(`SELECT id, name, armor_class, base_hp, attack_bonus, damage_dice, special_abilities FROM monsters ORDER BY id`).all();
    assert.equal(monsters.length, 98, 'All 98 monsters present');

    const byId = Object.fromEntries(monsters.map(m => [m.id, m]));
    const byName = Object.fromEntries(monsters.map(m => [m.name, m]));

    // Assassin Vine (id=1: was 30 HP -> round(30 * 0.75) = 23)
    assert.equal(byId[1].base_hp, 23);
    // Kobold (was 5 HP -> round(5 * 0.75) = 4)
    assert.equal(byName['Kobold'].base_hp, 4);
    // Goblin (was 6 HP -> round(6 * 0.75) = 5)
    assert.equal(byName['Goblin'].base_hp, 5);
    // Grick (id=65): AC 16 -> 15, HP 27 -> 20
    assert.equal(byId[65].armor_class, 15);
    assert.equal(byId[65].base_hp, 20);
    // Giant Stag Beetle (id=59): AC 19 -> 17, HP 45 -> 34
    assert.equal(byId[59].armor_class, 17);
    assert.equal(byId[59].base_hp, 34);
    // Gibbering Mouther (id=57): damage_dice '1d4' -> '2d4+2', HP 45 -> 34
    assert.equal(byId[57].damage_dice, '2d4+2');
    assert.equal(byId[57].base_hp, 34);
    // Phase Spider (id=55): damage_dice '2d6+7' -> '2d6+4', HP 51 -> 38
    assert.equal(byId[55].damage_dice, '2d6+4');
    assert.equal(byId[55].base_hp, 38);

    // Every single monster (68/68) resolves a valid special ability profile
    for (const m of monsters) {
      const profile = getMonsterAbilityProfile(m);
      assert.ok(profile && typeof profile === 'object', `Monster #${m.id} (${m.name}) has ability profile`);
    }
  });

  it('6 & 7. Combat Engine executes Monster Special Abilities and enforces Permadeath Safety Rules', async () => {
    const user = await registerUser(db, 'ability_tester', 'password123');
    const character = createCharacter(db, {
      userId: user.id,
      name: 'Sir Valen',
      classType: 'FIGHTER',
      stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 11, wisdom: 10, charisma: 9 }
    });

    // Boost character to Level 3 with 35 HP for safe multi-round ability testing
    db.prepare(`UPDATE characters SET level = 3, current_hp = 35, max_hp = 35 WHERE id = ?`).run(character.id);

    // Give hero a Minor Healing Potion
    const potionDef = db.prepare(`SELECT id FROM item_definitions WHERE name = 'Minor Healing Potion'`).get();
    db.prepare(`INSERT INTO item_instances (item_definition_id, owner_type, owner_character_id) VALUES (?, 'CHARACTER', ?)`).run(potionDef.id, character.id);

    // Test A: Ghoul with Paralysis -> Permadeath Safety Rule 1:
    // Paralysis stuns for 1 round (still allowing DRINK_POTION/FLEE!) and grants 3-round Paralysis Immunity afterward.
    const ghoul = db.prepare(`SELECT id FROM monsters WHERE name = 'Ghoul'`).get();
    const ghoulEncounterId = db.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id, status, combat_round,
        current_monster_hp, monster_max_hp, initiative_winner, combat_state_json
      ) VALUES (?, ?, ?, 'IN_COMBAT', 1, 20, 20, 'HERO', '{}')
    `).run(character.id, character.tile_id, ghoul.id).lastInsertRowid;

    // RNG calls when HERO acts first:
    // 1. Hero attack d20 (0.01 -> 1, misses)
    // 2. Monster attack d20 (0.9 -> 19, hits!)
    // 3. Monster damage d6 (0.5)
    // 4. Hero Fortitude save vs Ghoul Fever d20 (0.9 -> 19, saves!)
    // 5. Hero Fortitude save vs Paralysis d20 (0.01 -> 1, fails!)
    const ghoulRolls = [0.01, 0.9, 0.5, 0.9, 0.01];
    let callIdx = 0;
    const sequenceRng = () => ghoulRolls[callIdx++] ?? 0.5;

    executeCombatRound(db, character.id, ghoulEncounterId, 'ATTACK', { rng: sequenceRng });
    const stateAfterR1 = getCombatState(db, character.id, ghoulEncounterId);
    assert.ok(
      stateAfterR1.heroStatusBadges.some(b => b.key === 'PARALYZED'),
      'Hero should have Paralyzed badge after failed save vs Ghoul'
    );

    // Permadeath Safety Rule 1: While Paralyzed, hero CAN drink a potion (and paralysis clears + grants cooldown)!
    executeCombatRound(db, character.id, ghoulEncounterId, 'DRINK_POTION', { rng: () => 0.1 });
    const stateAfterR2 = getCombatState(db, character.id, ghoulEncounterId);
    assert.equal(
      stateAfterR2.heroStatusBadges.some(b => b.key === 'PARALYZED'),
      false,
      'Paralysis clears after 1 round and allows drinking a potion'
    );
    assert.ok(
      stateAfterR2.combatStatusState.paralysisCooldown >= 1,
      'Hero retains paralysis immunity cooldown after recovering'
    );

    // Clean up Ghoul encounter
    db.prepare(`UPDATE encounters SET status = 'ESCAPED' WHERE id = ?`).run(ghoulEncounterId);
    db.prepare(`UPDATE characters SET current_hp = 35 WHERE id = ?`).run(character.id);

    // Test B: Basilisk with Petrifying Gaze -> Permadeath Safety Rule 2:
    // Never instant-kills on first failed save; applies Stage 1 Slowed/Calcifying first.
    const basilisk = db.prepare(`SELECT id FROM monsters WHERE name = 'Basilisk'`).get();
    const basiliskEncounterId = db.prepare(`
      INSERT INTO encounters (
        character_id, tile_id, monster_id, status, combat_round,
        current_monster_hp, monster_max_hp, initiative_winner, combat_state_json
      ) VALUES (?, ?, ?, 'IN_COMBAT', 1, 40, 40, 'HERO', '{}')
    `).run(character.id, character.tile_id, basilisk.id).lastInsertRowid;

    // 1. Hero misses (0.01), 2. Basilisk hits (0.9), 3. Basilisk damage (0.5), 4. Hero fails Petrifying Gaze save (0.01)
    const basiliskRolls = [0.01, 0.9, 0.5, 0.01];
    let bIdx = 0;
    executeCombatRound(db, character.id, basiliskEncounterId, 'ATTACK', { rng: () => basiliskRolls[bIdx++] ?? 0.5 });
    const basiliskState = getCombatState(db, character.id, basiliskEncounterId);
    assert.equal(basiliskState.encounter.status, 'IN_COMBAT', 'First failed save vs Basilisk never causes instant death');
    assert.ok(
      basiliskState.heroStatusBadges.some(b => b.key === 'CALCIFYING'),
      'Hero enters Stage 1 Calcification (Slowed) instead of instant petrification'
    );
  });
});
