# DARKGRID — PHASE 9A: VISUAL QA REPORT
## Headless Chrome DOM, Canvas & Screenshot Verification (`1440×900`, `1280×720`, `1920×1080`)

---

## 1. Visual QA Execution Summary

- **Phase 9A Visual QA Script:** `node action-ui-lab/tests/phase9a-visual-qa.js` — **7 / 7 screenshots captured, 0 console errors, 0 page exceptions**
- **Phase 8 Multi-Resolution Regression Script:** `node action-ui-lab/tests/phase8-visual-qa.js` — **14 / 14 screenshots captured, 0 console errors, 0 page exceptions**
- **Screenshot Output Directories:**
  - `action-ui-lab/docs/screenshots/phase-9a/`
  - `docs/screenshots/phase-9a/`

---

## 2. Phase 9A Captured Screenshots & DOM Verification

| # | File | State Verified | DOM / Visual Assertions |
|---|---|---|---|
| **01** | `01-oakhaven-landmark-scene.png` | **Oakhaven Major Landmark Scene** (`[15, 27]`) | `#major-landmark-scene-panel[data-scene-key="OAKHAVEN"]` visible; `#topdown-map-stage` temporarily hidden (`display: none`); renders `terrain_city_oakhaven.webp` + **Rest / Heal**, **Shop [M]**, **Quests & Bounties [J]**, **Accept Quest**, and **Continue Exploring** buttons. |
| **02** | `02-oakhaven-continue-exploring-map.png` | **Continue Exploring -> 2D Map Restored** (`[15, 27]`) | Clicking **Continue Exploring** (`DISMISS_LANDMARK_SCENE`) hides `#major-landmark-scene-panel` and restores `#topdown-map-canvas`; executing `REST` and opening/closing the Shop modal does **not** re-open the Landmark Scene; compact `🖼️ Sanctuary View` button (`#btn-reopen-landmark-scene`) is available in the bottom bar. |
| **03** | `03-encounter-spotted-fight-avoid.png` | **Spotted `ENCOUNTER` (`Hero Spotted Threat First`)** | `#fp-inscene-threat` displays `👁️ ENCOUNTER — THREAT SPOTTED AHEAD`, situational lore clue, and **Fight [Space]** (`#btn-encounter-fight`) + **Avoid [4 / F]** (`#btn-encounter-avoid`) buttons; right-hand Tactical Deck shows `FIGHT` (`SPC / 1`) and `AVOID` (`4 / F`); zero secret combat stats leaked. |
| **04** | `04-ambush-combat-flee-locked-round1.png` | **`AMBUSH` Combat — Round 1 (Flee Locked)** | Skips Avoid screen and enters `IN_COMBAT` (`Round 1`); displays crimson `#combat-ambush-banner` (`⚠️ AMBUSH! CAUGHT OFF GUARD — RETREAT IS LOCKED FOR 2 MORE ROUNDS (ROUND 1/2)!`); `#action-slot-4` is disabled with `🔒 FLEE LOCKED — Ambush (2 Rds Left)`; server rejects `FLEE` with `HTTP 400`. |
| **05** | `05-ambush-combat-flee-unlocked-round3.png` | **`AMBUSH` Combat — Round 3 (Flee Unlocked)** | After 2 full combat rounds (`Round 3`), `#combat-ambush-banner` updates to `⚡ AMBUSH SURVIVED (ROUND 3) — RETREAT PATH IS NOW OPEN [4 / F]!`; `#action-slot-4` is enabled with `🏃 FLEE BATTLE — Provokes AoO`. |
| **06** | `06-stronghold-landmark-scene.png` | **Goblin Stronghold Major Landmark Scene** (`[15, 2]`) | Arriving at `[15, 2]` auto-opens `#major-landmark-scene-panel[data-scene-key="GOBLIN_STRONGHOLD"]` with `terrain_town_gates.webp`, temporarily hiding `#topdown-map-stage`; renders **Challenge the Goblin Chieftain** and **Continue Exploring**. |
| **07** | `07-stronghold-boss-combat.png` | **Stronghold Boss Combat (`Warchief Grak`)** | Clicking **Challenge the Goblin Chieftain** transitions immediately to `IN_COMBAT` against `Warchief Grak the Goblin Chieftain`; `state.landmarkScene` is `null` and `#major-landmark-scene-panel` is removed from the DOM so Combat and Landmark Scene never overlap. |

---

## 3. Multi-Resolution Desktop Layout Audit (`phase8-visual-qa.js`)

| Resolution | Viewport Width Ratio | Map Canvas Dimensions | Vertical Page Overflow | Result |
|---|---:|---:|---|---|
| `1280 × 720` | `0.818` | `1030 × 623 px` | `false` (`0 px`) | **PASS** |
| `1440 × 900` | `0.820` | `1164 × 795 px` | `false` (`0 px`) | **PASS** |
| `1920 × 1080` | `0.857` | `1566 × 963 px` | `false` (`0 px`) | **PASS** |
