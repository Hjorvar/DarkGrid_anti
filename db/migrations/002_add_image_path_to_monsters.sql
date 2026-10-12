-- 002_add_image_path_to_monsters.sql: Add image_path to monsters table
ALTER TABLE monsters ADD COLUMN image_path TEXT;

-- Populate image_path for existing monsters that have art
UPDATE monsters SET image_path = 'images/monsters/assassin_vine.png' WHERE name = 'Assassin Vine';
UPDATE monsters SET image_path = 'images/monsters/marsh_leech.png' WHERE name = 'Marsh Leech [DEV-PLACEHOLDER]';
UPDATE monsters SET image_path = 'images/monsters/shadow_bramble.png' WHERE name = 'Shadow Bramble [DEV-PLACEHOLDER]';
UPDATE monsters SET image_path = 'images/monsters/feral_wolf.png' WHERE name = 'Feral Wolf [DEV-PLACEHOLDER]';
UPDATE monsters SET image_path = 'images/monsters/grave_troll.png' WHERE name = 'Grave Troll [DEV-PLACEHOLDER]';
