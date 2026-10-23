#!/usr/bin/env node
/**
 * DARKGRID — PHASE 7B: Monte Carlo Combat Balance Simulation Suite
 *
 * Uses the REAL implemented domain modules from src/domain/ (not separate theoretical formulas):
 * - src/domain/character/rules.js (calculateCanonicalMaxHp, getEffectiveStats, calculateHeroAttackBonus, calculateHeroAC, getHeroSavingThrows)
 * - src/domain/combat/rules.js (rollInitiative, resolveAttack, resolveDamage)
 * - src/domain/combat/abilities.js (resolveMonsterSpecialOnHit, resolveEndOfRoundStatusTicks, resolveFighterSecondWind, getActiveStatusModifiers)
 * - src/domain/combat/knowledge.js (evaluateHeroMonsterKnowledge, getClericTurnUndeadProfile)
 * - src/domain/monsters/taxonomy.js (resolveMonsterFamily)
 * - src/domain/combat/dice.js (rollDice, rollD20)
 *
 * Runs >= 2,000 Monte Carlo trials per matchup across Levels 1–10 for Fighter, Ranger, and Cleric.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createTestDb } = require('../tests/test_helpers');
const config = require('../src/config');
const {
  calculateCanonicalMaxHp,
  getEffectiveStats,
  getModifier
} = require('../src/domain/character/rules');
const {
  calculateHeroAttackBonus,
  calculateHeroAC,
  rollInitiative,
  resolveAttackRoll,
  rollHeroDamage
} = require('../src/domain/combat/rules');
const {
  parseCombatStateJson,
  resolveMonsterOnHitEffects,
  resolveEndOfRoundStatusTicks,
  resolveFighterSecondWind,
  getActiveStatusModifiers
} = require('../src/domain/combat/abilities');
const {
  evaluateHeroMonsterKnowledge,
  getClericTurnUndeadProfile
} = require('../src/domain/combat/knowledge');
const { rollDice } = require('../src/domain/combat/dice');

const TRIALS = Number(process.env.PHASE7B_SIM_TRIALS || 2000);

// Deterministic xorshift32 PRNG for reproducible Monte Carlo runs
function createSeededRng(seed = 7072026) {
  let state = seed >>> 0;
  return function rng() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000000) / 1000000;
  };
}

/**
 * Builds a realistic equipment loadout for a given class and character level.
 */
