# Darkgrid Adventure Lab — Independent Review Summary

**Dagsetning:** 2026-10-21  
**Worktree:** `C:\Users\hih\.gemini\antigravity\worktrees\antiDark\darkgrid_overnight_development` (`darkgrid_overnight_development`)  
**Umfang:** Óháð greining á `action-ui-lab/` (engin breyting á leikjakóða, `main`, production eða Firebase).

---

## 1. Staðfesting á Worktree og Öryggi

- **Virk grein og worktree:** `darkgrid_overnight_development` (greint út frá `bb0dddc`).
- **Aðallína (`main` í `C:\Users\hih\Documents\antiDark`):** Ósnert.
- **Einangrun:** 100% af breytingum og nýjum skrám í þessu worktree eru innan `action-ui-lab/`. Eng engin breyting var gerð á leikjakóða í þessari úttekt.

---

## 2. Stutt Prófunaráætlun sem Fylgt Var

1. **Áfangi A — World Continuity:** Greining á `travel-continuity.js`, `scene-catalog.js` og `adventure-engine.js` ásamt mælingu á öllum 160 færum reitum (640 sjónarhornum) og vafraferðalagi eftir Norður- og Austurleiðum.
2. **Áfangi B — Gameplay Pacing:** Greining á `server.js` og `adventure-engine.js` ásamt hermi- og vafrakeyrslu yfir óbyggðareiti til að mæla bardagatíðni, discovery-þéttleika og spennuuppbyggingu.
3. **Áfangi C — Monster Presentation:** Greining á `monster-size-catalog.js`, `server.js`, `action-ui.js` og `action-ui.css` ásamt vaframælingum í headless Chromium (`1920×1080`) á stærðum, fjarlægðum, gólfestingu, skuggum og muninum á `INTEGRATED` RGBA cutouts (37) og `CARD` fallback (61).
4. **Áfangi D — Player UI:** Mæling á flatarmáli, tómu plássi og upplýsingatvítekningum í Exploration, Stage 1 og Stage 2 Combat við `1920×1080`, `1440×900` og `1280×800`.
5. **Áfangi E — Skil:** Skýrslurnar [`REVIEW-SUMMARY.md`](REVIEW-SUMMARY.md), [`ADVENTURE-IMMERSION-REVIEW.md`](ADVENTURE-IMMERSION-REVIEW.md) og [`NEXT-IMPLEMENTATION-PLAN.md`](NEXT-IMPLEMENTATION-PLAN.md).

---

## 3. Heildarniðurstaða (Executive Verdict)

Næturvinnan skilaði **mikilli tæknilegri innviðauppbyggingu** (168/168 sjálfvirk próf græn, 30 ný hágæða RGBA skrímsla-cutouts, PF1e stærðarkerfi, SQLite-vistun og samfelluvél í `travel-continuity.js`).

**Hins vegar sýnir óháð úttekt í raunverulegum vafra að tæknilegu einingarnar voru smíðaðar í aðskildum „tracks“ án fullrar samþættingar við það sem leikmaðurinn upplifir á skjánum.** Sjálfvirku prófin prófuðu fyrst og fremst JSON API-svör og tilvist DOM-eininga, en fönguðu ekki eftirfarandi lykilvandamál í upplifun leikmannsins:

| Svið | Einkunn | Helstu styrkleikar | Helstu veikleikar / rof í upplifun |
| :--- | :---: | :--- | :--- |
| **A. World Continuity** | **5,5 / 10** | Sterk bakendavél í `travel-continuity.js`; góð Tier 1 samfella við Oakhaven (`[7,7]`), North Gate (`[7,6]`), Crossroads (`[7,5]`) og Stone Bridge (`[8,7]`). | 1) **`action-ui.js` birtir 0% af nýju `travelContinuity` gögnunum** (`continuityNote`, `horizonHint`, `revisitBanner`, `compassContext` eru aldrei lesin í framenda).<br>2) **Modulo-3 galli í Tier 4:** Á öllum 111+ almennum reitum fá `NORTH` og `WEST` **alltaf nákvæmlega sömu myndina** (`(x+0)%3 === (x+3)%3`).<br>3) **`[7,4] NORTH` (Mirkwood Trail)** vantar í `DEFAULT_PERSPECTIVE_VIEWS` þrátt fyrir að `forest_7_4_north_oak_approach.jpg` sé til á diski; myndin er þess í stað ranglega sett á `[7,3] EAST/WEST`.<br>4) **24 af 148 sjónarhornum í Mirkwood Forest** birta hitabeltismyndina `terrain_jungle.webp`. |
| **B. Gameplay Pacing** | **6,0 / 10** | Mjög lipur ferðahraði (hægt að ganga framhjá Stage 1 skugga og af sigurskjá án aukasmella); skýr 3-þrepa spennuhönnun á pappír. | 1) **`server.js` hunsar `pacingState` og `postCombatBreathingSteps`** þegar kastað er upp á bardaga (`checkTileEncounter`).<br>2) **Ofhleðsla atburða:** ~80–85% skrefa í óbyggðum kveikja á bardaga, Discovery-spjaldi eða Tension-borða (t.d. 3 handskrifuð Discovery-spjöld á 3 reitum í röð á `[7,5]→[7,4]→[7,3]`).<br>3) **`server.js` sendir `null, 0` í `onPlayerStep`** fyrir `persistentAlert` og `adjacentPersistentCount`, svo spor eftir lifandi skrímsli á nágrannareit (`GENUINE_EVIDENCE`) virkjast ekki við venjuleg skref. |
| **C. Monster Presentation** | **6,5 / 10** | 37 hrein RGBA cutouts (100% hreinn jaðar); rétt PF1e stærðarröðun (`TINY` til `COLOSSAL`) og breiddarhlutföll án bjögunar. | 1) **61 af 98 skrímslum (`CARD` fallback) svífa í miðju lofti (`56–60%` Y)** (~210–247 px fyrir ofan gólf!) með skugga í lausu lofti vegna þess að `.is-card-monster` vantar `margin-top: auto`.<br>2) **`--stage-floor-y` og `--monster-offset-y` eru aldrei lesin í `action-ui.css`**; `.fp-monster-hud-plate` (`97 px` hátt) ræður fóthæð allra cutout-skrímsla (`79,7%` Y).<br>3) **`virtualDistanceFt: 12` er harðkóðað í `action-ui.js`**, svo fjarlægðarstig (`20 ft / 16 ft / 9 ft`) virka ekki í bardaga.<br>4) **Staðlaðir sniðmátsskuggar** á öllum 30 nýju cutout-skrímslunum (t.d. 5 kóngulóarskuggar á `rust_monster`). |
| **D. Player UI** | **6,5 / 10** | Góð progressive disclosure (`🛠️ Lab Tools [~]`) sem felur tæknileg merki í Player Mode; skýr Stage 1 vs. Stage 2 aðgreining; stækkanlegt Chronicle (`[H]`). | 1) **~386 px (65%) tómt dökkt bil inni í `#dm-movement-deck`** við `1920×1080` vegna `grid-template-rows: auto auto 1fr` á móti `max-height: 156px` á takkaborði.<br>2) **388 px lárétt autt pláss** við `1920×1080` vegna `max-width: 1540px` á `.dm-shell`.<br>3) **Mikil tvítekning á skjá:** Átt (`NORTH`) birtist **6×**, reitur framundan **3×**, Stance **3×**, Hamur **3×**, Pack **2×**, Hero **2×**, Potions **2×**, og HP/AC **2×** hlið við hlið. |

---

## 4. Topp 5 Forgangsatriði Fyrir Næstu Lotu

1. **Tengja `travelContinuity` við framendann (`action-ui.js`) og laga myndavalsgalla í `scene-catalog.js`:**
   - Birta `continuityNote`, `horizonHint` og `revisitBanner` í Chronicle / Vista-borða; skrá `forest_7_4_north_oak_approach.jpg` á `[7,4] NORTH`; laga modulo-3 áreksturinn (`NORTH === WEST`) í Tier 4; og fjarlægja `terrain_jungle.webp` úr Mirkwood `FOREST`.
2. **Laga gólfestingu skrímsla (`--stage-floor-y`, `--monster-offset-y`) og svífandi `CARD` skrímsli í `action-ui.css`:**
   - Festa bæði Cutout- og Card-skrímsli við raunverulega gólflínu senunnar og koma í veg fyrir að `.fp-monster-hud-plate` ýti skrímslum upp í trjákrónurnar.
3. **Virkja Pacing-vélina í `server.js` (`MOVE` handler):**
   - Láta `server.js` virða `postCombatBreathingSteps`, bæjarhliðagát (`[7,6]`/`[7,8]`) og lágmarksbil milli óvæntra bardaga og discovery-spjalda, og senda raunverulegt `persistentAlert` / `adjacentPersistentCount` + `facing` / `moveKind` inn í `onPlayerStep`.
4. **Endurskipuleggja hægri dálk og eyða `386 px` tóma bilinu og tvítekningum í Player UI:**
   - Fjarlægja tvíteknar upplýsingar (t.d. tvöfalda HP/AC mæla, þrefalda Stance-hnappa og sexfalda áttarvísa) og nýta plássið í hægri dálki fyrir lifandi ferðasögu/áttavitakort í stað tóms bils.
5. **Klára RGBA cutouts fyrir næsta hóp af 61 `CARD` skrímslum og sérsníða snertiskugga (`contactPatches`):**
   - Reikna raunverulega fótapunkta (`alpha > 20` í neðstu 12% myndarinnar) fyrir hvert cutout-skrímsli í stað sniðmátsskugga, og stækka hlutfall `INTEGRATED` skrímsla úr `37/98` upp í `98/98`.

Sjá ítarlega greiningu í [`ADVENTURE-IMMERSION-REVIEW.md`](ADVENTURE-IMMERSION-REVIEW.md) og skref-fyrir-skref framkvæmdaáætlun í [`NEXT-IMPLEMENTATION-PLAN.md`](NEXT-IMPLEMENTATION-PLAN.md).
