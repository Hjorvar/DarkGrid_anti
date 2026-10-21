# Darkgrid Adventure Lab — Independent Adventure Immersion & Continuity Review

**Dagsetning:** 2026-10-21  
**Worktree:** `C:\Users\hih\.gemini\antigravity\worktrees\antiDark\darkgrid_overnight_development` (`darkgrid_overnight_development`)  
**Umfang:** Óháð greining á `action-ui-lab/` (engin breyting á kóða).

---

## A. World Continuity (Ferðalög, Snúningur, Kennileiti og Landsvæði)

### A.1 Helsta uppgötvun: Rof á milli bakendagagna (`travel-continuity.js`) og framendaviðmóts (`action-ui.js`)

Í næturkeyrslunni smíðaði Track 1 umfangsmikla samfelluvél í [`travel-continuity.js`](../../travel-continuity.js) (2.106 línur) og tengdi hana við `state.adventure` og `state.viewportScene` í [`adventure-engine.js`](../../adventure-engine.js) og [`scene-catalog.js`](../../scene-catalog.js). Hins vegar vann Track 2 samhliða í [`public/action-ui.js`](../../public/action-ui.js) án þess að tengja þessi nýju samfellugögn við DOM-viðmótið:

- **Ótengd svið í `public/action-ui.js`:** Leit í `public/action-ui.js` staðfestir **0 tilvik** af `travelContinuity`, `continuityNote`, `horizonHint`, `behindHint`, `revisitStatus`, `revisitBanner`, `breadcrumbTrail`, `compassContext`, `biomePersistence`, `boundaryGuidance` og `combatReturnContext`.
- **Afleiðing fyrir leikmanninn:** Allir nýju samfellutextarnir sem útskýra hvernig sena tengist fyrri reit (t.d. *„Leaving the warm hearth-fires of Oakhaven Sanctuary behind...“*, *„Ahead North: Through parting woodland mist rises the colossal root-arch of the Primeval Black Oak...“*, eða *„Stepping backward from Mirkwood Forest to Oakhaven North Gate...“*) eru reiknaðir á bakenda og sendir í JSON-svari (`/api/state` og `/api/action`), **en birtast hvergi á skjánum**.
- Sjálfvirku prófin í `tests/world-travel.test.js` (`10/10 PASS`) prófuðu eingöngu JSON-skilin frá API-endapunktum og fönguðu því ekki að leikmaðurinn sér enn aðeins gamla staðbundna `state.currentTile.description` í Chronicle-glugganum og einfalda `Ahead (NORTH): <TileName>` línu í vista-borðanum.

---

### A.2 Ferðalög milli reita (`Travel Between Tiles`)

