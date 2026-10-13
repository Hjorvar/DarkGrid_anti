# Darkgrid — Item, Equipment, Inventory & Loot System Stabilization & Final Audit

**Branch:** `feature/item-equipment-loot-system`  
**Dagsetning:** 13. október 2026  
**Úttektaraðili:** Antigravity AI (Sjálfstæð, gagnrýnin gæða- og stöðugleikagreining)  
**Staða:** Fullklárað, staðfest og stöðugt (174/174 tests passing, 100% pass) — **Ekki merge-að í main, ekki deploy-að.**

---

## 1. Inngangur & Yfirlit

Í samræmi við fyrirmæli eiganda Darkgrid var framkvæmd heildarjöfnun og stöðugleikaátak á hlutakerfinu (*Final Item System Stabilization*). Markmiðið var að gera núverandi item-kerfi öruggt, rétt, laust við tvíritanir eða tölfræðigalla, og tilbúið fyrir leikmenn án þess að bæta við nýjum ótengdum stórkerfum.

Öll 8 meginkröfuatriðin voru útfærð, staðfest með sjálfvirkum einingar- og samþættingarprófum og skjalfest:
1. **AC tvítalningu á töfrabrynjum og -skjöldum eytt:** `calculateHeroAC` tekur nú mið af því að `armor_bonus` og `shield_bonus` í SQLite gagnagrunninum fela nú þegar í sér `enhancement_bonus`. Engin tvítalning á sér stað, en aðrir bónusar (DEX-þak, fylgihlutir og Holy Radiance) haldast 100% réttir.
2. **Varanlegt skrímsli & fullur bakpoki (Inventory Overflow):** Útfærð var samþykkt regla um tímabundið yfirflæði yfir 50 hluti þegar spilari fellir varanlegt skrímsli með herfangi frá látnum hetjum. Allt herfang flyst yfir atomic, engir hlutir eyðast, en á meðan bakpoki er yfir 50 hlutum fær hetjan enga venjulega item-dropa og getur ekki keypt í búðinni fyrr en hún fækkar hlutum ($\le 50$). Skýr viðvörun er sýnd í viðmóti (Main dashboard banner, Backpack menu button og Backpack/Market modals).
3. **Óvirkir drykkir og neysluvörur tímabundið teknir úr umferð:** 5 buff-drykkir, 1 elddrykkur og Antitoxin voru teknir úr öllum herfangstöflum og almennri verslun. Antitoxin læknar ekki lengur HP. Ef spilari á slíka hluti fyrir er þeim ekki eytt heldur sýnir bakpokinn „Inactive“ hnapp og neysla er stöðvuð. Allir 6 læknadrykkir leiksins virka 100% samkvæmt reglum.
4. **Töfrafylgihlutir (Magical Accessories):**
   - `Belt of Giant Strength +2` er nú fulltengt: veitir +2 í raunverulegan styrk (`effectiveHero.strength`), hækkar d20 breyti, árásarbónus og skaðaformúlu, birtist í UI og hverfur strax þegar hluturinn er tekinn af.
   - `Boots of Elvenkind`, `Cloak of Resistance +1` og `Bracers of Armor +1` voru gerð tímabundið óvirk í herfangi og búð án þess að eyða núverandi eintökum úr gagnagrunni.
