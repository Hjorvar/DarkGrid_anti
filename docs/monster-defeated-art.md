# Darkgrid — Defeated Monster Art Variants & Victory Window Integration

Þetta skjal lýsir hönnun, tæknilegri útfærslu, samkvæmnireglum og stöðu á **Defeated / Dead Artwork Variants** fyrir öll skrímsli í Darkgrid RPG og samþættingu þeirra við **Victory Screen** (`/game/victory`).

---

## 1. Yfirlit og Markmið

Þegar leikmaður sigrar skrímsli í bardaga birtist sérstakur sigurgluggi (**Victory Screen / Modal**). Til að dýpka upplifunina og skapa sjónrænan lokapunkt á bardaganum birtist sérstök **dauð / sigruð útgáfa** af viðkomandi skrímsli.

### Lykilreglur um samræmi (Consistency Rules):
1. **Sama skrímsli:** Líffærafræði, stærðarhlutföll, andlitsdrættir og herkenni eru nákvæmlega þau sömu og á venjulegri mynd.
2. **Sami myndstíll:** Handmáluð 2D stafræn myndlist (digital painting), 1:1 ferhyrnt hlutfall, engir rammar, engir kantar eða texti.
3. **Sama sjónarhorn og framing:** Myndavélarhorn og skurður (crop) helst stöðugt.
4. **Sami bakgrunnur / biome:** Skrímslið liggur fallið á nákvæmlega sama stað og það barðist (t.d. hellisgólf, mýri, snævi þakin fjallstoppur).
5. **Söm lýsing og stemning:** Litaáferð, skuggar og lýsing passa við lifandi útgáfuna.
6. **Breytingar eingöngu til marks um ósigur:** Veran er fallin, líflaus, lafandi eða hrunin; augu eru lokuð, dimm eða gljáð; vopn/klær hafa fallið í jörðina; hófleg sár og bardagamerki sem passa við kanóníska `9_dead` lýsingu úr gagnagrunni. Ekkert ýkt eða ósmekklegt gore.

---

## 2. Tæknilegur Arkitektúr

### 2.1. Gagnagrunnur (Database Schema)
Bætt var við nýjum dálki í `monsters` töfluna í gegnum migration:
- **Migration:** `db/migrations/010_defeated_monster_art_system.sql`
- **Seed:** `db/seeds/008_seed_defeated_monster_images.sql`
- **Dálkur:** `defeated_image_path TEXT DEFAULT NULL`
- **Slóðasnið:** `images/monsters/<slug>_defeated.png`

### 2.2. Skráaskipulag og Tvöföld Samstilling (Dual Folder Sync)
Darkgrid þjónar myndum úr bæði verkefnisrót (`/images/...`) og `public/` möppu (`public/images/...`).
Allar defeated myndir eru vistaðar samtímis á báða staði sem bjartsýnd 1024x1024 PNG skjöl:
- `images/monsters/<slug>_defeated.png`
- `public/images/monsters/<slug>_defeated.png`

Sjálfvirkt vinnsluforrit: `scripts/process_defeated_image.py` sér um að umbreyta, skala og vista á báða staði í einu skrefi.

### 2.3. Lénsrökfræði (Domain Logic & Fallback Behavior)
- **Encounter Engine (`src/domain/encounters/engine.js`):**
  Þegar encounter er sótt með `getEncounterById` skoðar kerfið hvort `defeated_image_path` sé til staðar og hvort skráin finnist raunverulega á diski (`fs.existsSync`).
  Ef skráin finnst er `hasDefeatedImage = true` og `defeatedImageUrl = '/images/monsters/<slug>_defeated.png'`.
- **Victory Data (`src/domain/combat/victory.js`):**
  Sigurgögn setja `imageUrl` sjálfkrafa sem `defeatedImageUrl` ef hún er til staðar.
  **Öruggt fallback:** Ef defeated mynd vantar á þróunartíma fellur kerfið sjálfkrafa og hnökralaust aftur á `livingImageUrl` án þess að brotin mynd birtist nokkurn tímann í viðmótinu. `isDefeatedArt` breytan segir til um hvort raunveruleg defeated mynd sé í notkun.
