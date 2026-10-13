/**
 * Darkgrid — New Approved Balance & Combat Mechanics Simulation
 * 
 * Tests and verifies:
 * 1. Ranger with Longbow as Primary Weapon
 * 2. Ranger with vs without Opening Shot
 * 3. Cleric with Holy Radiance (+2/+3/+2 L1-4, +3/+4/+3 L5-8, +4/+5/+4 L9+) vs Undead
 * 4. Fighter vs General Monsters
 * 5. Level 1 Exploration within 3 steps of City (City Safety CR Zones):
 *    - With 2 Minor Healing Potions
 *    - Cleric Out-of-Combat Healing
 *    - Stage 1 Threat Assessment & Tactical Ignore / Flee
 *    - 10-kill / 1,300 XP Level 2 Survival Rate (Target: 40–60%)
 */

const { getDb } = require('../src/db/connection');
const config = require('../src/config');
const {
  getHpPerLevel,
  getLevelAttackBonus,
  getFighterWeaponTraining,
  getRangerFavoredEnemyBonus,
  getClericHolyRadianceBonus,
  getClericSelfHealInfo,
  getModifier,
  getActiveWeapon
} = require('../src/domain/character/rules');
const {
  calculateHeroAttackBonus,
  calculateHeroAC,
  getHeroDamageFormula,
  resolveAttackRoll,
  resolveDamage,
  rollInitiative
} = require('../src/domain/combat/rules');
const { rollDice, rollD20 } = require('../src/domain/combat/dice');
const { getMaxCrForDistance } = require('../src/domain/encounters/engine');

const db = getDb();
const allMonsters = db.prepare('SELECT * FROM monsters').all();