function buildStandardEquipmentForLevel(classType, level) {
  const cls = classType.toUpperCase();
  const enh = level >= 9 ? 2 : (level >= 5 ? 1 : 0);
  const ringBonus = level >= 6 ? 1 : 0;
  const cloakBonus = level >= 4 ? 1 : 0;
  const beltAttrs = level >= 7
    ? (cls === 'RANGER' ? { dexterity_bonus: 2 } : { strength_bonus: 2, constitution_bonus: level >= 9 ? 2 : 0 })
    : {};

  if (cls === 'FIGHTER') {
    return {
      meleeWeapon: {
        name: enh > 0 ? `+${enh} Longsword` : 'Longsword',
        category: 'WEAPON',
        weapon_range_type: 'MELEE',
        damage_dice: '1d8',
        enhancement_bonus: enh,
        attack_bonus: 0,
        damage_bonus: 0,
        is_two_handed: 0
      },
      rangedWeapon: {
        name: 'Shortbow',
        category: 'WEAPON',
        weapon_range_type: 'RANGED',
        damage_dice: '1d6',
        enhancement_bonus: 0,
        attack_bonus: 0,
        damage_bonus: 0
      },
      armor: {
        name: level >= 7 ? 'Full Plate' : (level >= 4 ? 'Breastplate' : 'Chainmail'),
        category: 'ARMOR',
        armor_bonus: level >= 7 ? 8 : (level >= 4 ? 6 : 5),
        max_dex_bonus: level >= 7 ? 1 : (level >= 4 ? 3 : 2),
        enhancement_bonus: level >= 8 ? 1 : 0
      },
      shield: {
        name: 'Heavy Steel Shield',
        category: 'SHIELD',
        shield_bonus: 2,
        enhancement_bonus: level >= 6 ? 1 : 0
      },
      ring: ringBonus ? { name: 'Ring of Protection +1', category: 'ACCESSORY', equip_slot: 'RING', attributes: { ac_bonus: ringBonus } } : null,
      cloak: cloakBonus ? { name: 'Cloak of Resistance +1', category: 'ACCESSORY', equip_slot: 'CLOAK', attributes: { save_bonus: cloakBonus } } : null,
      belt: Object.keys(beltAttrs).length ? { name: 'Belt of Might', category: 'ACCESSORY', equip_slot: 'BELT', attributes: beltAttrs } : null
    };
  }

  if (cls === 'RANGER') {
    return {
      meleeWeapon: {
        name: enh > 0 ? `+${enh} Longsword` : 'Shortsword',
        category: 'WEAPON',
        weapon_range_type: 'MELEE',
        damage_dice: '1d6',
        enhancement_bonus: enh,
        attack_bonus: 0,
        damage_bonus: 0
      },
      rangedWeapon: {
        name: enh > 0 ? `+${enh} Composite Longbow` : 'Longbow',
        category: 'WEAPON',
        weapon_range_type: 'RANGED',
        damage_dice: '1d8',
        enhancement_bonus: enh,
        attack_bonus: 0,
        damage_bonus: 0
      },
      armor: {
        name: level >= 5 ? 'Mithral Shirt' : 'Studded Leather',
        category: 'ARMOR',
        armor_bonus: level >= 5 ? 4 : 3,
        max_dex_bonus: level >= 5 ? 6 : 5,
        enhancement_bonus: level >= 8 ? 1 : 0
      },
      shield: null,
      ring: ringBonus ? { name: 'Ring of Protection +1', category: 'ACCESSORY', equip_slot: 'RING', attributes: { ac_bonus: ringBonus } } : null,
      cloak: cloakBonus ? { name: 'Cloak of Resistance +1', category: 'ACCESSORY', equip_slot: 'CLOAK', attributes: { save_bonus: cloakBonus } } : null,
      belt: Object.keys(beltAttrs).length ? { name: 'Belt of Agility', category: 'ACCESSORY', equip_slot: 'BELT', attributes: beltAttrs } : null
    };
  }

  // CLERIC
  return {
    meleeWeapon: {
      name: enh > 0 ? `+${enh} Heavy Mace` : 'Heavy Mace',
      category: 'WEAPON',
      weapon_range_type: 'MELEE',
      damage_dice: '1d8',
      enhancement_bonus: enh,
      attack_bonus: 0,
      damage_bonus: 0
    },
    rangedWeapon: null,
    armor: {
      name: level >= 6 ? 'Breastplate' : 'Scale Mail',
      category: 'ARMOR',
      armor_bonus: level >= 6 ? 6 : 4,
      max_dex_bonus: 3,
      enhancement_bonus: level >= 8 ? 1 : 0
    },
    shield: {
      name: 'Heavy Wooden Shield',
      category: 'SHIELD',
      shield_bonus: 2,
      enhancement_bonus: level >= 6 ? 1 : 0
    },
    ring: ringBonus ? { name: 'Ring of Protection +1', category: 'ACCESSORY', equip_slot: 'RING', attributes: { ac_bonus: ringBonus } } : null,
    cloak: cloakBonus ? { name: 'Cloak of Resistance +1', category: 'ACCESSORY', equip_slot: 'CLOAK', attributes: { save_bonus: cloakBonus } } : null,
    belt: Object.keys(beltAttrs).length ? { name: 'Belt of Fortitude', category: 'ACCESSORY', equip_slot: 'BELT', attributes: beltAttrs } : null
  };
}

/**
 * Builds a hero with milestone attribute points spent at Levels 2, 4, 6, 8, 10.
 */
