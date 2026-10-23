-- 016_phase8_topdown_world_and_quests.sql
-- Phase 8: Data-Driven World Architecture, General Quest Framework, Discovery & Regional Encounter Profiles

-- 0. Extend map_tiles as the Single Source of Truth for Top-Down World Architecture
ALTER TABLE map_tiles ADD COLUMN region_key TEXT NOT NULL DEFAULT 'GOBLIN_FOREST';
ALTER TABLE map_tiles ADD COLUMN biome TEXT NOT NULL DEFAULT 'FOREST';
ALTER TABLE map_tiles ADD COLUMN visual_type TEXT DEFAULT NULL;
ALTER TABLE map_tiles ADD COLUMN visual_kind TEXT DEFAULT NULL;
ALTER TABLE map_tiles ADD COLUMN path_connections TEXT NOT NULL DEFAULT '[]';
ALTER TABLE map_tiles ADD COLUMN is_landmark INTEGER NOT NULL DEFAULT 0;
ALTER TABLE map_tiles ADD COLUMN landmark_key TEXT DEFAULT NULL;
ALTER TABLE map_tiles ADD COLUMN encounter_profile_key TEXT DEFAULT 'GOBLIN_FOREST';
ALTER TABLE map_tiles ADD COLUMN boss_key TEXT DEFAULT NULL;

-- 1. General Quest Definitions (Single Source of Truth for Story & World Quests)
CREATE TABLE IF NOT EXISTS quest_definitions (
  quest_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  giver TEXT NOT NULL,
  region_key TEXT NOT NULL DEFAULT 'GOBLIN_FOREST',
  region_name TEXT NOT NULL,
  description TEXT NOT NULL,
  objective_type TEXT NOT NULL DEFAULT 'DEFEAT_BOSS' CHECK (objective_type IN ('DEFEAT_BOSS', 'REACH_LANDMARK', 'SLAY_MONSTERS')),
  target_boss_key TEXT DEFAULT NULL,
  target_landmark_key TEXT DEFAULT NULL,
  target_tile_x INTEGER DEFAULT NULL,
  target_tile_y INTEGER DEFAULT NULL,
  target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count >= 1),
  reward_xp_base INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp_base >= 0),
  reward_gold INTEGER NOT NULL DEFAULT 0 CHECK (reward_gold >= 0),
  is_story_quest INTEGER NOT NULL DEFAULT 1 CHECK (is_story_quest IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Character Quest State (Replaces per-quest columns on characters table)
CREATE TABLE IF NOT EXISTS character_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_key TEXT NOT NULL REFERENCES quest_definitions(quest_key) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_ACCEPTED' CHECK (status IN ('NOT_ACCEPTED', 'ACTIVE', 'COMPLETED', 'REWARD_CLAIMED')),
  objective_completed INTEGER NOT NULL DEFAULT 0 CHECK (objective_completed IN (0, 1)),
  progress_count INTEGER NOT NULL DEFAULT 0 CHECK (progress_count >= 0),
  target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count >= 1),
  accepted_at TEXT DEFAULT NULL,
  completed_at TEXT DEFAULT NULL,
  claimed_at TEXT DEFAULT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(character_id, quest_key)
);

CREATE INDEX IF NOT EXISTS idx_character_quests_char_status
  ON character_quests(character_id, status);

-- 3. Fixed World Boss Definitions
CREATE TABLE IF NOT EXISTS world_boss_definitions (
  boss_key TEXT PRIMARY KEY,
  custom_title TEXT NOT NULL UNIQUE,
  preferred_monster_name TEXT NOT NULL,
  fallback_monster_id INTEGER NOT NULL DEFAULT 12,
  region_key TEXT NOT NULL DEFAULT 'GOBLIN_FOREST',
  landmark_key TEXT NOT NULL DEFAULT 'GOBLIN_STRONGHOLD',
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  max_hp INTEGER NOT NULL CHECK (max_hp > 0),
  held_gold INTEGER NOT NULL DEFAULT 0 CHECK (held_gold >= 0),
  entrance_title TEXT NOT NULL,
  entrance_description TEXT NOT NULL,
  entrance_image_url TEXT NOT NULL,
  combat_image_url TEXT NOT NULL,
  combat_backdrop_url TEXT NOT NULL,
  linked_quest_key TEXT DEFAULT NULL REFERENCES quest_definitions(quest_key)
);

