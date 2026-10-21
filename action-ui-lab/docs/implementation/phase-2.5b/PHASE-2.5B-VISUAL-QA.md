# DARKGRID ADVENTURE LAB — PHASE 2.5B VISUAL QA REPORT

**Dagsetning:** 2026-10-21  
**Verkefni:** Phase 2.5b — Visual Regression Investigation, Fixes & Independent Verification  
**Skjáskotamappa:** `action-ui-lab/docs/implementation/phase-2.5b/screenshots/`  
**Mæligögn:** `action-ui-lab/docs/implementation/phase-2.5b/phase-2.5b-metrics.json`

---

## 1. Chromium Screenshot Matrix (`1920×1080`, `1600×960`, `1280×720`)

Öll 30 skjáskot í 10-prófa fylkinu (ásamt 7 tímasetningar- og net-prófunum í `screenshots/timing/`) voru tekin með raunverulegri Chromium keyrslu og sannreynd með 5-svæða pixel-greiningu (`topLeft`, `topCenter`, `topRight`, `center`, `bottomCenter`) á samsettri skjámynd (`Page.captureScreenshot`).

### 1.1 `1920×1080` (Desktop 1080p)

| # | Sena / Prófun | Skrá | Coords & Facing | `#fp-terrain-img` Stærð | `terrainOpacity` / `prevOpacity` | `topLeft` Luma | `topCenter` Luma | `topRight` Luma | `center` Luma | Staða |
| :-: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | Oakhaven `[7,7] NORTH` | `01_oakhaven_7_7_N_1920x1080.png` | `[7,7] NORTH` | `1219×992` | `1` / `0` | `50.92` | `73.32` | `57.11` | `89.31` | **PASS** |
| 2 | Mirkwood `[7,5] NORTH` | `02_mirkwood_7_5_N_1920x1080.png` | `[7,5] NORTH` | `1219×992` | `1` / `0` | `27.10` | `53.35` | `34.69` | `53.08` | **PASS** |
| 3 | Mirkwood `[7,5] EAST` | `03_mirkwood_7_5_E_1920x1080.png` | `[7,5] EAST` | `1219×992` | `1` / `0` | `57.11` | `146.79` | `63.48` | `127.66` | **PASS** |
| 4 | Mirkwood `[7,5] SOUTH` | `04_mirkwood_7_5_S_1920x1080.png` | `[7,5] SOUTH` | `1219×992` | `1` / `0` | `28.65` | `64.42` | `45.53` | `80.61` | **PASS** |
| 5 | Mirkwood `[7,5] WEST` | `05_mirkwood_7_5_W_1920x1080.png` | `[7,5] WEST` | `1219×992` | `1` / `0` | `46.04` | `42.47` | `31.74` | `52.77` | **PASS** |
| 6 | Blackwater River `[8,4] EAST` | `06_blackwater_river_8_4_E_1920x1080.png` | `[8,4] EAST` | `1219×992` | `1` / `0` | `52.10` | `56.83` | `28.88` | `78.57` | **PASS** |
| 7 | Character Modal | `07_character_modal_1920x1080.png` | `[7,7] NORTH` | `1219×992` | `1` / `0` | `17.28` | `22.25` | `18.39` | `31.69` | **PASS** |
| 8 | Stage 1 Encounter | `08_stage1_encounter_1920x1080.png` | `[7,5] NORTH` | `1219×992` | `1` / `0` | `27.80` | `54.92` | `35.42` | `56.71` | **PASS** |
| 9 | Stage 2 Combat | `09_stage2_combat_1920x1080.png` | `[7,5] NORTH` | `1219×992` | `1` / `0` | `27.32` | `53.83` | `34.91` | `48.62` | **PASS** |
| 10 | Rapid Movement / Crossfade Stress | `10_rapid_movement_crossfade_stress_1920x1080.png` | `[7,5] NORTH` | `1219×992` | `1` / `0` | `27.14` | `53.82` | `34.73` | `54.23` | **PASS** |

### 1.2 `1600×960` (Desktop / Laptop 960p)

