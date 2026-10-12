/**
 * Darkgrid Combat Engine
 * Manages turn-by-turn combat execution, initiative, player actions (Attack, Drink Potion, Flee),
 * 9 health condition tracking, combat log recording, and permadeath/victory integration.
 */

const { withTransaction } = require('../../db/connection');
const { getModifier, getCharacterEquipment, getCharacterPotionCount } = require('../character/rules');
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
 * Initializes combat session for an encounter.
 * Rolls initiative once, sets status to IN_COMBAT, establishes maximum HP, and logs initial engagement.
 */
function startCombat(db, characterId, encounterId, options = {}) {
  const rng = options.rng || Math.random;

  return withTransaction(db, (tx) => {
    const character = tx.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character || character.is_alive !== 1) {
      throw new Error('Hero is not eligible for combat.');
    }

    const encounter = tx.prepare(`
      SELECT e.*, m.name as monster_name, m.symbol as monster_symbol,
             m.base_hp, m.initiative_bonus, m.descriptions as monster_descriptions,
             mi.max_hp as instance_max_hp, mi.current_hp as instance_current_hp
      FROM encounters e
      JOIN monsters m ON e.monster_id = m.id
      LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
      WHERE e.id = ? AND e.character_id = ?
    `).get(encounterId, characterId);

    if (!encounter) {
      throw new Error('Encounter not found.');
    }

    if (encounter.status === 'VICTORY' || encounter.status === 'DEFEAT' || encounter.status === 'ESCAPED' || encounter.status === 'IGNORED') {
      throw new Error(`Encounter is already resolved (${encounter.status}).`);
    }

    // Determine monster max HP
    const monsterMaxHp = encounter.instance_max_hp || encounter.monster_max_hp || encounter.base_hp;
    const currentMonsterHp = encounter.instance_current_hp || encounter.current_monster_hp || monsterMaxHp;

    // Roll initiative if not already rolled
    let initiativeWinner = encounter.initiative_winner;
    let heroInit = encounter.hero_initiative;
    let monsterInit = encounter.monster_initiative;

    if (!initiativeWinner) {
      const heroDexMod = getModifier(character.dexterity);
      heroInit = rollInitiative(heroDexMod, rng);
      monsterInit = rollInitiative(encounter.initiative_bonus || 0, rng);
      // Ties go to the hero
      initiativeWinner = heroInit >= monsterInit ? 'HERO' : 'MONSTER';
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
          last_health_bracket = 100,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      initiativeWinner,
      heroInit,
      monsterInit,
      monsterMaxHp,
      currentMonsterHp,
      encounterId
    );

    // Initial engagement description
    const initialCondition = getConditionTextForBracket(encounter.monster_descriptions, 100);
    const existingEventsCount = tx.prepare('SELECT COUNT(*) as c FROM combat_events WHERE encounter_id = ?').get(encounterId).c;

    if (existingEventsCount === 0 && initialCondition) {
      tx.prepare(`
        INSERT INTO combat_events (
          encounter_id, round_number, event_type, public_text, details
        ) VALUES (?, 1, 'CONDITION', ?, ?)
      `).run(
        encounterId,
        initialCondition,
        JSON.stringify({ bracket: 100, initiativeWinner })
      );
    }

    return getCombatState(tx, characterId, encounterId);
  });
}

/**
 * Retrieves full combat state for active encounter including public combat events log.
 * Strictly guarantees no hidden monster stats (HP, AC, rolls) leak to public properties.
 */
