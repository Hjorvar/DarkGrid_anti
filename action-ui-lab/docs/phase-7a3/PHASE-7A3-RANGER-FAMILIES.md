# DARKGRID — PHASE 7A.3: RANGER NATURAL FAVORED ENEMY FAMILIES (`monster_family`)

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Status:** Authoritative Specification (Supersedes Blended Groupings in `PHASE-7A2-MONSTER-KNOWLEDGE.md`)

---

## 1. Rejection of Phase 7A.2 Blended Categories

Phase 7A.2 attempted to group the 98 monsters into 7 broad Favored Enemy buckets (`HUMANOID_SAVAGE_GIANTS` = *"Gnolls, Reptilians & Giants"*, `VERMIN_PLANT` = *"Arachnids, Vermin & Deadly Flora"*, `MONSTROUS_FEY_DRAGON` = *"Monstrous Humanoids, Fey & Drakes"*, etc.) to ensure every dropdown option contained at least 6–22 monsters.

**Phase 7A.3 permanently rejects artificial blended categories.**
- A Ranger who chooses to hunt **Gnolls** is a specialist in hyena-kin pack tactics, not automatically an expert on **Lizardfolk**, **Kobolds**, and **Trolls**.
- A Ranger who studies **Arachnids & Spiders** understands webs, venom sacs, and eight-legged ambushers (`Giant Spider`, `Ettercap`, `Giant Scorpion`, `Phase Spider`), not carnivorous vines (`Assassin Vine`) or fungal mounds (`Shambling Mound`).
- A family is permitted to contain only `1` or `2` monsters in the current 98-monster database (`TROLLS [1]`, `GIANTS [1]`, `ORCS [2]`, `GNOLLS [2]`, `DRAGONS_DRAKES [2]`, `FEY [2]`). Small families naturally grow as new monsters are added in future world expansions.

---

## 2. Architectural Separation: `monster_family` vs. Pathfinder `creature_type`

In the current SQLite schema ([`db/migrations/001_initial_schema.sql`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/db/migrations/001_initial_schema.sql)), each monster has a Pathfinder `creature_type` (`Animal`, `Magical Beast`, `Humanoid`, `Monstrous Humanoid`, `Vermin`, `Plant`, `Aberration`, `Fey`, `Dragon`, `Construct`, `Ooze`, `Undead`) and an optional `creature_subtype` (`goblinoid`, `orc`, `reptilian`, `gnoll`, `giant`, `boggard`, `grippli`, `drow`, `duergar`, `aquatic`, `cold`, `earth`, `air`, `water`, `gnome`, `shapechanger`, `incorporeal`).

Relying solely on `creature_type` + `creature_subtype` creates three structural problems:
1. **Split Biological Families Across Pathfinder Types:**
   - `#5 Giant Spider` (`Vermin`), `#53 Giant Scorpion` (`Vermin`), `#26 Ettercap` (`Aberration`), and `#55 Phase Spider` (`Magical Beast`) are all true arachnid/spider-kin predators, yet Pathfinder scatters them across three different `creature_type` values.
   - `#28 Ankheg` (`Magical Beast`) and `#39 Stirge` (`Magical Beast`) are biologically chitinous insectoid creatures closely akin to `Vermin`.
2. **Conflated `giant` Subtype:**
   - Pathfinder tags both `#3 Troll` and `#29 Ogre` as `Humanoid (giant)`, even though Trolls (regenerating, claw-and-rend marsh/mountain predators) and Ogres/Giants (weapon-wielding brute giants) represent distinct hunting traditions.
3. **Rigid Coupling:**
   - Tying Ranger Favored Enemy directly to Pathfinder `creature_type` prevents clean taxonomy updates when new monsters are seeded.

### Solution: Dedicated `monster_family` Column
Phase 7B will add a dedicated, non-null text column `monster_family` to the `monsters` table:
```sql
ALTER TABLE monsters ADD COLUMN monster_family TEXT NOT NULL DEFAULT 'MAGICAL_BEASTS';
CREATE INDEX IF NOT EXISTS idx_monsters_family ON monsters(monster_family);
```
Every monster in Darkgrid belongs to **exactly one** `monster_family` (1:1 mapping, zero overlap, zero double-counting).

---

## 3. Complete `monster_family` Taxonomy (20 Non-Overlapping Families Across 98 Monsters)

### 3.1 Summary of Families and Ranger Selection Eligibility

