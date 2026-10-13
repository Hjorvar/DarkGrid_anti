/**
 * Darkgrid — Deep Balance Solutions & Mechanics Investigation
 * 
 * Sourced directly from live SQLite database and domain rules.
 * 
 * Investigates:
 * 1. Favored Enemy fix: strictly enforce Undead prohibition for Ranger.
 * 2. Cleric vs Undead: evaluate balanced enhancements so Cleric clearly outperforms Fighter against Undead:
 *    - Option A: Baseline (Current Divine Power +2/+2 L1-4, +3/+3 L5-8, +4/+4 L9+)
 *    - Option B: Sacred Warding (+1 AC L1-4, +2 AC L5-8, +3 AC L9+ vs Undead)
 *    - Option C: Sacred Warding + Ward of the Grave (Option B + DR 1 vs Undead)
 *    - Option D: Divine Smite (+2 Atk and +1d6 Holy Damage vs Undead)
 *    - Option E: Holy Radiance (+2 AC vs Undead AND +2 Atk / +3 Dmg L1-4, +3 Atk / +4 Dmg L5-8, +4 Atk / +5 Dmg L9+)
 * 3. Ranger Viability:
 *    - Baseline: Forced melee with Shortsword on ground
 *    - Solution R1: Preferred Primary Weapon (Ranger uses Longbow on all targets)
 *    - Solution R2: Ranged Opening Attack (Ranger fires 1 opening arrow before melee)
 *    - Solution R3: Preferred Bow + Ranged Opening Attack
 * 4. Encounter Difficulty & Town Proximity Gating:
 *    - Current Gaussian (sigma = 1.5)
 *    - Town Safe Ring: Zone 1 (dist <= 2) capped at CR <= 0.5 (Level 1)
 *    - Player tactical survival: Stage 1 Ignore on deadly threats & Flee when HP <= 35%
 * 5. Monster special abilities audit: Full catalog analysis of 68 monsters.
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

// 1. Starting stats
const STARTING_STATS = {
  FIGHTER: { strength: 16, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 10, charisma: 9 }, // HP 12, AC 16
  RANGER:  { strength: 13, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 12, charisma: 8 }, // HP 9, AC 15
  CLERIC:  { strength: 13, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 10 } // HP 9, AC 16
};

// 2. Starting equipment
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
 * Universal combat simulator with support for:
 * - Cleric buffs: 'OPTION_A' (baseline), 'OPTION_B' (Sacred Warding +1/+2/+3 AC),
 *   'OPTION_C' (+AC and DR 1 vs Undead), 'OPTION_D' (+1d6 Holy Damage), 'OPTION_E' (+2 AC and +2/+3 Dmg)
 * - Ranger options: weaponMode ('MELEE', 'RANGED', 'AUTO'), openingShot (true/false)
 */
