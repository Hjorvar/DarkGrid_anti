# DARKGRID — PHASE 6.1: PLAYER-FACING UI REVIEW & POLISH

**Date:** 2026-10-22  
**Branch:** `darkgrid_legacy_integration`  
**Scope:** Critical Review & Polish of the 5 Player Workflows across Desktop (`1920x1080`), Laptop (`1366x768`), and Mobile (`390x844`)

---

## 1. Review of Phase 6 Screenshot Workflows (Before vs. After Phase 6.1)

During the independent visual audit of the Phase 6 screenshots (`action-ui-lab/docs/phase-6/screenshots/`), we identified specific typography, visual hierarchy, data-formatting, and UX consistency issues across the five core player workflows and resolved each one while preserving the approved dark fantasy theme, world artwork, and monster scaling.

### 1.1 Workflow 1: Character Creation (Account & Hero Forge)
- **Phase 6 Issues Found:**
  1. **Rule Contradiction:** Displayed *"Submitting a new hero will retire the current active hero in this session"* with an enabled `"⚔️ Forge 71-Point Hero"` button even when the player already had a living hero.
  2. **Unstyled Controls:** Native browser `<input>` and `<select>` controls lacked consistent dark fantasy borders, focus rings, and spacing; the 2-column grid didn't collapse cleanly on mobile (`390x844`).
- **Phase 6.1 Polish Applied:**
  1. Added `.forge-living-lock-banner` when a living champion is active on the account: *"⚠️ Active Champion in Service: Vaelen Ironhand (Level 1 FIGHTER) currently walks the realm. Darkgrid enforces one living champion per account—a new hero can only be forged if your champion falls in combat."*
  2. Disabled the `"🔒 Active Champion in Service (1 Living Hero Max)"` button whenever a living champion exists on the account.
  3. Styled `.lab-input` and `.lab-select` with dark obsidian backgrounds (`#0c1018`), antique bronze borders, and gold focus states; added `.forge-top-grid` and `.forge-stat-grid` responsive classes.
- **Verified Screenshots:**
  - `action-ui-lab/docs/phase-6.1/screenshots/01b-character-forge-ready.png` (`1920x1080` — Ready to forge when no living hero exists)
  - `action-ui-lab/docs/phase-6.1/screenshots/01-character-forge-living-lock.png` (`1920x1080` — Active Champion Lock Banner when living hero exists)
  - `action-ui-lab/docs/phase-6.1/screenshots/07-mobile-390x844-forge.png` (`390x844` — Mobile single-column layout)

### 1.2 Workflow 2: Champion Sheet (`[C]`)
- **Phase 6 Issues Found:**
  1. The 9-Slot Equipped Panoply cards only showed the item name (`Longsword`, `Chain Shirt`) and `[Unequip]` button without showing the item's mechanical stats (`1d8`, `+4 Armor AC`, `+1 Shield AC`).
  2. Grid layouts used inline `grid-template-columns: repeat(3, 1fr)` that crowded mobile screens.
- **Phase 6.1 Polish Applied:**
  1. Added `formatPanoplyBonusSummary(eq)` in `inventory-ui.js` so each equipped slot displays its mechanical contribution in gold monospace (`1d8`, `1d6 (2H)`, `+4 Armor AC`, `+1 Shield AC`, `+1 ATK / +1 DMG`) right beside the `[Unequip]` action.
  2. Replaced inline grids with `.champ-ability-grid`, `.champ-save-grid`, and `.champ-panoply-grid` (`responsive.css` adapts to 2 columns on mobile).
- **Verified Screenshot:**
  - `action-ui-lab/docs/phase-6.1/screenshots/02-champion-sheet-panoply.png` (`1920x1080`)

