# Darkgrid Adventure Lab — Phase 4 Visual QA Report

## 1. Visual QA Methodology

All 11 Before (`before_*.png`) and 11 After (`after_*.png`) screenshots were captured from a live headless Chromium session via Chrome DevTools Protocol (`action-ui-lab/docs/phase-4/screenshots/`) across all 5 core player states and all 4 required resolutions (`1920×1080`, `1366×768`, `1280×800`, and `390×844`).

---

## 2. Before & After Screenshot Inventory

| # | State / Resolution | Before Screenshot | After Screenshot | Visual QA Verdict |
| :-: | :--- | :--- | :--- | :---: |
| **01** | **Exploration (`1920×1080`)** | `before_01_exploration_1920x1080.png` | `after_01_exploration_1920x1080.png` | **PASS** — Viewport grew from `53.32%` to `70.61%` of screen; Navigation card is at top of right sidebar with `0 px` dead space; concise 1-line vista pill at bottom of forest |
| **02** | **Exploration (`1366×768`)** | `before_02_exploration_1366x768.png` | `after_02_exploration_1366x768.png` | **PASS** — Viewport grew from `55.69%` to `65.91%`; zero scrollbars (`scrollW: 1366, scrollH: 768`); all 3 right-sidebar cards fit cleanly |
| **03** | **Exploration (`1280×800`)** | `before_03_exploration_1280x800.png` | `after_03_exploration_1280x800.png` | **PASS** — Viewport grew from `57.21%` to `66.85%`; zero scrollbars (`scrollW: 1280, scrollH: 800`) |
| **04** | **Threat Detected — Stage 1 (`1920×1080`)** | `before_04_threat_detected.png` | `after_04_threat_detected.png` | **PASS** — `Encounter Response` card rises to `order: 1` with full-width `Engage Threat [SPC / 1]` and `Slip Past [4 / F]`; duplicate tension ribbon & POI badge hidden; strict Stage 1 monster secrecy preserved |
| **05** | **Combat — Small Monster (`1920×1080` Goblin)** | `before_05_combat_small_monster.png` | `after_05_combat_small_monster.png` | **PASS** — `Combat Actions` card at `order: 1` with full-width `Strike [SPC / 1]` + 2-column `Drink Potion [2]` / `Attempt Flee [4 / F]`; disabled 3×3 movement grid collapsed (`65 px` compact card); Goblin cutout & shadow grounded |
| **06** | **Combat — Large Monster (`1920×1080` Ogre)** | `before_06_combat_large_monster.png` | `after_06_combat_large_monster.png` | **PASS** — Ogre (`LARGE` 297×340 px) dominates center stage; compact Monster HUD plate (`298×68 px` on Round 1) never covers creature silhouette |
| **07** | **Combat — Huge Monster (`1920×1080` Stone Giant)** | `before_07_combat_huge_monster.png` | `after_07_combat_huge_monster.png` | **PASS** — Stone Giant (`HUGE` 393×449 px) has full head-to-toe clearance inside the `1528×816 px` center stage |
| **08** | **Victory / Loot (`1920×1080`)** | `before_08_victory_state.png` | `after_08_victory_state.png` | **PASS** — Center-stage Victory card displays XP/Gold/Loot and explicit `▶ Continue [Space / W]` button; right sidebar unlocks `Forward [W]` and `▶ Continue (Resume Travel)` |
| **09** | **Town Sanctuary (`1920×1080` Oakhaven)** | `before_09_town_state.png` | `after_09_town_state.png` | **PASS** — `Sanctuary Actions` card at `order: 1` (`Inspect Landmark [SPC / 1]`); `Market [M]` and `Board [J]` highlighted in gold inside the 2×2 utility strip |
| **10** | **Mobile Portrait (`390×844`)** | `before_10_mobile_390x844.png` | `after_10_mobile_390x844.png` | **PASS** — Top header stacks cleanly into 2 rows (Vitality/AC/Gold/Potions + 2-column Weapon/Shield slots); Mirkwood vista clearly visible; Navigation & Quick Actions accessible below viewport |
| **11** | **Lab Tools Expanded (`1920×1080`)** | `before_11_lab_tools_open.png` | `after_11_lab_tools_open.png` | **PASS** — Toggling `🛠️ Lab Tools` (`[` / `~`) reveals all Scene (`A/B/C`), Monster (`Integrated/Card`), `📐 Scale`, `🎬 Director`, `🗺️ Atlas`, and `✅ QA` tools plus technical badges |

---

## 3. Multi-Resolution Viewport Audit Summary

| Resolution | `#fp-viewport` Box | `#fp-viewport` % of Screen | `#fp-center-stage` % of Screen | `#dm-movement-deck` Dead Space | Scroll Overflow (`scrollW × scrollH`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`1920 × 1080` (Desktop 1080p)** | `1530 × 957 px` | **70.61%** (was 53.32%) | **60.12%** (was 41.15%) | **`0 px`** (was 387 px) | `1920 × 1080` (Zero scroll) |
| **`1366 × 768` (Laptop)** | `1079 × 641 px` | **65.91%** (was 55.69%) | **50.36%** (was 37.98%) | **`0 px`** (was 147 px) | `1366 × 768` (Zero scroll) |
| **`1280 × 800` (16:10 Handheld/Laptop)** | `998 × 686 px` | **66.85%** (was 57.21%) | **53.20%** (was 39.20%) | **`0 px`** (was 188 px) | `1280 × 800` (Zero scroll) |
| **`390 × 844` (Mobile Portrait)** | `380 × 322 px` | **37.18%** | **25.73%** | **`0 px`** | `390` width (Zero horizontal overflow) |
