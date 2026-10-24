# DARKGRID — PHASE 10: Endurskipulagning Repository (Main Game & Legacy Game)

**Dagsetning:** 24. október 2026  
**Verkefni:** Phase 10A — Gera nýja DarkGrid-leikinn að aðalleik í rót repository og varðveita upprunalega EJS/SSR-leikinn í `legacy-game/`

---

## 1. Yfirlit og markmið

Í **Phase 10A** var möppuskipan verkefnisins endurskipulögð þannig að:
1. **Nýi DarkGrid-leikurinn** (með 44×30 yfirheimi yfir þrjú landsvæði, tveimur stórum könnunarhæfum dýflissum með Line-of-Sight Fog of War, Oakhaven-verkefnum, Major Landmark-senum og sjónrænu top-down / combat viðmóti) er nú **aðalleikur verkefnisins** og ræsist sjálfgefið úr rót repository (`index.js`, `src/app.js`, `src/server.js`, `npm start`, `npm run dev`).
2. **Upprunalegi DarkGrid-leikurinn** (EJS server-side rendered textaviðmótið úr Phase 1–6) var fluttur í sérstaka **`legacy-game/`** möppu þar sem hann er fullkomlega varðveittur, keyranlegur til samanburðar (`npm run start:legacy`, `npm run dev:legacy`) og með öllum sínum 95 sjálfvirku prófunum óskertum (`npm run test:legacy`).
3. **Sameiginlegur grunnkóði** (`src/domain/*`, `src/db/*`, `src/config/*`, `src/middleware/*`, `src/utils/*`, `db/migrations/*` og `db/seeds/*`) var varðveittur í `src/` og `db/` svo hvorug útgáfan tapi lénsrökfræði, d20-bardagavél, skrímslagagnagrunni eða varanlegri gagnageymslu.

---

## 2. Ný möppuskipan verkefnisins

```text
darkgrid/
├── index.js                      # Aðal-entrypoint verkefnisins (ræsir nýja aðalleikinn)
├── package.json                  # Ræsi-, prófana- og útgáfuskriptur fyrir aðalleik og legacy-game
├── Dockerfile                    # Cloud Run framleiðsluílát (keyrir node src/server.js)
├── firebase.json                 # Firebase Hosting + Cloud Run (darkgrid-api) stillingar
├── firestore.rules               # Læstar Firestore öryggisreglur fyrir server-side sync
├── src/
│   ├── app.js                    # Express app-verksmiðja fyrir nýja aðalleikinn (createMainApp)
│   ├── server.js                 # Framleiðslu- og þróunarþjónn aðalleiksins (með durable sync & graceful shutdown)
│   ├── config/                   # Umhverfisbreytur og stillingar (SQLite & durable snapshot slóðir)
│   ├── db/                       # SQLite tenging, migrations, seeds og durable-store (snapshot + Firestore delta sync)
│   ├── domain/                   # Sameiginleg d20 lénsrökfræði (auth, character, world, encounters, combat, monsters, starter)
│   ├── middleware/               # Öryggis-, rate-limit-, anti-tamper- og maintenance-middleware
│   └── utils/                    # Structured JSON logger
├── action-ui-lab/                # Kjarni nýja aðalleiksins (controllers, services, client UI, assets & Phase 8–9C próf)
│   ├── server/
│   │   ├── index.js              # Express samsetning fyrir aðalleikinn
│   │   ├── routes/api-routes.js  # REST API, healthchecks, durable sync hooks & auth/character endpoints
│   │   ├── controllers/          # State, action, navigation, combat, town og auth-character controllers
│   │   └── services/             # topdown-world-service (44x30), dungeon-service (Goblin Cave & Ancient Crypt), o.fl.
│   └── public/                   # Framenda-viðmót (index.html, CSS, JS, hljóð og myndir)
├── legacy-game/                  # Varðveittur upprunalegur EJS/SSR DarkGrid leikur
│   ├── app.js                    # Express app fyrir legacy EJS leikinn
│   ├── server.js                 # Sjálfstæður ræsipunktur fyrir legacy-útgáfuna
│   ├── routes/                   # Upprunalegu Express SSR routes (auth.js, character.js, game.js)
│   ├── views/                    # Upprunalegu EJS sniðmátin (game.ejs, fallen.ejs, login.ejs, o.fl.)
│   └── tests/                    # Öll 95 upprunalegu SSR/EJS prófin (keyrð með npm run test:legacy)
├── db/
│   ├── migrations/               # SQLite gagnagrunns-migrations (001 til 006)
│   ├── seeds/                    # Skrímsla-, hluta-, landslags- og heimsfræ (seeds)
│   └── backups/                  # Staðfest afrit af framleiðslugögnum
├── tests/                        # Sjálfvirk próf fyrir sameiginlega lénsrökfræði og Phase 10 öryggi/endurræsingu
└── docs/                         # Verkefnisskýrslur (þ.m.t. docs/phase-9c/ og docs/phase-10/)
```

---

## 3. Yfirlit yfir helstu breytingar í kóða

1. **Rótin ræsir nýja aðalleikinn sjálfgefið:**
   - [`index.js`](../../index.js) vísar nú beint á [`src/server.js`](../../src/server.js).
   - [`src/app.js`](../../src/app.js) býr til Express-forrit aðalleiksins (`createMainApp` / `createLabApp`) með fullum 44×30 heimi, 3 landsvæðum og 2 dýflissum.
   - [`src/server.js`](../../src/server.js) frumstillir SQLite gagnagrunninn, endurheimtir varanlegt ástand úr `durable_snapshot.json` og/eða Firestore við ræsingu, virkjar fullan 44×30 heim (`preserveExistingMap: false`), og vistar öll gögn við `SIGINT`/`SIGTERM`.
2. **Eldri EJS-leikur einangraður í `legacy-game/`:**
   - Upprunalegu `src/routes/{auth,character,game}.js` og `src/views/*.ejs` voru flutt í [`legacy-game/routes/`](../../legacy-game/routes/) og [`legacy-game/views/`](../../legacy-game/views/).
   - [`legacy-game/app.js`](../../legacy-game/app.js) og [`legacy-game/server.js`](../../legacy-game/server.js) nota áfram sameiginlegu lénsrökfræðina í `src/domain/` og `src/db/`.
   - Upprunalegu SSR-prófin sem prófa HTML-svör úr EJS-sniðmátum voru flutt í [`legacy-game/tests/`](../../legacy-game/tests/) og uppfærð með nýjum slóðum.
3. **Skriptur í `package.json`:**
   - `npm start` / `npm run dev` → Ræsir nýja aðalleikinn úr rót (`node src/server.js`).
   - `npm test` → Keyrir öll 196 sjálfvirku prófin fyrir nýja aðalleikinn og sameiginlega lénsrökfræði (`23` prófasöfn, `0` villur).
   - `npm run start:legacy` / `npm run dev:legacy` → Ræsir varðveitta legacy-leikinn (`node legacy-game/server.js`).
   - `npm run test:legacy` → Keyrir öll 95 sjálfvirku prófin fyrir legacy-leikinn (`0` villur).
