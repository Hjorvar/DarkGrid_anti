/**
 * DARKGRID — TOP-DOWN EXPLORATION EXPERIMENT 1
 * Headless Chrome Visual QA & Screenshot Verification Script
 *
 * Captures the 5 required screenshots:
 *   1. town-oakhaven.png           (Town / Oakhaven Sanctuary + Quest available)
 *   2. goblin-forest.png           (Goblin Forest / Blackwood Forest exploration)
 *   3. goblin-stronghold.png       (Goblin Stronghold entrance landmark & Challenge card)
 *   4. combat-phase7c.png          (Combat UI with Darkgrid monster art & Phase 7C actions)
 *   5. quest-completion.png        (Quest Completion & Reward Claimed in Oakhaven)
 *
 * Also verifies:
 *   - 0 console errors & 0 uncaught page exceptions
 *   - Top-down canvas occupies ~80% of the main workspace area
 *   - Canvas renders non-blank dark-fantasy pixels
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { createLabApp } = require('../server');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function findBrowserExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not find Chrome or Edge executable for headless CDP verification.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectCdp(debugPort) {
  for (let attempt = 0; attempt < 35; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      if (res.ok) {
        const targets = await res.json();
        const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (pageTarget) {
          const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
          await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
          });
          let msgId = 0;
          const pending = new Map();
          const consoleErrors = [];
          const pageExceptions = [];

          ws.addEventListener('message', (ev) => {
            const data = JSON.parse(String(ev.data));
            if (data.method === 'Runtime.consoleAPICalled' && data.params && data.params.type === 'error') {
              const txt = (data.params.args || []).map((a) => a.value || a.description || '').join(' ');
              consoleErrors.push(txt);
            }
            if (data.method === 'Runtime.exceptionThrown' && data.params && data.params.exceptionDetails) {
              const det = data.params.exceptionDetails;
              pageExceptions.push(det.text + ' ' + ((det.exception && det.exception.description) || ''));
            }
            if (data.id && pending.has(data.id)) {
              const { resolve, reject } = pending.get(data.id);
              pending.delete(data.id);
              if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
              else resolve(data.result);
            }
          });

          const send = (method, params = {}) =>
            new Promise((resolve, reject) => {
              const id = ++msgId;
              pending.set(id, { resolve, reject });
              ws.send(JSON.stringify({ id, method, params }));
            });

          return { ws, send, consoleErrors, pageExceptions };
        }
      }
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error('Failed to connect to headless browser CDP WebSocket.');
}

async function runTopdownVisualQa() {
  const outDir = path.join(__dirname, '../docs/screenshots/topdown-experiment-1');
  fs.mkdirSync(outDir, { recursive: true });

  const app = createLabApp({
    dbPath: ':memory:',
    allowLabTools: true
  });
  const db = app.locals.db;

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const debugPort = 9440 + Math.floor(Math.random() * 400);
  const tmpProfile = path.join(__dirname, `../data/.tmp_chrome_topdown_${Date.now()}`);
  fs.mkdirSync(tmpProfile, { recursive: true });

  const chromeBin = findBrowserExecutable();
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

    await sleep(1000);

    async function evalJs(expr) {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true
      });
      if (res.exceptionDetails) {
        throw new Error(`Eval exception: ${res.exceptionDetails.text}`);
      }
      return res.result ? res.result.value : undefined;
    }

    async function capturePng(filename) {
      await sleep(350);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      return filePath;
    }

    // Wait for initial state to render
    await evalJs(`(async () => {
      for (let i = 0; i < 30; i++) {
        if (window.currentState && document.getElementById('topdown-map-canvas')) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    })()`);

    // 1. Verify Town (Oakhaven [7,7]) & Workspace Area Ratio (~80% for top-down map)
    const townMetrics = await evalJs(`(() => {
      const mainGrid = document.querySelector('.dm-main-grid');
      const vp = document.getElementById('fp-viewport');
      const canvas = document.getElementById('topdown-map-canvas');
      const gRect = mainGrid.getBoundingClientRect();
      const vRect = vp.getBoundingClientRect();
      const cRect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      const sample = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      return {
        areaTitle: document.getElementById('fp-area-title').textContent.trim(),
        widthRatio: Number((vRect.width / gRect.width).toFixed(3)),
        canvasWidth: cRect.width,
        canvasHeight: cRect.height,
        centerPixelAlpha: sample[3],
        questTitle: window.currentState && window.currentState.quest ? window.currentState.quest.title : null,
        questStatus: window.currentState && window.currentState.quest ? window.currentState.quest.status : null
      };
    })()`);

    console.log('1. Town Metrics:', townMetrics);
    assert.equal(townMetrics.areaTitle, 'Oakhaven');
    assert.ok(townMetrics.widthRatio >= 0.78, `Expected viewport width ratio >= 0.78 (~80%), got ${townMetrics.widthRatio}`);
    assert.ok(townMetrics.canvasWidth > 800 && townMetrics.canvasHeight > 500, 'Canvas should fill the main viewport');
    assert.equal(townMetrics.centerPixelAlpha, 255, 'Canvas should render opaque pixels');

    const shot1 = await capturePng('1-town-oakhaven.png');
    console.log('Saved Screenshot 1 (Town):', shot1);

    // 2. Accept Quest in Town, then step North into Goblin Forest ([7,6] -> [7,5] -> [7,4] -> [7,3] Black Oak)
    await evalJs(`(async () => {
      await window.dispatchAction('ACCEPT_QUEST');
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await new Promise(r => setTimeout(r, 250));
      return window.currentState.currentTile;
    })()`);

    const forestMetrics = await evalJs(`(() => ({
      areaTitle: document.getElementById('fp-area-title').textContent.trim(),
      coords: [window.currentState.currentTile.x, window.currentState.currentTile.y],
      questStatus: window.currentState.quest.status
    }))()`);
    console.log('2. Goblin Forest Metrics:', forestMetrics);
    assert.deepEqual(forestMetrics.coords, [7, 3]);
    assert.equal(forestMetrics.questStatus, 'ACTIVE');

    const shot2 = await capturePng('2-goblin-forest.png');
    console.log('Saved Screenshot 2 (Goblin Forest):', shot2);

    // 3. Step North to Goblin Stronghold Entrance [7, 1]
    await evalJs(`(async () => {
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await new Promise(r => setTimeout(r, 250));
      return window.currentState.currentTile;
    })()`);

    const strongholdMetrics = await evalJs(`(() => ({
      areaTitle: document.getElementById('fp-area-title').textContent.trim(),
      coords: [window.currentState.currentTile.x, window.currentState.currentTile.y],
      hasStrongholdCard: Boolean(document.getElementById('stronghold-entrance-card')),
      hasChallengeBtn: Boolean(document.getElementById('btn-engage-stronghold-boss'))
    }))()`);
    console.log('3. Goblin Stronghold Metrics:', strongholdMetrics);
    assert.deepEqual(strongholdMetrics.coords, [7, 1]);
    assert.equal(strongholdMetrics.hasStrongholdCard, true);
    assert.equal(strongholdMetrics.hasChallengeBtn, true);

    const shot3 = await capturePng('3-goblin-stronghold.png');
    console.log('Saved Screenshot 3 (Goblin Stronghold):', shot3);

    // 4. Initiate Stronghold Boss Fight (Phase 7C Combat UI with large monster illustration)
    await evalJs(`(async () => {
      await window.dispatchAction('ENGAGE_STRONGHOLD_BOSS');
      await new Promise(r => setTimeout(r, 300));
      return window.currentState.mode;
    })()`);

    const combatMetrics = await evalJs(`(() => {
      const img = document.querySelector('.fp-monster-img');
      return {
        mode: window.currentState.mode,
        monsterName: window.currentState.encounter ? window.currentState.encounter.monsterName : null,
        imgLoaded: Boolean(img && img.complete && img.naturalWidth > 0),
        imgWidth: img ? Math.round(img.getBoundingClientRect().width) : 0
      };
    })()`);
    console.log('4. Combat UI Metrics:', combatMetrics);
    assert.equal(combatMetrics.mode, 'IN_COMBAT');
    assert.equal(combatMetrics.imgLoaded, true);

    const shot4 = await capturePng('4-combat-goblin-chieftain.png');
    console.log('Saved Screenshot 4 (Combat):', shot4);

    // 5. Defeat the Boss, return to Oakhaven [7,7], open Quests modal / claim reward
    const heroId = await evalJs(`window.currentState.character.id`);
    db.prepare('UPDATE characters SET strength = 30, current_hp = 60, max_hp = 60 WHERE id = ?').run(heroId);

    await evalJs(`(async () => {
      for (let i = 0; i < 15 && window.currentState.mode === 'IN_COMBAT'; i++) {
        await window.dispatchAction('ATTACK');
      }
      // Walk South back to Oakhaven [7, 7]
      for (let step = 0; step < 6; step++) {
        await window.dispatchAction('MOVE', { direction: 'SOUTH', testForceEncounter: false });
      }
      // Claim quest reward and open Quests modal so the completed quest & Reward Claimed state is clearly visible
      await window.dispatchAction('CLAIM_QUEST_REWARD');
      window.openLabModal('quests');
      await new Promise(r => setTimeout(r, 250));
      return window.currentState.quest;
    })()`);

    const completionMetrics = await evalJs(`(() => ({
      questStatus: window.currentState.quest.status,
      bossSlain: window.currentState.topdownMap.bossSlain,
      modalOpen: !document.getElementById('lab-modal-backdrop').hidden,
      modalText: document.getElementById('lab-modal-body').innerText
    }))()`);
    console.log('5. Quest Completion Metrics:', completionMetrics);
    assert.equal(completionMetrics.questStatus, 'REWARD_CLAIMED');
    assert.equal(completionMetrics.bossSlain, true);
    assert.equal(completionMetrics.modalOpen, true);

    const shot5 = await capturePng('5-quest-completion.png');
    console.log('Saved Screenshot 5 (Quest Completion):', shot5);

    assert.equal(consoleErrors.length, 0, `Expected 0 console errors, got: ${consoleErrors.join('; ')}`);
    assert.equal(pageExceptions.length, 0, `Expected 0 page exceptions, got: ${pageExceptions.join('; ')}`);
    console.log('ALL 5 VISUAL QA SCREENSHOTS & METRICS PASSED WITH 0 ERRORS.');
  } finally {
    if (cdp && cdp.ws) {
      try {
        cdp.ws.close();
      } catch {}
    }
    try {
      chromeProc.kill();
    } catch {}
    await new Promise((resolve) => server.close(resolve));
    try {
      db.close();
    } catch {}
  }
}

runTopdownVisualQa().catch((err) => {
  console.error('Visual QA failed:', err);
  process.exit(1);
});
