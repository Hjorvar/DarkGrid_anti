/**
 * Darkgrid Combat Engine
 * Manages turn-by-turn combat execution, initiative, player actions (Attack, Drink Potion, Flee),
 * 9 health condition tracking, Fighter Second Wind (Option B), Cleric Turn Undead,
 * Monster Knowledge & INT/WIS Battle Experience, combat log recording, and permadeath/victory integration.
 */

const { withTransaction } = require('../../db/connection');
const {
  getModifier,
  getCharacterEquipment,
  getCharacterPotions,
  getActiveWeapon,
  getEffectiveStats,
  calculateMaxDivineCharges,
  clampDivineCharges,
  getClericDivineChargeInfo,
  INACTIVE_CONSUMABLE_NAMES
} = require('../character/rules');
const { rollDice } = require('./dice');
const {
  calculateHeroAttackBonus,
  calculateHeroAC,
  getHeroDamageFormula,
  resolveAttackRoll,
  resolveDamage,
  rollInitiative,
  resolvePotionHealing
} = require('./rules');
const {
  describeHeroAttack,
  describeMonsterAttack,
  describePotionDrink,
  describeBattlePrayer,
  describeSmite,
  describeDivineShield,
  describeFleeAttempt
} = require('./narrative');
const { handlePlayerDeath, handleMonsterDefeat } = require('../monsters/persistence');
const { resolveMonsterFamily } = require('../monsters/taxonomy');
const {
  recordMonsterEncountered,
  evaluateHeroMonsterKnowledge
} = require('./knowledge');
const {
  parseCombatStateJson,
  serializeCombatStateJson,
  getFighterSecondWindProfile,
  tryTriggerFighterSecondWind,
  resolveClericTurnUndead,
  getClericBattlePrayerProfile,
  getClericSmiteProfile,
  getClericDivineShieldProfile,
  applyDivineShieldMitigation,
  getActiveStatusModifiers,
  getPublicHeroStatusBadges,
  resolveCombatStartAura,
  modifyHeroAttackDamageAndState,
  resolveMonsterTurnSpecials,
  resolveMonsterOnHitEffects,
  resolveEndOfRoundStatusTicks
} = require('./abilities');

/**
 * Calculates current health bracket (100, 75, 50, 25, 0)
 */
function getHealthBracket(currentHp, maxHp) {
  if (currentHp <= 0) return 0;
  const pct = Math.round((currentHp / maxHp) * 100);
  if (pct <= 25) return 25;
  if (pct <= 50) return 50;
  if (pct <= 75) return 75;
  return 100;
}

/**
 * Resolves the appropriate condition text from monster descriptions for a health bracket.
 */
function getConditionTextForBracket(descriptionsJson, bracket) {
  let desc = {};
  if (typeof descriptionsJson === 'string') {
    try { desc = JSON.parse(descriptionsJson); } catch { desc = {}; }
  } else if (typeof descriptionsJson === 'object' && descriptionsJson !== null) {
    desc = descriptionsJson;
  }

  switch (bracket) {
    case 100: return desc['5_health_100'] || null;
    case 75:  return desc['6_health_75']  || null;
    case 50:  return desc['7_health_50']  || null;
    case 25:  return desc['8_health_25']  || null;
    case 0:   return desc['9_dead']       || null;
    default:  return null;
  }
}

/**
 * Shared query helper that fetches the encounter joined with all monster combat, CR, treasure,
 * subtype metadata, 22-family taxonomy, persistent monster instance fields, and Named Hunting Contract modifiers.
 */
function fetchEncounterWithMonster(db, encounterId, characterId) {
  let row;
  try {
    row = db.prepare(`
      SELECT e.*,
             m.name as base_monster_name,
             m.symbol as monster_symbol,
             m.color as monster_color,
             m.solo_level as monster_level,
             m.base_hp,
             m.initiative_bonus,
             m.descriptions as monster_descriptions,
             m.image_path as monster_image_path,
             m.defeated_image_path as monster_defeated_image_path,
             m.armor_class as monster_ac,
             m.attack_bonus as base_monster_ab,
             m.damage_dice as monster_damage_dice,
             m.xp_reward,
             m.creature_type,
             m.creature_subtype,
             m.monster_family,
             m.movement_type,
             m.challenge_rating,
             m.treasure_type,
             m.special_abilities,
             mi.max_hp as instance_max_hp,
             mi.current_hp as instance_current_hp,
             mi.custom_title as instance_custom_title,
             hc.custom_name as bounty_custom_name,
             hc.title as bounty_title,
             hc.region_name as bounty_region_name,
             hc.boost_type as bounty_boost_type,
             hc.boost_label as bounty_boost_label,
             hc.boosted_max_hp as bounty_boosted_max_hp,
             hc.attack_bonus_mod as bounty_attack_bonus_mod,
             hc.damage_bonus_mod as bounty_damage_bonus_mod,
             hc.reward_gold as bounty_reward_gold,
             hc.status as bounty_status
      FROM encounters e
      JOIN monsters m ON e.monster_id = m.id
      LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
      LEFT JOIN hunting_contracts hc ON e.bounty_contract_id = hc.id
      WHERE e.id = ? AND e.character_id = ?
    `).get(encounterId, characterId);
  } catch {
    row = db.prepare(`
      SELECT e.*,
             m.name as base_monster_name,
             m.symbol as monster_symbol,
             m.color as monster_color,
             m.solo_level as monster_level,
             m.base_hp,
             m.initiative_bonus,
             m.descriptions as monster_descriptions,
             m.image_path as monster_image_path,
             m.defeated_image_path as monster_defeated_image_path,
             m.armor_class as monster_ac,
             m.attack_bonus as base_monster_ab,
             m.damage_dice as monster_damage_dice,
             m.xp_reward,
             m.creature_type,
             m.creature_subtype,
             m.movement_type,
             m.challenge_rating,
             m.treasure_type,
             m.special_abilities,
             mi.max_hp as instance_max_hp,
             mi.current_hp as instance_current_hp,
             mi.custom_title as instance_custom_title
      FROM encounters e
      JOIN monsters m ON e.monster_id = m.id
      LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
      WHERE e.id = ? AND e.character_id = ?
    `).get(encounterId, characterId);
  }

  if (!row) return null;

  const isBountyTarget = Boolean(row.bounty_contract_id && row.bounty_custom_name);
  const customDisplayName = row.bounty_custom_name || row.instance_custom_title || null;
  const attackBonusMod = isBountyTarget ? Number(row.bounty_attack_bonus_mod || 0) : 0;
  const damageBonusMod = isBountyTarget ? Number(row.bounty_damage_bonus_mod || 0) : 0;
  const resolvedFamily = row.monster_family || resolveMonsterFamily({
    id: row.monster_id,
    name: row.base_monster_name,
    creature_type: row.creature_type,
    creature_subtype: row.creature_subtype
  }, { strict: false });

  return {
    ...row,
    monster_name: customDisplayName || row.base_monster_name,
    base_monster_name: row.base_monster_name,
    monster_family: resolvedFamily,
    custom_title: row.instance_custom_title || null,
    isBountyTarget,
    monster_ab: Number(row.base_monster_ab || 0) + attackBonusMod,
    bounty_damage_bonus: damageBonusMod
  };
}

