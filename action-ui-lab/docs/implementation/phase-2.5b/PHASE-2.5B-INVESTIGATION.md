# DARKGRID ADVENTURE LAB — PHASE 2.5B INVESTIGATION REPORT

**Dagsetning:** 2026-10-21  
**Verkefni:** Phase 2.5b — Visual Regression Investigation, Fixes & Independent Verification  
**Umfang:** `action-ui-lab/` (eingöngu einangraða tilraunaverkefnið; engar breytingar á `main`, `src/` eða `db/`)

---

## 1. Yfirlit rannsóknar

Í sjónrænni yfirferð á Chromium-skjáskotum úr Phase 2.5 komu fram fjögur rannsóknarefni:
1. **CRITICAL — Mirkwood Black / Partial Render (`[7,5] NORTH`)**: Í `after/02_world_crossroads_7_5_N_1920x1080.png` var nánast allur first-person viewport svartur og aðeins lítill ferhyrndur hluti skógarmyndarinnar birtist efst vinstra megin, á meðan HUD, minimap og aðrir UI-hlutar birtust eðlilega.
2. **Character Modal — Position & Alignment**: Sýnilegur munur á hlutfallslegri stærð og bili utan um Champion Record gluggann milli skjáskota.
3. **Scene Scaling & Cropping (`1920×1080`, `1600×960`, `1280×720`)**: Staðfesta hvort `object-fit: cover`, stærðarhlutföll og crop á Oakhaven `[7,7] NORTH`, Mirkwood `[7,5] NORTH` og Blackwater River `[8,4] EAST` væru óbreytt á sömu skjástærð.
4. **Stage 1 & Stage 2 Encounter Overlays + CSS Cascade & ES Modules**: Staðfesta hvort skipting `lab.css` í 8 CSS skrár og `lab.js` í 20 ES6 einingar hafi valdið ósýnilegum cascade-, timing- eða overlay-villum.

---

## 2. Niðurstöður eftir rannsóknarþáttum

### 2.1 CRITICAL: Mirkwood Black / Partial Render (`[7,5] NORTH`)

- **Staða:** **STAÐFEST (Samspil tveggja þátta: leikjakóði í `world.css` / `scene-renderer.js` OG QA screenshot timing í `phase25-visual-verify.js`)**
- **Var þetta regression af völdum Phase 2.5 ES-module refactoring?**  
  **Nei.** Nákvæmlega sama villa fannst einnig í **Phase 2.5 baseline skjáskotinu** `baseline/05_stage1_encounter_7_5_N_1920x1080.png` (sem var tekið *fyrir* Phase 2.5 refactoring á gamla monolithic `lab.js` / `lab.css`).
- **Mælingar og sönnun á orsök:**
  - Í eðlilegu hvíldarástandi (`1920×1080`) hefur `#fp-scene-backdrop` stærðina `1161×945` í `(x: 196, y: 125)` og `#fp-terrain-img` (`width: 105%, height: 105%, left: -2.5%, top: -2.5%`) hefur bounding box `{ x: 167, y: 102, width: 1219, height: 992 }`.
  - Í bæði `after/02_world_crossroads_7_5_N_1920x1080.png` og `baseline/05_stage1_encounter_7_5_N_1920x1080.png` sýndu skráðar DOM-mælingar (`after-metrics.json` og `baseline-metrics.json`) að `#fp-terrain-img` var með bounding box `{ x: 166, y: 101, width: 1221, height: 994 }` — þ.e. skjáskotið var tekið í miðju `@keyframes fpMoveForward` (`220ms` `transform: scale(1.018)` á `#fp-scene-backdrop`).
  - Pixel-greining á `after/02_world_crossroads_7_5_N_1920x1080.png` leiddi í ljós að skógarmyndin var **ekki** smækkuð niður í litla mynd, heldur var birtustig í fullri stærð eingöngu teiknað innan fyrsta **`256×256` compositor-reitsins (tile)** efst vinstra megin í `#fp-scene-backdrop` (`x: 196..450, y: 125..345`, breidd `255px`, hæð `221px`):

