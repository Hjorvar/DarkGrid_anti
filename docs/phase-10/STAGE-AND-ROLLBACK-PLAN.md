# DARKGRID — PHASE 10: Staging Sannprófun, Kostnaðarvarnir og Rollback Áætlun

**Dagsetning:** 24. október 2026  
**Ábyrgðaraðili:** Agent G — Production & Deployment  
**Grunnur:** Commit `c782bd8` (Phase 10 Main Game Cutover & Legacy Preservation)

---

## 1. Sannprófun á Phase 10 Framleiðsluuppsetningu

### 1.1 Root App, `legacy-game/` og Entrypoints
- **[`index.js`](../../index.js), [`src/app.js`](../../src/app.js) og [`src/server.js`](../../src/server.js):**
  - Ræsa nýja DarkGrid aðalleikinn sjálfgefið úr rót (`npm start` / `node src/server.js`) með fullum 44×30 yfirheimi (1.320 reitir yfir *Blackwood Forest*, *The Undead Lands* og *Ravencrag Highlands*) og tveimur stórum könnunarhæfum dýflissum (*Goblin Cave* `[9, 12]` og *Ancient Crypt* `[26, 5]`).
  - Upprunalegi EJS/SSR leikurinn er óhreyfður og fullkomlega varðveittur í [`legacy-game/`](../../legacy-game/app.js).
- **Lotu- og framleiðsluöryggi við ræsingu:**
  - Í framleiðsluham (`NODE_ENV=production`) krefst [`createLabApp()`](../../action-ui-lab/server.js) sterks `SESSION_SECRET` (a.m.k. 16 stafir og ekki sjálfgefna þróunarlykilsins) og sleppir sjálfgefnu `action_hero` sandbox-hetjunni (`seedSandboxHero: false`).

### 1.2 Sannprófun á `Dockerfile`
[`Dockerfile`](../../Dockerfile) byggir á `node:24-slim` (með innbyggðu `node:sqlite`) og afritar allar nauðsynlegar möppur í `/app`:
- `COPY package.json package-lock.json ./` + `RUN npm ci --omit=dev`
- `COPY index.js ./`
- `COPY src ./src`
- `COPY action-ui-lab ./action-ui-lab`
- `COPY db ./db`
- `COPY public ./public`
- `COPY images ./images`
- `COPY scripts ./scripts`
- Keyrir `CMD ["node", "src/server.js"]` á porti `8080` með `NODE_ENV=production`, `DB_PATH=/tmp/darkgrid.sqlite` og `DURABLE_SNAPSHOT_PATH=/tmp/darkgrid-durable-snapshot.json`.

### 1.3 Sannprófun á Firebase Hosting (`prepareStaticHostingAssets()`)
Bæði [`scripts/deploy_blaze.js`](../../scripts/deploy_blaze.js) og [`scripts/build_firebase.js`](../../scripts/build_firebase.js) byggja `dist/` möppuna rétt:
- **Fjarlægir `dist/index.html`, `dist/monster_review.html` og `dist/monster_comparison.html`** þannig að Firebase Hosting grípi ekki `/` með gamalli kyrrstæðri síðu heldur beini `/` og `/api/*` í gegnum `firebase.json` rewrite yfir á Cloud Run þjónustuna `darkgrid-api` (`europe-west1`).
- **Afritar allar kyrrstæðar framendaskrár í `dist/`** svo Firebase CDN afgreiði þær án álags á Cloud Run:
  - `/lab-assets/css/*` (`base.css`, `layout.css`, `character.css`, `world.css`, `combat.css`, `inventory.css`, `components.css`, `responsive.css`)
  - `/lab-assets/js/*` (`app.js` og allar ES-einingar undir `api/`, `character/`, `combat/`, `inventory/`, `state/`, `ui/`, `world/`)
  - `/lab-assets/monster-size-catalog.js`
  - `/lab-assets/images/*` (`monsters-cutout/*.png`, `perspective/*.jpg`, `terrain/*.jpg`)
  - `/images/monsters/*` og `/images/terrain/*`

