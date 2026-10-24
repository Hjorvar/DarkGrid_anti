# DARKGRID — PHASE 9C IMPLEMENTATION REPORT

**Dagsetning:** 24. október 2026  
**Verkhluti:** Phase 9C — Large Dungeons (`GOBLIN_CAVE`, `ANCIENT_CRYPT`), True Dungeon Line-of-Sight Fog of War & Third Overworld Region (`RAVENCRAG_HIGHLANDS`)  
**Staða:** LOKIÐ OG STAÐFEST (`100%` sjálfvirk próf og sjónræn QA)

---

## 1. Yfirlit yfir innleiðingu í Phase 9C

Í Phase 9C var heimi og neðanjarðarkerfum DarkGrid stækkað verulega án þess að búa til nýjan prototype eða kljúfa grunnkerfi leiksins:

1. **Endurnýtanlegt, gagnadrifið Dungeon-kerfi (`dungeon-service.js`):**
   - notar sama reitakerfi (grid movement), `ENCOUNTER`/`AMBUSH`-rökfræði, bardagavél, drykki (potions), fjársjóði (loot), XP, permadeath og stéttarhæfileika og yfirheimurinn.
   - Ekkert „roaming monster“ tákn er sýnt á kortinu; ógnir birtast í gegnum `ENCOUNTER` (val um `Fight` eða `Avoid`) og `AMBUSH` (bein innkoma í bardaga með Round 1–2 Flee Lock).
2. **Tvö stór, könnunarhæf neðanjarðarkort (Dungeons):**
   - **Goblin Cave (`GOBLIN_CAVE`)** undir Whispering Crags `[9, 12]` í Goblin Forest: **`20×18 = 360` heildarreitir** (`135` gangfærir reitir), margar leiðir, hliðargöng, valfrjáls herbergi, gildrur (`HAZARD_BONE_SPIKES`, `HAZARD_SPIDER_WEBS`), 4 fjársjóðskistur, fastir varðbardagar og lokasalur með fasta bossinum **Skulkrip the Cave Brood-King** á `[16, 2]`.
   - **Ancient Crypt (`ANCIENT_CRYPT`)** í Necropolis Sanctum `[26, 5]` í Undead Lands: **`20×19 = 380` heildarreitir** (`175` gangfærir reitir), grafhvelfingar, súlnasalur (Temple Nave), 4 helgigripahvelfingar, necrotic hættur (`HAZARD_NECROTIC_MIST`, `HAZARD_CURSED_BRAZIER`), fastir undead-verðir og innri grafarsalur með fasta undead bossinum **Lord Malakor the Barrow-Wight King** á `[10, 2]`.
   - Bæði dungeons eru `100%` samhengisprófuð með Breadth-First Search (`verifyDungeonConnectivity`) frá inngangi að hverjum einasta gangfæra reit og að boss-reit.
3. **Þröngt Dungeon Fog of War og raunverulegt Line-of-Sight (LoS):**
   - Venjulegar hetjur (`FIGHTER`, `CLERIC`) sjá aðeins **2 reiti** (`radius = 2`) í kringum sig í hellum (samanborið við `3` á yfirheimi), og `RANGER` heldur hóflegu forskoti (**3 reitir**, `radius = 3`) án þess að geta séð í gegnum veggi eða handan 90° horna.
   - Supercover-geislaleit (`hasDungeonLineOfSight`) stöðvar sýn í gegnum alla ógegnsæja veggi (`is_opaque = 1`, `is_passable = 0`) og kemur í veg fyrir að hetja sjái handan lokaðra horna.
   - Þrjú skýr sjónræn stig:
     - `UNEXPLORED`: kolsvart (`Unexplored Darkness`), engar upplýsingar um herbergi, fjársjóði eða boss leka í API-gögn.
     - `EXPLORED_MEMORY`: dimmt minnismerkt svæði sem sýnir áður uppgötvað landslag og veggi án virkra ógna.
     - `VISIBLE`: upplýst svæði innan núverandi sjónlínu hetjunnar.
   - Uppgötvun hvers hellis er vistuð varanlega í SQLite (`character_dungeon_discovered_tiles` og `character_dungeon_events`) fyrir hverja hetju og helst óbreytt við hreyfingu og endurræsingu.
