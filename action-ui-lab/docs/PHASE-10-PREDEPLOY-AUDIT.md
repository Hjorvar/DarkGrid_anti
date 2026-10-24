# DARKGRID — ÚTTEKT Á LOCAL, GITHUB OG FIREBASE FYRIR PHASE 10 ÚTGÁFU

**Dagsetning:** 24. október 2026  
**Tegund verkefnis:** Greining og úttekt (Read-Only Pre-Deploy Audit)  
**Staða:** Engu var breytt í kóða, gagnagrunni, Git greinum eða Firebase við þessa athugun.

---

## Yfirlit (Executive Summary)

Ítarleg athugun á staðbundnum Git-greinum, Antigravity worktrees, gagnagrunnum, byggingarskriptum og lifandi framleiðsluumhverfi (`https://darkgrid-rpg.web.app`) leiddi í ljós **nákvæma skýringu** á því hvers vegna eldri útgáfan af DarkGrid birtist enn á netinu og hvers vegna GitHub (`origin/main`) sýnir enn Phase 6.2:

1. **Nýjasta útgáfan (Phase 9C + Phase 10 undirbúningur) ER til staðar og fullkláruð staðbundið**, en hún er einangruð í sérstöku Git worktree (`C:\Users\hih\.gemini\antigravity\worktrees\antiDark\darkgrid_phase_9c_10` á greininni `darkgrid_phase_9c_10`, commit `c782bd8`).
2. **Aðalmappan (`C:\Users\hih\Documents\antiDark`, greinin `main`) er enn á Phase 8.1 (`de2a3ec`)** með ócommittuðum breytingum úr Phase 9A, og **GitHub (`origin/main`) er enn á Phase 6.2 (`042d122`)** vegna þess að hvorki `main` né `darkgrid_phase_9c_10` hafa verið push-uð á GitHub.
3. **Framleiðsluþjónustan á `https://darkgrid-rpg.web.app` keyrir nú þegar á Google Cloud Run (`darkgrid-api` í `europe-west1`, Blaze Plan ER virkt)**, en ílátið sem keyrir þar í dag var byggt úr eldri EJS/SSR útgáfunni (`src/views/*.ejs`).
4. **Ástæða þess að Phase 10 útgáfutilraunin í `darkgrid_phase_9c_10` stöðvaðist án þess að uppfæra Cloud Run** var **útrunnið OAuth `access_token`** í `~/.config/configstore/firebase-tools.json`. Vegna rökfræðivillu í `scripts/deploy_blaze.js` var `HTTP 401 Unauthorized` frá Google Cloud Billing API ranglega túlkað sem `billingEnabled: false (Spark Plan)`, sem olli því að skriptan hætti keyrslu áður en nýja ílátið var byggt og sett í loftið.

---

## 1. Athugun á Git og Worktrees

### 1.1 Staða greina og HEAD
| Umhverfi / Grein | Commit (HEAD) | Staða miðað við `origin/main` | Lýsing á innihaldi |
| :--- | :--- | :--- | :--- |
| **`origin/main` (GitHub)** | `042d122` | Grunnviðmið | **Phase 6.2** (*"docs(action-ui-lab): add Phase 6.2 final source-of-truth verification report"*). |
| **`main` (`C:\Users\hih\Documents\antiDark`)** | `de2a3ec` | **10 commits á undan** `origin/main` | **Phase 8.1** committed, en er með **ócommittaðar breytingar úr Phase 9A** í working tree (65 breyttar skrár og 7 óskráðar möppur/skrár). |
| **`audit_firebase_deployment_status` (þetta worktree)** | `de2a3ec` | **10 commits á undan** `origin/main` | Stofnað sjálfkrafa út frá `main` (`de2a3ec` = **Phase 8.1**). `git status` er hreint (`working tree clean`). |
| **`threat_states_landmark_scenes` (worktree)** | `10d5a66` | **11 commits á undan** `origin/main` | **Phase 9A** committed, en er með **ócommittaðar breytingar úr Phase 9B** í working tree. |
| **`darkgrid_phase_9c_10` (worktree)** | `c782bd8` | **14 commits á undan** `origin/main` (4 á undan `main`) | **Phase 9A + Phase 9B + Phase 9C + Phase 10** allt committed og `git status` er **alveg hreint (`working tree clean`)**. |

