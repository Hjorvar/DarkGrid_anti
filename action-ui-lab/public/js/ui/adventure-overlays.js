/**
 * DARKGRID ADVENTURE LAB — Expedition Pill, Tension Ribbon & Discovery Cards (ES Module)
 */
import { store } from '../state/store.js';
import { escapeHtml, sanitizePlayerContinuityText } from './utils.js';

export function renderAdventureOverlays(state) {
  const adv = state && state.adventure;
  const isAdvEnabled = Boolean(adv && adv.enabled);
  const activeContract = state && state.activeContract;

  const btnCurrent = document.getElementById('exp-mode-btn-current');
  const btnAdventure = document.getElementById('exp-mode-btn-adventure');
  if (btnCurrent) btnCurrent.classList.toggle('is-active-mode', !isAdvEnabled);
  if (btnAdventure) btnAdventure.classList.toggle('is-active-mode', isAdvEnabled);

  const expPillWrap = document.getElementById('fp-expedition-pill-wrap');
  const tensionWrap = document.getElementById('fp-tension-ribbon-wrap');
  const discLayer = document.getElementById('fp-discovery-layer');

  if (!isAdvEnabled) {
    if (expPillWrap) {
      if (activeContract) {
        expPillWrap.innerHTML = `
          <button type="button"
                  class="fp-expedition-pill"
                  id="btn-bounty-tracker-pill"
                  onclick="openLabModal('bounties')"
                  title="Active Bounty Contract — Open Watcher's Board [J]">
            <span class="exp-pill-title">🎯 Bounty: ${escapeHtml(activeContract.contract_title)}</span>
            <span class="exp-pill-sub">Region: ${escapeHtml(activeContract.target_region)} • Reward: ${activeContract.reward_gold} gp</span>
          </button>
        `;
      } else {
        expPillWrap.innerHTML = '';
      }
    }
    if (tensionWrap) {
      tensionWrap.hidden = true;
      tensionWrap.innerHTML = '';
    }
    if (discLayer) {
      discLayer.hidden = true;
      discLayer.innerHTML = '';
    }
    return;
  }

  // 1. Expedition Progress Pill in Top-Right Viewport HUD
  if (expPillWrap) {
    const exp = adv.expedition;
    if (exp) {
      const doneCount = (exp.waypoints || []).filter(w => w.completed).length;
      const totalCount = (exp.waypoints || []).length;
      const nextWp = exp.nextWaypoint;
      const rawWpLabel = nextWp ? String(nextWp.label || 'Explore') : 'Explore';
      const wpDisplay = (nextWp && !rawWpLabel.includes('['))
        ? `${rawWpLabel} [${nextWp.x},${nextWp.y}]`
        : rawWpLabel;
      const bountySuffix = activeContract
        ? ` • 🎯 ${escapeHtml(activeContract.target_region)}`
        : '';
      expPillWrap.innerHTML = `
        <button type="button"
                class="fp-expedition-pill ${exp.isComplete ? 'is-complete' : ''}"
                id="btn-expedition-pill"
                onclick="openLabModal('journal')"
                title="Open Expedition Journal [L]">
          <span class="exp-pill-title">🧭 ${escapeHtml(exp.title)} (${doneCount}/${totalCount})</span>
          <span class="exp-pill-sub">${exp.isComplete ? '🏆 Expedition Complete — View Journal [L]' : `Next: ${escapeHtml(wpDisplay)}${bountySuffix}`}</span>
        </button>
      `;
    } else {
      expPillWrap.innerHTML = '';
    }
  }

  const inCombat = Boolean(state.encounter && state.encounter.status === 'IN_COMBAT');
  const inVictory = Boolean(state.victory);

  // 2. Exploration Tension Ribbon (3-Tier Separation: GENUINE_EVIDENCE vs AMBIENT_TENSION vs ENCOUNTER_INTRO)
  if (tensionWrap) {
    const cue = adv.activeTensionCue;
    if (cue && !inCombat && !inVictory) {
      const tierMeta = {
        GENUINE_EVIDENCE: { badge: '🐾 Genuine Threat Sign', cls: 'tension-genuine' },
        AMBIENT_TENSION: { badge: '🌫️ Ambient Unease', cls: 'tension-ambient' },
        ENCOUNTER_INTRO: { badge: '👁️ Encounter Warning', cls: 'tension-intro' }
      }[cue.tier] || { badge: '🌫️ Field Sign', cls: 'tension-ambient' };

      tensionWrap.hidden = false;
      tensionWrap.innerHTML = `
        <div class="fp-tension-ribbon ${tierMeta.cls}" id="fp-tension-ribbon" data-tension-tier="${escapeHtml(cue.tier)}">
          <span class="fp-tension-badge">${tierMeta.badge}</span>
          <span class="fp-tension-text">${escapeHtml(cue.text)}</span>
        </div>
      `;
    } else {
      tensionWrap.hidden = true;
      tensionWrap.innerHTML = '';
    }
  }

  // 3. Environmental Discovery Layer (3-Tier Presentation Hierarchy: AMBIENT / NOTICEABLE / IMPORTANT)
  if (discLayer) {
    const disc = adv.activeDiscovery;
    const lastRes = adv.lastChoiceResolution;

    if (inCombat || inVictory) {
      discLayer.hidden = true;
      discLayer.innerHTML = '';
      return;
    }

    if (!disc && lastRes && lastRes.step === adv.stepCounter) {
      discLayer.hidden = false;
      discLayer.innerHTML = `
        <div class="fp-discovery-ribbon is-outcome-ribbon" id="fp-discovery-outcome">
          <div class="fp-disc-ribbon-main">
            <span class="fp-disc-tier-badge tier-outcome">✓ ${escapeHtml(lastRes.discoveryTitle)} — ${escapeHtml(lastRes.choiceLabel)}</span>
            <span class="fp-disc-summary">${escapeHtml(lastRes.outcomeText)}</span>
          </div>
          <div class="fp-disc-ribbon-actions">
            <button type="button" class="btn-disc-action" onclick="openLabModal('journal')">📖 Journal [L]</button>
          </div>
        </div>
      `;
      return;
    }

    if (!disc) {
      discLayer.hidden = true;
      discLayer.innerHTML = '';
      return;
    }

    discLayer.hidden = false;
    const tier = disc.tier || 'NOTICEABLE';
    const hasChoices = Array.isArray(disc.choices) && disc.choices.length > 0;
    const isDiscoveryExpanded = Boolean(
      store.expandedDiscoveryKey &&
      (store.expandedDiscoveryKey === true || store.expandedDiscoveryKey === disc.id || store.expandedDiscoveryKey === disc.discoveryKey)
    );

    if (tier === 'AMBIENT' && !isDiscoveryExpanded) {
      discLayer.innerHTML = `
        <div class="fp-discovery-ambient-strip" id="fp-discovery-ambient" data-discovery-id="${escapeHtml(disc.id)}" data-discovery-tier="AMBIENT">
          <span class="fp-disc-icon">${escapeHtml(disc.icon || '🍃')}</span>
          <span class="fp-disc-ambient-title">${escapeHtml(disc.title)}:</span>
          <span class="fp-disc-ambient-text">${escapeHtml(disc.shortText || disc.fullText)}</span>
          ${hasChoices ? `<button type="button" class="btn-disc-inline" onclick="expandDiscoveryCard()">Inspect</button>` : ''}
          <button type="button" class="btn-disc-close" onclick="dismissActiveDiscovery()" title="Dismiss">✕</button>
        </div>
      `;
    } else if (tier === 'NOTICEABLE' && !isDiscoveryExpanded) {
      discLayer.innerHTML = `
        <div class="fp-discovery-ribbon" id="fp-discovery-ribbon" data-discovery-id="${escapeHtml(disc.id)}" data-discovery-tier="NOTICEABLE">
          <div class="fp-disc-ribbon-main">
            <div class="fp-disc-ribbon-header">
              <span class="fp-disc-tier-badge tier-noticeable">${escapeHtml(disc.icon || '🔍')} Field Discovery • ${escapeHtml(disc.category || 'Sign')}</span>
              <span class="fp-disc-title">${escapeHtml(disc.title)}</span>
            </div>
            <div class="fp-disc-summary">${escapeHtml(disc.shortText || disc.fullText)}</div>
          </div>
          <div class="fp-disc-ribbon-actions">
            ${hasChoices ? `
              <button type="button" class="btn-disc-primary" id="btn-disc-expand" onclick="expandDiscoveryCard()">
                🔍 Examine Closer (${disc.choices.length} Options)
              </button>
            ` : ''}
            <button type="button" class="btn-disc-action" onclick="dismissActiveDiscovery()">Leave It</button>
          </div>
        </div>
      `;
    } else {
      // IMPORTANT tier or expanded NOTICEABLE/AMBIENT card
      const choicesHtml = (disc.choices || []).map((c, idx) => `
        <button type="button"
                class="btn-discovery-choice"
                id="btn-discovery-choice-${escapeHtml(c.id)}"
                data-choice-id="${escapeHtml(c.id)}"
                onclick="resolveDiscoveryChoiceClick('${escapeHtml(disc.id)}', '${escapeHtml(c.id)}')">
          <span class="choice-num">[${idx + 1}]</span>
          <span class="choice-body">
            <strong>${escapeHtml(c.label)}</strong>
            <small>${escapeHtml(c.prompt)}</small>
          </span>
        </button>
      `).join('');

      discLayer.innerHTML = `
        <div class="fp-discovery-card" id="fp-discovery-card" data-discovery-id="${escapeHtml(disc.id)}" data-discovery-tier="${escapeHtml(tier)}">
          <div class="fp-disc-card-header">
            <div>
              <div class="fp-disc-card-kicker">${escapeHtml(disc.icon || '🧭')} ${escapeHtml(tier === 'IMPORTANT' ? 'Major Field Discovery' : 'Environmental Discovery')} • ${escapeHtml(disc.category || 'Exploration')}</div>
              <div class="fp-disc-card-title">${escapeHtml(disc.title)}</div>
            </div>
            <button type="button" class="btn-disc-close" onclick="dismissActiveDiscovery()" title="Step past without disturbing">✕</button>
          </div>
          <p class="fp-disc-card-body">${escapeHtml(disc.fullText || disc.shortText)}</p>
          ${choicesHtml ? `
            <div class="fp-disc-choices-grid">
              ${choicesHtml}
            </div>
          ` : ''}
        </div>
      `;
    }
  }
}
