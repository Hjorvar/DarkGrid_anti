# Darkgrid — Balance Simulation & Mechanics Audit Report

> **Dagsetning:** Október 2026  
> **Útibú (Branch):** `overnight-dev`  
> **Staða:** Greining og samanburðarúttekt á jafnvægi (Engum leikreglum hefur verið breytt)  
> **Gagnagrunnur:** SQLite (`data/darkgrid.sqlite`) — 68 Pathfinder 1e monsters, 83 items  
> **Prófunarfjöldi:** 10.000 hermdir bardagar í hverju staki (100.000+ heildarbardagar)  

---

## 1. Yfirlit og aðferðafræði (Audit Methodology)

Í kjölfar fyrri næturhermunar (`scripts/simulate_balance.js`) var framkvæmd ítarleg endurskoðun og stöðlun á jafnvægismælingum í [`scripts/run_balance_audit.js`](file:///c:/Users/hih/Documents/antiDark/scripts/run_balance_audit.js).

### A. Samþykktur upphafsbúnaður (Starting Gear — Level 1)
Til að tryggja 100% samræmi við raunverulegt leikschema voru notaðir nákvæmlega þeir hlutir sem úthlutað er við hetjustofnun í [`src/domain/character/rules.js`](file:///c:/Users/hih/Documents/antiDark/src/domain/character/rules.js#L456):
- **Fighter:** Longsword (1d8), Shortbow (1d6), Chain Shirt (AC +4, Max DEX 4), Light Steel Shield (+1 AC).  
  *Grunnstölur:* STR 16 (+3), CON 14 (+2), DEX 12 (+1) $\rightarrow$ **12 HP, AC 16**.
- **Ranger:** Shortsword (1d6), Longbow (1d8), Leather Armor (AC +2, Max DEX 6), Enginn skjöldur.  
  *Grunnstölur:* STR 13 (+1), CON 12 (+1), DEX 16 (+3) $\rightarrow$ **9 HP, AC 15**.
- **Cleric:** Heavy Mace (1d8), Sling (1d4), Scale Mail (AC +5, Max DEX 3), Light Steel Shield (+1 AC).  
  *Grunnstölur:* STR 13 (+1), CON 12 (+1), DEX 10 (+0), WIS 16 (+3) $\rightarrow$ **9 HP, AC 16**.

### B. Eðlilega uppfærður búnaður (Upgraded Gear — Level 3, 5, 7, 9)
- **Level 3 (Bættur venjulegur búnaður):**  
  Fighter: Breastplate (+6 AC) + Heavy Shield (+2 AC) $\rightarrow$ **AC 18**.  
  Ranger: Studded Leather (+3 AC, DEX +3) $\rightarrow$ **AC 16**.  
  Cleric: Banded Mail (+7 AC) + Heavy Shield (+2 AC) $\rightarrow$ **AC 19**.
- **Level 5 (Tier 1: +1 Töfrabúnaður):**  
  Fighter: Longsword +1, Breastplate +1, Heavy Shield +1 $\rightarrow$ **AC 20**, Weapon Training (+1 Atk/+1 Dmg).  
  Ranger: Shortsword +1, Longbow +1, Studded Leather +1 $\rightarrow$ **AC 17**.  
  Cleric: Heavy Mace +1, Banded Mail +1, Heavy Shield +1 $\rightarrow$ **AC 21**, Divine Power (+3 Atk/+3 Dmg vs Undead).
- **Level 7 & 9 (Tier 2: +2 Töfrabúnaður & Full Plate):**  
  Fighter: Longsword +2, Full Plate +2, Heavy Shield +2 $\rightarrow$ **AC 23–24**, Weapon Training (+2 Atk/+2 Dmg).  
  Ranger: Shortsword +2, Longbow +2, Mithral Shirt +2 $\rightarrow$ **AC 20**.  
  Cleric: Heavy Mace +2, Full Plate +2, Heavy Shield +2 $\rightarrow$ **AC 23**, Divine Power (+4 Atk/+4 Dmg vs Undead).

---

## 2. Höfuð-við-höfuð samanburður (Head-to-Head Benchmark)

Hér berjast Fighter, Ranger og Cleric við **nákvæmlega sömu skrímsli** við sömu aðstæður (10.000 bardagar í hverjum reit):

| Skrímsli | Flokkur | CR | Hetjustig | Búnaður | Fighter Win % | Ranger Melee (Shortsword) | Ranger Bow (Longbow) | Ranger Favored Enemy | Cleric Valkostur A (Núverandi) | Cleric Valkostur B (Sacred Warding) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Human Skeleton** | Undead | 0.33 | 1 | Starting | **95.5%** | 87.2% | 88.4% | 90.8% | 92.5% | **93.2%** |
| **Human Zombie** | Undead | 0.50 | 1 | Starting | **57.5%** | 23.4% | 30.6% | 33.5% | 41.5% | **46.8% (+5.3%)** |
| **Ghoul** | Undead | 1.00 | 1 | Starting | **75.4%** | 42.4% | 49.7% | 55.1% | 65.1% | **69.8% (+4.7%)** |
| **Goblin** | Humanoid | 0.33 | 1 | Starting | **97.3%** | 92.8% | 94.3% | 92.8% | 84.1% | 83.9% |
| **Orc** | Humanoid | 0.33 | 1 | Starting | **65.4%** | 34.3% | 40.2% | 45.1% | 35.4% | 35.7% |
| **Hobgoblin** | Humanoid | 0.50 | 1 | Starting | **67.1%** | 46.9% | 50.0% | 47.1% | 34.8% | 36.1% |
| **Wolf** | Animal | 1.00 | 1 | Starting | **78.8%** | 47.9% | 55.5% | 60.5% | 50.1% | 49.5% |
| **Skeletal Champion** | Undead | 2.00 | 3 | Upgraded | **48.9%** | 9.0% | 15.1% | 18.4% | 37.0% | **41.3% (+4.3%)** |
| **Ghast** | Undead | 2.00 | 3 | Upgraded | **94.3%** | 51.5% | 62.1% | 68.8% | 86.4% | **89.8% (+3.4%)** |
| **Shadow** | Undead | 3.00 | 3 | Upgraded | **99.8%** | 92.4% | 95.1% | 98.1% | 98.5% | **98.9%** |
| **Wight** | Undead | 3.00 | 3 | Upgraded | **99.8%** | 84.9% | 90.7% | 94.0% | 98.9% | **99.3%** |
| **Bugbear** | Humanoid | 2.00 | 3 | Upgraded | **89.3%** | 57.1% | 63.9% | 57.2% | 55.5% | 54.4% |
| **Ogre** | Humanoid | 3.00 | 3 | Upgraded | **17.1%** | 0.5% | 1.2% | 0.4% | 2.5% | 2.5% |
| **Mummy** | Undead | 5.00 | 5 | Upgraded | **3.5%** | 0.0% | 0.0% | 0.0% | 0.9% | **2.2%** |
| **Wraith** | Undead | 5.00 | 5 | Upgraded | **100.0%** | 88.2% | 93.1% | 99.2% | 99.1% | **99.7%** |
| **Troll** | Humanoid | 5.00 | 5 | Upgraded | **86.7%** | 2.4% | 7.3% | 20.4% | 15.2% | 15.2% |
| **Manticore** | Mag. Beast| 5.00 | 5 | Upgraded | **52.8%** | 0.6% | 2.3% | 14.7% | 1.1% | 1.1% |
| **Mummy** | Undead | 5.00 | 7 | Upgraded | **70.7%** | 0.2% | 0.7% | 3.1% | 34.4% | **48.9% (+14.5%)** |
| **Troll** | Humanoid | 5.00 | 7 | Upgraded | **100.0%** | 61.1% | 73.3% | 90.4% | 94.8% | 95.1% |
| **Mummy** | Undead | 5.00 | 9 | Upgraded | **97.2%** | 1.9% | 5.6% | 33.0% | 72.7% | **88.2% (+15.5%)** |
| **Troll** | Humanoid | 5.00 | 9 | Upgraded | **100.0%** | 92.0% | 96.4% | 99.8% | 99.3% | 99.3% |

---

## 3. Rannsókn á Ranger (Hvers vegna 2,6% gegn Troll?)

Rannsókn á kóða bardagavélarinnar ([`src/domain/combat/engine.js`](file:///c:/Users/hih/Documents/antiDark/src/domain/combat/engine.js#L258-L270)) og tölfræði Ranger leiddi í ljós fjórar samtengdar orsakir fyrir lágu sigurhlutfalli hans gegn Troll (CR 5):

1. **Þvingaður í návígi með rýting/stutt sverð (Forced Melee):**
   - Í [`engine.js`](file:///c:/Users/hih/Documents/antiDark/src/domain/combat/engine.js#L261) gildir reglan: *Ef skrímslið flýgur ekki (`movement_type !== 'FLY'`), velur vélin alltaf `equipment.meleeWeapon`*.
   - Ranger byrjar með Shortsword (1d6) og Longbow (1d8).
   - Þar sem Troll er á jörðu niðri, neyddist Ranger til að berjast við hann í návígi með Shortsword! Boginn (Longbow) var aldrei notaður.
2. **Skortur á fjarlægð (No Ranged Opening Rounds):**
   - Bardagakerfið hefur engar fjarlægðarumferðir (Distance / Standoff rounds). Bardagi hefst samstundis í návígi. Ranger fær engin ókeypis bogaskot áður en óvinurinn nær honum.
3. **Lífsstig og brynjuvörn:**
   - Ranger er með 9 HP á level (45 HP á Level 5) og Leather Armor (AC 15–17).
   - Troll er með AB +10 og slær 1d6+5 (8.5 meðalskaði). Gegn Ranger hittir Troll í **70% tilvika** og fellir hann á um 5 umferðum.
   - Með Shortsword (1d6+1 = 4.5 meðalskaði) þarf Ranger um **25 umferðir** til að höggva í gegnum 63 HP Trollsins!
4. **Favored Enemy misræmi:**
   - Ranger í hermuninni hafði valið `Humanoid (goblinoid)`. Troll er hins vegar `Humanoid (giant)`!
   - Ranger fékk því **+0 Attack og +0 Damage** gegn Troll.
   - **Þegar Ranger notar boga og hefur réttan Favored Enemy (Giant), hækkar sigurhlutfall hans úr 2,4% í 20,4% (næstum tíföldun)!**

---

## 4. Óútfærð skrímslaeinkenni (Pathfinder 1e Mechanics Audit)

Samanburður á tölum gegn Shadow (99,8%), Wraith (100%) og Mummy (3,5%) leiddi í ljós mikilvægt atriði í kóðagrunninum:

> [!IMPORTANT]
> Dálkurinn `special_abilities` í SQLite-töflunni `monsters` er eins og er **eingöngu lýsandi gagnasvið** (Metadata). Bardagavélin í [`src/domain/combat/engine.js`](file:///c:/Users/hih/Documents/antiDark/src/domain/combat/engine.js) les hvorki né framfylgir sérhæfileikum eða ónæmi.

Þetta skýrir hvers vegna skrímslin hegða sér svona ólíkt Pathfinder 1e borðspilinu:

1. **Shadow (CR 3):**
   - Í Pathfinder 1e er Shadow *Incorporeal* (ónæmt fyrir venjulegum vopnum, 50% skaði frá töfravopnum) og snerting hennar veldur 1d6 Strength Drain.
   - Í Darkgrid tekur Shadow fullan skaða frá öllum venjulegum vopnum, hefur engin styrkspjöll og aðeins 19 HP og AC 15. Hún fellur á 2 umferðum gegn Level 3 hetju. Þess vegna er sigurhlutfallið **98–99%**.
2. **Wraith (CR 5):**
   - Í Pathfinder 1e veldur Wraith *Constitution Drain* og er *Incorporeal*.
   - Í Darkgrid er Wraith með 47 HP og slær aðeins 1d6 (3.5 meðalskaði). Á móti Level 5 hetju með 45–60 HP tekur Wraith 20–30 umferðir að klára hetjuna, á meðan hetjan slær hana niður á 5 umferðum. Þess vegna er sigurhlutfallið **99–100%**.
3. **Mummy (CR 5):**
   - Mummy er hins vegar með gríðarlegar hráar líkamlegar tölur í Pathfinder: **HP 60, AC 20, AB +14, Damage 1d8+10 (14.5 meðalskaði)**.
   - Jafnvel án *Despair* og *Mummy Rot* þurrkar Mummy Level 5 hetju út á 3 umferðum vegna AB +14 sem hittir næstum alltaf.

---

## 5. Encounter Difficulty, Gaussian-dreifing og Permadeath

### Hvers vegna sýndi fyrri hermun 49,4% sigurhlutfall?
1. **Enginn flótti (Flee Disabled):** Fyrri hermunin neyddi allar hetjur til að berjast til dauða. Enginn leikmaður fékk að flýja eða nota Stage 1 (Ignore). Þess vegna enduðu 100% allra tapa í permadeath.
2. **Gaussian dreifing ($\sigma = 1.5$):**
   - Fyrir Level 1 hetju reiknast þyngd skrímsla eftir formúlunni:
     $$\text{weight}(L) = \exp\left(-\frac{(L - H)^2}{2 \cdot 1.5^2}\right)$$
   - Þetta gefur Level 1 hetju:
     - Level 1 skrímsli: 42% líkur
     - Level 2 skrímsli: 33% líkur
     - **Level 3 skrímsli (Ogre, Shadow, Wight): 17% líkur!**
     - **Level 4–5 skrímsli (Owlbear, Troll, Mummy): ~7% líkur!**
   - Level 1 hetja mætti því skrímsli af Level 3 eða hærra í **24% tilvika (næstum 1 af hverjum 4 bardögum)**!
   - Þegar Level 1 hetja með 9–12 HP mætir Ogre (30 HP, 2d8+7 skaði) og má ekki flýja, deyr hún í 99% tilvika. Það dró heildarmeðaltalið niður í 49,4%.

### Er leikurinn raunverulega sanngjarn fyrir 10 sigra á level?
- **XP útreikningur til Level 2 (1.300 XP þarf):**
  - Kobold (CR 0.25) gefur 100 XP $\rightarrow$ 13 sigrar.
  - Goblin / Skeleton (CR 0.33) gefur 135 XP $\rightarrow$ **10 sigrar**.
  - Zombie / Hobgoblin (CR 0.50) gefur 200 XP $\rightarrow$ **7 sigrar**.
  - Wolf / Ghoul (CR 1.0) gefur 400 XP $\rightarrow$ **3–4 sigrar**.
  - Meðal Level 1 hetja þarf **nákvæmlega um 7 til 10 sigra** til að ná Level 2!
- **Lifunarlíkur í 10 bardögum:**
  - Ef hetja berst eingöngu við viðráðanleg skrímsli (CR 0.25–0.33) þar sem sigurhlutfall er **95%**:
    $$0.95^{10} \approx 60\% \text{ líkur á að ná Level 2 án þess að deyja!}$$
  - Þetta er **fullkomlega sanngjarnt og hefðbundið Roguelike jafnvægi**, að því gefnu að leikmaður forðist CR 2–5 skrímsli á Level 1 eða nýti sér flótta (`FLEE`).

---

## 6. Cleric — Divine Power: Valkostur A vs Valkostur B (Sacred Warding)

### Útskýring á misræmi í Ghast-tölum í fyrri skýrslu
Í fyrri skýrslu kom fyrir fljótfærnisvilla í einni stakri skipanalínu:
- Ghast er skráður með `solo_level = 2` í gagnagrunninum.
- Í stökum prófunarkóða var hetjan sett á `solo_level` skrímslisins, svo Ghast var prófaður gegn **Level 2 Cleric** (sem gaf 78.0%).
- En í aðaltöflunni var Ghast prófaður gegn **Level 3 Cleric** (sem gaf 86.4% og 89.8%).
- **Í stöðluðu hermuninni hér að ofan eru allar forsendur 100% eins.**

### Áhrif Sacred Warding (Valkostur B: +1 AC á L1–4, +2 AC á L5–8, +3 AC á L9+ vs Undead)

| Skrímsli | Hetjustig | Valkostur A (Núverandi) | Valkostur B (Sacred Warding) | Munur |
|---|:---:|:---:|:---:|:---:|
| **Human Skeleton (CR 0.33)** | Lvl 1 | 92.5% | **93.2%** | +0.7% |
| **Human Zombie (CR 0.50)** | Lvl 1 | 41.5% | **46.8%** | **+5.3%** |
| **Ghoul (CR 1.00)** | Lvl 1 | 65.1% | **69.8%** | **+4.7%** |
| **Skeletal Champion (CR 2.00)** | Lvl 3 | 37.0% | **41.3%** | **+4.3%** |
| **Ghast (CR 2.00)** | Lvl 3 | 86.4% | **89.8%** | **+3.4%** |
| **Shadow (CR 3.00)** | Lvl 3 | 98.5% | **98.9%** | +0.4% |
| **Wight (CR 3.00)** | Lvl 3 | 98.9% | **99.3%** | +0.4% |
| **Mummy (CR 5.00)** | Lvl 7 | 34.4% | **48.9%** | **+14.5%** |
| **Mummy (CR 5.00)** | Lvl 9 | 72.7% | **88.2%** | **+15.5%** |

**Niðurstaða um Sacred Warding:**  
Sacred Warding hækkar lifun Cleric gegn Undead jafnt og þétt um **3% til 15%** á öllum stigum án þess að breyta frammistöðu hans gegn venjulegum óvinum.

---

## 7. Tillögur að aðgerðum í forgangsröð (Pending Approval)

Engar breytingar hafa verið gerðar í kóða. Hér eru tillögurnar til samþykktar:

### Forgangur 1: Ranger — Val á vopni og virkni boga (Ranged Combat)
- **Vandamál:** Ranger byrjar með Longbow (1d8) en vélin þvingar hann alltaf í Shortsword (1d6) gegn öllum skrímslum á jörðu niðri.
- **Tillaga:** Leyfa leikmanni að velja hvort Prepared Melee eða Prepared Ranged sé virka vopnið í bardaga, eða láta Ranger hefja bardaga með Longbow nema leikmaður velji annað.

### Forgangur 2: Cleric — Innleiða Sacred Warding (Valkostur B)
- **Vandamál:** Vegna 9 HP grunnlífsmagns (á móti 12 HP hjá Fighter) tekur Cleric of mikinn skaða af þungum höggum Zombie og Mummy í stökum einvígum.
- **Tillaga:** Bæta við Sacred Warding (+1 AC á L1–4, +2 AC á L5–8, +3 AC á L9+ gegn Undead) inn í Divine Power.

### Forgangur 3: Encounter Level-Gating fyrir byrjendareiti
- **Vandamál:** $\sigma = 1.5$ gefur 24% líkur á að Level 1 hetja mæti Level 3–5 skrímsli (Ogre, Mummy) rétt fyrir utan borgina.
- **Tillaga:** Setja hámark á `solo_level` skrímsla á reitum sem liggja að byrjunarborginni (t.d. `max_monster_level = hero_level + 1` á fyrstu 3 hringjum út frá borg).
