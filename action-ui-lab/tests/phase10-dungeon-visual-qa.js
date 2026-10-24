/**
 * PHASE 10 — AGENT E: HEADLESS CHROME DUNGEON VISUAL QA & SCREENSHOT SUITE
 *
 * Captures 1440x900 and 1920x1080 screenshots into `docs/phase-10/screenshots/`
 * and performs automated canvas pixel & DOM layout verification for:
 * - Goblin Cave (`GOBLIN_CAVE`) entrance, start LoS & Fog of War (#050508),
 *   explored corridors/chambers/glowing mushrooms/treasures/guard posts/hazards,
 *   Boss Sanctum (Skulkrip the Cave Brood-King), and live dungeon combat.
 * - Ancient Crypt (`ANCIENT_CRYPT`) entrance, start LoS & Fog of War (#050508),
 *   explored pillared nave/sarcophagi/runestones/shrines/guard posts/hazards,
 *   Boss Sanctum (Lord Malakor the Barrow-Wight King), and live dungeon combat.
 *
 * Strictly walks step-by-step (`MOVE` / `TURN`) without `TELEPORT_TO_TILE`.
 */
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createLabApp } = require('../server');
const { DUNGEON_DEFINITIONS } = require('../server/services/dungeon-service');
const { TOPDOWN_TILES } = require('../server/services/topdown-world-service');

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

function findShortestOverworldDirections(startCoord, goalCoord) {
  const passable = new Set();
  for (const t of TOPDOWN_TILES) {
    if (t.isPassable || t.is_passable === 1) passable.add(`${t.x},${t.y}`);
  }
  const startKey = `${startCoord[0]},${startCoord[1]}`;
  const goalKey = `${goalCoord[0]},${goalCoord[1]}`;
  const queue = [[startCoord]];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const p = queue.shift();
    const [cx, cy] = p[p.length - 1];
    if (`${cx},${cy}` === goalKey) {
      const dirs = [];
      for (let i = 1; i < p.length; i++) {
        dirs.push(stepDirection(p[i - 1], p[i]));
      }
      return dirs;
    }
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nKey = `${nx},${ny}`;
      if (passable.has(nKey) && !visited.has(nKey)) {
        visited.add(nKey);
        queue.push([...p, [nx, ny]]);
      }
    }
  }
  throw new Error(`No passable overworld path from [${startCoord}] to [${goalCoord}]`);
}

