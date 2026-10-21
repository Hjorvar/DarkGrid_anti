# DARKGRID ADVENTURE LAB — WORLD IDENTITY, LANDMARKS & ADVENTURE CONTINUITY (`PHASE-5-WORLD-IDENTITY.md`)

**Dagsetning:** 2026-10-21  
**Tilgangur:** Skjalfesting á sjónrænni sérstöðu hvers heimshluta, 4-átta samfellu kennileita, sýnileika ófærra hindrana og staðfestingu á 3 lykilferðalögum (Journeys A, B og C).

---

## 1. Sjónræn sérstaða heimshluta (Regional Visual Identity)

| Heimshluti (Region) | Hnit / Umfang | Litapalletta, Lýsing & Loftslag (`AtmosphereProfile`) | Sérkenni & Gólfflötur (`stageSurface`) |
| :--- | :--- | :--- | :--- |
| **Oakhaven Sanctuary & Gates** | `[7,7]` (`CITY`), `[7,6]` North Gate, `[7,8]` South Gate | Hlýtt varðeldalýsi (`rgba(230, 175, 85, 0.10)`), blysljós við timburvirki (`sanctuary` / `gatehouse`) | Blautir götusteinar (`cobble-road`), járnslegin eikarhlið, varðturnar |
| **Mirkwood Forest & Heart of the Mirkwood** | `41` reitur í norðri (`y=1..6`), miðás `[7,5]..[7,3]` | Djúpgræn skógarþoka (`rgba(36, 72, 48, 0.12)`), silfruð morgunþoka (`forest-deep` / `ancient-oak`) | Jarðvegur, lauf og mosavaxnar rætur (`forest-earth`), rúnasteinn á `[7,5]`, Primeval Black Oak á `[7,3]` |
| **Blackwater Crossing (Bridge & Watchpost)** | `[8,7]` Old Stone Bridge (`BRIDGE`), `[9,7]` Watchpost (`UNDERGROUND_RUINS`) | Kaldur úði úr gljúfrinu (`rgba(56, 115, 155, 0.14)`), gráblá árgufan (`bridge` / `ruins-exterior`) | Fornar steinhellur (`flagstone`), brotnir brúarstólpar og gotneskur tollhliðsbogi |
| **Verdant Plains & Windblown Heath** | `46` reitir í miðju og austri (`x=5..13, y=2..9`) | Vindbarin heiðarlýsing, stormský við sjóndeildarhring (`plains-open` / `plains-heath`) | Vagnför, lyng og flatir steinar (`wilderness-soil`), bautasteinar á `[12,4]` |
| **Rotting Fen & Deadman’s Mire** | `33` reitir í suðvestri (`x=1..10, y=9..13`) | Grængrá mýrargufa (`rgba(64, 92, 62, 0.13)`), kyrrstætt svart vatn (`swamp-mire`) | Sokknir eikarplankar og svört fenjaleðja (`mire-mud`), ljóskersstaur á `[6,10]`, sokknar musterisrústir á `[4,11]` |
| **Raven Crags** | `25` reitir í vestri (`x=1..5, y=1..8`) | Kaldur fjallavindur og skriðuþoka (`rgba(110, 120, 132, 0.11)`), (`hills-crag` / `hills-ridge`) | Brotið dökkgrátt flöguberg (`crag-stone`), vörður og dauð grenitré á `[3,5]` |
| **Venomous Jungle** | `12` reitir í suðaustri (`x=8..11, y=10..13`) | Rök, gulgræn gróþoka (`rgba(48, 88, 54, 0.13)`), þéttar vafningsjurtir (`jungle`) | Mosavaxnar steinhellur og risa-stoðrætur (`jungle-humus`), lýsandi sveppir á `[9,11]` |

---

## 2. Sýnileiki ófærra hindrana (Impassable Obstacles & World Boundaries)

