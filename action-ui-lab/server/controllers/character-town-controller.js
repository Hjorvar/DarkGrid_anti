/**
 * DARKGRID ADVENTURE LAB — Character Stance, Equipment, Town Services & Watcher's Board Controller
 */
const {
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  performClericSelfHeal,
  performCityRest,
  spendAttributePoint
} = require('../../../src/domain/character/rules');
const { getTileById } = require('../../../src/domain/world/map');
const { getActiveEncounterForCharacter } = require('../../../src/domain/encounters/engine');
const { buyItem, sellItem } = require('../../../src/domain/economy/shop');
const { acceptContract, abandonContract } = require('../../../src/domain/bounties/board');
const { buildClientState } = require('../services/client-state-service');
const {
  acceptGoblinChieftainQuest,
  claimGoblinChieftainReward
} = require('../services/topdown-world-service');

function assertCharacterOwnsItem(db, characterId, itemInstanceId) {
  const id = Number(itemInstanceId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Invalid item instance ID.');
    err.status = 400;
    throw err;
  }
  const row = db.prepare('SELECT id, owner_type, owner_character_id FROM item_instances WHERE id = ?').get(id);
  if (!row) {
    const err = new Error('Item not found.');
    err.status = 404;
    throw err;
  }
  if (row.owner_type !== 'CHARACTER' || Number(row.owner_character_id) !== Number(characterId)) {
    const err = new Error('Forbidden: Item does not belong to your active character.');
    err.status = 403;
    throw err;
  }
}

