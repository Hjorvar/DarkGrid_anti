# Darkgrid — Pathfinder 1e Item Database Report

> **Skjal:** `docs/item-database-report.md`  
> **Áfangi:** Phase C (Pathfinder Item Database) & Phase D (Magical Items)  
> **Staða:** **Fullklárað og innleitt í SQLite gagnagrunn (`db/seeds/005_seed_pathfinder_items.sql`)**  
> **Heildarfjöldi items í gagnagrunni:** **83 hlutir** (Markmið var 75+)

---

## 1. Yfirlit yfir vöruflokka (Category Distribution)

| Flokkur | Undirflokkur | Tegund | Fjöldi | Markmið | Staða |
|---|---|:---:|:---:|:---:|:---:|
| **Melee Weapons** | Venjuleg návígisvopn | Non-magical | 24 | 20 | **120% af markmiði** |
| **Ranged Weapons** | Venjuleg fjarvopn | Non-magical | 10 | 10 | **100% af markmiði** |
| **Armor** | Venjulegar léttar, miðlungs og þungar brynjur | Non-magical | 14 | 14 | **Fullgilt** |
| **Shields** | Venjulegir skildir (Buckler, Light, Heavy, Tower) | Non-magical | 6 | 6 | **Fullgilt** |
| **Healing Potions** | Lækningadrykkir (Minor til Cure Critical Wounds) | Magical | 5 | 5 | **100% af markmiði** |
| **Magical Weapons** | +1 og +2 töfravopn | Magical (+1, +2) | 12 | 10 | **120% af markmiði** |
| **Magical Armor & Shields**| +1 og +2 töfrabrynjar og skildir | Magical (+1, +2) | 12 | 10 | **120% af markmiði** |
| **SAMTALS** | Heildarsafn Darkgrid | | **83** | **75** | **110% af markmiði** |

---

## 2. Venjuleg návígisvopn (Normal Melee Weapons — 24 items)

| Nafn | Skaði | Hendur | Grunnverð (gp) | Búð kaupir (gp) | Leyfðir Classes | Pathfinder Heimild |
|---|:---:|:---:|:---:|:---:|---|---|
| **Dagger** | 1d4 | 1-handed (Light) | 2 | 1 | Fighter, Ranger, Cleric | Core Rulebook pg. 142 |
| **Shortsword** | 1d6 | 1-handed (Light) | 10 | 5 | Fighter, Ranger, Cleric | Core Rulebook pg. 143 |
| **Longsword** | 1d8 | 1-handed | 15 | 7 | Fighter, Ranger, Cleric | Core Rulebook pg. 143 |
| **Greatsword** | 2d6 | 2-handed | 50 | 25 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Battleaxe** | 1d8 | 1-handed | 10 | 5 | Fighter, Ranger | Core Rulebook pg. 142 |
| **Greataxe** | 1d12 | 2-handed | 20 | 10 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Handaxe** | 1d6 | 1-handed (Light) | 6 | 3 | Fighter, Ranger | Core Rulebook pg. 142 |
| **Warhammer** | 1d8 | 1-handed | 12 | 6 | Fighter, Cleric | Core Rulebook pg. 143 |
| **Light Mace** | 1d6 | 1-handed (Light) | 5 | 2 | Fighter, Cleric | Core Rulebook pg. 142 |
| **Heavy Mace** | 1d8 | 1-handed | 12 | 6 | Fighter, Cleric | Core Rulebook pg. 142 |
| **Morningstar** | 1d8 | 1-handed | 8 | 4 | Fighter, Cleric | Core Rulebook pg. 142 |
| **Spear** | 1d8 | 2-handed | 2 | 1 | Fighter, Ranger, Cleric | Core Rulebook pg. 142 |
| **Shortspear** | 1d6 | 1-handed | 1 | 0 | Fighter, Ranger, Cleric | Core Rulebook pg. 142 |
| **Quarterstaff** | 1d6 | 2-handed | 1 | 0 | Fighter, Ranger, Cleric | Core Rulebook pg. 142 |
| **Halberd** | 1d10 | 2-handed | 10 | 5 | Fighter | Core Rulebook pg. 143 |
| **Scythe** | 2d4 | 2-handed | 18 | 9 | Fighter, Cleric | Core Rulebook pg. 143 |
| **Heavy Flail** | 1d10 | 2-handed | 15 | 7 | Fighter | Core Rulebook pg. 143 |
| **Light Flail** | 1d8 | 1-handed | 8 | 4 | Fighter, Cleric | Core Rulebook pg. 143 |
| **Scimitar** | 1d6 | 1-handed | 15 | 7 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Rapier** | 1d6 | 1-handed | 20 | 10 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Club** | 1d6 | 1-handed | 0 | 0 | Fighter, Ranger, Cleric | Core Rulebook pg. 142 |
| **Greatclub** | 1d10 | 2-handed | 5 | 2 | Fighter | Core Rulebook pg. 142 |
| **Glaive** | 1d10 | 2-handed | 8 | 4 | Fighter | Core Rulebook pg. 143 |
| **Falchion** | 2d4 | 2-handed | 75 | 37 | Fighter | Core Rulebook pg. 143 |

