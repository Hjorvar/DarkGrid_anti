/**
 * DARKGRID — Phase 7B: Class Monster Knowledge & INT/WIS Battle Experience
 *
 * Implements:
 * 1. Fighter — Know Your Enemy (humanoid, giant, and martial opponents)
 * 2. Ranger  — Natural Knowledge (animals, magical beasts, arachnids, vermin, plants, drakes, fey)
 * 3. Cleric  — Sacred Knowledge (undead & necromantic curses)
 * 4. INT/WIS Battle Experience (per-species learned damage and AC from confirmed combat victories)
 */

const {
  resolveMonsterFamily,
  normalizeRangerFavoredEnemy,
  getFamilyMetadata
} = require('../monsters/taxonomy');

const FIGHTER_MARTIAL_FAMILIES = new Set([
  'GOBLINOIDS',
  'ORCS',
  'GNOLLS',
  'REPTILIAN_HUMANOIDS',
  'TROLLS',
  'GIANTS',
  'AMPHIBIAN_HUMANOIDS',
  'SUBTERRANEAN_HUMANOIDS',
  'MONSTROUS_HUMANOIDS'
]);

const FIGHTER_NON_MARTIAL_EXCLUSIONS = new Set([
  'green hag'
]);

const FIGHTER_MARTIAL_EXCEPTIONS = new Set([
  'spriggan'
]);

const RANGER_NATURAL_FAMILIES = new Set([
  'ANIMALS',
  'LUPINE_CANINE_BEASTS',
  'AVIAN_CHIMERAS',
  'TERRESTRIAL_MAGICAL_BEASTS',
  'ARACHNIDS',
  'VERMIN_INSECTS',
  'DANGEROUS_PLANTS',
  'DRAGONS_DRAKES',
  'FEY'
]);

const CLERIC_OCCULT_AWARENESS_NAMES = new Set([
  'green hag',
  'death dog',
  'bunyip'
]);

function getMonsterIdentityName(monster) {
  if (!monster || typeof monster !== 'object') return '';
  return String(monster.base_monster_name || monster.name || monster.monsterName || '')
    .trim()
    .toLowerCase();
}

/**
 * Checks whether a monster object carries real monster classification metadata
 * (as opposed to an anonymous weapon-test stub with only movement_type).
 */
function hasMonsterClassificationMetadata(monster, { allowNameOnly = true } = {}) {
  if (!monster || typeof monster !== 'object') return false;
  if (
    monster.id !== undefined ||
    monster.monster_id !== undefined ||
    monster.creature_type ||
    monster.creatureType ||
    monster.monster_family ||
    monster.monsterFamily ||
    monster.creature_subtype ||
    monster.creatureSubtype
  ) {
    return true;
  }
  return Boolean(allowNameOnly && getMonsterIdentityName(monster));
}

/**
 * Fighter — Know Your Enemy target matcher.
 * Covers all 25 martial/humanoid/giant monsters in the 98-monster roster.
 */
function doesMonsterMatchKnowYourEnemy(monster, options = {}) {
  if (!hasMonsterClassificationMetadata(monster, options)) return false;

  const nameKey = getMonsterIdentityName(monster);
  if (nameKey && FIGHTER_NON_MARTIAL_EXCLUSIONS.has(nameKey)) {
    return false;
  }
  if (nameKey && FIGHTER_MARTIAL_EXCEPTIONS.has(nameKey)) {
    return true;
  }

  const family = resolveMonsterFamily(monster, { strict: false });
  if (family && FIGHTER_MARTIAL_FAMILIES.has(family)) {
    return true;
  }

  const cType = String(monster.creature_type || monster.creatureType || '').trim().toUpperCase();
  if (cType === 'HUMANOID' || cType === 'MONSTROUS HUMANOID' || cType === 'MONSTROUS_HUMANOID') {
    return true;
  }

  return false;
}

