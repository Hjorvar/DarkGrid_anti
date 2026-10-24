# DarkGrid — Phase 10: Heildarúttekt á Öryggi (Security Audit & Hardening Report)

**Úttektaraðili:** Agent F — Security Audit (`subagent-Agent-F---Security-Audit-self-e6c54c41`)  
**Dagsetning:** 24. október 2026  
**Umfang:** Aðalleikur DarkGrid (`src/`, `action-ui-lab/server/`), gagnagrunns- og setulag (`src/db/`), öryggismillilög (`src/middleware/`), Cloud Run / Firebase dreifing (`firestore.rules`, `scripts/deploy_blaze.js`) og sjálfvirk árásar- og öryggisprófun (`tests/phase10_security_audit.test.js`).

---

## 1. Samantekt (Executive Summary)

Í tengslum við **Phase 10** (almenn netútgáfa / Public Playtest á Google Cloud Run og Firebase Hosting) var framkvæmd ítarleg öryggisúttekt á öllum 11 lykilsviðum DarkGrid. Kerfið byggir á **Server-Authoritative** arkitektúr þar sem allir útreikningar á staðsetningu, bardaga, teningaköstum, gulli, reynslustigum (XP), verðmætum og varanlegum dauða (*permadeath*) fara fram í einangruðum SQLite færslum á miðlara.

Í úttektinni komu í ljós nokkrir mikilvægir fletir sem voru styrktir beint í öryggismillilögum (`src/middleware/security.js` og `action-ui-lab/server/routes/api-routes.js`), auk einnar ábendingar í `scripts/deploy_blaze.js` sem skráð er hér fyrir Main Agent:

