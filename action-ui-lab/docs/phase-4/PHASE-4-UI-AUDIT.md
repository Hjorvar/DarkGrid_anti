# Phase 4 – Player UI Audit & Baseline Measurements

## 1. Executive Summary

Prior to Phase 4, the **Darkgrid Adventure Lab** (`action-ui-lab/`) had evolved through Phases 1–3.1 into a rich first-person adventure prototype with cohesive directional POV scenes, atmospheric effects, and adaptive Pathfinder 1e monster scaling. However, its outer interface still functioned like a dense control dashboard rather than an adventure-first viewport:

- At `1920×1080`, **only 53.32% of the total screen area** (`1165×949 px`) was allocated to the first-person viewport frame (`#fp-viewport`), and after subtracting the internal top HUD (`126 px`), bottom Chronicle (`84 px`), and vista bar (`77 px`), the unobstructed center stage (`#fp-center-stage`) accounted for **only 41.15% of the screen**.
- A `1560 px` max-width cap on `.dm-shell` left **360 px of empty black side margins (21.46% of the entire `1920×1080` screen)** unused on desktop monitors.
- Inside the right-hand sidebar (`.dm-right-deck`, `355 px` wide), `grid-template-rows: auto auto minmax(0, 1fr)` stretched the `#dm-movement-deck` card to `596–607 px` tall while capping `.dm-pad-grid` at `156 px`—producing **366 px to 387 px of empty dark void** inside the Navigation frame at `1920×1080` (and **431 px of dead space** during Stage 2 combat while all 9 movement buttons sat disabled).
- On mobile portrait (`390×844`), the Champion Header overlapped hand-slot labels against `.dm-vertical-pillars`, and `.dm-right-deck` (`max-height: 28vh`) cut off `#dm-movement-deck` below `#dm-minimap-card` and `#dm-action-deck-card`, leaving mobile players unable to see the movement pad.

---

## 2. Baseline Screen-Space Measurements (Pre-Phase 4)

All baseline measurements were captured in headless Chromium via `action-ui-lab/docs/phase-4/baseline-measurements.json`.

### 2.1 Desktop `1920×1080` (`2,073,600 px²` total screen area)

| UI Region | Selector | Exploration (`1920×1080`) | Stage 1 Threat (`1920×1080`) | Stage 2 Combat (`1920×1080`) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Top Director Bar** | `#lab-director-bar` | `1920×34 px` (**3.15%**) | `1920×34 px` (**3.15%**) | `1920×34 px` (**3.15%**) | Contains mode indicator + Journal / Controls / Lab Tools |
| **Main Shell** | `#dm-shell` | `1560×1046 px` (**78.69%**) | `1560×1046 px` (**78.69%**) | `1560×1046 px` (**78.69%**) | **21.46% of screen lost** to left/right `180 px` outer margins |
| **Champion Header** | `#dm-top-deck` | `1532×72 px` (**5.32%**) | `1532×72 px` (**5.32%**) | `1532×72 px` (**5.32%**) | Redundant vertical pillars + duplicate Stance/Pack buttons |
| **Environment Viewport** | `#fp-viewport` | `1165×949 px` (**53.32%**) | `1165×949 px` (**53.32%**) | `1165×949 px` (**53.32%**) | Constrained by narrow shell and wide `355 px` right sidebar |
| **Unobstructed Stage** | `#fp-center-stage` | `1161×735 px` (**41.15%**) | `1161×707 px` (**39.58%**) | `1161×767 px` (**42.94%**) | Reduced by tall top plaque (`96 px`), vista bar (`77 px`), and Chronicle (`84 px`) |
| **Location Plaque** | `#fp-location-plaque` | `347×96 px` (**1.61%**) | `347×96 px` (**1.61%**) | `238×64 px` (**0.73%**) | 4 stacked rows repeating facing, scene caption, and 3-way FOV |
| **Bottom Chronicle** | `#fp-bottom-chronicle` | `1161×84 px` (**4.70%**) | `1161×84 px` (**4.70%**) | `1161×84 px` (**4.70%**) | Always `84 px` tall even for 1 line of text + long hotkey legend |
| **Right Sidebar** | `.dm-right-deck` | `355×949 px` (**16.25%**) | `355×949 px` (**16.25%**) | `355×949 px` (**16.25%**) | Fixed 3-row grid (`Minimap` → `Actions` → `Navigation`) |
| **Tactical Minimap** | `#dm-minimap-card` | `355×202 px` (**3.46%**) | `355×202 px` (**3.46%**) | `355×191 px` (**3.27%**) | Includes large compass ring duplicating facing/ahead text |
| **Action Deck** | `#dm-action-deck-card` | `355×135 px` (**2.31%**) | `355×135 px` (**2.31%**) | `355×135 px` (**2.31%**) | Shows 2 disabled filler tiles (`Path Clear`, `No Threat`) in exploration |
| **Navigation Card** | `#dm-movement-deck` | `355×596 px` (**10.20%**) | `355×596 px` (**10.20%**) | `355×607 px` (**10.39%**) | **366 px–387 px vertical dead space** (and **431 px** in combat) |

