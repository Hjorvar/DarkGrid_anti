# Track 3 Report: Monster Size, Perspective & Scene Integration

**Author:** Track 3 — Monster Size, Perspective & Scene Integration Lead  
**Target Module:** [`action-ui-lab/monster-size-catalog.js`](../../monster-size-catalog.js)  
**Test Suite:** [`action-ui-lab/tests/monster-scaling.test.js`](../../tests/monster-scaling.test.js)  
**Baseline Compatibility:** 100% backwards-compatible with [`action-ui-lab/tests/action-lab.test.js`](../../tests/action-lab.test.js) and [`action-ui-lab/size-scaling-visual-qa.js`](../../size-scaling-visual-qa.js)

---

## 1. Executive Summary

Track 3 upgraded the Pathfinder 1e adaptive monster scaling engine in [`action-ui-lab/monster-size-catalog.js`](../../monster-size-catalog.js) from a single-monster, static-horizon melee calculator into a **scene-aware, multi-distance, multi-creature perspective and grounding system** while preserving 100% backwards compatibility with all existing APIs, 98 SQLite monsters, 5 reference specimens, 9 PF1e size categories (`FINE` through `COLOSSAL`), and 31 biological body profiles.

All **10 core focus areas** have been implemented and verified:

1. **Scene-Aware Perspective Calibration** (`CORRIDOR_DEPTH_TYPES`, `SCENE_PERSPECTIVE_PROFILES`, `resolveScenePerspectiveCalibration`)
2. **Virtual Distance Bands & Perspective Scaling** (`ENCOUNTER_DISTANCE_BANDS`, `resolveEncounterDistanceFt`)
3. **Distant-to-Melee Transition Helper** (`computeEncounterDistanceTransition`)
4. **Ground Contact & Floating Monster Separation** (`groundContactY`, `airborneHoverAltitudePx`, `contactPatchGeometry`)
5. **Wide Creature Handling** (aspect-ratio-locked width clamping across narrow corridors and viewports)
6. **Large / Huge / Gargantuan / Colossal Asymptotic UI Clamping** (crown/foot HUD safety with strict monotonic size hierarchy)
7. **Responsive Multi-Viewport Verification** (`1920×1080`, `1440×900`, `1280×800`, `1024×768`)
8. **Multi-Monster Scene Layout Engine** (`computeMultiMonsterSceneLayout` for 1–4 creatures with zero silhouette overlap)
9. **Clean `CARD` Fallback Behavior** (`cardFrameStyle`, `vignetteTrimScale`, `cardAspectRatio`, `fallbackReason`)
10. **Formal Cutout Asset Contract & Dynamic Registration** (`CUTOUT_ASSET_CONTRACT`, `validateCutoutAssetMetadata`, `registerVerifiedCutoutMetadata`, `ingestArtworkInventoryManifest`)

---

## 2. Scene-Aware Perspective Calibration (Focus Area 1)

Different adventure scenes have distinct horizon heights, corridor widths, and ground surfaces. `resolveScenePerspectiveCalibration(options)` resolves a scene perspective profile from `sceneId`, `corridorDepthType`, or `sceneTerrain`:

| Profile Key | Scene / Terrain Match | `stageFloorY` (%) | `vanishingPointY` (%) | `corridorWidthClampRatio` | `groundSinkScale` | `shadowSoftnessMult` |
|---|---|---|---|---|---|---|
| `FOREST_TUNNEL` | `mirkwood_trail`, `forest` | `82.0%` | `46.0%` | `0.48` | `1.00` | `1.05` |
| `BRIDGE_SPAN` | `old_stone_bridge`, `bridge`, `road` | `80.5%` | `44.0%` | `0.44` | `0.45` | `0.82` |
| `MIRE_BASIN` | `deadmans_mire`, `swamp`, `marsh` | `83.5%` | `48.0%` | `0.54` | `1.45` | `1.28` |
| `RUIN_COURT` | `watchpost_ruins`, `ruins`, `dungeon` | `81.5%` | `45.0%` | `0.50` | `0.70` | `0.95` |
| `OPEN_EXPANSE` | `plains`, `hills`, `mountains`, `desert` | `82.5%` | `47.0%` | `0.58` | `0.90` | `1.00` |