### 1.4 Ábending til Main Agent varðandi `buildAndDeployCloudRun()` í `scripts/deploy_blaze.js`
> [!IMPORTANT]
> Í [`scripts/deploy_blaze.js`](../../scripts/deploy_blaze.js) (línur 186–234) útbýr `buildAndDeployCloudRun()` létta `stageDir` möppu fyrir `darkgrid-source.tgz` og býr til 0-bæta stubba fyrir `images/monsters/*.png|*.webp` til að halda Docker-myndinni lítilli.
>
> Við greiningu á kóðanum kom í ljós að þrjár einingar í `action-ui-lab/` keyra `fs.existsSync(diskPath)` á servernum sjálfum:
> 1. [`action-ui-lab/monster-size-catalog.js`](../../action-ui-lab/monster-size-catalog.js) (lína 10316) og [`action-ui-lab/server/services/monster-profile-service.js`](../../action-ui-lab/server/services/monster-profile-service.js) (lína 234) athuga hvort `action-ui-lab/public/images/monsters-cutout/<slug>.png` sé til á diski. Ef 0-bæta stubbar fyrir `monsters-cutout/*.png` eru ekki í `stageDir`, fellur `INTEGRATED` cutout-hamur skrímsla niður í `CARD` mode (`CUTOUT_FILE_MISSING_ON_DISK`) inni í Cloud Run gámnum.
> 2. [`action-ui-lab/scene-catalog.js`](../../action-ui-lab/scene-catalog.js) (lína 50, `resolveExistingAssetUrl`) athugar `fs.existsSync` fyrir `/lab-assets/images/perspective/*`, `/lab-assets/images/terrain/*`, `/lab-assets/art-candidates/*` og `/images/terrain/*` (undir `public/images/terrain/*`).
> 3. [`action-ui-lab/server/controllers/state-controller.js`](../../action-ui-lab/server/controllers/state-controller.js) (lína 79) les `action-ui-lab/docs/visual-qa-results.json` ef hún er til staðar.
>
> **Uppfært í `scripts/deploy_blaze.js`:**
> Bætt var við `writeZeroByteTreeStubs()` fyrir `public/images/**`, `action-ui-lab/public/images/**` og `action-ui-lab/docs/phase-5/art-candidates/**` ásamt afritun á `action-ui-lab/docs/visual-qa-results.json`. Það bætir 0 bætum af myndagögnum við `darkgrid-source.tgz` en tryggir að öll `fs.existsSync` köll á Cloud Run skili `true`.

---

## 2. Einangruð Staging Deployment & Smoke Test Svíta (`tests/phase10_staging_readiness.test.js`)

Nýja prófunarsvítan [`tests/phase10_staging_readiness.test.js`](../../tests/phase10_staging_readiness.test.js) keyrir raunverulegan framleiðsluþjón (`startServer` úr `src/server.js`) í einangruðu temp-umhverfi (`NODE_ENV=production`, sterkt `SESSION_SECRET`, einangrað `DB_PATH` og `DURABLE_SNAPSHOT_PATH`, `FIRESTORE_DURABLE_SYNC=false` og `ENABLE_FIRESTORE_SYNC=false`) án þess að snerta lifandi Firestore eða `data/darkgrid.sqlite`:

1. **Próf 1 — Root App, `Dockerfile`, `firebase.json` & `dist/` Static Asset Build:**
   - Sannreynir `index.js`, `src/app.js`, `src/server.js`, `legacy-game/app.js`, `Dockerfile` og `firebase.json`.
   - Keyrir `prepareStaticHostingAssets()` og staðfestir að `dist/index.html` sé fjarlægt á meðan `/lab-assets/css/*`, `/lab-assets/js/*`, `/lab-assets/images/*` og `/images/*` séu til staðar.
