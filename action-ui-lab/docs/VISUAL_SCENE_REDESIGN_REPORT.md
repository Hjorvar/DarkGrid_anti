# Darkgrid Action UI Lab — Endurhönnun á 1. persónu senukerfi (Visual Scene Redesign Report)

**Dagsetning:** 20. október 2026  
**Umhverfi:** `action-ui-lab/` (`http://localhost:3100`) — einangrað tilraunaumhverfi (án áhrifa á aðalforrit í `src/`).

---

## 1. Greining á núverandi myndrænum göllum (Root-Cause Analysis)

Í handvirkum prófunum á `action-ui-lab` komu fram sex skýrir myndrænir og upplifunarlegir gallar (`V1`–`V6`). Hér er nákvæm rótargreining á hverjum þeirra í eldra kerfinu (`LEGACY` mode):

### V1: Tvöfaldur myndbræðingur („Double-Exposure“ / tvær myndir ofan á hvor annarri)
- **Tæknileg rót:** Í [`action-ui-lab/public/index.html`](../public/index.html) og [`action-ui-lab/public/action-ui.css`](../public/action-ui.css) voru tvö myndlög teiknuð samtímis í `#viewport-frame`:
  1. `#vp-backdrop` (`z-index: 1`) sýndi mynd núverandi reits (`current.imageUrl`).
  2. `#vp-ahead-portal` (`z-index: 2`) sýndi mynd næsta reits framundan (`ahead1.imageUrl`) með `opacity: 0.72` og radial maska (`mask-image: radial-gradient(ellipse 48% 44% at 50% 42%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 58%, transparent 82%)`).
- **Afleiðing:** Tvær fullgerðar 2D landslagsmyndir með ólíkum sjóndeildarhring, ólíkri lýsingu og ólíku sjónarhorni runnu saman í miðjunni. Á **The Old Stone Bridge (8,7)** þegar horft var í austur sást t.d. steinbrú utandyra í jaðrinum en dimm neðanjarðarhvelfing (`terrain_underground_ruins.webp`) svífandi eins og draugkennd kúla í miðri brúnni.

### V2: Viðvaningslegar SVG-vektorlínur ofan á handmálað listaverk
- **Tæknileg rót:** Lagið `#vp-corridor-svg` (`z-index: 4`) teiknaði flatar, harðar SVG-flötungamyndir (`#svg-ground-path`, `#svg-left-mountain`, `#svg-right-water`, `#svg-left-trees`, `#svg-horizon-wall`) beint ofan á handmálaðar dark-fantasy myndir.
- **Afleiðing:** Gróf þríhyrningsfjöll (`polygon`), bláir vatnsborðar og trapisulaga vegir stönguðust harkalega á við „weathered painterly concept art“ stíl Darkgrid (sbr. [`docs/game-ui-style.md`](../../docs/game-ui-style.md)).

### V3: Röng mynd og ósamræmi milli texta og myndar á Bridge East Watchpost (9,7)
- **Tæknileg rót:** Í `action-ui-lab/seed-lab.js` er reitur `(9,7)` skilgreindur sem:
  - `name = 'Bridge East Watchpost'`
  - `terrain = 'UNDERGROUND_RUINS'`
  - `feature = 'BRIDGE_WATCHPOST'`
  - `description = 'Crumbling stone watchtower ruins at the eastern end of the Old Stone Bridge, overlooking the Blackwater River.'`
  Eldra kerfið varpaði öllum reitum með `terrain = 'UNDERGROUND_RUINS'` beint á `/images/terrain/terrain_underground_ruins.webp` (innandyra dýflissuhvelfingu með súlum og kyndlum).
- **Afleiðing:** Leikmaður sem gekk yfir brúna út í rústir varðturns á árbakkanum upplifði skyndilega að hann væri kominn djúpt ofan í lokaða neðanjarðarkryptu, í fullri mótsögn við bæði staðsetningu og textalýsingu.

### V4: Einleit endurtekning í skógi og á sléttum (Monotonous Repetition)
- **Tæknileg rót:** Eldra `TERRAIN_VISUALS` í `server.js` hafði aðeins **eina** mynd á hverja landslagstegund (`FOREST` -> `terrain_forest.webp`, `PLAINS` -> `terrain_plains.webp`). Eina tilbrigðið á milli reita var örlítið CSS `scale(1.04)` og `translateX(±2%)` út frá `(x, y)` hnitum.
- **Afleiðing:** Allir skógarreitir (`7,5`, `7,4`, `7,3`, `6,4`, `6,3`, `8,4`, `9,4`) og allir sléttureitir litu nánast nákvæmlega eins út. Leikmaður fékk enga sjónræna tilfinningu fyrir því að ferðast á milli ólíkra kennileita (t.d. frá *Mirkwood Crossroads* að *Heart of the Mirkwood*).

