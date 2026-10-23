/**
 * DARKGRID ADVENTURE LAB — Modal System (Character, Pack, Market, Bounties, Atlas, QA, Journal, Director, Help) (ES Module)
 */
import { store, FACING_META } from '../state/store.js';
import { escapeHtml, sanitizePlayerContinuityText } from './utils.js';
import { renderCharacterModal, renderAccountAndCreatorModal } from '../character/character-ui.js';
import { renderBackpackModal, renderMarketModal, renderBountiesModal } from '../inventory/inventory-ui.js';

export function openLabModal(modalName) {
  const labAllowed = !store.currentState || store.currentState.labToolsAllowed !== false;
  if (!labAllowed && ['director', 'atlas', 'qa'].includes(modalName)) {
    return;
  }
  store.currentOpenModal = modalName;
  const backdrop = document.getElementById('lab-modal-backdrop');
  const card = backdrop ? backdrop.querySelector('.lab-modal-card') : null;
  if (card) {
    card.classList.toggle(
      'is-wide-modal',
      modalName === 'atlas' ||
      modalName === 'qa' ||
      modalName === 'journal' ||
      modalName === 'director' ||
      modalName === 'help' ||
      modalName === 'account' ||
      modalName === 'create-character' ||
      modalName === 'character' ||
      modalName === 'market' ||
      modalName === 'bounties' ||
      modalName === 'quests'
    );
  }
  backdrop.hidden = false;
  renderModalContent(modalName);
}

export function closeLabModal() {
  store.currentOpenModal = null;
  const backdrop = document.getElementById('lab-modal-backdrop');
  if (backdrop) backdrop.hidden = true;
}

export function renderModalContent(modalName) {
  const titleEl = document.getElementById('lab-modal-title');
  const bodyEl = document.getElementById('lab-modal-body');
  if (!titleEl || !bodyEl) return;

  if (modalName === 'account' || modalName === 'create-character') {
    renderAccountAndCreatorModal(titleEl, bodyEl);
    return;
  }
  if (modalName === 'atlas') {
    renderAtlasModal(titleEl, bodyEl);
    return;
  }
  if (modalName === 'qa') {
    renderVisualQaModal(titleEl, bodyEl);
    return;
  }
  if (modalName === 'journal') {
    renderJournalModal(titleEl, bodyEl);
    return;
  }
  if (modalName === 'director') {
    renderDirectorModal(titleEl, bodyEl);
    return;
  }
  if (modalName === 'help') {
    renderHelpModal(titleEl, bodyEl);
    return;
  }

  if (!store.currentState || !store.currentState.character) {
    renderAccountAndCreatorModal(titleEl, bodyEl);
    return;
  }
  const hero = store.currentState.character;
  const mods = store.currentState.modifiers;

  if (modalName === 'character') {
    renderCharacterModal(titleEl, bodyEl, hero, mods);
  } else if (modalName === 'backpack' || modalName === 'inventory') {
    renderBackpackModal(titleEl, bodyEl);
  } else if (modalName === 'market') {
    renderMarketModal(titleEl, bodyEl, hero);
  } else if (modalName === 'quests') {
    renderQuestsModal(titleEl, bodyEl);
  } else if (modalName === 'bounties') {
    renderBountiesModal(titleEl, bodyEl);
  }
}