| Svæði í `#fp-scene-backdrop` (`1920×1080`) | `baseline/02_world_crossroads_7_5_N` (Eðlilegt) | `after/02_world_crossroads_7_5_N` (Bilað skjáskot) | `baseline/05_stage1_encounter_7_5_N` (Bilað í baseline) | Eftir Phase 2.5b lagfæringu (`02_mirkwood_7_5_N`) |
| :--- | :---: | :---: | :---: | :---: |
| **Top-Left (`256×256` tile)** | `avgLuma: 27.10` (`nonBlack: 97.5%`) | `avgLuma: 27.15` (`nonBlack: 97.5%`) | `avgLuma: 27.15` (`nonBlack: 97.5%`) | `avgLuma: 27.10` (`nonBlack: 97.5%`) |
| **Top-Center** | `avgLuma: 53.35` (`nonBlack: 99.6%`) | **`avgLuma: 6.75` (`nonBlack: 0.0%`)** | **`avgLuma: 6.75` (`nonBlack: 0.0%`)** | **`avgLuma: 53.35` (`nonBlack: 99.6%`)** |
| **Top-Right** | `avgLuma: 34.69` (`nonBlack: 100%`) | **`avgLuma: 6.06` (`nonBlack: 0.0%`)** | **`avgLuma: 6.06` (`nonBlack: 0.0%`)** | **`avgLuma: 34.69` (`nonBlack: 100%`)** |
| **Center** | `avgLuma: 53.08` (`nonBlack: 100%`) | **`avgLuma: 4.55` (`nonBlack: 0.0%`)** | **`avgLuma: 15.86` (aðeins Stage 1 texti)** | **`avgLuma: 53.08` (`nonBlack: 100%`)** |

- **Hvað olli þessu nákvæmlega?**
  1. **Leikjakóði — Samtímis CSS `filter` animation á barni og `transform: scale()` á foreldri (`public/css/world.css`)**:
     - `.fp-terrain-img` var með `transition: transform 0.28s ..., filter 0.32s ease, object-position 0.28s ease;` og `@keyframes fpSceneCrossfadeIn` animeraði `filter: brightness(...) contrast(...) saturate(...)` á hverjum ramma (`0% -> 100%`) á sama tíma og foreldrið `#fp-scene-backdrop` keyrði `@keyframes fpMoveForward` (`transform: scale(1.018) translateY(3px)`).
     - Í Chromium `--disable-gpu` software rasterizer veldur breytilegt CSS `filter` á `1221×994` barn-lagi inni í foreldri sem er í `transform: scale()` því að offscreen filter-yfirborðið er ógilt (invalidated) á hverjum ramma og skipt í `256×256` software tiles. Ef skjáskot er tekið á miðjum ramma áður en allir `256×256` reitir hafa verið endurteiknaðir, skilar fyrsti `256×256` reiturinn myndinni en hinir reitirnir skila svörtum `#05070a` bakgrunni `.fp-viewport-frame`.
  2. **Leikjakóði — A/B buffer race condition í `applySceneImageWithCrossfade` og `__waitForSceneReady` (`public/js/world/scene-renderer.js`)**:
     - `terrainImg.setAttribute('src', targetUrl)` var sett beint á lifandi DOM-elementið áður en nýja myndin hafði verið forhlaðin og afkóðuð (`decode()`) í minni.
     - Ef `renderViewportScene` var kallað aftur með sama `targetUrl` á meðan crossfade stóð enn yfir (eins og gerðist í `05_stage1_encounter` þegar `triggerTeleport(7, 5, 'NORTH')` var fylgt beint eftir með `triggerLabScenario('STAGE1_MYSTERY')`), fór seinna kallið í `else` greinina (`currentSrc === targetUrl`) og framkvæmdi samstundis `prevImg.style.opacity = '0'` á meðan `terrainImg` var enn í `.is-crossfading` eða decoding!
     - `setTimeout(() => finalizeSwap(), 165)` var ekki vistað í `store.crossfadeCleanupTimer` né hreinsað við nýja senuuppfærslu.
     - `window.__waitForSceneReady()` slökkti handvirkt á `prevImg.style.opacity = '0'` og fjarlægði `.is-crossfading` strax og `decode()` lauk, án þess að bíða eftir að crossfade- og hreyfi-animations (`fpMoveForward` `220ms`, `fpLandmarkArrivalGlow` `420ms`) kláruðust.
  3. **QA Tooling & Client Dispatcher (`phase25-visual-verify.js` & `public/js/api/client.js` & `tests/visual-regression.js`)**:
     - Í `tests/visual-regression.js` notaði `teleportAndVerifyScene` `ctx.drawImage(img, 0, 0, 32, 32)` á `HTMLImageElement`. Það les afkóðaða bitmap-myndina í minni en **ekki** samsetta (composited) skjámynd úr vafranum, og gat því hvorki gripið `opacity: 0` né óteiknaða `256×256` compositor-reiti.
     - Í `phase25-visual-verify.js` var kallað á `dispatchTurn({ direction: 'RIGHT' })` í stað `dispatchTurn('RIGHT')`. Þar sem `dispatchTurn(turn)` sendi `{ turn }` óbreytt á serverinn varð `payload.turn` að hlutnum `{ direction: 'RIGHT' }`, sem serverinn túlkaði sem `"[OBJECT OBJECT]"` og sneri því ekki hetjunni í `03_turn_crossroads_7_5_E` (myndin sýndi enn `NORTH`).

