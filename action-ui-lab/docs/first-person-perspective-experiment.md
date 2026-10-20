# Darkgrid Action UI Lab — First-Person Perspective Experiment (`Mode C: First-Person`)

**Date:** October 2026  
**Scope:** Strictly isolated inside `action-ui-lab/` (zero changes to the main Darkgrid game, `src/`, `db/`, Firebase, or combat rules)  
**Comparison Modes Preserved:** `A: Single Scene`, `B: Directional Scene`, `C: First-Person ★`, and `Legacy (Blended+SVG)`

---

## 1. Flaws Identified in Existing Paintings in Modes A and B

Before designing `Mode C: First-Person`, we audited how `Mode A (Single Scene)` and `Mode B (Directional Scene)` behave at the three key test locations when evaluated against a true **human eye-level first-person perspective (~1.65 m height)**:

### 1.1 Exterior & Elevated Camera Angles Instead of Standing Inside the Scene
- **The Old Stone Bridge `(8,7)` (`terrain_bridge.webp`)**: Although atmospheric, the painting depicts the bridge from an **exterior 3/4 vantage point on the riverbank hillside** looking at the side of the stone arches and river below. The hero does not stand on the bridge roadway between the parapets.
- **Oakhaven Sanctuary `(7,7)` (`terrain_city_oakhaven.webp`)**: Depicts the town from a **high-altitude bird's-eye rooftop perspective** above the timber walls and towers. When the player stands at `Oakhaven North Gate (7,6)` in `Mode B` and turns `SOUTH` toward Oakhaven, the camera abruptly leaps into the sky above the town rather than looking South down the cobblestone street from the gate threshold.
- **Mirkwood Crossroads `(7,5)` (`forest_monolith_clearing.jpg`)**: Places the carved rune monolith dead-center in the middle of the path like an object portrait, blocking the forward trail rather than standing beside the crossroads junction as a waystone.

### 1.2 Premature Tile Substitution on Rotation in Mode B ("Teleporting on Turn")
Because `Mode B` resolves its primary painting from `ahead1` (the tile in front of the hero) whenever `ahead1` is a different terrain or landmark:
- **On The Old Stone Bridge `(8,7)` facing `WEST`**: Turning 180° West toward `Oakhaven (7,7)` causes `Mode B` to swap out the bridge painting for `terrain_town_gates.webp` (a dry dirt path in front of a timber palisade). Visually, the stone bridge beneath the hero's feet vanishes just from turning around.
- **At Mirkwood Crossroads `(7,5)` facing `SOUTH`**: Turning 180° South toward `Oakhaven North Gate (7,6)` causes `Mode B` to display `terrain_town_gates.webp` right in front of the camera—making it look as if the hero has already walked out of the forest and arrived at the town gate while still standing on `(7,5)`.
- **At Oakhaven North Gate `(7,6)` facing `NORTH` vs `SOUTH`**: Turning North in `Mode B` replaces the gatehouse altogether with a deep forest painting (`forest_monolith_clearing.jpg`), erasing the gate fortifications where the hero is standing; turning South jumps to the aerial city panorama (`terrain_city_oakhaven.webp`).

### 1.3 Translucent Crossfade & Turn-Zoom Artifacts
- Previously, `applySceneImageWithCrossfade()` held `prevImg` at `opacity: 1` while fading `terrainImg` in from `opacity: 0.12` to `1.0` over `240ms`, creating a brief translucent double-exposure of two different horizons during turns and steps.
- Additionally, `fpTurnLeft` and `fpTurnRight` included `scale(1.02)`, which slightly zoomed forward when rotating 90° or 180°.

---

## 2. How `Mode C: First-Person` Was Architected and Implemented

All changes were implemented strictly inside `action-ui-lab/`:

1. **Database & Catalog (`action-ui-lab/scene-catalog.js`)**:
   - Extended `SCENE_MODES` to `['A', 'B', 'C', 'LEGACY']`.
   - Added a new sandbox SQLite table `lab_perspective_views (x, y, facing, variant_key, title, subtitle, image_url, focal_x, focal_y, lighting_tint, horizon_glow, notes)` seeded automatically via `DEFAULT_PERSPECTIVE_VIEWS`.
   - Implemented `resolveSceneModeC(db, current, ahead1, left1, right1, facing, seed, inActiveCombat)`:
     - Queries `lab_perspective_views` for the exact `(current.x, current.y, facing)` tuple.
     - When a dedicated eye-level painting exists (`isDedicatedFirstPerson: true`, `perspectiveStatus: 'DEDICATED_FIRST_PERSON'`), returns that exact 1st-person perspective scene with `panX: 0, panY: 0`, `useAheadPortal: false`, and `useLegacySvg: false`.
     - When facing an unpainted direction or standing on another tile (`isDedicatedFirstPerson: false`, `perspectiveStatus: 'FALLBACK_CURRENT_PLACE'`), returns the current tile's cohesive place painting (`currentVariant`) with explicit directional/blocked metadata—never substituting the next tile's local painting and never mirroring artwork.
