/**
 * Darkgrid Action UI Lab — Track 3: Monster Size, Perspective & Scene Integration Test Suite
 * Strictly self-contained inside action-ui-lab/.
 * Run with: node --test action-ui-lab/tests/monster-scaling.test.js
 */

'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  PF1E_SIZE_CATEGORIES,
  VISUAL_BODY_PROFILES,
  MONSTER_SIZE_CATALOG,
  PF1E_SIZE_REFERENCE_SPECIMENS,
  CORRIDOR_DEPTH_TYPES,
  SCENE_PERSPECTIVE_PROFILES,
  ENCOUNTER_DISTANCE_BANDS,
  CUTOUT_ASSET_CONTRACT,
  lookupMonsterSizeEntry,
  resolveScenePerspectiveCalibration,
  resolveEncounterDistanceFt,
  classifyEncounterDistanceBand,
  computeAdaptiveMonsterVisualScale,
  computeEncounterDistanceTransition,
  computeMultiMonsterSceneLayout,
  validateCutoutAssetMetadata,
  registerVerifiedCutoutMetadata,
  resetCutoutMetadataToBaseline,
  ingestArtworkInventoryManifest,
  buildVisualComparisonPresets,
  getCatalogAuditSummary
} = require('../monster-size-catalog');

const ALL_SPECIMENS = [...MONSTER_SIZE_CATALOG, ...PF1E_SIZE_REFERENCE_SPECIMENS];
const CANONICAL_9_TIER_LINEUP = [
  'ref_fine_spore_mite',   // 1. FINE
  'ref_diminutive_toad',   // 2. DIMINUTIVE
  'viper',                 // 3. TINY
  'kobold',                // 4. SMALL
  'wolf',                  // 5. MEDIUM
  'troll',                 // 6. LARGE
  'ref_huge_elder_troll',  // 7. HUGE
  'ref_gargantuan_wyrm',   // 8. GARGANTUAN
  'ref_colossal_titan'     // 9. COLOSSAL
];