- **Hard Stone vs. Soft Mire Grounding:** On the Old Stone Bridge (`groundSinkScale = 0.45`), grounded monsters sit firmly atop the flagstones with crisp shadows (`shadowSoftnessMult = 0.82`). In Deadman's Mire (`groundSinkScale = 1.45`), grounded creatures sink deeper into the boggy mud with diffused contact shadows (`shadowSoftnessMult = 1.28`).
- **Default Baseline Preservation:** When `computeAdaptiveMonsterVisualScale` is called without explicit scene options (`sceneId`, `corridorDepthType`, `sceneTerrain`), `isCustomSceneCalibrated` remains `false` and uses the exact baseline values (`stageFloorY = 82%`, `corridorWidthClampRatio = 0.48`, `groundSinkScale = 1.0`, `shadowSoftnessMult = 1.0`).

---

## 3. Virtual Distance Bands & Distant-to-Melee Transitions (Focus Areas 2 & 3)

### 3.1 Encounter Distance Bands (`ENCOUNTER_DISTANCE_BANDS`)

| Band Key | Virtual Distance (`ft`) | Perspective Ratio (`12 / d`) | Horizon Shift (`perspectiveHorizonShiftPx`) | Role |
|---|---|---|---|---|
| `DISTANT_SIGHTING` | `20 ft` | `0.60×` | `-22 px` (recedes toward vanishing point) | Initial atmospheric spotting / scouting |
| `RANGED_ENGAGEMENT` | `16 ft` | `0.75×` | `-11 px` | Bow / spell / closing distance |
| `MELEE_ENGAGEMENT` | `12 ft` | `1.00×` | `0 px` (baseline combat plane) | Standard melee clash |
| `CLOSE_PRESS` | `9 ft` | `1.33×` | `+6 px` (looms into foreground) | Grapple / overwhelming press |

### 3.2 Distant-to-Melee Transition Engine (`computeEncounterDistanceTransition`)

`computeEncounterDistanceTransition(monsterOrKey, options)` computes coordinated keyframes for smooth CSS/JS animations when closing from sighting (`20 ft`) through ranged (`16 ft`) to melee (`12 ft`):

- Returns `distantScale` (`20 ft`), `closingScale` (`16 ft`), and `meleeScale` (`12 ft`) complete scale objects.
- Computes `scaleRatio` (`meleeHeightPx / distantHeightPx`), `inverseStartScale` (`distantHeightPx / meleeHeightPx`), `translateYDeltaPx`, `shadowScaleRatio`, and size-weighted `durationMs` (heavier/larger creatures take slightly longer to lumber into melee).
- Emits ready-to-apply `cssKeyframes.from` and `cssKeyframes.to` plus `cssTransition` string.

---

## 4. Ground Contact vs. Airborne Separation (Focus Area 4)

Every call to `computeAdaptiveMonsterVisualScale` now returns explicit grounding and elevation metrics:

- **`groundContactY` (%):** Exact viewport Y percentage where the creature's ground shadow and contact patch rest on the corridor floor (shifted toward the vanishing point when at range).
- **`airborneHoverAltitudePx` (px):** Vertical pixel separation between the creature's lowest visual extremity and its ground shadow:
  - Grounded creatures (`isAirborne === false`): `airborneHoverAltitudePx === 0`.
  - Airborne creatures (`AIRBORNE_HOVER`, `AIRBORNE_LOW_FLUTTER`, `FLOATING_ORB`): positive pixel altitude (`>= 6 px`), with softened, lower-opacity ground shadows (`shadowOpacity < 0.55`, `shadowBlurPx >= 12 px`).
- **`contactPatchGeometry`:** Structured ellipse geometry (`centerXPercent`, `centerYPercent`, `widthPx`, `heightPx`, `blurPx`, `opacity`, `isDetachedAirborneShadow`, `surfaceType`) for rendering ground contact shadows on canvas or DOM layers.

---

## 5. Wide Creature Handling & Large/Colossal Soft-Knee Clamping (Focus Areas 5 & 6)

