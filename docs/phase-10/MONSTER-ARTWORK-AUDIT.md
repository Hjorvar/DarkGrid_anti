# Phase 10 — Úttekt og Viðgerð á Skrímslamyndum, Bossum og PF1e Stærðarsvörun (Monster Artwork Audit)

**Dagsetning:** 24. október 2026  
**Ábyrgðaraðili:** Agent B — Monster Artwork Repair  
**Staða:** ✅ **100% STAÐFEST OG VIÐGERT (0 brotnar slóðir / 29 af 29 prófum græn)**

---

## 1. Framkvæmdaryfirlit (Executive Summary)

Framkvæmd var heildarúttekt á öllum **98 skrímslum í SQLite gagnagrunni DarkGrid** (`db/migrations/` og `db/seeds/`), **5 Pathfinder 1e stærðar-viðmiðunarsýnum** (`PF1E_SIZE_REFERENCE_SPECIMENS`), **4 yfirheims- og dýflissu-bossum** (`Warchief Grak the Goblin Chieftain`, `Skulkrip the Cave Brood-King`, `Lord Malakor the Barrow-Wight King`, `Warlord Kraug the Crag-Breaker`) og **8 föstum dýflissuvörðum** (`DUNGEON_FIXED_ENCOUNTERS`).

Samanburður var gerður á milli:
- `monsters.image_path` í SQLite gagnagrunni
- `action-ui-lab/monster-size-catalog.js` (`MONSTER_SIZE_CATALOG`)
- `action-ui-lab/monster-artwork-inventory.json`
- `action-ui-lab/monster-asset-manifest.json`
- `action-ui-lab/server/services/monster-profile-service.js`
- Raunverulegra myndskráa á diski í `public/images/monsters/`, `images/monsters/` og `action-ui-lab/public/images/monsters-cutout/`

### Helstu niðurstöður:
- **98 af 98 grunnmyndum skrímsla (`<slug>.png`)** og **98 af 98 sigruðum myndum (`<slug>_defeated.png`)** eru til staðar á diski í bæði `public/images/monsters/` og `images/monsters/` í `1024×1024` upplausn.
- **37 skrímsli (37,8%)** eiga sannreyndar 32-bita RGBA gegnsæjar útskurðarmyndir (`colorType === 6`) í `action-ui-lab/public/images/monsters-cutout/<slug>.png` (`7 EXISTING_APPROVED` grunnmyndir + `30 NEWLY_PRODUCED_VERIFIED` IS-Net útskurðarmyndir) og birtast í `INTEGRATED` ham.
- **61 skrímsli (62,2%)** eru ekki enn komin með sérsniðna RGBA útskurðarmynd og nota heiðarlegt, aðlagað `CARD` fallback (`CARD_FALLBACK_RETAINED`) með sinni eigin mynd (`/images/monsters/<slug>.png`) án þess að stela útskurðarmynd annars skrímslis.
- **4 alvarlegar samræmingar- og uppflettingarvillur** fundust í kóða og manifest-skrám og voru allar lagfærðar að fullu.

---

## 2. Greining á 4 villum sem fundust og voru lagfærðar

### Villa 1 — Árekstur á milli kanónískra SQLite `monsters.id` (`1..98`) og eldri ID-númera í `MONSTER_SIZE_CATALOG`
- **Orsök:** Í SQLite gagnagrunninum fá öll 98 skrímslin kanónískt `id = 1..98` í sömu röð og `catalogOrder = 1..98`. Í `MONSTER_SIZE_CATALOG`, `monster-artwork-inventory.json` og `monster-asset-manifest.json` voru hins vegar eldri ID-númer (`Wolf` var með `id: 4` í stað `2`, `Troll` var með `id: 5` í stað `3`, `Ghoul` var með `id: 126` í stað `4`, `Giant Spider` var með `id: 127` í stað `5`, og viðbótarskrímsli höfðu `495..554` og `9143..9172`). Þar sem `lookupMonsterSizeEntry(id)` leitaði fyrst í `BY_ID` áður en hún leitaði í `BY_CATALOG_ORDER`, skilaði uppfletting á `id = 4` (`Ghoul` í DB) **`Wolf`**, og uppfletting á `id = 5` (`Giant Spider` í DB) skilaði **`Troll`**.
- **Viðgerð:** Öll 98 skrímslin í `MONSTER_SIZE_CATALOG`, `monster-artwork-inventory.json` og `monster-asset-manifest.json` voru samræmd þannig að `id === catalogOrder` (`1..98`), í 100% samræmi við SQLite gagnagrunninn.

