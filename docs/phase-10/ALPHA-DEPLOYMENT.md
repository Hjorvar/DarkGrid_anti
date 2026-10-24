# DARKGRID — PHASE 10: Public Alpha Deployment & Live Sannprófun (`ALPHA-DEPLOYMENT.md`)

**Dagsetning:** 24. október 2026  
**Lifandi vefslóð:** `https://darkgrid-rpg.web.app`  
**Cloud Run Þjónusta:** `darkgrid-api` (`europe-west1`, `https://darkgrid-api-tkgdhy2kaq-ew.a.run.app`)  
**Cloud Build ID:** `37fdd958-faf6-4525-9bb8-71b696999b9e` (`SUCCESS`)  
**Git Commit:** `bfb57fa` -> lokaskýrslu-commit á `main` / `origin/main`

---

## 1. Yfirlit yfir Útgáfuferlið (Phase 5)

1. **Pre-Deployment Backup & SHA-256 Sannprófun:**
   - `scripts/deploy_blaze.js` tók sjálfvirkt SHA-256 sannreynt öryggisafrit í `db/backups/production-backup-latest.json` (`SHA-256: ae09d0fe5dd8507343004bab36a3239cdae8efc136a57b1eb5cace53404cbf64`) áður en nokkur breyting var gerð.
2. **Cloud Billing & Log Retention:**
   - Staðfest var virk **Blaze Plan** tenging (`billingEnabled: true`, `billingAccounts/017244-26823E-A7A507`) og 7 daga varðveisla í Cloud Logging (`_Default` bucket).
3. **Cloud Build & Cloud Run (`darkgrid-api`):**
   - Byggð var ný `node:24-slim` gámamynd (`europe-west1-docker.pkg.dev/darkgrid-rpg/cloud-run-source-deploy/darkgrid-api:latest`, `buildId: 37fdd958-faf6-4525-9bb8-71b696999b9e`) með nýja DarkGrid aðalleiknum úr rót (`src/server.js`) og 0-bæta myndastubbum (`writeZeroByteTreeStubs`) svo öll `fs.existsSync` köll fyrir 37 RGBA skrímsla-cutouts og umhverfismyndir virki í gámnum á meðan Firebase CDN ber uppi myndirnar sjálfar.
   - Gámurinn var settur í loftið í `europe-west1` með `minInstanceCount: 0`, `maxInstanceCount: 1` (1 vCPU, 512 MiB RAM, `cpuIdle: true`), sterku `SESSION_SECRET`, `FIRESTORE_DURABLE_SYNC=true` og `ENABLE_FIRESTORE_SYNC=true`.
4. **Firebase Hosting CDN & `firestore.rules`:**
   - `npx firebase-tools deploy --only hosting,firestore:rules --project darkgrid-rpg` hlóð upp 378 kyrrstæðum framenda- og myndaskrám úr `dist/` (`/lab-assets/css/*`, `/lab-assets/js/*`, `/lab-assets/images/*`, `/images/*`) án `dist/index.html` og virkjaði læstar `firestore.rules`.
5. **Lifandi Gagnasamstilling (`pushDeltaToFirestoreServer`):**
   - Allir **10 lifandi notendareikningar** í `server_users` og báðar lifandi hetjur í `server_characters` (`Torgal`, Level 1 Ranger, og `magnus`, Level 1 Ranger) ásamt 10 hlutum (`server_item_instances`), 7 veiðisamningum (`server_hunting_contracts`) og 98 uppgötvuðum reitum (`server_character_discovered_tiles`) voru samstilltir á 44×30 yfirheiminn (`tile_id = 1429`, Oakhaven `[15, 27]`).

---

## 2. Lifandi Sannprófun á `https://darkgrid-rpg.web.app`

Sjálfvirk HTTP- og Headless Chrome sannprófun var keyrð beint á `https://darkgrid-rpg.web.app`:

| Sannprófunaratriði | Endapunktur / Aðgerð | Niðurstaða |
| :--- | :--- | :--- |
| **Aðalsíða nýja leiksins** | `GET https://darkgrid-rpg.web.app/` | **`200 OK`** (`fp-viewport`, `/lab-assets/js/app.js`, CSP & `X-Frame-Options: DENY`) |
| **Heilbrigðisskoðun (Health Probe)** | `GET https://darkgrid-rpg.web.app/api/health` | **`200 OK`** (`{"status":"ok","service":"darkgrid-rpg","environment":"production"}`) |
| **Gamepad API framendaeining** | `GET https://darkgrid-rpg.web.app/lab-assets/js/ui/gamepad.js` | **`200 OK`** (`text/javascript; charset=utf-8`) |
| **Dýflissu- og yfirheimsteiknari** | `GET https://darkgrid-rpg.web.app/lab-assets/js/world/topdown-renderer.js` | **`200 OK`** (`text/javascript; charset=utf-8`) |
| **RGBA Cutout & Spjaldamyndir á CDN** | `GET /lab-assets/images/monsters-cutout/goblin.png` & `/images/monsters/goblin.png` | **`200 OK`** (`image/png`) |
| **Skrímslaskrá á Cloud Run** | `GET https://darkgrid-rpg.web.app/api/monster-manifest` | **`200 OK`** (`totalDatabaseMonsters: 98`, `verifiedCutoutCount: 37`, `cardFallbackCount: 61`) |
| **Lotuathugun án innskráningar** | `GET https://darkgrid-rpg.web.app/api/auth/session` | **`200 OK`** (`authenticated: false`, `labToolsAllowed: false`) |
| **Óinnskráð aðgerðalæsing** | `POST https://darkgrid-rpg.web.app/api/action` (`MOVE`) | **`401 Unauthorized`** |
| **Cross-Origin CSRF vörn** | `POST https://darkgrid-rpg.web.app/api/action` (`Origin: https://evil-attacker.example.com`) | **`403 Forbidden`** |
| **Lifandi Firestore Gagnastaða** | `server_users` & `server_characters` | **10 notendur** og **2 hetjur** (`Torgal` & `magnus`, báðar á `tile_id = 1429` í Oakhaven `[15, 27]`) |
| **Headless Chrome Vafraopnun** | `https://darkgrid-rpg.web.app/` (`1920×1080`) | **`0` console errors**, `window.DarkgridGamepad` virkt, skjáskot vistað í [`live-alpha-darkgrid-rpg-web-app.png`](screenshots/live-alpha-darkgrid-rpg-web-app.png) |
