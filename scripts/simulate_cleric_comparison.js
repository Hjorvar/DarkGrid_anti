/**
 * Darkgrid — Cleric vs Undead & Expedition Balance Simulation
 * 
 * Deep comparative simulation to evaluate:
 * 1. Fighter vs Ranger vs Cleric against the EXACT same Undead monsters (L1, 3, 5, 7, 9)
 * 2. Fighter vs Ranger vs Cleric against Non-Undead monsters of identical CR
 * 3. Breakdown of win rate by monster CR vs Hero Level (Fair vs Hard vs Deadly)
 * 4. Permadeath risk & survival probability across 10-encounter level-up journeys
 * 5. Impact of Cleric out-of-combat Self-Healing across multi-encounter expeditions
 */

const { getDb } = require('../src/db/connection');
const {
  getHpPerLevel,
  getLevelAttackBonus,
  getFighterWeaponTraining,
  getFighterArmorTrainingMaxDexBonus,
  getRangerFavoredEnemyBonus,
  getClericDivinePowerBonus,
  getClericSelfHealInfo,
  getModifier
} = require('../src/domain/character/rules');
const {
  calculateHeroAttackBonus,
  calculateHeroAC,
  getHeroDamageFormula,
  resolveAttackRoll,
  resolveDamage
} = require('../src/domain/combat/rules');
const { rollDice } = require('../src/domain/combat/dice');

const db = getDb();
const monsters = db.prepare('SELECT * FROM monsters').all();

// Base stats
const BASE_STATS = {
  FIGHTER: { strength: 16, constitution: 14, dexterity: 13, intelligence: 10, wisdom: 10, charisma: 8 },
  RANGER:  { strength: 13, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 14, charisma: 8 },
  CLERIC:  { strength: 14, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 9 }
};

// Gear loadouts by level and class
function getEquipmentForLevel(classType, level) {
  if (level <= 3) {
    // Tier 0: Starter authentic gear
    if (classType === 'FIGHTER') {
      return {
        melee: { name: 'Longsword', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Heavy Crossbow', damage_dice: '1d10', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Scale Mail', armor_bonus: 5, max_dex_bonus: 3, enhancement_bonus: 0, category: 'ARMOR' },
        shield: { name: 'Heavy Steel Shield', shield_bonus: 2, enhancement_bonus: 0, category: 'SHIELD' }
      };
    } else if (classType === 'RANGER') {
      return {
        melee: { name: 'Shortsword', damage_dice: '1d6', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Longbow', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Studded Leather', armor_bonus: 3, max_dex_bonus: 5, enhancement_bonus: 0, category: 'ARMOR' },
        shield: null
      };
    } else {
      // CLERIC
      return {
        melee: { name: 'Morningstar', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Sling', damage_dice: '1d4', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Chainmail', armor_bonus: 6, max_dex_bonus: 2, enhancement_bonus: 0, category: 'ARMOR' },
        shield: { name: 'Heavy Wooden Shield', shield_bonus: 2, enhancement_bonus: 0, category: 'SHIELD' }
      };
    }
  } else if (level <= 6) {
    // Tier 1: +1 Enchanted gear
    if (classType === 'FIGHTER') {
      return {
        melee: { name: 'Longsword +1', damage_dice: '1d8', enhancement_bonus: 1, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Heavy Crossbow +1', damage_dice: '1d10', enhancement_bonus: 1, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Breastplate +1', armor_bonus: 6, max_dex_bonus: 3, enhancement_bonus: 1, category: 'ARMOR' },
        shield: { name: 'Heavy Steel Shield +1', shield_bonus: 2, enhancement_bonus: 1, category: 'SHIELD' }
      };
    } else if (classType === 'RANGER') {
      return {
        melee: { name: 'Shortsword +1', damage_dice: '1d6', enhancement_bonus: 1, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Longbow +1', damage_dice: '1d8', enhancement_bonus: 1, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Studded Leather +1', armor_bonus: 3, max_dex_bonus: 5, enhancement_bonus: 1, category: 'ARMOR' },
        shield: null
      };
    } else {
      // CLERIC
      return {
        melee: { name: 'Morningstar +1', damage_dice: '1d8', enhancement_bonus: 1, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Light Crossbow +1', damage_dice: '1d8', enhancement_bonus: 1, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Breastplate +1', armor_bonus: 6, max_dex_bonus: 3, enhancement_bonus: 1, category: 'ARMOR' },
        shield: { name: 'Heavy Wooden Shield +1', shield_bonus: 2, enhancement_bonus: 1, category: 'SHIELD' }
      };
    }
  } else {
    // Tier 2: +2 Greater gear
    if (classType === 'FIGHTER') {
      return {
        melee: { name: 'Longsword +2', damage_dice: '1d8', enhancement_bonus: 2, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Heavy Crossbow +2', damage_dice: '1d10', enhancement_bonus: 2, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Full Plate +2', armor_bonus: 9, max_dex_bonus: 1, enhancement_bonus: 2, category: 'ARMOR' },
        shield: { name: 'Heavy Steel Shield +2', shield_bonus: 2, enhancement_bonus: 2, category: 'SHIELD' }
      };
    } else if (classType === 'RANGER') {
      return {
        melee: { name: 'Shortsword +2', damage_dice: '1d6', enhancement_bonus: 2, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Longbow +2', damage_dice: '1d8', enhancement_bonus: 2, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Mithral Shirt +2', armor_bonus: 4, max_dex_bonus: 6, enhancement_bonus: 2, category: 'ARMOR' },
        shield: null
      };
    } else {
      // CLERIC
      return {
        melee: { name: 'Morningstar +2', damage_dice: '1d8', enhancement_bonus: 2, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Heavy Crossbow +2', damage_dice: '1d10', enhancement_bonus: 2, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Full Plate +2', armor_bonus: 9, max_dex_bonus: 1, enhancement_bonus: 2, category: 'ARMOR' },
        shield: { name: 'Heavy Wooden Shield +2', shield_bonus: 2, enhancement_bonus: 2, category: 'SHIELD' }
      };
    }
  }
}

