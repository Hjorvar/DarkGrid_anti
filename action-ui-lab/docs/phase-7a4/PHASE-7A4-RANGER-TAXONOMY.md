# DARKGRID — PHASE 7A.4: RANGER TAXONOMY, FAVORED ENEMY BONUSES & 98-MONSTER CLASSIFICATION

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 — Locked Owner Decisions (`OD-7A4-03 / OC-1 Option A`, `OD-7A4-04 / P2`, `OD-7A4-08 / OC-3 Option A`), Magical Beast Classification, Favored Enemy Bonus Table, Verified Surface Counts (`88 / 87 / 86`), and Complete 98-Monster Classification  
**Status:** **LOCKED (Zero Open Taxonomy or Bonus Questions Remaining)**  
**Supersedes:** [`PHASE-7A3-RANGER-FAMILIES.md`](../phase-7a3/PHASE-7A3-RANGER-FAMILIES.md) and earlier drafts of `PHASE-7A4-RANGER-TAXONOMY.md`

---

## 1. Executive Summary of Locked Owner Decisions

The project owner has locked the following final decisions for Ranger taxonomy and Favored Enemy mechanics:

1. **`OC-1` — Option A Locked (14 Initial Favored Enemy Categories):**
   - Ranger Character Creation offers **exact 14 initial Favored Enemy categories**:
     `ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS` (**"Other Magical Beasts"**), `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `TROLLS`, and `GIANTS`.
   - `FEY` and `AMPHIBIAN_HUMANOIDS` are placed in the **Reserved / Advanced (`Tier 2`)** group alongside `MONSTROUS_HUMANOIDS`, `ABERRATIONS`, and `SUBTERRANEAN_HUMANOIDS`.
   - `TROLLS`, `GIANTS`, and `DRAGONS_DRAKES` remain selectable at Character Creation.
   - `UNDEAD` (**`11` monsters** in the 98-monster taxonomy) is **always strictly forbidden** for Rangers (`RANGER_FAVORED_ENEMY_FORBIDDEN`).
   - Backward compatibility for existing Ranger characters is preserved.
2. **`P2` — Magical Beast Classification Finalized (3 Families, No Extra Sub-Splits):**
   - The owner approves keeping the 3 Magical Beast families (`LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`) and recognizes that in a fantasy RPG it is neither possible nor desirable to subdivide every chimeric magical beast into micro-categories by strict biological kinship.
   - `TERRESTRIAL_MAGICAL_BEASTS` uses the clear English player-facing UI display name **"Other Magical Beasts"**.
   - No further biological sub-categories (`FELINE_MAGICAL_BEASTS`, `REPTILIAN_MAGICAL_BEASTS`, etc.) are created.
3. **`OC-3` — Option A Locked (Ranger Favored Enemy Bonus Progression):**
   - `Level 1–3`: `+2` Attack, `+2` Damage, `0` AC
   - `Level 4–7`: `+3` Attack, `+3` Damage, `0` AC
   - `Level 8`: `+4` Attack, `+4` Damage, `0` AC
   - `Level 9+`: `+4` Attack, `+4` Damage, `+2` AC
   - Do **not** add the expanded Critical Hit range (`19–20`) from older Option B.
   - Stacks additively with Ranger *Natural Knowledge* and INT/WIS *Battle Experience* per approved rules. Internal numerical bonuses remain hidden in the player UI.

---

## 2. Locked Classification of Magical Beasts (`P2`)

Of the `23` monsters with Pathfinder `creature_type = 'Magical Beast'`:
- **`3` Insectoid Magical Beasts** (`#28 Ankheg`, `#39 Stirge`, `#81 Phase Wasp`) belong to **`VERMIN_INSECTS`** by morphology.
- **`1` Arachnid Magical Beast** (`#55 Phase Spider`) belongs to **`ARACHNIDS`** by morphology.
- The remaining **`19` Magical Beasts** are divided into **3 locked families**:

### 2.1 `LUPINE_CANINE_BEASTS` — Magical Hounds & Wolves (`4` Monsters: `4` Surface, `0` Non-Surface)
Canine and lupine pack predators with supernatural breath, teleportation, or multi-headed morphology:
- `#24 Death Dog` (`L2`, `D, H`) — Two-headed disease-bearing desert hound.
- `#38 Winter Wolf` (`L5`, `F, M`) — Giant arctic wolf with freezing breath.
- `#45 Blink Dog` (`L2`, `P, H`) — Phase-shifting supernatural canine.
- `#75 Worg` (`L2`, `F, P`) — Intelligent, malevolent dire-wolf kin.

