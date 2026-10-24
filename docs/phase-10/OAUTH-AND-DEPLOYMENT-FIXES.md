# DARKGRID — PHASE 10: Viðgerðir á OAuth, Cloud Billing, Backup og Hnita-yfirfærslu (`OAUTH-AND-DEPLOYMENT-FIXES.md`)

**Dagsetning:** 24. október 2026  
**Verkhluti:** Phase 1.1, 1.2 & 1.3 — OAuth Token Handling, Backup Fail-Safe & World Tile Migration  
**Staða:** **PASS**

---

## 1. Phase 1.1 — OAuth Token endurnýjun og aðgreining villna í Cloud Billing API

### Orsakagreining
Í fyrri útgáfutilraun las `getServerAccessToken()` í [`src/db/durable-store.js`](../../src/db/durable-store.js) `cfg.tokens.access_token` úr `~/.config/configstore/firebase-tools.json` án þess að athuga `cfg.tokens.expires_at`. Þegar útrunnið token var sent á Cloud Billing API skilaði Google `HTTP 401 UNAUTHENTICATED`, sem `checkBillingStatus()` í [`scripts/deploy_blaze.js`](../../scripts/deploy_blaze.js) túlkaði ranglega sem `{ billingEnabled: false }` (Spark Plan).

### Innleidd lausn
1. **Staðfesting á gildistíma og sjálfvirk endurnýjun (`getServerAccessToken` í `src/db/durable-store.js`):**
   - `isFirebaseTokenConfigValid(cfg)` athugar hvort `access_token` sé til staðar og hvort `expires_at` sé í framtíðinni (`expires_at > Date.now() + 30000`).
   - Ef tokenið er útrunnið en `refresh_token` er til staðar í `firebase-tools.json`, framkvæmir `getServerAccessToken()` sjálfvirka CLI-endurnýjun (`npx firebase-tools projects:list --json`) og les nýja tokenið.
   - Ef tokenið er enn útrunnið skilar fallið **aldrei** útrunnu tokeni heldur `null` (eða kastar `OAUTH_TOKEN_EXPIRED` með `status = 401` þegar `throwOnExpired: true`).
   - Engin token, refresh token eða leyndarmál eru nokkurn tímann skrifuð í logga eða skýrslur.
2. **Skýr aðgreining í `checkBillingStatus()` (`scripts/deploy_blaze.js`):**
   - `HTTP 401`: `{ ok: false, status: 401, errorCode: 'AUTH_EXPIRED', billingEnabled: null }`
   - `HTTP 403`: `{ ok: false, status: 403, errorCode: 'INSUFFICIENT_PERMISSIONS', billingEnabled: null }`
   - Netvilla / 5xx: `{ ok: false, errorCode: 'NETWORK_ERROR' | 'API_ERROR', billingEnabled: null }`
   - Aðeins þegar `HTTP 200 OK` skilar gildu JSON með `billingEnabled: false` er verkefnið greint á Spark Plan.
   - Raunprófun með endurnýjuðu tokeni gegn `darkgrid-rpg` staðfesti: **`HTTP 200 OK`, `billingEnabled: true`**.
3. **Öryggisviðgerð á `SESSION_SECRET` í `scripts/deploy_blaze.js`:**
   - Fjarlægður fyrirsjáanlegur `sha256('darkgrid-rpg-prod-secret-...')` strengur.
   - Skriptan varðveitir nú sterkt núverandi `SESSION_SECRET` af Cloud Run þjónustunni ef það er til staðar og ófyrirsjáanlegt, eða býr til nýtt 256-bita dulritunarlega slembið gildi með `crypto.randomBytes(32).toString('hex')`.

---

## 2. Phase 1.3 — Örugg yfirfærsla á `tile_id` milli kortastærða (`15×15` → `30×30` → `44×30`)

### Orsakagreining
- Í `15×15` heiminum (`225` reitir) hafði Oakhaven `(7, 7)` `tile_id = 113`.
- Í `30×30` heiminum (`900` reitir) hafði Oakhaven `(15, 27)` `tile_id = 1051` (eða `826`).
- Í nýja `44×30` heiminum (`1320` reitir) hefur Oakhaven `(15, 27)` `tile_id = 1429`.

### Innleidd lausn (`migrateImportedCharacterTiles` í `src/db/durable-store.js`)
Við innflutning í `importDynamicState(db, snapshot)` er hver hetja greind út frá `snapshot.worldVersion`, `character_discovered_tiles` og `map_tiles`:
1. **Hetjur sem eru þegar í 44×30 heiminum:** Ef hetja er á gildum, gangfærum reit (`is_passable = 1`) í 44×30 heiminum og sá reitur `(x, y)` er þegar skráður í `character_discovered_tiles` hetjunnar (og `worldVersion` er ekki eldri útgáfa), er `tile_id` hennar **aldrei** endurvarpað — jafnvel þótt reiturinn hafi tölulega ID `1051` eða `113`.
2. **Legacy 15×15 hetjur (t.d. `Torgal` og `magnus` með `tile_id = 113` og 0 línur í `character_discovered_tiles`):** Hnitin `(oldX, oldY)` í 15×15 eru reiknuð (`113 -> (7, 7)`) og vörpuð á samsvarandi 44×30 reit (`(15, 27)` Oakhaven, `tile_id = 1429`), auk þess sem upphafs-uppgötvun (`character_discovered_tiles`) í kringum Oakhaven og North Gate er skráð sjálfkrafa.
3. **Phase 8 / 9A / 9B (30×30) hetjur (t.d. `tile_id = 1051` á Oakhaven `(15, 27)`):** Þar sem reitur `1051` í 44×30 er á `(33, 18)` í Ravencrag Highlands (sem er óuppgötvaður hjá 30×30 hetju), en `1051 - 226 = 825 -> (15, 27)` er í `character_discovered_tiles` hetjunnar, vörpum við hetjunni örugglega á `(15, 27)` (`tile_id = 1429`).

---

## 3. Sjálfvirk prófun (`tests/phase10_oauth_backup_migration.test.js`)

Öll virkni í Phase 1.1, 1.2 og 1.3 var sannreynd með nýju sjálfvirku prófasafni (`node --test tests/phase10_oauth_backup_migration.test.js` — **4/4 próf PASS**):
- `1.1 OAuth token validation, automatic CLI refresh, and Cloud Billing 401/403/Spark/Blaze distinction` — **PASS**
- `1.2 Backup fail-safe: rejects HTTP 401/403 and strictly blocks overwriting populated backup with 0 users` — **PASS**
- `1.3 World tile migration: migrates 15x15 (113) and 30x30 (1051) to 44x30 (1429) without remapping legitimate 44x30 tiles` — **PASS**