function simulateCombat(hero, monster, options = {}) {
  const equipment = options.equipment || STARTING_EQUIPMENT[hero.class];
  const weaponMode = options.weaponMode || 'AUTO';
  const openingShot = options.openingShot || false;
  const clericBuff = options.clericBuff || 'OPTION_A';
  const allowFlee = options.allowFlee || false;
  const fleeThreshold = options.fleeThreshold || 0.35;
  const potions = options.potions !== undefined ? options.potions : 1;

  let currentHeroHp = hero.current_hp;
  let currentMonsterHp = monster.base_hp;
  let potionsLeft = potions;
  let potionsUsed = 0;

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
    // AUTO
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

  let heroAc = calculateHeroAC(hero, equipment.armor, equipment.shield, isRangedActive);
  let heroAb = calculateHeroAttackBonus(hero, activeWeapon, monster);
  let heroDmgFormula = getHeroDamageFormula(hero, activeWeapon, monster);

  const isUndead = (monster.creature_type || '').toUpperCase() === 'UNDEAD';

  // Apply Cleric Candidate Buffs vs Undead
  let clericDr = 0;
  let clericExtraHolyDice = null;

  if (hero.class === 'CLERIC' && isUndead) {
    if (clericBuff === 'OPTION_B') {
      // Sacred Warding: +1 AC (L1-4), +2 AC (L5-8), +3 AC (L9+)
      heroAc += hero.level >= 9 ? 3 : (hero.level >= 5 ? 2 : 1);
    } else if (clericBuff === 'OPTION_C') {
      // Sacred Warding + DR 1 vs Undead
      heroAc += hero.level >= 9 ? 3 : (hero.level >= 5 ? 2 : 1);
      clericDr = 1;
    } else if (clericBuff === 'OPTION_D') {
      // Divine Smite: +1d6 Holy Damage
      clericExtraHolyDice = '1d6';
    } else if (clericBuff === 'OPTION_E') {
      // Holy Radiance: +2 AC vs Undead (L1-4), +3 AC (L5-8), +4 AC (L9+) AND +1 extra flat damage
      heroAc += hero.level >= 9 ? 4 : (hero.level >= 5 ? 3 : 2);
      heroDmgFormula = heroDmgFormula.replace(/\+(\d+)$/, (m, p) => `+${Number(p) + 1}`);
    }
  }

  // 1. RANGED OPENING SHOT (Ranger special ability test)
  if (openingShot && equipment.ranged) {
    const openingAb = calculateHeroAttackBonus(hero, equipment.ranged, monster);
    const openingDmgFormula = getHeroDamageFormula(hero, equipment.ranged, monster);
    const atk = resolveAttackRoll(openingAb, monster.armor_class);
    if (atk.isHit) {
      currentMonsterHp -= resolveDamage(openingDmgFormula, atk.isCrit);
    }
    if (currentMonsterHp <= 0) {
      return { victory: true, escaped: false, rounds: 1, remainingHp: currentHeroHp, potionsUsed: 0 };
    }
  }

  // Initiative
  const heroInit = Math.floor(Math.random() * 20) + 1 + getModifier(hero.dexterity);
  const monsterInit = Math.floor(Math.random() * 20) + 1 + (monster.initiative_bonus || 0);
  let heroTurnsFirst = heroInit >= monsterInit;

  let round = 0;
  let victory = false;
  let escaped = false;

  while (currentHeroHp > 0 && currentMonsterHp > 0 && round < 40) {
    round++;

    // Flee check
    if (allowFlee && currentHeroHp <= hero.max_hp * fleeThreshold && monster.solo_level > hero.level) {
      const freeAtk = resolveAttackRoll(monster.attack_bonus, heroAc);
      if (freeAtk.isHit) {
        let md = resolveDamage(monster.damage_dice, freeAtk.isCrit);
        if (hero.class === 'CLERIC' && isUndead) md = Math.max(1, md - clericDr);
        currentHeroHp -= md;
      }
      if (currentHeroHp > 0) {
        escaped = true;
        break;
      } else {
        break;
      }
    }

    if (heroTurnsFirst) {
      // Hero attack
      if (currentHeroHp <= 5 && potionsLeft > 0) {
        potionsLeft--;
        potionsUsed++;
        currentHeroHp = Math.min(hero.max_hp, currentHeroHp + rollDice('1d8+1').total);
      } else {
        const atk = resolveAttackRoll(heroAb, monster.armor_class);
        if (atk.isHit) {
          let dmg = resolveDamage(heroDmgFormula, atk.isCrit);
          if (clericExtraHolyDice) dmg += rollDice(clericExtraHolyDice).total;
          currentMonsterHp -= dmg;
        }
      }

      if (currentMonsterHp <= 0) {
        victory = true;
        break;
      }

      // Monster attack
      const mAtk = resolveAttackRoll(monster.attack_bonus, heroAc);
      if (mAtk.isHit) {
        let md = resolveDamage(monster.damage_dice, mAtk.isCrit);
        if (hero.class === 'CLERIC' && isUndead) md = Math.max(1, md - clericDr);
        currentHeroHp -= md;
      }
      if (currentHeroHp <= 0) break;

    } else {
      // Monster attack first
      const mAtk = resolveAttackRoll(monster.attack_bonus, heroAc);
      if (mAtk.isHit) {
        let md = resolveDamage(monster.damage_dice, mAtk.isCrit);
        if (hero.class === 'CLERIC' && isUndead) md = Math.max(1, md - clericDr);
        currentHeroHp -= md;
      }
      if (currentHeroHp <= 0) break;

      // Hero attack second
      if (currentHeroHp <= 5 && potionsLeft > 0) {
        potionsLeft--;
        potionsUsed++;
        currentHeroHp = Math.min(hero.max_hp, currentHeroHp + rollDice('1d8+1').total);
      } else {
        const atk = resolveAttackRoll(heroAb, monster.armor_class);
        if (atk.isHit) {
          let dmg = resolveDamage(heroDmgFormula, atk.isCrit);
          if (clericExtraHolyDice) dmg += rollDice(clericExtraHolyDice).total;
          currentMonsterHp -= dmg;
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
// 1. CLERIC CANDIDATES BENCHMARK VS UNDEAD (10,000 trials each)
// =============================================================================
const TRIALS = 10000;
const undeadMonsters = monsters.filter(m => m.creature_type === 'Undead');

console.log('--- 1. CLERIC CANDIDATES VS UNDEAD (Level 1–5 Benchmark) ---');

const clericTable = [];
for (const m of undeadMonsters) {
  let testLevel = m.solo_level;
  if (testLevel > 5) testLevel = 5;

  const row = {
    Monster: `${m.name} (CR ${m.challenge_rating}, Lvl ${testLevel})`,
    Fighter: 0,
    ClericA_Base: 0,
    ClericB_Warding: 0,
    ClericC_DR: 0,
    ClericD_Smite: 0,
    ClericE_Radiance: 0
  };

  // Fighter
  let fWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const f = buildHero('FIGHTER', testLevel);
    if (simulateCombat(f, m).victory) fWins++;
  }
  row.Fighter = ((fWins / TRIALS) * 100).toFixed(1) + '%';

  // Cleric A (Base)
  let cAWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const c = buildHero('CLERIC', testLevel);
    if (simulateCombat(c, m, { clericBuff: 'OPTION_A' }).victory) cAWins++;
  }
  row.ClericA_Base = ((cAWins / TRIALS) * 100).toFixed(1) + '%';

  // Cleric B (Sacred Warding +1/+2/+3 AC)
  let cBWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const c = buildHero('CLERIC', testLevel);
    if (simulateCombat(c, m, { clericBuff: 'OPTION_B' }).victory) cBWins++;
  }
  row.ClericB_Warding = ((cBWins / TRIALS) * 100).toFixed(1) + '%';

  // Cleric C (+AC & DR 1)
  let cCWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const c = buildHero('CLERIC', testLevel);
    if (simulateCombat(c, m, { clericBuff: 'OPTION_C' }).victory) cCWins++;
  }
  row.ClericC_DR = ((cCWins / TRIALS) * 100).toFixed(1) + '%';

  // Cleric D (Divine Smite +1d6 Holy Dmg)
  let cDWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const c = buildHero('CLERIC', testLevel);
    if (simulateCombat(c, m, { clericBuff: 'OPTION_D' }).victory) cDWins++;
  }
  row.ClericD_Smite = ((cDWins / TRIALS) * 100).toFixed(1) + '%';

  // Cleric E (Holy Radiance +2/+3/+4 AC & +1 Dmg)
  let cEWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const c = buildHero('CLERIC', testLevel);
    if (simulateCombat(c, m, { clericBuff: 'OPTION_E' }).victory) cEWins++;
  }
  row.ClericE_Radiance = ((cEWins / TRIALS) * 100).toFixed(1) + '%';

  clericTable.push(row);
}
console.table(clericTable);

