# Darkgrid — Heildarúttekt, Leikjahönnunargreining og Tillögur að Umbótum
*(Complete Game Review & Improvement Proposals)*

**Dagsetning úttektar:** 13. október 2026  
**Úttektaraðilar (Hlutverk):** Senior Game Designer, Senior UI/UX Designer & Senior Software Architect  
**Umfang:** Kóetagrunnur (`src/`), gagnagrunnur og migrations (`db/`), prófanir (`tests/`), öll hönnunarskjöl (`.agents/`, `docs/`) og lifandi viðmót (`src/views/`, `public/css/style.css`).

> **Skýring á merkingum í skýrslunni:**
> - **[STAÐFEST Í KÓÐA / GAGNAGRUNNI]:** Staðreynd sem er sannreynd beint í frumkóða, SQL-töflum eða með sjálfvirkum prófunum.
> - **[HÖNNUNARGREINING / ÁLYKTUN]:** Faglegt mat á leikjaupplifun, sálfræði spilara, stærðfræðilegri hegðun eða framtíðaráhættu byggt á staðfestum gögnum.

---

## 1. Executive Summary (Samantekt)

**Darkgrid** er komið á óvenju sterkan stað fyrir ungt indie RPG-verkefni. Kjarnahugmyndin — textamiðað dark fantasy single-player RPG með *permadeath* og *shared-world* afleiðingum þar sem skrímsli erfa líf, gull og búnað látinna hetja — er skýr, spennandi og hefur sterka sjálfsmynd. Tæknilegur grunnur (Node.js 24, innbyggt `node:sqlite`, hrein skipting milli `src/domain/` og `src/routes/`, 100% transaction-tryggðar breytingar) og sjónrænn grunnur (*Cinzel* letur, *Burnished Gold* & *Obsidian Void* litapalletta, 68 handmálaðar skrímslamyndir ásamt sigruðum útgáfum og 14 landslagsmyndum) eru í hæsta gæðaflokki.

Þrátt fyrir þennan sterka grunn sýnir djúpstæð rannsókn á kóða og gagnagrunni að **leikurinn þjáist núna af alvarlegu misræmi milli gagnagrunns/innihalds annars vegar og raunverulegra leikjareglna/korts hins vegar**:

1. **Óaðgengilegt efni (Dead Content) og „Gildrur“ í Character Creation [STAÐFEST Í KÓÐA / GAGNAGRUNNI]:**
   - Af 68 skrímslum í gagnagrunninum geta **11 skrímsli (16%) aldrei birst í leiknum** (*Drow, Duergar, Mummy, Skeletal Champion, Phase Spider, Cloaker, Darkmantle, Iron Cobra, Morlock, Giant Crab, Sahuagin*) vegna þess að heimkynni þeirra (`UNDERGROUND_RUINS`, `DESERT`, `COAST`, `MOUNTAINS`, `OCEAN`, `RIVER_LAKE`) eru annaðhvort ekki til á 15×15 kortinu eða eru ófær (`is_passable = 0`).
   - Í Character Creation getur Ranger valið **Humanoid (Drow)** eða **Humanoid (Duergar)** sem *Favored Enemy* (`src/views/create-character.ejs:85-86`) — skrímsli sem er bókstaflega ómögulegt að hitta í leiknum.
   - Af 53 töfrahlutum í gagnagrunninum geta **35 töfrahlutir (66%) aldrei fallið sem loot** í leiknum: 26 töfrahlutir eru ekki í neinni `loot_table_entries` töflu, og **9 bestu hlutir leiksins** (þar á meðal *ALLIR Legendary hlutir*: `Holy Avenger +3`, `Oathbow +3`, `Crown of the Sunken King`, `Full Plate +2` og `Draught of Troll's Blood`) eru eingöngu í `DRAGON_HOARD` (`creature_type = 'DRAGON'`), en **það er ekkert Dragon-skrímsli til í `monsters` töflunni!**
2. **Stærðfræðilegt ójafnvægi í eiginleikum (Stats) og vopnum [STAÐFEST Í KÓÐA]:**
   - `INT` (Intelligence) og `CHA` (Charisma) hafa **engin áhrif** hvergi í kóðanum (`src/domain/character/rules.js`, `src/domain/combat/rules.js`). Í point-buy kerfinu er alltaf rétt að lækka INT og CHA um -2 hvort til að fá +4 aukastig í STR/DEX/CON/WIS.
   - Bogfimi (*Ranged*) leggur fullan `STR` bónus við skaða (`getHeroDamageFormula` í `src/domain/combat/rules.js:228-235`), notar sama árásarbónus og návígi (`floor((strMod + dexMod)/2)`), hefur ótakmarkaðar örvar, engin víti í návígi, hittir fljúgandi skrímsli (`FLY`) og gefur Ranger frítt *Opening Shot*. Þetta gerir `RANGED` yfirburðaval (strictly dominant) um leið og skjöldur er ekki notaður.
3. **Einhæfir bardagar og ónýtt sérkenni skrímsla [STAÐFEST Í KÓÐA]:**
   - Skrímsli í gagnagrunni geyma 106 sérhæfileika í `special_abilities` (t.d. *poison, web, constrict, regeneration, paralysis*), en bardagavélin (`src/domain/combat/engine.js`) hunsar þá alla (nema `FLY` og `UNDEAD`). Öll 68 skrímslin hegða sér því nákvæmlega eins í bardaga: eitt d20 árásarkast og eitt skaðakast.
4. **Falinn kjarni leiksins (Persistent Monsters sjást ekki í tæka tíð) [STAÐFEST Í KÓÐA]:**
   - Þegar spilari rekst á *Persistent Monster* (skrímsli sem hefur drepið fyrri hetju og geymir gull/loot hennar) í Stage 1 (`DISCOVERED`) eða í sjálfum bardaganum (`IN_COMBAT`), þá **sýnir `src/views/game.ejs` enga vísbendingu** um að þetta sé Hero-Slayer né hvaða titil (`custom_title`, t.d. *„Slayer of Hero“*) skrímslið ber! Spilarinn kemst ekki að því fyrr en á Victory-skjánum *eftir* bardagann. Auk þess eru persistent skrímsli alltaf sjálfkrafa uppgötvuð (`spotted_by_hero = 1` í `src/domain/encounters/engine.js:216-218`), sem gerir þau ófær um fyrirsát (*ambush*).

Í þessari skýrslu er farið ítarlega yfir alla þætti leiksins, bent á hvernig má laga þessi vandamál með hreinum og einföldum hætti, og lagðar fram **14 nýjar hugmyndir** og **forgangsröðuð framkvæmdaáætlun (P1–P3)** sem lyfta Darkgrid upp á næsta stig án þess að flækja kerfið.

---

## 2. Current State of Darkgrid (Núverandi staða verkefnisins)

Greining á milli þess sem er **fullútfært**, þess sem er **aðeins til í gögnum/áætlun**, og þess sem **vantar**:

| Kerfishluti | Fullútfært í kóða og virkt (Verified Implemented) | Aðeins í gögnum / Hálfklárað (Seeded / Partial) | Vantar / Óútfært (Missing) |
| :--- | :--- | :--- | :--- |
| **Auth & Account** | Skráning, innskráning, `scrypt` lykilorðadulkóðun, CSRF vörn, rate-limiting á `/auth`, session-stýring (`src/domain/auth/`, `src/middleware/`). | `express-session` notar `MemoryStore` í minni (týnist við endurræsingu þjóns). | Varanleg session-geymsla í SQLite; sjálfvirk hreinsun á `authAttempts` minnis-Map. |
| **Character & Classes** | 3 stéttir (`FIGHTER`, `RANGER`, `CLERIC`), point-buy kerfi (+3 stig, max ±2 per stat), Level 1–10 (`FAST_XP_TABLE`), stéttarhæfileikar á L1/L3/L5 (`src/domain/character/rules.js`). | `INT` og `CHA` eru í gagnagrunni og UI en hafa **0 áhrif** í reglum. L6–L10 gefa aðeins HP, enga nýja stéttarhæfileika. | Virkni fyrir `INT` og `CHA`; stéttarhæfileikar á Level 7 og 10; vörn gegn ónýtum *Favored Enemy* valkostum. |
| **Heimskort & Exploration** | 15×15 kort (225 reitir, 162 færir, 63 ófærir), Oakhaven (`7,7`), 5×5 minimap, 14 landslagsmyndir (`src/domain/world/`). | 6 landslagstegundir í `map_tiles` (`MOUNTAINS`, `OCEAN`, `RIVER_LAKE`, `DESERT`, `COAST`, `UNDERGROUND_RUINS`) eru ýmist ófærar eða ekki á kortinu. | *Fog of War* / könnunarsaga reita; örnefni/landmarks með virkni; takmörkun á ókeypis „Town-Gate Farming“ við Oakhaven. |
| **Encounters & Skrímsli** | Gaussian skrímslaval ($\sigma=1.5$), fjarlægðarþak frá Oakhaven, 3ja þrepa textalýsingar (`1_distant`, `2_close`, `3_combat`), 68 skrímslamyndir + 68 sigraðar myndir (`src/domain/encounters/engine.js`). | **11 af 68 skrímslum geta aldrei birst** vegna landslagssíu. Hámarks `solo_level` í DB er **5** (CR 5), þótt hetjur nái Level 10. | Skrímsli fyrir Level 6–10; tenging `UNDERGROUND_RUINS` / `MOUNTAINS` / `COAST` við færa reiti á kortinu. |
| **Bardagakerfi (Combat)** | 3 aðgerðir (`Attack`, `Drink Potion`, `Flee`), d20 frumkvæði, árásar- og skaðaköst, 2x/3x/4x crits, 9 falin HP-ástandsstig, sjálfvirk Cleric lækning eftir bardaga (`src/domain/combat/`). | 106 `special_abilities` í `monsters` töflu og 6 buff/offensive drykkir (`Potion of Barkskin`, `Bull's Strength`, o.fl.) eru merktir `inactive: 1`. | Taktískar ákvarðanir í bardaga (t.d. skipta um vopn, varnarstaða); virkni fyrir sérhæfileika skrímsla og buff-drykki. |
| **Items, Loot & Economy** | 113 hlutir í DB, 9 búnaðarhólf, 50 hluta bakpoki, Oakhaven markaður + *Global Magical Resale Market* (`src/domain/economy/shop.js`, `src/domain/combat/loot.js`). | **26 töfrahlutir vantar í `loot_table_entries`**. `DRAGON_HOARD` (9 hlutir, þ.m.t. allir 3 Legendary hlutir) krefst `DRAGON` skrímslis sem er ekki til. | Aðgengi að öllum 113 hlutum í gegnum loot-töflur eða markað; samanburður (diff) á búnaði í UI. |
| **Permadeath & Persistence** | 1 lifandi hetja á reikning (`one_living_character_per_user`), skrímsli erfir 50% gulls/búnaðar og fær +10% HP + titil, hefndarskjár (`victory.ejs`) og minningarskjár (`fallen.ejs`). | Persistent skrímsli sjást **ekki** á minimap, fá **enga** sérstaka merkingu í `DISCOVERED` eða `IN_COMBAT`, og geta **aldrei** gert ambush. | Sýnileiki Hero-Slayer skrímsla á korti og í bardaga; *Hall of the Fallen* minningarskrá fyrir lifandi spilara. |

