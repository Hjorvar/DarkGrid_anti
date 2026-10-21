/**
 * DARKGRID ADVENTURE LAB — Top Champion Deck, Vitals, Hand Slots & Character Sheet (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';
import { escapeHtml } from '../ui/utils.js';
import { dispatchAction } from '../api/client.js';
import { spawnFloatingPopup } from '../combat/fx.js';

function openLabModal(modalName) {
  return uiCallbacks.openLabModal(modalName);
}

export function updateHeroVitalsDisplay(currentHp, maxHp) {
  const hpPct = Math.min(100, Math.max(0, Math.round((currentHp / maxHp) * 100)));
  const hpHealthClass = hpPct <= 25 ? 'critical' : (hpPct <= 50 ? 'wounded' : 'healthy');

  const hpText = document.getElementById('hud-hp-text');
  if (hpText) hpText.textContent = `${currentHp} / ${maxHp}`;

  const hpStatePill = document.getElementById('hud-hp-state-pill');
  if (hpStatePill) {
    const stateWord = currentHp <= 0
      ? 'Fallen'
      : (hpPct <= 25 ? 'Critical' : (hpPct <= 50 ? 'Bloodied' : (hpPct < 100 ? 'Bruised' : 'Uninjured')));
    hpStatePill.textContent = stateWord;
    hpStatePill.className = `dm-hp-state-pill state-${hpHealthClass}`;
  }

  const hpBar = document.getElementById('hud-hp-bar');
  if (hpBar) {
    hpBar.style.width = `${hpPct}%`;
    hpBar.className = `dm-hp-bar-inner ${hpHealthClass}`;
  }

  const hpPillar = document.getElementById('pillar-hp');
  if (hpPillar) {
    hpPillar.style.height = `${hpPct}%`;
    hpPillar.className = `dm-pillar-fill hp-pillar ${hpHealthClass}`;
  }
}

export function renderTopBarAndDeckSnapshot(state, { sequenceLock = false } = {}) {
  const hero = state.character;
  if (!hero) return;
  const cStats = state.combatStats;
  const eq = state.equipment;
  const enc = state.encounter;
  const victory = state.victory;

  ['FIGHTER', 'RANGER', 'CLERIC'].forEach(cls => {
    const btn = document.getElementById('class-btn-' + cls);
    if (btn) btn.classList.toggle('is-active', hero.class === cls);
  });

  const classIcons = { FIGHTER: '⚔️', RANGER: '🏹', CLERIC: '✨' };
  document.getElementById('hud-class-crest').textContent = classIcons[hero.class] || '⚔️';
  document.getElementById('hud-hero-name').textContent = hero.name;
  document.getElementById('hud-hero-class-lvl').textContent = `${hero.class} • LVL ${hero.level}`;

  // Status badges
  const statusContainer = document.getElementById('hud-status-pills');
  if (enc && Array.isArray(enc.heroStatusBadges) && enc.heroStatusBadges.length > 0) {
    statusContainer.innerHTML = enc.heroStatusBadges.map(b =>
      `<span style="background: rgba(220,38,38,0.28); border: 1px solid #ef4444; color: #fca5a5; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem;">⚠️ ${escapeHtml(b.label)}</span>`
    ).join(' ');
  } else {
    statusContainer.innerHTML = '';
  }

  // Hands & Stance Slots (Connected only to implemented actions)
  const isRanged = cStats.isRangedActive;
  const mainSlot = document.getElementById('slot-main-hand');
  const offSlot = document.getElementById('slot-off-hand');
  const mainStateTag = document.getElementById('main-hand-state-tag');
  const offStateTag = document.getElementById('off-hand-state-tag');
  if (mainSlot) mainSlot.classList.add('is-active-hand');
  if (mainStateTag) mainStateTag.textContent = 'ACTIVE';

  if (isRanged) {
    const rWep = eq.rangedWeapon || cStats.activeWeapon;
    document.getElementById('main-hand-icon').textContent = '🏹';
    document.getElementById('main-hand-label').textContent = 'Both Hands (Ranged Active)';
    document.getElementById('main-hand-name').textContent = rWep ? rWep.name : 'Unarmed';
    document.getElementById('main-hand-stats').textContent = `Atk ${cStats.rangedAttackBonus} • ${rWep ? rWep.damage_dice : '1d4'}`;
    mainSlot.title = (enc && enc.status === 'IN_COMBAT')
      ? `Click to fire ${rWep ? rWep.name : 'Ranged Weapon'} [Space / 1]`
      : 'Click to inspect weapons in Backpack [B]';

    const mWep = eq.meleeWeapon;
    document.getElementById('off-hand-icon').textContent = '🗡️';
    document.getElementById('off-hand-label').textContent = 'Sheathed Melee';
    document.getElementById('off-hand-name').textContent = mWep ? mWep.name : 'Bare Hands';
    document.getElementById('off-hand-stats').textContent = eq.shield ? `(${eq.shield.name} stowed)` : `Atk ${cStats.meleeAttackBonus}`;
    offSlot.classList.toggle('is-disabled-hand', Boolean(enc));
    if (offStateTag) offStateTag.textContent = enc ? 'LOCKED' : 'STOWED';
    offSlot.title = enc
      ? 'Cannot swap weapon stance during an active encounter'
      : 'Click to switch to Melee Stance [3 / R]';
  } else {
    const mWep = eq.meleeWeapon || cStats.activeWeapon;
    document.getElementById('main-hand-icon').textContent = '🗡️';
    document.getElementById('main-hand-label').textContent = 'Right Hand (Melee Active)';
    document.getElementById('main-hand-name').textContent = mWep ? mWep.name : 'Bare Hands';
    document.getElementById('main-hand-stats').textContent = `Atk ${cStats.meleeAttackBonus} • ${mWep ? mWep.damage_dice : '1d3'}`;
    mainSlot.title = (enc && enc.status === 'IN_COMBAT')
      ? `Click to strike with ${mWep ? mWep.name : 'Melee Weapon'} [Space / 1]`
      : 'Click to inspect weapons in Backpack [B]';

    if (eq.shield) {
      const twoHanded = mWep && mWep.is_two_handed;
      document.getElementById('off-hand-icon').textContent = '🛡️';
      document.getElementById('off-hand-label').textContent = twoHanded ? 'Left Hand (2H Disabled)' : 'Left Hand (Defense)';
      document.getElementById('off-hand-name').textContent = eq.shield.name;
      document.getElementById('off-hand-stats').textContent = twoHanded ? 'Disabled by 2H weapon' : `+${eq.shield.shield_bonus || 1} Shield AC (Passive)`;
      offSlot.classList.toggle('is-disabled-hand', Boolean(twoHanded));
      if (offStateTag) offStateTag.textContent = twoHanded ? '2H LOCKED' : 'PASSIVE AC';
      offSlot.title = twoHanded
        ? 'Shield AC bonus disabled while wielding a two-handed weapon'
        : `${eq.shield.name} grants passive +${eq.shield.shield_bonus || 1} AC (Click to open Pack [B])`;
    } else if (eq.rangedWeapon) {
      document.getElementById('off-hand-icon').textContent = '🏹';
      document.getElementById('off-hand-label').textContent = 'Slung on Back';
      document.getElementById('off-hand-name').textContent = eq.rangedWeapon.name;
      document.getElementById('off-hand-stats').textContent = `Atk ${cStats.rangedAttackBonus}`;
      offSlot.classList.toggle('is-disabled-hand', Boolean(enc));
      if (offStateTag) offStateTag.textContent = enc ? 'LOCKED' : 'STOWED';
      offSlot.title = enc
        ? 'Cannot swap weapon stance during an active encounter'
        : 'Click to switch to Ranged Stance [3 / R]';
    } else {
      document.getElementById('off-hand-icon').textContent = '✋';
      document.getElementById('off-hand-label').textContent = 'Left Hand';
      document.getElementById('off-hand-name').textContent = 'Empty Off-Hand';
      document.getElementById('off-hand-stats').textContent = 'No shield equipped';
      offSlot.classList.add('is-disabled-hand');
      if (offStateTag) offStateTag.textContent = 'EMPTY';
      offSlot.title = 'Click to open Backpack and equip off-hand gear [B]';
    }
  }

  const quickStanceBtn = document.getElementById('btn-quick-stance');
  const quickStanceLbl = document.getElementById('hud-quick-stance-lbl');
  if (quickStanceBtn) {
    quickStanceBtn.disabled = Boolean(enc);
    quickStanceBtn.title = enc
      ? 'Stance swap is locked during an active encounter'
      : 'Toggle between Melee and Ranged weapon stance [3 / R]';
  }
  if (quickStanceLbl) {
    quickStanceLbl.textContent = enc ? '🔒 Locked' : (isRanged ? '🗡️ To Melee' : '🏹 To Ranged');
  }
  const quickPackLbl = document.getElementById('hud-quick-pack-lbl');
  if (quickPackLbl && Array.isArray(state.inventory)) {
    quickPackLbl.textContent = `🎒 Pack (${state.inventory.length})`;
  }

  if (!sequenceLock) {
    updateHeroVitalsDisplay(hero.current_hp, hero.max_hp);
  }

  const acPct = Math.min(100, Math.max(20, Math.round(((cStats.heroAC - 8) / 14) * 100)));
  document.getElementById('pillar-ac').style.height = `${acPct}%`;

  const xpPct = Math.min(100, Math.max(12, (hero.xp % 1300) / 13));
  document.getElementById('pillar-xp').style.height = `${xpPct}%`;

  document.getElementById('hud-ac-val').textContent = cStats.heroAC;
  document.getElementById('hud-gold-val').textContent = hero.gold;
  document.getElementById('hud-potions-val').textContent = state.combatPotionCount;
  const potionChip = document.getElementById('hud-potion-chip');
  if (potionChip) {
    potionChip.classList.toggle('has-potions', state.combatPotionCount > 0);
    potionChip.classList.toggle('no-potions', state.combatPotionCount <= 0);
  }

  // Viewport Top HUD Area & Banner
  const vp = document.getElementById('fp-viewport');
  vp.classList.toggle('in-combat', Boolean(enc && enc.status === 'IN_COMBAT'));
  vp.classList.toggle('in-discovered', Boolean(enc && enc.status === 'DISCOVERED'));

  document.getElementById('fp-area-title').textContent = state.currentTile.name;
  document.getElementById('fp-area-coords').textContent = `[X: ${state.currentTile.x}, Y: ${state.currentTile.y}]`;
  document.getElementById('fp-area-terrain').textContent = state.currentTile.terrain;

  const stateBanner = document.getElementById('fp-state-banner');
  if (victory) {
    stateBanner.className = 'fp-state-banner state-safe';
    stateBanner.textContent = '🏆 Threat Vanquished — Step [W/S/Q/E] to Advance';
  } else if (enc && enc.status === 'IN_COMBAT') {
    stateBanner.className = 'fp-state-banner state-combat';
    stateBanner.textContent = `⚔️ Combat — Round ${enc.combat_round || 1}`;
  } else if (enc && enc.status === 'DISCOVERED') {
    stateBanner.className = 'fp-state-banner state-mystery';
    stateBanner.textContent = enc.isAmbush ? '⚠️ Ambush in the Mist!' : '👁️ Shadow in the Mist Ahead';
  } else if (state.currentTile.is_safe === 1) {
    stateBanner.className = 'fp-state-banner state-safe';
    stateBanner.textContent = '🛡️ Safe Haven Sanctuary';
  } else {
    stateBanner.className = 'fp-state-banner state-wild';
    stateBanner.textContent = '🌲 Wilderness Exploration';
  }

  // Point of Interest (POI) Inspect Trigger Button in Top HUD Right
  const poiWrap = document.getElementById('fp-poi-trigger-wrap');
  if (poiWrap) {
    const poi = state.viewportScene && state.viewportScene.pointOfInterest;
    const canInspectPoi = Boolean(poi && (!enc || enc.status !== 'IN_COMBAT') && !victory);
    if (canInspectPoi) {
      poiWrap.innerHTML = `
        <button type="button"
                class="btn-poi-inspect ${store.isPoiPlaqueOpen ? 'is-open' : ''}"
                id="btn-poi-inspect"
                onclick="triggerInspectPoi()"
                title="Inspect ${escapeHtml(poi.title)} [I]">
          🔍 ${escapeHtml(poi.shortPrompt || 'Inspect Landmark')} <kbd style="font-family:var(--font-mono); font-size:0.65rem; opacity:0.85;">[I]</kbd>
        </button>
      `;
    } else {
      poiWrap.innerHTML = '';
    }
  }
}

export function handleMainHandClick() {
  if (!store.currentState) return;
  const enc = store.currentState.encounter;
  if (enc && enc.status === 'IN_COMBAT') {
    dispatchAction('ATTACK');
  } else if (enc && enc.status === 'DISCOVERED') {
    dispatchAction('INVESTIGATE');
  } else {
    openLabModal('backpack');
  }
}

export function handleOffHandClick() {
  if (!store.currentState) return;
  const enc = store.currentState.encounter;
  if (enc) {
    spawnFloatingPopup('🔒 Stance Locked in Encounter', 'pop-miss');
    return;
  }
  if (store.currentState.equipment && store.currentState.equipment.rangedWeapon) {
    dispatchAction('STANCE');
  } else {
    openLabModal('backpack');
  }
}

export function renderCharacterModal(titleEl, bodyEl, hero, mods) {
  titleEl.textContent = `👤 Champion Record — ${hero.name}`;
  bodyEl.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
      <div class="lab-item-row"><span>STR: <strong>${hero.strength}</strong></span><span style="color:var(--accent-gold);">${mods.strength}</span></div>
      <div class="lab-item-row"><span>CON: <strong>${hero.constitution}</strong></span><span style="color:var(--accent-gold);">${mods.constitution}</span></div>
      <div class="lab-item-row"><span>DEX: <strong>${hero.dexterity}</strong></span><span style="color:var(--accent-gold);">${mods.dexterity}</span></div>
      <div class="lab-item-row"><span>INT: <strong>${hero.intelligence}</strong></span><span style="color:var(--accent-gold);">${mods.intelligence}</span></div>
      <div class="lab-item-row"><span>WIS: <strong>${hero.wisdom}</strong></span><span style="color:var(--accent-gold);">${mods.wisdom}</span></div>
      <div class="lab-item-row"><span>CHA: <strong>${hero.charisma}</strong></span><span style="color:var(--accent-gold);">${mods.charisma}</span></div>
    </div>
    <div class="lab-item-row" style="margin-top: 6px;">
      <span>Current Facing: <strong>${escapeHtml(store.currentState.facing || 'NORTH')}</strong> • Coordinates: <strong>[${store.currentState.currentTile.x}, ${store.currentState.currentTile.y}]</strong></span>
    </div>
    <div class="lab-item-row" style="margin-top: 6px;">
      <span>Active Combat Stance: <strong>${hero.primary_weapon}</strong></span>
      <button type="button" class="btn-action-stone" style="padding: 4px 10px; font-size: 0.78rem;" onclick="dispatchAction('STANCE')" ${store.currentState.encounter ? 'disabled' : ''}>
        Swap Stance [3 / R]
      </button>
    </div>
  `;
}
