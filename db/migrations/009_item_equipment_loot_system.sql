-- 009_item_equipment_loot_system.sql: Item, Equipment, Rarity, and Data-Driven Loot System
-- Extends item_definitions with rarity and subtype, and establishes data-driven loot tables.

-- 1. Extend item_definitions with rarity and subtype
ALTER TABLE item_definitions ADD COLUMN rarity TEXT NOT NULL DEFAULT 'COMMON' CHECK (rarity IN ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'));
ALTER TABLE item_definitions ADD COLUMN subtype TEXT;

-- 2. Data-Driven Loot Tables System
CREATE TABLE IF NOT EXISTS loot_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    creature_type TEXT,
    min_cr REAL NOT NULL DEFAULT 0,
    max_cr REAL NOT NULL DEFAULT 99,
    gold_multiplier REAL NOT NULL DEFAULT 1.0,
    item_chance REAL NOT NULL DEFAULT 0.25,
    magic_chance_multiplier REAL NOT NULL DEFAULT 1.0,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loot_table_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loot_table_id INTEGER NOT NULL REFERENCES loot_tables(id) ON DELETE CASCADE,
    item_definition_id INTEGER NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
    weight INTEGER NOT NULL DEFAULT 10 CHECK (weight > 0),
    min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity > 0),
    max_quantity INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity >= min_quantity),
    rarity TEXT CHECK (rarity IN ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY')),
    UNIQUE (loot_table_id, item_definition_id)
);

-- 3. Indexes for fast inventory and loot resolution
CREATE INDEX IF NOT EXISTS idx_items_rarity ON item_definitions(rarity);
CREATE INDEX IF NOT EXISTS idx_items_subtype ON item_definitions(subtype);
CREATE INDEX IF NOT EXISTS idx_loot_tables_type ON loot_tables(creature_type, is_active);
CREATE INDEX IF NOT EXISTS idx_loot_table_entries_table ON loot_table_entries(loot_table_id);

-- 4. Set authentic rarity and subtypes for existing items
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'DAGGER' WHERE name = 'Dagger';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SWORD' WHERE name = 'Shortsword';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Longsword';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Greatsword';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'AXE' WHERE name = 'Battleaxe';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'AXE' WHERE name = 'Greataxe';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'AXE' WHERE name = 'Handaxe';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HAMMER' WHERE name = 'Warhammer';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'MACE' WHERE name = 'Light Mace';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MACE' WHERE name = 'Heavy Mace';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MACE' WHERE name = 'Morningstar';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SPEAR' WHERE name = 'Spear';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SPEAR' WHERE name = 'Shortspear';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'STAFF' WHERE name = 'Quarterstaff';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'POLEARM' WHERE name = 'Halberd';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'POLEARM' WHERE name = 'Scythe';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'FLAIL' WHERE name = 'Heavy Flail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'FLAIL' WHERE name = 'Light Flail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Scimitar';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Rapier';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'CLUB' WHERE name = 'Club';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'CLUB' WHERE name = 'Greatclub';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'POLEARM' WHERE name = 'Glaive';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Falchion';

-- Ranged weapons
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Shortbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Longbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Composite Shortbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Composite Longbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'CROSSBOW' WHERE name = 'Light Crossbow';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'CROSSBOW' WHERE name = 'Heavy Crossbow';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'CROSSBOW' WHERE name = 'Hand Crossbow';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SLING' WHERE name = 'Sling';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'THROWN' WHERE name = 'Javelin';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'THROWN' WHERE name = 'Dart';

-- Armor & Shields
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Padded Armor';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Leather Armor';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Studded Leather Armor';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Chain Shirt';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Hide Armor';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Scale Mail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Chainmail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Breastplate';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HEAVY_ARMOR' WHERE name = 'Splint Mail';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HEAVY_ARMOR' WHERE name = 'Banded Mail';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEAVY_ARMOR' WHERE name = 'Half-Plate';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEAVY_ARMOR' WHERE name = 'Full Plate';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Armored Coat';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'MEDIUM_ARMOR' WHERE name = 'Agile Breastplate';

UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SHIELD' WHERE name = 'Buckler';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SHIELD' WHERE name = 'Light Wooden Shield';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Light Steel Shield';
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'SHIELD' WHERE name = 'Heavy Wooden Shield';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Heavy Steel Shield';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Tower Shield';

-- Potions
UPDATE item_definitions SET rarity = 'COMMON', subtype = 'HEALING_POTION' WHERE name = 'Minor Healing Potion';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HEALING_POTION' WHERE name = 'Potion of Cure Light Wounds';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HEALING_POTION' WHERE name = 'Potion of Cure Moderate Wounds';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEALING_POTION' WHERE name = 'Potion of Cure Serious Wounds';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEALING_POTION' WHERE name = 'Potion of Cure Critical Wounds';

-- Magical weapons (+1 and +2)
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Longsword +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Shortsword +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'DAGGER' WHERE name = 'Dagger +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'AXE' WHERE name = 'Battleaxe +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'HAMMER' WHERE name = 'Warhammer +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MACE' WHERE name = 'Heavy Mace +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SWORD' WHERE name = 'Greatsword +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Shortbow +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'BOW' WHERE name = 'Longbow +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'CROSSBOW' WHERE name = 'Light Crossbow +1';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'SWORD' WHERE name = 'Longsword +2';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'BOW' WHERE name = 'Longbow +2';

-- Magical armor & shields (+1 and +2)
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Leather Armor +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'LIGHT_ARMOR' WHERE name = 'Chain Shirt +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Scale Mail +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Chainmail +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'MEDIUM_ARMOR' WHERE name = 'Breastplate +1';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEAVY_ARMOR' WHERE name = 'Full Plate +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Light Steel Shield +1';
UPDATE item_definitions SET rarity = 'UNCOMMON', subtype = 'SHIELD' WHERE name = 'Heavy Steel Shield +1';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'LIGHT_ARMOR' WHERE name = 'Chain Shirt +2';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'MEDIUM_ARMOR' WHERE name = 'Breastplate +2';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'HEAVY_ARMOR' WHERE name = 'Full Plate +2';
UPDATE item_definitions SET rarity = 'RARE', subtype = 'SHIELD' WHERE name = 'Heavy Steel Shield +2';
