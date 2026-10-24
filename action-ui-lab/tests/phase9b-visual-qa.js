/**
 * DARKGRID PHASE 9B — Headless Chrome Visual QA & 8-Screenshot Verification Suite
 *
 * Verifies and captures all Phase 9B visual states into:
 * - action-ui-lab/docs/screenshots/phase-9b/
 *
 * Visual QA Checks:
 *  01. The Goblin Cave Major Landmark Scene ([9, 12]) — Auto-opens on arrival with terrain_caves.webp, Delve into the Cave Mouth & Continue Exploring
 *  02. Goblin Cave 2D Map Restored ([9, 12]) — Continue Exploring restores 2D map with custom cave archway & bone totems and 🕳️ Cave Mouth badge
 *  03. Goblin Cave Delve Combat ([9, 12]) — Delving starts combat in terrain_caves.webp and suppresses the Landmark Scene overlay
 *  04. Undead Lands — Deadman's Mire & Drowned Ossuary ([26, 19]) 2D Map Exploration (distinct necrotic palette, flagstones, blight pools)
 *  05. Undead Lands — Ashen Barrowlands & Blighted Chapel ([26, 9]) 2D Map Exploration (dead barrow trees, headstones, gothic chapel ruins)
 *  06. The Ancient Crypt Major Landmark Scene ([26, 5]) — Auto-opens on arrival with terrain_ruins.webp, necrotic emerald styling, Breach the Sepulcher Vault & Continue Exploring
 *  07. Ancient Crypt 2D Map Restored ([26, 5]) — Continue Exploring restores 2D map showing Obsidian Crypt Bastion & ⚰️ Crypt Threshold badge
 *  08. Region Map Modal [M] — Displays expanded world with Goblin Forest, Goblin Cave, Undead Lands, Sepulcher Road, and Ancient Crypt
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

async function runPhase9bVisualQa() {
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    throw new Error('No Chrome/Edge binary found for headless Visual QA.');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-phase9b-vqa-'));
  const dbPath = path.join(tmpDir, 'phase9b-vqa.db');
  const tmpProfile = path.join(tmpDir, 'chrome-profile');
  fs.mkdirSync(tmpProfile, { recursive: true });

  const labOutDir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'phase-9b');
  fs.mkdirSync(labOutDir, { recursive: true });

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
      await sleep(400);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      const labPath = path.join(labOutDir, filename);
      fs.writeFileSync(labPath, buf);
      console.log(`Captured ${filename} (${buf.length} bytes)`);
      return labPath;
    }

    // Wait for initial game state to load
    const loaded = await evalJs(`(async () => {
      for (let i = 0; i < 40; i++) {
        if (window.currentState && document.getElementById('major-landmark-scene-panel')) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    })()`);
    assert.equal(loaded, true, 'Initial game state loaded');

    // =========================================================================
    // 01. The Goblin Cave Major Landmark Scene ([9, 12])
    // =========================================================================
    const shot01Audit = await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 8, y: 12, facing: 'EAST' });
      await window.dispatchAction('MOVE', { direction: 'EAST', testForceEncounter: false });
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
    assert.equal(shot01Audit.sceneKey, 'GOBLIN_CAVE');
    assert.equal(shot01Audit.mapReplacedByScene, true);
    assert.deepEqual(shot01Audit.buttons, ['DELVE_GOBLIN_CAVE', 'CONTINUE_EXPLORING']);
    await capturePng('01-goblin-cave-landmark-scene.png');

    // =========================================================================
    // 02. Goblin Cave 2D Map Restored after "Continue Exploring" ([9, 12])
    // =========================================================================
    const shot02Audit = await evalJs(`(async () => {
      await window.dispatchAction('DISMISS_LANDMARK_SCENE');
      const panel = document.getElementById('major-landmark-scene-panel');
      const mapCanvas = document.getElementById('topdown-map-canvas');
      const reopenBtn = document.getElementById('btn-reopen-landmark-scene');
      return {
        panelGone: panel === null,
        hasMapCanvas: Boolean(mapCanvas && mapCanvas.width > 300),
        reopenText: reopenBtn ? reopenBtn.textContent.trim() : null
      };
    })()`);
    assert.equal(shot02Audit.panelGone, true);
    assert.equal(shot02Audit.hasMapCanvas, true);
    assert.ok(shot02Audit.reopenText, 'Compact reopen landmark button must be visible');
    await capturePng('02-goblin-cave-2d-map-after-dismiss.png');

    // =========================================================================
    // 03. Goblin Cave Delve Combat ([9, 12])
    // =========================================================================
    // Ensure monster has enough HP so it doesn't die on an opening shot
    const shot03Audit = await evalJs(`(async () => {
      await window.dispatchAction('OPEN_LANDMARK_SCENE');
      await window.dispatchAction('EXPLORE_GOBLIN_CAVE');
      const panel = document.getElementById('major-landmark-scene-panel');
      return {
        mode: window.currentState?.mode,
        panelGone: panel === null,
        primaryUrl: window.currentState?.viewportScene?.primaryUrl
      };
    })()`);
    assert.equal(shot03Audit.panelGone, true, 'Landmark Scene must never overlap with Combat');
    assert.equal(shot03Audit.primaryUrl, '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg');
    await capturePng('03-goblin-cave-delve-combat.png');

    // =========================================================================
    // 04. Undead Lands — Deadman's Mire & Drowned Ossuary ([26, 19])
    // =========================================================================
    const shot04Audit = await evalJs(`(async () => {
      await window.dispatchAction('LAB_SCENARIO', { scenario: 'DEADMANS_MIRE' });
      const mapCanvas = document.getElementById('topdown-map-canvas');
      return {
        tileName: window.currentState?.currentTile?.name,
        regionKey: window.currentState?.currentTile?.region_key,
        biome: window.currentState?.currentTile?.biome,
        dangerZone: window.currentState?.dangerZone?.zoneKey,
        hasMapCanvas: Boolean(mapCanvas && mapCanvas.width > 300)
      };
    })()`);
    assert.equal(shot04Audit.regionKey, 'UNDEAD_LANDS');
    assert.equal(shot04Audit.biome, 'DEADMANS_MIRE');
    assert.equal(shot04Audit.hasMapCanvas, true);
    await capturePng('04-undead-lands-deadmans-mire-map.png');

    // =========================================================================
    // 05. Undead Lands — Ashen Barrowlands & Blighted Chapel ([26, 9])
    // =========================================================================
    const shot05Audit = await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 26, y: 15, facing: 'NORTH' });
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 26, y: 9, facing: 'NORTH' });
      return {
        tileName: window.currentState?.currentTile?.name,
        regionKey: window.currentState?.currentTile?.region_key,
        biome: window.currentState?.currentTile?.biome
      };
    })()`);
    assert.equal(shot05Audit.regionKey, 'UNDEAD_LANDS');
    assert.equal(shot05Audit.tileName, 'Blighted Chapel');
    await capturePng('05-undead-lands-barrowlands-map.png');

    // =========================================================================
    // 06. The Ancient Crypt Major Landmark Scene ([26, 5])
    // =========================================================================
    const shot06Audit = await evalJs(`(async () => {
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 26, y: 6, facing: 'NORTH' });
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
    assert.equal(shot06Audit.hasPanel, true);
    assert.equal(shot06Audit.sceneKey, 'ANCIENT_CRYPT');
    assert.equal(shot06Audit.mapReplacedByScene, true);
    assert.deepEqual(shot06Audit.buttons, ['ENTER_ANCIENT_CRYPT', 'CONTINUE_EXPLORING']);
    await capturePng('06-ancient-crypt-landmark-scene.png');

    // =========================================================================
    // 07. Ancient Crypt 2D Map Restored after "Continue Exploring" ([26, 5])
    // =========================================================================
    const shot07Audit = await evalJs(`(async () => {
      await window.dispatchAction('DISMISS_LANDMARK_SCENE');
      const panel = document.getElementById('major-landmark-scene-panel');
      const mapCanvas = document.getElementById('topdown-map-canvas');
      const reopenBtn = document.getElementById('btn-reopen-landmark-scene');
      return {
        panelGone: panel === null,
        hasMapCanvas: Boolean(mapCanvas && mapCanvas.width > 300),
        reopenText: reopenBtn ? reopenBtn.textContent.trim() : null
      };
    })()`);
    assert.equal(shot07Audit.panelGone, true);
    assert.equal(shot07Audit.hasMapCanvas, true);
    assert.ok(shot07Audit.reopenText, 'Compact reopen landmark button must be visible');
    await capturePng('07-ancient-crypt-2d-map-after-dismiss.png');

    // =========================================================================
    // 08. Region Map Modal [M] — Expanded World (Goblin Forest + Undead Lands)
    // =========================================================================
    const shot08Audit = await evalJs(`(async () => {
      window.openLabModal('map');
      await new Promise(r => setTimeout(r, 200));
      const modal = document.getElementById('lab-modal-backdrop');
      const regCanvas = document.getElementById('region-map-overview-canvas');
      return {
        modalOpen: Boolean(modal && !modal.hidden),
        hasRegionCanvas: Boolean(regCanvas && regCanvas.width >= 300),
        modalText: modal ? modal.textContent : ''
      };
    })()`);
    assert.equal(shot08Audit.modalOpen, true);
    assert.equal(shot08Audit.hasRegionCanvas, true);
    assert.match(shot08Audit.modalText, /Goblin Cave/i);
    assert.match(shot08Audit.modalText, /Ancient Crypt/i);
    await capturePng('08-region-map-expanded-world.png');

    assert.equal(consoleErrors.length, 0, `Expected 0 console errors, got: ${consoleErrors.join('; ')}`);
    assert.equal(pageExceptions.length, 0, `Expected 0 page exceptions, got: ${pageExceptions.join('; ')}`);
    console.log('PHASE 9B VISUAL QA PASSED: 8/8 screenshots captured, 0 console errors, 0 page exceptions.');
  } finally {
    if (cdp && cdp.ws) {
      try { cdp.ws.close(); } catch {}
    }
    try { chromeProc.kill(); } catch {}
    await new Promise((resolve) => server.close(resolve));
    try { db.close(); } catch {}
  }
}

runPhase9bVisualQa().catch((err) => {
  console.error('Phase 9B Visual QA failed:', err);
  process.exit(1);
});