### 1.3 Workflow 3: Oakhaven Market (`[M]`)
- **Phase 6 Issues Found:**
  1. **Raw JSON Array Displayed to Players:** Every market row printed raw JSON `["FIGHTER","RANGER","CLERIC"]` directly in the item subtitle (`AC +0 • Max DEX 99 • ["FIGHTER","RANGER","CLERIC"]`).
  2. **Misleading Consignment Description:** The Sell tab header stated *"Consign unequipped gear for 50% gold value"* even though canonical `src/domain/market/index.js` pays **50%** for mundane items and **40%** for magical (`+1`/`+2`/`+3`) items (resold at **125%** in the Consigned Relics tab).
  3. **Dense Unstructured Text:** Weapon damage, armor AC, Max DEX, and class restrictions were concatenated into a single grey string.
- **Phase 6.1 Polish Applied:**
  1. Added `formatAllowedClassesLabel(rawClasses)` and `buildItemStatChipsHtml(it)` in `inventory-ui.js`.
  2. Replaced raw JSON strings with structured `.item-stat-chip` badges (`WEAPON`, `1d8 DMG`, `Two-Handed`, `ARMOR`, `+4 Armor AC (Max DEX +4)`, `Fighter / Cleric Only`, `Heals +1d8+1 HP`).
  3. Updated the Sell tab header to accurately explain: *"Mundane gear sells for 50% base value; magical relics (+1/+2/+3) consign for 40% and enter the Consigned Relics pool (125% resale)."*
- **Verified Screenshots:**
  - `action-ui-lab/docs/phase-6.1/screenshots/03-oakhaven-market-polished.png` (`1920x1080`)
  - `action-ui-lab/docs/phase-6.1/screenshots/06-laptop-1366x768-market.png` (`1366x768`)

### 1.4 Workflow 4: The Watcher's Board (`[J]`)
- **Phase 6 Issues Found:**
  1. **Missing Warrant Fields (`undefined`):** The frontend referenced `c.title` and `c.region_name`, whereas SQLite `bounty_contracts` stores `target_title`, `monster_name`, and `direction_hint`, causing `📜 undefined` and `Region: undefined` to render in the Phase 6 screenshot.
  2. **Grammar Bug in Canonical Seed Descriptions:** Vowel-initial monsters produced `"a Assassin Vine"` and `"a Owlbear"` in warrant descriptions.
  3. **Card Layout:** `.warrant-card` lacked vertical flex direction (`flex-direction: column`), causing header, metadata, and description to squeeze horizontally.
- **Phase 6.1 Polish Applied:**
  1. Normalized `bountyContracts` and `wildernessThreats` in `client-state-service.js` (`normalizeBountyContractForUi` & `normalizeThreatRumorForUi`), providing computed `contract_title`, `target_region`, `monster_name`, `target_title`, and fixing `\ba ([AEIOUaeiou])` grammar to `an $1`.
  2. Styled `.warrant-card` with vertical stacking (`flex-direction: column`), distinct `.warrant-header`, `.warrant-meta-row` (`🗺️ Region` and `👾 Quarry`), and italicized lore quote.
- **Verified Screenshot:**
  - `action-ui-lab/docs/phase-6.1/screenshots/04-watchers-board-polished.png` (`1920x1080`)

### 1.5 Workflow 5: Combat Presentation & Top HUD
- **Phase 6 Issues Found:**
  1. **Top HUD Hero Name Truncation:** `.dm-hero-name` had `max-width: 128px`, truncating `"VAELEN IRONHAND"` into `"VAELEN IRONHA..."`.
  2. **Developer Toggle Visible to Production Players:** The `🛠️ Lab Tools [\`]` button and ``[`]`` shortcut were exposed even when `labToolsAllowed` was `false`.
- **Phase 6.1 Polish Applied:**
  1. Widened `.dm-identity-block` (`max-width: 245px`) and `.dm-hero-name` (`max-width: 195px`) in `character.css`, verified programmatically in headless Chrome (`scrollWidth <= clientWidth`).
  2. Hidden `#btn-toggle-devtools` and disabled the ``[`]`` shortcut when `state.session.labToolsAllowed === false`.
- **Verified Screenshot:**
  - `action-ui-lab/docs/phase-6.1/screenshots/05-combat-presentation.png` (`1920x1080`)
