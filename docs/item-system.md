# Darkgrid — Item & Inventory System Architecture

## Overview
The Darkgrid Item & Inventory System is an extensible, data-driven framework rooted in Pathfinder 1e dark-fantasy roleplaying mechanics. It separates immutable **Item Definitions** (`item_definitions`) from mutable **Item Instances** (`item_instances`), supporting atomic state transitions across inventory, equipped armaments, persistent monsters, market stalls, and consumables.

---

## 1. Database Architecture & Schema

### 1.1 Item Definitions (`item_definitions`)
Defines the base template, mechanics, visual badges, and market attributes of all items:
- `id`: Stable integer primary key.
- `name`: Unique English display name (e.g., `Oathbow +3`, `Ring of Protection +1`).
- `category`: Core classification (`WEAPON`, `ARMOR`, `SHIELD`, `POTION`, `OTHER`).
- `subtype`: Granular specification (`MELEE_SIMPLE`, `MELEE_MARTIAL`, `RANGED_MARTIAL`, `LIGHT`, `MEDIUM`, `HEAVY`, `SHIELD`, `POTION`, `TREASURE`, `WONDROUS`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`).
- `rarity`: Configurable rarity tier (`COMMON`, `UNCOMMON`, `RARE`, `EPIC`, `LEGENDARY`).
- `description`: Atmospheric dark-fantasy lore and visual cue.
- `buy_price` / `sell_price`: Merchant valuation in gold pieces (gp).
- `is_magical`: Binary flag indicating magical enchantment.
- `damage_dice` / `damage_type`: Combat damage expression (e.g. `1d8`, `2d6`) and typing (`SLASHING`, `PIERCING`, `BLUDGEONING`).
- `armor_bonus` / `shield_bonus`: Flat d20 Armor Class contribution.
- `weapon_range_type`: Tactical designation (`MELEE` vs `RANGED`).
- `is_two_handed`: Two-handed wielding flag (suppresses shield AC).
- `equip_slot`: Target equipment slot (`MELEE`, `RANGED`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`).
- `allowed_classes`: JSON array constraining class access (e.g. `["FIGHTER","RANGER","CLERIC"]`).
- `combat_effect_desc`: Human-readable combat modifier summary.
- `heal_dice` / `heal_flat`: Consumable restoration metrics.
- `attributes`: Flexible JSON payload for custom modifiers (e.g. `{"deflection_ac": 1}`, `{"potion_type": "healing"}`).

