# DARKGRID — PHASE 9C + PHASE 10: Lokaskýrsla (Final Summary)

**Dagsetning:** 24. október 2026  
**Grein (Branch):** `darkgrid_phase_9c_10`

---

## 1. Hvað var innleitt í Phase 9C og Phase 10

### Phase 9C — Stórar dýflissur, Line-of-Sight Fog of War og Þriðja Yfirheimssvæðið
1. **Endurnýtanleg dýflissuvél (`action-ui-lab/server/services/dungeon-service.js`):**
   - Fullt top-down grid-hreyfikerfi inni í dýflissum með herbergjum, göngum, hliðargöngum, blindgötum, föstum viðburðareitum (fjársjóðum, helgiskrínum og föstum bardögum) og boss-sölum.
   - **Raunverulegt Line-of-Sight (LoS) og þröngt Fog of War:** Notar supercover Bresenham geislaleit með 90° hornalokun. Venjulegar hetjur (Fighter/Cleric) sjá aðeins **2 reiti** (`visionRadius = 2`) og Ranger sér **3 reiti** (`visionRadius = 3`), stranglega takmarkað af veggjum og hornum.
   - **Þrjú sýnileikastig:** `UNEXPLORED` (alveg svart og 0 upplýsingaleki í API), `EXPLORED_MEMORY` (dimmt minni yfir áður uppgötvaða reiti) og `VISIBLE` (núverandi sjónsvið).
   - **Varanleg gagnageymsla í SQLite:** Uppgötvaðir reitir (`character_dungeon_discovered_tiles`) og kláraðir viðburðir/bossar (`character_dungeon_events`) vistast á hverja hetju og haldast eftir endurræsingu.
2. **Goblin Cave (`GOBLIN_CAVE`) — undir Whispering Crags `[9, 12]`:**
   - Breytt úr eins-bardaga kennileiti í stórt neðanjarðarkerfi með kvíslaleiðum (vestur-sveppagöngum og austur-varðgöngum), valfrjálsum fjársjóðsherbergjum og föstum boss (**Skulkrip the Cave Brood-King** á `[16, 2]`).
   - Aðgerðin **Delve into the Cave Mouth** (`ENTER_DUNGEON` / `DELVE_GOBLIN_CAVE`) flytur hetjuna inn á inngangsreit hellisins `[3, 16]`.
3. **Ancient Crypt (`ANCIENT_CRYPT`) — í Necropolis Sanctum `[26, 5]`:**
   - Sjálfstætt dýflissukort með steingröfum, grafhvelfingum, vestur- og austurgöngum, helgiskrínum og innri hásætissal með föstum Undead boss (**Lord Malakor the Barrow-Wight King** á `[10, 2]`).
   - Tengt við nýtt Oakhaven-verkefni: **`THE_ANCIENT_CRYPT` ("The Sanctum of Bone and Ash")** (`+120 GP`, `+150 XP`). Cleric nýtur fullrar Undead-sérhæfingar sinnar (*Smite*, *Holy Radiance*, *Turn Undead*).
4. **Þriðja yfirheimssvæðið — Ravencrag Highlands (`RAVENCRAG_HIGHLANDS`):**
   - Stækkar yfirheiminn úr `30×30` í **`44×30`** með 4 náttúrulegum fjallaskörðum (`[29, 25]`, `[29, 23]`, `[29, 15]`, `[29, 9]`), 3 undirsvæðum (*Windscar Foothills*, *Shattered Gorge*, *Stormpeak Crags*), 3 danger-zone prófílum í SQLite (`HIGHLAND_FOOTHILL_ROAD`, `HIGHLAND_SHATTERED_GORGE`, `STORMPEAK_CITADEL_APPROACH`), 6 minni kennileitum, Major Landmark virkinu **Ravencrag Citadel `[37, 3]`** með föstum boss (**Warlord Kraug the Crag-Breaker**) og Oakhaven-verkefninu **`THE_RAVENCRAG_WARLORD`**.
   - **Region Map (`[M]`):** Uppfært til að sýna öll þrjú landsvæðin samtímis með hreinni heiltölu-pixlateikningu (`image-rendering: pixelated`) og engum upplýsingaleka um ókönnuð kennileiti.

### Phase 10 — Nýi leikurinn gerður að aðalleik, Legacy varðveittur og Framleiðsluundirbúningur
1. **Endurskipulagning repository (`Phase 10A`):**
   - Eldri EJS/SSR leikurinn fluttur í `legacy-game/` (`npm run start:legacy`, `npm run test:legacy`).
   - Nýi leikurinn gerður að aðalleik í rót (`index.js`, `src/app.js`, `src/server.js`, `npm start`, `npm test`).
2. **Framleiðsluundirbúningur og öryggi (`Phase 10B & 10C`):**
   - Uppfærð varanleg gagnageymsla (`src/db/durable-store.js`) sem vistar og endurheimtir öll yfirheims- og dýflissugögn, reikninga og lotur yfir endurræsingar.
   - Öll Lab/debug-verkfæri (`TELEPORT_TO_TILE`, `LAB_SCENARIO`, `SPAWN_ENCOUNTER`, `FORCE_AMBUSH`, `testForceEncounter`, `testForceAmbush`) læst með `403 Forbidden` fyrir almenna spilara í framleiðsluham, og Anti-Tamper vörn (`400 Bad Request`) virk á öllum `POST` köllum.

---

## 2. Stærð beggja dýflissa og nýja landsvæðisins