---

## 3. Venjuleg fjarvopn (Normal Ranged Weapons — 10 items)

| Nafn | Skaði | Hendur | Grunnverð (gp) | Búð kaupir (gp) | Leyfðir Classes | Pathfinder Heimild |
|---|:---:|:---:|:---:|:---:|---|---|
| **Shortbow** | 1d6 | 2-handed | 30 | 15 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Longbow** | 1d8 | 2-handed | 75 | 37 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Composite Shortbow**| 1d6 | 2-handed | 75 | 37 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Composite Longbow** | 1d8 | 2-handed | 100 | 50 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Light Crossbow** | 1d8 | 2-handed | 35 | 17 | Fighter, Ranger, Cleric | Core Rulebook pg. 142 |
| **Heavy Crossbow** | 1d10 | 2-handed | 50 | 25 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Hand Crossbow** | 1d4 | 1-handed | 100 | 50 | Fighter, Ranger | Core Rulebook pg. 143 |
| **Sling** | 1d4 | 1-handed | 1 | 0 | Fighter, Ranger, Cleric | Core Rulebook pg. 142 |
| **Javelin** | 1d6 | 1-handed | 1 | 0 | Fighter, Ranger | Core Rulebook pg. 142 |
| **Dart** | 1d4 | 1-handed | 1 | 0 | Fighter, Ranger, Cleric | Core Rulebook pg. 142 |

---

## 4. Venjulegar brynjur og skildir (Normal Armor & Shields — 20 items)

| Nafn | Flokkur | AC Bónus | Max DEX | Grunnverð (gp) | Búð kaupir (gp) | Leyfðir Classes |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Padded Armor** | Light Armor | +1 | +8 | 5 | 2 | Fighter, Ranger, Cleric |
| **Leather Armor** | Light Armor | +2 | +6 | 10 | 5 | Fighter, Ranger, Cleric |
| **Studded Leather Armor** | Light Armor | +3 | +5 | 25 | 12 | Fighter, Ranger, Cleric |
| **Chain Shirt** | Light Armor | +4 | +4 | 100 | 50 | Fighter, Ranger |
| **Hide Armor** | Medium Armor | +4 | +4 | 15 | 7 | Fighter, Ranger, Cleric |
| **Scale Mail** | Medium Armor | +5 | +3 | 50 | 25 | Fighter, Cleric |
| **Chainmail** | Medium Armor | +6 | +2 | 150 | 75 | Fighter, Cleric |
| **Breastplate** | Medium Armor | +6 | +3 | 200 | 100 | Fighter, Ranger, Cleric |
| **Splint Mail** | Heavy Armor | +7 | +0 | 200 | 100 | Fighter, Cleric |
| **Banded Mail** | Heavy Armor | +7 | +1 | 250 | 125 | Fighter, Cleric |
| **Half-Plate** | Heavy Armor | +8 | +0 | 600 | 300 | Fighter |
| **Full Plate** | Heavy Armor | +9 | +1 | 1,500 | 750 | Fighter |
| **Armored Coat** | Medium Armor | +4 | +3 | 50 | 25 | Fighter, Cleric |
| **Agile Breastplate** | Medium Armor | +6 | +3 | 400 | 200 | Fighter, Ranger |
| **Buckler** | Shield | +1 | — | 5 | 2 | Fighter, Ranger, Cleric |
| **Light Wooden Shield**| Shield | +1 | — | 3 | 1 | Fighter, Ranger, Cleric |
| **Light Steel Shield** | Shield | +1 | — | 9 | 4 | Fighter, Cleric |
| **Heavy Wooden Shield**| Shield | +2 | — | 7 | 3 | Fighter, Cleric |
| **Heavy Steel Shield** | Shield | +2 | — | 20 | 10 | Fighter, Cleric |
| **Tower Shield** | Shield | +4 | +2 | 30 | 15 | Fighter |

---

## 5. Lækningadrykkir (Healing Potions — 5 items)