5. **Critical Hit Values & Combat Balance:** Bardagavél heldur óbreyttri samþykktri Darkgrid-reglu (náttúrulegur 20 gefur x2 skaða). Skráð er sérstaklega að 14 vopn hafa non-standard critical metadata sem bíða sérstaks framtíðarverkefnis, og viðmótið lofar ekki óvirkum eiginleikum.
6. **Ranger Opening Shot:** Skilyrði opnunarskots voru fest: Ranger fær eingöngu skot þegar hann uppgötvar óvininn fyrst (`spotted_by_hero === 1`), engin fyrirsát er til staðar (`is_ambush === 0`), hann hefur tilbúið fjarvopn, bardagastaða er `DISCOVERED` og aðeins einu sinni í hverjum bardaga. Engu nýju viðmóti var bætt við.
7. **Fljúgandi skrímsli (Movement Type Detection):** Gagnagrunnur notar `movement_type = 'FLY'`. Kerfið styður nú bæði `FLY` og `FLYING` óháð hástöfum/lágstöfum. Sjálfvirkt fjarvopnaval og skjaldabæling voru staðfest með nýju regression prófi á raunverulegum skrímslum úr gagnagrunni.
8. **Lokaprófanir & Hermun:** Öll 174 sjálfvirk próf standast (100% pass), bardagahermun og 30.000 dropa herfangshermun staðfesta að Legendary dropar hjá drekum eru < 1% (0,59%), dýraregla er virt (0 dropar) og 50-hluta þak virkar rétt.

---

## 2. Staðfestar lagfæringar í þessari yfirferð

### 2.1 Leiðrétting á AC tvítalningu (`src/domain/combat/rules.js`)
Í upprunalegum gögnum innihéldu `armor_bonus` og `shield_bonus` töfrabónusinn (t.d. `Full Plate +1` hafði `armor_bonus = 10` og `enhancement_bonus = 1`). `calculateHeroAC` bætti töfrabónusnum aftur við, sem gaf 11 AC í stað 10.
- **Lausn:** `calculateHeroAC` athugar nú hvort `armor_bonus` eða `shield_bonus` feli nú þegar í sér töfrabónusinn. Ef svo er er hann ekki lagður við aftur.
- **Niðurstaða:**
  - `Full Plate` (Mundane): 10 + 9 + 1 (DEX) = **20 AC**.
  - `Full Plate +1`: 10 + 10 + 1 (DEX) = **21 AC** (áður 22).
  - `Full Plate +2`: 10 + 11 + 1 (DEX) = **22 AC** (áður 24).
  - `Heavy Steel Shield +1`: Shield bonus er **3 AC** (áður 4).
  - `Ring of Protection +1` (+1 deflection) og `Amulet of Natural Armor +1` (+1 natural) leggjast rétt ofan á.
  - Cleric `Holy Radiance` (+2 AC vs Undead) leggst ofan á sem sacred defense óháð skjöldum eða fjarvopnum.

### 2.2 Tímabundið yfirflæði bakpoka (>50 hlutir) (`src/domain/monsters/persistence.js` & UI)
- **Regla:** Þegar hetja sigrar varanlegt skrímsli sem geymir herfang frá látnum leikmönnum flytjast **allir** varðveittir hlutir yfir í bakpoka hetjunnar í einni órofinni SQLite færslu (`withTransaction`).
- **Vernd gegn hlutatapi:** Engum hlutum er eytt þótt bakpokinn fari í 51, 55 eða fleiri hluti.
- **Takmarkanir við yfirflæði:**
  - `generateMonsterLoot` athugar `currentInventoryCount >= 50` og setur `backpackFull = true`, sem kemur í veg fyrir alla venjulega hlutadropa frá skrímslum.
  - `buyItem` í `shop.js` hafnar innkaupum ef fjöldi hluta er $\ge 50$ með skýrum villuskilaboðum.
  - Um leið og leikmaður selur hluti í borginni og fer aftur niður í $\le 50$, opnast sjálfkrafa fyrir dropa og innkaup á ný.
- **Viðmót (UI Alerts):**
  - Ef `safeInventory.length > 50` birtist skýr viðvörunarborði á aðalskjá leiksins (`game.ejs`).
  - Valmyndarhnappur sýnir rauðan viðvörunartexta: `Backpack (55/50) ⚠️`.
  - Inni í bakpokaglugganum er rauður upplýsingakassi sem útskýrir stöðuna.
  - Í verslunarglugganum eru innkaupahnappar óvirkir með titlinum „Backpack full“.