function buildHero(classType, level, currentHpOverride = null) {
  const stats = BASE_STATS[classType];
  const hpPerLvl = getHpPerLevel(classType, stats.constitution);
  const maxHp = hpPerLvl * level;
  return {
    id: 1,
    name: `${classType}_Lvl${level}`,
    class: classType,
    level,
    strength: stats.strength,
    constitution: stats.constitution,
    dexterity: stats.dexterity,
    intelligence: stats.intelligence,
    wisdom: stats.wisdom,
    charisma: stats.charisma,
    max_hp: maxHp,
    current_hp: currentHpOverride !== null ? currentHpOverride : maxHp,
    favored_enemy_type: classType === 'RANGER' ? 'HUMANOID' : null,
    favored_enemy_subtype: classType === 'RANGER' ? 'goblinoid' : null
  };
}

/**
 * Simulates a single 1-on-1 combat between hero and monster.
 * Returns { victory, rounds, remainingHp, potionsUsed }
 */
function simulateSingleCombat(hero, monster, options = {}) {
  const equipment = options.equipment || getEquipmentForLevel(hero.class, hero.level);
  const startingPotions = options.potions !== undefined ? options.potions : 1;
  const allowFlee = options.allowFlee || false;
  const fleeHpThreshold = options.fleeHpThreshold || 0; // e.g. 0.25 of maxHp

  let currentHeroHp = hero.current_hp;
  let monsterHp = monster.base_hp;
  let potions = startingPotions;
  let potionsUsed = 0;

  const isMonsterFlying = (monster.movement_type === 'FLY');
  const activeWeapon = isMonsterFlying ? (equipment.ranged || equipment.melee) : equipment.melee;
  const heroAc = calculateHeroAC(hero, equipment, isMonsterFlying);
  const heroAtk = calculateHeroAttackBonus(hero, activeWeapon, monster, isMonsterFlying);
  const heroDmgFormula = getHeroDamageFormula(hero, activeWeapon, monster);

  const monsterAc = monster.armor_class;
  const monsterAtk = monster.attack_bonus;
  const monsterDmg = monster.damage_dice;

  // Initiative
  const heroInit = Math.floor(Math.random() * 20) + 1 + getModifier(hero.dexterity);
  const monsterInit = Math.floor(Math.random() * 20) + 1 + (monster.initiative_bonus || 0);
  let heroTurnsFirst = heroInit >= monsterInit;

  let round = 0;
  let victory = false;
  let escaped = false;

  while (currentHeroHp > 0 && monsterHp > 0 && round < 40) {
    round++;

    // Check tactical flee
    if (allowFlee && currentHeroHp <= hero.max_hp * fleeHpThreshold && monster.challenge_rating > hero.level) {
      // Free attack from monster on flee
      const freeAtk = resolveAttackRoll(monsterAtk, heroAc);
      if (freeAtk.isHit) {
        currentHeroHp -= resolveDamage(monsterDmg, freeAtk.isCrit);
      }
      if (currentHeroHp > 0) {
        escaped = true;
        break;
      } else {
        // Died while fleeing
        break;
      }
    }

    if (heroTurnsFirst) {
      // Hero Action
      if (currentHeroHp <= 5 && potions > 0) {
        potions--;
        potionsUsed++;
        currentHeroHp = Math.min(hero.max_hp, currentHeroHp + rollDice('1d8+1').total);
      } else {
        const atk = resolveAttackRoll(heroAtk, monsterAc);
        if (atk.isHit) {
          monsterHp -= resolveDamage(heroDmgFormula, atk.isCrit);
        }
      }

      if (monsterHp <= 0) {
        victory = true;
        break;
      }

      // Monster Action
      const mAtk = resolveAttackRoll(monsterAtk, heroAc);
      if (mAtk.isHit) {
        currentHeroHp -= resolveDamage(monsterDmg, mAtk.isCrit);
      }
      if (currentHeroHp <= 0) break;

    } else {
      // Monster Action First
      const mAtk = resolveAttackRoll(monsterAtk, heroAc);
      if (mAtk.isHit) {
        currentHeroHp -= resolveDamage(monsterDmg, mAtk.isCrit);
      }
      if (currentHeroHp <= 0) break;

      // Hero Action Second
      if (currentHeroHp <= 5 && potions > 0) {
        potions--;
        potionsUsed++;
        currentHeroHp = Math.min(hero.max_hp, currentHeroHp + rollDice('1d8+1').total);
      } else {
        const atk = resolveAttackRoll(heroAtk, monsterAc);
        if (atk.isHit) {
          monsterHp -= resolveDamage(heroDmgFormula, atk.isCrit);
        }
      }

      if (monsterHp <= 0) {
        victory = true;
        break;
      }
    }
  }

  return {
    victory,
    escaped,
    rounds: round,
    remainingHp: Math.max(0, currentHeroHp),
    potionsUsed,
    potionsLeft: potions
  };
}