---

## 3. What Already Works Well (Það sem er nú þegar vel gert)

Áður en farið er í gagnrýni er mikilvægt að draga fram það sem Darkgrid gerir framúrskarandi vel — þetta eru stoðirnar sem á **ekki** að brjóta niður:

1. **Sjónræn upplifun, litapalletta og myndlist (`public/css/style.css`, `public/images/`):**
   - Samspil *Obsidian Void* (`#07090c`), *Burnished Gold* (`#c5a059`) og *Dried Blood Crimson* (`#9e2a2b`) ásamt *Cinzel* leturgerðinni skapar ekta, drungalega „grimoire“ stemningu.
   - Allar 68 skrímslamyndirnar (og 68 `_defeated.png` útgáfurnar á sigurskjánum) ásamt 14 landslagsmyndum falla ótrúlega vel að viðmótinu.
2. **„One-Screen Dashboard“ uppsetningin á Desktop (`src/views/game.ejs`, `public/css/style.css:846-895`):**
   - Þriggja dálka uppsetningin (260px Vinstri: Minimap & Áttaviti | Miðja: Umhverfi, Skrímsli & Bardagi | 280px Hægri: Vitals, Stance & 4 Modal-hnappar) rúmast á einum skjá (`100vh`) án lóðrétts skrunbars á borðtölvum. Þetta gerir leikinn hraðan, hreinan og þægilegan í spilun.
3. **Leynd yfir tölum (Hidden Monster Math) og 9-þrepa ástandslýsingar (`src/domain/combat/narrative.js`):**
   - Sú ákvörðun að birta aldrei nákvæmt HP, AC eða árásartölur skrímsla heldur lýsa ástandi þeirra með 9 stigum (*Uninjured* niður í *Near Death*) og 3 þrepa frásögnum (`1_distant`, `2_close`, `3_combat`) heldur spennunni lifandi og kemur í veg fyrir að leikurinn líti út eins og töflureiknir.
4. **Cinematic Victory & Fallen skjáir (`src/views/victory.ejs`, `src/views/fallen.ejs`):**
   - Nýi sigurskjárinn (`victory.ejs`) með sigraðri skrímslamynd, *Hero Avenged* minningarborða, Level-Up kórónu og sundurliðuðu loot-yfirliti gefur hverjum bardaga verðugan endapunkt.
5. **Gagnagrunnsaga og Transaction-öryggi (`src/db/connection.js`, `db/migrations/001_initial_schema.sql`):**
   - Notkun á `DatabaseSync` með `FOREIGN KEY = ON`, `WAL` mode og partial unique indexes (`one_living_character_per_user`, `one_active_persistent_monster_per_tile`, `one_open_encounter_per_character`) kemur í veg fyrir tvöföldun á gögnum á gagnagrunnsstigi.
   - Eftir *Core Stabilization* lotuna eru allar fjölþrepa aðgerðir (bardagaumferðir, dauði, sigur, kaup/sala, búnaðarskipti) pakkaðar í `BEGIN IMMEDIATE ... COMMIT` transactions.
6. **Sjálfvirk prófunarsvíta (`tests/`):**
   - 22 prófunarskrár keyra í einangruðum `:memory:` gagnagrunni með 0 villum og sannreyna bæði einingar, gagnagrunnsreglur og HTTP flæði.

---

## 4. Critical Problems (Alvarlegustu vandamálin sem þarf að leysa fyrst)

Hér eru **7 alvarlegustu vandamálin** sem fundust við samanburð á kóða, gagnagrunni og leikjareglum (öll **[STAÐFEST Í KÓÐA / GAGNAGRUNNI]**):

### 4.1. 35 töfrahlutir (þ.m.t. ALLIR Legendary hlutir) geta aldrei birst í leiknum
- **Staðsetning:** `db/migrations/009_item_equipment_loot_system.sql`, `db/seeds/005_loot_tables_seed.sql`, `src/domain/combat/loot.js:230-264`, `src/domain/economy/shop.js:76-89`.
- **Sönnun í gögnum:**
  1. **9 hlutir eru eingöngu í `DRAGON_HOARD` töflunni** (`Holy Avenger +3`, `Oathbow +3`, `Crown of the Sunken King`, `Full Plate +2`, `Heavy Steel Shield +1`, `Potion of Cure Critical Wounds`, `Draught of Troll's Blood`, `Jeweled Ceremonial Dagger`, `Silk Brocade Tapestry`). Í `selectLootTable` (`src/domain/combat/loot.js:236`) krefst `DRAGON_HOARD` þess að `creature_type = 'DRAGON'`. Í `monsters` töflunni eru **0 skrímsli** með `creature_type = 'DRAGON'`. Þessir 9 hlutir geta því aldrei fallið!
  2. **26 aðrir töfrahlutir** (t.d. `Longsword +2`, `Longbow +2`, `Chain Shirt +2`, `Breastplate +2`, `Heavy Steel Shield +2`, `Cloak of Resistance +1`, `Boots of Elvenkind`, `Bracers of Armor +1` o.fl.) eru í `item_definitions` með `is_magical = 1`, en eru **ekki skráðir í neina einustu `loot_table_entries` línu**! Og þar sem verslunin í Oakhaven (`getStandardShopItems` í `src/domain/economy/shop.js:81`) selur eingöngu `WHERE is_magical = 0`, geta þessir 26 hlutir hvorki fallið af skrímslum né verið keyptir í búð.

### 4.2. 11 skrímsli (16% af bestiary) eru 100% óaðgengileg — og Ranger getur valið 2 þeirra sem Favored Enemy!
- **Staðsetning:** `db/seeds/001_initial_world.sql`, `db/seeds/003_monsters_seed.sql`, `src/domain/encounters/engine.js:118-137`, `src/views/create-character.ejs:85-86`.
- **Sönnun í gögnum:**
  - `selectCandidateMonsters` (`src/domain/encounters/engine.js:126`) síar skrímsli eftir `mt.terrain = ?` fyrir þann reit sem hetjan stígur á.
  - Á 15×15 kortinu eru aðeins 7 landslagstegundir færar (`is_passable = 1`): `FOREST` (38), `SWAMP` (35), `PLAINS` (32), `JUNGLE` (28), `HILLS` (27), `CITY` (1), `BRIDGE` (1).
  - Reitir með `MOUNTAINS` (29), `OCEAN` (13) og `RIVER_LAKE` (7) eru allir `is_passable = 0`. Landslagstegundirnar `UNDERGROUND_RUINS`, `DESERT`, `COAST`, `AQUATIC` og `EXTRAPLANAR` eru **alls ekki til á neinum reit á kortinu**.
  - Afleiðingin er sú að 11 fullgerð skrímsli með handmáluðum myndum geta aldrei birst: *Darkmantle, Giant Crab, Mummy, Iron Cobra, Skeletal Champion, Duergar, Drow, Cloaker, Phase Spider, Morlock* og *Sahuagin*.
  - Enn verra: Í `src/views/create-character.ejs:85-86` og `src/domain/character/rules.js:48-49` eru `HUMANOID:drow` og `HUMANOID:duergar` í boði sem *Favored Enemy* fyrir Ranger. Spilari sem velur þau fær **aldrei** bónusinn sinn!

### 4.3. INT og CHA eru 100% óvirkir „Dump Stats“ (Brotin stærðfræði í Character Creation)
- **Staðsetning:** `src/domain/character/rules.js:249-330`, `src/domain/combat/rules.js`.
- **Sönnun í kóða:**
  - `STR` og `DEX` stýra árás (`floor((strMod+dexMod)/2)`), skaða (`strMod`), AC (`dexMod`) og frumkvæði (`dexMod`).
  - `CON` stýrir HP við sköpun og á hverju leveli (`conMod`).
  - `WIS` stýrir skynjun (`perception`: `10 + wisMod`) og Cleric lækningu (`wisMod`).
  - `INT` og `CHA` eru **hvergi lesin** í neinni formúlu í öllum leiknum.
  - Vegna þess að spilarinn má lækka eiginleika um allt að `-2` við sköpun (`MAX_STAT_DECREASE = 2`), þá er eina rökrétta („optimal“) leiðin fyrir allar 3 stéttir að lækka `INT` um -2 og `CHA` um -2 til að fá **7 stig** (3 grunnstig + 4 úr INT/CHA) til að hámarka STR, DEX, CON og WIS. Nýir spilarar sem setja stig í INT eða CHA eru óafvitandi að refsa sjálfum sér.

### 4.4. Hero-Slayer (Persistent Monsters) eru ósýnileg í UI þar til bardaga lýkur og geta aldrei gert Ambush
- **Staðsetning:** `src/views/game.ejs:225-425`, `src/domain/encounters/engine.js:216-218`.
- **Sönnun í kóða:**
  - Þegar hetja fellur fær skrímslið `custom_title` (t.d. `Slayer of Ragnar`), +10% HP, og hirðir 50% af gulli og búnaði hetjunnar (`src/domain/monsters/persistence.js:116-143`).
  - En þegar næsta hetja kemur inn á reitinn (`DISCOVERED`) eða berst við skrímslið (`IN_COMBAT`), þá birtir `src/views/game.ejs` aðeins venjulega `encounter.monster_name`! Hvorki `custom_title`, `kill_count` né merki um að þetta sé *Persistent Hero-Slayer* er birt í `game.ejs`.
  - Í `src/domain/encounters/engine.js:216-218` stendur: `else if (defaults.isPersistent && !options.ambushRng) { spottedByHero = 1; isAmbush = 0; }`. Þetta þýðir að hættulegustu skrímsli heimsins geta **aldrei** komið spilara í opna skjöldu (*Ambush*) og gefa hverjum Ranger 100% öruggt frítt *Opening Shot*!

### 4.5. Level Cap (Level 10) vs. Monster Cap (Level 5)
- **Staðsetning:** `src/domain/character/rules.js:23-35` vs. `db/seeds/003_monsters_seed.sql`.
- **Sönnun í gögnum:**
  - Hetjur geta náð **Level 10** (`MAX_CHARACTER_LEVEL = 10` við 71.000 XP).
  - Hins vegar eru öll 68 skrímslin í gagnagrunninum á bilinu **`solo_level` 1 til 5** (`challenge_rating` 0.25 til 5.0). Ekkert skrímsli er til á `solo_level` 6, 7, 8, 9 eða 10.
  - Auk þess fá stéttirnar enga nýja hæfileika eftir **Level 5** (`src/domain/character/rules.js:762-975`). Frá Level 6 til 10 verður leikurinn of auðveldur og tilgangslaus því hetjan heldur áfram að fá HP en skrímslin staðna á Level 5.

