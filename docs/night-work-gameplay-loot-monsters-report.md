# Darkgrid — Night Work Report: Gameplay Fixes, Loot Progression, and 30 New Monsters

**Date:** October 14, 2026  
**Scope:** Core Gameplay Fixes, Loot Table & Item Progression Overhaul, 30 New Level 1–5 Monsters, and 60 New Monster Artworks (Living + Defeated)  
**Test Suite Status:** **219 / 219 tests passing** (`17` suites, `0` failures)

---

## 1. Executive Summary

This Night Work session focused strictly on core gameplay integrity, loot progression coherence, and bestiary depth across Levels 1–5 on the existing active map (`FOREST`, `SWAMP`, `PLAINS`, `JUNGLE`, `HILLS`) without touching Firebase/Spark hosting, expanding the world grid, or altering Ranger Favored Enemy options:

1. **Gameplay Fixes & Exploit Closures:**
   - **Ambush Consequence & Anti-Bypass (`is_ambush = 1` at Level 2+):** Ambushes now have real tactical teeth. When a Level 2+ hero is ambushed, free encounter bypass (`ignoreEncounter`) and contract-abandon bypass (`abandonContract`) are blocked, the Stage 1 UI disables the `Bypass & Ignore` button (`🚫 Retreat Cut Off (Ambushed)` / `⚔️ Face the Ambush`), and the ambushing monster receives a **+4 surprise initiative bonus** plus initiative tie-breaker advantage in `startCombat`. Level 1 heroes retain full ambush immunity.
   - **Level 1 Unfair Death Prevention ("Death's Door" Round-1 Spike Guard + Outlier Rebalance):** Healthy Level 1 heroes (`>= 70%` max HP at the start of Round 1) who suffer a lethal Round-1 damage spike are clamped at **1 HP** (`Death's Door! Sheer survival instinct keeps you standing at 1 HP after a lethal opening blow!`), guaranteeing at least one Round 2 tactical decision (Attack, Drink Potion, or Flee). In addition, four overtuned Level 1 monsters (`Orc`, `Human Zombie`, `Gnoll`, `Hyena`) were rebalanced in seed `010`.
   - **Permadeath Starter Gear & Mule-Feeding Exploit Closure:** Starter weapons, armor, shields, and potions created in `createCharacter` are tagged with `{"is_starter":true}` in `item_instances.modifications`. Starter items cannot be sold at the Oakhaven store (`sellItem`), and zero-XP Level 1 "mule" alts (`isMuleFeed` in `handlePlayerDeath`) cannot transfer starter gold (`<= 10 gp`) or starter gear to persistent monsters.
   - **Loot `min_cr` Gating Bug Fix:** Fixed `generateMonsterLoot` (`src/domain/combat/loot.js`) where non-magical `loot_table_entries` and fallback queries previously ignored `item_definitions.min_cr`, allowing CR 0.25–0.5 monsters to drop high-CR treasures or late-game armor.
2. **Loot Table & Item Progression Overhaul:**
   - Connected all **55 previously unlinked active equipment items** (`17` magical `+1`/`+2` weapons, armors, and shields + `38` mundane weapons, armors, and shields) into `loot_table_entries` with progressive `min_cr` gating (`CR 0` through `CR 4`).
   - Added **4 new creature-type loot tables** (`MONSTROUS_HUMANOID_SPOILS`, `FEY_CURIOS`, `PLANT_TROVE`, `VERMIN_CARCASS_CACHE`) and lowered `DRAGON_HOARD` `min_cr` from `4.0` to `2.0` (`magic_chance_multiplier = 2.0`), ensuring melee, ranged, and defensive builds all experience smooth progression across Levels 1–5 while keeping Legendary drops `< 1%`.
3. **30 New Monsters & 60 New Artworks:**
   - Added **30 Pathfinder-inspired monsters** (expanding the active catalog from `68` to `98`), distributed evenly at **6 per level (Levels 1–5)** and **6 primary monsters per active terrain (`FOREST`, `SWAMP`, `PLAINS`, `JUNGLE`, `HILLS`)** plus secondary terrain bindings.
   - Mapped all 30 new monsters to existing special ability archetypes in `src/domain/combat/abilities.js` (zero ability bloat) and generated **60 dark-fantasy 2D illustrations** (`30` living + `30` `_defeated.png`), verified in both `images/monsters/` and `public/images/monsters/`.

---

## 2. Gameplay Bugs & Fixes Completed

### A. Ambush / Encounter Flow (`src/domain/encounters/engine.js`, `src/domain/combat/engine.js`, `src/domain/bounties/board.js`, `src/views/game.ejs`)
- **Problem:** Previously, `is_ambush = 1` only displayed an alert banner in Stage 1 (`DISCOVERED`). Players could click `Bypass & Ignore` (or abandon an active bounty contract) to skip an ambush with zero consequence, and if they did enter combat, `startCombat` gave the ambushing monster no initiative advantage.
- **Solution & Rationale:**
  - **Combined Anti-Bypass + Surprise Initiative Advantage:** At Level 2+ (preserving Level 1 ambush immunity), `ignoreEncounter` rejects bypassing an ambushing threat (`Ambush! Your path is cut off—you cannot bypass this threat and must face the ambush!`), and `abandonContract` blocks abandoning a contract while ambushed by the quarry.
  - In `src/views/game.ejs`, Stage 1 (`DISCOVERED`) replaces `Advance & Investigate` with `⚔️ Face the Ambush` and renders `🚫 Retreat Cut Off (Ambushed)` (disabled) instead of `Bypass & Ignore`.
  - In `startCombat` (`src/domain/combat/engine.js`), when `effectiveAmbush === 1`, the monster receives a **+4 surprise bonus** to its initiative roll and wins initiative ties (`monsterInitiative >= heroInitiative`), while the player still keeps full control of their Round 1 action (`Attack`, `Drink Potion`, or `Flee`).