- **Wide Creature Safety:** Wide body profiles (`ARACHNID_WIDE`, `ARACHNID_CHITIN_LARGE`, `AMORPHOUS_LARGE_OOZE`, `WINGED_LARGE_PREDATOR`, `SERPENTINE_COILED`, `QUADRUPED_LOW`, `QUADRUPED_HEAVY`) are bounded by `maxSafeWidthPx = vpW * corridorWidthClampRatio * wideSafetyFactor`. Whenever width clamping activates, `targetHeightPx = Math.round(targetWidthPx / aspectRatio)` is recomputed so `renderedAspectRatio` remains within `±0.02` of the natural `aspectRatio` (zero horizontal squishing).
- **Soft-Knee Asymptotic Clamping (`LARGE` to `COLOSSAL`):**
  - `LARGE` (`370 px` at `1080p`), `HUGE` (`451 px`), `GARGANTUAN` (`512 px`), and `COLOSSAL` (`560 px`) follow a smooth logarithmic knee below `maxSafeHeightPx` (`572 px` at `1080p`), guaranteeing at least `11%` top crown HUD clearance and `12%` bottom action bar clearance while maintaining strict monotonic differentiation (`FINE < DIMINUTIVE < TINY < SMALL < MEDIUM < LARGE < HUGE < GARGANTUAN < COLOSSAL`).

---

## 6. Multi-Viewport Verification Summary (Focus Area 7)

All 9 PF1e size categories and all 98 DB monsters were verified across `1920×1080`, `1440×900`, `1280×800`, and `1024×768`:

| Size Category | Representative Specimen | `1920×1080` (`12 ft`) | `1440×900` (`12 ft`) | `1280×800` (`12 ft`) | `1024×768` (`12 ft`) |
|---|---|---|---|---|---|
| `FINE` (`0`) | Cave Leech Swarm (`ref_fine_parasite`) | `55×55 px` | `48×48 px` | `48×48 px` | `42×42 px` |
| `DIMINUTIVE` (`1`) | Toad (`toad`) | `79×67 px` | `66×56 px` | `59×50 px` | `56×48 px` |
| `TINY` (`2`) | Viper (`viper`) | `111×94 px` | `92×78 px` | `82×70 px` | `79×67 px` |
| `SMALL` (`3`) | Goblin (`goblin`) | `190×133 px` | `158×111 px` | `141×99 px` | `135×95 px` |
| `MEDIUM` (`4`) | Orc (`orc`) | `275×206 px` | `229×172 px` | `204×153 px` | `195×146 px` |
| `LARGE` (`5`) | Ogre (`ogre`) | `370×315 px` | `308×262 px` | `274×233 px` | `263×224 px` |
| `HUGE` (`6`) | Treant (`treant`) | `451×383 px` | `376×320 px` | `334×284 px` | `321×273 px` |
| `GARGANTUAN` (`7`) | Ancient Mire Leviathan (`ref_gargantuan_leviathan`) | `512×486 px` | `426×405 px` | `379×360 px` | `364×346 px` |
| `COLOSSAL` (`8`) | World-Root Behemoth (`ref_colossal_titan`) | `560×588 px` | `467×490 px` | `415×436 px` | `398×418 px` |

---

## 7. Multi-Monster Scene Layout Engine (Focus Area 8)

`computeMultiMonsterSceneLayout(monsters, options)` computes coordinated horizontal and depth-staggered slots for `1` to `4` monsters in a single encounter:

- **1 Monster:** Centered at `50%` X, `0 ft` depth offset (`zIndex = 20`).
- **2 Monsters (`FLANKING_PAIR`):** Left-flank (`36%` X, `+1.2 ft` depth) and right-vanguard (`64%` X, `-0.6 ft` depth).
- **3 Monsters (` STAGGERED_WEDGE`):** Vanguard center (`50%` X, `-0.8 ft` depth, `zIndex = 30`) flanked by left (`28%` X, `+2.0 ft` depth) and right (`72%` X, `+1.4 ft` depth) rear support.
- **4 Monsters (`ECHELON_LINE`):** Staggered line at `22%`, `41%`, `60%`, and `78%` X with alternating depth offsets (`+2.4 ft`, `-0.4 ft`, `+1.4 ft`, `-0.8 ft`).
- **Automatic Anti-Overlap Solver:** Computes actual pixel bounding boxes (`boundingBox.leftPx`, `rightPx`, `topPx`, `bottomPx`) and iteratively separates any overlapping adjacent silhouettes while clamping `individualScale` so `silhouetteOverlapCount === 0` across all viewports.

