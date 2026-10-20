# Darkgrid — The Living World Expedition (`action-ui-lab/`) Progress Tracker

## Mission Scope & Rules
- **Isolated Lab Scope Only**: Only modify/create files inside `action-ui-lab/`. Never touch `src/`, `db/`, root `public/`, root `package.json`, main SQLite DB, or Firebase.
- **English-Only Player UI**: All player-facing UI text, captions, tooltips, and chronicle logs are in English.
- **Asset Preservation**: All previously approved assets in `action-ui-lab/public/images/perspective/` (10 files), `action-ui-lab/public/images/terrain/` (4 files), and `action-ui-lab/public/images/monsters-cutout/` (4 files) remain untouched.

---

## Phase Checklist

- [x] **Phase 1: World Visual Atlas & Complete Coverage Audit**
  - [x] 1.1 Build Complete World Visual Matrix (`225` tiles × `4` directions = `900` total directional viewpoints; `160` passable tiles × `4` = `640` passable directional viewpoints)
  - [x] 1.2 Interactive "World Visual Atlas" Developer View (`🗺️ World Atlas [V]`) + `GET /api/atlas` + one-click `TELEPORT_TO_TILE`
  - [x] 1.3 Quality Grading (`A`: `42` Bespoke POV, `B`: `153` Contextual POV, `C`: `445` Generic Safe POV, `D`: `0` Missing/Leaked)

- [x] **Phase 2: Spatial Continuity, Landmark Journeys & Biome Transitions**
  - [x] 2.1 Landmark 360° & Approach Continuity (`Oakhaven`, `North Gate`, `South Gate`, `Crossroads`, `Primeval Black Oak`, `Old Stone Bridge`, `Bridge East Watchpost`, `Deadman's Mire`, `Stonefang Crag`)
  - [x] 2.2 Biome Boundary & Transition Views (`Plains <-> Forest`, `Plains -> Swamp`, `Forest -> Hills`, `Swamp -> Jungle`)
  - [x] 2.3 Impassable World Edge & Obstacle Views (`Darkmount Peaks`, `The Murksea`, `The Bottomless Mire`, `Blackwater River`, `Stonefang Crag`)

- [x] **Phase 3: Targeted First-Person Artwork Generation (`31` New Eye-Level Paintings)**
  - [x] `26` new eye-level paintings in `action-ui-lab/public/images/perspective/`
  - [x] `5` new eye-level sub-biome paintings in `action-ui-lab/public/images/terrain/`
  - [x] Total active unique environment paintings: `49`

- [x] **Phase 4: Subtle Atmospheric & Environmental Effects Engine (`Off | Subtle ★ | Full`)**
  - [x] 4.1 Subtle Living Environment Layer (`#fp-atmo-canvas` + CSS ambient light/mist drift, `prefers-reduced-motion` aware)
  - [x] 4.2 Data-Driven Atmospheric Profiles (`12` profiles in `ATMOSPHERE_EFFECT_PROFILES`)
  - [x] 4.3 Non-Gameplay Points of Interest (`12` inspectable landmarks in `POI_CATALOG`, `Inspect [I]` + `#fp-poi-plaque-card`)

- [x] **Phase 5: Monster Cutout Expansion & Combat Stage Polish (`7` Integrated Cutouts)**
  - [x] 5.1 Expanded RGBA Cutouts: `Skeletal Champion` (`skeletal_champion.png`), `Giant Spider` (`giant_spider.png`), `Troll` (`troll.png`) + existing `Manticore`, `Ghoul`, `Assassin Vine`, `Wolf` + automatic `Card Fallback` (`Rust Monster`)
  - [x] 5.2 Dynamic Stage Grounding & Combat Emergence Polish (`monsterEmergeFromMist` animation + anatomical multi-patch contact shadows)

- [x] **Phase 6: Automated Visual Regression & Self-Verification Suite**
  - [x] 6.1 `node --test action-ui-lab/tests/action-lab.test.js` (`23/23` tests passing)
  - [x] 6.2 `node action-ui-lab/tests/visual-regression.js` (`53/53` headless Chrome visual QA checks passing + `51` screenshots in `action-ui-lab/docs/screenshots/expedition/`)

- [x] **Phase 7: Performance, Preloading & Responsive Viewport Polish**
  - [x] 7.1 Adjacent & Rotational Preloading (`preloadUrls` for 4 rotations + 4 adjacent forward steps)
  - [x] 7.2 Multi-Resolution & Handheld Viewport Verification (`1920×1080`, `1440×900`, `1280×800` Handheld PC, `1280×720`)

- [x] **Phase 8: Final Expedition Report**
  - [x] Written to [`action-ui-lab/docs/living-world-expedition-report.md`](living-world-expedition-report.md)
