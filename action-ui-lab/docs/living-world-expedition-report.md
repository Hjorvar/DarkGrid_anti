# Darkgrid — The Living World Expedition Report (`action-ui-lab/`)

**Status:** Complete (`23/23` Automated Unit/Integration Tests Passing • `53/53` Headless Chrome Visual QA Checks Passing • `0` Grade D Viewpoints Across All `640` Passable POVs)  
**Scope:** Strictly isolated inside `action-ui-lab/` (zero modifications to root `src/`, `db/`, `public/`, `package.json`, main SQLite database, or Firebase)  
**Server URL:** `http://localhost:3199` (`node action-ui-lab/server.js`)

---

## A. Executive Summary

**The Living World Expedition** transformed the `action-ui-lab` First-Person Action Viewport prototype from a localized corridor demo (`Oakhaven North Gate` $\leftrightarrow$ `Mirkwood Crossroads` $\leftrightarrow$ `Old Stone Bridge`) into a cohesive, living, eye-level first-person world across the entire **15×15 Darkgrid map (`225` tiles / `640` passable directional viewpoints)**:

1. **100% World Visual Atlas Coverage (`0` Grade D Gaps)**:
   - Built an authoritative server-side **World Visual Atlas** (`GET /api/atlas` and `GET /api/visual-qa`) that evaluates every tile $(x, y) \in [0..14] \times [0..14]$ across all 4 cardinal facings (`NORTH`, `EAST`, `SOUTH`, `WEST`), classifying each viewpoint into `Grade A` (Bespoke POV), `Grade B` (Contextual Landmark/Transition/Barrier POV), `Grade C` (Generic Sub-Biome Safe POV), or `Grade D` (Fallback Leak / Missing Asset).
   - Across all **160 passable tiles (`640` directional viewpoints)**:
     - **Grade A (Bespoke Exact POV):** `42` viewpoints
     - **Grade B (Contextual Landmark / Transition / Barrier POV):** `153` viewpoints
     - **Grade C (Generic Safe Sub-Biome POV):** `445` viewpoints
     - **Grade D (Needs Art / Fallback Leak):** **`0` viewpoints**
2. **31 New Eye-Level (~1.65 m) Environment Paintings (`49` Active Unique Paintings Total)**:
   - Generated, inspected, and installed **31 new 16:9 eye-level dark-fantasy paintings** (`26` in `action-ui-lab/public/images/perspective/` and `5` in `action-ui-lab/public/images/terrain/`), while preserving all previously approved assets untouched.
   - Completed 4-direction continuity inside **Oakhaven Sanctuary `(7,7)`**, **Oakhaven North Gate `(7,6)`**, **Oakhaven South Gate `(7,8)`**, **Mirkwood Crossroads `(7,5)`**, **The Primeval Black Oak `(7,3)`**, **The Old Stone Bridge `(8,7)`**, **Bridge East Watchpost `(9,7)`**, **Deadman's Mire Sunken Ruins `(4,11)`**, **Raven Crags `(3,5)`**, **Windblown Heath `(12,4)`**, **Rotting Fen `(6,10)`**, **Venomous Jungle `(9,11)`**, plus dedicated eye-level **Biome Transitions** and **Impassable Natural Barriers**.
3. **Subtle Atmospheric & Environmental Motion Engine (`Off` / `Subtle ★` / `Full`)**:
   - Implemented a data-driven **12-profile Atmospheric Effects Engine** (`SANCTUARY_EMBERS`, `GATE_TORCH_MIST`, `RIVER_SPRAY`, `FOREST_POLLEN_MIST`, `ANCIENT_OAK_SPORES`, `SWAMP_MIASMA`, `MIRE_RUINS_FOG`, `JUNGLE_SPORES`, `HIGHLAND_WIND_ASH`, `HEATH_MIST`, `BARRIER_GALE`, `RUINS_DUST`) rendered via a non-intrusive HTML5 Canvas (`#fp-atmo-canvas`) + CSS micro-motion layer (`prefers-reduced-motion` aware).