/**
 * Ranger — Natural Knowledge target matcher.
 * Covers Animals, Lupine/Canine Beasts, Avian Chimeras, Other Magical Beasts,
 * Arachnids (including Ettercap), Vermin/Insects, Dangerous Plants, Dragons/Drakes, and Fey.
 */
function doesMonsterMatchNaturalKnowledge(monster, options = {}) {
  if (!hasMonsterClassificationMetadata(monster, options)) return false;

  const family = resolveMonsterFamily(monster, { strict: false });
  if (family && RANGER_NATURAL_FAMILIES.has(family)) {
    return true;
  }

  const cType = String(monster.creature_type || monster.creatureType || '').trim().toUpperCase();
  if (
    cType === 'ANIMAL' ||
    cType === 'BEAST' ||
    cType === 'MAGICAL BEAST' ||
    cType === 'MAGICAL_BEAST' ||
    cType === 'VERMIN' ||
    cType === 'PLANT' ||
    cType === 'DRAGON' ||
    cType === 'FEY'
  ) {
    return true;
  }

  return false;
}

/**
 * Cleric — Sacred Knowledge target matcher (Undead).
 */
function doesMonsterMatchSacredKnowledge(monster, options = {}) {
  if (!hasMonsterClassificationMetadata(monster, options)) return false;

  const family = resolveMonsterFamily(monster, { strict: false });
  if (family === 'UNDEAD') return true;

  const cType = String(monster.creature_type || monster.creatureType || '').trim().toUpperCase();
  return cType === 'UNDEAD';
}

/**
 * Checks whether a monster matches a Ranger's chosen Favored Enemy family
 * (with full backward-compatibility for legacy favored_enemy_type / favored_enemy_subtype).
 */
