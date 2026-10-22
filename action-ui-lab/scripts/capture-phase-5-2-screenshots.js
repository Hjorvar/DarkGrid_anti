#!/usr/bin/env node
'use strict';

/**
 * DARKGRID ADVENTURE LAB — Phase 5.2 Real Browser Visual QA & Screenshot Capture Script
 *
 * Launches a real headless Chromium browser against the permanently activated Phase 5.2 default
 * player experience (NO `?artPreview=candidates` query parameter), verifies all 5 required
 * resolutions (1920x1080, 1440x900, 1366x768, 1280x800, 390x844 mobile), tests monster placement
 * on activated default artwork (Goblin, Wolf, Assassin Vine, Troll, Giant Spider), verifies
 * zero console errors / zero uncaught exceptions / zero failed assets, and saves 23 descriptive
 * PNG screenshots under `action-ui-lab/docs/phase-5/screenshots/phase-5-2/`.
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createLabApp } = require('../server');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/phase-5/screenshots/phase-5-2');
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-p52-shots-'));
  const browserBin = findBrowserExecutable();

  // Launch against default player URL (NO ?artPreview=candidates)
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

  // =========================================================================
  // PART 1: Capture all 14 newly activated Phase 5 environment scenes (1920x1080)
  // =========================================================================
  const environmentShots = [
    { x: 5, y: 1, facing: 'SOUTH', expectedUrl: '/lab-assets/images/terrain/forest_tangled_canopy_pov.jpg', file: '01_generic_forest_tangled_canopy_1920x1080.png' },
    { x: 5, y: 1, facing: 'WEST',  expectedUrl: '/lab-assets/images/terrain/forest_misty_birch_hollow_pov.jpg', file: '02_generic_forest_misty_birch_hollow_1920x1080.png' },
    { x: 12, y: 1, facing: 'EAST', expectedUrl: '/lab-assets/images/terrain/plains_rutted_wagon_track_pov.jpg', file: '03_generic_plains_rutted_wagon_track_1920x1080.png' },
    { x: 12, y: 1, facing: 'SOUTH', expectedUrl: '/lab-assets/images/terrain/plains_lone_barrow_horizon_pov.jpg', file: '04_restricted_barrow_12_1_south_1920x1080.png' },
    { x: 12, y: 3, facing: 'SOUTH', expectedUrl: '/lab-assets/images/terrain/plains_open_moorland_swell_pov.jpg', file: '05_replacement_moorland_12_3_south_1920x1080.png' },
    { x: 1, y: 9, facing: 'SOUTH', expectedUrl: '/lab-assets/images/terrain/swamp_sunken_roots_channel_pov.jpg', file: '06_swamp_sunken_roots_channel_1920x1080.png' },
    { x: 2, y: 1, facing: 'WEST', expectedUrl: '/lab-assets/images/terrain/hills_windswept_scree_pass_pov.jpg', file: '07_hills_windswept_scree_pass_1920x1080.png' },
    { x: 11, y: 9, facing: 'EAST', expectedUrl: '/lab-assets/images/terrain/jungle_briar_thicket_pov.jpg', file: '08_jungle_briar_thicket_1920x1080.png' },
    { x: 1, y: 8, facing: 'SOUTH', expectedUrl: '/lab-assets/images/perspective/transition_hills_to_swamp_pov.jpg', file: '09_transition_hills_to_swamp_1_8_south_1920x1080.png' },
    { x: 5, y: 9, facing: 'NORTH', expectedUrl: '/lab-assets/images/perspective/transition_swamp_to_plains_pov.jpg', file: '10_transition_swamp_to_plains_5_9_north_1920x1080.png' },
    { x: 3, y: 1, facing: 'EAST',  expectedUrl: '/lab-assets/images/perspective/transition_hills_to_forest_pov.jpg', file: '11_transition_hills_to_forest_3_1_east_1920x1080.png' },
    { x: 5, y: 6, facing: 'WEST',  expectedUrl: '/lab-assets/images/perspective/transition_plains_to_hills_pov.jpg', file: '12_transition_plains_to_hills_5_6_west_1920x1080.png' },
    { x: 4, y: 6, facing: 'EAST',  expectedUrl: '/lab-assets/images/perspective/transition_hills_to_plains_pov.jpg', file: '13_transition_hills_to_plains_4_6_east_1920x1080.png' },
    { x: 9, y: 7, facing: 'SOUTH', expectedUrl: '/lab-assets/images/perspective/watchpost_9_7_south_river_gorge.jpg', file: '14_watchpost_9_7_south_river_gorge_1920x1080.png' }
  ];

  for (const shot of environmentShots) {
    const info = await evalInPage(`(async () => {
      await triggerTeleport(${shot.x}, ${shot.y}, '${shot.facing}');
      if (typeof window.__waitForSceneReady === 'function') await window.__waitForSceneReady();
      const img = document.getElementById('fp-terrain-img');
      const badge = document.getElementById('fp-art-preview-badge');
      return {
        src: img ? img.getAttribute('src') : null,
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
        badgeHidden: badge ? badge.hidden : true,
        status: currentState.viewportScene.activeScene.artApprovalStatus
      };
    })()`);
    if (info.src !== shot.expectedUrl) {
      throw new Error(`Expected ${shot.expectedUrl} at [${shot.x},${shot.y}] ${shot.facing}, got ${info.src}`);
    }
    if (info.naturalWidth !== 1376 || info.naturalHeight !== 768) {
      throw new Error(`Expected decoded 1376x768 for ${shot.expectedUrl}, got ${info.naturalWidth}x${info.naturalHeight}`);
    }
    if (!info.badgeHidden || info.status !== 'APPROVED') {
      throw new Error(`Expected hidden preview badge and APPROVED status for ${shot.file}`);
    }
    await captureShot(shot.file);
  }

  // =========================================================================
  // PART 2: Monster Integration on Newly Activated Default Artwork (Section 5 & 6)
  // Tests Goblin (Small), Assassin Vine (Coiled Plant), Giant Spider (Unusual Proportions),
  // Wolf (Medium Quadruped), and Troll (Large)
  // =========================================================================
  const monsterShots = [
    { x: 5, y: 1, facing: 'SOUTH', monster: 'Goblin', file: '15_monster_forest_goblin_small_1920x1080.png' },
    { x: 5, y: 1, facing: 'WEST',  monster: 'Assassin Vine', file: '16_monster_forest_assassin_vine_1920x1080.png' },
    { x: 5, y: 1, facing: 'SOUTH', monster: 'Giant Spider', file: '17_monster_forest_giant_spider_1920x1080.png' },
    { x: 12, y: 1, facing: 'EAST', monster: 'Wolf', file: '18_monster_plains_wolf_quadruped_1920x1080.png' },
    { x: 2, y: 1, facing: 'WEST',  monster: 'Troll', file: '19_monster_large_troll_hills_1920x1080.png' }
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

  // Clear combat back to Oakhaven then teleport to Bridge East Watchpost [9,7] SOUTH for multi-resolution QA
  await evalInPage(`(async () => {
    await triggerLabScenario('CITY');
    await triggerTeleport(9, 7, 'SOUTH');
  })()`);

  // =========================================================================
  // PART 3: Multi-Resolution Visual QA & Screenshots (1920x1080, 1440x900, 1366x768, 1280x800, 390x844)
  // =========================================================================
  const resolutions = [
    { w: 1920, h: 1080, mobile: false, shot: null },
    { w: 1440, h: 900,  mobile: false, shot: '20_widescreen_laptop_1440x900.png' },
    { w: 1366, h: 768,  mobile: false, shot: '21_compact_laptop_1366x768.png' },
    { w: 1280, h: 800,  mobile: false, shot: '22_compact_laptop_1280x800.png' },
    { w: 390,  h: 844,  mobile: true,  shot: '23_mobile_view_390x844.png' }
  ];

  const resolutionMetrics = [];
  for (const res of resolutions) {
    await cdpSend('Emulation.setDeviceMetricsOverride', {
      width: res.w,
      height: res.h,
      deviceScaleFactor: 1,
      mobile: res.mobile
    });
    const m = await evalInPage(`(async () => {
      if (currentState) renderGameState(currentState, { skipSequence: true });
      await new Promise(r => setTimeout(r, 150));
      const docEl = document.documentElement;
      const vp = document.getElementById('fp-viewport').getBoundingClientRect();
      const deck = document.getElementById('dm-action-deck-card').getBoundingClientRect();
      const nav = document.getElementById('dm-movement-deck').getBoundingClientRect();
      const img = document.getElementById('fp-terrain-img');
      return {
        resolution: '${res.w}x${res.h}',
        mobile: ${res.mobile},
        horizontalOverflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
        viewportWidthPx: Math.round(vp.width),
        viewportHeightPx: Math.round(vp.height),
        actionDeckWidthPx: Math.round(deck.width),
        navPadWidthPx: Math.round(nav.width),
        imageLoaded: Boolean(img && img.complete && img.naturalWidth > 0)
      };
    })()`);
    if (m.horizontalOverflowPx > 0) {
      throw new Error(`Unwanted horizontal overflow at ${res.w}x${res.h}: ${m.horizontalOverflowPx}px`);
    }
    if (!m.imageLoaded) {
      throw new Error(`Broken image placeholder at ${res.w}x${res.h}`);
    }
    resolutionMetrics.push(m);
    if (res.shot) {
      await captureShot(res.shot);
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    screenshotsCount: 23,
    consoleErrorsCount: consoleErrors.length,
    uncaughtExceptionsCount: uncaughtExceptions.length,
    failedAssetsCount: failedAssets.length,
    monsterMetrics,
    resolutionMetrics
  };
  console.log('QA Summary:', JSON.stringify(summary, null, 2));

  if (consoleErrors.length > 0 || uncaughtExceptions.length > 0 || failedAssets.length > 0) {
    throw new Error(`Browser QA detected errors: ${JSON.stringify({ consoleErrors, uncaughtExceptions, failedAssets })}`);
  }

  cdpWs.close();
  browserProc.kill();
  await new Promise((r) => server.close(r));
  console.log('All 23 Phase 5.2 screenshots and multi-resolution checks completed with 0 errors!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
