# Greiningarskýrsla: Byrjunarheimurinn (Level 1–4) í kringum Oakhaven

**Verkefni:** Phase 10 Uber Teamwork — Agent C (Starting World Level 1–4)  
**Dagsetning:** 24. október 2026  
**Sjálfvirk hermunarsvíta:** [`action-ui-lab/tests/phase10-starting-world-sim.test.js`](../../action-ui-lab/tests/phase10-starting-world-sim.test.js) (`5 pass, 0 fail`)  
**Forsendur og hönnunarbönd:**
- `level1AmbushProtected` er **óbreytt (`false`)** — engin falin byrjendavernd er endurvakin á Level 1.
- Ekkert fast hámarks-level (level cap) er sett á hetjur.
- Allar niðurstöður byggja á raunverulegum gagnagrunni (`darkgrid.db`), lifandi lénsrökfræði (`src/domain/*`) og Action UI Lab þjónustulögum (`action-ui-lab/src/*`) með determinískri Monte Carlo hermun (`mulberry32` PRNG).

---

## 1. Leiðakort og Fjarlægðargreining frá Oakhaven `[15, 27]`

Byrjunarborgin **Oakhaven** stendur á reit `[15, 27]` syðst í Blackwood-dalnum á `44 × 30` heimskortinu (`1.320` reitir alls, þar af `1.148` gengir reitir). Eini útgöngupunkturinn úr borginni er **Oakhaven North Gate** á `[15, 26]`, sem er jafnframt eini reiturinn utan borgarmúra sem nýtur `OAKHAVEN_SAFE` verndar (`0%` encounter líkur).

Um leið og leikmaður stígur annað skrefið sitt norður á `[15, 25]` (Chebyshev-fjarlægð `2` frá Oakhaven) er hann kominn út í opið hættusvæði.

### 1.1 Yfirlit yfir helstu leiðir frá Oakhaven `[15, 27]`

Taflan hér að neðan sýnir nákvæma skrefatalningu og samsetningu hættusvæða (`resolveTileDangerZone`) og landslags (`terrain_type`) á öllum helstu leiðum frá Oakhaven:

| Leiðarauðkenni | Áfangastaður | Skref (Reitir) | Chebyshev fjarlægð | Hættusvæðaskipting (skref) | Landslagsskipting (reitir) |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **`ROUTE_A_MAIN_TRAIL`** | Goblin Stronghold `[15, 2]` (Aðalstígur) | **31** (32) | 25 | `OAKHAVEN_SAFE` (1), `GOBLIN_FOREST_ROAD` (24), `GOBLIN_HUNTING_GROUNDS` (1), `STRONGHOLD_APPROACH` (4), `GOBLIN_STRONGHOLD_GATE` (1) | `TOWN` (1), `PLAINS` (7), `FOREST` (24) |
| **`ROUTE_B_WESTERN_WILDERNESS`** | Goblin Stronghold `[15, 2]` (Vesturleið framhjá Goblin Cave) | **43** (44) | 25 | `OAKHAVEN_SAFE` (1), `GOBLIN_FOREST_ROAD` (31), `GOBLIN_CAVE_APPROACH` (4), `STRONGHOLD_APPROACH` (6), `GOBLIN_STRONGHOLD_GATE` (1) | `TOWN` (1), `PLAINS` (3), `FOREST` (40) |
| **`ROUTE_B_GOBLIN_CAVE_SPUR`** | The Goblin Cave `[9, 12]` (Eftir vesturstíg um `[6, 13]`) | **27** (28) | 15 | `OAKHAVEN_SAFE` (1), `GOBLIN_FOREST_ROAD` (22), `GOBLIN_CAVE_APPROACH` (3), `GOBLIN_CAVE_ENTRANCE` (1) | `TOWN` (1), `PLAINS` (3), `FOREST` (23), `HILLS` (1) |
| **`ROUTE_SHORTEST_GOBLIN_CAVE`** | The Goblin Cave `[9, 12]` (BFS stysta leið, 5 skref utan vegar) | **21** (22) | 15 | `OAKHAVEN_SAFE` (1), `GOBLIN_FOREST_ROAD` (15), `GOBLIN_FOREST_OFF_ROAD` (2), `GOBLIN_CAVE_APPROACH` (3), `GOBLIN_CAVE_ENTRANCE` (1) | `TOWN` (1), `PLAINS` (4), `FOREST` (16), `HILLS` (1) |
| **`ROUTE_C_EASTERN_RIVER`** | Goblin Stronghold `[15, 2]` (Austurleið meðfram ánni) | **45** (46) | 25 | `OAKHAVEN_SAFE` (1), `GOBLIN_FOREST_ROAD` (25), `UNDEAD_BARROW_ROAD` (9), `GOBLIN_HUNTING_GROUNDS` (3), `STRONGHOLD_APPROACH` (6), `GOBLIN_STRONGHOLD_GATE` (1) | `TOWN` (1), `PLAINS` (9), `FOREST` (36) |
| **`ROUTE_D_UNDEAD_SEPULCHER_ROAD`** | The Ancient Crypt `[26, 5]` (Um brúna `[23, 21]`) | **33** (34) | 22 | `OAKHAVEN_SAFE` (1), `GOBLIN_FOREST_ROAD` (8), `UNDEAD_BARROW_ROAD` (19), `CRYPT_SEPULCHER_APPROACH` (4), `ANCIENT_CRYPT_ENTRANCE` (1) | `TOWN` (1), `PLAINS` (6), `FOREST` (3), `SWAMP` (16), `HILLS` (8) |
| **`ROUTE_E_RAVENCRAG_HIGHLAND_ROAD`** | Ravencrag Citadel `[37, 3]` (Um `[27, 21]` og `[32, 22]`) | **46** (47) | 34 | `OAKHAVEN_SAFE` (1), `GOBLIN_FOREST_ROAD` (8), `UNDEAD_BARROW_ROAD` (9), `HIGHLAND_FOOTHILL_ROAD` (10), `HIGHLAND_SHATTERED_GORGE` (11), `STORMPEAK_CITADEL_APPROACH` (6), `RAVENCRAG_CITADEL_GATE` (1) | `TOWN` (1), `PLAINS` (6), `FOREST` (7), `SWAMP` (8), `HILLS` (25) |

### 1.2 Lykilathuganir um landfræði og leiðarkerfi

1. **`OAKHAVEN_OUTSKIRTS` er aðeins sjónrænt biome en ekki hættusvæði:**
   - Í [`topdown-world-service.js`](../../action-ui-lab/src/topdown-world-service.js) fá reitir á `y = 25..26, x = 12..18` merkinguna `biome = 'OAKHAVEN_OUTSKIRTS'` og `terrain_type = 'PLAINS'`.
   - Hins vegar hefur `resolveTileDangerZone` **enga sérstaka reglu fyrir `OAKHAVEN_OUTSKIRTS`**. Reitur `[15, 25]` (2 skref frá Oakhaven) fellur því beint í `GOBLIN_FOREST_ROAD` (`18%` raw encounter, `25%` ambush), og reitur `[14, 25]` (utan vegar í jaðri bæjarins) fellur beint í `GOBLIN_FOREST_OFF_ROAD` (`24%` raw encounter, `38%` ambush).
2. **Skörun `ROUTE_C_EASTERN_RIVER` við Undead Lands (`x = 21..22`):**
   - Austurstígurinn meðfram ánni (`ROUTE_C_EASTERN_RIVER`) liggur um `x = 22` (`y = 22..18`) og `x = 21` (`y = 18..15`) vestan megin við ánna/brúna á `[23, 21]`. Vegna þess hvernig svæðismörk Undead Lands eru skilgreind lenda **9 skref á austurstíg Blackwood-skógar** í `UNDEAD_BARROW_ROAD` (`20%` encounter, `28%` ambush) og draga þar upp Undead Lands skrímsli (`Ghoul` CR 1, `Shadow` CR 3) vestan árinnar!
