# DARKGRID ADVENTURE LAB — PHASE 5.1 REGRESSION COVERAGE COMPARISON

**Branch:** `phase_5_1_review`  
**Scope:** `action-ui-lab/tests/*.test.js`  
**Automated Test Status:** **112 / 112 PASS (`0` failures across 8 test suites)**

---

## 1. Root-Cause Investigation of the Phase 4 vs. Phase 5 Report Discrepancies

The Phase 5.1 prompt asked two critical investigative questions:
1. **Why did the Phase 5 report table show `independent-qa.test.js` dropping from `15` to `11` and `monster-artwork.test.js` changing from `4` to `8`?**
2. **Why did the Phase 5 report text refer to "12 monster artwork files" when Phase 4 verified 37 RGBA cutouts?**

### Finding 1: The Phase 5 Report Table Had Transposed Row Labels (Zero Tests Were Deleted in Code)
Direct inspection of git history (`git diff phase_4..phase_5_world_completion -- action-ui-lab/tests/`) proved that **not a single line of `independent-qa.test.js`, `monster-artwork.test.js`, `phase-3-monsters.test.js`, `player-ui.test.js`, `action-ui-lab.test.js`, `world-travel.test.js`, or `pacing-audit.test.js` was modified or deleted during Phase 5.**

Instead, the summary table in `docs/phase-5/PHASE-5-REGRESSION-RESULTS.md` contained a documentation transcription error where row counts were transposed between `monster-artwork.test.js` (`4` actual vs `8` misprinted) and `independent-qa.test.js` (`15` actual vs `11` misprinted) while still summing to `105`:

| Test Suite File (Actual Disk Filename) | Actual Phase 4 `it()` Count | Actual Phase 5 `it()` Count (Code) | Misreported Phase 5 Table Number | Phase 5.1 / 5.2 Enhanced `it()` Count |
|---|---:|---:|---:|---:|
| [`action-lab.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/action-lab.test.js) | 32 | 32 | 32 | **32** |
| [`world-travel.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/world-travel.test.js) *(includes encounter pacing & 500-seed simulation in Tests 5, 13, 14)* | 16 | 16 | 16 | **16** |
| [`monster-integration.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/monster-integration.test.js) | 8 | 8 | 8 | **8** |
| [`player-ui.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/player-ui.test.js) | 12 | 12 | 12 | **13** *(+1 in Phase 5.1)* |
| [`monster-scaling.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/monster-scaling.test.js) *(Phase 3 monster scaling suite)* | 11 | 11 | 11 | **11** |
| [`monster-artwork.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/monster-artwork.test.js) | 4 | 4 | *8 (transposed)* | **5** *(+1 in Phase 5.1)* |
| [`independent-qa.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/independent-qa.test.js) | 15 | 15 | *11 (transposed)* | **17** *(+2 in Phase 5.1)* |
| [`phase-5-world.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/phase-5-world.test.js) | 0 | 7 | 7 | **10** *(+3 in Phase 5.1)* |
| **TOTAL** | **98** | **105** | **105** | **112** |

### Finding 2: All 37 Verified RGBA Cutouts Were Always Tested in Code ("12 Cutouts" Was a Prose Typo)
In `PHASE-5-REGRESSION-AND-E2E-REPORT.md` Section 1.2, the prose description for `monster-artwork.test.js` mistakenly wrote *"RGBA cutout transparency, bounding boxes, and file existence for all 12 cutouts"*. In actual code:
- [`monster-artwork.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/monster-artwork.test.js) Test 1 verifies all **98** canonical database monsters (`68` Core + `30` Seed-010 Expansion) and **5** reference specimens.
- Test 2 verifies all **98** source and defeated artwork files on disk.
- Test 3 verifies the **7** baseline approved RGBA cutouts (`manticore`, `ghoul`, `assassin_vine`, `wolf`, `skeletal_champion`, `giant_spider`, `troll`).
- Test 4 verifies all **30** newly produced Priority Tier 1 RGBA cutouts and asserts `verifiedMonsters.length === 37` and `diskFiles.length === 37`, running `validateCutoutRgbaBuffer` (PNG colorType 6, transparency ratio, opaque core ratio, border transparency, and bounding-box match) on every single one of the **37** RGBA PNG files.
- [`independent-qa.test.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/tests/independent-qa.test.js) Area 14 independently asserts `manifest.summary.verifiedCutoutCount === 37` and checks all **37** PNG files on disk.
- In Phase 5.1, we added **Test 5** in `monster-artwork.test.js` to explicitly verify that all **37** RGBA cutouts resolve valid `stageAnchor` (`stageFloorY` in `[75, 90]`) and `adaptiveScale.visibleHeightPx` across all **13** Phase 5 candidate environment paintings (`37 × 13 = 481` monster-on-candidate-scene combinations).

---

## 2. Assertion-Level Audit Across All Functional Domains

Per Section 3.1 of the Phase 5.1 specification, we audited actual assertions across every functional domain rather than relying on `test()` counts alone:

