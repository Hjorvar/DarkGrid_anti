# DARKGRID ADVENTURE LAB — PHASE 2.5B FIX REPORT

**Dagsetning:** 2026-10-21  
**Verkefni:** Phase 2.5b — Visual Regression Investigation, Fixes & Independent Verification  
**Umfang:** Eingöngu afmarkaðar, hnitmiðaðar lagfæringar innan `action-ui-lab/`

---

## 1. Yfirlit breytinga

Allar breytingar voru framkvæmdar eingöngu innan `action-ui-lab/` og snertu **6 skrár** (5 framenda-/stílskrár og 1 QA-prófunarskrá). Eng engin breyting var gerð á `main`, `src/`, `db/`, leikreglum, bardagakerfi, skrímslastærðum, myndum eða `scene-catalog.js`.

| Skrá | Tegund breytingar | Tilgangur |
| :--- | :--- | :--- |
| `action-ui-lab/public/css/world.css` | CSS lagfæring | Fjarlægja `filter` úr per-frame crossfade keyframes og CSS transition á `.fp-terrain-img` til að koma í veg fyrir `256×256` software-tile invalidation í Chromium þegar `#fp-scene-backdrop` animerar `transform: scale()`. |
| `action-ui-lab/public/js/state/store.js` | State viðbót | Bæta við `isSceneCrossfading`, `activeSceneTargetUrl`, `pendingSceneStyles`, `backdropMotionTimer` og `activeActionPromise` í `store`. |
| `action-ui-lab/public/js/world/scene-renderer.js` | Rendering & Readiness lagfæring | Offscreen pre-decode í `applySceneImageWithCrossfade`, vörn gegn re-entrant köllum með sama `targetUrl`, geymsla/hreinsun á `crossfadeCleanupTimer`, og deterministic `window.__waitForSceneReady()` sem bíður eftir `activeActionPromise`, `decode()`, crossfade og finite CSS animations (`getAnimations()`). |
| `action-ui-lab/public/js/combat/fx.js` | DOM hreyfingarhreinsun | Hreinsa tímabundin hreyfiklasa (`anim-step-forward`, `anim-landmark-arrival`, o.fl.) af `#fp-scene-backdrop` þegar animation lýkur (`240ms` / `440ms`). |
| `action-ui-lab/public/js/api/client.js` | API / Dispatcher vörn | Vista `store.activeActionPromise` í `dispatchAction`, og styðja bæði strengi (`'RIGHT'`) og hluti (`{ direction: 'RIGHT' }`) í `dispatchTurn` og `triggerLabScenario`. |
| `action-ui-lab/tests/visual-regression.js` | QA prófunarbæting | Bæta við 5-svæða (Top-Left, Top-Center, Top-Right, Center, Bottom-Center) skjáskots-pixel-greiningu, A/B layer opacity prófun, Rapid Movement / Crossfade stress-prófi, `prefers-reduced-motion` prófi og eftirliti með console/network villum. |

---

## 2. Sundurliðun breytinga og rökstuðningur

### 2.1 `action-ui-lab/public/css/world.css`
- **Hvað breyttist:**
  1. Í `.fp-terrain-img, .fp-terrain-img-prev` var `filter 0.32s ease` fjarlægt úr `transition` eiginleikanum (nú `transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), object-position 0.28s ease;`). Kyrrstæða `filter: brightness(0.92) contrast(1.04) saturate(0.98)` gildið á myndinni sjálfri helst óbreytt.
  2. Í `@keyframes fpSceneCrossfadeIn` var per-frame `filter` animation fjarlægð þannig að keyframe-hreyfingin animerar eingöngu `opacity` (`0%   { opacity: 0; }` -> `100% { opacity: 1; }`).
- **Af hverju nauðsynlegt:**
  - Þegar `fpSceneCrossfadeIn` animeraði `filter` á hverjum ramma á `1221×994` barn-mynd á sama tíma og `#fp-scene-backdrop` keyrði `fpMoveForward` (`transform: scale(1.018)`), ógilti Chromium `--disable-gpu` software rasterizer offscreen filter-flötinn á hverjum ramma og teiknaði aðeins fyrsta `256×256` compositor-reitinn efst vinstra megin. Með hreinni `opacity` crossfade helst mynd-áferðin í einu samfelldu lagi án nokkurs tile-brots.

### 2.2 `action-ui-lab/public/js/state/store.js`
- **Hvað breyttist:**
  - Bætt við stöðubreytum í `store`: `isSceneCrossfading: false`, `activeSceneTargetUrl: null`, `pendingSceneStyles: null`, `backdropMotionTimer: null`, `activeActionPromise: null`.
- **Af hverju nauðsynlegt:**
  - Tryggir að senu-endurteikning og QA-readiness geti fylgst nákvæmlega með virkum HTTP-aðgerðum, virkum crossfade-skiptum og tímabundnum backdrop-hreyfingum án global nafnaárekstra.