// =============================================================================
// RUN EXPERIMENT 1: Direct Head-to-Head Comparison (Identical Monsters)
// =============================================================================
function runHeadToHeadComparison() {
  console.log('=== EXPERIMENT 1: HEAD-TO-HEAD MATCHUPS (10,000 fights per pair) ===\n');

  const testLevels = [1, 3, 5, 7, 9];
  const TRIALS = 10000;

  // Selected representative monsters
  const monstersToTest = [
    // Undead
    { level: 1, type: 'Undead', name: 'Human Skeleton', cr: '1/3' },
    { level: 1, type: 'Undead', name: 'Human Zombie', cr: '1/2' },
    { level: 1, type: 'Undead', name: 'Ghoul', cr: '1' },
    { level: 3, type: 'Undead', name: 'Skeletal Champion', cr: '2' },
    { level: 3, type: 'Undead', name: 'Ghast', cr: '2' },
    { level: 3, type: 'Undead', name: 'Shadow', cr: '3' },
    { level: 3, type: 'Undead', name: 'Wight', cr: '3' },
    { level: 5, type: 'Undead', name: 'Mummy', cr: '5' },
    { level: 5, type: 'Undead', name: 'Wraith', cr: '5' },

    // Non-Undead (for direct benchmark at same CR)
    { level: 1, type: 'Non-Undead', name: 'Goblin', cr: '1/3' },
    { level: 1, type: 'Non-Undead', name: 'Orc', cr: '1/3' },
    { level: 1, type: 'Non-Undead', name: 'Hobgoblin', cr: '1/2' },
    { level: 1, type: 'Non-Undead', name: 'Wolf', cr: '1' },
    { level: 3, type: 'Non-Undead', name: 'Bugbear', cr: '2' },
    { level: 3, type: 'Non-Undead', name: 'Ogre', cr: '3' },
    { level: 5, type: 'Non-Undead', name: 'Troll', cr: '5' },
    { level: 5, type: 'Non-Undead', name: 'Manticore', cr: '5' }
  ];

  const results = [];

  for (const mRef of monstersToTest) {
    const monster = monsters.find(m => m.name.toLowerCase() === mRef.name.toLowerCase());
    if (!monster) {
      console.warn(`Monster ${mRef.name} not found!`);
      continue;
    }

    // Determine relevant hero levels to test this monster against
    let levelsToTest = [mRef.level];
    if (mRef.level === 5) {
      levelsToTest = [5, 7, 9]; // Test high CR monster against higher hero levels
    }

    for (const heroLevel of levelsToTest) {
      const matchResult = {
        monsterName: monster.name,
        monsterType: monster.creature_type,
        cr: monster.challenge_rating,
        heroLevel,
        fighter: { wins: 0, avgHp: 0, avgRounds: 0 },
        ranger:  { wins: 0, avgHp: 0, avgRounds: 0 },
        cleric:  { wins: 0, avgHp: 0, avgRounds: 0 }
      };

      for (const cls of ['FIGHTER', 'RANGER', 'CLERIC']) {
        let wins = 0;
        let totalHp = 0;
        let totalRounds = 0;

        for (let t = 0; t < TRIALS; t++) {
          const hero = buildHero(cls, heroLevel);
          const res = simulateSingleCombat(hero, monster, { potions: 1 });
          if (res.victory) wins++;
          totalHp += res.remainingHp;
          totalRounds += res.rounds;
        }

        matchResult[cls.toLowerCase()] = {
          winRate: ((wins / TRIALS) * 100).toFixed(1),
          avgHp: (totalHp / TRIALS).toFixed(1),
          avgRounds: (totalRounds / TRIALS).toFixed(2)
        };
      }

      results.push(matchResult);
    }
  }

  return results;
}

