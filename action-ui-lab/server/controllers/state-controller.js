/**
 * DARKGRID ADVENTURE LAB — GET State, World Visual Atlas, Visual QA & Monster Scaling Controllers
 */
const fs = require('fs');
const path = require('path');
const {
  ATMOSPHERE_EFFECT_PROFILES,
  POINTS_OF_INTEREST,
  buildWorldVisualAtlas
} = require('../../scene-catalog');
const {
  DISCOVERY_CATALOG,
  EXPEDITION_DEFINITIONS
} = require('../../adventure-engine');
const {
  PF1E_SIZE_CATEGORIES,
  VISUAL_BODY_PROFILES,
  MONSTER_SIZE_CATALOG,
  PF1E_SIZE_REFERENCE_SPECIMENS,
  computeAdaptiveMonsterVisualScale,
  resolveMonsterRenderMode,
  getMonsterAssetManifest,
  buildVisualComparisonPresets,
  getCatalogAuditSummary
} = require('../../monster-size-catalog');
const { INTEGRATED_MONSTER_PROFILES } = require('../services/monster-profile-service');
const { buildClientState } = require('../services/client-state-service');

const LAB_ROOT = path.join(__dirname, '../..');

function createStateControllers({ db, userId }) {
  function getIndexPage(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile('public/index.html', { root: LAB_ROOT, dotfiles: 'allow' });
  }

  function getFavicon(req, res) {
    res.status(204).end();
  }

  function getState(req, res) {
    try {
      const state = buildClientState(db, userId);
      res.json({ ok: true, state });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  function getAtlas(req, res) {
    try {
      const atlas = buildWorldVisualAtlas(db);
      res.json({ ok: true, ...atlas, atlas });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  function getVisualQa(req, res) {
    try {
      const atlas = buildWorldVisualAtlas(db);
      const qaPath = path.join(LAB_ROOT, 'docs/visual-qa-results.json');
      let qaReport = null;
      if (fs.existsSync(qaPath)) {
        try {
          qaReport = JSON.parse(fs.readFileSync(qaPath, 'utf8'));
        } catch {
          qaReport = null;
        }
      }
      const integratedMonsters = Object.entries(INTEGRATED_MONSTER_PROFILES).map(([key, p]) => ({
        key,
        slug: p.slug,
        sizeCategory: p.sizeCategory,
        groundingMode: p.groundingMode,
        cutoutImageUrl: p.cutoutImageUrl,
        contactCount: Array.isArray(p.contactPatches) ? p.contactPatches.length : 0,
        airborneGapPx: p.airborneGapPx || 0
      }));
      const pointsOfInterest = POINTS_OF_INTEREST.map(p => ({
        ...p,
        x: p.tileX,
        y: p.tileY,
        facings: Array.isArray(p.visibleFacings) && p.visibleFacings.length > 0
          ? p.visibleFacings
          : (p.facing ? [p.facing] : ['NORTH', 'EAST', 'SOUTH', 'WEST'])
      }));
      const atmosphereProfiles = Object.values(ATMOSPHERE_EFFECT_PROFILES);
      res.json({
        ok: true,
        status: 'OK',
        atlasSummary: atlas.summary,
        totalTiles: atlas.totalTiles,
        passableTiles: atlas.passableTiles,
        impassableTiles: atlas.impassableTiles,
        totalPassableViewpoints: atlas.totalPassableViewpoints,
        integratedMonsters,
        pointsOfInterest,
        atmosphereProfiles,
        effectProfilesCount: atmosphereProfiles.length,
        pointsOfInterestCount: pointsOfInterest.length,
        adventureCatalog: {
          discoveriesCount: DISCOVERY_CATALOG.length,
          expeditionsCount: Object.keys(EXPEDITION_DEFINITIONS).length
        },
        qaReport,
        automatedVisualQaResults: qaReport
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  function getMonsterManifest(req, res) {
    try {
      const monsterQuery = req.query.monster || req.query.slug || null;
      const requestedMode = req.query.mode || 'INTEGRATED';
      const sceneTerrain = req.query.sceneTerrain || req.query.terrain || null;
      const manifest = getMonsterAssetManifest(sceneTerrain ? { sceneTerrain } : {});

      let singleResolution = null;
      if (monsterQuery) {
        singleResolution = resolveMonsterRenderMode(monsterQuery, requestedMode, sceneTerrain ? { sceneTerrain } : {});
      }

      res.json({
        ok: true,
        ...manifest,
        singleResolution
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  function getMonsterScaling(req, res) {
    try {
      const vpW = Number(req.query.viewportWidth || 1920);
      const vpH = Number(req.query.viewportHeight || 1080);
      const virtualDistanceFt = Number(req.query.virtualDistanceFt || 12);
      const presentationMode = String(req.query.presentationMode || 'INTEGRATED').toUpperCase();
      const monsterQuery = req.query.monster || null;

      const auditSummary = getCatalogAuditSummary();
      const comparisonPresets = buildVisualComparisonPresets({ width: vpW, height: vpH });

      let singleScale = null;
      if (monsterQuery) {
        singleScale = computeAdaptiveMonsterVisualScale(monsterQuery, {
          viewportWidth: vpW,
          viewportHeight: vpH,
          virtualDistanceFt,
          presentationMode,
          overridePfSize: req.query.overridePfSize || null
        });
      }

      const scaledCatalog = MONSTER_SIZE_CATALOG.map(entry => ({
        ...entry,
        adaptiveScale: computeAdaptiveMonsterVisualScale(entry, {
          viewportWidth: vpW,
          viewportHeight: vpH,
          virtualDistanceFt,
          presentationMode: entry.hasCutout ? 'INTEGRATED' : 'CARD'
        })
      }));

      const scaledReferenceSpecimens = PF1E_SIZE_REFERENCE_SPECIMENS.map(entry => ({
        ...entry,
        adaptiveScale: computeAdaptiveMonsterVisualScale(entry, {
          viewportWidth: vpW,
          viewportHeight: vpH,
          virtualDistanceFt,
          presentationMode: entry.hasCutout ? 'INTEGRATED' : 'CARD'
        })
      }));

      res.json({
        ok: true,
        viewport: { width: vpW, height: vpH, virtualDistanceFt },
        auditSummary,
        pfSizeCategories: PF1E_SIZE_CATEGORIES,
        visualBodyProfiles: VISUAL_BODY_PROFILES,
        catalogCount: scaledCatalog.length,
        catalog: scaledCatalog,
        referenceSpecimens: scaledReferenceSpecimens,
        comparisonPresets,
        singleScale
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }

  return {
    getIndexPage,
    getFavicon,
    getState,
    getAtlas,
    getVisualQa,
    getMonsterManifest,
    getMonsterScaling
  };
}

module.exports = {
  createStateControllers
};