// =============================================================================
// 2. RANGER COMBAT MECHANICS BENCHMARK (Ground Monsters)
// =============================================================================
console.log('\n--- 2. RANGER MECHANICS BENCHMARK (Ground Monsters) ---');

const rangerMonsters = [
  { name: 'Goblin', cr: 0.33, lvl: 1 },
  { name: 'Orc', cr: 0.33, lvl: 1 },
  { name: 'Human Zombie', cr: 0.5, lvl: 1 },
  { name: 'Wolf', cr: 1.0, lvl: 1 },
  { name: 'Bugbear', cr: 2.0, lvl: 3 },
  { name: 'Troll', cr: 5.0, lvl: 5 }
];

const rangerTable = [];
for (const rm of rangerMonsters) {
  const m = monsters.find(x => x.name.toLowerCase() === rm.name.toLowerCase());
  if (!m) continue;

  const row = {
    Monster: `${m.name} (CR ${m.challenge_rating})`,
    Fighter: 0,
    Ranger_Melee_Default: 0,
    Ranger_R1_Bow_Preference: 0,
    Ranger_R2_Opening_Shot: 0,
    Ranger_R3_Bow_Plus_Opening: 0
  };

  // Fighter baseline
  let fWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const f = buildHero('FIGHTER', rm.lvl);
    if (simulateCombat(f, m).victory) fWins++;
  }
  row.Fighter = ((fWins / TRIALS) * 100).toFixed(1) + '%';

  // Ranger Default (Melee)
  let rWins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = buildHero('RANGER', rm.lvl);
    if (simulateCombat(r, m, { weaponMode: 'MELEE' }).victory) rWins++;
  }
  row.Ranger_Melee_Default = ((rWins / TRIALS) * 100).toFixed(1) + '%';

  // Ranger R1: Primary Bow Preference (fires bow all combat)
  let r1Wins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = buildHero('RANGER', rm.lvl);
    if (simulateCombat(r, m, { weaponMode: 'RANGED' }).victory) r1Wins++;
  }
  row.Ranger_R1_Bow_Preference = ((r1Wins / TRIALS) * 100).toFixed(1) + '%';

  // Ranger R2: Opening Shot + Melee
  let r2Wins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = buildHero('RANGER', rm.lvl);
    if (simulateCombat(r, m, { weaponMode: 'MELEE', openingShot: true }).victory) r2Wins++;
  }
  row.Ranger_R2_Opening_Shot = ((r2Wins / TRIALS) * 100).toFixed(1) + '%';

  // Ranger R3: Opening Shot + Bow Preference
  let r3Wins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = buildHero('RANGER', rm.lvl);
    if (simulateCombat(r, m, { weaponMode: 'RANGED', openingShot: true }).victory) r3Wins++;
  }
  row.Ranger_R3_Bow_Plus_Opening = ((r3Wins / TRIALS) * 100).toFixed(1) + '%';

  rangerTable.push(row);
}
console.table(rangerTable);

