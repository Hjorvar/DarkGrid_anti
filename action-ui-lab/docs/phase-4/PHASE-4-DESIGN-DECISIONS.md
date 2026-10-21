# Darkgrid Adventure Lab — Phase 4 Design Decisions

## 1. Core Design Philosophy

> **“The player should experience an adventure, not operate a dashboard.”**

Phase 4 reorganizes the **Darkgrid Adventure Lab** (`action-ui-lab/`) interface around **progressive disclosure** and **state-driven contextual hierarchy**. Zero game mechanics, rules, or developer tools were removed—instead, every panel adapts automatically to what the player is doing right now.

---

## 2. The Five Core Player States

| State | Primary Visual Focus | Primary Right-Deck Card (Top Order) | Contextual Action Slots Shown | Movement Deck State |
| :--- | :--- | :--- | :--- | :--- |
| **1. Exploration** | Environment viewport & 1-line directional horizon vista bar | **Navigation (`WASD • QE`)** (`order: 1`) | Only active contextual slots (e.g., `Inspect Landmark` at POIs, `Heal` when wounded) | Full 3×3 movement pad with `Forward [W]` highlighted as primary CTA when passable |
| **2. Threat Detected (Stage 1)** | Center-stage narrative encounter card (`#fp-inscene-threat`) with strict identity secrecy | **Encounter Response** (`order: 1`, amber border) | Full-width `⚔️ Engage Threat [SPC / 1]` + full-width `🏃 Slip Past [4 / F]` (plus `Drink Potion` if wounded) | Locked (`⚠️ Threat Ahead — Engage or Slip Past`) |
| **3. Combat (Stage 2)** | Integrated monster cutout (`#fp-monster-actor`) & compact Monster HUD plate | **Combat Actions** (`order: 1`, crimson border) | Full-width `⚔️ Strike / Ranged Shot [SPC / 1]` + 2-column secondary row (`Drink Potion [2]`, `Attempt Flee [4 / F]`) | Disabled 3×3 movement grid collapses (`display: none`), leaving only `⚠️ Locked in Melee` banner + `Hero / Pack / Market / Board` utility strip |
| **4. Victory / Loot** | Center-stage Victory & Spoils card (`#fp-victory-card`) with explicit `▶ Continue [Space / W]` CTA | **Navigation (`WASD • QE`)** (`order: 1`) + **Victory — Path Clear** (`order: 2`) | `▶ Continue (Resume Travel)` in Slot 1 + `Rest` / `Potion` if wounded | Full 3×3 movement pad unlocked with `Forward [W]` highlighted |
| **5. Town / Safe Interaction** | Oakhaven Sanctuary viewport & landmark inspection prompt | **Sanctuary Actions** (`order: 1`, gold border) + **Navigation** (`order: 2`) | Full-width `🔍 Inspect Landmark` or `⛺ Rest at Sanctuary` | Full 3×3 movement pad + gold-highlighted `⚖️ Market [M]` and `🎯 Board [J]` utility drawers |

---

## 3. Right Sidebar Architecture (`#dm-right-deck`)

### Problem Solved
Previously, `.dm-right-deck` was `348 px` wide and used `grid-template-rows: auto auto minmax(0, 1fr)`, forcing `#dm-movement-deck` to stretch to `559–603 px` tall (`387–431 px` of empty dead space inside a heavy frame). Furthermore, all 4 action slots (`#action-slot-1..4`) were always rendered even when 3 of them were disabled placeholders (`Path Clear`, `Full Health`, `In the Wild`, `No Threat`).

### Solution Implemented
1. **Flex-Start Zero-Dead-Space Stack**:
   - Narrowed `.dm-right-deck` from `clamp(300px, 24vw, 348px)` to `clamp(248px, 19.5vw, 290px)` (`266–282 px` actual width across laptop/desktop) and expanded `.dm-shell` `max-width` from `1560px` to `1860px`.
   - Replaced the stretching `1fr` grid row with `display: flex; flex-direction: column; justify-content: flex-start; gap: 6px;`, reducing `#dm-movement-deck` from `559 px` (`387 px` dead space) to **`182 px` in Exploration (`0 px` dead space)** and **`65 px` in Stage 2 Combat (`0 px` dead space)**.
