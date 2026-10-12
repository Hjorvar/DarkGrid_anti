# Darkgrid — Bardagakerfi og varanleg skrímsli (Combat System & Persistent Monsters)

> **Skjal:** `docs/combat-system-plan.md`  
> **Áfangi:** Phase 2 (Bardagakerfi) & Phase 3 (Varanleg skrímsli & Permadeath)  
> **Staða:** **Samþykkt af leikhönnuði (Approved) — Innleiðing hefst í Session 4**  
> **Tungumálaregla:** Hönnun og rökstuðningur á íslensku; allur texti sem spilarinn sér í leiknum er á **ensku**.

---

## 1. Yfirlit og markmið

Markmið þessa skjals er að leggja traustan grunn að tveimur lykilkerfum í **Darkgrid**:

1. **Turn-based bardagakerfi:** Einfalt, spennuþrungið d20-bardagakerfi innblásið af Pathfinder 1e, þar sem spilarinn hefur nákvæmlega þrjár aðgerðir (*Attack*, *Drink Potion*, *Flee*). Allar tölulegar upplýsingar um óvininn (HP, AC, Attack Bonus, skaði, teningaköst) eru faldar og lýst með ríkum enskum texta.
2. **Persistent Monsters (Varanleg skrímsli):** Sérstakt auðkenniskerfi Darkgrid þar sem skrímsli sem drepa spilara festast varanlega á þeim reit í sameiginlegum heimi allra spilara. Skrímslið fær +10% maximum HP (aðeins einu sinni), varðveitir hluta af eignum hins fallna (50% gull, 50% hluta, hámark 20 hluti) og bíður þess að önnur hetja hefni fallsins og hreinsi reitinn.

---

## 2. Samþykktar leikreglur (Decided Game Rules)

Eftirfarandi reglur eru formlega staðfestar sem grundvöllur útfærslunnar:

### A. Spilarinn og aðgerðir í bardaga
- Spilarinn hefur **nákvæmlega þrjár löglegar aðgerðir** í bardaga:
  1. **Attack:** Ein árás með búnu vopni. Kastað er `d20 + attack_bonus >= monster_ac`.
  2. **Drink Potion:** Drekka lækningadrykk úr bakpoka. Eyðir 1 potion, læknar `1d8+1` HP (hámarkað við `max_hp`), notar umferð spilarans. Skrímslið fær sína venjulegu árás. Ekki hægt ef spilari á 0 drykki.
  3. **Flee (Flótti):** Sérstök aðgerð sem **yfirtekur venjulegt umferðarflæði**. Skrímslið fær nákvæmlega eina fría árás (Attack of Opportunity). Ef spilarinn lifir af tekst flóttinn, bardaga lýkur samstundis og spilarinn helst á núverandi reit með afléttan ferðalás. Ef árásin fellir spilarann gilda permadeath-reglur. Skrímsli fær **aldrei** tvær árásir við flótta.
- **Engar aðrar aðgerðir** eru leyfðar í v1 (engin Defend, engir galdrar, engin búnaðarskipti í bardaga).

### B. Upphafsbúnaður og drykkir (Starter Gear & Potions)
- Nýjar hetjur fá raunveruleg vopn og brynjur í `item_instances` við stofnun, miðað við class:
  - **Fighter:** Longsword (vopn, `1d8` skaði, buy_price 15, `equip_slot: 'MAIN_HAND'`) og Chain Shirt (brynja, armor bonus +4, buy_price 100, `equip_slot: 'CHEST'`).
  - **Ranger:** Shortbow (vopn, `1d6` skaði, buy_price 30, `equip_slot: 'MAIN_HAND'`) og Leather Armor (brynja, armor bonus +2, buy_price 10, `equip_slot: 'CHEST'`).
  - **Cleric:** Heavy Mace (vopn, `1d8` skaði, buy_price 12, `equip_slot: 'MAIN_HAND'`) og Scale Mail (brynja, armor bonus +5, buy_price 50, `equip_slot: 'CHEST'`).
