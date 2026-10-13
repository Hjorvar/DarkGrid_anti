-- 008_terrain_artwork_system.sql: Terrain Artwork System Schema and Initial Mappings
-- Part of Terrain Artwork System implementation.

CREATE TABLE IF NOT EXISTS terrain_artworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terrain_type TEXT,
    location_key TEXT,
    tile_id INTEGER REFERENCES map_tiles(id),
    image_path TEXT NOT NULL,
    alt_text TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique indexes to prevent duplicate active mappings while allowing inactive historical rows
-- 1. At most one active default artwork per terrain_type
CREATE UNIQUE INDEX IF NOT EXISTS uq_terrain_artworks_active_default
ON terrain_artworks(terrain_type)
WHERE is_active = 1 AND location_key IS NULL AND tile_id IS NULL;

-- 2. At most one active override per location_key
CREATE UNIQUE INDEX IF NOT EXISTS uq_terrain_artworks_active_location
ON terrain_artworks(location_key)
WHERE is_active = 1 AND location_key IS NOT NULL;

-- 3. At most one active override per tile_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_terrain_artworks_active_tile
ON terrain_artworks(tile_id)
WHERE is_active = 1 AND tile_id IS NOT NULL;

-- Index for lookup performance
CREATE INDEX IF NOT EXISTS idx_terrain_artworks_lookup
ON terrain_artworks(terrain_type, is_active);

-- Seed initial artwork metadata (idempotent, preserves any existing manual modifications)
INSERT OR IGNORE INTO terrain_artworks (
    id, terrain_type, location_key, tile_id, image_path, alt_text, title, description, is_active
) VALUES
(
    1,
    'CITY',
    NULL,
    NULL,
    'images/terrain/terrain_city_oakhaven.webp',
    'Fortified wooden palisades, warm lantern light, and watchtowers of Oakhaven settlement.',
    'Oakhaven Sanctuary',
    'A fortified medieval timber settlement offering sanctuary in a dark and perilous wilderness.',
    1
),
(
    2,
    NULL,
    'TOWN_GATES',
    NULL,
    'images/terrain/terrain_town_gates.webp',
    'Heavy reinforced timber gates and torchlit watchposts guarding the threshold between safety and wilderness.',
    'Town Gates Threshold',
    'A formidable timber gate at the perimeter of civilization, overlooking the perilous wilderness beyond.',
    1
),
(
    3,
    'FOREST',
    NULL,
    NULL,
    'images/terrain/terrain_forest.webp',
    'Ancient towering trees, thick moss, and deep shadows beneath a dense northern canopy.',
    'Ancient Forest',
    'Dense ancient woods with moss-draped branches, towering trunks, and cold mist rising between trees.',
    1
),
(
    4,
    'PLAINS',
    NULL,
    NULL,
    'images/terrain/terrain_plains.webp',
    'Vast windswept grasslands under heavy dark clouds and a distant dramatic horizon.',
    'Windswept Plains',
    'Wide grasslands stretching to an exposed horizon beneath rolling storm clouds and pale light.',
    1
),
(
    5,
    'SWAMP',
    NULL,
    NULL,
    'images/terrain/terrain_swamp.webp',
    'Murky stagnant waters, half-submerged roots, dead trees, and cold mist in a forgotten swamp.',
    'Drowned Swamp',
    'A cold, sinister mire with twisted dead trees and pale fog hovering above black waters.',
    1
),
(
    6,
    'HILLS',
    NULL,
    NULL,
    'images/terrain/terrain_hills.webp',
    'Rolling windswept highlands covered in heath and golden moorland grass beneath sweeping overcast skies.',
    'Rolling Highlands',
    'Vast undulating hills, weathered heath, and mossy stone outcrops under a cold autumn wind.',
    1
),
(
    7,
    'JUNGLE',
    NULL,
    NULL,
    'images/terrain/terrain_jungle.webp',
    'Dense humid jungle with massive leaves, twisting vines, and hazy light filtering through the thick canopy.',
    'Primeval Jungle',
    'An overgrown ancient jungle filled with tangled roots, creeping flora, and humid twilight.',
    1
),
(
    8,
    'FALLBACK',
    NULL,
    NULL,
    'images/terrain/terrain_fallback.webp',
    'An atmospheric, mist-shrouded dark fantasy wilderness with ancient standing stones and cold rolling fog.',
    'Misty Realm',
    'The enigmatic and atmospheric wilderness of the Darkgrid realm veiled in creeping fog.',
    1
),
(
    9,
    'BRIDGE',
    NULL,
    NULL,
    'images/terrain/terrain_bridge.webp',
    'An ancient, massive stone arch bridge spanning dark misty waters under an overcast dusk sky.',
    'The Old Stone Bridge',
    'A solitary, ancient stone bridge spanning cold, dark waters between wilderness bounds.',
    1
),
(
    10,
    NULL,
    'ANCIENT_BRIDGE',
    NULL,
    'images/terrain/terrain_bridge.webp',
    'An ancient, massive stone arch bridge spanning dark misty waters under an overcast dusk sky.',
    'The Old Stone Bridge',
    'A solitary, ancient stone bridge spanning cold, dark waters between wilderness bounds.',
    1
),
(
    11,
    'MOUNTAINS',
    NULL,
    NULL,
    'images/terrain/terrain_mountains.webp',
    'Towering jagged mountain peaks, narrow rocky crags, and dark storm clouds over impassable summits.',
    'Craggy Mountains',
    'Treacherous mountain ridges and sheer granite summits piercing a turbulent sky.',
    1
),
(
    12,
    'UNDERGROUND_RUINS',
    NULL,
    NULL,
    'images/terrain/terrain_underground_ruins.webp',
    'Cavernous subterranean stone crypts and vaulted halls with archaic rune-carved pillars and deep shadows.',
    'Underground Ruins',
    'An ancient subterranean crypt carved from bedrock, lost to the light of day.',
    1
),
(
    13,
    'COAST',
    NULL,
    NULL,
    'images/terrain/terrain_coast.webp',
    'Bleak basalt sea stacks, churning dark waves, salt-crusted boulders, and damp ocean mist.',
    'Storm-Swept Coast',
    'A treacherous, rocky shoreline where dark crashing waves batter towering sea cliffs.',
    1
),
(
    14,
    'DESERT',
    NULL,
    NULL,
    'images/terrain/terrain_desert.webp',
    'Arid cracked earth, blowing dust devils, and ancient weathered sandstone monoliths under a pale sun.',
    'Arid Barrens',
    'A parched and sun-baked wasteland where ancient monoliths stand sentinel over barren dunes.',
    1
);
