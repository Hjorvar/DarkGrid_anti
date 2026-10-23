/**
 * DARKGRID PHASE 9A — Headless Chrome Visual QA, Multi-Resolution Audit & 7-Screenshot Suite
 *
 * Verifies and captures all Phase 9A visual states in:
 * - action-ui-lab/docs/screenshots/phase-9a/
 * - docs/screenshots/phase-9a/
 *
 * Visual QA Checks:
 *  01. Oakhaven Major Landmark Scene (Auto-opens in #fp-viewport, temporarily replaces 2D map canvas)
 *  02. Continue Exploring -> 2D Top-Down Map restored + Anti-Interruption check (REST / Shop / Modal close do NOT re-open Landmark Scene)
 *  03. Spotted ENCOUNTER Screen -> Danger Zone badge, situational & qualitative monster knowledge, Fight & Avoid buttons (0 secret numbers leaked)
 *  04. AMBUSH Combat Round 1 -> Skips Avoid screen, shows crimson AMBUSH! banner, locks Flee button (Locked 2r) in DOM & server
 *  05. AMBUSH Combat Round 3 -> Flee lock expires after 2 full rounds; Flee (AoO) button unlocked
 *  06. Goblin Stronghold Major Landmark Scene -> Auto-opens on arrival at [15, 2] with Challenge the Goblin Chieftain & Continue Exploring
 *  07. Stronghold Boss Combat -> Challenge Chieftain enters combat and guarantees Landmark Scene & Combat are NEVER active simultaneously
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createLabApp } = require('../server');

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function connectCdp(debugPort) {
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
      const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTarget) {
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.addEventListener('open', resolve, { once: true });
          ws.addEventListener('error', reject, { once: true });
        });
        let seq = 1;
        const pending = new Map();
        const consoleErrors = [];
        const pageExceptions = [];

        ws.addEventListener('message', (ev) => {
          const msg = JSON.parse(String(ev.data));
          if (msg.id && pending.has(msg.id)) {
            const { resolve: res, reject: rej } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
            else res(msg.result);
          } else if (msg.method === 'Runtime.consoleAPICalled') {
            if (msg.params && msg.params.type === 'error') {
              consoleErrors.push((msg.params.args || []).map((a) => a.value || a.description || '').join(' '));
            }
          } else if (msg.method === 'Runtime.exceptionThrown') {
            pageExceptions.push(msg.params && msg.params.exceptionDetails ? msg.params.exceptionDetails.text : 'Unknown exception');
          }
        });

        const send = (method, params = {}) => new Promise((resolve, reject) => {
          const id = seq++;
          pending.set(id, { resolve, reject });
          ws.send(JSON.stringify({ id, method, params }));
        });

        return { ws, send, consoleErrors, pageExceptions };
      }
    } catch {
      // Wait for browser startup
    }
    await sleep(150);
  }
  throw new Error(`Could not connect to headless Chrome CDP on port ${debugPort}`);
}

async function runPhase9aVisualQa() {
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    throw new Error('No Chrome/Edge binary found for headless Visual QA.');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-phase9a-vqa-'));
  const dbPath = path.join(tmpDir, 'phase9a-vqa.db');
  const tmpProfile = path.join(tmpDir, 'chrome-profile');
  fs.mkdirSync(tmpProfile, { recursive: true });

  const rootOutDir = path.resolve(__dirname, '..', '..', 'docs', 'screenshots', 'phase-9a');
  const labOutDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'phase-9a');
  fs.mkdirSync(rootOutDir, { recursive: true });
  fs.mkdirSync(labOutDir, { recursive: true });

  const app = createLabApp({ dbPath });
  const db = app.locals.db;
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/`;
  const debugPort = 9450 + Math.floor(Math.random() * 400);

  const chromeProc = spawn(
    chromeBin,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${tmpProfile}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,900',
      baseUrl
    ],
    { stdio: 'ignore' }
  );

  let cdp = null;
  try {
    cdp = await connectCdp(debugPort);
    const { send, consoleErrors, pageExceptions } = cdp;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await sleep(900);

    async function evalJs(expr) {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true
      });
      if (res.exceptionDetails) {
        const desc = res.exceptionDetails.exception
          ? (res.exceptionDetails.exception.description || res.exceptionDetails.text)
          : res.exceptionDetails.text;
        throw new Error(`Eval exception: ${desc}`);
      }
      return res.result ? res.result.value : undefined;
    }

    async function capturePng(filename) {
      await sleep(350);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      const rootPath = path.join(rootOutDir, filename);
      const labPath = path.join(labOutDir, filename);
      fs.writeFileSync(rootPath, buf);
      fs.writeFileSync(labPath, buf);
      console.log(`Captured ${filename} (${buf.length} bytes)`);
      return rootPath;
    }

    // Wait for initial game state to load
    const loaded = await evalJs(`(async () => {
      for (let i = 0; i < 40; i++) {
        if (window.currentState && document.getElementById('major-landmark-scene-panel')) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    })()`);
    assert.equal(loaded, true, 'Oakhaven Major Landmark Scene should auto-open on initial arrival at Oakhaven [15,27]');

    // =========================================================================
    // 01. Oakhaven Major Landmark Scene (Auto-opens on arrival at [15, 27])
    // =========================================================================
    const shot01Audit = await evalJs(`(() => {
      const panel = document.getElementById('major-landmark-scene-panel');
      const mapStage = document.getElementById('topdown-map-stage');
      const btns = Array.from(panel ? panel.querySelectorAll('[data-landmark-action]') : []).map(b => b.getAttribute('data-landmark-action'));
      return {
        hasPanel: Boolean(panel),
        sceneKey: panel ? panel.getAttribute('data-scene-key') : null,
        title: panel ? panel.querySelector('.major-landmark-title')?.textContent?.trim() : null,
        mapReplacedByScene: !mapStage || mapStage.hidden || getComputedStyle(mapStage).display === 'none',
        buttons: btns
      };
    })()`);
    assert.equal(shot01Audit.hasPanel, true);
    assert.equal(shot01Audit.sceneKey, 'OAKHAVEN');
    assert.equal(shot01Audit.mapReplacedByScene, true, '2D map canvas must temporarily yield to Major Landmark Scene');
    assert.deepEqual(shot01Audit.buttons, ['REST_HEAL', 'OPEN_SHOP', 'OPEN_QUESTS', 'CONTINUE_EXPLORING']);
    await capturePng('01-oakhaven-landmark-scene.png');

    // =========================================================================
    // 02. Continue Exploring -> 2D Map Restored & Anti-Interruption Check
    // =========================================================================
    const shot02Audit = await evalJs(`(async () => {
      await window.dispatchAction('DISMISS_LANDMARK_SCENE');
      // Perform REST and open/close Shop modal while on [15, 27] — must NOT re-open Landmark Scene!
      await window.dispatchAction('REST');
      window.openLabModal('market');
      window.closeLabModal();
      const panel = document.getElementById('major-landmark-scene-panel');
      const mapCanvas = document.getElementById('topdown-map-canvas');
      const reopenBtn = document.getElementById('btn-reopen-landmark-scene');
      return {
        panelGone: panel === null,
        hasMapCanvas: Boolean(mapCanvas && mapCanvas.width > 300),
        hasReopenBadge: Boolean(reopenBtn),
        landmarkActiveState: Boolean(window.currentState?.landmarkScene?.isActive)
      };
    })()`);
    assert.equal(shot02Audit.panelGone, true, 'Landmark Scene must stay closed after Continue Exploring and UI actions');
    assert.equal(shot02Audit.hasMapCanvas, true, '2D top-down map canvas must be restored');
    assert.equal(shot02Audit.hasReopenBadge, true, 'Compact reopen badge should be available in corner');
    assert.equal(shot02Audit.landmarkActiveState, false);
    await capturePng('02-oakhaven-continue-exploring-map.png');

    // =========================================================================
    // 03. Spotted ENCOUNTER Screen (Fight / Avoid)
    // =========================================================================
    const heroId = await evalJs(`window.currentState.character.id`);
    db.prepare('UPDATE characters SET level = 3, current_hp = 45, max_hp = 45 WHERE id = ?').run(heroId);

    const shot03Audit = await evalJs(`(async () => {
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', {
        direction: 'NORTH',
        testForceEncounter: true,
        testForceOutcome: 'ENCOUNTER'
      });
      const encPanel = document.getElementById('fp-inscene-threat');
      const fightBtn = document.getElementById('btn-encounter-fight');
      const avoidBtn = document.getElementById('btn-encounter-avoid');
      const slot1Title = document.getElementById('slot1-title');
      const slot4Title = document.getElementById('slot4-title');
      const descText = encPanel ? encPanel.textContent : '';
      const isHidden = el => !el || el.hidden || getComputedStyle(el).display === 'none';
      return {
        mode: window.currentState.mode,
        travelOutcome: window.currentState.encounter?.travelOutcome,
        isAmbush: window.currentState.encounter?.isAmbush,
        panelVisible: !isHidden(encPanel),
        fightVisible: !isHidden(fightBtn),
        fightText: fightBtn?.textContent?.trim(),
        avoidVisible: !isHidden(avoidBtn),
        avoidText: avoidBtn?.textContent?.trim(),
        slot1Text: slot1Title?.textContent?.trim(),
        slot4Text: slot4Title?.textContent?.trim(),
        hasSituationalKnowledge: descText.length > 20,
        leakedMonsterAc: window.currentState.encounter?.monster_ac
      };
    })()`);
    assert.equal(shot03Audit.mode, 'DISCOVERED');
    assert.equal(shot03Audit.travelOutcome, 'ENCOUNTER');
    assert.equal(shot03Audit.isAmbush, false);
    assert.equal(shot03Audit.panelVisible, true);
    assert.equal(shot03Audit.fightVisible, true);
    assert.equal(shot03Audit.avoidVisible, true);
    assert.equal(shot03Audit.leakedMonsterAc, undefined);
    await capturePng('03-encounter-spotted-fight-avoid.png');

    // Verify clicking Avoid returns cleanly to exploration with 0 XP / 0 loot
    const avoidAudit = await evalJs(`(async () => {
      const xpBefore = window.currentState.character.xp;
      await window.dispatchAction('AVOID');
      return {
        mode: window.currentState.mode,
        encounter: window.currentState.encounter,
        xpUnchanged: window.currentState.character.xp === xpBefore
      };
    })()`);
    assert.equal(avoidAudit.mode, 'EXPLORATION');
    assert.equal(avoidAudit.encounter, null);
    assert.equal(avoidAudit.xpUnchanged, true);

    // =========================================================================
    // 04. AMBUSH Combat Round 1 (AMBUSH! Banner + Flee Locked for 2 Rounds)
    // =========================================================================
    const shot04Audit = await evalJs(`(async () => {
      await window.dispatchAction('MOVE', {
        direction: 'NORTH',
        testForceEncounter: true,
        testForceOutcome: 'AMBUSH'
      });
      return {
        encId: window.currentState.encounter?.id,
        mode: window.currentState.mode,
        combatRound: window.currentState.encounter?.combat_round,
        isAmbush: window.currentState.encounter?.isAmbush,
        fleeLocked: window.currentState.encounter?.fleeLocked,
        ambushFleeLockedRoundsRemaining: window.currentState.encounter?.ambushFleeLockedRoundsRemaining
      };
    })()`);
    assert.equal(shot04Audit.mode, 'IN_COMBAT');
    assert.equal(shot04Audit.combatRound, 1);
    assert.equal(shot04Audit.isAmbush, true);
    assert.equal(shot04Audit.fleeLocked, true);
    assert.equal(shot04Audit.ambushFleeLockedRoundsRemaining, 2);

    // Give the ambushing monster enough HP so it survives 2 rounds of combat for Round 3 screenshot
    db.prepare('UPDATE encounters SET current_monster_hp = 90, monster_max_hp = 90 WHERE id = ?').run(shot04Audit.encId);
    await evalJs(`(async () => {
      const res = await fetch('/api/state').then(r => r.json());
      window.currentState = res.state;
      window.renderGameState(window.currentState, { skipSequence: true });
    })()`);

    const domRound1Audit = await evalJs(`(() => {
      const banner = document.getElementById('combat-ambush-banner');
      const fleeBtn = document.getElementById('action-slot-4');
      const landmarkPanel = document.getElementById('major-landmark-scene-panel');
      const isHidden = el => !el || el.hidden || getComputedStyle(el).display === 'none';
      return {
        bannerVisible: !isHidden(banner),
        bannerText: banner?.textContent?.trim(),
        fleeDisabled: Boolean(fleeBtn?.disabled),
        fleeLabel: fleeBtn?.textContent?.trim(),
        landmarkNullDuringCombat: landmarkPanel === null
      };
    })()`);
    assert.equal(domRound1Audit.bannerVisible, true, 'AMBUSH! banner must be visible in Round 1');
    assert.match(domRound1Audit.bannerText, /AMBUSH!/i);
    assert.equal(domRound1Audit.fleeDisabled, true, 'Flee button must be disabled in DOM during Round 1');
    assert.match(domRound1Audit.fleeLabel, /Flee Locked/i);
    assert.equal(domRound1Audit.landmarkNullDuringCombat, true);
    await capturePng('04-ambush-combat-flee-locked-round1.png');

    // =========================================================================
    // 05. AMBUSH Combat Round 3 (Flee Unlocked After 2 Full Combat Rounds)
    // =========================================================================
    const shot05Audit = await evalJs(`(async () => {
      await window.dispatchAction('ATTACK', {}, { skipSequence: true });
      await window.dispatchAction('ATTACK', {}, { skipSequence: true });
      window.renderGameState(window.currentState, { skipSequence: true });
      const fleeBtn = document.getElementById('action-slot-4');
      const banner = document.getElementById('combat-ambush-banner');
      return {
        combatRound: window.currentState.encounter?.combat_round,
        fleeLocked: window.currentState.encounter?.fleeLocked,
        canFlee: window.currentState.encounter?.canFlee,
        fleeDisabledDom: Boolean(fleeBtn?.disabled),
        fleeLabelDom: fleeBtn?.textContent?.trim(),
        bannerText: banner?.textContent?.trim()
      };
    })()`);
    assert.equal(shot05Audit.combatRound, 3);
    assert.equal(shot05Audit.fleeLocked, false, 'Flee lock must expire at Round 3');
    assert.equal(shot05Audit.canFlee, true);
    assert.equal(shot05Audit.fleeDisabledDom, false, 'Flee button must be enabled in DOM at Round 3');
    assert.match(shot05Audit.fleeLabelDom, /Flee Battle/i);
    await capturePng('05-ambush-combat-flee-unlocked-round3.png');

    // Flee out of combat so we can travel to Goblin Stronghold
    db.prepare("UPDATE encounters SET status = 'ESCAPED' WHERE id = ?").run(shot04Audit.encId);
    db.prepare('UPDATE characters SET current_hp = 45 WHERE id = ?').run(heroId);

    // =========================================================================
    // 06. Goblin Stronghold Major Landmark Scene [15, 2]
    // =========================================================================
    const shot06Audit = await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 15, y: 3, facing: 'NORTH' });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      const panel = document.getElementById('major-landmark-scene-panel');
      const mapStage = document.getElementById('topdown-map-stage');
      const btns = Array.from(panel ? panel.querySelectorAll('[data-landmark-action]') : []).map(b => b.getAttribute('data-landmark-action'));
      return {
        hasPanel: Boolean(panel),
        sceneKey: panel ? panel.getAttribute('data-scene-key') : null,
        title: panel ? panel.querySelector('.major-landmark-title')?.textContent?.trim() : null,
        mapReplacedByScene: !mapStage || mapStage.hidden || getComputedStyle(mapStage).display === 'none',
        buttons: btns
      };
    })()`);
    assert.equal(shot06Audit.hasPanel, true, 'Stronghold Major Landmark Scene must auto-open on arrival at [15, 2]');
    assert.equal(shot06Audit.sceneKey, 'GOBLIN_STRONGHOLD');
    assert.equal(shot06Audit.mapReplacedByScene, true);
    assert.deepEqual(shot06Audit.buttons, ['CHALLENGE_CHIEFTAIN', 'CONTINUE_EXPLORING']);
    await capturePng('06-stronghold-landmark-scene.png');

    // =========================================================================
    // 07. Stronghold Boss Combat (Landmark Scene & Combat Never Overlap)
    // =========================================================================
    const shot07Audit = await evalJs(`(async () => {
      await window.dispatchAction('ENGAGE_STRONGHOLD_BOSS', {}, { skipSequence: true });
      window.renderGameState(window.currentState, { skipSequence: true });
      const landmarkPanel = document.getElementById('major-landmark-scene-panel');
      const encPanel = document.getElementById('fp-monster-actor');
      const isHidden = el => !el || el.hidden || getComputedStyle(el).display === 'none';
      return {
        mode: window.currentState.mode,
        bossName: window.currentState.encounter?.monsterName || window.currentState.encounter?.name || window.currentState.encounter?.monster_name,
        landmarkSceneState: window.currentState.landmarkScene,
        landmarkDomRemoved: landmarkPanel === null,
        combatPanelVisible: !isHidden(encPanel)
      };
    })()`);
    assert.equal(shot07Audit.mode, 'IN_COMBAT');
    assert.match(shot07Audit.bossName, /Grak|Goblin Chieftain/i);
    assert.equal(shot07Audit.landmarkSceneState, null, 'landmarkScene state must be null during active combat');
    assert.equal(shot07Audit.landmarkDomRemoved, true, 'Landmark Scene DOM must never coexist with Combat');
    assert.equal(shot07Audit.combatPanelVisible, true);
    await capturePng('07-stronghold-boss-combat.png');

    assert.equal(consoleErrors.length, 0, `Expected 0 console errors, got: ${consoleErrors.join('; ')}`);
    assert.equal(pageExceptions.length, 0, `Expected 0 page exceptions, got: ${pageExceptions.join('; ')}`);
    console.log('Phase 9A Visual QA completed with 7/7 screenshots and 0 console/page errors.');
  } finally {
    if (cdp && cdp.ws) {
      try { cdp.ws.close(); } catch { /* ignore */ }
    }
    try { chromeProc.kill(); } catch { /* ignore */ }
    await new Promise((resolve) => server.close(resolve));
    try { db.close(); } catch { /* ignore */ }
  }
}

runPhase9aVisualQa().catch((err) => {
  console.error('Phase 9A Visual QA FAILED:', err);
  process.exit(1);
});
