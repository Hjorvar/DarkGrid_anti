# DARKGRID ADVENTURE LAB — PHASE 5.1 WORLD CONTINUITY & PREVIEW MODE VERIFICATION

**Branch:** `phase_5_1_review`  
**Scope:** `action-ui-lab/`  
**World Grid:** `15 × 15` (`225` total tiles, `160` passable tiles, `640` passable directional viewpoints)

---

## 1. Exact Classification of the Phase 5 `53 MISSING ART` Metric (`Section 4.1`)

In Phase 5, the legacy audit script reported `APPROVED_DEFAULT: 412 PASS, 175 DUPLICATE, 53 MISSING ART`. In Phase 5.1, we investigated the exact cause of those `53 MISSING ART` flags and implemented a rigorous 6-metric classifier (`evaluateWorldArtAudit` in [`scene-catalog.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/scene-catalog.js)):

### Root Cause of the Legacy `53 MISSING ART` Count
- **Answer: Option B + Option D.** Every single one of those `53` viewpoints has a **valid, existing, approved fallback image file on disk** that loads and renders cleanly (`0` missing files, `0` HTTP 404s).
- Specifically, those `53` viewpoints are the **Tier 1 / Tier 3 viewpoints** (`[9,7] SOUTH` `fp_watchpost_9_7_south`, `[7,5] EAST` `pov_forest_track_east`, and the 5 biome transition rules `HILLS->SWAMP`, `SWAMP->PLAINS`, `HILLS->FOREST`, `PLAINS->HILLS`, `HILLS->PLAINS`) whose dedicated Phase 5 candidate paintings (`P5-ART-02`, `P5-ART-08`..`P5-ART-13`) are currently staged as `REVIEW REQUIRED`.
- Another `122` Tier 4 viewpoints also have a staged Phase 5 candidate painting (`P5-ART-01`, `03`, `04`, `05`, `06`, `07`) awaiting owner approval while currently rendering a valid approved fallback image (`122 + 53 = 175` total viewpoints with pending candidate artwork).

### Phase 5.1 6-Metric World Art Audit Breakdown (`640` Passable Viewpoints)

| Audit Metric | Definition | `APPROVED_DEFAULT` (All 13 `REVIEW REQUIRED`) | `CANDIDATES_STAGED` (Preview Mode) | Recommended Approval (`P5-ART-04` Restricted + `P5-ART-04-REPL`) |
|---|---|---:|---:|---:|
| **`BROKEN_IMAGE_REFERENCE`** | Resolved `imageUrl` does not exist on disk or fails to decode. | **0** | **0** | **0** |
| **`WRONG_SCENE`** | Resolved `imageUrl` violates biome/landmark rules (`Grade D` gap). | **0** | **0** | **0** |
| **`VALID_APPROVED_FALLBACK`** | Viewpoint renders a valid approved fallback image on disk while its dedicated Phase 5 candidate awaits approval. | **175** *(53 Tier 1/3 + 122 Tier 4)* | **0** | **0** |
| **`CANDIDATE_ART_PENDING`** | Viewpoint has a staged Phase 5 candidate painting in `REVIEW REQUIRED` status. | **175** *(53 Tier 1/3 + 122 Tier 4)* | **0** | **0** |
| **`EXACT_DUPLICATE`** | Viewpoints sharing an identical `imageUrl` on the same tile (`EXACT_DUPLICATE_TIER4` tracks avoidable Tier 4 pool collisions; `10–14` are multi-direction corner barriers/transitions where 2 perpendicular facings look into the same impassable mountain/river/mire or border biome). | **200** *(186 Tier 4 + 14 corner)* | **10** *(0 Tier 4 + 10 corner)* | **10** *(0 Tier 4 + 10 corner)* |
| **`ACCEPTABLE_REUSE`** | Viewpoints whose painting is reused across different tiles without any same-tile Tier 4 collision (`+ bespoke single-use`). | **418** *(+ 22 single-use)* | **605** *(+ 25 single-use)* | **604** *(+ 26 single-use)* |
| **Unique Paintings Active** | Total distinct environment image files rendered across the 640 passable viewpoints. | **51** | **63** | **64** |

---

## 2. Candidate Preview Mode Isolation & Security (`Section 4.2`)

We audited and hardened Candidate Preview Mode across the backend and frontend:

1. **Per-Instance `WeakMap` State Isolation:**
   - Replaced the process-wide `globalCandidateArtPreviewEnabled` boolean in [`scene-catalog.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/scene-catalog.js) with a `WeakMap` keyed by the SQLite `db` instance (`previewModeByDb`).
   - Separate Lab instances (`createLabApp({ dbPath: ':memory:' })`) never leak preview mode state to one another (`phase-5-world.test.js` Test 9).
2. **Per-Request Query Parameter Isolation:**
   - Passing `?artPreview=candidates` or `?useCandidateArt=1` to `GET /api/state`, `GET /api/atlas`, or `GET /api/visual-qa` previews candidate artwork **only for that HTTP request** without mutating the database instance's default player mode (`phase-5-world.test.js` Test 9).
3. **Explicit In-Viewport UI Badge (`#fp-art-preview-badge`):**
   - Added `#fp-art-preview-badge` to [`public/index.html`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/public/index.html) and [`public/js/world/scene-renderer.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/phase_5_1_review/action-ui-lab/public/js/world/scene-renderer.js).
   - Whenever an unapproved candidate painting (`artApprovalStatus === 'REVIEW REQUIRED'`) is rendered in Candidate Preview Mode, the viewport displays a prominent gold/amber pill: `🎨 CANDIDATE ART • P5-ART-XX (REVIEW REQUIRED)`.
   - In `APPROVED_DEFAULT` mode (and on already-approved landmarks during preview), the badge is automatically hidden (`hidden = true`).
4. **Zero Production Impact:**
   - All preview logic lives strictly inside `action-ui-lab/` and serves candidate files from `/lab-assets/art-candidates/*`. Production Darkgrid (`src/`, `db/`) is completely untouched.

---

## 3. Independent World Continuity Verification — Journeys A, B, and C (`Section 5`)

We verified all three canonical world journeys step-by-step in both `APPROVED_DEFAULT` and `CANDIDATES_STAGED` (`phase-5-world.test.js` Tests 5, 6, 7):

### Journey A — Oakhaven `[7,7]` to Primeval Black Oak `[7,3]` and Back
- **Route:** `[7,7] NORTH` (`Oakhaven`) $\rightarrow$ `[7,6] NORTH` (`Oakhaven North Gate`) $\rightarrow$ `[7,5] NORTH` (`Mirkwood Crossroads`) $\rightarrow$ `[7,4] NORTH` (`Mirkwood Trail`) $\rightarrow$ `[7,3] NORTH` (`Primeval Black Oak`).
- **4-Direction Rotation at `[7,3]` (Tier 1 `DEFAULT_PERSPECTIVE_VIEWS`):**
  - `NORTH` (`fp_ancient_oak_7_3_north`): `/lab-assets/images/terrain/forest_ancient_oak.jpg` (*Heart of the Mirkwood — Facing the Ancient Black Oak*).
  - `EAST` (`fp_ancient_oak_7_3_east`): `/lab-assets/images/terrain/forest_pine_ravine.jpg` (*Heart of the Mirkwood — Eastern Ravine Flank*).
  - `SOUTH` (`fp_ancient_oak_7_3_south`): `/lab-assets/images/perspective/ancient_oak_7_3_south.jpg` (*Heart of the Mirkwood — Looking South From Beneath the Root Arch*).
  - `WEST` (`fp_ancient_oak_7_3_west`): `/images/terrain/terrain_forest.webp` (*Heart of the Mirkwood — Western Deep Boughs*).
  - **4/4 distinct paintings (`0` duplicates).**
- **Return South `[7,3] -> [7,4] -> [7,5] -> [7,6] -> [7,7]`:**
  - `[7,4] SOUTH` resolves `crossroads_7_5_lateral.jpg` (descending toward Crossroads).
  - `[7,5] SOUTH` resolves `crossroads_7_5_south.jpg` (Oakhaven gatehouse visible ahead).
  - `[7,6] SOUTH` resolves `north_gate_7_6_south.jpg` (entering Oakhaven Sanctuary).

### Journey B — Oakhaven `[7,7]` to Bridge East Watchpost `[9,7]` and Eastern Plains `[10,7]`
- **Route:** `[7,7] EAST` $\rightarrow$ `[8,7] EAST` (`Old Stone Bridge`) $\rightarrow$ `[9,7] EAST` (`Bridge East Watchpost`) $\rightarrow$ `[10,7] EAST` (`Verdant Plains`).
- **Bridge `[8,7]` Flanks:**
  - `NORTH` and `SOUTH` at `[8,7]` both face impassable `Blackwater River` (`[8,6]` and `[8,8]`) and resolve `bridge_8_7_north.jpg` / `bridge_8_7_south.jpg` (`isAheadBlocked = true`, `obstacleType = 'RIVER'`).
- **Watchpost `[9,7]` 4-Direction Continuity:**
  - `NORTH`: `watchpost_9_7_river_flank.jpg` (impassable `Blackwater River` `[9,6]`).
  - `EAST`: `watchpost_9_7_east.jpg` (broken eastern arch opening onto `Verdant Plains` `[10,7]`).
  - `SOUTH`: In `CANDIDATES_STAGED`, resolves `watchpost_9_7_south_river_gorge.jpg` (`P5-ART-13`, broken southern parapet with wedged pike overlooking `Blackwater River` `[9,8]`); in `APPROVED_DEFAULT`, resolves valid approved fallback `watchpost_9_7_river_flank.jpg` (`VALID_APPROVED_FALLBACK`).
  - `WEST`: `watchpost_9_7_west.jpg` (looking back west across `Old Stone Bridge` `[8,7]`).

### Journey C — Oakhaven `[7,7]` to Deadman's Mire `[4,11]` and Back
- **Route:** `[7,7] SOUTH` $\rightarrow$ `[7,8] SOUTH` (`Oakhaven South Gate`) $\rightarrow$ `[7,9] WEST` $\rightarrow$ `[6,9] SOUTH` (`transition_plains_to_swamp_pov.jpg`) $\rightarrow$ `[6,10] SOUTH` (`Rotting Fen Boardwalk`) $\rightarrow$ `[6,11] WEST` $\rightarrow$ `[5,11] WEST` (`swamp_approach_mire_ruins.jpg`, Gothic ruin arches emerging ahead) $\rightarrow$ `[4,11] WEST` (`Deadman's Mire`).
- **4-Direction Rotation at `[4,11]` (`Deadman's Mire`, Tier 1 `DEFAULT_PERSPECTIVE_VIEWS`):**
  - `NORTH` (`fp_deadmans_mire_4_11_north`): `/lab-assets/images/perspective/deadmans_mire_4_11_ruins.jpg` (*At Deadman’s Mire — Sunken Gothic Temple Ruins (North)*).
  - `EAST` (`fp_deadmans_mire_4_11_east`): `/lab-assets/images/terrain/swamp_willow_boardwalk_pov.jpg` (*At Deadman’s Mire — Looking East Along the Willow Causeway*).
  - `SOUTH` (`fp_deadmans_mire_4_11_south`): `/lab-assets/images/perspective/swamp_approach_mire_ruins.jpg` (*At Deadman’s Mire — Looking South Across the Drowned Colonnades*).
  - `WEST` (`fp_deadmans_mire_4_11_west`): `/images/terrain/terrain_swamp.webp` (*At Deadman’s Mire — Looking West Into the Drowned Backwaters*).
  - **4/4 distinct paintings (`0` duplicates).**
- **Return Route `[4,11] -> [5,11] -> [6,11] -> [6,10] -> [6,9] -> [7,9] -> [7,8] -> [7,7]`:**
  - `[6,10] NORTH` resolves `transition_swamp_to_plains_pov.jpg` (`P5-ART-09` in `CANDIDATES_STAGED`; `swamp_willow_boardwalk_pov.jpg` in `APPROVED_DEFAULT`) climbing out of the marsh onto `Verdant Plains` `[6,9]`.
  - `[7,9] NORTH` resolves `plains_7_9_north_gate_approach.jpg` (`Oakhaven South Gate` palisade ahead).
  - `[7,8] NORTH` resolves `south_gate_7_8_north.jpg` (returning into `Oakhaven`).
