#!/usr/bin/env node
'use strict';

/**
 * DARKGRID ADVENTURE LAB — Phase 5.2b Independent Pre-Merge Browser Verification & Screenshot Script
 *
 * Verifies in real headless Chromium:
 *  - Primeval Black Oak [7,3] — all 4 directions (NORTH, EAST, SOUTH, WEST)
 *  - Deadman's Mire [4,11] — all 4 directions (NORTH, EAST, SOUTH, WEST)
 *  - All P5-ART-11 (PLAINS -> HILLS) viewpoints ([5,6] W, [5,7] W, [5,8] W) + FOREST -> HILLS ([4,3] W, [4,5] S)
 *  - Representative generic FOREST, PLAINS, HILLS, and SWAMP viewpoints
 *  - Monster rendering on investigated landmark and transition environments
 *  - Desktop 1920x1080 and Compact Laptop 1366x768 viewports (zero horizontal overflow, zero panel overlap)
 *  - Zero console errors, zero uncaught exceptions, zero failed asset requests
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createLabApp } = require('../server');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/phase-5/screenshots/phase-5-2b');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No headless Chromium/Edge binary found.');
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const app = createLabApp({ dbPath: ':memory:' });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const debugPort = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-p52b-shots-'));
  const browserBin = findBrowserExecutable();

  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    `${baseUrl}/`
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const list = await r.json();
      const pageTarget = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTarget) {
        target = pageTarget;
        break;
      }
    } catch (_e) {
      // retry
    }
    await sleep(150);
  }
  if (!target) throw new Error('Failed to connect to headless Chromium.');

  const cdpWs = new WebSocket(target.webSocketDebuggerUrl);
  const cdpPending = new Map();
  let cdpMsgId = 1;

  const consoleErrors = [];
  const uncaughtExceptions = [];
  const failedAssets = [];

  await new Promise((resolve, reject) => {
    cdpWs.addEventListener('open', resolve, { once: true });
    cdpWs.addEventListener('error', reject, { once: true });
  });

  cdpWs.addEventListener('message', (event) => {
    const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
    if (msg.id && cdpPending.has(msg.id)) {
      const { resolve, reject } = cdpPending.get(msg.id);
      cdpPending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params && msg.params.type === 'error') {
      const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
      consoleErrors.push(text);
    }
    if (msg.method === 'Runtime.exceptionThrown' && msg.params) {
      uncaughtExceptions.push(msg.params.exceptionDetails ? msg.params.exceptionDetails.text : 'Exception');
    }
    if (msg.method === 'Network.responseReceived' && msg.params && msg.params.response) {
      const { url, status } = msg.params.response;
      if (status >= 400 && !url.endsWith('/favicon.ico')) {
        failedAssets.push({ url, status });
      }
    }
  });

  function cdpSend(method, params = {}) {
    const id = cdpMsgId++;
    return new Promise((resolve, reject) => {
      cdpPending.set(id, { resolve, reject });
      cdpWs.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evalInPage(expression) {
    const res = await cdpSend('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text);
    }
    return res.result ? res.result.value : undefined;
  }

  async function captureShot(filename) {
    await evalInPage(`(async () => {
      if (typeof window.__waitForSceneReady === 'function') await window.__waitForSceneReady();
    })()`);
    await sleep(180);
    const res = await cdpSend('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    console.log(`Captured: ${filename}`);
  }

  await sleep(600);
  await cdpSend('Page.enable');
  await cdpSend('Runtime.enable');
  await cdpSend('Network.enable');
  await cdpSend('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  await evalInPage(`(async () => {
    for (let i = 0; i < 40; i++) {
      if (typeof currentState !== 'undefined' && currentState && currentState.character) break;
      await new Promise(r => setTimeout(r, 100));
    }
  })()`);

  const sceneShots = [
    // 1. Primeval Black Oak [7,3] — all 4 directions
    { x: 7, y: 3, facing: 'NORTH', expectedUrl: '/lab-assets/images/terrain/forest_ancient_oak.jpg', expectedTier: 1, file: '01_oak_7_3_north_1920x1080.png' },
    { x: 7, y: 3, facing: 'EAST',  expectedUrl: '/lab-assets/images/terrain/forest_pine_ravine.jpg', expectedTier: 1, file: '02_oak_7_3_east_1920x1080.png' },
    { x: 7, y: 3, facing: 'SOUTH', expectedUrl: '/lab-assets/images/perspective/ancient_oak_7_3_south.jpg', expectedTier: 1, file: '03_oak_7_3_south_1920x1080.png' },
    { x: 7, y: 3, facing: 'WEST',  expectedUrl: '/images/terrain/terrain_forest.webp', expectedTier: 1, file: '04_oak_7_3_west_1920x1080.png' },

    // 2. Deadman's Mire [4,11] — all 4 directions
    { x: 4, y: 11, facing: 'NORTH', expectedUrl: '/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg', expectedTier: 1, file: '05_mire_4_11_north_1920x1080.png' },
    { x: 4, y: 11, facing: 'EAST',  expectedUrl: '/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg', expectedTier: 1, file: '06_mire_4_11_east_1920x1080.png' },
    { x: 4, y: 11, facing: 'SOUTH', expectedUrl: '/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg', expectedTier: 1, file: '07_mire_4_11_south_1920x1080.png' },
    { x: 4, y: 11, facing: 'WEST',  expectedUrl: '/images/terrain/terrain_swamp.webp', expectedTier: 1, file: '08_mire_4_11_west_1920x1080.png' },

    // 3. P5-ART-11 (PLAINS -> HILLS) & Pre-Existing FOREST -> HILLS Transitions
    { x: 5, y: 6, facing: 'WEST',  expectedUrl: '/lab-assets/images/perspective/transition_plains_to_hills_pov.jpg', expectedTier: 3, file: '09_p5_art_11_plains_to_hills_5_6_west_1920x1080.png' },
    { x: 5, y: 7, facing: 'WEST',  expectedUrl: '/lab-assets/images/perspective/transition_plains_to_hills_pov.jpg', expectedTier: 3, file: '10_p5_art_11_plains_to_hills_5_7_west_1920x1080.png' },
    { x: 5, y: 8, facing: 'WEST',  expectedUrl: '/lab-assets/images/perspective/transition_plains_to_hills_pov.jpg', expectedTier: 3, file: '11_p5_art_11_plains_to_hills_5_8_west_1920x1080.png' },
    { x: 4, y: 3, facing: 'WEST',  expectedUrl: '/lab-assets/images/perspective/transition_forest_to_hills_pov.jpg', expectedTier: 3, file: '12_forest_to_hills_4_3_west_1920x1080.png' },
    { x: 4, y: 5, facing: 'SOUTH', expectedUrl: '/lab-assets/images/perspective/transition_forest_to_hills_pov.jpg', expectedTier: 3, file: '13_forest_to_hills_4_5_south_1920x1080.png' },

    // 4. Representative Generic Biome Viewpoints (FOREST, PLAINS, HILLS, SWAMP)
    { x: 5, y: 1, facing: 'SOUTH', expectedUrl: '/lab-assets/images/terrain/forest_tangled_canopy_pov.jpg', expectedTier: 4, file: '14_generic_forest_5_1_south_1920x1080.png' },
    { x: 12, y: 3, facing: 'SOUTH', expectedUrl: '/lab-assets/images/terrain/plains_open_moorland_swell_pov.jpg', expectedTier: 4, file: '15_generic_plains_12_3_south_1920x1080.png' },
    { x: 2, y: 1, facing: 'WEST',  expectedUrl: '/lab-assets/images/terrain/hills_windswept_scree_pass_pov.jpg', expectedTier: 4, file: '16_generic_hills_2_1_west_1920x1080.png' },
    { x: 1, y: 9, facing: 'SOUTH', expectedUrl: '/lab-assets/images/terrain/swamp_sunken_roots_channel_pov.jpg', expectedTier: 4, file: '17_generic_swamp_1_9_south_1920x1080.png' }
  ];

  const verifiedScenes = [];
  for (const shot of sceneShots) {
    const info = await evalInPage(`(async () => {
      await triggerTeleport(${shot.x}, ${shot.y}, '${shot.facing}');
      if (typeof window.__waitForSceneReady === 'function') await window.__waitForSceneReady();
      const img = document.getElementById('fp-terrain-img');
      const badge = document.getElementById('fp-art-preview-badge');
      const active = currentState.viewportScene.activeScene;
      return {
        x: ${shot.x},
        y: ${shot.y},
        facing: '${shot.facing}',
        src: img ? img.getAttribute('src') : null,
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
        badgeHidden: badge ? badge.hidden : true,
        povTier: active.povTier,
        viewKey: active.viewKey || active.variantKey,
        status: active.artApprovalStatus
      };
    })()`);
    if (info.src !== shot.expectedUrl) {
      throw new Error(`Expected ${shot.expectedUrl} at [${shot.x},${shot.y}] ${shot.facing}, got ${info.src}`);
    }
    if (info.povTier !== shot.expectedTier) {
      throw new Error(`Expected Tier ${shot.expectedTier} at [${shot.x},${shot.y}] ${shot.facing}, got Tier ${info.povTier}`);
    }
    if (info.naturalWidth === 0 || info.naturalHeight === 0 || !info.badgeHidden) {
      throw new Error(`Invalid image decode or visible badge for ${shot.file}: ${JSON.stringify(info)}`);
    }
    verifiedScenes.push(info);
    await captureShot(shot.file);
  }

  // 5. Monster rendering on investigated Landmark & Transition scenes (1920x1080)
  const monsterShots = [
    { x: 7, y: 3, facing: 'NORTH', monster: 'Giant Spider', file: '18_monster_oak_7_3_north_giant_spider_1920x1080.png' },
    { x: 4, y: 11, facing: 'NORTH', monster: 'Ghoul', file: '19_monster_mire_4_11_north_ghoul_1920x1080.png' },
    { x: 5, y: 7, facing: 'WEST',  monster: 'Wolf', file: '20_monster_p5_art_11_5_7_west_wolf_1920x1080.png' }
  ];

  const monsterMetrics = [];
  for (const ms of monsterShots) {
    const mInfo = await evalInPage(`(async () => {
      await triggerTeleport(${ms.x}, ${ms.y}, '${ms.facing}');
      await triggerLabScenario('STAGE2_COMBAT', '${ms.monster}');
      for (let i = 0; i < 25; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 80));
      }
      const actor = document.getElementById('fp-monster-actor');
      if (actor) actor.classList.remove('anim-monster-emerge');
      const cutoutImg = actor ? actor.querySelector('img') : null;
      if (cutoutImg && !cutoutImg.complete) {
        await new Promise(r => { cutoutImg.onload = r; setTimeout(r, 800); });
      }
      const vpRect = document.getElementById('fp-viewport').getBoundingClientRect();
      const actorRect = actor ? actor.getBoundingClientRect() : null;
      const rig = actor ? actor.querySelector('.fp-integrated-grounding-rig') : null;
      return {
        monster: '${ms.monster}',
        sceneUrl: currentState.viewportScene.activeScene.imageUrl,
        hasGroundingRig: Boolean(rig),
        actorHeightPx: actorRect ? Math.round(actorRect.height) : 0,
        actorBottomRatio: (actorRect && vpRect.height) ? Number(((actorRect.bottom - vpRect.top) / vpRect.height).toFixed(3)) : 0,
        naturalWidth: cutoutImg ? cutoutImg.naturalWidth : 0
      };
    })()`);
    if (!mInfo.hasGroundingRig || mInfo.naturalWidth === 0) {
      throw new Error(`Monster ${ms.monster} failed grounding rig or image decode: ${JSON.stringify(mInfo)}`);
    }
    monsterMetrics.push(mInfo);
    await captureShot(ms.file);
  }

  // Return to exploration mode for 1366x768 compact laptop checks
  await evalInPage(`triggerLabScenario('CITY')`);

  // 6. Compact Laptop 1366x768 Verification
  await cdpSend('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false
  });

  const laptopShots = [
    { x: 7, y: 3, facing: 'NORTH', file: '21_oak_7_3_north_1366x768.png' },
    { x: 4, y: 11, facing: 'NORTH', file: '22_mire_4_11_north_1366x768.png' },
    { x: 5, y: 6, facing: 'WEST',  file: '23_p5_art_11_5_6_west_1366x768.png' }
  ];

  const laptopMetrics = [];
  for (const ls of laptopShots) {
    const m = await evalInPage(`(async () => {
      await triggerTeleport(${ls.x}, ${ls.y}, '${ls.facing}');
      if (typeof window.__waitForSceneReady === 'function') await window.__waitForSceneReady();
      const docEl = document.documentElement;
      const vp = document.getElementById('fp-viewport').getBoundingClientRect();
      const deck = document.getElementById('dm-action-deck-card').getBoundingClientRect();
      const nav = document.getElementById('dm-movement-deck').getBoundingClientRect();
      const overlap = !(vp.right <= deck.left + 2 || vp.left >= deck.right - 2);
      return {
        viewpoint: '${ls.x},${ls.y}:${ls.facing}',
        resolution: '1366x768',
        horizontalOverflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
        viewportBox: { w: Math.round(vp.width), h: Math.round(vp.height) },
        actionDeckWidthPx: Math.round(deck.width),
        navPadWidthPx: Math.round(nav.width),
        panelOverlap: overlap
      };
    })()`);
    if (m.horizontalOverflowPx > 0 || m.panelOverlap) {
      throw new Error(`Layout defect at 1366x768 (${ls.file}): ${JSON.stringify(m)}`);
    }
    laptopMetrics.push(m);
    await captureShot(ls.file);
  }

  console.log('Phase 5.2b Summary:', JSON.stringify({
    screenshotsCaptured: 23,
    consoleErrorsCount: consoleErrors.length,
    uncaughtExceptionsCount: uncaughtExceptions.length,
    failedAssetsCount: failedAssets.length,
    monsterMetrics,
    laptopMetrics
  }, null, 2));

  if (consoleErrors.length > 0 || uncaughtExceptions.length > 0 || failedAssets.length > 0) {
    throw new Error(`Browser errors detected: ${JSON.stringify({ consoleErrors, uncaughtExceptions, failedAssets })}`);
  }

  cdpWs.close();
  browserProc.kill();
  await new Promise((r) => server.close(r));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
