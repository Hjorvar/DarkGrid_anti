'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MONSTER_SIZE_CATALOG,
  PF1E_SIZE_REFERENCE_SPECIMENS
} = require('../monster-size-catalog');
const {
  EXISTING_APPROVED_SLUGS,
  inspectImageBinaryHeader,
  validateCutoutRgbaBuffer
} = require('../scripts/produce-monster-cutouts');

const ROOT_DIR = path.resolve(__dirname, '../..');
const LAB_DIR = path.resolve(__dirname, '..');
const CUTOUT_DIR = path.join(LAB_DIR, 'public/images/monsters-cutout');
const INVENTORY_PATH = path.join(LAB_DIR, 'monster-artwork-inventory.json');

describe('Track 4 — Monster Artwork Inventory & RGBA Cutout Validation Suite', () => {
  it('1. Inventory manifest exists and covers all 98 canonical database monsters (68 Core + 30 Expansion)', () => {
    assert.ok(fs.existsSync(INVENTORY_PATH), 'monster-artwork-inventory.json must exist');
    const manifest = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

    assert.equal(manifest.summary.totalDatabaseMonsters, 98, 'Must contain exactly 98 database monsters');
    assert.equal(manifest.summary.core68Count, 68, 'Must contain 68 Core monsters');
    assert.equal(manifest.summary.seed010ExpansionCount, 30, 'Must contain 30 Seed-010 Expansion monsters');
    assert.equal(manifest.monsters.length, 98, 'monsters array length must be 98');
    assert.equal(
      manifest.referenceSpecimens.length,
      PF1E_SIZE_REFERENCE_SPECIMENS.length,
      'Must document the 5 PF1e reference specimens separately'
    );

    const catalogSlugs = new Set(MONSTER_SIZE_CATALOG.map(m => m.slug));
    const manifestSlugs = new Set(manifest.monsters.map(m => m.slug));
    assert.deepEqual(manifestSlugs, catalogSlugs, 'Inventory slugs must match MONSTER_SIZE_CATALOG 1-to-1');
  });

  it('2. Every monster source artwork and defeated artwork exists and has valid binary format metadata', () => {
    const manifest = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    let pngCount = 0;
    let jpegInPngCount = 0;

    for (const m of manifest.monsters) {
      const srcDiskPath = path.join(ROOT_DIR, m.sourceArtwork.diskPath);
      assert.ok(fs.existsSync(srcDiskPath), `Missing source artwork for ${m.slug}: ${srcDiskPath}`);

      const buf = fs.readFileSync(srcDiskPath);
      const header = inspectImageBinaryHeader(buf);
      assert.equal(header.actualFormat, m.sourceArtwork.actualBinaryFormat, `Format mismatch for ${m.slug}`);
      assert.ok(header.width >= 512 && header.height >= 512, `Invalid dimensions for ${m.slug}`);
      assert.ok(m.sourceArtwork.defeatedArtworkPath, `Missing defeated artwork path for ${m.slug}`);

      if (header.actualFormat === 'PNG') pngCount++;
      if (header.actualFormat === 'JPEG_IN_PNG') jpegInPngCount++;
    }

    assert.equal(pngCount + jpegInPngCount, 98, 'All 98 source files must be PNG or JPEG_IN_PNG');
    assert.equal(manifest.summary.sourceFormatBreakdown.truePngCount, pngCount);
    assert.equal(manifest.summary.sourceFormatBreakdown.jpegInPngExtensionCount, jpegInPngCount);
  });

  it('3. All 7 baseline approved cutouts are preserved intact and pass strict RGBA validation', () => {
    const manifest = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    for (const slug of EXISTING_APPROVED_SLUGS) {
      const item = manifest.monsters.find(m => m.slug === slug);
      assert.ok(item, `Baseline monster ${slug} must be in inventory`);
      assert.equal(item.status, 'EXISTING_APPROVED', `${slug} must have status EXISTING_APPROVED`);
      assert.equal(item.hasVerifiedCutout, true, `${slug} must have hasVerifiedCutout=true`);

      const cutoutFile = path.join(CUTOUT_DIR, `${slug}.png`);
      assert.ok(fs.existsSync(cutoutFile), `Baseline cutout file missing: ${cutoutFile}`);
      const validation = validateCutoutRgbaBuffer(fs.readFileSync(cutoutFile));
      assert.equal(validation.passed, true, `Baseline cutout ${slug} failed validation: ${JSON.stringify(validation)}`);
    }
  });

  it('4. Newly produced Priority Tier 1 RGBA cutouts meet coverage target (>= 25 new, >= 32 total) and pass all pixel quality gates', () => {
    const manifest = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    const verifiedMonsters = manifest.monsters.filter(m => m.hasVerifiedCutout);
    const newlyProduced = manifest.monsters.filter(m => m.status === 'NEWLY_PRODUCED_VERIFIED');

    assert.ok(
      newlyProduced.length >= 25,
      `Expected at least 25 newly produced cutouts, got ${newlyProduced.length}`
    );
    assert.ok(
      verifiedMonsters.length >= 32,
      `Expected at least 32 total verified cutouts, got ${verifiedMonsters.length}`
    );

    const diskFiles = fs.readdirSync(CUTOUT_DIR).filter(f => f.endsWith('.png')).sort();
    assert.equal(
      diskFiles.length,
      verifiedMonsters.length,
      'Every PNG in monsters-cutout/ must correspond 1-to-1 with a verified cutout in the inventory'
    );

    for (const m of verifiedMonsters) {
      const cutoutPath = path.join(CUTOUT_DIR, `${m.slug}.png`);
      assert.ok(fs.existsSync(cutoutPath), `Verified cutout missing on disk: ${cutoutPath}`);

      const buf = fs.readFileSync(cutoutPath);
      const val = validateCutoutRgbaBuffer(buf);
      assert.equal(val.passed, true, `Cutout ${m.slug} failed quality gate: ${JSON.stringify(val)}`);
      assert.equal(val.colorType, 6, `${m.slug} must be true RGBA PNG (colorType 6)`);
      assert.ok(
        val.transparentPixelRatio >= 0.15 && val.transparentPixelRatio <= 0.88,
        `${m.slug} transparentPixelRatio=${val.transparentPixelRatio} out of range [0.15, 0.88]`
      );
      assert.ok(
        val.opaqueCoreRatio >= 0.10,
        `${m.slug} opaqueCoreRatio=${val.opaqueCoreRatio} below 0.10`
      );
      assert.ok(
        val.borderTransparencyRatio >= 0.85,
        `${m.slug} borderTransparencyRatio=${val.borderTransparencyRatio} below 0.85`
      );
      assert.ok(
        val.cutoutBounds.contentWidthRatio >= 0.35 && val.cutoutBounds.contentHeightRatio >= 0.35,
        `${m.slug} silhouette content bounds too small: ${JSON.stringify(val.cutoutBounds)}`
      );
      assert.deepEqual(
        m.cutoutBounds,
        val.cutoutBounds,
        `${m.slug} inventory cutoutBounds must match actual PNG pixel bounds`
      );
    }
  });

  it('5. All 37 verified RGBA monster cutouts resolve valid grounding anchors & adaptive scale across all 14 activated Phase 5 environment paintings', () => {
    const { CANDIDATE_ART_INVENTORY, computeSceneStageAnchor } = require('../scene-catalog');
    const { resolveMonsterIntegratedProfile } = require('../server/services/monster-profile-service');
    const { getMonsterAssetManifest } = require('../monster-size-catalog');
    const manifest = getMonsterAssetManifest();
    const verifiedMonsters = manifest.monsters.filter(m => m.cutoutAsset && m.cutoutAsset.hasVerifiedCutout);
    assert.equal(verifiedMonsters.length, 37, 'Must verify all 37 RGBA monster cutouts (not a 12-item subset)');

    const allPhase5Art = [];
    for (const cand of CANDIDATE_ART_INVENTORY) {
      allPhase5Art.push(cand);
      if (cand.replacementCandidate) {
        allPhase5Art.push({
          ...cand.replacementCandidate,
          targetBiome: cand.targetBiome
        });
      }
    }
    assert.equal(allPhase5Art.length, 14, 'Must verify all 13 Phase 5 paintings plus P5-ART-04-REPL');

    for (const cand of allPhase5Art) {
      assert.equal(cand.status, 'APPROVED', `${cand.id} must be permanently APPROVED`);
      const terrain = cand.targetBiome.includes('->') ? cand.targetBiome.split('->')[0] : cand.targetBiome;
      const stageAnchor = computeSceneStageAnchor(cand.candidateKey, terrain, null, false);
      assert.ok(stageAnchor && stageAnchor.stageFloorY >= 75 && stageAnchor.stageFloorY <= 90, `Invalid stageAnchor for ${cand.id}`);
      for (const m of verifiedMonsters) {
        const profile = resolveMonsterIntegratedProfile(m.slug, Boolean(m.isFlying), m.slug, {
          sceneTerrain: terrain,
          tileX: 7,
          tileY: 4
        });
        assert.equal(profile.hasIntegratedCutout, true, `${m.slug} must have integrated cutout on ${cand.id}`);
        assert.ok(profile.adaptiveScale && profile.adaptiveScale.visibleHeightPx > 40, `${m.slug} must compute valid visibleHeightPx on ${cand.id}`);
      }
    }
  });
});