### B. Level 1 Unfair Deaths (`src/domain/combat/engine.js`, `db/seeds/010_seed_night_work_loot_and_30_monsters.sql`)
- **Problem:** A Level 1 hero (9–13 HP) who lost initiative could be killed in Round 1 before taking a single tactical decision if an early monster rolled a high damage spike or critical hit. Specifically, `Orc` (`+5` AB, `2d4+4` = 6–12 dmg, 12–24 crit), `Human Zombie` (`+4` AB, `1d6+4` = 5–10 dmg), `Gnoll` (`+3` AB, `1d8+3` = 4–11 dmg), and `Hyena` (`1d6+3` = 4–9 dmg) had disproportionately lethal damage floors for Level 1.
- **Solution:**
  1. **Round-1 "Death's Door" Spike Protection (`executeCombatRound`):** If a Level 1 hero starts Round 1 at healthy vitality (`heroStartOfRoundHp >= Math.max(6, Math.ceil(max_hp * 0.70))`) and Round-1 monster damage or end-of-round status ticks would reduce them to `<= 0 HP`, their HP is clamped at `1 HP` once and logs: `"Death's Door! Sheer survival instinct keeps you standing at 1 HP after a lethal opening blow!"`. In Round 2+, or if the hero entered combat already below 70% HP, lethal blows kill the hero normally.
  2. **Level 1 Outlier Monster Rebalance (Seed `010`):**
     - `Orc`: `attack_bonus` `+5 -> +3`, `damage_dice` `'2d4+4' -> '1d6+2'`
     - `Human Zombie`: `attack_bonus` `+4 -> +2`, `damage_dice` `'1d6+4' -> '1d6+2'`
     - `Gnoll`: `attack_bonus` `+3`, `damage_dice` `'1d8+3' -> '1d6+2'`
     - `Hyena`: `damage_dice` `'1d6+3' -> '1d6+1'`

### C. Permadeath Exploit / Starter Gear & Mule Feeding (`src/domain/character/rules.js`, `src/domain/economy/shop.js`, `src/domain/monsters/persistence.js`)
- **Problem:**
  1. Players could unequip starter weapons/armor/shields or take starter potions on a fresh Level 1 character and sell them in Oakhaven.
  2. Players could repeatedly create zero-XP Level 1 "mule" characters and intentionally die to the same persistent monster to pump `held_gold` (+5 gp per mule) and transfer starter gear/potions into a loot piñata, then slay that monster with a main character.
- **Solution:**
  1. `createCharacter` now tags all starter equipment and starter potions with `modifications = '{"is_starter":true}'`.
  2. `sellItem` in `src/domain/economy/shop.js` blocks selling any item with `is_starter === true` (`Starter issue equipment cannot be sold at the Oakhaven market.`).
  3. `handlePlayerDeath` in `src/domain/monsters/persistence.js` detects zero-XP Level 1 mule feeds (`priorZeroXpDeaths > 0` for the same `user_id` or dying at `level === 1 && xp === 0 && gold <= 10` to an already-existing persistent monster instance) and prevents starter gold (`<= 10 gp`) and `is_starter` items from transferring to the persistent monster.

### D & E. Loot & Progression CR Gating Bug (`src/domain/combat/loot.js`)
- **Problem:** `generateMonsterLoot` filtered `min_cr <= cr` on magical drops, but non-magical `loot_table_entries` and fallback queries did not filter by `COALESCE(id.min_cr, 0) <= ?`. As a result, a CR 0.25–0.5 monster using `DRAGON_HOARD`, `UNDEAD_HAUNT`, or `HUMANOID_MUNDANE` could drop higher-CR items if linked to the same table.
- **Solution:** Added `AND COALESCE(id.min_cr, 0) <= ?` to both the primary non-magical `loot_table_entries` query and the fallback query in `src/domain/combat/loot.js`, and tuned `MAGIC_DROP_CHANCES` (`1.5%` at CR `<1`, `2.5%` at CR `1–2`, `4.0%` at CR `3–4`, `5.5%` at CR `5–6`, `6.5%` at CR `7+`) so magic gear is genuinely attainable without flooding low levels.

---

## 3. Loot Table & Item Progression Overhaul

### A. Previously Unattainable Items (55 Active Items Connected)
Before this session, `65` out of `104` items in `item_definitions` had zero rows in `loot_table_entries`. Excluding the `10` intentionally deferred buff/accessory items (`Potion of Barkskin`, `Potion of Bull's Strength`, `Potion of Cat's Grace`, `Potion of Shield of Faith`, `Potion of Heroism`, `Elixir of Dragon's Breath`, `Antitoxin`, `Boots of Elvenkind`, `Cloak of Resistance +1`, `Bracers of Armor +1`), **55 active weapons, armors, and shields were completely unattainable as monster drops**:

- **17 Previously Unlinked Magical Weapons, Armors & Shields (Now Connected):**
  - **Melee +1/+2:** `Dagger +1` (CR 1), `Shortsword +1` (CR 2), `Battleaxe +1` (CR 2), `Warhammer +1` (CR 2), `Longsword +2` (CR 4)
  - **Ranged +1/+2 (Critical fix for Ranger/Ranged builds — previously 0 non-legendary magic bows/crossbows could drop!):** `Shortbow +1` (CR 2), `Light Crossbow +1` (CR 2), `Longbow +1` (CR 2), `Longbow +2` (CR 4)
  - **Armor & Shields +1/+2:** `Leather Armor +1` (CR 1), `Light Steel Shield +1` (CR 1), `Scale Mail +1` (CR 2), `Chainmail +1` (CR 2), `Breastplate +1` (CR 2), `Chain Shirt +2` (CR 4), `Breastplate +2` (CR 4), `Heavy Steel Shield +2` (CR 4)
- **38 Previously Unlinked Mundane Weapons, Armors & Shields (Now Connected):**
  - **Weapons (24):** `Club`, `Shortspear`, `Quarterstaff`, `Sling`, `Javelin`, `Dart`, `Spear`, `Light Mace`, `Greatclub`, `Light Flail`, `Glaive`, `Halberd`, `Heavy Mace`, `Warhammer`, `Scimitar`, `Greataxe`, `Rapier`, `Light Crossbow`, `Greatsword`, `Falchion`, `Longbow`, `Composite Shortbow`, `Composite Longbow`, `Hand Crossbow`
  - **Armors (10):** `Padded Armor`, `Hide Armor`, `Scale Mail`, `Armored Coat`, `Chainmail`, `Splint Mail`, `Banded Mail`, `Agile Breastplate`, `Half-Plate`, `Full Plate`
  - **Shields (4):** `Light Wooden Shield`, `Heavy Wooden Shield`, `Light Steel Shield`, `Tower Shield`

### B. New & Updated Loot Tables
- Added 4 new active creature-type loot tables in `db/seeds/010_seed_night_work_loot_and_30_monsters.sql`:
  1. `MONSTROUS_HUMANOID_SPOILS` (`creature_type = 'MONSTROUS HUMANOID'`, `min_cr = 0.0`, `max_cr = 99.0`, `gold_multiplier = 1.2`, `item_chance = 0.40`, `magic_chance_multiplier = 1.2`)
  2. `FEY_CURIOS` (`creature_type = 'FEY'`, `min_cr = 0.0`, `max_cr = 99.0`, `gold_multiplier = 0.9`, `item_chance = 0.35`, `magic_chance_multiplier = 1.3`)
  3. `PLANT_TROVE` (`creature_type = 'PLANT'`, `min_cr = 0.0`, `max_cr = 99.0`, `gold_multiplier = 0.8`, `item_chance = 0.30`, `magic_chance_multiplier = 1.0`)
  4. `VERMIN_CARCASS_CACHE` (`creature_type = 'VERMIN'`, `min_cr = 0.0`, `max_cr = 99.0`, `gold_multiplier = 0.7`, `item_chance = 0.28`, `magic_chance_multiplier = 0.9`)
- Updated `DRAGON_HOARD` (`min_cr = 2.0`, `magic_chance_multiplier = 2.0`) so Level 4–5 draconic monsters (`Forest Drake`, `Wyvern`) roll on `DRAGON_HOARD` while keeping Legendary drops (`Holy Avenger +3`, `Oathbow +3`, `Crown of the Sunken King`) below `1.0%`.

### C. Level 1–5 Loot Progression Overview
| Level / CR Band | Mundane Weapons & Ranged | Mundane Armor & Shields | Magical Drops & Consumables | Treasures |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1 (CR 0.25–1.0)** | Simple & martial one-handed (`Dagger`, `Shortsword`, `Longsword`, `Battleaxe`, `Warhammer`, `Heavy Mace`, `Spear`, `Shortbow`, `Light Crossbow`, `Longbow`) | `Padded`, `Leather`, `Studded Leather`, `Hide`, `Scale Mail`, `Chain Shirt`, `Buckler`, `Light/Heavy Steel Shield` | `Minor Healing Potion`, `Potion of Cure Light Wounds`, early `+1` (`Dagger +1`, `Longsword +1`, `Heavy Mace +1`, `Leather Armor +1`, `Chain Shirt +1`, `Light/Heavy Steel Shield +1`) | `Uncut Garnet`, `Polished Bloodstone`, `Rough Emerald`, `Ancient Silver Chalice`, `Royal Signet Ring`, `Carved Mammoth Tusk` |
| **Level 2 (CR 2.0)** | Heavy 2H & composite ranged (`Greatsword`, `Greataxe`, `Falchion`, `Heavy Flail`, `Scythe`, `Composite Shortbow`, `Composite Longbow`, `Heavy/Hand Crossbow`) | `Chainmail`, `Breastplate`, `Tower Shield` | `Potion of Cure Moderate Wounds`, `+1` martial & ranged (`Shortsword +1`, `Battleaxe +1`, `Warhammer +1`, `Greatsword +1`, `Shortbow +1`, `Longbow +1`, `Light Crossbow +1`, `Scale Mail +1`, `Chainmail +1`, `Breastplate +1`, `Ring of Protection +1`, `Amulet of Natural Armor +1`) | `Flawless Sapphire`, `Gilded Reliquary`, `Silk Brocade Tapestry` |
| **Level 3 (CR 3.0)** | All martial melee, polearms & composite bows | `Agile Breastplate`, `Splint Mail`, `Banded Mail`, `Half-Plate` | `Potion of Cure Serious Wounds`, `Full Plate +1`, `Belt of Giant Strength +2`, plus all CR 1–2 `+1` gear | `Amber Dragon Tear` |
| **Level 4 (CR 4.0)** | Masterwork & heavy martial weapons | `Full Plate` | `+2` Weapons, Armor & Shields (`Longsword +2`, `Longbow +2`, `Chain Shirt +2`, `Breastplate +2`, `Full Plate +2`, `Heavy Steel Shield +2`) | `Star Ruby` |
| **Level 5 (CR 5.0)** | Full martial & ranged arsenal | Full heavy plate & shield arsenal | `Potion of Cure Critical Wounds`, `Draught of Troll's Blood`, `+2` gear, and apex rare chance at `Holy Avenger +3` / `Oathbow +3` on draconic hoards | `Crown of the Sunken King` |

