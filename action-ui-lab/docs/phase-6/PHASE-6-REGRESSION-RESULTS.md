# DARKGRID — PHASE 6: REGRESSION & TEST SUITE RESULTS

**Date:** 2026-10-22  
**Branch:** `darkgrid_legacy_integration`  
**Status:** 100% PASS ACROSS ALL BASELINE & PHASE 6 SUITES

---

## 1. Summary Table

| Verification Suite | Command | Total Tests / Checks | Passed | Failed | Status |
|---|---|---:|---:|---:|---|
| **Adventure Lab Full Test Suite (Phases 1–6)** | `node --test action-ui-lab/tests/*.test.js` | **123** (112 baseline + 11 Phase 6) | **123** | **0** | **PASS (100%)** |
| **Phase 5.2B World Viewpoint & Art Governance** | `node action-ui-lab/scripts/verify-art-approval.js` | **640** viewpoints | **640** | **0** | **PASS (100%)** |
| **Original Darkgrid Legacy Test Suite** | `npm test` | **228** tests (17 suites) | **228** | **0** | **PASS (100%)** |

---

## 2. Detailed Breakdown of `action-ui-lab/tests/*.test.js` (123/123 Passing)

1. **First-Person Facing, Map Viewport, Encounters & Combat Flow (`action-ui.test.js`):** `32 / 32 PASS`
   - 15×15 map navigation, 5-tier POV scene resolution, Stage 1 secrecy, multi-beat combat sequence, 37 RGBA monster cutouts, 98-monster PF1e size scaling catalog, and 3-tier exploration tension cues.
2. **Track 1 — World Travel, Continuity & Stability (`track1-continuity.test.js`):** `16 / 16 PASS`
   - 4-direction compass continuity, corridor progression, biome threshold hints, deterministic 500-seed encounter pacing simulation, and barrier/landmark views.
3. **Track 2 — Player Experience & UI Overhaul (`ui-overhaul.test.js`):** `13 / 13 PASS`
   - Progressive disclosure, mode-reactive UI classes, top champion deck, decluttered HUD, expandable chronicle, live equipment stance switch, and shield AC rules.
4. **Phase 5 — World Viewpoint Audit & Scene Classification (`phase5-viewpoint-audit.test.js`):** `8 / 8 PASS`
5. **Phase 5.1 — Candidate Artwork Staging & Governance (`phase5-1-candidate-staging.test.js`):** `9 / 9 PASS`
6. **Phase 5.2 — Permanent Artwork Activation (`phase5-2-art-activation.test.js`):** `8 / 8 PASS`
7. **Phase 5.2B — Lone Barrow Restriction & Open Moorland Replacement (`phase5-2b-barrow-restriction.test.js`):** `9 / 9 PASS`
8. **Phase D — Independent End-to-End & Headless Browser QA Suite (`independent-qa.test.js`):** `17 / 17 PASS`
   - Full headless Chrome CDP verification across 1920×1080, 1440×900, 1366×768, 1280×800, and 390×844 viewports, monster cutout grounding, and zero console/network errors.
9. **Phase 6 — Full Legacy Integration & Complete Player Journey Verification (`phase-6-legacy-integration.test.js`):** `11 / 11 PASS`
   - Legacy DB compatibility audit, auth/session/Firebase upgrade bridge, 71-point character creation & Favored Enemy validation, multi-user isolation, Ranger Keen Senses & Opening Shot, Cleric Holy Radiance & Self-Heal, 9-slot equipment & Shared Global Magical Resale Market, Watcher's Board bounties, Permadeath & Persistent Monster avenging, Anti-Tamper & Idempotency, and Live Headless Chrome Browser Visual QA.

---

## 3. World Viewpoint & Artwork Baseline (`640/640 PASS`)

- **Passable Viewpoints Verified:** `640 / 640`
- **Unique Paintings Used:** `64`
- **Quality Grades:** `A = 57 | B = 160 | C = 423 | D = 0`
- **Broken Image References:** `0`
- **Wrong Scene Mappings:** `0`
- **P5-ART-04 Restricted Landmark Placement:** Lone Barrow strictly limited to `12,1:SOUTH`, `12,2:NORTH`, `13,2:WEST` (`3` viewpoints); Open Moorland Swell active on `16` viewpoints.

---

## 4. Original Darkgrid Application Integrity (`228/228 PASS`)

- `git status` confirms **zero modified or deleted files** outside `action-ui-lab/`.
- All `228` unit, integration, security, concurrency, combat, economy, bounty, and UI tests in the original Darkgrid repository pass without modification.