3. **Aðgengi að The Goblin Cave (`[9, 12]`):**
   - Ef leikmaður fylgir eingöngu merktum stíg (`ROUTE_B_GOBLIN_CAVE_SPUR` vestur að `[6, 13]` og til baka austur að `[9, 12]`) tekur ferðin **27 skref**. Ef leikmaður stytti sér leið af aðalstígnum við `[12, 15]` yfir 2 skógarreiti utan vegar (`ROUTE_SHORTEST_GOBLIN_CAVE`) tekur ferðin aðeins **21 skref**.

---

## 2. Hættusvæði, CR-þök og Skrímslasafn (Monster Pools) fyrir Level 1–4

### 2.1 Yfirlit yfir öll 15 hættusvæðin (`DANGER_ZONE_PROFILES`)

| Svæðislykill (`zoneKey`) | Heiti svæðis | Hættustig (`threatTier`) | Raw Encounter % | Raw Ambush % | Helsta hlutverk á Level 1–4 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `OAKHAVEN_SAFE` | Oakhaven Safe Zone | 0 | **0%** | **0%** | `[15, 27]` og `[15, 26]` (North Gate) |
| `GOBLIN_FOREST_ROAD` | Blackwood Trail | 1 | **18%** | **25%** | Aðalstígar í Blackwood (`y = 10..25`) |
| `GOBLIN_FOREST_OFF_ROAD` | Deep Blackwood Thicket | 2 | **24%** | **38%** | Skógarreitir utan stíga í Blackwood |
| `GOBLIN_CAVE_APPROACH` | Goblin Cave Approach | 2 | **26%** | **40%** | Aðkoma að Goblin Cave (`[7..9, 12..13]`) |
| `GOBLIN_CAVE_ENTRANCE` | The Goblin Cave Entrance | 3 | **30%** | **44%** | Hellismynni á `[9, 12]` |
| `GOBLIN_HUNTING_GROUNDS` | Goblin Hunting Grounds | 3 | **30%** | **45%** | Norðurhluti Blackwood og veiðilönd |
| `STRONGHOLD_APPROACH` | Stronghold Palisade Approach | 4 | **36%** | **52%** | Síðustu 4–6 skrefin að `[15, 2]` |
| `GOBLIN_STRONGHOLD_GATE` | Goblin Stronghold Gate | 5 | **100%** | **60%** | Boss-reitur Warchief Grak (`[15, 2]`) |
| `UNDEAD_BARROW_ROAD` | Deadman's Barrow Road | 2 | **20%** | **28%** | Vegur um grafhaugamýrar (`x >= 21..26`) |
| `UNDEAD_FEN_WILDERNESS` | Blighted Fen & Barrows | 3 | **28%** | **42%** | Mýrar og grafhaugar utan vegar |
| `CRYPT_SEPULCHER_APPROACH` | Ancient Sepulcher Approach | 4 | **34%** | **48%** | Síðustu 4 skrefin að `[26, 5]` |
| `ANCIENT_CRYPT_ENTRANCE` | The Ancient Crypt Entrance | 4 | **36%** | **50%** |Inngangur í Ancient Crypt á `[26, 5]` |
| `HIGHLAND_FOOTHILL_ROAD` | Ravencrag Foothill Trail | 3 | **22%** | **32%** | Fjallavegur frá `[28, 22]` upp að `[34, 18]` |
| `HIGHLAND_SHATTERED_GORGE` | Shattered Gorge & Crags | 4 | **30%** | **45%** | Gil og klettastígar (`y = 8..17, x >= 34`) |
| `STORMPEAK_CITADEL_APPROACH` | Stormpeak Citadel Approach | 5 | **38%** | **54%** | Síðustu 6 skrefin að `[37, 3]` |

### 2.2 Fjarlægðarbundin CR-þök (`DISTANCE_CR_TIERS`) vs. Raunverulegt Skrímslaval

Í [`src/domain/encounters/engine.js`](../../src/domain/encounters/engine.js) eru skilgreind fjarlægðarbundin CR-þök (`DISTANCE_CR_TIERS`):
- **Fjarlægð 1–2 frá bæ:** `maxCr = 0.33`
- **Fjarlægð 3–5 frá bæ:** `maxCr = 0.50`
- **Fjarlægð 6–10 frá bæ:** `maxCr = 1.00`
- **Fjarlægð 11–18 frá bæ:** `maxCr = 2.00`
- **Fjarlægð 19–28 frá bæ:** `maxCr = 3.00`
- **Fjarlægð 29–40 frá bæ:** `maxCr = 4.00`

> [!WARNING]
> **Alvarlegt misræmi milli `DISTANCE_CR_TIERS` og `selectRegionalEncounterMonster`:**  
> Þegar leikmaður ferðast um `44 × 30` kortið í Action UI Lab kallar [`adventure-engine.js`](../../action-ui-lab/src/adventure-engine.js) á `selectRegionalEncounterMonster` í [`topdown-world-service.js`](../../action-ui-lab/src/topdown-world-service.js). Það fall **kallar alls ekki á `getMaxCrForDistance(distFromOakhaven)`** heldur velur skrímsli eingöngu út frá svæðislista (`selectGoblinForestMonster`, `selectUndeadLandsMonster`, `selectRavencragHighlandsMonster`) og `solo_level <= heroLevel + 1` (eða beinum nafnalista).
>
> Afleiðingar þessa eru:
> 1. **Við borgarhlið Oakhaven (`[15, 25]`, fjarlægð 2):** Í stað þess að CR sé takmarkað við `0.33` (`Goblin`, `Dire Rat`, `Mite`) getur Level 1 hetja mætt **CR 0.5 `Hobgoblin` (`25.7%`)** eða **CR 1 `Wolf` (`3.3%`) og `Giant Spider` (`0.9%`)** strax á öðru skrefi!
> 2. **Í Undead Lands á Level 1:** Vegna þess að `selectUndeadLandsMonster` velur úr föstum nafnalista (`Human Skeleton`, `Human Zombie`, `Plague Zombie`, `Ghoul`, `Shadow`, `Stirge`, `Dire Rat`, `Giant Spider`) án `solo_level` síu í fyrsta valþrepi, þá er **`Shadow` (CR 3, `solo_level = 3`, 14 HP, AC 15, +4 1d6)** valið í **41.9% tilfella á Level 1**!
> 3. **Í Ravencrag Highlands á Level 1:** Á sama hátt velur `selectRavencragHighlandsMonster` **`Harpy` (CR 4, `solo_level = 4`, 29 HP, AC 16, +8 1d6+1)** í **15.8% tilfella** og **`Worg` (CR 2, `solo_level = 2`, 17 HP)** í **17.2% tilfella** gegn Level 1 hetju!

### 2.3 Raunveruleg dreifing skrímsla (Monster Pool Distribution) á Level 1–4

Eftirfarandi töflur sýna niðurstöður úr `1.000` sýnum á hverju svæði fyrir hvert hetjustig (Level 1–4):

