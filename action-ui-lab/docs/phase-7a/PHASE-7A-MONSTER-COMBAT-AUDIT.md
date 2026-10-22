# DARKGRID — PHASE 7A: MONSTER DATABASE & COMBAT MATHEMATICS AUDIT

## 1. Monster Database Inventory & Structural Audit

### 1.1 Verified Bestiary Overview (`db/seeds/002..010`)
Inspection of the live schema (`db/migrations/001..013`) and all 10 seed files (`db/seeds/001..010`) confirms **98 monsters** (`68` core Pathfinder 1e monsters + `30` expansion monsters added in `010_seed_night_work_loot_and_30_monsters.sql`).

| `solo_level` | Monster Count | CR Range | HP Range (Mean) | AC Range (Mean) | Attack Bonus Range (Mean) | Avg Base Damage / Hit | Initiative Range (Mean) | XP Reward Range (Mean) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Level 1** | 29 | `0.25 – 1.0` | `3 – 12` (`6.8`) | `12 – 18` (`14.6`) | `+0 – +7` (`+2.5`) | `3.84` | `-1 – +6` (`+1.9`) | `100 – 400` (`248.6`) |
| **Level 2** | 21 | `2.0` | `11 – 20` (`15.2`) | `14 – 21` (`15.5`) | `+3 – +7` (`+4.5`) | `5.88` | `+0 – +8` (`+2.3`) | `600` (`600.0`) |
| **Level 3** | 18 | `3.0` | `14 – 28` (`21.4`) | `15 – 18` (`16.0`) | `+4 – +7` (`+5.8`) | `6.75` | `-2 – +7` (`+2.2`) | `800` (`800.0`) |
| **Level 4** | 14 | `4.0` | `29 – 35` (`32.6`) | `14 – 17` (`16.4`) | `+7 – +9` (`+7.8`) | `9.29` | `-1 – +7` (`+1.7`) | `1,200` (`1,200.0`) |
| **Level 5** | 16 | `5.0` | `34 – 47` (`41.2`) | `9 – 20` (`17.3`) | `+5 – +14` (`+8.8`) | `9.47` | `-5 – +8` (`+2.8`) | `1,600` (`1,600.0`) |
| **Levels 6–10** | **0** | — | — | — | — | — | — | — |
| **Total** | **98** | `0.25 – 5.0` | `3 – 47` | `9 – 21` | `+0 – +14` | `3.84 – 9.47` | `-5 – +8` | `100 – 1,600` |

