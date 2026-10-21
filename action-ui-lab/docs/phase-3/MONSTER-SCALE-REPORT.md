# Darkgrid Adventure Lab — Phase 3: Monster Scale Report

**Date**: 2026-10-21  
**Scope**: `action-ui-lab/` (`monster-size-catalog.js`, `server/services/monster-profile-service.js`, `public/js/combat/size-arena.js`, `public/js/combat/combat-ui.js`, `public/css/combat.css`)  
**Worktree**: `monster_scale_combat_presentation` (branched from `darkgrid_overnight_development`)

---

## 1. Executive Summary

Phase 3 establishes and verifies a complete, data-driven **Visual Scale Engine** across all **98 database monsters** (`68` Core + `30` Seed-010 Expansion) and **5 Pathfinder 1e reference specimens** (`103` total specimens) in `action-ui-lab/`.

Every monster's rendered size on screen is dynamically computed from:
1. **Pathfinder 1e Size Category (`pfSizeCategory`)**: All 9 official tiers (`FINE`, `DIMINUTIVE`, `TINY`, `SMALL`, `MEDIUM`, `LARGE`, `HUGE`, `GARGANTUAN`, `COLOSSAL`).
2. **Anatomical Visual Body Profile (`visualBodyProfile`)**: 25 distinct body profiles accounting for upright bipeds, low quadrupeds, wide arachnids, coiled serpents, sprawling oozes, rooted plant masses, and airborne winged flyers.
3. **Virtual Camera Distance (`virtualDistanceFt`)**: Perspective scaling across `DISTANT_SIGHTING` (`20 ft`), `RANGED_ENGAGEMENT` (`16 ft`), `MELEE_ENGAGEMENT` (`12 ft`), and `CLOSE_PRESS` (`9 ft`).
4. **Scene Perspective & Corridor Calibration (`sceneCalibration`)**: Ground plane contact height (`stageFloorY`), camera horizon (`cameraHorizonY`), surface ground sink (`groundSinkScale`), and corridor width clamp (`OPEN_FIELD`, `FOREST_TRAIL`, `NARROW_BRIDGE`, `INTERIOR_RUIN`).
5. **Measured RGBA Content Bounds & Trim Compensation (`transparencyCompensation`)**: Eliminates empty transparent PNG margins or heavy dark card vignettes so creatures render at their true intended anatomical scale.
6. **Soft-Knee Asymptotic UI Safety Clamping (`clamping`)**: Guarantees strict monotonic size ordering (`Fine < Diminutive < Tiny < Small < Medium < Large < Huge < Gargantuan < Colossal`) while preventing `HUGE`/`GARGANTUAN`/`COLOSSAL` creatures from clipping the top HUD or bottom Chronicle bar.
7. **Deterministic Missing-Metadata Fallback (`synthesizeFallbackMonsterSizeEntry`)**: Automatically synthesizes complete, rule-consistent size and body-profile metadata when an uncataloged creature or partial monster object is encountered.

---

## 2. Database & Catalog Size Coverage

