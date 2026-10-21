# Darkgrid Adventure Lab — Phase 3: Real Chromium Visual QA Results

**Date**: 2026-10-21  
**Browser Engine**: Real Headless Chromium via Chrome DevTools Protocol (CDP)  
**Screenshots Directory**: `action-ui-lab/docs/phase-3/screenshots/`  
**Telemetry JSON**: `action-ui-lab/docs/phase-3/screenshots/phase3-visual-qa-telemetry.json`

---

## 1. Visual QA Matrix — Monster Categories, Body Types & Environments

All specimens below were rendered in real Chromium at `1920×1080` in **Integrated Cutout + Adaptive PF1e Scale** mode across diverse world landmarks:

| Screenshot File | Monster | PF1e Size | Body Profile | Environment / Surface | Rendered Box (`W × H px`) | Area (`px²`) | Grounding / Contact Patches |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| `monster_01_tiny_flying_stirge_mire.png` | **Stirge** | `TINY` | `WINGED_TINY_PEST` | Deadman's Mire (`mire-mud`) | `140 × 125 px` | `17,500` | Airborne Hover (`0` ground contacts, detached shadow) |
| `monster_02_small_humanoid_goblin_forest.png` | **Goblin** | `SMALL` | `BIPED_SMALL` | Mirkwood Trail (`forest-earth`) | `164 × 195 px` | `31,980` | Grounded Boots (`2` foot contact patches) |
| `monster_03_medium_humanoid_skeleton_ruins.png` | **Skeletal Champion** | `MEDIUM` | `BIPED_MEDIUM` | Watchpost Ruins (`flagstone`) | `225 × 289 px` | `65,025` | Grounded Boots (`2` foot contact patches) |
| `monster_04_medium_quadruped_wolf_forest.png` | **Wolf** | `MEDIUM` | `QUADRUPED_LOW` | Mirkwood Trail (`forest-earth`) | `243 × 211 px` | `51,273` | Grounded Paws (`3` paw contact patches) |
| `monster_05_medium_spider_arachnid_mire.png` | **Giant Spider** | `MEDIUM` | `ARACHNID_WIDE` | Deadman's Mire (`mire-mud`) | `268 × 181 px` | `48,508` | Grounded Arachnid (`4` leg contact patches) |
| `monster_06_medium_flying_harpy_bridge.png` | **Harpy** | `MEDIUM` | `WINGED_HOVER_MEDIUM` | Old Stone Bridge (`flagstone`) | `316 × 272 px` | `85,952` | Airborne Hover (`0` ground contacts, detached shadow) |
| `monster_07_large_flying_manticore_bridge.png` | **Manticore** | `LARGE` | `WINGED_LARGE_PREDATOR` | Old Stone Bridge (`flagstone`) | `458 × 375 px` | `171,750` | Airborne Hover (`0` ground contacts, detached shadow) |
| `monster_08_large_boss_troll_forest.png` | **Troll** | `LARGE` | `BIPED_TALL_BRUTE` | Mirkwood Trail (`forest-earth`) | `367 × 447 px` | `164,049` | Grounded Heavy (`2` heavy foot contact patches) |
| `monster_09_large_brute_ogre_ruins.png` | **Ogre** | `LARGE` | `BIPED_TALL_BRUTE` | Watchpost Ruins (`flagstone`) | `339 × 414 px` | `140,346` | Grounded Heavy (`2` heavy foot contact patches) |

### Scale Comparison Arena Lineups (`HUGE`, `GARGANTUAN`, `COLOSSAL`)
- `scale_arena_01_tiny_to_huge_progression.png`: Side-by-side comparison of **Stirge (`TINY`) -> Goblin (`SMALL`) -> Skeletal Champion (`MEDIUM`) -> Troll (`LARGE`) -> Ancient Treant / Elder Troll (`HUGE`)** on the same ground plane at `12 ft` virtual camera distance.
- `scale_arena_02_all_9_pf1e_tiers.png`: Complete 9-tier Pathfinder 1e progression (**Fine -> Diminutive -> Tiny -> Small -> Medium -> Large -> Huge -> Gargantuan -> Colossal**) confirming tiny creature visibility and soft-knee upper UI clamping.

---

## 2. Game State Progression Verification

| Screenshot File | Game State | Active Viewport State Class | Visual Verification |
| :--- | :--- | :--- | :--- |
| `state_01_exploration_forest.png` | **1. Exploration** | `scene-state-exploration` | Unobstructed first-person forest trail vista; environment and navigation lead |
| `state_02_monster_detected_stage1.png` | **2. Threat Detected (Stage 1)** | `scene-state-discovered` | Generic lurking shadow silhouette in the mist; strict monster identity secrecy preserved |
| `state_03_combat_entry_wolf.png` | **3. Combat Entry (Stage 2 Reveal)** | `scene-state-combat` | Smooth distant-to-melee emergence (`anim-monster-emerge`), camera focal zoom (`1.038x`), peripheral vignette, and initial engagement banner |
| `state_04_active_combat_exchange.png` | **4. Active Combat Exchange** | `scene-state-combat` | Wounded condition quote, updated Last-Exchange Banner (`#seq-exchange-banner`), and tactical chip readout |
| `state_05_victory_remains.png` | **5. Victory & Remains** | `scene-state-victory` | Defeated monster cutout remains in-scene (`.is-victory-remains`), XP/Gold/Loot summary, and restored bearing indicator |
| `state_06_return_to_exploration.png` | **6. Return to Exploration** | `scene-state-exploration` | Clean 1-step return to unobstructed trail exploration |

---

## 3. Multi-Resolution & Mobile Viewport Verification

| Screenshot File | Resolution | Device Type | Monster Box (`Ogre`) | HUD Fits Inside Viewport | Zero Page Overflow |
| :--- | :---: | :--- | :---: | :---: | :---: |
| `viewport_01_1920x1080_desktop.png` | `1920 × 1080` | Desktop 1080p | `339 × 414 px` | `true` | `true` (`1920×1080`) |
| `viewport_02_1366x768_laptop.png` | `1366 × 768` | Compact Laptop | `241 × 294 px` | `true` | `true` (`1366×768`) |
| `viewport_03_1280x800_compact.png` | `1280 × 800` | Handheld / 16:10 | `252 × 307 px` | `true` | `true` (`1280×800`) |
| `viewport_04_390x844_mobile.png` | `390 × 844` | Mobile Portrait | `218 × 203 px` | `true` | `true` (`390×844`) |

---

## 4. Artwork & Cutout Observations (Section 6 Audit)

- All **37 verified RGBA cutouts** (`public/images/monsters-cutout/*.png`) decode cleanly (`colorType: 6`, `0` broken assets, `0` console/network errors) and composite naturally over forest, bridge, mire, and ruin backgrounds.
- The remaining **61 monsters** use the adaptive **Card Fallback** presentation (`public/images/monsters/*.png`), which now anchors to the scene ground plane (`margin-top: auto`) with body-profile aspect ratios and vignette trim compensation (`--monster-img-trim-scale`).
- **Close-up Macro Portraits (`manualOverrideFlag: 'CLOSEUP_PORTRAIT_CROP'`)**: Three Tiny/Small paintings (`stirge`, `viper`, `goblin`) were originally painted as close-up portraits; `computeAdaptiveMonsterVisualScale` explicitly locks their `imageTrimScale` to `1.0` in Card mode and uses their measured cutout bounds in Integrated mode so they scale down accurately to Tiny/Small screen footprints.