Allir `65` ófærir reitir og ytri mörk 15×15 kortsins birtast með skýrri 1. persónu hindrunarsýn (`isBlockedAhead: true`, `viewCategory: 'BARRIER'`) og samhengisháðum leiðbeiningum (`boundaryGuidance`):

1. **Blackwater River (`RIVER_LAKE`, `x=8..9`):**
   - Á `[8,7]` (Old Stone Bridge) sýna `NORTH` og `SOUTH` brotna steinbrúarveggi yfir straumhörðu gljúfrinu (`bridge_8_7_north.jpg`, `bridge_8_7_south.jpg`).
   - Á `[9,7]` (Bridge East Watchpost) sýnir `NORTH` gljúfurvegginn (`watchpost_9_7_river_flank.jpg`) og `SOUTH` sýnir rofinn suðurvegginn (`watchpost_9_7_south_river_gorge.jpg` í Candidate Preview Mode).
   - Á `[7,6] EAST` og `[7,8] EAST` sést timburvirki Oakhaven þar sem það endar við árbakkann (`north_gate_7_6_east.jpg`, `south_gate_7_8_east.jpg`).
   - Allir aðrir skógar-, sléttu-, mýrar- og frumskógarreitir sem liggja að Blackwater River sýna `barrier_blackwater_bank_pov.jpg`.
2. **Stonefang Crag (`[6,5]`, `MOUNTAINS`):**
   - Frá Mirkwood Crossroads `[7,5] WEST` birtist þverhníptur granítveggurinn `crossroads_7_5_west.jpg` með rannsóknarhæfu POI (`poi_stonefang_crag`).
3. **Darkmount Peaks & Western Crag Wall (`y=0`, `x=0`, `MOUNTAINS`):**
   - Allir nyrstu og vestustu reitir (`y=1` horft í `NORTH`, `x=1` horft í `WEST`) sýna `barrier_darkmount_crags_pov.jpg`.
4. **The Murksea (`x=14`, `OCEAN`):**
   - Allir austustu reitir (`x=13` horft í `EAST`) sýna klettaströndina `barrier_murksea_cliffs_pov.jpg` og strandvörðuna `poi_murksea_cairn`.
5. **The Bottomless Mire (`y=14`, Impassable `SWAMP`):**
   - Allir syðstu reitir (`y=13` horft í `SOUTH`, ásamt innri fenjahindrunum) sýna viðvörunarstaura í ófæru kviksyndi (`barrier_bottomless_mire_pov.jpg`, `poi_bottomless_mire_stakes`).

---

## 3. Kennileiti og 4-átta samfella (13 World Landmarks)

Öll 13 kennileiti heimsins hafa staðfesta 4-átta (`NORTH`, `EAST`, `SOUTH`, `WEST`) og aðkomu-samfellu:

1. **Oakhaven Sanctuary (`[7,7]`):** 4 sérmyndir (`oakhaven_7_7_north/east/south/west.jpg`) + aðkomumynd úr vestri á `[6,7] EAST` (`terrain_town_gates.webp`).
2. **Oakhaven North Gate (`[7,6]`):** 4 sérmyndir (`north_gate_7_6_north/east/south/west.jpg`) + aðkomumyndir úr norðri (`[7,5] SOUTH`), suðri (`[7,7] NORTH`) og vestri (`[6,6] EAST`).
3. **Oakhaven South Gate (`[7,8]`):** 4 sérmyndir (`south_gate_7_8_north/south/east/west.jpg`) + aðkomumyndir úr norðri (`[7,7] SOUTH`), suðri (`[7,9] NORTH`) og vestri (`[6,8] EAST`).
4. **Mirkwood Crossroads (`[7,5]`):** 4 sérmyndir (`crossroads_7_5_north/east/south/west.jpg`) + aðkomumyndir úr norðri (`[7,4] SOUTH`) og austri (`[8,5] WEST`).
5. **Mirkwood Trail (`[7,4]`):** Aðkomumynd að risaeikinni í norðri (`forest_7_4_north_oak_approach.jpg`) og útsýni til baka að vegamótum í suðri (`crossroads_7_5_lateral.jpg`).
6. **Heart of the Mirkwood / Primeval Black Oak (`[7,3]`):** 4 aðgreindar áttamyndir á reitnum + Tier 1 aðkomumynd (`forest_7_4_north_oak_approach.jpg`) úr öllum 4 höfuðáttum (`[7,4] N`, `[7,2] S`, `[6,3] E`, `[8,3] W`).
7. **The Old Stone Bridge (`[8,7]`):** 4 sérmyndir (`bridge_8_7_east/west/north/south.jpg`) + aðkomumyndir frá `[7,7] EAST` og `[9,7] WEST`.
8. **Bridge East Watchpost (`[9,7]`):** 4 sérmyndir (`watchpost_9_7_west/east/river_flank/south_river_gorge.jpg`) + aðkomumynd úr austri á `[10,7] WEST` (`watchpost_ruins_exterior.jpg`).
9. **Rotting Fen Boardwalk (`[6,10]`):** Sérmynd á `[6,10] SOUTH` (`swamp_willow_boardwalk_pov.jpg`) + aðkomumynd úr norðri á `[6,9] SOUTH` og 0 árekstrar á `NORTH/EAST/WEST`.
10. **Deadman’s Mire (`[4,11]`):** 4 aðgreindar áttamyndir á `[4,11]` + Tier 1 aðkomumynd (`swamp_approach_mire_ruins.jpg`) úr öllum 4 höfuðáttum (`[4,10] S`, `[3,11] E`, `[5,11] W`, `[4,12] N`).
11. **Raven Crags Ravine (`[3,5]`):** Sérmynd með vörðu á `[3,5] NORTH` (`hills_raven_crags_ravine_pov.jpg`) og hryggjasýn á `[3,5] SOUTH` (`hills_highland_ridge_pov.jpg`), auk fullrar `WESTERN_RAVEN_CRAGS_CORRIDOR` samfellu (`[5,5] <-> [4,5] <-> [3,5]`).
12. **Windblown Heath (`[12,4]`):** Sérmynd með bautasteinum á `[12,4] NORTH` (`plains_windblown_heath_pov.jpg`) án endurtekningar á hinum 3 áttunum.
13. **Venomous Jungle Spore Hollow (`[9,11]`):** Sérmynd á `[9,11] SOUTH` (`jungle_venomous_trail_pov.jpg`) + Tier 1 aðkomumynd úr 4 áttum (`[9,10] S`, `[8,11] E`, `[10,11] W`, `[9,12] N`).

---

## 4. Staðfesting á 3 lykilferðalögum (Mandatory Adventure Journeys A, B & C)

Öll 3 ferðalögin úr kafla 5.1 voru keyrð skref fyrir skref í sjálfvirkum prófum ([`tests/phase-5-world.test.js`](../../tests/phase-5-world.test.js)):

### Journey A — Oakhaven $\rightarrow$ Mirkwood Forest $\rightarrow$ Primeval Black Oak $\rightarrow$ Return
1. **`[7,7] NORTH` (Oakhaven Sanctuary):** `oakhaven_7_7_north.jpg` — sést norður eftir blautri götusteinsgötu að North Gate.
2. **Skref `FORWARD` á `[7,6] NORTH` (North Gate):** `north_gate_7_6_north.jpg` — komið út fyrir hliðið, Mirkwood skógarjaðarinn fram undan (`NORTHERN_MIRKWOOD_CORRIDOR`). Snúningur í `EAST` sýnir Blackwater River hindrunina (`north_gate_7_6_east.jpg`).
3. **Skref `FORWARD` á `[7,5] NORTH` (Mirkwood Crossroads):** `crossroads_7_5_north.jpg` — Runic Waystone (`poi_crossroads_waystone`) við stíginn. Snúningur í `WEST` sýnir Stonefang Crag (`crossroads_7_5_west.jpg`, `isBlockedAhead: true`).
4. **Skref `FORWARD` á `[7,4] NORTH` (Mirkwood Trail):** `forest_7_4_north_oak_approach.jpg` — risa-rótargeigur Primeval Black Oak birtist í þokunni fram undan (`poi_ancient_oak_approach`).
5. **Skref `FORWARD` á `[7,3] NORTH` (Heart of the Mirkwood):** `forest_ancient_oak.jpg` — komið beint að Primeval Black Oak (`poi_ancient_oak`).
6. **180° snúningur í `SOUTH` á `[7,3]`:** `ancient_oak_7_3_south.jpg` — horft suður undan rótargeignum til baka eftir stígnum.
7. **Bakaleið `SOUTH` (`[7,4] -> [7,5] -> [7,6] -> [7,7]`):** Sýnir í réttri röð `crossroads_7_5_lateral.jpg` $\rightarrow$ `crossroads_7_5_south.jpg` $\rightarrow$ `north_gate_7_6_south.jpg` $\rightarrow$ `oakhaven_7_7_south.jpg`.

