# Darkgrid — Pathfinder 1e Rules Mapping & System Specifications

> **Skjal:** `docs/pathfinder-rules-mapping.md`  
> **Heimildagrunnur:** Pathfinder Roleplaying Game (1st Edition) Core Rulebook via Archives of Nethys ([aonprd.com](https://aonprd.com/))  
> **Tilgangur:** Skilgreina nákvæmlega hvernig Pathfinder 1e reglur eru yfirfærðar í Darkgrid, hvaða einfaldanir gilda og hvaða sérreglur leikurinn hefur samþykkt.

---

## 1. Yfirlit yfir reglumun (Rules Comparison Matrix)

| Kerfi / Eiginleiki | Opinber Pathfinder 1e Regla | Darkgrid Útfærsla & Einföldun | Rökstuðningur í Darkgrid |
|---|---|---|---|
| **Classes** | 11+ grunnhópar (Core Classes) | Nákvæmlega þrjár: **Fighter, Ranger, Cleric** | Skýr, fókuseruð dark-fantasy leikupplifun án flókins multi-classing. |
| **Attack Bonus** | Base Attack Bonus (BAB) eftir class + STR (melee) eða DEX (ranged). | `floor((STR_mod + DEX_mod) / 2) + level_training + weapon_bonus` | Upprunaleg jafnvægisformúla Darkgrid. Full progression: +1/lvl (lvl-1). Cleric 3/4 progression: `floor(lvl * 0.75)`. |
| **Iterative Attacks** | BAB +6/+1, +11/+6/+1 (aukaárásir á hærra stigi). | **Engar aukaárásir.** Alltaf 1 árás á umferð. | Hraðari og hreinni turn-based bardagi í vefviðmóti. |
| **Armor Class (AC)** | `10 + Armor + Shield + DEX_mod (hámarkað við Max DEX) + Size + Deflection + Natural`. | `10 + min(DEX_mod, Armor_Max_DEX + Armor_Training) + Armor_bonus + Shield_bonus`. | Fullkomin Pathfinder brynjuvernd með Max DEX takmörkun og Fighter Armor Training stuðningi. |
| **Shield & Ranged** | Shield bonus gildir almennt nema þegar borið er tvíhent vopn (eins og boga/armbrjóst) sem útilokar skjöld. | **Skjöldur gefur 0 AC bónus þegar hetja berst með Ranged vopni.** | Raunsæi: Spilari getur ekki varið sig með skildi á meðan hann skýtur úr boga eða seilist í lásboga. |
| **Ammunition & Reload** | Örvar, lásbogaboltar og kúlur teljast og kosta; reload tími tekur move/standard action. | **Unlimited Ammunition.** Engin ammo talning, engin kaup, enginn reload kostnaður. | Eykur leikgleði og kemur í veg fyrir að hetjur festist í óvinnandi bardögum úti í óbyggðum. |
| **Critical Hits** | Threat range (t.d. 18–20) og multiplier (x2, x3, x4) með confirmation roll. | **Natural 20 = sjálfvirkt crit með 2x damage.** Natural 1 = auto miss. | Samræmt, einfalt d20 kerfi án flókinna margföldunarkasta. |
| **XP Progression** | Fast, Medium, Slow töflur. | **Pathfinder 1e Fast XP Table** (0, 1300, 3300, 6000, 10000, 15000, 23000, 34000, 50000, 71000). | Um ~10 sigrar gegn sambærilegum skepnum á hverju stigi í sóló-bardögum. |
| **Level-Up** | Krefst hvíldar, þjálfunar eða dvalar í borg. | **Sjálfvirkt í lok bardaga** við nægt XP. Current HP og Max HP hækka um nákvæmlega sama mismun (engin full lækning). | Hvetur spilarann til áframhaldandi könnunar án þess að eyðileggja spennuna. |
| **Fighter Training** | Weapon Training gefur bónus á vopnaflokka. Armor Training lækkar ACP og hækkar Max DEX. | Weapon Training: Lvl 1–4: +0/+0; Lvl 5–8: +1/+1; Lvl 9+: +2/+2. Armor Training: Lvl 1–2: +0, Lvl 3–6: +1, Lvl 7+: +2 Max DEX. | Gildir um öll vopn og brynjur sem hetjan notar. |
| **Ranger Favored Enemy** | +2 bónus á völdum tegundum, velur fleiri á 5., 10., 15. stigi. | **Einn varanlegur Favored Enemy** valinn við character creation. +1/+1 (lvl 1–4), +2/+2 (lvl 5–8), +3/+3 (lvl 9+). Undead óheimilt; Humanoid krefst subtype. | Varanlegt persónuval sem gefur mikla sérstöðu. |
| **Cleric Divine & Healing** | Channel Energy, Spells (Cure wounds) í og utan bardaga. Turn Undead. | **Divine Power:** passífur bónus gegn Undead (+2/+2, +3/+3, +4/+4). **Self-Healing:** Aðeins utan bardaga (1d6 til 5d6, 2 til 4 notkanir). Endurnýjast í borg. | Kemur í veg fyrir að bardagakerfið fari úr skorðum og heldur aðgerðum í 3. |
| **Magic Weapons/Armor** | +1 til +5 með sérstökum eiginleikum (Flaming, Keen, o.s.frv.). | **+1 og +2 Enhancement vopn og brynjur.** Engin flókin áhrif eða álög í v1. | Hámarks stöðugleiki og raunveruleg vélræn áhrif á attack, damage og AC. |
| **Loot & Economy** | Treasure tables, selling gear for 50%, buying magic items freely. | Non-magical búð selur á 100%, kaupir á 50%. **Global Magical Resale Market:** Búð kaupir töfragripi á 40%, selur á 125% (einungis 1 eintak í heiminum). | Skapar lifandi, samkeppnishæft hagkerfi milli spilara. |

---

## 2. XP & Leveling Tafla (Pathfinder 1e Fast Track)

| Level | Cumulative XP Required | XP to Next Level | Target Solo Monster CR |
|:---:|:---:|:---:|:---:|
| **1** | 0 | 1,300 | CR 1/4 – CR 1 |
| **2** | 1,300 | 2,000 | CR 1 – CR 2 |
| **3** | 3,300 | 2,700 | CR 2 – CR 3 |
| **4** | 6,000 | 4,000 | CR 3 – CR 4 |
| **5** | 10,000 | 5,000 | CR 4 – CR 5 |
| **6** | 15,000 | 8,000 | CR 5 – CR 6 |
| **7** | 23,000 | 11,000 | CR 6 – CR 7 |
| **8** | 34,000 | 16,000 | CR 7 – CR 8 |
| **9** | 50,000 | 21,000 | CR 8 – CR 9 |
| **10** | 71,000 | — | CR 9 – CR 10 |

---

## 3. Class Progression & Abilities

### Fighter
- **Hit Dice:** `10 + CON modifier` á level.
- **Attack Progression:** Full (`level - 1`).
- **Weapon Training:**
  - Level 1–4: +0 Attack, +0 Damage
  - Level 5–8: +1 Attack, +1 Damage
  - Level 9+: +2 Attack, +2 Damage
- **Armor Training:**
  - Level 1–2: +0 Max DEX
  - Level 3–6: +1 Max DEX
  - Level 7+: +2 Max DEX

### Ranger
- **Hit Dice:** `8 + CON modifier` á level.
- **Attack Progression:** Full (`level - 1`).
- **Favored Enemy:**
  - Level 1–4: +1 Attack, +1 Damage
  - Level 5–8: +2 Attack, +2 Damage
  - Level 9+: +3 Attack, +3 Damage
  - *Takmarkanir:* Undead er ekki leyfilegt sem Favored Enemy fyrir Ranger (Cleric hefur Divine Power yfir Undead). Ef Humanoid er valið verður að velja subtype (t.d. reptilian, goblinoid, orc, giant).

### Cleric
- **Hit Dice:** `8 + CON modifier` á level.
- **Attack Progression:** 3/4 (`floor(level * 0.75)`).
- **Divine Power:**
  - Passífur bónus gegn öllum Undead skrímslum:
    - Level 1–4: +2 Attack, +2 Damage
    - Level 5–8: +3 Attack, +3 Damage
    - Level 9+: +4 Attack, +4 Damage
- **Self-Healing (Outside Combat Only):**
  - Level 1–2: `1d6 + WIS_mod`, 2 uses per expedition
  - Level 3–4: `2d6 + WIS_mod`, 2 uses per expedition
  - Level 5–6: `3d6 + WIS_mod`, 3 uses per expedition
  - Level 7–8: `4d6 + WIS_mod`, 3 uses per expedition
  - Level 9–10: `5d6 + WIS_mod`, 4 uses per expedition
  - Endurnýjast aðeins við ókeypis lækningu í öruggri borg.

---

## 4. Leyfisyfirferð og höfundarréttur (Copyright & OGL / ORC)
- Öll tölfræði, hugtök (attributes, armor class, attack rolls, damage dice, base prices) byggja á opnu leikreglunum (Open Game License v1.0a og d20 System Reference Document).
- Enginn verndaður prósi, sérstök söguheiti eða skrautmyndir frá Paizo eru nýtt í Darkgrid. Allar lýsingar á hlutum, skrímslum og atburðum eru frumsamdar af leikritshöfundum Darkgrid.
