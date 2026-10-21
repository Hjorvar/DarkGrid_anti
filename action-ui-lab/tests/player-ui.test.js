/**
 * DARKGRID — Player Experience & UI Test Suite (Track 2)
 * Verifies all 12 Player Experience & UI areas in action-ui-lab:
 *   1. Progressive Disclosure Header & Collapsible Lab Tools Drawer
 *   2. Exploration vs. Combat vs. Town Mode State Clarity
 *   3. Top Champion Deck, Hand State Tags & Quick Equipment Controls
 *   4. Decluttered First-Person Viewport HUD & Atmospheric Vista Guidance
 *   5. Tactical Action Deck & Context-Sensitive Slot 1 (Attack / Engage / Rest / Landmark Inspect)
 *   6. First-Person Navigation Pad & Active Combat Lock Banner
 *   7. Compact & Expandable Bottom Chronicle Drawer ([H] History Buffer)
 *   8. Quest, Expedition & Bounty Tracker Pill (No Duplicate Coordinates)
 *   9. Hidden-Numbers Monster Combat Plate in Player Mode vs. Dev Telemetry
 *  10. Modal Drawers & Controls / Tactical Guide Help Modal ([?])
 *  11. Conflict-Free Keyboard Shortcuts & Focus-Visible Accessibility
 *  12. Zero-Scroll Responsive Layout & Dark Fantasy Palette Invariants
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');

const { createLabApp } = require('../server');

let server;
let baseUrl;

async function postAction(action, payload = {}) {
  const res = await fetch(`${baseUrl}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  return res.json();
}

describe('Darkgrid Action UI Lab — Player Experience & UI Overhaul (Track 2)', () => {
  const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
  const cssDir = path.join(__dirname, '..', 'public', 'css');
  const jsDir = path.join(__dirname, '..', 'public', 'js');

  let htmlContent = '';
  let cssContent = '';
  let jsContent = '';

  function collectFilesRecursive(dir, ext) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectFilesRecursive(full, ext));
      else if (entry.name.endsWith(ext)) out.push(full);
    }
    return out;
  }

  let app;

  before(async () => {
    htmlContent = fs.readFileSync(htmlPath, 'utf8');
    cssContent = collectFilesRecursive(cssDir, '.css')
      .map(f => fs.readFileSync(f, 'utf8'))
      .join('\n\n');
    jsContent = collectFilesRecursive(jsDir, '.js')
      .map(f => fs.readFileSync(f, 'utf8'))
      .join('\n\n');

    app = createLabApp({ dbPath: ':memory:' });
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (app && app.locals && app.locals.db) {
      try {
        app.locals.db.close();
      } catch (_e) {
        // ignore
      }
    }
  });

  it('1. Progressive Disclosure: Header defaults to Player Mode with Lab Tools collapsed', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();

    // Body and main shell default to dev-mode-collapsed and ui-mode-exploration
    assert.ok(html.includes('dev-mode-collapsed'), 'Body/shell should start with dev-mode-collapsed');
    assert.ok(html.includes('id="btn-toggle-devtools"'), 'Should provide Lab Tools toggle button');
    assert.ok(html.includes('id="lab-devtools-drawer"'), 'Should group developer controls inside #lab-devtools-drawer');
    assert.ok(html.includes('id="header-mode-indicator"'), 'Should display live player mode indicator in top bar');
    assert.ok(html.includes('id="btn-open-help"'), 'Should provide always-accessible Controls Help button [?]');
    assert.ok(html.includes('id="btn-open-journal"'), 'Should provide always-accessible Expedition Journal button [L]');

    // Verify all existing Lab Director / QA / Scene / Cutout controls remain preserved in DOM
    assert.ok(html.includes('id="scene-btn-C"'));
    assert.ok(html.includes('id="blend-btn-integrated"'));
    assert.ok(html.includes('id="btn-toggle-sizelab"'));
    assert.ok(html.includes('id="btn-open-director"'));
    assert.ok(html.includes('id="btn-open-atlas"'));
    assert.ok(html.includes('id="btn-open-qa"'));

    // CSS hides .lab-devtools-drawer and .dev-only-badge when .dev-mode-collapsed is active
    assert.ok(cssContent.includes('.dev-mode-collapsed .lab-devtools-drawer'));
    assert.ok(cssContent.includes('.dev-mode-collapsed .dev-only-badge'));
  });

  it('2. Mode-Reactive UI State: syncUiModeClasses toggles exploration, town, and combat classes', () => {
    assert.ok(jsContent.includes('function syncUiModeClasses(state)'), 'JS must define syncUiModeClasses');
    assert.ok(jsContent.includes('ui-mode-combat'), 'JS must toggle ui-mode-combat');
    assert.ok(jsContent.includes('ui-combat-stage1'), 'JS must toggle ui-combat-stage1');
    assert.ok(jsContent.includes('ui-combat-stage2'), 'JS must toggle ui-combat-stage2');
    assert.ok(jsContent.includes('ui-mode-town'), 'JS must toggle ui-mode-town');
    assert.ok(jsContent.includes('ui-mode-exploration'), 'JS must toggle ui-mode-exploration');

    assert.ok(cssContent.includes('.ui-mode-combat.ui-combat-stage2 .dm-action-deck'));
    assert.ok(cssContent.includes('.ui-mode-town .dm-action-deck'));
  });

  it('3. Top Champion Deck: Hero identity sheet trigger, hand state tags, quick stance/pack & HP state pill', () => {
    assert.ok(htmlContent.includes('id="hud-hero-card"'), 'Hero card should have #hud-hero-card');
    assert.ok(htmlContent.includes('id="main-hand-state-tag"'), 'Main hand slot should display state tag');
    assert.ok(htmlContent.includes('id="off-hand-state-tag"'), 'Off-hand slot should display state tag');
    assert.ok(htmlContent.includes('id="btn-quick-stance"'), 'Top deck should include quick stance toggle');
    assert.ok(htmlContent.includes('id="btn-quick-pack"'), 'Top deck should include quick backpack button');
    assert.ok(htmlContent.includes('id="hud-hp-state-pill"'), 'Vitality readout should include descriptive HP state pill');
    assert.ok(htmlContent.includes('id="hud-potion-chip"'), 'Potion stat chip should be interactive');

    // Verify no forbidden legacy duplicate IDs exist
    const forbiddenIds = ['btn-top-stance', 'btn-top-rest', 'pad-tl', 'pad-tr', 'pad-bl', 'pad-br'];
    for (const id of forbiddenIds) {
      assert.ok(!htmlContent.includes(`id="${id}"`), `Legacy duplicate ID #${id} must not exist`);
    }
  });

  it('4. Decluttered Viewport HUD & Monster Combat Plate: Hidden numbers in Player Mode, telemetry in Dev Mode', () => {
    // Location plaque marks technical Scene Mode tag with .dev-only-badge
    assert.ok(
      htmlContent.includes('class="fp-scene-mode-tag dev-only-badge" id="fp-scene-mode-tag"'),
      '#fp-scene-mode-tag should have dev-only-badge class so Player Mode shows clean lore plaque'
    );

    // Monster combat plate keeps .badge-pf-size for lore scale and marks cutout/pixel telemetry as .dev-only-badge
    assert.ok(jsContent.includes('badge-integrated-active dev-only-badge'));
    assert.ok(jsContent.includes('badge-card-fallback dev-only-badge'));
    assert.ok(jsContent.includes('id="monster-tech-dims"'));

    // Tactical strip preserves exact 3 .fp-tactical-chip elements
    const tacticalStripMatch = jsContent.match(/<div class="fp-combat-tactical-strip">([\s\S]*?)<\/div>/);
    assert.ok(tacticalStripMatch, 'Should contain .fp-combat-tactical-strip template');
    const chipOccurrences = (tacticalStripMatch[1].match(/class="fp-tactical-chip/g) || []).length;
    assert.equal(chipOccurrences, 3, 'Combat tactical strip must contain exactly 3 .fp-tactical-chip elements');
  });

  it('5. Compact & Expandable Bottom Chronicle Drawer ([H] History Toggle & Buffer)', () => {
    assert.ok(htmlContent.includes('id="btn-toggle-chronicle"'), 'Chronicle header should include #btn-toggle-chronicle');
    assert.ok(jsContent.includes('function toggleChronicleHistory'), 'JS should define toggleChronicleHistory');
    assert.ok(jsContent.includes('function recordChronicleHistoryLine'), 'JS should record chronicle history buffer');
    assert.ok(cssContent.includes('.fp-bottom-chronicle.is-chronicle-expanded'), 'CSS should style expanded chronicle drawer');
  });

  it('6. Tactical Action Deck & Navigation Pad: Combat lock banner and POI landmark inspection in Slot 1', async () => {
    assert.ok(htmlContent.includes('id="dm-nav-combat-banner"'), 'Movement deck should contain #dm-nav-combat-banner');
    assert.ok(jsContent.includes("moveDeck.classList.toggle('is-combat-locked', isMoveLockedByCombat)"));

    // Verify server state at [7,7] facing NORTH has a pointOfInterest so Slot 1 can inspect it
    const cityRes = await postAction('LAB_SCENARIO', { scenario: 'CITY' });
    assert.equal(cityRes.state.currentTile.x, 7);
    assert.equal(cityRes.state.currentTile.y, 7);
    assert.ok(cityRes.state.viewportScene.pointOfInterest, 'Oakhaven [7,7] NORTH should expose a pointOfInterest');
    assert.ok(jsContent.includes("poi.shortPrompt || 'Inspect Landmark'"), 'Slot 1 should offer Landmark Inspection when POI is present');
  });

  it('7. Quest, Expedition & Bounty Tracker Pill: Clean coordinate formatting without duplication', () => {
    assert.ok(
      jsContent.includes("const wpDisplay = (nextWp && !rawWpLabel.includes('['))"),
      'Expedition pill should avoid duplicating [x,y] coordinates when waypoint label already includes them'
    );
    assert.ok(
      jsContent.includes('id="btn-bounty-tracker-pill"'),
      'Should support active bounty contract tracking pill when Adventure Mode is off'
    );
  });

  it('8. Controls Help Modal ([?]), Director Helpers & Conflict-Free Keyboard Shortcuts', () => {
    assert.ok(jsContent.includes('function renderHelpModal(titleEl, bodyEl)'), 'Should implement renderHelpModal');
    assert.ok(jsContent.includes('function triggerSpawnMonster(monsterKey)'), 'Should implement triggerSpawnMonster helper for Director modal');
    assert.ok(jsContent.includes('function switchHeroClass(classType)'), 'Should implement switchHeroClass helper for Director modal');
    assert.ok(jsContent.includes("case 'h':") && jsContent.includes('toggleChronicleHistory()'), 'Should bind [H] to toggleChronicleHistory');
    assert.ok(jsContent.includes("case '?':") && jsContent.includes("openLabModal('help')"), 'Should bind [?] to open Help modal');
    assert.ok(jsContent.includes("case '`':") && jsContent.includes('toggleDevToolsDrawer()'), 'Should bind [`/~] to toggleDevToolsDrawer');
    assert.ok(cssContent.includes('button:focus-visible'), 'CSS must include high-contrast :focus-visible outline');
  });

  it('9. Client JS Syntax & Zero-Scroll Responsive CSS Invariants', () => {
    // Verify every modular ES module in public/js/ parses cleanly with zero syntax errors
    for (const file of collectFilesRecursive(jsDir, '.js')) {
      const rawMod = fs.readFileSync(file, 'utf8');
      const strippedMod = rawMod
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '')
        .replace(/^\s*export\s+(const|let|var|function|async\s+function)/gm, '$1');
      assert.doesNotThrow(() => {
        new vm.Script(strippedMod, { filename: path.relative(jsDir, file) });
      }, `${path.relative(jsDir, file)} must have valid JavaScript syntax`);
    }

    // Verify zero-scroll CSS invariants
    assert.ok(cssContent.includes('100dvh'), 'CSS must use 100dvh');
    assert.ok(cssContent.includes('overflow: hidden'), 'CSS must enforce overflow: hidden');
    assert.ok(!cssContent.includes('min-height: 660px'), 'CSS must not contain fixed min-height: 660px');
    assert.ok(cssContent.includes('@media (max-height: 820px)'), 'CSS must include compact height media query');
  });

  it('10. Phase 1 Travel Continuity UI Wiring: Connects continuityNote, horizonHint, revisitStatus, compassContext & combatReturnContext without raw enum leaks', () => {
    assert.ok(jsContent.includes('function sanitizePlayerContinuityText(rawText)'), 'Should define sanitizePlayerContinuityText');
    assert.ok(jsContent.includes('function buildRevisitBadgeHtml(adv)'), 'Should define buildRevisitBadgeHtml');
    assert.ok(jsContent.includes('id="fp-chronicle-continuity-note"'), 'Chronicle should render #fp-chronicle-continuity-note');
    assert.ok(jsContent.includes('id="fp-chronicle-combat-return"'), 'Chronicle should render #fp-chronicle-combat-return');
    assert.ok(jsContent.includes('data-revisit-status='), 'Vista bar and revisit pills should bind data-revisit-status');

    // Evaluate sanitizePlayerContinuityText directly in a VM sandbox to verify enum stripping
    const fnMatch = jsContent.match(/function sanitizePlayerContinuityText\(rawText\)\s*\{[\s\S]*?\n\}/);
    assert.ok(fnMatch, 'Should extract sanitizePlayerContinuityText');
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(fnMatch[0], sandbox);
    const cleaned1 = sandbox.sanitizePlayerContinuityText(
      'Victory at Mirkwood Forest [7,5]: With Goblin slain, the area is now secured (CLEARED_SITE) and you resume your bearings facing NORTH.'
    );
    assert.ok(!cleaned1.includes('CLEARED_SITE'), 'Must strip CLEARED_SITE enum key');
    assert.ok(cleaned1.includes('facing North'), 'Must normalize facing NORTH to facing North');

    const cleaned2 = sandbox.sanitizePlayerContinuityText(
      'Turned from North to face East while standing at Mirkwood Forest [7,4]. Open (East): Mirkwood Forest (FOREST) [8,4].'
    );
    assert.ok(!cleaned2.includes('(FOREST)'), 'Must strip parenthesized (FOREST) enum key');
  });

  it('11. Phase 2 Workstreams A & D: True crossfade transition, prefers-reduced-motion compliance, landmark arrival cue, and concise blocked feedback', () => {
    assert.ok(jsContent.includes('function isReducedMotionPreferred()'), 'Should define isReducedMotionPreferred helper');
    assert.ok(jsContent.includes("terrainImg.classList.add('is-crossfading')"), 'applySceneImageWithCrossfade must activate .is-crossfading class');
    assert.ok(jsContent.includes("'anim-landmark-arrival'"), 'Should support .anim-landmark-arrival cue on landmark arrival');
    assert.ok(jsContent.includes('⛔ Blocked: ${blockedObstacle}'), 'Blocked move popup should name the specific obstacle ahead');
    assert.ok(cssContent.includes('0%   { opacity: 0;'), 'fpSceneCrossfadeIn keyframe must fade from opacity: 0 to 1');
    assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'CSS must respect prefers-reduced-motion: reduce');
  });

  it('12. Phase 4 Player UI Simplification & Immersion: Contextual Action Deck, Zero-Dead-Space Right Deck, Expandable Minimap & Streamlined Overlays', () => {
    assert.ok(htmlContent.includes('id="btn-toggle-minimap-size"'), 'Minimap card should include expandable size toggle button');
    assert.ok(jsContent.includes('function toggleMinimapSize('), 'minimap.js should implement toggleMinimapSize()');
    assert.ok(jsContent.includes("classList.toggle('is-contextual-inactive'"), 'Action slots should toggle is-contextual-inactive for non-applicable filler slots');
    assert.ok(jsContent.includes("classList.toggle('has-primary-slot'"), 'Action deck card should toggle has-primary-slot when Slot 1 is primary');
    assert.ok(jsContent.includes('id="btn-victory-continue"'), 'Victory banner should render explicit #btn-victory-continue CTA');
    assert.ok(cssContent.includes('.dev-mode-collapsed .dm-action-tile.is-contextual-inactive'), 'CSS should hide contextual inactive slots in Player Mode');
    assert.ok(cssContent.includes('.dm-movement-deck.is-combat-locked .dm-pad-grid'), 'CSS should collapse disabled movement pad grid during active melee combat');
  });
});