/**
 * Attaches evaluated Monster Knowledge & INT/WIS Battle Experience to the character & encounter objects.
 */
function attachBattleExperienceContext(db, effectiveCharacter, encounter, equipment = null) {
  const monsterKnowledge = evaluateHeroMonsterKnowledge(db, effectiveCharacter, encounter, equipment);
  if (effectiveCharacter && typeof effectiveCharacter === 'object') {
    Object.defineProperty(effectiveCharacter, '_battleExperience', {
      value: monsterKnowledge.battleExperience,
      enumerable: false,
      configurable: true,
      writable: true
    });
    Object.defineProperty(effectiveCharacter, '_monsterKnowledge', {
      value: monsterKnowledge,
      enumerable: false,
      configurable: true,
      writable: true
    });
  }
  if (encounter && typeof encounter === 'object') {
    encounter.victories_against = monsterKnowledge.victories;
  }
  return monsterKnowledge;
}

/**
 * Ensures Level 1 characters can never be in an Ambush state (even for pre-existing DB rows).
 */
function enforceNoAmbushAtLevel1(db, character, encounter) {
  if (character && Number(character.level || 1) <= 1 && encounter && Number(encounter.is_ambush) === 1) {
    db.prepare(`
      UPDATE encounters
      SET is_ambush = 0, spotted_by_hero = 0
      WHERE id = ?
    `).run(encounter.id);
    encounter.is_ambush = 0;
    encounter.spotted_by_hero = 0;
  }
}

/**
 * Helper to persist combat_state_json and second_wind_used on encounters.
 */
function updateEncounterCombatStateSql(tx, encounterId, combatStatusState) {
  const stateJson = serializeCombatStateJson(combatStatusState);
  const secondWindInt = combatStatusState && combatStatusState.secondWindUsed ? 1 : 0;
  try {
    tx.prepare('UPDATE encounters SET combat_state_json = ?, second_wind_used = ? WHERE id = ?').run(
      stateJson,
      secondWindInt,
      encounterId
    );
  } catch {
    tx.prepare('UPDATE encounters SET combat_state_json = ? WHERE id = ?').run(
      stateJson,
      encounterId
    );
  }
}

/**
 * Initializes combat session for an encounter.
 * Rolls initiative once, sets status to IN_COMBAT, establishes maximum HP, and logs initial engagement.
 */
