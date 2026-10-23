#!/usr/bin/env node
/**
 * DARKGRID — PHASE 7C: Cleric Divine Combat System Monte Carlo Simulation Suite
 *
 * Uses the REAL implemented combat domain functions from src/domain/:
 * - src/domain/character/rules.js (calculateCanonicalMaxHp, getEffectiveStats, calculateMaxDivineCharges, getClericSelfHealInfo, getModifier)
 * - src/domain/combat/rules.js (calculateHeroAttackBonus, calculateHeroAC, rollInitiative, resolveAttackRoll, rollHeroDamage)
 * - src/domain/combat/abilities.js (
 *     getClericBattlePrayerProfile, getClericSmiteProfile, getClericDivineShieldProfile, applyDivineShieldMitigation,
 *     resolveMonsterTurnSpecials, resolveMonsterOnHitEffects, resolveEndOfRoundStatusTicks,
 *     resolveClericTurnUndead, resolveFighterSecondWind, modifyHeroAttackDamageAndState, getActiveStatusModifiers
 *   )
 * - src/domain/combat/knowledge.js (evaluateHeroMonsterKnowledge)
 * - src/domain/combat/dice.js (rollDice)
 *
 * Runs >= 2,000 Monte Carlo trials per matchup across Levels 1, 3, 5, 7, and 10,
 * plus 10-, 15-, and 20-encounter consecutive wilderness expeditions without city rest
 * across all 5 required Cleric strategies and the pre-7C Legacy Cleric baseline.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createTestDb } = require('../tests/test_helpers');
const config = require('../src/config');
const {
  calculateCanonicalMaxHp,
  calculateMaxDivineCharges,
  getClericSelfHealInfo,
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
  getClericBattlePrayerProfile,
  getClericSmiteProfile,
  getClericDivineShieldProfile,
  applyDivineShieldMitigation,
  resolveClericTurnUndead,
  modifyHeroAttackDamageAndState,
  resolveMonsterTurnSpecials,
  resolveMonsterOnHitEffects,
  resolveEndOfRoundStatusTicks,
  resolveFighterSecondWind,
  getActiveStatusModifiers
} = require('../src/domain/combat/abilities');
const {
  evaluateHeroMonsterKnowledge
} = require('../src/domain/combat/knowledge');
const { rollDice } = require('../src/domain/combat/dice');

const TRIALS = Number(process.env.PHASE7C_SIM_TRIALS || 2000);
const EXPEDITION_TRIALS = Number(process.env.PHASE7C_EXP_TRIALS || 2000);

function createSeededRng(seed = 7072027) {
  let state = seed >>> 0;
  return function rng() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000000) / 1000000;
  };
}

function buildStandardEquipmentForLevel(classType, level) {
  const cls = classType.toUpperCase();
  const enh = level >= 9 ? 2 : (level >= 5 ? 1 : 0);
  const ringBonus = level >= 6 ? 1 : 0;
  const cloakBonus = level >= 4 ? 1 : 0;
  const beltAttrs = level >= 7
    ? (cls === 'RANGER'
        ? { dexterity_bonus: 2 }
        : (cls === 'CLERIC'
            ? { strength_bonus: 2, wisdom_bonus: level >= 9 ? 2 : 0 }
            : { strength_bonus: 2, constitution_bonus: level >= 9 ? 2 : 0 }))
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
      damage_bonus: 0,
      is_two_handed: 0
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
      name: 'Light Steel Shield',
      category: 'SHIELD',
      shield_bonus: 2,
      enhancement_bonus: level >= 6 ? 1 : 0
    },
    ring: ringBonus ? { name: 'Ring of Protection +1', category: 'ACCESSORY', equip_slot: 'RING', attributes: { ac_bonus: ringBonus } } : null,
    cloak: cloakBonus ? { name: 'Cloak of Resistance +1', category: 'ACCESSORY', equip_slot: 'CLOAK', attributes: { save_bonus: cloakBonus } } : null,
    belt: Object.keys(beltAttrs).length ? { name: 'Belt of Sacred Might', category: 'ACCESSORY', equip_slot: 'BELT', attributes: beltAttrs } : null
  };
}

function buildHeroForSimulation(classType, level, options = {}) {
  const cls = classType.toUpperCase();
  const baseStats = { ...(options.baseStats || config.classBases[cls]) };
  const milestonesEarned = [2, 4, 6, 8, 10].filter(m => level >= m).length;

  for (let i = 0; i < milestonesEarned; i++) {
    if (cls === 'FIGHTER') {
      if (i === 2) baseStats.constitution += 1;
      else baseStats.strength += 1;
    } else if (cls === 'RANGER') {
      if (i === 2) baseStats.constitution += 1;
      else baseStats.dexterity += 1;
    } else {
      // Cleric invests milestone points in STR (bringing 13->14 at L2, 15->16 at L8) and WIS/CON
      if (i === 0) baseStats.strength += 1;
      else if (i === 1) baseStats.constitution += 1;
      else if (i === 2) baseStats.constitution += 1;
      else if (i === 3) baseStats.wisdom += 1;
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
    favored_enemy_family: options.favoredEnemyFamily || (cls === 'RANGER' ? 'GOBLINOIDS' : null),
    monsterVictories: options.victories !== undefined ? options.victories : 1
  };

  const effectiveHero = getEffectiveStats(rawHero, equipment);
  const maxHp = calculateCanonicalMaxHp(level, cls, getModifier(effectiveHero.constitution));
  const maxDivineCharges = cls === 'CLERIC'
    ? calculateMaxDivineCharges(level, 'CLERIC', getModifier(effectiveHero.wisdom))
    : 0;

  effectiveHero.max_hp = maxHp;
  effectiveHero.current_hp = options.currentHp !== undefined ? options.currentHp : maxHp;
  effectiveHero.max_divine_charges = maxDivineCharges;
  effectiveHero.divine_charges = options.divineCharges !== undefined ? options.divineCharges : maxDivineCharges;
  effectiveHero._equipment = equipment;

  if (options.monster) {
    const knowledge = evaluateHeroMonsterKnowledge(null, effectiveHero, options.monster);
    effectiveHero._learnedDamageBonus = knowledge.learnedDamageBonus;
    effectiveHero._learnedAcBonus = knowledge.learnedAcBonus;
  }

  return { hero: effectiveHero, equipment };
}

/**
 * Selects the Cleric's combat action for the current round according to the strategy under test.
 */
