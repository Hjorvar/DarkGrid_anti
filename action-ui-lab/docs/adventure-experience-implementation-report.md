# Darkgrid — The Adventure Experience: Implementation Report

**Project Scope:** Isolated inside `action-ui-lab/` (`http://localhost:3100`)  
**Status:** Complete & Verified (`30/30` Unit/Integration Tests + `65/65` Headless Chrome Visual & Journey Checks)  
**Main Game Impact:** `0` modified files outside `action-ui-lab/` (100% isolated Lab implementation)

---

## 1. Executive Summary

This mission evolved the Darkgrid First-Person Action UI Lab from a visually striking technical showcase (`160` walkable tiles, `640` directional views, `49` environment paintings, `7` integrated monster cutouts, Atmospheric Effects Engine, and `12` POIs) into a genuinely playable RPG adventure structured around the core loop:

$$\text{Curiosity} \rightarrow \text{Exploration} \rightarrow \text{Discovery} \rightarrow \text{Tension} \rightarrow \text{Encounter} \rightarrow \text{Consequence} \rightarrow \text{Progress}$$

Key accomplishments delivered in this mission:

1. **Critical Visual & Technical Polish (Phase 1):**
   - Eliminated transient black-frame flashes during rapid movement/screenshots by diagnosing and fixing the `.is-crossfading` (`opacity: 0 !important`) dual-zero-opacity race condition between `#fp-terrain-img` and `#fp-terrain-img-prev`, paired with `HTMLImageElement.decode()` synchronization (`window.__waitForSceneReady`) and `Cache-Control: public, max-age=3600` headers for `/lab-assets/images/*`.
   - Eliminated duplicate `LANDMARK_INSPECTED` notifications by removing redundant client-side `pushWorldPopup()` dispatches when the server already emits `worldEvents` and adding a `950ms` key-based deduplication window (`type::title::sub`).
   - Replaced omnidirectional POI inspection with a data-driven **Line-of-Sight & Directional Visibility System** (`visibleFacings`, `inspectionMode`, and per-direction `facingViews`) across all 12 POIs.
   - Consolidated the top control bar into a single non-wrapping flex strip (`.lab-director-bar`) with responsive breakpoints tested at `1920×1080`, `1440×900`, `1280×800`, and `1280×720`.
2. **Authentic Player Journey Audit (Phase 2):**
   - Conducted real step-by-step browser walkthroughs (no teleport shortcuts) across **Expedition A (Into the Mirkwood)**, **Expedition B (The Ruined Watchpost)**, and **Expedition C (Into the Rotten Lands)**, capturing `37` journey screenshots and auditing all 10 gameplay dimensions.
3. **The Expedition Experience Prototype (Phases 3–9):**
   - Built `action-ui-lab/adventure-engine.js` providing an instant-toggleable **Expedition Experience Mode (`ADVENTURE` vs `CURRENT`)** with **18 world-consistent environmental discoveries**, **3 presentation tiers** (`AMBIENT`, `NOTICEABLE`, `IMPORTANT`), **anti-oscillation & step-cooldown pacing**, **3-tier tension separation** (`AMBIENT_TENSION`, `GENUINE_EVIDENCE`, `ENCOUNTER_INTRO`), **contextual player choices** with Lab-local consequences (`cautiousStepActive`, `alertBonusActive`, `wardActive`, `salvagedTokens`, `journalClues`, `safePassageSteps`), an **Expedition Journal (`📖 Journal [L]`)**, **Combat UI & Giant Spider visual polish**, **3 complete playable Expedition Arcs**, and a **Developer & Playtest Director (`🎬 Director [G]`)**.

---

## 2. Confirmed Bugs & Fixes (Phase 1)

### 2.1 Black Scene / Image Loading Investigation (`[9,7]` WEST & NORTH)

- **Investigation:**
  - Inspected asset paths and verified that all paintings at Bridge East Watchpost `[9,7]` (`watchpost_approach_west.png`, `watchpost_approach_north.png`, `ruined_watchtower.png`) exist on disk and resolve with HTTP `200`.
  - Audited `applySceneImageWithCrossfade()` in `action-ui-lab/public/action-ui.js` and `#fp-terrain-img.is-crossfading` in `action-ui-lab/public/action-ui.css`.
