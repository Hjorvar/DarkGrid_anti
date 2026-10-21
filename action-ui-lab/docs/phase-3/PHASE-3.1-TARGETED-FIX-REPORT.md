# DARKGRID — Phase 3.1: Targeted Fixes After Review Report

**Date:** 2026-10-21  
**Branch:** `monster_scale_combat_presentation`  
**Worktree:** `C:\Users\hih\.gemini\antigravity\worktrees\antiDark\monster_scale_combat_presentation`  
**Scope Isolation:** 100% isolated inside `action-ui-lab/` (`0` files touched in `src/`, `db/`, `public/images/monsters/`, `images/monsters/`, or `package.json`; `0` git merges/cherry-picks executed)

---

## 1. Executive Summary

Phase 3.1 resolves all four visual and technical issues identified during the Phase 3 review:

1. **Task 1 — Harpy Cutout (`monster_06_medium_flying_harpy_bridge.png`) Fixed:**
   - Replaced the polygon-trimap extraction of `harpy.png` (which retained large triangular brown background/wing-webbing slabs and a lower-left stone perch) with `IS-Net` (`isnet-general-use`) high-precision neural matting + surgical perch removal.
   - Harpy (`842×930`, `57.4%` transparent, `41.6%` opaque core, `100.0%` border clean) now renders as a crisp airborne creature with clean individual wing feathers, tail feathers, and talons across `1920×1080`, `1366×768`, and `1280×800`.