1. **Aðalleiðin norður (`Oakhaven [7,7] → North Gate [7,6] → Crossroads [7,5] → Mirkwood Trail [7,4] → Heart of the Mirkwood [7,3]`):**
   - **Skref 1 (`[7,7] → [7,6] NORTH`):** Virkar vel sjónrænt (`fp_north_gate_7_6_north`, Tier 1).
   - **Skref 2 (`[7,6] → [7,5] NORTH`):** Virkar vel sjónrænt (`fp_crossroads_7_5_north`, Tier 1).
   - **Skref 3 (`[7,5] → [7,4] NORTH` — Mirkwood Trail):** **Alvarlegt samfellurof.** Þótt sérsmíðuð mynd sé til á diski fyrir nákvæmlega þennan reit og stefnu (`/lab-assets/images/perspective/forest_7_4_north_oak_approach.jpg`), vantar færslu fyrir `tile_x: 7, tile_y: 4, facing: 'NORTH'` í `DEFAULT_PERSPECTIVE_VIEWS` í [`scene-catalog.js`](../../scene-catalog.js#L1358-L1403). Þess í stað fellur `[7,4] NORTH` niður í **Tier 4 generic fallback** (`/images/terrain/terrain_forest.webp`). Leikmaður sem nálgast Eikina miklu (`[7,3]`) úr suðri sér hana því alls ekki í 1 reits fjarlægð.
   - **Skref 4 (`[7,4] → [7,3] NORTH` — Heart of the Mirkwood):** Birtir Tier 1 mynd af Eikinni (`forest_ancient_oak.jpg`), en þegar leikmaður snýr sér til austurs (`EAST`) eða vesturs (`WEST`) á `[7,3]` birtist `forest_7_4_north_oak_approach.jpg` — þ.e. myndin sem átti að vera á `[7,4] NORTH` og sýnir Eikina framundan í fjarska þótt leikmaðurinn standi þegar undir henni og horfi í burtu!
2. **Endurtekin sama mynd þegar gengið er áfram (`Forward Steps With Identical Image`):**
   - Í `DEFAULT_POV_CONTEXT_RULES` er reglan `pov_forest_track_east` (`from=FOREST, to=FOREST, facing=EAST -> crossroads_7_5_east.jpg`). Hún veldur því að **hvert einasta skref í austur milli tveggja skógarreita hvar sem er á kortinu** birtir nákvæmlega sömu myndina (`crossroads_7_5_east.jpg` með vegamótasteininum á `[7,5]`).
   - Á öllu kortinu halda **23 af 564 færum skrefum áfram (4,1%)** nákvæmlega sömu bakgrunnsmynd og á fyrri reit, þannig að skref áfram lítur út eins og ekkert hafi hreyfst.

---

### A.3 Snúningur á sama stað (`Rotation in Place`)

Mæling á öllum **160 færum reitum (640 sjónarhornum)** í Mode C sýnir verulega veikleika þegar leikmaður snýr sér á staðnum (`A`/`D`):

- **Aðeins 51 af 160 færum reitum (31,9%)** hafa 4 ólíkar myndir fyrir höfuðáttirnar fjórar (`N, E, S, W`).
- **101 af 160 reitum (63,1%)** hafa aðeins 3 ólíkar myndir, **7 reitir** hafa aðeins 2 myndir, og **1 reitur (`Deadman's Mire [4,11]`)** notar **nákvæmlega sömu myndina (`deadmans_mire_4_11_ruins.jpg`) í allar 4 höfuðáttir (`N, E, S, W`)**.
- **73 af 640 mögulegum 90° snúningum (11,4%)** breyta bakgrunnsmyndinni **alls ekkert**.
- **51 af 320 gagnstæðum 180° áttum (15,9%)** (t.d. `NORTH` á móti `SOUTH` á sama reit) sýna **nákvæmlega sömu myndina**.
- **Stærðfræðileg orsök í Tier 4 (`computeDeterministicVariantIndex`):**
  - Í [`scene-catalog.js`](../../scene-catalog.js#L78-L90) er reiknað `(ix + iy * 2) % n` þar sem `ix = current.x + facingIndexShift` og `facingIndexShift` er `{ NORTH: 0, EAST: 1, SOUTH: 2, WEST: 3 }`.
  - Þar sem öll helstu landsvæði (`FOREST`, `PLAINS`, `HILLS`, `SWAMP`, `JUNGLE`) eru með `n = 3` Tier 4 POV-myndir í gagnagrunni, gildir í modulo-3 reikningi að `(x + 0) % 3 === (x + 3) % 3` **fyrir hvern einasta reit á kortinu**.
  - Þess vegna fá `NORTH` (`+0`) og `WEST` (`+3`) **alltaf nákvæmlega sama Tier 4 myndbrigði** á öllum almennum reitum!

---

### A.4 Ferðalag fram og til baka (`Forward & Backward / 180° Reciprocity`)

- **Á sérhönnuðum Tier 1 reitum (`[7,7] ↔ [7,6] ↔ [7,5]` og `[7,7] ↔ [8,7] ↔ [9,7]`):**
  - Gagnkvæmni virkar vel: á `[7,6] NORTH` sést vegurinn að `[7,5]`, og þegar stigið er á `[7,5]` og snúið í `SOUTH` (`fp_crossroads_7_5_south`) sést hliðið á `[7,6]` í bakgrunni. Ef stigið er afturábak (`S` / `BACKWARD`) af `[7,5] NORTH` á `[7,6] NORTH` helst sjónarhornið rétt.
- **Vantar í `server.js` við `MOVE`:**
  - Í [`server.js`](../../server.js#L1912-L1920) er kallað á `onPlayerStep(character.id, targetTile, ...)` með aðeins 5 viðföngum og **sleblt 6. viðfanginu (`options = { facing, moveAction: moveKind }`)** ásamt `persistentAlert` og `adjacentPersistentCount`. Því þarf `onPlayerStep` að giska á hreyfitegund út frá `inferMoveTypeFromStep` og fær aldrei `persistentAlert` við skrefið sjálft.
- **Á almennum reitum og við `[7,4]`:**
  - Ef gengið er frá `[7,5] NORTH` á `[7,4] NORTH` og snúið 180° í `SOUTH` til að horfa til baka á vegamótin (`[7,5]`), birtist **nákvæmlega sama mynd (`terrain_forest.webp`)** í `SOUTH` og í `NORTH`. Leikmaðurinn snýr sér 180° við en sér nákvæmlega sömu trén í báðar áttir.

---

### A.5 Samfella kennileita og breytingar milli landsvæða (`Landmarks & Biome Transitions`)

1. **Nálgun kennileita (`Landmark Approach` úr 1 reits fjarlægð):**
   - Af 12 kennileitum (`WORLD_LANDMARKS`) hafa aðeins Oakhaven/Gates, Stone Bridge, East Watchpost, Stonefang Crag og 2 áttir að Deadman's Mire sérstaka nálgunarmynd úr 1 reits fjarlægð.
   - Kennileiti eins og **Rotting Fen Boardwalk `[6,10]`**, **Raven Crags Sentinel Cairn `[3,5]`**, **Windblown Heath Standing Stones `[12,4]`** og **Bioluminescent Spore Hollow `[9,11]`** sýna enga sjónræna vísbendingu úr 1 reits fjarlægð (eingöngu Tier 3/4 generic myndir), og á `[12,4]` sýna 3 af 4 áttum á reitnum sjálfum (`NORTH`, `EAST`, `SOUTH`) nákvæmlega sömu myndina (`plains_windblown_heath_pov.jpg`).
2. **Breytingar milli landsvæða (`Biome Transitions`):**
   - Af 80 landamæraþverunum milli ólíkra landsvæða grípa Tier 3 reglur (`pov_transition_*`) 71 þeirra (88,8%), **en myndirnar eru endurnýttar í öfuga átt**:
     - `pov_transition_plains_to_swamp` (úr `PLAINS` inn í `SWAMP`) og `pov_transition_swamp_to_plains` (úr `SWAMP` út á `PLAINS`) nota **nákvæmlega sömu myndina (`transition_plains_to_swamp_pov.jpg`)**. Þegar leikmaður stendur í dimmri mýri og horfir út á sléttuna sýnir myndin hann standa á þurru sléttugrasi að horfa inn í mýrina.
     - `pov_transition_plains_to_hills` notar `transition_forest_to_hills_pov.jpg` (þéttur skógur í forgrunni þótt staðið sé á opinni sléttu).
     - `pov_transition_hills_to_forest` notar `transition_plains_to_forest_pov.jpg` (flöt slétta í stað hæða).
3. **Hitabeltisfrumskógur (`terrain_jungle.webp`) inni í Mirkwood Forest:**
   - Í `DEFAULT_SCENE_VARIANTS` notar `FOREST` myndbrigðið `forest_tangled_canopy` skrána `/images/terrain/terrain_jungle.webp`. Þetta veldur því að **24 af 148 sjónarhornum í `FOREST` (16,2%)** birta hitabeltisfrumskóg í miðjum Mirkwood-skógi.

---

## B. Gameplay Pacing (Tíðni bardaga, Ferðahraði, Discovery Events og Spenna)

### B.1 Tíðni bardaga og rof á Pacing-vél (`Combat Frequency vs. Pacing Engine`)

1. **Pacing-vélin í `travel-continuity.js` og `adventure-engine.js` stýrir EKKI raunverulegum bardagalíkindum í `server.js`:**
   - Í [`adventure-engine.js`](../../adventure-engine.js) og [`travel-continuity.js`](../../travel-continuity.js) eru reiknuð `postCombatBreathingSteps` (2 róleg skref eftir bardaga), `quietStepsCount`, `stepsSinceLastEncounter` og `pacingState` (`SANCTUARY_CALM`, `POST_COMBAT_RECOVERY`, `QUIET_TRAVEL`).
   - Hins vegar kallar [`server.js`](../../server.js#L1893-L1900) beint á `checkTileEncounter(tx, character, targetTile, encounterOpts)` úr aðalleiknum á **hverju einasta skrefi** utan `CITY` án þess að lesa `postCombatBreathingSteps` eða `pacingState`!
   - **Raunmæling á 27 gildum skrefum um óbyggðir:**
     - **6 bardagar (22,2% skrefa)**, **8 discovery-atburðir (29,6%)**, **6 ambient tension-boð (22,2%)** og aðeins **7 raunverulega róleg skref (25,9%)** (og flest þeirra voru þegar stigið var aftur inn í/við Oakhaven).
     - Í óbyggðum (`FOREST`/`PLAINS`/`UNDERGROUND_RUINS`) gerist eitthvað (Encounter, Discovery eða Tension-borði) á **~80–85% allra skrefa**. Leikmaður fær sjaldan 2–3 skref í röð til að njóta ferðalagsins án þess að nýr borði eða skuggi sprengi upp skjáinn.
2. **Hlið Oakhaven (`[7,6]` North Gate og `[7,8]` South Gate) kveikja á skrímslum strax á fyrsta skrefi:**
   - Þótt `travel-continuity.js` flokki `[7,6]` og `[7,8]` sem hliðarsvæði við griðastað (`TOWN_GATES`), eru þau með `is_safe = 0` í `map_tiles`. Því getur leikmaður sem stígur **eitt skref** út úr Oakhaven lent beint í bardaga eða launsátri (Ambush) undir sjálfu bæjarhliðinu áður en ferðalagið er hafið.

### B.2 Ferðahraði og flæði (`Travel Speed & Flow`)

- **Styrkleiki — Engin „Confirm“ hindrun á milli skrefa:**
  - Í Stage 1 (`DISCOVERED` án Ambush) getur leikmaður einfaldlega haldið áfram að ganga með `W/S/Q/E` til að læðast framhjá ógninni (`bypassedEncounter = true` í einni lotu), og eftir sigur (`VICTORY`) þarf ekki að loka sigurskjánum heldur má stíga beint áfram. Þetta gerir hreyfihraðann mjög lipran.
- **Gallar í flæði við Discovery-atburði:**
  - Á Norðurleiðinni (`[7,5] → [7,4] → [7,3]`) eru **þrír handskrifaðir Discovery-atburðir á þremur reitum í röð**:
    - `[7,5]`: *Notched Ranger Tally-Post* (`NOTICEABLE` borði)
    - `[7,4]`: *Abandoned Scout Camp beside the Trail* (`IMPORTANT` stórt spjald sem hylur neðri hluta senunnar)
    - `[7,3]`: *Warden's Hollow Beneath the Black Oak* (`IMPORTANT` stórt spjald)
  - Þar sem handskrifaðir (`exactTiles`) discovery-atburðir í [`adventure-engine.js`](../../adventure-engine.js#L949-L958) fara framhjá `stepsSinceLastDiscovery < 2` reglunni, fær leikmaðurinn 3 discovery-spjöld á 3 skrefum í röð (eða bardaga ofan í þau).

### B.3 Spennuuppbygging (`Tension Buildup`)

- **Styrkleiki:** Aðgreiningin á milli `AMBIENT_TENSION` (andrúmsloft), `GENUINE_EVIDENCE` (raunverulegt persistent skrímsli á reit eða nágrannareit) og `ENCOUNTER_INTRO` (Stage 1 skuggi) er vel útfærð í rökfræði.
- **Veikleiki:** Vegna þess að `server.js` sendir `null, 0` í `onPlayerStep(..., null, 0)` á línu 1918 í stað `persistentAlert` og `adjacentPersistentCount`, uppfærist `GENUINE_EVIDENCE` ekki í `onPlayerStep` heldur aðeins ef `buildAdventureClientPayload` yfirskrifar það — en `buildAdventureClientPayload` endurreiknar `activeTensionCue` **aðeins** þegar `isActiveEncounter` er satt eða þegar hreinsa þarf gamalt `ENCOUNTER_INTRO` (línur 1553–1579)! Ef leikmaður gengur á reit við hliðina á lifandi skrímsli (`adjacentPersistentCount > 0`) án þess að vera í bardaga, fær `onPlayerStep` `adjacentPersistentCount = 0` og kveikir því **aldrei** á `GENUINE_EVIDENCE • NEARBY SURVIVOR` við venjulegt skref!

---

## C. Monster Presentation (Stærðir, Fjarlægðir, Skuggar, Lýsing og Cutout vs. Card)

### C.1 Stærð skrímsla (`Monster Size & Proportions`)

- **Styrkleiki — Monótónísk PF1e stærðarröðun og hlutföll:**
  - Stærðarkerfið í [`monster-size-catalog.js`](../../monster-size-catalog.js) heldur skýrri stærðarröðun (`FINE < DIMINUTIVE < TINY < SMALL < MEDIUM < LARGE < HUGE < GARGANTUAN < COLOSSAL`) og varðveitir breiddarhlutföll (`aspectRatio`) fyrir breiðar verur (`rust_monster` `372×280 px`, `wyvern` `486×398 px`) án láréttrar bjögunar.
  - Í vaframælingu við `1920×1080` er t.d. `stirge` (`TINY`) `140×125 px`, `goblin` (`SMALL`) `164×195 px`, `hobgoblin` (`MEDIUM`) `222×284 px` og `ogre` (`LARGE`) `339×414 px`.
- **Veikleiki — Stórar verur ásamt `.fp-monster-hud-plate` þrengja að efra HUD:**
  - Vegna þess að `.fp-monster-hud-plate` (`520×97 px`) situr sem flex-barn *fyrir neðan* skrímslið inni í `#fp-monster-actor`, ýtir upplýsingaspjaldið skrímslinu upp um ~100 px. Fyrir `LARGE` verur eins og `ogre` (`414 px` á hæð) og `wyvern` (`398 px` á hæð + `34 px` svifbili) lendir höfuð/vængir skrímslisins í `34–36%` frá efri brún viewportsins og skarast næstum við efri HUD-skiltin (`#fp-location-plaque` og `#fp-tension-ribbon-wrap`).

---

### C.2 Fjarlægðir (`Distances & Engagement Bands`)

- **Rof á milli `ENCOUNTER_DISTANCE_BANDS` í `monster-size-catalog.js` og `action-ui.js`:**
  - Track 3 útfærði 4 fjarlægðarstig í `monster-size-catalog.js`: `DISTANT_SIGHTING` (`20 ft`, `0.60×`), `RANGED_ENGAGEMENT` (`16 ft`, `0.75×`), `MELEE_ENGAGEMENT` (`12 ft`, `1.00×`) og `CLOSE_PRESS` (`9 ft`, `1.33×`).
  - Hins vegar er í [`public/action-ui.js`](../../public/action-ui.js#L289-L300) (`computeClientMonsterVisualScale`) **harðkóðað `virtualDistanceFt: 12`** í öllum bardögum!
  - Hvorki bogamaður (`isRangedActive === true`), Round 1 opnunarlotur né nálægðartök breyta fjarlægð skrímslisins í raunverulegum bardaga.
  - Eina notkunin á fjarlægðargögnum (`monster.distanceTransition`) í framenda er `0.39s–0.52s` CSS innkomuhreyfing (`@keyframes monsterEmergeFromMist` með `--approach-start-scale: 0.6` og `--approach-start-y: -25px`) þegar bardagi hefst; um leið og þeirri hálfu sekúndu lýkur standa öll skrímsli í nákvæmlega `12 ft` fjarlægð.

---

### C.3 Skuggar og staðsetning (`Shadows & Stage Grounding`)

1. **`--stage-floor-y` og `--monster-offset-y` eru aldrei lesin í `action-ui.css`:**
   - Í [`public/action-ui.js`](../../public/action-ui.js#L1625-L1629) eru reiknuð og sett inline CSS-breytugildi á `#fp-monster-actor`: `--stage-floor-y` (`80.5%` á brú, `82.0%` í skógi, `83.5%` í mýri) og `--monster-offset-y` (`+12px` fyrir Goblin, `+24px` fyrir Ogre, `-38px` fyrir Stirge).
   - Leit í [`public/action-ui.css`](../../public/action-ui.css) sýnir hins vegar **0 tilvik** af `var(--stage-floor-y)` og **0 tilvik** af `var(--monster-offset-y)`.
   - Í stað þess að festa fætur skrímslisins við gólflínu senunnar (`stageFloorY`), notar `.fp-monster-actor.is-integrated-monster` einfaldlega `margin-top: auto; margin-bottom: 2px;` ofan á `.fp-monster-hud-plate` (`97 px` hátt).
   - **Raunmæling í vafra (`1920×1080`):** Fætur allra jarðbundinna cutout-skrímsla (`goblin`, `rust_monster`, `ogre`) lenda á **nákvæmlega `79,7%` af hæð viewportsins** í öllum senum, óháð því hvort gólflínan á að vera í `80,5%` eða `83,5%` eða hvort skrímslið á að sökkva í mýri (`groundSinkScale = 1.45`).
2. **Alvarlegur staðsetningargalli í `CARD` fallback (`61 af 98 skrímslum`):**
   - `.fp-monster-actor.is-integrated-monster` er með `justify-content: flex-end; margin-top: auto;`, en `.fp-monster-actor.is-card-monster` **vantar `margin-top: auto`**.
   - Því miðjar `.fp-center-stage` (`justify-content: center`) öll Card-skrímsli lóðrétt í miðjum glugganum!
   - **Raunmæling í vafra (`1920×1080`):**
     - `choker` (`SMALL` Card fallback): neðri brún myndarinnar er í **`56,0%` af hæð viewportsins (`26,0%` / ~247 px fyrir ofan gólflínuna!)** — myndin svífur uppi í trjákrónunum/miðju lofti og undir henni hangir `.fp-monster-ground-shadow` í lausu lofti!
     - `hobgoblin` (`MEDIUM` Card fallback): neðri brún er í **`59,8%` (`22,2%` / ~210 px fyrir ofan gólflínuna)** með skugga í lausu lofti.
3. **Staðlaðir snertiskuggar (`contactPatches`) á öllum 30 nýju cutout-skrímslunum:**
   - Upprunalegu 7 cutout-skrímslin í [`server.js`](../../server.js#L130-L308) hafa handmælda snertiskugga undir hverjum fæti/kló.
   - Hin 30 nýju cutout-skrímslin nota hins vegar sjálfvirkar sniðmátsstaðsetningar úr `visualBodyProfile` (línur 311–333 í `server.js`). Þannig fær t.d. `rust_monster` (4-fætt skordýr) **5 kóngulóarfótaskugga** (`leg-l1` til `leg-r1` við `14%, 30%, 50%, 70%, 86%`), og öll tvífætt skrímsli fá sömu `37% / 63%` skuggana óháð raunverulegri fóta- og vopnastöðu á myndinni.

---

### C.4 Samræmi við lýsingu umhverfis (`Environment Lighting Consistency`)

- **Styrkleiki í Cutout Mode:** `.env-grade-bridge`, `.env-grade-forest`, `.env-grade-sanctuary` og `.env-grade-wilderness` í [`public/action-ui.css`](../../public/action-ui.css#L1297-L1332) stilla birtu (`brightness(0.92–0.95)`), litmettun og litaðan jaðarljóma (`drop-shadow`) á cutout-skrímslum og para lit á gólfskugga (`--ground-shadow-tint`) við undirlag senunnar.
- **Veikleiki:** `resolveEnvironmentLightingGroup` í [`public/action-ui.js`](../../public/action-ui.js#L1516-L1533) þekkir aðeins 4 hópa (`bridge`, `forest`, `sanctuary`, `wilderness`). Hún greinir ekki á milli t.d. dimmrar grafhvelfingar/rústa (`UNDERGROUND_RUINS` / `Watchpost`), eitraðrar mýrar (`SWAMP` / `Deadman's Mire` sem fellur undir `forest`), og sólskinsheiðar (`PLAINS` / `HILLS` sem falla undir `wilderness`).
- Í **Card Mode** (61 af 98 skrímslum) hefur skrímslið sinn eigin málaða bakgrunn og lýsingu inni í rammanum (oft hellir eða önnur birta en í senunni fyrir aftan), sem rýfur sjónræna samfellu við umhverfið.

---

### C.5 Cutout vs. Card Presentation (`37 Cutouts vs. 61 Cards`)

- **Gæði nýju 30 RGBA cutout-myndanna:** Tæknileg útfærsla í [`scripts/produce-monster-cutouts.js`](../../scripts/produce-monster-cutouts.js) er vönduð — allar 37 skrárnar eru sannar RGBA PNG með 100% hreinum 2px jaðri og án lausra bakgrunnseyja.
- **Upplifunarrof á milli `INTEGRATED` (37,8%) og `CARD` (62,2%):**
  - Þegar leikmaður mætir einu af 37 cutout-skrímslunum (`goblin`, `orc`, `ogre`, `wolf`, `rust_monster`, o.s.frv.) stendur skrímslið beint inni í 1. persónu senunni við gólfið án ramma.
  - Þegar leikmaður mætir einu af hinum 61 skrímslunum (`choker`, `hobgoblin`, `boar`, `hyena`, `wight`, `ettercap`, o.s.frv.) birtist skyndilega **dökkur ferhyrndur spjaldrammi með hornhökum (`.fp-corner-bracket`) og tvöföldum bakgrunni sem svífur í miðju lofti (`~56–60%` Y)**.
  - Þetta skapar þá tilfinningu að tveir ólíkir leikir séu í gangi eftir því hvaða skrímsli dregst upp úr gagnagrunninum.

---

## D. Player UI (Exploration vs. Combat, Forgangsröðun, Tómt Pláss og Óþarfa Spjöld)

### D.1 Exploration vs. Combat Viðmót

- **Styrkleiki:** Progressive disclosure (`🛠️ Lab Tools [~]`) fjarlægði 25+ þróunarhnappa úr efstu röðinni í Player Mode og faldi tæknileg merki (`Scene C • Tier 1 Exact POV`, `✦ In-Scene Cutout`, pixel-stærðir) með `.dev-only-badge`. Viðskiptin í Stage 1 (`DISCOVERED` skuggi í þoku) og Stage 2 (`IN_COMBAT` með rauðum blæ og læsingarborða á hreyfispjaldi) eru skýr.
- **Veikleiki:** Viðmótsgrindin sjálf breytir hvorki hlutföllum né spjaldaskipan á milli Exploration og Combat:
  - Í **Exploration** eru 3 af 4 hnöppum í `⚔️ Tactical Action Deck` (`Strike`, `Drink Potion` við fullt líf, `Retreat`) óvirkir (`disabled` / gráir), en spjaldið tekur samt fullt pláss (`355×148 px`).
  - Í **Combat** er allt `🕹️ Navigation` spjaldið (`355×596 px` = **62,8% af hægri dálki!**) læst og óvirkt, en tekur samt meira en helming hægri dálksins á meðan virku bardagahnapparnir 4 fá aðeins `148 px` hæð!

---

### D.2 Sjónræn upplýsingaforgangsröðun (`Visual Hierarchy`)

- **Keppni um athygli í 1. persónu glugganum (`#fp-viewport`):**
  - Allt að **5–6 yfirlagseiningar (overlays)** keppa um pláss ofan á máluðu 1. persónu senunni:
    1. Efst til vinstri: Stórt 4-lína staðsetningarskilti (`#fp-location-plaque`: Titill + Áttaviti, Hnit + Landslag, Senulýsing, og Vinstri/Framundan/Hægri FOV-rönd).
    2. Efst til hægri: Ástandsborði (`#fp-state-banner`), POI-hnappur (`#fp-poi-trigger-wrap`) og Expedition-hnappur (`#fp-expedition-pill-wrap`).
    3. Þar fyrir neðan: Spennuborði (`#fp-tension-ribbon-wrap`).
    4. Í miðju/neðri hluta: Skrímsli + `.fp-monster-hud-plate` (`520×97 px`) EÐA `.fp-vista-bar`.
    5. Þar ofan á: Discovery-borði eða stórt Discovery-valspjald (`#fp-discovery-layer`).
    6. Neðst: Chronicle-kassi (`#fp-bottom-chronicle`, `84 px` hár).
  - Þegar Discovery-spjald (`IMPORTANT` tier eins og á `[7,4]` og `[7,3]`) og Tension-borði eru opin samtímis er meira en helmingur 1. persónu málverksins hulinn textakössum.

---

### D.3 Tómt pláss (`Whitespace & Dead Space` — Raunmælingar í vafra)

Vaframæling í Chromium (`1920×1080`, `1440×900`, `1280×800`) leiðir í ljós tvö stór svæði með vannýttu/tómu plássi:

1. **Í hægri dálki (`#dm-movement-deck`): ~386 px af tómu dökku bili við `1920×1080`!**
   - `.dm-right-deck` notar `grid-template-rows: auto auto minmax(0, 1fr)` ([`action-ui.css`](../../public/action-ui.css#L1678)).
   - Við `1920×1080` er hægri dálkurinn `949 px` hár:
     - `#dm-minimap-card`: `190 px`
     - `#dm-action-deck-card`: `148 px`
     - `#dm-movement-deck`: **`596 px` (62,8% af hægri dálki!)**
   - En inni í `#dm-movement-deck` (`display: flex; flex-direction: column; justify-content: space-between;`) er `.dm-pad-grid` læst við **`max-height: 156px`** ([`action-ui.css`](../../public/action-ui.css#L1980))!
   - Samtals taka hausinn (`~22 px`), 3×3 takkaborðið (`156 px`) og neðri hnapparöndin (`~32 px`) aðeins **`210 px`**, sem skilur eftir **`~386 px` (65% af Navigation-spjaldinu!) sem tómt dökkt bil** á milli hausins, takkaborðsins og neðri hnappanna!
   - Sama vandamál sést við `1440×900` (`#dm-movement-deck` er `484 px` hátt með `~274 px` tómu bili) og `1280×800` (`404 px` hátt með `~194 px` tómu bili).
2. **Utan um aðalgrindina (`.dm-shell`) við `1920×1080`:**
   - `.dm-shell` er með `max-width: 1540px; margin: 0 auto;`. Við `1920×1080` eru því **`194 px` af auðu svörtu plássi vinstra megin og `194 px` hægra megin (`388 px` = 20,2% af skjábreiddinni)**, á meðan 1. persónu glugginn gæti nýtt breiddina mun betur.

---

### D.4 Óþarfa upplýsingaspjöld og tvítekningar (`Redundant Cards & Duplicate Readouts`)

Þrátt fyrir athugasemdir í HTML um *„Zero Duplicates“* sýnir bein talning á sýnilegum DOM-textum í Player Mode mikla tví- og margtekningu á sömu upplýsingum á sama skjá:

| Upplýsing | Fjöldi samtímis á skjá | Hvar hún birtist samtímis í Player Mode |
| :--- | :---: | :--- |
| **Átt leikmanns (`NORTH / ▲`)** | **6×** | 1) `#fp-facing-pill` (`🧭 N ▲`), 2) `#fp-fov-ahead` (`▲ N:`), 3) `.fp-vista-bar` (`Ahead (NORTH):`), 4) `#minimap-Lock-indicator` (`[7,5] • N ▲`), 5) `#compass-facing-lbl` + `#compass-needle` (`▲ Facing North`), 6) `#pad-center-lbl` (`▲ NORTH`) + `Forward (N)` |
| **Heiti reits framundan (`Ahead`)** | **3×** | 1) `#fp-fov-ahead` (`▲ N: Mirkwood Forest`), 2) `.fp-vista-bar` (`Looking toward Mirkwood Forest`), 3) `#compass-ahead-lbl` (`Ahead: Mirkwood Forest`) |
| **Núverandi hamur (`Exploration / Sanctuary / Combat`)** | **3×** | 1) `#header-mode-indicator` (`🌲 Wilderness Exploration`), 2) `#fp-state-banner` (`🌲 WILDERNESS EXPLORATION`), 3) `#action-deck-heading` (`🧭 Exploration Actions`) |
| **Stance-skipti (`Swap Stance [R]`)** | **3×** | 1) `#btn-quick-stance` (`🏹 To Ranged R`) í efri röð, 2) `#slot-off-hand` (smellanlegur off-hand reitur í efri röð), 3) `#action-slot-3` (`3/R Swap Stance`) + `#deck-stance-indicator` í hægri dálki |
| **Bakpoki (`🎒 Pack (7) [B]`)** | **2×** | 1) `#btn-quick-pack` í efri röð (`#dm-top-deck`), 2) `#util-btn-pack` í neðri röð hægri dálks (`#dm-utility-strip`) |
| **Hetjuspjald (`Hero [C]`)** | **2×** | 1) `#hud-hero-card` (`[C]`) í efri röð, 2) `#util-btn-hero` (`👤 Hero C`) í `#dm-utility-strip` |
| **Lífsdrykkir (`Potions [2]`)** | **2×** | 1) `#hud-potion-chip` (`Potions 3`) í efri röð, 2) `#action-slot-2` (`Drink Potion 3×`) í hægri dálki |
| **HP og AC mælar** | **2×** | 1) `.dm-vertical-pillars` (lóðréttir `HP`, `AC`, `XP` súlumælar), 2) `.dm-vitals-readout` (lárétt `Vitality 12/12` stika + `Armor (AC) 16` merki) — staðsett 10 px hvort frá öðru í `#dm-top-deck`! |
| **Lyklaborðsleiðbeiningar (`W/A/S/D...`)** | **4×** | 1) Á hverjum einasta hnappi (`<kbd>`), 2) Í `.fp-vista-bar`, 3) Í `.fp-chronicle-header`, 4) Í `#nav-deck-status-lbl` — auk `❓ Controls [?]` gluggans! |

