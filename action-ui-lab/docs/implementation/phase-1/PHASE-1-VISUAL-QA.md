# DARKGRID ADVENTURE LAB — PHASE 1 VISUAL QA REPORT
## Headless Chromium Verification Across Routes 1–4 & Combat Continuity

**Browser Engine:** Headless Chromium (`1600×960` desktop viewport via CDP)  
**Console / Runtime Errors:** `0` console errors, `0` uncaught page exceptions  
**Screenshot Directory:** [`action-ui-lab/docs/implementation/phase-1/screenshots/`](screenshots/)

---

## 1. Route 1: Oakhaven to Primeval Black Oak (`[7,7] → [7,6] → [7,5] → [7,4] → [7,3]`, Facing `NORTH`)

### Before vs. After Summary
- **Before Phase 1:** Stepping from `Mirkwood Crossroads [7,5]` north onto `Mirkwood Trail [7,4]` dropped from Tier 1 to generic Tier 4 (`terrain_forest.webp`), even though `forest_7_4_north_oak_approach.jpg` existed on disk. Meanwhile, `continuityNote` and `horizonHint` were never displayed in the player HUD.
- **After Phase 1:** Every step along the northern Mirkwood expedition corridor (`[7,7]` through `[7,3]`) resolves as a dedicated **Tier 1 Exact POV** painting, and both the **Vista Bar** (`.fp-vista-bar`) and **Bottom Chronicle** (`#fp-chronicle-continuity-note`) narrate the continuous journey.

### Step-by-Step Verification Table

| Step | Coordinate & Facing | Tier & Variant Key | Image Asset | Live Chronicle & Vista Continuity Verified in DOM | Screenshot |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `[7,7] NORTH`<br>*(Oakhaven)* | Tier 1<br>`fp_oakhaven_7_7_north` | `oakhaven_7_7_north.jpg` | Sanctuary bar shows `Open (North): Toward Oakhaven North Gate [7,6]` | [`route1_01_oakhaven_7_7_north.png`](screenshots/route1_01_oakhaven_7_7_north.png) |
| **2** | `[7,6] NORTH`<br>*(North Gate)* | Tier 1<br>`fp_north_gate_7_6_north` | `north_gate_7_6_north.jpg` | Chronicle: *"🧭 Leaving the warm hearth-fires of Oakhaven Sanctuary behind, you pass beneath the torchlit timber arch of the North Gate..."* | [`route1_02_north_gate_7_6_north.png`](screenshots/route1_02_north_gate_7_6_north.png) |
| **3** | `[7,5] NORTH`<br>*(Crossroads)* | Tier 1<br>`fp_crossroads_7_5_north` | `crossroads_7_5_north.jpg` | Chronicle: *"🧭 Crossing the treeline threshold from Oakhaven’s gate road, the open sky vanishes beneath the ancient boughs of Mirkwood Crossroads..."* | [`route1_03_crossroads_7_5_north.png`](screenshots/route1_03_crossroads_7_5_north.png) |
| **4** | `[7,4] NORTH`<br>*(Mirkwood Trail)* | **Tier 1**<br>`fp_mirkwood_trail_7_4_north` | `forest_7_4_north_oak_approach.jpg` | Vista Bar: *"👁️ Ahead (Facing North): Looking North along the root-woven Mirkwood trail as the colossal amber-veined root arch of the Primeval Black Oak looms ahead through the mist"*<br>Chronicle: *"🧭 Advancing north from the Crossroads Waystone along the central Mirkwood trail, the canopy thickens and faint veins of warm amber light glimmer through the fog ahead."* | [`route1_04_mirkwood_trail_7_4_north_oak_approach.png`](screenshots/route1_04_mirkwood_trail_7_4_north_oak_approach.png) |
| **5** | `[7,3] NORTH`<br>*(Black Oak)* | Tier 1<br>`fp_ancient_oak_7_3_north` | `forest_ancient_oak.jpg` | Vista Bar & Chronicle confirm arrival directly before the Primeval Black Oak root-arch and amber sap fissures. | [`route1_05_black_oak_7_3_north.png`](screenshots/route1_05_black_oak_7_3_north.png) |

---

## 2. Route 2: Return Journey (`[7,3] → [7,4] → [7,5] → [7,6] → [7,7]`, Facing `SOUTH`)