2. **Server Payload & Preloading (`action-ui-lab/server.js`)**:
   - Included `C: sceneC` inside `viewportScene.scenes` alongside `A`, `B`, and `LEGACY` so switching between all four modes in the Lab Director Bar is instantaneous.
   - Added `viewportScene.preloadUrls` so adjacent perspective views on the current and neighboring tiles are preloaded into browser memory before the player turns or steps.
   - Added the `NORTH_GATE` scenario (`🚪 Gate` button in the Lab Director Bar) for 1-click teleportation to `Oakhaven North Gate (7,6)`.
3. **Frontend Renderer & HUD (`action-ui-lab/public/index.html`, `action-ui.js`, `action-ui.css`)**:
   - Added `C: First-Person ★` to the Lab Director Bar.
   - Updated `#fp-scene-mode-tag` to distinguish `Scene C: 1st-Person POV` (green badge when viewing a dedicated eye-level perspective painting) from `Scene C: Place Fallback` (amber badge when viewing an unpainted direction).
   - Updated `#fp-center-stage` vista bar to display clear 1st-person POV subtitles or current-place fallback directional cues.

---

## 3. The Six New Eye-Level First-Person Environment Paintings

Six custom 16:9 widescreen (`1376×768`) hand-painted dark fantasy illustrations were created and stored in `action-ui-lab/public/images/perspective/` without overwriting any existing assets:

| # | Location & Coordinate | Facing | File Path (`action-ui-lab/public/images/perspective/`) | Camera & Geographic Continuity |
|---|---|---|---|---|
| 1 | **The Old Stone Bridge** `(8,7)` | `EAST` | `bridge_8_7_east.jpg` | Human eye-level (~1.65 m) standing directly in the center of the wet moss-grown flagstone bridge deck. Low weathered stone parapets and carved stone bollards flank left and right above the misty Blackwater River; straight ahead across the eastern span stands the crumbling gothic arch and ruined watchtower of **Bridge East Watchpost `(9,7)`**. |
| 2 | **The Old Stone Bridge** `(8,7)` | `WEST` | `bridge_8_7_west.jpg` | Exact same position in the center of the stone bridge after a **180° turn West**. The identical flagstone roadway, mossy stone parapets, carved bollards, and river mist below flank left and right, while straight ahead at the western end of the bridge stand the timber palisade walls, watchtowers, and warm amber torchlit gatehouse of **Oakhaven `(7,7)`**. |
| 3 | **Mirkwood Forest – Crossroads** `(7,5)` | `NORTH` | `crossroads_7_5_north.jpg` | Eye-level standing on the muddy crossroads trail in a misty clearing. The carved Celtic/Norse rune waystone stands naturally beside the junction on the **right side** of the trail (not blocking the path), while the muddy wheel-rutted path leads North into the dense, dark canopy tunnel of **Mirkwood Forest `(7,4)`**. |
| 4 | **Mirkwood Forest – Crossroads** `(7,5)` | `SOUTH` | `crossroads_7_5_south.jpg` | Exact same spot in the Mirkwood Crossroads clearing after a **180° turn South**. Because the hero turned 180°, the carved rune waystone is now visible on the **left side** of the clearing foreground, while the muddy forest trail extends South toward the forest edge where the timber palisade and warm torches of **Oakhaven North Gate `(7,6)`** appear properly scaled in the distance (~150 m away). |
| 5 | **Oakhaven North Gate** `(7,6)` | `NORTH` | `north_gate_7_6_north.jpg` | Eye-level standing right at the threshold of Oakhaven North Gate looking **North** outward. Heavy iron-strapped oak gate doors, timber gateposts, stone bastion foundations, and warm flickering wall torches frame the left and right foreground edges, while the muddy northern road leads out into the dark brooding tree line of **Mirkwood Crossroads `(7,5)`** with the faint rune waystone silhouette in the distance. |
| 6 | **Oakhaven North Gate** `(7,6)` | `SOUTH` | `north_gate_7_6_south.jpg` | Exact same spot at the threshold of Oakhaven North Gate after a **180° turn South**. The identical heavy timber gatehouse pillars, stone archway base, and warm iron wall torches frame the immediate left and right foreground edges (proving the hero is still standing at the gate threshold), while straight ahead at eye-level lies the wet cobblestone main street of **Oakhaven Sanctuary `(7,7)`** lined with medieval timber-framed houses and warm tavern windows. |

