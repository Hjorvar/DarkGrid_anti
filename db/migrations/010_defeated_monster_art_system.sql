-- 010_defeated_monster_art_system.sql: Defeated Monster Art Variants and Storage
-- Adds defeated_image_path column to monsters table for victory screen art integration.

ALTER TABLE monsters ADD COLUMN defeated_image_path TEXT;

-- Update existing monsters that already have image_path
UPDATE monsters 
SET defeated_image_path = REPLACE(image_path, '.png', '_defeated.png')
WHERE image_path IS NOT NULL;
