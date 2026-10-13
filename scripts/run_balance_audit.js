/**
 * Darkgrid — Comprehensive Balance Simulation Audit
 * 
 * Sourced directly from live SQLite database and domain rules.
 * 
 * Compares:
 * 1. Starting Equipment vs Upgraded Equipment across all classes
 * 2. Fighter vs Ranger vs Cleric against the EXACT same Undead monsters
 * 3. Fighter vs Ranger vs Cleric against Non-Undead monsters of identical CR
 * 4. Ranger Melee (Shortsword) vs Ranger Ranged (Longbow) & Favored Enemy impact
 * 5. Cleric Divine Power Option A (Current) vs Option B (Sacred Warding +AC)
 * 6. Survival probability to next level (10-win progression) with & without Flee
 * 7. Expedition survival over multi-encounter journeys
 */

const { getDb } = require('../src/db/connection');
const config = require('../src/config');
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

// 1. EXACT Starting Attributes (DARKGRID_GAME_SPEC.md §3.1 + 3 point allocation, sum 71)
const STARTING_STATS = {
  FIGHTER: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 }, // HP: 10+2=12
  RANGER:  { strength: 13, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 8 }, // HP: 8+1=9
  CLERIC:  { strength: 13, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 10 } // HP: 8+1=9
};

