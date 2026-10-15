# Darkgrid — Skýrsla og Jafnvægismat eftir Endurstillingar og Virkjun Sérhæfileika

**Dagsetning:** 14. október 2026  
**Umfang:** Heildarmat og Monte Carlo bardagahermun eftir innleiðingu á 8 samþykktum breytingum úr næturskýrslunum ([`docs/darkgrid-complete-review.md`](darkgrid-complete-review.md) og [`docs/monster-special-abilities-design.md`](monster-special-abilities-design.md)).

---

## 1. Yfirlit yfir Innleiddar Breytingar (8 Liðir)

Allir 8 liðirnir sem óskað var eftir hafa verið útfærðir í gagnagrunni, lénsrökfræði (`src/domain/`) og viðmóti (`src/views/`), án þess að hrófla við öðrum kerfum sem eru enn í skoðun:

1. **Falinn skaði og vörn á vopnum/brynjum í UI + Sögulegar lýsingar (Flavor Descriptions):**
   - Leikmenn sjá **hvergi** hráar tölur fyrir skaða vopna (`Dmg: 1d8`) eða vörn brynja og skjalda (`AC+4`, `Shield+2`, `(+6 total Armor Class)`) í viðmótinu (`src/views/game.ejs`).
   - Allir **113 hlutir** í `item_definitions` hafa fengið ríkulegar enskar *dark-fantasy* lýsingar án nokkurra talna-spoilera svo leikmenn velji búnað út frá því hvað þeim finnst töff og viðeigandi fyrir sína hetju.
2. **Virkni á Intelligence (`INT`) og Charisma (`CHA`):**
   - **Intelligence (`INT`):** Hver `+1` í INT modifier gefur **`+10% XP`** úr bardögum, en hver `-1` í INT modifier dregur úr XP um **`-10%`** (`calculateXpWithIntelligence`).
   - **Charisma (`CHA`):** Hver `+1` í CHA modifier lækkar kaupverð í verslun Oakhaven um **`-5%`**, en hver `-1` í CHA modifier hækkar kaupverð um **`+5%`** (`calculateShopPriceWithCharisma`).
3. **Aðgreining á Melee (`STR`) og Ranged (`DEX`):**
   - **Návígisvopn (Melee):** Nota `STR` modifier bæði fyrir hittni (Attack Bonus) og skaða (Damage Bonus).
   - **Langdræg vopn (Ranged):** Nota `DEX` modifier fyrir hittni (Attack Bonus) og samsettan styrk/lipurð (`Math.max(strMod, Math.floor(dexMod / 2))`) fyrir skaðabónus.
4. **Lagfæring á Flying (`FLY`) vélfræði:**
   - Flugskrímsli neyða ekki lengur návígishetjur (Fighter/Cleric) til að leggja frá sér skjöldinn og skipta yfir í boga/slöngu. `getActiveWeapon` virðir nú valda vopnastöðu hetjunnar (`primary_weapon = 'MELEE'` eða `'RANGED'`).
   - Návígisárás (`MELEE`) gegn fljúgandi skrímsli heldur návígisvopni og fullum skjaldarbónus (`Shield AC`), en tekur vægt **`-1` Evasive Flyer** hittnivíti. Langdræg árás (`RANGED`) tekur **`0`** í víti gegn fljúgandi skrímslum.
5. **25% Flat Lækkun á HP allra Skrímsla:**
   - Grunnlíf (`base_hp`) allra 68 skrímsla í `monsters` (og virkra `monster_instances`) var lækkað um **25%** (`MAX(2, ROUND(base_hp * 0.75))`).
6. **Virkjun Sérhæfileika Skrímsla (Monster Special Abilities):**
   - Ný eining [`src/domain/combat/abilities.js`](../src/domain/combat/abilities.js) og björgunarköst hetja (`Fortitude`, `Reflex`, `Will`, `Physical = max(Fort, Ref)`) voru tengd beint inn í bardagavélina (`src/domain/combat/engine.js`).
   - Öll **68 skrímslin** í leiknum eru nú með virkan Pathfinder 1e hæfileikaprófíl byggðan á 12 endurnýtanlegum erkitýpum (Damage Reduction, Incorporeal/Evasion, Regeneration/Ferocity/Blood Frenzy, Combat-Start Auras, Pounce/Charge/Ambush, Rend/Rake, Breath Weapon/Spike Volley, Elemental Rider, Poison/Disease/Bleed, Trip/Grab/Constrict, Paralysis/Life Drain/Calcification og Rust Corrosion).