| # | Sena / Prófun | Skrá | Coords & Facing | `#fp-terrain-img` Stærð | `terrainOpacity` / `prevOpacity` | `topLeft` Luma | `topCenter` Luma | `topRight` Luma | `center` Luma | Staða |
| :-: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | Oakhaven `[7,7] NORTH` | `01_oakhaven_7_7_N_1600x960.png` | `[7,7] NORTH` | `1219×872` | `1` / `0` | `51.83` | `72.92` | `56.60` | `88.78` | **PASS** |
| 2 | Mirkwood `[7,5] NORTH` | `02_mirkwood_7_5_N_1600x960.png` | `[7,5] NORTH` | `1219×872` | `1` / `0` | `26.90` | `54.26` | `35.29` | `52.97` | **PASS** |
| 3 | Mirkwood `[7,5] EAST` | `03_mirkwood_7_5_E_1600x960.png` | `[7,5] EAST` | `1219×872` | `1` / `0` | `57.27` | `143.79` | `64.08` | `127.08` | **PASS** |
| 4 | Mirkwood `[7,5] SOUTH` | `04_mirkwood_7_5_S_1600x960.png` | `[7,5] SOUTH` | `1219×872` | `1` / `0` | `28.59` | `64.21` | `46.51` | `80.17` | **PASS** |
| 5 | Mirkwood `[7,5] WEST` | `05_mirkwood_7_5_W_1600x960.png` | `[7,5] WEST` | `1219×872` | `1` / `0` | `45.36` | `43.09` | `32.57` | `52.67` | **PASS** |
| 6 | Blackwater River `[8,4] EAST` | `06_blackwater_river_8_4_E_1600x960.png` | `[8,4] EAST` | `1219×872` | `1` / `0` | `54.21` | `56.30` | `29.40` | `78.58` | **PASS** |
| 7 | Character Modal | `07_character_modal_1600x960.png` | `[7,7] NORTH` | `1219×872` | `1` / `0` | `17.56` | `23.48` | `18.30` | `32.65` | **PASS** |
| 8 | Stage 1 Encounter | `08_stage1_encounter_1600x960.png` | `[7,5] NORTH` | `1219×872` | `1` / `0` | `27.51` | `55.49` | `35.91` | `56.69` | **PASS** |
| 9 | Stage 2 Combat | `09_stage2_combat_1600x960.png` | `[7,5] NORTH` | `1219×872` | `1` / `0` | `27.07` | `54.34` | `35.42` | `47.37` | **PASS** |
| 10 | Rapid Movement / Crossfade Stress | `10_rapid_movement_crossfade_stress_1600x960.png` | `[7,5] NORTH` | `1219×872` | `1` / `0` | `26.93` | `54.67` | `35.33` | `53.97` | **PASS** |

### 1.3 `1280×720` (HD 720p)

| # | Sena / Prófun | Skrá | Coords & Facing | `#fp-terrain-img` Stærð | `terrainOpacity` / `prevOpacity` | `topLeft` Luma | `topCenter` Luma | `topRight` Luma | `center` Luma | Staða |
| :-: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | Oakhaven `[7,7] NORTH` | `01_oakhaven_7_7_N_1280x720.png` | `[7,7] NORTH` | `1003×637` | `1` / `0` | `48.24` | `67.13` | `51.16` | `88.24` | **PASS** |
| 2 | Mirkwood `[7,5] NORTH` | `02_mirkwood_7_5_N_1280x720.png` | `[7,5] NORTH` | `1003×637` | `1` / `0` | `27.01` | `53.21` | `33.18` | `51.72` | **PASS** |
| 3 | Mirkwood `[7,5] EAST` | `03_mirkwood_7_5_E_1280x720.png` | `[7,5] EAST` | `1003×637` | `1` / `0` | `52.54` | `131.94` | `59.46` | `126.78` | **PASS** |
| 4 | Mirkwood `[7,5] SOUTH` | `04_mirkwood_7_5_S_1280x720.png` | `[7,5] SOUTH` | `1003×637` | `1` / `0` | `29.15` | `60.04` | `41.58` | `79.68` | **PASS** |
| 5 | Mirkwood `[7,5] WEST` | `05_mirkwood_7_5_W_1280x720.png` | `[7,5] WEST` | `1003×637` | `1` / `0` | `42.27` | `39.92` | `29.40` | `52.66` | **PASS** |
| 6 | Blackwater River `[8,4] EAST` | `06_blackwater_river_8_4_E_1280x720.png` | `[8,4] EAST` | `1003×637` | `1` / `0` | `48.88` | `50.28` | `27.49` | `78.79` | **PASS** |
| 7 | Character Modal | `07_character_modal_1280x720.png` | `[7,7] NORTH` | `1003×637` | `1` / `0` | `18.39` | `28.46` | `18.88` | `33.24` | **PASS** |
| 8 | Stage 1 Encounter | `08_stage1_encounter_1280x720.png` | `[7,5] NORTH` | `1003×637` | `1` / `0` | `28.25` | `55.81` | `34.48` | `57.53` | **PASS** |
| 9 | Stage 2 Combat | `09_stage2_combat_1280x720.png` | `[7,5] NORTH` | `1003×637` | `1` / `0` | `27.71` | `55.31` | `33.89` | `46.50` | **PASS** |
| 10 | Rapid Movement / Crossfade Stress | `10_rapid_movement_crossfade_stress_1280x720.png` | `[7,5] NORTH` | `1003×637` | `1` / `0` | `27.06` | `53.14` | `33.22` | `52.71` | **PASS** |

---

## 2. Fyrir / Eftir Samanburður á Staðfestum Atriðum