// 2. APPROVED Starting Equipment
const STARTING_EQUIPMENT = {
  FIGHTER: {
    melee: { name: 'Longsword', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
    ranged: { name: 'Shortbow', damage_dice: '1d6', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
    armor: { name: 'Chain Shirt', armor_bonus: 4, max_dex_bonus: 4, enhancement_bonus: 0, category: 'ARMOR' },
    shield: { name: 'Light Steel Shield', shield_bonus: 1, enhancement_bonus: 0, category: 'SHIELD' }
  },
  RANGER: {
    melee: { name: 'Shortsword', damage_dice: '1d6', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
    ranged: { name: 'Longbow', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
    armor: { name: 'Leather Armor', armor_bonus: 2, max_dex_bonus: 6, enhancement_bonus: 0, category: 'ARMOR' },
    shield: null
  },
  CLERIC: {
    melee: { name: 'Heavy Mace', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
    ranged: { name: 'Sling', damage_dice: '1d4', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
    armor: { name: 'Scale Mail', armor_bonus: 5, max_dex_bonus: 3, enhancement_bonus: 0, category: 'ARMOR' },
    shield: { name: 'Light Steel Shield', shield_bonus: 1, enhancement_bonus: 0, category: 'SHIELD' }
  }
};

// 3. REALISTICALLY UPGRADED Equipment by Level
function getUpgradedEquipment(classType, level) {
  if (level <= 1) return STARTING_EQUIPMENT[classType];

  if (level <= 3) {
    // Level 3: Improved non-magical / masterwork
    if (classType === 'FIGHTER') {
      return {
        melee: { name: 'Longsword', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Heavy Crossbow', damage_dice: '1d10', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Breastplate', armor_bonus: 6, max_dex_bonus: 3, enhancement_bonus: 0, category: 'ARMOR' },
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
        melee: { name: 'Heavy Mace', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Light Crossbow', damage_dice: '1d8', enhancement_bonus: 0, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Banded Mail', armor_bonus: 7, max_dex_bonus: 1, enhancement_bonus: 0, category: 'ARMOR' },
        shield: { name: 'Heavy Wooden Shield', shield_bonus: 2, enhancement_bonus: 0, category: 'SHIELD' }
      };
    }
  } else if (level <= 6) {
    // Level 5: Tier 1 (+1 enchanted gear)
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
        melee: { name: 'Heavy Mace +1', damage_dice: '1d8', enhancement_bonus: 1, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Light Crossbow +1', damage_dice: '1d8', enhancement_bonus: 1, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Banded Mail +1', armor_bonus: 7, max_dex_bonus: 1, enhancement_bonus: 1, category: 'ARMOR' },
        shield: { name: 'Heavy Wooden Shield +1', shield_bonus: 2, enhancement_bonus: 1, category: 'SHIELD' }
      };
    }
  } else {
    // Level 7 & 9: Tier 2 (+2 greater gear)
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
        melee: { name: 'Heavy Mace +2', damage_dice: '1d8', enhancement_bonus: 2, category: 'WEAPON', weapon_range_type: 'MELEE' },
        ranged: { name: 'Heavy Crossbow +2', damage_dice: '1d10', enhancement_bonus: 2, category: 'WEAPON', weapon_range_type: 'RANGED' },
        armor: { name: 'Full Plate +2', armor_bonus: 9, max_dex_bonus: 1, enhancement_bonus: 2, category: 'ARMOR' },
        shield: { name: 'Heavy Wooden Shield +2', shield_bonus: 2, enhancement_bonus: 2, category: 'SHIELD' }
      };
    }
  }
}

function buildHero(classType, level, options = {}) {
  const stats = STARTING_STATS[classType];
  const hpPerLvl = getHpPerLevel(classType, stats.constitution);
  const maxHp = hpPerLvl * level;

  let favoredType = null;
  let favoredSubtype = null;
  if (classType === 'RANGER') {
    favoredType = options.favoredType || 'HUMANOID';
    favoredSubtype = options.favoredSubtype || 'goblinoid';
  }

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
    current_hp: maxHp,
    favored_enemy_type: favoredType,
    favored_enemy_subtype: favoredSubtype
  };
}

/**
 * Simulates combat between hero and monster.
 * Supports:
 * - Weapon mode: 'MELEE' (forces melee), 'RANGED' (forces ranged), 'AUTO' (standard engine logic)
 * - Cleric mode: 'OPTION_A' (current Divine Power), 'OPTION_B' (Sacred Warding +AC)
 * - Flee: allowFlee (true/false), fleeThreshold (fraction of max HP)
 */
function simulateCombat(hero, monster, options = {}) {
  const equipment = options.equipment || getUpgradedEquipment(hero.class, hero.level);
  const weaponMode = options.weaponMode || 'AUTO';
  const clericMode = options.clericMode || 'OPTION_A';
  const potions = options.potions !== undefined ? options.potions : 1;
  const allowFlee = options.allowFlee || false;
  const fleeThreshold = options.fleeThreshold || 0.25;

  let currentHeroHp = hero.current_hp;
  let currentMonsterHp = monster.base_hp;
  let potionsLeft = potions;
  let potionsUsed = 0;

  // Weapon selection
  const isMonsterFlying = (monster.movement_type === 'FLY');
  let activeWeapon = null;
  let isRangedActive = false;

  if (weaponMode === 'RANGED' && equipment.ranged) {
    activeWeapon = equipment.ranged;
    isRangedActive = true;
  } else if (weaponMode === 'MELEE' && equipment.melee) {
    activeWeapon = equipment.melee;
    isRangedActive = false;
  } else {
    // AUTO (default Darkgrid engine logic)
    if (isMonsterFlying && equipment.ranged) {
      activeWeapon = equipment.ranged;
      isRangedActive = true;
    } else if (equipment.melee) {
      activeWeapon = equipment.melee;
      isRangedActive = false;
    } else {
      activeWeapon = equipment.ranged;
      isRangedActive = true;
    }
  }

  // Calculate Hero AC & AB
  let heroAc = calculateHeroAC(hero, equipment.armor, equipment.shield, isRangedActive);
  let heroAb = calculateHeroAttackBonus(hero, activeWeapon, monster);
  let heroDmgFormula = getHeroDamageFormula(hero, activeWeapon, monster);

  // Apply Cleric Option B (Sacred Warding AC bonus vs Undead)
  const isUndead = (monster.creature_type || '').toUpperCase() === 'UNDEAD';
  if (hero.class === 'CLERIC' && isUndead && clericMode === 'OPTION_B') {
    const acBonus = hero.level >= 9 ? 3 : (hero.level >= 5 ? 2 : 1);
    heroAc += acBonus;
  }

  const monsterAc = monster.armor_class;
  const monsterAb = monster.attack_bonus;
  const monsterDmg = monster.damage_dice;

  // Initiative
  const heroInit = Math.floor(Math.random() * 20) + 1 + getModifier(hero.dexterity);
  const monsterInit = Math.floor(Math.random() * 20) + 1 + (monster.initiative_bonus || 0);
  let heroTurnsFirst = heroInit >= monsterInit;

  let round = 0;
  let victory = false;
  let escaped = false;

  while (currentHeroHp > 0 && currentMonsterHp > 0 && round < 50) {
    round++;

    // Tactical Fleeing check
    if (allowFlee && currentHeroHp <= hero.max_hp * fleeThreshold && monster.solo_level > hero.level) {
      // Monster receives exactly ONE free attack
      const freeAtk = resolveAttackRoll(monsterAb, heroAc);
      if (freeAtk.isHit) {
        currentHeroHp -= resolveDamage(monsterDmg, freeAtk.isCrit);
      }
      if (currentHeroHp > 0) {
        escaped = true;
        break;
      } else {
        // Slain while retreating
        break;
      }
    }

    if (heroTurnsFirst) {
      // Hero Turn
      if (currentHeroHp <= 5 && potionsLeft > 0) {
        potionsLeft--;
        potionsUsed++;
        currentHeroHp = Math.min(hero.max_hp, currentHeroHp + rollDice('1d8+1').total);
      } else {
        const atk = resolveAttackRoll(heroAb, monsterAc);
        if (atk.isHit) {
          currentMonsterHp -= resolveDamage(heroDmgFormula, atk.isCrit);
        }
      }

      if (currentMonsterHp <= 0) {
        victory = true;
        break;
      }

      // Monster Turn
      const mAtk = resolveAttackRoll(monsterAb, heroAc);
      if (mAtk.isHit) {
        currentHeroHp -= resolveDamage(monsterDmg, mAtk.isCrit);
      }
      if (currentHeroHp <= 0) break;

    } else {
      // Monster Turn First
      const mAtk = resolveAttackRoll(monsterAb, heroAc);
      if (mAtk.isHit) {
        currentHeroHp -= resolveDamage(monsterDmg, mAtk.isCrit);
      }
      if (currentHeroHp <= 0) break;

      // Hero Turn Second
      if (currentHeroHp <= 5 && potionsLeft > 0) {
        potionsLeft--;
        potionsUsed++;
        currentHeroHp = Math.min(hero.max_hp, currentHeroHp + rollDice('1d8+1').total);
      } else {
        const atk = resolveAttackRoll(heroAb, monsterAc);
        if (atk.isHit) {
          currentMonsterHp -= resolveDamage(heroDmgFormula, atk.isCrit);
        }
      }

      if (currentMonsterHp <= 0) {
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
    potionsUsed
  };
}

// =============================================================================
// EXPERIMENT SUITE
// =============================================================================

const TRIALS = 10000;

// Benchmark monsters
const TEST_MONSTERS = [
  // Level 1 (CR 0.33 to 1.0)
  { lvl: 1, type: 'Undead', name: 'Human Skeleton', cr: '1/3' },
  { lvl: 1, type: 'Undead', name: 'Human Zombie', cr: '1/2' },
  { lvl: 1, type: 'Undead', name: 'Ghoul', cr: '1' },
  { lvl: 1, type: 'Non-Undead', name: 'Goblin', cr: '1/3' },
  { lvl: 1, type: 'Non-Undead', name: 'Orc', cr: '1/3' },
  { lvl: 1, type: 'Non-Undead', name: 'Hobgoblin', cr: '1/2' },
  { lvl: 1, type: 'Non-Undead', name: 'Wolf', cr: '1' },

  // Level 3 (CR 2 to 3)
  { lvl: 3, type: 'Undead', name: 'Skeletal Champion', cr: '2' },
  { lvl: 3, type: 'Undead', name: 'Ghast', cr: '2' },
  { lvl: 3, type: 'Undead', name: 'Shadow', cr: '3' },
  { lvl: 3, type: 'Undead', name: 'Wight', cr: '3' },
  { lvl: 3, type: 'Non-Undead', name: 'Bugbear', cr: '2' },
  { lvl: 3, type: 'Non-Undead', name: 'Ogre', cr: '3' },

  // Level 5 (CR 5)
  { lvl: 5, type: 'Undead', name: 'Mummy', cr: '5' },
  { lvl: 5, type: 'Undead', name: 'Wraith', cr: '5' },
  { lvl: 5, type: 'Non-Undead', name: 'Troll', cr: '5' },
  { lvl: 5, type: 'Non-Undead', name: 'Manticore', cr: '5' },

  // Level 7 & 9 vs CR 5 Monsters
  { lvl: 7, type: 'Undead', name: 'Mummy', cr: '5' },
  { lvl: 7, type: 'Non-Undead', name: 'Troll', cr: '5' },
  { lvl: 9, type: 'Undead', name: 'Mummy', cr: '5' },
  { lvl: 9, type: 'Non-Undead', name: 'Troll', cr: '5' }
];

console.log('Running Darkgrid Balance Audit Simulation...\n');

// 1. Run Head-to-Head with Standardized Gear
const headToHeadResults = [];

for (const tm of TEST_MONSTERS) {
  const monster = monsters.find(m => m.name.toLowerCase() === tm.name.toLowerCase());
  if (!monster) continue;

  const row = {
    monster: monster.name,
    type: monster.creature_type,
    cr: monster.challenge_rating,
    heroLvl: tm.lvl,
    gearMode: tm.lvl === 1 ? 'Starting' : 'Upgraded',
    fighterWin: 0,
    rangerWin: 0,
    rangerBowWin: 0,
    rangerFavWin: 0,
    clericCurrentWin: 0,
    clericSacredWin: 0
  };

  // 1. Fighter
  let fWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const hero = buildHero('FIGHTER', tm.lvl);
    const eq = tm.lvl === 1 ? STARTING_EQUIPMENT.FIGHTER : getUpgradedEquipment('FIGHTER', tm.lvl);
    if (simulateCombat(hero, monster, { equipment: eq }).victory) fWins++;
  }
  row.fighterWin = ((fWins / TRIALS) * 100).toFixed(1);

  // 2. Ranger Default (Shortsword Melee)
  let rWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const hero = buildHero('RANGER', tm.lvl, { favoredType: 'HUMANOID', favoredSubtype: 'goblinoid' });
    const eq = tm.lvl === 1 ? STARTING_EQUIPMENT.RANGER : getUpgradedEquipment('RANGER', tm.lvl);
    if (simulateCombat(hero, monster, { equipment: eq, weaponMode: 'MELEE' }).victory) rWins++;
  }
  row.rangerWin = ((rWins / TRIALS) * 100).toFixed(1);

  // 3. Ranger Ranged (Longbow)
  let rBowWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const hero = buildHero('RANGER', tm.lvl, { favoredType: 'HUMANOID', favoredSubtype: 'goblinoid' });
    const eq = tm.lvl === 1 ? STARTING_EQUIPMENT.RANGER : getUpgradedEquipment('RANGER', tm.lvl);
    if (simulateCombat(hero, monster, { equipment: eq, weaponMode: 'RANGED' }).victory) rBowWins++;
  }
  row.rangerBowWin = ((rBowWins / TRIALS) * 100).toFixed(1);

  // 4. Ranger with Matching Favored Enemy
  let rFavWins = 0;
  let matchingSub = 'goblinoid';
  if (monster.name === 'Troll') matchingSub = 'giant';
  if (monster.name === 'Orc') matchingSub = 'orc';
  for (let t = 0; t < TRIALS; t++) {
    const hero = buildHero('RANGER', tm.lvl, { favoredType: monster.creature_type, favoredSubtype: matchingSub });
    const eq = tm.lvl === 1 ? STARTING_EQUIPMENT.RANGER : getUpgradedEquipment('RANGER', tm.lvl);
    if (simulateCombat(hero, monster, { equipment: eq, weaponMode: 'AUTO' }).victory) rFavWins++;
  }
  row.rangerFavWin = ((rFavWins / TRIALS) * 100).toFixed(1);

  // 5. Cleric Current (Option A)
  let cWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const hero = buildHero('CLERIC', tm.lvl);
    const eq = tm.lvl === 1 ? STARTING_EQUIPMENT.CLERIC : getUpgradedEquipment('CLERIC', tm.lvl);
    if (simulateCombat(hero, monster, { equipment: eq, clericMode: 'OPTION_A' }).victory) cWins++;
  }
  row.clericCurrentWin = ((cWins / TRIALS) * 100).toFixed(1);

  // 6. Cleric Sacred Warding (Option B)
  let cSacredWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const hero = buildHero('CLERIC', tm.lvl);
    const eq = tm.lvl === 1 ? STARTING_EQUIPMENT.CLERIC : getUpgradedEquipment('CLERIC', tm.lvl);
    if (simulateCombat(hero, monster, { equipment: eq, clericMode: 'OPTION_B' }).victory) cSacredWins++;
  }
  row.clericSacredWin = ((cSacredWins / TRIALS) * 100).toFixed(1);

  headToHeadResults.push(row);
}