### 1.2 Creature Type & Subtype Distribution (`monsters.creature_type`, `creature_subtype`)
- **Magical Beast:** 22 (`20` no subtype, `1` aquatic *Bunyip*, `1` cold *Winter Wolf*)
- **Humanoid:** 16 (`4` goblinoid, `3` reptilian, `2` giant, `2` gnoll, `2` orc, `1` boggard, `1` drow, `1` duergar, `1` grippli)
- **Animal:** 12
- **Undead:** 12 (`9` standard, `2` incorporeal *Shadow* & *Wraith*, `1` water *Draugr*)
- **Aberration:** 8 (`7` standard, `1` air *Will-o'-Wisp*)
- **Monstrous Humanoid:** 8 (`4` standard, `1` aquatic *Sahuagin*, `1` cold *Yeti*, `1` earth *Gargoyle*, `1` shapechanger *Doppelganger*)
- **Vermin:** 7 (`5` standard, `2` aquatic *Bog Strider* & *Giant Crab*)
- **Plant:** 6
- **Dragon:** 2 (*Forest Drake* [earth], *Wyvern*)
- **Fey:** 2 (*Mite*, *Spriggan* [gnome])
- **Construct:** 1 (*Iron Cobra*)
- **Ooze:** 1 (*Ochre Jelly*)

---

## 2. Critical Monster & Encounter Generation Bugs (Verified)

### 2.1 12 Monsters (12.2% of Bestiary) Are Unreachable on the 15x15 Map
`selectMonsterForTile(db, terrain, characterLevel)` (`src/domain/encounters/engine.js:67-76`) queries `monster_terrains` matching `map_tiles.terrain`. However, the 15x15 world map (`db/seeds/001_seed_world.sql`) only has passable unsafe tiles (`is_passable = 1 AND is_safe = 0`) for **5 terrains**: `FOREST` (38), `SWAMP` (35), `HILLS` (27), `JUNGLE` (27), `PLAINS` (26), plus 1 `BRIDGE` tile `(8,7)`.
- Because `UNDERGROUND_RUINS` (`U`), `MOUNTAINS` (`M`), `DESERT` (`D`), `COAST` (`C`), `OCEAN` (`O`), `RIVER_LAKE` (`R`), `AQUATIC` (`A`), and `EXTRAPLANAR` (`X`) have **0 passable unsafe tiles**, and `CITY` (`T`) is safe (`is_safe = 1`), the following **12 monsters can NEVER spawn anywhere in the game**:
  1. **Darkmantle** (`id: 15`, L1, CR 1, `["U"]`)
  2. **Drow** (`id: 47`, L1, CR 0.33, `["U"]`)
  3. **Duergar** (`id: 46`, L1, CR 0.33, `["U", "M"]`)
  4. **Giant Crab** (`id: 25`, L2, CR 2, `["C", "R", "A"]`)
  5. **Iron Cobra** (`id: 43`, L2, CR 2, `["U"]` — the **only** `Construct` in the game!)
  6. **Morlock** (`id: 63`, L2, CR 2, `["U"]`)
  7. **Sahuagin** (`id: 68`, L2, CR 2, `["C", "O", "R"]`)
  8. **Skeletal Champion** (`id: 44`, L2, CR 2, `["U", "M"]`)
  9. **Doppelganger** (`id: 51`, L3, CR 3, `["U", "T"]`)
  10. **Cloaker** (`id: 54`, L5, CR 5, `["U"]`)
  11. **Mummy** (`id: 36`, L5, CR 5, `["D", "U"]`)
  12. **Phase Spider** (`id: 55`, L5, CR 5, `["U", "X"]`)
- Conversely, **The Old Stone Bridge `(8,7)`** has `terrain = 'BRIDGE'`, which has **0 rows** in `monster_terrains`, so random encounters on the bridge always fail to select a monster (`selectMonsterForTile` returns `null`).

### 2.2 Hardcoded `switch (name)` in `src/domain/combat/abilities.js`
- `monsters.special_abilities` in SQLite stores JSON arrays (e.g., `["paralysis", "ghoul_fever"]`), but `src/domain/combat/abilities.js:272-1200` (`resolveMonsterSpecialAbility`) **never reads `monster.special_abilities`**! Instead, it switches on `monster.name.trim().toLowerCase()`.
- Furthermore, while monster attacks occur once per round (`executeMonsterTurn` in `src/domain/combat/engine.js:694-872`), many monsters in `abilities.js` trigger bonus damage (`rend`, `constrict`, `sneak_attack`, `rake`, `powerful_charge`, `four_arm_rend`, `brutal_cleave`) or pre-attack / non-attack round abilities (`spike_volley`, `spit_acid`, `breath_weapon_cold`, `poison_breath`, `shock_touch`, `captivating_song`, `petrifying_gaze`, `gibbering`) that drastically increase their effective DPR beyond their base `damage_dice`.

### 2.3 Visual Size vs. Combat Strength Separation (`action-ui-lab/monster-size-catalog.js`)
- In `action-ui-lab/monster-size-catalog.js` and `action-ui-lab/server/services/monster-profile-service.js`, monsters are assigned Pathfinder size categories (`TINY`, `SMALL`, `MEDIUM`, `LARGE`, `HUGE`) and visual scale factors (`proposedScaleFactor` from `0.42` for *Stirge* to `1.35` for *Wyvern* / *Manticore*) purely for 2D cutout staging in the viewport.
- **Verified Fact:** Visual size does **not** directly alter combat math in `src/domain/combat/`, except insofar as Pathfinder 1e stat blocks already bake size modifiers into each monster's `armor_class`, `attack_bonus`, and `damage_dice`.
- **Deceptive Danger Outliers (Small/Medium Monsters with Lethal Mechanics):**
  - *Stirge* (`TINY`, L1, 4 HP): Has **`+7` Attack Bonus** (highest in Level 1!) and attaches to drain `2 HP` automatically every round (`abilities.js`).
  - *Choker* (`SMALL`, L2, 12 HP): Has `+6` Attack, `+6` Initiative, `17 AC`, and *Constrict + Strangle* (`abilities.js`).
  - *Will-o'-Wisp* (`SMALL`, L3, 18 HP): Has `18 AC`, `+7` Initiative, *Natural Invisibility* (`20%` hero miss chance), and unerring `2d4` shock touch.
  - *Cockatrice* (`SMALL`, L3, 20 HP): Inflicts *Petrification* stacking DEX/AC penalties and stun.
  - *Shadow* & *Wraith* (`MEDIUM` Incorporeal, L3 / L5): `50%` miss chance against all mundane weapons (and even magical weapons take `25%` miss chance unless Cleric *Holy Radiance* is active, `abilities.js:235-256`).

---

## 3. Proposed 5-Tier Explicit Monster Difficulty Classification

Currently, monsters only have `solo_level` (`1..5`) and `challenge_rating` (`0.25..5.0`). Within the same `solo_level`, monsters vary wildly in lethality (e.g., at Level 3, *Violet Fungus* has `+4 Atk, 1d4+1 Dmg, 15 AC` while *Ogre* has `+7 Atk, 2d8+7 Dmg [16.0 avg!], 17 AC` and *Assassin Vine* has `+7 Atk, 1d8+7 Dmg [11.5 avg] + Entangle + Constrict`).

We propose classifying every encounter relative to the hero's level ($L_h$) and monster's intrinsic threat tier into **5 explicit difficulty categories**:

| Difficulty Category | Relative Level / Role | Target Hero Win Rate | Expected HP Loss (% of Max HP) | Expected Duration | Resource Expectation | Representative Examples (at Relevant Tier) |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| **1. `TRIVIAL`** | $L_m \le L_h - 2$ or CR $\le 0.33$ fodder | **> 98%** | `0% – 10%` | `1 – 2` rounds | 0 potions; fast confidence-building kills | *Kobold*, *Mite*, *Dire Rat*, *Human Skeleton* (vs L1–2 Hero) |
| **2. `STANDARD`** | $L_m = L_h$ baseline fauna/raiders | **85% – 93%** | `15% – 30%` | `2.5 – 4.5` rounds | Sustainable across 3–4 consecutive fights before resting/healing | *Goblin*, *Hobgoblin*, *Wolf*, *Boar*, *Giant Mantis*, *Griffon* |
| **3. `DANGEROUS`** | $L_m = L_h$ high-spike or status specialist, or $L_m = L_h + 1$ | **65% – 80%** | `35% – 55%` | `4 – 6` rounds | Requires 1 potion or class cooldown; real risk if entered below 70% HP | *Ghoul* (Paralysis), *Stirge* (Attach), *Bugbear*, *Choker*, *Ettercap*, *Winter Wolf* |
| **4. `ELITE`** | High-stat apex monsters within tier ($L_m = L_h + 1$ or top 15% of tier, or Persistent 1–2 Kill Survivor) | **40% – 60%** (Prepared) | `55% – 80%` | `5 – 8` rounds | Tactical check: use buffs/potions or `FLEE` if unprepared; drops enhanced loot | *Skeletal Champion* (AC 21, +7 Atk at L2!), *Ogre* (`2d8+7` at L3!), *Assassin Vine*, *Will-o'-Wisp*, *Minotaur* (`3d6+6` at L4!) |
| **5. `BOSS`** | Named Bounty Targets (`hunting_contracts`), Landmark Guardians (`[7,3]`, `[4,11]`), or 3+ Kill Persistent Tyrants | **25% – 50%** (Requires full prep) | `70% – 95%` | `6 – 10` rounds | Peak milestone fight; never ambushes unannounced; telegraphed in Stage 1 (`GENUINE_EVIDENCE`) | *Mummy* (`+14 Atk, 1d8+10 Dmg, AC 20`), *Orc Warchief*, *Manticore*, *Wyvern*, *Named Watcher Bounties* |

### 3.1 Verified Stat Outliers Within Current Tiers (Must Re-Tier in Balance V2)
1. **Level 1 Outlier — *Duergar* (`AC 18, +3 Atk, 1d8+1 Dmg` at CR 0.33) & *Stirge* (`+7 Atk`, auto-drain):** *Duergar* has higher AC (`18`) than the average Level 5 monster (`17.3`).
2. **Level 2 Outlier — *Skeletal Champion* (`AC 21, +7 Atk, 1d8+3 Dmg + Weapon Mastery`):** `AC 21` at Level 2 means a Level 2 Hero (`+4` to `+5` Atk) only hits on a natural `16–20` (`25%` hit chance!), while the Skeletal Champion (`+7` Atk) hits the hero `60%` of the time. This is a Level 3–4 Elite masquerading as a Level 2 monster.
3. **Level 3 Outlier — *Ogre* (`23 HP, AC 17, +7 Atk, 2d8+7 Dmg` = `16.0` avg / `9–23` per hit!) & *Assassin Vine* (`23 HP, AC 15, +7 Atk, 1d8+7 Dmg` = `11.5` avg + Entangle + Constrict):** A Level 3 Ranger or Cleric (`30 HP`) dies in **two hits** to an Ogre (`32` avg damage across 2 hits), and a Level 1–2 hero rolled via Gaussian variance is one-shot!
4. **Level 4 Outlier — *Minotaur* (`34 HP, AC 14, +9 Atk, 3d6+6 Dmg` = `16.5` avg + *Powerful Charge* bonus damage):** Deals higher single-hit damage than 15 of the 16 Level 5 monsters.
5. **Level 5 Outlier — *Mummy* (`45 HP, AC 20, +14 Atk, 1d8+10 Dmg` = `14.5` avg + *Despair* paralyzing fear + *Mummy Rot* + DR):** `+14` Attack Bonus is **+5.2 higher** than the Level 5 average (`+8.8`), and `AC 20` is the highest in Level 5.

---

## 4. Complete Combat Mathematics Audit

### 4.1 Core Combat Formulas (Verified in `src/domain/combat/rules.js` & `engine.js`)

1. **Hit Probability ($P_{\text{hit}}$):**
   - Natural `1` always misses (`5%` floor); Natural `20` always hits (`5%` ceiling).
   - For target Armor Class $\text{AC}$ and total attack bonus $B_{\text{atk}}$:
     $$P_{\text{hit}}(B_{\text{atk}}, \text{AC}) = \text{clamp}\left(\frac{21 - (\text{AC} - B_{\text{atk}})}{20},\, 0.05,\, 0.95\right)$$
2. **Critical Hits (`src/domain/combat/rules.js:244-279`):**
   - Look at `item_definitions.attributes`: weapons store `"crit_threat": 19, "crit_mult": 2` (or `18/x2`, `20/x3`, `20/x4`).
   - **CRITICAL CODE FINDING:** In `src/domain/combat/rules.js:256-267` (`resolveAttackRoll`) and `src/domain/combat/engine.js:463-502`, **weapon `crit_threat` and `crit_mult` are NEVER read or multiplied!**
   - A Natural `20` (`isNatural20 = true`) simply guarantees a hit (`isHit = true`) and logs flavor text (`"A devastating critical strike!"`), but rolls **1x normal weapon damage** (`calculateHeroDamage` rolls `damage_dice` once with no multiplier)!
   - **Impact:** Swords (`19–20/x2`), Scimitars/Rapiers (`18–20/x2`), Axes/Bows/Spears (`20/x3`), and Scythes (`20/x4`) have **zero critical damage differentiation** in actual code! Thus a `Scimitar` (`1d6`, 15 gp) is strictly identical in combat math to a `Shortsword` (`1d6`, 10 gp) or `Club` (`1d6`, 0 gp), and a `Scythe` (`2d4` avg 5.0, 2H) is strictly inferior to a `Greatsword` (`2d6` avg 7.0, 2H)!
3. **Hero Damage Per Hit ($D_{\text{hero}}$) (`src/domain/combat/rules.js:154-195`):**
   $$D_{\text{hero}} = \max\left(1,\, \text{Roll}(\text{weapon\_dice}) + \text{StatDmgMod} + \text{EnhancementBonus} + \text{ClassDmgBonus} + \text{StatusDmgMod}\right)$$
   - Where $\text{StatDmgMod} = \lfloor 1.5 \times \text{STR\_mod} \rfloor$ for 2H melee (`STR_mod > 0`), $\text{STR\_mod}$ for 1H melee, and $\max(\text{STR\_mod}, \lfloor \text{DEX\_mod}/2 \rfloor)$ for Ranger ranged.
4. **Armor & Damage Mitigation:**
   - Armor (`armor_bonus`), Shields (`shield_bonus`), Rings (`Ring of Protection +1`), and Amulets (`Amulet of Natural Armor +1`) add to $\text{AC}$, reducing enemy hit probability $P_{\text{hit}}$ by `5%` per `+1 AC` within the linear d20 band.
   - Heroes have **zero Damage Reduction (DR)** items or abilities in the current game, whereas several monsters have DR (*Human Skeleton*, *Draugr*, *Gibbering Mouther* DR 2–3 vs non-bludgeoning; *Human Zombie* DR 2 vs non-slashing; *Gargoyle*, *Mummy*, *Grick*, *Iron Cobra* DR 2–3 vs non-magical).
5. **Flee Probability (`src/domain/combat/rules.js:294-314`):**
   $$P_{\text{flee}} = \text{clamp}\left(0.65 + (\text{DEX\_mod}_{\text{hero}} - \lfloor \text{Init}_{\text{monster}} / 2 \rfloor) \times 0.05,\, 0.25,\, 0.90\right) \quad (\times 0.5 \text{ if Immobilized/Grabbed})$$
   - On a failed `FLEE` (`35%` base failure rate, or `67.5%` failure rate when Grabbed/Entangled/Webbed!), the hero loses their entire turn and takes a free full monster attack + special ability!

---

## 5. Matchup Mathematics Across Progression Milestones (Levels 1, 3, 5, 8, 10)

Because monsters currently exist only at `solo_level` 1–5 while character levels go to 10 (and the prompt requests evaluating progression milestones including Levels 1, 5, 10, and proposed 15/20), the table below shows exact mathematical expectations against **Same-Tier Standard Monsters** at Levels 1, 3, and 5, and against **Level 5 Monsters** at Levels 8 and 10 (demonstrating the post-Level 5 scaling collapse).

*(Assumptions: Optimized builds F1/F2, R2 with non-favored enemy [favored enemy in parentheses], C1 vs non-Undead [vs Undead in parentheses]; Ordinary progression gear: Starter at L1, Mundane Best + Shield at L3, +1 Weapon/Armor/Shield/Cloak at L5, +2 Gear at L8, +3 Weapon/+2 Armor/All Accessories at L10).*

| Milestone | Class & Gear Tier | Hero HP / AC | Hero Atk / Avg Dmg | Vs. Target Tier Avg Monster (HP / AC / Atk / Dmg) | Hero $P_{\text{hit}}$ / Expected DPR | Monster $P_{\text{hit}}$ / Monster DPR (incl. +25% Ability Factor) | Expected Rounds to Kill (RTK) | Expected HP Lost per Fight (% Max HP) | Single-Fight Win Prob / Death Risk (No Potions) | Consecutive Fights Before <30% HP (No Potions) |
| :---: | :--- | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Level 1** | **Fighter (1H+Shield)** | 13 / 17 | +3 / 7.5 | **L1 Avg:** 6.8 HP, AC 14.6, +2.5 Atk, 3.84 Dmg | 47.0% / **3.53** | 32.5% / **1.56** | **2.2 rds** | 2.6 HP (**20%**) | **96.5%** / 0.8% | **3.5 fights** |
| **Level 1** | **Fighter (2H Greatsword)** | 13 / 16 | +4 / 13.0 | **L1 Avg:** 6.8 HP, AC 14.6, +2.5 Atk, 3.84 Dmg | 52.0% / **6.76** | 37.5% / **1.80** | **1.3 rds** | 1.4 HP (**11%**) | **98.8%** / 0.3% | **6.4 fights** |
| **Level 1** | **Ranger (Longbow)** | 10 / 15 | +3 / 7.5 *(+4 / 8.5 Fav)* | **L1 Avg:** 6.8 HP, AC 14.6, +2.5 Atk, 3.84 Dmg | 47.0% / **3.53** *(+Open Shot)* | 42.5% / **2.04** | **1.5 rds** *(with Open)* | 1.9 HP (**19%**) | **95.2%** / 1.4% | **3.6 fights** |
| **Level 1** | **Cleric (Mace+Shield)** | 10 / 16 | +3 / 7.5 *(+5 / 10.5 Und)* | **L1 Avg:** 6.8 HP, AC 14.6, +2.5 Atk, 3.84 Dmg | 47.0% / **3.53** *(62% / 6.51)* | 37.5% / **1.80** *(27.5% / 1.32)* | **2.2 rds** *(1.2 rds)* | 3.1 HP (**31%**) | **91.0%** / 2.8% | **2.2 fights** *(+2 Self-Heals = 4.5)* |
| **Level 3** | **Fighter (Splint+Shield)** | 39 / 19 | +5 / 8.5 | **L3 Avg:** 21.4 HP, AC 16.0, +5.8 Atk, 6.75 Dmg | 50.0% / **4.25** | 39.0% / **3.29** | **5.0 rds** | 14.8 HP (**38%**) | **88.4%** / 4.2% | **1.8 fights** |
| **Level 3** | **Ranger (Chain Shirt)** | 30 / 17 | +5 / 7.5 *(+6 / 8.5 Fav)* | **L3 Avg:** 21.4 HP, AC 16.0, +5.8 Atk, 6.75 Dmg | 50.0% / **3.75** *(55% / 4.68)* | 49.0% / **4.13** | **4.9 rds** *(with Open)* | 18.2 HP (**61%**) | **71.5%** / 14.8% | **1.1 fights** |
| **Level 3** | **Cleric (Splint+Shield)** | 30 / 19 | +5 / 7.5 *(+7 / 10.5 Und)* | **L3 Avg:** 21.4 HP, AC 16.0, +5.8 Atk, 6.75 Dmg | 50.0% / **3.75** *(60% / 6.30)* | 39.0% / **3.29** | **5.7 rds** *(3.4 rds)* | 17.1 HP (**57%**) | **74.2%** / 12.1% | **1.2 fights** *(+2 Self-Heals = 2.4)* |
| **Level 5** | **Fighter (+1 Gear/Plate)** | 65 / 24 | +10 / 10.5 | **L5 Avg:** 41.2 HP, AC 17.3, +8.8 Atk, 9.47 Dmg | 68.5% / **7.19** | 27.5% / **3.26** | **5.7 rds** | 16.9 HP (**26%**) | **94.6%** / 1.8% | **2.7 fights** |
| **Level 5** | **Ranger (+1 Bow/Armor)** | 50 / 19 | +8 / 8.5 *(+10 / 10.5 Fav)* | **L5 Avg:** 41.2 HP, AC 17.3, +8.8 Atk, 9.47 Dmg | 58.5% / **4.97** *(68.5% / 7.19)* | 52.5% / **6.21** | **7.4 rds** *(5.0 Fav)* | 42.8 HP (**86%**) | **46.2%** *(78% Fav)* | **0.8 fights** *(Requires Potions!)* |
| **Level 5** | **Cleric (+1 Mace/Armor)** | 50 / 21 | +7 / 8.5 *(+10 / 12.5 Und)* | **L5 Avg:** 41.2 HP, AC 17.3, +8.8 Atk, 9.47 Dmg | 53.5% / **4.55** *(68.5% / 8.56)* | 42.5% / **5.03** | **9.1 rds** *(4.8 Und)* | 43.3 HP (**87%**) | **31.4%** *(88% Und)* | **0.8 fights** *(Requires Potions!)* |
| **Level 8** | **Fighter (+2 Gear)** | 104 / 27 | +14 / 12.5 | **L5 Avg (Cap):** 41.2 HP, AC 17.3, +8.8 Atk, 9.47 Dmg | 88.5% / **11.06** | 12.5% / **1.48** | **3.7 rds** | 4.7 HP (**4.5%**) | **99.9%** / <0.1% | **15.5 fights** *(Trivialized!)* |
| **Level 10** | **Fighter (+3 Gear)** | 130 / 28 | +18 / 14.5 | **L5 Avg (Cap):** 41.2 HP, AC 17.3, +8.8 Atk, 9.47 Dmg | 95.0% / **13.78** | 7.5% / **0.89** | **3.0 rds** | 2.2 HP (**1.7%**) | **100%** / 0.0% | **41.0 fights** *(Completely Trivial!)* |

### 5.1 Key Mathematical Conclusions from the Matchup Table
1. **The Level 4–5 Ranger & Cleric Cliff:** At Level 5, Fighter's combination of `Full Plate +1`, `Shield +1`, `Armor Training`, and `Weapon Training` pushes Fighter to **AC 24** and **+10 Attack** (`94.6%` no-potion win rate vs Level 5 monsters). Meanwhile, Ranger (`AC 19`, no shield while using a bow) and Cleric (`+7` Attack, zero class bonus vs 88% of monsters) drop to **46.2%** and **31.4%** no-potion win rates against the exact same Level 5 monsters!
2. **Post-Level 5 Trivialization:** Because monsters cap at `solo_level = 5`, any character who reaches Levels 7–10 with `+2`/`+3` gear outscales the entire world (`95%` hit rate, `<15%` monster hit rate, `<5%` HP lost per fight).
3. **Unfair / Unavoidable Death Scenarios Identified:**
   - **Gaussian $+2/+3$ Level Spikes at Level 1–2:** A Level 1 hero (`10–13 HP`) rolling a Level 3 *Ogre* (`2d8+7`, `16.0` avg dmg) or *Assassin Vine* (`1d8+7` + Entangle) drops to `1 HP` on Round 1 (saved only by `eligibleForLevel1SpikeGuard`), gets Entangled (`-2 Atk, -2 DEX, Flee chance halved to 32.5%`), fails to flee `67.5%` of the time, and dies on Round 2.
   - **Action-Denial Stun/Paralysis Chains:** *Ghoul* / *Ghast* Paralysis and *Catoblepas* Tail Stun skip the hero's entire turn (`heroStunned`), preventing the hero from drinking a potion or fleeing while the monster gets a second consecutive uncontested attack.