### 4.6. Ótakmarkað „Town-Gate Farming“ við Oakhaven (`[7,7]`)
- **Staðsetning:** `src/routes/game.js:285-350`, `src/domain/encounters/engine.js:90-108`.
- **Sönnun í kóða:**
  - Að stíga inn í Oakhaven (`[7,7]`, `is_safe = 1`) endurheimtir samstundis **100% HP** og **fullar Cleric hleðslur** (`healCharges`) án nokkurs kostnaðar eða tímatakmarkana (`src/routes/game.js:306-331`).
  - Spilari getur gengið 1 skref norður á `[7,6]` (Distance 1, þar sem *maxMonsterLevel = 1*), barist við Level 1 skrímsli, stigið 1 skref suður í `[7,7]` til að fá 100% ókeypis lækningu, og endurtekið þetta endalaust án þess að kaupa einn einasta lækningadrykk eða taka nokkra áhættu.

### 4.7. Minnisleki og hliðarverkun í `lastEquipmentByCharacterId` og `MemoryStore`
- **Staðsetning:** `src/domain/character/rules.js:582-625`, `src/routes/auth.js:6`, `src/app.js:49-59`.
- **Sönnun í kóða:**
  - Í `src/domain/character/rules.js:582` er global `const lastEquipmentByCharacterId = new Map();`. Í hvert sinn sem `getCharacterEquipment` er kallað geymir það afrit af búnaði í minni svo `calculateHeroAC(character, armorItem, shieldItem, equipment)` geti lesið `ring` og `cloak` jafnvel þegar kallarinn gleymir að senda `equipment` inn! Þetta er óhrein hliðarverkun (hidden state side-effect) í annars hreinu domain-lagi.

---

## 5. Game Design Review (Úttekt á leikjahönnun)

### 5.1. Exploration (Könnun og ferðalög)
- **Er áhugavert að ferðast um heiminn?**
  - **[HÖNNUNARGREINING]:** Fyrstu 15–20 mínúturnar eru mjög stemningsríkar vegna fallegra landslagsmynda (`terrain-vista-banner`) og textalýsinga. En fljótlega áttar spilarinn sig á því að allir 162 færu reitirnir (fyrir utan Oakhaven á `7,7`) virka **nákvæmlega eins**: þú gengur inn á reit, 25% líkur eru á skrímsli, og ef ekkert skrímsli birtist er reiturinn tómur.
- **Eru nógu margar ákvarðanir og er terrain nægilega mikilvægt?**
  - **[STAÐFEST Í KÓÐA]:** Landslag (`terrain`) stýrir eingöngu tvennu: (1) hvaða skrímsli geta birst (`monster_terrains`) og (2) hvaða bakgrunnsmynd birtist (`src/domain/world/artwork.js`). Landslag hefur **engin áhrif** á hreyfingu, sjónlínu, fyrirsát (*ambush* líkur eru fastar 25% alls staðar, nema 12.5% fyrir Ranger), flóttalíkur eða bardaga.
  - Eina ákvörðunin í hverju skrefi er N / S / A / V, og við *Stage 1 (`DISCOVERED`)* hvort spilarinn velji **Investigate** eða **Ignore**.
- **Er hættan rétt stillt?**
  - **[STAÐFEST Í KÓÐA]:** Fjarlægðarþakið (`getMaxMonsterLevelForDistance` í `src/domain/encounters/engine.js:90-108`) er mjög vel hugsað:
    - Fjarlægð 0: Safe (`7,7`)
    - Fjarlægð 1–2: Max Level 1
    - Fjarlægð 3–4: Max Level 2
    - Fjarlægð 5–6: Max Level 3
    - Fjarlægð 7+: Ekkert þak (Level 1–5)
  - Hins vegar er *Ignore* í Stage 1 (`DISCOVERED`) **100% áhættulaust** (`src/routes/game.js:464-500`), svo fremi sem skrímslið hafi ekki þegar náð *Ambush* (25% líkur við innkomu á reit). Ef ekki varð ambush við innkomu getur spilarinn alltaf smellt á *Ignore* án nokkurrar hættu.
- **Hvernig getum við gert exploration meira spennandi án þess að flækja leikinn?**
  1. **Fog of War / Könnunarkort:** Geyma hvaða reiti hetjan hefur heimsótt (t.d. í JSON-reit eða töflu `character_explored_tiles`) og gefa litla XP-umbun (+10 XP) fyrir hvern nýjan reit sem hetjan kannar í fyrsta sinn.
  2. **Lifandi Landmarks á kortinu:** Nýta `feature` dálkinn í `map_tiles` (sem er nú þegar í gagnagrunninum í `001_initial_schema.sql:22` en er lítið sem ekkert notaður í leikjarökfræði!) fyrir 6–8 fasta staði á kortinu: *Ancient Shrine*, *Abandoned Watchtower*, *Sunken Crypt Entrance* (sem opnar á `UNDERGROUND_RUINS` skrímslin!), *Old Battlefield*, o.s.frv.
  3. **Áhætta við Ignore (Sneak Past):** Í stað þess að *Ignore* sé 100% sjálfvirkur flótti í hvert skipti, mætti hafa litlar líkur (t.d. 15%, lækkaðar með DEX/WIS eða Ranger) á að skrímslið taki eftir þér þegar þú reynir að laumast framhjá.

### 5.2. Combat (Bardagakerfið)
- **Eru bardagar skemmtilegir eða vantar tactical choices?**
  - **[HÖNNUNARGREINING]:** Upphaf bardagans (Stage 1 *Investigate/Ignore*, frumkvæðiskast, Ranger *Opening Shot*, *Ambush*) er spennandi. En **þegar bardaginn er hafinn (`IN_COMBAT`) breytist hann í einhæfan „button-masher“**: spilarinn smellir á `Attack` aftur og aftur þar til annaðhvort hann eða skrímslið er komið niður í lágt HP, og velur þá `Drink Potion` eða `Flee`.
  - Ástæðan er sú að `Attack` er eina sóknaraðgerðin, spilarinn getur **ekki** skipt á milli Melee og Ranged í bardaga (`isEquipLocked` læsir vopnavali í `src/views/game.ejs:818`), og skrímsli gera aldrei neitt óvænt.
- **Eru skrímsli nægilega ólík?**
  - **[STAÐFEST Í KÓÐA]:** Í gagnagrunninum eru skrímslin afar fjölbreytt á blaði (`special_abilities` inniheldur *poison, paralysis, web, constrict, pounce, blind, acid, electricity, regeneration, gaze, bleed, disease*). En í `src/domain/combat/engine.js` eru **engin** af þessum atriðum útfærð!
  - Eini munurinn á *Giant Spider*, *Goblin*, *Ogre* og *Assassin Vine* í kóðanum er HP, AC, Attack Bonus og Damage Dice (auk þess sem `FLY` neyðir Ranged og `UNDEAD` virkjar Cleric *Holy Radiance*).
- **Eru bardagar sanngjarnir þrátt fyrir permadeath?**
  - **[STAÐFEST Í KÓÐA]:** Eftir að skaðamargfaldarinn á *Critical Hits* skrímsla var lækkaður úr `3x/4x` í fast **`2x`** (`resolveMonsterCombatTurn` í `src/domain/combat/engine.js`), fækkaði ósanngjörnum „one-shot“ dauðsföllum á Level 1 verulega.
  - Engu að síður er **Flótti (`Flee`)** enn nokkuð refsandi: `attemptFlee` (`src/domain/combat/rules.js:272-298`) notar `1d20 + dexMod >= 12` (45% grunn-mistök við DEX +0), og ef flóttinn mistekst fær skrímslið fría árás. Fyrir þungbrynjaðan Fighter eða Cleric með lágt DEX er flótti oft dauðadómur.

### 5.3. Progression (Framvinda og þróun hetju)
- **Er progression of hröð eða hæg?**
  - **[STAÐFEST Í KÓÐA]:** Level 1 → 2 tekur 1.300 XP (~4–7 bardaga), Level 2 → 3 tekur 2.000 XP til viðbótar (~5–8 bardaga). Þetta er **mjög góður hraði** fyrir permadeath roguelite/RPG.
- **Finnur spilarinn fyrir því að karakterinn styrkist?**
  - **Level 1 til 5:** Já, mjög skýrt! Á Level 3 og Level 5 opnast nýir stéttarhæfileikar (`Armor Mastery`, `Weapon Specialization`, `Hunter's Mark`, `Favored Terrain`, `Holy Radiance`, `Divine Healing III`) og betri vopn/brynja bætast við.
  - **Level 6 til 10:** Nei. Eftir Level 5 fær hetjan **enga nýja stéttarhæfileika** (`src/domain/character/rules.js:762-975`), árásarbónus hækkar ekki með leveli (nema hjá Fighter á L1/L5), og engin skrímsli eru til yfir Level 5.

### 5.4. Death & Persistent World (Dauði og varanlegur heimur)
- **Er permadeath útfært á áhugaverðan hátt?**
  - **[HÖNNUNARGREINING]:** Hugmyndin um að skrímslið sem drap þig verði áfram á reitnum (`monster_instances`), fái +10% Max HP, fullt líf, titilinn *„Slayer of [Nafn]“* og geymi 50% af gullinu þínu og búnaði (`src/domain/monsters/persistence.js:116-143`) er **stórkostleg kjarnahugmynd** (í anda *Shadow of Mordor* / *Dark Souls* bloodstain í sameiginlegum heimi).
  - **Vandamálið:** Eins og bent var á í Kafla 4.4 er þetta kerfi **falið fyrir spilaranum**! Spilarinn sér ekki á kortinu hvar Hero-Slayer skrímsli halda sig, hann fær enga viðvörun í Stage 1 (`DISCOVERED`) um að skrímslið á reitnum sé *Slayer of [Hetja]*, og hann getur ekki skoðað lista yfir fallnar hetjur (*Hall of the Fallen*) eftir að hann býr til nýja hetju.
- **Er hætta á ójafnvægi eða misnotkun (Exploits)?**
  - **[STAÐFEST Í KÓÐA]:**
    1. **HP-snjóbolti (HP Snowballing):** Í `handlePlayerDeath` (`src/domain/monsters/persistence.js:70`) hækkar `newMaxHp = Math.max(1, Math.round(existingMaxHp * 1.10))` í hvert sinn sem skrímslið drepur hetju, **án nokkurs hámarks (cap)**. Ef 10 Level 1 hetjur hlaupa á sama skrímslið (viljandi eða óviljandi) vex HP þess veldisvísislega ($1.10^{10} = 2.59\times$ grunn-HP) og það fær fulla lækningu í hvert sinn.
    2. **Sjálfvirkt „Mulier-Feeding“ (Gold/Item Transfer):** Spilari getur búið til nýjar Level 1 hetjur (sem byrja með 25 gp og byrjunarbúnað), látið þær deyja viljandi gegn sama Level 1 skrímslinu rétt hjá Oakhaven, og síðan drepið skrímslið á aðalhetjunni sinni til að hirða uppsafnað gull og búnað. (Reyndar er 25 gp lágt, en byrjunarbúnaður skilar líka söluverði).