---

### 2.2 Character Modal — Position & Alignment

- **Staða:** **EKKI REGRESSION (0 pixla munur á sömu skjástærð)**
- **Rannsókn og mælingar:**
  - Við bárum saman `baseline/07_modal_character_*.png` og `after/07_modal_character_*.png` pixel-fyrir-pixel á öllum þremur skjástærðum (`1920×1080`, `1600×960`, `1280×720`) og mældum DOM bounding boxes á `.lab-modal-backdrop`, `.lab-modal-card`, `.lab-modal-header`, `.lab-modal-title`, `.lab-modal-body` og `button[aria-label="Close modal"]`:

| Skjástærð | `.lab-modal-card` Bounding Box | Lárétt miðjun (`offsetPx`) | Lóðrétt miðjun (`offsetPx`) | Header Padding | Body Padding | Pixel Diff (`baseline` vs `after`) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`1920×1080`** | `{ x: 620, y: 394, width: 680, height: 292 }` | `0px` (`620px` vinstra / `620px` hægra) | `0px` (`394px` efst / `394px` neðst) | `12px 18px` | `18px` | **`0` pixlar (`0.000%`)** |
| **`1600×960`** | `{ x: 460, y: 334, width: 680, height: 292 }` | `0px` (`460px` vinstra / `460px` hægra) | `0px` (`334px` efst / `334px` neðst) | `12px 18px` | `18px` | **`0` pixlar (`0.000%`)** |
| **`1280×720`** | `{ x: 300, y: 214, width: 680, height: 292 }` | `0px` (`300px` vinstra / `300px` hægra) | `0px` (`214px` efst / `214px` neðst) | `12px 18px` | `18px` | **`0` pixlar (`0.000%`)** |

- **Niðurstaða:** Glugginn hefur fasta hámarksbreidd (`max-width: 680px`) og hæð (`292px`) og er fullkomlega miðjaður með Flexbox (`align-items: center; justify-content: center;`) á öllum skjástærðum. Sýnilegur munur milli skjáskota stafaði eingöngu af því að `680×292` spjaldið tekur `35.4%` af breidd `1920×1080` skjás en `53.1%` af breidd `1280×720` skjás. Engu var breytt í modal CSS.