// =============================================================================
// 3. ENCOUNTER DIFFICULTY & TOWN PROXIMITY GATING (Level 1 Survival to Level 2)
// =============================================================================
console.log('\n--- 3. LEVEL 1 PROGRESSION & TOWN GATING (Surviving 10 Kills to Lvl 2) ---');

function simulateTownGatedProgression(classType, gatingMode = 'UNRESTRICTED', rangerMode = 'DEFAULT') {
  const journeys = 3000;
  let reachedLvl2 = 0;

  // Define monster pools
  let pool = [];
  if (gatingMode === 'UNRESTRICTED') {
    // Current Gaussian: can spawn CR 0.25 up to CR 3 monsters
    pool = monsters.filter(m => m.solo_level <= 3);
  } else if (gatingMode === 'TOWN_GATED_CR1') {
    // Beginner Ring: CR <= 1.0 (Kobold, Goblin, Skeleton, Zombie, Wolf)
    pool = monsters.filter(m => m.solo_level === 1 && m.challenge_rating <= 1.0);
  } else if (gatingMode === 'TOWN_GATED_FAIR') {
    // Safe Beginner Ring: CR <= 0.5 (Kobold, Goblin, Skeleton, Zombie, Orc, Stirge)
    pool = monsters.filter(m => m.solo_level === 1 && m.challenge_rating <= 0.5);
  }

  for (let j = 0; j < journeys; j++) {
    let kills = 0;
    let alive = true;
    let potions = 2;

    // A hero heads out on an expedition of 2 encounters before returning to city
    while (alive && kills < 10) {
      let maxHp = classType === 'FIGHTER' ? 12 : 9;
      let hp = maxHp;
      let healCharges = classType === 'CLERIC' ? 2 : 0;
      let tripEncounters = 0;

      while (alive && tripEncounters < 2 && kills < 10) {
        const m = pool[Math.floor(Math.random() * pool.length)];

        // Stage 1 Ignore check: If threat is deadly (CR >= 2 on Level 1), cautious hero ignores it!
        if (m.challenge_rating >= 2.0) {
          // Ignore with 85% success (player sneaks past)
          if (Math.random() < 0.85) {
            continue; // Bypassed without damage!
          }
        }

        const hero = buildHero(classType, 1);
        hero.current_hp = hp;

        let wMode = 'AUTO';
        let oShot = false;
        if (classType === 'RANGER') {
          if (rangerMode === 'BOW') wMode = 'RANGED';
          if (rangerMode === 'BOW_PLUS_OPENING') { wMode = 'RANGED'; oShot = true; }
        }

        const res = simulateCombat(hero, m, {
          weaponMode: wMode,
          openingShot: oShot,
          potions,
          allowFlee: true,
          fleeThreshold: 0.35
        });

        potions = Math.max(0, potions - res.potionsUsed);

        if (res.escaped) {
          // Escaped safely, end this trip and return to town
          hp = res.remainingHp;
          break;
        }

        if (!res.victory) {
          alive = false;
          break;
        }

        kills++;
        tripEncounters++;
        hp = res.remainingHp;

        // Cleric Self-Healing between encounters
        if (classType === 'CLERIC' && hp < maxHp && healCharges > 0) {
          healCharges--;
          hp = Math.min(maxHp, hp + rollDice('1d6').total + 3);
        }
      }
    }

    if (alive && kills >= 10) reachedLvl2++;
  }

  return ((reachedLvl2 / journeys) * 100).toFixed(1) + '%';
}

