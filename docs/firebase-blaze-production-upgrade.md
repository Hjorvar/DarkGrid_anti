# Darkgrid RPG — Firebase Blaze Production Upgrade, Secure Backend & Database

**Dagsetning:** 15. október 2026  
**Firebase Project:** `darkgrid-rpg` (`https://darkgrid-rpg.web.app`)  
**GitHub Repository:** `https://github.com/Hjorvar/DarkGrid_anti`

---

## 1. Yfirlit og nýr arkitektúr

Darkgrid hefur verið uppfært úr viðkvæmri vaframiðaðri arkitektúrslausn (þar sem vafrinn keyrði SQLite í minni með `sql.js` og skrifaði beint í Firestore) yfir í **miðlægan, server-authoritative leikjaþjón** (`Node.js` + `Express 5`) með varanlegri tvíþættri gagnavistun, einingarlæsingum (atomic compare-and-swap), gagnagrunns-triggerum og ströngum öryggisvörnum.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             VAFRI (Browser UI)                             │
│  • Sendir eingöngu aðgerðabeiðnir (t.d. move, attack, buy, accept bounty) │
│  • Hefur ENGAN aðgang að teningaköstum, HP/XP/Gold-breytingum eða reglum  │
│  • Krefst gilt Session Cookie + CSRF Token + Idempotency Key               │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │ HTTPS (Firebase Hosting Rewrite)
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                 MIÐLÆGUR LEIKJAÞJÓNN (Cloud Run / Express)                 │
│  1. Security Headers + Rate Limiter + Maintenance Mode Guard               │
│  2. Persistent Session Middleware (SqliteSessionStore í user_sessions)     │
│  3. Anti-Tamper Middleware (hafnar HTTP 400 ef gold/hp/xp/uid er í body)   │
│  4. CSRF Validation + Action Idempotency Middleware (Próf 7 vörn)          │
│  5. Domain Engine (Combat, Encounters, Bounties, Market, Permadeath)       │
└──────────────────┬──────────────────────────────────────┬──────────────────┘
                   │                                      │
                   ▼                                      ▼