function buildHeroForSimulation(classType, level, options = {}) {
  const cls = classType.toUpperCase();
  const baseStats = { ...(options.baseStats || config.classBases[cls]) };
  const milestonesEarned = [2, 4, 6, 8, 10].filter(m => level >= m).length;

  // Spend milestone points on primary combat attribute (or CON at L6)
  for (let i = 0; i < milestonesEarned; i++) {
    if (cls === 'FIGHTER') {
      if (i === 2) baseStats.constitution += 1;
      else baseStats.strength += 1;
    } else if (cls === 'RANGER') {
      if (i === 2) baseStats.constitution += 1;
      else baseStats.dexterity += 1;
    } else {
      if (i % 2 === 0) baseStats.strength += 1;
      else baseStats.wisdom += 1;
    }
  }

  const equipment = options.equipment || buildStandardEquipmentForLevel(cls, level);
  const rawHero = {
    id: 1,
    name: `Sim_${cls}_L${level}`,
    class: cls,
    level,
    ...baseStats,
    primary_weapon: cls === 'RANGER' ? 'RANGED' : 'MELEE',
    favored_enemy_family: options.favoredEnemyFamily || (cls === 'RANGER' ? 'LUPINE_CANINE_BEASTS' : null),
    monsterVictories: options.victories !== undefined ? options.victories : 1
  };

  const effectiveHero = getEffectiveStats(rawHero, equipment);
  const maxHp = calculateCanonicalMaxHp(level, cls, getModifier(effectiveHero.constitution));
  effectiveHero.max_hp = maxHp;
  effectiveHero.current_hp = maxHp;
  effectiveHero._equipment = equipment;

  const knowledge = evaluateHeroMonsterKnowledge(null, effectiveHero, options.monster);
  effectiveHero._learnedDamageBonus = knowledge.learnedDamageBonus;
  effectiveHero._learnedAcBonus = knowledge.learnedAcBonus;

  return { hero: effectiveHero, equipment, knowledge };
}

/**
 * Simulates a single combat encounter to completion using the real Phase 7B combat domain functions.
 */