2. **Task 2 — Full Visual Re-Audit & Re-Extraction of All 37 Cutouts (`PHASE-3.1-CUTOUT-REAUDIT.md`):**
   - Visually inspected all **37 cutouts** (`7 EXISTING_APPROVED` + `30 NEWLY_PRODUCED_VERIFIED`) across Dark (`#12161E`), Light (`#D2CDC3`), High-Contrast Magenta (`#FF00FF`), and Live Chromium Combat Stage scenes.
   - Preserved all **7 `EXISTING_APPROVED`** cutouts (`APPROVED_CLEAN`) untouched.
   - Re-extracted all **30 `NEWLY_PRODUCED_VERIFIED`** cutouts (`FIXED_AND_REVERIFIED`) using `IS-Net` neural segmentation + creature-specific surgical refinement, eliminating every polygonal background block (e.g., Dire Rat's 5 vertical leg bars, Wraith's black tomb trapezoid, Ogre's stone arches) and internal alpha hole (e.g., Winter Wolf's torso hole, Giant Crab's carapace holes). Zero cutouts needed to be downgraded (`0 DOWNGRADED_TO_CARD_FALLBACK`).
3. **Task 3 — Size Arena Fixes (`scale_arena_01_tiny_to_huge_progression.png` & `scale_arena_02_all_9_pf1e_tiers.png`):**
   - **Large vs. Huge (`Troll` vs. `Ancient Treant / Giant Brute`):** Expanded soft-knee viewport headroom (`kneeSafeHeightPx = 438px`, `maxSafeHeightPx = 588px` at `1080p`), tightened `BEHEMOTH_HUGE_COLOSSAL.aspectRatio` from `1.06` to `0.90` (eliminating horizontal box letterboxing), tuned `troll.statureMultiplier` to `0.98`, and assigned `ref_huge_elder_troll` the verified `ogre.png` cutout silhouette. At `1920×1080`, `Huge` (`449×499px`, `407×452px` rendered in 5-tier progression) is now **+23% taller and +35% wider** (`+66%` more screen area) than `Large` (`333×406px`, `302×368px` rendered).
   - **Gargantuan Wyrm (`ref_gargantuan_wyrm`) & Honest Card Fallbacks:** Replaced the out-of-place rectangular card (`forest_drake.png`) on `ref_gargantuan_wyrm` with the verified `wyvern.png` RGBA cutout (`hasCutout: true`) and wired `ref_diminutive_toad` to `giant_crab.png` (`hasCutout: true`), so **all 9 PF1e tiers in `ALL_9_PF1E_TIERS` now render as cohesive verified RGBA cutouts (`9 / 9 isCutout: true`)**. Furthermore, any specimen rendered in `CARD` fallback mode (such as `Displacer Beast` in the Before vs. After preset) now displays an explicit `.sizelab-card-fallback-badge` (`CARD FALLBACK`), ensuring card fallbacks are never disguised as cutouts.
   - **Colossal Titan (`ref_colossal_titan`) Visibility:** Added an atmospheric emerald-moonlit depth-mist backdrop behind the right end of the lineup stage (`.sizelab-lineup-stage::before`) and a multi-layer rim-light `drop-shadow` on `.sizelab-lineup-item[data-pf-size="COLOSSAL"]`, cleanly separating `World-Root Titan` from the dark Mirkwood forest background while keeping 100% of its interior colors intact.
4. **Task 4 — Git & Base Lineage Audit (`PHASE-3.1-GIT-READINESS.md`):**
   - Verified that `monster_scale_combat_presentation`, `main`, and `darkgrid_overnight_development` all point to the **exact same commit** (`469705620f0af14b82143767f4e1e92f897f13d7`), and that 100% of Phase 1–3.1 changes are isolated inside `action-ui-lab/`.

---

## 2. Task 1: Harpy Cutout Fix (`monster_06_medium_flying_harpy_bridge.png`)

### 2.1 Root Cause
In Phase 3, `harpy.png` was extracted by `produce-monster-cutouts.js` using a polygon trimap + `WARM_CREATURE` chromatic filter. Because the source painting (`public/images/monsters/harpy.png`) depicts the Harpy against warm brown/amber-lit canyon haze and a diagonal stone ledge, the chromatic filter retained two large triangular brown background blocks beneath both wings and around the tail, plus a diagonal stone perch strip at the bottom-left.

### 2.2 Fix Applied
- Ran `IS-Net` (`isnet-general-use`) high-resolution boundary segmentation on `public/images/monsters/harpy.png` to isolate individual wing primaries, secondary feathers, clawed hands, and tail feathers.
- Applied a surgical lower-left perch plane cut (`y > 0.72 * H - (x / W) * 0.14 * H` for `x < 0.56 * W`) to remove the stone ledge beneath the talons, followed by connected-component filtering, `1.2px` edge anti-aliasing, dark edge despill, and tight bounding-box crop (`842×930` with `12px` transparent margin).
- Synchronized `harpy.cutoutContentBounds` (`minX: 12, minY: 12, maxX: 829, maxY: 917`) across `action-ui-lab/monster-artwork-inventory.json`, `action-ui-lab/monster-size-catalog.js`, and `action-ui-lab/monster-asset-manifest.json`.

### 2.3 Before vs. After Visual Evidence
- **Before (`1920×1080`):** [`before_monster_06_medium_flying_harpy_bridge.png`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/before_monster_06_medium_flying_harpy_bridge.png)
- **After (`1920×1080`):** [`after_monster_06_medium_flying_harpy_bridge.png`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_monster_06_medium_flying_harpy_bridge.png)
- **After (`1366×768`):** [`after_monster_06_medium_flying_harpy_bridge_1366x768.png`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_monster_06_medium_flying_harpy_bridge_1366x768.png)
- **After (`1280×800`):** [`after_monster_06_medium_flying_harpy_bridge_1280x800.png`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_monster_06_medium_flying_harpy_bridge_1280x800.png)
- **4-Panel Diagnostic Contact Sheet (Row 3 of Sheet 3):** [Before (`cutout_audit_before_sheet_3.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_before_sheet_3.png) vs. [After (`cutout_audit_after_sheet_3.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_after_sheet_3.png)

---

## 3. Task 2: Visual Re-Audit of All 37 Cutouts

Full details, methodology, and the per-monster audit table are documented in [`PHASE-3.1-CUTOUT-REAUDIT.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/PHASE-3.1-CUTOUT-REAUDIT.md).

- **7 `APPROVED_CLEAN` (`EXISTING_APPROVED`):** `assassin_vine`, `ghoul`, `giant_spider`, `manticore`, `skeletal_champion`, `troll`, `wolf`.
- **30 `FIXED_AND_REVERIFIED` (`NEWLY_PRODUCED_VERIFIED`):** `ankheg`, `basilisk`, `blood_hawk`, `bugbear`, `dire_rat`, `gargoyle`, `giant_crab`, `giant_scorpion`, `gnoll`, `goblin`, `griffon`, `harpy`, `human_skeleton`, `human_zombie`, `kobold`, `lizardfolk`, `minotaur`, `mummy`, `ochre_jelly`, `ogre`, `orc`, `owlbear`, `rust_monster`, `shadow`, `stirge`, `viper`, `will_o_wisp`, `winter_wolf`, `wraith`, `wyvern`.
- **0 `DOWNGRADED_TO_CARD_FALLBACK`:** Every one of the 30 Priority Tier 1 monsters achieved clean silhouette separation after neural re-extraction and surgical cleanup.

---

## 4. Task 3: Size Arena Fixes (`scale_arena_01` & `scale_arena_02`)

### 4.1 Issue 3A — Large vs. Huge Visual Distinction (`Troll` vs. `Ancient Treant / Giant Troll`)
- **Root Cause:**
  1. In Phase 3, `computeAdaptiveMonsterVisualScale()` applied an aggressive soft-knee viewport clamp starting at `vpH * 0.35` (`378px`) with a ceiling of `vpH * 0.45` (`486px`). Because `Large (Troll)` was already `426px` (`statureMultiplier: 1.03`), the soft-knee compressed `Huge` down to `445px`—leaving only a `4.4%` (`19px`) height difference between `Large` and `Huge`.
  2. In addition, `BEHEMOTH_HUGE_COLOSSAL` had `aspectRatio: 1.06` while the tall portrait cutout inside `.sizelab-specimen-box` (`object-fit: contain`) had a `0.75–0.87` aspect ratio, causing horizontal letterboxing that further shrank the visible creature height inside its box.
  3. Finally, `ref_huge_elder_troll` reused `troll.png`, making `Large` and `Huge` look like twin copies of the same sprite.
- **Fix Applied:**
  1. Expanded soft-knee viewport headroom in [`monster-size-catalog.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/monster-size-catalog.js) (`kneeSafeHeightPx = clamp(vpH * 0.405, 165, 438)`, `maxSafeHeightPx = clamp(vpH * 0.545, 210, 588)`, exponential decay `vpH * 0.145`).
  2. Set `BEHEMOTH_HUGE_COLOSSAL.aspectRatio` to `0.90` and tuned `troll.bodyProportions.statureMultiplier` to `0.98` (`406px` unclamped at `1080p`, below the `438px` knee).
  3. Assigned `ref_huge_elder_troll` (`Huge`) the verified `ogre.png` giant brute cutout (`/lab-assets/images/monsters-cutout/ogre.png`, `854×983`), giving `Large` (`Troll`) and `Huge` (`Ancient Treant / Giant Brute`) unmistakable silhouette and mass differentiation.

### 4.2 Issue 3B — Gargantuan Wyrm (`ref_gargantuan_wyrm`) & Explicit `CARD FALLBACK` Framing
- **Root Cause:** `ref_gargantuan_wyrm` had `hasCutout: false` and fell back to the full rectangular `1024×1024` painting of `forest_drake.png` inside a lineup where adjacent tiers were transparent cutouts.
- **Fix Applied:**
  1. Wired `ref_gargantuan_wyrm` to our newly verified `wyvern.png` RGBA cutout (`/lab-assets/images/monsters-cutout/wyvern.png`, `hasCutout: true`) and `ref_diminutive_toad` to `/lab-assets/images/monsters-cutout/giant_crab.png` (`hasCutout: true`). All **9 PF1e tiers** in `scale_arena_02_all_9_pf1e_tiers.png` now render as verified RGBA cutouts (`9 / 9` `CUTOUT`).
  2. Added an explicit `.sizelab-card-fallback-badge` (`CARD FALLBACK`) in [`size-arena.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/public/js/combat/size-arena.js) and [`combat.css`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/public/css/combat.css) whenever any monster is rendered in `CARD` fallback mode (visible on `Displacer Beast` in `scale_arena_05_before_vs_after_troll.png`), ensuring genuine card fallbacks are explicitly labeled and never disguised as cutouts.

### 4.3 Issue 3C — Colossal Titan (`ref_colossal_titan`) Visibility Against Dark Forest Background
- **Root Cause:** `ref_colossal_titan` (which uses the dark emerald/bark `assassin_vine.png` cutout) sat on the far right of `.sizelab-lineup-stage`, where the Mirkwood background vignette was darkest (`#070b0f`), causing its upper tendrils to blend into the dark pine silhouettes.
- **Fix Applied:**
  1. Added `.sizelab-lineup-stage::before` in [`combat.css`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/public/css/combat.css): a subtle atmospheric moonlit/emerald depth-mist radial gradient positioned behind the upper-right Colossal/Gargantuan zone of the lineup stage.
  2. Added a multi-layer rim-light `drop-shadow` on `.sizelab-lineup-item[data-pf-size="COLOSSAL"] .sizelab-specimen-box.is-cutout .sizelab-specimen-img` (`drop-shadow(0 0 3px rgba(215, 240, 225, 0.52)) drop-shadow(0 0 18px rgba(110, 175, 145, 0.38))`), cleanly separating the Colossal Titan's silhouette against the background trees while keeping 100% of its interior pixel colors unaltered.

### 4.4 Measured Size Arena Progression Across All 3 Resolutions

#### `SIZE_PROGRESSION_5` (`Tiny → Small → Medium → Large → Huge`)

| PF1e Tier | Specimen | `1920×1080` Combat (`W×H`) | `1920×1080` Displayed (`W×H`) | `1366×768` Combat (`W×H`) | `1280×800` Combat (`W×H`) | Height Ratio vs Medium (`1080p`) |
|:----------|:---------|:--------------------------:|:-----------------------------:|:-------------------------:|:-------------------------:|:--------------------------------:|
| `TINY` | Stirge | `140×125 px` | `127×113 px` | `100×89 px` | `103×92 px` | `0.43×` |
| `SMALL` | Goblin | `164×195 px` | `148×177 px` | `117×139 px` | `121×144 px` | `0.67×` |
| `MEDIUM` | Skeletal Champion | `225×289 px` | `204×262 px` | `161×206 px` | `167×214 px` | `1.00×` |
| `LARGE` | Troll | `333×406 px` | `302×368 px` | `237×289 px` | `247×301 px` | `1.40×` |
| `HUGE` | Ancient Treant / Giant Troll | **`449×499 px`** | **`407×452 px`** | **`320×355 px`** | **`333×370 px`** | **`1.73×` (`+23%` H, `+35%` W over Large)** |

#### `ALL_9_PF1E_TIERS` (`Fine → Colossal`)

| PF1e Tier | Specimen | Mode | `1920×1080` Combat (`W×H`) | `1920×1080` Stage Fit (`W×H`) | `1366×768` Combat (`W×H`) | `1280×800` Combat (`W×H`) |
|:----------|:---------|:----:|:--------------------------:|:-----------------------------:|:-------------------------:|:-------------------------:|
| `FINE` | Spore Mite | `CUTOUT` | `70×67 px` | `34×34 px` | `50×38 px` | `51×50 px` |
| `DIMINUTIVE` | Cave Toad | `CUTOUT` | `97×82 px` | `44×37 px` | `70×59 px` | `72×61 px` |
| `TINY` | Viper | `CUTOUT` | `126×102 px` | `57×46 px` | `91×73 px` | `94×76 px` |
| `SMALL` | Kobold | `CUTOUT` | `159×189 px` | `72×86 px` | `113×134 px` | `118×140 px` |
| `MEDIUM` | Wolf | `CUTOUT` | `243×211 px` | `110×96 px` | `173×150 px` | `179×156 px` |
| `LARGE` | Troll | `CUTOUT` | `333×406 px` | `151×185 px` | `237×289 px` | `247×301 px` |
| `HUGE` | Ancient Treant / Giant Troll | `CUTOUT` | `449×499 px` | `204×227 px` | `320×355 px` | `333×370 px` |
| `GARGANTUAN` | Deep Crag Wyrm | `CUTOUT` | `487×541 px` | `221×246 px` | `347×385 px` | `361×401 px` |
| `COLOSSAL` | World-Root Titan | `CUTOUT` | `506×562 px` | `230×256 px` | `360×400 px` | `374×416 px` |

### 4.5 Before vs. After Size Arena Screenshots
- **`scale_arena_01_tiny_to_huge_progression.png`:**
  - [Before (`1920×1080`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/before_scale_arena_01_tiny_to_huge_progression.png)
  - [After (`1920×1080`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_scale_arena_01_tiny_to_huge_progression.png)
  - [After (`1366×768`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_scale_arena_01_tiny_to_huge_progression_1366x768.png)
  - [After (`1280×800`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_scale_arena_01_tiny_to_huge_progression_1280x800.png)
- **`scale_arena_02_all_9_pf1e_tiers.png`:**
  - [Before (`1920×1080`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/before_scale_arena_02_all_9_pf1e_tiers.png)
  - [After (`1920×1080`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_scale_arena_02_all_9_pf1e_tiers.png)
  - [After (`1366×768`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_scale_arena_02_all_9_pf1e_tiers_1366x768.png)
  - [After (`1280×800`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/after_scale_arena_02_all_9_pf1e_tiers_1280x800.png)

---

## 5. Automated Verification & Scope Audit

| Test Suite | Command | Result |
|:-----------|:--------|:------:|
| Track 1–2 Scaling Engine (`monster-scaling.test.js`) | `node --test action-ui-lab/tests/monster-scaling.test.js` | **9 / 9 PASS** ✅ |
| Track 4 Artwork & Cutout Quality Gate (`monster-artwork.test.js`) | `node --test action-ui-lab/tests/monster-artwork.test.js` | **4 / 4 PASS** ✅ |
| Track 5–7 Live Chromium Integration & Arena (`monster-integration.test.js`) | `node --test action-ui-lab/tests/monster-integration.test.js` | **10 / 10 PASS** ✅ |
| Phase 1–2.5 Independent QA Suite (`independent-qa.test.js`) | `node --test action-ui-lab/tests/independent-qa.test.js` | **PASS** ✅ |
| Core Repository Test Suite | `npm test` | **PASS** ✅ |
| Outside-`action-ui-lab/` Git Diff Check | `git status --short -- ':!action-ui-lab'` | **Empty (`0` files)** ✅ |