### Before vs. After Summary
- **Before Phase 1:** At `[7,4] SOUTH`, there was no Tier 1 look-back view toward Mirkwood Crossroads `[7,5]`, and revisiting previously explored tiles along the return leg showed no revisit indicator in the UI.
- **After Phase 1:** Turning `SOUTH` at `[7,3]` shows the view out from beneath the Black Oak (`ancient_oak_7_3_south.jpg`); stepping south to `[7,4] SOUTH` shows the Mirkwood trail looking back toward the Crossroads signpost (`crossroads_7_5_lateral.jpg`, `fp_mirkwood_trail_7_4_south`); and `.fp-vista-bar` displays the `↺ Familiar Ground` revisit pill on revisited tiles (`[7,4]`, `[7,5]`, `[7,6]`, `[7,7]`).

### Step-by-Step Verification Table

| Step | Coordinate & Facing | Tier & Variant Key | Image Asset | Revisit & Return Continuity Verified in DOM | Screenshot |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `[7,3] SOUTH` | Tier 1<br>`fp_ancient_oak_7_3_south` | `ancient_oak_7_3_south.jpg` | Looking south from beneath the Black Oak root arch back down the damp woodland trail toward `[7,4]`. | [`route2_01_black_oak_7_3_south.png`](screenshots/route2_01_black_oak_7_3_south.png) |
| **2** | `[7,4] SOUTH` | **Tier 1**<br>`fp_mirkwood_trail_7_4_south` | `crossroads_7_5_lateral.jpg` | Badge: `↺ Familiar Ground` (`FAMILIAR_SAFE`)<br>Vista Bar: *"Looking South back toward the weathered signpost and boundary stones of Mirkwood Crossroads"* | [`route2_02_mirkwood_trail_7_4_south_to_crossroads.png`](screenshots/route2_02_mirkwood_trail_7_4_south_to_crossroads.png) |
| **3** | `[7,5] SOUTH` | Tier 1<br>`fp_crossroads_7_5_south` | `crossroads_7_5_south.jpg` | Badge: `↺ Familiar Ground`<br>Chronicle: *"🧭 Retracing the central Mirkwood corridor southward, the mossy Runic Waystone of Mirkwood Crossroads comes back into view..."* | [`route2_03_crossroads_7_5_south.png`](screenshots/route2_03_crossroads_7_5_south.png) |
| **4** | `[7,6] SOUTH` | Tier 1<br>`fp_north_gate_7_6_south` | `north_gate_7_6_south.jpg` | Badge: `↺ Familiar Ground`<br>Chronicle: *"🧭 Emerging from beneath the dark Mirkwood canopy, you step back onto the open gatehouse road..."* | [`route2_04_north_gate_7_6_south_to_oakhaven.png`](screenshots/route2_04_north_gate_7_6_south_to_oakhaven.png) |
| **5** | `[7,7] SOUTH` | Tier 1<br>`fp_oakhaven_7_7_south` | `oakhaven_7_7_south.jpg` | Badge: `↺ Familiar Ground`<br>Chronicle: *"🧭 Passing south through the iron-strapped North Gate, the familiar cobblestones and warm watchfires of Oakhaven Sanctuary welcome your return."* | [`route2_05_oakhaven_7_7_return.png`](screenshots/route2_05_oakhaven_7_7_return.png) |

---

## 3. Stage 1 Secrecy & Post-Combat Return Grounding (`[7,5]`)

| Check | Verified Behavior | Screenshot |
| :--- | :--- | :--- |
| **Stage 1 (`DISCOVERED`) Secrecy** | `#fp-inscene-threat` renders the unidentified shadow silhouette and sensory clue without leaking `Goblin` in the viewport or Chronicle. | [`combat_01_stage1_secrecy_preserved.png`](screenshots/combat_01_stage1_secrecy_preserved.png) |
| **Post-Victory Grounding (`combatReturnContext`)** | Victory plate displays `🧭 Ground secured at Mirkwood Forest • Bearings restored (Facing North)` and Chronicle displays `#fp-chronicle-combat-return` without any raw `(CLEARED_SITE)` enum text. | [`combat_02_post_victory_return_grounding.png`](screenshots/combat_02_post_victory_return_grounding.png) |
| **Cleared Site State (`CLEARED_SITE`)** | After dismissing the victory overlay, `.fp-vista-bar` displays `✓ Secured Ground` (`data-revisit-status="CLEARED_SITE"`). | [`combat_03_cleared_site_vista_and_chronicle.png`](screenshots/combat_03_cleared_site_vista_and_chronicle.png) |

---

## 4. Route 3: Turning in Place (`N → E → S → W → N`)

