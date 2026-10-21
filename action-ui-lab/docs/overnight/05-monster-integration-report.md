# Track 5 — Monster Data & Asset Integration Report (Phase C)

**Role:** Track 5 — Monster Data & Asset Integration Lead  
**Phase:** Phase C (Integration)  
**Scope:** Strictly isolated inside `action-ui-lab/` (zero modifications to production `src/`, `db/`, `images/monsters/`, `public/images/monsters/`, or Firebase configuration).

---

## 1. Executive Summary

Track 5 unified the Pathfinder 1e Monster Size, Perspective & Multi-Monster Layout Engine (Track 3) with the Verified RGBA Cutout & Artwork Inventory (Track 4) across the server (`action-ui-lab/server.js`), shared catalog (`action-ui-lab/monster-size-catalog.js`), unified asset manifest (`action-ui-lab/monster-asset-manifest.json`), and first-person viewport client (`action-ui-lab/public/action-ui.js`).

### Key Integration Metrics
- **Total Database Monsters Integrated:** **98 / 98** (`68` Core + `30` Expansion `010_monster_expansion_30.sql`)
- **PF1e Size Reference Specimens Integrated:** **5 / 5** (`Fine`, `Diminutive`, `Huge`, `Gargantuan`, `Colossal`)
- **Total Cataloged Specimens:** **103**
- **Active Verified RGBA Cutouts (`INTEGRATED` Mode Default):** **37 / 98** (**37.8%**, up from 7 / 7.1% at baseline)
  - **7 Baseline Approved Cutouts (`EXISTING_APPROVED`):** `assassin_vine`, `wolf`, `troll`, `ghoul`, `giant_spider`, `manticore`, `skeletal_champion`
  - **30 Newly Produced Cutouts (`NEWLY_PRODUCED_VERIFIED`):** `rust_monster`, `kobold`, `goblin`, `human_skeleton`, `human_zombie`, `lizardfolk`, `gnoll`, `bugbear`, `giant_crab`, `ankheg`, `ogre`, `shadow`, `owlbear`, `minotaur`, `gargoyle`, `basilisk`, `mummy`, `ochre_jelly`, `winter_wolf`, `stirge`, `dire_rat`, `viper`, `orc`, `harpy`, `griffon`, `giant_scorpion`, `wraith`, `blood_hawk`, `will_o_wisp`, `wyvern`
- **Adaptive Card Fallbacks (`CARD` Mode Default):** **61 / 98** (**62.2%**) — every remaining monster renders in adaptive `CARD` mode with measured `cardContentBounds`, `vignetteTrimScale`, body-profile `cardAspectRatio`, and size-tier frame styling.
- **Cutout Coverage by Pathfinder 1e Size Category:**
  - **TINY:** `3 / 5` (`stirge`, `viper`, `blood_hawk`)
  - **SMALL:** `4 / 13` (`kobold`, `goblin`, `dire_rat`, `will_o_wisp`)
  - **MEDIUM:** `18 / 52` (`wolf`, `ghoul`, `giant_spider`, `rust_monster`, `human_skeleton`, `human_zombie`, `lizardfolk`, `gnoll`, `bugbear`, `giant_crab`, `shadow`, `gargoyle`, `basilisk`, `mummy`, `skeletal_champion`, `orc`, `harpy`, `wraith`)
  - **LARGE:** `12 / 28` (`assassin_vine`, `troll`, `manticore`, `ankheg`, `ogre`, `owlbear`, `minotaur`, `ochre_jelly`, `winter_wolf`, `griffon`, `giant_scorpion`, `wyvern`)

---

## 2. Deliverables & Files Updated

### 2.1 `action-ui-lab/monster-asset-manifest.json` (Created)
- Canonical machine-readable manifest covering all **98 database monsters** and **5 PF1e size reference specimens** (`schemaVersion: "1.0.0"`).
- Each monster entry provides:
  - `cardAsset`: `imagePath`, `labAssetPath`, `existsOnDisk`, and measured `cardContentBounds`.
  - `cutoutAsset`: `hasVerifiedCutout`, `status` (`EXISTING_APPROVED` | `NEWLY_PRODUCED_VERIFIED` | `CARD_FALLBACK_RETAINED`), `cutoutImagePath`, `diskRelativePath`, `existsOnDisk`, measured `cutoutContentBounds`, and `validationMetrics`.
  - `renderContract`: `defaultMode` (`INTEGRATED` vs `CARD`), `activeMode`, `fallbackMode` (`CARD`), `fallbackReason`, `supportedModes`, `activeImageUrl`, `footAnchorRatio`, `cardAspectRatio`, and `vignetteTrimScale`.
  - `integratedProfile`: `groundingMode`, `sizeCategory`, `scaleMultiplier`, `verticalOffsetPx`, `airborneGapPx`, `shadowWidthPct`, `shadowBlurPx`, `shadowOpacity`, `ambientPatch`, and anatomical `contactPatches`.

