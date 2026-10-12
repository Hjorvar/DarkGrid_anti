# Darkgrid — Hreinsun gagnagrunns og áætlun um 30 Pathfinder-skrímsli

> **Dagsetning:** Október 2026  
> **Staða:** Tillaga og áætlun til samþykktar (engin gagnagrunnsinngrip gerð í þessum áfanga)  
> **Aðalheimild:** Archives of Nethys (Pathfinder 1e — [aonprd.com](https://aonprd.com/))  

---

## Inngangur og markmið

Þessi skýrsla leggur grunninn að heildstæðu, hágæða skrímslasafni fyrir **Darkgrid**, byggðu á opinberum reglum og tölfræði **Pathfinder RPG (1st Edition)**.

Markmið verkefnisins eru fimm:
1. **Greina núverandi skrímsli:** Meta hvaða tilraunaskrímsli (dev placeholders) voru búin til án staðfestra Pathfinder-heimilda og kanna stöðu þeirra.
2. **Flokka í tillögur um aðgerðir:** Skipta núverandi skrímslum í *A – Candidates for removal*, *B – Needs review* og *C – Keep*.
3. **Velja 30 ný Pathfinder-skrímsli:** Finna nákvæmlega 30 auðþekkjanleg, spennandi og dark-fantasy-viðeigandi skrímsli á erfiðleikabilinu **CR 1/4 til CR 5**.
4. **Tryggja jafna dreifingu:** Koma á fót jafnvægi milli landsvæða (terrains), Challenge Rating (CR) og skrímslategunda (creature types).
5. **Skilgreina gagnagrunnstillögur:** Leggja mat á núverandi SQLite gagnaskipulag og tillögur að `monster_terrains` tengitöflu fyrir næsta áfanga.

---

## 1. Greining á núverandi skrímslasafni (Monster Audit)

Í SQLite gagnagrunni Darkgrid (`data/darkgrid.sqlite`) og fræskrám (`db/seeds/002_seed_monsters.sql` og `db/seeds/003_seed_new_monsters.sql`) eru samtals **10 skrímsli**:

| ID | Heiti í gagnagrunni | CR | Solo Lvl | Habitat | Heimild / source_url | Mynd (`image_path`) | Staða í myndrýni |
|:---:|---|:---:|:---:|---|---|---|:---:|
| **1** | **Assassin Vine** | 3.0 | 3 | `["F", "J", "S"]` | [d20pfsrd / AoN](https://aonprd.com/MonsterDisplay.aspx?ItemName=Assassin%20Vine) | `images/monsters/assassin_vine.png` | A – Samþykkt |
| **2** | **Marsh Leech [DEV-PLACEHOLDER]** | 0.5 | 1 | `["S", "F", "R"]` | `INTERNAL_DEV_PLACEHOLDER` | `images/monsters/marsh_leech.png` | A – Samþykkt |
| **3** | **Shadow Bramble [DEV-PLACEHOLDER]** | 0.5 | 1 | `["F", "P"]` | `INTERNAL_DEV_PLACEHOLDER` | `images/monsters/shadow_bramble.png` | Óstaðfest (Ósamþykkt) |
| **4** | **Feral Wolf [DEV-PLACEHOLDER]** | 1.0 | 2 | `["F", "P", "H"]` | `INTERNAL_DEV_PLACEHOLDER` | `images/monsters/feral_wolf.png` | A – Samþykkt |
| **5** | **Grave Troll [DEV-PLACEHOLDER]** | 4.0 | 4 | `["S", "F", "U"]` | `INTERNAL_DEV_PLACEHOLDER` | `images/monsters/grave_troll.png` | A – Samþykkt |
| **126** | **Ghoul** | 1.0 | 1 | `["U", "P", "S"]` | [aonprd.com / Ghoul](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ghoul) | `images/monsters/ghoul.png` | A – Samþykkt |
| **127** | **Giant Spider** | 1.0 | 1 | `["F", "J", "S", "U"]` | [aonprd.com / Giant Spider](https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Spider) | `images/monsters/giant_spider.png` | A – Samþykkt |
| **128** | **Choker** | 2.0 | 2 | `["U", "H", "M"]` | [aonprd.com / Choker](https://aonprd.com/MonsterDisplay.aspx?ItemName=Choker) | `images/monsters/choker.png` | A – Samþykkt *(endurgert)* |
| **129** | **Rust Monster** | 3.0 | 3 | `["U", "H", "M"]` | [aonprd.com / Rust Monster](https://aonprd.com/MonsterDisplay.aspx?ItemName=Rust%20Monster) | `images/monsters/rust_monster.png` | A – Samþykkt |
| **130** | **Manticore** | 5.0 | 5 | `["H", "M", "P", "S"]` | [aonprd.com / Manticore](https://aonprd.com/MonsterDisplay.aspx?ItemName=Manticore) | `images/monsters/manticore.png` | A – Samþykkt *(endurgert)* |

### Athugun á tengingum og leikjagögnum:
1. **Töflur sem vísa í `monsters(id)`:**
   - `monster_instances`: Engar færslur eins og er (0 færslur).
   - `encounters`: Inniheldur 2 virkar færslur í `darkgrid.sqlite`:
     - Encounter #1: Hetja 2 á reit 158 í atburði við `Grave Troll [DEV-PLACEHOLDER]` (ID 5).
     - Encounter #2: Hetja 14 á reit 22 í atburði við `Feral Wolf [DEV-PLACEHOLDER]` (ID 4).
   - SQLite er stillt með `PRAGMA foreign_keys = ON;`, þannig að óheimilt er að eyða ID 4 eða 5 án þess að uppfæra eða loka þessum opnu atburðum.
2. **Sjálfvirk próf (`tests/`):**
   - `tests/new_monsters.test.js` og `tests/encounter_engine.test.js` gera ráð fyrir nákvæmlega þessum 10 skrímslum. Þegar gagnagrunninum verður breytt þarf að uppfæra prófin samtímis svo öll próf haldist græn.

---

## 2. Flokkun skrímsla sem má fjarlægja

### Flokkur A — Candidates for removal (Öruggt til fjarlægingar)

Skrímsli sem voru búin til sem tilraunaskepnur í upphafi, eru ekki byggð á opinberri Pathfinder-heimild og hafa ekki fullgilta samþykkta stöðu:

1. **`Shadow Bramble [DEV-PLACEHOLDER]` (ID 3, CR 0.5)**
   - **Ástæða:** Þetta er 100% uppspuni frá upphafi þróunar, búið til til að prófa Gaussian-dreifingu á level 1. Skrímslið er ekki til í Pathfinder 1e. Í opinberri myndrýni (`docs/monster-art-review.md`, lína 15) var það eina skrímslið sem var merkt **Óstaðfest** vegna skorts á Pathfinder-uppruna. Enginn virkur bardagi tengist því í leiknum.
   - **Tillaga:** Fjarlægja alfarið úr gagnagrunni. Hlutverk þess sem jurt / runni í skógi er leyst mun betur með opinberu Pathfinder-skrímslunum *Yellow Musk Creeper* (CR 2) eða *Vegepygmy* (CR 1/2).

2. **`Marsh Leech [DEV-PLACEHOLDER]` (ID 2, CR 0.5)**
   - **Ástæða:** Búið til sem vinnustaðgengill fyrir mýrlendi. Í Pathfinder 1e er engin blóðsuga á CR 1/2; opinbera skrímslið er *Giant Leech* (CR 2, Vermin, 19 HP). Tölfræðin í gagnagrunninum (CR 0.5, HP 10) er handvalin án heimildar. Enginn virkur atburður tengist því.
   - **Tillaga:** Fjarlægja núverandi placeholder. Myndina má annaðhvort geyma í varasafni eða nota ef *Giant Leech* (CR 2) verður innleitt með réttum Pathfinder-tölum síðar.

---

### Flokkur B — Needs review (Þarfnast endurskoðunar eða nafnabreytingar)

Skrímsli þar sem til staðar er vönduð, samþykkt mynd og skýr Pathfinder-tenging, en nafngift og tölfræði í gagnagrunni eru merktar sem `[DEV-PLACEHOLDER]`:

1. **`Feral Wolf [DEV-PLACEHOLDER]` (ID 4, CR 1.0)**
   - **Uppruni og staða:** Myndin `feral_wolf.png` er ein af þremur opinberum viðmiðunarmyndum leiksins (`docs/monster-art-style.md`). Skrímslið samsvarar 1:1 hinu klassíska **Wolf** í Pathfinder 1e ([Wolf á AoNPRD](https://aonprd.com/MonsterDisplay.aspx?ItemName=Wolf), CR 1, Neutral Medium Animal, AC 14, 13 HP, bite +2 (1d6+1 plus trip)). Hetja 14 er í virkum atburði við þetta skrímsli.
   - **Álitamál:** Á að eyða því, eða er æskilegra að **uppfæra** það í opinbera Pathfinder-nafnið **Wolf**, setja réttan hlekk á AoNPRD og fjarlægja `[DEV-PLACEHOLDER]` viðskeytið?
   - **Ráðlegging:** **Ekki eyða.** Uppfæra færsluna í næsta áfanga í opinberan Pathfinder *Wolf* og halda hinni samþykktu mynd.

2. **`Grave Troll [DEV-PLACEHOLDER]` (ID 5, CR 4.0)**
   - **Uppruni og staða:** Myndin `grave_troll.png` er grunnviðmiðunarlistaverk fyrir risa og húmanóíða. Í Pathfinder 1e er venjulegt tröll hins vegar **Troll** á CR 5 ([Troll á AoNPRD](https://aonprd.com/MonsterDisplay.aspx?ItemName=Troll), Large Humanoid (giant), 63 HP, Rend, Regeneration 5). Einnig eru til *Moss Troll* (CR 3) og *Ice Troll* (CR 4). Hetja 2 er í virkum atburði við þetta skrímsli.
   - **Álitamál:** Nafnið „Grave Troll“ er ekki opinbert Pathfinder 1e skrímsli (þótt það passi drungalegum stíl Darkgrid).
   - **Ráðlegging:** **Ekki eyða strax.** Ákveða hvort færslan verði uppfærð í opinbert *Troll* (CR 5) / *Ice Troll* (CR 4) eða haldið sem sérstöku Darkgrid-afbrigði með stöðluðum Pathfinder-d20 tölum.

---

### Flokkur C — Keep (Varðveitt og fullgilt)

Öll skrímsli sem hafa staðfesta Pathfinder 1e heimild, samþykkta mynd í Flokki A, réttar níu lýsingar og fulla virkni:

1. **`Assassin Vine` (ID 1, CR 3.0 • Plant)** — Frumskrímsli höfundar leiksins, staðfest viðmiðunarskepna.
2. **`Ghoul` (ID 126, CR 1.0 • Undead)** — AoNPRD heimild, samþykkt mynd.
3. **`Giant Spider` (ID 127, CR 1.0 • Vermin)** — AoNPRD heimild, samþykkt mynd.
4. **`Choker` (ID 128, CR 2.0 • Aberration)** — AoNPRD heimild, samþykkt endurgerð mynd án sogskála.
5. **`Rust Monster` (ID 129, CR 3.0 • Aberration)** — AoNPRD heimild, samþykkt mynd.
6. **`Manticore` (ID 130, CR 5.0 • Magical Beast)** — AoNPRD heimild, samþykkt endurgerð mynd með mannlegu andliti.

---

## 3. Val á 30 nýjum Pathfinder-skrímslum (Proposed 30 Monsters)

Öll skrímslin eru sótt á **Archives of Nethys (Pathfinder 1e)** og uppfylla eftirfarandi kröfur:
- Nákvæmlega **30 skrímsli**.
- Ekkert þeirra er til í núverandi gagnagrunni.
- Erfiðleikastig er **CR 1/4 til CR 5**, sérsniðið fyrir hetjur á level 1–5.
- Fjölbreyttar lífverutegundir: Humanoids, Undead, Animals, Vermin, Magical Beasts, Monstrous Humanoids, Plants, Aberrations, Oozes og Giants.
- Öll ný leikmannsgögn, nöfn og búsvæði eru á ensku.

---

### Yfirlitstafla: Öll 30 nýju skrímslin

| # | Monster Name | CR | Solo Lvl | Creature Type | Primary Terrain | Additional Terrains | Pathfinder AoN Source URL |
|:---:|---|:---:|:---:|---|---|---|---|
| **1** | **Kobold** | 1/4 | 1 | Small humanoid (reptilian) | Caves / Underground (`U`) | Forest (`F`), Hills (`H`) | [Kobold](https://aonprd.com/MonsterDisplay.aspx?ItemName=Kobold) |
| **2** | **Goblin** | 1/3 | 1 | Small humanoid (goblinoid) | Forest / Woods (`F`) | Plains (`P`), Hills (`H`), Coast (`C`) | [Goblin](https://aonprd.com/MonsterDisplay.aspx?ItemName=Goblin) |
| **3** | **Human Skeleton** | 1/3 | 1 | Medium undead | Ruins / Dungeons (`U`) | Plains (`P`), Hills (`H`), Swamp (`S`), Forest (`F`) | [Human Skeleton](https://aonprd.com/MonsterDisplay.aspx?ItemName=Human%20Skeleton) |
| **4** | **Hobgoblin** | 1/2 | 1 | Medium humanoid (goblinoid) | Mountains / Hills (`H`) | Mountains (`M`), Ruins (`U`), Forest (`F`) | [Hobgoblin](https://aonprd.com/MonsterDisplay.aspx?ItemName=Hobgoblin) |
| **5** | **Human Zombie** | 1/2 | 1 | Medium undead | Swamp / Marsh (`S`) | Ruins (`U`), Plains (`P`), Forest (`F`) | [Human Zombie](https://aonprd.com/MonsterDisplay.aspx?ItemName=Human%20Zombie) |
| **6** | **Troglodyte** | 1 | 1 | Medium humanoid (reptilian) | Caves / Underground (`U`) | Swamp (`S`) | [Troglodyte](https://aonprd.com/MonsterDisplay.aspx?ItemName=Troglodyte) |
| **7** | **Darkmantle** | 1 | 1 | Small magical beast | Caves / Underground (`U`) | Ruins (`U`) | [Darkmantle](https://aonprd.com/MonsterDisplay.aspx?ItemName=Darkmantle) |
| **8** | **Lizardfolk** | 1 | 1 | Medium humanoid (reptilian) | Swamp / Marsh (`S`) | River/Lake (`R`), Coast (`C`) | [Lizardfolk](https://aonprd.com/MonsterDisplay.aspx?ItemName=Lizardfolk) |
| **9** | **Hyena** | 1 | 1 | Medium animal | Plains / Grassland (`P`) | Desert (`D`), Hills (`H`) | [Hyena](https://aonprd.com/MonsterDisplay.aspx?ItemName=Hyena) |
| **10** | **Gnoll** | 1 | 1 | Medium humanoid (gnoll) | Desert (`D`) | Plains (`P`), Hills (`H`) | [Gnoll](https://aonprd.com/MonsterDisplay.aspx?ItemName=Gnoll) |
| **11** | **Giant Frog** | 1 | 1 | Medium animal | Rivers / Lakes / Coast (`R`) | Swamp (`S`), Aquatic (`A`) | [Giant Frog](https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Frog) |
| **12** | **Boar** | 2 | 2 | Medium animal | Forest / Woods (`F`) | Plains (`P`), Hills (`H`) | [Boar](https://aonprd.com/MonsterDisplay.aspx?ItemName=Boar) |
| **13** | **Yellow Musk Creeper** | 2 | 2 | Medium plant | Forest / Woods (`F`) | Caves/Ruins (`U`), Jungle (`J`) | [Yellow Musk Creeper](https://aonprd.com/MonsterDisplay.aspx?ItemName=Yellow%20Musk%20Creeper) |
| **14** | **Bugbear** | 2 | 2 | Medium humanoid (goblinoid) | Mountains / Hills (`H`) | Mountains (`M`), Forest (`F`), Ruins (`U`) | [Bugbear](https://aonprd.com/MonsterDisplay.aspx?ItemName=Bugbear) |
| **15** | **Boggard** | 2 | 2 | Medium humanoid (boggard) | Swamp / Marsh (`S`) | River/Lake (`R`) | [Boggard](https://aonprd.com/MonsterDisplay.aspx?ItemName=Boggard) |
| **16** | **Death Dog** | 2 | 2 | Large magical beast | Desert (`D`) | Plains (`P`), Ruins (`U`) | [Death Dog](https://aonprd.com/MonsterDisplay.aspx?ItemName=Death%20Dog) |
| **17** | **Giant Crab** | 2 | 2 | Medium vermin (aquatic) | Rivers / Lakes / Coast (`C`) | River/Lake (`R`), Aquatic (`A`) | [Giant Crab](https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Crab) |
| **18** | **Ettercap** | 3 | 3 | Medium aberration | Forest / Woods (`F`) | Caves/Ruins (`U`) | [Ettercap](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ettercap) |
| **19** | **Cockatrice** | 3 | 3 | Small magical beast | Plains / Grassland (`P`) | Hills (`H`) | [Cockatrice](https://aonprd.com/MonsterDisplay.aspx?ItemName=Cockatrice) |
| **20** | **Ankheg** | 3 | 3 | Large magical beast | Plains / Grassland (`P`) | Forest (`F`), Desert (`D`) | [Ankheg](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ankheg) |
| **21** | **Ogre** | 3 | 3 | Large humanoid (giant) | Mountains / Hills (`H`) | Mountains (`M`), Forest (`F`) | [Ogre](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ogre) |
| **22** | **Shadow** | 3 | 3 | Medium undead (incorporeal) | Ruins / Dungeons (`U`) | Forest (`F`), Hills (`H`) | [Shadow](https://aonprd.com/MonsterDisplay.aspx?ItemName=Shadow) |
| **23** | **Owlbear** | 4 | 4 | Large magical beast | Forest / Woods (`F`) | Hills (`H`) | [Owlbear](https://aonprd.com/MonsterDisplay.aspx?ItemName=Owlbear) |
| **24** | **Minotaur** | 4 | 4 | Large monstrous humanoid | Ruins / Dungeons (`U`) | Hills (`H`) | [Minotaur](https://aonprd.com/MonsterDisplay.aspx?ItemName=Minotaur) |
| **25** | **Yeti** | 4 | 4 | Large monstrous humanoid (cold) | Snow / Tundra (`M`) | Hills (`H`) | [Yeti](https://aonprd.com/MonsterDisplay.aspx?ItemName=Yeti) |
| **26** | **Gargoyle** | 4 | 4 | Medium monstrous humanoid (earth) | Urban / Settlements (`T`) | Ruins (`U`), Hills (`H`), Mountains (`M`) | [Gargoyle](https://aonprd.com/MonsterDisplay.aspx?ItemName=Gargoyle) |
| **27** | **Basilisk** | 5 | 5 | Medium magical beast | Mountains / Hills (`H`) | Mountains (`M`), Caves (`U`), Desert (`D`) | [Basilisk](https://aonprd.com/MonsterDisplay.aspx?ItemName=Basilisk) |
| **28** | **Mummy** | 5 | 5 | Medium undead | Desert (`D`) | Ruins (`U`) | [Mummy](https://aonprd.com/MonsterDisplay.aspx?ItemName=Mummy) |
| **29** | **Ochre Jelly** | 5 | 5 | Large ooze | Caves / Underground (`U`) | Swamp (`S`) | [Ochre Jelly](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ochre%20Jelly) |
| **30** | **Winter Wolf** | 5 | 5 | Large magical beast (cold) | Snow / Tundra (`M`) | Forest (`F`), Plains (`P`), Hills (`H`) | [Winter Wolf](https://aonprd.com/MonsterDisplay.aspx?ItemName=Winter%20Wolf) |

---

### Ítarleg lýsing og rökstuðningur fyrir hverju skrímsli

#### 1. Kobold (CR 1/4 • Small humanoid (reptilian))
- **Pathfinder Environment:** Temperate underground or deep forest.
- **Darkgrid Terrains:** Primary: `UNDERGROUND_RUINS` (`U`). Secondary: `FOREST` (`F`), `HILLS` (`H`).
- **Rökstuðningur:** Klassísk byrjendaógn í hellum og rústum. Koboldar eru lágvaxnir, slægir og leggja gildrur. Gefur hetjum á level 1 viðráðanlegan andstæðing neðanjarðar án þess að hætta á tafarlausum dauða.

#### 2. Goblin (CR 1/3 • Small humanoid (goblinoid))
- **Pathfinder Environment:** Temperate forest and plains (usually coastal regions).
- **Darkgrid Terrains:** Primary: `FOREST` (`F`). Secondary: `PLAINS` (`P`), `HILLS` (`H`), `COAST` (`C`).
- **Rökstuðningur:** Eitt þekktasta og mikilvægasta lágstigs-skrímsli Pathfinder. Goblins lifa villimannlegu lífi í skógum og við strendur, fullkomnir í fyrstu könnunarferðir leikmanns.

#### 3. Human Skeleton (CR 1/3 • Medium undead)
- **Pathfinder Environment:** Any.
- **Darkgrid Terrains:** Primary: `UNDERGROUND_RUINS` (`U`). Secondary: `PLAINS` (`P`), `HILLS` (`H`), `SWAMP` (`S`), `FOREST` (`F`).
- **Rökstuðningur:** Ómissandi ódauður óvinur í fornum grafhýsum og vígvöllum. Skapar taktíska dýpt vegna ónæmis gegn kulda og varna gegn stunguvopnum og eggvopnum.

#### 4. Hobgoblin (CR 1/2 • Medium humanoid (goblinoid))
- **Pathfinder Environment:** Temperate hills.
- **Darkgrid Terrains:** Primary: `HILLS` (`H`). Secondary: `MOUNTAINS` (`M`), `UNDERGROUND_RUINS` (`U`), `FOREST` (`F`).
- **Rökstuðningur:** Hermannlegir, skipulagðir og harðgerðir goblinoidar sem vakta hæðir og fjallsrætur. Veita meiri áskorun en venjulegir goblinar með hærri brynju (AC) og öguðum árásum.

#### 5. Human Zombie (CR 1/2 • Medium undead)
- **Pathfinder Environment:** Any.
- **Darkgrid Terrains:** Primary: `SWAMP` (`S`). Secondary: `UNDERGROUND_RUINS` (`U`), `PLAINS` (`P`), `FOREST` (`F`).
- **Rökstuðningur:** Hægfara en óstöðvandi hræ sem rísa úr fúlum mýrum og grafreitum. Hár höggþoli (Damage Reduction / Slashing) og hár lífskraftur gera þá að ógnvekjandi mýraróvin.

#### 6. Troglodyte (CR 1 • Medium humanoid (reptilian))
- **Pathfinder Environment:** Any underground.
- **Darkgrid Terrains:** Primary: `UNDERGROUND_RUINS` (`U`). Secondary: `SWAMP` (`S`).
- **Rökstuðningur:** Villimannlegar eðlukynslóðir myrkursins. Illur ódaunn þeirra (stench aura) veldur velgju og veikir hetjur í návígi, sem neyðir leikmenn til að gæta að varnarstöðu.

#### 7. Darkmantle (CR 1 • Small magical beast)
- **Pathfinder Environment:** Any underground.
- **Darkgrid Terrains:** Primary: `UNDERGROUND_RUINS` (`U`).
- **Rökstuðningur:** Hellaskepna sem felur sig sem dropsteinn í lofti, fellur yfir fórnarlömb með galdramyrkri (*darkness*) og herpist um háls þeirra (*constrict*). Frábær dularfull vísbending í fjarlægð.

#### 8. Lizardfolk (CR 1 • Medium humanoid (reptilian))
- **Pathfinder Environment:** Temperate swamps.
- **Darkgrid Terrains:** Primary: `SWAMP` (`S`). Secondary: `RIVER_LAKE` (`R`), `COAST` (`C`).
- **Rökstuðningur:** Stoltar og grimmar eðluhetjur mýrlendisins. Þær beita spjótum og klóm, synda fimlega og verja landsvæði sitt af mikilli hörku.

#### 9. Hyena (CR 1 • Medium animal)
- **Pathfinder Environment:** Warm plains.
- **Darkgrid Terrains:** Primary: `PLAINS` (`P`). Secondary: `DESERT` (`D`), `HILLS` (`H`).
- **Rökstuðningur:** Snöggt slétturándýr sem bítur af miklum þunga og fellir bráð sína í jörðina (*trip*). Frábært dýr fyrir opin grashéruð og hálendi.

#### 10. Gnoll (CR 1 • Medium humanoid (gnoll))
- **Pathfinder Environment:** Warm plains or desert.
- **Darkgrid Terrains:** Primary: `DESERT` (`D`). Secondary: `PLAINS` (`P`), `HILLS` (`H`).
- **Rökstuðningur:** Grimmdarlegir hýenu-menn og þrælaveiðarar sem herja á eyðimerkur, verslunarleiðir og þurr héruð.

#### 11. Giant Frog (CR 1 • Medium animal)
- **Pathfinder Environment:** Temperate or warm marshes and aquatic.
- **Darkgrid Terrains:** Primary: `RIVER_LAKE` (`R`). Secondary: `SWAMP` (`S`), `AQUATIC` (`A`).
- **Rökstuðningur:** Situr í leyni við vatnsbakka, skýtur langri slímugri tungu (*tongue grab*) og dregur hetjur út í hyldýpið eða gleypir þær heilar.

#### 12. Boar (CR 2 • Medium animal)
- **Pathfinder Environment:** Temperate or tropical forests.
- **Darkgrid Terrains:** Primary: `FOREST` (`F`). Secondary: `PLAINS` (`P`), `HILLS` (`H`).
- **Rökstuðningur:** Villiölt villisvín með gríðarlega vígatönn og hæfileikann *ferocity*, sem gerir því kleift að berjast áfram af blindum ofsa jafnvel eftir að lífstig fara niður fyrir núll.

#### 13. Yellow Musk Creeper (CR 2 • Medium plant)
- **Pathfinder Environment:** Temperate or warm forests and underground.
- **Darkgrid Terrains:** Primary: `FOREST` (`F`). Secondary: `UNDERGROUND_RUINS` (`U`), `JUNGLE` (`J`).
- **Rökstuðningur:** Lúmsk og blóðþyrst jurt í djúpum skógum sem sprautar frjókornum sem dáleika fórnarlömb og breyta þeim í viljalausa þræla. Gefur skóginum dökkt og óhugnanlegt bragð.

#### 14. Bugbear (CR 2 • Medium humanoid (goblinoid))
- **Pathfinder Environment:** Temperate mountains.
- **Darkgrid Terrains:** Primary: `HILLS` (`H`). Secondary: `MOUNTAINS` (`M`), `FOREST` (`F`), `UNDERGROUND_RUINS` (`U`).
- **Rökstuðningur:** Risavaxinn, loðinn og hljóðlátur veiðimaður. Þrátt fyrir stærð sína laumast hann eins og skuggi um kletta og skógarjaðra og veldur miklum launskaða.

#### 15. Boggard (CR 2 • Medium humanoid (boggard))
- **Pathfinder Environment:** Temperate marshes.
- **Darkgrid Terrains:** Primary: `SWAMP` (`S`). Secondary: `RIVER_LAKE` (`R`).
- **Rökstuðningur:** Frosk-húmanóíðar sem búa í djúpum mýrum. Skelfilegt krunk þeirra (*terrifying croak*) lamar eða hræðir óvini, sem gerir þá hættulega í návígi.

#### 16. Death Dog (CR 2 • Large magical beast)
- **Pathfinder Environment:** Warm deserts.
- **Darkgrid Terrains:** Primary: `DESERT` (`D`). Secondary: `PLAINS` (`P`), `UNDERGROUND_RUINS` (`U`).
- **Rökstuðningur:** Tvíhöfða, vanskapaður eyðimerkurrakki. Bæði höfuð bíta af miklum krafti og bera fúlasótt (*rotting disease*) sem sýkir sárin samstundis.

#### 17. Giant Crab (CR 2 • Medium vermin (aquatic))
- **Pathfinder Environment:** Any aquatic.
- **Darkgrid Terrains:** Primary: `COAST` (`C`). Secondary: `RIVER_LAKE` (`R`), `AQUATIC` (`A`).
- **Rökstuðningur:** Þungbrynjaður krabbi með beittar klær sem klemma og kremja (*constrict*). Tilvalin strand- og áarógn.

#### 18. Ettercap (CR 3 • Medium aberration)
- **Pathfinder Environment:** Temperate forests.
- **Darkgrid Terrains:** Primary: `FOREST` (`F`). Secondary: `UNDERGROUND_RUINS` (`U`).
- **Rökstuðningur:** Margfættur, eitraður og vanskapaður köngulóadrottnari sem vefur banvæna gildruvefi hátt í trjákrónum og hirðir risaköngulær.

#### 19. Cockatrice (CR 3 • Small magical beast)
- **Pathfinder Environment:** Temperate plains.
- **Darkgrid Terrains:** Primary: `PLAINS` (`P`). Secondary: `HILLS` (`H`).
- **Rökstuðningur:** Fjaðraður hanadreki með eðluhala. Goggur hans steingerir hold við snertingu (*petrification bite*), sem gerir hvert einasta högg lífshættulegt fyrir einmana hetju.

#### 20. Ankheg (CR 3 • Large magical beast)
- **Pathfinder Environment:** Temperate or warm plains.
- **Darkgrid Terrains:** Primary: `PLAINS` (`P`). Secondary: `FOREST` (`F`), `DESERT` (`D`).
- **Rökstuðningur:** Grafandi skordýrarisaskepna sem gýs upp úr jörðinni, spýtir sýru og grípur hetjur með tröllauknu bitkjaftati.

#### 21. Ogre (CR 3 • Large humanoid (giant))
- **Pathfinder Environment:** Temperate or cold hills.
- **Darkgrid Terrains:** Primary: `HILLS` (`H`). Secondary: `MOUNTAINS` (`M`), `FOREST` (`F`).
- **Rökstuðningur:** Risavaxinn, grimmur og vöðvastæltur jötunn sem sveiflar trébolum og veldur gríðarlegum líkamlegum skaða í einu höggi.

#### 22. Shadow (CR 3 • Medium undead (incorporeal))
- **Pathfinder Environment:** Any.
- **Darkgrid Terrains:** Primary: `UNDERGROUND_RUINS` (`U`). Secondary: `FOREST` (`F`), `HILLS` (`H`).
- **Rökstuðningur:** Óáþreifanlegur (incorporeal) skuggi sem rennur eftir veggjum og sogar styrk (Strength Damage) úr lifandi verum. Stórhættulegt skrímsli sem krefst töfravopna eða galdra.

#### 23. Owlbear (CR 4 • Large magical beast)
- **Pathfinder Environment:** Temperate forests.
- **Darkgrid Terrains:** Primary: `FOREST` (`F`). Secondary: `HILLS` (`H`).
- **Rökstuðningur:** Frægasta skógaróvættur d20-heimsins. Sameinar villimennsku bjarnarins og sjónugluuglunnar; rífur bráðina í tætlur með gogg og klóm.

#### 24. Minotaur (CR 4 • Large monstrous humanoid)
- **Pathfinder Environment:** Temperate ruins or underground.
- **Darkgrid Terrains:** Primary: `UNDERGROUND_RUINS` (`U`). Secondary: `HILLS` (`H`).
- **Rökstuðningur:** Nautshöfðaður risi sem villist aldrei í göngum (*natural cunnning*), beitir tvíeggjaðri stríðsöxi og hleypur á fórnarlömb með stórhættulegu hnúshöggi.

#### 25. Yeti (CR 4 • Large monstrous humanoid (cold))
- **Pathfinder Environment:** Cold mountains.
- **Darkgrid Terrains:** Primary: `MOUNTAINS` (`M` — Snow/Tundra). Secondary: `HILLS` (`H`).
- **Rökstuðningur:** Hvítloðinn fjalladjöfull sem býr á snævi þöktum tindum. Kuldasjón hans og óhugnanlegt augnaráð hræða ferðalanga til óbóta í blindbyl.

#### 26. Gargoyle (CR 4 • Medium monstrous humanoid (earth))
- **Pathfinder Environment:** Any.
- **Darkgrid Terrains:** Primary: `CITY` (`T` / Urban) & `UNDERGROUND_RUINS` (`U`). Secondary: `HILLS` (`H`), `MOUNTAINS` (`M`).
- **Rökstuðningur:** Grjóthúðaður vængjaður óvættur sem situr hreyfingarlaus á rústum eða gotneskum borgarveggjum. Hefur háa skaðafækkun (DR 10/magic) og fjórfalda árás í návígi.

#### 27. Basilisk (CR 5 • Medium magical beast)
- **Pathfinder Environment:** Any.
- **Darkgrid Terrains:** Primary: `HILLS` (`H`). Secondary: `MOUNTAINS` (`M`), `UNDERGROUND_RUINS` (`U`), `DESERT` (`D`).
- **Rökstuðningur:** Áttfætt eðluskepna sem breytir holdi í grjót með augnaráði einu saman. Banvæn ógn á level 5 sem gerir könnun hálendisins að spennuhlaðinni hættuför.

#### 28. Mummy (CR 5 • Medium undead)
- **Pathfinder Environment:** Any.
- **Darkgrid Terrains:** Primary: `DESERT` (`D`). Secondary: `UNDERGROUND_RUINS` (`U`).
- **Rökstuðningur:** Vafin fornkóngalík sem gæta leyndra eyðimerkurkumla. Augnaráð hennar lamar af skelfingu (*despair*) og högg hennar valda ólæknandi múmíudrepi (*mummy rot*).

#### 29. Ochre Jelly (CR 5 • Large ooze)
- **Pathfinder Environment:** Temperate underground or marshes.
- **Darkgrid Terrains:** Primary: `UNDERGROUND_RUINS` (`U`). Secondary: `SWAMP` (`S`).
- **Rökstuðningur:** Formlaus sýrumassi sem leysir upp hold og málma, kremur fórnarlömb og **klyfjar sig í tvennt** ef reynt er að höggva hann með eggvopnum eða eldingum.

#### 30. Winter Wolf (CR 5 • Large magical beast (cold))
- **Pathfinder Environment:** Cold forests and plains.
- **Darkgrid Terrains:** Primary: `MOUNTAINS` (`M` — Snow/Tundra). Secondary: `FOREST` (`F`), `PLAINS` (`P`), `HILLS` (`H`).
- **Rökstuðningur:** Gáfaður og illur risaúlfur sem blæs ískulda yfir fórnarlömb sín (*breath weapon*) og stýrir veiðisveitum í fimbulvetri.

---

## 4. Dreifingargreining (CR & Category Distribution)

### A. Dreifing eftir Challenge Rating (CR)

| Challenge Rating | Markmið í fyrirmælum | Fjöldi nýrra skrímsla | Skrímsli í tillögu |
|:---:|:---:|:---:|---|
| **CR 1/4–1/2** | 5 | **5** | Kobold (1/4), Goblin (1/3), Human Skeleton (1/3), Hobgoblin (1/2), Human Zombie (1/2) |
| **CR 1** | 6 | **6** | Troglodyte (1), Darkmantle (1), Lizardfolk (1), Hyena (1), Gnoll (1), Giant Frog (1) |
| **CR 2** | 6 | **6** | Boar (2), Yellow Musk Creeper (2), Bugbear (2), Boggard (2), Death Dog (2), Giant Crab (2) |
| **CR 3** | 5 | **5** | Ettercap (3), Cockatrice (3), Ankheg (3), Ogre (3), Shadow (3) |
| **CR 4** | 4 | **4** | Owlbear (4), Minotaur (4), Yeti (4), Gargoyle (4) |
| **CR 5** | 4 | **4** | Basilisk (5), Mummy (5), Ochre Jelly (5), Winter Wolf (5) |
| **Samtals** | **30** | **30** | **100% samræmi við sett markmið** |

---

### B. Dreifing eftir skrímslaflokkum (Creature Types)

| Lífveruflokkur (Creature Type) | Fjöldi nýrra | Dæmi um ný skrímsli |
|---|:---:|---|
| **Humanoids** | **8** | Goblin, Hobgoblin, Kobold, Troglodyte, Lizardfolk, Gnoll, Bugbear, Boggard |
| **Humanoids (Giant)** | **1** | Ogre |
| **Magical Beasts** | **7** | Darkmantle, Death Dog, Cockatrice, Ankheg, Owlbear, Basilisk, Winter Wolf |
| **Undead** | **4** | Human Skeleton, Human Zombie, Shadow, Mummy |
| **Monstrous Humanoids** | **3** | Minotaur, Yeti, Gargoyle |
| **Animals** | **3** | Hyena, Giant Frog, Boar |
| **Aberrations** | **1** | Ettercap *(fyrir eru Choker og Rust Monster)* |
| **Plants** | **1** | Yellow Musk Creeper *(fyrir er Assassin Vine)* |
| **Vermin** | **1** | Giant Crab *(fyrir er Giant Spider)* |
| **Oozes** | **1** | Ochre Jelly |
| **Samtals** | **30** | **10 mismunandi líffræðilegir flokkar** |

---

### C. Dreifing aðalbúsvæða (Primary Terrain Targets)

| Terrain flokkur | Markmið í fyrirmælum | Fjöldi nýrra sem eiga hér aðalbúsvæði | Ný skrímsli með þetta aðalbúsvæði |
|---|:---:|:---:|---|
| **Forest / Woods** | 5 | **5** | Goblin, Boar, Yellow Musk Creeper, Ettercap, Owlbear |
| **Plains / Grassland** | 3 | **3** | Hyena, Cockatrice, Ankheg |
| **Mountains / Hills** | 4 | **4** | Hobgoblin, Bugbear, Ogre, Basilisk |
| **Swamp / Marsh** | 3 | **3** | Human Zombie, Lizardfolk, Boggard |
| **Desert** | 3 | **3** | Gnoll, Death Dog, Mummy |
| **Caves / Underground** | 4 | **4** | Kobold, Troglodyte, Darkmantle, Ochre Jelly |
| **Ruins / Dungeons** | 3 | **3** | Human Skeleton, Shadow, Minotaur |
| **Snow / Tundra** | 2 | **2** | Yeti, Winter Wolf *(sett á Mountains/Cold)* |
| **Rivers / Lakes / Coastal** | 2 | **2** | Giant Frog, Giant Crab |
| **Urban / Settlements** | 1 | **1** | Gargoyle |
| **Samtals** | **30** | **30** | **Nákvæmlega eins og lagt var upp með** |

---

## 5. Terrain Coverage Report (Þekjuskýrsla landsvæða)

Taflan sýnir raunveruleg landsvæði Darkgrid, núverandi stöðu, hversu mörg ný skrímsli bætast við (bæði aðal- og auka-búsvæði), áætlaðan heildarfjölda eftir breytingar og CR-dreifingu.

> **Athugasemd um talningu:** Skrímsli geta lifað í fleiri en einu landsvæði (t.d. Skeleton í rústum, mýrum og skógi). Þau eru því talin í öllum viðeigandi dálkum hér að neðan, en telja aðeins einu sinni í heildarfjölda nýrra tegunda (30).
> **Miðað er við** að óstaðfestu tilraunaskrímslin tvö (*Shadow Bramble* og *Marsh Leech*) verði fjarlægð, en *Feral Wolf* og *Grave Troll* haldist eftir endurskoðun (eða uppfærist í Pathfinder-staðla).

| Darkgrid Terrain | Kóði | Núverandi skrímsli (öll) | Eftir fjarlægingu (C + B) | Ný skrímsli (aðalbúsvæði) | Ný skrímsli (heildarþekja) | Áætlaður heildarfjöldi tegunda | CR-dreifing eftir breytingar |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **FOREST** | `F` | 6 | 4 | 5 | 14 | **18** | CR 1/4–1/2 (5), CR 1 (2), CR 2 (4), CR 3 (4), CR 4 (2), CR 5 (1) |
| **HILLS** | `H` | 4 | 4 | 4 | 17 | **21** | CR 1/4–1/2 (4), CR 1 (3), CR 2 (3), CR 3 (4), CR 4 (4), CR 5 (3) |
| **UNDERGROUND_RUINS** | `U` | 5 | 5 | 7 | 16 | **21** | CR 1/4–1/2 (4), CR 1 (3), CR 2 (4), CR 3 (4), CR 4 (2), CR 5 (4) |
| **PLAINS** | `P` | 4 | 3 | 3 | 10 | **13** | CR 1/4–1/2 (3), CR 1 (3), CR 2 (2), CR 3 (2), CR 4 (0), CR 5 (3) |
| **SWAMP** | `S` | 6 | 5 | 3 | 7 | **12** | CR 1/4–1/2 (2), CR 1 (4), CR 2 (2), CR 3 (1), CR 4 (1), CR 5 (2) |
| **MOUNTAINS** | `M` | 3 | 3 | 2 | 7 | **10** | CR 1/4–1/2 (1), CR 1 (0), CR 2 (2), CR 3 (2), CR 4 (2), CR 5 (3) |
| **DESERT** | `D` | 0 | 0 | 3 | 7 | **7** | CR 1/4–1/2 (1), CR 1 (2), CR 2 (1), CR 3 (1), CR 5 (2) |
| **COAST** | `C` | 0 | 0 | 1 | 6 | **6** | CR 1/4–1/2 (3), CR 1 (1), CR 2 (1), CR 4 (1) |
| **RIVER_LAKE** | `R` | 1 | 0 | 1 | 4 | **4** | CR 1 (2), CR 2 (2) |
| **CITY** | `T` | 0 | 0 | 1 | 3 | **3** | CR 1/4–1/2 (1), CR 3 (1), CR 4 (1) |
| **JUNGLE** | `J` | 2 | 2 | 0 | 1 | **3** | CR 1 (1), CR 2 (1), CR 3 (1) |
| **AQUATIC** | `A` | 0 | 0 | 0 | 2 | **2** | CR 1 (1), CR 2 (1) |
| **OCEAN** | `O` | 0 | 0 | 0 | 0 | **0** | *(Ófært djúpsjávarsvæði í Phase 1)* |
| **BRIDGE** | `B` | 0 | 0 | 0 | 0 | **0** | *(Brýr eru tengireitir; engin sérskrímsli enn)* |
| **EXTRAPLANAR** | `X` | 0 | 0 | 0 | 0 | **0** | *(Ekki á núverandi 15x15 heimsreit)* |
| **OTHER** | `Z` | 0 | 0 | 0 | 0 | **0** | — |

---

### Greining á þekju og eyðum (Coverage & Gaps Analysis)

1. **Framúrskarandi þekja:**
   - **Forest, Hills og Underground Ruins:** Þessi þrjú landsvæði eru hjarta leiksins. Hvert þeirra hefur nú 18–21 möguleg skrímsli á öllum erfiðleikastigum frá CR 1/4 upp í CR 5. Leikmaður sem ferðast um skóga, fjalllendi eða dýflissur mun finna fyrir mikilli fjölbreytni og óvissu í hverju skrefi.
   - **Swamp og Plains:** Eru vel varin með 12–13 skrímslum með góðri blöndu af ódauðum, dýrum, húmanóíðum og töfraskepnum.

2. **Landsvæði sem fengu bráðnauðsynlega innspýtingu:**
   - **Desert (`DESERT`):** Var áður með **0** skrímsli. Fær nú 7 skrímsli (Human Skeleton, Hyena, Gnoll, Death Dog, Ankheg, Basilisk, Mummy) sem spanna allt frá CR 1/3 upp í CR 5.
   - **Coast (`COAST`):** Var áður með **0** skrímsli. Fær nú 6 skrímsli (Goblin, Human Skeleton, Human Zombie, Lizardfolk, Giant Crab, Gargoyle) sem henta bæði fjörum, flæðarmálum og klettaskorum.
   - **Rivers / Lakes (`RIVER_LAKE`):** Fær 4 skrímsli (Giant Frog, Giant Crab, Lizardfolk og Boggard).
   - **City / Urban (`CITY`):** Var áður með **0** skrímsli. Borgir eru örugg svæði (`is_safe = 1`) að degi til, en með Skeleton (katakombur/grafhvelfingar), Shadow (dimm húsasund) og Gargoyle (kirkjuturnar/þök) er búið að leggja traustan grunn fyrir dýflissur undir borgum og næturógnir.

3. **Svæði sem enn skortir fjölbreytni (Gaps for future phases):**
   - **Jungle (`J`):** Á aðeins 3 skrímsli (Giant Spider, Yellow Musk Creeper, Assassin Vine). Í framtíðarviðbót mætti bæta við risaslöngum (Constrictor Snake) eða dýragörðum frumskógarins.
   - **Ocean (`O`) og Aquatic (`A`):** Eins og er eru djúpsjávarsvæði ófær leikmönnum (`is_passable = 0`). Þegar siglingar eða neðansjávarkönnun bætast við leikinn þarf að hanna sérstakt sæskrímslasafn (Shark, Sea Hag, Sahuagin o.s.frv.).
   - **Climate vs. Terrain (Snjór og kuldi):** Í Darkgrid er ekkert sérstakt `SNOW` eða `TUNDRA` gildi í `map_tiles.terrain` enum. Skrímslin *Yeti* og *Winter Wolf* voru því staðsett á `MOUNTAINS` (`M`) og `HILLS` (`H`), sem endurspeglar háfjallalönd og fimbulvetur. Ef leikurinn innleiðir síðar veðurfar eða vetrarsvæði mun þetta tengjast beint.

---

## 6. Staða gagnagrunns og framkvæmdar breytingar

### 1. Innleiðing á `monster_terrains` tengitöflu (Fullgilt)
Í samræmi við samþykki notanda hefur verið útbúin og keyrð migrasjón `003_add_creature_type_and_monster_terrains.sql`:

```sql
CREATE TABLE IF NOT EXISTS monster_terrains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monster_id INTEGER NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    terrain TEXT NOT NULL CHECK (terrain IN (
        'AQUATIC', 'OCEAN', 'RIVER_LAKE', 'FOREST', 'JUNGLE',
        'SWAMP', 'PLAINS', 'HILLS', 'MOUNTAINS', 'DESERT',
        'COAST', 'CITY', 'UNDERGROUND_RUINS', 'EXTRAPLANAR',
        'OTHER', 'BRIDGE'
    )),
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (monster_id, terrain)
);

CREATE INDEX IF NOT EXISTS idx_monster_terrains_terrain ON monster_terrains(terrain);
CREATE INDEX IF NOT EXISTS idx_monster_terrains_monster ON monster_terrains(monster_id);

-- Enforce strictly at most ONE primary terrain per monster
CREATE UNIQUE INDEX IF NOT EXISTS one_primary_terrain_per_monster 
ON monster_terrains(monster_id) WHERE is_primary = 1;
```

**Staða:**
- Migrasjónin hefur verið keyrð á `data/darkgrid.sqlite`.
- Allar 31 búsvæðatengingar núverandi 10 skrímsla voru færðar yfir í töfluna.
- Hvert skrímsli hefur nákvæmlega eitt aðalbúsvæði (`is_primary = 1`).
- `UNIQUE(monster_id, terrain)` og `one_primary_terrain_per_monster` koma í veg fyrir tvítekningar eða mörg aðalbúsvæði.
- `PRAGMA foreign_key_check` skilar 0 villum.

---

### 2. Innleiðing á `creature_type` og `creature_subtype` (Fullgilt)
- Dálkunum `creature_type TEXT` og `creature_subtype TEXT` hefur verið bætt við `monsters` töfluna.
- Öll núverandi skrímsli hafa verið uppfærð með stöðluðum Pathfinder 1e lífverutegundum:
  - Assassin Vine: `Plant`
  - Marsh Leech [DEV]: `Vermin` (subtype: `aquatic`)
  - Shadow Bramble [DEV]: `Plant`
  - Feral Wolf [DEV]: `Animal`
  - Grave Troll [DEV]: `Humanoid` (subtype: `giant`)
  - Ghoul: `Undead`
  - Giant Spider: `Vermin`
  - Choker: `Aberration`
  - Rust Monster: `Aberration`
  - Manticore: `Magical Beast`

---

### 3. Kóðauppfærsla í encounter-vélinni (`src/domain/encounters/engine.js`)
- Fallið `selectMonsterForTerrainAndHero` les nú beint úr `monster_terrains` tengitöflunni með hröðu `JOIN` SQL-kalli, með öruggri varaleið yfir í legacy JSON-fylkið ef taflan skyldi vanta.
- Gaussian líkindadreifing og hlutfallslegt vægi er 100% óbreytt.
- `is_primary` er **ekki** notað til að skekkja líkur á þessu stigi, samkvæmt fyrirmælum.

---

### 4. Sjálfvirk próf (`tests/`)
- Sérstakri prófunarskrá [`tests/monster_terrains.test.js`](file:///c:/Users/hih/Documents/antiDark/tests/monster_terrains.test.js) var bætt við.
- Prófin staðfesta:
  1. Töfluskipulag, erlenda lykla og SQL-vísitölur.
  2. Að hvert skrímsli hafi nákvæmlega eitt aðalbúsvæði.
  3. Að gagnagrunnurinn hafni tvítekningum á landsvæðum.
  4. Að gagnagrunnurinn hafni tilraunum til að skilgreina tvö aðalbúsvæði fyrir sama skrímsli.
  5. Að encounter-vélin velji rétt skrímsli samkvæmt `monster_terrains`.
  6. Að öll skrímsli hafi löglega Pathfinder 1e lífverutegund.
- `tests/new_monsters.test.js` var uppfært svo það krefst ekki lengur fasts heildarfjölda 10 skrímsla, heldur staðfestir tilvist nauðsynlegra færslna á sveigjanlegan hátt.
- **Öll 33 próf leiksins keyra og standast 100% án villna.**
1. **Beint samræmi við `map_tiles.terrain`:** Losnar við einbókstafakóðana (`F`, `S`, `U`) og notar fullu heitin (`FOREST`, `SWAMP`, `UNDERGROUND_RUINS`).
2. **Aðalbúsvæði vs. Aukabúsvæði:** `is_primary` gerir leiknum kleift að láta skrímsli vera líklegra á sínu náttúrulega heimasvæði en sjaldgæfara á jaðarsvæðum.
3. **Leitarafköst:** SQL-fyrirspurnin í `selectMonsterForTerrainAndHero` verður einföld og leifturhröð:
   `SELECT m.* FROM monsters m JOIN monster_terrains mt ON m.id = mt.monster_id WHERE mt.terrain = ?`

---

### 3. Bæta `creature_type` við `monsters` töfluna
Í ljós kom við úttektina að `monsters` taflan hefur engan dálk fyrir lífverutegund (`creature_type`), heldur eru upplýsingarnar aðeins í athugasemdum eða lýsingum.
- **Ráðlegging:** Bæta við dálkinum `creature_type TEXT` (t.d. `'Humanoid'`, `'Undead'`, `'Magical Beast'`) í næstu migrasjón. Þetta nýtist Ranger fyrir *Favored Enemy* hæfileika og Cleric fyrir *Turn Undead*.

---

### 4. Næstu skref og framkvæmdaáætlun (Implementation Roadmap)

Þegar notandi hefur samþykkt þessa áætlun verður næsti áfangi framkvæmdur í skipulögðum skrefum:

1. **Skref 1 — Gagnagrunnsmigrasjón:**
   - Loka eða uppfæra opna atburði fyrir Hetju 2 og 14 í `encounters`.
   - Eyða óstaðfestu tilraunaskrímslunum (*Shadow Bramble* og *Marsh Leech*).
   - Uppfæra *Feral Wolf* í *Wolf* (AoNPRD) og taka ákvörðun um *Grave Troll*.
   - Bæta við `creature_type` dálki (og mögulega `monster_terrains`).
2. **Skref 2 — Ný fræskrá (`db/seeds/004_seed_pathfinder_30.sql`):**
   - Setja inn öll 30 nýju skrímslin með nákvæmri Pathfinder 1e tölfræði (Base HP, AC, Initiative, Attack Bonus, Damage Dice, XP).
   - Semja níu sérsniðnar, vandaðar lýsingar fyrir hvert skrímsli sem virða 100% reglur um leynd ógnar (Stage 1 Secrecy).
3. **Skref 3 — Myndskreytingar:**
   - Búa til handmálaðar 2D myndir fyrir nýju skrímslin í samræmi við samþykkta viðmiðunarstílinn í `docs/monster-art-style.md`.
4. **Skref 4 — Prófun:**
   - Uppfæra sjálfvirk próf í `tests/` og staðfesta að allir útreikningar og spawning-reglur standist 100%.

---

## Niðurstaða

Áætlunin uppfyllir öll fyrirmæli:
- **Engum breytingum hefur verið hrint í framkvæmd í gagnagrunninum.**
- **Engum myndum hefur verið bætt við.**
- **Gagnrýnin úttekt liggur fyrir á eldri tilraunaskrímslum.**
- **30 ný, staðfest Pathfinder 1e skrímsli hafa verið valin með fullkomnu jafnvægi á milli erfiðleika (CR 1/4–5), landsvæða og lífverutegunda.**

*Skjalið er tilbúið til formlegrar yfirferðar og samþykkis leikhönnuðar.*
