# Track 2 — Player Experience & UI Lead Report

**Date:** 2026-10-20  
**Track:** Track 2 — Player Experience & UI Lead  
**Scope:** `action-ui-lab/public/index.html`, `action-ui-lab/public/action-ui.css`, `action-ui-lab/public/action-ui.js`, `action-ui-lab/tests/player-ui.test.js`

---

## 1. Executive Summary

We audited and overhauled the **Darkgrid Adventure Lab** single-page client interface across all **12 Player Experience & UI areas**, transforming the prototype from an engineering-dense diagnostic harness into a cohesive, player-first dark-fantasy Dungeon Master / Grimrock experience while preserving 100% of the lab's experimental staging, visual comparison, and QA capabilities.

### Key Outcomes
1. **Progressive Disclosure (`dev-mode-collapsed` vs. `dev-mode-visible`)**: The top header bar now defaults to a clean **Player Mode** showing the Darkgrid brand, live gameplay mode badge (`#header-mode-indicator`), Expedition Journal trigger (`📖 Journal [L]`), Controls Guide (`❓ Help [?]`), and a collapsible `🛠️ Lab Tools [~]` toggle. All 25+ developer/diagnostic controls (`Scene A/B/C/Legacy`, `FX Off/Subtle/Full`, `Cutout/Card/Blend/Frame`, `PF1e Size Lab`, `Adventure vs. Current`, `Class Switcher`, `Scenario Staging`, `Director`, `World Atlas`, `Visual QA`) remain in the DOM inside `#lab-devtools-drawer` and expand on demand via click or `` ` `` / `~`.
2. **Mode-Reactive UI State (`syncUiModeClasses`)**: `document.body` and `#dm-shell` dynamically synchronize `.ui-mode-exploration`, `.ui-mode-town`, and `.ui-mode-combat` (`.ui-combat-stage1`, `.ui-combat-stage2`), adapting the header mode indicator, Tactical Action Deck header (`#action-deck-heading`), border accents, and navigation pad combat lock banner (`#dm-nav-combat-banner`).
3. **Decluttered First-Person Viewport & Hidden-Numbers Combat Plate**:
   - In **Player Mode**, technical tags (`Scene C • Tier 1 Exact POV`, `✦ In-Scene Cutout`, `🛡️ Card Fallback`, and pixel/trim dimensions `252×360px • ×1.18`) are automatically hidden via `.dev-only-badge`, leaving only diegetic lore (`[M] Creature Name`, `📏 Size`, `🎯 Quarry`, `🦅 Airborne`, condition quote, and the 3 tactical chips).
   - Expanding **Lab Tools** (`dev-mode-visible`) immediately reveals all technical POV tiers, cutout badges, and pixel/scale telemetry (`#monster-tech-dims`).
4. **Compact & Expandable Bottom Chronicle (`#fp-bottom-chronicle`)**: Retains its zero-scroll 2-line footprint by default (`56px–84px`) so it never steals height from the 1st-person painting, while adding a `▴ History [H]` toggle (`#btn-toggle-chronicle`) backed by a 28-entry ring buffer (`chronicleHistoryBuffer`) so players can inspect recent combat rounds and tile chronicles on demand.
5. **Tactical Action Deck & Top Champion Deck Upgrades**:
   - **Slot 1 (`[SPC/1]`)** now dynamically adapts across 4 states: **Weapon Strike** (Stage 2 Combat), **Engage Threat / Face Ambush** (Stage 1 Shadow), **Sanctuary Rest** (Safe Haven), and **Inspect Landmark (`🔍`)** when facing an environmental Point of Interest in exploration.
   - **Top Champion Deck** features a clickable Champion Sheet identity trigger (`#hud-hero-card` `[C]`), explicit hand state tags (`#main-hand-state-tag`, `#off-hand-state-tag`), quick Stance/Backpack buttons (`#btn-quick-stance`, `#btn-quick-pack`), descriptive HP condition pill (`#hud-hp-state-pill`: `Uninjured`, `Bruised`, `Bloodied`, `Critical`, `Fallen`), and an interactive Potion Flask chip (`#hud-potion-chip`).
