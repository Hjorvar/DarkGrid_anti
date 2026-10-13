-- 008_seed_defeated_monster_images.sql: Seed defeated monster art paths
-- Ensures all monsters seeded in 002, 003, 004, and 006 have valid defeated_image_path set.

UPDATE monsters 
SET defeated_image_path = REPLACE(image_path, '.png', '_defeated.png')
WHERE image_path IS NOT NULL AND (defeated_image_path IS NULL OR defeated_image_path = '');