### 5.5. Replayability (Endurspilunargildi)
- **Hvers vegna ætti spilari að byrja aftur eftir dauða?**
  - Að hefna fallinnar hetju og endurheimta 50% af týnda búnaðinum sínum úr klóm *Hero-Slayer* skrímslisins er sterkasti drifkrafturinn til að byrja strax aftur.
- **Verða nýir characterar nægilega ólíkir?**
  - Stéttirnar 3 (*Fighter, Ranger, Cleric*) spila ólíkt, en **innan hverrar stéttar** eru allir karakterar nánast eins vegna þess að point-buy kerfið hefur eina augljósa bestu lausn (lækka INT/CHA í 8) og engir valkostir eru teknir við Level-Up (2–10).

---

## 6. Combat & Balance Review (Leikjareglur og stærðfræðilegt jafnvægi)

Ítarleg greining á raunverulegum formúlum í `src/domain/combat/rules.js`, `src/domain/character/rules.js`, `src/domain/combat/loot.js` og `src/domain/encounters/engine.js`:

### 6.1. Árásar- og skaðaformúlur (`STR` vs `DEX` og Melee vs Ranged)
- **Núverandi formúla í kóða (`src/domain/combat/rules.js:211-235`):**
  $$\text{Base Attack Bonus} = \lfloor \frac{\text{strMod} + \text{dexMod}}{2} \rfloor$$
  $$\text{Weapon Damage} = \text{Weapon Dice} + \text{strMod} + \text{Weapon Bonus} + \text{Class Bonus}$$
- **Greining [STAÐFEST Í KÓÐA]:**
  - Sama formúla er notuð fyrir **bæði** `MELEE` og `RANGED`!
  - Þetta þýðir að **Longbow (`1d8`, Ranged)** notar fullan `strMod` í skaða rétt eins og **Longsword (`1d8`, Melee)**.
  - Hvað græðir spilarinn á að nota `RANGED` í stað `MELEE`?
    1. Sama skaða (`1d8 + strMod`) og sama hittni (`floor((strMod+dexMod)/2)`).
    2. Getur hitt fljúgandi skrímsli (`FLY`) án þess að lenda í „Unarmed / Fists“ (`1d3`) eða neyðast til að nota veikari varaboga.
    3. Ef spilarinn er Ranger fær hann **frítt Opening Shot** áður en bardagi hefst!
    4. Engin skotfæri (arrows/bolts) klárast nokkurn tímann.
  - Eini gallinn við `RANGED` er að skjöldur (`SHIELD`) virkar ekki með tvíhendum boga (`isShieldActiveForWeapon` í `src/domain/character/rules.js:445`). En jafnvel tvíhend melee vopn (`Greatsword 2d6`, `Greataxe 1d12`) missa líka skjöldinn án þess að fá kosti bogans!
- **Niðurstaða:** `RANGED` er of sterkt miðað við `MELEE`, og vopn eins og *Crossbow* (sem í Pathfinder nota ekki STR í skaða heldur hærri tening) eða *Rapier/Dagger* (Finesse vopn fyrir DEX karaktera) hafa enga sérstöðu.

### 6.2. Jafnvægi milli stétta (Class Balance)
Við bárum saman stéttirnar þrjár á Level 1, Level 3 og Level 5 (**[STAÐFEST Í KÓÐA]** úr `src/domain/character/rules.js`):

| Þáttur | Fighter | Ranger | Cleric |
| :--- | :--- | :--- | :--- |
| **Grunn-HP (L1)** | `12 + CON` | `10 + CON` | `10 + CON` |
| **HP á Level (L2–10)** | `1d10 + CON` (meðaltal 5.5) | `1d8 + CON` (meðaltal 4.5) | `1d8 + CON` (meðaltal 4.5) |
| **Level 1 Ability** | **Martial Training:** +1 Atk, +1 Dmg með öllum vopnum. | **Opening Shot** (frí bogaskotsárás ef `spotted_by_hero=1`) + **Favored Enemy** (+2 Atk/Dmg) + **Keen Senses** (helmingar ambush líkur úr 25% í 12.5%). | **Divine Healing I:** 3 hleðslur af `1d6 + WIS` (auto-heal eftir bardaga) + **Turn Undead** (+1 Atk, +2 Dmg gegn Undead). |
| **Level 3 Ability** | **Armor Mastery:** +1 AC í brynju, +1 til viðbótar (+2 samtals) með skildi. | **Hunter's Mark:** +1 Ranged Atk, +1 Ranged Dmg; **Keen Senses II** (+2 Perception, +1 Initiative). | **Divine Healing II:** 4 hleðslur af `2d6 + WIS`; **Holy Radiance I** (+2 Atk, +3 Dmg, +1 AC gegn Undead). |
| **Level 5 Ability** | **Weapon Specialization:** Martial Training hækkar í +2 Atk, +3 Dmg; **Shield Wall** (+3 AC samtals meðArmor+Shield). | **Favored Terrain:** +2 Initiative, +1 AC, +1 Atk í Forest/Swamp/Hills/Jungle; **Deadeye** (+2 Ranged Atk/Dmg). | **Divine Healing III:** 5 hleðslur af `3d6 + WIS`; **Holy Radiance II** (+3 Atk, +4 Dmg, +3 AC gegn Undead). |

- **Mat á stéttajafnvægi [HÖNNUNARGREINING]:**
  - **Fighter** er stöðugasti „tankinn“ (allt að +3 AC á L5 með brynju og skildi, og +2 Atk / +3 Dmg gegn öllu).
  - **Ranger** er með **flesta virka hæfileika** og langbestu könnunarhæfileikana: helmingi minni líkur á Ambush, frítt *Opening Shot* í 87.5% tilvika (og 100% gegn Persistent Monsters!), og á Level 5 virkar *Favored Terrain* í **4 af 5** villtum landslagstegundum kortsins (`FOREST`, `SWAMP`, `HILLS`, `JUNGLE` — þ.e. 128 af 160 villtum reitum = **80% kortsins**!).
  - **Cleric** er með frábæra sjálfbærni (*sustain*) vegna sjálfvirkrar lækningar eftir bardaga, en **í sjálfum bardaganum** getur Cleric **ekki** notað *Divine Healing*! Í bardaga er Cleric gegn venjulegum (ekki-Undead) skrímslum bara veikari Fighter með enga bardagahæfileika. Ef Cleric lendir í erfiðum bardaga gegn t.d. *Ogre* eða *Owlbear* hjálpa 5 *Divine Healing* hleðslur honum ekkert fyrr en bardaganum er lokið.

### 6.3. Encounter Probability & Monster Scaling
- **Encounter líkur (`src/domain/encounters/engine.js`):** 25% fastar líkur á hverjum færum reit (`encounter_chance_percent = 25`).
- **Gaussian vægi (`calculateGaussianWeight`):**
  $$w = \text{spawn\_weight} \times e^{-\frac{(\text{solo\_level} - \text{targetLevel})^2}{2 \times 1.5^2}}$$
  Með $\sigma = 1.5$ hefur Level 1 hetja í fjarlægð $\ge 3$ frá Oakhaven umtalsverðar líkur (~21%) á að hitta Level 2 skrímsli, og í fjarlægð $\ge 5$ líkur á Level 3 skrímsli. Þetta skapar góða spennu, en vegna þess að spilarinn fær **enga vísbendingu í Stage 1 (`DISCOVERED`)** um hvort óþekkta skrímslið sé Level 1 *Kobold* eða Level 5 *Wraith* (nema hann þekki `1_distant` textann utanbókar), getur *Investigate* á nýju svæði verið blint happdrætti.

### 6.4. Economy, Shop & Loot Distribution
- **Byrjunargull vs. Verðlag (`src/domain/character/rules.js:241`, `db/seeds/004_items_seed.sql`):**
  - Ný hetja byrjar með **25 gp** og fær sjálfkrafa úthlutað 3 byrjunarhlutum (Melee vopn, Ranged vopn, Light Armor) sér að kostnaðarlausu (`grantStartingEquipment`).
  - `Minor Healing Potion` kostar **25 gp** (`Potion of Cure Light Wounds` kostar **50 gp**). Spilarinn getur því keypt 1 lítinn drykk strax á Level 1.
- **Global Magical Resale Market (`src/domain/economy/shop.js:265-350`):**
  - Þegar spilari selur töfrahlut í Oakhaven fær hann **40%** af `buy_price`, og hluturinn fer á *Global Magical Resale Market* á **100%** af `buy_price` (`market_listings`), þar sem aðrir spilarar (eða næsta hetja sama spilara eftir dauða!) geta keypt hann.
  - **Veikleiki [STAÐFEST Í KÓÐA]:** `getResaleMarketListings` (`src/domain/economy/shop.js:94-112`) hefur **ekkert hámark (`LIMIT`)** og **engann fyrningartíma**. Ef spilarar selja 200 algenga `+1` hluti yfir tíma, mun *Global Magical Resale Market* listinn í `game.ejs` lengjast endalaust með 200 línum af `Dagger +1` og `Shortsword +1`.

---

## 7. UI/UX Review (Útlit, viðmót og upplifun spilarans)

Við skoðuðum alla skjái (`login.ejs`, `register.ejs`, `create-character.ejs`, `game.ejs`, `victory.ejs`, `fallen.ejs`), `public/css/style.css` (3.030 línur) og skjáskotin í `screenshots/`.

### 7.1. Hvað virkar vel í núverandi UI
- **Litakerfi og letur:** *Cinzel* fyrirsagnir með gylltum blæbrigðum og WCAG-samhæfðum silfurhvítum meginmáls-texta (`#d6dae2` á `#131720`) eru bæði læsilegar og fallegar.
- **4-Modal kerfið (`Character`, `Backpack`, `Market`, `Journal`):** Að færa langa lista út úr hægri dálkinum og inn í aðgengilega glugga (`role="dialog"`, `Escape`-lokun, URL-hash stuðningur `#backpack`) hreinsaði aðalskjáinn gríðarlega vel.

### 7.2. Áþreifanleg UI/UX vandamál og tillögur að lausnum

