-- =============================================================================
-- Migration 019: Phase 9C — Large Dungeons (Goblin Cave & Ancient Crypt)
-- and Third Overworld Region (Ravencrag Highlands)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dungeon_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dungeon_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    region_key TEXT NOT NULL,
    entrance_overworld_x INTEGER NOT NULL,
    entrance_overworld_y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    total_tiles INTEGER NOT NULL,
    entry_x INTEGER NOT NULL,
    entry_y INTEGER NOT NULL,
    exit_x INTEGER NOT NULL,
    exit_y INTEGER NOT NULL,
    boss_key TEXT NOT NULL,
    boss_name TEXT NOT NULL,
    boss_x INTEGER NOT NULL,
    boss_y INTEGER NOT NULL,
    theme_key TEXT NOT NULL,
    artwork_url TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dungeon_tiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dungeon_key TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    name TEXT NOT NULL,
    terrain TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'CORRIDOR',
    feature TEXT DEFAULT NULL,
    visual_type TEXT DEFAULT NULL,
    visual_kind TEXT DEFAULT NULL,
    path_connections TEXT NOT NULL DEFAULT '',
    is_passable INTEGER NOT NULL DEFAULT 1,
    is_opaque INTEGER NOT NULL DEFAULT 0,
    is_safe INTEGER NOT NULL DEFAULT 0,
    is_landmark INTEGER NOT NULL DEFAULT 0,
    landmark_key TEXT DEFAULT NULL,
    danger_zone_key TEXT DEFAULT NULL,
    fixed_encounter_key TEXT DEFAULT NULL,
    treasure_key TEXT DEFAULT NULL,
    boss_key TEXT DEFAULT NULL,
    description TEXT NOT NULL DEFAULT '',
    UNIQUE(dungeon_key, x, y)
);

CREATE TABLE IF NOT EXISTS character_dungeon_discovered_tiles (
    character_id INTEGER NOT NULL,
    dungeon_key TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (character_id, dungeon_key, x, y)
);

CREATE TABLE IF NOT EXISTS character_dungeon_events (
    character_id INTEGER NOT NULL,
    dungeon_key TEXT NOT NULL,
    event_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    resolved_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (character_id, dungeon_key, event_key)
);