#### A. Blackwood / Goblin Forest (`GOBLIN_FOREST`)
| Skrímsli | CR | Solo Lvl | HP | AC | Árás og Skaði | XP | L1 Hlutfall | L2 Hlutfall | L3 Hlutfall | L4 Hlutfall |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Goblin** | 0.33 | 1 | 5 | 16 | `+2` (`1d4`) | 135 | **53.9%** | **40.0%** | **35.1%** | **38.7%** |
| **Hobgoblin** | 0.50 | 1 | 8 | 16 | `+2` (`1d8+1`) | 200 | **25.7%** | **17.5%** | **16.0%** | **15.8%** |
| **Dire Rat** | 0.33 | 1 | 4 | 14 | `+1` (`1d4`) | 135 | **4.4%** | 3.6% | 3.5% | 2.7% |
| **Blood Hawk** | 0.50 | 1 | 5 | 15 | `+4` (`1d4`) | 200 | **3.9%** | 3.4% | 3.2% | 3.4% |
| **Viper** | 0.50 | 1 | 5 | 14 | `+5` (`1d2-2`) | 200 | **3.7%** | 2.4% | 3.5% | 2.9% |
| **Wolf** | 1.00 | 1 | 10 | 14 | `+2` (`1d6+1`) | 400 | **3.3%** | 3.4% | 2.4% | 2.6% |
| **Mite** | 0.25 | 1 | 4 | 13 | `+1` (`1d3`) | 100 | 1.6% | 1.2% | 1.5% | 0.7% |
| **Vegepygmy** | 0.50 | 1 | 5 | 16 | `+1` (`1d6+1`) | 200 | 1.4% | 1.3% | 1.1% | 0.7% |
| **Stirge** | 0.50 | 1 | 4 | 16 | `+7` (`1d4-2`) | 200 | 1.2% | 0.9% | 1.2% | 0.9% |
| **Giant Spider** | 1.00 | 1 | 12 | 14 | `+2` (`1d6`) | 400 | 0.9% | 1.2% | 0.9% | 1.0% |
| **Worg** | 2.00 | 2 | 17 | 14 | `+5` (`1d6+3`) | 600 | — | **11.4%** | **9.2%** | **10.5%** |
| **Bugbear** | 2.00 | 2 | 12 | 17 | `+5` (`1d8+3`) | 600 | — | **10.6%** | **10.3%** | **10.9%** |
| **Boar** | 2.00 | 2 | 14 | 14 | `+4` (`1d8+4`) | 600 | — | 2.5% | 3.9% | 3.1% |
| **Orc** | 0.33 | 1 | 5 | 13 | `+3` (`1d6+2`) | 135 | — | 0.6% | 1.5% | 0.9% |
| **Hobgoblin Captain** | 3.00 | 3 | 24 | 18 | `+7` (`1d8+4`) | 800 | — | — | **6.7%** | **5.2%** |
| *Meðaltöl svæðis* | | | | | | | **CR 0.42 / 169 XP** | **CR 0.81 / 277 XP** | **CR 0.96 / 313 XP** | **CR 0.94 / 308 XP** |

#### B. The Goblin Cave (`GOBLIN_CAVE`)
| Skrímsli | CR | Solo Lvl | HP | AC | Árás og Skaði | XP | L1 Hlutfall | L2 Hlutfall | L3 Hlutfall | L4 Hlutfall |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Mite** | 0.25 | 1 | 4 | 13 | `+1` (`1d3`) | 100 | **20.7%** | — | — | — |
| **Hobgoblin** | 0.50 | 1 | 8 | 16 | `+2` (`1d8+1`) | 200 | **20.1%** | **16.8%** | **16.2%** | **15.4%** |
| **Goblin** | 0.33 | 1 | 5 | 16 | `+2` (`1d4`) | 135 | **19.9%** | **16.7%** | **18.0%** | **15.3%** |
| **Giant Spider** | 1.00 | 1 | 12 | 14 | `+2` (`1d6`) | 400 | **19.9%** | **14.9%** | **13.4%** | **17.3%** |
| **Stirge** | 0.50 | 1 | 4 | 16 | `+7` (`1d4-2`) | 200 | **19.4%** | **17.6%** | **17.6%** | **15.6%** |
| **Bugbear** | 2.00 | 2 | 12 | 17 | `+5` (`1d8+3`) | 600 | — | **18.0%** | **16.1%** | **17.0%** |
| **Hobgoblin Captain** | 3.00 | 3 | 24 | 18 | `+7` (`1d8+4`) | 800 | — | **16.0%** | **18.7%** | **19.4%** |
| *Meðaltöl svæðis* | | | | | | | **CR 0.51 / 206 XP** | **CR 1.22 / 387 XP** | **CR 1.25 / 392 XP** | **CR 1.30 / 409 XP** |

> [!IMPORTANT]
> Sjáðu stökkið í `GOBLIN_CAVE` milli Level 1 og Level 2: um leið og hetjan nær Level 2 opnast bæði `Bugbear` (CR 2, 18.0%) og **`Hobgoblin Captain` (CR 3, 24 HP, AC 18, +7 `1d8+4`, 16.0%)** vegna þess að `dungeon-service.js` leyfir `solo_level <= heroLevel + 1` (þ.e. `solo_level <= 3` á Level 2). Fyrir Level 2 hetju er `Hobgoblin Captain` nánast ósigrandi í venjulegum gangabardaga!

#### C. Undead Lands (`UNDEAD_LANDS`) og Ravencrag Highlands (`RAVENCRAG_HIGHLANDS`)
| Svæði | Skrímsli | CR | Solo Lvl | HP | AC | Árás og Skaði | XP | L1 % | L2 % | L3 % | L4 % |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Undead Lands** | **Ghoul** | 1.00 | 1 | 10 | 14 | `+3` (`1d6+1`) | 400 | **44.6%** | **34.6%** | **23.0%** | **22.8%** |
| **Undead Lands** | **Shadow** | 3.00 | 3 | 14 | 15 | `+4` (`1d6`) | 800 | **41.9%** | **32.7%** | **23.7%** | **24.8%** |
| **Undead Lands** | **Wight** | 3.00 | 3 | 20 | 15 | `+4` (`1d4+1`) | 800 | — | **16.9%** | **12.3%** | **13.7%** |
| **Undead Lands** | **Ghast** | 2.00 | 2 | 13 | 16 | `+5` (`1d6+3`) | 600 | — | — | **11.9%** | **11.3%** |
| **Undead Lands** | **Wraith** | 5.00 | 5 | 35 | 18 | `+6` (`1d6`) | 1600 | — | — | **14.6%** | **11.8%** |
| **Undead Lands** | *Stirge / Spider / Rat* | 0.33–1 | 1 | 4–12 | 14–16 | Ýmis | 135–400 | 13.5% | 15.8% | 14.5% | 15.6% |
| **Ravencrag** | **Orc** | 0.33 | 1 | 5 | 13 | `+3` (`1d6+2`) | 135 | **19.1%** | 15.7% | 17.0% | 15.0% |
| **Ravencrag** | **Worg** | 2.00 | 2 | 17 | 14 | `+5` (`1d6+3`) | 600 | **17.2%** | **17.9%** | **17.1%** | **16.7%** |
| **Ravencrag** | **Harpy** | 4.00 | 4 | 29 | 16 | `+8` (`1d6+1`) | 1200 | **15.8%** | **15.4%** | **16.7%** | **16.9%** |
| **Ravencrag** | **Wolf** | 1.00 | 1 | 10 | 14 | `+2` (`1d6+1`) | 400 | **15.7%** | 16.1% | 16.5% | 18.8% |
| **Ravencrag** | **Blood Hawk / Hobgoblin** | 0.50 | 1 | 5–8 | 15–16 | Ýmis | 200 | **32.2%** | — | — | — |
| **Ravencrag** | **Gnoll** | 1.00 | 1 | 8 | 15 | `+3` (`1d6+2`) | 400 | — | **16.8%** | **16.7%** | **15.7%** |
| **Ravencrag** | **Ogre** | 3.00 | 3 | 23 | 17 | `+7` (`2d8+7`) | 800 | — | **18.1%** | **16.0%** | **16.9%** |

> [!CAUTION]
> Athugið að í `UNDEAD_LANDS` vantar alveg `Human Skeleton` (CR 0.33) og `Human Zombie` / `Plague Zombie` (CR 0.5) í úrtakið! Ástæðan er sú að `selectUndeadLandsMonster` leitar að skrímslum í töflunni `monsters` þar sem `terrain` inniheldur `SWAMP` eða `HILLS` (eða notar lista sem síast út), en í `db/seeds/001_monsters.sql` eru `Human Skeleton` (`DUNGEON,PLAINS,RUINS`) og `Human Zombie` (`DUNGEON,PLAINS,RUINS`) **ekki** með `SWAMP` í `terrain` dálknum sínum þegar `SWAMP`-reitur er valinn! Fyrir vikið detta ódýru beinagrindurnar og uppvakningarnir út á mýrarreitum (`SWAMP`), svo `Ghoul` (44.6%) og `Shadow` (41.9%) taka yfir nánast allt svæðið á Level 1!

---

## 3. Monte Carlo Hermun á Gönguferðum (Step-to-Encounter & Ambush Greining)