### 2.2 Multi-Resolution Baseline Comparison (Exploration)

| Viewport Resolution | `#fp-viewport` Area (%) | `#fp-center-stage` Area (%) | `.dm-right-deck` Area (%) | `#dm-movement-deck` Dead Space | Layout Issues Observed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`1920×1080` Desktop** | `1165×949` (**53.32%**) | `1161×735` (**41.15%**) | `355×949` (**16.25%**) | **387 px** vertical void | `360 px` wasted horizontal outer margins; huge empty box in Navigation card |
| **`1366×768` Laptop** | `1040×661` (**65.53%**) | `1036×453` (**44.74%**) | `302×661` (**19.03%**) | **133 px** vertical void | Dense 4-line location plaque + 3-line vista bar + 4-column action tiles |
| **`1280×800` Handheld** | `968×693` (**67.08%**) | `964×485` (**46.75%**) | `288×693` (**19.96%**) | **159 px** vertical void | Small 4-column action buttons; duplicate compass & mode banners |
| **`390×844` Mobile** | `380×486` (**56.11%**) | `376×398` (**45.45%**) | `380×236` (**27.24%**) | Movement pad **cut off** | Hand slot text overlaps `.dm-vertical-pillars`; `#dm-movement-deck` pushed off-screen below `28vh` clip |

---

## 3. Visual Load & Duplication Audit (Section 1.1 Findings)

1. **Compass, Facing & Ahead Tile Duplicated 4× Simultaneously**:
   - `#fp-location-plaque`: `#fp-facing-pill` (`🧭 N ▲`), `#fp-scene-caption-line` (`Mirkwood Trail — Facing North`), and `#fp-fov-strip` (`◀ W: Forest • ▲ N: Mirkwood Trail • ▶ E: Forest`).
   - `.fp-vista-bar`: `Ahead (Facing North): ... Open (North): Toward Mirkwood Trail [7,4] — Press [W] to advance`.
   - `#dm-minimap-card`: `#minimap-Lock-indicator` (`[7, 5] • N ▲`) **plus** `.dm-compass-widget` (`#compass-rose-ring` + `Facing North` + `Ahead: Mirkwood Trail`).
   - `#dm-movement-deck`: `#pad-center` (`▲ NORTH`) and `#pad-forward` (`Forward (N)`).
2. **Mode Banner Duplicated**:
   - `#header-mode-indicator` in `.lab-director-bar` (`🌲 Wilderness Exploration` / `🛡️ Sanctuary`) and `#fp-state-banner` inside `#fp-viewport` (`🌲 WILDERNESS EXPLORATION` / `🛡️ SAFE HAVEN SANCTUARY`) showed identical text inches apart.
3. **Champion Vitals & Equipment Controls Duplicated**:
   - `.dm-top-deck` displayed both a horizontal Vitality progressbar (`#hud-hp-progressbar`) + AC badge (`#hud-ac-val`) **and** three decorative `.dm-vertical-pillars` (`HP`, `AC`, `XP`).
   - Weapon Stance appeared in `#slot-main-hand` / `#slot-off-hand`, `#btn-quick-stance`, `#deck-stance-indicator`, and `#action-slot-3`.
   - Backpack (`Pack [B]`) appeared in both `#btn-quick-pack` (top bar) and `#util-btn-pack` (right utility strip).
4. **Stage 1 & Stage 2 Encounter Instruction Duplication**:
   - In Stage 1 (`DISCOVERED`), `#fp-tension-ribbon` (`ENCOUNTER WARNING: A shadow stirs ahead — decide whether to engage or slip past!`) stacked directly above `#fp-inscene-threat` (`Unidentified Presence Ahead — Engage Threat [Space] / Slip Past [4/F]`), while `#dm-action-deck-card` repeated the same buttons on the right.
   - In Stage 2 (`IN_COMBAT`), `.fp-monster-hud-plate` showed both an initial instruction banner (`⚡ Engaged at melee range — press [Space] or click creature to strike`) and a 3rd tactical chip (`🗡️ Longsword (+3) • [Space] Strike`), duplicating `#action-slot-1` in the Combat Actions panel.
5. **Disabled Controls Occupying Prime Screen Real Estate**:
   - During **Exploration**, `#action-slot-1` (`Longsword • Path Clear`) and `#action-slot-4` (`Retreat • No Threat`) sat permanently disabled in a 4-column matrix.
   - During **Stage 2 Combat**, `#dm-movement-deck` remained `355×607 px` tall while all 9 movement buttons in `.dm-pad-grid` were disabled and dimmed, and `#action-slot-3` (`Swap Stance • Locked in Combat`) sat disabled in the action row.
   - During **Exploration / Combat**, `#dm-minimap-card` sat permanently at the very top of `.dm-right-deck`, pushing primary movement/combat controls downward.
