const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getLivingCharacterByUserId,
  getModifier,
  formatModifier,
  getCharacterEquipment,
  getCharacterInventory,
  getCharacterPotionCount,
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  getActiveWeapon,
  performClericSelfHeal,
  performCityRest,
  getClericSelfHealInfo,
  getClericRemainingHealUses
} = require('../domain/character/rules');
const {
  calculateHeroAC,
  calculateHeroAttackBonus
} = require('../domain/combat/rules');
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
  investigateEncounter,
  concludeEncounter
} = require('../domain/encounters/engine');
const {
  getCombatState,
  executeCombatRound
} = require('../domain/combat/engine');
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

  const currentTile = getTileById(req.db, character.tile_id);
  if (!currentTile) {
    return res.status(500).send('Error: Current tile not found in the world.');
  }

  // Active encounter check (persisted across reloads)
  const activeEncounter = getActiveEncounterForCharacter(req.db, character.id, character.class);

  // Active combat state (events, brackets, condition text)
  let combatState = null;
  if (activeEncounter && activeEncounter.status === 'IN_COMBAT') {
    combatState = getCombatState(req.db, character.id, activeEncounter.id);
  }

  // Equipment & Inventory
  const equipment = getCharacterEquipment(req.db, character.id);
  const inventory = getCharacterInventory(req.db, character.id);
  const potionCount = getCharacterPotionCount(req.db, character.id);

  // Computed Combat stats
  const { activeWeapon, isRangedActive } = getActiveWeapon(character, equipment, activeEncounter);
  const meleeAttackBonus = calculateHeroAttackBonus(character, equipment.meleeWeapon, activeEncounter);
  const rangedAttackBonus = calculateHeroAttackBonus(character, equipment.rangedWeapon, activeEncounter);
  const heroAC = calculateHeroAC(character, equipment.armor, equipment.shield, isRangedActive, activeEncounter);

  // Cleric healing info
  let clericHealInfo = null;
  if ((character.class || '').toUpperCase() === 'CLERIC') {
    clericHealInfo = {
      ...getClericSelfHealInfo(character.level),
      remainingUses: getClericRemainingHealUses(character)
    };
  }

  // Shop stock if in safe haven city
  const isSafeCity = (currentTile.terrain === 'CITY' && currentTile.is_safe === 1);
  const shopStock = isSafeCity ? getCityStoreStock(req.db) : null;

  // 5x5 minimap around current tile
  const minimap = getMinimapData(req.db, currentTile, 2);

  // Available travel directions
  const directions = getAvailableDirections(req.db, currentTile);

  // Computed stat modifiers
  const modifiers = {
    strength: formatModifier(character.strength),
    constitution: formatModifier(character.constitution),
    dexterity: formatModifier(character.dexterity),
    intelligence: formatModifier(character.intelligence),
    wisdom: formatModifier(character.wisdom),
    charisma: formatModifier(character.charisma)
  };

  const errorMessage = req.query.error || null;
  const infoMessage = req.query.info || null;

  res.render('game', {
    character,
    currentTile,
    minimap,
    directions,
    encounter: activeEncounter,
    combatState,
    equipment,
    inventory,
    potionCount,
    activeWeapon,
    isRangedActive,
    meleeAttackBonus,
    rangedAttackBonus,
    heroAC,
    clericHealInfo,
    isSafeCity,
    shopStock,
    modifiers,
    errorMessage,
    infoMessage
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
    SELECT c.*, m.name as killer_name, mi.kill_count as killer_kills, t.name as tile_name
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

  res.render('fallen', { fallen });
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

  // Execute movement atomically and roll encounter
  withTransaction(req.db, (tx) => {
    tx.prepare('UPDATE characters SET tile_id = ? WHERE id = ?').run(targetTile.id, character.id);
    // Encounter check only happens on valid movement
    checkTileEncounter(tx, character, targetTile);
  });

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
    investigateEncounter(req.db, character.id, encounterId, character.class);
    res.redirect('/game');
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Conclude encounter standoff
 */
router.post('/game/encounter/conclude', (req, res) => {
  const character = getLivingCharacterByUserId(req.db, req.user.id);
  if (!character) {
    return res.redirect('/game');
  }

  const encounterId = parseInt(req.body.encounterId, 10);
  try {
    concludeEncounter(req.db, character.id, encounterId);
    res.redirect('/game?info=' + encodeURIComponent('You carefully withdrew from close quarters with the creature.'));
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

  try {
    const state = executeCombatRound(req.db, character.id, encounterId, 'DRINK_POTION', { expectedRound: round });
    if (state.character.is_alive === 0) {
      return res.redirect('/game/fallen');
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

  try {
    const state = executeCombatRound(req.db, character.id, encounterId, 'FLEE');
    if (state.character.is_alive === 0) {
      return res.redirect('/game/fallen');
    }
    if (state.encounter.status === 'ESCAPED') {
      return res.redirect('/game?info=' + encodeURIComponent('You broke away from the creature and escaped!'));
    }
    res.redirect('/game');
  } catch (err) {
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

  // Ensure not in combat
  const activeEncounter = getActiveEncounterForCharacter(req.db, character.id, character.class);
  if (activeEncounter && activeEncounter.status === 'IN_COMBAT') {
    return res.redirect('/game?error=' + encodeURIComponent('Cannot use meditative self-healing during active combat!'));
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

  try {
    equipItem(req.db, character.id, itemInstanceId, targetSlot);
    res.redirect('/game?info=' + encodeURIComponent('Equipment updated.'));
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
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

  try {
    unequipItem(req.db, character.id, itemInstanceId);
    res.redirect('/game?info=' + encodeURIComponent('Item unequipped to backpack.'));
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
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
  try {
    setPrimaryWeaponPreference(req.db, character.id, primaryWeapon);
    const prefLabel = (primaryWeapon || '').toUpperCase() === 'RANGED' ? 'Ranged' : 'Melee';
    res.redirect('/game?info=' + encodeURIComponent(`Primary weapon preference set to ${prefLabel}.`));
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
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

  try {
    const result = buyItem(req.db, character.id, { itemDefinitionId, listingId });
    res.redirect('/game?info=' + encodeURIComponent(`Purchased ${result.purchasedItem.name} for ${result.purchasedItem.price} gp. Remaining gold: ${result.remainingGold} gp.`));
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
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

  try {
    const result = sellItem(req.db, character.id, itemInstanceId);
    let msg = `Sold ${result.itemName} for ${result.goldEarned} gp.`;
    if (result.movedToMarket) {
      msg += ` The artifact is now listed in the global resale market for ${result.resalePrice} gp.`;
    }
    res.redirect('/game?info=' + encodeURIComponent(msg));
  } catch (err) {
    res.redirect(`/game?error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