### 1.2 Item Instances (`item_instances`)
Represents an individual physical item in the game world:
- `id`: Unique instance ID.
- `item_definition_id`: Foreign key to `item_definitions.id`.
- `owner_type`: Ownership discriminator (`CHARACTER`, `MONSTER`, `MARKET`).
- `owner_character_id`: Foreign key to `characters.id` (null if not owned by a player).
- `owner_monster_id`: Foreign key to `monster_instances.id` (null if not held by a persistent monster).
- `equipped_slot`: Currently occupied gear slot (`MELEE`, `RANGED`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`), or `NULL` if stored in the backpack.
- `modifications`: JSON store for individual instance enhancements.

### 1.3 Strict SQLite Ownership Constraints
Table check constraints prevent illegal multi-ownership or orphan instances:
```sql
CHECK (
    (owner_type = 'CHARACTER' AND owner_character_id IS NOT NULL AND owner_monster_id IS NULL)
    OR (owner_type = 'MONSTER' AND owner_character_id IS NULL AND owner_monster_id IS NOT NULL)
    OR (owner_type = 'MARKET' AND owner_character_id IS NULL AND owner_monster_id IS NULL)
)
```

---

## 2. Item Catalog Summary (113 Items)

The Darkgrid item database contains **113 authentic items** spanning 5 core categories and 14 thematic subtypes:

| Category | Count | Subtypes Included | Examples |
|---|---|---|---|
| **WEAPON** | 48 | `MELEE_SIMPLE`, `MELEE_MARTIAL`, `MELEE_EXOTIC`, `RANGED_SIMPLE`, `RANGED_MARTIAL` | Dagger, Longsword, Greatsword, Battleaxe, Greataxe, Glaive, Rapier, Shortbow, Longbow, Heavy Crossbow, Holy Avenger +3, Oathbow +3 |
| **ARMOR** | 24 | `LIGHT`, `MEDIUM`, `HEAVY` | Padded, Leather, Studded Leather, Chain Shirt, Scale Mail, Breastplate, Chainmail, Banded Mail, Half-Plate, Full Plate, Bracers of Armor +1 |
| **SHIELD** | 9 | `SHIELD` (Buckler, Light Steel, Heavy Steel, Tower Shield) | Buckler, Light Wooden Shield, Light Steel Shield, Heavy Steel Shield, Tower Shield, Spiked Shield |
| **POTION** | 13 | `POTION` (Healing, Enhancement, Defensive) | Potion of Cure Light Wounds, Cure Moderate Wounds, Cure Serious Wounds, Barkskin (+2 AC), Bull's Strength (+2 Atk/Dmg), Cat's Grace (+2 AC), Shield of Faith (+2 Deflection), Heroism, Dragon's Breath, Antitoxin, Draught of Troll's Blood |
| **OTHER / TREASURES / ACCESSORIES** | 19 | `TREASURE`, `WONDROUS`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET` | Uncut Garnet, Polished Bloodstone, Flawless Sapphire, Star Ruby, Ancient Silver Chalice, Gilded Reliquary, Ring of Protection +1, Cloak of Resistance +1, Amulet of Natural Armor +1, Belt of Giant Strength +2, Boots of Elvenkind |

---

## 3. Rarity System Architecture

Darkgrid implements a 5-tier rarity model designed to deliver thrilling progression without creating invincible characters:

```
COMMON (Gray)  ──>  UNCOMMON (Green)  ──>  RARE (Blue)  ──>  EPIC (Purple)  ──>  LEGENDARY (Gold)
```

| Rarity | Badge Class | Color | Drop Baseline | Description |
|---|---|---|---|---|
| `COMMON` | `.rarity-common` | `#94a3b8` | 75% – 90% | Standard military and rustic equipment (Daggers, Clubs, Padded Armor). |
| `UNCOMMON` | `.rarity-uncommon` | `#4ade80` | 10% – 20% | Quality forged arms, steel armaments, and basic restorative draughts. |
| `RARE` | `.rarity-rare` | `#60a5fa` | 1% – 5% | Minor enchantments (+1 gear), superior jewels, and potent concoctions. |
| `EPIC` | `.rarity-epic` | `#c084fc` | 0.2% – 1% | Remarkable wondrous items (+2 attributes, major relics). |
| `LEGENDARY` | `.rarity-legendary` | `#fbbf24` | < 0.1% | Mythic masterworks (`Holy Avenger +3`, `Oathbow +3`, `Crown of the Sunken King`). |

### Design Philosophy
A `LEGENDARY` weapon is coveted because of its prestige, specialized d20 modifiers (+3 Attack, critical synergies), and rich narrative weight—never through absurd stat inflation that breaks the core d20 math.

---

## 4. Consumable Consumption & State Integrity

Consumables (potions and curative elixirs) feature strict server-side validation:
1. **Out-of-Combat Drinking:** Accessible directly from the Backpack modal via `POST /game/inventory/use`.
2. **Full HP Rejection:** If the hero is at maximum health, consumption is rejected with `Hero is already at maximum health.`, preserving the potion.
3. **Atomic Consumption:** In a single database transaction (`withTransaction`), the item instance is deleted from `item_instances`, the dice formula is resolved (e.g. `1d8+1`), and the character's `current_hp` is updated, capped at `max_hp`.
4. **Combat Guard:** Consumable usage through backpack routes is strictly forbidden during active combat encounters (`status = 'IN_COMBAT'`). In combat, potions must be consumed through the dedicated combat action dropdown.
5. **Permadeath Guard:** Dead heroes (`is_alive = 0`) cannot use items.

---

## 5. Capacity & Backpack Management
- **M6 Capacity Rule:** Heroes have a hard inventory cap of **50 items** (`WHERE owner_type = 'CHARACTER' AND owner_character_id = ?`).
- When looting after victory, if the backpack is at 50 items, `backpackFull: true` is flagged, preventing inventory overflow while still allowing gold acquisition.
- In town markets, players can liquidate surplus gear at 50% buy price (or 40% for magical arms).