// Starting equipment
const STARTING_GEAR = {
  FIGHTER: {
    meleeWeapon: { id: 1, name: 'Longsword', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
    rangedWeapon: { id: 2, name: 'Shortbow', damage_dice: '1d6', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
    armor: { id: 3, name: 'Chain Shirt', armor_bonus: 4, max_dex_bonus: 4, enhancement_bonus: 0, category: 'ARMOR' },
    shield: { id: 4, name: 'Light Steel Shield', shield_bonus: 1, armor_bonus: 1, enhancement_bonus: 0, category: 'SHIELD' }
  },
  RANGER: {
    meleeWeapon: { id: 5, name: 'Shortsword', damage_dice: '1d6', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
    rangedWeapon: { id: 6, name: 'Longbow', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
    armor: { id: 7, name: 'Leather Armor', armor_bonus: 2, max_dex_bonus: 6, enhancement_bonus: 0, category: 'ARMOR' },
    shield: null
  },
  CLERIC: {
    meleeWeapon: { id: 8, name: 'Heavy Mace', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
    rangedWeapon: { id: 9, name: 'Sling', damage_dice: '1d4', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
    armor: { id: 10, name: 'Scale Mail', armor_bonus: 5, max_dex_bonus: 3, enhancement_bonus: 0, category: 'ARMOR' },
    shield: { id: 11, name: 'Light Steel Shield', shield_bonus: 1, armor_bonus: 1, enhancement_bonus: 0, category: 'SHIELD' }
  }
};

const STATS = {
  FIGHTER: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 }, // 12 HP, AC 16
  RANGER:  { strength: 12, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 13, charisma: 8 }, // 9 HP, AC 15
  CLERIC:  { strength: 13, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 10 } // 9 HP, AC 16
};

/**
 * Simulates a single 1v1 combat between hero and monster.
 */
function simulateSingleCombat(heroConfig, monster, options = {}) {
  const {
    enableOpeningShot = false,
    usePotions = false,
    maxPotions = 0,
    tacticalFleeThreshold = 0 // HP % to attempt flee (0 = fight to death)
  } = options;

  const character = {
    class: heroConfig.class,
    level: heroConfig.level || 1,
    strength: heroConfig.stats.strength,
    constitution: heroConfig.stats.constitution,
    dexterity: heroConfig.stats.dexterity,
    wisdom: heroConfig.stats.wisdom,
    primary_weapon: heroConfig.primaryWeapon || 'MELEE',
    favored_enemy_type: heroConfig.favoredEnemyType || null,
    favored_enemy_subtype: heroConfig.favoredEnemySubtype || null
  };

  const equipment = heroConfig.equipment;
  const maxHeroHp = heroConfig.currentHp || getHpPerLevel(character.class, character.constitution) * character.level;
  let heroHp = heroConfig.currentHp || maxHeroHp;
  let monsterHp = monster.base_hp;
  let potionsRemaining = maxPotions;
  let rounds = 0;
  let openingShotFired = false;
  let openingShotHit = false;

  // 1. Check Active Weapon & Shield AC
  const { activeWeapon, isRangedActive } = getActiveWeapon(character, equipment, monster);
  const heroAC = calculateHeroAC(character, equipment.armor, equipment.shield, isRangedActive, monster);

  // 2. Ranger Opening Shot
  if (enableOpeningShot && character.class === 'RANGER' && equipment.rangedWeapon && !options.isAmbush) {
    openingShotFired = true;
    const openingAB = calculateHeroAttackBonus(character, equipment.rangedWeapon, monster);
    const attackRoll = resolveAttackRoll(openingAB, monster.armor_class);
    if (attackRoll.isHit) {
      openingShotHit = true;
      const damageFormula = getHeroDamageFormula(character, equipment.rangedWeapon, monster);
      const dmg = resolveDamage(damageFormula, attackRoll.isCrit);
      monsterHp -= dmg;
      if (monsterHp <= 0) {
        return { outcome: 'WIN', rounds: 0, heroHp, monsterHp: 0, potionsUsed: 0, openingShotKilled: true };
      }
    }
  }

  // 3. Initiative Roll
  const heroDexMod = getModifier(character.dexterity);
  const heroInit = rollInitiative(heroDexMod);
  const monsterInit = rollInitiative(monster.initiative_bonus || 0);
  let heroTurnFirst = heroInit >= monsterInit;

  // 4. Combat Rounds Loop
  while (heroHp > 0 && monsterHp > 0 && rounds < 100) {
    rounds++;

    // Check Potion Usage before attack
    if (usePotions && potionsRemaining > 0 && heroHp <= Math.ceil(maxHeroHp * 0.45)) {
      potionsRemaining--;
      const heal = rollDice('1d8+1').total;
      heroHp = Math.min(maxHeroHp, heroHp + heal);
      // Drinking potion takes turn, monster attacks
      const mAttack = resolveAttackRoll(monster.attack_bonus, heroAC);
      if (mAttack.isHit) {
        heroHp -= resolveDamage(monster.damage_dice, mAttack.isCrit);
      }
      if (heroHp <= 0) break;
      continue;
    }

    // Check Tactical Flee
    if (tacticalFleeThreshold > 0 && heroHp <= Math.ceil(maxHeroHp * tacticalFleeThreshold) && rounds > 1) {
      // Free attack of opportunity from monster
      const oppAttack = resolveAttackRoll(monster.attack_bonus, heroAC);
      if (oppAttack.isHit) {
        heroHp -= resolveDamage(monster.damage_dice, oppAttack.isCrit);
      }
      if (heroHp <= 0) {
        return { outcome: 'DEATH_ON_FLEE', rounds, heroHp: 0, monsterHp, potionsUsed: maxPotions - potionsRemaining };
      }
      return { outcome: 'FLED', rounds, heroHp, monsterHp, potionsUsed: maxPotions - potionsRemaining };
    }

    function doHeroAttack() {
      const heroAB = calculateHeroAttackBonus(character, activeWeapon, monster);
      const attack = resolveAttackRoll(heroAB, monster.armor_class);
      if (attack.isHit) {
        const dmgFormula = getHeroDamageFormula(character, activeWeapon, monster);
        monsterHp -= resolveDamage(dmgFormula, attack.isCrit);
      }
    }

    function doMonsterAttack() {
      const attack = resolveAttackRoll(monster.attack_bonus, heroAC);
      if (attack.isHit) {
        heroHp -= resolveDamage(monster.damage_dice, attack.isCrit);
      }
    }

    if (heroTurnFirst) {
      doHeroAttack();
      if (monsterHp <= 0) break;
      doMonsterAttack();
      if (heroHp <= 0) break;
    } else {
      doMonsterAttack();
      if (heroHp <= 0) break;
      doHeroAttack();
      if (monsterHp <= 0) break;
    }
  }

  const outcome = heroHp > 0 ? 'WIN' : 'LOSS';
  return {
    outcome,
    rounds,
    heroHp: Math.max(0, heroHp),
    monsterHp: Math.max(0, monsterHp),
    potionsUsed: maxPotions - potionsRemaining,
    openingShotKilled: false
  };
}

/**
 * Runs 10,000 iterations of single monster matchups across configurations.
 */
function runBenchmarkMatchups() {
  const targetMonsters = [
    'Human Skeleton', 'Human Zombie', 'Ghoul', 'Skeletal Champion', 'Ghast', 'Shadow', 'Wight', 'Mummy', 'Wraith',
    'Goblin', 'Orc', 'Hobgoblin', 'Wolf', 'Bugbear', 'Ogre', 'Troll'
  ];

  console.log('--- RUNNING BENCHMARK MATCHUPS (10,000 iterations per cell) ---');

  const results = [];

  for (const mName of targetMonsters) {
    const monster = allMonsters.find(m => m.name === mName || m.name.includes(mName));
    if (!monster) continue;

    const level = monster.solo_level || (monster.challenge_rating >= 5 ? 5 : (monster.challenge_rating >= 2 ? 3 : 1));

    // Fighter config
    const fighter = {
      class: 'FIGHTER',
      level,
      stats: STATS.FIGHTER,
      equipment: STARTING_GEAR.FIGHTER,
      primaryWeapon: 'MELEE'
    };

    // Ranger configs
    const rangerShortsword = {
      class: 'RANGER',
      level,
      stats: STATS.RANGER,
      equipment: STARTING_GEAR.RANGER,
      primaryWeapon: 'MELEE'
    };

    const rangerBowNoOpening = {
      class: 'RANGER',
      level,
      stats: STATS.RANGER,
      equipment: STARTING_GEAR.RANGER,
      primaryWeapon: 'RANGED'
    };

    const rangerBowOpening = {
      class: 'RANGER',
      level,
      stats: STATS.RANGER,
      equipment: STARTING_GEAR.RANGER,
      primaryWeapon: 'RANGED'
    };

    // Cleric configs
    const cleric = {
      class: 'CLERIC',
      level,
      stats: STATS.CLERIC,
      equipment: STARTING_GEAR.CLERIC,
      primaryWeapon: 'MELEE'
    };

    const TRIALS = 10000;

    let fWins = 0;
    let rShortWins = 0;
    let rBowNoOpenWins = 0;
    let rBowOpenWins = 0;
    let cWins = 0;

    for (let i = 0; i < TRIALS; i++) {
      if (simulateSingleCombat(fighter, monster).outcome === 'WIN') fWins++;
      if (simulateSingleCombat(rangerShortsword, monster).outcome === 'WIN') rShortWins++;
      if (simulateSingleCombat(rangerBowNoOpening, monster).outcome === 'WIN') rBowNoOpenWins++;
      if (simulateSingleCombat(rangerBowOpening, monster, { enableOpeningShot: true }).outcome === 'WIN') rBowOpenWins++;
      if (simulateSingleCombat(cleric, monster).outcome === 'WIN') cWins++;
    }

    results.push({
      monster: monster.name,
      type: monster.creature_type,
      cr: monster.challenge_rating,
      heroLvl: level,
      fighterWin: (fWins / TRIALS * 100).toFixed(1) + '%',
      rangerShort: (rShortWins / TRIALS * 100).toFixed(1) + '%',
      rangerBowNoOpen: (rBowNoOpenWins / TRIALS * 100).toFixed(1) + '%',
      rangerBowOpen: (rBowOpenWins / TRIALS * 100).toFixed(1) + '%',
      clericWin: (cWins / TRIALS * 100).toFixed(1) + '%'
    });
  }

  console.table(results);
  return results;
}

/**
 * Simulates Level 1 Wilderness Exploration within 3 tiles of Safe City.
 * Compares:
 * - Strategy A (Reckless Explorer): Pushes into Distance 3 (CR 1.0) often, rarely returns to town until critical
 * - Strategy B (Cautious Hunter): Hunts primarily in Distance 1-2 (CR <= 0.5), returns to town sanctuary to rest when injured (<= 75% HP) or out of potions
 */
function runLevel2ProgressionSimulation() {
  console.log('\n--- RUNNING LEVEL 1 TO LEVEL 2 EXPEDITIONS (10,000 heroes per class/strategy) ---');

  const classes = ['FIGHTER', 'RANGER', 'CLERIC'];
  const XP_TARGET = 1300;
  const EXPEDITIONS = 10000;

  const monstersDist1 = allMonsters.filter(m => m.challenge_rating <= 0.34);
  const monstersDist2 = allMonsters.filter(m => m.challenge_rating <= 0.51);
  const monstersDist3 = allMonsters.filter(m => m.challenge_rating <= 1.01);

  const progressionResults = {};

  for (const strategy of ['ZONE_1_APPRENTICE', 'CAUTIOUS_HUNTER', 'RECKLESS_EXPLORER']) {
    progressionResults[strategy] = {};

    for (const cls of classes) {
      let reachedLevel2 = 0;
      let diedCount = 0;
      let totalWins = 0;
      let totalPotionsUsed = 0;
      let totalClericHeals = 0;
      let totalFleeAttempts = 0;
      let totalIgnoredEncounters = 0;
      let totalTownRests = 0;

      for (let sim = 0; sim < EXPEDITIONS; sim++) {
        let currentXp = 0;
        let potions = 2; // 2 Minor healing potions at start
        const maxHp = cls === 'FIGHTER' ? 12 : 9;
        let hp = maxHp;
        let clericHealUses = cls === 'CLERIC' ? 3 : 0;
        let isDead = false;

        while (currentXp < XP_TARGET && !isDead) {
          // Select tile distance based on strategy
          let pool = monstersDist1;
          let dist = 1;

          if (strategy === 'ZONE_1_APPRENTICE') {
            // 100% in Distance 1 (CR <= 0.33)
            pool = monstersDist1;
            dist = 1;
          } else if (strategy === 'CAUTIOUS_HUNTER') {
            // 60% dist 1 (CR <= 0.33), 30% dist 2 (CR <= 0.5), 10% dist 3 (CR 1.0)
            const r = Math.random();
            if (r > 0.90) { pool = monstersDist3; dist = 3; }
            else if (r > 0.60) { pool = monstersDist2; dist = 2; }
          } else {
            // Reckless: 40% dist 1, 35% dist 2, 25% dist 3
            const r = Math.random();
            if (r > 0.75) { pool = monstersDist3; dist = 3; }
            else if (r > 0.40) { pool = monstersDist2; dist = 2; }
          }

          const monster = pool[Math.floor(Math.random() * pool.length)];

          // Perception / Ambush Check
          const wis = STATS[cls].wisdom;
          const wisMod = Math.floor((wis - 10) / 2);
          const perceptionBonus = cls === 'RANGER' ? wisMod + 3 : wisMod;
          const perceptionRoll = Math.floor(Math.random() * 20) + 1 + perceptionBonus;
          const monsterStealth = 10 + (monster.initiative_bonus || 0);
          const isAmbush = perceptionRoll < monsterStealth;

          // Stage 1 Tactical Assessment:
          // Cautious: Ignores CR 1 if wounded, ignores ambushes if low HP
          let chooseIgnore = false;
          if (!isAmbush) {
            if (strategy === 'CAUTIOUS_HUNTER') {
              if (monster.challenge_rating >= 1.0 && hp < maxHp) chooseIgnore = true;
              if (monster.challenge_rating >= 0.5 && hp <= Math.ceil(maxHp * 0.6)) chooseIgnore = true;
            } else {
              if (monster.challenge_rating >= 1.0 && hp <= Math.ceil(maxHp * 0.5)) chooseIgnore = true;
            }
          }

          if (chooseIgnore) {
            totalIgnoredEncounters++;
            // Cautious hero returns to town to rest if hurt
            if (strategy === 'CAUTIOUS_HUNTER' && hp < maxHp) {
              totalTownRests++;
              hp = maxHp;
              if (cls === 'CLERIC') clericHealUses = 3;
            }
            continue;
          }

          // Engage in combat
          const heroConfig = {
            class: cls,
            level: 1,
            stats: STATS[cls],
            equipment: STARTING_GEAR[cls],
            primaryWeapon: cls === 'RANGER' ? 'RANGED' : 'MELEE',
            currentHp: hp,
            favoredEnemyType: cls === 'RANGER' ? 'BEAST' : null
          };

          const fleeThreshold = strategy === 'CAUTIOUS_HUNTER' ? 0.40 : 0.25;

          const combatResult = simulateSingleCombat(heroConfig, monster, {
            enableOpeningShot: true,
            usePotions: true,
            maxPotions: potions,
            tacticalFleeThreshold: fleeThreshold,
            isAmbush
          });

          potions -= combatResult.potionsUsed;
          totalPotionsUsed += combatResult.potionsUsed;
          hp = combatResult.heroHp;

          if (combatResult.outcome === 'WIN') {
            totalWins++;
            currentXp += monster.xp_reward || 135;

            // Out-of-combat recovery:
            // Cleric channels divine healing if injured
            if (cls === 'CLERIC' && clericHealUses > 0 && hp < maxHp) {
              clericHealUses--;
              totalClericHeals++;
              const clericHeal = rollDice('1d6+3').total;
              hp = Math.min(maxHp, hp + clericHeal);
            }

            // Return to Sanctuary:
            if (strategy === 'CAUTIOUS_HUNTER' || strategy === 'ZONE_1_APPRENTICE') {
              if (hp <= Math.ceil(maxHp * 0.75) || potions === 0) {
                totalTownRests++;
                hp = maxHp;
                if (cls === 'CLERIC') clericHealUses = 3;
                if (potions < 2) potions = 2; // Restock potions in town sanctuary
              }
            } else {
              if (hp <= 4 && potions === 0) {
                totalTownRests++;
                hp = maxHp;
                if (cls === 'CLERIC') clericHealUses = 3;
                potions = 1;
              }
            }
          } else if (combatResult.outcome === 'FLED') {
            totalFleeAttempts++;
            // Successfully fled back to town sanctuary!
            totalTownRests++;
            hp = maxHp;
            if (cls === 'CLERIC') clericHealUses = 3;
          } else {
            // Permadeath!
            isDead = true;
            diedCount++;
          }
        }

        if (currentXp >= XP_TARGET && !isDead) {
          reachedLevel2++;
        }
      }

      const survivalRate = (reachedLevel2 / EXPEDITIONS * 100).toFixed(1);
      progressionResults[strategy][cls] = {
        reachedLevel2,
        diedCount,
        survivalRate: survivalRate + '%',
        avgPotionsPerHero: (totalPotionsUsed / EXPEDITIONS).toFixed(2),
        avgFleePerHero: (totalFleeAttempts / EXPEDITIONS).toFixed(2),
        avgIgnoresPerHero: (totalIgnoredEncounters / EXPEDITIONS).toFixed(2),
        avgTownRests: (totalTownRests / EXPEDITIONS).toFixed(2),
        clericHealsPerHero: (totalClericHeals / EXPEDITIONS).toFixed(2)
      };
    }
    console.log(`\nResults for Strategy: ${strategy}`);
    console.table(progressionResults[strategy]);
  }

  return progressionResults;
}

// Run benchmarks
const benchmarkResults = runBenchmarkMatchups();
const progressionResults = runLevel2ProgressionSimulation();

module.exports = {
  benchmarkResults,
  progressionResults
};
