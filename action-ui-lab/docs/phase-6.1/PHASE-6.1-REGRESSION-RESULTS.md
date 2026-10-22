# DARKGRID — PHASE 6.1: REGRESSION & TEST SUITE RESULTS

**Date:** 2026-10-22  
**Branch:** `darkgrid_legacy_integration`  
**Scope:** Complete Regression Results across Legacy (`src/`), Adventure Lab (`action-ui-lab/`), Phase 6.1 Hardening, and 640 World Viewpoints

---

## 1. Overall Verification Summary

| Suite / Audit Category | Baseline Required | Phase 6.1 Result | Failures | Status |
|---|---|---|---|---|
| **Legacy Domain, Security, Integration & E2E (`npm test`)** | `228 / 228` | **`228 / 228`** | `0` | **PASS** |
| **Adventure Lab Baseline Suites (`action-ui-lab/tests/*.test.js`)** | `123 / 123` | **`123 / 123`** | `0` | **PASS** |
| **Phase 6.1 Pre-Cutover Hardening Suite (`phase-6-1-hardening.test.js`)** | New (`+7`) | **`7 / 7`** | `0` | **PASS** |
| **Total Automated Tests Executed** | `351` | **`358 / 358`** | `0` | **PASS** |
| **15×15 World Visual Atlas Viewpoints (`160` tiles × `4` facings)** | `640 / 640` | **`640 / 640`** (`Grade D = 0`) | `0` | **PASS** |
| **Canonical `src/` & `db/` Modification Check (`git diff -- src/ db/`)** | `0` diffs | **`0` diffs** | `0` | **PASS** |

---

## 2. Breakdown by Adventure Lab Test File (`130/130` Passing across 10 Suites)

1. `action-ui-lab/tests/action-lab.test.js` — **32 / 32 PASS**
   - First-person facing, map viewport, encounters, combat flow, 5-tier POV scene resolution, 15×15 World Visual Atlas (`640/640` viewpoints, `Grade D = 0`), atmospheric FX, POI line-of-sight, Mirkwood expedition arcs, and 98-monster adaptive scale.
2. `action-ui-lab/tests/independent-qa.test.js` — **17 / 17 PASS**
   - Independent end-to-end & headless browser QA across all 17 gameplay and visual areas (`1920x1080`, `1440x900`, `1366x768`, `1280x800`, `390x844`).
3. `action-ui-lab/tests/monster-artwork.test.js` — **5 / 5 PASS**
   - Monster artwork inventory (98 monsters), defeated art, and 37 RGBA cutout pixel & grounding validation.
4. `action-ui-lab/tests/monster-integration.test.js` — **8 / 8 PASS**
   - Unified monster asset manifest (37 cutouts + 61 card fallbacks), anatomical grounding, perspective calibration, and multi-monster formations.
5. `action-ui-lab/tests/monster-scaling.test.js` — **11 / 11 PASS**
   - Pathfinder 1e 9 size categories, distance bands (`20ft..9ft`), hover separation, and viewport safety clamping.
6. `action-ui-lab/tests/phase-5-world.test.js` — **10 / 10 PASS**
   - 640-viewpoint World Art Audit (`evaluateWorldArtAudit`), 13 permanently activated Phase 5 paintings + P5-ART-04-REPL, Lone Barrow restriction, and Journeys A/B/C.
7. `action-ui-lab/tests/phase-6-legacy-integration.test.js` — **11 / 11 PASS**
   - Canonical SQLite schema compatibility, Auth, 71-point Character Creator, 9-slot panoply, Market consignment, Watcher's Board bounties, d20 combat, permadeath, and live headless Chrome QA.
8. `action-ui-lab/tests/player-ui.test.js` — **13 / 13 PASS**
   - Progressive disclosure header, mode-reactive UI, top champion deck, chronicle drawer, and live weapon preference/shield AC rules.
9. `action-ui-lab/tests/world-travel.test.js` — **16 / 16 PASS**
   - 4-direction navigation, corridor continuity, revisit memory, 500-seed encounter pacing simulation, and barrier views.
10. `action-ui-lab/tests/phase-6-1-hardening.test.js` — **7 / 7 PASS (NEW)**
    - **Test 1:** Fail-closed startup in production without strong `SESSION_SECRET`.
    - **Test 2:** Mandatory authentication in production, zero anonymous `action_hero` fallback, and preservation of canonical map tiles `(6,5)`, `(8,6)`, `(8,8)`, `(9,7)`.
    - **Test 3:** Secure `__session` cookie attributes (`HttpOnly`, `SameSite=Lax`, `Secure`), `/api/legacy-audit` lockdown (`401`/`403`), and blocking of `LAB_SCENARIO`, `TELEPORT_TO_TILE`, `REVIVE`, `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, `SET_ART_PREVIEW_MODE` for normal players (`403`).
    - **Test 4:** Resolution of Character Creation contradiction (`409 Conflict` on second living hero, ignoring `retireCurrentHero` without destroying living character, and blocking `startingGold` tamper).
    - **Test 5:** Full Fighter, Ranger, and Cleric player journeys, cross-account item & bounty ownership enforcement (`403`), replay idempotency (`X-Idempotency-Key`), concurrent market purchase race protection, `expectedRound` stale-round combat protection, and permadeath $\rightarrow$ new hero recovery.
    - **Test 6:** Production migration rehearsal on an isolated copy of a legacy database (`PRAGMA integrity_check = ok`, `PRAGMA foreign_key_check = 0`, 100% data retention, and exact SHA-256 rollback verification).
    - **Test 7:** Real headless Chrome visual & DOM verification across Desktop (`1920x1080`), Laptop (`1366x768`), and Mobile (`390x844`) with zero console errors.
