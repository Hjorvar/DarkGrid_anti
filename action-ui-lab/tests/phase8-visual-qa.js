/**
 * DARKGRID PHASE 8 — Headless Chrome Visual QA, Multi-Resolution Audit & 14-Screenshot Suite
 *
 * Captures and verifies all 14 required Phase 8 screenshots in:
 * - docs/screenshots/phase-8/
 * - action-ui-lab/docs/screenshots/phase-8/
 *
 * Also audits DOM, Canvas, Camera Viewport, Player Mode UI rules, and Combat Isolation
 * across 1280x720, 1440x900, and 1920x1080 desktop viewports with zero console/page errors.
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
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
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
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
      const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
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

        ws.addEventListener('message', ev => {
          const msg = JSON.parse(String(ev.data));
          if (msg.id && pending.has(msg.id)) {
            const { resolve: res, reject: rej } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
            else res(msg.result);
          } else if (msg.method === 'Runtime.consoleAPICalled') {
            if (msg.params && msg.params.type === 'error') {
              consoleErrors.push((msg.params.args || []).map(a => a.value || a.description || '').join(' '));
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

async function runPhase8VisualQa() {
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    throw new Error('No Chrome/Edge binary found for headless Visual QA.');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-phase8-vqa-'));
  const dbPath = path.join(tmpDir, 'phase8-vqa.db');
  const tmpProfile = path.join(tmpDir, 'chrome-profile');
  fs.mkdirSync(tmpProfile, { recursive: true });

  const rootOutDir = path.resolve(__dirname, '..', '..', 'docs', 'screenshots', 'phase-8');
  const labOutDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'phase-8');
  fs.mkdirSync(rootOutDir, { recursive: true });
  fs.mkdirSync(labOutDir, { recursive: true });

  const app = createLabApp({ dbPath });
  const db = app.locals.db;
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/`;
  const debugPort = 9350 + Math.floor(Math.random() * 400);

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
      await sleep(320);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      const rootPath = path.join(rootOutDir, filename);
      const labPath = path.join(labOutDir, filename);
      fs.writeFileSync(rootPath, buf);
      fs.writeFileSync(labPath, buf);
      console.log(`Captured ${filename} (${buf.length} bytes)`);
      return rootPath;
    }

    // Wait for initial game state & topdown canvas to render
    const loaded = await evalJs(`(async () => {
      for (let i = 0; i < 40; i++) {
        if (window.currentState && document.getElementById('topdown-map-canvas')) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    })()`);
    assert.equal(loaded, true, 'App and topdown-map-canvas should load cleanly');

    // =========================================================================
    // A. Multi-Resolution Desktop Layout Audit (1280x720, 1440x900, 1920x1080)
    // =========================================================================
    for (const resSpec of [
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 }
    ]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: resSpec.width,
        height: resSpec.height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(220);
      const audit = await evalJs(`(() => {
        window.renderGameState(window.currentState, { skipSequence: true });
        const mainGrid = document.querySelector('.dm-main-grid');
        const vp = document.getElementById('fp-viewport');
        const canvas = document.getElementById('topdown-map-canvas');
        const gRect = mainGrid.getBoundingClientRect();
        const vRect = vp.getBoundingClientRect();
        const cRect = canvas.getBoundingClientRect();
        return {
          widthRatio: Number((vRect.width / gRect.width).toFixed(3)),
          canvasWidth: Math.round(cRect.width),
          canvasHeight: Math.round(cRect.height),
          bodyScrollOverflowY: document.documentElement.scrollHeight > window.innerHeight + 2
        };
      })()`);
      console.log(`Resolution Audit ${resSpec.width}x${resSpec.height}:`, audit);
      assert.ok(audit.widthRatio >= 0.76, `Viewport width ratio >= 0.76 at ${resSpec.width}x${resSpec.height}`);
      assert.ok(audit.canvasWidth >= 700 && audit.canvasHeight >= 420, `Canvas fills viewport at ${resSpec.width}x${resSpec.height}`);
      assert.equal(audit.bodyScrollOverflowY, false, `Zero vertical page overflow at ${resSpec.width}x${resSpec.height}`);
    }

    // Restore 1440x900 for canonical screenshot capture
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(200);

    // =========================================================================
    // 01. Oakhaven Camera View [15, 27]
    // =========================================================================
    const shot01Metrics = await evalJs(`(() => {
      window.renderGameState(window.currentState, { skipSequence: true });
      const turnQ = document.getElementById('pad-turn-left');
      const turnE = document.getElementById('pad-turn-right');
      const devBtn = document.getElementById('btn-toggle-devtools');
      const shopBtn = document.getElementById('util-btn-market');
      const mapBtn = document.getElementById('btn-open-map') || document.getElementById('util-btn-map');
      const questsBtn = document.getElementById('btn-open-journal') || document.getElementById('util-btn-board');
      const isHidden = el => !el || el.hidden || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden';
      return {
        areaTitle: document.getElementById('fp-area-title').textContent.trim(),
        coord: [window.currentState.currentTile.x, window.currentState.currentTile.y],
        turnQHidden: isHidden(turnQ),
        turnEHidden: isHidden(turnE),
        devBtnHiddenInPlayerMode: isHidden(devBtn),
        shopVisibleInTown: Boolean(shopBtn && !isHidden(shopBtn)),
        mapBtnVisible: Boolean(mapBtn && !isHidden(mapBtn)),
        questsBtnText: questsBtn ? questsBtn.textContent.trim() : ''
      };
    })()`);
    console.log('01 Oakhaven Metrics:', shot01Metrics);
    assert.equal(shot01Metrics.areaTitle, 'Oakhaven');
    assert.deepEqual(shot01Metrics.coord, [15, 27]);
    assert.equal(shot01Metrics.turnQHidden, true, 'TURN Q button hidden in Player Mode');
    assert.equal(shot01Metrics.turnEHidden, true, 'TURN E button hidden in Player Mode');
    assert.equal(shot01Metrics.devBtnHiddenInPlayerMode, true, 'Lab Tools button hidden in Player Mode');
    assert.equal(shot01Metrics.shopVisibleInTown, true, 'Shop button visible in Oakhaven');
    assert.equal(shot01Metrics.mapBtnVisible, true, 'Map [M] button visible');
    await capturePng('01-oakhaven-camera-view.png');

    // =========================================================================
    // 10 & 11. Quests & Bounties Modal (Quests Tab & Bounties Tab)
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('ACCEPT_QUEST');
      window.openLabModal('quests');
      window.setQuestsModalTab('QUESTS');
    })()`);
    const questTabInfo = await evalJs(`(() => ({
      modalTitle: document.getElementById('lab-modal-title').textContent.trim(),
      hasGoblinChieftain: document.getElementById('lab-modal-body').textContent.includes('The Goblin Chieftain')
    }))()`);
    assert.equal(questTabInfo.hasGoblinChieftain, true);
    await capturePng('10-quests-and-bounties-modal-quests-tab.png');

    await evalJs(`(() => {
      window.setQuestsModalTab('BOUNTIES');
    })()`);
    const bountyTabInfo = await evalJs(`(() => ({
      hasWatchersBoard: document.getElementById('lab-modal-body').textContent.includes('Watcher') || document.getElementById('lab-modal-body').textContent.includes('Contracts')
    }))()`);
    assert.equal(bountyTabInfo.hasWatchersBoard, true);
    await capturePng('11-quests-and-bounties-modal-bounties-tab.png');

    await evalJs(`(() => { window.closeLabModal(); })()`);

    // =========================================================================
    // 02. Leaving Town — Oakhaven North Gate [15, 26]
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    })()`);
    const shot02Metrics = await evalJs(`(() => {
      const shopBtn = document.getElementById('util-btn-market');
      return {
        areaTitle: document.getElementById('fp-area-title').textContent.trim(),
        coord: [window.currentState.currentTile.x, window.currentState.currentTile.y],
        shopHiddenOutsideTown: shopBtn ? (shopBtn.hidden || getComputedStyle(shopBtn).display === 'none') : true,
        areaTitleHasCoords: /\\[\\d+\\s*,\\s*\\d+\\]/.test(document.getElementById('fp-area-title').textContent)
      };
    })()`);
    console.log('02 Leaving Town Metrics:', shot02Metrics);
    assert.deepEqual(shot02Metrics.coord, [15, 26]);
    assert.equal(shot02Metrics.shopHiddenOutsideTown, true, 'Shop button hidden outside Oakhaven');
    assert.equal(shot02Metrics.areaTitleHasCoords, false, 'No raw coordinates in area title in Player Mode');
    await capturePng('02-leaving-town-north-gate.png');

    // =========================================================================
    // 08. Fog of War & Discovery (Early Forest Exploration at [15, 23])
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    })()`);
    const shot08Metrics = await evalJs(`(() => ({
      coord: [window.currentState.currentTile.x, window.currentState.currentTile.y],
      discoveredCount: window.currentState.topdownMap.discoveredTileCount,
      strongholdDiscovered: window.currentState.topdownMap.tiles.find(t => t.x === 15 && t.y === 2).isDiscovered
    }))()`);
    console.log('08 Fog of War Metrics:', shot08Metrics);
    assert.deepEqual(shot08Metrics.coord, [15, 23]);
    assert.equal(shot08Metrics.strongholdDiscovered, false, 'Stronghold is hidden under Fog of War at [15,23]');
    await capturePng('08-fog-of-war-and-discovery.png');

    // =========================================================================
    // 03. Main Forest Trail (Route A at [14, 19])
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'WEST', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    })()`);
    await capturePng('03-main-forest-trail.png');

    // =========================================================================
    // 06. Landmark — Ancient Black Oak [15, 15]
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 15, y: 15, facing: 'NORTH' });
    })()`);
    const oakMetrics = await evalJs(`(() => ({
      areaTitle: document.getElementById('fp-area-title').textContent.trim(),
      coord: [window.currentState.currentTile.x, window.currentState.currentTile.y]
    }))()`);
    assert.equal(oakMetrics.areaTitle, 'Ancient Black Oak');
    await capturePng('06-landmark-ancient-black-oak.png');

    // =========================================================================
    // 04. Western Wilderness Route (Route B at [8, 20])
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 9, y: 21, facing: 'WEST' });
      await window.dispatchAction('MOVE', { direction: 'WEST', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    })()`);
    await capturePng('04-western-wilderness-route.png');

    // =========================================================================
    // 07. Landmark — The Broken Shrine [7, 17]
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 7, y: 17, facing: 'NORTH' });
    })()`);
    const shrineMetrics = await evalJs(`(() => ({
      areaTitle: document.getElementById('fp-area-title').textContent.trim(),
      coord: [window.currentState.currentTile.x, window.currentState.currentTile.y]
    }))()`);
    assert.equal(shrineMetrics.areaTitle, 'The Broken Shrine');
    await capturePng('07-landmark-broken-shrine-or-watchpost.png');

    // =========================================================================
    // 05. Eastern River & Old Stone Bridge Route (Route C at [19, 25] -> [21, 25])
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 18, y: 25, facing: 'EAST' });
      await window.dispatchAction('MOVE', { direction: 'EAST', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'EAST', testForceEncounter: false });
      await window.dispatchAction('MOVE', { direction: 'EAST', testForceEncounter: false });
    })()`);
    const bridgeRouteMetrics = await evalJs(`(() => ({
      areaTitle: document.getElementById('fp-area-title').textContent.trim(),
      coord: [window.currentState.currentTile.x, window.currentState.currentTile.y]
    }))()`);
    assert.equal(bridgeRouteMetrics.areaTitle, 'Abandoned Watchpost');
    await capturePng('05-eastern-river-bridge-route.png');

    // =========================================================================
    // 09. Region Map Modal (`Map [M]`)
    // =========================================================================
    await evalJs(`(() => {
      window.openLabModal('map');
    })()`);
    const regionMapInfo = await evalJs(`(() => {
      const c = document.getElementById('region-map-overview-canvas') || document.getElementById('region-map-canvas');
      return {
        hasCanvas: Boolean(c && c.width > 200 && c.height > 200),
        bodyText: document.getElementById('lab-modal-body').textContent
      };
    })()`);
    assert.equal(regionMapInfo.hasCanvas, true, 'Region Map modal renders #region-map-canvas');
    assert.ok(regionMapInfo.bodyText.includes('Ancient Black Oak'), 'Region Map lists discovered Ancient Black Oak');
    assert.ok(regionMapInfo.bodyText.includes('Abandoned Watchpost'), 'Region Map lists discovered Abandoned Watchpost');
    await capturePng('09-region-map-modal.png');
    await evalJs(`(() => { window.closeLabModal(); })()`);

    // =========================================================================
    // 12. Goblin Forest Combat (Stage 2 Combat — Top-down map & movement pad hidden)
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 15, y: 9, facing: 'NORTH' });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: true });
      await window.dispatchAction('ENGAGE');
    })()`);
    const forestCombatMetrics = await evalJs(`(() => {
      const tdStage = document.getElementById('topdown-map-stage');
      const moveDeck = document.getElementById('dm-movement-deck');
      return {
        mode: window.currentState.mode,
        monsterName: window.currentState.encounter ? window.currentState.encounter.monsterName : null,
        topdownStageHidden: tdStage ? getComputedStyle(tdStage).display === 'none' : false,
        moveDeckHidden: moveDeck ? getComputedStyle(moveDeck).display === 'none' : false
      };
    })()`);
    console.log('12 Goblin Forest Combat Metrics:', forestCombatMetrics);
    assert.equal(forestCombatMetrics.mode, 'IN_COMBAT');
    assert.equal(forestCombatMetrics.topdownStageHidden, true, 'Top-down map stage hidden during active combat');
    assert.equal(forestCombatMetrics.moveDeckHidden, true, 'Movement deck hidden during active combat');
    await capturePng('12-goblin-forest-combat.png');

    // Finish the forest encounter cleanly
    const heroId = db.prepare('SELECT id FROM characters WHERE is_alive = 1 ORDER BY id DESC LIMIT 1').get().id;
    db.prepare('UPDATE characters SET strength = 28, current_hp = 60, max_hp = 60 WHERE id = ?').run(heroId);
    await evalJs(`(async () => {
      for (let i = 0; i < 10 && window.currentState.mode === 'IN_COMBAT'; i++) {
        await window.dispatchAction('ATTACK');
      }
      if (window.currentState.victory) {
        await window.dispatchAction('DISMISS_VICTORY');
      }
    })()`);

    // =========================================================================
    // 13. Goblin Stronghold Arrival [15, 2]
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 15, y: 3, facing: 'NORTH' });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
    })()`);
    const strongholdArrival = await evalJs(`(() => ({
      areaTitle: document.getElementById('fp-area-title').textContent.trim(),
      coord: [window.currentState.currentTile.x, window.currentState.currentTile.y],
      hasStrongholdCard: Boolean(document.getElementById('stronghold-entrance-card')),
      hasChallengeBtn: Boolean(document.getElementById('btn-engage-stronghold-boss'))
    }))()`);
    console.log('13 Goblin Stronghold Arrival:', strongholdArrival);
    assert.equal(strongholdArrival.areaTitle, 'Goblin Stronghold');
    assert.deepEqual(strongholdArrival.coord, [15, 2]);
    assert.equal(strongholdArrival.hasStrongholdCard, true);
    assert.equal(strongholdArrival.hasChallengeBtn, true);
    await capturePng('13-goblin-stronghold-arrival.png');

    // =========================================================================
    // 14. Goblin Chieftain Boss Combat (Warchief Grak — goblin.png + terrain_town_gates.webp)
    // =========================================================================
    await evalJs(`(async () => {
      await window.dispatchAction('ENGAGE_STRONGHOLD_BOSS');
    })()`);
    const bossCombatMetrics = await evalJs(`(() => {
      const tdStage = document.getElementById('topdown-map-stage');
      const terrainImg = document.getElementById('fp-terrain-img');
      return {
        mode: window.currentState.mode,
        monsterName: window.currentState.encounter ? window.currentState.encounter.monsterName : null,
        monsterImageUrl: window.currentState.encounter ? window.currentState.encounter.imageUrl : null,
        backdropUrl: terrainImg ? terrainImg.getAttribute('src') : null,
        topdownStageHidden: tdStage ? getComputedStyle(tdStage).display === 'none' : false
      };
    })()`);
    console.log('14 Boss Combat Metrics:', bossCombatMetrics);
    assert.equal(bossCombatMetrics.mode, 'IN_COMBAT');
    assert.equal(bossCombatMetrics.monsterName, 'Warchief Grak the Goblin Chieftain');
    assert.equal(bossCombatMetrics.monsterImageUrl, '/images/monsters/goblin.png');
    assert.equal(bossCombatMetrics.backdropUrl, '/images/terrain/terrain_town_gates.webp');
    assert.equal(bossCombatMetrics.topdownStageHidden, true);
    await capturePng('14-goblin-chieftain-boss-combat.png');

    assert.equal(consoleErrors.length, 0, `Expected 0 console errors, got: ${consoleErrors.join('; ')}`);
    assert.equal(pageExceptions.length, 0, `Expected 0 page exceptions, got: ${pageExceptions.join('; ')}`);

    console.log('ALL 14 PHASE 8 VISUAL QA SCREENSHOTS & MULTI-RESOLUTION AUDITS PASSED!');
  } finally {
    if (cdp && cdp.ws) {
      try { cdp.ws.close(); } catch {}
    }
    try { chromeProc.kill(); } catch {}
    await new Promise(resolve => server.close(resolve));
  }
}

runPhase8VisualQa().catch(err => {
  console.error('Phase 8 Visual QA failed:', err);
  process.exit(1);
});
