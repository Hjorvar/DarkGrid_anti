# DARKGRID — PHASE 9C DUNGEON & FOG OF WAR QA REPORT

**Dagsetning:** 24. október 2026  
**Verkhluti:** Stór neðanjarðarkort (`GOBLIN_CAVE`, `ANCIENT_CRYPT`), Line-of-Sight Fog of War og Sjónræn QA  
**Staða:** STAÐFEST

---

## 1. Stærð og uppbygging beggja Dungeons

| Eiginleiki | Goblin Cave (`GOBLIN_CAVE`) | Ancient Crypt (`ANCIENT_CRYPT`) |
|---|---|---|
| **Yfirheims-inngangur** | Whispering Crags `[9, 12]` (Goblin Forest) | Necropolis Sanctum `[26, 5]` (Undead Lands) |
| **Heildarstærð korts** | `20 × 18 = 360` reitir (~50,6% af Goblin Forest) | `20 × 19 = 380` reitir (~53,4% af Goblin Forest) |
| **Gangfærir reitir** | `135` reitir (`100%` tengdir við inngang) | `175` reitir (`100%` tengdir við inngang) |
| **Inngangs-/útgangsreitur** | `[3, 16]` (Cavern Mouth Stairs) | `[10, 17]` (Obsidian Threshold Stairs) |
| **Boss-reitur** | `[16, 2]` — **Skulkrip the Cave Brood-King** | `[10, 2]` — **Lord Malakor the Barrow-Wight King** |
| **Fjársjóðsreitir** | `[1, 15]`, `[1, 8]`, `[18, 15]`, `[2, 2]` | `[2, 16]`, `[17, 16]`, `[2, 3]`, `[17, 3]` |
| **Fastir varðbardagar** | `[2, 9]`, `[14, 12]`, `[10, 7]` | `[6, 12]`, `[14, 12]`, `[10, 7]`, `[14, 3]` |
| **Umhverfisgildrur (Hazards)** | `[2, 14]` (Bone-Spikes), `[3, 9]` (Spider-Webs) | `[5, 11]`, `[15, 11]` (Necrotic Mist), `[10, 9]` (Cursed Brazier) |

---

## 2. Dungeon Fog of War og Line-of-Sight (LoS)

1. **Þrengra sjónsvið en á yfirheimi:**
   - Yfirheimur: `FIGHTER`/`CLERIC` = `3` reitir, `RANGER` = `4` reitir.
   - Inni í Dungeons: `FIGHTER`/`CLERIC` = **`2` reitir**, `RANGER` = **`3` reitir**.
2. **Raunverulegt Line-of-Sight (`hasDungeonLineOfSight`):**
   - Supercover-geislaleit prófar hvern reit á milli hetju `(x0, y0)` og markreits `(x1, y1)`.
   - Allir veggir (`is_passable = 0`, `is_opaque = 1`) stöðva sjónlínuna.
   - **90° hornblokkun:** Hetja getur ekki séð á ská fram hjá lokuðu vegghorni inn í óupplýst herbergi eða gang fyrr en hún stígur fram fyrir hornið.
3. **Þrjú sjónræn stig og enginn upplýsingaleki:**
   - `UNEXPLORED`: Skilar eingöngu `{ name: 'Unexplored Darkness', terrain: 'UNKNOWN', roomType: 'UNKNOWN', bossKey: null, treasureKey: null, fixedEncounterKey: null, fogState: 'UNEXPLORED' }`.
   - `EXPLORED_MEMORY`: Reitir sem hetjan hefur áður séð en eru nú utan sjónlínu birtast dimmdir með veggjum og gólfi, án þess að sýna óopnaða fjársjóði eða boss í fjarlægð.
   - `VISIBLE`: Reitir innan núverandi sjónlínu birtast í fullri birtu með öllum smáatriðum.
4. **Varanleg vistun í SQLite:**
   - `character_dungeon_discovered_tiles` og `character_dungeon_events` geyma uppgötvun og kláraða viðburði (fjársjóði, gildrur, varðbardaga og bossa) fyrir hverja hetju.

---

## 3. Sjónræn QA Skjámyndir (`action-ui-lab/docs/phase-9c/screenshots/`)

Allar 11 skjámyndir voru teknar sjálfvirkt með headless Chrome (`action-ui-lab/tests/phase9c-visual-qa.js`) án nokkurra console- eða síðuvillna:

- `01-goblin-cave-entrance.png` — Major Landmark Scene við inngang Goblin Cave `[9, 12]` með hnappinum **Delve into the Cave Mouth**.
- `02-goblin-cave-start-fog.png` — Goblin Cave kort við upphaf `[3, 16]` með þröngu Line-of-Sight Fog of War.
- `03-goblin-cave-explored-memory.png` — Sama Goblin Cave kort eftir könnun (`[10, 12]`) sem sýnir `VISIBLE`, `EXPLORED_MEMORY` og `UNEXPLORED`.
- `04-goblin-cave-boss-sanctum.png` — Brood-King Sanctum `[16, 2]` í Goblin Cave með **Skulkrip the Cave Brood-King**.
- `05-ancient-crypt-entrance.png` — Major Landmark Scene við inngang Ancient Crypt `[26, 5]` með hnappinum **Breach the Sepulcher Vault**.
- `06-ancient-crypt-start-fog.png` — Ancient Crypt kort við upphaf `[10, 17]` með þröngu Fog of War.
- `07-ancient-crypt-explored-memory.png` — Ancient Crypt kort eftir könnun í gegnum Hall of Sarcophagi og Temple Nave.
- `08-ancient-crypt-boss-sanctum.png` — Royal Sepulcher `[10, 2]` í Ancient Crypt með **Lord Malakor the Barrow-Wight King**.
- `09-ravencrag-highlands.png` — Ravencrag Highlands yfirheimskort við Giant's Span Bridge `[35, 15]`.
- `10-ravencrag-citadel-scene.png` — Major Landmark Scene við Ravencrag Citadel `[37, 3]` með **Confront the Highland Warlord**.
- `11-expanded-region-map.png` — Stækkað `44×30` Region Map `[M]` sem sýnir öll þrjú landsvæðin (`Goblin Forest`, `Undead Lands`, `Ravencrag Highlands`).