| Domain | Phase 4 Coverage | Phase 5 Status | Phase 5.1 Action & Verification |
|---|---|---|---|
| **Monster Artwork Inventory & Cutouts** | `monster-artwork.test.js` (Tests 1–4) + `independent-qa.test.js` (Areas 10, 11, 12, 14): 98 DB monsters, 37 RGBA cutouts, 61 Card fallbacks. | **Unchanged** in code (misdescribed as "12 cutouts" in Phase 5 prose). | **Strengthened (+1 test):** Added `monster-artwork.test.js` Test 5 testing all **37** RGBA cutouts across all **13** Phase 5 candidate scenes (`481` combinations). |
| **Equipment, Stance & Shield AC Rules** | `independent-qa.test.js` Area 1 checked `MELEE` vs `RANGED` stance toggle; `player-ui.test.js` Test 3 checked static HTML hand slot IDs. | **Gap identified:** Phase 4 `PHASE-4-REGRESSION-REPORT.md` described live API/DOM tests for `1H + Shield = PASSIVE AC (+1)`, `Ranged 2H Bow = STOWED (no shield AC)`, `2H Melee Weapon = 2H LOCKED (no shield AC)`, and `Combat Stance Lock`, which were only partially covered by static checks. | **Restored & Strengthened (+2 tests):** Added `player-ui.test.js` Test 13 (live API verification of `MELEE` 1H+Shield AC, `RANGED` 2H bow stowed shield AC drop, `2H` melee weapon equip AC drop, and `IN_COMBAT` stance lock) and `independent-qa.test.js` Area 15 (live Chromium DOM verification of `#main-hand-state-tag`, `#off-hand-state-tag` `PASSIVE AC` vs `STOWED`, `#hud-ac-val`, and combat lock). |
| **Stage 1 Monster Secrecy & Ambush** | `action-ui-lab.test.js` Tests 4–5 + `independent-qa.test.js` Area 3. | **Preserved intact.** Verifies zero leak of `monsterName`, `monsterId`, `imageUrl`, `cutoutImageUrl`, `adaptiveScale` in API & DOM, and verifies Ambush blocks `IGNORE` and `MOVE`. | **Preserved intact.** |
| **Stage 2 Combat, Scale & Victory** | `action-ui-lab.test.js` Tests 6, 7, 9, 17, 18, 23, 31, 32 + `phase-3-monsters.test.js` Tests 1–10 + `independent-qa.test.js` Areas 4, 5, 6, 7, 10, 11, 12. | **Preserved intact.** | **Strengthened:** Added live monster cutout grounding verification on Phase 5 candidate scenes in `independent-qa.test.js` Area 16. |
| **World Movement, Facing & Barriers** | `action-ui-lab.test.js` Tests 1–3, 8, 12–16, 19–20 + `world-travel.test.js` Tests 1–16 + `independent-qa.test.js` Areas 1–2. | **Extended in Phase 5** with `phase-5-world.test.js` Tests 1–7 (640 viewpoints, Journeys A/B/C). | **Strengthened (+3 tests):** Added `phase-5-world.test.js` Tests 8, 9, and 10 (6-metric world art audit, per-instance preview isolation, and per-artwork ID approval + `P5-ART-04` restricted/replacement modes). |
| **Responsive & Mobile Layout Checks** | `independent-qa.test.js` Area 13 tested `1920×1080`, `1440×900`, and `1280×800`. | **Gap identified:** Phase 5.1 requires explicit verification at `1366×768` and mobile `390×844`. | **Restored & Strengthened:** Added live Chromium viewport verification at `1366×768` and `390×844` in `independent-qa.test.js` Area 16. |
| **Browser Stability (Console, Page & Network)** | `independent-qa.test.js` Area 15 (now Area 17). | **Preserved intact.** | **Preserved intact:** Runs last across all 17 E2E areas, asserting `consoleErrors === []`, `pageExceptions === []`, and `failedNetworkRequests === []`. |
| **SQLite Persistence Across Reloads** | `world-travel.test.js` Test 8 + `independent-qa.test.js` Area 8 (`Page.reload`). | **Preserved intact.** | **Preserved intact.** |

---

## 3. Summary of the 7 New Tests Added in Phase 5.1 (`105 -> 112`)

1. **`monster-artwork.test.js` — Test 5:** Verifies all **37** verified RGBA monster cutouts resolve valid `stageAnchor` and `adaptiveScale.visibleHeightPx` across all **13** Phase 5 candidate scenes.
2. **`player-ui.test.js` — Test 13:** Verifies live `MELEE` (1H + Shield `+1 AC`), `RANGED` (2H bow, shield stowed `-1 AC`), `2H MELEE` equip (shield locked `-1 AC`), and active combat stance-switch rejection (`IN_COMBAT`).
3. **`phase-5-world.test.js` — Test 8:** Verifies the 6-metric World Art Audit classification (`BROKEN_IMAGE_REFERENCE = 0`, `WRONG_SCENE = 0`, `VALID_APPROVED_FALLBACK = 175`, `CANDIDATE_ART_PENDING = 175` in default mode; `0` in candidate mode).
4. **`phase-5-world.test.js` — Test 9:** Verifies strict per-instance `WeakMap` isolation of Candidate Preview Mode across separate Lab instances and HTTP query parameters without mutating global default player state.
5. **`phase-5-world.test.js` — Test 10:** Verifies granular per-artwork ID approval (`setCandidateArtApprovalStatus` for individual or subset IDs) and `P5-ART-04` restricted (`['12,1:SOUTH', '12,2:NORTH', '13,2:WEST']`) + replacement (`plains_open_moorland_swell_pov.jpg`) modes while keeping all 13 candidates `REVIEW REQUIRED`.
6. **`independent-qa.test.js` — Area 15:** Live headless Chromium DOM verification of Equipment Stance switching (`#main-hand-state-tag`, `#off-hand-state-tag` `PASSIVE AC` vs `STOWED`, `#hud-ac-val`) and combat stance lock.
7. **`independent-qa.test.js` — Area 16:** Live headless Chromium DOM verification of the Candidate Art Preview Mode UI badge (`#fp-art-preview-badge`), monster cutout grounding on candidate paintings, and `1366×768` + `390×844` mobile layout checks.
