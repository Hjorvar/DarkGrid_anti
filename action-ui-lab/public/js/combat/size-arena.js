/**
 * DARKGRID ADVENTURE LAB — Pathfinder 1e Adaptive Monster Scaling & Comparison Arena (ES Module)
 */
import { store, uiCallbacks } from '../state/store.js';
import { escapeHtml } from '../ui/utils.js';

function renderViewportCenterStage(state) {
  return uiCallbacks.renderViewportCenterStage(state);
}

export function setMonsterScaleMode(mode) {
  const norm = String(mode || 'adaptive').toLowerCase().trim() === 'legacy' ? 'legacy' : 'adaptive';
  store.currentMonsterScaleMode = norm;
  const vp = document.getElementById('fp-viewport');
  if (vp) {
    vp.classList.toggle('scale-mode-adaptive', norm === 'adaptive');
    vp.classList.toggle('scale-mode-legacy', norm === 'legacy');
  }
  if (store.currentState && store.currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(store.currentState);
  }
}

export function toggleMonsterSizeComparisonLab(forceState = null, presetId = null) {
  if (typeof forceState === 'boolean') {
    store.isSizeComparisonLabOpen = forceState;
  } else {
    store.isSizeComparisonLabOpen = !store.isSizeComparisonLabOpen;
  }
  if (presetId) {
    store.currentSizeComparisonPreset = presetId;
  }
  const btn = document.getElementById('btn-toggle-sizelab');
  if (btn) {
    btn.classList.toggle('is-active', store.isSizeComparisonLabOpen);
  }
  if (store.currentState && store.currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(store.currentState);
  }
}

export function setSizeComparisonPreset(presetId) {
  store.currentSizeComparisonPreset = presetId || 'SIZE_PROGRESSION_5';
  store.isSizeComparisonLabOpen = true;
  const btn = document.getElementById('btn-toggle-sizelab');
  if (btn) btn.classList.add('is-active');
  if (store.currentState && store.currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(store.currentState);
  }
}

export function setBeforeAfterSpecimen(slug) {
  store.selectedBeforeAfterSpecimen = slug || 'troll';
  store.currentSizeComparisonPreset = 'BEFORE_AFTER_SPLIT';
  store.isSizeComparisonLabOpen = true;
  if (store.currentState && store.currentState.mode !== 'FALLEN') {
    renderViewportCenterStage(store.currentState);
  }
}

export function computeClientMonsterVisualScale(monsterOrKey, state, isEffectiveIntegrated = false, extraOpts = {}) {
  const cat = window.MonsterSizeCatalog;
  if (!cat || typeof cat.computeAdaptiveMonsterVisualScale !== 'function') {
    return (monsterOrKey && monsterOrKey.adaptiveScale) || null;
  }
  const mode = (state && state.sceneMode) || store.currentSceneMode || 'C';
  const scene = state && state.viewportScene;
  const activeScene = (scene && scene.scenes && scene.scenes[mode]) || (scene && scene.activeScene) || {};
  const stageAnchor = activeScene.stageAnchor || {};
  const stageFloorY = typeof stageAnchor.stageFloorY === 'number' ? stageAnchor.stageFloorY : 82;
  const currentTile = state && state.currentTile;

  return cat.computeAdaptiveMonsterVisualScale(monsterOrKey, {
    viewportWidth: window.innerWidth || 1920,
    viewportHeight: window.innerHeight || 1080,
    presentationMode: isEffectiveIntegrated ? 'INTEGRATED' : 'CARD',
    stageFloorY,
    sceneTerrain: currentTile ? currentTile.terrain : undefined,
    tileX: currentTile && typeof currentTile.x === 'number' ? currentTile.x : undefined,
    tileY: currentTile && typeof currentTile.y === 'number' ? currentTile.y : undefined,
    virtualDistanceFt: 12,
    ...extraOpts
  });
}

