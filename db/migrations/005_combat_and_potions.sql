-- 005_combat_and_potions.sql: Add combat columns to encounters and seed basic items
-- Part of Phase 2 & 3 Combat System & Persistent Monsters implementation.

-- 1. Add combat control columns to encounters table
ALTER TABLE encounters ADD COLUMN initiative_winner TEXT CHECK (initiative_winner IN ('HERO', 'MONSTER'));
ALTER TABLE encounters ADD COLUMN hero_initiative INTEGER;
ALTER TABLE encounters ADD COLUMN monster_initiative INTEGER;
ALTER TABLE encounters ADD COLUMN monster_max_hp INTEGER;
ALTER TABLE encounters ADD COLUMN last_health_bracket INTEGER DEFAULT 100;

-- 2. Index for performant combat event lookups by encounter and round
CREATE INDEX IF NOT EXISTS idx_combat_events_encounter ON combat_events(encounter_id, round_number);

-- 3. Populate standard starter item definitions for weapons, armor, and healing potions
INSERT OR IGNORE INTO item_definitions (
    name, category, description, buy_price, sell_price, is_magical,
    damage_dice, armor_bonus, shield_bonus, equip_slot, allowed_classes, attributes
) VALUES 
(
    'Minor Healing Potion',
    'POTION',
    'A small crystal phial filled with glowing crimson elixir that restores 1d8+1 vitality when consumed.',
    25,
    12,
    1,
    NULL,
    0,
    0,
    NULL,
    '["FIGHTER","RANGER","CLERIC"]',
    '{"heal_dice": "1d8+1", "min_heal": 2, "max_heal": 9}'
),
(
    'Longsword',
    'WEAPON',
    'A versatile steel blade forged for lethal slashes and thrusts.',
    15,
    7,
    0,
    '1d8',
    0,
    0,
    'MAIN_HAND',
    '["FIGHTER"]',
    '{"weapon_type": "melee", "damage_type": "slashing"}'
),
(
    'Chain Shirt',
    'ARMOR',
    'Interlinked steel rings worn between layers of quilted fabric, providing reliable protection.',
    100,
    50,
    0,
    NULL,
    4,
    0,
    'CHEST',
    '["FIGHTER"]',
    '{"armor_type": "light"}'
),
(
    'Shortbow',
    'WEAPON',
    'A curved yew bow strung with seasoned cord, capable of driving arrows swiftly through armor.',
    30,
    15,
    0,
    '1d6',
    0,
    0,
    'MAIN_HAND',
    '["FIGHTER","RANGER"]',
    '{"weapon_type": "ranged", "damage_type": "piercing"}'
),
(
    'Leather Armor',
    'ARMOR',
    'Tough boiled leather breastplate and greaves offering flexibility and silence in the wilderness.',
    10,
    5,
    0,
    NULL,
    2,
    0,
    'CHEST',
    '["FIGHTER","RANGER","CLERIC"]',
    '{"armor_type": "light"}'
),
(
    'Heavy Mace',
    'WEAPON',
    'A fluted iron mace designed to crush bone and armor with immense bludgeoning force.',
    12,
    6,
    0,
    '1d8',
    0,
    0,
    'MAIN_HAND',
    '["FIGHTER","CLERIC"]',
    '{"weapon_type": "melee", "damage_type": "bludgeoning"}'
),
(
    'Scale Mail',
    'ARMOR',
    'Overlapping scales of hammered bronze and iron riveted to a heavy leather tunic.',
    50,
    25,
    0,
    NULL,
    5,
    0,
    'CHEST',
    '["FIGHTER","CLERIC"]',
    '{"armor_type": "medium"}'
);
