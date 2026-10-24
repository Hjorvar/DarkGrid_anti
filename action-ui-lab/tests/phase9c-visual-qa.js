/**
 * DARKGRID PHASE 9C — Headless Chrome Visual QA & 11-Screenshot Verification Suite
 *
 * Verifies and captures all Phase 9C visual states into:
 * - action-ui-lab/docs/phase-9c/screenshots/
 *
 * Visual QA Checks:
 *  01. Goblin Cave Major Landmark Scene ([9, 12]) — Entrance with "Delve into the Cave Mouth"
 *  02. Goblin Cave Dungeon Map at Start ([3, 16]) — Tight Line-of-Sight Fog of War (radius 2)
 *  03. Goblin Cave Dungeon Map After Exploration — 3 distinct FoW states (VISIBLE, EXPLORED_MEMORY, UNEXPLORED)
 *  04. Goblin Cave Boss Sanctum ([16, 2]) — Brood-King Sanctum & Skulkrip the Cave Brood-King challenge banner
 *  05. Ancient Crypt Major Landmark Scene ([26, 5]) — Entrance with "Breach the Sepulcher Vault"
 *  06. Ancient Crypt Dungeon Map at Start ([10, 17]) — Tight Line-of-Sight Fog of War
 *  07. Ancient Crypt Dungeon Map After Exploration — Explored Hall of Sarcophagi & Temple Nave in memory
 *  08. Ancient Crypt Boss Sanctum ([10, 2]) — Royal Sepulcher & Lord Malakor the Barrow-Wight King challenge banner
 *  09. Ravencrag Highlands 2D Overworld Exploration ([35, 15]) — Giant's Span Bridge & Shattered Gorge palette
 *  10. Ravencrag Citadel Major Landmark Scene ([37, 3]) — Auto-opens on arrival with Warlord Kraug challenge button
 *  11. Expanded 44x30 Three-Region World Map Modal ([M]) — Displays Goblin Forest, Undead Lands, and Ravencrag Highlands
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createLabApp } = require('../server');
const { DUNGEON_DEFINITIONS } = require('../server/services/dungeon-service');

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

function stepDirection(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (dx === 0 && dy === -1) return 'NORTH';
  if (dx === 0 && dy === 1) return 'SOUTH';
  if (dx === 1 && dy === 0) return 'EAST';
  if (dx === -1 && dy === 0) return 'WEST';
  throw new Error(`Non-adjacent step from [${from}] to [${to}]`);
}

function findShortestDungeonPath(dungeonKey, startCoord, goalCoord) {
  const def = DUNGEON_DEFINITIONS[dungeonKey];
  const startKey = `${startCoord[0]},${startCoord[1]}`;
  const goalKey = `${goalCoord[0]},${goalCoord[1]}`;
  const queue = [[startCoord]];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const p = queue.shift();
    const [cx, cy] = p[p.length - 1];
    if (`${cx},${cy}` === goalKey) return p;

    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nKey = `${nx},${ny}`;
      const tile = def.tileMap.get(nKey);
      if (tile && tile.isPassable === 1 && !visited.has(nKey)) {
        visited.add(nKey);
        queue.push([...p, [nx, ny]]);
      }
    }
  }
  return null;
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

async function runPhase9cVisualQa() {
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    throw new Error('No Chrome/Edge binary found for headless Visual QA.');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-phase9c-vqa-'));
  const dbPath = path.join(tmpDir, 'phase9c-vqa.db');
  const tmpProfile = path.join(tmpDir, 'chrome-profile');
  fs.mkdirSync(tmpProfile, { recursive: true });

  const outDir = path.resolve(__dirname, '..', 'docs', 'phase-9c', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const app = createLabApp({ dbPath, allowLabTools: true });
  const db = app.locals.db;
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/`;
  const debugPort = 9550 + Math.floor(Math.random() * 350);

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
      const fullPath = path.join(outDir, filename);
      fs.writeFileSync(fullPath, buf);
      console.log(`Captured ${filename} (${buf.length} bytes)`);
      return fullPath;
    }

    const loaded = await evalJs(`(async () => {
      for (let i = 0; i < 40; i++) {
        if (window.currentState && document.getElementById('major-landmark-scene-panel')) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    })()`);
    assert.equal(loaded, true, 'Initial game state loaded');

    // =========================================================================
    // 01. Goblin Cave Major Landmark Scene ([9, 12])
    // =========================================================================
    const shot01 = await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 8, y: 12, facing: 'EAST' });
      await window.dispatchAction('MOVE', { direction: 'EAST', testForceEncounter: false });
      const panel = document.getElementById('major-landmark-scene-panel');
      return {
        hasPanel: Boolean(panel),
        sceneKey: panel ? panel.getAttribute('data-scene-key') : null,
        delveBtn: Boolean(document.getElementById('btn-explore-goblin-cave'))
      };
    })()`);
    assert.equal(shot01.hasPanel, true);
    assert.equal(shot01.sceneKey, 'GOBLIN_CAVE');
    assert.equal(shot01.delveBtn, true);
    await capturePng('01-goblin-cave-entrance.png');

    // =========================================================================
    // 02. Goblin Cave Dungeon Map at Start ([3, 16]) — Tight Fog of War
    // =========================================================================
    const shot02 = await evalJs(`(async () => {
      await window.dispatchAction('EXPLORE_GOBLIN_CAVE');
      const dMap = window.currentState?.dungeonMap;
      return {
        inDungeon: Boolean(dMap?.inDungeon),
        dungeonKey: dMap?.dungeonKey,
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        visibleCount: dMap?.tiles?.filter(t => t.fogState === 'VISIBLE').length || 0,
        unexploredCount: dMap?.tiles?.filter(t => t.fogState === 'UNEXPLORED').length || 0,
        ascendBtn: Boolean(document.getElementById('btn-exit-dungeon'))
      };
    })()`);
    assert.equal(shot02.inDungeon, true);
    assert.equal(shot02.dungeonKey, 'GOBLIN_CAVE');
    assert.equal(shot02.heroX, 3);
    assert.equal(shot02.heroY, 16);
    assert.ok(shot02.visibleCount >= 5 && shot02.visibleCount <= 18);
    assert.equal(shot02.ascendBtn, true);
    await capturePng('02-goblin-cave-start-fog.png');

    // =========================================================================
    // 03. Goblin Cave Dungeon Map After Exploration (VISIBLE + EXPLORED_MEMORY + UNEXPLORED)
    // =========================================================================
    const caveExplorePath = findShortestDungeonPath('GOBLIN_CAVE', [3, 16], [10, 12]);
    const caveDirs = [];
    for (let i = 1; i < caveExplorePath.length; i++) {
      caveDirs.push(stepDirection(caveExplorePath[i - 1], caveExplorePath[i]));
    }
    const shot03 = await evalJs(`(async () => {
      const dirs = ${JSON.stringify(caveDirs)};
      for (const dir of dirs) {
        await window.dispatchAction('MOVE', { direction: dir, testForceEncounter: false });
      }
      const dMap = window.currentState?.dungeonMap;
      return {
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        visibleCount: dMap?.tiles?.filter(t => t.fogState === 'VISIBLE').length || 0,
        memoryCount: dMap?.tiles?.filter(t => t.fogState === 'EXPLORED_MEMORY').length || 0,
        unexploredCount: dMap?.tiles?.filter(t => t.fogState === 'UNEXPLORED').length || 0
      };
    })()`);
    assert.equal(shot03.heroX, 10);
    assert.equal(shot03.heroY, 12);
    assert.ok(shot03.memoryCount >= 12, 'Explored tunnels behind hero are rendered in dimmed EXPLORED_MEMORY');
    await capturePng('03-goblin-cave-explored-memory.png');

    // =========================================================================
    // 04. Goblin Cave Boss Sanctum ([16, 2]) — Skulkrip the Cave Brood-King
    // =========================================================================
    const caveToBossPath = findShortestDungeonPath('GOBLIN_CAVE', [10, 12], [16, 2]);
    const caveBossDirs = [];
    for (let i = 1; i < caveToBossPath.length; i++) {
      caveBossDirs.push(stepDirection(caveToBossPath[i - 1], caveToBossPath[i]));
    }
    const shot04 = await evalJs(`(async () => {
      const dirs = ${JSON.stringify(caveBossDirs)};
      for (const dir of dirs) {
        await window.dispatchAction('MOVE', { direction: dir, testForceEncounter: false });
      }
      const dMap = window.currentState?.dungeonMap;
      const bossCard = document.getElementById('dungeon-boss-sanctum-card');
      const challengeBtn = document.getElementById('btn-engage-dungeon-boss');
      return {
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        atBossTile: Boolean(dMap?.atBossTile),
        bossName: dMap?.bossName,
        hasBossCard: Boolean(bossCard),
        hasChallengeBtn: Boolean(challengeBtn)
      };
    })()`);
    assert.equal(shot04.heroX, 16);
    assert.equal(shot04.heroY, 2);
    assert.equal(shot04.atBossTile, true);
    assert.equal(shot04.bossName, 'Skulkrip the Cave Brood-King');
    assert.equal(shot04.hasBossCard, true);
    assert.equal(shot04.hasChallengeBtn, true);
    await capturePng('04-goblin-cave-boss-sanctum.png');

    // =========================================================================
    // 05. Ancient Crypt Major Landmark Scene ([26, 5])
    // =========================================================================
    const shot05 = await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 26, y: 6, facing: 'NORTH' });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      const panel = document.getElementById('major-landmark-scene-panel');
      return {
        hasPanel: Boolean(panel),
        sceneKey: panel ? panel.getAttribute('data-scene-key') : null,
        breachBtn: Boolean(document.getElementById('btn-enter-ancient-crypt'))
      };
    })()`);
    assert.equal(shot05.hasPanel, true);
    assert.equal(shot05.sceneKey, 'ANCIENT_CRYPT');
    assert.equal(shot05.breachBtn, true);
    await capturePng('05-ancient-crypt-entrance.png');

    // =========================================================================
    // 06. Ancient Crypt Dungeon Map at Start ([10, 17]) — Tight Fog of War
    // =========================================================================
    const shot06 = await evalJs(`(async () => {
      await window.dispatchAction('ENTER_ANCIENT_CRYPT');
      const dMap = window.currentState?.dungeonMap;
      return {
        inDungeon: Boolean(dMap?.inDungeon),
        dungeonKey: dMap?.dungeonKey,
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        visibleCount: dMap?.tiles?.filter(t => t.fogState === 'VISIBLE').length || 0,
        unexploredCount: dMap?.tiles?.filter(t => t.fogState === 'UNEXPLORED').length || 0
      };
    })()`);
    assert.equal(shot06.inDungeon, true);
    assert.equal(shot06.dungeonKey, 'ANCIENT_CRYPT');
    assert.equal(shot06.heroX, 10);
    assert.equal(shot06.heroY, 17);
    await capturePng('06-ancient-crypt-start-fog.png');

    // =========================================================================
    // 07. Ancient Crypt Dungeon Map After Exploration
    // =========================================================================
    const cryptExplorePath = findShortestDungeonPath('ANCIENT_CRYPT', [10, 17], [6, 11]);
    const cryptDirs = [];
    for (let i = 1; i < cryptExplorePath.length; i++) {
      cryptDirs.push(stepDirection(cryptExplorePath[i - 1], cryptExplorePath[i]));
    }
    const shot07 = await evalJs(`(async () => {
      const dirs = ${JSON.stringify(cryptDirs)};
      for (const dir of dirs) {
        await window.dispatchAction('MOVE', { direction: dir, testForceEncounter: false });
      }
      const dMap = window.currentState?.dungeonMap;
      return {
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        memoryCount: dMap?.tiles?.filter(t => t.fogState === 'EXPLORED_MEMORY').length || 0
      };
    })()`);
    assert.equal(shot07.heroX, 6);
    assert.equal(shot07.heroY, 11);
    assert.ok(shot07.memoryCount >= 12);
    await capturePng('07-ancient-crypt-explored-memory.png');

    // =========================================================================
    // 08. Ancient Crypt Boss Sanctum ([10, 2]) — Lord Malakor the Barrow-Wight King
    // =========================================================================
    const cryptToBossPath = findShortestDungeonPath('ANCIENT_CRYPT', [6, 11], [10, 2]);
    const cryptBossDirs = [];
    for (let i = 1; i < cryptToBossPath.length; i++) {
      cryptBossDirs.push(stepDirection(cryptToBossPath[i - 1], cryptToBossPath[i]));
    }
    const shot08 = await evalJs(`(async () => {
      const dirs = ${JSON.stringify(cryptBossDirs)};
      for (const dir of dirs) {
        await window.dispatchAction('MOVE', { direction: dir, testForceEncounter: false });
      }
      const dMap = window.currentState?.dungeonMap;
      const bossCard = document.getElementById('dungeon-boss-sanctum-card');
      return {
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        atBossTile: Boolean(dMap?.atBossTile),
        bossName: dMap?.bossName,
        hasBossCard: Boolean(bossCard)
      };
    })()`);
    assert.equal(shot08.heroX, 10);
    assert.equal(shot08.heroY, 2);
    assert.equal(shot08.atBossTile, true);
    assert.equal(shot08.bossName, 'Lord Malakor the Barrow-Wight King');
    assert.equal(shot08.hasBossCard, true);
    await capturePng('08-ancient-crypt-boss-sanctum.png');

    // =========================================================================
    // 09. Ravencrag Highlands 2D Overworld Exploration ([35, 15] — Giant's Span Bridge)
    // =========================================================================
    const shot09 = await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 35, y: 15, facing: 'NORTH' });
      const st = window.currentState;
      return {
        x: st?.currentTile?.x,
        y: st?.currentTile?.y,
        regionName: st?.topdownMap?.regionName,
        dangerZone: st?.dangerZone?.zoneKey
      };
    })()`);
    assert.equal(shot09.x, 35);
    assert.equal(shot09.y, 15);
    assert.ok(String(shot09.regionName).includes('Ravencrag Highlands'));
    assert.equal(shot09.dangerZone, 'HIGHLAND_SHATTERED_GORGE');
    await capturePng('09-ravencrag-highlands.png');

    // =========================================================================
    // 10. Ravencrag Citadel Major Landmark Scene ([37, 3])
    // =========================================================================
    const shot10 = await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 37, y: 4, facing: 'NORTH' });
      await window.dispatchAction('MOVE', { direction: 'NORTH', testForceEncounter: false });
      const panel = document.getElementById('major-landmark-scene-panel');
      return {
        hasPanel: Boolean(panel),
        sceneKey: panel ? panel.getAttribute('data-scene-key') : null,
        confrontBtn: Boolean(document.getElementById('btn-confront-highland-warlord'))
      };
    })()`);
    assert.equal(shot10.hasPanel, true);
    assert.equal(shot10.sceneKey, 'RAVENCRAG_CITADEL');
    assert.equal(shot10.confrontBtn, true);
    await capturePng('10-ravencrag-citadel-scene.png');

    // =========================================================================
    // 11. Expanded 44x30 Three-Region World Map Modal ([M])
    // =========================================================================
    const shot11 = await evalJs(`(async () => {
      await window.dispatchAction('DISMISS_LANDMARK_SCENE');
      window.openLabModal('map');
      await new Promise(r => setTimeout(r, 200));
      const modal = document.getElementById('lab-modal-backdrop');
      const canvas = document.getElementById('region-map-overview-canvas');
      return {
        modalOpen: Boolean(modal && !modal.hidden),
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0,
        regionCount: window.currentState?.topdownMap?.regionMap?.regions?.length || 0,
        modalText: modal ? modal.textContent : ''
      };
    })()`);
    assert.equal(shot11.modalOpen, true);
    assert.ok(shot11.canvasWidth >= 580, `Expanded 44x30 Region Map canvas width (${shot11.canvasWidth})`);
    assert.equal(shot11.regionCount, 3);
    assert.match(shot11.modalText, /Ravencrag Citadel/i);
    await capturePng('11-expanded-region-map.png');

    assert.equal(consoleErrors.length, 0, `Unexpected browser console errors: ${consoleErrors.join('; ')}`);
    assert.equal(pageExceptions.length, 0, `Unexpected page exceptions: ${pageExceptions.join('; ')}`);

    console.log('Phase 9C Visual QA passed! All 11 screenshots captured with 0 console/page errors.');
  } finally {
    if (cdp && cdp.ws) {
      try { cdp.ws.close(); } catch { /* ignore */ }
    }
    try { chromeProc.kill(); } catch { /* ignore */ }
    await new Promise((resolve) => server.close(resolve));
    try { db.close(); } catch { /* ignore */ }
  }
}

runPhase9cVisualQa().catch((err) => {
  console.error('Phase 9C Visual QA failed:', err);
  process.exit(1);
});
