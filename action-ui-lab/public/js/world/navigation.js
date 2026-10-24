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
      deckHeading.textContent = enc.isAmbush ? '⚠️ Ambush Combat' : '⚔️ Combat Actions';
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

  const dMap = state.dungeonMap;
  const inDungeon = Boolean(dMap && dMap.inDungeon);
  const shCoord = (state.topdownMap && state.topdownMap.strongholdCoord) || { x: 15, y: 2 };
  const isAtStrongholdGate = Boolean(
    !inDungeon &&
    state.topdownMap &&
    !state.topdownMap.bossSlain &&
    (state.topdownMap.atStronghold ||
      (state.currentTile &&
        Number(state.currentTile.x) === Number(shCoord.x) &&
        Number(state.currentTile.y) === Number(shCoord.y)))
  );
  const isAtRavencragCitadel = Boolean(
    !inDungeon &&
    state.topdownMap &&
    !state.topdownMap.highlandBossSlain &&
    state.topdownMap.atRavencragCitadel
  );

  // SLOT 1: Primary Context Action (Attack / Fight Threat / Dungeon Boss or Exit / Stronghold Boss / Highland Boss / Sanctuary Rest / Inspect Landmark / Continue)
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
    document.getElementById('slot1-title').textContent = enc.isAmbush ? 'Face Ambush' : 'Fight';
    document.getElementById('slot1-sub').textContent = 'Engage in Combat';
    slot1.title = 'Step forward and fight the spotted threat [Space / 1]';
  } else if (inDungeon && dMap.atBossTile && !dMap.bossSlain && !state.victory) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '⚔️';
    document.getElementById('slot1-title').textContent = 'Challenge Boss';
    document.getElementById('slot1-sub').textContent = dMap.bossName || 'Dungeon Boss';
    slot1.title = `Challenge ${dMap.bossName || 'the Dungeon Boss'} [Space / 1]`;
  } else if (inDungeon && dMap.atExitTile && !state.victory) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '🪜';
    document.getElementById('slot1-title').textContent = 'Ascend Stairs';
    document.getElementById('slot1-sub').textContent = 'Exit to Overworld';
    slot1.title = 'Ascend the stairs and return to the Overworld [Space / 1]';
  } else if (isAtStrongholdGate && !state.victory) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '⚔️';
    document.getElementById('slot1-title').textContent = 'Challenge Chieftain';
    document.getElementById('slot1-sub').textContent = 'Goblin Stronghold Boss';
    slot1.title = 'Challenge Warchief Grak the Goblin Chieftain at the Stronghold Gates [Space / 1]';
  } else if (isAtRavencragCitadel && !state.victory) {
    slot1.disabled = false;
    document.getElementById('slot1-icon').textContent = '⚔️';
    document.getElementById('slot1-title').textContent = 'Confront Warlord';
    document.getElementById('slot1-sub').textContent = 'Ravencrag Citadel Boss';
    slot1.title = 'Confront Warlord Kraug the Crag-Breaker at Ravencrag Citadel [Space / 1]';
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

  // SLOT 4: Retreat / Avoid / Cleric Prayer
  if (enc && enc.status === 'IN_COMBAT') {
    const isFleeLocked = Boolean(enc.fleeLocked || (enc.isAmbush && Number(enc.combat_round || 1) <= 2));
    const lockedRounds = Number(enc.ambushFleeLockedRoundsRemaining || Math.max(0, 3 - Number(enc.combat_round || 1)));
    if (isFleeLocked) {
      slot4.disabled = true;
      document.getElementById('slot4-icon').textContent = '🔒';
      document.getElementById('slot4-title').textContent = 'Flee Locked';
      document.getElementById('slot4-sub').textContent = `Ambush (${lockedRounds} Rd${lockedRounds === 1 ? '' : 's'} Left)`;
      slot4.title = enc.fleeLockReason || `AMBUSH! Retreat is locked for the first 2 combat rounds (${lockedRounds} round(s) remaining).`;
    } else {
      slot4.disabled = false;
      document.getElementById('slot4-icon').textContent = '🏃';
      document.getElementById('slot4-title').textContent = store.fleeConfirmArmed ? 'Confirm Flee?' : 'Flee Battle';
      document.getElementById('slot4-sub').textContent = store.fleeConfirmArmed ? 'Press [4/F] Again' : 'Provokes AoO';
      slot4.title = 'Attempt to flee combat (monster gets a parting attack of opportunity) [4 / F]';
    }
  } else if (enc && enc.status === 'DISCOVERED') {
    slot4.disabled = Boolean(enc.isAmbush);
    document.getElementById('slot4-icon').textContent = '👣';
    document.getElementById('slot4-title').textContent = 'Avoid';
    document.getElementById('slot4-sub').textContent = enc.isAmbush ? 'Ambush Locked!' : 'Bypass Threat';
    slot4.title = enc.isAmbush
      ? 'Ambush! You cannot avoid — you must face the threat'
      : 'Avoid the spotted monster and continue without combat (grants no XP or loot) [4 / F]';
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
  const isMoveLockedByCombat = Boolean(enc && (enc.status === 'IN_COMBAT' || enc.isAmbush));
  const moveDeck = document.getElementById('dm-movement-deck');
  const navLockBanner = document.getElementById('dm-nav-combat-banner');
  if (moveDeck) {
    moveDeck.classList.toggle('is-combat-locked', isMoveLockedByCombat);
  }
  if (navLockBanner) {
    navLockBanner.hidden = !isMoveLockedByCombat;
    if (isMoveLockedByCombat) {
      if (enc.status === 'IN_COMBAT' && enc.isAmbush && enc.fleeLocked) {
        const rem = Number(enc.ambushFleeLockedRoundsRemaining || Math.max(1, 3 - Number(enc.combat_round || 1)));
        navLockBanner.textContent = `⚠️ AMBUSH! Flee Locked (${rem} Rd${rem === 1 ? '' : 's'} Left)`;
      } else if (enc.isAmbush && enc.status === 'DISCOVERED') {
        navLockBanner.textContent = '⚠️ Ambush! Press [Space / 1] to face the threat';
      } else {
        navLockBanner.textContent = '🔒 Engaged in Melee — Use Flee [4 / F] to retreat';
      }
    }
  }

  document.getElementById('lbl-turn-left').textContent = `Turn`;
  document.getElementById('lbl-turn-right').textContent = `Turn`;
  document.getElementById('lbl-forward').textContent = `North`;
  document.getElementById('lbl-backward').textContent = `South`;
  document.getElementById('lbl-strafe-left').textContent = `West`;
  document.getElementById('lbl-strafe-right').textContent = `East`;

  const isPlayerMode = store.devToolsCollapsed !== false;
  document.getElementById('pad-center-glyph').textContent = isPlayerMode ? '🧭' : fMeta.arrow;
  document.getElementById('pad-center-lbl').textContent = isPlayerMode
    ? (inDungeon ? 'Dungeon' : (state.isSafeCity ? 'Town' : 'Wilds'))
    : (state.currentTile ? `[${state.currentTile.x},${state.currentTile.y}]` : facing);

  const dirs = state.directions || {};
  const mapTiles = (!inDungeon && state.topdownMap && Array.isArray(state.topdownMap.tiles)) ? state.topdownMap.tiles : [];
  const checkCardinalOpen = (cardinal) => {
    const dInfo = dirs[cardinal];
    if (!dInfo || !dInfo.available) return { open: false, name: (dInfo && dInfo.tile && dInfo.tile.name) || 'Blocked', reason: (dInfo && dInfo.reason) || 'Impassable' };
    if (!inDungeon && mapTiles.length > 0 && dInfo.tile) {
      const inRegion = mapTiles.find(t => t.x === dInfo.tile.x && t.y === dInfo.tile.y);
      if (!inRegion || !inRegion.isPassable) {
        return { open: false, name: dInfo.tile.name || 'Forest Edge', reason: 'Dense forest boundary' };
      }
    }
    return { open: true, name: (dInfo.tile && dInfo.tile.name) || dInfo.tileName || cardinal, reason: null };
  };

  const padCardinalMap = [
    { id: 'pad-forward', dir: 'NORTH', label: 'Move North' },
    { id: 'pad-backward', dir: 'SOUTH', label: 'Move South' },
    { id: 'pad-strafe-left', dir: 'WEST', label: 'Move West' },
    { id: 'pad-strafe-right', dir: 'EAST', label: 'Move East' }
  ];

  padCardinalMap.forEach(({ id, dir, label }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const cInfo = checkCardinalOpen(dir);
    const canStep = !isMoveLockedByCombat && cInfo.open;
    btn.classList.toggle('is-blocked-dir', !canStep);
    if (isMoveLockedByCombat) {
      btn.title = enc.isAmbush
        ? 'Ambush! You cannot move away without facing the threat'
        : 'Locked in melee combat — use Flee [4/F] to retreat';
    } else {
      btn.title = cInfo.open
        ? `${label} (${dir}): ${cInfo.name}${enc && enc.status === 'DISCOVERED' ? ' (Avoids threat)' : ''}`
        : `Blocked (${dir}): ${cInfo.name}`;
    }
  });

  // Update Single Pack Counter & Quest Status Indicator
  const packLbl = document.getElementById('util-pack-lbl');
  if (packLbl) {
    packLbl.textContent = `Inventory (${state.inventory.length})`;
  }
  const questsLbl = document.getElementById('util-quests-lbl');
  if (questsLbl) {
    const q = state.quest || {};
    const activeCount = (q.status === 'ACTIVE' ? 1 : 0) + (state.activeContract ? 1 : 0);
    if (q.status === 'COMPLETED') {
      questsLbl.textContent = 'Quests (!)';
    } else if (activeCount > 0) {
      questsLbl.textContent = `Quests (${activeCount})`;
    } else {
      questsLbl.textContent = 'Quests';
    }
  }

  // Contextual slot visibility & primary action emphasis (Phase 4 Player-First UI)
  const isStage1 = Boolean(enc && enc.status === 'DISCOVERED');
  const isStage2 = Boolean(enc && enc.status === 'IN_COMBAT');
  const hasClericPrayer = Boolean(!enc && hero.class === 'CLERIC' && state.clericHealInfo);
  const slot1IsIdleFiller = Boolean(!enc && !state.isSafeCity && !poi && !state.victory && !isAtStrongholdGate);

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

  // Highlight Move North [W] as Primary Exploration Action when northern path is open
  const fwdBtn = document.getElementById('pad-forward');
  if (fwdBtn) {
    const canAdvance = Boolean(!enc && checkCardinalOpen('NORTH').open);
    fwdBtn.classList.toggle('is-primary-move', canAdvance);
  }

  // Sanctuary vs Wilderness Utility Drawer Priority (Shop only visible in Oakhaven)
  const marketBtn = document.getElementById('util-btn-market');
  const boardBtn = document.getElementById('util-btn-board');
  if (marketBtn) {
    marketBtn.hidden = !state.isSafeCity;
    marketBtn.classList.toggle('is-sanctuary-highlight', Boolean(state.isSafeCity));
    marketBtn.classList.toggle('is-town-only-away', !state.isSafeCity);
  }
  if (boardBtn) {
    boardBtn.classList.toggle('is-sanctuary-highlight', Boolean(state.isSafeCity));
    boardBtn.classList.remove('is-town-only-away');
  }
}