---

## 4. Side-by-Side Comparison: Modes A, B, and C Across the Three Test Locations

### 4.1 Test Location A: The Old Stone Bridge `(8,7)`

| Aspect | Mode A (`Single Scene`) | Mode B (`Directional Scene`) | Mode C (`First-Person ★`) |
|---|---|---|---|
| **Looking East `(8,7) -> (9,7)`** | Shows `terrain_bridge.webp` (exterior 3/4 hillside view of the bridge arches). | Shows `terrain_bridge.webp` (same exterior hillside view). | Shows `bridge_8_7_east.jpg`: Hero stands **on** the stone bridge deck between the parapets looking East down the roadway toward the ruined Watchpost on the far bank. |
| **Looking West `(8,7) -> (7,7)` (180° Turn)** | Keeps the same exterior hillside bridge view with a slight horizontal pan; no visual cue of Oakhaven ahead. | Replaces the bridge entirely with `terrain_town_gates.webp`—the stone bridge beneath the hero's feet disappears! | Shows `bridge_8_7_west.jpg`: Hero remains **on the exact same stone bridge deck** looking back West along the flagstones toward Oakhaven's timber gatehouse on the western bank. |
| **Sense of Physical Presence** | Feels like looking at a postcard of a bridge from the riverbank. | Turning West feels like teleporting off the bridge onto dry dirt. | Feels like physically standing on the bridge and turning 180° on your heels. |

**Screenshots (`action-ui-lab/docs/screenshots/first-person-experiment/`):**
- Mode C East: `01_c_bridge_8_7_east.png` | Mode A East: `07_compare_a_bridge_8_7_east.png`
- Mode C West: `02_c_bridge_8_7_west.png` | Mode B West: `08_compare_b_bridge_8_7_west.png`

---

### 4.2 Test Location B: Mirkwood Forest – Crossroads `(7,5)`

| Aspect | Mode A (`Single Scene`) | Mode B (`Directional Scene`) | Mode C (`First-Person ★`) |
|---|---|---|---|
| **Looking North `(7,5) -> (7,4)`** | Shows `forest_monolith_clearing.jpg` with the monolith blocking the center of the path. | Switches to `terrain_forest.webp` (generic forest), losing the crossroads rune waystone completely. | Shows `crossroads_7_5_north.jpg`: Eye-level on the muddy crossroads trail, rune waystone beside the path on the right, looking North into deep Mirkwood. |
| **Looking South `(7,5) -> (7,6)` (180° Turn)** | Shows the exact same `forest_monolith_clearing.jpg` image; no visual connection to Oakhaven North Gate to the South. | Switches to `terrain_town_gates.webp` right in front of the camera as if the hero already walked out of the forest to `(7,6)`. | Shows `crossroads_7_5_south.jpg`: Still standing in the muddy forest clearing (waystone now on the left), looking South along the forest trail toward the distant torches of Oakhaven North Gate at the tree line. |
| **Sense of Physical Presence** | Static place illustration regardless of whether looking into deep forest or back toward town. | Prematurely teleports the camera to the town gate before the hero steps onto `(7,6)`. | True 180° turnaround inside the crossroads clearing with accurate landmark handedness (waystone right when facing N -> waystone left when facing S). |

**Screenshots (`action-ui-lab/docs/screenshots/first-person-experiment/`):**
- Mode C North: `03_c_crossroads_7_5_north.png` | Mode A North: `09_compare_a_crossroads_7_5_north.png`
- Mode C South: `04_c_crossroads_7_5_south.png` | Mode B South: `10_compare_b_crossroads_7_5_south.png`

---

### 4.3 Test Location C: Oakhaven North Gate `(7,6)`