---

### 2.3 Scene Scaling & Cropping (`1920×1080`, `1600×960`, `1280×720`)

- **Staða:** **STAÐFEST EÐLILEGT (`0` crop-breyting á sömu skjástærð)**
- **Mælingar á Oakhaven `[7,7] NORTH`, Mirkwood `[7,5] NORTH` og Blackwater River `[8,4] EAST`:**

| Skjástærð | `#fp-scene-backdrop` | `#fp-terrain-img` (`105% × 105%`) | `object-fit` | `coversViewportCompletely` | Whitespace / Svartir rammar |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **`1920×1080`** | `{ x: 196, y: 125, w: 1161, h: 945 }` | `{ x: 167, y: 102, w: 1219, h: 992 }` | `cover` | `true` | Engir (`0px`) |
| **`1600×960`** | `{ x: 36, y: 121, w: 1161, h: 831 }` | `{ x: 7, y: 100, w: 1219, h: 872 }` | `cover` | `true` | Engir (`0px`) |
| **`1280×720`** | `{ x: 10, y: 107, w: 955, h: 607 }` | `{ x: -14, y: 92, w: 1003, h: 637 }` | `cover` | `true` | Engir (`0px`) |

- **Niðurstaða:** `object-fit: cover` og `object-position` (`50% 44%` á Oakhaven, `52% 48%` á Mirkwood `[7,5] N`, `50% 48%` á Blackwater River `[8,4] E`) eru nákvæmlega eins og í Phase 2 / Phase 2.5 baseline á hverri skjástærð.

---

### 2.4 Stage 1 & Stage 2 Overlays, CSS Cascade & ES Modules

- **Stage 1 (`DISCOVERED`)**:
  - `👁️ PRESENCE SENSED` (eða `⚠️ AMBUSH!`), `👁️ Unidentified Presence Ahead`, `svg.fp-shadow-silhouette-svg`, `Engage Threat [Space]`, `Slip Past [4 / F]` og Tactical Action Deck (`ENGAGE THREAT`, `SLIP PAST`) birtast á nákvæmlega sama stað (`#fp-inscene-threat`: `540×283` í `(507, 698)` á `1920×1080`, `540×262` í `(347, 599)` á `1600×960`, `540×205` í `(218, 451)` á `1280×720`).
- **Stage 2 (`IN_COMBAT`)**:
  - Monster cutout (`Manticore` `390×390` í `(582, 419)` á `1920×1080`), `.fp-monster-ground-shadow` / `.fp-rig-contact-patch`, `.fp-monster-hud-plate` (`520×115`), `⚔️ BATTLE JOINED!`, Combat Actions (`LONGSWORD`, `DRINK POTION`, `SWAP STANCE` læst, `FLEE BATTLE`), Chronicle og `🔒 Engaged in Melee — Use Flee [4 / F] to retreat` birtast rétt og án nokkurra tvöfaldra event listeners.
  - Eini munurinn (4–9px á Y-ás) í fyrri Phase 2.5 skjáskotum stafaði af því að skjáskotið var tekið á meðan `fpMonsterEntry` (`380ms`) innkomuhreyfingunni var ekki lokið. Eftir að `__waitForSceneReady()` bíður eftir `getAnimations()` er staðsetningin 100% stöðug.
- **CSS Cascade & ES Modules**:
  - Öll 8 CSS-blöðin í `index.html` (`base.css` -> `layout.css` -> `character.css` -> `world.css` -> `combat.css` -> `inventory.css` -> `components.css` -> `responsive.css`) hlaðast í réttri röð með `31` `:root` breytum og `27` `@keyframes`.
  - Allar `20/20` ES6 einingar í `public/js/` standast `node --check`, allar `44` innflutningstengingar (`import`/`export`) eru gildar og hringrásargreining (DFS cycle check) staðfestir **`0` circular dependencies**.
