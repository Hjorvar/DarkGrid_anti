-- 001_initial_schema.sql: Initial Darkgrid Core Schema
-- Based on schema_draft.sql v0.1

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS map_tiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    name TEXT NOT NULL,
    terrain TEXT NOT NULL CHECK (terrain IN (
        'AQUATIC', 'OCEAN', 'RIVER_LAKE', 'FOREST', 'JUNGLE',
        'SWAMP', 'PLAINS', 'HILLS', 'MOUNTAINS', 'DESERT',
        'COAST', 'CITY', 'UNDERGROUND_RUINS', 'EXTRAPLANAR',
        'OTHER', 'BRIDGE'
    )),
    feature TEXT,
    description TEXT NOT NULL,
    is_passable INTEGER NOT NULL DEFAULT 1 CHECK (is_passable IN (0, 1)),
    is_safe INTEGER NOT NULL DEFAULT 0 CHECK (is_safe IN (0, 1)),
    UNIQUE (x, y)
);

CREATE TABLE IF NOT EXISTS monsters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    symbol TEXT NOT NULL,
    color TEXT NOT NULL,
    base_hp INTEGER NOT NULL CHECK (base_hp > 0),
    xp_reward INTEGER NOT NULL CHECK (xp_reward >= 0),
    damage_dice TEXT NOT NULL,
    initiative_bonus INTEGER NOT NULL,
    armor_class INTEGER NOT NULL,
    attack_bonus INTEGER NOT NULL,
    challenge_rating REAL NOT NULL CHECK (challenge_rating >= 0),
    solo_level INTEGER CHECK (solo_level >= 1),  -- balance calibration; NULL = not yet spawnable
    spawn_weight INTEGER NOT NULL DEFAULT 10 CHECK (spawn_weight >= 0),
    habitat TEXT NOT NULL CHECK (json_valid(habitat)),
    movement_type TEXT NOT NULL,
    special_abilities TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(special_abilities)),
    descriptions TEXT NOT NULL CHECK (json_valid(descriptions)),
    source_url TEXT
);

CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    class TEXT NOT NULL CHECK (class IN ('FIGHTER', 'RANGER', 'CLERIC')),
    is_alive INTEGER NOT NULL DEFAULT 1 CHECK (is_alive IN (0, 1)),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
    strength INTEGER NOT NULL,
    constitution INTEGER NOT NULL,
    dexterity INTEGER NOT NULL,
    intelligence INTEGER NOT NULL,
    wisdom INTEGER NOT NULL,
    charisma INTEGER NOT NULL,
    current_hp INTEGER NOT NULL CHECK (current_hp >= 0),
    max_hp INTEGER NOT NULL CHECK (max_hp > 0),
    tile_id INTEGER NOT NULL REFERENCES map_tiles(id),
    killed_by_monster_instance_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    died_at TEXT
);

-- Enforces one LIVING character per account, while retaining dead character history.
CREATE UNIQUE INDEX IF NOT EXISTS one_living_character_per_user
ON characters(user_id) WHERE is_alive = 1;

CREATE TABLE IF NOT EXISTS monster_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monster_id INTEGER NOT NULL REFERENCES monsters(id),
    tile_id INTEGER NOT NULL REFERENCES map_tiles(id),
    current_hp INTEGER NOT NULL CHECK (current_hp >= 0),
    max_hp INTEGER NOT NULL CHECK (max_hp > 0),
    held_gold INTEGER NOT NULL DEFAULT 0 CHECK (held_gold >= 0),
    kill_count INTEGER NOT NULL DEFAULT 0 CHECK (kill_count >= 0),
    custom_title TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEFEATED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    defeated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_persistent_monster_per_tile
