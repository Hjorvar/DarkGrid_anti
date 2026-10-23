# DARKGRID — PHASE 7B: UI IMPLEMENTATION REPORT

**Date:** 2026-10-22  
**Authoritative Spec:** [`PHASE-7A4-FINAL-OWNER-DECISIONS.md`](../phase-7a4/PHASE-7A4-FINAL-OWNER-DECISIONS.md), [`.agents/rules/game-ui.md`](../../../.agents/rules/game-ui.md), [`.agents/rules/encounter-design.md`](../../../.agents/rules/encounter-design.md), [`.agents/rules/language.md`](../../../.agents/rules/language.md)  
**Primary Files:**
- [`action-ui-lab/public/views/character-modals-view.js`](../../public/views/character-modals-view.js)
- [`action-ui-lab/public/views/viewport-view.js`](../../public/views/viewport-view.js)
- [`action-ui-lab/public/app.js`](../../public/app.js)
- [`src/views/character-create.ejs`](../../../src/views/character-create.ejs)
- [`src/views/game.ejs`](../../../src/views/game.ejs)

---

## 1. Character Creation UI (Hero Forge)

Implemented in both the primary playable client (`action-ui-lab`) and the legacy EJS view (`src/views/character-create.ejs`):
- **72-Point Free Allocation Pool:**
  - Interactive `+` / `-` attribute controls for `STR`, `DEX`, `CON`, `INT`, `WIS`, and `CHA`.
  - Enforces creation bounds (`8..18`) and displays remaining unallocated points (`72` total required).
  - Selecting a class (`Fighter`, `Ranger`, `Cleric`) pre-fills that class's balanced 72-point preset (`Reset to Class Preset` button available).
- **Qualitative Attribute Tier Badges:**
  - Displays the qualitative tier label alongside each attribute score (e.g., `Strong`, `Resilient`, `Agile`, `Razor-Quick`, `Wise`, `Unstudied`).
- **Ranger 14-Family Favored Enemy Selector:**
  - Displays all **14** initial selectable monster families with English descriptions.
  - Renders `TERRESTRIAL_MAGICAL_BEASTS` with the exact owner-approved label **"Other Magical Beasts"**.
  - Excludes reserved (`FEY`, `AMPHIBIAN_HUMANOIDS`, `MONSTROUS_HUMANOIDS`, `ABERRATIONS`, `SUBTERRANEAN_HUMANOIDS`), non-selectable (`OOZES`, `CONSTRUCTS`), and forbidden (`UNDEAD`) families.

---

## 2. Champion Sheet & Milestone Attribute Allocation UI

- **Unspent Milestone Attribute Points Banner & `+1` Buttons:**
  - When `character.attribute_points > 0` (earned at Levels `2, 4, 6, 8, 10`), the Champion Sheet displays a golden notification banner and per-attribute `+1` upgrade buttons.
  - Clicking `+1` dispatches `SPEND_ATTRIBUTE_POINT` (`POST /api/action` or `POST /api/character/attributes/spend`) and updates the character sheet immediately.
  - Buttons are automatically disabled during active encounters (`DISCOVERED` or `IN_COMBAT`).
- **Base vs. Effective Attributes & Qualitative Labels:**
  - Clearly distinguishes permanent base score from equipment-boosted effective score across all 9 equipment slots (including `BELT`) and displays each attribute's qualitative tier label.
- **Class Passives & Second Wind Status:**
  - Displays English descriptive summaries of class abilities without exposing raw combat formulas.
  - For Fighters (`Level >= 3`), displays **Second Wind: Ready** or **Second Wind: Spent**.

---

## 3. Combat Viewport & Compendium Monster Knowledge UI

- **Stage 1 Encounter Secrecy Preserved:**
  - During `DISCOVERED` encounters, no monster name, family, or Battle Experience badge is rendered.
- **Stage 2 Combat Qualitative Knowledge Badges:**
  - Once combat begins (`IN_COMBAT`), the monster header displays qualitative badges (**Unfamiliar**, **Recognized**, **Experienced**, **Favored Enemy**, **Know Your Enemy**, **Natural Knowledge**, **Sacred Knowledge**) and English narrative lore notes without exposing hidden monster HP, AC, Attack Bonus, or numeric damage/AC modifiers.
- **Compendium / Champion Sheet Knowledge Log:**
  - Lists only species the hero has actually engaged in Stage 2 combat (`encounters >= 1` or `victories >= 1`), showing qualitative mastery tier (`Unfamiliar` / `Recognized` / `Experienced`), encounter count, and victory count.