- **Root Causes Confirmed:**
  1. **Dual-Zero-Opacity Crossfade Race:** When changing scenes, `applySceneImageWithCrossfade()` added `.is-crossfading` to `#fp-terrain-img` (which applied `opacity: 0 !important` in CSS) and relied on a fixed `190ms` `setTimeout` (`crossfadeCleanupTimer`) to remove `.is-crossfading`. However, as soon as `decode()` resolved (~5–15ms), `#fp-terrain-img-prev` was set to `opacity: 0` while `#fp-terrain-img` still had `.is-crossfading` (`opacity: 0 !important`) for the remaining ~175ms. Any frame or screenshot captured during that window rendered the raw `#05070a` dark background!
  2. **Uncached Static Image Re-fetches:** `/lab-assets/images/*` lacked explicit HTTP cache headers, causing repeated disk/network fetches during rapid rotation or step sequences.
- **Fixes Applied:**
  - Held `#fp-terrain-img-prev` at `opacity: 1` with the previous scene image until `HTMLImageElement.decode()` resolves on `#fp-terrain-img`, and removed `.is-crossfading` synchronously inside `finalizeSwap()` before fading `#fp-terrain-img-prev` to `0`.
  - Exposed `window.__waitForSceneReady()` awaiting `window.__sceneImageDecodePromise`, `terrainImg.decode()`, and two `requestAnimationFrame` ticks.
  - Added `Cache-Control: public, max-age=3600` to `/lab-assets/images` static middleware in `action-ui-lab/server.js`.
  - Added pixel-level luminance/RGB variance verification (`sampleViewportPixels`) in `action-ui-lab/tests/visual-regression.js` to assert actual rendered pixels on screen rather than merely checking DOM `src` attributes.

### 2.2 Duplicate Notifications (`LANDMARK INSPECTED`)

- **Investigation:**
  - Audited `INSPECT_LANDMARK` handling in both `action-ui-lab/server.js` and `action-ui-lab/public/action-ui.js`.
- **Root Causes Confirmed:**
  1. **Dual Server + Client Emit:** `server.js` appended a `LANDMARK_INSPECTED` event into `state.worldEvents` (which `renderViewportWorldPopups(state)` automatically renders), AND `action-ui.js` (`btn-inspect-poi` click handler) manually called `pushWorldPopup('LANDMARK_INSPECTED', ...)` on the response.
  2. **No Deduplication Window:** Rapid consecutive actions or identical event payloads had no deduplication guard.
- **Fixes Applied:**
  - Removed the redundant manual `pushWorldPopup('LANDMARK_INSPECTED', ...)` call in `action-ui.js` so `state.worldEvents` serves as the single source of truth.
  - Added a `950ms` key-based deduplication guard (`${ev.type}::${ev.title}::${ev.sub}`) in `pushWorldPopup()` while preserving distinct legitimate events.

### 2.3 Inspect & Line of Sight (Directional POI Visibility)

- **Investigation:**
  - Previously, `getInspectableLandmark(x, y)` in `action-ui-lab/scene-catalog.js` only checked tile coordinates `(x, y)`. A player standing at Mirkwood Crossroads `[7,5]` facing `EAST` or `SOUTH` (looking away from both the Runestone and Stonefang Crag) still saw the `Inspect Weathered Runestone` button.
- **Fixes Applied:**
  - Upgraded `LANDMARK_CATALOG` and `getInspectableLandmark(x, y, facing)` in `action-ui-lab/scene-catalog.js` with data-driven directional rules:
    - `visibleFacings`: Array of facings from which the landmark is visible.
    - `inspectionMode`: `'OBJECT_IN_VIEW' | 'CONTEXTUAL_DIRECTION' | 'AREA_PRESENCE'`.
    - `facingViews`: Per-direction overrides for `buttonLabel`, `name`, `subtitle`, `description`, `lore`, and `clue`.
  - **Examples Verified:**
    - **Mirkwood Crossroads `[7,5]`:** `NORTH` shows `"Inspect Runestone"`, `WEST` shows `"Inspect Stonefang Crag"`, while `EAST` and `SOUTH` hide the Inspect button (`canInspect = false`).
    - **Ancient Oak `[7,3]`:** `NORTH`, `EAST`, and `WEST` show directional views of the hollow trunk and roots; `SOUTH` (looking back down the trail toward Oakhaven) hides the Inspect button.
    - **Gatehouses (`[7,6]`, `[7,8]`) & Oakhaven (`[7,7]`):** Support directional contextual descriptions (`facingViews`) tailored to the exact camera orientation.