4. **12 Non-Gameplay Inspectable Points of Interest (`Inspect [I]`)**:
   - Added **12 environmental lore landmarks** across the world that can be inspected with `Inspect [I]` (or the top-right gold HUD button) to reveal an English lore plaque and chronicle entry with zero gameplay/stat/loot side effects.
5. **7 Integrated Monster Cutouts + Anatomical Grounding Rigs (`+3` New Species)**:
   - Extracted and edge-decontaminated **3 new RGBA monster cutouts** (`Skeletal Champion`, `Giant Spider`, `Troll`), expanding the roster to **7 fully integrated cutout monsters** (`Manticore`, `Ghoul`, `Assassin Vine`, `Wolf`, `Skeletal Champion`, `Giant Spider`, `Troll`) while preserving automatic `Card Fallback` (`Rust Monster` and un-cutout monsters).

---

## B. World Visual Atlas Coverage (`225` Tiles / `640` Passable Directional Viewpoints)

The interactive **World Visual Atlas** (`🗺️ World Atlas [V]` in the top Lab Director Bar, backed by `GET /api/atlas`) inspects all `225` tiles (`900` total directional viewpoints: `640` passable + `260` impassable boundary tiles):

| Metric | Count | Notes |
| :--- | :---: | :--- |
| **Total World Grid Tiles** | `225` | $15 \times 15$ coordinate grid (`[0,0]` to `[14,14]`) |
| **Passable Exploration Tiles** | `160` | `640` passable directional viewpoints (`160 × 4`) |
| **Impassable Boundary / Obstacle Tiles** | `65` | `Darkmount Peaks`, `Stonefang Crag`, `Blackwater River`, `The Murksea`, `The Bottomless Mire` |
| **Grade A — Bespoke Exact POV (Tier 1)** | `42` | Exact `(x, y, facing)` eye-level paintings in `lab_perspective_views` |
| **Grade B — Contextual POV (Tiers 2 & 3)** | `153` | Landmark directional, biome transition, & impassable barrier POV rules |
| **Grade C — Generic Safe POV (Tier 4)** | `445` | Multi-variant sub-biome eye-level POV pools (`camera_type='POV'`) |
| **Grade D — Missing / Overview Leak** | **`0`** | Zero aerial/overview leaks and zero missing files on disk |
| **Unique Environment Paintings Active** | `49` | `18` existing + `31` new expedition paintings |

---

## C. New Environment Art Created (`31` New Eye-Level Paintings)

All 31 new environment paintings were generated at human eye level (~1.65 m), 16:9 widescreen (`1376×768`), with a grounded lower-third walkable stage and zero characters/monsters baked into the background:

### 1. Oakhaven Sanctuary & Gatehouse Approaches (`8` paintings)
- `public/images/perspective/oakhaven_7_7_north.jpg` — Oakhaven Sanctuary `(7,7)` looking `NORTH` up the wet cobblestone main street toward the open timber arch of North Gate.
- `public/images/perspective/oakhaven_7_7_east.jpg` — Oakhaven Sanctuary `(7,7)` looking `EAST` through the Eastern River Gate toward the flagstones of The Old Stone Bridge.
- `public/images/perspective/oakhaven_7_7_south.jpg` — Oakhaven Sanctuary `(7,7)` looking `SOUTH` down the lantern-lit storehouse lane toward South Gate and creeping fen mist.
- `public/images/perspective/oakhaven_7_7_west.jpg` — Oakhaven Sanctuary `(7,7)` looking `WEST` across the market square and glowing iron brazier toward the western timber palisade.
- `public/images/perspective/north_gate_7_6_east.jpg` — Oakhaven North Gate `(7,6)` looking `EAST` along the outer timber palisade wall toward the Blackwater River bank.
- `public/images/perspective/north_gate_7_6_west.jpg` — Oakhaven North Gate `(7,6)` looking `WEST` along the outer palisade and watchtower toward the Mirkwood treeline.
- `public/images/perspective/south_gate_7_8_south.jpg` — Oakhaven South Gate `(7,8)` looking `SOUTH` through the timber gate posts onto the muddy causeway descending into the Rotting Fen.
- `public/images/perspective/south_gate_7_8_north.jpg` — Oakhaven South Gate `(7,8)` looking `NORTH` from the wetland causeway toward Oakhaven's fortified southern timber palisade and warm lantern-lit gate.