#### 1. Enginn samanburður (Stat Comparison) þegar vopn eða brynja eru skoðuð í Backpack eða Market
- **Núverandi staða (`src/views/game.ejs:936-940, 1080-1099`):**
  - Í *Market* sér spilarinn aðeins nafn hlutar, verð (`gp`) og textalýsingu (`description`), en **ekki** `damage_dice` eða `armor_bonus` í `Standard Armory` listanum (`game.ejs:1080-1092`)! Spilari sem vill kaupa *Scale Mail* eða *Warhammer* í búðinni sér bókstaflega ekki hversu mikið `AC` eða `Dmg` hluturinn gefur nema það sé nefnt í sögutextanum!
  - Í *Backpack* sér spilarinn tölurnar (`Dmg: 1d8`, `AC+4`), en sér ekki hvort hluturinn sé betri eða verri en það sem hann er þegar með klætt (*Equipped*).
- **Nákvæm breyting:**
  - Bæta sama `.gear-item-meta` línu (`Dmg: 1d8 • Crit: 19-20/x2` eða `AC +4 • Max DEX +3`) inn í *Market* listann (`game.ejs:1088`).
  - Bæta við grænum/rauðum samanburðarvísi við hliðina á óklæddum hlutum: t.d. `(+2 AC vs. Leather Armor)` í grænu (`#68d391`) eða `(-1 AC)` í rauðu (`#fca5a5`).

#### 2. Hero-Slayer (Persistent Monster) skortir sjónræna ógn í `game.ejs`
- **Núverandi staða (`src/views/game.ejs:225-425`):**
  - Eins og kom fram í Kafla 4.4 lítur Persistent Monster út nákvæmlega eins og hvert annað skrímsli í `game.ejs`.
- **Nákvæm breyting:**
  - Þegar `encounter.monster_instance_id` er til staðar:
    - Í **Stage 1 (`DISCOVERED`)**: Bæta við dökkrauðum/gylltum viðvörunarborða: `💀 FALLEN HERO'S SLAYER DETECTED — The remnants of a slain adventurer litter the ground nearby.`
    - Í **Stage 2 (`IN_COMBAT`)**: Birta `custom_title` (t.d. **„Assassin Vine, Slayer of Skugga-Valdi“**) með gylltum/blóðrauðum hatti og ramma utan um skrímslamyndina (`.monster-art-frame.is-slayer` með `#c53030` glóð).
    - Á **5×5 Minimap**: Ef reitur innan 5×5 rammans geymir virkt `monster_instances` (`status = 'ACTIVE'`), sýna lítinn hauskúpu-vísir (`💀`) eða rauðan ramma á þeim reit á kortinu!

