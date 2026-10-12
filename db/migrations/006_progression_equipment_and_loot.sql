-- 006_progression_equipment_and_loot.sql: Schema extensions for Character Progression, Item Database, and Loot
-- Supports Phase A, B, C, D, E, F, G, H, I, J

-- 1. Character Progression & Abilities
ALTER TABLE characters ADD COLUMN favored_enemy_type TEXT;
ALTER TABLE characters ADD COLUMN favored_enemy_subtype TEXT;
ALTER TABLE characters ADD COLUMN cleric_heal_uses INTEGER NOT NULL DEFAULT 0;

-- 2. Monster Treasure Classifications for Pathfinder Loot System
ALTER TABLE monsters ADD COLUMN treasure_type TEXT DEFAULT 'Standard';

-- 3. Item Definitions Enhancements
ALTER TABLE item_definitions ADD COLUMN max_dex_bonus INTEGER;
ALTER TABLE item_definitions ADD COLUMN enhancement_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item_definitions ADD COLUMN weapon_range_type TEXT;
ALTER TABLE item_definitions ADD COLUMN is_two_handed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item_definitions ADD COLUMN pathfinder_source TEXT DEFAULT 'Pathfinder 1e Core Rulebook';
ALTER TABLE item_definitions ADD COLUMN min_cr REAL DEFAULT 0;

-- 4. Update existing items in item_definitions with precise types
UPDATE item_definitions SET weapon_range_type = 'MELEE', is_two_handed = 0 WHERE name = 'Longsword';
UPDATE item_definitions SET weapon_range_type = 'RANGED', is_two_handed = 1 WHERE name = 'Shortbow';
UPDATE item_definitions SET weapon_range_type = 'MELEE', is_two_handed = 0 WHERE name = 'Heavy Mace';
UPDATE item_definitions SET max_dex_bonus = 4 WHERE name = 'Chain Shirt';
UPDATE item_definitions SET max_dex_bonus = 6 WHERE name = 'Leather Armor';
UPDATE item_definitions SET max_dex_bonus = 3 WHERE name = 'Scale Mail';

-- 5. Index for performant market and equipment queries
CREATE INDEX IF NOT EXISTS idx_items_slot_owner ON item_instances(owner_character_id, equipped_slot);
CREATE INDEX IF NOT EXISTS idx_items_market_owner ON item_instances(owner_type) WHERE owner_type = 'MARKET';
