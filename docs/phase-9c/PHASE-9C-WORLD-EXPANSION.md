# DARKGRID — PHASE 9C WORLD EXPANSION REPORT

**Dagsetning:** 24. október 2026  
**Verkhluti:** Þriðja yfirheimssvæðið — **Ravencrag Highlands** (`RAVENCRAG_HIGHLANDS`) & Stækkað `44×30` Heimskort  
**Staða:** STAÐFEST

---

## 1. Stækkun yfirheims (`30×30 -> 44×30`)

Yfirheimur DarkGrid var stækkaður úr `30×30` (`900` reitum) í **`44×30` (`1.320` reiti)** þannig að öll þrjú stóru landsvæðin mynda samfelldan, óslitinn heim:

1. **Blackwood Forest / Goblin Forest (Vestur):** `711` reitir — Oakhaven Sanctuary `[15, 27]`, Goblin Cave `[9, 12]`, Goblin Stronghold `[15, 2]`.
2. **The Undead Lands (Mið-austur):** `189` reitir — Deadman's Mire, Ashen Barrowlands, Necropolis Sanctum & Ancient Crypt `[26, 5]`.
3. **Ravencrag Highlands (Austur, `x = 30..43, y = 0..29`):** **`420` reitir** — grýtt fjalla- og hálendissvæði með djúpum giljum, klettabeltum, rústum og virki á Stormpeak.

---

## 2. Náttúrulegar tengileiðir (Border Passes)

Ravencrag Highlands tengist vestari landsvæðum með fjórum náttúrulegum gönguskörðum yfir landamæralínuna `x = 29 -> x = 30`:

- **Suðurskarð (`[29, 25] <-> [30, 25]`):** Tengir austurjaðar Goblin Forest við Windscar Foothills.
- **Windscar Pass (`[29, 23] <-> [30, 23]`):** Aðalfjallavegurinn (`ROUTE_E_RAVENCRAG_HIGHLAND_ROAD`) frá Sepulcher Road upp að Windscar Gate `[31, 23]`.
- **Miðskarð (`[29, 15] <-> [30, 15]`):** Fjallastígur milli Barrowlands og Shattered Gorge.
- **Norðurskarð (`[29, 9] <-> [30, 9]`):** Hátt fjallaskarð milli Necropolis-hæða og Stormpeak Crags.

---

## 3. Þrjú undirsvæði og SQLite Danger-Zone Profiles

| Undirsvæði (Sub-Biome) | Hnitabil (`y`) | SQLite `danger_zone_profiles` lykill | Hættustig | Lýsing og ógnir |
|---|---|---|---|---|
| **Windscar Foothills** | `y = 19..29` | `HIGHLAND_FOOTHILL_ROAD` | `HIGH` (`24%` encounter, `34%` ambush) | Vindbarðar hlíðar, furuholt og varðturnar; `Orc`, `Wolf`, `Worg`, `Hobgoblin`, `Harpy`, `Blood Hawk`. |
| **Shattered Gorge** | `y = 10..18` | `HIGHLAND_SHATTERED_GORGE` | `VERY_HIGH` (`29%` encounter, `42%` ambush) | Djúp klettagil, steinbrýr og rústir; `Orc`, `Ogre`, `Worg`, `Harpy`, `Griffon`, `Bugbear`, `Manticore`. |
| **Stormpeak Crags** | `y = 0..9` | `STORMPEAK_CITADEL_APPROACH` | `EXTREME` (`33%` encounter, `48%` ambush) | Stormbarðir basalttindar og virkishlið; `Ogre`, `Troll`, `Orc`, `Hill Giant`, `Manticore`, `Griffon`, `Wyvern`. |

---

## 4. Kennileiti, Major Landmark Scene, Boss og Oakhaven Quest

- **Minni kennileiti í Ravencrag Highlands:**
  - `WINDSCAR_GATE [31, 23]` — Windscar Pass Gate
  - `HIGHLAND_PINE_TOR [34, 21]` — Wind-Bent Pine Tor
  - `GIANTS_SPAN_BRIDGE [35, 15]` — Giant's Span Stone Bridge
  - `CYCLOPS_WATCHTOWER [39, 13]` — Ruined Cyclops Watchtower
  - `STORMPEAK_CAIRN [37, 8]` — Stormpeak War-Cairn
  - `CITADEL_APPROACH [37, 4]` — Iron-Spiked Causeway
- **Major Landmark — Ravencrag Citadel (`[37, 3]`):**
  - Opnar sjálfkrafa sérhannaða Major Landmark Scene (`RAVENCRAG_CITADEL`) við komu.
  - Aðgerðin **Confront the Highland Warlord** (`CONFRONT_HIGHLAND_WARLORD`) hrindir af stað bardaga gegn fasta bossinum **Warlord Kraug the Crag-Breaker** (`34 HP`, `135 Gold`).
- **Oakhaven Quest (`THE_RAVENCRAG_WARLORD`):**
  - **„The Warlord of Ravencrag"** frá Captain Vane í Oakhaven Sanctuary (`+140 Gold`, `+160 Base XP`).