describe('Track 3 — Pathfinder 1e Monster Size, Perspective & Scene Integration Suite', () => {
  afterEach(() => {
    resetCutoutMetadataToBaseline();
  });

  it('0. Preserves all 98 cataloged DB monsters, 5 PF1e reference specimens, 9 size categories, all body profiles, and backwards-compatible defaults', () => {
    const expectedSizes = ['FINE', 'DIMINUTIVE', 'TINY', 'SMALL', 'MEDIUM', 'LARGE', 'HUGE', 'GARGANTUAN', 'COLOSSAL'];
    assert.deepEqual(Object.keys(PF1E_SIZE_CATEGORIES), expectedSizes);
    assert.equal(MONSTER_SIZE_CATALOG.length, 98);
    assert.equal(PF1E_SIZE_REFERENCE_SPECIMENS.length, 5);
    assert.ok(Object.keys(VISUAL_BODY_PROFILES).length >= 18);

    const summary = getCatalogAuditSummary();
    assert.equal(summary.totalDatabaseMonsters, 98);
    assert.equal(summary.coreMonstersCount, 68);
    assert.equal(summary.expansionMonstersCount, 30);
    assert.equal(summary.supportedPfSizeCategoriesCount, 9);
    assert.equal(summary.verifiedCutoutCount, 37);
    assert.equal(summary.cardFallbackCount, 61);

    // Verify Spriggan dual-size support (Small base -> Large override)
    const sprigganSmall = computeAdaptiveMonsterVisualScale('spriggan', { viewportWidth: 1920, viewportHeight: 1080 });
    const sprigganLarge = computeAdaptiveMonsterVisualScale('spriggan', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      overridePfSize: 'LARGE'
    });
    assert.equal(sprigganSmall.pfSizeCategory, 'SMALL');
    assert.equal(sprigganLarge.pfSizeCategory, 'LARGE');
    assert.ok(sprigganLarge.visibleHeightPx > sprigganSmall.visibleHeightPx * 1.5);
  });

  it('1. Focus Area 1 — Calibrates perspective, ground sink, shadow softness, and corridor width across real combat scenes', () => {
    assert.deepEqual(
      Object.keys(CORRIDOR_DEPTH_TYPES),
      ['OPEN_FIELD', 'FOREST_TRAIL', 'NARROW_BRIDGE', 'INTERIOR_RUIN']
    );

    const scenes = [
      { opts: { sceneTerrain: 'FOREST', tileX: 7, tileY: 5 }, expectedKey: 'MIRKWOOD_TRAIL', expectedCorridor: 'FOREST_TRAIL', expectedFloorY: 82 },
      { opts: { sceneTerrain: 'BRIDGE', tileX: 8, tileY: 7 }, expectedKey: 'OLD_STONE_BRIDGE', expectedCorridor: 'NARROW_BRIDGE', expectedFloorY: 80 },
      { opts: { sceneTerrain: 'SWAMP', tileX: 4, tileY: 11 }, expectedKey: 'DEADMANS_MIRE', expectedCorridor: 'FOREST_TRAIL', expectedFloorY: 84 },
      { opts: { sceneTerrain: 'UNDERGROUND_RUINS', tileX: 9, tileY: 7 }, expectedKey: 'WATCHPOST_RUINS', expectedCorridor: 'INTERIOR_RUIN', expectedFloorY: 81 },
      { opts: { sceneTerrain: 'PLAINS' }, expectedKey: 'VERDANT_PLAINS', expectedCorridor: 'OPEN_FIELD', expectedFloorY: 83 }
    ];

    for (const s of scenes) {
      const cal = resolveScenePerspectiveCalibration(s.opts);
      assert.equal(cal.sceneKey, s.expectedKey);
      assert.equal(cal.corridorDepthType, s.expectedCorridor);
      assert.equal(cal.stageFloorY, s.expectedFloorY);
      assert.equal(cal.isCustomSceneCalibrated, true);
    }

    // Compare a grounded monster (Wolf) across Stone Bridge vs Mirkwood Trail vs Deadman's Mire
    const wolfBridge = computeAdaptiveMonsterVisualScale('wolf', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      sceneTerrain: 'BRIDGE'
    });
    const wolfForest = computeAdaptiveMonsterVisualScale('wolf', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      sceneTerrain: 'FOREST'
    });
    const wolfMire = computeAdaptiveMonsterVisualScale('wolf', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      sceneTerrain: 'SWAMP'
    });

    // Ground sink is firmer on stone bridge than forest soil, and deepest in swamp mud
    assert.ok(wolfBridge.positioning.groundSinkPx < wolfForest.positioning.groundSinkPx);
    assert.ok(wolfForest.positioning.groundSinkPx < wolfMire.positioning.groundSinkPx);

    // Shadow blur is crisper on stone bridge and softer/diffused in swamp mire
    assert.ok(wolfBridge.shadow.shadowBlurPx <= wolfForest.shadow.shadowBlurPx);
    assert.ok(wolfForest.shadow.shadowBlurPx <= wolfMire.shadow.shadowBlurPx);

    // Narrow bridge enforces tighter horizontal width ceiling than open field
    const spiderBridge = computeAdaptiveMonsterVisualScale('giant_scorpion', {
      viewportWidth: 1280,
      viewportHeight: 800,
      corridorDepthType: 'NARROW_BRIDGE'
    });
    const spiderField = computeAdaptiveMonsterVisualScale('giant_scorpion', {
      viewportWidth: 1280,
      viewportHeight: 800,
      corridorDepthType: 'OPEN_FIELD'
    });
    assert.ok(spiderBridge.clamping.maxSafeWidthPx < spiderField.clamping.maxSafeWidthPx);
  });

  it('2. Focus Area 2 — Resolves virtual distance bands (20ft, 16ft, 12ft, 9ft), perspective horizon shifts, and preserves size ordering at any distance', () => {
    assert.equal(resolveEncounterDistanceFt({ encounterDistanceBand: 'DISTANT_SIGHTING' }), 20);
    assert.equal(resolveEncounterDistanceFt({ encounterDistanceStage: 'DISTANT' }), 20);
    assert.equal(resolveEncounterDistanceFt({ encounterDistanceBand: 'RANGED_ENGAGEMENT' }), 16);
    assert.equal(resolveEncounterDistanceFt({ encounterDistanceStage: 'CLOSING' }), 16);
    assert.equal(resolveEncounterDistanceFt({ encounterDistanceBand: 'MELEE_ENGAGEMENT' }), 12);
    assert.equal(resolveEncounterDistanceFt({ encounterDistanceStage: 'MELEE' }), 12);
    assert.equal(resolveEncounterDistanceFt({ encounterDistanceBand: 'CLOSE_PRESS' }), 9);
    assert.equal(resolveEncounterDistanceFt({ virtualDistanceFt: 18 }), 18);
    assert.equal(resolveEncounterDistanceFt({}), 12);

    const bands = ['DISTANT_SIGHTING', 'RANGED_ENGAGEMENT', 'MELEE_ENGAGEMENT', 'CLOSE_PRESS'];
    const wolfScales = bands.map(b =>
      computeAdaptiveMonsterVisualScale('wolf', {
        viewportWidth: 1920,
        viewportHeight: 1080,
        encounterDistanceBand: b
      })
    );

    // As distance decreases (20 -> 16 -> 12 -> 9 ft), visible height & width strictly increase
    for (let i = 1; i < wolfScales.length; i++) {
      assert.ok(
        wolfScales[i].visibleHeightPx > wolfScales[i - 1].visibleHeightPx,
        `Expected height at ${bands[i]} (${wolfScales[i].visibleHeightPx}) > ${bands[i - 1]} (${wolfScales[i - 1].visibleHeightPx})`
      );
      assert.ok(
        wolfScales[i].positioning.groundContactY > wolfScales[i - 1].positioning.groundContactY,
        'Closer creatures must anchor lower on the perspective ground plane than distant creatures'
      );
    }

    // Distant sighting shifts upward toward horizon (< 0 px); melee (12 ft) is 0 px; close press shifts downward (> 0 px)
    assert.ok(wolfScales[0].positioning.perspectiveHorizonShiftPx < 0);
    assert.ok(wolfScales[1].positioning.perspectiveHorizonShiftPx < 0);
    assert.equal(wolfScales[2].positioning.perspectiveHorizonShiftPx, 0);
    assert.ok(wolfScales[3].positioning.perspectiveHorizonShiftPx > 0);

    // Verify strict monotonic PF1e size ordering across all 9 tiers at EVERY distance band
    for (const distFt of [20, 16, 12, 9]) {
      const lineup = CANONICAL_9_TIER_LINEUP.map(slug =>
        computeAdaptiveMonsterVisualScale(slug, {
          viewportWidth: 1920,
          viewportHeight: 1080,
          virtualDistanceFt: distFt
        })
      );
      for (let i = 1; i < lineup.length; i++) {
        assert.ok(
          lineup[i].visibleHeightPx > lineup[i - 1].visibleHeightPx,
          `At ${distFt}ft, expected ${lineup[i].pfSizeCategory} (${lineup[i].visibleHeightPx}px) > ${lineup[i - 1].pfSizeCategory} (${lineup[i - 1].visibleHeightPx}px)`
        );
      }
    }
  });

  it('3. Focus Area 3 — Computes smooth distant-to-melee encounter transitions (Stage 1 / Opening Shot 20ft -> Melee 12ft)', () => {
    for (const slug of ['stirge', 'goblin', 'wolf', 'skeletal_champion', 'troll', 'manticore', 'ref_huge_elder_troll']) {
      const tr = computeEncounterDistanceTransition(slug, {
        viewportWidth: 1920,
        viewportHeight: 1080,
        fromDistanceFt: 20,
        toDistanceFt: 12
      });

      assert.equal(tr.monsterSlug, slug);
      assert.equal(tr.fromDistanceFt, 20);
      assert.equal(tr.closingDistanceFt, 16);
      assert.equal(tr.toDistanceFt, 12);
      assert.ok(tr.distantScale.visibleHeightPx < tr.closingScale.visibleHeightPx);
      assert.ok(tr.closingScale.visibleHeightPx < tr.meleeScale.visibleHeightPx);
      assert.ok(tr.scaleRatio > 0.45 && tr.scaleRatio < 0.85, `Expected scaleRatio in (0.45, 0.85), got ${tr.scaleRatio}`);
      assert.ok(tr.growthMultiplier > 1.15);
      assert.ok(tr.translateYDeltaPx < -15, `Expected negative translateYDeltaPx for horizon approach, got ${tr.translateYDeltaPx}`);
      assert.ok(tr.durationMs >= 300 && tr.durationMs <= 700);
      assert.ok(tr.cssTransition.includes(`${tr.durationMs}ms`));
      assert.equal(tr.cssVars['--approach-start-scale'], String(tr.scaleRatio));
      assert.equal(tr.cssVars['--approach-start-y'], `${tr.translateYDeltaPx}px`);
    }
  });

  it('4. Focus Area 4 — Enforces unmistakable airborne hover separation vs grounded foot/paw/root contact across all 103 specimens', () => {
    let airborneCount = 0;
    let groundedCount = 0;

    for (const entry of ALL_SPECIMENS) {
      const sc = computeAdaptiveMonsterVisualScale(entry, {
        viewportWidth: 1920,
        viewportHeight: 1080
      });

      if (sc.positioning.isAirborne) {
        airborneCount++;
        assert.ok(sc.positioning.airborneHoverAltitudePx >= 14, `${entry.slug} must have positive airborneHoverAltitudePx`);
        assert.ok(sc.positioning.airborneGapPx >= 24, `${entry.slug} must have unmistakable air gap >= 24px`);
        assert.ok(sc.positioning.verticalOffsetPx <= -14, `${entry.slug} must have negative (upward) verticalOffsetPx`);
        assert.equal(sc.positioning.groundSinkPx, 0, `${entry.slug} must not sink into ground`);
        assert.equal(sc.shadow.contactPatches.length, 0, `Airborne ${entry.slug} must have zero ground contact patches`);
        assert.equal(sc.shadow.contactPatchGeometry.hasGroundContact, false);
        assert.ok(sc.shadow.contactPatchGeometry.detachedShadowGapPx >= 24);
        assert.ok(sc.shadow.ambientPatch.topPct >= 110, `Airborne ${entry.slug} ambient shadow must sit detached below container`);
        assert.ok(sc.shadow.shadowOpacity <= 0.58, `Airborne ${entry.slug} shadow must be diffused`);
      } else {
        groundedCount++;
        assert.equal(sc.positioning.airborneHoverAltitudePx, 0, `Grounded ${entry.slug} must have 0 hover altitude`);
        assert.equal(sc.positioning.airborneGapPx, 0);
        assert.ok(sc.positioning.verticalOffsetPx > 0, `Grounded ${entry.slug} must plant feet onto floor with positive verticalOffsetPx`);
        assert.ok(sc.positioning.groundSinkPx >= 6);
        assert.ok(sc.shadow.contactPatches.length >= 2, `Grounded ${entry.slug} must have >= 2 anatomical contact shadow patches`);
        assert.equal(sc.shadow.contactPatchGeometry.hasGroundContact, true);
        assert.equal(sc.shadow.contactPatchGeometry.patchCount, sc.shadow.contactPatches.length);
      }
    }

    assert.ok(airborneCount >= 14, `Expected >= 14 airborne monsters in catalog, got ${airborneCount}`);
    assert.ok(groundedCount >= 84, `Expected >= 84 grounded monsters in catalog, got ${groundedCount}`);
  });

  it('5. Focus Area 5 — Prevents horizontal clipping and preserves aspect ratio for very wide creatures across viewports', () => {
    const wideProfiles = ['ARACHNID_WIDE', 'ARACHNID_CHITIN_LARGE', 'AMORPHOUS_LARGE_OOZE', 'WINGED_LARGE_PREDATOR', 'ARACHNID_SMALL_SKIMMER', 'AMORPHOUS_MEDIUM_OOZE'];
    const wideMonsters = MONSTER_SIZE_CATALOG.filter(m => wideProfiles.includes(m.visualBodyProfile));
    assert.ok(wideMonsters.length >= 18, `Expected >= 18 wide-silhouette monsters, found ${wideMonsters.length}`);

    const viewports = [
      [1920, 1080],
      [1440, 900],
      [1280, 800],
      [1024, 768]
    ];

    for (const [vpW, vpH] of viewports) {
      for (const m of wideMonsters) {
        for (const corridor of ['FOREST_TRAIL', 'NARROW_BRIDGE', 'OPEN_FIELD']) {
          const sc = computeAdaptiveMonsterVisualScale(m, {
            viewportWidth: vpW,
            viewportHeight: vpH,
            corridorDepthType: corridor
          });
          assert.ok(sc.visibleWidthPx > sc.visibleHeightPx, `Wide creature ${m.slug} must remain wider than tall at ${vpW}x${vpH}`);
          assert.ok(
            sc.visibleWidthPx <= sc.clamping.maxSafeWidthPx,
            `${m.slug} width (${sc.visibleWidthPx}px) exceeded maxSafeWidthPx (${sc.clamping.maxSafeWidthPx}px) at ${vpW}x${vpH} on ${corridor}`
          );
          assert.ok(
            sc.clamping.horizontalClearancePx >= Math.round(vpW * 0.50),
            `${m.slug} must leave >= 50% horizontal viewport clearance at ${vpW}x${vpH}`
          );
          assert.ok(
            sc.clamping.aspectRatioDrift <= 0.025,
            `${m.slug} aspect ratio drift (${sc.clamping.aspectRatioDrift}) exceeded 0.025 at ${vpW}x${vpH}`
          );
        }
      }
    }
  });

  it('6. Focus Areas 6 & 7 — Enforces soft-knee asymptotic UI clamp, HUD crown/foot clearance, and zero aspect-ratio distortion across 1920x1080, 1440x900, 1280x800, and 1024x768', () => {
    const viewports = [
      [1920, 1080],
      [1440, 900],
      [1280, 800],
      [1024, 768]
    ];

    for (const [vpW, vpH] of viewports) {
      // 1. Check strict monotonic ordering across all 9 PF1e size categories
      const tierScales = CANONICAL_9_TIER_LINEUP.map(slug =>
        computeAdaptiveMonsterVisualScale(slug, { viewportWidth: vpW, viewportHeight: vpH })
      );

      for (let i = 1; i < tierScales.length; i++) {
        const prev = tierScales[i - 1];
        const curr = tierScales[i];
        assert.ok(
          curr.visibleHeightPx > prev.visibleHeightPx,
          `At ${vpW}x${vpH}, expected ${curr.pfSizeCategory} (${curr.visibleHeightPx}px) > ${prev.pfSizeCategory} (${prev.visibleHeightPx}px)`
        );
      }

      // Huge, Gargantuan, Colossal must engage soft-knee UI clamp while keeping safe crown & foot clearance
      for (const giant of tierScales.slice(6)) {
        assert.equal(giant.clamping.wasClamped, true, `${giant.monsterSlug} must engage soft-knee clamp at ${vpW}x${vpH}`);
        assert.ok(giant.visibleHeightPx <= giant.clamping.maxSafeHeightPx);
        assert.ok(giant.visibleWidthPx <= giant.clamping.maxSafeWidthPx);
        assert.ok(giant.clamping.crownClearancePx >= 8, `${giant.monsterSlug} needs safe top HUD crown clearance at ${vpW}x${vpH}`);
        assert.ok(giant.clamping.footAboveBottomDeckPx >= 8, `${giant.monsterSlug} needs safe bottom chronicle clearance at ${vpW}x${vpH}`);
      }

      // 2. Sweep all 103 specimens at this resolution
      for (const spec of ALL_SPECIMENS) {
        const sc = computeAdaptiveMonsterVisualScale(spec, { viewportWidth: vpW, viewportHeight: vpH });
        assert.ok(sc.visibleHeightPx >= sc.clamping.effectiveMinHeightPx);
        assert.ok(sc.visibleHeightPx <= sc.clamping.maxSafeHeightPx);
        assert.ok(sc.visibleWidthPx <= sc.clamping.maxSafeWidthPx);
        if (!sc.clamping.minFloorEngaged) {
          assert.ok(
            sc.clamping.aspectRatioDrift <= 0.025,
            `Aspect ratio distortion on ${spec.slug} at ${vpW}x${vpH}: drift=${sc.clamping.aspectRatioDrift}`
          );
        }
      }
    }
  });

  it('8. Focus Area 8 — Layouts 1 to 4 creatures in a single scene with depth-staggered slots, zero silhouette overlap, and viewport margin safety', () => {
    const scenarios = [
      { name: 'Solo Troll', monsters: ['troll'], expectedCount: 1 },
      { name: 'Goblin Scouting Pair', monsters: ['goblin', 'goblin'], expectedCount: 2 },
      { name: 'Wolf Pack (3)', monsters: ['wolf', 'timber_wolf', 'wolf'], expectedCount: 3 },
      { name: 'Mixed Warband (4)', monsters: ['goblin', 'orc', 'orc_warchief', 'ogre'], expectedCount: 4 },
      { name: 'Wide Arachnid Swarm (3)', monsters: ['giant_spider', 'phase_spider', 'giant_scorpion'], expectedCount: 3 },
      { name: 'Large Brute Trio on Bridge', monsters: ['troll', 'minotaur', 'ogre'], expectedCount: 3, corridorDepthType: 'NARROW_BRIDGE' }
    ];

    for (const [vpW, vpH] of [[1920, 1080], [1440, 900], [1280, 800], [1024, 768]]) {
      for (const sc of scenarios) {
        const layout = computeMultiMonsterSceneLayout(sc.monsters, {
          viewportWidth: vpW,
          viewportHeight: vpH,
          corridorDepthType: sc.corridorDepthType || 'FOREST_TRAIL'
        });

        assert.equal(layout.monsterCount, sc.expectedCount);
        assert.equal(layout.slots.length, sc.expectedCount);
        assert.equal(layout.hasSilhouetteOverlap, false, `Unexpected silhouette overlap in "${sc.name}" at ${vpW}x${vpH}`);
        assert.equal(layout.maxPairwiseOverlapPx, 0);
        assert.equal(layout.withinViewportMargins, true, `Slots overflowed viewport margins in "${sc.name}" at ${vpW}x${vpH}`);

        // Verify slots are ordered left-to-right with distinct slotXPercent, valid slotDepthFt, zIndex, and individualScale
        for (let i = 0; i < layout.slots.length; i++) {
          const slot = layout.slots[i];
          assert.ok(slot.slotXPercent > 5 && slot.slotXPercent < 95);
          assert.ok(slot.slotDepthFt >= 12 && slot.slotDepthFt <= 20);
          assert.ok(typeof slot.zIndex === 'number');
          assert.ok(slot.individualScale && slot.individualScale.visibleWidthPx === slot.visibleWidthPx);
          if (i > 0) {
            assert.ok(
              slot.slotXPercent > layout.slots[i - 1].slotXPercent,
              `Slot ${i} must be positioned to the right of slot ${i - 1}`
            );
            assert.ok(
              slot.leftEdgePx >= layout.slots[i - 1].rightEdgePx,
              `Slot ${i} leftEdgePx (${slot.leftEdgePx}) overlapped slot ${i - 1} rightEdgePx (${layout.slots[i - 1].rightEdgePx})`
            );
          }
        }

        // Verify backToFrontSlots is sorted by slotDepthFt descending (painter's algorithm order)
        for (let i = 1; i < layout.backToFrontSlots.length; i++) {
          assert.ok(layout.backToFrontSlots[i - 1].slotDepthFt >= layout.backToFrontSlots[i].slotDepthFt);
        }
      }
    }

    // Verify mixed-size relative ordering inside a multi-monster layout (Goblin < Orc < Ogre)
    const mixedLayout = computeMultiMonsterSceneLayout(['goblin', 'orc', 'ogre'], {
      viewportWidth: 1920,
      viewportHeight: 1080
    });
    assert.ok(mixedLayout.slots[0].visibleHeightPx < mixedLayout.slots[1].visibleHeightPx);
    assert.ok(mixedLayout.slots[1].visibleHeightPx < mixedLayout.slots[2].visibleHeightPx);
  });

  it('9. Focus Area 9 — Provides clean Card fallback framing that preserves PF1e size and body-profile aspect ratio', () => {
    // 1. Monster without an RGBA cutout automatically falls back to CARD with NO_VERIFIED_RGBA_CUTOUT
    const phaseSpiderScale = computeAdaptiveMonsterVisualScale('phase_spider', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      presentationMode: 'INTEGRATED'
    });
    assert.equal(phaseSpiderScale.presentationMode, 'CARD');
    assert.equal(phaseSpiderScale.requestedPresentationMode, 'INTEGRATED');
    assert.equal(phaseSpiderScale.fallbackReason, 'NO_VERIFIED_RGBA_CUTOUT');
    assert.equal(phaseSpiderScale.cardFrameStyle.mode, 'CARD');
    assert.equal(phaseSpiderScale.cardFrameStyle.objectFit, 'cover');
    assert.ok(phaseSpiderScale.cardAspectRatio > 1.25, 'Wide Phase Spider card must use wide aspect ratio instead of uniform 1:1 square');

    // Rust Monster (Track 4 cutout integrated in Track 5) supports both INTEGRATED and wide CARD fallback
    const rustCard = computeAdaptiveMonsterVisualScale('rust_monster', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      presentationMode: 'CARD'
    });
    assert.equal(rustCard.presentationMode, 'CARD');
    assert.ok(rustCard.cardAspectRatio > 1.4, 'Wide Rust Monster card must use wide aspect ratio instead of uniform 1:1 square');

    // 2. Monster with an RGBA cutout explicitly requested in CARD mode uses EXPLICIT_CARD_MODE_REQUESTED
    const wolfCard = computeAdaptiveMonsterVisualScale('wolf', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      presentationMode: 'CARD'
    });
    assert.equal(wolfCard.presentationMode, 'CARD');
    assert.equal(wolfCard.fallbackReason, 'EXPLICIT_CARD_MODE_REQUESTED');
    assert.ok(wolfCard.vignetteTrimScale > 1.15, 'Wolf card must apply vignetteTrimScale to compensate for 25% dark border');
    assert.equal(wolfCard.cardFrameStyle.vignetteTrimScale, wolfCard.vignetteTrimScale);

    // 3. Macro close-up Tiny card (Stirge) keeps vignetteTrimScale === 1.0 so foreground branch is not over-zoomed
    const stirgeCard = computeAdaptiveMonsterVisualScale('stirge', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      presentationMode: 'CARD'
    });
    assert.equal(stirgeCard.vignetteTrimScale, 1.0);
    assert.equal(stirgeCard.cardFrameStyle.shadowGrounding, 'DETACHED_FLOAT_SHADOW');
  });

  it('10. Focus Area 10 — Validates and dynamically registers new RGBA cutout metadata (Tracks 4 & 5 Contract) with safe fallback', () => {
    assert.equal(CUTOUT_ASSET_CONTRACT.requiredColorType, 6);
    assert.equal(CUTOUT_ASSET_CONTRACT.minTransparentPixelRatio, 0.12);

    // Before registration, Hobgoblin (61 Card fallback batch) uses CARD fallback
    const hobgoblinBefore = computeAdaptiveMonsterVisualScale('hobgoblin', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      presentationMode: 'INTEGRATED'
    });
    assert.equal(hobgoblinBefore.presentationMode, 'CARD');
    assert.equal(hobgoblinBefore.fallbackReason, 'NO_VERIFIED_RGBA_CUTOUT');

    // Register a verified cutout for Hobgoblin
    const regRes = registerVerifiedCutoutMetadata('hobgoblin', {
      slug: 'hobgoblin',
      hasVerifiedCutout: true,
      status: 'NEWLY_PRODUCED_VERIFIED',
      cutoutPath: 'action-ui-lab/public/images/monsters-cutout/hobgoblin.png',
      validationMetrics: {
        colorType: 6,
        transparentPixelRatio: 0.48,
        edgeTouchRatio: 0.04,
        contentBounds: {
          width: 1024,
          height: 1024,
          minX: 140,
          minY: 96,
          maxX: 880,
          maxY: 980,
          contentWidthRatio: 0.723,
          contentHeightRatio: 0.863,
          topPadRatio: 0.094,
          bottomPadRatio: 0.043,
          leftPadRatio: 0.137,
          rightPadRatio: 0.140
        }
      }
    });

    assert.equal(regRes.ok, true);
    assert.equal(regRes.registered, true);
    assert.equal(regRes.fallbackPresentation, 'INTEGRATED');
    assert.equal(regRes.entry.hasCutout, true);
    assert.equal(regRes.entry.cutoutImagePath, '/lab-assets/images/monsters-cutout/hobgoblin.png');
    assert.ok(regRes.integratedProfile && regRes.integratedProfile.contactPatches.length >= 2);

    // Now Hobgoblin resolves in INTEGRATED mode with its measured cutout bounds
    const hobgoblinAfter = computeAdaptiveMonsterVisualScale('hobgoblin', {
      viewportWidth: 1920,
      viewportHeight: 1080,
      presentationMode: 'INTEGRATED'
    });
    assert.equal(hobgoblinAfter.presentationMode, 'INTEGRATED');
    assert.equal(hobgoblinAfter.fallbackReason, null);
    assert.equal(hobgoblinAfter.contentBounds.contentHeightRatio, 0.863);

    // Invalid cutout metadata (e.g. non-RGBA colorType 2 or low transparency) must be rejected and fall back to CARD
    const invalidRes = registerVerifiedCutoutMetadata('orc_warchief', {
      slug: 'orc_warchief',
      hasVerifiedCutout: true,
      validationMetrics: {
        colorType: 2, // RGB without alpha!
        transparentPixelRatio: 0.01,
        edgeTouchRatio: 0.65,
        contentBounds: {
          contentWidthRatio: 0.95,
          contentHeightRatio: 0.95
        }
      }
    });
    assert.equal(invalidRes.ok, false);
    assert.equal(invalidRes.registered, false);
    assert.equal(invalidRes.fallbackPresentation, 'CARD');
    assert.ok(invalidRes.validation.errors.length >= 2);

    // Test batch manifest ingestion via ingestArtworkInventoryManifest
    const manifestResult = ingestArtworkInventoryManifest({
      monsters: [
        {
          slug: 'displacer_beast',
          hasVerifiedCutout: true,
          status: 'NEWLY_PRODUCED_VERIFIED',
          cutoutPath: '/lab-assets/images/monsters-cutout/displacer_beast.png',
          validationMetrics: {
            colorType: 6,
            transparentPixelRatio: 0.36,
            edgeTouchRatio: 0.08,
            contentBounds: {
              contentWidthRatio: 0.78,
              contentHeightRatio: 0.91,
              topPadRatio: 0.05,
              bottomPadRatio: 0.04,
              leftPadRatio: 0.11,
              rightPadRatio: 0.11
            }
          }
        },
        {
          slug: 'choker',
          hasVerifiedCutout: false,
          status: 'CARD_FALLBACK_RETAINED'
        }
      ]
    });
    assert.equal(manifestResult.ok, true);
    assert.equal(manifestResult.registeredCount, 1);
    assert.equal(manifestResult.fallbackCount, 1);
    assert.equal(lookupMonsterSizeEntry('displacer_beast').hasCutout, true);
    assert.equal(lookupMonsterSizeEntry('choker').hasCutout, false);
  });

  it('11. Phase 3 — Synthesizes deterministic fallback size and body profile metadata when uncataloged or partial monster data is passed', () => {
    const tinyFlier = computeAdaptiveMonsterVisualScale({
      name: 'Shadow Batling',
      size: 'Tiny',
      movement_type: 'FLYING'
    }, { viewportWidth: 1920, viewportHeight: 1080 });
    assert.equal(tinyFlier.isFallbackMetadata, true);
    assert.equal(tinyFlier.pfSizeCategory, 'TINY');
    assert.equal(tinyFlier.visualBodyProfile, 'FLYING_SMALL_PEST');
    assert.equal(tinyFlier.positioning.isAirborne, true);
    assert.equal(tinyFlier.presentationMode, 'CARD');

    const hugeBrute = computeAdaptiveMonsterVisualScale({
      name: 'Frost Behemoth',
      height: 24,
      type: 'Giant'
    }, { viewportWidth: 1920, viewportHeight: 1080 });
    assert.equal(hugeBrute.isFallbackMetadata, true);
    assert.equal(hugeBrute.pfSizeCategory, 'HUGE');
    assert.equal(hugeBrute.visualBodyProfile, 'BIPED_LARGE_BRUTE');
    assert.equal(hugeBrute.positioning.isAirborne, false);
    assert.ok(hugeBrute.visibleHeightPx > tinyFlier.visibleHeightPx * 2.2);

    const unknownDefault = computeAdaptiveMonsterVisualScale({
      name: 'Mysterious Outcast'
    }, { viewportWidth: 1920, viewportHeight: 1080 });
    assert.equal(unknownDefault.isFallbackMetadata, true);
    assert.equal(unknownDefault.pfSizeCategory, 'MEDIUM');
    assert.equal(unknownDefault.visualBodyProfile, 'BIPED_MEDIUM');
  });
});