### 2.2 `AVIAN_CHIMERAS` — Winged Chimeras & Great Raptors (`5` Monsters: `5` Surface, `0` Non-Surface)
Winged, raptorial, and avian-hybrid predators that hunt from the sky and crags:
- `#8 Manticore` (`L5`, `H, M, S`) — Winged leonine/bat-winged aerial predator with tail spikes.
- `#27 Cockatrice` (`L3`, `P, H`) — Petrifying avian/reptilian galliform predator.
- `#52 Griffon` (`L4`, `H, M`) — Eagle-headed, winged leonine apex raptor.
- `#58 Peryton` (`L4`, `M, F`) — Giant stag-headed, eagle-winged carrion raptor.
- `#76 Hippogriff` (`L2`, `H, M, P`) — Eagle-winged, raptor-forequartered equine hybrid.

### 2.3 `TERRESTRIAL_MAGICAL_BEASTS` — UI Display Name: **"Other Magical Beasts"** (`10` Monsters: `9` Surface, `1` Non-Surface)
Diverse terrestrial, subterranean, and swamp-dwelling magical beasts and multi-limbed chimeras that do not belong to the lupine/canine or winged avian-chimera families:
- `#15 Darkmantle` (`L1`, `U` — Non-Surface) — Tentacled subterranean ambush predator.
- `#31 Owlbear` (`L4`, `F, H`) — Ferocious ursine-strigiform forest apex predator.
- `#35 Basilisk` (`L5`, `D, H`) — Eight-legged petrifying reptilian beast.
- `#66 Krenshar` (`L1`, `F, H`) — Skull-faced felid predator.
- `#67 Bunyip` (`L3`, `S, C`) — Roaring amphibious marsh/coastal predator.
- `#78 Carbuncle` (`L2`, `H, S`) — Jewel-browed armored reptilian beast.
- `#87 Displacer Beast` (`L4`, `F, H`) — Six-legged tentacled Void-panther.
- `#89 Leucrotta` (`L4`, `H, F`) — Badger-stag-lion voice-mimicking bone-crusher.
- `#94 Girallon` (`L5`, `F, M`) — Four-armed white-furred monstrous ape.
- `#95 Catoblepas` (`L5`, `S`) — Bloated, noxious-breathed swamp buffalo-boar chimera.

> [!NOTE]
> **Owner Ruling on Magical Beast Granularity:**
> No further sub-categories (`FELINE_MAGICAL_BEASTS`, `REPTILIAN_MAGICAL_BEASTS`, etc.) are created. Having **"Other Magical Beasts"** (`TERRESTRIAL_MAGICAL_BEASTS`) as the third Magical Beast category is natural for a dark fantasy RPG and keeps the initial Ranger selection cleanly at 14 categories.

---

## 3. Locked Ranger Favored Enemy Bonus Progression (`OC-3` — Option A)

### 3.1 Favored Enemy Numerical Bonus Table (Open-Ended at `Level 9+`)

| Ranger Level | Attack Bonus | Damage Bonus | Armor Class (AC) Bonus | Expanded Critical Hit Range |
| :--- | :---: | :---: | :---: | :---: |
| **Level 1–3** | `+2` | `+2` | `0` | None (`20` only) |
| **Level 4–7** | `+3` | `+3` | `0` | None (`20` only) |
| **Level 8** | `+4` | `+4` | `0` | None (`20` only) |
| **Level 9+ (`level >= 9`)** | `+4` | `+4` | `+2` | None (`20` only) |

