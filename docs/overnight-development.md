# Darkgrid — Næturþróunarskrá (Overnight Development Log)

> **Dagsetning:** Október 2026  
> **Útibú (Branch):** `overnight-dev`  
> **Staða:** Allir áfangar kláraðir (Phases A–M) — 100% próf standast  
> **Lokastaða prófa:** 67 af 67 prófum standast (100% pass, 0 regressions)  

---

## 📊 Yfirlit yfir verkþætti (Task Matrix)

| Verkþáttur | Lýsing | Staða | Athugasemdir |
|---|---|:---:|---|
| **0. Grunnur & Git** | Baseline commit, `overnight-dev` útibú, 57 próf staðfest | **COMPLETED** | Hreint útibú stofnað, allar reglur virtar |
| **Pathfinder Research** | Rannsókn á PF 1e reglum, bónusum og vélfræði (`docs/pathfinder-rules-mapping.md`) | **COMPLETED** | Skjölun á reglum, einföldun Darkgrid og höfundarrétti |
| **Phase A: Progression** | HP/Lvl, Attack progression, Fast XP tafla, Level-up strax í bardaga | **COMPLETED** | Fighter 10+CON, Ranger/Cleric 8+CON, Fast XP 1–10 |
| **Phase B: Class Abilities**| Fighter Weapon/Armor Training, Ranger Favored Enemy, Cleric Divine Power & Self-Healing | **COMPLETED** | Favored Enemy val við character creation, Cleric self-healing utan bardaga |
| **Phase C: Item Database**  | 75+ raunveruleg Pathfinder 1e items í SQLite (alls 83 items) | **COMPLETED** | 24 melee, 10 ranged, 20 armor/shield, 5 potions, 24 magic items |
| **Phase D: Magic Items**    | +1 og +2 vopn/brynjur með réttu PF verðlagi og virkni | **COMPLETED** | Enhancement atk/dmg/AC bónusar, verð samkvæmt AoNPRD |
| **Phase E: Inventory/Equip**| Prepared Melee & Prepared Ranged vopn, auto-val, shield regluvernd | **COMPLETED** | Flying skrímsli krefjast Ranged, Shield AC fellur niður í Ranged |
| **Phase F: Starting Gear**  | Réttur upphafsbúnaður allra 3 stétta með 10 gp | **COMPLETED** | Fighter, Ranger, Cleric fá samþykktan búnað útbúinn í rétt slots |
| **Phase G: Cities & Shops** | Ókeypis full lækning, General store (100% buy, 50% sell) | **COMPLETED** | Öruggar SQLite færslur, Sanctuary rest endurhleður Cleric healing |
| **Phase H: Magic Resale**   | Global magic market (40% buy, 125% resale, ein færslur) | **COMPLETED** | Leikmenn selja í sameiginlegan markað, aðrir geta keypt |
| **Phase I: Loot Tables**    | CR & Treasure classifications (None, Incidental, Standard, Double, NPC Gear) | **COMPLETED** | XP alltaf, dýr ekkert loot, CR-kvarðað gull og töfrahættur |
| **Phase J: Permadeath Sync**| Búnaður og eignir í 50% permadeath roll, 20-item cap | **COMPLETED** | Persistent monster fær 50% gull/hluti, victor endurheimtir við sigur |
| **Phase K: 30 New Monsters**| 30 ný viðbótarskrímsli með öllum 9 lýsingum (alls 68 skrímsli) | **COMPLETED** | Secrecy audit 100% staðfest, 30 frumlegar myndir búnar til og samþykktar (APPROVED) |
| **Phase L: Simulation**     | 100.000 bardaga hermun, hagkerfis- og jafnvægisgreining (`docs/balance-report.md`) | **COMPLETED** | 49.4% wilderness winrate, stéttagreining og hagkerfishraði |
| **Phase M: End-to-End Tests**| Heildarprófanir á öllu leikflæðinu, allar 67 prófanir grænar | **COMPLETED** | 10 ný heildarpróf í `tests/overnight_systems.test.js` |

---

## 🧪 Prófastafir (Test Verification)

- **Upphafsstaða (Baseline):** 57 passed, 0 failed (100%)
- **Viðbætt próf:** 10 ný heildarpróf (integration tests) fyrir alla nýja vélfræði
- **Lokastaða:** **67 passed, 0 failed (100% pass)**
- **Prófunarhlaup:** `node --test tests/*.test.js` (keyrslutími ~1.6 sek)

