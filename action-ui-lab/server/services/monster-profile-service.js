/**
 * DARKGRID ADVENTURE LAB — Integrated Monster Cutout & Grounding Profile Service
 */
const fs = require('fs');
const path = require('path');
const {
  MONSTER_SIZE_CATALOG,
  lookupMonsterSizeEntry,
  computeAdaptiveMonsterVisualScale,
  resolveMonsterRenderMode
} = require('../../monster-size-catalog');

const INTEGRATED_MONSTER_PROFILES = {
  manticore: {
    slug: 'manticore',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/manticore.png',
    sizeCategory: 'LARGE_WINGED',
    groundingMode: 'AIRBORNE_HOVER',
    scaleMultiplier: 1.12,
    verticalOffsetPx: -48,
    airborneGapPx: 52,
    shadowWidthPct: 72,
    shadowBlurPx: 14,
    shadowOpacity: 0.38,
    ambientPatch: {
      leftPct: 50,
      topPct: 115,
      widthPct: 72,
      heightPct: 14,
      rotateDeg: 0,
      blurPx: 12,
      opacity: 0.38
    },
    contactPatches: []
  },
  ghoul: {
    slug: 'ghoul',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/ghoul.png',
    sizeCategory: 'MEDIUM_HUMANOID',
    groundingMode: 'GROUNDED_CROUCH',
    scaleMultiplier: 0.94,
    verticalOffsetPx: 14,
    airborneGapPx: 0,
    shadowWidthPct: 56,
    shadowBlurPx: 8,
    shadowOpacity: 0.62,
    ambientPatch: {
      leftPct: 53.5,
      topPct: 93.8,
      widthPct: 54,
      heightPct: 11,
      rotateDeg: 7,
      blurPx: 8,
      opacity: 0.44
    },
    contactPatches: [
      { id: 'right-foot', leftPct: 34.5, topPct: 89.8, widthPct: 21, heightPct: 5.8, rotateDeg: -4, blurPx: 3, opacity: 0.76 },
      { id: 'left-foot', leftPct: 72.5, topPct: 97.2, widthPct: 20, heightPct: 5.8, rotateDeg: 3, blurPx: 3, opacity: 0.80 }
    ]
  },
  assassin_vine: {
    slug: 'assassin_vine',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/assassin_vine.png',
    sizeCategory: 'COILED_PLANT',
    groundingMode: 'GROUNDED_ROOTED',
    scaleMultiplier: 1.00,
    verticalOffsetPx: 16,
    airborneGapPx: 0,
    shadowWidthPct: 76,
    shadowBlurPx: 9,
    shadowOpacity: 0.68,
    ambientPatch: {
      leftPct: 50.0,
      topPct: 95.2,
      widthPct: 74,
      heightPct: 12,
      rotateDeg: 0,
      blurPx: 8,
      opacity: 0.48
    },
    contactPatches: [
      { id: 'root-coil-left', leftPct: 24.0, topPct: 93.2, widthPct: 25, heightPct: 6.2, rotateDeg: 6, blurPx: 3, opacity: 0.76 },
      { id: 'root-coil-center', leftPct: 48.0, topPct: 97.0, widthPct: 32, heightPct: 6.8, rotateDeg: 0, blurPx: 3, opacity: 0.82 },
      { id: 'root-coil-right', leftPct: 76.0, topPct: 93.0, widthPct: 25, heightPct: 6.2, rotateDeg: -6, blurPx: 3, opacity: 0.76 }
    ]
  },
  wolf: {
    slug: 'wolf',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/wolf.png',
    sizeCategory: 'MEDIUM_QUADRUPED',
    groundingMode: 'GROUNDED_PAWS',
    scaleMultiplier: 0.92,
    verticalOffsetPx: 14,
    airborneGapPx: 0,
    shadowWidthPct: 68,
    shadowBlurPx: 8,
    shadowOpacity: 0.64,
    ambientPatch: {
      leftPct: 45.0,
      topPct: 90.0,
      widthPct: 64,
      heightPct: 11,
      rotateDeg: 10,
      blurPx: 9,
      opacity: 0.42
    },
    contactPatches: [
      { id: 'hind-right-paw', leftPct: 9.5, topPct: 86.4, widthPct: 14, heightPct: 5.0, rotateDeg: 0, blurPx: 2.5, opacity: 0.74 },
      { id: 'mid-paws', leftPct: 47.5, topPct: 83.2, widthPct: 20, heightPct: 5.4, rotateDeg: 4, blurPx: 3, opacity: 0.74 },
      { id: 'front-left-paw', leftPct: 70.5, topPct: 97.4, widthPct: 19, heightPct: 5.6, rotateDeg: -2, blurPx: 2.5, opacity: 0.82 }
    ]
  },
  skeletal_champion: {
    slug: 'skeletal_champion',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/skeletal_champion.png',
    sizeCategory: 'MEDIUM_HUMANOID',
    groundingMode: 'GROUNDED_BOOTS',
    scaleMultiplier: 0.98,
    verticalOffsetPx: 14,
    airborneGapPx: 0,
    shadowWidthPct: 66,
    shadowBlurPx: 8,
    shadowOpacity: 0.66,
    ambientPatch: {
      leftPct: 48.0,
      topPct: 96.5,
      widthPct: 68,
      heightPct: 10,
      rotateDeg: -2,
      blurPx: 8,
      opacity: 0.44
    },
    contactPatches: [
      { id: 'right-sabatons', leftPct: 10.5, topPct: 98.8, widthPct: 19, heightPct: 5.5, rotateDeg: -4, blurPx: 2.5, opacity: 0.82 },
      { id: 'left-sabatons', leftPct: 79.5, topPct: 96.4, widthPct: 24, heightPct: 5.8, rotateDeg: 4, blurPx: 2.5, opacity: 0.80 }
    ]
  },
  giant_spider: {
    slug: 'giant_spider',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/giant_spider.png',
    sizeCategory: 'LARGE_ARACHNID',
    groundingMode: 'GROUNDED_ARACHNID',
    scaleMultiplier: 1.15,
    verticalOffsetPx: 18,
    airborneGapPx: 0,
    shadowWidthPct: 84,
    shadowBlurPx: 9,
    shadowOpacity: 0.68,
    ambientPatch: {
      leftPct: 52.0,
      topPct: 91.5,
      widthPct: 80,
      heightPct: 14,
      rotateDeg: 2,
      blurPx: 10,
      opacity: 0.48
    },
    contactPatches: [
      { id: 'left-forelegs', leftPct: 8.5, topPct: 90.0, widthPct: 16, heightPct: 5.2, rotateDeg: -5, blurPx: 2.5, opacity: 0.82 },
      { id: 'left-mid-leg', leftPct: 31.0, topPct: 94.5, widthPct: 15, heightPct: 5.0, rotateDeg: -2, blurPx: 2.5, opacity: 0.80 },
      { id: 'front-right-leg', leftPct: 68.5, topPct: 98.8, widthPct: 17, heightPct: 5.5, rotateDeg: 2, blurPx: 2.5, opacity: 0.88 },
      { id: 'rear-right-legs', leftPct: 90.0, topPct: 90.5, widthPct: 17, heightPct: 5.2, rotateDeg: 5, blurPx: 2.5, opacity: 0.80 }
    ]
  },
  troll: {
    slug: 'troll',
    hasIntegratedCutout: true,
    cutoutImageUrl: '/lab-assets/images/monsters-cutout/troll.png',
    sizeCategory: 'LARGE_BRUTE',
    groundingMode: 'GROUNDED_HEAVY',
    scaleMultiplier: 1.06,
    verticalOffsetPx: 15,
    airborneGapPx: 0,
    shadowWidthPct: 74,
    shadowBlurPx: 9,
    shadowOpacity: 0.70,
    ambientPatch: {
      leftPct: 52.0,
      topPct: 95.5,
      widthPct: 68,
      heightPct: 12,
      rotateDeg: 5,
      blurPx: 9,
      opacity: 0.48
    },
    contactPatches: [
      { id: 'right-clawed-foot', leftPct: 27.5, topPct: 92.8, widthPct: 26, heightPct: 6.2, rotateDeg: -5, blurPx: 3, opacity: 0.80 },
      { id: 'left-clawed-foot', leftPct: 74.5, topPct: 99.0, widthPct: 24, heightPct: 6.5, rotateDeg: 3, blurPx: 3, opacity: 0.84 }
    ]
  }
};