-- 4. Character Tile Discovery (Fog of War & Region Map Persistence)
CREATE TABLE IF NOT EXISTS character_discovered_tiles (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id, x, y)
);

CREATE INDEX IF NOT EXISTS idx_character_discovered_tiles_char
  ON character_discovered_tiles(character_id);

-- 5. Regional Encounter Profiles (Data-Driven Monster Distribution & Pacing)
CREATE TABLE IF NOT EXISTS encounter_profiles (
  profile_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_chance_percent REAL NOT NULL DEFAULT 12.0 CHECK (base_chance_percent >= 0 AND base_chance_percent <= 100),
  min_steps_between_encounters INTEGER NOT NULL DEFAULT 4 CHECK (min_steps_between_encounters >= 0),
  safe_radius_from_town INTEGER NOT NULL DEFAULT 2 CHECK (safe_radius_from_town >= 0),
  buckets_json TEXT NOT NULL CHECK (json_valid(buckets_json)),
  description TEXT NOT NULL DEFAULT ''
);

-- Seed canonical quest definition: The Goblin Chieftain
INSERT OR REPLACE INTO quest_definitions (
  quest_key, title, giver, region_key, region_name, description,
  objective_type, target_boss_key, target_landmark_key, target_tile_x, target_tile_y,
  target_count, reward_xp_base, reward_gold, is_story_quest, sort_order
) VALUES (
  'THE_GOBLIN_CHIEFTAIN',
  'The Goblin Chieftain',
  'Captain Vane of Oakhaven Watch',
  'GOBLIN_FOREST',
  'Blackwood Forest (Goblin Forest)',
  'A goblin chieftain has taken control of an old stronghold deep within Blackwood Forest. Travelers are disappearing. Find the stronghold and defeat the chieftain.',
  'DEFEAT_BOSS',
  'WARCHIEF_GRAK',
  'GOBLIN_STRONGHOLD',
  15,
  2,
  1,
  250,
  100,
  1,
  1
);

-- Seed canonical world boss definition: Warchief Grak the Goblin Chieftain
INSERT OR REPLACE INTO world_boss_definitions (
  boss_key, custom_title, preferred_monster_name, fallback_monster_id,
  region_key, landmark_key, tile_x, tile_y, max_hp, held_gold,
  entrance_title, entrance_description, entrance_image_url,
  combat_image_url, combat_backdrop_url, linked_quest_key
) VALUES (
  'WARCHIEF_GRAK',
  'Warchief Grak the Goblin Chieftain',
  'Hobgoblin',
  12,
  'GOBLIN_FOREST',
  'GOBLIN_STRONGHOLD',
  15,
  2,
  14,
  45,
  'The Goblin Stronghold of Blackwood',
  'Sharpened timber palisades and a crude watchtower rise through the choking mist of northern Blackwood Forest. Iron braziers burn with foul pitch beside the spiked gate where Warchief Grak the Goblin Chieftain holds court.',
  '/images/terrain/terrain_town_gates.webp',
  '/images/monsters/goblin.png',
  '/images/terrain/terrain_town_gates.webp',
  'THE_GOBLIN_CHIEFTAIN'
);

