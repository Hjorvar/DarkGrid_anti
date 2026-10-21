/**
 * DARKGRID ACTION UI LAB — Pathfinder 1e Monster Size & Adaptive Visual Scaling System
 *
 * Self-contained module inside `action-ui-lab/` implementing:
 *  - Phase 1: Read-only audit of all 98 monsters (68 Core + 30 Seed-010 Expansion) mapped to official Pathfinder 1e sizes
 *             with support for all 9 Pathfinder 1e size categories (FINE through COLOSSAL).
 *  - Phase 2: Complete visual metadata catalog (ID, name, PF1e size, source URL, body profile, proportions,
 *             image paths, empirical pixel content bounds, proposed scale factor, ground/flying positioning,
 *             and verification confidence/notes).
 *  - Phase 3: Adaptive monster scaling engine (`computeAdaptiveMonsterVisualScale`) calculating visible height,
 *             visible width, foot/ground contact position, shadow geometry, PNG transparency / vignette margin
 *             compensation, and responsive viewport UI safety clamping.
 *  - Phase 4: Side-by-side comparison presets across size categories (Tiny, Small, Medium, Large, Huge + all 9 PF1e tiers)
 *             and body profiles within the same size category.
 */

'use strict';

const PF1E_SIZE_CATEGORIES = {
  "FINE": {
    "key": "FINE",
    "order": 1,
    "label": "Fine",
    "pfSpaceFt": 0.5,
    "pfNaturalReachFt": 0,
    "pfSizeModifier": 8,
    "typicalDimensionRange": "< 6 in. (< 0.15 m)",
    "typicalWeightRange": "< 1/8 lb.",
    "baseViewportHeightVh": 7.2,
    "baseScaleFactor": 0.27,
    "shadowScaleMult": 0.32
  },
  "DIMINUTIVE": {
    "key": "DIMINUTIVE",
    "order": 2,
    "label": "Diminutive",
    "pfSpaceFt": 1,
    "pfNaturalReachFt": 0,
    "pfSizeModifier": 4,
    "typicalDimensionRange": "6 in. – 1 ft. (0.15 – 0.3 m)",
    "typicalWeightRange": "1/8 – 1 lb.",
    "baseViewportHeightVh": 9.8,
    "baseScaleFactor": 0.37,
    "shadowScaleMult": 0.44
  },
  "TINY": {
    "key": "TINY",
    "order": 3,
    "label": "Tiny",
    "pfSpaceFt": 2.5,
    "pfNaturalReachFt": 0,
    "pfSizeModifier": 2,
    "typicalDimensionRange": "1 – 2 ft. (0.3 – 0.6 m)",
    "typicalWeightRange": "1 – 8 lbs.",
    "baseViewportHeightVh": 13.2,
    "baseScaleFactor": 0.49,
    "shadowScaleMult": 0.56
  },
  "SMALL": {
    "key": "SMALL",
    "order": 4,
    "label": "Small",
    "pfSpaceFt": 5,
    "pfNaturalReachFt": 5,
    "pfSizeModifier": 1,
    "typicalDimensionRange": "2 – 4 ft. (0.6 – 1.2 m)",
    "typicalWeightRange": "8 – 60 lbs.",
    "baseViewportHeightVh": 18.8,
    "baseScaleFactor": 0.7,
    "shadowScaleMult": 0.76
  },
  "MEDIUM": {
    "key": "MEDIUM",
    "order": 5,
    "label": "Medium",
    "pfSpaceFt": 5,
    "pfNaturalReachFt": 5,
    "pfSizeModifier": 0,
    "typicalDimensionRange": "4 – 8 ft. (1.2 – 2.4 m)",
    "typicalWeightRange": "60 – 500 lbs.",
    "baseViewportHeightVh": 26.8,
    "baseScaleFactor": 1,
    "shadowScaleMult": 1
  },
  "LARGE": {
    "key": "LARGE",
    "order": 6,
    "label": "Large",
    "pfSpaceFt": 10,
    "pfNaturalReachFt": 10,
    "pfSizeModifier": -1,
    "typicalDimensionRange": "8 – 16 ft. (2.4 – 4.9 m)",
    "typicalWeightRange": "500 – 4,000 lbs.",
    "baseViewportHeightVh": 35.5,
    "baseScaleFactor": 1.32,
    "shadowScaleMult": 1.32
  },
  "HUGE": {
    "key": "HUGE",
    "order": 7,
    "label": "Huge",
    "pfSpaceFt": 15,
    "pfNaturalReachFt": 15,
    "pfSizeModifier": -2,
    "typicalDimensionRange": "16 – 32 ft. (4.9 – 9.8 m)",
    "typicalWeightRange": "2 – 16 tons",
    "baseViewportHeightVh": 44.5,
    "baseScaleFactor": 1.66,
    "shadowScaleMult": 1.58
  },
  "GARGANTUAN": {
    "key": "GARGANTUAN",
    "order": 8,
    "label": "Gargantuan",
    "pfSpaceFt": 20,
    "pfNaturalReachFt": 20,
    "pfSizeModifier": -4,
    "typicalDimensionRange": "32 – 64 ft. (9.8 – 19.5 m)",
    "typicalWeightRange": "16 – 125 tons",
    "baseViewportHeightVh": 51,
    "baseScaleFactor": 1.9,
    "shadowScaleMult": 1.75
  },
  "COLOSSAL": {
    "key": "COLOSSAL",
    "order": 9,
    "label": "Colossal",
    "pfSpaceFt": 30,
    "pfNaturalReachFt": 30,
    "pfSizeModifier": -8,
    "typicalDimensionRange": "64+ ft. (19.5+ m)",
    "typicalWeightRange": "125+ tons",
    "baseViewportHeightVh": 56.5,
    "baseScaleFactor": 2.11,
    "shadowScaleMult": 1.9
  }
};

const VISUAL_BODY_PROFILES = {
  "WINGED_TINY_PEST": {
    "key": "WINGED_TINY_PEST",
    "label": "Tiny Winged Pest / Bloodsucker",
    "heightFactor": 0.92,
    "aspectRatio": 1.12,
    "groundingMode": "AIRBORNE_HOVER",
    "airborneLiftPx": 38,
    "shadowWidthPct": 44,
    "shadowBlurPx": 14,
    "shadowOpacity": 0.34,
    "contactMode": "NONE"
  },
  "WINGED_TINY_RAPTOR": {
    "key": "WINGED_TINY_RAPTOR",
    "label": "Tiny Bird of Prey / Raptor",
    "heightFactor": 0.98,
    "aspectRatio": 1.18,
    "groundingMode": "AIRBORNE_HOVER",
    "airborneLiftPx": 42,
    "shadowWidthPct": 48,
    "shadowBlurPx": 15,
    "shadowOpacity": 0.36,
    "contactMode": "NONE"
  },
  "SERPENTINE_TINY": {
    "key": "SERPENTINE_TINY",
    "label": "Tiny Coiled Serpent",
    "heightFactor": 0.78,
    "aspectRatio": 1.24,
    "groundingMode": "GROUNDED_COIL",
    "airborneLiftPx": 0,
    "shadowWidthPct": 68,
    "shadowBlurPx": 6,
    "shadowOpacity": 0.64,
    "contactMode": "COIL_BASE"
  },
  "REPTILIAN_TINY_LOW": {
    "key": "REPTILIAN_TINY_LOW",
    "label": "Tiny Low Reptilian Creature",
    "heightFactor": 0.82,
    "aspectRatio": 1.18,
    "groundingMode": "GROUNDED_PAWS",
    "airborneLiftPx": 0,
    "shadowWidthPct": 66,
    "shadowBlurPx": 6,
    "shadowOpacity": 0.66,
    "contactMode": "QUADRUPED_PAWS"
  },
  "BIPED_SMALL": {
    "key": "BIPED_SMALL",
    "label": "Small Upright Biped (Goblin/Kobold/Fey)",
    "heightFactor": 0.98,
    "aspectRatio": 0.84,
    "groundingMode": "GROUNDED_BIPED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 64,
    "shadowBlurPx": 7,
    "shadowOpacity": 0.68,
    "contactMode": "BIPED_FEET"
  },
  "BIPED_SMALL_STALKER": {
    "key": "BIPED_SMALL_STALKER",
    "label": "Small Hunched Tentacle Stalker",
    "heightFactor": 1.02,
    "aspectRatio": 0.94,
    "groundingMode": "GROUNDED_CROUCH",
    "airborneLiftPx": 0,
    "shadowWidthPct": 70,
    "shadowBlurPx": 7,
    "shadowOpacity": 0.7,
    "contactMode": "BIPED_FEET"
  },
  "BIPED_SMALL_DUAL_SIZE": {
    "key": "BIPED_SMALL_DUAL_SIZE",
    "label": "Small Fey with Large Size Alteration (Spriggan)",
    "heightFactor": 1,
    "aspectRatio": 0.86,
    "groundingMode": "GROUNDED_BIPED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 66,
    "shadowBlurPx": 7,
    "shadowOpacity": 0.7,
    "contactMode": "BIPED_FEET"
  },
  "QUADRUPED_SMALL_LOW": {
    "key": "QUADRUPED_SMALL_LOW",
    "label": "Small Low Quadruped (Dire Rat)",
    "heightFactor": 0.76,
    "aspectRatio": 1.22,
    "groundingMode": "GROUNDED_PAWS",
    "airborneLiftPx": 0,
    "shadowWidthPct": 78,
    "shadowBlurPx": 6,
    "shadowOpacity": 0.7,
    "contactMode": "QUADRUPED_PAWS"
  },
  "ARACHNID_SMALL_SKIMMER": {
    "key": "ARACHNID_SMALL_SKIMMER",
    "label": "Small Wide Multi-Legged Skimmer",
    "heightFactor": 0.72,
    "aspectRatio": 1.32,
    "groundingMode": "GROUNDED_ARACHNID",
    "airborneLiftPx": 0,
    "shadowWidthPct": 86,
    "shadowBlurPx": 6,
    "shadowOpacity": 0.65,
    "contactMode": "ARACHNID_LEGS"
  },
  "SERPENTINE_SMALL_COILED": {
    "key": "SERPENTINE_SMALL_COILED",
    "label": "Small Reared Construct/Serpent",
    "heightFactor": 0.88,
    "aspectRatio": 1.08,
    "groundingMode": "GROUNDED_COIL",
    "airborneLiftPx": 0,
    "shadowWidthPct": 72,
    "shadowBlurPx": 7,
    "shadowOpacity": 0.7,
    "contactMode": "COIL_BASE"
  },
  "AVIAN_SMALL_RUNNER": {
    "key": "AVIAN_SMALL_RUNNER",
    "label": "Small Winged Runner (Cockatrice)",
    "heightFactor": 0.92,
    "aspectRatio": 1.06,
    "groundingMode": "AIRBORNE_LOW_FLUTTER",
    "airborneLiftPx": 14,
    "shadowWidthPct": 64,
    "shadowBlurPx": 9,
    "shadowOpacity": 0.56,
    "contactMode": "BIPED_FEET"
  },
  "AMORPHOUS_SMALL_LURKER": {
    "key": "AMORPHOUS_SMALL_LURKER",
    "label": "Small Tentacled Mantle Lurker",
    "heightFactor": 0.9,
    "aspectRatio": 1.02,
    "groundingMode": "GROUNDED_ROOTED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 74,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.7,
    "contactMode": "COIL_BASE"
  },
  "FLOATING_ORB": {
    "key": "FLOATING_ORB",
    "label": "Small Floating Luminous Sphere (Will-o'-Wisp)",
    "heightFactor": 0.76,
    "aspectRatio": 1,
    "groundingMode": "AIRBORNE_HOVER",
    "airborneLiftPx": 44,
    "shadowWidthPct": 42,
    "shadowBlurPx": 16,
    "shadowOpacity": 0.28,
    "contactMode": "NONE"
  },
  "BIPED_MEDIUM": {
    "key": "BIPED_MEDIUM",
    "label": "Medium Upright Humanoid / Undead",
    "heightFactor": 1,
    "aspectRatio": 0.78,
    "groundingMode": "GROUNDED_BIPED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 68,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.72,
    "contactMode": "BIPED_FEET"
  },
  "BIPED_HEAVY_MEDIUM": {
    "key": "BIPED_HEAVY_MEDIUM",
    "label": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "heightFactor": 1.07,
    "aspectRatio": 0.88,
    "groundingMode": "GROUNDED_BIPED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 76,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.76,
    "contactMode": "BIPED_FEET"
  },
  "BIPED_STOCKY_MEDIUM": {
    "key": "BIPED_STOCKY_MEDIUM",
    "label": "Medium Stocky Dwarf Biped (Duergar)",
    "heightFactor": 0.83,
    "aspectRatio": 0.94,
    "groundingMode": "GROUNDED_BIPED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 74,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.75,
    "contactMode": "BIPED_FEET"
  },
  "BIPED_CROUCHED": {
    "key": "BIPED_CROUCHED",
    "label": "Medium Crouched / Hunched Predator (Ghoul, Ghast)",
    "heightFactor": 0.88,
    "aspectRatio": 1.06,
    "groundingMode": "GROUNDED_CROUCH",
    "airborneLiftPx": 0,
    "shadowWidthPct": 76,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.74,
    "contactMode": "BIPED_FEET"
  },
  "QUADRUPED_LOW": {
    "key": "QUADRUPED_LOW",
    "label": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "heightFactor": 0.76,
    "aspectRatio": 1.15,
    "groundingMode": "GROUNDED_PAWS",
    "airborneLiftPx": 0,
    "shadowWidthPct": 84,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.74,
    "contactMode": "QUADRUPED_PAWS"
  },
  "ARACHNID_WIDE": {
    "key": "ARACHNID_WIDE",
    "label": "Medium Wide Arachnid / Crustacean (Giant Spider, Giant Crab)",
    "heightFactor": 0.68,
    "aspectRatio": 1.48,
    "groundingMode": "GROUNDED_ARACHNID",
    "airborneLiftPx": 0,
    "shadowWidthPct": 94,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.72,
    "contactMode": "ARACHNID_LEGS"
  },
  "WINGED_HOVER_MEDIUM": {
    "key": "WINGED_HOVER_MEDIUM",
    "label": "Medium Winged Flyer (Harpy, Gargoyle, Peryton)",
    "heightFactor": 0.96,
    "aspectRatio": 1.16,
    "groundingMode": "AIRBORNE_HOVER",
    "airborneLiftPx": 36,
    "shadowWidthPct": 62,
    "shadowBlurPx": 15,
    "shadowOpacity": 0.44,
    "contactMode": "NONE"
  },
  "INCORPOREAL_FLOAT": {
    "key": "INCORPOREAL_FLOAT",
    "label": "Medium Incorporeal Floating Specter (Shadow, Wraith)",
    "heightFactor": 1.02,
    "aspectRatio": 0.86,
    "groundingMode": "AIRBORNE_HOVER",
    "airborneLiftPx": 26,
    "shadowWidthPct": 58,
    "shadowBlurPx": 18,
    "shadowOpacity": 0.32,
    "contactMode": "NONE"
  },
  "SERPENTINE_COILED": {
    "key": "SERPENTINE_COILED",
    "label": "Medium Coiled Worm / Centipede (Grick, Giant Centipede)",
    "heightFactor": 0.82,
    "aspectRatio": 1.14,
    "groundingMode": "GROUNDED_COIL",
    "airborneLiftPx": 0,
    "shadowWidthPct": 82,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.74,
    "contactMode": "COIL_BASE"
  },
  "AMORPHOUS_MEDIUM_OOZE": {
    "key": "AMORPHOUS_MEDIUM_OOZE",
    "label": "Medium Amorphous Horror (Gibbering Mouther)",
    "heightFactor": 0.74,
    "aspectRatio": 1.24,
    "groundingMode": "GROUNDED_ROOTED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 90,
    "shadowBlurPx": 9,
    "shadowOpacity": 0.78,
    "contactMode": "COIL_BASE"
  },
  "PLANT_MASS_MEDIUM": {
    "key": "PLANT_MASS_MEDIUM",
    "label": "Medium Fungal / Vine Mass (Violet Fungus, Yellow Musk Creeper)",
    "heightFactor": 0.94,
    "aspectRatio": 0.96,
    "groundingMode": "GROUNDED_ROOTED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 80,
    "shadowBlurPx": 8,
    "shadowOpacity": 0.76,
    "contactMode": "COIL_BASE"
  },
  "BIPED_TALL_BRUTE": {
    "key": "BIPED_TALL_BRUTE",
    "label": "Large Towering Giant / Brute (Troll, Ogre, Minotaur, Yeti)",
    "heightFactor": 1.08,
    "aspectRatio": 0.82,
    "groundingMode": "GROUNDED_HEAVY_BIPED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 78,
    "shadowBlurPx": 10,
    "shadowOpacity": 0.82,
    "contactMode": "BIPED_FEET"
  },
  "QUADRUPED_MASSIVE": {
    "key": "QUADRUPED_MASSIVE",
    "label": "Large Massive Beast (Owlbear, Winter Wolf, Dire Boar, Catoblepas)",
    "heightFactor": 0.86,
    "aspectRatio": 1.16,
    "groundingMode": "GROUNDED_PAWS",
    "airborneLiftPx": 0,
    "shadowWidthPct": 88,
    "shadowBlurPx": 10,
    "shadowOpacity": 0.8,
    "contactMode": "QUADRUPED_PAWS"
  },
  "WINGED_LARGE_PREDATOR": {
    "key": "WINGED_LARGE_PREDATOR",
    "label": "Large Winged Predator / Dragon (Manticore, Wyvern, Griffon)",
    "heightFactor": 0.96,
    "aspectRatio": 1.22,
    "groundingMode": "AIRBORNE_HOVER",
    "airborneLiftPx": 44,
    "shadowWidthPct": 68,
    "shadowBlurPx": 17,
    "shadowOpacity": 0.48,
    "contactMode": "NONE"
  },
  "ARACHNID_CHITIN_LARGE": {
    "key": "ARACHNID_CHITIN_LARGE",
    "label": "Large Chitinous Arachnid / Insectoid (Giant Scorpion, Phase Spider, Ankheg)",
    "heightFactor": 0.8,
    "aspectRatio": 1.28,
    "groundingMode": "GROUNDED_ARACHNID",
    "airborneLiftPx": 0,
    "shadowWidthPct": 94,
    "shadowBlurPx": 10,
    "shadowOpacity": 0.8,
    "contactMode": "ARACHNID_LEGS"
  },
  "AMORPHOUS_LARGE_OOZE": {
    "key": "AMORPHOUS_LARGE_OOZE",
    "label": "Large Sprawling Protoplasmic Ooze (Ochre Jelly)",
    "heightFactor": 0.68,
    "aspectRatio": 1.38,
    "groundingMode": "GROUNDED_ROOTED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 96,
    "shadowBlurPx": 10,
    "shadowOpacity": 0.84,
    "contactMode": "COIL_BASE"
  },
  "PLANT_MASS_LARGE": {
    "key": "PLANT_MASS_LARGE",
    "label": "Large Rooted Botanical / Tentacled Mass (Assassin Vine, Shambling Mound)",
    "heightFactor": 0.98,
    "aspectRatio": 0.96,
    "groundingMode": "GROUNDED_ROOTED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 88,
    "shadowBlurPx": 9,
    "shadowOpacity": 0.82,
    "contactMode": "COIL_BASE"
  },
  "BEHEMOTH_HUGE_COLOSSAL": {
    "key": "BEHEMOTH_HUGE_COLOSSAL",
    "label": "Huge / Gargantuan / Colossal Apex Behemoth",
    "heightFactor": 1.04,
    "aspectRatio": 0.90,
    "groundingMode": "GROUNDED_HEAVY_BIPED",
    "airborneLiftPx": 0,
    "shadowWidthPct": 92,
    "shadowBlurPx": 12,
    "shadowOpacity": 0.86,
    "contactMode": "BIPED_FEET"
  }
};

