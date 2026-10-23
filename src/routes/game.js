const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getLivingCharacterByUserId,
  getModifier,
  formatModifier,
  getAttributeTierLabel,
  getCharacterEquipment,
  getCharacterInventory,
  getCharacterPotionCount,
  getCharacterPotions,
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  getActiveWeapon,
  performClericSelfHeal,
  performCityRest,
  getClericSelfHealInfo,
  getClericRemainingHealUses,
  useConsumable,
  getEffectiveStats,
  reconcileCharacterHpOnLoad,
  spendAttributePoint
} = require('../domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus
} = require('../domain/combat/rules');
const {
  evaluateHeroMonsterKnowledge,
  getCharacterCompendiumKnowledge
} = require('../domain/combat/knowledge');
const {
  getCityStoreStock,
  buyItem,
  sellItem
} = require('../domain/economy/shop');
const {
  getTileById,
  getMinimapData,
  getAvailableDirections,
  validateMovement
} = require('../domain/world/map');
const {
  checkTileEncounter,
  getActiveEncounterForCharacter,
  ignoreEncounter,
  investigateEncounter
} = require('../domain/encounters/engine');
const {
  getCombatState,
  executeCombatRound
} = require('../domain/combat/engine');
const { getVictoryData } = require('../domain/combat/victory');
const { getTerrainArtworkForTile } = require('../domain/world/artwork');
const {
  getOrGenerateContracts,
  getActiveContractForCharacter,
  acceptContract,
  abandonContract,
  autoClaimCompletedBounties,
  getWildernessThreats
} = require('../domain/bounties/board');
const { withTransaction } = require('../db/connection');

router.use(requireAuth);

/**
 * Root route: directs user to character creation, active game, or fallen memorial
 */
router.get('/', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    const fallen = req.db.prepare(`
      SELECT id FROM characters
      WHERE user_id = ? AND is_alive = 0
      ORDER BY id DESC LIMIT 1
    `).get(req.user.id);

    if (fallen) {
      return res.redirect('/game/fallen');
    }
    return res.redirect('/character/create');
  }
  res.redirect('/game');
});

/**
 * Main game screen
 */