| Svæði / Dýflissa | Stærð (Grid) | Heildarfjöldi reita | Gangfærir reitir (`is_passable = 1`) | Hlutfall af Goblin Forest (711 reitir) | Fastur Boss |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Goblin Cave (`GOBLIN_CAVE`)** | `20 × 18` | **360 reitir** | 135 reitir | **50.6%** | **Skulkrip the Cave Brood-King** (`[16, 2]`) |
| **Ancient Crypt (`ANCIENT_CRYPT`)** | `20 × 19` | **380 reitir** | 175 reitir | **53.4%** | **Lord Malakor the Barrow-Wight King** (`[10, 2]`) |
| **Ravencrag Highlands (`RAVENCRAG_HIGHLANDS`)** | `14 × 30` (`x=30..43, y=0..29`) | **420 reitir** | 95 reitir | Nýtt 3ja yfirheimssvæði | **Warlord Kraug the Crag-Breaker** (`[37, 3]`) |
| **Heildaryfirheimur (3 landsvæði)** | `44 × 30` (`x=0..43, y=0..29`) | **1.320 reitir** | 296 reitir | Goblin Forest (711) + Undead Lands (189) + Ravencrag Highlands (420) | 3 yfirheims-bossar + 2 dýflissu-bossar |

---

## 3. Niðurstöður prófana

Allar sjálfvirkar prófanir keyra án nokkurra villna:

1. **Aðalleikur og sameiginleg lénsrökfræði (`npm test`):**
   - **196 af 196 prófum standast** (`23` prófasöfn, `0` villur).
   - Þar á meðal:
     - `action-ui-lab/tests/phase9c-dungeons-and-highlands.test.js`: **7/7** próf (stærð og tenging beggja dýflissa, LoS og Fog of War, boss-bardagar, Ravencrag Highlands, verkefni og Region Map).
     - `tests/phase10_main_game_and_security.test.js`: **3/3** próf (ræsing úr rót og `legacy-game`, multi-user einangrun, `403` á debug-verkfæri, `400` á client-tampering, og varanleg endurheimt dýflissu- og yfirheimsgagna eftir endurræsingu).
     - `action-ui-lab/tests/phase9b-world-expansion.test.js`: **7/7** próf.
     - `action-ui-lab/tests/phase8-world-and-systems.test.js`: **7/7** próf.
     - `action-ui-lab/tests/phase-6-1-hardening.test.js` og `phase-6-legacy-integration.test.js`: **18/18** próf.
2. **Varðveittur Legacy-leikur (`npm run test:legacy`):**
   - **95 af 95 prófum standast** (`0` villur).
3. **Sjónræn QA (Headless Chrome):**
   - **11 af 11 skjámyndum** teknar í 1440×900 upplausn með `0` console-villum og `0` network-villum (vistaðar í `docs/phase-9c/screenshots/`).

---

## 4. Ný möppuskipan verkefnisins

- `index.js`, `src/app.js`, `src/server.js` — Ræsa nýja aðalleikinn sjálfgefið úr rót (`npm start`, `npm run dev`).
- `action-ui-lab/` — Server-controllers, dýflissu- og yfirheimsþjónustur, framendaviðmót og myndir aðalleiksins.
- `legacy-game/` — Varðveittur upprunalegur EJS/SSR leikur (`legacy-game/app.js`, `legacy-game/server.js`, `legacy-game/routes/`, `legacy-game/views/`, `legacy-game/tests/`).
- `src/domain/`, `src/db/`, `src/middleware/`, `db/` — Sameiginleg d20 lénsrökfræði, SQLite migrations/seeds og varanleg gagnageymsla (`durable-store.js`).
- `docs/phase-9c/` og `docs/phase-10/` — Allar skýrslur og skjámyndir á íslensku.

---

## 5. Hýsingararkitektúr og áætlaður mánaðarkostnaður

- **Hýsing:** Firebase Hosting CDN (fyrir myndir, hljóð, CSS/JS úr `dist/`) + Google Cloud Run (`darkgrid-api` í `europe-west1`, `minScale: 0`, `maxScale: 1`) + SQLite með varanlegu snapshot-skráakerfi og Firestore server-side delta-samstillingu (`src/db/durable-store.js`).
- **Áætlaður mánaðarkostnaður:** **~$0.00 / mánuði** (innan frírra marka Firebase Hosting, Cloud Run scale-to-zero og Firestore delta-skrifa fyrir playtest-umferð).

---

## 6. Staða útgáfu og vefslóðar (`darkgrid-rpg`)

- Staðfest Firebase-verkefni: **`darkgrid-rpg`** (`https://darkgrid-rpg.web.app`).
- For-útgáfuafrit tekið og sannreynt (`db/backups/production-backup-latest.json`, `SHA-256: 7ef8e610c22971f33cbfbb91bcb4979541118af2d29587a8948dc61b710a0cc9`) og `dist/` byggt (`npm run build:firebase`).
- Við keyrslu á `npm run deploy:blaze` skilaði Google Cloud Billing API að `darkgrid-rpg` er núna með **`billingEnabled: false` (Spark Plan)**.
- Í samræmi við strangar reglur verkefnisins (*„Firebase Hosting eitt og sér má ekki aðeins birta static frontend sem síðan vantar virka API þjónustu“* og *„Ef viðeigandi aðgangur eða nauðsynleg hýsing vantar, stöðva deployment án þess að segjast hafa birt leikinn“*) var útgáfuferlið stöðvað á öruggan hátt áður en `https://darkgrid-rpg.web.app` var yfirskrifað án virks Cloud Run bakenda.
- Um leið og eigandi virkjar Blaze Plan á `darkgrid-rpg` virkjast full Cloud Run + Hosting útgáfa með einni skipun:
  ```bash
  npm run deploy:blaze && npx firebase-tools deploy --only hosting,firestore:rules --project darkgrid-rpg
  ```
