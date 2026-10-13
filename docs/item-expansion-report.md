# Darkgrid — Item, Equipment & Loot Expansion Report

## Overview
This document delivers the comprehensive engineering report for the **Item, Equipment, Inventory & Loot System** expansion in Darkgrid. The implementation introduces an extensible, data-driven item architecture featuring 113 authentic Pathfinder 1e-inspired items, a 5-tier visual rarity model, weighted loot tables, out-of-combat consumable drinking, accessory equipment integration with Armor Class calculations, and atomic permadeath loot transfers.

---

## 1. Core Architectural Pillars

### 1.1 Separation of Definitions and Instances
- **`item_definitions`:** Immutable templates defining game balance, damage expressions, armor bonuses, equip slots, descriptions, rarity, and market prices.
- **`item_instances`:** World state entities representing physical items owned by characters, held by persistent monsters, or circulating in the global market.
- **SQLite Constraint Protection:** Guarantees every instance is owned by exactly one entity (`CHARACTER`, `MONSTER`, or `MARKET`).

### 1.2 Five-Tier Visual Rarity System
Configured via `rarity` on `item_definitions` with dedicated CSS badges:
- `COMMON` (`.rarity-common`, slate gray)
- `UNCOMMON` (`.rarity-uncommon`, emerald green)
- `RARE` (`.rarity-rare`, cobalt blue)
- `EPIC` (`.rarity-epic`, royal purple)
- `LEGENDARY` (`.rarity-legendary`, amber gold with subtle glow)

---

## 2. Item Catalog Summary (113 Total Items)

| Category | Count | Highlights |
|---|---|---|
| **Weapons** | 48 | Dagger, Shortsword, Longsword, Greatsword, Battleaxe, Greataxe, Glaive, Rapier, Shortbow, Longbow, Heavy Crossbow, Holy Avenger +3, Oathbow +3. |
| **Armor** | 24 | Padded, Leather, Studded Leather, Chain Shirt, Scale Mail, Breastplate, Chainmail, Banded Mail, Half-Plate, Full Plate, Bracers of Armor +1. |
| **Shields** | 9 | Buckler, Light Wooden, Light Steel, Heavy Steel, Tower Shield, Spiked Shield. |
| **Potions & Consumables** | 13 | Potion of Cure Light Wounds, Cure Moderate Wounds, Cure Serious Wounds, Barkskin, Bull's Strength, Cat's Grace, Shield of Faith, Heroism, Dragon's Breath, Antitoxin, Draught of Troll's Blood. |
| **Treasures & Valuables** | 14 | Uncut Garnet, Polished Bloodstone, Rough Emerald, Flawless Sapphire, Star Ruby, Ancient Silver Chalice, Gilded Reliquary, Carved Mammoth Tusk, Jeweled Ceremonial Dagger, Amber Dragon Tear, Royal Signet Ring, Obsidian Runestone, Silk Brocade Tapestry, Crown of the Sunken King. |
| **Magical Accessories** | 5 | Ring of Protection +1, Cloak of Resistance +1, Amulet of Natural Armor +1, Belt of Giant Strength +2, Boots of Elvenkind. |

---

## 3. Equipment & Combat Integration

### 3.1 Armor Class Engine
`calculateHeroAC` (`src/domain/combat/rules.js`) computes:
$$\text{AC} = 10 + \text{Armor} + \text{Shield (if active)} + \min(\text{DEX Mod}, \text{Max DEX}) + \text{Deflection} + \text{Natural Armor} + \text{Class Modifiers}$$
- Equipping `Ring of Protection +1` grants +1 deflection AC.
- Equipping `Amulet of Natural Armor +1` grants +1 natural armor AC.
- Two-handed weapons (`is_two_handed = 1`) suppress shield AC while retaining accessory bonuses.
- Airborne monsters (`movement_type = 'FLYING'`) enforce ranged weapons and suppress shield AC.
- Cleric `Holy Radiance` grants +2 AC (or +3 AC at Level 5) against `UNDEAD` enemies.