| # | Öryggissvið | Staða eftir úttekt | Helstu aðgerðir og varnir |
|---|---|---|---|
| 1 | **Authentication & Sessions** | **STAÐFEST & HERT** | `__session` kaka með `HttpOnly`, `SameSite=Lax`, `Secure` í prod; sjálfvirk *Session Fixation* endurnýjun (`req.session.regenerate`) við innskráningu/nýskráningu. |
| 2 | **Password Hashing & Migration** | **STAÐFEST** | `bcryptjs` (cost factor 10); `'firebase-auth'` placeholder krefst gildrar Firebase auðkenningar og kemur í veg fyrir UID-yfirtöku. |
| 3 | **Authorization & Multi-User Isolation** | **STAÐFEST** | Stíf einangrun milli notenda á hetjum, 9-hólfa búnaði, verslun, bardaga og veiðisamningum (`403 Forbidden`). |
| 4 | **CSRF / CORS / Origin & Anti-Tamper** | **STAÐFEST & HERT** | Nýtt `originCsrfProtection` millilag (`Origin` og `Sec-Fetch-Site: cross-site` -> `403`); `FORBIDDEN_CLIENT_FIELDS` -> `400`. |
| 5 | **Rate Limiting & Cost Protection** | **STAÐFEST & HERT** | Nýtt `authRateLimiter` (15 tilraunir/mín -> `429`) á `/api/auth/*` og `LOGIN`/`REGISTER`; `gameRateLimiter` (120/mín -> `429`); `$25` Cloud Billing Kill-Switch. |
| 6 | **SQLite Injection & Transactions** | **STAÐFEST** | 100% stikaðar (`?`) prepared statements í `node:sqlite`; atómískar færslur með `withTransaction` (`BEGIN IMMEDIATE` / `ROLLBACK`). |
| 7 | **Server-Authoritative Movement & Combat** | **STAÐFEST & HERT** | Lokað á *Dungeon Entrance Teleport* glufu í `api-routes.js`; veggja- og jaðarvörn; Stage 1/2 skrímslaleynd; 0% leki úr `UNEXPLORED` Fog of War. |
| 8 | **Item / Gold / XP Exploit Prevention** | **STAÐFEST** | Vörn gegn tvíinnheimtu verkefna (`CLAIM_QUEST_REWARD`), sölu á íklæddum/byrjunarhlutum, neikvæðum vörunúmerum og tvítæmingu fjársjóðskistna. |
| 9 | **Permadeath & Concurrent Requests** | **STAÐFEST** | Dauðar hetjur (`is_alive = 0`) geta ekki framkvæmt aðgerðir; einhalla (monotonic) snapshot-vörn; `X-Idempotency-Key` og `409` in-flight læsing. |
| 10 | **Firestore Durability & Secrets** | **STAÐFEST + ÁBENDING** | `firestore.rules` harðlæsir `/server_state/**`; sjálfgefinn `SESSION_SECRET` bannaður í prod; úrbótabeiðni skráð fyrir `scripts/deploy_blaze.js`. |
| 11 | **Production Headers & Debug APIs** | **STAÐFEST & HERT** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Content-Security-Policy`; öll Lab/Debug API skila `403` í prod. |

---

## 2. Sundurliðuð Úttekt eftir Öryggissviðum (1–11)

### 2.1 Auðkenning og setustjórnun (Authentication & Sessions)
- **Kökustillingar (`__session`):** Firebase Hosting hleypir eingöngu köku með heitinu `__session` í gegnum CDN proxy að Cloud Run bakenda. Í `action-ui-lab/server/routes/api-routes.js` er `express-session` stillt með:
  - `name: '__session'`
  - `httpOnly: true` (kemur í veg fyrir að JavaScript lesi kökuna ef XSS ætti sér stað)
  - `sameSite: 'lax'` (verndar gegn hefðbundnum þverléns-POST beiðnum)
  - `secure: 'auto'` í production (virkjar `Secure` flaggið sjálfkrafa þegar `X-Forwarded-Proto: https` berst frá Cloud Run / Firebase proxy, með `app.set('trust proxy', 1)`).
- **Vörn gegn *Session Fixation* (Lagfært í úttekt):** Áður hélt `req.session` sama setuauðkenni (`sid`) ef biðlari sendi fyrirliggjandi `__session` köku inn í `POST /api/auth/login` eða `POST /api/auth/register`. Bætt var við `regenerateSessionBeforeAuth` í `action-ui-lab/server/routes/api-routes.js` sem kallar á `req.session.regenerate()` áður en innskráning eða nýskráning fer fram (bæði á `/api/auth/*` og `/api/action` fyrir `LOGIN`/`REGISTER`). Eldra setuauðkenni er þar með eytt úr `user_sessions` og nýtt slembið `sid` gefið út.
- **Útrunnar setur (`SqliteSessionStore`):** `src/db/session-store.js` geymir setur í `user_sessions` töflunni og eyðir sjálfkrafa útrunnum röðum (`expire <= Date.now()`) bæði við uppflettingu (`get`) og með reglubundinni hreinsun.

### 2.2 Lykilorðadulkóðun og flutningur aðganga (Password Hashing & Account Migration)
- **`bcryptjs` dulkóðun:** Í `src/domain/auth/service.js` eru öll lykilorð dulkóðuð með `bcrypt.hash(plainPassword, 10)` (`$2a$10$` / `$2b$10$`).
- **Öryggi `'firebase-auth'` flutningsaðganga:** `verifyPassword(plainPassword, hash)` hafnar öllum strengjum sem byrja ekki á `'$2'`, þannig að enginn getur skráð sig inn með bókstaflega lykilorðinu `'firebase-auth'`.
- **Vörn gegn yfirtöku aðgangs (*Account Takeover*):** Þegar eldri aðgangur með `password_hash === 'firebase-auth'` skráir sig inn sannprófar `loginUser` að `fbAuthResult.uid` passi við skráð `user.firebase_uid` (`if (!fbAuthResult || (user.firebase_uid && fbAuthResult.uid !== user.firebase_uid))`). Ef misræmi er í UID er innskráningu hafnað með `401` án þess að uppfæra lykilorðshakk eða eiganda.

### 2.3 Heimildir og einangrun milli notenda (Authorization & Multi-User Isolation)
- **Auðkennisupplausn (`resolveRequestUserId`):** Í production mode (`isProductionMode(options) === true`) er sjálfgefinn prófunarnotandi (`action_hero`) óvirkur og sérhver óauðkennd aðgerð á `/api/action` skilar `401 Unauthorized`.
- **Einangrun eigna og stöðu:**
  - `assertCharacterOwnsItem(db, character.id, itemInstanceId)` í `character-town-controller.js` sannprófar að `owner_type === 'CHARACTER'` og `owner_character_id === character.id` áður en `EQUIP`, `UNEQUIP` eða `SELL` er leyft (annars `403 Forbidden`).
  - Drykkja á heilsublöndum (`POTION` í `combat-controller.js`) og veiðisamningar (`ACCEPT_BOUNTY` / `ABANDON_BOUNTY` í `board.js`) eru bundin við `character_id` virkrar hetju innskráðs notanda.

### 2.4 CSRF / CORS / Origin og Anti-Tamper vörn
- **Nýtt `originCsrfProtection` millilag (Bætt við í úttekt):**Þar sem aðalleikurinn notar JSON `POST` endapunkta (`/api/action`, `/api/auth/*`, `/api/character/*`) með lotukökum (`__session`) var bætt við `originCsrfProtection` í `src/middleware/security.js` og það virkjað í `action-ui-lab/server/routes/api-routes.js`:
  - Ef `Sec-Fetch-Site: cross-site` kemur fram í stöðubreytandi beiðni (`POST`, `PUT`, `DELETE`, `PATCH`) er henni hafnað strax með `403 Forbidden`.
  - Ef `Origin` haus er til staðar er hann borinn saman við markþjón (`X-Forwarded-Host` eða `Host`). Ef `Origin` er `'null'`, ógild slóð, eða vísar á annað lén (t.d. `https://evil-attacker.example.com`) er beiðninni hafnað með `403 Forbidden` og atvikið skráð í öryggisskrá (`SECURITY_CSRF_ORIGIN_MISMATCH`).
- **Anti-Tamper (`FORBIDDEN_CLIENT_FIELDS`):** `labAntiTamperMiddleware` skannar `req.body`, `req.body.payload`, `req.body.payload.createCharacter` og `req.query` og hafnar samstundis (`400 Bad Request`) öllum beiðnum sem innihalda miðlarastýrða reiti (`hp`, `current_hp`, `max_hp`, `gold`, `xp`, `level`, `damage`, `dice_roll`, `is_alive`, `uid`, `userId`, `characterId`, `divine_charges`, `startingGold`, `isAdmin` o.fl.).

### 2.5 Hraðatakmarkanir og kostnaðarvörn (Rate Limiting & Budget Guard)
- **`authRateLimiter` (Bætt við í úttekt):** Sérhæfður hraðatakmarkari (sjálfgefið 15 tilraunir á mínútu á hverja IP-tölu) var útfærður í `src/middleware/security.js` og tengdur við `/api/auth/login`, `/api/auth/register` og `/api/action` þegar `action` er `'LOGIN'` eða `'REGISTER'`. Ef farið er yfir mörkin skilar miðlarinn HTTP `429 Too Many Requests`.
- **`gameRateLimiter`:** Takmarkar almennar leikbeiðnir við 120 aðgerðir á mínútu á hvern innskráðan notanda (`user:<id>`) eða IP-tölu (`ip:<addr>`). Í `api-routes.js` var `gameRateLimiter()` færður aftur fyrir `session()` millilagið svo hraðatakmörkunin geti nýtt `req.session.userId`.
- **Cloud Billing Kill-Switch & DDoS þak:** `maintenanceModeGuard` fylgist með daglegu beiðnaþaki (`MAX_DAILY_HTTP_REQUESTS = 500,000`) og `/internal/budget-killswitch` aftengir sjálfkrafa Cloud Billing og lokar Cloud Run IAM aðgangi ef `$25` mánaðarþaki er náð.

### 2.6 SQLite innspýtingar og færslueiningar (SQLite Injection & Transactions)
- **Engin strengjasamskeyting á notendainntaki:** Allar SQL fyrirspurnir í `src/` og `action-ui-lab/server/` nota stikaðar (`?`) prepared statements í `node:sqlite`. Í `src/domain/economy/shop.js` er `INACTIVE_ITEMS_SQL` eingöngu byggt úr föstum lista á miðlara (`INACTIVE_ITEM_NAMES`).
- **Atómískar færslur (`withTransaction`):** Verslun (`buyItem`, `sellItem`), bardagaúrlausn, permadeath og snapshot-innlestur keyra innan `withTransaction(db, ...)` sem tryggir `ROLLBACK` ef villa kemur upp í miðri aðgerð.

### 2.7 Miðlarastýrð hreyfing, bardagi, Encounter Secrecy og Fog of War
- **Lokað á *Dungeon Entrance Teleport* glufu (Lagfært í úttekt):** Við úttekt á `enterDungeon` í `action-ui-lab/server/services/dungeon-service.js` kom í ljós að fallið athugaði ekki hvort hetjan stæði í raun á yfirheimsreit dýflissunnar (`[9, 12]` fyrir Goblin Cave eða `[26, 5]` fyrir Ancient Crypt). Án þeirrar athugunar gat biðlari sent `POST /api/action { action: 'ENTER_DUNGEON', payload: { dungeonKey: 'ANCIENT_CRYPT' } }` úr Oakhaven `[15, 27]` og síðan `EXIT_DUNGEON` til að fjarflytja sig beint á `[26, 5]`. Viðbót í `conditionalActionAuthGuard` í `action-ui-lab/server/routes/api-routes.js` sannprófar nú hnit hetjunnar í `map_tiles` áður en innganga í dýflissu er leyfð og hafnar ólöglegum tilraunum með `400 Bad Request`.
- **Veggja- og jaðarvörn:** Bæði `validateMovement` á yfirheimi og `moveInDungeon` í dýflissum hafna hreyfingu á ófæra reiti (`is_passable = 0`) og út fyrir kort.
- **Stage 1 & Stage 2 Encounter Secrecy:** Í `DISCOVERED` (Stage 1) og `IN_COMBAT` (Stage 2) skilar `buildClientState` aldrei nákvæmu `current_monster_hp`, `monster_max_hp`, `armor_class`, `attack_bonus` eða hráum teningaköstum til biðlara, heldur eingöngu 9-þrepa ástandslýsingum (`Unhurt`, `Barely Scratched`, ..., `Near Death`).
- **Dungeon Fog of War (Zero-Leakage):** Í `buildDungeonMapPayload` skila ókannaðir reitir (`!isDiscovered`) eingöngu blindum staðgengilsgildum (`fogState: 'UNEXPLORED'`, `name: 'Unexplored Darkness'`, `roomType: 'UNKNOWN'`, `isPassable: false`, `bossKey: null`, `treasureKey: null`, `fixedEncounterKey: null`, `hasTreasure: false`, `hasBoss: false`).

### 2.8 Verðmæta-, gull- og XP-svindlvarnir (Item / Gold / XP Exploits)
- **Verkefnaverðlaun (`CLAIM_QUEST_REWARD`):** `claimQuestRewardByKey` í `topdown-world-service.js` krefst þess að hetjan sé í Oakhaven Sanctuary, að verkefnis-bossinn hafi verið felldur (`*_slain = 1`), og að staðan sé ekki þegar `REWARD_CLAIMED` / `REWARDED`. Tvíinnheimtu er hafnað.
- **Verslunar- og búnaðarvarnir:** `sellItem` í `src/domain/economy/shop.js` bannar sölu á íklæddum hlutum (`equipped_slot IS NOT NULL`) og byrjunarbúnaði (`sell_price <= 0`), og `buyItem` notar atómískar `WHERE id = ? AND gold >= ?` og `WHERE id = ? AND status = 'ACTIVE'` uppfærslur svo tveir leikmenn geti ekki keypt sama galdrahlut á endursölumarkaði samtímis.
- **Dýflissufjársjóðir:** Fjársjóðskistur og helgiskrín í dýflissum eru skráð í `character_dungeon_events` (`UNIQUE(character_id, dungeon_key, event_key)`) svo ekki er hægt að tæma sömu kistu oftar en einu sinni.

### 2.9 Varanlegur dauði og samhliða beiðnir (Permadeath Persistence & Idempotency)
- **Permadeath framfylgd:** Þegar hetja fellur (`is_alive = 0`) skilar `getLivingCharacterByUserId` `null`, sem læsir öllum leikaðgerðum í `FALLEN` ham, og `REVIVE` aðgerðin skilar `403 Forbidden` í production.
- **Einhalla (Monotonic) Permadeath vörn við Snapshot endurheimt:** `importDynamicState` í `src/db/durable-store.js` gætir þess að ef hetja er þegar látin í SQLite (`is_alive = 0`) eða varanlegt skrímsli þegar fellt (`status = 'SLAYED'`), þá geti eldra snapshot aldrei endurlífgað hetjuna eða skrímslið.
- **Idempotency & In-Flight læsing:** `createLabIdempotencyMiddleware` í `legacy-compatibility-service.js` notar `inFlightLabActions` (`409 Conflict` á samhliða tvítekningu) og `action_idempotency_log` (`X-Idempotent-Replay: true`) þegar `X-Idempotency-Key` eða `_actionId` er sent með POST beiðni.

### 2.10 Firestore varanleiki og leyndarmálastjórnun (Firestore Durability & Secrets)
- **`firestore.rules`:** Regluskráin harðlæsir `/server_state/{document=**}`, beinum skrifum á `/world_state/{docId}`, og sjálfgefnu wildcard `/{document=**}` með `allow read, write: if false;`. Aðeins Cloud Run bakendinn (með Google Cloud IAM þjónustulykli) getur lesið og skrifað `/server_state/durable_world_v1`.
- **Staðfesting á `SESSION_SECRET` við ræsingu:** Í `action-ui-lab/server/routes/api-routes.js` og `action-ui-lab/server.js` neitar þjónninn að ræsa í production mode ef `SESSION_SECRET` vantar, er styttri en 16 stafir, eða er settur á sjálfgefna þróunarlykilinn (`darkgrid-dev-secret-change-in-prod` eða `darkgrid-dev-secret-key-change-in-production`).

> [!WARNING]
> **Mikilvæg ábending til Main Agent varðandi `scripts/deploy_blaze.js` (Línur 325–328):**
> Í `scripts/deploy_blaze.js` (sem er í eigu Main Agent og var því ekki breytt af Agent F) stendur núna:
> ```javascript
> const sessionSecret =
>   process.env.SESSION_SECRET ||
>   crypto.createHash('sha256').update(`darkgrid-rpg-prod-secret-${PROJECT_ID}-v1`).digest('hex');
> ```
> **Áhætta:** Ef `deploy_blaze.js` er keyrt án `process.env.SESSION_SECRET` í umhverfisbreytu verður `SESSION_SECRET` reiknaður út frá föstum, opinberum streng (`darkgrid-rpg-prod-secret-darkgrid-rpg-v1`). Hver sem les frumkóðann gæti þá reiknað út sama SHA-256 gildi og falsað undirritaðar `__session` kökur (`s:<sid>.<hmac>`) fyrir hvaða `sid` sem er.
>
> **Ráðlögð lagfæring fyrir Main Agent í `scripts/deploy_blaze.js`:**
> Sækja núverandi `SESSION_SECRET` úr lifandi Cloud Run þjónustu (`GET https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${CLOUD_RUN_SERVICE}`) svo lykillinn haldist óbreyttur milli útgáfa, og nota `crypto.randomBytes(32).toString('hex')` ef þjónustan er verið að stofna í fyrsta sinn:
> ```javascript
> let existingSessionSecret = null;
> try {
>   const existingSvc = await apiRequest(
>     'GET',
>     `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${CLOUD_RUN_SERVICE}`,
>     token
>   );
>   const envs = existingSvc?.template?.containers?.[0]?.env || [];
>   const found = envs.find(e => e.name === 'SESSION_SECRET');
>   if (found && found.value && found.value.length >= 32) {
>     existingSessionSecret = found.value;
>   }
> } catch {
>   // Service does not exist yet
> }
> const sessionSecret =
>   process.env.SESSION_SECRET ||
>   existingSessionSecret ||
>   crypto.randomBytes(32).toString('hex');
> ```

### 2.11 Production öryggishausar og Debug / Lab Director API
- **Öryggishausar (`securityHeaders` í `src/middleware/security.js`):**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'`
- **Lokun á Lab Director / Debug API í Production (`403 Forbidden`):**
  - `GET /api/legacy-audit` skilar `401` fyrir óinnskráða og `403` fyrir almenna leikmenn í production.
  - Allar Lab Director aðgerðir í `/api/action` (`TELEPORT_TO_TILE`, `LAB_SCENARIO`, `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, `SET_ART_PREVIEW_MODE`, `REVIVE`, og `MOVE` með `testForceEncounter` eða `testForceAmbush`) eru harðlæstar (`403 Forbidden`) í production mode.

---

## 3. Sjálfvirk Öryggisprófun (`tests/phase10_security_audit.test.js`)

Ný prófunarsvíta (`tests/phase10_security_audit.test.js`) var skrifuð og keyrð gegn lifandi production-stilltum DarkGrid þjóni (`createMainApp({ production: true })`). Öll 11 prófin standast 100%:

1. `1. Authentication & Sessions: Enforces __session HttpOnly/SameSite=Lax/Secure flags, rotates session ID on login (Session Fixation guard), and prunes expired sessions` — **PASS**
2. `2. Password Hashing & Account Migration: Enforces bcrypt cost >= 10, blocks literal "firebase-auth" login without Firebase token, and blocks UID mismatch takeover` — **PASS**
3. `3. Authorization & Multi-User Isolation: Prevents User A from reading or mutating User B character, inventory, combat, or bounties` — **PASS**
4. `4. CSRF / CORS / Origin & Anti-Tamper: Rejects cross-origin Origin / Sec-Fetch-Site (403) and FORBIDDEN_CLIENT_FIELDS (400)` — **PASS**
5. `5. Rate Limiting: Enforces authRateLimiter (429) on login/register endpoints and gameRateLimiter (429) on action spam` — **PASS**
6. `6. SQLite Injection & Transactions: Neutralizes SQL injection payloads via parameterized queries and rolls back failed transactions atomically` — **PASS**
7. `7. Server-Authoritative Movement & Combat: Enforces wall/bounds checks, Stage 1/2 Encounter Secrecy, and Dungeon Fog of War zero-leakage` — **PASS**
8. `8. Item / Gold / XP Exploits & Duplicate Rewards: Blocks premature/double quest rewards, starter/equipped item selling, invalid shop buys & double chest looting` — **PASS**
9. `9. Permadeath Persistence & Concurrent Requests: Blocks dead hero actions/revival, enforces monotonic state import guard & deduplicates X-Idempotency-Key` — **PASS**
10. `10. Firestore Durability & Secrets Management: Verifies firestore.rules lockdown and production SESSION_SECRET enforcement` — **PASS**
11. `11. Production Security Headers & Debug APIs: Verifies CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy, and 403 on all Lab/Debug APIs` — **PASS**
