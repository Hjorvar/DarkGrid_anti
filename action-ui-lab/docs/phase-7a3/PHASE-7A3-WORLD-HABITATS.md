# DARKGRID — PHASE 7A.3: WORLD HABITATS & FUTURE BIOME EXPANSION

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Status:** Authoritative Specification (Retires 98-Monster Surface Reachability Mandate)

---

## 1. Core Habitat Rule: Preserve Natural Monster Ecology

In Phase 7A.2 ([`PHASE-7A2-EXECUTIVE-SUMMARY.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-EXECUTIVE-SUMMARY.md#L70-L72)), an open question asked whether underground and coastal monsters (`Mummy`, `Skeletal Champion`, `Phase Spider`, `Drow`, `Duergar`, `Giant Crab`, `Sahuagin`) should have surface terrain codes (`F`, `H`, `S`, `T`) appended so all `98` monsters could spawn on the current `15×15` surface map.

**Phase 7A.3 establishes the owner's definitive rule:**
1. **Never Tamper with Natural Monster Habitats:** Do **not** alter `monsters.habitat` or `monster_terrains` to force subterranean, alpine, desert, or oceanic monsters onto surface forests, plains, or hills.
2. **Remove the 98-Monster Surface Reachability Mandate:** It is completely natural and expected that monsters native to unimplemented biomes remain unreachable on the current surface map until their proper regions are built.
3. **Simulation Scope:** Phase 7B simulations evaluate natural encounter distribution across the terrains that actually exist on the current map (`86` surface-active monsters on `001_seed_world.sql`, plus `10` underground ruin monsters when testing the Adventure Lab's `UNDERGROUND_RUINS` tile), while still allowing direct unit/matchup testing against all `98` monsters.
4. **Separate Future Expansion Task:** Adding new world biomes is a dedicated future expansion phase, **not** part of Phase 7B.

---

## 2. Verified Audit of Current World Map vs. 98 Monster Habitats

### 2.1 Current `15×15` Overworld Map (`db/seeds/001_seed_world.sql`)
Querying `map_tiles` in `001_seed_world.sql` confirms the exact tile distribution of the `225` tiles:

| Terrain Type | Habitat Code | Passable (`is_passable = 1`) | Safe (`is_safe = 1`) | Tile Count | Spawns Random Encounters? |
|---|---:|---|---|---:|---|
| `FOREST` | `F` | Yes | No | `38` | **Yes (Active Surface Wilderness)** |
| `SWAMP` | `S` | Yes (`35`) / No (`14`) | No | `49` | **Yes (`35` Active Surface Wilderness tiles)** |
| `PLAINS` | `P` | Yes | No (`30`) / Yes (`2`) | `32` | **Yes (`30` Active Surface Wilderness tiles)** |
| `JUNGLE` | `J` | Yes | No | `28` | **Yes (Active Surface Wilderness)** |
| `HILLS` | `H` | Yes | No | `27` | **Yes (Active Surface Wilderness)** |
| `BRIDGE` | — | Yes | No | `1` | Yes (No monsters seeded with `BRIDGE`) |
| `CITY` | `T` | Yes | **Yes (`1`)** | `1` | **No** (Oakhaven Sanctuary `(7,7)` is safe) |
| `MOUNTAINS` | `M` | **No (`0`)** | No | `29` | **No** (Currently impassable border/peaks) |
| `OCEAN` | `O` | **No (`0`)** | No | `13` | **No** (Currently impassable water) |
| `RIVER_LAKE` | `R` | **No (`0`)** | No | `7` | **No** (Currently impassable water) |

*Note:* In the Action UI Lab sandbox ([`action-ui-lab/server/services/sandbox-db-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/sandbox-db-service.js#L168-L176)), tile `(9,7)` (`Collapsed Watchtower`) is overridden to `terrain = 'UNDERGROUND_RUINS'` (`U`), making `U` accessible inside the lab sandbox.

### 2.2 The 86 Surface-Active Monsters vs. 12 Future-Biome Monsters

Cross-referencing all `98` rows in `monster_terrains` against the `5` active unsafe surface terrains (`FOREST`, `SWAMP`, `PLAINS`, `JUNGLE`, `HILLS`) yields:
- **`86` Surface-Active Monsters:** Have at least one terrain in `{FOREST, SWAMP, PLAINS, JUNGLE, HILLS}` and spawn naturally on the `001_seed_world.sql` overworld today.
- **`12` Non-Surface Monsters:** Have **zero** terrains in `{FOREST, SWAMP, PLAINS, JUNGLE, HILLS}` and are reserved for Underground, Mountain, Desert, Hostile Urban Ruin, or Coastal/Aquatic biomes:

| ID | Monster Name | Lvl | `monster_family` | Seeded `monster_terrains` | Active in Lab `(9,7)` `UNDERGROUND_RUINS`? | Target Future World Expansion Biome |
|---:|---|---:|---|---|---|---|
| `#15` | **Darkmantle** | 1 | `MAGICAL_BEASTS` | `UNDERGROUND_RUINS` | Yes | Caves, Caverns & Underground Ruins |
| `#25` | **Giant Crab** | 2 | `VERMIN_INSECTS` | `AQUATIC, COAST, RIVER_LAKE` | **No** | Coastlines, Rivers & Aquatic Regions |
| `#36` | **Mummy** | 5 | `UNDEAD` | `DESERT, UNDERGROUND_RUINS` | Yes | Crypts, Tombs, Deserts & Underground Ruins |
| `#43` | **Iron Cobra** | 2 | `CONSTRUCTS` | `UNDERGROUND_RUINS` | Yes | Dungeons, Arcane Vaults & Underground Ruins |
| `#44` | **Skeletal Champion** | 2 | `UNDEAD` | `MOUNTAINS, UNDERGROUND_RUINS` | Yes | Crypts, Barrow Dungeons & Mountain Keeps |
| `#46` | **Duergar** | 1 | `SUBTERRANEAN_HUMANOIDS` | `MOUNTAINS, UNDERGROUND_RUINS` | Yes | Deep Caves, Mountains & Underdark Ruins |
| `#47` | **Drow** | 1 | `SUBTERRANEAN_HUMANOIDS` | `UNDERGROUND_RUINS` | Yes | Deep Caves & Underdark Ruins |
| `#51` | **Doppelganger** | 3 | `MONSTROUS_HUMANOIDS` | `CITY, UNDERGROUND_RUINS` | Yes | Dungeons, Ruined Cities & Underground Ruins *(see Note)* |
| `#54` | **Cloaker** | 5 | `ABERRATIONS` | `UNDERGROUND_RUINS` | Yes | Deep Caverns & Underground Ruins |
| `#55` | **Phase Spider** | 5 | `ARACHNIDS` | `EXTRAPLANAR, UNDERGROUND_RUINS` | Yes | Dungeons, Deep Ruins & Planar Rifts |
| `#63` | **Morlock** | 2 | `MONSTROUS_HUMANOIDS` | `UNDERGROUND_RUINS` | Yes | Caves, Sunken Tunnels & Underground Ruins |
| `#68` | **Sahuagin** | 2 | `MONSTROUS_HUMANOIDS` | `COAST, OCEAN, RIVER_LAKE` | **No** | Coastlines, Estuaries & Aquatic Regions |

> [!NOTE]
> **Correction to Phase 7A.2 (`#51 Doppelganger`):** [`PHASE-7A2-MONSTER-KNOWLEDGE.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-MONSTER-KNOWLEDGE.md#L127) mistakenly marked `#51 Doppelganger` (`T, U`) as `Surface Active`. Because `CITY` (`T`) at `(7,7)` has `is_safe = 1`, random encounters never trigger on `CITY` tiles (`src/domain/encounters/engine.js:116`), making `#51 Doppelganger` one of the **12** non-surface monsters (spawning only in `UNDERGROUND_RUINS`).

---

## 3. Future Biome Expansion Roadmap (Outside Phase 7B)

When Darkgrid expands its world map in future post-7B phases, the following environments will unlock the remaining habitats naturally without changing a single monster's biological identity:

1. **Caves, Crypts, Dungeons & Underground Ruins (`U`):**
   - Multi-tile subterranean maps, barrow crypts, and ruined watchtowers entered from surface landmarks.
   - Naturally houses `#15 Darkmantle`, `#36 Mummy`, `#43 Iron Cobra`, `#44 Skeletal Champion`, `#46 Duergar`, `#47 Drow`, `#51 Doppelganger`, `#54 Cloaker`, `#55 Phase Spider`, `#63 Morlock`, and shared underground lurkers (`#3 Troll`, `#4 Ghoul`, `#6 Choker`, `#7 Rust Monster`, `#37 Ochre Jelly`, `#49 Wight`, `#56 Wraith`, `#57 Gibbering Mouther`).
2. **Passable High Mountains & Alpine Passes (`M`):**
   - High-altitude passes and crags (`#3 Troll`, `#8 Manticore`, `#29 Ogre`, `#33 Yeti`, `#35 Basilisk`, `#38 Winter Wolf`, `#44 Skeletal Champion`, `#46 Duergar`, `#50 Harpy`, `#52 Griffon`, `#58 Peryton`).
3. **Coastlines, Rivers & Aquatic Regions (`C`, `R`, `O`, `A`):**
   - Fordable riverbanks, coastal cliffs, and tidal marshes (`#25 Giant Crab`, `#68 Sahuagin`, `#67 Bunyip`, `#16 Lizardfolk`, `#19 Giant Frog`, `#23 Boggard`).
4. **Arid Badlands & Deserts (`D`):**
   - Sun-scorched wastes and tomb-valleys (`#17 Hyena`, `#18 Gnoll`, `#24 Death Dog`, `#28 Ankheg`, `#35 Basilisk`, `#36 Mummy`, `#53 Giant Scorpion`).