2. **Próf 2 — Production Boot, Healthchecks, Root HTML & Unauthenticated Lockdown:**
   - Staðfestir að veikt `SESSION_SECRET` kasti öryggisvillu í production.
   - Staðfestir `GET /healthz` og `GET /api/health` (`200 OK`, `{ status: "ok" }`).
   - Staðfestir að `GET /` skili nýja DarkGrid Action Viewport HTML viðmótinu (`200 OK`, engin EJS innskráningarsíða).
   - Staðfestir að óinnskráðir notendur fái ekkert nafnlaust sandbox (`mode: "UNAUTHENTICATED"`, engin `action_hero` í SQLite) og að allar aðgerðir án innskráningar (`POST /api/action`, `POST /api/character/create`, `GET /api/legacy-audit`) skili `401`.
3. **Próf 3 — Fullt Staging Spilunarflæði (Skráning, Innskráning, Hetjustofnun, 44×30 Yfirheimur, Goblin Cave Dýflissa & Snapshot):**
   - Skráir notanda (`POST /api/auth/register`), útskráir (`POST /api/auth/logout`), innskráir (`POST /api/auth/login`) og stofnar Ranger-hetju í Oakhaven `[15, 27]`.
   - Gengur 23 lögleg skref eftir göngustígum 44×30 yfirheimsins frá Oakhaven `[15, 27]` í gegnum North Gate `[15, 26]`, Crossroads `[15, 23]` og Ancient Black Oak `[15, 15]` að Goblin Cave `[9, 12]`.
   - Fer inn í `GOBLIN_CAVE` (`ENTER_DUNGEON`), gengur inn í dýflissuna `(3, 16) -> (3, 15)` með Line-of-Sight Fog of War, og sannreynir að `DURABLE_SNAPSHOT_PATH` hafi vistast sjálfkrafa með gildu SHA-256 контролsumma (`verifySnapshotIntegrity`).