function selectClericAction({
  strategy,
  hero,
  heroHp,
  maxHp,
  divineCharges,
  divineShieldTurns,
  potionsRemaining,
  monster,
  monsterHp
}) {
  const hpRatio = heroHp / maxHp;
  const isUndead = String(monster.creature_type || '').toUpperCase().includes('UNDEAD') ||
    String(monster.monster_family || '').toUpperCase() === 'UNDEAD';
  const isHighDanger = Number(monster.attack_bonus || 0) >= hero.level + 4 ||
    Number(monster.challenge_rating || 0) >= hero.level;

  // Emergency potion threshold if critically wounded and out of charges (or against lethal bosses)
  if (potionsRemaining > 0 && hpRatio <= 0.25 && (divineCharges === 0 || strategy === 'LEGACY_CLERIC' || strategy === 'ORDINARY_ATTACK_APPROPRIATE')) {
    return 'DRINK_POTION';
  }

  if (strategy === 'LEGACY_CLERIC') {
    if (potionsRemaining > 0 && hpRatio <= 0.35) return 'DRINK_POTION';
    return 'ATTACK';
  }

  if (strategy === 'AGGRESSIVE_SMITE') {
    if (potionsRemaining > 0 && hpRatio <= 0.28) return 'DRINK_POTION';
    if (divineCharges >= 1) return 'SMITE';
    return 'ATTACK';
  }

  if (strategy === 'DEFENSIVE_DIVINE_SHIELD') {
    if (hpRatio <= 0.45 && divineCharges >= 1) return 'BATTLE_PRAYER';
    if (divineShieldTurns === 0 && divineCharges >= 2 && monsterHp > 6) return 'DIVINE_SHIELD';
    if (potionsRemaining > 0 && hpRatio <= 0.28) return 'DRINK_POTION';
    return 'ATTACK';
  }

  if (strategy === 'HEALING_BATTLE_PRAYER') {
    if (hpRatio <= 0.72 && divineCharges >= 1) return 'BATTLE_PRAYER';
    if (potionsRemaining > 0 && hpRatio <= 0.25) return 'DRINK_POTION';
    return 'ATTACK';
  }

  if (strategy === 'ORDINARY_ATTACK_APPROPRIATE') {
    // Conserves Divine Charges for genuine emergencies or Undead threats
    if (hpRatio <= 0.42 && divineCharges >= 1) return 'BATTLE_PRAYER';
    if (isUndead && isHighDanger && divineCharges >= 3 && monsterHp > 12) return 'SMITE';
    if (potionsRemaining > 0 && hpRatio <= 0.28) return 'DRINK_POTION';
    return 'ATTACK';
  }

  // Default: BALANCED_TACTICAL
  // 1. If wounded (<= 58% HP), use Battle Prayer to attack + heal simultaneously
  if (hpRatio <= 0.58 && divineCharges >= 1) {
    return 'BATTLE_PRAYER';
  }
  // 2. Against dangerous high-attack enemies (like Mummy/Ogre/Troll), put up Divine Shield on opening round if unshielded and charges >= 4
  if (divineShieldTurns === 0 && isHighDanger && !isUndead && divineCharges >= 4 && monsterHp >= 18 && hpRatio <= 0.85) {
    return 'DIVINE_SHIELD';
  }
  // 3. Against Undead (where Smite gains +1d8 extra radiant dice) or dangerous foes when charges are plentiful, use Smite
  if (isUndead && divineCharges >= 1) {
    return 'SMITE';
  }
  if (divineCharges >= 3 && monsterHp >= 10) {
    return 'SMITE';
  }
  if (potionsRemaining > 0 && hpRatio <= 0.30) {
    return 'DRINK_POTION';
  }
  return 'ATTACK';
}