-- Seed Regional Encounter Profiles (Goblin Forest active + extensible regional profiles)
INSERT OR REPLACE INTO encounter_profiles (
  profile_key, name, base_chance_percent, min_steps_between_encounters, safe_radius_from_town, buckets_json, description
) VALUES
  (
    'GOBLIN_FOREST',
    'Blackwood Goblin Forest',
    12.5,
    4,
    2,
    '[{"bucket":"GOBLIN","weight":80,"level1":["Goblin","Hobgoblin"],"level2":["Goblin","Hobgoblin","Bugbear","Worg"],"level3Plus":["Goblin","Hobgoblin","Bugbear","Worg","Hobgoblin Captain"]},{"bucket":"ANIMAL","weight":15,"level1":["Dire Rat","Viper","Blood Hawk","Wolf"],"level2":["Dire Rat","Viper","Blood Hawk","Wolf","Boar"],"level3Plus":["Dire Rat","Viper","Blood Hawk","Wolf","Boar","Feral Wolf"]},{"bucket":"OTHER","weight":5,"level1":["Mite","Stirge","Vegepygmy","Giant Spider"],"level2":["Mite","Stirge","Vegepygmy","Giant Spider","Orc"],"level3Plus":["Mite","Stirge","Vegepygmy","Giant Spider","Orc","Ettercap"]}]',
    '80% Goblin-kin raiders, 15% woodland beasts, 5% dark forest lurkers.'
  ),
  (
    'FOREST',
    'Deep Primeval Woodland',
    12.0,
    4,
    2,
    '[{"bucket":"ANIMAL","weight":50,"level1":["Wolf","Dire Rat","Viper","Blood Hawk"],"level2":["Wolf","Boar","Viper"],"level3Plus":["Feral Wolf","Dire Boar","Owlbear"]},{"bucket":"OTHER","weight":30,"level1":["Giant Spider","Mite","Vegepygmy"],"level2":["Giant Spider","Assassin Vine"],"level3Plus":["Ettercap","Assassin Vine","Spriggan"]},{"bucket":"GOBLIN","weight":20,"level1":["Goblin"],"level2":["Goblin","Bugbear"],"level3Plus":["Bugbear","Worg"]}]',
    'Untamed woodland dominated by predators, spiders, and sylvan hazards.'
  ),
  (
    'UNDEAD_CEMETERY',
    'Barrow-Downs & Boneyard',
    14.0,
    4,
    2,
    '[{"bucket":"UNDEAD","weight":85,"level1":["Skeleton","Zombie"],"level2":["Skeleton","Zombie","Ghoul"],"level3Plus":["Ghoul","Ghast","Wight","Barrow Wight","Wraith"]},{"bucket":"ANIMAL","weight":10,"level1":["Dire Rat","Bat"],"level2":["Dire Rat","Giant Bat"],"level3Plus":["Giant Bat","Death Dog"]},{"bucket":"OTHER","weight":5,"level1":["Stirge"],"level2":["Darkmantle"],"level3Plus":["Gargoyle","Shadow"]}]',
    'Haunted barrows and crypt-fields teeming with the restless dead.'
  ),
  (
    'ORC_HIGHLANDS',
    'Jagged Orc Highlands',
    13.5,
    4,
    2,
    '[{"bucket":"ORC","weight":75,"level1":["Orc","Goblin"],"level2":["Orc","Hobgoblin","Worg"],"level3Plus":["Orc","Orc Warchief","Ogre","Hobgoblin Captain"]},{"bucket":"ANIMAL","weight":15,"level1":["Blood Hawk","Wolf"],"level2":["Wolf","Boar"],"level3Plus":["Worg","Hippogriff","Griffon"]},{"bucket":"OTHER","weight":10,"level1":["Kobold","Stirge"],"level2":["Bugbear","Gnoll"],"level3Plus":["Gnoll Packmaster","Manticore"]}]',
    'Wind-scoured crags controlled by orc warbands and highland beasts.'
  ),
  (
    'SWAMP',
    'Fetid Marsh & Mire',
    13.0,
    4,
    2,
    '[{"bucket":"SWAMP","weight":75,"level1":["Boggard","Giant Frog","Stirge"],"level2":["Boggard","Lizardfolk","Marsh Leech"],"level3Plus":["Lizardfolk","Green Hag","Shambling Mound","Troll"]},{"bucket":"ANIMAL","weight":15,"level1":["Viper","Dire Rat"],"level2":["Viper","Giant Toad"],"level3Plus":["Jungle Viper","GiantCrab"]},{"bucket":"OTHER","weight":10,"level1":["Vegepygmy"],"level2":["Ochre Jelly"],"level3Plus":["Will-o-Wisp","Catoblepas"]}]',
    'Mist-choked bogs inhabited by boggards, amphibians, and mire horrors.'
  ),
  (
    'MOUNTAIN',
    'Shattered Mountain Peaks',
    14.0,
    4,
    2,
    '[{"bucket":"MOUNTAIN","weight":80,"level1":["Kobold","Blood Hawk"],"level2":["Orc","Harpy","Gargoyle"],"level3Plus":["Ogre","Griffon","Manticore","Wyvern","Minotaur"]},{"bucket":"ANIMAL","weight":15,"level1":["Blood Hawk","Wolf"],"level2":["Wolf","Giant Bat"],"level3Plus":["Winter Wolf","Yeti"]},{"bucket":"OTHER","weight":5,"level1":["Stirge"],"level2":["Darkmantle"],"level3Plus":["Basilisk","Rust Monster"]}]',
    'High alpine passes haunted by winged predators and mountain giants.'
  );