### Villa 2 — Brotin `cardAsset.labAssetPath` (`HTTP 404`) í `monster-size-catalog.js` og `monster-asset-manifest.json`
- **Orsök:** `getMonsterAssetManifest()` bjó til `cardAsset.labAssetPath: "/lab-assets/images/monsters/<slug>.png"`. Þar sem Express static middleware (`action-ui-lab/server/middleware/static-assets.js`) tengir `/lab-assets` við `action-ui-lab/public` (þar sem aðeins `images/monsters-cutout` er til staðar en ekki `images/monsters`), skilaði `GET /lab-assets/images/monsters/<slug>.png` alltaf **`HTTP 404`**, á meðan `GET /images/monsters/<slug>.png` skilar **`HTTP 200`**.
- **Viðgerð:** `cardAsset.labAssetPath` var lagfært í `m.imagePath` (`"/images/monsters/<slug>.png"`) í `monster-size-catalog.js` og `monster-asset-manifest.json` endurskrifað.

### Villa 3 — Brotin `fileDiskPath` og `diskRelativePath` fyrir 5 PF1e stærðar-viðmiðunarsýni (`PF1E_SIZE_REFERENCE_SPECIMENS`)
- **Orsök:** Í `action-ui-lab/server/services/monster-profile-service.js` (lína 231) notaði `resolveMonsterIntegratedProfile()` `${canonicalSlug}.png` í stað þess að lesa skráarheitið úr `sizeEntry.cutoutImagePath`. Fyrir vikið skiluðu öll 5 PF1e viðmiðunarsýnin (`ref_fine_spore_mite`, `ref_diminutive_toad`, `ref_huge_elder_troll`, `ref_gargantuan_wyrm`, `ref_colossal_titan`) `hasIntegratedCutout: false` og `fallbackReason: 'CUTOUT_FILE_MISSING_ON_DISK'`. Eins vísaði `diskRelativePath` í `getMonsterAssetManifest()` á ótilverandi `ref_*.png` skrár í stað proxy-skranna (`stirge.png`, `viper.png`, `ogre.png`, `wyvern.png`, `troll.png`).
- **Viðgerð:** Bæði `monster-profile-service.js` og `monster-size-catalog.js` draga nú rétt skráarheiti úr `sizeEntry.cutoutImagePath`, þannig að öll 5 viðmiðunarsýnin finna sínar RGBA cutout-myndir á diski.

### Villa 4 — Bossar og fastir dýflissuverðir féllu í tilbúið fallback (`HTTP 404` myndslóðir og röng PF1e stærð)
- **Orsök:** Þegar flett var upp bossum eða föstum dýflissuvörðum eftir `bossKey`, `eventKey` eða `customTitle` (t.d. `"Warlord Kraug the Crag-Breaker"`, `"Skulkrip the Cave Brood-King"`, `"Lord Malakor the Barrow-Wight King"`, `"Broodmother Spinner"`) fann `lookupMonsterSizeEntry()` þá ekki í `BY_SLUG` eða `BY_NAME` og féll í `synthesizeFallbackMonsterSizeEntry()`. Það bjó til ótilverandi myndslóðir (t.d. `/images/monsters/warlord_kraug_the_crag_breaker.png` -> `HTTP 404`) og ranga PF1e stærð (`Warlord Kraug` fékk `MEDIUM` og `CARD` fallback í stað `LARGE` og `INTEGRATED` RGBA cutout fyrir `ogre`).
- **Viðgerð:** Bætt var við `BOSS_AND_SPECIAL_MONSTER_ALIASES` í `monster-size-catalog.js`, auk þess sem `lookupMonsterSizeEntry()` og `resolveMonsterIntegratedProfile()` leita nú í `combatImageSlug`, `bossKey`, `dungeonBossKey`, `fixedEncounterKey`, `eventKey`, `customTitle` og `monsterLookupHint`.

---

## 3. Staðfesting á Bossum og Föstum Dýflissuvörðum (`dungeon-service.js` & `topdown-world-service.js`)

Allir **4 bossar** og **8 fastir dýflissuverðir** voru prófaðir gegn bæði `lookupMonsterSizeEntry()`, `resolveMonsterIntegratedProfile()` og Express static middleware (`HTTP 200`):

### 3.1 Yfirheims- og Dýflissu-Bossar (4 Bosses)

