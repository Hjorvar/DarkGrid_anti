/**
 * DARKGRID ADVENTURE LAB — Combat Actor Presentation, Cutout Rig & Tactical Slot Handlers (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';
import { escapeHtml, getConditionColor } from '../ui/utils.js';
import { dispatchAction, triggerInspectPoi } from '../api/client.js';
import { computeClientMonsterVisualScale } from './size-arena.js';

function renderViewportCenterStage(state) {
  return uiCallbacks.renderViewportCenterStage(state);
}
function renderActionDeckAndPad(state) {
  return uiCallbacks.renderActionDeckAndPad(state);
}

export function normalizeMonsterPresenceMode(mode) {
  const raw = String(mode || 'card').toLowerCase().trim();
  if (raw === 'hybrid' || raw === 'card' || raw === 'default') return 'card';
  if (raw === 'integrated' || raw === 'cutout' || raw === 'in-scene') return 'integrated';
  if (raw === 'blend') return 'blend';
  if (raw === 'framed' || raw === 'frame') return 'framed';
  return 'card';
}

export function setMonsterPresenceMode(mode) {
  const norm = normalizeMonsterPresenceMode(mode);
  store.currentPresenceMode = norm;
  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.remove(
      'presence-mode-card',
      'presence-mode-hybrid',
      'presence-mode-integrated',
      'presence-mode-blend',
      'presence-mode-framed'
    );
    vp.classList.add('presence-mode-' + norm);
    if (norm === 'card') {
      vp.classList.add('presence-mode-hybrid');
    }
  }
  ['card', 'integrated', 'blend', 'framed'].forEach(m => {
    const btn = document.getElementById('blend-btn-' + m);
    if (btn) btn.classList.toggle('is-active', m === norm);
  });

  if (store.currentState && store.currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(store.currentState);
  }
}

export function handleMonsterImageError(imgEl) {
  if (!imgEl || imgEl.dataset.fallbackApplied === 'true') return;
  const fallbackSrc = imgEl.getAttribute('data-fallback-src');
  if (!fallbackSrc || imgEl.getAttribute('src') === fallbackSrc) return;
  imgEl.dataset.fallbackApplied = 'true';
  imgEl.dataset.presentation = 'card';
  imgEl.setAttribute('src', fallbackSrc);
  const actor = imgEl.closest('#fp-monster-actor');
  if (actor) {
    actor.classList.remove('is-integrated-monster');
    actor.classList.add('is-card-monster');
    const rig = actor.querySelector('.fp-integrated-grounding-rig');
    if (rig) rig.style.display = 'none';
  }
  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.remove('is-effective-integrated');
    vp.classList.add('is-effective-card');
  }
}

export function resolveEnvironmentLightingGroup(state) {
  const mode = (state && state.sceneMode) || store.currentSceneMode || 'C';
  const scene = state && state.viewportScene;
  const activeScene = (scene && scene.scenes && scene.scenes[mode]) || (scene && scene.activeScene) || {};
  const atmo = String(activeScene.atmosphereProfile || '').toLowerCase();
  const terrain = String((state && state.currentTile && state.currentTile.terrain) || '').toUpperCase();

  if (atmo.includes('bridge') || atmo.includes('water') || terrain === 'BRIDGE') {
    return 'bridge';
  }
  if (atmo.includes('forest') || atmo.includes('oak') || atmo.includes('swamp') || atmo.includes('jungle') || terrain === 'FOREST') {
    return 'forest';
  }
  if (atmo.includes('sanctuary') || atmo.includes('gatehouse') || terrain === 'CITY') {
    return 'sanctuary';
  }
  return 'wilderness';
}

export function buildCombatMonsterActorHtml(monster, state, { isSequenceFrame = false, initBracket = null, initCondText = null } = {}) {
  const bracketKey = initBracket || monster.conditionBracket || '5_uninjured';
  const condText = initCondText !== null ? initCondText : (monster.conditionText || '');
  const gemColor = getConditionColor(bracketKey);
  const isRanged = Boolean(state && state.combatStats && state.combatStats.isRangedActive);
  const weaponName = (state && state.combatStats && state.combatStats.activeWeapon && state.combatStats.activeWeapon.name) || 'Weapon';

  const wantsIntegrated = store.currentPresenceMode === 'integrated';
  const canUseIntegrated = Boolean(monster && monster.hasIntegratedCutout && monster.cutoutImageUrl);
  const isEffectiveIntegrated = wantsIntegrated && canUseIntegrated;
  const didFallbackToCard = wantsIntegrated && !canUseIntegrated;

  const vp = document.getElementById('fp-viewport');
  const envGroup = resolveEnvironmentLightingGroup(state);
  if (vp) {
    vp.classList.toggle('is-effective-integrated', isEffectiveIntegrated);
    vp.classList.toggle('is-effective-card', !isEffectiveIntegrated);
    vp.classList.remove('env-light-bridge', 'env-light-forest', 'env-light-sanctuary', 'env-light-wilderness');
    vp.classList.add(`env-light-${envGroup}`);
  }

  const profile = (monster && monster.integratedProfile) || {};
  const groundingMode = String(profile.groundingMode || (monster && monster.isAirborne ? 'AIRBORNE_HOVER' : 'GROUNDED')).toLowerCase();
  const sizeCategory = String(profile.sizeCategory || 'MEDIUM').toLowerCase();
  const scaleMult = Number(profile.scaleMultiplier || 1.0);
  const verticalOffsetPx = Number(profile.verticalOffsetPx || 0);
  const shadowWidthPct = Number(profile.shadowWidthPct || 72);
  const shadowBlurPx = Number(profile.shadowBlurPx || 9);
  const shadowOpacity = Number(profile.shadowOpacity || 0.64);

  const mode = (state && state.sceneMode) || store.currentSceneMode || 'C';
  const scene = state && state.viewportScene;
  const activeScene = (scene && scene.scenes && scene.scenes[mode]) || (scene && scene.activeScene) || {};
  const stageAnchor = activeScene.stageAnchor || {};
  const stageCenterX = typeof stageAnchor.stageCenterX === 'number' ? stageAnchor.stageCenterX : 50;
  const stageShiftX = Number((stageCenterX - 50).toFixed(1));
  const stageFloorY = typeof stageAnchor.stageFloorY === 'number' ? stageAnchor.stageFloorY : 82;
  const groundSurfaceType = stageAnchor.groundSurfaceType || 'wilderness-soil';
  const groundShadowTint = stageAnchor.groundShadowTint || 'rgba(8, 10, 12, 0.72)';

  const imgSrc = isEffectiveIntegrated
    ? monster.cutoutImageUrl
    : (monster.imageUrl || '/images/monsters/assassin_vine.png');

  const strikeSvg = isRanged
    ? `<svg id="fp-slash-svg" class="slash-svg" viewBox="0 0 200 200">
         <circle cx="100" cy="100" r="46" fill="none" stroke="#e6be6e" stroke-width="3" stroke-dasharray="10 6"/>
         <line x1="25" y1="175" x2="115" y2="85" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
         <polygon points="122,78 98,86 114,102" fill="#e6be6e"/>
       </svg>`
    : `<svg id="fp-slash-svg" class="slash-svg" viewBox="0 0 200 200">
         <path d="M 25 165 Q 95 85 178 28" fill="none" stroke="#c5a059" stroke-width="10" stroke-linecap="round" opacity="0.65"/>
         <path d="M 30 160 Q 100 90 175 32" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
       </svg>`;

  const adaptive = computeClientMonsterVisualScale(monster, state, isEffectiveIntegrated);
  const useAdaptiveScale = store.currentMonsterScaleMode === 'adaptive' && Boolean(adaptive);
  const pfSizeClass = adaptive ? `pf-size-${String(adaptive.pfSizeCategory || 'MEDIUM').toLowerCase()}` : 'pf-size-medium';
  const bodyProfClass = adaptive ? `profile-${String(adaptive.visualBodyProfile || 'BIPED_MEDIUM').toLowerCase()}` : 'profile-biped_medium';

  const actorClasses = [
    'fp-monster-actor',
    isEffectiveIntegrated ? 'is-integrated-monster' : 'is-card-monster',
    useAdaptiveScale ? 'is-adaptive-scale' : 'is-legacy-scale',
    `grounding-${groundingMode}`,
    `size-${sizeCategory}`,
    pfSizeClass,
    bodyProfClass,
    `env-grade-${envGroup}`,
    `surface-${groundSurfaceType}`
  ].join(' ');

  const effVisW = adaptive ? adaptive.visibleWidthPx : 220;
  const effVisH = adaptive ? adaptive.visibleHeightPx : 220;
  const trimScale = adaptive ? adaptive.transparencyCompensation.imageTrimScale : 1;
  const shiftXPct = adaptive ? adaptive.transparencyCompensation.imageShiftXPct : 0;
  const shiftYPct = adaptive ? adaptive.transparencyCompensation.imageShiftYPct : 0;
  const effShadowW = adaptive ? adaptive.shadow.shadowWidthPct : shadowWidthPct;
  const effShadowBlur = adaptive ? adaptive.shadow.shadowBlurPx : shadowBlurPx;
  const effShadowOp = adaptive ? adaptive.shadow.shadowOpacity : shadowOpacity;
  const effShadowWPx = adaptive ? adaptive.shadow.shadowWidthPx : 220;
  const effShadowHPx = adaptive ? adaptive.shadow.shadowHeightPx : 24;
  const effOffsetY = isEffectiveIntegrated
    ? verticalOffsetPx
    : (adaptive ? adaptive.positioning.verticalOffsetPx : 0);

  const distTr = (monster && monster.distanceTransition) || null;
  const approachVars = distTr && distTr.cssVars
    ? ` --approach-start-scale:${distTr.cssVars['--approach-start-scale'] || 0.6}; --approach-start-y:${distTr.cssVars['--approach-start-y'] || '-24px'}; --approach-duration:${distTr.cssVars['--approach-duration'] || '440ms'};`
    : '';
  const inlineVars = useAdaptiveScale
    ? `--monster-vis-w:${effVisW}px; --monster-vis-h:${effVisH}px; --monster-img-trim-scale:${trimScale}; --monster-img-shift-x:${shiftXPct}%; --monster-img-shift-y:${shiftYPct}%; --monster-scale:1; --monster-offset-y:${effOffsetY}px; --stage-shift-x:${stageShiftX}%; --stage-floor-y:${stageFloorY}%; --shadow-width:${effShadowW}%; --shadow-width-px:${effShadowWPx}px; --shadow-height-px:${effShadowHPx}px; --shadow-blur:${effShadowBlur}px; --shadow-opacity:${effShadowOp}; --ground-shadow-tint:${groundShadowTint};${approachVars}`
    : (isEffectiveIntegrated
      ? `--monster-scale:${scaleMult}; --monster-offset-y:${verticalOffsetPx}px; --stage-shift-x:${stageShiftX}%; --stage-floor-y:${stageFloorY}%; --shadow-width:${shadowWidthPct}%; --shadow-blur:${shadowBlurPx}px; --shadow-opacity:${shadowOpacity}; --ground-shadow-tint:${groundShadowTint};${approachVars}`
      : '');

  let integratedRigHtml = '';
  if (isEffectiveIntegrated) {
    const amb = profile.ambientPatch || {
      leftPct: 50,
      topPct: monster.isAirborne ? 115 : 93,
      widthPct: shadowWidthPct,
      heightPct: 12,
      rotateDeg: 0,
      blurPx: shadowBlurPx,
      opacity: shadowOpacity * 0.65
    };
    const contacts = Array.isArray(profile.contactPatches) ? profile.contactPatches : [];
    const contactsHtml = contacts.map(cp => `
      <span class="fp-rig-contact-patch"
            data-contact-id="${escapeHtml(cp.id || 'pt')}"
            style="left:${Number(cp.leftPct || 50)}%; top:${Number(cp.topPct || 95)}%; width:${Number(cp.widthPct || 18)}%; height:${Number(cp.heightPct || 5.5)}%; transform:translate(-50%, -50%) rotate(${Number(cp.rotateDeg || 0)}deg); filter:blur(${Number(cp.blurPx || 3)}px); opacity:${Number(cp.opacity || 0.76)};"></span>
    `).join('');

    integratedRigHtml = `
      <div class="fp-integrated-grounding-rig surface-${escapeHtml(groundSurfaceType)}" aria-hidden="true">
        <span class="fp-rig-ambient-patch"
              style="left:${Number(amb.leftPct)}%; top:${Number(amb.topPct)}%; width:${Number(amb.widthPct)}%; height:${Number(amb.heightPct)}%; transform:translate(-50%, -50%) rotate(${Number(amb.rotateDeg || 0)}deg); filter:blur(${Number(amb.blurPx || 8)}px); opacity:${Number(amb.opacity || 0.44)};"></span>
        ${contactsHtml}
      </div>
    `;
  }

  const modeBadgeHtml = isEffectiveIntegrated
    ? `<span class="lab-badge badge-integrated-active dev-only-badge" title="Rendered in-scene with alpha cutout, anatomical ground contact shadows & environment lighting">✦ In-Scene Cutout</span>`
    : (didFallbackToCard
      ? `<span class="lab-badge badge-card-fallback dev-only-badge" title="No cutout asset found for this creature — safely fell back to Card mode">🛡️ Card Fallback</span>`
      : '');

  const bracketLabelMap = {
    '5_uninjured': 'Uninjured',
    '6_barely_wounded': 'Barely Wounded',
    '7_wounded': 'Wounded',
    '8_badly_wounded': 'Badly Wounded',
    '9_near_death': 'Near Death',
    '4_bruised': 'Bruised',
    '3_wounded': 'Bloodied',
    '2_critical': 'Grievously Wounded',
    '1_near_death': 'Near Death'
  };
  const bracketLabel = bracketLabelMap[bracketKey] || 'Engaged';
  const roundNum = Number(monster.combat_round || 1);
  const atkBonus = isRanged
    ? ((state && state.combatStats && state.combatStats.rangedAttackBonus) || '+0')
    : ((state && state.combatStats && state.combatStats.meleeAttackBonus) || '+0');

  const conditionBlockHtml = isSequenceFrame
    ? `<div class="fp-monster-condition-quote" id="seq-condition-quote">
         <span class="condition-gem" id="seq-condition-gem" style="background:${gemColor}; color:${gemColor};"></span>
         <span id="seq-condition-text">“${escapeHtml(condText || 'Engaged in melee!')}”</span>
       </div>`
    : (condText ? `
       <div class="fp-monster-condition-quote">
         <span class="condition-gem" style="background:${gemColor}; color:${gemColor};"></span>
         <span>“${escapeHtml(condText)}”</span>
       </div>
    ` : '');

  const seq = state && state.combatSequence;
  let exchangeSummaryText = `⚡ Engaged at melee range — press [Space] or click creature to strike`;
  let exchangeSummaryClass = 'exchange-neutral';
  if (!isSequenceFrame && seq && Array.isArray(seq.beats) && seq.beats.length > 0) {
    const heroBeat = seq.beats.find(b => b.actor === 'HERO');
    const monsterBeat = seq.beats.find(b => b.actor === 'MONSTER');
    const parts = [];
    if (heroBeat) {
      if (heroBeat.outcome === 'SHIELD') {
        parts.push(`🛡️ Radiant barrier invoked (2 turns)`);
        exchangeSummaryClass = 'exchange-hit';
      } else if (heroBeat.outcome === 'CRIT') {
        parts.push(`💥 Critical Hit (${escapeHtml(heroBeat.popupLabel || 'Crit!')})`);
        exchangeSummaryClass = 'exchange-crit';
      } else if (heroBeat.outcome === 'HIT') {
        parts.push(`⚔️ You hit (${escapeHtml(heroBeat.popupLabel || 'Hit!')})`);
        exchangeSummaryClass = 'exchange-hit';
      } else if (heroBeat.outcome === 'MISS') {
        parts.push(`💨 Your attack missed`);
        exchangeSummaryClass = 'exchange-miss';
      } else if (heroBeat.outcome === 'HEAL') {
        parts.push(`🧪 Restored ${escapeHtml(heroBeat.popupLabel || 'HP')}`);
        exchangeSummaryClass = 'exchange-hit';
      } else if (heroBeat.outcome === 'FLEE') {
        parts.push(`🏃 Retreat attempt failed`);
        exchangeSummaryClass = 'exchange-damage';
      }
    }
    if (monsterBeat) {
      if (monsterBeat.outcome === 'HIT' && monsterBeat.hpDelta > 0) {
        parts.push(`🩸 Enemy dealt ${monsterBeat.hpDelta} dmg`);
        if (exchangeSummaryClass === 'exchange-miss') exchangeSummaryClass = 'exchange-damage';
      } else if (monsterBeat.outcome === 'HIT' && monsterBeat.hpDelta === 0) {
        parts.push(`🛡️ Divine Shield absorbed the blow`);
      } else if (monsterBeat.outcome === 'MISS') {
        parts.push(`🛡️ Evaded counterattack`);
      }
    }
    if (parts.length > 0) {
      exchangeSummaryText = parts.join(' • ');
    }
  }

  const exchangeBannerHtml = `
    <div class="fp-combat-exchange-banner ${exchangeSummaryClass} ${exchangeSummaryClass === 'exchange-neutral' ? 'is-initial-exchange' : ''}" id="seq-exchange-banner">
      ${exchangeSummaryText}
    </div>
  `;

  const hero = state && state.character;
  const swChipHtml = (hero && hero.class === 'FIGHTER' && Number(hero.level || 1) >= 3)
    ? `<span class="fp-tactical-chip" style="color:${monster.secondWindUsed ? '#94a3b8' : '#86efac'};">🛡️ Second Wind: ${monster.secondWindUsed ? 'Spent' : 'Ready'}</span>`
    : '';
  const dcInfo = (state && state.clericDivineChargeInfo) || {};
  const currCharges = Number(dcInfo.currentCharges ?? (hero && hero.divine_charges) ?? 0);
  const maxCharges = Number(dcInfo.maxCharges ?? (hero && hero.max_divine_charges) ?? 0);
  const shieldTurns = Number((monster && monster.divineShieldTurns) || 0);
  const clericChipHtml = (hero && hero.class === 'CLERIC')
    ? `<span class="fp-tactical-chip" id="seq-divine-charges-chip" style="color:${currCharges > 0 ? '#fde68a' : '#94a3b8'};">✨ Charges: ${currCharges}/${maxCharges}</span>${shieldTurns > 0 ? `<span class="fp-tactical-chip" id="seq-divine-shield-chip" style="color:#bae6fd; border-color:rgba(56,189,248,0.55);">🛡️ Shield (${shieldTurns}t)</span>` : ''}`
    : '';

  const knowledgeBadges = (monster && monster.monsterKnowledge && Array.isArray(monster.monsterKnowledge.badges))
    ? monster.monsterKnowledge.badges
    : [];
  const knowledgeBadgesHtml = knowledgeBadges.length > 0
    ? knowledgeBadges.map(b => `<span class="lab-badge" style="border-color:rgba(197,160,89,0.5); color:#fde68a;" title="Passive Tactical & Battle Experience Insight">📖 ${escapeHtml(b)}</span>`).join('')
    : '';

  const tacticalReadoutHtml = `
    <div class="fp-combat-tactical-strip">
      <span class="fp-tactical-chip">⚔️ Round ${roundNum}</span>
      <span class="fp-tactical-chip" id="seq-condition-badge" style="color:${gemColor}; border-color:${gemColor}55;">● ${escapeHtml(bracketLabel)}</span>
      ${swChipHtml}${clericChipHtml}
      <span class="fp-tactical-chip fp-tactical-hint">${isRanged ? '🏹' : '🗡️'} ${escapeHtml(weaponName)} (${escapeHtml(String(atkBonus))}) • [Space] Strike</span>
    </div>
  `;

  const pfSizeBadgeHtml = adaptive
    ? `<span class="lab-badge badge-pf-size" title="Threat Scale: ${escapeHtml(adaptive.pfSizeLabel)} (${adaptive.pfSpaceFt} ft space)">📏 ${escapeHtml(adaptive.pfSizeLabel)}</span>`
    : '';

  const techScaleBadgeHtml = adaptive
    ? `<span class="sizelab-tech-tag dev-only-badge" id="monster-tech-dims" title="Dev Telemetry — Profile: ${escapeHtml(adaptive.visualBodyProfileLabel || adaptive.visualBodyProfile)} • Visible Box: ${adaptive.visibleWidthPx}×${adaptive.visibleHeightPx}px • Trim ×${adaptive.transparencyCompensation.imageTrimScale}">${adaptive.visibleWidthPx}×${adaptive.visibleHeightPx}px • ×${adaptive.transparencyCompensation.imageTrimScale}</span>`
    : '';

  return `
    <div class="${actorClasses}" id="fp-monster-actor" data-pf-size="${escapeHtml(adaptive ? adaptive.pfSizeCategory : 'MEDIUM')}" data-body-profile="${escapeHtml(adaptive ? adaptive.visualBodyProfile : 'BIPED_MEDIUM')}" data-vis-w="${effVisW}" data-vis-h="${effVisH}" data-ground-surface="${escapeHtml(groundSurfaceType)}" data-stage-floor-y="${stageFloorY}" style="${inlineVars}" onclick="handleMonsterActorClick()" title="Click creature or press [Space / 1] to strike with ${escapeHtml(weaponName)}!">
      <div class="fp-monster-stage-figure">
        <div class="fp-monster-portrait-box">
          <span class="fp-corner-bracket tl"></span>
          <span class="fp-corner-bracket tr"></span>
          <span class="fp-corner-bracket bl"></span>
          <span class="fp-corner-bracket br"></span>
          ${integratedRigHtml}
          <img src="${escapeHtml(imgSrc)}" data-fallback-src="${escapeHtml(monster.imageUrl || '/images/monsters/assassin_vine.png')}" onerror="handleMonsterImageError(this)" alt="${escapeHtml(monster.monsterName || 'Monster')}" class="fp-monster-img" data-presentation="${isEffectiveIntegrated ? 'integrated' : 'card'}">
          <div class="fp-combat-fx-layer">${strikeSvg}</div>
        </div>
        <div class="fp-monster-ground-shadow" aria-hidden="true">
          <div class="fp-shadow-ambient"></div>
          <div class="fp-shadow-contact"></div>
          <div class="fp-shadow-mist-wisp"></div>
        </div>
      </div>

      <div class="fp-monster-hud-plate">
        ${monster.isAmbush ? (
          (monster.fleeLocked || roundNum <= 2)
            ? `<div class="fp-ambush-banner is-flee-locked" id="combat-ambush-banner">⚠️ <strong>AMBUSH!</strong> Caught off guard — Retreat is locked for ${monster.ambushFleeLockedRoundsRemaining || Math.max(1, 3 - roundNum)} more round${(monster.ambushFleeLockedRoundsRemaining || Math.max(1, 3 - roundNum)) === 1 ? '' : 's'} (Round ${roundNum}/2)!</div>`
            : `<div class="fp-ambush-banner is-flee-unlocked" id="combat-ambush-banner">⚡ <strong>AMBUSH SURVIVED (Round ${roundNum})</strong> — Retreat path is now open [4 / F]!</div>`
        ) : ''}
        <div class="fp-monster-title-row">
          <span style="color: ${escapeHtml(monster.monsterColor || '#c5a059')}; font-family: var(--font-mono);">[${escapeHtml(monster.monsterSymbol || 'M')}]</span>
          <span>${escapeHtml(monster.monsterName || 'Enemy')}</span>
          ${pfSizeBadgeHtml}
          ${monster.isBountyTarget ? '<span class="lab-badge" style="border-color:#ef4444; color:#fca5a5;">🎯 Quarry</span>' : ''}
          ${monster.isAirborne ? '<span class="lab-badge">🦅 Airborne</span>' : ''}
          ${knowledgeBadgesHtml}
          ${modeBadgeHtml}
          ${techScaleBadgeHtml}
        </div>
        ${conditionBlockHtml}
        ${exchangeBannerHtml}
        ${tacticalReadoutHtml}
      </div>
    </div>
  `;
}

export function handleMonsterActorClick() {
  if (!store.currentState) return;
  const enc = store.currentState.encounter;
  if (enc && enc.status === 'IN_COMBAT') {
    dispatchAction('ATTACK');
  }
}

export function handleSlot1Click() {
  if (!store.currentState) return;
  const enc = store.currentState.encounter;
  const tile = store.currentState.currentTile;
  const mapData = store.currentState.topdownMap;
  const shCoord = (mapData && mapData.strongholdCoord) || { x: 7, y: 1 };
  const isAtStrongholdGate = Boolean(
    mapData &&
    !mapData.bossSlain &&
    (mapData.atStronghold ||
      (tile && Number(tile.x) === Number(shCoord.x) && Number(tile.y) === Number(shCoord.y)))
  );

  if (enc && enc.status === 'IN_COMBAT') {
    dispatchAction('ATTACK');
  } else if (enc && enc.status === 'DISCOVERED') {
    dispatchAction('INVESTIGATE');
  } else if (store.currentState.victory) {
    dispatchAction('DISMISS_VICTORY');
  } else if (isAtStrongholdGate) {
    dispatchAction('ENGAGE_STRONGHOLD_BOSS');
  } else if (store.currentState.isSafeCity) {
    dispatchAction('REST');
  } else if (store.currentState.viewportScene && store.currentState.viewportScene.pointOfInterest) {
    triggerInspectPoi();
  }
}

export function handleSlot2Click() {
  if (!store.currentState) return;
  dispatchAction('POTION');
}

export function handleSlot3Click() {
  if (!store.currentState || store.currentState.encounter) return;
  dispatchAction('STANCE');
}

export function handleSlot4Click() {
  if (!store.currentState) return;
  const enc = store.currentState.encounter;
  if (enc && enc.status === 'IN_COMBAT') {
    if (enc.fleeLocked || (enc.isAmbush && Number(enc.combat_round || 1) <= 2)) {
      dispatchAction('FLEE');
      return;
    }
    if (!store.fleeConfirmArmed) {
      store.fleeConfirmArmed = true;
      renderActionDeckAndPad(store.currentState);
      clearTimeout(store.fleeConfirmTimer);
      store.fleeConfirmTimer = setTimeout(() => {
        store.fleeConfirmArmed = false;
        if (store.currentState) renderActionDeckAndPad(store.currentState);
      }, 3500);
      return;
    }
    store.fleeConfirmArmed = false;
    dispatchAction('FLEE');
  } else if (enc && enc.status === 'DISCOVERED' && !enc.isAmbush) {
    dispatchAction('AVOID');
  } else if (!enc && store.currentState.character.class === 'CLERIC') {
    dispatchAction('CLERIC_HEAL');
  }
}

export function handleBattlePrayerClick() {
  if (!store.currentState) return;
  const enc = store.currentState.encounter;
  const hero = store.currentState.character;
  if (enc && enc.status === 'IN_COMBAT' && hero && hero.class === 'CLERIC') {
    dispatchAction('BATTLE_PRAYER');
  }
}

export function handleSmiteClick() {
  if (!store.currentState) return;
  const enc = store.currentState.encounter;
  const hero = store.currentState.character;
  if (enc && enc.status === 'IN_COMBAT' && hero && hero.class === 'CLERIC') {
    dispatchAction('SMITE');
  }
}

export function handleDivineShieldClick() {
  if (!store.currentState) return;
  const enc = store.currentState.encounter;
  const hero = store.currentState.character;
  if (enc && enc.status === 'IN_COMBAT' && hero && hero.class === 'CLERIC') {
    dispatchAction('DIVINE_SHIELD');
  }
}

export function renderFallenScreen(state) {
  const stage = document.getElementById('fp-center-stage');
  if (!stage) return;
  const labAllowed = state.labToolsAllowed !== false;
  const quickAction = labAllowed ? 'REVIVE' : 'CREATE_CHARACTER';

  if (state.mode === 'UNAUTHENTICATED') {
    stage.innerHTML = `
      <div class="fp-threat-whisper-plate" style="border-color: var(--accent-gold); max-width: 540px; padding: 18px 24px;">
        <div style="font-size: 2rem; margin-bottom: 4px;">🔐</div>
        <div style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--accent-gold-bright); font-weight: 800;">
          AUTHENTICATION REQUIRED
        </div>
        <p style="font-size: 0.84rem; color: var(--text-body); margin: 8px 0;">
          Sign in or register an account to enter Oakhaven Sanctuary and forge your champion.
        </p>
        <div style="display: flex; justify-content: center; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
          <button type="button" class="btn-action-gold" onclick="openLabModal('account')">
            🔐 Sign In or Register Account
          </button>
        </div>
      </div>
    `;
    return;
  }

  if (state.mode === 'NO_CHARACTER') {
    const uName = state.currentUser ? state.currentUser.username : 'Adventurer';
    stage.innerHTML = `
      <div class="fp-threat-whisper-plate" style="border-color: var(--accent-gold); max-width: 540px; padding: 18px 24px;">
        <div style="font-size: 2rem; margin-bottom: 4px;">⚒️</div>
        <div style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--accent-gold-bright); font-weight: 800;">
          WELCOME, ${escapeHtml(uName.toUpperCase())}
        </div>
        <p style="font-size: 0.84rem; color: var(--text-body); margin: 8px 0;">
          No living champion currently walks the realm under your banner. Forge a custom hero with the 72-point attribute creator or rise with a canonical class preset.
        </p>
        <div style="display: flex; justify-content: center; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
          <button type="button" class="btn-action-gold" onclick="openLabModal('account')">
            ⚒️ Open Hero Forge & Account
          </button>
          <button type="button" class="btn-action-stone" onclick="dispatchAction('${quickAction}', { classType: 'FIGHTER', useClassDefaults: true })">
            ⚔️ Quick Start (Fighter)
          </button>
        </div>
      </div>
    `;
    return;
  }

  const fallen = state.fallen || { name: 'Fallen Hero', class: 'FIGHTER', level: 1, killer_name: 'a lurker in the dark' };
  const events = Array.isArray(state.combatEvents) ? state.combatEvents.slice(-5) : [];
  const finalLogHtml = events.length > 0
    ? `
      <div style="margin-top:8px; padding:6px 10px; background:rgba(10,12,18,0.82); border:1px solid var(--border-iron); border-radius:4px; text-align:left; max-height:95px; overflow-y:auto;">
        <div style="font-size:0.68rem; color:var(--accent-gold); font-family:var(--font-serif); font-weight:700; margin-bottom:3px;">📜 Final Battle Chronicle</div>
        ${events.map(ev => `<div style="font-size:0.71rem; color:var(--text-muted); line-height:1.35;">• ${escapeHtml(ev.public_text)}</div>`).join('')}
      </div>
    `
    : '';

  stage.innerHTML = `
    <div class="fp-threat-whisper-plate" style="border-color: var(--accent-crimson-bright); max-width: 560px; padding: 18px 24px;">
      <div style="font-size: 2.2rem; margin-bottom: 4px;">💀</div>
      <div style="font-family: var(--font-serif); font-size: 1.2rem; color: #fca5a5; font-weight: 800;">
        YOU HAVE FALLEN IN BATTLE
      </div>
      <p style="font-size: 0.85rem; color: var(--text-body); margin: 6px 0;">
        <strong>${escapeHtml(fallen.name)}</strong> (${escapeHtml(fallen.class)} • Level ${fallen.level}) was slain by <strong>${escapeHtml(fallen.killer_name || 'an unknown horror')}</strong>${fallen.tile_name ? ` at <strong>${escapeHtml(fallen.tile_name)}</strong>` : ''}.
      </p>
      <div style="font-size:0.74rem; color:var(--text-muted); font-family:var(--font-mono);">
        Final Record: ${Number(fallen.xp || 0)} XP • ${Number(fallen.gold || 0)} Gold (Claimed by the survivor)
      </div>
      ${finalLogHtml}
      <div style="display: flex; justify-content: center; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
        <button type="button" class="btn-action-gold" onclick="openLabModal('account')">
          ⚒️ Forge Custom Hero
        </button>
        <button type="button" class="btn-action-gold" onclick="dispatchAction('${quickAction}', { classType: 'FIGHTER', useClassDefaults: true })">
          ⚔️ Rise Again (Fighter)
        </button>
        <button type="button" class="btn-action-stone" onclick="dispatchAction('${quickAction}', { classType: 'RANGER', useClassDefaults: true })">
          🏹 Rise Again (Ranger)
        </button>
        <button type="button" class="btn-action-stone" onclick="dispatchAction('${quickAction}', { classType: 'CLERIC', useClassDefaults: true })">
          ✨ Rise Again (Cleric)
        </button>
      </div>
    </div>
  `;
}