| `monster_family` Key | Player-Facing Family Name | Total Monsters (`98`) | Surface-Active (`86`) | Non-Surface (`12`) | Ranger Favored Enemy Eligibility |
|---|---|---:|---:|---:|---|
| `ANIMALS` | **Animals & Natural Beasts** | 12 | 12 | 0 | **Selectable (Core Wilderness)** |
| `MAGICAL_BEASTS` | **Magical Beasts & Chimeric Predators** | 19 | 18 | 1 (`#15`) | **Selectable (Core Wilderness)** *(see Note 1)* |
| `VERMIN_INSECTS` | **Vermin & Chitinous Insects** | 7 | 6 | 1 (`#25`) | **Selectable (Core Wilderness)** |
| `ARACHNIDS` | **Arachnids, Spiders & Scorpions** | 4 | 3 | 1 (`#55`) | **Selectable (Core Wilderness)** |
| `DANGEROUS_PLANTS` | **Dangerous Plants & Fungi** | 6 | 6 | 0 | **Selectable (Core Wilderness)** |
| `DRAGONS_DRAKES` | **Dragons & Drakes** | 2 | 2 | 0 | **Selectable (Core Wilderness)** |
| `FEY` | **Fey** | 2 | 2 | 0 | **Selectable (Core Wilderness)** |
| `GOBLINOIDS` | **Goblinoids** | 4 | 4 | 0 | **Selectable (Core Humanoid)** |
| `ORCS` | **Orcs** | 2 | 2 | 0 | **Selectable (Core Humanoid)** |
| `GNOLLS` | **Gnolls** | 2 | 2 | 0 | **Selectable (Core Humanoid)** |
| `REPTILIAN_HUMANOIDS` | **Reptilian Humanoids** | 3 | 3 | 0 | **Selectable (Core Humanoid)** |
| `AMPHIBIAN_HUMANOIDS` | **Amphibian & Bog Humanoids** | 2 | 2 | 0 | **Selectable (Core Humanoid)** |
| `TROLLS` | **Trolls** | 1 | 1 | 0 | **Selectable (Core Giant-Kin)** |
| `GIANTS` | **Giants & Ogres** | 1 | 1 | 0 | **Selectable (Core Giant-Kin)** |
| `MONSTROUS_HUMANOIDS` | **Monstrous Humanoids** | 8 | 5 | 3 (`#51,#63,#68`) | **Optional Selectable (Advanced)** |
| `ABERRATIONS` | **Aberrations** | 7 | 6 | 1 (`#54`) | **Optional Selectable (Advanced)** |
| `SUBTERRANEAN_HUMANOIDS`| **Subterranean Humanoids (Drow & Duergar)** | 2 | 0 | 2 (`#46,#47`) | **Future Unlock (Underdark Expansion)** |
| `OOZES` | **Oozes** | 1 | 1 | 0 | **Not Selectable** (Mindless amorphous protoplasm) |
| `CONSTRUCTS` | **Constructs** | 1 | 0 | 1 (`#43`) | **Not Selectable** (Mindless arcane automaton) |
| `UNDEAD` | **Undead** | 12 | 10 | 2 (`#36,#44`) | **STRICTLY FORBIDDEN** (Cleric Domain Only) |
| **TOTAL** | **All 20 Non-Overlapping Families** | **98** | **86** | **12** | **82 Selectable (`67` Core + `15` Optional) / `16` Excluded** |

> [!NOTE]
> **Note 1 — Optional Sub-Family Split for `MAGICAL_BEASTS` (`19`):** If the owner prefers finer ecological families instead of a single 19-monster `MAGICAL_BEASTS` choice, `MAGICAL_BEASTS` cleanly subdivides without overlap into:
> - `LUPINE_CANINE_BEASTS` (**Magical Hounds & Wolves** — `4`): `#24 Death Dog`, `#38 Winter Wolf`, `#45 Blink Dog`, `#75 Worg`.
> - `AVIAN_CHIMERAS` (**Winged Chimeras & Raptors** — `5`): `#8 Manticore`, `#27 Cockatrice`, `#52 Griffon`, `#58 Peryton`, `#76 Hippogriff`.
> - `MAGICAL_BEASTS` (**Terrestrial & Swamp Magical Beasts** — `10`): `#15 Darkmantle`, `#31 Owlbear`, `#35 Basilisk`, `#66 Krenshar`, `#67 Bunyip`, `#78 Carbuncle`, `#87 Displacer Beast`, `#89 Leucrotta`, `#94 Girallon`, `#95 Catoblepas`.

---

## 4. Interaction Between Class Specializations and `monster_family`

Separating `monster_family` from Pathfinder `creature_type` allows all three classes' passive Option A knowledge domains and Battle Experience to coexist without ambiguity or double-counting:

1. **Ranger — *Favored Enemy* (`character.favored_enemy` = chosen `monster_family`):**
   - Grants full **Favored Enemy** combat bonuses (`+2/+2` at L1 → `+3/+3` at L4 → `+4/+4` at L8 → `19–20` crit & `+2 AC` at L9) and **Stage 1 + Stage 2** automatic encounter knowledge against every monster whose `monster_family === character.favored_enemy`.
2. **Ranger — *Natural Knowledge* (Passive Wilderness Domain):**
   - Applies to all monsters in the `7` core natural ecology families (`ANIMALS [12]`, `MAGICAL_BEASTS [19]`, `VERMIN_INSECTS [7]`, `ARACHNIDS [4]`, `DANGEROUS_PLANTS [6]`, `DRAGONS_DRAKES [2]`, `FEY [2]` = **`52` monsters** by family, or **`51` monsters** by strict Pathfinder `Animal + Magical Beast + Vermin + Plant + Fey + Dragon` type where `#26 Ettercap` is `Aberration`).
   - **Recommended Rule:** Drive Ranger *Natural Knowledge* from the `7` natural `monster_family` values (`ANIMALS`, `MAGICAL_BEASTS`, `VERMIN_INSECTS`, `ARACHNIDS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `FEY` = **`52 / 98` monsters**, **`49 / 86` surface-active**), so that `#26 Ettercap` (a forest spider-kin web hunter) is included alongside `#5 Giant Spider` and `#55 Phase Spider`.
   - **No Double-Counting Rule:** If a Ranger selects a natural family (e.g., `ANIMALS`) as their **Favored Enemy**, they receive the **Favored Enemy** combat bonuses (`+2/+2` scaling to `+4/+4`), **not** both the Favored Enemy bonus and the smaller `+1` Natural Knowledge accuracy bonus.
3. **Fighter — *Know Your Enemy* (Passive Martial/Humanoid Domain):**
   - Applies to all `17` Pathfinder `Humanoid` monsters (`GOBLINOIDS [4]`, `ORCS [2]`, `GNOLLS [2]`, `REPTILIAN_HUMANOIDS [3]`, `AMPHIBIAN_HUMANOIDS [2]`, `TROLLS [1]`, `GIANTS [1]`, `SUBTERRANEAN_HUMANOIDS [2]`) plus the `8` `Monstrous Humanoid` / armed `Fey (gnome)` combatants (`#32 Minotaur`, `#33 Yeti`, `#34 Gargoyle`, `#50 Harpy`, `#51 Doppelganger`, `#63 Morlock`, `#68 Sahuagin`, `#82 Spriggan`, minus `#97 Green Hag` or including all `8` `MONSTROUS_HUMANOIDS` + `#82 Spriggan` = **`25`–`26` monsters**).
4. **Cleric — *Undead Knowledge* (Passive Sacred Domain):**
   - Applies exclusively to `monster_family === 'UNDEAD'` (**`12 / 98` monsters**, **`10 / 86` surface-active**).

---

## 5. Complete 98-Monster Family Classification Table

Every row below has been verified directly against the SQLite seed data (`002_seed_monsters.sql`, `003_seed_monsters_expansion.sql`, `006_seed_30_monsters.sql`) and `monster_terrains`.
- **Surface Active (`Yes` = 86 / `No` = 12):** Indicates whether the monster has at least one terrain in the 5 unsafe passable surface terrains of `001_seed_world.sql` (`FOREST [F]`, `HILLS [H]`, `PLAINS [P]`, `SWAMP [S]`, `JUNGLE [J]`).

| ID | Monster Name | Lvl | CR | Pathfinder `creature_type` | `creature_subtype` | Proposed `monster_family` | DB Habitats | Surface Active? | Kinship & Classification Rationale |
|---:|---|---:|---:|---|---|---|---|---|---|
| 1 | **Assassin Vine** | 3 | 3 | `Plant` | `—` | `DANGEROUS_PLANTS` | `F, J, S` | Yes | Carnivorous constricting flora native to forests and swamps. |
| 2 | **Wolf** | 1 | 1 | `Animal` | `—` | `ANIMALS` | `F, H, P` | Yes | Natural pack-hunting canine predator. |
| 3 | **Troll** | 5 | 5 | `Humanoid` | `giant` | `TROLLS` | `M, S, U` | Yes (`S`) | Regenerating claw-and-rend troll; distinct hunting lore from weapon-wielding ogres/giants. |
| 4 | **Ghoul** | 1 | 1 | `Undead` | `—` | `UNDEAD` | `P, S, U` | Yes (`P,S`) | Paralyzing corporeal undead; strictly Cleric domain (forbidden to Ranger). |
| 5 | **Giant Spider** | 1 | 1 | `Vermin` | `—` | `ARACHNIDS` | `F, J, S, U` | Yes | Web-spinning venomous arachnid predator. |
| 6 | **Choker** | 2 | 2 | `Aberration` | `—` | `ABERRATIONS` | `H, M, U` | Yes (`H`) | Tentacle-limbed subterranean/hill strangler aberration. |
| 7 | **Rust Monster** | 3 | 3 | `Aberration` | `—` | `ABERRATIONS` | `H, M, U` | Yes (`H`) | Metal-corroding subterranean/hill aberration. |
| 8 | **Manticore** | 5 | 5 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `H, M, P, S` | Yes | Spike-hurling winged chimeric apex predator. |
| 9 | **Kobold** | 1 | 0.25 | `Humanoid` | `reptilian` | `REPTILIAN_HUMANOIDS` | `F, H, U` | Yes (`F,H`) | Trap-setting scaled reptilian humanoid. |
| 10 | **Goblin** | 1 | 0.33 | `Humanoid` | `goblinoid` | `GOBLINOIDS` | `C, F, H, P` | Yes | Small goblinoid raider and ambusher. |
| 11 | **Human Skeleton** | 1 | 0.33 | `Undead` | `—` | `UNDEAD` | `C, D, F, H, P, S, T, U` | Yes | Animated skeletal warrior; Cleric domain only. |
| 12 | **Hobgoblin** | 1 | 0.5 | `Humanoid` | `goblinoid` | `GOBLINOIDS` | `F, H, M, U` | Yes (`F,H`) | Disciplined militaristic goblinoid soldier. |
| 13 | **Human Zombie** | 1 | 0.5 | `Undead` | `—` | `UNDEAD` | `C, F, P, S, U` | Yes | Shambling corpse; Cleric domain only. |
| 14 | **Troglodyte** | 1 | 1 | `Humanoid` | `reptilian` | `REPTILIAN_HUMANOIDS` | `S, U` | Yes (`S`) | Stench-emitting cave/swamp reptilian humanoid. |
| 15 | **Darkmantle** | 1 | 1 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `U` | **No** (`U`) | Stalactite-camouflaged subterranean magical beast. |
| 16 | **Lizardfolk** | 1 | 1 | `Humanoid` | `reptilian` | `REPTILIAN_HUMANOIDS` | `C, R, S` | Yes (`S`) | Tribal marsh-dwelling reptilian warrior. |
| 17 | **Hyena** | 1 | 1 | `Animal` | `—` | `ANIMALS` | `D, H, P` | Yes (`H,P`) | Natural bone-crushing scavenger/pack animal. |
| 18 | **Gnoll** | 1 | 1 | `Humanoid` | `gnoll` | `GNOLLS` | `D, H, P` | Yes (`H,P`) | Hyena-headed humanoid raider (`gnoll` family). |
| 19 | **Giant Frog** | 1 | 1 | `Animal` | `—` | `ANIMALS` | `A, R, S` | Yes (`S`) | Tongue-grappling wetland amphibian animal. |
| 20 | **Boar** | 2 | 2 | `Animal` | `—` | `ANIMALS` | `F, H, P` | Yes | Ferocious tusked woodland animal. |
| 21 | **Yellow Musk Creeper** | 2 | 2 | `Plant` | `—` | `DANGEROUS_PLANTS` | `F, J, U` | Yes (`F,J`) | Mind-numbing pollen vine plant. |
| 22 | **Bugbear** | 2 | 2 | `Humanoid` | `goblinoid` | `GOBLINOIDS` | `F, H, M, U` | Yes (`F,H`) | Hulking stealth-stalker of the goblinoid family. |
| 23 | **Boggard** | 2 | 2 | `Humanoid` | `boggard` | `AMPHIBIAN_HUMANOIDS` | `R, S` | Yes (`S`) | Terrifying croaking frog-humanoid of the marshes. |
| 24 | **Death Dog** | 2 | 2 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `D, P, U` | Yes (`P`) | Two-headed disease-biting magical hound. |
| 25 | **Giant Crab** | 2 | 2 | `Vermin` | `aquatic` | `VERMIN_INSECTS` | `A, C, R` | **No** (`A,C,R`) | Chitinous coastal/aquatic crustacean vermin. |
| 26 | **Ettercap** | 3 | 3 | `Aberration` | `—` | `ARACHNIDS` | `F, U` | Yes (`F`) | Spider-bellied web-trapper and venom hunter; grouped with `ARACHNIDS` by ecological kinship. |
| 27 | **Cockatrice** | 3 | 3 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `H, P` | Yes | Petrifying avian-reptilian magical beast. |
| 28 | **Ankheg** | 3 | 3 | `Magical Beast` | `—` | `VERMIN_INSECTS` | `D, F, P` | Yes (`F,P`) | Burrowing chitinous acid-spitting insectoid predator. |
| 29 | **Ogre** | 3 | 3 | `Humanoid` | `giant` | `GIANTS` | `F, H, M` | Yes (`F,H`) | Massive club-wielding true giant-kin brute. |
| 30 | **Shadow** | 3 | 3 | `Undead` | `incorporeal` | `UNDEAD` | `F, H, T, U` | Yes (`F,H`) | Strength-draining incorporeal undead; Cleric domain only. |
| 31 | **Owlbear** | 4 | 4 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, H` | Yes | Iconic forest chimeric apex predator. |
| 32 | **Minotaur** | 4 | 4 | `Monstrous Humanoid` | `—` | `MONSTROUS_HUMANOIDS` | `H, U` | Yes (`H`) | Bull-headed greataxe-wielding monstrous humanoid. |
| 33 | **Yeti** | 4 | 4 | `Monstrous Humanoid` | `cold` | `MONSTROUS_HUMANOIDS` | `H, M` | Yes (`H`) | Cold-adapted alpine monstrous humanoid. |
| 34 | **Gargoyle** | 4 | 4 | `Monstrous Humanoid` | `earth` | `MONSTROUS_HUMANOIDS` | `C, H, M, T, U` | Yes (`H`) | Stone-skinned winged monstrous humanoid ambusher. |
| 35 | **Basilisk** | 5 | 5 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `D, H, M, U` | Yes (`H`) | Eight-legged petrifying reptile magical beast. |
| 36 | **Mummy** | 5 | 5 | `Undead` | `—` | `UNDEAD` | `D, U` | **No** (`D,U`) | Tomb guardian undead; Cleric domain only. |
| 37 | **Ochre Jelly** | 5 | 5 | `Ooze` | `—` | `OOZES` | `S, U` | Yes (`S`) | Acidic protoplasmic ooze; non-selectable by Ranger. |
| 38 | **Winter Wolf** | 5 | 5 | `Magical Beast` | `cold` | `MAGICAL_BEASTS` | `F, H, M, P` | Yes | Frost-breathing giant magical wolf. |
| 39 | **Stirge** | 1 | 0.5 | `Magical Beast` | `—` | `VERMIN_INSECTS` | `F, S` | Yes | Blood-draining winged insectoid pest. |
| 40 | **Dire Rat** | 1 | 0.33 | `Animal` | `—` | `ANIMALS` | `S, T, U` | Yes (`S`) | Filth-fever carrying rodent animal. |
| 41 | **Viper** | 1 | 0.5 | `Animal` | `—` | `ANIMALS` | `F, J, S` | Yes | Venomous natural serpent. |
| 42 | **Giant Centipede** | 1 | 0.5 | `Vermin` | `—` | `VERMIN_INSECTS` | `F, H, U` | Yes (`F,H`) | Venomous multi-legged myriapod vermin. |
| 43 | **Iron Cobra** | 2 | 2 | `Construct` | `—` | `CONSTRUCTS` | `U` | **No** (`U`) | Mindless metallic serpent automaton; non-selectable by Ranger. |
| 44 | **Skeletal Champion** | 2 | 2 | `Undead` | `—` | `UNDEAD` | `M, U` | **No** (`M,U`) | Intelligent armored undead warrior; Cleric domain only. |
| 45 | **Blink Dog** | 2 | 2 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, P` | Yes | Phase-shifting plains/forest magical canine. |
| 46 | **Duergar** | 1 | 0.33 | `Humanoid` | `duergar` | `SUBTERRANEAN_HUMANOIDS` | `M, U` | **No** (`M,U`) | Deep-underground gray dwarf humanoid. |
| 47 | **Drow** | 1 | 0.33 | `Humanoid` | `drow` | `SUBTERRANEAN_HUMANOIDS` | `U` | **No** (`U`) | Subterranean dark elf humanoid. |
| 48 | **Orc** | 1 | 0.33 | `Humanoid` | `orc` | `ORCS` | `H, M, P` | Yes (`H,P`) | Ferocious falchion-wielding orc raider. |
| 49 | **Wight** | 3 | 3 | `Undead` | `—` | `UNDEAD` | `S, U` | Yes (`S`) | Life-draining barrow undead; Cleric domain only. |
| 50 | **Harpy** | 4 | 4 | `Monstrous Humanoid` | `—` | `MONSTROUS_HUMANOIDS` | `C, H, M` | Yes (`H`) | Winged siren monstrous humanoid. |
| 51 | **Doppelganger** | 3 | 3 | `Monstrous Humanoid` | `shapechanger` | `MONSTROUS_HUMANOIDS` | `T, U` | **No** (`T,U`)* | Shapechanging monstrous humanoid (`CITY` is `is_safe=1`, so spawns only in `U`). |
| 52 | **Griffon** | 4 | 4 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `H, M` | Yes (`H`) | Pouncing eagle-lion chimeric predator. |
| 53 | **Giant Scorpion** | 3 | 3 | `Vermin` | `—` | `ARACHNIDS` | `D, P, U` | Yes (`P`) | Armored pincer-and-sting arachnid predator. |
| 54 | **Cloaker** | 5 | 5 | `Aberration` | `—` | `ABERRATIONS` | `U` | **No** (`U`) | Deep-cavern shadow-ray aberration. |
| 55 | **Phase Spider** | 5 | 5 | `Magical Beast` | `—` | `ARACHNIDS` | `U, X` | **No** (`U,X`) | Ethereal-ambushing giant arachnid predator. |
| 56 | **Wraith** | 5 | 5 | `Undead` | `incorporeal` | `UNDEAD` | `S, U` | Yes (`S`) | Incorporeal dread spirit; Cleric domain only. |
| 57 | **Gibbering Mouther** | 5 | 5 | `Aberration` | `—` | `ABERRATIONS` | `S, U` | Yes (`S`) | Maddening multi-mouthed flesh aberration. |
| 58 | **Peryton** | 4 | 4 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, M` | Yes (`F`) | Stag-headed winged heart-hunter magical beast. |
| 59 | **Giant Stag Beetle** | 4 | 4 | `Vermin` | `—` | `VERMIN_INSECTS` | `F, J` | Yes | Heavy-carapace trample beetle insect. |
| 60 | **Vegepygmy** | 1 | 0.5 | `Plant` | `—` | `DANGEROUS_PLANTS` | `S, U` | Yes (`S`) | Mold-born tribal plant creature. |
| 61 | **Ghast** | 2 | 2 | `Undead` | `—` | `UNDEAD` | `S, U` | Yes (`S`) | Stench-shrouded elite ghoul; Cleric domain only. |
| 62 | **Giant Bat** | 2 | 2 | `Animal` | `—` | `ANIMALS` | `F, U` | Yes (`F`) | Echolocating nocturnal flying mammal animal. |
| 63 | **Morlock** | 2 | 2 | `Monstrous Humanoid` | `—` | `MONSTROUS_HUMANOIDS` | `U` | **No** (`U`) | Subterranean degenerate swarming monstrous humanoid. |
| 64 | **Violet Fungus** | 3 | 3 | `Plant` | `—` | `DANGEROUS_PLANTS` | `S, U` | Yes (`S`) | Flesh-rotting tentacled fungus plant. |
| 65 | **Grick** | 2 | 2 | `Aberration` | `—` | `ABERRATIONS` | `H, U` | Yes (`H`) | Rubber-skinned beak-and-tentacle worm aberration. |
| 66 | **Krenshar** | 1 | 1 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, P` | Yes | Skull-baring terrifying feline magical beast. |
| 67 | **Bunyip** | 3 | 3 | `Magical Beast` | `aquatic` | `MAGICAL_BEASTS` | `C, R, S` | Yes (`S`) | Roaring bleeding-bite marsh/aquatic magical beast. |
| 68 | **Sahuagin** | 2 | 2 | `Monstrous Humanoid` | `aquatic` | `MONSTROUS_HUMANOIDS` | `C, O, R` | **No** (`C,O,R`) | Blood-frenzied oceanic/coastal monstrous humanoid. |
| 69 | **Mite** | 1 | 0.25 | `Fey` | `—` | `FEY` | `F, H` | Yes | Spiteful vermin-whispering lesser fey trickster. |
| 70 | **Bog Strider** | 1 | 0.5 | `Vermin` | `aquatic` | `VERMIN_INSECTS` | `J, S` | Yes | Water-skimming marsh insect vermin. |
| 71 | **Blood Hawk** | 1 | 0.5 | `Animal` | `—` | `ANIMALS` | `F, H, P` | Yes | Razor-taloned raptor bird animal. |
| 72 | **Jungle Viper** | 1 | 0.5 | `Animal` | `—` | `ANIMALS` | `F, J, S` | Yes | Coiled canopy venomous snake animal. |
| 73 | **Plague Zombie** | 1 | 0.5 | `Undead` | `—` | `UNDEAD` | `H, P, S` | Yes | Contagious rotting undead; Cleric domain only. |
| 74 | **Grippli Scout** | 1 | 0.5 | `Humanoid` | `grippli` | `AMPHIBIAN_HUMANOIDS` | `F, J, S` | Yes | Agile tree-frog humanoid hunter of swamps and jungles. |
| 75 | **Worg** | 2 | 2 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, H, P` | Yes | Malevolent speaking dire-wolf magical beast. |
| 76 | **Hippogriff** | 2 | 2 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `H, P` | Yes | Eagle-horse winged diving magical beast. |
| 77 | **Giant Toad** | 2 | 2 | `Animal` | `—` | `ANIMALS` | `F, J, S` | Yes | Poison-skinned marsh amphibian animal. |
| 78 | **Carbuncle** | 2 | 2 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, H, J` | Yes | Gem-browed armored lizard magical beast. |
| 79 | **Phantom Fungus** | 2 | 2 | `Plant` | `—` | `DANGEROUS_PLANTS` | `F, S` | Yes | Translucent camouflage ambush fungus plant. |
| 80 | **Gnoll Packmaster** | 2 | 2 | `Humanoid` | `gnoll` | `GNOLLS` | `H, P` | Yes | Whip-cracking veteran gnoll leader. |
| 81 | **Giant Mantis** | 3 | 3 | `Vermin` | `—` | `VERMIN_INSECTS` | `F, J` | Yes | Camouflaged raptorial predatory insect. |
| 82 | **Spriggan** | 3 | 3 | `Fey` | `gnome` | `FEY` | `F, H` | Yes | Size-shifting malicious gnome fey. |
| 83 | **Will-o'-Wisp** | 3 | 3 | `Aberration` | `air` | `ABERRATIONS` | `F, S` | Yes | Shocking marsh-lantern aerial aberration. |
| 84 | **Cheetah** | 3 | 3 | `Animal` | `—` | `ANIMALS` | `H, P` | Yes | Blindingly fast sprint-pouncing big cat animal. |
| 85 | **Draugr** | 3 | 3 | `Undead` | `water` | `UNDEAD` | `F, H, S` | Yes | Barnacle-crusted drowned undead warrior; Cleric domain only. |
| 86 | **Hobgoblin Captain** | 3 | 3 | `Humanoid` | `goblinoid` | `GOBLINOIDS` | `F, H, P` | Yes | Heavily armored goblinoid war-leader. |
| 87 | **Displacer Beast** | 4 | 4 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, H, J` | Yes | Light-bending six-legged tentacled panther magical beast. |
| 88 | **Shambling Mound** | 4 | 4 | `Plant` | `—` | `DANGEROUS_PLANTS` | `F, J, S` | Yes | Towering lightning-forged swamp vegetation behemoth. |
| 89 | **Leucrotta** | 4 | 4 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, H, P` | Yes | Voice-mimicking bone-crushing jawed magical beast. |
| 90 | **Dire Boar** | 4 | 4 | `Animal` | `—` | `ANIMALS` | `F, H, P` | Yes | Prehistoric-sized furious tusker animal. |
| 91 | **Forest Drake** | 4 | 4 | `Dragon` | `earth` | `DRAGONS_DRAKES` | `F, H, J` | Yes | Acid-spitting lesser green dragon-kin drake. |
| 92 | **Otyugh** | 4 | 4 | `Aberration` | `—` | `ABERRATIONS` | `H, S` | Yes | Three-legged filth-dwelling tentacle aberration. |
| 93 | **Wyvern** | 5 | 5 | `Dragon` | `—` | `DRAGONS_DRAKES` | `F, H, P` | Yes | Deadly venom-tailed winged dragon-kin predator. |
| 94 | **Girallon** | 5 | 5 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `F, H, J` | Yes | Four-armed white jungle ape magical beast. |
| 95 | **Catoblepas** | 5 | 5 | `Magical Beast` | `—` | `MAGICAL_BEASTS` | `P, S` | Yes | Foul-breathed bloated swamp magical beast. |
| 96 | **Barrow Wight** | 5 | 5 | `Undead` | `—` | `UNDEAD` | `H, P` | Yes | Ancient frost-blade tomb king undead; Cleric domain only. |
| 97 | **Green Hag** | 5 | 5 | `Monstrous Humanoid` | `—` | `MONSTROUS_HUMANOIDS` | `F, H, S` | Yes | Curse-weaving swamp crone monstrous humanoid. |
| 98 | **Orc Warchief** | 5 | 5 | `Humanoid` | `orc` | `ORCS` | `F, H, P` | Yes | Brutal greataxe-wielding apex orc warlord. |

---

## 6. Rules for Assigning `monster_family` to Future Monsters

Whenever new monsters are added to Darkgrid in future expansions:
1. **`monster_family` Is Mandatory in Seed Validation:** Every monster seed must explicitly declare a valid `monster_family` constant from `src/config/index.js` (`MONSTER_FAMILIES`).
2. **Biological & Ecological Kinship Takes Precedence Over Pathfinder Type:**
   - Spiders, scorpions, and spider-hybrids (`Drider`, `Giant Tarantula`) belong to `ARACHNIDS` regardless of whether Pathfinder labels them `Vermin`, `Magical Beast`, or `Aberration`.
   - Beetles, ants, wasps, centipedes, and chitinous burrowing insects (`Carrion Crawler`, `Giant Wasp`) belong to `VERMIN_INSECTS`.
   - True dragons, drakes, wyverns, and linnorms belong to `DRAGONS_DRAKES`.
   - Regenerating troll-kin (`Ice Troll`, `Moss Troll`, `Rock Troll`) belong to `TROLLS`.
   - True giants and ogre-kin (`Hill Giant`, `Stone Giant`, `Frost Giant`, `Ettin`, `Ogre Mage`) belong to `GIANTS`.
3. **New Family Creation Rule:** If a future biome introduces a genuinely new lineage (e.g., `ELEMENTALS`, `DEMONS_FIENDS`), add a new `monster_family` key rather than stuffing them into an existing family.
4. **Undead Invariant:** Any monster with `creature_type = 'Undead'` must have `monster_family = 'UNDEAD'` and is automatically excluded from Ranger Favored Enemy selection.

---

## 7. Legacy Save Compatibility (Zero Data Loss Migration)

Existing Ranger characters in SQLite (`characters.favored_enemy`) may hold legacy Pathfinder `creature_type` strings (`'Animal'`, `'Magical Beast'`, `'Humanoid'`, `'Monstrous Humanoid'`, `'Vermin'`, `'Plant'`, `'Aberration'`, `'Undead'`) or `NULL`.

To guarantee **zero data loss and zero broken characters** when upgrading to Phase 7B:

### 7.1 Non-Destructive Resolver (`doesMonsterMatchFavoredEnemy(monster, favoredEnemyValue)`)
`src/domain/character/rules.js` will normalize `favoredEnemyValue` through a deterministic compatibility map:

| Legacy Stored `characters.favored_enemy` | Phase 7B Runtime Resolution & Migration Rule |
|---|---|
| Exact `monster_family` key (e.g., `'GOBLINOIDS'`, `'ANIMALS'`, `'ARACHNIDS'`) | Matches `monster.monster_family === favoredEnemyValue`. |
| `'Animal'` | Maps directly to `monster_family === 'ANIMALS'`. |
| `'Magical Beast'` | Maps directly to `monster_family === 'MAGICAL_BEASTS'`. |
| `'Plant'` | Maps directly to `monster_family === 'DANGEROUS_PLANTS'`. |
| `'Fey'` | Maps directly to `monster_family === 'FEY'`. |
| `'Dragon'` | Maps directly to `monster_family === 'DRAGONS_DRAKES'`. |
| `'Vermin'` | Matches `monster_family IN ('VERMIN_INSECTS', 'ARACHNIDS')` OR `monster.creature_type === 'Vermin'` so legacy Vermin Rangers do not lose Giant Spider/Scorpion coverage, while prompting a one-time free specialization refinement to `ARACHNIDS` or `VERMIN_INSECTS`. |
| `'Humanoid'` | Legacy broad `'Humanoid'` matches `monster.creature_type === 'Humanoid'` until the player selects a specific humanoid family (`GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `AMPHIBIAN_HUMANOIDS`, `TROLLS`, `GIANTS`) via a non-destructive one-time town sanctuary choice (defaulting to `'GOBLINOIDS'` if migrated automatically). |
| `'Monstrous Humanoid'` | Maps directly to `monster_family === 'MONSTROUS_HUMANOIDS'`. |
| `'Aberration'` | Maps directly to `monster_family === 'ABERRATIONS'`. |
| `'Undead'` *(Forbidden Legacy Value)* | **Never** deleted or crashed: migrated on load to `'GOBLINOIDS'` (or `'ANIMALS'`) and flagged with a one-time free Favored Enemy re-selection token in Oakhaven Sanctuary (`favored_enemy_respec_available = 1`). |