4. **Próf 4 — Læsing á Debug-Endapunktum (`403`), Anti-Tamper (`400`) & Kostnaðarvarnir (`503`):**
   - Staðfestir að `TELEPORT_TO_TILE`, `LAB_SCENARIO` (`COMBAT`, `STAGE1_MYSTERY`, `HEAL`, `RESET_WORLD`), `MOVE` með `testForceEncounter`/`testForceAmbush`, `REVIVE`, `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, `SET_ART_PREVIEW_MODE` og `GET /api/legacy-audit` skili öll `403 Forbidden`.
   - Staðfestir að Anti-Tamper hafni breyttum client-reitum (`gold`, `current_hp`, `xp`, `level`, `isAdmin`) með `400 Bad Request`.
   - Staðfestir að daglegt HTTP-þak (`MAX_DAILY_HTTP_REQUESTS`) skili `503 Service Unavailable` þegar farið er yfir mörk og að `/internal/budget-killswitch` hafni óleyfilegum lyklum með `403`.
5. **Próf 5 — Container Restart Simulation & Rollback Sannprófun:**
   - Lokar þjóni 1 og SQLite grunni 1, opnar glænýjan tóman SQLite grunn 2 og ræsir þjón 2 sem les sjálfkrafa úr `DURABLE_SNAPSHOT_PATH`.
   - Endurnýtir sömu `__session` lotukökuna og sannreynir að innskráning, hetja, yfirheims-uppgötvanir, virk dýflissa (`GOBLIN_CAVE`), staðsetning `(3, 15)` og dýflissu-Fog-of-War haldist 100% óskert.
   - Sannreynir bæði einhalla permadeath-vörn (`importDynamicState` getur aldrei lífgað látna hetju við) og hreina Rollback-endurheimt úr fyrra snapshot-checkpointi.

---

## 3. Budget Alerts vs. Raunverulegt Hart Kostnaðarþak (Cost Guardrails)

Mikilvægt er að gera skýran greinarmun á **Cloud Billing Budget Alerts** annars vegar og **raunverulegum hörðum kostnaðarvörnum (Hard Caps)** hins vegar:

| Eiginleiki | Cloud Billing Budget Alerts (25% / 50% / 75% / 90% / 100%) | Innbyggðar Harðar Kostnaðarvarnir DarkGrid (Hard Guardrails) |
| :--- | :--- | :--- |
| **Eðli** | Viðvörunar- og tilkynningakerfi í Google Cloud Billing (`$25` / ~3.500 ISK). | Virkar, sjálfvirkar takmarkanir í innviðum og applikasjónarkóða. |
| **Viðbragðstími** | Innheimtuupplýsingar í GCP uppfærast með töf (getur tekið 15 mínútur til nokkrar klukkustundir). | **Samstundis (0 ms töf)** á hverri HTTP-beiðni og hverju gagnagrunnsskrifi, auk sjálfvirks Pub/Sub rofa. |
| **Stöðvar umferð sjálfkrafa?** | **Nei**, tölvupóstviðvaranir einar og sér stöðva ekki gáma eða skrif. | **Já**, stöðvar bæði runaway HTTP-umferð, Firestore-skrif og aftengir Cloud Billing ef þaki er náð. |

### Hvernig vörnin virkar saman í 4 lögum:
1. **`maxInstanceCount: 1` og `minInstanceCount: 0` á Cloud Run ([`scripts/deploy_blaze.js`](../../scripts/deploy_blaze.js)):**
   - Kemur í veg fyrir að umferðartoppur ræsi tugi gáma samtímis. Hámark 1 gámur (1 vCPU, 512 MiB RAM, `cpuIdle: true`) getur verið í gangi á hverjum tíma, og hann fer niður í 0 þegar enginn spilar.
2. **Staðbundinn SQLite Lestur + `MAX_DAILY_HTTP_REQUESTS = 500,000` ([`src/middleware/security.js`](../../src/middleware/security.js)):**
   - Allar lesaðgerðir (`GET /api/state`, hreyfing, bardagaútreikningar) lesa úr staðbundnum SQLite gagnagrunni í minni/diski gámsins (**0 Firestore leskostnaður**).
   - `gameRateLimiter` leyfir að hámarki 120 beiðnir á mínútu á hvern notanda/IP (`429 Too Many Requests`).
   - `maintenanceModeGuard` telur allar HTTP-beiðnir yfir daginn og skilar samstundis **`503 Service Unavailable`** ef heildarfjöldi fer yfir `MAX_DAILY_HTTP_REQUESTS` (`500.000` beiðnir/dag, sem er langt innan 2.000.000 frírra Cloud Run beiðna á mánuði).
3. **Differential Sync + `MAX_DAILY_FIRESTORE_WRITES = 250,000` ([`src/db/durable-store.js`](../../src/db/durable-store.js)):**
   - `computeDirtyDelta()` reiknar SHA-256 hash á hverri röð í SQLite og sendir **eingöngu breyttar raðir** í Firestore eftir `POST` aðgerðir.
   - Ef fjöldi Firestore-skrifa á einum almanaksdegi nær `MAX_DAILY_FIRESTORE_WRITES` (`250.000`), stöðvar `pushDeltaToFirestoreServer()` samstundis öll frekari Firestore-skrif þann dag (`reason: 'daily_write_cap_reached'`) á meðan staðbundin vistun í `DURABLE_SNAPSHOT_PATH` heldur áfram.
4. **Sjálfvirkur Pub/Sub Budget Kill-Switch (`POST /internal/budget-killswitch` í [`src/middleware/security.js`](../../src/middleware/security.js)):**
   - Cloud Billing Budget er tengt við Pub/Sub rásina `projects/darkgrid-rpg/topics/budget-killswitch`.
   - Ef raunverulegur kostnaður nær `costAmount >= budgetAmount` (`$25`), virkjar `/internal/budget-killswitch`:
     1. `budgetKillSwitchActive = true` og `maintenance_mode = 1` í SQLite (allar beiðnir fá samstundis `503`).
     2. Kallar á `disableProjectBillingAndLockService()` sem aftengir Cloud Billing reikninginn af verkefninu (`PUT /v1/projects/darkgrid-rpg/billingInfo` með `billingAccountName: ""`) og fjarlægir `allUsers` (`roles/run.invoker`) af Cloud Run þjónustunni.

---

## 4. Rollback Áætlun (Viðbrögð ef vandamál koma upp í útgáfu)

### 4.1 Stig 1 — Tafarlaust Cloud Run Revision Rollback (< 30 sekúndur)
Ef ný útgáfa af `darkgrid-api` á Cloud Run sýnir villu í framleiðslu er hægt að beina 100% af umferð samstundis aftur á síðasta virka revision án þess að endurbyggja ílátið:

```bash
# 1. Skoða síðustu Cloud Run revisions fyrir darkgrid-api
gcloud run revisions list --service=darkgrid-api --region=europe-west1 --project=darkgrid-rpg

