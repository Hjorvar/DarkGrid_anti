# DARKGRID — PHASE 10: Framleiðsluundirbúningur, Öryggi, Kostnaðarmat og Útgáfustaða

**Dagsetning:** 24. október 2026  
**Verkefni:** Phase 10B, 10C & 10D — Production Readiness, Public Playtest Security, Durable Persistence & Deployment Status

---

## 1. Hýsingararkitektúr (Hosting & Persistence Architecture)

Til að tryggja að **DarkGrid** keyri með sannri server-side sannleiksvél (authoritative d20 combat, faldar skrímslatölur, permadeath og line-of-sight Fog of War) án þess að treysta á ótraustan client-kóða eða hverfult (ephemeral) skráakerfi, er framleiðsluuppsetningin byggð á þremur lögum innan staðfesta Firebase-verkefnisins **`darkgrid-rpg`**:

1. **Firebase Hosting (Global CDN fyrir kyrrstæðar skrár):**
   - Þjónustar allar myndir (`/images/*`, `/lab-assets/images/*`), hljóð, CSS og JS beint af CDN án þess að vekja bakenda-gáminn að óþörfu.
   - Beinir öllum síðu- og API-beiðnum (`/`, `/api/*`, `/healthz`) í gegnum `firebase.json` rewrite yfir á Cloud Run þjónustuna `darkgrid-api` í `europe-west1`.
2. **Google Cloud Run (`darkgrid-api`, `europe-west1`, Node.js 22 + `node:sqlite`):**
   - Keyrir [`Dockerfile`](../../Dockerfile) sem ræsir `node src/server.js`.
   - Stillt með `minScale: 0` (scale-to-zero þegar enginn er að spila) og `maxScale: 1` (single-writer arkitektúr fyrir SQLite og minnisskyndiminni).
3. **Varanleg gagnageymsla (SQLite + Durable Snapshot + Firestore Delta Sync):**
   - Í [`src/db/durable-store.js`](../../src/db/durable-store.js) var varanlega afritunar- og samstillingarvélin uppfærð fyrir Phase 9C/10 þannig að hún varðveitir:
     - Allar nýjar dálkabreytingar á `characters` (`active_dungeon_key`, `dungeon_x`, `dungeon_y`, `goblin_cave_discovered`, `ancient_crypt_discovered`, `ravencrag_citadel_discovered`, `quest_ancient_crypt_status`, `quest_ravencrag_warlord_status`, o.fl.).
     - Allar uppgötvanatöflur yfirheims og dýflissa:
       - `character_discovered_tiles`
       - `character_dungeon_discovered_tiles`
       - `character_dungeon_events`
       - `character_monster_knowledge`
       - `character_quests`
       - ásamt `users`, `sessions`, `characters`, `character_items`, `encounters`, `combat_Round_events`, `monster_instances`, `bounties` og `shop_resale_items`.
   - Eftir hverja gildandi `POST` aðgerð (`/api/action`, `/api/auth/*`, `/api/characters`) og við `SIGINT`/`SIGTERM` lokun eru breytingar vistaðar í varanlegt snapshot (`DURABLE_SNAPSHOT_PATH`) og sendar sem breytingapakki (delta) í Firestore (`darkgrid_meta/dynamic_state` og `darkgrid_tables/*`). Við endurræsingu gámsins endurheimtir `src/server.js` sjálfkrafa allt ástandið áður en fyrsta beiðni er afgreidd.

---

## 2. Öryggi fyrir opinberar spilunarprófanir (Public Playtest Security)

Í Phase 10C var öryggi aðalleiksins hert og sannreynt með sjálfvirkum prófunum ([`tests/phase10_main_game_and_security.test.js`](../../tests/phase10_main_game_and_security.test.js)):

- **Auðkenning og aðskilnaður aðganga:**
  - Í framleiðsluham (`NODE_ENV=production`) er nafnlausum sandbox-aðgangi hafnað (`401 Authentication required`).
  - Hver leikmaður hefur sinn eigin `users` reikning, dulkóðað lykilorð (`bcryptjs`), `HttpOnly` + `SameSite=Lax` + `Secure` lotuköku (`__session`) í SQLite og einangraða hetju.
- **Læsing á Lab/Debug verkfærum í framleiðslu (`403 Forbidden`):**
  - Venjulegir leikmenn fá `labToolsAllowed: false` í `/api/state`.
  - Allar tilraunir til að kalla á `TELEPORT_TO_TILE`, `LAB_SCENARIO`, `SPAWN_ENCOUNTER`, `FORCE_AMBUSH`, `SET_CANDIDATE_ART` eða senda `{ testForceEncounter: true }` / `{ testForceAmbush: true }` í `MOVE` skila **`403 Forbidden`**.
  - `/api/legacy-audit` skilar einnig `403 Forbidden` fyrir almenna notendur.
- **Anti-Tamper vörn (`400 Bad Request`):**
  - Ef client reynir að senda bannaða server-reiti í `POST /api/action` (t.d. `gold`, `current_hp`, `max_hp`, `xp`, `level`, `damage`, `is_alive`, `user_id`, `character_id`) hafnar `labAntiTamperMiddleware` beiðninni samstundis með `400 Bad Request`.
- **Vörn gegn hoppi í gegnum veggi og ólöglegum hnitum:**
  - Bæði í 44×30 yfirheiminum og í báðum dýflissunum (`GOBLIN_CAVE` og `ANCIENT_CRYPT`) reiknar þjónninn `dx`/`dy` út frá stefnu (`NORTH`, `SOUTH`, `EAST`, `WEST`) og sannreynir `is_passable === 1` á servernum. Enginn client getur sent handahófskennd hnit til að hoppa yfir veggi.
