/**
 * DARKGRID ADVENTURE LAB — Backpack, Oakhaven Market & Watcher's Board UI (ES Module)
 */
import { store } from '../state/store.js';
import { escapeHtml } from '../ui/utils.js';

export function renderBackpackModal(titleEl, bodyEl) {
  titleEl.textContent = `🎒 Equipment & Backpack (${store.currentState.inventory.length}/50)`;
  const locked = Boolean(store.currentState.encounter);
  bodyEl.innerHTML = store.currentState.inventory.map(item => `
    <div class="lab-item-row">
      <div>
        <div style="font-weight: 700; color: var(--text-heading);">
          ${item.equipped_slot ? `<span style="color:var(--accent-gold);">[${escapeHtml(item.equipped_slot)}]</span> ` : ''}
          ${escapeHtml(item.name)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.category)} ${item.description ? '• ' + escapeHtml(item.description) : ''}</div>
      </div>
      <div>
        ${item.equipped_slot ? `
          <button type="button" class="btn-action-stone" style="padding: 4px 10px; font-size: 0.75rem;" ${locked ? 'disabled' : ''} onclick="dispatchAction('UNEQUIP', { itemInstanceId: ${item.id} })">Unequip</button>
        ` : (item.category === 'POTION' ? `
          <button type="button" class="btn-action-gold" style="padding: 4px 10px; font-size: 0.75rem;" onclick="dispatchAction('POTION', { potionInstanceId: ${item.id} })">🧪 Drink</button>
        ` : `
          <button type="button" class="btn-action-stone" style="padding: 4px 10px; font-size: 0.75rem;" ${locked ? 'disabled' : ''} onclick="dispatchAction('EQUIP', { itemInstanceId: ${item.id} })">Equip</button>
        `)}
      </div>
    </div>
  `).join('');
}

export function renderMarketModal(titleEl, bodyEl, hero) {
  titleEl.textContent = `🛒 Oakhaven Market (Purse: ${hero.gold} gp)`;
  if (!store.currentState.isSafeCity || !store.currentState.shopStock) {
    bodyEl.innerHTML = `<div class="lab-item-row"><span>Return to Oakhaven Sanctuary to trade with merchants.</span><button class="btn-action-gold" onclick="triggerLabScenario('CITY')">Teleport to Oakhaven</button></div>`;
    return;
  }
  const items = store.currentState.shopStock.standardItems || [];
  bodyEl.innerHTML = items.slice(0, 20).map(item => `
    <div class="lab-item-row">
      <div>
        <div style="font-weight: 700; color: var(--text-heading);">${escapeHtml(item.name)}</div>
        <div style="font-size: 0.75rem; color: var(--accent-gold);">${item.buy_price} gp • ${escapeHtml(item.category)}</div>
      </div>
      <button type="button" class="btn-action-gold" style="padding: 4px 12px; font-size: 0.75rem;" ${hero.gold < item.buy_price ? 'disabled' : ''} onclick="dispatchAction('BUY', { itemDefinitionId: ${item.id} })">Buy</button>
    </div>
  `).join('');
}

export function renderBountiesModal(titleEl, bodyEl) {
  titleEl.textContent = `🎯 The Watcher's Board & Bounties`;
  if (!store.currentState.isSafeCity) {
    bodyEl.innerHTML = `<div class="lab-item-row"><span>Visit Oakhaven Sanctuary to inspect hunting contracts.</span><button class="btn-action-gold" onclick="triggerLabScenario('CITY')">Teleport to Oakhaven</button></div>`;
    return;
  }
  const contracts = store.currentState.bountyContracts || [];
  bodyEl.innerHTML = contracts.map(c => `
    <div class="lab-item-row">
      <div>
        <div style="font-weight: 700; color: var(--text-heading);">${escapeHtml(c.contract_title)} <span class="lab-badge">${escapeHtml(c.status)}</span></div>
        <div style="font-size: 0.76rem; color: var(--text-muted);">Region: <strong>${escapeHtml(c.target_region)}</strong> • Reward: <strong style="color:var(--accent-gold);">${c.reward_gold} gp</strong></div>
      </div>
      ${c.status === 'AVAILABLE' && !store.currentState.activeContract ? `
        <button type="button" class="btn-action-gold" style="padding: 4px 10px; font-size: 0.75rem;" onclick="dispatchAction('ACCEPT_BOUNTY', { contractId: ${c.id} })">Accept</button>
      ` : ''}
    </div>
  `).join('');
}