### 4A. Deadman's Mire `[4,11]` (4 Distinct Directional Perspectives)
- **Before Phase 1:** `NORTH`, `EAST`, `SOUTH`, and `WEST` all displayed `deadmans_mire_4_11_ruins.jpg`.
- **After Phase 1:** All 4 cardinal directions display distinct, geographically matched swamp/ruin scenes:
  - `NORTH` (`fp_deadmans_mire_4_11_north`): `deadmans_mire_4_11_ruins.jpg` — Flooded Gothic temple arches directly ahead ([`route3_mire_4_11_north.png`](screenshots/route3_mire_4_11_north.png))
  - `EAST` (`fp_deadmans_mire_4_11_east`): `swamp_willow_boardwalk_pov.jpg` — Half-sunken timber boardwalk leading east into the Rotting Fen ([`route3_mire_4_11_east.png`](screenshots/route3_mire_4_11_east.png))
  - `SOUTH` (`fp_deadmans_mire_4_11_south`): `swamp_approach_mire_ruins.jpg` — Decaying plank causeway and outer ruined arches to the south ([`route3_mire_4_11_south.png`](screenshots/route3_mire_4_11_south.png))
  - `WEST` (`fp_deadmans_mire_4_11_west`): `terrain_swamp.webp` — Stagnant black bog channels and drowned cypress roots to the west ([`route3_mire_4_11_west.png`](screenshots/route3_mire_4_11_west.png))

### 4B. Heart of the Mirkwood `[7,3]` (4 Distinct Directional Perspectives)
- **Before Phase 1:** `EAST` and `WEST` both displayed `forest_7_4_north_oak_approach.jpg` (the `[7,4] NORTH` approach trail).
- **After Phase 1:** All 4 facings at `[7,3]` are distinct:
  - `NORTH`: `forest_ancient_oak.jpg` ([`route3_oak_7_3_north.png`](screenshots/route3_oak_7_3_north.png))
  - `EAST`: `forest_pine_ravine.jpg` ([`route3_oak_7_3_east.png`](screenshots/route3_oak_7_3_east.png))
  - `SOUTH`: `ancient_oak_7_3_south.jpg` ([`route3_oak_7_3_south.png`](screenshots/route3_oak_7_3_south.png))
  - `WEST`: `terrain_forest.webp` ([`route3_oak_7_3_west.png`](screenshots/route3_oak_7_3_west.png))

### 4C. Generic Tier 4 Forest Tile `[8,4]` & Plains Tile `[11,7]`
- **Before Phase 1:** Due to the modulo-3 bug (`(x + 3) * 7 ≡ (x + 0) * 7 mod 3`), `NORTH` and `WEST` always collided on every 3-variant Tier 4 tile, and `forest_tangled_canopy` showed tropical `terrain_jungle.webp`.
- **After Phase 1:**
  - At `[8,4]` (`FOREST`), `NORTH` resolves to `forest_tangled_canopy` (`ancient_oak_7_3_south.jpg` — temperate woodland root-arch trail, [`route3_tier4_forest_8_4_north.png`](screenshots/route3_tier4_forest_8_4_north.png)), `EAST` resolves to `pov_forest_facing_river_bank` (`forest_pine_ravine.jpg`, [`route3_tier4_forest_8_4_east.png`](screenshots/route3_tier4_forest_8_4_east.png)), `SOUTH` resolves to `forest_pine_ravine` (`forest_pine_ravine.jpg`, [`route3_tier4_forest_8_4_south.png`](screenshots/route3_tier4_forest_8_4_south.png)), and `WEST` resolves to `forest_deep_boughs` (`terrain_forest.webp`, [`route3_tier4_forest_8_4_west.png`](screenshots/route3_tier4_forest_8_4_west.png)). `NORTH` and `WEST` are completely distinct and zero tropical jungle art appears anywhere in Mirkwood.
  - On pure 3-variant Tier 4 tiles (no Tier 3 neighbors), `NORTH`, `EAST`, and `SOUTH` show 3 distinct variants and every $90^\circ$ turn changes the image; `EAST` and `WEST` share 1 of the 3 variants because only 3 generic POV images exist per biome (`FOREST`, `HILLS`, `SWAMP`, `JUNGLE`). On 2-variant `PLAINS` (`[11,7]`), adjacent $90^\circ$ turns alternate cleanly between `plains_windswept_trail` (`terrain_plains.webp`) and `plains_windblown_heath_pov` (`plains_windblown_heath_pov.jpg`).

---

## 5. Route 4: Biome Transitions

