# DARKGRID — PHASE 7A.2: MONSTER KNOWLEDGE SYSTEM & 98-MONSTER CLASSIFICATION MATRIX

> [!IMPORTANT]
> **Historical Design Baseline (Superseded in Part by Phase 7A.3):** This Phase 7A.2 document is preserved as historical design context. While **Approved Option A (Automatic Class-Specific Monster Knowledge)** remains in force, the **7 blended Ranger Favored Enemy categories** in Section 2 and the habitat/monster counts in Section 3 have been superseded by the natural `monster_family` classification, corrected SQLite habitat audit (`86` surface / `12` non-surface), and **Battle Experience** system in [`../phase-7a3/PHASE-7A3-RANGER-FAMILIES.md`](../phase-7a3/PHASE-7A3-RANGER-FAMILIES.md), [`../phase-7a3/PHASE-7A3-BATTLE-EXPERIENCE.md`](../phase-7a3/PHASE-7A3-BATTLE-EXPERIENCE.md), and [`../phase-7a3/PHASE-7A3-WORLD-HABITATS.md`](../phase-7a3/PHASE-7A3-WORLD-HABITATS.md).

**Date:** 2026-10-22  
**Phase:** 7A.2 — Class Identity & Thematic Progression (Design & Documentation Only)  
**Baseline Verified Against:** `main` commit `042d122` (98 Seeded Monsters across `001_seed_world.sql` .. `010_seed_30_new_monsters.sql`)

---

## 1. Approved Option A: Automatic Class-Specific Monster Knowledge

The owner has explicitly approved **Option A**: **Automatic combat and discovery bonuses based on class-specific monster knowledge.**