### 2.1 Mirkwood `[7,5] NORTH` og Stage 1 Encounter (`1920×1080`)
- **Fyrir lagfæringu (`after/02_world_crossroads_7_5_N_1920x1080.png` & `baseline/05_stage1_encounter_7_5_N_1920x1080.png`)**:
  - `topLeft` (`256×256` tile): `avgLuma = 27.15`, `nonBlackRatio = 0.975`
  - `topCenter`: **`avgLuma = 6.75`, `nonBlackRatio = 0.000`** (svartur óteiknaður flötur)
  - `topRight`: **`avgLuma = 6.06`, `nonBlackRatio = 0.000`** (svartur óteiknaður flötur)
  - `center`: **`avgLuma = 4.55`, `nonBlackRatio = 0.000`** (svartur óteiknaður flötur)
- **Eftir lagfæringu (`02_mirkwood_7_5_N_1920x1080.png` & `08_stage1_encounter_1920x1080.png`)**:
  - `topLeft`: `avgLuma = 27.10` (`27.80` í Stage 1), `nonBlackRatio = 0.975` (`0.985` í Stage 1)
  - `topCenter`: **`avgLuma = 53.35` (`54.92` í Stage 1), `nonBlackRatio = 0.996` (`0.999` í Stage 1)**
  - `topRight`: **`avgLuma = 34.69` (`35.42` í Stage 1), `nonBlackRatio = 1.000`**
  - `center`: **`avgLuma = 53.08` (`56.71` í Stage 1), `nonBlackRatio = 1.000`**

### 2.2 Mirkwood `[7,5] EAST` Snúningur (`03_mirkwood_7_5_E`)
- **Fyrir lagfæringu (`03_turn_crossroads_7_5_E_1920x1080.png`)**:
  - Vegna `dispatchTurn({ direction: 'RIGHT' })` í QA-forskrift sneri hetjan ekki heldur varð áfram í `NORTH` (`crossroads_7_5_north.jpg`).
- **Eftir lagfæringu (`03_mirkwood_7_5_E_1920x1080.png`)**:
  - Hetjan snýr í `EAST` (`🧭 E ▶`, `crossroads_7_5_east.jpg`, `topCenterLuma = 146.79`), og öll 4 höfuðáttaskjáskotin á `[7,5]` (`NORTH`, `EAST`, `SOUTH`, `WEST`) birta nú sína réttu áttarmynd í fullri upplausn.

### 2.3 Tímasetningar-, Cache- og Throttling-Prófanir (`screenshots/timing/`)

| Prófun | Skrá | `topLeft` Luma | `topCenter` Luma | `topRight` Luma | `center` Luma | `allZonesValid` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Strax eftir state update (`0ms`)** | `timing/probe_01_immediate_0ms_7_5_N.png` | `27.81` | `58.73` | `34.80` | `56.26` | **`true`** |
| **Í miðju crossfade (`~80ms`)** | `timing/probe_02_mid_crossfade_80ms_7_5_N.png` | `27.17` | `53.85` | `34.75` | `54.49` | **`true`** |
| **Eftir transition (`~280ms`)** | `timing/probe_03_post_transition_280ms_7_5_N.png` | `27.17` | `53.88` | `34.75` | `54.76` | **`true`** |
| **Eftir `__waitForSceneReady()`** | `timing/probe_04_deterministic_ready_7_5_N.png` | `27.17` | `53.88` | `34.75` | `54.75` | **`true`** |
| **Kalt cache (`cacheDisabled: true`)** | `timing/probe_05_cold_cache_7_5_N.png` | `27.13` | `53.51` | `34.73` | `53.32` | **`true`** |
| **Hlýtt cache (`cacheDisabled: false`)** | `timing/probe_06_warm_cache_7_5_N.png` | `27.14` | `53.49` | `34.73` | `53.35` | **`true`** |
| **Hægari hleðsla (`1.5MB/s`, `45ms` RTT)** | `timing/probe_07_throttled_network_7_5_W.png` | `46.04` | `42.48` | `31.74` | `52.82` | **`true`** |

---

## 3. Samantekt á Viðmótsþáttum

1. **Mirkwood Rendering Niðurstaða:** **PASS** — Enginn svartur viewport, engir `256×256` hluta-reitir, engin röng yfirlagning milli `#fp-terrain-img` og `#fp-terrain-img-prev`, hvorki við venjulega göngu, hraðar snúninga né undir net-throttling.
2. **Character Modal Niðurstaða:** **PASS** — `0` pixla frávik (`0.000%` diff) milli Phase 2.5 baseline og Phase 2.5b á öllum þremur upplausnum (`1920×1080`, `1600×960`, `1280×720`).
3. **Scene Scaling & Cropping Niðurstaða:** **PASS** — `object-fit: cover` og `105% × 105%` stærðarhlutföll fylla `#fp-scene-backdrop` 100% á öllum skjástærðum án óvænts crops eða svartra banda.
4. **Stage 1 & Stage 2 Niðurstaða:** **PASS** — Öll encounter og combat overlays birtast stöðugt á réttum stað án flökts eða úreltra animation-stana.