function findShortestDungeonDirections(dungeonKey, startCoord, goalCoord) {
  const def = DUNGEON_DEFINITIONS[dungeonKey];
  const startKey = `${startCoord[0]},${startCoord[1]}`;
  const goalKey = `${goalCoord[0]},${goalCoord[1]}`;
  const queue = [[startCoord]];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const p = queue.shift();
    const [cx, cy] = p[p.length - 1];
    if (`${cx},${cy}` === goalKey) {
      const dirs = [];
      for (let i = 1; i < p.length; i++) {
        dirs.push(stepDirection(p[i - 1], p[i]));
      }
      return dirs;
    }
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
  throw new Error(`No passable dungeon path in ${dungeonKey} from [${startCoord}] to [${goalCoord}]`);
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

async function runPhase10DungeonVisualQa() {
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    throw new Error('No Chrome/Edge binary found for headless Visual QA.');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-phase10-dungeon-vqa-'));
  const dbPath = path.join(tmpDir, 'phase10-dungeon-vqa.db');
  const tmpProfile = path.join(tmpDir, 'chrome-profile');
  fs.mkdirSync(tmpProfile, { recursive: true });

  const outDir = path.resolve(__dirname, '..', '..', 'docs', 'phase-10', 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  let seqIdx = 0;
  const seq = [0.74, 0.82, 0.68, 0.79, 0.88, 0.71, 0.85];
  const deterministicRng = () => {
    const v = seq[seqIdx % seq.length];
    seqIdx += 1;
    return v;
  };

  const app = createLabApp({ dbPath, rng: deterministicRng });
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

    async function setViewportSize(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(220);
      await evalJs(`(() => { window.dispatchEvent(new Event('resize')); return true; })()`);
      await sleep(180);
    }

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

    async function captureBothResolutions(baseName) {
      await setViewportSize(1440, 900);
      const layout1440 = await verifyLayoutAndCanvasSharpness();
      assert.equal(layout1440.clippedElements.length, 0, `Clipped elements at 1440x900 (${baseName}): ${JSON.stringify(layout1440.clippedElements)}`);
      const shot1440 = await send('Page.captureScreenshot', { format: 'png' });
      const buf1440 = Buffer.from(shot1440.data, 'base64');
      const file1440 = `${baseName}-1440x900.png`;
      fs.writeFileSync(path.join(outDir, file1440), buf1440);
      console.log(`Captured ${file1440} (${buf1440.length} bytes)`);

      await setViewportSize(1920, 1080);
      const layout1920 = await verifyLayoutAndCanvasSharpness();
      assert.equal(layout1920.clippedElements.length, 0, `Clipped elements at 1920x1080 (${baseName}): ${JSON.stringify(layout1920.clippedElements)}`);
      const shot1920 = await send('Page.captureScreenshot', { format: 'png' });
      const buf1920 = Buffer.from(shot1920.data, 'base64');
      const file1920 = `${baseName}-1920x1080.png`;
      fs.writeFileSync(path.join(outDir, file1920), buf1920);
      console.log(`Captured ${file1920} (${buf1920.length} bytes)`);

      await setViewportSize(1440, 900);
      return { layout1440, layout1920 };
    }

    async function verifyLayoutAndCanvasSharpness() {
      return evalJs(`(() => {
        const canvas = document.getElementById('topdown-map-canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
        const selectors = [
          '#dungeon-vista-bar',
          '#dungeon-boss-sanctum-card .major-landmark-title',
          '#dungeon-exit-stairs-card .major-landmark-title',
          '#major-landmark-scene-panel .major-landmark-title'
        ];
        const clippedElements = [];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (!el || el.hidden || el.offsetParent === null) continue;
          if (el.scrollWidth > el.clientWidth + 4) {
            clippedElements.push({ selector: sel, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
          }
        }
        // Sample top-left corner pixel (4, 4) of dungeon canvas when inDungeon to verify #050508 unexplored darkness
        let cornerHex = null;
        if (canvas && window.currentState?.dungeonMap?.inDungeon) {
          const ctx = canvas.getContext('2d');
          const p = ctx.getImageData(4, 4, 1, 1).data;
          cornerHex = '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        }
        return {
          canvasW: Math.round(rect.width),
          canvasH: Math.round(rect.height),
          cornerHex,
          clippedElements
        };
      })()`);
    }

    async function walkDirsInBrowser(dirs) {
      return evalJs(`(async () => {
        const stepDirs = ${JSON.stringify(dirs)};
        for (const dir of stepDirs) {
          if (window.currentState?.encounter) {
            if (window.currentState.encounter.status === 'DISCOVERED') {
              await window.dispatchAction('FIGHT');
            }
            let guard = 0;
            while (window.currentState?.encounter && window.currentState.encounter.status === 'IN_COMBAT' && guard < 30) {
              guard++;
              await window.dispatchAction('ATTACK');
            }
          }
          await window.dispatchAction('MOVE', { direction: dir });
          if (window.currentState?.encounter) {
            if (window.currentState.encounter.status === 'DISCOVERED') {
              await window.dispatchAction('FIGHT');
            }
            let guard = 0;
            while (window.currentState?.encounter && window.currentState.encounter.status === 'IN_COMBAT' && guard < 30) {
              guard++;
              await window.dispatchAction('ATTACK');
            }
          }
        }
        return {
          overworldX: window.currentState?.currentTile?.x,
          overworldY: window.currentState?.currentTile?.y,
          dungeonX: window.currentState?.dungeonMap?.heroX,
          dungeonY: window.currentState?.dungeonMap?.heroY
        };
      })()`);
    }

    await setViewportSize(1440, 900);
    await sleep(700);

    const loaded = await evalJs(`(async () => {
      for (let i = 0; i < 40; i++) {
        if (window.currentState && document.getElementById('topdown-map-canvas')) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    })()`);
    assert.equal(loaded, true, 'Initial game state loaded in headless Chrome');

    // Prepare hero stats for smooth visual QA traversal while keeping 100% real movement & combat
    const heroId = await evalJs(`window.currentState.character.id`);
    db.prepare('UPDATE characters SET level = 6, strength = 26, constitution = 22, wisdom = 22, max_hp = 95, current_hp = 95, gold = 300 WHERE id = ?').run(heroId);

    // =========================================================================
    // 01. Walk Step-by-Step from Oakhaven [15, 27] to Goblin Cave [9, 12]
    // =========================================================================
    const dirsToCave = findShortestOverworldDirections([15, 27], [9, 12]);
    await walkDirsInBrowser(dirsToCave);
    const atCave = await evalJs(`(() => ({
      x: window.currentState?.currentTile?.x,
      y: window.currentState?.currentTile?.y,
      sceneKey: document.getElementById('major-landmark-scene-panel')?.getAttribute('data-scene-key'),
      hasDelveBtn: Boolean(document.getElementById('btn-explore-goblin-cave'))
    }))()`);
    assert.equal(atCave.x, 9);
    assert.equal(atCave.y, 12);
    assert.equal(atCave.sceneKey, 'GOBLIN_CAVE');
    assert.equal(atCave.hasDelveBtn, true);
    await captureBothResolutions('dungeon-01-goblin-cave-entrance');

    // =========================================================================
    // 02. Enter Goblin Cave ([3, 16]) — Start LoS, Exit Stairs, #050508 Darkness
    // =========================================================================
    const enterCave = await evalJs(`(async () => {
      await window.dispatchAction('EXPLORE_GOBLIN_CAVE');
      const dMap = window.currentState?.dungeonMap;
      return {
        inDungeon: Boolean(dMap?.inDungeon),
        dungeonKey: dMap?.dungeonKey,
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        visionRadius: dMap?.visionRadius,
        visibleCount: dMap?.tiles?.filter(t => t.fogState === 'VISIBLE').length || 0,
        unexploredCount: dMap?.tiles?.filter(t => t.fogState === 'UNEXPLORED').length || 0
      };
    })()`);
    assert.equal(enterCave.inDungeon, true);
    assert.equal(enterCave.dungeonKey, 'GOBLIN_CAVE');
    assert.equal(enterCave.heroX, 3);
    assert.equal(enterCave.heroY, 16);
    const caveStartCheck = await captureBothResolutions('dungeon-02-goblin-cave-start-los');
    assert.equal(caveStartCheck.layout1440.cornerHex, '#050508', 'Unexplored dungeon void must be exact #050508');

    // =========================================================================
    // 03. Explore Goblin Cave Corridors, Chest [1, 15], Spikes [2, 14], Webs [3, 9] & Shrine [2, 2]
    // =========================================================================
    const cavePath1 = findShortestDungeonDirections('GOBLIN_CAVE', [3, 16], [1, 15]);
    await walkDirsInBrowser(cavePath1);
    const cavePath2 = findShortestDungeonDirections('GOBLIN_CAVE', [1, 15], [3, 9]);
    await walkDirsInBrowser(cavePath2);
    const caveExplored = await evalJs(`(() => {
      const dMap = window.currentState?.dungeonMap;
      return {
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        visibleCount: dMap?.tiles?.filter(t => t.fogState === 'VISIBLE').length || 0,
        memoryCount: dMap?.tiles?.filter(t => t.fogState === 'EXPLORED_MEMORY').length || 0
      };
    })()`);
    assert.equal(caveExplored.heroX, 3);
    assert.equal(caveExplored.heroY, 9);
    assert.ok(caveExplored.memoryCount >= 10, 'Explored Goblin Cave tunnels must transition to EXPLORED_MEMORY');
    await captureBothResolutions('dungeon-03-goblin-cave-corridors-and-props');

    // =========================================================================
    // 04. Goblin Cave Boss Sanctum ([16, 2]) & Live Boss Combat (Skulkrip)
    // =========================================================================
    const cavePathToBoss = findShortestDungeonDirections('GOBLIN_CAVE', [3, 9], [16, 2]);
    await walkDirsInBrowser(cavePathToBoss);
    const atCaveBoss = await evalJs(`(() => ({
      heroX: window.currentState?.dungeonMap?.heroX,
      heroY: window.currentState?.dungeonMap?.heroY,
      atBossTile: Boolean(window.currentState?.dungeonMap?.atBossTile),
      hasBossCard: Boolean(document.getElementById('dungeon-boss-sanctum-card'))
    }))()`);
    assert.equal(atCaveBoss.heroX, 16);
    assert.equal(atCaveBoss.heroY, 2);
    assert.equal(atCaveBoss.atBossTile, true);
    assert.equal(atCaveBoss.hasBossCard, true);
    await captureBothResolutions('dungeon-04-goblin-cave-boss-sanctum');

    // Start Skulkrip combat, capture combat screenshot, then finish boss fight
    await evalJs(`window.dispatchAction('ENGAGE_DUNGEON_BOSS')`);
    await captureBothResolutions('dungeon-05-goblin-cave-boss-combat');
    await evalJs(`(async () => {
      let guard = 0;
      while (window.currentState?.encounter && window.currentState.encounter.status === 'IN_COMBAT' && guard < 30) {
        guard++;
        await window.dispatchAction('ATTACK');
      }
      return window.currentState?.dungeonMap?.bossSlain;
    })()`);

    // Walk back to Goblin Cave Exit Stairs [3, 16] and exit
    const cavePathExit = findShortestDungeonDirections('GOBLIN_CAVE', [16, 2], [3, 16]);
    await walkDirsInBrowser(cavePathExit);
    await evalJs(`window.dispatchAction('EXIT_DUNGEON')`);

    // =========================================================================
    // 05. Walk Step-by-Step from Goblin Cave [9, 12] to Ancient Crypt [26, 5]
    // =========================================================================
    db.prepare('UPDATE characters SET current_hp = 95 WHERE id = ?').run(heroId);
    const dirsCaveToCrypt = findShortestOverworldDirections([9, 12], [26, 5]);
    await walkDirsInBrowser(dirsCaveToCrypt);
    const atCrypt = await evalJs(`(() => ({
      x: window.currentState?.currentTile?.x,
      y: window.currentState?.currentTile?.y,
      sceneKey: document.getElementById('major-landmark-scene-panel')?.getAttribute('data-scene-key'),
      hasBreachBtn: Boolean(document.getElementById('btn-enter-ancient-crypt'))
    }))()`);
    assert.equal(atCrypt.x, 26);
    assert.equal(atCrypt.y, 5);
    assert.equal(atCrypt.sceneKey, 'ANCIENT_CRYPT');
    assert.equal(atCrypt.hasBreachBtn, true);
    await captureBothResolutions('dungeon-06-ancient-crypt-entrance');

    // =========================================================================
    // 06. Enter Ancient Crypt ([10, 17]) — Start LoS, Pillared Nave & #050508 Darkness
    // =========================================================================
    const enterCrypt = await evalJs(`(async () => {
      await window.dispatchAction('ENTER_ANCIENT_CRYPT');
      const dMap = window.currentState?.dungeonMap;
      return {
        inDungeon: Boolean(dMap?.inDungeon),
        dungeonKey: dMap?.dungeonKey,
        heroX: dMap?.heroX,
        heroY: dMap?.heroY
      };
    })()`);
    assert.equal(enterCrypt.inDungeon, true);
    assert.equal(enterCrypt.dungeonKey, 'ANCIENT_CRYPT');
    assert.equal(enterCrypt.heroX, 10);
    assert.equal(enterCrypt.heroY, 17);
    const cryptStartCheck = await captureBothResolutions('dungeon-07-ancient-crypt-start-los');
    assert.equal(cryptStartCheck.layout1440.cornerHex, '#050508', 'Unexplored Ancient Crypt void must be exact #050508');

    // =========================================================================
    // 07. Explore Ancient Crypt Sarcophagi, Nave, Reliquary [1, 17] & Cursed Brazier [7, 7]
    // =========================================================================
    const cryptPath1 = findShortestDungeonDirections('ANCIENT_CRYPT', [10, 17], [1, 17]);
    await walkDirsInBrowser(cryptPath1);
    const cryptPath2 = findShortestDungeonDirections('ANCIENT_CRYPT', [1, 17], [7, 7]);
    await walkDirsInBrowser(cryptPath2);
    const cryptExplored = await evalJs(`(() => {
      const dMap = window.currentState?.dungeonMap;
      return {
        heroX: dMap?.heroX,
        heroY: dMap?.heroY,
        memoryCount: dMap?.tiles?.filter(t => t.fogState === 'EXPLORED_MEMORY').length || 0
      };
    })()`);
    assert.equal(cryptExplored.heroX, 7);
    assert.equal(cryptExplored.heroY, 7);
    assert.ok(cryptExplored.memoryCount >= 12, 'Explored Ancient Crypt halls must transition to EXPLORED_MEMORY');
    await captureBothResolutions('dungeon-08-ancient-crypt-halls-and-sarcophagi');

    // =========================================================================
    // 08. Ancient Crypt Boss Sanctum ([10, 2]) & Live Boss Combat (Lord Malakor)
    // =========================================================================
    const cryptPathToBoss = findShortestDungeonDirections('ANCIENT_CRYPT', [7, 7], [10, 2]);
    await walkDirsInBrowser(cryptPathToBoss);
    const atCryptBoss = await evalJs(`(() => ({
      heroX: window.currentState?.dungeonMap?.heroX,
      heroY: window.currentState?.dungeonMap?.heroY,
      atBossTile: Boolean(window.currentState?.dungeonMap?.atBossTile),
      hasBossCard: Boolean(document.getElementById('dungeon-boss-sanctum-card'))
    }))()`);
    assert.equal(atCryptBoss.heroX, 10);
    assert.equal(atCryptBoss.heroY, 2);
    assert.equal(atCryptBoss.atBossTile, true);
    assert.equal(atCryptBoss.hasBossCard, true);
    await captureBothResolutions('dungeon-09-ancient-crypt-boss-sanctum');

    await evalJs(`window.dispatchAction('ENGAGE_DUNGEON_BOSS')`);
    await captureBothResolutions('dungeon-10-ancient-crypt-boss-combat');

    assert.equal(consoleErrors.length, 0, `Unexpected browser console errors: ${consoleErrors.join('; ')}`);
    assert.equal(pageExceptions.length, 0, `Unexpected page exceptions: ${pageExceptions.join('; ')}`);

    console.log('Phase 10 Dungeon Visual QA passed! All 20 screenshots (1440x900 & 1920x1080) captured with 0 console/page errors.');
  } finally {
    if (cdp && cdp.ws) {
      try { cdp.ws.close(); } catch { /* ignore */ }
    }
    try { chromeProc.kill(); } catch { /* ignore */ }
    await new Promise((resolve) => server.close(resolve));
    try { db.close(); } catch { /* ignore */ }
  }
}

runPhase10DungeonVisualQa().catch((err) => {
  console.error('Phase 10 Dungeon Visual QA failed:', err);
  process.exit(1);
});
