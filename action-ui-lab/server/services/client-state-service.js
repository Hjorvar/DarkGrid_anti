/**
 * DARKGRID ADVENTURE LAB — Secrecy-Compliant Client State Builder
 */
const config = require('../../../src/config');
const {
  FAST_XP_TABLE,
  getLivingCharacterByUserId,
  getModifier,
  formatModifier,
  getXpForNextLevel,
  getCharacterEquipment,
  getCharacterInventory,
  getCharacterPotions,
  getActiveWeapon,
  getClericSelfHealInfo,
  getClericRemainingHealUses,
  getEffectiveStats,
  getHeroSavingThrows
} = require('../../../src/domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus
} = require('../../../src/domain/combat/rules');
const { getCityStoreStock } = require('../../../src/domain/economy/shop');
const {
  getTileById,
  getMinimapData,
  getAvailableDirections
} = require('../../../src/domain/world/map');
const { getActiveEncounterForCharacter } = require('../../../src/domain/encounters/engine');
const {
  getHealthBracket,
  getConditionTextForBracket,
  getCombatState
} = require('../../../src/domain/combat/engine');
const { getVictoryData } = require('../../../src/domain/combat/victory');
const { getTerrainArtworkForTile } = require('../../../src/domain/world/artwork');
const {
  getOrGenerateContracts,
  getActiveContractForCharacter,
  autoClaimCompletedBounties,
  getWildernessThreats
} = require('../../../src/domain/bounties/board');
const { normalizeSceneMode, getCandidateArtPreviewMode } = require('../../scene-catalog');
const { buildAdventureClientPayload } = require('../../adventure-engine');
const {
  computeAdaptiveMonsterVisualScale,
  resolveScenePerspectiveCalibration,
  computeEncounterDistanceTransition
} = require('../../monster-size-catalog');
const { FACING_VECTORS, normalizeFacing, bracketNumToKey } = require('./facing-service');
const { resolveMonsterIntegratedProfile } = require('./monster-profile-service');
const { buildViewportScene } = require('./viewport-scene-service');
const {
  FAVORED_ENEMY_OPTIONS,
  getPublicUserById,
  buildClassAbilitySummary
} = require('./legacy-compatibility-service');

function normalizeContractGrammar(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\b([Aa])n\s+([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ])/g, '$1 $2')
    .replace(/\b([Aa])\s+([aeiouAEIOU])/g, '$1n $2');
}

/**
 * Builds the complete, secrecy-compliant client state payload for the SPA Action Viewport.
 * Never leaks unrevealed monster identity during Stage 1 (DISCOVERED).
 */
