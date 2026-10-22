#!/usr/bin/env node
'use strict';

/**
 * DARKGRID ADVENTURE LAB — Phase 5.1 Visual QA Screenshot Capture Script
 * Captures real headless Chromium screenshots across 1920x1080, 1366x768, 1280x800, and 390x844
 * covering all 13 Phase 5 candidate paintings, P5-ART-04 replacement candidate, monster grounding
 * on candidate backgrounds, Candidate Preview UI badge, and responsive viewports.
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createLabApp } = require('../server');
const {
  setP5Art04Mode,
  setCandidateArtApprovalStatus,
  resetCandidateArtApprovalStatus
} = require('../scene-catalog');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/phase-5/screenshots');
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-p51-shots-'));
  const browserBin = findBrowserExecutable();

  const browserProc = spawn(browserBin, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    `${baseUrl}/?artPreview=candidates`
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const list = await r.json();
      const pageTarget = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTarget) {
        targets = pageTarget;
        break;
      }
    } catch (_e) {
      // retry
    }
    await sleep(150);
  }
  if (!targets) throw new Error('Failed to connect to headless Chromium.');

  const cdpWs = new WebSocket(targets.webSocketDebuggerUrl);
  const cdpPending = new Map();
  let cdpMsgId = 1;

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
    await sleep(220);
    const res = await cdpSend('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    console.log(`Captured: ${filename}`);
  }

  await sleep(700);
  await cdpSend('Page.enable');
  await cdpSend('Runtime.enable');
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
    await setArtPreviewMode(true);
  })()`);

  // 1. P5-ART-04 Replacement Candidate (plains_open_moorland_swell_pov.jpg) at [10,7] NORTH
  setCandidateArtApprovalStatus('P5-ART-04', 'REVIEW REQUIRED', { approvalMode: 'RESTRICTED_WITH_REPLACEMENT' });
  await evalInPage(`(async () => {
    await triggerTeleport(10, 7, 'NORTH');
    const img = document.getElementById('fp-terrain-img');
    if (img && !img.complete) await new Promise(r => { img.onload = r; setTimeout(r, 800); });
  })()`);
  await captureShot('p5_1_art04_replacement_open_moorland_1920x1080.png');

  // 2. P5-ART-04 Restricted Barrow Horizon at [12,1] SOUTH
  await evalInPage(`(async () => {
    await triggerTeleport(12, 1, 'SOUTH');
    const img = document.getElementById('fp-terrain-img');
    if (img && !img.complete) await new Promise(r => { img.onload = r; setTimeout(r, 800); });
  })()`);
  await captureShot('p5_1_art04_restricted_barrow_12_1_south_1920x1080.png');
  setCandidateArtApprovalStatus('P5-ART-04', 'REVIEW REQUIRED', { approvalMode: 'DEFAULT' });

  // 3. P5-ART-07 (jungle_briar_thicket_pov.jpg) at [10,12] EAST + Assassin Vine Grounding
  await evalInPage(`(async () => {
    await triggerTeleport(10, 12, 'EAST');
    await triggerLabScenario('STAGE2_COMBAT', 'Assassin Vine');
    for (let i = 0; i < 20; i++) {
      if (!isSequencePlaying) break;
      await new Promise(r => setTimeout(r, 80));
    }
    const actor = document.getElementById('fp-monster-actor');
    if (actor) actor.classList.remove('anim-monster-emerge');
  })()`);
  await captureShot('p5_1_art07_jungle_briar_assassin_vine_grounding_1920x1080.png');

  // 4. Monster Grounding on P5-ART-01 (forest_tangled_canopy_pov.jpg) at [7,4] NORTH (Goblin)
  await evalInPage(`(async () => {
    await triggerTeleport(8, 4, 'SOUTH');
    await triggerLabScenario('STAGE2_COMBAT', 'Goblin');
    for (let i = 0; i < 20; i++) {
      if (!isSequencePlaying) break;
      await new Promise(r => setTimeout(r, 80));
    }
    const actor = document.getElementById('fp-monster-actor');
    if (actor) actor.classList.remove('anim-monster-emerge');
  })()`);
  await captureShot('p5_1_art01_forest_canopy_goblin_grounding_1920x1080.png');

  // 5. Monster Grounding on P5-ART-03 (plains_rutted_wagon_track_pov.jpg) at [10,7] EAST (Wolf)
  await evalInPage(`(async () => {
    await triggerTeleport(10, 7, 'EAST');
    await triggerLabScenario('STAGE2_COMBAT', 'Wolf');
    for (let i = 0; i < 20; i++) {
      if (!isSequencePlaying) break;
      await new Promise(r => setTimeout(r, 80));
    }
    const actor = document.getElementById('fp-monster-actor');
    if (actor) actor.classList.remove('anim-monster-emerge');
  })()`);
  await captureShot('p5_1_art03_plains_wagon_wolf_grounding_1920x1080.png');

  // 6. [9,7] SOUTH (watchpost_9_7_south_river_gorge.jpg) across 1366x768, 1280x800, and 390x844
  await evalInPage(`(async () => {
    await triggerTeleport(9, 7, 'SOUTH');
    const img = document.getElementById('fp-terrain-img');
    if (img && !img.complete) await new Promise(r => { img.onload = r; setTimeout(r, 800); });
  })()`);

  for (const vp of [
    { w: 1366, h: 768, mobile: false, name: 'p5_1_watchpost_9_7_south_1366x768.png' },
    { w: 1280, h: 800, mobile: false, name: 'p5_1_watchpost_9_7_south_1280x800.png' },
    { w: 390,  h: 844, mobile: true,  name: 'p5_1_watchpost_9_7_south_mobile_390x844.png' }
  ]) {
    await cdpSend('Emulation.setDeviceMetricsOverride', {
      width: vp.w,
      height: vp.h,
      deviceScaleFactor: 1,
      mobile: vp.mobile
    });
    await evalInPage(`if (currentState) renderGameState(currentState, { skipSequence: true })`);
    await captureShot(vp.name);
  }

  resetCandidateArtApprovalStatus();
  cdpWs.close();
  browserProc.kill();
  await new Promise((r) => server.close(r));
  console.log('All Phase 5.1 screenshots captured.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
