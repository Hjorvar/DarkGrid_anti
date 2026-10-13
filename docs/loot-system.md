# Darkgrid — Loot Generation & Drop System Specification

## Overview
The Darkgrid Loot System delivers thematic, data-driven monster rewards without hardcoded item pools or out-of-control loot inflation. Drops are resolved dynamically by querying SQLite `loot_tables` and `loot_table_entries` matching the defeated monster's **Challenge Rating (CR)**, **Creature Classification**, and **Treasure Type**.

---

## 1. Data-Driven Loot Tables

Loot distributions are governed by the `loot_tables` schema (`db/migrations/009_item_equipment_loot_system.sql`):

| Table Code | Creature Type | Min CR | Max CR | Gold Mult | Item Chance | Theme |
|---|---|---|---|---|---|---|
| `HUMANOID_MUNDANE` | `HUMANOID` | 0.0 | 1.5 | 1.0x | 25% | Crude iron weapons, daggers, shortbows, light shields, leather armor. |
| `HUMANOID_ELITE` | `HUMANOID` | 1.5 | 10.0 | 1.5x | 35% | Fine steel arms, longswords, chainmail, curative potions, heavy shields. |
| `UNDEAD_HAUNT` | `UNDEAD` | 0.0 | 2.5 | 0.8x | 20% | Rusted blades, ancient bronze artifacts, garnets, minor relics. |
| `UNDEAD_ANCIENT` | `UNDEAD` | 2.5 | 12.0 | 1.8x | 40% | Runestones, ceremonial daggers, ancient silver chalices, enchanted arms. |
| `MAGICAL_BEAST_LAIR`| `MAGICAL_BEAST` | 1.0 | 10.0 | 1.2x | 30% | Dragon tears, mammoth tusks, curative potions, enchanted rings. |
| `DRAGON_HOARD` | `DRAGON` | 4.0 | 20.0 | 3.5x | 75% | Flawless sapphires, star rubies, gilded reliquaries, legendary artifacts. |
| `ABERRATION_CACHE` | `ABERRATION` | 1.0 | 12.0 | 1.3x | 30% | Obsidian runes, strange alchemical draughts, wondrous accessories. |
| `GENERIC_WILDERNESS`| `NULL` (Fallback) | 0.0 | 20.0 | 1.0x | 25% | Rustic survival gear, traveler's daggers, clubs, rough gems. |

### 1.1 Weighted Selection Algorithm
Within each table, items have positive integer weights (`weight >= 1`). Drops are chosen via cumulative weighted random distribution:
$$P(\text{item}_i) = \frac{\text{weight}_i}{\sum_{j=1}^{N} \text{weight}_j}$$
Common military goods have high weights (e.g. 10–15), while rare treasures and magical relics carry low weights (e.g. 1–3).

---

## 2. Ordinary Animal Rule

> **Ironclad Design Rule:** Ordinary wild beasts and predatory animals (`creature_type = 'ANIMAL'`, e.g. Wolves, Boars, Vipers) **strictly never drop gold pieces or manufactured armaments**.

When `generateMonsterLoot` evaluates an enemy with `creature_type === 'ANIMAL'`:
- Gold awarded is immediately forced to **0**.
- Items awarded array is empty (`[]`).
- Database item queries are bypassed entirely, saving database I/O.

---

## 3. Gold Generation Formulas

Monsters drop gold according to their Challenge Rating and Treasure Classification:

### 3.1 Base Gold by CR
| Monster CR | Min Gold | Max Gold | Typical Encounters |
|---|---|---|---|
| CR $\le 0.5$ | 1 gp | 5 gp | Kobold, Goblin Scout, Skeleton |
| CR $\le 1.0$ | 3 gp | 10 gp | Orc Warrior, Zombie |
| CR $\le 2.0$ | 6 gp | 18 gp | Bugbear Brute, Ghoul |
| CR $\le 3.0$ | 10 gp | 30 gp | Ogre, Harpy |
| CR $\le 4.0$ | 16 gp | 45 gp | Minotaur, Gargoyle |
| CR $\le 5.0$ | 25 gp | 70 gp | Troll, Wraith |
| CR $> 5.0$ | 35 gp | 100 gp | Wyvern (CR 6), Young Green Dragon (CR 8) |

### 3.2 Treasure Type Multipliers
- `None`: 0% chance of gold.
- `Incidental`: 15% chance of gold; rolled amount multiplied by 0.5x.
- `Standard`: 55% chance of gold; rolled amount multiplied by 1.0x.
- `Double`: 80% chance of gold; rolled amount multiplied by 2.0x (or up to 3.5x for Dragon Hoards).
- `NPC Gear`: 35% chance of gold, 45% chance of manufactured weapons/armor.

---

## 4. Magical Drop Probabilities

Magical item drops are strictly tuned to ensure magic remains mysterious, rare, and deeply rewarding:

| Monster CR | Base Magic Drop Chance |
|---|---|
| $\text{CR} < 1.0$ | 0.5% (1 in 200) |
| $\text{CR} = 1.0$ | 1.0% (1 in 100) |
| $\text{CR} = 2.0$ | 1.5% (1 in 66) |
| $\text{CR} = 3.0$ | 2.0% (1 in 50) |
| $\text{CR} = 4.0$ | 2.5% (1 in 40) |
| $\text{CR} \ge 5.0$ | 3.0% (1 in 33) |

Magical candidates are filtered by the monster's CR (`min_cr <= monster.challenge_rating`), ensuring high-tier relics (`Holy Avenger +3`, `Oathbow +3`, `Belt of Giant Strength +2`) cannot drop from trivial low-level enemies.

---

## 5. Capacity Enforcement & Anti-Hoarding

- **50-Item Capacity Check:** Before creating new item rows, `generateMonsterLoot` counts the player's active inventory:
  ```sql
  SELECT COUNT(*) as count FROM item_instances
  WHERE owner_type = 'CHARACTER' AND owner_character_id = ?
  ```
- If the count is $\ge 50$, the system sets `backpackFull = true` and halts item generation.
- Gold pieces are currency rather than inventory items and continue to be awarded to the character's purse even if the backpack is filled.

---

## 6. Permadeath Transfer & Persistent Monster Recovery

When a hero falls in battle against a monster:
1. **Gold Loss:** 50% of the fallen hero's gold is destroyed; 50% is added to the persistent monster's `held_gold`.
2. **Item Loss:** Every item owned by the fallen hero is subject to a 50% survival roll.
3. **Monster Capacity (20 Items):** Surviving items are prioritized (Magical first, then highest buy price) up to a 20-item cap on the monster. Excess items are lost to the wilderness.
4. **Persistent Monster Empowerment:** The persistent monster locks to the tile, receives a permanent **+10% Max HP boost**, and tracks `kill_count`.
5. **Vengeance & Recovery:** When another hero defeats this persistent monster, **all stored gold and all held items** are awarded to the victorious adventurer with zero item duplication.