function simulateSingleBout(classType, level, monster, rng, options = {}) {
  const { hero, equipment } = buildHeroForSimulation(classType, level, {
    ...options,
    monster
  });

  const isRanged = hero.primary_weapon === 'RANGED' && Boolean(equipment.rangedWeapon);
  const activeWeapon = isRanged ? equipment.rangedWeapon : equipment.meleeWeapon;

  let heroHp = hero.max_hp;
  let monsterHp = Number(monster.base_hp || 10);
  const combatState = parseCombatStateJson('{}');
  let secondWindTriggered = false;
  let potionsRemaining = options.potions !== undefined ? options.potions : 2;
  const potionFormula = level >= 8 ? '3d8+5' : (level >= 5 ? '2d8+3' : '1d8+1');

  // 1. Ranger Ranged Opening Shot (when spotted in Stage 1, 75% spot rate for Rangers)
  if (classType === 'RANGER' && isRanged && rng() < 0.75) {
    const openBonus = calculateHeroAttackBonus(hero, activeWeapon, monster);
    const openAtk = resolveAttackRoll(openBonus, monster.armor_class, rng);
    if (openAtk.isHit) {
      const openDmg = rollHeroDamage(hero, activeWeapon, monster, openAtk.isCrit, rng, equipment);
      monsterHp = Math.max(1, monsterHp - openDmg);
    }
  }

  // 2. Cleric Turn Undead opening radiant disruption (L7+)
  const turnUndead = getClericTurnUndeadProfile(hero, monster);
  if (turnUndead.active && turnUndead.openingDisruptionDiceCount > 0) {
    const wisMod = Math.max(0, getModifier(hero.wisdom));
    const radRoll = rollDice(`${turnUndead.openingDisruptionDiceCount}d6`, rng);
    const radDmg = Math.max(1, radRoll.total + wisMod);
    monsterHp = Math.max(1, monsterHp - radDmg);
  }

  const heroInit = rollInitiative(getModifier(hero.dexterity), rng);
  const monsterInit = rollInitiative(Number(monster.initiative_bonus || 0), rng);
  const heroFirst = heroInit >= monsterInit;

  let rounds = 0;
  const maxRounds = 50;

  function doHeroTurn() {
    if (combatState.stunnedRounds > 0 || combatState.paralyzedRounds > 0) {
      return;
    }
    if (potionsRemaining > 0 && heroHp <= Math.floor(hero.max_hp * 0.35)) {
      potionsRemaining--;
      const healRoll = rollDice(potionFormula, rng);
      heroHp = Math.min(hero.max_hp, heroHp + Math.max(1, healRoll.total));
      return;
    }
    const statusMods = getActiveStatusModifiers(combatState);
    const atkBonus = calculateHeroAttackBonus(hero, activeWeapon, monster) + (statusMods.atkMod || 0);
    const atk = resolveAttackRoll(atkBonus, monster.armor_class, rng);
    if (atk.isHit) {
      const dmg = Math.max(1, rollHeroDamage(hero, activeWeapon, monster, atk.isCrit, rng, equipment) + (statusMods.dmgMod || 0));
      monsterHp = Math.max(0, monsterHp - dmg);
    }
  }

  function doMonsterTurn(roundNum) {
    const statusMods = getActiveStatusModifiers(combatState);
    const heroAC = calculateHeroAC(hero, equipment.armor, equipment.shield, isRanged, monster, activeWeapon) + statusMods.acMod;
    let mAtkBonus = Number(monster.attack_bonus || 0);
    let mDmgPenalty = 0;
    if (turnUndead.active) {
      mAtkBonus -= (roundNum === 1 ? turnUndead.round1AttackPenalty : turnUndead.ongoingAttackPenalty);
      if (roundNum === 1) mDmgPenalty = turnUndead.round1DamagePenalty;
    }

    const numAttacks = Math.max(1, Number(monster.num_attacks || 1));
    let calcifyKilled = false;

    for (let i = 0; i < numAttacks; i++) {
      const mAtk = resolveAttackRoll(mAtkBonus, heroAC, rng);
      if (mAtk.isHit) {
        const diceStr = monster.damage_dice || '1d6';
        let totalDmg = 0;
        const rollsCount = mAtk.isCrit ? 2 : 1;
        for (let r = 0; r < rollsCount; r++) {
          totalDmg += Math.max(1, rollDice(diceStr, rng).total - mDmgPenalty);
        }
        heroHp = Math.max(0, heroHp - totalDmg);

        const spec = resolveMonsterOnHitEffects({
          character: hero,
          equipment,
          encounter: monster,
          combatState,
          monsterAttackRoll: mAtk,
          heroAC,
          currentHeroHp: heroHp,
          currentMonsterHp: monsterHp,
          monsterMaxHp: Number(monster.base_hp || 10),
          rng,
          logEvent: () => {}
        });
        heroHp = spec.newHeroHp;
        if (spec.isCalcifiedKilled) {
          calcifyKilled = true;
          heroHp = 0;
          break;
        }
      }
    }

    // Fighter Second Wind Option B after full monster multi-hit + rider sequence
    if (!calcifyKilled) {
      const sw = resolveFighterSecondWind({
        character: hero,
        equipment,
        currentHp: heroHp,
        maxHp: hero.max_hp,
        combatState,
        isCalcifiedKilled: calcifyKilled,
        rng
      });
      if (sw.triggered) {
        heroHp = sw.currentHp;
        secondWindTriggered = true;
      }
    }

    // Level 1 single-attack lethal spike guard
    if (level === 1 && roundNum === 1 && heroHp <= 0 && !calcifyKilled) {
      heroHp = 1;
    }
  }

  while (heroHp > 0 && monsterHp > 0 && rounds < maxRounds) {
    rounds++;
    if (heroFirst) {
      doHeroTurn();
      if (monsterHp <= 0) break;
      doMonsterTurn(rounds);
      if (heroHp <= 0) break;
    } else {
      doMonsterTurn(rounds);
      if (heroHp <= 0) break;
      doHeroTurn();
      if (monsterHp <= 0) break;
    }

    // End of round status ticks + Second Wind DoT rescue
    const eor = resolveEndOfRoundStatusTicks({
      character: hero,
      equipment,
      combatState,
      currentHeroHp: heroHp,
      rng,
      logEvent: () => {}
    });
    if (eor.newHeroHp !== heroHp) {
      heroHp = eor.newHeroHp;
      const swDot = resolveFighterSecondWind({
        character: hero,
        equipment,
        currentHp: heroHp,
        maxHp: hero.max_hp,
        combatState,
        isCalcifiedKilled: false,
        rng
      });
      if (swDot.triggered) {
        heroHp = swDot.currentHp;
        secondWindTriggered = true;
      }
    }
  }

  return {
    won: heroHp > 0 && monsterHp <= 0,
    rounds,
    remainingHpRatio: Math.max(0, heroHp) / hero.max_hp,
    secondWindTriggered
  };
}