| Aspect | Mode A (`Single Scene`) | Mode B (`Directional Scene`) | Mode C (`First-Person ★`) |
|---|---|---|---|
| **Looking North `(7,6) -> (7,5)`** | Shows `terrain_town_gates.webp` from outside the gate looking in—which is backwards when looking North out toward the forest! | Replaces the gate with `forest_monolith_clearing.jpg`, making the gate fortifications vanish. | Shows `north_gate_7_6_north.jpg`: Framed by the open timber gatehouse archway and torches in the foreground, looking North out along the road into Mirkwood Forest. |
| **Looking South `(7,6) -> (7,7)` (180° Turn)** | Still shows `terrain_town_gates.webp` from outside the walls. | Jumps to `terrain_city_oakhaven.webp`—a high-altitude bird's-eye rooftop view of the town! | Shows `north_gate_7_6_south.jpg`: Framed by the exact same timber gatehouse archway and torches in the foreground, looking South at eye-level down the wet cobblestone street of Oakhaven. |
| **Walk Continuity `(7,5) <-> (7,6)`** | Stepping from `(7,5)` South to `(7,6)` shows the exterior gate regardless of facing. | Facing South at `(7,5)` already showed the gate, so stepping onto `(7,6)` either repeats the image or jumps to the sky. | At `(7,5)` South you see the gate in the distance at the end of the forest trail; when you press `W` to step onto `(7,6)` South, you arrive at the gate threshold looking down Oakhaven's street! |

**Screenshots (`action-ui-lab/docs/screenshots/first-person-experiment/`):**
- Mode C North: `05_c_north_gate_7_6_north.png` | Mode A North: `11_compare_a_north_gate_7_6_north.png`
- Mode C South: `06_c_north_gate_7_6_south.png` | Mode B South: `12_compare_b_north_gate_7_6_south.png`

---

## 5. Movement and Rotation Polish in Mode C

1. **Zero Double-Exposure Image Blending**:
   - We updated `applySceneImageWithCrossfade()` in `action-ui-lab/public/action-ui.js` and `@keyframes fpSceneCrossfadeIn` in `action-ui-lab/public/action-ui.css` so `prevImg` is never held opaque underneath a semi-transparent incoming painting. Instead, the incoming painting renders at `opacity: 1` immediately with a crisp `180ms` brightness settle (`brightness(0.72) -> brightness(0.88)`). Two horizons are never superimposed.
2. **Pure Rotational Pan vs Forward Step**:
   - **On Rotation (`A`/`D` or 180° turns)**: Removed `scale(1.02)` from `fpTurnLeft` and `fpTurnRight`. Turns now execute a short, crisp `180ms` horizontal pan (`translateX(±14px) -> translateX(0)`), eliminating the false "zoom forward" sensation when rotating in place.
   - **On Walking (`W`/`S`/`Q`/`E`)**: Executes a grounded `220ms` stride (`scale(1.028) translateY(-4px) -> scale(1) translateY(0)`) only after the server confirms the hero has stepped onto the new coordinate.
   - **On Impassable Tiles**: Executes a short `180ms` `fpBlockedBump` while keeping the current tile's painting locked.
3. **Accessibility (`prefers-reduced-motion`)**:
   - Preserved the `@media (prefers-reduced-motion: reduce)` rule in `action-ui.css` which collapses all animation and transition durations to `0.01ms`.

---

## 6. Handling of Unpainted Directions & Fallback Behavior

In accordance with Section 5 ("Óteiknaðar áttir"):
- We did **not** generate all 4 directions for every tile, nor did we auto-mirror images (which would flip landmarks to the wrong side) or substitute the next tile's local painting (which would recreate Mode B's premature teleportation flaw).
- When the player is in `Mode C` and turns to an unpainted direction—for example:
  - Turning `WEST` at `Mirkwood Crossroads (7,5)` toward impassable `Stonefang Crag (6,5)` (`13_c_crossroads_7_5_west_blocked_fallback.png`), or
  - Turning `NORTH` on `The Old Stone Bridge (8,7)` toward impassable `Blackwater River (8,6)` (`14_c_bridge_8_7_north_blocked_fallback.png`), or
  - Turning `EAST` at `Mirkwood Crossroads (7,5)` toward `Mirkwood Forest (8,5)`—
  `resolveSceneModeC()` returns `perspectiveStatus: 'FALLBACK_CURRENT_PLACE'` (`isDedicatedFirstPerson: false`) using the current tile's cohesive place artwork (`currentVariant`), while:
  1. The top HUD badge switches from green `Scene C: 1st-Person POV` to amber `Scene C: Place Fallback`.
  2. The top FOV pills (`◀`, `▲`, `▶`), flank shading (`flank-blocked-rock` / `flank-blocked-water`), and bottom vista bar explicitly state the direction faced and whether the path ahead is passable or blocked (`⛔ Impassable Barrier (WEST): Stonefang Crag`).