---

## 4. List of All 30 New Monsters (Levels 1–5)

| # | Name | Level (`solo_level`) | CR | Creature Type | HP | AC | AB | Damage | Init | Move | Primary Terrain | Secondary Terrains | Treasure / Loot Table | Special Abilities |
| :-: | :--- | :-: | :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :--- | :--- | :--- | :--- |
| 1 | **Mite** | 1 | 0.25 | Fey | 4 | 13 | +1 | `1d3` | +1 | WALK | `FOREST` | `HILLS` | Standard (`FEY_CURIOS`) | `hatred`, `vermin_empathy`, `low_light_vision` |
| 2 | **Bog Strider** | 1 | 0.5 | Vermin (aquatic) | 6 | 14 | +2 | `1d4+1` | +2 | WALK | `SWAMP` | `JUNGLE` | Incidental (`VERMIN_CARCASS_CACHE`) | `water_stride`, `lunge`, `darkvision` |
| 3 | **Blood Hawk** | 1 | 0.5 | Animal | 5 | 15 | +4 | `1d4` | +3 | FLY | `PLAINS` | `HILLS`, `FOREST` | None (Animal rule) | `bleed`, `keen_sight`, `flight` |
| 4 | **Jungle Viper** | 1 | 0.5 | Animal | 5 | 15 | +4 | `1d3` | +3 | WALK | `JUNGLE` | `FOREST`, `SWAMP` | None (Animal rule) | `poison`, `scent`, `climb` |
| 5 | **Plague Zombie** | 1 | 0.5 | Undead | 8 | 12 | +2 | `1d6+1` | -1 | WALK | `HILLS` | `PLAINS`, `SWAMP` | Standard (`UNDEAD_HAUNT`) | `disease`, `death_burst`, `undead_traits` |
| 6 | **Grippli Scout** | 1 | 0.5 | Humanoid (grippli) | 6 | 15 | +3 | `1d6` | +3 | WALK | `JUNGLE` | `SWAMP`, `FOREST` | Standard (`HUMANOID_MUNDANE`) | `swamp_stride`, `camouflage`, `poison_use` |
| 7 | **Worg** | 2 | 2.0 | Magical Beast | 17 | 14 | +5 | `1d6+3` | +2 | WALK | `PLAINS` | `FOREST`, `HILLS` | Incidental (`MAGICAL_BEAST_LAIR`) | `trip`, `scent`, `low_light_vision` |
| 8 | **Hippogriff** | 2 | 2.0 | Magical Beast | 17 | 15 | +5 | `1d6+3` | +2 | FLY | `HILLS` | `PLAINS` | Incidental (`MAGICAL_BEAST_LAIR`) | `wing_buffet`, `dive`, `flight` |
| 9 | **Giant Toad** | 2 | 2.0 | Animal | 17 | 14 | +4 | `1d6+2` | +1 | WALK | `SWAMP` | `FOREST`, `JUNGLE` | None (Animal rule) | `grab`, `poison_skin`, `swallow_whole` |
| 10 | **Carbuncle** | 2 | 2.0 | Magical Beast | 15 | 17 | +3 | `1d4+1` | +0 | WALK | `JUNGLE` | `HILLS`, `FOREST` | Standard (`MAGICAL_BEAST_LAIR`) | `discord_gaze`, `shell_armor`, `telepathy` |
| 11 | **Phantom Fungus** | 2 | 2.0 | Plant | 16 | 14 | +4 | `1d6+2` | +0 | WALK | `FOREST` | `SWAMP` | Incidental (`PLANT_TROVE`) | `greater_invisibility`, `ambush_spores`, `plant_traits` |
| 12 | **Gnoll Packmaster** | 2 | 2.0 | Humanoid (gnoll) | 18 | 16 | +5 | `1d8+3` | +1 | WALK | `PLAINS` | `HILLS` | Standard (`HUMANOID_MUNDANE`) | `pack_whip`, `trip`, `battle_cry` |
| 13 | **Giant Mantis** | 3 | 3.0 | Vermin | 23 | 16 | +6 | `1d8+3` | +2 | WALK | `JUNGLE` | `FOREST` | Incidental (`VERMIN_CARCASS_CACHE`) | `grab`, `lunge`, `mandibles` |
| 14 | **Spriggan** | 3 | 3.0 | Fey (gnome) | 21 | 16 | +6 | `1d8+3` | +2 | WALK | `FOREST` | `HILLS` | Standard (`FEY_CURIOS`) | `size_alteration`, `sneak_attack`, `shatter` |
| 15 | **Will-o'-Wisp** | 3 | 3.0 | Aberration (air) | 18 | 18 | +6 | `2d4` | +7 | FLY | `SWAMP` | `FOREST` | Incidental (`ABERRATION_CACHE`) | `shock_touch`, `natural_invisibility`, `magic_immunity` |
| 16 | **Cheetah** | 3 | 3.0 | Animal | 20 | 16 | +6 | `1d6+3` | +6 | WALK | `PLAINS` | `HILLS` | None (Animal rule) | `sprint`, `pounce`, `trip` |
| 17 | **Draugr** | 3 | 3.0 | Undead (water) | 22 | 16 | +6 | `1d10+3` | +0 | WALK | `SWAMP` | `HILLS`, `FOREST` | Standard (`UNDEAD_HAUNT`) | `nauseating_strike`, `damage_reduction_bludgeoning`, `undead_traits` |
| 18 | **Hobgoblin Captain** | 3 | 3.0 | Humanoid (goblinoid) | 24 | 18 | +7 | `1d8+4` | +3 | WALK | `HILLS` | `PLAINS`, `FOREST` | Standard (`HUMANOID_ELITE`) | `martial_command`, `shield_wall`, `cleave` |
| 19 | **Displacer Beast** | 4 | 4.0 | Magical Beast | 32 | 17 | +8 | `1d8+4` | +2 | WALK | `JUNGLE` | `FOREST`, `HILLS` | Standard (`MAGICAL_BEAST_LAIR`) | `displacement`, `tentacle_rake`, `resistance` |
| 20 | **Shambling Mound** | 4 | 4.0 | Plant | 35 | 17 | +8 | `2d6+4` | +0 | WALK | `SWAMP` | `JUNGLE`, `FOREST` | Standard (`PLANT_TROVE`) | `constrict`, `grab`, `electric_fortitude` |
| 21 | **Leucrotta** | 4 | 4.0 | Magical Beast | 33 | 17 | +8 | `2d6+5` | +3 | WALK | `PLAINS` | `HILLS`, `FOREST` | Standard (`MAGICAL_BEAST_LAIR`) | `luring_cry`, `armor_chew`, `powerful_bite` |
| 22 | **Dire Boar** | 4 | 4.0 | Animal | 34 | 16 | +8 | `2d6+5` | +0 | WALK | `FOREST` | `HILLS`, `PLAINS` | None (Animal rule) | `ferocity`, `gore_charge`, `scent` |
| 23 | **Forest Drake** | 4 | 4.0 | Dragon (earth) | 32 | 17 | +8 | `1d8+4` | +5 | FLY | `FOREST` | `JUNGLE`, `HILLS` | Standard (`DRAGON_HOARD`) | `acid_spit`, `speed_surge`, `flight` |
| 24 | **Otyugh** | 4 | 4.0 | Aberration | 32 | 17 | +7 | `1d8+4` | +0 | WALK | `HILLS` | `SWAMP` | Standard (`ABERRATION_CACHE`) | `filth_fever`, `grab`, `constrict` |
| 25 | **Wyvern** | 5 | 5.0 | Dragon | 42 | 18 | +9 | `1d8+5` | +5 | FLY | `HILLS` | `PLAINS`, `FOREST` | Standard (`DRAGON_HOARD`) | `deadly_sting`, `poison`, `rake`, `flight` |
| 26 | **Girallon** | 5 | 5.0 | Magical Beast | 42 | 17 | +9 | `1d6+6` | +6 | WALK | `JUNGLE` | `FOREST`, `HILLS` | Incidental (`MAGICAL_BEAST_LAIR`) | `four_arm_rend`, `rend`, `climb` |
| 27 | **Catoblepas** | 5 | 5.0 | Magical Beast | 44 | 18 | +9 | `2d6+5` | +1 | WALK | `SWAMP` | `PLAINS` | Standard (`MAGICAL_BEAST_LAIR`) | `poison_breath`, `tail_stun`, `trample` |
| 28 | **Barrow Wight** | 5 | 5.0 | Undead | 38 | 18 | +9 | `1d8+5` | +2 | WALK | `PLAINS` | `HILLS` | Double (`UNDEAD_ANCIENT`) | `energy_drain`, `barrow_dread`, `undead_traits` |
| 29 | **Green Hag** | 5 | 5.0 | Monstrous Humanoid | 39 | 19 | +9 | `1d6+5` | +1 | WALK | `HILLS` | `SWAMP`, `FOREST` | Standard (`MONSTROUS_HUMANOID_SPOILS`) | `weakening_touch`, `evil_eye`, `mimicry` |
| 30 | **Orc Warchief** | 5 | 5.0 | Humanoid (orc) | 45 | 18 | +10 | `2d6+6` | +2 | WALK | `FOREST` | `HILLS`, `PLAINS` | Double (`HUMANOID_ELITE`) | `warlord_roar`, `ferocity`, `brutal_cleave` |