// =============================================================================
// RUN EXPERIMENT 2: Multi-Encounter Expedition Simulation
// =============================================================================
function runExpeditionSimulation() {
  console.log('=== EXPERIMENT 2: EXPEDITION SIMULATION (Chained Encounters) ===\n');

  const EXPEDITION_COUNT = 5000;
  const ENCOUNTERS_PER_EXPEDITION = 5; // e.g. 5 encounters before returning to city
  const levels = [1, 3, 5];

  const expeditionResults = [];

  for (const lvl of levels) {
    for (const theme of ['UNDEAD_LAIR', 'WILDERNESS']) {
      // Pick monster pool for theme and level
      let pool = [];
      if (theme === 'UNDEAD_LAIR') {
        pool = monsters.filter(m => m.creature_type === 'Undead' && Math.abs(m.solo_level - lvl) <= 1);
        if (pool.length === 0) pool = monsters.filter(m => m.creature_type === 'Undead');
      } else {
        // General wilderness
        pool = monsters.filter(m => m.creature_type !== 'Undead' && Math.abs(m.solo_level - lvl) <= 1);
      }

      const summary = {
        level: lvl,
        theme,
        poolSize: pool.length,
        FIGHTER: { survivedExpeditions: 0, avgEncountersSurvived: 0, potionsUsed: 0 },
        RANGER:  { survivedExpeditions: 0, avgEncountersSurvived: 0, potionsUsed: 0 },
        CLERIC:  { survivedExpeditions: 0, avgEncountersSurvived: 0, potionsUsed: 0, healsUsed: 0 }
      };

      for (const cls of ['FIGHTER', 'RANGER', 'CLERIC']) {
        let survivedExpeditions = 0;
        let totalEncountersCleared = 0;
        let totalPotions = 0;
        let totalHeals = 0;

        for (let e = 0; e < EXPEDITION_COUNT; e++) {
          let hero = buildHero(cls, lvl);
          let potions = 2;
          let healInfo = getClericSelfHealInfo(lvl);
          let healCharges = cls === 'CLERIC' ? healInfo.maxUses : 0;
          let encCount = 0;
          let alive = true;

          for (let step = 0; step < ENCOUNTERS_PER_EXPEDITION; step++) {
            const monster = pool[Math.floor(Math.random() * pool.length)];
            const res = simulateSingleCombat(hero, monster, { potions, allowFlee: false });
            potions = res.potionsLeft;
            totalPotions += res.potionsUsed;

            if (!res.victory) {
              alive = false;
              break;
            }

            encCount++;
            hero.current_hp = res.remainingHp;

            // Outside combat: Cleric Self-Healing
            if (cls === 'CLERIC' && hero.current_hp < hero.max_hp && healCharges > 0) {
              while (hero.current_hp < hero.max_hp && healCharges > 0) {
                healCharges--;
                totalHeals++;
                const healRoll = rollDice(healInfo.dice).total + getModifier(hero.wisdom);
                hero.current_hp = Math.min(hero.max_hp, hero.current_hp + Math.max(1, healRoll));
              }
            }
          }

          if (alive && encCount === ENCOUNTERS_PER_EXPEDITION) {
            survivedExpeditions++;
          }
          totalEncountersCleared += encCount;
        }

        summary[cls] = {
          survivalRate: ((survivedExpeditions / EXPEDITION_COUNT) * 100).toFixed(1),
          avgCleared: (totalEncountersCleared / EXPEDITION_COUNT).toFixed(2),
          avgPotions: (totalPotions / EXPEDITION_COUNT).toFixed(2),
          avgHeals: cls === 'CLERIC' ? (totalHeals / EXPEDITION_COUNT).toFixed(2) : 'N/A'
        };
      }

      expeditionResults.push(summary);
    }
  }

  return expeditionResults;
}