### 2. Major Landmarks & Return-Path Continuity (`8` paintings)
- `public/images/perspective/watchpost_9_7_west.jpg` — Bridge East Watchpost `(9,7)` looking `WEST` through the ivy-draped Gothic stone archway back across The Old Stone Bridge toward Oakhaven.
- `public/images/perspective/watchpost_9_7_east.jpg` — Bridge East Watchpost `(9,7)` looking `EAST` past the crumbled watchtower base onto the overgrown stone road into the Verdant Plains.
- `public/images/perspective/watchpost_9_7_river_flank.jpg` — Bridge East Watchpost `(9,7)` looking `NORTH`/`SOUTH` over the collapsed stone parapet into the churning Blackwater River gorge.
- `public/images/perspective/crossroads_7_5_lateral.jpg` — Mirkwood Crossroads `(7,5)` lateral forest-border track with weathered wooden directional post and mossy boundary stones.
- `public/images/perspective/forest_7_4_north_oak_approach.jpg` — Mirkwood trail `(7,4) NORTH` / `(7,2) SOUTH` approaching the colossal amber-veined root archway of the Primeval Black Oak.
- `public/images/perspective/ancient_oak_7_3_south.jpg` — Heart of the Mirkwood `(7,3)` looking `SOUTH` from beneath the massive mossy root arch back down the forest trail.
- `public/images/perspective/deadmans_mire_4_11_ruins.jpg` — Deadman's Mire `(4,11)` flooded flagstones and sunken Gothic temple arches half-swallowed by black bog water.
- `public/images/perspective/swamp_approach_mire_ruins.jpg` — Rotting Fen `(4,10) SOUTH` / `(3,11) EAST` bog causeway approaching the sunken Gothic arches of Deadman's Mire in the mist.

### 3. Impassable Natural World Barriers (`5` paintings)
- `public/images/perspective/barrier_bottomless_mire_pov.jpg` — Facing *The Bottomless Mire* (`y=14`): solid bog ground ending at bubbling pitch-black quagmire with crooked wooden warning stakes.
- `public/images/perspective/barrier_murksea_cliffs_pov.jpg` — Facing *The Murksea* (`x=14`): windswept coastal cliff edge with stone boundary cairn dropping into churning black ocean waves.
- `public/images/perspective/barrier_darkmount_crags_pov.jpg` — Facing *Darkmount Peaks* (`y=0`): highland trail blocked by a sheer vertical black granite cliff wall and boulder rockslide.
- `public/images/perspective/barrier_stonefang_crag_pov.jpg` — Facing *Stonefang Crag* `(6,5)`: razor-sharp fang-shaped black monolith spire blocking passage between forest and plains.
- `public/images/perspective/barrier_blackwater_bank_pov.jpg` — Facing *Blackwater River* (`x=8` wilderness banks): muddy reed bank dropping into deep, treacherous black rapids with no bridge or ford.

### 4. Biome Transitions (`5` paintings)
- `public/images/perspective/transition_plains_to_forest_pov.jpg` — Standing in `PLAINS` looking toward the dark, mist-shrouded treeline of `FOREST` (*Mirkwood*).
- `public/images/perspective/transition_forest_to_plains_pov.jpg` — Standing beneath the shadowy eaves of `FOREST` looking out into open overcast `PLAINS`.
- `public/images/perspective/transition_plains_to_swamp_pov.jpg` — Standing in southern `PLAINS` looking down a muddy track into the waterlogged willows and green fog of `SWAMP` (*Rotting Fen*).
- `public/images/perspective/transition_forest_to_hills_pov.jpg` — Standing at the western edge of `FOREST` looking up a steep rocky slate path into `HILLS` (*Raven Crags*).
- `public/images/perspective/transition_swamp_to_jungle_pov.jpg` — Standing in `SWAMP` looking into the colossal buttress roots, hanging lianas, and glowing spores of `JUNGLE` (*Venomous Jungle*).