function startCombat(db, characterId, encounterId, optionsOrHeroClass = {}, maybeOptions = {}) {
  const options = (typeof optionsOrHeroClass === 'object' && optionsOrHeroClass !== null)
    ? optionsOrHeroClass
    : (maybeOptions || {});
  const rng = options.rng || Math.random;

  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Hero is not eligible for combat.');
    }

    const encounter = fetchEncounterWithMonster(tx, encounterId, characterId);
    if (!encounter) {
      throw new Error('Encounter not found.');
    }

    enforceNoAmbushAtLevel1(tx, character, encounter);

    if (encounter.status === 'VICTORY' || encounter.status === 'DEFEAT' || encounter.status === 'ESCAPED' || encounter.status === 'IGNORED') {
      throw new Error(`Encounter is already resolved (${encounter.status}).`);
    }

    if (encounter.monster_instance_id) {
      const inst = tx.prepare('SELECT status FROM monster_instances WHERE id = ?').get(encounter.monster_instance_id);
      if (!inst || inst.status !== 'ACTIVE') {
        tx.prepare("UPDATE encounters SET status = 'ESCAPED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(encounterId);
        throw new Error('Another champion has already slain this creature.');
      }
    }

    if (encounter.status === 'DISCOVERED' && encounter.monster_id) {
      recordMonsterEncountered(tx, characterId, encounter.monster_id);
    }

    const monsterMaxHp = encounter.instance_max_hp || encounter.bounty_boosted_max_hp || encounter.monster_max_hp || encounter.base_hp;
    let currentMonsterHp = encounter.monster_instance_id
      ? monsterMaxHp
      : (encounter.current_monster_hp || monsterMaxHp);

    const equipment = getCharacterEquipment(tx, characterId);
    const effectiveCharacter = getEffectiveStats(character, equipment);
    attachBattleExperienceContext(tx, effectiveCharacter, encounter, equipment);

    let openingShotResolved = encounter.opening_shot_resolved || 0;

    // Check Ranger Ranged Opening Shot condition
    const canOpeningShot = (
      (character.class || '').toUpperCase() === 'RANGER' &&
      equipment.rangedWeapon &&
      encounter.status === 'DISCOVERED' &&
      Number(encounter.spotted_by_hero) === 1 &&
      Number(encounter.is_ambush || 0) === 0 &&
      Number(openingShotResolved) === 0
    );

    let openingShotFired = false;
    let openingShotHit = false;
    let openingShotCrit = false;

    if (canOpeningShot) {
      openingShotFired = true;
      openingShotResolved = 1;
      const openingAB = calculateHeroAttackBonus(effectiveCharacter, equipment.rangedWeapon, encounter, equipment);
      const monsterAC = encounter.monster_ac || encounter.armor_class;
      const attackRoll = resolveAttackRoll(openingAB, monsterAC, rng);
      openingShotHit = attackRoll.isHit;
      openingShotCrit = attackRoll.isCrit;
      let openingDamage = 0;

      if (attackRoll.isHit) {
        const damageFormula = getHeroDamageFormula(effectiveCharacter, equipment.rangedWeapon, encounter, equipment);
        openingDamage = resolveDamage(damageFormula, attackRoll.isCrit, rng);
        // Opening Shot can wound a monster down to at least 1 HP, but never kill it outright before combat begins
        currentMonsterHp = Math.max(1, currentMonsterHp - openingDamage);
      }

      const openingNarrative = `[Opening Shot] ${describeHeroAttack(equipment.rangedWeapon, attackRoll)}`;
      tx.prepare(`
        INSERT INTO combat_events (
          encounter_id, round_number, event_type, public_text, details
        ) VALUES (?, 1, 'OPENING_SHOT', ?, ?)
      `).run(
        encounterId,
        openingNarrative,
        JSON.stringify({
          isHit: attackRoll.isHit,
          isCrit: attackRoll.isCrit,
          damage: openingDamage,
          isOpeningShot: true
        })
      );
    }

    // Roll initiative if not already rolled
    let initiativeWinner = encounter.initiative_winner;
    let heroInit = encounter.hero_initiative;
    let monsterInit = encounter.monster_initiative;

    if (!initiativeWinner) {
      const heroDexMod = getModifier(effectiveCharacter.dexterity);
      const isAmbushActive = Number(encounter.is_ambush || 0) === 1;
      const ambushInitBonus = isAmbushActive ? 4 : 0;
      heroInit = rollInitiative(heroDexMod, rng);
      monsterInit = rollInitiative((encounter.initiative_bonus || 0) + ambushInitBonus, rng);
      initiativeWinner = isAmbushActive
        ? (monsterInit >= heroInit ? 'MONSTER' : 'HERO')
        : (heroInit >= monsterInit ? 'HERO' : 'MONSTER');
    }

    const initialBracket = getHealthBracket(currentMonsterHp, monsterMaxHp);
    const combatStatusState = parseCombatStateJson(encounter.combat_state_json, encounter);

    // Initial engagement description
    const initialCondition = getConditionTextForBracket(encounter.monster_descriptions, initialBracket);
    const existingEventsCount = tx.prepare("SELECT COUNT(*) as c FROM combat_events WHERE encounter_id = ? AND event_type = 'CONDITION'").get(encounterId).c;

    if (existingEventsCount === 0 && initialCondition) {
      tx.prepare(`
        INSERT INTO combat_events (
          encounter_id, round_number, event_type, public_text, details
        ) VALUES (?, 1, 'CONDITION', ?, ?)
      `).run(
        encounterId,
        initialCondition,
        JSON.stringify({ bracket: initialBracket, initiativeWinner })
      );
    }

    const logStartEvent = (type, text, details = {}) => {
      tx.prepare(`
        INSERT INTO combat_events (
          encounter_id, round_number, event_type, public_text, details
        ) VALUES (?, 1, ?, ?, ?)
      `).run(encounterId, type, text, JSON.stringify(details));
    };

    // Resolve Cleric Turn Undead opening disruption (Level 2+ vs Undead)
    if (!combatStatusState.turnUndeadResolved) {
      resolveClericTurnUndead(effectiveCharacter, equipment, encounter, combatStatusState, logStartEvent);
    }

    // Resolve Combat-Start Auras (Stench, Fear, Web/Entangle) after initiative and initial condition
    if (!combatStatusState.auraResolved) {
      resolveCombatStartAura(effectiveCharacter, equipment, encounter, combatStatusState, rng, logStartEvent);
    }

    const secondWindInt = combatStatusState.secondWindUsed ? 1 : 0;
    try {
      tx.prepare(`
        UPDATE encounters
        SET status = 'IN_COMBAT',
            initiative_winner = ?,
            hero_initiative = ?,
            monster_initiative = ?,
            monster_max_hp = ?,
            current_monster_hp = ?,
            combat_round = CASE WHEN combat_round = 0 THEN 1 ELSE combat_round END,
            last_health_bracket = ?,
            opening_shot_resolved = ?,
            second_wind_used = ?,
            combat_state_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        initiativeWinner,
        heroInit,
        monsterInit,
        monsterMaxHp,
        currentMonsterHp,
        initialBracket,
        openingShotResolved,
        secondWindInt,
        serializeCombatStateJson(combatStatusState),
        encounterId
      );
    } catch {
      tx.prepare(`
        UPDATE encounters
        SET status = 'IN_COMBAT',
            initiative_winner = ?,
            hero_initiative = ?,
            monster_initiative = ?,
            monster_max_hp = ?,
            current_monster_hp = ?,
            combat_round = CASE WHEN combat_round = 0 THEN 1 ELSE combat_round END,
            last_health_bracket = ?,
            opening_shot_resolved = ?,
            combat_state_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        initiativeWinner,
        heroInit,
        monsterInit,
        monsterMaxHp,
        currentMonsterHp,
        initialBracket,
        openingShotResolved,
        serializeCombatStateJson(combatStatusState),
        encounterId
      );
    }

    if (encounter.monster_instance_id) {
      tx.prepare("UPDATE monster_instances SET current_hp = ? WHERE id = ? AND status = 'ACTIVE'").run(currentMonsterHp, encounter.monster_instance_id);
    }

    const combatState = getCombatState(tx, characterId, encounterId);
    return {
      ...combatState,
      openingShotFired,
      openingShotHit,
      openingShotCrit
    };
  });
}

/**
 * Retrieves full combat state for active encounter including public combat events log.
 * Strictly guarantees no hidden monster stats (HP, AC, rolls) leak to public properties.
 */