// Populate INTEGRATED_MONSTER_PROFILES for all 37 verified RGBA cutouts (7 baseline + 30 Track 4 verified)
for (const entry of MONSTER_SIZE_CATALOG) {
  if (entry.hasCutout && !INTEGRATED_MONSTER_PROFILES[entry.slug]) {
    const sc = computeAdaptiveMonsterVisualScale(entry, {
      viewportWidth: 1920,
      viewportHeight: 1080,
      presentationMode: 'INTEGRATED'
    });
    INTEGRATED_MONSTER_PROFILES[entry.slug] = {
      slug: entry.slug,
      hasIntegratedCutout: true,
      cutoutImageUrl: entry.cutoutImagePath || `/lab-assets/images/monsters-cutout/${entry.slug}.png`,
      sizeCategory: `${entry.pfSizeCategory}_${entry.visualBodyProfile}`,
      groundingMode: sc.positioning.groundingMode,
      scaleMultiplier: entry.proposedScaleFactor,
      verticalOffsetPx: sc.positioning.verticalOffsetPx,
      airborneGapPx: sc.positioning.airborneGapPx,
      shadowWidthPct: sc.shadow.shadowWidthPct,
      shadowBlurPx: sc.shadow.shadowBlurPx,
      shadowOpacity: sc.shadow.shadowOpacity,
      ambientPatch: sc.shadow.ambientPatch,
      contactPatches: sc.shadow.contactPatches
    };
  }
}

