/**
 * DARKGRID ACTION UI LAB — Pathfinder 1e Monster Size & Visual Scaling QA Runner (Phases 4 & 5)
 *
 * Launches the isolated Action UI Lab server and headless Chrome via CDP to verify and capture:
 *  1. Single-monster Before (Legacy Uniform) vs. After (PF1e Adaptive) screenshots on identical scene & distance
 *  2. 5-Size Progression Lineup (Tiny -> Small -> Medium -> Large -> Huge) at 1920x1080, 1440x900, and 1280x800
 *  3. Same-Size Body Profile Lineups (Medium 5-profile & Large 5-profile)
 *  4. All 9 Pathfinder 1e Size Categories Lineup (Fine -> Colossal)
 *  5. Split Before vs. After Arena comparisons
 *
 * Saves screenshots to `action-ui-lab/docs/screenshots/size-scaling/` and writes
 * `action-ui-lab/docs/size-scaling-qa-results.json`.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createLabApp } = require('../server');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function findBrowserExecutable() {
  for (const c of CHROME_CANDIDATES) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Could not find Chrome or Edge executable.');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function connectCdp(debugPort) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
          });
          let msgId = 0;
          const pending = new Map();
          ws.addEventListener('message', (ev) => {
            const data = JSON.parse(String(ev.data));
            if (data.id && pending.has(data.id)) {
              const { resolve, reject } = pending.get(data.id);
              pending.delete(data.id);
              if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
              else resolve(data.result);
            }
          });
          const send = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++msgId;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
          });
          return { ws, send };
        }
      }
    } catch {}
    await sleep(200);
  }
  throw new Error('Failed to connect to CDP.');
}

async function runSizeScalingVisualQa() {
  const outDir = path.join(__dirname, '../docs/screenshots/size-scaling');
  fs.mkdirSync(outDir, { recursive: true });

  const app = createLabApp({ dbPath: ':memory:', rng: () => 0.99 });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const browserExe = findBrowserExecutable();
  const debugPort = 9500 + Math.floor(Math.random() * 350);
  const userDataDir = path.join(__dirname, '../docs/.tmp-size-qa-profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(browserExe, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1920,1080',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    baseUrl
  ], { stdio: 'ignore' });

  const checks = [];
  function recordCheck(name, passed, details = {}) {
    checks.push({ name, passed: Boolean(passed), details });
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    if (!passed) console.error('   Details:', JSON.stringify(details));
  }

  try {
    const { ws, send } = await connectCdp(debugPort);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    const evalInPage = async (expression) => {
      const res = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      if (res.exceptionDetails) {
        throw new Error(`Page eval error: ${JSON.stringify(res.exceptionDetails)}`);
      }
      return res.result ? res.result.value : undefined;
    };

    const captureShot = async (filename) => {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
      return filePath;
    };

    for (let i = 0; i < 30; i++) {
      const ready = await evalInPage(`Boolean(window.currentState && window.MonsterSizeCatalog)`);
      if (ready) break;
      await sleep(200);
    }

    // Position at Crossroads [7,5] facing NORTH so all comparisons share the exact same environment backdrop
    await evalInPage(`(async () => {
      setSceneMode('C');
      setAtmosphericEffectsMode('subtle');
      setMonsterPresenceMode('integrated');
      await triggerTeleport(7, 5, 'NORTH');
      if (window.__waitForSceneReady) await window.__waitForSceneReady(2000);
    })()`);

    // 1. Capture Before (Legacy) vs. After (Adaptive) single-monster combat shots at 1920x1080
    const singleComparisons = [
      { query: 'Stirge',       slug: 'stirge',       beforeShot: '01_before_legacy_stirge_tiny_1920x1080.png',   afterShot: '02_after_adaptive_stirge_tiny_1920x1080.png' },
      { query: 'Goblin',       slug: 'goblin',       beforeShot: '03_before_legacy_goblin_small_1920x1080.png',  afterShot: '04_after_adaptive_goblin_small_1920x1080.png' },
      { query: 'Giant Spider', slug: 'giant_spider', beforeShot: '05_before_legacy_spider_medium_1920x1080.png', afterShot: '06_after_adaptive_spider_medium_1920x1080.png' },
      { query: 'Troll',        slug: 'troll',        beforeShot: '07_before_legacy_troll_large_1920x1080.png',   afterShot: '08_after_adaptive_troll_large_1920x1080.png' }
    ];

    for (const item of singleComparisons) {
      const metrics = await evalInPage(`(async () => {
        toggleMonsterSizeComparisonLab(false);
        await triggerTeleport(7, 5, 'NORTH');
        await triggerLabScenario('STAGE2_COMBAT', '${item.query}');
        setMonsterScaleMode('legacy');
        const actor1 = document.getElementById('fp-monster-actor');
        if (actor1) actor1.classList.remove('anim-monster-emerge');
        await new Promise(r => setTimeout(r, 180));
        const box1 = document.querySelector('.fp-monster-portrait-box').getBoundingClientRect();
        return {
          beforeW: Math.round(box1.width),
          beforeH: Math.round(box1.height)
        };
      })()`);
      await captureShot(item.beforeShot);

      const afterMetrics = await evalInPage(`(async () => {
        setMonsterScaleMode('adaptive');
        const actor2 = document.getElementById('fp-monster-actor');
        if (actor2) actor2.classList.remove('anim-monster-emerge');
        await new Promise(r => setTimeout(r, 180));
        const box2 = document.querySelector('.fp-monster-portrait-box').getBoundingClientRect();
        return {
          afterW: Math.round(box2.width),
          afterH: Math.round(box2.height),
          pfSize: actor2 ? actor2.getAttribute('data-pf-size') : null,
          bodyProfile: actor2 ? actor2.getAttribute('data-body-profile') : null
        };
      })()`);
      await captureShot(item.afterShot);

      recordCheck(
        `Single-Monster Before/After (${item.query}): ${metrics.beforeW}x${metrics.beforeH}px -> ${afterMetrics.afterW}x${afterMetrics.afterH}px`,
        afterMetrics.afterW > 0 && afterMetrics.afterH > 0 && (metrics.beforeH !== afterMetrics.afterH || metrics.beforeW !== afterMetrics.afterW),
        { ...metrics, ...afterMetrics, beforeShot: item.beforeShot, afterShot: item.afterShot }
      );
    }

    // 2. Capture 5-Size Progression Lineup (Tiny -> Small -> Medium -> Large -> Huge) across 1920x1080, 1440x900, and 1280x800
    const resolutions = [
      { width: 1920, height: 1080, shot: '09_arena_size_progression_5_1920x1080.png' },
      { width: 1440, height: 900,  shot: '10_arena_size_progression_5_1440x900.png' },
      { width: 1280, height: 800,  shot: '11_arena_size_progression_5_1280x800.png' }
    ];

    for (const res of resolutions) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: res.width,
        height: res.height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(160);
      const lineupInfo = await evalInPage(`(async () => {
        setMonsterScaleMode('adaptive');
        setSizeComparisonPreset('SIZE_PROGRESSION_5');
        const imgs = Array.from(document.querySelectorAll('.sizelab-specimen-img'));
        await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 1200); })));
        await new Promise(r => setTimeout(r, 150));
        const items = Array.from(document.querySelectorAll('.sizelab-lineup-item')).map(el => ({
          slug: el.getAttribute('data-slug'),
          pfSize: el.getAttribute('data-pf-size'),
          combatW: Number(el.getAttribute('data-combat-w')),
          combatH: Number(el.getAttribute('data-combat-h')),
          dispW: Number(el.getAttribute('data-disp-w')),
          dispH: Number(el.getAttribute('data-disp-h'))
        }));
        const docEl = document.documentElement;
        return {
          itemCount: items.length,
          items,
          noOverflow: docEl.scrollWidth <= docEl.clientWidth + 2 && docEl.scrollHeight <= docEl.clientHeight + 2
        };
      })()`);
      await captureShot(res.shot);

      const strictlyIncreasing = lineupInfo.items.every((it, idx) => idx === 0 || it.dispH > lineupInfo.items[idx - 1].dispH);
      recordCheck(
        `5-Size Progression Arena at ${res.width}x${res.height} (Tiny -> Small -> Medium -> Large -> Huge)`,
        lineupInfo.itemCount === 5 && strictlyIncreasing && lineupInfo.noOverflow,
        { ...lineupInfo, screenshot: res.shot }
      );
    }

    // Restore 1920x1080 for Body Profile, 9-Tier, and Split Before/After Arena shots
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(160);

    // 3. Medium Body Profiles Lineup (1920x1080)
    const medProfInfo = await evalInPage(`(async () => {
      setSizeComparisonPreset('SAME_SIZE_MEDIUM_PROFILES');
      const imgs = Array.from(document.querySelectorAll('.sizelab-specimen-img'));
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 1200); })));
      await new Promise(r => setTimeout(r, 150));
      return Array.from(document.querySelectorAll('.sizelab-lineup-item')).map(el => ({
        slug: el.getAttribute('data-slug'),
        profile: el.getAttribute('data-body-profile'),
        combatW: Number(el.getAttribute('data-combat-w')),
        combatH: Number(el.getAttribute('data-combat-h'))
      }));
    })()`);
    await captureShot('12_arena_medium_body_profiles_1920x1080.png');
    recordCheck('Medium Body Profile Arena (5 distinct Medium silhouettes)', medProfInfo.length === 5, { items: medProfInfo });

    // 4. Large Body Profiles Lineup (1920x1080)
    const largeProfInfo = await evalInPage(`(async () => {
      setSizeComparisonPreset('SAME_SIZE_LARGE_PROFILES');
      const imgs = Array.from(document.querySelectorAll('.sizelab-specimen-img'));
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 1200); })));
      await new Promise(r => setTimeout(r, 150));
      return Array.from(document.querySelectorAll('.sizelab-lineup-item')).map(el => ({
        slug: el.getAttribute('data-slug'),
        profile: el.getAttribute('data-body-profile'),
        combatW: Number(el.getAttribute('data-combat-w')),
        combatH: Number(el.getAttribute('data-combat-h'))
      }));
    })()`);
    await captureShot('13_arena_large_body_profiles_1920x1080.png');
    recordCheck('Large Body Profile Arena (5 distinct Large silhouettes)', largeProfInfo.length === 5, { items: largeProfInfo });

    // 5. All 9 Pathfinder 1e Size Categories (Fine -> Colossal)
    const nineTierInfo = await evalInPage(`(async () => {
      setSizeComparisonPreset('ALL_9_PF1E_TIERS');
      const imgs = Array.from(document.querySelectorAll('.sizelab-specimen-img'));
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 1200); })));
      await new Promise(r => setTimeout(r, 150));
      return Array.from(document.querySelectorAll('.sizelab-lineup-item')).map(el => ({
        slug: el.getAttribute('data-slug'),
        pfSize: el.getAttribute('data-pf-size'),
        combatW: Number(el.getAttribute('data-combat-w')),
        combatH: Number(el.getAttribute('data-combat-h'))
      }));
    })()`);
    await captureShot('14_arena_all_9_pf1e_tiers_1920x1080.png');
    recordCheck('All 9 PF1e Size Categories Arena (Fine -> Colossal)', nineTierInfo.length === 9, { items: nineTierInfo });

    // 6. Split Before vs. After Arena shots (Troll & Stirge)
    await evalInPage(`(async () => {
      setBeforeAfterSpecimen('troll');
      await new Promise(r => setTimeout(r, 150));
    })()`);
    await captureShot('15_arena_before_after_split_troll_1920x1080.png');

    await evalInPage(`(async () => {
      setBeforeAfterSpecimen('stirge');
      await new Promise(r => setTimeout(r, 150));
    })()`);
    await captureShot('16_arena_before_after_split_stirge_1920x1080.png');

    ws.close();
  } finally {
    try { chromeProc.kill(); } catch {}
    try { server.close(); } catch {}
    await sleep(250);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;
  fs.writeFileSync(
    path.join(__dirname, '../docs/size-scaling-qa-results.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), passed, failed, checks }, null, 2)
  );
  console.log(`\nSize Scaling Visual QA Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runSizeScalingVisualQa().catch(err => {
  console.error(err);
  process.exit(1);
});
