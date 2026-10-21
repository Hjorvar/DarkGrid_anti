/**
 * DARKGRID ADVENTURE LAB — First-Person Scene Renderer, Crossfade & Center Stage (ES Module)
 */
import { store, FACING_META } from '../state/store.js';
import { escapeHtml, isReducedMotionPreferred, seededUnit, sanitizePlayerContinuityText, buildRevisitBadgeHtml } from '../ui/utils.js';
import { syncAtmosphericEffects, stopAtmosphericParticleLoop } from './atmosphere.js';
import { applyFlankClass, buildMapConnectedSceneSvg } from './legacy-svg.js';
import { buildSizeComparisonArenaHtml } from '../combat/size-arena.js';
import { buildCombatMonsterActorHtml } from '../combat/combat-ui.js';

export function syncSceneModeButtons(mode) {
  const norm = ['A', 'B', 'C', 'LEGACY'].includes(mode) ? mode : 'C';
  store.currentSceneMode = norm;
  ['A', 'B', 'C', 'LEGACY'].forEach(m => {
    const btn = document.getElementById('scene-btn-' + m);
    if (btn) btn.classList.toggle('is-active', m === norm);
  });
  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.remove('scene-mode-A', 'scene-mode-B', 'scene-mode-C', 'scene-mode-LEGACY');
    vp.classList.add('scene-mode-' + norm);
  }
}

export function setSceneMode(mode) {
  const norm = ['A', 'B', 'C', 'LEGACY'].includes(String(mode || 'C').toUpperCase())
    ? String(mode || 'C').toUpperCase()
    : 'C';
  syncSceneModeButtons(norm);

  // Instantaneous client-side switch using pre-resolved scenes payload
  if (store.currentState) {
    store.currentState.sceneMode = norm;
    if (store.currentState.viewportScene) {
      store.currentState.viewportScene.sceneMode = norm;
      if (store.currentState.viewportScene.scenes && store.currentState.viewportScene.scenes[norm]) {
        store.currentState.viewportScene.activeScene = store.currentState.viewportScene.scenes[norm];
      }
    }
    renderViewportScene(store.currentState);
    if (store.currentState.mode !== 'FALLEN') {
      renderViewportCenterStage(store.currentState);
    }
  }

  // Persist choice to sandbox server asynchronously
  fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'SET_SCENE_MODE', payload: { sceneMode: norm } })
  }).catch(() => {});
}

export function preloadAdjacentSceneImages(scene) {
  if (!scene) return;
  const urls = [];
  if (scene.current && scene.current.imageUrl) urls.push(scene.current.imageUrl);
  if (scene.ahead1 && scene.ahead1.imageUrl) urls.push(scene.ahead1.imageUrl);
  if (scene.left1 && scene.left1.imageUrl) urls.push(scene.left1.imageUrl);
  if (scene.right1 && scene.right1.imageUrl) urls.push(scene.right1.imageUrl);
  if (scene.behind1 && scene.behind1.imageUrl) urls.push(scene.behind1.imageUrl);
  if (scene.scenes) {
    if (scene.scenes.A && scene.scenes.A.imageUrl) urls.push(scene.scenes.A.imageUrl);
    if (scene.scenes.B && scene.scenes.B.imageUrl) urls.push(scene.scenes.B.imageUrl);
    if (scene.scenes.C && scene.scenes.C.imageUrl) urls.push(scene.scenes.C.imageUrl);
    if (scene.scenes.LEGACY && scene.scenes.LEGACY.imageUrl) urls.push(scene.scenes.LEGACY.imageUrl);
  }
  if (Array.isArray(scene.preloadUrls)) {
    scene.preloadUrls.forEach(u => {
      if (u) urls.push(u);
    });
  }
  urls.forEach(u => {
    if (u && !store.preloadedImageUrls.has(u)) {
      store.preloadedImageUrls.add(u);
      const img = new Image();
      img.src = u;
    }
  });
}