### 2.4 Responsive UI (`1920×1080`, `1440×900`, `1280×800`, `1280×720`)

- **Investigation:**
  - At `1280×800` and `1280×720`, the top utility bar wrapped onto a second line and right-column controls felt cramped.
- **Fixes Applied:**
  - Re-architected `.lab-director-bar` in `action-ui-lab/public/index.html` and `action-ui-lab/public/action-ui.css` into a single non-wrapping flex strip (`height: 36px`, `31px` at `<=820px` height) with compact grouped controls (`Experience: Current | Adventure ★`, `📖 Journal [L]`, `🎬 Director [G]`, `🗺️ Atlas [M]`, `⚔️ Combat`, and drawer toggles).
  - Added dedicated `@media (max-width: 1460px)` and `@media (max-height: 820px)` rules in `action-ui.css` so all 4 target resolutions render with zero horizontal overflow (`scrollWidth <= innerWidth`), zero clipped buttons, and an unobstructed central 3D viewport.

---

## 3. Player Journey Audit (Phase 2)

Before designing the Adventure Experience layer, we executed three real step-by-step journeys in headless Chrome using only legal movement (`MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`, `INSPECT_LANDMARK`), saved under `action-ui-lab/docs/screenshots/expedition/`.

### 3.1 Three Expedition Journeys Executed

1. **Expedition A — Into the Mirkwood (`[7,7] → [7,6] → [7,5] → [7,4] → [7,3] → [7,7]`):**
   - Walked north from Oakhaven Town Square through North Gate, Mirkwood Crossroads, Forest Trail, and Ancient Oak, inspecting landmarks with directional Line-of-Sight, then turned around (`SOUTH`) and walked back to Oakhaven.
2. **Expedition B — The Ruined Watchpost (`[7,7] → [8,7] → [9,7] → [10,7]`):**
   - Turned `EAST` in Oakhaven, crossed Old Stone Bridge `[8,7]`, arrived at Bridge East Watchpost `[9,7]`, rotated through all 4 cardinal directions (`EAST`, `NORTH`, `WEST`, `SOUTH`) verifying zero black frames, inspected the ruined bastion, and continued to `[10,7]`.
3. **Expedition C — Into the Rotten Lands (`[7,7] → [7,8] → [7,9] → [6,9] → [5,9] → [5,10] → [4,10] → [4,11]`):**
   - Walked south through South Gate `[7,8]` into Rotting Fen `[7,9]`, navigated around impassable swamp water via the legal western marsh path (`[6,9] → [5,9] → [5,10] → [4,10]`), and reached Deadman's Mire `[4,11]`.

### 3.2 Experience Audit Across the 10 Criteria (Baseline `CURRENT` Mode)