### V5: Hindrunar-overlay (`BLOCKED`) skyggði á skrímsli og skapaði ósamræmi í bardaga
- **Tæknileg rót:**
  1. Í `LEGACY` mode teiknaði `#vp-corridor-svg` risastóran SVG-fjallavegg (`#svg-blocked-wall`) yfir miðjan skjáinn (`y: 120..365`) þegar `ahead1` var ófær reitur (`MOUNTAINS`, `RIVER`, `OCEAN`). Í bardaga lenti þessi veggur beint á bak við/yfir skrímslinu og nafnspjaldi þess (`#vp-encounter-stage`).
  2. Ef sena skipti yfir í mynd af ófærum fjallstindi (`ahead1`) á meðan leikmaður var í miðjum bardaga á skógarreit (`7,5` *Mirkwood Crossroads* með stefnu `WEST` að `6,5` *Stonefang Crag*), þá birtist skógarskrímslið (*Creeping Vine* / *Briar Wolf*) skyndilega uppi á berum fjallakletti í stað þess að vera í skóginum þar sem bardaginn átti sér stað.

### V6: Lab Director Bar klipptist af í venjulegri skjábreidd
- **Tæknileg rót:** `.lab-director-bar` í `action-ui.css` var með fasta hæð (`height: 36px`), `overflow: hidden` og `white-space: nowrap`.
- **Afleiðing:** Um leið og glugginn var `<= 1600px` á breidd klipptust hnapparnir hægra megin (`Reset` og `Class: Fighter / Ranger / Cleric`) út af skjánum.

---

## 2. Hönnun nýs senukerfis (`action-ui-lab/scene-catalog.js`)

Til að leysa `V1`–`V5` frá grunni var hannað nýtt gagnadrifið senukerfi í [`action-ui-lab/scene-catalog.js`](../scene-catalog.js) sem keyrir ofan á SQLite gagnagrunn tilraunastofunnar (`action-ui-lab/db/action-lab.sqlite`).

### Meginregla: Ein heildstæð mynd í einu (Single Coherent Painting Principle)
Í bæði **Útfærslu A** og **Útfærslu B** er eftirfarandi reglu framfylgt:
- **`useAheadPortal: false`** — `#vp-ahead-portal` er alveg slökkt (`display: none`). Engar tvær myndir eru lengur bræddar saman með radial-maska.
- **`useLegacySvg: false`** — `#vp-corridor-svg` er alveg slökkt (`display: none`). Engar flatar SVG-vektorlínur eru teiknaðar ofan á málverkin.
- Í staðinn er **ein** vönduð 2D mynd (`imageUrl`) birt í `#vp-backdrop` með fíngerðri CSS-litastillingu (`#vp-atmo-grade`), mjúkum jaðarskuggum (`#vp-edge-left`, `#vp-edge-right`) sem gefa hliðartilfinningu án þess að skemma myndina, og hnitmiðuðum texta-vísbendingum í HUD (`#vp-horizon-pill` við jaðar gólfs og `◀ N • ▲ E • ▶ S` í efra vinstra horni).

### Gagnagrunnstöflur í `action-lab.sqlite`
1. **`lab_scene_variants` (21 myndbrigði):**
   Geymir öll myndbrigði (`variant_key`, `terrain_group`, `subregion_key`, `landmark_key`, `title`, `subtitle`, `image_url`, `css_filter`, `css_transform`, `atmosphere_tint`, `is_interior`).
2. **`lab_tile_scene_overrides` (18 hnitabundnar sérstillingar):**
   Geymir nákvæma tengingu fyrir lykilreiti á kortinu `(x, y)` við tiltekið `preferred_variant_key`, `subregion_key`, `landmark_key`, `custom_title` og `custom_subtitle`.
3. **`lab_directional_overrides` (11 stefnubundnar sérstillingar fyrir Útfærslu B):**
   Skilgreinir hvaða mynd og lýsing skuli birtast þegar horft er úr `(from_terrain, from_feature)` yfir í `(to_terrain, to_feature)` í ákveðna átt (`facing`), t.d. þegar horft er í vestur af brúnni `(8,7)` eða varðturninum `(9,7)` til baka að Oakhaven.

---

## 3. Samanburður á Útfærslu A og Útfærslu B (og Legacy)