export function applySceneImageWithCrossfade(terrainImg, prevImg, targetUrl, objectPos, transformStr, filterStr) {
  if (!terrainImg || !targetUrl) return;
  const currentSrc = terrainImg.getAttribute('src');
  const reducedMotion = isReducedMotionPreferred();

  // Guard against re-entrant calls for the same targetUrl while a crossfade or decode is already in flight
  if (store.isSceneCrossfading && store.activeSceneTargetUrl === targetUrl) {
    store.pendingSceneStyles = { objectPos, transformStr, filterStr };
    if (currentSrc === targetUrl) {
      terrainImg.style.objectPosition = objectPos;
      terrainImg.style.transform = transformStr;
      terrainImg.style.filter = filterStr;
    }
    return;
  }

  // Hold the previous loaded image in #fp-terrain-img-prev at opacity 1 while #fp-terrain-img
  // decodes and smoothly crossfades in over 160ms (non-blocking, respects prefers-reduced-motion).
  if (currentSrc && currentSrc !== targetUrl) {
    if (store.crossfadeCleanupTimer) {
      clearTimeout(store.crossfadeCleanupTimer);
      store.crossfadeCleanupTimer = null;
    }
    const swapToken = ++store.latestSceneImageSwapToken;
    store.activeSceneTargetUrl = targetUrl;
    store.pendingSceneStyles = { objectPos, transformStr, filterStr };

    if (prevImg) {
      if (terrainImg.complete && terrainImg.naturalWidth > 0 && !store.isSceneCrossfading) {
        prevImg.setAttribute('src', currentSrc);
        prevImg.style.objectPosition = terrainImg.style.objectPosition || objectPos;
        prevImg.style.transform = terrainImg.style.transform || transformStr;
        prevImg.style.filter = terrainImg.style.filter || filterStr;
        prevImg.style.opacity = '1';
      } else if (prevImg.getAttribute('src') && prevImg.complete && prevImg.naturalWidth > 0) {
        prevImg.style.opacity = '1';
      }
    }

    store.isSceneCrossfading = true;

    const finalizeSwap = () => {
      if (swapToken !== store.latestSceneImageSwapToken) return;
      if (store.crossfadeCleanupTimer) {
        clearTimeout(store.crossfadeCleanupTimer);
        store.crossfadeCleanupTimer = null;
      }
      store.isSceneCrossfading = false;
      if (prevImg) {
        prevImg.style.opacity = '0';
      }
      terrainImg.classList.remove('is-crossfading');
    };

    const offscreenPreload = new Promise(resolve => {
      const loader = new Image();
      loader.decoding = 'async';
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      loader.addEventListener('load', () => {
        if (typeof loader.decode === 'function') {
          loader.decode().catch(() => {}).finally(done);
        } else {
          done();
        }
      }, { once: true });
      loader.addEventListener('error', done, { once: true });
      loader.src = targetUrl;
      if (loader.complete && loader.naturalWidth > 0) {
        if (typeof loader.decode === 'function') {
          loader.decode().catch(() => {}).finally(done);
        } else {
          done();
        }
      }
    });

    let resolveTransition;
    window.__sceneTransitionPromise = new Promise(r => { resolveTransition = r; });

    window.__sceneImageDecodePromise = offscreenPreload.then(async () => {
      if (swapToken !== store.latestSceneImageSwapToken) {
        resolveTransition();
        return;
      }
      const styles = store.pendingSceneStyles || { objectPos, transformStr, filterStr };
      terrainImg.setAttribute('src', targetUrl);
      terrainImg.style.objectPosition = styles.objectPos;
      terrainImg.style.transform = styles.transformStr;
      terrainImg.style.filter = styles.filterStr;

      if (typeof terrainImg.decode === 'function') {
        try {
          await terrainImg.decode();
        } catch {}
      }
      if (swapToken !== store.latestSceneImageSwapToken) {
        resolveTransition();
        return;
      }
      if (reducedMotion) {
        finalizeSwap();
        resolveTransition();
        return;
      }
      terrainImg.classList.remove('is-crossfading');
      void terrainImg.offsetWidth;
      terrainImg.classList.add('is-crossfading');
      store.crossfadeCleanupTimer = setTimeout(() => {
        finalizeSwap();
        resolveTransition();
      }, 165);
    });
    return;
  }

  store.activeSceneTargetUrl = targetUrl;
  if (currentSrc !== targetUrl) {
    terrainImg.setAttribute('src', targetUrl);
  }
  if (prevImg && !store.isSceneCrossfading) {
    prevImg.style.opacity = '0';
  }
  terrainImg.style.objectPosition = objectPos;
  terrainImg.style.transform = transformStr;
  terrainImg.style.filter = filterStr;
}