function getCombatState(db, characterId, encounterId) {
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  const encounter = fetchEncounterWithMonster(db, encounterId, characterId);

  if (!encounter) return null;

  enforceNoAmbushAtLevel1(db, character, encounter);

  const events = db.prepare(`
    SELECT * FROM combat_events
    WHERE encounter_id = ?
    ORDER BY id ASC
  `).all(encounterId);

  const equipment = getCharacterEquipment(db, characterId);
  const effectiveCharacter = getEffectiveStats(character, equipment);
  const monsterKnowledge = attachBattleExperienceContext(db, effectiveCharacter, encounter, equipment);
  const potions = getCharacterPotions(db, characterId, { combatOnly: true });
  const potionCount = potions.length;

  const combatStatusState = parseCombatStateJson(encounter.combat_state_json, encounter);
  const statusMods = getActiveStatusModifiers(combatStatusState);
  const heroStatusBadges = getPublicHeroStatusBadges(combatStatusState, effectiveCharacter);

  const { activeWeapon, isRangedActive } = getActiveWeapon(effectiveCharacter, equipment, encounter);
  const baseHeroAC = calculateHeroAC(effectiveCharacter, equipment, isRangedActive, encounter, activeWeapon);
  const heroAC = baseHeroAC + statusMods.acMod;

  const effectiveMonsterMaxHp = encounter.instance_max_hp || encounter.bounty_boosted_max_hp || encounter.monster_max_hp || encounter.base_hp;
  const currentBracket = getHealthBracket(encounter.current_monster_hp, effectiveMonsterMaxHp);
  const currentConditionText = getConditionTextForBracket(encounter.monster_descriptions, currentBracket);

  const secondWindProfile = getFighterSecondWindProfile(effectiveCharacter, equipment);
  const secondWindStatus = secondWindProfile.available
    ? (combatStatusState.secondWindUsed ? 'Spent' : 'Ready')
    : null;

  const clericDivineInfo = getClericDivineChargeInfo(effectiveCharacter, equipment);
  const divineShieldTurns = Math.max(0, Number(combatStatusState.divineShieldTurns || 0));

  return {
    character: effectiveCharacter,
    encounter,
    events,
    equipment,
    activeWeapon,
    isRangedActive,
    heroAC,
    potionCount,
    potions,
    currentBracket,
    currentConditionText,
    heroStatusBadges,
    combatStatusState,
    monsterKnowledge,
    secondWindStatus,
    secondWindUsed: Boolean(combatStatusState.secondWindUsed),
    divineCharges: clericDivineInfo.currentCharges,
    maxDivineCharges: clericDivineInfo.maxCharges,
    divineShieldTurns,
    divineShieldActive: divineShieldTurns > 0,
    clericDivine: {
      ...clericDivineInfo,
      divineShieldTurns,
      divineShieldActive: divineShieldTurns > 0
    }
  };
}

/**
 * Resolves the monster's configured multi-attack strike list for a round.
 * Defaults to a single primary attack unless encounter/monster defines attack_count > 1 or an attacks array.
 */
function getMonsterStrikeConfigs(encounter) {
  const baseAb = Number(encounter.monster_ab || 0);
  const baseDice = encounter.monster_damage_dice || '1d4';
  const strikes = [];

  let parsedSpecial = null;
  if (typeof encounter.special_abilities === 'string' && encounter.special_abilities.trim().startsWith('{')) {
    try { parsedSpecial = JSON.parse(encounter.special_abilities); } catch { parsedSpecial = null; }
  } else if (encounter.special_abilities && typeof encounter.special_abilities === 'object' && !Array.isArray(encounter.special_abilities)) {
    parsedSpecial = encounter.special_abilities;
  }

  const customAttacks = Array.isArray(encounter.attacks)
    ? encounter.attacks
    : (parsedSpecial && Array.isArray(parsedSpecial.attacks) ? parsedSpecial.attacks : null);

  if (customAttacks && customAttacks.length > 0) {
    for (const atk of customAttacks) {
      strikes.push({
        attackBonus: atk && atk.attack_bonus !== undefined ? Number(atk.attack_bonus) : baseAb,
        damageDice: (atk && atk.damage_dice) || baseDice,
        label: (atk && atk.label) || null
      });
    }
    return strikes;
  }

  const rawCount = Number(
    encounter.attack_count ||
    encounter.num_attacks ||
    (parsedSpecial && (parsedSpecial.attack_count || parsedSpecial.num_attacks)) ||
    1
  );
  const attackCount = Math.max(1, Math.min(6, Math.floor(Number.isFinite(rawCount) ? rawCount : 1)));
  for (let i = 0; i < attackCount; i++) {
    strikes.push({
      attackBonus: baseAb,
      damageDice: baseDice,
      label: null
    });
  }
  return strikes;
}

/**
 * Executes a single turn action in combat (ATTACK, DRINK_POTION, FLEE, BATTLE_PRAYER, SMITE, DIVINE_SHIELD).
 * Thread-safe and atomic with idempotency protection.
 */
