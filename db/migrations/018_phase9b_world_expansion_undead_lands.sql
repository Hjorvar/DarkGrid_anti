-- =============================================================================
-- Migration 018: Phase 9B — World Expansion: Undead Lands, Goblin Cave & Ancient Crypt
-- Non-destructive seeding of new regional danger zone profiles, encounter profiles,
-- and auto-opening Major Landmark Scenes (Goblin Cave & Ancient Crypt).
-- =============================================================================

CREATE TABLE IF NOT EXISTS danger_zone_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_key TEXT NOT NULL UNIQUE,
    zone_name TEXT NOT NULL,
    danger_level TEXT NOT NULL,
    encounter_rate REAL NOT NULL DEFAULT 0.18,
    ambush_share REAL NOT NULL DEFAULT 0.30,
    min_steps_between_combats INTEGER NOT NULL DEFAULT 1,
    streak_dampening_per_event REAL NOT NULL DEFAULT 0.08,
    monster_pool_json TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS landmark_scene_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_key TEXT NOT NULL UNIQUE,
    landmark_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'MAJOR_LANDMARK',
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    artwork_url TEXT NOT NULL,
    is_major_landmark INTEGER NOT NULL DEFAULT 1,
    auto_open_on_arrival INTEGER NOT NULL DEFAULT 1,
    actions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO danger_zone_profiles (
    zone_key, zone_name, danger_level, encounter_rate, ambush_share,
    min_steps_between_combats, streak_dampening_per_event, monster_pool_json, description
) VALUES
    (
        'GOBLIN_CAVE_APPROACH',
        'Goblin Cave Approach',
        'VERY_HIGH',
        0.30,
        0.44,
        1,
        0.08,
        '["Goblin","Hobgoblin","Bugbear","Worg","Giant Spider","Stirge"]',
        'Shadowed crag-ledges and bone-strewn ravines flanking the mouth of the Goblin Cave. Cave sentries and subterranean predators ambush from above.'
    ),
    (
        'UNDEAD_BARROW_ROAD',
        'Sepulcher Road (Undead Lands)',
        'HIGH',
        0.21,
        0.32,
        1,
        0.07,
        '["Human Skeleton","Human Zombie","Ghoul","Death Dog","Skeletal Champion"]',
        'An ancient cracked flagstone funerary road winding through the Ashen Barrowlands. Restless skeletal patrols and grave-hounds prowl the mist.'
    ),
    (
        'UNDEAD_MIRE_OFF_ROAD',
        'Ashen Barrows & Deadman''s Mire',
        'VERY_HIGH',
        0.27,
        0.42,
        1,
        0.08,
        '["Human Skeleton","Human Zombie","Plague Zombie","Ghoul","Ghast","Shadow","Will-o''-Wisp"]',
        'Sunken burial mounds, stagnant blight-pools, and corpse-candle marshes where ghouls and creeping undead rise from the mire.'
    ),
    (
        'CRYPT_SEPULCHER_APPROACH',
        'Ancient Crypt Precinct',
        'VERY_HIGH',
        0.34,
        0.48,
        1,
        0.08,
        '["Human Skeleton","Ghoul","Skeletal Champion","Ghast","Wight","Shadow","Barrow Wight"]',
        'The cursed necropolis terrace surrounding the Ancient Crypt. Tomb-wardens and barrow wights ambush intruders from the catacomb shadows.'
    )
ON CONFLICT(zone_key) DO UPDATE SET
    zone_name = excluded.zone_name,
    danger_level = excluded.danger_level,
    encounter_rate = excluded.encounter_rate,
    ambush_share = excluded.ambush_share,
    min_steps_between_combats = excluded.min_steps_between_combats,
    streak_dampening_per_event = excluded.streak_dampening_per_event,
    monster_pool_json = excluded.monster_pool_json,
    description = excluded.description;

INSERT INTO landmark_scene_definitions (
    scene_key, landmark_type, category, title, subtitle, description,
    artwork_url, is_major_landmark, auto_open_on_arrival, actions_json
) VALUES
    (
        'GOBLIN_CAVE',
        'DUNGEON_ENTRANCE',
        'DUNGEON_ENTRANCE',
        'The Goblin Cave of Whispering Crags',
        'Subterranean Lair & Hostile Cavern Mouth',
        'Carved into the sheer black granite of Whispering Crags, a yawning cavern mouth exhales damp subterranean chill and the reek of pitch torches. Gnawed bones, crude skull-totems, and chittering echoes warn that goblin tunnel-fighters and cave beasts guard the dark descent below.',
        '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
        1,
        1,
        '[{"key":"DELVE_GOBLIN_CAVE","label":"Delve Into the Cave Mouth","action":"EXPLORE_GOBLIN_CAVE","style":"danger"},{"key":"CONTINUE_EXPLORING","label":"Continue Exploring","action":"DISMISS_LANDMARK_SCENE","style":"ghost"}]'
    ),
    (
        'ANCIENT_CRYPT',
        'CRYPT',
        'CRYPT',
        'The Ancient Crypt of the Barrow Kings',
        'Forsaken Necropolis Vault & Catacomb Threshold',
        'Towering obsidian monoliths and shattered funerary statues frame a sunken gothic mausoleum veiled in necrotic emerald-violet mist. Cold sepulchral light pulses from behind the iron-barred crypt doors where skeletal champions and ancient barrow wights keep eternal vigil.',
        '/images/terrain/terrain_underground_ruins.webp',
        1,
        1,
        '[{"key":"BREACH_CRYPT_THRESHOLD","label":"Breach the Crypt Threshold","action":"ENTER_ANCIENT_CRYPT","style":"danger"},{"key":"CONTINUE_EXPLORING","label":"Continue Exploring","action":"DISMISS_LANDMARK_SCENE","style":"ghost"}]'
    )
ON CONFLICT(scene_key) DO UPDATE SET
    landmark_type = excluded.landmark_type,
    category = excluded.category,
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    artwork_url = excluded.artwork_url,
    is_major_landmark = excluded.is_major_landmark,
    auto_open_on_arrival = excluded.auto_open_on_arrival,
    actions_json = excluded.actions_json;