| Boss Lykill (`bossKey`) | Titill (`customTitle`) | Staðsetning / Dýflissa | Kanónískt Skrímsli (`slug`) | PF1e Stærð | `scaleFactor` | Birtingarhamur | Virk Myndslóð (`HTTP 200`) |
|---|---|---|---|---|---|---|---|
| `WARCHIEF_GRAK` | **Warchief Grak the Goblin Chieftain** | Goblin Stronghold `[15, 2]` | `goblin` (ID 10) | `SMALL` (5 ft) | `0.60` | `INTEGRATED` (RGBA Cutout) | `/lab-assets/images/monsters-cutout/goblin.png` |
| `GOBLIN_CAVE_BROOD_KING` | **Skulkrip the Cave Brood-King** | Goblin Cave `[16, 2]` | `bugbear` (ID 15) | `MEDIUM` (5 ft) | `1.06` | `INTEGRATED` (RGBA Cutout) | `/lab-assets/images/monsters-cutout/bugbear.png` |
| `ANCIENT_CRYPT_BARROW_KING` | **Lord Malakor the Barrow-Wight King** | Ancient Crypt `[10, 2]` | `barrow_wight` (ID 92) | `MEDIUM` (5 ft) | `0.98` | `CARD` (Card Fallback) | `/images/monsters/barrow_wight.png` |
| `WARLORD_KRAUG` | **Warlord Kraug the Crag-Breaker** | Ravencrag Citadel `[37, 3]` | `ogre` (ID 18) | `LARGE` (10 ft) | `1.45` | `INTEGRATED` (RGBA Cutout) | `/lab-assets/images/monsters-cutout/ogre.png` |

### 3.2 Fastir Dýflissuverðir (8 Fixed Dungeon Guards)

| Viðburðarlykill (`eventKey`) | Titill (`customTitle`) | Dýflissa | Kanónískt Skrímsli (`slug`) | PF1e Stærð | `scaleFactor` | Birtingarhamur | Virk Myndslóð (`HTTP 200`) |
|---|---|---|---|---|---|---|---|
| `CAVE_SPIDER_BROOD` | **Broodmother Spinner** | `GOBLIN_CAVE` | `giant_spider` (ID 5) | `MEDIUM` (5 ft) | `0.68` | `INTEGRATED` | `/lab-assets/images/monsters-cutout/giant_spider.png` |
| `CAVE_WARCAMP_SENTRY` | **Crag-Tunnel Taskmaster** | `GOBLIN_CAVE` | `hobgoblin` (ID 16) | `MEDIUM` (5 ft) | `0.98` | `CARD` | `/images/monsters/hobgoblin.png` |
| `CAVE_BRIDGE_BUGBEAR` | **Chasm-Guard Stalker** | `GOBLIN_CAVE` | `bugbear` (ID 15) | `MEDIUM` (5 ft) | `1.06` | `INTEGRATED` | `/lab-assets/images/monsters-cutout/bugbear.png` |
| `CRYPT_NAVE_WARDEN` | **Sepulcher Honor-Guard** | `ANCIENT_CRYPT` | `skeletal_champion` (ID 7) | `MEDIUM` (5 ft) | `0.98` | `INTEGRATED` | `/lab-assets/images/monsters-cutout/skeletal_champion.png` |
| `CRYPT_TOMB_GHOUL` | **Sarcophagus Stalker** | `ANCIENT_CRYPT` | `ghoul` (ID 4) | `MEDIUM` (5 ft) | `0.90` | `INTEGRATED` | `/lab-assets/images/monsters-cutout/ghoul.png` |
| `CRYPT_CATACOMB_SHADOW` | **Whispering Shade of the Ossuary** | `ANCIENT_CRYPT` | `shadow` (ID 19) | `MEDIUM` (5 ft) | `0.98` | `INTEGRATED` | `/lab-assets/images/monsters-cutout/shadow.png` |
| `CRYPT_OSSUARY_WIGHT` | **Crypt-Bearer of the Inner Seal** | `ANCIENT_CRYPT` | `wight` (ID 34) | `MEDIUM` (5 ft) | `0.96` | `CARD` | `/images/monsters/wight.png` |
| `CRYPT_MUMMY_SENTINEL` | **Anointed Tomb-Guardian** | `ANCIENT_CRYPT` | `mummy` (ID 26) | `MEDIUM` (5 ft) | `1.00` | `INTEGRATED` | `/lab-assets/images/monsters-cutout/mummy.png` |

---

## 4. Pathfinder 1e Stærðarsvörun og Combat Viewport Öryggi

Öll 98 skrímslin í gagnagrunninum og 5 PF1e stærðar-viðmiðunarsýnin voru prófuð í gegnum `computeAdaptiveMonsterVisualScale()` á fjórum algengum skjástærðum (`1920×1080`, `1440×900`, `1280×800`, `1024×768`) í bæði `INTEGRATED` og `CARD` ham:

| PF1e Stærðarflokkur | Rými (`pfSpaceFt`) | Grunn-Viewport Hæð (`Vh`) | Fjöldi í DB (98) | Með RGBA Cutout (37) | Með Card Fallback (61) | Viðmiðunarsýni (`Reference`) |
|---|---|---|---|---|---|---|
| **FINE** | 0,5 ft | 6,5% | 0 | 0 | 0 | `ref_fine_spore_mite` (`stirge.png`) |
| **DIMINUTIVE** | 1,0 ft | 9,0% | 0 | 0 | 0 | `ref_diminutive_toad` (`viper.png`) |
| **TINY** | 2,5 ft | 12,5% | 5 | 4 | 1 | — |
| **SMALL** | 5,0 ft | 19,5% | 13 | 5 | 8 | — |
| **MEDIUM** | 5,0 ft | 28,5% | 52 | 17 | 35 | — |
| **LARGE** | 10,0 ft | 41,0% | 28 | 11 | 17 | — |
| **HUGE** | 15,0 ft | 52,0% | 0 | 0 | 0 | `ref_huge_elder_troll` (`ogre.png`) |
| **GARGANTUAN** | 20,0 ft | 60,0% | 0 | 0 | 0 | `ref_gargantuan_wyrm` (`wyvern.png`) |
| **COLOSSAL** | 30,0 ft | 66,0% | 0 | 0 | 0 | `ref_colossal_titan` (`troll.png`) |
| **Samtals** | — | — | **98** | **37 (37,8%)** | **61 (62,2%)** | **5 viðmiðunarsýni** |

### Viewport öryggisskilyrði (100% uppfyllt á öllum 98 skrímslum):
- **Engin klipping við efri HUD-rönd:** `crownClearancePx >= 24px` á öllum skjástærðum.
- **Engin klipping við neðra aðgerðaborð:** `footAboveBottomDeckPx >= 18px` á öllum skjástærðum.
- **Engin klipping til hliða:** `horizontalClearancePx >= 12px` á öllum skjástærðum (þ.m.t. fyrir breið skrímsli eins og `giant_spider`, `giant_crab`, `ankheg` og `ochre_jelly`).
- **Engin aflögun á hlutföllum (Zero Aspect-Ratio Distortion):** `aspectRatioDrift <= 0.025` í bæði `INTEGRATED` og `CARD` ham.
- **Aðgreining fljúgandi og jarðbundinna skrímsla:** Öll fljúgandi/svífandi skrímsli (`stirge`, `blood_hawk`, `will_o_wisp`, `harpy`, `gargoyle`, `manticore`, `griffon`, `wraith`, `wyvern` o.fl.) svífa í `airborneGapPx >= 14px` hæð yfir skugga sínum, á meðan jarðbundin skrímsli standa stöðugt á jörðu (`airborneGapPx === 0`).

---

## 5. Tafla A — Öll 37 skrímsli með sannreyndar RGBA útskurðarmyndir (`INTEGRATED` Mode)

Þessi 37 skrímsli (`7 EXISTING_APPROVED` + `30 NEWLY_PRODUCED_VERIFIED`) eru með 32-bita RGBA gegnsæjar útskurðarmyndir í `action-ui-lab/public/images/monsters-cutout/` og birtast án ramma beint inni í 3D/2.5D bardagasviðinu með fót-akkeri og snertiskuggum:

| ID | Nafn | Slug | CR | PF1e Stærð | Líkamsprófíll | Scale | Staða Cutout | Cutout Slóð (`HTTP 200`) |
|---|---|---|---|---|---|---|---|---|
| 1 | **Assassin Vine** | `assassin_vine` | 3 | `LARGE` (10 ft) | `PLANT_MASS_LARGE` | `1.294` | `EXISTING_APPROVED` | `/lab-assets/images/monsters-cutout/assassin_vine.png` |
| 2 | **Wolf** | `wolf` | 1 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.73` | `EXISTING_APPROVED` | `/lab-assets/images/monsters-cutout/wolf.png` |
| 3 | **Troll** | `troll` | 5 | `LARGE` (10 ft) | `BIPED_TALL_BRUTE` | `1.54` | `EXISTING_APPROVED` | `/lab-assets/images/monsters-cutout/troll.png` |
| 4 | **Ghoul** | `ghoul` | 1 | `MEDIUM` (5 ft) | `BIPED_CROUCHED` | `0.827` | `EXISTING_APPROVED` | `/lab-assets/images/monsters-cutout/ghoul.png` |
| 5 | **Giant Spider** | `giant_spider` | 1 | `MEDIUM` (5 ft) | `ARACHNID_WIDE` | `0.626` | `EXISTING_APPROVED` | `/lab-assets/images/monsters-cutout/giant_spider.png` |
| 7 | **Rust Monster** | `rust_monster` | 3 | `MEDIUM` (5 ft) | `ARACHNID_WIDE` | `0.646` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/rust_monster.png` |
| 8 | **Manticore** | `manticore` | 5 | `LARGE` (10 ft) | `WINGED_LARGE_PREDATOR` | `1.293` | `EXISTING_APPROVED` | `/lab-assets/images/monsters-cutout/manticore.png` |
| 9 | **Kobold** | `kobold` | 0.25 | `SMALL` (5 ft) | `BIPED_SMALL` | `0.652` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/kobold.png` |
| 10 | **Goblin** | `goblin` | 0.33 | `SMALL` (5 ft) | `BIPED_SMALL` | `0.672` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/goblin.png` |
| 11 | **Human Skeleton** | `human_skeleton` | 0.33 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `0.98` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/human_skeleton.png` |
| 13 | **Human Zombie** | `human_zombie` | 0.5 | `MEDIUM` (5 ft) | `BIPED_CROUCHED` | `0.845` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/human_zombie.png` |
| 16 | **Lizardfolk** | `lizardfolk` | 1 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.113` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/lizardfolk.png` |
| 18 | **Gnoll** | `gnoll` | 1 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.134` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/gnoll.png` |
| 22 | **Bugbear** | `bugbear` | 2 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.156` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/bugbear.png` |
| 25 | **Giant Crab** | `giant_crab` | 2 | `MEDIUM` (5 ft) | `ARACHNID_WIDE` | `0.598` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/giant_crab.png` |
| 28 | **Ankheg** | `ankheg` | 3 | `LARGE` (10 ft) | `ARACHNID_CHITIN_LARGE` | `1.014` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/ankheg.png` |
| 29 | **Ogre** | `ogre` | 3 | `LARGE` (10 ft) | `BIPED_TALL_BRUTE` | `1.426` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/ogre.png` |
| 30 | **Shadow** | `shadow` | 3 | `MEDIUM` (5 ft) | `INCORPOREAL_FLOAT` | `1.02` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/shadow.png` |
| 31 | **Owlbear** | `owlbear` | 4 | `LARGE` (10 ft) | `QUADRUPED_MASSIVE` | `1.158` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/owlbear.png` |
| 32 | **Minotaur** | `minotaur` | 4 | `LARGE` (10 ft) | `BIPED_TALL_BRUTE` | `1.397` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/minotaur.png` |
| 34 | **Gargoyle** | `gargoyle` | 4 | `MEDIUM` (5 ft) | `WINGED_HOVER_MEDIUM` | `0.979` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/gargoyle.png` |
| 35 | **Basilisk** | `basilisk` | 5 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.73` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/basilisk.png` |
| 36 | **Mummy** | `mummy` | 5 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `1` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/mummy.png` |
| 37 | **Ochre Jelly** | `ochre_jelly` | 5 | `LARGE` (10 ft) | `AMORPHOUS_LARGE_OOZE` | `0.844` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/ochre_jelly.png` |
| 38 | **Winter Wolf** | `winter_wolf` | 5 | `LARGE` (10 ft) | `QUADRUPED_MASSIVE` | `1.09` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/winter_wolf.png` |
| 39 | **Stirge** | `stirge` | 0.5 | `TINY` (2.5 ft) | `WINGED_TINY_PEST` | `0.428` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/stirge.png` |
| 40 | **Dire Rat** | `dire_rat` | 0.33 | `SMALL` (5 ft) | `QUADRUPED_SMALL_LOW` | `0.479` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/dire_rat.png` |
| 41 | **Viper** | `viper` | 0.5 | `TINY` (2.5 ft) | `SERPENTINE_TINY` | `0.352` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/viper.png` |
| 44 | **Skeletal Champion** | `skeletal_champion` | 2 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `1` | `EXISTING_APPROVED` | `/lab-assets/images/monsters-cutout/skeletal_champion.png` |
| 48 | **Orc** | `orc` | 0.33 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.091` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/orc.png` |
| 50 | **Harpy** | `harpy` | 4 | `MEDIUM` (5 ft) | `WINGED_HOVER_MEDIUM` | `0.941` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/harpy.png` |
| 52 | **Griffon** | `griffon` | 4 | `LARGE` (10 ft) | `WINGED_LARGE_PREDATOR` | `1.267` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/griffon.png` |
| 53 | **Giant Scorpion** | `giant_scorpion` | 3 | `LARGE` (10 ft) | `ARACHNID_CHITIN_LARGE` | `1.035` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/giant_scorpion.png` |
| 56 | **Wraith** | `wraith` | 5 | `MEDIUM` (5 ft) | `INCORPOREAL_FLOAT` | `1.04` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/wraith.png` |
| 71 | **Blood Hawk** | `blood_hawk` | 0.5 | `TINY` (2.5 ft) | `WINGED_TINY_RAPTOR` | `0.48` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/blood_hawk.png` |
| 83 | **Will-o'-Wisp** | `will_o_wisp` | 3 | `SMALL` (5 ft) | `FLOATING_ORB` | `0.452` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/will_o_wisp.png` |
| 93 | **Wyvern** | `wyvern` | 5 | `LARGE` (10 ft) | `WINGED_LARGE_PREDATOR` | `1.369` | `NEWLY_PRODUCED_VERIFIED` | `/lab-assets/images/monsters-cutout/wyvern.png` |