window.__waitForSceneReady = async function () {
  if (store.activeActionPromise) {
    try {
      await store.activeActionPromise;
    } catch {}
  }
  if (window.__sceneImageDecodePromise) {
    try {
      await window.__sceneImageDecodePromise;
    } catch {}
  }
  if (window.__sceneTransitionPromise) {
    try {
      await window.__sceneTransitionPromise;
    } catch {}
  }
  const terrainImg = document.getElementById('fp-terrain-img');
  if (terrainImg) {
    if (!terrainImg.complete) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1500);
        terrainImg.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
        terrainImg.addEventListener('error', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    if (typeof terrainImg.decode === 'function') {
      try {
        await terrainImg.decode();
      } catch {}
    }
  }
  const animatedEls = [
    document.getElementById('fp-scene-backdrop'),
    terrainImg,
    document.getElementById('fp-inscene-threat'),
    document.getElementById('fp-monster-actor')
  ].filter(Boolean);
  for (const el of animatedEls) {
    if (typeof el.getAnimations === 'function') {
      const finiteAnims = el.getAnimations().filter(a => {
        const timing = a.effect && typeof a.effect.getComputedTiming === 'function'
          ? a.effect.getComputedTiming()
          : null;
        return !timing || timing.iterations !== Infinity;
      });
      if (finiteAnims.length > 0) {
        await Promise.race([
          Promise.allSettled(finiteAnims.map(a => a.finished)),
          new Promise(r => setTimeout(r, 600))
        ]);
      }
    }
  }
  if (store.crossfadeCleanupTimer) {
    clearTimeout(store.crossfadeCleanupTimer);
    store.crossfadeCleanupTimer = null;
  }
  store.isSceneCrossfading = false;
  const prevImg = document.getElementById('fp-terrain-img-prev');
  if (prevImg) {
    prevImg.style.opacity = '0';
  }
  if (terrainImg) {
    terrainImg.classList.remove('is-crossfading');
  }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return {
    src: terrainImg ? terrainImg.getAttribute('src') : null,
    complete: Boolean(terrainImg && terrainImg.complete),
    naturalWidth: terrainImg ? terrainImg.naturalWidth : 0,
    naturalHeight: terrainImg ? terrainImg.naturalHeight : 0
  };
};

