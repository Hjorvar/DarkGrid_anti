/**
 * DARKGRID PHASE 10 — Gamepad API Controls & Headless Browser QA Suite
 *
 * Verifies:
 *  1. Standard Gamepad mapping, Xbox Controller & Lenovo Legion Go 2 TrueStrike Controller profiles & HUD pill (.gamepad-status-pill)
 *  2. D-Pad (buttons[12..15]) & Left Analog Stick (axes[0..1], deadzone 0.45) movement in Overworld & Dungeons with repeat/debounce & busy lock
 *  3. Landmark interaction (A to enter dungeon / interact, B to dismiss landmark scene)
 *  4. Stage 1 (Encounter Secrecy: A = Fight, B/X = Avoid) & Stage 2 (Active Combat: D-Pad focus + A, X = Class Ability, Y = Potion, B = Flee, LB = Stance)
 *  5. Modal Drawers & .gamepad-focus navigation across Hero (+1 attribute spend), Inventory/Equipment, Oakhaven Shop, Quests/Bounties, and Region Map [M]
 *  6. 100% Keyboard & Mouse coexistence and English-only player-facing UI text
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { createLabApp } = require('../server');
const { GOBLIN_CAVE_COORD } = require('../server/services/topdown-world-service');

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
      res.on('data', chunk => {
        data += chunk;
      });
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
  for (let i = 0; i < 45; i++) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
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
            pageExceptions.push(
              msg.params && msg.params.exceptionDetails ? msg.params.exceptionDetails.text : 'Unknown exception'
            );
          }
        });

        const send = (method, params = {}) =>
          new Promise((resolve, reject) => {
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

describe('Phase 10 — Gamepad API Controls (Xbox & Lenovo Legion Go 2) & Headless Browser QA', () => {
  const gamepadJsPath = path.join(__dirname, '..', 'public', 'js', 'ui', 'gamepad.js');
  const shortcutsJsPath = path.join(__dirname, '..', 'public', 'js', 'ui', 'shortcuts.js');
  const componentsCssPath = path.join(__dirname, '..', 'public', 'css', 'components.css');

  let server;
  let db;
  let baseUrl;
  let chromeProc;
  let cdp;

  before(async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkgrid-phase10-gamepad-'));
    const dbPath = path.join(tmpDir, 'phase10-gamepad.db');
    const tmpProfile = path.join(tmpDir, 'chrome-profile');
    fs.mkdirSync(tmpProfile, { recursive: true });

    const app = createLabApp({ dbPath, allowLabTools: true, rng: () => 0.55 });
    db = app.locals.db;
    server = await new Promise(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/`;

    const chromeBin = findChromeBinary();
    assert.ok(chromeBin, 'Chrome or Edge binary must be available for headless Gamepad QA');
    const debugPort = 9400 + Math.floor(Math.random() * 400);

    chromeProc = spawn(
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

    cdp = await connectCdp(debugPort);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Wait for application and gamepad engine to initialize across initial navigation
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        ready = await evalInPage(
          'Boolean(window.currentState && window.DarkgridGamepad && typeof window.stepGamepadFrame === "function")'
        );
        if (ready) break;
      } catch {
        // Ignore transient Execution context was destroyed during initial page load
      }
      await sleep(100);
    }
    assert.equal(ready, true, 'Darkgrid frontend and Gamepad engine initialized in headless browser');
  });

  after(async () => {
    if (cdp && cdp.ws) {
      try {
        cdp.ws.close();
      } catch {
        // ignore
      }
    }
    if (chromeProc) {
      try {
        chromeProc.kill();
      } catch {
        // ignore
      }
    }
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (db) {
      try {
        db.close();
      } catch {
        // ignore
      }
    }
  });

  async function evalInPage(expr) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception
        ? res.exceptionDetails.exception.description || res.exceptionDetails.text
        : res.exceptionDetails.text;
      throw new Error(`Browser eval exception: ${desc}`);
    }
    return res.result ? res.result.value : undefined;
  }

  it('1. Architecture, Wiring & CSS: gamepad.js, shortcuts.js, and components.css define required classes & English-only UI', () => {
    assert.equal(fs.existsSync(gamepadJsPath), true, 'gamepad.js must exist');
    const gamepadSrc = fs.readFileSync(gamepadJsPath, 'utf8');
    const shortcutsSrc = fs.readFileSync(shortcutsJsPath, 'utf8');
    const cssSrc = fs.readFileSync(componentsCssPath, 'utf8');

    assert.ok(shortcutsSrc.includes("import { initGamepad } from './gamepad.js'"), 'shortcuts.js must import initGamepad');
    assert.ok(shortcutsSrc.includes('initGamepad()'), 'shortcuts.js must call initGamepad()');
    assert.ok(cssSrc.includes('.gamepad-focus'), 'components.css must define .gamepad-focus');
    assert.ok(cssSrc.includes('.gamepad-status-pill'), 'components.css must define .gamepad-status-pill');

    // Verify no Icelandic characters leak into player-facing strings in gamepad.js
    assert.equal(/[þæöðáéíóúýÞÆÖÐÁÉÍÓÚÝ]/.test(gamepadSrc), false, 'All UI text in gamepad.js must be English-only');
  });

  it('2. Controller Profiles & HUD Status Pill: Detects Xbox, Lenovo Legion Go 2 (including dual detached pads), and Standard Gamepads via navigator.getGamepads()', async () => {
    const profileCheck = await evalInPage(`(async () => {
      window.resetGamepadState();

      // 1. Mock navigator.getGamepads() with a Lenovo Legion Go 2 TrueStrike controller
      let activePads = [
        window.createMockGamepad({
          id: 'Lenovo Legion Go 2 TrueStrike Controller (XInput STANDARD GAMEPAD)',
          mapping: 'standard'
        })
      ];
      navigator.getGamepads = () => activePads;

      const legionSnap = await window.stepGamepadFrame(null, 2000);

      // 2. Switch to an Xbox Wireless Controller
      activePads = [
        window.createMockGamepad({
          id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b12)',
          mapping: 'standard'
        })
      ];
      const xboxSnap = await window.stepGamepadFrame(null, 2100);

      // 3. Test detached dual-controller mode (Left pad + Right pad in slots 0 and 1)
      activePads = [
        window.createMockGamepad({
          id: 'Lenovo Legion Go Left TrueStrike',
          mapping: '',
          axes: [0, -0.85, 0, 0]
        }),
        window.createMockGamepad({
          id: 'Lenovo Legion Go Right TrueStrike',
          mapping: '',
          pressedButtons: ['A']
        })
      ];
      const dualDir = window.resolveDirectionalInput({
        buttons: new Array(17).fill(false),
        axes: [0, -0.85, 0, 0]
      });

      // 4. Disconnect all gamepads
      activePads = [null, null, null, null];
      const disconnectedSnap = await window.stepGamepadFrame(null, 2200);

      return {
        legionSnap,
        xboxSnap,
        dualDir,
        disconnectedSnap
      };
    })()`);

    assert.equal(profileCheck.legionSnap.connected, true);
    assert.equal(profileCheck.legionSnap.profile.profileKey, 'LEGION_GO');
    assert.equal(profileCheck.legionSnap.pillVisible, true);
    assert.match(profileCheck.legionSnap.pillText, /Legion Go Controller/i);

    assert.equal(profileCheck.xboxSnap.connected, true);
    assert.equal(profileCheck.xboxSnap.profile.profileKey, 'XBOX');
    assert.equal(profileCheck.xboxSnap.pillVisible, true);
    assert.match(profileCheck.xboxSnap.pillText, /Xbox Controller/i);

    assert.equal(profileCheck.dualDir.direction, 'NORTH');
    assert.equal(profileCheck.dualDir.source, 'LEFT_STICK');

    assert.equal(profileCheck.disconnectedSnap.connected, false);
    assert.equal(profileCheck.disconnectedSnap.pillVisible, false);
  });

  it('3. Overworld Movement, Deadzone (0.45) & Repeat/Debounce: D-Pad (buttons[12..15]) and Left Stick (axes[0..1]) move hero smoothly without double-submits', async () => {
    const moveCheck = await evalInPage(`(async () => {
      await window.dispatchAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
      await window.dispatchAction('TELEPORT_TO_TILE', { x: 15, y: 26, facing: 'NORTH' });
      await window.dispatchAction('SET_DETERMINISTIC_SEED', { seed: 4201 });
      window.resetGamepadState();

      const startCoord = { x: window.currentState.currentTile.x, y: window.currentState.currentTile.y };

      // 1. Sub-deadzone stick tilt (0.30 < 0.45) must NOT trigger movement
      const belowDeadzonePad = window.createMockGamepad({
        id: 'Lenovo Legion Go 2 TrueStrike Controller',
        axes: [0, -0.30, 0, 0]
      });
      await window.stepGamepadFrame([belowDeadzonePad], 3000);
      const afterBelowDeadzone = { x: window.currentState.currentTile.x, y: window.currentState.currentTile.y };

      // 2. D-Pad Up (buttons[12]) triggers immediate NORTH step on first press ([15,26] -> [15,25])
      const dpadNorthPad = window.createMockGamepad({
        id: 'Lenovo Legion Go 2 TrueStrike Controller',
        pressedButtons: [12]
      });
      await window.stepGamepadFrame([dpadNorthPad], 3100);
      if (window.currentState.encounter && window.currentState.encounter.status === 'DISCOVERED') {
        await window.dispatchAction('AVOID');
      }
      const afterFirstDpadUp = { x: window.currentState.currentTile.x, y: window.currentState.currentTile.y };

      // 3. Holding D-Pad Up only 80ms later (< 195ms repeat delay) must NOT trigger a second step
      await window.stepGamepadFrame([dpadNorthPad], 3180);
      const afterEarlyHold = { x: window.currentState.currentTile.x, y: window.currentState.currentTile.y };

      // 4. Holding D-Pad Up after >= 200ms (>= 195ms repeat delay) triggers the next NORTH step ([15,25] -> [15,24])
      await window.stepGamepadFrame([dpadNorthPad], 3320);
      if (window.currentState.activeDiscovery) {
        await window.dispatchAction('DISMISS_DISCOVERY');
      }
      if (window.currentState.encounter) {
        await window.dispatchAction(window.currentState.encounter.status === 'DISCOVERED' ? 'AVOID' : 'FLEE');
      }
      const afterRepeatHold = { x: window.currentState.currentTile.x, y: window.currentState.currentTile.y };

      // Release D-Pad
      const neutralPad = window.createMockGamepad({ id: 'Lenovo Legion Go 2 TrueStrike Controller' });
      await window.stepGamepadFrame([neutralPad], 3360);

      // 5. Left Analog Stick South (axes[1] = +0.85 > 0.45 deadzone) steps SOUTH ([15,24] -> [15,25])
      const stickSouthPad = window.createMockGamepad({
        id: 'Lenovo Legion Go 2 TrueStrike Controller',
        axes: [0, 0.85, 0, 0]
      });
      await window.stepGamepadFrame([stickSouthPad], 3600);
      if (window.currentState.activeDiscovery) {
        await window.dispatchAction('DISMISS_DISCOVERY');
      }
      if (window.currentState.encounter) {
        await window.dispatchAction(window.currentState.encounter.status === 'DISCOVERED' ? 'AVOID' : 'FLEE');
      }
      const afterStickSouth = { x: window.currentState.currentTile.x, y: window.currentState.currentTile.y };

      return {
        startCoord,
        afterBelowDeadzone,
        afterFirstDpadUp,
        afterEarlyHold,
        afterRepeatHold,
        afterStickSouth
      };
    })()`);

    assert.deepEqual(moveCheck.startCoord, { x: 15, y: 26 });
    assert.deepEqual(moveCheck.afterBelowDeadzone, { x: 15, y: 26 }, 'Stick below 0.45 deadzone must not move hero');
    assert.deepEqual(moveCheck.afterFirstDpadUp, { x: 15, y: 25 }, 'First D-Pad Up press immediately moves NORTH');
    assert.deepEqual(moveCheck.afterEarlyHold, { x: 15, y: 25 }, 'Holding D-Pad before repeat delay (80ms < 195ms) must not double-step');
    assert.deepEqual(moveCheck.afterRepeatHold, { x: 15, y: 24 }, 'Holding D-Pad past repeat delay (>= 195ms) smoothly steps again');
    assert.deepEqual(moveCheck.afterStickSouth, { x: 15, y: 25 }, 'Left Analog Stick South (> 0.45) steps SOUTH');
  });

  it('4. Landmarks & Dungeons via Gamepad: B dismisses landmark scene, A enters Goblin Cave, D-Pad explores dungeon, and A exits stairs', async () => {
    const dungeonCheck = await evalInPage(`(async () => {
      await window.dispatchAction('LAB_SCENARIO', { scenario: 'RESET_WORLD' });
      await window.dispatchAction('TELEPORT_TO_TILE', { x: ${GOBLIN_CAVE_COORD.x - 1}, y: ${GOBLIN_CAVE_COORD.y}, facing: 'EAST' });
      window.resetGamepadState();

      // Step EAST onto Goblin Cave [9, 12] using D-Pad Right (buttons[15])
      await window.simulateGamepadDirection('EAST');
      const landmarkOpenOnArrival = Boolean(window.currentState.landmarkScene && window.currentState.landmarkScene.isActive);

      // Press B (buttons[1]) to dismiss Landmark Scene overlay
      await window.simulateGamepadButtonPress('B');
      const landmarkAfterDismiss = Boolean(window.currentState.landmarkScene && window.currentState.landmarkScene.isActive);

      // Press A (buttons[0]) on the Goblin Cave entrance card (#btn-explore-goblin-cave) to delve into the dungeon!
      await window.simulateGamepadButtonPress('A');
      const inDungeonStart = Boolean(window.currentState.dungeonMap && window.currentState.dungeonMap.inDungeon);
      const startDungeonPos = {
        x: window.currentState.dungeonMap?.heroX,
        y: window.currentState.dungeonMap?.heroY
      };

      // Use Left Stick NORTH (axes[1] = -0.9) to walk 1 tile deeper into the Goblin Cave ([3,16] -> [3,15])
      await window.simulateGamepadDirection('NORTH', { useStick: true, magnitude: 0.9 });
      const afterDungeonStepNorth = {
        x: window.currentState.dungeonMap?.heroX,
        y: window.currentState.dungeonMap?.heroY
      };

      // If a random dungeon encounter or discovery triggered on [3,15], dismiss/evade it with Gamepad B
      if (window.currentState.encounter || window.currentState.activeDiscovery) {
        await window.simulateGamepadButtonPress('B');
      }

      // Step SOUTH back onto the exit stairs ([3,15] -> [3,16]) using D-Pad Down
      await window.simulateGamepadDirection('SOUTH');
      if (window.currentState.encounter || window.currentState.activeDiscovery) {
        await window.simulateGamepadButtonPress('B');
      }
      const backAtExitTile = Boolean(window.currentState.dungeonMap?.atExitTile);

      // Press A (buttons[0]) to activate #btn-exit-dungeon and ascend to the Overworld
      await window.simulateGamepadButtonPress('A');
      const exitedToOverworld = !Boolean(window.currentState.dungeonMap && window.currentState.dungeonMap.inDungeon);
      const overworldCoord = { x: window.currentState.currentTile.x, y: window.currentState.currentTile.y };

      return {
        landmarkOpenOnArrival,
        landmarkAfterDismiss,
        inDungeonStart,
        startDungeonPos,
        afterDungeonStepNorth,
        backAtExitTile,
        exitedToOverworld,
        overworldCoord
      };
    })()`);

    assert.equal(dungeonCheck.landmarkOpenOnArrival, true, 'Stepping onto Goblin Cave opens landmark scene');
    assert.equal(dungeonCheck.landmarkAfterDismiss, false, 'Pressing B dismisses landmark scene overlay');
    assert.equal(dungeonCheck.inDungeonStart, true, 'Pressing A at Goblin Cave entrance delves into dungeon');
    assert.deepEqual(dungeonCheck.startDungeonPos, { x: 3, y: 16 });
    assert.deepEqual(dungeonCheck.afterDungeonStepNorth, { x: 3, y: 15 }, 'Left Stick North moves hero inside dungeon');
    assert.equal(dungeonCheck.backAtExitTile, true, 'D-Pad South returns hero to dungeon exit stairs');
    assert.equal(dungeonCheck.exitedToOverworld, true, 'Pressing A at exit stairs ascends to Overworld');
    assert.deepEqual(dungeonCheck.overworldCoord, { x: GOBLIN_CAVE_COORD.x, y: GOBLIN_CAVE_COORD.y });
  });

  it('5. Combat UI (Stage 1 Secrecy & Stage 2 Active Combat): A = Engage/Attack, B/X = Avoid, D-Pad focus navigation, X = Class Ability, Y = Potion, B = Flee', async () => {
    await evalInPage(`window.dispatchAction('LAB_SCENARIO', { scenario: 'SWITCH_CLASS', classType: 'CLERIC' })`);
    db.prepare('UPDATE characters SET current_hp = 80, max_hp = 100').run();

    const combatCheck = await evalInPage(`(async () => {
      // 5a. Stage 1 Encounter Secrecy: B or X avoids threat; A engages threat into Stage 2
      await window.dispatchAction('LAB_SCENARIO', { scenario: 'SHADOW' });
      window.resetGamepadState();

      const stage1Initial = window.currentState.encounter?.status;
      await window.simulateGamepadButtonPress('X');
      const afterStage1AvoidWithX = window.currentState.encounter;

      // Spawn another Stage 1 threat and press A (buttons[0]) to Fight/Engage
      await window.dispatchAction('LAB_SCENARIO', { scenario: 'SHADOW' });
      const stage1BeforeFight = window.currentState.encounter?.status;
      await window.simulateGamepadButtonPress('A');
      const stage2AfterEngage = window.currentState.encounter?.status;

      // 5b. Stage 2 Active Combat: Verify initial .gamepad-focus is on #action-slot-1 (Attack)
      await window.dispatchAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Wolf' });
      window.syncGamepadFocus(true);

      const initialCombatFocusId = window.getGamepadDebugState().focusedElementId;

      // Navigate focus with D-Pad Right (buttons[15]) from #action-slot-1 (Attack) to #action-slot-2 (Drink Potion)
      await window.simulateGamepadDirection('EAST');
      const secondCombatFocusId = window.getGamepadDebugState().focusedElementId;

      // Press Y (buttons[3]) hotkey to drink a Healing Potion in combat
      const potionsBeforeY = window.currentState.combatPotionCount;
      await window.simulateGamepadButtonPress('Y');
      const potionsAfterY = window.currentState.combatPotionCount;

      // Ensure enemy is still alive or respawn Wolf to test X (Cleric Battle Prayer) and A (Attack) and B (Flee)
      if (!window.currentState.encounter || window.currentState.encounter.status !== 'IN_COMBAT') {
        await window.dispatchAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Wolf' });
      }
      const chargesBeforeX = window.currentState.clericDivineChargeInfo?.currentCharges;
      await window.simulateGamepadButtonPress('X');
      const chargesAfterX = window.currentState.clericDivineChargeInfo?.currentCharges;

      // Respawn if slain, reset focus to #action-slot-1, and press A (buttons[0]) to Attack
      if (!window.currentState.encounter || window.currentState.encounter.status !== 'IN_COMBAT') {
        await window.dispatchAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Wolf' });
      }
      window.syncGamepadFocus(true);
      const roundBeforeA = window.currentState.encounter.combat_round;
      await window.simulateGamepadButtonPress('A');
      const lastActionAfterA = window.getGamepadDebugState().lastDispatchedAction;

      // Respawn if needed and press B (buttons[1]) to Flee combat
      if (!window.currentState.encounter || window.currentState.encounter.status !== 'IN_COMBAT') {
        await window.dispatchAction('LAB_SCENARIO', { scenario: 'STAGE2_COMBAT', monsterName: 'Wolf' });
      }
      await window.simulateGamepadButtonPress('B');
      const encounterAfterFlee = window.currentState.encounter;

      return {
        stage1Initial,
        afterStage1AvoidWithX,
        stage1BeforeFight,
        stage2AfterEngage,
        initialCombatFocusId,
        secondCombatFocusId,
        potionsBeforeY,
        potionsAfterY,
        chargesBeforeX,
        chargesAfterX,
        roundBeforeA,
        lastActionAfterA,
        encounterAfterFlee
      };
    })()`);

    assert.equal(combatCheck.stage1Initial, 'DISCOVERED');
    assert.equal(combatCheck.afterStage1AvoidWithX, null, 'Pressing X in Stage 1 avoids the spotted threat');
    assert.equal(combatCheck.stage1BeforeFight, 'DISCOVERED');
    assert.equal(combatCheck.stage2AfterEngage, 'IN_COMBAT', 'Pressing A in Stage 1 engages threat into Stage 2 active combat');
    assert.equal(combatCheck.initialCombatFocusId, 'action-slot-1', 'Stage 2 combat starts with .gamepad-focus on #action-slot-1');
    assert.equal(combatCheck.secondCombatFocusId, 'action-slot-2', 'D-Pad Right moves .gamepad-focus to #action-slot-2');
    assert.equal(combatCheck.potionsAfterY, combatCheck.potionsBeforeY - 1, 'Pressing Y drinks a healing potion in combat');
    assert.equal(combatCheck.chargesAfterX, combatCheck.chargesBeforeX - 1, 'Pressing X triggers Cleric Battle Prayer (spending 1 Divine Charge)');
    assert.equal(combatCheck.lastActionAfterA, 'ATTACK', 'Pressing A triggers primary weapon Attack');
    assert.equal(combatCheck.encounterAfterFlee, null, 'Pressing B flees active combat when not ambush-locked');
  });

  it('6. Modals, Panels & .gamepad-focus Navigation: Hero (+1 Attribute Spend), Inventory/Equipment, Shop, Quests/Bounties, Region Map [M], and LB/RB cycling', async () => {
    // Grant 1 unspent milestone attribute point and extra gold in SQLite so we can test +1 attribute spend and Shop purchase via Gamepad
    const heroRow = db.prepare('SELECT id, strength FROM characters ORDER BY id DESC LIMIT 1').get();
    assert.ok(heroRow, 'Active character exists in DB');
    db.prepare('UPDATE characters SET attribute_points = 1, gold = 500 WHERE id = ?').run(heroRow.id);

    const modalCheck = await evalInPage(`(async () => {
      await window.dispatchAction('LAB_SCENARIO', { scenario: 'CITY' });
      window.closeLabModal();
      window.resetGamepadState();

      // 6a. Press LB (buttons[4]) outside modals to swap weapon stance (Melee <-> Ranged)
      const stanceBeforeLb = window.currentState.character.primary_weapon;
      await window.simulateGamepadButtonPress('LB');
      const stanceAfterLb = window.currentState.character.primary_weapon;

      // 6b. Press Start/Menu (buttons[9]) to open Hero Sheet ('character')
      await window.simulateGamepadButtonPress('START');
      const heroModalOpen = window.currentOpenModal;
      const heroFocusHasClass = Boolean(document.querySelector('#lab-modal-body .gamepad-focus'));
      const strBeforeSpend = window.currentState.character.strength;

      // Initial focus in Hero modal when attribute_points > 0 is the first +1 button (STR) -> Press A to spend!
      await window.simulateGamepadButtonPress('A');
      const strAfterSpend = window.currentState.character.strength;
      const attrPointsAfterSpend = window.currentState.character.attribute_points;

      // 6c. Press RB (buttons[5]) to cycle from 'character' -> 'backpack' (Inventory & Equipment)
      await window.simulateGamepadButtonPress('RB');
      const backpackModalOpen = window.currentOpenModal;
      const focusBeforeMoveInPack = window.getGamepadDebugState().focusIndex;
      await window.simulateGamepadDirection('SOUTH');
      const focusAfterMoveInPack = window.getGamepadDebugState().focusIndex;

      // 6d. Press RB (buttons[5]) in Safe City to cycle from 'backpack' -> 'market' (Oakhaven Shop)
      await window.simulateGamepadButtonPress('RB');
      const marketModalOpen = window.currentOpenModal;
      const goldBeforeBuy = window.currentState.character.gold;
      const invCountBeforeBuy = window.currentState.inventory.length;

      // Initial focus in Market modal is the first affordable item's Buy button -> Press A to buy!
      await window.simulateGamepadButtonPress('A');
      const goldAfterBuy = window.currentState.character.gold;
      const invCountAfterBuy = window.currentState.inventory.length;

      // Press X (buttons[2]) inside Market modal to switch Market tab (BUY_STANDARD -> BUY_RESALE)
      const marketTabBeforeX = window.currentMarketTab;
      await window.simulateGamepadButtonPress('X');
      const marketTabAfterX = window.currentMarketTab;

      // 6e. Press RB (buttons[5]) to cycle from 'market' -> 'quests' (Quests & Bounties)
      await window.simulateGamepadButtonPress('RB');
      const questsModalOpen = window.currentOpenModal;

      // Press A to accept the primary quest if NOT_ACCEPTED
      await window.simulateGamepadButtonPress('A');
      const questStatusAfterA = window.currentState.quests ? window.currentState.quests[0].status : window.currentState.quest?.status;

      // Press X (buttons[2]) inside Quests modal to toggle to BOUNTIES tab
      await window.simulateGamepadButtonPress('X');
      const questsTabAfterX = window.currentQuestsTab;

      // 6f. Press View/Back (buttons[8]) to open Region Map ('map')
      await window.simulateGamepadButtonPress('VIEW');
      const mapModalOpen = window.currentOpenModal;
      const mapCanvasPresent = Boolean(document.getElementById('region-map-overview-canvas'));

      // 6g. Press B (buttons[1]) to close the modal
      await window.simulateGamepadButtonPress('B');
      const modalAfterCloseWithB = window.currentOpenModal;

      return {
        stanceBeforeLb,
        stanceAfterLb,
        heroModalOpen,
        heroFocusHasClass,
        strBeforeSpend,
        strAfterSpend,
        attrPointsAfterSpend,
        backpackModalOpen,
        focusBeforeMoveInPack,
        focusAfterMoveInPack,
        marketModalOpen,
        goldBeforeBuy,
        goldAfterBuy,
        invCountBeforeBuy,
        invCountAfterBuy,
        marketTabBeforeX,
        marketTabAfterX,
        questsModalOpen,
        questStatusAfterA,
        questsTabAfterX,
        mapModalOpen,
        mapCanvasPresent,
        modalAfterCloseWithB
      };
    })()`);

    assert.notEqual(modalCheck.stanceAfterLb, modalCheck.stanceBeforeLb, 'LB outside modals swaps weapon stance');
    assert.equal(modalCheck.heroModalOpen, 'character', 'Start/Menu opens Hero Sheet modal');
    assert.equal(modalCheck.heroFocusHasClass, true, 'Hero modal renders visible .gamepad-focus element');
    assert.equal(modalCheck.strAfterSpend, modalCheck.strBeforeSpend + 1, 'Pressing A on +1 STR spends milestone attribute point');
    assert.equal(modalCheck.attrPointsAfterSpend, 0);

    assert.equal(modalCheck.backpackModalOpen, 'backpack', 'RB cycles from Hero to Backpack modal');
    assert.notEqual(modalCheck.focusAfterMoveInPack, modalCheck.focusBeforeMoveInPack, 'D-Pad Down navigates .gamepad-focus inside Backpack');

    assert.equal(modalCheck.marketModalOpen, 'market', 'RB in Safe City cycles from Backpack to Oakhaven Market modal');
    assert.ok(modalCheck.goldAfterBuy < modalCheck.goldBeforeBuy, 'Pressing A in Market buys focused item and deducts gold');
    assert.equal(modalCheck.invCountAfterBuy, modalCheck.invCountBeforeBuy + 1, 'Purchased item is added to inventory');
    assert.equal(modalCheck.marketTabBeforeX, 'BUY_STANDARD');
    assert.equal(modalCheck.marketTabAfterX, 'BUY_RESALE', 'Pressing X in Market switches to BUY_RESALE tab');

    assert.equal(modalCheck.questsModalOpen, 'quests', 'RB cycles from Market to Quests & Bounties modal');
    assert.equal(modalCheck.questStatusAfterA, 'ACTIVE', 'Pressing A in Quests modal accepts story quest');
    assert.equal(modalCheck.questsTabAfterX, 'BOUNTIES', 'Pressing X in Quests modal switches to BOUNTIES tab');

    assert.equal(modalCheck.mapModalOpen, 'map', 'View/Back button opens Region Map [M]');
    assert.equal(modalCheck.mapCanvasPresent, true, 'Region Map canvas renders cleanly');
    assert.equal(modalCheck.modalAfterCloseWithB, null, 'Pressing B closes the active modal');
  });

  it('7. Keyboard & Mouse Coexistence: Keyboard shortcuts and mouse clicks remain 100% functional with zero console/page errors', async () => {
    const coexistenceCheck = await evalInPage(`(async () => {
      // Keep a connected gamepad active while using keyboard and mouse
      window.setMockGamepadState({
        id: 'Lenovo Legion Go 2 TrueStrike Controller',
        mapping: 'standard'
      });
      await window.stepGamepadFrame(null, 9000);

      // Dispatch keyboard 'm' to open Region Map
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
      const modalAfterKeyM = window.currentOpenModal;

      // Dispatch keyboard 'Escape' to close Region Map
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const modalAfterKeyEsc = window.currentOpenModal;

      // Click #util-btn-hero with mouse .click()
      document.getElementById('util-btn-hero').click();
      const modalAfterMouseClick = window.currentOpenModal;
      window.closeLabModal();

      return {
        modalAfterKeyM,
        modalAfterKeyEsc,
        modalAfterMouseClick
      };
    })()`);

    assert.equal(coexistenceCheck.modalAfterKeyM, 'map', 'Keyboard [M] shortcut still opens Region Map while gamepad is connected');
    assert.equal(coexistenceCheck.modalAfterKeyEsc, null, 'Keyboard [Esc] shortcut still closes modal while gamepad is connected');
    assert.equal(coexistenceCheck.modalAfterMouseClick, 'character', 'Mouse click on HUD button still opens Hero Sheet while gamepad is connected');

    assert.equal(cdp.consoleErrors.length, 0, `Expected 0 browser console errors, got: ${cdp.consoleErrors.join('; ')}`);
    assert.equal(cdp.pageExceptions.length, 0, `Expected 0 page exceptions, got: ${cdp.pageExceptions.join('; ')}`);
  });
});
