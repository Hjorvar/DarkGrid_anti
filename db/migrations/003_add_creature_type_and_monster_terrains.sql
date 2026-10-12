-- 003_add_creature_type_and_monster_terrains.sql: Add creature types and monster_terrains join table
-- Implements Phase 1.5 schema enhancement for normalized habitat mapping and Pathfinder 1e creature typing.

-- 1. Add creature_type and creature_subtype columns to monsters table
ALTER TABLE monsters ADD COLUMN creature_type TEXT;
ALTER TABLE monsters ADD COLUMN creature_subtype TEXT;

-- 2. Populate creature_type and creature_subtype for existing monsters
UPDATE monsters SET creature_type = 'Plant', creature_subtype = NULL WHERE name = 'Assassin Vine';
UPDATE monsters SET creature_type = 'Vermin', creature_subtype = 'aquatic' WHERE name = 'Marsh Leech [DEV-PLACEHOLDER]';
UPDATE monsters SET creature_type = 'Plant', creature_subtype = NULL WHERE name = 'Shadow Bramble [DEV-PLACEHOLDER]';
UPDATE monsters SET creature_type = 'Animal', creature_subtype = NULL WHERE name = 'Feral Wolf [DEV-PLACEHOLDER]';
UPDATE monsters SET creature_type = 'Humanoid', creature_subtype = 'giant' WHERE name = 'Grave Troll [DEV-PLACEHOLDER]';
UPDATE monsters SET creature_type = 'Undead', creature_subtype = NULL WHERE name = 'Ghoul';
UPDATE monsters SET creature_type = 'Vermin', creature_subtype = NULL WHERE name = 'Giant Spider';
UPDATE monsters SET creature_type = 'Aberration', creature_subtype = NULL WHERE name = 'Choker';
UPDATE monsters SET creature_type = 'Aberration', creature_subtype = NULL WHERE name = 'Rust Monster';
UPDATE monsters SET creature_type = 'Magical Beast', creature_subtype = NULL WHERE name = 'Manticore';

-- 3. Create monster_terrains relational join table
CREATE TABLE IF NOT EXISTS monster_terrains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monster_id INTEGER NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    terrain TEXT NOT NULL CHECK (terrain IN (
        'AQUATIC', 'OCEAN', 'RIVER_LAKE', 'FOREST', 'JUNGLE',
        'SWAMP', 'PLAINS', 'HILLS', 'MOUNTAINS', 'DESERT',
        'COAST', 'CITY', 'UNDERGROUND_RUINS', 'EXTRAPLANAR',
        'OTHER', 'BRIDGE'
    )),
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (monster_id, terrain)
);

-- Indexes for performant lookups by terrain and monster
CREATE INDEX IF NOT EXISTS idx_monster_terrains_terrain ON monster_terrains(terrain);
CREATE INDEX IF NOT EXISTS idx_monster_terrains_monster ON monster_terrains(monster_id);

-- Enforce strictly at most ONE primary terrain per monster
CREATE UNIQUE INDEX IF NOT EXISTS one_primary_terrain_per_monster 
ON monster_terrains(monster_id) WHERE is_primary = 1;

-- 4. Migrate existing monster habitats into monster_terrains
-- Assassin Vine (ID 1, habitats: F, J, S)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Assassin Vine';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Assassin Vine';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Assassin Vine';

-- Marsh Leech [DEV-PLACEHOLDER] (ID 2, habitats: S, F, R)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Marsh Leech [DEV-PLACEHOLDER]';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Marsh Leech [DEV-PLACEHOLDER]';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'RIVER_LAKE', 0 FROM monsters WHERE name = 'Marsh Leech [DEV-PLACEHOLDER]';

-- Shadow Bramble [DEV-PLACEHOLDER] (ID 3, habitats: F, P)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Shadow Bramble [DEV-PLACEHOLDER]';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Shadow Bramble [DEV-PLACEHOLDER]';

-- Feral Wolf [DEV-PLACEHOLDER] (ID 4, habitats: F, P, H)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Feral Wolf [DEV-PLACEHOLDER]';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Feral Wolf [DEV-PLACEHOLDER]';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Feral Wolf [DEV-PLACEHOLDER]';

-- Grave Troll [DEV-PLACEHOLDER] (ID 5, habitats: S, F, U)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 1 FROM monsters WHERE name = 'Grave Troll [DEV-PLACEHOLDER]';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 0 FROM monsters WHERE name = 'Grave Troll [DEV-PLACEHOLDER]';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Grave Troll [DEV-PLACEHOLDER]';

-- Ghoul (ID 126, habitats: U, P, S)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Ghoul';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Ghoul';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Ghoul';

-- Giant Spider (ID 127, habitats: F, J, S, U)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'FOREST', 1 FROM monsters WHERE name = 'Giant Spider';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'JUNGLE', 0 FROM monsters WHERE name = 'Giant Spider';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Giant Spider';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 0 FROM monsters WHERE name = 'Giant Spider';

-- Choker (ID 128, habitats: U, H, M)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Choker';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Choker';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Choker';

-- Rust Monster (ID 129, habitats: U, H, M)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'UNDERGROUND_RUINS', 1 FROM monsters WHERE name = 'Rust Monster';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 0 FROM monsters WHERE name = 'Rust Monster';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Rust Monster';

-- Manticore (ID 130, habitats: H, M, P, S)
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'HILLS', 1 FROM monsters WHERE name = 'Manticore';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'MOUNTAINS', 0 FROM monsters WHERE name = 'Manticore';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'PLAINS', 0 FROM monsters WHERE name = 'Manticore';
INSERT OR IGNORE INTO monster_terrains (monster_id, terrain, is_primary)
SELECT id, 'SWAMP', 0 FROM monsters WHERE name = 'Manticore';
