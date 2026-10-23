/**
 * DARKGRID ADVENTURE LAB — Top Champion Deck, Vitals, Hand Slots, Champion Sheet & Point-Buy Creator (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';
import { escapeHtml } from '../ui/utils.js';
import { dispatchAction } from '../api/client.js';
import { spawnFloatingPopup } from '../combat/fx.js';

function openLabModal(modalName) {
  return uiCallbacks.openLabModal(modalName);
}
function closeLabModal() {
  return uiCallbacks.closeLabModal();
}
function renderModalContent(modalName) {
  return uiCallbacks.renderModalContent(modalName);
}

const DEFAULT_CLASS_BASES = {
  FIGHTER: {
    name: 'Fighter',
    title: 'Iron-Clad Vanguard',
    icon: '⚔️',
    strength: 14, constitution: 14, dexterity: 12, intelligence: 10, wisdom: 12, charisma: 10,
    hpPerLevel: 10
  },
  RANGER: {
    name: 'Ranger',
    title: 'Shadow-Stalker of the Wilds',
    icon: '🏹',
    strength: 10, constitution: 12, dexterity: 16, intelligence: 10, wisdom: 14, charisma: 10,
    hpPerLevel: 8
  },
  CLERIC: {
    name: 'Cleric',
    title: 'Vessel of the Dying Light',
    icon: '✨',
    strength: 12, constitution: 12, dexterity: 10, intelligence: 10, wisdom: 16, charisma: 12,
    hpPerLevel: 8
  }
};

function formatStatMod(score) {
  const m = Math.floor((Number(score || 10) - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

export function getAttributeTierLabel(score) {
  const s = Number(score || 10);
  if (s <= 7) return 'Weak';
  if (s <= 9) return 'Below Average';
  if (s <= 11) return 'Average';
  if (s <= 13) return 'Good';
  if (s <= 15) return 'Strong';
  if (s <= 17) return 'Exceptional';
  if (s <= 19) return 'Heroic';
  return 'Legendary';
}

export function updateHeroVitalsDisplay(currentHp, maxHp) {
  const hpPct = Math.min(100, Math.max(0, Math.round((currentHp / Math.max(1, maxHp)) * 100)));
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
  const acctLbl = document.getElementById('lbl-header-account');
  if (acctLbl) {
    acctLbl.textContent = (state && state.currentUser && state.currentUser.username)
      ? state.currentUser.username
      : 'Account';
  }

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

  // Status badges + Second Wind indicator + Cleric Divine Charges + Unspent Attribute Points indicator
  const statusContainer = document.getElementById('hud-status-pills');
  if (statusContainer) {
    const pills = [];
    if (Number(hero.attribute_points || 0) > 0) {
      pills.push(
        `<span onclick="openLabModal('character')" style="cursor:pointer; background: rgba(234,179,8,0.25); border: 1px solid #facc15; color: #fde047; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem;" title="Click to allocate milestone attribute points [C]">⬆️ +${Number(hero.attribute_points)} Attr</span>`
      );
    }
    if (hero.class === 'FIGHTER' && Number(hero.level || 1) >= 3) {
      const swUsed = Boolean((enc && enc.secondWindUsed) || hero.secondWindStatus === 'Spent');
      pills.push(
        `<span style="background: ${swUsed ? 'rgba(71,85,105,0.35)' : 'rgba(22,163,74,0.24)'}; border: 1px solid ${swUsed ? '#64748b' : '#4ade80'}; color: ${swUsed ? '#cbd5e1' : '#86efac'}; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem;" title="Fighter Second Wind status">🛡️ Second Wind: ${swUsed ? 'Spent' : 'Ready'}</span>`
      );
    }
    if (hero.class === 'CLERIC') {
      const dcInfo = state.clericDivineChargeInfo || {};
      const currCharges = Number(dcInfo.currentCharges ?? hero.divine_charges ?? 0);
      const maxCharges = Number(dcInfo.maxCharges ?? hero.max_divine_charges ?? 0);
      const lowCharges = currCharges <= 0;
      pills.push(
        `<span id="hud-divine-charges-pill" style="background: ${lowCharges ? 'rgba(71,85,105,0.35)' : 'rgba(234,179,8,0.22)'}; border: 1px solid ${lowCharges ? '#64748b' : '#facc15'}; color: ${lowCharges ? '#cbd5e1' : '#fde68a'}; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem; font-family: var(--font-mono);" title="Cleric Divine Charges — spent on Battle Prayer (1), Smite (1), and Divine Shield (2); recharged by resting in a city">✨ Charges: ${currCharges}/${maxCharges}</span>`
      );
    }
    if (enc && Array.isArray(enc.heroStatusBadges) && enc.heroStatusBadges.length > 0) {
      for (const b of enc.heroStatusBadges) {
        if (b.key === 'DIVINE_SHIELD_ACTIVE') {
          pills.push(
            `<span id="hud-divine-shield-pill" style="background: rgba(56,189,248,0.24); border: 1px solid #38bdf8; color: #bae6fd; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem;" title="Radiant barrier reducing incoming monster damage">🛡️ ${escapeHtml(b.label)}</span>`
          );
        } else {
          pills.push(
            `<span style="background: rgba(220,38,38,0.28); border: 1px solid #ef4444; color: #fca5a5; padding: 1px 6px; border-radius: 3px; font-size: 0.66rem;">⚠️ ${escapeHtml(b.label)}</span>`
          );
        }
      }
    }
    statusContainer.innerHTML = pills.join(' ');
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

  const nextXp = hero.xpForNextLevel;
  const floorXp = hero.xpCurrentLevelFloor || 0;
  const xpPct = nextXp
    ? Math.min(100, Math.max(12, Math.round(((hero.xp - floorXp) / Math.max(1, nextXp - floorXp)) * 100)))
    : 100;
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
    stateBanner.className = 'fp-state-banner state-safe state-victory';
    stateBanner.textContent = '🏆 Threat Vanquished — Step [W/S/Q/E] to Advance';
  } else if (enc && enc.status === 'IN_COMBAT') {
    stateBanner.className = 'fp-state-banner state-combat';
    stateBanner.textContent = `⚔️ Combat — Round ${enc.combat_round || 1}`;
  } else if (enc && enc.status === 'DISCOVERED') {
    stateBanner.className = 'fp-state-banner state-mystery';
    stateBanner.textContent = enc.isAmbush ? '⚠️ Ambush in the Mist!' : '👁️ Shadow in the Mist Ahead';
  } else if (state.currentTile.is_safe === 1) {
    stateBanner.className = 'fp-state-banner state-safe state-sanctuary';
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

function formatSlotItemBonus(item) {
  if (!item) return '';
  const bits = [];
  if (item.damage_dice) bits.push(`${item.damage_dice}${Number(item.is_two_handed) === 1 ? ' (2H)' : ''}`);
  if (item.armor_bonus) bits.push(`+${item.armor_bonus} Armor AC`);
  if (item.shield_bonus) bits.push(`+${item.shield_bonus} Shield AC`);
  if (item.enhancement_bonus) bits.push(`+${item.enhancement_bonus} Magic`);
  if (bits.length === 0 && item.description) {
    bits.push(item.description.length > 42 ? `${item.description.slice(0, 40)}…` : item.description);
  }
  return bits.join(' • ');
}

export async function spendMilestoneAttribute(statKey) {
  if (!statKey) return;
  await dispatchAction('SPEND_ATTRIBUTE_POINT', { attribute: statKey });
}

export function renderCharacterModal(titleEl, bodyEl, hero, mods) {
  const st = store.currentState || {};
  const saves = st.savingThrows || (st.combatStats && st.combatStats.savingThrows) || { fort: 0, ref: 0, will: 0, physical: 0 };
  const abilities = st.classAbilities || [];
  const eq = st.equipment || {};
  const cStats = st.combatStats || {};
  const nextXp = hero.xpForNextLevel;
  const xpReadout = nextXp ? `${hero.xp} / ${nextXp} XP` : `${hero.xp} XP`;
  const fmtSave = v => (Number(v) >= 0 ? `+${v}` : `${v}`);
  const unspentPoints = Number(hero.attribute_points || 0);
  const tierLabels = hero.attributeTierLabels || {};

  const slotList = [
    { label: 'Melee', item: eq.meleeWeapon },
    { label: 'Ranged', item: eq.rangedWeapon },
    { label: 'Armor', item: eq.armor },
    { label: 'Shield', item: eq.shield },
    { label: 'Ring', item: eq.ring },
    { label: 'Cloak', item: eq.cloak },
    { label: 'Neck', item: eq.neck },
    { label: 'Belt', item: eq.belt },
    { label: 'Feet', item: eq.feet }
  ];

  const statDefs = [
    { key: 'strength', short: 'STR', title: 'Melee Attack & Damage' },
    { key: 'constitution', short: 'CON', title: 'Max HP & Fortitude Save' },
    { key: 'dexterity', short: 'DEX', title: 'Ranged Attack, AC, Initiative & Reflex Save' },
    { key: 'intelligence', short: 'INT', title: 'Tactical Battle Experience (Offensive Mastery)' },
    { key: 'wisdom', short: 'WIS', title: 'Perception, Will Save, Prayers & Defensive Battle Experience' },
    { key: 'charisma', short: 'CHA', title: 'Merchant Trade Terms & Sacred Presence' }
  ];

  const compendium = Array.isArray(st.compendiumKnowledge)
    ? st.compendiumKnowledge.filter(entry => entry.discovered)
    : [];

  titleEl.textContent = `👤 Champion Record — ${hero.name} (${hero.class} • Level ${hero.level})`;
  bodyEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:9px 12px; background:rgba(15,20,28,0.82); border:1px solid var(--border-iron); border-radius:6px; margin-bottom:10px;">
      <div>
        <div style="font-family:var(--font-serif); font-weight:700; color:var(--accent-gold-bright); font-size:0.95rem;">
          ${escapeHtml(hero.name)} — Level ${hero.level} ${escapeHtml(hero.class)}
        </div>
        <div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">
          Vitality: <strong style="color:#86efac;">${hero.current_hp}/${hero.max_hp} HP</strong> •
          Armor Class: <strong style="color:#93c5fd;">${cStats.heroAC || 10} AC</strong> •
          ${hero.class === 'CLERIC' ? `Divine Charges: <strong style="color:#fde047;">${Number((st.clericDivineChargeInfo && st.clericDivineChargeInfo.currentCharges) ?? hero.divine_charges ?? 0)}/${Number((st.clericDivineChargeInfo && st.clericDivineChargeInfo.maxCharges) ?? hero.max_divine_charges ?? 0)}</strong> • ` : ''}
          Experience: <strong style="color:#fde68a;">${escapeHtml(xpReadout)}</strong> •
          Purse: <strong style="color:var(--accent-gold);">${hero.gold} gp</strong>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="btn-action-stone" style="padding:5px 11px; font-size:0.74rem;" onclick="openLabModal('backpack')">🎒 Open Pack [B]</button>
        <button type="button" class="btn-action-gold" style="padding:5px 11px; font-size:0.74rem;" onclick="openLabModal('account')">⚒️ Account & Hero Forge</button>
      </div>
    </div>

    ${unspentPoints > 0 ? `
      <div style="padding:8px 12px; background:rgba(234,179,8,0.18); border:1px solid #facc15; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <strong style="color:#fde047; font-size:0.82rem;">🌟 Milestone Attribute Points Available: ${unspentPoints}</strong>
          <div style="font-size:0.72rem; color:var(--text-body);">Select <strong>+1</strong> beside any attribute below to permanently increase it.</div>
        </div>
      </div>
    ` : ''}

    <div style="font-family:var(--font-serif); font-size:0.8rem; color:var(--accent-gold); font-weight:700; margin-bottom:5px;">
      ⚔️ Ability Scores, Descriptive Tiers & Modifiers ${hero.is_str_boosted ? '<span class="lab-badge" style="color:#fde68a; border-color:#c5a059;">Equipment Boost Active</span>' : ''}
    </div>
    <div class="champ-ability-grid" style="margin-bottom:10px;">
      ${statDefs.map(sd => {
        const val = Number(hero[sd.key] || 10);
        const baseVal = Number(hero[`base_${sd.key}`] ?? val);
        const modStr = (mods && mods[sd.key]) || formatStatMod(val);
        const tierLbl = tierLabels[sd.key] || getAttributeTierLabel(val);
        const isBoosted = val > baseVal;
        return `
          <div class="lab-item-row" title="${escapeHtml(sd.title)}" style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div>
              <span>${sd.short}: <strong>${val}</strong>${isBoosted ? ` <span style="font-size:0.68rem; color:#86efac;">(Base ${baseVal})</span>` : ''}</span>
              <div style="font-size:0.68rem; color:var(--text-muted);">${escapeHtml(tierLbl)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="color:var(--accent-gold); font-family:var(--font-mono); font-weight:700;">${escapeHtml(modStr)}</span>
              ${unspentPoints > 0 ? `
                <button type="button" class="btn-action-gold" style="padding:2px 7px; font-size:0.72rem;" onclick="spendMilestoneAttribute('${sd.key}')" title="Spend 1 attribute point to permanently raise ${sd.short}">+1</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div style="font-family:var(--font-serif); font-size:0.8rem; color:var(--accent-gold); font-weight:700; margin-bottom:5px;">
      🛡️ Saving Throws & Combat Readiness
    </div>
    <div class="champ-save-grid" style="margin-bottom:10px;">
      <div class="lab-item-row"><span>Fortitude</span><strong style="color:#86efac; font-family:var(--font-mono);">${fmtSave(saves.fort)}</strong></div>
      <div class="lab-item-row"><span>Reflex</span><strong style="color:#93c5fd; font-family:var(--font-mono);">${fmtSave(saves.ref)}</strong></div>
      <div class="lab-item-row"><span>Will</span><strong style="color:#c4b5fd; font-family:var(--font-mono);">${fmtSave(saves.will)}</strong></div>
      <div class="lab-item-row" title="Physical Save = max(Fortitude, Reflex)"><span>Physical</span><strong style="color:#fde68a; font-family:var(--font-mono);">${fmtSave(saves.physical)}</strong></div>
    </div>

    ${abilities.length > 0 ? `
      <div style="font-family:var(--font-serif); font-size:0.8rem; color:var(--accent-gold); font-weight:700; margin-bottom:5px;">
        ✨ Class Pillars & Progression Tiers
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
        ${abilities.map(a => `
          <div class="lab-item-row" style="flex-direction:column; align-items:flex-start; gap:3px;">
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
              <strong style="color:var(--text-heading); font-size:0.82rem;">${escapeHtml(a.name)}</strong>
              <span class="lab-badge" style="color:${a.active ? '#86efac' : '#fde68a'};">${escapeHtml(a.currentTier)}</span>
            </div>
            <div style="font-size:0.74rem; color:var(--text-muted);">${escapeHtml(a.detail)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${compendium.length > 0 ? `
      <div style="font-family:var(--font-serif); font-size:0.8rem; color:var(--accent-gold); font-weight:700; margin-bottom:5px;">
        📖 Studied Foes & Battle Experience (${compendium.length} Discovered)
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap:6px; margin-bottom:10px; max-height:130px; overflow-y:auto;">
        ${compendium.slice(0, 12).map(m => `
          <div class="lab-item-row" style="padding:5px 8px; font-size:0.72rem; flex-direction:column; align-items:flex-start; gap:2px;">
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
              <strong style="color:var(--text-heading);">${escapeHtml(m.name)}</strong>
              <span class="lab-badge" style="font-size:0.65rem;">${escapeHtml(m.masteryLabel)}</span>
            </div>
            <div style="color:var(--text-muted); font-size:0.67rem;">
              ${escapeHtml(m.familyLabel || '')} • ${m.victoryCount} slain / ${m.encounteredCount} met
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div style="font-family:var(--font-serif); font-size:0.8rem; color:var(--accent-gold); font-weight:700; margin-bottom:5px;">
      🧰 9-Slot Equipped Panoply
    </div>
    <div class="champ-panoply-grid" style="margin-bottom:10px;">
      ${slotList.map(s => {
        const bonusTxt = formatSlotItemBonus(s.item);
        return `
        <div class="lab-item-row" style="padding:6px 9px; font-size:0.74rem; flex-direction:column; align-items:flex-start; gap:2px;">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center; gap:6px;">
            <span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em;">${escapeHtml(s.label)}</span>
            <strong style="color:${s.item ? 'var(--text-heading)' : 'var(--text-muted)'}; text-align:right;">${escapeHtml(s.item ? s.item.name : 'Empty')}</strong>
          </div>
          ${bonusTxt ? `<div style="font-size:0.68rem; color:var(--accent-gold); font-family:var(--font-mono); align-self:flex-end;">${escapeHtml(bonusTxt)}</div>` : ''}
        </div>
      `;
      }).join('')}
    </div>

    <div class="lab-item-row" style="margin-top: 6px;">
      <span>Position: <strong>${escapeHtml(st.currentTile ? st.currentTile.name : 'Realm')} [${st.currentTile ? st.currentTile.x : 7}, ${st.currentTile ? st.currentTile.y : 7}]</strong> • Facing: <strong>${escapeHtml(st.facing || 'NORTH')}</strong> • Stance: <strong>${escapeHtml(hero.primary_weapon)}</strong></span>
      <button type="button" class="btn-action-stone" style="padding: 4px 10px; font-size: 0.78rem;" onclick="dispatchAction('STANCE')" ${st.encounter ? 'disabled' : ''}>
        Swap Stance [3 / R]
      </button>
    </div>
  `;
}

/* =========================================================================
   ACCOUNT, SESSION & 72-POINT CHARACTER CREATION FORGE (Phase 7B)
   ========================================================================= */