| # | Audit Criterion | Baseline Finding (`CURRENT` Mode) | How `ADVENTURE` Mode Solves It |
|---|---|---|---|
| 1 | **Time to destination** | 4–7 steps (~25–45 seconds per leg). Fast and responsive, but lacked narrative pacing beats between landmarks. | Paced discoveries and expedition stage trackers make a 5-step trek feel like a multi-stage journey. |
| 2 | **Steps without events** | Up to 3–4 consecutive steps on intermediate corridor tiles (`[7,4]`, `[6,9]`, `[5,9]`, `[5,10]`) had zero interactive events unless a random combat triggered. | Discovery engine guarantees meaningful environmental signs or tracks every 2–3 tiles without spamming every step. |
| 3 | **Environment art repetition** | Low repetition thanks to the 5-tier image selector (`49` paintings), though transitional tiles within the same biome benefited from focal props/captions. | Discoveries bind specific narrative details (claw marks, signal horns, sunken gear) to transitional tiles. |
| 4 | **Spatial orientation** | High clarity near landmarks and compass/minimap, and substantially improved once directional POI Line-of-Sight was enforced. | Added explicit directional clue guidance and Expedition Ribbon stage indicators. |
| 5 | **Reason to stop** | Only on the 12 static POI tiles; non-POI tiles offered no reason to pause. | `NOTICEABLE` and `IMPORTANT` discoveries create organic micro-stops with 2–3 contextual choices. |
| 6 | **Reason to explore side paths** | Minimal in baseline mode; players walked the shortest Manhattan path between POIs. | Discoveries reward side-path investigation with `salvagedTokens`, `journalClues`, `wardActive`, and monster spore/track intel. |
| 7 | **Anticipation for next tile** | Ambient omen text existed, but players could not tell whether a warning meant a real monster was ahead or just flavor text. | 3-tier tension separation (`AMBIENT_TENSION` vs `GENUINE_EVIDENCE` vs `ENCOUNTER_INTRO`) makes genuine danger unmistakable. |
| 8 | **Outbound vs Return difference** | Outbound and return walks felt mechanically identical other than facing `SOUTH`/`WEST`. | Expedition arcs shift into `RETURN_HOME` phase once the primary objective is met, unlocking safe-haven completion rewards upon returning to Oakhaven `[7,7]`. |
| 9 | **Combat integration** | Encounters felt somewhat abrupt when stepping onto a tile. | Pre-encounter monster tracks/webs/spores build anticipation, and post-combat aftermath notes connect victory back to exploration. |
| 10 | **Sense of discovery** | Static POI modals were atmospheric, but passive. | Interactive 2–3 choice cards + persistent **Expedition Journal (`📖 Journal [L]`)** turn observations into player-driven discoveries. |

---

## 4. Discovery System Architecture (Phase 3)

Implemented in [`action-ui-lab/adventure-engine.js`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/adventure-engine.js) (`DISCOVERY_CATALOG`), containing **18 handcrafted, lore-accurate discoveries** distributed across Darkgrid's biomes:

- **Forest (`5` discoveries):**
  1. `forest_clawed_bark` (*Freshly Clawed Bark* — `NOTICEABLE`, `GENUINE_EVIDENCE`)
  2. `forest_web_shroud` (*Glistening Canopy Webs* — `IMPORTANT`, `GENUINE_EVIDENCE`, linked to `giant_spider`)
  3. `forest_abandoned_camp` (*Cold Ranger Campfire* — `IMPORTANT`, `AMBIENT_TENSION`)
  4. `forest_unnatural_silence` (*Sudden Canopy Silence* — `AMBIENT`, `AMBIENT_TENSION`)
  5. `forest_root_cache` (*Hollow Root Stash* — `NOTICEABLE`, `AMBIENT_TENSION`)
- **Swamp / Fen (`5` discoveries):**
  6. `swamp_black_ripples` (*Disturbed Black Water* — `AMBIENT`, `AMBIENT_TENSION`)
  7. `swamp_submerged_pack` (*Half-Submerged Courier Pack* — `IMPORTANT`, `AMBIENT_TENSION`)
  8. `swamp_vine_spores` (*Sweet-Rot Pollen Drift* — `NOTICEABLE`, `GENUINE_EVIDENCE`, linked to `assassin_vine`)
  9. `swamp_warning_totem` (*Reed-Bound Warning Stake* — `NOTICEABLE`, `GENUINE_EVIDENCE`)
  10. `swamp_mire_bones` (*Mire-Bleached Ribcage* — `IMPORTANT`, `GENUINE_EVIDENCE`, linked to `rot_worm`)