### 3.2 Stacking with *Natural Knowledge* & INT/WIS *Battle Experience*
1. **Additive Stacking:**
   - When a Ranger fights a monster belonging to their chosen `favored_enemy_family`, the Favored Enemy bonus above stacks additively with:
     - **Ranger *Natural Knowledge*** (`+1 Atk` at L2–3, `+1 Atk / +1 AC` at L4–5, `+1 Atk / +1 Dmg / +1 AC` at L6–7, `+2 Atk / +2 Dmg / +1 AC` at L8+) if the monster also belongs to one of the 8 natural families (`ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`, `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `FEY`).
     - **INT/WIS *Battle Experience*** (up to `+4 Dmg` from `INT 18+` and `+3 AC` from `WIS 18+` at `3+` kills, preserved at full strength without nerfs).
2. **Class Specialization Exemption:**
   - Against both their chosen `favored_enemy_family` and all *Natural Knowledge* families, a Ranger is exempt from low-INT/low-WIS Tier 0 unfamiliar penalties (`victories === 0`) and starts at an effective floor of Tier 1 (`1` kill), yielding `max(0, Tier1Bonus(score))`.
3. **UI Secrecy:**
   - Exact numerical bonuses (`+2`, `+3`, `+4`, etc.) remain **hidden** from the player UI. Combat log prose and journal descriptions explain the Ranger's specialized anatomical and behavioral mastery over their quarry in English narrative text.

---

## 4. Complete 22-Family Taxonomy Summary (`98 / 98` Monsters)

### 4.1 Tier 1: Locked 14 Initial Ranger Character Creation Families (`OC-1` Option A: `64` Total / `61` Surface / `3` Non-Surface)

| # | `monster_family` Key | Player-Facing UI Display Name | Total | Surface | Non-Surface | Monster IDs & Names (`*` = Non-Surface) |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | `ANIMALS` | **Beasts & Wild Animals** | 12 | 12 | 0 | `#6` Giant Frog (L1), `#11` Wolf (L1), `#19` Boar (L2), `#25` Dire Bat (L2), `#41` Black Bear (L3), `#42` Crocodile (L2), `#43` Constrictor Snake (L2), `#59` Dire Wolf (L3), `#64` Wolverine (L2), `#65` Giant Eagle (L3), `#70` Dire Boar (L4), `#90` Grizzly Bear (L4) |
| 2 | `LUPINE_CANINE_BEASTS` | **Magical Hounds & Wolves** | 4 | 4 | 0 | `#24` Death Dog (L2), `#38` Winter Wolf (L5), `#45` Blink Dog (L2), `#75` Worg (L2) |
| 3 | `AVIAN_CHIMERAS` | **Winged Chimeras & Great Raptors** | 5 | 5 | 0 | `#8` Manticore (L5), `#27` Cockatrice (L3), `#52` Griffon (L4), `#58` Peryton (L4), `#76` Hippogriff (L2) |
| 4 | `TERRESTRIAL_MAGICAL_BEASTS` | **Other Magical Beasts** | 10 | 9 | 1 | `#15` Darkmantle* (L1, U), `#31` Owlbear (L4), `#35` Basilisk (L5), `#66` Krenshar (L1), `#67` Bunyip (L3), `#78` Carbuncle (L2), `#87` Displacer Beast (L4), `#89` Leucrotta (L4), `#94` Girallon (L5), `#95` Catoblepas (L5) |
| 5 | `ARACHNIDS` | **Spiders, Scorpions & Arachnids** | 4 | 3 | 1 | `#17` Giant Spider (L1), `#26` Ettercap (L3), `#55` Phase Spider (L5), `#77` Cave Scorpion* (L1, U) |
| 6 | `VERMIN_INSECTS` | **Giant Insects, Centipedes & Beetles** | 8 | 7 | 1 | `#2` Fire Beetle (L1), `#20` Giant Centipede* (L1, U), `#21` Giant Ant (L2), `#28` Ankheg (L3), `#30` Giant Wasp (L3), `#39` Stirge (L1), `#81` Phase Wasp (L3), `#84` Giant Mantis (L4) |
| 7 | `DANGEROUS_PLANTS` | **Carnivorous Plants & Fungal Horrors** | 6 | 6 | 0 | `#1` Assassin Vine (L3), `#40` Violet Fungus (L3), `#56` Yellow Musk Creeper (L2), `#62` Shambling Mound (L5), `#85` Vegepygmy (L1), `#96` Tendriculos (L4) |
| 8 | `DRAGONS_DRAKES` | **Drakes, Wyverns & Dragonkin** | 2 | 2 | 0 | `#5` Wyvern (L5), `#73` Forest Drake (L4) |
| 9 | `GOBLINOIDS` | **Goblinoids (Goblins, Hobgoblins & Bugbears)** | 4 | 4 | 0 | `#10` Goblin (L1), `#12` Hobgoblin (L1), `#22` Bugbear (L2), `#86` Hobgoblin Captain (L3) |
| 10 | `ORCS` | **Orcs** | 2 | 2 | 0 | `#48` Orc (L1), `#98` Orc Warchief (L5) |
| 11 | `GNOLLS` | **Gnolls** | 2 | 2 | 0 | `#18` Gnoll (L1), `#80` Gnoll Packmaster (L2) |
| 12 | `REPTILIAN_HUMANOIDS` | **Reptilian Humanoids (Kobolds, Lizardfolk & Troglodytes)** | 3 | 3 | 0 | `#9` Kobold (L1), `#14` Troglodyte (L1), `#16` Lizardfolk (L1) |
| 13 | `TROLLS` | **Trolls** | 1 | 1 | 0 | `#3` Troll (L5) |
| 14 | `GIANTS` | **Giants & Ogres** | 1 | 1 | 0 | `#29` Ogre (L3) |
| — | **SUBTOTAL (TIER 1 INITIAL 14)** | | **64** | **61** | **3** | |

### 4.2 Tier 2: Reserved / Advanced / Regional Families (`21` Total / `16` Surface / `5` Non-Surface)

| # | `monster_family` Key | Player-Facing UI Display Name | Total | Surface | Non-Surface | Reason for Reservation & Monster IDs (`*` = Non-Surface) |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 15 | `FEY` | **Fey (Mites & Spriggans)** | 2 | 2 | 0 | **Reserved per `OC-1` Option A** (already covered by Ranger passive *Natural Knowledge*). `#69` Mite (L1), `#82` Spriggan (L3). |
| 16 | `AMPHIBIAN_HUMANOIDS` | **Amphibian Marsh-Folk (Boggards & Grippli)** | 2 | 2 | 0 | **Reserved per `OC-1` Option A** (localized Swamp/River marsh-folk). `#23` Boggard (L2), `#74` Grippli Scout (L1). |
| 17 | `MONSTROUS_HUMANOIDS` | **Monstrous Humanoids (Harpies, Minotaurs, Gargoyles, Medusas & Hags)** | 9 | 7 | 2 | **Morphologically diverse cursed/hybrid humanoids; reserved for advanced lore.** `#32` Minotaur (L4), `#33` Yeti (L4), `#34` Gargoyle (L4), `#50` Harpy (L4), `#51` Doppelganger* (L3, T/U), `#53` Medusa (L5), `#63` Morlock* (L2, U), `#68` Sahuagin (L2, C/O/R — River surface), `#97` Green Hag (L5). |
| 18 | `ABERRATIONS` | **Aberrations & Eldritch Horrors** | 6 | 5 | 1 | **Unnatural dungeon/void horrors outside standard woodland tracking.** `#4` Otyugh (L4), `#7` Rust Monster (L3), `#49` Grick (L3), `#57` Choker* (L2, U), `#71` Carrion Crawler (L4), `#88` Gibbering Mouther (L5). |
| 19 | `SUBTERRANEAN_HUMANOIDS` | **Underdark Humanoids (Drow & Duergar)** | 2 | 0 | 2 | **100% Underground (`U` only); unreachable on surface map.** `#46` Duergar* (L1, U), `#47` Drow* (L1, U). |
| — | **SUBTOTAL (TIER 2 RESERVED)** | | **21** | **16** | **5** | |

### 4.3 Tier 3: Non-Selectable Mindless Matter & Strictly Forbidden Undead (`13` Total / `11` Surface / `2` Non-Surface)

| # | `monster_family` Key | Policy Status | Total | Surface | Non-Surface | Reason & Monster IDs (`*` = Non-Surface) |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 20 | `OOZES` | `NON_SELECTABLE` | 1 | 0 | 1 | **Mindless protoplasm (`U` only).** `#13` Gelatinous Cube* (L3, U). |
| 21 | `CONSTRUCTS` | `NON_SELECTABLE` | 1 | 1 | 0 | **Artificially animated metal (`1` monster).** `#72` Gorgon (L5). |
| 22 | `UNDEAD` | **`STRICTLY_FORBIDDEN`** | 11 | 10 | 1 | **Domain of Cleric (`Turn Undead` / `Sacred Knowledge`); forbidden by owner rule (`11` monsters, not `12`).** `#36` Mummy* (L5, U), `#37` Wight (L3), `#44` Ghoul (L1), `#54` Shadow (L3), `#60` Ghast (L2), `#61` Wraith (L5), `#79` Crawling Hand (L1), `#83` Skeletal Archer (L1), `#91` Zombie (L1), `#92` Skeleton (L1), `#93` Huecuva (L2). |
| — | **SUBTOTAL (TIER 3 NON-SELECTABLE / FORBIDDEN)** | | **13** | **11** | **2** | |
| — | **CANONICAL GRAND TOTAL (ALL 22 FAMILIES)** | | **98** | **88** | **10** | **Canonical surface definition includes River (`R`)**: `88` monsters have $\ge 1$ habitat in `{P, R, F, S, H, M, D, J}`; `10` monsters are strictly `{U, T}`. |

---

## 5. Canonical Verification of Surface Monster Counts (`88` vs. `87` vs. `86`)

Earlier documents across Phase 7A.2, Phase 7A.3, and initial Phase 7A.4 drafts cited three slightly different surface monster totals (`86`, `87`, and `88`). Here is the exact mathematical reconciliation and the **single locked canonical definition**:

| Surface Count | Non-Surface Count | Exact Terrain Set Used | Why This Number Appeared in Earlier Docs & Status |
| :---: | :---: | :--- | :--- |
| **`88` (CANONICAL)** | **`10`** | **Geographical Surface Biomes Including River (`R`):** `{P (Plains), R (River/Lake), F (Forest), S (Swamp), H (Hills), M (Mountains), D (Desert), J (Jungle)}` | **LOCKED CANONICAL DEFINITION:** River (`R` / `RIVER_LAKE`) is a surface terrain. Every monster with at least one habitat in `{P, R, F, S, H, M, D, J}` is classified as **Surface (`88` monsters)**, Including `#68 Sahuagin` (`["C", "O", "R"]`). Only the **10** strictly Underground/City (`{U, T}`) monsters (`#13`, `#15`, `#20`, `#36`, `#46`, `#47`, `#51`, `#57`, `#63`, `#77`) are Non-Surface. |
| **`87` (Retired)** | **`11`** | `{P, F, S, H, M, D}` (`R` excluded for `#68 Sahuagin`) | Appeared in the earlier Phase 7A.4 subtotal row because `#68 Sahuagin` (`["C", "O", "R"]`) was marked `Surf? = No` despite having `R` (River). Retired in favor of `88`. |
| **`86` (Map-Passable Metric Only)** | **`12`** | **Currently Passable Overworld Tiles on `001_seed_world.sql`:** `{F (Forest), S (Swamp), P (Plains), J (Jungle), H (Hills)}` | On the current `15×15` base world map (`db/seeds/001_seed_world.sql`), `RIVER_LAKE (R)` and `MOUNTAINS (M)` tiles currently have `is_passable = 0`, and `DESERT (D)` has `0` tiles. Thus **86 of 98** monsters currently spawn on walkable overworld tiles `{F, S, P, J, H}` (rising to **88** as soon as `RIVER_LAKE (R)` / `MOUNTAINS (M)` / `DESERT (D)` tiles are traversable). |

### The 10 Strictly Non-Surface Monsters (`habitats` Restricted to `{U, T}`)
1. `#13` Gelatinous Cube (`["U"]`) — `OOZES`
2. `#15` Darkmantle (`["U"]`) — `TERRESTRIAL_MAGICAL_BEASTS` (*Other Magical Beasts*)
3. `#20` Giant Centipede (`["U"]`) — `VERMIN_INSECTS`
4. `#36` Mummy (`["U"]`) — `UNDEAD`
5. `#46` Duergar (`["U"]`) — `SUBTERRANEAN_HUMANOIDS`
6. `#47` Drow (`["U"]`) — `SUBTERRANEAN_HUMANOIDS`
7. `#51` Doppelganger (`["T", "U"]`) — `MONSTROUS_HUMANOIDS`
8. `#57` Choker (`["U"]`) — `ABERRATIONS`
9. `#63` Morlock (`["U"]`) — `MONSTROUS_HUMANOIDS`
10. `#77` Cave Scorpion (`["U"]`) — `ARACHNIDS`

---

## 6. Complete 98-Monster Master Classification Table (`#1`–`#98`)

Every monster in the 98-monster roster is classified below (`98` total: **`88` Surface** across `{P, R, F, S, H, M, D, J}`, **`10` Non-Surface** restricted to `{U, T}`):

| ID | Monster Name | Lvl | Seed `creature_type` | Seed `subtype` | Habitats | Surf? | Phase 7A.4 `monster_family` | Ranger Tier |
| :---: | :--- | :---: | :--- | :--- | :--- | :---: | :--- | :--- |
| `#1` | Assassin Vine | 3 | Plant | `null` | `F, S` | Yes | `DANGEROUS_PLANTS` | Tier 1 (Initial 14) |
| `#2` | Fire Beetle | 1 | Vermin | `null` | `P, F, H, U` | Yes | `VERMIN_INSECTS` | Tier 1 (Initial 14) |
| `#3` | Troll | 5 | Humanoid | `giant` | `M, H, S, F` | Yes | `TROLLS` | Tier 1 (Initial 14) |
| `#4` | Otyugh | 4 | Aberration | `null` | `S, U` | Yes | `ABERRATIONS` | Tier 2 (Reserved) |
| `#5` | Wyvern | 5 | Dragon | `null` | `M, H` | Yes | `DRAGONS_DRAKES` | Tier 1 (Initial 14) |
| `#6` | Giant Frog | 1 | Animal | `null` | `S, R` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#7` | Rust Monster | 3 | Aberration | `null` | `H, M, U` | Yes | `ABERRATIONS` | Tier 2 (Reserved) |
| `#8` | Manticore | 5 | Magical Beast | `null` | `H, M, S` | Yes | `AVIAN_CHIMERAS` | Tier 1 (Initial 14) |
| `#9` | Kobold | 1 | Humanoid | `reptilian` | `F, H, M, U` | Yes | `REPTILIAN_HUMANOIDS` | Tier 1 (Initial 14) |
| `#10` | Goblin | 1 | Humanoid | `goblinoid` | `P, F, H, U` | Yes | `GOBLINOIDS` | Tier 1 (Initial 14) |
| `#11` | Wolf | 1 | Animal | `null` | `P, F, H` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#12` | Hobgoblin | 1 | Humanoid | `goblinoid` | `P, H, M, U` | Yes | `GOBLINOIDS` | Tier 1 (Initial 14) |
| `#13` | Gelatinous Cube | 3 | Ooze | `null` | `U` | **No** | `OOZES` | Tier 3 (Non-Selectable) |
| `#14` | Troglodyte | 1 | Humanoid | `reptilian` | `S, H, U` | Yes | `REPTILIAN_HUMANOIDS` | Tier 1 (Initial 14) |
| `#15` | Darkmantle | 1 | Magical Beast | `null` | `U` | **No** | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#16` | Lizardfolk | 1 | Humanoid | `reptilian` | `S, R` | Yes | `REPTILIAN_HUMANOIDS` | Tier 1 (Initial 14) |
| `#17` | Giant Spider | 1 | Vermin | `null` | `F, S, D, U` | Yes | `ARACHNIDS` | Tier 1 (Initial 14) |
| `#18` | Gnoll | 1 | Humanoid | `gnoll` | `P, H, D` | Yes | `GNOLLS` | Tier 1 (Initial 14) |
| `#19` | Boar | 2 | Animal | `null` | `F, P, H` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#20` | Giant Centipede | 1 | Vermin | `null` | `U` | **No** | `VERMIN_INSECTS` | Tier 1 (Initial 14) |
| `#21` | Giant Ant | 2 | Vermin | `null` | `P, F, H, D, U` | Yes | `VERMIN_INSECTS` | Tier 1 (Initial 14) |
| `#22` | Bugbear | 2 | Humanoid | `goblinoid` | `F, H, M, U` | Yes | `GOBLINOIDS` | Tier 1 (Initial 14) |
| `#23` | Boggard | 2 | Humanoid | `boggard` | `S, R` | Yes | `AMPHIBIAN_HUMANOIDS` | Tier 2 (Reserved) |
| `#24` | Death Dog | 2 | Magical Beast | `null` | `D, H` | Yes | `LUPINE_CANINE_BEASTS` | Tier 1 (Initial 14) |
| `#25` | Dire Bat | 2 | Animal | `null` | `F, H, M, U` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#26` | Ettercap | 3 | Aberration | `null` | `F, S, U` | Yes | `ARACHNIDS` | Tier 1 (Initial 14) |
| `#27` | Cockatrice | 3 | Magical Beast | `null` | `P, H` | Yes | `AVIAN_CHIMERAS` | Tier 1 (Initial 14) |
| `#28` | Ankheg | 3 | Magical Beast | `null` | `P, F, H` | Yes | `VERMIN_INSECTS` | Tier 1 (Initial 14) |
| `#29` | Ogre | 3 | Humanoid | `giant` | `H, M, F, S` | Yes | `GIANTS` | Tier 1 (Initial 14) |
| `#30` | Giant Wasp | 3 | Vermin | `null` | `F, P, H` | Yes | `VERMIN_INSECTS` | Tier 1 (Initial 14) |
| `#31` | Owlbear | 4 | Magical Beast | `null` | `F, H` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#32` | Minotaur | 4 | Monstrous Humanoid | `null` | `M, U` | Yes | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#33` | Yeti | 4 | Monstrous Humanoid | `cold` | `M` | Yes | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#34` | Gargoyle | 4 | Monstrous Humanoid | `earth` | `M, H, U` | Yes | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#35` | Basilisk | 5 | Magical Beast | `null` | `D, H` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#36` | Mummy | 5 | Undead | `null` | `U` | **No** | `UNDEAD` | **Forbidden** |
| `#37` | Wight | 3 | Undead | `null` | `H, P, U` | Yes | `UNDEAD` | **Forbidden** |
| `#38` | Winter Wolf | 5 | Magical Beast | `cold` | `F, M` | Yes | `LUPINE_CANINE_BEASTS` | Tier 1 (Initial 14) |
| `#39` | Stirge | 1 | Magical Beast | `null` | `S, F, U` | Yes | `VERMIN_INSECTS` | Tier 1 (Initial 14) |
| `#40` | Violet Fungus | 3 | Plant | `null` | `S, U` | Yes | `DANGEROUS_PLANTS` | Tier 1 (Initial 14) |
| `#41` | Black Bear | 3 | Animal | `null` | `F, H, M` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#42` | Crocodile | 2 | Animal | `null` | `S, R, C` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#43` | Constrictor Snake | 2 | Animal | `null` | `S, F, R` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#44` | Ghoul | 1 | Undead | `null` | `P, H, U` | Yes | `UNDEAD` | **Forbidden** |
| `#45` | Blink Dog | 2 | Magical Beast | `null` | `P, H` | Yes | `LUPINE_CANINE_BEASTS` | Tier 1 (Initial 14) |
| `#46` | Duergar | 1 | Humanoid | `dwarf` | `U` | **No** | `SUBTERRANEAN_HUMANOIDS` | Tier 2 (Reserved) |
| `#47` | Drow | 1 | Humanoid | `elf` | `U` | **No** | `SUBTERRANEAN_HUMANOIDS` | Tier 2 (Reserved) |
| `#48` | Orc | 1 | Humanoid | `orc` | `H, M, P, F, U` | Yes | `ORCS` | Tier 1 (Initial 14) |
| `#49` | Grick | 3 | Aberration | `null` | `M, H, U` | Yes | `ABERRATIONS` | Tier 2 (Reserved) |
| `#50` | Harpy | 4 | Monstrous Humanoid | `null` | `M, H, C, S` | Yes | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#51` | Doppelganger | 3 | Monstrous Humanoid | `shapechanger` | `T, U` | **No** | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#52` | Griffon | 4 | Magical Beast | `null` | `H, M` | Yes | `AVIAN_CHIMERAS` | Tier 1 (Initial 14) |
| `#53` | Medusa | 5 | Monstrous Humanoid | `null` | `D, S, U` | Yes | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#54` | Shadow | 3 | Undead | `incorporeal` | `F, S, U` | Yes | `UNDEAD` | **Forbidden** |
| `#55` | Phase Spider | 5 | Magical Beast | `null` | `F, S, H` | Yes | `ARACHNIDS` | Tier 1 (Initial 14) |
| `#56` | Yellow Musk Creeper | 2 | Plant | `null` | `S, F` | Yes | `DANGEROUS_PLANTS` | Tier 1 (Initial 14) |
| `#57` | Choker | 2 | Aberration | `null` | `U` | **No** | `ABERRATIONS` | Tier 2 (Reserved) |
| `#58` | Peryton | 4 | Magical Beast | `null` | `M, F` | Yes | `AVIAN_CHIMERAS` | Tier 1 (Initial 14) |
| `#59` | Dire Wolf | 3 | Animal | `null` | `F, H, M, P` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#60` | Ghast | 2 | Undead | `null` | `H, S, U` | Yes | `UNDEAD` | **Forbidden** |
| `#61` | Wraith | 5 | Undead | `incorporeal` | `F, S, U` | Yes | `UNDEAD` | **Forbidden** |
| `#62` | Shambling Mound | 5 | Plant | `null` | `S, F` | Yes | `DANGEROUS_PLANTS` | Tier 1 (Initial 14) |
| `#63` | Morlock | 2 | Monstrous Humanoid | `null` | `U` | **No** | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#64` | Wolverine | 2 | Animal | `null` | `F, H, M` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#65` | Giant Eagle | 3 | Animal | `null` | `M, H` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#66` | Krenshar | 1 | Magical Beast | `null` | `F, H` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#67` | Bunyip | 3 | Magical Beast | `aquatic` | `S, C` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#68` | Sahuagin | 2 | Monstrous Humanoid | `aquatic` | `C, O, R` | **Yes** (`R`) | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#69` | Mite | 1 | Fey | `null` | `F, H, S, U` | Yes | `FEY` | Tier 2 (Reserved) |
| `#70` | Dire Boar | 4 | Animal | `null` | `F, H, S` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#71` | Carrion Crawler | 4 | Aberration | `null` | `S, U` | Yes | `ABERRATIONS` | Tier 2 (Reserved) |
| `#72` | Gorgon | 5 | Construct | `null` | `P, H, M` | Yes | `CONSTRUCTS` | Tier 3 (Non-Selectable) |
| `#73` | Forest Drake | 4 | Dragon | `earth` | `F, H` | Yes | `DRAGONS_DRAKES` | Tier 1 (Initial 14) |
| `#74` | Grippli Scout | 1 | Humanoid | `grippli` | `S, F` | Yes | `AMPHIBIAN_HUMANOIDS` | Tier 2 (Reserved) |
| `#75` | Worg | 2 | Magical Beast | `null` | `F, P` | Yes | `LUPINE_CANINE_BEASTS` | Tier 1 (Initial 14) |
| `#76` | Hippogriff | 2 | Magical Beast | `null` | `H, M, P` | Yes | `AVIAN_CHIMERAS` | Tier 1 (Initial 14) |
| `#77` | Cave Scorpion | 1 | Vermin | `null` | `U` | **No** | `ARACHNIDS` | Tier 1 (Initial 14) |
| `#78` | Carbuncle | 2 | Magical Beast | `null` | `H, S` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#79` | Crawling Hand | 1 | Undead | `null` | `F, S, U` | Yes | `UNDEAD` | **Forbidden** |
| `#80` | Gnoll Packmaster | 2 | Humanoid | `gnoll` | `P, H, D` | Yes | `GNOLLS` | Tier 1 (Initial 14) |
| `#81` | Phase Wasp | 3 | Magical Beast | `null` | `F, H` | Yes | `VERMIN_INSECTS` | Tier 1 (Initial 14) |
| `#82` | Spriggan | 3 | Fey | `gnome` | `F, H, U` | Yes | `FEY` | Tier 2 (Reserved) |
| `#83` | Skeletal Archer | 1 | Undead | `null` | `P, H, U` | Yes | `UNDEAD` | **Forbidden** |
| `#84` | Giant Mantis | 4 | Vermin | `null` | `F, H` | Yes | `VERMIN_INSECTS` | Tier 1 (Initial 14) |
| `#85` | Vegepygmy | 1 | Plant | `null` | `F, S, U` | Yes | `DANGEROUS_PLANTS` | Tier 1 (Initial 14) |
| `#86` | Hobgoblin Captain | 3 | Humanoid | `goblinoid` | `P, H, M` | Yes | `GOBLINOIDS` | Tier 1 (Initial 14) |
| `#87` | Displacer Beast | 4 | Magical Beast | `null` | `F, H` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#88` | Gibbering Mouther | 5 | Aberration | `null` | `S, U` | Yes | `ABERRATIONS` | Tier 2 (Reserved) |
| `#89` | Leucrotta | 4 | Magical Beast | `null` | `H, F` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#90` | Grizzly Bear | 4 | Animal | `null` | `F, M` | Yes | `ANIMALS` | Tier 1 (Initial 14) |
| `#91` | Zombie | 1 | Undead | `null` | `P, S, U` | Yes | `UNDEAD` | **Forbidden** |
| `#92` | Skeleton | 1 | Undead | `null` | `D, H, P, U` | Yes | `UNDEAD` | **Forbidden** |
| `#93` | Huecuva | 2 | Undead | `null` | `D, H, U` | Yes | `UNDEAD` | **Forbidden** |
| `#94` | Girallon | 5 | Magical Beast | `null` | `F, M` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#95` | Catoblepas | 5 | Magical Beast | `null` | `S` | Yes | `TERRESTRIAL_MAGICAL_BEASTS` | Tier 1 (Initial 14) |
| `#96` | Tendriculos | 4 | Plant | `null` | `S, F` | Yes | `DANGEROUS_PLANTS` | Tier 1 (Initial 14) |
| `#97` | Green Hag | 5 | Monstrous Humanoid | `null` | `S, F` | Yes | `MONSTROUS_HUMANOIDS` | Tier 2 (Reserved) |
| `#98` | Orc Warchief | 5 | Humanoid | `orc` | `H, M, P` | Yes | `ORCS` | Tier 1 (Initial 14) |

---

## 7. Backward Compatibility for Existing Ranger Characters

In [`src/domain/character/rules.js:126–170`](../../../src/domain/character/rules.js#L126-L170), existing Rangers store:
- `favored_enemy_type` (e.g., `'Humanoid'`, `'Animal'`, `'Magical Beast'`, `'Plant'`, `'Vermin'`, `'Dragon'`, `'Aberration'`, `'Monstrous Humanoid'`, `'Fey'`)
- `favored_enemy_subtype` (e.g., `'goblinoid'`, `'reptilian'`, `'orc'`, `'gnoll'`, `'giant'`, or `null`)

### Phase 7B Implementation Rule for Seamless Legacy Support:
1. Keep `favored_enemy_type` and `favored_enemy_subtype` on `characters` and add `favored_enemy_family TEXT DEFAULT NULL` in `db/migrations/014_phase7b_taxonomy_attributes_and_battle_experience.sql`.
2. When evaluating `doesMonsterMatchFavoredEnemy(character, monster)`:
   - **New Rangers (`character.favored_enemy_family IS NOT NULL`):**
     - Match directly: `monster.monster_family === character.favored_enemy_family` (with hard guard `monster.monster_family !== 'UNDEAD'`).
   - **Legacy Rangers (`character.favored_enemy_family IS NULL`):**
     - Fall back to the existing `favored_enemy_type` + `favored_enemy_subtype` check so a legacy Ranger who picked `Magical Beast` continues to match all 3 Magical Beast families (`LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`).