router.get('/game', (req, res) => {
  let character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    const fallen = req.db.prepare(`
      SELECT id FROM characters
      WHERE user_id = ? AND is_alive = 0
      ORDER BY id DESC LIMIT 1
    `).get(req.user.id);

    if (fallen) {
      return res.redirect('/game/fallen');
    }
    return res.redirect('/character/create');
  }

  // Rule D: Reconcile Max HP on load without healing Current HP
  character = reconcileCharacterHpOnLoad(req.db, character.id) || character;

  const currentTile = getTileById(req.db, character.tile_id);
  if (!currentTile) {
    return res.status(500).send('Error: Current tile not found in the world.');
  }

  const isSafeCity = (currentTile.terrain === 'CITY' && currentTile.is_safe === 1);

  // Auto-claim any READY_TO_CLAIM hunting contracts upon being in Oakhaven
  let claimedBounties = [];
  if (isSafeCity) {
    claimedBounties = autoClaimCompletedBounties(req.db, character.id);
    if (claimedBounties.length > 0) {
      character = getLivingCharacterByUserId(req.db, req.user.id) || character;
    }
  }

  // Terrain artwork resolution (location override > terrain default > fallback)
  const terrainArtwork = getTerrainArtworkForTile(req.db, currentTile);

  // Active encounter check (persisted across reloads)
  const activeEncounter = getActiveEncounterForCharacter(req.db, character.id, character.class);

  // Active combat state (events, brackets, condition text)
  let combatState = null;
  if (activeEncounter && activeEncounter.status === 'IN_COMBAT') {
    combatState = getCombatState(req.db, character.id, activeEncounter.id);
  }

  // Equipment & Inventory
  const equipment = getCharacterEquipment(req.db, character.id);
  const effectiveHero = getEffectiveStats(character, equipment);
  const inventory = getCharacterInventory(req.db, character.id);
  const potions = getCharacterPotions(req.db, character.id);
  const potionCount = potions.length;

  // Computed Combat stats (M1) — strictly do not leak unrevealed monster traits while DISCOVERED
  const revealedMonster = (activeEncounter && activeEncounter.status === 'IN_COMBAT') ? activeEncounter : null;
  const { activeWeapon, isRangedActive } = combatState ? combatState : getActiveWeapon(effectiveHero, equipment, revealedMonster);
  const meleeAttackBonus = calculateHeroAttackBonus(effectiveHero, equipment.meleeWeapon, revealedMonster, equipment, req.db);
  const rangedAttackBonus = calculateHeroAttackBonus(effectiveHero, equipment.rangedWeapon, revealedMonster, equipment, req.db);
  const heroAC = combatState ? combatState.heroAC : calculateHeroAC(effectiveHero, equipment, isRangedActive, revealedMonster, activeWeapon, req.db);
  const monsterKnowledge = revealedMonster ? evaluateHeroMonsterKnowledge(req.db, effectiveHero, revealedMonster) : null;
  const compendiumKnowledge = getCharacterCompendiumKnowledge(req.db, effectiveHero);

  // Cleric healing info
  let clericHealInfo = null;
  if ((character.class || '').toUpperCase() === 'CLERIC') {
    clericHealInfo = {
      ...getClericSelfHealInfo(character.level),
      remainingUses: getClericRemainingHealUses(character)
    };
  }

  const secondWindUsed = Boolean(combatState && combatState.secondWindUsed);
  const secondWindStatus = String(effectiveHero.class || '').toUpperCase() === 'FIGHTER'
    ? (Number(effectiveHero.level || 1) >= 3 ? (secondWindUsed ? 'Spent' : 'Ready') : 'Unlocks at Level 3')
    : null;

  // Shop stock & Watcher's Board data if in safe haven city
  const shopStock = isSafeCity ? getCityStoreStock(req.db, effectiveHero) : null;
  const bountyContracts = isSafeCity ? getOrGenerateContracts(req.db, effectiveHero) : [];
  const wildernessThreats = isSafeCity ? getWildernessThreats(req.db) : [];
  const activeContract = getActiveContractForCharacter(req.db, character.id);

  // 5x5 minimap around current tile
  const minimap = getMinimapData(req.db, currentTile, 2);

  // Available travel directions
  const directions = getAvailableDirections(req.db, currentTile);

  // Computed stat modifiers & qualitative tier labels
  const modifiers = {
    strength: formatModifier(effectiveHero.strength),
    constitution: formatModifier(effectiveHero.constitution),
    dexterity: formatModifier(effectiveHero.dexterity),
    intelligence: formatModifier(effectiveHero.intelligence),
    wisdom: formatModifier(effectiveHero.wisdom),
    charisma: formatModifier(effectiveHero.charisma)
  };
  const attributeTierLabels = {
    strength: getAttributeTierLabel(effectiveHero.strength),
    constitution: getAttributeTierLabel(effectiveHero.constitution),
    dexterity: getAttributeTierLabel(effectiveHero.dexterity),
    intelligence: getAttributeTierLabel(effectiveHero.intelligence),
    wisdom: getAttributeTierLabel(effectiveHero.wisdom),
    charisma: getAttributeTierLabel(effectiveHero.charisma)
  };

  const errorMessage = req.query.error || null;
  let infoMessage = req.query.info || null;
  if (!infoMessage && claimedBounties.length > 0) {
    infoMessage = claimedBounties
      .map(b => `Bounty Completed! You have slain ${b.customName}. Oakhaven awards you ${b.rewardGold} Gold.`)
      .join(' ');
  }
  const activeModal = req.query.modal || null;

  // Journal entries: recent finished encounters (VICTORY or ESCAPED), plus active events
  const journalEncounters = req.db.prepare(`
    SELECT e.id, e.status, e.combat_round, e.created_at,
           COALESCE(hc.custom_name, mi.custom_title, m.name) as monster_name,
           m.name as base_monster_name,
           CASE WHEN e.bounty_contract_id IS NOT NULL THEN 1 ELSE 0 END as is_bounty_target,
           t.name as tile_name,
           (SELECT COUNT(*) FROM combat_events ce WHERE ce.encounter_id = e.id) as event_count,
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

  res.render('game', {
    character: effectiveHero,
    currentTile,
    terrainArtwork,
    minimap,
    directions,
    encounter: activeEncounter,
    combatState,
    monsterKnowledge,
    compendiumKnowledge,
    secondWindStatus,
    equipment,
    inventory,
    potions,
    potionCount,
    activeWeapon,
    isRangedActive,
    meleeAttackBonus,
    rangedAttackBonus,
    heroAC,
    clericHealInfo,
    isSafeCity,
    shopStock,
    bountyContracts,
    wildernessThreats,
    activeContract,
    claimedBounties,
    modifiers,
    attributeTierLabels,
    errorMessage,
    infoMessage,
    activeModal,
    journalEncounters
  });
});

/**
 * Fallen Memorial (Permadeath screen)
 */
router.get('/game/fallen', (req, res) => {
  const living = getLivingCharacterByUserId(req.db, req.user.id);
  if (living) {
    return res.redirect('/game');
  }

  const fallen = req.db.prepare(`
    SELECT c.*,
           COALESCE(mi.custom_title, m.name) as killer_name,
           m.name as killer_base_name,
           mi.custom_title as killer_custom_title,
           mi.kill_count as killer_kills,
           t.name as tile_name
    FROM characters c
    LEFT JOIN monster_instances mi ON c.killed_by_monster_instance_id = mi.id
    LEFT JOIN monsters m ON mi.monster_id = m.id
    LEFT JOIN map_tiles t ON c.tile_id = t.id
    WHERE c.user_id = ? AND c.is_alive = 0
    ORDER BY c.id DESC LIMIT 1
  `).get(req.user.id);

  if (!fallen) {
    return res.redirect('/character/create');
  }

  // Retrieve combat events from the final encounter in which the hero fell
  const lastEncounter = req.db.prepare(`
    SELECT id, combat_round
    FROM encounters
    WHERE character_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(fallen.id);

  const combatEvents = lastEncounter
    ? req.db.prepare(`
        SELECT id, round_number, event_type, public_text
        FROM combat_events
        WHERE encounter_id = ?
        ORDER BY id ASC
      `).all(lastEncounter.id)
    : [];

  res.render('fallen', { fallen, combatEvents });
});

