# Darkgrid — Terrain Artwork System & Visual Integration

**Status:** APPROVED  
**Branch:** `feature/terrain-artwork-system`  
**Date:** October 2026  
**Art Direction:** Dark Medieval Fantasy, Painterly Concept Illustration (16:9, 1536×864, WebP)

---

## 1. Overview & Comprehensive Terrain Audit

The **Terrain Artwork System** provides an immersive, responsive visual atmosphere for the Darkgrid realm. As players travel across the world—departing the fortified walls of Oakhaven, crossing the windswept plains, venturing into the ancient forest, wading through drowned swamps, navigating the rolling highlands, or crossing the ancient stone bridge—the visual backdrop dynamically shifts to reflect the terrain and specific landmarks.

### Complete 4-Category Terrain Audit & Reconciliation

Following our complete audit of the Darkgrid SQLite schema, Pathfinder 1e SRD, monster habitats, and world map tiles, here is the official classification across all 4 categories:

#### 1. Map Tiles (15×15 Grid = 225 Tiles)
| Terrain Type | Passability | Tile Count | Notes & Gameplay Function |
| :--- | :--- | :--- | :--- |
| `FOREST` | Passable | 38 | Major wilderness biome; home to forest predators and woodland encounters. |
| `SWAMP` | Passable (35) / Impassable (14) | 49 | Sinister mires; 14 deep marsh tiles act as impassable terrain hazards. |
| `PLAINS` | Passable | 32 | Open wilderness; includes the perimeter surrounding Oakhaven. |
| `MOUNTAINS` | Impassable | 29 | Towering mountain range barriers enclosing the realm (`is_passable = 0`). |
| `JUNGLE` | Passable | 28 | Dense primeval rainforest in the southern regions. |
| `HILLS` | Passable | 27 | Windswept rolling highlands (e.g. Raven Crags). |
| `OCEAN` | Impassable | 13 | World boundary deep waters (`is_passable = 0`). |
| `RIVER_LAKE` | Impassable | 7 | Waterways and deep chasm boundaries (`is_passable = 0`). |
| `CITY` | Passable | 1 | Oakhaven sanctuary settlement at coordinates (7, 7). |
| `BRIDGE` | Passable | 1 | The Old Stone Bridge landmark at coordinates (8, 7). |
| **Total** | | **225** | **175 Passable tiles, 50 Impassable tiles** |

#### 2. Monster Habitat Classification (`monster_terrains`, 38 Total Monsters)
In Darkgrid, each monster has strictly **ONE primary habitat** and optional secondary habitats:
- `UNDERGROUND_RUINS`: 27 primary monsters (Dungeon/Crypt denizens like Skeletons, Zombies, Ghouls, Mimics, etc.) + 13 secondary.
- `MOUNTAINS`: 5 primary monsters (Manticore, Chimera, Harpy, Gargoyle, etc.) + 12 secondary.
- `DESERT`: 4 primary monsters (Mummy, Basilisk, Giant Scorpion, etc.) + 4 secondary.
- `COAST`: 2 primary monsters + 7 secondary.
- `RIVER_LAKE`: 2 primary monsters + 4 secondary.
- `AQUATIC`: 2 secondary monsters.
- `EXTRAPLANAR`: 1 secondary monster.
- `OCEAN`: 1 secondary monster.

#### 3. Special Location Overrides
- **`TOWN_GATES`**: Overrides `PLAINS` at Oakhaven North Gate (7, 6) and South Gate (7, 8).
- **`ANCIENT_BRIDGE`**: Overrides `BRIDGE` at The Old Stone Bridge (8, 7).
- **`MARKETPLACE`**: Overrides `CITY` at Oakhaven (7, 7).

#### 4. Pathfinder 1e Categories Not Yet Mapped / Subtype Distinction
- **Cold / Snow / Tundra**: In Pathfinder 1e and Darkgrid, "Cold" is a **creature subtype** (`creature_type` e.g., Yeti and Winter Wolf), NOT a terrain enum. Cold monsters reside in `HILLS`, `MOUNTAINS`, and `FOREST`.
- **Water Boundaries (`OCEAN`, `RIVER_LAKE`, `AQUATIC`)**: In Darkgrid's current world map, water tiles are strictly impassable boundaries (`is_passable = 0`). Movement validation prohibits characters from entering or standing on water tiles, so they never serve as player exploration or combat backdrops.
- **Bridge Support**: Supported as a distinct passable tile (`BRIDGE`) and location override (`ANCIENT_BRIDGE`).
- **Underground Ruins**: Supported in habitat data and now fully equipped with concept artwork in anticipation of dungeon delves.

---

## 2. Database Architecture & Schema

Implemented in migration [`db/migrations/008_terrain_artwork_system.sql`](../db/migrations/008_terrain_artwork_system.sql).

### Table: `terrain_artworks`

```sql
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
```

### Partial Unique Indexes & Integrity Guards

```sql
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

-- 4. Lookup Performance Index
CREATE INDEX IF NOT EXISTS idx_terrain_artworks_lookup
ON terrain_artworks(terrain_type, is_active);
```

---

## 3. Priority Resolution Hierarchy

When resolving artwork for any `currentTile`, `getTerrainArtworkForTile(db, tile)` follows this strict evaluation order:

```
[1. Specific Tile ID Override]  --> tile_id = tile.id AND is_active = 1
         │ (not found)
[2. Location Feature Override]  --> location_key = tile.feature AND is_active = 1
         │ (not found)
[3. Terrain Default]           --> terrain_type = tile.terrain AND is_active = 1
         │ (not found)
[4. Database Fallback Entry]   --> terrain_type = 'FALLBACK' AND is_active = 1
         │ (not found)
[5. Code-Level Safe Fallback]  --> DEFAULT_FALLBACK_ARTWORK (in-memory hardcoded)
```

---

## 4. Master Artwork Catalog & Approval Manifest

All assets are located in `public/images/terrain/` and rendered in 16:9 (1536×864) high-quality WebP format:

| Asset ID | Name & Theme | Terrain / Mapping | Status | Filename | Size (KB) | SHA-256 Hash |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ART-01** | Oakhaven City | `CITY` (Default) | **APPROVED** | `terrain_city_oakhaven.webp` | 193.1 KB | `52a5774d3f9dadc0461dd3ed5bb8486ee4b18c850805a8bb192aea0e16e583c4` |
| **ART-02** | Oakhaven Town Gates | `TOWN_GATES` (Override) | **APPROVED** | `terrain_town_gates.webp` | 198.2 KB | `ac2969825f5a1dd16d2cca611c8c3c91ffb2b5c83de2b3aa806a5f36f294e792` |
| **ART-03** | Ancient Forest | `FOREST` (Default) | **APPROVED** | `terrain_forest.webp` | 234.8 KB | `d97879bf1f8df73b19f887156f3ffbb2be65d932120be007231118e89efff1fb` |
| **ART-04** | Windswept Plains | `PLAINS` (Default) | **APPROVED** | `terrain_plains.webp` | 249.7 KB | `8de77081c470144a1f74ec6e8822f583bb08e42565a00f7b6025d78cf3146208` |
| **ART-05** | Drowned Swamp | `SWAMP` (Default) | **APPROVED** | `terrain_swamp.webp` | 204.7 KB | `42e85b7d506fe737669abdf7aa510010e86675b3b6b3984e0d3741d9e0b16317` |
| **ART-06B** | Rolling Hills (Remake) | `HILLS` (Default) | **APPROVED** | `terrain_hills.webp` | 175.6 KB | `aab72d9b9a34ac9880931edb5720fd567d4e5c3cb6469abfbc8406973e324934` |
| **ART-06A** | Craggy Mountains (Repurposed) | `MOUNTAINS` (Default) | **APPROVED** | `terrain_mountains.webp` | 221.8 KB | `fa0a41776ba587a1d1c202b04f33234da311fdb10646720b9f9d17adce8980e0` |
| **ART-07** | Primeval Jungle | `JUNGLE` (Default) | **APPROVED** | `terrain_jungle.webp` | 198.9 KB | `244afad14ef62472ed0e63357fb32f8df355ce82f42b6ae7e6402e747b20d3e2` |
| **ART-08** | The Old Stone Bridge | `BRIDGE` & `ANCIENT_BRIDGE` | **APPROVED** | `terrain_bridge.webp` | 150.0 KB | `4c4c54a3eb3ed4cd5aa78c659d39945c8e83851d9598bfde798406dd202b1925` |
| **ART-09** | Underground Ruins | `UNDERGROUND_RUINS` (Default) | **APPROVED** | `terrain_underground_ruins.webp` | 184.7 KB | `a6a0c316a19bcd8556e6c17e886413a4ea8a0cb21401ba9923215a0c508caccf` |
| **ART-10** | Storm-Swept Coast | `COAST` (Default) | **APPROVED** | `terrain_coast.webp` | 188.7 KB | `2efd67da5bfe545b052e92a724b855fc91a9118f1fff6eedd13f3daf2104f985` |
| **ART-11** | Arid Desert Barrens | `DESERT` (Default) | **APPROVED** | `terrain_desert.webp` | 162.8 KB | `846a529b99545876e121912fa9ae6e49f1c823d2a0c817886a73f7474d1beb41` |
| **FALLBACK-V2** | Misty Realm (Remake) | `FALLBACK` (Neutral) | **APPROVED** | `terrain_fallback.webp` | 166.7 KB | `926d5d94539c151337c3a904ef16ecb31d7c32fe79206734199a23fb51969079` |
| **ARCHIVED-V1** | Scorched Barrens (V1) | Archived Candidate | **ARCHIVED** | `terrain_fallback_v1_scorched.webp` | 170.8 KB | `c8af08277b4d58320a5f302a22a69e18cb726dca672eb3530eda22eed17f8cf0` |

### Contact Sheet Location
The high-resolution master contact sheet is stored at:
- `public/images/terrain/master_terrain_contact_sheet.png`

---

## 5. Verification Suite & Test Results

All **136 automated tests** pass with a 100% success rate (`npm test`).
- **Zero Regressions:** Character mechanics, d20 rules, combat calculations, equipment rules, market transactions, and permadeath remain completely unaffected.
- **Secrecy Preservation:** Encounter secrecy is strictly maintained; terrain art never leaks monster attributes, HP, or hidden threat identity.
- **Single-Screen UI Integrity:** 20 headless browser screenshots confirm zero document scrolling across standard resolutions (1440×900, 1366×768, 1280×720).