- **Viðmót (`src/views/victory.ejs` og `public/css/style.css`):**
  Sigurglugginn birtir myndina með skýrum ramma, gullnum glóa og sérstöku merki (`.victory-defeated-badge`: *"Vanquished"*).

---

## 3. Heildarstaða Skrímsla í Darkgrid (68 Skrímsli)

Alls eru **68 virk skrímsli** í Darkgrid.
- **Lokið (Ready):** Öll **68 skrímsli (100%)** hafa fullbúna handmálaða defeated mynd á diski í bæði `images/monsters/` og `public/images/monsters/`.

| # | Monster Name | Slug | Creature Type | Living Artwork | Defeated Artwork | Staða | Athugasemdir |
|---|---|---|---|---|---|---|---|
| 1 | **Assassin Vine** | `assassin_vine` | Plant | `images/monsters/assassin_vine.png` | `images/monsters/assassin_vine_defeated.png` | Lokið | Fullbúin defeated mynd |
| 2 | **Wolf** | `wolf` | Animal | `images/monsters/wolf.png` | `images/monsters/wolf_defeated.png` | Lokið | Fullbúin defeated mynd |
| 3 | **Troll** | `troll` | Humanoid | `images/monsters/troll.png` | `images/monsters/troll_defeated.png` | Lokið | Fullbúin defeated mynd |
| 4 | **Ghoul** | `ghoul` | Undead | `images/monsters/ghoul.png` | `images/monsters/ghoul_defeated.png` | Lokið | Fullbúin defeated mynd |
| 5 | **Giant Spider** | `giant_spider` | Vermin | `images/monsters/giant_spider.png` | `images/monsters/giant_spider_defeated.png` | Lokið | Fullbúin defeated mynd |
| 6 | **Choker** | `choker` | Aberration | `images/monsters/choker.png` | `images/monsters/choker_defeated.png` | Lokið | Fullbúin defeated mynd |
| 7 | **Rust Monster** | `rust_monster` | Aberration | `images/monsters/rust_monster.png` | `images/monsters/rust_monster_defeated.png` | Lokið | Fullbúin defeated mynd |
| 8 | **Manticore** | `manticore` | Magical Beast | `images/monsters/manticore.png` | `images/monsters/manticore_defeated.png` | Lokið | Fullbúin defeated mynd |
| 9 | **Kobold** | `kobold` | Humanoid | `images/monsters/kobold.png` | `images/monsters/kobold_defeated.png` | Lokið | Fullbúin defeated mynd |
| 10 | **Goblin** | `goblin` | Humanoid | `images/monsters/goblin.png` | `images/monsters/goblin_defeated.png` | Lokið | Fullbúin defeated mynd |
| 11 | **Human Skeleton** | `human_skeleton` | Undead | `images/monsters/human_skeleton.png` | `images/monsters/human_skeleton_defeated.png` | Lokið | Fullbúin defeated mynd |
| 12 | **Hobgoblin** | `hobgoblin` | Humanoid | `images/monsters/hobgoblin.png` | `images/monsters/hobgoblin_defeated.png` | Lokið | Fullbúin defeated mynd |
| 13 | **Human Zombie** | `human_zombie` | Undead | `images/monsters/human_zombie.png` | `images/monsters/human_zombie_defeated.png` | Lokið | Fullbúin defeated mynd |
| 14 | **Troglodyte** | `troglodyte` | Humanoid | `images/monsters/troglodyte.png` | `images/monsters/troglodyte_defeated.png` | Lokið | Fullbúin defeated mynd |
| 15 | **Darkmantle** | `darkmantle` | Magical Beast | `images/monsters/darkmantle.png` | `images/monsters/darkmantle_defeated.png` | Lokið | Fullbúin defeated mynd |
| 16 | **Lizardfolk** | `lizardfolk` | Humanoid | `images/monsters/lizardfolk.png` | `images/monsters/lizardfolk_defeated.png` | Lokið | Fullbúin defeated mynd |
| 17 | **Hyena** | `hyena` | Animal | `images/monsters/hyena.png` | `images/monsters/hyena_defeated.png` | Lokið | Fullbúin defeated mynd |
| 18 | **Gnoll** | `gnoll` | Humanoid | `images/monsters/gnoll.png` | `images/monsters/gnoll_defeated.png` | Lokið | Fullbúin defeated mynd |
| 19 | **Giant Frog** | `giant_frog` | Animal | `images/monsters/giant_frog.png` | `images/monsters/giant_frog_defeated.png` | Lokið | Fullbúin defeated mynd |
| 20 | **Boar** | `boar` | Animal | `images/monsters/boar.png` | `images/monsters/boar_defeated.png` | Lokið | Fullbúin defeated mynd |
| 21 | **Yellow Musk Creeper** | `yellow_musk_creeper` | Plant | `images/monsters/yellow_musk_creeper.png` | `images/monsters/yellow_musk_creeper_defeated.png` | Lokið | Fullbúin defeated mynd |
| 22 | **Bugbear** | `bugbear` | Humanoid | `images/monsters/bugbear.png` | `images/monsters/bugbear_defeated.png` | Lokið | Fullbúin defeated mynd |
| 23 | **Boggard** | `boggard` | Humanoid | `images/monsters/boggard.png` | `images/monsters/boggard_defeated.png` | Lokið | Fullbúin defeated mynd |
| 24 | **Death Dog** | `death_dog` | Magical Beast | `images/monsters/death_dog.png` | `images/monsters/death_dog_defeated.png` | Lokið | Fullbúin defeated mynd |
| 25 | **Giant Crab** | `giant_crab` | Vermin | `images/monsters/giant_crab.png` | `images/monsters/giant_crab_defeated.png` | Lokið | Fullbúin defeated mynd |
| 26 | **Ettercap** | `ettercap` | Aberration | `images/monsters/ettercap.png` | `images/monsters/ettercap_defeated.png` | Lokið | Fullbúin defeated mynd |
| 27 | **Cockatrice** | `cockatrice` | Magical Beast | `images/monsters/cockatrice.png` | `images/monsters/cockatrice_defeated.png` | Lokið | Fullbúin defeated mynd |
| 28 | **Ankheg** | `ankheg` | Magical Beast | `images/monsters/ankheg.png` | `images/monsters/ankheg_defeated.png` | Lokið | Fullbúin defeated mynd |
| 29 | **Ogre** | `ogre` | Humanoid | `images/monsters/ogre.png` | `images/monsters/ogre_defeated.png` | Lokið | Fullbúin defeated mynd |
| 30 | **Shadow** | `shadow` | Undead | `images/monsters/shadow.png` | `images/monsters/shadow_defeated.png` | Lokið | Fullbúin defeated mynd |
| 31 | **Owlbear** | `owlbear` | Magical Beast | `images/monsters/owlbear.png` | `images/monsters/owlbear_defeated.png` | Lokið | Fullbúin defeated mynd |
| 32 | **Minotaur** | `minotaur` | Monstrous Humanoid | `images/monsters/minotaur.png` | `images/monsters/minotaur_defeated.png` | Lokið | Fullbúin defeated mynd |
| 33 | **Yeti** | `yeti` | Monstrous Humanoid | `images/monsters/yeti.png` | `images/monsters/yeti_defeated.png` | Lokið | Fullbúin defeated mynd |
| 34 | **Gargoyle** | `gargoyle` | Monstrous Humanoid | `images/monsters/gargoyle.png` | `images/monsters/gargoyle_defeated.png` | Lokið | Fullbúin defeated mynd |
| 35 | **Basilisk** | `basilisk` | Magical Beast | `images/monsters/basilisk.png` | `images/monsters/basilisk_defeated.png` | Lokið | Fullbúin defeated mynd |
| 36 | **Mummy** | `mummy` | Undead | `images/monsters/mummy.png` | `images/monsters/mummy_defeated.png` | Lokið | Fullbúin defeated mynd |
| 37 | **Ochre Jelly** | `ochre_jelly` | Ooze | `images/monsters/ochre_jelly.png` | `images/monsters/ochre_jelly_defeated.png` | Lokið | Fullbúin defeated mynd |
| 38 | **Winter Wolf** | `winter_wolf` | Magical Beast | `images/monsters/winter_wolf.png` | `images/monsters/winter_wolf_defeated.png` | Lokið | Fullbúin defeated mynd |
| 39 | **Stirge** | `stirge` | Magical Beast | `images/monsters/stirge.png` | `images/monsters/stirge_defeated.png` | Lokið | Fullbúin defeated mynd |
| 40 | **Dire Rat** | `dire_rat` | Animal | `images/monsters/dire_rat.png` | `images/monsters/dire_rat_defeated.png` | Lokið | Fullbúin defeated mynd |
| 41 | **Viper** | `viper` | Animal | `images/monsters/viper.png` | `images/monsters/viper_defeated.png` | Lokið | Fullbúin defeated mynd |
| 42 | **Giant Centipede** | `giant_centipede` | Vermin | `images/monsters/giant_centipede.png` | `images/monsters/giant_centipede_defeated.png` | Lokið | Fullbúin defeated mynd |
| 43 | **Iron Cobra** | `iron_cobra` | Construct | `images/monsters/iron_cobra.png` | `images/monsters/iron_cobra_defeated.png` | Lokið | Fullbúin defeated mynd |
| 44 | **Skeletal Champion** | `skeletal_champion` | Undead | `images/monsters/skeletal_champion.png` | `images/monsters/skeletal_champion_defeated.png` | Lokið | Fullbúin defeated mynd |
| 45 | **Blink Dog** | `blink_dog` | Magical Beast | `images/monsters/blink_dog.png` | `images/monsters/blink_dog_defeated.png` | Lokið | Fullbúin defeated mynd |
| 46 | **Duergar** | `duergar` | Humanoid | `images/monsters/duergar.png` | `images/monsters/duergar_defeated.png` | Lokið | Fullbúin defeated mynd |
| 47 | **Drow** | `drow` | Humanoid | `images/monsters/drow.png` | `images/monsters/drow_defeated.png` | Lokið | Fullbúin defeated mynd |
| 48 | **Orc** | `orc` | Humanoid | `images/monsters/orc.png` | `images/monsters/orc_defeated.png` | Lokið | Fullbúin defeated mynd |
| 49 | **Wight** | `wight` | Undead | `images/monsters/wight.png` | `images/monsters/wight_defeated.png` | Lokið | Fullbúin defeated mynd |
| 50 | **Harpy** | `harpy` | Monstrous Humanoid | `images/monsters/harpy.png` | `images/monsters/harpy_defeated.png` | Lokið | Fullbúin defeated mynd |
| 51 | **Doppelganger** | `doppelganger` | Monstrous Humanoid | `images/monsters/doppelganger.png` | `images/monsters/doppelganger_defeated.png` | Lokið | Fullbúin defeated mynd |
| 52 | **Griffon** | `griffon` | Magical Beast | `images/monsters/griffon.png` | `images/monsters/griffon_defeated.png` | Lokið | Fullbúin defeated mynd |
| 53 | **Giant Scorpion** | `giant_scorpion` | Vermin | `images/monsters/giant_scorpion.png` | `images/monsters/giant_scorpion_defeated.png` | Lokið | Fullbúin defeated mynd |
| 54 | **Cloaker** | `cloaker` | Aberration | `images/monsters/cloaker.png` | `images/monsters/cloaker_defeated.png` | Lokið | Fullbúin defeated mynd |
| 55 | **Phase Spider** | `phase_spider` | Magical Beast | `images/monsters/phase_spider.png` | `images/monsters/phase_spider_defeated.png` | Lokið | Fullbúin defeated mynd |
| 56 | **Wraith** | `wraith` | Undead | `images/monsters/wraith.png` | `images/monsters/wraith_defeated.png` | Lokið | Fullbúin defeated mynd |
| 57 | **Gibbering Mouther** | `gibbering_mouther` | Aberration | `images/monsters/gibbering_mouther.png` | `images/monsters/gibbering_mouther_defeated.png` | Lokið | Fullbúin defeated mynd |
| 58 | **Peryton** | `peryton` | Magical Beast | `images/monsters/peryton.png` | `images/monsters/peryton_defeated.png` | Lokið | Fullbúin defeated mynd |
| 59 | **Giant Stag Beetle** | `giant_stag_beetle` | Vermin | `images/monsters/giant_stag_beetle.png` | `images/monsters/giant_stag_beetle_defeated.png` | Lokið | Fullbúin defeated mynd |
| 60 | **Vegepygmy** | `vegepygmy` | Plant | `images/monsters/vegepygmy.png` | `images/monsters/vegepygmy_defeated.png` | Lokið | Fullbúin defeated mynd |
| 61 | **Ghast** | `ghast` | Undead | `images/monsters/ghast.png` | `images/monsters/ghast_defeated.png` | Lokið | Fullbúin defeated mynd |
| 62 | **Giant Bat** | `giant_bat` | Animal | `images/monsters/giant_bat.png` | `images/monsters/giant_bat_defeated.png` | Lokið | Fullbúin defeated mynd |
| 63 | **Morlock** | `morlock` | Monstrous Humanoid | `images/monsters/morlock.png` | `images/monsters/morlock_defeated.png` | Lokið | Fullbúin defeated mynd |
| 64 | **Violet Fungus** | `violet_fungus` | Plant | `images/monsters/violet_fungus.png` | `images/monsters/violet_fungus_defeated.png` | Lokið | Fullbúin defeated mynd |
| 65 | **Grick** | `grick` | Aberration | `images/monsters/grick.png` | `images/monsters/grick_defeated.png` | Lokið | Fullbúin defeated mynd |
| 66 | **Krenshar** | `krenshar` | Magical Beast | `images/monsters/krenshar.png` | `images/monsters/krenshar_defeated.png` | Lokið | Fullbúin defeated mynd |
| 67 | **Bunyip** | `bunyip` | Magical Beast | `images/monsters/bunyip.png` | `images/monsters/bunyip_defeated.png` | Lokið | Fullbúin defeated mynd |
| 68 | **Sahuagin** | `sahuagin` | Monstrous Humanoid | `images/monsters/sahuagin.png` | `images/monsters/sahuagin_defeated.png` | Lokið | Fullbúin defeated mynd |

---

## 4. Prófunarstaðfesting (Tests)

Allar breytingar og fallback virkni eru prófaðar með `node --test tests/defeated_monster_art.test.js`:
- **Gagnagrunnur:** `defeated_image_path` dálkur til staðar og rétt fylltur út fyrir öll skrímsli.
- **Upplausn mynda:** Living mynd birtist í bardaga, en defeated mynd er valin sjálfkrafa í sigri.
- **Fallback hegðun:** Ef defeated mynd vantar á diski fellur kerfið sjálfkrafa yfir á `imageUrl` lifandi skrímslis án villu.
- **HTTP viðmótspróf:** `/game/victory` skilar réttri defeated mynd og `victory-defeated-badge` (*"Vanquished"*).
- **Skráarheilleiki:** Öll 68 skrímsli hafa fullgildar myndir (> 1000 bytes) í bæði `images/` og `public/images/`.
- **Heildarprófanir:** 198 af 198 prófum í Darkgrid standast prófun (100% pass).