// 2. Progression & Permadeath Analysis (Level 1 to Level 2: 10 Encounters Journey)
function simulate10EncounterJourney(classType, gearMode = 'STARTING', allowFlee = false) {
  let journeys = 5000;
  let completed = 0;
  let totalKills = 0;

  // Level 1 monster pool matching encounter distribution
  const pool = monsters.filter(m => m.solo_level === 1 && m.challenge_rating <= 1.0);

  for (let j = 0; j < journeys; j++) {
    let hero = buildHero(classType, 1);
    let potions = 2;
    let healCharges = classType === 'CLERIC' ? 2 : 0;
    let alive = true;
    let kills = 0;

    for (let step = 0; step < 10; step++) {
      const monster = pool[Math.floor(Math.random() * pool.length)];
      const eq = STARTING_EQUIPMENT[classType];
      const res = simulateCombat(hero, monster, { equipment: eq, potions, allowFlee, fleeThreshold: 0.35 });

      potions = Math.max(0, potions - res.potionsUsed);

      if (res.escaped) {
        // Escaped: survived but did not gain kill
        continue;
      }

      if (!res.victory) {
        alive = false;
        break;
      }

      kills++;
      hero.current_hp = res.remainingHp;

      // Cleric Self-Healing between encounters
      if (classType === 'CLERIC' && hero.current_hp < hero.max_hp && healCharges > 0) {
        while (hero.current_hp < hero.max_hp && healCharges > 0) {
          healCharges--;
          const healRoll = rollDice('1d6').total + getModifier(hero.wisdom);
          hero.current_hp = Math.min(hero.max_hp, hero.current_hp + Math.max(1, healRoll));
        }
      }
    }

    if (alive && kills >= 10) completed++;
    totalKills += kills;
  }

  return {
    completionRate: ((completed / journeys) * 100).toFixed(1),
    avgKills: (totalKills / journeys).toFixed(1)
  };
}