---

## 7. Monsters and Combat in Mode C

- **Stage 1 ("Shadow in the Mist")**: Tested at `Mirkwood Crossroads (7,5)` facing `NORTH` (`15_c_crossroads_stage1_shadow.png`). The amorphous lurking shadow silhouette and whisper clue plate sit naturally in the lower-middle foreground of `crossroads_7_5_north.jpg`, preserving strict encounter secrecy (no monster species, image, or stats leaked) and single-step bypass (`W/S/Q/E` or `4/F`).
- **Stage 2 (Active Combat)**: Tested on `The Old Stone Bridge (8,7)` facing `EAST` against the `Manticore` (`16_c_bridge_stage2_combat_manticore.png`) and at `Oakhaven North Gate (7,6)` against the `Assassin Vine`.
  - The monster portrait is grounded on the stone bridge deck / gate road with atmospheric mist and bronze corner brackets (`1. Hybrid ★`, `2. Blend`, `3. Frame` all supported).
  - The combat backdrop is strictly anchored to the hero's current tile (`resolveSceneModeC` never swaps in a neighboring tile's painting during combat).
  - No obstacle banners or text plates obscure the monster.

---

## 8. Scalability & Cost Assessment: Expanding First-Person Views to 100 and 1,000 Tiles

A critical engineering question for Darkgrid is what happens if `Mode C` is scaled beyond these 3 test locations to **100 tiles** or **1,000 tiles**:

### 8.1 Scenario 1: Expanding to a 100-Tile World Map

| Approach | Image Count | Storage Size (~720 KB WebP/JPG per image, or ~220 KB optimized WebP) | Production & Maintenance Effort |
|---|---|---|---|
| **Brute-Force Full 4-Direction (`100 × 4`)** | **400 unique images** | ~280 MB (JPG) / ~88 MB (optimized WebP) | **High:** Every single tile requires 4 geographically matched directional paintings that align with all 4 neighbors. Changing one landmark on the map requires repainting 8–12 surrounding directional views. |
| **Smart Hybrid (`Archetype Pool + Key Corridors & Landmarks`)** | **~45–60 images total** (e.g., 16 biome-transition & corridor templates + 30–40 bespoke views for 10–15 key landmarks/gates/bridges) | ~35 MB (JPG) / ~12 MB (optimized WebP) | **Manageable & High-Impact:** Generic forest/plains/swamp tiles share reusable eye-level directional templates (e.g., "Forest Trail Looking Toward Forest", "Forest Trail Looking Toward Distant Mountain Wall", "Forest Trail Looking Toward Distant Town Gate"), while major named landmarks (`Stone Bridge`, `North Gate`, `Watchpost Ruins`, `Heart of the Mirkwood`) have bespoke coordinate-bound 1st-person views. |

### 8.2 Scenario 2: Expanding to a 1,000-Tile World Map

| Approach | Image Count | Storage Size | Feasibility Verdict |
|---|---|---|---|
| **Brute-Force Full 4-Direction (`1,000 × 4`)** | **4,000 unique images** | ~2.8 GB (JPG) / ~880 MB (WebP) | **Not Recommended / Unmaintainable:** Creating and maintaining 4,000 bespoke hand-painted illustrations where every `(x, y, facing)` matches its exact neighbor topology is prohibitively expensive in art production, quality assurance, and asset bundle size. |
| **Tiered Hybrid First-Person System (`Mode A/B Base + Reusable Eye-Level Transition Templates + Mode C Landmark Overrides`)** | **~80–120 images total** regardless of whether the map has 200 or 1,000 tiles | ~20–30 MB (optimized WebP) | **Highly Feasible & Scalable:** Instead of keying every image to hardcoded `(x, y)` coordinates across 1,000 tiles, 90% of wilderness tiles resolve via **reusable eye-level topological rules** `(currentBiome, aheadBiomeOrLandmarkType, seededVariant)` (requires ~40–50 eye-level paintings total), while the top 15–25 bespoke story landmarks use exact `(x, y, facing)` overrides in `lab_perspective_views` (~40–70 paintings). |

---

## 9. Verification Summary & Screenshot Index