/**
 * Victory Screen
 * Displays confirmed combat results, rewards, monster artwork, and avenger tribute.
 * Pure presentation layer; strictly read-only and idempotent.
 */
router.get('/game/victory', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    const fallen = req.db.prepare(`
      SELECT id FROM characters
      WHERE user_id = ? AND is_alive = 0
      ORDER BY id DESC LIMIT 1
    `).get(req.user.id);

    if (fallen) {
      return res.redirect('/game/fallen');
    }
    return res.redirect('/character/create');
  }

  let encounterId = req.query.encounterId ? parseInt(req.query.encounterId, 10) : null;
  if (!encounterId || isNaN(encounterId)) {
    const latestVictory = req.db.prepare(`
      SELECT id FROM encounters
      WHERE character_id = ? AND status = 'VICTORY'
      ORDER BY id DESC LIMIT 1
    `).get(character.id);

    if (!latestVictory) {
      return res.redirect('/game');
    }
    encounterId = latestVictory.id;
  }

  const victoryData = getVictoryData(req.db, character.id, encounterId);
  if (!victoryData) {
    return res.redirect('/game');
  }

  res.render('victory', { ...victoryData });
});

/**
 * Player movement route
 */
router.post('/game/move', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const { direction } = req.body;
  const validation = validateMovement(req.db, character, direction);

  if (!validation.allowed) {
    return res.redirect(`/game?error=${encodeURIComponent(validation.reason)}`);
  }

  const targetTile = validation.targetTile;
  let claimedBounties = [];

  // Execute movement atomically and roll encounter (or auto-claim bounties if arriving in Oakhaven)
  withTransaction(req.db, (tx) => {
    tx.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(targetTile.id, character.id);
    if (targetTile.terrain === 'CITY' && targetTile.is_safe === 1) {
      claimedBounties = autoClaimCompletedBounties(tx, character.id);
    } else {
      // Encounter check only happens on valid movement outside safe city
      checkTileEncounter(tx, character, targetTile);
    }
  });

  if (claimedBounties.length > 0) {
    const notice = claimedBounties
      .map(b => `Bounty Completed! You have slain ${b.customName}. Oakhaven awards you ${b.rewardGold} Gold.`)
      .join(' ');
    return res.redirect(`/game?info=${encodeURIComponent(notice)}`);
  }

  res.redirect('/game');
});

/**
 * Ignore encounter action
 */
