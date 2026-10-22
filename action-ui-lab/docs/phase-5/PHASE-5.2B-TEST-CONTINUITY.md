# DARKGRID ADVENTURE LAB — PHASE 5.2B TEST SUITE CONTINUITY AUDIT

**Phase:** 5.2b — Independent Pre-Merge Consistency Audit & Targeted Corrections  
**Branch / Worktree:** `phase_5_1_review`  
**Investigation A Classification:** **`DOCUMENTATION ERROR` (in `PHASE-5.1-REGRESSION-COMPARISON.md`) / `NO ISSUE FOUND` (in actual test code)**

---

## 1. Executive Conclusion

1. **Were any test files renamed between Phase 5.1 and Phase 5.2?**
   - **No.** Full Git history inspection (`git log --all --full-history --stat -- "action-ui-lab/tests/*.test.js"`) proves that `pacing-audit.test.js`, `phase-3-monsters.test.js`, and `action-ui-lab.test.js` **never existed as filenames on disk** in any commit (`bb0dddc`, `4697056`, `5b40d3a`, `5fc315f`, or `ea71471`).
   - Since commit `4697056` (Phase 1–2.5b) and `ea71471` (Phase 5), the 8 test suite files on disk have always had the exact filenames reported in Phase 5 (`PHASE-5-REGRESSION-RESULTS.md`) and Phase 5.2 (`PHASE-5.2-REGRESSION-RESULTS.md`):
     1. `action-lab.test.js` (`32` tests)
     2. `world-travel.test.js` (`16` tests)
     3. `player-ui.test.js` (`13` tests)
     4. `monster-scaling.test.js` (`11` tests)
     5. `monster-artwork.test.js` (`5` tests)
     6. `monster-integration.test.js` (`8` tests)
     7. `phase-5-world.test.js` (`10` tests)
     8. `independent-qa.test.js` (`17` tests)
2. **Why did `PHASE-5.1-REGRESSION-COMPARISON.md` list `pacing-audit.test.js` (`9`) and `phase-3-monsters.test.js` (`10`)?**
   - The table in `PHASE-5.1-REGRESSION-COMPARISON.md` used descriptive/working titles (`pacing-audit.test.js` with `9` tests and `phase-3-monsters.test.js` with `10` tests, summing to `19`) instead of the actual disk filenames `monster-integration.test.js` (`8` tests) and `monster-scaling.test.js` (`11` tests, also summing to `19`), and wrote `action-ui-lab.test.js` instead of `action-lab.test.js`.
   - In Phase 5.2, `PHASE-5.2-REGRESSION-RESULTS.md` generated its table directly from the actual `node --test action-ui-lab/tests/*.test.js` CLI execution, which output the real disk filenames (`monster-integration.test.js` `8/8` and `monster-scaling.test.js` `11/11`).
3. **Were any tests reorganized, removed, or weakened?**
   - **No (`0` tests removed, `0` assertions weakened).** `git diff ea71471 -- action-ui-lab/tests/` confirms that between commit `ea71471` (Phase 5) and Phase 5.2:
     - `monster-integration.test.js` (`8` tests) and `monster-scaling.test.js` (`11` tests) had **`0` lines modified**.
     - `action-lab.test.js` (`32` tests) and `world-travel.test.js` (`16` tests) had **only 1 line each updated** to reflect the newly approved Phase 5.2 default URLs (`[9,7] SOUTH` -> `watchpost_9_7_south_river_gorge.jpg` and `[3,8] SOUTH` -> `transition_hills_to_swamp_pov.jpg`).
     - **7 net new tests** were added in Phase 5.1/5.2 (`monster-artwork.test.js` `+1`, `player-ui.test.js` `+1`, `phase-5-world.test.js` `+3`, `independent-qa.test.js` `+2`), bringing the total from `105` (Phase 5) to **`112` (Phase 5.1 & Phase 5.2)**.

---

## 2. Explicit Mapping: Phase 5.1 Report Labels $\rightarrow$ Actual Disk Test Suites (Phase 5.2)