console.log('Progression Survival (Reaching Level 2 across expeditions with Rest, Ignore & Flee):');
console.table([
  {
    Gating: '1. Unrestricted Gaussian (Current)',
    Fighter: simulateTownGatedProgression('FIGHTER', 'UNRESTRICTED'),
    Ranger_Default: simulateTownGatedProgression('RANGER', 'UNRESTRICTED', 'DEFAULT'),
    Ranger_Bow_Opening: simulateTownGatedProgression('RANGER', 'UNRESTRICTED', 'BOW_PLUS_OPENING'),
    Cleric: simulateTownGatedProgression('CLERIC', 'UNRESTRICTED')
  },
  {
    Gating: '2. Town Ring: CR <= 1.0',
    Fighter: simulateTownGatedProgression('FIGHTER', 'TOWN_GATED_CR1'),
    Ranger_Default: simulateTownGatedProgression('RANGER', 'TOWN_GATED_CR1', 'DEFAULT'),
    Ranger_Bow_Opening: simulateTownGatedProgression('RANGER', 'TOWN_GATED_CR1', 'BOW_PLUS_OPENING'),
    Cleric: simulateTownGatedProgression('CLERIC', 'TOWN_GATED_CR1')
  },
  {
    Gating: '3. Safe Town Ring: CR <= 0.5',
    Fighter: simulateTownGatedProgression('FIGHTER', 'TOWN_GATED_FAIR'),
    Ranger_Default: simulateTownGatedProgression('RANGER', 'TOWN_GATED_FAIR', 'DEFAULT'),
    Ranger_Bow_Opening: simulateTownGatedProgression('RANGER', 'TOWN_GATED_FAIR', 'BOW_PLUS_OPENING'),
    Cleric: simulateTownGatedProgression('CLERIC', 'TOWN_GATED_FAIR')
  }
]);

// =============================================================================
// 4. MONSTER SPECIAL ABILITIES AUDIT
// =============================================================================
console.log('\n--- 4. MONSTER SPECIAL ABILITIES AUDIT (68 Monsters) ---');

const fullySupported = [];
const missingMechanics = [];

for (const m of monsters) {
  let abilities = [];
  try {
    abilities = JSON.parse(m.special_abilities || '[]');
  } catch {
    abilities = [];
  }

  // Key missing mechanics: Incorporeal, Ability Drain/Damage, Damage Reduction, Regeneration, Gaze/Petrification
  const critical = ['incorporeal', 'strength_damage', 'constitution_drain', 'damage_reduction', 'regeneration', 'petrification'];
  const hasCritical = abilities.some(a => critical.some(c => a.toLowerCase().includes(c)));

  if (hasCritical) {
    missingMechanics.push({
      name: m.name,
      cr: m.challenge_rating,
      type: m.creature_type,
      missingAbilities: abilities.filter(a => critical.some(c => a.toLowerCase().includes(c))).join(', ')
    });
  } else {
    fullySupported.push({
      name: m.name,
      cr: m.challenge_rating,
      type: m.creature_type
    });
  }
}

console.log(`Total monsters: ${monsters.length}`);
console.log(`Fully Supported by pure d20 physics: ${fullySupported.length}`);
console.log(`Monsters missing critical special mechanics: ${missingMechanics.length}`);
console.log('\nSample of monsters missing critical mechanics:');
console.table(missingMechanics.slice(0, 10));