### Core Operational Rules
1. **100% Automatic & Passive:** Bonuses apply automatically during encounter detection, investigation (`INVESTIGATE`), and combat (`ENGAGE` / `ATTACK` / `FLEE`).
2. **Zero Extra UI Clutter:** Requires **no** additional combat buttons, cooldown toggles, or manual "Activate Knowledge" actions.
3. **Numerically Hidden:** Players never see `+2 Attack vs Orc` or `+4 Damage vs Favored Enemy`. Instead, they experience richer encounter descriptions, clear warning cues, and atmospheric combat log lines confirming their expertise.
4. **Scales With Level:** Specialized mastery grows automatically across Levels 1–10 as specified in [`PHASE-7A2-CLASS-PROGRESSION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-CLASS-PROGRESSION.md).
5. **Reuses Existing Infrastructure:** Directly reuses the existing `descriptions` JSON keys (`1_distant`, `2_ranger_distant`, `3_close`, `4_ranger_close`, `5_health_100`..`9_dead`) already populated on **all 98 monsters** in the SQLite database, as well as [`src/domain/encounters/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js) (`resolveMonsterDescription`) and [`src/domain/combat/abilities.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/abilities.js) (`getMonsterAbilityProfile`).

---

## 2. General Knowledge vs. Specialized Mastery

Phase 7A.2 cleanly separates two related layers of monster expertise:

### 2.1 General Knowledge (Information, Behavior, Danger Signs, Weaknesses)
- **What It Does:** Determines whether the character recognizes a monster's tracks, silhouette, ambush habits, and special hazards (`poison`, `paralysis`, `acid_spit`, `petrification_gaze`, `incorporeal`, `regeneration`, `curse`) during encounter discovery and `INVESTIGATE`.
- **How It Reuses `resolveMonsterDescription` (`src/domain/encounters/engine.js`):**
  - Currently, `resolveMonsterDescription(descriptions, heroClass, encounterState)` only unlocks `2_ranger_distant` (Stage 1 detailed clue) and `4_ranger_close` (Stage 2 anatomical/tactical weakness clue) when `heroClass === 'RANGER'`.
  - Under Phase 7A.2, `resolveMonsterDescription` checks `hasClassGeneralKnowledge(character, monster)`:
    - **Fighter** unlocks `2_ranger_distant` and `4_ranger_close` for all **Martial, Humanoid, Giant, and Armed Monstrous Humanoid** foes (`FIGHTER_MARTIAL_EXPERTISE`).
    - **Ranger** unlocks `2_ranger_distant` and `4_ranger_close` for all **Natural & Wilderness Ecosystem** creatures (`Animal`, `Magical Beast`, `Vermin`, `Plant`, `Fey`, `Dragon`) **plus** their chosen **Favored Enemy**.
    - **Cleric** unlocks `2_ranger_distant` and `4_ranger_close` for all **Undead** (`creature_type = UNDEAD`) and curse/necromancy bearers (`Green Hag`).
    - *Backward Compatibility:* For `Assassin Vine` (`#1`, `Plant`), a Fighter still receives `1_distant` / `3_close` while a Ranger receives `2_ranger_distant` / `4_ranger_close`, preserving existing unit tests in `tests/encounter_engine.test.js`!

### 2.2 Specialized Mastery (Hidden Combat Advantages & Narrative Feedback)
- **What It Does:** Grants automatic offensive and defensive bonuses in combat against the class's specialized monster domain and emits a single atmospheric recognition line at the start of combat:
  - **Fighter vs. Martial/Humanoid/Giant (*Know Your Enemy*):**
    - *Combat Log Cue:* `"You recognize the familiar stance and weapon reach of this seasoned adversary."` (or subtype-specific: `"You recognize the familiar stance of a hardened orc warrior."`)
    - *Hidden Bonus:* `+1` Atk / `+1` AC (L1) → `+3` Atk / `+3` Dmg / `+2` AC (L9).
  - **Ranger vs. Favored Enemy (*Favored Enemy*):**
    - *Combat Log Cue:* `"Years of hunting this kind of creature give you a distinct advantage."`
    - *Hidden Bonus:* `+2` Atk / `+2` Dmg / `+1` AC (L1) → `+6` Atk / `+6` Dmg / `+3` AC + Expanded Crit (L10).
  - **Ranger vs. Non-Favored Natural Creature (*Hunter's Knowledge*):**
    - *Combat Log Cue:* `"Your familiarity with wilderness predators lets you read its movements."`
    - *Hidden Bonus:* `+1` Atk (L1) → `+2` Atk / `+2` Dmg / `+1` AC (L7). (Does not stack with *Favored Enemy*—if a creature is both Natural and the Ranger's Favored Enemy, the higher *Favored Enemy* bonus applies, plus `+1` instinct AC at L7+).
  - **Cleric vs. Undead (*Sacred Strike*, *Turn Undead*, *Holy Protection*):**
    - *Combat Log Cue:* `"Your sacred training reveals the weaknesses of this unholy creature as your faith wards your soul."`
    - *Hidden Bonus:* `+2` Atk / `+2` Dmg, `-1` Undead Atk, `+1` AC / `+2` Saves (L1) → `+6` Atk / `+9` Dmg, `2d6+WIS` opening disruption, `-3/-2` Undead Atk, `+3` AC / `DR 3/-` (L10).

---

## 3. Explicit Class Specialization Mappings

### 3.1 Fighter Monster Expertise (*Know Your Enemy*)
In Pathfinder data, relying solely on `creature_type = 'HUMANOID'` would miss `Minotaur`, `Yeti`, `Gargoyle`, `Harpy`, `Doppelganger`, `Sahuagin`, `Morlock`, and `Spriggan` (`Fey (gnome)` martial ambusher), while `Troll` and `Ogre` are `Humanoid (giant)`. Therefore, Fighter expertise uses an explicit, maintainable rule `isFighterMartialTarget(monster)`:

1. **All `creature_type = 'HUMANOID'` (17 monsters):**
   - Goblinoids: `Goblin` (`#10`), `Hobgoblin` (`#12`), `Bugbear` (`#22`), `Hobgoblin Captain` (`#86`)
   - Orcs: `Orc` (`#48`), `Orc Warchief` (`#98`)
   - Gnolls: `Gnoll` (`#18`), `Gnoll Packmaster` (`#80`)
   - Reptilian & Amphibian Warriors: `Kobold` (`#9`), `Troglodyte` (`#14`), `Lizardfolk` (`#16`), `Boggard` (`#23`), `Grippli Scout` (`#74`)
   - Giants (`creature_subtype = 'giant'`): `Ogre` (`#29`), `Troll` (`#3`)
   - Subterranean Martial Raiders: `Duergar` (`#46`), `Drow` (`#47`)
2. **Armed / Martial `MONSTROUS HUMANOID` & Giant-Kin Exceptions (8 monsters):**
   - `Minotaur` (`#32` — labyrinth greataxe brute), `Yeti` (`#33` — towering mountain giant-kin), `Gargoyle` (`#34` — fortress sentinel), `Harpy` (`#50` — armed aerial raider), `Doppelganger` (`#51` — humanoid infiltrator), `Morlock` (`#63` — club-wielding subterranean pack fighter), `Sahuagin` (`#68` — trident-wielding martial raider), and `Spriggan` (`#82` — `Fey (gnome)` size-shifting martial ambusher with morningstar and crossbow).
   - *Explicit Exclusion:* `Green Hag` (`#97`, `Monstrous Humanoid`) is an occult swamp witch whose threat is arcane/curse-based rather than martial formation combat; she is classified under occult/curse knowledge (Cleric secondary awareness) rather than Fighter martial expertise, though eligible under Ranger `Monstrous Humanoids`.

**Total Fighter Expertise Coverage:** **25 of 98 monsters** (`25.5%` of total roster; heavily represented across Plains, Hills, Forests, Swamps, and Ruins from Levels 1 to 5).

### 3.2 Ranger Favored Enemy Selection (Restored Single Choice at Creation)
To ensure **every** Favored Enemy choice at character creation has deep, meaningful encounter representation on the actual Darkgrid world map while preserving meaningful Humanoid subtype distinctions and the **strict ban on Undead**, Phase 7A.2 defines **7 curated Favored Enemy specializations** in `FAVORED_ENEMY_OPTIONS`:

| Favored Enemy Key | Player-Facing Title | Thematic Scope & Subtype Mapping | Seeded Roster Count | Surface Passable-Tile Representation | Level Span |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `HUMANOID_GOBLINOID_ORC` | **Goblinoids & Orc Raiders** | `Humanoid` with subtype `goblinoid` or `orc` (*Goblin, Hobgoblin, Bugbear, Hobgoblin Captain, Orc, Orc Warchief*) | **6** | **6 / 6 (100%)** — High density in Forests, Hills, Plains | L1–L5 |
| `HUMANOID_SAVAGE_GIANTS` | **Gnolls, Reptilians & Giants** | `Humanoid` with subtype `gnoll`, `reptilian`, `giant`, `boggard`, `grippli`, `duergar`, `drow` (*Kobold, Troglodyte, Lizardfolk, Gnoll, Gnoll Packmaster, Boggard, Grippli Scout, Ogre, Troll, Duergar, Drow*) | **11** | **9 / 11 (82%)** — High density in Swamps, Hills, Forests, Ruins | L1–L5 |
| `ANIMAL` | **Beasts & Predators (Animals)** | All `creature_type = 'ANIMAL'` (*Wolf, Hyena, Giant Frog, Dire Rat, Viper, Blood Hawk, Jungle Viper, Boar, Giant Bat, Giant Toad, Cheetah, Dire Boar*) | **12** | **12 / 12 (100%)** — Ubiquitous early-to-mid game across all biomes | L1–L4 |
| `MAGICAL_BEAST` | **Magical Beasts & Apex Monsters** | All `creature_type = 'MAGICAL BEAST'` (*Stirge, Krenshar, Darkmantle, Death Dog, Blink Dog, Worg, Hippogriff, Carbuncle, Cockatrice, Ankheg, Bunyip, Owlbear, Griffon, Peryton, Displacer Beast, Leucrotta, Manticore, Basilisk, Winter Wolf, Phase Spider, Girallon, Catoblepas*) | **22** | **19 / 22 (86%)** — Broadest mid-to-high level apex representation | L1–L5 |
| `VERMIN_PLANT` | **Arachnids, Vermin & Deadly Flora** | `creature_type IN ('VERMIN', 'PLANT')` (*Giant Spider, Giant Centipede, Bog Strider, Giant Crab, Giant Scorpion, Giant Mantis, Giant Stag Beetle, Vegepygmy, Yellow Musk Creeper, Phantom Fungus, Assassin Vine, Violet Fungus, Shambling Mound*) | **13** | **12 / 13 (92%)** — Dominant in Forests, Jungles, and Swamps | L1–L4 |
| `MONSTROUS_FEY_DRAGON` | **Monstrous Humanoids, Fey & Drakes** | `creature_type IN ('MONSTROUS HUMANOID', 'FEY', 'DRAGON')` (*Mite, Spriggan, Morlock, Sahuagin, Doppelganger, Minotaur, Yeti, Gargoyle, Harpy, Green Hag, Forest Drake, Wyvern*) | **12** | **9 / 12 (75%)** — Strong mid-to-late game danger curve | L1–L5 |
| `ABERRATION_OOZE_CONSTRUCT` | **Aberrations & Unnatural Horrors** | `creature_type IN ('ABERRATION', 'OOZE', 'CONSTRUCT')` (*Choker, Grick, Iron Cobra, Rust Monster, Ettercap, Will-o'-Wisp, Otyugh, Cloaker, Gibbering Mouther, Ochre Jelly*) | **10** | **8 / 10 (80%)** — Dangerous ambushers and gear/status hazards | L2–L5 |

> [!NOTE]
> **Backward Compatibility for Existing Ranger Save Records:** If an existing Ranger in SQLite already has a legacy `favored_enemy` string such as `'Humanoid (goblinoid)'`, `'Humanoid (orc)'`, `'Humanoid (gnoll)'`, `'Humanoid (reptilian)'`, `'Animal'`, `'Magical Beast'`, `'Vermin'`, `'Plant'`, `'Monstrous Humanoid'`, or `'Aberration'`, the matching helper `doesMonsterMatchFavoredEnemy(favoredEnemyValue, monster)` supports **both** the legacy exact strings and the curated Phase 7A.2 category keys without requiring any destructive character reset.

### 3.3 Cleric Monster Expertise (*Undead, Necromancy, and Curses*)
- **Full Specialization (`isClericUndeadTarget`):** All **12 `UNDEAD` monsters** (`#4 Ghoul`, `#11 Human Skeleton`, `#13 Human Zombie`, `#30 Shadow`, `#36 Mummy`, `#44 Skeletal Champion`, `#49 Wight`, `#56 Wraith`, `#61 Ghast`, `#73 Plague Zombie`, `#85 Draugr`, `#96 Barrow Wight`). All 12 (`100%`) are spawnable across the surface world and Under-Delve ruins!
- **Secondary Curse / Occult Awareness (General Knowledge & Save Protection Only):** Against living creatures that wield necromantic curses or death-magic (`#97 Green Hag` curse, `#24 Death Dog` disease, `#67 Bunyip` terrifying roar), the Cleric's *Undead Knowledge* / *Holy Protection* grants curse/disease warning recognition and save resistance, **without** granting *Sacred Strike* or *Turn Undead* combat damage bonuses.

---

## 4. Complete 98-Monster Classification Matrix

**Legend for Columns:**
- **Habitat Codes:** `F` Forest, `H` Hills, `P` Plains, `S` Swamp, `J` Jungle, `T` Town/Ruins, `U` Underground/Ruins (`(9,7)` in sandbox), `M` Mountains, `D` Desert, `C` Coast, `R` River, `O` Ocean, `A` Aquatic, `X` Planar.
- **Encounter Availability:**
  - `Surface Active (86)`: Spawns on standard passable surface biome tiles (`F, H, P, S, J, T`).
  - `Ruins/Under-Delve (10)`: Habitat `U` (spawns at Under-Delve `(9,7)` in sandbox; candidate for surface habitat expansion in Phase 7B).
  - `Biome-Restricted (2)`: Habitat `M/D` or `C/R/A` only (`#25 Giant Crab`, `#33 Yeti` uses `H` so `#33` is Surface Active; `#38 Winter Wolf` is `F` so Surface Active; `#25 Giant Crab` is `C,R,A` and `#68 Sahuagin` is `C,O,R` — those 2 are aquatic/coastal restricted).
- **Fighter Exp.:** `YES (Martial/Humanoid/Giant)` vs `—`
- **Ranger Nat. Know.:** `YES (Natural Ecosystem)` vs `Favored Only` vs `— (Cleric Domain)`

| ID | Monster Name | Creature Type | Subtype | Solo Lvl (CR) | Habitat | Fighter Expertise | Ranger Natural Knowledge | Ranger Favored Enemy Category | Cleric Undead Expertise | Encounter Availability | Special Abilities Relevant to Knowledge |
| :-: | :--- | :--- | :--- | :-: | :--- | :-: | :-: | :--- | :-: | :--- | :--- |
| 1 | **Assassin Vine** | Plant | — | L3 (3) | `F, J` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Camouflage ambush (`entangle_vine`, `constrict`), cold/fire vulnerability |
| 2 | **Wolf** | Animal | — | L1 (1) | `F, H, P` | — | **YES** | `ANIMAL` | — | Surface Active | Pack trip jaws (`trip_attack`), scent tracking |
| 3 | **Troll** | Humanoid | `giant` | L5 (5) | `M, S, U` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | `regeneration_acid_fire`, rending claws |
| 4 | **Ghoul** | Undead | — | L1 (1) | `U, P, S` | — | — | *Restricted (Undead)* | **YES** | Surface Active | `ghoul_paralysis` touch, carrion stench |
| 5 | **Giant Spider** | Vermin | — | L1 (1) | `F, J, S, U, D` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | `web_tangle`, `poison_bite` (STR damage) |
| 6 | **Choker** | Aberration | — | L2 (2) | `U, F` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Surface Active | Tentacle stranglehold (`constrict`), ceiling ambush |
| 7 | **Rust Monster** | Aberration | — | L3 (3) | `U, H` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Surface Active | `corrode_metal` antennae (degrades metal armor/weapons) |
| 8 | **Manticore** | Magical Beast | — | L5 (5) | `H, M, P, S, D` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `tail_spike_volley` ranged barrage, diving claws |
| 9 | **Kobold** | Humanoid | `reptilian` | L1 (0.25) | `U, F, H` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | Snare traps, cowardly pack skirmishing |
| 10 | **Goblin** | Humanoid | `goblinoid` | L1 (0.33) | `F, H, P, C` | **YES** | — | `HUMANOID_GOBLINOID_ORC` | — | Surface Active | Stealthy brush ambush, dogslicer strikes |
| 11 | **Human Skeleton** | Undead | — | L1 (0.33) | `U, P, H, S, F, T, D, C` | — | — | *Restricted (Undead)* | **YES** | Surface Active | `dr_bludgeoning` (resists slashing/piercing blades) |
| 12 | **Hobgoblin** | Humanoid | `goblinoid` | L1 (0.5) | `F, H, M, U` | **YES** | — | `HUMANOID_GOBLINOID_ORC` | — | Surface Active | Disciplined shield-and-longsword formation guard |
| 13 | **Human Zombie** | Undead | — | L1 (0.5) | `S, U, P, F, C` | — | — | *Restricted (Undead)* | **YES** | Surface Active | `staggered_lurch`, `dr_slashing` (resists blunt/piercing) |
| 14 | **Troglodyte** | Humanoid | `reptilian` | L1 (1) | `U, S` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | `sickening_stench` aura, club and claw savagery |
| 15 | **Darkmantle** | Magical Beast | — | L1 (1) | `U` | — | **YES** | `MAGICAL_BEAST` | — | Ruins/Under-Delve | Stalactite drop ambush, `darkness_shroud`, constrict |
| 16 | **Lizardfolk** | Humanoid | `reptilian` | L1 (1) | `S, R, C` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | Heavy wooden shield defense, morningstar + bite |
| 17 | **Hyena** | Animal | — | L1 (1) | `P, H, D` | — | **YES** | `ANIMAL` | — | Surface Active | `trip_attack` jaws, opportunistic scavenging |
| 18 | **Gnoll** | Humanoid | `gnoll` | L1 (1) | `D, P, H` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | Heavy spear and shield brutality |
| 19 | **Giant Frog** | Animal | — | L1 (1) | `S, R` | — | **YES** | `ANIMAL` | — | Surface Active | `sticky_tongue_grab` pull and swallow lunge |
| 20 | **Boar** | Animal | — | L2 (2) | `F, H, S` | — | **YES** | `ANIMAL` | — | Surface Active | `ferocity` (fights on when fatally wounded), gore tusks |
| 21 | **Yellow Musk Creeper** | Plant | — | L2 (2) | `J, S, F` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | `pollen_spray` mind-daze lure, bore tendrils |
| 22 | **Bugbear** | Humanoid | `goblinoid` | L2 (2) | `F, H, M, U` | **YES** | — | `HUMANOID_GOBLINOID_ORC` | — | Surface Active | Brutal ambush bonus damage, heavy morningstar |
| 23 | **Boggard** | Humanoid | `boggard` | L2 (2) | `S, R` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | `terrifying_croak`, sticky tongue, heavy warclub |
| 24 | **Death Dog** | Magical Beast | — | L2 (2) | `D, P, H` | — | **YES** | `MAGICAL_BEAST` | *Curse/Disease Save* | Surface Active | Two-headed double bite, `filth_rot` disease + trip |
| 25 | **Giant Crab** | Vermin | `aquatic` | L2 (2) | `C, R, A` | — | **YES** | `VERMIN_PLANT` | — | Biome-Restricted | Dual pincer `constrict` grapple, chitinous shell |
| 26 | **Ettercap** | Aberration | — | L3 (3) | `F, S, U` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Surface Active | `web_tangle` snares, venomous fangs |
| 27 | **Cockatrice** | Magical Beast | — | L3 (3) | `P, H, T` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `calcifying_peck` (progressive DEX stiffening/petrification) |
| 28 | **Ankheg** | Magical Beast | — | L3 (3) | `P, F, H` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | Burrow tremor ambush, `acid_spit` & acid mandibles |
| 29 | **Ogre** | Humanoid | `giant` | L3 (3) | `H, M, F` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | Massive greatclub reach and crushing overhead blows |
| 30 | **Shadow** | Undead | `incorporeal` | L3 (3) | `U, F, H, T` | — | — | *Restricted (Undead)* | **YES** | Surface Active | `incorporeal` evasion, `strength_drain` touch |
| 31 | **Owlbear** | Magical Beast | — | L4 (4) | `F, H` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | Dual claw + beak frenzy, crushing bear hug (`constrict`) |
| 32 | **Minotaur** | Monstrous Humanoid | — | L4 (4) | `U, H` | **YES** | — | `MONSTROUS_FEY_DRAGON` | — | Surface Active | `powerful_charge` gore + greataxe, unerring labyrinth sense |
| 33 | **Yeti** | Monstrous Humanoid | `cold` | L4 (4) | `M, H` | **YES** | — | `MONSTROUS_FEY_DRAGON` | — | Surface Active | `frightful_gaze`, freezing claws, fire vulnerability |
| 34 | **Gargoyle** | Monstrous Humanoid | `earth` | L4 (4) | `T, U, H, M, C` | **YES** | — | `MONSTROUS_FEY_DRAGON` | — | Surface Active | Stone statue ambush, `dr_magic` stone skin, 4-attack flurry |
| 35 | **Basilisk** | Magical Beast | — | L5 (5) | `D, H, F, U` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `petrifying_gaze` (requires averting eyes / high Fortitude) |
| 36 | **Mummy** | Undead | — | L5 (5) | `D, U` | — | — | *Restricted (Undead)* | **YES** | Ruins/Under-Delve | `despair_aura` paralysis, `mummy_rot` curse, fire vulnerability |
| 37 | **Ochre Jelly** | Ooze | — | L5 (5) | `U, S` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Surface Active | Acidic slam + `constrict`, splits/ignores slashing & lightning |
| 38 | **Winter Wolf** | Magical Beast | `cold` | L5 (5) | `F, M, H` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `frost_breath` cone, freezing bite + `trip_attack` |
| 39 | **Stirge** | Magical Beast | — | L1 (0.5) | `S, F, U` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | High touch accuracy latch, `blood_drain` CON sap |
| 40 | **Dire Rat** | Animal | — | L1 (0.33) | `T, U, S, F` | — | **YES** | `ANIMAL` | — | Surface Active | `filth_fever` disease bite |
| 41 | **Viper** | Animal | — | L1 (0.5) | `S, F, H, D` | — | **YES** | `ANIMAL` | — | Surface Active | Coiled grass ambush, `poison_bite` |
| 42 | **Giant Centipede** | Vermin | — | L1 (0.5) | `U, F, S` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Fast skittering strike, numbing `poison_bite` |
| 43 | **Iron Cobra** | Construct | — | L2 (2) | `U` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Ruins/Under-Delve | Metallic `dr_adamantine`, mechanical poison reservoir |
| 44 | **Skeletal Champion** | Undead | — | L2 (2) | `U, M` | — | — | *Restricted (Undead)* | **YES** | Ruins/Under-Delve | Breastplate & shield, martial longsword precision, `dr_bludgeoning` |
| 45 | **Blink Dog** | Magical Beast | — | L2 (2) | `F, P` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `blink_evasion` phase-shifting defense and flank bite |
| 46 | **Duergar** | Humanoid | `duergar` | L1 (0.33) | `U, M` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Ruins/Under-Delve | Enlarge/invisibility ambush, warhammer & heavy mail |
| 47 | **Drow** | Humanoid | `drow` | L1 (0.33) | `U` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Ruins/Under-Delve | `darkness_shroud`, sleep-poisoned hand crossbow bolts |
| 48 | **Orc** | Humanoid | `orc` | L1 (0.33) | `H, M, P` | **YES** | — | `HUMANOID_GOBLINOID_ORC` | — | Surface Active | `ferocity` (fights at 0 HP), heavy falchion cleaves |
| 49 | **Wight** | Undead | — | L3 (3) | `U, S` | — | — | *Restricted (Undead)* | **YES** | Surface Active | `energy_drain` slam (saps vitality and max health) |
| 50 | **Harpy** | Monstrous Humanoid | — | L4 (4) | `M, C, H` | **YES** | — | `MONSTROUS_FEY_DRAGON` | — | Surface Active | `captivating_song` lure, diving morningstar & talons |
| 51 | **Doppelganger** | Monstrous Humanoid | `shapechanger` | L3 (3) | `U, T` | **YES** | — | `MONSTROUS_FEY_DRAGON` | — | Surface Active | Mimicry deception, uncanny dodge, twin claw strikes |
| 52 | **Griffon** | Magical Beast | — | L4 (4) | `H, M` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | Diving pounce + rake talons |
| 53 | **Giant Scorpion** | Vermin | — | L3 (3) | `D, H, P` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Dual claw `constrict` + lethal `poison_sting` |
| 54 | **Cloaker** | Aberration | — | L5 (5) | `U` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Ruins/Under-Delve | Shadow-cloak ambush, `unnerving_moan`, engulf lash |
| 55 | **Phase Spider** | Magical Beast | — | L5 (5) | `U, X` | — | **YES** | `MAGICAL_BEAST` | — | Ruins/Under-Delve | `ethereal_ambush` phase strike + virulent `poison_bite` |
| 56 | **Wraith** | Undead | `incorporeal` | L5 (5) | `U, S` | — | — | *Restricted (Undead)* | **YES** | Surface Active | `incorporeal` evasion, `constitution_drain` touch |
| 57 | **Gibbering Mouther** | Aberration | — | L5 (5) | `U, S` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Surface Active | `gibbering_madness` confusion, acid spittle, engulf |
| 58 | **Peryton** | Magical Beast | — | L4 (4) | `H, M, F` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `shadow_mark` dread, flyby antler gore, `dr_magic` |
| 59 | **Giant Stag Beetle** | Vermin | — | L4 (4) | `F, J, H` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Heavy carapace AC, `trample` charge, crushing mandibles |
| 60 | **Vegepygmy** | Plant | — | L1 (0.5) | `J, F, S, U` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Mold camouflage, `dr_slashing_piercing` (vulnerable to blunt) |
| 61 | **Ghast** | Undead | — | L2 (2) | `U, S` | — | — | *Restricted (Undead)* | **YES** | Surface Active | `sickening_stench` aura + stronger `ghoul_paralysis` |
| 62 | **Giant Bat** | Animal | — | L2 (2) | `U, F, H, J` | — | **YES** | `ANIMAL` | — | Surface Active | Blindsense swoop attack, bleeding bite |
| 63 | **Morlock** | Monstrous Humanoid | — | L2 (2) | `U` | **YES** | — | `MONSTROUS_FEY_DRAGON` | — | Ruins/Under-Delve | Leap-attack ambush, swarming club strikes |
| 64 | **Violet Fungus** | Plant | — | L3 (3) | `U, S` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Four `rot_tentacles` (necrotic flesh-rot poison) |
| 65 | **Grick** | Aberration | — | L2 (2) | `U, H` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Surface Active | Rocky camouflage, 4-tentacle flurry + `dr_magic` hide |
| 66 | **Krenshar** | Magical Beast | — | L1 (1) | `F, H, P` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `scare_visage` (retracts facial skin to terrify prey) |
| 67 | **Bunyip** | Magical Beast | `aquatic` | L3 (3) | `S, C, O` | — | **YES** | `MAGICAL_BEAST` | *Roar Save* | Surface Active | `terrifying_roar`, `keen_scent` blood frenzy |
| 68 | **Sahuagin** | Monstrous Humanoid | `aquatic` | L2 (2) | `C, O, R` | **YES** | — | `MONSTROUS_FEY_DRAGON` | — | Biome-Restricted | Martial trident & net tactics, `blood_frenzy` |
| 69 | **Mite** | Fey | — | L1 (0.25) | `U, F, H` | — | **YES** | `MONSTROUS_FEY_DRAGON` | — | Surface Active | Minor `doom_hex`, dart and dagger ambushes |
| 70 | **Bog Strider** | Vermin | `aquatic` | L1 (0.5) | `S, R` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Water-skimming burst speed, piercing mandibles |
| 71 | **Blood Hawk** | Animal | — | L1 (0.5) | `F, H, P` | — | **YES** | `ANIMAL` | — | Surface Active | Diving talon strike, `bleed_talons` |
| 72 | **Jungle Viper** | Animal | — | L1 (0.5) | `J, S, F` | — | **YES** | `ANIMAL` | — | Surface Active | Canopy drop ambush, `poison_bite` |
| 73 | **Plague Zombie** | Undead | — | L1 (0.5) | `H, P, S` | — | — | *Restricted (Undead)* | **YES** | Surface Active | `zombie_rot` contagion burst on slam & death |
| 74 | **Grippli Scout** | Humanoid | `grippli` | L1 (0.5) | `J, S, F` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | Marsh camouflage, shortbow & net skirmishing |
| 75 | **Worg** | Magical Beast | — | L2 (2) | `F, P, H` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | Cunning pack stalker, `trip_attack` jaws |
| 76 | **Hippogriff** | Magical Beast | — | L2 (2) | `H, P` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | Aerial diving wing-buffet, claws and beak |
| 77 | **Giant Toad** | Animal | — | L2 (2) | `S, F, P` | — | **YES** | `ANIMAL` | — | Surface Active | Poisonous skin secretion, `sticky_tongue_grab` |
| 78 | **Carbuncle** | Magical Beast | — | L2 (1) | `F, H, S` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | Heavy armored shell, telepathic discord aura |
| 79 | **Phantom Fungus** | Plant | — | L2 (3) | `F, S` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | `natural_invisibility` ambush (reveals outline when struck) |
| 80 | **Gnoll Packmaster** | Humanoid | `gnoll` | L2 (2) | `P, H` | **YES** | — | `HUMANOID_SAVAGE_GIANTS` | — | Surface Active | Battleaxe & whip command, coordinated pack tactics |
| 81 | **Giant Mantis** | Vermin | — | L3 (3) | `F, J, H` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Foliage camouflage lunge, scythe-foreleg `constrict` |
| 82 | **Spriggan** | Fey | `gnome` | L3 (3) | `F, H` | **YES** | **YES** | `MONSTROUS_FEY_DRAGON` | — | Surface Active | `size_alteration` (shifts from small sneaker to giant brute), morningstar & crossbow |
| 83 | **Will-o'-Wisp** | Aberration | `air` | L3 (3) | `S, F` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Surface Active | Extreme touch evasion (`AC 20`), `electric_shock`, magic immunity |
| 84 | **Cheetah** | Animal | — | L3 (3) | `P, H` | — | **YES** | `ANIMAL` | — | Surface Active | `sprint_charge` pounce, bite + dual claw rake |
| 85 | **Draugr** | Undead | `water` | L3 (3) | `S, H, F` | — | — | *Restricted (Undead)* | **YES** | Surface Active | Greataxe sweep + `nauseating_mist` curse blow |
| 86 | **Hobgoblin Captain** | Humanoid | `goblinoid` | L3 (3) | `F, H, P` | **YES** | — | `HUMANOID_GOBLINOID_ORC` | — | Surface Active | Masterwork armor, disciplined double longsword strikes |
| 87 | **Displacer Beast** | Magical Beast | — | L4 (4) | `F, H` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `displacement_blur` (`50%` miss illusion), barbed tentacles |
| 88 | **Shambling Mound** | Plant | — | L4 (4) | `S, F` | — | **YES** | `VERMIN_PLANT` | — | Surface Active | Dual vine `constrict`, lightning absorption, fire/slash resistance |
| 89 | **Leucrotta** | Magical Beast | — | L4 (4) | `H, P, F` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | Voice mimicry lure, armor-shearing badger-jaw bite |
| 90 | **Dire Boar** | Animal | — | L4 (4) | `F, H, P` | — | **YES** | `ANIMAL` | — | Surface Active | Massive `ferocity` charge, armour-splitting tusks |
| 91 | **Forest Drake** | Dragon | `earth` | L4 (4) | `F, J` | — | **YES** | `MONSTROUS_FEY_DRAGON` | — | Surface Active | `acid_cloud_breath`, venomous tail slap |
| 92 | **Otyugh** | Aberration | — | L4 (4) | `S, T` | — | — | `ABERRATION_OOZE_CONSTRUCT` | — | Surface Active | Dual barbed tentacles (`constrict`) + `filth_fever` bite |
| 93 | **Wyvern** | Dragon | — | L5 (5) | `H, F` | — | **YES** | `MONSTROUS_FEY_DRAGON` | — | Surface Active | Aerial grab + lethal `wyvern_poison` tail sting |
| 94 | **Girallon** | Magical Beast | — | L5 (5) | `J, F` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | Four-armed claw `rend` frenzy |
| 95 | **Catoblepas** | Magical Beast | — | L5 (5) | `S` | — | **YES** | `MAGICAL_BEAST` | — | Surface Active | `noxious_breath` poison cloud, neck-snapping tail whip |
| 96 | **Barrow Wight** | Undead | — | L5 (5) | `P, H` | — | — | *Restricted (Undead)* | **YES** | Surface Active | Ancient barrow-blade + `energy_drain` life sap |
| 97 | **Green Hag** | Monstrous Humanoid | — | L5 (5) | `H, S, F` | — *(Occult)* | — | `MONSTROUS_FEY_DRAGON` | *Curse Save* | Surface Active | `weakening_touch` (STR sap), invisibility, mimicry |
| 98 | **Orc Warchief** | Humanoid | `orc` | L5 (5) | `F, H, P` | **YES** | — | `HUMANOID_GOBLINOID_ORC` | — | Surface Active | `war_cry` battle fury, `ferocity`, masterwork greataxe |

---

## 5. Ecological Coherence Summary Across All 98 Monsters

| Class / Domain | Total Eligible Monsters | Surface-Active Monsters | Why This Distribution Works |
| :--- | :---: | :---: | :--- |
| **Fighter (*Know Your Enemy*)** | **25 / 98** (`25.5%`) | **21 / 86** | Covers all organized humanoids, goblinoids, orcs, gnolls, reptilians, giants (`Ogre`, `Troll`), and martial monstrous humanoids—while Fighter's universal *Weapon/Armor Mastery* keeps them dominant against the remaining 73 monsters. |
| **Ranger (*Hunter's Knowledge*)** | **61 / 98** (`62.2%`) + Favored Enemy | **56 / 86** | Covers the entire natural wilderness (`Animal`, `Magical Beast`, `Vermin`, `Plant`, `Fey`, `Dragon`) with modest ecological bonuses, while the Ranger's **single chosen Favored Enemy** (`6` to `22` monsters) receives devastating apex bonuses. |
| **Cleric (*Undead Mastery*)** | **12 / 98** (`12.2%`) + 3 Curse/Affliction foes | **10 / 86** (+2 in Under-Delve) | Undead are among the deadliest special-hazard monsters in Darkgrid (`Shadow`, `Wight`, `Draugr`, `Mummy`, `Wraith`, `Barrow Wight`). Cleric dominates all 12 while relying on out-of-combat *Divine Self-Healing* to endure the other 86 monsters. |