- **Ruins / Bridge / Outpost (`4` discoveries):**
  11. `ruins_bridge_scratches` (*Iron-Gouged Parapet Stones* — `NOTICEABLE`, `AMBIENT_TENSION`)
  12. `ruins_watchpost_horn` (*Cracked Watchman's Signal Horn* — `IMPORTANT`, `GENUINE_EVIDENCE`)
  13. `ruins_collapsed_cellar` (*Collapsed Munitions Grate* — `IMPORTANT`, `GENUINE_EVIDENCE`)
  14. `ruins_ash_footprints` (*Soot-Stained Bootprints* — `AMBIENT`, `GENUINE_EVIDENCE`)
- **Plains / Roads (`2` discoveries):**
  15. `plains_waystone_offerings` (*Roadside Waystone Offerings* — `NOTICEABLE`, `AMBIENT_TENSION`)
  16. `plains_distant_smoke` (*Thin Plume of Watchfire Smoke* — `AMBIENT`, `AMBIENT_TENSION`)
- **Highland / Mountain Fringe (`2` discoveries):**
  17. `crag_wind_cairn` (*Wind-Carved Trail Cairn* — `NOTICEABLE`, `AMBIENT_TENSION`)
  18. `crag_talon_scrape` (*Talon-Scored Ledge* — `IMPORTANT`, `GENUINE_EVIDENCE`)

### Three Presentation Tiers (`#fp-discovery-layer`)

To prevent modal fatigue, discoveries render inside `#fp-discovery-layer` at the bottom of the 3D viewport in three distinct visual weights:
1. **`AMBIENT` (Subtle Environmental Note):** Compact, single-line atmospheric pill (`🌿 AMBIENT SIGN`) that never blocks movement.
2. **`NOTICEABLE` (Expandable Discovery Ribbon):** Mid-weight gold-bordered ribbon showing the discovery title, summary, inline quick-action buttons, and an `Examine Choices (N)` expander.
3. **`IMPORTANT` (Interactive Discovery Card):** Rich card presenting the full narrative observation and a 2–3 option interactive choice grid (`.fp-disc-choices-grid`).

---

## 5. Exploration Pacing (Phase 3.4)

Implemented in `evaluateDiscoveryTrigger()` in [`action-ui-lab/adventure-engine.js`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/adventure-engine.js):

1. **Step Cooldown (`DISCOVERY_MIN_STEP_COOLDOWN = 2`):** After any discovery triggers, at least 2 full movement steps must occur before another random discovery can trigger, except on curated Expedition Milestone tiles (`[7,5]`, `[7,4]`, `[7,3]`, `[8,7]`, `[9,7]`, `[7,9]`, `[4,11]`).
2. **Anti-Oscillation Guard (`recentTileHistory`):** Stepping back and forth between recent tiles (`isOscillating` check over the last 4 visited coordinates) suppresses new discovery rolls (`reason: 'OSCILLATION_GUARD'`).
3. **Once-Per-Coordinate Exhaustion (`resolvedCoordDiscoveryKeys`):** Once a discovery has been resolved or dismissed on `(x, y)`, it will not re-trigger on that coordinate during the expedition.
4. **Deterministic Seeding (`deterministicSeed`):** Playtesters and automated tests can lock the RNG seed via `SET_DETERMINISTIC_SEED` or the `🎬 Director [G]` modal for 100% reproducible discovery sequences.

---

## 6. Tension & Encounter Presentation (Phase 3.5)

Implemented via `computeTensionState()` in [`action-ui-lab/adventure-engine.js`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/adventure-engine.js) and rendered in `#fp-tension-ribbon-wrap`:

| Tier | Badge Label | Visual Style | Meaning to the Player |
|---|---|---|---|
| `SAFE_HAVEN` | `SAFE HAVEN` | Moss green (`tier-safe_haven`) | Protected settlement (`Oakhaven`). |
| `AMBIENT_TENSION` | `ATMOSPHERE` | Muted slate-blue (`tier-ambient_tension`) | Purely atmospheric mood (wind, mist, silence); **never** fakes a monster. |
| `GENUINE_EVIDENCE` | `GENUINE SIGN` | Amber gold (`tier-genuine_evidence`) | Real physical sign or adjacent threat (claw marks, webs, spores, or active discovery). |
| `ENCOUNTER_INTRO` | `ACTIVE THREAT` | Crimson pulse (`tier-encounter_intro`) | Immediate hostile encounter in the 3D viewport. |

---

## 7. Player Choices & Adventure Memory (Phases 3.6 & 3.7)

Every `NOTICEABLE` and `IMPORTANT` discovery offers **2 to 3 contextual choices** (`RESOLVE_DISCOVERY_CHOICE`) that produce immediate, transparent **Lab-local consequences** without touching the main game database:

- **`CAUTIOUS_ADVANCE` (`cautiousStepActive: true`):** Grants heightened readiness for the next movement step (`+1` Lab-local readiness indicator in the HUD).
- **`TRACK_CREATURE` / `ANALYZE_SPORES` (`alertBonusActive: true`, `journalClues +1`):** Logs creature anatomy/habits in the Expedition Journal and highlights the creature's tactical trait in the combat HUD.
- **`SALVAGE_CACHE` (`salvagedTokens +1`):** Recovers a Lab-local field supply token (`+2 HP` field dressing recovery up to `maxHp` inside the Lab state).
- **`BLESS_WAYSTONE` (`wardActive: true`):** Activates a Waystone Ward that softens environmental dread on the next hazardous tile.
- **`WITHDRAW_SAFELY` (`safePassageSteps: 1`):** Marks a safe bypass route for the next step.

All choices and outcomes are permanently recorded in `state.adventure.memory` (`visitedCoords`, `inspectedLandmarks`, `resolvedDiscoveries`, `choicesMade`, `defeatedMonsters`, `activeBuffs`, and `journalEntries`).

---

## 8. Expedition Journal (Phase 4)

Accessible anytime via the top bar (`📖 Journal [L]`) or keyboard shortcut **`L`**:

- **Progress Counters Strip:** Displays live counts for **Tiles Explored**, **Landmarks Inspected**, **Discoveries Resolved**, **Expedition Clues**, **Field Supplies**, and **Monsters Vanquished**.
- **Active Expedition Arc Banner:** Shows the current expedition title, region, summary, and interactive checklist of stages (`✓` completed vs `1, 2, 3...` pending).
- **Chronological Field Entries:** Lists every landmark inspection, discovery choice outcome, and combat victory with tile coordinates `[x,y]` and badges (`LANDMARK`, `CHOICE`, `DISCOVERY`, `VICTORY`, `EXPEDITION`).

---

## 9. Combat UI & Monster Grounding Polish (Phase 5)

Implemented without altering a single combat math formula, dice roll, or monster stat:

1. **Tactical Readout Strip (`.fp-combat-tactical-strip`):**
   - Rendered directly inside the combat HUD card, displaying **Stance (`Aggressive` / `Balanced` / `Defensive`)**, **Active Readiness Buffs** (`Keen Tracking`, `Cautious Step`, `Waystone Ward`), and **Monster Habitat & Tactical Trait** (e.g., *Canopy Ambush — Drops from dense boughs*, *Mire Constriction — Lunges from dark water*).
2. **Clear Round Outcome Banner (`.fp-combat-last-exchange`):**
   - Color-coded visual feedback for **CRITICAL HIT** (gold glow), **HIT** (emerald border), and **MISS / GRAZE** (slate), paired with floating damage numbers and hit-sparks.
3. **Giant Spider Visual Polish (`[7,3]` Ancient Oak & Forest Scenes):**
   - Updated `MONSTER_CUTOUT_PROFILES.giant_spider` in `action-ui-lab/server.js` (`scaleMultiplier: 1.15`, `verticalOffsetPx: 18`, `shadowWidthRatio: 1.08`, and 4 distinct leg-tip contact shadow patches) and `.fp-monster-standee.size-large_arachnid` in `action-ui.css` so the Giant Spider looks imposing and firmly planted on the forest floor.
4. **Post-Victory Exploration Continuity:**
   - Defeating a monster records a `COMBAT_VICTORY` entry in the Expedition Journal, advances any matching Expedition stage, and displays a concise aftermath banner connecting the victory back to the surrounding landmark.

---

## 10. Playable Expedition Arcs (Phase 6)

Implemented in `EXPEDITION_ARCS` in [`action-ui-lab/adventure-engine.js`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/adventure-engine.js):

1. **Expedition I — Into the Mirkwood (`MIRKWOOD_EXPEDITION`):**
   - **Stages:**
     1. *Depart Oakhaven North Gate* (`[7,6]`)
     2. *Read the Crossroads Runestone* (`[7,5]` — Inspect or resolve Crossroads sign)
     3. *Track the Forest Trail Signs* (`[7,4]` — Investigate `forest_web_shroud` / `forest_clawed_bark`)
     4. *Confront the Heart of Mirkwood* (`[7,3]` — Inspect the Ancient Oak or defeat the lurking threat)
     5. *Return Safely to Oakhaven* (`[7,7]`)
2. **Expedition II — The Ruined Watchpost (`BRIDGE_EXPEDITION`):**
   - **Stages:**
     1. *Cross the Old Stone Bridge* (`[8,7]`)
     2. *Survey the Watchpost Ruins* (`[9,7]` — Inspect the Broken Watchtower or examine `ruins_watchpost_horn`)
     3. *Uncover the Garrison's Fate* (Collect a ruin discovery choice or defeat an eastern threat)
     4. *Report Back to Oakhaven* (`[7,7]`)
3. **Expedition III — Into the Rotten Lands (`ROTTEN_LANDS_EXPEDITION`):**
   - **Stages:**
     1. *Pass Beyond the South Gate* (`[7,8]`)
     2. *Navigate the Rotting Fen* (`[7,9]`)
     3. *Reach Deadman's Mire* (`[4,11]` — Inspect Deadman's Mire or resolve `swamp_mire_bones`)
     4. *Return from the Mire* (`[7,7]`)