All automated tests (`15/15` in `action-ui-lab/tests/action-lab.test.js`) and real Chrome browser checks across `1920×1080`, `1600×900`, and `1280×720` passed with zero vertical or horizontal page scrolling (`scrollHeight === innerHeight`).

All 18 browser verification screenshots are saved in `action-ui-lab/docs/screenshots/first-person-experiment/`:

1. `01_c_bridge_8_7_east.png` — **Stone Bridge `(8,7)` Looking East (Mode C: First-Person)**
2. `02_c_bridge_8_7_west.png` — **Stone Bridge `(8,7)` Looking West (Mode C: First-Person, 180° turn)**
3. `03_c_crossroads_7_5_north.png` — **Mirkwood Crossroads `(7,5)` Looking North (Mode C: First-Person)**
4. `04_c_crossroads_7_5_south.png` — **Mirkwood Crossroads `(7,5)` Looking South (Mode C: First-Person, 180° turn)**
5. `05_c_north_gate_7_6_north.png` — **Oakhaven North Gate `(7,6)` Looking North (Mode C: First-Person)**
6. `06_c_north_gate_7_6_south.png` — **Oakhaven North Gate `(7,6)` Looking South (Mode C: First-Person, 180° turn)**
7. `07_compare_a_bridge_8_7_east.png` — Comparison: Stone Bridge `(8,7)` East in **Mode A**
8. `08_compare_b_bridge_8_7_west.png` — Comparison: Stone Bridge `(8,7)` West in **Mode B** (demonstrating bridge disappearance)
9. `09_compare_a_crossroads_7_5_north.png` — Comparison: Crossroads `(7,5)` North in **Mode A**
10. `10_compare_b_crossroads_7_5_south.png` — Comparison: Crossroads `(7,5)` South in **Mode B** (demonstrating premature jump to gate)
11. `11_compare_a_north_gate_7_6_north.png` — Comparison: North Gate `(7,6)` North in **Mode A**
12. `12_compare_b_north_gate_7_6_south.png` — Comparison: North Gate `(7,6)` South in **Mode B** (demonstrating jump to bird's-eye city view)
13. `13_c_crossroads_7_5_west_blocked_fallback.png` — Mode C 90° turn West at `(7,5)` facing impassable Stonefang Crag (current-place fallback + blocked indicator)
14. `14_c_bridge_8_7_north_blocked_fallback.png` — Mode C 90° turn North at `(8,7)` facing impassable Blackwater River (current-place fallback + blocked indicator)
15. `15_c_crossroads_stage1_shadow.png` — Mode C Stage 1 "Shadow in the Mist" at Crossroads `(7,5)` North
16. `16_c_bridge_stage2_combat_manticore.png` — Mode C Stage 2 Manticore Combat on Stone Bridge `(8,7)` East
17. `17_c_bridge_east_1600x900.png` — Mode C responsive verification at `1600×900`
18. `18_c_north_gate_south_1280x720.png` — Mode C responsive verification at `1280×720`

---

## 10. Recommendations for Next Steps

Based on visual inspection, spatial coherence testing, and the 100/1,000-tile scalability analysis, we recommend **Option 2 (Hybrid Landmark & Corridor First-Person System)**:

1. **Use `Mode C` First-Person Perspective on Key Landmarks, Gates, Bridges, and Transitions, backed by `Mode A` (Single Scene) with Eye-Level Base Paintings for Open Wilderness**:
   - At major landmarks and transitions (`The Old Stone Bridge (8,7)`, `Oakhaven North Gate (7,6)`, `Mirkwood Crossroads (7,5)`, `Bridge East Watchpost (9,7)`), having matched 180° eye-level perspective pairs (`Mode C`) transforms the player's spatial immersion—standing **on** the bridge deck or **inside** the gate archway and turning 180° feels tangibly grounded in the world.
   - Replacing exterior/bird's-eye base paintings (`terrain_bridge.webp`, `terrain_city_oakhaven.webp`) with eye-level paintings even in the base catalog immediately fixes the biggest immersion breaks across the entire map without requiring 4 unique paintings for every generic wilderness tile.
2. **Do Not Use Brute-Force 4-Direction Paintings for Every Tile**:
   - Drawing 4 unique coordinate-locked paintings for every tile does not scale to 100–1,000 tiles. Instead, keep the `lab_perspective_views` `(x, y, facing)` override table for high-value landmarks and corridors, and use seeded eye-level biome variants (`Mode A` fallback) for deep wilderness tiles.