---

## E. Skjáskot úr Raunverulegum Vafra (`screenshots/`)

Ný staðfestingarskjáskot úr headless Chromium (`1920×1080`) eru vistuð í [`action-ui-lab/docs/reviews/continuity/screenshots/`](screenshots/):

- `REV_01_exploration_crossroads_7_5_north.png` — Sýnir Player Mode við `[7,5] NORTH`, tvítekningar í HUD og `386 px` tóma bilið í `#dm-movement-deck`.
- `REV_02_mirkwood_trail_7_4_north_tier4_gap.png` — Sýnir samfellurofið á `[7,4] NORTH` þar sem Tier 4 generic mynd (`terrain_forest.webp`) birtist í stað `forest_7_4_north_oak_approach.jpg` og Discovery-spjaldið hylur neðri hluta senunnar.
- `REV_03_stage1_shadow_secrecy.png` — Sýnir Stage 1 (`DISCOVERED`) skuggann í þokunni og leynd yfir tegund skrímslis.
- `REV_04_monster_stirge_1080p.png` — Sýnir `TINY` fljúgandi cutout (`stirge`).
- `REV_04_monster_goblin_1080p.png` — Sýnir `SMALL` cutout (`goblin`) og hvernig `.fp-monster-hud-plate` ræður fóthæð (`79,7%`).
- `REV_04_monster_rust_monster_1080p.png` — Sýnir `MEDIUM` breitt cutout (`rust_monster`) með 5 sniðmátsskuggum.
- `REV_04_monster_ogre_1080p.png` — Sýnir `LARGE` cutout (`ogre`) þar sem höfuðið nær upp í `36%` Y vegna `.fp-monster-hud-plate`.
- `REV_04_monster_wyvern_1080p.png` — Sýnir `LARGE` fljúgandi cutout (`wyvern`).
- `REV_04_monster_choker_1080p.png` og `REV_04_monster_hobgoblin_1080p.png` — Sýna `CARD` fallback skrímsli svífa í miðju lofti (`56–60%` Y) með skugga í lausu lofti.