export function renderViewportScene(state) {
  const scene = state.viewportScene;
  if (!scene) return;

  const seed = scene.seed || 1;
  const current = scene.current;
  const ahead1 = scene.ahead1;
  const left1 = scene.left1;
  const right1 = scene.right1;
  const facing = state.facing || 'NORTH';
  const fMeta = FACING_META[facing] || FACING_META.NORTH;

  const mode = ['A', 'B', 'C', 'LEGACY'].includes(state.sceneMode)
    ? state.sceneMode
    : (['A', 'B', 'C', 'LEGACY'].includes(scene.sceneMode) ? scene.sceneMode : store.currentSceneMode);
  syncSceneModeButtons(mode);
  preloadAdjacentSceneImages(scene);

  const activeScene = (scene.scenes && scene.scenes[mode]) || scene.activeScene || null;

  // 1. Update Top Viewport Facing, Scene Mode Badge, Caption & Field-of-View Badges
  const facingPill = document.getElementById('fp-facing-pill');
  if (facingPill) {
    facingPill.textContent = `🧭 ${fMeta.short} ${fMeta.arrow}`;
    facingPill.title = `${fMeta.label} (${facing})`;
  }

  const modeTag = document.getElementById('fp-scene-mode-tag');
  if (modeTag) {
    modeTag.classList.remove('is-fp-dedicated', 'is-fp-fallback');
    if (mode === 'A') {
      modeTag.textContent = 'Scene A: Single';
    } else if (mode === 'B') {
      modeTag.textContent = 'Scene B: Directional';
    } else if (mode === 'C') {
      const povTier = activeScene && activeScene.povTier ? Number(activeScene.povTier) : 1;
      if (povTier === 1) {
        modeTag.textContent = 'Scene C • Tier 1 Exact POV';
        modeTag.classList.add('is-fp-dedicated');
      } else if (povTier === 2) {
        modeTag.textContent = 'Scene C • Tier 2 Landmark POV';
        modeTag.classList.add('is-fp-dedicated');
      } else if (povTier === 3) {
        modeTag.textContent = 'Scene C • Tier 3 Context POV';
        modeTag.classList.add('is-fp-dedicated');
      } else if (povTier === 4) {
        modeTag.textContent = 'Scene C • Tier 4 Generic POV';
        modeTag.classList.add('is-fp-fallback');
      } else {
        modeTag.textContent = 'Scene C • Tier 5 Safe POV';
        modeTag.classList.add('is-fp-fallback');
      }
      modeTag.title = (activeScene && activeScene.povTierLabel) || 'Mode C 5-Tier POV Selection';
    } else {
      modeTag.textContent = 'Legacy: Blended+SVG';
    }
  }

  const captionLine = document.getElementById('fp-scene-caption-line');
  if (captionLine && activeScene) {
    captionLine.textContent = activeScene.viewTitle || current.name;
    captionLine.title = activeScene.viewSubtitle || '';
  }

  const fovLeft = document.getElementById('fp-fov-left');
  const fovAhead = document.getElementById('fp-fov-ahead');
  const fovRight = document.getElementById('fp-fov-right');
  const cCtx = state.adventure && state.adventure.compassContext;

  if (fovLeft && left1) {
    const leftLabel = (cCtx && cCtx.left && cCtx.left.landmark && cCtx.left.landmark.shortLabel) || left1.name;
    fovLeft.textContent = `◀ ${left1.direction[0]}: ${leftLabel}${left1.isPassable ? '' : ' (Blocked)'}`;
    fovLeft.title = (cCtx && cCtx.left && cCtx.left.summary) ? sanitizePlayerContinuityText(cCtx.left.summary) : '';
  }
  if (fovAhead && ahead1) {
    const aheadLabel = (cCtx && cCtx.ahead && cCtx.ahead.landmark && cCtx.ahead.landmark.shortLabel) || ahead1.name;
    fovAhead.textContent = `▲ ${ahead1.direction[0]}: ${aheadLabel}${ahead1.isPassable ? '' : ' (Blocked)'}`;
    fovAhead.classList.toggle('is-blocked', !ahead1.isPassable);
    fovAhead.title = (cCtx && cCtx.ahead && cCtx.ahead.summary) ? sanitizePlayerContinuityText(cCtx.ahead.summary) : '';
  }
  if (fovRight && right1) {
    const rightLabel = (cCtx && cCtx.right && cCtx.right.landmark && cCtx.right.landmark.shortLabel) || right1.name;
    fovRight.textContent = `▶ ${right1.direction[0]}: ${rightLabel}${right1.isPassable ? '' : ' (Blocked)'}`;
    fovRight.title = (cCtx && cCtx.right && cCtx.right.summary) ? sanitizePlayerContinuityText(cCtx.right.summary) : '';
  }

  const terrainImg = document.getElementById('fp-terrain-img');
  const prevImg = document.getElementById('fp-terrain-img-prev');
  const atmoLayer = document.getElementById('fp-atmosphere-layer');
  const aheadPortal = document.getElementById('fp-ahead-portal');
  const aheadImg = document.getElementById('fp-ahead-img');
  const flankLeft = document.getElementById('fp-flank-left');
  const flankRight = document.getElementById('fp-flank-right');
  const svgWrap = document.getElementById('fp-scene-svg-wrap');

  // =========================================================================
  // COHESIVE SINGLE-PAINTING MODES (MODE A, MODE B & MODE C: FIRST-PERSON)
  // Zero multi-image portal blending. Zero geometric SVG overlays.
  // =========================================================================
  if (mode === 'A' || mode === 'B' || mode === 'C') {
    const targetUrl = (activeScene && activeScene.imageUrl) || (current && current.imageUrl);
    const focalX = activeScene && typeof activeScene.focalX === 'number' ? activeScene.focalX : 50;
    const focalY = activeScene && typeof activeScene.focalY === 'number' ? activeScene.focalY : 45;
    const panX = activeScene && typeof activeScene.panX === 'number' ? activeScene.panX : 0;
    const panY = activeScene && typeof activeScene.panY === 'number' ? activeScene.panY : 0;

    applySceneImageWithCrossfade(
      terrainImg,
      prevImg,
      targetUrl,
      `${focalX}% ${focalY}%`,
      `translate(${panX}%, ${panY}%)`,
      'brightness(0.92) contrast(1.04) saturate(0.98)'
    );

    if (atmoLayer) {
      atmoLayer.style.display = 'block';
      atmoLayer.style.setProperty('--scene-lighting-tint', (activeScene && activeScene.lightingTint) || 'rgba(14, 18, 26, 0.08)');
      atmoLayer.className = `fp-atmosphere-layer horizon-${(activeScene && activeScene.horizonGlow) || 'none'}`;
    }
    syncAtmosphericEffects(state);

    if (aheadPortal) {
      aheadPortal.classList.remove('is-visible', 'is-blocked-ahead');
    }
    if (svgWrap) {
      svgWrap.innerHTML = '';
    }

    applyFlankClass(flankLeft, left1);
    applyFlankClass(flankRight, right1);
    return;
  }

  // =========================================================================
  // LEGACY MODE (Preserved for Side-by-Side Comparison)
  // =========================================================================
  if (atmoLayer) {
    atmoLayer.style.display = 'none';
  }
  stopAtmosphericParticleLoop();

  const legacyCurrentUrl = (current && (current.legacyImageUrl || current.imageUrl)) || '/images/terrain/terrain_fallback.webp';
  const facingPanMap = { NORTH: -4.5, EAST: 1.8, SOUTH: 4.5, WEST: -1.8 };
  const basePanX = facingPanMap[facing] || 0;
  const shiftX = (basePanX + (seededUnit(seed, 1) - 0.5) * 6).toFixed(1);
  const shiftY = ((seededUnit(seed, 2) - 0.5) * 4).toFixed(1);
  const posX = (42 + seededUnit(seed, 1) * 16).toFixed(1);
  const posY = (46 + seededUnit(seed, 2) * 8).toFixed(1);
  const bright = (0.80 + seededUnit(seed, 3) * 0.10).toFixed(2);

  applySceneImageWithCrossfade(
    terrainImg,
    prevImg,
    legacyCurrentUrl,
    `${posX}% ${posY}%`,
    `translate(${shiftX}%, ${shiftY}%)`,
    `brightness(${bright}) contrast(1.06) saturate(0.95)`
  );

  if (aheadPortal && aheadImg && ahead1) {
    const showPortal = scene.isTerrainTransitionAhead || scene.isAheadBlocked || ahead1.terrain === 'CITY' || ahead1.terrain === 'TOWN';
    aheadPortal.classList.toggle('is-visible', Boolean(showPortal));
    aheadPortal.classList.toggle('is-blocked-ahead', !ahead1.isPassable);
    const legacyAheadUrl = ahead1.legacyImageUrl || ahead1.imageUrl;
    if (legacyAheadUrl && aheadImg.getAttribute('src') !== legacyAheadUrl) {
      aheadImg.setAttribute('src', legacyAheadUrl);
    }
    const aPosX = (45 + seededUnit(seed, 4) * 10).toFixed(1);
    aheadImg.style.objectPosition = `${aPosX}% 50%`;
  }

  applyFlankClass(flankLeft, left1);
  applyFlankClass(flankRight, right1);

  if (svgWrap) {
    svgWrap.innerHTML = buildMapConnectedSceneSvg(scene, state);
  }
}