---

## 5. Level Distribution (`solo_level` 1–5)

| Solo Level | Previous Monster Count | New Monsters Added | Total Active Monsters |
| :---: | :---: | :---: | :---: |
| **Level 1** | 23 | **+6** (`Mite`, `Bog Strider`, `Blood Hawk`, `Jungle Viper`, `Plague Zombie`, `Grippli Scout`) | **29** |
| **Level 2** | 15 | **+6** (`Worg`, `Hippogriff`, `Giant Toad`, `Carbuncle`, `Phantom Fungus`, `Gnoll Packmaster`) | **21** |
| **Level 3** | 12 | **+6** (`Giant Mantis`, `Spriggan`, `Will-o'-Wisp`, `Cheetah`, `Draugr`, `Hobgoblin Captain`) | **18** |
| **Level 4** | 8 | **+6** (`Displacer Beast`, `Shambling Mound`, `Leucrotta`, `Dire Boar`, `Forest Drake`, `Otyugh`) | **14** |
| **Level 5** | 10 | **+6** (`Wyvern`, `Girallon`, `Catoblepas`, `Barrow Wight`, `Green Hag`, `Orc Warchief`) | **16** |
| **Total** | **68** | **+30** | **98** |

---

## 6. Terrain Distribution Across Active Map Terrains

