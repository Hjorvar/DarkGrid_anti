/**
 * DARKGRID ADVENTURE LAB — Bottom Narrative Chronicle & History Drawer (ES Module)
 */
import { store } from '../state/store.js';
import { escapeHtml, sanitizePlayerContinuityText } from './utils.js';

export function toggleChronicleHistory(forceExpanded = null) {
  if (typeof forceExpanded === 'boolean') {
    store.isChronicleExpanded = forceExpanded;
  } else {
    store.isChronicleExpanded = !store.isChronicleExpanded;
  }
  const chron = document.getElementById('fp-bottom-chronicle');
  if (chron) {
    chron.classList.toggle('is-chronicle-expanded', store.isChronicleExpanded);
  }
  const btn = document.getElementById('btn-toggle-chronicle');
  if (btn) {
    btn.setAttribute('aria-expanded', String(store.isChronicleExpanded));
    btn.classList.toggle('is-active', store.isChronicleExpanded);
    const lbl = document.getElementById('lbl-toggle-chronicle') || document.getElementById('chronicle-toggle-lbl');
    if (lbl) {
      lbl.textContent = store.isChronicleExpanded ? '▾ Compact' : '📜 History';
    }
  }
  if (store.currentState && store.currentState.mode !== 'FALLEN' && !store.isSequencePlaying) {
    renderBottomChronicle(store.currentState);
  }
}

export function recordChronicleHistoryLine(htmlLine, plainKey) {
  if (!htmlLine) return;
  const key = plainKey || htmlLine;
  if (store.chronicleHistoryBuffer.length > 0 && store.chronicleHistoryBuffer[store.chronicleHistoryBuffer.length - 1].key === key) {
    return;
  }
  store.chronicleHistoryBuffer.push({ key, html: htmlLine });
  if (store.chronicleHistoryBuffer.length > 28) {
    store.chronicleHistoryBuffer.shift();
  }
}