Til að meta hversu langt hetja kemst frá Oakhaven áður en 1., 2. og 3. bardagi skellur á voru keyrðar **300 gönguhermanir á hverja leið fyrir hverja stétt** (bæði með `computeStepEncounterChance` pacing-kerfinu sem stýrir `stepsSinceEncounter` drottnun/uppsöfnun, og með hráum `resolveTileDangerZone` líkum).

### 3.1 Niðurstöður gönguhermunar (Paced Step Encounter Engine)

| Leið (Heildarskref) | Stétt | Meðalskref í 1. bardaga (Miðgildi) | Meðalskref í 2. bardaga (Miðgildi) | Meðalskref í 3. bardaga (Miðgildi) | Meðalfjöldi bardaga á leið | Meðalfjöldi fyrirsáta (Ambush) | Hlutfall fyrirsáta af bardögum | Fyrirsátum afstýrt af Ranger (`foiledByRanger`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`ROUTE_A_MAIN_TRAIL`** (31 skref) | **Fighter** | **6.3** (5) | **12.5** (11) | **18.2** (18) | **4.79** | 1.38 | **28.9%** | 0.0% |
| | **Ranger** | **6.3** (6) | **12.7** (12) | **18.4** (18) | **4.72** | **0.26** | **5.5%** | **6.6%** |
| | **Cleric** | **6.5** (5) | **12.8** (12) | **18.6** (18) | **4.69** | 0.98 | **20.8%** | 0.0% |
| **`ROUTE_B_GOBLIN_CAVE_SPUR`** (27 skref) | **Fighter** | **6.2** (5) | **12.6** (12) | **17.5** (17) | **3.98** | 1.09 | **27.4%** | 0.0% |
| | **Ranger** | **6.5** (5) | **12.7** (12) | **17.8** (18) | **3.91** | **0.19** | **4.9%** | **5.3%** |
| | **Cleric** | **6.4** (5) | **12.7** (12) | **17.6** (18) | **3.97** | 0.80 | **20.2%** | 0.0% |
| **`ROUTE_B_WESTERN_WILDERNESS`** (43 skref) | **Fighter** | **6.2** (5) | **12.7** (12) | **18.8** (18) | **7.00** | 2.24 | **32.0%** | 0.0% |
| | **Ranger** | **6.1** (5) | **12.3** (12) | **18.4** (18) | **7.03** | **0.50** | **7.1%** | **6.5%** |
| | **Cleric** | **6.3** (5) | **13.0** (12) | **19.1** (18) | **6.96** | 1.73 | **24.9%** | 0.0% |
| **`ROUTE_C_EASTERN_RIVER`** (45 skref) | **Fighter** | **6.8** (6) | **12.6** (12) | **18.0** (17) | **7.42** | 2.25 | **30.3%** | 0.0% |
| | **Ranger** | **6.8** (7) | **12.7** (13) | **18.1** (17) | **7.30** | **0.51** | **7.0%** | **5.4%** |
| | **Cleric** | **6.7** (6) | **12.7** (12) | **18.5** (17) | **7.37** | 1.66 | **22.5%** | 0.0% |
| **`ROUTE_D_UNDEAD_SEPULCHER_ROAD`** (33 skref) | **Fighter** | **6.9** (7) | **12.1** (12) | **16.8** (16) | **6.16** | 2.08 | **33.8%** | 0.0% |
| | **Ranger** | **6.8** (6) | **12.1** (12) | **16.9** (16) | **6.12** | **0.45** | **7.4%** | **7.1%** |
| | **Cleric** | **6.6** (7) | **12.0** (11) | **16.8** (16) | **6.08** | 1.58 | **25.9%** | 0.0% |
| **`ROUTE_E_RAVENCRAG_HIGHLAND_ROAD`** (46 skref) | **Fighter** | **6.6** (7) | **12.0** (11) | **17.3** (16) | **7.95** | 2.49 | **31.3%** | 0.0% |
| | **Ranger** | **6.6** (6) | **11.9** (11) | **17.0** (16) | **8.16** | **0.58** | **7.1%** | **7.5%** |
| | **Cleric** | **6.5** (6) | **11.8** (11) | **16.9** (16) | **8.20** | 2.15 | **26.2%** | 0.0% |

### 3.2 Túlkun á gönguhrynjandi (Travel Pacing)

- **Fyrsti bardagi kemur að meðaltali á skrefi 6.1–6.9 (miðgildi skref 5–6):** Það þýðir að leikmaður sem gengur norður eftir Blackwood Trail lendir nær alltaf í fyrsta bardaga sínum á bilinu `[15, 22]` til `[15, 21]` (rétt sunnan við eða við vegamótin að vesturleiðinni).
- **Heildarfjöldi bardaga á leið að fyrstu dýflissu (`The Goblin Cave`, 27 skref):** Að meðaltali **3.9–4.0 bardagar** hvora leið (alls **~8 bardagar** fram og til baka, auk bardaga inni í hellinum sjálfum).
- **Heildarfjöldi bardaga að `Goblin Stronghold` (`[15, 2]`, 31 skref):** Að meðaltali **4.7–4.8 bardagar** áður en fimmti bardaginn (Warchief Grak á `[15, 2]`, `100%` encounter) tekur við.
- **Sérhæfing Ranger í fyrirsátavörn (`Keen Eye` + WIS 14):** Ranger lækkar hlutfall fyrirsáta úr **28.9%–33.8%** (hjá Fighter) niður í aðeins **4.9%–7.4%**! Þetta er gríðarlega mikilvægur stéttareiginleiki, sérstaklega þar sem fyrirsát læsir `Flee` í fyrstu 2 lotum bardagans (`AMBUSH_FLEE_LOCKED`).

---

## 4. Monte Carlo Bardagahermun og Lífslíkur (Survival Analysis Level 1–4)

### 4.1 Tölfræði hetjustétta á Level 1–4 (`src/domain/character/rules.js`)

Allar hetjur í hermuninni eru búnar til með sjálfgefnum stéttartölum (`useClassDefaults: true`) og uppfærðar samkvæmt [`applyAutomaticProgressionForLevelUp`](../../src/domain/character/rules.js) (full HP á hverju stigi og sjálfvirkur hæfileikaauki á jöfnum stigum):

| Stétt | Level | Max HP | AC | Attack Bonus | Vopnaskaði | STR / DEX / CON / WIS | Divine Charges (`max`) | Sérhæfðir bardagahæfileikar |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **FIGHTER** | **L1** | **14** | 16 | `+2` | `1d4+2` | 14 / 12 / 14 / 12 | 0 | Power Attack (`-2 ATK, +4 DMG`), Shield Wall (`+3 AC`) |
| | **L2** | **23** | 16 | `+3` | `1d4+2` | 15 / 12 / 14 / 12 | 0 | |
| | **L3** | **32** | 16 | `+4` | `1d4+2` | 15 / 12 / 14 / 12 | 0 | |
| | **L4** | **41** | 16 | `+6` | `1d4+3` | 16 / 12 / 14 / 12 | 0 | STR fer í 16 (`+3` mod) |
| **RANGER** | **L1** | **11** | 15 | `+0` (`+4` Aimed) | `1d4` (+`1d4` Aimed) | 10 / 16 / 12 / 14 | 0 | Aimed Shot (1. lota: `+DEX` ATK og `+1d4` DMG), Evasive Roll |
| | **L2** | **18** | 15 | `+1` (`+5` Aimed) | `1d4` (+`1d4` Aimed) | 10 / 17 / 12 / 14 | 0 | |
| | **L3** | **25** | 15 | `+2` (`+6` Aimed) | `1d4` (+`1d4` Aimed) | 10 / 17 / 12 / 14 | 0 | |
| | **L4** | **32** | 16 | `+3` (`+8` Aimed) | `1d4` (+`1d4` Aimed) | 10 / 18 / 12 / 14 | 0 | DEX fer í 18 (`+4` mod -> AC 16) |
| **CLERIC** | **L1** | **9** | 16 | `+2` | `1d4+1` | 12 / 10 / 12 / 16 | **10** | Cure Light Wounds (`1d8+lvl+WIS`), Divine Shield, Turn Undead |
| | **L2** | **15** | 16 | `+3` | `1d4+1` | 12 / 10 / 12 / 17 | **11** | |
| | **L3** | **21** | 16 | `+4` | `1d4+1` | 12 / 10 / 12 / 17 | **12** | |
| | **L4** | **27** | 16 | `+4` | `1d4+1` | 12 / 10 / 12 / 18 | **14** | WIS fer í 18 (`+4` mod) |

> [!NOTE]
> **Veikleiki Ranger í nærmardaga eftir lotu 1:** Í [`src/domain/combat/rules.js`](../../src/domain/combat/rules.js) reiknast venjuleg `FIGHT` árás alltaf út frá `STR` (`calculateModifier(hero.str) + Math.floor(level * 0.75)`). Þar sem Ranger byrjar með `STR 10` (`+0`) er venjulegur árásarbónus hans á Level 1 aðeins **`+0`** og skaðinn **`1d4+0`**! Ranger reiðir sig því nánast alfarið á `RANGER_AIMED_SHOT` í 1. lotu (sem bætir `+DEX` við árás og `+1d4` við skaða). Ef skrímslið lifir 1. lotu af (t.d. `Hobgoblin` með 8 HP og AC 16 eða `Bugbear` með 12 HP og AC 17), þá hittir Level 1 Ranger AC 16 skrímsli aðeins í **25% tilfella** (`d20 + 0 >= 16`) frá lotu 2!

### 4.2 Bardagahermun á 6 lykilsvæðum (80 bardagar per stétt/level/svæði = 5.760 bardagar)

Í töflunni hér að neðan byrjar hetjan hvern einasta bardaga með **100% HP** og notar taktíska gervigreind (Ranger notar `Aimed Shot` í 1. lotu; Cleric notar `Turn Undead` gegn ódauðum og `Cure Light Wounds` þegar HP <= 55%; hetjur reyna `Flee` þegar HP <= 30% gegn ofurefli ef fyrirsát læsir ekki flótta):

| Svæði | Level | Stétt | Sigur % (Win) | Flótti % (Flee) | Dauði % (Death) | Ambush % | Dauði í Ambush % | Dauði í Spotted % | Meðallotur | HP eftir við sigur |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`GOBLIN_FOREST_ROAD`** `[15, 24]` | **L1** | Fighter | **86.3%** | 5.0% | **8.8%** | 32.5% | 3.8% | 11.1% | 2.9 | 84.3% |
| | **L1** | Ranger | **82.5%** | 2.5% | **15.0%** | 7.5% | **33.3%** | 13.5% | 2.2 | 81.1% |
| | **L1** | Cleric | **76.3%** | 13.8% | **10.0%** | 22.5% | 0.0% | 12.9% | 2.8 | 87.6% |
| | **L2** | Fighter | **87.5%** | 2.5% | **10.0%** | 36.3% | 6.9% | 11.8% | 3.4 | 80.7% |
| | **L2** | Ranger | **92.5%** | 1.3% | **6.3%** | 5.0% | 0.0% | 6.6% | 2.6 | 79.1% |
| | **L2** | Cleric | **78.8%** | 3.8% | **17.5%** | 22.5% | 5.6% | 21.0% | 3.0 | 81.1% |
| | **L3** | Fighter | **91.3%** | 2.5% | **6.3%** | 26.3% | 4.8% | 6.8% | 3.5 | 84.4% |
| | **L3** | Ranger | **93.8%** | 2.5% | **3.8%** | 8.8% | 0.0% | 4.1% | 2.4 | 80.3% |
| | **L3** | Cleric | **83.8%** | 7.5% | **8.8%** | 35.0% | 14.3% | 5.8% | 3.0 | 81.9% |
| | **L4** | Allar stéttir | **92.5–98.8%** | 0–6.3% | **1.3–3.8%** | 5–31% | 0.0% | 1.8–3.9% | 1.9–3.3 | 84–90% |
| **`GOBLIN_HUNTING_GROUNDS`** `[19, 13]` | **L1** | Fighter | **86.3%** | 7.5% | **6.3%** | 46.3% | 5.4% | 7.0% | 3.0 | 82.7% |
| | **L1** | Ranger | **88.8%** | 2.5% | **8.8%** | 17.5% | **28.6%** | 4.5% | 2.3 | 83.5% |
| | **L1** | Cleric | **81.3%** | 17.5% | **1.3%** | 52.5% | 2.4% | 0.0% | 2.3 | 83.8% |
| | **L2** | Fighter | **85.0%** | 7.5% | **7.5%** | 52.5% | 2.4% | 13.2% | 3.2 | 81.6% |
| | **L2** | Ranger | **87.5%** | 2.5% | **10.0%** | 15.0% | 0.0% | 11.8% | 2.4 | 83.7% |
| | **L2** | Cleric | **77.5%** | 3.8% | **18.8%** | 46.3% | 16.2% | 20.9% | 2.9 | 76.5% |
| | **L3** | Allar stéttir | **88.8–93.8%** | 0–8.8% | **2.5–7.5%** | 17–48% | 0–7.1% | 4.8–8.9% | 2.3–3.3 | 78–85% |
| | **L4** | Allar stéttir | **93.8–98.8%** | 0–2.5% | **0.0–3.8%** | 22–48% | 0–5.7% | 0.0–3.2% | 1.9–3.1 | 83–89% |
| **`GOBLIN_CAVE`** `[9, 12]` | **L1** | Fighter | **88.8%** | 5.0% | **6.3%** | 0% | — | 6.3% | 2.9 | 80.5% |
| | **L1** | Ranger | **90.0%** | 5.0% | **5.0%** | 0% | — | 5.0% | 2.4 | 82.7% |
| | **L1** | Cleric | **62.5%** | 25.0% | **12.5%** | 0% | — | 12.5% | 2.7 | 81.8% |
| | **L2** | Fighter | **71.3%** | 11.3% | **17.5%** | 0% | — | **17.5%** | 3.3 | 78.1% |
| | **L2** | Ranger | **80.0%** | 1.3% | **18.8%** | 0% | — | **18.8%** | 2.2 | 80.8% |
| | **L2** | Cleric | **66.3%** | 10.0% | **23.8%** | 0% | — | **23.8%** | 3.1 | 78.0% |
| | **L3** | Fighter | **90.0%** | 2.5% | **7.5%** | 0% | — | 7.5% | 3.7 | 76.9% |
| | **L3** | Ranger | **86.3%** | 2.5% | **11.3%** | 0% | — | 11.3% | 2.3 | 83.4% |
| | **L3** | Cleric | **76.3%** | 7.5% | **16.3%** | 0% | — | 16.3% | 3.0 | 82.7% |
| | **L4** | Allar stéttir | **86.3–92.5%** | 1.3–5.0% | **3.8–8.8%** | 0% | — | 3.8–8.8% | 1.8–3.5 | 81–89% |
| **`UNDEAD_BARROW_ROAD`** `[26, 21]` | **L1** | Fighter | **41.3%** | 27.5% | **31.3%** | 35.0% | 21.4% | 36.5% | 5.1 | 65.6% |
| | **L1** | Ranger | **50.0%** | 26.3% | **23.8%** | 13.8% | 9.1% | 26.1% | 4.1 | 77.5% |
| | **L1** | Cleric | **75.0%** | 16.3% | **8.8%** | 36.3% | 6.9% | 9.8% | 2.6 | 87.4% |
| | **L2** | Fighter | **71.3%** | 20.0% | **8.8%** | 37.5% | 6.7% | 10.0% | 6.7 | 71.4% |
| | **L2** | Ranger | **72.5%** | 18.8% | **8.8%** | 12.5% | 0.0% | 10.0% | 4.8 | 77.2% |
| | **L2** | Cleric | **93.8%** | 3.8% | **2.5%** | 31.3% | 4.0% | 1.8% | 3.1 | 86.0% |
| | **L3** | Fighter | **78.8%** | 17.5% | **3.8%** | 36.3% | 3.4% | 3.9% | 10.0 | 68.2% |
| | **L3** | Ranger | **62.5%** | 28.7% | **8.8%** | 10.0% | 12.5% | 8.3% | 6.2 | 80.6% |
| | **L3** | Cleric | **98.8%** | 0.0% | **1.3%** | 28.7% | 0.0% | 1.8% | 3.2 | 87.0% |
| | **L4** | Allar stéttir | **73.8–93.8%** | 3.8–23.8% | **0.0–2.5%** | 11–39% | 0.0% | 0.0–4.1% | 4.0–9.3 | 79–88% |
| **`HIGHLAND_FOOTHILL_ROAD`** `[32, 22]` | **L1** | Fighter | **73.8%** | 8.8% | **17.5%** | 45.0% | 25.0% | 11.4% | 3.8 | 72.0% |
| | **L1** | Ranger | **56.3%** | 12.5% | **31.3%** | 13.8% | 45.5% | 29.0% | 2.7 | 75.6% |
| | **L1** | Cleric | **37.5%** | 25.0% | **37.5%** | 33.8% | 51.9% | 30.2% | 2.7 | 78.9% |
| | **L2** | Fighter | **57.5%** | 5.0% | **37.5%** | 38.8% | 35.5% | 38.8% | 4.3 | 71.7% |
| | **L2** | Ranger | **56.3%** | 17.5% | **26.3%** | 6.3% | 0.0% | 28.0% | 3.0 | 77.3% |
| | **L2** | Cleric | **55.0%** | 16.3% | **28.7%** | 25.0% | 30.0% | 28.3% | 3.5 | 66.5% |
| | **L3** | Fighter | **87.5%** | 2.5% | **10.0%** | 32.5% | 11.5% | 9.3% | 4.5 | 72.4% |
| | **L3** | Ranger | **61.3%** | 17.5% | **21.3%** | 11.3% | 0.0% | 23.9% | 3.4 | 81.5% |
| | **L3** | Cleric | **70.0%** | 8.8% | **21.3%** | 38.8% | 16.1% | 24.5% | 4.0 | 76.2% |
| | **L4** | Allar stéttir | **80.0–91.3%** | 2.5–6.3% | **5.0–17.5%** | 12–38% | 0–20% | 8.0–17.9% | 2.8–4.0 | 76–85% |
| **`STORMPEAK_CITADEL_APPROACH`** `[37, 6]` | **L1–L3** | Allar stéttir | **15.0–27.5%** | 5.0–35.0% | **50.0–73.8%** | 10–49% | 54–80% | 42–74% | 2.4–5.3 | 60–88% |
| | **L4** | Fighter / Ranger / Cleric | **43.8 / 36.3 / 15.0%** | 16–38% | **33.8–47.5%** | 11–58% | 28–44% | 41–57% | 4.0–5.6 | 63–79% |

### 4.3 Greining á helstu dauðagildrum á Level 1–2

1. **Level 1 dánartíðni á `GOBLIN_FOREST_ROAD` (8.8%–15.0% per bardaga):**
   - Jafnvel í fullu fjöri (100% HP) deyr Level 1 hetja í **8.8% (Fighter), 10.0% (Cleric) og 15.0% (Ranger)** af stökum bardögum á aðalstígnum rétt norðan Oakhaven!
   - Ef Level 1 hetja reynir að ganga alla leið að Goblin Cave (4 bardagar) án þess að snúa við til að hvíla sig eru líkurnar á að lifa alla 4 bardagana af í einni lotu aðeins $\approx (0.90)^4 = 65.6\%$ (og enn lægri vegna HP-rýrnunar milli bardaga).
   - **Hvers vegna deyr Level 1 Ranger í 33.3% tilfella þegar hann lendir í Ambush á `GOBLIN_FOREST_ROAD`?** Í fyrirsát fær skrímslið ókeypis árás í upphafi, og `AMBUSH_FLEE_LOCKED` bannar flótta í lotu 1 og 2. Ef skrímslið er `Hobgoblin` (`1d8+1`, meðalskaði 5.5, hámark 9) eða `Wolf` (`1d6+1`), og `Aimed Shot` geigar á AC 16 (`45%` líkur á að geiga), þá er Ranger fastur í lotu 2 með `+0` árásarbónus og 11 HP.
2. **Öfug erfiðleikakúrfa á Level 2 í `GOBLIN_CAVE` og `GOBLIN_FOREST_ROAD`:**
   - Taktu eftir því að dánartíðni **hækkar á Level 2** í `GOBLIN_CAVE` (úr `5.0–12.5%` á Level 1 upp í **`17.5–23.8%` á Level 2**) og hjá Cleric á `GOBLIN_FOREST_ROAD` (úr `10.0%` í **`17.5%`**)!
   - Ástæðan er sú að á Level 2 opnast `solo_level <= 3` í `GOBLIN_CAVE` (`Hobgoblin Captain` CR 3 og `Bugbear` CR 2) og `solo_level <= 2` í `GOBLIN_FOREST` (`Worg` CR 2 og `Bugbear` CR 2). Þessi skrímsli stökkva úr `+2` árás / `1d4`–`1d8+1` skaða upp í **`+5` til `+7` árás og `1d8+3` til `1d8+4` skaða**, á meðan AC hetjunnar stendur í stað (AC 15–16) og vopnaskaði stendur í stað (`1d4`–`1d4+2`).
3. **Yfirburðir Cleric í Undead Lands (`Turn Undead`):**
   - Á `UNDEAD_BARROW_ROAD` rústar Cleric svæðinu (`75.0%` sigur á L1, `93.8%` á L2, `98.8%` á L3) vegna `CLERIC_TURN_UNDEAD` (`2d6 + level + WIS mod` heilagur skaði sem fer framhjá AC), á meðan Fighter og Ranger eiga í miklum erfiðleikum (`31.3%` og `23.8%` dauði á L1, og 6–10 lotna bardagar á L3 vegna `Wraith` með AC 18 og 35 HP).

### 4.4 Boss Readiness Matrix (60 bardagar per stétt/level/boss = 720 bardagar)

Hvenær eru hetjurnar raunverulega tilbúnar í svæðisbossana 4 (án flótta, barist til þrautar frá 100% HP)?

| Svæðisboss | Grunnvera & Tölfræði | Stétt | L1 Sigur % | L2 Sigur % | L3 Sigur % | L4 Sigur % | Ráðlagt lágmarks-level |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Warchief Grak** (`[15, 2]`) | `Hobgoblin` grunnur, **14 HP**, AC 16, `+2` (`1d8+1`) | **Fighter** | 70.0% | **88.3%** | **100.0%** | **100.0%** | **Level 2** (eða L2 með +1 vopni) |
| | | **Ranger** | 70.0% | **88.3%** | **95.0%** | **100.0%** | **Level 2** |
| | | **Cleric** | 58.3% | **75.0%** | **88.3%** | **98.3%** | **Level 2–3** |
| **2. Skulkrip the Cave Brood-King** (`Goblin Cave`) | `Bugbear` grunnur, **18 HP**, AC 17, `+5` (`1d8+3`) | **Fighter** | 28.3% | 40.0% | **88.3%** | **96.7%** | **Level 3** |
| | | **Ranger** | 48.3% | 48.3% | **83.3%** | **95.0%** | **Level 3** |
| | | **Cleric** | 10.0% | 26.7% | 53.3% | **81.7%** | **Level 3–4** |
| **3. Lord Malakor the Barrow-Wight King** (`Ancient Crypt`) | `Barrow Wight` grunnur, **20 HP**, AC 18, `+9` (`1d8+5`) | **Fighter** | 0.0% | 1.7% | 1.7% | 20.0% | **Level 5+** (eða fullt búnaðarsett) |
| | | **Ranger** | 0.0% | 1.7% | 0.0% | 13.3% | **Level 5+** |
| | | **Cleric** | 18.3% | 23.3% | 53.3% | **80.0%** | **Level 4** (vegna `Turn Undead`) |
| **4. Warlord Kraug the Crag-Breaker** (`[37, 3]`) | `Ogre` grunnur, **20 HP**, AC 17, `+7` (`2d8+7`) | **Fighter** | 6.7% | 8.3% | 33.3% | **60.0%** | **Level 4–5** |
| | | **Ranger** | 6.7% | 5.0% | 11.7% | 41.7% | **Level 5** |
| | | **Cleric** | 1.7% | 1.7% | 16.7% | 13.3% | **Level 5+** |

---

## 5. XP Framvindukúrfa (XP Progression Curve Level 1 -> 5)

Í [`src/domain/character/rules.js`](../../src/domain/character/rules.js) eru tvær XP-töflur:
- **`FAST_XP_THRESHOLDS` (Núverandi virk tafla í leiknum):** `0 / 1.300 / 3.300 / 6.000 / 10.000`
- **`MEDIUM_XP_THRESHOLDS` (Pathfinder 1e viðmið):** `0 / 2.000 / 5.000 / 9.000 / 15.000`

### 5.1 Samanburður á fjölda bardaga og ferða (Expeditions) milli stiga

Við reiknum hér bæði hreinan fjölda unninna bardaga miðað við meðal-XP á viðeigandi svæði, og **raunhæfan fjölda könnunarferða (expeditions)** frá Oakhaven (þar sem hver ferð út í skóginn og aftur í bæinn til að hvíla sig skilar að meðaltali **2.5–3.5 unnum bardögum** áður en HP og Divine Charges klárast):

| Þrep | `FAST` XP Þörf ($\Delta$ XP) | `MEDIUM` XP Þörf ($\Delta$ XP) | Viðmiðunarsvæði & Meðal-XP per sigur | Bardagar (`FAST`) | Bardagar (`MEDIUM`) | Könnunarferðir (`FAST`) | Könnunarferðir (`MEDIUM`) |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: | :---: |
| **Level 1 $\to$ Level 2** | **1.300 XP** (+1.300) | **2.000 XP** (+2.000) | `GOBLIN_FOREST` L1 (**169 XP** / sigur) | **7.7 sigrar** | 11.8 sigrar | **~2.5–3 ferðir** | ~4–5 ferðir |
| **Level 2 $\to$ Level 3** | **3.300 XP** (+2.000) | **5.000 XP** (+3.000) | `GOBLIN_FOREST` L2 (**277 XP**) / `GOBLIN_CAVE` (**387 XP**) | **5.2–7.2 sigrar** | 7.8–10.8 sigrar | **~2–2.5 ferðir** | ~3–4 ferðir |
| **Level 3 $\to$ Level 4** | **6.000 XP** (+2.700) | **9.000 XP** (+4.000) | `GOBLIN_FOREST` L3 (**313 XP**) / `UNDEAD_LANDS` (**729 XP**) | **3.7–8.6 sigrar** | 5.5–12.8 sigrar | **~2–3 ferðir** | ~3–4.5 ferðir |
| **Level 4 $\to$ Level 5** | **10.000 XP** (+4.000) | **15.000 XP** (+6.000) | `UNDEAD_LANDS` / `HIGHLANDS` (**596–702 XP**) | **5.7–6.7 sigrar** | 8.5–10.1 sigrar | **~2–2.5 ferðir** | ~3–4 ferðir |
| **Samtals L1 $\to$ L5** | **10.000 XP** | **15.000 XP** | Blandað framvinduferli | **~22–30 sigrar** | **~34–45 sigrar** | **~8–11 ferðir** | **~13–17 ferðir** |

### 5.2 Mat á XP-hraða

- **`FAST_XP_THRESHOLDS` (`1.300 / 3.300 / 6.000 / 10.000`) hentar vel fyrir permadeath roguelite hrynjandi**, þar sem ~8 unnir bardagar (2–3 stuttar ferðir út úr Oakhaven) koma hetju á Level 2, og ~22–30 sigrar alls koma henni á Level 5.
- **Misvægi á Level 3 $\to$ Level 4:** Ef hetja heldur sig í Blackwood (`313 XP` að meðaltali) tekur Level 3 $\to$ 4 um **8.6 bardaga**, en ef hún fer í Undead Lands (`729 XP` að meðaltali vegna ofgnóttar af CR 3 `Shadow` og CR 5 `Wraith`) tekur þrepið aðeins **3.7 bardaga** (fyrir Cleric sem getur drepið þau með `Turn Undead`).

---

## 6. Hlutverk Quests, Bounties og Economy á Level 1–4

### 6.1 Town Quests í Oakhaven (`character-town-controller.js`)

Í Oakhaven getur leikmaður tekið við 4 söguverkefnum (Town Quests):
1. **`QUEST_GOBLIN_CHIEFTAIN`** (*Slay the Goblin Chieftain* á `[15, 2]`): Verðlaun **100 gp**, **0 XP**.
2. **`QUEST_GOBLIN_CAVE_BROOD_KING`** (*Purge the Goblin Cave* í `[9, 12]`): Verðlaun **140 gp**, **0 XP** (auk +120 XP inni í dýflissunni þegar Skulkrip fellur).
3. **`QUEST_CRYPT_BARROW_KING`** (*Cleanse the Ancient Crypt* í `[26, 5]`): Verðlaun **180 gp**, **0 XP** (auk +160 XP þegar Malakor fellur).
4. **`QUEST_HIGHLAND_WARLORD`** (*Slay the Highland Warlord* á `[37, 3]`): Verðlaun **220 gp**, **0 XP**.

> [!IMPORTANT]
> **Town Quests gefa 0 XP við skil í Oakhaven (`claimTownQuest`):**  
> Í [`character-town-controller.js`](../../action-ui-lab/src/controllers/character-town-controller.js) hækkar `claimTownQuest` eingöngu `gold` (`gold = gold + rewardGold`), en veitir **ekkert Quest Completion XP**. Þetta þýðir að eina XP-ið sem leikmaður fær fyrir að drepa Warchief Grak á `[15, 2]` er grunn-XP Hobgoblinsins (**200 XP**)! Fyrir 31 skrefa leiðangur norður í skóg og 31 skref til baka er 200 XP fyrir sjálfan yfirmanninn afar rýrt.

### 6.2 Watcher's Board Bounties (`src/domain/bounties/board.js`) á 44×30 kortinu

Hermunin prófaði `getOrGenerateContracts(db, hero)` á lifandi `44 × 30` kortinu fyrir Level 1–4. Alls fundust **58 tengd landslagssvæði (`reachableRegions`)** út frá Oakhaven `[15, 27]`. Næstu svæðin við bæinn eru:
- `Blackwood Forest Trail` (`PLAINS/FOREST`, `minDist: 1`, `maxDist: 24`, 13 reitir)
- `Oakhaven Outer Eaves` (`PLAINS`, `minDist: 1`, `maxDist: 6`, 16 reitir)
- `King's Road South` (`FOREST/PLAINS`, `minDist: 2`, `maxDist: 9`, 12 reitir)
- `Eastbank River Trail` (`FOREST/PLAINS`, `minDist: 3`, `maxDist: 11`, 9 reitir)

Greiningin leiddi í ljós **þrjá mikilvæga hönnunargalla í Watcher's Board á `44 × 30` kortinu**:

1. **Þemavilla í skrímslavali (`getEligibleMonstersForRegion`):**
   - `board.js` velur skrímsli eingöngu með því að athuga hvort `monster.terrain` innihaldi `PLAINS` eða `FOREST`. Það þekkir ekki svæðisskiptingu Action UI Lab (`GOBLIN_FOREST` vs. `UNDEAD_LANDS`).
   - Fyrir vikið býr Watcher's Board á Level 1 til samninga á `Blackwood Forest Trail` og `King's Road South` gegn **`Human Skeleton`**, **`Plague Zombie`** og **`Kobold`**!
2. **CR 3 skrímsli birtast sem Level 2 Bounties rétt utan við Oakhaven:**
   - Á Level 1 takmarkar `board.js` CR við `0.5` og `minDist <= 3`.
   - En um leið og hetjan nær **Level 2** (`isLevel1 = false`), þá notar `board.js` `maxSoloLevel = characterLevel + 1 = 3` og `minTileCrCap = getMaxCrForDistance(region.maxDist)`. Þar sem `Blackwood Forest Trail` teygir sig upp í `maxDist = 24` (`CR <= 3.0`) og `King's Road South` upp í `maxDist = 9`, þá býr taflan til Level 2 samninga gegn **CR 3 `Draugr`**, **CR 3 `Giant Mantis`**, **CR 3 `Rust Monster`**, **CR 3 `Hobgoblin Captain`** og **CR 3 `Spriggan`**!
3. **Bounties gefa aðeins gull (`44–155 gp`) en engan XP-bónus við uppgjör:**
   - Þegar leikmaður drepur bounty-skrímsli fær hann venjulegt bardaga-XP og gullverðlaunin (`reward_gold`), en enga aukalega XP-umbun fyrir að klára samninginn.

### 6.3 Gullhagkerfi og verslun í Oakhaven á Level 1–2

Í Oakhaven kosta helstu uppfærslur:
- **`HEALING_POTION`:** `20 gp` (`+8 HP` í bæjarviðmóti / bardaga)
- **`IRON_LONGSWORD`:** `45 gp` (`+1 Attack Bonus`, `+1 Damage`)
- **`CHAINMAIL_COAT`:** `60 gp` (`+1 AC`)

Á Level 1 gefur venjulegt skrímsli **engin bein gullverðlaun** nema það sé persistent monster sem hefur áður rænt fallna hetju (`held_gold`) eða sé tengt Watcher's Board samningi (`44–50 gp`) / Town Quest (`100 gp`). Þetta gerir **Level 1 Watcher's Board samningana (`44–50 gp` í 1–3 skrefa fjarlægð frá Oakhaven)** að langmikilvægustu tekjulind nýrrar hetju: **einn kláraður Level 1 samningur dugar nákvæmlega fyrir `IRON_LONGSWORD` (`45 gp`)**, og tveir samningar duga fyrir bæði sverði og brynju (`105 gp`)!

---

## 7. Samantekt á Gagnadrifnum Tillögum (Concrete Recommendations)

Hér eru hnitmiðaðar, forgangsraðaðar tillögur byggðar á niðurstöðum hermunarinnar (allar innan ramma Phase 10, án þess að endurvekja Level 1 Ambush Protection og án þess að setja hámarks-level):

| Forgangur | Viðfangsefni | Vandamál í núverandi kóða | Gagnadrifin lausnartillaga |
| :---: | :--- | :--- | :--- |
| **P1** | **`OAKHAVEN_OUTSKIRTS` sem raunverulegt byrjendasvæði (`y = 24..25`)** | `resolveTileDangerZone` varpar `[15, 25]` (2 skref frá bæ) beint í `GOBLIN_FOREST_ROAD` (`18%` raw encounter, CR 0.5–1.0 skrímsli). | Bæta `OAKHAVEN_OUTSKIRTS` við `DANGER_ZONE_PROFILES` (`threatTier: 1, encounterChance: 0.12, ambushChance: 0.15`) fyrir reiti í Chebyshev-fjarlægð `2–4` frá `[15, 27]`, og virkja `getMaxCrForDistance(dist)` í `selectGoblinForestMonster` þannig að fjarlægð `2–3` skili eingöngu CR `0.25–0.33` (`Goblin`, `Dire Rat`, `Mite`). |
| **P1** | **Fjarlægðar- og `solo_level` síun í `Undead Lands` og `Ravencrag Highlands`** | Á Level 1 velur `selectUndeadLandsMonster` CR 3 `Shadow` í **41.9%** tilfella (því `Human Skeleton`/`Zombie` vantar `SWAMP` terrain), og `selectRavencragHighlandsMonster` velur CR 4 `Harpy` í **15.8%** tilfella. | 1) Virða `monster.solo_level <= heroLevel + 1` (og `CR <= getMaxCrForDistance(dist)`) í fyrsta valþrepi allra svæðisfalla. 2) Bæta `SWAMP` við `terrain` á `Human Skeleton` og `Human Zombie` (eða leyfa svæðisbundna undanþágu í `selectUndeadLandsMonster`) svo Level 1–2 Undead Lands innihaldi CR 0.33–0.5 beinagrindur og uppvakninga í stað CR 3 `Shadow`. |
| **P1** | **Level 2 stökkið í `GOBLIN_CAVE` (`Hobgoblin Captain` CR 3)** | Dánartíðni í `GOBLIN_CAVE` þrefaldast á Level 2 (`17.5%–23.8%` dauði per bardaga) vegna þess að `solo_level <= heroLevel + 1` hleypir CR 3 `Hobgoblin Captain` (24 HP, AC 18, `+7 1d8+4`) inn í gangabardaga á Level 2. | Í `dungeon-service.js` (`GOBLIN_CAVE`), takmarka venjuleg gangaskrímsli við `CR <= Math.min(2, heroLevel)` (þannig að `Bugbear` CR 2 opnist á Level 2, en `Hobgoblin Captain` CR 3 opnist fyrst á Level 3), svo gangaskrímsli í Goblin Cave verði ekki sterkari en sjálfur dýflissubossinn `Skulkrip` (18 HP, AC 17, `+5 1d8+3`). |
| **P2** | **Lagfæra `ROUTE_C_EASTERN_RIVER` landamæri (`x = 21..22`)** | Austurstígurinn í Blackwood vestan árinnar (`x = 21..22, y = 15..22`) lendir í `UNDEAD_BARROW_ROAD` í 9 skrefum. | Færa vesturmörk `isTileCoordInUndeadLands` austur fyrir ána (`x >= 23` á `y = 14..23`), þannig að brúin á `[23, 21]` verði raunverulegt landamærahlið milli Blackwood Forest og Undead Lands. |
| **P2** | **Laga Watcher's Board (`board.js`) fyrir Level 1–2 og svæðisþemu** | Á Level 2 býr Watcher's Board til CR 3 samninga (`Draugr`, `Giant Mantis`, `Rust Monster`) á `King's Road South`, og setur `Human Skeleton` í Blackwood á Level 1. | 1) Nota `minDist` (eða meðalfjarlægð reita svæðisins) í stað `maxDist` þegar `minTileCrCap` er reiknað í `getOrGenerateContracts`. 2) Takmarka `challenge_rating <= characterLevel` fyrir Level 1–2 samninga. 3) Sía samningsskrímsli í Blackwood frá `UNDEAD` tegundum. |
| **P2** | **Bæta XP-verðlaunum við Town Quests og Bounties** | Town Quests gefa `0 XP` við skil í Oakhaven (`claimTownQuest`), svo 62 skrefa ferð fram og til baka á `[15, 2]` gefur aðeins 200 XP fyrir Grak. | Veita XP-verðlaun við skil á Town Quests: t.d. **+300 XP** fyrir `QUEST_GOBLIN_CHIEFTAIN`, **+450 XP** fyrir `QUEST_GOBLIN_CAVE_BROOD_KING`, **+650 XP** fyrir `QUEST_CRYPT_BARROW_KING`, og **+900 XP** fyrir `QUEST_HIGHLAND_WARLORD`, ásamt **+75 til +150 XP** bónus fyrir kláraða Watcher's Board samninga. |
| **P3** | **Ranger Finesse / Melee Scaling eftir lotu 1** | Level 1 Ranger er með `+0` árásarbónus og `1d4+0` skaða í lotu 2+ vegna `STR 10`, sem veldur **15.0% dauða** á `GOBLIN_FOREST_ROAD` (og **33.3% dauða í Ambush**). | Leyfa Ranger að nota `Math.max(strMod, Math.floor(dexMod * 0.67))` (eða `DEX` fyrir árásarkast með léttu vopni) í venjulegri `FIGHT` aðgerð, svo hann sé ekki með `+0` árásarbónus eftir að `Aimed Shot` hefur verið notað í 1. lotu. |