function runMatchupSeries(classType, level, monster, rng, options = {}) {
  let wins = 0;
  let totalRounds = 0;
  let totalRemainingHpRatio = 0;
  let secondWindTriggers = 0;

  for (let i = 0; i < TRIALS; i++) {
    const res = simulateSingleBout(classType, level, monster, rng, options);
    if (res.won) {
      wins++;
      totalRemainingHpRatio += res.remainingHpRatio;
    }
    totalRounds += res.rounds;
    if (res.secondWindTriggered) secondWindTriggers++;
  }

  return {
    classType,
    level,
    monsterName: monster.name,
    monsterFamily: monster.monster_family,
    monsterLevel: monster.solo_level,
    trials: TRIALS,
    winRate: Number(((wins / TRIALS) * 100).toFixed(2)),
    avgRounds: Number((totalRounds / TRIALS).toFixed(2)),
    avgWinHpPct: wins > 0 ? Number(((totalRemainingHpRatio / wins) * 100).toFixed(1)) : 0,
    secondWindTriggerRate: Number(((secondWindTriggers / TRIALS) * 100).toFixed(1))
  };
}

function main() {
  const db = createTestDb();

  const rng = createSeededRng(20261022);
  const allMonsters = db.prepare('SELECT * FROM monsters ORDER BY id ASC').all();

  // Representative benchmark monsters across Levels 1–10 (from actual 98-monster SQLite seed data)
  const levelBenchmarks = [
    { level: 1, name: 'Goblin' },
    { level: 2, name: 'Wolf' },
    { level: 3, name: 'Bugbear' },
    { level: 4, name: 'Ogre' },
    { level: 5, name: 'Wight' },
    { level: 6, name: 'Troll' },
    { level: 7, name: 'Manticore' },
    { level: 8, name: 'Wyvern' },
    { level: 9, name: 'Wraith' },
    { level: 10, name: 'Chimera' }
  ];

  const highestCrMonsters = [...allMonsters].sort((a, b) => (Number(b.challenge_rating || 0) - Number(a.challenge_rating || 0)) || (Number(b.base_hp || 0) - Number(a.base_hp || 0)));

  const progressionMatrix = [];
  for (const bench of levelBenchmarks) {
    const monster = allMonsters.find(m => m.name.toLowerCase() === bench.name.toLowerCase())
      || allMonsters.find(m => Number(m.solo_level) === bench.level)
      || highestCrMonsters[0];

    for (const cls of ['FIGHTER', 'RANGER', 'CLERIC']) {
      progressionMatrix.push(
        runMatchupSeries(cls, bench.level, monster, rng, {
          favoredEnemyFamily: cls === 'RANGER' ? (monster.monster_family === 'UNDEAD' ? 'LUPINE_CANINE_BEASTS' : monster.monster_family) : null,
          victories: 1
        })
      );
    }
  }

  // Special Focus 1: Monster #36 Mummy (CR 5, L5, 45 HP, AC 20, +14 Atk, 1d8+10, UNDEAD)
  const mummy = allMonsters.find(m => m.name.toLowerCase() === 'mummy');
  const mummyBenchmarks = [];
  for (const lvl of [5, 6, 7]) {
    for (const cls of ['FIGHTER', 'RANGER', 'CLERIC']) {
      mummyBenchmarks.push(
        runMatchupSeries(cls, lvl, mummy, rng, { victories: 1 })
      );
    }
  }

  // Special Focus 2: INT/WIS Battle Experience Progression (0 vs 1 vs 3+ victories)
  const owlbear = allMonsters.find(m => m.name.toLowerCase() === 'owlbear') || allMonsters.find(m => Number(m.solo_level) === 4);
  const battleExperienceComparison = [];
  for (const victories of [0, 1, 3]) {
    battleExperienceComparison.push({
      victories,
      tier: victories >= 3 ? 'EXPERIENCED' : (victories >= 1 ? 'RECOGNIZED' : 'UNFAMILIAR'),
      ...runMatchupSeries('FIGHTER', 4, owlbear, rng, {
        baseStats: { strength: 16, dexterity: 10, constitution: 14, intelligence: 16, wisdom: 16, charisma: 8 },
        victories
      })
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    trialsPerMatchup: TRIALS,
    progressionMatrix,
    mummyBenchmarks,
    battleExperienceComparison
  };

  const outDir = path.join(__dirname, '../action-ui-lab/docs/phase-7b');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'phase7b_simulation_results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Phase 7B Monte Carlo Simulations complete (${TRIALS} trials/matchup).`);
  console.log(`Saved results to: ${outPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  simulateSingleBout,
  runMatchupSeries
};