### 1.2 Commits sem eru í `darkgrid_phase_9c_10` en vantar á `main` og GitHub
Greinin `darkgrid_phase_9c_10` inniheldur öll 10 commits sem `main` hefur fram yfir `origin/main` (`b604661` til `de2a3ec`), **auk fjögurra nýjustu commits verkefnisins**:
1. `10d5a66` — `checkpoint(phase-9a): baseline before Phase 9B world expansion` (Threat Zones, Landmark Scenes, migration `017`).
2. `53c5843` — `checkpoint(phase-9b): baseline before Phase 9C and Phase 10` (Undead Lands, Goblin Cave & Ancient Crypt kennileiti, migration `018`).
3. `c1cc498` — `feat(phase-9c): large dungeons (Goblin Cave, Ancient Crypt), true LoS fog of war, and Ravencrag Highlands` (Stórar könnunarhæfar dýflissur, Bresenham Line-of-Sight Fog of War, 44×30 yfirheimur með 3 svæðum, migration `019`).
4. `c782bd8` — `feat(phase-10): promote main DarkGrid game to root, preserve legacy-game, and prepare production release` (Gamli EJS leikurinn fluttur í `legacy-game/`, nýi leikurinn gerður að aðalleik í rót).

---

## 2. Athugun á leikjaútgáfunum

### 2.1 Hvaða mappa inniheldur nýjasta og fullkomnasta leikinn?
Nýjasta og fullkomnasta útgáfan af DarkGrid er í worktree-möppunni:
- **`C:\Users\hih\.gemini\antigravity\worktrees\antiDark\darkgrid_phase_9c_10`** (grein `darkgrid_phase_9c_10`, commit `c782bd8`).

Í þeirri möppu hefur Phase 10A endurskipulagningin þegar verið framkvæmd og prófuð (196/196 próf í `npm test` og 95/95 próf í `npm run test:legacy`).

### 2.2 Tæknileg uppbygging nýja leiksins (Phase 9C / Phase 10)
1. **Ræsipunktar og Express Server:**
   - **Rót (`index.js` -> `src/server.js` -> `src/app.js`):** Í `darkgrid_phase_9c_10` ræsir `npm start` (`node src/server.js`) nýja leikinn sjálfgefið með `createMainApp()`, sem kallar á `createLabApp()` í `action-ui-lab/server.js`.
   - **Kjarnaþjónn (`action-ui-lab/server.js`):** Samræmir miðbúnað (middleware), kyrrstæðar skrár (`action-ui-lab/server/middleware/static-assets.js`) og API-leiðir (`action-ui-lab/server/routes/api-routes.js`).
   - **Varðveittur gamli leikur (`legacy-game/`):** Í `darkgrid_phase_9c_10` hafa `src/routes/{auth,character,game}.js` og `src/views/*.ejs` verið flutt í `legacy-game/routes/` og `legacy-game/views/` ásamt `legacy-game/server.js` og `legacy-game/app.js` (`npm run start:legacy`).