Í **Lab Director Bar** efst á skjánum er nú hægt að skipta samstundis á milli þriggja birtingarhátta (`Scene Mode: A: Single Scene | B: Directional | Legacy`) til að bera þá saman á hvaða reit og í hvaða átt sem er.

| Eiginleiki | **Útfærsla A: Single Scene (Place-Centric)** | **Útfærsla B: Directional Scene (Vista-Centric)** | **Legacy (Eldra kerfi)** |
| :--- | :--- | :--- | :--- |
| **Meginhugmynd** | Myndin sýnir **staðinn sem hetjan stendur á** (`current` tile). | Myndin sýnir **útsýnið í þá átt sem hetjan horfir** (`ahead1` eða stefnubundið kennileiti). | Tvær myndir lagðar saman (`current` + `ahead1` radial portal) + SVG-línur. |
| **Hegðun við 90° snúning (`Q`/`E`)** | Aðalmynd helst stöðug (staðurinn breytist ekki þótt þú lítir til hliðar, nema horft sé beint á ófæran vegg utan bardaga). Stefnuupplýsingar uppfærast í `#vp-horizon-pill` og HUD. | Aðalmynd skiptir í hvert sinn sem hetjan snýr sér (`N`, `E`, `S`, `W`) til að sýna hvað blasir við framundan. | Miðju-kúlan (`#vp-ahead-portal`) og SVG-form breytast við snúning, en jaðarinn helst sá sami. |
| **Tenging við bardaga (`IN_COMBAT`)** | **100% rökrétt:** Skrímslið birtist alltaf í því umhverfi þar sem hetjan stendur og berst (t.d. í skóginum á `7,5`, jafnvel þótt hetjan snúi í vestur að fjalli). | Ef hetjan stendur í skógi (`7,5`) en horfir í suður að Oakhaven (`7,6`), þá birtist skógarskrímslið fyrir framan bæjarhlið Oakhaven. | SVG-hindranir og radial-blöndun trufla skrímslið í miðju rammans. |
| **Áttarskynjun (Spatial Navigation)** | Góð — leikmaður veit alltaf nákvæmlega á hvers konar reit hann er staddur, og sér í `#vp-horizon-pill` hvað er framundan (`Ahead: The Old Stone Bridge`). | Framúrskarandi við landkönnun — þegar staðið er á krossgötum (`7,5`) eða brú (`8,7`) sér leikmaður bæjarhliðið í suðri/vestri, skóginn í norðri og fjallið í vestri. | Ruglingsleg vegna „double-exposure“ myndbræðings. |
| **Þörf fyrir myndasafn (Asset Cost)** | Hófleg — krefst góðra mynda fyrir hvern stað/undirsvæði (`O(N)` eftir reitum/kennileitum). | Mikil ef gera á fullkomlega — krefst stefnumynda fyrir samsetningar af `(frá-reit, til-reits, átt)` svo myndir endurtaki sig ekki óeðlilega. | Lítil, en myndrænt óviðunandi. |

---

## 4. Lýsing á breytingum á myndasafni og gagnatengingum

Bætt var við **8 nýjum handmáluðum dark-fantasy senumyndum** (`.webp` í `public/images/terrain/`) og þær tengdar við 21 senubrigði í [`action-ui-lab/scene-catalog.js`](../scene-catalog.js):

1. **`scene_oakhaven_gate.webp`** (`town_oakhaven_gate`):
   - Notuð fyrir **Oakhaven North Gate (7,6)** og þegar horft er í suður frá **Mirkwood Crossroads (7,5)** í Mode B. Sýnir timburvirkisvegg, varðturn og járngrindarhlið Oakhaven í stað almennrar götumyndar.
2. **`scene_bridge_east_watchpost.webp`** (`watchpost_exterior_ruins`):
   - **Lagar V3:** Notuð fyrir **Bridge East Watchpost (9,7)** og þegar horft er í austur af **The Old Stone Bridge (8,7)** í Mode B. Sýnir hrundar steinveggjarústir og gotneskan boga **utandyra** á klettabakkanum yfir ánni, í fullu samræmi við textalýsingu reitsins.
   - Innandyra dýflissumyndin (`terrain_underground_ruins.webp`, `underground_crypt_vault`) er nú **eingöngu** notuð fyrir raunverulegar neðanjarðarrústir eins og **Sunken Crypt Entrance (9,8)**.
3. **`scene_bridge_looking_west.webp`** (`bridge_looking_west_oakhaven` / `watchpost_looking_west_bridge`):
   - Notuð í Mode B þegar horft er í vestur af **The Old Stone Bridge (8,7)** eða **Bridge East Watchpost (9,7)** til baka yfir ánna í átt að virkisveggjum og ljóskerinum í Oakhaven.
