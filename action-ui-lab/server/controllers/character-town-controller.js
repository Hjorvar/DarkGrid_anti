/**
 * DARKGRID ADVENTURE LAB — Stance, Sanctuary Rest, Cleric Heal, Equipment, Market & Bounties Controller
 */
const {
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  performClericSelfHeal,
  performCityRest
} = require('../../../src/domain/character/rules');
const {
  buyItem,
  sellItem
} = require('../../../src/domain/economy/shop');
const { getActiveEncounterForCharacter } = require('../../../src/domain/encounters/engine');
const {
  acceptContract,
  abandonContract
} = require('../../../src/domain/bounties/board');
const { buildClientState } = require('../services/client-state-service');

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

function handleCharacterTownAction({ db, userId, action, payload, character, labToolsAllowed, res }) {
  // 7. SWITCH STANCE (MELEE / RANGED)
  if (action === 'STANCE') {
    const activeEnc = getActiveEncounterForCharacter(db, character.id, character.class);
    if (activeEnc) {
      throw new Error('Cannot switch weapon stance while engaged in an encounter.');
    }
    const nextStance = payload.primaryWeapon || (character.primary_weapon === 'RANGED' ? 'MELEE' : 'RANGED');
    setPrimaryWeaponPreference(db, character.id, nextStance);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Combat stance switched to ${nextStance}.`,
        fxCue: { type: 'STANCE_SWAP', stance: nextStance }
      })
    });
  }

  // 8. SANCTUARY REST
  if (action === 'REST') {
    const result = performCityRest(db, character.id);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `You rested in Oakhaven Sanctuary. Vitality restored to ${result.maxHp} HP.`,
        fxCue: { type: 'HEAL' }
      })
    });
  }

  // 9. CLERIC HEAL
  if (action === 'CLERIC_HEAL') {
    const result = performClericSelfHeal(db, character.id);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Divine radiance restores ${result.healed} HP (${result.currentHp}/${result.maxHp} HP).`,
        fxCue: { type: 'HEAL', healed: result.healed }
      })
    });
  }

  // 10. EQUIP / UNEQUIP / BUY / SELL / BOUNTIES
  if (action === 'EQUIP') {
    assertCharacterOwnsItem(db, character.id, payload.itemInstanceId);
    equipItem(db, character.id, Number(payload.itemInstanceId), payload.targetSlot || null);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, { labToolsAllowed, infoMessage: 'Armament equipped.' })
    });
  }

  if (action === 'UNEQUIP') {
    assertCharacterOwnsItem(db, character.id, payload.itemInstanceId);
    unequipItem(db, character.id, Number(payload.itemInstanceId));
    return res.json({
      ok: true,
      state: buildClientState(db, userId, { labToolsAllowed, infoMessage: 'Item stowed in backpack.' })
    });
  }

  if (action === 'BUY') {
    const result = buyItem(db, character.id, {
      itemDefinitionId: payload.itemDefinitionId ? Number(payload.itemDefinitionId) : null,
      listingId: payload.listingId ? Number(payload.listingId) : null
    });
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Purchased ${result.purchasedItem.name} for ${result.purchasedItem.price} gp.`
      })
    });
  }

  if (action === 'SELL') {
    assertCharacterOwnsItem(db, character.id, payload.itemInstanceId);
    const result = sellItem(db, character.id, Number(payload.itemInstanceId));
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Sold ${result.itemName} for ${result.goldEarned} gp.`
      })
    });
  }

  if (action === 'ACCEPT_BOUNTY') {
    if (payload.contractId) {
      const contractRow = db.prepare('SELECT id, character_id FROM hunting_contracts WHERE id = ?').get(Number(payload.contractId));
      if (contractRow && Number(contractRow.character_id) !== Number(character.id)) {
        const err = new Error('Forbidden: Hunting contract belongs to another character.');
        err.status = 403;
        throw err;
      }
    }
    const result = acceptContract(db, character, Number(payload.contractId));
    if (!result.ok) throw new Error(result.error);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: `Accepted Warrant: "${result.contract.contract_title}" in ${result.contract.target_region}.`
      })
    });
  }

  if (action === 'ABANDON_BOUNTY') {
    if (payload.contractId) {
      const contractRow = db.prepare('SELECT id, character_id FROM hunting_contracts WHERE id = ?').get(Number(payload.contractId));
      if (contractRow && Number(contractRow.character_id) !== Number(character.id)) {
        const err = new Error('Forbidden: Hunting contract belongs to another character.');
        err.status = 403;
        throw err;
      }
    }
    const result = abandonContract(db, character, Number(payload.contractId));
    if (!result.ok) throw new Error(result.error);
    return res.json({
      ok: true,
      state: buildClientState(db, userId, {
        labToolsAllowed,
        infoMessage: 'Hunting contract abandoned.'
      })
    });
  }

  return false;
}

module.exports = {
  handleCharacterTownAction
};