export function selectCreatorClass(classType) {
  const upper = String(classType || 'FIGHTER').toUpperCase();
  const classBases = (store.currentState && store.currentState.classBases) || DEFAULT_CLASS_BASES;
  const base = classBases[upper] || DEFAULT_CLASS_BASES.FIGHTER;

  const defaultNames = {
    FIGHTER: 'Vaelen Ironhand',
    RANGER: 'Kaelen Thornstrider',
    CLERIC: 'Brother Aldric'
  };

  store.charCreatorDraft.classType = upper;
  if (!store.charCreatorDraft.name || Object.values(defaultNames).includes(store.charCreatorDraft.name)) {
    store.charCreatorDraft.name = defaultNames[upper] || 'Vaelen Ironhand';
  }
  store.charCreatorDraft.primaryWeapon = upper === 'RANGER' ? 'RANGED' : 'MELEE';
  if (upper === 'RANGER' && !store.charCreatorDraft.favoredEnemyType) {
    store.charCreatorDraft.favoredEnemyType = 'ANIMALS';
  }
  store.charCreatorDraft.stats = {
    strength: Number(base.strength),
    constitution: Number(base.constitution),
    dexterity: Number(base.dexterity),
    intelligence: Number(base.intelligence),
    wisdom: Number(base.wisdom),
    charisma: Number(base.charisma)
  };

  if (store.currentOpenModal === 'account' || store.currentOpenModal === 'create-character') {
    renderModalContent(store.currentOpenModal);
  }
}