4. **`scene_forest_monolith.webp`** (`forest_monolith_clearing`):
   - Notuð fyrir **Mirkwood Crossroads (7,5)** (`WOOD_CLEARING`) — mosavaxinn rúnasteinn á skógarkrossgötum.
5. **`scene_forest_ancient_oak.webp`** (`forest_ancient_oak`):
   - Notuð fyrir **Heart of the Mirkwood (7,3)** (`ANCIENT_OAK`) — risavaxin, hol forn-eik í þokukenndu rjóðri.
6. **`scene_plains_watchtower.webp`** (`plains_watchtower_hill`):
   - Notuð fyrir **Old Watchtower (8,6)** (`WATCHTOWER`) — gamall varðturn á hæð yfir sléttunni.
7. **`scene_plains_milestone.webp`** (`plains_East_road` / `plains_south_farmland`):
   - Notuð fyrir **Verdant Plains (8,8)** og suðurhluta sléttunnar — forn vegvísissteinn við moldarveg.
8. **`scene_marsh_sunken_shrine.webp`** (`swamp_sunken_shrine`):
   - Notuð fyrir **Whispering Marsh (6,8)** (`SUNKEN_SHRINE`) — hálfsokkið steinmustari í fenjunum.

### Fjölbreytni í Mirkwood Forest (Lagar V4)
Þegar gengið er um skógarreitina í kringum Oakhaven fær hver reitur nú sitt eigið auðþekkjanlega sjónræna yfirbragð:
- **`(7,5)` Mirkwood Crossroads:** `forest_monolith_clearing` (`scene_forest_monolith.webp`) — rúnasteinn á krossgötum.
- **`(7,4)` Deep Mirkwood — Tangled Boughs:** `forest_tangled_boughs` (`terrain_forest.webp` með djúpum mosatón) — þéttur, dimmur skógarstígur.
- **`(7,3)` Heart of the Mirkwood:** `forest_ancient_oak` (`scene_forest_ancient_oak.webp`) — hin forna tröllaukna eik.
- **`(6,4)` Western Mirkwood — Pine Ravine:** `forest_pine_ravine` — kaldara klettagil við fjallsrætur Stonefang Crags.
- **`(8,4)` Eastern Mirkwood — Mossy Eaves:** `forest_eastern_eaves` — bjartari skógarjaðar nær sléttunni í austri.

---

## 5. Lagfæring á Lab Director Bar (`V6`)

Í [`action-ui-lab/public/index.html`](../public/index.html) og [`action-ui-lab/public/action-ui.css`](../public/action-ui.css) var `.lab-director-bar` endurhannaður:
- Fjarlægð föst hæð (`height: 36px; overflow: hidden`) og sett `min-height: 36px; height: auto; flex-wrap: wrap; row-gap: 4px; padding: 4px 12px`.
- Bætt við nýjum **Scene Mode** rofahópi (`A: Single Scene`, `B: Directional`, `Legacy`) við hlið **Monster Mode** (`Hybrid`, `Blend`, `Frame`).
- Allir hnappar í stjórnstikunni (`Scene`, `Monster`, `Scenario` forstillingar, `Reset` og `Class: Fighter / Ranger / Cleric`) eru nú **100% sýnilegir, óklipptir og smellanlegir** í öllum prófuðum upplausnum (`1920x1080`, `1600x900` og `1280x720`).

---

## 6. Prófanir og skjáskot (Automated Tests & Browser Verification)

### Sjálfvirk próf (`node --test`)
- **`action-ui-lab/tests/action-lab.test.js`:** 12 heildarpróf (integration tests) keyra gegn SQLite gagnagrunninum og staðfesta:
  - Skil á `sceneMode`, `activeScene` og `scenes: { A, B, LEGACY }`.
  - `SET_SCENE_MODE` skiptir rétt á milli `A`, `B` og `LEGACY`.
  - Aðskilnað á **Bridge East Watchpost (9,7)** (`watchpost_exterior_ruins` utandyra) og **Sunken Crypt Entrance (9,8)** (`underground_crypt_vault` innandyra).
  - Að Mirkwood skógarreitirnir `(7,5)`, `(7,4)`, `(7,3)` og `(6,4)` skili ólíkum `variantKey`.
  - Að 360° snúningur (`N`, `E`, `S`, `W`) á `(7,5)` uppfæri bæði Mode A og Mode B rétt.
  - Að Stage 1 (óþekkt ógn) og Stage 2 (bardagi) haldist óskyggð og rétt staðsett í umhverfinu.