All 30 new monsters have their primary terrain assigned evenly (**6 primary monsters per active terrain**) plus 1–2 secondary active terrains, eliminating previous mid/high-level gaps (such as `JUNGLE` having only 5 monsters total and 0 at Level 5, or `PLAINS` and `SWAMP` having 0 at Level 4):

| Active Terrain | Map Tiles (Passable) | New Primary Monsters Added | New Total Assignments (Primary + Secondary) | Total Playable Monsters Now Spawnable on Terrain |
| :--- | :---: | :---: | :---: | :---: |
| **FOREST** | 38 | **+6** (`Mite`, `Phantom Fungus`, `Spriggan`, `Dire Boar`, `Forest Drake`, `Orc Warchief`) | **+19** | **44** (L1: 14, L2: 9, L3: 9, L4: 7, L5: 5) |
| **SWAMP** | 35 | **+6** (`Bog Strider`, `Giant Toad`, `Will-o'-Wisp`, `Draugr`, `Shambling Mound`, `Catoblepas`) | **+12** | **34** (L1: 15, L2: 4, L3: 6, L4: 2, L5: 7) |
| **PLAINS** | 30 | **+6** (`Blood Hawk`, `Worg`, `Gnoll Packmaster`, `Cheetah`, `Leucrotta`, `Barrow Wight`) | **+13** | **30** (L1: 11, L2: 6, L3: 5, L4: 2, L5: 6) |
| **JUNGLE** | 28 | **+6** (`Jungle Viper`, `Grippli Scout`, `Carbuncle`, `Giant Mantis`, `Displacer Beast`, `Girallon`) | **+10** | **15** (L1: 5, L2: 3, L3: 2, L4: 4, L5: 1) |
| **HILLS** | 27 | **+6** (`Plague Zombie`, `Hippogriff`, `Hobgoblin Captain`, `Otyugh`, `Wyvern`, `Green Hag`) | **+19** | **45** (L1: 12, L2: 7, L3: 8, L4: 11, L5: 7) |

---

## 7. Special Abilities Used (`src/domain/combat/abilities.js`)

No bloated one-off combat subsystems were created. Instead, all 30 new monsters were wired into the existing 12 Pathfinder-inspired combat ability archetypes in `getMonsterAbilityProfile`:
- **Bleed (`bleed`):** `Blood Hawk`, `Hobgoblin Captain`
- **Poison (`poison`):** `Jungle Viper`, `Grippli Scout`, `Giant Toad`, `Wyvern`, `Catoblepas`
- **Disease / Weakening Debuff (`disease`):** `Mite`, `Plague Zombie`, `Carbuncle`, `Phantom Fungus`, `Draugr`, `Otyugh`, `Barrow Wight`, `Green Hag`
- **Grab / Constrict (`grab`):** `Bog Strider`, `Giant Toad`, `Giant Mantis`, `Shambling Mound`, `Otyugh`
- **Trip / Knockdown (`trip`):** `Worg`, `Hippogriff`, `Gnoll Packmaster`, `Cheetah`, `Catoblepas`
- **Pounce / Ambush Opening (`pounce`):** `Cheetah`, `Dire Boar`
- **Multi-Hit Rend / Rake (`rend`):** `Spriggan`, `Displacer Beast`, `Girallon`, `Orc Warchief`
- **Breath / Volley (`breath`):** `Will-o'-Wisp` (Lightning Arc), `Forest Drake` (Acid Spit), `Catoblepas` (Noxious Breath)
- **Gaze / Roar Aura (`gaze`):** `Carbuncle`, `Gnoll Packmaster`, `Leucrotta`, `Barrow Wight`, `Green Hag`, `Orc Warchief`
- **Armor Corrosion / Shatter (`corrosion`):** `Spriggan`, `Leucrotta`
- **Damage Reduction (`dr`):** `Draugr` (`BLUDGEONING`), `Displacer Beast` (`MAGIC`), `Shambling Mound` (`SLASHING`)
- **Ferocity / Blood Frenzy (`bloodFrenzy`):** `Dire Boar`, `Orc Warchief`

---

## 8. Complete List of All 60 New Monster Images

All 60 files (30 living + 30 defeated) are saved in **both** `images/monsters/` and `public/images/monsters/` and verified by automated disk/size/path tests:

| # | Monster Name | Living Image (`image_path`) | Defeated Image (`defeated_image_path`) | Path & Disk Validation |
| :-: | :--- | :--- | :--- | :---: |
| 1 | Mite | `images/monsters/mite.png` | `images/monsters/mite_defeated.png` | PASS (Root + Public) |
| 2 | Bog Strider | `images/monsters/bog_strider.png` | `images/monsters/bog_strider_defeated.png` | PASS (Root + Public) |
| 3 | Blood Hawk | `images/monsters/blood_hawk.png` | `images/monsters/blood_hawk_defeated.png` | PASS (Root + Public) |
| 4 | Jungle Viper | `images/monsters/jungle_viper.png` | `images/monsters/jungle_viper_defeated.png` | PASS (Root + Public) |
| 5 | Plague Zombie | `images/monsters/plague_zombie.png` | `images/monsters/plague_zombie_defeated.png` | PASS (Root + Public) |
| 6 | Grippli Scout | `images/monsters/grippli_scout.png` | `images/monsters/grippli_scout_defeated.png` | PASS (Root + Public) |
| 7 | Worg | `images/monsters/worg.png` | `images/monsters/worg_defeated.png` | PASS (Root + Public) |
| 8 | Hippogriff | `images/monsters/hippogriff.png` | `images/monsters/hippogriff_defeated.png` | PASS (Root + Public) |
| 9 | Giant Toad | `images/monsters/giant_toad.png` | `images/monsters/giant_toad_defeated.png` | PASS (Root + Public) |
| 10 | Carbuncle | `images/monsters/carbuncle.png` | `images/monsters/carbuncle_defeated.png` | PASS (Root + Public) |
| 11 | Phantom Fungus | `images/monsters/phantom_fungus.png` | `images/monsters/phantom_fungus_defeated.png` | PASS (Root + Public) |
| 12 | Gnoll Packmaster | `images/monsters/gnoll_packmaster.png` | `images/monsters/gnoll_packmaster_defeated.png` | PASS (Root + Public) |
| 13 | Giant Mantis | `images/monsters/giant_mantis.png` | `images/monsters/giant_mantis_defeated.png` | PASS (Root + Public) |
| 14 | Spriggan | `images/monsters/spriggan.png` | `images/monsters/spriggan_defeated.png` | PASS (Root + Public) |
| 15 | Will-o'-Wisp | `images/monsters/will_o_wisp.png` | `images/monsters/will_o_wisp_defeated.png` | PASS (Root + Public) |
| 16 | Cheetah | `images/monsters/cheetah.png` | `images/monsters/cheetah_defeated.png` | PASS (Root + Public) |
| 17 | Draugr | `images/monsters/draugr.png` | `images/monsters/draugr_defeated.png` | PASS (Root + Public) |
| 18 | Hobgoblin Captain | `images/monsters/hobgoblin_captain.png` | `images/monsters/hobgoblin_captain_defeated.png` | PASS (Root + Public) |
| 19 | Displacer Beast | `images/monsters/displacer_beast.png` | `images/monsters/displacer_beast_defeated.png` | PASS (Root + Public) |
| 20 | Shambling Mound | `images/monsters/shambling_mound.png` | `images/monsters/shambling_mound_defeated.png` | PASS (Root + Public) |
| 21 | Leucrotta | `images/monsters/leucrotta.png` | `images/monsters/leucrotta_defeated.png` | PASS (Root + Public) |
| 22 | Dire Boar | `images/monsters/dire_boar.png` | `images/monsters/dire_boar_defeated.png` | PASS (Root + Public) |
| 23 | Forest Drake | `images/monsters/forest_drake.png` | `images/monsters/forest_drake_defeated.png` | PASS (Root + Public) |
| 24 | Otyugh | `images/monsters/otyugh.png` | `images/monsters/otyugh_defeated.png` | PASS (Root + Public) |
| 25 | Wyvern | `images/monsters/wyvern.png` | `images/monsters/wyvern_defeated.png` | PASS (Root + Public) |
| 26 | Girallon | `images/monsters/girallon.png` | `images/monsters/girallon_defeated.png` | PASS (Root + Public) |
| 27 | Catoblepas | `images/monsters/catoblepas.png` | `images/monsters/catoblepas_defeated.png` | PASS (Root + Public) |
| 28 | Barrow Wight | `images/monsters/barrow_wight.png` | `images/monsters/barrow_wight_defeated.png` | PASS (Root + Public) |
| 29 | Green Hag | `images/monsters/green_hag.png` | `images/monsters/green_hag_defeated.png` | PASS (Root + Public) |
| 30 | Orc Warchief | `images/monsters/orc_warchief.png` | `images/monsters/orc_warchief_defeated.png` | PASS (Root + Public) |

---

## 9. Modified and Added Files

- **Domain & Views:**
  - `src/domain/encounters/engine.js` — Blocked `ignoreEncounter` when `effectiveAmbush === 1` (`level > 1 && is_ambush === 1`).
  - `src/domain/bounties/board.js` — Blocked `abandonContract` when the player is currently caught in an active `DISCOVERED` ambush with the bounty quarry.
  - `src/domain/combat/engine.js` — Added `+4` surprise initiative bonus & tie-breaker for ambushing monsters in `startCombat`, and added Level 1 Round-1 "Death's Door" lethal spike protection (`eligibleForLevel1SpikeGuard`) in `executeCombatRound`.
  - `src/domain/character/rules.js` — Tagged starter gear and starter potions with `modifications = '{"is_starter":true}'` in `createCharacter`, and exposed `ii.modifications` in inventory queries.
  - `src/domain/economy/shop.js` — Blocked selling items with `is_starter === true` in `sellItem`.
  - `src/domain/monsters/persistence.js` — Added `isMuleFeed` detection in `handlePlayerDeath` to prevent zero-XP Level 1 mule alts from feeding starter gold/gear to persistent monsters.
  - `src/domain/combat/loot.js` — Enforced `AND COALESCE(id.min_cr, 0) <= ?` on non-magical `loot_table_entries` and fallback queries, and tuned `MAGIC_DROP_CHANCES`.
  - `src/domain/combat/abilities.js` — Added special ability profiles for all 30 new monsters.
  - `src/views/game.ejs` — Updated Stage 1 (`DISCOVERED`) ambush alert text, `⚔️ Face the Ambush` button label, and disabled `🚫 Retreat Cut Off (Ambushed)` button.