- **Healing Potions:** Ný hetja byrjar með **2 Minor Healing Potions** í bakpoka (læknar `1d8+1` HP).

### C. Teningaköst og bardagareglur
- **Attack Roll:** `d20 + attack_bonus >= armor_class`.
- **Natural 20:** Critical Hit. Árás hittir sjálfkrafa og veldur tvöföldum venjulegum skaða (`damage * 2`).
- **Natural 1:** Automatic Miss. Árás brennur sjálfkrafa af óháð bónusum.
- **Initiative (Frumkvæði):** Kastað er `1d20 + initiative_bonus` við upphaf bardaga til að ákveða hvor hefur frumkvæði í umferðum. Jafntefli fellur hetjunni í hag.
- **Formúla fyrir Attack Bonus hetju:**  
  `hero_attack_bonus = floor((STR_modifier + DEX_modifier) / 2)` (með vopnabónus ef við á).
- **Armor Class hetju:**  
  `hero_ac = 10 + DEX_modifier + equipped_armor_bonus + equipped_shield_bonus`.

### D. Faldar tölur og upplýsingaleynd
- **Spilarinn sér:**
  - Sitt eigið HP (t.d. `24 / 35`).
  - Fjölda healing potions sem hann á.
  - Enskar textalýsingar bardagans (framgang umferða).
  - Aðgerðahnappana þrjá (*Attack*, *Drink Potion*, *Flee*).
- **Spilarinn sér ALDREI:**
  - HP skrímslisins (hvorki núverandi né hámark).
  - Armor Class skrímslisins.
  - Attack bonus skrímslisins.
  - Teningaköst eða teningastærðir.
  - Nákvæmar skaðatölur (hvorki skaða sem hann veldur né verður fyrir).
  - Challenge Rating eða faldar kerfistölur.

### E. Níu ástandslýsingar skrímsla (Health Condition Descriptions)
- Öll 38 skrímsli í gagnagrunninum hafa níu enskar lýsingar í `monsters.descriptions`:
  - `1_distant` / `2_ranger_distant` (Stage 1 leynd)
  - `3_close` / `4_ranger_close` (Stage 2 afhjúpun)
  - `5_health_100` (76%–100% HP)
  - `6_health_75` (51%–75% HP)
  - `7_health_50` (26%–50% HP)
  - `8_health_25` (1%–25% HP)
  - `9_dead` (0 HP)
- **Krafa um birtingu:** Ástandslýsingin birtist **aðeins þegar heilsufarsflokkur skrímslisins lækkar** (t.d. fer úr 100 niður í 75). Sömu lýsingu má **aldrei endurtaka í hverri umferð**.

### F. Permadeath (Varanlegur dauði)
- Þegar HP hetju fer í `0` deyr hún endanlega.
- Engin endurlífgun, respawn eða endurkoma.
- Hetjan er merkt `is_alive = 0`, `died_at = CURRENT_TIMESTAMP`.
- Allar frekari leikaðgerðir eru læstar á server-stigi.
- Notandi getur skoðað minningarskjá um fallna hetju og hafið leik með nýrri hetju.

### G. Persistent Monsters (Varanleg skrímsli)
- **Aðeins skrímsli sem drepa hetju verða varanleg.** Venjuleg skrímsli festast aldrei á kortinu.
- Skrímslið festist á nákvæmlega þeim reit (`tile_id`) þar sem hetjan féll.
- Skrímslið fær **+10% maximum HP** (reiknað sem `Math.ceil(base_hp * 1.10)`).
- **HP boost er aðeins veitt einu sinni.** Ef skrímslið drepur fleiri hetjur síðar fær það ekkert frekara HP boost.
- Skrímslið fær 50% af gulli hetjunnar og 50% af **öllum búnaði hennar** (equipped og inventory, allt að 20 hluti samtals). Afgangur eyðileggst.
- Skrímslið er skráð í miðlæga töflu `monster_instances` með stöðuna `'ACTIVE'`.
- **Tveggja þrepa encounter:** Þegar spilari kemur á reit með persistent monster fær hann Stage 1 viðvörun. Hann getur valið **Investigate** (hefja bardaga) eða **Ignore** (sleppa ógn). Ef hann hunsar skrímslið helst það á reitnum.
- **Forgangur:** Persistent monster hefur alltaf forgang fram yfir random encounters á sínum reit.
- **Skrímslið byrjar hvern nýjan bardaga með fullt HP miðað við sitt styrkta hámarks-HP.**
- Ef spilarinn flýr helst skrímslið á reitnum.
- Ef skrímslið er drepið: Sigurvegarinn fær XP, gull og varðveitt loot. Skrímslið er merkt `'DEFEATED'` og reiturinn losnar aftur í venjulegt ástand.