export function renderQuestsModal(titleEl, bodyEl) {
  titleEl.textContent = 'Quests — Oakhaven & Blackwood Forest [J]';
  const st = store.currentState || {};
  const q = st.quest || {
    key: 'THE_GOBLIN_CHIEFTAIN',
    title: 'The Goblin Chieftain',
    description: 'A goblin chieftain has taken control of an old stronghold deep within Blackwood Forest. Travelers are disappearing. Find the stronghold and defeat the chieftain.',
    status: 'NOT_ACCEPTED',
    statusLabel: 'Not Accepted',
    bossSlain: false,
    rewardGold: 100,
    rewardXp: 120,
    canAccept: Boolean(st.isSafeCity),
    canClaimReward: false
  };

  const statusColorMap = {
    NOT_ACCEPTED: '#94a3b8',
    ACTIVE: '#fde68a',
    COMPLETED: '#86efac',
    REWARD_CLAIMED: '#60a5fa'
  };
  const badgeColor = statusColorMap[q.status] || '#fde68a';

  let actionSectionHtml = '';
  if (q.status === 'NOT_ACCEPTED') {
    if (st.isSafeCity) {
      actionSectionHtml = `
        <button type="button" class="btn-action-gold" id="modal-btn-accept-quest" style="padding: 7px 16px; font-size: 0.82rem;" onclick="dispatchAction('ACCEPT_QUEST')">
          ${q.bossSlain ? 'Report Chieftain Slain & Accept Quest' : 'Accept Quest: The Goblin Chieftain'}
        </button>
      `;
    } else {
      actionSectionHtml = `
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Return to <strong>Oakhaven Sanctuary [7, 7]</strong> to formally accept this quest from Captain Vane (or venture directly to the Goblin Stronghold at <strong>[7, 1]</strong>).
        </div>
      `;
    }
  } else if (q.status === 'ACTIVE') {
    actionSectionHtml = `
      <div style="font-size: 0.80rem; color: #fde68a;">
        <strong>Objective:</strong> Travel North through Blackwood Forest to the <strong>Goblin Stronghold [7, 1]</strong> and defeat <strong>Warchief Grak the Goblin Chieftain</strong>.
      </div>
    `;
  } else if (q.status === 'COMPLETED') {
    if (st.isSafeCity) {
      actionSectionHtml = `
        <button type="button" class="btn-action-gold" id="modal-btn-claim-quest-reward" style="padding: 7px 16px; font-size: 0.82rem;" onclick="dispatchAction('CLAIM_QUEST_REWARD')">
          Claim Reward (+${q.rewardGold} Gold, +${q.rewardXp} XP)
        </button>
      `;
    } else {
      actionSectionHtml = `
        <div style="font-size: 0.80rem; color: #86efac; font-weight: 600;">
          Warchief Grak is slain! Return South to <strong>Oakhaven Sanctuary [7, 7]</strong> to claim your reward (+${q.rewardGold} Gold &amp; +${q.rewardXp} XP).
        </div>
      `;
    }
  } else if (q.status === 'REWARD_CLAIMED') {
    actionSectionHtml = `
      <div style="font-size: 0.80rem; color: #86efac; font-weight: 600;">
        Quest Complete &amp; Reward Claimed — Oakhaven honors your victory over the Goblin Stronghold!
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <div class="qa-card" style="padding: 16px 18px; border-color: var(--border-gold);">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px; margin-bottom: 12px;">
        <div>
          <div style="font-family: var(--font-serif); font-size: 1.05rem; font-weight: 800; color: var(--accent-gold-bright);">
            ${escapeHtml(q.title)}
          </div>
          <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
            Given by Captain Vane • Oakhaven Sanctuary [7, 7] • Target: Goblin Stronghold [7, 1]
          </div>
        </div>
        <span class="lab-badge" id="quest-status-badge" style="font-size: 0.75rem; padding: 4px 10px; color: ${badgeColor}; border-color: ${badgeColor};">
          Status: ${escapeHtml(q.statusLabel)}
        </span>
      </div>

      <p style="font-size: 0.86rem; color: var(--text-body); line-height: 1.5; font-style: italic; margin: 0 0 14px 0; padding: 10px 14px; background: rgba(9, 12, 18, 0.65); border-left: 3px solid var(--accent-gold); border-radius: 4px;">
        “${escapeHtml(q.description)}”
      </p>

      <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; font-family: var(--font-mono); font-size: 0.80rem;">
        <span style="color: var(--accent-gold-bright);">Reward: <strong>+${q.rewardGold} Gold</strong></span>
        <span style="color: #93c5fd;">Experience: <strong>+${q.rewardXp} XP</strong></span>
        <span style="color: ${q.bossSlain ? '#86efac' : '#fca5a5'};">Stronghold Chieftain: <strong>${q.bossSlain ? 'Defeated' : 'Alive at [7, 1]'}</strong></span>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
        ${actionSectionHtml}
      </div>
    </div>
  `;
}

export function selectAtlasTile(x, y) {
  store.selectedAtlasCoord = { x: Number(x), y: Number(y) };
  if (store.currentOpenModal === 'atlas') {
    const titleEl = document.getElementById('lab-modal-title');
    const bodyEl = document.getElementById('lab-modal-body');
    if (titleEl && bodyEl) renderAtlasModal(titleEl, bodyEl);
  }
}

export function setAtlasFilter(filterKey) {
  store.currentAtlasFilter = filterKey;
  if (store.currentOpenModal === 'atlas') {
    const titleEl = document.getElementById('lab-modal-title');
    const bodyEl = document.getElementById('lab-modal-body');
    if (titleEl && bodyEl) renderAtlasModal(titleEl, bodyEl);
  }
}

export async function renderAtlasModal(titleEl, bodyEl) {
  titleEl.textContent = '🗺️ World Visual Atlas — First-Person POV Coverage & Inspector [V]';
  if (!store.cachedAtlasData) {
    bodyEl.innerHTML = '<div class="lab-item-row"><span>Loading 15×15 World Visual Atlas...</span></div>';
    try {
      const res = await fetch('/api/atlas');
      store.cachedAtlasData = await res.json();
    } catch (err) {
      bodyEl.innerHTML = `<div class="lab-item-row"><span>Failed to load World Visual Atlas: ${escapeHtml(err.message)}</span></div>`;
      return;
    }
  }

  const atlas = store.cachedAtlasData;
  const sum = atlas.summary || {};
  const tiles = atlas.tiles || [];

  // Default selected tile to current hero tile if not yet selected
  if (!store.selectedAtlasCoord || typeof store.selectedAtlasCoord.x !== 'number') {
    if (store.currentState && store.currentState.currentTile) {
      store.selectedAtlasCoord = { x: store.currentState.currentTile.x, y: store.currentState.currentTile.y };
    } else {
      store.selectedAtlasCoord = { x: 7, y: 7 };
    }
  }

  const tileByKey = new Map();
  tiles.forEach(t => tileByKey.set(`${t.x},${t.y}`, t));
  const selectedTile = tileByKey.get(`${store.selectedAtlasCoord.x},${store.selectedAtlasCoord.y}`) || tiles[0];

  const heroX = store.currentState && store.currentState.currentTile ? store.currentState.currentTile.x : -1;
  const heroY = store.currentState && store.currentState.currentTile ? store.currentState.currentTile.y : -1;

  // Build 15x15 Grid HTML
  const gridCellsHtml = [];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const t = tileByKey.get(`${x},${y}`);
      if (!t) continue;
      const isSelected = (x === selectedTile.x && y === selectedTile.y);
      const isHero = (x === heroX && y === heroY);
      const bestGrade = t.bestGrade || 'C';

      let matchesFilter = true;
      if (store.currentAtlasFilter === 'A') {
        matchesFilter = Object.values(t.directions || {}).some(d => d.qualityGrade === 'A');
      } else if (store.currentAtlasFilter === 'B') {
        matchesFilter = Object.values(t.directions || {}).some(d => d.qualityGrade === 'B');
      } else if (store.currentAtlasFilter === 'C') {
        matchesFilter = Object.values(t.directions || {}).some(d => d.qualityGrade === 'C');
      } else if (store.currentAtlasFilter === 'POI') {
        matchesFilter = Boolean(t.hasPoi);
      } else if (store.currentAtlasFilter === 'PASSABLE') {
        matchesFilter = Boolean(t.isPassable);
      }

      const cellClasses = [
        'atlas-cell',
        !t.isPassable ? 'is-impassable' : '',
        t.isPassable ? `grade-${bestGrade.toLowerCase()}-tile` : '',
        isSelected ? 'is-selected' : '',
        isHero ? 'is-hero-here' : ''
      ].filter(Boolean).join(' ');

      const dimStyle = matchesFilter ? '' : 'opacity: 0.18;';
      const poiDot = t.hasPoi ? '<span class="atlas-cell-poi-dot" title="Point of Interest"></span>' : '';
      const gradeBadge = t.isPassable ? `<span class="atlas-cell-grade">${escapeHtml(bestGrade)}</span>` : '';

      gridCellsHtml.push(`
        <div class="${cellClasses}"
             style="${dimStyle}"
             onclick="selectAtlasTile(${x}, ${y})"
             title="[${x},${y}] ${escapeHtml(t.name)} (${escapeHtml(t.terrain)}) • Best Grade: ${bestGrade}">
          ${poiDot}
          <span>${escapeHtml(t.symbol || '·')}</span>
          ${gradeBadge}
        </div>
      `);
    }
  }

  // Build Selected Tile 4-Direction Inspector
  const dirs = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
  const dirCardsHtml = dirs.map(dir => {
    const dInfo = (selectedTile.directions && selectedTile.directions[dir]) || {};
    const grade = dInfo.qualityGrade || 'C';
    const ahead = dInfo.aheadTile || {};
    const poi = dInfo.pointOfInterest;
    const eff = dInfo.effectProfile || {};
    return `
      <div class="atlas-dir-card">
        <div class="atlas-dir-thumb-wrap">
          <img src="${escapeHtml(dInfo.imageUrl || '')}" alt="${escapeHtml(selectedTile.name)} ${dir}" class="atlas-dir-thumb" loading="lazy">
          <span class="atlas-dir-badge">${dir}</span>
          <span class="atlas-grade-badge grade-${grade}">${grade}: ${escapeHtml(dInfo.qualityLabel || '')}</span>
        </div>
        <div class="atlas-dir-meta">
          <div class="atlas-dir-title">${escapeHtml(dInfo.viewTitle || selectedTile.name)}</div>
          <div class="atlas-dir-sub">${escapeHtml(dInfo.viewSubtitle || '')}</div>
          <div class="atlas-dir-tags">
            <span class="atlas-tag">Tier ${dInfo.povTier || 4} (${escapeHtml(dInfo.sourceType || 'Fallback')})</span>
            <span class="atlas-tag">Ahead: ${escapeHtml(ahead.name || 'Edge')} (${ahead.isPassable ? 'Open' : 'Blocked'})</span>
            <span class="atlas-tag">Surface: ${escapeHtml((dInfo.stageAnchor && dInfo.stageAnchor.groundSurfaceType) || 'wilderness-soil')}</span>
            <span class="atlas-tag">FX: ${escapeHtml(eff.label || 'None')}</span>
            ${poi ? `<span class="atlas-tag" style="color:#fde68a; border-color:#c5a059;">🔍 POI: ${escapeHtml(poi.title)}</span>` : ''}
          </div>
          ${selectedTile.isPassable ? `
            <div style="margin-top: 4px; display: flex; justify-content: flex-end;">
              <button type="button" class="btn-action-gold" style="padding: 3px 9px; font-size: 0.68rem;" onclick="triggerTeleport(${selectedTile.x}, ${selectedTile.y}, '${dir}')">
                ⚡ Teleport (${dir})
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  const pCounts = sum.passableGradeCounts || { A: 0, B: 0, C: 0, D: 0 };

  bodyEl.innerHTML = `
    <div class="atlas-summary-strip">
      <div class="atlas-stat-pill">
        <span class="stat-val">${sum.passableViewpoints || 640}</span>
        <span class="stat-lbl">Passable POVs (${sum.passableTiles || 160} Tiles)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:#86efac;">${pCounts.A || 0}</span>
        <span class="stat-lbl">Grade A (Bespoke POV)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:#93c5fd;">${pCounts.B || 0}</span>
        <span class="stat-lbl">Grade B (Contextual POV)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:#fde68a;">${pCounts.C || 0}</span>
        <span class="stat-lbl">Grade C (Generic Safe)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:${(pCounts.D || 0) === 0 ? '#86efac' : '#fca5a5'};">${pCounts.D || 0}</span>
        <span class="stat-lbl">Grade D (Needs Art)</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${sum.uniqueImagesUsed || 0}</span>
        <span class="stat-lbl">Unique Paintings Used</span>
      </div>
    </div>

    <div class="atlas-filter-bar">
      <span style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">Filter Map:</span>
      ${[
        { key: 'ALL', label: 'All Tiles (225)' },
        { key: 'PASSABLE', label: `Passable (${sum.passableTiles || 160})` },
        { key: 'A', label: 'Has Grade A Bespoke' },
        { key: 'B', label: 'Has Grade B Contextual' },
        { key: 'C', label: 'Has Grade C Generic' },
        { key: 'POI', label: `🔍 Points of Interest (${sum.pointsOfInterestCount || 0})` }
      ].map(f => `
        <button type="button"
                class="lab-btn ${store.currentAtlasFilter === f.key ? 'is-active-mode' : ''}"
                onclick="setAtlasFilter('${f.key}')">
          ${escapeHtml(f.label)}
        </button>
      `).join('')}
    </div>

    <div class="atlas-layout">
      <div class="atlas-grid-panel">
        <div style="font-family:var(--font-serif); font-size:0.78rem; color:var(--accent-gold); font-weight:700;">
          15×15 World Grid (Click any tile to inspect 4 directions)
        </div>
        <div class="atlas-15x15-grid" id="atlas-15x15-grid">
          ${gridCellsHtml.join('')}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.66rem; color:var(--text-muted); font-family:var(--font-mono);">
          <span>🟢 Grade A • 🔵 Grade B • 🟡 Grade C</span>
          <span>🟡 Dot = Inspectable POI</span>
        </div>
      </div>

      <div class="atlas-inspector-panel" id="atlas-inspector-panel">
        <div class="atlas-inspector-header">
          <div>
            <div style="font-family:var(--font-serif); font-size:0.95rem; font-weight:700; color:var(--accent-gold-bright);">
              [${selectedTile.x}, ${selectedTile.y}] ${escapeHtml(selectedTile.name)}
            </div>
            <div style="font-size:0.73rem; color:var(--text-muted);">
              Terrain: <strong>${escapeHtml(selectedTile.terrain)}</strong> • Sub-Biome: <strong>${escapeHtml(selectedTile.subBiome)}</strong> • ${selectedTile.isPassable ? 'Passable' : 'Impassable Barrier'}
            </div>
          </div>
          ${selectedTile.isPassable ? `
            <button type="button" class="btn-action-gold" style="padding: 5px 12px; font-size: 0.74rem;" onclick="triggerTeleport(${selectedTile.x}, ${selectedTile.y}, 'NORTH')">
              ⚡ Teleport to [${selectedTile.x}, ${selectedTile.y}]
            </button>
          ` : ''}
        </div>
        <div class="atlas-dir-grid">
          ${dirCardsHtml}
        </div>
      </div>
    </div>
  `;
}

export async function renderVisualQaModal(titleEl, bodyEl) {
  titleEl.textContent = '📊 Visual QA & Expedition Verification Suite';
  bodyEl.innerHTML = '<div class="lab-item-row"><span>Loading Visual QA & Asset Verification Report...</span></div>';
  try {
    const res = await fetch('/api/visual-qa');
    const qa = await res.json();
    const sum = qa.atlasSummary || {};
    const pCounts = sum.passableGradeCounts || {};
    const monsters = qa.integratedMonsters || [];
    const pois = qa.pointsOfInterest || [];
    const fxProfiles = qa.atmosphereProfiles || [];
    const results = qa.automatedVisualQaResults;

    bodyEl.innerHTML = `
      <div class="atlas-summary-strip">
        <div class="atlas-stat-pill">
          <span class="stat-val" style="color:#86efac;">${(pCounts.D || 0) === 0 ? '100% PASS' : 'WARN'}</span>
          <span class="stat-lbl">Zero Grade-D Views (${pCounts.D || 0} Missing)</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val">${sum.uniqueImagesUsed || 0}</span>
          <span class="stat-lbl">Active Environment Paintings</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val">${monsters.length}</span>
          <span class="stat-lbl">Integrated Cutout Monsters</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val">${fxProfiles.length}</span>
          <span class="stat-lbl">Atmospheric Effect Profiles</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val">${pois.length}</span>
          <span class="stat-lbl">Inspectable Lore Landmarks</span>
        </div>
        <div class="atlas-stat-pill">
          <span class="stat-val" style="color:#86efac;">${results ? `${results.passedChecks}/${results.totalChecks}` : 'Ready'}</span>
          <span class="stat-lbl">Headless Chrome Checks</span>
        </div>
      </div>

      <div style="font-family:var(--font-serif); font-size:0.84rem; color:var(--accent-gold); font-weight:700; margin-top:4px;">
        👹 Integrated Monster Cutout Rigs (${monsters.length} Active + Automatic Card Fallback)
      </div>
      <div class="qa-section-grid">
        ${monsters.map(m => `
          <div class="qa-card">
            <div class="qa-card-title">
              <span>${escapeHtml(m.key)}</span>
              <span class="qa-pass-badge">${escapeHtml(m.groundingMode)}</span>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted);">
              Size: <strong>${escapeHtml(m.sizeCategory)}</strong> • Contact Patches: <strong>${m.contactCount}</strong><br>
              Asset: <code>${escapeHtml(m.cutoutImageUrl)}</code>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="font-family:var(--font-serif); font-size:0.84rem; color:var(--accent-gold); font-weight:700; margin-top:6px;">
        🔍 Inspectable Points of Interest (${pois.length} Landmarks)
      </div>
      <div class="qa-section-grid">
        ${pois.map(p => `
          <div class="qa-card">
            <div class="qa-card-title">
              <span>${escapeHtml(p.title)}</span>
              <button type="button" class="btn-action-gold" style="padding:2px 8px; font-size:0.66rem;" onclick="triggerTeleport(${p.x}, ${p.y}, '${(p.facings && p.facings[0]) || 'NORTH'}')">
                ⚡ Visit [${p.x},${p.y}]
              </button>
            </div>
            <div style="font-size:0.71rem; color:var(--text-muted);">
              Category: <strong>${escapeHtml(p.category)}</strong> • Facings: <strong>${escapeHtml((p.facings || []).join(', '))}</strong>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    bodyEl.innerHTML = `<div class="lab-item-row"><span>Failed to load Visual QA data: ${escapeHtml(err.message)}</span></div>`;
  }
}

/* =========================================================================
   12.6 EXPEDITION JOURNAL & DIRECTOR DRAWERS (Phase 3 — Adventure Experience)
   ========================================================================= */
export function renderJournalModal(titleEl, bodyEl) {
  titleEl.textContent = '📖 Expedition Journal & Adventure Memory [L]';
  const adv = (store.currentState && store.currentState.adventure) || {};
  const isEnabled = Boolean(adv.enabled);
  const exp = adv.expedition;
  const availableExps = adv.availableExpeditions || [];
  const journal = adv.journal || [];
  const stats = adv.stats || {};

  const expSelectorHtml = availableExps.map(def => {
    const isActive = exp && exp.key === def.key;
    return `
      <div class="journal-exp-card ${isActive ? 'is-active-exp' : ''}">
        <div class="journal-exp-header">
          <div>
            <div class="journal-exp-title">🧭 ${escapeHtml(def.title)}</div>
            <div class="journal-exp-sub">${escapeHtml(def.subtitle)}</div>
          </div>
          <button type="button"
                  class="${isActive ? 'btn-action-gold' : 'btn-action-stone'}"
                  style="padding: 4px 10px; font-size: 0.72rem;"
                  onclick="startExpeditionRoute('${escapeHtml(def.key)}')">
            ${isActive ? '↻ Restart Expedition' : '▶ Embark'}
          </button>
        </div>
        <p class="journal-exp-summary">${escapeHtml(def.summary)}</p>
      </div>
    `;
  }).join('');

  const waypointsHtml = exp
    ? (exp.waypoints || []).map((wp, idx) => `
        <div class="journal-waypoint-row ${wp.completed ? 'is-done' : ''}">
          <span class="wp-status-icon">${wp.completed ? '✓' : (idx + 1)}</span>
          <div class="wp-meta">
            <div class="wp-label">${escapeHtml(wp.label)} <span style="font-family:var(--font-mono); color:var(--text-muted);">[${wp.x},${wp.y}]</span></div>
            <div class="wp-prompt">${escapeHtml(wp.prompt)}</div>
          </div>
          ${wp.completed ? `<span class="qa-pass-badge">Reached (Step ${wp.completedAtStep || 0})</span>` : ''}
        </div>
      `).join('')
    : '<div class="lab-item-row"><span>Select an Expedition Route above to track waypoints.</span></div>';

  const journalRowsHtml = journal.length > 0
    ? journal.slice(0, 25).map(entry => {
        const typeBadgeMap = {
          EXPEDITION_START: { icon: '🧭', label: 'Expedition Embarked', color: '#93c5fd' },
          WAYPOINT: { icon: '🚩', label: 'Waypoint Reached', color: '#86efac' },
          EXPEDITION_COMPLETE: { icon: '🏆', label: 'Expedition Complete', color: '#fde68a' },
          DISCOVERY: { icon: '🔍', label: 'Field Discovery', color: '#e6be6e' },
          CHOICE: { icon: '⚖️', label: 'Decision Taken', color: '#c4b5fd' },
          POI_INSPECTED: { icon: '🏛️', label: 'Landmark Inspected', color: '#fde68a' },
          ENCOUNTER_START: { icon: '👁️', label: 'Threat Encountered', color: '#fca5a5' },
          ENCOUNTER_VICTORY: { icon: '⚔️', label: 'Threat Vanquished', color: '#86efac' },
          ENCOUNTER_FLEE: { icon: '🏃', label: 'Retreated Alive', color: '#cbd5e1' },
          ENCOUNTER_DEFEAT: { icon: '💀', label: 'Fallen in Battle', color: '#ef4444' }
        };
        const meta = typeBadgeMap[entry.type] || { icon: '•', label: entry.type || 'Note', color: '#c5a059' };
        return `
          <div class="journal-log-entry">
            <div class="journal-log-top">
              <span class="journal-log-badge" style="color:${meta.color}; border-color:${meta.color}44;">${meta.icon} ${escapeHtml(meta.label)}</span>
              <span class="journal-log-title">${escapeHtml(entry.title)}</span>
              <span class="journal-log-coord">${entry.coords ? `[${entry.coords.x},${entry.coords.y}]` : ''} • Step ${entry.step || 0}</span>
            </div>
            <div class="journal-log-detail">${escapeHtml(entry.detail)}</div>
          </div>
        `;
      }).join('')
    : '<div class="lab-item-row"><span>No expedition field notes recorded yet. Step out from Oakhaven to begin your chronicle.</span></div>';

  bodyEl.innerHTML = `
    <div class="atlas-summary-strip">
      <div class="atlas-stat-pill">
        <span class="stat-val" style="color:${isEnabled ? '#86efac' : '#fde68a'};">${isEnabled ? 'ADVENTURE ★' : 'CURRENT'}</span>
        <span class="stat-lbl">Active Experience Mode</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.stepsTaken || 0}</span>
        <span class="stat-lbl">Expedition Steps</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.discoveriesFound || 0} / ${adv.totalDiscoveriesInCatalog || 18}</span>
        <span class="stat-lbl">Field Discoveries Found</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.choicesResolved || 0}</span>
        <span class="stat-lbl">Contextual Decisions</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.poisInspectedCount || 0}</span>
        <span class="stat-lbl">Landmarks Inspected</span>
      </div>
      <div class="atlas-stat-pill">
        <span class="stat-val">${stats.encountersWon || 0}W / ${stats.encountersFled || 0}F</span>
        <span class="stat-lbl">Combat Encounters</span>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
      <div style="font-size:0.76rem; color:var(--text-muted);">
        Compare <strong>Current Experience</strong> (baseline exploration) vs. <strong>Adventure Experience ★</strong> (discoveries, tension tiers, choices & expedition arcs).
      </div>
      <div style="display:flex; gap:6px;">
        <button type="button" class="lab-btn ${!isEnabled ? 'is-active-mode' : ''}" onclick="setAdventureExperienceMode(false)">Use Current Experience</button>
        <button type="button" class="lab-btn ${isEnabled ? 'is-active-mode' : ''}" onclick="setAdventureExperienceMode(true)">Use Adventure Experience ★</button>
        <button type="button" class="btn-action-stone" style="padding:3px 9px; font-size:0.7rem;" onclick="resetExpeditionRoute(true)">↺ Reset Log & Return to Oakhaven</button>
      </div>
    </div>

    <div class="journal-modal-grid">
      <div class="journal-column">
        <div class="journal-section-heading">🧭 Playable Expedition Arcs</div>
        <div class="journal-exp-list">
          ${expSelectorHtml}
        </div>
        <div class="journal-section-heading" style="margin-top:6px;">
          🚩 Active Route Waypoints ${exp ? `— ${escapeHtml(exp.title)}` : ''}
        </div>
        <div class="journal-waypoint-list" id="journal-waypoint-list">
          ${waypointsHtml}
        </div>
      </div>

      <div class="journal-column">
        <div class="journal-section-heading">📜 Field Chronicle & Adventure Memory (${journal.length} Entries)</div>
        <div class="journal-log-list" id="journal-log-list">
          ${journalRowsHtml}
        </div>
      </div>
    </div>
  `;
}

export function renderDirectorModal(titleEl, bodyEl) {
  titleEl.textContent = '🎬 Lab Director & Scenario Staging Controls [G]';
  const adv = (store.currentState && store.currentState.adventure) || {};
  bodyEl.innerHTML = `
    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:6px;">
      Stage combat encounters, test monster cutouts, trigger environmental discoveries, or teleport across the 15×15 Darkgrid world.
    </div>

    <div class="director-modal-grid">
      <div class="qa-card">
        <div class="qa-card-title"><span>⚡ Core Scenario Staging</span></div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          <button type="button" class="btn-action-gold" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('CITY'); closeLabModal();">🏰 Oakhaven Safe City</button>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('WILDERNESS'); closeLabModal();">🌲 Forest Trail [7,6]</button>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('SHADOW'); closeLabModal();">👁️ Shadow in Mist</button>
          <button type="button" class="btn-action-gold" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('COMBAT'); closeLabModal();">⚔️ Stage Active Combat</button>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('WOUNDED'); closeLabModal();">🩸 Critical HP (3 HP)</button>
          <button type="button" class="btn-action-stone" style="padding:4px 10px; font-size:0.74rem;" onclick="triggerLabScenario('HEAL'); closeLabModal();">✨ Restore Full Vitals</button>
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>👹 Spawn Integrated Cutouts (37 Active) & Card Fallbacks (61 Active)</span></div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          ${[
            { key: 'stirge', label: '🦇 Stirge (Tiny Cutout)' },
            { key: 'goblin', label: '👺 Goblin (Small Cutout)' },
            { key: 'dire_rat', label: '🐀 Dire Rat (Small Cutout)' },
            { key: 'human_skeleton', label: '💀 Skeleton (Medium Cutout)' },
            { key: 'wolf', label: '🐺 Wolf (Medium Cutout)' },
            { key: 'giant_spider', label: '🕷️ Giant Spider (Wide Cutout)' },
            { key: 'rust_monster', label: '🦀 Rust Monster (Wide Cutout)' },
            { key: 'assassin_vine', label: '🌿 Assassin Vine (Large Cutout)' },
            { key: 'troll', label: '👹 Troll (Large Cutout)' },
            { key: 'owlbear', label: '🦉 Owlbear (Large Cutout)' },
            { key: 'manticore', label: '🦁 Manticore (Airborne Cutout)' },
            { key: 'wyvern', label: '🐉 Wyvern (Airborne Cutout)' },
            { key: 'ochre_jelly', label: '🟡 Ochre Jelly (Ooze Cutout)' },
            { key: 'choker', label: '🛡️ Choker (Card Fallback)' },
            { key: 'displacer_beast', label: '🛡️ Displacer Beast (Card Fallback)' }
          ].map(m => `
            <button type="button" class="btn-action-stone" style="padding:4px 9px; font-size:0.72rem;" onclick="triggerSpawnMonster('${m.key}'); closeLabModal();">
              ${escapeHtml(m.label)}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>🧭 Stage Environmental Discovery (Adventure Mode)</span></div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          ${[
            { id: 'disc_mirkwood_abandoned_camp', label: '⛺ Abandoned Scout Camp (Important)' },
            { id: 'disc_ancient_oak_sap_shrine', label: '🌳 Warden’s Hollow at Black Oak (Important)' },
            { id: 'disc_crossroads_frontier_sign', label: '🪵 Ranger Tally-Post (Noticeable)' },
            { id: 'disc_watchpost_garrison_ledger', label: '🏚️ Watchpost Guardroom (Important)' },
            { id: 'disc_bridge_parapet_gouges', label: '🌉 Breached Bridge Parapet (Noticeable)' },
            { id: 'disc_fen_submerged_gear', label: '🎒 Submerged Expedition Pack (Important)' },
            { id: 'disc_plains_wayfarer_shrine', label: '🕯️ Roadside Wayfarer Shrine (Important)' },
            { id: 'disc_forest_claw_bark', label: '🐾 Claw-Scored Trunk (Ambient)' }
          ].map(d => `
            <button type="button" class="btn-action-stone" style="padding:4px 9px; font-size:0.72rem;" onclick="forceTriggerDiscovery('${d.id}'); closeLabModal();">
              ${escapeHtml(d.label)}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>🎲 Deterministic Pacing Seed & Hero Class</span></div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; align-items:center;">
          <span style="font-size:0.72rem; color:var(--text-muted);">Current Seed: <code>${adv.deterministicSeed !== null && adv.deterministicSeed !== undefined ? adv.deterministicSeed : 'Live Random'}</code></span>
          <button type="button" class="lab-btn" onclick="setDeterministicSeed(42)">Seed #42 (Deterministic)</button>
          <button type="button" class="lab-btn" onclick="setDeterministicSeed(null)">Live Random</button>
          <button type="button" class="lab-btn" onclick="switchHeroClass('FIGHTER')">⚔️ Fighter</button>
          <button type="button" class="lab-btn" onclick="switchHeroClass('RANGER')">🏹 Ranger</button>
          <button type="button" class="lab-btn" onclick="switchHeroClass('CLERIC')">✨ Cleric</button>
        </div>
      </div>
    </div>
  `;
}

export function renderHelpModal(titleEl, bodyEl) {
  titleEl.textContent = '❓ Controls, Tactical Guide & Keyboard Shortcuts [?]';
  bodyEl.innerHTML = `
    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:6px;">
      Darkgrid Adventure Lab can be played entirely with the mouse or with rapid first-person keyboard controls.
    </div>

    <div class="director-modal-grid" id="help-controls-grid">
      <div class="qa-card">
        <div class="qa-card-title"><span>🧭 First-Person Navigation</span></div>
        <div style="display:flex; flex-direction:column; gap:5px; font-size:0.76rem; color:var(--text-body); margin-top:4px;">
          <div><kbd class="help-kbd">W</kbd> / <kbd class="help-kbd">↑</kbd> — Step Forward (relative to hero facing)</div>
          <div><kbd class="help-kbd">S</kbd> / <kbd class="help-kbd">↓</kbd> — Step Backward (retreat one tile)</div>
          <div><kbd class="help-kbd">A</kbd> / <kbd class="help-kbd">←</kbd> — Turn 90° Counter-Clockwise</div>
          <div><kbd class="help-kbd">D</kbd> / <kbd class="help-kbd">→</kbd> — Turn 90° Clockwise</div>
          <div><kbd class="help-kbd">Q</kbd> / <kbd class="help-kbd">E</kbd> — Strafe Left / Strafe Right</div>
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>⚔️ Tactical Action Deck</span></div>
        <div style="display:flex; flex-direction:column; gap:5px; font-size:0.76rem; color:var(--text-body); margin-top:4px;">
          <div><kbd class="help-kbd">Space</kbd> / <kbd class="help-kbd">1</kbd> — Primary Action (Strike / Engage / Rest / Inspect)</div>
          <div><kbd class="help-kbd">2</kbd> — Drink Healing Potion Flask</div>
          <div><kbd class="help-kbd">3</kbd> / <kbd class="help-kbd">R</kbd> — Swap Weapon Stance (Melee ⇄ Ranged, outside combat)</div>
          <div><kbd class="help-kbd">4</kbd> / <kbd class="help-kbd">F</kbd> — Flee Battle (2-step confirm) / Slip Past / Cleric Heal</div>
          <div><kbd class="help-kbd">I</kbd> — Inspect Landmark Point of Interest (when available)</div>
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>🎒 Champion & World Drawers</span></div>
        <div style="display:flex; flex-direction:column; gap:5px; font-size:0.76rem; color:var(--text-body); margin-top:4px;">
          <div><kbd class="help-kbd">C</kbd> — Open Champion Sheet (Attributes & Modifiers)</div>
          <div><kbd class="help-kbd">B</kbd> — Open Equipment & Backpack</div>
          <div><kbd class="help-kbd">M</kbd> — Open Oakhaven Market</div>
          <div><kbd class="help-kbd">J</kbd> — Open The Watcher’s Board (Bounty Contracts)</div>
          <div><kbd class="help-kbd">L</kbd> — Open Expedition Journal & Adventure Memory</div>
          <div><kbd class="help-kbd">H</kbd> — Expand / Collapse Bottom Chronicle History</div>
        </div>
      </div>

      <div class="qa-card">
        <div class="qa-card-title"><span>🛠️ Lab & Developer Tools</span></div>
        <div style="display:flex; flex-direction:column; gap:5px; font-size:0.76rem; color:var(--text-body); margin-top:4px;">
          <div><kbd class="help-kbd">~</kbd> / <kbd class="help-kbd">\`</kbd> — Toggle Lab Tools Drawer (Player vs. Developer Mode)</div>
          <div><kbd class="help-kbd">G</kbd> — Open Lab Director (Stage Combat, Cutouts & Discoveries)</div>
          <div><kbd class="help-kbd">V</kbd> — Open 15×15 World Visual Atlas Inspector</div>
          <div><kbd class="help-kbd">Z</kbd> — Toggle PF1e Monster Size & Scaling Comparison Arena</div>
          <div><kbd class="help-kbd">Esc</kbd> — Close active Modal, Landmark Plaque, or Size Arena</div>
        </div>
      </div>
    </div>
  `;
}