export function resetCreatorPreset() {
  selectCreatorClass(store.charCreatorDraft.classType || 'FIGHTER');
}

export function adjustCreatorStat(statKey, delta) {
  const draft = store.charCreatorDraft;
  const statRules = (store.currentState && store.currentState.statRules) || {};
  const requiredTotal = Number(statRules.requiredTotalSum || statRules.totalSum || 72);
  const minVal = Number(statRules.minScore || 8);
  const maxVal = Number(statRules.maxScore || 18);

  const currentTotal = Object.values(draft.stats).reduce((a, b) => a + Number(b || 0), 0);
  const currentVal = Number(draft.stats[statKey] || 10);
  const nextVal = currentVal + Number(delta);

  if (nextVal < minVal || nextVal > maxVal) return;
  if (delta > 0 && currentTotal >= requiredTotal) return;

  draft.stats[statKey] = nextVal;
  if (store.currentOpenModal === 'account' || store.currentOpenModal === 'create-character') {
    renderModalContent(store.currentOpenModal);
  }
}

export function setCreatorField(field, value) {
  store.charCreatorDraft[field] = value;
}

export async function submitCreatorHero() {
  const nameEl = document.getElementById('creator-hero-name');
  const feEl = document.getElementById('creator-favored-enemy');
  const stanceEl = document.getElementById('creator-primary-weapon');
  const draft = store.charCreatorDraft;

  if (nameEl && nameEl.value.trim()) {
    draft.name = nameEl.value.trim();
  }
  if (feEl) {
    draft.favoredEnemyType = feEl.value;
  }
  if (stanceEl) {
    draft.primaryWeapon = stanceEl.value;
  }

  const chosenFamily = draft.classType === 'RANGER' ? (draft.favoredEnemyType || 'ANIMALS') : null;
  await dispatchAction('CREATE_CHARACTER', {
    name: draft.name,
    classType: draft.classType,
    stats: { ...draft.stats },
    favoredEnemyFamily: chosenFamily,
    favoredEnemyType: chosenFamily,
    primaryWeapon: draft.primaryWeapon
  });
  if (store.currentState && store.currentState.character) {
    closeLabModal();
  }
}