6. **Quest, Expedition & Bounty Tracker Pill**: Fixed duplicate `[x,y]` coordinate rendering in `#btn-expedition-pill` and added active Bounty Contract status tracking (`#btn-bounty-tracker-pill` / bounty region suffix) so players always have clear directional guidance.
7. **Controls & Tactical Guide Modal (`[?]`) & Accessibility**: Added `renderHelpModal` (`openLabModal('help')`), conflict-free hotkeys (`H` Chronicle History, `?` Help, `` ` ``/`~` Lab Tools, `Esc` layered close), semantic ARIA attributes (`aria-expanded`, `aria-controls`), and high-contrast `:focus-visible` gold outlines.

---

## 2. Detailed Breakdown by UI Area (Areas 1–12)

| # | UI Area | Before (Audit Findings) | After (Track 2 Overhaul) |
| :- | :--- | :--- | :--- |
| **1** | **Overall Layout & Visual Hierarchy** | Top header crammed 28+ developer buttons into the primary player view, competing with the Champion Deck and Viewport. | Progressive disclosure separates Player Mode (`#header-mode-indicator`, `Journal [L]`, `Help [?]`, `Lab Tools [~]`) from `#lab-devtools-drawer`. |
| **2** | **Exploration vs. Combat vs. Town Mode** | Subtle banner changes; navigation pad looked identical in combat vs. exploration. | `syncUiModeClasses()` toggles `.ui-mode-exploration`, `.ui-mode-town`, `.ui-mode-combat` (`stage1`/`stage2`), updating `#action-deck-heading` and `#dm-nav-combat-banner`. |
| **3** | **Character Creation / Selection / Identity** | Class switcher only in dev header; hero identity card didn't indicate it opens the Champion Sheet. | `#hud-hero-card` is a keyboard-accessible button with `[C]` badge; `switchHeroClass()` and `triggerSpawnMonster()` wired cleanly in Director modal. |
| **4** | **Hero Status, Vitals & Equipment Readability** | Raw HP numbers only; hand slots lacked explicit active/stowed/locked badges. | Added `#hud-hp-state-pill` (`Uninjured`/`Bruised`/`Bloodied`/`Critical`), `#main-hand-state-tag`, `#off-hand-state-tag`, `#btn-quick-stance`, `#btn-quick-pack`, and clickable `#hud-potion-chip`. |
| **5** | **World / Map / Navigation Presentation** | Top-left location plaque showed technical `Scene C • Tier 1 Exact POV`; bottom vista bar showed technical `Tier X` text. | Technical POV tier badges wrapped in `.dev-only-badge` (hidden in Player Mode, shown in Dev Mode). Vista bar auto-subdues (`.is-subdued-vista`) when a discovery card is open. |
| **6** | **Action Controls & Decision Clarity** | Slot 1 was disabled (`No Threat Here`) throughout wilderness exploration even when standing at a Landmark POI; movement pad lacked a combat lock banner. | Slot 1 enables `🔍 Inspect Landmark` when a POI is present; `#dm-movement-deck` displays `#dm-nav-combat-banner` and `.is-combat-locked` during melee/ambush. |
| **7** | **Log / Chronicle / Narrative Readability** | Chronicle only kept the current tile or single round; no way to review previous combat rounds without opening a modal. | Added `chronicleHistoryBuffer` (up to 28 entries) and `#btn-toggle-chronicle` (`▴ History [H]`) to expand/collapse `#fp-bottom-chronicle` smoothly. |
| **8** | **Inventory, Loot & Shop Presentation** | Backpack and Stance required reaching the bottom-right utility strip; potion chip in top bar was static. | Added quick Stance/Pack buttons next to equipped hands, clickable potion chip (`#hud-potion-chip`), and clean `[Equipped]` / `[Drink]` actions in Backpack modal. |
| **9** | **Quest / Bounty / Rumor / Town Hub** | Expedition pill rendered duplicate coordinates (`[7,6] [7,6]`); active bounties weren't surfaced in the top-right tracker. | Deduplicated waypoint coordinates in `#btn-expedition-pill` and surfaced active bounty contract status (`🎯`) in the top-right tracker pill. |
| **10** | **Monster Presentation & Combat Feedback** | Monster plate showed `✦ In-Scene Cutout` and lacked a clean Player vs. Dev telemetry split. | Player Mode shows only diegetic lore (`[M] Name`, `📏 Size`, condition quote, 3 tactical chips); Dev Mode reveals `✦ In-Scene Cutout` and `#monster-tech-dims` (`W×Hpx • ×Trim`). |
| **11** | **Responsiveness, Spacing & Polish** | Quick equipment actions and dense toolbars needed graceful responsive breakpoints across `1920×1080`, `1440×900`, and `1280×800`. | Preserved `100dvh` zero-scroll layout (`overflow: hidden`), custom dark-fantasy scrollbars, and responsive breakpoints (`@media (max-width: 1380px)`, `@media (max-height: 820px)`). |
| **12** | **Accessibility, Keyboard & QoL** | Missing dedicated Controls Help modal and hotkeys for Chronicle expansion or Dev Tools toggle. | Added `❓ Help [?]` modal (`#help-controls-grid`), hotkeys `[H]`, `[?]`, `` [`/~] ``, layered `[Esc]` dismissal, and high-contrast `:focus-visible` outlines. |

---

## 3. Verification & Automated Test Results

Both the existing 32-test regression suite and the new 9-test Player Experience & UI suite pass 100%:

- `node --test action-ui-lab/tests/action-lab.test.js` — **32 / 32 PASS**
- `node --test action-ui-lab/tests/player-ui.test.js` — **9 / 9 PASS**