function doesMonsterMatchRangerFavoredEnemy(character, monster) {
  if (!character || !monster) return false;
  if (String(character.class || '').toUpperCase() !== 'RANGER') return false;

  const monsterFamily = resolveMonsterFamily(monster, { strict: false });
  const cType = String(monster.creature_type || monster.creatureType || '').trim().toUpperCase();
  const cSub = String(monster.creature_subtype || monster.creatureSubtype || '').trim().toLowerCase();

  // Strictly forbidden: Undead can never be a Ranger Favored Enemy
  if (monsterFamily === 'UNDEAD' || cType === 'UNDEAD') {
    return false;
  }

  const norm = normalizeRangerFavoredEnemy(character);
  const normFamily = typeof norm === 'object' && norm ? norm.family : norm;
  if (!normFamily || normFamily === 'UNDEAD') {
    return false;
  }

  const explicitFamilyCol = String(character.favored_enemy_family || character.favoredEnemyFamily || '').trim().toUpperCase();
  const rawLegacyType = String(character.favored_enemy_type || character.favoredEnemyType || '').trim().toUpperCase();
  const rawLegacySub = String(character.favored_enemy_subtype || character.favoredEnemySubtype || '').trim().toLowerCase();

  // If the character explicitly specified a humanoid subtype (e.g. HUMANOID:goblinoid)
  // and the monster is HUMANOID with a different explicit creature_subtype, do not match.
  if (rawLegacyType === 'HUMANOID' && rawLegacySub && cType === 'HUMANOID' && cSub && cSub !== rawLegacySub) {
    return false;
  }

  // 1. Primary 22-family match
  if (monsterFamily && normFamily === monsterFamily) {
    return true;
  }

  // 2. Backward compatibility for legacy Rangers who stored broad creature_type before Phase 7B
  const isLegacyBroadType = ['ANIMAL', 'BEAST', 'MAGICAL BEAST', 'MAGICAL_BEAST', 'VERMIN', 'PLANT', 'HUMANOID'].includes(rawLegacyType);
  if (!explicitFamilyCol || explicitFamilyCol === rawLegacyType || isLegacyBroadType) {
    if ((rawLegacyType === 'ANIMAL' || rawLegacyType === 'BEAST') && (cType === 'ANIMAL' || cType === 'BEAST')) {
      return true;
    }
    if ((rawLegacyType === 'MAGICAL BEAST' || rawLegacyType === 'MAGICAL_BEAST') && (cType === 'MAGICAL BEAST' || cType === 'MAGICAL_BEAST')) {
      return true;
    }
    if (rawLegacyType === 'VERMIN' && cType === 'VERMIN') {
      return true;
    }
    if (rawLegacyType === 'PLANT' && cType === 'PLANT') {
      return true;
    }
    if (rawLegacyType === 'HUMANOID' && rawLegacySub && cType === 'HUMANOID' && cSub === rawLegacySub) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether a character has automatic class knowledge/specialization for a monster
 * (used for Stage 1 & Stage 2 encounter clue unlocking AND for exempting 0-win INT/WIS unfamiliar penalties).
 */
function hasClassGeneralKnowledge(character, monster) {
  if (!character || !monster) return false;
  const charClass = String(character.class || character || '').toUpperCase();

  if (charClass === 'FIGHTER') {
    return doesMonsterMatchKnowYourEnemy(monster);
  }
  if (charClass === 'RANGER') {
    if (typeof character === 'object' && doesMonsterMatchRangerFavoredEnemy(character, monster)) {
      return true;
    }
    return doesMonsterMatchNaturalKnowledge(monster);
  }
  if (charClass === 'CLERIC') {
    if (doesMonsterMatchSacredKnowledge(monster)) return true;
    const nameKey = getMonsterIdentityName(monster);
    return CLERIC_OCCULT_AWARENESS_NAMES.has(nameKey);
  }
  return false;
}

/**
 * Fighter — Know Your Enemy automatic combat bonuses.
 * L1–2: +1 Atk, +0 Dmg, +1 AC
 * L3–4: +1 Atk, +1 Dmg, +1 AC
 * L5–8: +2 Atk, +2 Dmg, +2 AC
 * L9+:  +3 Atk, +3 Dmg, +2 AC
 */
function getFighterKnowYourEnemyBonus(character, monster, options = {}) {
  const charClass = String((character && character.class) || character || '').toUpperCase();
  if (charClass !== 'FIGHTER' || !doesMonsterMatchKnowYourEnemy(monster, options)) {
    return { attack: 0, damage: 0, ac: 0, active: false };
  }

  const lvl = Math.max(1, Number((character && character.level) || 1));
  if (lvl >= 9) {
    return { attack: 3, damage: 3, ac: 2, active: true };
  }
  if (lvl >= 5) {
    return { attack: 2, damage: 2, ac: 2, active: true };
  }
  if (lvl >= 3) {
    return { attack: 1, damage: 1, ac: 1, active: true };
  }
  return { attack: 1, damage: 0, ac: 1, active: true };
}

/**
 * Ranger — Natural Knowledge automatic combat bonuses.
 * Stacks additively with Favored Enemy (OC-3 Option A) and Battle Experience.
 * L1–2: +1 Atk, +0 Dmg, +0 AC
 * L3–6: +1 Atk, +1 Dmg, +1 AC
 * L7+:  +2 Atk, +2 Dmg, +1 AC
 */
function getRangerNaturalKnowledgeBonus(character, monster, options = {}) {
  const charClass = String((character && character.class) || character || '').toUpperCase();
  if (charClass !== 'RANGER' || !doesMonsterMatchNaturalKnowledge(monster, options)) {
    return { attack: 0, damage: 0, ac: 0, active: false };
  }

  const lvl = Math.max(1, Number((character && character.level) || 1));
  if (lvl >= 7) {
    return { attack: 2, damage: 2, ac: 1, active: true };
  }
  if (lvl >= 3) {
    return { attack: 1, damage: 1, ac: 1, active: true };
  }
  return { attack: 1, damage: 0, ac: 0, active: true };
}

/**
 * Cleric — Sacred Knowledge automatic passive bonus against Undead.
 * L1–4: +2 Atk, +3 Dmg, +2 AC
 * L5–8: +3 Atk, +4 Dmg, +3 AC
 * L9+:  +4 Atk, +5 Dmg, +4 AC
 */
function getClericSacredKnowledgeBonus(character, monster = { monster_family: 'UNDEAD' }) {
  const charClass = String((character && character.class) || character || '').toUpperCase();
  if (charClass !== 'CLERIC' || !doesMonsterMatchSacredKnowledge(monster)) {
    return { attack: 0, damage: 0, ac: 0, active: false };
  }
  const lvl = Math.max(1, Number((character && character.level) || 1));
  if (lvl >= 9) return { attack: 4, damage: 5, ac: 4, active: true };
  if (lvl >= 5) return { attack: 3, damage: 4, ac: 3, active: true };
  return { attack: 2, damage: 3, ac: 2, active: true };
}

/**
 * Cleric — Turn Undead automatic combat disruption against Undead.
 * L1–2: -1 Monster Attack on Round 1
 * L3–6: -1 Monster Attack all rounds, -1 Monster Damage on Round 1
 * L7–9: 1d6 + max(0, WIS_mod) opening radiant disruption, -2 Monster Attack all rounds
 * L10+: 2d6 + max(0, WIS_mod) opening radiant disruption, -3 Monster Attack on Round 1 (-2 thereafter)
 */
function getClericTurnUndeadProfile(character, monster = { monster_family: 'UNDEAD' }) {
  const charClass = String((character && character.class) || character || '').toUpperCase();
  if (charClass !== 'CLERIC' || !doesMonsterMatchSacredKnowledge(monster)) {
    return {
      active: false,
      unlocked: false,
      openingDisruptionDiceCount: 0,
      round1AttackPenalty: 0,
      ongoingAttackPenalty: 0,
      round1DamagePenalty: 0,
      suppressesAmbush: false
    };
  }

  const lvl = Math.max(1, Number((character && character.level) || 1));
  if (lvl >= 10) {
    return {
      active: true,
      unlocked: true,
      openingDisruptionDiceCount: 2,
      round1AttackPenalty: 3,
      ongoingAttackPenalty: 2,
      round1DamagePenalty: 1,
      suppressesAmbush: true
    };
  }
  if (lvl >= 7) {
    return {
      active: true,
      unlocked: true,
      openingDisruptionDiceCount: 1,
      round1AttackPenalty: 2,
      ongoingAttackPenalty: 2,
      round1DamagePenalty: 1,
      suppressesAmbush: true
    };
  }
  if (lvl >= 3) {
    return {
      active: true,
      unlocked: true,
      openingDisruptionDiceCount: 0,
      round1AttackPenalty: 1,
      ongoingAttackPenalty: 1,
      round1DamagePenalty: 1,
      suppressesAmbush: false
    };
  }
  return {
    active: true,
    unlocked: false,
    openingDisruptionDiceCount: 0,
    round1AttackPenalty: 1,
    ongoingAttackPenalty: 0,
    round1DamagePenalty: 0,
    suppressesAmbush: false
  };
}

/**
 * Pure calculation of INT/WIS Battle Experience modifiers per Phase 7A.3 / 7A.4 Owner Decision (OD-7A4-05).
 */
function computeBattleExperienceModifiers(optionsOrInt = {}, maybeWis = undefined, maybeVictories = 0, maybeExempt = false) {
  let effectiveInt;
  let intelligence;
  let effectiveWis;
  let wisdom;
  let victories = 0;
  let hasClassExemption;
  let classFamiliar;

  if (typeof optionsOrInt === 'object' && optionsOrInt !== null) {
    ({
      effectiveInt,
      intelligence,
      effectiveWis,
      wisdom,
      victories = 0,
      hasClassExemption,
      classFamiliar
    } = optionsOrInt);
  } else {
    effectiveInt = optionsOrInt;
    effectiveWis = maybeWis;
    victories = maybeVictories;
    hasClassExemption = maybeExempt;
  }

  const wins = Math.max(0, Math.floor(Number(victories) || 0));
  const intScore = Number(effectiveInt ?? intelligence ?? 10);
  const wisScore = Number(effectiveWis ?? wisdom ?? 10);
  const exempt = Boolean(hasClassExemption ?? classFamiliar ?? false);

  let tier = 'UNFAMILIAR';
  let tierLabel = 'Unfamiliar';
  if (wins >= 3) {
    tier = 'EXPERIENCED';
    tierLabel = 'Experienced';
  } else if (wins >= 1) {
    tier = 'RECOGNIZED';
    tierLabel = 'Recognized';
  }

  let damageBonus = 0;
  if (wins === 0) {
    damageBonus = (intScore <= 9 && !exempt) ? -1 : 0;
  } else if (wins <= 2) {
    if (intScore >= 18) damageBonus = 2;
    else if (intScore >= 16) damageBonus = 2;
    else if (intScore >= 14) damageBonus = 1;
    else damageBonus = 0;
  } else {
    // 3+ victories (hard cap at 3 victories)
    if (intScore >= 18) damageBonus = 4;
    else if (intScore >= 16) damageBonus = 3;
    else if (intScore >= 14) damageBonus = 2;
    else if (intScore >= 12) damageBonus = 1;
    else damageBonus = 0;
  }

  let acBonus = 0;
  if (wins === 0) {
    acBonus = (wisScore <= 9 && !exempt) ? -1 : 0;
  } else if (wins <= 2) {
    if (wisScore >= 18) acBonus = 2;
    else if (wisScore >= 14) acBonus = 1;
    else acBonus = 0;
  } else {
    // 3+ victories (hard cap at 3 victories)
    if (wisScore >= 18) acBonus = 3;
    else if (wisScore >= 16) acBonus = 2;
    else if (wisScore >= 12) acBonus = 1;
    else acBonus = 0;
  }

  return {
    tier,
    tierLabel,
    victories: wins,
    damageBonus,
    acBonus
  };
}

/**
 * Checks whether the character_monster_knowledge table exists on the database connection.
 */
function hasKnowledgeTable(db) {
  if (!db || typeof db.prepare !== 'function') return false;
  try {
    const row = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'character_monster_knowledge'"
    ).get();
    return Boolean(row);
  } catch {
    return false;
  }
}

/**
 * Retrieves the character's knowledge record for a specific monster_id.
 */
function getCharacterMonsterKnowledge(db, characterId, monsterId) {
  if (!characterId || !monsterId || !hasKnowledgeTable(db)) {
    return {
      character_id: Number(characterId) || 0,
      monster_id: Number(monsterId) || 0,
      encounters: 0,
      encountersSeen: 0,
      victories: 0
    };
  }

  const row = db.prepare(`
    SELECT character_id, monster_id, encounters, victories, first_seen_at, last_fought_at
    FROM character_monster_knowledge
    WHERE character_id = ? AND monster_id = ?
  `).get(Number(characterId), Number(monsterId));

  if (row) {
    return {
      ...row,
      encountersSeen: row.encounters
    };
  }

  return {
    character_id: Number(characterId),
    monster_id: Number(monsterId),
    encounters: 0,
    encountersSeen: 0,
    victories: 0
  };
}

/**
 * Records that a character has engaged a monster species in combat (increments encounters, never victories).
 */
function recordMonsterEncountered(db, characterId, monsterId) {
  if (!characterId || !monsterId || !hasKnowledgeTable(db)) return null;
  db.prepare(`
    INSERT INTO character_monster_knowledge (character_id, monster_id, encounters, victories, first_seen_at, last_fought_at)
    VALUES (?, ?, 1, 0, datetime('now'), datetime('now'))
    ON CONFLICT(character_id, monster_id) DO UPDATE SET
      encounters = character_monster_knowledge.encounters + 1,
      last_fought_at = datetime('now')
  `).run(Number(characterId), Number(monsterId));

  return getCharacterMonsterKnowledge(db, characterId, monsterId);
}

/**
 * Records a confirmed combat victory against a monster species (increments victories by +1).
 * Called ONLY when monsterHp <= 0 and hero is alive.
 */
function recordMonsterVictory(db, characterId, monsterId) {
  if (!characterId || !monsterId || !hasKnowledgeTable(db)) return null;
  db.prepare(`
    INSERT INTO character_monster_knowledge (character_id, monster_id, encounters, victories, first_seen_at, last_fought_at)
    VALUES (?, ?, 1, 1, datetime('now'), datetime('now'))
    ON CONFLICT(character_id, monster_id) DO UPDATE SET
      victories = character_monster_knowledge.victories + 1,
      encounters = MAX(1, character_monster_knowledge.encounters),
      last_fought_at = datetime('now')
  `).run(Number(characterId), Number(monsterId));

  return getCharacterMonsterKnowledge(db, characterId, monsterId);
}

/**
 * Computes the complete Battle Experience + Class Knowledge summary for a hero and monster.
 */
function evaluateHeroMonsterKnowledge(db, hero, monster) {
  const monsterId = monster ? (monster.monster_id || monster.id || null) : null;
  const record = (db && hero && hero.id && monsterId)
    ? getCharacterMonsterKnowledge(db, hero.id, monsterId)
    : { encounters: 0, victories: Number((hero && hero.monsterVictories) || (monster && monster.heroVictories) || 0) };

  const hasClassExemption = hasClassGeneralKnowledge(hero, monster);
  const battleExp = computeBattleExperienceModifiers({
    effectiveInt: hero ? hero.intelligence : 10,
    effectiveWis: hero ? hero.wisdom : 10,
    victories: record.victories,
    hasClassExemption
  });

  const kye = getFighterKnowYourEnemyBonus(hero, monster);
  const nat = getRangerNaturalKnowledgeBonus(hero, monster);
  const sacred = doesMonsterMatchSacredKnowledge(monster) && String((hero && hero.class) || '').toUpperCase() === 'CLERIC';
  const favored = doesMonsterMatchRangerFavoredEnemy(hero, monster);
  const monsterFamily = monster ? (monster.monster_family || resolveMonsterFamily(monster, { strict: false }) || 'ANIMALS') : 'ANIMALS';
  const familyMeta = getFamilyMetadata(monsterFamily);
  const familyLabel = familyMeta ? familyMeta.label : monsterFamily;

  // Build qualitative English combat narrative line (strictly no raw numbers)
  const narrativeParts = [];
  const qualitativeBadges = [battleExp.tierLabel];
  if (favored) {
    narrativeParts.push('Years of hunting this sworn quarry give you a decisive instinct for its vital openings.');
    qualitativeBadges.push('Favored Enemy');
  } else if (kye.active) {
    narrativeParts.push('You recognize the combat stance and reach of this seasoned adversary.');
    qualitativeBadges.push('Know Your Enemy');
  } else if (nat.active) {
    narrativeParts.push('Your familiarity with wilderness creatures lets you read its natural movements.');
    qualitativeBadges.push('Natural Knowledge');
  } else if (sacred) {
    narrativeParts.push('Your sacred training reveals the unholy nature of this creature as your faith wards your soul.');
    qualitativeBadges.push('Sacred Knowledge');
  }

  if (battleExp.tier === 'EXPERIENCED') {
    narrativeParts.push('Hard-won experience against this species lets you anticipate its strikes and exploit its weaknesses.');
  } else if (battleExp.tier === 'RECOGNIZED') {
    narrativeParts.push('You remember how this creature fights from your past victory.');
  }

  return {
    monsterFamily,
    familyLabel,
    encounters: record.encounters,
    encountersSeen: record.encounters,
    victories: record.victories,
    tier: battleExp.tier,
    tierLabel: battleExp.tierLabel,
    battleExperience: {
      ...battleExp,
      encounteredCount: record.encounters,
      victoryCount: record.victories,
      masteryTier: battleExp.tier,
      masteryLabel: battleExp.tierLabel
    },
    learnedDamageBonus: battleExp.damageBonus,
    learnedAcBonus: battleExp.acBonus,
    knowYourEnemy: kye,
    naturalKnowledge: nat,
    sacredKnowledgeActive: sacred,
    favoredEnemyActive: favored,
    isFavoredEnemy: favored,
    favoredEnemyMatch: favored,
    hasClassExemption,
    classFamiliar: hasClassExemption,
    qualitativeBadges,
    loreNotes: narrativeParts,
    openingNarrative: narrativeParts.join(' ')
  };
}

/**
 * Returns all monster knowledge records for a character (for qualitative Compendium / Champion Sheet display).
 */
function getCharacterCompendiumKnowledge(db, character) {
  if (!character || !character.id || !hasKnowledgeTable(db)) return [];

  const rows = db.prepare(`
    SELECT cmk.monster_id, cmk.encounters, cmk.victories, cmk.first_seen_at, cmk.last_fought_at,
           m.name, m.monster_family, m.creature_type, m.creature_subtype
    FROM character_monster_knowledge cmk
    JOIN monsters m ON m.id = cmk.monster_id
    WHERE cmk.character_id = ?
    ORDER BY cmk.last_fought_at DESC, m.name ASC
  `).all(Number(character.id));

  return rows.map(r => {
    const tier = r.victories >= 3 ? 'EXPERIENCED' : (r.victories >= 1 ? 'RECOGNIZED' : 'UNFAMILIAR');
    const tierLabel = r.victories >= 3 ? 'Experienced' : (r.victories >= 1 ? 'Recognized' : 'Unfamiliar');
    const fam = r.monster_family || resolveMonsterFamily(r, { strict: false }) || 'ANIMALS';
    const famMeta = getFamilyMetadata(fam);
    const isFavored = doesMonsterMatchRangerFavoredEnemy(character, r);
    const hasClassKnow = hasClassGeneralKnowledge(character, r);
    return {
      monsterId: r.monster_id,
      monsterName: r.name,
      monsterFamily: fam,
      familyLabel: famMeta ? famMeta.label : fam,
      encounters: r.encounters,
      encounteredCount: r.encounters,
      victories: r.victories,
      victoryCount: r.victories,
      tier,
      tierLabel,
      masteryTier: tier,
      masteryLabel: tierLabel,
      hasClassKnowledge: hasClassKnow,
      isFavoredEnemy: isFavored,
      favoredEnemyMatch: isFavored
    };
  });
}

module.exports = {
  FIGHTER_MARTIAL_FAMILIES,
  RANGER_NATURAL_FAMILIES,
  doesMonsterMatchKnowYourEnemy,
  doesMonsterMatchNaturalKnowledge,
  doesMonsterMatchSacredKnowledge,
  doesMonsterMatchRangerFavoredEnemy,
  hasClassGeneralKnowledge,
  getFighterKnowYourEnemyBonus,
  getRangerNaturalKnowledgeBonus,
  getClericSacredKnowledgeBonus,
  getClericHolyRadianceBonus: getClericSacredKnowledgeBonus,
  getClericTurnUndeadProfile,
  computeBattleExperienceModifiers,
  getCharacterMonsterKnowledge,
  recordMonsterEncountered,
  recordMonsterVictory,
  evaluateHeroMonsterKnowledge,
  getCharacterCompendiumKnowledge
};