function getCombatState(db, characterId, encounterId) {
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  const encounter = db.prepare(`
    SELECT e.*, m.name as monster_name, m.symbol as monster_symbol, m.color as monster_color,
           m.descriptions as monster_descriptions, m.image_path as monster_image_path,
           m.challenge_rating, m.armor_class as monster_ac, m.attack_bonus as monster_ab,
           m.damage_dice as monster_damage_dice, m.xp_reward, m.base_hp, m.creature_type
    FROM encounters e
    JOIN monsters m ON e.monster_id = m.id
    WHERE e.id = ? AND e.character_id = ?
  `).get(encounterId, characterId);

  if (!encounter) return null;

  const events = db.prepare(`
    SELECT * FROM combat_events
    WHERE encounter_id = ?
    ORDER BY id ASC
  `).all(encounterId);

  const equipment = getCharacterEquipment(db, characterId);
  const potionCount = getCharacterPotionCount(db, characterId);

  const currentBracket = getHealthBracket(encounter.current_monster_hp, encounter.monster_max_hp || encounter.base_hp);
  const currentConditionText = getConditionTextForBracket(encounter.monster_descriptions, currentBracket);

  return {
    character,
    encounter,
    events,
    equipment,
    potionCount,
    currentBracket,
    currentConditionText
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

    const encounter = tx.prepare(`
      SELECT e.*, m.name as monster_name, m.symbol as monster_symbol, m.color as monster_color,
             m.armor_class as monster_ac, m.attack_bonus as monster_ab, m.damage_dice as monster_damage_dice,
             m.base_hp, m.xp_reward, m.creature_type, m.descriptions as monster_descriptions
      FROM encounters e
      JOIN monsters m ON e.monster_id = m.id
      WHERE e.id = ? AND e.character_id = ?
    `).get(encounterId, characterId);

    if (!encounter) {
      throw new Error('Encounter not found.');
    }

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

    const equipment = getCharacterEquipment(tx, characterId);
    const heroAC = calculateHeroAC(character, equipment.armor, equipment.shield);
    const heroAB = calculateHeroAttackBonus(character, equipment.weapon);

    let currentMonsterHp = encounter.current_monster_hp;
    let monsterMaxHp = encounter.monster_max_hp || (monsterInstance ? monsterInstance.max_hp : encounter.base_hp);
    let currentHeroHp = character.current_hp;
    let lastHealthBracket = encounter.last_health_bracket != null ? encounter.last_health_bracket : 100;

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
    // =========================================================================
    if (normalizedAction === 'FLEE') {
      const freeAttackRoll = resolveAttackRoll(encounter.monster_ab, heroAC, rng);
      let freeDamage = 0;

      if (freeAttackRoll.isHit) {
        freeDamage = resolveDamage(encounter.monster_damage_dice, freeAttackRoll.isCrit, rng);
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

      // Escape succeeded: close encounter, unlock movement, player remains on tile
      tx.prepare(`
        UPDATE encounters
        SET status = 'ESCAPED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(encounter.id);

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);

      return getCombatState(tx, characterId, encounterId);
    }

    // =========================================================================
    // ACTION 2: DRINK POTION
    // Hetja drekkur lækningadrykk. Skrímslið fær venjulega umferðarárás.
    // =========================================================================
    if (normalizedAction === 'DRINK_POTION') {
      const potion = tx.prepare(`
        SELECT ii.id, id.attributes
        FROM item_instances ii
        JOIN item_definitions id ON ii.item_definition_id = id.id
        WHERE ii.owner_type = 'CHARACTER' AND ii.owner_character_id = ? AND id.category = 'POTION'
        LIMIT 1
      `).get(character.id);

      if (!potion) {
        throw new Error('You do not possess any healing potions.');
      }

      // Consume potion
      tx.prepare('DELETE FROM item_instances WHERE id = ?').run(potion.id);
      const healAmount = resolvePotionHealing(potion, rng);
      currentHeroHp = Math.min(character.max_hp, currentHeroHp + healAmount);

      logEvent('POTION_USED', describePotionDrink(), { healed: healAmount });

      // Monster makes its standard round attack against the hero
      const monsterAttackRoll = resolveAttackRoll(encounter.monster_ab, heroAC, rng);
      let monsterDamage = 0;

      if (monsterAttackRoll.isHit) {
        monsterDamage = resolveDamage(encounter.monster_damage_dice, monsterAttackRoll.isCrit, rng);
        currentHeroHp = Math.max(0, currentHeroHp - monsterDamage);
      }

      logEvent('MONSTER_ATTACK', describeMonsterAttack(encounter, monsterAttackRoll), {
        isHit: monsterAttackRoll.isHit,
        isCrit: monsterAttackRoll.isCrit,
        damage: monsterDamage
      });

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);

      if (currentHeroHp <= 0) {
        // Player slain by monster attack after drinking potion
        handlePlayerDeath(tx, character, encounter, encounter, monsterInstance, { rng });
        return getCombatState(tx, characterId, encounterId);
      }

      // Round advances
      tx.prepare(`
        UPDATE encounters
        SET combat_round = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(roundNumber + 1, encounter.id);

      return getCombatState(tx, characterId, encounterId);
    }

    // =========================================================================
    // ACTION 3: ATTACK
    // Umferðaruppgjör ræðst af frumkvæði (initiative_winner).
    // =========================================================================
    const initiativeWinner = encounter.initiative_winner || 'HERO';

    function heroAttackPhase() {
      const heroAttackRoll = resolveAttackRoll(heroAB, encounter.monster_ac, rng);
      let heroDamage = 0;

      if (heroAttackRoll.isHit) {
        const damageFormula = getHeroDamageFormula(character, equipment.weapon);
        heroDamage = resolveDamage(damageFormula, heroAttackRoll.isCrit, rng);
        currentMonsterHp = Math.max(0, currentMonsterHp - heroDamage);
      }

      logEvent('HERO_ATTACK', describeHeroAttack(equipment.weapon, heroAttackRoll), {
        isHit: heroAttackRoll.isHit,
        isCrit: heroAttackRoll.isCrit,
        damage: heroDamage
      });

      checkMonsterHealthCondition(currentMonsterHp);

      tx.prepare(`
        UPDATE encounters
        SET current_monster_hp = ?, last_health_bracket = ?
        WHERE id = ?
      `).run(currentMonsterHp, lastHealthBracket, encounter.id);

      if (monsterInstance) {
        tx.prepare('UPDATE monster_instances SET current_hp = ? WHERE id = ?').run(currentMonsterHp, monsterInstance.id);
      }

      return currentMonsterHp <= 0;
    }

    function monsterAttackPhase() {
      const monsterAttackRoll = resolveAttackRoll(encounter.monster_ab, heroAC, rng);
      let monsterDamage = 0;

      if (monsterAttackRoll.isHit) {
        monsterDamage = resolveDamage(encounter.monster_damage_dice, monsterAttackRoll.isCrit, rng);
        currentHeroHp = Math.max(0, currentHeroHp - monsterDamage);
      }

      logEvent('MONSTER_ATTACK', describeMonsterAttack(encounter, monsterAttackRoll), {
        isHit: monsterAttackRoll.isHit,
        isCrit: monsterAttackRoll.isCrit,
        damage: monsterDamage
      });

      tx.prepare('UPDATE characters SET current_hp = ? WHERE id = ?').run(currentHeroHp, character.id);

      return currentHeroHp <= 0;
    }

    if (initiativeWinner === 'HERO') {
      // Hero attacks first
      const monsterDied = heroAttackPhase();
      if (monsterDied) {
        // Victory! Monster does not get a retaliatory attack
        handleMonsterDefeat(tx, character, encounter, encounter, monsterInstance);
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
        handleMonsterDefeat(tx, character, encounter, encounter, monsterInstance);
        return getCombatState(tx, characterId, encounterId);
      }
    }

    // Both combatants survived: advance round
    tx.prepare(`
      UPDATE encounters
      SET combat_round = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(roundNumber + 1, encounter.id);

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
