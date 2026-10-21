/**
 * DARKGRID ADVENTURE LAB — Stance, Sanctuary Rest, Cleric Heal, Equipment, Market & Bounties Controller
 */
const {
  equipItem,
  unequipItem,
  setPrimaryWeaponPreference,
  performClericSelfHeal,
  performCityRest,
  useConsumable
} = require('../../../src/domain/character/rules');
const {
  buyItem,
  sellItem
} = require('../../../src/domain/economy/shop');
const { getTileById } = require('../../../src/domain/world/map');
const { getActiveEncounterForCharacter } = require('../../../src/domain/encounters/engine');
const {
  acceptContract,
  abandonContract
} = require('../../../src/domain/bounties/board');
const { buildClientState } = require('../services/client-state-service');

function handleCharacterTownAction({ db, userId, action, payload, character, res }) {
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
            infoMessage: `Divine radiance restores ${result.healed} HP (${result.currentHp}/${result.maxHp} HP).`,
            fxCue: { type: 'HEAL', healed: result.healed }
          })
        });
      }

      // 10. EQUIP / UNEQUIP / BUY / SELL / BOUNTIES
      if (action === 'EQUIP') {
        equipItem(db, character.id, Number(payload.itemInstanceId), payload.targetSlot || null);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, { infoMessage: 'Armament equipped.' })
        });
      }

      if (action === 'UNEQUIP') {
        unequipItem(db, character.id, Number(payload.itemInstanceId));
        return res.json({
          ok: true,
          state: buildClientState(db, userId, { infoMessage: 'Item stowed in backpack.' })
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
            infoMessage: `Purchased ${result.purchasedItem.name} for ${result.purchasedItem.price} gp.`
          })
        });
      }

      if (action === 'SELL') {
        const result = sellItem(db, character.id, Number(payload.itemInstanceId));
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Sold ${result.itemName} for ${result.goldEarned} gp.`
          })
        });
      }

      if (action === 'ACCEPT_BOUNTY') {
        const result = acceptContract(db, character, Number(payload.contractId));
        if (!result.ok) throw new Error(result.error);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: `Accepted Warrant: "${result.contract.contract_title}" in ${result.contract.target_region}.`
          })
        });
      }

      if (action === 'ABANDON_BOUNTY') {
        const result = abandonContract(db, character, Number(payload.contractId));
        if (!result.ok) throw new Error(result.error);
        return res.json({
          ok: true,
          state: buildClientState(db, userId, {
            infoMessage: 'Hunting contract abandoned.'
          })
        });
      }

  return false;
}

module.exports = {
  handleCharacterTownAction
};