/**
 * Simulates a single combat encounter using the real Phase 7B + 7C domain rules.
 */
function simulateSingleBout(classType, level, monster, rng, options = {}) {
  const { hero, equipment } = options.cachedHeroBundle
    ? options.cachedHeroBundle
    : buildHeroForSimulation(classType, level, {
        ...options,
        monster
      });

  const strategy = options.strategy || (classType === 'CLERIC' ? 'BALANCED_TACTICAL' : 'STANDARD');
  const isRanged = hero.primary_weapon === 'RANGED' && Boolean(equipment.rangedWeapon);
  const activeWeapon = isRanged ? equipment.rangedWeapon : equipment.meleeWeapon;

  let heroHp = options.startingHp !== undefined ? options.startingHp : hero.max_hp;
  let divineCharges = classType === 'CLERIC'
    ? (strategy === 'LEGACY_CLERIC' ? 0 : (options.startingDivineCharges !== undefined ? options.startingDivineCharges : hero.max_divine_charges))
    : 0;
  let potionsRemaining = options.startingPotions !== undefined ? options.startingPotions : 2;
  const potionFormula = level >= 8 ? '3d8+5' : (level >= 5 ? '2d8+3' : '1d8+1');

  let monsterHp = Number(monster.base_hp || 10);
  const monsterMaxHp = monsterHp;
  const encounterObj = {
    ...monster,
    monster_name: monster.name,
    monster_ac: monster.armor_class,
    monster_ab: monster.attack_bonus,
    monster_damage_dice: monster.damage_dice,
    monster_max_hp: monsterMaxHp
  };

  const combatState = parseCombatStateJson('{}');
  let secondWindTriggered = false;
  let battlePrayersUsed = 0;
  let smitesUsed = 0;
  let divineShieldsUsed = 0;
  let potionsUsed = 0;
  let chargesSpent = 0;

  // 1. Ranger Ranged Opening Shot (when spotted in Stage 1, 75% spot rate for Rangers)
  if (classType === 'RANGER' && isRanged && rng() < 0.75) {
    const openBonus = calculateHeroAttackBonus(hero, activeWeapon, encounterObj, equipment);
    const openAtk = resolveAttackRoll(openBonus, monster.armor_class, rng);
    if (openAtk.isHit) {
      const openDmg = rollHeroDamage(hero, activeWeapon, encounterObj, openAtk.isCrit, rng, equipment);
      monsterHp = Math.max(1, monsterHp - openDmg);
    }
  }

  // 2. Cleric Turn Undead opening disruption (Level 2+ vs Undead)
  if (classType === 'CLERIC') {
    resolveClericTurnUndead(hero, equipment, encounterObj, combatState, () => {});
  }

  const heroInit = rollInitiative(getModifier(hero.dexterity), rng);
  const monsterInit = rollInitiative(Number(monster.initiative_bonus || 0), rng);
  const heroFirst = heroInit >= monsterInit;

  let rounds = 0;
  const maxRounds = 50;

  function doHeroTurn() {
    if (combatState.heroStatuses.paralyzed > 0) {
      combatState.heroStatuses.paralyzed = 0;
      return;
    }

    let action = 'ATTACK';
    if (classType === 'CLERIC') {
      action = selectClericAction({
        strategy,
        hero,
        heroHp,
        maxHp: hero.max_hp,
        divineCharges,
        divineShieldTurns: combatState.divineShieldTurns,
        potionsRemaining,
        monster: encounterObj,
        monsterHp
      });
    } else if (potionsRemaining > 0 && heroHp <= Math.floor(hero.max_hp * 0.35)) {
      action = 'DRINK_POTION';
    }

    if (action === 'DRINK_POTION' && potionsRemaining > 0) {
      potionsRemaining -= 1;
      potionsUsed += 1;
      const healRoll = rollDice(potionFormula, rng);
      heroHp = Math.min(hero.max_hp, heroHp + Math.max(1, healRoll.total));
      if (combatState.heroStatuses.bleed) combatState.heroStatuses.bleed = null;
      return;
    }

    if (action === 'DIVINE_SHIELD' && divineCharges >= 2 && combatState.divineShieldTurns === 0) {
      divineCharges -= 2;
      chargesSpent += 2;
      divineShieldsUsed += 1;
      const shieldProf = getClericDivineShieldProfile(hero, equipment);
      combatState.divineShieldTurns = shieldProf.durationTurns;
      combatState.divineShieldReduction = shieldProf.damageReduction;
      return;
    }

    // Weapon attack actions: ATTACK, BATTLE_PRAYER, SMITE
    if (action === 'BATTLE_PRAYER' && divineCharges >= 1) {
      divineCharges -= 1;
      chargesSpent += 1;
      battlePrayersUsed += 1;
    } else if (action === 'SMITE' && divineCharges >= 1) {
      divineCharges -= 1;
      chargesSpent += 1;
      smitesUsed += 1;
    } else {
      action = 'ATTACK';
    }

    const statusMods = getActiveStatusModifiers(combatState);
    const effectiveHeroAB = calculateHeroAttackBonus(hero, activeWeapon, encounterObj, equipment) + statusMods.atkMod;
    const effectiveMonsterAC = Math.max(1, (monster.armor_class || 10) - (combatState.bloodFrenzyActive ? 2 : 0));
    const atkRoll = resolveAttackRoll(effectiveHeroAB, effectiveMonsterAC, rng);

    if (atkRoll.isHit) {
      const dmgRes = rollHeroDamage(hero, activeWeapon, encounterObj, atkRoll.isCrit, rng, equipment);
      const rawWepDmg = Math.max(1, Number(dmgRes) + statusMods.dmgMod);

      let bonusRadiant = 0;
      if (action === 'SMITE') {
        const smiteProf = getClericSmiteProfile(hero, equipment, encounterObj);
        const radRoll = rollDice(smiteProf.radiantDice, rng, 1);
        bonusRadiant = Math.max(1, radRoll.total + smiteProf.flatRadiantBonus);
      }

      const modRes = modifyHeroAttackDamageAndState({
        character: hero,
        activeWeapon,
        encounter: encounterObj,
        combatState,
        heroAttackRoll: atkRoll,
        rawHeroDamage: rawWepDmg,
        bonusRadiantDamage: bonusRadiant,
        forceMagical: action === 'BATTLE_PRAYER' || action === 'SMITE',
        currentMonsterHp: monsterHp,
        monsterMaxHp,
        logEvent: () => {}
      });

      monsterHp = modRes.newMonsterHp;

      if (action === 'BATTLE_PRAYER' && !modRes.evaded) {
        const prayerProf = getClericBattlePrayerProfile(hero, equipment);
        const healRoll = rollDice(prayerProf.dice, rng, 1);
        const rawHeal = Math.max(1, healRoll.total + prayerProf.flatBonus);
        heroHp = Math.min(hero.max_hp, heroHp + rawHeal);
      }
    }
  }

  function doMonsterTurn(roundNum) {
    const statusMods = getActiveStatusModifiers(combatState);
    const effectiveHeroAC = calculateHeroAC(hero, equipment, isRanged, encounterObj, activeWeapon) + statusMods.acMod;

    const turnSpecials = resolveMonsterTurnSpecials({
      character: hero,
      equipment,
      encounter: encounterObj,
      combatState,
      roundNumber: roundNum,
      currentHeroHp: heroHp,
      currentMonsterHp: monsterHp,
      monsterMaxHp,
      rng,
      logEvent: () => {}
    });

    heroHp = turnSpecials.newHeroHp;
    monsterHp = turnSpecials.newMonsterHp;

    if (heroHp > 0 && !turnSpecials.usedBreathOrVolley) {
      const mAb = Number(monster.attack_bonus || 0) + turnSpecials.monsterAbBonus;
      const mAtkRoll = resolveAttackRoll(mAb, effectiveHeroAC, rng);
      if (mAtkRoll.isHit) {
        const mult = mAtkRoll.isCrit ? 2 : 1;
        let rawMonsterDmg = rollDice(monster.damage_dice || '1d4', rng, mult).total + turnSpecials.bloodFrenzyDmgBonus;
        if (turnSpecials.bonusDamageFormula) {
          rawMonsterDmg += rollDice(turnSpecials.bonusDamageFormula, rng, 1).total;
        }
        rawMonsterDmg = Math.max(1, rawMonsterDmg);
        const shieldRes = applyDivineShieldMitigation(rawMonsterDmg, combatState);
        heroHp = Math.max(0, heroHp - shieldRes.finalDamage);

        if (heroHp > 0) {
          const onHit = resolveMonsterOnHitEffects({
            character: hero,
            equipment,
            encounter: encounterObj,
            combatState,
            monsterAttackRoll: mAtkRoll,
            heroAC: effectiveHeroAC,
            currentHeroHp: heroHp,
            currentMonsterHp: monsterHp,
            monsterMaxHp,
            rng,
            logEvent: () => {}
          });
          heroHp = onHit.newHeroHp;
          monsterHp = onHit.newMonsterHp;
        }
      }
    }

    if (combatState.divineShieldTurns > 0) {
      combatState.divineShieldTurns = Math.max(0, combatState.divineShieldTurns - 1);
      if (combatState.divineShieldTurns === 0) {
        combatState.divineShieldReduction = 0;
      }
    }

    if (!combatState.calcifyInstantDeath) {
      const sw = resolveFighterSecondWind({
        character: hero,
        equipment,
        currentHp: heroHp,
        maxHp: hero.max_hp,
        combatState,
        isCalcifiedKilled: combatState.calcifyInstantDeath,
        rng
      });
      if (sw.triggered) {
        heroHp = sw.currentHp;
        secondWindTriggered = true;
      }
    }

    if (level === 1 && roundNum === 1 && heroHp <= 0 && !combatState.calcifyInstantDeath) {
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
      if (!combatState.calcifyInstantDeath) {
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
  }

  return {
    won: heroHp > 0 && monsterHp <= 0,
    rounds,
    endingHp: Math.max(0, heroHp),
    maxHp: hero.max_hp,
    remainingHpRatio: Math.max(0, heroHp) / hero.max_hp,
    endingDivineCharges: divineCharges,
    maxDivineCharges: hero.max_divine_charges,
    chargesSpent,
    battlePrayersUsed,
    smitesUsed,
    divineShieldsUsed,
    potionsUsed,
    endingPotions: potionsRemaining,
    secondWindTriggered
  };
}

function runMatchupSeries(classType, level, monster, rng, options = {}) {
  let wins = 0;
  let totalRounds = 0;
  let totalRemainingHpRatio = 0;
  let totalChargesSpent = 0;
  let totalPrayers = 0;
  let totalSmites = 0;
  let totalShields = 0;
  let totalPotions = 0;

  const cachedHeroBundle = buildHeroForSimulation(classType, level, {
    ...options,
    monster
  });
  const runOpts = { ...options, cachedHeroBundle };

  for (let i = 0; i < TRIALS; i++) {
    const res = simulateSingleBout(classType, level, monster, rng, runOpts);
    if (res.won) {
      wins++;
      totalRemainingHpRatio += res.remainingHpRatio;
    }
    totalRounds += res.rounds;
    totalChargesSpent += res.chargesSpent;
    totalPrayers += res.battlePrayersUsed;
    totalSmites += res.smitesUsed;
    totalShields += res.divineShieldsUsed;
    totalPotions += res.potionsUsed;
  }

  return {
    classType,
    strategy: options.strategy || (classType === 'CLERIC' ? 'BALANCED_TACTICAL' : 'STANDARD'),
    level,
    monsterName: monster.name,
    monsterFamily: monster.monster_family,
    monsterCr: monster.challenge_rating,
    trials: TRIALS,
    winRate: Number(((wins / TRIALS) * 100).toFixed(2)),
    avgRounds: Number((totalRounds / TRIALS).toFixed(2)),
    avgWinHpPct: wins > 0 ? Number(((totalRemainingHpRatio / wins) * 100).toFixed(1)) : 0,
    avgChargesSpent: Number((totalChargesSpent / TRIALS).toFixed(2)),
    avgPrayers: Number((totalPrayers / TRIALS).toFixed(2)),
    avgSmites: Number((totalSmites / TRIALS).toFixed(2)),
    avgShields: Number((totalShields / TRIALS).toFixed(2)),
    avgPotionsUsed: Number((totalPotions / TRIALS).toFixed(2))
  };
}

/**
 * Simulates a multi-encounter wilderness expedition (10, 15, or 20 consecutive encounters without city rest)
 * for a Cleric at a given level and strategy.
 * Accounts for:
 * - Persistent HP loss across encounters
 * - Separate Out-of-Combat Self-Healing (cleric_heal_uses: 2 at L1-4, 3 at L5-8, 4 at L9+)
 * - Persistent Divine Charges (never recharging between encounters)
 * - Limited healing potions (3 per expedition)
 * - Permadeath (expedition ends immediately if Cleric dies)
 */
function simulateExpeditionSeries(level, targetEncounters, strategy, encounterPool, rng) {
  let completedFullExpedition = 0;
  let totalEncountersSurvived = 0;
  let totalSafeEncountersBeforeReturn = 0;
  let totalChargesSpent = 0;
  let totalSelfHealsUsed = 0;
  let totalPotionsUsed = 0;
  let totalPrayers = 0;
  let totalSmites = 0;
  let totalShields = 0;

  const cachedHeroBundle = buildHeroForSimulation('CLERIC', level);
  const { hero } = cachedHeroBundle;
  const selfHealInfo = getClericSelfHealInfo(level);
  const wisMod = getModifier(hero.wisdom);
  const potionFormula = level >= 8 ? '3d8+5' : (level >= 5 ? '2d8+3' : '1d8+1');

  for (let t = 0; t < EXPEDITION_TRIALS; t++) {
    let currentHp = hero.max_hp;
    let divineCharges = strategy === 'LEGACY_CLERIC' ? 0 : hero.max_divine_charges;
    let selfHealUsesRemaining = selfHealInfo.maxUses;
    let potionsRemaining = 3;
    let encountersSurvived = 0;
    let safeBeforeCityReturn = 0;
    let recordedReturnThreshold = false;

    for (let encIdx = 0; encIdx < targetEncounters; encIdx++) {
      const monster = encounterPool[Math.floor(rng() * encounterPool.length)];
      const knowledge = evaluateHeroMonsterKnowledge(null, { ...hero, monsterVictories: encIdx >= 3 ? 3 : (encIdx >= 1 ? 1 : 0) }, monster);
      hero._learnedDamageBonus = knowledge.learnedDamageBonus;
      hero._learnedAcBonus = knowledge.learnedAcBonus;
      const bout = simulateSingleBout('CLERIC', level, monster, rng, {
        cachedHeroBundle,
        strategy,
        startingHp: currentHp,
        startingDivineCharges: divineCharges,
        startingPotions: potionsRemaining,
        victories: encIdx >= 3 ? 3 : (encIdx >= 1 ? 1 : 0)
      });

      totalChargesSpent += bout.chargesSpent;
      totalPotionsUsed += bout.potionsUsed;
      totalPrayers += bout.battlePrayersUsed;
      totalSmites += bout.smitesUsed;
      totalShields += bout.divineShieldsUsed;

      if (!bout.won) {
        // Permadeath!
        break;
      }

      encountersSurvived += 1;
      currentHp = bout.endingHp;
      divineCharges = bout.endingDivineCharges;
      potionsRemaining = bout.endingPotions;

      // Out-of-combat recovery between encounters:
      // 1) Use separate Cleric Self-Healing (cleric_heal_uses) when damaged below 75% Max HP
      while (selfHealUsesRemaining > 0 && currentHp <= Math.floor(hero.max_hp * 0.75)) {
        selfHealUsesRemaining -= 1;
        totalSelfHealsUsed += 1;
        const healRoll = rollDice(selfHealInfo.dice, rng, 1);
        const healed = Math.max(1, healRoll.total + wisMod);
        currentHp = Math.min(hero.max_hp, currentHp + healed);
      }

      // 2) If still below 45% HP and out of Self-Healing uses, drink a potion out of combat if available
      while (potionsRemaining > 0 && currentHp <= Math.floor(hero.max_hp * 0.45)) {
        potionsRemaining -= 1;
        totalPotionsUsed += 1;
        const pRoll = rollDice(potionFormula, rng, 1);
        currentHp = Math.min(hero.max_hp, currentHp + Math.max(1, pRoll.total));
      }

      // Check if Cleric should prudently return to city (HP < 45% AND Divine Charges <= 1 AND Self-Heal === 0 AND Potions === 0)
      if (!recordedReturnThreshold && currentHp < Math.floor(hero.max_hp * 0.50) && divineCharges <= 1 && selfHealUsesRemaining === 0 && potionsRemaining === 0) {
        safeBeforeCityReturn = encountersSurvived;
        recordedReturnThreshold = true;
      }
    }

    if (!recordedReturnThreshold) {
      safeBeforeCityReturn = encountersSurvived;
    }

    if (encountersSurvived === targetEncounters) {
      completedFullExpedition += 1;
    }
    totalEncountersSurvived += encountersSurvived;
    totalSafeEncountersBeforeReturn += safeBeforeCityReturn;
  }

  return {
    level,
    targetEncounters,
    strategy,
    maxHp: hero.max_hp,
    maxDivineCharges: strategy === 'LEGACY_CLERIC' ? 0 : hero.max_divine_charges,
    maxSelfHealUses: selfHealInfo.maxUses,
    expeditionSurvivalRate: Number(((completedFullExpedition / EXPEDITION_TRIALS) * 100).toFixed(2)),
    avgEncountersSurvived: Number((totalEncountersSurvived / EXPEDITION_TRIALS).toFixed(2)),
    avgSafeEncountersBeforeCityReturn: Number((totalSafeEncountersBeforeReturn / EXPEDITION_TRIALS).toFixed(2)),
    avgDivineChargesSpent: Number((totalChargesSpent / EXPEDITION_TRIALS).toFixed(2)),
    avgSelfHealsUsed: Number((totalSelfHealsUsed / EXPEDITION_TRIALS).toFixed(2)),
    avgPotionsUsed: Number((totalPotionsUsed / EXPEDITION_TRIALS).toFixed(2)),
    avgBattlePrayers: Number((totalPrayers / EXPEDITION_TRIALS).toFixed(2)),
    avgSmites: Number((totalSmites / EXPEDITION_TRIALS).toFixed(2)),
    avgDivineShields: Number((totalShields / EXPEDITION_TRIALS).toFixed(2))
  };
}

function main() {
  const db = createTestDb();
  const rng = createSeededRng(20261023);
  const allMonsters = db.prepare('SELECT * FROM monsters ORDER BY id ASC').all();

  function findMonster(name) {
    const m = allMonsters.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!m) throw new Error(`Monster not found in DB: ${name}`);
    return m;
  }

  // Verify #36 Mummy dangerous stats are untouched
  const mummy = findMonster('Mummy');
  if (mummy.base_hp !== 45 || mummy.armor_class !== 20 || mummy.attack_bonus !== 14 || mummy.damage_dice !== '1d8+10') {
    throw new Error(`CRITICAL: Mummy (#36) statistics were altered! Found: ${JSON.stringify(mummy)}`);
  }

  const targetMonsters = [
    { name: 'Goblin', testLevels: [1, 3] },
    { name: 'Human Skeleton', testLevels: [1, 3] },
    { name: 'Ghoul', testLevels: [1, 3, 5] },
    { name: 'Bugbear', testLevels: [3, 5] },
    { name: 'Ogre', testLevels: [3, 5, 7] },
    { name: 'Wight', testLevels: [3, 5, 7] },
    { name: 'Mummy', testLevels: [5, 7, 10] },
    { name: 'Troll', testLevels: [5, 7, 10] },
    { name: 'Minotaur', testLevels: [5, 7, 10] },
    { name: 'Wraith', testLevels: [7, 10] }
  ];

  const clericStrategies = [
    'LEGACY_CLERIC',
    'BALANCED_TACTICAL',
    'AGGRESSIVE_SMITE',
    'DEFENSIVE_DIVINE_SHIELD',
    'HEALING_BATTLE_PRAYER',
    'ORDINARY_ATTACK_APPROPRIATE'
  ];

  // 1. Single-Encounter Matchup Matrix across Levels 1, 3, 5, 7, 10
  const singleMatchupResults = [];
  for (const entry of targetMonsters) {
    const monster = findMonster(entry.name);
    for (const lvl of entry.testLevels) {
      for (const strat of clericStrategies) {
        singleMatchupResults.push(
          runMatchupSeries('CLERIC', lvl, monster, rng, { strategy: strat, victories: 1 })
        );
      }
      // Also run Fighter and Ranger reference benchmarks at the same level
      singleMatchupResults.push(
        runMatchupSeries('FIGHTER', lvl, monster, rng, { victories: 1 })
      );
      singleMatchupResults.push(
        runMatchupSeries('RANGER', lvl, monster, rng, {
          favoredEnemyFamily: monster.monster_family === 'UNDEAD' ? 'GOBLINOIDS' : monster.monster_family,
          victories: 1
        })
      );
    }
  }

  // 2. Full Level 1, 3, 5, 7, 10 Primary Benchmark Table (Legacy Cleric vs New Cleric vs Fighter vs Ranger)
  const levelRepresentativeMap = [
    { level: 1, monsters: ['Goblin', 'Human Skeleton'] },
    { level: 3, monsters: ['Bugbear', 'Ghoul'] },
    { level: 5, monsters: ['Ogre', 'Wight', 'Mummy'] },
    { level: 7, monsters: ['Troll', 'Mummy', 'Minotaur'] },
    { level: 10, monsters: ['Troll', 'Wraith', 'Mummy'] }
  ];

  const primaryLevelBenchmarks = [];
  for (const row of levelRepresentativeMap) {
    for (const mName of row.monsters) {
      const m = findMonster(mName);
      primaryLevelBenchmarks.push({
        level: row.level,
        monsterName: mName,
        monsterFamily: m.monster_family,
        legacyCleric: runMatchupSeries('CLERIC', row.level, m, rng, { strategy: 'LEGACY_CLERIC', victories: 1 }),
        newClericBalanced: runMatchupSeries('CLERIC', row.level, m, rng, { strategy: 'BALANCED_TACTICAL', victories: 1 }),
        newClericSmite: runMatchupSeries('CLERIC', row.level, m, rng, { strategy: 'AGGRESSIVE_SMITE', victories: 1 }),
        newClericShield: runMatchupSeries('CLERIC', row.level, m, rng, { strategy: 'DEFENSIVE_DIVINE_SHIELD', victories: 1 }),
        newClericPrayer: runMatchupSeries('CLERIC', row.level, m, rng, { strategy: 'HEALING_BATTLE_PRAYER', victories: 1 }),
        fighter: runMatchupSeries('FIGHTER', row.level, m, rng, { victories: 1 }),
        ranger: runMatchupSeries('RANGER', row.level, m, rng, {
          favoredEnemyFamily: m.monster_family === 'UNDEAD' ? 'GOBLINOIDS' : m.monster_family,
          victories: 1
        })
      });
    }
  }

  // 3. Consecutive Wilderness Expeditions (10, 15, and 20 encounters without city rest) across Levels 1, 3, 5, 7, 10
  const expeditionPoolsByLevel = {
    1: [findMonster('Goblin'), findMonster('Kobold'), findMonster('Human Skeleton'), findMonster('Dire Rat')],
    3: [findMonster('Goblin'), findMonster('Human Skeleton'), findMonster('Human Zombie'), findMonster('Ghoul'), findMonster('Bugbear')],
    5: [findMonster('Bugbear'), findMonster('Ghoul'), findMonster('Ogre'), findMonster('Wight')],
    7: [findMonster('Ogre'), findMonster('Wight'), findMonster('Troll'), findMonster('Minotaur'), findMonster('Mummy')],
    10: [findMonster('Troll'), findMonster('Minotaur'), findMonster('Wight'), findMonster('Wraith'), findMonster('Mummy')]
  };

  const expeditionResults = [];
  for (const lvl of [1, 3, 5, 7, 10]) {
    const pool = expeditionPoolsByLevel[lvl];
    for (const encCount of [10, 15, 20]) {
      for (const strat of clericStrategies) {
        expeditionResults.push(
          simulateExpeditionSeries(lvl, encCount, strat, pool, rng)
        );
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    trialsPerMatchup: TRIALS,
    expeditionTrials: EXPEDITION_TRIALS,
    mummyVerifiedStats: {
      id: mummy.id,
      name: mummy.name,
      base_hp: mummy.base_hp,
      armor_class: mummy.armor_class,
      attack_bonus: mummy.attack_bonus,
      damage_dice: mummy.damage_dice,
      challenge_rating: mummy.challenge_rating,
      monster_family: mummy.monster_family
    },
    primaryLevelBenchmarks,
    expeditionResults,
    singleMatchupResults
  };

  const outDir = path.join(__dirname, '..', 'action-ui-lab', 'docs', 'phase-7c');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'simulation-results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Phase 7C Monte Carlo Simulations complete (${TRIALS} trials/matchup, ${EXPEDITION_TRIALS} expeditions/series).`);
  console.log(`Saved results to: ${outPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  simulateSingleBout,
  runMatchupSeries,
  simulateExpeditionSeries
};
