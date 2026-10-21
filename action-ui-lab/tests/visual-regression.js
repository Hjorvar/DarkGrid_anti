/**
 * DARKGRID ACTION UI LAB — Automated Visual Regression & Expedition QA Suite (Phases 6, 7 & 2.5b)
 *
 * Launches the isolated Action UI Lab server and headless Chrome via raw CDP WebSocket to verify:
 *  1. 31+ Landmark, Sub-Biome, Transition, and Barrier POV scenes across N/E/S/W facings (`naturalWidth > 0`, multi-zone composited pixel luminance, A/B layer opacity, and viewport coverage)
 *  2. Continuous Multi-Tile Expedition Routes (Forward & Return)
 *  3. Atmospheric Effects Engine (`Off`, `Subtle`, `Full`)
 *  4. Points of Interest (`Inspect [I]` Environmental Lore Plaques)
 *  5. All 7 Integrated Monster Cutouts + Safe Card Fallback across diverse world surfaces
 *  6. Interactive World Visual Atlas (`[V]`) & Visual QA Developer Modals
 *  7. Responsive Layout Verification (`1920x1080`, `1440x900`, `1280x800` Handheld PC, `1280x720`)
 *  8. Phase 1 Regressions & Adventure Experience E2E Journeys (1–10)
 *  9. Phase 2.5b Rendering Integrity: Rapid Movement / Crossfade Stress Test, Reduced-Motion & Zero Console/Network Error Verification
 *
 * Writes `action-ui-lab/docs/visual-qa-results.json` and saves PNG screenshots to
 * `action-ui-lab/docs/screenshots/expedition/`.
 */

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
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not find Chrome or Edge executable for headless CDP verification.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectCdp(debugPort) {
  let targets = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      if (res.ok) {
        targets = await res.json();
        const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (pageTarget) {
          const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error('Failed to connect to headless browser CDP WebSocket.');
}

async function runVisualRegressionSuite() {
  const screenshotDir = path.join(__dirname, '../docs/screenshots/expedition');
  const adventureScreenshotDir = path.join(__dirname, '../docs/screenshots/adventure');
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(adventureScreenshotDir, { recursive: true });

  // 1. Start isolated Lab server on ephemeral port with deterministic high RNG so random moves don't interrupt route steps
  let mockRngValue = 0.99;
  const app = createLabApp({
    dbPath: ':memory:',
    rng: () => mockRngValue
  });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 2. Launch headless Chrome with temporary user data dir
  const debugPort = 9345 + Math.floor(Math.random() * 400);
  const userDataDir = path.join(__dirname, `../data/chrome_qa_${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const browserExe = findBrowserExecutable();
  const chromeProc = spawn(browserExe, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1600,940',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    `${baseUrl}/`
  ], { stdio: 'ignore' });

  const checks = [];
  function recordCheck(category, name, passed, details = {}) {
    checks.push({
      category,
      name,
      passed: Boolean(passed),
      ...details
    });
    if (!passed) {
      console.error(`  ✖ [${category}] ${name}:`, details);
    } else {
      console.log(`  ✔ [${category}] ${name}`);
    }
  }

  try {
    const { ws, send } = await connectCdp(debugPort);
    const consoleErrors = [];
    const pageExceptions = [];
    const failedImageRequests = [];

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.method === 'Runtime.exceptionThrown') {
          pageExceptions.push(msg.params?.exceptionDetails?.text || 'Unknown exception');
        } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
          const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
          consoleErrors.push(text);
        } else if (msg.method === 'Network.responseReceived') {
          const url = msg.params?.response?.url || '';
          const status = msg.params?.response?.status || 200;
          if (url.includes('/images/') && status >= 400) {
            failedImageRequests.push({ url, status });
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 940,
      deviceScaleFactor: 1,
      mobile: false
    });

    const evalInPage = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true
      });
      if (res.exceptionDetails) {
        throw new Error(`Page eval error: ${res.exceptionDetails.text}`);
      }
      return res.result ? res.result.value : undefined;
    };

    const capturePng = async (filename) => {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const outPath = path.join(screenshotDir, filename);
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      return { outPath, base64: shot.data };
    };

    const captureAdventurePng = async (filename) => {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const outPath = path.join(adventureScreenshotDir, filename);
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      return outPath;
    };

    // Analyze actual composited screenshot pixels across 5 viewport zones to catch partial tile / black stage bugs
    const verifyScreenshotMultiZoneLuma = async (base64Data, backdropRect) => {
      return evalInPage(`(async () => {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = 'data:image/png;base64,${base64Data}';
        });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const rx = ${Math.round(backdropRect.x)};
        const ry = ${Math.round(backdropRect.y)};
        const rw = ${Math.round(backdropRect.width)};
        const rh = ${Math.round(backdropRect.height)};
        function sampleZone(zx, zy, zw, zh) {
          const d = ctx.getImageData(Math.max(0, Math.round(zx)), Math.max(0, Math.round(zy)), Math.max(1, Math.round(zw)), Math.max(1, Math.round(zh))).data;
          let sum = 0;
          let nonBlack = 0;
          const total = d.length / 4;
          for (let i = 0; i < d.length; i += 4) {
            const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            sum += l;
            if (l > 8) nonBlack++;
          }
          return {
            avgLuma: Number((sum / Math.max(1, total)).toFixed(2)),
            nonBlackRatio: Number((nonBlack / Math.max(1, total)).toFixed(3))
          };
        }
        const zw = rw / 3;
        const zh = rh / 3;
        return {
          topLeft: sampleZone(rx + 24, ry + 54, zw - 36, zh - 54),
          topCenter: sampleZone(rx + zw + 12, ry + 54, zw - 24, zh - 54),
          topRight: sampleZone(rx + 2 * zw + 12, ry + 54, zw - 36, zh - 54),
          center: sampleZone(rx + zw + 12, ry + zh + 12, zw - 24, zh - 24),
          bottomCenter: sampleZone(rx + zw + 12, ry + 2 * zh, zw - 24, zh - 60)
        };
      })()`);
    };

    // Wait deterministically for initial state to load in browser
    for (let i = 0; i < 40; i++) {
      const ready = await evalInPage(`Boolean(typeof window.__waitForSceneReady === 'function' && window.currentState)`);
      if (ready) break;
      await sleep(100);
    }
    await evalInPage(`window.__waitForSceneReady ? window.__waitForSceneReady() : Promise.resolve()`);
    await evalInPage(`setSceneMode('C')`);
    await evalInPage(`window.__waitForSceneReady ? window.__waitForSceneReady() : Promise.resolve()`);

    // Helper to teleport & wait deterministically for scene image + verify DOM bounds, A/B layers, and multi-zone composited pixels
    const teleportAndVerifyScene = async (x, y, facing, label, screenshotFile = null) => {
      const info = await evalInPage(`(async () => {
        await triggerTeleport(${x}, ${y}, '${facing}');
        if (window.__waitForSceneReady) {
          await window.__waitForSceneReady();
        }
        const img = document.getElementById('fp-terrain-img');
        const prevImg = document.getElementById('fp-terrain-img-prev');
        const backdrop = document.getElementById('fp-scene-backdrop');
        const imgRect = img ? img.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
        const bdRect = backdrop ? backdrop.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };

        // Sample decoded bitmap luminance as secondary check
        let avgLuma = 0;
        if (img && img.naturalWidth > 0) {
          const c = document.createElement('canvas');
          c.width = 32;
          c.height = 32;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, 32, 32);
          const data = ctx.getImageData(0, 0, 32, 32).data;
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) {
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }
          avgLuma = Number((sum / (32 * 32)).toFixed(2));
        }

        const compStyle = img ? window.getComputedStyle(img) : null;
        const prevStyle = prevImg ? window.getComputedStyle(prevImg) : null;
        const coversViewportCompletely = Boolean(
          bdRect.width > 0 &&
          bdRect.height > 0 &&
          imgRect.left <= bdRect.left + 1 &&
          imgRect.top <= bdRect.top + 1 &&
          imgRect.right >= bdRect.right - 1 &&
          imgRect.bottom >= bdRect.bottom - 1
        );

        return {
          x: currentState.currentTile.x,
          y: currentState.currentTile.y,
          tileName: currentState.currentTile.name,
          facing: currentState.facing,
          povTier: currentState.viewportScene.scenes.C.povTier,
          imageUrl: currentState.viewportScene.scenes.C.imageUrl,
          imgSrc: img ? img.getAttribute('src') : null,
          complete: Boolean(img && img.complete),
          naturalWidth: img ? img.naturalWidth : 0,
          naturalHeight: img ? img.naturalHeight : 0,
          renderedWidth: Math.round(imgRect.width),
          renderedHeight: Math.round(imgRect.height),
          backdropRect: { x: bdRect.x, y: bdRect.y, width: bdRect.width, height: bdRect.height },
          coversViewportCompletely,
          objectFit: compStyle ? compStyle.objectFit : null,
          computedOpacity: compStyle ? compStyle.opacity : '0',
          prevComputedOpacity: prevStyle ? prevStyle.opacity : '0',
          isCrossfadingClass: img ? img.classList.contains('is-crossfading') : false,
          avgLuma,
          modeTag: document.getElementById('fp-scene-mode-tag')?.textContent || '',
          caption: document.getElementById('fp-scene-caption-line')?.textContent || '',
          hasPoiButton: Boolean(document.getElementById('btn-poi-inspect'))
        };
      })()`);

      let shotBase64 = null;
      if (screenshotFile) {
        const captured = await capturePng(screenshotFile);
        shotBase64 = captured.base64;
      } else {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        shotBase64 = shot.data;
      }

      const zones = await verifyScreenshotMultiZoneLuma(shotBase64, info.backdropRect);
      const allZonesRendered =
        zones.topLeft.avgLuma > 5 &&
        zones.topCenter.avgLuma > 5 &&
        zones.topRight.avgLuma > 5 &&
        zones.center.avgLuma > 5 &&
        (zones.topCenter.nonBlackRatio > 0.05 || zones.center.nonBlackRatio > 0.05);

      const ok =
        info.x === x &&
        info.y === y &&
        info.facing === facing &&
        info.complete &&
        info.naturalWidth > 0 &&
        info.renderedWidth > 400 &&
        info.renderedHeight > 200 &&
        info.coversViewportCompletely &&
        info.objectFit === 'cover' &&
        info.avgLuma > 5 &&
        Number(info.computedOpacity) >= 0.99 &&
        Number(info.prevComputedOpacity) === 0 &&
        !info.isCrossfadingClass &&
        allZonesRendered;

      recordCheck('LANDMARK_POV', label, ok, {
        coords: `[${x},${y}] ${facing}`,
        povTier: info.povTier,
        imageUrl: info.imageUrl,
        naturalSize: `${info.naturalWidth}x${info.naturalHeight}`,
        renderedSize: `${info.renderedWidth}x${info.renderedHeight}`,
        coversViewportCompletely: info.coversViewportCompletely,
        avgLuma: info.avgLuma,
        computedOpacity: info.computedOpacity,
        prevComputedOpacity: info.prevComputedOpacity,
        zones,
        screenshot: screenshotFile
      });
      return info;
    };

    // =========================================================================
    // 1. LANDMARKS, SUB-BIOMES, TRANSITIONS & IMPASSABLE BARRIERS
    // =========================================================================
    await teleportAndVerifyScene(7, 7, 'NORTH', 'Oakhaven Sanctuary (7,7) Facing NORTH', '01_oakhaven_7_7_north.png');
    await teleportAndVerifyScene(7, 7, 'EAST',  'Oakhaven Sanctuary (7,7) Facing EAST (River Gate)', '02_oakhaven_7_7_east.png');
    await teleportAndVerifyScene(7, 7, 'SOUTH', 'Oakhaven Sanctuary (7,7) Facing SOUTH (Fen Gate)', '03_oakhaven_7_7_south.png');
    await teleportAndVerifyScene(7, 7, 'WEST',  'Oakhaven Sanctuary (7,7) Facing WEST (Market Square)', '04_oakhaven_7_7_west.png');

    await teleportAndVerifyScene(7, 6, 'NORTH', 'Oakhaven North Gate (7,6) Facing NORTH', '05_north_gate_7_6_north.png');
    await teleportAndVerifyScene(7, 6, 'SOUTH', 'Oakhaven North Gate (7,6) Facing SOUTH', '06_north_gate_7_6_south.png');
    await teleportAndVerifyScene(7, 6, 'EAST',  'Oakhaven North Gate (7,6) Facing EAST Perimeter', '07_north_gate_7_6_east.png');
    await teleportAndVerifyScene(7, 6, 'WEST',  'Oakhaven North Gate (7,6) Facing WEST Perimeter', '08_north_gate_7_6_west.png');

    await teleportAndVerifyScene(7, 8, 'SOUTH', 'Oakhaven South Gate (7,8) Facing SOUTH Toward Fen', '09_south_gate_7_8_south.png');
    await teleportAndVerifyScene(7, 8, 'NORTH', 'Oakhaven South Gate (7,8) Facing NORTH Into Town', '10_south_gate_7_8_north.png');

    await teleportAndVerifyScene(7, 5, 'NORTH', 'Mirkwood Crossroads (7,5) Facing NORTH (Waystone)', '11_crossroads_7_5_north.png');
    await teleportAndVerifyScene(7, 5, 'EAST',  'Mirkwood Crossroads (7,5) Facing EAST Track', '12_crossroads_7_5_east.png');
    await teleportAndVerifyScene(7, 5, 'SOUTH', 'Mirkwood Crossroads (7,5) Facing SOUTH Toward Gate', '13_crossroads_7_5_south.png');
    await teleportAndVerifyScene(7, 5, 'WEST',  'Mirkwood Crossroads (7,5) Facing WEST (Stonefang Crag)', '14_crossroads_7_5_west.png');

    await teleportAndVerifyScene(7, 3, 'NORTH', 'Primeval Black Oak (7,3) Facing NORTH', '15_ancient_oak_7_3_north.png');
    await teleportAndVerifyScene(7, 3, 'SOUTH', 'Primeval Black Oak (7,3) Facing SOUTH Return Trail', '16_ancient_oak_7_3_south.png');

    await teleportAndVerifyScene(8, 7, 'EAST',  'Old Stone Bridge (8,7) Facing EAST Toward Watchpost', '17_bridge_8_7_east.png');
    await teleportAndVerifyScene(8, 7, 'WEST',  'Old Stone Bridge (8,7) Facing WEST Toward Oakhaven', '18_bridge_8_7_west.png');
    await teleportAndVerifyScene(8, 7, 'NORTH', 'Old Stone Bridge (8,7) Facing NORTH Over Parapet', '19_bridge_8_7_north.png');
    await teleportAndVerifyScene(8, 7, 'SOUTH', 'Old Stone Bridge (8,7) Facing SOUTH Over Parapet', '20_bridge_8_7_south.png');

    await teleportAndVerifyScene(9, 7, 'WEST',  'Bridge East Watchpost (9,7) Facing WEST Across Bridge', '21_watchpost_9_7_west.png');
    await teleportAndVerifyScene(9, 7, 'EAST',  'Bridge East Watchpost (9,7) Facing EAST Frontier', '22_watchpost_9_7_east.png');
    await teleportAndVerifyScene(9, 7, 'NORTH', 'Bridge East Watchpost (9,7) Facing NORTH River Gorge', '23_watchpost_9_7_north.png');

    await teleportAndVerifyScene(4, 11, 'NORTH', 'Deadman’s Mire Sunken Ruins (4,11) Facing NORTH', '24_deadmans_mire_4_11_north.png');
    await teleportAndVerifyScene(3, 5, 'WEST',   'Raven Crags Sentinel Cairn (3,5) Facing WEST', '25_raven_crags_3_5.png');
    await teleportAndVerifyScene(12, 4, 'EAST',  'Windblown Heath Monoliths (12,4) Facing EAST', '26_windblown_heath_12_4.png');
    await teleportAndVerifyScene(6, 10, 'SOUTH', 'Rotting Fen Drowned Boardwalk (6,10) Facing SOUTH', '27_rotting_fen_6_10.png');
    await teleportAndVerifyScene(9, 11, 'EAST',  'Venomous Jungle Spore Hollow (9,11) Facing EAST', '28_venomous_jungle_9_11.png');

    await teleportAndVerifyScene(4, 13, 'SOUTH', 'Impassable Barrier: Bottomless Mire (4,13 -> 4,14)', '29_barrier_bottomless_mire.png');
    await teleportAndVerifyScene(13, 7, 'EAST',  'Impassable Barrier: Murksea Cliffs (13,7 -> 14,7)', '30_barrier_murksea_cliffs.png');
    await teleportAndVerifyScene(2, 1, 'NORTH',  'Impassable Barrier: Darkmount Peaks (2,1 -> 2,0)', '31_barrier_darkmount_crags.png');

    // =========================================================================
    // 2. CONTINUOUS MULTI-TILE EXPEDITION ROUTES (Forward & Return)
    // =========================================================================
    const routeResult = await evalInPage(`(async () => {
      await triggerTeleport(7, 7, 'NORTH');
      const visited = [];
      // Walk NORTH from Oakhaven (7,7) -> North Gate (7,6) -> Crossroads (7,5) -> Mirkwood (7,4) -> Ancient Oak (7,3)
      for (let i = 0; i < 4; i++) {
        await dispatchRelativeMove('FORWARD');
        visited.push({ x: currentState.currentTile.x, y: currentState.currentTile.y, facing: currentState.facing, img: currentState.viewportScene.scenes.C.imageUrl });
      }
      // Turn 180° to SOUTH and walk back to Oakhaven (7,7)
      await dispatchTurn('RIGHT');
      await dispatchTurn('RIGHT');
      for (let i = 0; i < 4; i++) {
        await dispatchRelativeMove('FORWARD');
        visited.push({ x: currentState.currentTile.x, y: currentState.currentTile.y, facing: currentState.facing, img: currentState.viewportScene.scenes.C.imageUrl });
      }
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      return {
        finalX: currentState.currentTile.x,
        finalY: currentState.currentTile.y,
        finalFacing: currentState.facing,
        stepsCount: visited.length,
        reachedOak: visited.some(v => v.x === 7 && v.y === 3),
        returnedCity: currentState.currentTile.x === 7 && currentState.currentTile.y === 7
      };
    })()`);
    recordCheck('EXPEDITION_ROUTE', 'Continuous North Expedition (Oakhaven -> Gate -> Crossroads -> Ancient Oak -> Return)', routeResult.reachedOak && routeResult.returnedCity, routeResult);

    // =========================================================================
    // 3. ATMOSPHERIC EFFECTS ENGINE (Off / Subtle / Full)
    // =========================================================================
    await teleportAndVerifyScene(7, 5, 'NORTH', 'Position at Mirkwood Crossroads for Effects Comparison');
    for (const [fxMode, shotName] of [['off', '32_effects_off.png'], ['subtle', '33_effects_subtle.png'], ['full', '34_effects_full.png']]) {
      const fxState = await evalInPage(`(async () => {
        setAtmosphericEffectsMode('${fxMode}');
        await new Promise(r => setTimeout(r, 150));
        return {
          mode: currentEffectsMode,
          particleCount: atmoParticles.length,
          vpHasClass: document.getElementById('fp-viewport').classList.contains('fx-mode-${fxMode}')
        };
      })()`);
      await capturePng(shotName);
      const expectedParticles = fxMode === 'off' ? fxState.particleCount === 0 : fxState.particleCount > 0;
      recordCheck('ATMOSPHERE_FX', `Atmospheric Effects Mode: ${fxMode.toUpperCase()}`, fxState.vpHasClass && expectedParticles, {
        ...fxState,
        screenshot: shotName
      });
    }
    await evalInPage(`setAtmosphericEffectsMode('subtle')`);

    // =========================================================================
    // 4. POINTS OF INTEREST (Inspect [I] Lore Plaque Verification)
    // =========================================================================
    const poiLocations = [
      { x: 7, y: 5, facing: 'NORTH', expectedTitle: 'Runic Waystone', shot: '35_poi_crossroads_waystone.png' },
      { x: 7, y: 3, facing: 'NORTH', expectedTitle: 'Primeval Black Oak', shot: '36_poi_ancient_oak.png' },
      { x: 4, y: 11, facing: 'NORTH', expectedTitle: 'Deadman’s Mire', shot: '37_poi_deadmans_mire.png' }
    ];
    for (const pLoc of poiLocations) {
      const poiRes = await evalInPage(`(async () => {
        await triggerTeleport(${pLoc.x}, ${pLoc.y}, '${pLoc.facing}');
        if (window.__waitForSceneReady) await window.__waitForSceneReady();
        await triggerInspectPoi();
        if (window.__waitForSceneReady) await window.__waitForSceneReady();
        const card = document.getElementById('fp-poi-plaque-card');
        return {
          plaqueOpen: isPoiPlaqueOpen,
          hasCardDom: Boolean(card),
          text: card ? card.innerText : ''
        };
      })()`);
      await capturePng(pLoc.shot);
      recordCheck('POI_INSPECT', `Inspect POI Plaque at [${pLoc.x},${pLoc.y}] (${pLoc.expectedTitle})`, poiRes.plaqueOpen && poiRes.hasCardDom && poiRes.text.includes(pLoc.expectedTitle), {
        screenshot: pLoc.shot
      });
      await evalInPage(`closePoiPlaque()`);
    }

    // =========================================================================
    // 5. MONSTER ENCOUNTERS ACROSS THE WORLD (7 Integrated Cutouts + Card Fallback)
    // =========================================================================
    await evalInPage(`setMonsterPresenceMode('integrated')`);
    const monsterTests = [
      { x: 8, y: 7, facing: 'EAST',  monster: 'Manticore',         expectIntegrated: true,  shot: '38_monster_manticore_bridge.png' },
      { x: 4, y: 11, facing: 'NORTH', monster: 'Ghoul',             expectIntegrated: true,  shot: '39_monster_ghoul_mire.png' },
      { x: 7, y: 5, facing: 'NORTH', monster: 'Assassin Vine',     expectIntegrated: true,  shot: '40_monster_vine_forest.png' },
      { x: 3, y: 5, facing: 'WEST',  monster: 'Wolf',              expectIntegrated: true,  shot: '41_monster_wolf_hills.png' },
      { x: 9, y: 7, facing: 'WEST',  monster: 'Skeletal Champion', expectIntegrated: true,  shot: '42_monster_skeleton_watchpost.png' },
      { x: 7, y: 3, facing: 'NORTH', monster: 'Giant Spider',      expectIntegrated: true,  shot: '43_monster_spider_oak.png' },
      { x: 8, y: 7, facing: 'EAST',  monster: 'Troll',             expectIntegrated: true,  shot: '44_monster_troll_bridge.png' },
      { x: 7, y: 5, facing: 'NORTH', monster: 'Rust Monster',      expectIntegrated: true,  shot: '45_monster_rust_integrated.png' },
      { x: 7, y: 5, facing: 'NORTH', monster: 'Choker',            expectIntegrated: false, shot: '45b_monster_choker_card_fallback.png' }
    ];

    for (const mTest of monsterTests) {
      const mInfo = await evalInPage(`(async () => {
        await triggerTeleport(${mTest.x}, ${mTest.y}, '${mTest.facing}');
        if (window.__waitForSceneReady) await window.__waitForSceneReady();
        await triggerLabScenario('STAGE2_COMBAT', '${mTest.monster}');
        if (window.__waitForSceneReady) await window.__waitForSceneReady();
        const tImg = document.getElementById('fp-terrain-img');
        const mImg = document.querySelector('.fp-monster-img');
        if (mImg && !mImg.complete) {
          await new Promise(r => {
            mImg.addEventListener('load', r, { once: true });
            mImg.addEventListener('error', r, { once: true });
            setTimeout(r, 1500);
          });
        }
        const actor = document.getElementById('fp-monster-actor');
        if (actor) actor.classList.remove('anim-monster-emerge');
        return {
          facing: currentState.facing,
          sceneImageUrl: currentState.viewportScene?.scenes?.C?.imageUrl || null,
          terrainNaturalWidth: tImg ? tImg.naturalWidth : 0,
          monsterName: currentState.encounter?.monsterName,
          isIntegratedDom: actor ? actor.classList.contains('is-integrated-monster') : false,
          isCardDom: actor ? actor.classList.contains('is-card-monster') : false,
          imgSrc: mImg ? mImg.getAttribute('src') : null,
          naturalWidth: mImg ? mImg.naturalWidth : 0,
          contactPatchesDom: document.querySelectorAll('.fp-rig-contact-patch').length
        };
      })()`);
      await capturePng(mTest.shot);
      const modeMatches = mTest.expectIntegrated ? mInfo.isIntegratedDom : mInfo.isCardDom;
      recordCheck('MONSTER_ENCOUNTER', `${mTest.monster} at [${mTest.x},${mTest.y}] (${mTest.expectIntegrated ? 'Integrated Cutout' : 'Safe Card Fallback'})`, modeMatches && mInfo.naturalWidth > 0 && mInfo.terrainNaturalWidth > 0, {
        ...mInfo,
        screenshot: mTest.shot
      });
    }

    // =========================================================================
    // 6. WORLD VISUAL ATLAS & VISUAL QA DEVELOPER MODALS
    // =========================================================================
    const atlasModalInfo = await evalInPage(`(async () => {
      await triggerTeleport(7, 5, 'NORTH');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      openLabModal('atlas');
      for (let i = 0; i < 20; i++) {
        if (document.querySelectorAll('.atlas-cell').length === 225) break;
        await new Promise(r => setTimeout(r, 100));
      }
      await new Promise(r => setTimeout(r, 100));
      return {
        cellCount: document.querySelectorAll('.atlas-cell').length,
        dirCardCount: document.querySelectorAll('.atlas-dir-card').length
      };
    })()`);
    await capturePng('46_world_visual_atlas_modal.png');
    recordCheck('DEV_TOOLS', 'Interactive World Visual Atlas Modal (225 Tiles + 4-Direction Inspector)', atlasModalInfo.cellCount === 225 && atlasModalInfo.dirCardCount === 4, {
      ...atlasModalInfo,
      screenshot: '46_world_visual_atlas_modal.png'
    });

    const qaModalInfo = await evalInPage(`(async () => {
      openLabModal('qa');
      for (let i = 0; i < 20; i++) {
        if (document.querySelectorAll('.qa-card').length >= 15) break;
        await new Promise(r => setTimeout(r, 100));
      }
      await new Promise(r => setTimeout(r, 100));
      return {
        qaCardCount: document.querySelectorAll('.qa-card').length
      };
    })()`);
    await capturePng('47_visual_qa_modal.png');
    recordCheck('DEV_TOOLS', 'Visual QA & Expedition Verification Modal', qaModalInfo.qaCardCount >= 15, {
      ...qaModalInfo,
      screenshot: '47_visual_qa_modal.png'
    });
    await evalInPage(`closeLabModal()`);

    // =========================================================================
    // 7. RESPONSIVE LAYOUT POLISH (1920x1080, 1440x900, 1280x800 Handheld, 1280x720)
    // =========================================================================
    await evalInPage(`(async () => {
      await triggerTeleport(8, 7, 'EAST');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      await triggerLabScenario('STAGE2_COMBAT', 'Manticore');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
    })()`);

    const viewports = [
      { width: 1920, height: 1080, label: 'Desktop 1080p (1920x1080)', shot: '48_responsive_1920x1080.png' },
      { width: 1440, height: 900,  label: 'Laptop 900p (1440x900)',   shot: '49_responsive_1440x900.png' },
      { width: 1280, height: 800,  label: 'Handheld PC / Steam Deck (1280x800)', shot: '50_responsive_1280x800_handheld.png' },
      { width: 1280, height: 720,  label: 'HD 720p (1280x720)',       shot: '51_responsive_1280x720.png' }
    ];

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await evalInPage(`window.__waitForSceneReady ? window.__waitForSceneReady() : Promise.resolve()`);
      const layoutMetrics = await evalInPage(`(() => {
        const docEl = document.documentElement;
        const barEl = document.querySelector('.lab-director-bar');
        const barRect = barEl ? barEl.getBoundingClientRect() : { height: 0 };
        const vpRect = document.getElementById('fp-viewport').getBoundingClientRect();
        const padRect = document.getElementById('pad-forward').getBoundingClientRect();
        return {
          clientWidth: docEl.clientWidth,
          scrollWidth: docEl.scrollWidth,
          clientHeight: docEl.clientHeight,
          scrollHeight: docEl.scrollHeight,
          directorBarHeight: Math.round(barRect.height),
          viewportVisible: vpRect.width > 400 && vpRect.height > 200,
          navPadInBounds: padRect.bottom <= docEl.clientHeight + 2 && padRect.right <= docEl.clientWidth + 2
        };
      })()`);
      await capturePng(vp.shot);
      const noOverflow = layoutMetrics.scrollWidth <= layoutMetrics.clientWidth + 2 &&
                         layoutMetrics.scrollHeight <= layoutMetrics.clientHeight + 2 &&
                         layoutMetrics.directorBarHeight <= 40 &&
                         layoutMetrics.viewportVisible &&
                         layoutMetrics.navPadInBounds;
      recordCheck('RESPONSIVE_LAYOUT', vp.label, noOverflow, {
        ...layoutMetrics,
        screenshot: vp.shot
      });
    }

    // Restore 1600x940 viewport for Adventure Experience E2E Journeys
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 940,
      deviceScaleFactor: 1,
      mobile: false
    });
    await evalInPage(`window.__waitForSceneReady ? window.__waitForSceneReady() : Promise.resolve()`);

    // =========================================================================
    // 8. PHASE 1 REGRESSIONS & ADVENTURE EXPERIENCE REAL BROWSER JOURNEYS (1-10)
    // =========================================================================

    // 8.1 Phase 2.2 Duplicate Notification Deduplication Check
    const dedupeCheck = await evalInPage(`(async () => {
      await triggerTeleport(7, 5, 'NORTH');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      spawnFloatingPopup('🏛️ LANDMARK INSPECTED', 'pop-strike');
      spawnFloatingPopup('🏛️ LANDMARK INSPECTED', 'pop-strike');
      const pops = Array.from(document.querySelectorAll('.floating-pop'));
      return {
        popupCount: pops.length,
        texts: pops.map(p => p.textContent)
      };
    })()`);
    recordCheck('PHASE1_REGRESSION', 'Duplicate Notification Deduplication (Single LANDMARK INSPECTED popup)', dedupeCheck.popupCount === 1, dedupeCheck);

    // 8.2 Phase 2.3 POI Line-of-Sight DOM Visibility Check
    const losCheck = await evalInPage(`(async () => {
      await triggerTeleport(7, 5, 'NORTH');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      const northPrompt = document.getElementById('btn-poi-inspect')?.textContent.trim() || null;
      await dispatchTurn('LEFT'); // Facing WEST -> Stonefang Crag
      const westPrompt = document.getElementById('btn-poi-inspect')?.textContent.trim() || null;
      await dispatchTurn('LEFT'); // Facing SOUTH -> no POI
      const southPrompt = document.getElementById('btn-poi-inspect')?.textContent.trim() || null;
      await triggerTeleport(7, 3, 'SOUTH'); // Ancient Oak facing SOUTH -> no POI
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      const oakSouthPrompt = document.getElementById('btn-poi-inspect')?.textContent.trim() || null;
      return { northPrompt, westPrompt, southPrompt, oakSouthPrompt };
    })()`);
    const losOk = Boolean(
      losCheck.northPrompt && losCheck.northPrompt.includes('Inspect Runestone') &&
      losCheck.westPrompt && losCheck.westPrompt.includes('Inspect Stonefang Crag') &&
      losCheck.southPrompt === null &&
      losCheck.oakSouthPrompt === null
    );
    recordCheck('PHASE1_REGRESSION', 'POI Line-of-Sight DOM Visibility (Crossroads N vs W vs S & Ancient Oak S)', losOk, losCheck);

    // 8.3 Journey 1: Current Experience (Baseline) Mirkwood Walk
    const journey1 = await evalInPage(`(async () => {
      await resetExpeditionRoute(true);
      await setAdventureExperienceMode(false);
      await dispatchRelativeMove('FORWARD'); // (7,6)
      await dispatchRelativeMove('FORWARD'); // (7,5)
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      return {
        enabled: currentState.adventure.enabled,
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        hasDiscoveryDom: !document.getElementById('fp-discovery-layer').hidden,
        hasExpPillDom: Boolean(document.getElementById('btn-expedition-pill'))
      };
    })()`);
    await captureAdventurePng('01_current_experience_baseline_7_5.png');
    recordCheck('ADVENTURE_JOURNEY', 'Journey 1: Current Experience Baseline Walk (Clean HUD without Experimental Overlays)', !journey1.enabled && !journey1.hasDiscoveryDom && !journey1.hasExpPillDom, {
      ...journey1,
      screenshot: 'adventure/01_current_experience_baseline_7_5.png'
    });

    // 8.4 Journey 2, 5 & 6: Mirkwood Expedition in Adventure Experience (Noticeable & Important Discoveries, Choice & Ignore)
    const journey2Step1 = await evalInPage(`(async () => {
      await startExpeditionRoute('MIRKWOOD_EXPEDITION');
      await setDeterministicSeed(42);
      await dispatchRelativeMove('FORWARD'); // (7,6) North Gate
      await dispatchRelativeMove('FORWARD'); // (7,5) Crossroads -> Noticeable Discovery: Notched Ranger Tally-Post
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      return {
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        discId: currentState.adventure.activeDiscovery?.id || null,
        discTier: currentState.adventure.activeDiscovery?.tier || null,
        ribbonVisible: Boolean(document.getElementById('fp-discovery-ribbon'))
      };
    })()`);
    await captureAdventurePng('02_adventure_mirkwood_crossroads_discovery_7_5.png');
    recordCheck('ADVENTURE_JOURNEY', 'Journey 2a: Mirkwood Crossroads Noticeable Discovery Ribbon (7,5)', journey2Step1.discId === 'disc_crossroads_frontier_sign' && journey2Step1.ribbonVisible, {
      ...journey2Step1,
      screenshot: 'adventure/02_adventure_mirkwood_crossroads_discovery_7_5.png'
    });

    // Journey 6: Walk past [7,5] without clicking a choice -> arrives at [7,4] Abandoned Scout Camp (IMPORTANT)
    const journey2Step2 = await evalInPage(`(async () => {
      await dispatchRelativeMove('FORWARD'); // (7,4) Mirkwood Trail -> Important Discovery: Abandoned Scout Camp
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      return {
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        discId: currentState.adventure.activeDiscovery?.id || null,
        discTier: currentState.adventure.activeDiscovery?.tier || null,
        cardVisible: Boolean(document.getElementById('fp-discovery-card')),
        choiceCount: document.querySelectorAll('.btn-discovery-choice').length
      };
    })()`);
    await captureAdventurePng('03_adventure_mirkwood_trail_important_card_7_4.png');
    recordCheck('ADVENTURE_JOURNEY', 'Journey 2b & 6: Walk Past Unresolved Discovery & Trigger Important Camp Card at [7,4]', journey2Step2.discId === 'disc_mirkwood_abandoned_camp' && journey2Step2.cardVisible && journey2Step2.choiceCount === 3, {
      ...journey2Step2,
      screenshot: 'adventure/03_adventure_mirkwood_trail_important_card_7_4.png'
    });

    // Journey 5: Resolve contextual choice on [7,4] Abandoned Scout Camp
    const journey5Choice = await evalInPage(`(async () => {
      await resolveDiscoveryChoiceClick('disc_mirkwood_abandoned_camp', 'inspect_campsite');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      return {
        activeDisc: currentState.adventure.activeDiscovery,
        lastResTitle: currentState.adventure.lastChoiceResolution?.outcomeTitle || null,
        outcomeBannerVisible: Boolean(document.getElementById('fp-discovery-outcome'))
      };
    })()`);
    await captureAdventurePng('04_adventure_choice_outcome_7_4.png');
    recordCheck('ADVENTURE_JOURNEY', 'Journey 5: Contextual Choice Resolution & Outcome Banner at [7,4]', journey5Choice.activeDisc === null && journey5Choice.outcomeBannerVisible, {
      ...journey5Choice,
      screenshot: 'adventure/04_adventure_choice_outcome_7_4.png'
    });

    // Continue to [7,3] Primeval Black Oak -> Warden's Hollow discovery + return to Oakhaven [7,7]
    const journey2Complete = await evalInPage(`(async () => {
      await dispatchRelativeMove('FORWARD'); // (7,3) Primeval Black Oak
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      const oakDiscId = currentState.adventure.activeDiscovery?.id || null;
      await resolveDiscoveryChoiceClick('disc_ancient_oak_sap_shrine', 'examine_warden_oath');
      // Return to Oakhaven (7,7)
      await dispatchTurn('RIGHT');
      await dispatchTurn('RIGHT');
      for (let i = 0; i < 4; i++) {
        await dispatchRelativeMove('FORWARD');
      }
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      return {
        oakDiscId,
        finalX: currentState.currentTile.x,
        finalY: currentState.currentTile.y,
        isComplete: currentState.adventure.expedition.isComplete
      };
    })()`);
    recordCheck('ADVENTURE_JOURNEY', 'Journey 2c: Complete Mirkwood Expedition at Primeval Black Oak [7,3] & Return to Oakhaven [7,7]', journey2Complete.oakDiscId === 'disc_ancient_oak_sap_shrine' && journey2Complete.isComplete, journey2Complete);

    // 8.5 Journey 3: The Old Stone Bridge & Ruined Watchpost Expedition ([7,7] -> [8,7] -> [9,7])
    const journey3 = await evalInPage(`(async () => {
      await startExpeditionRoute('BRIDGE_EXPEDITION');
      await dispatchRelativeMove('FORWARD'); // (8,7) Old Stone Bridge
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      const bridgeDisc = currentState.adventure.activeDiscovery?.id || null;
      await dispatchRelativeMove('FORWARD'); // (9,7) Bridge East Watchpost
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      return {
        bridgeDisc,
        watchpostX: currentState.currentTile.x,
        watchpostY: currentState.currentTile.y,
        watchpostDisc: currentState.adventure.activeDiscovery?.id || null
      };
    })()`);
    await captureAdventurePng('05_adventure_watchpost_ruins_9_7.png');
    recordCheck('ADVENTURE_JOURNEY', 'Journey 3: Bridge & Ruined Watchpost Expedition ([7,7] -> [8,7] -> [9,7])', journey3.bridgeDisc === 'disc_bridge_parapet_gouges' && journey3.watchpostDisc === 'disc_watchpost_garrison_ledger', {
      ...journey3,
      screenshot: 'adventure/05_adventure_watchpost_ruins_9_7.png'
    });

    // 8.6 Journey 4: Into the Rotten Lands ([7,7] -> [7,8] -> [6,10] -> [4,11] Deadman's Mire)
    const journey4 = await evalInPage(`(async () => {
      await startExpeditionRoute('ROTTEN_LANDS_EXPEDITION');
      const dirs = ['SOUTH', 'SOUTH', 'WEST', 'SOUTH', 'WEST', 'WEST', 'SOUTH'];
      for (const d of dirs) {
        await dispatchAction('MOVE', { direction: d });
      }
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      return {
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        mireDisc: currentState.adventure.activeDiscovery?.id || null
      };
    })()`);
    await captureAdventurePng('06_adventure_deadmans_mire_4_11.png');
    recordCheck('ADVENTURE_JOURNEY', 'Journey 4: Into the Rotten Lands Legal Walk to Deadman’s Mire [4,11]', journey4.x === 4 && journey4.y === 11 && journey4.mireDisc === 'disc_mire_drowned_altar', {
      ...journey4,
      screenshot: 'adventure/06_adventure_deadmans_mire_4_11.png'
    });

    // 8.7 Journey 7: Combat Readability & Giant Spider Cutout Polish at [7,3]
    const spiderCombatInfo = await evalInPage(`(async () => {
      await triggerTeleport(7, 3, 'NORTH');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      await triggerLabScenario('STAGE2_COMBAT', 'Giant Spider');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      const actor = document.getElementById('fp-monster-actor');
      if (actor) actor.classList.remove('anim-monster-emerge');
      const box = document.querySelector('.fp-monster-portrait-box');
      const boxRect = box ? box.getBoundingClientRect() : { width: 0, height: 0 };
      const tacticalChips = document.querySelectorAll('.fp-tactical-chip').length;
      return {
        boxWidth: Math.round(boxRect.width),
        boxHeight: Math.round(boxRect.height),
        tacticalChips,
        contactPatches: document.querySelectorAll('.fp-rig-contact-patch').length
      };
    })()`);
    await captureAdventurePng('07_combat_giant_spider_polished_7_3.png');
    recordCheck('ADVENTURE_JOURNEY', 'Journey 7: Giant Spider Cutout Scale Polish & Combat Tactical Readout Strip at [7,3]', spiderCombatInfo.boxWidth >= 220 && spiderCombatInfo.tacticalChips === 3 && spiderCombatInfo.contactPatches === 4, {
      ...spiderCombatInfo,
      screenshot: 'adventure/07_combat_giant_spider_polished_7_3.png'
    });

    // 8.8 Journey 8: Expedition Journal Modal (`[L]`) & Director Modal (`[G]`)
    await evalInPage(`(async () => {
      await triggerTeleport(7, 7, 'NORTH');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      openLabModal('journal');
      await new Promise(r => setTimeout(r, 100));
    })()`);
    await captureAdventurePng('08_expedition_journal_modal.png');
    const journalModalDom = await evalInPage(`({
      expCards: document.querySelectorAll('.journal-exp-card').length,
      waypoints: document.querySelectorAll('.journal-waypoint-row').length,
      logEntries: document.querySelectorAll('.journal-log-entry').length
    })`);
    recordCheck('ADVENTURE_JOURNEY', 'Journey 8a: Expedition Journal Modal [L] (Routes, Waypoints & Adventure Memory)', journalModalDom.expCards === 3 && journalModalDom.waypoints >= 4 && journalModalDom.logEntries >= 1, {
      ...journalModalDom,
      screenshot: 'adventure/08_expedition_journal_modal.png'
    });

    await evalInPage(`(async () => {
      openLabModal('director');
      await new Promise(r => setTimeout(r, 100));
    })()`);
    await captureAdventurePng('09_lab_director_modal.png');
    const directorModalDom = await evalInPage(`({
      cards: document.querySelectorAll('.director-modal-grid .qa-card').length
    })`);
    recordCheck('ADVENTURE_JOURNEY', 'Journey 8b: Lab Director Modal [G] (Scenarios, Monsters, Discoveries & Seeds)', directorModalDom.cards === 4, {
      ...directorModalDom,
      screenshot: 'adventure/09_lab_director_modal.png'
    });
    await evalInPage(`closeLabModal()`);

    // 8.9 Journey 9 & 10: Responsive Adventure Mode Screenshots (1920x1080 & 1280x720)
    await evalInPage(`(async () => {
      await triggerTeleport(7, 4, 'NORTH');
      await forceTriggerDiscovery('disc_mirkwood_abandoned_camp');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
    })()`);
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await evalInPage(`window.__waitForSceneReady ? window.__waitForSceneReady() : Promise.resolve()`);
    await captureAdventurePng('10_responsive_adventure_1280x720.png');
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await evalInPage(`window.__waitForSceneReady ? window.__waitForSceneReady() : Promise.resolve()`);
    await captureAdventurePng('11_responsive_adventure_1920x1080.png');

    // =========================================================================
    // 9. PHASE 2.5B RENDERING INTEGRITY: RAPID CROSSFADE STRESS, REDUCED MOTION & ZERO ERRORS
    // =========================================================================
    const stressResult = await evalInPage(`(async () => {
      await setAdventureExperienceMode(false);
      await triggerTeleport(7, 5, 'NORTH');
      // Rapid turns & forest steps without waiting for crossfades to finish between inputs
      await dispatchTurn('RIGHT');
      await dispatchTurn('RIGHT');
      await dispatchTurn('RIGHT');
      await dispatchTurn('RIGHT');
      await dispatchRelativeMove('FORWARD'); // (7,4)
      await dispatchRelativeMove('BACKWARD'); // (7,5)
      await dispatchTurn('LEFT');
      await dispatchTurn('RIGHT');
      if (window.__waitForSceneReady) {
        await window.__waitForSceneReady();
      }
      const img = document.getElementById('fp-terrain-img');
      const prevImg = document.getElementById('fp-terrain-img-prev');
      const bd = document.getElementById('fp-scene-backdrop');
      const imgRect = img.getBoundingClientRect();
      const bdRect = bd.getBoundingClientRect();
      return {
        x: currentState.currentTile.x,
        y: currentState.currentTile.y,
        facing: currentState.facing,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        computedOpacity: window.getComputedStyle(img).opacity,
        prevComputedOpacity: window.getComputedStyle(prevImg).opacity,
        isCrossfadingClass: img.classList.contains('is-crossfading'),
        coversViewportCompletely:
          imgRect.left <= bdRect.left + 1 &&
          imgRect.top <= bdRect.top + 1 &&
          imgRect.right >= bdRect.right - 1 &&
          imgRect.bottom >= bdRect.bottom - 1,
        backdropRect: { x: bdRect.x, y: bdRect.y, width: bdRect.width, height: bdRect.height }
      };
    })()`);
    const stressShot = await send('Page.captureScreenshot', { format: 'png' });
    const stressZones = await verifyScreenshotMultiZoneLuma(stressShot.data, stressResult.backdropRect);
    const stressPassed =
      stressResult.x === 7 &&
      stressResult.y === 5 &&
      stressResult.facing === 'NORTH' &&
      stressResult.complete &&
      stressResult.naturalWidth > 0 &&
      Number(stressResult.computedOpacity) >= 0.99 &&
      Number(stressResult.prevComputedOpacity) === 0 &&
      !stressResult.isCrossfadingClass &&
      stressResult.coversViewportCompletely &&
      stressZones.topLeft.avgLuma > 5 &&
      stressZones.topCenter.avgLuma > 5 &&
      stressZones.topRight.avgLuma > 5 &&
      stressZones.center.avgLuma > 5;
    recordCheck('PHASE2_5B_INTEGRITY', 'Rapid Movement & Crossfade Stress Test (Zero Black/Partial Tiles, Clean A/B Layer State)', stressPassed, {
      ...stressResult,
      zones: stressZones
    });

    // Reduced-motion check
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    const reducedMotionResult = await evalInPage(`(async () => {
      await triggerTeleport(7, 7, 'NORTH');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      await triggerTeleport(7, 5, 'EAST');
      if (window.__waitForSceneReady) await window.__waitForSceneReady();
      const img = document.getElementById('fp-terrain-img');
      const prevImg = document.getElementById('fp-terrain-img-prev');
      return {
        reducedMotionActive: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        computedOpacity: window.getComputedStyle(img).opacity,
        prevComputedOpacity: window.getComputedStyle(prevImg).opacity,
        isCrossfadingClass: img.classList.contains('is-crossfading')
      };
    })()`);
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
    });
    recordCheck('PHASE2_5B_INTEGRITY', 'Prefers-Reduced-Motion Scene Transition Verification',
      reducedMotionResult.reducedMotionActive &&
      reducedMotionResult.complete &&
      reducedMotionResult.naturalWidth > 0 &&
      Number(reducedMotionResult.computedOpacity) >= 0.99 &&
      Number(reducedMotionResult.prevComputedOpacity) === 0 &&
      !reducedMotionResult.isCrossfadingClass,
      reducedMotionResult
    );

    // Zero Console/Page Exceptions & Zero Failed Image Requests
    recordCheck('PHASE2_5B_INTEGRITY', 'Zero Console/Page Exceptions & Zero Failed Image Requests',
      consoleErrors.length === 0 && pageExceptions.length === 0 && failedImageRequests.length === 0,
      {
        consoleErrorsCount: consoleErrors.length,
        pageExceptionsCount: pageExceptions.length,
        failedImageRequestsCount: failedImageRequests.length
      }
    );

    ws.close();
  } finally {
    try { chromeProc.kill(); } catch {}
    try { server.close(); } catch {}
    await sleep(300);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  const passedChecks = checks.filter(c => c.passed).length;
  const failedChecks = checks.filter(c => !c.passed).length;
  const summaryReport = {
    generatedAt: new Date().toISOString(),
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    allPassed: failedChecks === 0,
    screenshotDirectory: 'action-ui-lab/docs/screenshots/expedition',
    checks
  };

  const outJsonPath = path.join(__dirname, '../docs/visual-qa-results.json');
  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(outJsonPath, JSON.stringify(summaryReport, null, 2));

  console.log(`\n===========================================================`);
  console.log(` VISUAL QA SUMMARY: ${passedChecks}/${checks.length} checks PASSED`);
  console.log(` Results saved to: ${outJsonPath}`);
  console.log(`===========================================================\n`);

  if (failedChecks > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runVisualRegressionSuite().catch(err => {
    console.error('Fatal error in visual regression suite:', err);
    process.exit(1);
  });
}

module.exports = { runVisualRegressionSuite };