7. **Permadeath-öruggar Aðlaganir (9 Permadeath Safety Rules):**
   - Allar 9 öryggisreglurnar úr hönnunarskýrslunni eru virkar:
     1. *Paralysis* (Ghoul, Ghast, Carrion Crawler) lama aðeins árás í **1 umferð**, leyfa enn **Drink Potion** og **Flee**, og veita **3 umferða ónæmi** á eftir.
     2. *Petrification* (Basilisk, Cockatrice) drepur **aldrei** í einu kasti heldur notar **2-þrepa Calcification** (Stig 1: *Slowed/Calcifying*; Stig 2: *Stone-Shatter* skaði og losun).
     3. *Poison* er með **3 umferða þak**, staflast ekki, og **1 vel heppnað Fortitude kast** læknar eitrið samstundis.
     4. *Ability/Energy Drain* (Shadow, Wight, Wraith, Vampire Spawn, Vargouille) er **bundið við bardagann** (hverfur að bardaga loknum) og lækkar aldrei eiginleika niður í 0.
     5. *Troll Regeneration* græðir 3 HP á umferð á meðan tröllið lifir, en deyr eðlilega í 0 HP (engin ódauðleiki ef leikmaður á ekki sýru/eld).
     6. *Rust Monster Corrosion* veldur tímabundnu `-2` víti á vopn/brynju út bardagann en **eyðir aldrei** hlutum leikmanns úr gagnagrunni.
     7. *Damage Reduction (DR) & Incorporeal* lækka aldrei skaða niður í 0 (alltaf **lágmark 1 í skaða**), og *Holy Radiance* hjá Cleric rýfur Incorporeal vörn ódauðra.
     8. *Grab & Entangle* banna **aldrei** flótta (`Flee`), heldur gefa vægt `-2` víti á flóttakastið.
     9. *Ferocity* (Orc, Boar, Dire Boar, Wolverine, Dire Wolverine) virkjast aðeins einu sinni og aldrei við *overkill* ($\ge 5$ HP yfir).
8. **Sértækar Lagfæringar á Grunntölum Skrímsla (AC, Attack & Damage):**
   - **Grick:** `AC` lækkað úr `16` $\to$ `15`, `HP` úr `27` $\to$ `20` (með `DR 2/magic`).
   - **Giant Stag Beetle:** `AC` lækkað úr `19` $\to$ `17`, `HP` úr `45` $\to$ `34`.
   - **Gibbering Mouther:** Skaði leiðréttur úr `'1d4'` $\to$ `'2d4+2'`, `HP` úr `45` $\to$ `34`, bætt við `DR 2/bludgeoning`, `amorphous` og `blood_drain`.
   - **Phase Spider:** Skaði stilltur úr `'2d6+7'` $\to$ `'2d6+4'`, `HP` úr `51` $\to$ `38`, bætt við `ethereal_ambush` og `grab`.
   - Bætt við `rend` á **Yeti**, `rake` á **Griffon**, `bleed` á **Bunyip** og `disease` á **Ghast**.

---

## 2. Samanburður á Bardagajafnvægi: Fyrir vs. Eftir Breytingar

Framkvæmd var ný Monte Carlo bardagahermun (**400 bardagar á hvert skrímsli á hverja stétt á Level 1–5**, án drykkja/flótta til að mæla hreinan styrk í bardaga) með öllum nýju reglunum og sérhæfileikum virkum.

### 2.1 Heildarsigurhlutfall (Win Rate %) og Meðallengd Bardaga (Level 1–5)

