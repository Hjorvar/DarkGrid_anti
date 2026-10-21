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

  const slot1 = document.getElementById('action-slot-1');
  const slot2 = document.getElementById('action-slot-2');
  const slot3 = document.getElementById('action-slot-3');
  const slot4 = document.getElementById('action-slot-4');

  // SLOT 1: Primary Context Action (Attack / Engage Threat / Sanctuary Rest / Inspect Landmark)
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
    document.getElementById('slot1-sub').textContent = hero.current_hp < hero.max_hp ? 'Restore Full HP' : 'Full Vitality';
    slot1.title = 'Rest at Oakhaven Sanctuary to restore full HP and Cleric prayers [Space / 1]';
  } else if (poi && !state.victory) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '🔍';
    document.getElementById('slot1-title').textContent = poi.shortPrompt || 'Inspect Landmark';
    document.getElementById('slot1-sub').textContent = poi.title || 'Examine Lore [I]';
    slot1.title = `Inspect ${poi.title || 'Landmark'} [Space / 1 / I]`;
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
}