### 5. Sub-Biome Wilderness Trails (`5` paintings)
- `public/images/terrain/hills_raven_crags_ravine_pov.jpg` — *Raven Crags* `(3,5)` narrow dark-slate ravine trail with mossy sentinel cairn and perched ravens.
- `public/images/terrain/hills_highland_ridge_pov.jpg` — *Raven Crags* exposed highland flagstone ridge crest flanked by mist-filled gorges.
- `public/images/terrain/plains_windblown_heath_pov.jpg` — *Windblown Heath* `(12,4)` ancient flagstone road flanked by weathered standing stones in wind-flattened heather.
- `public/images/terrain/swamp_willow_boardwalk_pov.jpg` — *Rotting Fen* `(6,10)` half-sunken medieval timber plank boardwalk winding over black bog water between weeping willows.
- `public/images/terrain/jungle_venomous_trail_pov.jpg` — *Venomous Jungle* `(9,11)` mossy stone slabs winding between coiled buttress roots and bioluminescent amber-green toxic fungi.

---

## D. Spatial Continuity & Landmark Journeys

Every major expedition route in the 15×15 world now maintains strict **Forward + 180° Return Continuity** and **360° Rotation Coherence**:

1. **Northern Forest Expedition (`Oakhaven (7,7)` $\leftrightarrow$ `North Gate (7,6)` $\leftrightarrow$ `Mirkwood Crossroads (7,5)` $\leftrightarrow$ `Mirkwood Trail (7,4)` $\leftrightarrow$ `Primeval Black Oak (7,3)`)**:
   - Stepping North from `(7,7)` shows the open timber arch of North Gate ahead (`oakhaven_7_7_north.jpg`); stepping onto `(7,6)` places the hero at the gate threshold looking into Mirkwood (`north_gate_7_6_north.jpg`); stepping onto `(7,5)` reveals the Runic Waystone (`crossroads_7_5_north.jpg`); stepping onto `(7,4)` shows the colossal Primeval Black Oak looming ahead (`forest_7_4_north_oak_approach.jpg`); stepping onto `(7,3)` places the hero directly before the amber-glowing root archway (`forest_ancient_oak.jpg`).
   - Turning 180° (`SOUTH`) at `(7,3)` looks out from beneath the massive root arch back down the southern trail (`ancient_oak_7_3_south.jpg`), and walking South leads cleanly back through the Crossroads and Gatehouse into Oakhaven Sanctuary (`north_gate_7_6_south.jpg`).
2. **Eastern River Crossing (`Oakhaven (7,7)` $\leftrightarrow$ `Old Stone Bridge (8,7)` $\leftrightarrow$ `Bridge East Watchpost (9,7)` $\leftrightarrow$ `Windblown Heath (12,4)`)**:
   - Looking `EAST` inside Oakhaven `(7,7)` previews The Old Stone Bridge through the Eastern River Gate (`oakhaven_7_7_east.jpg`).
   - Stepping onto `(8,7) EAST` walks across the wet flagstones toward the ruined Watchpost (`bridge_8_7_east.jpg`), while turning `NORTH` or `SOUTH` looks over the low stone parapet into the churning Blackwater River (`bridge_8_7_north.jpg` / `bridge_8_7_south.jpg`).
   - Stepping onto `(9,7)` enters the ruined Watchpost; turning `WEST` looks back through the Gothic stone arch across the bridge toward Oakhaven (`watchpost_9_7_west.jpg`), while facing `EAST` looks out onto the overgrown frontier road (`watchpost_9_7_east.jpg`).
3. **Southern Fen & Sunken Ruins Expedition (`Oakhaven (7,7)` $\leftrightarrow$ `South Gate (7,8)` $\leftrightarrow$ `Rotting Fen (6,10)` $\leftrightarrow$ `Deadman's Mire (4,11)`)**:
   - Looking `SOUTH` inside Oakhaven `(7,7)` shows the sloping storehouse lane toward South Gate (`oakhaven_7_7_south.jpg`).
   - Stepping onto `(7,8) SOUTH` looks out through the timber gate posts onto the muddy fen causeway (`south_gate_7_8_south.jpg`), while turning `NORTH` looks back at Oakhaven's fortified timber palisade (`south_gate_7_8_north.jpg`).
   - Approaching `(4,11)` from `(4,10) SOUTH` or `(3,11) EAST` previews the sunken Gothic temple arches rising from the mire (`swamp_approach_mire_ruins.jpg`), and stepping onto `(4,11)` places the hero on the flooded temple flagstones (`deadmans_mire_4_11_ruins.jpg`).