function handleCharacterTownAction({ db, userId, action, payload, character, labToolsAllowed = false, res }) {
  // 7. CHARACTER STANCE: MELEE / RANGED
  if (action === 'STANCE') {
    const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEnc) {
      throw new Error('Cannot switch weapon stance while engaged in an encounter.');
    }
    const requestedStance = payload.primaryWeapon || payload.stance;
    const stance = requestedStance
      ? String(requestedStance).toUpperCase()
      : (character.primary_weapon === 'RANGED' ? 'MELEE' : 'RANGED');
    setPrimaryWeaponPreference(db, character.id, stance);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Switched primary combat stance to ${stance === 'RANGED' ? 'Ranged' : 'Melee'}.`,
        fxCue: { type: 'STANCE', stance }
      })
    });
  }

  // 7b. MILESTONE ATTRIBUTE POINT SPEND (Levels 2, 4, 6, 8, 10)
  if (action === 'SPEND_ATTRIBUTE_POINT' || action === 'ALLOCATE_ATTRIBUTE') {
    const attr = payload.attribute || payload.stat || payload.attributeName;
    const result = spendAttributePoint(db, character.id, attr);
    const label = result.attribute.charAt(0).toUpperCase() + result.attribute.slice(1);
    return res.json({
      ok: true,
      result,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Permanently increased ${label} to ${result.newBaseScore}.${result.hpGained > 0 ? ` Vitality increased by +${result.hpGained} HP.` : ''}`
      })
    });
  }

  // 8. CITY SANCTUARY REST
  if (action === 'REST') {
    const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEnc) {
      throw new Error('Cannot rest while an encounter is active.');
    }
    const result = performCityRest(db, character.id);
    const clericNote = result.divineChargesRechargedTo !== null && result.divineChargesRechargedTo !== undefined
      ? ` Divine Charges (${result.divineChargesRechargedTo}) and Self-Healing prayers (${result.clericUsesRechargedTo}) fully recharged.`
      : '';
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Rested peacefully in Oakhaven Sanctuary. Vitality restored to ${result.maxHp} HP.${clericNote}`,
        fxCue: { type: 'HEAL', healed: result.maxHp }
      })
    });
  }

  // 9. CLERIC SELF-HEAL (Out of combat)
  if (action === 'CLERIC_HEAL') {
    const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEnc) {
      throw new Error('Cannot perform meditative self-healing during an active encounter.');
    }
    const result = performClericSelfHeal(db, character.id);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Divine prayer restored ${result.healed} HP (${result.remainingUses} uses left).`,
        fxCue: { type: 'HEAL', healed: result.healed }
      })
    });
  }

  // 10. INVENTORY: EQUIP / UNEQUIP
  if (action === 'EQUIP') {
    assertCharacterOwnsItem(db, character.id, payload.itemInstanceId);
    equipItem(db, character.id, Number(payload.itemInstanceId), payload.targetSlot || null);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, { labToolsAllowed, infoMessage: 'Equipped item.' })
    });
  }

  if (action === 'UNEQUIP') {
    assertCharacterOwnsItem(db, character.id, payload.itemInstanceId);
    unequipItem(db, character.id, Number(payload.itemInstanceId));
    return res.json({
      ok: true,
      state: buildClientState(db, userId, { labToolsAllowed, infoMessage: 'Unequipped item to backpack.' })
    });
  }

  // 10b. MARKET: BUY / SELL
  if (action === 'BUY') {
    const itemDefinitionId = payload.itemDefinitionId ? Number(payload.itemDefinitionId) : null;
    const listingId = payload.listingId ? Number(payload.listingId) : null;
    const result = buyItem(db, character.id, { itemDefinitionId, listingId });
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Purchased ${result.purchasedItem.name} for ${result.purchasedItem.price} gp. Remaining gold: ${result.remainingGold} gp.`
      })
    });
  }

  if (action === 'SELL') {
    assertCharacterOwnsItem(db, character.id, payload.itemInstanceId);
    const itemInstanceId = Number(payload.itemInstanceId);
    const result = sellItem(db, character.id, itemInstanceId);
    let msg = `Sold ${result.itemName} for ${result.goldEarned} gp.`;
    if (result.movedToMarket) {
      msg += ` The artifact is now listed in the global resale market for ${result.resalePrice} gp.`;
    }
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: msg
      })
    });
  }

  // 10c. THE WATCHER'S BOARD: ACCEPT / ABANDON BOUNTY CONTRACT
  if (action === 'ACCEPT_BOUNTY') {
    const currentTile = getTileById(db, character.tile_id);
    if (!currentTile || currentTile.terrain !== 'CITY' || currentTile.is_safe !== 1) {
      throw new Error("You must be in Oakhaven Sanctuary to accept a hunting contract from The Watcher's Board.");
    }
    const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEnc) {
      throw new Error('Cannot accept a hunting contract during an active encounter.');
    }
    const contractId = Number(payload.contractId);
    const result = acceptContract(db, character, contractId);
    if (!result.ok) {
      const err = new Error(result.error || 'Could not accept hunting contract.');
      if (/not found/i.test(err.message)) err.status = 403;
      throw err;
    }
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Accepted hunting contract: "${result.contract.contract_title}". Venture into ${result.contract.target_region} to hunt down your quarry!`
      })
    });
  }

  if (action === 'ABANDON_BOUNTY') {
    const contractId = payload.contractId ? Number(payload.contractId) : null;
    const result = abandonContract(db, character, contractId);
    if (!result.ok) {
      const err = new Error(result.error || 'Could not abandon hunting contract.');
      if (/not found|no active/i.test(err.message)) err.status = 403;
      throw err;
    }
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: 'Hunting contract abandoned.'
      })
    });
  }

  // 10d. THE GOBLIN CHIEFTAIN QUEST: ACCEPT_QUEST & CLAIM_QUEST_REWARD
  if (action === 'ACCEPT_QUEST') {
    const currentTile = getTileById(db, character.tile_id);
    if (!currentTile || currentTile.terrain !== 'CITY' || currentTile.is_safe !== 1) {
      throw new Error('You must be in Oakhaven Sanctuary to accept The Goblin Chieftain quest.');
    }
    const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEnc) {
      throw new Error('Cannot accept a quest during an active encounter.');
    }
    const result = acceptGoblinChieftainQuest(db, character.id);
    return res.json({
      ok: true,
      quest: result.quest,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: result.message
      })
    });
  }

  if (action === 'CLAIM_QUEST_REWARD') {
    const currentTile = getTileById(db, character.tile_id);
    if (!currentTile || currentTile.terrain !== 'CITY' || currentTile.is_safe !== 1) {
      throw new Error('Return to Oakhaven Sanctuary to claim your quest reward from Captain Vane.');
    }
    const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEnc) {
      throw new Error('Cannot claim a quest reward during an active encounter.');
    }
    const result = claimGoblinChieftainReward(db, character.id);
    return res.json({
      ok: true,
      quest: result.quest,
      rewardGold: result.rewardGold,
      rewardXp: result.rewardXp,
      leveledUp: result.leveledUp,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: result.message,
        fxCue: { type: 'HEAL' }
      })
    });
  }

  return false;
}

module.exports = {
  handleCharacterTownAction
};
