# DARKGRID — PHASE 6: REAL BROWSER VISUAL QA REPORT

**Date:** 2026-10-22  
**Browser:** Headless Google Chrome (`1920×1080`, `1440×900`, `1366×768`, `1280×800`, `390×844`) via Chrome DevTools Protocol (CDP)  
**Screenshots Directory:** `action-ui-lab/docs/phase-6/screenshots/`

---

## 1. Visual QA Summary

All Phase 6 integrated UI workflows and all Phase 1–5.2B visual systems were inspected in a real headless Chrome browser session against a live SQLite backend.

- **Console Errors:** `0`
- **Uncaught Page Exceptions:** `0`
- **Failed Network / Asset Requests (`HTTP >= 400`):** `0`
- **Viewport Scroll Overflow (`1920×1080`):** `0px` (strictly locked to `100dvh` zero-scroll layout)

---

## 2. Verified Screens & Captured Evidence

### 2.1 Account & 71-Point Character Forge (`01_phase6_account_and_71pt_creator.png`)
- Accessible from the top bar (`👤 Account`) and from the Fallen Hero screen (`⚒️ Custom Hero Forge (71-Point)`).
- Displays active account status, Sign In / Create Account / Sign Out controls, and the interactive **71-Point Point-Buy Character Forge**.
- Verified class cards (`FIGHTER`, `RANGER`, `CLERIC`) with base stats, `-` / `+` attribute controls, live Remaining Points badge (`3` -> `0`), Ranger **Favored Enemy** + **Humanoid Subtype** selector, and Starting Weapon Stance (`MELEE` / `RANGED`).

### 2.2 Champion Sheet — Saving Throws, Class Pillars & 9-Slot Panoply (`02_phase6_champion_sheet_saving_throws_abilities.png`)
- Displays Hero Name, Level, Class, Vitality (`HP / Max HP`), Armor Class (`AC`), Experience (`XP / XP for Next Level`), and Gold Purse.
- Displays all 6 attributes with modifiers and `+2 Belt` indicator when `Belt of Giant Strength +2` is equipped.
- Displays **Saving Throws & Combat Readiness** (`Fortitude`, `Reflex`, `Will`, `Physical` / `Sacred vs Undead`).
- Displays **Class Pillars & Progression Tiers** (e.g., Fighter Weapon/Armor Training, Ranger Keen Senses / Opening Shot / Favored Enemy, Cleric Holy Radiance / Sacred Self-Heal).
- Displays all **9 Equipment Slots** (`Melee`, `Ranged`, `Armor`, `Shield`, `Ring`, `Cloak`, `Neck`, `Belt`, `Feet`).

### 2.3 Oakhaven Market — Standard Stock, Global Magical Resale & Sell Backpack (`03_phase6_oakhaven_market_tabs.png`)
- Verified 3 interactive market tabs:
  1. `🏪 Standard Stock` with category filter pills (`ALL`, `WEAPON`, `ARMOR`, `SHIELD`, `ACCESSORY`, `POTION`) and Charisma-adjusted pricing (showing strikethrough base price when discounted/surcharged).
  2. `✦ Magical Resale Market` displaying player-consigned magical relics from `market_listings` at `125%` resale price, purchasable across accounts via `listingId`.
  3. `🪙 Sell Backpack Gear` listing unequipped backpack items with `50%` standard sell value, `✦ Consigns to Global Resale (125%)` badge for magical items, and `Starter Gear (Unsellable)` protection lock.

### 2.4 The Watcher's Board — Hunting Warrants & Wilderness Threats (`04_phase6_watchers_board_warrants_and_threats.png`)
- **Active Hunting Warrant Banner:** Shows accepted contract title, target region, compass bearing from Oakhaven, gold reward, and `✕ Abandon Warrant` button.
- **Section A — Daily Hunting Warrants:** Lists the 3 daily contracts with threat/boost badges (`TOUGH`, `AGGRESSIVE`, `BRUTAL`) and `Accept` / `Abandon` buttons.
- **Section B — Wilderness Threat Intelligence:** Reports active persistent hero-slayers (`monster_instances`) by compass bearing from Oakhaven and confirmed fallen champion kill count while keeping monster species and coordinates concealed.

### 2.5 Live World Exploration & Stage 2 Combat (`05_phase6_live_combat_presentation.png`)
- Preserves Phase 3–5.2B first-person POV terrain paintings, atmospheric effects, PF1e monster size scaling, RGBA cutout grounding shadows, hidden monster math, and compact 4-slot tactical action deck.