---

## 11. Developer & Playtest Tools (Phase 7)

Accessible via the top bar (`Experience: Current | Adventure ★` and `🎬 Director [G]`):

- **Instant Mode Comparison Toggle (`Current` vs `Adventure ★`):** Switches `state.adventure.mode` live without losing coordinates or session state so playtesters can compare baseline vs enhanced exploration on any tile.
- **Playtest Director Modal (`🎬 Director [G]`):**
  - Switch between the 3 Expedition Arcs or reset expedition progress.
  - Lock/unlock a **Deterministic RNG Seed** (`1337` default) for repeatable testing.
  - **Force-Spawn Any of the 18 Discoveries** onto the current tile for immediate visual/UI inspection.
  - **One-Click Scene Jumpers:** `Oakhaven [7,7]`, `Crossroads [7,5]`, `Ancient Oak [7,3]`, `Stone Bridge [8,7]`, `Watchpost [9,7]`, `Rotting Fen [7,9]`, and `Deadman's Mire [4,11]`.

---

## 12. Automated Testing Results (Phase 8)

### 12.1 Unit & Integration Suite (`node --test action-ui-lab/tests/action-lab.test.js`)
- **`30 / 30` tests passing (`0` failures):**
  - Covers core Lab state, 5-tier scene resolution, combat actions, directional POI Line-of-Sight (`[7,5]` and `[7,3]` facing rules), `ADVENTURE` vs `CURRENT` mode switching, discovery triggering & choice resolution, anti-oscillation & step-cooldown pacing, deterministic seeding, and Mirkwood Expedition stage progression through completion.

