# DARKGRID ADVENTURE LAB — PHASE 2.5: REGRESSION & VISUAL QA TEST RESULTS

**Date:** 2026-10-21  
**Worktree:** `darkgrid_overnight_development`

---

## 1. Automated Test Suite Summary

All automated test suites in both `action-ui-lab/tests/` and the main game `tests/` directory were executed before (Step A Baseline), during (Steps B, C, D), and after (Step F Full Regression) the Phase 2.5 refactoring.

| Test Suite | File | Tests | Passed | Failed | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Core Action UI Lab Suite** | `action-ui-lab/tests/action-lab.test.js` | 32 | 32 | 0 | **PASS** |
| **Track 1: World Travel & Continuity** | `action-ui-lab/tests/world-travel.test.js` | 16 | 16 | 0 | **PASS** |
| **Track 2: Player Experience & UI** | `action-ui-lab/tests/player-ui.test.js` | 11 | 11 | 0 | **PASS** |
| **Phase D: Independent E2E & Browser QA** | `action-ui-lab/tests/independent-qa.test.js` | 11 | 11 | 0 | **PASS** |
| **Track 3: PF1e Monster Size & Scaling** | `action-ui-lab/tests/monster-scaling.test.js` | 8 | 8 | 0 | **PASS** |
| **Track 5: Monster Cutout Integration** | `action-ui-lab/tests/monster-integration.test.js` | 10 | 10 | 0 | **PASS** |
| **Track 4: Monster Artwork Verification** | `action-ui-lab/tests/monster-artwork.test.js` | 8 | 8 | 0 | **PASS** |
| **Action UI Lab Total (All 7 Suites)** | `action-ui-lab/tests/*.test.js` | **96** | **96** | **0** | **100% PASS** |
| **Core Phase 2 Benchmark (3 Core Suites)** | `action-lab` + `world-travel` + `player-ui` | **59** | **59** | **0** | **100% PASS** |
| **Main Darkgrid Game Suite (17 Suites)** | `tests/*.test.js` (`npm test`) | **228** | **228** | **0** | **100% PASS** |

---

## 2. ES6 Module Graph & Static Verification

Verified via `verify-es-modules.js` against all 20 ES6 modules in `action-ui-lab/public/js/`:

- **Modules Parsed:** 20 / 20
- **VM `SourceTextModule` Syntax Check:** 20 / 20 Valid (`0` syntax errors)
- **Named Import / Export Resolution:** 100% matched (`0` missing exports)
- **Circular Dependencies:** `0` cycles detected

---

## 3. Real Chromium Browser Visual & Layout Regression (`baseline` vs. `after`)

Using Playwright Headless Chromium, 27 deterministic application states (9 core game scenarios × 3 desktop viewport resolutions: `1920×1080`, `1600×960`, and `1280×720`) were captured before any code changes (`screenshots/baseline/`) and after completing CSS, Frontend ES Module, and Backend refactoring (`screenshots/after/`).

### Verified Scenarios Across All 3 Viewports (27 States):
1. `01-oakhaven-city` — Oakhaven Sanctuary (`CITY` mode, town facilities, Top Champion Deck, 5×5 minimap).
2. `02-north-gate-step` — Stepping North to Oakhaven North Gate (`[7,6]` Facing `NORTH`, horizon & continuity cues).
3. `03-north-gate-turn-east` — Rotating 90° (`TURN RIGHT` to `EAST`, compass update without false step).
4. `04-mirkwood-blocked-west` — Moving into Mirkwood (`[7,5]`) and attempting blocked move West into Stonefang Crag (`[6,5]` impassable mountain feedback).
5. `05-stage1-mystery` — Stage 1 `DISCOVERED` Encounter (strict encounter secrecy: shadow overlay, `Unidentified Threat`, zero leaked monster name/stats/image).
6. `06-stage2-combat-cutout` — Stage 2 `IN_COMBAT` Encounter (integrated RGBA Manticore cutout, airborne hover shadow, Monster Combat Plate, 3-slot Tactical Action Deck).
7. `07-hero-sheet-modal` — Full Character & Equipment Modal (`[C]`, ability scores, combat stats, paperdoll equipment slots).
8. `08-backpack-modal` — Backpack Inventory Modal (`[I]`, item list, equip/unequip controls).
9. `09-chronicle-expanded` — Expanded Bottom Chronicle Drawer (`[H]`, event history log).

### Chromium Verification Metrics (`after` vs. `baseline`):
- **Console Errors (`console.error`):** `0`
- **Uncaught Page Errors (`pageerror`):** `0`
- **Failed Network / Module Requests:** `0`
- **Bounding-Box Layout Diffs (`> 2px` tolerance across `#appShell`, `.top-hud`, `#viewportPanel`, `.action-deck`, `.right-rail`, `#chronicleDrawer`, `#combatHudOverlay`):** `0`
- **Viewport Scroll Overflow (`scrollHeight > clientHeight`):** `0` across all 27 states (`100dvh` zero-scroll invariant preserved).

---

## 4. Gameplay & Secrecy Invariants Verified

- **World Exploration & Turning:** `W/A/S/D`, Arrow keys, and `Q/E` turns behave identically; turning rotates facing without changing coordinates or rolling encounters.
- **Blocked Terrain Handling:** Attempting movement into mountains (`[6,5]`) or rivers (`[8,6]`, `[8,8]`) preserves coordinates and facing atomically and displays concise blocked feedback.
- **Encounter Secrecy (Stage 1):** Neither `GET /api/state` nor the DOM exposes monster species, image paths, HP, AC, or attack bonuses during `DISCOVERED`.
- **Stage 2 Combat & Multi-Beat Playback:** Engaging transitions cleanly to `IN_COMBAT`, renders integrated monster cutouts with anatomical grounding shadows, and plays `HERO` → `MONSTER` → `OUTCOME` beats in order.
- **Character, Inventory, Market, Bounties & Chronicle:** All panels, modals, stance switches, potions, and keyboard shortcuts (`1-3`, `Space`, `C`, `I`, `M`, `B`, `J`, `H`, `?`, `Esc`) operate identically to baseline.