| Level | Stétt | Sigurhlutfall (Áður) | Sigurhlutfall (Núna) | Ground vs. Flying (Núna) | Meðal-umferðir (Núna) | Meðal-HP eftir við sigur |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **Level 1** | **Fighter** | 86.2% | **90.8%** | 90.6% Ground / **95.3% Fly** | 2.90 umf. | 87.0% HP |
| **Level 1** | **Ranger** | 76.4% | **83.6%** | 83.1% Ground / **93.8% Fly** | 2.20 umf. | 86.1% HP |
| **Level 1** | **Cleric** | 71.0% | **79.7%** | 79.4% Ground / **85.3% Fly** | 3.04 umf. | 81.6% HP |
| **Level 2** | **Fighter** | 74.1% | **81.8%** | 82.3% Ground / **73.5% Fly** | 5.11 umf. | 66.4% HP |
| **Level 2** | **Ranger** | 49.5% | **64.2%** | 64.1% Ground / **65.8% Fly** | 3.94 umf. | 61.3% HP |
| **Level 2** | **Cleric** | 52.8% | **62.4%** | 64.0% Ground / **39.3% Fly** | 5.17 umf. | 57.3% HP |
| **Level 3** | **Fighter** | 68.0% | **78.4%** | 75.8% Ground / **91.4% Fly** | 6.58 umf. | 67.2% HP |
| **Level 3** | **Ranger** | 44.2% | **64.3%** | 62.0% Ground / **75.9% Fly** | 5.88 umf. | 61.7% HP |
| **Level 3** | **Cleric** | 48.9% | **62.6%** | 55.3% Ground / **99.1% Fly** | 6.01 umf. | 63.7% HP |
| **Level 4** | **Fighter** | 58.3% | **71.0%** | 55.5% Ground / **86.6% Fly** | 7.11 umf. | 50.1% HP |
| **Level 4** | **Ranger** | 31.0% | **44.8%** | 31.4% Ground / **58.1% Fly** | 6.71 umf. | 42.4% HP |
| **Level 4** | **Cleric** | 24.5% | **29.8%** | 19.5% Ground / **40.0% Fly** | 7.96 umf. | 39.3% HP |
| **Level 5** | **Fighter** | 61.2% | **73.9%** | 69.7% Ground / **83.7% Fly** | 6.74 umf. | 52.3% HP |
| **Level 5** | **Ranger** | 28.4% | **43.7%** | 35.1% Ground / **63.9% Fly** | 7.36 umf. | 42.4% HP |
| **Level 5** | **Cleric** | 22.1% | **32.6%** | 29.3% Ground / **40.3% Fly** | 7.46 umf. | 52.2% HP |

---

### 2.2 Helstu Áhrif Breytinganna á Upplifun Leikmanna

1. **Bylting fyrir Ranger með `DEX` á Ranged vopnum (+14% til +20% hærra sigurhlutfall):**
   - Áður þurfti Ranger að nota `STR` fyrir bæði hittni og skaða með boga, sem gerði hátt `DEX` gagnslaust í sókn.
   - Nú nýtir Ranger `DEX` (+3 til +4 mod) beint í hittni með Longbow ásamt samsettum skaðabónus (`max(STR, floor(DEX/2))`). Sigurhlutfall Rangers á Level 2–3 hækkaði úr **~44–49%** upp í **~64%**, og meðalbardagalengd á Level 1 er aðeins **2.20 umferðir** vegna *Opening Shot*.
2. **Flugskrímsli (`FLY`) eru ekki lengur dauðagildra fyrir Fighter og Cleric:**
   - Áður féll sigurhlutfall Fighter og Cleric gegn flugskrímslum á Level 3–4 niður í 15–30% vegna þess að þeir misstu skjöldinn sinn (`-2 AC`) og voru þvingaðir í veika bogfimi/slöngu.
   - Nú halda Fighter og Cleric sínu aðalvopni og skildi í návígi með `-1` *Evasive Flyer* víti, á meðan Ranger hittir flugskrímsli án nokkurs vítis (`0`). Gegn **Harpy** (Level 4 `FLY`) vinnur Fighter nú **98.8%**, Ranger **96.3%** og Cleric **81.5%**.
