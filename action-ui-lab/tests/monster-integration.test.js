'use strict';

/**
 * DARKGRID ACTION UI LAB — Track 5 (Phase C): Monster Data & Asset Integration Test Suite
 *
 * Verifies end-to-end integration of:
 *  - Track 3 PF1e Monster Size, Body-Profile, Perspective & Multi-Monster Layout Engine
 *  - Track 4 Verified RGBA Cutout Assets (37 total: 7 baseline + 30 newly produced) & 61 Card Fallbacks
 *  - Track 5 Unified Monster Asset Manifest (`monster-asset-manifest.json`), Server Encounter Payloads,
 *    Client Render-Mode Switching (`INTEGRATED`, `CARD`, `BLEND`, `FRAMED`), and Bulletproof Fallbacks
 *  - Strict Stage 1 (`DISCOVERED`) Encounter Secrecy and Biome/Landmark Combat Stage Calibration
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  createLabApp,
  INTEGRATED_MONSTER_PROFILES,
  resolveMonsterIntegratedProfile,
  resolveIntegratedMonsterProfile
} = require('../server');

const {
  PF1E_SIZE_CATEGORIES,
  VISUAL_BODY_PROFILES,
  MONSTER_SIZE_CATALOG,
  PF1E_SIZE_REFERENCE_SPECIMENS,
  lookupMonsterSizeEntry,
  resolveScenePerspectiveCalibration,
  computeAdaptiveMonsterVisualScale,
  computeEncounterDistanceTransition,
  computeMultiMonsterSceneLayout,
  validateCutoutAssetMetadata,
  registerVerifiedCutoutMetadata,
  resetCutoutMetadataToBaseline,
  resolveMonsterRenderMode,
  getMonsterAssetManifest,
  buildVisualComparisonPresets,
  getCatalogAuditSummary
} = require('../monster-size-catalog');

const LAB_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(LAB_DIR, 'monster-asset-manifest.json');
const INVENTORY_PATH = path.join(LAB_DIR, 'monster-artwork-inventory.json');
const CUTOUT_DIR = path.join(LAB_DIR, 'public', 'images', 'monsters-cutout');
const CLIENT_JS_PATH = path.join(LAB_DIR, 'public', 'js', 'combat', 'combat-ui.js');

describe('Track 5 — Monster Data, Cutout Asset & Combat Scene Integration Suite (Phase C)', () => {
  let server = null;
  let baseUrl = '';
  let tmpDbPath = '';

  before(async () => {
    tmpDbPath = path.join(os.tmpdir(), `darkgrid_monster_integration_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`);
    const app = createLabApp({ dbPath: tmpDbPath });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        if (fs.existsSync(tmpDbPath + suffix)) fs.unlinkSync(tmpDbPath + suffix);
      } catch (_e) {
        // Ignore cleanup lock on Windows
      }
    }
  });

  beforeEach(() => {
    resetCutoutMetadataToBaseline();
  });

  async function apiGet(endpoint) {
    const res = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(res.status, 200, `Expected 200 OK from GET ${endpoint}`);
    return res.json();
  }

  async function apiAction(action, payload = {}) {
    const res = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    assert.equal(res.status, 200, `Expected 200 OK from POST /api/action (${action})`);
    const data = await res.json();
    assert.equal(data.ok, true, `Expected ok: true for action ${action}, got error: ${data.state && data.state.errorMessage}`);
    return data.state;
  }

  it('1. Task 1 — Builds unified monster-asset-manifest.json covering all 98 DB monsters + 5 reference specimens (37 Cutouts + 61 Card Fallbacks)', async () => {
    assert.ok(fs.existsSync(MANIFEST_PATH), 'monster-asset-manifest.json must exist on disk');
    const diskManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const liveManifest = getMonsterAssetManifest();

    for (const m of [diskManifest, liveManifest]) {
      assert.equal(m.schemaVersion, '1.0.0');
      assert.equal(m.summary.totalDatabaseMonsters, 98);
      assert.equal(m.summary.referenceSpecimensCount, 5);
      assert.equal(m.summary.totalSpecimens, 103);
      assert.equal(m.summary.verifiedCutoutCount, 37);
      assert.equal(m.summary.existingApprovedCutoutCount, 7);
      assert.equal(m.summary.newlyProducedCutoutCount, 30);
      assert.equal(m.summary.cardFallbackCount, 61);
      assert.equal(m.summary.cutoutCoveragePercent, 37.8);
      assert.equal(m.monsters.length, 98);
      assert.equal(m.referenceSpecimens.length, 5);
    }

    // Verify GET /api/monster-manifest endpoint returns matching manifest + single monster resolution
    const apiManifest = await apiGet('/api/monster-manifest?monster=owlbear&mode=INTEGRATED&sceneTerrain=FOREST');
    assert.equal(apiManifest.ok, true);
    assert.equal(apiManifest.summary.verifiedCutoutCount, 37);
    assert.equal(apiManifest.summary.cardFallbackCount, 61);
    assert.ok(apiManifest.singleResolution);
    assert.equal(apiManifest.singleResolution.monsterSlug, 'owlbear');
    assert.equal(apiManifest.singleResolution.activeMode, 'INTEGRATED');
    assert.equal(apiManifest.singleResolution.hasVerifiedCutout, true);
    assert.equal(apiManifest.singleResolution.activeImageUrl, '/lab-assets/images/monsters-cutout/owlbear.png');
  });

  it('2. Task 2 — Synchronizes MONSTER_SIZE_CATALOG with Track 4 measured cutout bounds and preserves Card bounds for all 98 monsters', () => {
    const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    const invBySlug = new Map(inventory.monsters.map(m => [m.slug, m]));
    const summary = getCatalogAuditSummary();

    assert.equal(summary.totalDatabaseMonsters, 98);
    assert.equal(summary.verifiedCutoutCount, 37);
    assert.equal(summary.cardFallbackCount, 61);

    for (const entry of MONSTER_SIZE_CATALOG) {
      const invItem = invBySlug.get(entry.slug);
      assert.ok(invItem, `Missing inventory record for ${entry.slug}`);
      assert.ok(entry.cardContentBounds && entry.cardContentBounds.contentHeightRatio > 0.4, `${entry.slug} must retain valid cardContentBounds`);

      if (invItem.hasVerifiedCutout) {
        assert.equal(entry.hasCutout, true, `${entry.slug} must have hasCutout: true in MONSTER_SIZE_CATALOG`);
        assert.equal(entry.cutoutImagePath, `/lab-assets/images/monsters-cutout/${entry.slug}.png`);
        assert.ok(entry.cutoutContentBounds, `${entry.slug} must have cutoutContentBounds`);
        assert.equal(entry.cutoutContentBounds.contentHeightRatio, invItem.cutoutBounds.contentHeightRatio);
        assert.equal(entry.cutoutContentBounds.contentWidthRatio, invItem.cutoutBounds.contentWidthRatio);

        // Verify cutout file exists on disk in action-ui-lab/public/images/monsters-cutout/
        const diskCutout = path.join(CUTOUT_DIR, `${entry.slug}.png`);
        assert.ok(fs.existsSync(diskCutout), `Cutout file missing on disk: ${diskCutout}`);
      } else {
        assert.equal(entry.hasCutout, false, `${entry.slug} must have hasCutout: false in MONSTER_SIZE_CATALOG`);
        assert.equal(entry.cutoutImagePath, null);
        assert.equal(entry.cutoutContentBounds, null);
      }
    }
  });

  it('3. Task 3 — Registers all 37 verified cutouts in server INTEGRATED_MONSTER_PROFILES with anatomical grounding and contact patches', () => {
    const profileKeys = Object.keys(INTEGRATED_MONSTER_PROFILES);
    assert.equal(profileKeys.length, 37, `Expected 37 integrated monster profiles on server, got ${profileKeys.length}`);
    assert.equal(typeof resolveIntegratedMonsterProfile, 'function', 'resolveIntegratedMonsterProfile alias must be exported');

    const manifest = getMonsterAssetManifest();
    for (const slug of manifest.summary.verifiedCutoutSlugs) {
      const resolved = resolveMonsterIntegratedProfile(slug);
      assert.equal(resolved.slug, slug);
      assert.equal(resolved.hasIntegratedCutout, true, `${slug} must resolve with hasIntegratedCutout: true`);
      assert.equal(resolved.cutoutImageUrl, `/lab-assets/images/monsters-cutout/${slug}.png`);
      assert.equal(resolved.fallbackPresentation, 'INTEGRATED');
      assert.equal(resolved.fallbackReason, null);
      assert.ok(resolved.renderContract && resolved.renderContract.activeMode === 'INTEGRATED');
      assert.ok(resolved.adaptiveScale && resolved.adaptiveScale.visibleHeightPx > 40);

      if (resolved.adaptiveScale.positioning.isAirborne) {
        assert.equal(resolved.contactPatches.length, 0, `Airborne cutout ${slug} must have 0 ground contact patches`);
        assert.ok(resolved.airborneGapPx >= 24, `Airborne cutout ${slug} must have >= 24px hover gap`);
      } else {
        assert.ok(resolved.contactPatches.length >= 2, `Grounded cutout ${slug} must have >= 2 anatomical contact shadow patches`);
      }
    }

    for (const slug of manifest.summary.cardFallbackSlugs) {
      const resolved = resolveMonsterIntegratedProfile(slug);
      assert.equal(resolved.slug, slug);
      assert.equal(resolved.hasIntegratedCutout, false, `Fallback monster ${slug} must have hasIntegratedCutout: false`);
      assert.equal(resolved.cutoutImageUrl, null);
      assert.equal(resolved.fallbackPresentation, 'CARD');
      assert.equal(resolved.fallbackReason, 'NO_VERIFIED_RGBA_CUTOUT');
      assert.equal(resolved.renderContract.activeMode, 'CARD');
    }
  });

  it('4. Task 4 — Supports all 4 client presentation modes (INTEGRATED, CARD, BLEND, FRAMED) across cutout and fallback monsters', () => {
    // 1. Monster with verified cutout (e.g. Minotaur) supports all 4 modes
    for (const mode of ['INTEGRATED', 'CARD', 'BLEND', 'FRAMED']) {
      const res = resolveMonsterRenderMode('minotaur', mode);
      assert.equal(res.monsterSlug, 'minotaur');
      assert.equal(res.hasVerifiedCutout, true);
      assert.equal(res.requestedMode, mode);
      assert.equal(res.activeMode, mode);
      assert.deepEqual(res.supportedModes, ['INTEGRATED', 'CARD', 'BLEND', 'FRAMED']);

      if (mode === 'INTEGRATED') {
        assert.equal(res.activeImageUrl, '/lab-assets/images/monsters-cutout/minotaur.png');
        assert.equal(res.didFallbackToCard, false);
        assert.equal(res.fallbackReason, null);
      } else {
        assert.equal(res.activeImageUrl, '/images/monsters/minotaur.png');
        if (mode === 'CARD') {
          assert.equal(res.fallbackReason, 'EXPLICIT_CARD_MODE_REQUESTED');
        }
      }
    }

    // 2. Monster without cutout (e.g. Displacer Beast) falls back to CARD when INTEGRATED is requested, and supports CARD/BLEND/FRAMED
    const dispIntegrated = resolveMonsterRenderMode('displacer_beast', 'INTEGRATED');
    assert.equal(dispIntegrated.hasVerifiedCutout, false);
    assert.equal(dispIntegrated.requestedMode, 'INTEGRATED');
    assert.equal(dispIntegrated.activeMode, 'CARD');
    assert.equal(dispIntegrated.didFallbackToCard, true);
    assert.equal(dispIntegrated.fallbackReason, 'NO_VERIFIED_RGBA_CUTOUT');
    assert.equal(dispIntegrated.activeImageUrl, '/images/monsters/displacer_beast.png');
    assert.deepEqual(dispIntegrated.supportedModes, ['CARD', 'BLEND', 'FRAMED']);

    for (const mode of ['CARD', 'BLEND', 'FRAMED']) {
      const dispMode = resolveMonsterRenderMode('displacer_beast', mode);
      assert.equal(dispMode.activeMode, mode);
      assert.equal(dispMode.activeImageUrl, '/images/monsters/displacer_beast.png');
    }
  });

  it('5. Task 5 — Enforces bulletproof automatic fallback to CARD mode when a cutout file is missing, fails to load, or fails RGBA validation', () => {
    // 1. Simulated missing cutout file on disk (`cutoutExistsOnDisk: false`)
    const missingDisk = resolveMonsterIntegratedProfile('wyvern', true, 'wyvern', {
      cutoutExistsOnDisk: false
    });
    assert.equal(missingDisk.hasIntegratedCutout, false);
    assert.equal(missingDisk.cutoutImageUrl, null);
    assert.equal(missingDisk.fallbackPresentation, 'CARD');
    assert.equal(missingDisk.fallbackReason, 'CUTOUT_FILE_MISSING_ON_DISK');
    assert.equal(missingDisk.renderContract.activeMode, 'CARD');
    assert.equal(missingDisk.renderContract.activeImageUrl, '/images/monsters/wyvern.png');

    // 2. Simulated browser image load error (`simulateLoadError: true`)
    const loadErr = resolveMonsterRenderMode('owlbear', 'INTEGRATED', {
      simulateLoadError: true
    });
    assert.equal(loadErr.hasVerifiedCutout, false);
    assert.equal(loadErr.activeMode, 'CARD');
    assert.equal(loadErr.didFallbackToCard, true);
    assert.equal(loadErr.fallbackReason, 'CLIENT_IMAGE_LOAD_ERROR');
    assert.equal(loadErr.activeImageUrl, '/images/monsters/owlbear.png');

    // 3. Verify client-side `handleMonsterImageError` handler is wired into public/action-ui.js
    const clientJs = fs.readFileSync(CLIENT_JS_PATH, 'utf8');
    assert.ok(clientJs.includes('function handleMonsterImageError(imgEl)'), 'action-ui.js must define handleMonsterImageError');
    assert.ok(clientJs.includes('onerror="handleMonsterImageError(this)"'), 'fp-monster-img must wire onerror="handleMonsterImageError(this)"');
    assert.ok(clientJs.includes('data-fallback-src='), 'fp-monster-img must include data-fallback-src');

    // 4. Invalid cutout metadata registration is rejected and preserves safe fallback
    const badReg = registerVerifiedCutoutMetadata('choker', {
      slug: 'choker',
      hasVerifiedCutout: true,
      validationMetrics: {
        colorType: 2, // RGB instead of RGBA
        transparentPixelRatio: 0.02,
        edgeTouchRatio: 0.55,
        contentBounds: { contentWidthRatio: 0.95, contentHeightRatio: 0.95 }
      }
    });
    assert.equal(badReg.ok, false);
    assert.equal(badReg.registered, false);
    assert.equal(badReg.fallbackPresentation, 'CARD');
  });

  it('6. Task 6 — Integrates scene-aware perspective calibration & distance transitions across Mirkwood Trail, Stone Bridge, Watchpost Ruins, and Deadman’s Mire', async () => {
    const landmarkChecks = [
      { scenario: 'WILDERNESS', monster: 'owlbear', expectedSceneKey: 'MIRKWOOD_TRAIL', expectedCorridor: 'FOREST_TRAIL', expectCutout: true },
      { scenario: 'BRIDGE', monster: 'minotaur', expectedSceneKey: 'OLD_STONE_BRIDGE', expectedCorridor: 'NARROW_BRIDGE', expectCutout: true },
      { scenario: 'DEADMANS_MIRE', monster: 'ochre_jelly', expectedSceneKey: 'DEADMANS_MIRE', expectedCorridor: 'FOREST_TRAIL', expectCutout: true },
      { scenario: 'ANCIENT_OAK', monster: 'displacer_beast', expectedSceneKey: 'MIRKWOOD_TRAIL', expectedCorridor: 'FOREST_TRAIL', expectCutout: false }
    ];

    for (const check of landmarkChecks) {
      await apiAction('LAB_SCENARIO', { scenario: check.scenario });
      const state = await apiAction('LAB_SCENARIO', {
        scenario: 'STAGE2_COMBAT',
        monsterName: check.monster,
        preserveFacing: true
      });

      assert.equal(state.mode, 'IN_COMBAT');
      assert.ok(state.encounter, `Expected active IN_COMBAT encounter for ${check.monster}`);
      assert.equal(state.encounter.monsterSlug, check.monster);
      assert.equal(state.encounter.hasIntegratedCutout, check.expectCutout);

      // Verify Track 3 scenePerspective calibration is attached to state.encounter
      assert.ok(state.encounter.scenePerspective, 'state.encounter must include scenePerspective');
      assert.equal(state.encounter.scenePerspective.sceneKey, check.expectedSceneKey);
      assert.equal(state.encounter.scenePerspective.corridorDepthType, check.expectedCorridor);

      // Verify Track 3 distanceTransition (20ft -> 16ft -> 12ft) is attached to state.encounter
      const tr = state.encounter.distanceTransition;
      assert.ok(tr, 'state.encounter must include distanceTransition');
      assert.equal(tr.fromDistanceFt, 20);
      assert.equal(tr.closingDistanceFt, 16);
      assert.equal(tr.toDistanceFt, 12);
      assert.ok(tr.distantScale.visibleHeightPx < tr.closingScale.visibleHeightPx);
      assert.ok(tr.closingScale.visibleHeightPx < tr.meleeScale.visibleHeightPx);
      assert.ok(tr.cssVars && tr.cssVars['--approach-start-scale']);
    }
  });

  it('7. Task 7 — Preserves strict Stage 1 (DISCOVERED) encounter secrecy and enforces Director scenario/alias spawning', async () => {
    // 1. Stage 1 Mystery / Shadow must NEVER leak monsterName, monsterSlug, imageUrl, or cutoutImageUrl
    const stage1State = await apiAction('LAB_SCENARIO', {
      scenario: 'SHADOW',
      monsterName: 'wyvern'
    });
    assert.equal(stage1State.mode, 'DISCOVERED');
    assert.equal(stage1State.encounter.status, 'DISCOVERED');
    assert.equal(stage1State.encounter.monsterName, undefined);
    assert.equal(stage1State.encounter.monsterSlug, undefined);
    assert.equal(stage1State.encounter.imageUrl, undefined);
    assert.equal(stage1State.encounter.cutoutImageUrl, undefined);
    assert.equal(stage1State.encounter.hasIntegratedCutout, undefined);
    assert.ok(stage1State.encounter.resolvedDescription && stage1State.encounter.resolvedDescription.length > 10);

    // 2. Investigate transitions Stage 1 -> Stage 2 IN_COMBAT and reveals Wyvern cutout
    const revealedState = await apiAction('INVESTIGATE');
    assert.equal(revealedState.mode, 'IN_COMBAT');
    assert.equal(revealedState.encounter.status, 'IN_COMBAT');
    assert.equal(revealedState.encounter.monsterSlug, 'wyvern');
    assert.equal(revealedState.encounter.hasIntegratedCutout, true);
    assert.equal(revealedState.encounter.cutoutImageUrl, '/lab-assets/images/monsters-cutout/wyvern.png');
    assert.equal(revealedState.encounter.isAirborne, true);

    // 3. Test Director aliases (skeleton -> human_skeleton, zombie -> human_zombie, giant_rat -> dire_rat, will_o_wisp -> will_o_wisp)
    const aliasChecks = [
      { query: 'skeleton', expectedSlug: 'human_skeleton', expectedCutout: true },
      { query: 'zombie', expectedSlug: 'human_zombie', expectedCutout: true },
      { query: 'giant_rat', expectedSlug: 'dire_rat', expectedCutout: true },
      { query: 'will_o_wisp', expectedSlug: 'will_o_wisp', expectedCutout: true },
      { query: 'creeping_vine', expectedSlug: 'assassin_vine', expectedCutout: true },
      { query: 'cockatrice', expectedSlug: 'cockatrice', expectedCutout: false }
    ];

    for (const item of aliasChecks) {
      const st = await apiAction('LAB_SCENARIO', {
        scenario: 'COMBAT',
        monsterName: item.query
      });
      assert.equal(st.encounter.status, 'IN_COMBAT');
      assert.equal(st.encounter.monsterSlug, item.expectedSlug);
      assert.equal(st.encounter.hasIntegratedCutout, item.expectedCutout);
    }

    // 4. Test Director WOUNDED and HEAL vitality scenarios
    const woundedState = await apiAction('LAB_SCENARIO', { scenario: 'WOUNDED' });
    assert.ok(woundedState.character.current_hp < woundedState.character.max_hp);
    const healedState = await apiAction('LAB_SCENARIO', { scenario: 'HEAL' });
    assert.equal(healedState.character.current_hp, healedState.character.max_hp);
  });

  it('8. Task 8 — Verifies multi-monster formations (1 to 4 creatures) and comparison presets with newly integrated cutouts across all 4 viewports', () => {
    const viewports = [
      [1920, 1080],
      [1440, 900],
      [1280, 800],
      [1024, 768]
    ];

    const formations = [
      ['owlbear'],
      ['kobold', 'goblin'],
      ['human_skeleton', 'human_zombie', 'skeletal_champion'],
      ['stirge', 'dire_rat', 'gnoll', 'minotaur'],
      ['giant_crab', 'rust_monster', 'ankheg']
    ];

    for (const [vpW, vpH] of viewports) {
      for (const group of formations) {
        const layout = computeMultiMonsterSceneLayout(group, {
          viewportWidth: vpW,
          viewportHeight: vpH,
          sceneTerrain: 'FOREST'
        });
        assert.equal(layout.monsterCount, group.length);
        assert.equal(layout.hasSilhouetteOverlap, false, `Overlap detected for [${group.join(',')}] at ${vpW}x${vpH}`);
        assert.equal(layout.maxPairwiseOverlapPx, 0);
        assert.equal(layout.withinViewportMargins, true);
        for (const slot of layout.slots) {
          assert.equal(slot.individualScale.presentationMode, 'INTEGRATED', `${slot.monsterSlug} must resolve in INTEGRATED mode inside multi-monster layout`);
        }
      }

      // Check buildVisualComparisonPresets at this viewport
      const presets = buildVisualComparisonPresets({ width: vpW, height: vpH });
      const prog5 = presets.presets.SIZE_PROGRESSION_5.specimens;
      assert.equal(prog5.length, 5);
      for (let i = 0; i < prog5.length; i++) {
        assert.equal(prog5[i].adaptive.presentationMode, 'INTEGRATED', `SIZE_PROGRESSION_5 specimen ${prog5[i].slug} must now use INTEGRATED mode`);
        if (i > 0) {
          assert.ok(prog5[i].adaptive.visibleHeightPx > prog5[i - 1].adaptive.visibleHeightPx);
        }
      }
    }
  });
});
