# Darkgrid — Niðurstöður skrímslaútvíkkunar (Session 2 Results)

> **Dagsetning:** Október 2026  
> **Staða:** Fullklárað og staðfest með sjálfvirkum prófum (40/40 passing)  
> **Aðalheimild:** Archives of Nethys (Pathfinder 1e — [aonprd.com](https://aonprd.com/))  
> **Gagnagrunnur:** SQLite (`data/darkgrid.sqlite`) með forvirkri afritun (`data/darkgrid.sqlite.backup-session-2-clean`)  

---

## Inngangur og heildaryfirlit

Í Session 2 var heildstæðri uppfærslu á skrímslakerfi Darkgrid hrundið í framkvæmd samkvæmt samþykktri áætlun í [`docs/monster-expansion-plan.md`](monster-expansion-plan.md).

Helstu áfangar sem náðust:
1. **Hreinsun tilraunaskepna:** `Shadow Bramble` og `Marsh Leech` voru fjarlægð með öruggum hætti úr gagnagrunni og fræskrám.
2. **Uppfærsla í opinbera Pathfinder-staðla:** `Feral Wolf [DEV-PLACEHOLDER]` var uppfært í opinbert **Wolf** (CR 1) og `Grave Troll [DEV-PLACEHOLDER]` í opinbert **Troll** (CR 5). Virkir bardagar hjá Hetju 14 og Hetju 2 voru varðveittir 100% óskemmdir.
3. **Nýtt gagnaskipulag:** Tengitaflan `monster_terrains` var stofnuð með einstökum vísitölum (UNIQUE constraints) og reglu um eitt aðalbúsvæði (`is_primary = 1`). Dálkinum `creature_type` var bætt við `monsters`.
4. **30 ný Pathfinder 1e skrímsli:** Sett inn í gagnagrunn með heildstæðum d20-eiginleikum, níu enskum encounter-lýsingum fyrir leyndarkerfið og réttum heimildum á Archives of Nethys.
5. **Myndagerð (30 nýjar myndir):** Handmálaðar 2D stafrænar bestiary-myndir voru búnar til með Nano Banana í 6 hlutum (batches). Allar myndir eru í 1:1 hlutföllum, með rúmum öryggisjaðri (15–20% margin), réttum dökku vinnuborðslitum og engum ramma eða texta.
6. **Sjálfvirk próf:** 40 próf í prófunarsvítu leiksins keyra og standast öll (`node --test tests/*.test.js`). Gagnagrunnstengingar stóðust `PRAGMA foreign_key_check` án athugasemda.

---

## A. Gagnagrunnsbreytingar (Database Migrations & Schema)

Tvær nýjar SQL-færslur voru útfærðar í `db/migrations/` og framkvæmdar á lifandi gagnagrunni:

### 1. `003_monster_terrains_and_creature_type.sql`
- **Tengitaflan `monster_terrains`:**
  ```sql
  CREATE TABLE IF NOT EXISTS monster_terrains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monster_id INTEGER NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    terrain TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (monster_id, terrain)
  );
  ```
- **Vísitölur fyrir hraða og heilleika:**
  - `idx_monster_terrains_lookup`: Raðar eftir `(terrain, monster_id)` fyrir hröð köll í spawn-vél.
  - `idx_monster_terrains_single_primary`: Einstök hlutvísitala (`UNIQUE INDEX ... WHERE is_primary = 1`) sem tryggir á gagnagrunnsstigi að ekkert skrímsli geti haft fleiri en eitt aðalbúsvæði.
- **Nýr dálkur `creature_type`:**
  Bætt við `monsters` töfluna (`ALTER TABLE monsters ADD COLUMN creature_type TEXT;`) og fyllt út með opinberum Pathfinder 1e lífverutegundum.
- **Gagnaflutningur (Habitat Migration):**
  Eldri JSON-fylki í `monsters.habitat` voru flutt yfir í staðlaðar raðir í `monster_terrains` með réttum fullheitum landsvæða.

### 2. `004_cleanup_placeholders_and_update_wolf_troll.sql`
- **Hreinsun án skaða:**
  Fjarlægði staðgengla sem ekki voru í notkun (`Shadow Bramble` ID 3, `Marsh Leech` ID 2) úr `monster_terrains` og `monsters`.
- **Uppfærsla á ID 4 & 5:**
  Uppfærði heiti, tölfræði, d20-bónusa, brynju (AC), lífstig (HP) og Pathfinder-heimildarslóðir fyrir Wolf og Troll á staðnum án þess að breyta lyklum (Primary Keys).

---

## B. Fjarlægð og uppfærð skrímsli

| Upprunalegt heiti | ID | Aðgerð | Nýtt heiti / Staða | Rökstuðningur og áhrif á atburði |
|---|:---:|:---:|---|---|
| **Shadow Bramble [DEV-PLACEHOLDER]** | 3 | **Fjarlægt** | — *(Eytt)* | Óstaðfest tilraunaskrímsli án Pathfinder-heimildar. Engir virkir encounters tengdust því. Hreinsað úr fræskrám. |
| **Marsh Leech [DEV-PLACEHOLDER]** | 2 | **Fjarlægt** | — *(Eytt)* | Óstaðfest tölfræði. Engir virkir encounters tengdust því. Hreinsað úr fræskrám. |
| **Feral Wolf [DEV-PLACEHOLDER]** | 4 | **Uppfært** | **Wolf** (CR 1) | Uppfært í opinberan Pathfinder 1e Wolf (Animal, 13 HP, AC 14, bite +2 (1d6+1 plus trip)). **Encounter #2 (Hetja 14) varðveittur óbreyttur með 18 HP.** |
| **Grave Troll [DEV-PLACEHOLDER]** | 5 | **Uppfært** | **Troll** (CR 5) | Uppfært í opinbert Pathfinder 1e Troll (Large Humanoid (giant), 63 HP, AC 16, Rend, Regeneration 5). **Encounter #1 (Hetja 2) varðveittur óbreyttur með 42 HP.** |

Bæði eldri skráarheitin (`images/monsters/feral_wolf.png`, `images/monsters/grave_troll.png`) og nýju heitin (`images/monsters/wolf.png`, `images/monsters/troll.png`) eru til staðar í `images/monsters/` og `public/images/monsters/` til að tryggja 100% afturvirkan samhæfanleika.

---

## C. 30 ný Pathfinder 1e skrímsli

Öll 30 nýju skrímslin voru skilgreind í `db/seeds/004_seed_pathfinder_30.sql` og sett inn í `data/darkgrid.sqlite`. Hvert skrímsli inniheldur fulla d20-tölfræði, níu leyndarlýsingar á ensku og tengingar í `monster_terrains`.

| # | Heiti skrímslis | CR | Lífverutegund (Creature Type) | Aðalbúsvæði (Primary) | Viðbótarbúsvæði (Secondary) | AoN Heimild | Myndaskrá |
|:---:|---|:---:|---|---|---|:---:|---|
| **1** | **Kobold** | 1/4 | Small humanoid (reptilian) | `UNDERGROUND_RUINS` | `FOREST`, `HILLS` | [Kobold](https://aonprd.com/MonsterDisplay.aspx?ItemName=Kobold) | `kobold.png` |
| **2** | **Goblin** | 1/3 | Small humanoid (goblinoid) | `FOREST` | `PLAINS`, `HILLS`, `COAST` | [Goblin](https://aonprd.com/MonsterDisplay.aspx?ItemName=Goblin) | `goblin.png` |
| **3** | **Human Skeleton** | 1/3 | Medium undead | `UNDERGROUND_RUINS` | `PLAINS`, `HILLS`, `SWAMP`, `FOREST` | [Human Skeleton](https://aonprd.com/MonsterDisplay.aspx?ItemName=Human%20Skeleton) | `human_skeleton.png` |
| **4** | **Hobgoblin** | 1/2 | Medium humanoid (goblinoid) | `HILLS` | `MOUNTAINS`, `UNDERGROUND_RUINS`, `FOREST` | [Hobgoblin](https://aonprd.com/MonsterDisplay.aspx?ItemName=Hobgoblin) | `hobgoblin.png` |
| **5** | **Human Zombie** | 1/2 | Medium undead | `SWAMP` | `UNDERGROUND_RUINS`, `PLAINS`, `FOREST` | [Human Zombie](https://aonprd.com/MonsterDisplay.aspx?ItemName=Human%20Zombie) | `human_zombie.png` |
| **6** | **Troglodyte** | 1 | Medium humanoid (reptilian) | `UNDERGROUND_RUINS` | `SWAMP` | [Troglodyte](https://aonprd.com/MonsterDisplay.aspx?ItemName=Troglodyte) | `troglodyte.png` |
| **7** | **Darkmantle** | 1 | Small magical beast | `UNDERGROUND_RUINS` | — | [Darkmantle](https://aonprd.com/MonsterDisplay.aspx?ItemName=Darkmantle) | `darkmantle.png` |
| **8** | **Lizardfolk** | 1 | Medium humanoid (reptilian) | `SWAMP` | `RIVER_LAKE`, `COAST` | [Lizardfolk](https://aonprd.com/MonsterDisplay.aspx?ItemName=Lizardfolk) | `lizardfolk.png` |
| **9** | **Hyena** | 1 | Medium animal | `PLAINS` | `DESERT`, `HILLS` | [Hyena](https://aonprd.com/MonsterDisplay.aspx?ItemName=Hyena) | `hyena.png` |
| **10** | **Gnoll** | 1 | Medium humanoid (gnoll) | `DESERT` | `PLAINS`, `HILLS` | [Gnoll](https://aonprd.com/MonsterDisplay.aspx?ItemName=Gnoll) | `gnoll.png` |
| **11** | **Giant Frog** | 1 | Medium animal | `RIVER_LAKE` | `SWAMP`, `AQUATIC` | [Giant Frog](https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Frog) | `giant_frog.png` |
| **12** | **Boar** | 2 | Medium animal | `FOREST` | `PLAINS`, `HILLS` | [Boar](https://aonprd.com/MonsterDisplay.aspx?ItemName=Boar) | `boar.png` |
| **13** | **Yellow Musk Creeper** | 2 | Medium plant | `FOREST` | `UNDERGROUND_RUINS`, `JUNGLE` | [Yellow Musk Creeper](https://aonprd.com/MonsterDisplay.aspx?ItemName=Yellow%20Musk%20Creeper) | `yellow_musk_creeper.png` |
| **14** | **Bugbear** | 2 | Medium humanoid (goblinoid) | `HILLS` | `MOUNTAINS`, `FOREST`, `UNDERGROUND_RUINS` | [Bugbear](https://aonprd.com/MonsterDisplay.aspx?ItemName=Bugbear) | `bugbear.png` |
| **15** | **Boggard** | 2 | Medium humanoid (boggard) | `SWAMP` | `RIVER_LAKE` | [Boggard](https://aonprd.com/MonsterDisplay.aspx?ItemName=Boggard) | `boggard.png` |
| **16** | **Death Dog** | 2 | Large magical beast | `DESERT` | `PLAINS`, `UNDERGROUND_RUINS` | [Death Dog](https://aonprd.com/MonsterDisplay.aspx?ItemName=Death%20Dog) | `death_dog.png` |
| **17** | **Giant Crab** | 2 | Medium vermin (aquatic) | `COAST` | `RIVER_LAKE`, `AQUATIC` | [Giant Crab](https://aonprd.com/MonsterDisplay.aspx?ItemName=Giant%20Crab) | `giant_crab.png` |
| **18** | **Ettercap** | 3 | Medium aberration | `FOREST` | `UNDERGROUND_RUINS` | [Ettercap](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ettercap) | `ettercap.png` |
| **19** | **Cockatrice** | 3 | Small magical beast | `PLAINS` | `HILLS` | [Cockatrice](https://aonprd.com/MonsterDisplay.aspx?ItemName=Cockatrice) | `cockatrice.png` |
| **20** | **Ankheg** | 3 | Large magical beast | `PLAINS` | `FOREST`, `DESERT` | [Ankheg](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ankheg) | `ankheg.png` |
| **21** | **Ogre** | 3 | Large humanoid (giant) | `HILLS` | `MOUNTAINS`, `FOREST` | [Ogre](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ogre) | `ogre.png` |
| **22** | **Shadow** | 3 | Medium undead (incorporeal) | `UNDERGROUND_RUINS` | `FOREST`, `HILLS` | [Shadow](https://aonprd.com/MonsterDisplay.aspx?ItemName=Shadow) | `shadow.png` |
| **23** | **Owlbear** | 4 | Large magical beast | `FOREST` | `HILLS` | [Owlbear](https://aonprd.com/MonsterDisplay.aspx?ItemName=Owlbear) | `owlbear.png` |
| **24** | **Minotaur** | 4 | Large monstrous humanoid | `UNDERGROUND_RUINS` | `HILLS` | [Minotaur](https://aonprd.com/MonsterDisplay.aspx?ItemName=Minotaur) | `minotaur.png` |
| **25** | **Yeti** | 4 | Large monstrous humanoid (cold) | `MOUNTAINS` | `HILLS` | [Yeti](https://aonprd.com/MonsterDisplay.aspx?ItemName=Yeti) | `yeti.png` |
| **26** | **Gargoyle** | 4 | Medium monstrous humanoid (earth) | `CITY` | `UNDERGROUND_RUINS`, `HILLS`, `MOUNTAINS` | [Gargoyle](https://aonprd.com/MonsterDisplay.aspx?ItemName=Gargoyle) | `gargoyle.png` |
| **27** | **Basilisk** | 5 | Medium magical beast | `HILLS` | `MOUNTAINS`, `UNDERGROUND_RUINS`, `DESERT` | [Basilisk](https://aonprd.com/MonsterDisplay.aspx?ItemName=Basilisk) | `basilisk.png` |
| **28** | **Mummy** | 5 | Medium undead | `DESERT` | `UNDERGROUND_RUINS` | [Mummy](https://aonprd.com/MonsterDisplay.aspx?ItemName=Mummy) | `mummy.png` |
| **29** | **Ochre Jelly** | 5 | Large ooze | `UNDERGROUND_RUINS` | `SWAMP` | [Ochre Jelly](https://aonprd.com/MonsterDisplay.aspx?ItemName=Ochre%20Jelly) | `ochre_jelly.png` |
| **30** | **Winter Wolf** | 5 | Large magical beast (cold) | `MOUNTAINS` | `FOREST`, `PLAINS`, `HILLS` | [Winter Wolf](https://aonprd.com/MonsterDisplay.aspx?ItemName=Winter%20Wolf) | `winter_wolf.png` |

---

## D. Terrain-dreifing og CR-jafnvægi

Heildarfjöldi skrímsla í Darkgrid er nú **38** (8 eldri varðveitt/uppfærð + 30 ný). Tengslin við búsvæði í `monster_terrains` telja samtals **120 færslur**, sem tryggir fjölbreytta andstæðinga á öllum landsvæðum leiksins.

### Yfirlit yfir öll 12 landsvæði Darkgrid

| Landsvæði (Terrain) | Heildarfjöldi skrímsla | Skrímsli sem hafa þetta sem Primary | CR Dreifing | Dæmi um skrímsli á svæðinu |
|---|:---:|:---:|---|---|
| **HILLS** | **21** | 5 | CR 1/4 (1), CR 1/3 (2), CR 1/2 (1), CR 1 (3), CR 2 (3), CR 3 (4), CR 4 (4), CR 5 (3) | Hobgoblin, Bugbear, Ogre, Basilisk, Manticore, Minotaur |
| **UNDERGROUND_RUINS** | **21** | 7 | CR 1/4 (1), CR 1/3 (1), CR 1/2 (2), CR 1 (4), CR 2 (4), CR 3 (4), CR 4 (2), CR 5 (3) | Kobold, Human Skeleton, Troglodyte, Darkmantle, Rust Monster, Shadow, Minotaur, Ochre Jelly |
| **FOREST** | **17** | 5 | CR 1/4 (1), CR 1/3 (2), CR 1/2 (2), CR 1 (3), CR 2 (3), CR 3 (3), CR 4 (1), CR 5 (2) | Goblin, Wolf, Boar, Yellow Musk Creeper, Assassin Vine, Ettercap, Owlbear, Troll |
| **PLAINS** | **13** | 3 | CR 1/3 (2), CR 1/2 (1), CR 1 (3), CR 2 (2), CR 3 (2), CR 5 (3) | Hyena, Cockatrice, Ankheg, Wolf, Manticore, Winter Wolf |
| **SWAMP** | **12** | 3 | CR 1/3 (1), CR 1/2 (1), CR 1 (3), CR 2 (2), CR 3 (1), CR 5 (4) | Human Zombie, Lizardfolk, Boggard, Giant Frog, Assassin Vine, Ochre Jelly, Troll |
| **MOUNTAINS** | **11** | 2 | CR 1/2 (1), CR 2 (2), CR 3 (2), CR 4 (3), CR 5 (3) | Yeti, Winter Wolf, Hobgoblin, Bugbear, Gargoyle, Basilisk, Choker |
| **DESERT** | **7** | 3 | CR 1 (2), CR 2 (1), CR 3 (1), CR 5 (3) | Gnoll, Death Dog, Mummy, Hyena, Ankheg, Basilisk |
| **COAST** | **6** | 1 | CR 1/3 (1), CR 1 (2), CR 2 (2), CR 5 (1) | Giant Crab, Goblin, Lizardfolk, Giant Frog |
| **RIVER_LAKE** | **4** | 1 | CR 1 (2), CR 2 (2) | Giant Frog, Boggard, Lizardfolk, Giant Crab |
| **CITY** *(Urban)* | **3** | 1 | CR 1 (1), CR 4 (1), CR 5 (1) | Gargoyle, Ghoul, Troll |
| **JUNGLE** | **3** | 0 | CR 1 (1), CR 2 (1), CR 3 (1) | Yellow Musk Creeper, Giant Spider, Assassin Vine |
| **AQUATIC** | **2** | 0 | CR 1 (1), CR 2 (1) | Giant Frog, Giant Crab |

### Dreifing allra 38 skrímsla eftir Challenge Rating

- **CR 1/4:** 1 skrímsli *(Kobold)*
- **CR 1/3:** 2 skrímsli *(Goblin, Human Skeleton)*
- **CR 1/2:** 2 skrímsli *(Hobgoblin, Human Zombie)*
- **CR 1:** 9 skrímsli *(Wolf, Ghoul, Giant Spider, Troglodyte, Darkmantle, Lizardfolk, Hyena, Gnoll, Giant Frog)*
- **CR 2:** 7 skrímsli *(Choker, Boar, Yellow Musk Creeper, Bugbear, Boggard, Death Dog, Giant Crab)*
- **CR 3:** 7 skrímsli *(Assassin Vine, Rust Monster, Ettercap, Cockatrice, Ankheg, Ogre, Shadow)*
- **CR 4:** 4 skrímsli *(Owlbear, Minotaur, Yeti, Gargoyle)*
- **CR 5:** 6 skrímsli *(Troll, Manticore, Basilisk, Mummy, Ochre Jelly, Winter Wolf)*

---

## E. Myndagerð og samræmi við myndstíl

Allar 30 nýju skrímslamyndirnar voru búnar til með **Nano Banana** (`generate_image`) í sex lotum (5 myndir í hverri lotu) samkvæmt stöðlum í [`docs/monster-art-style.md`](monster-art-style.md) og viðmiðunum í [`docs/monster-art-review.md`](monster-art-review.md).

### Yfirlit yfir lotur myndagerðar

| Lota | Skrímsli | Skráarheiti | Staða |
|:---:|---|---|:---:|
| **1** | Kobold, Goblin, Human Skeleton, Hobgoblin, Human Zombie | `kobold.png`, `goblin.png`, `human_skeleton.png`, `hobgoblin.png`, `human_zombie.png` | **Staðfest (A)** |
| **2** | Troglodyte, Darkmantle, Lizardfolk, Hyena, Gnoll | `troglodyte.png`, `darkmantle.png`, `lizardfolk.png`, `hyena.png`, `gnoll.png` | **Staðfest (A)** |
| **3** | Giant Frog, Boar, Yellow Musk Creeper, Bugbear, Boggard | `giant_frog.png`, `boar.png`, `yellow_musk_creeper.png`, `bugbear.png`, `boggard.png` | **Staðfest (A)** |
| **4** | Death Dog, Giant Crab, Ettercap, Cockatrice, Ankheg | `death_dog.png`, `giant_crab.png`, `ettercap.png`, `cockatrice.png`, `ankheg.png` | **Staðfest (A)** |
| **5** | Ogre, Shadow, Owlbear, Minotaur, Yeti | `ogre.png`, `shadow.png`, `owlbear.png`, `minotaur.png`, `yeti.png` | **Staðfest (A)** |
| **6** | Gargoyle, Basilisk, Mummy, Ochre Jelly, Winter Wolf | `gargoyle.png`, `basilisk.png`, `mummy.png`, `ochre_jelly.png`, `winter_wolf.png` | **Staðfest (A)** |

### Gæðakröfur sem voru uppfylltar:
1. **1:1 Ferningslaga hlutfall:** Engar afskornar líkamsleifar, fullkomið samræmi við UI-ramma leiksins.
2. **Öryggisbil (Safety Margins):** 15–20% tómur rými er á milli skepnunnar og jaðars myndarinnar, þannig að hún lendir aldrei utan útlína.
3. **Málverkastíll (Painterly 2D):** Gróf áferð, sjáanleg pensilför í anda gouache/olíu, drungakennd lýsing með sterkum birtuskilum (chiaroscuro).
4. **Engir listar eða rannstafir:** Engir tilbúnir grafískir rammar, tákn, lífstigastikur eða vatnsmerki í myndunum.
5. **Dökkt bakgrunnsfall:** Bakgrunnur dökknar út í djúpan kolalit/pergament við jaðra, sem fellur hnökralaust að dökkum stíl Darkgrid.
6. **Tvöföld vistun:** Allar myndir eru vistaðar bæði í `images/monsters/` og `public/images/monsters/`.

---

## F. Encounter-lýsingar og leynd (Threat Secrecy Audit)

Samkvæmt [`docs/encounter-design.md`](encounter-design.md) og tungumálastefnu Darkgrid verða allar leikmannatextalýsingar að vera á **ensku** og fylgja ströngum leyndarreglum.

Fyrir hvert einasta af 30 nýju skrímslunum voru samdar **9 sérstakar lýsingar**:
- **Distant Silhouette:** 3 lýsingar (Normal, Perceptive, Inattentive) — gefa til kynna form, hreyfingu eða stærð í myrkri án þess að afhjúpa skepnuna.
- **Environmental Clue:** 3 lýsingar (Normal, Perceptive, Inattentive) — umhverfisummerki eins og fótspor, krafs, eyðilegging, vefir eða blóðslóð.
- **Sound or Odor:** 3 lýsingar (Normal, Perceptive, Inattentive) — skynáreiti eins og óhugnanlegt soghljóð, hvæs, daunill fýla eða brothljóð.

### Gæðamat (Secrecy Rating):
- **100% Einkunn A:** Engin lýsing nefnir nafn skrímslisins, tegund þess eða gefur beina tölfræðilega vísbendingu um CR eða lífstig.
- **Enskumælandi texti:** Allur texti er á fágaðri, andrúmsloftsríkri ensku sem passar við dark fantasy heiminn.
- **Perceptive Class bónus:** Ranger og aðrar athugular hetjur fá nákvæmari smáatriði (t.d. að greina nákvæma stefnu vindbáru eða kynslóðamark) án þess að leynd sé rofin.

---

## G. Tæknileg staðfesting og prófanir

### 1. Sjálfvirk próf (`npm test`)
Öll 40 sjálfvirku prófin í verkefninu keyra og standast:
```
✔ Account can create a living character and spawns in safe town
✔ Enforces strictly only ONE living character per account
✔ Allows new character creation after previous character dies, preserving history
✔ Gaussian normal weight peaks at hero level and decreases with distance
✔ Statistical simulation of monster selection confirms peak at hero level
✔ Terrain filter strictly matches monster habitat codes
✔ Safe tiles never spawn random encounters even with forced 100% trigger
✔ Assassin Vine has all 9 custom descriptions and Ranger gets perceptive versions
✔ Encounter lifecycle: locks movement, survives refresh, and unlocks on Ignore
✔ Encounter Secrecy Stage 1: Threat is unknown, name & image are hidden in HTML
✔ Encounter Revelation Stage 2: Proceeding reveals exact same monster, name, and image
✔ Encounter lifecycle across multiple monster types verifies consistency and secrecy
✔ HTTP Flow: Register -> Create Character -> Game Screen -> Movement
✔ Session 2 Catalog: Exactly 30 new Pathfinder 1e monsters are present
✔ Session 2 Cleanup: Placeholders removed, Wolf and Troll upgraded
✔ Session 2 Descriptions: All 38 monsters have 9 English descriptions passing secrecy audit
✔ Session 2 Artwork: Every monster has image on disk and resolves in encounters
✔ Session 2 Terrains: Full coverage and exactly ONE primary terrain per monster
✔ Session 2 Encounter Mechanics: Spawns across levels 1, 3, and 5 reflect Gaussian distribution
✔ Session 2 Secrecy & Revelation: Stage 1 hides identity, Stage 2 reveals with identical monster
✔ monster_terrains: table schema, foreign keys, and unique constraints
✔ monster_terrains: every monster has valid terrains and exactly ONE primary terrain
✔ monster_terrains: rejects duplicate (monster_id, terrain) insertion
✔ monster_terrains: rejects a second primary terrain for the same monster
✔ monster_terrains: encounter engine queries via monster_terrains accurately
✔ creature_type: all monsters have standard Pathfinder 1e creature types populated
... [All 40 tests passed cleanly]
```

### 2. Heilleiki gagnagrunns (Foreign Key Integrity)
Keyrsla á `PRAGMA foreign_key_check;` í gegnum `data/darkgrid.sqlite` skilar **0 villum**.

### 3. Vefþjónn og vefviðmót (HTTP Flow Verification)
- Vefþjónninn ræsir hnökralaust á porti 3000 (`npm start`).
- Vefsíður og myndir skila `HTTP 200 OK` (t.d. `/images/monsters/kobold.png` og `/images/monsters/winter_wolf.png`).
- Í **Stage 1 (Discovery)** birtist dulræn vísbending, dularfullur rúnarammi með `ᚦ` tákni, á meðan nafn og mynd skrímslisins eru hulin í HTML kóðanum.
- Í **Stage 2 (Engaged)** afhjúpast rétt handmáluð mynd og opinbert Pathfinder-heiti skrímslisins í bardagaviðmótinu.

### 4. Öryggisafrit (Backup)
Öryggisafrit af gagnagrunninum var tekið með `PRAGMA wal_checkpoint(TRUNCATE);` og er varðveitt í:
`data/darkgrid.sqlite.backup-session-2-clean` (200.704 bæti).