// =============================================================================
// RUN EXPERIMENT 3: CR Difficulty Classification & Permadeath Analysis
// =============================================================================
function runDifficultyAnalysis() {
  console.log('=== EXPERIMENT 3: CR DIFFICULTY CLASSIFICATION & PERMADEATH RISK ===\n');

  const lvl1Monsters = [
    { name: 'Kobold', cr: 0.25, tier: 'Under-level (Easy)' },
    { name: 'Goblin', cr: 0.33, tier: 'On-level (Fair)' },
    { name: 'Human Skeleton', cr: 0.33, tier: 'On-level (Fair)' },
    { name: 'Orc', cr: 0.33, tier: 'On-level (Deadly High Dmg)' },
    { name: 'Human Zombie', cr: 0.50, tier: 'On-level (Fair)' },
    { name: 'Wolf', cr: 1.0, tier: 'Hard (CR 1)' },
    { name: 'Ghoul', cr: 1.0, tier: 'Hard (CR 1)' },
    { name: 'Bugbear', cr: 2.0, tier: 'Deadly (CR 2)' },
    { name: 'Skeletal Champion', cr: 2.0, tier: 'Deadly (CR 2)' },
    { name: 'Ogre', cr: 3.0, tier: 'Extreme (CR 3)' },
    { name: 'Mummy', cr: 5.0, tier: 'Impossible (CR 5)' }
  ];

  const TRIALS = 5000;
  const analysis = [];

  for (const mEntry of lvl1Monsters) {
    const monster = monsters.find(m => m.name.toLowerCase() === mEntry.name.toLowerCase());
    if (!monster) continue;

    const row = {
      name: monster.name,
      cr: monster.challenge_rating,
      creature_type: monster.creature_type,
      tier: mEntry.tier,
      fighterWin: 0,
      rangerWin: 0,
      clericWin: 0,
      clericWinWithFlee: 0
    };

    for (const cls of ['FIGHTER', 'RANGER', 'CLERIC']) {
      let wins = 0;
      for (let t = 0; t < TRIALS; t++) {
        const hero = buildHero(cls, 1);
        const res = simulateSingleCombat(hero, monster, { potions: 1, allowFlee: false });
        if (res.victory) wins++;
      }
      row[`${cls.toLowerCase()}Win`] = ((wins / TRIALS) * 100).toFixed(1);
    }

    // Also test Cleric with Tactical Flee (flee if HP <= 25% against CR > 1)
    let fleeWinsOrEscapes = 0;
    for (let t = 0; t < TRIALS; t++) {
      const hero = buildHero('CLERIC', 1);
      const res = simulateSingleCombat(hero, monster, { potions: 1, allowFlee: true, fleeHpThreshold: 0.35 });
      if (res.victory || res.escaped) fleeWinsOrEscapes++;
    }
    row.clericSurvivalWithFlee = ((fleeWinsOrEscapes / TRIALS) * 100).toFixed(1);

    analysis.push(row);
  }

  return analysis;
}

// Execute all
const headToHead = runHeadToHeadComparison();
const expeditions = runExpeditionSimulation();
const difficulty = runDifficultyAnalysis();

console.log('\n--- HEAD TO HEAD RESULTS ---');
console.table(headToHead.map(r => ({
  Monster: `${r.monsterName} (${r.monsterType}, CR ${r.cr})`,
  HeroLvl: r.heroLevel,
  FighterWin: `${r.fighter.winRate}%`,
  RangerWin: `${r.ranger.winRate}%`,
  ClericWin: `${r.cleric.winRate}%`
})));

console.log('\n--- EXPEDITION SURVIVAL (5 Encounters Streak) ---');
console.table(expeditions.map(e => ({
  Level: e.level,
  Theme: e.theme,
  FighterSurv: `${e.FIGHTER.survivalRate}%`,
  RangerSurv: `${e.RANGER.survivalRate}%`,
  ClericSurv: `${e.CLERIC.survivalRate}%`,
  ClericHeals: e.CLERIC.avgHeals
})));

console.log('\n--- LEVEL 1 CR DIFFICULTY & PERMADEATH RISK ---');
console.table(difficulty.map(d => ({
  Monster: d.name,
  CR: d.cr,
  Type: d.creature_type,
  Tier: d.tier,
  Fighter: `${d.fighterWin}%`,
  Ranger: `${d.rangerWin}%`,
  Cleric: `${d.clericWin}%`,
  ClericWithFlee: `${d.clericSurvivalWithFlee}%`
})));