---

## E. Atmospheric & Environmental Effects Engine

`resolveAtmosphericEffectProfile()` in [`action-ui-lab/scene-catalog.js`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/scene-catalog.js) and `syncAtmosphericEffects()` in [`action-ui-lab/public/action-ui.js`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/public/action-ui.js) drive 12 location-aware atmospheric profiles:

| Profile Key | Active Locations | Particle Type & Motion | Ambient Light / Mist Pulse |
| :--- | :--- | :--- | :--- |
| `SANCTUARY_EMBERS` | Oakhaven Sanctuary `(7,7)` | Warm rising hearth embers (`ember`) | Warm torchlight flicker (`torch-warm`) |
| `GATE_TORCH_MIST` | North Gate `(7,6)` & South Gate `(7,8)` | Torch embers + drifting gate mist | Amber brazier pulse (`torch-gate`) |
| `RIVER_SPRAY` | Old Stone Bridge `(8,7)` & River Banks | Cool upward water spray droplets (`spray`) | Cold river-mist drift (`water-shimmer`) |
| `RUINS_DUST` | Bridge East Watchpost `(9,7)` | Slow floating stone motes (`dust`) | Cold overcast ruin haze |
| `FOREST_POLLEN_MIST` | Mirkwood Forest & Crossroads `(7,5)` | Pale floating woodland motes (`pollen`) | Canopy shadow breathing (`canopy-breathe`) |
| `ANCIENT_OAK_SPORES` | Heart of the Mirkwood `(7,3)` & `(7,4) N` | Golden-amber sap spores (`spore-gold`) | Warm amber root-glow pulse (`oak-amber`) |
| `SWAMP_MIASMA` | Rotting Fen (`SWAMP`) & Boardwalk `(6,10)` | Rising greenish bog miasma (`miasma`) | Low creeping marsh fog (`swamp-pulse`) |
| `MIRE_RUINS_FOG` | Deadman's Mire `(4,11)` & approaches | Eldritch pale-green ruin motes (`miasma`) | Sunken sanctuary mist drift |
| `JUNGLE_SPORES` | Venomous Jungle (`JUNGLE`) & `(9,11)` | Bioluminescent toxic green spores (`spore-green`) | Humid jungle spore glow (`jungle-glow`) |
| `HIGHLAND_WIND_ASH` | Raven Crags (`HILLS`) & `(3,5)` | Wind-driven diagonal slate ash (`wind-ash`) | Cold crag wind drift (`crag-wind`) |
| `HEATH_MIST` | Verdant Plains & Windblown Heath `(12,4)` | Horizontal wind-blown moor mist (`mist-mote`) | Open overcast sky drift |
| `BARRIER_GALE` | Impassable Mountain / Sea / Mire Barriers | High-velocity gale dust & spray (`wind-ash`) | Ominous boundary vignette |

- **3-Way Lab Toggle (`EFFECTS: Off | Subtle ★ | Full`)**:
  - `Off`: Disables all canvas particles (`0` particles) and CSS ambient pulses.
  - `Subtle ★` (Default): Renders `8–14` low-opacity particles at `30 FPS` so the environment feels alive without ever distracting from the artwork or combat HUD.
  - `Full`: Renders `18–28` particles with enhanced atmospheric mist drift.

---

## F. Environmental Storytelling & Points of Interest (`Inspect [I]`)

We added **12 inspectable Points of Interest (`POI_CATALOG` in `scene-catalog.js`)** across the world. When the hero stands at a POI coordinate and faces a matching direction outside active combat, a `🔍 Inspect ... [I]` button appears in the top-right viewport HUD. Pressing `I` or clicking the button opens a non-intrusive dark-fantasy Lore Plaque (`#fp-poi-plaque-card`) and logs an English chronicle note without altering HP, XP, gold, or inventory:

1. **`poi_oakhaven_sanctuary_hearth`** (`[7,7] N/E/S/W`) — *The Sanctuary Hearth of Oakhaven*
2. **`poi_oakhaven_north_gate`** (`[7,6] N/E/S/W`) — *Oakhaven Northern Timber Gatehouse*
3. **`poi_oakhaven_south_gate`** (`[7,8] N/E/S/W`) — *The Fen-Ward Southern Gatehouse*
4. **`poi_crossroads_runic_waystone`** (`[7,5] N/E/S/W`) — *Runic Waystone of Mirkwood Crossroads* (`"MIÐGARÐ • NORÐR • MYRKVIÐR"`)
5. **`poi_primeval_black_oak`** (`[7,3] N/E/S/W`) — *The Primeval Black Oak*
6. **`poi_old_stone_bridge`** (`[8,7] N/E/S/W`) — *The Old Stone Bridge Over the Blackwater*
7. **`poi_bridge_east_watchpost`** (`[9,7] N/E/S/W`) — *Ruined Bridge East Watchpost*
8. **`poi_deadmans_mire_sunken_temple`** (`[4,11] N/E/S/W`) — *Sunken Temple of Deadman's Mire*
9. **`poi_raven_crags_sentinel_cairn`** (`[3,5] N/E/S/W`) — *The Sentinel Cairn of Raven Crags*
10. **`poi_windblown_heath_standing_stones`** (`[12,4] N/E/S/W`) — *Frontier Monoliths of Windblown Heath*
11. **`poi_rotting_fen_drowned_boardwalk`** (`[6,10] N/E/S/W`) — *The Drowned Pilgrim Boardwalk*
12. **`poi_venomous_jungle_spore_hollow`** (`[9,11] N/E/S/W`) — *Bioluminescent Spore Hollow*

---

## G. Monster Cutout Expansion & Combat Integration (`7` Cutout Species + Safe Card Fallback)

All **7 Integrated Monster Cutouts** in `action-ui-lab/public/images/monsters-cutout/` feature true RGBA transparency (`0` opaque border pixels, edge-decontaminated silhouettes) and bespoke anatomical ground-contact shadow rigs in `MONSTER_INTEGRATED_PROFILES`:

| Monster Species | Cutout Asset | Size Category | Grounding Mode | Anatomical Contact Patches |
| :--- | :--- | :---: | :---: | :--- |
| **Manticore** | `manticore.png` (`1022×758`) | `LARGE_WINGED` | `AIRBORNE_HOVER` | `0` (True airborne separation; soft ground shadow on floor below) |
| **Ghoul** | `ghoul.png` (`783×751`) | `MEDIUM_HUMANOID` | `GROUNDED_CROUCH` | `2` (`left-foot`, `right-foot`) |
| **Assassin Vine** | `assassin_vine.png` (`796×853`) | `COILED_PLANT` | `GROUNDED_ROOTED` | `3` (`root-left`, `root-center`, `root-right`) |
| **Wolf** | `wolf.png` (`827×812`) | `MEDIUM_QUADRUPED` | `GROUNDED_PAWS` | `3` (`front-left-paw`, `front-right-paw`, `hind-paws`) |
| **Skeletal Champion** *(New)* | `skeletal_champion.png` (`579×922`) | `MEDIUM_HUMANOID` | `GROUNDED_BOOTS` | `2` (`left-sabaton`, `right-sabaton`) |
| **Giant Spider** *(New)* | `giant_spider.png` (`860×718`) | `LARGE_ARACHNID` | `GROUNDED_ARACHNID` | `3` (`left-tarsicluster`, `pedipalp-shadow`, `right-tarsicluster`) |
| **Troll** *(New)* | `troll.png` (`643×833`) | `LARGE_BRUTE` | `GROUNDED_HEAVY` | `2` (`left-heavy-foot`, `right-heavy-foot`) |
| **Rust Monster** *(Fallback)* | `/images/monsters/rust_monster.png` | `MEDIUM` | `CARD_FALLBACK` | Automatic safe `🛡️ Card Fallback` when no cutout exists |

