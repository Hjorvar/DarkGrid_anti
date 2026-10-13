# Darkgrid — Equipment & Armament System Specification

## Overview
Equipment in Darkgrid directly dictates combat survival, armor class calculations, tactical stance options, and d20 combat resolution. The equipment architecture enforces strict Pathfinder 1e-inspired rules regarding weapon wielding, shield mechanics, aerial combat, and accessory item enhancements.

---

## 1. Equipment Slots

A character can equip gear across the following dedicated slots:

| Slot | Category | Description | Constraints |
|---|---|---|---|
| `MELEE` | `WEAPON` | Primary close-quarters weapon. | 1-handed or 2-handed. |
| `RANGED` | `WEAPON` | Primary distance weapon (Bows, Crossbows, Thrown). | Requires ammunition/range logic. |
| `ARMOR` | `ARMOR` | Body protection (Padded, Leather, Mail, Plate). | Imposes Max DEX Bonus. |
| `SHIELD` | `SHIELD` | Offhand defense (Buckler, Light/Heavy Steel, Tower). | Suppressed under specific conditions. |
| `RING` | `OTHER` / `RING` | Wondrous finger ornament (e.g. `Ring of Protection +1`). | Grants deflection AC bonus. |
| `NECK` | `OTHER` / `NECK` | Amulets and periapt talismans (e.g. `Amulet of Natural Armor +1`). | Grants natural armor AC bonus. |
| `CLOAK` | `OTHER` / `CLOAK` | Mantles and capes (e.g. `Cloak of Resistance +1`). | Enhances saving throws and concealment. |
| `BELT` | `OTHER` / `BELT` | Girdles of physical prowess (e.g. `Belt of Giant Strength +2`). | Enhances physical attributes. |
| `FEET` | `OTHER` / `FEET` | Stalking boots and swift footwear (e.g. `Boots of Elvenkind`). | Enhances stealth and maneuverability. |

---

## 2. Armor Class (AC) Calculation Engine

The official Darkgrid Armor Class formula is implemented in `calculateHeroAC` (`src/domain/combat/rules.js`):

$$\text{Total AC} = 10 + \text{Armor Bonus} + \text{Shield Bonus (conditional)} + \min(\text{DEX Mod}, \text{Max DEX}) + \text{Accessory Bonuses} + \text{Class Modifiers}$$

### Detailed Breakdown:
1. **Base AC:** Flat 10.
2. **Armor Bonus:** Added from equipped body armor (0 if unarmored).
3. **Shield Bonus:** Added from equipped shield (+1 for Light, +2 for Heavy, +4 for Tower), **subject to suppression rules**.
4. **Dexterity Modifier:** $\lfloor(\text{DEX} - 10) / 2\rfloor$, capped by armor's `max_dex_bonus` (e.g. Full Plate caps DEX mod at +1; Fighter Armor Training increases this cap by +1 at Level 3 and +2 at Level 7).
5. **Accessory Bonuses:**
   - **Deflection AC:** Granted by `Ring of Protection` (+1 AC).
   - **Natural Armor:** Granted by `Amulet of Natural Armor` (+1 AC).
   - **Bracers of Armor:** Provides armor bonus if greater than equipped armor.
6. **Class Modifiers:**
   - **Cleric Holy Radiance:** Grants +2 AC bonus (increasing to +3 at Level 5) when engaged in combat against `UNDEAD` enemies.

---

## 3. Shield Suppression Mechanics

To preserve tactical authenticity and balance between offensive burst damage and defensive stability, Darkgrid strictly enforces shield suppression:

### 3.1 Two-Handed Melee Weapons
- When the active weapon is two-handed (`is_two_handed = 1`, e.g. `Greatsword`, `Greataxe`, `Quarterstaff`), both hands are required to wield the weapon.
- **Result:** The equipped shield's AC bonus is **suppressed (reduced to 0)** in AC calculations and combat resolution.

### 3.2 Ranged Weapons
- When ranged combat is active (either via player preference against ground targets or enforced against flying threats), both hands are required to draw and loose bowstrings or steady crossbows.
- **Result:** The equipped shield's AC bonus is **suppressed (reduced to 0)**.

### 3.3 Persistence of Accessory Bonuses
Shield suppression does **not** interfere with magical rings or amulets: deflection and natural armor bonuses remain 100% active regardless of weapon stance.

---

## 4. Weapon Selection & Tactical Preferences

### 4.1 Primary Weapon Preference
Players choose their default stance outside combat via the Character Record modal:
- 🗡️ **Melee Preference:** Engages ground monsters in melee.
- 🏹 **Ranged Preference:** Attacks ground monsters at range if a ranged weapon is equipped.

### 4.2 Dynamic Aerial Override
When encountering a monster with `movement_type = 'FLYING'` (e.g. Harpy, Wyvern, Gargoyle, Young Green Dragon):
- The combat engine **automatically enforces ranged combat**.
- If the hero has an equipped ranged weapon (e.g. `Shortbow`, `Longbow`), it is used for all attack and damage rolls.
- If the hero lacks a ranged weapon, attacks suffer an off-balance improvised throwing penalty.
- The shield bonus is automatically suppressed during aerial combat.

---

## 5. Equipment State Transitions & Route Locks

1. **Combat Lock:**
   - Armaments and accessories cannot be equipped or unequipped while engaged in active combat (`status = 'IN_COMBAT'`).
   - Primary weapon preference cannot be toggled during combat.
   - All equipment changes must occur while exploring peacefully or resting in town havens.
2. **Atomic Equipment API:**
   - `POST /game/inventory/equip`: Validates ownership, auto-detects or accepts `targetSlot`, unequips any previously occupying item to backpack, sets `equipped_slot`, and updates SQLite in a single transaction.
   - `POST /game/inventory/unequip`: Resets `equipped_slot = NULL`, returning the item to the backpack.
   - `POST /game/character/primary-weapon`: Toggles player stance between `MELEE` and `RANGED`.