ON monster_instances(tile_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id),
    tile_id INTEGER NOT NULL REFERENCES map_tiles(id),
    monster_id INTEGER NOT NULL REFERENCES monsters(id),
    monster_instance_id INTEGER REFERENCES monster_instances(id),
    status TEXT NOT NULL CHECK (status IN (
        'DISCOVERED', 'IN_COMBAT', 'IGNORED', 'VICTORY', 'DEFEAT', 'ESCAPED'
    )),
    current_monster_hp INTEGER NOT NULL CHECK (current_monster_hp >= 0),
    combat_round INTEGER NOT NULL DEFAULT 0 CHECK (combat_round >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_encounter_per_character
ON encounters(character_id) WHERE status IN ('DISCOVERED', 'IN_COMBAT');

CREATE TABLE IF NOT EXISTS item_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN (
        'WEAPON', 'ARMOR', 'SHIELD', 'POTION', 'OTHER'
    )),
    description TEXT NOT NULL DEFAULT '',
    buy_price INTEGER NOT NULL DEFAULT 0 CHECK (buy_price >= 0),
    sell_price INTEGER NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
    is_magical INTEGER NOT NULL DEFAULT 0 CHECK (is_magical IN (0, 1)),
    damage_dice TEXT,
    armor_bonus INTEGER NOT NULL DEFAULT 0,
    shield_bonus INTEGER NOT NULL DEFAULT 0,
    equip_slot TEXT,
    allowed_classes TEXT NOT NULL DEFAULT '["FIGHTER","RANGER","CLERIC"]'
        CHECK (json_valid(allowed_classes)),
    attributes TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes))
);

CREATE TABLE IF NOT EXISTS item_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_definition_id INTEGER NOT NULL REFERENCES item_definitions(id),
    owner_type TEXT NOT NULL CHECK (owner_type IN ('CHARACTER','MONSTER','MARKET')),
    owner_character_id INTEGER REFERENCES characters(id),
    owner_monster_id INTEGER REFERENCES monster_instances(id),
    equipped_slot TEXT,
    modifications TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(modifications)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (owner_type = 'CHARACTER' AND owner_character_id IS NOT NULL AND owner_monster_id IS NULL)
        OR (owner_type = 'MONSTER' AND owner_character_id IS NULL AND owner_monster_id IS NOT NULL)
        OR (owner_type = 'MARKET' AND owner_character_id IS NULL AND owner_monster_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS items_by_character ON item_instances(owner_character_id);
CREATE INDEX IF NOT EXISTS items_by_monster ON item_instances(owner_monster_id);

CREATE TABLE IF NOT EXISTS market_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_instance_id INTEGER NOT NULL REFERENCES item_instances(id),
    seller_character_id INTEGER REFERENCES characters(id),
    buyer_character_id INTEGER REFERENCES characters(id),
    price INTEGER NOT NULL CHECK (price >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SOLD','CANCELLED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS only_one_active_listing_per_item
ON market_listings(item_instance_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS combat_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL REFERENCES encounters(id),
    round_number INTEGER NOT NULL DEFAULT 0,
    event_type TEXT NOT NULL,
    public_text TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);

INSERT OR IGNORE INTO game_config(key, value, description) VALUES
    ('encounter_chance_percent', '25', 'PROPOSAL, adjustable; chance on valid tile entry'),
    ('encounter_sigma', '1.5', 'PROPOSAL, adjustable; normal weighted target solo_level'),
    ('combat_attack_formula', 'STR_DEX_AVERAGE', 'Original creator rule; reconsider for melee/ranged scaling');

CREATE VIEW IF NOT EXISTS character_inventory AS
SELECT ii.* FROM item_instances ii WHERE ii.owner_type = 'CHARACTER';

CREATE VIEW IF NOT EXISTS monster_loot AS
SELECT ii.* FROM item_instances ii WHERE ii.owner_type = 'MONSTER';

CREATE VIEW IF NOT EXISTS character_history AS
SELECT c.id, c.user_id, c.name, c.class, c.level, c.xp,
       c.died_at, c.tile_id, c.killed_by_monster_instance_id
FROM characters c WHERE c.is_alive = 0;