2. **Dynamic Card Ordering by Game State**:
   - In **Exploration**, `#dm-movement-deck` rises to `order: 1` (top of the right sidebar), `#dm-action-deck-card` is `order: 2`, and `#dm-minimap-card` is `order: 3`.
   - In **Threat (Stage 1)**, **Combat (Stage 2)**, and **Town Sanctuary**, `#dm-action-deck-card` rises to `order: 1` so primary tactical decisions sit at the top of the sidebar.
3. **Contextual Action Slots (`.is-contextual-inactive`)**:
   - Non-applicable filler slots (`Path Clear`, `No Threat` outside encounters, `In the Wild` outside Sanctuary, `Hold Position` during Stage 1) receive `.is-contextual-inactive` and are hidden in Player Mode (`body.dev-mode-collapsed`).
   - Primary actions (`#action-slot-1` when `.has-primary-slot` is active) span the full card width (`grid-column: 1 / -1`) as a prominent horizontal command button.
4. **Compact & Expandable Tactical Minimap (`#dm-minimap-card`)**:
   - Hid the decorative SVG compass rose in Player Mode (leaving the crisp 5×5 tactical grid + directional text readout) and added a `🔍 Expand` / `🗕 Compact` button (`#btn-toggle-minimap-size`) so players can enlarge the map cells on demand.

---

## 4. Environment Viewport & Floating Overlay Prioritization

1. **Viewport Expansion**:
   - At `1920×1080`, `#fp-viewport` expanded from **`1165×949 px` (53.32% of screen)** to **`1530×957 px` (70.61% of screen)** (**+17.29 percentage points**).
   - The inner `#fp-center-stage` canvas grew from **41.15%** to **60.12%** of total screen area (**+18.97 percentage points**).
2. **Compact Top-Left Location Plaque (`#fp-location-plaque`)**:
   - Hid the multi-line `.fp-scene-caption-line` and `.fp-fov-strip` by default in Player Mode (revealing `.fp-fov-strip` on hover), shrinking the plaque from `402×92 px` to **`264×45 px` (-72% area)**.
3. **Deduplicated State & Tension Banners**:
   - Hid `#fp-state-banner` during standard Exploration (`state-wild`) and Town (`state-sanctuary`) because `#header-mode-indicator` in the top bar already displays `🧭 Exploration Mode` / `🏛️ Sanctuary Mode`. It remains visible for high-salience transitions (`⚠️ Threat Detected`, `⚔️ Active Combat`, `🏆 Victory`).
   - Suppressed the duplicate `#fp-tension-ribbon` during Stage 1 (`inDiscovered`), since `#fp-inscene-threat` in `#fp-center-stage` already presents the Stage 1 encounter prompt.
4. **Streamlined Monster HUD Plate (`.fp-monster-hud-plate`)**:
   - Hid duplicate keyboard hints (`.fp-tactical-chip.fp-tactical-hint`, e.g., `Strike: [Space / 1]`) and the idle pre-strike instruction banner (`.fp-combat-exchange-banner.is-initial-exchange`) on Round 1, while preserving monster name, lore size badge, condition quote, active exchange result banner (after attacks resolve), and range/initiative chips.

---

## 5. Champion Header (`#dm-top-deck`) & Equipment Truth

1. **Left-to-Right Visual Priority**:
   - Reordered `.dm-top-deck` via CSS flex `order`:
     1. **Character Identity** (`#hud-hero-card` — Portrait, Name, Class/Level, Sheet `[C]`)
     2. **Vitality & Core Status** (`HP` bar + descriptive state pill + `AC` + `Potions [2]` + `Gold`)
     3. **Equipped Hands & Stance** (`Right Hand Weapon` + `Left Hand Defense/Shield` + `Stance [X]`)
   - Hid the redundant vertical mini-pillars (`.dm-vertical-pillars`) and duplicate `🎒 Pack [B]` button (`#btn-quick-pack`, already in the right utility strip) in Player Mode.
2. **Strict Equipment & Shield AC Truth Preserved**:
   - All server-authoritative weapon preference (`MELEE` vs `RANGED`) and shield AC rules in `character-ui.js` remain 100% intact: when a 2H bow (`Shortbow`) is active in `RANGED` stance, `#off-hand-state-tag` explicitly displays `STOWED (2H BOW)` with `.tag-warn` styling (`rgba(245, 158, 11, 0.16)`) and `#hud-ac` reflects the true unshielded AC (`12` instead of `14`).