export function renderViewportCenterStage(state) {
  const stage = document.getElementById('fp-center-stage');
  const enc = state.encounter;
  const victory = state.victory;
  const adv = state.adventure || null;

  // CASE 0: PATHFINDER 1E MONSTER SIZE & BODY-PROFILE VISUAL COMPARISON ARENA (Phase 4)
  if (store.isSizeComparisonLabOpen) {
    stage.innerHTML = buildSizeComparisonArenaHtml(state);
    return;
  }

  // CASE A: POST-VICTORY PRESENTATION (No confirmation required to keep walking!)
  if (victory) {
    const lootHtml = (victory.lootedItems && victory.lootedItems.length > 0)
      ? `<div style="margin-top: 4px; color: var(--accent-gold-bright); font-size: 0.8rem;">📦 Looted: <strong>${victory.lootedItems.map(escapeHtml).join(', ')}</strong></div>`
      : `<div style="margin-top: 3px; color: var(--text-muted); font-size: 0.76rem;">No items found on the remains.</div>`;
    const combatRet = adv && adv.combatReturnContext;
    const returnBearingDir = (combatRet && combatRet.restoredFacing) || state.facing || 'NORTH';
    const returnBearingLabel = (FACING_META[returnBearingDir] && FACING_META[returnBearingDir].label) || returnBearingDir;
    const returnPlaceName = (combatRet && combatRet.tileName) || (state.currentTile && state.currentTile.name) || 'the trail';

    stage.innerHTML = `
      <div class="fp-monster-actor" onclick="dispatchAction('DISMISS_VICTORY')" title="Step [W/S/Q/E] to keep moving, or click / press [Space] to clear">
        <div class="fp-monster-portrait-box" style="width: clamp(110px, 18vh, 175px); height: clamp(110px, 18vh, 175px); opacity: 0.75; filter: grayscale(0.45);">
          <span class="fp-corner-bracket tl"></span>
          <span class="fp-corner-bracket tr"></span>
          <span class="fp-corner-bracket bl"></span>
          <span class="fp-corner-bracket br"></span>
          <img src="${escapeHtml(victory.imageUrl)}" alt="Defeated ${escapeHtml(victory.cleanMonsterName)}" class="fp-monster-img">
        </div>
        <div class="fp-monster-ground-shadow"></div>
        <div class="fp-monster-hud-plate" style="border-color: var(--border-gold-solid);">
          <div class="fp-monster-title-row" style="color: var(--accent-gold-bright);">
            <span>🏆 VICTORY — ${escapeHtml(victory.cleanMonsterName)} Slain!</span>
          </div>
          <div style="display: flex; justify-content: center; gap: 14px; margin-top: 2px; font-family: var(--font-mono); font-size: 0.8rem;">
            <span style="color: #93c5fd;">✨ +${victory.xpAwarded} XP</span>
            <span style="color: var(--accent-gold-bright);">🪙 +${victory.goldLooted} Gold</span>
          </div>
          ${lootHtml}
          <div class="fp-combat-return-line" style="margin-top: 4px; font-size: 0.73rem; color: #fde68a;">
            🧭 Ground secured at <strong>${escapeHtml(returnPlaceName)}</strong> • Bearings restored (<strong>${escapeHtml(returnBearingLabel)}</strong>)
          </div>
          <div style="margin-top: 2px; font-size: 0.72rem; color: #86efac;">
            ✦ Walk freely with <strong>[W / S / Q / E]</strong> to advance immediately
          </div>
        </div>
      </div>
    `;
    return;
  }

  // CASE B: STAGE 2 — ACTIVE COMBAT (Monster Standing in the Viewport)
  if (enc && enc.status === 'IN_COMBAT') {
    stage.innerHTML = buildCombatMonsterActorHtml(enc, state, { isSequenceFrame: false });
    return;
  }

  // CASE C: STAGE 1 — IN-SCENE SHADOW THREAT (Strict Secrecy, No Opaque Center Card!)
  if (enc && enc.status === 'DISCOVERED') {
    const bypassHint = enc.isAmbush
      ? `<span style="color: #fca5a5;">⚠️ Ambush! Retreat is cut off — press <strong>[Space]</strong> to face the threat!</span>`
      : `<span>Click shadow or press <strong>[Space]</strong> to Engage • Step <strong>[W/S/Q/E]</strong> or <strong>[4/F]</strong> to Slip Past</span>`;

    stage.innerHTML = `
      <div class="fp-inscene-threat" id="fp-inscene-threat" onclick="dispatchAction('INVESTIGATE')" title="Click shadow or press [Space] to Engage threat">
        <div class="fp-shadow-apparition" aria-label="Unidentified shadow lurking in the mist">
          <svg class="fp-shadow-silhouette-svg" viewBox="0 0 200 220" aria-hidden="true">
            <defs>
              <radialGradient id="shadowMistGrad" cx="50%" cy="48%" r="50%">
                <stop offset="0%" stop-color="#05070a" stop-opacity="0.95"/>
                <stop offset="65%" stop-color="#111622" stop-opacity="0.72"/>
                <stop offset="100%" stop-color="#111622" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <!-- Generic amorphous lurking shadow in the mist (never identifies creature species) -->
            <ellipse cx="100" cy="195" rx="74" ry="16" fill="rgba(0,0,0,0.65)"/>
            <path d="M 48,190 C 38,135 55,68 82,45 C 96,32 112,34 124,48 C 148,74 162,135 152,190 Z"
                  fill="url(#shadowMistGrad)"/>
            <path d="M 32,175 Q 65,120 100,132 Q 135,144 168,170"
                  fill="none" stroke="rgba(197, 160, 89, 0.25)" stroke-width="2" stroke-dasharray="8 6"/>
            <!-- Faint ominous glints in the fog -->
            <circle cx="88" cy="84" r="2.8" fill="rgba(239, 68, 68, 0.75)"/>
            <circle cx="112" cy="84" r="2.8" fill="rgba(239, 68, 68, 0.75)"/>
          </svg>
        </div>

        <div class="fp-threat-whisper-plate" onclick="event.stopPropagation();">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-serif); font-size: 0.84rem; font-weight: 700; color: var(--accent-gold-bright);">
            <span>👁️ Unidentified Presence Ahead</span>
            ${enc.isRangerSpecial ? `<span class="lab-badge" style="color:#86efac; border-color:#4ade80;">🏹 Keen Senses</span>` : ''}
            ${enc.isAmbush ? `<span class="lab-badge" style="color:#fca5a5; border-color:#ef4444;">⚠️ Ambush</span>` : ''}
          </div>
          <p class="fp-mystery-clue">
            “${escapeHtml(enc.resolvedDescription)}”
          </p>
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn-action-gold" style="padding: 5px 14px; font-size: 0.76rem;" onclick="dispatchAction('INVESTIGATE')">
              ⚔️ ${enc.isAmbush ? 'Face Ambush' : 'Engage Threat'} [Space]
            </button>
            ${!enc.isAmbush ? `
              <button type="button" class="btn-action-stone" style="padding: 5px 12px; font-size: 0.74rem;" onclick="dispatchAction('IGNORE')">
                👣 Slip Past [4 / F]
              </button>
            ` : ''}
          </div>
          <div style="font-size: 0.71rem; color: var(--text-muted); margin-top: 2px;">
            ${bypassHint}
          </div>
        </div>
      </div>
    `;
    return;
  }

  // CASE C.5: POINT OF INTEREST (POI) ENVIRONMENTAL LORE PLAQUE (When inspected outside active combat)
  const poi = state.viewportScene && state.viewportScene.pointOfInterest;
  if (store.isPoiPlaqueOpen && poi) {
    stage.innerHTML = `
      <div class="fp-poi-plaque-card" id="fp-poi-plaque-card">
        <div class="fp-poi-plaque-header">
          <div class="fp-poi-plaque-title">
            <span>🔍 ${escapeHtml(poi.title)}</span>
            <span class="fp-poi-plaque-category">${escapeHtml(poi.category || 'Landmark')}</span>
          </div>
          <button type="button" class="btn-action-stone" style="padding: 3px 10px; font-size: 0.72rem;" onclick="closePoiPlaque()">
            ✕ Close [I / Esc]
          </button>
        </div>
        <div class="fp-poi-plaque-lore">
          “${escapeHtml(poi.loreText)}”
        </div>
        <div class="fp-poi-plaque-footer">
          <span>📍 Coordinates [${state.currentTile.x}, ${state.currentTile.y}] • Facing ${escapeHtml(state.facing)}</span>
          <span>✦ Pure Environmental Lore • Walk with <strong>[W/A/S/D]</strong> to continue</span>
        </div>
      </div>
    `;
    return;
  }

  const revisitBadgeHtml = buildRevisitBadgeHtml(adv);
  const cleanHorizonHint = sanitizePlayerContinuityText((adv && adv.horizonHint) || '');
  const FacingLabel = (FACING_META[state.facing] && FACING_META[state.facing].label) || state.facing || 'North';

  // CASE D: SAFE HAVEN CITY (Compact non-intrusive sanctuary bar at bottom of stage)
  if (state.isSafeCity) {
    const aheadCity = state.viewportScene && state.viewportScene.ahead1;
    const aheadSub = cleanHorizonHint
      ? escapeHtml(cleanHorizonHint)
      : (aheadCity
        ? `Looking ${escapeHtml(FacingLabel)} toward <strong>${escapeHtml(aheadCity.name)}</strong>`
        : 'Safe within the timber walls');
    stage.innerHTML = `
      <div class="fp-threat-whisper-plate" style="margin-top: auto; max-width: 560px;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; font-family: var(--font-serif); font-size: 0.86rem; color: var(--accent-gold); font-weight: 700;">
          <span>🏛️ Sanctuary of ${escapeHtml(state.currentTile.name)}</span>
          ${revisitBadgeHtml}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-body);">
          ${aheadSub} • Press <strong>[Space]</strong> to rest, <strong>[W/A/S/D]</strong> to navigate, or open Market <strong>[M]</strong>.
        </div>
      </div>
    `;
    return;
  }

  // CASE E: CLEAR WILDERNESS VISTA (Unobstructed first-person view of the cohesive scene)
  const ahead1 = state.viewportScene && state.viewportScene.ahead1;
  const isBlocked = Boolean(ahead1 && !ahead1.isPassable);
  const mode = store.currentSceneMode || state.sceneMode || 'A';
  const activeScene = (state.viewportScene && state.viewportScene.scenes && state.viewportScene.scenes[mode]) ||
                      (state.viewportScene && state.viewportScene.activeScene) || null;
  const hasActiveDiscovery = Boolean(adv && adv.enabled && adv.activeDiscovery);

  let vistaHint = 'Choose a direction to explore';
  if (ahead1) {
    const povTier = activeScene && activeScene.povTier ? Number(activeScene.povTier) : 1;
    if (!ahead1.isPassable) {
      const rawBoundaryMsg = (adv && adv.boundaryGuidance && adv.boundaryGuidance.playerMessage) ||
        (activeScene && activeScene.viewSubtitle) ||
        '';
      let boundaryMsg = sanitizePlayerContinuityText(rawBoundaryMsg);
      if (boundaryMsg.includes('—')) {
        boundaryMsg = boundaryMsg.split('—')[0].trim();
      }
      const povContextNote = boundaryMsg ? ` • <em>${escapeHtml(boundaryMsg)}</em>` : '';
      vistaHint = `⛔ <strong style="color:#fca5a5;">Blocked (${escapeHtml(FacingLabel)}): ${escapeHtml(ahead1.name)}</strong>${povContextNote} — Turn <strong>[A/D]</strong> or step <strong>[S/Q/E]</strong>`;
    } else if (mode === 'C' && povTier <= 3) {
      const subText = sanitizePlayerContinuityText((activeScene && activeScene.viewSubtitle) || cleanHorizonHint || `Looking toward ${ahead1.name}`);
      const extraHorizon = (cleanHorizonHint && subText && !subText.toLowerCase().includes(ahead1.name.toLowerCase()) && (adv && (adv.transitionContext === 'LANDMARK_APPROACH' || adv.transitionContext === 'BIOME_THRESHOLD_CROSSING')))
        ? ` • <span class="fp-horizon-cue">${escapeHtml(cleanHorizonHint)}</span>`
        : '';
      vistaHint = `👁️ <strong style="color:#86efac;">Ahead (${escapeHtml(FacingLabel)})<span class="dev-only-badge"> • POV Tier ${povTier}</span>:</strong> ${escapeHtml(subText)}${extraHorizon} — Press <strong>[W]</strong> to advance`;
    } else if (mode === 'C') {
      const fallbackHorizon = cleanHorizonHint || sanitizePlayerContinuityText((activeScene && activeScene.viewSubtitle) || `Looking toward ${ahead1.name}`);
      vistaHint = `🧭 <strong style="color:#fde68a;">Ahead (${escapeHtml(FacingLabel)})<span class="dev-only-badge"> • POV Tier ${povTier} Fallback</span>:</strong> ${escapeHtml(fallbackHorizon)} — Press <strong>[W]</strong> to advance or <strong>[A/D]</strong> to turn`;
    } else if (mode === 'B') {
      vistaHint = `👁️ ${escapeHtml(cleanHorizonHint || `Looking ${FacingLabel} toward ${ahead1.name}`)} — Press <strong>[W]</strong> to advance`;
    } else {
      vistaHint = `🧭 ${escapeHtml(cleanHorizonHint || `Ahead (${FacingLabel}): ${ahead1.name}`)} — Press <strong>[W]</strong> to advance`;
    }
  }

  const revisitStatusAttr = (adv && (adv.revisitStatus || (adv.travelContinuity && adv.travelContinuity.revisitStatus))) || 'FIRST_VISIT';
  stage.innerHTML = `
    <div class="fp-vista-bar ${isBlocked ? 'is-blocked-vista' : ''} ${hasActiveDiscovery && !isBlocked ? 'is-subdued-vista' : ''}" data-revisit-status="${escapeHtml(revisitStatusAttr)}">
      ${revisitBadgeHtml}
      <span class="fp-vista-text" style="font-size: 0.76rem; color: var(--text-body);">
        ${vistaHint}
      </span>
    </div>
  `;
}