### Journey B — Oakhaven $\rightarrow$ Old Stone Bridge $\rightarrow$ Bridge East Watchpost $\rightarrow$ Eastern Plains $\rightarrow$ Return
1. **`[7,7] EAST` (Oakhaven River Gate):** `oakhaven_7_7_east.jpg` — sést út um austurhliðið út á Old Stone Bridge.
2. **Skref `FORWARD` á `[8,7] EAST` (The Old Stone Bridge):** `bridge_8_7_east.jpg` — horft austur yfir steinbrúna að gotneska boga Watchpost. Snúningur í `NORTH` og `SOUTH` sýnir brúarveggina og gljúfrið (`bridge_8_7_north.jpg`, `bridge_8_7_south.jpg`, `isBlockedAhead: true`).
3. **Skref `FORWARD` á `[9,7] EAST` (Bridge East Watchpost):** `watchpost_9_7_east.jpg` — horft austur úr rústunum út á Verdant Plains.
4. **Skref `FORWARD` á `[10,7] EAST` (Verdant Plains):** Komið út á austursléttuna (`EASTERN_BRIDGE_WATCHPOST_CORRIDOR`).
5. **180° snúningur í `WEST` á `[10,7]`:** `watchpost_ruins_exterior.jpg` — horft til baka í vestur að ytri rústum Bridge East Watchpost.
6. **Bakaleið `WEST` (`[9,7] -> [8,7] -> [7,7]`):** Sýnir `watchpost_9_7_west.jpg` $\rightarrow$ `bridge_8_7_west.jpg` $\rightarrow$ `oakhaven_7_7_west.jpg`.

### Journey C — Oakhaven $\rightarrow$ South Gate $\rightarrow$ Rotting Fen Boardwalk $\rightarrow$ Deadman’s Mire $\rightarrow$ Return
1. **`[7,7] SOUTH` $\rightarrow$ `[7,8] SOUTH` (South Gate):** `oakhaven_7_7_south.jpg` $\rightarrow$ `south_gate_7_8_south.jpg`.
2. **Skref `FORWARD` á `[7,9] SOUTH` og `WEST` á `[6,9]`:** `SOUTHERN_ROTTING_FEN_CORRIDOR` virkjar samfelldar fenjalýsingar (`continuityNote` og `horizonHint`).
3. **Snúningur í `SOUTH` á `[6,9]` og skref á `[6,10] SOUTH` (Rotting Fen Boardwalk):** `swamp_willow_boardwalk_pov.jpg` (`poi_rotting_fen_boardwalk`).
4. **Ferð í vestur (`[5,10] -> [4,10]`) og snúningur í `SOUTH` á `[4,10]`:** `swamp_approach_mire_ruins.jpg` — musterisbogar Deadman's Mire birtast í þokunni fram undan (`poi_deadmans_mire_approach`).
5. **Skref `FORWARD` á `[4,11]` og snúningur í `NORTH`:** `deadmans_mire_4_11_ruins.jpg` (`poi_deadmans_mire`).
