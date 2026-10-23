/**
 * DARKGRID ADVENTURE LAB — Tactical Action Deck & First-Person Navigation Pad (ES Module)
 */
import { store, FACING_META } from '../state/store.js';

export function renderActionDeckAndPad(state) {
  const enc = state.encounter;
  const hero = state.character;
  const cStats = state.combatStats;
  const facing = state.facing || 'NORTH';
  const fMeta = FACING_META[facing] || FACING_META.NORTH;
  const poi = state.viewportScene && state.viewportScene.pointOfInterest;

  document.getElementById('deck-stance-indicator').textContent = cStats.isRangedActive ? '🏹 Ranged Stance' : '🗡️ Melee Stance';
  const deckHeading = document.getElementById('action-deck-heading');
  if (deckHeading) {
    if (enc && enc.status === 'IN_COMBAT') {
      deckHeading.textContent = '⚔️ Combat Actions';
    } else if (enc && enc.status === 'DISCOVERED') {
      deckHeading.textContent = '👁️ Encounter Response';
    } else if (state.victory) {
      deckHeading.textContent = '🏆 Victory — Path Clear';
    } else if (state.isSafeCity) {
      deckHeading.textContent = '🏛️ Sanctuary Actions';
    } else {
      deckHeading.textContent = '🧭 Quick Actions';
    }
  }

  const slot1 = document.getElementById('action-slot-1');
  const slot2 = document.getElementById('action-slot-2');
  const slot3 = document.getElementById('action-slot-3');
  const slot4 = document.getElementById('action-slot-4');

  // SLOT 1: Primary Context Action (Attack / Engage Threat / Sanctuary Rest / Inspect Landmark / Continue)
  if (enc && enc.status === 'IN_COMBAT') {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = cStats.isRangedActive ? '🏹' : '⚔️';
    document.getElementById('slot1-title').textContent = cStats.activeWeapon.name;
    const atkB = cStats.isRangedActive ? cStats.rangedAttackBonus : cStats.meleeAttackBonus;
    document.getElementById('slot1-sub').textContent = `${atkB} • ${cStats.activeWeapon.damage_dice}`;
    slot1.title = `Attack with ${cStats.activeWeapon.name} [Space / 1]`;
  } else if (enc && enc.status === 'DISCOVERED') {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '⚔️';
    document.getElementById('slot1-title').textContent = enc.isAmbush ? 'Face Ambush' : 'Engage Threat';
    document.getElementById('slot1-sub').textContent = 'Reveal & Fight';
    slot1.title = 'Step forward into the mist and engage the threat [Space / 1]';
  } else if (state.isSafeCity) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '🛌';
    document.getElementById('slot1-title').textContent = 'Sanctuary Rest';
    const dcInfo = state.clericDivineChargeInfo || {};
    const needCharges = hero.class === 'CLERIC' && Number(dcInfo.currentCharges ?? hero.divine_charges ?? 0) < Number(dcInfo.maxCharges ?? hero.max_divine_charges ?? 0);
    const needPrayers = hero.class === 'CLERIC' && state.clericHealInfo && Number(state.clericHealInfo.remainingUses) < Number(state.clericHealInfo.maxUses);
    document.getElementById('slot1-sub').textContent = (hero.current_hp < hero.max_hp || needCharges || needPrayers)
      ? (hero.class === 'CLERIC' ? 'Restore HP & Charges' : 'Restore Full HP')
      : 'Full Vitality';
    slot1.title = 'Rest at Oakhaven Sanctuary to restore full HP, Cleric prayers, and Divine Charges [Space / 1]';
  } else if (poi && !state.victory) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '🔍';
    document.getElementById('slot1-title').textContent = poi.shortPrompt || 'Inspect Landmark';
    document.getElementById('slot1-sub').textContent = poi.title || 'Examine Lore [I]';
    slot1.title = `Inspect ${poi.title || 'Landmark'} [Space / 1 / I]`;
  } else if (state.victory) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '▶';
    document.getElementById('slot1-title').textContent = 'Continue';
    document.getElementById('slot1-sub').textContent = 'Resume Travel';
    slot1.title = 'Clear victory banner and continue journey [Space / 1]';
  } else {
    slot1.disabled = true;
    document.getElementById('slot1-icon').textContent = cStats.isRangedActive ? '🏹' : '🗡️';
    document.getElementById('slot1-title').textContent = cStats.activeWeapon.name;
    document.getElementById('slot1-sub').textContent = 'Path Clear';
    slot1.title = 'No active enemy on this tile — use W/A/S/D/Q/E to explore';
  }

  // SLOT 2: Quick Potion Flask
  const hasPotions = state.combatPotionCount > 0;
  const atFullHp = hero.current_hp >= hero.max_hp;
  const canDrinkInCombat = enc && enc.status === 'IN_COMBAT' && hasPotions;
  const canDrinkOut = !enc && hasPotions && !atFullHp;
  slot2.disabled = !(canDrinkInCombat || canDrinkOut);
  document.getElementById('slot2-title').textContent = 'Drink Potion';

  if (!hasPotions) {
    document.getElementById('slot2-sub').textContent = 'None in Pack';
    slot2.title = 'No Healing Potions remaining in backpack';
  } else if (!enc && atFullHp) {
    document.getElementById('slot2-sub').textContent = `${state.combatPotionCount}× (Full HP)`;
    slot2.title = 'Already at full Vitality';
  } else {
    document.getElementById('slot2-sub').textContent = `${state.combatPotionCount}× (${state.combatPotions[0].healEffect || '1d8+1'})`;
    slot2.title = 'Drink a Healing Potion [2]';
  }

  // SLOT 3: Dedicated Stance Toggle (Single place in the UI)
  slot3.disabled = Boolean(enc);
  document.getElementById('slot3-icon').textContent = cStats.isRangedActive ? '🗡️' : '🏹';
  document.getElementById('slot3-title').textContent = 'Swap Stance';
  if (enc) {
    document.getElementById('slot3-sub').textContent = 'Locked in Combat';
    slot3.title = 'Cannot swap weapon stance during an active encounter';
  } else {
    document.getElementById('slot3-sub').textContent = cStats.isRangedActive ? 'To Melee' : 'To Ranged';
    slot3.title = 'Toggle between Melee and Ranged weapon stance [3 / R]';
  }

  // SLOT 4: Retreat / Slip Past / Cleric Prayer
  if (enc && enc.status === 'IN_COMBAT') {
    slot4.disabled = false;
    document.getElementById('slot4-icon').textContent = '🏃';
    document.getElementById('slot4-title').textContent = store.fleeConfirmArmed ? 'Confirm Flee?' : 'Flee Battle';
    document.getElementById('slot4-sub').textContent = store.fleeConfirmArmed ? 'Press [4/F] Again' : 'Provokes AoO';
    slot4.title = 'Attempt to flee combat (monster gets a parting attack of opportunity) [4 / F]';
  } else if (enc && enc.status === 'DISCOVERED') {
    slot4.disabled = Boolean(enc.isAmbush);
    document.getElementById('slot4-icon').textContent = '👣';
    document.getElementById('slot4-title').textContent = 'Slip Past';
    document.getElementById('slot4-sub').textContent = enc.isAmbush ? 'Ambush Locked!' : 'Bypass Threat';
    slot4.title = enc.isAmbush
      ? 'Ambush! You cannot slip past — you must engage the threat'
      : 'Slip past the unidentified threat without fighting (or simply walk with W/S/Q/E) [4 / F]';
  } else if (hero.class === 'CLERIC' && state.clericHealInfo) {
    const canHeal = state.clericHealInfo.remainingUses > 0 && hero.current_hp < hero.max_hp;
    slot4.disabled = !canHeal;
    document.getElementById('slot4-icon').textContent = '✨';
    document.getElementById('slot4-title').textContent = 'Divine Heal';
    document.getElementById('slot4-sub').textContent = state.clericHealInfo.remainingUses === 0
      ? '0 Prayers Left'
      : (hero.current_hp >= hero.max_hp ? 'Full HP' : `${state.clericHealInfo.remainingUses}/${state.clericHealInfo.maxUses} (${state.clericHealInfo.dice})`);
    slot4.title = canHeal ? 'Channel Cleric Divine Heal [4 / F]' : 'Requires missing HP and available daily prayers';
  } else {
    slot4.disabled = true;
    document.getElementById('slot4-icon').textContent = '🏃';
    document.getElementById('slot4-title').textContent = 'Retreat';
    document.getElementById('slot4-sub').textContent = 'No Threat';
    slot4.title = 'Available when an encounter or combat is active';
  }

  // First-Person Navigation Pad (Turn Left/Right, Forward/Backward, Strafe Left/Right)
  const relMoves = (state.viewportScene && state.viewportScene.relativeMoves) || {};
  const isMoveLockedByCombat = Boolean(enc && (enc.status === 'IN_COMBAT' || enc.isAmbush));
  const moveDeck = document.getElementById('dm-movement-deck');
  const navLockBanner = document.getElementById('dm-nav-combat-banner');
  if (moveDeck) {
    moveDeck.classList.toggle('is-combat-locked', isMoveLockedByCombat);
  }
  if (navLockBanner) {
    navLockBanner.hidden = !isMoveLockedByCombat;
    if (isMoveLockedByCombat) {
      navLockBanner.textContent = enc.isAmbush
        ? '⚠️ Ambush! Press [Space / 1] to face the threat'
        : '🔒 Engaged in Melee — Use Flee [4 / F] to retreat';
    }
  }

  const leftCard = relMoves.STRAFE_LEFT ? relMoves.STRAFE_LEFT.cardinal : 'WEST';
  const rightCard = relMoves.STRAFE_RIGHT ? relMoves.STRAFE_RIGHT.cardinal : 'EAST';
  const fwdCard = relMoves.FORWARD ? relMoves.FORWARD.cardinal : 'NORTH';
  const backCard = relMoves.BACKWARD ? relMoves.BACKWARD.cardinal : 'SOUTH';

  document.getElementById('lbl-turn-left').textContent = `Turn ${leftCard[0]}`;
  document.getElementById('lbl-turn-right').textContent = `Turn ${rightCard[0]}`;
  document.getElementById('lbl-forward').textContent = `Forward (${fwdCard[0]})`;
  document.getElementById('lbl-backward').textContent = `Back (${backCard[0]})`;
  document.getElementById('lbl-strafe-left').textContent = `Strafe (${leftCard[0]})`;
  document.getElementById('lbl-strafe-right').textContent = `Strafe (${rightCard[0]})`;

  document.getElementById('pad-center-glyph').textContent = fMeta.arrow;
  document.getElementById('pad-center-lbl').textContent = facing;

  const padMap = [
    { id: 'pad-forward', rel: 'FORWARD', label: 'Forward' },
    { id: 'pad-backward', rel: 'BACKWARD', label: 'Backward' },
    { id: 'pad-strafe-left', rel: 'STRAFE_LEFT', label: 'Strafe Left' },
    { id: 'pad-strafe-right', rel: 'STRAFE_RIGHT', label: 'Strafe Right' }
  ];

  padMap.forEach(({ id, rel, label }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const mInfo = relMoves[rel];
    const canStep = !isMoveLockedByCombat && mInfo && mInfo.available;
    btn.classList.toggle('is-blocked-dir', !canStep);
    if (isMoveLockedByCombat) {
      btn.title = enc.isAmbush
        ? 'Ambush! You cannot move away without facing the threat'
        : 'Locked in melee combat — use Flee [4/F] to retreat';
    } else if (mInfo) {
      btn.title = mInfo.available
        ? `${label} (${mInfo.cardinal}): ${mInfo.tileName}${enc && enc.status === 'DISCOVERED' ? ' (Slips past threat)' : ''}`
        : `Blocked (${mInfo.cardinal}): ${mInfo.reason}`;
    }
  });

  // Update Single Pack Counter
  const packLbl = document.getElementById('util-pack-lbl');
  if (packLbl) {
    packLbl.textContent = `🎒 Pack (${state.inventory.length})`;
  }

  // Contextual slot visibility & primary action emphasis (Phase 4 Player-First UI)
  const isStage1 = Boolean(enc && enc.status === 'DISCOVERED');
  const isStage2 = Boolean(enc && enc.status === 'IN_COMBAT');
  const hasClericPrayer = Boolean(!enc && hero.class === 'CLERIC' && state.clericHealInfo);
  const slot1IsIdleFiller = Boolean(!enc && !state.isSafeCity && !poi && !state.victory);

  slot1.classList.toggle('is-contextual-inactive', slot1IsIdleFiller);
  slot2.classList.toggle('is-contextual-inactive', isStage1);
  slot3.classList.toggle('is-contextual-inactive', isStage1 || isStage2);
  slot4.classList.toggle('is-contextual-inactive', Boolean(!enc && !hasClericPrayer));

  const actionCard = document.getElementById('dm-action-deck-card');
  if (actionCard) {
    actionCard.classList.toggle('has-primary-slot', !slot1IsIdleFiller);
    actionCard.classList.toggle('is-stage1-deck', isStage1);
    actionCard.classList.toggle('is-stage2-deck', isStage2);
  }

  // Contextual Cleric Divine Combat Actions (Phase 7C)
  const divineDeck = document.getElementById('dm-cleric-divine-deck');
  const isClericInStage2 = Boolean(isStage2 && hero.class === 'CLERIC');
  if (divineDeck) {
    divineDeck.hidden = !isClericInStage2;
    if (isClericInStage2) {
      const dcInfo = state.clericDivineChargeInfo || {};
      const currCharges = Number(dcInfo.currentCharges ?? hero.divine_charges ?? 0);
      const maxCharges = Number(dcInfo.maxCharges ?? hero.max_divine_charges ?? 0);
      const shieldTurns = Number(enc.divineShieldTurns || 0);

      const chargesBadge = document.getElementById('deck-divine-charges-badge');
      if (chargesBadge) {
        chargesBadge.textContent = `Charges: ${currCharges} / ${maxCharges}`;
        chargesBadge.classList.toggle('is-depleted', currCharges <= 0);
      }

      const shieldBanner = document.getElementById('deck-divine-shield-banner');
      const shieldTurnsEl = document.getElementById('deck-divine-shield-turns');
      if (shieldBanner) {
        shieldBanner.hidden = shieldTurns <= 0;
        if (shieldTurns > 0 && shieldTurnsEl) {
          shieldTurnsEl.textContent = `${shieldTurns} monster turn${shieldTurns === 1 ? '' : 's'} remaining`;
        }
      }

      const btnPrayer = document.getElementById('action-divine-prayer');
      const subPrayer = document.getElementById('sub-divine-prayer');
      if (btnPrayer) {
        const canPray = currCharges >= 1;
        btnPrayer.disabled = !canPray;
        if (subPrayer) {
          subPrayer.textContent = canPray ? '1 Charge • Strike & Heal' : '1 Charge (0 Left)';
        }
        btnPrayer.title = canPray
          ? 'Battle Prayer (Cost: 1 Divine Charge) — Weapon strike infused with a healing prayer [5]'
          : 'Requires 1 Divine Charge (Rest in a city to recharge)';
      }

      const btnSmite = document.getElementById('action-divine-smite');
      const subSmite = document.getElementById('sub-divine-smite');
      if (btnSmite) {
        const canSmite = currCharges >= 1;
        btnSmite.disabled = !canSmite;
        if (subSmite) {
          subSmite.textContent = canSmite ? '1 Charge • Sacred Light' : '1 Charge (0 Left)';
        }
        btnSmite.title = canSmite
          ? 'Smite (Cost: 1 Divine Charge) — Weapon strike infused with sacred radiant light [6]'
          : 'Requires 1 Divine Charge (Rest in a city to recharge)';
      }

      const btnShield = document.getElementById('action-divine-shield');
      const subShield = document.getElementById('sub-divine-shield');
      if (btnShield) {
        const canShield = currCharges >= 2 && shieldTurns <= 0;
        btnShield.disabled = !canShield;
        if (subShield) {
          if (shieldTurns > 0) {
            subShield.textContent = `Active (${shieldTurns}t left)`;
          } else if (currCharges < 2) {
            subShield.textContent = '2 Charges (Low)';
          } else {
            subShield.textContent = '2 Charges • 2-Turn Ward';
          }
        }
        btnShield.title = shieldTurns > 0
          ? `Divine Shield is already active (${shieldTurns} monster turn${shieldTurns === 1 ? '' : 's'} remaining)`
          : (currCharges >= 2
            ? 'Divine Shield (Cost: 2 Divine Charges) — Radiant barrier reducing incoming damage for 2 monster turns [7]'
            : 'Requires 2 Divine Charges (Rest in a city to recharge)');
      }
    }
  }

  // Highlight Move Forward [W] as Primary Exploration Action when path ahead is open
  const fwdBtn = document.getElementById('pad-forward');
  if (fwdBtn) {
    const canAdvance = Boolean(!enc && relMoves.FORWARD && relMoves.FORWARD.available);
    fwdBtn.classList.toggle('is-primary-move', canAdvance);
  }

  // Sanctuary vs Wilderness Utility Drawer Priority
  const marketBtn = document.getElementById('util-btn-market');
  const boardBtn = document.getElementById('util-btn-board');
  [marketBtn, boardBtn].forEach(btn => {
    if (!btn) return;
    btn.classList.toggle('is-sanctuary-highlight', Boolean(state.isSafeCity));
    btn.classList.toggle('is-town-only-away', !state.isSafeCity);
  });
}