2. **Routes og Controllers (`action-ui-lab/server/`):**
   - `routes/api-routes.js`:
     - `GET /` -> `stateCtrl.getIndexPage` (þjónustar `action-ui-lab/public/index.html`).
     - `GET /healthz`, `GET /api/health` -> Létt heilsupróf fyrir Cloud Run.
     - `GET /api/state` -> Skilar fullu leikjaástandi (hetju, 44×30 yfirheimi eða virkri dýflissu, LoS Fog of War, kennileitasenu, bardagaástandi, verkefnum og búnaði) án þess að leka földum skrímslatölum eða ókönnuðum reitum.
     - `GET /api/auth/session`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` -> Reiknings- og lotustýring (`__session` HttpOnly kaka í SQLite).
     - `POST /api/character/create`, `POST /api/character/attributes/spend` -> 72-punkta hetjustofnun og stigahlutun.
     - `POST /api/action` -> Sameinaður aðgerða-endapunktur (`MOVE`, `TURN`, `ENGAGE_MONSTER`, `AVOID_MONSTER`, `ATTACK`, `USE_ABILITY`, `USE_POTION`, `FLEE`, `REST`, `ENTER_DUNGEON`, `EXIT_DUNGEON`, `ENGAGE_STRONGHOLD_BOSS`, `CONFRONT_HIGHLAND_WARLORD`, verslun og Watcher's Board).
   - Controllers í `action-ui-lab/server/controllers/`:
     - `state-controller.js`, `action-controller.js`, `navigation-controller.js`, `combat-controller.js`, `character-town-controller.js`, `auth-character-controller.js`, `adventure-scenario-controller.js`.
   - Services í `action-ui-lab/server/services/`:
     - `topdown-world-service.js` (44×30 yfirheimur: Goblin Forest, Undead Lands, Ravencrag Highlands, danger zones, Major Landmarks og quests).
     - `dungeon-service.js` (Goblin Cave 20×18 og Ancient Crypt 20×19, supercover Bresenham LoS Fog of War með `visionRadius` 2 fyrir Fighter/Cleric og 3 fyrir Ranger).
     - `viewport-scene-service.js`, `combat-sequence-service.js`, `client-state-service.js`, `monster-profile-service.js`, `facing-service.js`, `legacy-compatibility-service.js`, `sandbox-db-service.js`.

3. **CSS og JavaScript framendi (`action-ui-lab/public/`):**
   - **HTML:** `action-ui-lab/public/index.html`.
   - **8 einingaskiptar CSS skrár (`action-ui-lab/public/css/`):** `base.css`, `layout.css`, `character.css`, `world.css`, `combat.css`, `inventory.css`, `components.css`, `responsive.css` (þjónustaðar undir `/lab-assets/css/*`).
   - **ES6 JavaScript einingar (`action-ui-lab/public/js/`):**
     - `app.js`, `api/client.js`, `state/store.js`
     - `world/topdown-renderer.js`, `world/scene-renderer.js`, `world/navigation.js`, `world/minimap.js`, `world/atmosphere.js`, `world/legacy-svg.js`
     - `combat/combat-ui.js`, `combat/sequence.js`, `combat/fx.js`, `combat/size-arena.js`
     - `character/character-ui.js`, `inventory/inventory-ui.js`
     - `ui/hud.js`, `ui/modals.js`, `ui/chronicle.js`, `ui/adventure-overlays.js`, `ui/shortcuts.js`, `ui/utils.js`.

4. **Gagnagrunnskerfi (Database Architecture):**
   - Notar innbyggt **`node:sqlite` (`DatabaseSync`)** í Node.js >= 22.5 / 24 með WAL-ham og erlendum lyklum (`PRAGMA foreign_keys = ON`).
   - Keyrir 19 SQLite migrations (`db/migrations/001_initial_schema.sql` til `019_phase9c_dungeons_and_highlands.sql`) og seeds (`db/seeds/`), auk `ensureNonDestructiveLabAdapter(db)` sem bætir við dálkum án þess að eyða gögnum.
   - Sameiginleg d20 lénsrökfræði í `src/domain/` (`auth`, `character`, `world`, `encounters`, `combat`, `monsters`, `items`, `market`, `bounties`).
   - Varanleg geymsla í skýinu í gegnum `src/db/durable-store.js` (staðbundið JSON snapshot + mismunadrifin Firestore samstilling á `server_*` söfnum).

---

## 3. Athugun á Firebase og Cloud Run Deployment

### 3.1 Munurinn á `main` (Phase 8.1) og `darkgrid_phase_9c_10` (Phase 10)
| Skrá | Staða á `main` (`de2a3ec`) & `origin/main` (`042d122`) | Staða á `darkgrid_phase_9c_10` (`c782bd8`) |
| :--- | :--- | :--- |
| **`package.json`** | `"start": "node src/server.js"` ræsir **gamla EJS leikinn**. Nýi leikurinn er falinn undir `"start:lab": "node action-ui-lab/server.js"`. | `"start": "node src/server.js"` ræsir **nýja Phase 9C/10 leikinn**. Gamli leikurinn er á `"start:legacy": "node legacy-game/server.js"`. |
| **`Dockerfile`** | Afritar aðeins `src`, `db`, `public`, `images`, `scripts`. **Afritar EKKI `action-ui-lab/`** og keyrir gamla `src/server.js`. | Afritar `index.js`, `src`, **`action-ui-lab`**, `db`, `public`, `images`, `scripts` og keyrir nýja `src/server.js`. |
| **`scripts/build_firebase.js`** | Byggir **gamla Spark-era client SPA** (`dist/seed.sqlite`, `dist/js/spark-bundle.js`, þýðir `src/views/*.ejs` og býr til `dist/index.html`). | Kallar á `prepareStaticHostingAssets()` sem afritar `public/`, `images/` og `action-ui-lab/public/*` yfir í `dist/lab-assets/` og **fjarlægir `dist/index.html`** svo `/` fari á Cloud Run. |
| **`scripts/deploy_blaze.js`** | Pökkun fyrir Cloud Build tekur aðeins `Dockerfile package.json package-lock.json db public images src scripts` (**ekki `action-ui-lab`**). | Pökkun fyrir Cloud Build tekur `action-ui-lab` með í `darkgrid-source.tgz` og setur `/lab-assets/*` í `dist/`. |
| **`firebase.json` & `.firebaserc`** | Verkefni `darkgrid-rpg`, `hosting.public = "dist"`, rewrite `** -> run: { serviceId: "darkgrid-api", region: "europe-west1" }`. | Óbreytt (`darkgrid-rpg`, `dist`, rewrite á `darkgrid-api` í `europe-west1`). |

### 3.2 Hvað er raunverulega í Production núna (`https://darkgrid-rpg.web.app`)?
Bein lestrarprófun á `https://darkgrid-rpg.web.app` sýnir:
- `GET https://darkgrid-rpg.web.app/` skilar `HTTP 200 OK` með hausunum `x-powered-by: Express` og `set-cookie: __session=...`.
- HTML-svarið er **upprunalega EJS sniðmátið** (`<meta name="csrf-token" ...>`, `<a href="/login">Log In</a>`).
- `GET https://darkgrid-rpg.web.app/api/state` skilar `HTTP 302 Found -> Location: /login` (vegna þess að gamla EJS `authMiddleware` grípur `/api/state`).
- `GET https://darkgrid-rpg.web.app/healthz` skilar `HTTP 404 Not Found`.

**Niðurstaða:** Cloud Run þjónustan `darkgrid-api` í `europe-west1` **er í gangi og Blaze Plan er virkt á verkefninu**, en gámurinn sem keyrir í Cloud Run var byggður úr eldri EJS útgáfunni (fyrir Phase 10).

### 3.3 Af hverju mistókst sjálfvirk útgáfa í `darkgrid_phase_9c_10`?
Þegar `npm run deploy:blaze` var keyrt í `darkgrid_phase_9c_10` kl. 10:32 í dag:
1. Skriptan las OAuth `access_token` úr `C:\Users\hih\.config\configstore\firebase-tools.json` í gegnum `getServerAccessToken()` (`src/db/durable-store.js`).
2. Þetta `access_token` hafði runnið út (`expires_at: 1792144216774 < Date.now()`). `getServerAccessToken()` athugar hvorki `expires_at` né notar `refresh_token` til að sækja nýtt `access_token`.
3. Þegar `checkBillingStatus(token)` í `scripts/deploy_blaze.js` kallaði á `https://cloudbilling.googleapis.com/v1/projects/darkgrid-rpg/billingInfo` með útrunna tokeninu skilaði Google API **`HTTP 401 UNAUTHENTICATED`**.
4. Í `scripts/deploy_blaze.js` (línu 39–41) segir:
   ```js
   if (!resp.ok) {
     return { billingEnabled: false, status: resp.status };
   }
   ```
   Vegna þessa túlkaði skriptan `HTTP 401` sem `billingEnabled: false` (Spark Plan) og hætti keyrslu (`process.exit(0)`) áður en hún byggði og deployaði nýja Cloud Run gámnum.

---

## 4. Svör við spurningum 1–6

### 1. Af hverju er gamla DarkGrid enn á netinu?
Af þremur ástæðum:
1. Cloud Run þjónustan `darkgrid-api` sem liggur á bak við `https://darkgrid-rpg.web.app` keyrir enn gám sem var byggður úr gamla `src/server.js` (EJS/SSR leiknum).
2. Í `main` (`C:\Users\hih\Documents\antiDark`) vísa `package.json`, `Dockerfile` og `scripts/deploy_blaze.js` enn á gamla leikinn.
3. Í worktree-inu `darkgrid_phase_9c_10`, þar sem búið var að uppfæra `Dockerfile` og `src/server.js` fyrir nýja leikinn, stöðvaðist `npm run deploy:blaze` í skrefi 3 vegna útrunnins OAuth `access_token` í `firebase-tools.json` sem `checkBillingStatus()` túlkaði ranglega sem `billingEnabled: false`.

### 2. Hvar er nýjasta Phase 9C útgáfan?
Hún er í worktree-möppunni:
**`C:\Users\hih\.gemini\antigravity\worktrees\antiDark\darkgrid_phase_9c_10`** á greininni **`darkgrid_phase_9c_10`** (commit `c782bd8`, sem inniheldur einnig commit `c1cc498` fyrir Phase 9C, `53c5843` fyrir Phase 9B og `10d5a66` fyrir Phase 9A).

### 3. Er hún komin á GitHub?
**Nei.** Á GitHub er `origin/main` enn á commit `042d122` (Phase 6.2). Greinin `darkgrid_phase_9c_10` er **14 commits á undan `origin/main`** (og 4 commits á undan staðbundnu `main`). Ekkert af Phase 7, 8, 9A, 9B, 9C eða 10 hefur verið push-að á GitHub.

### 4. Hvað þarf nákvæmlega að breyta til að nýi leikurinn verði aðalútgáfan?
Í commit `c782bd8` á greininni `darkgrid_phase_9c_10` er búið að vinna ~95% af endurskipulagningunni (færa gamla leikinn í `legacy-game/`, láta `src/server.js` og `npm start` ræsa nýja leikinn, og uppfæra `Dockerfile`, `scripts/build_firebase.js` og `scripts/deploy_blaze.js`). Til að klára verkið örugglega þarf að:
1. **Sameina `darkgrid_phase_9c_10` (`c782bd8`) inn í `main`** í aðalmöppunni (`C:\Users\hih\Documents\antiDark`) eftir að ócommittaðar Phase 9A vinnuskrár í `C:\Users\hih\Documents\antiDark` hafa verið stashaðar/hreinsaðar (því þær eru þegar committaðar í `10d5a66` á `darkgrid_phase_9c_10`).
2. **Varðveita staðbundin gögn í `C:\Users\hih\Documents\antiDark\db\backups\production-backup-latest.json` (frá 15. okt)** svo tóma afritið í `darkgrid_phase_9c_10` yfirskrifi það ekki.
3. **Laga OAuth token-endurnýjun og villumeðhöndlun í `src/db/durable-store.js`, `scripts/backup_database.js` og `scripts/deploy_blaze.js`:**
   - Ef `access_token` í `~/.config/configstore/firebase-tools.json` er útrunnið (`expires_at < Date.now()`) eða skilar `401`, verður skriptan annaðhvort að endurnýja tokenið eða stöðva keyrslu með skýrri villu (`401 Unauthorized — keyrðu npx firebase-tools login`) í stað þess að skila tómu Firestore-afriti eða fölsku `billingEnabled: false`.
4. **Tryggja rétta hnita-vörpun (`tile_id`) fyrir eldri hetjur við endurheimt í 44×30 heiminum:**
   - Í 15×15 heiminum hafði Oakhaven `(7, 7)` `tile_id = 113`. Í 30×30 heiminum hafði Oakhaven `(15, 27)` `tile_id = 1051`. Í nýja 44×30 heiminum hefur Oakhaven `(15, 27)` `tile_id = 1429` (á meðan `tile_id = 113` er skógarreitur á `(7, 7)` og `tile_id = 1051` er hlíðarreitur á `(33, 18)` í Ravencrag Highlands).
   - Í `src/db/durable-store.js` (`importDynamicState`) þarf að tryggja að þegar eldri hetjur án 44×30 uppgötvunarferils eru fluttar inn úr Firestore/snapshot sé `tile_id = 113` (og `1051` ef úr 30×30) varpað á núverandi Oakhaven reit (`landmark_key = 'OAKHAVEN'`, `(15, 27)` = `id 1429`).

### 5. Er einhver hætta á að við töpum gögnum við yfirfærsluna?
**Já, við fundum tvær raunverulegar hættur sem verður að bægja frá áður en deployað er:**
1. **Hætta 1 — Tómt afrit og tómur SQLite grunnur í worktree:**
   - Í aðalmöppunni `C:\Users\hih\Documents\antiDark\data\darkgrid.sqlite` (og í `C:\Users\hih\Documents\antiDark\db\backups\production-backup-latest.json` frá 15. okt) eru **9 raunverulegir notendareikningar** (`haraldur`, `Micron`, `Vessel`, `gabrielorra`, `viggida`, `BiscuitLord`, `SkibidiToilet`, `Panchoman`, `hjorvar`) og hetjan `Torgal`.
   - Í worktree-möppunni `darkgrid_phase_9c_10` var hins vegar enginn `data/darkgrid.sqlite` til staðar í upphafi (því `data/` er í `.gitignore`), og þegar `backup_database.js` keyrði þar með útrunnu OAuth tokeni skrifaði það nýja `db/backups/production-backup-latest.json` skrá með **0 notendum og 0 hetjum**.
   - **Lausn:** Aldrei keyra `deploy:blaze` úr einangruðu worktree með tómum gagnagrunni eða útrunnu tokeni, og varðveita `C:\Users\hih\Documents\antiDark\data\darkgrid.sqlite` og `production-backup-latest.json` frá 15. október.
2. **Hætta 2 — `tile_id` hliðrun milli 15×15, 30×30 og 44×30 korta:**
   - Ef `importDynamicState()` les inn eldri hetju með `tile_id = 113` (Oakhaven í 15×15) eða `tile_id = 1051` (Oakhaven í 30×30) eftir að 44×30 kortið hefur verið byggt, lendir hetjan úti í óbyggðum í stað Oakhaven (`tile_id = 1429`).
   - **Lausn:** Bæta við öruggri Oakhaven/hnita-leiðréttingu í lok `importDynamicState()` í `src/db/durable-store.js`.

### 6. Er öruggt að hefja stóra multi-agent vinnu eftir þessa athugun?
**Ekki fyrr en búið er að samræma `main` við `darkgrid_phase_9c_10`.**
- Þegar nýir subagents eru ræstir með `Workspace: "branch"` eða `"share"`, stofnar umhverfið ný worktrees út frá `HEAD` á núverandi grein (`main`).
- Þar sem `main` er enn á **Phase 8.1 (`de2a3ec`)** (eins og sást á þessu `audit_firebase_deployment_status` worktree!), myndu nýir agents fá gamla Phase 8.1 kóðann í stað Phase 9C/10 kóðans og valda miklum merge-árekstrum.
- **Um leið og `main` hefur verið uppfært upp á `darkgrid_phase_9c_10` (`c782bd8`) og gömul worktrees hreinsuð, er 100% öruggt að ræsa stóra multi-agent vinnu.**

---

## 5. Nákvæm framkvæmdaáætlun (Step-by-Step Plan)

Hér er öruggasta röð aðgerða þegar þú gefur grænt ljós á framkvæmd:

### Skref 1: Tryggja öryggisafrit af núverandi gögnum í aðalmöppu
1. Afrita `C:\Users\hih\Documents\antiDark\data\darkgrid.sqlite` og `C:\Users\hih\Documents\antiDark\db\backups\production-backup-latest.json` (sem inniheldur 9 notendur og hetjuna `Torgal`) á öruggan stað (`db/backups/production-backup-2026-10-15-verified.json`) svo það glatist aldrei.

### Skref 2: Uppfæra `main` í `C:\Users\hih\Documents\antiDark` upp í Phase 9C / Phase 10 (`c782bd8`)
1. Í `C:\Users\hih\Documents\antiDark`:
   - Geyma/hreinsa ócommittaðar Phase 9A vinnuskrár (sem eru þegar committaðar í `10d5a66` á `darkgrid_phase_9c_10`) með `git stash push -u -m "pre-phase-10-working-tree"`.
   - Færa `main` á `darkgrid_phase_9c_10` (`git merge --ff-only darkgrid_phase_9c_10`, sem færir `main` hreint úr `de2a3ec` upp í `c782bd8`).
   - Endurheimta `db/backups/production-backup-2026-10-15-verified.json` yfir í `db/backups/production-backup-latest.json`.

### Skref 3: Laga OAuth Token-meðhöndlun og `tile_id` vörpun
1. **Í `src/db/durable-store.js`:**
   - Uppfæra `getServerAccessToken()` þannig að ef `cfg.tokens.expires_at < Date.now()` sé tokenið endurnýjað eða skilað `null` svo skriptur noti ekki útrunnið token.
   - Í `importDynamicState()`: Ef innflutt hetja er með eldra `tile_id` (`113` úr 15×15 eða `1051` úr 30×30) og engar línur í `character_discovered_tiles` í 44×30 heiminum, varpa `tile_id` hennar sjálfkrafa á Oakhaven reitinn (`x = 15, y = 27`) og skrá upphafs-uppgötvun (`recordTileDiscovery`).
2. **Í `scripts/backup_database.js` og `scripts/deploy_blaze.js`:**
   - Ef Firestore eða Cloud Billing API skilar `401` / `403`, kasta skýrri villu og **aldrei** yfirskrifa `production-backup-latest.json` með tómum gögnum eða túlka `401` sem `billingEnabled: false`.

### Skref 4: Keyra prófanir, Push-a á GitHub og Deploya á Firebase + Cloud Run
1. Keyra `npm test` (196 próf fyrir nýja aðalleikinn) og `npm run test:legacy` (95 próf fyrir varðveitta legacy-leikinn í `legacy-game/`).
2. Endurnýja Firebase innskráningu (`npx firebase-tools login --reauth` ef þarf) og sannreyna að `npm run backup:db` sæki öll skjöl úr Firestore með `HTTP 200`.
3. Push-a `main` á GitHub (`git push origin main`).
4. Keyra útgáfuna:
   ```bash
   npm run deploy:blaze
   npx firebase-tools deploy --only hosting,firestore:rules --project darkgrid-rpg
   ```
5. Sannreyna á `https://darkgrid-rpg.web.app` að `/healthz` skili `200 OK`, `/` hlaði nýja Phase 9C/10 viðmótinu og að reikningar og hetjur séu á sínum stað í Oakhaven.