### 2.3 `action-ui-lab/public/js/world/scene-renderer.js`
- **Hvað breyttist:**
  1. **Re-entrant vörn:** Ef `applySceneImageWithCrossfade` er kallað aftur með sama `targetUrl` á meðan `store.isSceneCrossfading` er virkt (t.d. þegar Stage 1 encounter eða HUD uppfærsla keyrir strax á eftir skrefi/teleport á sama reit), uppfærir fallið stílbreytur (`objectPosition`, `transform`, `filter`) án þess að slökkva á `prevImg.style.opacity = '0'` áður en `terrainImg` hefur lokið crossfade.
  2. **Offscreen Preload & Decode:** Áður en `terrainImg.setAttribute('src', targetUrl)` er kallað á lifandi DOM-elementið er nýja myndin hlaðin og afkóðuð (`loader.decode()`) í offscreen `new Image()`, á meðan `prevImg` heldur fyrri mynd sýnilegri (`opacity: 1`).
  3. **Stýrður `store.crossfadeCleanupTimer`:** Hver ný senu-uppfærsla hreinsar eldri `store.crossfadeCleanupTimer` svo eldra `165ms` timeout geti aldrei slökkt á `prevImg` í miðri nýrri hraðri hreyfingu (`W/A/S/D/Q/E`).
  4. **Deterministic `window.__waitForSceneReady()`:** Bíður í réttri röð eftir `store.activeActionPromise`, `window.__sceneImageDecodePromise`, `window.__sceneTransitionPromise`, `terrainImg.decode()` og öllum endanlegum (non-infinite) CSS animations (`el.getAnimations()`) á `#fp-scene-backdrop`, `#fp-terrain-img`, `#fp-inscene-threat` og `#fp-monster-actor`, auk tveggja `requestAnimationFrame` ramma.

### 2.4 `action-ui-lab/public/js/combat/fx.js`
- **Hvað breyttist:**
  - Í `playViewportMotionClass(animClass, extraClass)` er `store.backdropMotionTimer` hreinsað og sett á `240ms` (`440ms` fyrir `anim-landmark-arrival`) til að fjarlægja hreyfiklasana af `#fp-scene-backdrop` um leið og CSS-hreyfingunni lýkur.
- **Af hverju nauðsynlegt:**
  - Kemur í veg fyrir að `#fp-scene-backdrop` sitji eftir með virkan `forwards` animation-klasa eftir að skrefi eða snúningi er lokið.

### 2.5 `action-ui-lab/public/js/api/client.js`
- **Hvað breyttist:**
  1. `dispatchAction` vistar virkt Promise í `store.activeActionPromise` þar til svar hefur verið teiknað.
  2. `dispatchTurn(turn)` tekur nú bæði við strengjum (`'LEFT'`, `'RIGHT'`, `'NORTH'`, `'EAST'`, `'SOUTH'`, `'WEST'`) og hlutum (`{ direction: 'RIGHT' }`, `{ turn: 'RIGHT' }`, `{ facing: 'EAST' }`).
  3. `triggerLabScenario(scenario, monsterName)` styður einnig valkvæðan valkostahlut `{ monsterName, preserveFacing }`.
- **Af hverju nauðsynlegt:**
  - Lagar villuna þar sem QA-forskriftir sem kölluðu á `dispatchTurn({ direction: 'RIGHT' })` sendu hlut í stað strengs á serverinn (sem olli því að `03_turn_crossroads_7_5_E` sneri ekki í `EAST` í Phase 2.5).

### 2.6 `action-ui-lab/tests/visual-regression.js`
- **Hvað breyttist:**
  - Bætt við `verifyScreenshotMultiZoneLuma` sem tekur raunverulegt Chromium-skjáskot (`Page.captureScreenshot`) og mælir birtustig (`avgLuma`) og hlutfall ó-svartra pixla (`nonBlackRatio`) í 5 svæðum (`topLeft`, `topCenter`, `topRight`, `center`, `bottomCenter`) inni í `#fp-scene-backdrop`.
  - Bætt við staðfestingu á `complete === true`, `naturalWidth > 0`, `coversViewportCompletely === true`, `objectFit === 'cover'`, `computedOpacity >= 0.99`, `prevComputedOpacity === '0'` og `!isCrossfadingClass`.
  - Bætt við Kafla 9 (`PHASE2_5B_INTEGRITY`): Rapid Movement / Crossfade Stress Test, `prefers-reduced-motion: reduce` prófun og staðfestingu á `0` console/page villum og `0` misheppnuðum myndabeiðnum.

---

## 3. Atriði sem voru rannsökuð en EKKI breytt

1. **Character Modal CSS (`public/css/components.css`, `public/css/character.css`)**:
   - Rannsókn og pixel-samanburður sýndu `0` pixla mun (`diffRatio: 0.00000`) milli Phase 2.5 baseline og after á öllum þremur skjástærðum (`1920×1080`, `1600×960`, `1280×720`) og `0px` frávik frá miðju. Engin breyting var gerð.
2. **Scene Scaling & Cropping (`object-fit`, `object-position`, `focalX`, `focalY` í `scene-catalog.js`)**:
   - Allar myndir fylla `#fp-scene-backdrop` 100% (`105% × 105%` með `-2.5%` offset) án nokkurra svartra ramma eða whitespace á `1920×1080`, `1600×960` og `1280×720`. Engin breyting var gerð.
3. **Stage 1 & Stage 2 Encounter/Combat CSS & Monster Scaling (`public/css/combat.css`, `monster-size-catalog.js`)**:
   - Staðsetning, stærð og contact shadows í Stage 1 og Stage 2 eru óbreytt frá Phase 2.5 baseline. Engin breyting var gerð og engar Phase 3 breytingar voru framkvæmdar.
4. **ES Module & CSS skipting Phase 2.5**:
   - Skiptingin í 8 CSS skrár og 20 ES6 einingar reyndist heilbrigð (`0` circular dependencies, rétt cascade röð) og var varðveitt óbreytt.