---

## 3. Bardagaflæði (Combat Flow)

Bardagi er lokuð ástandslykkja (state machine) sem keyrir á vefþjóninum:

```
[ Hetja á reit með ógn (Random eða Persistent) ]
                      │
                      ▼
               Stage 1: DISCOVERED
   (Óþekkt ógn, leyndarlýsing 1_distant eða 2_ranger_distant)
                      │
         ┌────────────┴────────────────────────┐
         ▼                                     ▼
    [ Ignore ]                          [ Investigate ]
    (Sleppa ógn)                               │
    • Persistent monster helst á reit          ▼
                                        Stage 2: IN_COMBAT
                               (Skrímsli afhjúpað: nafn, mynd, tákn)
                               Initiative kastað: d20 + init_bonus
                               Heilsulýsing 5_health_100 birt
                                               │
                                               ▼
                               ┌───────────────────────────────┐
                               │    BARDAGALYKKJA (ROUNDS)     │
                               └───────────────┬───────────────┘
                                               │
                     ┌─────────────────────────┼─────────────────────────┐
                     ▼                         ▼                         ▼
               [ ⚔️ Attack ]             [ 🧪 Drink Potion ]        [ 🏃 Flee ]
                     │                         │                         │
                     │                         │                         ▼
                     │                         │               Skrímsli fær fría árás!
                     │                         │               (Yfirtekur venjulegt flæði)
                     │                         │                         │
                     │                         │               ┌─────────┴─────────┐
                     │                         │               ▼                   ▼
                     │                         │          Hetja lifir         Hetja deyr
                     │                         │               │                   │
                     │                         │               ▼                   ▼
                     │                         │         [ ESCAPED ]         [ PERMADEATH ]
                     │                         │         (Flótti tekst)      (Persistent M.)
                     │                         │         (Helst á reit)
                     ▼                         ▼
              Umferðaruppgjör:
              - Ef Hetja hefur initiative: Hetja framkvæmir -> Skrímsli athugað -> Skrímsli framkvæmir -> Hetja athuguð
              - Ef Skrímsli hefur initiative: Skrímsli framkvæmir -> Hetja athuguð -> Hetja framkvæmir -> Skrímsli athugað
              - Textabirting og heilsuskipting uppfærð
                     │
                     ├── Skrímsli HP <= 0  ──►  [ VICTORY ] (Loot, XP, reitur hreinsaður)
                     ├── Hetja HP <= 0     ──►  [ PERMADEATH ] (Hetja deyr, Persistent Monster skapast)
                     └── Báðir á lífi      ──►  Næsta umferð (Bíður næstu aðgerðar leikmanns)
```

### Nákvæm útfærsla á umferðum, frumkvæði og flótta

1. **Frumkvæðiskast við upphaf bardaga:**
   - Þegar encounter fer í `IN_COMBAT` kastar serverinn:
     - `hero_init = roll_d20() + hero_dex_mod`
     - `monster_init = roll_d20() + monster_initiative_bonus`
   - Ef `hero_init >= monster_init`: Hetjan hefur frumkvæði (`initiative_winner = 'HERO'`).
   - Ef `monster_init > hero_init`: Skrímslið hefur frumkvæði (`initiative_winner = 'MONSTER'`).
   - Jafntefli er leyst spilaranum í hag.
   - Frumkvæði er vistað í `encounters` töflunni og gildir út bardagann.