const journeyResults = {
  NO_FLEE: {
    FIGHTER: simulate10EncounterJourney('FIGHTER', 'STARTING', false),
    RANGER:  simulate10EncounterJourney('RANGER',  'STARTING', false),
    CLERIC:  simulate10EncounterJourney('CLERIC',  'STARTING', false)
  },
  WITH_FLEE: {
    FIGHTER: simulate10EncounterJourney('FIGHTER', 'STARTING', true),
    RANGER:  simulate10EncounterJourney('RANGER',  'STARTING', true),
    CLERIC:  simulate10EncounterJourney('CLERIC',  'STARTING', true)
  }
};

console.log('=== AUDIT RESULTS: HEAD-TO-HEAD MATCHUPS ===');
console.table(headToHeadResults.map(r => ({
  Monster: `${r.monster} (${r.type}, CR ${r.cr})`,
  Lvl: r.heroLvl,
  Gear: r.gearMode,
  Fighter: `${r.fighterWin}%`,
  RangerMelee: `${r.rangerWin}%`,
  RangerBow: `${r.rangerBowWin}%`,
  RangerFav: `${r.rangerFavWin}%`,
  ClericCur: `${r.clericCurrentWin}%`,
  ClericSacred: `${r.clericSacredWin}%`
})));

console.log('\n=== LEVEL 1 JOURNEY (10 ENCOUNTERS TO LEVEL 2) ===');
console.table([
  { Mode: 'No Flee (Deathmatch)', Fighter: `${journeyResults.NO_FLEE.FIGHTER.completionRate}% (avg ${journeyResults.NO_FLEE.FIGHTER.avgKills} kills)`, Ranger: `${journeyResults.NO_FLEE.RANGER.completionRate}%`, Cleric: `${journeyResults.NO_FLEE.CLERIC.completionRate}% (avg ${journeyResults.NO_FLEE.CLERIC.avgKills} kills)` },
  { Mode: 'Tactical Flee (<35% HP)', Fighter: `${journeyResults.WITH_FLEE.FIGHTER.completionRate}% (avg ${journeyResults.WITH_FLEE.FIGHTER.avgKills} kills)`, Ranger: `${journeyResults.WITH_FLEE.RANGER.completionRate}%`, Cleric: `${journeyResults.WITH_FLEE.CLERIC.completionRate}% (avg ${journeyResults.WITH_FLEE.CLERIC.avgKills} kills)` }
]);