┌─────────────────────────────────────┐  ┌───────────────────────────────────┐
│   SQLite (Transactional Engine)     │  │ Cloud Firestore (/server_state/*) │
│  • WAL mode + IMMEDIATE transactions│  │  • Differential `:commit`         │
│  • Monotonic BEFORE UPDATE triggers │  │    write-through eftir breytingar │
│  • Atomic Compare-and-Swap (`CAS`)  │  │  • Sjálfvirk endurheimt við       │
│  • Local atomic JSON checkpoints    │  │    cold-start / endurræsingu      │
└─────────────────────────────────────┘  └───────────────────────────────────┘
```

### Helstu breytingar í nýja arkitektúrnum:
1. **Miðlægur leikjaþjónn (`src/app.js`, `src/server.js`):** Öll leikjarökfræði (hetjustofnun, hreyfing, skrímslafundir, frumkvæði, teningaköst, skaði, sérhæfileikar skrímsla, XP, loot, birgðir, búnaður, gull, markaður, bounties, permadeath og persistent monsters) keyrir á netþjóninum.
2. **Vafrinn tekur engar ákvarðanir:** Vafrinn sendir aðeins ósk um aðgerð (t.d. `POST /game/combat/attack` með `encounterId` og `round`). Ef vafrinn reynir að senda reiti á borð við `gold`, `current_hp`, `max_hp`, `xp`, `level`, `damage`, `is_alive`, `loot`, `uid` eða `user_id` í request body eða query-streng, grípur `antiTamperProtection` (`src/middleware/security.js`) beiðnina strax, skráir öryggisatvik í `logger.js` og hafnar henni með **HTTP 400 Bad Request**.
3. **Varanleg lotuvistun (`src/db/session-store.js`):** Í stað `MemoryStore` í `express-session` (sem týndi innskráningum við hverja endurræsingu) eru lotur vistaðar í `user_sessions` töflunni og afritaðar í varanlega geymslu.

---

## 2. Val á gagnagrunnslausn og samanburður

Í samræmi við kröfur verkefnisins voru þrír valkostir bornir saman:

| Valkostur | Kostir | Gallar / Áhættur | Mánaðarkostnaður (áætlun) |
| :--- | :--- | :--- | :--- |
| **A. SQLite með varanlegri tvíþættri vistun (Valin lausn)** *(SQLite í WAL-ham + Atomic Local Checkpoints + Differential Firestore Write-Through)* | • Heldur 100% af núverandi `node:sqlite` vensla- og transaction-rökfræði óbreyttri.<br>• `BEGIN IMMEDIATE` og SQLite triggers tryggja fullkomna gagnasamkvæmni (ACID).<br>• Engin hætta á skráarskemmdum eins og með GCS FUSE.<br>• Sjálfvirk endurheimt við container-endurræsingu úr `/server_state/**` í Firestore. | • Krefst `maxInstances: 1` á Cloud Run svo einn container sé jafnan ríkjandi skrifari (single-writer). | **~0 – 50 ISK / mán.** |
| **B. Hreinn Cloud Firestore sem eini gagnagrunnur** *(Endurskrifa allar SQL-fyrirspurnir í NoSQL)* | • Innbyggð dreifð vistun hjá Google. | • Krefst endurskrifunar á ~45 SQL-skrám og flóknum JOIN-fyrirspurnum.<br>• Dýrari les- og skrifaðgerðir ef hver bardagalota krefst margra skjalalestra. | **~100 – 500 ISK / mán.** |
| **C. Cloud SQL (PostgreSQL) eða Turso / Managed DB** | • Hefðbundinn miðlægur SQL-þjónn. | • Cloud SQL kostar a.m.k. ~1.500–5.000+ ISK/mán. jafnvel í minnstu útgáfu.<br>• Turso bætir við utanaðkomandi þjónustuaðila utan Firebase. | **~1.500 – 5.500 ISK / mán.** |

### Rökstuðningur fyrir valinni lausn (Valkostur A):
- **Engin notkun á óöruggu `/tmp` einu og sér eða GCS FUSE:** Lifandi SQLite-gagnagrunnur á Cloud Storage FUSE getur valdið skráarlæsingarvillum (`SQLITE_BUSY` / `SQLITE_CORRUPT`) vegna þess að POSIX byte-range læsingar eru ekki studdar í FUSE.
- **Hvernig varanleiki (durability) er tryggður (`src/db/durable-store.js`):**
  1. Allar breytingar fara í gegnum SQLite `BEGIN IMMEDIATE` transactions með `WAL` (`journal_mode = WAL`) og `foreign_keys = ON`.
  2. Eftir hverja breytingu (`POST`) reiknar `durable-store.js` SHA-256 mismun (diff) á breyttum röðum í öllum 11 kvikum töflum (`users`, `characters`, `monster_instances`, `item_instances`, `market_listings`, `hunting_contracts`, `encounters`, `combat_events`, `user_sessions`, `action_idempotency_log`, `world_sync_meta`).
  3. Aðeins breyttar raðir eru vistaðar atómískt í einu lagi með Firestore REST `:commit` batch-kalli undir `/server_state/{table}/rows/{id}` (sem vafrar hafa engan les- né skrifaðgang að) ásamt atómískri JSON-checkpoint skrá á diski (`saveSnapshotToFile`).
  4. Við ræsingu (`server.js`) og við `SIGTERM`/`SIGINT` lokun (graceful shutdown á Cloud Run) les og vistar netþjónninn sjálfkrafa nýjustu stöðu svo **engin gögn glatast við uppfærslur, cold-start eða endurræsingar**.
  5. `referenceMap` í `durable-store.js` varpar erlendum lyklum (`monster_id` eftir nafni, `tile_id` eftir `(x, y)` hnitum, `item_definition_id` eftir nafni) þannig að gögn raskast aldrei þótt ID í grunn-seed töflum breytist.

---

## 3. Firebase- og Google Cloud-þjónustur sem eru notaðar

Í Firebase-verkefninu `darkgrid-rpg` eru eftirfarandi þjónustur nýttar:
1. **Firebase Hosting:** Þjónustar vefslóðina `https://darkgrid-rpg.web.app` (og `https://darkgrid-rpg.firebaseapp.com`), statískar myndir (`/images/**`, `/css/**`) og beinir öllum leikjabeiðnum á bakendann.
2. **Firebase Authentication:** Heldur utan um notendaaðganga og auðkenningu. Nýja `src/firebase/token-verifier.js` sannreynir RS256 JWT ID-tóka gegn opinberum X.509 lyklum Google og `src/domain/auth/service.js` brúar eldri Firebase Auth notendur sjálfkrafa yfir í staðbundið `bcrypt` við fyrstu innskráningu.
3. **Cloud Firestore:** Nýtt sem örugg, atómísk afritunar- og endurheimtargeymsla (`/server_state/**`) fyrir miðlæga SQLite-grunninn, varin með uppfærðum `firestore.rules`.
4. **Cloud Run / Firebase App Hosting (`Dockerfile`, `apphosting.yaml`):** Keyrir Node.js 22 Express-leikjaþjóninn í einangruðum container (`minInstances: 0`, `maxInstances: 1`, `cpu: 1`, `memoryMiB: 512`, `concurrency: 80`).
5. **Cloud Logging (`src/utils/logger.js`):** Skipulögð JSON-atburða- og öryggisskráning með **7 daga varðveislutíma (retention)** sem hefur þegar verið virkjaður á `darkgrid-rpg` til að koma í veg fyrir geymslukostnað.
6. **Cloud Secret Manager (`apphosting.yaml`):** Geymir `SESSION_SECRET` utan kóðagrunnsins.

---

## 4. Kostnaðaráætlun, fjárhagsrammi og kostnaðarvarnir

### Kostnaðaráætlun við núverandi notkun (fáir vinir í prófunum):
| Þjónusta | Frítt magn á mánuði (Blaze Free Tier) | Áætluð notkun Darkgrid | Áætlaður kostnaður |
| :--- | :--- | :--- | :--- |
| **Cloud Run** | 2 milljón beiðnir, 180.000 vCPU-sek, 360.000 GiB-sek | < 50.000 beiðnir / mán. (`minInstances: 0`) | **0 ISK** |
| **Cloud Firestore** | 50.000 les / dag, 20.000 skrif / dag, 1 GiB geymsla | < 2.000 skrif / dag (differential sync) | **0 ISK** |
| **Firebase Hosting** | 10 GB geymsla, 360 MB / dag flutningur | ~45 MB myndir + HTML | **0 ISK** |
| **Firebase Auth** | 50.000 MAU (Email/Password) | < 20 notendur | **0 ISK** |
| **Cloud Logging** | 50 GiB / mán. frítt, 7 daga retention | < 0.05 GiB / mán. | **0 ISK** |
| **Container Registry / Artifact Registry** | 0.5 GB frítt | ~150 MB Alpine image (ef hreinsað) | **0 – 30 ISK** |
| **Samtals áætlaður kostnaður** | | | **~0 – 50 ISK / mán.** *(vel undir 5.000 ISK viðmiði)* |

### Innbyggðar kostnaðarvarnir í kóða og innviðum:
1. **Harðar takmarkanir á Cloud Run (`apphosting.yaml` og `scripts/deploy_blaze.js`):**
   - `minInstances: 0` (fer niður í 0 þegar enginn er að spila — enginn biðkostnaður).
   - `maxInstances: 1` (kemur í veg fyrir óvænta fjölgun containera).
   - `cpu: 1` og `memoryMiB: 512`.
2. **Rate Limiting (`src/middleware/security.js`):**
   - Innskráningar/nýskráningar: hámark **20 beiðnir á mínútu** á hverja IP-tölu.
   - Leikjaaðgerðir (`POST`): hámark **60 aðgerðir á mínútu** á hvern notanda/IP.
   - Almenn vefumferð: hámark **180 beiðnir á mínútu**.
3. **Differential Firestore Write-Through (`src/db/durable-store.js`):**
   - Í stað þess að skrifa allan gagnagrunninn í hvert sinn eru aðeins þær raðir sem breyttust í viðkomandi HTTP-beiðni sendar í einu `:commit` kalli.
   - `/healthz` endapunkturinn svarar án nokkurra gagnagrunns- eða Firestore-aðgerða.
4. **Cloud Logging 7-daga eyðing (`_Default` bucket):**
   - Sett á **7 daga** (sjálfgefið er 30 dagar) með `scripts/deploy_blaze.js` (staðfest virkt á `darkgrid-rpg`).
5. **Monthly Billing Budget & Viðvaranir (`scripts/deploy_blaze.js`):**
   - Sjálfvirk uppsetning á mánaðarlegu fjárhagsþaki (25 USD ≈ 3.500 ISK, vel undir 5.000 ISK) með tölvupóstviðvörunum við **25%, 50%, 75%, 90% og 100%** um leið og greiðslureikningur er tengdur.

> **Mikilvæg athugasemd um Budget Alerts vs. Hard Spend Caps:**  
> Í Google Cloud / Firebase Blaze senda **Budget Alerts** tölvupóstviðvaranir þegar kostnaður nær 25%, 50%, 75%, 90% og 100%, en þær **slökkva ekki sjálfkrafa á þjónustum** nema sett sé upp Cloud Billing Budget Pub/Sub + Cloud Function sem aftengir billing eða lækkar kvóta. Eftirfarandi þjónustur geta tæknilega myndað kostnað umfram viðvörunarmörk ef umferð yrði gríðarleg:
> - **Cloud Run & Firebase Hosting bandvídd (egress):** Varin með `maxInstances: 1` og ströngu Rate Limiting í `src/middleware/security.js`.
> - **Cloud Firestore les/skrif:** Varin með `firestore.rules` (sem loka á beinan skrifaðgang vafra þegar `server_authoritative == true`) og differential write-through.
> - **Artifact Registry geymsla:** Varin með léttri `node:22-alpine` Docker-mynd.

---

## 5. Öryggisbreytingar

1. **Anti-Tamper vörn (`src/middleware/security.js`):**
   - Hafnar samstundis öllum HTTP-beiðnum sem innihalda bannaða reiti frá vafra (`hp`, `current_hp`, `max_hp`, `xp`, `level`, `gold`, `held_gold`, `damage`, `attack_bonus`, `armor_class`, `is_alive`, `loot`, `reward_gold`, `boosted_max_hp`, `uid`, `user_id`, `character_id`, `owner_character_id` o.fl.) með **HTTP 400** og skráir `SECURITY_TAMPER_ATTEMPT`.
2. **Auðkenning og eignarhaldsstaðfesting (`src/middleware/auth.js`, `src/routes/game.routes.js`):**
   - Engu UID eða `character_id` úr request body er treyst. Netþjónninn sækir virka persónu eingöngu út frá staðfestu `req.session.userId` (`getActiveCharacter(req.db, req.session.userId)`).
   - Í öllum bardaga-, verslunar-, birgða- og bounty-aðgerðum er staðfest að `encounter.character_id === character.id` og `item.owner_character_id === character.id`.
3. **CSRF-vörn (`src/middleware/csrf.js`):**
   - Allar `POST`-beiðnir krefjast gilds `_csrf` tóka sem er bundinn við lotu notandans.
4. **Uppfærðar Firestore Security Rules (`firestore.rules`):**
   - **1.000-expression villan löguð:** Reglurnar voru einfaldaðar og fínstilltar þannig að `firebaserules.googleapis.com/v1/projects/darkgrid-rpg:test` keyrir öll próf með **0 villum** (staðfest og sett í loftið á `darkgrid-rpg`).
   - **Monotonic State reglur:** Banna afturvirkni á dauðum persónum (`is_alive: 0 -> 1`), sigruðum persistent monsters (`DEFEATED -> ACTIVE`), seldum markaðsvörum (`SOLD -> ACTIVE`) og kláruðum bounties (`COMPLETED -> ACTIVE`).
   - **Server-Authoritative Lockout:** `/server_state/{document=**}` er alfarið lokað fyrir vafra (`allow read, write: if false;`), og `isClientWriteAllowed()` lokar á öll skrif vafra í leikjasöfn um leið og `/world_state/config.server_authoritative == true`.

---

## 6. Gagnavandamál sem voru löguð (A–E + Próf 7)

### A. Last-Write-Wins vandamálið
- **Rotin orsök:** Eldri `spark-client.js` skrifaði yfir skjöl í Firestore án þess að athuga hvort annað eintak hefði þegar uppfært stöðuna, og endurhlaðinn vafri gat skrifað eldri stöðu yfir nýrri stöðu.
- **Lausn:** Allar breytingar fara í gegnum SQLite `BEGIN IMMEDIATE` transactions, monotonic triggers (`db/migrations/013_production_blaze_hardening.sql`) og monotonic merge-reglur í `src/db/durable-store.js` (t.d. `Math.max` á `level`/`xp`, og óafturkræf lokastaða á `is_alive = 0`, `DEFEATED`, `SOLD`, `COMPLETED`).

### B. Persistent Monsters (Varanleg skrímsli)
- **Rotin orsök:** Tveir spilarar gátu barist við sama persistent monster samtímis og fengið verðlaun tvisvar, eða eldri biðminnisstaða gat endurlífgað skrímslið (`status = 'ACTIVE'`).
- **Lausn:**
  - Í `src/domain/monsters/persistence.js` (`handleMonsterDefeat`) er notað atómískt Compare-And-Swap:
    ```sql
    UPDATE monster_instances
    SET status = 'DEFEATED', current_hp = 0, held_gold = 0, defeated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'ACTIVE'
    ```
  - Ef `updateResult.changes === 0` hefur annar spilari þegar fellt skrímslið; seinni spilarinn fær **0 gull, 0 XP og 0 hluti** (`resolvedByOther: true`).
  - SQLite triggerinn `enforce_defeated_monster_irreversible` kastar `ABORT` ef nokkur kóði reynir að breyta `status` úr `'DEFEATED'` í `'ACTIVE'`.

### C. Market (Samtímis kaup á markaði)
- **Rotin orsök:** Tveir spilarar gátu keypt sama hlutinn á sama augnabliki.
- **Lausn:**
  - Í `src/domain/economy/shop.js` (`buyMarketListing`) er keyrð `BEGIN IMMEDIATE` transaction með atómísku skilyrði:
    ```sql
    UPDATE market_listings
    SET status = 'SOLD', buyer_character_id = ?, sold_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'ACTIVE'
    ```
  - Aðeins sá spilari sem fær `changes === 1` eignast hlutinn og greiðir gullið; hinn fær villuskilaboðin `'This item was just purchased by another adventurer.'` og ekkert gull er dregið af honum.
  - SQLite triggerinn `enforce_sold_listing_irreversible` kemur í veg fyrir að seld færsla verði virkjuð aftur.

### D. Bounty System (The Watcher's Board)
- **Rotin orsök:** `hunting_contracts` taflan var alls ekki samstillt í `spark-client.js`, þannig að öll virk bounty-verkefni töpuðust við F5 (endurhleðslu).
- **Lausn:**
  - `hunting_contracts` er nú fullkomlega samstillt í bæði `src/db/durable-store.js` og `src/firebase/spark-client.js` ásamt `firestore.rules`.
  - `claimCompletedContractsInCity` í `src/domain/bounties/service.js` notar atómískt `UPDATE hunting_contracts SET status = 'COMPLETED' WHERE id = ? AND status = 'READY_TO_CLAIM'` (`changes === 1`) og SQLite triggerinn `enforce_completed_bounty_irreversible` kemur í veg fyrir tvöfalda útborgun.

### E. Character State & Permadeath
- **Rotin orsök:** Dauð hetja gat í sumum tilfellum endurlífgast ef eldra snapshot var lesið inn.
- **Lausn:**
  - SQLite triggerinn `enforce_permadeath_irreversible` bannar á gagnagrunnsstigi að `is_alive` breytist úr `0` í `1`.
  - Allar leikjaaðgerðir (`move`, `combat`, `shop`, `bounties`, `rest`, `heal`) athuga `character.is_alive === 1` á netþjóni og vísa dauðum persónum á `/game/fallen`.

### F. Tvísmellir / Duplicate Requests (Próf 7)
- **Lausn:** `src/middleware/idempotency.js` (`action_idempotency_log`) ásamt `expectedRound` samanburði í `POST /game/combat/*` tryggir að tvísmellir á kaup- eða bardagahnappa framkvæma aðgerðina nákvæmlega einu sinni.

---

## 7. Migration, Backup og Rollback Plan

### Framkvæmd afritunar og flutnings (Migration):
1. **Fullt afrit tekið af lifandi Firestore og SQLite (`scripts/backup_database.js`):**
   - Afrit vistað í `db/backups/production-backup-latest.json` (SHA-256: `ed434a21372612f7f4eeee6567d16811cee0623dc7a478d8302282a2652175b7`).
   - Allir **8 núverandi notendur í Firestore** (`SkibidiToilet`, `gabrielorra`, `Panchoman`, `Vessel`, `hjorvar`, `viggida`, `Micron`, `BiscuitLord`) ásamt staðbundnum prófunarnotanda (**9 notendur alls**) voru fluttir óskertir inn í `data/darkgrid.sqlite` með `scripts/migrate_from_firestore.js`.
   - User IDs, Firebase UIDs (`firebase_uid`) og öll tengsl voru varðveitt.
2. **Staðfesting á endurheimt (`scripts/restore_database.js --dry-run`):**
   - Keyrð var full endurheimtarprófun (`--dry-run`) inn í hreinan minnisgrunn og staðfest að allar töflur, raðir og SHA-256 prófsumma stemma 100%.
3. **Innskráningarbrú fyrir núverandi vini (`src/domain/auth/service.js`):**
   - Þar sem eldri Firestore-notendur höfðu `password_hash = 'firebase-auth'`, sannreynir `loginUser` lykilorð þeirra sjálfkrafa gegn Firebase Auth REST API við fyrstu innskráningu og uppfærir `password_hash` yfir í dulkóðað `bcrypt` hash án þess að notendur þurfi að endurstilla lykilorð.
4. **Rollback Plan (Viðbragðsáætlun):**
   - Ekkert eldra skjal í Firestore (`users`, `characters`, `encounters`, `persistent_monsters`, `market_listings`) var eytt.
   - Ef þörf krefur má hvenær sem er endurheimta gagnagrunninn úr tímastimpluðu afriti með:
     ```bash
     npm run db:restore
     ```

---

## 8. Niðurstöður prófana

Allar sjálfvirkar prófanir keyra með `npm test` (**227 próf í 17 prófunarsvítum — 227 stóðust, 0 féllu**), þar á meðal nýja samþykktarsvítan í `tests/blaze_production_upgrade.test.js`:

| Próf | Lýsing | Niðurstaða |
| :--- | :--- | :--- |
| **Próf 1** | Tveir spilarar reyna að kaupa sama hlutinn á markaði samtímis — aðeins annar nær kaupunum og gull dregst aðeins einu sinni frá. | **STÓÐST (PASS)** |
| **Próf 2** | Spilari A drepur persistent monster — Spilari B getur hvorki endurlífgað það með eldri stöðu né fengið verðlaun tvisvar. | **STÓÐST (PASS)** |
| **Próf 3** | Spilari tekur Bounty á The Watcher's Board, endurhleður síðunni (F5) og samningurinn (ásamt boosted stats og reward) helst óbreyttur. | **STÓÐST (PASS)** |
| **Próf 4** | Spilari deyr og permadeath er vistað — hvorki F5 endurhleðsla, nýjar aðgerðabeiðnir, eldra snapshot né bein SQL-uppfærsla getur endurlífgað persónuna. | **STÓÐST (PASS)** |
| **Próf 5** | Netþjónn og gagnagrunnur endurræsast — öll vistuð gögn (HP, gull, XP, level) og virkar innskráningarlotur (`SqliteSessionStore`) haldast óskertar. | **STÓÐST (PASS)** |
| **Próf 6** | Spilari reynir að senda falsað `gold`, `current_hp`, `damage`, `uid` eða `character_id` úr vafranum — netþjónninn hafnar með **HTTP 400** og skráir öryggisatvik. | **STÓÐST (PASS)** |
| **Próf 7** | Spilari tvísmellir hratt á kaup- eða bardagahnapp (`X-Idempotency-Key` / `round`) — aðgerðin keyrir aðeins einu sinni. | **STÓÐST (PASS)** |
| **Migration & Auth** | Fluttir Firebase Spark aðgangar halda UID/ID og uppfæra `firebase-auth` lykilorð í `bcrypt` við fyrstu innskráningu. | **STÓÐST (PASS)** |

---

## 9. Staða útgáfu á Firebase Blaze & Cloud Run (VIRKT)

Öll skref útgáfunnar á `darkgrid-rpg` hafa verið framkvæmd og sannreynd í rauntíma:

1. **Firebase Blaze Greiðslureikningur:** Virkur (`billingAccounts/017244-26823E-A7A507`).
2. **Mánaðarlegt fjárhagsþak (Cloud Billing Budget):** Stofnað (`budgets/11520419-39b1-4536-9560-2d7487cd64ec` — `Darkgrid RPG Monthly Cap (< 5000 ISK)`, 25 USD ≈ 3.500 ISK) með sjálfvirkum viðvörunum við **25%, 50%, 75%, 90% og 100%**.
3. **Cloud Logging varðveisla:** Stillt á **7 daga** (`_Default` log bucket).
4. **Miðlægur Cloud Run leikjaþjónn (`darkgrid-api` í `europe-west1`):**
   - Slóð þjónustu: `https://darkgrid-api-tkgdhy2kaq-ew.a.run.app`
   - Stillingar: `minInstanceCount: 0`, `maxInstanceCount: 1`, `cpu: 1`, `memory: 512Mi`, `concurrency: 80`.
   - Container-mynd í Artifact Registry (`europe-west1-docker.pkg.dev/darkgrid-rpg/cloud-run-source-deploy/darkgrid-api:latest`) er undir 80 MB (vel innan 0.5 GB fría þaksins) þar sem statískar myndir (`/images/**`) og CSS (`/css/**`) eru þjónustuð beint af Firebase Hosting CDN.
5. **Firebase Hosting & Firestore Security Rules (`https://darkgrid-rpg.web.app`):**
   - Beinir öllum leikja- og auðkenningarbeiðnum (`**`) á `darkgrid-api` í `europe-west1`.
   - `/world_state/config.server_authoritative` er virkt (`true`) og `/server_state/**` geymir miðlæga gagnagrunnsstöðu.

Ef þú vilt gefa út nýja útgáfu síðar er nóg að keyra:
```bash
npm run deploy:blaze
npx firebase-tools deploy --only firestore:rules,hosting --project darkgrid-rpg
```

---

## 10. Áhættur sem enn eru til staðar og rekstrarathugasemdir

1. **Budget Alerts eru viðvaranir en ekki sjálfvirk slökkvun:** Eins og útskýrt er í kafla 4 stöðva Google Cloud Budget Alerts ekki innviði sjálfkrafa við 100% án Pub/Sub billing-aftengingar. Með `maxInstances: 1`, `512Mi` RAM, 7 daga log retention, CDN-þjónustun á myndum og ströngu Rate Limiting er kostnaðaráhætta hins vegar í algjöru lágmarki (~0–50 ISK/mán. við núverandi notkun).
2. **Single-instance hönnun (`maxInstances: 1`):** Þar sem SQLite er keyrt í minni/diski á einum ríkjandi Cloud Run container með differential write-through í Firestore, skal halda `maxInstances: 1` (sem ræður léttilega við 80 samtímis beiðnir og tugi spilara). Ef spilarafjöldi vex í mörg þúsund samtímis í framtíðinni er auðvelt að skipta `src/db/connection.js` yfir í Cloud SQL (PostgreSQL).