2. **Röð aðgerða í umferð þegar Hetja á frumkvæði:**
   - **Skref 1 (Hetja):** Framkvæmir valda aðgerð (Attack eða Drink Potion).
   - **Skref 2 (Athugun):** Ef skrímslið deyr (HP <= 0), lýkur bardaganum samstundis með **VICTORY**. Skrímslið fær **ekki** að gera árás.
   - **Skref 3 (Skrímsli):** Ef skrímslið lifir gerir það sína venjulegu árás á hetjuna.
   - **Skref 4 (Athugun):** Ef hetjan deyr (HP <= 0), lýkur bardaganum með **DEFEAT / PERMADEATH**.
   - **Skref 5 (Ástand):** Umferðarteljari hækkar um 1 (`combat_round = combat_round + 1`).

3. **Röð aðgerða í umferð þegar Skrímsli á frumkvæði:**
   - **Skref 1 (Skrímsli):** Skrímslið gerir árás á hetjuna á undan.
   - **Skref 2 (Athugun):** Ef hetjan deyr af árásinni (HP <= 0), lýkur bardaganum með **DEFEAT / PERMADEATH**. Fyrirhuguð aðgerð hetjunnar fellur niður.
   - **Skref 3 (Hetja):** Ef hetjan lifir af framkvæmir hún sína aðgerð (Attack eða Drink Potion).
   - **Skref 4 (Athugun):** Ef skrímslið deyr (HP <= 0), lýkur bardaganum með **VICTORY**.
   - **Skref 5 (Ástand):** Umferðarteljari hækkar um 1.

4. **Flótti (Flee):**
   - Spilari velur Flee.
   - Flóttinn **yfirtekur venjulega umferð**.
   - Skrímslið fær nákvæmlega **eina fría árás** (Attack of Opportunity), óháð því hvort aðilinn hafði frumkvæði.
   - Skrímslið fær **aldrei tvær árásir** (hvorki venjulega árás plús fría árás).
   - Ef hetjan lifir af: status verður `'ESCAPED'`. Bardaga er lokið. Ferðalás afléttist. Hetjan helst á núverandi reit.
   - Ef hetjan deyr: Permadeath reglan tekur gildi og skrímslið verður persistent monster.

---

## 4. Textalýsingar og frásagnir (Combat Narrative Engine)

Í stað þess að sýna tölur notar leikurinn fjölbreytt safn enskra textalýsinga. Hver atburður í bardaga skráir færslu í `combat_events` töfluna.

### A. Vopna- og skepnusértæk nákvæmni (Weapon- & Monster-Aware Narrative)
Textalýsingar taka tillit til búnaðar og líffærafræði:
- Ef spilarinn notar boga (`Shortbow`), er lýst örvaskotum (*"Your arrow flies true..."*, *"Your shot whistles through the air, missing..."*).
- Ef spilarinn notar kylfu (`Heavy Mace`), er lýst þungum kramningshöggum (*"Your mace smashes into..."*).
- Ef spilarinn notar sverð (`Longsword`), er lýst egg- og stunguhöggum (*"Your blade slashes across..."*).
- Árásir skrímslis taka mið af lífverugerð: tennur og klær fyrir dýr/úlf; greinar/þyrnar fyrir Assassin Vine; vopn/trédrumbur fyrir Ogre/Troll; eiturtungur fyrir Giant Frog.

### B. Lýsingar á heilsuástandi skrímslis (The 9 Monster Conditions)

Heilsufarslýsingar koma úr `monsters.descriptions` JSON-dálknum:

| HP Hlutfall | Lykill í JSON | Hvenær birtist textinn? |
|---|---|---|
| **76% – 100%** | `5_health_100` | Við upphaf bardaga (`IN_COMBAT`). |
| **51% – 75%** | `6_health_75` | Í fyrsta sinn sem HP skrímslis fellur á þetta bil. |
| **26% – 50%** | `7_health_50` | Í fyrsta sinn sem HP skrímslis fellur á þetta bil. |
| **1% – 25%** | `8_health_25` | Í fyrsta sinn sem HP skrímslis fellur á þetta bil. |
| **0% (Dautt)** | `9_dead` | Þegar skrímslið er fellt í bardaga. |

**Regla gegn endurtekningu:**  
Gagnagrunnurinn geymir `last_health_bracket` (100, 75, 50, 25, 0). Ný lýsing bætist **aðeins** við bardagalogginn þegar `new_bracket < last_health_bracket`.

---

## 5. Varanleg skrímsli (Persistent Monsters) — Sérreglur

### A. Skilyrði fyrir varanleika
- **Aðeins skrímsli sem drepa spilara verða persistent monsters.**
- Skrímsli sem spilari flýr frá eða hunsar festast **ekki** á reitnum.
- Skrímslið festist á nákvæmlega þeim `map_tiles.id` þar sem bardaginn fór fram.

### B. Styrking skrímslis (Stat Boosts)
- **Maximum HP:** Fær **+10% viðbót** við `monsters.base_hp`:
  $$\text{max\_hp} = \lceil \text{base\_hp} \times 1.10 \rceil$$
- **HP boost er aðeins veitt einu sinni.** Ef skrímslið drepur 5 spilara er HP þess enn 110% af grunngildi, ekki 150%.
- **Enginn viðbótar attack bonus** (+0).
- **Engin hækkun á Armor Class** (+0).
- **Engin hækkun á damage dice** (+0).

### C. Heilsufar milli bardaga
- Í fyrstu útgáfu (v1) byrjar persistent monster **hvern nýjan bardaga með fullt HP** miðað við sitt styrkta hámark.

### D. Árekstrar á reit og Ignore-valkostur
- Schema reglan `UNIQUE INDEX one_active_persistent_monster_per_tile ON monster_instances(tile_id) WHERE status = 'ACTIVE'` tryggir að aðeins eitt persistent monster getur verið virkt á reit.
- Ef spilari kemur á reit með persistent monster fær hann viðvörun í Stage 1 (Discovered).
- Hann getur valið **Investigate** eða **Ignore**. Ef hann hunsar skrímslið helst það óhreyft á reitnum.
- Ef spilari berst við persistent monster og deyr:
  - Færslan í `monster_instances` helst óbreytt en `kill_count` hækkar um 1 (`kill_count = kill_count + 1`).
  - Skrímslið tekur við nýju loot samkvæmt loot-reglum (allt að 20 hluti hámark).
  - Ekkert frekara HP boost er veitt.

---

## 6. Eignir og Loot við dauða (Loot Retention Rules)

### A. Skipting við dauða spilara
1. **Gull:**
   - **50% gulls** flyst yfir á skrímslið: `held_gold = held_gold + floor(player_gold * 0.5)`.
   - Afgangurinn (50%) hverfur endanlega úr leikheiminum.
2. **Allur búnaður (All Equipment & Items):**
   - 50% varðveislulíkurnar eiga við um **allan búnað hetjunnar**:
     - Vopn sem spilarinn notar (equipped weapons).
     - Brynjur og skjöldu (equipped armor).
     - Hluti í bakpoka (inventory).
     - Healing Potions.
   - Hvert einstakt item fer í sjálfstætt 50% líkindapróf (`rng() < 0.50`).
   - Tryggt er að ekkert item sé tvítalið.
   - Hlutir sem falla á prófinu **eyðileggjast samstundis**.