function executeCombatRound(db, characterId, encounterId, action, options = {}) {
  const rng = options.rng || Math.random;
  if (
    Array.isArray(action) ||
    (typeof action === 'string' && (action.includes('+') || action.includes(',') || action.includes('&'))) ||
    (options && (options.combineWith || options.secondaryAction))
  ) {
    const err = new Error('Cannot combine multiple combat actions or divine techniques in a single turn.');
    err.status = 400;
    err.code = 'COMBINED_ACTIONS_FORBIDDEN';
    throw err;
  }

  const normalizedAction = (action || '').toUpperCase().trim();
  const ALLOWED_COMBAT_ACTIONS = ['ATTACK', 'DRINK_POTION', 'FLEE', 'BATTLE_PRAYER', 'SMITE', 'DIVINE_SHIELD'];
  const CLERIC_DIVINE_ACTIONS = ['BATTLE_PRAYER', 'SMITE', 'DIVINE_SHIELD'];

  if (!ALLOWED_COMBAT_ACTIONS.includes(normalizedAction)) {
    const err = new Error(`Invalid combat action: ${action}. Allowed actions are ${ALLOWED_COMBAT_ACTIONS.join(', ')}.`);
    err.status = 400;
    throw err;
  }

  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Dead characters cannot perform combat actions.');
    }

    const encounter = fetchEncounterWithMonster(tx, encounterId, characterId);
    if (!encounter) {
      throw new Error('Encounter not found.');
    }

    enforceNoAmbushAtLevel1(tx, character, encounter);

    if (encounter.status !== 'IN_COMBAT') {
      throw new Error(`Cannot perform combat action; encounter status is ${encounter.status}.`);
    }

    let roundNumber = encounter.combat_round || 1;
    if (roundNumber === 0) roundNumber = 1;

    if (typeof options.expectedRound === 'number' && roundNumber !== options.expectedRound) {
      return getCombatState(tx, characterId, encounterId);
    }

    let monsterInstance = null;
    if (encounter.monster_instance_id) {
      monsterInstance = tx.prepare('SELECT * FROM monster_instances WHERE id = ?').get(encounter.monster_instance_id);
    }

    if (monsterInstance && monsterInstance.status !== 'ACTIVE') {
      tx.prepare(`
        UPDATE encounters
        SET status = 'VICTORY', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(encounter.id);

      tx.prepare(`
        INSERT INTO combat_events (
          encounter_id, round_number, event_type, public_text, details
        ) VALUES (?, ?, 'VICTORY', ?, ?)
      `).run(
        encounter.id,
        roundNumber,
        'Another champion has already slain this creature! The battlefield is quiet.',
        JSON.stringify({ goldAwarded: 0, itemsAwarded: [], xpAwarded: 0, resolvedByOther: true })
      );

      return getCombatState(tx, characterId, encounterId);
    }

    const equipment = getCharacterEquipment(tx, characterId);
    const effectiveHero = getEffectiveStats(character, equipment);
    attachBattleExperienceContext(tx, effectiveHero, encounter, equipment);

    const isCleric = String(character.class || '').toUpperCase() === 'CLERIC';
    if (isCleric && (character.divine_charges === null || character.divine_charges === undefined)) {
      const initMaxCharges = calculateMaxDivineCharges(effectiveHero.level, 'CLERIC', getModifier(effectiveHero.wisdom));
      try {
        tx.prepare('UPDATE characters SET divine_charges = ? WHERE id = ? AND divine_charges IS NULL').run(initMaxCharges, character.id);
      } catch {
        // Ignore on minimal test schema without divine_charges column
      }
      character.divine_charges = initMaxCharges;
      effectiveHero.divine_charges = initMaxCharges;
    }

    const requiredDivineCost = normalizedAction === 'DIVINE_SHIELD'
      ? 2
      : (normalizedAction === 'BATTLE_PRAYER' || normalizedAction === 'SMITE' ? 1 : 0);

    if (CLERIC_DIVINE_ACTIONS.includes(normalizedAction)) {
      if (!isCleric) {
        const err = new Error('Only Clerics can invoke divine combat techniques.');
        err.status = 400;
        err.code = 'CLERIC_ONLY_ACTION';
        throw err;
      }
      const maxCharges = calculateMaxDivineCharges(effectiveHero.level, 'CLERIC', getModifier(effectiveHero.wisdom));
      const availableCharges = clampDivineCharges(character.divine_charges, maxCharges, true);
      if (availableCharges < requiredDivineCost) {
        const err = new Error(`Insufficient Divine Charges to use ${normalizedAction} (requires ${requiredDivineCost}, have ${availableCharges}).`);
        err.status = 400;
        err.code = 'INSUFFICIENT_DIVINE_CHARGES';
        throw err;
      }
    }

    function spendDivineChargesAtomically(cost) {
      if (cost <= 0) return;
      const spendRes = tx.prepare(`
        UPDATE characters
        SET divine_charges = divine_charges - ?
        WHERE id = ? AND is_alive = 1 AND UPPER(class) = 'CLERIC' AND divine_charges >= ?
      `).run(cost, character.id, cost);

      if (spendRes.changes !== 1) {
        const err = new Error('Insufficient Divine Charges to perform this divine technique.');
        err.status = 400;
        err.code = 'INSUFFICIENT_DIVINE_CHARGES';
        throw err;
      }
      character.divine_charges = Math.max(0, Number(character.divine_charges) - cost);
      effectiveHero.divine_charges = character.divine_charges;
    }

    const { activeWeapon, isRangedActive } = getActiveWeapon(effectiveHero, equipment, encounter);
    const baseHeroAC = calculateHeroAC(effectiveHero, equipment, isRangedActive, encounter, activeWeapon);
    const baseHeroAB = calculateHeroAttackBonus(effectiveHero, activeWeapon, encounter, equipment);
    const combatStatusState = parseCombatStateJson(encounter.combat_state_json, encounter);
    const initialStatusMods = getActiveStatusModifiers(combatStatusState);
    const heroAC = baseHeroAC + initialStatusMods.acMod;

    let currentMonsterHp = encounter.current_monster_hp;
    const monsterMaxHp = encounter.monster_max_hp || encounter.bounty_boosted_max_hp || (monsterInstance ? monsterInstance.max_hp : encounter.base_hp);
    let currentHeroHp = character.current_hp;
    let lastHealthBracket = encounter.last_health_bracket != null ? encounter.last_health_bracket : 100;
    const bountyDamageBonus = Number(encounter.bounty_damage_bonus || 0);

    const roundEvents = [];

    function logEvent(type, text, details = {}) {
      const res = tx.prepare(`
        INSERT INTO combat_events (
          encounter_id, round_number, event_type, public_text, details
        ) VALUES (?, ?, ?, ?, ?)
      `).run(encounter.id, roundNumber, type, text, JSON.stringify(details));
      roundEvents.push({ id: Number(res.lastInsertRowid), type, text, details });
    }

    function checkMonsterHealthCondition(newHp) {
      const newBracket = getHealthBracket(newHp, monsterMaxHp);
      if (newBracket < lastHealthBracket) {
        lastHealthBracket = newBracket;
        const conditionText = getConditionTextForBracket(encounter.monster_descriptions, newBracket);
        if (conditionText) {
          logEvent('MONSTER_CONDITION', conditionText, { bracket: newBracket });
        }
      }
    }

    const heroStartOfRoundHp = currentHeroHp;
    const eligibleForLevel1SpikeGuard = (
      Number(character.level || 1) <= 1 &&
      roundNumber === 1 &&
      heroStartOfRoundHp >= Math.max(6, Math.ceil((character.max_hp || 8) * 0.70))
    );

    function monsterAttackPhase() {
      const currentMods = getActiveStatusModifiers(combatStatusState);
      const effectiveHeroAC = baseHeroAC + currentMods.acMod;

      const turnSpecials = resolveMonsterTurnSpecials({
        character: effectiveHero,
        equipment,
        encounter,
        combatState: combatStatusState,
        roundNumber,
        currentHeroHp,
        currentMonsterHp,
        monsterMaxHp,
        rng,
        logEvent
      });
      currentHeroHp = turnSpecials.newHeroHp;
      currentMonsterHp = turnSpecials.newMonsterHp;

      if (currentHeroHp > 0 && !turnSpecials.usedBreathOrVolley) {
        const strikeConfigs = getMonsterStrikeConfigs(encounter);

        for (let strikeIdx = 0; strikeIdx < strikeConfigs.length; strikeIdx++) {
          if (currentHeroHp <= 0) break;
          const strike = strikeConfigs[strikeIdx];
          const monsterAttackRoll = resolveAttackRoll(
            strike.attackBonus + turnSpecials.monsterAbBonus,
            effectiveHeroAC,
            rng
          );
          let rawMonsterDamage = 0;
          let monsterDamage = 0;
          let shieldMitigated = 0;
          let shieldWasActive = false;

          if (monsterAttackRoll.isHit) {
            rawMonsterDamage = resolveDamage(strike.damageDice, monsterAttackRoll.isCrit, rng);
            if (strikeIdx === 0 && turnSpecials.bonusDamageFormula) {
              rawMonsterDamage += resolveDamage(turnSpecials.bonusDamageFormula, false, rng);
            }
            rawMonsterDamage = Math.max(1, rawMonsterDamage + turnSpecials.bloodFrenzyDmgBonus + bountyDamageBonus);
            const shieldRes = applyDivineShieldMitigation(rawMonsterDamage, combatStatusState);
            monsterDamage = shieldRes.finalDamage;
            shieldMitigated = shieldRes.mitigated;
            shieldWasActive = shieldRes.shieldActive;
            currentHeroHp = Math.max(0, currentHeroHp - monsterDamage);
          }

          let attackNarrative = describeMonsterAttack(encounter, monsterAttackRoll);
          if (monsterAttackRoll.isHit && shieldWasActive && shieldMitigated > 0) {
            if (monsterDamage === 0) {
              attackNarrative += ' Your radiant barrier completely turns aside the force of the blow!';
            } else {
              attackNarrative += ' Your radiant barrier absorbs part of the assault!';
            }
          }

          logEvent('MONSTER_ATTACK', attackNarrative, {
            isHit: monsterAttackRoll.isHit,
            isCrit: monsterAttackRoll.isCrit,
            rawDamage: rawMonsterDamage,
            damage: monsterDamage,
            divineShieldMitigated: shieldMitigated,
            divineShieldActive: shieldWasActive,
            strikeIndex: strikeIdx + 1,
            totalStrikes: strikeConfigs.length
          });

          if (monsterAttackRoll.isHit && currentHeroHp > 0) {
            const onHit = resolveMonsterOnHitEffects({
              character: effectiveHero,
              equipment,
              encounter,
              combatState: combatStatusState,
              monsterAttackRoll,
              heroAC: effectiveHeroAC,
              currentHeroHp,
              currentMonsterHp,
              monsterMaxHp,
              rng,
              logEvent
            });
            currentHeroHp = onHit.newHeroHp;
            currentMonsterHp = onHit.newMonsterHp;
          }
        }
      }

      // Decrement Divine Shield duration after monster turn concludes (lasting 2 monster turns including activation round)
      if (Number(combatStatusState.divineShieldTurns || 0) > 0) {
        combatStatusState.divineShieldTurns = Math.max(0, Number(combatStatusState.divineShieldTurns) - 1);
        if (combatStatusState.divineShieldTurns === 0) {
          combatStatusState.divineShieldReduction = 0;
        }
      }

      // Resolve Fighter Second Wind AFTER complete monster multi-hit and immediate damage-rider sequence
      const swRes = tryTriggerFighterSecondWind({
        character: effectiveHero,
        equipment,
        encounter,
        combatState: combatStatusState,
        currentHeroHp,
        maxHeroHp: character.max_hp,
        rng,
        logEvent
      });
      if (swRes.triggered) {
        currentHeroHp = swRes.newHeroHp;
      }

      if (currentHeroHp <= 0 && eligibleForLevel1SpikeGuard && !combatStatusState.calcifyInstantDeath) {
        currentHeroHp = 1;
        logEvent('HERO_STATUS', "Death's Door! Sheer survival instinct keeps you standing at 1 HP after a lethal opening blow!", {
          level1SpikeGuard: true
        });
      }

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);
      tx.prepare('UPDATE encounters SET current_monster_hp = ? WHERE id = ?').run(currentMonsterHp, encounter.id);
      updateEncounterCombatStateSql(tx, encounter.id, combatStatusState);

      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = ? WHERE id = ?').run(currentMonsterHp, monsterInstance.id);
      }

      return currentHeroHp <= 0;
    }

    // =========================================================================
    // ACTION 1: FLEE
    // =========================================================================
    if (normalizedAction === 'FLEE') {
      const freeAttackRoll = resolveAttackRoll(encounter.monster_ab, heroAC, rng);
      let rawFreeDamage = 0;
      let freeDamage = 0;
      let shieldMitigated = 0;

      if (freeAttackRoll.isHit) {
        rawFreeDamage = resolveDamage(encounter.monster_damage_dice, freeAttackRoll.isCrit, rng) + bountyDamageBonus;
        const shieldRes = applyDivineShieldMitigation(rawFreeDamage, combatStatusState);
        freeDamage = shieldRes.finalDamage;
        shieldMitigated = shieldRes.mitigated;
        currentHeroHp = Math.max(0, currentHeroHp - freeDamage);
      }

      if (Number(combatStatusState.divineShieldTurns || 0) > 0) {
        combatStatusState.divineShieldTurns = Math.max(0, Number(combatStatusState.divineShieldTurns) - 1);
        if (combatStatusState.divineShieldTurns === 0) {
          combatStatusState.divineShieldReduction = 0;
        }
      }

      if (freeAttackRoll.isHit) {
        const swRes = tryTriggerFighterSecondWind({
          character: effectiveHero,
          equipment,
          encounter,
          combatState: combatStatusState,
          currentHeroHp,
          maxHeroHp: character.max_hp,
          rng,
          logEvent
        });
        if (swRes.triggered) {
          currentHeroHp = swRes.newHeroHp;
        }
      }

      const survived = currentHeroHp > 0;
      const fleeNarrative = describeFleeAttempt(freeAttackRoll, survived);
      logEvent('FLEE', fleeNarrative, {
        isHit: freeAttackRoll.isHit,
        isCrit: freeAttackRoll.isCrit,
        rawDamage: rawFreeDamage,
        damage: freeDamage,
        divineShieldMitigated: shieldMitigated,
        survived
      });

      if (!survived) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      tx.prepare(`
        UPDATE encounters
        SET status = 'ESCAPED', combat_state_json = '{}', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(encounter.id);

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);

      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = max_hp WHERE id = ?').run(monsterInstance.id);
      }

      return getCombatState(tx, characterId, encounterId);
    }

    // =========================================================================
    // ACTION 2: DRINK POTION
    // =========================================================================
    if (normalizedAction === 'DRINK_POTION') {
      let potion = null;

      if (options.potionInstanceId) {
        potion = tx.prepare(`
          SELECT ii.id, id.name, id.buy_price, id.attributes, id.subtype
          FROM item_instances ii
          JOIN item_definitions id ON ii.item_definition_id = id.id
          WHERE ii.id = ? AND ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ? AND id.category = 'POTION'
        `).get(options.potionInstanceId, character.id);

        if (!potion) {
          throw new Error('You do not possess the selected healing potion.');
        }

        if (INACTIVE_CONSUMABLE_NAMES.includes(potion.name) || potion.subtype === 'BUFF_POTION' || potion.subtype === 'OFFENSIVE') {
          throw new Error(`${potion.name} cannot be consumed in combat: its effect is not yet active.`);
        }
      } else {
        const inactiveSql = INACTIVE_CONSUMABLE_NAMES.map(n => `'${n.replace(/'/g, "''")}'`).join(', ');
        potion = tx.prepare(`
          SELECT ii.id, id.name, id.buy_price, id.attributes, id.subtype
          FROM item_instances ii
          JOIN item_definitions id ON ii.item_definition_id = id.id
          WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ? AND id.category = 'POTION'
            AND id.name NOT IN (${inactiveSql})
          ORDER BY id.buy_price ASC, ii.id ASC
          LIMIT 1
        `).get(character.id);

        if (!potion) {
          throw new Error('You do not possess any healing potions.');
        }
      }

      tx.prepare('DELETE FROM item_instances WHERE id = ?').run(potion.id);
      const rollAmount = resolvePotionHealing(potion, rng);
      const newHeroHp = Math.min(character.max_hp, currentHeroHp + rollAmount);
      const actualHealed = newHeroHp - currentHeroHp;
      currentHeroHp = newHeroHp;

      if (combatStatusState.heroStatuses.bleed) {
        combatStatusState.heroStatuses.bleed = null;
      }
      if (combatStatusState.heroStatuses.paralyzed > 0) {
        combatStatusState.heroStatuses.paralyzed = 0;
      }

      logEvent('POTION_USED', describePotionDrink(), {
        potionName: potion.name,
        rollAmount,
        healed: actualHealed,
        actualHealed
      });

      const heroDied = monsterAttackPhase();
      if (heroDied) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      if (currentHeroHp > 0) {
        const eor = resolveEndOfRoundStatusTicks({
          character: effectiveHero,
          equipment,
          combatState: combatStatusState,
          currentHeroHp,
          rng,
          logEvent
        });
        currentHeroHp = eor.newHeroHp;

        const swAfterDoT = tryTriggerFighterSecondWind({
          character: effectiveHero,
          equipment,
          encounter,
          combatState: combatStatusState,
          currentHeroHp,
          maxHeroHp: character.max_hp,
          rng,
          logEvent
        });
        if (swAfterDoT.triggered) {
          currentHeroHp = swAfterDoT.newHeroHp;
        }
      }

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);
      updateEncounterCombatStateSql(tx, encounter.id, combatStatusState);

      if (currentHeroHp <= 0) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      tx.prepare(`
        UPDATE encounters
        SET combat_round = ?,
            current_monster_hp = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(roundNumber + 1, currentMonsterHp, encounter.id);

      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = ? WHERE id = ?').run(currentMonsterHp, monsterInstance.id);
      }

      return getCombatState(tx, characterId, encounterId);
    }

    // =========================================================================
    // ACTION 3: DIVINE SHIELD (Cleric Defensive Action, Cost: 2 Divine Charges)
    // =========================================================================
    if (normalizedAction === 'DIVINE_SHIELD') {
      if (Number(combatStatusState.divineShieldTurns || 0) > 0) {
        const err = new Error('Divine Shield is already active and cannot stack.');
        err.status = 400;
        err.code = 'DIVINE_SHIELD_ALREADY_ACTIVE';
        throw err;
      }
      spendDivineChargesAtomically(requiredDivineCost);

      if (combatStatusState.heroStatuses.paralyzed > 0) {
        combatStatusState.heroStatuses.paralyzed = 0;
      }

      const shieldProfile = getClericDivineShieldProfile(effectiveHero, equipment);
      // Non-stacking: sets duration to 2 monster turns (including activation round) and sets reduction
      combatStatusState.divineShieldTurns = shieldProfile.durationTurns;
      combatStatusState.divineShieldReduction = shieldProfile.damageReduction;

      logEvent('DIVINE_SHIELD', describeDivineShield(), {
        ability: 'DIVINE_SHIELD',
        cost: shieldProfile.cost,
        remainingDivineCharges: effectiveHero.divine_charges,
        durationTurns: shieldProfile.durationTurns,
        damageReduction: shieldProfile.damageReduction
      });
      updateEncounterCombatStateSql(tx, encounter.id, combatStatusState);

      const heroDied = monsterAttackPhase();
      if (heroDied) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      if (currentHeroHp > 0) {
        const eor = resolveEndOfRoundStatusTicks({
          character: effectiveHero,
          equipment,
          combatState: combatStatusState,
          currentHeroHp,
          rng,
          logEvent
        });
        currentHeroHp = eor.newHeroHp;
      }

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);
      updateEncounterCombatStateSql(tx, encounter.id, combatStatusState);

      if (currentHeroHp <= 0) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      tx.prepare(`
        UPDATE encounters
        SET combat_round = ?,
            current_monster_hp = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(roundNumber + 1, currentMonsterHp, encounter.id);

      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = ? WHERE id = ?').run(currentMonsterHp, monsterInstance.id);
      }

      return getCombatState(tx, characterId, encounterId);
    }

    // =========================================================================
    // ACTION 4: ATTACK / BATTLE_PRAYER / SMITE
    // =========================================================================
    const initiativeWinner = encounter.initiative_winner || 'HERO';

    function heroAttackPhase() {
      if (combatStatusState.heroStatuses.paralyzed > 0) {
        combatStatusState.heroStatuses.paralyzed = 0;
        logEvent(
          'HERO_ATTACK',
          'You strain with all your might against the numbing paralysis, wrenching your limbs free of the rigor!',
          { isHit: false, isCrit: false, damage: 0, paralyzedStun: true }
        );
        updateEncounterCombatStateSql(tx, encounter.id, combatStatusState);
        return false;
      }

      if (requiredDivineCost > 0) {
        spendDivineChargesAtomically(requiredDivineCost);
      }

      const currentMods = getActiveStatusModifiers(combatStatusState);
      const effectiveHeroAB = baseHeroAB + currentMods.atkMod;
      const effectiveMonsterAC = Math.max(1, (encounter.monster_ac || 10) - (combatStatusState.bloodFrenzyActive ? 2 : 0));

      const heroAttackRoll = resolveAttackRoll(effectiveHeroAB, effectiveMonsterAC, rng);
      let heroDamage = 0;
      let weaponDamage = 0;
      let radiantDamage = 0;
      let prayerHealed = 0;
      let rawPrayerHeal = 0;
      let evaded = false;

      const isBattlePrayer = normalizedAction === 'BATTLE_PRAYER';
      const isSmite = normalizedAction === 'SMITE';
      const prayerProfile = isBattlePrayer ? getClericBattlePrayerProfile(effectiveHero, equipment) : null;
      const smiteProfile = isSmite ? getClericSmiteProfile(effectiveHero, equipment, encounter) : null;

      if (heroAttackRoll.isHit) {
        const damageFormula = getHeroDamageFormula(effectiveHero, activeWeapon, encounter, equipment);
        let rawHeroDamage = resolveDamage(damageFormula, heroAttackRoll.isCrit, rng);
        rawHeroDamage = Math.max(1, rawHeroDamage + currentMods.dmgMod);

        let bonusRadiant = 0;
        if (isSmite && smiteProfile) {
          // Retain normal weapon critical-hit behavior; do NOT multiply bonus radiant dice on crit
          const radiantRoll = rollDice(smiteProfile.radiantDice, rng, 1);
          bonusRadiant = Math.max(1, radiantRoll.total + smiteProfile.flatRadiantBonus);
        }

        const modResult = modifyHeroAttackDamageAndState({
          character: effectiveHero,
          activeWeapon,
          encounter,
          combatState: combatStatusState,
          heroAttackRoll,
          rawHeroDamage,
          bonusRadiantDamage: bonusRadiant,
          forceMagical: isBattlePrayer || isSmite,
          currentMonsterHp,
          monsterMaxHp,
          logEvent
        });
        heroDamage = modResult.finalDamage;
        weaponDamage = modResult.weaponDamage !== undefined ? modResult.weaponDamage : modResult.finalDamage;
        radiantDamage = modResult.radiantDamage || 0;
        currentMonsterHp = modResult.newMonsterHp;
        evaded = Boolean(modResult.evaded);

        if (isBattlePrayer && prayerProfile && !evaded) {
          // No critical-hit multiplication of Battle Prayer healing; capped at Max HP
          const healRoll = rollDice(prayerProfile.dice, rng, 1);
          rawPrayerHeal = Math.max(1, healRoll.total + prayerProfile.flatBonus);
          const nextHeroHp = Math.min(character.max_hp, currentHeroHp + rawPrayerHeal);
          prayerHealed = nextHeroHp - currentHeroHp;
          currentHeroHp = nextHeroHp;
          tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);
        }
      }

      const effectiveHit = Boolean(heroAttackRoll.isHit && !evaded);
      const effectiveAttackResult = {
        ...heroAttackRoll,
        isHit: effectiveHit,
        isCrit: Boolean(heroAttackRoll.isCrit && !evaded)
      };

      if (isBattlePrayer && prayerProfile) {
        logEvent('BATTLE_PRAYER', describeBattlePrayer(activeWeapon, effectiveAttackResult), {
          ability: 'BATTLE_PRAYER',
          cost: prayerProfile.cost,
          remainingDivineCharges: effectiveHero.divine_charges,
          isHit: effectiveHit,
          isCrit: effectiveAttackResult.isCrit,
          damage: heroDamage,
          weaponDamage,
          healDice: prayerProfile.dice,
          healFlatBonus: prayerProfile.flatBonus,
          rawHeal: rawPrayerHeal,
          healed: prayerHealed,
          newHeroHp: currentHeroHp
        });
      } else if (isSmite && smiteProfile) {
        logEvent('SMITE', describeSmite(activeWeapon, effectiveAttackResult, smiteProfile.isUndead), {
          ability: 'SMITE',
          cost: smiteProfile.cost,
          remainingDivineCharges: effectiveHero.divine_charges,
          isHit: effectiveHit,
          isCrit: effectiveAttackResult.isCrit,
          isUndead: smiteProfile.isUndead,
          radiantDice: smiteProfile.radiantDice,
          flatRadiantBonus: smiteProfile.flatRadiantBonus,
          weaponDamage,
          radiantDamage,
          damage: heroDamage
        });
      } else {
        logEvent('HERO_ATTACK', describeHeroAttack(activeWeapon, heroAttackRoll), {
          isHit: heroAttackRoll.isHit,
          isCrit: heroAttackRoll.isCrit,
          damage: heroDamage
        });
      }

      checkMonsterHealthCondition(currentMonsterHp);

      tx.prepare(`
        UPDATE encounters
        SET current_monster_hp = ?, last_health_bracket = ?
        WHERE id = ?
      `).run(currentMonsterHp, lastHealthBracket, encounter.id);
      updateEncounterCombatStateSql(tx, encounter.id, combatStatusState);

      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = ? WHERE id = ?').run(currentMonsterHp, monsterInstance.id);
      }

      return currentMonsterHp <= 0;
    }

    if (initiativeWinner === 'HERO') {
      const monsterDied = heroAttackPhase();
      if (monsterDied) {
        handleMonsterDefeat(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      const heroDied = monsterAttackPhase();
      if (heroDied) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }
    } else {
      const heroDied = monsterAttackPhase();
      if (heroDied) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      const monsterDied = heroAttackPhase();
      if (monsterDied) {
        handleMonsterDefeat(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }
    }

    // End of round status ticks (Poison DoT + cure 1 save, Bleed DoT, Grab break-free, duration countdowns)
    const eor = resolveEndOfRoundStatusTicks({
      character: effectiveHero,
      equipment,
      combatState: combatStatusState,
      currentHeroHp,
      rng,
      logEvent
    });
    if (eor.newHeroHp !== currentHeroHp) {
      currentHeroHp = eor.newHeroHp;

      // Fighter Second Wind rescue after Poison/Bleed DoT ticks
      const swDoT = tryTriggerFighterSecondWind({
        character: effectiveHero,
        equipment,
        encounter,
        combatState: combatStatusState,
        currentHeroHp,
        maxHeroHp: character.max_hp,
        rng,
        logEvent
      });
      if (swDoT.triggered) {
        currentHeroHp = swDoT.newHeroHp;
      }

      if (currentHeroHp <= 0 && eligibleForLevel1SpikeGuard) {
        currentHeroHp = 1;
      }
      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);
      updateEncounterCombatStateSql(tx, encounter.id, combatStatusState);

      if (currentHeroHp <= 0) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }
    }

    tx.prepare(`
      UPDATE encounters
      SET combat_round = ?,
          current_monster_hp = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(roundNumber + 1, currentMonsterHp, encounter.id);
    updateEncounterCombatStateSql(tx, encounter.id, combatStatusState);

    return getCombatState(tx, characterId, encounterId);
  });
}

module.exports = {
  getHealthBracket,
  getConditionTextForBracket,
  startCombat,
  getCombatState,
  executeCombatRound
};