export function buildSizeComparisonArenaHtml(state) {
  const cat = window.MonsterSizeCatalog;
  if (!cat || typeof cat.buildVisualComparisonPresets !== 'function') {
    return `<div class="fp-threat-whisper-plate">Monster Size Catalog loading...</div>`;
  }
  const vpW = window.innerWidth || 1920;
  const vpH = window.innerHeight || 1080;
  const bundle = cat.buildVisualComparisonPresets({ width: vpW, height: vpH });
  const presets = bundle.presets || {};
  const isAdaptive = store.currentMonsterScaleMode === 'adaptive';
  const wantsCutout = store.currentPresenceMode === 'integrated';

  const tabs = [
    { id: 'SIZE_PROGRESSION_5',        label: '1. Size Progression (Tiny → Huge)' },
    { id: 'SAME_SIZE_MEDIUM_PROFILES', label: '2. Medium Body Shapes' },
    { id: 'SAME_SIZE_LARGE_PROFILES',  label: '3. Large Body Shapes' },
    { id: 'ALL_9_PF1E_TIERS',          label: '4. All 9 PF1e Sizes' },
    { id: 'BEFORE_AFTER_SPLIT',        label: '5. Before vs. After' }
  ];

  const tabsHtml = tabs.map(t => `
    <button type="button"
            class="sizelab-tab-btn ${store.currentSizeComparisonPreset === t.id ? 'is-active' : ''}"
            data-preset-id="${escapeHtml(t.id)}"
            onclick="setSizeComparisonPreset('${escapeHtml(t.id)}')">
      ${escapeHtml(t.label)}
    </button>
  `).join('');

  let bodyHtml = '';
  let subtitleText = '';

  if (store.currentSizeComparisonPreset === 'BEFORE_AFTER_SPLIT') {
    const specimenChoices = [
      { slug: 'stirge',               label: 'Stirge (Tiny • 1 ft)' },
      { slug: 'goblin',               label: 'Goblin (Small • 3.2 ft)' },
      { slug: 'giant_spider',         label: 'Giant Spider (Medium Wide • 5.5 ft span)' },
      { slug: 'wolf',                 label: 'Wolf (Medium Quadruped • 3.2 ft shld)' },
      { slug: 'skeletal_champion',    label: 'Skeletal Champion (Medium Biped • 6.1 ft)' },
      { slug: 'troll',                label: 'Troll (Large Brute • 14 ft)' },
      { slug: 'manticore',            label: 'Manticore (Large Winged • 16 ft span)' },
      { slug: 'ochre_jelly',          label: 'Ochre Jelly (Large Ooze • 10 ft wide)' },
      { slug: 'ref_huge_elder_troll', label: 'Ancient Troll (Huge Ref • 24 ft)' }
    ];
    const entry = cat.lookupMonsterSizeEntry(store.selectedBeforeAfterSpecimen);
    const useCut = wantsCutout && Boolean(entry.hasCutout && entry.cutoutImagePath);
    const imgSrc = useCut ? entry.cutoutImagePath : entry.imagePath;
    const sc = cat.computeAdaptiveMonsterVisualScale(entry, {
      viewportWidth: vpW,
      viewportHeight: vpH,
      presentationMode: useCut ? 'INTEGRATED' : 'CARD',
      virtualDistanceFt: 12
    });

    // Fit inside split arena stage height while keeping exact 1:1 ratio between Before & After
    const maxStageH = Math.max(150, Math.round(vpH * 0.36));
    const peakH = Math.max(sc.legacyComparison.legacyBoxPx, sc.visibleHeightPx);
    const splitFit = peakH > maxStageH ? +(maxStageH / peakH).toFixed(3) : 1.0;

    const beforeW = Math.round(sc.legacyComparison.legacyBoxPx * splitFit);
    const beforeH = Math.round(sc.legacyComparison.legacyBoxPx * splitFit);
    const afterW = Math.round(sc.visibleWidthPx * splitFit);
    const afterH = Math.round(sc.visibleHeightPx * splitFit);
    const deltaSign = sc.legacyComparison.heightDeltaPct >= 0 ? '+' : '';

    subtitleText = `${entry.name} — PF1e ${sc.pfSizeLabel} (${sc.pfSpaceFt} ft space) • ${sc.visualBodyProfileLabel} • Shared 12-ft Virtual Distance`;

    const selectorPills = specimenChoices.map(c => `
      <button type="button"
              class="sizelab-subpill ${store.selectedBeforeAfterSpecimen === c.slug ? 'is-active' : ''}"
              onclick="setBeforeAfterSpecimen('${escapeHtml(c.slug)}')">
        ${escapeHtml(c.label)}
      </button>
    `).join('');

    bodyHtml = `
      <div class="sizelab-subbar">${selectorPills}</div>
      <div class="sizelab-split-stage" id="sizelab-split-stage">
        <div class="sizelab-split-col is-before-col" data-col="before">
          <div class="sizelab-col-badge badge-before">BEFORE — Legacy Uniform Box (23vh Square)</div>
          <div class="sizelab-figure-floor">
            <div class="sizelab-specimen-box ${useCut ? 'is-cutout' : 'is-card'} is-legacy-box"
                 style="width:${beforeW}px; height:${beforeH}px;">
              <img src="${escapeHtml(imgSrc)}" alt="Before ${escapeHtml(entry.name)}" class="sizelab-specimen-img">
            </div>
            <div class="sizelab-ground-shadow" style="width:${Math.round(beforeW * 0.78)}px; height:16px; opacity:0.68;"></div>
          </div>
          <div class="sizelab-specimen-caption">
            <strong>${escapeHtml(entry.name)} (Legacy)</strong>
            <span>1:1 Combat Box: <code>${sc.legacyComparison.legacyBoxPx}×${sc.legacyComparison.legacyBoxPx}px</code> (1.00:1)</span>
            <span>Ignores PF1e size, body profile &amp; margin padding</span>
          </div>
        </div>

        <div class="sizelab-split-col is-after-col" data-col="after">
          <div class="sizelab-col-badge badge-after">AFTER — PF1e Adaptive (${escapeHtml(sc.pfSizeLabel)} • ${deltaSign}${sc.legacyComparison.heightDeltaPct}% Height)</div>
          <div class="sizelab-figure-floor ${sc.positioning.isAirborne ? 'is-airborne-specimen' : ''}">
            <div class="sizelab-specimen-box ${useCut ? 'is-cutout' : 'is-card'} is-adaptive-box"
                 style="width:${afterW}px; height:${afterH}px; --trim-scale:${sc.transparencyCompensation.imageTrimScale};">
              <img src="${escapeHtml(imgSrc)}" alt="After ${escapeHtml(entry.name)}" class="sizelab-specimen-img">
            </div>
            <div class="sizelab-ground-shadow" style="width:${Math.round(afterW * (sc.shadow.shadowWidthPct / 100))}px; height:${Math.max(10, Math.round(sc.shadow.shadowHeightPx * splitFit * 0.65))}px; opacity:${sc.shadow.shadowOpacity}; filter:blur(${Math.round(sc.shadow.shadowBlurPx * 0.45)}px);"></div>
          </div>
          <div class="sizelab-specimen-caption">
            <strong>${escapeHtml(entry.name)} (${escapeHtml(sc.pfSizeLabel)})</strong>
            <span>1:1 Combat Box: <code>${sc.visibleWidthPx}×${sc.visibleHeightPx}px</code> (Aspect ${sc.aspectRatio}:1)</span>
            <span>Profile: ${escapeHtml(sc.visualBodyProfile)} • Trim ×${sc.transparencyCompensation.imageTrimScale}${sc.clamping.wasClamped ? ' • 🛡️ UI Clamped' : ''}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    const activePreset = presets[store.currentSizeComparisonPreset] || presets.SIZE_PROGRESSION_5;
    subtitleText = activePreset.subtitle;
    const specimens = activePreset.specimens || [];

    // Compute a uniform lineup fit factor so all specimens fit side-by-side at current resolution
    // while preserving 100% of their relative height and width proportions!
    const availStageW = Math.max(540, Math.round(vpW * 0.62) - (specimens.length * 22));
    const availStageH = Math.max(155, Math.round(vpH * 0.37));

    const totalRawW = specimens.reduce((sum, s) => {
      const w = isAdaptive ? s.adaptive.visibleWidthPx : s.adaptive.legacyComparison.legacyBoxPx;
      return sum + w;
    }, 0);
    const maxRawH = specimens.reduce((max, s) => {
      const h = isAdaptive ? s.adaptive.visibleHeightPx : s.adaptive.legacyComparison.legacyBoxPx;
      return Math.max(max, h);
    }, 1);

    const fitW = availStageW / Math.max(1, totalRawW);
    const fitH = availStageH / Math.max(1, maxRawH);
    const lineupFit = Math.min(1.0, fitW, fitH);

    const cardsHtml = specimens.map(spec => {
      const sc = spec.adaptive;
      const useCut = wantsCutout && Boolean(spec.hasCutout && spec.cutoutImagePath);
      const imgSrc = useCut ? spec.cutoutImagePath : spec.imagePath;
      const rawW = isAdaptive ? sc.visibleWidthPx : sc.legacyComparison.legacyBoxPx;
      const rawH = isAdaptive ? sc.visibleHeightPx : sc.legacyComparison.legacyBoxPx;
      const dispW = Math.max(34, Math.round(rawW * lineupFit));
      const dispH = Math.max(34, Math.round(rawH * lineupFit));
      const shW = Math.max(24, Math.round(dispW * (isAdaptive ? (sc.shadow.shadowWidthPct / 100) : 0.78)));
      const shH = Math.max(8, Math.round((isAdaptive ? sc.shadow.shadowHeightPx : 18) * lineupFit * 0.65));
      const deltaSign = sc.legacyComparison.heightDeltaPct >= 0 ? '+' : '';

      return `
        <div class="sizelab-lineup-item ${sc.positioning.isAirborne && isAdaptive ? 'is-airborne-specimen' : ''}"
             data-slug="${escapeHtml(spec.slug)}"
             data-pf-size="${escapeHtml(sc.pfSizeCategory)}"
             data-body-profile="${escapeHtml(sc.visualBodyProfile)}"
             data-combat-w="${rawW}"
             data-combat-h="${rawH}"
             data-disp-w="${dispW}"
             data-disp-h="${dispH}">
          <div class="sizelab-figure-floor">
            <div class="sizelab-specimen-box ${useCut ? 'is-cutout' : 'is-card'} ${isAdaptive ? 'is-adaptive-box' : 'is-legacy-box'}"
                 style="width:${dispW}px; height:${dispH}px; --trim-scale:${isAdaptive ? sc.transparencyCompensation.imageTrimScale : 1};">
              <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(spec.name)}" class="sizelab-specimen-img">
            </div>
            <div class="sizelab-ground-shadow"
                 style="width:${shW}px; height:${shH}px; opacity:${isAdaptive ? sc.shadow.shadowOpacity : 0.68};"></div>
          </div>
          <div class="sizelab-specimen-caption">
            <div class="sizelab-size-pill pf-badge-${escapeHtml(sc.pfSizeCategory.toLowerCase())}">
              ${escapeHtml(sc.pfSizeLabel)} (${sc.pfSpaceFt}ft)
            </div>
            <strong class="sizelab-mon-name">${escapeHtml(spec.name.replace(/\s*\(.*?\)/g, ''))}</strong>
            <span class="sizelab-mon-dims"><code>${rawW}×${rawH}px</code> (${deltaSign}${sc.legacyComparison.heightDeltaPct}%)</span>
            <span class="sizelab-mon-prof">${escapeHtml(sc.bodyProportions.approxHeightFt)}ft • ${escapeHtml(sc.visualBodyProfile.replace(/_/g, ' '))}${sc.clamping.wasClamped ? ' • 🛡️Clamp' : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    bodyHtml = `
      <div class="sizelab-lineup-stage" id="sizelab-lineup-stage" data-lineup-fit="${lineupFit.toFixed(3)}">
        <div class="sizelab-horizon-reference-line" title="Human Eye-Level Reference (~5.8 ft Medium Biped)">
          <span>Human Eye-Level (6 ft Medium)</span>
        </div>
        <div class="sizelab-ground-plane-line"></div>
        <div class="sizelab-lineup-row">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="fp-size-comparison-arena" id="fp-size-comparison-arena" data-preset="${escapeHtml(store.currentSizeComparisonPreset)}" data-scale-mode="${escapeHtml(store.currentMonsterScaleMode)}">
      <div class="sizelab-header">
        <div class="sizelab-title-block">
          <div class="sizelab-kicker">⚖️ PATHFINDER 1E MONSTER SIZE &amp; ADAPTIVE VISUAL SCALING ARENA (${vpW}×${vpH})</div>
          <div class="sizelab-subtitle">${escapeHtml(subtitleText)}</div>
        </div>
        <div class="sizelab-header-actions">
          <div class="sizelab-mode-toggle" role="group" aria-label="Scale Mode Toggle">
            <button type="button" class="sizelab-toggle-pill ${isAdaptive ? 'is-active' : ''}" id="sizelab-btn-adaptive" onclick="setMonsterScaleMode('adaptive')">PF1e Adaptive ★</button>
            <button type="button" class="sizelab-toggle-pill ${!isAdaptive ? 'is-active' : ''}" id="sizelab-btn-legacy" onclick="setMonsterScaleMode('legacy')">Legacy Uniform (Before)</button>
          </div>
          <button type="button" class="btn-action-stone" style="padding:3px 9px; font-size:0.7rem;" onclick="toggleMonsterSizeComparisonLab(false)" title="Close Size Comparison Arena [Z / Esc]">✕ Exit Arena</button>
        </div>
      </div>
      <div class="sizelab-tabs-row">
        ${tabsHtml}
      </div>
      ${bodyHtml}
    </div>
  `;
}