### 2.2 `action-ui-lab/monster-size-catalog.js` (Updated)
- Synchronized all 98 entries in `MONSTER_SIZE_CATALOG` with Track 4's verified RGBA cutout bounds (`hasCutout: true`, `cutoutImagePath`, `cutoutContentBounds`, `imageContentBounds`, `cutoutStatus`, `cutoutValidationMetrics` for all 37 cutouts) while preserving `cardContentBounds` for `CARD` mode.
- Added `resolveMonsterRenderMode(monsterOrKey, requestedMode, options)`:
  - Resolves `INTEGRATED`, `CARD`, `BLEND`, and `FRAMED` presentation modes.
  - Verifies on-disk cutout existence in Node.js (`options.verifyDiskFile !== false`) and supports fault-injection options (`cutoutExistsOnDisk: false`, `simulateLoadError: true`) for testing automatic fallback.
  - Automatically falls back to adaptive `CARD` mode with explicit `fallbackReason` (`NO_VERIFIED_RGBA_CUTOUT`, `CUTOUT_FILE_MISSING_ON_DISK`, `CLIENT_IMAGE_LOAD_ERROR`, `MISSING_CUTOUT_BOUNDS_METADATA`, or `EXPLICIT_CARD_MODE_REQUESTED`).
- Added `getMonsterAssetManifest(options)` returning the complete live manifest and summary statistics.

### 2.3 `action-ui-lab/server.js` (Updated)
- Expanded `INTEGRATED_MONSTER_PROFILES` from 7 to all **37 verified RGBA cutouts**, preserving custom contact patches on the 7 baseline monsters and generating anatomical grounding profiles (`GROUNDED`, `AIRBORNE_HOVER`, `contactPatches`, `ambientPatch`) for the 30 newly integrated cutouts.
- Enhanced `resolveMonsterIntegratedProfile` (and exported alias `resolveIntegratedMonsterProfile`) to verify disk file presence and return `renderContract`, `fallbackPresentation`, and `fallbackReason`.
- Enriched `buildClientState()` so active `IN_COMBAT` encounters include:
  - `scenePerspective`: Track 3's `resolveScenePerspectiveCalibration` for the active tile (`MIRKWOOD_TRAIL`, `OLD_STONE_BRIDGE`, `DEADMANS_MIRE`, `WATCHPOST_RUINS`, `VERDANT_PLAINS`, `RAVEN_CRAGS`, `OAKHAVEN_SANCTUARY`).
  - `distanceTransition`: Track 3's `computeEncounterDistanceTransition` (`20 ft -> 16 ft -> 12 ft` approach scale ratios, horizon Y deltas, and `--approach-*` CSS variables).
  - `renderContract`: Complete mode & asset contract for the active monster.
- Added `GET /api/monster-manifest` endpoint (supports optional `?monster=<slug>&mode=<mode>&sceneTerrain=<terrain>` query parameters).
- Enhanced `LAB_SCENARIO` in `POST /api/action` to support Track 2 Director scenario aliases (`COMBAT` -> `STAGE2_COMBAT`, `SHADOW` -> `STAGE1_MYSTERY`, `AMBUSH` -> `STAGE1_AMBUSH`, `WOUNDED`, `HEAL`) and monster lookup by slug, ID, name, or alias (`skeleton` -> `human_skeleton`, `zombie` -> `human_zombie`, `giant_rat` -> `dire_rat`, `will_o_wisp` -> `will_o_wisp`, `creeping_vine` -> `assassin_vine`).