# 2. Beina 100% af umferð samstundis á fyrra staðfest revision
gcloud run services update-traffic darkgrid-api \
  --to-revisions=<PREVIOUS_REVISION_NAME>=100 \
  --region=europe-west1 \
  --project=darkgrid-rpg
```

### 4.2 Stig 2 — Gagnagrunns- og Snapshot Rollback
Áður en `scripts/deploy_blaze.js` framkvæmir nokkra breytingu tekur Skref 1 sjálfkrafa SHA-256 sannreynt afrit í `db/backups/production-backup-latest.json` (sem inniheldur bæði `sqliteSnapshot` og `firestoreBackup`). Ef endurheimta þarf gagnagrunnsástand:

1. **Virkja Maintenance Mode** svo engar nýjar `POST` breytingar eigi sér stað á meðan endurheimt stendur yfir:
   ```bash
   gcloud run services update darkgrid-api \
     --update-env-vars=MAINTENANCE_MODE=true \
     --region=europe-west1 \
     --project=darkgrid-rpg
   ```
2. **Sannreyna SHA-256 heilleika afrits og endurheimta í SQLite + Firestore:**
   ```bash
   node -e '
     const fs = require("fs");
     const { initializeDatabase } = require("./src/db/connection");
     const { runMigrations, runSeeds } = require("./src/db/migrate");
     const { verifySnapshotIntegrity, importDynamicState, pushDeltaToFirestoreServer } = require("./src/db/durable-store");

     const backup = JSON.parse(fs.readFileSync("./db/backups/production-backup-latest.json", "utf8"));
     const check = verifySnapshotIntegrity(backup.sqliteSnapshot);
     if (!check.valid) throw new Error("Backup integrity check failed: " + check.reason);

     const db = initializeDatabase("./data/darkgrid.sqlite");
     runMigrations(db);
     runSeeds(db);
     importDynamicState(db, backup.sqliteSnapshot, { replaceItems: true });
     pushDeltaToFirestoreServer(db, { forceFull: true }).then((res) => {
       console.log("Rollback synced to Firestore:", res);
       db.close();
     });
   '
   ```
3. **Aflétta Maintenance Mode og endurræsa gáminn:**
   ```bash
   gcloud run services update darkgrid-api \
     --update-env-vars=MAINTENANCE_MODE=false \
     --region=europe-west1 \
     --project=darkgrid-rpg
   ```
4. **Einhalla (Monotonic) Permadeath-vernd við innflutning:**
   - `importDynamicState()` í [`src/db/durable-store.js`](../../src/db/durable-store.js) tryggir að ef snapshot er flutt inn ofan í núverandi grunn getur eldra afrit **aldrei** lífgað látna hetju við (`is_alive: 0 -> 1`), endurvakið sigrað varanlegt skrímsli (`DEFEATED -> ACTIVE`), eða opnað aftur selda markaðsvöru (`SOLD -> ACTIVE`). Ef óskað er eftir fullri afturhvarfsendurheimt á hreinan grunn (t.d. í staging eða eftir gagnaskemmdir) er nýr SQLite grunnur frumstilltur áður en `loadDurableSnapshotFile()` er keyrt (eins og sannreynt er í Próf 5 í `tests/phase10_staging_readiness.test.js`).