- **Database Seeds & Assets:**
  - `db/seeds/010_seed_night_work_loot_and_30_monsters.sql` — Rebalanced Level 1 outlier monsters, set progressive `min_cr` tiers, added 4 new creature-type loot tables, linked all 55 unlinked active items into `loot_table_entries`, and seeded all 30 new monsters + `monster_terrains`.
  - `images/monsters/*.png` & `public/images/monsters/*.png` — 60 new monster illustrations (30 living + 30 `_defeated.png`).
- **Automated Tests:**
  - `tests/night_work_gameplay_loot_monsters.test.js` — New end-to-end test suite covering all Night-Work features.
  - `tests/core_stabilization_e2e.test.js`, `tests/defeated_monster_art.test.js`, `tests/rebalance_and_special_abilities.test.js` — Updated catalog counts (`68 -> 98` monsters, `9 -> 10` seeds).

---

## 10. Automated Tests Executed

Executed `npm run setup:db` followed by `npm test` (`node --test`):
- **Total Suites:** `17`
- **Total Tests:** `219`
- **Passed:** `219`
- **Failed:** `0`

Key new tests in `tests/night_work_gameplay_loot_monsters.test.js`:
1. `1A. Ambush Mechanics`: Verifies Level 1 ambush immunity, Level 2+ `ignoreEncounter` block, Level 2+ `abandonContract` block, and `+4` surprise initiative + tie-breaker in `startCombat`.
2. `1B. Level 1 Unfair Death Protection`: Verifies `Orc`, `Human Zombie`, `Gnoll`, and `Hyena` stat rebalancing, Round-1 "Death's Door" clamping at `1 HP` for a healthy Level 1 hero, and normal death in Round 2.
3. `1C. Permadeath & Starter Gear Exploit Fix`: Verifies `sellItem` blocks selling unequipped starter weapons and starter potions, organic first death transfers 50% gold, and subsequent zero-XP Level 1 mule alts transfer `0` gold and `0` starter items.
4. `2. Loot Table Fix & Progression Gating`: Verifies `0` active equipment items remain unlinked in `loot_table_entries`, all 4 new creature-type loot tables are populated, and low-CR monsters strictly respect `min_cr`.
5. `3, 4 & 5. All 30 New Monsters & 60 Artworks`: Verifies exact `6`-per-level and `6`-primary-per-terrain distribution, spawn eligibility via `selectMonsterForTerrainAndHero`, 9-stage description completeness and Stage 1 secrecy, ability profile mapping, and disk presence of all 60 image files in both `images/monsters/` and `public/images/monsters/`.

---

## 11. Items Intentionally Deferred / Not Touched in This Session

Per project constraints:
- **No Firebase / Spark / Firestore / hosting / deployment work** was performed.
- **World map size (`15x15`) and active terrain types** were kept unchanged (`DESERT`, `COAST`, `OCEAN`, `MOUNTAINS`, `UNDERGROUND_RUINS` remain future expansion terrains).
- **Ranger Favored Enemy options** were kept unchanged until new world regions open.
- **10 Buff Potions & Specialty Accessories** (`Potion of Barkskin`, `Potion of Bull's Strength`, `Potion of Cat's Grace`, `Potion of Shield of Faith`, `Potion of Heroism`, `Elixir of Dragon's Breath`, `Antitoxin`, `Boots of Elvenkind`, `Cloak of Resistance +1`, `Bracers of Armor +1`) remain intentionally excluded from `loot_table_entries` until out-of-combat/in-combat temporary buff duration and accessory slot UI are activated in a future phase.

---

## 12. Recommended Next Steps

1. **World Expansion & Inactive Monster Activation:** When expanding the map or opening dungeon/desert/coastal zones (`UNDERGROUND_RUINS`, `DESERT`, `COAST`), the 12 existing non-active-terrain monsters (`Darkmantle`, `Giant Crab`, `Mummy`, `Iron Cobra`, `Skeletal Champion`, `Duergar`, `Drow`, `Doppelganger`, `Cloaker`, `Phase Spider`, `Morlock`, `Sahuagin`) will immediately become encounterable without needing new art.
2. **Buff Potions & Accessory Slot UI:** Activate the 6 buff/alchemical potions (`Antitoxin`, `Barkskin`, `Bull's Strength`, `Cat's Grace`, `Shield of Faith`, `Heroism`) and remaining accessory slots (`Cloak`, `Boots`, `Bracers`) so the final 10 deferred items can be linked into `loot_table_entries`.
3. **Level 6–8 Endgame Bestiary & Boss Contracts:** Extend the Watcher's Board with multi-stage regional boss contracts once players regularly reach Level 5+.