---

## 8. Clean `CARD` Fallback Behavior (Focus Area 9)

For any monster whose asset is still an opaque square portrait (`renderMode === 'CARD'`), `computeAdaptiveMonsterVisualScale` returns explicit card presentation metadata:

- `cardFrameStyle`: `'ORNATE_VIGNETTE_PORTRAIT'`
- `vignetteTrimScale`: `0.86` (scales down square card area by 14% so an opaque box never visually outweighs a transparent cutout of the same PF1e size category)
- `cardAspectRatio`: `0.82` (standard portrait frame proportion)
- `fallbackReason`: `'UNVERIFIED_CUTOUT_METADATA'` or `'OPAQUE_PORTRAIT_SOURCE'`

---

## 9. Formal Cutout Asset Contract for Tracks 4 & 5 (Focus Area 10)

Tracks 4 (Asset Pipeline / Background Removal) and Track 5 (UI Integration) can inspect `CUTOUT_ASSET_CONTRACT` and register newly processed transparent PNG/WebP cutouts at runtime without modifying catalog source code:

### 9.1 Required Metadata Schema (`CUTOUT_ASSET_CONTRACT`)

| Field | Type | Constraints / Values | Description |
|---|---|---|---|
| `slug` | `string` | Non-empty monster slug (`^[a-z0-9_]+$`) | Canonical monster identifier |
| `renderMode` | `string` | `'CUTOUT'` \| `'CARD'` | Rendering mode (`CUTOUT` requires `hasAlphaChannel: true`) |
| `hasAlphaChannel` | `boolean` | `true` for `CUTOUT` | Whether perimeter pixels have true alpha transparency (`alpha <= 8`) |
| `trimmedAspectRatio` | `number` | `0.25 <= ratio <= 3.20` | Width-to-height ratio of non-transparent silhouette (`trimmedWidth / trimmedHeight`) |
| `opaqueFillRatio` | `number` | `0.08 <= ratio <= 0.94` | Ratio of non-transparent pixels inside the trimmed bounding box |
| `feetPadRatio` | `number` | `0.00 <= ratio <= 0.35` | Transparent bottom padding ratio below lowest opaque foot/base pixel |
| `crownPadRatio` | `number` | `0.00 <= ratio <= 0.35` | Transparent top padding ratio above highest opaque crown pixel |
| `sourcePath` | `string` | Optional string | Relative or public URL path to the verified cutout asset |

### 9.2 Registration & Ingestion APIs

- `validateCutoutAssetMetadata(metadata)`: Validates a metadata object against `CUTOUT_ASSET_CONTRACT` and returns `{ valid, errors, normalized }`.
- `registerVerifiedCutoutMetadata(slug, metadata)`: Validates and registers a single monster's cutout metadata in memory, immediately switching `resolveMonsterSizeProfile(slug)` and `computeAdaptiveMonsterVisualScale(slug)` to `CUTOUT` mode with the asset's exact `trimmedAspectRatio` and `feetPadRatio`.
- `ingestArtworkInventoryManifest(manifest)`: Batch-ingests a JSON manifest array or `{ monsters: { ... } }` map exported by Track 4's image pipeline, returning `{ registeredCount, rejectedCount, errors }`.
- `resetCutoutMetadataToBaseline()`: Clears runtime overrides and restores the baseline catalog state.

---

## 10. Verification & Automated Test Results

- **New Dedicated Test Suite:** [`action-ui-lab/tests/monster-scaling.test.js`](../../tests/monster-scaling.test.js) tests all 10 focus areas across all 98 SQLite monsters and 5 reference specimens.
- **Regression Suite:** [`action-ui-lab/tests/action-lab.test.js`](../../tests/action-lab.test.js) (32/32 tests passing).