### 2.4 `action-ui-lab/public/action-ui.js` (Updated)
- Enhanced `computeClientMonsterVisualScale` to pass the current tile's `sceneTerrain`, `tileX`, and `tileY` into `MonsterSizeCatalog.computeAdaptiveMonsterVisualScale` so scene-aware ground contact, sink depth, shadow softness, and corridor width clamping apply live in the browser.
- Added `handleMonsterImageError(imgEl)` and wired `onerror="handleMonsterImageError(this)"` + `data-fallback-src` onto `.fp-monster-img` so that if any cutout image fails to load in the browser, the viewport automatically switches to the original card artwork (`mode-card`) and hides the cutout contact-shadow rig without ever displaying a broken image icon.
- Wired `--approach-start-scale`, `--approach-start-y`, and `--approach-duration` CSS custom properties from `monster.distanceTransition` onto `#fp-monster-actor`.
- Updated the Lab Director modal (`renderDirectorModal`) monster spawn buttons to showcase representative integrated cutouts across all PF1e sizes and stances (`stirge`, `goblin`, `dire_rat`, `human_skeleton`, `wolf`, `giant_spider`, `rust_monster`, `assassin_vine`, `troll`, `owlbear`, `manticore`, `wyvern`, `ochre_jelly`) alongside explicit Card Fallback test buttons (`choker`, `displacer_beast`).

### 2.5 `action-ui-lab/tests/monster-integration.test.js` (Created)
- Added 8 comprehensive integration tests verifying:
  1. Unified `monster-asset-manifest.json` & `GET /api/monster-manifest` endpoint across all 98 DB monsters + 5 reference specimens.
  2. Synchronization of `MONSTER_SIZE_CATALOG` with Track 4 measured cutout bounds and preserved Card bounds.
  3. All 37 `INTEGRATED_MONSTER_PROFILES` on the server with anatomical grounding and contact patches vs 61 Card fallbacks.
  4. All 4 client presentation modes (`INTEGRATED`, `CARD`, `BLEND`, `FRAMED`) across cutout and fallback monsters.
  5. Bulletproof automatic fallback to `CARD` mode when a cutout file is missing on disk, fails to load in the browser, or fails RGBA validation.
  6. Scene-aware perspective calibration & distance transitions across Mirkwood Trail `[7,5]`, Old Stone Bridge `[8,7]`, Watchpost Ruins `[9,7]`, and Deadman's Mire `[4,11]`.
  7. Strict Stage 1 (`DISCOVERED`) encounter secrecy (zero leakage of monster identity, slug, or cutout path) and Director scenario/alias spawning.
  8. Multi-monster formations (1 to 4 creatures) and visual comparison presets with newly integrated cutouts across `1920x1080`, `1440x900`, `1280x800`, and `1024x768`.

---

## 3. Handoff Notes for Track 6 (Browser Visual QA & Gameplay Verification Lead)

- **Server Endpoints Ready for Inspection:**
  - `GET /api/monster-manifest` — full 98-monster + 5-reference-specimen manifest and summary counts (`37` verified cutouts, `61` card fallbacks).
  - `GET /api/monster-scaling` — adaptive PF1e scaling catalog, comparison presets (`SIZE_PROGRESSION_5`, `SAME_SIZE_MEDIUM_PROFILES`, `SAME_SIZE_LARGE_PROFILES`, `ALL_9_PF1E_TIERS`), and single-monster scaling inspector.
  - `GET /api/visual-qa` — reports all `37` `integratedMonsters`, `15x15` World Visual Atlas summary (`0` Grade D gaps), POIs, and atmosphere profiles.
- **Interactive Browser Verification Flows:**
  - Open Lab Tools (`~` / `` ` ``) -> `🎬 Director` (`G`) to one-click spawn any of the newly integrated cutouts (`Stirge`, `Goblin`, `Dire Rat`, `Skeleton`, `Wolf`, `Giant Spider`, `Rust Monster`, `Assassin Vine`, `Troll`, `Owlbear`, `Manticore`, `Wyvern`, `Ochre Jelly`) or Card Fallbacks (`Choker`, `Displacer Beast`).
  - Toggle `Monster: Integrated ★ | Card | Blend | Frame` in the Lab Tools bar during active combat to compare in-scene alpha cutouts against adaptive Card framing.
  - Toggle `⚖️ Scale` (`Z`) to inspect the Pathfinder 1e Size & Body-Profile Comparison Arena on the shared Crossroads backdrop at 12-ft virtual distance.