### B. 20-hluta hámarkið (The 20-Item Overflow Rule)
- Eitt persistent monster getur haft að hámarki **20 varðveitta hluti** í fjársjóði sínum.
- **Forgangsröðun við flutning:**
  1. Telja núverandi hluti skrímslis: `current_count`.
  2. Laus pláss: `available_slots = Math.max(0, 20 - current_count)`.
  3. Ef hlutir sem lifðu af 50% prófið eru fleiri en `available_slots`, er þeim raðað eftir forgangi:
     - **1. forgangur:** Töfragripir (`is_magical = 1`).
     - **2. forgangur:** Hærra verðgildi (`buy_price` lækkandi röð).
     - **3. forgangur:** Lægra `id` (fyrirsjáanlegur jafnteflisbrjótur).
  4. Efstu `available_slots` hlutirnir færast yfir á skrímslið.
  5. Allir afgangshlutir eyðileggjast endanlega.

### C. Sigurvegari tekur allt
- Þegar hetja sigrar persistent monster fær hún:
  - Allt `held_gold` skrímslisins lagt inn á sinn reikning.
  - Alla hluti í `monster_loot` færða í sinn bakpoka.
  - Venjuleg XP verðlaun skrímslisins.
  - Skrímslið fær stöðuna `status = 'DEFEATED'`.

---

## 7. Öryggi gagnagrunns og aðgerða (Security & Idempotency)

Vegna permadeath er fyllsta öryggis krafist gegn tvísmellum, endurteknum beiðnum og kapphlaupi:

1. **Vörn gegn tvísmellum og endurteknum beiðnum (Idempotency):**
   - Form-færslur í bardaga innihalda `encounterId` og `currentRound`.
   - Ef server tekur á móti beiðni með úreltum `currentRound` eða ef bardaga er þegar lokið, er beiðninni hafnað án þess að kasta teningum eða draga frá HP.
2. **Endurhleðsla síðu (Page Refresh):**
   - GET `/game` framkvæmir **aldrei** bardagaaðgerðir eða teningaköst.
   - Sýnir aðeins núverandi stöðu úr gagnagrunni og síðustu atburði úr `combat_events`.
3. **Atómar færslur (Transactions):**
   - Dauði spilara, flutningur á loot, sigur og stofnun persistent monster fara **ávallt fram í einni SQLite transaction** (`withTransaction`).
4. **Varnir gegn samtíma-bardaga (Multiplayer Concurrency):**
   - Ef Spilari A og Spilari B eru á sama reit og Spilari A fellir skrímslið:
     - Færsla skrímslisins verður `DEFEATED`.
     - Þegar Spilari B sendir næstu aðgerð athugar serverinn stöðu skrímslisins; sér að það er fellt og tilkynnir að annar meistari hafi fellt óvættinn.
     - Spilari B fær ekkert loot og engin tvöföldun á sér stað.
5. **Aðgerðalæsing látinna persóna:**
   - Allar routes krefjast `is_alive === 1`. Látin persóna er umsvifalaust vísað á minningarskjá (`/game/fallen`).

---

## 8. Framkvæmdaáætlun (Implementation Steps)

1. **Áfangi 1 — Combat Foundation:**
   - Teningavél (`src/domain/combat/dice.js`).
   - Bardagaformúlur (`src/domain/combat/rules.js`).
   - Migrasjón 005 (`db/migrations/005_combat_and_potions.sql`).
   - Upphafsbúnaður og potions í `src/domain/character/rules.js`.
2. **Áfangi 2 — Combat Engine:**
   - Bardagalykkja (`src/domain/combat/engine.js`).
   - Frumkvæði og 3 aðgerðir (Attack, Drink Potion, Flee).
   - Ástandslýsingar og vopnasértækur textaloggur.
3. **Áfangi 3 — Permadeath & Persistent Monsters:**
   - Lífsferill dauða og persistent skrímsla (`src/domain/monsters/persistence.js`).
   - Atómur loot-flutningur og 20-item forgangsröðun.
   - Stage 1 Ignore-stuðningur fyrir persistent monsters.
4. **Áfangi 4 — UI & Testing:**
   - Vefviðmót í `src/views/game.ejs` og `src/routes/game.js`.
   - Prófunarsvíta í `tests/combat_system.test.js`.
   - Staðfesting á öllum 17+ prófunartilfellum.
