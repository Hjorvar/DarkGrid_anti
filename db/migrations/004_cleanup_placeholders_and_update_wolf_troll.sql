-- Migration 004: Cleanup development placeholders and update Wolf and Troll to official Pathfinder 1e
-- 1. Remove Shadow Bramble and Marsh Leech safely from monster_terrains and monsters
DELETE FROM monster_terrains 
WHERE monster_id IN (
    SELECT id FROM monsters 
    WHERE name IN ('Shadow Bramble [DEV-PLACEHOLDER]', 'Marsh Leech [DEV-PLACEHOLDER]')
);

DELETE FROM monsters 
WHERE name IN ('Shadow Bramble [DEV-PLACEHOLDER]', 'Marsh Leech [DEV-PLACEHOLDER]');

-- 2. Update Wolf (retaining ID 4 and active encounter with character 14)
UPDATE monsters
SET name = 'Wolf',
    challenge_rating = 1.0,
    solo_level = 1,
    base_hp = 13,
    armor_class = 14,
    attack_bonus = 2,
    damage_dice = '1d6+1',
    xp_reward = 400,
    initiative_bonus = 2,
    source_url = 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Wolf',
    image_path = 'images/monsters/wolf.png',
    creature_type = 'Animal',
    creature_subtype = NULL
WHERE id = 4 OR name = 'Feral Wolf [DEV-PLACEHOLDER]';

-- Ensure Wolf monster_terrains are accurate
UPDATE monster_terrains 
SET is_primary = 0 
WHERE monster_id IN (SELECT id FROM monsters WHERE name = 'Wolf' OR id = 4);

DELETE FROM monster_terrains 
WHERE monster_id IN (SELECT id FROM monsters WHERE name = 'Wolf' OR id = 4)
  AND terrain NOT IN ('FOREST', 'PLAINS', 'HILLS');

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Wolf' OR id = 4;

UPDATE monster_terrains
SET is_primary = 1
WHERE terrain = 'FOREST' AND monster_id IN (SELECT id FROM monsters WHERE name = 'Wolf' OR id = 4);

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Wolf' OR id = 4;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Wolf' OR id = 4;

-- 3. Update Troll (retaining ID 5 and active encounter with character 2)
UPDATE monsters
SET name = 'Troll',
    challenge_rating = 5.0,
    solo_level = 5,
    base_hp = 63,
    armor_class = 16,
    attack_bonus = 8,
    damage_dice = '1d6+5',
    xp_reward = 1600,
    initiative_bonus = 2,
    source_url = 'https://aonprd.com/MonsterDisplay.aspx?ItemName=Troll',
    image_path = 'images/monsters/troll.png',
    creature_type = 'Humanoid',
    creature_subtype = 'giant'
WHERE id = 5 OR name = 'Grave Troll [DEV-PLACEHOLDER]';

-- Ensure Troll monster_terrains are accurate (Mountains primary, Swamp & Underground secondaries)
DELETE FROM monster_terrains 
WHERE monster_id IN (SELECT id FROM monsters WHERE name = 'Troll' OR id = 5);

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 1 FROM monsters WHERE name = 'Troll' OR id = 5;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Troll' OR id = 5;

INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Troll' OR id = 5;