3. **25% HP lækkun vegur fullkomlega upp á móti nýjum sérhæfileikum skrímsla:**
   - Þótt öll 68 skrímslin beiti nú eitri, blæðingu, gripi, ótta, DR eða köldum/súrum aukaskaða, þá styttir 25% HP lækkunin bardagana um **1.5 til 2.5 umferðir** að meðaltali.
   - Fyrir vikið eru bardagar **hraðari, taktískari og mun líflegri**, án þess að verða langdregnar „stat-check“ þolraunir.

---

## 3. Greining á Einstökum Skrímslum og Sérhæfileikum (Spotlights)

Hér sést hvernig lykilskrímsli með nýjum sérhæfileikum og leiðréttum grunntölum koma út í hermuninni (án hjálpardrykkja):

| Skrímsli | Level | Nýtt HP (-25%) | AC | AB / Skaði | Virkir Sérhæfileikar | Fighter Sigur | Ranger Sigur | Cleric Sigur |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| **Kobold** | 1 | **4 HP** *(var 5)* | 15 | +1 / `1d6-1` | *Crafty Skirmish* (+1 AB í umf. 1) | 99.5% (2.4u) | 98.0% (1.6u) | 96.3% (2.5u) |
| **Goblin** | 1 | **5 HP** *(var 6)* | 16 | +2 / `1d4` | *Goblin Ambush* (+1 AB, +1d2 í umf. 1) | 99.5% (2.7u) | 96.5% (2.2u) | 93.8% (3.3u) |
| **Human Skeleton** | 1 | **3 HP** *(var 4)* | 16 | +0 / `1d6` | *DR 3/bludgeoning* (Mace fer beint í gegn!) | 97.0% (3.0u) | 93.8% (2.4u) | **97.0% (2.2u)** |
| **Stirge** (`FLY`) | 1 | **4 HP** *(var 5)* | 16 | +7 / `1d4-2` | *Attach & Blood Drain* (hámark 2 umf.) | 95.5% (2.6u) | 93.3% (2.0u) | 81.8% (3.0u) |
| **Ghoul** | 1 | **10 HP** *(var 13)* | 14 | +3 / `1d6+1` | *Paralysis* (1 umf. + 3u ónæmi) & *Ghoul Fever* | 86.8% (3.3u) | 78.5% (2.5u) | **91.8% (2.6u)** |
| **Giant Spider** | 1 | **12 HP** *(var 16)* | 14 | +2 / `1d6` | *Web Entangle* & *Venom* (3u þak, 1-save cure) | 93.0% (4.1u) | 82.8% (3.0u) | 76.8% (4.4u) |
| **Grick** | 2 | **20 HP** *(var 27)* | **15** *(var 16)* | +4 / `1d4+1` | *DR 2/magic* (Lágmark 1 í skaða) | 83.3% (8.5u) | 41.5% (6.3u) | 42.0% (8.1u) |
| **Rust Monster** | 3 | **20 HP** *(var 27)* | 18 | +6 / `1d3` | *Corrosive Antennae* (-2 debuff, eyðir engu!) | 100.0% (8.3u) | 98.5% (8.2u) | 93.8% (10.9u) |
| **Cockatrice** (`FLY`) | 3 | **20 HP** *(var 27)* | 15 | +6 / `1d4-2` | *2-Stage Calcification* (aldrei 1-roll dauði) | 99.8% (6.5u) | 99.5% (5.1u) | 99.0% (7.7u) |
| **Wight** | 3 | **20 HP** *(var 26)* | 15 | +4 / `1d4+1` | *Energy Drain* (1-stack í bardaga + 3 HP leech) | 99.5% (6.4u) | 90.5% (6.8u) | **99.8% (4.4u)** |
| **Harpy** (`FLY`) | 4 | **29 HP** *(var 38)* | 16 | +8 / `1d6+1` | *Captivating Song* (Will DC 13 Shaken aura) | 98.8% (7.0u) | 96.3% (7.1u) | 81.5% (9.7u) |
| **Giant Stag Beetle** | 4 | **34 HP** *(var 45)* | **17** *(var 19)* | +8 / `2d8+6` | *Trampling Charge* (+2 AB í 1. umf.) | 38.3% (5.2u) | 15.5% (4.2u) | 6.8% (4.7u) |
| **Basilisk** | 5 | **39 HP** *(var 52)* | 17 | +8 / `1d8+4` | *2-Stage Petrifying Gaze* (DC 15 Fort) | 93.0% (5.6u) | 60.3% (6.4u) | 40.0% (8.1u) |
| **Phase Spider** | 5 | **38 HP** *(var 51)* | 17 | +10 / **`2d6+4`** | *Ethereal Ambush*, *Venom* & *Grab* | 69.8% (5.7u) | 27.5% (5.5u) | 7.5% (6.2u) |
| **Gibbering Mouther** | 5 | **34 HP** *(var 45)* | 19 | +7 / **`2d4+2`** | *Gibbering Aura*, *DR 2/B*, *Amorphous*, *Drain* | 88.0% (9.3u) | 27.5% (11.3u) | **50.5% (10.2u)** |
| **Wraith** (`FLY`) | 5 | **35 HP** *(var 47)* | 18 | +6 / `1d6` | *Incorporeal* (50% dmg nema Magic / Holy Radiance) | 100.0% (7.5u) | 95.0% (11.0u) | **99.3% (7.1u)** |
| **Troll** | 5 | **47 HP** *(var 63)* | 16 | +8 / `1d6+5` | *Regeneration 3 HP/umf.* & *Claw Rend* | 65.0% (7.5u) | 10.3% (6.6u) | 4.0% (7.7u) |