### 3.2 Out-of-Combat Consumable Drinking
- Route: `POST /game/inventory/use` (`src/routes/game.js`).
- Accessible via the **Backpack modal** with a one-click `🧪 Drink` button.
- Button is dynamically disabled if the hero is at maximum health or in active combat.
- Consumption resolves atomically in a transaction: checks living character, checks out-of-combat state, deletes item instance, rolls heal dice, applies capped HP, and redirects with notification.

---

## 4. Data-Driven Loot Tables & Balancing

### 4.1 Loot Table Architecture
Eight thematic loot tables are seeded in SQLite:
1. `HUMANOID_MUNDANE` (CR 0.0–1.5, 1.0x gold, 25% item chance)
2. `HUMANOID_ELITE` (CR 1.5–10.0, 1.5x gold, 35% item chance)
3. `UNDEAD_HAUNT` (CR 0.0–2.5, 0.8x gold, 20% item chance)
4. `UNDEAD_ANCIENT` (CR 2.5–12.0, 1.8x gold, 40% item chance)
5. `MAGICAL_BEAST_LAIR` (CR 1.0–10.0, 1.2x gold, 30% item chance)
6. `DRAGON_HOARD` (CR 4.0–20.0, 3.5x gold, 75% item chance)
7. `ABERRATION_CACHE` (CR 1.0–12.0, 1.3x gold, 30% item chance)
8. `GENERIC_WILDERNESS` (CR 0.0–20.0, 1.0x gold, 25% item chance)

### 4.2 Core Constraints
- **Ordinary Animal Rule:** Monsters with `creature_type = 'ANIMAL'` strictly drop 0 gold and 0 items.
- **50-Item Capacity Limit:** Loot generation checks active character inventory count; if $\ge 50$, sets `backpackFull = true` and halts item creation.
- **Magic Drop Scaling:** Base 0.5% at CR $< 1.0$, scaling up to 3.0% at CR $\ge 5.0$, with item CR gating.

---

## 5. Statistical Simulation Results (30,000 Rolls)

Executed via `node scripts/simulate_loot_balance.js`:
- **Low CR (10k encounters):** 54.9% gold drop (avg 3.0 gp), 28.7% item drop (88.0% Common, 12.0% Uncommon, 0% Rare/Epic/Legendary, 1.5% magic drops).
- **Mid CR (10k encounters):** 54.7% gold drop (avg 12.0 gp), 28.0% item drop (88.7% Common, 11.3% Uncommon, 0% Rare/Epic/Legendary, 3.8% magic drops).
- **High CR Dragon Hoard (10k encounters):** 80.0% gold drop (avg 406.1 gp), 95.6% item drop (60.4% Rare, 19.3% Epic, 20.3% Legendary, 92.8% gems and treasures).
- **Animal Verification (1k rolls):** Exactly 0 gold and 0 items dropped.
- **Capacity Verification:** 50 items correctly halted loot drop and flagged `backpackFull = true`.

---

## 6. Permadeath & Persistent Monster Loot Atomicity

When a hero perishes:
- 50% gold is transferred to the persistent monster; 50% is destroyed.
- 50% of items are transferred up to a 20-item cap (prioritizing magical items, then highest value).
- The monster locks to the tile with a **+10% Max HP boost**.
- Victorious heroes defeat the monster to reclaim 100% of stored gold and held items with **zero item duplication**.

---

## 7. Verification & Automated Test Suite

All **151 automated tests** pass with 100% success in under 5 seconds (`node --test`):
- `tests/item_equipment_loot_system.test.js`: 15 dedicated assertions covering schema integrity, rarity constraints, data-driven loot generation, out-of-combat consumable consumption, accessory AC calculations, two-handed shield suppression, and permadeath loot atomicity.
- `tests/equipment_http_flow.test.js`: Full end-to-end HTTP integration for character creation, equip/unequip, market trading, primary weapon preference, and out-of-combat potion drinking via Backpack modal.
- `tests/overnight_systems.test.js` & `tests/combat_system.test.js`: Complete combat rules, abilities, and permadeath regression protection.