- **Rate-Limiting og Budget Kill-Switch:**
  - `gameRateLimiter` verndar API gegn DoS-umferð (`429 Too Many Requests`), og `/internal/budget-killswitch` ásamt `maintenanceModeGuard` vernda verkefnið gegn óvæntum skýjakostnaði.

---

## 3. Áætlaður mánaðarkostnaður (Estimated Monthly Cost)

Hönnunin er sérstaklega sniðin til að haldast **ókeypis ($0.00 / mánuði)** eða innan nokkurra senta við venjulegar spilunarprófanir:

| Þjónusta | Frítt þrep (Monthly Free Tier) | Áætluð notkun í Playtest (10–50 leikmenn) | Áætlaður mánaðarkostnaður |
| :--- | :--- | :--- | :--- |
| **Firebase Hosting** | 10 GB geymsla + 360 MB/dag (~10.8 GB/mán) | ~95 MB geymsla, ~1–3 GB umferð/mán | **$0.00** |
| **Cloud Run (`darkgrid-api`)** | 2.000.000 beiðnir, 180.000 vCPU-sek, 360.000 GiB-sek á mánuði | `minScale: 0` (sefur þegar enginn spilar), ~20.000–100.000 API-köll/mán | **$0.00** |
| **Cloud Firestore (Delta Sync)** | 50.000 lesanir/dag, 20.000 skrif/dag, 1 GiB geymsla | Aðeins breyttar raðir skrifaðar (delta sync), ~500–3.000 skrif/dag | **$0.00** |
| **Artifact Registry & Cloud Build** | 0.5 GB geymsla + 120 byggingarmínútur/dag | 1 Docker ílát (~180 MB) | **$0.00 – $0.05** |
| **Samtals áætlaður kostnaður** | — | — | **~$0.00 / mánuði** |

**Hvers vegna helst uppsetningin ókeypis / afar ódýr?**
1. **Static CDN offload:** Allar þungar skrár (webp/png myndir og hljóð) eru afgreiddar beint af Firebase Hosting CDN án þess að kalla á Cloud Run.
2. **Scale-to-zero (`minScale: 0`):** Cloud Run gámurinn notar 0 CPU-sekúndur þegar enginn leikmaður er virkur.
3. **In-memory/Local SQLite + Delta Sync:** Allir lesfyrirspurnir (`/api/state`, hreyfing, bardagar) lesa úr staðbundnum SQLite gagnagrunni í minni/diski gámsins (0 Firestore leskostnaður í hverju skrefi), og aðeins breyttar raðir eru vistaðar í Firestore í bakgrunni.

---

## 4. Staðfesting á Firebase-verkefni og útgáfustaða (Phase 10D)

Samkvæmt fyrirmælum í Phase 10D var framkvæmd full for-útgáfuskoðun á staðfesta Firebase-verkefninu **`darkgrid-rpg`**:

1. **Bygging kyrrstæðra skráa (`npm run build:firebase`):**
   - Keyrt með góðum árangri (`dist/` mappa útbúin með öllum uppfærðum Phase 9C/10 framendaskrám og myndum).
2. **Afritun núverandi framleiðslugagna (`npm run deploy:blaze` — Skref 1):**
   - Fullt afrit tekið af Firestore í `db/backups/production-backup-latest.json` (`SHA-256: 7ef8e610c22971f33cbfbb91bcb4979541118af2d29587a8948dc61b710a0cc9`).
3. **Athugun á Cloud Billing stöðu (`npm run deploy:blaze` — Skref 3):**
   - Google Cloud Billing API fyrir `projects/darkgrid-rpg` skilaði:
     ```text
     [NOTICE] Project `darkgrid-rpg` currently has `billingEnabled: false` (Spark Plan).
              Cloud Run container deployment requires the project owner to upgrade to Blaze.
     ```
4. **Ákvörðun í samræmi við reglur Phase 10B/10D:**
   - Reglur verkefnisins kveða skýrt á um:
     - *„Firebase Hosting eitt og sér má ekki aðeins birta static frontend sem síðan vantar virka API þjónustu.“*
     - *„Ef viðeigandi aðgangur eða nauðsynleg hýsing vantar, stöðva deployment án þess að segjast hafa birt leikinn.“*
     - *„Aldrei stofna nýja greidda skýjaþjónustu án samþykkis eiganda.“*
   - Þar sem `darkgrid-rpg` er enn á **Spark Plan (`billingEnabled: false`)** leyfir Google Cloud ekki stofnun Cloud Run þjónustunnar `darkgrid-api` fyrr en eigandi virkjar Blaze Plan á `darkgrid-rpg`. Útgáfuferlið stöðvaði því sjálfkrafa á öruggan hátt án þess að yfirskrifa núverandi vefslóð (`https://darkgrid-rpg.web.app`) með óvirkum static framenda.
   - Um leið og eigandi virkjar Blaze Plan á `darkgrid-rpg` er hægt að keyra eina skipun úr rót:
     ```bash
     npm run deploy:blaze && npx firebase-tools deploy --only hosting,firestore:rules --project darkgrid-rpg
     ```
     sem byggir og ræsir `darkgrid-api` á Cloud Run, samstillir gagnagrunninn og birtir nýja aðalleikinn á `https://darkgrid-rpg.web.app`.