### Prófaðir þættir í heildarprófunum (`tests/overnight_systems.test.js`):
1. Upphafsbúnaður stétta og prepared equipment slots (Melee, Ranged, Armor, Shield).
2. Ranger Favored Enemy sannprófun (höfnun á Undead og ósértæku Humanoid).
3. Borgarverslun (kaup og sala á venjulegum búnaði með 50% liquidation).
4. Sanctuary Rest (full lækning og endurhleðsla á Cleric Self-Healing hleðslum).
5. Kvik vopnaval í bardaga (fljúgandi óvinir krefjast Ranged og fella niður skjöld).
6. Class abilities (Fighter Weapon/Armor Training, Ranger Favored Enemy, Cleric Divine Power).
7. Cleric Self-Healing utan bardaga (teningaköst, hámarkslækning og hámarkshleðslur).
8. Sjálfvirk level-up í bardaga (Current HP og Max HP hækka jafnt, engin ókeypis full lækning).
9. Töfrahagkerfi og alheimsendursala (Global Magic Resale Market með 40%/125% reglum).
10. Permadeath búnaðarflutningur á Persistent Monster og endurheimt sigurvegara.

---

## 📦 Skráabreytingar og viðbætur

### Gagnagrunnur:
- `db/migrations/006_progression_equipment_and_loot.sql` — Schema fyrir progression, items, shops og persistent loot.
- `db/seeds/005_seed_pathfinder_items.sql` — 83 Pathfinder 1e hlutir.
- `db/seeds/006_seed_pathfinder_30_additional.sql` — 30 ný Pathfinder 1e skrímsli (heildarfjöldi: 68 skrímsli).

### Lénsrökfræði (Domain Logic):
- `src/domain/character/rules.js` — Progression, Fast XP, Class Abilities, Equipment & Inventory stjórnun, Cleric Self-Heal.
- `src/domain/combat/rules.js` — d20 bónusar, vopnaval, AC útreikningar með skjaldarfalli við boga.
- `src/domain/combat/loot.js` — CR & Treasure type loot töflur, dýrareglur, töfrafallslíkur.
- `src/domain/economy/shop.js` — Verslunarkerfi, sanctuary rest, 50% sala, 40%/125% töframarkaður.
- `src/domain/combat/dice.js` — Sveigjanlegt teningakast með stuðningi við determinísk prófunarköst.
- `src/domain/combat/engine.js` — Kvik vopnaval (airborne vs grounded), samþætting við persistent monsters og loot.

### Notendaviðmót og Vefþjónusta:
- `src/routes/game.js` — `/game/rest`, `/game/cleric/heal`, `/game/inventory/equip`, `/game/inventory/unequip`, `/game/shop/buy`, `/game/shop/sell`.
- `src/routes/character.js` — Ranger Favored Enemy val í hetjustofnun.
- `src/views/game.ejs` — Búnaðarskjár (Melee, Ranged, Armor, Shield), verslunarflipar, sanctuary hvíldarhnappur og Cleric heal hnappur.
- `src/views/create-character.ejs` & `public/js/character-builder.js` — Favored Enemy valmynd fyrir Ranger.

### Hermun og Greining:
- `scripts/simulate_balance.js` — 100.000 bardaga Monte Carlo hermikeyrsla.
- `scripts/build_monster_expansion.js` — Skrímslagreining og sjálfvirk lýsingagerð.

### Skjölun (`docs/`):
- `docs/pathfinder-rules-mapping.md` — Samanburður á PF 1e og Darkgrid einföldunum.
- `docs/item-database-report.md` — Yfirlit yfir alla 83 hluti í gagnagrunni.
- `docs/monster-expansion-progress.md` — Yfirlit yfir öll 68 skrímsli leiksins.
- `docs/balance-report.md` — Niðurstöður 100.000 bardaga hermunar.
- `docs/overnight-development.md` — Þessi heildaryfirlitsskýrsla.

---

## 🪵 Git Commits á `overnight-dev`
1. `010a30b` — Baseline before overnight development session.
2. `2c19ec0` — feat: implement progression, class abilities, 83 pathfinder items, equipment slots, economy and loot tables.
3. `258cbf8` — feat: integrate character builder favored enemy, prepared gear UI, sanctuary rest and shop routes.
4. `19f31de` — feat: add 30 authentic pathfinder 1e monsters bringing catalog to 68 with secrecy descriptions and assets.
5. `b2957da` — feat: run 100,000 encounter balance simulation and compile comprehensive balance report.
