/**
 * ============================================================================
 * DARKGRID ACTION VIEWPORT LAB — TRACK 6: INDEPENDENT E2E & BROWSER QA SUITE
 * ============================================================================
 * Phase D Independent Quality Assurance verification suite covering all 15
 * required QA areas across backend SQLite/API truth and a live headless Chrome
 * browser session via Chrome DevTools Protocol (CDP).
 *
 * Run via:
 *   node --test action-ui-lab/tests/independent-qa.test.js
 * ============================================================================
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const { createLabApp } = require('../server');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

const SCREENSHOT_DIR = path.join(__dirname, '../docs/screenshots/overnight-qa');
const QA_RESULTS_JSON = path.join(__dirname, '../docs/overnight-qa-results.json');

function findChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDebuggerUrl(debugPort, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
      const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTarget) return pageTarget.webSocketDebuggerUrl;
    } catch {
      // Wait for Chrome to listen
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for Chrome DevTools target on port ${debugPort}`);
}

describe('Phase D — Independent End-to-End & Headless Browser QA Suite (15 Areas)', () => {
  let tmpDir;
  let dbPath;
  let server;
  let baseUrl;
  let chromeProc;
  let ws;
  let cdpMsgId = 0;
  const cdpPending = new Map();

  // Telemetry collectors for Area 15 (Console, Page Exceptions, Network)
  const consoleErrors = [];
  const pageExceptions = [];
  const failedNetworkRequests = [];
  const requestUrlById = new Map();
  let allowIntentionalBrokenAsset = false;

  // Structured QA summary saved to docs/overnight-qa-results.json
  const qaMetrics = {
    generatedAt: new Date().toISOString(),
    areasVerified: 15,
    screenshots: [],
    viewportAudits: {},
    monsterCutoutDomChecks: [],
    scaleArenaDomOrder: null,
    performanceMetrics: null,
    consoleErrorsCount: 0,
    pageExceptionsCount: 0,
    failedNetworkRequestsCount: 0
  };

  function cdpSend(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++cdpMsgId;
      const timer = setTimeout(() => {
        cdpPending.delete(id);
        reject(new Error(`CDP timeout on ${method}`));
      }, 15000);
      cdpPending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evalInPage(expression) {
    const res = await cdpSend('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res && res.exceptionDetails) {
      const desc = (res.result && res.result.description) || res.exceptionDetails.text || 'Eval exception';
      throw new Error(`Page evaluation error: ${desc}`);
    }
    return res && res.result ? res.result.value : undefined;
  }

  async function captureScreenshot(filename) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const shot = await cdpSend('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    qaMetrics.screenshots.push(filename);
    return outPath;
  }

  async function apiGet(endpoint) {
    const res = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(res.status, 200, `Expected HTTP 200 from GET ${endpoint}`);
    return res.json();
  }

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-independent-qa-'));
    dbPath = path.join(tmpDir, 'independent-qa.sqlite');

    const app = createLabApp({ dbPath });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    const chromeExe = findChromeExecutable();
    assert.ok(chromeExe, 'Headless Chrome executable must be available for Phase D QA');

    const debugPort = 9400 + Math.floor(Math.random() * 400);
    const profileDir = path.join(tmpDir, 'chrome-profile');
    chromeProc = spawn(chromeExe, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      'about:blank'
    ], { stdio: 'ignore' });

    const wsUrl = await waitForDebuggerUrl(debugPort);
    ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      if (msg.id && cdpPending.has(msg.id)) {
        const { resolve, reject, timer } = cdpPending.get(msg.id);
        clearTimeout(timer);
        cdpPending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
      }

      if (msg.method === 'Runtime.consoleAPICalled') {
        const { type, args } = msg.params || {};
        if (type === 'error') {
          const text = (args || []).map((a) => a.value || a.description || '').join(' ');
          if (!allowIntentionalBrokenAsset) {
            consoleErrors.push(text);
          }
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params && msg.params.exceptionDetails;
        pageExceptions.push(details ? (details.text || JSON.stringify(details)) : 'Unknown page exception');
      } else if (msg.method === 'Network.requestWillBeSent') {
        const { requestId, request } = msg.params || {};
        if (requestId && request) {
          requestUrlById.set(requestId, request.url);
        }
      } else if (msg.method === 'Network.responseReceived') {
        const { response } = msg.params || {};
        if (response && response.status >= 400) {
          const url = response.url || '';
          if (!(allowIntentionalBrokenAsset && url.includes('non_existent_qa_broken'))) {
            failedNetworkRequests.push({ url, status: response.status });
          }
        }
      } else if (msg.method === 'Network.loadingFailed') {
        const { requestId, errorText, canceled } = msg.params || {};
        const url = requestUrlById.get(requestId) || '';
        // Ignore external Google Fonts when running offline or canceled requests
        if (!canceled && !url.includes('fonts.googleapis.com') && !url.includes('fonts.gstatic.com')) {
          if (!(allowIntentionalBrokenAsset && url.includes('non_existent_qa_broken'))) {
            failedNetworkRequests.push({ url, status: 'LOADING_FAILED', errorText });
          }
        }
      }
    });

    await cdpSend('Page.enable');
    await cdpSend('Runtime.enable');
    await cdpSend('Network.enable');
    await cdpSend('Performance.enable');
    await cdpSend('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    await cdpSend('Page.navigate', { url: baseUrl });
    await sleep(600);
    await evalInPage(`(async () => {
      for (let i = 0; i < 40; i++) {
        if (typeof currentState !== 'undefined' && currentState && currentState.character) break;
        await new Promise(r => setTimeout(r, 100));
      }
    })()`);
  });

  after(async () => {
    qaMetrics.consoleErrorsCount = consoleErrors.length;
    qaMetrics.pageExceptionsCount = pageExceptions.length;
    qaMetrics.failedNetworkRequestsCount = failedNetworkRequests.length;
    try {
      fs.writeFileSync(QA_RESULTS_JSON, JSON.stringify(qaMetrics, null, 2), 'utf8');
    } catch {
      // Ignore write error on teardown
    }

    if (ws) {
      try { ws.close(); } catch {}
    }
    if (chromeProc) {
      try { chromeProc.kill('SIGKILL'); } catch {}
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });

  // =========================================================================
  // AREA 1: Multi-Tile World Travel & Visual Continuity
  // =========================================================================
  it('Area 1: Multi-tile world travel maintains spatial and visual continuity across biomes', async () => {
    const startRes = await evalInPage(`(async () => {
      await dispatchAction('RESET_EXPEDITION', { expeditionKey: 'MIRKWOOD_EXPEDITION', deterministicSeed: 4201 });
      return {
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        facing: currentState.facing,
        tileName: currentState.currentTile.name,
        sceneMode: currentState.sceneMode,
        aheadName: currentState.viewportScene?.ahead1?.name
      };
    })()`);

    assert.equal(startRes.x, 7);
    assert.equal(startRes.y, 7);
    assert.equal(startRes.facing, 'NORTH');
    assert.equal(startRes.sceneMode, 'C');
    assert.equal(startRes.aheadName, 'Oakhaven North Gate');

    // Step north from [7,7] -> [7,6] -> [7,5] -> [7,4] -> [7,3] (Primeval Black Oak) without random encounters
    const expectedPath = [
      { x: 7, y: 6, name: 'Oakhaven North Gate' },
      { x: 7, y: 5, name: 'Mirkwood Crossroads' },
      { x: 7, y: 4, name: 'Mirkwood Deep' },
      { x: 7, y: 3, name: 'The Primeval Black Oak' }
    ];

    for (const stepTarget of expectedPath) {
      const stepRes = await evalInPage(`(async () => {
        await dispatchAction('MOVE', { relative: 'FORWARD', testForceEncounter: false });
        const img = document.getElementById('fp-terrain-img');
        if (img && !img.complete) {
          await new Promise(r => {
            img.addEventListener('load', r, { once: true });
            setTimeout(r, 1000);
          });
        }
        const activeScene = currentState.viewportScene?.activeScene || currentState.viewportScene?.scenes?.C || {};
        return {
          x: currentState.currentTile.x,
          y: currentState.currentTile.y,
          facing: currentState.facing,
          tileName: currentState.currentTile.name,
          imageUrl: activeScene.imageUrl,
          povTierKey: activeScene.povTierKey || activeScene.povTier,
          corridorKey: activeScene.corridorKey,
          stepCounter: currentState.adventure ? currentState.adventure.stepCounter : 0,
          imgComplete: Boolean(img && img.complete && img.naturalWidth > 0)
        };
      })()`);

      assert.equal(stepRes.x, stepTarget.x);
      assert.equal(stepRes.y, stepTarget.y);
      assert.equal(stepRes.facing, 'NORTH');
      assert.ok(stepRes.imageUrl && stepRes.imageUrl.length > 5);
      assert.ok(stepRes.povTierKey, 'POV tier should be populated');
      assert.ok(stepRes.corridorKey, 'Corridor key should be populated');
      assert.ok(stepRes.stepCounter >= 1, 'Adventure step counter should advance');
      assert.equal(stepRes.imgComplete, true, `Scene image at [${stepTarget.x},${stepTarget.y}] must decode cleanly`);
    }

    await captureScreenshot('01_area01_world_travel_continuity.png');
  });

  // =========================================================================
  // AREA 2: Turning & Relative Movement
  // =========================================================================
  it('Area 2: Turning updates facing and vista without moving tile or rolling encounters; relative movement & obstacles work accurately', async () => {
    // Position at Mirkwood Crossroads [7,5] Facing NORTH
    await evalInPage(`triggerTeleport(7, 5, 'NORTH')`);

    // Rotate 360 degrees via RIGHT turns and verify coordinates stay [7,5] and no encounter spawns
    const expectedFacings = [
      { facing: 'EAST',  label: 'East',  short: 'E' },
      { facing: 'SOUTH', label: 'South', short: 'S' },
      { facing: 'WEST',  label: 'West',  short: 'W' },
      { facing: 'NORTH', label: 'North', short: 'N' }
    ];
    for (const exp of expectedFacings) {
      const turnRes = await evalInPage(`(async () => {
        await dispatchTurn('RIGHT');
        return {
          x: currentState.currentTile.x,
          y: currentState.currentTile.y,
          facing: currentState.facing,
          encounter: currentState.encounter,
          compassLbl: document.getElementById('compass-facing-lbl')?.textContent?.trim() || '',
          facingPill: document.getElementById('fp-facing-pill')?.textContent?.trim() || ''
        };
      })()`);
      assert.equal(turnRes.x, 7);
      assert.equal(turnRes.y, 5);
      assert.equal(turnRes.facing, exp.facing);
      assert.equal(turnRes.encounter, null, 'Turning in place must never roll an encounter');
      assert.ok(turnRes.compassLbl.includes(exp.label), `Compass label (${turnRes.compassLbl}) must include ${exp.label}`);
      assert.ok(turnRes.facingPill.includes(exp.short), `Facing pill (${turnRes.facingPill}) must include ${exp.short}`);
    }

    // At [7,5] Facing NORTH, west tile [6,5] is Stonefang Crag (impassable MOUNTAIN).
    // Test STRAFE_LEFT into [6,5] -> should trigger blocked bump animation and errorMessage while keeping hero at [7,5].
    const blockedRes = await evalInPage(`(async () => {
      await dispatchAction('MOVE', { relative: 'LEFT', testForceEncounter: false });
      const backdrop = document.getElementById('fp-scene-backdrop');
      return {
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        hasBlockedBumpClass: backdrop ? backdrop.classList.contains('anim-blocked-bump') : false,
        errorMessage: currentState.errorMessage
      };
    })()`);
    assert.equal(blockedRes.x, 7);
    assert.equal(blockedRes.y, 5);
    assert.equal(blockedRes.hasBlockedBumpClass, true, 'Blocked move must trigger .anim-blocked-bump on #fp-scene-backdrop');
    assert.match(blockedRes.errorMessage, /impassable|blocked/i);

    // Test STRAFE_RIGHT from [7,5] Facing NORTH -> moves EAST to [8,5], then STRAFE_LEFT back to [7,5], then BACKWARD to [7,6]
    const relMoveRes = await evalInPage(`(async () => {
      await dispatchAction('MOVE', { relative: 'RIGHT', testForceEncounter: false });
      const afterRight = { x: currentState.currentTile.x, y: currentState.currentTile.y, facing: currentState.facing };
      await dispatchAction('MOVE', { relative: 'LEFT', testForceEncounter: false });
      const afterLeft = { x: currentState.currentTile.x, y: currentState.currentTile.y, facing: currentState.facing };
      await dispatchAction('MOVE', { relative: 'BACKWARD', testForceEncounter: false });
      const afterBack = { x: currentState.currentTile.x, y: currentState.currentTile.y, facing: currentState.facing };
      return { afterRight, afterLeft, afterBack };
    })()`);

    assert.deepEqual(relMoveRes.afterRight, { x: 8, y: 5, facing: 'NORTH' });
    assert.deepEqual(relMoveRes.afterLeft, { x: 7, y: 5, facing: 'NORTH' });
    assert.deepEqual(relMoveRes.afterBack, { x: 7, y: 6, facing: 'NORTH' });

    await captureScreenshot('02_area02_turning_and_relative_movement.png');
  });

  // =========================================================================
  // AREA 3: Stage 1 & Stage 2 Encounter Triggers & Secrecy
  // =========================================================================
  it('Area 3: Stage 1 encounters strictly conceal monster identity, artwork, and stats in both API and DOM; ambush locks movement', async () => {
    const stage1Check = await evalInPage(`(async () => {
      await triggerTeleport(7, 5, 'NORTH');
      await triggerLabScenario('STAGE1_MYSTERY', 'Manticore');
      await new Promise(r => setTimeout(r, 150));
      const stageHtml = document.getElementById('fp-center-stage')?.innerHTML || '';
      const deckHtml = document.getElementById('dm-action-deck-card')?.innerHTML || '';
      return {
        mode: currentState.mode,
        encounter: currentState.encounter,
        stageHtml,
        deckHtml
      };
    })()`);

    assert.equal(stage1Check.mode, 'DISCOVERED');
    assert.equal(stage1Check.encounter.status, 'DISCOVERED');
    // Strict secrecy checks on API payload
    assert.equal(stage1Check.encounter.monsterName, undefined);
    assert.equal(stage1Check.encounter.monsterId, undefined);
    assert.equal(stage1Check.encounter.imageUrl, undefined);
    assert.equal(stage1Check.encounter.cutoutImageUrl, undefined);
    assert.equal(stage1Check.encounter.adaptiveScale, undefined);
    assert.ok(stage1Check.encounter.resolvedDescription && stage1Check.encounter.resolvedDescription.length > 10);
    // Strict secrecy checks on rendered DOM
    assert.ok(!/manticore/i.test(stage1Check.stageHtml), 'Stage 1 DOM must not leak monster name');
    assert.ok(!/manticore/i.test(stage1Check.deckHtml), 'Stage 1 Action Deck must not leak monster name');

    await captureScreenshot('03_area03_stage1_secrecy_card.png');

    // Verify Stage 1 Ambush blocks IGNORE and MOVE
    const ambushCheck = await evalInPage(`(async () => {
      await triggerLabScenario('STAGE1_AMBUSH', 'Ghoul');
      await dispatchAction('IGNORE');
      const afterIgnoreError = currentState.errorMessage;
      const stillDiscovered = currentState.encounter && currentState.encounter.status === 'DISCOVERED';
      return { afterIgnoreError, stillDiscovered, isAmbush: currentState.encounter.isAmbush };
    })()`);

    assert.equal(ambushCheck.isAmbush, true);
    assert.equal(ambushCheck.stillDiscovered, true);
    assert.match(ambushCheck.afterIgnoreError, /Ambush/i);
  });

  // =========================================================================
  // AREA 4: Monster Introduction & Distance Transitions
  // =========================================================================
  it('Area 4: Engaging from Stage 1 reveals monster with calibrated 20ft -> 12ft distance transition CSS variables', async () => {
    const revealCheck = await evalInPage(`(async () => {
      await triggerTeleport(8, 7, 'EAST');
      await triggerLabScenario('STAGE1_MYSTERY', 'Troll');
      await dispatchAction('INVESTIGATE');
      const actor = document.getElementById('fp-monster-actor');
      return {
        status: currentState.encounter && currentState.encounter.status,
        monsterName: currentState.encounter && currentState.encounter.monsterName,
        distanceTransition: currentState.encounter && currentState.encounter.distanceTransition,
        actorStyle: actor ? actor.getAttribute('style') : '',
        hasActorDom: Boolean(actor)
      };
    })()`);

    assert.equal(revealCheck.status, 'IN_COMBAT');
    assert.equal(revealCheck.monsterName, 'Troll');
    assert.ok(revealCheck.distanceTransition, 'distanceTransition metadata must be present');
    assert.equal(revealCheck.distanceTransition.fromDistanceFt, 20);
    assert.equal(revealCheck.distanceTransition.toDistanceFt, 12);
    assert.ok(revealCheck.distanceTransition.scaleRatio > 0.4 && revealCheck.distanceTransition.scaleRatio < 0.95);
    assert.ok(revealCheck.actorStyle.includes('--approach-start-scale:'), 'Actor style must bind --approach-start-scale');
    assert.ok(revealCheck.actorStyle.includes('--approach-start-y:'), 'Actor style must bind --approach-start-y');

    await sleep(380);
    await captureScreenshot('04_area04_stage2_monster_reveal.png');
  });

  // =========================================================================
  // AREA 5: Combat Actions, Beats, Popups & Chronicle History
  // =========================================================================
  it('Area 5: Combat actions produce structured beats, floating popups, and expandable Chronicle history without raw math leaks', async () => {
    const combatRes = await evalInPage(`(async () => {
      await triggerTeleport(7, 5, 'NORTH');
      await triggerLabScenario('STAGE2_COMBAT', 'Wolf');
      // Wait for initial reveal sequence
      for (let i = 0; i < 20; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 80));
      }
      await dispatchAction('ATTACK');
      const seq = currentState.combatSequence;
      for (let i = 0; i < 30; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 100));
      }
      // Expand chronicle history drawer
      toggleChronicleHistory(true);
      const chronEl = document.getElementById('fp-bottom-chronicle');
      const chronLbl = document.getElementById('chronicle-toggle-lbl');
      const chronText = document.getElementById('fp-chronicle-lines')?.innerText || '';
      return {
        hasSequence: Boolean(seq && Array.isArray(seq.beats) && seq.beats.length > 0),
        beats: seq ? seq.beats : [],
        isExpanded: chronEl ? chronEl.classList.contains('is-chronicle-expanded') : false,
        toggleLabel: chronLbl ? chronLbl.textContent.trim() : '',
        chronText
      };
    })()`);

    assert.equal(combatRes.hasSequence, true, 'ATTACK must return a structured combatSequence with beats');
    assert.equal(combatRes.isExpanded, true, 'Chronicle drawer must expand when toggled');
    assert.equal(combatRes.toggleLabel, '▾ Compact');
    for (const beat of combatRes.beats) {
      assert.ok(beat.publicText && beat.publicText.length > 0);
      assert.ok(!/1d20/i.test(beat.publicText), 'Public combat text must never leak raw d20 formula');
    }

    await captureScreenshot('05_area05_combat_beats_and_chronicle.png');
    await evalInPage(`toggleChronicleHistory(false)`);
  });

  // =========================================================================
  // AREA 6: Hero & Monster Status / Condition Brackets
  // =========================================================================
  it('Area 6: Hero vitality pill and monster condition brackets update accurately across all damage thresholds', async () => {
    // 1. Test Hero Wounded state via Director scenario
    const woundedHero = await evalInPage(`(async () => {
      await triggerLabScenario('WOUNDED');
      return {
        hp: currentState.character.current_hp,
        maxHp: currentState.character.max_hp,
        hpPillText: document.getElementById('hud-hp-state-pill')?.textContent?.trim(),
        hpPillClass: document.getElementById('hud-hp-state-pill')?.className
      };
    })()`);

    assert.ok(woundedHero.hp <= Math.floor(woundedHero.maxHp * 0.25) + 1);
    assert.match(woundedHero.hpPillText, /CRITICAL|WOUNDED/i);

    // 2. Stage Troll in combat, damage its HP in SQLite to each bracket (100%, 70%, 45%, 20%, 0%), and verify #seq-condition-badge
    await evalInPage(`(async () => {
      await triggerLabScenario('STAGE2_COMBAT', 'Troll');
      for (let i = 0; i < 20; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 80));
      }
    })()`);

    const dbConn = new DatabaseSync(dbPath);
    const activeEnc = dbConn.prepare("SELECT id, monster_max_hp FROM encounters WHERE status = 'IN_COMBAT' ORDER BY id DESC LIMIT 1").get();
    assert.ok(activeEnc, 'Active Troll encounter should exist in SQLite');

    const bracketExpectations = [
      { hp: activeEnc.monster_max_hp,                         expectedKey: '5_uninjured',      expectedBadge: '● Uninjured' },
      { hp: Math.floor(activeEnc.monster_max_hp * 0.70),      expectedKey: '6_barely_wounded', expectedBadge: '● Barely Wounded' },
      { hp: Math.floor(activeEnc.monster_max_hp * 0.45),      expectedKey: '7_wounded',        expectedBadge: '● Wounded' },
      { hp: Math.max(1, Math.floor(activeEnc.monster_max_hp * 0.20)), expectedKey: '8_badly_wounded',  expectedBadge: '● Badly Wounded' },
      { hp: 0,                                                expectedKey: '9_near_death',     expectedBadge: '● Near Death' }
    ];

    for (const bTest of bracketExpectations) {
      dbConn.prepare('UPDATE encounters SET current_monster_hp = ? WHERE id = ?').run(bTest.hp, activeEnc.id);

      const domBracket = await evalInPage(`(async () => {
        const res = await fetch('/api/state');
        const data = await res.json();
        renderGameState(data.state, { skipSequence: true });
        return {
          bracketKey: currentState.encounter.conditionBracket,
          badgeText: document.getElementById('seq-condition-badge')?.textContent?.trim(),
          quoteText: document.querySelector('.fp-monster-condition-quote')?.textContent?.trim()
        };
      })()`);

      assert.equal(domBracket.bracketKey, bTest.expectedKey);
      assert.equal(domBracket.badgeText, bTest.expectedBadge, `Expected badge ${bTest.expectedBadge} for ${bTest.expectedKey}`);
      assert.ok(domBracket.quoteText && domBracket.quoteText.length > 5);
    }
    dbConn.close();

    await captureScreenshot('06_area06_wounded_hero_and_monster_brackets.png');
  });

  // =========================================================================
  // AREA 7: Fleeing, Slipping Past & Return-to-Exploration
  // =========================================================================
  it('Area 7: Fleeing Stage 2 combat and Slipping Past Stage 1 threats restore exploration cleanly and record LINGERING_THREAT_SITE', async () => {
    // 1. Stage 2 FLEE (ensure hero is at full HP against a Wolf so parting strike cannot kill hero)
    const fleeRes = await evalInPage(`(async () => {
      await triggerTeleport(8, 7, 'EAST');
      await triggerLabScenario('STAGE2_COMBAT', 'Wolf');
      await triggerLabScenario('HEAL');
      await triggerLabScenario('STAGE2_COMBAT', 'Wolf');
      for (let i = 0; i < 20; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 80));
      }
      await dispatchAction('FLEE');
      for (let i = 0; i < 25; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 80));
      }
      if (currentState.mode === 'FALLEN') {
        await dispatchAction('REVIVE', { classType: 'FIGHTER' });
      }
      return {
        mode: currentState.mode,
        encounter: currentState.encounter,
        revisitStatus: currentState.adventure?.revisitStatus,
        returnOutcome: currentState.adventure?.combatReturnContext?.outcome,
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        facing: currentState.facing
      };
    })()`);

    assert.equal(fleeRes.mode, 'EXPLORATION');
    assert.equal(fleeRes.encounter, null);
    assert.equal(fleeRes.revisitStatus, 'LINGERING_THREAT_SITE');
    assert.equal(fleeRes.returnOutcome, 'FLED');
    assert.equal(fleeRes.x, 8);
    assert.equal(fleeRes.y, 7);
    assert.equal(fleeRes.facing, 'EAST');

    // 2. Stage 1 IGNORE (Slip Past)
    const ignoreRes = await evalInPage(`(async () => {
      await triggerTeleport(7, 5, 'NORTH');
      await triggerLabScenario('STAGE1_MYSTERY', 'Assassin Vine');
      await dispatchAction('IGNORE');
      const lastEnc = (currentState.adventure?.encountersFaced || []).slice(-1)[0] || null;
      return {
        mode: currentState.mode,
        encounter: currentState.encounter,
        revisitStatus: currentState.adventure?.revisitStatus,
        returnOutcome: currentState.adventure?.combatReturnContext?.outcome,
        lastEncOutcome: lastEnc ? lastEnc.outcome : null
      };
    })()`);

    assert.equal(ignoreRes.mode, 'EXPLORATION');
    assert.equal(ignoreRes.encounter, null);
    assert.equal(ignoreRes.revisitStatus, 'LINGERING_THREAT_SITE');
    assert.ok(['FLED', 'BYPASSED'].includes(ignoreRes.returnOutcome));
    assert.equal(ignoreRes.lastEncOutcome, 'BYPASSED');

    await captureScreenshot('07_area07_flee_and_exploration_recovery.png');
  });

  // =========================================================================
  // AREA 8: Save & Browser Refresh (Page.reload) SQLite Persistence
  // =========================================================================
  it('Area 8: Full browser Page.reload preserves SQLite character coordinates, facing, HP, and active Stage 2 encounter', async () => {
    const beforeReload = await evalInPage(`(async () => {
      await triggerTeleport(9, 7, 'WEST');
      await triggerLabScenario('STAGE2_COMBAT', 'Skeletal Champion');
      for (let i = 0; i < 20; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 80));
      }
      return {
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        facing: currentState.facing,
        monsterName: currentState.encounter && currentState.encounter.monsterName,
        encounterId: currentState.encounter && currentState.encounter.id
      };
    })()`);

    assert.equal(beforeReload.x, 9);
    assert.equal(beforeReload.y, 7);
    assert.equal(beforeReload.facing, 'WEST');
    assert.equal(beforeReload.monsterName, 'Skeletal Champion');

    // Perform real browser Page.reload via CDP
    await cdpSend('Page.reload', { ignoreCache: true });
    await sleep(600);
    const afterReload = await evalInPage(`(async () => {
      for (let i = 0; i < 40; i++) {
        if (typeof currentState !== 'undefined' && currentState && currentState.character) break;
        await new Promise(r => setTimeout(r, 100));
      }
      return {
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        facing: currentState.facing,
        mode: currentState.mode,
        monsterName: currentState.encounter && currentState.encounter.monsterName,
        encounterId: currentState.encounter && currentState.encounter.id,
        hasActorDom: Boolean(document.getElementById('fp-monster-actor'))
      };
    })()`);

    assert.equal(afterReload.x, 9);
    assert.equal(afterReload.y, 7);
    assert.equal(afterReload.facing, 'WEST');
    assert.equal(afterReload.mode, 'IN_COMBAT');
    assert.equal(afterReload.monsterName, 'Skeletal Champion');
    assert.equal(afterReload.encounterId, beforeReload.encounterId);
    assert.equal(afterReload.hasActorDom, true);

    await captureScreenshot('08_area08_post_reload_persistence.png');
  });

  // =========================================================================
  // AREA 9: Quest / Expedition Progress & Directional Guidance
  // =========================================================================
  it('Area 9: Expedition waypoints, directional hints, discovery choices, and Journal modal track progress accurately', async () => {
    const expProgress = await evalInPage(`(async () => {
      await startExpeditionRoute('MIRKWOOD_EXPEDITION');
      // Visit North Gate [7,6] -> Crossroads [7,5] -> Trail [7,4] -> Primeval Black Oak [7,3]
      await dispatchRelativeMove('FORWARD');
      await dispatchRelativeMove('FORWARD');
      await dispatchRelativeMove('FORWARD');
      await resolveDiscoveryChoiceClick('disc_mirkwood_abandoned_camp', 'inspect_campsite');
      await dispatchRelativeMove('FORWARD');
      await resolveDiscoveryChoiceClick('disc_ancient_oak_sap_shrine', 'examine_warden_oath');
      // Return to Oakhaven [7,7] to complete expedition
      await dispatchTurn('RIGHT');
      await dispatchTurn('RIGHT');
      for (let i = 0; i < 4; i++) {
        await dispatchRelativeMove('FORWARD');
      }
      openLabModal('journal');
      await new Promise(r => setTimeout(r, 150));
      const backdrop = document.getElementById('lab-modal-backdrop');
      const journalOpen = Boolean(backdrop && !backdrop.hidden);
      const journalText = backdrop ? backdrop.innerText : '';
      return {
        isComplete: currentState.adventure.expedition.isComplete,
        progress: currentState.adventure.progress,
        journalOpen,
        journalText
      };
    })()`);

    assert.equal(expProgress.isComplete, true, 'Mirkwood Expedition must complete upon returning to Oakhaven');
    assert.equal(expProgress.journalOpen, true, 'Expedition Journal modal must open');
    assert.match(expProgress.journalText, /Mirkwood|Waypoint|Expedition/i);

    await captureScreenshot('09_area09_expedition_journal_progress.png');
    await evalInPage(`closeLabModal()`);
  });

  // =========================================================================
  // AREA 10: Monster Size Scaling Monotonicity & Scale Comparison Arena
  // =========================================================================
  it('Area 10: All 98 catalog monsters + 5 reference specimens obey PF1e size monotonicity (Tiny < Small < Medium < Large < Huge) in API and live Scale Arena DOM', async () => {
    const scaleApi = await apiGet('/api/monster-scaling?viewportWidth=1920&viewportHeight=1080');
    assert.equal(scaleApi.ok, true);
    assert.equal(scaleApi.catalogCount, 98);
    assert.equal(scaleApi.auditSummary.totalDatabaseMonsters, 98);

    // Compute average visible heights by PF1e size category across catalog + referenceSpecimens
    const heightsBySize = {};
    for (const item of [...scaleApi.catalog, ...(scaleApi.referenceSpecimens || [])]) {
      const cat = item.pfSizeCategory;
      if (!heightsBySize[cat]) heightsBySize[cat] = [];
      heightsBySize[cat].push(item.adaptiveScale.visibleHeightPx);
    }
    const avgHeight = (cat) => {
      const arr = heightsBySize[cat] || [];
      return arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    };

    assert.ok(avgHeight('TINY') < avgHeight('SMALL'), 'Avg TINY height < Avg SMALL height');
    assert.ok(avgHeight('SMALL') < avgHeight('MEDIUM'), 'Avg SMALL height < Avg MEDIUM height');
    assert.ok(avgHeight('MEDIUM') < avgHeight('LARGE'), 'Avg MEDIUM height < Avg LARGE height');
    assert.ok(avgHeight('LARGE') < avgHeight('HUGE'), 'Avg LARGE height < Avg HUGE height');

    // Open in-viewport Scale Comparison Arena and measure rendered DOM cards
    const arenaDom = await evalInPage(`(async () => {
      await triggerTeleport(8, 7, 'EAST');
      setMonsterScaleMode('adaptive');
      setSizeComparisonPreset('SIZE_PROGRESSION_5');
      const imgs = Array.from(document.querySelectorAll('.sizelab-specimen-img'));
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 1200); })));
      await new Promise(r => setTimeout(r, 180));
      const items = Array.from(document.querySelectorAll('.sizelab-lineup-item')).map(el => ({
        slug: el.getAttribute('data-slug'),
        pfSize: el.getAttribute('data-pf-size'),
        combatW: Number(el.getAttribute('data-combat-w')),
        combatH: Number(el.getAttribute('data-combat-h')),
        dispW: Number(el.getAttribute('data-disp-w')),
        dispH: Number(el.getAttribute('data-disp-h')),
        demoProxy: el.getAttribute('data-demo-proxy') === 'true',
        proxyBadgeText: el.querySelector('.sizelab-demo-proxy-badge')?.textContent?.trim() || null
      }));
      return {
        itemCount: items.length,
        items
      };
    })()`);

    assert.equal(arenaDom.itemCount, 5);
    for (let i = 1; i < arenaDom.items.length; i++) {
      assert.ok(
        arenaDom.items[i].dispH > arenaDom.items[i - 1].dispH,
        `Expected ${arenaDom.items[i].slug} (${arenaDom.items[i].dispH}px) > ${arenaDom.items[i - 1].slug} (${arenaDom.items[i - 1].dispH}px)`
      );
    }
    qaMetrics.scaleArenaDomOrder = arenaDom.items;
    for (const item of arenaDom.items) {
      if (item.slug.startsWith('ref_')) {
        assert.equal(item.demoProxy, true, `${item.slug} must be flagged as Demo Proxy`);
        assert.equal(item.proxyBadgeText, 'Demo Proxy', `${item.slug} must render Demo Proxy badge`);
      } else {
        assert.equal(item.demoProxy, false, `${item.slug} must not be flagged as Demo Proxy`);
      }
    }

    await captureScreenshot('10_area10_size_comparison_arena.png');
    await evalInPage(`toggleMonsterSizeComparisonLab(false)`);
  });

  // =========================================================================
  // AREA 11: Broken Asset Error Fallback & 61 Card Fallbacks
  // =========================================================================
  it('Area 11: Non-cutout monsters safely render in Card Fallback mode and handleMonsterImageError recovers from broken cutout URLs', async () => {
    const fallbackCheck = await evalInPage(`(async () => {
      setMonsterPresenceMode('integrated');
      await triggerTeleport(7, 5, 'NORTH');
      await triggerLabScenario('STAGE2_COMBAT', 'Choker');
      for (let i = 0; i < 20; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 80));
      }
      const actor = document.getElementById('fp-monster-actor');
      const img = document.querySelector('.fp-monster-img');
      if (img && !img.complete) {
        await new Promise(r => {
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
          setTimeout(r, 1500);
        });
      }
      return {
        activeMode: currentState.encounter.renderContract.activeMode,
        didFallbackToCard: currentState.encounter.renderContract.didFallbackToCard,
        isCardMonsterClass: actor ? actor.classList.contains('is-card-monster') : false,
        imgPresentation: img ? img.getAttribute('data-presentation') : null,
        imgLoaded: Boolean(img && img.complete && img.naturalWidth > 0)
      };
    })()`);

    assert.equal(fallbackCheck.activeMode, 'CARD');
    assert.equal(fallbackCheck.didFallbackToCard, true);
    assert.equal(fallbackCheck.isCardMonsterClass, true);
    assert.equal(fallbackCheck.imgPresentation, 'card');
    assert.equal(fallbackCheck.imgLoaded, true);

    // Now test live runtime recovery when an integrated monster's cutout URL fails to load
    allowIntentionalBrokenAsset = true;
    const runtimeErrorRecovery = await evalInPage(`(async () => {
      await triggerLabScenario('STAGE2_COMBAT', 'Wolf');
      for (let i = 0; i < 20; i++) {
        if (!isSequencePlaying) break;
        await new Promise(r => setTimeout(r, 80));
      }
      const img = document.querySelector('.fp-monster-img');
      const beforePresentation = img ? img.getAttribute('data-presentation') : null;
      // Force a broken cutout URL to trigger onerror="handleMonsterImageError(this)"
      await new Promise((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.src = '/lab-assets/images/monsters-cutout/non_existent_qa_broken.png';
        setTimeout(resolve, 1500);
      });
      const actor = document.getElementById('fp-monster-actor');
      return {
        beforePresentation,
        afterPresentation: img ? img.getAttribute('data-presentation') : null,
        recoveredNaturalWidth: img ? img.naturalWidth : 0,
        actorHasCardClass: actor ? actor.classList.contains('is-card-monster') : false
      };
    })()`);
    allowIntentionalBrokenAsset = false;

    assert.equal(runtimeErrorRecovery.beforePresentation, 'integrated');
    assert.equal(runtimeErrorRecovery.afterPresentation, 'card');
    assert.ok(runtimeErrorRecovery.recoveredNaturalWidth > 0, 'Fallback portrait must decode cleanly after error recovery');
    assert.equal(runtimeErrorRecovery.actorHasCardClass, true);

    await captureScreenshot('11_area11_card_fallback_safety.png');
  });

  // =========================================================================
  // AREA 12: Newly Integrated Track 4 Cutouts in Live Browser Combat
  // =========================================================================
  it('Area 12: Newly integrated Track 4 RGBA cutouts render in-scene with contact shadows, centering, and monotonic size scaling', async () => {
    const cutoutSpecimens = [
      { name: 'Stirge',       pfSize: 'TINY',   airborne: true,  x: 4, y: 11, facing: 'NORTH', shot: '12a_area12_stirge_tiny_cutout.png' },
      { name: 'Goblin',       pfSize: 'SMALL',  airborne: false, x: 7, y: 5,  facing: 'NORTH', shot: '12b_area12_goblin_small_cutout.png' },
      { name: 'Rust Monster', pfSize: 'MEDIUM', airborne: false, x: 9, y: 7,  facing: 'WEST',  shot: '12c_area12_rust_monster_medium_cutout.png' },
      { name: 'Bugbear',      pfSize: 'MEDIUM', airborne: false, x: 7, y: 5,  facing: 'NORTH', shot: '12d_area12_bugbear_medium_cutout.png' },
      { name: 'Ogre',         pfSize: 'LARGE',  airborne: false, x: 8, y: 7,  facing: 'EAST',  shot: '12e_area12_ogre_large_cutout.png' }
    ];

    const byName = {};

    for (const spec of cutoutSpecimens) {
      const check = await evalInPage(`(async () => {
        setMonsterPresenceMode('integrated');
        await triggerTeleport(${spec.x}, ${spec.y}, '${spec.facing}');
        await triggerLabScenario('STAGE2_COMBAT', '${spec.name}');
        for (let i = 0; i < 20; i++) {
          if (!isSequencePlaying) break;
          await new Promise(r => setTimeout(r, 80));
        }
        const img = document.querySelector('.fp-monster-img');
        if (img && !img.complete) {
          await new Promise(r => {
            img.addEventListener('load', r, { once: true });
            setTimeout(r, 1500);
          });
        }
        const actor = document.getElementById('fp-monster-actor');
        if (actor) actor.classList.remove('anim-monster-emerge');
        await new Promise(r => setTimeout(r, 150));
        const vp = document.getElementById('fp-viewport');
        const pBox = document.querySelector('.fp-monster-portrait-box');
        const vpRect = vp.getBoundingClientRect();
        const actorRect = actor.getBoundingClientRect();
        const pRect = pBox.getBoundingClientRect();
        const vpCenterX = vpRect.left + vpRect.width / 2;
        const actorCenterX = actorRect.left + actorRect.width / 2;
        return {
          monsterName: currentState.encounter.monsterName,
          pfSize: actor.getAttribute('data-pf-size'),
          bodyProfile: actor.getAttribute('data-body-profile'),
          presentation: img.getAttribute('data-presentation'),
          imgSrc: img.getAttribute('src'),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          boxWidthPx: Math.round(pRect.width),
          boxHeightPx: Math.round(pRect.height),
          boxAreaPx: Math.round(pRect.width * pRect.height),
          centerOffsetPx: Math.round(Math.abs(actorCenterX - vpCenterX)),
          hasGroundingRig: Boolean(actor.querySelector('.fp-integrated-grounding-rig')),
          hasAmbientPatch: Boolean(actor.querySelector('.fp-rig-ambient-patch')),
          contactCount: actor.querySelectorAll('.fp-rig-contact-patch').length
        };
      })()`);

      assert.equal(check.monsterName, spec.name);
      assert.equal(check.pfSize, spec.pfSize);
      assert.equal(check.presentation, 'integrated');
      assert.match(check.imgSrc, /\/lab-assets\/images\/monsters-cutout\/[a-z0-9_]+\.png$/);
      assert.ok(check.naturalWidth >= 256, `Cutout naturalWidth (${check.naturalWidth}) must be >= 256`);
      assert.ok(check.naturalHeight >= 256, `Cutout naturalHeight (${check.naturalHeight}) must be >= 256`);
      assert.equal(check.hasGroundingRig, true);
      assert.equal(check.hasAmbientPatch, true, 'Every integrated cutout must render an ambient shadow patch');
      if (!spec.airborne) {
        assert.ok(check.contactCount >= 1, `Grounded monster ${spec.name} must render >= 1 anatomical contact shadow patch`);
      }
      assert.ok(check.centerOffsetPx <= 24, `Monster actor for ${spec.name} must be centered in viewport (offset=${check.centerOffsetPx}px)`);

      byName[spec.name] = check;
      qaMetrics.monsterCutoutDomChecks.push(check);
      await captureScreenshot(spec.shot);
    }

    // Verify rendered size progression:
    // 1) Upright height ladder: Stirge (TINY) < Goblin (SMALL) < Bugbear (MEDIUM) < Ogre (LARGE)
    assert.ok(byName['Stirge'].boxHeightPx < byName['Goblin'].boxHeightPx, 'Stirge height < Goblin height');
    assert.ok(byName['Goblin'].boxHeightPx < byName['Bugbear'].boxHeightPx, 'Goblin height < Bugbear height');
    assert.ok(byName['Bugbear'].boxHeightPx < byName['Ogre'].boxHeightPx, 'Bugbear height < Ogre height');
    // 2) Wide crawler Medium (Rust Monster) has wider footprint and larger area than Small Goblin, and smaller area than Large Ogre
    assert.ok(byName['Rust Monster'].boxWidthPx > byName['Goblin'].boxWidthPx, 'Rust Monster width > Goblin width');
    assert.ok(byName['Rust Monster'].boxAreaPx > byName['Goblin'].boxAreaPx, 'Rust Monster area > Goblin area');
    assert.ok(byName['Ogre'].boxAreaPx > byName['Rust Monster'].boxAreaPx, 'Ogre area > Rust Monster area');
  });

  // =========================================================================
  // AREA 13: Responsive UI & Zero-Scroll / Zero-Overlap across 3 Viewports
  // =========================================================================
  it('Area 13: Layout fits within 1920x1080, 1440x900, and 1280x800 with zero page scroll and zero panel overlap', async () => {
    const viewports = [
      { width: 1920, height: 1080, shot: '13a_area13_viewport_1920x1080.png' },
      { width: 1440, height: 900,  shot: '13b_area13_viewport_1440x900.png' },
      { width: 1280, height: 800,  shot: '13c_area13_viewport_1280x800.png' }
    ];

    for (const vp of viewports) {
      await cdpSend('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(250);

      const layoutAudit = await evalInPage(`(async () => {
        if (currentState) renderGameState(currentState, { skipSequence: true });
        await new Promise(r => setTimeout(r, 120));
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scrollW = document.documentElement.scrollWidth;
        const scrollH = document.documentElement.scrollHeight;
        const vpRect = document.getElementById('fp-viewport').getBoundingClientRect();
        const rightRect = document.querySelector('.dm-right-deck').getBoundingClientRect();
        const topRect = document.querySelector('.dm-top-deck').getBoundingClientRect();
        const moveRect = document.getElementById('dm-movement-deck').getBoundingClientRect();
        return {
          vw,
          vh,
          scrollW,
          scrollH,
          noVerticalOverflow: scrollH <= vh + 2,
          noHorizontalOverflow: scrollW <= vw + 2,
          noViewportRightDeckOverlap: vpRect.right <= rightRect.left + 2,
          topDeckFits: topRect.top >= 0 && topRect.bottom <= vpRect.top + 2,
          movementDeckFits: moveRect.bottom <= vh + 2 && moveRect.right <= vw + 2
        };
      })()`);

      qaMetrics.viewportAudits[`${vp.width}x${vp.height}`] = layoutAudit;
      assert.equal(layoutAudit.noVerticalOverflow, true, `No vertical page scroll at ${vp.width}x${vp.height} (scrollH=${layoutAudit.scrollH}, vh=${layoutAudit.vh})`);
      assert.equal(layoutAudit.noHorizontalOverflow, true, `No horizontal page scroll at ${vp.width}x${vp.height} (scrollW=${layoutAudit.scrollW}, vw=${layoutAudit.vw})`);
      assert.equal(layoutAudit.noViewportRightDeckOverlap, true, `Viewport and Right Deck must not overlap at ${vp.width}x${vp.height}`);
      assert.equal(layoutAudit.topDeckFits, true, `Top champion deck must not overlap viewport at ${vp.width}x${vp.height}`);
      assert.equal(layoutAudit.movementDeckFits, true, `Movement deck must remain fully inside viewport at ${vp.width}x${vp.height}`);

      await captureScreenshot(vp.shot);
    }

    // Restore 1920x1080 and verify progressive disclosure Lab Tools toggle & Controls Help modal
    await cdpSend('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    const progressiveDisclosure = await evalInPage(`(async () => {
      toggleDevToolsDrawer(false);
      const expandLabel = document.getElementById('lbl-toggle-devtools')?.textContent?.trim();
      const bodyExpanded = document.body.classList.contains('dev-mode-visible');
      toggleDevToolsDrawer(true);
      const collapseLabel = document.getElementById('lbl-toggle-devtools')?.textContent?.trim();
      const bodyCollapsed = document.body.classList.contains('dev-mode-collapsed');
      return { expandLabel, bodyExpanded, collapseLabel, bodyCollapsed };
    })()`);

    assert.equal(progressiveDisclosure.bodyExpanded, true);
    assert.equal(progressiveDisclosure.expandLabel, 'Hide Lab Tools');
    assert.equal(progressiveDisclosure.bodyCollapsed, true);
    assert.equal(progressiveDisclosure.collapseLabel, 'Lab Tools');
  });

  // =========================================================================
  // AREA 14: Asset Loading, Image Decode & Runtime Memory / Performance
  // =========================================================================
  it('Area 14: All 37 monster cutouts and scene assets decode cleanly and JS heap memory remains well-bounded', async () => {
    const manifest = await apiGet('/api/monster-manifest');
    assert.equal(manifest.ok, true);
    assert.equal(manifest.summary.totalDatabaseMonsters, 98);
    assert.equal(manifest.summary.verifiedCutoutCount, 37);
    assert.equal(manifest.summary.cardFallbackCount, 61);

    const cutoutMonsters = manifest.monsters.filter((m) => m.cutoutAsset && m.cutoutAsset.hasVerifiedCutout);
    assert.equal(cutoutMonsters.length, 37);
    for (const m of cutoutMonsters) {
      const diskPath = path.join(__dirname, '../public/images/monsters-cutout', `${m.slug}.png`);
      assert.equal(fs.existsSync(diskPath), true, `Cutout file must exist on disk for ${m.slug}`);
      const stat = fs.statSync(diskPath);
      assert.ok(stat.size > 10000, `Cutout file for ${m.slug} must be non-empty (${stat.size} bytes)`);
    }

    const perfRes = await cdpSend('Performance.getMetrics');
    const metricsMap = {};
    for (const item of (perfRes.metrics || [])) {
      metricsMap[item.name] = item.value;
    }
    qaMetrics.performanceMetrics = {
      JSHeapUsedSizeMB: Number(((metricsMap.JSHeapUsedSize || 0) / (1024 * 1024)).toFixed(2)),
      JSHeapTotalSizeMB: Number(((metricsMap.JSHeapTotalSize || 0) / (1024 * 1024)).toFixed(2)),
      Nodes: metricsMap.Nodes || 0,
      JSEventListeners: metricsMap.JSEventListeners || 0
    };

    assert.ok(
      qaMetrics.performanceMetrics.JSHeapUsedSizeMB < 120,
      `JSHeapUsedSizeMB (${qaMetrics.performanceMetrics.JSHeapUsedSizeMB} MB) must remain under 120 MB`
    );
  });

  // =========================================================================
  // AREA 15: Console, Uncaught Exception & Network Error Audit
  // =========================================================================
  it('Area 15: Zero unexpected console errors, zero uncaught page exceptions, and zero HTTP >= 400 asset failures', async () => {
    assert.deepEqual(consoleErrors, [], `Expected zero console.error calls, got: ${JSON.stringify(consoleErrors)}`);
    assert.deepEqual(pageExceptions, [], `Expected zero uncaught page exceptions, got: ${JSON.stringify(pageExceptions)}`);
    assert.deepEqual(failedNetworkRequests, [], `Expected zero failed HTTP requests, got: ${JSON.stringify(failedNetworkRequests)}`);
  });
});
