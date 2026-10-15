/**
 * Darkgrid Combat Engine
 * Manages turn-by-turn combat execution, initiative, player actions (Attack, Drink Potion, Flee),
 * 9 health condition tracking, combat log recording, and permadeath/victory integration.
 */

const { withTransaction } = require('../../db/connection');
const {
  getModifier,
  getCharacterEquipment,
  getCharacterPotionCount,
  getCharacterPotions,
  getActiveWeapon,
  getEffectiveStats,
  INACTIVE_CONSUMABLE_NAMES
} = require('../character/rules');
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
  describeFleeAttempt
} = require('./narrative');
const { handlePlayerDeath, handleMonsterDefeat } = require('../monsters/persistence');
const {
  parseCombatStateJson,
  serializeCombatStateJson,
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
 * subtype metadata, persistent monster instance fields, and Named Hunting Contract modifiers.
 */
function fetchEncounterWithMonster(db, encounterId, characterId) {
  const row = db.prepare(`
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

  if (!row) return null;

  const isBountyTarget = Boolean(row.bounty_contract_id && row.bounty_custom_name);
  const customDisplayName = row.bounty_custom_name || row.instance_custom_title || null;
  const attackBonusMod = isBountyTarget ? Number(row.bounty_attack_bonus_mod || 0) : 0;
  const damageBonusMod = isBountyTarget ? Number(row.bounty_damage_bonus_mod || 0) : 0;

  return {
    ...row,
    monster_name: customDisplayName || row.base_monster_name,
    base_monster_name: row.base_monster_name,
    custom_title: row.instance_custom_title || null,
    isBountyTarget,
    monster_ab: Number(row.base_monster_ab || 0) + attackBonusMod,
    bounty_damage_bonus: damageBonusMod
  };
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

    // Determine monster max HP (accounting for persistent monster HP or Named Bounty TOUGH boost)
    const monsterMaxHp = encounter.instance_max_hp || encounter.bounty_boosted_max_hp || encounter.monster_max_hp || encounter.base_hp;
    // Persistent monsters start each new combat engagement at full boosted max HP (H2)
    let currentMonsterHp = encounter.monster_instance_id
      ? monsterMaxHp
      : (encounter.current_monster_hp || monsterMaxHp);

    const equipment = getCharacterEquipment(tx, characterId);
    const effectiveCharacter = getEffectiveStats(character, equipment);
    let openingShotResolved = encounter.opening_shot_resolved || 0;

    // Check Ranger Ranged Opening Shot condition:
    // 1. Character class is Ranger
    // 2. Ranger has prepared ranged weapon
    // 3. Ranger spotted monster first (spotted_by_hero === 1)
    // 4. Monster did not ambush Ranger (is_ambush === 0)
    // 5. Combat has not already started (status === 'DISCOVERED')
    // 6. Opening shot has not already been resolved (opening_shot_resolved === 0)
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
      const openingAB = calculateHeroAttackBonus(effectiveCharacter, equipment.rangedWeapon, encounter);
      const monsterAC = encounter.monster_ac || encounter.armor_class;
      const attackRoll = resolveAttackRoll(openingAB, monsterAC, rng);
      openingShotHit = attackRoll.isHit;
      openingShotCrit = attackRoll.isCrit;
      let openingDamage = 0;

      if (attackRoll.isHit) {
        const damageFormula = getHeroDamageFormula(effectiveCharacter, equipment.rangedWeapon, encounter);
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
      const heroDexMod = getModifier(character.dexterity);
      const isAmbushActive = Number(encounter.is_ambush || 0) === 1;
      const ambushInitBonus = isAmbushActive ? 4 : 0;
      heroInit = rollInitiative(heroDexMod, rng);
      monsterInit = rollInitiative((encounter.initiative_bonus || 0) + ambushInitBonus, rng);
      // Ties go to the hero normally, but to the ambushing monster during an ambush
      initiativeWinner = isAmbushActive
        ? (monsterInit >= heroInit ? 'MONSTER' : 'HERO')
        : (heroInit >= monsterInit ? 'HERO' : 'MONSTER');
    }

    const initialBracket = getHealthBracket(currentMonsterHp, monsterMaxHp);
    const combatStatusState = parseCombatStateJson(encounter.combat_state_json);

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

    // Resolve Combat-Start Auras (Stench, Fear, Web/Entangle) after initiative and initial condition
    if (!combatStatusState.auraResolved) {
      resolveCombatStartAura(effectiveCharacter, equipment, encounter, combatStatusState, rng, (type, text, details = {}) => {
        tx.prepare(`
          INSERT INTO combat_events (
            encounter_id, round_number, event_type, public_text, details
          ) VALUES (?, 1, ?, ?, ?)
        `).run(encounterId, type, text, JSON.stringify(details));
      });
    }

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
  const potions = getCharacterPotions(db, characterId, { combatOnly: true });
  const potionCount = potions.length;

  const combatStatusState = parseCombatStateJson(encounter.combat_state_json);
  const statusMods = getActiveStatusModifiers(combatStatusState);
  const heroStatusBadges = getPublicHeroStatusBadges(combatStatusState);

  const { activeWeapon, isRangedActive } = getActiveWeapon(effectiveCharacter, equipment, encounter);
  const baseHeroAC = calculateHeroAC(effectiveCharacter, equipment, isRangedActive, encounter, activeWeapon);
  const heroAC = baseHeroAC + statusMods.acMod;

  const effectiveMonsterMaxHp = encounter.instance_max_hp || encounter.bounty_boosted_max_hp || encounter.monster_max_hp || encounter.base_hp;
  const currentBracket = getHealthBracket(encounter.current_monster_hp, effectiveMonsterMaxHp);
  const currentConditionText = getConditionTextForBracket(encounter.monster_descriptions, currentBracket);

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
    combatStatusState
  };
}

/**
 * Executes a single turn action in combat (ATTACK, DRINK_POTION, FLEE).
 * Thread-safe and atomic with idempotency protection.
 */
function executeCombatRound(db, characterId, encounterId, action, options = {}) {
  const rng = options.rng || Math.random;
  const normalizedAction = (action || '').toUpperCase().trim();

  if (!['ATTACK', 'DRINK_POTION', 'FLEE'].includes(normalizedAction)) {
    throw new Error(`Invalid combat action: ${action}. Allowed actions are ATTACK, DRINK_POTION, FLEE.`);
  }

  return withTransaction(db, (tx) => {
    // 1. Validate character and encounter state
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

    // Determine effective round number
    let roundNumber = encounter.combat_round || 1;
    if (roundNumber === 0) roundNumber = 1;

    // Idempotency check: prevent duplicate submissions of the same round
    if (typeof options.expectedRound === 'number' && roundNumber !== options.expectedRound) {
      return getCombatState(tx, characterId, encounterId);
    }

    let monsterInstance = null;
    if (encounter.monster_instance_id) {
      monsterInstance = tx.prepare('SELECT * FROM monster_instances WHERE id = ?').get(encounter.monster_instance_id);
    }

    // Concurrent Persistent Monster check (H1): If another player has slain the monster instance,
    // conclude this encounter peacefully with 0 duplicate gold, 0 duplicate items, and 0 XP.
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
    const { activeWeapon, isRangedActive } = getActiveWeapon(effectiveHero, equipment, encounter);
    const baseHeroAC = calculateHeroAC(effectiveHero, equipment, isRangedActive, encounter, activeWeapon);
    const baseHeroAB = calculateHeroAttackBonus(effectiveHero, activeWeapon, encounter);
    const combatStatusState = parseCombatStateJson(encounter.combat_state_json);
    const initialStatusMods = getActiveStatusModifiers(combatStatusState);
    const heroAC = baseHeroAC + initialStatusMods.acMod;

    let currentMonsterHp = encounter.current_monster_hp;
    let monsterMaxHp = encounter.monster_max_hp || encounter.bounty_boosted_max_hp || (monsterInstance ? monsterInstance.max_hp : encounter.base_hp);
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

    // =========================================================================
    // ACTION 1: FLEE
    // Flótti yfirtekur umferðarflæði. Skrímslið fær nákvæmlega eina fría árás.
    // (Permadeath Safety Rule #8: Flee is always available even if Grabbed/Entangled/Paralyzed)
    // =========================================================================
    if (normalizedAction === 'FLEE') {
      const freeAttackRoll = resolveAttackRoll(encounter.monster_ab, heroAC, rng);
      let freeDamage = 0;

      if (freeAttackRoll.isHit) {
        freeDamage = resolveDamage(encounter.monster_damage_dice, freeAttackRoll.isCrit, rng) + bountyDamageBonus;
        currentHeroHp = Math.max(0, currentHeroHp - freeDamage);
      }

      const survived = currentHeroHp > 0;
      const fleeNarrative = describeFleeAttempt(freeAttackRoll, survived);
      logEvent('FLEE', fleeNarrative, {
        isHit: freeAttackRoll.isHit,
        isCrit: freeAttackRoll.isCrit,
        damage: freeDamage,
        survived
      });

      if (!survived) {
        // Player slain during retreat
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      // Escape succeeded: close encounter, clear temporary combat statuses, unlock movement
      tx.prepare(`
        UPDATE encounters
        SET status = 'ESCAPED', combat_state_json = '{}', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(encounter.id);

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);

      // Persistent monster fully recovers to max HP upon hero retreat (H2)
      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = max_hp WHERE id = ?').run(monsterInstance.id);
      }

      return getCombatState(tx, characterId, encounterId);
    }

    // =========================================================================
    // ACTION 2: DRINK POTION
    // Hetja drekkur lækningadrykk. Skrímslið fær venjulega umferðarárás.
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
        // Default to the cheapest available healing potion (ordered by buy_price ASC, ii.id ASC)
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

      // Consume potion
      tx.prepare('DELETE FROM item_instances WHERE id = ?').run(potion.id);
      const rollAmount = resolvePotionHealing(potion, rng);
      const newHeroHp = Math.min(character.max_hp, currentHeroHp + rollAmount);
      const actualHealed = newHeroHp - currentHeroHp;
      currentHeroHp = newHeroHp;

      // Drinking a healing potion staunchly stops active Bleeding and clears 1-round Paralysis
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

      // Monster turn specials & standard attack
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
        const monsterAttackRoll = resolveAttackRoll(encounter.monster_ab + turnSpecials.monsterAbBonus, effectiveHeroAC, rng);
        let monsterDamage = 0;

        if (monsterAttackRoll.isHit) {
          monsterDamage = resolveDamage(encounter.monster_damage_dice, monsterAttackRoll.isCrit, rng);
          if (turnSpecials.bonusDamageFormula) {
            monsterDamage += resolveDamage(turnSpecials.bonusDamageFormula, false, rng);
          }
          monsterDamage = Math.max(1, monsterDamage + turnSpecials.bloodFrenzyDmgBonus + bountyDamageBonus);
          currentHeroHp = Math.max(0, currentHeroHp - monsterDamage);
        }

        logEvent('MONSTER_ATTACK', describeMonsterAttack(encounter, monsterAttackRoll), {
          isHit: monsterAttackRoll.isHit,
          isCrit: monsterAttackRoll.isCrit,
          damage: monsterDamage
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

      if (currentHeroHp <= 0) {
        // Player slain by monster attack or DoT after drinking potion
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      // Round advances
      tx.prepare(`
        UPDATE encounters
        SET combat_round = ?,
            current_monster_hp = ?,
            combat_state_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(roundNumber + 1, currentMonsterHp, serializeCombatStateJson(combatStatusState), encounter.id);

      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = ? WHERE id = ?').run(currentMonsterHp, monsterInstance.id);
      }

      return getCombatState(tx, characterId, encounterId);
    }

    // =========================================================================
    // ACTION 3: ATTACK
    // Umferðaruppgjör ræðst af frumkvæði (initiative_winner).
    // =========================================================================
    const initiativeWinner = encounter.initiative_winner || 'HERO';

    function heroAttackPhase() {
      // Permadeath Safety Rule #1: 1-round Paralysis consumes Attack action to break free
      if (combatStatusState.heroStatuses.paralyzed > 0) {
        combatStatusState.heroStatuses.paralyzed = 0;
        logEvent(
          'HERO_ATTACK',
          'You strain with all your might against the numbing paralysis, wrenching your limbs free of the rigor!',
          { isHit: false, isCrit: false, damage: 0, paralyzedStun: true }
        );
        tx.prepare('UPDATE encounters SET combat_state_json = ? WHERE id = ?').run(
          serializeCombatStateJson(combatStatusState),
          encounter.id
        );
        return false;
      }

      const currentMods = getActiveStatusModifiers(combatStatusState);
      const effectiveHeroAB = baseHeroAB + currentMods.atkMod;
      const effectiveMonsterAC = Math.max(1, (encounter.monster_ac || 10) - (combatStatusState.bloodFrenzyActive ? 2 : 0));

      const heroAttackRoll = resolveAttackRoll(effectiveHeroAB, effectiveMonsterAC, rng);
      let heroDamage = 0;

      if (heroAttackRoll.isHit) {
        const damageFormula = getHeroDamageFormula(effectiveHero, activeWeapon, encounter);
        let rawHeroDamage = resolveDamage(damageFormula, heroAttackRoll.isCrit, rng);
        rawHeroDamage = Math.max(1, rawHeroDamage + currentMods.dmgMod);

        const modResult = modifyHeroAttackDamageAndState({
          character: effectiveHero,
          activeWeapon,
          encounter,
          combatState: combatStatusState,
          heroAttackRoll,
          rawHeroDamage,
          currentMonsterHp,
          monsterMaxHp,
          logEvent
        });
        heroDamage = modResult.finalDamage;
        currentMonsterHp = modResult.newMonsterHp;
      }

      logEvent('HERO_ATTACK', describeHeroAttack(activeWeapon, heroAttackRoll), {
        isHit: heroAttackRoll.isHit,
        isCrit: heroAttackRoll.isCrit,
        damage: heroDamage
      });

      checkMonsterHealthCondition(currentMonsterHp);

      tx.prepare(`
        UPDATE encounters
        SET current_monster_hp = ?, last_health_bracket = ?, combat_state_json = ?
        WHERE id = ?
      `).run(currentMonsterHp, lastHealthBracket, serializeCombatStateJson(combatStatusState), encounter.id);

      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = ? WHERE id = ?').run(currentMonsterHp, monsterInstance.id);
      }

      return currentMonsterHp <= 0;
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
        const monsterAttackRoll = resolveAttackRoll(encounter.monster_ab + turnSpecials.monsterAbBonus, effectiveHeroAC, rng);
        let monsterDamage = 0;

        if (monsterAttackRoll.isHit) {
          monsterDamage = resolveDamage(encounter.monster_damage_dice, monsterAttackRoll.isCrit, rng);
          if (turnSpecials.bonusDamageFormula) {
            monsterDamage += resolveDamage(turnSpecials.bonusDamageFormula, false, rng);
          }
          monsterDamage = Math.max(1, monsterDamage + turnSpecials.bloodFrenzyDmgBonus + bountyDamageBonus);
          currentHeroHp = Math.max(0, currentHeroHp - monsterDamage);
        }

        logEvent('MONSTER_ATTACK', describeMonsterAttack(encounter, monsterAttackRoll), {
          isHit: monsterAttackRoll.isHit,
          isCrit: monsterAttackRoll.isCrit,
          damage: monsterDamage
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

      if (currentHeroHp <= 0 && eligibleForLevel1SpikeGuard) {
        currentHeroHp = 1;
        logEvent('HERO_STATUS', "Death's Door! Sheer survival instinct keeps you standing at 1 HP after a lethal opening blow!", {
          level1SpikeGuard: true
        });
      }

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);
      tx.prepare('UPDATE encounters SET current_monster_hp = ?, combat_state_json = ? WHERE id = ?').run(
        currentMonsterHp,
        serializeCombatStateJson(combatStatusState),
        encounter.id
      );
      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = ? WHERE id = ?').run(currentMonsterHp, monsterInstance.id);
      }

      return currentHeroHp <= 0;
    }

    if (initiativeWinner === 'HERO') {
      // Hero attacks first
      const monsterDied = heroAttackPhase();
      if (monsterDied) {
        // Victory! Monster does not get a retaliatory attack
        handleMonsterDefeat(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      // Monster attacks second
      const heroDied = monsterAttackPhase();
      if (heroDied) {
        // Player defeated
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }
    } else {
      // Monster attacks first
      const heroDied = monsterAttackPhase();
      if (heroDied) {
        // Player defeated before they can strike
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      // Hero attacks second
      const monsterDied = heroAttackPhase();
      if (monsterDied) {
        // Victory!
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
      if (currentHeroHp <= 0 && eligibleForLevel1SpikeGuard) {
        currentHeroHp = 1;
      }
      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);
      if (currentHeroHp <= 0) {
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }
    }

    // Both combatants survived: advance round
    tx.prepare(`
      UPDATE encounters
      SET combat_round = ?,
          current_monster_hp = ?,
          combat_state_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(roundNumber + 1, currentMonsterHp, serializeCombatStateJson(combatStatusState), encounter.id);

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
