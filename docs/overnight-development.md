# Darkgrid — Næturþróunarskrá (Overnight Development Log)

> **Dagsetning:** Október 2026  
> **Útibú (Branch):** `overnight-dev`  
> **Staða:** Í virkri þróun  
> **Upphafleg prófastaða:** 57 af 57 prófum stóðust (100% pass)  

---

## Yfirlit yfir verkþætti (Task Matrix)

| Verkþáttur | Lýsing | Staða | Athugasemdir |
|---|---|:---:|---|
| **0. Grunnur & Git** | Baseline commit, `overnight-dev` útibú, 57 próf staðfest | **COMPLETED** | Git frumstillt, öll 57 próf standast |
| **Pathfinder Research** | Rannsókn á PF 1e vopnum, brynjum, bónusum og töfrahagkerfi (`docs/pathfinder-rules-mapping.md`) | **IN PROGRESS** | Heimildir: AoNPRD Core Rulebook Equipment |
| **Phase A: Progression** | HP/Lvl, Attack progression, Fast XP tafla, Level-up strax í bardaga | **PENDING** | Fighter 10+CON, Ranger/Cleric 8+CON |
| **Phase B: Class Abilities**| Fighter Weapon/Armor Training, Ranger Favored Enemy, Cleric Divine Power & Self-Healing | **PENDING** | Skilyrtir bónusar og utanbardagalækning |
| **Phase C: Item Database**  | 75+ raunveruleg Pathfinder 1e items í SQLite | **PENDING** | 20 melee, 10 ranged, 20 armor/shield, 5 potions, 10 mag wep, 10 mag armor |
| **Phase D: Magic Items**    | +1 og +2 vopn/brynjur með réttu PF verðlagi og virkni | **PENDING** | Enhancement atk/dmg/AC |
| **Phase E: Inventory/Equip**| Prepared Melee & Prepared Ranged vopn, auto-val, shield regluvernd | **PENDING** | Flying vs Grounded vopnaval, shield afföll í ranged |
| **Phase F: Starting Gear**  | Réttur upphafsbúnaður allra 3 stétta með 10 gp | **PENDING** | Fighter, Ranger, Cleric raunveruleg items |
| **Phase G: Cities & Shops** | Ókeypis full lækning, General store (100% sell, 50% buy) | **PENDING** | Öruggar SQLite transactions |
| **Phase H: Magic Resale**   | Global magic market (40% buy, 125% resale, ein færslur) | **PENDING** | Shared instance eignarhald |
| **Phase I: Loot Tables**    | CR & Treasure classifications (None, Incidental, Standard, Double, NPC Gear) | **PENDING** | XP alltaf, dýr ekkert loot, magic drop % |
| **Phase J: Permadeath Sync**| Búnaður og eignir í 50% permadeath roll, 20-item cap | **PENDING** | Persistent monster varðveitir fallinn búnað |
| **Phase K: 30 New Monsters**| 30 ný viðbótarskrímsli með öllum 9 lýsingum | **PENDING** | AoNPRD, dark fantasy stíll |
| **Phase L: Simulation**     | 100.000 bardaga hermun, hagkerfis- og jafnvægisgreining (`docs/balance-report.md`) | **PENDING** | Winrates, progression hraði |
| **Phase M: End-to-End Tests**| Heildarprófanir á öllu leikflæðinu, allar 57+ prófanir grænar | **PENDING** | 38 skrefa ferðalag |

---

## TEST RESULTS
- **Baseline:** 57 passed, 0 failed (Node test runner)

## GIT COMMITS
- `010a30b` - `Baseline before overnight development session` (branch `main` & `overnight-dev`)

## NEXT TASKS
1. Klára `docs/pathfinder-rules-mapping.md`.
2. Innleiða Phase A (Progression) og Phase B (Class Abilities) í `src/domain/character/rules.js` og `src/domain/combat/engine.js`.
3. Skrifa próf fyrir Phase A & B.