function resolveMonsterIntegratedProfile(cleanSlug, isAirborne = false, monsterLookupHint = null, options = {}) {
  const key = String(cleanSlug || '').toLowerCase().trim();
  const sizeEntry = lookupMonsterSizeEntry(key || monsterLookupHint);
  const canonicalSlug = (sizeEntry && sizeEntry.slug) ? sizeEntry.slug : key;
  const profile = INTEGRATED_MONSTER_PROFILES[canonicalSlug] || INTEGRATED_MONSTER_PROFILES[key];

  const fileDiskPath = path.join(__dirname, '../../public/images/monsters-cutout', `${canonicalSlug}.png`);
  const diskExists = options.cutoutExistsOnDisk !== undefined
    ? Boolean(options.cutoutExistsOnDisk)
    : fs.existsSync(fileDiskPath);

  const modeInfo = resolveMonsterRenderMode(sizeEntry, options.requestedMode || 'INTEGRATED', {
    ...options,
    cutoutExistsOnDisk: diskExists
  });

  if (modeInfo.hasVerifiedCutout && modeInfo.activeMode === 'INTEGRATED') {
    const adaptiveScale = modeInfo.adaptiveScale;
    const baseProfile = profile || {
      slug: canonicalSlug,
      hasIntegratedCutout: true,
      cutoutImageUrl: modeInfo.cutoutImageUrl,
      sizeCategory: `${sizeEntry.pfSizeCategory}_${sizeEntry.visualBodyProfile}`,
      groundingMode: adaptiveScale.positioning.groundingMode,
      scaleMultiplier: sizeEntry.proposedScaleFactor,
      verticalOffsetPx: adaptiveScale.positioning.verticalOffsetPx,
      airborneGapPx: adaptiveScale.positioning.airborneGapPx,
      shadowWidthPct: adaptiveScale.shadow.shadowWidthPct,
      shadowBlurPx: adaptiveScale.shadow.shadowBlurPx,
      shadowOpacity: adaptiveScale.shadow.shadowOpacity,
      ambientPatch: adaptiveScale.shadow.ambientPatch,
      contactPatches: adaptiveScale.shadow.contactPatches
    };
    return {
      ...baseProfile,
      slug: canonicalSlug,
      hasIntegratedCutout: true,
      cutoutImageUrl: modeInfo.cutoutImageUrl,
      pfSizeCategory: sizeEntry.pfSizeCategory,
      pfSizeLabel: sizeEntry.pfSizeLabel,
      visualBodyProfile: sizeEntry.visualBodyProfile,
      visualBodyProfileLabel: sizeEntry.visualBodyProfileLabel,
      proposedScaleFactor: sizeEntry.proposedScaleFactor,
      adaptiveScale,
      sizeMetadata: sizeEntry,
      renderContract: {
        requestedMode: modeInfo.requestedMode,
        activeMode: modeInfo.activeMode,
        defaultMode: modeInfo.defaultMode,
        fallbackMode: 'CARD',
        didFallbackToCard: false,
        fallbackReason: null,
        hasVerifiedCutout: true,
        supportedModes: modeInfo.supportedModes,
        cardImageUrl: modeInfo.cardImageUrl,
        cutoutImageUrl: modeInfo.cutoutImageUrl,
        activeImageUrl: modeInfo.activeImageUrl
      },
      fallbackPresentation: 'INTEGRATED',
      fallbackReason: null
    };
  }

  const adaptiveScale = modeInfo.adaptiveScale;
  return {
    slug: canonicalSlug || key,
    hasIntegratedCutout: false,
    cutoutImageUrl: null,
    sizeCategory: isAirborne ? 'LARGE_WINGED' : 'MEDIUM_GROUNDED',
    groundingMode: adaptiveScale.positioning.groundingMode || (isAirborne ? 'AIRBORNE_HOVER' : 'GROUNDED'),
    pfSizeCategory: sizeEntry.pfSizeCategory,
    pfSizeLabel: sizeEntry.pfSizeLabel,
    visualBodyProfile: sizeEntry.visualBodyProfile,
    visualBodyProfileLabel: sizeEntry.visualBodyProfileLabel,
    proposedScaleFactor: sizeEntry.proposedScaleFactor,
    scaleMultiplier: sizeEntry.proposedScaleFactor,
    verticalOffsetPx: adaptiveScale.positioning.verticalOffsetPx,
    airborneGapPx: adaptiveScale.positioning.airborneGapPx,
    shadowWidthPct: adaptiveScale.shadow.shadowWidthPct,
    shadowBlurPx: adaptiveScale.shadow.shadowBlurPx,
    shadowOpacity: adaptiveScale.shadow.shadowOpacity,
    ambientPatch: adaptiveScale.shadow.ambientPatch,
    contactPatches: adaptiveScale.shadow.contactPatches,
    adaptiveScale,
    sizeMetadata: sizeEntry,
    renderContract: {
      requestedMode: modeInfo.requestedMode,
      activeMode: modeInfo.activeMode,
      defaultMode: modeInfo.defaultMode,
      fallbackMode: 'CARD',
      didFallbackToCard: modeInfo.didFallbackToCard,
      fallbackReason: modeInfo.fallbackReason,
      hasVerifiedCutout: modeInfo.hasVerifiedCutout,
      supportedModes: modeInfo.supportedModes,
      cardImageUrl: modeInfo.cardImageUrl,
      cutoutImageUrl: modeInfo.cutoutImageUrl,
      activeImageUrl: modeInfo.activeImageUrl
    },
    fallbackPresentation: 'CARD',
    fallbackReason: modeInfo.fallbackReason
  };
}

module.exports = {
  INTEGRATED_MONSTER_PROFILES,
  resolveMonsterIntegratedProfile,
  resolveIntegratedMonsterProfile: resolveMonsterIntegratedProfile
};