| PF1e Size Category | PF1e Space | Base Viewport Height (`vh`) | DB Monsters (`98`) | Reference Specimens (`5`) | Verified RGBA Cutouts (`37`) | Card Fallbacks (`61`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **FINE** | 0.5 ft | `6.8 vh` | 0 | 1 (`ref_fine_spore_mite`) | 0 | 0 (+1 ref) |
| **DIMINUTIVE** | 1.0 ft | `9.2 vh` | 0 | 1 (`ref_diminutive_toad`) | 0 | 0 (+1 ref) |
| **TINY** | 2.5 ft | `12.8 vh` | 4 (`stirge`, `viper`, `giant_rat`, `dire_rat`) | 0 | 2 (`stirge`, `viper`) | 2 |
| **SMALL** | 5.0 ft | `19.2 vh` | 12 (`goblin`, `kobold`, `mite`, `spriggan`, etc.) | 0 | 3 (`goblin`, `kobold`, `darkmantle`) | 9 |
| **MEDIUM** | 5.0 ft | `28.5 vh` | 53 (`wolf`, `skeletal_champion`, `ghoul`, `giant_spider`, `harpy`, `rust_monster`, `bugbear`, etc.) | 0 | 17 | 36 |
| **LARGE** | 10.0 ft | `39.5 vh` | 29 (`troll`, `ogre`, `minotaur`, `manticore`, `owlbear`, `wyvern`, `ochre_jelly`, `assassin_vine`, etc.) | 0 | 15 | 14 |
| **HUGE** | 15.0 ft | `47.5 vh` | 0 | 1 (`ref_huge_elder_troll`) | 0 | 0 (+1 ref) |
| **GARGANTUAN** | 20.0 ft | `53.0 vh` | 0 | 1 (`ref_gargantuan_wyrm`) | 0 | 0 (+1 ref) |
| **COLOSSAL** | 30.0 ft | `58.0 vh` | 0 | 1 (`ref_colossal_titan`) | 0 | 0 (+1 ref) |
| **Total** | — | — | **98** | **5** | **37 (37.8%)** | **61 (62.2%)** |

> **Dual-Size Support**: `Spriggan` (`SMALL` base -> `LARGE` Giant Form) dynamically scales via `overridePfSize: 'LARGE'` (`187 px` height in Small form -> `389 px` height in Large form at `1920×1080`).

---

## 3. Body Profile Differentiation Within the Same PF1e Size Category

A core requirement of Phase 3 is that **PF1e Size Category alone does not dictate identical visual height**. Creatures in the same size tier have markedly different silhouettes (`heightFactor` vs. `aspectRatio`):

### 3.1 Medium Size (`MEDIUM`, 5-ft Space) at `1920×1080` (12 ft Melee Distance)
| Monster | Visual Body Profile | Physical Proportions | Rendered Width × Height (`px`) | Aspect Ratio | Grounding Mode |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Bugbear** | `BIPED_TALL_WARRIOR` | 7.0 ft tall, upright stalker | `258 × 323 px` | `0.80` | `GROUNDED_BOOTS` |
| **Skeletal Champion** | `BIPED_MEDIUM` | 6.1 ft tall, upright warrior | `222 × 285 px` | `0.78` | `GROUNDED_BOOTS` |
| **Ghoul** | `BIPED_CROUCHED` | 5.2 ft crouched undead | `230 × 246 px` | `0.93` | `GROUNDED_CROUCH` |
| **Wolf** | `QUADRUPED_LOW` | 3.2 ft shoulder, 5.0 ft long | `248 × 198 px` | `1.25` | `GROUNDED_PAWS` |
| **Rust Monster** | `ARACHNID_WIDE` | 3.5 ft height, 5.5 ft wide | `265 × 187 px` | `1.42` | `GROUNDED_ARACHNID` |
| **Giant Spider** | `ARACHNID_WIDE` | 2.5 ft low carapace, 5.5 ft legspan | `265 × 187 px` | `1.42` | `GROUNDED_ARACHNID` |
| **Harpy** | `WINGED_HARPY_FLIER` | 5.4 ft tall, 11 ft wingspan | `316 × 268 px` | `1.18` | `AIRBORNE_HOVER` (`-34 px` lift) |

### 3.2 Large Size (`LARGE`, 10-ft Space) at `1920×1080` (12 ft Melee Distance)
| Monster | Visual Body Profile | Physical Proportions | Rendered Width × Height (`px`) | Aspect Ratio | Grounding Mode |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Troll** | `BIPED_LARGE_BRUTE` | 14.0 ft tall giant | `358 × 407 px` | `0.88` | `GROUNDED_HEAVY` |
| **Ogre** | `BIPED_LARGE_BRUTE` | 10.0 ft tall brute | `348 × 396 px` | `0.88` | `GROUNDED_HEAVY` |
| **Manticore** | `WINGED_LARGE_PREDATOR` | 9.5 ft body, 16.0 ft wingspan | `434 × 356 px` | `1.22` | `AIRBORNE_HOVER` (`-42 px` lift) |
| **Winter Wolf** | `QUADRUPED_MASSIVE` | 5.2 ft shoulder, 9.0 ft long | `395 × 299 px` | `1.32` | `GROUNDED_PAWS` |
| **Assassin Vine** | `PLANT_MASS_LARGE` | 10.0 ft rooted vine mass | `369 × 355 px` | `1.04` | `GROUNDED_ROOTED` |
| **Ochre Jelly** | `AMORPHOUS_LARGE_OOZE` | 3.8 ft low crest, 10.0 ft sprawl | `383 × 242 px` | `1.58` | `GROUNDED_OOZE` |

---

## 4. Missing-Data Fallback Resolution (`synthesizeFallbackMonsterSizeEntry`)

When an uncataloged monster or partial data object is passed to `lookupMonsterSizeEntry(monsterOrKey)`:
1. **Dimension & Size Inference (`inferPfSizeFromDimensionsOrText`)**:
   - Reads explicit `pfSizeCategory`, `size_category`, `sizeCategory`, or `size` if present.
   - Otherwise infers PF1e tier from `height`/`length` in feet (`<0.5` Fine, `<1.0` Diminutive, `<2.2` Tiny, `<4.2` Small, `<=8.2` Medium, `<=16.5` Large, `<=32.5` Huge, `<=64.5` Gargantuan, `>64.5` Colossal).
   - Otherwise checks creature name/type keywords (`tiny`, `small`, `large`, `giant`, `huge`, `gargantuan`, `colossal`).
   - Defaults safely to `MEDIUM` when no hints exist.
2. **Body Profile Inference (`inferVisualBodyProfileForFallback`)**:
   - Reads explicit `visualBodyProfile` or `visual_profile` if valid.
   - Otherwise inspects `is_flying` / `movement_type === 'FLYING'` and anatomical keywords (`spider`, `scorpion`, `snake`, `ooze`, `vine`, `wolf`, `hound`, `boar`, `bear`, `rat`, `bat`, `wyvern`, `dragon`) to select the matching size-appropriate `VISUAL_BODY_PROFILES` entry.
   - Defaults safely to `BIPED_SMALL` / `BIPED_MEDIUM` / `BIPED_LARGE_BRUTE`.
3. **Explicit Telemetry**:
   - Sets `isFallbackMetadata: true` and `verificationStatus: 'FALLBACK_DEFAULT'` on both the entry and the output of `computeAdaptiveMonsterVisualScale`.