function buildClientState(db, userId, extra = {}) {
  if (!userId) {
    return {
      mode: 'UNAUTHENTICATED',
      currentUser: null,
      character: null,
      labToolsAllowed: false,
      classBases: config.classBases,
      statRules: config.statRules,
      favoredEnemyOptions: FAVORED_ENEMY_OPTIONS,
      infoMessage: extra.infoMessage || null,
      errorMessage: extra.errorMessage || null
    };
  }

  const currentUser = getPublicUserById(db, userId);
  const labToolsAllowed = extra.labToolsAllowed !== undefined
    ? Boolean(extra.labToolsAllowed)
    : Boolean(currentUser && currentUser.isSandboxDefault);
  let character = getLivingCharacterByUserId(db, userId);

  // If no living hero exists, return either FALLEN memorial state or NO_CHARACTER creation state
  if (!character) {
    const fallen = db.prepare(`
      SELECT c.*,
             COALESCE(mi.custom_title, m.name) as killer_name,
             m.name as killer_base_name,
             mi.kill_count as killer_kills,
             t.name as tile_name
      FROM characters c
      LEFT JOIN monster_instances mi ON c.killed_by_monster_instance_id = mi.id
      LEFT JOIN monsters m ON mi.monster_id = m.id
      LEFT JOIN map_tiles t ON c.tile_id = t.id
      WHERE c.user_id = ? AND c.is_alive = 0
      ORDER BY c.id DESC LIMIT 1
    `).get(userId);

    if (!fallen) {
      return {
        mode: 'NO_CHARACTER',
        currentUser,
        character: null,
        labToolsAllowed,
        fallen: null,
        classBases: config.classBases,
        statRules: config.statRules,
        favoredEnemyOptions: FAVORED_ENEMY_OPTIONS,
        infoMessage: extra.infoMessage || null,
        errorMessage: extra.errorMessage || null
      };
    }

    let finalCombatEvents = [];
    const lastEnc = db.prepare('SELECT id FROM encounters WHERE character_id = ? ORDER BY id DESC LIMIT 1').get(fallen.id);
    if (lastEnc) {
      finalCombatEvents = db.prepare(`
        SELECT id, round_number, event_type, public_text, created_at
        FROM combat_events
        WHERE encounter_id = ? AND event_type != 'CONDITION'
        ORDER BY id ASC
      `).all(lastEnc.id);
    }

    return {
      mode: 'FALLEN',
      currentUser,
      character: null,
      labToolsAllowed,
      fallen,
      combatEvents: finalCombatEvents,
      classBases: config.classBases,
      statRules: config.statRules,
      favoredEnemyOptions: FAVORED_ENEMY_OPTIONS,
      combatSequence: extra.combatSequence || null,
      infoMessage: extra.infoMessage || null,
      errorMessage: extra.errorMessage || null
    };
  }

  const charRowRaw = db.prepare('SELECT facing, pending_victory_encounter_id, scene_mode FROM characters WHERE id = ?').get(character.id) || {};
  const facing = normalizeFacing(charRowRaw.facing || 'NORTH');
  const sceneMode = normalizeSceneMode(charRowRaw.scene_mode || 'C');
  let pendingVictoryEncounterId = charRowRaw.pending_victory_encounter_id || null;

  const currentTile = getTileById(db, character.tile_id);
  const isSafeCity = Boolean(currentTile && currentTile.terrain === 'CITY' && currentTile.is_safe === 1);

  let claimedBounties = [];
  if (isSafeCity) {
    claimedBounties = autoClaimCompletedBounties(db, character.id);
    if (claimedBounties.length > 0) {
      character = getLivingCharacterByUserId(db, userId) || character;
    }
  }

  const terrainArtwork = getTerrainArtworkForTile(db, currentTile);
  const activeEncounter = getActiveEncounterForCharacter(db, character.id, character.class);

  // Check if lab encounter has an explicit ambush override flag on row (for Level 1 lab testing)
  let rawEncounterRow = null;
  if (activeEncounter) {
    rawEncounterRow = db.prepare('SELECT is_ambush, spotted_by_hero, combat_state_json FROM encounters WHERE id = ?').get(activeEncounter.id);
  }
  let labForcedAmbush = false;
  if (rawEncounterRow && rawEncounterRow.combat_state_json) {
    try {
      const parsedState = JSON.parse(rawEncounterRow.combat_state_json);
      labForcedAmbush = Boolean(parsedState && parsedState.labForcedAmbush);
    } catch {
      labForcedAmbush = false;
    }
  }

  let combatState = null;
  if (activeEncounter && activeEncounter.status === 'IN_COMBAT') {
    combatState = getCombatState(db, character.id, activeEncounter.id);
  }

  // Resolve persisted victory banner if no active encounter is open
  let resolvedVictory = extra.victory || null;
  if (!resolvedVictory && !activeEncounter && pendingVictoryEncounterId) {
    const vData = getVictoryData(db, character.id, pendingVictoryEncounterId);
    if (vData && vData.encounter && vData.encounter.tile_id === currentTile.id) {
      resolvedVictory = vData;
    } else {
      db.prepare('UPDATE characters SET pending_victory_encounter_id = NULL WHERE id = ?').run(character.id);
      pendingVictoryEncounterId = null;
    }
  }

  const equipment = getCharacterEquipment(db, character.id);
  const effectiveHero = getEffectiveStats(character, equipment);
  const rawInventory = getCharacterInventory(db, character.id);
  const inventory = rawInventory.map(it => ({
    ...it,
    is_starter: Boolean(it.is_starter || (it.modifications && String(it.modifications).includes('"is_starter":true')))
  }));
  const potions = getCharacterPotions(db, character.id);
  const combatPotions = getCharacterPotions(db, character.id, { combatOnly: true });
  const savingThrows = getHeroSavingThrows(effectiveHero, equipment);
  const xpForNextLevel = getXpForNextLevel(effectiveHero.level);
  const xpCurrentLevelFloor = FAST_XP_TABLE[effectiveHero.level] || 0;

  // STRICT ENCOUNTER SECRECY: Only pass revealedMonster if status === 'IN_COMBAT'
  const isRevealed = Boolean(activeEncounter && activeEncounter.status === 'IN_COMBAT');
  const revealedMonster = isRevealed ? activeEncounter : null;

  const { activeWeapon, isRangedActive } = combatState
    ? combatState
    : getActiveWeapon(effectiveHero, equipment, revealedMonster);

  const meleeAttackBonus = calculateHeroAttackBonus(effectiveHero, equipment.meleeWeapon, revealedMonster, equipment);
  const rangedAttackBonus = calculateHeroAttackBonus(effectiveHero, equipment.rangedWeapon, revealedMonster, equipment);
  const heroAC = combatState
    ? combatState.heroAC
    : calculateHeroAC(effectiveHero, equipment, isRangedActive, revealedMonster, activeWeapon);

  let clericHealInfo = null;
  if ((effectiveHero.class || '').toUpperCase() === 'CLERIC') {
    clericHealInfo = {
      ...getClericSelfHealInfo(effectiveHero.level),
      remainingUses: getClericRemainingHealUses(effectiveHero)
    };
  }

  const classAbilities = buildClassAbilitySummary(effectiveHero, clericHealInfo);
  const shopStock = isSafeCity ? getCityStoreStock(db, effectiveHero) : null;
  const bountyContracts = isSafeCity
    ? getOrGenerateContracts(db, effectiveHero).map(c => {
        const cleanDesc = normalizeContractGrammar(c.contract_description || c.description || '');
        return {
          ...c,
          title: c.title || c.contract_title || 'Hunting Warrant',
          contract_title: c.contract_title || c.title || 'Hunting Warrant',
          description: cleanDesc,
          contract_description: cleanDesc,
          region_name: c.region_name || c.target_region || 'The Wilds',
          target_region: c.target_region || c.region_name || 'The Wilds'
        };
      })
    : [];
  const wildernessThreats = isSafeCity
    ? getWildernessThreats(db).map(t => {
        const dir = t.direction || t.compassDirection || t.compass_direction || 'Wilderness';
        const kc = Number(t.killCount || t.kill_count || 1);
        return {
          ...t,
          direction: dir,
          compassDirection: dir,
          compass_direction: dir,
          killCount: kc,
          kill_count: kc
        };
      })
    : [];
  const activeContract = getActiveContractForCharacter(db, character.id);
  const minimap = getMinimapData(db, currentTile, 2);
  const directions = getAvailableDirections(db, currentTile);

  const modifiers = {
    strength: formatModifier(effectiveHero.strength),
    constitution: formatModifier(effectiveHero.constitution),
    dexterity: formatModifier(effectiveHero.dexterity),
    intelligence: formatModifier(effectiveHero.intelligence),
    wisdom: formatModifier(effectiveHero.wisdom),
    charisma: formatModifier(effectiveHero.charisma)
  };

  // Sanitize encounter payload so Stage 1 (DISCOVERED) NEVER leaks monster identity
  let safeEncounter = null;
  if (activeEncounter) {
    if (activeEncounter.status === 'DISCOVERED') {
      const effectiveAmbush = Boolean(
        activeEncounter.isAmbush ||
        Number(activeEncounter.is_ambush) === 1 ||
        labForcedAmbush
      );
      safeEncounter = {
        id: activeEncounter.id,
        status: 'DISCOVERED',
        combat_round: 0,
        isAmbush: effectiveAmbush,
        isRangerSpecial: Boolean(activeEncounter.isRangerSpecial),
        resolvedDescription: activeEncounter.resolvedDescription
      };
    } else if (activeEncounter.status === 'IN_COMBAT') {
      const cleanMonsterName = (activeEncounter.monster_name || '').replace(/\[.*?\]/g, '').trim();
      const cleanBaseMonsterName = (activeEncounter.base_monster_name || activeEncounter.monster_name || '').replace(/\[.*?\]/g, '').trim();
      const cleanSlug = activeEncounter.imageSlug || cleanBaseMonsterName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const imageUrl = activeEncounter.imageUrl || (`/images/monsters/${cleanSlug}.png`);
      const isAirborne = Boolean(
        activeEncounter.movement_type === 'FLY' ||
        activeEncounter.movement_type === 'FLYING' ||
        activeEncounter.is_flying
      );
      const sceneCalibrationOpts = {
        sceneTerrain: currentTile ? currentTile.terrain : 'FOREST',
        tileX: currentTile ? currentTile.x : 7,
        tileY: currentTile ? currentTile.y : 5
      };
      const integratedProfile = resolveMonsterIntegratedProfile(
        cleanSlug,
        isAirborne,
        activeEncounter.monster_id || cleanSlug,
        sceneCalibrationOpts
      );
      const scenePerspective = resolveScenePerspectiveCalibration(sceneCalibrationOpts);
      const distanceTransition = computeEncounterDistanceTransition(
        integratedProfile.sizeMetadata || cleanSlug,
        {
          ...sceneCalibrationOpts,
          fromDistanceFt: 20,
          toDistanceFt: 12,
          presentationMode: integratedProfile.hasIntegratedCutout ? 'INTEGRATED' : 'CARD'
        }
      );

      const actionEvents = (combatState && Array.isArray(combatState.events))
        ? combatState.events.filter(ev => ev.event_type !== 'CONDITION')
        : [];
      const latestRoundNum = actionEvents.length > 0
        ? Math.max(...actionEvents.map(ev => Number(ev.round_number || 1)))
        : (activeEncounter.combat_round || 1);
      const currentRoundEvents = actionEvents.filter(ev => Number(ev.round_number || 1) === latestRoundNum);

      safeEncounter = {
        id: activeEncounter.id,
        status: 'IN_COMBAT',
        combat_round: activeEncounter.combat_round || 1,
        monsterId: activeEncounter.monster_id || null,
        monsterName: cleanMonsterName,
        baseMonsterName: cleanBaseMonsterName,
        monsterSlug: integratedProfile.slug || cleanSlug,
        monsterSymbol: activeEncounter.monster_symbol,
        monsterColor: activeEncounter.monster_color || '#c5a059',
        imageUrl,
        cutoutImageUrl: integratedProfile.cutoutImageUrl,
        hasIntegratedCutout: integratedProfile.hasIntegratedCutout,
        integratedProfile,
        renderContract: integratedProfile.renderContract || null,
        scenePerspective,
        distanceTransition,
        pfSizeCategory: integratedProfile.pfSizeCategory || 'MEDIUM',
        pfSizeLabel: integratedProfile.pfSizeLabel || 'Medium',
        visualBodyProfile: integratedProfile.visualBodyProfile || 'BIPED_MEDIUM',
        visualBodyProfileLabel: integratedProfile.visualBodyProfileLabel || 'Medium Upright Biped',
        proposedScaleFactor: integratedProfile.proposedScaleFactor || 1.0,
        sizeMetadata: integratedProfile.sizeMetadata || null,
        adaptiveScale: integratedProfile.adaptiveScale || null,
        isBountyTarget: Boolean(activeEncounter.isBountyTarget),
        bountyTraitNotice: activeEncounter.bountyTraitNotice || null,
        customTitle: activeEncounter.custom_title || null,
        isRangerSpecial: Boolean(activeEncounter.isRangerSpecial),
        isAirborne,
        resolvedDescription: activeEncounter.resolvedDescription,
        conditionText: combatState ? combatState.currentConditionText : '',
        conditionBracket: combatState ? bracketNumToKey(combatState.currentBracket) : '5_uninjured',
        heroStatusBadges: (combatState && Array.isArray(combatState.heroStatusBadges)) ? combatState.heroStatusBadges : [],
        currentRoundEvents,
        allEvents: actionEvents
      };
    }
  }

  const effectiveUseCandidateArt = extra.useCandidateArt !== undefined ? Boolean(extra.useCandidateArt) : getCandidateArtPreviewMode(db);
  const viewportScene = buildViewportScene(db, currentTile, facing, directions, safeEncounter, sceneMode, { useCandidateArt: effectiveUseCandidateArt });

  // Compute genuine evidence from real persistent_monsters / monster_instances on current or adjacent tiles
  const persistentOnTile = currentTile
    ? db.prepare("SELECT id, kill_count, custom_title FROM monster_instances WHERE tile_id = ? AND status = 'ACTIVE'").get(currentTile.id)
    : null;
  const persistentAlert = persistentOnTile
    ? `Genuine Sign: Fresh bloodstains and scarred earth confirm a battle-hardened survivor (${persistentOnTile.kill_count || 1} fallen hero${Number(persistentOnTile.kill_count || 1) === 1 ? '' : 'es'} claimed) lurks at ${currentTile.name}.`
    : null;
  const adjacentPersistentCount = [
    viewportScene.ahead1,
    viewportScene.left1,
    viewportScene.right1,
    viewportScene.behind1
  ].filter(t => t && t.hasPersistentThreat).length;

  const adventure = buildAdventureClientPayload(
    character.id,
    currentTile,
    safeEncounter,
    persistentAlert,
    adjacentPersistentCount
  );

  const journalEncounters = db.prepare(`
    SELECT e.id, e.status, e.combat_round, e.created_at,
           COALESCE(hc.custom_name, mi.custom_title, m.name) as monster_name,
           m.name as base_monster_name,
           t.name as tile_name,
           (SELECT ce.public_text FROM combat_events ce WHERE ce.encounter_id = e.id AND ce.event_type = 'VICTORY' LIMIT 1) as victory_text
    FROM encounters e
    LEFT JOIN monsters m ON e.monster_id = m.id
    LEFT JOIN hunting_contracts hc ON e.bounty_contract_id = hc.id
    LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
    LEFT JOIN map_tiles t ON e.tile_id = t.id
    WHERE e.character_id = ? AND e.status IN ('VICTORY', 'ESCAPED', 'IN_COMBAT')
    ORDER BY e.id DESC
    LIMIT 10
  `).all(character.id);

  let infoMessage = extra.infoMessage || null;
  if (!infoMessage && claimedBounties.length > 0) {
    infoMessage = claimedBounties
      .map(b => `Bounty Completed! You have slain ${b.customName}. Oakhaven awards you ${b.rewardGold} Gold.`)
      .join(' ');
  }

  return {
    mode: safeEncounter ? safeEncounter.status : (isSafeCity ? 'CITY' : 'EXPLORATION'),
    artPreviewMode: effectiveUseCandidateArt ? 'CANDIDATES_STAGED' : 'APPROVED_DEFAULT',
    currentUser,
    labToolsAllowed,
    classBases: config.classBases,
    statRules: config.statRules,
    favoredEnemyOptions: FAVORED_ENEMY_OPTIONS,
    facing,
    facingMeta: FACING_VECTORS[facing],
    sceneMode,
    viewportScene,
    character: {
      id: effectiveHero.id,
      name: effectiveHero.name,
      class: effectiveHero.class,
      is_alive: 1,
      level: effectiveHero.level,
      xp: effectiveHero.xp,
      xpForNextLevel,
      xpCurrentLevelFloor,
      gold: effectiveHero.gold,
      current_hp: effectiveHero.current_hp,
      max_hp: effectiveHero.max_hp,
      strength: effectiveHero.strength,
      constitution: effectiveHero.constitution,
      dexterity: effectiveHero.dexterity,
      intelligence: effectiveHero.intelligence,
      wisdom: effectiveHero.wisdom,
      charisma: effectiveHero.charisma,
      is_str_boosted: Boolean(effectiveHero.is_str_boosted),
      primary_weapon: effectiveHero.primary_weapon || 'MELEE',
      favored_enemy_type: effectiveHero.favored_enemy_type,
      favored_enemy_subtype: effectiveHero.favored_enemy_subtype || null,
      facing,
      sceneMode
    },
    modifiers,
    savingThrows,
    classAbilities,
    combatStats: {
      heroAC,
      savingThrows,
      meleeAttackBonus: meleeAttackBonus >= 0 ? `+${meleeAttackBonus}` : `${meleeAttackBonus}`,
      rangedAttackBonus: rangedAttackBonus >= 0 ? `+${rangedAttackBonus}` : `${rangedAttackBonus}`,
      isRangedActive: Boolean(isRangedActive),
      activeWeapon: activeWeapon ? {
        name: activeWeapon.name,
        damage_dice: activeWeapon.damage_dice || '1d4',
        weapon_range_type: activeWeapon.weapon_range_type || 'MELEE',
        is_two_handed: Boolean(Number(activeWeapon.is_two_handed) === 1 || activeWeapon.is_two_handed === true)
      } : {
        name: 'Bare Hands',
        damage_dice: '1d3',
        weapon_range_type: 'MELEE',
        is_two_handed: false
      }
    },
    equipment: {
      meleeWeapon: equipment.meleeWeapon || null,
      rangedWeapon: equipment.rangedWeapon || null,
      armor: equipment.armor || null,
      shield: equipment.shield || null,
      ring: equipment.ring || null,
      cloak: equipment.cloak || null,
      neck: equipment.neck || null,
      belt: equipment.belt || null,
      feet: equipment.feet || null
    },
    inventory,
    potions,
    combatPotions,
    potionCount: potions.length,
    combatPotionCount: combatPotions.length,
    clericHealInfo,
    currentTile,
    isSafeCity,
    terrainArtwork,
    minimap,
    directions,
    encounter: safeEncounter,
    victory: resolvedVictory,
    combatSequence: extra.combatSequence || null,
    fxCue: extra.fxCue || null,
    shopStock,
    bountyContracts,
    wildernessThreats,
    activeContract: activeContract && (!safeEncounter || safeEncounter.status !== 'DISCOVERED')
      ? activeContract
      : (activeContract ? { ...activeContract, custom_name: 'Hunted Quarry', base_monster_name: 'Quarry' } : null),
    persistentAlert,
    adventure,
    journalEncounters,
    infoMessage,
    errorMessage: extra.errorMessage || null
  };
}

module.exports = {
  buildClientState
};