export function renderBottomChronicle(state) {
  const titleEl = document.getElementById('fp-chronicle-title');
  const linesEl = document.getElementById('fp-chronicle-lines');
  const enc = state.encounter;

  const feedbackBanner = [];
  if (state.errorMessage) {
    const errHtml = `<div class="fp-log-line monster_attack">⚠️ ${escapeHtml(state.errorMessage)}</div>`;
    feedbackBanner.push(errHtml);
    recordChronicleHistoryLine(errHtml, `ERR:${state.errorMessage}`);
  }
  if (state.infoMessage) {
    const infoHtml = `<div class="fp-log-line potion_used">🕯️ ${escapeHtml(state.infoMessage)}</div>`;
    feedbackBanner.push(infoHtml);
    recordChronicleHistoryLine(infoHtml, `INFO:${state.infoMessage}`);
  }

  if (enc && enc.status === 'IN_COMBAT') {
    const events = Array.isArray(enc.currentRoundEvents) ? enc.currentRoundEvents : [];
    const iconByType = {
      OPENING_SHOT: '🏹',
      HERO_ATTACK: '⚔️',
      TURN_UNDEAD: '✨',
      BATTLE_PRAYER: '🙏',
      SMITE: '☀️',
      DIVINE_SHIELD: '🛡️',
      SECOND_WIND: '🛡️',
      MONSTER_ATTACK: '🩸',
      MONSTER_ABILITY: '⚡',
      STATUS_EFFECT: '☠️',
      POTION_USED: '🧪',
      FLEE: '🏃'
    };

    const currentRoundHtmlLines = [];
    if (events.length > 0) {
      events.forEach((ev, idx) => {
        const ic = iconByType[ev.event_type] || '•';
        const lineHtml = `<div class="fp-log-line ${(ev.event_type || '').toLowerCase()}">${ic} ${escapeHtml(ev.public_text)}</div>`;
        currentRoundHtmlLines.push(lineHtml);
        recordChronicleHistoryLine(lineHtml, `RD:${enc.combat_round}:${idx}:${ev.public_text}`);
      });
    } else {
      const introText = enc.resolvedDescription || 'Battle joined! Click the monster or press [Space] to strike.';
      const introHtml = `<div class="fp-log-line hero_attack">⚔️ ${escapeHtml(introText)}</div>`;
      currentRoundHtmlLines.push(introHtml);
      recordChronicleHistoryLine(introHtml, `RD_INTRO:${enc.combat_round}:${introText}`);
    }

    titleEl.textContent = store.isChronicleExpanded
      ? `⚔️ Battle Record — Round ${enc.combat_round || 1} (History: ${store.chronicleHistoryBuffer.length})`
      : `⚔️ Battle Record — Round ${enc.combat_round || 1}`;

    if (store.isChronicleExpanded && store.chronicleHistoryBuffer.length > 0) {
      linesEl.innerHTML = store.chronicleHistoryBuffer.map(item => item.html).join('');
    } else {
      linesEl.innerHTML = feedbackBanner.concat(currentRoundHtmlLines).join('');
    }
    linesEl.scrollTop = linesEl.scrollHeight;
    return;
  }

  const adv = state.adventure || null;
  const tc = (adv && adv.travelContinuity) || null;
  const continuityLines = [];

  // 1. Post-combat return grounding (when standing on the tile where combat just concluded and no new Stage 1 threat is active)
  const combatRet = (adv && adv.combatReturnContext) || (tc && tc.combatReturnContext) || null;
  const currentStepCount = (tc && tc.tileMemory && Number(tc.tileMemory.lastVisitedStep)) || (adv && Number(adv.stepCounter)) || 0;
  const isSameCombatTile = Boolean(
    combatRet &&
    Number(combatRet.x) === Number(state.currentTile.x) &&
    Number(combatRet.y) === Number(state.currentTile.y) &&
    (!enc || enc.status !== 'DISCOVERED') &&
    (Boolean(state.victory) || Number(combatRet.step || 0) >= currentStepCount)
  );
  if (isSameCombatTile && combatRet.groundedReturnNote) {
    const cleanReturn = sanitizePlayerContinuityText(combatRet.groundedReturnNote);
    if (cleanReturn) {
      const retHtml = `<div class="fp-log-line travel_continuity is-combat-return" id="fp-chronicle-combat-return">🛡️ ${escapeHtml(cleanReturn)}</div>`;
      continuityLines.push(retHtml);
      recordChronicleHistoryLine(retHtml, `COMBAT_RET:${combatRet.coord}:${combatRet.step}:${combatRet.outcome}`);
    }
  }

  // 2. Live travel continuity note (movement transition, landmark approach, or rotation in place)
  const rawContinuityNote = (adv && adv.continuityNote) || (tc && tc.continuityNote) || '';
  const cleanContinuityNote = sanitizePlayerContinuityText(rawContinuityNote);
  if (cleanContinuityNote && !isSameCombatTile && !state.errorMessage) {
    const contHtml = `<div class="fp-log-line travel_continuity" id="fp-chronicle-continuity-note">🧭 ${escapeHtml(cleanContinuityNote)}</div>`;
    continuityLines.push(contHtml);
    recordChronicleHistoryLine(
      contHtml,
      `CONT:${state.currentTile.x},${state.currentTile.y}:${state.facing}:${(adv && adv.stepCounter) || 0}:${cleanContinuityNote}`
    );
  }

  // 3. Revisit memory banner in Chronicle history (and in collapsed view when no errorMessage is present)
  const revisitStatus = (adv && adv.revisitStatus) || (tc && tc.revisitStatus) || 'FIRST_VISIT';
  const cleanRevisitBanner = sanitizePlayerContinuityText((adv && adv.revisitBanner) || (tc && tc.revisitBanner) || '');
  if (!isSameCombatTile && cleanRevisitBanner && (revisitStatus === 'CLEARED_SITE' || revisitStatus === 'LINGERING_THREAT_SITE')) {
    const revIcon = revisitStatus === 'CLEARED_SITE' ? '✓' : '⚠️';
    const revHtml = `<div class="fp-log-line travel_continuity is-revisit-note" id="fp-chronicle-revisit-note">${revIcon} ${escapeHtml(cleanRevisitBanner)}</div>`;
    recordChronicleHistoryLine(revHtml, `REV:${state.currentTile.x},${state.currentTile.y}:${revisitStatus}`);
    if (!state.errorMessage && continuityLines.length === 0) {
      continuityLines.push(revHtml);
    }
  }

  const tileDescHtml = `<div class="fp-log-line" style="font-style: italic; color: var(--text-body);">“${escapeHtml(state.currentTile.description)}”</div>`;
  recordChronicleHistoryLine(
    `<div class="fp-log-line"><span style="color:var(--accent-gold); font-family:var(--font-mono);">[${state.currentTile.x},${state.currentTile.y}]</span> <strong>${escapeHtml(state.currentTile.name)}:</strong> “${escapeHtml(state.currentTile.description)}”</div>`,
    `TILE:${state.currentTile.x},${state.currentTile.y}`
  );

  titleEl.textContent = store.isChronicleExpanded
    ? `📖 ${state.currentTile.name} — Full Chronicle (${store.chronicleHistoryBuffer.length})`
    : `📖 ${state.currentTile.name} — Chronicle`;

  if (store.isChronicleExpanded && store.chronicleHistoryBuffer.length > 0) {
    linesEl.innerHTML = store.chronicleHistoryBuffer.map(item => item.html).join('');
    linesEl.scrollTop = linesEl.scrollHeight;
  } else {
    linesEl.innerHTML = feedbackBanner.concat(continuityLines, [tileDescHtml]).join('');
  }
}