---

## H. Developer Tools Added (`World Visual Atlas` & `Visual QA Suite`)

1. **Interactive World Visual Atlas (`🗺️ World Atlas [V]`)**:
   - Displays live summary metrics (`640` Passable POVs, `42` Grade A, `153` Grade B, `445` Grade C, `0` Grade D, `49` Unique Paintings).
   - Interactive 15×15 color-coded map grid with filter pills (`All Tiles`, `Passable`, `Has Grade A`, `Has Grade B`, `Has Grade C`, `🔍 Points of Interest (12)`).
   - Clicking any tile opens a 4-Direction Inspector (`NORTH`, `EAST`, `SOUTH`, `WEST`) showing the exact resolved painting thumbnail, quality grade, POV tier, ahead tile status, stage ground surface, atmospheric effect profile, and one-click `⚡ Teleport` buttons.
2. **Visual QA & Expedition Verification Modal (`📊 Visual QA`)**:
   - Displays live verification status (`100% PASS — Zero Grade-D Views`), all `7` Integrated Monster Cutout Rigs, all `12` Inspectable Points of Interest with one-click `⚡ Visit [x,y]` buttons, and the `53/53` Headless Chrome Visual Regression result summary.

---

## I. Automated Test & Visual QA Results

### 1. Automated Unit & Integration Test Suite (`23/23` Passing)
Command:
```bash
node --test action-ui-lab/tests/action-lab.test.js
```
- All **23 tests pass** (`0` failures), covering movement, facing persistence, 5-tier Mode C POV resolution, Stage 1 encounter secrecy, multi-beat combat choreography, seamless 1-step post-victory movement, 15×15 World Visual Atlas zero-Grade-D verification, atmospheric effect profiles, POI inspection (`INSPECT_POI`), and all 7 integrated monster cutouts.

### 2. Automated Headless Chrome Visual Regression Suite (`53/53` Passing)
Command:
```bash
node action-ui-lab/tests/visual-regression.js
```
- Launches `action-ui-lab/server.js`, connects headless Chrome via WebSocket CDP, executes **53 visual & DOM assertions**, writes structured JSON results to `action-ui-lab/docs/visual-qa-results.json`, and captures **51 PNG screenshots** across landmarks, barriers, atmospheric modes, POI plaques, all 7 cutout monsters + Card fallback, developer modals, and 4 responsive resolutions (`1920×1080`, `1440×900`, `1280×800` Handheld PC / Steam Deck, and `1280×720`) in `action-ui-lab/docs/screenshots/expedition/`.

---

## J. Responsive & Handheld PC Readiness

Verified zero-scroll (`overflow: hidden` on `html, body`, `clientHeight === scrollHeight`) and crisp HUD readability across all 4 target viewports:
- **Desktop 1080p (`1920×1080`)**: `48_responsive_1920x1080.png`
- **Laptop 900p (`1440×900`)**: `49_responsive_1440x900.png`
- **Handheld PC / Steam Deck 16:10 (`1280×800`)**: `50_responsive_1280x800_handheld.png`
- **Compact HD 720p (`1280×720`)**: `51_responsive_1280x720.png`

---

## K. Recommendations for Next Milestone

1. **Additional Monster Cutouts**: Extract RGBA cutouts for the remaining bestiary creatures (`Rust Monster`, `Goblin Raider`, `Wight`, `Ogre`, `Wyvern`) so 100% of encounters use `Mode 2: Integrated` without needing `Card Fallback`.
2. **Time-of-Day / Weather Cycle Toggle**: Expand the Atmospheric Effects Engine with an optional dusk/night/storm lighting cycle in the Lab Director Bar.
3. **Audio Ambience Synthesis**: Pair the 12 `ATMOSPHERE_EFFECT_PROFILES` with subtle WebAudio procedural ambient soundscapes (crackling hearth fire in Oakhaven, rushing water on the Old Stone Bridge, wind in Raven Crags).