### 12.2 Headless Chrome Visual & Journey Suite (`node action-ui-lab/tests/visual-regression.js`)
- **`65 / 65` checks passing (`0` failures):**
  - **Phase 1 Checks:** Pixel-level non-black image rendering at Bridge East Watchpost `[9,7]` across all 4 facings (`EAST`, `NORTH`, `WEST`, `SOUTH`), single-popup deduplication on `INSPECT_LANDMARK`, directional POI visibility on `[7,5]` and `[7,3]`, and zero horizontal overflow across `1920×1080`, `1440×900`, `1280×800`, and `1280×720`.
  - **Phase 2 Checks:** Real step-by-step walkthroughs of Expeditions A, B, and C.
  - **Phase 3–9 Checks:** Full Mirkwood Expedition loop in `ADVENTURE` mode, Ruined Watchpost & Deadman's Mire discovery verification, Giant Spider combat HUD & cutout grounding at `[7,3]`, Expedition Journal modal, Playtest Director modal, and `1280×720` responsive layout in `ADVENTURE` mode.

---

## 13. Screenshots & Visual Comparison

All verification screenshots are stored inside `action-ui-lab/docs/screenshots/`:

- **Baseline & Journey Walkthrough (`docs/screenshots/expedition/` — 37 screenshots):**
  - [`21_watchpost_9_7_west.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/expedition/21_watchpost_9_7_west.png) & [`23_watchpost_9_7_north.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/expedition/23_watchpost_9_7_north.png): Confirmed crisp, bright rendering of Bridge East Watchpost `[9,7]` facing `WEST` and `NORTH`.
  - [`03_expA_crossroads_7_5_north.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/expedition/03_expA_crossroads_7_5_north.png) vs [`05_expA_crossroads_7_5_east_no_inspect.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/expedition/05_expA_crossroads_7_5_east_no_inspect.png): Demonstrates directional POI Line-of-Sight (`Inspect Runestone` visible facing `NORTH`, hidden facing `EAST`).