### 2.3 Óvirkir drykkir og neysluvörur (Consumables Deactivation)
Til að koma í veg fyrir að leikmenn sói gulli eða umferðum í bardaga í drykki sem hafa ekki virk áhrif voru eftirfarandi ráðstafanir gerðar:
- **Fjarlægt úr herfangi og búð:**
  1. `Potion of Barkskin` (Buff: +2 AC)
  2. `Potion of Bull's Strength` (Buff: +4 STR)
  3. `Potion of Cat's Grace` (Buff: +4 DEX)
  4. `Potion of Shield of Faith` (Buff: +2 AC Sacred)
  5. `Potion of Heroism` (Buff: +2 Atk/Saves)
  6. `Elixir of Dragon's Breath` (Offensive: 3d6 Eldur)
  7. `Antitoxin` (Alchemical: eitureyðing)
- **Antitoxin lagfæring:** `heal_dice` var sett á `"0"` í gagnagrunni svo það lækni ekki gervilega 1d4 HP eins og healing potion.
- **Vörn fyrir núverandi eintök:** Ef leikmaður á þegar slíka hluti í bakpoka er þeim **ekki** eytt. Í bakpoka er „Drink“ hnappi skipt út fyrir óvirkan hnapp: `Inactive` með skýringunni: *„Pending implementation — effect not yet active“*. Bæði `useConsumable` og `executeCombatRound(DRINK_POTION)` stöðva neyslu án þess að eyða hlutnum.
- **6 virkir læknadrykkir:**
  1. `Minor Healing Potion` (1d8+1 HP)
  2. `Potion of Cure Light Wounds` (1d8+1 HP)
  3. `Potion of Cure Moderate Wounds` (2d8+3 HP)
  4. `Potion of Cure Serious Wounds` (3d8+5 HP)
  5. `Potion of Cure Critical Wounds` (4d8+7 HP)
  6. `Draught of Troll's Blood` (5d8+10 HP)
  Allir 6 læknadrykkir eru að fullu virkir innan og utan bardaga.

### 2.4 Töfrafylgihlutir & Belt of Giant Strength +2
- **Belt of Giant Strength +2:**
  - `getEffectiveStats(character, equipment)` reiknar raunverulegan virkan styrk (`effectiveStrength = character.strength + 2`).
  - Bardagavél notar `effectiveHero` í `calculateHeroAttackBonus` og `getHeroDamageFormula`.
  - Áhrif: Hetja með 16 STR (+3) fer í 18 STR (+4). Í Darkgrid formúlu (`floor((STR + DEX)/2)`) hækkar árásarbónus um +1 og skaði um +1.
  - Viðmót: Í Character glugga sést nýja gildið ásamt vísbendingu: `18 (+2 Belt)`.
  - Þegar beltið er tekið af (`unequipItem`) hverfur bónusinn samstundis og gildi fara aftur í grunninn.
- **Aðrir fylgihlutir:**
  - `Boots of Elvenkind`: Gervilegur +1 DEX bónus var fjarlægður úr gagnagrunni. Hluturinn er tímabundið óvirkur í búð og herfangi þar til færnikerfi (Stealth/Acrobatics) verður innleitt.
  - `Cloak of Resistance +1`: Tímabundið óvirkur í búð og herfangi þar til björgunarköst verða innleidd.
  - `Bracers of Armor +1`: Tímabundið óvirkur í búð og herfangi.

