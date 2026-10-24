'use strict';

/**
 * Phase 10 — Comprehensive Monster Artwork, Boss Asset & PF1e Size Scaling Audit Suite
 *
 * Verifies:
 * 1. All 98 canonical SQLite database monsters match MONSTER_SIZE_CATALOG,
 *    monster-artwork-inventory.json, and monster-asset-manifest.json 1-to-1 by ID (1..98), slug, and image_path.
 * 2. 100% on-disk image existence across public/images/monsters/, images/monsters/,
 *    and action-ui-lab/public/images/monsters-cutout/ (37 verified RGBA cutouts + 61 honest CARD fallbacks).
 * 3. All 4 Bosses (Warchief Grak, Skulkrip the Cave Brood-King, Lord Malakor the Barrow-Wight King,
 *    Warlord Kraug the Crag-Breaker) and all 8 Fixed Dungeon Guards resolve to canonical monster entries,
 *    accurate Pathfinder 1e size categories, and valid artwork files.
 * 4. All monster card and cutout URLs return HTTP 200 via Express static asset middleware.
 * 5. Pathfinder 1e size scaling (Tiny, Small, Medium, Large, Huge) and viewport presentation modes
 *    (INTEGRATED cutout vs CARD fallback) render without clipping, stretching, or cross-monster substitution.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

const { initSandboxDb } = require('../server/services/sandbox-db-service');
const { registerStaticAssetsMiddleware } = require('../server/middleware/static-assets');
const {
  INTEGRATED_MONSTER_PROFILES,
  resolveMonsterIntegratedProfile
} = require('../server/services/monster-profile-service');
const {
  DUNGEON_DEFINITIONS,
  DUNGEON_BOSS_PROFILES,
  DUNGEON_FIXED_ENCOUNTERS
} = require('../server/services/dungeon-service');
const {
  LANDMARK_DEFINITIONS,
  STRONGHOLD_BOSS_PROFILE,
  HIGHLAND_BOSS_PROFILE
} = require('../server/services/topdown-world-service');
const {
  PF1E_SIZE_CATEGORIES,
  MONSTER_SIZE_CATALOG,
  PF1E_SIZE_REFERENCE_SPECIMENS,
  lookupMonsterSizeEntry,
  computeAdaptiveMonsterVisualScale,
  getMonsterAssetManifest
} = require('../monster-size-catalog');

const ROOT_DIR = path.resolve(__dirname, '../..');
const LAB_DIR = path.resolve(__dirname, '..');
const PUBLIC_MONSTERS_DIR = path.join(ROOT_DIR, 'public', 'images', 'monsters');
const ROOT_MONSTERS_DIR = path.join(ROOT_DIR, 'images', 'monsters');
const CUTOUT_MONSTERS_DIR = path.join(LAB_DIR, 'public', 'images', 'monsters-cutout');
const INVENTORY_JSON_PATH = path.join(LAB_DIR, 'monster-artwork-inventory.json');
const MANIFEST_JSON_PATH = path.join(LAB_DIR, 'monster-asset-manifest.json');

function httpGetStatus(baseUrl, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseUrl}${urlPath}`, { headers: { Connection: 'close' } }, (res) => {
      res.resume();
      resolve({
        statusCode: res.statusCode,
        contentType: res.headers['content-type'] || '',
        contentLength: Number(res.headers['content-length'] || 0)
      });
    });
    req.on('error', reject);
  });
}

describe('Phase 10 — Monster Artwork, Boss Asset & PF1e Size Scaling Audit Suite', () => {
  let db;
  let dbMonsters = [];
  let server;
  let baseUrl = '';

  before(async () => {
    ({ db } = initSandboxDb(':memory:'));
    dbMonsters = db.prepare(`
      SELECT *
      FROM monsters
      ORDER BY id ASC
    `).all();

    const app = express();
    registerStaticAssetsMiddleware(app);
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
  });

  it('1. Synchronizes all 98 SQLite DB monsters 1-to-1 with MONSTER_SIZE_CATALOG, inventory JSON, and manifest JSON', () => {
    assert.equal(dbMonsters.length, 98, 'Canonical SQLite database must contain exactly 98 monsters');
    assert.equal(MONSTER_SIZE_CATALOG.length, 98, 'MONSTER_SIZE_CATALOG must contain exactly 98 monsters');

    const inventory = JSON.parse(fs.readFileSync(INVENTORY_JSON_PATH, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_JSON_PATH, 'utf8'));
    const liveManifest = getMonsterAssetManifest();

    assert.equal(inventory.monsters.length, 98, 'monster-artwork-inventory.json must list 98 monsters');
    assert.equal(manifest.monsters.length, 98, 'monster-asset-manifest.json must list 98 monsters');
    assert.deepEqual(manifest.summary, liveManifest.summary, 'On-disk manifest summary must match live getMonsterAssetManifest()');

    for (let i = 0; i < 98; i++) {
      const dbRow = dbMonsters[i];
      const catEntry = MONSTER_SIZE_CATALOG[i];
      const invEntry = inventory.monsters[i];
      const manEntry = manifest.monsters[i];

      const expectedId = i + 1;
      const expectedSlug = path.basename(dbRow.image_path, '.png');
      const normalizedDbImagePath = '/' + String(dbRow.image_path).replace(/^\/+/, '');

      assert.equal(dbRow.id, expectedId, `SQLite monster at index ${i} must have canonical id ${expectedId}`);
      assert.equal(catEntry.id, expectedId, `MONSTER_SIZE_CATALOG[${i}] (${catEntry.slug}) id must match SQLite id ${expectedId}`);
      assert.equal(catEntry.catalogOrder, expectedId, `MONSTER_SIZE_CATALOG[${i}] catalogOrder must be ${expectedId}`);
      assert.equal(invEntry.id, expectedId, `Inventory[${i}] (${invEntry.slug}) id must match SQLite id ${expectedId}`);
      assert.equal(manEntry.id, expectedId, `Manifest[${i}] (${manEntry.slug}) id must match SQLite id ${expectedId}`);

      assert.equal(catEntry.slug, expectedSlug, `Catalog slug must match DB image_path slug for ${dbRow.name}`);
      assert.equal(invEntry.slug, expectedSlug, `Inventory slug must match DB image_path slug for ${dbRow.name}`);
      assert.equal(manEntry.slug, expectedSlug, `Manifest slug must match DB image_path slug for ${dbRow.name}`);

      assert.equal(catEntry.name, dbRow.name, `Catalog name must match DB name for ID ${expectedId}`);
      assert.equal(catEntry.imagePath, normalizedDbImagePath, `Catalog imagePath must match DB image_path for ${dbRow.name}`);
      assert.equal(manEntry.cardAsset.imagePath, normalizedDbImagePath);
      assert.equal(manEntry.cardAsset.labAssetPath, normalizedDbImagePath);

      // Verify lookup by ID, name, slug, and DB row object all return the exact same monster entry
      const byId = lookupMonsterSizeEntry(dbRow.id);
      const byName = lookupMonsterSizeEntry(dbRow.name);
      const bySlug = lookupMonsterSizeEntry(expectedSlug);
      const byRow = lookupMonsterSizeEntry(dbRow);

      assert.equal(byId.slug, expectedSlug, `lookupMonsterSizeEntry(${dbRow.id}) must resolve to ${expectedSlug} (got ${byId.slug})`);
      assert.equal(byName.slug, expectedSlug, `lookupMonsterSizeEntry("${dbRow.name}") must resolve to ${expectedSlug}`);
      assert.equal(bySlug.slug, expectedSlug, `lookupMonsterSizeEntry("${expectedSlug}") must resolve to ${expectedSlug}`);
      assert.equal(byRow.slug, expectedSlug, `lookupMonsterSizeEntry(dbRow) must resolve to ${expectedSlug}`);
      assert.ok(!byId.isFallbackMetadata, `Cataloged monster ${expectedSlug} must never use fallback metadata`);
    }
  });

  it('2. Verifies 100% on-disk existence of all 98 source cards, 98 defeated paintings, 37 RGBA cutouts, and 5 reference specimens', () => {
    assert.equal(Object.keys(INTEGRATED_MONSTER_PROFILES).length, 37, 'INTEGRATED_MONSTER_PROFILES must register all 37 verified cutouts');

    let cutoutCount = 0;
    let cardFallbackCount = 0;

    for (const dbRow of dbMonsters) {
      const slug = path.basename(dbRow.image_path, '.png');
      const publicCardPath = path.join(PUBLIC_MONSTERS_DIR, `${slug}.png`);
      const publicDefeatedPath = path.join(PUBLIC_MONSTERS_DIR, `${slug}_defeated.png`);
      const rootCardPath = path.join(ROOT_MONSTERS_DIR, `${slug}.png`);
      const rootDefeatedPath = path.join(ROOT_MONSTERS_DIR, `${slug}_defeated.png`);
      const cutoutPath = path.join(CUTOUT_MONSTERS_DIR, `${slug}.png`);

      assert.ok(fs.existsSync(publicCardPath), `Missing public card image for ${slug}: ${publicCardPath}`);
      assert.ok(fs.existsSync(publicDefeatedPath), `Missing public defeated image for ${slug}: ${publicDefeatedPath}`);
      assert.ok(fs.existsSync(rootCardPath), `Missing root card image for ${slug}: ${rootCardPath}`);
      assert.ok(fs.existsSync(rootDefeatedPath), `Missing root defeated image for ${slug}: ${rootDefeatedPath}`);

      assert.ok(fs.statSync(publicCardPath).size > 10000, `Public card image for ${slug} is unexpectedly small`);
      assert.ok(fs.statSync(publicDefeatedPath).size > 10000, `Public defeated image for ${slug} is unexpectedly small`);

      const catEntry = lookupMonsterSizeEntry(slug);
      const profile = resolveMonsterIntegratedProfile(slug, Boolean(dbRow.is_flying), dbRow);

      if (catEntry.hasCutout) {
        cutoutCount++;
        assert.ok(fs.existsSync(cutoutPath), `Missing RGBA cutout on disk for ${slug}: ${cutoutPath}`);
        const buf = fs.readFileSync(cutoutPath);
        assert.equal(buf[0], 0x89, `${slug} cutout must be a valid PNG`);
        assert.equal(buf[25], 6, `${slug} cutout must be true RGBA (colorType === 6)`);

        assert.equal(profile.hasIntegratedCutout, true, `${slug} profile must enable integrated cutout`);
        assert.equal(profile.cutoutImageUrl, `/lab-assets/images/monsters-cutout/${slug}.png`);
        assert.equal(profile.renderContract.activeMode, 'INTEGRATED');
        assert.equal(profile.renderContract.activeImageUrl, `/lab-assets/images/monsters-cutout/${slug}.png`);
      } else {
        cardFallbackCount++;
        assert.equal(fs.existsSync(cutoutPath), false, `Monster ${slug} has an uncataloged cutout file on disk`);
        assert.equal(profile.hasIntegratedCutout, false, `${slug} must use honest CARD fallback`);
        assert.equal(profile.cutoutImageUrl, null, `${slug} must not borrow another monster's cutout URL`);
        assert.equal(profile.renderContract.activeMode, 'CARD');
        assert.equal(profile.renderContract.fallbackReason, 'NO_VERIFIED_RGBA_CUTOUT');
        assert.equal(profile.renderContract.activeImageUrl, `/images/monsters/${slug}.png`);
      }
    }

    assert.equal(cutoutCount, 37, 'Must have exactly 37 monsters with verified RGBA cutouts');
    assert.equal(cardFallbackCount, 61, 'Must have exactly 61 monsters using honest CARD fallback');

    // Verify all 5 PF1e size reference specimens resolve their proxy cutouts on disk
    assert.equal(PF1E_SIZE_REFERENCE_SPECIMENS.length, 5);
    for (const refSpec of PF1E_SIZE_REFERENCE_SPECIMENS) {
      const refProfile = resolveMonsterIntegratedProfile(refSpec.slug, refSpec.isAirborne, refSpec);
      assert.equal(refProfile.hasIntegratedCutout, true, `Reference specimen ${refSpec.slug} must resolve its proxy cutout on disk`);
      assert.equal(refProfile.renderContract.activeMode, 'INTEGRATED');
      const cutoutFile = path.basename(refSpec.cutoutImagePath);
      assert.ok(fs.existsSync(path.join(CUTOUT_MONSTERS_DIR, cutoutFile)), `Proxy cutout ${cutoutFile} must exist on disk`);
    }
  });

  it('3. Verifies all 4 Bosses and 8 Fixed Dungeon Guards in dungeon-service.js & topdown-world-service.js', () => {
    const expectedBossSpecs = [
      {
        bossDef: STRONGHOLD_BOSS_PROFILE,
        bossKey: 'WARCHIEF_GRAK',
        customTitle: 'Warchief Grak the Goblin Chieftain',
        canonicalSlug: 'goblin',
        pfSizeCategory: 'SMALL',
        hasIntegratedCutout: true,
        expectedCardUrl: '/images/monsters/goblin.png',
        expectedCutoutUrl: '/lab-assets/images/monsters-cutout/goblin.png'
      },
      {
        bossDef: DUNGEON_BOSS_PROFILES.GOBLIN_CAVE,
        bossKey: 'GOBLIN_CAVE_BROOD_KING',
        customTitle: 'Skulkrip the Cave Brood-King',
        canonicalSlug: 'bugbear',
        pfSizeCategory: 'MEDIUM',
        hasIntegratedCutout: true,
        expectedCardUrl: '/images/monsters/bugbear.png',
        expectedCutoutUrl: '/lab-assets/images/monsters-cutout/bugbear.png'
      },
      {
        bossDef: DUNGEON_BOSS_PROFILES.ANCIENT_CRYPT,
        bossKey: 'ANCIENT_CRYPT_BARROW_KING',
        customTitle: 'Lord Malakor the Barrow-Wight King',
        canonicalSlug: 'barrow_wight',
        pfSizeCategory: 'MEDIUM',
        hasIntegratedCutout: false,
        expectedCardUrl: '/images/monsters/barrow_wight.png',
        expectedCutoutUrl: null
      },
      {
        bossDef: HIGHLAND_BOSS_PROFILE,
        bossKey: 'WARLORD_KRAUG',
        customTitle: 'Warlord Kraug the Crag-Breaker',
        canonicalSlug: 'ogre',
        pfSizeCategory: 'LARGE',
        hasIntegratedCutout: true,
        expectedCardUrl: '/images/monsters/ogre.png',
        expectedCutoutUrl: '/lab-assets/images/monsters-cutout/ogre.png'
      }
    ];

    for (const spec of expectedBossSpecs) {
      const bossDef = spec.bossDef;
      assert.ok(bossDef, `Boss profile must exist for ${spec.bossKey}`);
      assert.equal(bossDef.bossKey, spec.bossKey);
      assert.equal(bossDef.customTitle, spec.customTitle);

      // Verify lookup via bossKey, customTitle, and boss object payload
      const entryByBossKey = lookupMonsterSizeEntry(spec.bossKey);
      const entryByTitle = lookupMonsterSizeEntry(spec.customTitle);
      const entryByPayload = lookupMonsterSizeEntry(bossDef);

      assert.equal(entryByBossKey.slug, spec.canonicalSlug, `Boss key ${spec.bossKey} must resolve to ${spec.canonicalSlug}`);
      assert.equal(entryByTitle.slug, spec.canonicalSlug, `Boss title "${spec.customTitle}" must resolve to ${spec.canonicalSlug}`);
      assert.equal(entryByPayload.slug, spec.canonicalSlug, `Boss payload for ${spec.bossKey} must resolve to ${spec.canonicalSlug}`);
      assert.equal(entryByTitle.pfSizeCategory, spec.pfSizeCategory, `Boss ${spec.customTitle} must have PF1e size ${spec.pfSizeCategory}`);
      assert.ok(!entryByTitle.isFallbackMetadata, `Boss ${spec.customTitle} must resolve to canonical catalog entry, not synthesized fallback`);

      // Verify resolveMonsterIntegratedProfile even when passed customTitle as slug
      const profile = resolveMonsterIntegratedProfile(spec.customTitle, false, bossDef);
      assert.equal(profile.slug, spec.canonicalSlug);
      assert.equal(profile.pfSizeCategory, spec.pfSizeCategory);
      assert.equal(profile.hasIntegratedCutout, spec.hasIntegratedCutout);
      assert.equal(profile.renderContract.cardImageUrl, spec.expectedCardUrl);
      assert.equal(profile.cutoutImageUrl, spec.expectedCutoutUrl);
    }

    // Verify Overworld & Dungeon boss references in LANDMARK_DEFINITIONS & DUNGEON_DEFINITIONS
    assert.ok(LANDMARK_DEFINITIONS.GOBLIN_STRONGHOLD);
    assert.equal(LANDMARK_DEFINITIONS.RAVENCRAG_CITADEL.bossKey, 'WARLORD_KRAUG');
    assert.equal(DUNGEON_DEFINITIONS.GOBLIN_CAVE.bossName, 'Skulkrip the Cave Brood-King');
    assert.equal(DUNGEON_DEFINITIONS.ANCIENT_CRYPT.bossName, 'Lord Malakor the Barrow-Wight King');

    // Verify all 8 Fixed Dungeon Guards in DUNGEON_FIXED_ENCOUNTERS
    const expectedGuardSlugs = {
      CAVE_SPIDER_BROOD: 'giant_spider',
      CAVE_WARCAMP_SENTRY: 'hobgoblin',
      CAVE_BRIDGE_BUGBEAR: 'bugbear',
      CRYPT_NAVE_WARDEN: 'skeletal_champion',
      CRYPT_TOMB_GHOUL: 'ghoul',
      CRYPT_CATACOMB_SHADOW: 'shadow',
      CRYPT_OSSUARY_WIGHT: 'wight',
      CRYPT_MUMMY_SENTINEL: 'mummy'
    };
    const fixedKeys = Object.keys(DUNGEON_FIXED_ENCOUNTERS);
    assert.equal(fixedKeys.length, 8, 'DUNGEON_FIXED_ENCOUNTERS must contain all 8 fixed dungeon guards');

    for (const key of fixedKeys) {
      const enc = DUNGEON_FIXED_ENCOUNTERS[key];
      const expectedSlug = expectedGuardSlugs[key];
      const byKey = lookupMonsterSizeEntry(key);
      const byTitle = lookupMonsterSizeEntry(enc.customTitle);
      const byMonsterName = lookupMonsterSizeEntry(enc.monsterName);
      const byPayload = lookupMonsterSizeEntry(enc);

      assert.equal(byKey.slug, expectedSlug, `Fixed encounter key ${key} must resolve to ${expectedSlug}`);
      assert.equal(byTitle.slug, expectedSlug, `Fixed encounter title "${enc.customTitle}" must resolve to ${expectedSlug}`);
      assert.equal(byMonsterName.slug, expectedSlug, `Monster name "${enc.monsterName}" must resolve to ${expectedSlug}`);
      assert.equal(byPayload.slug, expectedSlug, `Fixed encounter object ${key} must resolve to ${expectedSlug}`);
      assert.ok(!byTitle.isFallbackMetadata, `Fixed dungeon guard "${enc.customTitle}" must resolve to canonical catalog metadata`);

      const profile = resolveMonsterIntegratedProfile(enc.customTitle, false, enc);
      assert.equal(profile.slug, expectedSlug);
      assert.equal(profile.renderContract.cardImageUrl, `/images/monsters/${expectedSlug}.png`);
    }
  });

  it('4. Serves all 98 monster cards, 37 RGBA cutouts, and boss/guard assets with HTTP 200 via static middleware', async () => {
    const manifest = getMonsterAssetManifest();

    for (const m of manifest.monsters) {
      // Verify card asset HTTP 200
      const cardRes = await httpGetStatus(baseUrl, m.cardAsset.imagePath);
      assert.equal(cardRes.statusCode, 200, `GET ${m.cardAsset.imagePath} for ${m.name} must return HTTP 200`);
      assert.ok(cardRes.contentLength > 10000, `GET ${m.cardAsset.imagePath} must return non-empty image payload`);

      // Verify labAssetPath HTTP 200
      const labCardRes = await httpGetStatus(baseUrl, m.cardAsset.labAssetPath);
      assert.equal(labCardRes.statusCode, 200, `GET ${m.cardAsset.labAssetPath} for ${m.name} must return HTTP 200`);

      // Verify cutout asset HTTP 200 if present
      if (m.cutoutAsset.hasVerifiedCutout) {
        const cutoutRes = await httpGetStatus(baseUrl, m.cutoutAsset.cutoutImagePath);
        assert.equal(cutoutRes.statusCode, 200, `GET ${m.cutoutAsset.cutoutImagePath} for ${m.name} must return HTTP 200`);
        assert.ok(cutoutRes.contentLength > 10000, `GET ${m.cutoutAsset.cutoutImagePath} must return non-empty RGBA cutout`);
      }

      // Verify activeImageUrl HTTP 200
      const activeRes = await httpGetStatus(baseUrl, m.renderContract.activeImageUrl);
      assert.equal(activeRes.statusCode, 200, `GET ${m.renderContract.activeImageUrl} for ${m.name} must return HTTP 200`);
    }
  });

  it('5. Enforces accurate Pathfinder 1e size scaling (Tiny -> Huge) and viewport safety across all 98 monsters', () => {
    const countsBySize = { TINY: 0, SMALL: 0, MEDIUM: 0, LARGE: 0, HUGE: 0 };
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 }
    ];

    for (const entry of MONSTER_SIZE_CATALOG) {
      assert.ok(
        countsBySize[entry.pfSizeCategory] !== undefined,
        `Monster ${entry.slug} has unexpected PF1e size category: ${entry.pfSizeCategory}`
      );
      countsBySize[entry.pfSizeCategory]++;

      const expectedCat = PF1E_SIZE_CATEGORIES[entry.pfSizeCategory];
      assert.equal(entry.pfSizeOrder, expectedCat.order, `${entry.slug} pfSizeOrder must match ${entry.pfSizeCategory}`);
      assert.equal(entry.pfSpaceFt, expectedCat.pfSpaceFt, `${entry.slug} pfSpaceFt must match ${entry.pfSizeCategory}`);
      assert.ok(entry.proposedScaleFactor >= 0.30 && entry.proposedScaleFactor <= 1.75, `${entry.slug} proposedScaleFactor out of bounds`);

      for (const vp of viewports) {
        for (const mode of ['INTEGRATED', 'CARD']) {
          const sc = computeAdaptiveMonsterVisualScale(entry, {
            viewportWidth: vp.width,
            viewportHeight: vp.height,
            presentationMode: mode
          });

          // Must never clip top HUD, bottom action deck, or horizontal corridor margins
          assert.ok(
            sc.clamping.crownClearancePx >= 24,
            `${entry.slug} (${mode} @ ${vp.width}x${vp.height}) crownClearancePx ${sc.clamping.crownClearancePx} < 24`
          );
          assert.ok(
            sc.clamping.footAboveBottomDeckPx >= 18,
            `${entry.slug} (${mode} @ ${vp.width}x${vp.height}) footAboveBottomDeckPx ${sc.clamping.footAboveBottomDeckPx} < 18`
          );
          assert.ok(
            sc.clamping.horizontalClearancePx >= 12,
            `${entry.slug} (${mode} @ ${vp.width}x${vp.height}) horizontalClearancePx ${sc.clamping.horizontalClearancePx} < 12`
          );

          // Must preserve aspect ratio without stretching
          assert.ok(
            sc.clamping.aspectRatioDrift <= 0.025,
            `${entry.slug} (${mode} @ ${vp.width}x${vp.height}) aspectRatioDrift ${sc.clamping.aspectRatioDrift} > 0.025`
          );

          // Grounded vs airborne separation
          if (sc.positioning.isAirborne) {
            assert.ok(sc.positioning.airborneGapPx >= 14, `Airborne ${entry.slug} must hover above ground shadow`);
          } else {
            assert.equal(sc.positioning.airborneGapPx, 0, `Grounded ${entry.slug} must have 0 airborneGapPx`);
          }
        }
      }
    }

    assert.deepEqual(countsBySize, {
      TINY: 5,
      SMALL: 13,
      MEDIUM: 52,
      LARGE: 28,
      HUGE: 0
    });

    // Verify strict monotonic PF1e size scaling across Tiny -> Small -> Medium -> Large -> Huge (including reference specimen)
    const tierRepresentatives = ['stirge', 'goblin', 'hobgoblin', 'ogre', 'ref_huge_elder_troll'];
    let prevHeight = 0;
    for (const slug of tierRepresentatives) {
      const sc = computeAdaptiveMonsterVisualScale(slug, { viewportWidth: 1920, viewportHeight: 1080 });
      assert.ok(
        sc.visibleHeightPx > prevHeight,
        `Expected ${slug} (${sc.pfSizeCategory}: ${sc.visibleHeightPx}px) > previous tier (${prevHeight}px)`
      );
      prevHeight = sc.visibleHeightPx;
    }
  });
});