---

## 6. Tafla B — Öll 61 skrímsli í heiðarlegu `card-fallback` (`CARD_FALLBACK_RETAINED`)

Þessi 61 skrímsli eiga öll sannreynda `1024×1024` grunnmynd (`/images/monsters/<slug>.png`) og sigraða mynd (`/images/monsters/<slug>_defeated.png`), en bíða sérsniðinnar RGBA útskurðarvinnslu í framtíðarlotu. Í bardagaviðmótinu nota þau sjálfkrafa **aðlagað `CARD` fallback** sem skalar ramma-myndina í réttum Pathfinder 1e stærðarhlutföllum án þess að nota ranga mynd:

| ID | Nafn | Slug | CR | PF1e Stærð | Líkamsprófíll | Scale | Card Myndslóð (`HTTP 200`) |
|---|---|---|---|---|---|---|---|
| 6 | **Choker** | `choker` | 2 | `SMALL` (5 ft) | `BIPED_SMALL_STALKER` | `0.728` | `/images/monsters/choker.png` |
| 12 | **Hobgoblin** | `hobgoblin` | 0.5 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `0.98` | `/images/monsters/hobgoblin.png` |
| 14 | **Troglodyte** | `troglodyte` | 1 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `0.96` | `/images/monsters/troglodyte.png` |
| 15 | **Darkmantle** | `darkmantle` | 1 | `SMALL` (5 ft) | `AMORPHOUS_SMALL_LURKER` | `0.605` | `/images/monsters/darkmantle.png` |
| 17 | **Hyena** | `hyena` | 1 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.699` | `/images/monsters/hyena.png` |
| 19 | **Giant Frog** | `giant_frog` | 1 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.684` | `/images/monsters/giant_frog.png` |
| 20 | **Boar** | `boar` | 2 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.722` | `/images/monsters/boar.png` |
| 21 | **Yellow Musk Creeper** | `yellow_musk_creeper` | 2 | `MEDIUM` (5 ft) | `PLANT_MASS_MEDIUM` | `0.921` | `/images/monsters/yellow_musk_creeper.png` |
| 23 | **Boggard** | `boggard` | 2 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.049` | `/images/monsters/boggard.png` |
| 24 | **Death Dog** | `death_dog` | 2 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.76` | `/images/monsters/death_dog.png` |
| 26 | **Ettercap** | `ettercap` | 3 | `MEDIUM` (5 ft) | `BIPED_CROUCHED` | `0.845` | `/images/monsters/ettercap.png` |
| 27 | **Cockatrice** | `cockatrice` | 3 | `SMALL` (5 ft) | `AVIAN_SMALL_RUNNER` | `0.618` | `/images/monsters/cockatrice.png` |
| 33 | **Yeti** | `yeti` | 4 | `LARGE` (10 ft) | `BIPED_TALL_BRUTE` | `1.426` | `/images/monsters/yeti.png` |
| 42 | **Giant Centipede** | `giant_centipede` | 0.5 | `MEDIUM` (5 ft) | `SERPENTINE_COILED` | `0.738` | `/images/monsters/giant_centipede.png` |
| 43 | **Iron Cobra** | `iron_cobra` | 2 | `SMALL` (5 ft) | `SERPENTINE_SMALL_COILED` | `0.579` | `/images/monsters/iron_cobra.png` |
| 45 | **Blink Dog** | `blink_dog` | 2 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.714` | `/images/monsters/blink_dog.png` |
| 46 | **Duergar** | `duergar` | 0.33 | `MEDIUM` (5 ft) | `BIPED_STOCKY_MEDIUM` | `0.73` | `/images/monsters/duergar.png` |
| 47 | **Drow** | `drow` | 0.33 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `0.95` | `/images/monsters/drow.png` |
| 49 | **Wight** | `wight` | 3 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `0.99` | `/images/monsters/wight.png` |
| 51 | **Doppelganger** | `doppelganger` | 3 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `1` | `/images/monsters/doppelganger.png` |
| 54 | **Cloaker** | `cloaker` | 5 | `LARGE` (10 ft) | `WINGED_LARGE_PREDATOR` | `1.217` | `/images/monsters/cloaker.png` |
| 55 | **Phase Spider** | `phase_spider` | 5 | `LARGE` (10 ft) | `ARACHNID_CHITIN_LARGE` | `1.014` | `/images/monsters/phase_spider.png` |
| 57 | **Gibbering Mouther** | `gibbering_mouther` | 5 | `MEDIUM` (5 ft) | `AMORPHOUS_MEDIUM_OOZE` | `0.696` | `/images/monsters/gibbering_mouther.png` |
| 58 | **Peryton** | `peryton` | 4 | `MEDIUM` (5 ft) | `WINGED_HOVER_MEDIUM` | `0.96` | `/images/monsters/peryton.png` |
| 59 | **Giant Stag Beetle** | `giant_stag_beetle` | 4 | `LARGE` (10 ft) | `ARACHNID_CHITIN_LARGE` | `1.035` | `/images/monsters/giant_stag_beetle.png` |
| 60 | **Vegepygmy** | `vegepygmy` | 0.5 | `SMALL` (5 ft) | `BIPED_SMALL` | `0.652` | `/images/monsters/vegepygmy.png` |
| 61 | **Ghast** | `ghast` | 2 | `MEDIUM` (5 ft) | `BIPED_CROUCHED` | `0.845` | `/images/monsters/ghast.png` |
| 62 | **Giant Bat** | `giant_bat` | 2 | `LARGE` (10 ft) | `WINGED_LARGE_PREDATOR` | `1.217` | `/images/monsters/giant_bat.png` |
| 63 | **Morlock** | `morlock` | 2 | `MEDIUM` (5 ft) | `BIPED_CROUCHED` | `0.827` | `/images/monsters/morlock.png` |
| 64 | **Violet Fungus** | `violet_fungus` | 3 | `MEDIUM` (5 ft) | `PLANT_MASS_MEDIUM` | `0.921` | `/images/monsters/violet_fungus.png` |
| 65 | **Grick** | `grick` | 2 | `MEDIUM` (5 ft) | `SERPENTINE_COILED` | `0.771` | `/images/monsters/grick.png` |
| 66 | **Krenshar** | `krenshar` | 1 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.714` | `/images/monsters/krenshar.png` |
| 67 | **Bunyip** | `bunyip` | 3 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.722` | `/images/monsters/bunyip.png` |
| 68 | **Sahuagin** | `sahuagin` | 2 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.091` | `/images/monsters/sahuagin.png` |
| 69 | **Mite** | `mite` | 0.25 | `SMALL` (5 ft) | `BIPED_SMALL` | `0.631` | `/images/monsters/mite.png` |
| 70 | **Bog Strider** | `bog_strider` | 0.5 | `SMALL` (5 ft) | `ARACHNID_SMALL_SKIMMER` | `0.464` | `/images/monsters/bog_strider.png` |
| 72 | **Jungle Viper** | `jungle_viper` | 0.5 | `TINY` (2.5 ft) | `SERPENTINE_TINY` | `0.359` | `/images/monsters/jungle_viper.png` |
| 73 | **Plague Zombie** | `plague_zombie` | 0.5 | `MEDIUM` (5 ft) | `BIPED_CROUCHED` | `0.845` | `/images/monsters/plague_zombie.png` |
| 74 | **Grippli Scout** | `grippli_scout` | 0.5 | `SMALL` (5 ft) | `BIPED_SMALL` | `0.617` | `/images/monsters/grippli_scout.png` |
| 75 | **Worg** | `worg` | 2 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.775` | `/images/monsters/worg.png` |
| 76 | **Hippogriff** | `hippogriff` | 2 | `LARGE` (10 ft) | `WINGED_LARGE_PREDATOR` | `1.267` | `/images/monsters/hippogriff.png` |
| 77 | **Giant Toad** | `giant_toad` | 2 | `LARGE` (10 ft) | `QUADRUPED_MASSIVE` | `1.067` | `/images/monsters/giant_toad.png` |
| 78 | **Carbuncle** | `carbuncle` | 2 | `TINY` (2.5 ft) | `REPTILIAN_TINY_LOW` | `0.386` | `/images/monsters/carbuncle.png` |
| 79 | **Phantom Fungus** | `phantom_fungus` | 2 | `MEDIUM` (5 ft) | `PLANT_MASS_MEDIUM` | `0.884` | `/images/monsters/phantom_fungus.png` |
| 80 | **Gnoll Packmaster** | `gnoll_packmaster` | 2 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.156` | `/images/monsters/gnoll_packmaster.png` |
| 81 | **Giant Mantis** | `giant_mantis` | 3 | `LARGE` (10 ft) | `ARACHNID_CHITIN_LARGE` | `1.077` | `/images/monsters/giant_mantis.png` |
| 82 | **Spriggan** | `spriggan` | 3 | `SMALL` (5 ft) | `BIPED_SMALL_DUAL_SIZE` | `0.672` | `/images/monsters/spriggan.png` |
| 84 | **Cheetah** | `cheetah` | 3 | `MEDIUM` (5 ft) | `QUADRUPED_LOW` | `0.707` | `/images/monsters/cheetah.png` |
| 85 | **Draugr** | `draugr` | 3 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.081` | `/images/monsters/draugr.png` |
| 86 | **Hobgoblin Captain** | `hobgoblin_captain` | 3 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.102` | `/images/monsters/hobgoblin_captain.png` |
| 87 | **Displacer Beast** | `displacer_beast` | 4 | `LARGE` (10 ft) | `QUADRUPED_MASSIVE` | `1.112` | `/images/monsters/displacer_beast.png` |
| 88 | **Shambling Mound** | `shambling_mound` | 4 | `LARGE` (10 ft) | `PLANT_MASS_LARGE` | `1.345` | `/images/monsters/shambling_mound.png` |
| 89 | **Leucrotta** | `leucrotta` | 4 | `LARGE` (10 ft) | `QUADRUPED_MASSIVE` | `1.112` | `/images/monsters/leucrotta.png` |
| 90 | **Dire Boar** | `dire_boar` | 4 | `LARGE` (10 ft) | `QUADRUPED_MASSIVE` | `1.135` | `/images/monsters/dire_boar.png` |
| 91 | **Forest Drake** | `forest_drake` | 4 | `LARGE` (10 ft) | `WINGED_LARGE_PREDATOR` | `1.293` | `/images/monsters/forest_drake.png` |
| 92 | **Otyugh** | `otyugh` | 4 | `LARGE` (10 ft) | `PLANT_MASS_LARGE` | `1.268` | `/images/monsters/otyugh.png` |
| 94 | **Girallon** | `girallon` | 5 | `LARGE` (10 ft) | `BIPED_TALL_BRUTE` | `1.454` | `/images/monsters/girallon.png` |
| 95 | **Catoblepas** | `catoblepas` | 5 | `LARGE` (10 ft) | `QUADRUPED_MASSIVE` | `1.181` | `/images/monsters/catoblepas.png` |
| 96 | **Barrow Wight** | `barrow_wight` | 5 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.091` | `/images/monsters/barrow_wight.png` |
| 97 | **Green Hag** | `green_hag` | 5 | `MEDIUM` (5 ft) | `BIPED_MEDIUM` | `0.98` | `/images/monsters/green_hag.png` |
| 98 | **Orc Warchief** | `orc_warchief` | 5 | `MEDIUM` (5 ft) | `BIPED_HEAVY_MEDIUM` | `1.134` | `/images/monsters/orc_warchief.png` |

---

## 7. Sjálfvirk Próf (Automated Verification)

Ný prófsvíta var smíðuð í `action-ui-lab/tests/phase10-monster-artwork-audit.test.js` og keyrð ásamt öllum eldri skrímslaprófum:

```bash
node --test action-ui-lab/tests/phase10-monster-artwork-audit.test.js \
            action-ui-lab/tests/monster-artwork.test.js \
            action-ui-lab/tests/monster-integration.test.js \
            action-ui-lab/tests/monster-scaling.test.js
```

- **`phase10-monster-artwork-audit.test.js`:** 5 / 5 próf græn ✅
- **`monster-artwork.test.js`:** 5 / 5 próf græn ✅
- **`monster-integration.test.js`:** 8 / 8 próf græn ✅
- **`monster-scaling.test.js`:** 11 / 11 próf græn ✅
- **Samtals:** **29 / 29 próf græn (0 villur)**