- **Aðalpróf (`npm test`):** Öll 48 próf í aðalforritinu standast án breytinga.

### Skjáskot úr raunverulegum vafra (`action-ui-lab/docs/screenshots/visual-redesign/`)
Öll 21 skjáskot voru tekin í Chromium og skoðuð myndrænt:
- **Oakhaven (7,7):** `01-oakhaven-legacy.png`, `01-oakhaven-modeA.png`, `01-oakhaven-modeB.png`
- **The Old Stone Bridge (8,7):** `02-bridge-east-legacy.png` (sýnir gamla double-exposure gallann), `02-bridge-east-modeA.png`, `02-bridge-east-modeB.png`, `02-bridge-west-modeB.png`
- **Bridge East Watchpost (9,7):** `03-watchpost-east-modeA.png`, `03-watchpost-west-modeB.png`
- **Fjölbreytni í Mirkwood Forest:** `04-forest-7-5-crossroads-modeA.png`, `04-forest-7-4-deep-boughs-modeA.png`, `04-forest-7-3-ancient-oak-modeA.png`
- **Ófær fjallaveggur & 360° snúningur á (7,5):** `05-crossroads-west-crag-legacy.png`, `05-crossroads-west-crag-modeA.png`, `05-crossroads-north-modeB.png`, `05-crossroads-east-modeB.png`, `05-crossroads-south-modeB.png`, `05-crossroads-west-modeB.png`
- **Encounter Stage 1 & Stage 2:** `06-stage1-shadow-modeA.png`, `07-combat-vine-modeA.png`
- **Upplausnarpróf (`1920x1080`, `1600x900`, `1280x720`):** `08-res-1920x1080.png`, `08-res-1600x900.png`, `08-res-1280x720.png`

---

## 7. Endanleg rökstudd tillaga (Final Recommendation)

Eftir ítarlegan samanburð á **Útfærslu A (Single Scene)** og **Útfærslu B (Directional Scene)** í raunverulegri spilun er niðurstaðan skýr:

> **Tillaga: Notið Útfærslu A (Single Scene — Place-Centric) sem sjálfgefinn grunn (default), með völdum stefnumiðuðum „Landmark Overrides“ úr Útfærslu B á lykilsjónarhornum (Controlled Hybrid).**

### Rökstuðningur:
1. **Stöðugleiki og staðartilfinning (Spatial Grounding):**
   Í **Útfærslu A** upplifir leikmaðurinn tafarlaust *hvar hann er staddur*. Þegar hann gengur inn á **The Old Stone Bridge (8,7)** sér hann brúna; þegar hann gengur inn á **Bridge East Watchpost (9,7)** sér hann varðturnsrústirnar; þegar hann kemur í **Heart of the Mirkwood (7,3)** stendur hann frammi fyrir hinni fornu eik.
2. **Fullkomið samræmi í bardaga (Combat Coherence):**
   Í **Útfærslu A** á bardagi sér alltaf stað í réttu umhverfi núverandi reits. Í hreinni **Útfærslu B** getur leikmaður staðið í miðjum skógi (`7,5`) en snúið í suður að bæjarhliði Oakhaven (`7,6`), og þá birtist skógarskrímslið fyrir framan bæjarhliðið.
3. **Skalanleiki myndasafns (Asset Scalability):**
   **Útfærsla A** skalar línulega með fjölda undirsvæða og kennileita (`O(N)`), á meðan hrein **Útfærsla B** krefst margfalt fleiri sérteiknaðra millimynda (`frá-reit -> til-reits` í 4 áttir) til að forðast að leikmaður sjái „næsta reit“ áður en hann stígur inn á hann.
4. **Hvar Útfærsla B skín (og hvernig má nýta hana sem Controlled Hybrid):**
   Á opnum útsýnisstöðum — eins og þegar staðið er á **The Old Stone Bridge (8,7)** og horft til vesturs að Oakhaven (`scene_bridge_looking_west.webp`) eða til austurs að Watchpost (`scene_bridge_east_watchpost.webp`), eða þegar horft er beint á ófæran fjallavegg (`Stonefang Crags`) — gefur stefnuvirkni **Útfærslu B** ótrúlega flotta dýpt. Í núverandi útfærslu höfum við þegar innbyggt þessa hegðun í **Útfærslu A** fyrir ófæra veggi (þegar ekki er í bardaga) og gert báðar útfærslur (`A` og `B`) aðgengilegar með einum smelli í **Lab Director Bar** svo hægt sé að prófa þær hlið við hlið.