#### 3. Óvirkir drykkir (`Inactive Potions`) rugla spilarann í Market og Backpack
- **Núverandi staða (`src/views/game.ejs:983-997`):**
  - 6 drykkir (*Potion of Barkskin, Bull's Strength, Cat's Grace, Shield of Faith, Heroism, Elixir of Dragon's Breath, Antitoxin*) eru í gagnagrunninum. Í Backpack birtist gulur texti: `Pending implementation — effect not yet active` og óvirkur hnappur `Inactive`.
- **Af hverju þetta er slæmt UX:**
  - Ekkert brýtur „immersion“ í fantasy RPG hraðar en að finna töfradrykk og sjá tæknilega villuskilaboðið *„Pending implementation — effect not yet active“*.
- **Nákvæm breyting:**
  - Annaðhvort **(A)** virkja þessa einföldu drykki í bardagavélinni (t.d. +2 AC eða +2 Atk út bardagann tekur < 40 línur af kóða í `engine.js`), eða **(B)** fela óvirka drykki úr verslun og loot-töflum þar til þeir eru tilbúnir.

#### 4. Bardagaskjárinn (`IN_COMBAT`) skortir sjónrænan púls og skýrari stöðu hetjunnar
- **Núverandi staða (`src/views/game.ejs:250-360`):**
  - Í bardaga horfir spilarinn á miðjudálkinn, en HP-stöng hetjunnar er úti í hægri dálki (og á farsíma/spjaldtölvu `< 1024px` er hægri dálkurinn **fyrir neðan** miðjudálkinn og vinstri dálkinn, `order: 3` í `style.css:2217`!). Á síma sér spilarinn því **ekki sitt eigið HP** á meðan hann berst nema hann skruni niður!
- **Nákvæm breyting:**
  - Setja þétta **Combat Vitals Strip** (`❤️ HP: 14/20 | 🛡️ AC: 16 | 🗡️ Longsword (+3)`) beint fyrir ofan `.combat-actions-bar` inni í miðjudálkinum þegar `encounter.status === 'IN_COMBAT'`. Þá hefur spilarinn allar lífsnauðsynlegar upplýsingar beint við `Attack / Potion / Flee` hnappana bæði á borðtölvu og í síma.

#### 5. Lyklaborðsflýtilyklar (Keyboard Shortcuts) vantar fyrir fljóta spilun
- **Núverandi staða:** Aðeins `Escape` (til að loka modal) er stutt í `game.ejs:1260`. Spilarinn þarf að nota músina í hverju einasta skrefi (N/S/A/V, Investigate/Ignore, Attack/Flee).
- **Nákvæm breyting:**
  - Bæta við ~30 línum af vanilla JS í `game.ejs`:
    - `WASD` eða örvalyklar til að hreyfa sig (þegar enginn modal er opinn og ekkert encounter).
    - `1` / `Space` fyrir *Investigate* eða *Attack*, `2` fyrir *Potion*, `3` fyrir *Ignore* / *Flee*.
    - `C` (Character), `B` (Backpack), `M` (Market), `J` (Journal).
  - Þetta mun láta Darkgrid líða eins og alvöru, lipran PC RPG leik.

---

## 8. Technical Architecture Review (Úttekt á kerfisarkitektúr og kóðagæðum)

### 8.1. Heildararkitektúr (`src/`)
- **Styrkleikar [STAÐFEST Í KÓÐA]:**
  - Mjög skýr lagskipting: `src/domain/*` inniheldur engin `req`/`res` Express-hugtök og tekur `db` inn sem viðfang (eða sækir úr `getDb()`).
  - Engin þung ORM-bókasöfn; bein, hraðvirk SQL-fyrirspurnir með innbyggðu `node:sqlite` (`DatabaseSync`).
  - Öll framsetning er Server-Side Rendered (EJS) með Post/Redirect/Get (PRG) mynstri sem kemur í veg fyrir tví-sendingu við Refresh (`F5`).

### 8.2. Raunverulegir tæknilegir veikleikar og áhættur

#### 1. `lastEquipmentByCharacterId` hliðarrás í minni (`src/domain/character/rules.js:582`)
- **Vandamál [STAÐFEST Í KÓÐA]:**
  ```js
  const lastEquipmentByCharacterId = new Map();
  ```
  Þegar `getCharacterEquipment(db, characterId)` er kallað, vistar það búnaðinn í þessu global `Map`. Síðar, þegar `calculateHeroAC(character, armorItem, shieldItem, equipment)` er kallað *án* fjórða viðfangsins (`equipment`), leitar fallið í `lastEquipmentByCharacterId.get(character.id)` til að finna hvort hetjan sé með `Ring of Protection` eða `Cloak of Resistance`!
- **Áhætta:**
  1. Ef `calculateHeroAC` er kallað áður en `getCharacterEquipment` hefur keyrt í núverandi ferli (t.d. eftir endurræsingu þjóns), reiknast **rangt AC** (án hrings/skikkju).
  2. `Map`-ið tæmist aldrei (memory leak).
- **Lausn:** Laga þá 2–3 staði sem kalla á `calculateHeroAC` þannig að þeir sendi alltaf `equipment` hlutinn beint inn, og eyða `lastEquipmentByCharacterId`.

#### 2. `express-session` notar `MemoryStore` og `authAttempts` lekur minni (`src/app.js:49`, `src/routes/auth.js:6`)
- **Vandamál [STAÐFEST Í KÓÐA]:**
  - `src/app.js` notar sjálfgefinn `MemoryStore` í `express-session`. Í hvert sinn sem Node-þjónninn endurræsist dettur allir innskráðir spilarar út, og í langri keyrslu lekur `MemoryStore` minni.
  - Í `src/routes/auth.js:6` er `const authAttempts = new Map();` sem hreinsar aldrei út útrunnar IP-tölur nema sama IP-tala reyni aftur.
- **Lausn:** Bæta við einfaldri `sessions` töflu í SQLite (eða léttum periodískum `setInterval(...).unref()` hreinsara fyrir `authAttempts` og sessions) án þess að bæta við þungum ytri pakka.

#### 3. `handlePlayerDeath` vantar vörn gegn tví-keyrslu á dauðri hetju (`src/domain/monsters/persistence.js:27-35`)
- **Vandamál [STAÐFEST Í KÓÐA]:**
  - `handlePlayerDeath(db, character, monster, encounter)` les `character` og byrjar strax að færa 50% af gulli og hlutum yfir á skrímslið án þess að athuga fyrst í gagnagrunni `SELECT is_alive FROM characters WHERE id = ?`.
  - Þótt `src/routes/game.js:580` keyri núna innan `BEGIN IMMEDIATE` transaction og athugi stöðu encounters, þá ætti `handlePlayerDeath` sjálft að vera *idempotent* og kasta villu ef `is_alive === 0`.

#### 4. `runSeeds` keyrir 68+113+225 SQL-setningar í hverri ræsingu (`src/db/migrate.js:51-82`)
- **Vandamál [STAÐFEST Í KÓÐA]:**
  - `src/server.js` kallar á `runMigrations(db)` og `runSeeds(db)` í hvert sinn sem þjónninn ræsist. Þótt seeds séu idempotent (`INSERT OR IGNORE` / `ON CONFLICT DO UPDATE`), þá keyrir `005_loot_tables_seed.sql:10` `DELETE FROM loot_table_entries;` og endurhleður öllum línum við hverja ræsingu.
- **Áhætta:** Ef admin eða framtíðar-migration breytir `loot_table_entries` eða skrímslum, mun `runSeeds()` við næstu ræsingu yfirskrifa þær breytingar.

#### 5. Tvöföldun á gögnum í `monsters` töflu (`habitat` JSON vs `monster_terrains` tafla)
- **Vandamál [STAÐFEST Í KÓÐA]:**
  - `monsters.habitat` geymir JSON fylki af landslagi, á meðan `monster_terrains` taflan geymir venslaðar línur (`monster_id, terrain`). `selectCandidateMonsters` notar `monster_terrains`, en `habitat` dálkurinn er enn til staðar og getur farið úr samhengi ef öðru er breytt án hins.

---

## 9. New Game Ideas (14 nýjar hugmyndir fyrir Darkgrid)

Allar 14 hugmyndirnar hér að neðan eru hannaðar sérstaklega fyrir **Darkgrid** og fylgja 10 grunnreglum verkefnisins (single-player kjarni með shared-world áhrifum, permadeath í fyrirrúmi, ekkert nýtt kort, engin MMORPG-þensla, einfaldleiki með dýpt, og allur texti á ensku):

---

### Hugmynd 1: „Whispers of the Fallen“ — Sýnilegar slóðir og viðvaranir um Hero-Slayers
- **Svið:** Persistent World / Permadeath / Atmosphere
- **Lýsing:** Þegar *Persistent Monster* (`monster_instances.status = 'ACTIVE'`) dvelur á reit:
  1. Á **5×5 Minimap** birtist daufur blóðrauður púlshringur eða `💀` tákn á reitnum ef hann er innan sjónsviðs.
  2. Á **liggjandi reitum** (1 skref í burtu) bætist við dularfull lína neðst í umhverfislýsinguna: *„Fresh bloodstains and shattered gear trail toward the [North]... something lethal lurks there.“*
  3. Í **Stage 1 (`DISCOVERED`)** á sjálfum reitnum sér spilarinn nafn og titil skrímslisins strax (þar sem það ber blóðuga herklæði fyrri hetju): *„Before you stands the **Owlbear, Slayer of Thorne** (2 Heroes Slain), gnawing on a familiar shield.“*
- **Af hverju þetta virkar:** Breytingin gerir *Persistent Monsters* að ógnvænlegum „mini-bossum“ sem spilarar geta annaðhvort forðast af ótta eða leitað uppi í hefndarhug.

### Hugmynd 2: Taktískar bardagastöður („Stances“ eða 1 ný valmöguleiki í bardaga: *Defend / Brace*)
- **Svið:** Combat / Tactical Depth
- **Lýsing:** Í stað þess að bardagi sé bara `Attack / Potion / Flee`, bætum við einum einföldum en djúpum valkosti á bardagaborðið:
  - **🛡️ Brace & Switch:** Spilarinn tekur varnarstöðu í 1 umferð (**+4 AC** gegn næstu árás skrímslisins, og fær **+2 á næsta Flee-kast** EÐA getur **skipt á milli Melee og Ranged vopns** án þess að tapa umferðinni til einskis).
- **Af hverju þetta virkar:** Gefur spilaranum raunverulega ákvörðun þegar hann er lágt á lífi, vill undirbúa öruggan flótta, eða vill skipta úr boga yfir í sverð og skjöld án þess að flækja viðmótið.

### Hugmynd 3: Virkjun á 6 lykil-eiginleikum skrímsla (Monster Trait Archetypes)
- **Svið:** Combat / Monster Behavior
- **Lýsing:** Í stað þess að útfæra öll 106 Pathfinder-tögin í `special_abilities`, flokkum við þau í **6 einfaldar, skýrar frumgerðir (Archetypes)** í `src/domain/combat/engine.js`:
  1. **Venomous (`poison`):** Á 25% líkur við hitt að valda *Poisoned* (`-1d4 HP` í næstu 2 umferðum, læknast með `Antitoxin` eða `Divine Healing`).
  2. **Entangler (`web`, `constrict`, `grab`):** Ef skrímslið hittir, hækkar `Flee DC` úr 12 í 15 í næstu umferð (*„Held fast by tendrils/webs!“*).
  3. **Regenerator (`regeneration`, `fast healing`):** Skrímslið grær um `+2 HP` í lok hverrar umferðar (nema það verði fyrir töfravopni eða eldi).
  4. **Pouncer / Berserker (`pounce`, `ferocity`, `rage`):** Gerir +2 skaða í 1. umferð eða þegar það er undir 25% HP (*Near Death*).
  5. **Incorporeal (`incorporeal`):** Tekur 50% skaða af venjulegum vopnum, en 100% af töfravopnum (`is_magical = 1`) og Cleric *Holy Radiance*.
  6. **Flyer (`FLY`):** (Nú þegar til staðar — krefst Ranged).
- **Af hverju þetta virkar:** Allt í einu verður bardagi við *Troll* (Regenerator), *Giant Spider* (Venomous + Entangler) og *Wraith* (Incorporeal) gjörólík upplifun, og `Antitoxin` + töfravopn fá lífsnauðsynlegt hlutverk!

### Hugmynd 4: Sunken Ruins & Mountain Passes — Opnun á týndu skrímslunum 11 á núverandi 15×15 korti
- **Svið:** World / Terrain / Bestiary
- **Lýsing:** Án þess að stækka 15×15 kortið breytum við **8–10 völdum reitum** á núverandi korti:
  - 3–4 reitir í úthverfum fá `terrain = 'UNDERGROUND_RUINS'` (t.d. *The Sunken Vaults*, *Drow Outpost*, *Collapsed Dwarven Delve*).
  - 2–3 fjallareitir verða færir (`is_passable = 1`) sem *Mountain Passes* (`terrain = 'MOUNTAINS'`).
  - 2–3 strandreitir við vatnið/hafið fá `terrain = 'COAST'`.
- **Af hverju þetta virkar:** Með einni einfaldri gagnagrunnsuppfærslu lifna öll 11 týndu skrímslin (*Drow, Duergar, Mummy, Skeletal Champion, Phase Spider, Cloaker, Giant Crab, Sahuagin* o.fl.) við, og Ranger *Favored Enemy (Drow / Duergar)* hættir að vera gildra!

### Hugmynd 5: Hlutverk fyrir `INT` og `CHA` (Engir „Dump Stats“ lengur)
- **Svið:** Character Progression / Balance
- **Lýsing:** Gefum `INT` og `CHA` skýr, einföld og gagnleg hlutverk sem henta öllum stéttum:
  - **Intelligence (`INT`) — Tactical Lore & Monster Assessment:**
    1. Hver `+1 INT mod` gefur **+10% meira XP** úr bardögum (eða +1 í *Crit Confirmation* og þekkingu á skrímslum: við `INT >= 12` sér spilarinn í Stage 1 (`DISCOVERED`) hættumat skrímslisins, t.d. *„Threat: Moderate (Level 2)“* og *Special Traits* eins og *Venomous*).
  - **Charisma (`CHA`) — Merchant Bargaining & Fate's Favor:**
    1. Hver `+1 CHA mod` bætir **kaup- og söluverð í Oakhaven um 5%** (t.d. við CHA 14 / +2 lækkar kaupverð um 10% og söluverð hækkar úr 50% í 60%).
    2. Fyrir Cleric bætir `CHA mod` við skaða/hittni í *Turn Undead / Holy Radiance*.
- **Af hverju þetta virkar:** Að lækka INT og CHA niður í 8 hefur nú raunverulegan kostnað (dýrari búð, minna XP/upplýsingar), á meðan gáfaður eða sjarmerandi karakter fær skemmtilega sérstöðu.

### Hugmynd 6: „Campfire vs. Oakhaven“ — Lækning á ókeypis Town-Gate Farming
- **Svið:** Exploration / Resource Management
- **Lýsing:**
  - Í stað þess að hvert skref inn í Oakhaven (`[7,7]`) gefi ótakmarkaða 100% ókeypis lækningu, þá kostar **Inn / Sanctuary Rest í Oakhaven** litla upphæð eftir Leveli (t.d. ókeypis á Level 1 þegar þú ert undir 50 XP, en síðan `5 gp × Level` fyrir fullt HP og Cleric-endurhleðslu).
  - Á móti kemur: Þegar hetja **hækkar um Level** úti í óbyggðum fær hún *Second Wind* (endurheimtir 50% af Max HP og +1 Cleric charge), sem hvetur spilara til að halda áfram í leiðangri frekar en að hlaupa heim eftir hvern einasta bardaga.
- **Af hverju þetta virkar:** Kemur í veg fyrir óendanlegt Town-Gate misferli og gefur gulli og lækningadrykkjum raunverulegt vægi á öllum stigum leiksins.

### Hugmynd 7: „Hall of the Fallen“ & Grave Markers (Minningarreitir á kortinu)
- **Svið:** Permadeath / Shared World / UI
- **Lýsing:**
  1. Bæta við flipa í **Journal Modal** (eða hnappi í Oakhaven): **⚰️ Hall of the Fallen**, sem sýnir minningarskrá yfir bæði eigin fallnar hetjur og síðustu 10 hetjur sem hafa fallið í heiminum, ásamt því hvort banamaður þeirra sé enn á lífi (`Unavenged — Stalking the Whispering Mire [4,9]`) eða hafi verið veginn (`Avenged by [Hero]`).
  2. Ef þú gengur inn á reit þar sem hetja lést (jafnvel eftir að skrímslið var drepið), birtist stuttur minningartexti: *„A weathered cairn marks where **Skugga-Valdi (Level 4 Ranger)** fell.“*
- **Af hverju þetta virkar:** Gefur permadeath varanlega sögulega vigt og tengir spilara saman í gegnum sögu heimsins.

### Hugmynd 8: Stuttir uppgötvunar-viðburðir á reitum („Wilderness Vignettes“)
- **Svið:** Exploration / Rare Encounters
- **Lýsing:** Þegar spilarinn stígur á reit og **ekkert skrímsli birtist** (75% tilvika), eru **8% líkur** á stuttum, einföldum „Wilderness Vignette“ (1 valákvörðun með 2 tökkum):
  - *Dæmi 1 — Abandoned Camp:* „You find a cold campfire and a rusted lockbox.“ -> **[Pry it open]** (70% líkur á 5–20 gp / drykk, 30% líkur á `1d4` gildruskaða) eða **[Leave it]**.
  - *Dæmi 2 — Weathered Wayshrine:* „An moss-covered altar to the Old Gods hums faintly.“ -> **[Offer 10 gp]** (Fær *Blessed*: +1 Attack og +1 AC í næsta bardaga) eða **[Pass by]**.
  - *Dæmi 3 — Wounded Scout:* „A dying Oakhaven militia scout clutches his side.“ -> **[Give Healing Potion / Cleric Charge]** (Fær +75 XP og kortlagningu á 3×3 svæði í kring) eða **[Take his coin pouch (+15 gp)]**.
- **Af hverju þetta virkar:** Brýtur upp einhæfnina við að ganga á tóma reiti og gerir hvert ferðalag ófyrirsjáanlegt með lágmarks kóða.

### Hugmynd 9: Cleric „Combat Prayer“ (Notkun á Divine Healing í bardaga)
- **Svið:** Combat / Class Balance
- **Lýsing:** Leyfa Cleric að nota **1 Divine Healing hleðslu í bardaga** sem sína umferðaraðgerð (við hliðina á `Drink Potion`), sem læknar `1d6/2d6/3d6 + WIS` **og** gefur +1 AC í þá umferð.
- **Af hverju þetta virkar:** Lagfærir helsta veikleika Cleric-stéttarinnar (að vera gagnslaus í erfiðum bardögum gegn ekki-Undead) án þess að gera lækningadrykki óþarfa (því hleðslur eru takmarkaðar við 3–5 á milli bæjarferða).

### Hugmynd 10: Oakhaven Bounty Board („Wanted: Hero-Slayers & Beasts“)
- **Svið:** Progression / Persistent World / Replayability
- **Lýsing:** Í Oakhaven (`[7,7]`) birtist **📜 Bounty Board** með 2 verkefnum:
  1. **Active Slayer Bounty (Shared World):** Ef *Persistent Monster* er á lífi einhvers staðar á kortinu, setur bæjarstjórnin sjálfkrafa verðlaun (t.d. `+100 gp` og `+250 XP`) til höfuðs því, og gefur upp **stefnu og landslag** (t.d. *„Last seen in the Swamps Southeast of Oakhaven“*).
  2. **Daily Monster Cull:** Einfalt veiðiverkefni miðað við level hetjunnar (t.d. *„Slay any 2 Undead or Swamp creatures — Reward: 50 gp & 150 XP“*).
- **Af hverju þetta virkar:** Gefur spilaranum skýrt skammtímamarkmið í hvert sinn sem hann leggur af stað úr Oakhaven!

### Hugmynd 11: „Heirloom Chest“ eða „Oakhaven Legacy“ (Mild permadeath brú)
- **Svið:** Permadeath / Replayability
- **Lýsing:** Permadeath á að vera harður, en til að draga úr svekkelsi þegar Level 5 hetja deyr:
  - Í Oakhaven er **Legacy Tithe**: Spilari getur lagt gull í *Oakhaven Guild Vault* (allt að 100 gp hámark) EÐA þegar hetja á Level 3+ fellur í valinn, skilur hún eftir sig *Will & Testament* sem gefur næstu hetju á sama reikningi **+10% af XP** eða **1 handahófskenndan ó-töfrahlut** úr bakpoka hinnar föllnu hetju. (Hinn helmingurinn verður áfram hjá *Hero-Slayer* skrímslinu!).
- **Af hverju þetta virkar:** Heldur 100% í permadeath og Hero-Slayer kerfið, en gefur spilaranum smávegis hlýju og tilfinningu fyrir samfellu þegar hann býr til nýja hetju.

### Hugmynd 12: Einfölduð og hreinni Level-heild (Level 1–6 í stað Level 1–10, eða Apex Monsters L6–8)
- **Svið:** Progression / Balance
- **Lýsing:** Núna er gat á milli Level 5 (hámarks skrímsli og síðasti stéttarhæfileiki) og Level 10 (hámarks hetjulevel). Við höfum tvær hreinar leiðir:
  - **Leið A (Ráðlögð í bili):** Bæta við **Level 6–7 „Apex / Boss“ skrímslum** í ystu hornum kortsins (Fjarlægð 8+, t.d. *Young Black Dragon* [sem opnar loksins `DRAGON_HOARD`!], *Hydra*, *Lich Acolyte*, *Stone Golem*) og bæta við einum **Capstone Class Ability á Level 7**.
- **Af hverju þetta virkar:** Bæði fyllir í gatið í há-levels framvindu og virkjar `DRAGON_HOARD` loot-töfluna með öllum Legendary hlutunum sem þegar eru í gagnagrunninum!

### Hugmynd 13: Sjónræn „Combat Card“ endurgjöf (Micro-Animations & Dice Clarity)
- **Svið:** UI/UX / Visual Presentation
- **Lýsing:**
  - Þegar bardagaumferð er leyst (`POST /game/combat/attack`), bæta við CSS-klasa á skrímslamyndina (`.monster-art-frame.was-hit` -> stuttur rauður blossi og 3px hristingur í 250ms; `.was-crit` -> gylltur blossi).
  - Í `.combat-log-scroll` merkja síðustu umferð (`Round N`) með örlítið stærra letri og skýrum táknum (`⚔️ HIT`, `💥 CRITICAL HIT!`, `🛡️ PARRIED/MISSED`), á meðan eldri umferðir dofna í `opacity: 0.65`.
- **Af hverju þetta virkar:** Gefur hverjum smelli á `Attack` líkamlega þyngd og gerir bardagaskrána auðlesna á sekúndubroti.

### Hugmynd 14: „Monster Bestiary / Lore“ í Journal Modal
- **Svið:** Quality of Life / Discovery
- **Lýsing:** Í **Journal Modal** bætist við flipi: **📖 Bestiary (X / 68 Discovered)**.
  - Í hvert sinn sem spilarinn mætir skrímsli bætist mynd þess og lýsing í Bestiary.
  - Eftir að spilarinn hefur **sigrað** skrímslið 1 sinni opnast *Tactical Lore* í Bestiary (t.d. `Habitat: Swamp, Forest | Threat Tier: Level 2 | Known Traits: Ambush Predator`).
- **Af hverju þetta virkar:** Nýtir allar 68 glæsilegu skrímslamyndirnar og gefur spilaranum langtíma söfnunarmarkmið („100% Bestiary Completion“) sem getur lifað á reikningnum (`user_id`) jafnvel þótt einstakar hetjur falli!

---

## 10. Prioritized Recommendations (Forgangsröðuð tillögutafla)

Hér eru allar tillögur flokkaðar eftir **Bugs & Tech**, **Balance Adjustments**, **UX Improvements** og **New Features**, með öllum umbeðnum eiginleikum:

### 10.1. Bugs & Technical Fixes (Villur og tæknilegar lagfæringar)

| # | Heiti | Núverandi staða | Vandamál eða tækifæri | Tillaga | Ávinningur fyrir spilarann | Fyrirhöfn | Áhætta | Forgangur |
| :- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **T1** | **Tengja 35 týnda töfrahluti og `DRAGON_HOARD` við leikinn** | 26 töfrahlutir eru í engri loot-töflu; 9 hlutir (þ.m.t. allir Legendary hlutir) eru í `DRAGON_HOARD` en ekkert Dragon-skrímsli er til. | 66% af töfrahlutum leiksins geta aldrei birst í spilun. | Setja 26 týndu töfrahlutina í viðeigandi `loot_table_entries`, og annaðhvort bæta við 1–2 Dragon skrímslum (t.d. *Wyvern* sem Dragon-gerð eða *Young Black Dragon*) EÐA leyfa Level 5+ / Persistent skrímslum að kasta á `DRAGON_HOARD`. | Spilarar geta loksins fundið *Longsword +2*, *Cloak of Resistance*, *Holy Avenger +3* og *Oathbow +3*. | **Small** | **Low** | **P1** |
| **T2** | **Opna á 11 óaðgengileg skrímsli (og laga Ranger Drow/Duergar gildruna)** | 11 skrímsli eru bundin við `UNDERGROUND_RUINS`, `MOUNTAINS`, `DESERT`, `COAST`, `OCEAN` sem eru ófær eða ekki á kortinu. | 16% af skrímslum og myndum sjást aldrei; Ranger sem velur *Drow/Duergar* sem Favored Enemy er svikinn um hæfileika sinn. | Bæta við færum `UNDERGROUND_RUINS`, `MOUNTAINS` (Mountain Pass) og `COAST` reitum á 15×15 kortið EÐA bæta `SWAMP`/`FOREST`/`HILLS` sem auka-landslagi á þessi 11 skrímsli í `monster_terrains`. | Öll 68 skrímslin og myndirnar komast í gagnið; *Favored Enemy* virkar alltaf. | **Small** | **Low** | **P1** |
| **T3** | **Laga `Persistent Monster` Ambush-villu** | `encounters/engine.js:216` setur alltaf `spottedByHero = 1, isAmbush = 0` á persistent skrímsli. | Hættulegustu skrímsli heimsins geta aldrei gert fyrirsát og gefa Ranger alltaf 100% frítt skot. | Láta persistent skrímsli nota sama `rollPerceptionAndAmbush` og önnur skrímsli. | Hero-Slayer skrímsli halda fullri hættu og spennu. | **Small** | **Low** | **P1** |
| **T4** | **Fjarlægja `lastEquipmentByCharacterId` minnis-hjáleið** | `character/rules.js:582` geymir búnað í global `Map` til að giska á AC bónusa. | Minnisleki og hætta á röngu AC eftir endurræsingu þjóns. | Senda `equipment` beint inn í `calculateHeroAC` á öllum köllunarstöðum og eyða global `Map`-inu. | Áreiðanlegur AC-útreikningur og hreinni arkitektúr. | **Small** | **Low** | **P2** |
| **T5** | **Idempotency í `handlePlayerDeath` og takmörk á Resale Market** | `handlePlayerDeath` athugar ekki `is_alive`; `getResaleMarketListings` hefur ekkert `LIMIT`. | Varnarlína á domain-stigi og vörn gegn óendanlegum markaðslista. | Bæta við `is_alive` athugun í `persistence.js`, setja `LIMIT 25` á Resale Market, og hætta að keyra `DELETE FROM loot_table_entries` í hverri ræsingu. | Stöðugri gagnagrunnur og hraðari ræsing. | **Small** | **Low** | **P2** |

---

### 10.2. Balance Adjustments (Jafnvægisbreytingar)

| # | Heiti | Núverandi staða | Vandamál eða tækifæri | Tillaga | Ávinningur fyrir spilarann | Fyrirhöfn | Áhætta | Forgangur |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **B1** | **Gefa `INT` og `CHA` raunverulegt hlutverk í leikjareglum** | `INT` og `CHA` gera ekkert í kóðanum; allir spilarar eiga að lækka þau í 8 (-2). | Point-buy kerfið er „solved“ og refsar nýjum spilurum sem setja stig í INT/CHA. | **INT:** +10% XP per +1 mod og sýnir hættustig skrímslis í Stage 1 við `INT >= 12`. **CHA:** ±5% betra verð í Oakhaven per +1 mod og styrkir Cleric *Holy Radiance*. | Allir 6 eiginleikarnir skipta máli og opna á ólíka „builds“. | **Small** | **Low** | **P1** |
| **B2** | **Aðgreina `MELEE` og `RANGED` vopnaformúlur** | Bæði Melee og Ranged nota `floor((STR+DEX)/2)` í Atk og fullan `STR` í skaða. | Bogi (`RANGED`) er yfirburðavopn (sami skaði, hittir `FLY`, gefur Opening Shot, ótakmarkað ammo). | **Melee:** Atk notar `max(STR, floor((STR+DEX)/2))`, Dmg notar `+STR`. **Ranged:** Atk notar `DEX`, Dmg notar `+floor(STR/2)` (eða `0` fyrir Crossbow sem fær hærri grunnskaða). | Sverð/exi slá fastar í návígi; bogi er nákvæmari fyrir DEX-hetjur. | **Small** | **Medium** | **P1** |
| **B3** | **Virkja 6 virka drykki og Cleric „Combat Prayer“** | 6 buff-drykkir eru merktir `inactive`; Cleric getur ekki notað *Divine Healing* í bardaga. | Cleric vantar virkni í bardaga gegn dýrum/tröllum; óvirkir drykkir í UI líta út eins og galli. | Leyfa Cleric að nota 1 *Divine Healing* hleðslu í bardaga; virkja buff-drykkina (`+2 AC`, `+2 Atk`, `3d6 fire`) í `combat/engine.js`. | Meiri taktík í erfiðum bardögum og engir „Pending implementation“ hnappar. | **Medium** | **Low** | **P1** |
| **B4** | **Stöðva ókeypis „Town-Gate Farming“ og setja þak á Slayer HP** | Ókeypis 100% lækning í `[7,7]`; Persistent Monster HP hækkar um +10% án hámarks. | Hægt að farma reitinn við hliðina á Oakhaven án áhættu; Slayer getur orðið ódrepandi. | Setja hámark á Slayer HP boost við **+50% Max HP** (5 kills); gefa hetju 50% HP við Level-Up úti í mörk, og láta Sanctuary Rest í bæ kosta `2 gp × (Level - 1)` frá Level 2+. | Heilbrigðara hagkerfi og kemur í veg fyrir ódrepandi skrímsli. | **Small** | **Low** | **P2** |
| **B5** | **Samræma Hero Level Cap og Monster Level Cap** | Hetjur ná Level 10, en skrímsli ná aðeins Level 5 (og stéttir fá ekkert eftir L5). | Síðari hluti framvindunnar (L6–L10) er tómur. | Bæta við 5–6 Level 6–8 „Apex“ skrímslum í ystu reitum kortsins (Fjarlægð 8+) og bæta við Level 7 stéttarhæfileika. | End-game áskorun sem passar við Level 6–10. | **Medium** | **Low** | **P2** |

---

### 10.3. UI/UX Improvements (Viðmóts- og upplifunarumbætur)

| # | Heiti | Núverandi staða | Vandamál eða tækifæri | Tillaga | Ávinningur fyrir spilarann | Fyrirhöfn | Áhætta | Forgangur |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **U1** | **Hero-Slayer sjónræn viðvörun í `DISCOVERED`, `IN_COMBAT` og á Minimap** | `game.ejs` sýnir hvergi `custom_title` eða að skrímsli sé Persistent Monster fyrr en eftir sigur. | Besta og sérstæðasta kerfi leiksins fer alveg framhjá spilaranum í sjálfum leiknum! | Sýna `💀 SLAYER OF [HERO]` borða í Stage 1 & 2, rauðgylltan ramma utan um skrímslamyndina, og `💀` merki á 5×5 minimap. | Spilarinn finnur strax fyrir spennunni þegar hann mætir banamanni fyrri hetju. | **Small** | **Low** | **P1** |
| **U2** | **Sýna tölfræði hluta í Market og samanburð (`+AC / +Dmg`) í Backpack** | `Standard Armory` í Market sýnir hvorki `damage_dice` né `armor_bonus`! | Spilari þarf að giska á hvað vopn og brynjur gera áður en hann kaupir þau. | Sýna fullt `.gear-item-meta` (`Dmg`, `Crit`, `AC`, `Allowed Classes`) í Market og grænan/rauðan samanburðarvísi miðað við núverandi búnað. | Skýrar og upplýstar ákvarðanir við kaup og búnaðarskipti. | **Small** | **Low** | **P1** |
| **U3** | **Compact „Combat Vitals Strip“ og Micro-Animations í bardaga** | Á farsíma/spjaldtölvu er HP hetjunnar falið neðst á síðunni í bardaga; bardagaskrá er flöt. | Spilari í síma sér ekki eigið HP án þess að skruna; vantar sjónrænan kraft við högg. | Bæta við grannri `HP / AC / Weapon` línu beint fyrir ofan `Attack/Potion/Flee` hnappana í bardaga, og stuttum CSS hit-flash á skrímslamynd. | Miklu betri yfirsýn í bardaga (sérstaklega á mobile) og líflegri tilfinning. | **Small** | **Low** | **P2** |
| **U4** | **Lyklaborðsflýtilyklar (`WASD`, `1-3`, `C/B/M/J`)** | Aðeins `Escape` er stutt; allt annað krefst músarsmella. | Margir smellir við ferðalög og bardaga geta orðið þreytandi á borðtölvu. | Bæta við léttu lyklaborðsstýringarkerfi í `game.ejs` með litlum vísbendingum (`[W]`, `[1]`). | Hraðari, þægilegri og nútímalegri PC-spilun. | **Small** | **Low** | **P2** |

---

### 10.4. New Features (Nýir eiginleikar)

| # | Heiti | Núverandi staða | Vandamál eða tækifæri | Tillaga | Ávinningur fyrir spilarann | Fyrirhöfn | Áhætta | Forgangur |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **F1** | **Taktískir Monster Traits (6 Archetypes) & „Brace/Switch“ aðgerð** | Öll 68 skrímslin gera bara venjulega árás; spilarinn getur bara ýtt á `Attack`. | Bardagar verða fyrirsjáanlegir þegar lengra líður á leikinn. | Útfæra 6 einfalda eiginleika (*Venomous, Entangler, Regenerator, Berserker, Incorporeal, Flyer*) og `Brace & Switch` varnarhnapp. | Hver skrímslaflokkur krefst ólíkrar taktíkur og undirbúnings. | **Medium** | **Medium** | **P2** |
| **F2** | **Fog of War (Könnunarkort) & Landmarks á 15×15 kortinu** | Allir 162 færu reitirnir virka eins og engin könnunarsaga er geymd. | Vantar tilfinningu fyrir uppgötvun og framvindu á kortinu. | Halda utan um kannaða reiti (+10 XP fyrir nýjan reit) og virkja 6–8 `feature` reiti (Shrines, Ruins, Watchtowers). | Heimurinn fær dýpt, kennileiti og umbun fyrir könnun. | **Medium** | **Low** | **P2** |
| **F3** | **Hall of the Fallen & Oakhaven Bounty Board** | Minningarskjár sést aðeins þegar hetja deyr; engin markmið í Oakhaven. | Vantar sýnilega sögu fallinna hetja og skammtímamarkmið. | Bæta við *Hall of the Fallen* flipa í Journal og *Bounty Board* í Oakhaven sem vísar á virka Hero-Slayers. | Styrkir shared-world upplifunina og gefur skýr markmið. | **Medium** | **Low** | **P2** |
| **F4** | **Wilderness Vignettes & Bestiary Lore** | Tómir reitir (75%) hafa enga viðburði; engin skrímslabók er til. | Ferðalög um tóma reiti geta orðið tíðindalítil; 68 skrímslamyndir mættu nýtast betur. | 8% líkur á stuttum 2-valkosta atburði á tómum reitum; *Bestiary* flipi í Journal sem safnar uppgötvuðum skrímslum. | Óvæntar uppákomur á ferðalögum og langtíma söfnunarmarkmið. | **Medium** | **Low** | **P3** |

---

## 11. Suggested Next 5 Development Steps (Tillaga að næstu 5 þróunarlotum)

Ef við viljum hámarka gæði og skemmtanagildi Darkgrid með sem minnstu flækjustigi, mælum við með þessari röð í næstu 5 skrefum:

1. **Skref 1 — Content Unblocking & Data Integrity (T1 + T2 + T3):**
   - Tengja týndu töfrahlutina 35 við `loot_table_entries`, opna á `UNDERGROUND_RUINS` / `MOUNTAINS` / `COAST` skrímslin 11 (svo öll 68 skrímslin og *Favored Enemy: Drow/Duergar* virki), og laga `spottedByHero` villuna á Persistent Monsters. *(Engin ný kerisflækja — virkjar 100% af því efni sem þegar hefur verið smíðað!).*
2. **Skref 2 — Hero-Slayer Visibility & UI Polish (U1 + U2 + U3):**
   - Gera *Persistent Monsters* sýnileg á 5×5 minimap (`💀`), í Stage 1 (`DISCOVERED`) og í bardaga (`IN_COMBAT`) með fullum `Slayer of [Hero]` titli.
   - Bæta við vopna/brynju-tölum í *Market* og samanburði (`+AC / +Dmg`) í *Backpack*, ásamt *Combat Vitals Strip* fyrir ofan bardagahnappana.
3. **Skref 3 — Stat & Weapon Rebalance (B1 + B2):**
   - Virkja `INT` (XP bónus + skrímsla-innsýn) og `CHA` (verslunarafsláttur + Holy Radiance), og aðgreina `MELEE` (STR-miðað) frá `RANGED` (DEX-miðað) svo allar stéttir og eiginleikar hafi skýrt hlutverk.
4. **Skref 4 — Tactical Combat & Active Potions (B3 + F1):**
   - Virkja 6 buff/alchemical drykkina í bardaga, leyfa Cleric að nota *Combat Prayer* í bardaga, bæta við `Brace & Switch` aðgerðinni, og kveikja á 6 einföldum *Monster Trait Archetypes* (*Venomous, Entangler, Regenerator, Berserker, Incorporeal, Flyer*).
5. **Skref 5 — Living World & Exploration Depth (F2 + F3 + B4):**
   - Bæta við *Hall of the Fallen* í Journal, *Bounty Board* í Oakhaven sem vísar á virka Hero-Slayers, *Fog of War* könnunarkorti og 6–8 *Landmarks* á 15×15 kortinu.

---

## 12. Long-Term Opportunities (Langtímatækifæri)

Þegar ofangreindum 5 skrefum er lokið er Darkgrid orðinn heilsteyptur, sanngjarn og djúpur leikur. Til lengri tíma (Phase 5+) liggja stærstu tækifærin í:

1. **Account-Wide „Chronicle & Bestiary“ (Meta-Progression án Power Creep):**
   - Þegar hetja deyr tapast karakterinn, en *reikningurinn* (`users`) safnar fróðleik í *Account Bestiary* og *Fallen Chronicles*, ásamt afrekum (*Titles / Epitaphs*). Þetta heldur í harðan permadeath án þess að spilarinn upplifi að tíma hans hafi verið sóað.
2. **World Seasons eða „Dark Tides“ (Shared-World Atburðir):**
   - Einfaldur hnattrænn teljari eða vikulegt ástand í `game_config` (t.d. *„Blood Moon Rising — Undead roam the Plains“* eða *„The Mists of Whispering Mire thicken“*) sem breytir tímabundið skrímsla-líkum og verðlaunum fyrir alla spilara á þjóninum.
3. **Mini-Dungeons / Lairs á Landmark-reitum:**
   - Í stað þess að stækka 15×15 heimskortið geta valdir *Landmark*-reitir (t.d. *The Sunken Crypt* á `[12,3]`) boðið upp á 3ja herbergja „Gauntlet“ (3 bardagar í röð án þess að geta farið í bæinn á milli, með tryggðri *Treasure Chest* í 3. herberginu). Þetta nýtir núverandi bardagavél 100% en býður upp á hámarks spennu fyrir Level 4–7 hetjur.
4. **Hljóðræn stemning (Subtle Ambient Web Audio):**
   - Valfrjálsir, lágværir hljóðeffektar (teningahljóð við kast, sverðshljómur, vindgnauð í skógi, dimmur hljómur við *Hero-Slayer* fund) sem hægt er að kveikja/slökkva á með einum hnappi í hausnum.