4. **Oakhaven Quest tengt Ancient Crypt:**
   - Nýtt verkefni í Oakhaven Sanctuary (`[15, 27]`): **`THE_ANCIENT_CRYPT` — „The Crypt of the Barrow-King"** frá Father Aldous (`+120 Gold`, `+150 Base XP` skalar með `INT`).
5. **Þriðja stóra yfirheimssvæðið — Ravencrag Highlands (`RAVENCRAG_HIGHLANDS`):**
   - Heimskortið var stækkað úr `30×30` (`900` reitum) í **`44×30` (`1.320` reiti)** þar sem Ravencrag Highlands þekur `x = 30..43, y = 0..29` (`420` reiti).
   - Tengist núverandi heimi um fjögur náttúruleg fjallaskörð (`[29, 25] -> [30, 25]`, `[29, 23] -> [30, 23]`, `[29, 15] -> [30, 15]` og `[29, 9] -> [30, 9]`).
   - Þrjú undirsvæði (sub-biomes): **Windscar Foothills** (`y = 19..29`), **Shattered Gorge** (`y = 10..18`) og **Stormpeak Crags** (`y = 0..9`).
   - Þrjú sjálfstæð `danger_zone_profiles` í SQLite (`HIGHLAND_FOOTHILL_ROAD`, `HIGHLAND_SHATTERED_GORGE`, `STORMPEAK_CITADEL_APPROACH`).
   - Sex minni kennileiti og eitt stórt Major Landmark: **Ravencrag Citadel (`[37, 3]`)** með sjálfvirkri Major Landmark Scene, fasta bossinum **Warlord Kraug the Crag-Breaker** og Oakhaven-verkefninu **`THE_RAVENCRAG_WARLORD` — „The Warlord of Ravencrag"**.
6. **Stækkað 3-svæða Region Map (`[M]`):**
   - Sýnir öll þrjú yfirheimssvæðin (`Goblin Forest`, `Undead Lands`, `Ravencrag Highlands`) á sama `44×30` yfirlitskorti með heiltöluskölun (`cellPx = 13`, DPR-snapping) án óskýrleika og án þess að ókönnuð kennileiti leki upplýsingum.

---

## 2. Helstu skrár sem voru uppfærðar eða búnar til í Phase 9C

- `db/migrations/019_phase9c_dungeons_and_highlands.sql` — SQLite töflur (`dungeon_definitions`, `dungeon_tiles`, `character_dungeon_discovered_tiles`, `character_dungeon_events`), nýir `danger_zone_profiles`, `landmark_scene_definitions`, `quest_definitions` og `world_boss_definitions`.
- `action-ui-lab/server/services/dungeon-service.js` — Gagnadrifin dungeon-vél, `20×18` Goblin Cave og `20×19` Ancient Crypt kort, BFS-tengingarpróf, supercover Line-of-Sight + 90° hornblokkun, fjársjóðir, gildrur, fastir varðbardagar og bossar.
- `action-ui-lab/server/services/topdown-world-service.js` — Stækkun yfirheims í `44×30` (`1.320` reitir), Ravencrag Highlands landslag, monster-val, Major Landmark Scene fyrir Ravencrag Citadel og fjöl-verkefna stuðningur (`THE_GOBLIN_CHIEFTAIN`, `THE_ANCIENT_CRYPT`, `THE_RAVENCRAG_WARLORD`).
- `action-ui-lab/server/controllers/navigation-controller.js`, `combat-controller.js`, `character-town-controller.js`, `adventure-scenario-controller.js` — Innganga/útganga úr dungeons, veggjaárekstrarvörn á server, boss-bardagar og verkefnaafgreiðsla.
- `action-ui-lab/public/js/world/topdown-renderer.js`, `scene-renderer.js`, `navigation.js`, `modals.js` — 2D teikning á dungeons með 3-stiga Fog of War, Ravencrag Highlands teikning og stækkað `44×30` Region Map.