export async function submitLabAuth(authAction) {
  const userEl = document.getElementById('lab-auth-username');
  const passEl = document.getElementById('lab-auth-password');
  const username = userEl ? userEl.value.trim() : '';
  const password = passEl ? passEl.value : '';
  await dispatchAction(authAction, { username, password });
  if (store.currentState && store.currentState.character && authAction === 'LOGIN') {
    closeLabModal();
  }
}

export function renderAccountAndCreatorModal(titleEl, bodyEl) {
  titleEl.textContent = '👤 Account, Session & Champion Point-Buy Forge';
  const st = store.currentState || {};
  const user = st.currentUser;
  const hasLivingHero = Boolean(st.character);
  const classBases = st.classBases || DEFAULT_CLASS_BASES;
  const statRules = st.statRules || {};
  const requiredTotal = Number(statRules.requiredTotalSum || statRules.totalSum || 72);
  const minScore = Number(statRules.minScore || 8);
  const maxScore = Number(statRules.maxScore || 18);

  const feOptions = st.favoredEnemyOptions || [
    { value: 'ANIMALS', label: 'Animals' },
    { value: 'VERMIN', label: 'Vermin' },
    { value: 'PLANTS', label: 'Plants & Fungi' },
    { value: 'HUMANOID_RAIDER', label: 'Humanoid Raiders' },
    { value: 'GOBLINOIDS', label: 'Goblinoids' },
    { value: 'GNOLLS', label: 'Gnolls' },
    { value: 'ORCS', label: 'Orcs' },
    { value: 'REPTILIAN_HUMANOIDS', label: 'Reptilian Humanoids' },
    { value: 'GIANTS', label: 'Giants & Ogres' },
    { value: 'DRAGONS', label: 'Dragons & Drakes' },
    { value: 'OUTSIDERS', label: 'Elementals & Outsiders' },
    { value: 'AVIAN_MAGICAL_BEASTS', label: 'Avian Magical Beasts' },
    { value: 'ARACHNID_MAGICAL_BEASTS', label: 'Arachnid Magical Beasts' },
    { value: 'TERRESTRIAL_MAGICAL_BEASTS', label: 'Other Magical Beasts' }
  ];

  const draft = store.charCreatorDraft;
  const activeBase = classBases[draft.classType] || DEFAULT_CLASS_BASES.FIGHTER;
  const totalPoints = Object.values(draft.stats).reduce((a, b) => a + Number(b || 0), 0);
  const pointsRemaining = requiredTotal - totalPoints;
  const conMod = Math.floor((Number(draft.stats.constitution || 10) - 10) / 2);
  const startHp = draft.classType === 'FIGHTER'
    ? Math.max(1, 10 + conMod + 2)
    : (draft.classType === 'RANGER'
      ? Math.max(1, 10 + conMod)
      : Math.max(1, 8 + conMod));

  const statLabels = [
    { key: 'strength', short: 'STR', label: 'Strength (Melee Atk & Dmg)' },
    { key: 'constitution', short: 'CON', label: 'Constitution (Max HP & Fortitude)' },
    { key: 'dexterity', short: 'DEX', label: 'Dexterity (Ranged Atk, AC & Reflex)' },
    { key: 'intelligence', short: 'INT', label: 'Intelligence (Tactical Battle Experience)' },
    { key: 'wisdom', short: 'WIS', label: 'Wisdom (Will Save, Perception, Prayers & Battle Exp)' },
    { key: 'charisma', short: 'CHA', label: 'Charisma (Merchant Trade Terms & Sacred Presence)' }
  ];

  bodyEl.innerHTML = `
    ${st.errorMessage ? `
      <div style="padding:8px 12px; background:rgba(127,29,29,0.45); border:1px solid #ef4444; color:#fca5a5; border-radius:6px; font-size:0.78rem; margin-bottom:8px;">
        ⚠️ ${escapeHtml(st.errorMessage)}
      </div>
    ` : ''}
    ${st.infoMessage ? `
      <div style="padding:8px 12px; background:rgba(20,83,45,0.35); border:1px solid #4ade80; color:#86efac; border-radius:6px; font-size:0.78rem; margin-bottom:8px;">
        ✦ ${escapeHtml(st.infoMessage)}
      </div>
    ` : ''}

    <!-- 1. ACCOUNT & SESSION PANEL -->
    <div class="qa-card" style="margin-bottom:10px;">
      <div class="qa-card-title">
        <span>🔐 Player Account & Session</span>
        <span class="lab-badge" style="color:${user && !user.isSandboxDefault ? '#86efac' : '#fde68a'};">
          ${user ? `Signed in: ${escapeHtml(user.username)}${user.isSandboxDefault ? ' (Sandbox)' : ''}` : 'Not Signed In'}
        </span>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:6px;">
        <input type="text" id="lab-auth-username" class="lab-input" placeholder="Username (3–20 chars)" aria-label="Username"
               style="width:175px;">
        <input type="password" id="lab-auth-password" class="lab-input" placeholder="Password (min 6 chars)" aria-label="Password"
               style="width:175px;">
        <button type="button" class="btn-action-gold" style="padding:5px 12px; font-size:0.75rem;" onclick="submitLabAuth('LOGIN')">Sign In</button>
        <button type="button" class="btn-action-stone" style="padding:5px 12px; font-size:0.75rem;" onclick="submitLabAuth('REGISTER')">Register Account</button>
        ${user && !user.isSandboxDefault ? `
          ${st.labToolsAllowed ? `<button type="button" class="btn-action-stone" style="padding:5px 10px; font-size:0.74rem;" onclick="dispatchAction('LOGOUT', { returnToSandbox: true })">Return to Sandbox</button>` : ''}
          <button type="button" class="btn-action-stone" style="padding:5px 10px; font-size:0.74rem;" onclick="dispatchAction('LOGOUT')">Sign Out</button>
        ` : ''}
      </div>
    </div>

    <!-- 2. FULL 72-POINT CHARACTER CREATION FORGE -->
    <div class="qa-card">
      <div class="qa-card-title">
        <span>⚒️ Forge New Champion (Canonical 72-Point Attribute Allocation)</span>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="btn-action-stone" style="padding:2px 8px; font-size:0.7rem;" onclick="resetCreatorPreset()">Reset to Class Preset</button>
          <span class="lab-badge" style="color:${pointsRemaining === 0 ? '#86efac' : '#fde68a'};">
            Points Remaining: ${pointsRemaining} (Total: ${totalPoints} / ${requiredTotal})
          </span>
        </div>
      </div>

      ${hasLivingHero ? `
        <div class="forge-living-lock-banner" id="forge-living-hero-banner" style="margin-top:8px;">
          <div>
            <strong>🛡️ Active Champion in the Realm:</strong>
            <span style="color:#fff;">${escapeHtml(st.character.name)}</span> (Level ${st.character.level} ${escapeHtml(st.character.class)}) is currently alive.
            <div style="font-size:0.72rem; color:#fde68a; opacity:0.9; margin-top:2px;">
              Darkgrid enforces a strict <strong>one living champion per account</strong> rule. You may forge a new hero only after your current champion falls in battle (or sign in to another account).
            </div>
          </div>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.73rem; white-space:nowrap;" onclick="closeLabModal()">
            Return to ${escapeHtml(st.character.name)}
          </button>
        </div>
      ` : ''}

      <div class="forge-top-grid" style="margin-top:8px;">
        <div>
          <label for="creator-hero-name" style="font-size:0.73rem; color:var(--text-muted); display:block; margin-bottom:3px;">Champion Name (1–30 characters)</label>
          <input type="text" id="creator-hero-name" class="lab-input" maxlength="30" value="${escapeHtml(draft.name)}"
                 oninput="setCreatorField('name', this.value)"
                 style="width:100%; border-color:var(--border-gold-dim); font-size:0.82rem;">
        </div>
        <div>
          <span style="font-size:0.73rem; color:var(--text-muted); display:block; margin-bottom:3px;">Choose Calling (Class)</span>
          <div style="display:flex; gap:6px;">
            ${['FIGHTER', 'RANGER', 'CLERIC'].map(cls => {
              const cb = classBases[cls] || DEFAULT_CLASS_BASES[cls];
              const isSel = draft.classType === cls;
              return `
                <button type="button" class="${isSel ? 'btn-action-gold' : 'btn-action-stone'}"
                        style="flex:1; padding:5px 8px; font-size:0.75rem;"
                        onclick="selectCreatorClass('${cls}')">
                  ${escapeHtml(cb.icon || '⚔️')} ${escapeHtml(cb.name || cls)}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div style="margin-top:8px; padding:7px 10px; background:rgba(12,16,24,0.75); border-left:3px solid var(--accent-gold); font-size:0.75rem; color:var(--text-body);">
        <strong style="color:var(--accent-gold-bright);">${escapeHtml(activeBase.name)} — ${escapeHtml(activeBase.title || '')}</strong>
        • Starting Vitality: <strong style="color:#86efac;">${startHp} HP</strong> • Starting Purse: <strong>10 gp</strong> + Starter Armaments & 2 Potions
        ${activeBase.description ? `<div style="margin-top:2px; color:var(--text-muted); font-size:0.72rem;">${escapeHtml(activeBase.description)}</div>` : ''}
      </div>

      <div class="forge-stat-grid" style="margin-top:8px;">
        ${statLabels.map(s => {
          const val = Number(draft.stats[s.key] || 10);
          const baseVal = Number(activeBase[s.key] || 10);
          const canDec = val > minScore;
          const canInc = val < maxScore && pointsRemaining > 0;
          const tierLbl = getAttributeTierLabel(val);
          return `
            <div class="lab-item-row" style="padding:6px 10px;">
              <div>
                <div style="font-weight:700; font-size:0.8rem; color:var(--text-heading);">
                  ${s.short}: <span style="color:var(--accent-gold-bright);">${val}</span>
                  <span style="font-family:var(--font-mono); font-size:0.74rem; color:var(--accent-gold);">(${formatStatMod(val)})</span>
                  <span class="lab-badge" style="font-size:0.65rem; margin-left:4px;">${escapeHtml(tierLbl)}</span>
                </div>
                <div style="font-size:0.69rem; color:var(--text-muted);">${escapeHtml(s.label)} • Preset ${baseVal} (Range ${minScore}–${maxScore})</div>
              </div>
              <div style="display:flex; gap:4px; align-items:center;">
                <button type="button" class="btn-action-stone" style="padding:3px 9px; font-size:0.78rem;" ${!canDec ? 'disabled' : ''} onclick="adjustCreatorStat('${s.key}', -1)">−</button>
                <button type="button" class="btn-action-gold" style="padding:3px 9px; font-size:0.78rem;" ${!canInc ? 'disabled' : ''} onclick="adjustCreatorStat('${s.key}', 1)">+</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="forge-top-grid" style="margin-top:8px;">
        ${draft.classType === 'RANGER' ? `
          <div>
            <label for="creator-favored-enemy" style="font-size:0.73rem; color:var(--text-muted); display:block; margin-bottom:3px;">Sworn Blood-Quarry (14 Initial Monster Families — Undead Forbidden)</label>
            <select id="creator-favored-enemy" class="lab-select" onchange="setCreatorField('favoredEnemyType', this.value)"
                    style="width:100%; border-color:var(--border-gold-dim);">
              ${feOptions.map(opt => `
                <option value="${escapeHtml(opt.value || opt.key)}" ${draft.favoredEnemyType === (opt.value || opt.key) ? 'selected' : ''}>${escapeHtml(opt.label)}</option>
              `).join('')}
            </select>
          </div>
        ` : `
          <div style="font-size:0.73rem; color:var(--text-muted); display:flex; align-items:center;">
            ${draft.classType === 'FIGHTER'
              ? '⚔️ Fighter Mastery: Battle-Hardened vitality & saves, Know Your Enemy, Second Wind (Lv3+), Weapon & Armor Training.'
              : '✨ Cleric Mastery: Sacred Knowledge, Turn Undead, Holy Radiance vs Undead & Sacred Self-Healing Prayers.'}
          </div>
        `}
        <div>
          <label for="creator-primary-weapon" style="font-size:0.73rem; color:var(--text-muted); display:block; margin-bottom:3px;">Starting Combat Stance</label>
          <select id="creator-primary-weapon" class="lab-select" onchange="setCreatorField('primaryWeapon', this.value)"
                  style="width:100%;">
            <option value="MELEE" ${draft.primaryWeapon === 'MELEE' ? 'selected' : ''}>🗡️ Melee Stance (Sword / Mace & Shield)</option>
            <option value="RANGED" ${draft.primaryWeapon === 'RANGED' ? 'selected' : ''}>🏹 Ranged Stance (Bow / Sling)</option>
          </select>
        </div>
      </div>

      <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <span style="font-size:0.73rem; color:${hasLivingHero ? '#fde68a' : 'var(--text-muted)'};">
          ${hasLivingHero
            ? `One living champion per account — ${escapeHtml(st.character.name)} is still alive.`
            : 'Ready to enter Oakhaven Sanctuary [7,7].'}
        </span>
        <button type="button" class="btn-action-gold" id="btn-submit-create-character"
                style="padding:6px 16px; font-size:0.8rem;"
                ${(hasLivingHero || pointsRemaining !== 0) ? 'disabled' : ''}
                title="${hasLivingHero ? 'Cannot forge a second living champion while your active hero lives' : 'Forge Champion & Enter Oakhaven'}"
                onclick="submitCreatorHero()">
          ${hasLivingHero ? '🔒 Active Champion Lives' : '⚔️ Forge Champion & Enter Oakhaven'}
        </button>
      </div>
    </div>
  `;
}