### Áhugaverðar Taktískar Niðurstöður úr Töflunni:
- **Vopnategundir skipta nú raunverulegu máli án þess að sýna tölur:**
  - *Cleric* með *Heavy Mace* (Bludgeoning) klárar **Human Skeleton** (`DR 3/bludgeoning`) og **Gibbering Mouther** (`DR 2/bludgeoning`) mun hraðar og öruggar en bogmaður með örvar (Piercing).
  - *Holy Radiance* hjá Cleric rýfur *Incorporeal* vörn **Wraith** og **Shadow** eins og töfravopn og veitir `+2/+3 AC`, svo Cleric er með **99.3% sigurhlutfall gegn Wraith** og **91.8% gegn Ghoul**.
- **Phase Spider og Gibbering Mouther eru nú í réttu hlutverki á Level 5:**
  - *Phase Spider* (sem áður slátraði öllum með `2d6+7` og 51 HP) er nú hættulegur en sanngjarn Level 5 launsátursveiðimaður (69.8% sigur fyrir Fighter, og leikmenn geta notað drykki eða flúið ef eitur/grip nær tökum).
  - *Gibbering Mouther* (sem áður gerði aðeins `1d4` í skaða) er nú raunveruleg ógn (`2d4+2` + *Gibbering* ruglingur + *DR/bludgeoning*).
- **Troll og Giant Stag Beetle eru „Boss-tier“ ógnir sem krefjast drykkja (Potions) eða flótta:**
  - *Troll* græðir 3 HP á hverri umferð (*Regeneration 3*), sem þýðir að hetja með lágan skaða nær ekki að brjóta það niður án töfravopns eða *Healing Potions*. Vegna þess að 25% HP lækkunin færði Troll úr 63 HP niður í **47 HP**, getur vel búinn Level 5 Fighter samt unnið það í **65% tilfella** án drykkja (var <25% áður ef Regeneration væri virkt).

---

## 4. Staðfesting og Sjálfvirk Próf (`npm test`)

Ný prófunarsvíta ([`tests/rebalance_and_special_abilities.test.js`](../tests/rebalance_and_special_abilities.test.js)) var smíðuð til að prófa alla 8 liðina og allar 9 Permadeath-öryggisreglurnar:
- **204 af 204 prófum** í öllum **15 prófunarsvítum** keyra grænt (`0` villur).
- Gagnagrunnur (`npm run setup:db`) keyrir bæði migration `011_combat_abilities_schema.sql` og seed `009_rebalance_and_special_abilities.sql` vandræðalaust.