| Nafn | Lækningamagn | Min–Max HP | Kaupverð (gp) | Búð kaupir (gp) | Búðarstaða |
|---|:---:|:---:|:---:|:---:|---|
| **Minor Healing Potion** | `1d8+1` | 2–9 HP | 25 | 12 | Alltaf til sölu í öllum borgum |
| **Potion of Cure Light Wounds** | `1d8+1` | 2–9 HP | 50 | 25 | Sjaldgæft loot / CR 1+ |
| **Potion of Cure Moderate Wounds**| `2d8+3` | 5–19 HP | 300 | 150 | Sjaldgæft loot / CR 2+ |
| **Potion of Cure Serious Wounds** | `3d8+5` | 8–29 HP | 750 | 375 | Mjög sjaldgæft loot / CR 3+ |
| **Potion of Cure Critical Wounds**| `4d8+7` | 11–39 HP | 1,400 | 700 | Mjög sjaldgæft loot / CR 5+ |

---

## 6. Töfravopn (+1 og +2 Magical Weapons — 12 items)

Verðformúla: `Grunnverð + 300 gp (Masterwork) + (Bónus^2 * 2.000 gp)`. Búð kaupir á 40% (floor) og endurselur á 125% (ceil).

| Nafn | Bónus | Skaði | Kaupverð (gp) | Búð kaupir (gp) | Endursöluverð (gp) | Min CR Loot |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Longsword +1** | +1 atk, +1 dmg | 1d8 | 2,315 | 926 | 2,894 | CR 1 |
| **Shortsword +1** | +1 atk, +1 dmg | 1d6 | 2,310 | 924 | 2,888 | CR 1 |
| **Dagger +1** | +1 atk, +1 dmg | 1d4 | 2,302 | 920 | 2,878 | CR 1 |
| **Battleaxe +1** | +1 atk, +1 dmg | 1d8 | 2,310 | 924 | 2,888 | CR 1 |
| **Warhammer +1** | +1 atk, +1 dmg | 1d8 | 2,312 | 924 | 2,890 | CR 1 |
| **Heavy Mace +1** | +1 atk, +1 dmg | 1d8 | 2,312 | 924 | 2,890 | CR 1 |
| **Greatsword +1** | +1 atk, +1 dmg | 2d6 | 2,350 | 940 | 2,938 | CR 2 |
| **Shortbow +1** | +1 atk, +1 dmg | 1d6 | 2,330 | 932 | 2,913 | CR 1 |
| **Longbow +1** | +1 atk, +1 dmg | 1d8 | 2,375 | 950 | 2,969 | CR 1 |
| **Light Crossbow +1** | +1 atk, +1 dmg | 1d8 | 2,335 | 934 | 2,919 | CR 1 |
| **Longsword +2** | +2 atk, +2 dmg | 1d8 | 8,315 | 3,326 | 10,394 | CR 4 |
| **Longbow +2** | +2 atk, +2 dmg | 1d8 | 8,375 | 3,350 | 10,469 | CR 4 |

---

## 7. Töfrabrynjar og skildir (+1 og +2 Armor & Shields — 12 items)

Verðformúla: `Grunnverð + 150 gp (Masterwork) + (Bónus^2 * 1.000 gp)`.

| Nafn | Bónus | Heildar AC | Max DEX | Kaupverð (gp) | Búð kaupir (gp) | Endursöluverð (gp) | Min CR Loot |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Leather Armor +1** | +1 Armor | +3 | +6 | 1,160 | 464 | 1,450 | CR 1 |
| **Chain Shirt +1** | +1 Armor | +5 | +4 | 1,250 | 500 | 1,563 | CR 1 |
| **Scale Mail +1** | +1 Armor | +6 | +3 | 1,200 | 480 | 1,500 | CR 1 |
| **Chainmail +1** | +1 Armor | +7 | +2 | 1,300 | 520 | 1,625 | CR 1 |
| **Breastplate +1** | +1 Armor | +7 | +3 | 1,350 | 540 | 1,688 | CR 2 |
| **Full Plate +1** | +1 Armor | +10 | +1 | 2,650 | 1,060 | 3,313 | CR 3 |
| **Light Steel Shield +1**| +1 Shield | +2 | — | 1,159 | 463 | 1,449 | CR 1 |
| **Heavy Steel Shield +1**| +1 Shield | +3 | — | 1,170 | 468 | 1,463 | CR 1 |
| **Chain Shirt +2** | +2 Armor | +6 | +4 | 4,250 | 1,700 | 5,313 | CR 4 |
| **Breastplate +2** | +2 Armor | +8 | +3 | 4,350 | 1,740 | 5,438 | CR 4 |
| **Full Plate +2** | +2 Armor | +11 | +1 | 5,650 | 2,260 | 7,063 | CR 4 |
| **Heavy Steel Shield +2**| +2 Shield | +4 | — | 4,170 | 1,668 | 5,213 | CR 4 |