const MONSTER_SIZE_CATALOG = [
  {
    "id": 1,
    "catalogOrder": 1,
    "catalogBatch": "CORE_68",
    "name": "Assassin Vine",
    "slug": "assassin_vine",
    "symbol": "P",
    "color": "#006400",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Plant",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"J\", \"S\"]",
    "sourceUrl": "https://www.d20pfsrd.com/bestiary/monster-listings/plants/assassin-vine/",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "PLANT_MASS_LARGE",
    "bodyProportions": {
      "approxHeightFt": 10,
      "approxLengthFt": 20,
      "approxWeightLbs": 900,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/assassin_vine.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/assassin_vine.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 796,
      "height": 885,
      "minX": 12,
      "minY": 12,
      "maxX": 783,
      "maxY": 872,
      "contentWidthRatio": 0.9698,
      "contentHeightRatio": 0.9729,
      "topPadRatio": 0.0136,
      "bottomPadRatio": 0.0136,
      "leftPadRatio": 0.0151,
      "rightPadRatio": 0.0151
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 796,
      "height": 885,
      "minX": 12,
      "minY": 12,
      "maxX": 783,
      "maxY": 872,
      "contentWidthRatio": 0.9698,
      "contentHeightRatio": 0.9729,
      "topPadRatio": 0.0136,
      "bottomPadRatio": 0.0136,
      "leftPadRatio": 0.0151,
      "rightPadRatio": 0.0151
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "CLOSEUP_FRAMED_PLANT",
    "auditNotes": "Bestiary 1 Large Plant (20-ft main vine, 10-ft reared height).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Rooted Botanical / Tentacled Mass (Assassin Vine, Shambling Mound)",
    "proposedScaleFactor": 1.294,
    "cutoutStatus": "EXISTING_APPROVED",
    "cutoutValidationMetrics": {
      "width": 796,
      "height": 885,
      "colorType": 6,
      "transparentPixelRatio": 0.5276,
      "opaqueCoreRatio": 0.4271,
      "semiTransparentRatio": 0.0532,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5155,
        "y": 0.5404
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 4,
    "catalogOrder": 2,
    "catalogBatch": "CORE_68",
    "name": "Wolf",
    "slug": "wolf",
    "symbol": "W",
    "color": "#8b5a2b",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"P\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Wolf",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3.2,
      "approxLengthFt": 5.5,
      "approxWeightLbs": 120,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/wolf.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/wolf.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 827,
      "height": 777,
      "minX": 12,
      "minY": 12,
      "maxX": 814,
      "maxY": 764,
      "contentWidthRatio": 0.971,
      "contentHeightRatio": 0.9691,
      "topPadRatio": 0.0154,
      "bottomPadRatio": 0.0154,
      "leftPadRatio": 0.0145,
      "rightPadRatio": 0.0145
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 152,
      "maxX": 996,
      "maxY": 916,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.746,
      "topPadRatio": 0.148,
      "bottomPadRatio": 0.105,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 827,
      "height": 777,
      "minX": 12,
      "minY": 12,
      "maxX": 814,
      "maxY": 764,
      "contentWidthRatio": 0.971,
      "contentHeightRatio": 0.9691,
      "topPadRatio": 0.0154,
      "bottomPadRatio": 0.0154,
      "leftPadRatio": 0.0145,
      "rightPadRatio": 0.0145
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Medium Animal; shoulder height ~3.2 ft (waist-high to human); card has 25% vertical dark margin.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.73,
    "cutoutStatus": "EXISTING_APPROVED",
    "cutoutValidationMetrics": {
      "width": 827,
      "height": 777,
      "colorType": 6,
      "transparentPixelRatio": 0.5298,
      "opaqueCoreRatio": 0.4521,
      "semiTransparentRatio": 0.0227,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5407,
        "y": 0.4142
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 5,
    "catalogOrder": 3,
    "catalogBatch": "CORE_68",
    "name": "Troll",
    "slug": "troll",
    "symbol": "T",
    "color": "#4a5d4e",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Humanoid",
    "creatureSubtype": "giant",
    "movementType": "WALK",
    "habitat": "[\"S\", \"F\", \"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Troll",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "BIPED_TALL_BRUTE",
    "bodyProportions": {
      "approxHeightFt": 14,
      "approxLengthFt": 6,
      "approxWeightLbs": 1000,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/troll.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/troll.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 643,
      "height": 860,
      "minX": 3,
      "minY": 3,
      "maxX": 639,
      "maxY": 856,
      "contentWidthRatio": 0.9907,
      "contentHeightRatio": 0.993,
      "topPadRatio": 0.0035,
      "bottomPadRatio": 0.0035,
      "leftPadRatio": 0.0047,
      "rightPadRatio": 0.0047
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 32,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.031,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 643,
      "height": 860,
      "minX": 3,
      "minY": 3,
      "maxX": 639,
      "maxY": 856,
      "contentWidthRatio": 0.9907,
      "contentHeightRatio": 0.993,
      "topPadRatio": 0.0035,
      "bottomPadRatio": 0.0035,
      "leftPadRatio": 0.0047,
      "rightPadRatio": 0.0047
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Humanoid (giant), 14 ft tall.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Towering Giant / Brute (Troll, Ogre, Minotaur, Yeti)",
    "proposedScaleFactor": 1.54,
    "cutoutStatus": "EXISTING_APPROVED",
    "cutoutValidationMetrics": {
      "width": 643,
      "height": 860,
      "colorType": 6,
      "transparentPixelRatio": 0.4264,
      "opaqueCoreRatio": 0.5651,
      "semiTransparentRatio": 0.0324,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5134,
        "y": 0.4691
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 126,
    "catalogOrder": 4,
    "catalogBatch": "CORE_68",
    "name": "Ghoul",
    "slug": "ghoul",
    "symbol": "G",
    "color": "#7a8b7b",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"P\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Ghoul",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_CROUCHED",
    "bodyProportions": {
      "approxHeightFt": 5.2,
      "approxLengthFt": 3.5,
      "approxWeightLbs": 140,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/ghoul.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/ghoul.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 783,
      "height": 706,
      "minX": 12,
      "minY": 12,
      "maxX": 770,
      "maxY": 693,
      "contentWidthRatio": 0.9693,
      "contentHeightRatio": 0.966,
      "topPadRatio": 0.017,
      "bottomPadRatio": 0.017,
      "leftPadRatio": 0.0153,
      "rightPadRatio": 0.0153
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 84,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.891,
      "topPadRatio": 0.082,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 783,
      "height": 706,
      "minX": 12,
      "minY": 12,
      "maxX": 770,
      "maxY": 693,
      "contentWidthRatio": 0.9693,
      "contentHeightRatio": 0.966,
      "topPadRatio": 0.017,
      "bottomPadRatio": 0.017,
      "leftPadRatio": 0.0153,
      "rightPadRatio": 0.0153
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead in low predatory crouch.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Crouched / Hunched Predator (Ghoul, Ghast)",
    "proposedScaleFactor": 0.827,
    "cutoutStatus": "EXISTING_APPROVED",
    "cutoutValidationMetrics": {
      "width": 783,
      "height": 706,
      "colorType": 6,
      "transparentPixelRatio": 0.5989,
      "opaqueCoreRatio": 0.3767,
      "semiTransparentRatio": 0.0299,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4917,
        "y": 0.4517
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 127,
    "catalogOrder": 5,
    "catalogBatch": "CORE_68",
    "name": "Giant Spider",
    "slug": "giant_spider",
    "symbol": "S",
    "color": "#4a382a",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Vermin",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"J\", \"S\", \"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Spider",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "ARACHNID_WIDE",
    "bodyProportions": {
      "approxHeightFt": 2.5,
      "approxLengthFt": 5.5,
      "approxWeightLbs": 100,
      "statureMultiplier": 0.92
    },
    "imagePath": "/images/monsters/giant_spider.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/giant_spider.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 860,
      "height": 570,
      "minX": 3,
      "minY": 4,
      "maxX": 856,
      "maxY": 565,
      "contentWidthRatio": 0.993,
      "contentHeightRatio": 0.986,
      "topPadRatio": 0.007,
      "bottomPadRatio": 0.007,
      "leftPadRatio": 0.0035,
      "rightPadRatio": 0.0035
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 860,
      "height": 570,
      "minX": 3,
      "minY": 4,
      "maxX": 856,
      "maxY": 565,
      "contentWidthRatio": 0.993,
      "contentHeightRatio": 0.986,
      "topPadRatio": 0.007,
      "bottomPadRatio": 0.007,
      "leftPadRatio": 0.0035,
      "rightPadRatio": 0.0035
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "CORRECTED_INTERNAL_MISMATCH",
    "manualOverrideFlag": "WIDE_LOW_ARACHNID",
    "auditNotes": "Bestiary 1 CR 1 Giant Spider is officially Medium Vermin (5-ft space), previously mislabeled LARGE_ARACHNID in Lab.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Wide Arachnid / Crustacean (Giant Spider, Giant Crab)",
    "proposedScaleFactor": 0.626,
    "cutoutStatus": "EXISTING_APPROVED",
    "cutoutValidationMetrics": {
      "width": 860,
      "height": 570,
      "colorType": 6,
      "transparentPixelRatio": 0.6837,
      "opaqueCoreRatio": 0.3044,
      "semiTransparentRatio": 0.0416,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5358,
        "y": 0.4017
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 128,
    "catalogOrder": 6,
    "catalogBatch": "CORE_68",
    "name": "Choker",
    "slug": "choker",
    "symbol": "C",
    "color": "#8c7b64",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Aberration",
    "creatureSubtype": null,
    "movementType": "CLIMB",
    "habitat": "[\"U\", \"H\", \"M\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Choker",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "BIPED_SMALL_STALKER",
    "bodyProportions": {
      "approxHeightFt": 3.4,
      "approxLengthFt": 2.5,
      "approxWeightLbs": 35,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/choker.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Small Aberration with long tentacle arms.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Hunched Tentacle Stalker",
    "proposedScaleFactor": 0.728,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 129,
    "catalogOrder": 7,
    "catalogBatch": "CORE_68",
    "name": "Rust Monster",
    "slug": "rust_monster",
    "symbol": "R",
    "color": "#9e472a",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Aberration",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"H\", \"M\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Rust%20Monster",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "ARACHNID_WIDE",
    "bodyProportions": {
      "approxHeightFt": 3.5,
      "approxLengthFt": 5.2,
      "approxWeightLbs": 200,
      "statureMultiplier": 0.95
    },
    "imagePath": "/images/monsters/rust_monster.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/rust_monster.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 818,
      "height": 848,
      "minX": 12,
      "minY": 12,
      "maxX": 805,
      "maxY": 835,
      "contentWidthRatio": 0.9707,
      "contentHeightRatio": 0.9717,
      "topPadRatio": 0.0142,
      "bottomPadRatio": 0.0142,
      "leftPadRatio": 0.0147,
      "rightPadRatio": 0.0147
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 818,
      "height": 848,
      "minX": 12,
      "minY": 12,
      "maxX": 805,
      "maxY": 835,
      "contentWidthRatio": 0.9707,
      "contentHeightRatio": 0.9717,
      "topPadRatio": 0.0142,
      "bottomPadRatio": 0.0142,
      "leftPadRatio": 0.0147,
      "rightPadRatio": 0.0147
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Aberration (5 ft long, 3.5 ft high).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Wide Arachnid / Crustacean (Giant Spider, Giant Crab)",
    "proposedScaleFactor": 0.646,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 818,
      "height": 848,
      "colorType": 6,
      "transparentPixelRatio": 0.6166,
      "opaqueCoreRatio": 0.3736,
      "semiTransparentRatio": 0.0141,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.505,
        "y": 0.503
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 130,
    "catalogOrder": 8,
    "catalogBatch": "CORE_68",
    "name": "Manticore",
    "slug": "manticore",
    "symbol": "M",
    "color": "#b35d25",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"H\", \"M\", \"P\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Manticore",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "WINGED_LARGE_PREDATOR",
    "bodyProportions": {
      "approxHeightFt": 7,
      "approxLengthFt": 10,
      "approxWeightLbs": 1000,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/manticore.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/manticore.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 1022,
      "height": 845,
      "minX": 16,
      "minY": 16,
      "maxX": 1009,
      "maxY": 828,
      "contentWidthRatio": 0.9726,
      "contentHeightRatio": 0.9621,
      "topPadRatio": 0.0189,
      "bottomPadRatio": 0.0189,
      "leftPadRatio": 0.0157,
      "rightPadRatio": 0.0117
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 956,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.91,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.066,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 1022,
      "height": 845,
      "minX": 16,
      "minY": 16,
      "maxX": 1009,
      "maxY": 828,
      "contentWidthRatio": 0.9726,
      "contentHeightRatio": 0.9621,
      "topPadRatio": 0.0189,
      "bottomPadRatio": 0.0189,
      "leftPadRatio": 0.0157,
      "rightPadRatio": 0.0117
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Magical Beast, 16-ft wingspan, airborne hover.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Winged Predator / Dragon (Manticore, Wyvern, Griffon)",
    "proposedScaleFactor": 1.293,
    "cutoutStatus": "EXISTING_APPROVED",
    "cutoutValidationMetrics": {
      "width": 1022,
      "height": 845,
      "colorType": 6,
      "transparentPixelRatio": 0.6688,
      "opaqueCoreRatio": 0.3253,
      "semiTransparentRatio": 0.0064,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4495,
        "y": 0.4563
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 495,
    "catalogOrder": 9,
    "catalogBatch": "CORE_68",
    "name": "Kobold",
    "slug": "kobold",
    "symbol": "k",
    "color": "#8b4513",
    "challengeRating": 0.25,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "reptilian",
    "movementType": "WALK",
    "habitat": "[\"U\", \"F\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Kobold",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "BIPED_SMALL",
    "bodyProportions": {
      "approxHeightFt": 3,
      "approxLengthFt": 2,
      "approxWeightLbs": 35,
      "statureMultiplier": 0.95
    },
    "imagePath": "/images/monsters/kobold.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/kobold.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 622,
      "height": 653,
      "minX": 12,
      "minY": 12,
      "maxX": 609,
      "maxY": 640,
      "contentWidthRatio": 0.9614,
      "contentHeightRatio": 0.9632,
      "topPadRatio": 0.0184,
      "bottomPadRatio": 0.0184,
      "leftPadRatio": 0.0193,
      "rightPadRatio": 0.0193
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 64,
      "minY": 96,
      "maxX": 996,
      "maxY": 952,
      "contentWidthRatio": 0.91,
      "contentHeightRatio": 0.836,
      "topPadRatio": 0.094,
      "bottomPadRatio": 0.07,
      "leftPadRatio": 0.063,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 622,
      "height": 653,
      "minX": 12,
      "minY": 12,
      "maxX": 609,
      "maxY": 640,
      "contentWidthRatio": 0.9614,
      "contentHeightRatio": 0.9632,
      "topPadRatio": 0.0184,
      "bottomPadRatio": 0.0184,
      "leftPadRatio": 0.0193,
      "rightPadRatio": 0.0193
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Small Humanoid (reptilian), 3 ft tall.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Upright Biped (Goblin/Kobold/Fey)",
    "proposedScaleFactor": 0.652,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 622,
      "height": 653,
      "colorType": 6,
      "transparentPixelRatio": 0.5963,
      "opaqueCoreRatio": 0.394,
      "semiTransparentRatio": 0.0138,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5608,
        "y": 0.5204
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 496,
    "catalogOrder": 10,
    "catalogBatch": "CORE_68",
    "name": "Goblin",
    "slug": "goblin",
    "symbol": "g",
    "color": "#556b2f",
    "challengeRating": 0.33,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "goblinoid",
    "movementType": "WALK",
    "habitat": "[\"F\", \"P\", \"H\", \"C\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Goblin",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "BIPED_SMALL",
    "bodyProportions": {
      "approxHeightFt": 3.2,
      "approxLengthFt": 2,
      "approxWeightLbs": 35,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/goblin.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/goblin.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 697,
      "height": 855,
      "minX": 12,
      "minY": 12,
      "maxX": 684,
      "maxY": 842,
      "contentWidthRatio": 0.9656,
      "contentHeightRatio": 0.9719,
      "topPadRatio": 0.014,
      "bottomPadRatio": 0.014,
      "leftPadRatio": 0.0172,
      "rightPadRatio": 0.0172
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 697,
      "height": 855,
      "minX": 12,
      "minY": 12,
      "maxX": 684,
      "maxY": 842,
      "contentWidthRatio": 0.9656,
      "contentHeightRatio": 0.9719,
      "topPadRatio": 0.014,
      "bottomPadRatio": 0.014,
      "leftPadRatio": 0.0172,
      "rightPadRatio": 0.0172
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "CLOSEUP_PORTRAIT_CROP",
    "auditNotes": "Bestiary 1 Small Humanoid (goblinoid), 3.2 ft tall; painted close to camera.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Upright Biped (Goblin/Kobold/Fey)",
    "proposedScaleFactor": 0.672,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 697,
      "height": 855,
      "colorType": 6,
      "transparentPixelRatio": 0.5922,
      "opaqueCoreRatio": 0.3992,
      "semiTransparentRatio": 0.0123,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5903,
        "y": 0.451
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 497,
    "catalogOrder": 11,
    "catalogBatch": "CORE_68",
    "name": "Human Skeleton",
    "slug": "human_skeleton",
    "symbol": "s",
    "color": "#dcdcdc",
    "challengeRating": 0.33,
    "soloLevel": 1,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"P\", \"H\", \"S\", \"F\", \"T\", \"D\", \"C\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Human%20Skeleton",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.8,
      "approxLengthFt": 2.2,
      "approxWeightLbs": 35,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/human_skeleton.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/human_skeleton.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 761,
      "height": 918,
      "minX": 12,
      "minY": 12,
      "maxX": 748,
      "maxY": 905,
      "contentWidthRatio": 0.9685,
      "contentHeightRatio": 0.9739,
      "topPadRatio": 0.0131,
      "bottomPadRatio": 0.0131,
      "leftPadRatio": 0.0158,
      "rightPadRatio": 0.0158
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 761,
      "height": 918,
      "minX": 12,
      "minY": 12,
      "maxX": 748,
      "maxY": 905,
      "contentWidthRatio": 0.9685,
      "contentHeightRatio": 0.9739,
      "topPadRatio": 0.0131,
      "bottomPadRatio": 0.0131,
      "leftPadRatio": 0.0158,
      "rightPadRatio": 0.0158
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead human skeleton.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 0.98,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 761,
      "height": 918,
      "colorType": 6,
      "transparentPixelRatio": 0.7685,
      "opaqueCoreRatio": 0.2202,
      "semiTransparentRatio": 0.0157,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.6075,
        "y": 0.4608
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 498,
    "catalogOrder": 12,
    "catalogBatch": "CORE_68",
    "name": "Hobgoblin",
    "slug": "hobgoblin",
    "symbol": "H",
    "color": "#cd853f",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "goblinoid",
    "movementType": "WALK",
    "habitat": "[\"H\", \"M\", \"U\", \"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Hobgoblin",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.6,
      "approxLengthFt": 2.4,
      "approxWeightLbs": 175,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/hobgoblin.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (goblinoid).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 0.98,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 499,
    "catalogOrder": 13,
    "catalogBatch": "CORE_68",
    "name": "Human Zombie",
    "slug": "human_zombie",
    "symbol": "Z",
    "color": "#696969",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"S\", \"U\", \"P\", \"F\", \"C\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Human%20Zombie",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_CROUCHED",
    "bodyProportions": {
      "approxHeightFt": 5.7,
      "approxLengthFt": 2.5,
      "approxWeightLbs": 160,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/human_zombie.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/human_zombie.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 618,
      "height": 905,
      "minX": 12,
      "minY": 12,
      "maxX": 605,
      "maxY": 892,
      "contentWidthRatio": 0.9612,
      "contentHeightRatio": 0.9735,
      "topPadRatio": 0.0133,
      "bottomPadRatio": 0.0133,
      "leftPadRatio": 0.0194,
      "rightPadRatio": 0.0194
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.945,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 618,
      "height": 905,
      "minX": 12,
      "minY": 12,
      "maxX": 605,
      "maxY": 892,
      "contentWidthRatio": 0.9612,
      "contentHeightRatio": 0.9735,
      "topPadRatio": 0.0133,
      "bottomPadRatio": 0.0133,
      "leftPadRatio": 0.0194,
      "rightPadRatio": 0.0194
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead shambling human zombie.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Crouched / Hunched Predator (Ghoul, Ghast)",
    "proposedScaleFactor": 0.845,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 618,
      "height": 905,
      "colorType": 6,
      "transparentPixelRatio": 0.6719,
      "opaqueCoreRatio": 0.3184,
      "semiTransparentRatio": 0.0131,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4292,
        "y": 0.4438
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 500,
    "catalogOrder": 14,
    "catalogBatch": "CORE_68",
    "name": "Troglodyte",
    "slug": "troglodyte",
    "symbol": "t",
    "color": "#4e5d42",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "reptilian",
    "movementType": "WALK",
    "habitat": "[\"U\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Troglodyte",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.5,
      "approxLengthFt": 2.8,
      "approxWeightLbs": 150,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/troglodyte.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (reptilian).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 0.96,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 501,
    "catalogOrder": 15,
    "catalogBatch": "CORE_68",
    "name": "Darkmantle",
    "slug": "darkmantle",
    "symbol": "d",
    "color": "#2f4f4f",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Darkmantle",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "AMORPHOUS_SMALL_LURKER",
    "bodyProportions": {
      "approxHeightFt": 3.5,
      "approxLengthFt": 3.5,
      "approxWeightLbs": 40,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/darkmantle.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 80,
      "minY": 60,
      "maxX": 960,
      "maxY": 944,
      "contentWidthRatio": 0.859,
      "contentHeightRatio": 0.863,
      "topPadRatio": 0.059,
      "bottomPadRatio": 0.078,
      "leftPadRatio": 0.078,
      "rightPadRatio": 0.063
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 80,
      "minY": 60,
      "maxX": 960,
      "maxY": 944,
      "contentWidthRatio": 0.859,
      "contentHeightRatio": 0.863,
      "topPadRatio": 0.059,
      "bottomPadRatio": 0.078,
      "leftPadRatio": 0.078,
      "rightPadRatio": 0.063
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Small Magical Beast.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Tentacled Mantle Lurker",
    "proposedScaleFactor": 0.605,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 502,
    "catalogOrder": 16,
    "catalogBatch": "CORE_68",
    "name": "Lizardfolk",
    "slug": "lizardfolk",
    "symbol": "L",
    "color": "#2e8b57",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "reptilian",
    "movementType": "WALK",
    "habitat": "[\"S\", \"R\", \"C\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Lizardfolk",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.5,
      "approxLengthFt": 3.5,
      "approxWeightLbs": 220,
      "statureMultiplier": 1.04
    },
    "imagePath": "/images/monsters/lizardfolk.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/lizardfolk.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 803,
      "height": 880,
      "minX": 12,
      "minY": 12,
      "maxX": 790,
      "maxY": 867,
      "contentWidthRatio": 0.9701,
      "contentHeightRatio": 0.9727,
      "topPadRatio": 0.0136,
      "bottomPadRatio": 0.0136,
      "leftPadRatio": 0.0149,
      "rightPadRatio": 0.0149
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 803,
      "height": 880,
      "minX": 12,
      "minY": 12,
      "maxX": 790,
      "maxY": 867,
      "contentWidthRatio": 0.9701,
      "contentHeightRatio": 0.9727,
      "topPadRatio": 0.0136,
      "bottomPadRatio": 0.0136,
      "leftPadRatio": 0.0149,
      "rightPadRatio": 0.0149
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (reptilian), 6–7 ft tall.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.113,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 803,
      "height": 880,
      "colorType": 6,
      "transparentPixelRatio": 0.5397,
      "opaqueCoreRatio": 0.4512,
      "semiTransparentRatio": 0.0129,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5654,
        "y": 0.4672
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 503,
    "catalogOrder": 17,
    "catalogBatch": "CORE_68",
    "name": "Hyena",
    "slug": "hyena",
    "symbol": "h",
    "color": "#a0522d",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"P\", \"D\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Hyena",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3,
      "approxLengthFt": 5,
      "approxWeightLbs": 120,
      "statureMultiplier": 0.92
    },
    "imagePath": "/images/monsters/hyena.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 152,
      "maxX": 996,
      "maxY": 920,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.75,
      "topPadRatio": 0.148,
      "bottomPadRatio": 0.102,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 152,
      "maxX": 996,
      "maxY": 920,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.75,
      "topPadRatio": 0.148,
      "bottomPadRatio": 0.102,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Medium Animal; card has 25% vertical dark margin.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.699,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 504,
    "catalogOrder": 18,
    "catalogBatch": "CORE_68",
    "name": "Gnoll",
    "slug": "gnoll",
    "symbol": "G",
    "color": "#8b5a2b",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "gnoll",
    "movementType": "WALK",
    "habitat": "[\"D\", \"P\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Gnoll",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.8,
      "approxLengthFt": 2.8,
      "approxWeightLbs": 260,
      "statureMultiplier": 1.06
    },
    "imagePath": "/images/monsters/gnoll.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/gnoll.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 721,
      "height": 916,
      "minX": 12,
      "minY": 12,
      "maxX": 708,
      "maxY": 903,
      "contentWidthRatio": 0.9667,
      "contentHeightRatio": 0.9738,
      "topPadRatio": 0.0131,
      "bottomPadRatio": 0.0131,
      "leftPadRatio": 0.0166,
      "rightPadRatio": 0.0166
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 72,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.902,
      "topPadRatio": 0.07,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 721,
      "height": 916,
      "minX": 12,
      "minY": 12,
      "maxX": 708,
      "maxY": 903,
      "contentWidthRatio": 0.9667,
      "contentHeightRatio": 0.9738,
      "topPadRatio": 0.0131,
      "bottomPadRatio": 0.0131,
      "leftPadRatio": 0.0166,
      "rightPadRatio": 0.0166
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (gnoll), ~6.8 ft tall.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.134,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 721,
      "height": 916,
      "colorType": 6,
      "transparentPixelRatio": 0.4649,
      "opaqueCoreRatio": 0.5271,
      "semiTransparentRatio": 0.0113,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4776,
        "y": 0.4679
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 505,
    "catalogOrder": 19,
    "catalogBatch": "CORE_68",
    "name": "Giant Frog",
    "slug": "giant_frog",
    "symbol": "F",
    "color": "#2e8b57",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"R\", \"S\", \"A\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Frog",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 2.8,
      "approxLengthFt": 5,
      "approxWeightLbs": 150,
      "statureMultiplier": 0.9
    },
    "imagePath": "/images/monsters/giant_frog.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 116,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.859,
      "topPadRatio": 0.113,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 116,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.859,
      "topPadRatio": 0.113,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Medium Animal, crouched amphibian.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.684,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 506,
    "catalogOrder": 20,
    "catalogBatch": "CORE_68",
    "name": "Boar",
    "slug": "boar",
    "symbol": "b",
    "color": "#5c4033",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"P\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Boar",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3.2,
      "approxLengthFt": 5.2,
      "approxWeightLbs": 240,
      "statureMultiplier": 0.95
    },
    "imagePath": "/images/monsters/boar.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Animal.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.722,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 507,
    "catalogOrder": 21,
    "catalogBatch": "CORE_68",
    "name": "Yellow Musk Creeper",
    "slug": "yellow_musk_creeper",
    "symbol": "Y",
    "color": "#d4af37",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Plant",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"U\", \"J\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Yellow%20Musk%20Creeper",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "PLANT_MASS_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.2,
      "approxLengthFt": 6,
      "approxWeightLbs": 250,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/yellow_musk_creeper.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Plant.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Fungal / Vine Mass (Violet Fungus, Yellow Musk Creeper)",
    "proposedScaleFactor": 0.921,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 508,
    "catalogOrder": 22,
    "catalogBatch": "CORE_68",
    "name": "Bugbear",
    "slug": "bugbear",
    "symbol": "B",
    "color": "#8b4513",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Humanoid",
    "creatureSubtype": "goblinoid",
    "movementType": "WALK",
    "habitat": "[\"H\", \"M\", \"F\", \"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Bugbear",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.8,
      "approxLengthFt": 3,
      "approxWeightLbs": 300,
      "statureMultiplier": 1.08
    },
    "imagePath": "/images/monsters/bugbear.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/bugbear.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 737,
      "height": 947,
      "minX": 12,
      "minY": 12,
      "maxX": 724,
      "maxY": 934,
      "contentWidthRatio": 0.9674,
      "contentHeightRatio": 0.9747,
      "topPadRatio": 0.0127,
      "bottomPadRatio": 0.0127,
      "leftPadRatio": 0.0163,
      "rightPadRatio": 0.0163
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 737,
      "height": 947,
      "minX": 12,
      "minY": 12,
      "maxX": 724,
      "maxY": 934,
      "contentWidthRatio": 0.9674,
      "contentHeightRatio": 0.9747,
      "topPadRatio": 0.0127,
      "bottomPadRatio": 0.0127,
      "leftPadRatio": 0.0163,
      "rightPadRatio": 0.0163
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (goblinoid), nearly 7 ft tall.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.156,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 737,
      "height": 947,
      "colorType": 6,
      "transparentPixelRatio": 0.4732,
      "opaqueCoreRatio": 0.5189,
      "semiTransparentRatio": 0.0113,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5211,
        "y": 0.4699
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 509,
    "catalogOrder": 23,
    "catalogBatch": "CORE_68",
    "name": "Boggard",
    "slug": "boggard",
    "symbol": "b",
    "color": "#6b8e23",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Humanoid",
    "creatureSubtype": "boggard",
    "movementType": "WALK",
    "habitat": "[\"S\", \"R\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Boggard",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.2,
      "approxLengthFt": 3.2,
      "approxWeightLbs": 210,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/boggard.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 32,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.031,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 32,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.031,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (boggard), broad frog-kin.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.049,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 510,
    "catalogOrder": 24,
    "catalogBatch": "CORE_68",
    "name": "Death Dog",
    "slug": "death_dog",
    "symbol": "D",
    "color": "#4a0e17",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"D\", \"P\", \"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Death%20Dog",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3.6,
      "approxLengthFt": 5.8,
      "approxWeightLbs": 180,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/death_dog.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 132,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.844,
      "topPadRatio": 0.129,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 132,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.844,
      "topPadRatio": 0.129,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "CORRECTED_INTERNAL_MISMATCH",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 4 Death Dog is officially Medium Magical Beast (previously noted as Large in expansion plan).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.76,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 511,
    "catalogOrder": 25,
    "catalogBatch": "CORE_68",
    "name": "Giant Crab",
    "slug": "giant_crab",
    "symbol": "C",
    "color": "#8b0000",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Vermin",
    "creatureSubtype": "aquatic",
    "movementType": "WALK",
    "habitat": "[\"C\", \"R\", \"A\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Crab",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "ARACHNID_WIDE",
    "bodyProportions": {
      "approxHeightFt": 2.2,
      "approxLengthFt": 5.2,
      "approxWeightLbs": 140,
      "statureMultiplier": 0.88
    },
    "imagePath": "/images/monsters/giant_crab.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/giant_crab.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 880,
      "height": 837,
      "minX": 12,
      "minY": 12,
      "maxX": 867,
      "maxY": 824,
      "contentWidthRatio": 0.9727,
      "contentHeightRatio": 0.9713,
      "topPadRatio": 0.0143,
      "bottomPadRatio": 0.0143,
      "leftPadRatio": 0.0136,
      "rightPadRatio": 0.0136
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 880,
      "height": 837,
      "minX": 12,
      "minY": 12,
      "maxX": 867,
      "maxY": 824,
      "contentWidthRatio": 0.9727,
      "contentHeightRatio": 0.9713,
      "topPadRatio": 0.0143,
      "bottomPadRatio": 0.0143,
      "leftPadRatio": 0.0136,
      "rightPadRatio": 0.0136
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 CR 2 Giant Crab is Medium Vermin (aquatic).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Wide Arachnid / Crustacean (Giant Spider, Giant Crab)",
    "proposedScaleFactor": 0.598,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 880,
      "height": 837,
      "colorType": 6,
      "transparentPixelRatio": 0.564,
      "opaqueCoreRatio": 0.4243,
      "semiTransparentRatio": 0.0165,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.502,
        "y": 0.4527
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 512,
    "catalogOrder": 26,
    "catalogBatch": "CORE_68",
    "name": "Ettercap",
    "slug": "ettercap",
    "symbol": "e",
    "color": "#4b0082",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Aberration",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Ettercap",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_CROUCHED",
    "bodyProportions": {
      "approxHeightFt": 5.4,
      "approxLengthFt": 3,
      "approxWeightLbs": 170,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/ettercap.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 40,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.934,
      "topPadRatio": 0.039,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 40,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.934,
      "topPadRatio": 0.039,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Aberration.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Crouched / Hunched Predator (Ghoul, Ghast)",
    "proposedScaleFactor": 0.845,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 513,
    "catalogOrder": 27,
    "catalogBatch": "CORE_68",
    "name": "Cockatrice",
    "slug": "cockatrice",
    "symbol": "c",
    "color": "#808000",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"P\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Cockatrice",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "AVIAN_SMALL_RUNNER",
    "bodyProportions": {
      "approxHeightFt": 3,
      "approxLengthFt": 4,
      "approxWeightLbs": 25,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/cockatrice.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 84,
      "maxX": 996,
      "maxY": 976,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.871,
      "topPadRatio": 0.082,
      "bottomPadRatio": 0.047,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 84,
      "maxX": 996,
      "maxY": 976,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.871,
      "topPadRatio": 0.082,
      "bottomPadRatio": 0.047,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Small Magical Beast.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Winged Runner (Cockatrice)",
    "proposedScaleFactor": 0.618,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 514,
    "catalogOrder": 28,
    "catalogBatch": "CORE_68",
    "name": "Ankheg",
    "slug": "ankheg",
    "symbol": "A",
    "color": "#8b5a2b",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"P\", \"F\", \"D\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Ankheg",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "ARACHNID_CHITIN_LARGE",
    "bodyProportions": {
      "approxHeightFt": 5.5,
      "approxLengthFt": 10,
      "approxWeightLbs": 800,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/ankheg.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/ankheg.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 684,
      "height": 830,
      "minX": 12,
      "minY": 12,
      "maxX": 671,
      "maxY": 817,
      "contentWidthRatio": 0.9649,
      "contentHeightRatio": 0.9711,
      "topPadRatio": 0.0145,
      "bottomPadRatio": 0.0145,
      "leftPadRatio": 0.0175,
      "rightPadRatio": 0.0175
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 104,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.871,
      "topPadRatio": 0.102,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 684,
      "height": 830,
      "minX": 12,
      "minY": 12,
      "maxX": 671,
      "maxY": 817,
      "contentWidthRatio": 0.9649,
      "contentHeightRatio": 0.9711,
      "topPadRatio": 0.0145,
      "bottomPadRatio": 0.0145,
      "leftPadRatio": 0.0175,
      "rightPadRatio": 0.0175
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Large Magical Beast (10 ft long burrower).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Chitinous Arachnid / Insectoid (Giant Scorpion, Phase Spider, Ankheg)",
    "proposedScaleFactor": 1.014,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 684,
      "height": 830,
      "colorType": 6,
      "transparentPixelRatio": 0.6241,
      "opaqueCoreRatio": 0.36,
      "semiTransparentRatio": 0.0232,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4887,
        "y": 0.4894
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 515,
    "catalogOrder": 29,
    "catalogBatch": "CORE_68",
    "name": "Ogre",
    "slug": "ogre",
    "symbol": "O",
    "color": "#8b4513",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Humanoid",
    "creatureSubtype": "giant",
    "movementType": "WALK",
    "habitat": "[\"H\", \"M\", \"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Ogre",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "BIPED_TALL_BRUTE",
    "bodyProportions": {
      "approxHeightFt": 10,
      "approxLengthFt": 4.5,
      "approxWeightLbs": 650,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/ogre.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/ogre.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 854,
      "height": 983,
      "minX": 12,
      "minY": 12,
      "maxX": 841,
      "maxY": 970,
      "contentWidthRatio": 0.9719,
      "contentHeightRatio": 0.9756,
      "topPadRatio": 0.0122,
      "bottomPadRatio": 0.0122,
      "leftPadRatio": 0.0141,
      "rightPadRatio": 0.0141
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 854,
      "height": 983,
      "minX": 12,
      "minY": 12,
      "maxX": 841,
      "maxY": 970,
      "contentWidthRatio": 0.9719,
      "contentHeightRatio": 0.9756,
      "topPadRatio": 0.0122,
      "bottomPadRatio": 0.0122,
      "leftPadRatio": 0.0141,
      "rightPadRatio": 0.0141
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Humanoid (giant), 10 ft tall.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Towering Giant / Brute (Troll, Ogre, Minotaur, Yeti)",
    "proposedScaleFactor": 1.426,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 854,
      "height": 983,
      "colorType": 6,
      "transparentPixelRatio": 0.5325,
      "opaqueCoreRatio": 0.4592,
      "semiTransparentRatio": 0.0115,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4545,
        "y": 0.4743
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 516,
    "catalogOrder": 30,
    "catalogBatch": "CORE_68",
    "name": "Shadow",
    "slug": "shadow",
    "symbol": "S",
    "color": "#1c1c1c",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Undead",
    "creatureSubtype": "incorporeal",
    "movementType": "FLY",
    "habitat": "[\"U\", \"F\", \"H\", \"T\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Shadow",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "INCORPOREAL_FLOAT",
    "bodyProportions": {
      "approxHeightFt": 6,
      "approxLengthFt": 2.5,
      "approxWeightLbs": 0,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/shadow.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/shadow.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 531,
      "height": 838,
      "minX": 12,
      "minY": 12,
      "maxX": 518,
      "maxY": 825,
      "contentWidthRatio": 0.9548,
      "contentHeightRatio": 0.9714,
      "topPadRatio": 0.0143,
      "bottomPadRatio": 0.0143,
      "leftPadRatio": 0.0226,
      "rightPadRatio": 0.0226
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 32,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.031,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 531,
      "height": 838,
      "minX": 12,
      "minY": 12,
      "maxX": 518,
      "maxY": 825,
      "contentWidthRatio": 0.9548,
      "contentHeightRatio": 0.9714,
      "topPadRatio": 0.0143,
      "bottomPadRatio": 0.0143,
      "leftPadRatio": 0.0226,
      "rightPadRatio": 0.0226
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead (incorporeal).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Incorporeal Floating Specter (Shadow, Wraith)",
    "proposedScaleFactor": 1.02,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 531,
      "height": 838,
      "colorType": 6,
      "transparentPixelRatio": 0.6074,
      "opaqueCoreRatio": 0.3798,
      "semiTransparentRatio": 0.0184,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5057,
        "y": 0.4802
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 517,
    "catalogOrder": 31,
    "catalogBatch": "CORE_68",
    "name": "Owlbear",
    "slug": "owlbear",
    "symbol": "O",
    "color": "#554138",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Owlbear",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "QUADRUPED_MASSIVE",
    "bodyProportions": {
      "approxHeightFt": 8.5,
      "approxLengthFt": 9,
      "approxWeightLbs": 1500,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/owlbear.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/owlbear.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 773,
      "height": 867,
      "minX": 12,
      "minY": 12,
      "maxX": 760,
      "maxY": 854,
      "contentWidthRatio": 0.969,
      "contentHeightRatio": 0.9723,
      "topPadRatio": 0.0138,
      "bottomPadRatio": 0.0138,
      "leftPadRatio": 0.0155,
      "rightPadRatio": 0.0155
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 773,
      "height": 867,
      "minX": 12,
      "minY": 12,
      "maxX": 760,
      "maxY": 854,
      "contentWidthRatio": 0.969,
      "contentHeightRatio": 0.9723,
      "topPadRatio": 0.0138,
      "bottomPadRatio": 0.0138,
      "leftPadRatio": 0.0155,
      "rightPadRatio": 0.0155
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Magical Beast.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Massive Beast (Owlbear, Winter Wolf, Dire Boar, Catoblepas)",
    "proposedScaleFactor": 1.158,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 773,
      "height": 867,
      "colorType": 6,
      "transparentPixelRatio": 0.4172,
      "opaqueCoreRatio": 0.5765,
      "semiTransparentRatio": 0.0089,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5027,
        "y": 0.5005
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 518,
    "catalogOrder": 32,
    "catalogBatch": "CORE_68",
    "name": "Minotaur",
    "slug": "minotaur",
    "symbol": "M",
    "color": "#8b0000",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Monstrous Humanoid",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Minotaur",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "BIPED_TALL_BRUTE",
    "bodyProportions": {
      "approxHeightFt": 8.8,
      "approxLengthFt": 4.5,
      "approxWeightLbs": 700,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/minotaur.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/minotaur.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 823,
      "height": 943,
      "minX": 12,
      "minY": 12,
      "maxX": 810,
      "maxY": 930,
      "contentWidthRatio": 0.9708,
      "contentHeightRatio": 0.9745,
      "topPadRatio": 0.0127,
      "bottomPadRatio": 0.0127,
      "leftPadRatio": 0.0146,
      "rightPadRatio": 0.0146
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 823,
      "height": 943,
      "minX": 12,
      "minY": 12,
      "maxX": 810,
      "maxY": 930,
      "contentWidthRatio": 0.9708,
      "contentHeightRatio": 0.9745,
      "topPadRatio": 0.0127,
      "bottomPadRatio": 0.0127,
      "leftPadRatio": 0.0146,
      "rightPadRatio": 0.0146
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Monstrous Humanoid.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Towering Giant / Brute (Troll, Ogre, Minotaur, Yeti)",
    "proposedScaleFactor": 1.397,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 823,
      "height": 943,
      "colorType": 6,
      "transparentPixelRatio": 0.4967,
      "opaqueCoreRatio": 0.4933,
      "semiTransparentRatio": 0.014,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4785,
        "y": 0.4966
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 519,
    "catalogOrder": 33,
    "catalogBatch": "CORE_68",
    "name": "Yeti",
    "slug": "yeti",
    "symbol": "Y",
    "color": "#f0f8ff",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Monstrous Humanoid",
    "creatureSubtype": "cold",
    "movementType": "WALK",
    "habitat": "[\"M\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Yeti",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "BIPED_TALL_BRUTE",
    "bodyProportions": {
      "approxHeightFt": 9.5,
      "approxLengthFt": 4.5,
      "approxWeightLbs": 600,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/yeti.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 32,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.031,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 32,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.031,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Monstrous Humanoid (cold).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Towering Giant / Brute (Troll, Ogre, Minotaur, Yeti)",
    "proposedScaleFactor": 1.426,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 520,
    "catalogOrder": 34,
    "catalogBatch": "CORE_68",
    "name": "Gargoyle",
    "slug": "gargoyle",
    "symbol": "g",
    "color": "#708090",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Monstrous Humanoid",
    "creatureSubtype": "earth",
    "movementType": "FLY",
    "habitat": "[\"T\", \"U\", \"H\", \"M\", \"C\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Gargoyle",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "WINGED_HOVER_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.8,
      "approxLengthFt": 8.5,
      "approxWeightLbs": 500,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/gargoyle.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/gargoyle.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 764,
      "height": 835,
      "minX": 12,
      "minY": 12,
      "maxX": 751,
      "maxY": 822,
      "contentWidthRatio": 0.9686,
      "contentHeightRatio": 0.9713,
      "topPadRatio": 0.0144,
      "bottomPadRatio": 0.0144,
      "leftPadRatio": 0.0157,
      "rightPadRatio": 0.0157
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 72,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.902,
      "topPadRatio": 0.07,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 764,
      "height": 835,
      "minX": 12,
      "minY": 12,
      "maxX": 751,
      "maxY": 822,
      "contentWidthRatio": 0.9686,
      "contentHeightRatio": 0.9713,
      "topPadRatio": 0.0144,
      "bottomPadRatio": 0.0144,
      "leftPadRatio": 0.0157,
      "rightPadRatio": 0.0157
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Monstrous Humanoid (earth).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Winged Flyer (Harpy, Gargoyle, Peryton)",
    "proposedScaleFactor": 0.979,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 764,
      "height": 835,
      "colorType": 6,
      "transparentPixelRatio": 0.458,
      "opaqueCoreRatio": 0.5328,
      "semiTransparentRatio": 0.013,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4971,
        "y": 0.4822
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 521,
    "catalogOrder": 35,
    "catalogBatch": "CORE_68",
    "name": "Basilisk",
    "slug": "basilisk",
    "symbol": "B",
    "color": "#556b2f",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"H\", \"M\", \"U\", \"D\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Basilisk",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 2.8,
      "approxLengthFt": 12,
      "approxWeightLbs": 300,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/basilisk.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/basilisk.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 749,
      "height": 576,
      "minX": 12,
      "minY": 12,
      "maxX": 736,
      "maxY": 563,
      "contentWidthRatio": 0.968,
      "contentHeightRatio": 0.9583,
      "topPadRatio": 0.0208,
      "bottomPadRatio": 0.0208,
      "leftPadRatio": 0.016,
      "rightPadRatio": 0.016
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 36,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.938,
      "topPadRatio": 0.035,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 749,
      "height": 576,
      "minX": 12,
      "minY": 12,
      "maxX": 736,
      "maxY": 563,
      "contentWidthRatio": 0.968,
      "contentHeightRatio": 0.9583,
      "topPadRatio": 0.0208,
      "bottomPadRatio": 0.0208,
      "leftPadRatio": 0.016,
      "rightPadRatio": 0.016
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Magical Beast (12 ft long with tail, low eight-legged reptile).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.73,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 749,
      "height": 576,
      "colorType": 6,
      "transparentPixelRatio": 0.5204,
      "opaqueCoreRatio": 0.4705,
      "semiTransparentRatio": 0.013,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.475,
        "y": 0.479
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 522,
    "catalogOrder": 36,
    "catalogBatch": "CORE_68",
    "name": "Mummy",
    "slug": "mummy",
    "symbol": "M",
    "color": "#d2b48c",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"D\", \"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Mummy",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6,
      "approxLengthFt": 2.4,
      "approxWeightLbs": 140,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/mummy.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/mummy.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 709,
      "height": 928,
      "minX": 12,
      "minY": 12,
      "maxX": 696,
      "maxY": 915,
      "contentWidthRatio": 0.9661,
      "contentHeightRatio": 0.9741,
      "topPadRatio": 0.0129,
      "bottomPadRatio": 0.0129,
      "leftPadRatio": 0.0169,
      "rightPadRatio": 0.0169
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 28,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.945,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.027,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 709,
      "height": 928,
      "minX": 12,
      "minY": 12,
      "maxX": 696,
      "maxY": 915,
      "contentWidthRatio": 0.9661,
      "contentHeightRatio": 0.9741,
      "topPadRatio": 0.0129,
      "bottomPadRatio": 0.0129,
      "leftPadRatio": 0.0169,
      "rightPadRatio": 0.0169
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 1,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 709,
      "height": 928,
      "colorType": 6,
      "transparentPixelRatio": 0.6788,
      "opaqueCoreRatio": 0.3111,
      "semiTransparentRatio": 0.0138,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4551,
        "y": 0.4263
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 523,
    "catalogOrder": 37,
    "catalogBatch": "CORE_68",
    "name": "Ochre Jelly",
    "slug": "ochre_jelly",
    "symbol": "J",
    "color": "#cc7722",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Ooze",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Ochre%20Jelly",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "AMORPHOUS_LARGE_OOZE",
    "bodyProportions": {
      "approxHeightFt": 3.8,
      "approxLengthFt": 10,
      "approxWeightLbs": 2400,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/ochre_jelly.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/ochre_jelly.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 928,
      "height": 714,
      "minX": 12,
      "minY": 12,
      "maxX": 915,
      "maxY": 701,
      "contentWidthRatio": 0.9741,
      "contentHeightRatio": 0.9664,
      "topPadRatio": 0.0168,
      "bottomPadRatio": 0.0168,
      "leftPadRatio": 0.0129,
      "rightPadRatio": 0.0129
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.945,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 928,
      "height": 714,
      "minX": 12,
      "minY": 12,
      "maxX": 915,
      "maxY": 701,
      "contentWidthRatio": 0.9741,
      "contentHeightRatio": 0.9664,
      "topPadRatio": 0.0168,
      "bottomPadRatio": 0.0168,
      "leftPadRatio": 0.0129,
      "rightPadRatio": 0.0129
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "WIDE_OOZE_SPRAWL",
    "auditNotes": "Bestiary 1 Large Ooze (10-ft wide protoplasmic mass, low height).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Sprawling Protoplasmic Ooze (Ochre Jelly)",
    "proposedScaleFactor": 0.844,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 928,
      "height": 714,
      "colorType": 6,
      "transparentPixelRatio": 0.5367,
      "opaqueCoreRatio": 0.4534,
      "semiTransparentRatio": 0.0146,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5097,
        "y": 0.5191
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 524,
    "catalogOrder": 38,
    "catalogBatch": "CORE_68",
    "name": "Winter Wolf",
    "slug": "winter_wolf",
    "symbol": "W",
    "color": "#e0ffff",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Magical Beast",
    "creatureSubtype": "cold",
    "movementType": "WALK",
    "habitat": "[\"M\", \"F\", \"P\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Winter%20Wolf",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "QUADRUPED_MASSIVE",
    "bodyProportions": {
      "approxHeightFt": 5.2,
      "approxLengthFt": 9,
      "approxWeightLbs": 450,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/winter_wolf.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/winter_wolf.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 831,
      "height": 776,
      "minX": 12,
      "minY": 12,
      "maxX": 818,
      "maxY": 763,
      "contentWidthRatio": 0.9711,
      "contentHeightRatio": 0.9691,
      "topPadRatio": 0.0155,
      "bottomPadRatio": 0.0155,
      "leftPadRatio": 0.0144,
      "rightPadRatio": 0.0144
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 831,
      "height": 776,
      "minX": 12,
      "minY": 12,
      "maxX": 818,
      "maxY": 763,
      "contentWidthRatio": 0.9711,
      "contentHeightRatio": 0.9691,
      "topPadRatio": 0.0155,
      "bottomPadRatio": 0.0155,
      "leftPadRatio": 0.0144,
      "rightPadRatio": 0.0144
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Magical Beast (cold), 9 ft long.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Massive Beast (Owlbear, Winter Wolf, Dire Boar, Catoblepas)",
    "proposedScaleFactor": 1.09,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 831,
      "height": 776,
      "colorType": 6,
      "transparentPixelRatio": 0.51,
      "opaqueCoreRatio": 0.483,
      "semiTransparentRatio": 0.0099,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5443,
        "y": 0.4258
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2691,
    "catalogOrder": 39,
    "catalogBatch": "CORE_68",
    "name": "Stirge",
    "slug": "stirge",
    "symbol": "s",
    "color": "#8b0000",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"S\", \"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Stirge",
    "pfSizeCategory": "TINY",
    "visualBodyProfile": "WINGED_TINY_PEST",
    "bodyProportions": {
      "approxHeightFt": 1,
      "approxLengthFt": 2,
      "approxWeightLbs": 1,
      "statureMultiplier": 0.95
    },
    "imagePath": "/images/monsters/stirge.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/stirge.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 753,
      "height": 746,
      "minX": 12,
      "minY": 12,
      "maxX": 740,
      "maxY": 733,
      "contentWidthRatio": 0.9681,
      "contentHeightRatio": 0.9678,
      "topPadRatio": 0.0161,
      "bottomPadRatio": 0.0161,
      "leftPadRatio": 0.0159,
      "rightPadRatio": 0.0159
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 753,
      "height": 746,
      "minX": 12,
      "minY": 12,
      "maxX": 740,
      "maxY": 733,
      "contentWidthRatio": 0.9681,
      "contentHeightRatio": 0.9678,
      "topPadRatio": 0.0161,
      "bottomPadRatio": 0.0161,
      "leftPadRatio": 0.0159,
      "rightPadRatio": 0.0159
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "CLOSEUP_PORTRAIT_CROP",
    "auditNotes": "Bestiary 1 Tiny Magical Beast (1 ft long, 1 lb); painted as close-up on branch.",
    "pfSizeOrder": 3,
    "pfSizeLabel": "Tiny",
    "pfSpaceFt": 2.5,
    "visualBodyProfileLabel": "Tiny Winged Pest / Bloodsucker",
    "proposedScaleFactor": 0.428,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 753,
      "height": 746,
      "colorType": 6,
      "transparentPixelRatio": 0.7095,
      "opaqueCoreRatio": 0.2814,
      "semiTransparentRatio": 0.0131,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.492,
        "y": 0.4213
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2692,
    "catalogOrder": 40,
    "catalogBatch": "CORE_68",
    "name": "Dire Rat",
    "slug": "dire_rat",
    "symbol": "r",
    "color": "#5c4033",
    "challengeRating": 0.33,
    "soloLevel": 1,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"T\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Dire%20Rat",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "QUADRUPED_SMALL_LOW",
    "bodyProportions": {
      "approxHeightFt": 1.8,
      "approxLengthFt": 4,
      "approxWeightLbs": 25,
      "statureMultiplier": 0.9
    },
    "imagePath": "/images/monsters/dire_rat.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/dire_rat.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 856,
      "height": 722,
      "minX": 12,
      "minY": 12,
      "maxX": 843,
      "maxY": 709,
      "contentWidthRatio": 0.972,
      "contentHeightRatio": 0.9668,
      "topPadRatio": 0.0166,
      "bottomPadRatio": 0.0166,
      "leftPadRatio": 0.014,
      "rightPadRatio": 0.014
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 172,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.805,
      "topPadRatio": 0.168,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 856,
      "height": 722,
      "minX": 12,
      "minY": 12,
      "maxX": 843,
      "maxY": 709,
      "contentWidthRatio": 0.972,
      "contentHeightRatio": 0.9668,
      "topPadRatio": 0.0166,
      "bottomPadRatio": 0.0166,
      "leftPadRatio": 0.014,
      "rightPadRatio": 0.014
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Small Animal; 16.8% top dark margin in card painting.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Low Quadruped (Dire Rat)",
    "proposedScaleFactor": 0.479,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 856,
      "height": 722,
      "colorType": 6,
      "transparentPixelRatio": 0.5801,
      "opaqueCoreRatio": 0.4124,
      "semiTransparentRatio": 0.0109,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4695,
        "y": 0.4093
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2693,
    "catalogOrder": 41,
    "catalogBatch": "CORE_68",
    "name": "Viper",
    "slug": "viper",
    "symbol": "v",
    "color": "#2e8b57",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"J\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Viper",
    "pfSizeCategory": "TINY",
    "visualBodyProfile": "SERPENTINE_TINY",
    "bodyProportions": {
      "approxHeightFt": 0.8,
      "approxLengthFt": 2,
      "approxWeightLbs": 3,
      "statureMultiplier": 0.92
    },
    "imagePath": "/images/monsters/viper.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/viper.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 850,
      "height": 851,
      "minX": 12,
      "minY": 12,
      "maxX": 837,
      "maxY": 838,
      "contentWidthRatio": 0.9718,
      "contentHeightRatio": 0.9718,
      "topPadRatio": 0.0141,
      "bottomPadRatio": 0.0141,
      "leftPadRatio": 0.0141,
      "rightPadRatio": 0.0141
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 850,
      "height": 851,
      "minX": 12,
      "minY": 12,
      "maxX": 837,
      "maxY": 838,
      "contentWidthRatio": 0.9718,
      "contentHeightRatio": 0.9718,
      "topPadRatio": 0.0141,
      "bottomPadRatio": 0.0141,
      "leftPadRatio": 0.0141,
      "rightPadRatio": 0.0141
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "CLOSEUP_PORTRAIT_CROP",
    "auditNotes": "Bestiary 1 Tiny Animal (2 ft viper); painted as close-up on forest floor.",
    "pfSizeOrder": 3,
    "pfSizeLabel": "Tiny",
    "pfSpaceFt": 2.5,
    "visualBodyProfileLabel": "Tiny Coiled Serpent",
    "proposedScaleFactor": 0.352,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 850,
      "height": 851,
      "colorType": 6,
      "transparentPixelRatio": 0.455,
      "opaqueCoreRatio": 0.5395,
      "semiTransparentRatio": 0.0077,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5173,
        "y": 0.5663
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2694,
    "catalogOrder": 42,
    "catalogBatch": "CORE_68",
    "name": "Giant Centipede",
    "slug": "giant_centipede",
    "symbol": "c",
    "color": "#d2691e",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Vermin",
    "creatureSubtype": null,
    "movementType": "CLIMB",
    "habitat": "[\"U\", \"F\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Centipede",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "SERPENTINE_COILED",
    "bodyProportions": {
      "approxHeightFt": 2.4,
      "approxLengthFt": 6,
      "approxWeightLbs": 60,
      "statureMultiplier": 0.9
    },
    "imagePath": "/images/monsters/giant_centipede.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 44,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.93,
      "topPadRatio": 0.043,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 44,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.93,
      "topPadRatio": 0.043,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 CR 1/2 Giant Centipede is Medium Vermin.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Coiled Worm / Centipede (Grick, Giant Centipede)",
    "proposedScaleFactor": 0.738,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2695,
    "catalogOrder": 43,
    "catalogBatch": "CORE_68",
    "name": "Iron Cobra",
    "slug": "iron_cobra",
    "symbol": "C",
    "color": "#708090",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Construct",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Iron%20Cobra",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "SERPENTINE_SMALL_COILED",
    "bodyProportions": {
      "approxHeightFt": 2.2,
      "approxLengthFt": 4,
      "approxWeightLbs": 50,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/iron_cobra.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 32,
      "minY": 112,
      "maxX": 988,
      "maxY": 996,
      "contentWidthRatio": 0.934,
      "contentHeightRatio": 0.863,
      "topPadRatio": 0.109,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.031,
      "rightPadRatio": 0.035
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 32,
      "minY": 112,
      "maxX": 988,
      "maxY": 996,
      "contentWidthRatio": 0.934,
      "contentHeightRatio": 0.863,
      "topPadRatio": 0.109,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.031,
      "rightPadRatio": 0.035
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Small Construct.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Reared Construct/Serpent",
    "proposedScaleFactor": 0.579,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2696,
    "catalogOrder": 44,
    "catalogBatch": "CORE_68",
    "name": "Skeletal Champion",
    "slug": "skeletal_champion",
    "symbol": "S",
    "color": "#e6e6fa",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"M\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Skeletal%20Champion",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.1,
      "approxLengthFt": 2.5,
      "approxWeightLbs": 95,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/skeletal_champion.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/skeletal_champion.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 579,
      "height": 860,
      "minX": 3,
      "minY": 3,
      "maxX": 575,
      "maxY": 856,
      "contentWidthRatio": 0.9896,
      "contentHeightRatio": 0.993,
      "topPadRatio": 0.0035,
      "bottomPadRatio": 0.0035,
      "leftPadRatio": 0.0052,
      "rightPadRatio": 0.0052
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 579,
      "height": 860,
      "minX": 3,
      "minY": 3,
      "maxX": 575,
      "maxY": 856,
      "contentWidthRatio": 0.9896,
      "contentHeightRatio": 0.993,
      "topPadRatio": 0.0035,
      "bottomPadRatio": 0.0035,
      "leftPadRatio": 0.0052,
      "rightPadRatio": 0.0052
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead armored warrior.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 1,
    "cutoutStatus": "EXISTING_APPROVED",
    "cutoutValidationMetrics": {
      "width": 579,
      "height": 860,
      "colorType": 6,
      "transparentPixelRatio": 0.5212,
      "opaqueCoreRatio": 0.4687,
      "semiTransparentRatio": 0.0374,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5223,
        "y": 0.4792
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2697,
    "catalogOrder": 45,
    "catalogBatch": "CORE_68",
    "name": "Blink Dog",
    "slug": "blink_dog",
    "symbol": "d",
    "color": "#d4af37",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"P\", \"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Blink%20Dog",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3.2,
      "approxLengthFt": 5,
      "approxWeightLbs": 100,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/blink_dog.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 56,
      "minY": 128,
      "maxX": 996,
      "maxY": 984,
      "contentWidthRatio": 0.918,
      "contentHeightRatio": 0.836,
      "topPadRatio": 0.125,
      "bottomPadRatio": 0.039,
      "leftPadRatio": 0.055,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 56,
      "minY": 128,
      "maxX": 996,
      "maxY": 984,
      "contentWidthRatio": 0.918,
      "contentHeightRatio": 0.836,
      "topPadRatio": 0.125,
      "bottomPadRatio": 0.039,
      "leftPadRatio": 0.055,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 2 Medium Magical Beast.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.714,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2698,
    "catalogOrder": 46,
    "catalogBatch": "CORE_68",
    "name": "Duergar",
    "slug": "duergar",
    "symbol": "d",
    "color": "#4a5568",
    "challengeRating": 0.33,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "duergar",
    "movementType": "WALK",
    "habitat": "[\"U\", \"M\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Duergar",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_STOCKY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 4.4,
      "approxLengthFt": 2.6,
      "approxWeightLbs": 160,
      "statureMultiplier": 0.88
    },
    "imagePath": "/images/monsters/duergar.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 92,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.883,
      "topPadRatio": 0.09,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 92,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.883,
      "topPadRatio": 0.09,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (dwarf), 4.4 ft tall & broad.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Stocky Dwarf Biped (Duergar)",
    "proposedScaleFactor": 0.73,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2699,
    "catalogOrder": 47,
    "catalogBatch": "CORE_68",
    "name": "Drow",
    "slug": "drow",
    "symbol": "e",
    "color": "#6b46c1",
    "challengeRating": 0.33,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "drow",
    "movementType": "WALK",
    "habitat": "[\"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Drow",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.4,
      "approxLengthFt": 2.1,
      "approxWeightLbs": 115,
      "statureMultiplier": 0.95
    },
    "imagePath": "/images/monsters/drow.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 68,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.906,
      "topPadRatio": 0.066,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 68,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.906,
      "topPadRatio": 0.066,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (elf).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 0.95,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2700,
    "catalogOrder": 48,
    "catalogBatch": "CORE_68",
    "name": "Orc",
    "slug": "orc",
    "symbol": "o",
    "color": "#276749",
    "challengeRating": 0.33,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "orc",
    "movementType": "WALK",
    "habitat": "[\"H\", \"M\", \"P\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Orc",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.2,
      "approxLengthFt": 2.8,
      "approxWeightLbs": 210,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/orc.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/orc.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 684,
      "height": 904,
      "minX": 12,
      "minY": 12,
      "maxX": 671,
      "maxY": 891,
      "contentWidthRatio": 0.9649,
      "contentHeightRatio": 0.9735,
      "topPadRatio": 0.0133,
      "bottomPadRatio": 0.0133,
      "leftPadRatio": 0.0175,
      "rightPadRatio": 0.0175
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 84,
      "maxX": 996,
      "maxY": 988,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.883,
      "topPadRatio": 0.082,
      "bottomPadRatio": 0.035,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 684,
      "height": 904,
      "minX": 12,
      "minY": 12,
      "maxX": 671,
      "maxY": 891,
      "contentWidthRatio": 0.9649,
      "contentHeightRatio": 0.9735,
      "topPadRatio": 0.0133,
      "bottomPadRatio": 0.0133,
      "leftPadRatio": 0.0175,
      "rightPadRatio": 0.0175
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Humanoid (orc).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.091,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 684,
      "height": 904,
      "colorType": 6,
      "transparentPixelRatio": 0.4233,
      "opaqueCoreRatio": 0.5704,
      "semiTransparentRatio": 0.0087,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4784,
        "y": 0.4852
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2701,
    "catalogOrder": 49,
    "catalogBatch": "CORE_68",
    "name": "Wight",
    "slug": "wight",
    "symbol": "W",
    "color": "#4a5568",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Wight",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.8,
      "approxLengthFt": 2.4,
      "approxWeightLbs": 140,
      "statureMultiplier": 0.99
    },
    "imagePath": "/images/monsters/wight.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 44,
      "minY": 76,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.93,
      "contentHeightRatio": 0.898,
      "topPadRatio": 0.074,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.043,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 44,
      "minY": 76,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.93,
      "contentHeightRatio": 0.898,
      "topPadRatio": 0.074,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.043,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 0.99,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2702,
    "catalogOrder": 50,
    "catalogBatch": "CORE_68",
    "name": "Harpy",
    "slug": "harpy",
    "symbol": "H",
    "color": "#c53030",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Monstrous Humanoid",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"M\", \"C\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Harpy",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "WINGED_HOVER_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.2,
      "approxLengthFt": 8.5,
      "approxWeightLbs": 110,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/harpy.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/harpy.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 842,
      "height": 930,
      "minX": 12,
      "minY": 12,
      "maxX": 829,
      "maxY": 917,
      "contentWidthRatio": 0.9715,
      "contentHeightRatio": 0.9742,
      "topPadRatio": 0.0129,
      "bottomPadRatio": 0.0129,
      "leftPadRatio": 0.0143,
      "rightPadRatio": 0.0143
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 972,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.926,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.051,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 842,
      "height": 930,
      "minX": 12,
      "minY": 12,
      "maxX": 829,
      "maxY": 917,
      "contentWidthRatio": 0.9715,
      "contentHeightRatio": 0.9742,
      "topPadRatio": 0.0129,
      "bottomPadRatio": 0.0129,
      "leftPadRatio": 0.0143,
      "rightPadRatio": 0.0143
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Monstrous Humanoid.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Winged Flyer (Harpy, Gargoyle, Peryton)",
    "proposedScaleFactor": 0.941,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 842,
      "height": 930,
      "colorType": 6,
      "transparentPixelRatio": 0.5744,
      "opaqueCoreRatio": 0.4162,
      "semiTransparentRatio": 0.0136,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5308,
        "y": 0.4084
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2703,
    "catalogOrder": 51,
    "catalogBatch": "CORE_68",
    "name": "Doppelganger",
    "slug": "doppelganger",
    "symbol": "D",
    "color": "#a0aec0",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Monstrous Humanoid",
    "creatureSubtype": "shapechanger",
    "movementType": "WALK",
    "habitat": "[\"U\", \"T\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Doppelganger",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6,
      "approxLengthFt": 2.2,
      "approxWeightLbs": 150,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/doppelganger.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 44,
      "minY": 24,
      "maxX": 980,
      "maxY": 996,
      "contentWidthRatio": 0.914,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.043,
      "rightPadRatio": 0.043
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 44,
      "minY": 24,
      "maxX": 980,
      "maxY": 996,
      "contentWidthRatio": 0.914,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.043,
      "rightPadRatio": 0.043
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Monstrous Humanoid.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 1,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2704,
    "catalogOrder": 52,
    "catalogBatch": "CORE_68",
    "name": "Griffon",
    "slug": "griffon",
    "symbol": "G",
    "color": "#b7791f",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"H\", \"M\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Griffon",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "WINGED_LARGE_PREDATOR",
    "bodyProportions": {
      "approxHeightFt": 6.5,
      "approxLengthFt": 9,
      "approxWeightLbs": 550,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/griffon.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/griffon.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 825,
      "height": 824,
      "minX": 12,
      "minY": 12,
      "maxX": 812,
      "maxY": 811,
      "contentWidthRatio": 0.9709,
      "contentHeightRatio": 0.9709,
      "topPadRatio": 0.0146,
      "bottomPadRatio": 0.0146,
      "leftPadRatio": 0.0145,
      "rightPadRatio": 0.0145
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 40,
      "minY": 68,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.934,
      "contentHeightRatio": 0.906,
      "topPadRatio": 0.066,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.039,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 825,
      "height": 824,
      "minX": 12,
      "minY": 12,
      "maxX": 812,
      "maxY": 811,
      "contentWidthRatio": 0.9709,
      "contentHeightRatio": 0.9709,
      "topPadRatio": 0.0146,
      "bottomPadRatio": 0.0146,
      "leftPadRatio": 0.0145,
      "rightPadRatio": 0.0145
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Magical Beast, 16-ft wingspan.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Winged Predator / Dragon (Manticore, Wyvern, Griffon)",
    "proposedScaleFactor": 1.267,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 825,
      "height": 824,
      "colorType": 6,
      "transparentPixelRatio": 0.5027,
      "opaqueCoreRatio": 0.4886,
      "semiTransparentRatio": 0.012,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4551,
        "y": 0.4579
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2705,
    "catalogOrder": 53,
    "catalogBatch": "CORE_68",
    "name": "Giant Scorpion",
    "slug": "giant_scorpion",
    "symbol": "s",
    "color": "#744210",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Vermin",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"D\", \"P\", \"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Scorpion",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "ARACHNID_CHITIN_LARGE",
    "bodyProportions": {
      "approxHeightFt": 5.8,
      "approxLengthFt": 10,
      "approxWeightLbs": 600,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/giant_scorpion.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/giant_scorpion.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 881,
      "height": 837,
      "minX": 12,
      "minY": 12,
      "maxX": 868,
      "maxY": 824,
      "contentWidthRatio": 0.9728,
      "contentHeightRatio": 0.9713,
      "topPadRatio": 0.0143,
      "bottomPadRatio": 0.0143,
      "leftPadRatio": 0.0136,
      "rightPadRatio": 0.0136
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 88,
      "maxX": 996,
      "maxY": 912,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.805,
      "topPadRatio": 0.086,
      "bottomPadRatio": 0.109,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 881,
      "height": 837,
      "minX": 12,
      "minY": 12,
      "maxX": 868,
      "maxY": 824,
      "contentWidthRatio": 0.9728,
      "contentHeightRatio": 0.9713,
      "topPadRatio": 0.0143,
      "bottomPadRatio": 0.0143,
      "leftPadRatio": 0.0136,
      "rightPadRatio": 0.0136
    },
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Large Vermin; 10.9% bottom dark margin in card painting.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Chitinous Arachnid / Insectoid (Giant Scorpion, Phase Spider, Ankheg)",
    "proposedScaleFactor": 1.035,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 881,
      "height": 837,
      "colorType": 6,
      "transparentPixelRatio": 0.7072,
      "opaqueCoreRatio": 0.2835,
      "semiTransparentRatio": 0.0133,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5289,
        "y": 0.5041
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2706,
    "catalogOrder": 54,
    "catalogBatch": "CORE_68",
    "name": "Cloaker",
    "slug": "cloaker",
    "symbol": "C",
    "color": "#1a202c",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Aberration",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Cloaker",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "WINGED_LARGE_PREDATOR",
    "bodyProportions": {
      "approxHeightFt": 6.5,
      "approxLengthFt": 8.5,
      "approxWeightLbs": 100,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/cloaker.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 64,
      "minY": 72,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.91,
      "contentHeightRatio": 0.902,
      "topPadRatio": 0.07,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.063,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 64,
      "minY": 72,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.91,
      "contentHeightRatio": 0.902,
      "topPadRatio": 0.07,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.063,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Aberration (8.5-ft wingspan).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Winged Predator / Dragon (Manticore, Wyvern, Griffon)",
    "proposedScaleFactor": 1.217,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2707,
    "catalogOrder": 55,
    "catalogBatch": "CORE_68",
    "name": "Phase Spider",
    "slug": "phase_spider",
    "symbol": "S",
    "color": "#4c51bf",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "CLIMB",
    "habitat": "[\"U\", \"X\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Phase%20Spider",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "ARACHNID_CHITIN_LARGE",
    "bodyProportions": {
      "approxHeightFt": 4.8,
      "approxLengthFt": 9.5,
      "approxWeightLbs": 700,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/phase_spider.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 80,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.895,
      "topPadRatio": 0.078,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 80,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.895,
      "topPadRatio": 0.078,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Magical Beast (8-ft legspan spider).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Chitinous Arachnid / Insectoid (Giant Scorpion, Phase Spider, Ankheg)",
    "proposedScaleFactor": 1.014,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2708,
    "catalogOrder": 56,
    "catalogBatch": "CORE_68",
    "name": "Wraith",
    "slug": "wraith",
    "symbol": "W",
    "color": "#2d3748",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Undead",
    "creatureSubtype": "incorporeal",
    "movementType": "FLY",
    "habitat": "[\"U\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Wraith",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "INCORPOREAL_FLOAT",
    "bodyProportions": {
      "approxHeightFt": 6.2,
      "approxLengthFt": 2.6,
      "approxWeightLbs": 0,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/wraith.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/wraith.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 723,
      "height": 972,
      "minX": 12,
      "minY": 12,
      "maxX": 710,
      "maxY": 969,
      "contentWidthRatio": 0.9668,
      "contentHeightRatio": 0.9856,
      "topPadRatio": 0.0123,
      "bottomPadRatio": 0.0021,
      "leftPadRatio": 0.0166,
      "rightPadRatio": 0.0166
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 64,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.91,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.063,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 723,
      "height": 972,
      "minX": 12,
      "minY": 12,
      "maxX": 710,
      "maxY": 969,
      "contentWidthRatio": 0.9668,
      "contentHeightRatio": 0.9856,
      "topPadRatio": 0.0123,
      "bottomPadRatio": 0.0021,
      "leftPadRatio": 0.0166,
      "rightPadRatio": 0.0166
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead (incorporeal).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Incorporeal Floating Specter (Shadow, Wraith)",
    "proposedScaleFactor": 1.04,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 723,
      "height": 972,
      "colorType": 6,
      "transparentPixelRatio": 0.5828,
      "opaqueCoreRatio": 0.4028,
      "semiTransparentRatio": 0.0206,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4695,
        "y": 0.4861
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 2709,
    "catalogOrder": 57,
    "catalogBatch": "CORE_68",
    "name": "Gibbering Mouther",
    "slug": "gibbering_mouther",
    "symbol": "M",
    "color": "#9b2c2c",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Aberration",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Gibbering%20Mouther",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "AMORPHOUS_MEDIUM_OOZE",
    "bodyProportions": {
      "approxHeightFt": 3.2,
      "approxLengthFt": 5.5,
      "approxWeightLbs": 200,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/gibbering_mouther.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 132,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.844,
      "topPadRatio": 0.129,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 132,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.844,
      "topPadRatio": 0.129,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 1 Medium Aberration (amorphous flesh mound).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Amorphous Horror (Gibbering Mouther)",
    "proposedScaleFactor": 0.696,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2710,
    "catalogOrder": 58,
    "catalogBatch": "CORE_68",
    "name": "Peryton",
    "slug": "peryton",
    "symbol": "P",
    "color": "#702459",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"M\", \"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Peryton",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "WINGED_HOVER_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.5,
      "approxLengthFt": 9,
      "approxWeightLbs": 160,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/peryton.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 952,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.906,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.07,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 952,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.906,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.07,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Medium Magical Beast.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Winged Flyer (Harpy, Gargoyle, Peryton)",
    "proposedScaleFactor": 0.96,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2711,
    "catalogOrder": 59,
    "catalogBatch": "CORE_68",
    "name": "Giant Stag Beetle",
    "slug": "giant_stag_beetle",
    "symbol": "B",
    "color": "#234e52",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Vermin",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"J\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Stag%20Beetle",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "ARACHNID_CHITIN_LARGE",
    "bodyProportions": {
      "approxHeightFt": 5,
      "approxLengthFt": 10.5,
      "approxWeightLbs": 800,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/giant_stag_beetle.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Vermin (10 ft long beetle).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Chitinous Arachnid / Insectoid (Giant Scorpion, Phase Spider, Ankheg)",
    "proposedScaleFactor": 1.035,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2712,
    "catalogOrder": 60,
    "catalogBatch": "CORE_68",
    "name": "Vegepygmy",
    "slug": "vegepygmy",
    "symbol": "v",
    "color": "#2f855a",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Plant",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"S\", \"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Vegepygmy",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "BIPED_SMALL",
    "bodyProportions": {
      "approxHeightFt": 3,
      "approxLengthFt": 1.8,
      "approxWeightLbs": 30,
      "statureMultiplier": 0.95
    },
    "imagePath": "/images/monsters/vegepygmy.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 40,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.934,
      "topPadRatio": 0.039,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 40,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.934,
      "topPadRatio": 0.039,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Small Plant.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Upright Biped (Goblin/Kobold/Fey)",
    "proposedScaleFactor": 0.652,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2713,
    "catalogOrder": 61,
    "catalogBatch": "CORE_68",
    "name": "Ghast",
    "slug": "ghast",
    "symbol": "G",
    "color": "#319795",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Ghast",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_CROUCHED",
    "bodyProportions": {
      "approxHeightFt": 5.4,
      "approxLengthFt": 3.5,
      "approxWeightLbs": 150,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/ghast.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 52,
      "minY": 72,
      "maxX": 980,
      "maxY": 976,
      "contentWidthRatio": 0.906,
      "contentHeightRatio": 0.883,
      "topPadRatio": 0.07,
      "bottomPadRatio": 0.047,
      "leftPadRatio": 0.051,
      "rightPadRatio": 0.043
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 52,
      "minY": 72,
      "maxX": 980,
      "maxY": 976,
      "contentWidthRatio": 0.906,
      "contentHeightRatio": 0.883,
      "topPadRatio": 0.07,
      "bottomPadRatio": 0.047,
      "leftPadRatio": 0.051,
      "rightPadRatio": 0.043
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Undead.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Crouched / Hunched Predator (Ghoul, Ghast)",
    "proposedScaleFactor": 0.845,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2714,
    "catalogOrder": 62,
    "catalogBatch": "CORE_68",
    "name": "Giant Bat",
    "slug": "giant_bat",
    "symbol": "b",
    "color": "#4a5568",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"U\", \"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Bat,%20Dire",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "WINGED_LARGE_PREDATOR",
    "bodyProportions": {
      "approxHeightFt": 5,
      "approxLengthFt": 15,
      "approxWeightLbs": 200,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/giant_bat.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 36,
      "minY": 36,
      "maxX": 992,
      "maxY": 992,
      "contentWidthRatio": 0.934,
      "contentHeightRatio": 0.934,
      "topPadRatio": 0.035,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.035,
      "rightPadRatio": 0.031
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 36,
      "minY": 36,
      "maxX": 992,
      "maxY": 992,
      "contentWidthRatio": 0.934,
      "contentHeightRatio": 0.934,
      "topPadRatio": 0.035,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.035,
      "rightPadRatio": 0.031
    },
    "cutoutContentBounds": null,
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Dire Bat is Large Animal (15-ft wingspan).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Winged Predator / Dragon (Manticore, Wyvern, Griffon)",
    "proposedScaleFactor": 1.217,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2715,
    "catalogOrder": 63,
    "catalogBatch": "CORE_68",
    "name": "Morlock",
    "slug": "morlock",
    "symbol": "m",
    "color": "#e2e8f0",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Monstrous Humanoid",
    "creatureSubtype": null,
    "movementType": "CLIMB",
    "habitat": "[\"U\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Morlock",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_CROUCHED",
    "bodyProportions": {
      "approxHeightFt": 5.2,
      "approxLengthFt": 3,
      "approxWeightLbs": 130,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/morlock.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Monstrous Humanoid.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Crouched / Hunched Predator (Ghoul, Ghast)",
    "proposedScaleFactor": 0.827,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2716,
    "catalogOrder": 64,
    "catalogBatch": "CORE_68",
    "name": "Violet Fungus",
    "slug": "violet_fungus",
    "symbol": "F",
    "color": "#805ad5",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Plant",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"U\", \"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Violet%20Fungus",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "PLANT_MASS_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.5,
      "approxLengthFt": 4.5,
      "approxWeightLbs": 160,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/violet_fungus.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 76,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.898,
      "topPadRatio": 0.074,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 76,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.898,
      "topPadRatio": 0.074,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Plant.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Fungal / Vine Mass (Violet Fungus, Yellow Musk Creeper)",
    "proposedScaleFactor": 0.921,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2717,
    "catalogOrder": 65,
    "catalogBatch": "CORE_68",
    "name": "Grick",
    "slug": "grick",
    "symbol": "g",
    "color": "#2c7a7b",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Aberration",
    "creatureSubtype": null,
    "movementType": "CLIMB",
    "habitat": "[\"U\", \"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Grick",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "SERPENTINE_COILED",
    "bodyProportions": {
      "approxHeightFt": 3.8,
      "approxLengthFt": 8,
      "approxWeightLbs": 200,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/grick.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 136,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.84,
      "topPadRatio": 0.133,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 136,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.84,
      "topPadRatio": 0.133,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 2 Medium Aberration (8-ft worm coiled to ~4 ft).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Coiled Worm / Centipede (Grick, Giant Centipede)",
    "proposedScaleFactor": 0.771,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2718,
    "catalogOrder": 66,
    "catalogBatch": "CORE_68",
    "name": "Krenshar",
    "slug": "krenshar",
    "symbol": "k",
    "color": "#dd6b20",
    "challengeRating": 1,
    "soloLevel": 1,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\", \"P\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Krenshar",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3.4,
      "approxLengthFt": 5.5,
      "approxWeightLbs": 140,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/krenshar.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Medium Magical Beast.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.714,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2719,
    "catalogOrder": 67,
    "catalogBatch": "CORE_68",
    "name": "Bunyip",
    "slug": "bunyip",
    "symbol": "B",
    "color": "#2b6cb0",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Magical Beast",
    "creatureSubtype": "aquatic",
    "movementType": "SWIM",
    "habitat": "[\"R\", \"S\", \"C\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Bunyip",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3.2,
      "approxLengthFt": 7,
      "approxWeightLbs": 350,
      "statureMultiplier": 0.95
    },
    "imagePath": "/images/monsters/bunyip.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 60,
      "maxX": 996,
      "maxY": 980,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.898,
      "topPadRatio": 0.059,
      "bottomPadRatio": 0.043,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 60,
      "maxX": 996,
      "maxY": 980,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.898,
      "topPadRatio": 0.059,
      "bottomPadRatio": 0.043,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Medium Magical Beast (aquatic).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.722,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 2720,
    "catalogOrder": 68,
    "catalogBatch": "CORE_68",
    "name": "Sahuagin",
    "slug": "sahuagin",
    "symbol": "S",
    "color": "#007791",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Monstrous Humanoid",
    "creatureSubtype": "aquatic",
    "movementType": "SWIM",
    "habitat": "[\"C\", \"O\", \"R\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Sahuagin",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.2,
      "approxLengthFt": 2.8,
      "approxWeightLbs": 200,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/sahuagin.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 48,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.926,
      "topPadRatio": 0.047,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 48,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.926,
      "topPadRatio": 0.047,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Monstrous Humanoid (aquatic).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.091,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9143,
    "catalogOrder": 69,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Mite",
    "slug": "mite",
    "symbol": "m",
    "color": "#4682b4",
    "challengeRating": 0.25,
    "soloLevel": 1,
    "creatureType": "Fey",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Mite",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "BIPED_SMALL",
    "bodyProportions": {
      "approxHeightFt": 2.8,
      "approxLengthFt": 1.8,
      "approxWeightLbs": 25,
      "statureMultiplier": 0.92
    },
    "imagePath": "/images/monsters/mite.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 60,
      "minY": 72,
      "maxX": 968,
      "maxY": 996,
      "contentWidthRatio": 0.887,
      "contentHeightRatio": 0.902,
      "topPadRatio": 0.07,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.059,
      "rightPadRatio": 0.055
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 60,
      "minY": 72,
      "maxX": 968,
      "maxY": 996,
      "contentWidthRatio": 0.887,
      "contentHeightRatio": 0.902,
      "topPadRatio": 0.07,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.059,
      "rightPadRatio": 0.055
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Small Fey (under 3 ft tall).",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Upright Biped (Goblin/Kobold/Fey)",
    "proposedScaleFactor": 0.631,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9144,
    "catalogOrder": 70,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Bog Strider",
    "slug": "bog_strider",
    "symbol": "b",
    "color": "#556b2f",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Vermin",
    "creatureSubtype": "aquatic",
    "movementType": "WALK",
    "habitat": "[\"S\",\"J\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Water%20Strider,%20Giant",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "ARACHNID_SMALL_SKIMMER",
    "bodyProportions": {
      "approxHeightFt": 1.6,
      "approxLengthFt": 3.5,
      "approxWeightLbs": 18,
      "statureMultiplier": 0.92
    },
    "imagePath": "/images/monsters/bog_strider.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 92,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.883,
      "topPadRatio": 0.09,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 92,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.883,
      "topPadRatio": 0.09,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "UNCERTAIN_DUAL_SOURCE",
    "manualOverrideFlag": "DUAL_SOURCE_WATER_STRIDER",
    "auditNotes": "Uncertain/Dual Source: DB row is CR 0.5 Vermin (aquatic) linking to Giant Water Strider (Large CR 1 in Bestiary 3), while PF1e Bog Strider (Bestiary 6) is Medium Monstrous Humanoid. Scaled as Small juvenile giant water strider for CR 0.5.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Wide Multi-Legged Skimmer",
    "proposedScaleFactor": 0.464,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9145,
    "catalogOrder": 71,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Blood Hawk",
    "slug": "blood_hawk",
    "symbol": "h",
    "color": "#b22222",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"P\",\"H\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Hawk",
    "pfSizeCategory": "TINY",
    "visualBodyProfile": "WINGED_TINY_RAPTOR",
    "bodyProportions": {
      "approxHeightFt": 1.5,
      "approxLengthFt": 3.5,
      "approxWeightLbs": 3,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/blood_hawk.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/blood_hawk.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 877,
      "height": 834,
      "minX": 12,
      "minY": 12,
      "maxX": 864,
      "maxY": 821,
      "contentWidthRatio": 0.9726,
      "contentHeightRatio": 0.9712,
      "topPadRatio": 0.0144,
      "bottomPadRatio": 0.0144,
      "leftPadRatio": 0.0137,
      "rightPadRatio": 0.0137
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 976,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.93,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.047,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 877,
      "height": 834,
      "minX": 12,
      "minY": 12,
      "maxX": 864,
      "maxY": 821,
      "contentWidthRatio": 0.9726,
      "contentHeightRatio": 0.9712,
      "topPadRatio": 0.0144,
      "bottomPadRatio": 0.0144,
      "leftPadRatio": 0.0137,
      "rightPadRatio": 0.0137
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_PF1E_VARIANT",
    "manualOverrideFlag": "CLOSEUP_PORTRAIT_CROP",
    "auditNotes": "PF1e Hawk variant (Tiny Animal, 3.5-ft wingspan); painted close-up.",
    "pfSizeOrder": 3,
    "pfSizeLabel": "Tiny",
    "pfSpaceFt": 2.5,
    "visualBodyProfileLabel": "Tiny Bird of Prey / Raptor",
    "proposedScaleFactor": 0.48,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 877,
      "height": 834,
      "colorType": 6,
      "transparentPixelRatio": 0.593,
      "opaqueCoreRatio": 0.3981,
      "semiTransparentRatio": 0.0124,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.5294,
        "y": 0.4476
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 9146,
    "catalogOrder": 72,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Jungle Viper",
    "slug": "jungle_viper",
    "symbol": "v",
    "color": "#2e8b57",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"J\",\"F\",\"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Viper",
    "pfSizeCategory": "TINY",
    "visualBodyProfile": "SERPENTINE_TINY",
    "bodyProportions": {
      "approxHeightFt": 0.9,
      "approxLengthFt": 2.2,
      "approxWeightLbs": 4,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/jungle_viper.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 988,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.035,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 988,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.035,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_PF1E_VARIANT",
    "manualOverrideFlag": "CLOSEUP_PORTRAIT_CROP",
    "auditNotes": "PF1e Viper variant (Tiny Animal).",
    "pfSizeOrder": 3,
    "pfSizeLabel": "Tiny",
    "pfSpaceFt": 2.5,
    "visualBodyProfileLabel": "Tiny Coiled Serpent",
    "proposedScaleFactor": 0.359,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9147,
    "catalogOrder": 73,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Plague Zombie",
    "slug": "plague_zombie",
    "symbol": "z",
    "color": "#6b8e23",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"H\",\"P\",\"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Plague%20Zombie",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_CROUCHED",
    "bodyProportions": {
      "approxHeightFt": 5.7,
      "approxLengthFt": 2.5,
      "approxWeightLbs": 155,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/plague_zombie.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 64,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.91,
      "topPadRatio": 0.063,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 64,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.91,
      "topPadRatio": 0.063,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Plague Zombie (Medium Undead).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Crouched / Hunched Predator (Ghoul, Ghast)",
    "proposedScaleFactor": 0.845,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9148,
    "catalogOrder": 74,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Grippli Scout",
    "slug": "grippli_scout",
    "symbol": "g",
    "color": "#3cb371",
    "challengeRating": 0.5,
    "soloLevel": 1,
    "creatureType": "Humanoid",
    "creatureSubtype": "grippli",
    "movementType": "WALK",
    "habitat": "[\"J\",\"S\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Grippli",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "BIPED_SMALL",
    "bodyProportions": {
      "approxHeightFt": 2.5,
      "approxLengthFt": 1.8,
      "approxWeightLbs": 25,
      "statureMultiplier": 0.9
    },
    "imagePath": "/images/monsters/grippli_scout.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 28,
      "minY": 24,
      "maxX": 996,
      "maxY": 988,
      "contentWidthRatio": 0.945,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.035,
      "leftPadRatio": 0.027,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 28,
      "minY": 24,
      "maxX": 996,
      "maxY": 988,
      "contentWidthRatio": 0.945,
      "contentHeightRatio": 0.941,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.035,
      "leftPadRatio": 0.027,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_PF1E_VARIANT",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Grippli (Small Humanoid, 2.5 ft tall).",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Upright Biped (Goblin/Kobold/Fey)",
    "proposedScaleFactor": 0.617,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9149,
    "catalogOrder": 75,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Worg",
    "slug": "worg",
    "symbol": "W",
    "color": "#2f4f4f",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"P\",\"F\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Worg",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3.8,
      "approxLengthFt": 6,
      "approxWeightLbs": 280,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/worg.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 984,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.938,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.039,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 984,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.938,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.039,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Worg (Medium Magical Beast, larger than normal wolf).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.775,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9150,
    "catalogOrder": 76,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Hippogriff",
    "slug": "hippogriff",
    "symbol": "H",
    "color": "#cd853f",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"H\",\"P\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Hippogriff",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "WINGED_LARGE_PREDATOR",
    "bodyProportions": {
      "approxHeightFt": 6.5,
      "approxLengthFt": 10,
      "approxWeightLbs": 750,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/hippogriff.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Large Magical Beast.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Winged Predator / Dragon (Manticore, Wyvern, Griffon)",
    "proposedScaleFactor": 1.267,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9151,
    "catalogOrder": 77,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Giant Toad",
    "slug": "giant_toad",
    "symbol": "T",
    "color": "#556b2f",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"S\",\"F\",\"J\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Toad,%20Giant",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "QUADRUPED_MASSIVE",
    "bodyProportions": {
      "approxHeightFt": 5,
      "approxLengthFt": 8.5,
      "approxWeightLbs": 800,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/giant_toad.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Giant Toad (Large Animal).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Massive Beast (Owlbear, Winter Wolf, Dire Boar, Catoblepas)",
    "proposedScaleFactor": 1.067,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9152,
    "catalogOrder": 78,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Carbuncle",
    "slug": "carbuncle",
    "symbol": "c",
    "color": "#dc143c",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"J\",\"H\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Carbuncle",
    "pfSizeCategory": "TINY",
    "visualBodyProfile": "REPTILIAN_TINY_LOW",
    "bodyProportions": {
      "approxHeightFt": 1,
      "approxLengthFt": 1.8,
      "approxWeightLbs": 12,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/carbuncle.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 972,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.926,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.051,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 972,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.926,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.051,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "CLOSEUP_PORTRAIT_CROP",
    "auditNotes": "Bestiary 3 Carbuncle (Tiny Magical Beast, 1.5 ft long).",
    "pfSizeOrder": 3,
    "pfSizeLabel": "Tiny",
    "pfSpaceFt": 2.5,
    "visualBodyProfileLabel": "Tiny Low Reptilian Creature",
    "proposedScaleFactor": 0.386,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9153,
    "catalogOrder": 79,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Phantom Fungus",
    "slug": "phantom_fungus",
    "symbol": "f",
    "color": "#9370db",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Plant",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\",\"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Phantom%20Fungus",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "PLANT_MASS_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 4.8,
      "approxLengthFt": 4,
      "approxWeightLbs": 140,
      "statureMultiplier": 0.94
    },
    "imagePath": "/images/monsters/phantom_fungus.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 3 Medium Plant.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Fungal / Vine Mass (Violet Fungus, Yellow Musk Creeper)",
    "proposedScaleFactor": 0.884,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9154,
    "catalogOrder": 80,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Gnoll Packmaster",
    "slug": "gnoll_packmaster",
    "symbol": "G",
    "color": "#8b4513",
    "challengeRating": 2,
    "soloLevel": 2,
    "creatureType": "Humanoid",
    "creatureSubtype": "gnoll",
    "movementType": "WALK",
    "habitat": "[\"P\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Gnoll",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 7,
      "approxLengthFt": 3,
      "approxWeightLbs": 285,
      "statureMultiplier": 1.08
    },
    "imagePath": "/images/monsters/gnoll_packmaster.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 36,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.938,
      "topPadRatio": 0.035,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 36,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.938,
      "topPadRatio": 0.035,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_PF1E_VARIANT",
    "manualOverrideFlag": null,
    "auditNotes": "Elite Gnoll leader (Medium Humanoid, ~7 ft tall).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.156,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9155,
    "catalogOrder": 81,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Giant Mantis",
    "slug": "giant_mantis",
    "symbol": "M",
    "color": "#228b22",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Vermin",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"J\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Mantis,%20Giant",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "ARACHNID_CHITIN_LARGE",
    "bodyProportions": {
      "approxHeightFt": 9,
      "approxLengthFt": 8,
      "approxWeightLbs": 500,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/giant_mantis.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 28,
      "minY": 24,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.945,
      "contentHeightRatio": 0.945,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.027,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 28,
      "minY": 24,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.945,
      "contentHeightRatio": 0.945,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.027,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Vermin (9 ft tall rearing mantis).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Chitinous Arachnid / Insectoid (Giant Scorpion, Phase Spider, Ankheg)",
    "proposedScaleFactor": 1.077,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9156,
    "catalogOrder": 82,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Spriggan",
    "slug": "spriggan",
    "symbol": "S",
    "color": "#8b5a2b",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Fey",
    "creatureSubtype": "gnome",
    "movementType": "WALK",
    "habitat": "[\"F\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Spriggan",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "BIPED_SMALL_DUAL_SIZE",
    "bodyProportions": {
      "approxHeightFt": 3,
      "approxLengthFt": 2,
      "approxWeightLbs": 35,
      "statureMultiplier": 0.96
    },
    "imagePath": "/images/monsters/spriggan.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_DUAL_FORM",
    "manualOverrideFlag": "SPRIGGAN_SIZE_ALTERATION",
    "auditNotes": "Bestiary 2 Small Fey (3 ft) with Size Alteration (Su) to become Large (12 ft, 600 lbs).",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Fey with Large Size Alteration (Spriggan)",
    "proposedScaleFactor": 0.672,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9157,
    "catalogOrder": 83,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Will-o'-Wisp",
    "slug": "will_o_wisp",
    "symbol": "w",
    "color": "#00ffff",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Aberration",
    "creatureSubtype": "air",
    "movementType": "FLY",
    "habitat": "[\"S\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Will-o%27-Wisp",
    "pfSizeCategory": "SMALL",
    "visualBodyProfile": "FLOATING_ORB",
    "bodyProportions": {
      "approxHeightFt": 1.8,
      "approxLengthFt": 1.8,
      "approxWeightLbs": 3,
      "statureMultiplier": 0.85
    },
    "imagePath": "/images/monsters/will_o_wisp.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/will_o_wisp.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 654,
      "height": 619,
      "minX": 13,
      "minY": 15,
      "maxX": 636,
      "maxY": 605,
      "contentWidthRatio": 0.9541,
      "contentHeightRatio": 0.9548,
      "topPadRatio": 0.0242,
      "bottomPadRatio": 0.021,
      "leftPadRatio": 0.0199,
      "rightPadRatio": 0.026
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 654,
      "height": 619,
      "minX": 13,
      "minY": 15,
      "maxX": 636,
      "maxY": 605,
      "contentWidthRatio": 0.9541,
      "contentHeightRatio": 0.9548,
      "topPadRatio": 0.0242,
      "bottomPadRatio": 0.021,
      "leftPadRatio": 0.0199,
      "rightPadRatio": 0.026
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "LUMINOUS_ORB_AURA",
    "auditNotes": "Bestiary 1 Small Aberration (air), glowing 1.5–2 ft sphere.",
    "pfSizeOrder": 4,
    "pfSizeLabel": "Small",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Small Floating Luminous Sphere (Will-o'-Wisp)",
    "proposedScaleFactor": 0.452,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 654,
      "height": 619,
      "colorType": 6,
      "transparentPixelRatio": 0.4153,
      "opaqueCoreRatio": 0.4148,
      "semiTransparentRatio": 0.218,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4509,
        "y": 0.5561
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 9158,
    "catalogOrder": 84,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Cheetah",
    "slug": "cheetah",
    "symbol": "C",
    "color": "#daa520",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"P\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Cheetah",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "QUADRUPED_LOW",
    "bodyProportions": {
      "approxHeightFt": 3,
      "approxLengthFt": 5.5,
      "approxWeightLbs": 130,
      "statureMultiplier": 0.93
    },
    "imagePath": "/images/monsters/cheetah.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 68,
      "maxX": 996,
      "maxY": 988,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.898,
      "topPadRatio": 0.066,
      "bottomPadRatio": 0.035,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 68,
      "maxX": 996,
      "maxY": 988,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.898,
      "topPadRatio": 0.066,
      "bottomPadRatio": 0.035,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Medium Animal.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Quadruped Beast (Wolf, Hyena, Worg, Cheetah)",
    "proposedScaleFactor": 0.707,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9159,
    "catalogOrder": 85,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Draugr",
    "slug": "draugr",
    "symbol": "D",
    "color": "#4682b4",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Undead",
    "creatureSubtype": "water",
    "movementType": "WALK",
    "habitat": "[\"S\",\"H\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Draugr",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.1,
      "approxLengthFt": 2.6,
      "approxWeightLbs": 190,
      "statureMultiplier": 1.01
    },
    "imagePath": "/images/monsters/draugr.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 48,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.926,
      "topPadRatio": 0.047,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 48,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.926,
      "topPadRatio": 0.047,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Medium Undead.",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.081,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9160,
    "catalogOrder": 86,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Hobgoblin Captain",
    "slug": "hobgoblin_captain",
    "symbol": "H",
    "color": "#8b0000",
    "challengeRating": 3,
    "soloLevel": 3,
    "creatureType": "Humanoid",
    "creatureSubtype": "goblinoid",
    "movementType": "WALK",
    "habitat": "[\"H\",\"P\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Hobgoblin",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6,
      "approxLengthFt": 2.6,
      "approxWeightLbs": 210,
      "statureMultiplier": 1.03
    },
    "imagePath": "/images/monsters/hobgoblin_captain.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.945,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.945,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_PF1E_VARIANT",
    "manualOverrideFlag": null,
    "auditNotes": "Elite Hobgoblin Captain (Medium Humanoid).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.102,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9161,
    "catalogOrder": 87,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Displacer Beast",
    "slug": "displacer_beast",
    "symbol": "d",
    "color": "#483d8b",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"J\",\"F\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Phase%20Spider",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "QUADRUPED_MASSIVE",
    "bodyProportions": {
      "approxHeightFt": 4.8,
      "approxLengthFt": 9,
      "approxWeightLbs": 500,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/displacer_beast.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "CROSS_SYSTEM_SRD",
    "manualOverrideFlag": null,
    "auditNotes": "D&D 3.5e Monster Manual Large Magical Beast (9 ft long six-legged panther with tentacles; DB source_url links to Phase Spider).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Massive Beast (Owlbear, Winter Wolf, Dire Boar, Catoblepas)",
    "proposedScaleFactor": 1.112,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9162,
    "catalogOrder": 88,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Shambling Mound",
    "slug": "shambling_mound",
    "symbol": "S",
    "color": "#2e8b57",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Plant",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"S\",\"J\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Shambling%20Mound",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "PLANT_MASS_LARGE",
    "bodyProportions": {
      "approxHeightFt": 9,
      "approxLengthFt": 7.5,
      "approxWeightLbs": 3800,
      "statureMultiplier": 1.04
    },
    "imagePath": "/images/monsters/shambling_mound.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 52,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.918,
      "topPadRatio": 0.051,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 52,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.918,
      "topPadRatio": 0.051,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Plant (9-ft tall mound of vegetation).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Rooted Botanical / Tentacled Mass (Assassin Vine, Shambling Mound)",
    "proposedScaleFactor": 1.345,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9163,
    "catalogOrder": 89,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Leucrotta",
    "slug": "leucrotta",
    "symbol": "L",
    "color": "#8b4513",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"P\",\"H\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Leucrotta",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "QUADRUPED_MASSIVE",
    "bodyProportions": {
      "approxHeightFt": 5.5,
      "approxLengthFt": 9.5,
      "approxWeightLbs": 900,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/leucrotta.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 144,
      "maxX": 996,
      "maxY": 984,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.82,
      "topPadRatio": 0.141,
      "bottomPadRatio": 0.039,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 144,
      "maxX": 996,
      "maxY": 984,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.82,
      "topPadRatio": 0.141,
      "bottomPadRatio": 0.039,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": "HIGH_VIGNETTE_MARGIN",
    "auditNotes": "Bestiary 2 Large Magical Beast; 14.1% top dark margin in card painting.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Massive Beast (Owlbear, Winter Wolf, Dire Boar, Catoblepas)",
    "proposedScaleFactor": 1.112,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9164,
    "catalogOrder": 90,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Dire Boar",
    "slug": "dire_boar",
    "symbol": "B",
    "color": "#696969",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Animal",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"F\",\"H\",\"P\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Boar,%20Dire",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "QUADRUPED_MASSIVE",
    "bodyProportions": {
      "approxHeightFt": 5.8,
      "approxLengthFt": 10,
      "approxWeightLbs": 1800,
      "statureMultiplier": 1
    },
    "imagePath": "/images/monsters/dire_boar.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Dire Boar (Large Animal, 10 ft long).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Massive Beast (Owlbear, Winter Wolf, Dire Boar, Catoblepas)",
    "proposedScaleFactor": 1.135,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9165,
    "catalogOrder": 91,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Forest Drake",
    "slug": "forest_drake",
    "symbol": "D",
    "color": "#228b22",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Dragon",
    "creatureSubtype": "earth",
    "movementType": "FLY",
    "habitat": "[\"F\",\"J\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Forest%20Drake",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "WINGED_LARGE_PREDATOR",
    "bodyProportions": {
      "approxHeightFt": 7.5,
      "approxLengthFt": 13,
      "approxWeightLbs": 1200,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/forest_drake.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.945,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 992,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.945,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.031,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Large Dragon (earth).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Winged Predator / Dragon (Manticore, Wyvern, Griffon)",
    "proposedScaleFactor": 1.293,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9166,
    "catalogOrder": 92,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Otyugh",
    "slug": "otyugh",
    "symbol": "O",
    "color": "#556b2f",
    "challengeRating": 4,
    "soloLevel": 4,
    "creatureType": "Aberration",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"H\",\"S\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Otyugh",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "PLANT_MASS_LARGE",
    "bodyProportions": {
      "approxHeightFt": 7.5,
      "approxLengthFt": 8.5,
      "approxWeightLbs": 650,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/otyugh.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Aberration (8-ft wide three-legged tentacled bulk).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Rooted Botanical / Tentacled Mass (Assassin Vine, Shambling Mound)",
    "proposedScaleFactor": 1.268,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9167,
    "catalogOrder": 93,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Wyvern",
    "slug": "wyvern",
    "symbol": "W",
    "color": "#483d8b",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Dragon",
    "creatureSubtype": null,
    "movementType": "FLY",
    "habitat": "[\"H\",\"P\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Wyvern",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "WINGED_LARGE_PREDATOR",
    "bodyProportions": {
      "approxHeightFt": 9,
      "approxLengthFt": 16,
      "approxWeightLbs": 2000,
      "statureMultiplier": 1.08
    },
    "imagePath": "/images/monsters/wyvern.png",
    "cutoutImagePath": "/lab-assets/images/monsters-cutout/wyvern.png",
    "hasCutout": true,
    "imageContentBounds": {
      "width": 905,
      "height": 934,
      "minX": 12,
      "minY": 12,
      "maxX": 892,
      "maxY": 921,
      "contentWidthRatio": 0.9735,
      "contentHeightRatio": 0.9743,
      "topPadRatio": 0.0128,
      "bottomPadRatio": 0.0128,
      "leftPadRatio": 0.0133,
      "rightPadRatio": 0.0133
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 52,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.922,
      "topPadRatio": 0.051,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": {
      "width": 905,
      "height": 934,
      "minX": 12,
      "minY": 12,
      "maxX": 892,
      "maxY": 921,
      "contentWidthRatio": 0.9735,
      "contentHeightRatio": 0.9743,
      "topPadRatio": 0.0128,
      "bottomPadRatio": 0.0128,
      "leftPadRatio": 0.0133,
      "rightPadRatio": 0.0133
    },
    "positioningMode": "AIRBORNE_HOVER",
    "isAirborne": true,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Dragon (16 ft long, 20-ft wingspan).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Winged Predator / Dragon (Manticore, Wyvern, Griffon)",
    "proposedScaleFactor": 1.369,
    "cutoutStatus": "NEWLY_PRODUCED_VERIFIED",
    "cutoutValidationMetrics": {
      "width": 905,
      "height": 934,
      "colorType": 6,
      "transparentPixelRatio": 0.5901,
      "opaqueCoreRatio": 0.4007,
      "semiTransparentRatio": 0.013,
      "borderTransparencyRatio": 1,
      "centerOfMass": {
        "x": 0.4731,
        "y": 0.4311
      },
      "checks": {
        "isTrueRgbaPng": true,
        "transparentRatioInRange": true,
        "opaqueCoreSufficient": true,
        "borderClean": true,
        "silhouetteComplete": true,
        "centeredCom": true
      }
    }
  },
  {
    "id": 9168,
    "catalogOrder": 94,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Girallon",
    "slug": "girallon",
    "symbol": "G",
    "color": "#dcdcdc",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"J\",\"F\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Girallon",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "BIPED_TALL_BRUTE",
    "bodyProportions": {
      "approxHeightFt": 9.5,
      "approxLengthFt": 5,
      "approxWeightLbs": 800,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/girallon.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Large Magical Beast (four-armed ape).",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Towering Giant / Brute (Troll, Ogre, Minotaur, Yeti)",
    "proposedScaleFactor": 1.454,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9169,
    "catalogOrder": 95,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Catoblepas",
    "slug": "catoblepas",
    "symbol": "C",
    "color": "#556b2f",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Magical Beast",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"S\",\"P\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Catoblepas",
    "pfSizeCategory": "LARGE",
    "visualBodyProfile": "QUADRUPED_MASSIVE",
    "bodyProportions": {
      "approxHeightFt": 7,
      "approxLengthFt": 14,
      "approxWeightLbs": 2200,
      "statureMultiplier": 1.04
    },
    "imagePath": "/images/monsters/catoblepas.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 60,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.914,
      "topPadRatio": 0.059,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 60,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.914,
      "topPadRatio": 0.059,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 2 Large Magical Beast.",
    "pfSizeOrder": 6,
    "pfSizeLabel": "Large",
    "pfSpaceFt": 10,
    "visualBodyProfileLabel": "Large Massive Beast (Owlbear, Winter Wolf, Dire Boar, Catoblepas)",
    "proposedScaleFactor": 1.181,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9170,
    "catalogOrder": 96,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Barrow Wight",
    "slug": "barrow_wight",
    "symbol": "B",
    "color": "#708090",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Undead",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"P\",\"H\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Wight",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.1,
      "approxLengthFt": 2.6,
      "approxWeightLbs": 180,
      "statureMultiplier": 1.02
    },
    "imagePath": "/images/monsters/barrow_wight.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 68,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.906,
      "topPadRatio": 0.066,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 68,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.906,
      "topPadRatio": 0.066,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_PF1E_VARIANT",
    "manualOverrideFlag": null,
    "auditNotes": "Elite Barrow Wight (Medium Undead).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.091,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9171,
    "catalogOrder": 97,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Green Hag",
    "slug": "green_hag",
    "symbol": "H",
    "color": "#2e8b57",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Monstrous Humanoid",
    "creatureSubtype": null,
    "movementType": "WALK",
    "habitat": "[\"H\",\"S\",\"F\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Green%20Hag",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 5.8,
      "approxLengthFt": 2.3,
      "approxWeightLbs": 150,
      "statureMultiplier": 0.98
    },
    "imagePath": "/images/monsters/green_hag.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 52,
      "minY": 24,
      "maxX": 988,
      "maxY": 996,
      "contentWidthRatio": 0.914,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.051,
      "rightPadRatio": 0.035
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 52,
      "minY": 24,
      "maxX": 988,
      "maxY": 996,
      "contentWidthRatio": 0.914,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.051,
      "rightPadRatio": 0.035
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_AONPRD",
    "manualOverrideFlag": null,
    "auditNotes": "Bestiary 1 Green Hag (Medium Monstrous Humanoid).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Upright Humanoid / Undead",
    "proposedScaleFactor": 0.98,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  },
  {
    "id": 9172,
    "catalogOrder": 98,
    "catalogBatch": "SEED_010_EXPANSION",
    "name": "Orc Warchief",
    "slug": "orc_warchief",
    "symbol": "O",
    "color": "#8b0000",
    "challengeRating": 5,
    "soloLevel": 5,
    "creatureType": "Humanoid",
    "creatureSubtype": "orc",
    "movementType": "WALK",
    "habitat": "[\"F\",\"H\",\"P\"]",
    "sourceUrl": "https://aonprd.com/MonsterDisplay.aspx?ItemName=Orc",
    "pfSizeCategory": "MEDIUM",
    "visualBodyProfile": "BIPED_HEAVY_MEDIUM",
    "bodyProportions": {
      "approxHeightFt": 6.6,
      "approxLengthFt": 3,
      "approxWeightLbs": 270,
      "statureMultiplier": 1.06
    },
    "imagePath": "/images/monsters/orc_warchief.png",
    "cutoutImagePath": null,
    "hasCutout": false,
    "imageContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cardContentBounds": {
      "width": 1024,
      "height": 1024,
      "minX": 24,
      "minY": 24,
      "maxX": 996,
      "maxY": 996,
      "contentWidthRatio": 0.949,
      "contentHeightRatio": 0.949,
      "topPadRatio": 0.023,
      "bottomPadRatio": 0.027,
      "leftPadRatio": 0.023,
      "rightPadRatio": 0.027
    },
    "cutoutContentBounds": null,
    "positioningMode": "GROUNDED",
    "isAirborne": false,
    "verificationStatus": "VERIFIED_PF1E_VARIANT",
    "manualOverrideFlag": null,
    "auditNotes": "Elite Orc Warchief (Medium Humanoid).",
    "pfSizeOrder": 5,
    "pfSizeLabel": "Medium",
    "pfSpaceFt": 5,
    "visualBodyProfileLabel": "Medium Broad / Tall Warrior (Gnoll, Bugbear, Orc)",
    "proposedScaleFactor": 1.134,
    "cutoutStatus": "CARD_FALLBACK_RETAINED",
    "cutoutValidationMetrics": null
  }
];

/**
 * Reference Specimen Profiles for Pathfinder 1e size categories not present as base rows in `monsters`
 * (since the 98 database rows span TINY, SMALL, MEDIUM, and LARGE).
 * These allow the Lab Comparison Arena and scaling engine to test and showcase all 9 Pathfinder 1e
 * size categories (including HUGE, GARGANTUAN, COLOSSAL, DIMINUTIVE, and FINE) on the exact same stage.
 */
const PF1E_SIZE_REFERENCE_SPECIMENS = [
  {
    id: 99001,
    isReferenceSpecimen: true,
    name: 'Spore Mite (Fine PF1e Reference)',
    isDemoProxy: true,
    proxyArtworkSource: 'Giant Spider',
    slug: 'ref_fine_spore_mite',
    symbol: 'f',
    color: '#a3e635',
    challengeRating: 0.125,
    creatureType: 'Vermin',
    movementType: 'WALK',
    sourceUrl: 'https://www.aonprd.com/Rules.aspx?Name=Combat&Category=Gamemastering',
    pfSizeCategory: 'FINE',
    pfSizeOrder: 1,
    pfSizeLabel: 'Fine',
    pfSpaceFt: 0.5,
    visualBodyProfile: 'ARACHNID_SMALL_SKIMMER',
    visualBodyProfileLabel: 'Fine Chitinous Spore Mite (< 6 in.)',
    bodyProportions: { approxHeightFt: 0.35, approxLengthFt: 0.45, approxWeightLbs: 0.1, statureMultiplier: 0.95 },
    imagePath: '/images/monsters/giant_spider.png',
    cutoutImagePath: '/lab-assets/images/monsters-cutout/giant_spider.png',
    hasCutout: true,
    imageContentBounds: {"width":860,"height":570,"minX":3,"minY":4,"maxX":856,"maxY":565,"contentWidthRatio":0.993,"contentHeightRatio":0.986,"topPadRatio":0.007,"bottomPadRatio":0.007,"leftPadRatio":0.0035,"rightPadRatio":0.0035},
    cardContentBounds: {"width":1024,"height":1024,"minX":24,"minY":24,"maxX":996,"maxY":996,"contentWidthRatio":0.949,"contentHeightRatio":0.949,"topPadRatio":0.023,"bottomPadRatio":0.027,"leftPadRatio":0.023,"rightPadRatio":0.027},
    cutoutContentBounds: {"width":860,"height":570,"minX":3,"minY":4,"maxX":856,"maxY":565,"contentWidthRatio":0.993,"contentHeightRatio":0.986,"topPadRatio":0.007,"bottomPadRatio":0.007,"leftPadRatio":0.0035,"rightPadRatio":0.0035},
    proposedScaleFactor: 0.24,
    positioningMode: 'GROUNDED',
    isAirborne: false,
    verificationStatus: 'REFERENCE_PF1E_TIER',
    manualOverrideFlag: null,
    auditNotes: 'Pathfinder 1e Fine size reference (< 6 inches, 0.5-ft space).'
  },
  {
    id: 99002,
    isReferenceSpecimen: true,
    name: 'Cave Toad (Diminutive PF1e Reference)',
    isDemoProxy: true,
    proxyArtworkSource: 'Giant Crab',
    slug: 'ref_diminutive_toad',
    symbol: 'd',
    color: '#84cc16',
    challengeRating: 0.16,
    creatureType: 'Animal',
    movementType: 'WALK',
    sourceUrl: 'https://www.aonprd.com/MonsterDisplay.aspx?ItemName=Toad',
    pfSizeCategory: 'DIMINUTIVE',
    pfSizeOrder: 2,
    pfSizeLabel: 'Diminutive',
    pfSpaceFt: 1.0,
    visualBodyProfile: 'REPTILIAN_TINY_LOW',
    visualBodyProfileLabel: 'Diminutive Crustacean / Amphibian (6–12 in.)',
    bodyProportions: { approxHeightFt: 0.6, approxLengthFt: 0.8, approxWeightLbs: 0.5, statureMultiplier: 0.95 },
    imagePath: '/images/monsters/giant_crab.png',
    cutoutImagePath: '/lab-assets/images/monsters-cutout/giant_crab.png',
    hasCutout: true,
    imageContentBounds: {"width":880,"height":837,"minX":12,"minY":12,"maxX":867,"maxY":824,"contentWidthRatio":0.9727,"contentHeightRatio":0.9713,"topPadRatio":0.0143,"bottomPadRatio":0.0143,"leftPadRatio":0.0136,"rightPadRatio":0.0136},
    cardContentBounds: {"width":1024,"height":1024,"minX":24,"minY":116,"maxX":996,"maxY":996,"contentWidthRatio":0.949,"contentHeightRatio":0.859,"topPadRatio":0.113,"bottomPadRatio":0.027,"leftPadRatio":0.023,"rightPadRatio":0.027},
    cutoutContentBounds: {"width":880,"height":837,"minX":12,"minY":12,"maxX":867,"maxY":824,"contentWidthRatio":0.9727,"contentHeightRatio":0.9713,"topPadRatio":0.0143,"bottomPadRatio":0.0143,"leftPadRatio":0.0136,"rightPadRatio":0.0136},
    proposedScaleFactor: 0.34,
    positioningMode: 'GROUNDED',
    isAirborne: false,
    verificationStatus: 'REFERENCE_PF1E_TIER',
    manualOverrideFlag: null,
    auditNotes: 'Official Pathfinder 1e Diminutive reference (1-ft space) using verified RGBA cutout.'
  },
  {
    id: 99007,
    isReferenceSpecimen: true,
    name: 'Ancient Treant / Giant Troll (Huge PF1e Reference)',
    isDemoProxy: true,
    proxyArtworkSource: 'Ogre',
    slug: 'ref_huge_elder_troll',
    symbol: 'H',
    color: '#ef4444',
    challengeRating: 8,
    creatureType: 'Humanoid (giant)',
    movementType: 'WALK',
    sourceUrl: 'https://www.aonprd.com/MonsterDisplay.aspx?ItemName=Treant',
    pfSizeCategory: 'HUGE',
    pfSizeOrder: 7,
    pfSizeLabel: 'Huge',
    pfSpaceFt: 15.0,
    visualBodyProfile: 'BEHEMOTH_HUGE_COLOSSAL',
    visualBodyProfileLabel: 'Huge Towering Behemoth (16–32 ft.)',
    bodyProportions: { approxHeightFt: 24.0, approxLengthFt: 12.0, approxWeightLbs: 9000, statureMultiplier: 1.04 },
    imagePath: '/images/monsters/ogre.png',
    cutoutImagePath: '/lab-assets/images/monsters-cutout/ogre.png',
    hasCutout: true,
    imageContentBounds: {"width":854,"height":983,"minX":12,"minY":12,"maxX":841,"maxY":970,"contentWidthRatio":0.9719,"contentHeightRatio":0.9756,"topPadRatio":0.0122,"bottomPadRatio":0.0122,"leftPadRatio":0.0141,"rightPadRatio":0.0141},
    cardContentBounds: {"width":1024,"height":1024,"minX":24,"minY":32,"maxX":996,"maxY":996,"contentWidthRatio":0.949,"contentHeightRatio":0.941,"topPadRatio":0.031,"bottomPadRatio":0.027,"leftPadRatio":0.023,"rightPadRatio":0.027},
    cutoutContentBounds: {"width":854,"height":983,"minX":12,"minY":12,"maxX":841,"maxY":970,"contentWidthRatio":0.9719,"contentHeightRatio":0.9756,"topPadRatio":0.0122,"bottomPadRatio":0.0122,"leftPadRatio":0.0141,"rightPadRatio":0.0141},
    proposedScaleFactor: 1.78,
    positioningMode: 'GROUNDED',
    isAirborne: false,
    verificationStatus: 'REFERENCE_PF1E_TIER',
    manualOverrideFlag: 'UI_SAFE_CLAMP_CANDIDATE',
    auditNotes: 'Pathfinder 1e Huge size showcase (16–32 ft tall, 15-ft space) using towering club-brute verified RGBA cutout.'
  },
  {
    id: 99008,
    isReferenceSpecimen: true,
    name: 'Deep Crag Wyrm (Gargantuan PF1e Reference)',
    isDemoProxy: true,
    proxyArtworkSource: 'Wyvern',
    slug: 'ref_gargantuan_wyrm',
    symbol: 'G',
    color: '#c084fc',
    challengeRating: 12,
    creatureType: 'Dragon',
    movementType: 'FLY',
    sourceUrl: 'https://www.aonprd.com/MonsterDisplay.aspx?ItemName=Purple%20Worm',
    pfSizeCategory: 'GARGANTUAN',
    pfSizeOrder: 8,
    pfSizeLabel: 'Gargantuan',
    pfSpaceFt: 20.0,
    visualBodyProfile: 'BEHEMOTH_HUGE_COLOSSAL',
    visualBodyProfileLabel: 'Gargantuan Behemoth (32–64 ft.)',
    bodyProportions: { approxHeightFt: 42.0, approxLengthFt: 55.0, approxWeightLbs: 40000, statureMultiplier: 1.08 },
    imagePath: '/images/monsters/wyvern.png',
    cutoutImagePath: '/lab-assets/images/monsters-cutout/wyvern.png',
    hasCutout: true,
    imageContentBounds: {"width":905,"height":934,"minX":12,"minY":12,"maxX":892,"maxY":921,"contentWidthRatio":0.9735,"contentHeightRatio":0.9743,"topPadRatio":0.0128,"bottomPadRatio":0.0128,"leftPadRatio":0.0133,"rightPadRatio":0.0133},
    cardContentBounds: {"width":1024,"height":1024,"minX":24,"minY":52,"maxX":996,"maxY":996,"contentWidthRatio":0.949,"contentHeightRatio":0.922,"topPadRatio":0.051,"bottomPadRatio":0.027,"leftPadRatio":0.023,"rightPadRatio":0.027},
    cutoutContentBounds: {"width":905,"height":934,"minX":12,"minY":12,"maxX":892,"maxY":921,"contentWidthRatio":0.9735,"contentHeightRatio":0.9743,"topPadRatio":0.0128,"bottomPadRatio":0.0128,"leftPadRatio":0.0133,"rightPadRatio":0.0133},
    proposedScaleFactor: 1.98,
    positioningMode: 'GROUNDED',
    isAirborne: false,
    verificationStatus: 'REFERENCE_PF1E_TIER',
    manualOverrideFlag: 'UI_SAFE_CLAMP_CANDIDATE',
    auditNotes: 'Pathfinder 1e Gargantuan size showcase (32–64 ft, 20-ft space) using verified Wyvern RGBA cutout.'
  },
  {
    id: 99009,
    isReferenceSpecimen: true,
    name: 'World-Root Titan (Colossal PF1e Reference)',
    isDemoProxy: true,
    proxyArtworkSource: 'Assassin Vine',
    slug: 'ref_colossal_titan',
    symbol: 'C',
    color: '#f43f5e',
    challengeRating: 16,
    creatureType: 'Plant',
    movementType: 'WALK',
    sourceUrl: 'https://www.aonprd.com/MonsterDisplay.aspx?ItemName=Tarrasque',
    pfSizeCategory: 'COLOSSAL',
    pfSizeOrder: 9,
    pfSizeLabel: 'Colossal',
    pfSpaceFt: 30.0,
    visualBodyProfile: 'BEHEMOTH_HUGE_COLOSSAL',
    visualBodyProfileLabel: 'Colossal Titan (64+ ft.)',
    bodyProportions: { approxHeightFt: 70.0, approxLengthFt: 65.0, approxWeightLbs: 260000, statureMultiplier: 1.12 },
    imagePath: '/images/monsters/assassin_vine.png',
    cutoutImagePath: '/lab-assets/images/monsters-cutout/assassin_vine.png',
    hasCutout: true,
    imageContentBounds: {"width":796,"height":885,"minX":12,"minY":12,"maxX":783,"maxY":872,"contentWidthRatio":0.9698,"contentHeightRatio":0.9729,"topPadRatio":0.0136,"bottomPadRatio":0.0136,"leftPadRatio":0.0151,"rightPadRatio":0.0151},
    cardContentBounds: {"width":1024,"height":1024,"minX":24,"minY":24,"maxX":996,"maxY":996,"contentWidthRatio":0.949,"contentHeightRatio":0.949,"topPadRatio":0.023,"bottomPadRatio":0.027,"leftPadRatio":0.023,"rightPadRatio":0.027},
    cutoutContentBounds: {"width":796,"height":885,"minX":12,"minY":12,"maxX":783,"maxY":872,"contentWidthRatio":0.9698,"contentHeightRatio":0.9729,"topPadRatio":0.0136,"bottomPadRatio":0.0136,"leftPadRatio":0.0151,"rightPadRatio":0.0151},
    proposedScaleFactor: 2.15,
    positioningMode: 'GROUNDED',
    isAirborne: false,
    verificationStatus: 'REFERENCE_PF1E_TIER',
    manualOverrideFlag: 'UI_SAFE_CLAMP_CANDIDATE',
    auditNotes: 'Pathfinder 1e Colossal size showcase (64+ ft, 30-ft space), testing upper UI boundary clamping.'
  }
];

const BY_ID = new Map();
const BY_CATALOG_ORDER = new Map();
const BY_SLUG = new Map();
const BY_NAME = new Map();
const BASELINE_CUTOUT_SNAPSHOTS = new Map();

for (const item of [...MONSTER_SIZE_CATALOG, ...PF1E_SIZE_REFERENCE_SPECIMENS]) {
  BY_ID.set(Number(item.id), item);
  if (item.catalogOrder) {
    BY_CATALOG_ORDER.set(Number(item.catalogOrder), item);
  }
  if (item.slug && !BY_SLUG.has(item.slug)) {
    BY_SLUG.set(item.slug, item);
  }
  const normName = String(item.name || '').trim().toLowerCase();
  if (normName && !BY_NAME.has(normName)) {
    BY_NAME.set(normName, item);
  }
  if (item.slug && !BASELINE_CUTOUT_SNAPSHOTS.has(item.slug)) {
    BASELINE_CUTOUT_SNAPSHOTS.set(item.slug, {
      hasCutout: Boolean(item.hasCutout),
      cutoutImagePath: item.cutoutImagePath || null,
      cutoutContentBounds: item.cutoutContentBounds ? { ...item.cutoutContentBounds } : null,
      imageContentBounds: item.imageContentBounds ? { ...item.imageContentBounds } : null
    });
  }
}
// Alias support
BY_SLUG.set('creeping_vine', BY_SLUG.get('assassin_vine'));
BY_NAME.set('creeping vine', BY_SLUG.get('assassin_vine'));

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Focus Area 1 — Scene-Aware Perspective & Corridor Depth Calibration
 * Adapts ground contact, horizon line, corridor width clamp, ground sink, and shadow softness
 * across Mirkwood Trail, The Old Stone Bridge, Deadman's Mire, Watchpost Ruins, and open wilds.
 */
const CORRIDOR_DEPTH_TYPES = {
  OPEN_FIELD: {
    key: 'OPEN_FIELD',
    label: 'Open Field / Moor / Clearing',
    defaultHorizonY: 46,
    defaultStageFloorY: 83,
    horizontalMarginRatio: 0.08,
    corridorWidthClampRatio: 0.50,
    shadowSoftnessMult: 1.0,
    groundSinkScale: 1.0,
    perspectiveDepthRatePxPerFt: 2.8,
    ambientShadowTint: 'rgba(10, 12, 16, 0.68)'
  },
  FOREST_TRAIL: {
    key: 'FOREST_TRAIL',
    label: 'Forest Trail / Swamp Path / Canopy Track',
    defaultHorizonY: 48,
    defaultStageFloorY: 82,
    horizontalMarginRatio: 0.10,
    corridorWidthClampRatio: 0.48,
    shadowSoftnessMult: 1.08,
    groundSinkScale: 1.05,
    perspectiveDepthRatePxPerFt: 3.1,
    ambientShadowTint: 'rgba(8, 14, 10, 0.74)'
  },
  NARROW_BRIDGE: {
    key: 'NARROW_BRIDGE',
    label: 'Narrow Stone Bridge / Parapet Causeway',
    defaultHorizonY: 45,
    defaultStageFloorY: 80,
    horizontalMarginRatio: 0.14,
    corridorWidthClampRatio: 0.44,
    shadowSoftnessMult: 0.90,
    groundSinkScale: 0.78,
    perspectiveDepthRatePxPerFt: 3.4,
    ambientShadowTint: 'rgba(12, 16, 24, 0.78)'
  },
  INTERIOR_RUIN: {
    key: 'INTERIOR_RUIN',
    label: 'Ruined Watchpost / Sunken Vault / Stone Archway',
    defaultHorizonY: 44,
    defaultStageFloorY: 81,
    horizontalMarginRatio: 0.12,
    corridorWidthClampRatio: 0.46,
    shadowSoftnessMult: 0.94,
    groundSinkScale: 0.85,
    perspectiveDepthRatePxPerFt: 3.2,
    ambientShadowTint: 'rgba(8, 10, 16, 0.80)'
  }
};

const SCENE_PERSPECTIVE_PROFILES = {
  MIRKWOOD_TRAIL: {
    sceneKey: 'MIRKWOOD_TRAIL',
    label: 'Mirkwood Trail & Crossroads Clearing',
    sceneTerrain: 'FOREST',
    corridorDepthType: 'FOREST_TRAIL',
    cameraHorizonY: 48,
    stageFloorY: 82,
    stageCenterX: 50,
    groundSurfaceType: 'forest-earth',
    groundSinkScale: 1.05,
    shadowSoftnessMult: 1.08,
    ambientShadowTint: 'rgba(8, 14, 10, 0.74)'
  },
  OLD_STONE_BRIDGE: {
    sceneKey: 'OLD_STONE_BRIDGE',
    label: 'The Old Stone Bridge [8, 7]',
    sceneTerrain: 'BRIDGE',
    corridorDepthType: 'NARROW_BRIDGE',
    cameraHorizonY: 45,
    stageFloorY: 80,
    stageCenterX: 50,
    groundSurfaceType: 'stone-bridge',
    groundSinkScale: 0.78,
    shadowSoftnessMult: 0.90,
    ambientShadowTint: 'rgba(12, 16, 24, 0.78)'
  },
  DEADMANS_MIRE: {
    sceneKey: 'DEADMANS_MIRE',
    label: "Deadman's Mire & Rotting Fen [4, 11]",
    sceneTerrain: 'SWAMP',
    corridorDepthType: 'FOREST_TRAIL',
    cameraHorizonY: 49,
    stageFloorY: 84,
    stageCenterX: 50,
    groundSurfaceType: 'swamp-mud',
    groundSinkScale: 1.22,
    shadowSoftnessMult: 1.15,
    ambientShadowTint: 'rgba(6, 16, 12, 0.78)'
  },
  WATCHPOST_RUINS: {
    sceneKey: 'WATCHPOST_RUINS',
    label: 'Bridge East Watchpost Ruins [9, 7]',
    sceneTerrain: 'UNDERGROUND_RUINS',
    corridorDepthType: 'INTERIOR_RUIN',
    cameraHorizonY: 44,
    stageFloorY: 81,
    stageCenterX: 50,
    groundSurfaceType: 'ruin-flagstone',
    groundSinkScale: 0.85,
    shadowSoftnessMult: 0.94,
    ambientShadowTint: 'rgba(8, 10, 16, 0.80)'
  },
  VERDANT_PLAINS: {
    sceneKey: 'VERDANT_PLAINS',
    label: 'Verdant Plains & Frontier Road',
    sceneTerrain: 'PLAINS',
    corridorDepthType: 'OPEN_FIELD',
    cameraHorizonY: 46,
    stageFloorY: 83,
    stageCenterX: 50,
    groundSurfaceType: 'wilderness-soil',
    groundSinkScale: 1.0,
    shadowSoftnessMult: 1.0,
    ambientShadowTint: 'rgba(10, 12, 16, 0.68)'
  },
  RAVEN_CRAGS: {
    sceneKey: 'RAVEN_CRAGS',
    label: 'Raven Crags & Highland Slopes',
    sceneTerrain: 'HILLS',
    corridorDepthType: 'OPEN_FIELD',
    cameraHorizonY: 45,
    stageFloorY: 81,
    stageCenterX: 50,
    groundSurfaceType: 'crag-slate',
    groundSinkScale: 0.88,
    shadowSoftnessMult: 0.96,
    ambientShadowTint: 'rgba(12, 14, 18, 0.72)'
  },
  OAKHAVEN_SANCTUARY: {
    sceneKey: 'OAKHAVEN_SANCTUARY',
    label: 'Oakhaven Sanctuary & Gatehouse [7, 7]',
    sceneTerrain: 'CITY',
    corridorDepthType: 'OPEN_FIELD',
    cameraHorizonY: 46,
    stageFloorY: 82,
    stageCenterX: 50,
    groundSurfaceType: 'cobblestone',
    groundSinkScale: 0.82,
    shadowSoftnessMult: 0.92,
    ambientShadowTint: 'rgba(14, 12, 10, 0.74)'
  }
};

function resolveScenePerspectiveCalibration(options = {}) {
  const hasExplicitSceneOpts = Boolean(
    options.sceneKey ||
    options.sceneTerrain ||
    options.corridorDepthType ||
    options.cameraHorizonY !== undefined ||
    options.groundSurfaceType ||
    (options.tileX !== undefined && options.tileY !== undefined)
  );

  const rawSceneKey = String(options.sceneKey || '').toUpperCase().trim();
  const rawTerrain = String(options.sceneTerrain || options.terrain || '').toUpperCase().trim();
  const rawCorridor = String(options.corridorDepthType || '').toUpperCase().trim();
  const rawSurface = String(options.groundSurfaceType || '').toLowerCase().trim();
  const tx = options.tileX !== undefined ? Number(options.tileX) : null;
  const ty = options.tileY !== undefined ? Number(options.tileY) : null;

  let matchedScene = null;
  if (rawSceneKey && SCENE_PERSPECTIVE_PROFILES[rawSceneKey]) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES[rawSceneKey];
  } else if (tx === 8 && ty === 7) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.OLD_STONE_BRIDGE;
  } else if (tx === 9 && ty === 7) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.WATCHPOST_RUINS;
  } else if (tx === 4 && ty === 11) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.DEADMANS_MIRE;
  } else if (rawTerrain === 'BRIDGE' || rawSurface.includes('bridge')) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.OLD_STONE_BRIDGE;
  } else if (rawTerrain === 'UNDERGROUND_RUINS' || rawTerrain === 'RUINS' || rawSurface.includes('ruin')) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.WATCHPOST_RUINS;
  } else if (rawTerrain === 'SWAMP' || rawSurface.includes('swamp') || rawSurface.includes('mire')) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.DEADMANS_MIRE;
  } else if (rawTerrain === 'FOREST' || rawTerrain === 'JUNGLE' || rawSurface.includes('forest')) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.MIRKWOOD_TRAIL;
  } else if (rawTerrain === 'HILLS' || rawTerrain === 'MOUNTAINS' || rawSurface.includes('crag')) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.RAVEN_CRAGS;
  } else if (rawTerrain === 'CITY' || rawTerrain === 'TOWN' || rawSurface.includes('cobble')) {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.OAKHAVEN_SANCTUARY;
  } else if (rawTerrain === 'PLAINS') {
    matchedScene = SCENE_PERSPECTIVE_PROFILES.VERDANT_PLAINS;
  }

  const corridorKey = CORRIDOR_DEPTH_TYPES[rawCorridor]
    ? rawCorridor
    : (matchedScene ? matchedScene.corridorDepthType : 'FOREST_TRAIL');
  const corridorDef = CORRIDOR_DEPTH_TYPES[corridorKey] || CORRIDOR_DEPTH_TYPES.FOREST_TRAIL;

  const defaultFloorY = matchedScene ? matchedScene.stageFloorY : 82;
  const stageFloorY = clamp(
    Number(options.stageFloorY !== undefined ? options.stageFloorY : defaultFloorY),
    68,
    92
  );
  const defaultHorizonY = matchedScene ? matchedScene.cameraHorizonY : corridorDef.defaultHorizonY;
  const cameraHorizonY = clamp(
    Number(options.cameraHorizonY !== undefined ? options.cameraHorizonY : defaultHorizonY),
    32,
    64
  );
  const stageCenterX = clamp(
    Number(options.stageCenterX !== undefined ? options.stageCenterX : (matchedScene ? matchedScene.stageCenterX : 50)),
    35,
    65
  );

  return {
    sceneKey: matchedScene ? matchedScene.sceneKey : (rawSceneKey || 'DEFAULT_STAGE'),
    sceneTerrain: rawTerrain || (matchedScene ? matchedScene.sceneTerrain : 'FOREST'),
    corridorDepthType: corridorDef.key,
    corridorDepthLabel: corridorDef.label,
    cameraHorizonY,
    stageFloorY,
    stageCenterX,
    groundSurfaceType: rawSurface || (matchedScene ? matchedScene.groundSurfaceType : 'forest-earth'),
    horizontalMarginRatio: corridorDef.horizontalMarginRatio,
    corridorWidthClampRatio: hasExplicitSceneOpts ? corridorDef.corridorWidthClampRatio : 0.48,
    shadowSoftnessMult: hasExplicitSceneOpts
      ? (matchedScene ? matchedScene.shadowSoftnessMult : corridorDef.shadowSoftnessMult)
      : 1.0,
    groundSinkScale: hasExplicitSceneOpts
      ? (matchedScene ? matchedScene.groundSinkScale : corridorDef.groundSinkScale)
      : 1.0,
    perspectiveDepthRatePxPerFt: corridorDef.perspectiveDepthRatePxPerFt,
    ambientShadowTint: (matchedScene && matchedScene.ambientShadowTint) || corridorDef.ambientShadowTint,
    isCustomSceneCalibrated: hasExplicitSceneOpts
  };
}

/**
 * Focus Area 2 — Virtual Distance Bands & Perspective Resolver
 * Formalizes encounter distance bands (20 ft Distant Sighting, 16 ft Ranged Engagement,
 * 12 ft Melee Engagement, 9 ft Close Press) and resolves distance in feet.
 */
const ENCOUNTER_DISTANCE_BANDS = {
  DISTANT_SIGHTING: {
    key: 'DISTANT_SIGHTING',
    stage: 'DISTANT',
    distanceFt: 20,
    minFt: 18,
    maxFt: 30,
    label: 'Distant Sighting / Stage 1 Clue (20 ft)',
    scaleFactorVsMelee: 0.60,
    shadowBlurMult: 1.18,
    shadowOpacityMult: 0.82
  },
  RANGED_ENGAGEMENT: {
    key: 'RANGED_ENGAGEMENT',
    stage: 'CLOSING',
    distanceFt: 16,
    minFt: 14,
    maxFt: 17.9,
    label: 'Ranged Engagement / Closing (16 ft)',
    scaleFactorVsMelee: 0.75,
    shadowBlurMult: 1.09,
    shadowOpacityMult: 0.91
  },
  MELEE_ENGAGEMENT: {
    key: 'MELEE_ENGAGEMENT',
    stage: 'MELEE',
    distanceFt: 12,
    minFt: 10.5,
    maxFt: 13.9,
    label: 'Standard Melee Engagement (12 ft)',
    scaleFactorVsMelee: 1.00,
    shadowBlurMult: 1.00,
    shadowOpacityMult: 1.00
  },
  CLOSE_PRESS: {
    key: 'CLOSE_PRESS',
    stage: 'CLOSE_PRESS',
    distanceFt: 9,
    minFt: 6,
    maxFt: 10.4,
    label: 'Close Press / Grapple Range (9 ft)',
    scaleFactorVsMelee: 1.333,
    shadowBlurMult: 0.92,
    shadowOpacityMult: 1.06
  }
};

function resolveEncounterDistanceFt(options = {}) {
  if (typeof options === 'number' && !Number.isNaN(options)) {
    return clamp(options, 6, 30);
  }
  if (options && typeof options === 'object') {
    if (options.virtualDistanceFt !== undefined && options.virtualDistanceFt !== null && options.virtualDistanceFt !== '') {
      return clamp(Number(options.virtualDistanceFt), 6, 30);
    }
    const rawBand = String(
      options.encounterDistanceBand ||
      options.encounterDistanceStage ||
      options.distanceBand ||
      options.distanceStage ||
      ''
    ).toUpperCase().trim();

    if (rawBand) {
      if (ENCOUNTER_DISTANCE_BANDS[rawBand]) {
        return ENCOUNTER_DISTANCE_BANDS[rawBand].distanceFt;
      }
      if (rawBand === 'DISTANT' || rawBand === 'STAGE1' || rawBand === 'OPENING_SHOT') {
        return ENCOUNTER_DISTANCE_BANDS.DISTANT_SIGHTING.distanceFt;
      }
      if (rawBand === 'CLOSING' || rawBand === 'RANGED' || rawBand === 'APPROACHING') {
        return ENCOUNTER_DISTANCE_BANDS.RANGED_ENGAGEMENT.distanceFt;
      }
      if (rawBand === 'MELEE' || rawBand === 'STAGE2' || rawBand === 'STANDARD') {
        return ENCOUNTER_DISTANCE_BANDS.MELEE_ENGAGEMENT.distanceFt;
      }
      if (rawBand === 'CLOSE' || rawBand === 'PRESS' || rawBand === 'GRAPPLE') {
        return ENCOUNTER_DISTANCE_BANDS.CLOSE_PRESS.distanceFt;
      }
    }
  }
  return 12;
}

function classifyEncounterDistanceBand(distanceFt = 12) {
  const d = clamp(Number(distanceFt || 12), 6, 30);
  if (d >= 18) return ENCOUNTER_DISTANCE_BANDS.DISTANT_SIGHTING;
  if (d >= 14) return ENCOUNTER_DISTANCE_BANDS.RANGED_ENGAGEMENT;
  if (d >= 10.5) return ENCOUNTER_DISTANCE_BANDS.MELEE_ENGAGEMENT;
  return ENCOUNTER_DISTANCE_BANDS.CLOSE_PRESS;
}

/**
 * Focus Area 10 — Cutout Asset Contract & Dynamic Metadata Registration for Tracks 4 & 5
 */
const CUTOUT_ASSET_CONTRACT = {
  contractVersion: '1.0.0',
  requiredColorType: 6, // PNG RGBA
  minTransparentPixelRatio: 0.12,
  maxTransparentPixelRatio: 0.96,
  maxEdgeTouchRatio: 0.38,
  minContentWidthRatio: 0.22,
  maxContentWidthRatio: 0.998,
  minContentHeightRatio: 0.22,
  maxContentHeightRatio: 0.998,
  maxPadRatio: 0.45,
  defaultGroundedFootAnchorRatio: 0.96,
  defaultAirborneAnchorRatio: 0.50,
  fallbackPresentationMode: 'CARD'
};

function inferPfSizeFromDimensionsOrText(rawSize, heightFt, lengthFt, textHint = '') {
  if (rawSize) {
    const clean = String(rawSize).trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (PF1E_SIZE_CATEGORIES[clean]) return clean;
  }
  const majorDim = Math.max(Number(heightFt) || 0, Number(lengthFt) || 0);
  if (majorDim > 0) {
    if (majorDim < 0.5) return 'FINE';
    if (majorDim < 1.0) return 'DIMINUTIVE';
    if (majorDim < 2.2) return 'TINY';
    if (majorDim < 4.2) return 'SMALL';
    if (majorDim <= 8.2) return 'MEDIUM';
    if (majorDim <= 16.5) return 'LARGE';
    if (majorDim <= 32.5) return 'HUGE';
    if (majorDim <= 64.5) return 'GARGANTUAN';
    return 'COLOSSAL';
  }
  const lower = String(textHint || '').toLowerCase();
  if (/\b(colossal|titan|leviathan)\b/.test(lower)) return 'COLOSSAL';
  if (/\b(gargantuan|ancient wyrm|purple worm)\b/.test(lower)) return 'GARGANTUAN';
  if (/\b(huge|treant|elder|behemoth)\b/.test(lower)) return 'HUGE';
  if (/\b(large|giant|troll|ogre|minotaur|owlbear|wyvern|manticore|ettin|centaur|griffon|hydra)\b/.test(lower)) return 'LARGE';
  if (/\b(tiny|stirge|viper|bat|rat|raven|toad|sprite|pixie)\b/.test(lower)) return 'TINY';
  if (/\b(small|goblin|kobold|mite|gnome|halfling|imp|choker)\b/.test(lower)) return 'SMALL';
  return 'MEDIUM';
}

function inferVisualBodyProfileForFallback(pfSizeCategory, objOrText = {}) {
  const obj = (objOrText && typeof objOrText === 'object') ? objOrText : {};
  const explicitProfile = String(obj.visualBodyProfile || obj.visual_profile || '').trim().toUpperCase();
  if (explicitProfile && VISUAL_BODY_PROFILES[explicitProfile]) {
    return explicitProfile;
  }

  const sizeCat = PF1E_SIZE_CATEGORIES[pfSizeCategory] || PF1E_SIZE_CATEGORIES.MEDIUM;
  const sizeOrder = sizeCat.order;
  const text = [
    typeof objOrText === 'string' ? objOrText : '',
    obj.name,
    obj.monsterName,
    obj.baseMonsterName,
    obj.slug,
    obj.monsterSlug,
    obj.type,
    obj.creatureType,
    obj.movement_type,
    obj.movementType
  ].filter(Boolean).join(' ').toLowerCase();

  const isFlying = Boolean(
    obj.isAirborne ||
    obj.is_flying ||
    String(obj.movement_type || obj.movementType || '').toUpperCase() === 'FLYING' ||
    /\b(bat|stirge|harpy|manticore|wyvern|gargoyle|griffon|cockatrice|pegasus|hawk|eagle|owl|vulture|wasp|hornet|fly|moth|drake|dragon)\b/.test(text)
  );
  if (isFlying) {
    if (sizeOrder <= 4) return 'FLYING_SMALL_PEST';
    if (sizeOrder >= 6) return 'WINGED_LARGE_PREDATOR';
    return 'WINGED_HARPY_FLIER';
  }

  if (/\b(orb|wisp|sphere|floating eye)\b/.test(text)) {
    return 'FLOATING_ORB';
  }
  if (/\b(spider|scorpion|crab|beetle|centipede|tick|mite|arachnid|vermin)\b/.test(text)) {
    if (sizeOrder <= 4) return 'ARACHNID_SMALL_SKIMMER';
    if (sizeOrder >= 6) return 'ARACHNID_CHITIN_LARGE';
    return 'ARACHNID_WIDE';
  }
  if (/\b(snake|viper|cobra|constrictor|serpent|worm|naga)\b/.test(text)) {
    if (sizeOrder <= 4) return 'SERPENT_TINY_COIL';
    return 'SERPENT_CONSTRICTOR_LARGE';
  }
  if (/\b(ooze|jelly|slime|pudding|amoeba|cube)\b/.test(text)) {
    if (sizeOrder >= 6) return 'AMORPHOUS_LARGE_OOZE';
    return 'AMORPHOUS_MEDIUM_OOZE';
  }
  if (/\b(vine|plant|treant|mushroom|fungus|shambling|briar|thorns)\b/.test(text)) {
    return 'PLANT_MASS_LARGE';
  }
  if (/\b(wolf|hound|dog|worg|cat|lion|tiger|leopard|panther|boar|stag|elk|horse|bear|hyena|jackal|rat|weasel|badger|lizard|basilisk|bulette|ankheg|displacer)\b/.test(text)) {
    if (sizeOrder <= 3) return 'QUADRUPED_TINY_LOW';
    if (sizeOrder === 4) return 'QUADRUPED_SMALL_LOW';
    if (sizeOrder >= 6) return 'QUADRUPED_MASSIVE';
    return 'QUADRUPED_LOW';
  }

  if (sizeOrder <= 4) return 'BIPED_SMALL';
  if (sizeOrder >= 6) return 'BIPED_LARGE_BRUTE';
  return 'BIPED_MEDIUM';
}

function synthesizeFallbackMonsterSizeEntry(monsterOrKey) {
  const isObj = monsterOrKey && typeof monsterOrKey === 'object';
  const rawName = isObj
    ? String(monsterOrKey.baseMonsterName || monsterOrKey.monsterName || monsterOrKey.cleanMonsterName || monsterOrKey.name || monsterOrKey.slug || 'Unknown Creature').trim()
    : String(monsterOrKey || 'Unknown Creature').trim();
  const cleanSlug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown_creature';
  const rawSize = isObj ? (monsterOrKey.pfSizeCategory || monsterOrKey.size_category || monsterOrKey.sizeCategory || monsterOrKey.size) : null;
  const rawHeight = isObj ? (monsterOrKey.height || monsterOrKey.heightFt || (monsterOrKey.bodyProportions && monsterOrKey.bodyProportions.heightFt)) : null;
  const rawLength = isObj ? (monsterOrKey.length || monsterOrKey.lengthFt || (monsterOrKey.bodyProportions && monsterOrKey.bodyProportions.lengthFt)) : null;

  const pfSizeCategory = inferPfSizeFromDimensionsOrText(rawSize, rawHeight, rawLength, rawName);
  const sizeCat = PF1E_SIZE_CATEGORIES[pfSizeCategory] || PF1E_SIZE_CATEGORIES.MEDIUM;
  const visualBodyProfile = inferVisualBodyProfileForFallback(pfSizeCategory, monsterOrKey);
  const bodyProf = VISUAL_BODY_PROFILES[visualBodyProfile] || VISUAL_BODY_PROFILES.BIPED_MEDIUM;
  const isAirborne = Boolean(
    (isObj && (monsterOrKey.isAirborne || monsterOrKey.is_flying || String(monsterOrKey.movement_type || '').toUpperCase() === 'FLYING')) ||
    bodyProf.groundingMode.startsWith('AIRBORNE') ||
    visualBodyProfile === 'FLOATING_ORB'
  );

  const defaultHeightsBySize = {
    FINE: 0.4, DIMINUTIVE: 0.8, TINY: 1.5, SMALL: 3.2,
    MEDIUM: 6.0, LARGE: 11.5, HUGE: 22.0, GARGANTUAN: 40.0, COLOSSAL: 72.0
  };
  const heightFt = Number(rawHeight) || defaultHeightsBySize[pfSizeCategory] || 6.0;
  const lengthFt = Number(rawLength) || +(heightFt * bodyProf.aspectRatio).toFixed(1);

  return {
    id: (isObj && Number(monsterOrKey.id || monsterOrKey.monster_id || monsterOrKey.monsterId)) || 999,
    catalogOrder: 999,
    catalogBatch: 'FALLBACK_SYNTHESIZED',
    isFallbackMetadata: true,
    slug: cleanSlug,
    name: rawName,
    creatureType: (isObj && (monsterOrKey.creatureType || monsterOrKey.type)) || 'Beast',
    challengeRating: (isObj && Number(monsterOrKey.challengeRating || monsterOrKey.challenge_rating || monsterOrKey.level)) || 1,
    pfSizeCategory,
    pfSizeLabel: sizeCat.label,
    pfSizeOrder: sizeCat.order,
    pfSpaceFt: sizeCat.pfSpaceFt,
    visualBodyProfile,
    visualBodyProfileLabel: bodyProf.label,
    bodyProportions: {
      heightFt,
      lengthFt,
      weightLbs: sizeCat.order >= 6 ? 800 : (sizeCat.order <= 4 ? 30 : 160),
      statureMultiplier: 1.0,
      primaryAxis: bodyProf.aspectRatio >= 1.18 ? 'HORIZONTAL_WIDE' : 'VERTICAL'
    },
    proposedScaleFactor: +(sizeCat.baseViewportHeightVh / 28.5).toFixed(2),
    isAirborne,
    imagePath: (isObj && (monsterOrKey.imagePath || monsterOrKey.image_path)) || `/images/monsters/${cleanSlug}.png`,
    hasCutout: false,
    cutoutImagePath: null,
    cardContentBounds: {
      width: 1024, height: 1024,
      minX: 40, minY: 40, maxX: 984, maxY: 984,
      contentWidthRatio: 0.92, contentHeightRatio: 0.92,
      topPadRatio: 0.04, bottomPadRatio: 0.04, leftPadRatio: 0.04, rightPadRatio: 0.04
    },
    cutoutContentBounds: null,
    imageContentBounds: {
      width: 1024, height: 1024,
      minX: 40, minY: 40, maxX: 984, maxY: 984,
      contentWidthRatio: 0.92, contentHeightRatio: 0.92,
      topPadRatio: 0.04, bottomPadRatio: 0.04, leftPadRatio: 0.04, rightPadRatio: 0.04
    },
    verificationStatus: 'FALLBACK_DEFAULT',
    manualOverrideFlag: null,
    sourceUrl: null,
    auditNotes: 'Synthesized deterministic fallback size entry for uncataloged creature.'
  };
}

function lookupMonsterSizeEntry(monsterOrKey) {
  if (!monsterOrKey) return BY_SLUG.get('wolf');
  if (typeof monsterOrKey === 'number') {
    return BY_ID.get(monsterOrKey) || BY_CATALOG_ORDER.get(monsterOrKey) || BY_SLUG.get('wolf');
  }
  if (typeof monsterOrKey === 'string') {
    const clean = monsterOrKey.trim().toLowerCase();
    if (!clean) return BY_SLUG.get('wolf');
    const slug = clean.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return BY_SLUG.get(slug) || BY_NAME.get(clean) || BY_ID.get(Number(clean)) || BY_CATALOG_ORDER.get(Number(clean)) || synthesizeFallbackMonsterSizeEntry(monsterOrKey);
  }
  if (typeof monsterOrKey === 'object') {
    if (monsterOrKey.pfSizeCategory && monsterOrKey.visualBodyProfile && monsterOrKey.bodyProportions) {
      return monsterOrKey;
    }
    const slug = String(monsterOrKey.monsterSlug || monsterOrKey.imageSlug || monsterOrKey.slug || '').trim().toLowerCase();
    if (slug && BY_SLUG.has(slug)) return BY_SLUG.get(slug);
    const name = String(monsterOrKey.baseMonsterName || monsterOrKey.monsterName || monsterOrKey.cleanMonsterName || monsterOrKey.name || '').trim().toLowerCase();
    if (name && BY_NAME.has(name)) return BY_NAME.get(name);
    if (monsterOrKey.sizeMetadata && monsterOrKey.sizeMetadata.pfSizeCategory) {
      return monsterOrKey.sizeMetadata;
    }
    const id = Number(monsterOrKey.monster_id || monsterOrKey.monsterId || (!monsterOrKey.monsterName && !monsterOrKey.monsterSlug && !monsterOrKey.name ? monsterOrKey.id : 0) || 0);
    if (id && (BY_ID.has(id) || BY_CATALOG_ORDER.has(id))) {
      return BY_ID.get(id) || BY_CATALOG_ORDER.get(id);
    }
    return synthesizeFallbackMonsterSizeEntry(monsterOrKey);
  }
  return BY_SLUG.get('wolf');
}

function buildContactPatchesForMode(contactMode, sizeMult = 1.0) {
  const s = clamp(sizeMult, 0.55, 1.5);
  switch (contactMode) {
    case 'QUADRUPED_PAWS':
      return [
        { id: 'front-left-paw',  leftPct: 28, topPct: 95, widthPct: +(16 * s).toFixed(1), heightPct: 5.5, rotateDeg: -4, blurPx: 3, opacity: 0.84 },
        { id: 'front-right-paw', leftPct: 48, topPct: 96, widthPct: +(17 * s).toFixed(1), heightPct: 6.0, rotateDeg: 2,  blurPx: 3, opacity: 0.88 },
        { id: 'rear-left-paw',   leftPct: 67, topPct: 94, widthPct: +(15 * s).toFixed(1), heightPct: 5.2, rotateDeg: 5,  blurPx: 4, opacity: 0.78 },
        { id: 'rear-right-paw',  leftPct: 81, topPct: 92, widthPct: +(14 * s).toFixed(1), heightPct: 4.8, rotateDeg: 8,  blurPx: 4, opacity: 0.72 }
      ];
    case 'ARACHNID_LEGS':
      return [
        { id: 'leg-l1', leftPct: 14, topPct: 93, widthPct: 14, heightPct: 4.5, rotateDeg: -8, blurPx: 3, opacity: 0.82 },
        { id: 'leg-l2', leftPct: 30, topPct: 96, widthPct: 16, heightPct: 5.0, rotateDeg: -4, blurPx: 3, opacity: 0.86 },
        { id: 'leg-abd',leftPct: 50, topPct: 92, widthPct: 28, heightPct: 7.5, rotateDeg: 0,  blurPx: 6, opacity: 0.72 },
        { id: 'leg-r2', leftPct: 70, topPct: 96, widthPct: 16, heightPct: 5.0, rotateDeg: 4,  blurPx: 3, opacity: 0.86 },
        { id: 'leg-r1', leftPct: 86, topPct: 93, widthPct: 14, heightPct: 4.5, rotateDeg: 8,  blurPx: 3, opacity: 0.82 }
      ];
    case 'COIL_BASE':
      return [
        { id: 'coil-left',   leftPct: 33, topPct: 95, widthPct: 26, heightPct: 6.8, rotateDeg: -6, blurPx: 4, opacity: 0.82 },
        { id: 'coil-center', leftPct: 52, topPct: 96, widthPct: 38, heightPct: 8.5, rotateDeg: 0,  blurPx: 3, opacity: 0.90 },
        { id: 'coil-right',  leftPct: 71, topPct: 94, widthPct: 24, heightPct: 6.4, rotateDeg: 7,  blurPx: 4, opacity: 0.80 }
      ];
    case 'BIPED_FEET':
      return [
        { id: 'left-foot',  leftPct: 37, topPct: 96, widthPct: +(22 * s).toFixed(1), heightPct: 6.2, rotateDeg: -5, blurPx: 3, opacity: 0.88 },
        { id: 'right-foot', leftPct: 63, topPct: 95, widthPct: +(22 * s).toFixed(1), heightPct: 6.2, rotateDeg: 6,  blurPx: 3, opacity: 0.86 }
      ];
    default:
      return [];
  }
}

/**
 * Phase 3 — Adaptive Monster Visual Scaling Engine
 *
 * Computes exact viewport-relative dimensions, transparency/margin compensation,
 * foot contact anchoring, shadow geometry, scene-aware perspective calibration,
 * card fallback styling, and UI safety clamping for any monster.
 *
 * @param {object|string|number} monsterOrKey - Monster entry, ID, slug, or name
 * @param {object} [options]
 * @param {number} [options.viewportWidth=1920] - Current viewport width in px
 * @param {number} [options.viewportHeight=1080] - Current viewport height in px
 * @param {string} [options.presentationMode='INTEGRATED'] - 'INTEGRATED' or 'CARD'
 * @param {number} [options.stageFloorY=82] - Ground contact Y percentage in the scene
 * @param {number} [options.virtualDistanceFt=12] - Virtual camera distance in feet (default 12 ft)
 * @param {string} [options.encounterDistanceStage] - Optional 'DISTANT' | 'CLOSING' | 'MELEE' | 'CLOSE_PRESS'
 * @param {string} [options.encounterDistanceBand] - Optional 'DISTANT_SIGHTING' | 'RANGED_ENGAGEMENT' | 'MELEE_ENGAGEMENT' | 'CLOSE_PRESS'
 * @param {string} [options.sceneTerrain] - Optional terrain type ('FOREST', 'BRIDGE', 'SWAMP', 'UNDERGROUND_RUINS', etc.)
 * @param {string} [options.corridorDepthType] - Optional 'OPEN_FIELD' | 'FOREST_TRAIL' | 'NARROW_BRIDGE' | 'INTERIOR_RUIN'
 * @param {number} [options.cameraHorizonY] - Optional horizon Y percentage in scene
 * @param {string} [options.overridePfSize=null] - Optional PF1e size override (e.g., Spriggan Large form)
 */
function computeAdaptiveMonsterVisualScale(monsterOrKey, options = {}) {
  const entry = lookupMonsterSizeEntry(monsterOrKey);
  const vpW = clamp(Number(options.viewportWidth || 1920), 640, 3840);
  const vpH = clamp(Number(options.viewportHeight || 1080), 480, 2160);
  const presentationMode = String(options.presentationMode || 'INTEGRATED').toUpperCase();
  const hasVerifiedCutout = Boolean(entry.hasCutout && entry.cutoutContentBounds);
  const useCutoutBounds = presentationMode === 'INTEGRATED' && hasVerifiedCutout;
  const effectivePresentationMode = useCutoutBounds ? 'INTEGRATED' : 'CARD';

  let fallbackReason = null;
  if (effectivePresentationMode === 'CARD') {
    if (presentationMode === 'CARD') {
      fallbackReason = 'EXPLICIT_CARD_MODE_REQUESTED';
    } else if (!entry.hasCutout) {
      fallbackReason = 'NO_VERIFIED_RGBA_CUTOUT';
    } else {
      fallbackReason = 'MISSING_CUTOUT_BOUNDS_METADATA';
    }
  }

  // Scene-aware perspective calibration & virtual distance resolution
  const sceneCalibration = resolveScenePerspectiveCalibration(options);
  const stageFloorY = sceneCalibration.stageFloorY;
  const virtualDistanceFt = resolveEncounterDistanceFt(options);
  const distanceBand = classifyEncounterDistanceBand(virtualDistanceFt);
  const distanceScale = +(12 / virtualDistanceFt).toFixed(3);

  const pfSizeKey = (options.overridePfSize && PF1E_SIZE_CATEGORIES[options.overridePfSize])
    ? options.overridePfSize
    : (entry.pfSizeCategory || 'MEDIUM');
  const sizeCat = PF1E_SIZE_CATEGORIES[pfSizeKey] || PF1E_SIZE_CATEGORIES.MEDIUM;
  const bodyProf = VISUAL_BODY_PROFILES[entry.visualBodyProfile] || VISUAL_BODY_PROFILES.BIPED_MEDIUM;

  const statureMult = Number((entry.bodyProportions && entry.bodyProportions.statureMultiplier) || 1.0);

  // 1. Compute target visible height & width in pixels before UI safety clamping
  // Viewport height in the Lab layout has ~70% dedicated to #fp-viewport
  const effectiveStageReferenceH = vpH;
  const targetVhPct = sizeCat.baseViewportHeightVh * bodyProf.heightFactor * statureMult * distanceScale;
  const rawVisibleHeightPx = Math.round((targetVhPct / 100) * effectiveStageReferenceH);
  const rawVisibleWidthPx = Math.round(rawVisibleHeightPx * bodyProf.aspectRatio);

  // 2. UI Safety Clamping (Soft-Knee Asymptotic Clamp) so Huge/Gargantuan/Colossal never break HUD
  // while preserving strict monotonic visual ordering (Fine < Diminutive < Tiny < Small < Medium < Large < Huge < Gargantuan < Colossal)
  const kneeSafeHeightPx = Math.round(clamp(vpH * 0.405, 165, 438));
  const maxSafeHeightPx = Math.round(clamp(vpH * 0.545, 210, 588));
  const maxSafeWidthPx = Math.round(clamp(vpW * sceneCalibration.corridorWidthClampRatio, 210, 620));
  const minSafeHeightPx = Math.round(clamp(vpH * 0.062, 48, 88));

  // When viewing at long distances (e.g. 16-20 ft) or compact 768p viewports, scale the minimum floor
  // gently by tier & distance so Fine/Diminutive/Tiny retain strict monotonic ordering.
  const effectiveMinHeightPx = (virtualDistanceFt > 12 || vpH < 800)
    ? Math.max(22, Math.round(minSafeHeightPx * Math.min(1, distanceScale) * (0.72 + sizeCat.order * 0.06)))
    : minSafeHeightPx;

  let targetClampedH = rawVisibleHeightPx;
  if (rawVisibleHeightPx > kneeSafeHeightPx) {
    const excessH = rawVisibleHeightPx - kneeSafeHeightPx;
    const headroomH = Math.max(16, maxSafeHeightPx - kneeSafeHeightPx);
    targetClampedH = kneeSafeHeightPx + Math.round(headroomH * (1 - Math.exp(-excessH / (vpH * 0.145))));
  }

  const heightClampRatio = targetClampedH / Math.max(1, rawVisibleHeightPx);
  let widthClampRatio = 1.0;
  const kneeSafeWidthPx = Math.round(maxSafeWidthPx * 0.88);
  if (rawVisibleWidthPx * heightClampRatio > maxSafeWidthPx) {
    if (sceneCalibration.isCustomSceneCalibrated && rawVisibleWidthPx > kneeSafeWidthPx) {
      const excessW = rawVisibleWidthPx - kneeSafeWidthPx;
      const headroomW = Math.max(14, maxSafeWidthPx - kneeSafeWidthPx);
      const softClampedW = kneeSafeWidthPx + Math.round(headroomW * (1 - Math.exp(-excessW / (vpW * 0.18))));
      widthClampRatio = Math.min(softClampedW, maxSafeWidthPx) / Math.max(1, rawVisibleWidthPx);
    } else {
      widthClampRatio = maxSafeWidthPx / Math.max(1, rawVisibleWidthPx);
    }
  }

  const clampRatio = Math.min(heightClampRatio, widthClampRatio);
  const heightClampEngaged = heightClampRatio < 0.995;
  const widthClampEngaged = widthClampRatio < heightClampRatio && widthClampRatio < 0.995;
  const wasClamped = clampRatio < 0.995;

  const clampedH = Math.round(rawVisibleHeightPx * clampRatio);
  const clampedW = Math.round(rawVisibleWidthPx * clampRatio);
  const minFloorEngaged = clampedH < effectiveMinHeightPx;

  const visibleHeightPx = Math.max(effectiveMinHeightPx, clampedH);
  let visibleWidthPx;
  if (minFloorEngaged && (virtualDistanceFt !== 12 || vpH < 800 || bodyProf.aspectRatio < 1.0)) {
    visibleWidthPx = Math.min(maxSafeWidthPx, Math.max(20, Math.round(visibleHeightPx * bodyProf.aspectRatio)));
  } else {
    visibleWidthPx = Math.min(maxSafeWidthPx, Math.max(effectiveMinHeightPx, clampedW));
  }

  // 3. PNG Transparency & Vignette Empty Margin Compensation
  // Ensure empty/transparent borders do not shrink the rendered creature or leave floating gaps
  const bounds = useCutoutBounds
    ? entry.cutoutContentBounds
    : (entry.cardContentBounds || entry.imageContentBounds || {
        contentWidthRatio: 0.94, contentHeightRatio: 0.94,
        topPadRatio: 0.03, bottomPadRatio: 0.03, leftPadRatio: 0.03, rightPadRatio: 0.03
      });

  const cHRatio = clamp(Number(bounds.contentHeightRatio || 0.94), 0.55, 1.0);
  const cWRatio = clamp(Number(bounds.contentWidthRatio || 0.94), 0.55, 1.0);
  const topPad = clamp(Number(bounds.topPadRatio || 0.02), 0, 0.35);
  const botPad = clamp(Number(bounds.bottomPadRatio || 0.02), 0, 0.35);
  const leftPad = clamp(Number(bounds.leftPadRatio || 0.02), 0, 0.35);
  const rightPad = clamp(Number(bounds.rightPadRatio || 0.02), 0, 0.35);

  // In Cutout mode, we size the box to match visibleWidthPx x visibleHeightPx and apply trim scale
  // In Card mode, if a painting has heavy dark vignette padding (e.g. Wolf 25%, Dire Rat 19.5%),
  // imageTrimScale zooms the inner <img> slightly so the creature fills its intended visible size!
  const rawTrimScale = Math.max(1 / cHRatio, 1 / cWRatio);
  // Close-up portrait paintings of Tiny/Small creatures (Stirge, Viper, Goblin) shouldn't be over-zoomed
  const isCloseupPortrait = entry.manualOverrideFlag === 'CLOSEUP_PORTRAIT_CROP';
  const imageTrimScale = isCloseupPortrait
    ? 1.0
    : +clamp(rawTrimScale, 1.0, useCutoutBounds ? 1.08 : 1.24).toFixed(3);

  const imageShiftXPct = +(((leftPad - rightPad) / 2) * 100).toFixed(2);
  const imageShiftYPct = +(((topPad - botPad) / 2) * 100).toFixed(2);

  const containerHeightPx = visibleHeightPx;
  const containerWidthPx = visibleWidthPx;

  // 4. Foot / Ground Contact Positioning, Perspective Horizon Shift & Airborne Elevation
  const isAirborne = Boolean(
    entry.isAirborne ||
    bodyProf.groundingMode.startsWith('AIRBORNE') ||
    entry.visualBodyProfile === 'FLOATING_ORB'
  );
  const bottomPadCompensationPx = Math.round(botPad * containerHeightPx * (useCutoutBounds ? 1.0 : 0.45));
  const rawGroundedSinkPx = Math.round(clamp(containerHeightPx * 0.045, 6, 22)) + bottomPadCompensationPx;
  const baseGroundedSinkPx = sceneCalibration.isCustomSceneCalibrated
    ? Math.max(4, Math.round(rawGroundedSinkPx * sceneCalibration.groundSinkScale))
    : rawGroundedSinkPx;

  const airborneLiftPx = isAirborne
    ? Math.round((bodyProf.airborneLiftPx || 38) * clamp(vpH / 1080, 0.72, 1.2) * clamp(distanceScale, 0.65, 1.25))
    : 0;
  const airborneHoverAltitudePx = airborneLiftPx;
  const verticalOffsetPx = isAirborne ? -airborneLiftPx : baseGroundedSinkPx;
  const airborneGapPx = isAirborne ? Math.round(airborneLiftPx + 14) : 0;

  // Virtual distance perspective ground-plane shift:
  // At 12 ft (standard melee), perspectiveHorizonShiftPx === 0.
  // At > 12 ft (distant/ranged), shifts upward (< 0) toward cameraHorizonY.
  // At < 12 ft (close press), shifts slightly downward (> 0) toward foreground.
  const perspectiveHorizonShiftPx = virtualDistanceFt === 12
    ? 0
    : -Math.round((virtualDistanceFt - 12) * sceneCalibration.perspectiveDepthRatePxPerFt * (vpH / 1080));
  const footContactY = stageFloorY;
  const groundContactY = virtualDistanceFt === 12
    ? stageFloorY
    : +clamp(stageFloorY + (perspectiveHorizonShiftPx / vpH) * 100, sceneCalibration.cameraHorizonY + 6, 93).toFixed(2);
  const footAnchorRatio = isAirborne
    ? CUTOUT_ASSET_CONTRACT.defaultAirborneAnchorRatio
    : +clamp(1 - botPad, 0.84, 0.995).toFixed(3);

  // 5. Shadow Geometry scaled to creature footprint, body profile, distance & scene surface
  const shadowWidthPx = Math.round(visibleWidthPx * (bodyProf.shadowWidthPct / 100));
  const shadowHeightPx = Math.round(clamp(shadowWidthPx * (isAirborne ? 0.16 : 0.22), 10, 44));
  const shadowWidthPct = clamp(Math.round(bodyProf.shadowWidthPct * sizeCat.shadowScaleMult * 0.85), 28, 108);
  const distBlurMult = virtualDistanceFt === 12 ? 1.0 : distanceBand.shadowBlurMult;
  const distOpacityMult = virtualDistanceFt === 12 ? 1.0 : distanceBand.shadowOpacityMult;
  const shadowBlurPx = Math.max(
    3,
    Math.round(bodyProf.shadowBlurPx * (isAirborne ? 1.25 : 1.0) * sceneCalibration.shadowSoftnessMult * distBlurMult)
  );
  const shadowOpacity = +clamp(bodyProf.shadowOpacity * distOpacityMult, 0.18, 0.90).toFixed(2);

  const ambientPatch = {
    leftPct: 50,
    topPct: isAirborne ? 114 : 94,
    widthPct: clamp(bodyProf.shadowWidthPct, 36, 98),
    heightPct: isAirborne ? 11 : 14,
    rotateDeg: 0,
    blurPx: shadowBlurPx,
    opacity: +(shadowOpacity * 0.68).toFixed(2)
  };
  const contactPatches = isAirborne
    ? []
    : (Array.isArray(entry.customContactPatches) && entry.customContactPatches.length > 0
        ? entry.customContactPatches
        : buildContactPatchesForMode(bodyProf.contactMode, sizeCat.shadowScaleMult));

  const contactPatchGeometry = {
    contactMode: isAirborne ? 'NONE' : bodyProf.contactMode,
    hasGroundContact: !isAirborne,
    patchCount: contactPatches.length,
    detachedShadowGapPx: isAirborne ? airborneGapPx : 0,
    groundPlaneTopPct: ambientPatch.topPct,
    patches: contactPatches
  };

  // 6. HUD Clearance & Wide-Silhouette Safety Metrics (Focus Areas 5, 6, 7)
  const topHudReservePx = Math.round(vpH * 0.085);
  const bottomDeckReservePx = Math.round(vpH * 0.18);
  const floorPixelY = Math.round((groundContactY / 100) * vpH);
  const topCrownPixelY = floorPixelY - visibleHeightPx + verticalOffsetPx;
  const crownClearancePx = Math.max(8, topCrownPixelY - topHudReservePx);
  const footAboveBottomDeckPx = Math.max(8, (vpH - bottomDeckReservePx) - floorPixelY + 24);
  const effectiveAspectRatio = +(visibleWidthPx / Math.max(1, visibleHeightPx)).toFixed(3);
  const aspectRatioDrift = +Math.abs(effectiveAspectRatio - bodyProf.aspectRatio).toFixed(3);
  const isWideSilhouette = bodyProf.aspectRatio >= 1.20;
  const horizontalClearancePx = Math.max(0, vpW - visibleWidthPx);

  // 7. Card Mode Fallback Styling (Focus Area 9)
  const cardAspectRatio = effectiveAspectRatio;
  const vignetteTrimScale = imageTrimScale;
  const cardFrameStyle = {
    mode: effectivePresentationMode,
    borderRadiusPx: sizeCat.order <= 3 ? 8 : (sizeCat.order >= 6 ? 12 : 10),
    borderWidthPx: sizeCat.order >= 6 ? 2 : 1.5,
    innerVignetteInsetPx: Math.round(clamp(visibleHeightPx * 0.06, 8, 24)),
    objectFit: effectivePresentationMode === 'INTEGRATED' ? 'contain' : 'cover',
    objectPositionXPct: +(50 + imageShiftXPct).toFixed(2),
    objectPositionYPct: +(50 + imageShiftYPct).toFixed(2),
    cardAspectRatio,
    vignetteTrimScale,
    sizeTierAccent: sizeCat.order >= 6 ? 'HEAVY_ORNATE_GOLD' : (sizeCat.order <= 3 ? 'COMPACT_IRON' : 'STANDARD_BRONZE'),
    shadowGrounding: isAirborne ? 'DETACHED_FLOAT_SHADOW' : 'ANCHORED_CARD_PEDESTAL',
    fallbackReason
  };

  // 8. Legacy Uniform Scale comparison metrics (Before vs. After)
  // Legacy Card mode used clamp(125px, 23vh, 250px) square box
  const legacyBoxPx = Math.round(clamp(vpH * 0.23, 125, 250));
  const legacyVisibleHeightPx = Math.round(legacyBoxPx * cHRatio);
  const heightDeltaPct = Math.round(((visibleHeightPx - legacyBoxPx) / legacyBoxPx) * 100);
  const areaDeltaPct = Math.round((((visibleWidthPx * visibleHeightPx) - (legacyBoxPx * legacyBoxPx)) / (legacyBoxPx * legacyBoxPx)) * 100);

  return {
    monsterId: entry.id,
    monsterName: entry.name,
    monsterSlug: entry.slug,
    pfSizeCategory: pfSizeKey,
    pfSizeLabel: sizeCat.label,
    pfSizeOrder: sizeCat.order,
    pfSpaceFt: sizeCat.pfSpaceFt,
    visualBodyProfile: entry.visualBodyProfile,
    visualBodyProfileLabel: bodyProf.label,
    bodyProportions: entry.bodyProportions,
    proposedScaleFactor: entry.proposedScaleFactor,
    effectiveScaleFactor: +(visibleHeightPx / (vpH * 0.285)).toFixed(3),
    presentationMode: effectivePresentationMode,
    requestedPresentationMode: presentationMode,
    fallbackReason,
    cardAspectRatio,
    vignetteTrimScale,
    cardFrameStyle,
    viewport: {
      width: vpW,
      height: vpH,
      virtualDistanceFt,
      encounterDistanceBand: distanceBand.key,
      encounterDistanceStage: distanceBand.stage
    },
    sceneCalibration,
    visibleHeightPx,
    visibleWidthPx,
    containerHeightPx,
    containerWidthPx,
    aspectRatio: effectiveAspectRatio,
    contentBounds: bounds,
    transparencyCompensation: {
      contentWidthRatio: cWRatio,
      contentHeightRatio: cHRatio,
      imageTrimScale,
      imageShiftXPct,
      imageShiftYPct,
      bottomPadCompensationPx
    },
    positioning: {
      groundingMode: bodyProf.groundingMode,
      isAirborne,
      footContactY,
      groundContactY,
      verticalOffsetPx,
      airborneLiftPx,
      airborneHoverAltitudePx,
      airborneGapPx,
      groundSinkPx: isAirborne ? 0 : baseGroundedSinkPx,
      perspectiveHorizonShiftPx,
      footAnchorRatio,
      contactMode: isAirborne ? 'NONE' : bodyProf.contactMode
    },
    shadow: {
      shadowWidthPx,
      shadowHeightPx,
      shadowWidthPct,
      shadowBlurPx,
      shadowOpacity,
      ambientPatch,
      contactPatches,
      contactPatchGeometry
    },
    clamping: {
      wasClamped,
      clampRatio: +clampRatio.toFixed(3),
      heightClampEngaged,
      widthClampEngaged,
      minFloorEngaged,
      rawVisibleHeightPx,
      rawVisibleWidthPx,
      kneeSafeHeightPx,
      maxSafeHeightPx,
      maxSafeWidthPx,
      minSafeHeightPx,
      effectiveMinHeightPx,
      isWideSilhouette,
      targetAspectRatio: bodyProf.aspectRatio,
      effectiveAspectRatio,
      aspectRatioDrift,
      horizontalClearancePx,
      crownClearancePx,
      footAboveBottomDeckPx
    },
    cutoutAssetContract: {
      ...CUTOUT_ASSET_CONTRACT,
      hasVerifiedCutout,
      cutoutImagePath: entry.cutoutImagePath || null,
      footAnchorRatio,
      activePresentationMode: effectivePresentationMode,
      fallbackReason
    },
    legacyComparison: {
      legacyBoxPx,
      legacyVisibleHeightPx,
      heightDeltaPct,
      areaDeltaPct
    },
    isFallbackMetadata: Boolean(entry.isFallbackMetadata),
    verificationStatus: entry.verificationStatus,
    manualOverrideFlag: entry.manualOverrideFlag || null
  };
}

/**
 * Focus Area 3 — Transition from Distant Encounters to Melee Range
 * Computes coordinated distant sighting scale (18–20 ft), closing scale (16 ft),
 * and melee engagement scale (12 ft) along with GPU-friendly CSS transition parameters.
 */
function computeEncounterDistanceTransition(monsterOrKey, options = {}) {
  const entry = lookupMonsterSizeEntry(monsterOrKey);
  const fromDistanceFt = clamp(Number(options.fromDistanceFt || options.distantFt || 20), 14, 30);
  const toDistanceFt = clamp(Number(options.toDistanceFt || options.meleeFt || 12), 6, 16);
  const closingDistanceFt = +(fromDistanceFt * 0.5 + toDistanceFt * 0.5).toFixed(1);

  const distantScale = computeAdaptiveMonsterVisualScale(entry, {
    ...options,
    virtualDistanceFt: fromDistanceFt,
    encounterDistanceStage: 'DISTANT'
  });
  const closingScale = computeAdaptiveMonsterVisualScale(entry, {
    ...options,
    virtualDistanceFt: closingDistanceFt,
    encounterDistanceStage: 'CLOSING'
  });
  const meleeScale = computeAdaptiveMonsterVisualScale(entry, {
    ...options,
    virtualDistanceFt: toDistanceFt,
    encounterDistanceStage: 'MELEE'
  });

  const scaleRatio = +(distantScale.visibleHeightPx / Math.max(1, meleeScale.visibleHeightPx)).toFixed(3);
  const widthScaleRatio = +(distantScale.visibleWidthPx / Math.max(1, meleeScale.visibleWidthPx)).toFixed(3);
  const growthMultiplier = +(meleeScale.visibleHeightPx / Math.max(1, distantScale.visibleHeightPx)).toFixed(3);

  const translateYDeltaPx = Math.round(
    (distantScale.positioning.perspectiveHorizonShiftPx || 0) -
    (meleeScale.positioning.perspectiveHorizonShiftPx || 0)
  );
  const groundContactYDeltaPct = +(
    distantScale.positioning.groundContactY - meleeScale.positioning.groundContactY
  ).toFixed(2);

  const sizeOrder = meleeScale.pfSizeOrder || 5;
  const defaultDurationMs = meleeScale.positioning.isAirborne
    ? 390
    : (sizeOrder >= 6 ? 520 : (sizeOrder <= 3 ? 360 : 440));
  const durationMs = clamp(Number(options.durationMs || defaultDurationMs), 180, 1200);
  const easing = options.easing || 'cubic-bezier(0.22, 1, 0.36, 1)';

  return {
    monsterId: entry.id,
    monsterName: entry.name,
    monsterSlug: entry.slug,
    pfSizeCategory: meleeScale.pfSizeCategory,
    visualBodyProfile: meleeScale.visualBodyProfile,
    fromDistanceFt,
    closingDistanceFt,
    toDistanceFt,
    distantScale,
    closingScale,
    meleeScale,
    scaleRatio,
    widthScaleRatio,
    growthMultiplier,
    translateYDeltaPx,
    groundContactYDeltaPct,
    shadowBlurDeltaPx: distantScale.shadow.shadowBlurPx - meleeScale.shadow.shadowBlurPx,
    shadowOpacityDelta: +(meleeScale.shadow.shadowOpacity - distantScale.shadow.shadowOpacity).toFixed(2),
    durationMs,
    easing,
    cssTransition: `transform ${durationMs}ms ${easing}, filter ${durationMs}ms ease-out, opacity ${Math.round(durationMs * 0.6)}ms ease-out`,
    cssVars: {
      '--approach-start-scale': String(scaleRatio),
      '--approach-start-y': `${translateYDeltaPx}px`,
      '--approach-duration': `${durationMs}ms`,
      '--approach-easing': easing,
      '--monster-vis-w': `${meleeScale.visibleWidthPx}px`,
      '--monster-vis-h': `${meleeScale.visibleHeightPx}px`
    }
  };
}

/**
 * Focus Area 8 — Multi-Monster Scene Layout Engine (1 to 4 Creatures)
 * Computes depth-staggered horizontal/vertical slots (`slotXPercent`, `slotDepthFt`, `zIndex`, `individualScale`)
 * that prevent silhouette overlap and respect viewport margins across solo, pair, pack (3), and swarm (4) encounters.
 */
function computeMultiMonsterSceneLayout(monsters = [], options = {}) {
  const rawList = Array.isArray(monsters) ? monsters : (monsters ? [monsters] : []);
  const vpW = clamp(Number(options.viewportWidth || 1920), 640, 3840);
  const vpH = clamp(Number(options.viewportHeight || 1080), 480, 2160);
  const baseDistanceFt = resolveEncounterDistanceFt(options);
  const sceneCalibration = resolveScenePerspectiveCalibration(options);

  const marginRatio = clamp(
    Number(options.horizontalMarginRatio !== undefined ? options.horizontalMarginRatio : sceneCalibration.horizontalMarginRatio),
    0.05,
    0.20
  );
  const minStageLeftPx = Math.round(vpW * marginRatio);
  const maxStageRightPx = Math.round(vpW * (1 - marginRatio));
  const availStageWidthPx = Math.max(240, maxStageRightPx - minStageLeftPx);

  if (rawList.length === 0) {
    return {
      monsterCount: 0,
      truncatedFromCount: 0,
      formation: 'EMPTY',
      viewport: { width: vpW, height: vpH },
      sceneCalibration,
      groupFitScale: 1,
      hasSilhouetteOverlap: false,
      maxPairwiseOverlapPx: 0,
      withinViewportMargins: true,
      minStageLeftPx,
      maxStageRightPx,
      totalOccupiedWidthPx: 0,
      slots: [],
      backToFrontSlots: []
    };
  }

  const cappedList = rawList.slice(0, 4);
  const count = cappedList.length;

  // Depth-staggered formation templates by count (1 to 4 creatures)
  const formationTemplates = {
    1: {
      name: 'SOLO_CENTER',
      slots: [
        { role: 'PRIMARY', baseAnchorXRatio: 0.50, depthOffsetFt: 0.0, zIndex: 20 }
      ]
    },
    2: {
      name: 'STAGGERED_PAIR',
      slots: [
        { role: 'VANGUARD_LEFT',  baseAnchorXRatio: 0.35, depthOffsetFt: 0.0, zIndex: 22 },
        { role: 'FLANK_RIGHT',    baseAnchorXRatio: 0.65, depthOffsetFt: 2.5, zIndex: 18 }
      ]
    },
    3: {
      name: 'PACK_WEDGE_3',
      slots: [
        { role: 'FLANK_LEFT',     baseAnchorXRatio: 0.24, depthOffsetFt: 2.5, zIndex: 18 },
        { role: 'VANGUARD_CENTER',baseAnchorXRatio: 0.50, depthOffsetFt: 0.0, zIndex: 24 },
        { role: 'FLANK_RIGHT',    baseAnchorXRatio: 0.76, depthOffsetFt: 3.5, zIndex: 16 }
      ]
    },
    4: {
      name: 'STAGGERED_PACK_4',
      slots: [
        { role: 'OUTER_LEFT',     baseAnchorXRatio: 0.18, depthOffsetFt: 3.5, zIndex: 15 },
        { role: 'VANGUARD_LEFT',  baseAnchorXRatio: 0.39, depthOffsetFt: 0.0, zIndex: 24 },
        { role: 'VANGUARD_RIGHT', baseAnchorXRatio: 0.61, depthOffsetFt: 1.8, zIndex: 20 },
        { role: 'OUTER_RIGHT',    baseAnchorXRatio: 0.82, depthOffsetFt: 4.2, zIndex: 14 }
      ]
    }
  };

  const template = formationTemplates[count] || formationTemplates[4];

  // 1. Compute each creature's individual scale at its staggered slot depth
  const draftSlots = cappedList.map((m, idx) => {
    const tpl = template.slots[idx];
    const slotDepthFt = clamp(+(baseDistanceFt + tpl.depthOffsetFt).toFixed(1), 6, 30);
    const entry = lookupMonsterSizeEntry(m);
    const individualScale = computeAdaptiveMonsterVisualScale(entry, {
      ...options,
      viewportWidth: vpW,
      viewportHeight: vpH,
      virtualDistanceFt: slotDepthFt
    });
    return {
      slotIndex: idx,
      role: tpl.role,
      baseAnchorXRatio: tpl.baseAnchorXRatio,
      slotDepthFt,
      zIndex: tpl.zIndex,
      entry,
      individualScale,
      rawSlotWidthPx: individualScale.visibleWidthPx,
      rawSlotHeightPx: individualScale.visibleHeightPx,
      targetAspectRatio: individualScale.aspectRatio
    };
  });

  // 2. Compute minimum inter-silhouette gap and uniform group fit factor so silhouettes NEVER overlap
  // and NEVER overflow [minStageLeftPx, maxStageRightPx]
  const minGapPx = count <= 1 ? 0 : Math.max(14, Math.round(vpW * 0.016));
  const totalRawWidthsPx = draftSlots.reduce((acc, s) => acc + s.rawSlotWidthPx, 0);
  const requiredMinSpanPx = totalRawWidthsPx + Math.max(0, count - 1) * minGapPx;

  const groupFitScale = requiredMinSpanPx > availStageWidthPx
    ? +clamp((availStageWidthPx - Math.max(0, count - 1) * minGapPx) / Math.max(1, totalRawWidthsPx), 0.35, 1.0).toFixed(3)
    : 1.0;

  // Apply uniform groupFitScale while strictly preserving each creature's aspect ratio & relative size ordering
  for (const s of draftSlots) {
    if (groupFitScale < 0.999) {
      const scaledH = Math.max(24, Math.round(s.rawSlotHeightPx * groupFitScale));
      const scaledW = Math.max(24, Math.round(scaledH * (s.individualScale.clamping.targetAspectRatio || s.targetAspectRatio)));
      s.visibleHeightPx = scaledH;
      s.visibleWidthPx = scaledW;
    } else {
      s.visibleHeightPx = s.rawSlotHeightPx;
      s.visibleWidthPx = s.rawSlotWidthPx;
    }
  }

  // 3. Position slots horizontally across [minStageLeftPx, maxStageRightPx] with guaranteed >= minGapPx separation
  const totalScaledWidthsPx = draftSlots.reduce((acc, s) => acc + s.visibleWidthPx, 0);
  const totalMinGapsPx = Math.max(0, count - 1) * minGapPx;
  const slackPx = Math.max(0, availStageWidthPx - totalScaledWidthsPx - totalMinGapsPx);

  if (count === 1) {
    const s = draftSlots[0];
    const centerPx = Math.round((sceneCalibration.stageCenterX / 100) * vpW);
    const halfW = Math.round(s.visibleWidthPx / 2);
    const clampedCenterPx = clamp(centerPx, minStageLeftPx + halfW, maxStageRightPx - halfW);
    s.slotCenterXPx = clampedCenterPx;
    s.leftEdgePx = clampedCenterPx - halfW;
    s.rightEdgePx = s.leftEdgePx + s.visibleWidthPx;
    s.slotXPercent = +((clampedCenterPx / vpW) * 100).toFixed(2);
  } else {
    // Distribute slack proportionally around the formation's inner and outer padding
    const outerPadPx = Math.round(slackPx * 0.18);
    const innerSlackPx = Math.max(0, slackPx - outerPadPx * 2);
    const extraGapPerPairPx = Math.floor(innerSlackPx / (count - 1));
    const effectiveGapPx = minGapPx + extraGapPerPairPx;

    const totalClusterWidthPx = totalScaledWidthsPx + (count - 1) * effectiveGapPx;
    let cursorLeftPx = minStageLeftPx + Math.max(0, Math.floor((availStageWidthPx - totalClusterWidthPx) / 2));

    for (let i = 0; i < count; i++) {
      const s = draftSlots[i];
      s.leftEdgePx = cursorLeftPx;
      s.rightEdgePx = cursorLeftPx + s.visibleWidthPx;
      s.slotCenterXPx = Math.round(s.leftEdgePx + s.visibleWidthPx / 2);
      s.slotXPercent = +((s.slotCenterXPx / vpW) * 100).toFixed(2);
      cursorLeftPx = s.rightEdgePx + effectiveGapPx;
    }
  }

  // 4. Verify pairwise overlap & viewport margin compliance
  let maxPairwiseOverlapPx = 0;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const overlap = Math.max(
        0,
        Math.min(draftSlots[i].rightEdgePx, draftSlots[j].rightEdgePx) -
        Math.max(draftSlots[i].leftEdgePx, draftSlots[j].leftEdgePx)
      );
      if (overlap > maxPairwiseOverlapPx) maxPairwiseOverlapPx = overlap;
    }
  }
  const hasSilhouetteOverlap = maxPairwiseOverlapPx > 0;
  const withinViewportMargins = draftSlots.every(
    s => s.leftEdgePx >= minStageLeftPx - 1 && s.rightEdgePx <= maxStageRightPx + 1
  );

  const finalSlots = draftSlots.map(s => {
    const updatedIndividualScale = {
      ...s.individualScale,
      visibleWidthPx: s.visibleWidthPx,
      visibleHeightPx: s.visibleHeightPx,
      containerWidthPx: s.visibleWidthPx,
      containerHeightPx: s.visibleHeightPx,
      aspectRatio: +(s.visibleWidthPx / Math.max(1, s.visibleHeightPx)).toFixed(3),
      multiMonsterSlot: {
        slotIndex: s.slotIndex,
        role: s.role,
        slotXPercent: s.slotXPercent,
        slotCenterXPx: s.slotCenterXPx,
        leftEdgePx: s.leftEdgePx,
        rightEdgePx: s.rightEdgePx,
        slotDepthFt: s.slotDepthFt,
        zIndex: s.zIndex,
        groupFitScale
      }
    };

    return {
      slotIndex: s.slotIndex,
      role: s.role,
      monsterId: s.entry.id,
      monsterSlug: s.entry.slug,
      monsterName: s.entry.name,
      pfSizeCategory: s.individualScale.pfSizeCategory,
      pfSizeOrder: s.individualScale.pfSizeOrder,
      visualBodyProfile: s.individualScale.visualBodyProfile,
      slotXPercent: s.slotXPercent,
      slotCenterXPx: s.slotCenterXPx,
      leftEdgePx: s.leftEdgePx,
      rightEdgePx: s.rightEdgePx,
      slotDepthFt: s.slotDepthFt,
      groundContactY: s.individualScale.positioning.groundContactY,
      zIndex: s.zIndex,
      visibleWidthPx: s.visibleWidthPx,
      visibleHeightPx: s.visibleHeightPx,
      aspectRatio: updatedIndividualScale.aspectRatio,
      groupFitScale,
      individualScale: updatedIndividualScale
    };
  });

  const backToFrontSlots = [...finalSlots].sort((a, b) => {
    if (b.slotDepthFt !== a.slotDepthFt) return b.slotDepthFt - a.slotDepthFt;
    return a.zIndex - b.zIndex;
  });

  const totalOccupiedWidthPx = count > 0
    ? (finalSlots[count - 1].rightEdgePx - finalSlots[0].leftEdgePx)
    : 0;

  return {
    monsterCount: count,
    truncatedFromCount: rawList.length > 4 ? rawList.length : 0,
    formation: options.formation || template.name,
    viewport: { width: vpW, height: vpH },
    sceneCalibration,
    groupFitScale,
    minGapPx,
    hasSilhouetteOverlap,
    maxPairwiseOverlapPx,
    withinViewportMargins,
    minStageLeftPx,
    maxStageRightPx,
    totalOccupiedWidthPx,
    slots: finalSlots,
    backToFrontSlots
  };
}

/**
 * Focus Area 10 — Validate & Dynamically Register Cutout Asset Metadata (Tracks 4 & 5 Contract)
 */
function validateCutoutAssetMetadata(slug, cutoutMeta = {}) {
  const errors = [];
  const warnings = [];

  const cleanSlug = String(slug || (cutoutMeta && cutoutMeta.slug) || '').trim().toLowerCase();
  const entry = cleanSlug ? (BY_SLUG.get(cleanSlug) || BY_NAME.get(cleanSlug)) : null;
  if (!entry) {
    errors.push(`Unknown monster slug or name: "${slug}"`);
  }

  if (!cutoutMeta || typeof cutoutMeta !== 'object') {
    errors.push('cutoutMeta must be a non-null object');
    return {
      valid: false,
      slug: cleanSlug,
      errors,
      warnings,
      normalizedMeta: null,
      fallbackPresentation: 'CARD'
    };
  }

  const metrics = cutoutMeta.validationMetrics || cutoutMeta;
  const rawBounds =
    cutoutMeta.cutoutBounds ||
    cutoutMeta.cutoutContentBounds ||
    cutoutMeta.contentBounds ||
    (metrics && metrics.contentBounds) ||
    null;

  if (!rawBounds || typeof rawBounds !== 'object') {
    errors.push('Missing measured cutoutBounds / contentBounds object');
  } else {
    const cW = Number(rawBounds.contentWidthRatio);
    const cH = Number(rawBounds.contentHeightRatio);
    const topP = Number(rawBounds.topPadRatio !== undefined ? rawBounds.topPadRatio : 0.02);
    const botP = Number(rawBounds.bottomPadRatio !== undefined ? rawBounds.bottomPadRatio : 0.02);
    const leftP = Number(rawBounds.leftPadRatio !== undefined ? rawBounds.leftPadRatio : 0.02);
    const rightP = Number(rawBounds.rightPadRatio !== undefined ? rawBounds.rightPadRatio : 0.02);

    if (Number.isNaN(cW) || cW < CUTOUT_ASSET_CONTRACT.minContentWidthRatio || cW > CUTOUT_ASSET_CONTRACT.maxContentWidthRatio) {
      errors.push(`contentWidthRatio (${cW}) out of contract bounds [${CUTOUT_ASSET_CONTRACT.minContentWidthRatio}, ${CUTOUT_ASSET_CONTRACT.maxContentWidthRatio}]`);
    }
    if (Number.isNaN(cH) || cH < CUTOUT_ASSET_CONTRACT.minContentHeightRatio || cH > CUTOUT_ASSET_CONTRACT.maxContentHeightRatio) {
      errors.push(`contentHeightRatio (${cH}) out of contract bounds [${CUTOUT_ASSET_CONTRACT.minContentHeightRatio}, ${CUTOUT_ASSET_CONTRACT.maxContentHeightRatio}]`);
    }
    if (topP < 0 || botP < 0 || leftP < 0 || rightP < 0 ||
        topP > CUTOUT_ASSET_CONTRACT.maxPadRatio || botP > CUTOUT_ASSET_CONTRACT.maxPadRatio) {
      errors.push(`Padding ratios out of safe range [0, ${CUTOUT_ASSET_CONTRACT.maxPadRatio}]`);
    }
  }

  if (metrics.colorType !== undefined && Number(metrics.colorType) !== CUTOUT_ASSET_CONTRACT.requiredColorType) {
    errors.push(`Invalid PNG colorType (${metrics.colorType}); expected RGBA colorType === ${CUTOUT_ASSET_CONTRACT.requiredColorType}`);
  }
  if (metrics.transparentPixelRatio !== undefined) {
    const tpr = Number(metrics.transparentPixelRatio);
    if (Number.isNaN(tpr) || tpr < CUTOUT_ASSET_CONTRACT.minTransparentPixelRatio || tpr > CUTOUT_ASSET_CONTRACT.maxTransparentPixelRatio) {
      errors.push(`transparentPixelRatio (${tpr}) outside valid RGBA range [${CUTOUT_ASSET_CONTRACT.minTransparentPixelRatio}, ${CUTOUT_ASSET_CONTRACT.maxTransparentPixelRatio}]`);
    }
  }
  if (metrics.edgeTouchRatio !== undefined) {
    const etr = Number(metrics.edgeTouchRatio);
    if (Number.isNaN(etr) || etr > CUTOUT_ASSET_CONTRACT.maxEdgeTouchRatio) {
      errors.push(`edgeTouchRatio (${etr}) exceeds maximum non-cropped border threshold (${CUTOUT_ASSET_CONTRACT.maxEdgeTouchRatio})`);
    }
  }

  const targetSlug = entry ? entry.slug : cleanSlug;
  const rawPath = String(
    cutoutMeta.cutoutImageUrl ||
    cutoutMeta.cutoutImagePath ||
    cutoutMeta.cutoutPath ||
    `/lab-assets/images/monsters-cutout/${targetSlug}.png`
  ).trim();

  let normalizedImagePath = rawPath;
  if (rawPath.startsWith('action-ui-lab/public/images/monsters-cutout/')) {
    normalizedImagePath = '/lab-assets/images/monsters-cutout/' + rawPath.split('/').pop();
  } else if (rawPath.startsWith('public/images/monsters-cutout/')) {
    normalizedImagePath = '/lab-assets/images/monsters-cutout/' + rawPath.split('/').pop();
  } else if (!rawPath.startsWith('/lab-assets/images/monsters-cutout/')) {
    warnings.push(`Normalizing non-standard cutout path "${rawPath}" to /lab-assets/images/monsters-cutout/`);
    normalizedImagePath = `/lab-assets/images/monsters-cutout/${targetSlug}.png`;
  }

  if (!normalizedImagePath.endsWith('.png')) {
    errors.push(`Cutout asset path "${normalizedImagePath}" must be a .png file`);
  }

  const valid = errors.length === 0 && cutoutMeta.hasVerifiedCutout !== false && cutoutMeta.status !== 'CARD_FALLBACK_RETAINED';

  let normalizedMeta = null;
  if (rawBounds && entry) {
    const bW = Number(rawBounds.width || 1024);
    const bH = Number(rawBounds.height || 1024);
    const cWRatio = +clamp(Number(rawBounds.contentWidthRatio || 0.94), 0.22, 0.998).toFixed(3);
    const cHRatio = +clamp(Number(rawBounds.contentHeightRatio || 0.94), 0.22, 0.998).toFixed(3);
    const topPad = +clamp(Number(rawBounds.topPadRatio !== undefined ? rawBounds.topPadRatio : (1 - cHRatio) / 2), 0, 0.45).toFixed(3);
    const botPad = +clamp(Number(rawBounds.bottomPadRatio !== undefined ? rawBounds.bottomPadRatio : (1 - cHRatio) / 2), 0, 0.45).toFixed(3);
    const leftPad = +clamp(Number(rawBounds.leftPadRatio !== undefined ? rawBounds.leftPadRatio : (1 - cWRatio) / 2), 0, 0.45).toFixed(3);
    const rightPad = +clamp(Number(rawBounds.rightPadRatio !== undefined ? rawBounds.rightPadRatio : (1 - cWRatio) / 2), 0, 0.45).toFixed(3);

    const bodyProf = VISUAL_BODY_PROFILES[entry.visualBodyProfile] || VISUAL_BODY_PROFILES.BIPED_MEDIUM;
    const sizeCat = PF1E_SIZE_CATEGORIES[entry.pfSizeCategory] || PF1E_SIZE_CATEGORIES.MEDIUM;
    const isAirborne = Boolean(entry.isAirborne || bodyProf.groundingMode.startsWith('AIRBORNE') || entry.visualBodyProfile === 'FLOATING_ORB');

    normalizedMeta = {
      slug: entry.slug,
      cutoutImagePath: normalizedImagePath,
      cutoutContentBounds: {
        width: bW,
        height: bH,
        minX: Number(rawBounds.minX !== undefined ? rawBounds.minX : Math.round(bW * leftPad)),
        minY: Number(rawBounds.minY !== undefined ? rawBounds.minY : Math.round(bH * topPad)),
        maxX: Number(rawBounds.maxX !== undefined ? rawBounds.maxX : Math.round(bW * (1 - rightPad))),
        maxY: Number(rawBounds.maxY !== undefined ? rawBounds.maxY : Math.round(bH * (1 - botPad))),
        contentWidthRatio: cWRatio,
        contentHeightRatio: cHRatio,
        topPadRatio: topPad,
        bottomPadRatio: botPad,
        leftPadRatio: leftPad,
        rightPadRatio: rightPad
      },
      footAnchorRatio: isAirborne
        ? CUTOUT_ASSET_CONTRACT.defaultAirborneAnchorRatio
        : +clamp(1 - botPad, 0.84, 0.995).toFixed(3),
      contactPatches: Array.isArray(cutoutMeta.contactPatches)
        ? cutoutMeta.contactPatches
        : (isAirborne ? [] : buildContactPatchesForMode(bodyProf.contactMode, sizeCat.shadowScaleMult)),
      ambientPatch: cutoutMeta.ambientPatch || {
        leftPct: 50,
        topPct: isAirborne ? 114 : 94,
        widthPct: clamp(bodyProf.shadowWidthPct, 36, 98),
        heightPct: isAirborne ? 11 : 14,
        rotateDeg: 0,
        blurPx: Math.round(bodyProf.shadowBlurPx * (isAirborne ? 1.25 : 1.0)),
        opacity: +(bodyProf.shadowOpacity * 0.68).toFixed(2)
      }
    };
  }

  return {
    valid,
    slug: targetSlug,
    errors,
    warnings,
    normalizedMeta,
    fallbackPresentation: valid ? 'INTEGRATED' : 'CARD'
  };
}

function registerVerifiedCutoutMetadata(slug, cutoutMeta = {}) {
  const validation = validateCutoutAssetMetadata(slug, cutoutMeta);
  const cleanSlug = validation.slug;
  const entry = cleanSlug ? (BY_SLUG.get(cleanSlug) || BY_NAME.get(cleanSlug)) : null;

  if (!entry || !validation.valid || !validation.normalizedMeta) {
    return {
      ok: false,
      registered: false,
      slug: cleanSlug,
      validation,
      entry: entry || null,
      fallbackPresentation: 'CARD'
    };
  }

  const norm = validation.normalizedMeta;
  entry.hasCutout = true;
  entry.cutoutImagePath = norm.cutoutImagePath;
  entry.cutoutContentBounds = { ...norm.cutoutContentBounds };
  entry.imageContentBounds = { ...norm.cutoutContentBounds };
  if (Array.isArray(cutoutMeta.contactPatches)) {
    entry.customContactPatches = cutoutMeta.contactPatches;
  }

  const adaptiveScale = computeAdaptiveMonsterVisualScale(entry, {
    viewportWidth: 1920,
    viewportHeight: 1080,
    presentationMode: 'INTEGRATED'
  });

  const registeredProfile = {
    slug: entry.slug,
    hasIntegratedCutout: true,
    cutoutImageUrl: norm.cutoutImagePath,
    sizeCategory: entry.pfSizeCategory,
    groundingMode: adaptiveScale.positioning.groundingMode,
    scaleMultiplier: entry.proposedScaleFactor,
    verticalOffsetPx: adaptiveScale.positioning.verticalOffsetPx,
    airborneGapPx: adaptiveScale.positioning.airborneGapPx,
    shadowWidthPct: adaptiveScale.shadow.shadowWidthPct,
    shadowBlurPx: adaptiveScale.shadow.shadowBlurPx,
    shadowOpacity: adaptiveScale.shadow.shadowOpacity,
    ambientPatch: norm.ambientPatch,
    contactPatches: norm.contactPatches,
    footAnchorRatio: norm.footAnchorRatio
  };
  entry.registeredCutoutProfile = registeredProfile;

  return {
    ok: true,
    registered: true,
    slug: entry.slug,
    validation,
    entry,
    integratedProfile: registeredProfile,
    adaptiveScale,
    fallbackPresentation: 'INTEGRATED'
  };
}

function resetCutoutMetadataToBaseline(slug = null) {
  const targets = slug
    ? [lookupMonsterSizeEntry(slug)]
    : [...MONSTER_SIZE_CATALOG, ...PF1E_SIZE_REFERENCE_SPECIMENS];

  let restoredCount = 0;
  for (const item of targets) {
    if (!item || !item.slug) continue;
    const snap = BASELINE_CUTOUT_SNAPSHOTS.get(item.slug);
    if (!snap) continue;
    item.hasCutout = snap.hasCutout;
    item.cutoutImagePath = snap.cutoutImagePath;
    item.cutoutContentBounds = snap.cutoutContentBounds ? { ...snap.cutoutContentBounds } : null;
    item.imageContentBounds = snap.imageContentBounds ? { ...snap.imageContentBounds } : null;
    delete item.customContactPatches;
    delete item.registeredCutoutProfile;
    restoredCount++;
  }
  return { ok: true, restoredCount };
}

function ingestArtworkInventoryManifest(manifest) {
  const items = Array.isArray(manifest)
    ? manifest
    : (manifest && Array.isArray(manifest.monsters) ? manifest.monsters : []);
  let registeredCount = 0;
  let fallbackCount = 0;
  const results = [];

  for (const item of items) {
    if (!item || !item.slug) continue;
    if (item.hasVerifiedCutout && item.status !== 'CARD_FALLBACK_RETAINED') {
      const res = registerVerifiedCutoutMetadata(item.slug, item);
      if (res.registered) registeredCount++;
      else fallbackCount++;
      results.push(res);
    } else {
      fallbackCount++;
      results.push({
        ok: true,
        registered: false,
        slug: item.slug,
        fallbackPresentation: 'CARD'
      });
    }
  }

  return {
    ok: true,
    totalProcessed: results.length,
    registeredCount,
    fallbackCount,
    results
  };
}

/**
 * Phase 4 — Pre-configured Visual Comparison Lineups
 * All lineups use the exact same environment backdrop and virtual camera distance (12 ft).
 */
function buildVisualComparisonPresets(viewport = { width: 1920, height: 1080 }) {
  const makeLineup = (keys) => keys.map(k => {
    const entry = lookupMonsterSizeEntry(k);
    const adaptive = computeAdaptiveMonsterVisualScale(entry, {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      presentationMode: entry.hasCutout ? 'INTEGRATED' : 'CARD',
      virtualDistanceFt: 12
    });
    return {
      ...entry,
      adaptive
    };
  });

  return {
    sharedEnvironment: {
      sceneTitle: 'Old Crossroads Clearing [7, 5] — Facing North',
      sceneImageUrl: '/lab-assets/images/perspective/crossroads_7_5_north.jpg',
      virtualDistanceFt: 12,
      stageFloorY: 82,
      groundSurfaceType: 'forest-earth'
    },
    presets: {
      SIZE_PROGRESSION_5: {
        id: 'SIZE_PROGRESSION_5',
        title: '1. Pathfinder Size Progression (Tiny → Small → Medium → Large → Huge)',
        subtitle: 'Five Pathfinder 1e size tiers at identical 12-ft virtual distance on the Crossroads clearing.',
        specimens: makeLineup([
          'stirge',               // TINY (1 ft, 1 lb)
          'goblin',               // SMALL (3.2 ft, 35 lbs)
          'skeletal_champion',    // MEDIUM (6.1 ft, 95 lbs)
          'troll',                // LARGE (14 ft, 1,000 lbs)
          'ref_huge_elder_troll'  // HUGE (24 ft PF1e Huge reference specimen)
        ])
      },
      SAME_SIZE_MEDIUM_PROFILES: {
        id: 'SAME_SIZE_MEDIUM_PROFILES',
        title: '2. Medium Size — Anatomical Body Profile Differentiation',
        subtitle: 'All four creatures are official Pathfinder 1e MEDIUM (5-ft space), yet differ dramatically in height, width, and stance.',
        specimens: makeLineup([
          'skeletal_champion', // Upright Humanoid (6.1 ft tall, narrow)
          'ghoul',             // Crouched Undead (5.2 ft crouched, wider)
          'wolf',              // Low Quadruped (3.2 ft shoulder, horizontal body)
          'giant_spider',      // Wide Arachnid (2.5 ft low carapace, 5.5 ft wide legspan)
          'harpy'              // Airborne Winged Flyer (elevated hover + ground shadow)
        ])
      },
      SAME_SIZE_LARGE_PROFILES: {
        id: 'SAME_SIZE_LARGE_PROFILES',
        title: '3. Large Size — Anatomical Body Profile Differentiation',
        subtitle: 'All five creatures are official Pathfinder 1e LARGE (10-ft space), from 14-ft vertical giant to sprawling protoplasmic ooze.',
        specimens: makeLineup([
          'troll',          // Tall Brute Biped (14 ft tall)
          'manticore',      // Winged Large Predator (16-ft wingspan, airborne hover)
          'winter_wolf',    // Massive Quadruped (5.2 ft shoulder, 9 ft long)
          'assassin_vine',  // Rooted Plant Mass (10 ft vine mass)
          'ochre_jelly'     // Amorphous Ooze (3.8 ft low crest, 10 ft wide sprawl)
        ])
      },
      ALL_9_PF1E_TIERS: {
        id: 'ALL_9_PF1E_TIERS',
        title: '4. All 9 Pathfinder 1e Size Categories (Fine → Colossal)',
        subtitle: 'Complete 9-category Pathfinder 1e scale verifying tiny visibility and upper UI safety clamping.',
        specimens: makeLineup([
          'ref_fine_spore_mite',
          'ref_diminutive_toad',
          'viper',
          'kobold',
          'wolf',
          'troll',
          'ref_huge_elder_troll',
          'ref_gargantuan_wyrm',
          'ref_colossal_titan'
        ])
      }
    }
  };
}

function getCatalogAuditSummary() {
  const countsByPfSize = {};
  for (const key of Object.keys(PF1E_SIZE_CATEGORIES)) countsByPfSize[key] = 0;
  const countsByStatus = {};
  const countsByProfile = {};
  const manualOverrideMonsters = [];
  const uncertainOrSpecialMonsters = [];
  let verifiedCutoutCount = 0;

  for (const m of MONSTER_SIZE_CATALOG) {
    countsByPfSize[m.pfSizeCategory] = (countsByPfSize[m.pfSizeCategory] || 0) + 1;
    countsByStatus[m.verificationStatus] = (countsByStatus[m.verificationStatus] || 0) + 1;
    countsByProfile[m.visualBodyProfile] = (countsByProfile[m.visualBodyProfile] || 0) + 1;
    if (m.hasCutout) verifiedCutoutCount++;
    if (m.manualOverrideFlag) {
      manualOverrideMonsters.push({
        id: m.id,
        name: m.name,
        pfSizeCategory: m.pfSizeCategory,
        manualOverrideFlag: m.manualOverrideFlag,
        contentHeightRatio: m.cardContentBounds.contentHeightRatio,
        auditNotes: m.auditNotes
      });
    }
    if (m.verificationStatus !== 'VERIFIED_AONPRD') {
      uncertainOrSpecialMonsters.push({
        id: m.id,
        name: m.name,
        pfSizeCategory: m.pfSizeCategory,
        verificationStatus: m.verificationStatus,
        sourceUrl: m.sourceUrl,
        auditNotes: m.auditNotes
      });
    }
  }

  return {
    totalDatabaseMonsters: MONSTER_SIZE_CATALOG.length,
    coreMonstersCount: MONSTER_SIZE_CATALOG.filter(m => m.catalogBatch === 'CORE_68').length,
    expansionMonstersCount: MONSTER_SIZE_CATALOG.filter(m => m.catalogBatch === 'SEED_010_EXPANSION').length,
    supportedPfSizeCategoriesCount: Object.keys(PF1E_SIZE_CATEGORIES).length,
    verifiedCutoutCount,
    cardFallbackCount: MONSTER_SIZE_CATALOG.length - verifiedCutoutCount,
    countsByPfSize,
    countsByStatus,
    countsByProfile,
    manualOverrideMonsters,
    uncertainOrSpecialMonsters
  };
}

/**
 * Phase C (Track 5) — Safe Render-Mode & Asset Resolver
 * Resolves INTEGRATED vs CARD / BLEND / FRAMED mode for any monster, verifying
 * RGBA cutout metadata and (in Node.js) on-disk asset presence, with automatic
 * fallback to adaptive CARD mode if a cutout is absent, invalid, or fails to load.
 */
function resolveMonsterRenderMode(monsterOrKey, requestedMode = 'INTEGRATED', options = {}) {
  const entry = lookupMonsterSizeEntry(monsterOrKey);
  const rawMode = String(requestedMode || 'INTEGRATED').trim().toUpperCase();
  const normalizedRequestedMode = ['INTEGRATED', 'CARD', 'BLEND', 'FRAMED'].includes(rawMode)
    ? rawMode
    : 'INTEGRATED';

  const hasCatalogCutout = Boolean(entry && entry.hasCutout && entry.cutoutImagePath && entry.cutoutContentBounds);
  let existsOnDisk = hasCatalogCutout;

  if (options.cutoutExistsOnDisk !== undefined) {
    existsOnDisk = Boolean(options.cutoutExistsOnDisk);
  } else if (hasCatalogCutout && options.verifyDiskFile !== false && typeof require === 'function' && typeof window === 'undefined') {
    try {
      const fsMod = require('fs');
      const pathMod = require('path');
      const fileName = entry.cutoutImagePath.split('/').pop();
      const diskPath = pathMod.join(__dirname, 'public', 'images', 'monsters-cutout', fileName);
      existsOnDisk = fsMod.existsSync(diskPath);
    } catch (_e) {
      existsOnDisk = hasCatalogCutout;
    }
  }

  const simulateLoadError = Boolean(options.simulateLoadError);
  const hasVerifiedCutout = Boolean(hasCatalogCutout && existsOnDisk && !simulateLoadError);

  let activeMode = normalizedRequestedMode;
  let fallbackReason = null;

  if (normalizedRequestedMode === 'INTEGRATED') {
    if (!hasVerifiedCutout) {
      activeMode = 'CARD';
      if (simulateLoadError) {
        fallbackReason = 'CLIENT_IMAGE_LOAD_ERROR';
      } else if (hasCatalogCutout && !existsOnDisk) {
        fallbackReason = 'CUTOUT_FILE_MISSING_ON_DISK';
      } else if (entry && entry.hasCutout && !entry.cutoutContentBounds) {
        fallbackReason = 'MISSING_CUTOUT_BOUNDS_METADATA';
      } else {
        fallbackReason = 'NO_VERIFIED_RGBA_CUTOUT';
      }
    }
  } else if (normalizedRequestedMode === 'CARD') {
    fallbackReason = 'EXPLICIT_CARD_MODE_REQUESTED';
  }

  const adaptiveScale = computeAdaptiveMonsterVisualScale(entry, {
    ...options,
    presentationMode: activeMode === 'INTEGRATED' ? 'INTEGRATED' : 'CARD'
  });

  const cardImageUrl = entry.imagePath || `/images/monsters/${entry.slug}.png`;
  const cutoutImageUrl = hasVerifiedCutout ? entry.cutoutImagePath : null;
  const activeImageUrl = (activeMode === 'INTEGRATED' && cutoutImageUrl) ? cutoutImageUrl : cardImageUrl;

  return {
    monsterId: entry.id,
    monsterSlug: entry.slug,
    monsterName: entry.name,
    pfSizeCategory: adaptiveScale.pfSizeCategory,
    pfSizeLabel: adaptiveScale.pfSizeLabel,
    visualBodyProfile: entry.visualBodyProfile,
    requestedMode: normalizedRequestedMode,
    activeMode,
    defaultMode: hasVerifiedCutout ? 'INTEGRATED' : 'CARD',
    fallbackMode: 'CARD',
    didFallbackToCard: normalizedRequestedMode === 'INTEGRATED' && activeMode === 'CARD',
    fallbackReason,
    hasVerifiedCutout,
    existsOnDisk,
    cutoutStatus: entry.cutoutStatus || (hasVerifiedCutout ? 'VERIFIED_RGBA_CUTOUT' : 'CARD_FALLBACK_RETAINED'),
    cardImageUrl,
    cutoutImageUrl,
    activeImageUrl,
    supportedModes: hasVerifiedCutout
      ? ['INTEGRATED', 'CARD', 'BLEND', 'FRAMED']
      : ['CARD', 'BLEND', 'FRAMED'],
    contentBounds: adaptiveScale.contentBounds,
    cardContentBounds: entry.cardContentBounds,
    cutoutContentBounds: hasVerifiedCutout ? entry.cutoutContentBounds : null,
    positioning: adaptiveScale.positioning,
    shadow: adaptiveScale.shadow,
    cardFrameStyle: adaptiveScale.cardFrameStyle,
    adaptiveScale
  };
}

/**
 * Phase C (Track 5) — Monster Asset Manifest Builder & Accessor
 * Returns the complete structured asset manifest for all 98 database monsters
 * and 5 PF1e size reference specimens.
 */
function getMonsterAssetManifest(options = {}) {
  const existing7 = new Set(['assassin_vine', 'wolf', 'troll', 'ghoul', 'giant_spider', 'manticore', 'skeletal_champion']);

  const buildRecord = (m) => {
    const modeInfo = resolveMonsterRenderMode(m, 'INTEGRATED', options);
    const sc = modeInfo.adaptiveScale;
    const cutoutStatus = m.cutoutStatus || (modeInfo.hasVerifiedCutout
      ? (existing7.has(m.slug) ? 'EXISTING_APPROVED' : 'NEWLY_PRODUCED_VERIFIED')
      : 'CARD_FALLBACK_RETAINED');

    return {
      id: m.id,
      catalogOrder: m.catalogOrder || null,
      catalogBatch: m.catalogBatch || (m.isReferenceSpecimen ? 'REFERENCE_SPECIMEN' : 'CORE_68'),
      isReferenceSpecimen: Boolean(m.isReferenceSpecimen),
      isDemoProxy: Boolean(m.isDemoProxy || m.isReferenceSpecimen),
      proxyArtworkSource: m.proxyArtworkSource || null,
      slug: m.slug,
      name: m.name,
      creatureType: m.creatureType,
      challengeRating: m.challengeRating,
      pfSizeCategory: m.pfSizeCategory,
      pfSizeLabel: m.pfSizeLabel,
      pfSizeOrder: m.pfSizeOrder,
      pfSpaceFt: m.pfSpaceFt,
      visualBodyProfile: m.visualBodyProfile,
      visualBodyProfileLabel: m.visualBodyProfileLabel,
      bodyProportions: m.bodyProportions,
      proposedScaleFactor: m.proposedScaleFactor,
      isAirborne: Boolean(sc.positioning.isAirborne),
      groundingMode: sc.positioning.groundingMode,
      contactMode: sc.positioning.contactMode,
      verificationStatus: m.verificationStatus,
      manualOverrideFlag: m.manualOverrideFlag || null,
      sourceUrl: m.sourceUrl,
      cardAsset: {
        imagePath: m.imagePath,
        labAssetPath: `/lab-assets${m.imagePath}`,
        existsOnDisk: true,
        cardContentBounds: m.cardContentBounds
      },
      cutoutAsset: {
        hasVerifiedCutout: modeInfo.hasVerifiedCutout,
        status: cutoutStatus,
        cutoutImagePath: modeInfo.cutoutImageUrl,
        diskRelativePath: modeInfo.cutoutImageUrl
          ? `action-ui-lab/public/images/monsters-cutout/${m.slug}.png`
          : null,
        existsOnDisk: modeInfo.existsOnDisk,
        cutoutContentBounds: modeInfo.cutoutContentBounds,
        validationMetrics: m.cutoutValidationMetrics || null
      },
      renderContract: {
        defaultMode: modeInfo.defaultMode,
        activeMode: modeInfo.activeMode,
        fallbackMode: 'CARD',
        fallbackReason: modeInfo.fallbackReason,
        supportedModes: modeInfo.supportedModes,
        activeImageUrl: modeInfo.activeImageUrl,
        footAnchorRatio: sc.positioning.footAnchorRatio,
        cardAspectRatio: sc.cardAspectRatio,
        vignetteTrimScale: sc.vignetteTrimScale
      },
      integratedProfile: {
        hasIntegratedCutout: modeInfo.hasVerifiedCutout,
        cutoutImageUrl: modeInfo.cutoutImageUrl,
        sizeCategory: m.pfSizeCategory,
        groundingMode: sc.positioning.groundingMode,
        scaleMultiplier: m.proposedScaleFactor,
        verticalOffsetPx: sc.positioning.verticalOffsetPx,
        airborneGapPx: sc.positioning.airborneGapPx,
        shadowWidthPct: sc.shadow.shadowWidthPct,
        shadowBlurPx: sc.shadow.shadowBlurPx,
        shadowOpacity: sc.shadow.shadowOpacity,
        ambientPatch: sc.shadow.ambientPatch,
        contactPatches: sc.shadow.contactPatches
      }
    };
  };

  const monsters = MONSTER_SIZE_CATALOG.map(buildRecord);
  const referenceSpecimens = PF1E_SIZE_REFERENCE_SPECIMENS.map(buildRecord);

  const verifiedCutoutSlugs = monsters.filter(m => m.cutoutAsset.hasVerifiedCutout).map(m => m.slug);
  const cardFallbackSlugs = monsters.filter(m => !m.cutoutAsset.hasVerifiedCutout).map(m => m.slug);
  const existingApprovedCount = monsters.filter(m => m.cutoutAsset.status === 'EXISTING_APPROVED').length;
  const newlyProducedCount = monsters.filter(m => m.cutoutAsset.status === 'NEWLY_PRODUCED_VERIFIED').length;

  const countsByPfSize = {};
  const cutoutsByPfSize = {};
  for (const key of Object.keys(PF1E_SIZE_CATEGORIES)) {
    countsByPfSize[key] = 0;
    cutoutsByPfSize[key] = 0;
  }
  for (const m of monsters) {
    countsByPfSize[m.pfSizeCategory] = (countsByPfSize[m.pfSizeCategory] || 0) + 1;
    if (m.cutoutAsset.hasVerifiedCutout) {
      cutoutsByPfSize[m.pfSizeCategory] = (cutoutsByPfSize[m.pfSizeCategory] || 0) + 1;
    }
  }

  return {
    schemaVersion: '1.0.0',
    generatedBy: 'Track 5 — Monster Data & Asset Integration Lead',
    summary: {
      totalDatabaseMonsters: monsters.length,
      referenceSpecimensCount: referenceSpecimens.length,
      totalSpecimens: monsters.length + referenceSpecimens.length,
      verifiedCutoutCount: verifiedCutoutSlugs.length,
      existingApprovedCutoutCount: existingApprovedCount,
      newlyProducedCutoutCount: newlyProducedCount,
      cardFallbackCount: cardFallbackSlugs.length,
      cutoutCoveragePercent: +((verifiedCutoutSlugs.length / Math.max(1, monsters.length)) * 100).toFixed(1),
      countsByPfSize,
      cutoutsByPfSize,
      countsByRenderMode: {
        INTEGRATED: verifiedCutoutSlugs.length,
        CARD: cardFallbackSlugs.length
      },
      verifiedCutoutSlugs,
      cardFallbackSlugs
    },
    monsters,
    referenceSpecimens
  };
}

const MonsterSizeCatalogApi = {
  PF1E_SIZE_CATEGORIES,
  VISUAL_BODY_PROFILES,
  MONSTER_SIZE_CATALOG,
  PF1E_SIZE_REFERENCE_SPECIMENS,
  CORRIDOR_DEPTH_TYPES,
  SCENE_PERSPECTIVE_PROFILES,
  ENCOUNTER_DISTANCE_BANDS,
  CUTOUT_ASSET_CONTRACT,
  lookupMonsterSizeEntry,
  synthesizeFallbackMonsterSizeEntry,
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
  getCatalogAuditSummary,
  resolveMonsterRenderMode,
  getMonsterAssetManifest
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MonsterSizeCatalogApi;
}
if (typeof window !== 'undefined') {
  window.MonsterSizeCatalog = MonsterSizeCatalogApi;
}