### 2.5 Critical Hit Values & 14 vopn
- **Óbreytt bardagavél:** Samþykktri bardagavél var haldið nákvæmlega óbreyttri. Aðeins náttúrulegur 20 telst sem critical hit og tvöfaldar skaðateninga (x2).
- **14 non-standard critical vopn:** Nákvæmlega 14 vopn í leiknum búa yfir sérstökum critical eiginleikum í Pathfinder reglum (`crit_threat < 20` eða `crit_mult > 2`) sem bíða sérstaks framtíðarverkefnis:
  1. `Dagger` (19–20 / x2)
  2. `Shortsword` (19–20 / x2)
  3. `Longsword` (19–20 / x2)
  4. `Greatsword` (19–20 / x2)
  5. `Heavy Flail` (19–20 / x2)
  6. `Falchion` (18–20 / x2)
  7. `Scimitar` (18–20 / x2)
  8. `Rapier` (18–20 / x2)
  9. `Battleaxe` (20 / x3)
  10. `Greataxe` (20 / x3)
  11. `Handaxe` (20 / x3)
  12. `Warhammer` (20 / x3)
  13. `Spear` (20 / x3)
  14. `Scythe` (20 / x4)
- **Viðmótsöryggi:** Viðmót leiksins birtir hvergi eða lofar óvirkum critical gildum.

### 2.6 Ranger Opening Shot
- **Skilyrði staðfest og læst:**
  - Hetjan verður að vera af stéttinni `RANGER`.
  - Hetjan verður að hafa útbúið fjarvopn (`preparedRangedWeapon`).
  - Hetjan verður að hafa komið auga á skrímslið fyrst (`spotted_by_hero === 1`).
  - Engin fyrirsát má eiga sér stað (`is_ambush === 0`).
  - Bardagastaða verður að vera `DISCOVERED`.
  - Skotið ríður aðeins af einu sinni per bardaga (`opening_shot_resolved = 1`).
- Ef skrímslið fellur af opnunarskotinu klárast bardaginn samstundis með fullum XP og herfangi.

### 2.7 Fljúgandi skrímsli (`movement_type = 'FLY'`)
- Gagnagrunnur geymir `movement_type = 'FLY'`.
- `getActiveWeapon` í `src/domain/character/rules.js` styður nú bæði `'FLY'` og `'FLYING'` óháð stafastærð (`case-insensitive`).
- Þegar fljúgandi óvinur mætir hetju neyðist hún sjálfkrafa í fjarvopn (ef til staðar) og skjaldarbónus fellur niður í 0 AC.

---

## 3. Uppfærð Heildarúttekt á öllum 113 hlutum leiksins

Eftir stöðugleikaátakið er staðan á öllum 113 hlutum eftirfarandi:
- **Fullkomlega virkir og í fullri notkun (Active & Operational):** **103 hlutir (91,2%)**
- **Tímabundið óvirkir í búð/herfangi sem bíða framtíðarkerfa (Deferred):** **10 hlutir (8,8%)**

### 3.1 Tafla yfir alla 113 hluti eftir flokkum:

| Flokkur | Samtals hlutir | Virkir (Operational) | Óvirkir (Deferred) | Athugasemdir |
|---|---|---|---|---|
| **WEAPON** | 48 | 48 (100%) | 0 (0%) | Öll 48 vopn virka að fullu í bardaga (AB, Dmg, 2-Handed, Melee/Ranged, Flying). 14 vopn hafa non-standard crit metadata sem bíða framtíðarverkefnis. |
| **ARMOR** | 24 | 23 (95,8%) | 1 (4,2%) | 10 venjulegar brynjur og 13 töfrabrynjur virka 100% með réttu AC (engin tvítalning). `Bracers of Armor +1` frestað. |
| **SHIELD** | 9 | 9 (100%) | 0 (0%) | 4 venjulegir og 5 töfraskildir virka 100% með réttu AC (engin tvítalning, rétt bæling við tveggja handa vopn og fjarbardaga). |
| **POTION** | 13 | 6 (46,2%) | 7 (53,8%) | Allir 6 læknadrykkir virka fullkomlega (Minor, CLW, CMW, CSW, CCW, Troll's Blood). 5 buff-drykkir, 1 elddrykkur og Antitoxin eru tímabundið óvirkir í herfangi/búð og drykkja stöðvuð. |
| **OTHER** | 19 | 17 (89,5%) | 2 (10,5%) | 14 dýrgripir seljast á 50% virði í borg. `Ring of Protection +1`, `Amulet of Natural Armor +1` og `Belt of Giant Strength +2` virka að fullu. `Boots of Elvenkind` og `Cloak of Resistance +1` frestað. |
| **Samtals** | **113** | **103 (91,2%)** | **10 (8,8%)** | **Öruggt, villulaust og tilbúið fyrir leikmenn.** |

---

## 4. Skrá yfir hluti sem bíða síðari útfærslu (Deferred Items)

Eftirfarandi 10 hlutir eru verndaðir í gagnagrunni en eru tímabundið fjarlægðir úr herfangstöflum og búðum þar til viðeigandi leikkerfi eru byggð:

| # | Hlutur | Flokkur | Fyrirhuguð virkni | Ástæða frestunar |
|---|---|---|---|---|
| 1 | `Potion of Barkskin` | POTION | +2 AC í bardaga | Bíður stöðubuff-kerfis (*Combat Status Effects*) |
| 2 | `Potion of Bull's Strength` | POTION | +4 STR í bardaga | Bíður stöðubuff-kerfis (*Combat Status Effects*) |
| 3 | `Potion of Cat's Grace` | POTION | +4 DEX í bardaga | Bíður stöðubuff-kerfis (*Combat Status Effects*) |
| 4 | `Potion of Shield of Faith` | POTION | +2 Sacred AC í bardaga | Bíður stöðubuff-kerfis (*Combat Status Effects*) |
| 5 | `Potion of Heroism` | POTION | +2 Atk & Saves í bardaga | Bíður stöðubuff-kerfis (*Combat Status Effects*) |
| 6 | `Elixir of Dragon's Breath` | POTION | 3d6 eldskaði á óvin | Bíður sóknardrykkjakerfis (*Offensive Consumables*) |
| 7 | `Antitoxin` | POTION | Eiturvörn og eitureyðing | Bíður eiturkerfis (*Poison Mechanics*) |
| 8 | `Boots of Elvenkind` | OTHER | Stealth / Hljóðlát spor | Bíður færnikerfis (*Skills & Stealth*) |
| 9 | `Cloak of Resistance +1` | OTHER | +1 í öll björgunarköst | Bíður björgunarkastakerfis (*Saving Throws*) |
| 10 | `Bracers of Armor +1` | ARMOR | Handarbrynja án brynju | Bíður úlnliðshólfa (*Wrist Armor Rules*) |

---

## 5. Prófanir & Staðfesting

Keyrð voru öll próf í verkefninu eftir allar breytingar:
- **Heildarfjöldi prófa:** **174 sjálfvirk próf (100% pass across 14 test suites)**.
  - `tests/item_system_stabilization.test.js` (18 ný próf fyrir AC tvítalningu, persistent overflow, óvirka drykki, Belt +2, crit metadata, ranger opening shot og fljúgandi skrímsli).
  - `tests/item_equipment_loot_system.test.js` (almennt hlutakerfi, búð, 50-hluta takmörk, permadeath).
  - Öll eldri próf fyrir bardagavél, skrímslaval, terrain artwork, leikmannastofnun og öryggi standast án nokkurra frávika.
- **Loot Balance Simulation (30.000 bardagar):**
  - High CR Drekahít (Young Green Dragon):
    - **Legendary rate:** **0,59%** (62 af 10.433 hlutum) — vel undir 1% viðmiði!
    - **Epic rate:** **1,29%** (135 af 10.433 hlutum).
    - **Common / Uncommon / Rare:** **98,12%**.
  - Dýraregla (`ANIMAL`): 1.000 bardagar = **nákvæmlega 0 gull og 0 hlutir**.
  - 50-hluta takmörk: 0 venjulegir dropar þegar bakpoki er fullur.
- **Git staða:** Allt unnið á greininni `feature/item-equipment-loot-system`. Engu hefur verið merge-að í `main` og engu hefur verið deploy-að.