INSERT INTO danger_zone_profiles (
    zone_key, zone_name, danger_level, encounter_rate, ambush_share,
    min_steps_between_combats, streak_dampening_per_event, monster_pool_json, description
) VALUES
    (
        'GOBLIN_CAVE_TUNNELS',
        'Goblin Cave — Outer Tunnels & Dripping Galleries',
        'HIGH',
        0.24,
        0.36,
        1,
        0.08,
        '["Goblin","Giant Bat","Stirge","Mite","Giant Spider","Hobgoblin"]',
        'Damp limestone tunnels, pitch-torch guard posts, and bone-littered side passages beneath Whispering Crags.'
    ),
    (
        'GOBLIN_CAVE_DEEP_LAIR',
        'Goblin Cave — Deep Brood-Chambers & War-Vaults',
        'VERY_HIGH',
        0.32,
        0.45,
        1,
        0.08,
        '["Goblin","Hobgoblin","Bugbear","Giant Spider","Rust Monster","Stirge"]',
        'Web-choked subterranean chasms, ancient war-camps, and the brood-sanctum in the deepest reaches of the Goblin Cave.'
    ),
    (
        'CRYPT_OUTER_GALLERIES',
        'Ancient Crypt — Outer Sepulcher Halls',
        'HIGH',
        0.24,
        0.36,
        1,
        0.08,
        '["Human Skeleton","Human Zombie","Ghoul","Shadow","Skeletal Champion"]',
        'Cold stone burial galleries, shattered funerary statues, and forsaken temple aisles haunted by restless dead.'
    ),
    (
        'CRYPT_INNER_CATACOMBS',
        'Ancient Crypt — Deep Catacombs & Sanctum Vaults',
        'VERY_HIGH',
        0.33,
        0.46,
        1,
        0.08,
        '["Ghoul","Shadow","Skeletal Champion","Ghast","Wight","Wraith","Mummy","Barrow Wight"]',
        'Necrotic-lit inner catacombs, ossuary vaults, and the royal burial sanctum where ancient undead lords keep vigil.'
    ),
    (
        'HIGHLAND_FOOTHILL_ROAD',
        'Windscar Foothills & Highland Switchbacks (Ravencrag Highlands)',
        'MODERATE',
        0.19,
        0.28,
        1,
        0.07,
        '["Orc","Wolf","Dire Wolf","Worg","Harpy","Gnoll","Hobgoblin"]',
        'Windswept switchback trails and heather-choked foothill passes climbing into Ravencrag Highlands. Orc outriders, worg packs, and cliff-perched harpies stalk travelers along the lower ridges.'
    ),
    (
        'HIGHLAND_SHATTERED_GORGE',
        'Shattered Gorge & Giant''s Span (Ravencrag Highlands)',
        'HIGH',
        0.26,
        0.40,
        1,
        0.08,
        '["Orc","Ogre","Worg","Harpy","Griffon","Bugbear","Gargoyle","Manticore"]',
        'Deep windswept ravines, megalithic bridge spans, and sheer granite canyon walls splitting Ravencrag Highlands. Ogre brutes, manticores, and highland griffons ambush from the crags above.'
    ),
    (
        'STORMPEAK_CITADEL_APPROACH',
        'Stormpeak Crags & Citadel Approach (Ravencrag Highlands)',
        'VERY_HIGH',
        0.33,
        0.46,
        1,
        0.08,
        '["Ogre","Troll","Orc Warchief","Hill Giant","Manticore","Griffon","Wyvern","Stone Giant"]',
        'Razor-backed storm crags, cyclopean watchtower ruins, and frost-scoured peaks beneath Ravencrag Citadel. Warband ogres, regenerating mountain trolls, and crag giants guard the highland fortress.'
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
        'Carved into the sheer black granite of Whispering Crags, a yawning cavern mouth exhales damp subterranean chill and the reek of pitch torches. Gnawed bones, crude skull-totems, and chittering echoes warn that a vast network of goblin tunnels, spider-choked galleries, and a deep brood-king sanctum lie beneath the mountain.',
        '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
        1,
        1,
        '[{"key":"DELVE_GOBLIN_CAVE","label":"Delve into the Cave Mouth","action":"EXPLORE_GOBLIN_CAVE","style":"danger"},{"key":"CONTINUE_EXPLORING","label":"Continue Exploring","action":"DISMISS_LANDMARK_SCENE","style":"ghost"}]'
    ),
    (
        'ANCIENT_CRYPT',
        'CRYPT',
        'CRYPT',
        'The Ancient Crypt of the Barrow Kings',
        'Forsaken Necropolis Vault & Catacomb Threshold',
        'Towering obsidian monoliths and shattered funerary statues frame a sunken gothic mausoleum veiled in necrotic emerald-violet mist. Beyond the iron-barred crypt doors stretches a sprawling underground necropolis of stone tombs, desecrated shrines, and the inner throne hall of the Barrow-Wight King.',
        '/images/terrain/terrain_underground_ruins.webp',
        1,
        1,
        '[{"key":"BREACH_CRYPT_THRESHOLD","label":"Descend into the Ancient Crypt","action":"ENTER_ANCIENT_CRYPT","style":"danger"},{"key":"CONTINUE_EXPLORING","label":"Continue Exploring","action":"DISMISS_LANDMARK_SCENE","style":"ghost"}]'
    ),
    (
        'RAVENCRAG_CITADEL',
        'FORTRESS_RUIN',
        'MAJOR_LANDMARK',
        'Ravencrag Citadel — Throne of the Crag-Breaker',
        'Highland War-Fortress & Cyclopean Ruin',
        'Perched atop the highest jagged granite spire of Ravencrag Highlands, the shattered cyclopean battlements of Ravencrag Citadel loom against storm-torn skies. Iron braziers burn along the breached gatehouse where Warlord Kraug the Crag-Breaker marshals his highland horde of orcs, ogres, and mountain trolls.',
        '/lab-assets/images/perspective/barrier_darkmount_crags_pov.jpg',
        1,
        1,
        '[{"key":"CONFRONT_HIGHLAND_WARLORD","label":"Storm the Citadel Courtyard","action":"CONFRONT_HIGHLAND_WARLORD","style":"danger"},{"key":"CONTINUE_EXPLORING","label":"Continue Exploring","action":"DISMISS_LANDMARK_SCENE","style":"ghost"}]'
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

INSERT OR REPLACE INTO quest_definitions (
    quest_key, title, giver, region_key, region_name, description,
    objective_type, target_boss_key, target_landmark_key, target_tile_x, target_tile_y,
    target_count, reward_xp_base, reward_gold, is_story_quest, sort_order
) VALUES
    (
        'THE_ANCIENT_CRYPT',
        'The Crypt of the Barrow-King',
        'Sister Meriel, Shrine Keeper of Oakhaven',
        'UNDEAD_LANDS',
        'Ashen Barrowlands (Undead Lands)',
        'Necrotic mist seeps westward from the Ashen Barrowlands across the Blackwater River. Sister Meriel has divined that the ancient seal beneath the Necropolis Sanctum has ruptured. Enter the Ancient Crypt in the far north of the Undead Lands, brave its undead catacombs, and lay Lord Malakor the Barrow-Wight King to final rest.',
        'DEFEAT_BOSS',
        'CRYPT_BARROW_KING',
        'ANCIENT_CRYPT',
        26,
        5,
        1,
        220,
        120,
        1,
        2
    ),
    (
        'THE_RAVENCRAG_WARLORD',
        'The Warlord of Ravencrag',
        'Captain Vane of Oakhaven Watch',
        'RAVENCRAG_HIGHLANDS',
        'Ravencrag Highlands',
        'Scouts from the eastern watchposts report that Warlord Kraug the Crag-Breaker has united the highland orc clans, ogre brutes, and mountain trolls atop Ravencrag Citadel. Follow the Highland Road past the Abandoned Watchpost into Ravencrag Highlands, cross the Giant''s Span over Shattered Gorge, and break Kraug''s hold on the Stormpeak Crags.',
        'DEFEAT_BOSS',
        'WARLORD_KRAUG',
        'RAVENCRAG_CITADEL',
        37,
        3,
        1,
        260,
        150,
        1,
        3
    );

INSERT OR REPLACE INTO world_boss_definitions (
    boss_key, custom_title, preferred_monster_name, fallback_monster_id,
    region_key, landmark_key, tile_x, tile_y, max_hp, held_gold,
    entrance_title, entrance_description, entrance_image_url,
    combat_image_url, combat_backdrop_url, linked_quest_key
) VALUES
    (
        'GOBLIN_CAVE_BOSS',
        'Skulkrip the Cave Brood-King',
        'Bugbear',
        12,
        'BLACKWOOD_FOREST',
        'GOBLIN_CAVE',
        9,
        12,
        18,
        55,
        'The Brood-King''s Subterranean Sanctum',
        'Deep within the darkest limestone vault of the Goblin Cave, Skulkrip the Cave Brood-King rules from a throne of gnawed bones and rusted armor.',
        '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
        '/images/monsters/bugbear.png',
        '/lab-assets/images/terrain/hills_raven_crags_ravine_pov.jpg',
        NULL
    ),
    (
        'CRYPT_BARROW_KING',
        'Lord Malakor the Barrow-Wight King',
        'Barrow Wight',
        12,
        'UNDEAD_LANDS',
        'ANCIENT_CRYPT',
        26,
        5,
        22,
        75,
        'The Barrow-King''s Inner Throne Vault',
        'Cold emerald-violet fire burns in the braziers of the sunken royal sepulcher where Lord Malakor the Barrow-Wight King rises from his obsidian sarcophagus.',
        '/images/terrain/terrain_underground_ruins.webp',
        '/images/monsters/barrow_wight.png',
        '/images/terrain/terrain_underground_ruins.webp',
        'THE_ANCIENT_CRYPT'
    ),
    (
        'WARLORD_KRAUG',
        'Warlord Kraug the Crag-Breaker',
        'Ogre',
        12,
        'RAVENCRAG_HIGHLANDS',
        'RAVENCRAG_CITADEL',
        37,
        3,
        24,
        90,
        'Ravencrag Citadel — Throne of the Crag-Breaker',
        'Perched atop the highest jagged granite spire of Ravencrag Highlands, Warlord Kraug the Crag-Breaker marshals his highland horde of orcs, ogres, and mountain trolls.',
        '/lab-assets/images/perspective/barrier_darkmount_crags_pov.jpg',
        '/images/monsters/ogre.png',
        '/lab-assets/images/perspective/barrier_darkmount_crags_pov.jpg',
        'THE_RAVENCRAG_WARLORD'
    );
