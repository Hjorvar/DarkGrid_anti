/**
 * DARKGRID ADVENTURE LAB — Backpack, Oakhaven Market (Standard + Global Resale + Sell) & Watcher's Board UI (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';
import { escapeHtml } from '../ui/utils.js';

function renderModalContent(modalName) {
  return uiCallbacks.renderModalContent(modalName);
}

function parseAllowedClassesLabel(rawAllowed) {
  if (!rawAllowed || rawAllowed === 'ALL') return 'All Classes';
  let list = [];
  if (Array.isArray(rawAllowed)) {
    list = rawAllowed;
  } else if (typeof rawAllowed === 'string') {
    const trimmed = rawAllowed.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) list = parsed;
      } catch (_e) {
        list = trimmed.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      list = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  const upper = list.map(c => String(c).toUpperCase());
  if (upper.length === 0 || (upper.includes('FIGHTER') && upper.includes('RANGER') && upper.includes('CLERIC'))) {
    return 'All Classes';
  }
  const titleCase = upper.map(c => c.charAt(0) + c.slice(1).toLowerCase());
  return titleCase.join(' / ');
}

function renderItemStatChipsHtml(item) {
  const chips = [];
  if (item.category) {
    chips.push(`<span class="item-stat-chip chip-cat">${escapeHtml(item.category)}</span>`);
  }
  if (item.damage_dice) {
    const rangeLbl = item.weapon_range_type ? ` • ${item.weapon_range_type}` : '';
    const twoHandLbl = Number(item.is_two_handed) === 1 ? ' • 2H' : '';
    chips.push(`<span class="item-stat-chip chip-stat">⚔️ ${escapeHtml(`${item.damage_dice}${rangeLbl}${twoHandLbl}`)}</span>`);
  }
  if (item.armor_bonus) {
    const dexCap = item.max_dex_bonus !== null && item.max_dex_bonus !== undefined
      ? ` (Max DEX +${item.max_dex_bonus})`
      : '';
    chips.push(`<span class="item-stat-chip chip-stat">🛡️ +${Number(item.armor_bonus)} Armor AC${escapeHtml(dexCap)}</span>`);
  }
  if (item.shield_bonus) {
    chips.push(`<span class="item-stat-chip chip-stat">🛡️ +${Number(item.shield_bonus)} Shield AC</span>`);
  }
  if (item.enhancement_bonus) {
    chips.push(`<span class="item-stat-chip chip-magic">✦ +${Number(item.enhancement_bonus)} Enhancement</span>`);
  }
  const classesLabel = parseAllowedClassesLabel(item.allowed_classes);
  if (classesLabel && classesLabel !== 'All Classes') {
    chips.push(`<span class="item-stat-chip chip-class">${escapeHtml(classesLabel)} Only</span>`);
  }
  return chips.join('');
}

function computeSellValue(item) {
  const basePrice = Number(item.base_buy_price ?? item.buy_price ?? 0);
  if (basePrice <= 0) return 1;
  const isMagical = Number(item.enhancement_bonus || 0) > 0 || (item.rarity && item.rarity !== 'COMMON');
  if (isMagical) {
    return Math.max(1, Math.floor(basePrice * 0.40));
  }
  if (item.sell_price !== undefined && item.sell_price !== null) {
    return Math.max(1, Number(item.sell_price));
  }
  return Math.max(1, Math.floor(basePrice * 0.50));
}

function computeResaleListingPrice(item) {
  const basePrice = Number(item.base_buy_price ?? item.buy_price ?? 0);
  return Math.max(1, Math.ceil(basePrice * 1.25));
}

export function setMarketTab(tabKey) {
  store.currentMarketTab = tabKey || 'BUY_STANDARD';
  if (store.currentOpenModal === 'market') {
    renderModalContent('market');
  }
}

export function setMarketCategoryFilter(catKey) {
  store.currentMarketFilter = catKey || 'ALL';
  if (store.currentOpenModal === 'market') {
    renderModalContent('market');
  }
}

export function renderBackpackModal(titleEl, bodyEl) {
  const st = store.currentState || {};
  const inv = st.inventory || [];
  const isSafeCity = Boolean(st.isSafeCity);
  const locked = Boolean(st.encounter);

  titleEl.textContent = `🎒 Equipment & Backpack (${inv.length}/50)`;

  if (inv.length === 0) {
    bodyEl.innerHTML = `<div class="lab-item-row"><span>Your backpack is empty.</span></div>`;
    return;
  }

  bodyEl.innerHTML = inv.map(item => {
    const isStarter = Boolean(item.is_starter);
    const isInactivePotion = Boolean(item.is_inactive);
    const sellGold = computeSellValue(item);
    const resaleGold = computeResaleListingPrice(item);
    const isMagical = Number(item.enhancement_bonus || 0) > 0 || (item.rarity && item.rarity !== 'COMMON');

    return `
      <div class="lab-item-row">
        <div class="item-row-main">
          <div class="item-title-line">
            ${item.equipped_slot ? `<span class="lab-badge" style="color:var(--accent-gold-bright); border-color:var(--accent-gold);">Equipped: ${escapeHtml(item.equipped_slot)}</span>` : ''}
            <span>${escapeHtml(item.name)}</span>
            ${isMagical ? `<span class="lab-badge" style="color:#c4b5fd; border-color:#8b5cf6;">✦ Magical</span>` : ''}
            ${isStarter ? `<span class="lab-badge" style="color:var(--text-muted);">Starter Gear</span>` : ''}
            ${isInactivePotion ? `<span class="lab-badge" style="color:#fca5a5;">Inactive</span>` : ''}
          </div>
          <div class="item-stat-chips">${renderItemStatChipsHtml(item)}</div>
          ${item.description ? `<div class="item-lore-line">${escapeHtml(item.description)}</div>` : ''}
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
          ${item.equipped_slot ? `
            <button type="button" class="btn-action-stone" style="padding: 5px 11px; font-size: 0.75rem;" ${locked ? 'disabled' : ''} onclick="dispatchAction('UNEQUIP', { itemInstanceId: ${item.id} })">Unequip</button>
          ` : (item.category === 'POTION' ? `
            <button type="button" class="btn-action-gold" style="padding: 5px 11px; font-size: 0.75rem;" ${isInactivePotion ? 'disabled title="Effect not active in this version"' : ''} onclick="dispatchAction('POTION', { potionInstanceId: ${item.id} })">🧪 Drink</button>
          ` : `
            <button type="button" class="btn-action-stone" style="padding: 5px 11px; font-size: 0.75rem;" ${locked ? 'disabled' : ''} onclick="dispatchAction('EQUIP', { itemInstanceId: ${item.id} })">Equip</button>
          `)}
          ${!item.equipped_slot && !isStarter && isSafeCity && !locked ? `
            <button type="button" class="btn-action-gold" style="padding: 5px 10px; font-size: 0.74rem;" title="${isMagical ? `Receive ${sellGold} gp (40%) and consign to Global Magical Resale Market at ${resaleGold} gp (125%)` : `Sell to merchant for ${sellGold} gp (50% value)`}" onclick="dispatchAction('SELL', { itemInstanceId: ${item.id} })">
              🪙 Sell (+${sellGold}g)
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

export function renderMarketModal(titleEl, bodyEl, hero) {
  const st = store.currentState || {};
  titleEl.textContent = `🛒 Oakhaven Market (Purse: ${hero.gold} gp)`;
  if (!st.isSafeCity || !st.shopStock) {
    bodyEl.innerHTML = `
      <div class="lab-item-row">
        <span>Return to Oakhaven Sanctuary to trade with the Quartermaster and inspect the Global Magical Resale Market.</span>
        ${st.labToolsAllowed ? `<button type="button" class="btn-action-gold" onclick="triggerLabScenario('CITY')">Teleport to Oakhaven</button>` : ''}
      </div>
    `;
    return;
  }

  const standardItems = st.shopStock.standardItems || [];
  const resaleListings = st.shopStock.resaleListings || [];
  const inv = (st.inventory || []).filter(i => !i.equipped_slot);
  const activeTab = store.currentMarketTab || 'BUY_STANDARD';
  const activeFilter = store.currentMarketFilter || 'ALL';
  const chaMod = (st.modifiers && st.modifiers.charisma) || '+0';

  const tabHeaderHtml = `
    <div class="market-toolbar">
      <div class="market-tab-group">
        <button type="button" class="lab-btn ${activeTab === 'BUY_STANDARD' ? 'is-active-mode' : ''}" onclick="setMarketTab('BUY_STANDARD')">
          🏪 Standard Stock (${standardItems.length})
        </button>
        <button type="button" class="lab-btn ${activeTab === 'BUY_RESALE' ? 'is-active-mode' : ''}" onclick="setMarketTab('BUY_RESALE')">
          ✦ Magical Resale Market (${resaleListings.length})
        </button>
        <button type="button" class="lab-btn ${activeTab === 'SELL_PACK' ? 'is-active-mode' : ''}" onclick="setMarketTab('SELL_PACK')">
          🪙 Sell Backpack Gear (${inv.length})
        </button>
      </div>
      <span style="font-size:0.75rem; color:var(--text-muted);">
        Purse: <strong style="color:var(--accent-gold-bright); font-family:var(--font-mono);">${hero.gold} gp</strong> • CHA Mod: <strong style="font-family:var(--font-mono);">${escapeHtml(chaMod)}</strong>
      </span>
    </div>
  `;

  if (activeTab === 'BUY_RESALE') {
    const resaleRows = resaleListings.length > 0
      ? resaleListings.map(listing => {
          const price = Number(listing.resale_price ?? listing.buy_price ?? 0);
          return `
          <div class="lab-item-row">
            <div class="item-row-main">
              <div class="item-title-line" style="color:#c4b5fd;">
                <span>✦ ${escapeHtml(listing.name)}</span>
                <span class="lab-badge" style="color:#fde68a; border-color:#c5a059;">Resale Relic</span>
                <span class="item-price-tag">${price} gp</span>
              </div>
              <div class="item-stat-chips">${renderItemStatChipsHtml(listing)}</div>
              ${listing.description ? `<div class="item-lore-line">${escapeHtml(listing.description)}</div>` : ''}
            </div>
            <button type="button" class="btn-action-gold" style="padding:5px 14px; font-size:0.76rem; flex-shrink:0;"
                    ${hero.gold < price ? 'disabled' : ''}
                    onclick="dispatchAction('BUY', { listingId: ${listing.listing_id} })">
              Buy (${price}g)
            </button>
          </div>
        `;
        }).join('')
      : `<div class="lab-item-row"><span>No magical relics are currently consigned to the Shared Global Resale Market. Sell a magical item (+1 or Rare) to list it here for all heroes!</span></div>`;

    bodyEl.innerHTML = `${tabHeaderHtml}${resaleRows}`;
    return;
  }

  if (activeTab === 'SELL_PACK') {
    const sellRows = inv.length > 0
      ? inv.map(item => {
          const isStarter = Boolean(item.is_starter);
          const sellGold = computeSellValue(item);
          const resaleGold = computeResaleListingPrice(item);
          const isMagical = Number(item.enhancement_bonus || 0) > 0 || (item.rarity && item.rarity !== 'COMMON');
          return `
            <div class="lab-item-row">
              <div class="item-row-main">
                <div class="item-title-line">
                  <span>${escapeHtml(item.name)}</span>
                  ${!isStarter ? `<span class="item-price-tag">+${sellGold} gp</span>` : ''}
                  ${isMagical ? `<span class="lab-badge" style="color:#c4b5fd; border-color:#8b5cf6;">✦ Consigns to Global Resale (${resaleGold}g / 125%)</span>` : ''}
                  ${isStarter ? `<span class="lab-badge" style="color:var(--text-muted);">Starter Gear (Unsellable)</span>` : ''}
                </div>
                <div class="item-stat-chips">${renderItemStatChipsHtml(item)}</div>
                ${item.description ? `<div class="item-lore-line">${escapeHtml(item.description)}</div>` : ''}
              </div>
              <button type="button" class="btn-action-gold" style="padding:5px 13px; font-size:0.76rem; flex-shrink:0;"
                      ${isStarter ? 'disabled' : ''}
                      onclick="dispatchAction('SELL', { itemInstanceId: ${item.id} })">
                ${isStarter ? 'Starter' : `🪙 Sell (+${sellGold} gp)`}
              </button>
            </div>
          `;
        }).join('')
      : `<div class="lab-item-row"><span>No unequipped items in your backpack to sell. Unequip gear in your Pack [B] first.</span></div>`;

    bodyEl.innerHTML = `${tabHeaderHtml}${sellRows}`;
    return;
  }

  const filterBarHtml = `
    <div class="market-filter-group" style="margin-bottom:8px;">
      ${['ALL', 'WEAPON', 'ARMOR', 'SHIELD', 'ACCESSORY', 'POTION'].map(cat => `
        <button type="button" class="lab-btn ${activeFilter === cat ? 'is-active-mode' : ''}"
                style="padding:3px 10px; font-size:0.71rem;"
                onclick="setMarketCategoryFilter('${cat}')">
          ${cat}
        </button>
      `).join('')}
    </div>
  `;

  const filteredItems = standardItems.filter(item => {
    if (activeFilter === 'ALL') return true;
    const cat = String(item.category || '').toUpperCase();
    if (activeFilter === 'ACCESSORY') {
      return ['RING', 'CLOAK', 'NECK', 'BELT', 'FEET', 'ACCESSORY'].includes(cat);
    }
    return cat === activeFilter;
  });

  const rowsHtml = filteredItems.map(item => `
    <div class="lab-item-row">
      <div class="item-row-main">
        <div class="item-title-line">
          <span>${escapeHtml(item.name)}</span>
          <span class="item-price-tag">${item.buy_price} gp</span>
          ${item.base_buy_price && item.base_buy_price !== item.buy_price ? `<span style="font-size:0.68rem; color:var(--text-muted); text-decoration:line-through;">${item.base_buy_price}g</span>` : ''}
        </div>
        <div class="item-stat-chips">${renderItemStatChipsHtml(item)}</div>
        ${item.description ? `<div class="item-lore-line">${escapeHtml(item.description)}</div>` : ''}
      </div>
      <button type="button" class="btn-action-gold" style="padding: 5px 14px; font-size: 0.76rem; flex-shrink:0;" ${hero.gold < item.buy_price ? 'disabled' : ''} onclick="dispatchAction('BUY', { itemDefinitionId: ${item.id} })">
        Buy (${item.buy_price}g)
      </button>
    </div>
  `).join('');

  bodyEl.innerHTML = `${tabHeaderHtml}${filterBarHtml}${rowsHtml}`;
}

export function renderBountiesSectionHtml() {
  const st = store.currentState || {};
  const isSafeCity = Boolean(st.isSafeCity);
  const contracts = st.bountyContracts || [];
  const activeContract = st.activeContract || null;
  const threats = st.wildernessThreats || [];

  const cityNoticeHtml = !isSafeCity ? `
    <div class="lab-item-row" style="margin-bottom:10px; border-color:rgba(197, 160, 89, 0.35);">
      <span style="font-size:0.78rem; color:var(--text-muted);">
        You are currently in the wilderness. Return to <strong>Oakhaven Sanctuary</strong> to accept a new hunting warrant from The Watcher’s Board.
      </span>
    </div>
  ` : '';

  const activeBannerHtml = activeContract ? `
    <div class="qa-card" style="border-color:var(--accent-gold); margin-bottom:10px;">
      <div class="qa-card-title">
        <span>📜 Active Hunting Warrant: ${escapeHtml(activeContract.contract_title || activeContract.title || 'Bounty Warrant')}</span>
        <span class="lab-badge" style="color:#fde68a;">${escapeHtml(activeContract.status || 'ACTIVE')}</span>
      </div>
      <div class="warrant-meta-row" style="margin-top:4px;">
        <span>🗺️ Region: <strong>${escapeHtml(activeContract.target_region || activeContract.region_name || 'Blackwood Forest')}</strong></span>
        ${activeContract.custom_name ? `<span>👹 Quarry: <strong>${escapeHtml(activeContract.custom_name)}</strong> (${escapeHtml(activeContract.base_monster_name || 'Monster')})</span>` : ''}
        <span>🪙 Reward: <strong style="color:var(--accent-gold-bright); font-family:var(--font-mono);">${activeContract.reward_gold} gp</strong></span>
      </div>
      <div style="margin-top:6px; display:flex; justify-content:flex-end;">
        <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;"
                onclick="dispatchAction('ABANDON_BOUNTY', { contractId: ${activeContract.id} })">
          ✕ Abandon Warrant
        </button>
      </div>
    </div>
  ` : '';

  const contractsHtml = contracts.map(c => {
    const title = c.contract_title || c.title || `${c.custom_name || 'Quarry'} — ${c.base_monster_name || 'Target'}`;
    const region = c.target_region || c.region_name || 'Blackwood Forest';
    const desc = c.contract_description || c.description || '';
    const isThisActive = c.status === 'ACTIVE' || c.status === 'ACCEPTED' || (activeContract && activeContract.id === c.id);
    return `
      <div class="warrant-card">
        <div class="warrant-header">
          <div class="warrant-title-group">
            <span class="warrant-title">📜 ${escapeHtml(title)}</span>
            <span class="lab-badge" style="color:${isThisActive ? '#fde68a' : '#86efac'};">${escapeHtml(c.status)}</span>
            ${c.threat_tier_label ? `<span class="lab-badge" style="color:#fca5a5;">${escapeHtml(c.threat_tier_label)}</span>` : ''}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="item-price-tag">🪙 ${c.reward_gold} gp</span>
            ${c.status === 'AVAILABLE' && !activeContract && isSafeCity ? `
              <button type="button" class="btn-action-gold" style="padding: 4px 12px; font-size: 0.75rem;" onclick="dispatchAction('ACCEPT_BOUNTY', { contractId: ${c.id} })">Accept Warrant</button>
            ` : ''}
            ${isThisActive ? `
              <button type="button" class="btn-action-stone" style="padding: 4px 11px; font-size: 0.74rem;" onclick="dispatchAction('ABANDON_BOUNTY', { contractId: ${c.id} })">Abandon</button>
            ` : ''}
          </div>
        </div>
        <div class="warrant-meta-row">
          <span>🗺️ Region: <strong>${escapeHtml(region)}</strong></span>
          ${c.custom_name ? `<span>👹 Quarry: <strong>${escapeHtml(c.custom_name)}</strong>${c.base_monster_name ? ` (${escapeHtml(c.base_monster_name)})` : ''}</span>` : ''}
          ${c.target_cr !== undefined ? `<span>⚔️ Threat CR: <strong>${escapeHtml(String(c.target_cr))}</strong></span>` : ''}
        </div>
        ${desc ? `<div class="warrant-desc">“${escapeHtml(desc)}”</div>` : ''}
      </div>
    `;
  }).join('');

  const threatsHtml = threats.length > 0
    ? threats.map(t => {
        const bearing = t.direction || t.compassDirection || t.compass_direction || 'Surrounding Wilds';
        const kills = Number(t.killCount || t.kill_count || 1);
        const sevLabel = t.severityLabel || (kills >= 2 ? `Slayer of ${kills} Heroes` : 'Hero-Slayer');
        const warnText = t.warningText || 'Species & exact coordinates remain shrouded in the mist.';
        return `
          <div class="threat-rumor-card">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div style="font-weight:700; color:#fca5a5; font-size:0.82rem;">
                🩸 Unidentified Survivor Reported — Bearing: <strong style="color:#fde68a;">${escapeHtml(bearing)}</strong>
              </div>
              <span class="lab-badge" style="color:#fca5a5; border-color:rgba(239,68,68,0.45);">${escapeHtml(sevLabel)}</span>
            </div>
            <div style="font-size:0.74rem; color:var(--text-body);">
              ${escapeHtml(warnText)}
            </div>
          </div>
        `;
      }).join('')
    : `<div class="lab-item-row"><span style="color:var(--text-muted);">No persistent hero-slayers currently reported in the surrounding wilds.</span></div>`;

  return `
    ${cityNoticeHtml}
    ${activeBannerHtml}
    <div style="font-family:var(--font-serif); font-size:0.82rem; color:var(--accent-gold); font-weight:700; margin-bottom:6px;">
      🎯 Daily Hunting Warrants — The Watcher’s Board (Optional Contracts)
    </div>
    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
      ${contractsHtml || '<div class="lab-item-row"><span>No hunting contracts available.</span></div>'}
    </div>
    <div style="font-family:var(--font-serif); font-size:0.82rem; color:var(--accent-gold); font-weight:700; margin-bottom:6px;">
      🧭 Wilderness Threat Intelligence (Secrecy-Preserving Compass Bearings)
    </div>
    <div style="display:flex; flex-direction:column; gap:7px;">
      ${threatsHtml}
    </div>
  `;
}

export function renderBountiesModal(titleEl, bodyEl) {
  titleEl.textContent = `🎯 The Watcher's Board & Wilderness Intelligence`;
  bodyEl.innerHTML = renderBountiesSectionHtml();
}