| Transition | Sample Coordinate & Facing | Rule Key | Image Asset | Visual Continuity Evaluation | Screenshot |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Swamp $\rightarrow$ Plains** | `[5,9] NORTH` $\rightarrow$ `[5,8]` | `pov_transition_swamp_to_plains` | `swamp_willow_boardwalk_pov.jpg` | **Repaired:** Foreground shows sunken swamp boardwalk looking toward brighter open horizon (previously reused inverted `transition_plains_to_swamp_pov.jpg`). | [`route4_01_swamp_to_plains_5_9_north.png`](screenshots/route4_01_swamp_to_plains_5_9_north.png) |
| **Plains $\rightarrow$ Swamp** | `[5,8] SOUTH` $\rightarrow$ `[5,9]` | `pov_transition_plains_to_swamp` | `transition_plains_to_swamp_pov.jpg` | **Verified:** Foreground dry grassland track descending into dark willow bog ahead. | [`route4_02_plains_to_swamp_5_8_south.png`](screenshots/route4_02_plains_to_swamp_5_8_south.png) |
| **Forest $\rightarrow$ Plains** | `[11,1] EAST` $\rightarrow$ `[12,1]` | `pov_transition_forest_to_plains` | `transition_forest_to_plains_pov.jpg` | **Verified:** Foreground dark forest boughs opening onto sunlit grassland ahead. | [`route4_03_forest_to_plains_11_1_east.png`](screenshots/route4_03_forest_to_plains_11_1_east.png) |
| **Plains $\rightarrow$ Forest** | `[12,1] WEST` $\rightarrow$ `[11,1]` | `pov_transition_plains_to_forest` | `transition_plains_to_forest_pov.jpg` | **Verified:** Foreground golden meadow trail approaching dark forest treeline ahead. | [`route4_04_plains_to_forest_12_1_west.png`](screenshots/route4_04_plains_to_forest_12_1_west.png) |
| **Forest $\rightarrow$ Hills** | `[4,1] WEST` $\rightarrow$ `[3,1]` | `pov_transition_forest_to_hills` | `transition_forest_to_hills_pov.jpg` | **Verified:** Foreground forest trees climbing toward rocky highland crags ahead. | [`route4_05_forest_to_hills_4_1_west.png`](screenshots/route4_05_forest_to_hills_4_1_west.png) |
| **Hills $\rightarrow$ Forest** | `[3,1] EAST` $\rightarrow$ `[4,1]` | `pov_transition_hills_to_forest` | `forest_pine_ravine.jpg` | **Repaired:** Foreground rocky slope descending into dark pine ravine ahead (previously reused inverted `transition_forest_to_hills_pov.jpg`). | [`route4_06_hills_to_forest_3_1_east.png`](screenshots/route4_06_hills_to_forest_3_1_east.png) |
| **Plains $\rightarrow$ Hills** | `[5,6] WEST` $\rightarrow$ `[4,6]` | `pov_transition_plains_to_hills` | `hills_highland_ridge_pov.jpg` | **Repaired:** Eye-level grassy highland trail ascending into rocky hills (previously used overview `terrain_hills.webp`). | [`route4_07_plains_to_hills_5_6_west.png`](screenshots/route4_07_plains_to_hills_5_6_west.png) |
| **Hills $\rightarrow$ Plains** | `[4,6] EAST` $\rightarrow$ `[5,6]` | `pov_transition_hills_to_plains` | `terrain_plains.webp` | **Repaired:** Eye-level open grassland expanse ahead (previously used rocky overview `terrain_hills.webp`). | [`route4_08_hills_to_plains_4_6_east.png`](screenshots/route4_08_hills_to_plains_4_6_east.png) |

---

## 6. Remaining Visual Limitations Observed

1. **Shared `ancient_oak_7_3_south.jpg` Between `[7,3] SOUTH` and `forest_tangled_canopy`:**
   - Replacing `terrain_jungle.webp` on `forest_tangled_canopy` with `ancient_oak_7_3_south.jpg` eliminated the jarring tropical jungle mismatch in Mirkwood and provided a genuine temperate oak-root canopy POV, but means `ancient_oak_7_3_south.jpg` is seen both when turning south at `[7,3]` and on `forest_tangled_canopy` Tier 4 forest views.
2. **Tier 4 Cardinal Pool Size (`3` in Forest/Hills/Swamp/Jungle, `2` in Plains):**
   - While every $90^\circ$ turn now changes the image and `NORTH !== WEST` is guaranteed on 3-variant pools, full 4-direction uniqueness on pure Tier 4 tiles requires at least 4 generic POV variants per biome.