router.post('/game/encounter/ignore', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const encounterId = parseInt(req.body.encounterId, 10);
  try {
    ignoreEncounter(req.db, character.id, encounterId);
    res.redirect('/game?info=' + encodeURIComponent('You slipped past the threat undetected, keeping your composure.'));
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Investigate encounter action (Enters combat)
 */
router.post('/game/encounter/investigate', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const encounterId = parseInt(req.body.encounterId, 10);
  try {
    const result = investigateEncounter(req.db, character.id, encounterId, character.class);
    if (result && (result.status === 'VICTORY' || result.monsterDied)) {
      return res.redirect(`/game/victory?encounterId=${encounterId}`);
    }
    res.redirect('/game');
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Combat Action: ATTACK
 */
router.post('/game/combat/attack', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const encounterId = parseInt(req.body.encounterId, 10);
  const round = req.body.round ? parseInt(req.body.round, 10) : undefined;

  try {
    const state = executeCombatRound(req.db, character.id, encounterId, 'ATTACK', { expectedRound: round });
    if (state.character.is_alive === 0) {
      return res.redirect('/game/fallen');
    }
    if (state.encounter.status === 'VICTORY') {
      return res.redirect(`/game/victory?encounterId=${encounterId}`);
    }
    res.redirect('/game');
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Combat Action: DRINK POTION
 */
router.post('/game/combat/potion', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const encounterId = parseInt(req.body.encounterId, 10);
  const round = req.body.round ? parseInt(req.body.round, 10) : undefined;
  const potionInstanceId = req.body.potionInstanceId ? parseInt(req.body.potionInstanceId, 10) : undefined;

  try {
    const state = executeCombatRound(req.db, character.id, encounterId, 'DRINK_POTION', {
      expectedRound: round,
      potionInstanceId
    });
    if (state.character.is_alive === 0) {
      return res.redirect('/game/fallen');
    }
    if (state.encounter.status === 'VICTORY') {
      return res.redirect(`/game/victory?encounterId=${encounterId}`);
    }
    res.redirect('/game');
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Combat Action: FLEE
 */
router.post('/game/combat/flee', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const encounterId = parseInt(req.body.encounterId, 10);
  const round = req.body.round ? parseInt(req.body.round, 10) : undefined;

  try {
    const state = executeCombatRound(req.db, character.id, encounterId, 'FLEE', { expectedRound: round });
    if (state.character.is_alive === 0) {
      return res.redirect('/game/fallen');
    }
    if (state.encounter.status === 'ESCAPED') {
      return res.redirect('/game?info=' + encodeURIComponent('You broke away from the creature and escaped!'));
    }
    res.redirect('/game');
  } catch (err) {
    // Graceful double-submit handling (L5)
    if (err.message && err.message.includes('ESCAPED')) {
      return res.redirect('/game?info=' + encodeURIComponent('You broke away from the creature and escaped!'));
    }
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Rest in Safe Haven (City)
 */
router.post('/game/rest', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  // Ensure not in combat or unresolved encounter
  const activeEncounter = getActiveEncounterForCharacter(req.db, character.id, character.class);
  if (activeEncounter && (activeEncounter.status === 'IN_COMBAT' || activeEncounter.status === 'DISCOVERED')) {
    return res.redirect('/game?error=' + encodeURIComponent('Cannot rest while engaged in active combat or an unresolved encounter!'));
  }

  try {
    const result = performCityRest(req.db, character.id);
    res.redirect('/game?info=' + encodeURIComponent(`You rested peacefully in the sanctuary. Vitality restored to full (${result.maxHp} HP) and abilities refreshed.`));
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Cleric Out-of-Combat Self-Healing
 */
router.post('/game/cleric/heal', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  // Ensure not in combat or unresolved encounter
  const activeEncounter = getActiveEncounterForCharacter(req.db, character.id, character.class);
  if (activeEncounter && (activeEncounter.status === 'IN_COMBAT' || activeEncounter.status === 'DISCOVERED')) {
    return res.redirect('/game?error=' + encodeURIComponent('Cannot use meditative self-healing during active combat or an unresolved encounter!'));
  }

  try {
    const result = performClericSelfHeal(req.db, character.id);
    res.redirect('/game?info=' + encodeURIComponent(`Divine power flows through you, restoring ${result.healed} HP (${result.currentHp}/${result.maxHp} HP). ${result.remainingUses} uses remain.`));
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Equip Item
 */
router.post('/game/inventory/equip', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const itemInstanceId = parseInt(req.body.itemInstanceId, 10);
  const targetSlot = req.body.targetSlot || null;
  const returnModal = req.body.returnModal || 'backpack';

  try {
    equipItem(req.db, character.id, itemInstanceId, targetSlot);
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent('Equipment updated.'));
  } catch (err) {
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Unequip Item
 */
router.post('/game/inventory/unequip', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const itemInstanceId = parseInt(req.body.itemInstanceId, 10);
  const returnModal = req.body.returnModal || 'backpack';

  try {
    unequipItem(req.db, character.id, itemInstanceId);
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent('Item unequipped to backpack.'));
  } catch (err) {
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Use / Consume Item (e.g. potion, elixir) outside of combat
 */
router.post('/game/inventory/use', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const itemInstanceId = parseInt(req.body.itemInstanceId, 10);
  const returnModal = req.body.returnModal || 'backpack';

  try {
    const result = useConsumable(req.db, character.id, itemInstanceId);
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent(result.message));
  } catch (err) {
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Switch Primary Weapon Preference (Melee vs Ranged)
 */
router.post('/game/character/primary-weapon', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const { primaryWeapon } = req.body;
  const returnModal = req.body.returnModal || 'character';
  try {
    setPrimaryWeaponPreference(req.db, character.id, primaryWeapon);
    const prefLabel = (primaryWeapon || '').toUpperCase() === 'RANGED' ? 'Ranged' : 'Melee';
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent(`Primary weapon preference set to ${prefLabel}.`));
  } catch (err) {
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Spend Milestone Attribute Point (Levels 2, 4, 6, 8, 10)
 */
router.post('/game/character/spend-attribute', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const attribute = req.body.attribute || req.body.stat || req.body.attributeName;
  const returnModal = req.body.returnModal || 'character';
  try {
    const result = spendAttributePoint(req.db, character.id, attribute);
    const label = result.attribute.charAt(0).toUpperCase() + result.attribute.slice(1);
    const msg = `Permanently increased ${label} to ${result.newBaseScore}.${result.hpGained > 0 ? ` Vitality increased by +${result.hpGained} HP.` : ''}`;
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&info=${encodeURIComponent(msg)}`);
  } catch (err) {
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Shop Buy Action
 */
router.post('/game/shop/buy', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const itemDefinitionId = req.body.itemDefinitionId ? parseInt(req.body.itemDefinitionId, 10) : null;
  const listingId = req.body.listingId ? parseInt(req.body.listingId, 10) : null;
  const returnModal = req.body.returnModal || 'market';

  try {
    const result = buyItem(req.db, character.id, { itemDefinitionId, listingId });
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent(`Purchased ${result.purchasedItem.name} for ${result.purchasedItem.price} gp. Remaining gold: ${result.remainingGold} gp.`));
  } catch (err) {
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Shop Sell Action
 */
router.post('/game/shop/sell', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const itemInstanceId = parseInt(req.body.itemInstanceId, 10);
  const returnModal = req.body.returnModal || 'market';

  try {
    const result = sellItem(req.db, character.id, itemInstanceId);
    let msg = `Sold ${result.itemName} for ${result.goldEarned} gp.`;
    if (result.movedToMarket) {
      msg += ` The artifact is now listed in the global resale market for ${result.resalePrice} gp.`;
    }
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&info=` + encodeURIComponent(msg));
  } catch (err) {
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * The Watcher's Board: Accept Hunting Contract
 */
router.post('/game/bounties/accept', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const currentTile = getTileById(req.db, character.tile_id);
  if (!currentTile || currentTile.terrain !== 'CITY' || currentTile.is_safe !== 1) {
    return res.redirect('/game?error=' + encodeURIComponent('You must be in Oakhaven to accept a hunting contract from The Watcher\'s Board.'));
  }

  const activeEncounter = getActiveEncounterForCharacter(req.db, character.id, character.class);
  if (activeEncounter) {
    return res.redirect('/game?error=' + encodeURIComponent('Cannot accept a hunting contract during an active encounter.'));
  }

  const contractId = parseInt(req.body.contractId, 10);
  const returnModal = req.body.returnModal || 'bounties';

  try {
    const result = acceptContract(req.db, character, contractId);
    if (!result.ok) {
      return res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(result.error)}`);
    }
    const msg = `Accepted hunting contract: "${result.contract.contract_title}". Venture into ${result.contract.target_region} to hunt down your quarry!`;
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&info=${encodeURIComponent(msg)}`);
  } catch (err) {
    res.redirect(`/game?modal=${encodeURIComponent(returnModal)}&error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * The Watcher's Board: Abandon Active Hunting Contract
 */
router.post('/game/bounties/abandon', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const contractId = req.body.contractId ? parseInt(req.body.contractId, 10) : null;
  const returnModal = req.body.returnModal || '';
  const modalParam = returnModal ? `modal=${encodeURIComponent(returnModal)}&` : '';

  try {
    const result = abandonContract(req.db, character, contractId);
    if (!result.ok) {
      return res.redirect(`/game?${modalParam}error=${encodeURIComponent(result.error)}`);
    }
    res.redirect(`/game?${modalParam}info=${encodeURIComponent('Hunting contract abandoned.')}`);
  } catch (err) {
    res.redirect(`/game?${modalParam}error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