- **Adventure Experience Mode (`docs/screenshots/adventure/` — 10 screenshots):**
  - [`01_adventure_oakhaven_start.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/01_adventure_oakhaven_start.png): Single-row Director Bar, Expedition stage pill (`Into the Mirkwood`), and `SAFE HAVEN` tension badge.
  - [`02_adventure_mirkwood_crossroads_discovery_7_5.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/02_adventure_mirkwood_crossroads_discovery_7_5.png): Tier 2 Expandable Discovery Ribbon (`Freshly Clawed Bark`) + `GENUINE SIGN` tension badge at `[7,5]`.
  - [`03_adventure_mirkwood_trail_important_card_7_4.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/03_adventure_mirkwood_trail_important_card_7_4.png): Tier 3 Interactive Discovery Card (`Glistening Canopy Webs`) with 3 contextual player choices at `[7,4]`.
  - [`04_adventure_mirkwood_choice_outcome_7_4.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/04_adventure_mirkwood_choice_outcome_7_4.png): Choice outcome feedback (`+1 Journal Clue`, `Keen Tracking Active`).
  - [`05_adventure_watchpost_ruins_9_7.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/05_adventure_watchpost_ruins_9_7.png): Ruined Watchpost discovery (`Cracked Watchman's Signal Horn`) at `[9,7]`.
  - [`06_adventure_deadmans_mire_4_11.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/06_adventure_deadmans_mire_4_11.png): Deadman's Mire discovery (`Mire-Bleached Ribcage`) at `[4,11]`.
  - [`07_combat_giant_spider_polished_7_3.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/07_combat_giant_spider_polished_7_3.png): Giant Spider cutout grounding + Tactical Combat Strip (`Stance`, `Keen Tracking`, `Canopy Ambush`) at `[7,3]`.
  - [`08_expedition_journal_modal.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/08_expedition_journal_modal.png): Expedition Journal modal (`📖 Journal [L]`) showing stage checklist and recorded entries.
  - [`09_playtest_director_modal.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/09_playtest_director_modal.png): Playtest Director modal (`🎬 Director [G]`).
  - [`10_responsive_adventure_1280x720.png`](file:///c:/Users/hih/Documents/antiDark/action-ui-lab/docs/screenshots/adventure/10_responsive_adventure_1280x720.png): Verified `1280×720` responsive layout in `ADVENTURE` mode.

---

## 14. Performance & Memory Audit

- **Canvas Particle Loop (`Atmospheric Effects Engine`):** Uses a single `requestAnimationFrame` loop (`atmoAnimFrameId`) that automatically pauses when `document.hidden` is true and reuses a fixed-size particle pool (`<= 48` particles) without per-frame object allocations.
- **Image Preloading & Decode:** `preloadedImageUrls` (`Set`) prevents redundant `new Image()` allocations; HTTP `Cache-Control: public, max-age=3600` serves static paintings from browser memory cache.
- **Popup & Event Listener Hygiene:** World popups auto-expire and cap DOM children; discovery choice buttons use clean container replacement (`layerEl.innerHTML`) without accumulating stale window/document listeners.

---

## 15. Known Limitations

1. **In-Memory Lab Session State:** By design (to respect project isolation boundaries), `state.adventure` is held in the Lab server's memory and resets when the Lab server restarts or `RESET_SESSION` is triggered.
2. **Single-Enemy Cutout Framing:** Encounters remain 1v1 in accordance with Darkgrid's core combat engine.
3. **2D Perspective Projection:** Turning `90°` swaps between directional paintings rather than rotating a continuous 3D mesh, which is mitigated by directional POI Line-of-Sight labels and smooth `decode()`-gated crossfades.

---

## 16. What Is Ready for Live Playtesting

Everything in `action-ui-lab/` (`npm run lab` or `node action-ui-lab/server.js` on `http://localhost:3100`) is ready for immediate hands-on playtesting:
- Use **`Experience: Current | Adventure ★`** in the top bar to compare the baseline prototype against the new Adventure Experience at any moment.
- Walk north from Oakhaven (`W` / `↑`) to play **Into the Mirkwood**, east across the Stone Bridge to play **The Ruined Watchpost**, or south into Rotting Fen to play **Into the Rotten Lands**.
- Press **`L`** at any time to inspect your **Expedition Journal**, or **`G`** to open the **Playtest Director**.