| Phase 5.1 Report Table Label | Phase 5.1 Reported Count | Actual Disk File (Git History & Phase 5.2) | Actual Test Count | Where the Domain Assertions Live |
|---|---:|---|---:|---|
| `action-ui-lab.test.js` | `32` | [`action-lab.test.js`](../../tests/action-lab.test.js) | **`32`** | Exact same file (`32` tests: movement, Stage 1 secrecy, Stage 2 combat beats, 15×15 Visual Atlas, POIs, expeditions, 98 monster sizes & adaptive scaling). |
| `world-travel.test.js` | `16` | [`world-travel.test.js`](../../tests/world-travel.test.js) | **`16`** | Exact same file (`16` tests: 4-direction travel, compass, revisit memory, SQLite persistence, barrier views, **plus Encounter Pacing & 500-seed simulation in Tests 5, 13, and 14**). |
| `pacing-audit.test.js` *(descriptive label)* | `9` | [`monster-integration.test.js`](../../tests/monster-integration.test.js) *(+ `world-travel.test.js` Tests 5, 13, 14 & `action-lab.test.js` Tests 27, 29)* | **`8`** | `monster-integration.test.js` contains `8` tests (unified 98-monster manifest, 37 cutouts, 4 client modes, Card fallback, perspective calibration, Stage 1 secrecy, 1–4 monster formations). Encounter pacing is covered in `world-travel.test.js` Tests 5, 13, 14 and `action-lab.test.js` Tests 27, 29. |
| `phase-3-monsters.test.js` *(descriptive label)* | `10` | [`monster-scaling.test.js`](../../tests/monster-scaling.test.js) | **`11`** | `monster-scaling.test.js` is the Phase 3 monster scaling suite (`11` tests: Tests `0..6, 8..11`, with Test 11 titled *"11. Phase 3 — Synthesizes deterministic fallback size and body profile metadata..."*). Note: `8 + 11 = 19`, matching `9 + 10 = 19`. |
| `player-ui.test.js` | `13` | [`player-ui.test.js`](../../tests/player-ui.test.js) | **`13`** | Exact same file (`13` tests: progressive disclosure, mode classes, Champion Deck, hidden-numbers plate, Chronicle drawer, Action Deck, live Shield AC & combat stance lock). |
| `monster-artwork.test.js` | `5` | [`monster-artwork.test.js`](../../tests/monster-artwork.test.js) | **`5`** | Exact same file (`5` tests: 98 monster source/defeated art, 7 baseline cutouts, 30 expansion cutouts = 37 RGBA cutouts, and `37 × 14 = 518` activated Phase 5 scene grounding checks). |
| `phase-5-world.test.js` | `10` | [`phase-5-world.test.js`](../../tests/phase-5-world.test.js) | **`10`** | Exact same file (`10` tests: 640-viewpoint audit, 14 activated Phase 5 paintings, `P5-ART-04` restricted barrow + 16 moorland replacements, 4-way landmark approaches, Journeys A/B/C, 6-metric classifier, preview isolation, persistent approval). |
| `independent-qa.test.js` | `17` | [`independent-qa.test.js`](../../tests/independent-qa.test.js) | **`17`** | Exact same file (`17` real headless Chromium E2E tests: Areas 1–17 covering world travel, turning, Stage 1 secrecy, Stage 2 reveal, combat beats, HP brackets, flee/bypass, SQLite reload, expeditions, PF1e size arena, card fallback, RGBA cutouts, multi-resolution layout, heap/asset decode, stance/Shield AC DOM, activated Phase 5 art + mobile `390×844`, and 0 console/page/network errors). |
| **TOTAL** | **`112`** | **8 Test Suite Files** | **`112`** | **100% of assertions preserved (`112 / 112 PASS`).** |

---

## 3. Complete Coverage Verification Across All Required Gameplay Domains

1. **Encounter Pacing & Anti-Oscillation (`world-travel.test.js` Tests 5, 13, 14 & `action-lab.test.js` Tests 27, 29):**
   - Verifies Town Gate grace (`[7,6]` North Gate, `[7,8]` South Gate, `[8,7]` Old Stone Bridge), terrain danger hierarchy (`PLAINS < FOREST < HILLS < SWAMP < JUNGLE`), anti-oscillation step protection, post-encounter breathing room, cleared-site protection, persistent monster priority, and runs a **deterministic 500-seed Encounter Pacing Simulation across Scenarios A–I**.
2. **Phase 3 Monster Scaling (`monster-scaling.test.js` Tests 0–11 & `action-lab.test.js` Tests 31–32):**
   - Verifies all 98 DB monsters + 5 PF1e reference specimens across 9 size categories (`FINE` to `COLOSSAL`), virtual distance bands (`20ft`, `16ft`, `12ft`, `9ft`), Stage 1 $\rightarrow$ Stage 2 distance transitions, airborne hover vs. grounded foot/paw/root contact, soft-knee UI clamping across `1920×1080`, `1440×900`, `1280×800`, `1024×768`, and 1–4 creature formations.
3. **Visual Monster Integration (`monster-integration.test.js` Tests 1–8 & `monster-artwork.test.js` Tests 1–5):**
   - Verifies all 37 RGBA cutouts + 61 Card fallbacks, `INTEGRATED` / `CARD` / `BLEND` / `FRAMED` presentation modes, automatic fallback on broken/invalid cutout URLs, scene-aware perspective calibration, and `37 × 14 = 518` monster-on-activated-Phase-5-scene combinations.
4. **Corrective Action Taken:**
   - Updated the historical comparison table in [`PHASE-5.1-REGRESSION-COMPARISON.md`](PHASE-5.1-REGRESSION-COMPARISON.md) so it uses the exact disk filenames (`action-lab.test.js`, `monster-integration.test.js`, `monster-scaling.test.js`) and notes where encounter pacing and Phase 3 monster scaling assertions reside.
